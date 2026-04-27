import { runtimeInfo } from '~/logger/runtime.js';
import { zodParse } from '~/schemas/safe-parse.js';
import { SlackAppMentionEventSchema } from '~/schemas/slack/app-mention-event.js';

import type { SlackWebClientLike } from '../types.js';
import { resolveMentionCoordinationDecision } from './agent-team-routing.js';
import { dispatchThreadConversation } from './conversation-dispatch.js';
import {
  createBotIdentityResolver,
  shouldSkipBotAuthoredMessage,
  shouldSkipBotAuthoredMessageFromUnjoinedSender,
} from './message-filter.js';
import { buildA2AThreadContext } from './scenarios/a2a/routing.js';
import { maybeCreateA2AAssignment, persistA2ASession } from './scenarios/a2a/session.js';
import type { SlackIngressDependencies } from './types.js';

export {
  createAssistantThreadStartedHandler,
  createAssistantUserMessageHandler,
} from './assistant-message-handler.js';
export { handleThreadConversation } from './conversation-pipeline.js';
export { startA2ASummaryPoller } from './scenarios/a2a/summary-runner.js';
export { createThreadReplyHandler } from './thread-reply-handler.js';
export type { SlackIngressDependencies, ThreadConversationMessage } from './types.js';
export { WORKSPACE_PICKER_ACTION_ID } from './workspace-resolution.js';

export function createAppMentionHandler(deps: SlackIngressDependencies) {
  const getBotIdentity = createBotIdentityResolver(deps.logger);

  return async (args: { client: unknown; event: unknown }): Promise<void> => {
    const mention = zodParse(SlackAppMentionEventSchema, args.event, 'SlackAppMentionEvent');
    const client = args.client as SlackWebClientLike;
    const threadTs = mention.thread_ts ?? mention.ts;
    const botIdentity = await getBotIdentity(client);
    const botUserId = botIdentity?.userId;
    const rawMention = mention as {
      bot_id?: string | undefined;
      subtype?: string | undefined;
    };
    const botAuthored = Boolean(rawMention.bot_id) || rawMention.subtype === 'bot_message';

    if (
      shouldSkipBotAuthoredMessage(
        deps.logger,
        'app mention',
        threadTs,
        {
          bot_id: rawMention.bot_id,
          subtype: rawMention.subtype,
          text: mention.text,
          user: mention.user,
        },
        botUserId,
      )
    ) {
      return;
    }

    const existingSession = deps.sessionStore.get(threadTs);
    if (
      botAuthored &&
      existingSession &&
      (await shouldSkipBotAuthoredMessageFromUnjoinedSender(
        deps.logger,
        'app mention',
        client,
        mention.channel,
        threadTs,
        mention.user,
        deps.agentTeams,
      ))
    ) {
      return;
    }

    const coordinationDecision = resolveMentionCoordinationDecision(
      mention.text,
      {
        userId: botUserId,
        userName: botIdentity?.userName,
      },
      deps.agentTeams,
    );
    const a2aContext = buildA2AThreadContext(mention.text, coordinationDecision, deps.agentTeams);
    if (coordinationDecision.action === 'standby') {
      if (a2aContext) {
        persistA2ASession(deps, {
          channelId: mention.channel,
          rootMessageTs: threadTs,
          threadTs,
          context: a2aContext,
        });
      }
      runtimeInfo(
        deps.logger,
        'Skipping app mention for thread %s because current bot is standby for lead %s',
        threadTs,
        coordinationDecision.lead,
      );
      return;
    }

    const a2aAssignment = maybeCreateA2AAssignment({
      botAuthored,
      botUserId,
      deps,
      messageText: mention.text,
      senderUserId: mention.user,
      session: existingSession,
      threadTs,
      triggerTs: mention.ts,
      channelId: mention.channel,
    });

    await dispatchThreadConversation(client, deps, {
      a2aAssignmentId: a2aAssignment?.assignmentId,
      a2aContext,
      addAcknowledgementReaction: true,
      ...(a2aContext && deps.providerRegistry
        ? { agentProviderOverride: deps.providerRegistry.defaultProviderId }
        : {}),
      channelId: mention.channel,
      currentBotUserId: botUserId,
      currentBotUserName: botIdentity?.userName,
      files: mention.files,
      logLabel: 'app mention',
      messageTs: mention.ts,
      rootMessageTs: mention.ts,
      teamId: mention.team,
      text: mention.text,
      threadTs: mention.thread_ts,
      userId: mention.user,
    });
  };
}
