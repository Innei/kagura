import { runtimeInfo, runtimeWarn } from '~/logger/runtime.js';
import type { SlackMessage } from '~/schemas/slack/message.js';
import type { SessionRecord } from '~/session/types.js';

import type { SlackWebClientLike } from '../../../types.js';
import {
  shouldSkipBotAuthoredMessage,
  shouldSkipBotAuthoredMessageFromUnjoinedSender,
  shouldSkipMessageForForeignMention,
} from '../../message-filter.js';
import type { SlackIngressDependencies } from '../../types.js';
import type { CommonThreadReplyRoute, ThreadReplyIdentity } from '../thread-reply-route-types.js';

export function resolveRootMessageRoute(
  deps: SlackIngressDependencies,
  message: SlackMessage,
  identity: ThreadReplyIdentity,
  coordinationAction: 'none' | 'run',
): CommonThreadReplyRoute {
  if (coordinationAction !== 'run') {
    runtimeInfo(
      deps.logger,
      'Ignoring message event %s because it is not a thread reply',
      message.ts,
    );
    return { action: 'ignore' };
  }

  const channelId = typeof message.channel === 'string' ? message.channel : undefined;
  const senderId = message.user?.trim() || message.bot_id?.trim();
  if (!channelId || !senderId) {
    runtimeWarn(
      deps.logger,
      'Ignoring root team mention %s because channel or sender id is missing',
      message.ts,
    );
    return { action: 'ignore' };
  }

  if (
    shouldSkipBotAuthoredMessage(
      deps.logger,
      'root message',
      message.ts,
      message,
      identity.botUserId,
    )
  ) {
    return { action: 'ignore' };
  }

  return {
    action: 'dispatch',
    input: {
      addAcknowledgementReaction: false,
      channelId,
      currentBotUserId: identity.botUserId,
      currentBotUserName: identity.botUserName,
      files: message.files,
      logLabel: 'root team mention',
      messageTs: message.ts,
      rootMessageTs: message.ts,
      teamId: typeof message.team === 'string' ? message.team : undefined,
      text: message.text,
      userId: senderId,
    },
  };
}

export async function resolveGeneralThreadReplyRoute(
  client: SlackWebClientLike,
  deps: SlackIngressDependencies,
  input: {
    botAuthored: boolean;
    channelId: string;
    coordinationAction: 'none' | 'run';
    identity: ThreadReplyIdentity;
    message: SlackMessage;
    senderId: string;
    session: SessionRecord | undefined;
    teamId: string | undefined;
    threadTs: string;
  },
): Promise<CommonThreadReplyRoute> {
  const { channelId, identity, message, session, threadTs } = input;

  if (
    shouldSkipBotAuthoredMessage(deps.logger, 'thread reply', threadTs, message, identity.botUserId)
  ) {
    return { action: 'ignore' };
  }

  if (
    input.botAuthored &&
    (await shouldSkipBotAuthoredMessageFromUnjoinedSender(
      deps.logger,
      'thread reply',
      client,
      channelId,
      threadTs,
      typeof message.user === 'string' ? message.user : undefined,
      deps.agentTeams,
    ))
  ) {
    return { action: 'ignore' };
  }

  if (
    input.coordinationAction !== 'run' &&
    shouldSkipMessageForForeignMention(
      deps.logger,
      'thread reply',
      threadTs,
      message.text,
      identity.botUserId,
    )
  ) {
    return { action: 'ignore' };
  }

  return {
    action: 'dispatch',
    input: {
      addAcknowledgementReaction: false,
      channelId,
      currentBotUserId: identity.botUserId,
      currentBotUserName: identity.botUserName,
      files: message.files,
      logLabel: 'thread reply',
      messageTs: message.ts,
      rootMessageTs: session?.rootMessageTs ?? threadTs,
      teamId: input.teamId,
      text: message.text,
      threadTs,
      userId: input.senderId,
    },
  };
}
