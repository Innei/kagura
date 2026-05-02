import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createDatabase } from '~/db/index.js';
import { GitReviewService, resolveGitHead } from '~/review/git-review-service.js';
import { SqliteReviewSessionStore } from '~/review/sqlite-review-session-store.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { force: true, recursive: true });
  }
});

describe('GitReviewService', () => {
  it('lists changed files and renders tracked plus untracked diffs', () => {
    const workspacePath = createGitFixture();
    const baseHead = resolveGitHead(workspacePath);
    expect(baseHead).toBeTruthy();

    fs.writeFileSync(path.join(workspacePath, 'src/index.ts'), 'export const value = 2;\n');
    fs.writeFileSync(path.join(workspacePath, 'src/new.ts'), 'export const added = true;\n');

    const dbPath = path.join(createTempDir(), 'sessions.db');
    const { db, sqlite } = createDatabase(dbPath);
    const store = new SqliteReviewSessionStore(db);
    store.start({
      baseBranch: 'main',
      baseHead,
      channelId: 'C1',
      createdAt: new Date().toISOString(),
      executionId: 'exec-1',
      threadTs: '123.456',
      workspaceLabel: 'fixture',
      workspacePath,
      workspaceRepoId: 'fixture',
    });

    const service = new GitReviewService(store);
    const session = service.getSession('exec-1');
    expect(session?.changedFiles).toEqual([
      { path: 'src/index.ts', status: 'M' },
      { path: 'src/new.ts', status: '??' },
    ]);

    expect(service.listTree('exec-1')).toContainEqual({
      path: 'src/new.ts',
      status: '??',
      type: 'file',
    });

    const fullDiff = service.getDiff('exec-1') ?? '';
    expect(fullDiff).toContain('diff --git a/src/index.ts b/src/index.ts');
    expect(fullDiff).toContain('diff --git a/src/new.ts b/src/new.ts');
    expect(fullDiff).toContain('+export const added = true;');

    sqlite.close();
  });
});

function createGitFixture(): string {
  const dir = createTempDir();
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src/index.ts'), 'export const value = 1;\n');
  git(dir, ['init', '-b', 'main']);
  git(dir, ['config', 'user.email', 'test@example.com']);
  git(dir, ['config', 'user.name', 'Test User']);
  git(dir, ['add', '.']);
  git(dir, ['commit', '-m', 'initial']);
  return dir;
}

function createTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kagura-review-'));
  tempDirs.push(dir);
  return dir;
}

function git(cwd: string, args: string[]): void {
  execFileSync('git', ['-c', 'commit.gpgsign=false', ...args], {
    cwd,
    env: {
      ...process.env,
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_AUTHOR_NAME: 'Test User',
      GIT_COMMITTER_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'Test User',
    },
    stdio: 'ignore',
  });
}
