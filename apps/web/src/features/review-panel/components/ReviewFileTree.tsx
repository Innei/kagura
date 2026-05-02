import { FileTree, useFileTree, useFileTreeSelection } from '@pierre/trees/react';
import { useEffect, useMemo } from 'react';

import * as styles from '../../../styles.css';
import type { ReviewTreeEntry } from '../types';
import { mapGitStatus } from '../utils/git-status';

export function ReviewFileTree({
  entries,
  onSelectPath,
  selectedPath,
}: {
  entries: ReviewTreeEntry[];
  onSelectPath: (path: string) => void;
  selectedPath?: string | undefined;
}) {
  const paths = useMemo(() => entries.map((entry) => entry.path), [entries]);
  const gitStatus = useMemo(
    () =>
      entries.flatMap((entry) => {
        const status = mapGitStatus(entry.status);
        return status ? [{ path: entry.path, status }] : [];
      }),
    [entries],
  );
  const { model } = useFileTree({
    density: 'compact',
    flattenEmptyDirectories: true,
    gitStatus,
    initialExpansion: 'open',
    paths,
    stickyFolders: true,
  });
  const selectedPaths = useFileTreeSelection(model);

  useEffect(() => {
    const selected = selectedPaths.find((path) => entries.some((entry) => entry.path === path));
    if (selected && selected !== selectedPath) {
      onSelectPath(selected);
    }
  }, [entries, onSelectPath, selectedPath, selectedPaths]);

  useEffect(() => {
    if (!selectedPath) return;
    const item = model.getItem(selectedPath);
    item?.select();
    item?.focus();
  }, [model, selectedPath]);

  return <FileTree className={styles.fileTree} model={model} />;
}
