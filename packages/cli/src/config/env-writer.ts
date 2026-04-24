import fs from 'node:fs';
import path from 'node:path';

export type EnvPatch = Record<string, string | undefined>;

const KV_RE = /^([\dA-Z_]+)=.*$/;

export function writeEnvFile(filePath: string, patch: EnvPatch): void {
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  const lines = existing === '' ? [] : existing.replace(/\n$/, '').split('\n');

  const touched = new Set<string>();

  const updated = lines.map((line) => {
    const m = KV_RE.exec(line);
    const key = m?.[1];
    if (!key || !(key in patch)) return line;
    touched.add(key);
    const val = patch[key];
    if (val === undefined) return line;
    return `${key}=${formatValue(val)}`;
  });

  for (const [key, val] of Object.entries(patch)) {
    if (touched.has(key)) continue;
    if (val === undefined) continue;
    updated.push(`${key}=${formatValue(val)}`);
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, updated.join('\n') + '\n', 'utf8');
}

function formatValue(v: string): string {
  if (/[\s"$'\\`]/.test(v)) {
    return `"${v.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
  }
  return v;
}
