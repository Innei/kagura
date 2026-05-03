import { Search } from 'lucide-react';
import type { ChangeEvent, KeyboardEvent, RefObject } from 'react';

import * as styles from './SidebarToolbar.styles';

export type FileNavView = 'tree' | 'flat';

interface SidebarToolbarProps {
  filter: string;
  filterInputRef?: RefObject<HTMLInputElement | null> | undefined;
  onChangeFilter: (next: string) => void;
  onChangeView: (next: FileNavView) => void;
  onClearFilter: () => void;
  view: FileNavView;
}

const VIEWS: ReadonlyArray<{ label: string; value: FileNavView }> = [
  { value: 'tree', label: 'Tree' },
  { value: 'flat', label: 'Flat' },
];

export function SidebarToolbar({
  filter,
  filterInputRef,
  onChangeFilter,
  onChangeView,
  onClearFilter,
  view,
}: SidebarToolbarProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => onChangeFilter(event.target.value);
  const handleKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClearFilter();
      event.currentTarget.blur();
    }
  };

  return (
    <div className={styles.root}>
      <label className={styles.filterField}>
        <Search aria-hidden="true" className={styles.filterIcon} size={12} />
        <input
          aria-label="Filter files"
          className={styles.filterInput}
          placeholder="Filter files…"
          ref={filterInputRef}
          type="search"
          value={filter}
          onChange={handleChange}
          onKeyDown={handleKey}
        />
      </label>
      <div aria-label="File list view" className={styles.viewGroup} role="tablist">
        {VIEWS.map((option, index) => {
          const selected = option.value === view;
          return (
            <span key={option.value}>
              {index > 0 ? <span className={styles.viewSeparator}>/</span> : null}
              <button
                aria-selected={selected}
                className={styles.viewButton}
                role="tab"
                tabIndex={selected ? 0 : -1}
                type="button"
                onClick={() => {
                  if (!selected) onChangeView(option.value);
                }}
              >
                {option.label}
              </button>
            </span>
          );
        })}
      </div>
    </div>
  );
}
