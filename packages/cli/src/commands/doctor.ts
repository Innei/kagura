import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { Command } from 'commander';
import pc from 'picocolors';

import { detectConfig, loadConfigJson, loadEnvFile } from '../config/env-loader.js';
import { resolveKaguraPaths } from '../config/paths.js';
import { listProviders } from '../providers/registry.js';

export interface DoctorCheck {
  detail?: string;
  name: string;
  status: 'ok' | 'warn' | 'fail';
}

export interface DoctorReport {
  checks: DoctorCheck[];
  summary: { ok: number; warn: number; fail: number };
}

export async function runDoctor(opts: { json?: boolean; deep?: boolean }): Promise<number> {
  const paths = resolveKaguraPaths();
  loadEnvFile(paths);
  const cfg = loadConfigJson(paths);

  const detect = detectConfig(paths);
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  const repoRoot = process.env.REPO_ROOT_DIR ?? cfg.repoRootDir;
  const providerId = process.env.AGENT_DEFAULT_PROVIDER ?? cfg.defaultProviderId ?? 'claude-code';
  const provider = listProviders().find((pr) => pr.id === providerId);

  const checks: DoctorCheck[] = [
    {
      name: 'config dir',
      status: fs.existsSync(paths.configDir) ? 'ok' : 'warn',
      detail: paths.configDir,
    },
    {
      name: '.env',
      status: fs.existsSync(paths.envFile) ? 'ok' : 'warn',
      detail: paths.envFile,
    },
    {
      name: 'config.json',
      status: fs.existsSync(paths.configJsonFile) ? 'ok' : 'warn',
      detail: paths.configJsonFile,
    },
    detect.ok
      ? { name: 'required env', status: 'ok' }
      : {
          name: 'required env',
          status: 'fail',
          detail: `missing: ${detect.missing.join(', ')}`,
        },
    {
      name: 'node version',
      status: nodeMajor >= 22 ? 'ok' : 'fail',
      detail: `v${process.versions.node}`,
    },
  ];

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

  if (provider) {
    const det = await provider.detect();
    const providerCheck: DoctorCheck = {
      name: `provider ${provider.id}`,
      status: det.status === 'ready' ? 'ok' : det.status === 'partial' ? 'warn' : 'fail',
    };
    if (det.detail !== undefined) providerCheck.detail = det.detail;
    checks.push(providerCheck);
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

export function buildDoctorCommand(): Command {
  const cmd = new Command('doctor');
  cmd
    .description('Diagnose configuration and connectivity')
    .option('--json', 'emit JSON report')
    .option('--deep', 'include live API probes')
    .action(async (opts: { json?: boolean; deep?: boolean }) => {
      const code = await runDoctor(opts);
      process.exitCode = code;
    });
  return cmd;
}
