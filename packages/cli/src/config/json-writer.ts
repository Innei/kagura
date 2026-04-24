import fs from 'node:fs';
import path from 'node:path';

import type { AppConfigJson } from './env-loader.js';

export type ConfigPatch = {
  [K in keyof AppConfigJson]?:
    | AppConfigJson[K]
    | (AppConfigJson[K] extends object
        ? { [P in keyof AppConfigJson[K]]?: AppConfigJson[K][P] | undefined }
        : AppConfigJson[K])
    | undefined;
};

export function writeConfigJson(filePath: string, patch: ConfigPatch): void {
  const existing: Record<string, unknown> = fs.existsSync(filePath)
    ? (JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>)
    : {};

  const merged = deepMerge(existing, patch as Record<string, unknown>);

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(merged, null, 2) + '\n', 'utf8');
}

function deepMerge(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [key, val] of Object.entries(patch)) {
    if (val === undefined) continue;
    if (isPlainObject(val) && isPlainObject(out[key])) {
      out[key] = deepMerge(out[key] as Record<string, unknown>, val);
    } else {
      out[key] = val;
    }
  }
  return out;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
