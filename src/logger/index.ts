import path from 'node:path';

import { type ConsolaInstance, createLoggerConsola } from '@innei/pretty-logger-core';

import { env } from '../env/server.js';

export function createRootLogger() {
  process.env.CONSOLA_LEVEL = env.LOG_LEVEL;

  return createLoggerConsola(
    env.LOG_TO_FILE
      ? {
          writeToFile: {
            loggerDir: path.resolve(process.cwd(), env.LOG_DIR),
          },
        }
      : {},
  );
}

export type AppLogger = ConsolaInstance;
