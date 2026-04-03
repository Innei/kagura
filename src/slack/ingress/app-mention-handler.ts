import type { ClaudeExecutionEvent, ClaudeExecutor } from '../../claude/executor/types.js';
import type { AppLogger } from '../../logger/index.js';
import { redact } from '../../logger/redact.js';
import { SlackAppMentionEventSchema } from '../../schemas/slack/app-mention-event.js';
import type { SessionStore } from '../../session/types.js';
import type { SlackThreadContextLoader } from '../context/thread-context-loader.js';
import type { SlackRenderer } from '../render/slack-renderer.js';
import type { SlackWebClientLike } from '../types.js';

interface AppMentionHandlerDependencies {
  claudeExecutor: ClaudeExecutor;
  logger: AppLogger;
  renderer: SlackRenderer;
  sessionStore: SessionStore;
  threadContextLoader: SlackThreadContextLoader;
}

export function createAppMentionHandler(deps: AppMentionHandlerDependencies) {
  return async (args: { client: SlackWebClientLike; event: unknown }): Promise<void> => {
    const mention = SlackAppMentionEventSchema.parse(args.event);
    const threadTs = mention.thread_ts ?? mention.ts;

    deps.logger.info(
      'Received app mention in channel %s, root ts %s, thread ts %s',
      mention.channel,
      mention.ts,
      threadTs,
    );

    const existingSession = deps.sessionStore.get(threadTs);
    const resumeSessionId = existingSession?.claudeSessionId;

    await deps.renderer.addAcknowledgementReaction(args.client, mention.channel, mention.ts);

    const bootstrapMessageTs = await deps.renderer.postBootstrapReply(
      args.client,
      mention.channel,
      threadTs,
    );

    const threadContext = await deps.threadContextLoader.loadThread(
      args.client,
      mention.channel,
      threadTs,
    );

    deps.sessionStore.upsert({
      channelId: mention.channel,
      threadTs,
      rootMessageTs: mention.ts,
      ...(bootstrapMessageTs ? { bootstrapMessageTs } : {}),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const streamTs = await deps.renderer.startStream(args.client, mention.channel, threadTs);
    deps.sessionStore.patch(threadTs, { streamMessageTs: streamTs });

    const sink = {
      onEvent: async (event: ClaudeExecutionEvent): Promise<void> => {
        if (event.type === 'text-delta') {
          await deps.renderer.appendText(args.client, mention.channel, streamTs, event.text);
          return;
        }

        if (event.type === 'ui-state') {
          await deps.renderer.setUiState(args.client, mention.channel, event.state);
          return;
        }

        if (event.type === 'task-update') {
          await deps.renderer.appendChunks(args.client, mention.channel, streamTs, [
            {
              type: 'task_update',
              id: event.taskId,
              title: event.title,
              status: event.status,
              ...(event.details ? { details: event.details } : {}),
              ...(event.output ? { output: event.output } : {}),
            },
          ]);
          return;
        }

        if (event.sessionId) {
          deps.sessionStore.patch(threadTs, { claudeSessionId: event.sessionId });
        }

        if (event.phase === 'started') {
          return;
        }

        if (event.phase === 'failed') {
          deps.logger.error(
            'Execution failed for thread %s: %s',
            threadTs,
            redact(String(event.error ?? '')),
          );
          await deps.renderer.appendText(
            args.client,
            mention.channel,
            streamTs,
            'An error occurred while processing your request.',
          );
        }
      },
    };

    try {
      await deps.claudeExecutor.execute(
        {
          channelId: mention.channel,
          threadTs,
          userId: mention.user,
          mentionText: mention.text,
          threadContext,
          ...(resumeSessionId ? { resumeSessionId } : {}),
        },
        sink,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      deps.logger.error('Claude execution failed for thread %s: %s', threadTs, redact(message));
      await deps.renderer.appendText(
        args.client,
        mention.channel,
        streamTs,
        'An error occurred while processing your request.',
      );
    } finally {
      await deps.renderer.clearUiState(args.client, mention.channel, threadTs);
      await deps.renderer.stopStream(args.client, mention.channel, streamTs, threadTs);
    }
  };
}
