import pc from 'picocolors';

import type { LiveE2EScenario } from './types.js';

export interface RunResult {
  durationMs: number;
  error?: string | undefined;
  id: string;
  passed: boolean;
  title: string;
}

export async function runScenarios(
  scenarios: LiveE2EScenario[],
  onStart?: (scenario: LiveE2EScenario) => void,
  onFinish?: (result: RunResult) => void,
): Promise<RunResult[]> {
  const results: RunResult[] = [];

  for (const scenario of scenarios) {
    onStart?.(scenario);

    const start = Date.now();
    try {
      await scenario.run();
      const result: RunResult = {
        id: scenario.id,
        title: scenario.title,
        passed: true,
        durationMs: Date.now() - start,
      };
      results.push(result);
      onFinish?.(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const result: RunResult = {
        id: scenario.id,
        title: scenario.title,
        passed: false,
        error: message,
        durationMs: Date.now() - start,
      };
      results.push(result);
      onFinish?.(result);
    }
  }

  return results;
}

export function formatSummary(results: RunResult[]): string {
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const totalMs = results.reduce((sum, r) => sum + r.durationMs, 0);

  const lines: string[] = [ ''];

  for (const r of results) {
    const status = r.passed ? pc.green('PASS') : pc.red('FAIL');
    const dur = pc.dim(`${(r.durationMs / 1000).toFixed(1)}s`);
    lines.push(`  ${status}  ${r.id.padEnd(32)} ${dur}`);
    if (r.error) {
      lines.push(`        ${pc.dim(r.error)}`);
    }
  }

  lines.push('');
  const summary = [
    `Total: ${pc.bold(String(results.length))}`,
    `Passed: ${pc.green(String(passed))}`,
    failed > 0 ? `Failed: ${pc.red(String(failed))}` : `Failed: ${String(failed)}`,
    `Time: ${pc.bold(`${(totalMs / 1000).toFixed(1)}s`)}`,
  ].join(pc.dim(' | '));
  lines.push(`  ${summary}`);
  lines.push('');

  return lines.join('\n');
}
