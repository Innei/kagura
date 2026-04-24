import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { claudeProvider } from '../src/providers/claude.js';
import type { PromptCtx, PromptOption } from '../src/providers/types.js';

function makeCtx(answers: Record<string, string | undefined>): PromptCtx {
  return {
    select: async <T extends string>(_m: string, options: PromptOption<T>[]): Promise<T> => {
      return (answers.select as T | undefined) ?? (options[0]?.value as T);
    },
    text: async (message: string) => answers[`text:${message}`],
    password: async (message: string) => answers[`pw:${message}`],
    note: () => {
      /* noop */
    },
  };
}

describe('claudeProvider', () => {
  const origHome = process.env.HOME;
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kg-claude-'));
    process.env.HOME = tmp;
  });

  afterEach(() => {
    process.env.HOME = origHome;
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('detects ~/.claude as ready', async () => {
    fs.mkdirSync(path.join(tmp, '.claude'));
    const res = await claudeProvider.detect();
    expect(res.status).toBe('ready');
  });

  it('detects absent when neither ~/.claude nor API key present', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const res = await claudeProvider.detect();
    expect(res.status).toBe('absent');
  });

  it('oauth branch writes defaultProviderId only', async () => {
    const ctx = makeCtx({ select: 'oauth' });
    const patch = await claudeProvider.prompt(ctx);
    expect(patch.env).toEqual({});
    expect(patch.config?.defaultProviderId).toBe('claude-code');
  });

  it('api-key branch writes ANTHROPIC_API_KEY', async () => {
    const ctx = makeCtx({ 'select': 'api-key', 'pw:ANTHROPIC_API_KEY': 'sk-ant-123' });
    const patch = await claudeProvider.prompt(ctx);
    expect(patch.env?.ANTHROPIC_API_KEY).toBe('sk-ant-123');
  });

  it('base-url branch writes BASE_URL and AUTH_TOKEN', async () => {
    const ctx = makeCtx({
      'select': 'provider',
      'text:ANTHROPIC_BASE_URL': 'https://api.kimi.com/coding',
      'pw:ANTHROPIC_AUTH_TOKEN': 'kimi-tok',
      'text:ANTHROPIC_MODEL（optional）': 'kimi-for-coding',
    });
    const patch = await claudeProvider.prompt(ctx);
    expect(patch.env?.ANTHROPIC_BASE_URL).toBe('https://api.kimi.com/coding');
    expect(patch.env?.ANTHROPIC_AUTH_TOKEN).toBe('kimi-tok');
    expect(patch.env?.ANTHROPIC_MODEL).toBe('kimi-for-coding');
  });
});
