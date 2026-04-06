import type { SlashCommandResponse } from './types.js';

declare const __GIT_HASH__: string;
declare const __GIT_COMMIT_DATE__: string;

const deployedAt = new Date().toISOString();

export function handleVersionCommand(): SlashCommandResponse {
  const hash = typeof __GIT_HASH__ !== 'undefined' ? __GIT_HASH__ : 'unknown';
  const commitDate = typeof __GIT_COMMIT_DATE__ !== 'undefined' ? __GIT_COMMIT_DATE__ : 'unknown';
  const short = hash.length >= 7 ? hash.slice(0, 7) : hash;

  const lines = [
    '*Bot Version*',
    '',
    `• *Commit:* \`${short}\` (${hash})`,
    `• *Commit Date:* ${commitDate}`,
    `• *Deploy Date:* ${deployedAt}`,
  ];

  return {
    response_type: 'ephemeral',
    text: lines.join('\n'),
  };
}
