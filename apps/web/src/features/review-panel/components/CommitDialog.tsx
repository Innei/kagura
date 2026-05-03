import { useCallback, useEffect, useRef, useState } from 'react';

import * as styles from './CommitDialog.styles';

interface CommitDialogProps {
  error?: string | undefined;
  loading: boolean;
  message: string;
  onClose: () => void;
  onRegenerate: () => void;
  onSubmit: (message: string) => void;
  open: boolean;
}

export function CommitDialog({
  error,
  loading,
  message,
  onClose,
  onRegenerate,
  onSubmit,
  open,
}: CommitDialogProps) {
  const [editedMessage, setEditedMessage] = useState(message);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setEditedMessage(message);
  }, [message]);

  useEffect(() => {
    if (open && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [open]);

  const handleSubmit = useCallback(() => {
    if (editedMessage.trim()) {
      onSubmit(editedMessage.trim());
    }
  }, [editedMessage, onSubmit]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    },
    [onClose],
  );

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose} onKeyDown={handleKeyDown}>
      <div
        aria-label="Commit and push changes"
        className={styles.dialog}
        role="dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <span className={styles.title}>Commit & Push</span>
        <textarea
          className={styles.textarea}
          disabled={loading}
          ref={textareaRef}
          rows={5}
          value={editedMessage}
          onChange={(event) => setEditedMessage(event.target.value)}
        />
        {error ? <span className={styles.error}>{error}</span> : null}
        <div className={styles.actions}>
          <button
            className={`${styles.button} ${styles.buttonSecondary}`}
            disabled={loading}
            type="button"
            onClick={onRegenerate}
          >
            Regenerate
          </button>
          <button
            className={`${styles.button} ${styles.buttonSecondary}`}
            type="button"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className={`${styles.button} ${styles.buttonPrimary}`}
            disabled={loading || !editedMessage.trim()}
            type="button"
            onClick={handleSubmit}
          >
            {loading ? 'Committing…' : 'Commit & Push'}
          </button>
        </div>
      </div>
    </div>
  );
}
