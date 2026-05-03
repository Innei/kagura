import type { RefObject } from 'react';

import type { ReviewChangedFile } from '../../types';
import { FileTree } from './FileTree';
import * as styles from './Sidebar.styles';
import type { SidebarTab } from './SidebarTabs';
import { SidebarTabs } from './SidebarTabs';
import type { FileNavView } from './SidebarToolbar';
import { SidebarToolbar } from './SidebarToolbar';

interface SidebarProps {
  changedFiles: ReviewChangedFile[];
  collapsed: boolean;
  colorScheme: 'dark' | 'light';
  filter: string;
  filterInputRef?: RefObject<HTMLInputElement | null> | undefined;
  onChangeFilter: (next: string) => void;
  onChangeTab: (next: SidebarTab) => void;
  onChangeView: (next: FileNavView) => void;
  onClearFilter: () => void;
  onExpand: () => void;
  onSelectPath: (path: string) => void;
  repoFiles?: ReviewChangedFile[] | undefined;
  repoLoading: boolean;
  selectedPath?: string | undefined;
  tab: SidebarTab;
  view: FileNavView;
}

export function Sidebar({
  changedFiles,
  collapsed,
  colorScheme,
  filter,
  filterInputRef,
  onChangeFilter,
  onChangeTab,
  onChangeView,
  onClearFilter,
  _onExpand,
  onSelectPath,
  repoFiles,
  repoLoading,
  selectedPath,
  tab,
  view,
}: SidebarProps) {
  if (collapsed) {
    return null;
  }

  const isFiles = tab === 'files';
  const activeFiles = isFiles ? (repoFiles ?? []) : changedFiles;
  const ariaLabel = isFiles ? 'Repository files' : 'Changed files';
  const showLoading = isFiles && repoLoading && !repoFiles;

  return (
    <aside aria-label={ariaLabel} className={styles.root}>
      <SidebarTabs
        changesCount={changedFiles.length}
        filesCount={repoFiles?.length}
        value={tab}
        onChange={onChangeTab}
      />
      <SidebarToolbar
        filter={filter}
        filterInputRef={filterInputRef}
        view={view}
        onChangeFilter={onChangeFilter}
        onChangeView={onChangeView}
        onClearFilter={onClearFilter}
      />
      {showLoading ? (
        <div className={styles.loading}>Loading repository files…</div>
      ) : (
        <FileTree
          colorScheme={colorScheme}
          files={activeFiles}
          filter={filter}
          key={tab}
          selectedPath={selectedPath}
          view={view}
          onSelectPath={onSelectPath}
        />
      )}
    </aside>
  );
}
