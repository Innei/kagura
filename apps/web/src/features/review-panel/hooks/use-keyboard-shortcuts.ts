import { useEffect, useRef } from 'react';

interface KeyboardShortcutHandlers {
  onFirst: () => void;
  onFocusFilter: () => void;
  onLast: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onToggleSidebar: () => void;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}

export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const pendingG = useRef(false);
  const pendingTimeout = useRef<number | undefined>(undefined);

  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      const inEditable = isEditableTarget(event.target);

      if (inEditable) {
        if (event.key === 'Escape') return;
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const { key } = event;
      const h = handlersRef.current;

      if (key === '/') {
        event.preventDefault();
        h.onFocusFilter();
        return;
      }
      if (key === '[') {
        event.preventDefault();
        h.onToggleSidebar();
        return;
      }
      if (key === 'j') {
        event.preventDefault();
        h.onNext();
        return;
      }
      if (key === 'k') {
        event.preventDefault();
        h.onPrevious();
        return;
      }
      if (key === 'G' && event.shiftKey) {
        event.preventDefault();
        h.onLast();
        return;
      }
      if (key === 'g' && !event.shiftKey) {
        event.preventDefault();
        if (pendingG.current) {
          pendingG.current = false;
          if (pendingTimeout.current !== undefined) {
            window.clearTimeout(pendingTimeout.current);
            pendingTimeout.current = undefined;
          }
          h.onFirst();
        } else {
          pendingG.current = true;
          pendingTimeout.current = window.setTimeout(() => {
            pendingG.current = false;
            pendingTimeout.current = undefined;
          }, 600);
        }
      }
    };

    document.addEventListener('keydown', handle);
    return () => {
      document.removeEventListener('keydown', handle);
      if (pendingTimeout.current !== undefined) {
        window.clearTimeout(pendingTimeout.current);
      }
    };
  }, []);
}
