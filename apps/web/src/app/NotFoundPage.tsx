import { FileQuestion } from 'lucide-react';

import * as styles from './NotFoundPage.styles';

export function NotFoundPage() {
  return (
    <main className={styles.root}>
      <section aria-labelledby="not-found-title" className={styles.content}>
        <div aria-hidden="true" className={styles.iconWrap}>
          <FileQuestion size={18} />
        </div>
        <div>
          <div className={styles.eyebrow}>404</div>
          <h1 className={styles.title} id="not-found-title">
            Review route not found
          </h1>
        </div>
        <p className={styles.description}>
          This panel can only open review sessions from a Kagura review link.
        </p>
        <code className={styles.path}>{window.location.pathname}</code>
      </section>
    </main>
  );
}
