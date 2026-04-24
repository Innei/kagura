import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runCli } from '../src/index.js';

describe('kagura doctor', () => {
  let tmp: string;
  const origEnv = { ...process.env };

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kg-doc-'));
    process.env = { ...origEnv, KAGURA_HOME: tmp };
    for (const k of [
      'SLACK_BOT_TOKEN',
      'SLACK_APP_TOKEN',
      'SLACK_SIGNING_SECRET',
      'REPO_ROOT_DIR',
    ]) {
      delete process.env[k];
    }
  });

  afterEach(() => {
    process.env = { ...origEnv };
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('--json reports missing required keys with exit code 2', async () => {
    const out: string[] = [];
    const write = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string | Uint8Array) => {
      out.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;
    try {
      const code = await runCli(['node', 'kagura', 'doctor', '--json']);
      const parsed = JSON.parse(out.join(''));
      expect(parsed.summary.fail).toBeGreaterThan(0);
      expect(code).toBe(2);
    } finally {
      process.stdout.write = write;
    }
  });
});
