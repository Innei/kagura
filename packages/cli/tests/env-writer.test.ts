import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { writeEnvFile } from '../src/config/env-writer.js';

describe('writeEnvFile', () => {
  let tmp: string;
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kagura-envw-'));
  });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it('creates a new file with given keys', () => {
    const file = path.join(tmp, '.env');
    writeEnvFile(file, { REPO_ROOT_DIR: '/r', SLACK_BOT_TOKEN: 'xoxb-1' });
    expect(fs.readFileSync(file, 'utf8')).toBe('REPO_ROOT_DIR=/r\nSLACK_BOT_TOKEN=xoxb-1\n');
  });

  it('preserves comments and order, updates existing keys in place', () => {
    const file = path.join(tmp, '.env');
    fs.writeFileSync(
      file,
      ['# Slack', 'SLACK_BOT_TOKEN=old', '', '# Repo', 'REPO_ROOT_DIR=/a'].join('\n') + '\n',
    );
    writeEnvFile(file, { SLACK_APP_TOKEN: 'xapp-1', SLACK_BOT_TOKEN: 'xoxb-new' });
    expect(fs.readFileSync(file, 'utf8')).toBe(
      [
        '# Slack',
        'SLACK_BOT_TOKEN=xoxb-new',
        '',
        '# Repo',
        'REPO_ROOT_DIR=/a',
        'SLACK_APP_TOKEN=xapp-1',
      ].join('\n') + '\n',
    );
  });

  it('quotes values that contain spaces or special chars', () => {
    const file = path.join(tmp, '.env');
    writeEnvFile(file, { X: 'has space', Y: 'no-space' });
    const out = fs.readFileSync(file, 'utf8');
    expect(out).toContain('X="has space"');
    expect(out).toContain('Y=no-space');
  });

  it('skips keys with undefined value', () => {
    const file = path.join(tmp, '.env');
    writeEnvFile(file, { A: 'v', B: undefined });
    expect(fs.readFileSync(file, 'utf8')).toBe('A=v\n');
  });
});
