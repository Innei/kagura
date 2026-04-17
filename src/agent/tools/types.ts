import type { z } from 'zod';

export interface AgentToolDefinition<
  TInput extends z.ZodTypeAny = z.ZodTypeAny,
  TOutput = unknown,
> {
  description: string;
  execute: (input: z.infer<TInput>) => Promise<TOutput>;
  inputSchema: TInput;
  name: string;
}
