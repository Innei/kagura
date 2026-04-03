import type { AppLogger } from '../logger/index.js';
import type { SessionRecord, SessionStore } from './types.js';

export class InMemorySessionStore implements SessionStore {
  private readonly store = new Map<string, SessionRecord>();

  constructor(private readonly logger: AppLogger) {}

  get(threadTs: string): SessionRecord | undefined {
    const record = this.store.get(threadTs);
    return record ? { ...record } : undefined;
  }

  upsert(record: SessionRecord): SessionRecord {
    const stored: SessionRecord = { ...record };
    this.store.set(stored.threadTs, stored);
    this.logger.debug('Upserted session record for thread %s', stored.threadTs);
    return { ...stored };
  }

  patch(threadTs: string, patch: Partial<SessionRecord>): SessionRecord | undefined {
    const current = this.store.get(threadTs);
    if (!current) {
      return undefined;
    }

    const next: SessionRecord = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    this.store.set(threadTs, next);
    this.logger.debug('Patched session record for thread %s', threadTs);
    return { ...next };
  }
}
