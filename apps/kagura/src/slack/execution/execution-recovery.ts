import { redact } from '~/logger/redact.js';
import { runtimeError, runtimeInfo, runtimeWarn } from '~/logger/runtime.js';

import { dispatchThreadConversation } from '../ingress/conversation-dispatch.js';
import type { SlackIngressDependencies } from '../ingress/types.js';
import type { SlackWebClientLike } from '../types.js';

const DEFAULT_MAX_RECOVERY_ATTEMPTS = 2;

export interface RecoverPendingExecutionsOptions {
  maxAttempts?: number | undefined;
}

export async function recoverPendingExecutions(
  client: SlackWebClientLike,
  deps: SlackIngressDependencies,
  options?: RecoverPendingExecutionsOptions,
): Promise<void> {
  const store = deps.persistentExecutionStore;
  if (!store) {
    return;
  }

  const maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_RECOVERY_ATTEMPTS;
  const records = store.claimRecoverable(maxAttempts);
  if (records.length === 0) {
    return;
  }

  runtimeInfo(deps.logger, 'Recovering %d interrupted agent execution(s)', records.length);

  const identity = await resolveBotIdentity(client, deps);
  for (const record of records) {
    if (deps.providerRegistry && !deps.providerRegistry.has(record.providerId)) {
      runtimeWarn(
        deps.logger,
        'Skipping recovery for execution %s because provider %s is not registered',
        record.executionId,
        record.providerId,
      );
      store.markTerminal(record.executionId, 'failed', 'provider_missing');
      continue;
    }

    await deps.renderer
      .postThreadReply(
        client,
        record.channelId,
        record.threadTs,
        'Host restarted during execution; resuming the interrupted task.',
      )
      .catch((error) => {
        deps.logger.warn(
          'Failed to post execution recovery notice for %s: %s',
          record.executionId,
          String(error),
        );
      });

    try {
      await dispatchThreadConversation(client, deps, {
        addAcknowledgementReaction: false,
        agentProviderOverride: record.providerId,
        channelId: record.channelId,
        ...(identity.currentBotUserId ? { currentBotUserId: identity.currentBotUserId } : {}),
        ...(identity.currentBotUserName ? { currentBotUserName: identity.currentBotUserName } : {}),
        executionId: record.executionId,
        logLabel: 'recovered interrupted agent execution',
        messageTs: record.messageTs,
        ...(record.resumeHandle ? { resumeHandleOverride: record.resumeHandle } : {}),
        rootMessageTs: record.rootMessageTs,
        ...(record.teamId ? { teamId: record.teamId } : {}),
        text: buildRecoveryMentionText(record.text),
        ...(record.threadTs !== record.messageTs ? { threadTs: record.threadTs } : {}),
        userId: record.userId,
      });
      runtimeInfo(
        deps.logger,
        'Recovered interrupted execution %s for thread %s',
        record.executionId,
        record.threadTs,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      runtimeError(
        deps.logger,
        'Failed to recover interrupted execution %s for thread %s: %s',
        record.executionId,
        record.threadTs,
        redact(message),
      );
      store.markTerminal(record.executionId, 'failed', 'recovery_failed');
    }
  }
}

function buildRecoveryMentionText(originalText: string): string {
  return [
    originalText,
    '',
    '<host_recovery>',
    'Kagura restarted while this Slack request was still running.',
    'Resume the interrupted work in this thread using the loaded Slack history, session state, and the last visible progress.',
    'Do not redo work that is already visibly complete; continue from the interruption point.',
    '</host_recovery>',
  ].join('\n');
}

async function resolveBotIdentity(
  client: SlackWebClientLike,
  deps: SlackIngressDependencies,
): Promise<{ currentBotUserId?: string; currentBotUserName?: string }> {
  if (!client.auth?.test) {
    return {};
  }
  try {
    const identity = await client.auth.test();
    return {
      ...(identity.user_id ? { currentBotUserId: identity.user_id } : {}),
      ...(identity.name ? { currentBotUserName: identity.name } : {}),
    };
  } catch (error) {
    deps.logger.warn(
      'Failed to resolve Slack bot identity for execution recovery: %s',
      String(error),
    );
    return {};
  }
}
