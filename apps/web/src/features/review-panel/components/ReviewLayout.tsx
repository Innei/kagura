import { ChevronRight } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { ImperativePanelHandle } from 'react-resizable-panels';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

import { useColorScheme } from '../../../theme/use-color-scheme';
import { useFileNav } from '../hooks/use-file-nav';
import { useKeyboardShortcuts } from '../hooks/use-keyboard-shortcuts';
import type { ReviewSession } from '../types';
import { DiffPane } from './DiffPane/DiffPane';
import type { DiffStyle } from './DiffPane/DiffToolbar';
import * as styles from './ReviewLayout.css';
import { FileNav } from './Sidebar/FileNav';
import type { FileNavView } from './Sidebar/SidebarHeader';
import { SidebarHeader } from './Sidebar/SidebarHeader';

interface ReviewLayoutProps {
  diff: string;
  onSelectPath: (path: string | undefined) => void;
  selectedPath?: string | undefined;
  session: ReviewSession;
}

export function ReviewLayout({ diff, onSelectPath, selectedPath, session }: ReviewLayoutProps) {
  const colorScheme = useColorScheme();
  const sidebarRef = useRef<ImperativePanelHandle>(null);
  const filterInputRef = useRef<HTMLInputElement | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [view, setView] = useState<FileNavView>('tree');
  const [filter, setFilter] = useState('');
  const [diffStyle, setDiffStyle] = useState<DiffStyle>('split');

  const totals = useMemo(() => {
    let additions = 0;
    let deletions = 0;
    for (const file of session.changedFiles) {
      additions += file.additions ?? 0;
      deletions += file.deletions ?? 0;
    }
    return { additions, deletions };
  }, [session.changedFiles]);

  const { goFirst, goLast, goNext, goPrevious, selectedFile, selectedIndex } = useFileNav(
    session.changedFiles,
    selectedPath,
    onSelectPath,
  );

  const handleToggleSidebar = useCallback(() => {
    const panel = sidebarRef.current;
    if (!panel) return;
    if (panel.isCollapsed()) panel.expand();
    else panel.collapse();
  }, []);

  const handleFocusFilter = useCallback(() => {
    if (sidebarRef.current?.isCollapsed()) sidebarRef.current.expand();
    requestAnimationFrame(() => {
      filterInputRef.current?.focus();
      filterInputRef.current?.select();
    });
  }, []);

  const handleClearFilter = useCallback(() => {
    setFilter('');
  }, []);

  const handleCopyPath = useCallback(() => {
    if (!selectedFile) return;
    void navigator.clipboard?.writeText(selectedFile.path);
  }, [selectedFile]);

  useKeyboardShortcuts({
    onFirst: goFirst,
    onFocusFilter: handleFocusFilter,
    onLast: goLast,
    onNext: goNext,
    onPrevious: goPrevious,
    onToggleSidebar: handleToggleSidebar,
  });

  const branchLabel = formatBranch(session);
  const repo = session.workspaceLabel ?? session.workspaceRepoId ?? 'Review';

  return (
    <div className={styles.root}>
      <a className={styles.skipLink} href="#review-main">
        Skip to diff
      </a>
      <PanelGroup
        autoSaveId="kagura-review-panel"
        direction="horizontal"
        style={{ height: '100%', width: '100%' }}
      >
        <Panel
          collapsible
          collapsedSize={3}
          defaultSize={26}
          maxSize={45}
          minSize={16}
          order={1}
          ref={sidebarRef}
          onCollapse={() => setCollapsed(true)}
          onExpand={() => setCollapsed(false)}
        >
          {collapsed ? (
            <aside aria-label="Sidebar (collapsed)" className={styles.sidebarCollapsed}>
              <button
                aria-label="Expand sidebar"
                className={styles.expandButton}
                title="Expand sidebar ([)"
                type="button"
                onClick={() => sidebarRef.current?.expand()}
              >
                <ChevronRight aria-hidden="true" size={14} />
              </button>
            </aside>
          ) : (
            <aside aria-label="Changed files" className={styles.sidebar}>
              <SidebarHeader
                additions={totals.additions}
                branchLabel={branchLabel}
                deletions={totals.deletions}
                fileCount={session.changedFiles.length}
                filter={filter}
                filterInputRef={filterInputRef}
                repo={repo}
                view={view}
                onChangeFilter={setFilter}
                onChangeView={setView}
                onClearFilter={handleClearFilter}
              />
              <FileNav
                changedFiles={session.changedFiles}
                colorScheme={colorScheme}
                filter={filter}
                selectedPath={selectedPath}
                view={view}
                onSelectPath={onSelectPath}
              />
            </aside>
          )}
        </Panel>
        <PanelResizeHandle aria-label="Resize sidebar" className={styles.resizeHandle} />
        <Panel minSize={40} order={2}>
          <DiffPane
            colorScheme={colorScheme}
            diff={diff}
            diffStyle={diffStyle}
            fileTotal={session.changedFiles.length}
            selectedFile={selectedFile}
            selectedIndex={selectedIndex}
            onChangeDiffStyle={setDiffStyle}
            onCopyPath={handleCopyPath}
            onNext={goNext}
            onPrevious={goPrevious}
            onSelectFullDiff={() => onSelectPath(undefined)}
          />
        </Panel>
      </PanelGroup>
    </div>
  );
}

function formatBranch(session: ReviewSession): string | undefined {
  const base = session.baseBranch;
  const head = session.head?.slice(0, 7);
  if (base && head) return `${base} → ${head}`;
  if (base) return base;
  if (head) return head;
  return undefined;
}
