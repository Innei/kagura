import { beforeEach, describe, expect, it } from 'vitest';

import { SqliteChannelPreferenceStore } from '~/channel-preference/sqlite-channel-preference-store.js';
import type { AppDatabase } from '~/db/index.js';
import { createRootLogger } from '~/logger/index.js';

import { createTestDatabase } from './fixtures/test-database.js';

describe('SqliteChannelPreferenceStore', () => {
  let db: AppDatabase;
  let store: SqliteChannelPreferenceStore;

  beforeEach(() => {
    const database = createTestDatabase();
    db = database.db;
    store = new SqliteChannelPreferenceStore(db, createRootLogger().withTag('test'));
  });

  it('returns undefined when no preference exists', () => {
    expect(store.get('C123')).toBeUndefined();
  });

  it('upserts and retrieves a preference', () => {
    const record = store.upsert('C123', 'my-repo');
    expect(record.channelId).toBe('C123');
    expect(record.defaultWorkspaceInput).toBe('my-repo');

    const retrieved = store.get('C123');
    expect(retrieved?.channelId).toBe('C123');
    expect(retrieved?.defaultWorkspaceInput).toBe('my-repo');
  });

  it('updates an existing preference', () => {
    store.upsert('C123', 'repo-a');
    const updated = store.upsert('C123', 'repo-b');
    expect(updated.defaultWorkspaceInput).toBe('repo-b');

    const retrieved = store.get('C123');
    expect(retrieved?.defaultWorkspaceInput).toBe('repo-b');
  });

  it('allows clearing the preference by passing undefined', () => {
    store.upsert('C123', 'repo-a');
    const updated = store.upsert('C123', undefined);
    expect(updated.defaultWorkspaceInput).toBeUndefined();

    const retrieved = store.get('C123');
    expect(retrieved?.defaultWorkspaceInput).toBeUndefined();
  });
});
