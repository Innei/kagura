import type { ReviewDiffResponse, ReviewSession, ReviewTreeResponse } from '../types';
import { getJson } from './http';

export async function loadInitialReviewData(reviewExecutionId: string) {
  const [session, tree] = await Promise.all([
    getJson<ReviewSession>(`/api/reviews/${encodeURIComponent(reviewExecutionId)}`),
    getJson<ReviewTreeResponse>(`/api/reviews/${encodeURIComponent(reviewExecutionId)}/tree`),
  ]);

  return {
    session,
    treeEntries: tree.entries,
  };
}

export async function loadDiff(
  reviewExecutionId: string,
  filePath?: string | undefined,
): Promise<string> {
  const suffix = filePath ? `?path=${encodeURIComponent(filePath)}` : '';
  const payload = await getJson<ReviewDiffResponse>(
    `/api/reviews/${encodeURIComponent(reviewExecutionId)}/diff${suffix}`,
  );
  return payload.diff;
}
