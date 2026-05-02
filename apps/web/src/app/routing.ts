export interface ReviewPanelRoute {
  apiBasePath: string;
  executionId: string;
}

export function getReviewPanelRoute(): ReviewPanelRoute {
  const match = window.location.pathname.match(/^(.*)\/reviews\/([^/]+)/);
  const prefix = match?.[1] && match[1] !== '/' ? match[1] : '';
  return {
    apiBasePath: prefix,
    executionId: match?.[2]
      ? decodeURIComponent(match[2])
      : import.meta.env.DEV
        ? 'mock-review'
        : '',
  };
}

export function getExecutionId(): string {
  return getReviewPanelRoute().executionId;
}
