import { createApplication } from './application.js';

export async function startApp(): Promise<void> {
  const application = createApplication();

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    application.logger.warn('Received %s. Beginning graceful shutdown.', signal);
    await application.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  await application.start();
}
