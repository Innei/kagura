import { useEffect, useState } from 'react';

import {
  loadDiff,
  loadFile,
  loadInitialReviewData,
  loadTree,
} from '../features/review-panel/api/review-api';
import { ReviewLayout } from '../features/review-panel/components/ReviewLayout';
import { ShellState } from '../features/review-panel/components/ShellState';
import type { ReviewSession, ReviewTreeEntry } from '../features/review-panel/types';

interface ReviewPageProps {
  apiBasePath: string;
  executionId: string;
}

function readPathFromUrl(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const value = new URLSearchParams(window.location.search).get('path');
  return value || undefined;
}

function readViewFromUrl(): 'diff' | 'source' | undefined {
  if (typeof window === 'undefined') return undefined;
  const value = new URLSearchParams(window.location.search).get('view');
  return value === 'source' || value === 'diff' ? value : undefined;
}

export function ReviewPage({ apiBasePath, executionId }: ReviewPageProps) {
  const [session, setSession] = useState<ReviewSession | undefined>();
  const [selectedPath, setSelectedPath] = useState<string | undefined>(() => readPathFromUrl());
  const [diff, setDiff] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [treeEntries, setTreeEntries] = useState<ReviewTreeEntry[] | undefined>();
  const [treeLoading, setTreeLoading] = useState(false);
  const [content, setContent] = useState<string | undefined>(undefined);
  const [contentLoading, setContentLoading] = useState(false);
  const [baseContent, setBaseContent] = useState<string | undefined>(undefined);
  const initialView = readViewFromUrl();

  useEffect(() => {
    setLoading(true);
    setError(undefined);
    setSession(undefined);
    setSelectedPath(readPathFromUrl());
    setDiff('');
    void loadInitialReviewData(executionId, apiBasePath)
      .then(({ session: nextSession }) => {
        setSession(nextSession);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });
  }, [apiBasePath, executionId]);

  useEffect(() => {
    if (loading || error) return;
    void loadDiff(executionId, selectedPath, apiBasePath)
      .then((nextDiff) => setDiff(nextDiff))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      });
  }, [apiBasePath, error, executionId, loading, selectedPath]);

  useEffect(() => {
    if (loading || error) return;
    if (!selectedPath) {
      setContent(undefined);
      setBaseContent(undefined);
      return;
    }
    setContentLoading(true);
    let cancelled = false;
    void Promise.all([
      loadFile(executionId, selectedPath, apiBasePath, 'head'),
      loadFile(executionId, selectedPath, apiBasePath, 'base'),
    ])
      .then(([head, base]) => {
        if (cancelled) return;
        setContent(head);
        setBaseContent(base);
        setContentLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setContent(undefined);
        setBaseContent(undefined);
        setContentLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiBasePath, error, executionId, loading, selectedPath]);

  if (loading) {
    return <ShellState text="Loading review..." />;
  }

  if (error || !session) {
    return <ShellState text={error ?? 'Review not found.'} />;
  }

  const handleRequestTree = () => {
    if (treeEntries || treeLoading) return;
    setTreeLoading(true);
    void loadTree(executionId, apiBasePath)
      .then((entries) => {
        setTreeEntries(entries);
        setTreeLoading(false);
      })
      .catch(() => {
        setTreeEntries([]);
        setTreeLoading(false);
      });
  };

  return (
    <ReviewLayout
      baseContent={baseContent}
      content={content}
      contentLoading={contentLoading}
      diff={diff}
      initialViewMode={initialView}
      selectedPath={selectedPath}
      session={session}
      treeEntries={treeEntries}
      treeLoading={treeLoading}
      onRequestTree={handleRequestTree}
      onSelectPath={setSelectedPath}
    />
  );
}
