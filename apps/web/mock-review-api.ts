import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Plugin } from 'vite';

const MOCK_EXECUTION_ID = 'mock-review';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const DEFAULT_BASE_REF = process.env.KAGURA_WEB_MOCK_BASE_REF ?? 'HEAD~10';

let resolvedBaseHead: string | undefined;
let resolvedBaseLabel: string | undefined;

function resolveBaseHead(): string {
  if (resolvedBaseHead) return resolvedBaseHead;
  const sha = git(['rev-parse', DEFAULT_BASE_REF]).trim();
  if (!sha) {
    throw new Error(
      `Unable to resolve mock baseHead from ${DEFAULT_BASE_REF}. Set KAGURA_WEB_MOCK_BASE_REF to a valid commit-ish.`,
    );
  }
  resolvedBaseHead = sha;
  resolvedBaseLabel = DEFAULT_BASE_REF;
  return sha;
}

function git(args: string[]): string {
  try {
    return execFileSync('git', ['-C', REPO_ROOT, ...args], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return '';
  }
}

function gitTrim(args: string[]): string {
  return git(args).trimEnd();
}

interface ChangedFile {
  additions: number;
  deletions: number;
  path: string;
  status: string;
}

function listChangedFiles(baseHead: string): ChangedFile[] {
  const nameStatus = gitTrim(['diff', '--name-status', '--find-renames', baseHead])
    .split('\n')
    .filter(Boolean);
  const numstat = gitTrim(['diff', '--numstat', '--find-renames', baseHead])
    .split('\n')
    .filter(Boolean);

  const stats = new Map<string, { additions: number; deletions: number }>();
  for (const line of numstat) {
    const [add, del, ...rest] = line.split('\t');
    if (!add || !del || rest.length === 0) continue;
    const target = rest.at(-1);
    if (!target) continue;
    stats.set(target, {
      additions: add === '-' ? 0 : Number.parseInt(add, 10),
      deletions: del === '-' ? 0 : Number.parseInt(del, 10),
    });
  }

  const changed: ChangedFile[] = nameStatus.map((line) => {
    const parts = line.split('\t');
    const status = parts[0] ?? '?';
    const filePath = parts.at(-1) ?? '';
    const stat = stats.get(filePath) ?? { additions: 0, deletions: 0 };
    return { path: filePath, status, additions: stat.additions, deletions: stat.deletions };
  });

  // git diff <baseHead> already covers staged/unstaged tracked changes — only
  // backfill *untracked* paths from `git status` so we don't surface files that
  // are identical to base after combining staged+unstaged hunks.
  for (const entry of gitTrim(['status', '--porcelain=v1']).split('\n')) {
    if (!entry.trim() || !entry.startsWith('??')) continue;
    const filePath = entry.slice(3).trim().replaceAll(/^"|"$/g, '');
    if (!filePath || changed.some((c) => c.path === filePath)) continue;
    changed.push({ path: filePath, status: '??', additions: 0, deletions: 0 });
  }

  return changed.sort((a, b) => a.path.localeCompare(b.path));
}

function listTree(baseHead: string) {
  const tracked = gitTrim(['ls-files']).split('\n').filter(Boolean);
  const seen = new Set(tracked);
  const changed = listChangedFiles(baseHead);
  for (const c of changed) {
    if (!seen.has(c.path)) tracked.push(c.path);
    seen.add(c.path);
  }
  return tracked
    .sort((a, b) => a.localeCompare(b))
    .map((filePath) => {
      const change = changed.find((c) => c.path === filePath);
      return {
        path: filePath,
        type: 'file' as const,
        ...(change?.status ? { status: change.status } : {}),
      };
    });
}

function getDiff(baseHead: string, filePath?: string): string {
  const args = ['diff', '--no-ext-diff', '--find-renames', baseHead];
  if (filePath) args.push('--', filePath);
  const tracked = git(args);
  if (filePath && !tracked.trim()) {
    // git diff returns empty in two unrelated cases:
    //   1) the file is tracked AND identical to the base — there is no diff to show.
    //   2) the file is untracked — git diff ignores it; synthesize a new-file patch.
    const isTracked = git(['ls-files', '--error-unmatch', filePath]).trim().length > 0;
    if (isTracked) return '';
    return synthesizeUntrackedDiff(filePath);
  }
  return tracked;
}

function synthesizeUntrackedDiff(filePath: string): string {
  try {
    const abs = path.resolve(REPO_ROOT, filePath);
    if (!abs.startsWith(REPO_ROOT + path.sep)) return '';
    const buffer = readFileSync(abs, 'utf8');
    if (!buffer) return '';
    const lines = buffer.split('\n');
    if (lines.at(-1) === '') lines.pop();
    return [
      `diff --git a/${filePath} b/${filePath}`,
      'new file mode 100644',
      '--- /dev/null',
      `+++ b/${filePath}`,
      `@@ -0,0 +1,${lines.length} @@`,
      ...lines.map((line) => `+${line}`),
      '',
    ].join('\n');
  } catch {
    return '';
  }
}

async function getFile(
  baseHead: string,
  filePath: string,
  ref: 'base' | 'head',
): Promise<{ content: string; path: string } | undefined> {
  if (!filePath) return undefined;
  const safePath = path.posix.normalize(filePath.replaceAll(path.sep, '/'));
  if (safePath.startsWith('../') || safePath === '.' || path.isAbsolute(filePath)) {
    return undefined;
  }
  if (ref === 'base') {
    try {
      const content = execFileSync('git', ['-C', REPO_ROOT, 'show', `${baseHead}:${safePath}`], {
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      return { content, path: safePath };
    } catch {
      return undefined;
    }
  }
  const abs = path.resolve(REPO_ROOT, safePath);
  if (!abs.startsWith(REPO_ROOT + path.sep)) return undefined;
  try {
    const content = await fs.readFile(abs, 'utf8');
    return { content, path: safePath };
  } catch {
    return undefined;
  }
}

export function createMockReviewApiPlugin(): Plugin {
  return {
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        if (!request.url?.startsWith('/api/reviews/')) {
          next();
          return;
        }

        const url = new URL(request.url, 'http://127.0.0.1');
        const match = url.pathname.match(/^\/api\/reviews\/([^/]+)(?:\/([^/]+))?$/);
        if (!match) {
          next();
          return;
        }

        const executionId = decodeURIComponent(match[1] ?? '');
        if (executionId !== MOCK_EXECUTION_ID) {
          sendJson(response, 404, { error: `Mock review session not found: ${executionId}` });
          return;
        }

        let baseHead: string;
        try {
          baseHead = resolveBaseHead();
        } catch (err) {
          sendJson(response, 500, { error: String(err) });
          return;
        }

        const resource = match[2] ?? 'session';

        if (resource === 'session') {
          sendJson(response, 200, {
            baseBranch: gitTrim(['symbolic-ref', '--quiet', '--short', 'HEAD']) || 'main',
            baseHead,
            changedFiles: listChangedFiles(baseHead),
            channelId: 'C0123456789',
            createdAt: new Date().toISOString(),
            executionId: MOCK_EXECUTION_ID,
            head: gitTrim(['rev-parse', 'HEAD']),
            status: 'running',
            threadTs: '1777713600.000000',
            workspaceLabel: `Kagura Review (mock · ${resolvedBaseLabel ?? DEFAULT_BASE_REF}..HEAD)`,
            workspacePath: REPO_ROOT,
            workspaceRepoId: 'kagura-mock',
          });
          return;
        }

        if (resource === 'tree') {
          sendJson(response, 200, { entries: listTree(baseHead) });
          return;
        }

        if (resource === 'diff') {
          const filePath = url.searchParams.get('path') ?? undefined;
          sendJson(response, 200, { diff: getDiff(baseHead, filePath) });
          return;
        }

        if (resource === 'file') {
          const filePath = url.searchParams.get('path') ?? '';
          const ref = url.searchParams.get('ref') === 'base' ? 'base' : 'head';
          const file = await getFile(baseHead, filePath, ref);
          if (!file) {
            sendJson(response, 404, { error: `File not found at ${ref}: ${filePath}` });
            return;
          }
          sendJson(response, 200, file);
          return;
        }

        sendJson(response, 404, { error: 'Not Found' });
      });
    },
    name: 'kagura-mock-review-api',
  };
}

function sendJson(
  response: {
    end: (body: string) => void;
    writeHead: (status: number, headers: Record<string, string>) => void;
  },
  status: number,
  body: unknown,
): void {
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(body));
}
