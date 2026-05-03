/**
 * Compare two file paths the way Pierre's FileTree renders them with
 * `stickyFolders: true` — at each shared level, directories come before files,
 * with alphabetic ordering inside each group.
 */
export function compareTreePaths(a: string, b: string): number {
  const aParts = a.split('/');
  const bParts = b.split('/');
  const min = Math.min(aParts.length, bParts.length);
  for (let i = 0; i < min; i++) {
    const aSeg = aParts[i]!;
    const bSeg = bParts[i]!;
    if (aSeg === bSeg) continue;
    const aIsDir = i < aParts.length - 1;
    const bIsDir = i < bParts.length - 1;
    if (aIsDir !== bIsDir) return aIsDir ? -1 : 1;
    return aSeg.localeCompare(bSeg);
  }
  return aParts.length - bParts.length;
}
