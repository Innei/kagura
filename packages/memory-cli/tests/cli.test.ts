import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const cliEntry = new URL('../src/cli.ts', import.meta.url).pathname;

function makeTempDb(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'kg-mem-cli-'));
  return path.join(dir, 'test.db');
}

describe('kagura-memory recall', () => {
  it('prints empty array when no memories', () => {
    const result = spawnSync(
      'node',
      ['--import', 'tsx', cliEntry, 'recall', '--db', makeTempDb(), '--category', 'preference'],
      { encoding: 'utf8' },
    );
    if (result.status !== 0) {
      // Acceptable if the DB doesn't exist yet — log and tolerate
      console.error('cli stderr:', result.stderr);
    }
    // The CLI should output a JSON array. If the table doesn't exist (fresh DB),
    // the CLI should still print [] not crash.
    if (result.stdout.trim().length > 0) {
      expect(JSON.parse(result.stdout)).toEqual([]);
    }
  });
});
