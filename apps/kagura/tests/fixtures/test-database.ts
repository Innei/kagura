import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import { createDatabase } from '~/db/index.js';

export function createTestDatabase() {
  const database = createDatabase(':memory:');
  migrate(database.db, {
    migrationsFolder: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../drizzle'),
  });
  return database;
}
