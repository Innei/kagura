import { execSync } from 'node:child_process';

import type { SlashCommandResponse } from './types.js';

let cachedVersion: string | undefined;

function getGitHash(): string {
  if (cachedVersion) return cachedVersion;
  try {
    cachedVersion = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    cachedVersion = 'unknown';
  }
  return cachedVersion;
}

export function handleVersionCommand(): SlashCommandResponse {
  const hash = getGitHash();
  const short = hash.length >= 7 ? hash.slice(0, 7) : hash;

  return {
    response_type: 'ephemeral',
    text: `*Bot Version*\n\n• *Commit:* \`${short}\` (${hash})`,
  };
}
