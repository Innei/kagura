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
  json = normalizeOpAliases(json);
  const result = responseSchema.safeParse(json);
  if (!result.success) {
    throw new Error(`parseLlmOps: schema validation failed. raw=${raw.slice(0, 500)}`, {
      cause: result.error,
    });
  }
  return result.data.ops;
}

function normalizeOpAliases(input: unknown): unknown {
  if (!input || typeof input !== 'object' || !Array.isArray((input as { ops?: unknown }).ops)) {
    return input;
  }
  return {
    ...(input as Record<string, unknown>),
    ops: (input as { ops: unknown[] }).ops.map((op) => {
      if (!op || typeof op !== 'object') return op;
      const record = op as Record<string, unknown>;
      if (record.kind === 'destroy' || record.kind === 'remove' || record.kind === 'drop') {
        return { ...record, kind: 'delete' };
      }
      return op;
    }),
  };
}
