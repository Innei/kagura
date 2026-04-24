import * as p from '@clack/prompts';

import type { PromptCtx, PromptOption } from '../providers/types.js';

export function bindClackCtx(): PromptCtx {
  return {
    select: async <T extends string>(message: string, options: PromptOption<T>[]): Promise<T> => {
      const result = await p.select<T>({
        message,
        options: options as unknown as Parameters<typeof p.select<T>>[0]['options'],
      });
      if (p.isCancel(result)) {
        p.cancel('Cancelled.');
        process.exit(1);
      }
      return result as T;
    },
    text: async (message, opts) => {
      const result = await p.text({
        message,
        ...(opts?.placeholder !== undefined ? { placeholder: opts.placeholder } : {}),
        ...(opts?.initial !== undefined ? { initialValue: opts.initial } : {}),
      });
      if (p.isCancel(result)) {
        p.cancel('Cancelled.');
        process.exit(1);
      }
      const v = typeof result === 'string' ? result.trim() : '';
      if (!v && !opts?.optional) return undefined;
      return v || undefined;
    },
    password: async (message, opts) => {
      const result = await p.password({ message });
      if (p.isCancel(result)) {
        p.cancel('Cancelled.');
        process.exit(1);
      }
      const v = typeof result === 'string' ? result.trim() : '';
      if (!v && !opts?.optional) return undefined;
      return v || undefined;
    },
    note: (message: string) => {
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
