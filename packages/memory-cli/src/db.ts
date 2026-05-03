import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const memories = sqliteTable('memories', {
  id: text('id').primaryKey(),
  repoId: text('repo_id'),
  threadTs: text('thread_ts'),
  category: text('category', {
    enum: ['task_completed', 'decision', 'context', 'observation', 'preference'],
  }).notNull(),
  content: text('content').notNull(),
  metadata: text('metadata'),
  createdAt: text('created_at').notNull(),
  expiresAt: text('expires_at'),
});

export function openDatabase(path: string) {
  const sqlite = new Database(path, { readonly: false });
  sqlite.pragma('journal_mode = WAL');
  return drizzle(sqlite, { schema: { memories } });
}
