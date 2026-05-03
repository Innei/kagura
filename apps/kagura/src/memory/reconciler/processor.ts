import type { AppLogger } from '~/logger/index.js';
import type { MemoryStore } from '~/memory/types.js';

import type { OpenAICompatibleClient } from './llm-client.js';
import { parseLlmOps } from './op-schema.js';
import type { SqliteReconcileStateStore } from './state-store.js';
import { parseBucketKey } from './types.js';

const SYSTEM_PROMPT = `You are a memory reconciliation agent. You receive a bucket of memory records that share scope and category. Your job: identify duplicates, supersessions, and stale entries.

Return strictly a JSON object: {"ops": [...]}.

Each op is one of:
- {"kind":"delete","ids":["..."]}             — drop entries that are stale or fully superseded
- {"kind":"rewrite","id":"...","content":"..."} — refine wording without changing meaning
- {"kind":"merge","ids":["...","..."],"newContent":"...","category":"<one of categories>"} — combine 2+ entries
- {"kind":"extend_ttl","ids":["..."],"expiresAt":"<ISO datetime>"} — keep alive past TTL

Rules:
- Preserve identity preferences (nicknames, name preferences, language) unless explicitly contradicted.
- Prefer latest timestamps when content disagrees.
- Empty {"ops":[]} is acceptable when bucket is already clean.`;

export interface ReconcileBucketParams {
  batchSize: number;
  bucketKey: string;
  llm: Pick<OpenAICompatibleClient, 'chat'>;
  logger: AppLogger;
  memoryStore: MemoryStore;
  reconcileStore: SqliteReconcileStateStore;
}

export async function reconcileBucket(params: ReconcileBucketParams): Promise<void> {
  const parts = parseBucketKey(params.bucketKey);
  const repoId = parts.scope === 'workspace' ? parts.repoId : undefined;
  const records = params.memoryStore.search(repoId, {
    category: parts.category,
    limit: params.batchSize,
  });

  if (records.length === 0) {
    return;
  }

  const userPrompt = JSON.stringify(
    {
      bucket: params.bucketKey,
      records: records.map((r) => ({
        id: r.id,
        createdAt: r.createdAt,
        content: r.content,
        category: r.category,
        ...(r.expiresAt ? { expiresAt: r.expiresAt } : {}),
      })),
    },
    null,
    2,
  );

  let raw: string;
  try {
    raw = await params.llm.chat([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ]);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    params.logger.warn('Reconcile bucket %s LLM call failed: %s', params.bucketKey, msg);
    return;
  }

  let ops;
  try {
    ops = parseLlmOps(raw);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    params.logger.warn(
      'Reconcile bucket %s op parse failed: %s; raw=%s',
      params.bucketKey,
      msg,
      raw.slice(0, 500),
    );
    return;
  }

  if (ops.length > 0) {
    params.memoryStore.applyReconcileOps(ops);
    params.logger.info('Reconciled bucket %s with %d op(s)', params.bucketKey, ops.length);
  }

  // Update watermark (clear writesSinceReconcile) even if 0 ops; otherwise next cycle reruns
  const now = new Date().toISOString();
  const latest = params.memoryStore.search(repoId, { category: parts.category, limit: 1 });
  const totalCount = params.memoryStore.countByCategory(repoId, parts.category);
  params.reconcileStore.upsert(params.bucketKey, {
    lastReconciledAt: now,
    lastSeenMaxCreatedAt: latest[0]?.createdAt ?? null,
    lastCount: totalCount,
    writesSinceReconcile: 0,
  });
}
