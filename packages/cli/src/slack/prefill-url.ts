import type { SlackManifest } from './manifest-template.js';

const MAX_URL_LEN = 8000;

export type PrefillUrlResult =
  | { kind: 'url'; url: string }
  | { kind: 'too-long'; reason: 'manifest encoded URL exceeds 8KB' };

export function buildPrefillUrl(manifest: SlackManifest): PrefillUrlResult {
  const json = JSON.stringify(manifest);
  const encoded = encodeURIComponent(json);
  const url = `https://api.slack.com/apps?new_app=1&manifest_json=${encoded}`;
  if (url.length > MAX_URL_LEN) {
    return { kind: 'too-long', reason: 'manifest encoded URL exceeds 8KB' };
  }
  return { kind: 'url', url };
}
