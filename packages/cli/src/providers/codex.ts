import type { ProviderSetup } from './types.js';

export const codexProvider: ProviderSetup = {
  id: 'codex-cli',
  label: 'Codex CLI (OpenAI)',
  order: 20,
  async detect() {
    return { status: 'absent' };
  },
  async prompt() {
    return {};
  },
};
