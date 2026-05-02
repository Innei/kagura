import * as styles from './ShellState.styles';

export function ShellState({ text }: { text: string }) {
  return (
    <div aria-live="polite" className={styles.root} role="status">
      {text}
    </div>
  );
}
