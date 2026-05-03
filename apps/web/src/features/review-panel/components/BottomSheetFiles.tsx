import { useEffect, useState } from 'react';

import type { ReviewChangedFile } from '../types';
import { mapGitStatus } from '../utils/git-status';
import * as styles from './BottomSheetFiles.styles';

const ANIM_MS = 260;

interface BottomSheetFilesProps {
  files: ReviewChangedFile[];
  onClose: () => void;
  onSelect: (path: string) => void;
  open: boolean;
  selectedPath?: string | undefined;
}

const STATUS_LETTER: Record<string, string> = {
  added: 'A',
  modified: 'M',
  deleted: 'D',
  renamed: 'R',
  untracked: '?',
};

const STATUS_CLASS: Record<string, string> = {
  added: styles.statusAdded,
  modified: styles.statusModified,
  deleted: styles.statusDeleted,
  renamed: styles.statusRenamed,
};

export function BottomSheetFiles({
  files,
  onClose,
  onSelect,
  open,
  selectedPath,
}: BottomSheetFilesProps) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => setShown(true));
      });
      return () => cancelAnimationFrame(id);
    }
    setShown(false);
    const id = window.setTimeout(() => setMounted(false), ANIM_MS);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handler);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return (
    <div
      className={styles.scrim}
      data-shown={shown ? 'true' : undefined}
      role="presentation"
      onClick={onClose}
    >
      <aside
        aria-label="Changed files"
        className={styles.sheet}
        data-shown={shown ? 'true' : undefined}
        onClick={(event) => event.stopPropagation()}
      >
        <div aria-hidden="true" className={styles.handle} />
        <header className={styles.header}>
          <span className={styles.title}>Changed files</span>
          <span className={styles.count}>{files.length}</span>
        </header>
        <ul className={styles.list}>
          {files.map((file) => {
            const status = mapGitStatus(file.status);
            const letter = status ? STATUS_LETTER[status] : '·';
            const colorClass = status ? STATUS_CLASS[status] : undefined;
            const fileName = file.path.split('/').at(-1) ?? file.path;
            const dir = file.path.slice(0, file.path.length - fileName.length);
            const isSelected = file.path === selectedPath;
            return (
              <li key={file.path}>
                <button
                  aria-current={isSelected ? 'true' : undefined}
                  className={isSelected ? `${styles.row} ${styles.rowActive}` : styles.row}
                  type="button"
                  onClick={() => onSelect(file.path)}
                >
                  <span
                    className={`${styles.status} ${colorClass ?? ''}`}
                    title={status ?? file.status}
                  >
                    {letter}
                  </span>
                  <span className={styles.name}>
                    <span className={styles.nameStrong}>{fileName}</span>
                    {dir ? <span className={styles.dir}>{dir}</span> : null}
                  </span>
                  <span className={styles.deltas}>
                    <span className={styles.additions}>+{file.additions ?? 0}</span>
                    <span className={styles.deletions}>−{file.deletions ?? 0}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>
    </div>
  );
}
