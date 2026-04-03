import type { App } from '@slack/bolt';

import { ClaudeAgentSdkExecutor } from './claude/executor/anthropic-agent-sdk.js';
import { type AppLogger, createRootLogger } from './logger/index.js';
import { InMemorySessionStore } from './session/in-memory-session-store.js';
import { createSlackApp } from './slack/app.js';

export interface RuntimeApplication {
  readonly logger: AppLogger;
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

export function createApplication(): RuntimeApplication {
  const logger = createRootLogger().withTag('bootstrap');
  const sessionStore = new InMemorySessionStore(logger.withTag('session'));
  const claudeExecutor = new ClaudeAgentSdkExecutor(logger.withTag('claude:session'));
  const slackApp: App = createSlackApp({
    logger,
    sessionStore,
    claudeExecutor,
  });

  return {
    logger,
    async start() {
      await slackApp.start();
      logger.info('Slack Socket Mode application started.');
    },
    async stop() {
      await slackApp.stop();
      logger.info('Slack Socket Mode application stopped.');
    },
  };
}
