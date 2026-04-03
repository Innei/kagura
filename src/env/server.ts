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
    ANTHROPIC_API_KEY: z.string().min(1),
    CLAUDE_MODEL: z.string().min(1).optional(),
    CLAUDE_MAX_TURNS: z.coerce.number().int().positive().default(24),
    LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
    LOG_TO_FILE: booleanStringSchema.default(false),
    LOG_DIR: z.string().min(1).default('./logs'),
  },
  runtimeEnvStrict: {
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN,
    SLACK_APP_TOKEN: process.env.SLACK_APP_TOKEN,
    SLACK_SIGNING_SECRET: process.env.SLACK_SIGNING_SECRET,
    SLACK_REACTION_NAME: process.env.SLACK_REACTION_NAME,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    CLAUDE_MODEL: process.env.CLAUDE_MODEL,
    CLAUDE_MAX_TURNS: process.env.CLAUDE_MAX_TURNS,
    LOG_LEVEL: process.env.LOG_LEVEL,
    LOG_TO_FILE: process.env.LOG_TO_FILE,
    LOG_DIR: process.env.LOG_DIR,
  },
  emptyStringAsUndefined: true,
});

export type AppEnv = typeof env;
