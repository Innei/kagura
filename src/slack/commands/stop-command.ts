import type { AppLogger } from '~/logger/index.js';
import type { ThreadExecutionRegistry } from '~/slack/execution/thread-execution-registry.js';

import type { SlashCommandResponse } from './types.js';

export interface StopCommandDependencies {
  logger: AppLogger;
  threadExecutionRegistry: ThreadExecutionRegistry;
  threadTs?: string | undefined;
}

export async function handleStopCommand(
  deps: StopCommandDependencies,
): Promise<SlashCommandResponse> {
  const { logger, threadExecutionRegistry, threadTs } = deps;

  if (!threadTs?.trim()) {
    return {
      response_type: 'ephemeral',
      text: 'Use `/stop` inside the thread you want to stop.',
    };
  }

  const trimmedTs = threadTs.trim();
  const result = await threadExecutionRegistry.stopAll(trimmedTs, 'user_stop');
  logger.info('Stop thread %s: stopped=%d failed=%d', trimmedTs, result.stopped, result.failed);

  if (result.stopped === 0 && result.failed === 0) {
    return {
      response_type: 'ephemeral',
      text: 'There is no in-progress reply in this thread.',
    };
  }

  const parts: string[] = [];
  if (result.stopped > 0) {
    parts.push(
      `Stopped ${result.stopped} in-progress ${result.stopped === 1 ? 'reply' : 'replies'}.`,
    );
  }
  if (result.failed > 0) {
    parts.push(`Failed to stop ${result.failed} ${result.failed === 1 ? 'reply' : 'replies'}.`);
  }

  return {
    response_type: 'ephemeral',
    text: parts.join(' '),
  };
}
