import { config } from 'dotenv';

config({ path: process.env.SLACK_E2E_ENV_FILE || '.env.e2e', override: true });

if (!process.env.SESSION_DB_PATH) {
  process.env.SESSION_DB_PATH = './data/e2e-sessions.db';
}
