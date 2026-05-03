import type { ReviewChangedFile } from '../types';
import { mapGitStatus } from '../utils/git-status';
import * as styles from './StatusBar.styles';

interface StatusBarProps {
  fileTotal: number;
  selectedFile?: ReviewChangedFile | undefined;
  selectedIndex?: number | undefined;
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

const HINTS: ReadonlyArray<{ keys: string[]; action: string }> = [
  { keys: ['j', 'k'], action: 'navigate' },
  { keys: ['/'], action: 'filter' },
  { keys: ['['], action: 'sidebar' },
];

function HintGroup() {
  return (
    <span className={styles.hint}>
      {HINTS.map((hint) => (
        <span className={styles.hintItem} key={hint.action}>
          {hint.keys.map((key) => (
            <span className={styles.kbd} key={key}>
              {key}
            </span>
          ))}
          <span className={styles.action}>{hint.action}</span>
        </span>
      ))}
    </span>
  );
}

export function StatusBar({ fileTotal, selectedFile, selectedIndex }: StatusBarProps) {
  if (!selectedFile) {
    return (
      <footer aria-live="polite" className={styles.root} role="status">
        <span className={styles.empty}>
          {fileTotal} {fileTotal === 1 ? 'changed file' : 'changed files'} · select one to inspect
        </span>
        <HintGroup />
      </footer>
    );
  }

  const status = mapGitStatus(selectedFile.status);
  const letter = status ? STATUS_LETTER[status] : '·';
  const colorClass = status ? STATUS_CLASS[status] : undefined;
  const additions = selectedFile.additions ?? 0;
  const deletions = selectedFile.deletions ?? 0;
  const fileName = selectedFile.path.split('/').at(-1) ?? selectedFile.path;
  const positionLabel =
    selectedIndex !== undefined ? `${selectedIndex + 1} / ${fileTotal}` : `${fileTotal}`;

  return (
    <footer aria-live="polite" className={styles.root} role="status">
      <span
        className={`${styles.status} ${colorClass ?? ''}`}
        title={status ?? selectedFile.status}
      >
        {letter}
      </span>
      <span className={styles.filename} title={selectedFile.path}>
        {fileName}
      </span>
      <span className={styles.deltas}>
        <span className={styles.additions}>+{additions}</span>
        <span className={styles.deletions}>−{deletions}</span>
      </span>
      <span aria-hidden="true" className={styles.divider} />
      <span className={styles.position}>{positionLabel}</span>
      <HintGroup />
    </footer>
  );
}
