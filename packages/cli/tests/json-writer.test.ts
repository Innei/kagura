import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { writeConfigJson } from '../src/config/json-writer.js';

describe('writeConfigJson', () => {
  let tmp: string;
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kagura-json-'));
  });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it('writes a new file with 2-space indent', () => {
    const file = path.join(tmp, 'config.json');
    writeConfigJson(file, { defaultProviderId: 'codex-cli' });
    expect(fs.readFileSync(file, 'utf8')).toBe('{\n  "defaultProviderId": "codex-cli"\n}\n');
  });

  it('deep-merges into existing file, preserving unrelated keys', () => {
    const file = path.join(tmp, 'config.json');
    fs.writeFileSync(
      file,
      JSON.stringify({ claude: { model: 'old' }, logLevel: 'info' }, null, 2) + '\n',
    );
    writeConfigJson(file, { claude: { permissionMode: 'acceptEdits' }, repoRootDir: '/r' });
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(parsed).toEqual({
      claude: { model: 'old', permissionMode: 'acceptEdits' },
      logLevel: 'info',
      repoRootDir: '/r',
    });
  });

  it('prunes undefined values from patch', () => {
    const file = path.join(tmp, 'config.json');
    fs.writeFileSync(file, JSON.stringify({ logLevel: 'info' }, null, 2) + '\n');
    writeConfigJson(file, { logLevel: undefined, repoRootDir: '/r' });
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(parsed).toEqual({ logLevel: 'info', repoRootDir: '/r' });
  });
});
