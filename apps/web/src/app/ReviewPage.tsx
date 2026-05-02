import { useEffect, useState } from 'react';

import { loadDiff, loadInitialReviewData } from '../features/review-panel/api/review-api';
import { ReviewLayout } from '../features/review-panel/components/ReviewLayout';
import { ShellState } from '../features/review-panel/components/ShellState';
import type { ReviewSession } from '../features/review-panel/types';

interface ReviewPageProps {
  apiBasePath: string;
  executionId: string;
}

export function ReviewPage({ apiBasePath, executionId }: ReviewPageProps) {
  const [session, setSession] = useState<ReviewSession | undefined>();
  const [selectedPath, setSelectedPath] = useState<string | undefined>();
  const [diff, setDiff] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    setLoading(true);
    setError(undefined);
    setSession(undefined);
    setSelectedPath(undefined);
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
      onSelectPath={setSelectedPath}
    />
  );
}
