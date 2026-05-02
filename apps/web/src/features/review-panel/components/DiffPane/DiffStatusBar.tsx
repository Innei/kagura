import * as styles from './DiffStatusBar.css';

interface DiffStatusBarProps {
  additions?: number | undefined;
  deletions?: number | undefined;
  fileIndex?: number | undefined;
  fileStatus?: string | undefined;
  fileTotal: number;
}

export function DiffStatusBar({
  fileIndex,
  fileTotal,
  fileStatus,
  additions,
  deletions,
}: DiffStatusBarProps) {
  return (
    <div aria-live="polite" className={styles.root} role="status">
      <div className={styles.left}>
        {fileIndex !== undefined ? (
          <span>
            {fileIndex + 1} of {fileTotal}
          </span>
        ) : (
          <span>{fileTotal} files</span>
        )}
        {fileStatus ? <span>{fileStatus.toUpperCase()}</span> : null}
        {additions !== undefined && deletions !== undefined ? (
          <span>
            <span className={styles.additions}>+{additions}</span>{' '}
            <span className={styles.deletions}>−{deletions}</span>
          </span>
        ) : null}
      </div>
      <div className={styles.right}>
        <span style={{ display: 'flex', gap: '6px' }}>
          <span className={styles.kbd}>j</span>
          <span className={styles.kbd}>k</span> navigate
        </span>
        <span>
          <span className={styles.kbd}>/</span> filter
        </span>
        <span>
          <span className={styles.kbd}>[</span> sidebar
        </span>
      </div>
    </div>
  );
}
