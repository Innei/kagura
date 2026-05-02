import * as styles from '../../../styles.css';

export function ShellState({ text }: { text: string }) {
  return <div className={`${styles.appFrame} ${styles.shellState}`}>{text}</div>;
}
