import { runtimeInfo } from '~/logger/runtime.js';
import type { SlackMessage } from '~/schemas/slack/message.js';
import type { SessionRecord } from '~/session/types.js';

import type { SlackWebClientLike } from '../../../types.js';
import type { SlackIngressDependencies } from '../../types.js';
import type { CommonThreadReplyRoute, ThreadReplyIdentity } from '../thread-reply-route-types.js';
import {
  type A2AThreadContext,
  getMentionedA2AParticipants,
  identityMatchesA2AParticipant,
  resolveA2AThreadReplyDecision,
} from './routing.js';
import {
  isA2AThreadRootAuthoredBotReply,
  maybeCreateA2AAssignment,
  shouldSkipA2ABotAuthoredMessage,
} from './session.js';

export async function resolveA2AThreadReplyRoute(
  client: SlackWebClientLike,
  deps: SlackIngressDependencies,
  input: {
    a2aContext: A2AThreadContext;
    botAuthored: boolean;
    channelId: string;
    identity: ThreadReplyIdentity;
    message: SlackMessage;
    senderId: string;
    session: SessionRecord | undefined;
    teamId: string | undefined;
    threadTs: string;
  },
): Promise<CommonThreadReplyRoute> {
  const { a2aContext, channelId, identity, message, session, threadTs } = input;
  const rootAuthoredBotReply =
    input.botAuthored && message.user !== identity.botUserId
      ? await isA2AThreadRootAuthoredBotReply(client, channelId, threadTs, message.user)
      : false;
  const effectiveBotAuthored = input.botAuthored && !rootAuthoredBotReply;
  const mentionedA2AParticipants = getMentionedA2AParticipants(message.text, a2aContext);
  const a2aDecision = resolveA2AThreadReplyDecision(
    message.text,
    {
      userId: identity.botUserId,
      userName: identity.botUserName,
    },
    a2aContext,
  );
  const a2aAssignment = maybeCreateA2AAssignment({
    botAuthored: effectiveBotAuthored,
    botUserId: identity.botUserId,
    deps,
    messageText: message.text,
    senderUserId: typeof message.user === 'string' ? message.user : undefined,
    session,
    threadTs,
    triggerTs: message.ts,
    channelId,
  });

  if (effectiveBotAuthored && !a2aAssignment) {
    const isExplicitSelfMention =
      a2aDecision.action === 'run' && a2aDecision.reason === 'a2a_explicit_self_mention';
    if (
      !isExplicitSelfMention &&
      shouldSkipA2ABotAuthoredMessage(deps, threadTs, message, identity.botUserId)
    ) {
      return {
        action: 'ignore',
        summaryCheck: {
          identity,
          session,
        },
      };
    }
  }

  if (
    !effectiveBotAuthored &&
    mentionedA2AParticipants.length > 1 &&
    !identityMatchesA2AParticipant(
      { userId: identity.botUserId, userName: identity.botUserName },
      a2aContext.lead,
    )
  ) {
    runtimeInfo(
      deps.logger,
      'Skipping A2A thread reply for thread %s because multiple agents were mentioned; lead %s will coordinate',
      threadTs,
      a2aContext.lead,
    );
    return { action: 'ignore' };
  }

  if (a2aDecision.action === 'standby' && !a2aAssignment) {
    runtimeInfo(
      deps.logger,
      'Skipping A2A thread reply for thread %s because current bot is standby for lead %s (%s)',
      threadTs,
      a2aDecision.lead,
      a2aDecision.reason,
    );
    return { action: 'ignore' };
  }

  return {
    action: 'dispatch',
    input: {
      a2aAssignmentId: a2aAssignment?.assignmentId,
      a2aContext,
      addAcknowledgementReaction: false,
      channelId,
      currentBotUserId: identity.botUserId,
      currentBotUserName: identity.botUserName,
      files: message.files,
      logLabel: a2aAssignment ? 'A2A assignment' : 'A2A thread reply',
      messageTs: message.ts,
      rootMessageTs: session?.rootMessageTs ?? threadTs,
      teamId: input.teamId,
      text: message.text,
      threadTs,
      userId: input.senderId,
    },
    ...(effectiveBotAuthored
      ? {
          summaryCheck: {
            identity,
            session,
          },
        }
      : {}),
  };
}
