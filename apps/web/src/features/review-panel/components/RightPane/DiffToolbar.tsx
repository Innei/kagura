import { ChevronDown, ChevronUp, Copy } from 'lucide-react';
import { Fragment } from 'react';

import { Pill } from '../Pill';
import * as styles from './DiffToolbar.styles';

export type DiffStyle = 'split' | 'unified';
export type ViewMode = 'diff' | 'source';

interface DiffToolbarProps {
  diffStyle: DiffStyle;
  hasDiff: boolean;
  onChangeDiffStyle: (next: DiffStyle) => void;
  onChangeViewMode: (next: ViewMode) => void;
  onCopyPath: () => void;
  onNext: () => void;
  onPrevious: () => void;
  selectedPath?: string | undefined;
  sourceAvailable: boolean;
  viewMode: ViewMode;
}

const STYLE_OPTIONS = [
  { value: 'split' as const, label: 'Split' },
  { value: 'unified' as const, label: 'Unified' },
];

const ICON_SIZE = 12;

export function DiffToolbar({
  diffStyle,
  hasDiff,
  onChangeDiffStyle,
  onChangeViewMode,
  onCopyPath,
  onNext,
  onPrevious,
  selectedPath,
  sourceAvailable,
  viewMode,
}: DiffToolbarProps) {
  const segments = selectedPath?.split('/') ?? [];
  const fileName = segments.at(-1) ?? '';
  const folderSegments = segments.slice(0, -1);

  const viewOptions = [
    { value: 'diff' as const, label: 'Diff' },
    { value: 'source' as const, label: 'Source', disabled: !sourceAvailable },
  ];

  const showPills = Boolean(selectedPath) && hasDiff;
  const showStyle = showPills && viewMode === 'diff';

  return (
    <div aria-label="Diff actions" className={styles.root} role="toolbar">
      <div className={styles.navGroup}>
        <button
          aria-label="Previous file"
          className={styles.iconButton}
          title="Previous file (k)"
          type="button"
          onClick={onPrevious}
        >
          <ChevronUp aria-hidden="true" size={ICON_SIZE} />
        </button>
        <button
          aria-label="Next file"
          className={styles.iconButton}
          title="Next file (j)"
          type="button"
          onClick={onNext}
        >
          <ChevronDown aria-hidden="true" size={ICON_SIZE} />
        </button>
      </div>
      <div aria-live="polite" className={styles.breadcrumb} title={selectedPath}>
        {selectedPath ? (
          <>
            {folderSegments.map((segment, index) => (
              <Fragment key={`${index}:${segment}`}>
                {segment}
                <span className={styles.breadcrumbSep}>/</span>
              </Fragment>
            ))}
            <span className={styles.breadcrumbStrong}>{fileName}</span>
          </>
        ) : (
          <span className={styles.allBadge}>All changed files</span>
        )}
      </div>
      {showStyle ? (
        <Pill
          ariaLabel="Diff layout"
          options={STYLE_OPTIONS}
          value={diffStyle}
          onChange={onChangeDiffStyle}
        />
      ) : null}
      {showPills ? (
        <Pill
          ariaLabel="View mode"
          options={viewOptions}
          value={viewMode}
          onChange={onChangeViewMode}
        />
      ) : null}

      {showPills ? <span aria-hidden="true" className={styles.divider} /> : null}
      <button
        aria-label="Copy file path"
        className={styles.iconButton}
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
