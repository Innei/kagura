import * as styles from '../../../styles.css';
import type { ReviewChangedFile } from '../types';

export function ChangedFiles({
  files,
  onSelectPath,
  selectedPath,
}: {
  files: ReviewChangedFile[];
  onSelectPath: (path: string) => void;
  selectedPath?: string | undefined;
}) {
  if (files.length === 0) {
    return <div className={styles.emptyList}>No changed files.</div>;
  }

  return (
    <div className={styles.changedList}>
      {files.map((file) => (
        <button
          key={file.path}
          title={file.path}
          type="button"
          className={
            file.path === selectedPath
              ? `${styles.fileRow} ${styles.activeFileRow}`
              : styles.fileRow
          }
          onClick={() => onSelectPath(file.path)}
        >
          <span className={styles.status}>{file.status}</span>
          <span className={styles.path}>{file.path}</span>
        </button>
      ))}
    </div>
  );
}
