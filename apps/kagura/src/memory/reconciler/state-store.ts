import { eq, sql } from 'drizzle-orm';

import type { AppDatabase } from '~/db/index.js';
import { memoryReconcileState } from '~/db/schema.js';

import type { ReconcileBucketState } from './types.js';

export class SqliteReconcileStateStore {
  constructor(private readonly db: AppDatabase) {}

  get(bucketKey: string): ReconcileBucketState | null {
    const row = this.db
      .select()
      .from(memoryReconcileState)
      .where(eq(memoryReconcileState.bucketKey, bucketKey))
      .get();
    return row ? this.toState(row) : null;
  }

  upsert(bucketKey: string, patch: Partial<Omit<ReconcileBucketState, 'bucketKey'>>): void {
    this.db
      .insert(memoryReconcileState)
      .values({
        bucketKey,
        lastReconciledAt: patch.lastReconciledAt ?? null,
        lastSeenMaxCreatedAt: patch.lastSeenMaxCreatedAt ?? null,
        lastCount: patch.lastCount ?? 0,
        writesSinceReconcile: patch.writesSinceReconcile ?? 0,
      })
      .onConflictDoUpdate({
        target: memoryReconcileState.bucketKey,
        set: {
          ...(patch.lastReconciledAt !== undefined && {
            lastReconciledAt: patch.lastReconciledAt,
          }),
          ...(patch.lastSeenMaxCreatedAt !== undefined && {
            lastSeenMaxCreatedAt: patch.lastSeenMaxCreatedAt,
          }),
          ...(patch.lastCount !== undefined && { lastCount: patch.lastCount }),
          ...(patch.writesSinceReconcile !== undefined && {
            writesSinceReconcile: patch.writesSinceReconcile,
          }),
        },
      })
      .run();
  }

  bumpWrite(bucketKey: string): void {
    this.db
      .insert(memoryReconcileState)
      .values({
        bucketKey,
        lastCount: 0,
        writesSinceReconcile: 1,
      })
      .onConflictDoUpdate({
        target: memoryReconcileState.bucketKey,
        set: {
          writesSinceReconcile: sql`${memoryReconcileState.writesSinceReconcile} + 1`,
        },
      })
      .run();
  }

  listAll(): ReconcileBucketState[] {
    return this.db
      .select()
      .from(memoryReconcileState)
      .all()
      .map((row) => this.toState(row));
  }

  private toState(row: typeof memoryReconcileState.$inferSelect): ReconcileBucketState {
    return {
      bucketKey: row.bucketKey,
      lastCount: row.lastCount,
      lastReconciledAt: row.lastReconciledAt,
      lastSeenMaxCreatedAt: row.lastSeenMaxCreatedAt,
      writesSinceReconcile: row.writesSinceReconcile,
    };
  }
}
