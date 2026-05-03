import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Plugin } from 'vite';

const MOCK_EXECUTION_ID = 'mock-review';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');

const changedFiles = [
  {
    path: 'apps/kagura/src/slack/ingress/conversation-pipeline.ts',
    status: 'M',
    additions: 6,
    deletions: 1,
  },
  {
    path: 'apps/kagura/src/slack/ingress/activity-sink.ts',
    status: 'M',
    additions: 9,
    deletions: 2,
  },
  {
    path: 'apps/kagura/src/slack/render/slack-renderer.ts',
    status: 'M',
    additions: 17,
    deletions: 2,
  },
  { path: 'apps/kagura/src/web/review-panel.ts', status: 'M', additions: 5, deletions: 0 },
  { path: 'apps/web/src/main.tsx', status: 'M', additions: 8, deletions: 1 },
  { path: 'apps/web/src/styles.css.ts', status: 'M', additions: 4, deletions: 1 },
  { path: 'apps/web/src/mock-review-panel.tsx', status: 'A', additions: 24, deletions: 0 },
  { path: 'apps/web/src/lib/review-api.ts', status: 'A', additions: 18, deletions: 0 },
  { path: 'apps/web/src/legacy-diff-view.tsx', status: 'D', additions: 0, deletions: 9 },
  { path: 'apps/web/src/components/ReviewSidebar.tsx', status: 'R', additions: 1, deletions: 1 },
  { path: 'docs/review-panel.md', status: '??', additions: 16, deletions: 0 },
  { path: 'docs/specs/spec-008-review-panel.md', status: 'A', additions: 20, deletions: 0 },
  { path: 'package.json', status: 'M', additions: 4, deletions: 1 },
  { path: 'pnpm-lock.yaml', status: 'M', additions: 6, deletions: 0 },
];

const mockSession = {
  baseBranch: 'main',
  baseHead: '4f7a2b8',
  changedFiles,
  channelId: 'C0123456789',
  createdAt: '2026-05-02T09:20:00.000Z',
  executionId: MOCK_EXECUTION_ID,
  head: 'a18c0de',
  status: 'running',
  threadTs: '1777713600.000000',
  updatedAt: '2026-05-02T09:25:00.000Z',
  workspaceLabel: 'Kagura Review Panel Mock',
  workspacePath: '/Users/innei/git/kagura-worktrees/slack-cc-bot-review-panel',
  workspaceRepoId: 'kagura',
};

const treePaths = [
  'apps/kagura/package.json',
  'apps/kagura/src/application.ts',
  'apps/kagura/src/review/git-review-service.ts',
  'apps/kagura/src/review/sqlite-review-session-store.ts',
  'apps/kagura/src/slack/ingress/activity-sink.ts',
  'apps/kagura/src/slack/ingress/conversation-dispatch.ts',
  'apps/kagura/src/slack/ingress/conversation-pipeline.ts',
  'apps/kagura/src/slack/render/slack-renderer.ts',
  'apps/kagura/src/web/review-panel.ts',
  'apps/kagura/tests/review-git-service.test.ts',
  'apps/web/index.html',
  'apps/web/mock-review-api.ts',
  'apps/web/package.json',
  'apps/web/src/components/ReviewSidebar.tsx',
  'apps/web/src/legacy-diff-view.tsx',
  'apps/web/src/lib/review-api.ts',
  'apps/web/src/main.tsx',
  'apps/web/src/mock-review-panel.tsx',
  'apps/web/src/styles.css.ts',
  'docs/configuration.md',
  'docs/review-panel.md',
  'docs/specs/spec-008-review-panel.md',
  'package.json',
  'pnpm-lock.yaml',
  'README.md',
].sort();

const mockTree = treePaths.map((path) => ({
  path,
  status: changedFiles.find((file) => file.path === path)?.status,
  type: 'file' as const,
}));

const fileDiffs = new Map([
  [
    'apps/kagura/src/slack/ingress/conversation-pipeline.ts',
    `diff --git a/apps/kagura/src/slack/ingress/conversation-pipeline.ts b/apps/kagura/src/slack/ingress/conversation-pipeline.ts
index 9cf41a2..d2ab4f0 100644
--- a/apps/kagura/src/slack/ingress/conversation-pipeline.ts
+++ b/apps/kagura/src/slack/ingress/conversation-pipeline.ts
@@ -42,7 +42,12 @@ export async function dispatchConversation(input: ConversationInput) {
   const normalized = normalizeSlackMessage(input.event);
   const workspace = await resolveWorkspace(normalized, input.context);
 
-  return runAgentSession({ normalized, workspace });
+  const reviewSession = await maybeStartReviewSession({
+    normalized,
+    workspace,
+    providerId: input.provider.id,
+  });
+  return runAgentSession({ normalized, reviewSession, workspace });
 }
 
 function shouldIgnoreMessage(event: SlackMessageEvent) {
@@ -86,6 +91,9 @@ function shouldIgnoreMessage(event: SlackMessageEvent) {
   if (event.subtype === 'message_deleted') return true;
   if (event.hidden) return true;
 
+  // Review panel links are emitted from execution events, not direct ingress.
+  if (event.bot_id && !event.thread_ts) return true;
+
   return false;
 }`,
  ],
  [
    'apps/kagura/src/slack/ingress/activity-sink.ts',
    `diff --git a/apps/kagura/src/slack/ingress/activity-sink.ts b/apps/kagura/src/slack/ingress/activity-sink.ts
index 17f521e..8adfce4 100644
--- a/apps/kagura/src/slack/ingress/activity-sink.ts
+++ b/apps/kagura/src/slack/ingress/activity-sink.ts
@@ -712,11 +712,18 @@ export function createActivitySink(options: ActivitySinkOptions) {
       if (!reviewPanel || event.type !== 'execution_completed') return;
       const reviewUrl = reviewPanel.getReviewUrl(event.executionId);
 
-      await renderer.postReviewPanelLink(client, channel, threadTs, reviewUrl);
+      await renderer.postReviewPanelLink(client, channel, threadTs, reviewUrl, {
+        changedFiles: event.changedFiles.length,
+        status: event.status,
+        workspaceLabel: event.workspaceLabel,
+      });
     } catch (err) {
-      logger.warn('Failed to post review panel link: %s', String(err));
+      logger.warn(
+        'Failed to post review panel link for execution %s: %s',
+        event.executionId,
+        String(err),
+      );
     }
   }
 }`,
  ],
  [
    'apps/kagura/src/slack/render/slack-renderer.ts',
    `diff --git a/apps/kagura/src/slack/render/slack-renderer.ts b/apps/kagura/src/slack/render/slack-renderer.ts
index 55369cd..c06ff83 100644
--- a/apps/kagura/src/slack/render/slack-renderer.ts
+++ b/apps/kagura/src/slack/render/slack-renderer.ts
@@ -535,12 +535,27 @@ export class SlackRenderer {
   async postReviewPanelLink(
     client: WebClient,
     channel: string,
     threadTs: string,
     reviewUrl: string,
+    metadata?: {
+      changedFiles?: number | undefined;
+      status?: string | undefined;
+      workspaceLabel?: string | undefined;
+    },
   ): Promise<void> {
+    const context = [
+      metadata?.workspaceLabel,
+      metadata?.changedFiles === undefined ? undefined : \`\${metadata.changedFiles} changed files\`,
+      metadata?.status,
+    ]
+      .filter(Boolean)
+      .join(' · ');
+
     await guardedSlackCall('chat.postMessage(review-panel-link)', () =>
       client.chat.postMessage({
         channel,
-        text: \`Review changes: \${reviewUrl}\`,
+        text: context ? \`Review changes (\${context}): \${reviewUrl}\` : \`Review changes: \${reviewUrl}\`,
         thread_ts: threadTs,
       }),
     );
   }`,
  ],
  [
    'apps/kagura/src/web/review-panel.ts',
    `diff --git a/apps/kagura/src/web/review-panel.ts b/apps/kagura/src/web/review-panel.ts
index 6b5d4d1..f01c6a8 100644
--- a/apps/kagura/src/web/review-panel.ts
+++ b/apps/kagura/src/web/review-panel.ts
@@ -89,7 +89,12 @@ async function serveReviewPanelApi(
   if (resource === 'tree') {
     const entries = await reviewGitService.listTree(session.workspacePath, session.head);
     responseJson(response, 200, { entries });
     return;
   }
 
+  if (resource === 'changed-files') {
+    responseJson(response, 200, { files: session.changedFiles });
+    return;
+  }
+
   if (resource === 'diff') {
     const path = url.searchParams.get('path') ?? undefined;
     const diff = await reviewGitService.getDiff(session.workspacePath, session.baseHead, session.head, path);`,
  ],
  [
    'apps/web/src/main.tsx',
    `diff --git a/apps/web/src/main.tsx b/apps/web/src/main.tsx
index 2086f2e..b4c1f9a 100644
--- a/apps/web/src/main.tsx
+++ b/apps/web/src/main.tsx
@@ -36,7 +36,8 @@ const executionId = getExecutionId();
 function App() {
   const [session, setSession] = useState<ReviewSession | undefined>();
   const [treeEntries, setTreeEntries] = useState<ReviewTreeEntry[]>([]);
-  const [selectedPath, setSelectedPath] = useState<string | undefined>();
+  const [selectedPath, setSelectedPath] = useState<string | undefined>(
+    () => new URLSearchParams(window.location.search).get('path') ?? undefined,
+  );
   const [diff, setDiff] = useState('');
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState<string | undefined>();
@@ -91,6 +92,12 @@ function ReviewLayout() {
         <div className={styles.toolbar}>
+          <button className={styles.toolbarButton} type="button" onClick={() => navigator.clipboard.writeText(location.href)}>
+            Copy Link
+          </button>
+          <button className={styles.toolbarButton} type="button" onClick={() => window.open(session.workspacePath)}>
+            Open Workspace
+          </button>
           <button
             className={styles.toolbarButton}
             type="button"`,
  ],
  [
    'apps/web/src/styles.css.ts',
    `diff --git a/apps/web/src/styles.css.ts b/apps/web/src/styles.css.ts
index 7afcf76..bf3f2b9 100644
--- a/apps/web/src/styles.css.ts
+++ b/apps/web/src/styles.css.ts
@@ -69,7 +69,9 @@ export const sidebarSection = style({
 export const treeSection = style([
   sidebarSection,
   {
     display: 'grid',
-    gridTemplateRows: 'auto minmax(0, 1fr)',
+    gridTemplateRows: 'auto minmax(0, 1fr)',
+    minHeight: 220,
+    overflow: 'hidden',
   },
 ]);
@@ -167,6 +169,8 @@ export const toolbarLabel = style({
   color: colors.muted,
   minWidth: 0,
   overflow: 'hidden',
+  direction: 'rtl',
+  textAlign: 'left',
   textOverflow: 'ellipsis',
   whiteSpace: 'nowrap',
 });`,
  ],
  [
    'apps/web/src/mock-review-panel.tsx',
    `diff --git a/apps/web/src/mock-review-panel.tsx b/apps/web/src/mock-review-panel.tsx
new file mode 100644
--- /dev/null
+++ b/apps/web/src/mock-review-panel.tsx
@@ -0,0 +1,34 @@
+import { useEffect, useState } from 'react';
+
+export function MockReviewPanelBadge() {
+  const [visible, setVisible] = useState(import.meta.env.DEV);
+
+  useEffect(() => {
+    if (!visible) return;
+    const id = window.setTimeout(() => setVisible(false), 8000);
+    return () => window.clearTimeout(id);
+  }, [visible]);
+
+  if (!visible) return null;
+
+  return (
+    <div role="status">
+      Mock review data is active.
+    </div>
+  );
+}
+
+export function formatMockReviewLabel(fileCount: number) {
+  if (fileCount === 0) return 'No changed files';
+  if (fileCount === 1) return '1 changed file';
+  return \`\${fileCount} changed files\`;
+}`,
  ],
  [
    'apps/web/src/lib/review-api.ts',
    `diff --git a/apps/web/src/lib/review-api.ts b/apps/web/src/lib/review-api.ts
new file mode 100644
--- /dev/null
+++ b/apps/web/src/lib/review-api.ts
@@ -0,0 +1,32 @@
+export async function getJson<T>(url: string): Promise<T> {
+  const response = await fetch(url);
+  if (!response.ok) {
+    throw new Error(await response.text());
+  }
+  return (await response.json()) as T;
+}
+
+export function reviewSessionUrl(executionId: string): string {
+  return \`/api/reviews/\${encodeURIComponent(executionId)}\`;
+}
+
+export function reviewDiffUrl(executionId: string, path?: string | undefined): string {
+  const suffix = path ? \`?path=\${encodeURIComponent(path)}\` : '';
+  return \`/api/reviews/\${encodeURIComponent(executionId)}/diff\${suffix}\`;
+}`,
  ],
  [
    'apps/web/src/legacy-diff-view.tsx',
    `diff --git a/apps/web/src/legacy-diff-view.tsx b/apps/web/src/legacy-diff-view.tsx
deleted file mode 100644
index 4f30cab..0000000
--- a/apps/web/src/legacy-diff-view.tsx
+++ /dev/null
@@ -1,20 +0,0 @@
-export function LegacyDiffView({ diff }: { diff: string }) {
-  return (
-    <pre>
-      {diff}
-    </pre>
-  );
-}
-
-export function splitLegacyPatch(diff: string): string[] {
-  return diff.split('diff --git ').filter(Boolean);
-}`,
  ],
  [
    'apps/web/src/components/ReviewSidebar.tsx',
    `diff --git a/apps/web/src/sidebar/ReviewSidebar.tsx b/apps/web/src/components/ReviewSidebar.tsx
similarity index 82%
rename from apps/web/src/sidebar/ReviewSidebar.tsx
rename to apps/web/src/components/ReviewSidebar.tsx
index fda7281..3360f45 100644
--- a/apps/web/src/sidebar/ReviewSidebar.tsx
+++ b/apps/web/src/components/ReviewSidebar.tsx
@@ -10,7 +10,7 @@ export function ReviewSidebar({ files }: ReviewSidebarProps) {
   return (
     <aside>
       {files.map((file) => (
-        <button key={file.path}>{file.path}</button>
+        <button key={file.path} title={file.path}>{file.path}</button>
       ))}
     </aside>
   );
 }`,
  ],
  [
    'docs/review-panel.md',
    `diff --git a/docs/review-panel.md b/docs/review-panel.md
new file mode 100644
--- /dev/null
+++ b/docs/review-panel.md
@@ -0,0 +1,16 @@
+# Review Panel Development
+
+Run the bot API and Vite UI together during development.
+
+The mock route is available at /reviews/mock-review.
+The Vite server proxies real API traffic to the bot review API.
+Use KAGURA_REVIEW_PANEL_BASE_URL to control links posted to Slack.
+
+## Debug Checklist
+
+- Confirm the sidebar handles long paths.
+- Select added, deleted, renamed, modified, and untracked files.
+- Verify full diff mode remains readable with many patches.
+- Resize the browser under 760px wide.
+- Check that an empty per-file diff renders the empty state.
+- Confirm the tree keeps folder expansion stable.`,
  ],
  [
    'docs/specs/spec-008-review-panel.md',
    `diff --git a/docs/specs/spec-008-review-panel.md b/docs/specs/spec-008-review-panel.md
new file mode 100644
--- /dev/null
+++ b/docs/specs/spec-008-review-panel.md
@@ -0,0 +1,20 @@
+# Spec 008: Review Panel
+
+The review panel is a read-only web view for inspecting changes produced by an agent run.
+
+## Goals
+
+- Show the exact workspace and execution being reviewed.
+- Provide fast navigation between changed files and the complete file tree.
+- Render unified diffs without requiring Slack users to clone the repository.
+- Keep generated links stable for the lifetime of the review session.
+
+## Non-goals
+
+- Editing files from the browser.
+- Running tests from the browser.
+- Posting arbitrary Slack messages from the browser.`,
  ],
  [
    'package.json',
    `diff --git a/package.json b/package.json
index ce48b2d..a492c38 100644
--- a/package.json
+++ b/package.json
@@ -6,7 +6,9 @@
   "scripts": {
     "build": "pnpm -r build",
     "dev": "pnpm --filter @kagura/app dev",
-    "typecheck": "pnpm -r typecheck"
+    "typecheck": "pnpm -r typecheck",
+    "web:dev": "pnpm --filter @kagura/web dev",
+    "web:mock": "pnpm --filter @kagura/web dev:mock"
   },
   "packageManager": "pnpm@10.25.0"
 }`,
  ],
  [
    'pnpm-lock.yaml',
    `diff --git a/pnpm-lock.yaml b/pnpm-lock.yaml
index bcc7321..ebc9112 100644
--- a/pnpm-lock.yaml
+++ b/pnpm-lock.yaml
@@ -72,6 +72,9 @@ importers:
       vite:
         specifier: 8.0.10
         version: 8.0.10
+      tiny-invariant:
+        specifier: ^1.3.3
+        version: 1.3.3
 
 packages:
 
@@ -304,6 +307,9 @@ packages:
   vite@8.0.10:
     resolution: {integrity: sha512-demo}
 
+  tiny-invariant@1.3.3:
+    resolution: {integrity: sha512-mock}
+
 snapshots:
 
   vite@8.0.10: {}`,
  ],
]);

const fullDiff = [...fileDiffs.values()].join('\n');

const mockFileContents = new Map([
  [
    'apps/web/src/main.tsx',
    `import { StrictMode, useEffect, useMemo, useState } from 'react';

export function App() {
  const [selectedPath, setSelectedPath] = useState<string | undefined>(
    () => new URLSearchParams(window.location.search).get('path') ?? undefined,
  );

  useEffect(() => {
    if (!selectedPath) return;
    window.history.replaceState(null, '', \`?path=\${encodeURIComponent(selectedPath)}\`);
  }, [selectedPath]);

  return <ReviewLayout selectedPath={selectedPath} onSelectPath={setSelectedPath} />;
}
`,
  ],
  [
    'docs/review-panel.md',
    `# Review Panel Development

Run the bot API and Vite UI together during development.

The mock route is available at /reviews/mock-review.
The Vite server proxies real API traffic to the bot review API.
Use KAGURA_REVIEW_PANEL_BASE_URL to control links posted to Slack.
`,
  ],
]);

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

        const resource = match[2] ?? 'session';
        if (resource === 'session') {
          sendJson(response, 200, mockSession);
          return;
        }

        if (resource === 'tree') {
          sendJson(response, 200, { entries: mockTree });
          return;
        }

        if (resource === 'diff') {
          const path = url.searchParams.get('path');
          sendJson(response, 200, { diff: path ? (fileDiffs.get(path) ?? '') : fullDiff });
          return;
        }

        if (resource === 'file') {
          const filePath = url.searchParams.get('path') ?? '';
          const real = await readRepoFile(filePath);
          const explicit = real ?? mockFileContents.get(filePath);
          const fromDiff =
            !explicit && filePath && fileDiffs.has(filePath)
              ? reconstructHeadFromDiff(fileDiffs.get(filePath) ?? '')
              : undefined;
          const fallback = `// Mock source for ${filePath || 'unknown file'}\n// File not found in repo working tree.\n`;
          sendJson(response, 200, {
            content: explicit ?? fromDiff ?? fallback,
            path: filePath,
          });
          return;
        }

        sendJson(response, 404, { error: 'Not Found' });
      });
    },
    name: 'kagura-mock-review-api',
  };
}

async function readRepoFile(rel: string): Promise<string | undefined> {
  if (!rel || rel.includes('..') || path.isAbsolute(rel)) return undefined;
  const abs = path.resolve(REPO_ROOT, rel);
  if (!abs.startsWith(REPO_ROOT + path.sep) && abs !== REPO_ROOT) return undefined;
  try {
    return await readFile(abs, 'utf8');
  } catch {
    return undefined;
  }
}

const HUNK_HEADER_RE = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

function reconstructHeadFromDiff(diff: string): string {
  if (!diff.trim()) return '';
  const lines = diff.split('\n');
  const out = new Map<number, string>();
  let cursor = 0;
  for (const line of lines) {
    if (
      line.startsWith('diff --git') ||
      line.startsWith('index ') ||
      line.startsWith('--- ') ||
      line.startsWith('+++ ') ||
      line.startsWith('Binary files')
    ) {
      continue;
    }
    const match = HUNK_HEADER_RE.exec(line);
    if (match) {
      const start = Number.parseInt(match[1] ?? '0', 10);
      cursor = Number.isFinite(start) ? start : 0;
      continue;
    }
    if (cursor === 0) continue;
    if (line.startsWith('+')) {
      out.set(cursor, line.slice(1));
      cursor += 1;
    } else if (line.startsWith('-')) {
      // not in head
    } else if (line.startsWith('\\')) {
      // newline marker
    } else {
      out.set(cursor, line.startsWith(' ') ? line.slice(1) : line);
      cursor += 1;
    }
  }
  if (out.size === 0) return '';
  const max = Math.max(...out.keys());
  const result: string[] = [];
  for (let i = 1; i <= max; i++) {
    result.push(out.get(i) ?? '  // …');
  }
  return result.join('\n');
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
