import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(packageDir, '../..');
const webDistDir = path.join(repoRoot, 'apps/web/dist');
const targetDir = path.join(packageDir, 'dist/review-panel');

if (!fs.existsSync(webDistDir)) {
  console.warn(
    `[kagura] Review panel assets not found at ${webDistDir}; run pnpm -F @kagura/web build before packaging.`,
  );
  process.exit(0);
}

fs.rmSync(targetDir, { force: true, recursive: true });
fs.mkdirSync(path.dirname(targetDir), { recursive: true });
fs.cpSync(webDistDir, targetDir, { recursive: true });
console.info(`[kagura] Copied review panel assets to ${targetDir}`);
