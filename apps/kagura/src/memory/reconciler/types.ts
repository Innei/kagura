import type { MemoryCategory, MemoryScope } from '~/memory/types.js';

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
