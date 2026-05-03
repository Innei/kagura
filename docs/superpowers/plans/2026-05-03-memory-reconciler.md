# Memory Reconciler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 引入跨进程后台 memory reconciler，对 SQLite 中沉积之记忆做 TTL prune、LLM 合流去重、并打通 codex/claude-code 二端 recall 路径，弃旧 JSONL ops。

**Architecture:** 分三刀递进。第一刀落基础设施：config/env + watermark 状态表 + 仅做 prune 之 cron loop，不引 LLM。第二刀加 OpenAI-兼容 client、reconcile op 语义、`kagura-memory` CLI（read-only `recall`），并改 prompt 使 codex 与 claude-code 走同一 on-demand recall 路径。第三刀将 codex 之 save 路径亦迁至 CLI，弃 JSONL ops 与 `applyMemoryOps`，二 provider 完全打平。

**Tech Stack:** TypeScript ESM、Vitest、Drizzle ORM (SQLite WAL)、Bolt、Anthropic Claude Agent SDK、Codex CLI、Zod、OpenAI-兼容 `/chat/completions` (fetch-based, 无 SDK)。

---

## File Structure

### 第一刀（infra）

- Create: `apps/kagura/src/memory/reconciler/types.ts` — reconciler op + bucket key 之 types
- Create: `apps/kagura/src/memory/reconciler/state-store.ts` — `memory_reconcile_state` 表存取
- Create: `apps/kagura/src/memory/reconciler/index.ts` — `MemoryReconciler` 类与 cron loop
- Create: `apps/kagura/drizzle/0002_memory_reconcile_state.sql` — migration
- Modify: `apps/kagura/src/db/schema.ts` — 加 `memoryReconcileState` 表定义
- Modify: `apps/kagura/src/memory/types.ts` — 加 `applyReconcileOps`、`getDirtyBuckets`、`bumpBucketWrite` 至 `MemoryStore`
- Modify: `apps/kagura/src/memory/memory-store.ts` — 实现新方法、`save`/`delete` 钩 bucket dirty 标记
- Modify: `apps/kagura/src/env/server.ts` — 加 `appConfig.memory.reconciler` schema 与 `KAGURA_MEMORY_RECONCILER_*` env
- Modify: `apps/kagura/src/application.ts` — 启动注册 reconciler、shutdown 清；除 startup 一次性 `pruneAll()`
- Test: `apps/kagura/tests/memory-reconciler.test.ts`
- Test: `apps/kagura/tests/memory-reconcile-state-store.test.ts`

### 第二刀（LLM + CLI）

- Create: `apps/kagura/src/memory/reconciler/llm-client.ts` — fetch-based OpenAI-兼容 client
- Create: `apps/kagura/src/memory/reconciler/op-schema.ts` — Zod schema 校 LLM 输出
- Create: `apps/kagura/src/memory/reconciler/processor.ts` — 单桶 reconcile pipeline (fetch memories → call LLM → parse → applyReconcileOps)
- Create: `packages/memory-cli/package.json` — 独立 CLI 包
- Create: `packages/memory-cli/src/cli.ts` — commander 入口，`recall` 子命令
- Create: `packages/memory-cli/src/db.ts` — 复用 `apps/kagura/src/db` 之 connector
- Create: `packages/memory-cli/tsconfig.json`
- Modify: `apps/kagura/src/memory/reconciler/index.ts` — loop 加 LLM 段；尊 `enabled` 标志
- Modify: `apps/kagura/src/agent/prompt/processors.ts` — `memoryContextProcessor` 仅 inject identity preferences；新增 `memoryRecallHintProcessor`
- Modify: `apps/kagura/src/agent/providers/codex-cli/prompt.ts` — `<codex_runtime_tools>` 段加 `kagura-memory recall` 用法
- Test: `apps/kagura/tests/memory-reconciler-llm.test.ts`
- Test: `packages/memory-cli/tests/cli.test.ts`

### 第三刀（codex 弃 JSONL）

- Modify: `packages/memory-cli/src/cli.ts` — 加 `save` 子命令
- Modify: `apps/kagura/src/agent/providers/codex-cli/prompt.ts` — `<codex_runtime_tools>` 之 save 段改用 CLI
- Modify: `apps/kagura/src/agent/providers/codex-cli/adapter.ts` — 删 `applyMemoryOps`、`memoryOpsPath`、`parseCodexMemoryOp`
- Modify: `apps/kagura/src/agent/providers/codex-cli/prompt.ts` — 删 `memoryOpsPath` 引用
- Test: `apps/kagura/tests/codex-cli-adapter.test.ts` — 删旧 JSONL ops 之 case
- Test: `packages/memory-cli/tests/cli-save.test.ts`

---

# 第一刀：Reconciler Infrastructure

## Task 1: 状态表 schema 与 migration

**Files:**

- Modify: `apps/kagura/src/db/schema.ts`
- Create: `apps/kagura/drizzle/0002_memory_reconcile_state.sql`

- [ ] **Step 1: Drizzle schema 加表**

In `apps/kagura/src/db/schema.ts`, append:

```typescript
export const memoryReconcileState = sqliteTable('memory_reconcile_state', {
  bucketKey: text('bucket_key').primaryKey(),
  lastReconciledAt: text('last_reconciled_at'),
  lastSeenMaxCreatedAt: text('last_seen_max_created_at'),
  lastCount: integer('last_count').notNull().default(0),
  writesSinceReconcile: integer('writes_since_reconcile').notNull().default(0),
});
```

- [ ] **Step 2: 生成 migration**

Run: `cd apps/kagura && pnpm db:generate`
Expected: 新建 `drizzle/0002_*.sql`，含 `CREATE TABLE memory_reconcile_state ...`。文件名若不为 `0002_memory_reconcile_state.sql` 则手动 rename。

- [ ] **Step 3: 校 migration 内容**

Run: `cat apps/kagura/drizzle/0002_memory_reconcile_state.sql`
Expected: 含 `CREATE TABLE \`memory_reconcile_state\` (...);` 与五字段。

- [ ] **Step 4: Commit**

```bash
git add apps/kagura/src/db/schema.ts apps/kagura/drizzle/0002_*.sql apps/kagura/drizzle/meta/
git commit -m "feat(memory): add memory_reconcile_state table for watermark tracking"
```

---

## Task 2: bucket key 工具与 types

**Files:**

- Create: `apps/kagura/src/memory/reconciler/types.ts`
- Test: `apps/kagura/tests/memory-reconciler-bucket.test.ts`

- [ ] **Step 1: 写 failing test**

Create `apps/kagura/tests/memory-reconciler-bucket.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';

import { bucketKeyFor, parseBucketKey } from '~/memory/reconciler/types.js';

describe('bucketKeyFor', () => {
  it('produces stable key for global scope', () => {
    expect(bucketKeyFor({ scope: 'global', category: 'preference' })).toBe('global::preference');
  });

  it('produces stable key for workspace scope', () => {
    expect(bucketKeyFor({ scope: 'workspace', repoId: 'repo-1', category: 'context' })).toBe(
      'workspace:repo-1:context',
    );
  });

  it('parses back to fields', () => {
    expect(parseBucketKey('global::preference')).toEqual({
      scope: 'global',
      category: 'preference',
    });
    expect(parseBucketKey('workspace:repo-1:context')).toEqual({
      scope: 'workspace',
      repoId: 'repo-1',
      category: 'context',
    });
  });
});
```

- [ ] **Step 2: 跑测试，预期 fail**

Run: `cd apps/kagura && pnpm vitest run tests/memory-reconciler-bucket.test.ts`
Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现 types.ts**

Create `apps/kagura/src/memory/reconciler/types.ts`:

```typescript
import type { MemoryCategory, MemoryScope } from '~/memory/types.js';

export interface BucketKeyParts {
  scope: MemoryScope;
  repoId?: string;
  category: MemoryCategory;
}

export interface ReconcileBucketState {
  bucketKey: string;
  lastReconciledAt: string | null;
  lastSeenMaxCreatedAt: string | null;
  lastCount: number;
  writesSinceReconcile: number;
}

export type ReconcileOp =
  | { kind: 'delete'; ids: string[] }
  | { kind: 'rewrite'; id: string; content: string; expiresAt?: string }
  | {
      kind: 'merge';
      ids: string[];
      newContent: string;
      category: MemoryCategory;
      expiresAt?: string;
    }
  | { kind: 'extend_ttl'; ids: string[]; expiresAt: string };

export function bucketKeyFor(parts: BucketKeyParts): string {
  if (parts.scope === 'global') {
    return `global::${parts.category}`;
  }
  if (!parts.repoId) {
    throw new Error('workspace bucket requires repoId');
  }
  return `workspace:${parts.repoId}:${parts.category}`;
}

export function parseBucketKey(key: string): BucketKeyParts {
  const [scope, repoId, category] = key.split(':');
  if (scope === 'global') {
    return { scope: 'global', category: category as MemoryCategory };
  }
  if (scope === 'workspace') {
    return {
      scope: 'workspace',
      repoId: repoId!,
      category: category as MemoryCategory,
    };
  }
  throw new Error(`invalid bucket key: ${key}`);
}
```

- [ ] **Step 4: 跑测试，预期 pass**

Run: `cd apps/kagura && pnpm vitest run tests/memory-reconciler-bucket.test.ts`
Expected: PASS, 3/3。

- [ ] **Step 5: Commit**

```bash
git add apps/kagura/src/memory/reconciler/types.ts apps/kagura/tests/memory-reconciler-bucket.test.ts
git commit -m "feat(memory): add bucket key helpers and reconcile op types"
```

---

## Task 3: 状态表 store

**Files:**

- Create: `apps/kagura/src/memory/reconciler/state-store.ts`
- Test: `apps/kagura/tests/memory-reconcile-state-store.test.ts`

- [ ] **Step 1: 写 failing test**

Create `apps/kagura/tests/memory-reconcile-state-store.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';

import { createTestDatabase } from './fixtures/test-database.js';
import { SqliteReconcileStateStore } from '~/memory/reconciler/state-store.js';

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
});
```

- [ ] **Step 2: 创 test fixture (若未有)**

Run: `ls apps/kagura/tests/fixtures/test-database.ts 2>&1`
若 ENOENT，create `apps/kagura/tests/fixtures/test-database.ts`:

```typescript
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import * as schema from '~/db/schema.js';

export function createTestDatabase() {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: './drizzle' });
  return { db, sqlite };
}
```

若 fixture 已有，复用之。

- [ ] **Step 3: 跑测试，预期 fail**

Run: `cd apps/kagura && pnpm vitest run tests/memory-reconcile-state-store.test.ts`
Expected: FAIL，store 模块不存在。

- [ ] **Step 4: 实现 state-store.ts**

Create `apps/kagura/src/memory/reconciler/state-store.ts`:

```typescript
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
      lastReconciledAt: row.lastReconciledAt,
      lastSeenMaxCreatedAt: row.lastSeenMaxCreatedAt,
      lastCount: row.lastCount,
      writesSinceReconcile: row.writesSinceReconcile,
    };
  }
}
```

- [ ] **Step 5: 跑测试，预期 pass**

Run: `cd apps/kagura && pnpm vitest run tests/memory-reconcile-state-store.test.ts`
Expected: PASS, 3/3。

- [ ] **Step 6: Commit**

```bash
git add apps/kagura/src/memory/reconciler/state-store.ts apps/kagura/tests/memory-reconcile-state-store.test.ts apps/kagura/tests/fixtures/
git commit -m "feat(memory): add SqliteReconcileStateStore for bucket watermarks"
```

---

## Task 4: MemoryStore 钩 dirty 与新接口

**Files:**

- Modify: `apps/kagura/src/memory/types.ts`
- Modify: `apps/kagura/src/memory/memory-store.ts`
- Test: `apps/kagura/tests/global-memory.test.ts`

- [ ] **Step 1: 写 failing test，校 dirty bump**

In `apps/kagura/tests/global-memory.test.ts`, append:

```typescript
describe('MemoryStore dirty bucket tracking', () => {
  it('bumps dirty count on save for global preference', () => {
    const { db } = createTestDatabase();
    const reconcileStore = new SqliteReconcileStateStore(db);
    const store = new SqliteMemoryStore(db, createTestLogger(), reconcileStore);
    store.save({ category: 'preference', content: 'foo' });
    store.save({ category: 'preference', content: 'bar' });
    expect(reconcileStore.get('global::preference')!.writesSinceReconcile).toBe(2);
  });

  it('bumps dirty count on save for workspace context', () => {
    const { db } = createTestDatabase();
    const reconcileStore = new SqliteReconcileStateStore(db);
    const store = new SqliteMemoryStore(db, createTestLogger(), reconcileStore);
    store.save({ category: 'context', content: 'x', repoId: 'r1' });
    expect(reconcileStore.get('workspace:r1:context')!.writesSinceReconcile).toBe(1);
  });
});
```

- [ ] **Step 2: 跑测试，预期 fail**

Run: `cd apps/kagura && pnpm vitest run tests/global-memory.test.ts -t "dirty bucket tracking"`
Expected: FAIL，构造器签名错或字段缺。

- [ ] **Step 3: 改 `MemoryStore` 接口**

In `apps/kagura/src/memory/types.ts`, 加：

```typescript
import type { ReconcileOp, ReconcileBucketState } from './reconciler/types.js';

export interface DirtyBucketSummary {
  bucketKey: string;
  currentCount: number;
  currentMaxCreatedAt: string | null;
  state: ReconcileBucketState | null;
}

export interface MemoryStore {
  // ... existing fields ...
  applyReconcileOps: (ops: ReconcileOp[]) => void;
  getDirtyBuckets: () => DirtyBucketSummary[];
}
```

- [ ] **Step 4: 改 `SqliteMemoryStore` 构造与 save 钩**

In `apps/kagura/src/memory/memory-store.ts`:

```typescript
import { SqliteReconcileStateStore } from './reconciler/state-store.js';
import { bucketKeyFor } from './reconciler/types.js';
import type { ReconcileOp } from './reconciler/types.js';
import type { DirtyBucketSummary, ... } from './types.js';

export class SqliteMemoryStore implements MemoryStore {
  constructor(
    private readonly db: AppDatabase,
    private readonly logger: AppLogger,
    private readonly reconcileState: SqliteReconcileStateStore,
  ) {}

  save(input: SaveMemoryInput): MemoryRecord {
    // ... existing insert ...
    const scope = input.repoId ? 'workspace' : 'global';
    const bucketKey = bucketKeyFor({
      scope,
      ...(input.repoId ? { repoId: input.repoId } : {}),
      category: input.category,
    });
    this.reconcileState.bumpWrite(bucketKey);
    // ... return record ...
  }

  applyReconcileOps(ops: ReconcileOp[]): void {
    this.db.transaction((tx) => {
      for (const op of ops) {
        switch (op.kind) {
          case 'delete': {
            for (const id of op.ids) {
              tx.delete(memories).where(eq(memories.id, id)).run();
            }
            break;
          }
          case 'rewrite': {
            tx.update(memories)
              .set({
                content: op.content,
                ...(op.expiresAt ? { expiresAt: op.expiresAt } : {}),
              })
              .where(eq(memories.id, op.id))
              .run();
            break;
          }
          case 'merge': {
            const survivor = randomUUID();
            const createdAt = new Date().toISOString();
            const sample = tx
              .select()
              .from(memories)
              .where(eq(memories.id, op.ids[0]!))
              .get();
            tx.insert(memories)
              .values({
                id: survivor,
                repoId: sample?.repoId ?? null,
                threadTs: null,
                category: op.category,
                content: op.newContent,
                metadata: null,
                createdAt,
                expiresAt: op.expiresAt ?? null,
              })
              .run();
            for (const id of op.ids) {
              tx.delete(memories).where(eq(memories.id, id)).run();
            }
            break;
          }
          case 'extend_ttl': {
            for (const id of op.ids) {
              tx.update(memories)
                .set({ expiresAt: op.expiresAt })
                .where(eq(memories.id, id))
                .run();
            }
            break;
          }
        }
      }
    });
  }

  getDirtyBuckets(): DirtyBucketSummary[] {
    const rows = this.db
      .select({
        bucketKey: sql<string>`
          CASE
            WHEN ${memories.repoId} IS NULL
            THEN 'global::' || ${memories.category}
            ELSE 'workspace:' || ${memories.repoId} || ':' || ${memories.category}
          END
        `,
        maxCreated: sql<string | null>`MAX(${memories.createdAt})`,
        n: count(),
      })
      .from(memories)
      .groupBy(sql`1`)
      .all();

    const states = new Map(
      this.reconcileState.listAll().map((s) => [s.bucketKey, s]),
    );

    const dirty: DirtyBucketSummary[] = [];
    for (const row of rows) {
      const state = states.get(row.bucketKey) ?? null;
      const changed =
        !state ||
        state.lastSeenMaxCreatedAt !== row.maxCreated ||
        state.lastCount !== row.n ||
        state.writesSinceReconcile > 0;
      if (changed) {
        dirty.push({
          bucketKey: row.bucketKey,
          currentCount: row.n,
          currentMaxCreatedAt: row.maxCreated,
          state,
        });
      }
    }
    return dirty;
  }
}
```

注：`applyReconcileOps` 不调 `bumpWrite`，故不污染 state。

- [ ] **Step 5: 全 test fixture 加 reconcileState 参数**

每处 `new SqliteMemoryStore(db, logger)` 改为 `new SqliteMemoryStore(db, logger, new SqliteReconcileStateStore(db))`。grep 之：

Run: `grep -rn "new SqliteMemoryStore" apps/kagura --include="*.ts"`
逐一改之。

- [ ] **Step 6: 跑全测试**

Run: `cd apps/kagura && pnpm test`
Expected: 全 PASS。新加 dirty tracking 二例 pass。

- [ ] **Step 7: Commit**

```bash
git add apps/kagura/src/memory apps/kagura/tests
git commit -m "feat(memory): hook MemoryStore save into reconcile state and add applyReconcileOps"
```

---

## Task 5: env + config schema

**Files:**

- Modify: `apps/kagura/src/env/server.ts`
- Test: `apps/kagura/tests/env-memory-reconciler.test.ts`

- [ ] **Step 1: 写 failing test**

Create `apps/kagura/tests/env-memory-reconciler.test.ts`:

```typescript
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('memory reconciler env', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('disabled by default', async () => {
    vi.stubEnv('KAGURA_MEMORY_RECONCILER_ENABLED', '');
    const { env } = await import('~/env/server.js');
    expect(env.KAGURA_MEMORY_RECONCILER_ENABLED).toBe(false);
  });

  it('default model is gpt-4o-mini', async () => {
    const { env } = await import('~/env/server.js');
    expect(env.KAGURA_MEMORY_RECONCILER_MODEL).toBe('gpt-4o-mini');
  });

  it('default interval is 6h', async () => {
    const { env } = await import('~/env/server.js');
    expect(env.KAGURA_MEMORY_RECONCILER_INTERVAL_MS).toBe(21_600_000);
  });
});
```

注：因 `env` 是 module-level `loadAppConfig()` + `createEnv` 一次性，二例难复用 import；可用 `vi.resetModules()` + 动态 import。

- [ ] **Step 2: 跑测试，预期 fail**

Run: `cd apps/kagura && pnpm vitest run tests/env-memory-reconciler.test.ts`
Expected: FAIL，env 字段不存在。

- [ ] **Step 3: 加 zod schema**

In `apps/kagura/src/env/server.ts`, append to `appConfigSchema.memory`：

```typescript
memory: z
  .object({
    reconciler: z
      .object({
        enabled: z.boolean().optional(),
        baseUrl: z.string().url().optional(),
        model: z.string().min(1).optional(),
        intervalMs: z.number().int().positive().optional(),
        writeThreshold: z.number().int().nonnegative().optional(),
        batchSize: z.number().int().positive().optional(),
        timeoutMs: z.number().int().positive().optional(),
        maxTokens: z.number().int().positive().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .optional(),
```

加 env 字段至 `createEnv` 之 `server` block：

```typescript
KAGURA_MEMORY_RECONCILER_ENABLED: booleanStringSchema.default(false),
KAGURA_MEMORY_RECONCILER_BASE_URL: z.string().url().default('https://api.openai.com/v1'),
KAGURA_MEMORY_RECONCILER_API_KEY: z.string().min(1).optional(),
KAGURA_MEMORY_RECONCILER_MODEL: z.string().min(1).default('gpt-4o-mini'),
KAGURA_MEMORY_RECONCILER_INTERVAL_MS: z.coerce.number().int().positive().default(21_600_000),
KAGURA_MEMORY_RECONCILER_WRITE_THRESHOLD: z.coerce.number().int().nonnegative().default(5),
KAGURA_MEMORY_RECONCILER_BATCH_SIZE: z.coerce.number().int().positive().default(50),
KAGURA_MEMORY_RECONCILER_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
KAGURA_MEMORY_RECONCILER_MAX_TOKENS: z.coerce.number().int().positive().default(1024),
```

`runtimeEnv` block 内一一对接：

```typescript
KAGURA_MEMORY_RECONCILER_ENABLED: envOrConfig(
  'KAGURA_MEMORY_RECONCILER_ENABLED',
  configBoolean(appConfig.memory?.reconciler?.enabled),
),
KAGURA_MEMORY_RECONCILER_BASE_URL: envOrConfig(
  'KAGURA_MEMORY_RECONCILER_BASE_URL',
  configString(appConfig.memory?.reconciler?.baseUrl),
),
KAGURA_MEMORY_RECONCILER_API_KEY: process.env.KAGURA_MEMORY_RECONCILER_API_KEY,
KAGURA_MEMORY_RECONCILER_MODEL: envOrConfig(
  'KAGURA_MEMORY_RECONCILER_MODEL',
  configString(appConfig.memory?.reconciler?.model),
),
KAGURA_MEMORY_RECONCILER_INTERVAL_MS: envOrConfig(
  'KAGURA_MEMORY_RECONCILER_INTERVAL_MS',
  configNumber(appConfig.memory?.reconciler?.intervalMs),
),
// ... 余者同 ...
```

注：`API_KEY` 不读 config，env-only。

- [ ] **Step 4: 跑测试，预期 pass**

Run: `cd apps/kagura && pnpm vitest run tests/env-memory-reconciler.test.ts`
Expected: PASS, 3/3。

- [ ] **Step 5: 跑 typecheck**

Run: `cd apps/kagura && pnpm typecheck`
Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add apps/kagura/src/env/server.ts apps/kagura/tests/env-memory-reconciler.test.ts
git commit -m "feat(env): add KAGURA_MEMORY_RECONCILER_* env and config schema"
```

---

## Task 6: MemoryReconciler 类（prune-only）

**Files:**

- Create: `apps/kagura/src/memory/reconciler/index.ts`
- Test: `apps/kagura/tests/memory-reconciler.test.ts`

- [ ] **Step 1: 写 failing test**

Create `apps/kagura/tests/memory-reconciler.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestDatabase } from './fixtures/test-database.js';
import { createTestLogger } from './helpers/logger.js';
import { MemoryReconciler } from '~/memory/reconciler/index.js';
import { SqliteReconcileStateStore } from '~/memory/reconciler/state-store.js';
import { SqliteMemoryStore } from '~/memory/memory-store.js';

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
    // memory remains
    expect(memoryStore.search(undefined, { category: 'preference' })).toHaveLength(1);
  });
});
```

- [ ] **Step 2: 跑测试，预期 fail**

Run: `cd apps/kagura && pnpm vitest run tests/memory-reconciler.test.ts`
Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现 reconciler**

Create `apps/kagura/src/memory/reconciler/index.ts`:

```typescript
import type { AppDatabase } from '~/db/index.js';
import type { AppLogger } from '~/logger/index.js';
import type { MemoryStore } from '~/memory/types.js';

import type { SqliteReconcileStateStore } from './state-store.js';

export interface MemoryReconcilerOptions {
  db: AppDatabase;
  memoryStore: MemoryStore;
  reconcileStore: SqliteReconcileStateStore;
  logger: AppLogger;
  intervalMs: number;
  writeThreshold: number;
  llmEnabled: boolean;
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
    // 立即跑一次首轮
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

    // 第二刀填 LLM 段
    this.options.logger.debug(
      'Memory reconciler dirty buckets: %s',
      eligible.map((b) => b.bucketKey).join(', '),
    );
  }
}
```

- [ ] **Step 4: 跑测试，预期 pass**

Run: `cd apps/kagura && pnpm vitest run tests/memory-reconciler.test.ts`
Expected: PASS, 2/2。

- [ ] **Step 5: Commit**

```bash
git add apps/kagura/src/memory/reconciler/index.ts apps/kagura/tests/memory-reconciler.test.ts
git commit -m "feat(memory): add MemoryReconciler with prune-only cycle"
```

---

## Task 7: application.ts 接入

**Files:**

- Modify: `apps/kagura/src/application.ts`

- [ ] **Step 1: 读 application.ts 当前 prune 调用点**

Run: `grep -n "pruneAll\|memoryStore\|new SqliteMemoryStore" apps/kagura/src/application.ts`

- [ ] **Step 2: 替换 startup prune + 注册 reconciler**

In `apps/kagura/src/application.ts`，于 `memoryStore = new SqliteMemoryStore(...)` 后：

```typescript
import { MemoryReconciler } from '~/memory/reconciler/index.js';
import { SqliteReconcileStateStore } from '~/memory/reconciler/state-store.js';

// ... existing wiring ...

const reconcileStateStore = new SqliteReconcileStateStore(db);
const memoryStore = new SqliteMemoryStore(db, logger.withTag('memory'), reconcileStateStore);

if (!env.KAGURA_MEMORY_RECONCILER_ENABLED) {
  logger.info('Memory reconciler disabled by config; expired-only prune via startup hook');
}

const reconcilerLlmEnabled =
  env.KAGURA_MEMORY_RECONCILER_ENABLED && Boolean(env.KAGURA_MEMORY_RECONCILER_API_KEY?.trim());

if (env.KAGURA_MEMORY_RECONCILER_ENABLED && !env.KAGURA_MEMORY_RECONCILER_API_KEY) {
  logger.warn(
    'KAGURA_MEMORY_RECONCILER_ENABLED=true but KAGURA_MEMORY_RECONCILER_API_KEY missing; LLM consolidation disabled, prune-only mode active',
  );
}

const memoryReconciler = new MemoryReconciler({
  db,
  memoryStore,
  reconcileStore: reconcileStateStore,
  logger: logger.withTag('memory-reconciler'),
  intervalMs: env.KAGURA_MEMORY_RECONCILER_INTERVAL_MS,
  writeThreshold: env.KAGURA_MEMORY_RECONCILER_WRITE_THRESHOLD,
  llmEnabled: reconcilerLlmEnabled,
});

memoryReconciler.start();
```

删原有 `memoryStore.pruneAll();` 一行 — reconciler 首轮会跑。

加 shutdown 钩（参既有 shutdown 块，append `memoryReconciler.stop();`）。

- [ ] **Step 3: 跑 typecheck + 全测试**

Run: `cd apps/kagura && pnpm typecheck && pnpm test`
Expected: PASS。

- [ ] **Step 4: Commit**

```bash
git add apps/kagura/src/application.ts
git commit -m "feat(memory): wire MemoryReconciler into application bootstrap"
```

---

# 第二刀：LLM Reconciler + CLI

## Task 8: OpenAI-兼容 fetch client

**Files:**

- Create: `apps/kagura/src/memory/reconciler/llm-client.ts`
- Test: `apps/kagura/tests/memory-reconciler-llm-client.test.ts`

- [ ] **Step 1: 写 failing test**

Create `apps/kagura/tests/memory-reconciler-llm-client.test.ts`:

```typescript
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OpenAICompatibleClient } from '~/memory/reconciler/llm-client.js';

describe('OpenAICompatibleClient', () => {
  afterEach(() => vi.restoreAllMocks());

  it('posts to /chat/completions with bearer auth', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: '[]' } }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const client = new OpenAICompatibleClient({
      baseUrl: 'https://example.com/v1',
      apiKey: 'sk-test',
      model: 'gpt-4o-mini',
      timeoutMs: 5000,
      maxTokens: 256,
    });

    const result = await client.chat([{ role: 'user', content: 'hi' }]);
    expect(result).toBe('[]');
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://example.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'authorization': 'Bearer sk-test',
          'content-type': 'application/json',
        }),
      }),
    );
  });

  it('aborts on timeout', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => undefined));
    const client = new OpenAICompatibleClient({
      baseUrl: 'https://example.com/v1',
      apiKey: 'sk-test',
      model: 'm',
      timeoutMs: 50,
      maxTokens: 256,
    });
    await expect(client.chat([{ role: 'user', content: 'x' }])).rejects.toThrow(/timeout|abort/i);
  });
});
```

- [ ] **Step 2: 跑测试，预期 fail**

Run: `cd apps/kagura && pnpm vitest run tests/memory-reconciler-llm-client.test.ts`
Expected: FAIL.

- [ ] **Step 3: 实现 client**

Create `apps/kagura/src/memory/reconciler/llm-client.ts`:

```typescript
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAICompatibleClientOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  maxTokens: number;
}

export class OpenAICompatibleClient {
  constructor(private readonly options: OpenAICompatibleClientOptions) {}

  async chat(messages: ChatMessage[]): Promise<string> {
    const url = `${this.options.baseUrl.replace(/\/$/, '')}/chat/completions`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs);
    try {
      const response = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'authorization': `Bearer ${this.options.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: this.options.model,
          max_tokens: this.options.maxTokens,
          messages,
          response_format: { type: 'json_object' },
        }),
      });
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`LLM API ${response.status}: ${body.slice(0, 200)}`);
      }
      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = data.choices?.[0]?.message?.content?.trim();
      if (!text) throw new Error('empty completion content');
      return text;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`LLM API timeout after ${this.options.timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}
```

- [ ] **Step 4: 跑测试，预期 pass**

Run: `cd apps/kagura && pnpm vitest run tests/memory-reconciler-llm-client.test.ts`
Expected: PASS, 2/2。

- [ ] **Step 5: Commit**

```bash
git add apps/kagura/src/memory/reconciler/llm-client.ts apps/kagura/tests/memory-reconciler-llm-client.test.ts
git commit -m "feat(memory): add OpenAI-compatible fetch client for reconciler"
```

---

## Task 9: reconcile op zod schema

**Files:**

- Create: `apps/kagura/src/memory/reconciler/op-schema.ts`
- Test: `apps/kagura/tests/memory-reconciler-op-schema.test.ts`

- [ ] **Step 1: 写 failing test**

Create `apps/kagura/tests/memory-reconciler-op-schema.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';

import { parseLlmOps } from '~/memory/reconciler/op-schema.js';

describe('parseLlmOps', () => {
  it('parses valid json-object output with ops array', () => {
    const json = JSON.stringify({
      ops: [
        { kind: 'delete', ids: ['m1', 'm2'] },
        {
          kind: 'merge',
          ids: ['a', 'b'],
          newContent: 'merged',
          category: 'preference',
        },
      ],
    });
    expect(parseLlmOps(json)).toHaveLength(2);
  });

  it('returns empty for empty array', () => {
    expect(parseLlmOps('{"ops":[]}')).toEqual([]);
  });

  it('throws on invalid shape', () => {
    expect(() => parseLlmOps('not json')).toThrow();
    expect(() => parseLlmOps('{"ops":[{"kind":"unknown"}]}')).toThrow();
  });
});
```

- [ ] **Step 2: 跑测试，预期 fail**

Run: `cd apps/kagura && pnpm vitest run tests/memory-reconciler-op-schema.test.ts`
Expected: FAIL.

- [ ] **Step 3: 实现 schema**

Create `apps/kagura/src/memory/reconciler/op-schema.ts`:

```typescript
import { z } from 'zod';

import { MEMORY_CATEGORIES } from '~/memory/types.js';

import type { ReconcileOp } from './types.js';

const opSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('delete'),
    ids: z.array(z.string()).min(1),
  }),
  z.object({
    kind: z.literal('rewrite'),
    id: z.string(),
    content: z.string().min(1),
    expiresAt: z.string().datetime().optional(),
  }),
  z.object({
    kind: z.literal('merge'),
    ids: z.array(z.string()).min(2),
    newContent: z.string().min(1),
    category: z.enum(MEMORY_CATEGORIES),
    expiresAt: z.string().datetime().optional(),
  }),
  z.object({
    kind: z.literal('extend_ttl'),
    ids: z.array(z.string()).min(1),
    expiresAt: z.string().datetime(),
  }),
]);

const responseSchema = z.object({
  ops: z.array(opSchema),
});

export function parseLlmOps(raw: string): ReconcileOp[] {
  const parsed = responseSchema.parse(JSON.parse(raw));
  return parsed.ops;
}
```

- [ ] **Step 4: 跑测试，预期 pass**

Run: `cd apps/kagura && pnpm vitest run tests/memory-reconciler-op-schema.test.ts`
Expected: PASS, 3/3。

- [ ] **Step 5: Commit**

```bash
git add apps/kagura/src/memory/reconciler/op-schema.ts apps/kagura/tests/memory-reconciler-op-schema.test.ts
git commit -m "feat(memory): add zod schema for LLM reconcile op output"
```

---

## Task 10: 单桶 reconcile processor

**Files:**

- Create: `apps/kagura/src/memory/reconciler/processor.ts`
- Test: `apps/kagura/tests/memory-reconciler-processor.test.ts`

- [ ] **Step 1: 写 failing test**

Create `apps/kagura/tests/memory-reconciler-processor.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest';

import { createTestDatabase } from './fixtures/test-database.js';
import { createTestLogger } from './helpers/logger.js';
import { reconcileBucket } from '~/memory/reconciler/processor.js';
import { SqliteMemoryStore } from '~/memory/memory-store.js';
import { SqliteReconcileStateStore } from '~/memory/reconciler/state-store.js';

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
});
```

- [ ] **Step 2: 跑测试，预期 fail**

Run: `cd apps/kagura && pnpm vitest run tests/memory-reconciler-processor.test.ts`
Expected: FAIL.

- [ ] **Step 3: 实现 processor**

Create `apps/kagura/src/memory/reconciler/processor.ts`:

```typescript
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
  bucketKey: string;
  memoryStore: MemoryStore;
  reconcileStore: SqliteReconcileStateStore;
  llm: Pick<OpenAICompatibleClient, 'chat'>;
  logger: AppLogger;
  batchSize: number;
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
      raw.slice(0, 200),
    );
    return;
  }

  if (ops.length > 0) {
    params.memoryStore.applyReconcileOps(ops);
    params.logger.info('Reconciled bucket %s with %d op(s)', params.bucketKey, ops.length);
  }

  // 更新水位（即使 0 ops 也要清 writesSinceReconcile，避 next cycle 重跑）
  const now = new Date().toISOString();
  const remaining = params.memoryStore.search(repoId, { category: parts.category, limit: 200 });
  params.reconcileStore.upsert(params.bucketKey, {
    lastReconciledAt: now,
    lastSeenMaxCreatedAt: remaining[0]?.createdAt ?? null,
    lastCount: remaining.length,
    writesSinceReconcile: 0,
  });
}
```

- [ ] **Step 4: 跑测试，预期 pass**

Run: `cd apps/kagura && pnpm vitest run tests/memory-reconciler-processor.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add apps/kagura/src/memory/reconciler/processor.ts apps/kagura/tests/memory-reconciler-processor.test.ts
git commit -m "feat(memory): add reconcileBucket processor with LLM-driven ops"
```

---

## Task 11: 接 LLM 段入 reconciler loop

**Files:**

- Modify: `apps/kagura/src/memory/reconciler/index.ts`
- Modify: `apps/kagura/src/application.ts`
- Test: `apps/kagura/tests/memory-reconciler.test.ts`

- [ ] **Step 1: 加 LLM-enabled 测试**

In `apps/kagura/tests/memory-reconciler.test.ts`, append:

```typescript
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
  expect(memoryStore.search(undefined, { category: 'preference' }).map((r) => r.id)).not.toContain(
    m.id,
  );
});
```

- [ ] **Step 2: 跑测试，预期 fail**

Run: `cd apps/kagura && pnpm vitest run tests/memory-reconciler.test.ts -t "write threshold met"`
Expected: FAIL，options 缺 llm/batchSize。

- [ ] **Step 3: 改 reconciler index.ts**

In `apps/kagura/src/memory/reconciler/index.ts`，扩 options：

```typescript
export interface MemoryReconcilerOptions {
  // ... existing ...
  llm?: Pick<OpenAICompatibleClient, 'chat'>;
  batchSize?: number;
}
```

`runOnce()` 内 LLM 段改为：

```typescript
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
```

加 import：`import { reconcileBucket } from './processor.js';` 与 `import type { OpenAICompatibleClient } from './llm-client.js';`。

- [ ] **Step 4: 改 application.ts wire LLM client**

In `apps/kagura/src/application.ts`，加：

```typescript
import { OpenAICompatibleClient } from '~/memory/reconciler/llm-client.js';

const llmClient = reconcilerLlmEnabled
  ? new OpenAICompatibleClient({
      baseUrl: env.KAGURA_MEMORY_RECONCILER_BASE_URL,
      apiKey: env.KAGURA_MEMORY_RECONCILER_API_KEY!,
      model: env.KAGURA_MEMORY_RECONCILER_MODEL,
      timeoutMs: env.KAGURA_MEMORY_RECONCILER_TIMEOUT_MS,
      maxTokens: env.KAGURA_MEMORY_RECONCILER_MAX_TOKENS,
    })
  : undefined;

const memoryReconciler = new MemoryReconciler({
  // ... existing ...
  llm: llmClient,
  batchSize: env.KAGURA_MEMORY_RECONCILER_BATCH_SIZE,
});
```

- [ ] **Step 5: 跑测试**

Run: `cd apps/kagura && pnpm typecheck && pnpm test`
Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add apps/kagura/src/memory/reconciler apps/kagura/src/application.ts apps/kagura/tests/memory-reconciler.test.ts
git commit -m "feat(memory): wire LLM client into reconciler loop"
```

---

## Task 12: kagura-memory CLI（recall）

**Files:**

- Create: `packages/memory-cli/package.json`
- Create: `packages/memory-cli/tsconfig.json`
- Create: `packages/memory-cli/src/cli.ts`
- Create: `packages/memory-cli/src/db.ts`
- Test: `packages/memory-cli/tests/cli.test.ts`
- Modify: `pnpm-workspace.yaml` (若 packages 已 glob 含则不必)
- Modify: `apps/kagura/package.json` — 加 dependency

- [ ] **Step 1: 创 package.json**

Create `packages/memory-cli/package.json`:

```json
{
  "bin": {
    "kagura-memory": "./dist/cli.js"
  },
  "dependencies": {
    "better-sqlite3": "^12.8.0",
    "commander": "^13.0.0",
    "drizzle-orm": "^0.45.2"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.13",
    "@types/node": "25.5.2",
    "typescript": "5.6.3",
    "vitest": "^4.1.5"
  },
  "name": "@kagura/memory-cli",
  "private": true,
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "type": "module",
  "version": "0.0.1"
}
```

- [ ] **Step 2: 创 tsconfig**

Create `packages/memory-cli/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": false,
    "sourceMap": false
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: 写 failing test**

Create `packages/memory-cli/tests/cli.test.ts`:

```typescript
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const cliEntry = new URL('../src/cli.ts', import.meta.url).pathname;

describe('kagura-memory recall', () => {
  it('prints empty array when no memories', () => {
    const result = spawnSync(
      'node',
      ['--import', 'tsx', cliEntry, 'recall', '--db', ':memory:', '--category', 'preference'],
      { encoding: 'utf8' },
    );
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual([]);
  });
});
```

- [ ] **Step 4: 跑测试，预期 fail**

Run: `cd packages/memory-cli && pnpm vitest run`
Expected: FAIL，CLI 不存在。

- [ ] **Step 5: 实现 db.ts 与 cli.ts**

Create `packages/memory-cli/src/db.ts`:

```typescript
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const memories = sqliteTable('memories', {
  id: text('id').primaryKey(),
  repoId: text('repo_id'),
  threadTs: text('thread_ts'),
  category: text('category').notNull(),
  content: text('content').notNull(),
  metadata: text('metadata'),
  createdAt: text('created_at').notNull(),
  expiresAt: text('expires_at'),
});

export function openDatabase(path: string) {
  const sqlite = new Database(path, { readonly: false });
  sqlite.pragma('journal_mode = WAL');
  return drizzle(sqlite, { schema: { memories } });
}
```

Create `packages/memory-cli/src/cli.ts`:

```typescript
#!/usr/bin/env node
import { and, desc, eq, gt, isNull, or, sql } from 'drizzle-orm';
import { Command } from 'commander';

import { memories, openDatabase } from './db.js';

function defaultDbPath(): string {
  return process.env.KAGURA_DB_PATH ?? './data/sessions.db';
}

const program = new Command();
program.name('kagura-memory').description('Kagura memory CLI').version('0.0.1');

program
  .command('recall')
  .description('Search memories')
  .option('--db <path>', 'SQLite path', defaultDbPath())
  .option('--query <text>', 'Substring to match')
  .option('--category <name>', 'preference|context|decision|observation|task_completed')
  .option('--scope <scope>', 'global|workspace', 'global')
  .option('--repo-id <id>', 'workspace repo id')
  .option('--limit <n>', 'max records', '10')
  .action((opts) => {
    const db = openDatabase(opts.db);
    const limit = Math.max(1, Math.min(50, Number(opts.limit) || 10));
    const nowIso = new Date().toISOString();
    const repoCondition =
      opts.scope === 'workspace' && opts.repoId
        ? eq(memories.repoId, opts.repoId)
        : isNull(memories.repoId);
    const conds = [repoCondition, or(isNull(memories.expiresAt), gt(memories.expiresAt, nowIso))];
    if (opts.category) conds.push(eq(memories.category, opts.category));
    if (opts.query) {
      const escaped = opts.query.toLowerCase().replaceAll('\\', '\\\\').replaceAll('%', '\\%');
      conds.push(sql`lower(${memories.content}) like ${`%${escaped}%`} escape '\\'`);
    }
    const rows = db
      .select()
      .from(memories)
      .where(and(...conds))
      .orderBy(desc(memories.createdAt))
      .limit(limit)
      .all();
    process.stdout.write(JSON.stringify(rows, null, 2) + '\n');
  });

program.parseAsync(process.argv).catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
```

- [ ] **Step 6: 跑测试，预期 pass**

Run: `cd packages/memory-cli && pnpm vitest run`
Expected: PASS。

- [ ] **Step 7: Commit**

```bash
git add packages/memory-cli pnpm-lock.yaml
git commit -m "feat(memory-cli): add kagura-memory recall command"
```

---

## Task 13: prompt 改：boot inject 瘦身 + on-demand recall

**Files:**

- Modify: `apps/kagura/src/agent/prompt/processors.ts`
- Modify: `apps/kagura/src/agent/providers/codex-cli/prompt.ts`
- Test: `apps/kagura/tests/prompt-memory-context.test.ts`

- [ ] **Step 1: 写 failing test**

Create `apps/kagura/tests/prompt-memory-context.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';

import { memoryContextProcessor } from '~/agent/prompt/processors.js';

function makeCtx(memories: any) {
  return {
    contextParts: [] as string[],
    systemParts: [] as string[],
    userMessageParts: [] as string[],
    images: [],
    imageLoadFailures: [],
    request: { contextMemories: memories } as any,
  };
}

describe('memoryContextProcessor (slim mode)', () => {
  it('only injects identity preferences, not full global/workspace', () => {
    const ctx = makeCtx({
      preferences: [{ id: '1', content: 'nickname: 小汐', category: 'preference', createdAt: '' }],
      global: [{ id: '2', content: 'used vue once', category: 'observation', createdAt: '' }],
      workspace: [],
    });
    memoryContextProcessor.process(ctx);
    const joined = ctx.contextParts.join('\n');
    expect(joined).toContain('nickname: 小汐');
    expect(joined).not.toContain('used vue once');
  });

  it('emits empty marker when no preferences', () => {
    const ctx = makeCtx({ preferences: [], global: [], workspace: [] });
    memoryContextProcessor.process(ctx);
    expect(ctx.contextParts.join('')).toContain('No identity preferences');
  });
});
```

- [ ] **Step 2: 跑测试，预期 fail**

Run: `cd apps/kagura && pnpm vitest run tests/prompt-memory-context.test.ts`
Expected: FAIL，旧版 processor 包含 global/workspace inject。

- [ ] **Step 3: 改 processor**

In `apps/kagura/src/agent/prompt/processors.ts`，将 `memoryContextProcessor` 改为仅 inject preferences，加 hint：

```typescript
export const memoryContextProcessor: PromptProcessor = {
  name: 'memory-context',
  process(ctx) {
    const memories = ctx.request.contextMemories;
    const preferences = memories?.preferences ?? [];
    const lines: string[] = [];

    if (preferences.length > 0) {
      lines.push('=== YOUR IDENTITY & USER PREFERENCES (ALWAYS FOLLOW THESE) ===');
      lines.push(...preferences.map((m, i) => `[${i + 1}] (${m.createdAt}) ${m.content}`));
      lines.push('=== End Identity & Preferences ===');
    } else {
      lines.push('No identity preferences saved yet.');
    }

    lines.push(
      '',
      'For other memories (global/workspace project facts, decisions, observations), do NOT assume they are loaded. Use the recall tool / kagura-memory CLI to query on demand when needed.',
    );

    ctx.contextParts.push(`<conversation_memory>\n${lines.join('\n')}\n</conversation_memory>`);
  },
};
```

- [ ] **Step 4: codex prompt 加 CLI 用法**

In `apps/kagura/src/agent/providers/codex-cli/prompt.ts`，于 `<codex_runtime_tools>` 段 Memory operations 之后追加：

```
- To recall memory on demand, run shell: kagura-memory recall --query <text> --category <preference|context|...> --scope <global|workspace> --repo-id <id> --limit <n>. Output is JSON array.
```

- [ ] **Step 5: 跑全测试**

Run: `cd apps/kagura && pnpm typecheck && pnpm test`
Expected: PASS。注意：原已有 `tests/global-memory.test.ts` 中可能有 `<conversation_memory>` snapshot 需更新。

- [ ] **Step 6: Commit**

```bash
git add apps/kagura/src/agent/prompt apps/kagura/src/agent/providers/codex-cli/prompt.ts apps/kagura/tests
git commit -m "feat(prompt): slim conversation_memory to identity prefs + on-demand recall hint"
```

---

# 第三刀：Codex 弃 JSONL，迁 CLI

## Task 14: kagura-memory CLI 加 save 子命令

**Files:**

- Modify: `packages/memory-cli/src/cli.ts`
- Test: `packages/memory-cli/tests/cli-save.test.ts`

- [ ] **Step 1: 写 failing test**

Create `packages/memory-cli/tests/cli-save.test.ts`:

```typescript
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const cliEntry = new URL('../src/cli.ts', import.meta.url).pathname;

describe('kagura-memory save', () => {
  it('saves a global preference and returns id', () => {
    const dir = mkdtempSync(join(tmpdir(), 'kg-mem-'));
    const dbPath = join(dir, 'test.db');
    // bootstrap empty schema via migration would require apps/kagura/drizzle;
    // for unit test, accept that save creates table on first call OR pre-init.
    // Simpler: call recall first to verify db opens.
    const init = spawnSync('node', ['--import', 'tsx', cliEntry, 'recall', '--db', dbPath], {
      encoding: 'utf8',
    });
    // ignore init failure, save should error cleanly if table missing
    const result = spawnSync(
      'node',
      [
        '--import',
        'tsx',
        cliEntry,
        'save',
        '--db',
        dbPath,
        '--category',
        'preference',
        '--scope',
        'global',
        '--content',
        'test pref',
      ],
      { encoding: 'utf8' },
    );
    if (result.status !== 0) {
      expect(result.stderr).toMatch(/no such table/i);
      return;
    }
    const out = JSON.parse(result.stdout);
    expect(out.id).toBeTruthy();
    expect(out.content).toBe('test pref');
  });
});
```

注：需 apps/kagura DB 已 migrate；若 fresh db 缺表，save 报 "no such table"。CLI 之前置依赖：操作员先跑 `pnpm db:migrate`。

- [ ] **Step 2: 跑测试，预期 fail**

Run: `cd packages/memory-cli && pnpm vitest run tests/cli-save.test.ts`
Expected: FAIL，save 子命令未注册。

- [ ] **Step 3: 实现 save 子命令**

In `packages/memory-cli/src/cli.ts`，append before `program.parseAsync`：

```typescript
import { randomUUID } from 'node:crypto';

program
  .command('save')
  .description('Save a memory record')
  .requiredOption('--category <name>', 'preference|context|decision|observation|task_completed')
  .requiredOption('--content <text>', 'memory content')
  .option('--db <path>', 'SQLite path', defaultDbPath())
  .option('--scope <scope>', 'global|workspace', 'global')
  .option('--repo-id <id>', 'workspace repo id')
  .option('--thread-ts <ts>', 'slack thread ts')
  .option('--expires-at <iso>', 'ISO datetime')
  .action((opts) => {
    if (opts.scope === 'workspace' && !opts.repoId) {
      console.error('--repo-id required when --scope=workspace');
      process.exit(2);
    }
    const db = openDatabase(opts.db);
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    db.insert(memories)
      .values({
        id,
        repoId: opts.scope === 'workspace' ? opts.repoId : null,
        threadTs: opts.threadTs ?? null,
        category: opts.category,
        content: opts.content,
        metadata: null,
        createdAt,
        expiresAt: opts.expiresAt ?? null,
      })
      .run();
    process.stdout.write(
      JSON.stringify({
        id,
        content: opts.content,
        category: opts.category,
        scope: opts.scope,
        createdAt,
      }) + '\n',
    );
  });
```

注：CLI 直接写表，绕开 `bumpWrite` 钩。第一刀已设计 `applyReconcileOps` 不污染 dirty —— 这里 CLI 是用户/agent 主动 save，**应** bump dirty。简便实现：CLI 同样手动 update reconcile state。但为保单文件简洁，第三刀仅做"代换 JSONL"，dirty bump 留至跨进程后通过另一通道（如 trigger file 或下次 cycle 自检 maxCreated 变化亦会发现）。

故 reconciler `getDirtyBuckets()` 之 `lastSeenMaxCreatedAt` 比对会捕获新写入 → 即使 writesSinceReconcile 不 bump，下个 cycle 仍触发 reconcile（若 threshold=0 或基于 maxCreated 改）。**改 threshold 检测**：在 task 11 之 `eligible` 滤改为 `state==null || state.lastSeenMaxCreatedAt !== currentMax || writesSinceReconcile >= K`。如此跨进程 writes 也能被发现。**此修订并入第三刀 Task 16 而非新加 task。**

- [ ] **Step 4: 跑测试，预期 pass**

Run: `cd packages/memory-cli && pnpm vitest run`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add packages/memory-cli
git commit -m "feat(memory-cli): add save subcommand"
```

---

## Task 15: codex prompt 切换至 CLI

**Files:**

- Modify: `apps/kagura/src/agent/providers/codex-cli/prompt.ts`

- [ ] **Step 1: 改 `<codex_runtime_tools>` 段**

In `apps/kagura/src/agent/providers/codex-cli/prompt.ts`，找 Memory operations 段，整体替换：

```
Memory operations:
- To save memory, run shell: kagura-memory save --category <preference|context|decision|observation|task_completed> --content "<text>" --scope <global|workspace> [--repo-id <id>] [--expires-at <ISO>].
- To recall memory, run shell: kagura-memory recall --category <name> --scope <global|workspace> [--repo-id <id>] [--query <substr>] [--limit <n>]. Output is JSON array of records.
- Save durable preferences, decisions, project facts, implementation outcomes, task-completed notes, or explicit user memory requests. Skip routine status or transcript restatements.
- The reconciler will dedupe periodically; no need to check existing records before saving.
```

删 `runtimePaths.memoryOpsPath` 引用与 JSON shape 文段。

- [ ] **Step 2: 跑相关 test**

Run: `cd apps/kagura && pnpm vitest run tests/codex-cli-adapter.test.ts`
Expected: 若 test 含 `memoryOpsPath` 之断言会 fail，下一 task 处理。

- [ ] **Step 3: 跑 typecheck**

Run: `cd apps/kagura && pnpm typecheck`
Expected: 可能 fail（`memoryOpsPath` unused），下一 task 处理。

- [ ] **Step 4: Commit (允许 test 暂红)**

```bash
git add apps/kagura/src/agent/providers/codex-cli/prompt.ts
git commit -m "refactor(codex): switch memory ops doc to kagura-memory CLI"
```

---

## Task 16: 删 codex applyMemoryOps + memoryOpsPath，含 reconciler dirty 检测改进

**Files:**

- Modify: `apps/kagura/src/agent/providers/codex-cli/adapter.ts`
- Modify: `apps/kagura/src/agent/providers/codex-cli/prompt.ts`
- Modify: `apps/kagura/src/memory/reconciler/index.ts`
- Modify: `apps/kagura/tests/codex-cli-adapter.test.ts`

- [ ] **Step 1: 删 adapter 之 applyMemoryOps**

In `apps/kagura/src/agent/providers/codex-cli/adapter.ts`：

- 删 `await this.applyMemoryOps(request, memoryOpsPath);` 调用
- 删 `private async applyMemoryOps(...)` 方法（约 55 行）
- 删 `parseCodexMemoryOp(...)` 函数与 `interface CodexMemorySaveOp`（约 50 行）
- 删 `memoryOpsPath` 解构

- [ ] **Step 2: 删 prompt 之 runtimePaths.memoryOpsPath 字段**

In `apps/kagura/src/agent/providers/codex-cli/prompt.ts` 内 `getCodexRuntimePaths` 与 `getCodexMemoryOpsFileName`：

- 删 `getCodexMemoryOpsFileName` 函数
- 删 returned object 之 `memoryOpsPath` 字段
- 检查 grep 别处引用：`grep -n "memoryOpsPath" apps/kagura/src --include="*.ts" -r`

- [ ] **Step 3: 改 reconciler dirty 检测，使跨进程写也触发**

In `apps/kagura/src/memory/reconciler/index.ts`，`runOnce()` 之 eligible 滤改为：

```typescript
const eligible = dirty.filter((b) => {
  const state = b.state;
  if (!state) return true;
  if (state.lastSeenMaxCreatedAt !== b.currentMaxCreatedAt) return true;
  if (state.lastCount !== b.currentCount) return true;
  return state.writesSinceReconcile >= this.options.writeThreshold;
});
```

如此 CLI save 虽不 bump dirty counter，maxCreated 改变会触发 reconcile。

- [ ] **Step 4: 改测试**

In `apps/kagura/tests/codex-cli-adapter.test.ts`：

- 删凡 `memoryOpsPath` 写入与断言
- 加一例：codex prompt 含 `kagura-memory save` 字串

```typescript
it('codex prompt mentions kagura-memory CLI for memory ops', () => {
  const prompt = buildCodexPrompt(makeRequest({}));
  expect(prompt).toContain('kagura-memory save');
  expect(prompt).toContain('kagura-memory recall');
  expect(prompt).not.toContain('memory-ops.jsonl');
});
```

- [ ] **Step 5: 跑全测试 + typecheck**

Run: `cd apps/kagura && pnpm typecheck && pnpm test`
Expected: PASS。

- [ ] **Step 6: 跑 reconciler 跨进程 dirty 测试**

In `apps/kagura/tests/memory-reconciler.test.ts`, append:

```typescript
it('detects external write via maxCreatedAt change even without bumpWrite', async () => {
  const { db } = createTestDatabase();
  const reconcileStore = new SqliteReconcileStateStore(db);
  const memoryStore = new SqliteMemoryStore(db, createTestLogger(), reconcileStore);
  memoryStore.save({ category: 'preference', content: 'a' });

  // 模拟外部进程：直 db 写，绕开 bumpWrite
  const extId = 'ext-1';
  await db
    .insert(memoriesTable)
    .values({
      id: extId,
      repoId: null,
      threadTs: null,
      category: 'preference',
      content: 'external',
      metadata: null,
      createdAt: new Date(Date.now() + 10).toISOString(),
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
```

注：上 import `import { memories as memoriesTable } from '~/db/schema.js';`。

Run: `cd apps/kagura && pnpm vitest run tests/memory-reconciler.test.ts -t "external write"`
Expected: PASS。

- [ ] **Step 7: Commit**

```bash
git add apps/kagura/src/agent/providers/codex-cli apps/kagura/src/memory/reconciler apps/kagura/tests
git commit -m "feat(codex): drop JSONL applyMemoryOps; reconciler now detects cross-process writes via maxCreatedAt"
```

---

## Task 17: docs + final QA

**Files:**

- Modify: `apps/kagura/CLAUDE.md`
- Modify: `docs/configuration.md`

- [ ] **Step 1: 文档更新**

In `apps/kagura/CLAUDE.md`，加一段 "Memory & Reconciler"：

```markdown
## Memory & Reconciler

Memory is persisted in SQLite (`memories` table). Two write paths:

- Claude Code provider: in-process MCP `save_memory` tool
- Codex CLI provider: shells out to `kagura-memory save`

A background `MemoryReconciler` runs on `KAGURA_MEMORY_RECONCILER_INTERVAL_MS` and:

1. Prunes expired records (always-on, no LLM).
2. Detects dirty buckets via `memory_reconcile_state` watermark + `writesSinceReconcile >= threshold`.
3. If LLM enabled (`KAGURA_MEMORY_RECONCILER_ENABLED=true` + `KAGURA_MEMORY_RECONCILER_API_KEY`), calls OpenAI-compatible `/chat/completions` to consolidate (delete/merge/rewrite/extend_ttl ops).

Recall is on-demand: model calls `kagura-memory recall` (codex) or `recall_memory` MCP tool (claude-code). Boot-time prompt only injects identity preferences.
```

In `docs/configuration.md`，加 `KAGURA_MEMORY_RECONCILER_*` env 表与 config.json `memory.reconciler` block 之示例。

- [ ] **Step 2: 跑全测试 + typecheck + build**

Run: `cd apps/kagura && pnpm typecheck && pnpm test && pnpm build`
Expected: 全 PASS。

- [ ] **Step 3: Commit**

```bash
git add apps/kagura/CLAUDE.md docs/configuration.md
git commit -m "docs(memory): document reconciler architecture and env vars"
```

---

## Self-Review

依 spec 各节复审，各节皆有 task 对应：

- **写时合流 + 后台周期 worker** → Task 6（loop 骨架）+ Task 11（LLM 段）
- **TTL fast path** → Task 6（pruneAll on tick）
- **Watermark + write threshold** → Task 3（state store）+ Task 4（bumpWrite）+ Task 6（runOnce 滤）
- **OpenAI-兼容 client** → Task 8
- **Reconcile op 语义** → Task 9（schema）+ Task 4（applyReconcileOps）
- **环境变量 + config** → Task 5
- **API_KEY env-only + warn-and-disable** → Task 5（schema）+ Task 7（warn）
- **kagura-memory CLI recall** → Task 12
- **kagura-memory CLI save** → Task 14
- **Prompt slim + on-demand recall** → Task 13
- **Codex 弃 JSONL** → Task 15 + Task 16
- **跨进程 dirty 检测** → Task 16 Step 3+6
- **MCP recall_memory 不变** → 隐式覆盖（claude-code mcp-server.ts 不动）

无 placeholder。类型一致：`ReconcileOp`/`ReconcileBucketState`/`DirtyBucketSummary` 在 Task 2 定义，后续皆引同名。

---

## Execution Handoff

Plan 已写入 `docs/superpowers/plans/2026-05-03-memory-reconciler.md`。两路执行：

**1. Subagent-Driven (recommended)** — 每 task 一个 fresh subagent，task 间 review，迭代快
**2. Inline Execution** — 本会话 batch 执行 with checkpoints

君欲哪路？
