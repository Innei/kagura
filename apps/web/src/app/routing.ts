export function getExecutionId(): string {
  const match = window.location.pathname.match(/^\/reviews\/([^/]+)/);
  if (match?.[1]) {
    return decodeURIComponent(match[1]);
  }
  return import.meta.env.DEV ? 'mock-review' : '';
}
