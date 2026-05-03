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

describe('parseBucketKey errors', () => {
  it('throws when key has wrong segment count', () => {
    expect(() => parseBucketKey('garbage')).toThrow();
    expect(() => parseBucketKey('workspace:repo:context:extra')).toThrow();
  });

  it('throws when scope is unknown', () => {
    expect(() => parseBucketKey('unknown:foo:bar')).toThrow();
  });

  it('throws when workspace key lacks repoId', () => {
    expect(() => parseBucketKey('workspace::context')).toThrow();
  });

  it('throws when category is not a known MemoryCategory', () => {
    expect(() => parseBucketKey('global::not_a_category')).toThrow();
    expect(() => parseBucketKey('workspace:repo-1:bogus')).toThrow();
  });
});

describe('round-trip', () => {
  it('parseBucketKey is the inverse of bucketKeyFor for global', () => {
    const parts = { scope: 'global' as const, category: 'preference' as const };
    expect(parseBucketKey(bucketKeyFor(parts))).toEqual(parts);
  });

  it('parseBucketKey is the inverse of bucketKeyFor for workspace', () => {
    const parts = {
      scope: 'workspace' as const,
      repoId: 'repo-1',
      category: 'context' as const,
    };
    expect(parseBucketKey(bucketKeyFor(parts))).toEqual(parts);
  });
});
