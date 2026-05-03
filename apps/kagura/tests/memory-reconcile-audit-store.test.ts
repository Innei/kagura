import { describe, expect, it } from 'vitest';

import { memoryReconcileOps, memoryReconcileRuns } from '~/db/schema.js';
import { SqliteReconcileAuditStore } from '~/memory/reconciler/audit-store.js';

import { createTestDatabase } from './fixtures/test-database.js';

describe('SqliteReconcileAuditStore', () => {
  it('records completed runs and applied ops with Drizzle', () => {
    const { db } = createTestDatabase();
    const store = new SqliteReconcileAuditStore(db);

    const runId = store.start({ bucketKey: 'global::context', recordCount: 2 });
    store.complete(runId, 'global::context', '{"ops":[]}', [
      { kind: 'delete', sourceIds: ['a', 'b'] },
      { kind: 'merge', sourceIds: ['c', 'd'], targetId: 'm', payload: { category: 'context' } },
    ]);

    const run = db.select().from(memoryReconcileRuns).get();
    expect(run).toMatchObject({
      id: runId,
      bucketKey: 'global::context',
      status: 'completed',
      recordCount: 2,
      rawResponse: '{"ops":[]}',
    });
    expect(run?.completedAt).toBeTruthy();

    const ops = db.select().from(memoryReconcileOps).all();
    expect(ops).toHaveLength(2);
    expect(JSON.parse(ops[0]!.sourceIds)).toEqual(['a', 'b']);
    expect(ops[1]).toMatchObject({ kind: 'merge', targetId: 'm' });
  });

  it('records failed runs', () => {
    const { db } = createTestDatabase();
    const store = new SqliteReconcileAuditStore(db);

    const runId = store.start({ bucketKey: 'global::context', recordCount: 1 });
    store.fail(runId, 'bad json', '{"oops":true}');

    const run = db.select().from(memoryReconcileRuns).get();
    expect(run).toMatchObject({
      id: runId,
      status: 'failed',
      error: 'bad json',
      rawResponse: '{"oops":true}',
    });
  });
});
