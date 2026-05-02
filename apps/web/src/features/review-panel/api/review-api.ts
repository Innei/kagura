import type { ReviewDiffResponse, ReviewSession } from '../types';
import { getJson } from './http';

export async function loadInitialReviewData(reviewExecutionId: string) {
  const session = await getJson<ReviewSession>(
    `/api/reviews/${encodeURIComponent(reviewExecutionId)}`,
  );
  return { session };
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
