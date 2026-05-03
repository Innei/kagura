import { themeToTreeStyles } from '@pierre/trees';
import { FileTree as PierreFileTree, useFileTree } from '@pierre/trees/react';
import { useEffect, useMemo, useRef } from 'react';

import { darkTokens, lightTokens } from '../../../../theme/tokens';
import type { ReviewChangedFile } from '../../types';
import { mapGitStatus } from '../../utils/git-status';
import * as styles from './FileTree.styles';
import type { FileNavView } from './SidebarToolbar';

const TREE_DECORATION_CSS = `
  [data-item-section="decoration"] {
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }
  [data-item-section="decoration"] span[title*="additions, 0 deletions"] {
    color: var(--review-diff-add);
  }
  [data-item-section="decoration"] span[title^="0 additions, "] {
    color: var(--review-diff-del);
  }
  [data-item-section="decoration"] [data-review-add] {
    color: var(--review-diff-add);
  }
  [data-item-section="decoration"] [data-review-del] {
    color: var(--review-diff-del);
  }
`;

const DECORATION_SPLIT_RE = /^\+(\d+) (−\d+)$/;

function splitDecorationSpan(span: HTMLElement): void {
  if (span.dataset.reviewSplit === '1') return;
  const text = span.textContent ?? '';
  const match = DECORATION_SPLIT_RE.exec(text);
  if (!match) return;
  const [, additions, deletions] = match;
  const addEl = document.createElement('span');
  addEl.dataset.reviewAdd = '';
  addEl.textContent = `+${additions}`;
  const sep = document.createTextNode(' ');
  const delEl = document.createElement('span');
  delEl.dataset.reviewDel = '';
  delEl.textContent = deletions ?? '';
  span.replaceChildren(addEl, sep, delEl);
  span.dataset.reviewSplit = '1';
  span.style.display = 'flex';
  span.style.gap = '4px';
}

function observeDecorations(host: HTMLElement): () => void {
  const root = host.shadowRoot ?? host;

  const apply = (node: ParentNode) => {
    const cells = node.querySelectorAll(
      '[data-item-section="decoration"] span[title*="additions, "]',
    );
    for (const cell of cells) splitDecorationSpan(cell as HTMLElement);
  };

  apply(root);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'characterData') {
        const target = mutation.target.parentElement;
        if (
          target instanceof HTMLElement &&
          target.tagName === 'SPAN' &&
          target.closest('[data-item-section="decoration"]')
        ) {
          target.dataset.reviewSplit = '';
          splitDecorationSpan(target);
        }
        continue;
      }
      for (const added of mutation.addedNodes) {
        if (added instanceof HTMLElement) apply(added);
      }
    }
  });

  observer.observe(root, { childList: true, subtree: true, characterData: true });
  return () => observer.disconnect();
}

const FLAT_SEP = '·';

function toDisplayPath(realPath: string, view: FileNavView): string {
  return view === 'flat' ? realPath.replaceAll('/', FLAT_SEP) : realPath;
}

function toRealPath(displayPath: string, view: FileNavView): string {
  return view === 'flat' ? displayPath.replaceAll(FLAT_SEP, '/') : displayPath;
}

function matchPath(path: string, filter: string): boolean {
  if (!filter) return true;
  return path.toLowerCase().includes(filter.toLowerCase());
}

interface FileTreeProps {
  colorScheme: 'dark' | 'light';
  files: ReviewChangedFile[];
  filter: string;
  onSelectPath: (path: string) => void;
  selectedPath?: string | undefined;
  view: FileNavView;
}

export function FileTree({
  colorScheme,
  files,
  filter,
  onSelectPath,
  selectedPath,
  view,
}: FileTreeProps) {
  const filtered = useMemo(
    () => files.filter((file) => matchPath(file.path, filter)),
    [files, filter],
  );

  if (filtered.length === 0) {
    return (
      <div className={styles.root}>
        <div className={styles.empty}>
          {filter ? 'No files match the filter.' : 'No changed files.'}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <TreeView
        changedFiles={filtered}
        colorScheme={colorScheme}
        key={view}
        selectedPath={selectedPath}
        view={view}
        onSelectPath={onSelectPath}
      />
    </div>
  );
}

interface TreeViewProps {
  changedFiles: ReviewChangedFile[];
  colorScheme: 'dark' | 'light';
  onSelectPath: (path: string) => void;
  selectedPath?: string | undefined;
  view: FileNavView;
}

function TreeView({ changedFiles, colorScheme, onSelectPath, selectedPath, view }: TreeViewProps) {
  const paths = useMemo(
    () => changedFiles.map((file) => toDisplayPath(file.path, view)),
    [changedFiles, view],
  );
  const filesByDisplayPath = useMemo(
    () => new Map(changedFiles.map((file) => [toDisplayPath(file.path, view), file])),
    [changedFiles, view],
  );
  const gitStatus = useMemo(
    () =>
      changedFiles.flatMap((file) => {
        const status = mapGitStatus(file.status);
        return status ? [{ path: toDisplayPath(file.path, view), status }] : [];
      }),
    [changedFiles, view],
  );

  const displaySelectedPath = selectedPath ? toDisplayPath(selectedPath, view) : undefined;

  const selectedPathRef = useRef(displaySelectedPath);
  selectedPathRef.current = displaySelectedPath;
  const onSelectPathRef = useRef(onSelectPath);
  onSelectPathRef.current = onSelectPath;
  const filesByPathRef = useRef(filesByDisplayPath);
  filesByPathRef.current = filesByDisplayPath;
  const viewRef = useRef(view);
  viewRef.current = view;

  const tokens = colorScheme === 'dark' ? darkTokens : lightTokens;

  const { model } = useFileTree({
    density: 'compact',
    flattenEmptyDirectories: true,
    gitStatus,
    initialExpansion: 'open',
    paths,
    stickyFolders: view === 'tree',
    unsafeCSS: TREE_DECORATION_CSS,
    onSelectionChange: (selectedPaths) => {
      const next = selectedPaths.find((path) => filesByPathRef.current.has(path));
      if (!next) return;
      if (next === selectedPathRef.current) return;
      onSelectPathRef.current(toRealPath(next, viewRef.current));
    },
    renderRowDecoration: ({ item }) => {
      const file = filesByDisplayPath.get(item.path);
      if (!file) return null;
      const additions = file.additions ?? 0;
      const deletions = file.deletions ?? 0;
      if (additions === 0 && deletions === 0) return null;
      const text =
        additions > 0 && deletions > 0
          ? `+${additions} −${deletions}`
          : additions > 0
            ? `+${additions}`
            : `−${deletions}`;
      return {
        text,
        title: `${additions} additions, ${deletions} deletions`,
      };
    },
  });

  const lastCommanded = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!displaySelectedPath || lastCommanded.current === displaySelectedPath) return;
    for (const path of model.getSelectedPaths()) {
      if (path !== displaySelectedPath) model.getItem(path)?.deselect();
    }
    lastCommanded.current = displaySelectedPath;
    const item = model.getItem(displaySelectedPath);
    item?.select();
    item?.focus();
  }, [model, displaySelectedPath]);

  useEffect(() => {
    let disposed = false;
    let teardownObserver: (() => void) | undefined;
    let teardownClick: (() => void) | undefined;
    const tryAttach = () => {
      if (disposed) return;
      const host = model.getFileTreeContainer();
      if (host) {
        teardownObserver = observeDecorations(host);
        const handler = (event: Event) => {
          const path = event.composedPath();
          for (const node of path) {
            if (!(node instanceof HTMLElement)) continue;
            const itemPath = node.dataset?.itemPath;
            const itemType = node.dataset?.itemType;
            if (itemPath && itemType === 'file' && filesByPathRef.current.has(itemPath)) {
              if (itemPath !== selectedPathRef.current) {
                onSelectPathRef.current(toRealPath(itemPath, viewRef.current));
              }
              return;
            }
          }
        };
        host.addEventListener('click', handler);
        teardownClick = () => host.removeEventListener('click', handler);
        return;
      }
      requestAnimationFrame(tryAttach);
    };
    tryAttach();
    return () => {
      disposed = true;
      teardownObserver?.();
      teardownClick?.();
    };
  }, [model]);

  const treeStyle = useMemo(() => {
    const isDark = colorScheme === 'dark';
    const selectionBg = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)';
    const hoverBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
    return {
      ...themeToTreeStyles({
        type: colorScheme,
        bg: tokens.bg.canvas,
        fg: tokens.fg.default,
      }),
      ['--trees-theme-list-active-selection-bg' as string]: selectionBg,
      ['--trees-theme-list-active-selection-fg' as string]: tokens.fg.default,
      ['--trees-theme-list-hover-bg' as string]: hoverBg,
      ['--review-diff-add' as string]: tokens.diff.add,
      ['--review-diff-del' as string]: tokens.diff.del,
    };
  }, [colorScheme, tokens]);

  return (
    <div className={styles.treeWrap} style={treeStyle}>
      <PierreFileTree className={styles.tree} model={model} />
    </div>
  );
}
