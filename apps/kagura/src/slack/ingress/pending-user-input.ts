import type { SlackWebClientLike } from '../types.js';
import type { SlackIngressDependencies } from './types.js';

export async function maybeHandlePendingUserInputReply(
  client: SlackWebClientLike,
  input: {
    channelId?: string | undefined;
    text: string;
    threadTs: string;
    userId: string;
  },
  deps: SlackIngressDependencies,
): Promise<boolean> {
  if (!deps.userInputBridge.hasPending(input.threadTs)) {
    return false;
  }

  const result = deps.userInputBridge.submitReply({
    text: input.text,
    threadTs: input.threadTs,
    userId: input.userId,
  });
  if (!result.handled) {
    return false;
  }

  if (result.feedback && input.channelId) {
    await deps.renderer.postThreadReply(client, input.channelId, input.threadTs, result.feedback);
  }

  return true;
}
