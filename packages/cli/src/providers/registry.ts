import { claudeProvider } from './claude.js';
import { codexProvider } from './codex.js';
import type { ProviderId, ProviderSetup } from './types.js';

const byId: Record<ProviderId, ProviderSetup> = {
  'claude-code': claudeProvider,
  'codex-cli': codexProvider,
};

export function listProviders(): ProviderSetup[] {
  return Object.values(byId).sort((a, b) => a.order - b.order);
}

export function getProvider(id: ProviderId): ProviderSetup {
  const p = byId[id];
  if (!p) throw new Error(`Unknown provider: ${id}`);
  return p;
}
