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
