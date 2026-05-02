import { PatchDiff } from '@pierre/diffs/react';

import { splitPatch } from '../../utils/split-patch';
import type { DiffStyle } from './DiffToolbar';
import * as styles from './DiffView.styles';

interface DiffViewProps {
  colorScheme: 'dark' | 'light';
  diff: string;
  diffStyle: DiffStyle;
}

export function DiffView({ colorScheme, diff, diffStyle }: DiffViewProps) {
  if (!diff.trim()) {
    return <div className={styles.empty}>No diff.</div>;
  }

  const patches = splitPatch(diff);
  return (
    <div className={styles.content}>
      {patches.map((patch, index) => (
        <div className={styles.patch} key={`${index}:${patch.slice(0, 80)}`}>
          <PatchDiff
            disableWorkerPool
            patch={patch}
            options={{
              diffIndicators: 'classic',
              diffStyle,
              hunkSeparators: 'line-info-basic',
              lineDiffType: 'word',
              theme: { dark: 'pierre-dark', light: 'pierre-light' },
              themeType: colorScheme,
            }}
          />
        </div>
      ))}
    </div>
  );
}
