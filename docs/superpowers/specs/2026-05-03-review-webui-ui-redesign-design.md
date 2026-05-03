# Review Web UI — Visual Redesign

**Date:** 2026-05-03
**Status:** Approved
**Scope:** Frontend only — `apps/web/src/features/review-panel/**` plus `apps/web/panda.config.ts`. No backend, no API, no router changes.

## Goal

Replace the current review panel UI end-to-end while keeping the same data contract (`ReviewSession`, `ReviewChangedFile`, raw unified diff string). The new UI takes its skeleton from GitHub's "Files Changed" view, its density/precision from Linear/Pierre, and its source-aware gutter from Zed/Cursor. Visual fidelity must match the approved mockup at `.superpowers/brainstorm/27571-1777786501/content/polish.html`.

## Non-Goals

- **No inline comments / annotations.** Mockup shows them for fidelity; implementation omits them entirely.
- **No backend changes.** No `packages/routers` extraction, no ofetch layer, no wouter routing rework, no live-API tests. Existing fetch layer (`features/review-panel/api/`), session loading, and execution-id lookup stay as-is.
- **No new keyboard shortcuts beyond what already exists** (`j`, `k`, `gg`, `G`, `/`, `[`). Source/Diff toggle and view switches are mouse + existing slot.

## High-Level Layout

```
┌────────────────────────────────────────────────────────────────────────┐
│ TitleBar         repo · branch chip · Σ files · Σ +adds · Σ −dels       │  36px
├────────────┬───────────────────────────────────────────────────────────┤
│ Sidebar    │  RightPane                                                │
│ ┌────────┐ │ ┌───────────────────────────────────────────────────────┐ │
│ │ Tabs   │ │ │ Toolbar  ↑↓  breadcrumb  Diff/Source  Split/Unified ⋯ │ │ 36px
│ │Changes │ │ ├───────────────────────────────────────────────────────┤ │
│ │ Files  │ │ │                                                       │ │
│ ├────────┤ │ │   DiffArea  (diff mode)  or  SourceArea (source mode) │ │
│ │Filter  │ │ │                                                       │ │
│ │Tree/Flat│ │ │                                                       │ │
│ ├────────┤ │ │                                                       │ │
│ │FileTree│ │ │                                                       │ │
│ └────────┘ │ └───────────────────────────────────────────────────────┘ │
├────────────┴───────────────────────────────────────────────────────────┤
│ StatusBar   M  git-review.ts · +22 −6 · 3 of 7    j/k navigate · ⌘P    │  22px
└────────────────────────────────────────────────────────────────────────┘
```

`react-resizable-panels` keeps the horizontal split between Sidebar and RightPane. TitleBar and StatusBar are siblings of `<PanelGroup>`, not inside it.

## Visual System

### Tokens (Panda config)

Existing `apps/web/panda.config.ts` keeps the current neutral + diff palette. Additions only:

```ts
colors: {
  // existing neutral.* and diff.* unchanged
  accent: {
    light: { value: '#0969da' },  // GitHub light blue
    dark:  { value: '#58a6ff' },  // GitHub dark blue
  },
  status: {
    addedDark:    { value: '#3fb950' },
    addedLight:   { value: '#1a7f37' },
    modifiedDark: { value: '#d29922' },
    modifiedLight:{ value: '#9a6700' },
    deletedDark:  { value: '#f85149' },
    deletedLight: { value: '#cf222e' },
    renamedDark:  { value: '#bc8cff' },
    renamedLight: { value: '#8250df' },
  },
},
```

New semantic tokens:

```ts
semanticTokens.colors: {
  // existing bg/fg/border/diff unchanged
  accent: {
    fg: { value: { base: '{colors.accent.light}', _dark: '{colors.accent.dark}' } },
    bg: { value: { base: 'rgba(9,105,218,0.10)', _dark: 'rgba(88,166,255,0.15)' } },
  },
  status: {
    added:    { value: { base: '{colors.status.addedLight}',    _dark: '{colors.status.addedDark}' } },
    modified: { value: { base: '{colors.status.modifiedLight}', _dark: '{colors.status.modifiedDark}' } },
    deleted:  { value: { base: '{colors.status.deletedLight}',  _dark: '{colors.status.deletedDark}' } },
    renamed:  { value: { base: '{colors.status.renamedLight}',  _dark: '{colors.status.renamedDark}' } },
  },
},
```

`bg.subtle` (used for hunk header / inline sections) stays as the existing `neutral.100/800`.

### Spacing

Existing 4-step scale (`1`=4, `1.5`=6, `2`=8, `2.5`=10, `3`=12, `3.5`=14, `4`=16) is sufficient — no additions.

### Typography

- Geist Sans 12.5/13 for chrome (toolbar, tabs, breadcrumb)
- Geist Sans 11.5 for sidebar file rows
- Geist Mono 11.5/1.55 for diff and source code
- Geist Sans 10.5 for statusbar and meta
- All numerics use `font-variant-numeric: tabular-nums` (file counts, deltas, line numbers)

### Density

Sidebar file row: `padding: 3px 12px; line-height: 1.5; font-size: 11.5px`. Toolbar height: 36px. StatusBar: 22px. Diff line gutter widths: 38px each.

## Component Tree

```
ReviewLayout
├── TitleBar                 ← new
├── PanelGroup (horizontal)
│   ├── Panel (sidebar)
│   │   └── Sidebar
│   │       ├── SidebarTabs        (Changes | Files)        ← new
│   │       ├── SidebarToolbar     (filter + Tree/Flat pill) ← refactored from SidebarHeader
│   │       └── FileTree                                    ← rewritten (no @pierre/trees)
│   └── Panel (right)
│       └── RightPane
│           ├── DiffToolbar    (refactored)
│           ├── DiffView | SourceView   ← mode-switched
│           └── (no nested statusbar — moved to root)
└── StatusBar                ← new (was inside DiffPane)
```

### TitleBar (`components/TitleBar.tsx`)

Always visible. Reads `session: ReviewSession`. Renders:

- Repo label (`session.workspaceLabel ?? session.workspaceRepoId ?? 'Review'`)
- Branch chip in mono font: `${baseBranch} → ${head.slice(0,7)}` (omit if not present)
- Right-aligned summary: `N files · +Σadds · −Σdels` (Σ computed from `session.changedFiles`)

Height 36px. Bottom border: `border.default`.

### Sidebar (`components/Sidebar/Sidebar.tsx`)

Hosts the two-tab structure. Tab strip uses bottom-border indicator (no pill). Active tab gets `accent.fg` underline + matching text; inactive `fg.muted`. Tab labels include count chip when relevant.

- **Changes tab**: filter input + Tree/Flat pill + `<FileTree mode="changes" />`. Files = `session.changedFiles`.
- **Files tab**: same shell, but the file list = full repo file list. **Initial implementation: stub with the same `changedFiles` source** (mock backend returns it for now). When a Files-tree backend lands, swap data source — the component is identical.

Tab state lives in `Sidebar` local state. No URL persistence in this redesign.

### FileTree (`components/Sidebar/FileTree.tsx`)

Custom-built tree. Drops `@pierre/trees`. Reasons:

- Pierre renders into its own shadow DOM, requiring DOM-mutation observers (current `observeDecorations`) to inject deltas — fragile and impossible to style precisely.
- The tree we need is simple: build folders from `path.split('/')`, render one row per node, virtualization is unnecessary at typical PR scale (≤ a few hundred files).

Row layout:

```
[L-accent] [twisty] [status-badge] [icon] [name…]                    [+adds −dels]
```

- L-accent: 2px left border, only on selected leaf, color `accent.fg`. Selected row also gets `accent.bg` background. Folder rows have no accent.
- Twisty: 10px chevron `▾`/`▸` for folders only.
- Status badge: 14×14 rounded square showing `M`/`A`/`D`/`R` in `status.*` color. Badge renders inside a 14px slot for non-leaves too (empty) so columns align.
- Icon: 12×12 rounded rect colored by file extension (`.ts/.tsx` → blue `#3178c6`, `.md` → muted, `.json` → amber, default → muted). A simple `extToIcon(name)` map lives in the tree file.
- Name: truncates with `text-overflow: ellipsis`.
- Deltas: tabular nums, `status.added`/`status.deleted`. Hidden if both zero.

Folder rows: 11.5px, `fg.muted`, no badge/icon, just twisty + name. Clicking toggles expansion.

Selection: clicking a leaf calls `onSelectPath(realPath)`. Folder rows do not change selection. Keyboard `j`/`k` navigation continues to come from the parent's `useFileNav` hook (untouched).

Filter: matches against full path (case-insensitive substring). Filtering in flat mode shows leaves only; in tree mode any matching leaf forces ancestor folders to expand. Implementation: pre-compute a `Set<string>` of expanded folders from filter matches.

Tree vs Flat: same component; flat mode just renders all matching leaves with their full path as the name and zero indentation. Folders are not shown in flat mode.

Indentation: 12px per depth level.

### DiffToolbar (`components/RightPane/DiffToolbar.tsx`)

Refactored to drop `SegmentedControl` import from Sidebar (becomes shared `components/Pill.tsx`). Adds the Diff/Source pill.

Order: `[↑] [↓]  breadcrumb…  [Diff|Source pill] [Split|Unified pill] [⎘ copy] [⋯ more]`

- `↑` / `↓`: `prev` / `next` file. Disabled when no selection.
- Breadcrumb: monospace, `path/to/<strong>file.ts</strong>`. When no selection, shows "All changed files" as before.
- Diff/Source pill: toggles `viewMode: 'diff' | 'source'`. Disabled in source mode if file is binary, deleted, or `tooLarge`.
- Split/Unified pill: only visible in diff mode.
- Copy: copies selected path. `⋯`: reserved for future menu (no-op stub for now).

The "Full diff" button from the current toolbar is removed. Same effect available by clicking the empty-state in the breadcrumb area.

### DiffView (`components/RightPane/DiffView.tsx`)

Largely unchanged. Continues to call `<PatchDiff>` from `@pierre/diffs/react` with the same options. The wrapping `<div>` styling adjusts to remove the bottom statusbar slot (statusbar moves to root).

Hunk expansion is a feature of `@pierre/diffs` — verify it is enabled via `hunkSeparators: 'expandable'` (or whichever option name the version exposes; check at implementation time and fall back to `'line-info-basic'` if not available, with a TODO).

### SourceView (`components/RightPane/SourceView.tsx`)

New. Renders the resolved source of the file with a per-line gutter colored by diff status. Layout:

```
[ line# ][ bar ][ source line ]
```

- Line# column: 38px, right-aligned, `fg.muted`, mono.
- Bar column: 4px wide. Background = `status.added` for added lines, `status.deleted` for deleted, transparent otherwise.
- Source line: padded left 8px, mono, no syntax highlighting in the first cut (can layer on later).

Source content + per-line annotations come from a small helper `computeSourceLines(diff: string, side: 'head'): SourceLine[]` co-located in the SourceView file. It parses the unified diff hunks for the selected file and returns either:

- The reconstructed head-side content with `{ line, status: 'added' | 'unchanged' | null }`, OR
- `{ kind: 'unavailable' }` when the file is binary / `tooLarge` / deleted.

For the first version, **source view is computed from the raw unified diff** (no extra API). Limitations: only lines inside emitted hunks are shown; gaps between hunks render as collapsed `… N lines …` separators. This matches the mockup's "show what we have" approach.

If SourceView returns unavailable, render an empty-state matching the existing "No diff." style.

### StatusBar (`components/StatusBar.tsx`)

Replaces `DiffStatusBar`. Now a sibling of `<PanelGroup>` (sits at root, not inside DiffPane). Reads `selectedFile`, `selectedIndex`, `fileTotal`. Renders:

```
[status-badge]  fileName  ·  +adds  −dels  ·  N of M           j/k navigate · ⌘P search
```

Right-aligned hint group lists the active shortcut grammar. No interactivity. 22px tall.

### ReviewLayout (`components/ReviewLayout.tsx`)

Reduced to composition + state holding. Owns:

- `viewMode: 'diff' | 'source'`
- `diffStyle: 'split' | 'unified'`
- `tab: 'changes' | 'files'`
- `view: 'tree' | 'flat'`
- `filter: string`
- The two refs (sidebar collapse, filter input)

The keyboard shortcut hook (`useKeyboardShortcuts`), file nav hook (`useFileNav`), and totals memo stay. The `splitPatch` utility for selecting one file's diff stays.

### Files Removed

- `components/Sidebar/SidebarHeader.tsx` + `.styles.ts` — split into `SidebarTabs` + `SidebarToolbar`.
- `components/Sidebar/FileNav.tsx` + `.styles.ts` — replaced by `FileTree`.
- `components/DiffPane/DiffStatusBar.tsx` + `.styles.ts` — replaced by root-level `StatusBar`.
- `theme/tokens.ts` — only kept tree-related strings for `themeToTreeStyles`. With `@pierre/trees` removed, the file is no longer needed.
- `apps/web/package.json` dep `@pierre/trees` — removed.

### Files Added

- `components/TitleBar.tsx` + `.styles.ts`
- `components/StatusBar.tsx` + `.styles.ts`
- `components/Sidebar/Sidebar.tsx` + `.styles.ts`
- `components/Sidebar/SidebarTabs.tsx` + `.styles.ts`
- `components/Sidebar/SidebarToolbar.tsx` + `.styles.ts` (filter + Tree/Flat pill)
- `components/Sidebar/FileTree.tsx` + `.styles.ts`
- `components/RightPane/RightPane.tsx` + `.styles.ts`
- `components/RightPane/DiffToolbar.tsx` + `.styles.ts` (moved from `DiffPane/`)
- `components/RightPane/DiffView.tsx` + `.styles.ts` (moved from `DiffPane/`)
- `components/RightPane/SourceView.tsx` + `.styles.ts`
- `components/Pill.tsx` + `.styles.ts` (shared segmented pill, replaces `Sidebar/SegmentedControl`)

### Files Renamed / Moved

- `components/DiffPane/` → `components/RightPane/`
- `components/Sidebar/SegmentedControl.tsx` → `components/Pill.tsx`

## Interactions

### Selection & Navigation

- Clicking a file row updates `selectedPath` state (existing `onSelectPath` prop).
- `j` / `k`: next / previous file (from `useFileNav` — unchanged).
- `gg` / `G`: first / last (unchanged).
- `/`: focus filter input (unchanged; switches to Changes tab if currently on Files).
- `[`: collapse / expand sidebar (unchanged).
- Source/Diff toggle and Split/Unified toggle: mouse-only.

### Mode Switching

`viewMode` lives in `ReviewLayout` state. Resets to `'diff'` whenever `selectedPath` changes — prevents "stuck in source mode for a file that can't show source".

### Hunk Expansion

Handled inside `@pierre/diffs` (diff mode). In source mode, gaps between hunks are static `… N collapsed …` rows; clicking does nothing in v1.

### Filter Behavior

Typing immediately filters. `Esc` clears filter and unfocuses (existing behavior preserved).

### Tab Switching

Switching to Files keeps the current `selectedPath` if that path exists in the Files tree; otherwise selection is preserved but no row appears highlighted.

## Mock API

`apps/web/mock-review-api.ts` returns the existing `ReviewSession` shape. No changes needed for v1 (Files tab uses the same `changedFiles` data temporarily). Add a TODO comment in the mock noting the future `/repo/files` endpoint shape.

## Testing

Visual smoke only. No unit tests for the redesign in v1. Run:

- `pnpm typecheck` (apps/web)
- `pnpm build` (apps/web)
- Manual visual check via `pnpm dev:mock` against the approved mockup

## Migration Checklist

1. Add new Panda tokens (accent + status palette).
2. Build `Pill`, `TitleBar`, `StatusBar`, `Sidebar`, `SidebarTabs`, `SidebarToolbar`, `FileTree`, `RightPane`, `SourceView` (new files).
3. Move `DiffToolbar` and `DiffView` to `RightPane/`. Adjust toolbar to add Diff/Source pill and drop "Full diff" button.
4. Rewrite `ReviewLayout` to compose the new tree.
5. Delete `SidebarHeader`, `FileNav`, `DiffStatusBar`, `SegmentedControl`, `DiffPane.tsx`, `theme/tokens.ts`.
6. Remove `@pierre/trees` from `package.json`.
7. Update `apps/web/CLAUDE.md` to reflect the new structure (drop `theme/tokens.ts` paragraph; mention `RightPane/` and `FileTree`).
8. Run typecheck + build + visual smoke.

## Open Risks

- **`@pierre/diffs` hunk expansion API**: confirm the option name at implementation time. If unavailable, file an upstream issue and fall back to `line-info-basic` (current behavior — no expand) with a TODO marker.
- **Source view for renames**: the head path differs from the base path. Use `file.path` (head) for the source content, ignore the base. If `splitPatch` returns nothing for a renamed-only file (no content change), source mode shows the file with all-`unchanged` gutters. Acceptable.
- **Light mode**: existing colors are dark-tuned. Verify contrast in light mode with the new accent/status tokens before declaring done.
