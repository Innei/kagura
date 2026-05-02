import type { ReviewChangedFile } from '../../types';
import * as styles from './DiffPane.css';
import { DiffStatusBar } from './DiffStatusBar';
import type { DiffStyle } from './DiffToolbar';
import { DiffToolbar } from './DiffToolbar';
import { DiffView } from './DiffView';

interface DiffPaneProps {
  colorScheme: 'dark' | 'light';
  diff: string;
  diffStyle: DiffStyle;
  fileTotal: number;
  onChangeDiffStyle: (next: DiffStyle) => void;
  onCopyPath: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSelectFullDiff: () => void;
  selectedFile?: ReviewChangedFile | undefined;
  selectedIndex?: number | undefined;
}

export function DiffPane({
  colorScheme,
  diff,
  diffStyle,
  fileTotal,
  onChangeDiffStyle,
  onCopyPath,
  onNext,
  onPrevious,
  onSelectFullDiff,
  selectedFile,
  selectedIndex,
}: DiffPaneProps) {
  return (
    <main className={styles.root} id="review-main">
      <DiffToolbar
        diffStyle={diffStyle}
        selectedPath={selectedFile?.path}
        onChangeDiffStyle={onChangeDiffStyle}
        onCopyPath={onCopyPath}
        onNext={onNext}
        onPrevious={onPrevious}
        onSelectFullDiff={onSelectFullDiff}
      />
      <DiffStatusBar
        additions={selectedFile?.additions}
        deletions={selectedFile?.deletions}
        fileIndex={selectedIndex}
        fileStatus={selectedFile?.status}
        fileTotal={fileTotal}
      />
      <DiffView colorScheme={colorScheme} diff={diff} diffStyle={diffStyle} />
    </main>
  );
}
