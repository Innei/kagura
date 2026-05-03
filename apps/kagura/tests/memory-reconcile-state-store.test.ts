import { describe, expect, it } from 'vitest';

import { SqliteReconcileStateStore } from '~/memory/reconciler/state-store.js';

import { createTestDatabase } from './fixtures/test-database.js';

describe('SqliteReconcileStateStore', () => {
  it('returns null for unseen bucket', () => {
    const { db } = createTestDatabase();
    const store = new SqliteReconcileStateStore(db);
    expect(store.get('global::preference')).toBeNull();
  });

  it('upserts then reads back', () => {
    const { db } = createTestDatabase();
    const store = new SqliteReconcileStateStore(db);
    store.upsert('global::preference', {
      lastReconciledAt: '2026-05-03T00:00:00Z',
      lastSeenMaxCreatedAt: '2026-05-02T00:00:00Z',
      lastCount: 7,
      writesSinceReconcile: 0,
    });
    expect(store.get('global::preference')).toMatchObject({
      bucketKey: 'global::preference',
      lastCount: 7,
    });
  });

  it('bumpWrite increments writesSinceReconcile and creates row if absent', () => {
    const { db } = createTestDatabase();
    const store = new SqliteReconcileStateStore(db);
    store.bumpWrite('global::preference');
    store.bumpWrite('global::preference');
    expect(store.get('global::preference')!.writesSinceReconcile).toBe(2);
  });

  it('listAll returns all bucket states', () => {
    const { db } = createTestDatabase();
    const store = new SqliteReconcileStateStore(db);
    store.bumpWrite('global::preference');
    store.bumpWrite('workspace:r1:context');
    expect(
      store
        .listAll()
        .map((s) => s.bucketKey)
        .sort(),
    ).toEqual(['global::preference', 'workspace:r1:context']);
  });
});
