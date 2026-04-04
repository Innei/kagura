import * as p from '@clack/prompts';
import pc from 'picocolors';

import type { LiveE2EScenario } from './types.js';

export async function promptInteractive(scenarios: LiveE2EScenario[]): Promise<LiveE2EScenario[]> {
  const result = await p.multiselect({
    message: 'Select scenarios to run',
    options: scenarios.map((s) => ({
      value: s.id,
      label: `${pc.bold(s.id)} — ${s.title}`,
      hint: s.description,
    })),
    required: true,
  });

  if (p.isCancel(result)) {
    p.cancel('Cancelled.');
    process.exit(0);
  }

  const selectedIds = new Set(result as string[]);
  return scenarios.filter((s) => selectedIds.has(s.id));
}
