import type { ReviewChangedFile } from '../../types';
import type { DiffStyle, ViewMode } from './DiffToolbar';
import { DiffToolbar } from './DiffToolbar';
import { DiffView } from './DiffView';
import * as styles from './RightPane.styles';
import { SourceView } from './SourceView';

interface RightPaneProps {
  baseContent?: string | undefined;
  colorScheme: 'dark' | 'light';
  content?: string | undefined;
  contentLoading: boolean;
  diff: string;
  diffStyle: DiffStyle;
  onChangeDiffStyle: (next: DiffStyle) => void;
  onChangeViewMode: (next: ViewMode) => void;
  onCopyPath: () => void;
  onNext: () => void;
  onPrevious: () => void;
  selectedFile?: ReviewChangedFile | undefined;
  selectedPath?: string | undefined;
  viewMode: ViewMode;
}

export function RightPane({
  baseContent,
  colorScheme,
  content,
  contentLoading,
  diff,
  diffStyle,
  onChangeDiffStyle,
  onChangeViewMode,
  onCopyPath,
  onNext,
  onPrevious,
  selectedFile,
  selectedPath,
  viewMode,
}: RightPaneProps) {
  const hasDiff = diff.trim().length > 0 && !/^Binary files /m.test(diff);
  const sourceAvailable = Boolean(selectedPath) && (content !== undefined || hasDiff);
  // Diff mode requires actual diff content. Otherwise fall back to source.
  const effectiveMode: ViewMode = viewMode === 'diff' && !hasDiff ? 'source' : viewMode;
  const finalMode: ViewMode =
    effectiveMode === 'source' && !sourceAvailable ? 'diff' : effectiveMode;

  return (
    <main className={styles.root} id="review-main">
      <DiffToolbar
        diffStyle={diffStyle}
        hasDiff={hasDiff}
        selectedPath={selectedFile?.path ?? selectedPath}
        sourceAvailable={sourceAvailable}
        viewMode={finalMode}
        onChangeDiffStyle={onChangeDiffStyle}
        onChangeViewMode={onChangeViewMode}
        onCopyPath={onCopyPath}
        onNext={onNext}
        onPrevious={onPrevious}
      />
      <div className={styles.body}>
        {finalMode === 'source' ? (
          <SourceView
            colorScheme={colorScheme}
            content={content}
            diff={diff}
            loading={contentLoading}
            path={selectedPath}
          />
        ) : (
          <DiffView
            baseContent={baseContent}
            colorScheme={colorScheme}
            diff={diff}
            diffStyle={diffStyle}
            headContent={content}
            selectedPath={selectedPath}
          />
        )}
      </div>
    </main>
  );
}
