import type {
  ReviewDiffResponse,
  ReviewFileResponse,
  ReviewSession,
  ReviewTreeEntry,
  ReviewTreeResponse,
} from '../types';
import { getJson, postJson } from './http';

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

export async function loadTree(
  reviewExecutionId: string,
  apiBasePath = '',
): Promise<ReviewTreeEntry[]> {
  const payload = await getJson<ReviewTreeResponse>(
    apiUrl(apiBasePath, `/api/reviews/${encodeURIComponent(reviewExecutionId)}/tree`),
  );
  return payload.entries;
}

export async function loadFile(
  reviewExecutionId: string,
  filePath: string,
  apiBasePath = '',
  ref: 'base' | 'head' = 'head',
): Promise<string | undefined> {
  const refSuffix = ref === 'base' ? '&ref=base' : '';
  try {
    const payload = await getJson<ReviewFileResponse>(
      apiUrl(
        apiBasePath,
        `/api/reviews/${encodeURIComponent(reviewExecutionId)}/file?path=${encodeURIComponent(filePath)}${refSuffix}`,
      ),
    );
    return payload.content;
  } catch {
    return undefined;
  }
}

function apiUrl(apiBasePath: string, path: string): string {
  return `${apiBasePath}${path}`;
}

export async function generateCommitMessage(
  reviewExecutionId: string,
  apiBasePath = '',
): Promise<string> {
  const payload = await postJson<{ message: string }>(
    apiUrl(
      apiBasePath,
      `/api/reviews/${encodeURIComponent(reviewExecutionId)}/generate-commit-message`,
    ),
    {},
  );
  return payload.message;
}

export async function commitAndPush(
  reviewExecutionId: string,
  message: string,
  apiBasePath = '',
): Promise<{ commitSha: string; success: boolean }> {
  return postJson<{ commitSha: string; success: boolean }>(
    apiUrl(apiBasePath, `/api/reviews/${encodeURIComponent(reviewExecutionId)}/commit-push`),
    { message },
  );
}
