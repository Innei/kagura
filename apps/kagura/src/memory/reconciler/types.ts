import type { MemoryCategory, MemoryScope } from '~/memory/types.js';
import { MEMORY_CATEGORIES } from '~/memory/types.js';

export interface BucketKeyParts {
  category: MemoryCategory;
  repoId?: string;
  scope: MemoryScope;
}

export interface ReconcileBucketState {
  bucketKey: string;
  lastCount: number;
  lastReconciledAt: string | null;
  lastSeenMaxCreatedAt: string | null;
  writesSinceReconcile: number;
}

export type ReconcileOp =
  | { kind: 'delete'; ids: string[] }
  | { kind: 'rewrite'; id: string; content: string; expiresAt?: string | undefined }
  | {
      kind: 'merge';
      ids: string[];
      newContent: string;
      category: MemoryCategory;
      expiresAt?: string | undefined;
    }
  | { kind: 'extend_ttl'; ids: string[]; expiresAt: string };

export interface AppliedReconcileOp {
  kind: ReconcileOp['kind'];
  payload?: Record<string, unknown> | undefined;
  sourceIds: string[];
  targetId?: string | undefined;
}

export interface ApplyReconcileResult {
  appliedOps: AppliedReconcileOp[];
}

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
  const segments = key.split(':');
  if (segments.length !== 3) {
    throw new Error(`invalid bucket key: ${key}`);
  }
  const [scope, second, third] = segments;
  const knownCategories = MEMORY_CATEGORIES as readonly string[];
  if (scope === 'global') {
    if (second !== '' || !third || !knownCategories.includes(third)) {
      throw new Error(`invalid bucket key: ${key}`);
    }
    return { scope: 'global', category: third as MemoryCategory };
  }
  if (scope === 'workspace') {
    if (!second || !third || !knownCategories.includes(third)) {
      throw new Error(`invalid bucket key: ${key}`);
    }
    return {
      scope: 'workspace',
      repoId: second,
      category: third as MemoryCategory,
    };
  }
  throw new Error(`invalid bucket key: ${key}`);
}
