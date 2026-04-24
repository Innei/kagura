import { describe, expect, it } from 'vitest';

import { getProvider, listProviders } from '../src/providers/registry.js';

describe('provider registry', () => {
  it('lists providers in stable order', () => {
    const list = listProviders();
    expect(list.map((p) => p.id)).toEqual(['claude-code', 'codex-cli']);
  });

  it('getProvider returns by id', () => {
    expect(getProvider('claude-code').id).toBe('claude-code');
    expect(getProvider('codex-cli').id).toBe('codex-cli');
  });

  it('getProvider throws on unknown', () => {
    expect(() => getProvider('x' as never)).toThrow();
  });
});
