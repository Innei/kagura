import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ImperativePanelHandle } from 'react-resizable-panels';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

import { useColorScheme } from '../../../theme/use-color-scheme';
import { useFileNav } from '../hooks/use-file-nav';
import { useKeyboardShortcuts } from '../hooks/use-keyboard-shortcuts';
import type { ReviewChangedFile, ReviewSession, ReviewTreeEntry } from '../types';
import { compareTreePaths } from '../utils/compare-paths';
import * as styles from './ReviewLayout.styles';
import type { DiffStyle, ViewMode } from './RightPane/DiffToolbar';
import { RightPane } from './RightPane/RightPane';
import { Sidebar } from './Sidebar/Sidebar';
import type { SidebarTab } from './Sidebar/SidebarTabs';
import type { FileNavView } from './Sidebar/SidebarToolbar';
import { StatusBar } from './StatusBar';
import { TitleBar } from './TitleBar';

interface ReviewLayoutProps {
  baseContent?: string | undefined;
  content?: string | undefined;
  contentLoading?: boolean;
  diff: string;
  onRequestTree?: () => void;
  onSelectPath: (path: string | undefined) => void;
  selectedPath?: string | undefined;
  session: ReviewSession;
  treeEntries?: ReviewTreeEntry[] | undefined;
  treeLoading?: boolean;
}

export function ReviewLayout({
  baseContent,
  content,
  contentLoading,
  diff,
  onRequestTree,
  onSelectPath,
  selectedPath,
  session,
  treeEntries,
  treeLoading,
}: ReviewLayoutProps) {
  const colorScheme = useColorScheme();
  const sidebarRef = useRef<ImperativePanelHandle>(null);
  const filterInputRef = useRef<HTMLInputElement | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [tab, setTab] = useState<SidebarTab>('changes');
  const [view, setView] = useState<FileNavView>('tree');
  const [filter, setFilter] = useState('');
  const [diffStyle, setDiffStyle] = useState<DiffStyle>('split');
  const [viewMode, setViewMode] = useState<ViewMode>('diff');

  const orderedChangedFiles = useMemo(() => {
    const arr = [...session.changedFiles];
    arr.sort((a, b) =>
      view === 'flat' ? a.path.localeCompare(b.path) : compareTreePaths(a.path, b.path),
    );
    return arr;
  }, [session.changedFiles, view]);

  const { goFirst, goLast, goNext, goPrevious, selectedFile, selectedIndex } = useFileNav(
    orderedChangedFiles,
    selectedPath,
    onSelectPath,
  );

  useEffect(() => {
    setViewMode('diff');
  }, [selectedPath]);

  useEffect(() => {
    if (tab === 'files') onRequestTree?.();
  }, [tab, onRequestTree]);

  const repoFiles = useMemo<ReviewChangedFile[] | undefined>(() => {
    if (!treeEntries) return undefined;
    const statusByPath = new Map(session.changedFiles.map((file) => [file.path, file]));
    return treeEntries
      .filter((entry) => entry.type === 'file')
      .map((entry) => {
        const change = statusByPath.get(entry.path);
        return {
          path: entry.path,
          status: change?.status ?? entry.status ?? '',
          additions: change?.additions ?? 0,
          deletions: change?.deletions ?? 0,
        };
      });
  }, [treeEntries, session.changedFiles]);

  const handleToggleSidebar = useCallback(() => {
    const panel = sidebarRef.current;
    if (!panel) return;
    if (panel.isCollapsed()) panel.expand();
    else panel.collapse();
  }, []);

  const handleFocusFilter = useCallback(() => {
    if (sidebarRef.current?.isCollapsed()) sidebarRef.current.expand();
    setTab('changes');
    requestAnimationFrame(() => {
      filterInputRef.current?.focus();
      filterInputRef.current?.select();
    });
  }, []);

  const handleClearFilter = useCallback(() => setFilter(''), []);

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

  return (
    <div className={styles.root}>
      <a className={styles.skipLink} href="#review-main">
        Skip to diff
      </a>
      <TitleBar session={session} />
      <PanelGroup autoSaveId="kagura-review-panel" className={styles.panels} direction="horizontal">
        <Panel
          collapsible
          collapsedSize={0}
          defaultSize={16}
          maxSize={45}
          minSize={16}
          order={1}
          ref={sidebarRef}
          onCollapse={() => setCollapsed(true)}
          onExpand={() => setCollapsed(false)}
        >
          <Sidebar
            changedFiles={session.changedFiles}
            collapsed={collapsed}
            colorScheme={colorScheme}
            filter={filter}
            filterInputRef={filterInputRef}
            repoFiles={repoFiles}
            repoLoading={treeLoading ?? false}
            selectedPath={selectedPath}
            tab={tab}
            view={view}
            onChangeFilter={setFilter}
            onChangeTab={setTab}
            onChangeView={setView}
            onClearFilter={handleClearFilter}
            onExpand={() => sidebarRef.current?.expand()}
            onSelectPath={onSelectPath}
          />
        </Panel>
        <PanelResizeHandle aria-label="Resize sidebar" className={styles.resizeHandle} />
        <Panel minSize={40} order={2}>
          <RightPane
            baseContent={baseContent}
            colorScheme={colorScheme}
            content={content}
            contentLoading={contentLoading ?? false}
            diff={diff}
            diffStyle={diffStyle}
            selectedFile={selectedFile}
            selectedPath={selectedPath}
            viewMode={viewMode}
            onChangeDiffStyle={setDiffStyle}
            onChangeViewMode={setViewMode}
            onCopyPath={handleCopyPath}
            onNext={goNext}
            onPrevious={goPrevious}
          />
        </Panel>
      </PanelGroup>
      <StatusBar
        fileTotal={session.changedFiles.length}
        selectedFile={selectedFile}
        selectedIndex={selectedIndex}
      />
    </div>
  );
}
