export function splitPatch(diff: string): string[] {
  const chunks = diff.split(/(?=^diff --git )/gm).filter((chunk) => chunk.trim());
  return chunks.length > 0 ? chunks : [diff];
}
