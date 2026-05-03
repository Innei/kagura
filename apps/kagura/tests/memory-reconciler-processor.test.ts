import { describe, expect, it, vi } from 'vitest';

import { createRootLogger } from '~/logger/index.js';
import { SqliteMemoryStore } from '~/memory/memory-store.js';
import { reconcileBucket } from '~/memory/reconciler/processor.js';
import { SqliteReconcileStateStore } from '~/memory/reconciler/state-store.js';

import { createTestDatabase } from './fixtures/test-database.js';

function createTestLogger() {
  return createRootLogger();
}

describe('reconcileBucket', () => {
  it('applies delete op returned by LLM and updates watermark', async () => {
    const { db } = createTestDatabase();
    const reconcileStore = new SqliteReconcileStateStore(db);
    const memoryStore = new SqliteMemoryStore(db, createTestLogger(), reconcileStore);
    const a = memoryStore.save({ category: 'preference', content: 'old nickname' });
    memoryStore.save({ category: 'preference', content: 'new nickname' });

    const llm = {
      chat: vi.fn().mockResolvedValue(JSON.stringify({ ops: [{ kind: 'delete', ids: [a.id] }] })),
    };

    await reconcileBucket({
      bucketKey: 'global::preference',
      memoryStore,
      reconcileStore,
      llm,
      logger: createTestLogger(),
      batchSize: 50,
    });

    const remaining = memoryStore.search(undefined, { category: 'preference' });
    expect(remaining.map((r) => r.id)).not.toContain(a.id);
    const state = reconcileStore.get('global::preference');
    expect(state!.writesSinceReconcile).toBe(0);
    expect(state!.lastReconciledAt).toBeTruthy();
  });

  it('updates watermark even when LLM returns empty ops', async () => {
    const { db } = createTestDatabase();
    const reconcileStore = new SqliteReconcileStateStore(db);
    const memoryStore = new SqliteMemoryStore(db, createTestLogger(), reconcileStore);
    memoryStore.save({ category: 'preference', content: 'a' });

    const llm = {
      chat: vi.fn().mockResolvedValue(JSON.stringify({ ops: [] })),
    };

    await reconcileBucket({
      bucketKey: 'global::preference',
      memoryStore,
      reconcileStore,
      llm,
      logger: createTestLogger(),
      batchSize: 50,
    });

    expect(memoryStore.search(undefined, { category: 'preference' })).toHaveLength(1);
    const state = reconcileStore.get('global::preference');
    expect(state!.writesSinceReconcile).toBe(0);
    expect(state!.lastReconciledAt).toBeTruthy();
  });

  it('returns early without applying ops when bucket is empty', async () => {
    const { db } = createTestDatabase();
    const reconcileStore = new SqliteReconcileStateStore(db);
    const memoryStore = new SqliteMemoryStore(db, createTestLogger(), reconcileStore);

    const llm = { chat: vi.fn() };

    await reconcileBucket({
      bucketKey: 'global::preference',
      memoryStore,
      reconcileStore,
      llm,
      logger: createTestLogger(),
      batchSize: 50,
    });

    expect(llm.chat).not.toHaveBeenCalled();
    expect(reconcileStore.get('global::preference')).toBeNull();
  });

  it('logs warn and skips applyReconcileOps when LLM throws', async () => {
    const { db } = createTestDatabase();
    const reconcileStore = new SqliteReconcileStateStore(db);
    const memoryStore = new SqliteMemoryStore(db, createTestLogger(), reconcileStore);
    memoryStore.save({ category: 'preference', content: 'a' });
    const before = memoryStore.search(undefined, { category: 'preference' }).length;

    const llm = { chat: vi.fn().mockRejectedValue(new Error('upstream 503')) };

    await reconcileBucket({
      bucketKey: 'global::preference',
      memoryStore,
      reconcileStore,
      llm,
      logger: createTestLogger(),
      batchSize: 50,
    });

    expect(memoryStore.search(undefined, { category: 'preference' }).length).toBe(before);
    expect(reconcileStore.get('global::preference')?.writesSinceReconcile ?? 0).toBeGreaterThan(0);
    expect(reconcileStore.get('global::preference')?.lastReconciledAt).toBeFalsy();
  });

  it('logs warn and skips applyReconcileOps when LLM returns malformed json', async () => {
    const { db } = createTestDatabase();
    const reconcileStore = new SqliteReconcileStateStore(db);
    const memoryStore = new SqliteMemoryStore(db, createTestLogger(), reconcileStore);
    memoryStore.save({ category: 'preference', content: 'a' });

    const llm = { chat: vi.fn().mockResolvedValue('not json at all') };

    await reconcileBucket({
      bucketKey: 'global::preference',
      memoryStore,
      reconcileStore,
      llm,
      logger: createTestLogger(),
      batchSize: 50,
    });

    expect(memoryStore.search(undefined, { category: 'preference' })).toHaveLength(1);
    expect(reconcileStore.get('global::preference')?.writesSinceReconcile ?? 0).toBeGreaterThan(0);
    expect(reconcileStore.get('global::preference')?.lastReconciledAt).toBeFalsy();
  });

  it('processes every batch before clearing the bucket watermark', async () => {
    const { db } = createTestDatabase();
    const reconcileStore = new SqliteReconcileStateStore(db);
    const memoryStore = new SqliteMemoryStore(db, createTestLogger(), reconcileStore);
    for (let i = 0; i < 60; i += 1) {
      memoryStore.save({ category: 'context', content: `m-${i}` });
    }

    const llm = { chat: vi.fn().mockResolvedValue(JSON.stringify({ ops: [] })) };

    await reconcileBucket({
      bucketKey: 'global::context',
      memoryStore,
      reconcileStore,
      llm,
      logger: createTestLogger(),
      batchSize: 50,
    });

    expect(llm.chat).toHaveBeenCalledTimes(2);
    const firstPayload = JSON.parse(llm.chat.mock.calls[0]![0][1].content);
    const secondPayload = JSON.parse(llm.chat.mock.calls[1]![0][1].content);
    expect(firstPayload.records).toHaveLength(50);
    expect(secondPayload.records).toHaveLength(10);
    expect(reconcileStore.get('global::context')!.lastCount).toBe(60);
    expect(reconcileStore.get('global::context')!.writesSinceReconcile).toBe(0);
  });
});
