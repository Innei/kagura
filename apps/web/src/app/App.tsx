import { useEffect, useState } from 'react';

import { loadDiff, loadInitialReviewData } from '../features/review-panel/api/review-api';
import { ReviewLayout } from '../features/review-panel/components/ReviewLayout';
import { ShellState } from '../features/review-panel/components/ShellState';
import type { ReviewSession } from '../features/review-panel/types';
import { getExecutionId } from './routing';

const executionId = getExecutionId();

export function App() {
  const [session, setSession] = useState<ReviewSession | undefined>();
  const [selectedPath, setSelectedPath] = useState<string | undefined>();
  const [diff, setDiff] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    void loadInitialReviewData(executionId)
      .then(({ session: nextSession }) => {
        setSession(nextSession);
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
      onSelectPath={setSelectedPath}
    />
  );
}
