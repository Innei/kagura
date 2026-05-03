import type { FileDiffMetadata } from '@pierre/diffs';
import { processFile } from '@pierre/diffs';
import { FileDiff, PatchDiff } from '@pierre/diffs/react';
import { Component, type ReactNode, useMemo } from 'react';

import { splitPatch } from '../../utils/split-patch';
import type { DiffStyle } from './DiffToolbar';
import * as styles from './DiffView.styles';

interface DiffViewProps {
  baseContent?: string | undefined;
  colorScheme: 'dark' | 'light';
  diff: string;
  diffStyle: DiffStyle;
  headContent?: string | undefined;
  selectedPath?: string | undefined;
}

export function DiffView({
  baseContent,
  colorScheme,
  diff,
  diffStyle,
  headContent,
  selectedPath,
}: DiffViewProps) {
  const fileDiff = useMemo<FileDiffMetadata | undefined>(() => {
    if (!selectedPath || baseContent === undefined || headContent === undefined) {
      return undefined;
    }
    if (!diff.trim()) return undefined;
    try {
      return processFile(diff, {
        isGitDiff: /^diff --git /m.test(diff),
        oldFile: { name: selectedPath, contents: baseContent },
        newFile: { name: selectedPath, contents: headContent },
      });
    } catch {
      return undefined;
    }
  }, [baseContent, diff, headContent, selectedPath]);

  if (!diff.trim()) {
    return <div className={styles.empty}>No diff.</div>;
  }

  const sharedOptions = {
    collapsed: false,
    diffIndicators: 'classic' as const,
    diffStyle,
    hunkSeparators: 'line-info-basic' as const,
    lineDiffType: 'word' as const,
    theme: { dark: 'github-dark-high-contrast', light: 'github-light-high-contrast' },
    themeType: colorScheme,
  };

  const fallback = (
    <div className={styles.content}>
      {splitPatch(diff).map((patch, index) => (
        <div className={styles.patch} key={`${index}:${patch.slice(0, 80)}`}>
          <PatchDiff disableWorkerPool options={sharedOptions} patch={patch} />
        </div>
      ))}
    </div>
  );

  if (fileDiff) {
    return (
      <DiffFallback fallback={fallback} resetKey={`${selectedPath ?? ''}:${diff.length}`}>
        <div className={styles.content}>
          <div className={styles.patch}>
            <FileDiff disableWorkerPool fileDiff={fileDiff} options={sharedOptions} />
          </div>
        </div>
      </DiffFallback>
    );
  }

  return fallback;
}

interface DiffFallbackProps {
  children: ReactNode;
  fallback: ReactNode;
  resetKey: string;
}

interface DiffFallbackState {
  failedKey: string | undefined;
}

class DiffFallback extends Component<DiffFallbackProps, DiffFallbackState> {
  state: DiffFallbackState = { failedKey: undefined };

  static getDerivedStateFromError(): Partial<DiffFallbackState> {
    return {};
  }

  componentDidCatch() {
    this.setState({ failedKey: this.props.resetKey });
  }

  componentDidUpdate(prev: DiffFallbackProps) {
    if (prev.resetKey !== this.props.resetKey && this.state.failedKey !== undefined) {
      this.setState({ failedKey: undefined });
    }
  }

  render() {
    if (this.state.failedKey === this.props.resetKey) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}
