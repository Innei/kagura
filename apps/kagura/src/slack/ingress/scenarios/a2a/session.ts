import { runtimeInfo } from '~/logger/runtime.js';
import type { SessionRecord } from '~/session/types.js';

import type { SlackWebClientLike } from '../../../types.js';
import type { A2AAssignmentRecord } from '../../a2a-coordinator-store.js';
import type { SlackIngressDependencies } from '../../types.js';
import {
  type A2AThreadContext,
  getA2AContextFromSession,
  getMentionedA2AParticipants,
  identityMatchesA2AParticipant,
  serializeA2AParticipants,
} from './routing.js';

export function persistA2ASession(
  deps: SlackIngressDependencies,
  input: {
    channelId: string;
    context: A2AThreadContext;
    rootMessageTs: string;
    threadTs: string;
  },
): void {
  const now = new Date().toISOString();
  const existing = deps.sessionStore.get(input.threadTs);
  const patch = {
    a2aLead: input.context.lead,
    a2aParticipantsJson: serializeA2AParticipants(input.context),
    ...(input.context.teamId ? { a2aTeamId: input.context.teamId } : {}),
    conversationMode: 'a2a' as const,
    ...(deps.providerRegistry ? { agentProvider: deps.providerRegistry.defaultProviderId } : {}),
  };
  if (existing) {
    deps.sessionStore.patch(input.threadTs, patch);
    return;
  }
  deps.sessionStore.upsert({
    channelId: input.channelId,
    createdAt: now,
    rootMessageTs: input.rootMessageTs,
    threadTs: input.threadTs,
    updatedAt: now,
    ...patch,
  });
}

export function maybeCreateA2AAssignment(input: {
  botAuthored: boolean;
  botUserId: string | undefined;
  channelId: string;
  deps: SlackIngressDependencies;
  messageText: string;
  senderUserId: string | undefined;
  session: SessionRecord | undefined;
  threadTs: string;
  triggerTs: string;
}): A2AAssignmentRecord | undefined {
  if (!input.botAuthored || !input.session || !input.deps.a2aCoordinatorStore) {
    return undefined;
  }
  const context = getA2AContextFromSession(input.session);
  if (!context || !identityMatchesA2AParticipant({ userId: input.senderUserId }, context.lead)) {
    return undefined;
  }
  const assignedAgentIds = getMentionedA2AParticipants(input.messageText, context).filter(
    (participant) => !identityMatchesA2AParticipant({ userId: participant }, context.lead),
  );
  if (
    assignedAgentIds.length === 0 ||
    !assignedAgentIds.some((participant) =>
      identityMatchesA2AParticipant({ userId: input.botUserId }, participant),
    )
  ) {
    return undefined;
  }

  return input.deps.a2aCoordinatorStore.createAssignment({
    agentIds: assignedAgentIds,
    channelId: input.channelId,
    leadId: context.lead,
    leadProviderId:
      input.session.agentProvider ??
      input.deps.providerRegistry?.defaultProviderId ??
      input.deps.claudeExecutor.providerId,
    threadTs: input.threadTs,
    triggerTs: input.triggerTs,
  });
}

export function shouldSkipA2ABotAuthoredMessage(
  deps: SlackIngressDependencies,
  threadTs: string,
  message: {
    bot_id?: string | undefined;
    subtype?: string | undefined;
    text: string;
    user?: string | undefined;
  },
  botUserId: string | undefined,
): boolean {
  if (message.subtype && message.subtype !== 'bot_message' && message.subtype !== 'file_share') {
    return true;
  }

  if (botUserId && message.user === botUserId) {
    runtimeInfo(
      deps.logger,
      'Skipping A2A thread reply for thread %s because message was authored by this app itself',
      threadTs,
    );
    return true;
  }

  runtimeInfo(
    deps.logger,
    'Skipping A2A thread reply for thread %s because bot-authored message is not a lead assignment or root-authored user simulation',
    threadTs,
  );
  return true;
}

export async function isA2AThreadRootAuthoredBotReply(
  client: SlackWebClientLike,
  channelId: string,
  threadTs: string,
  senderUserId: string | undefined,
): Promise<boolean> {
  if (!senderUserId) {
    return false;
  }
  try {
    const response = await client.conversations.replies({
      channel: channelId,
      ts: threadTs,
      inclusive: true,
      limit: 1,
    });
    const root = response.messages?.[0] as { ts?: unknown; user?: unknown } | undefined;
    return root?.ts === threadTs && root.user === senderUserId;
  } catch {
    return false;
  }
}
