import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

const cliEntry = new URL('../src/cli.ts', import.meta.url).pathname;

function makeTempDb(): string {
  const dir = mkdtempSync(join(tmpdir(), 'kg-mem-cli-save-'));
  const dbPath = join(dir, 'test.db');
  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.exec(`
    CREATE TABLE memories (
      id TEXT PRIMARY KEY,
      repo_id TEXT,
      thread_ts TEXT,
      category TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata TEXT,
      created_at TEXT NOT NULL,
      expires_at TEXT
    );
  `);
  sqlite.close();
  return dbPath;
}

describe('kagura-memory save', () => {
  it('saves a global preference and prints the new record id', () => {
    const dbPath = makeTempDb();
    const result = spawnSync(
      'node',
      [
        '--import',
        'tsx',
        cliEntry,
        'save',
        '--db',
        dbPath,
        '--category',
        'preference',
        '--scope',
        'global',
        '--content',
        'test pref',
      ],
      { encoding: 'utf8' },
    );

    expect(result.status).toBe(0);
    const out = JSON.parse(result.stdout);
    expect(out.id).toBeTruthy();
    expect(out.content).toBe('test pref');
    expect(out.scope).toBe('global');
    expect(out.category).toBe('preference');
  });

  it('rejects workspace scope without repo-id', () => {
    const dbPath = makeTempDb();
    const result = spawnSync(
      'node',
      [
        '--import',
        'tsx',
        cliEntry,
        'save',
        '--db',
        dbPath,
        '--category',
        'context',
        '--scope',
        'workspace',
        '--content',
        'no repo id provided',
      ],
      { encoding: 'utf8' },
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/repo-id/);
  });

  it('saves a workspace memory with repo-id', () => {
    const dbPath = makeTempDb();
    const result = spawnSync(
      'node',
      [
        '--import',
        'tsx',
        cliEntry,
        'save',
        '--db',
        dbPath,
        '--category',
        'context',
        '--scope',
        'workspace',
        '--repo-id',
        'my-repo',
        '--content',
        'workspace fact',
      ],
      { encoding: 'utf8' },
    );

    expect(result.status).toBe(0);
    const out = JSON.parse(result.stdout);
    expect(out.scope).toBe('workspace');
    expect(out.repoId).toBe('my-repo');
    expect(out.content).toBe('workspace fact');
  });
});
