import 'dotenv/config';

import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

const booleanStringSchema = z.enum(['true', 'false']).transform((value) => value === 'true');

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    SLACK_BOT_TOKEN: z.string().min(1),
    SLACK_APP_TOKEN: z.string().min(1),
    SLACK_SIGNING_SECRET: z.string().min(1),
    SLACK_REACTION_NAME: z.string().min(1).default('eyes'),
    CLAUDE_MODEL: z.string().min(1).optional(),
    CLAUDE_MAX_TURNS: z.coerce.number().int().positive().default(24),
    CLAUDE_PERMISSION_MODE: z
      .enum(['default', 'acceptEdits', 'bypassPermissions', 'plan', 'dontAsk', 'auto'])
      .default('bypassPermissions'),
    LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
    LOG_TO_FILE: booleanStringSchema.default(false),
    LOG_DIR: z.string().min(1).default('./logs'),
    SESSION_DB_PATH: z.string().min(1).default('./data/sessions.db'),
  },
  runtimeEnvStrict: {
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN,
    SLACK_APP_TOKEN: process.env.SLACK_APP_TOKEN,
    SLACK_SIGNING_SECRET: process.env.SLACK_SIGNING_SECRET,
    SLACK_REACTION_NAME: process.env.SLACK_REACTION_NAME,
    CLAUDE_MODEL: process.env.CLAUDE_MODEL,
    CLAUDE_MAX_TURNS: process.env.CLAUDE_MAX_TURNS,
    CLAUDE_PERMISSION_MODE: process.env.CLAUDE_PERMISSION_MODE,
    LOG_LEVEL: process.env.LOG_LEVEL,
    LOG_TO_FILE: process.env.LOG_TO_FILE,
    LOG_DIR: process.env.LOG_DIR,
    SESSION_DB_PATH: process.env.SESSION_DB_PATH,
  },
  emptyStringAsUndefined: true,
});

export type AppEnv = typeof env;
