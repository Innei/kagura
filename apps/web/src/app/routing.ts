export function getApiBasePath(): string {
  const match = window.location.pathname.match(/^(.*)\/reviews\/[^/]+/);
  const prefix = match?.[1] && match[1] !== '/' ? match[1] : '';
  return prefix;
}
