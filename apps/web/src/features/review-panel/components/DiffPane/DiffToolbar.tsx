import { ChevronDown, ChevronUp, Copy, GitCompare } from 'lucide-react';

import { SegmentedControl } from '../Sidebar/SegmentedControl';
import * as styles from './DiffToolbar.styles';

export type DiffStyle = 'split' | 'unified';

interface DiffToolbarProps {
  diffStyle: DiffStyle;
  onChangeDiffStyle: (next: DiffStyle) => void;
  onCopyPath: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSelectFullDiff: () => void;
  selectedPath?: string | undefined;
}

const STYLE_OPTIONS = [
  { value: 'split' as const, label: 'Split' },
  { value: 'unified' as const, label: 'Unified' },
];

const ICON_SIZE = 12;

export function DiffToolbar({
  diffStyle,
  onChangeDiffStyle,
  onCopyPath,
  onNext,
  onPrevious,
  onSelectFullDiff,
  selectedPath,
}: DiffToolbarProps) {
  const segments = selectedPath?.split('/') ?? [];
  const fileName = segments.at(-1) ?? '';
  const folderPath = segments.slice(0, -1).join('/');

  return (
    <div aria-label="Diff actions" className={styles.root} role="toolbar">
      <div className={styles.navGroup}>
        <button
          aria-label="Previous file"
          className={`${styles.iconButton} ${styles.squareButton}`}
          title="Previous file (k)"
          type="button"
          onClick={onPrevious}
        >
          <ChevronUp aria-hidden="true" size={ICON_SIZE} />
        </button>
        <button
          aria-label="Next file"
          className={`${styles.iconButton} ${styles.squareButton}`}
          title="Next file (j)"
          type="button"
          onClick={onNext}
        >
          <ChevronDown aria-hidden="true" size={ICON_SIZE} />
        </button>
      </div>
      <div aria-live="polite" className={styles.breadcrumb}>
        {selectedPath ? (
          <>
            {folderPath ? `${folderPath}/` : ''}
            <span className={styles.breadcrumbStrong}>{fileName}</span>
          </>
        ) : (
          <span className={styles.allBadge}>All changed files</span>
        )}
      </div>
      <button
        className={styles.iconButton}
        disabled={!selectedPath}
        title="Show full diff"
        type="button"
        onClick={onSelectFullDiff}
      >
        <GitCompare aria-hidden="true" size={ICON_SIZE} />
        Full diff
      </button>
      <SegmentedControl
        ariaLabel="Diff layout"
        options={STYLE_OPTIONS}
        value={diffStyle}
        onChange={onChangeDiffStyle}
      />
      <button
        aria-label="Copy file path"
        className={`${styles.iconButton} ${styles.squareButton}`}
        disabled={!selectedPath}
        title="Copy file path"
        type="button"
        onClick={onCopyPath}
      >
        <Copy aria-hidden="true" size={ICON_SIZE} />
      </button>
    </div>
  );
}
