#!/usr/bin/env node
import { createApplication } from './application.js';
import { redactUnknown } from './logger/redact.js';

async function main(): Promise<void> {
  const application = createApplication();

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    application.logger.warn('Received %s. Beginning graceful shutdown.', signal);
    await application.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });

  await application.start();
}

main().catch((error: unknown) => {
  console.error(redactUnknown(error));
  process.exit(1);
});
