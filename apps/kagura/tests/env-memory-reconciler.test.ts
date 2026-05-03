import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('memory reconciler env defaults', () => {
  beforeEach(() => {
    delete process.env.KAGURA_MEMORY_RECONCILER_ENABLED;
    delete process.env.KAGURA_MEMORY_RECONCILER_BASE_URL;
    delete process.env.KAGURA_MEMORY_RECONCILER_API_KEY;
    delete process.env.KAGURA_MEMORY_RECONCILER_MODEL;
    delete process.env.KAGURA_MEMORY_RECONCILER_INTERVAL_MS;
    delete process.env.KAGURA_MEMORY_RECONCILER_WRITE_THRESHOLD;
    delete process.env.KAGURA_MEMORY_RECONCILER_BATCH_SIZE;
    delete process.env.KAGURA_MEMORY_RECONCILER_TIMEOUT_MS;
    delete process.env.KAGURA_MEMORY_RECONCILER_MAX_TOKENS;
  });

  afterEach(() => {
    delete process.env.KAGURA_MEMORY_RECONCILER_ENABLED;
    delete process.env.KAGURA_MEMORY_RECONCILER_BASE_URL;
    delete process.env.KAGURA_MEMORY_RECONCILER_API_KEY;
    delete process.env.KAGURA_MEMORY_RECONCILER_MODEL;
    delete process.env.KAGURA_MEMORY_RECONCILER_INTERVAL_MS;
    delete process.env.KAGURA_MEMORY_RECONCILER_WRITE_THRESHOLD;
    delete process.env.KAGURA_MEMORY_RECONCILER_BATCH_SIZE;
    delete process.env.KAGURA_MEMORY_RECONCILER_TIMEOUT_MS;
    delete process.env.KAGURA_MEMORY_RECONCILER_MAX_TOKENS;
  });

  it('exposes the new keys with defaults', async () => {
    const { env } = await import('~/env/server.js');
    expect(env.KAGURA_MEMORY_RECONCILER_ENABLED).toBe(false);
    expect(env.KAGURA_MEMORY_RECONCILER_BASE_URL).toBe('https://api.openai.com/v1');
    expect(env.KAGURA_MEMORY_RECONCILER_MODEL).toBe('gpt-4o-mini');
    expect(env.KAGURA_MEMORY_RECONCILER_INTERVAL_MS).toBe(21_600_000);
    expect(env.KAGURA_MEMORY_RECONCILER_WRITE_THRESHOLD).toBe(5);
    expect(env.KAGURA_MEMORY_RECONCILER_BATCH_SIZE).toBe(50);
    expect(env.KAGURA_MEMORY_RECONCILER_TIMEOUT_MS).toBe(30_000);
    expect(env.KAGURA_MEMORY_RECONCILER_MAX_TOKENS).toBe(1024);
  });

  it('treats empty API_KEY as undefined', async () => {
    const { env } = await import('~/env/server.js');
    expect(env.KAGURA_MEMORY_RECONCILER_API_KEY).toBeUndefined();
  });
});
