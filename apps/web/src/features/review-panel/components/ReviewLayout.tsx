import * as styles from '../../../styles.css';
import type { ReviewSession, ReviewTreeEntry } from '../types';
import { ChangedFiles } from './ChangedFiles';
import { DiffView } from './DiffView';
import { ReviewFileTree } from './ReviewFileTree';

export function ReviewLayout({
  diff,
  onSelectPath,
  selectedPath,
  session,
  treeEntries,
}: {
  diff: string;
  onSelectPath: (path: string | undefined) => void;
  selectedPath?: string | undefined;
  session: ReviewSession;
  treeEntries: ReviewTreeEntry[];
}) {
  return (
    <div className={`${styles.appFrame} ${styles.reviewShell}`}>
      <aside className={styles.sidebar}>
        <header className={styles.sidebarHeader}>
          <strong className={styles.sidebarTitle}>
            {session.workspaceLabel ?? session.workspaceRepoId ?? 'Review'}
          </strong>
          <small className={styles.sidebarMeta}>
            {session.status} · {session.executionId}
          </small>
        </header>

        <section className={styles.sidebarSection}>
          <div className={styles.sectionTitle}>Changed Files</div>
          <ChangedFiles
            files={session.changedFiles}
            selectedPath={selectedPath}
            onSelectPath={onSelectPath}
          />
        </section>

        <section className={styles.treeSection}>
          <div className={styles.sectionTitle}>File Tree</div>
          <ReviewFileTree
            entries={treeEntries}
            selectedPath={selectedPath}
            onSelectPath={onSelectPath}
          />
        </section>
      </aside>

      <main className={styles.diffPane}>
        <div className={styles.toolbar}>
          <button
            className={styles.toolbarButton}
            type="button"
            onClick={() => onSelectPath(undefined)}
          >
            Full Diff
          </button>
          <span className={styles.toolbarLabel}>{selectedPath ?? 'All changed files'}</span>
        </div>
        <DiffView diff={diff} />
      </main>
    </div>
  );
}
