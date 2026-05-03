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

  it('strips trailing slash on baseUrl', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), {
        status: 200,
      }),
    );
    const client = new OpenAICompatibleClient({
      baseUrl: 'https://example.com/v1/',
      apiKey: 'sk',
      model: 'm',
      timeoutMs: 1000,
      maxTokens: 8,
    });
    await client.chat([{ role: 'user', content: 'x' }]);
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://example.com/v1/chat/completions',
      expect.anything(),
    );
  });

  it('disables thinking mode for official DeepSeek V4 models', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: '{}' } }] }), {
        status: 200,
      }),
    );
    const client = new OpenAICompatibleClient({
      baseUrl: 'https://api.deepseek.com',
      apiKey: 'sk',
      model: 'deepseek-v4-flash',
      timeoutMs: 1000,
      maxTokens: 8,
    });
    await client.chat([{ role: 'user', content: 'x' }]);
    const body = JSON.parse(String((fetchSpy.mock.calls[0]?.[1] as RequestInit).body));
    expect(body).toMatchObject({ thinking: { type: 'disabled' } });
  });

  it('throws with status code on non-2xx', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('quota exceeded', { status: 429 }),
    );
    const client = new OpenAICompatibleClient({
      baseUrl: 'https://example.com/v1',
      apiKey: 'sk',
      model: 'm',
      timeoutMs: 1000,
      maxTokens: 8,
    });
    await expect(client.chat([{ role: 'user', content: 'x' }])).rejects.toThrow(/429/);
  });

  it('throws on empty completion content', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: '' } }] }), { status: 200 }),
    );
    const client = new OpenAICompatibleClient({
      baseUrl: 'https://example.com/v1',
      apiKey: 'sk',
      model: 'm',
      timeoutMs: 1000,
      maxTokens: 8,
    });
    await expect(client.chat([{ role: 'user', content: 'x' }])).rejects.toThrow(/empty/i);
  });

  it('aborts on timeout', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          const signal = (init as RequestInit | undefined)?.signal;
          if (signal) {
            signal.addEventListener('abort', () => {
              const err = new Error('aborted');
              err.name = 'AbortError';
              reject(err);
            });
          }
        }),
    );
    const client = new OpenAICompatibleClient({
      baseUrl: 'https://example.com/v1',
      apiKey: 'sk',
      model: 'm',
      timeoutMs: 50,
      maxTokens: 8,
    });
    await expect(client.chat([{ role: 'user', content: 'x' }])).rejects.toThrow(/timeout|abort/i);
  });
});
