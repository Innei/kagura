import { useEffect, useSyncExternalStore } from 'react';

const QUERY = '(prefers-color-scheme: dark)';

function subscribe(callback: () => void) {
  if (typeof window === 'undefined') return () => undefined;
  const mql = window.matchMedia(QUERY);
  mql.addEventListener('change', callback);
  return () => mql.removeEventListener('change', callback);
}

function getSnapshot(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia(QUERY).matches ? 'dark' : 'light';
}

function getServerSnapshot(): 'dark' | 'light' {
  return 'light';
}

export function useColorScheme(): 'dark' | 'light' {
  const scheme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', scheme);
  }, [scheme]);

  return scheme;
}
