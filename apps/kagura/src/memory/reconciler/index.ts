import type { AppDatabase } from '~/db/index.js';
import type { AppLogger } from '~/logger/index.js';
import type { MemoryStore } from '~/memory/types.js';

import type { SqliteReconcileStateStore } from './state-store.js';

export interface MemoryReconcilerOptions {
  db: AppDatabase;
  intervalMs: number;
  llmEnabled: boolean;
  logger: AppLogger;
  memoryStore: MemoryStore;
  reconcileStore: SqliteReconcileStateStore;
  writeThreshold: number;
}

export class MemoryReconciler {
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(private readonly options: MemoryReconcilerOptions) {}

  start(): void {
    if (this.timer) return;
    const tick = async (): Promise<void> => {
      if (this.running) return;
      this.running = true;
      try {
        await this.runOnce();
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.options.logger.warn('Memory reconciler tick failed: %s', msg);
      } finally {
        this.running = false;
      }
    };
    this.timer = setInterval(() => {
      void tick();
    }, this.options.intervalMs);
    void tick();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  async runOnce(): Promise<void> {
    const pruned = this.options.memoryStore.pruneAll();
    if (pruned > 0) {
      this.options.logger.info('Memory reconciler pruned %d expired records', pruned);
    }

    const dirty = this.options.memoryStore.getDirtyBuckets();
    const eligible = dirty.filter(
      (b) => (b.state?.writesSinceReconcile ?? 0) >= this.options.writeThreshold,
    );

    if (eligible.length === 0) return;

    if (!this.options.llmEnabled) {
      this.options.logger.debug(
        'Memory reconciler found %d dirty bucket(s); LLM disabled, skipping consolidation',
        eligible.length,
      );
      return;
    }

    // Task 11 will implement LLM segment here. For now, just log dirty buckets.
    this.options.logger.debug(
      'Memory reconciler dirty buckets: %s',
      eligible.map((b) => b.bucketKey).join(', '),
    );
  }
}
