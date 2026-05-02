import { useCallback, useMemo } from 'react';

import type { ReviewChangedFile } from '../types';

export interface FileNavController {
  goFirst: () => void;
  goLast: () => void;
  goNext: () => void;
  goPrevious: () => void;
  selectedFile?: ReviewChangedFile | undefined;
  selectedIndex?: number | undefined;
}

export function useFileNav(
  files: ReviewChangedFile[],
  selectedPath: string | undefined,
  onSelectPath: (path: string | undefined) => void,
): FileNavController {
  const selectedIndex = useMemo(() => {
    if (!selectedPath) return undefined;
    const index = files.findIndex((file) => file.path === selectedPath);
    return index === -1 ? undefined : index;
  }, [files, selectedPath]);

  const selectedFile = selectedIndex === undefined ? undefined : files[selectedIndex];

  const goNext = useCallback(() => {
    if (files.length === 0) return;
    if (selectedIndex === undefined) {
      onSelectPath(files[0]?.path);
      return;
    }
    const next = files[Math.min(selectedIndex + 1, files.length - 1)];
    if (next) onSelectPath(next.path);
  }, [files, onSelectPath, selectedIndex]);

  const goPrevious = useCallback(() => {
    if (files.length === 0) return;
    if (selectedIndex === undefined) {
      onSelectPath(files.at(-1)?.path);
      return;
    }
    const prev = files[Math.max(selectedIndex - 1, 0)];
    if (prev) onSelectPath(prev.path);
  }, [files, onSelectPath, selectedIndex]);

  const goFirst = useCallback(() => {
    if (files.length === 0) return;
    onSelectPath(files[0]?.path);
  }, [files, onSelectPath]);

  const goLast = useCallback(() => {
    if (files.length === 0) return;
    onSelectPath(files.at(-1)?.path);
  }, [files, onSelectPath]);

  return { goFirst, goLast, goNext, goPrevious, selectedFile, selectedIndex };
}
