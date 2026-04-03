import { App } from '@slack/bolt';

import type { ClaudeExecutor } from '../claude/executor/types.js';
import { env } from '../env/server.js';
import type { AppLogger } from '../logger/index.js';
import type { SessionStore } from '../session/types.js';
import { SlackThreadContextLoader } from './context/thread-context-loader.js';
import { createAppMentionHandler } from './ingress/app-mention-handler.js';
import { SlackRenderer } from './render/slack-renderer.js';

export interface SlackApplicationDependencies {
  claudeExecutor: ClaudeExecutor;
  logger: AppLogger;
  sessionStore: SessionStore;
}

export function createSlackApp(deps: SlackApplicationDependencies): App {
  const app = new App({
    token: env.SLACK_BOT_TOKEN,
    appToken: env.SLACK_APP_TOKEN,
    signingSecret: env.SLACK_SIGNING_SECRET,
    socketMode: true,
  });

  const renderer = new SlackRenderer(deps.logger.withTag('slack:render'));
  const threadContextLoader = new SlackThreadContextLoader(deps.logger.withTag('slack:context'));

  app.event(
    'app_mention',
    createAppMentionHandler({
      logger: deps.logger.withTag('slack:ingress'),
      renderer,
      threadContextLoader,
      sessionStore: deps.sessionStore,
      claudeExecutor: deps.claudeExecutor,
    }),
  );

  return app;
}
