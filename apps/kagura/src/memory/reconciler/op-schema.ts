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
    expiresAt: z.string().datetime().optional(),
  }),
  z.object({
    kind: z.literal('merge'),
    ids: z.array(z.string()).min(2),
    newContent: z.string().min(1),
    category: z.enum(MEMORY_CATEGORIES),
    expiresAt: z.string().datetime().optional(),
  }),
  z.object({
    kind: z.literal('extend_ttl'),
    ids: z.array(z.string()).min(1),
    expiresAt: z.string().datetime(),
  }),
]);

const responseSchema = z.object({
  ops: z.array(opSchema),
});

export function parseLlmOps(raw: string): ReconcileOp[] {
  const parsed = responseSchema.parse(JSON.parse(raw));
  return parsed.ops;
}
