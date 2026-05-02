# Review WebUI: File Explorer + Source View + Diff Expansion

**Date**: 2026-05-03
**Status**: Approved (brainstorm)
**Owner**: Innei

## Summary

Extend the existing review panel web app with three capabilities:

1. **File Explorer tab** in the sidebar — switch between "Changes" (current
   changed-files list) and "Files" (the entire git project tree). Selecting any
   file in the tree opens it in the right pane.
2. **Diff expansion** — replace `PatchDiff` with `MultiFileDiff` so users can
   expand collapsed unchanged context arbitrarily far (Pierre's built-in
   `expandHunk`). The right pane also gains a "Source" tab that jumps to the
   full source file.
3. **Source view with diff gutter** — show the head version of any file with a
   thin colored bar in the leftmost gutter marking added (green) and modified
   (blue) lines, plus small wedges for line removals.

The work also bundles two refactors the user asked for:

- Carve a new `packages/routers` package containing the Hono routes,
  middleware, schemas, and `GitReviewService`. The HTTP server lifecycle stays
  in `apps/kagura/src/web/review-panel.ts` (now a thin `@hono/node-server`
  wrapper).
- Reorganize the web app's API layer into per-resource modules
  (`api/session.ts`, `api/tree.ts`, `api/diff.ts`, `api/file.ts`) on top of an
  `ofetch` instance.

## Goals

- Source-aware navigation: review changed files **and** any unchanged file in
  the same workspace, without leaving the panel.
- Real expansion of unchanged context (not just the 3 lines git emits).
- Clear visual indication of diff state when reading source.
- Cleaner backend boundaries: route + business logic isolated from the kagura
  composition root.
- Sharable, refresh-stable URLs for any reviewer state.

## Non-Goals

- Editing source from the panel.
- Multi-commit history or branch-comparison UI.
- Comments, threads, or any review-action UI on top of the source view.
- Syntax-aware navigation (go-to-definition, etc.).
- Standalone deploy of `packages/routers` as its own process — server lifecycle
  stays embedded in kagura.
- Playwright-driven UI E2E (out of scope for v1; covered by manual + live API
  E2E only).

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      ReviewLayout (root)                        │
│ ┌──────────────────────┬──────────────────────────────────────┐ │
│ │ Sidebar              │ RightPane                            │ │
│ │ ┌────────┬─────────┐ │ ┌────────────────────────────────┐   │ │
│ │ │Changes │  Files  │ │ │ DiffToolbar                    │   │ │
│ │ └────────┴─────────┘ │ │  [Diff|Source]  path  [Split…] │   │ │
│ │ ┌──────────────────┐ │ ├────────────────────────────────┤   │ │
│ │ │  ChangesPanel    │ │ │ DiffStatusBar (only Diff mode) │   │ │
│ │ │   or             │ │ ├────────────────────────────────┤   │ │
│ │ │  ExplorerPanel   │ │ │ DiffView    or   SourceView    │   │ │
│ │ └──────────────────┘ │ │  (MultiFile)     (File + bar)  │   │ │
│ └──────────────────────┴──────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘

           URL: /reviews/:id?tab=changes|files
                              &path=src/x.ts
                              &mode=diff|source
```

URL is the source of truth for `tab`, `path`, and `mode`. Local UI state
(filter, Split/Unified, sidebar collapsed) lives in React/`localStorage`.

## Backend: `packages/routers` extraction + Hono

### New package

```
packages/routers/
  package.json              // name: @kagura/routers
                            // deps: hono, @hono/zod-validator, zod
  tsconfig.json
  src/
    index.ts                // barrel re-exports
    api/
      review.ts             // hono Router: /reviews/:id/{,tree,diff,file}
    assets/
      static.ts             // hono Router: /assets/* + SPA fallback
    middleware/
      logger.ts             // wraps ServerLogger
      base-path.ts          // stripBasePath equivalent
    schemas/
      review-params.ts      // zod schemas for path / revision / executionId
    services/
      git-review-service.ts // moved from apps/kagura/src/review/
      git-utils.ts          // resolveGitHead, resolveGitBranch
    types/
      logger.ts             // ServerLogger interface (info/warn/error)
      review-session.ts     // ReviewSessionStore + ReviewSessionRecord
      review-file.ts        // ReviewFileResponse, ReviewChangedFile, ReviewTreeEntry
  tests/
    review-api.test.ts      // hono app.request() unit tests
    git-review-service.test.ts
    middleware.test.ts
```

Public surface (`packages/routers/src/index.ts`):

```ts
export { createApiRouter } from './api/review.js';
export type { CreateApiRouterOptions } from './api/review.js';
export { createAssetsRouter } from './assets/static.js';
export type { CreateAssetsRouterOptions } from './assets/static.js';

export {
  GitReviewService,
  resolveGitHead,
  resolveGitBranch,
} from './services/git-review-service.js';
export type {
  ReviewSessionStore,
  ReviewSessionRecord,
  ReviewSessionStatus,
  StartReviewSessionInput,
} from './types/review-session.js';
export type {
  ReviewChangedFile,
  ReviewFileResponse,
  ReviewTreeEntry,
} from './types/review-file.js';
export type { ServerLogger } from './types/logger.js';
```

`ServerLogger` is the minimal logger interface the package depends on; the
kagura `AppLogger` satisfies it structurally.

### Hono router

```ts
const router = new Hono();
router.get('/reviews/:id', getSession);
router.get('/reviews/:id/tree', getTree);
router.get('/reviews/:id/diff', zValidator('query', diffQuery), getDiff);
router.get('/reviews/:id/file', zValidator('query', fileQuery), getFile);
router.notFound((c) => c.json({ error: 'Not Found' }, 404));
```

`fileQuery` is `z.object({ path: z.string().min(1), revision: z.enum(['base','head']).default('head') })`.

Path traversal protection lives in `GitReviewService.getFile` (the existing
`validateRelativeFilePath`), so the router stays thin.

### `apps/kagura` impact

```
src/review/
  ✗ git-review-service.ts            // deleted (moved)
  ✗ types.ts                         // deleted (moved)
  sqlite-review-session-store.ts     // import { ReviewSessionStore } from '@kagura/routers'
src/web/
  review-panel.ts                    // rewritten: thin @hono/node-server wrapper
src/slack/
  ingress/conversation-pipeline.ts   // import resolveGitHead/Branch from '@kagura/routers'
  ingress/types.ts                   // import ReviewSessionStore from '@kagura/routers'
  app.ts                             // same
src/application.ts                   // import { GitReviewService } from '@kagura/routers'
package.json                         // add @kagura/routers, hono, @hono/node-server
```

`createReviewPanelServer` keeps the same `ReviewPanelServerOptions` /
`ReviewPanelServer` shape, so `application.ts` doesn't need wiring changes.

### File endpoint behavior

| revision         | implementation                                | response                              |
| ---------------- | --------------------------------------------- | ------------------------------------- |
| `head` (default) | `fs.readFile(workspacePath/path)` (worktree)  | `{ content, path, revision: 'head' }` |
| `base`           | `git -C workspacePath show <baseHead>:<path>` | `{ content, path, revision: 'base' }` |

Response shape:

```ts
interface ReviewFileResponse {
  binary?: boolean;
  content: string | null; // null = revision lacks this file (added/deleted)
  path: string;
  revision: 'base' | 'head';
  size?: number;
  tooLarge?: boolean;
}
```

Edge cases:

| case                       | base returns                          | head returns          | notes                                     |
| -------------------------- | ------------------------------------- | --------------------- | ----------------------------------------- |
| Newly added (`A` / `??`)   | `content: null`                       | full text             | client treats as all-added                |
| Deleted (`D`)              | full text                             | `content: null`       | source view shows "File deleted"          |
| Renamed (`R`)              | base via `oldPath`                    | head via new path     | requires `oldPath` on `ReviewChangedFile` |
| Binary                     | `content: null, binary: true`         | same                  | first 8000 bytes scanned for NUL          |
| `>5 MB`                    | `content: null, tooLarge: true, size` | same                  | stat-only, no read                        |
| Unchanged (Explorer click) | not requested if `skipBase`           | full text             | Source view skips base                    |
| `.gitignore`d in repo      | `content: null` (404 shape)           | full worktree content | client treats as added                    |

### `ReviewChangedFile` extension

```ts
export interface ReviewChangedFile {
  additions?: number;
  deletions?: number;
  oldPath?: string; // ⊕ rename source path
  path: string;
  status: string;
}
```

`parseNameStatus`: when status starts with `R`, take `parts[1]` as `oldPath`
and `parts[2]` as `path`.

### Server bootstrap (apps/kagura/src/web/review-panel.ts)

```ts
import { serve, type ServerType } from '@hono/node-server';
import { Hono } from 'hono';
import {
  createApiRouter,
  createAssetsRouter,
  type GitReviewService,
  type ServerLogger,
} from '@kagura/routers';

export interface ReviewPanelServerOptions {
  assetsDir: string;
  baseUrl: string;
  host: string;
  logger: ServerLogger;
  port: number;
  reviewService: GitReviewService;
}

export interface ReviewPanelServer {
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

export function createReviewPanelServer(opts: ReviewPanelServerOptions): ReviewPanelServer {
  const basePath = new URL(opts.baseUrl).pathname.replace(/\/+$/, '') || '/';
  const apiPrefix = basePath === '/' ? '/api' : `${basePath}/api`;

  const app = new Hono();
  app.route(apiPrefix, createApiRouter({ reviewService: opts.reviewService, logger: opts.logger }));
  app.route(
    basePath,
    createAssetsRouter({ assetsDir: opts.assetsDir, basePath, logger: opts.logger }),
  );

  let server: ServerType | undefined;
  return {
    start: () =>
      new Promise((resolve, reject) => {
        server = serve({ fetch: app.fetch, port: opts.port, hostname: opts.host }, () => {
          opts.logger.info('Review panel API listening on http://%s:%d', opts.host, opts.port);
          opts.logger.info('Review panel UI links will use %s', opts.baseUrl);
          resolve();
        });
        server.on?.('error', reject);
      }),
    stop: () =>
      new Promise((resolve, reject) => {
        if (!server) return resolve();
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}
```

## Frontend: routing + state

### URL schema

```
/reviews/:id?tab=changes|files
            &path=src/foo.ts
            &mode=diff|source
```

Defaults (omitted from URL when matching): `tab=changes`, `mode=diff`,
`path=` (becomes the first changed file at mount time).

### `use-review-route.ts`

```ts
type ReviewTab = 'changes' | 'files';
type ReviewMode = 'diff' | 'source';

interface ReviewRoute {
  tab: ReviewTab;
  path?: string;
  mode: ReviewMode;
}

interface ReviewRouteActions {
  setTab: (tab: ReviewTab) => void;
  setPath: (path: string | undefined) => void;
  setMode: (mode: ReviewMode) => void;
  patch: (next: Partial<ReviewRoute>) => void;
}

export function useReviewRoute(): ReviewRoute & ReviewRouteActions {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = useMemo(() => new URLSearchParams(search), [search]);

  const route = useMemo<ReviewRoute>(
    () => ({
      tab: parseTab(params.get('tab')),
      path: params.get('path') ?? undefined,
      mode: parseMode(params.get('mode')),
    }),
    [params],
  );

  const patch = useCallback(
    (next: Partial<ReviewRoute>) => {
      const merged = { ...route, ...next };
      const sp = new URLSearchParams();
      if (merged.tab !== 'changes') sp.set('tab', merged.tab);
      if (merged.path) sp.set('path', merged.path);
      if (merged.mode !== 'diff') sp.set('mode', merged.mode);
      const qs = sp.toString();
      setLocation(`${window.location.pathname}${qs ? `?${qs}` : ''}`, { replace: true });
    },
    [route, setLocation],
  );

  return {
    ...route,
    patch,
    setTab: (tab) => patch({ tab }),
    setPath: (path) => patch({ path }),
    setMode: (mode) => patch({ mode }),
  };
}
```

History handling: `replace: true` for j/k navigation; let initial mount /
deliberate tab switches push (refinement during implementation).

### State boundaries

| state              | source           | scope                                     |
| ------------------ | ---------------- | ----------------------------------------- |
| URL (route)        | `useReviewRoute` | tab, path, mode — survives reload         |
| Server-fetched     | hooks (custom)   | session, tree, diff, file content         |
| Local UI           | `useState`       | sidebar collapsed, filter text, diffStyle |
| pierre/trees model | `useFileTree`    | tree expand state, hover/focus            |

`diffStyle`, `filter` stay in local React state. Sidebar collapse persists via
`react-resizable-panels` `autoSaveId` (already wired).

### Keyboard shortcuts

Existing `j`/`k`/`gg`/`G`/`/`/`[` keep working. New:

| key | action                                                                 |
| --- | ---------------------------------------------------------------------- |
| `t` | toggle sidebar tab (changes ⇄ files)                                   |
| `s` | toggle right-pane mode (diff ⇄ source); disabled when no diff for path |

`use-file-nav.ts` becomes tab-aware:

```ts
function useFileNav(args: {
  changedFiles: ReviewChangedFile[];
  treePaths?: string[];
  tab: ReviewTab;
  selectedPath?: string;
  onSelect: (path: string | undefined) => void;
}) {
  const list =
    args.tab === 'changes' ? args.changedFiles.map((f) => f.path) : (args.treePaths ?? []);
  // goNext/Previous/First/Last operate on `list`
}
```

## Frontend: components

```
components/
  Sidebar/
    Sidebar.tsx               // ⊕ dispatches by route.tab
    SidebarTabs.tsx           // ⊕ full-width Changes|Files tab strip
    ChangesPanel.tsx          // ⊕ wraps SidebarHeader + FileNav (changed-only)
    ExplorerPanel.tsx         // ⊕ whole-tree panel
    ExplorerHeader.tsx        // ⊕ minimal header (filter only)
    SidebarHeader.tsx         // ≈ existing — used by ChangesPanel
    FileNav.tsx               // refactored: generic over paths+gitStatus
  DiffPane/
    RightPane.tsx             // ⊕ replaces DiffPane root, dispatches by mode
    DiffToolbar.tsx           // ≈ + Diff|Source pill
    DiffStatusBar.tsx         // ≈ existing
    DiffView.tsx              // rewrite: MultiFileDiff (base+head)
    SourceView.tsx            // ⊕ <File /> + computed gutter
    *.styles.ts
  ReviewLayout.tsx            // ≈ slimmed down; uses useReviewRoute
  ShellState.tsx              // ≈ existing; gains optional onRetry
```

`FileNav.tsx` becomes a thin wrapper around pierre `useFileTree`/`<FileTree />`,
parameterized by:

```ts
interface FileNavProps {
  paths: string[];
  gitStatus: Array<{ path: string; status: GitStatus }>;
  rowDecorations?: Map<string, { text: string; title: string }>;
  colorScheme: 'dark' | 'light';
  selectedPath?: string;
  onSelectPath: (path: string) => void;
  view: FileNavView; // ChangesPanel uses 'tree'|'flat'; Explorer locks 'tree'
  flattenEmptyDirectories?: boolean;
}
```

### `RightPane`

```tsx
export function RightPane({ executionId, path, mode, changedFile, route, colorScheme }: Props) {
  const isUnchangedFile = !changedFile;
  const effectiveMode: ReviewMode = isUnchangedFile ? 'source' : mode;

  return (
    <main id="review-main">
      <DiffToolbar mode={effectiveMode} diffDisabled={isUnchangedFile} ... />
      {effectiveMode === 'diff' && (
        <>
          <DiffStatusBar ... />
          <DiffView executionId={executionId} path={path} colorScheme={colorScheme} />
        </>
      )}
      {effectiveMode === 'source' && (
        <SourceView executionId={executionId} path={path} changedFile={changedFile} colorScheme={colorScheme} />
      )}
    </main>
  );
}
```

### `DiffView` (MultiFileDiff)

```tsx
export function DiffView({ executionId, path, colorScheme, diffStyle }: Props) {
  const pair = useFilePair(executionId, path);
  if (pair.isLoading) return <ShellState>Loading…</ShellState>;
  if (pair.error) return <ShellState>Failed to load diff.</ShellState>;
  if (pair.head?.binary || pair.base?.binary)
    return <ShellState>Binary diff cannot be shown.</ShellState>;
  if (pair.head?.tooLarge || pair.base?.tooLarge)
    return <ShellState>File too large — diff omitted.</ShellState>;

  const oldFile: FileContents = {
    contents: pair.base?.content ?? '',
    filename: pair.base?.path ?? path,
  };
  const newFile: FileContents = {
    contents: pair.head?.content ?? '',
    filename: pair.head?.path ?? path,
  };

  return (
    <MultiFileDiff
      disableWorkerPool
      oldFile={oldFile}
      newFile={newFile}
      options={{
        diffIndicators: 'classic',
        diffStyle,
        hunkSeparators: 'line-info', // ⊕ enables expand controls
        lineDiffType: 'word',
        theme: { dark: 'github-dark-high-contrast', light: 'github-light-high-contrast' },
        themeType: colorScheme,
      }}
    />
  );
}
```

The Full Diff fallback (no path selected) keeps `PatchDiff` over the
concatenated patch from `/diff` — expansion only works when a single file is
selected.

### `SourceView` + gutter

```tsx
export function SourceView({ executionId, path, changedFile, colorScheme }: Props) {
  const pair = useFilePair(executionId, path, { skipBase: !changedFile });
  const annotations = useMemo<LineAnnotation<DiffMark>[]>(() => {
    if (!changedFile || pair.base?.content == null || pair.head?.content == null) return [];
    return computeDiffAnnotations(pair.base.content, pair.head.content);
  }, [changedFile, pair.base?.content, pair.head?.content]);

  if (pair.isLoading) return <ShellState>Loading…</ShellState>;
  if (pair.error || !pair.head) return <ShellState>Failed to load source.</ShellState>;
  if (pair.head.binary) return <ShellState>Binary file</ShellState>;
  if (pair.head.tooLarge) return <ShellState>File too large to display.</ShellState>;

  return (
    <File
      disableWorkerPool
      file={{ contents: pair.head.content ?? '', filename: path }}
      lineAnnotations={annotations}
      options={{
        theme: { dark: 'github-dark-high-contrast', light: 'github-light-high-contrast' },
        themeType: colorScheme,
      }}
    />
  );
}
```

The gutter bar is rendered via CSS, not React, to avoid per-line component
overhead. SourceView injects a `<style>` block keyed off
`data-line-number="N"`:

```css
[data-line-number='11'] {
  box-shadow: inset 3px 0 0 0 var(--diff-add);
}
[data-line-number='13'] {
  box-shadow: inset 3px 0 0 0 var(--diff-mod);
}
```

Removal wedges are rendered as `::before` pseudo-elements on the row at the
removal position.

`computeDiffAnnotations(base, head)` uses pierre's `parseDiffFromFile` to
walk hunks; for each addition line, it emits `'modified'` if the same hunk
contains a deletion, otherwise `'added'`. Removed-only positions get a
separate "removal mark" entry consumed by the wedge CSS.

Initial scroll-to-line: when source mode mounts and a `changedFile` exists,
scroll the first hunk's first line into view via
`document.querySelector('[data-line-number="N"]').scrollIntoView({ block: 'center' })`.

## Frontend: API + hooks layer

### `apps/web` deps

```jsonc
{
  "dependencies": {
    "ofetch": "^1.4.1",
  },
}
```

### API modules (`features/review-panel/api/`)

```
api/
  client.ts      // ⊕ ofetch instance + ApiError helpers
  session.ts     // ⊕ fetchSession
  tree.ts        // ⊕ fetchTree
  diff.ts        // ⊕ fetchDiff
  file.ts        // ⊕ fetchFile
  index.ts       // ⊕ barrel
```

(deletes `review-api.ts`, `http.ts`)

`api/client.ts`:

```ts
import { FetchError, ofetch } from 'ofetch';

export function createApiClient({ basePath = '' } = {}) {
  return ofetch.create({ baseURL: `${basePath}/api`, retry: 0 });
}

export const api = createApiClient();

export { FetchError } from 'ofetch';
export function isApiError(err: unknown): err is FetchError {
  return err instanceof FetchError;
}

export function reviewPath(executionId: string, suffix = ''): string {
  return `/reviews/${encodeURIComponent(executionId)}${suffix}`;
}
```

Per-resource modules call `api<T>(path, { query, signal })`. ofetch handles
JSON parsing, query encoding, and 4xx/5xx → `FetchError`.

### Hooks

| hook                                   | calls           | cache                                         |
| -------------------------------------- | --------------- | --------------------------------------------- |
| `useSession(executionId)`              | `fetchSession`  | none (boot only)                              |
| `useTree(executionId)`                 | `fetchTree`     | module Map<executionId, Promise>              |
| `useFilePair(executionId, path, opts)` | `fetchFile × 2` | module Map<key, Promise>                      |
| `useDiff(executionId, path?)`          | `fetchDiff`     | module Map<key, Promise> (full-diff fallback) |

Memoization helper (`hooks/_cache.ts`):

```ts
export function memoizePromise<TArgs extends readonly unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  keyFn: (...args: TArgs) => string,
): (...args: TArgs) => Promise<TResult> {
  const cache = new Map<string, Promise<TResult>>();
  return (...args) => {
    const key = keyFn(...args);
    let p = cache.get(key);
    if (!p) {
      p = fn(...args);
      cache.set(key, p);
      p.catch(() => cache.delete(key));
    }
    return p;
  };
}
```

Cache invalidation: not implemented in v1 — review sessions are read-only
snapshots. Each hook exposes a `bump`-state-driven `refetch` that bypasses
cache for the Retry button.

### App.tsx changes

```ts
import { fetchSession } from './features/review-panel/api';

const session = await fetchSession(executionId);
// diff/file no longer prefetched at boot — RightPane fetches on mount
```

`loadInitialReviewData`, `loadDiff` deleted.

## Error handling

| location                      | failure              | UI                                                |
| ----------------------------- | -------------------- | ------------------------------------------------- |
| `ExplorerPanel`               | `useTree` reject     | "Failed to load file tree." + Retry               |
| `DiffView`                    | `useFilePair` reject | "Failed to load diff."                            |
| `DiffView`                    | base/head binary     | "Binary diff cannot be shown."                    |
| `DiffView`                    | base/head tooLarge   | "File too large ({size}) — diff omitted."         |
| `SourceView`                  | head reject          | "Failed to load source."                          |
| `SourceView`                  | head binary          | "Binary file"                                     |
| `SourceView`                  | head tooLarge        | "File too large to display."                      |
| `SourceView`                  | head=null + status=D | "File deleted in head" (button to view base — v2) |
| Selected `path` ∉ tree (race) | "File not in tree."  |

`describeError(err)` centralizes user-facing strings:

```ts
function describeError(err: Error): string {
  if (isApiError(err)) {
    const status = err.status ? `${err.status} ` : '';
    return `${status}${err.statusText ?? err.message}`;
  }
  return err.message ?? 'Unknown error';
}
```

## Testing strategy

### `packages/routers` unit tests

```
tests/
  review-api.test.ts         // hono app.request() — routing/validation/responses
  git-review-service.test.ts // moved from apps/kagura, extended for revision: 'base'
  middleware.test.ts         // basePath stripping + logger injection
```

Coverage targets: `/file?revision=base|head`, zod-rejected invalid revision,
zod-rejected missing path, traversal rejection, 404 for unknown executionId,
binary marker, tooLarge marker, rename oldPath, full + path-filtered diff, tree
returning ls-files + statuses.

`reviewService` is faked with an in-memory implementation backed by a `tmpRepo`
created by test setup (`git init`, commit, modify), mirroring the existing
review-git-service test pattern.

### `apps/web` unit tests (minimal v1)

Add `apps/web/vitest.config.ts` and a single test file:

```
apps/web/tests/compute-diff-annotations.test.ts
```

Covers added vs modified detection, identical content, trailing newline
differences. Other hooks/components rely on E2E + manual verification.

### Live E2E (`apps/kagura/src/e2e/live/`)

```
run-review-panel-link.ts            // existing; unchanged
run-review-panel-tree-api.ts        // ⊕ /tree returns full ls-files + statuses
run-review-panel-file-api.ts        // ⊕ /file?revision=base|head returns both
run-review-panel-rename-api.ts      // ⊕ /file with renamed file uses oldPath
```

A new helper (`apps/kagura/src/review/test-helpers.ts`) exposes
`seedReviewSession({ executionId, workspacePath, baseHead })` so live API tests
don't need a real Slack message round-trip.

### Manual verification (v1 frontend)

- Sidebar tab switch: Changes ⇄ Files
- Click changed file → diff loads
- Click unchanged file (Files tab) → source loads, no gutter
- Hunk expand: clicking arrow loads N lines of context
- Diff → Source toggle preserves path
- Source view: green/blue bars on changed lines, wedge for removed
- URL refresh preserves tab/path/mode
- `t` and `s` keyboard shortcuts

### Mock API

`apps/web/mock-review-api.ts` extensions:

- `/file?revision=base|head` returns mock pairs (added, modified, renamed,
  binary, tooLarge fixtures)
- `/tree` already exists; ensure it returns ~10-entry mock tree
- ChangedFile mock includes one `R` status with `oldPath`

## Open Questions

None blocking. Possible future work:

- Surface base view for deleted files in source mode.
- Multi-file `MultiFileDiff` for "Full diff" mode (currently keeps `PatchDiff`).
- Playwright UI E2E suite.
- Prefetch first changed file's pair at boot (deferred — measure first).

## Milestones

Implementation plan to be drafted via `writing-plans` skill. High-level phases:

1. **Backend extraction**: create `packages/routers`, move `GitReviewService` +
   types, port to Hono, retire `node:http` server, kagura imports updated, all
   existing tests green.
2. **Backend new `/file?revision=` endpoint**: implement base reading via
   `git show`, binary/tooLarge detection, rename `oldPath`, tests.
3. **Frontend API refactor**: add `ofetch`, split `api/` into per-module files,
   delete legacy `review-api.ts` / `http.ts`.
4. **Frontend routing + state**: introduce `useReviewRoute`, refactor
   `ReviewLayout` and `use-file-nav` to be tab-aware.
5. **Sidebar tabs + ExplorerPanel**: `SidebarTabs`, `ExplorerPanel`,
   refactored `FileNav` shared by both panels.
6. **DiffView → MultiFileDiff**: switch from `PatchDiff` per-hunk to
   `MultiFileDiff` per file, drop `splitPatch`, enable `hunkSeparators:
'line-info'`.
7. **Source view + gutter**: `SourceView`, `computeDiffAnnotations`, CSS
   gutter injection, scroll-to-line.
8. **Polish**: `t`/`s` shortcuts, ShellState retry, mock API extensions,
   manual + live E2E verification.
