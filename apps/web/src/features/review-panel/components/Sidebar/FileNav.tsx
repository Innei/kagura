import { themeToTreeStyles } from '@pierre/trees';
import { FileTree, useFileTree } from '@pierre/trees/react';
import { useEffect, useMemo, useRef } from 'react';

import { darkTokens, lightTokens } from '../../../../theme/tokens';
import type { ReviewChangedFile } from '../../types';
import { mapGitStatus } from '../../utils/git-status';
import * as styles from './FileNav.styles';
import type { FileNavView } from './SidebarHeader';

const TREE_DECORATION_CSS = `
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

interface FileNavProps {
  changedFiles: ReviewChangedFile[];
  colorScheme: 'dark' | 'light';
  filter: string;
  onSelectPath: (path: string) => void;
  selectedPath?: string | undefined;
  view: FileNavView;
}

function matchPath(path: string, filter: string): boolean {
  if (!filter) return true;
  const needle = filter.toLowerCase();
  return path.toLowerCase().includes(needle);
}

export function FileNav({
  changedFiles,
  colorScheme,
  filter,
  onSelectPath,
  selectedPath,
  view,
}: FileNavProps) {
  const filtered = useMemo(
    () => changedFiles.filter((file) => matchPath(file.path, filter)),
    [changedFiles, filter],
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
      {view === 'tree' ? (
        <TreeView
          changedFiles={filtered}
          colorScheme={colorScheme}
          selectedPath={selectedPath}
          onSelectPath={onSelectPath}
        />
      ) : (
        <FlatList changedFiles={filtered} selectedPath={selectedPath} onSelectPath={onSelectPath} />
      )}
    </div>
  );
}

interface TreeViewProps {
  changedFiles: ReviewChangedFile[];
  colorScheme: 'dark' | 'light';
  onSelectPath: (path: string) => void;
  selectedPath?: string | undefined;
}

function TreeView({ changedFiles, colorScheme, onSelectPath, selectedPath }: TreeViewProps) {
  const paths = useMemo(() => changedFiles.map((file) => file.path), [changedFiles]);
  const filesByPath = useMemo(
    () => new Map(changedFiles.map((file) => [file.path, file])),
    [changedFiles],
  );
  const gitStatus = useMemo(
    () =>
      changedFiles.flatMap((file) => {
        const status = mapGitStatus(file.status);
        return status ? [{ path: file.path, status }] : [];
      }),
    [changedFiles],
  );

  const selectedPathRef = useRef(selectedPath);
  selectedPathRef.current = selectedPath;
  const onSelectPathRef = useRef(onSelectPath);
  onSelectPathRef.current = onSelectPath;
  const filesByPathRef = useRef(filesByPath);
  filesByPathRef.current = filesByPath;

  const tokens = colorScheme === 'dark' ? darkTokens : lightTokens;

  const { model } = useFileTree({
    density: 'compact',
    flattenEmptyDirectories: true,
    gitStatus,
    initialExpansion: 'open',
    paths,
    stickyFolders: true,
    unsafeCSS: TREE_DECORATION_CSS,
    onSelectionChange: (paths) => {
      const next = paths.find((path) => filesByPathRef.current.has(path));
      if (!next) return;
      if (next === selectedPathRef.current) return;
      onSelectPathRef.current(next);
    },
    renderRowDecoration: ({ item }) => {
      const file = filesByPath.get(item.path);
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
    if (!selectedPath || lastCommanded.current === selectedPath) return;
    for (const path of model.getSelectedPaths()) {
      if (path !== selectedPath) model.getItem(path)?.deselect();
    }
    lastCommanded.current = selectedPath;
    const item = model.getItem(selectedPath);
    item?.select();
    item?.focus();
  }, [model, selectedPath]);

  useEffect(() => {
    let disposed = false;
    let teardown: (() => void) | undefined;
    const tryAttach = () => {
      if (disposed) return;
      const host = model.getFileTreeContainer();
      if (host) {
        teardown = observeDecorations(host);
        return;
      }
      requestAnimationFrame(tryAttach);
    };
    tryAttach();
    return () => {
      disposed = true;
      teardown?.();
    };
  }, [model]);

  const treeStyle = useMemo(
    () => ({
      ...themeToTreeStyles({
        type: colorScheme,
        bg: tokens.bg.surface,
        fg: tokens.fg.default,
      }),
      ['--review-diff-add' as string]: tokens.diff.add,
      ['--review-diff-del' as string]: tokens.diff.del,
    }),
    [colorScheme, tokens],
  );

  return (
    <div className={styles.treeWrap} style={treeStyle}>
      <FileTree className={styles.tree} model={model} />
    </div>
  );
}

interface FlatListProps {
  changedFiles: ReviewChangedFile[];
  onSelectPath: (path: string) => void;
  selectedPath?: string | undefined;
}

function FlatList({ changedFiles, onSelectPath, selectedPath }: FlatListProps) {
  return (
    <ul className={styles.flatList} role="list">
      {changedFiles.map((file) => {
        const active = file.path === selectedPath;
        const status = (file.status || '?').slice(0, 1);
        const additions = file.additions ?? 0;
        const deletions = file.deletions ?? 0;
        return (
          <li key={file.path}>
            <button
              aria-current={active ? 'true' : undefined}
              className={active ? `${styles.flatRow} ${styles.flatRowActive}` : styles.flatRow}
              title={file.path}
              type="button"
              onClick={() => onSelectPath(file.path)}
            >
              <span className={active ? `${styles.badge} ${styles.badgeActive}` : styles.badge}>
                {status}
              </span>
              <span className={styles.path}>{file.path}</span>
              <span className={active ? `${styles.stats} ${styles.statsActive}` : styles.stats}>
                {additions > 0 ? (
                  <span
                    className={
                      active ? `${styles.additions} ${styles.additionsActive}` : styles.additions
                    }
                  >
                    +{additions}
                  </span>
                ) : null}
                {deletions > 0 ? (
                  <span
                    className={
                      active ? `${styles.deletions} ${styles.deletionsActive}` : styles.deletions
                    }
                  >
                    −{deletions}
                  </span>
                ) : null}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
