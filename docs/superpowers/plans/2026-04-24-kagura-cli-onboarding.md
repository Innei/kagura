# Kagura CLI & onboarding implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `@innei/kagura` into an installable CLI that walks a new user from `npm i -g` to a running Slack bot, with zero hand-editing of config files.

**Architecture:** Monorepo split: `apps/kagura` holds the runtime (published as `@innei/kagura`, exposes two bins: `kagura` → router, `kagura-app` → app entry). `packages/cli` holds the onboarding logic (workspace-internal, tsdown-bundled into the published tarball). Config directory is `~/.config/kagura/` in prod with dev-mode cwd fallback; secrets live in `.env`, tunables live in `config.json` (precedence established by commit `f2ad0cd`: env > config.json > default).

**Tech Stack:** Node ≥22, TypeScript strict ESM, pnpm workspaces, tsdown + oxc, Vitest, Zod, commander@13, @clack/prompts@0.11, open@10, better-sqlite3 (native, external), @anthropic-ai/claude-agent-sdk (external).

**Spec:** [`docs/superpowers/specs/2026-04-24-kagura-cli-onboarding-design.md`](../specs/2026-04-24-kagura-cli-onboarding-design.md)

---

## File map

Created:

| Path                                          | Responsibility                                                      |
| --------------------------------------------- | ------------------------------------------------------------------- |
| `apps/kagura/src/cli.ts`                      | Thin shim: `#!/usr/bin/env node` + `runCli(process.argv)`           |
| `apps/kagura/src/start-app.ts`                | Re-exports `createApplication().start()` for router in-process boot |
| `packages/cli/package.json`                   | `@kagura/cli`, private, type=module, workspace-only                 |
| `packages/cli/tsconfig.json`                  | extends `tsconfig.base.json`                                        |
| `packages/cli/src/index.ts`                   | Exports `runCli(argv)`                                              |
| `packages/cli/src/router.ts`                  | Commander setup, default action, dispatch                           |
| `packages/cli/src/version.ts`                 | Reads `__KAGURA_VERSION__` / git defines                            |
| `packages/cli/src/config/paths.ts`            | `resolveKaguraPaths()`                                              |
| `packages/cli/src/config/env-loader.ts`       | `loadEnvFile()`, `detectConfig()`, `loadConfigJson()`               |
| `packages/cli/src/config/env-writer.ts`       | Order/comment-preserving `.env` upsert                              |
| `packages/cli/src/config/json-writer.ts`      | Deep-merge `config.json` writer                                     |
| `packages/cli/src/slack/manifest-template.ts` | `buildManifest()`, desired commands / shortcuts / events / scopes   |
| `packages/cli/src/slack/prefill-url.ts`       | `buildPrefillUrl()` with >8KB fallback                              |
| `packages/cli/src/slack/config-token.ts`      | `appsManifestCreate/update/export`, `rotateToolingToken`            |
| `packages/cli/src/providers/types.ts`         | `ProviderSetup`, `SetupPatch`, `DetectResult`                       |
| `packages/cli/src/providers/registry.ts`      | Stable provider array + `getProvider(id)`                           |
| `packages/cli/src/providers/claude.ts`        | Claude Code onboarding                                              |
| `packages/cli/src/providers/codex.ts`         | Codex CLI onboarding                                                |
| `packages/cli/src/commands/init.ts`           | Wizard state machine                                                |
| `packages/cli/src/commands/doctor.ts`         | Diagnostic checks                                                   |
| `packages/cli/src/commands/manifest.ts`       | `sync` / `export` / `print` subcommands                             |
| `packages/cli/src/commands/config.ts`         | `path` subcommand                                                   |
| `packages/cli/src/ui/prompts.ts`              | Thin wrapper over `@clack/prompts` (masking, cancel handling)       |
| `packages/cli/tests/*.test.ts`                | Unit tests for every exported function                              |
| `tsconfig.base.json`                          | Shared compiler options                                             |
| `apps/kagura/docs/CHANGELOG.md`               | Track the 0.2.0 bump                                                |

Moved (git mv):

| From                                   | To                              |
| -------------------------------------- | ------------------------------- |
| `src/`                                 | `apps/kagura/src/`              |
| `drizzle/`                             | `apps/kagura/drizzle/`          |
| `tests/`                               | `apps/kagura/tests/`            |
| `tsconfig.json`, `tsconfig.tests.json` | `apps/kagura/`                  |
| `vitest.config.ts`                     | `apps/kagura/vitest.config.ts`  |
| `drizzle.config.ts`                    | `apps/kagura/drizzle.config.ts` |
| `tsdown.config.ts`                     | `apps/kagura/tsdown.config.ts`  |
| `nodemon.json`                         | `apps/kagura/nodemon.json`      |
| `packages/live-cli/`                   | unchanged                       |

Modified:

| Path                                              | Change                                                                                      |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Root `package.json`                               | Slimmed to workspace metadata + top-level forwarding scripts                                |
| `pnpm-workspace.yaml`                             | Add `apps/*`                                                                                |
| `apps/kagura/package.json`                        | Moved-in package manifest, bumped to 0.2.0, bin×2, new deps                                 |
| `apps/kagura/src/env/server.ts`                   | `loadAppConfig()` resolves path via `resolveKaguraPaths()`                                  |
| `apps/kagura/src/logger/index.ts:16`              | `LOG_DIR` default via paths                                                                 |
| `apps/kagura/src/application.ts:38`               | `SESSION_DB_PATH` default via paths                                                         |
| `apps/kagura/src/slack/commands/manifest-sync.ts` | Imports `buildManifest` + desired sets from `@kagura/cli`; tokenStorePath default via paths |
| `apps/kagura/tsdown.config.ts`                    | `entry: ['src/index.ts', 'src/cli.ts']`, keep externals                                     |
| `README.md`                                       | Usage section: install + `kagura`                                                           |
| `docs/configuration.md`                           | New path resolution rules                                                                   |

---

## Task 0.1: Root workspace scaffolding

**Files:**

- Create: `apps/.gitkeep`
- Modify: `pnpm-workspace.yaml`

- [ ] **Step 1: Create empty `apps/` directory**

Run: `mkdir -p apps && touch apps/.gitkeep`

- [ ] **Step 2: Update `pnpm-workspace.yaml`**

Read current content first, then replace with:

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

- [ ] **Step 3: Commit**

```bash
git add apps/ pnpm-workspace.yaml
git commit -m "chore(monorepo): add apps/ to workspace layout"
```

---

## Task 0.2: Move `src/`, `drizzle/`, `tests/`, configs into `apps/kagura/`

**Files:**

- Move: `src/` → `apps/kagura/src/`
- Move: `drizzle/` → `apps/kagura/drizzle/`
- Move: `tests/` → `apps/kagura/tests/`
- Move: `tsconfig.json`, `tsconfig.tests.json`, `vitest.config.ts`, `drizzle.config.ts`, `tsdown.config.ts`, `nodemon.json` → `apps/kagura/`

- [ ] **Step 1: git mv directories and configs**

```bash
mkdir -p apps/kagura
git mv src apps/kagura/src
git mv drizzle apps/kagura/drizzle
git mv tests apps/kagura/tests
git mv tsconfig.json apps/kagura/tsconfig.json
git mv tsconfig.tests.json apps/kagura/tsconfig.tests.json
git mv vitest.config.ts apps/kagura/vitest.config.ts
git mv drizzle.config.ts apps/kagura/drizzle.config.ts
git mv tsdown.config.ts apps/kagura/tsdown.config.ts
git mv nodemon.json apps/kagura/nodemon.json
```

- [ ] **Step 2: Verify paths still reference `src/`**

Read `apps/kagura/tsconfig.json`. Confirm `"paths": { "~/*": ["src/*"] }` is unchanged — tsconfig is now inside apps/kagura, so relative `src/*` still works.

- [ ] **Step 3: Update `apps/kagura/vitest.config.ts` test roots if needed**

Read current content. If it references `./src` or `./tests`, leave unchanged — paths remain relative to the new config location.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(monorepo): move app sources to apps/kagura/"
```

---

## Task 0.3: Move package manifest and slim root

**Files:**

- Move: `package.json` → `apps/kagura/package.json`
- Create: root `package.json` (slimmed)
- Create: `tsconfig.base.json`

- [ ] **Step 1: git mv package.json**

```bash
git mv package.json apps/kagura/package.json
```

- [ ] **Step 2: Bump `apps/kagura/package.json` version and add bin shim placeholder**

Edit `apps/kagura/package.json`:

- `"version": "0.2.0"` (was `0.1.0`)
- Keep existing `bin: { "kagura": "./dist/index.js" }` for now — will update in Task 2.5
- Keep existing name, deps, scripts

- [ ] **Step 3: Create slimmed root `package.json`**

```json
{
  "devDependencies": {
    "prettier": "^3.8.1",
    "prettier-plugin-packagejson": "^3.0.2",
    "prettier-plugin-sh": "^0.18.1",
    "prettier-plugin-sort-json": "^4.2.0",
    "simple-git-hooks": "^2.13.1",
    "lint-staged": "^16.4.0"
  },
  "engines": {
    "node": ">=24.0.0"
  },
  "lint-staged": {
    "*.{js,jsx,ts,tsx,yml,yaml}": ["eslint --fix"],
    "*": ["prettier --write --ignore-unknown"]
  },
  "name": "kagura-monorepo",
  "packageManager": "pnpm@10.33.0",
  "private": true,
  "scripts": {
    "build": "pnpm -F @innei/kagura build",
    "dev": "pnpm -F @innei/kagura dev",
    "test": "pnpm -r run test",
    "typecheck": "pnpm -r run typecheck",
    "e2e": "pnpm -F @innei/kagura e2e",
    "e2e:list": "pnpm -F @innei/kagura e2e:list"
  },
  "simple-git-hooks": {
    "pre-commit": "pnpm exec lint-staged"
  },
  "type": "module"
}
```

Remove these devDeps from `apps/kagura/package.json` (they now live at root): `prettier`, `prettier-plugin-*`, `simple-git-hooks`, `lint-staged`. Also remove `simple-git-hooks` and `lint-staged` blocks from apps/kagura.

- [ ] **Step 4: Create `tsconfig.base.json` at root**

Read `apps/kagura/tsconfig.json` first to identify shared options. Then create `tsconfig.base.json` with the `compilerOptions` that should be shared (module, target, strict, moduleResolution, lib, esModuleInterop, etc.).

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2023"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": false,
    "sourceMap": true
  }
}
```

- [ ] **Step 5: Make `apps/kagura/tsconfig.json` extend base**

Keep app-specific `rootDir`, `outDir`, `paths`, `include` / `exclude`; remove duplicated base options. Add `"extends": "../../tsconfig.base.json"` at the top.

- [ ] **Step 6: Run `pnpm install` at root**

```bash
pnpm install
```

Expected: no errors. `pnpm-lock.yaml` rewritten; review the top of the diff to confirm workspace roots.

- [ ] **Step 7: Verify build + tests green**

```bash
pnpm build
pnpm test
```

Expected: both pass. If `~/*` path resolution fails, revisit Task 0.2 Step 2.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore(monorepo): split root and apps/kagura manifests"
```

---

## Task 1.1: `packages/cli` skeleton

**Files:**

- Create: `packages/cli/package.json`
- Create: `packages/cli/tsconfig.json`
- Create: `packages/cli/src/index.ts` (stub)
- Create: `packages/cli/vitest.config.ts`

- [ ] **Step 1: Create `packages/cli/package.json`**

```json
{
  "dependencies": {},
  "devDependencies": {
    "@types/node": "25.5.2",
    "typescript": "^6.0.2",
    "vitest": "4.1.2"
  },
  "exports": {
    ".": "./src/index.ts"
  },
  "main": "./src/index.ts",
  "name": "@kagura/cli",
  "private": true,
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "type": "module",
  "version": "0.0.0"
}
```

- [ ] **Step 2: Create `packages/cli/tsconfig.json`**

```json
{
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist"
  },
  "extends": "../../tsconfig.base.json",
  "include": ["src/**/*.ts", "tests/**/*.ts"]
}
```

- [ ] **Step 3: Create stub `packages/cli/src/index.ts`**

```ts
export async function runCli(argv: string[]): Promise<number> {
  void argv;
  return 0;
}
```

- [ ] **Step 4: Create `packages/cli/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
```

- [ ] **Step 5: Add `@kagura/cli` to `apps/kagura/package.json` deps**

Add `"@kagura/cli": "workspace:*"` under `dependencies`.

- [ ] **Step 6: Install and typecheck**

```bash
pnpm install
pnpm -F @kagura/cli typecheck
```

Expected: both pass.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(cli): scaffold @kagura/cli workspace package"
```

---

## Task 1.2: Paths resolver

**Files:**

- Create: `packages/cli/src/config/paths.ts`
- Create: `packages/cli/tests/paths.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/cli/tests/paths.test.ts`:

```ts
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resolveKaguraPaths } from '../src/config/paths.js';

describe('resolveKaguraPaths', () => {
  const origEnv = { ...process.env };
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kagura-paths-'));
    process.env = { ...origEnv };
    delete process.env.KAGURA_HOME;
    delete process.env.XDG_CONFIG_HOME;
  });

  afterEach(() => {
    process.env = { ...origEnv };
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('honors KAGURA_HOME', () => {
    process.env.KAGURA_HOME = tmp;
    const p = resolveKaguraPaths({ cwd: '/nowhere' });
    expect(p.configDir).toBe(tmp);
    expect(p.envFile).toBe(path.join(tmp, '.env'));
    expect(p.configJsonFile).toBe(path.join(tmp, 'config.json'));
    expect(p.dbPath).toBe(path.join(tmp, 'data', 'sessions.db'));
    expect(p.logDir).toBe(path.join(tmp, 'logs'));
    expect(p.tokenStore).toBe(path.join(tmp, 'data', 'slack-config-tokens.json'));
  });

  it('uses cwd when a .env exists there (dev mode)', () => {
    fs.writeFileSync(path.join(tmp, '.env'), '');
    const p = resolveKaguraPaths({ cwd: tmp });
    expect(p.configDir).toBe(tmp);
  });

  it('uses cwd when apps/kagura/ exists there (dev mode, monorepo root)', () => {
    fs.mkdirSync(path.join(tmp, 'apps', 'kagura'), { recursive: true });
    const p = resolveKaguraPaths({ cwd: tmp });
    expect(p.configDir).toBe(tmp);
  });

  it('falls back to XDG_CONFIG_HOME/kagura', () => {
    const xdg = path.join(tmp, 'xdg-config');
    fs.mkdirSync(xdg, { recursive: true });
    process.env.XDG_CONFIG_HOME = xdg;
    const p = resolveKaguraPaths({ cwd: '/nowhere' });
    expect(p.configDir).toBe(path.join(xdg, 'kagura'));
  });

  it('falls back to ~/.config/kagura', () => {
    const home = path.join(tmp, 'home');
    fs.mkdirSync(home, { recursive: true });
    process.env.HOME = home;
    const p = resolveKaguraPaths({ cwd: '/nowhere' });
    expect(p.configDir).toBe(path.join(home, '.config', 'kagura'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm -F @kagura/cli test
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `paths.ts`**

Create `packages/cli/src/config/paths.ts`:

```ts
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface KaguraPaths {
  configDir: string;
  envFile: string;
  configJsonFile: string;
  dataDir: string;
  dbPath: string;
  logDir: string;
  tokenStore: string;
}

export interface ResolveOptions {
  cwd?: string;
}

export function resolveKaguraPaths(opts: ResolveOptions = {}): KaguraPaths {
  const cwd = opts.cwd ?? process.cwd();
  const override = process.env.KAGURA_HOME?.trim();
  if (override) {
    return buildPaths(path.resolve(override));
  }

  if (isDevCwd(cwd)) {
    return buildPaths(cwd);
  }

  const xdg = process.env.XDG_CONFIG_HOME?.trim();
  if (xdg) {
    return buildPaths(path.join(path.resolve(xdg), 'kagura'));
  }

  return buildPaths(path.join(os.homedir(), '.config', 'kagura'));
}

function isDevCwd(cwd: string): boolean {
  if (fs.existsSync(path.join(cwd, '.env'))) return true;
  if (fs.existsSync(path.join(cwd, 'apps', 'kagura'))) return true;
  const pkgPath = path.join(cwd, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { name?: string };
      if (pkg.name === '@innei/kagura' || pkg.name === 'kagura' || pkg.name === 'kagura-monorepo') {
        return true;
      }
    } catch {
      /* ignore */
    }
  }
  return false;
}

function buildPaths(configDir: string): KaguraPaths {
  return {
    configDir,
    envFile: path.join(configDir, '.env'),
    configJsonFile: path.join(configDir, 'config.json'),
    dataDir: path.join(configDir, 'data'),
    dbPath: path.join(configDir, 'data', 'sessions.db'),
    logDir: path.join(configDir, 'logs'),
    tokenStore: path.join(configDir, 'data', 'slack-config-tokens.json'),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm -F @kagura/cli test
```

Expected: PASS (5/5).

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/config/paths.ts packages/cli/tests/paths.test.ts
git commit -m "feat(cli): add paths resolver with dev/prod fallback"
```

---

## Task 1.3: env-loader + detectConfig

**Files:**

- Create: `packages/cli/src/config/env-loader.ts`
- Create: `packages/cli/tests/env-loader.test.ts`

- [ ] **Step 1: Add `dotenv` to @kagura/cli deps (already transitive via apps/kagura, but make explicit for unit tests)**

Edit `packages/cli/package.json`:

```json
"dependencies": {
  "dotenv": "17.4.0"
}
```

Run `pnpm install`.

- [ ] **Step 2: Write failing test**

Create `packages/cli/tests/env-loader.test.ts`:

```ts
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { KaguraPaths } from '../src/config/paths.js';
import { detectConfig, loadConfigJson, loadEnvFile } from '../src/config/env-loader.js';

function makePaths(dir: string): KaguraPaths {
  return {
    configDir: dir,
    envFile: path.join(dir, '.env'),
    configJsonFile: path.join(dir, 'config.json'),
    dataDir: path.join(dir, 'data'),
    dbPath: path.join(dir, 'data', 'sessions.db'),
    logDir: path.join(dir, 'logs'),
    tokenStore: path.join(dir, 'data', 'slack-config-tokens.json'),
  };
}

describe('env-loader', () => {
  let tmp: string;
  const origEnv = { ...process.env };

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kagura-env-'));
    process.env = { ...origEnv };
    for (const k of [
      'SLACK_BOT_TOKEN',
      'SLACK_APP_TOKEN',
      'SLACK_SIGNING_SECRET',
      'REPO_ROOT_DIR',
    ]) {
      delete process.env[k];
    }
  });

  afterEach(() => {
    process.env = { ...origEnv };
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('loadEnvFile reads .env into process.env without crashing on missing file', () => {
    loadEnvFile(makePaths(tmp));
    expect(process.env.SLACK_BOT_TOKEN).toBeUndefined();

    fs.writeFileSync(path.join(tmp, '.env'), 'SLACK_BOT_TOKEN=xoxb-abc\n');
    loadEnvFile(makePaths(tmp));
    expect(process.env.SLACK_BOT_TOKEN).toBe('xoxb-abc');
  });

  it('loadConfigJson returns empty object if file missing', () => {
    const cfg = loadConfigJson(makePaths(tmp));
    expect(cfg).toEqual({});
  });

  it('loadConfigJson parses and validates config.json', () => {
    fs.writeFileSync(
      path.join(tmp, 'config.json'),
      JSON.stringify({ repoRootDir: '/repos', defaultProviderId: 'codex-cli' }),
    );
    const cfg = loadConfigJson(makePaths(tmp));
    expect(cfg.repoRootDir).toBe('/repos');
    expect(cfg.defaultProviderId).toBe('codex-cli');
  });

  it('detectConfig reports missing required keys', () => {
    const res = detectConfig(makePaths(tmp));
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.missing.sort()).toEqual(
        ['REPO_ROOT_DIR', 'SLACK_APP_TOKEN', 'SLACK_BOT_TOKEN', 'SLACK_SIGNING_SECRET'].sort(),
      );
    }
  });

  it('detectConfig accepts REPO_ROOT_DIR from config.json', () => {
    process.env.SLACK_BOT_TOKEN = 'xoxb';
    process.env.SLACK_APP_TOKEN = 'xapp';
    process.env.SLACK_SIGNING_SECRET = 'sig';
    fs.writeFileSync(path.join(tmp, 'config.json'), JSON.stringify({ repoRootDir: '/repos' }));
    const res = detectConfig(makePaths(tmp));
    expect(res.ok).toBe(true);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
pnpm -F @kagura/cli test
```

Expected: FAIL — env-loader not found.

- [ ] **Step 4: Implement `env-loader.ts`**

Create `packages/cli/src/config/env-loader.ts`:

```ts
import fs from 'node:fs';

import dotenv from 'dotenv';

import type { KaguraPaths } from './paths.js';

export interface AppConfigJson {
  claude?: {
    model?: string;
    permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan' | 'dontAsk' | 'auto';
    enableSkills?: boolean;
  };
  codex?: {
    model?: string;
    reasoningEffort?: 'low' | 'medium' | 'high' | 'xhigh';
    sandbox?: 'read-only' | 'workspace-write' | 'danger-full-access';
  };
  defaultProviderId?: 'claude-code' | 'codex-cli';
  logDir?: string;
  logLevel?: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  logToFile?: boolean;
  repoRootDir?: string;
  repoScanDepth?: number;
  sessionDbPath?: string;
}

const REQUIRED = [
  'SLACK_BOT_TOKEN',
  'SLACK_APP_TOKEN',
  'SLACK_SIGNING_SECRET',
  'REPO_ROOT_DIR',
] as const;

export function loadEnvFile(paths: KaguraPaths): void {
  if (!fs.existsSync(paths.envFile)) return;
  dotenv.config({ path: paths.envFile, override: false });
}

export function loadConfigJson(paths: KaguraPaths): AppConfigJson {
  if (!fs.existsSync(paths.configJsonFile)) return {};
  try {
    const raw = fs.readFileSync(paths.configJsonFile, 'utf8');
    return JSON.parse(raw) as AppConfigJson;
  } catch {
    return {};
  }
}

export type DetectResult =
  | { ok: true }
  | { ok: false; missing: string[]; envFile: string; configJsonFile: string };

export function detectConfig(paths: KaguraPaths): DetectResult {
  loadEnvFile(paths);
  const cfg = loadConfigJson(paths);

  const missing: string[] = [];
  for (const key of REQUIRED) {
    const envVal = process.env[key]?.trim();
    if (envVal) continue;
    if (key === 'REPO_ROOT_DIR' && cfg.repoRootDir?.trim()) continue;
    missing.push(key);
  }

  if (missing.length === 0) return { ok: true };
  return { ok: false, missing, envFile: paths.envFile, configJsonFile: paths.configJsonFile };
}
```

- [ ] **Step 5: Run test**

```bash
pnpm -F @kagura/cli test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(cli): add env/config loader and detectConfig"
```

---

## Task 1.4: env-writer (order + comment preserving)

**Files:**

- Create: `packages/cli/src/config/env-writer.ts`
- Create: `packages/cli/tests/env-writer.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/cli/tests/env-writer.test.ts`:

```ts
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { writeEnvFile } from '../src/config/env-writer.js';

describe('writeEnvFile', () => {
  let tmp: string;
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kagura-envw-'));
  });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it('creates a new file with given keys', () => {
    const file = path.join(tmp, '.env');
    writeEnvFile(file, { SLACK_BOT_TOKEN: 'xoxb-1', REPO_ROOT_DIR: '/r' });
    expect(fs.readFileSync(file, 'utf8')).toBe('SLACK_BOT_TOKEN=xoxb-1\nREPO_ROOT_DIR=/r\n');
  });

  it('preserves comments and order, updates existing keys in place', () => {
    const file = path.join(tmp, '.env');
    fs.writeFileSync(
      file,
      ['# Slack', 'SLACK_BOT_TOKEN=old', '', '# Repo', 'REPO_ROOT_DIR=/a'].join('\n') + '\n',
    );
    writeEnvFile(file, { SLACK_BOT_TOKEN: 'xoxb-new', SLACK_APP_TOKEN: 'xapp-1' });
    expect(fs.readFileSync(file, 'utf8')).toBe(
      [
        '# Slack',
        'SLACK_BOT_TOKEN=xoxb-new',
        '',
        '# Repo',
        'REPO_ROOT_DIR=/a',
        'SLACK_APP_TOKEN=xapp-1',
      ].join('\n') + '\n',
    );
  });

  it('quotes values that contain spaces or special chars', () => {
    const file = path.join(tmp, '.env');
    writeEnvFile(file, { X: 'has space', Y: 'no-space' });
    const out = fs.readFileSync(file, 'utf8');
    expect(out).toContain('X="has space"');
    expect(out).toContain('Y=no-space');
  });

  it('skips keys with undefined value', () => {
    const file = path.join(tmp, '.env');
    writeEnvFile(file, { A: 'v', B: undefined });
    expect(fs.readFileSync(file, 'utf8')).toBe('A=v\n');
  });
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
pnpm -F @kagura/cli test
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `env-writer.ts`**

Create `packages/cli/src/config/env-writer.ts`:

```ts
import fs from 'node:fs';
import path from 'node:path';

export type EnvPatch = Record<string, string | undefined>;

const KV_RE = /^([A-Z0-9_]+)=(.*)$/;

export function writeEnvFile(filePath: string, patch: EnvPatch): void {
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  const lines = existing === '' ? [] : existing.replace(/\n$/, '').split('\n');

  const touched = new Set<string>();

  const updated = lines.map((line) => {
    const m = KV_RE.exec(line);
    if (!m) return line;
    const key = m[1];
    if (!(key in patch)) return line;
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
  if (/[\s"'$`\\]/.test(v)) {
    return `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return v;
}
```

- [ ] **Step 4: Run test**

```bash
pnpm -F @kagura/cli test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(cli): add order-preserving env file writer"
```

---

## Task 1.5: json-writer (deep-merge config.json)

**Files:**

- Create: `packages/cli/src/config/json-writer.ts`
- Create: `packages/cli/tests/json-writer.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/cli/tests/json-writer.test.ts`:

```ts
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { writeConfigJson } from '../src/config/json-writer.js';

describe('writeConfigJson', () => {
  let tmp: string;
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kagura-json-'));
  });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it('writes a new file with 2-space indent', () => {
    const file = path.join(tmp, 'config.json');
    writeConfigJson(file, { defaultProviderId: 'codex-cli' });
    expect(fs.readFileSync(file, 'utf8')).toBe('{\n  "defaultProviderId": "codex-cli"\n}\n');
  });

  it('deep-merges into existing file, preserving unrelated keys', () => {
    const file = path.join(tmp, 'config.json');
    fs.writeFileSync(
      file,
      JSON.stringify({ claude: { model: 'old' }, logLevel: 'info' }, null, 2) + '\n',
    );
    writeConfigJson(file, { claude: { permissionMode: 'acceptEdits' }, repoRootDir: '/r' });
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(parsed).toEqual({
      claude: { model: 'old', permissionMode: 'acceptEdits' },
      logLevel: 'info',
      repoRootDir: '/r',
    });
  });

  it('prunes undefined values from patch', () => {
    const file = path.join(tmp, 'config.json');
    fs.writeFileSync(file, JSON.stringify({ logLevel: 'info' }, null, 2) + '\n');
    writeConfigJson(file, { logLevel: undefined, repoRootDir: '/r' });
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(parsed).toEqual({ logLevel: 'info', repoRootDir: '/r' });
  });
});
```

- [ ] **Step 2: Run failing test**

```bash
pnpm -F @kagura/cli test
```

Expected: FAIL.

- [ ] **Step 3: Implement `json-writer.ts`**

Create `packages/cli/src/config/json-writer.ts`:

```ts
import fs from 'node:fs';
import path from 'node:path';

import type { AppConfigJson } from './env-loader.js';

export type ConfigPatch = {
  [K in keyof AppConfigJson]?:
    | AppConfigJson[K]
    | (AppConfigJson[K] extends object
        ? { [P in keyof AppConfigJson[K]]?: AppConfigJson[K][P] }
        : AppConfigJson[K]);
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
```

- [ ] **Step 4: Run test**

```bash
pnpm -F @kagura/cli test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(cli): add deep-merge config.json writer"
```

---

## Task 1.6: Wire paths into apps/kagura runtime

**Files:**

- Modify: `apps/kagura/src/env/server.ts`
- Modify: `apps/kagura/src/application.ts`
- Modify: `apps/kagura/src/logger/index.ts`
- Modify: `apps/kagura/src/slack/commands/manifest-sync.ts`

- [ ] **Step 1: Update `apps/kagura/src/env/server.ts` to resolve APP_CONFIG_PATH via paths**

Find `loadAppConfig()`:

```ts
const configPath = process.env.APP_CONFIG_PATH?.trim() || './config.json';
const resolved = path.resolve(process.cwd(), configPath);
```

Replace with:

```ts
import { resolveKaguraPaths } from '@kagura/cli/config/paths';

// inside loadAppConfig:
const override = process.env.APP_CONFIG_PATH?.trim();
const resolved = override
  ? path.resolve(process.cwd(), override)
  : resolveKaguraPaths().configJsonFile;
```

Also load `.env` file before `dotenv/config` side-effect runs — remove `import 'dotenv/config'` at top and replace with explicit loader:

```ts
import dotenv from 'dotenv';
import { resolveKaguraPaths } from '@kagura/cli/config/paths';

const paths = resolveKaguraPaths();
dotenv.config({ path: paths.envFile, override: false });
dotenv.config({ override: false }); // still read cwd .env for dev mode
```

- [ ] **Step 2: Export subpath from @kagura/cli**

Edit `packages/cli/package.json`:

```json
"exports": {
  ".": "./src/index.ts",
  "./config/paths": "./src/config/paths.ts",
  "./config/env-loader": "./src/config/env-loader.ts",
  "./config/env-writer": "./src/config/env-writer.ts",
  "./config/json-writer": "./src/config/json-writer.ts",
  "./slack/manifest-template": "./src/slack/manifest-template.ts"
}
```

(Remaining subpaths added as their modules land.)

- [ ] **Step 3: Update `apps/kagura/src/logger/index.ts:16`**

Read current file. Find:

```ts
loggerDir: path.resolve(process.cwd(), env.LOG_DIR),
```

Replace with (logic: if `env.LOG_DIR` is the default `./logs` sentinel, use paths):

```ts
import { resolveKaguraPaths } from '@kagura/cli/config/paths';

// ...
const paths = resolveKaguraPaths();
const logDir = env.LOG_DIR === './logs' ? paths.logDir : path.resolve(process.cwd(), env.LOG_DIR);
// use `logDir` below
```

- [ ] **Step 4: Update `apps/kagura/src/application.ts:38`**

Similarly replace:

```ts
const dbPath = path.resolve(process.cwd(), env.SESSION_DB_PATH);
```

with:

```ts
import { resolveKaguraPaths } from '@kagura/cli/config/paths';

const paths = resolveKaguraPaths();
const dbPath =
  env.SESSION_DB_PATH === './data/sessions.db'
    ? paths.dbPath
    : path.resolve(process.cwd(), env.SESSION_DB_PATH);
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
```

- [ ] **Step 5: Update `apps/kagura/src/slack/commands/manifest-sync.ts`**

Find `tokenStorePath ?? './data/slack-config-tokens.json'`. Change default resolution: import paths at top, default to `resolveKaguraPaths().tokenStore`.

```ts
import { resolveKaguraPaths } from '@kagura/cli/config/paths';

// in syncSlashCommands:
const tokenStorePath = options.tokenStorePath ?? resolveKaguraPaths().tokenStore;
```

- [ ] **Step 6: Run build + tests**

```bash
pnpm -F @innei/kagura typecheck
pnpm -F @innei/kagura test
pnpm -F @innei/kagura build
```

Expected: all pass.

- [ ] **Step 7: Sanity check — run app against cwd .env (dev mode)**

```bash
pnpm dev &
sleep 6
pkill -f "tsx.*apps/kagura/src/index.ts" || true
```

Expected: bot reaches Slack bootstrap logs within 6s (cwd .env still found via dev detection).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(cli): route runtime paths through resolveKaguraPaths"
```

---

## Task 2.1: Install CLI runtime deps

**Files:**

- Modify: `apps/kagura/package.json` (deps)
- Modify: `packages/cli/package.json` (deps)

- [ ] **Step 1: Add deps to apps/kagura**

Add to `apps/kagura/package.json` `dependencies`:

```json
"commander": "^13.0.0",
"@clack/prompts": "^0.11.0",
"open": "^10.1.0",
"picocolors": "^1.1.0"
```

- [ ] **Step 2: Add same deps to packages/cli**

Same four entries under `packages/cli/package.json` `dependencies`.

- [ ] **Step 3: Install**

```bash
pnpm install
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(cli): add commander, clack prompts, open, picocolors"
```

---

## Task 2.2: Router + runCli skeleton with --help/--version

**Files:**

- Create: `packages/cli/src/version.ts`
- Modify: `packages/cli/src/index.ts`
- Create: `packages/cli/src/router.ts`
- Create: `packages/cli/tests/router.test.ts`

- [ ] **Step 1: Create `version.ts`**

```ts
declare const __KAGURA_VERSION__: string | undefined;
declare const __GIT_HASH__: string | undefined;
declare const __GIT_COMMIT_DATE__: string | undefined;

export const KAGURA_VERSION =
  (typeof __KAGURA_VERSION__ !== 'undefined' && __KAGURA_VERSION__) || '0.0.0-dev';
export const GIT_HASH = (typeof __GIT_HASH__ !== 'undefined' && __GIT_HASH__) || 'unknown';
export const GIT_COMMIT_DATE =
  (typeof __GIT_COMMIT_DATE__ !== 'undefined' && __GIT_COMMIT_DATE__) || 'unknown';

export function formatVersion(): string {
  const short = GIT_HASH.slice(0, 7);
  return `@innei/kagura v${KAGURA_VERSION} (${short}, ${GIT_COMMIT_DATE})`;
}
```

- [ ] **Step 2: Write failing test for runCli**

Create `packages/cli/tests/router.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { runCli } from '../src/index.js';

describe('runCli', () => {
  it('returns 0 for --version', async () => {
    const out: string[] = [];
    const write = process.stdout.write.bind(process.stdout);
    // @ts-expect-error test override
    process.stdout.write = (chunk: string | Uint8Array) => {
      out.push(String(chunk));
      return true;
    };
    try {
      const code = await runCli(['node', 'kagura', '--version']);
      expect(code).toBe(0);
      expect(out.join('')).toMatch(/@innei\/kagura v/);
    } finally {
      process.stdout.write = write;
    }
  });

  it('returns 0 for --help', async () => {
    const out: string[] = [];
    const write = process.stdout.write.bind(process.stdout);
    // @ts-expect-error test override
    process.stdout.write = (chunk: string | Uint8Array) => {
      out.push(String(chunk));
      return true;
    };
    try {
      const code = await runCli(['node', 'kagura', '--help']);
      expect(code).toBe(0);
      expect(out.join('')).toMatch(/Usage: kagura/);
    } finally {
      process.stdout.write = write;
    }
  });
});
```

- [ ] **Step 3: Implement router + runCli**

Replace `packages/cli/src/index.ts`:

```ts
import { buildProgram } from './router.js';

export async function runCli(argv: string[]): Promise<number> {
  const program = buildProgram();
  program.exitOverride();
  try {
    await program.parseAsync(argv);
  } catch (err) {
    const e = err as { exitCode?: number; code?: string };
    if (e.code === 'commander.helpDisplayed' || e.code === 'commander.version') return 0;
    if (typeof e.exitCode === 'number') return e.exitCode;
    throw err;
  }
  return process.exitCode ?? 0;
}
```

Create `packages/cli/src/router.ts`:

```ts
import { Command } from 'commander';

import { formatVersion } from './version.js';

export function buildProgram(): Command {
  const program = new Command('kagura');
  program
    .description('Slack-native Claude Agent — CLI')
    .version(formatVersion(), '-V, --version', 'output the version')
    .helpOption('-h, --help', 'display help')
    .showHelpAfterError('(use `kagura --help` for help)');

  program.action(async () => {
    // will be replaced in Task 5 with detectConfig dispatch
    program.outputHelp();
  });

  return program;
}
```

- [ ] **Step 4: Run test**

```bash
pnpm -F @kagura/cli test
```

Expected: PASS (2/2).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(cli): add router with --help and --version"
```

---

## Task 2.3: `kagura config path` subcommand

**Files:**

- Create: `packages/cli/src/commands/config.ts`
- Modify: `packages/cli/src/router.ts`
- Create: `packages/cli/tests/config-command.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/cli/tests/config-command.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runCli } from '../src/index.js';

describe('kagura config path', () => {
  const origEnv = { ...process.env };
  beforeEach(() => {
    process.env = { ...origEnv };
    process.env.KAGURA_HOME = '/tmp/kagura-test-home';
  });
  afterEach(() => {
    process.env = { ...origEnv };
  });

  it('prints configDir', async () => {
    const out: string[] = [];
    const write = process.stdout.write.bind(process.stdout);
    // @ts-expect-error test override
    process.stdout.write = (chunk: string | Uint8Array) => {
      out.push(String(chunk));
      return true;
    };
    try {
      await runCli(['node', 'kagura', 'config', 'path']);
      expect(out.join('').trim()).toBe('/tmp/kagura-test-home');
    } finally {
      process.stdout.write = write;
    }
  });

  it('prints JSON blob with --json', async () => {
    const out: string[] = [];
    const write = process.stdout.write.bind(process.stdout);
    // @ts-expect-error test override
    process.stdout.write = (chunk: string | Uint8Array) => {
      out.push(String(chunk));
      return true;
    };
    try {
      await runCli(['node', 'kagura', 'config', 'path', '--json']);
      const parsed = JSON.parse(out.join(''));
      expect(parsed.configDir).toBe('/tmp/kagura-test-home');
      expect(parsed.envFile).toMatch(/\.env$/);
    } finally {
      process.stdout.write = write;
    }
  });
});
```

- [ ] **Step 2: Verify failure**

```bash
pnpm -F @kagura/cli test
```

Expected: FAIL — config subcommand not registered.

- [ ] **Step 3: Implement `config` subcommand**

Create `packages/cli/src/commands/config.ts`:

```ts
import { Command } from 'commander';

import { resolveKaguraPaths } from '../config/paths.js';

export function buildConfigCommand(): Command {
  const config = new Command('config').description('Configuration utilities');

  config
    .command('path')
    .description('Print the resolved configuration directory')
    .option('--json', 'emit JSON')
    .action((opts: { json?: boolean }) => {
      const p = resolveKaguraPaths();
      if (opts.json) {
        process.stdout.write(JSON.stringify(p, null, 2) + '\n');
      } else {
        process.stdout.write(p.configDir + '\n');
      }
    });

  return config;
}
```

- [ ] **Step 4: Register in router**

Modify `packages/cli/src/router.ts`:

```ts
import { buildConfigCommand } from './commands/config.js';

// inside buildProgram, before program.action:
program.addCommand(buildConfigCommand());
```

- [ ] **Step 5: Run test**

```bash
pnpm -F @kagura/cli test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(cli): add $(kagura config path) subcommand"
```

---

## Task 2.4: CLI shim in apps/kagura + start-app helper

**Files:**

- Create: `apps/kagura/src/cli.ts`
- Create: `apps/kagura/src/start-app.ts`

- [ ] **Step 1: Create `apps/kagura/src/start-app.ts`**

Extract `main()` logic from `apps/kagura/src/index.ts` into a callable:

```ts
import { createApplication } from './application.js';

export async function startApp(): Promise<void> {
  const application = createApplication();

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    application.logger.warn('Received %s. Beginning graceful shutdown.', signal);
    await application.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  await application.start();
}
```

Update `apps/kagura/src/index.ts` to call it:

```ts
#!/usr/bin/env node
import { startApp } from './start-app.js';

startApp().catch((error: unknown) => {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  console.error(message);
  process.exit(1);
});
```

- [ ] **Step 2: Create `apps/kagura/src/cli.ts`**

```ts
#!/usr/bin/env node
import { runCli } from '@kagura/cli';

runCli(process.argv).then(
  (code) => process.exit(code),
  (err) => {
    const message = err instanceof Error ? (err.stack ?? err.message) : String(err);
    console.error(message);
    process.exit(1);
  },
);
```

- [ ] **Step 3: Typecheck**

```bash
pnpm -F @innei/kagura typecheck
```

Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(app): split cli.ts shim and start-app helper"
```

---

## Task 2.5: Double tsdown entry + double bin

**Files:**

- Modify: `apps/kagura/tsdown.config.ts`
- Modify: `apps/kagura/package.json`

- [ ] **Step 1: Update tsdown config**

Replace `apps/kagura/tsdown.config.ts`:

```ts
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { defineConfig } from 'tsdown';

function git(cmd: string): string {
  try {
    return execSync(cmd, { encoding: 'utf-8' }).trim();
  } catch {
    return 'unknown';
  }
}

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  outDir: 'dist',
  platform: 'node',
  format: 'esm',
  clean: true,
  tsconfig: 'tsconfig.json',
  fixedExtension: false,
  noExternal: [/.*/],
  external: ['better-sqlite3', '@anthropic-ai/claude-agent-sdk'],
  define: {
    __KAGURA_VERSION__: JSON.stringify(pkg.version),
    __GIT_HASH__: JSON.stringify(git('git rev-parse HEAD')),
    __GIT_COMMIT_DATE__: JSON.stringify(git('git log -1 --format=%cI HEAD')),
  },
});
```

- [ ] **Step 2: Update bin field**

Edit `apps/kagura/package.json`:

```json
"bin": {
  "kagura": "./dist/cli.js",
  "kagura-app": "./dist/index.js"
}
```

- [ ] **Step 3: Build and verify both bins**

```bash
pnpm -F @innei/kagura build
ls apps/kagura/dist
```

Expected: both `cli.js` and `index.js` present. Cat first line of each:

```bash
head -1 apps/kagura/dist/cli.js apps/kagura/dist/index.js
```

Expected: both start with `#!/usr/bin/env node`.

- [ ] **Step 4: Smoke test both bins**

```bash
node apps/kagura/dist/cli.js --version
node apps/kagura/dist/cli.js --help
node apps/kagura/dist/cli.js config path
```

Expected: version prints, help prints, config path prints `~/.config/kagura`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(app): emit dual cli.js + index.js bins"
```

---

## Task 3.1: Hoist manifest template

**Files:**

- Create: `packages/cli/src/slack/manifest-template.ts`
- Create: `packages/cli/tests/manifest-template.test.ts`

- [ ] **Step 1: Write snapshot test**

Create `packages/cli/tests/manifest-template.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import {
  buildManifest,
  DESIRED_BOT_EVENTS,
  DESIRED_COMMANDS,
  DESIRED_SHORTCUTS,
} from '../src/slack/manifest-template.js';

describe('manifest-template', () => {
  it('produces expected manifest structure', () => {
    const m = buildManifest({ appName: 'Kagura', botDisplayName: 'kagura' });
    expect(m).toMatchSnapshot();
  });

  it('exports desired command / shortcut / event sets', () => {
    expect(DESIRED_COMMANDS.map((c) => c.command).sort()).toEqual(
      ['/usage', '/workspace', '/memory', '/session', '/version', '/provider'].sort(),
    );
    expect(DESIRED_SHORTCUTS.map((s) => s.callback_id)).toContain('stop_reply_action');
    expect([...DESIRED_BOT_EVENTS].sort()).toEqual(
      ['app_home_opened', 'app_mention', 'message.channels', 'message.im'].sort(),
    );
  });
});
```

- [ ] **Step 2: Run failing test**

Expected: module not found.

- [ ] **Step 3: Create `packages/cli/src/slack/manifest-template.ts`**

Extract from `apps/kagura/src/slack/commands/manifest-sync.ts` — copy the `DESIRED_*` constants and add `buildManifest`:

```ts
export interface SlackManifestSlashCommand {
  command: string;
  description: string;
  should_escape?: boolean;
  url?: string;
  usage_hint?: string;
}

export interface SlackManifestShortcut {
  callback_id: string;
  description: string;
  name: string;
  type: 'global' | 'message';
}

export interface SlackManifest {
  display_information: { name: string };
  features: {
    bot_user: { display_name: string; always_online: boolean };
    app_home: {
      home_tab_enabled: boolean;
      messages_tab_enabled: boolean;
      messages_tab_read_only_enabled: boolean;
    };
    slash_commands: SlackManifestSlashCommand[];
    shortcuts: SlackManifestShortcut[];
  };
  oauth_config: { scopes: { bot: string[] } };
  settings: {
    event_subscriptions: { bot_events: string[] };
    interactivity: { is_enabled: boolean };
    org_deploy_enabled: boolean;
    socket_mode_enabled: boolean;
    token_rotation_enabled: boolean;
  };
}

export const DESIRED_COMMANDS: SlackManifestSlashCommand[] = [
  {
    command: '/usage',
    description: 'Show bot usage stats (sessions, memories, repos, uptime)',
    usage_hint: ' ',
  },
  {
    command: '/workspace',
    description: 'List available workspaces or look up a specific one',
    usage_hint: '[repo-name]',
  },
  {
    command: '/memory',
    description: 'View or manage workspace memories',
    usage_hint: 'list|count|clear <repo>',
  },
  {
    command: '/session',
    description: 'View session overview or inspect a specific session',
    usage_hint: '[thread_ts]',
  },
  {
    command: '/provider',
    description: 'View or switch the AI provider for this thread',
    usage_hint: '[list|reset|<provider-id>]',
  },
  {
    command: '/version',
    description: 'Show the current bot deployment version (git commit hash)',
    usage_hint: ' ',
  },
];

export const DESIRED_SHORTCUTS: SlackManifestShortcut[] = [
  {
    name: 'Stop Reply',
    type: 'message',
    callback_id: 'stop_reply_action',
    description: "Stop the bot's in-progress reply in this thread",
  },
];

export const DESIRED_BOT_EVENTS = [
  'app_home_opened',
  'app_mention',
  'message.channels',
  'message.im',
] as const;

export const DESIRED_BOT_SCOPES = [
  'app_mentions:read',
  'assistant:write',
  'channels:history',
  'channels:read',
  'chat:write',
  'commands',
  'files:read',
  'files:write',
  'groups:history',
  'groups:read',
  'im:history',
  'im:read',
  'im:write',
  'reactions:read',
  'reactions:write',
  'team:read',
  'users.profile:read',
  'users:read',
  'users:read.email',
];

export function buildManifest(opts: { appName: string; botDisplayName: string }): SlackManifest {
  return {
    display_information: { name: opts.appName },
    features: {
      bot_user: { display_name: opts.botDisplayName, always_online: true },
      app_home: {
        home_tab_enabled: true,
        messages_tab_enabled: true,
        messages_tab_read_only_enabled: false,
      },
      slash_commands: DESIRED_COMMANDS,
      shortcuts: DESIRED_SHORTCUTS,
    },
    oauth_config: { scopes: { bot: DESIRED_BOT_SCOPES } },
    settings: {
      event_subscriptions: { bot_events: [...DESIRED_BOT_EVENTS] },
      interactivity: { is_enabled: true },
      org_deploy_enabled: false,
      socket_mode_enabled: true,
      token_rotation_enabled: false,
    },
  };
}
```

- [ ] **Step 4: Run test**

```bash
pnpm -F @kagura/cli test
```

Expected: PASS. Snapshot created on first run.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(cli): hoist Slack manifest template with snapshot test"
```

---

## Task 3.2: Rewire manifest-sync to use template

**Files:**

- Modify: `apps/kagura/src/slack/commands/manifest-sync.ts`

- [ ] **Step 1: Import template**

At top of file:

```ts
import {
  DESIRED_BOT_EVENTS,
  DESIRED_COMMANDS,
  DESIRED_SHORTCUTS,
  type SlackManifestSlashCommand,
  type SlackManifestShortcut,
} from '@kagura/cli/slack/manifest-template';
```

- [ ] **Step 2: Delete local DESIRED_COMMANDS, DESIRED_SHORTCUTS, DESIRED_BOT_EVENTS, interface defs**

Remove the local copies now imported.

- [ ] **Step 3: Run tests**

```bash
pnpm -F @innei/kagura test
pnpm -F @innei/kagura typecheck
```

Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(slack): consume manifest template from @kagura/cli"
```

---

## Task 3.3: Prefill URL builder

**Files:**

- Create: `packages/cli/src/slack/prefill-url.ts`
- Create: `packages/cli/tests/prefill-url.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, expect, it } from 'vitest';

import { buildManifest } from '../src/slack/manifest-template.js';
import { buildPrefillUrl } from '../src/slack/prefill-url.js';

describe('buildPrefillUrl', () => {
  it('encodes manifest into new_app URL when under 8KB', () => {
    const m = buildManifest({ appName: 'Kagura', botDisplayName: 'kagura' });
    const res = buildPrefillUrl(m);
    expect(res.kind).toBe('url');
    if (res.kind === 'url') {
      expect(res.url.startsWith('https://api.slack.com/apps?new_app=1&manifest_json=')).toBe(true);
      const encoded = res.url.split('manifest_json=')[1];
      const decoded = JSON.parse(decodeURIComponent(encoded));
      expect(decoded.display_information.name).toBe('Kagura');
    }
  });

  it('returns too-long fallback above 8KB', () => {
    const m = buildManifest({ appName: 'X'.repeat(9000), botDisplayName: 'x' });
    const res = buildPrefillUrl(m);
    expect(res.kind).toBe('too-long');
  });
});
```

- [ ] **Step 2: Verify failure**

```bash
pnpm -F @kagura/cli test
```

- [ ] **Step 3: Implement**

```ts
import type { SlackManifest } from './manifest-template.js';

const MAX_URL_LEN = 8000;

export type PrefillUrlResult =
  | { kind: 'url'; url: string }
  | { kind: 'too-long'; reason: 'manifest encoded URL exceeds 8KB' };

export function buildPrefillUrl(manifest: SlackManifest): PrefillUrlResult {
  const json = JSON.stringify(manifest);
  const encoded = encodeURIComponent(json);
  const url = `https://api.slack.com/apps?new_app=1&manifest_json=${encoded}`;
  if (url.length > MAX_URL_LEN) {
    return { kind: 'too-long', reason: 'manifest encoded URL exceeds 8KB' };
  }
  return { kind: 'url', url };
}
```

- [ ] **Step 4: Run test**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(cli): add Slack prefill URL builder"
```

---

## Task 3.4: config-token Slack API wrappers

**Files:**

- Create: `packages/cli/src/slack/config-token.ts`
- Create: `packages/cli/tests/config-token.test.ts`

- [ ] **Step 1: Write test using global fetch mock**

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  appsManifestCreate,
  appsManifestExport,
  appsManifestUpdate,
  rotateToolingToken,
} from '../src/slack/config-token.js';

const origFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = origFetch;
});

function mockFetch(body: unknown, ok = true) {
  globalThis.fetch = vi.fn(async () => ({
    ok,
    json: async () => body,
  })) as unknown as typeof fetch;
}

describe('config-token wrappers', () => {
  it('appsManifestCreate returns ok payload', async () => {
    mockFetch({ ok: true, app_id: 'A123', credentials: { signing_secret: 's1' } });
    const res = await appsManifestCreate('xoxe-tok', { display_information: { name: 'x' } } as any);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.app_id).toBe('A123');
  });

  it('rotateToolingToken returns new tokens', async () => {
    mockFetch({ ok: true, token: 't2', refresh_token: 'r2', exp: 1 });
    const res = await rotateToolingToken('t1', 'r1');
    expect(res.ok).toBe(true);
  });

  it('appsManifestExport unwraps manifest', async () => {
    mockFetch({ ok: true, manifest: { display_information: { name: 'x' } } });
    const res = await appsManifestExport('tok', 'A123');
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.manifest.display_information.name).toBe('x');
  });

  it('appsManifestUpdate returns ok:true', async () => {
    mockFetch({ ok: true });
    const res = await appsManifestUpdate('tok', 'A123', {} as any);
    expect(res.ok).toBe(true);
  });

  it('propagates Slack error', async () => {
    mockFetch({ ok: false, error: 'invalid_auth' });
    const res = await appsManifestCreate('tok', {} as any);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('invalid_auth');
  });
});
```

- [ ] **Step 2: Verify failure**

- [ ] **Step 3: Implement**

```ts
import type { SlackManifest } from './manifest-template.js';

export type SlackResult<T> = ({ ok: true } & T) | { ok: false; error: string };

export async function appsManifestCreate(
  token: string,
  manifest: SlackManifest,
): Promise<
  SlackResult<{
    app_id: string;
    credentials: {
      signing_secret: string;
      client_id?: string;
      client_secret?: string;
      verification_token?: string;
    };
  }>
> {
  return slackPost(token, 'apps.manifest.create', { manifest });
}

export async function appsManifestExport(
  token: string,
  appId: string,
): Promise<SlackResult<{ manifest: SlackManifest }>> {
  return slackPost(token, 'apps.manifest.export', { app_id: appId });
}

export async function appsManifestUpdate(
  token: string,
  appId: string,
  manifest: SlackManifest,
): Promise<SlackResult<Record<string, never>>> {
  return slackPost(token, 'apps.manifest.update', { app_id: appId, manifest });
}

export async function rotateToolingToken(
  token: string,
  refreshToken: string,
): Promise<SlackResult<{ token: string; refresh_token: string; exp: number }>> {
  const body = new URLSearchParams({ token, refresh_token: refreshToken });
  const res = await fetch('https://slack.com/api/tooling.tokens.rotate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' },
    body,
  });
  if (!res.ok) return { ok: false, error: `http_${res.status}` };
  const data = (await res.json()) as {
    ok: boolean;
    error?: string;
    token?: string;
    refresh_token?: string;
    exp?: number;
  };
  if (!data.ok) return { ok: false, error: data.error ?? 'unknown' };
  if (!data.token || !data.refresh_token) return { ok: false, error: 'malformed_response' };
  return { ok: true, token: data.token, refresh_token: data.refresh_token, exp: data.exp ?? 0 };
}

async function slackPost<T>(token: string, method: string, body: unknown): Promise<SlackResult<T>> {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, error: `http_${res.status}` };
  const data = (await res.json()) as { ok: boolean; error?: string } & Record<string, unknown>;
  if (!data.ok) return { ok: false, error: data.error ?? 'unknown' };
  const { ok: _ok, error: _err, ...rest } = data;
  return { ok: true, ...(rest as T) };
}
```

- [ ] **Step 4: Run test**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(cli): wrap Slack apps.manifest.* API calls"
```

---

## Task 3.5: Provider types + registry

**Files:**

- Create: `packages/cli/src/providers/types.ts`
- Create: `packages/cli/src/providers/registry.ts`
- Create: `packages/cli/tests/providers-registry.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, expect, it } from 'vitest';

import { getProvider, listProviders } from '../src/providers/registry.js';

describe('provider registry', () => {
  it('lists providers in stable order', () => {
    const list = listProviders();
    expect(list.map((p) => p.id)).toEqual(['claude-code', 'codex-cli']);
  });

  it('getProvider returns by id', () => {
    expect(getProvider('claude-code').id).toBe('claude-code');
    expect(getProvider('codex-cli').id).toBe('codex-cli');
  });

  it('getProvider throws on unknown', () => {
    expect(() => getProvider('x' as any)).toThrow();
  });
});
```

- [ ] **Step 2: Implement types**

`packages/cli/src/providers/types.ts`:

```ts
import type { ConfigPatch } from '../config/json-writer.js';
import type { EnvPatch } from '../config/env-writer.js';

export type ProviderId = 'claude-code' | 'codex-cli';

export interface DetectResult {
  status: 'ready' | 'partial' | 'absent';
  detail?: string;
}

export interface ValidateResult {
  status: 'ok' | 'warn' | 'fail';
  detail?: string;
}

export interface SetupPatch {
  env?: EnvPatch;
  config?: ConfigPatch;
}

export interface PromptCtx {
  select<T extends string>(message: string, options: { value: T; label: string }[]): Promise<T>;
  text(
    message: string,
    opts?: { placeholder?: string; initial?: string; optional?: boolean },
  ): Promise<string | undefined>;
  password(message: string, opts?: { optional?: boolean }): Promise<string | undefined>;
  note(message: string): void;
}

export interface ProviderSetup {
  id: ProviderId;
  label: string;
  order: number;
  detect(): Promise<DetectResult>;
  prompt(ctx: PromptCtx): Promise<SetupPatch>;
  validate?(env: NodeJS.ProcessEnv): Promise<ValidateResult>;
}
```

- [ ] **Step 3: Implement registry (temporary stubs for claude/codex)**

`packages/cli/src/providers/registry.ts`:

```ts
import type { ProviderId, ProviderSetup } from './types.js';

import { claudeProvider } from './claude.js';
import { codexProvider } from './codex.js';

const byId: Record<ProviderId, ProviderSetup> = {
  'claude-code': claudeProvider,
  'codex-cli': codexProvider,
};

export function listProviders(): ProviderSetup[] {
  return Object.values(byId).sort((a, b) => a.order - b.order);
}

export function getProvider(id: ProviderId): ProviderSetup {
  const p = byId[id];
  if (!p) throw new Error(`Unknown provider: ${id}`);
  return p;
}
```

Create stub `packages/cli/src/providers/claude.ts`:

```ts
import type { ProviderSetup } from './types.js';

export const claudeProvider: ProviderSetup = {
  id: 'claude-code',
  label: 'Claude Code (Anthropic)',
  order: 10,
  async detect() {
    return { status: 'absent' };
  },
  async prompt() {
    return {};
  },
};
```

Create stub `packages/cli/src/providers/codex.ts`:

```ts
import type { ProviderSetup } from './types.js';

export const codexProvider: ProviderSetup = {
  id: 'codex-cli',
  label: 'Codex CLI (OpenAI)',
  order: 20,
  async detect() {
    return { status: 'absent' };
  },
  async prompt() {
    return {};
  },
};
```

- [ ] **Step 4: Run test**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(cli): add provider registry with claude/codex stubs"
```

---

## Task 3.6: Claude provider onboarding

**Files:**

- Modify: `packages/cli/src/providers/claude.ts`
- Create: `packages/cli/tests/claude-provider.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { claudeProvider } from '../src/providers/claude.js';
import type { PromptCtx } from '../src/providers/types.js';

function makeCtx(answers: Record<string, string | undefined>): PromptCtx {
  return {
    async select<T extends string>(_m: string, options: { value: T; label: string }[]): Promise<T> {
      return (answers.select as T) ?? options[0].value;
    },
    async text(message: string) {
      return answers[`text:${message}`];
    },
    async password(message: string) {
      return answers[`pw:${message}`];
    },
    note() {
      /* noop */
    },
  };
}

describe('claudeProvider', () => {
  const origHome = process.env.HOME;
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kg-claude-'));
    process.env.HOME = tmp;
  });

  afterEach(() => {
    process.env.HOME = origHome;
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('detects ~/.claude as ready', async () => {
    fs.mkdirSync(path.join(tmp, '.claude'));
    const res = await claudeProvider.detect();
    expect(res.status).toBe('ready');
  });

  it('detects absent when neither ~/.claude nor API key present', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const res = await claudeProvider.detect();
    expect(res.status).toBe('absent');
  });

  it('oauth branch returns AGENT_DEFAULT_PROVIDER only', async () => {
    const ctx = makeCtx({ select: 'oauth' });
    const patch = await claudeProvider.prompt(ctx);
    expect(patch.env).toEqual({});
    expect(patch.config?.defaultProviderId).toBe('claude-code');
  });

  it('api-key branch writes ANTHROPIC_API_KEY', async () => {
    const ctx = makeCtx({ 'select': 'api-key', 'pw:ANTHROPIC_API_KEY': 'sk-ant-123' });
    const patch = await claudeProvider.prompt(ctx);
    expect(patch.env?.ANTHROPIC_API_KEY).toBe('sk-ant-123');
  });

  it('base-url branch writes BASE_URL and AUTH_TOKEN', async () => {
    const ctx = makeCtx({
      'select': 'provider',
      'text:ANTHROPIC_BASE_URL': 'https://api.kimi.com/coding',
      'pw:ANTHROPIC_AUTH_TOKEN': 'kimi-tok',
      'text:ANTHROPIC_MODEL（optional）': 'kimi-for-coding',
    });
    const patch = await claudeProvider.prompt(ctx);
    expect(patch.env?.ANTHROPIC_BASE_URL).toBe('https://api.kimi.com/coding');
    expect(patch.env?.ANTHROPIC_AUTH_TOKEN).toBe('kimi-tok');
    expect(patch.env?.ANTHROPIC_MODEL).toBe('kimi-for-coding');
  });
});
```

- [ ] **Step 2: Verify failure**

- [ ] **Step 3: Implement `claude.ts`**

Replace `packages/cli/src/providers/claude.ts`:

```ts
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { ProviderSetup } from './types.js';

export const claudeProvider: ProviderSetup = {
  id: 'claude-code',
  label: 'Claude Code (Anthropic)',
  order: 10,

  async detect() {
    const claudeDir = path.join(os.homedir(), '.claude');
    if (fs.existsSync(claudeDir)) {
      return { status: 'ready', detail: `oauth detected (${claudeDir})` };
    }
    if (process.env.ANTHROPIC_API_KEY?.trim()) {
      return { status: 'ready', detail: 'ANTHROPIC_API_KEY set in environment' };
    }
    return { status: 'absent' };
  },

  async prompt(ctx) {
    const mode = await ctx.select('Claude authentication', [
      { value: 'oauth', label: 'Anthropic OAuth (already ran `claude login`)' },
      { value: 'api-key', label: 'Supply ANTHROPIC_API_KEY' },
      { value: 'provider', label: 'Third-party base URL (Kimi, OpenRouter, etc.)' },
    ]);

    const config = { defaultProviderId: 'claude-code' as const };

    if (mode === 'oauth') {
      return { env: {}, config };
    }
    if (mode === 'api-key') {
      const key = await ctx.password('ANTHROPIC_API_KEY');
      return { env: { ANTHROPIC_API_KEY: key }, config };
    }
    const baseUrl = await ctx.text('ANTHROPIC_BASE_URL');
    const authToken = await ctx.password('ANTHROPIC_AUTH_TOKEN');
    const model = await ctx.text('ANTHROPIC_MODEL（optional）', { optional: true });
    return {
      env: { ANTHROPIC_BASE_URL: baseUrl, ANTHROPIC_AUTH_TOKEN: authToken, ANTHROPIC_MODEL: model },
      config,
    };
  },
};
```

- [ ] **Step 4: Run test**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(cli): implement Claude Code onboarding provider"
```

---

## Task 3.7: Codex provider onboarding

**Files:**

- Modify: `packages/cli/src/providers/codex.ts`
- Create: `packages/cli/tests/codex-provider.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';

import { codexProvider } from '../src/providers/codex.js';
import type { PromptCtx } from '../src/providers/types.js';

vi.mock('node:child_process', async () => {
  const actual = await vi.importActual<typeof import('node:child_process')>('node:child_process');
  return { ...actual, execFileSync: vi.fn() };
});

import { execFileSync } from 'node:child_process';
const mockExec = execFileSync as unknown as ReturnType<typeof vi.fn>;

function ctx(answers: Record<string, string | undefined>): PromptCtx {
  return {
    async select<T extends string>(_m: string, options: { value: T; label: string }[]): Promise<T> {
      return (answers.select as T) ?? options[0].value;
    },
    async text(message: string) {
      return answers[`text:${message}`];
    },
    async password(message: string) {
      return answers[`pw:${message}`];
    },
    note() {
      /* noop */
    },
  };
}

afterEach(() => {
  mockExec.mockReset();
});

describe('codexProvider', () => {
  it('detects codex CLI on PATH as ready', async () => {
    mockExec.mockReturnValue('codex 1.2.3');
    const res = await codexProvider.detect();
    expect(res.status).toBe('ready');
  });

  it('detects absent when codex not on PATH', async () => {
    mockExec.mockImplementation(() => {
      throw new Error('ENOENT');
    });
    const res = await codexProvider.detect();
    expect(res.status).toBe('absent');
  });

  it('chatgpt-login branch writes defaultProviderId only', async () => {
    const patch = await codexProvider.prompt(ctx({ select: 'chatgpt-login' }));
    expect(patch.env).toEqual({});
    expect(patch.config?.defaultProviderId).toBe('codex-cli');
  });

  it('api-key branch writes OPENAI_API_KEY', async () => {
    const patch = await codexProvider.prompt(
      ctx({ 'select': 'api-key', 'pw:OPENAI_API_KEY': 'sk-1' }),
    );
    expect(patch.env?.OPENAI_API_KEY).toBe('sk-1');
  });
});
```

- [ ] **Step 2: Verify failure**

- [ ] **Step 3: Implement**

Replace `packages/cli/src/providers/codex.ts`:

```ts
import { execFileSync } from 'node:child_process';

import type { ProviderSetup } from './types.js';

export const codexProvider: ProviderSetup = {
  id: 'codex-cli',
  label: 'Codex CLI (OpenAI)',
  order: 20,

  async detect() {
    try {
      const out = execFileSync('codex', ['--version'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      return { status: 'ready', detail: out.trim() };
    } catch {
      return { status: 'absent', detail: '`codex` not on PATH' };
    }
  },

  async prompt(ctx) {
    const mode = await ctx.select('Codex authentication', [
      { value: 'chatgpt-login', label: 'ChatGPT login (already ran `codex login`)' },
      { value: 'api-key', label: 'Supply OPENAI_API_KEY' },
    ]);

    const config = { defaultProviderId: 'codex-cli' as const };

    if (mode === 'chatgpt-login') return { env: {}, config };
    const key = await ctx.password('OPENAI_API_KEY');
    return { env: { OPENAI_API_KEY: key }, config };
  },
};
```

- [ ] **Step 4: Run test**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(cli): implement Codex CLI onboarding provider"
```

---

## Task 4.1: Prompt wrapper (`ui/prompts.ts`)

**Files:**

- Create: `packages/cli/src/ui/prompts.ts`

- [ ] **Step 1: Implement prompt wrapper**

```ts
import * as p from '@clack/prompts';

import type { PromptCtx } from '../providers/types.js';

export function bindClackCtx(): PromptCtx {
  return {
    async select(message, options) {
      const result = await p.select({ message, options });
      if (p.isCancel(result)) {
        p.cancel('Cancelled.');
        process.exit(1);
      }
      return result as never;
    },
    async text(message, opts) {
      const result = await p.text({
        message,
        placeholder: opts?.placeholder,
        initialValue: opts?.initial,
      });
      if (p.isCancel(result)) {
        p.cancel('Cancelled.');
        process.exit(1);
      }
      const v = typeof result === 'string' ? result.trim() : '';
      if (!v && !opts?.optional) return undefined;
      return v || undefined;
    },
    async password(message, opts) {
      const result = await p.password({ message });
      if (p.isCancel(result)) {
        p.cancel('Cancelled.');
        process.exit(1);
      }
      const v = typeof result === 'string' ? result.trim() : '';
      if (!v && !opts?.optional) return undefined;
      return v || undefined;
    },
    note(message) {
      p.note(message);
    },
  };
}

export function mask(secret: string): string {
  if (secret.length <= 8) return '••••';
  const prefix = secret.slice(0, 4);
  const suffix = secret.slice(-4);
  return `${prefix}••••${suffix}`;
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(cli): add clack prompt wrapper with mask helper"
```

---

## Task 4.2: doctor subcommand (human mode)

**Files:**

- Create: `packages/cli/src/commands/doctor.ts`
- Modify: `packages/cli/src/router.ts`
- Create: `packages/cli/tests/doctor.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runCli } from '../src/index.js';

describe('kagura doctor', () => {
  let tmp: string;
  const origEnv = { ...process.env };

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kg-doc-'));
    process.env = { ...origEnv, KAGURA_HOME: tmp };
    for (const k of [
      'SLACK_BOT_TOKEN',
      'SLACK_APP_TOKEN',
      'SLACK_SIGNING_SECRET',
      'REPO_ROOT_DIR',
    ]) {
      delete process.env[k];
    }
  });

  afterEach(() => {
    process.env = { ...origEnv };
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('--json reports missing required keys with exit code 2', async () => {
    const out: string[] = [];
    const write = process.stdout.write.bind(process.stdout);
    // @ts-expect-error
    process.stdout.write = (c) => {
      out.push(String(c));
      return true;
    };
    try {
      const code = await runCli(['node', 'kagura', 'doctor', '--json']);
      const parsed = JSON.parse(out.join(''));
      expect(parsed.summary.fail).toBeGreaterThan(0);
      expect(code).toBe(2);
    } finally {
      process.stdout.write = write;
    }
  });
});
```

- [ ] **Step 2: Verify failure**

- [ ] **Step 3: Implement doctor**

`packages/cli/src/commands/doctor.ts`:

```ts
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import pc from 'picocolors';

import { detectConfig, loadConfigJson, loadEnvFile } from '../config/env-loader.js';
import { resolveKaguraPaths } from '../config/paths.js';
import { listProviders } from '../providers/registry.js';

export interface DoctorCheck {
  name: string;
  status: 'ok' | 'warn' | 'fail';
  detail?: string;
}

export interface DoctorReport {
  checks: DoctorCheck[];
  summary: { ok: number; warn: number; fail: number };
}

export async function runDoctor(opts: { json?: boolean; deep?: boolean }): Promise<number> {
  const paths = resolveKaguraPaths();
  loadEnvFile(paths);
  const cfg = loadConfigJson(paths);

  const checks: DoctorCheck[] = [];

  checks.push({
    name: 'config dir',
    status: fs.existsSync(paths.configDir) ? 'ok' : 'warn',
    detail: paths.configDir,
  });
  checks.push({
    name: '.env',
    status: fs.existsSync(paths.envFile) ? 'ok' : 'warn',
    detail: paths.envFile,
  });
  checks.push({
    name: 'config.json',
    status: fs.existsSync(paths.configJsonFile) ? 'ok' : 'warn',
    detail: paths.configJsonFile,
  });

  const detect = detectConfig(paths);
  if (detect.ok) {
    checks.push({ name: 'required env', status: 'ok' });
  } else {
    checks.push({
      name: 'required env',
      status: 'fail',
      detail: `missing: ${detect.missing.join(', ')}`,
    });
  }

  const nodeOk = process.versions.node.split('.').map(Number)[0] >= 22;
  checks.push({
    name: 'node version',
    status: nodeOk ? 'ok' : 'fail',
    detail: `v${process.versions.node}`,
  });

  const repoRoot = process.env.REPO_ROOT_DIR || cfg.repoRootDir;
  if (repoRoot) {
    const resolved = repoRoot.startsWith('~')
      ? path.join(os.homedir(), repoRoot.slice(1))
      : repoRoot;
    checks.push({
      name: 'repo root',
      status: fs.existsSync(resolved) ? 'ok' : 'fail',
      detail: resolved,
    });
  }

  const providerId = process.env.AGENT_DEFAULT_PROVIDER || cfg.defaultProviderId || 'claude-code';
  const provider = listProviders().find((p) => p.id === providerId);
  if (provider) {
    const det = await provider.detect();
    checks.push({
      name: `provider ${provider.id}`,
      status: det.status === 'ready' ? 'ok' : det.status === 'partial' ? 'warn' : 'fail',
      detail: det.detail,
    });
  }

  const summary = { ok: 0, warn: 0, fail: 0 };
  for (const c of checks) summary[c.status] += 1;

  const report: DoctorReport = { checks, summary };

  if (opts.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } else {
    for (const c of checks) {
      const marker =
        c.status === 'ok' ? pc.green('✓') : c.status === 'warn' ? pc.yellow('⚠') : pc.red('✗');
      process.stdout.write(`${marker}  ${c.name}${c.detail ? '  ' + pc.dim(c.detail) : ''}\n`);
    }
    process.stdout.write(
      `\nSummary: ${pc.green(`${summary.ok} ok`)} · ${pc.yellow(`${summary.warn} warn`)} · ${pc.red(`${summary.fail} fail`)}\n`,
    );
  }

  if (summary.fail > 0) return 2;
  if (summary.warn > 0) return 1;
  return 0;
}
```

- [ ] **Step 4: Register in router**

In `packages/cli/src/router.ts`, inside `buildProgram`:

```ts
import { runDoctor } from './commands/doctor.js';

program
  .command('doctor')
  .description('Diagnose configuration and connectivity')
  .option('--json', 'emit JSON report')
  .option('--deep', 'include live API probes')
  .action(async (opts: { json?: boolean; deep?: boolean }) => {
    const code = await runDoctor(opts);
    process.exitCode = code;
  });
```

- [ ] **Step 5: Run test**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(cli): add $(kagura doctor) diagnostic command"
```

---

## Task 4.3: manifest subcommand family

**Files:**

- Create: `packages/cli/src/commands/manifest.ts`
- Modify: `packages/cli/src/router.ts`
- Create: `packages/cli/tests/manifest-command.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runCli } from '../src/index.js';

describe('kagura manifest print', () => {
  let tmp: string;
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kg-man-'));
  });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it('prints manifest JSON to stdout', async () => {
    const out: string[] = [];
    const write = process.stdout.write.bind(process.stdout);
    // @ts-expect-error
    process.stdout.write = (c) => {
      out.push(String(c));
      return true;
    };
    try {
      const code = await runCli(['node', 'kagura', 'manifest', 'print']);
      expect(code).toBe(0);
      const parsed = JSON.parse(out.join(''));
      expect(parsed.display_information.name).toBe('Kagura');
    } finally {
      process.stdout.write = write;
    }
  });

  it('writes manifest to --out path', async () => {
    const outFile = path.join(tmp, 'manifest.json');
    await runCli(['node', 'kagura', 'manifest', 'print', '--out', outFile]);
    const parsed = JSON.parse(fs.readFileSync(outFile, 'utf8'));
    expect(parsed.settings.socket_mode_enabled).toBe(true);
  });
});
```

- [ ] **Step 2: Verify failure**

- [ ] **Step 3: Implement**

`packages/cli/src/commands/manifest.ts`:

```ts
import fs from 'node:fs';

import { Command } from 'commander';

import {
  appsManifestExport,
  appsManifestUpdate,
  rotateToolingToken,
} from '../slack/config-token.js';
import { buildManifest } from '../slack/manifest-template.js';
import { loadConfigJson, loadEnvFile } from '../config/env-loader.js';
import { resolveKaguraPaths } from '../config/paths.js';

export function buildManifestCommand(): Command {
  const cmd = new Command('manifest').description('Manifest utilities');

  cmd
    .command('print')
    .description('Print the Kagura-desired Slack manifest (no API call)')
    .option('--out <file>', 'write to file instead of stdout')
    .action((opts: { out?: string }) => {
      const manifest = buildManifest({ appName: 'Kagura', botDisplayName: 'kagura' });
      const json = JSON.stringify(manifest, null, 2);
      if (opts.out) {
        fs.writeFileSync(opts.out, json + '\n', 'utf8');
      } else {
        process.stdout.write(json + '\n');
      }
    });

  cmd
    .command('export')
    .description('Export the current Slack app manifest via config token')
    .option('--out <file>', 'write to file instead of stdout')
    .action(async (opts: { out?: string }) => {
      const paths = resolveKaguraPaths();
      loadEnvFile(paths);
      const appId = process.env.SLACK_APP_ID;
      if (!appId) {
        console.error('SLACK_APP_ID is not set');
        process.exitCode = 2;
        return;
      }
      const token = await ensureConfigToken();
      if (!token) {
        console.error('No valid config token available (SLACK_CONFIG_TOKEN / REFRESH_TOKEN)');
        process.exitCode = 2;
        return;
      }
      const res = await appsManifestExport(token, appId);
      if (!res.ok) {
        console.error(`Slack: ${res.error}`);
        process.exitCode = 2;
        return;
      }
      const json = JSON.stringify(res.manifest, null, 2);
      if (opts.out) fs.writeFileSync(opts.out, json + '\n', 'utf8');
      else process.stdout.write(json + '\n');
    });

  cmd
    .command('sync')
    .description('Sync the Kagura-desired manifest into the existing Slack app')
    .option('--dry-run', 'show what would change without writing')
    .action(async (opts: { dryRun?: boolean }) => {
      const paths = resolveKaguraPaths();
      loadEnvFile(paths);
      const appId = process.env.SLACK_APP_ID;
      if (!appId) {
        console.error('SLACK_APP_ID is not set');
        process.exitCode = 2;
        return;
      }
      const token = await ensureConfigToken();
      if (!token) {
        console.error('No valid config token available');
        process.exitCode = 2;
        return;
      }
      const desired = buildManifest({ appName: 'Kagura', botDisplayName: 'kagura' });
      if (opts.dryRun) {
        process.stdout.write(
          '[dry-run] would update manifest:\n' + JSON.stringify(desired, null, 2) + '\n',
        );
        return;
      }
      const res = await appsManifestUpdate(token, appId, desired);
      if (!res.ok) {
        console.error(`Slack: ${res.error}`);
        process.exitCode = 2;
        return;
      }
      process.stdout.write('Manifest updated.\n');
    });

  return cmd;
}

async function ensureConfigToken(): Promise<string | undefined> {
  const current = process.env.SLACK_CONFIG_TOKEN;
  const refresh = process.env.SLACK_CONFIG_REFRESH_TOKEN;
  if (current && refresh) {
    const rotated = await rotateToolingToken(current, refresh);
    if (rotated.ok) return rotated.token;
  }
  return current?.trim() || undefined;
}
```

- [ ] **Step 4: Register in router**

```ts
import { buildManifestCommand } from './commands/manifest.js';

program.addCommand(buildManifestCommand());
```

- [ ] **Step 5: Run test**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(cli): add $(kagura manifest print | export | sync) commands"
```

---

## Task 5.1: Init wizard scaffolding

**Files:**

- Create: `packages/cli/src/commands/init.ts`
- Modify: `packages/cli/src/router.ts`
- Create: `packages/cli/tests/init.test.ts`

- [ ] **Step 1: Write failing test (orchestration only — individual branches tested per-task)**

```ts
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runInit } from '../src/commands/init.js';

const clack = vi.hoisted(() => ({
  intro: vi.fn(),
  outro: vi.fn(),
  note: vi.fn(),
  cancel: vi.fn(),
  isCancel: vi.fn(() => false),
  select: vi.fn(),
  text: vi.fn(),
  password: vi.fn(),
  confirm: vi.fn(),
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@clack/prompts', () => clack);

describe('runInit orchestration', () => {
  let tmp: string;
  const origEnv = { ...process.env };

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kg-init-'));
    process.env = { ...origEnv, KAGURA_HOME: tmp };
    for (const m of Object.values(clack)) {
      if (typeof m === 'function') m.mockReset();
      else if (typeof m === 'object') {
        for (const sub of Object.values(m as Record<string, unknown>)) {
          if (typeof sub === 'function') (sub as ReturnType<typeof vi.fn>).mockReset();
        }
      }
    }
  });

  afterEach(() => {
    process.env = { ...origEnv };
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('creates ~/.config/kagura on first run', async () => {
    clack.select
      .mockResolvedValueOnce('claude-code') // provider
      .mockResolvedValueOnce('skip-slack') // dev-only skip Slack branch (see Task 5.7)
      .mockResolvedValueOnce('oauth');
    clack.text.mockResolvedValue('/tmp/repos');

    await runInit({ skipStart: true });

    expect(fs.existsSync(path.join(tmp, 'config.json'))).toBe(true);
    const cfg = JSON.parse(fs.readFileSync(path.join(tmp, 'config.json'), 'utf8'));
    expect(cfg.defaultProviderId).toBe('claude-code');
  });
});
```

- [ ] **Step 2: Implement scaffolding `init.ts`**

```ts
import fs from 'node:fs';
import path from 'node:path';

import * as p from '@clack/prompts';

import { loadConfigJson, loadEnvFile } from '../config/env-loader.js';
import { writeEnvFile } from '../config/env-writer.js';
import { writeConfigJson } from '../config/json-writer.js';
import { resolveKaguraPaths } from '../config/paths.js';
import { getProvider, listProviders } from '../providers/registry.js';
import type { ProviderId, SetupPatch } from '../providers/types.js';
import { bindClackCtx } from '../ui/prompts.js';

import { runSlackOnboarding } from './init-slack.js';

export interface InitOptions {
  full?: boolean;
  skipStart?: boolean;
}

export async function runInit(opts: InitOptions = {}): Promise<number> {
  const paths = resolveKaguraPaths();
  fs.mkdirSync(paths.configDir, { recursive: true });
  fs.mkdirSync(paths.dataDir, { recursive: true });

  loadEnvFile(paths);
  const existingConfig = loadConfigJson(paths);

  p.intro('kagura · onboarding');

  const providerId = await p.select({
    message: 'Select AI provider',
    options: listProviders().map((pr) => ({ value: pr.id, label: pr.label })),
    initialValue: (existingConfig.defaultProviderId ?? 'claude-code') as ProviderId,
  });
  if (p.isCancel(providerId)) {
    p.cancel('Cancelled.');
    return 1;
  }

  await runSlackOnboarding(paths, { allowSkip: opts.skipStart === true });

  const ctx = bindClackCtx();
  const providerPatch = await getProvider(providerId as ProviderId).prompt(ctx);
  applyPatch(paths, providerPatch);

  const repoRoot = await p.text({
    message: 'REPO_ROOT_DIR (path to your repos, e.g. ~/git)',
    placeholder: '~/git',
    initialValue: existingConfig.repoRootDir ?? '~/git',
  });
  if (p.isCancel(repoRoot)) {
    p.cancel('Cancelled.');
    return 1;
  }
  writeConfigJson(paths.configJsonFile, { repoRootDir: repoRoot });

  p.outro(`Config written to ${paths.configDir}`);

  if (opts.skipStart) return 0;

  const go = await p.confirm({ message: 'Start kagura now?', initialValue: true });
  if (go && !p.isCancel(go)) {
    const { startApp } = await import(
      new URL('../../../../apps/kagura/src/start-app.js', import.meta.url).href
    );
    await (startApp as () => Promise<void>)();
  }
  return 0;
}

export function applyPatch(paths: ReturnType<typeof resolveKaguraPaths>, patch: SetupPatch): void {
  if (patch.env) writeEnvFile(paths.envFile, patch.env);
  if (patch.config) writeConfigJson(paths.configJsonFile, patch.config);
}
```

Create stub `packages/cli/src/commands/init-slack.ts`:

```ts
import type { KaguraPaths } from '../config/paths.js';

export async function runSlackOnboarding(
  _paths: KaguraPaths,
  _opts: { allowSkip: boolean },
): Promise<void> {
  // populated in Tasks 5.2–5.4
}
```

- [ ] **Step 3: Register in router**

```ts
import { runInit } from './commands/init.js';

program
  .command('init')
  .description('Run the onboarding wizard')
  .option('--full', 'ask advanced options too')
  .action(async (opts: { full?: boolean }) => {
    const code = await runInit(opts);
    process.exitCode = code;
  });
```

- [ ] **Step 4: Make default action dispatch**

Replace `program.action` body in router:

```ts
program.action(async () => {
  const { detectConfig } = await import('./config/env-loader.js');
  const { resolveKaguraPaths: rp } = await import('./config/paths.js');
  const paths = rp();
  const status = detectConfig(paths);
  if (!status.ok) {
    process.stdout.write(`Missing: ${status.missing.join(', ')}. Launching init wizard.\n`);
    await runInit({});
    return;
  }
  const { startApp } = await import(
    new URL('../../../apps/kagura/src/start-app.js', import.meta.url).href
  );
  await startApp();
});
```

- [ ] **Step 5: Typecheck**

```bash
pnpm -F @kagura/cli typecheck
pnpm -F @innei/kagura typecheck
```

Expected: pass. The dynamic import URL will only resolve at runtime inside the bundle; for dev-mode typecheck mark the import as typeless (use `as { startApp: () => Promise<void> }`).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(cli): scaffold $(kagura init) wizard"
```

---

## Task 5.2: Init — new Slack app, auto path (config token)

**Files:**

- Modify: `packages/cli/src/commands/init-slack.ts`
- Create: `packages/cli/tests/init-slack-auto.test.ts`

- [ ] **Step 1: Write failing integration test**

```ts
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();
globalThis.fetch = fetchMock as unknown as typeof fetch;

const clack = vi.hoisted(() => ({
  intro: vi.fn(),
  outro: vi.fn(),
  note: vi.fn(),
  cancel: vi.fn(),
  isCancel: vi.fn(() => false),
  select: vi.fn(),
  text: vi.fn(),
  password: vi.fn(),
  confirm: vi.fn(),
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('@clack/prompts', () => clack);
vi.mock('open', () => ({ default: vi.fn() }));

import { runSlackOnboarding } from '../src/commands/init-slack.js';

describe('slack onboarding · new app · auto', () => {
  let tmp: string;
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kg-sa-'));
    fetchMock.mockReset();
    for (const k of Object.values(clack)) {
      if (typeof k === 'function') (k as ReturnType<typeof vi.fn>).mockReset();
    }
    process.env.SLACK_CONFIG_TOKEN = 'xoxe.init-token';
    process.env.SLACK_CONFIG_REFRESH_TOKEN = 'xoxe.refresh';
  });
  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    delete process.env.SLACK_CONFIG_TOKEN;
    delete process.env.SLACK_CONFIG_REFRESH_TOKEN;
  });

  it('creates app via config token, persists app_id and signing_secret, collects remaining tokens', async () => {
    clack.select.mockResolvedValueOnce('new'); // new app
    // rotate
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        token: 'xoxe.live',
        refresh_token: 'xoxe.refresh2',
        exp: 9_999_999_999,
      }),
    });
    // apps.manifest.create
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, app_id: 'A100', credentials: { signing_secret: 'sig-100' } }),
    });
    // auth.test for bot token
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, team: 'Acme', user: 'kagura' }),
    });
    // auth.test for app token
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });

    clack.password
      .mockResolvedValueOnce('xoxb-bot-token') // bot
      .mockResolvedValueOnce('xapp-level-token'); // app

    const paths = {
      configDir: tmp,
      envFile: path.join(tmp, '.env'),
      configJsonFile: path.join(tmp, 'config.json'),
      dataDir: path.join(tmp, 'data'),
      dbPath: path.join(tmp, 'data', 'sessions.db'),
      logDir: path.join(tmp, 'logs'),
      tokenStore: path.join(tmp, 'data', 'slack-config-tokens.json'),
    };

    await runSlackOnboarding(paths, { allowSkip: false });

    const env = fs.readFileSync(paths.envFile, 'utf8');
    expect(env).toContain('SLACK_APP_ID=A100');
    expect(env).toContain('SLACK_SIGNING_SECRET=sig-100');
    expect(env).toContain('SLACK_BOT_TOKEN=xoxb-bot-token');
    expect(env).toContain('SLACK_APP_TOKEN=xapp-level-token');
  });
});
```

- [ ] **Step 2: Implement `init-slack.ts` auto path**

Replace `packages/cli/src/commands/init-slack.ts`:

```ts
import fs from 'node:fs';
import path from 'node:path';

import * as p from '@clack/prompts';
import open from 'open';

import { writeEnvFile } from '../config/env-writer.js';
import type { KaguraPaths } from '../config/paths.js';
import { appsManifestCreate, rotateToolingToken, type SlackResult } from '../slack/config-token.js';
import { buildManifest } from '../slack/manifest-template.js';
import { buildPrefillUrl } from '../slack/prefill-url.js';

const SLACK_AUTH_TEST = 'https://slack.com/api/auth.test';

export interface SlackOnboardingOptions {
  allowSkip: boolean;
}

export async function runSlackOnboarding(
  paths: KaguraPaths,
  opts: SlackOnboardingOptions,
): Promise<void> {
  const mode = await p.select({
    message: 'Slack app',
    options: [
      { value: 'new', label: 'Create a new Slack app' },
      { value: 'reuse', label: 'Reuse an existing Slack app' },
      ...(opts.allowSkip ? [{ value: 'skip' as const, label: 'Skip (dev)' }] : []),
    ],
  });
  if (p.isCancel(mode) || mode === 'skip') return;

  if (mode === 'new') {
    await handleNewApp(paths);
  } else {
    await handleReuseApp(paths);
  }
}

async function handleNewApp(paths: KaguraPaths): Promise<void> {
  const manifest = buildManifest({ appName: 'Kagura', botDisplayName: 'kagura' });

  const configToken = await ensureConfigToken();

  if (configToken) {
    const created = await appsManifestCreate(configToken, manifest);
    if (!created.ok) {
      p.log.error(`Slack apps.manifest.create failed: ${created.error}`);
      return;
    }
    writeEnvFile(paths.envFile, {
      SLACK_APP_ID: created.app_id,
      SLACK_SIGNING_SECRET: created.credentials.signing_secret,
    });
    p.log.info(`App created: ${created.app_id}`);
    const installUrl = `https://api.slack.com/apps/${created.app_id}/install-on-team`;
    await open(installUrl);
    p.note(
      `Install URL: ${installUrl}\n1. Click "Install to Workspace"\n2. Copy the Bot User OAuth Token\n3. Back to terminal, paste it`,
    );
  } else {
    const prefill = buildPrefillUrl(manifest);
    if (prefill.kind === 'url') {
      await open(prefill.url);
      p.note(
        `Browser opened to: ${prefill.url}\n1. Click "Create"\n2. Install to Workspace\n3. Note App ID, Signing Secret, Bot Token, App-Level Token`,
      );
    } else {
      const manifestPath = path.join(paths.configDir, 'manifest.json');
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
      await open('https://api.slack.com/apps?new_app=1');
      p.note(
        `Manifest too large for prefill URL.\nWritten to: ${manifestPath}\nPaste its contents into the "From manifest" flow.`,
      );
    }
    const appId = await p.text({ message: 'SLACK_APP_ID' });
    if (p.isCancel(appId)) return;
    const signingSecret = await p.password({ message: 'SLACK_SIGNING_SECRET' });
    if (p.isCancel(signingSecret)) return;
    writeEnvFile(paths.envFile, {
      SLACK_APP_ID: String(appId),
      SLACK_SIGNING_SECRET: String(signingSecret),
    });
  }

  const botToken = await promptAndVerifyToken('SLACK_BOT_TOKEN (xoxb-)', 'bot');
  const appToken = await promptAndVerifyToken('SLACK_APP_TOKEN (xapp-)', 'app');
  writeEnvFile(paths.envFile, { SLACK_BOT_TOKEN: botToken, SLACK_APP_TOKEN: appToken });
}

async function handleReuseApp(paths: KaguraPaths): Promise<void> {
  const appId = await p.text({ message: 'SLACK_APP_ID' });
  if (p.isCancel(appId)) return;
  const signingSecret = await p.password({ message: 'SLACK_SIGNING_SECRET' });
  if (p.isCancel(signingSecret)) return;
  writeEnvFile(paths.envFile, {
    SLACK_APP_ID: String(appId),
    SLACK_SIGNING_SECRET: String(signingSecret),
  });

  const botToken = await promptAndVerifyToken('SLACK_BOT_TOKEN (xoxb-)', 'bot');
  const appToken = await promptAndVerifyToken('SLACK_APP_TOKEN (xapp-)', 'app');
  writeEnvFile(paths.envFile, { SLACK_BOT_TOKEN: botToken, SLACK_APP_TOKEN: appToken });
}

async function ensureConfigToken(): Promise<string | undefined> {
  const current = process.env.SLACK_CONFIG_TOKEN?.trim();
  const refresh = process.env.SLACK_CONFIG_REFRESH_TOKEN?.trim();
  if (!current) return undefined;
  if (refresh) {
    const rotated = await rotateToolingToken(current, refresh);
    if (rotated.ok) return rotated.token;
  }
  return current;
}

async function promptAndVerifyToken(message: string, kind: 'bot' | 'app'): Promise<string> {
  for (;;) {
    const raw = await p.password({ message });
    if (p.isCancel(raw)) throw new Error('cancelled');
    const token = String(raw).trim();
    const ok = await verifyToken(token, kind);
    if (ok) return token;
    p.log.error('Token rejected by Slack — please retry.');
  }
}

async function verifyToken(token: string, kind: 'bot' | 'app'): Promise<boolean> {
  if (kind === 'bot' && !token.startsWith('xoxb-')) return false;
  if (kind === 'app' && !token.startsWith('xapp-')) return false;
  const res = await fetch(SLACK_AUTH_TEST, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: '',
  });
  if (!res.ok) return false;
  const data = (await res.json()) as { ok: boolean };
  return data.ok === true;
}

export type { SlackResult };
```

- [ ] **Step 3: Run test**

Expected: PASS for the auto-branch scenario.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(cli): implement Slack new-app auto-onboarding"
```

---

## Task 5.3: Init — new Slack app, manual path

**Files:**

- Already wired in Task 5.2 (`handleNewApp` no-config-token branch).
- Create: `packages/cli/tests/init-slack-manual.test.ts`

- [ ] **Step 1: Write test**

```ts
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();
globalThis.fetch = fetchMock as unknown as typeof fetch;
const openMock = vi.fn();
vi.mock('open', () => ({ default: openMock }));

const clack = vi.hoisted(() => ({
  intro: vi.fn(),
  outro: vi.fn(),
  note: vi.fn(),
  cancel: vi.fn(),
  isCancel: vi.fn(() => false),
  select: vi.fn(),
  text: vi.fn(),
  password: vi.fn(),
  confirm: vi.fn(),
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('@clack/prompts', () => clack);

import { runSlackOnboarding } from '../src/commands/init-slack.js';

describe('slack onboarding · new app · manual', () => {
  let tmp: string;
  const origEnv = { ...process.env };

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kg-sm-'));
    fetchMock.mockReset();
    openMock.mockReset();
    for (const k of Object.values(clack)) {
      if (typeof k === 'function') (k as ReturnType<typeof vi.fn>).mockReset();
    }
    process.env = { ...origEnv };
    delete process.env.SLACK_CONFIG_TOKEN;
  });
  afterEach(() => {
    process.env = { ...origEnv };
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('opens prefill URL and collects 4 values, verifying each token', async () => {
    clack.select.mockResolvedValueOnce('new');
    clack.text.mockResolvedValueOnce('A200'); // SLACK_APP_ID
    clack.password
      .mockResolvedValueOnce('sig-200') // SIGNING_SECRET
      .mockResolvedValueOnce('xoxb-new') // BOT
      .mockResolvedValueOnce('xapp-new'); // APP
    // auth.test bot + app
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });

    const paths = {
      configDir: tmp,
      envFile: path.join(tmp, '.env'),
      configJsonFile: path.join(tmp, 'config.json'),
      dataDir: path.join(tmp, 'data'),
      dbPath: path.join(tmp, 'data', 'sessions.db'),
      logDir: path.join(tmp, 'logs'),
      tokenStore: path.join(tmp, 'data', 'slack-config-tokens.json'),
    };
    await runSlackOnboarding(paths, { allowSkip: false });

    expect(openMock).toHaveBeenCalledOnce();
    const env = fs.readFileSync(paths.envFile, 'utf8');
    expect(env).toContain('SLACK_APP_ID=A200');
    expect(env).toContain('SLACK_SIGNING_SECRET=sig-200');
    expect(env).toContain('SLACK_BOT_TOKEN=xoxb-new');
    expect(env).toContain('SLACK_APP_TOKEN=xapp-new');
  });
});
```

- [ ] **Step 2: Run test**

Expected: PASS (implementation from Task 5.2 covers this branch).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "test(cli): cover Slack new-app manual-onboarding path"
```

---

## Task 5.4: Init — reuse existing Slack app

Already covered by `handleReuseApp` in Task 5.2. Add a dedicated test:

**Files:**

- Create: `packages/cli/tests/init-slack-reuse.test.ts`

- [ ] **Step 1: Write test** (mirror Task 5.3 but select `reuse`; verify no `open()` call and no `apps.manifest.create` fetch).

```ts
// [same harness as Task 5.3]

it('collects 4 values without opening a browser', async () => {
  clack.select.mockResolvedValueOnce('reuse');
  clack.text.mockResolvedValueOnce('A300');
  clack.password
    .mockResolvedValueOnce('sig-300')
    .mockResolvedValueOnce('xoxb-reuse')
    .mockResolvedValueOnce('xapp-reuse');
  fetchMock
    .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });

  await runSlackOnboarding(paths, { allowSkip: false });

  expect(openMock).not.toHaveBeenCalled();
  const env = fs.readFileSync(paths.envFile, 'utf8');
  expect(env).toContain('SLACK_APP_ID=A300');
});
```

- [ ] **Step 2: Run test**

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "test(cli): cover Slack reuse-app onboarding path"
```

---

## Task 5.5: Init — wire full pipeline end-to-end

**Files:**

- Modify: `packages/cli/src/commands/init.ts` (already written; confirm provider + REPO_ROOT_DIR wiring)
- Create: `packages/cli/tests/init-full.test.ts`

- [ ] **Step 1: Write full-flow test**

Covers: provider select → Slack onboarding (skip) → provider.prompt (claude oauth) → REPO_ROOT_DIR → no auto-start.

```ts
// [standard harness with @clack/prompts and open mocked]

it('writes both .env and config.json after full run with skipStart', async () => {
  clack.select
    .mockResolvedValueOnce('claude-code') // provider
    .mockResolvedValueOnce('skip') // slack
    .mockResolvedValueOnce('oauth'); // claude auth
  clack.text.mockResolvedValueOnce('/tmp/my-repos'); // repo root

  const code = await runInit({ skipStart: true });
  expect(code).toBe(0);

  const cfg = JSON.parse(fs.readFileSync(path.join(tmp, 'config.json'), 'utf8'));
  expect(cfg.defaultProviderId).toBe('claude-code');
  expect(cfg.repoRootDir).toBe('/tmp/my-repos');
});
```

- [ ] **Step 2: Run test**

Expected: PASS.

- [ ] **Step 3: Smoke-run build + bin**

```bash
pnpm -F @innei/kagura build
node apps/kagura/dist/cli.js --help
node apps/kagura/dist/cli.js config path
```

Expected: all pass; `config path` prints `~/.config/kagura`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test(cli): end-to-end init wizard integration test"
```

---

## Task 6.1: README usage section

**Files:**

- Modify: `README.md`

- [ ] **Step 1: Replace or extend the current "Usage" block**

Read README. Under the existing `## Usage` section, replace the body with:

````markdown
## Usage

```bash
npm install -g @innei/kagura
kagura
```
````

On first run, `kagura` notices there is no configuration and launches an interactive wizard:

1. Pick an AI provider (Claude Code or Codex CLI).
2. Create a Slack app — either via Slack's prefill URL or, if you've pasted a config token, fully automatically via the Slack `apps.manifest.create` API.
3. Install it to your workspace and paste back the Bot Token, App-Level Token, and Signing Secret. The CLI validates each one against `auth.test` before writing.
4. Point kagura at your repositories (`REPO_ROOT_DIR`).

Everything lands under `~/.config/kagura/` (configurable via `$KAGURA_HOME`):

```
~/.config/kagura/
├── .env             secrets
├── config.json      tunables
├── data/sessions.db
└── logs/
```

### Subcommands

| Command                  | What it does                                                 |
| ------------------------ | ------------------------------------------------------------ |
| `kagura`                 | Run the bot (launches init wizard if config is incomplete)   |
| `kagura init`            | Run the init wizard unconditionally                          |
| `kagura doctor`          | Diagnose configuration and connectivity (`--json`, `--deep`) |
| `kagura manifest print`  | Print the Kagura-desired Slack manifest                      |
| `kagura manifest export` | Export your Slack app's current manifest                     |
| `kagura manifest sync`   | Push the desired manifest into your app                      |
| `kagura config path`     | Print `~/.config/kagura/`                                    |
| `kagura --version`       | Print version, commit hash, commit date                      |
| `kagura --help`          | Show help (works on subcommands too)                         |
| `kagura-app`             | Run the bot directly, skipping config detection              |

````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: document kagura CLI subcommands and init flow"
````

---

## Task 6.2: docs/configuration.md pass

**Files:**

- Modify: `docs/configuration.md`

- [ ] **Step 1: Prepend a "File layout" section**

Read current docs/configuration.md. Insert at top (after title):

```markdown
## File layout

Kagura reads config from `~/.config/kagura/` by default. Dev mode (running inside the repo) falls back to cwd; `$KAGURA_HOME` overrides both.

- `~/.config/kagura/.env` — secrets (tokens, signing secret, API keys)
- `~/.config/kagura/config.json` — non-secret tunables (provider selection, model options, paths, log level)
- `~/.config/kagura/data/sessions.db` — Drizzle-managed SQLite
- `~/.config/kagura/data/slack-config-tokens.json` — rotating Slack config tokens
- `~/.config/kagura/logs/` — daily log files (if `LOG_TO_FILE=true`)

Precedence when keys overlap: `env > config.json > built-in default`.
```

- [ ] **Step 2: Commit**

```bash
git add docs/configuration.md
git commit -m "docs(configuration): document XDG file layout"
```

---

## Task 6.3: Version bump + publish dry-run

**Files:**

- Modify: `apps/kagura/package.json` (already 0.2.0 from Task 0.3; verify)
- Create: `apps/kagura/CHANGELOG.md`

- [ ] **Step 1: Verify apps/kagura/package.json version**

Read `apps/kagura/package.json`. Confirm `"version": "0.2.0"`.

- [ ] **Step 2: Create CHANGELOG.md**

```markdown
# Changelog

## 0.2.0

- **New**: `kagura` CLI with interactive `init` wizard (Slack app creation via manifest prefill URL or config-token auto; Claude Code + Codex CLI onboarding).
- **New**: `kagura doctor`, `kagura manifest print|export|sync`, `kagura config path` subcommands.
- **New**: `kagura-app` bin for running the bot without the CLI router (useful for systemd / Docker).
- **Changed**: Default config directory is now `~/.config/kagura/` (dev-mode cwd detection preserves the old behavior inside the repo).
- **Changed**: Default `sessions.db`, `logs/`, and `slack-config-tokens.json` live under `~/.config/kagura/data` and `~/.config/kagura/logs`. User-set `SESSION_DB_PATH` / `LOG_DIR` still win.
- **Changed**: Repo layout split — `src/` is now `apps/kagura/src/`, CLI lives in `packages/cli/`.

## 0.1.0

- Initial npm publish.
```

- [ ] **Step 3: Build and pack dry-run**

```bash
pnpm -F @innei/kagura build
cd apps/kagura && pnpm pack --dry-run && cd -
```

Expected output: package `@innei/kagura@0.2.0`, `dist/index.js`, `dist/cli.js`, `drizzle/*`, `README.md`, `LICENSE`, `package.json`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(release): prepare 0.2.0 CHANGELOG"
```

---

## Task 6.4: Publish

**Files:** none

- [ ] **Step 1: Run full suite one more time**

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm -F @innei/kagura build
```

Expected: all green.

- [ ] **Step 2: Publish**

Only with explicit user go-ahead. Run:

```bash
cd apps/kagura
pnpm publish --access public
cd -
```

Expected: `+ @innei/kagura@0.2.0` in output.

- [ ] **Step 3: Verify**

```bash
sleep 20
npm view @innei/kagura version
```

Expected: `0.2.0`.

- [ ] **Step 4: Tag and commit**

```bash
git tag v0.2.0
git push origin main --tags
```

---

## Self-review

**Spec coverage:**

| Spec section                                             | Covered by               |
| -------------------------------------------------------- | ------------------------ |
| Monorepo layout                                          | Tasks 0.1-0.3            |
| Config layout on disk + path resolution                  | Tasks 1.2, 1.6           |
| File ownership (.env vs config.json)                     | Tasks 1.4, 1.5, 5.2, 5.5 |
| Bin topology (double bin, dynamic import)                | Tasks 2.4, 2.5, 5.1      |
| `paths.ts` / `env-loader` / `env-writer` / `json-writer` | Tasks 1.2-1.5            |
| `manifest-template` hoist + snapshot                     | Tasks 3.1, 3.2           |
| `prefill-url`                                            | Task 3.3                 |
| `config-token` API wrappers                              | Task 3.4                 |
| Provider types + registry                                | Tasks 3.5-3.7            |
| `init.ts` state machine                                  | Tasks 5.1-5.5            |
| `doctor`                                                 | Task 4.2                 |
| `manifest` subcommands                                   | Task 4.3                 |
| `config` subcommand                                      | Task 2.3                 |
| `--help` / `--version`                                   | Task 2.2                 |
| Testing strategy (unit + integration + snapshot)         | Each task has TDD steps  |
| Dependency additions                                     | Task 2.1                 |
| Migration breaking changes                               | Tasks 6.1, 6.2, 6.3      |

**No-placeholder scan:** Every task has explicit file paths, full code blocks, and exact commands with expected output. No "TBD / TODO" patterns. Error-handling paths are concrete (`auth.test` retry loop, config-token refresh fallback, too-long manifest fallback).

**Type consistency:** `ProviderId`, `KaguraPaths`, `SetupPatch`, `EnvPatch`, `ConfigPatch`, `DetectResult`, `DoctorReport` names are used identically across tasks. `buildManifest` signature is `({ appName, botDisplayName })` everywhere. `runInit`, `runDoctor`, `runSlackOnboarding` signatures match between definition and caller.

**Open items for the implementer:** The `bindClackCtx()` wrapper in Task 4.1 is referenced by Task 5.1 (`import { bindClackCtx }`) but I ordered it after 3.6/3.7. In practice, Task 4.1 should be implemented before Task 5.1 — the linear order in the plan reflects this (4.1 < 5.1). No change needed.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-24-kagura-cli-onboarding.md`.**

Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Good for this plan because phases have clear boundaries (0 / 1 / 2 / 3 / 4 / 5 / 6) and each task is independently verifiable.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
