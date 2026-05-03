import fs from 'node:fs';
import path from 'node:path';

import { defineConfig } from 'drizzle-kit';

const sessionDbPath = process.env.SESSION_DB_PATH?.trim();
const kaguraHome = process.env.KAGURA_HOME?.trim();

function resolveDatabaseUrl(): string {
  if (sessionDbPath && sessionDbPath !== './data/sessions.db') {
    return ensureDatabaseDir(path.resolve(process.cwd(), sessionDbPath));
  }

  if (kaguraHome) {
    return ensureDatabaseDir(path.join(path.resolve(kaguraHome), 'data', 'sessions.db'));
  }

  return ensureDatabaseDir('./data/sessions.db');
}

function ensureDatabaseDir(databaseUrl: string): string {
  fs.mkdirSync(path.dirname(databaseUrl), { recursive: true });
  return databaseUrl;
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: resolveDatabaseUrl(),
  },
});
