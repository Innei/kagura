import * as styles from './ShellState.css';

export function ShellState({ text }: { text: string }) {
  return (
    <div aria-live="polite" className={styles.root} role="status">
      {text}
    </div>
  );
}
