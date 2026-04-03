import Database from 'better-sqlite3';

import type { AppLogger } from '../logger/index.js';
import type { SessionRecord, SessionStore } from './types.js';

interface SessionRow {
  bootstrap_message_ts: string | null;
  channel_id: string;
  claude_session_id: string | null;
  created_at: string;
  root_message_ts: string;
  stream_message_ts: string | null;
  thread_ts: string;
  updated_at: string;
}

function rowToRecord(row: SessionRow): SessionRecord {
  const record: SessionRecord = {
    channelId: row.channel_id,
    createdAt: row.created_at,
    rootMessageTs: row.root_message_ts,
    threadTs: row.thread_ts,
    updatedAt: row.updated_at,
  };
  if (row.bootstrap_message_ts !== null) record.bootstrapMessageTs = row.bootstrap_message_ts;
  if (row.claude_session_id !== null) record.claudeSessionId = row.claude_session_id;
  if (row.stream_message_ts !== null) record.streamMessageTs = row.stream_message_ts;
  return record;
}

export class SqliteSessionStore implements SessionStore {
  private readonly db: Database.Database;

  constructor(
    dbPath: string,
    private readonly logger: AppLogger,
  ) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        thread_ts TEXT PRIMARY KEY,
        channel_id TEXT NOT NULL,
        root_message_ts TEXT NOT NULL,
        bootstrap_message_ts TEXT,
        stream_message_ts TEXT,
        claude_session_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
  }

  get(threadTs: string): SessionRecord | undefined {
    const row = this.db
      .prepare<[string], SessionRow>('SELECT * FROM sessions WHERE thread_ts = ?')
      .get(threadTs);
    return row ? rowToRecord(row) : undefined;
  }

  upsert(record: SessionRecord): SessionRecord {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO sessions
           (thread_ts, channel_id, root_message_ts, bootstrap_message_ts, stream_message_ts, claude_session_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        record.threadTs,
        record.channelId,
        record.rootMessageTs,
        record.bootstrapMessageTs ?? null,
        record.streamMessageTs ?? null,
        record.claudeSessionId ?? null,
        record.createdAt,
        record.updatedAt,
      );
    this.logger.debug('Upserted session record for thread %s', record.threadTs);
    return { ...record };
  }

  patch(threadTs: string, patch: Partial<SessionRecord>): SessionRecord | undefined {
    const { threadTs: _discarded, ...safePatch } = patch;

    const txn = this.db.transaction(() => {
      const existing = this.get(threadTs);
      if (!existing) return undefined;

      const next: SessionRecord = {
        ...existing,
        ...safePatch,
        threadTs,
        updatedAt: new Date().toISOString(),
      };

      this.db
        .prepare(
          `UPDATE sessions
           SET channel_id = ?, root_message_ts = ?, bootstrap_message_ts = ?, stream_message_ts = ?, claude_session_id = ?, created_at = ?, updated_at = ?
           WHERE thread_ts = ?`,
        )
        .run(
          next.channelId,
          next.rootMessageTs,
          next.bootstrapMessageTs ?? null,
          next.streamMessageTs ?? null,
          next.claudeSessionId ?? null,
          next.createdAt,
          next.updatedAt,
          threadTs,
        );
      this.logger.debug('Patched session record for thread %s', threadTs);
      return { ...next };
    });

    return txn();
  }

  close(): void {
    this.db.close();
  }
}
