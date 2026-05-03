import { useSyncExternalStore } from 'react';

export type Breakpoint = 'desktop' | 'tablet' | 'mobile';

const MOBILE_QUERY = '(max-width: 640px)';
const TABLET_QUERY = '(min-width: 641px) and (max-width: 1024px)';

function subscribe(callback: () => void) {
  if (typeof window === 'undefined') return () => undefined;
  const mobile = window.matchMedia(MOBILE_QUERY);
  const tablet = window.matchMedia(TABLET_QUERY);
  mobile.addEventListener('change', callback);
  tablet.addEventListener('change', callback);
  return () => {
    mobile.removeEventListener('change', callback);
    tablet.removeEventListener('change', callback);
  };
}

function getSnapshot(): Breakpoint {
  if (typeof window === 'undefined') return 'desktop';
  if (window.matchMedia(MOBILE_QUERY).matches) return 'mobile';
  if (window.matchMedia(TABLET_QUERY).matches) return 'tablet';
  return 'desktop';
}

function getServerSnapshot(): Breakpoint {
  return 'desktop';
}

export function useBreakpoint(): Breakpoint {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
