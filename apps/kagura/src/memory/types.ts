import type { ReconcileBucketState, ReconcileOp } from './reconciler/types.js';

export const MEMORY_CATEGORIES = [
  'task_completed',
  'decision',
  'context',
  'observation',
  'preference',
] as const;

export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

export type MemoryScope = 'global' | 'workspace';

export interface MemoryRecord {
  category: MemoryCategory;
  content: string;
  createdAt: string;
  expiresAt?: string | undefined;
  id: string;
  metadata?: Record<string, unknown> | undefined;
  repoId?: string | undefined;
  scope: MemoryScope;
  threadTs?: string | undefined;
}

export interface SaveMemoryInput {
  category: MemoryCategory;
  content: string;
  expiresAt?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
  repoId?: string | undefined;
  threadTs?: string | undefined;
}

export interface MemorySearchOptions {
  category?: MemoryCategory | undefined;
  limit?: number | undefined;
  query?: string | undefined;
}

export interface ContextMemories {
  global: MemoryRecord[];
  preferences: MemoryRecord[];
  workspace: MemoryRecord[];
}

export interface DirtyBucketSummary {
  bucketKey: string;
  currentCount: number;
  currentMaxCreatedAt: string | null;
  state: ReconcileBucketState | null;
}

export interface MemoryStore {
  applyReconcileOps: (ops: ReconcileOp[]) => void;
  countAll: (repoId?: string) => number;
  countByCategory: (repoId: string | undefined, category: MemoryCategory) => number;
  delete: (id: string) => boolean;
  deleteAll: (repoId?: string | null) => number;
  getDirtyBuckets: () => DirtyBucketSummary[];
  listForContext: (
    repoId: string | undefined,
    limits?: { global?: number; workspace?: number },
  ) => ContextMemories;
  listRecent: (repoId: string | undefined, limit?: number) => MemoryRecord[];
  prune: (repoId?: string | null) => number;
  pruneAll: () => number;
  save: (input: SaveMemoryInput) => MemoryRecord;
  search: (repoId: string | undefined, options?: MemorySearchOptions) => MemoryRecord[];
}
