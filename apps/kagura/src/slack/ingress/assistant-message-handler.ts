import type { AssistantThreadStartedMiddleware, AssistantUserMessageMiddleware } from '@slack/bolt';

import { redact } from '~/logger/redact.js';
import { runtimeError } from '~/logger/runtime.js';
import { SlackMessageSchema } from '~/schemas/slack/message.js';

import type { SlackWebClientLike } from '../types.js';
import { dispatchThreadConversation } from './conversation-dispatch.js';
import { createBotIdentityResolver, shouldSkipMessageForForeignMention } from './message-filter.js';
import { maybeHandlePendingUserInputReply } from './pending-user-input.js';
import type { SlackIngressDependencies } from './types.js';

const DEFAULT_ASSISTANT_PROMPTS = [
  {
    title: 'Summarize a thread',
    message: 'Please summarize the latest discussion in this thread.',
  },
  {
    title: 'Review code changes',
    message: 'Please review the recent code changes and call out risks.',
  },
  {
    title: 'Draft a plan',
    message: 'Please create an implementation plan for this task.',
  },
] as const;

export function createAssistantThreadStartedHandler(
  deps: SlackIngressDependencies,
): AssistantThreadStartedMiddleware {
  return async ({ logger, setSuggestedPrompts }) => {
    try {
      await setSuggestedPrompts({
        title: 'Try asking me to...',
        prompts: [...DEFAULT_ASSISTANT_PROMPTS],
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      runtimeError(
        deps.logger,
        'Failed to configure assistant thread prompts: %s',
        redact(errorMessage),
      );
      logger.error('Failed to configure assistant thread prompts: %s', errorMessage);
    }
  };
}

export function createAssistantUserMessageHandler(
  deps: SlackIngressDependencies,
): AssistantUserMessageMiddleware {
  const getBotIdentity = createBotIdentityResolver(deps.logger);

  return async (args) => {
    const parsed = SlackMessageSchema.safeParse(args.message);
    if (!parsed.success) {
      return;
    }

    const message = parsed.data;
    const threadTs = message.thread_ts;
    const channelId = typeof message.channel === 'string' ? message.channel : undefined;
    const teamId =
      typeof args.context.teamId === 'string'
        ? args.context.teamId
        : typeof args.body.team_id === 'string'
          ? args.body.team_id
          : undefined;
    const userId =
      typeof args.context.userId === 'string'
        ? args.context.userId
        : typeof message.user === 'string'
          ? message.user
          : undefined;

    const hasTextOrFiles = message.text.trim() || (message.files && message.files.length > 0);
    if (!threadTs || !channelId || !teamId || !userId || !hasTextOrFiles) {
      runtimeError(
        deps.logger,
        'Skipping assistant message without required identifiers (channel=%s thread=%s team=%s user=%s hasContent=%s)',
        channelId ?? 'missing',
        threadTs ?? 'missing',
        teamId ?? 'missing',
        userId ?? 'missing',
        String(hasTextOrFiles),
      );
      return;
    }

    const client = args.client as unknown as SlackWebClientLike;
    const handledUserInput = await maybeHandlePendingUserInputReply(
      client,
      {
        channelId,
        text: message.text,
        threadTs,
        userId,
      },
      deps,
    );
    if (handledUserInput) {
      return;
    }

    const botIdentity = await getBotIdentity(client);
    const botUserId = botIdentity?.userId;
    if (
      shouldSkipMessageForForeignMention(
        deps.logger,
        'assistant user message',
        threadTs,
        message.text,
        botUserId,
      )
    ) {
      return;
    }

    const existingSession = deps.sessionStore.get(threadTs);
    if (!existingSession) {
      await args.setTitle(message.text).catch((error: unknown) => {
        deps.logger.warn('Failed to set assistant thread title: %s', String(error));
      });
    }

    await dispatchThreadConversation(client, deps, {
      addAcknowledgementReaction: false,
      channelId,
      currentBotUserId: botUserId,
      currentBotUserName: botIdentity?.userName,
      files: message.files,
      logLabel: 'assistant user message',
      messageTs: message.ts,
      rootMessageTs: threadTs,
      teamId,
      text: message.text,
      threadTs,
      userId,
    });
  };
}
