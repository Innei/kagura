import type { ProviderSetup } from './types.js';

export const claudeProvider: ProviderSetup = {
  id: 'claude-code',
  label: 'Claude Code (Anthropic)',
  order: 10,
  async detect() {
    return { status: 'absent' };
  },
  async prompt() {
    return {};
  },
};
