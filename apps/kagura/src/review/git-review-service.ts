import { execFileSync } from 'node:child_process';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

import type { ReviewSessionRecord, ReviewSessionStore } from './types.js';

export interface ReviewChangedFile {
  path: string;
  status: string;
}

export interface ReviewTreeEntry {
  path: string;
  status?: string | undefined;
  type: 'file';
}

export interface ReviewSessionDetails extends ReviewSessionRecord {
  changedFiles: ReviewChangedFile[];
}

export class GitReviewService {
  constructor(private readonly store: ReviewSessionStore) {}

  getSession(executionId: string): ReviewSessionDetails | undefined {
    const session = this.store.get(executionId);
    if (!session) return undefined;

    return {
      ...session,
      changedFiles: getChangedFiles(session),
    };
  }

  listTree(executionId: string): ReviewTreeEntry[] | undefined {
    const session = this.store.get(executionId);
    if (!session) return undefined;

    const statusByPath = new Map(getChangedFiles(session).map((file) => [file.path, file.status]));
    const files = runGit(session.workspacePath, ['ls-files']).split('\n').filter(Boolean);
    for (const file of statusByPath.keys()) {
      if (!files.includes(file)) {
        files.push(file);
      }
    }

    return files
      .sort((left, right) => left.localeCompare(right))
      .map((file) => ({
        path: file,
        type: 'file' as const,
        ...(statusByPath.get(file) ? { status: statusByPath.get(file) } : {}),
      }));
  }

  getDiff(executionId: string, filePath?: string | undefined): string | undefined {
    const session = this.store.get(executionId);
    if (!session) return undefined;

    const args = ['diff', '--no-ext-diff', '--find-renames', session.baseHead ?? 'HEAD'];
    if (filePath) {
      const relativePath = validateRelativeFilePath(filePath);
      if (isUntracked(session, relativePath)) {
        return renderUntrackedFileDiff(session.workspacePath, relativePath);
      }
      args.push('--', relativePath);
    }

    const diff = runGit(session.workspacePath, args);
    if (filePath) {
      return diff;
    }

    const untrackedDiffs = getChangedFiles(session)
      .filter((file) => file.status === '??')
      .map((file) => renderUntrackedFileDiff(session.workspacePath, file.path))
      .filter(Boolean);

    return [diff, ...untrackedDiffs].filter(Boolean).join('\n');
  }

  async getFile(
    executionId: string,
    filePath: string,
  ): Promise<{ content: string; path: string } | undefined> {
    const session = this.store.get(executionId);
    if (!session) return undefined;

    const relativePath = validateRelativeFilePath(filePath);
    const absolutePath = path.resolve(session.workspacePath, relativePath);
    const realWorkspace = await fs.realpath(session.workspacePath);
    const realTarget = await fs.realpath(absolutePath).catch(() => undefined);
    if (!realTarget || !isInside(realWorkspace, realTarget)) {
      return { content: '', path: relativePath };
    }

    const stat = await fs.stat(realTarget);
    if (!stat.isFile()) {
      return { content: '', path: relativePath };
    }

    const content = await fs
      .readFile(realTarget, 'utf8')
      .catch(() => '[binary or unreadable file]');
    return { content, path: relativePath };
  }
}

export function resolveGitHead(workspacePath: string): string | undefined {
  return runGit(workspacePath, ['rev-parse', 'HEAD']) || undefined;
}

export function resolveGitBranch(workspacePath: string): string | undefined {
  return runGit(workspacePath, ['branch', '--show-current']) || undefined;
}

function getChangedFiles(session: ReviewSessionRecord): ReviewChangedFile[] {
  const base = session.baseHead ?? 'HEAD';
  const nameStatus = runGit(session.workspacePath, [
    'diff',
    '--name-status',
    '--find-renames',
    base,
  ])
    .split('\n')
    .filter(Boolean);
  const changed = nameStatus
    .map(parseNameStatus)
    .filter((entry): entry is ReviewChangedFile => Boolean(entry));
  const seen = new Set(changed.map((entry) => entry.path));

  for (const statusEntry of runGit(session.workspacePath, ['status', '--porcelain=v1']).split(
    '\n',
  )) {
    if (!statusEntry.trim()) continue;
    const filePath = parsePorcelainPath(statusEntry);
    if (!filePath || seen.has(filePath)) continue;
    changed.push({ path: filePath, status: statusEntry.slice(0, 2).trim() || '?' });
    seen.add(filePath);
  }

  return changed.sort((left, right) => left.path.localeCompare(right.path));
}

function parseNameStatus(line: string): ReviewChangedFile | undefined {
  const parts = line.split('\t');
  const status = parts[0];
  const filePath = parts.at(-1);
  if (!status || !filePath) return undefined;
  return { path: filePath, status };
}

function parsePorcelainPath(line: string): string | undefined {
  const raw = line.slice(3);
  if (!raw) return undefined;
  const renamed = raw.split(' -> ').at(-1);
  return renamed?.replaceAll(/^"|"$/g, '');
}

function isUntracked(session: ReviewSessionRecord, filePath: string): boolean {
  return getChangedFiles(session).some((file) => file.path === filePath && file.status === '??');
}

function renderUntrackedFileDiff(workspacePath: string, filePath: string): string {
  const absolutePath = path.resolve(workspacePath, filePath);
  let content: string;
  try {
    if (!fsSync.statSync(absolutePath).isFile()) return '';
    content = fsSync.readFileSync(absolutePath, 'utf8');
  } catch {
    return `diff --git a/${filePath} b/${filePath}\nnew file mode 100644\nBinary files /dev/null and b/${filePath} differ`;
  }

  const lines = content.split('\n');
  if (lines.at(-1) === '') lines.pop();
  return [
    `diff --git a/${filePath} b/${filePath}`,
    'new file mode 100644',
    '--- /dev/null',
    `+++ b/${filePath}`,
    `@@ -0,0 +1,${lines.length} @@`,
    ...lines.map((line) => `+${line}`),
  ].join('\n');
}

function runGit(cwd: string, args: string[]): string {
  try {
    return execFileSync('git', ['-C', cwd, ...args], {
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
      timeout: 10_000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trimEnd();
  } catch {
    return '';
  }
}

function validateRelativeFilePath(filePath: string): string {
  const normalized = path.posix.normalize(filePath.replaceAll(path.sep, '/'));
  if (
    !normalized ||
    normalized === '.' ||
    normalized.startsWith('../') ||
    path.isAbsolute(filePath)
  ) {
    throw new Error('Invalid file path.');
  }
  return normalized;
}

function isInside(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return !relative.startsWith('..') && !path.isAbsolute(relative);
}
