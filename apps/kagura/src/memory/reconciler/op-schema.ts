import { z } from 'zod';

import { MEMORY_CATEGORIES } from '~/memory/types.js';

import type { ReconcileOp } from './types.js';

const opSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('delete'),
    ids: z.array(z.string()).min(1),
  }),
  z.object({
    kind: z.literal('rewrite'),
    id: z.string(),
    content: z.string().min(1),
    expiresAt: z.string().datetime({ offset: true }).optional(),
  }),
  z.object({
    kind: z.literal('merge'),
    ids: z.array(z.string()).min(2),
    newContent: z.string().min(1),
    category: z.enum(MEMORY_CATEGORIES),
    expiresAt: z.string().datetime({ offset: true }).optional(),
  }),
  z.object({
    kind: z.literal('extend_ttl'),
    ids: z.array(z.string()).min(1),
    expiresAt: z.string().datetime({ offset: true }),
  }),
]);

const responseSchema = z.object({
  ops: z.array(opSchema),
});

export function parseLlmOps(raw: string): ReconcileOp[] {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (error) {
    throw new Error(`parseLlmOps: invalid JSON. raw=${raw.slice(0, 500)}`, { cause: error });
  }
  const result = responseSchema.safeParse(json);
  if (!result.success) {
    throw new Error(`parseLlmOps: schema validation failed. raw=${raw.slice(0, 500)}`, {
      cause: result.error,
    });
  }
  return result.data.ops;
}
