import { Search } from 'lucide-react';
import type { ChangeEvent, KeyboardEvent, RefObject } from 'react';

import * as styles from './SidebarHeader.styles';

export type FileNavView = 'tree' | 'flat';

interface SidebarHeaderProps {
  additions: number;
  branchLabel?: string | undefined;
  deletions: number;
  fileCount: number;
  filter: string;
  filterInputRef?: RefObject<HTMLInputElement | null>;
  onChangeFilter: (next: string) => void;
  onChangeView: (next: FileNavView) => void;
  onClearFilter: () => void;
  repo: string;
  view: FileNavView;
}

const VIEW_OPTIONS: ReadonlyArray<{ label: string; value: FileNavView }> = [
  { value: 'tree', label: 'Tree' },
  { value: 'flat', label: 'Flat' },
];

export function SidebarHeader({
  additions,
  branchLabel,
  deletions,
  fileCount,
  filter,
  filterInputRef,
  onChangeFilter,
  onChangeView,
  onClearFilter,
  repo,
  view,
}: SidebarHeaderProps) {
  const handleFilterChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChangeFilter(event.target.value);
  };
  const handleFilterKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClearFilter();
      event.currentTarget.blur();
    }
  };

  return (
    <header className={styles.root}>
      <div className={styles.meta}>
        <span className={styles.repo} title={repo}>
          {repo}
        </span>
        {branchLabel ? <div className={styles.branch}>{branchLabel}</div> : null}
        <div className={styles.counts}>
          <span>
            {fileCount} {fileCount === 1 ? 'file' : 'files'}
          </span>
          <span>
            <span className={styles.additions}>+{additions}</span>{' '}
            <span className={styles.deletions}>−{deletions}</span>
          </span>
        </div>
      </div>
      <div className={styles.filterContainer}>
        <label className={styles.filterField}>
          <Search aria-hidden="true" className={styles.filterIcon} size={14} />
          <input
            aria-label="Filter files"
            className={styles.filterInput}
            placeholder="Filter files…"
            ref={filterInputRef}
            type="search"
            value={filter}
            onChange={handleFilterChange}
            onKeyDown={handleFilterKey}
          />
        </label>
        <div aria-label="File list view" className={styles.viewSwitch} role="tablist">
          {VIEW_OPTIONS.map((option) => {
            const selected = option.value === view;
            return (
              <button
                aria-selected={selected}
                key={option.value}
                role="tab"
                tabIndex={selected ? 0 : -1}
                type="button"
                className={
                  selected ? `${styles.viewButton} ${styles.viewButtonActive}` : styles.viewButton
                }
                onClick={() => onChangeView(option.value)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
