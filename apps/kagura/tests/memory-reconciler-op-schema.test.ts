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

  it('rejects merge op with fewer than 2 ids', () => {
    const json = JSON.stringify({
      ops: [{ kind: 'merge', ids: ['only-one'], newContent: 'x', category: 'preference' }],
    });
    expect(() => parseLlmOps(json)).toThrow();
  });

  it('rejects delete op with empty ids array', () => {
    const json = JSON.stringify({
      ops: [{ kind: 'delete', ids: [] }],
    });
    expect(() => parseLlmOps(json)).toThrow();
  });

  it('accepts rewrite op with optional expiresAt', () => {
    const json = JSON.stringify({
      ops: [
        { kind: 'rewrite', id: 'm1', content: 'updated' },
        { kind: 'rewrite', id: 'm2', content: 'updated', expiresAt: '2026-12-31T00:00:00Z' },
      ],
    });
    const ops = parseLlmOps(json);
    expect(ops).toHaveLength(2);
  });

  it('accepts extend_ttl op with required expiresAt', () => {
    const json = JSON.stringify({
      ops: [
        {
          kind: 'extend_ttl',
          ids: ['m1'],
          expiresAt: '2026-12-31T00:00:00Z',
        },
      ],
    });
    expect(parseLlmOps(json)).toHaveLength(1);
  });

  it('rejects merge op with unknown category', () => {
    const json = JSON.stringify({
      ops: [
        {
          kind: 'merge',
          ids: ['a', 'b'],
          newContent: 'x',
          category: 'not_a_category',
        },
      ],
    });
    expect(() => parseLlmOps(json)).toThrow();
  });
});
