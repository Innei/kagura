import type { AppDatabase } from '~/db/index.js';
import type { AppLogger } from '~/logger/index.js';
import type { MemoryStore } from '~/memory/types.js';

import type { OpenAICompatibleClient } from './llm-client.js';
import { reconcileBucket } from './processor.js';
import type { SqliteReconcileStateStore } from './state-store.js';

export interface MemoryReconcilerOptions {
  batchSize?: number;
  db: AppDatabase;
  intervalMs: number;
  llm?: Pick<OpenAICompatibleClient, 'chat'>;
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
    const eligible = dirty.filter((b) => {
      const state = b.state;
      if (!state) return true;
      if (state.lastSeenMaxCreatedAt !== b.currentMaxCreatedAt) return true;
      if (state.lastCount !== b.currentCount) return true;
      return state.writesSinceReconcile >= this.options.writeThreshold;
    });

    if (eligible.length === 0) return;

    if (!this.options.llmEnabled || !this.options.llm) {
      this.options.logger.debug(
        'Memory reconciler found %d dirty bucket(s); LLM disabled, skipping consolidation',
        eligible.length,
      );
      return;
    }

    const batchSize = this.options.batchSize ?? 50;
    for (const bucket of eligible) {
      await reconcileBucket({
        bucketKey: bucket.bucketKey,
        memoryStore: this.options.memoryStore,
        reconcileStore: this.options.reconcileStore,
        llm: this.options.llm,
        logger: this.options.logger,
        batchSize,
      });
    }
  }
}
