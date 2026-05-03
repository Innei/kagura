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
