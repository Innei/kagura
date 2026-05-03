import { useMemo } from 'react';

import type { ReviewSession } from '../types';
import * as styles from './TitleBar.styles';

interface TitleBarProps {
  session: ReviewSession;
}

export function TitleBar({ session }: TitleBarProps) {
  const totals = useMemo(() => {
    let additions = 0;
    let deletions = 0;
    for (const file of session.changedFiles) {
      additions += file.additions ?? 0;
      deletions += file.deletions ?? 0;
    }
    return { additions, deletions };
  }, [session.changedFiles]);

  const repo = session.workspaceLabel ?? session.workspaceRepoId ?? 'Review';
  const branch = formatBranch(session);
  const fileCount = session.changedFiles.length;

  return (
    <header className={styles.root}>
      <span className={styles.repo} title={repo}>
        {repo}
      </span>
      {branch ? (
        <span className={styles.branch} title={`${branch.base ?? ''} → ${branch.head ?? ''}`}>
          {branch.base}
          {branch.base && branch.head ? <span className={styles.branchArrow}>→</span> : null}
          {branch.head}
        </span>
      ) : null}
      <span className={styles.summary}>
        <span>
          {fileCount} {fileCount === 1 ? 'file' : 'files'}
        </span>
        <span className={styles.deltas}>
          <span className={styles.additions}>+{totals.additions}</span>
          <span className={styles.deletions}>−{totals.deletions}</span>
        </span>
      </span>
    </header>
  );
}

function formatBranch(
  session: ReviewSession,
): { base?: string | undefined; head?: string | undefined } | undefined {
  const base = session.baseBranch;
  const head = session.head?.slice(0, 7);
  if (!base && !head) return undefined;
  return { base, head };
}
