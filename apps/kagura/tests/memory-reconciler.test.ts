import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { memories as memoriesTable } from '~/db/schema.js';
import { createRootLogger } from '~/logger/index.js';
import { SqliteMemoryStore } from '~/memory/memory-store.js';
import { MemoryReconciler } from '~/memory/reconciler/index.js';
import { SqliteReconcileStateStore } from '~/memory/reconciler/state-store.js';

import { createTestDatabase } from './fixtures/test-database.js';

function createTestLogger() {
  return createRootLogger();
}

describe('MemoryReconciler prune-only mode', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('prunes expired memories on first cycle', async () => {
    const { db } = createTestDatabase();
    const reconcileStore = new SqliteReconcileStateStore(db);
    const memoryStore = new SqliteMemoryStore(db, createTestLogger(), reconcileStore);

    const past = new Date(Date.now() - 10_000).toISOString();
    memoryStore.save({ category: 'context', content: 'old', expiresAt: past });
    memoryStore.save({ category: 'context', content: 'fresh' });

    const reconciler = new MemoryReconciler({
      db,
      memoryStore,
      reconcileStore,
      logger: createTestLogger(),
      intervalMs: 1000,
      writeThreshold: 5,
      llmEnabled: false,
    });

    await reconciler.runOnce();

    expect(memoryStore.search(undefined, { category: 'context' })).toHaveLength(1);
  });

  it('skips bucket reconcile when LLM disabled', async () => {
    const { db } = createTestDatabase();
    const reconcileStore = new SqliteReconcileStateStore(db);
    const memoryStore = new SqliteMemoryStore(db, createTestLogger(), reconcileStore);
    memoryStore.save({ category: 'preference', content: 'a' });

    const reconciler = new MemoryReconciler({
      db,
      memoryStore,
      reconcileStore,
      logger: createTestLogger(),
      intervalMs: 1000,
      writeThreshold: 5,
      llmEnabled: false,
    });

    await reconciler.runOnce();
    expect(memoryStore.search(undefined, { category: 'preference' })).toHaveLength(1);
  });

  it('runs reconcile on dirty bucket when LLM enabled and write threshold met', async () => {
    const { db } = createTestDatabase();
    const reconcileStore = new SqliteReconcileStateStore(db);
    const memoryStore = new SqliteMemoryStore(db, createTestLogger(), reconcileStore);
    const m = memoryStore.save({ category: 'preference', content: 'a' });
    memoryStore.save({ category: 'preference', content: 'b' });
    memoryStore.save({ category: 'preference', content: 'c' });
    memoryStore.save({ category: 'preference', content: 'd' });
    memoryStore.save({ category: 'preference', content: 'e' });

    const llm = {
      chat: vi.fn().mockResolvedValue(JSON.stringify({ ops: [{ kind: 'delete', ids: [m.id] }] })),
    };

    const reconciler = new MemoryReconciler({
      db,
      memoryStore,
      reconcileStore,
      logger: createTestLogger(),
      intervalMs: 1000,
      writeThreshold: 5,
      llmEnabled: true,
      llm,
      batchSize: 50,
    });

    await reconciler.runOnce();

    expect(llm.chat).toHaveBeenCalled();
    expect(
      memoryStore.search(undefined, { category: 'preference' }).map((r) => r.id),
    ).not.toContain(m.id);

    const state = reconcileStore.get('global::preference');
    expect(state?.lastReconciledAt).toBeTruthy();
    expect(state?.writesSinceReconcile).toBe(0);
  });

  it('detects external write via maxCreatedAt change even without bumpWrite', async () => {
    const { db } = createTestDatabase();
    const reconcileStore = new SqliteReconcileStateStore(db);
    const memoryStore = new SqliteMemoryStore(db, createTestLogger(), reconcileStore);
    memoryStore.save({ category: 'preference', content: 'a' });

    // Force watermark to a "reconciled" state so the dirty filter must
    // detect the next change purely via maxCreatedAt/count drift, not
    // via writesSinceReconcile.
    reconcileStore.upsert('global::preference', {
      lastReconciledAt: new Date().toISOString(),
      lastSeenMaxCreatedAt: new Date(Date.now() - 1000).toISOString(),
      lastCount: 1,
      writesSinceReconcile: 0,
    });

    // Simulate an external process (e.g. kagura-memory CLI) that bypasses bumpWrite:
    // insert directly via the underlying drizzle handle.
    const externalCreatedAt = new Date(Date.now() + 1000).toISOString();
    await db
      .insert(memoriesTable)
      .values({
        id: 'external-1',
        repoId: null,
        threadTs: null,
        category: 'preference',
        content: 'external save',
        metadata: null,
        createdAt: externalCreatedAt,
        expiresAt: null,
      })
      .run();

    const llm = { chat: vi.fn().mockResolvedValue('{"ops":[]}') };

    const reconciler = new MemoryReconciler({
      db,
      memoryStore,
      reconcileStore,
      logger: createTestLogger(),
      intervalMs: 1000,
      writeThreshold: 5,
      llmEnabled: true,
      llm,
      batchSize: 50,
    });
    await reconciler.runOnce();

    expect(llm.chat).toHaveBeenCalled();
  });
});
