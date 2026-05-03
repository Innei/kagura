import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';

import type { AppDatabase } from '~/db/index.js';
import { memoryReconcileOps, memoryReconcileRuns } from '~/db/schema.js';

import type { AppliedReconcileOp } from './types.js';

export interface StartReconcileRunInput {
  bucketKey: string;
  recordCount: number;
}

export class SqliteReconcileAuditStore {
  constructor(private readonly db: AppDatabase) {}

  start(input: StartReconcileRunInput): string {
    const id = randomUUID();
    this.db
      .insert(memoryReconcileRuns)
      .values({
        id,
        bucketKey: input.bucketKey,
        status: 'running',
        recordCount: input.recordCount,
        rawResponse: null,
        error: null,
        startedAt: new Date().toISOString(),
        completedAt: null,
      })
      .run();
    return id;
  }

  complete(runId: string, bucketKey: string, rawResponse: string, ops: AppliedReconcileOp[]): void {
    const now = new Date().toISOString();
    this.db.transaction((tx) => {
      tx.update(memoryReconcileRuns)
        .set({
          status: 'completed',
          rawResponse,
          error: null,
          completedAt: now,
        })
        .where(eq(memoryReconcileRuns.id, runId))
        .run();

      for (const op of ops) {
        tx.insert(memoryReconcileOps)
          .values({
            id: randomUUID(),
            runId,
            bucketKey,
            kind: op.kind,
            sourceIds: JSON.stringify(op.sourceIds),
            targetId: op.targetId ?? null,
            payload: op.payload ? JSON.stringify(op.payload) : null,
            createdAt: now,
          })
          .run();
      }
    });
  }

  fail(runId: string, error: string, rawResponse?: string | undefined): void {
    this.db
      .update(memoryReconcileRuns)
      .set({
        status: 'failed',
        rawResponse: rawResponse ?? null,
        error,
        completedAt: new Date().toISOString(),
      })
      .where(eq(memoryReconcileRuns.id, runId))
      .run();
  }
}
