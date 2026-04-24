import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { ProviderSetup } from './types.js';

function homeDir(): string {
  return process.env.HOME?.trim() || os.homedir();
}

export const claudeProvider: ProviderSetup = {
  id: 'claude-code',
  label: 'Claude Code (Anthropic)',
  order: 10,

  async detect() {
    const claudeDir = path.join(homeDir(), '.claude');
    if (fs.existsSync(claudeDir)) {
      return { status: 'ready', detail: `oauth detected (${claudeDir})` };
    }
    if (process.env.ANTHROPIC_API_KEY?.trim()) {
      return { status: 'ready', detail: 'ANTHROPIC_API_KEY set in environment' };
    }
    return { status: 'absent' };
  },

  async prompt(ctx) {
    const mode = await ctx.select('Claude authentication', [
      { value: 'oauth', label: 'Anthropic OAuth (already ran `claude login`)' },
      { value: 'api-key', label: 'Supply ANTHROPIC_API_KEY' },
      { value: 'provider', label: 'Third-party base URL (Kimi, OpenRouter, etc.)' },
    ]);

    const config = { defaultProviderId: 'claude-code' as const };

    if (mode === 'oauth') {
      return { env: {}, config };
    }
    if (mode === 'api-key') {
      const key = await ctx.password('ANTHROPIC_API_KEY');
      return { env: { ANTHROPIC_API_KEY: key }, config };
    }
    const baseUrl = await ctx.text('ANTHROPIC_BASE_URL');
    const authToken = await ctx.password('ANTHROPIC_AUTH_TOKEN');
    const model = await ctx.text('ANTHROPIC_MODEL（optional）', { optional: true });
    return {
      env: {
        ANTHROPIC_BASE_URL: baseUrl,
        ANTHROPIC_AUTH_TOKEN: authToken,
        ANTHROPIC_MODEL: model,
      },
      config,
    };
  },
};
