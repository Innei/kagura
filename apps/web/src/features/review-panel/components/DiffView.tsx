import { PatchDiff } from '@pierre/diffs/react';

import * as styles from '../../../styles.css';
import { splitPatch } from '../utils/split-patch';

export function DiffView({ diff }: { diff: string }) {
  if (!diff.trim()) {
    return <div className={styles.diffEmpty}>No diff.</div>;
  }

  const patches = splitPatch(diff);
  return (
    <div className={styles.diffContent}>
      {patches.map((patch, index) => (
        <div className={styles.diffPatch} key={`${index}:${patch.slice(0, 80)}`}>
          <PatchDiff
            disableWorkerPool
            patch={patch}
            options={{
              diffIndicators: 'classic',
              diffStyle: 'split',
              hunkSeparators: 'line-info-basic',
              lineDiffType: 'word',
              themeType: 'light',
            }}
          />
        </div>
      ))}
    </div>
  );
}
