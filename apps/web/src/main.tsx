import './styles.css';

import { PatchDiff } from '@pierre/diffs/react';
import { FileTree, useFileTree, useFileTreeSelection } from '@pierre/trees/react';
import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';

interface ReviewChangedFile {
  path: string;
  status: string;
}

interface ReviewTreeEntry {
  path: string;
  status?: string | undefined;
  type: 'file';
}

interface ReviewSession {
  baseBranch?: string | undefined;
  baseHead?: string | undefined;
  changedFiles: ReviewChangedFile[];
  executionId: string;
  head?: string | undefined;
  status: string;
  threadTs: string;
  workspaceLabel?: string | undefined;
  workspacePath: string;
  workspaceRepoId?: string | undefined;
}

interface ReviewTreeResponse {
  entries: ReviewTreeEntry[];
}

interface ReviewDiffResponse {
  diff: string;
}

const executionId = getExecutionId();

function App() {
  const [session, setSession] = useState<ReviewSession | undefined>();
  const [treeEntries, setTreeEntries] = useState<ReviewTreeEntry[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | undefined>();
  const [diff, setDiff] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    void loadInitialData(executionId)
      .then(({ nextSession, nextTreeEntries }) => {
        setSession(nextSession);
        setTreeEntries(nextTreeEntries);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (loading || error) return;
    void loadDiff(executionId, selectedPath)
      .then((nextDiff) => setDiff(nextDiff))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      });
  }, [error, loading, selectedPath]);

  if (loading) {
    return <ShellState text="Loading review..." />;
  }

  if (error || !session) {
    return <ShellState text={error ?? 'Review not found.'} />;
  }

  return (
    <ReviewLayout
      diff={diff}
      selectedPath={selectedPath}
      session={session}
      treeEntries={treeEntries}
      onSelectPath={setSelectedPath}
    />
  );
}

function ReviewLayout({
  diff,
  onSelectPath,
  selectedPath,
  session,
  treeEntries,
}: {
  diff: string;
  onSelectPath: (path: string | undefined) => void;
  selectedPath?: string | undefined;
  session: ReviewSession;
  treeEntries: ReviewTreeEntry[];
}) {
  return (
    <div className="review-shell">
      <aside className="sidebar">
        <header className="sidebar-header">
          <strong>{session.workspaceLabel ?? session.workspaceRepoId ?? 'Review'}</strong>
          <small>
            {session.status} · {session.executionId}
          </small>
        </header>

        <section className="sidebar-section">
          <div className="section-title">Changed Files</div>
          <ChangedFiles
            files={session.changedFiles}
            selectedPath={selectedPath}
            onSelectPath={onSelectPath}
          />
        </section>

        <section className="sidebar-section tree-section">
          <div className="section-title">File Tree</div>
          <ReviewFileTree
            entries={treeEntries}
            selectedPath={selectedPath}
            onSelectPath={onSelectPath}
          />
        </section>
      </aside>

      <main className="diff-pane">
        <div className="toolbar">
          <button type="button" onClick={() => onSelectPath(undefined)}>
            Full Diff
          </button>
          <span>{selectedPath ?? 'All changed files'}</span>
        </div>
        <DiffView diff={diff} />
      </main>
    </div>
  );
}

function ChangedFiles({
  files,
  onSelectPath,
  selectedPath,
}: {
  files: ReviewChangedFile[];
  onSelectPath: (path: string) => void;
  selectedPath?: string | undefined;
}) {
  if (files.length === 0) {
    return <div className="empty-list">No changed files.</div>;
  }

  return (
    <div className="changed-list">
      {files.map((file) => (
        <button
          className={file.path === selectedPath ? 'file-row active' : 'file-row'}
          key={file.path}
          title={file.path}
          type="button"
          onClick={() => onSelectPath(file.path)}
        >
          <span className="status">{file.status}</span>
          <span className="path">{file.path}</span>
        </button>
      ))}
    </div>
  );
}

function ReviewFileTree({
  entries,
  onSelectPath,
  selectedPath,
}: {
  entries: ReviewTreeEntry[];
  onSelectPath: (path: string) => void;
  selectedPath?: string | undefined;
}) {
  const paths = useMemo(() => entries.map((entry) => entry.path), [entries]);
  const gitStatus = useMemo(
    () =>
      entries.flatMap((entry) => {
        const status = mapGitStatus(entry.status);
        return status ? [{ path: entry.path, status }] : [];
      }),
    [entries],
  );
  const { model } = useFileTree({
    density: 'compact',
    flattenEmptyDirectories: true,
    gitStatus,
    initialExpansion: 'open',
    paths,
    stickyFolders: true,
  });
  const selectedPaths = useFileTreeSelection(model);

  useEffect(() => {
    const selected = selectedPaths.find((path) => entries.some((entry) => entry.path === path));
    if (selected && selected !== selectedPath) {
      onSelectPath(selected);
    }
  }, [entries, onSelectPath, selectedPath, selectedPaths]);

  useEffect(() => {
    if (!selectedPath) return;
    const item = model.getItem(selectedPath);
    item?.select();
    item?.focus();
  }, [model, selectedPath]);

  return <FileTree className="file-tree" model={model} />;
}

function DiffView({ diff }: { diff: string }) {
  if (!diff.trim()) {
    return <div className="diff-empty">No diff.</div>;
  }

  const patches = splitPatch(diff);
  return (
    <div className="diff-content">
      {patches.map((patch, index) => (
        <PatchDiff
          disableWorkerPool
          key={`${index}:${patch.slice(0, 80)}`}
          patch={patch}
          options={{
            diffIndicators: 'classic',
            diffStyle: 'split',
            hunkSeparators: 'line-info-basic',
            lineDiffType: 'word',
            themeType: 'light',
          }}
        />
      ))}
    </div>
  );
}

function ShellState({ text }: { text: string }) {
  return <div className="shell-state">{text}</div>;
}

async function loadInitialData(reviewExecutionId: string) {
  const [nextSession, nextTree] = await Promise.all([
    getJson<ReviewSession>(`/api/reviews/${encodeURIComponent(reviewExecutionId)}`),
    getJson<ReviewTreeResponse>(`/api/reviews/${encodeURIComponent(reviewExecutionId)}/tree`),
  ]);

  return {
    nextSession,
    nextTreeEntries: nextTree.entries,
  };
}

async function loadDiff(reviewExecutionId: string, filePath?: string | undefined) {
  const suffix = filePath ? `?path=${encodeURIComponent(filePath)}` : '';
  const payload = await getJson<ReviewDiffResponse>(
    `/api/reviews/${encodeURIComponent(reviewExecutionId)}/diff${suffix}`,
  );
  return payload.diff;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return (await response.json()) as T;
}

function getExecutionId(): string {
  const match = window.location.pathname.match(/^\/reviews\/([^/]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : '';
}

function mapGitStatus(status: string | undefined) {
  if (!status) return undefined;
  if (status === '??') return 'untracked' as const;
  if (status.startsWith('A')) return 'added' as const;
  if (status.startsWith('D')) return 'deleted' as const;
  if (status.startsWith('R')) return 'renamed' as const;
  if (status.startsWith('M')) return 'modified' as const;
  return 'modified' as const;
}

function splitPatch(diff: string): string[] {
  const chunks = diff.split(/(?=^diff --git )/gm).filter((chunk) => chunk.trim());
  return chunks.length > 0 ? chunks : [diff];
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
