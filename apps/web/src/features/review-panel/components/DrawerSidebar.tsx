import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  ReactNode,
} from 'react';
import { useEffect } from 'react';

import * as styles from './DrawerSidebar.styles';

interface DrawerSidebarProps {
  children: ReactNode;
  onClose: () => void;
  open: boolean;
}

export function DrawerSidebar({ children, onClose, open }: DrawerSidebarProps) {
  useEffect(() => {
    if (!open) return undefined;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handler);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  const stopPropagation = (
    event: ReactMouseEvent<HTMLElement> | ReactKeyboardEvent<HTMLElement>,
  ) => {
    event.stopPropagation();
  };

  return (
    <div className={styles.scrim} role="presentation" onClick={onClose}>
      <aside aria-label="File list" className={styles.drawer} onClick={stopPropagation}>
        {children}
      </aside>
    </div>
  );
}
