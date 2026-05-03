import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import { createDatabase } from '~/db/index.js';

export function applyLiveE2EDatabaseMigrations(dbPath: string): void {
  const { db, sqlite } = createDatabase(dbPath);
  try {
    migrate(db, {
      migrationsFolder: path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        '../../../drizzle',
      ),
    });
  } finally {
    sqlite.close();
  }
}
