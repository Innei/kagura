import type { SlackWebClientLike } from '../types.js';
import { handleThreadConversation } from './conversation-pipeline.js';
import type {
  SlackIngressDependencies,
  ThreadConversationMessage,
  ThreadConversationOptions,
} from './types.js';

export interface ConversationDispatchInput {
  a2aAssignmentId?: string | undefined;
  a2aContext?: ThreadConversationOptions['a2aContext'];
  a2aSummaryAssignmentId?: string | undefined;
  addAcknowledgementReaction: boolean;
  agentProviderOverride?: string | undefined;
  channelId: string;
  currentBotUserId?: string | undefined;
  currentBotUserName?: string | undefined;
  files?: ThreadConversationMessage['files'];
  forceNewSession?: boolean;
  logLabel: string;
  messageTs: string;
  rootMessageTs: string;
  teamId?: string | undefined;
  text: string;
  threadTs?: string | undefined;
  userId: string;
  workspaceOverride?: ThreadConversationOptions['workspaceOverride'];
}

export async function dispatchThreadConversation(
  client: SlackWebClientLike,
  deps: SlackIngressDependencies,
  input: ConversationDispatchInput,
): Promise<void> {
  const message: ThreadConversationMessage = {
    channel: input.channelId,
    text: input.text,
    ts: input.messageTs,
    user: input.userId,
    ...(input.files ? { files: input.files } : {}),
    ...(input.teamId ? { team: input.teamId } : {}),
    ...(input.threadTs ? { thread_ts: input.threadTs } : {}),
  };

  const options: ThreadConversationOptions = {
    addAcknowledgementReaction: input.addAcknowledgementReaction,
    logLabel: input.logLabel,
    rootMessageTs: input.rootMessageTs,
    ...(input.a2aAssignmentId ? { a2aAssignmentId: input.a2aAssignmentId } : {}),
    ...(input.a2aContext ? { a2aContext: input.a2aContext } : {}),
    ...(input.a2aSummaryAssignmentId
      ? { a2aSummaryAssignmentId: input.a2aSummaryAssignmentId }
      : {}),
    ...(input.agentProviderOverride ? { agentProviderOverride: input.agentProviderOverride } : {}),
    ...(input.currentBotUserId ? { currentBotUserId: input.currentBotUserId } : {}),
    ...(input.currentBotUserName ? { currentBotUserName: input.currentBotUserName } : {}),
    ...(input.forceNewSession !== undefined ? { forceNewSession: input.forceNewSession } : {}),
    ...(input.workspaceOverride ? { workspaceOverride: input.workspaceOverride } : {}),
  };

  await handleThreadConversation(client, message, deps, options);
}
