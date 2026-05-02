import type { ReviewDiffResponse, ReviewSession } from '../types';
import { getJson } from './http';

export async function loadInitialReviewData(reviewExecutionId: string, apiBasePath = '') {
  const session = await getJson<ReviewSession>(
    apiUrl(apiBasePath, `/api/reviews/${encodeURIComponent(reviewExecutionId)}`),
  );
  return { session };
}

export async function loadDiff(
  reviewExecutionId: string,
  filePath?: string | undefined,
  apiBasePath = '',
): Promise<string> {
  const suffix = filePath ? `?path=${encodeURIComponent(filePath)}` : '';
  const payload = await getJson<ReviewDiffResponse>(
    apiUrl(apiBasePath, `/api/reviews/${encodeURIComponent(reviewExecutionId)}/diff${suffix}`),
  );
  return payload.diff;
}

function apiUrl(apiBasePath: string, path: string): string {
  return `${apiBasePath}${path}`;
}
