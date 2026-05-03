import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { memories } from '~/db/schema.js';
import { createRootLogger } from '~/logger/index.js';
import { SqliteMemoryStore } from '~/memory/memory-store.js';
import { SqliteReconcileStateStore } from '~/memory/reconciler/state-store.js';

import { createTestDatabase } from './fixtures/test-database.js';

describe('SqliteMemoryStore reconcile ops', () => {
  it('preserves source max createdAt and records merge metadata', () => {
    const { db } = createTestDatabase();
    const reconcileStore = new SqliteReconcileStateStore(db);
    const memoryStore = new SqliteMemoryStore(db, createRootLogger(), reconcileStore);
    const older = memoryStore.save({ category: 'context', content: 'old duplicate' });
    const newer = memoryStore.save({ category: 'context', content: 'new duplicate' });

    db.update(memories)
      .set({ createdAt: '2026-01-01T00:00:00.000Z' })
      .where(eq(memories.id, older.id))
      .run();
    db.update(memories)
      .set({ createdAt: '2026-01-02T00:00:00.000Z' })
      .where(eq(memories.id, newer.id))
      .run();

    const result = memoryStore.applyReconcileOps([
      {
        kind: 'merge',
        ids: [older.id, newer.id],
        category: 'context',
        newContent: 'merged duplicate',
      },
    ]);

    expect(result.appliedOps).toHaveLength(1);
    const targetId = result.appliedOps[0]!.targetId!;
    const merged = db.select().from(memories).where(eq(memories.id, targetId)).get();
    expect(merged).toMatchObject({
      category: 'context',
      content: 'merged duplicate',
      createdAt: '2026-01-02T00:00:00.000Z',
    });
    expect(JSON.parse(merged!.metadata!)).toMatchObject({
      sourceIds: [older.id, newer.id],
    });
    expect(db.select().from(memories).where(eq(memories.id, older.id)).get()).toBeUndefined();
    expect(db.select().from(memories).where(eq(memories.id, newer.id)).get()).toBeUndefined();
  });
});
