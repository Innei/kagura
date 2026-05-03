import { describe, expect, it } from 'vitest';

import { memoryContextProcessor } from '~/agent/prompt/processors.js';
import type { AgentExecutionRequest } from '~/agent/types.js';
import type { ContextMemories, MemoryRecord } from '~/memory/types.js';

function makeRecord(overrides: Partial<MemoryRecord>): MemoryRecord {
  return {
    id: '1',
    category: 'preference',
    content: '',
    createdAt: '2026-05-03T00:00:00.000Z',
    scope: 'global',
    ...overrides,
  };
}

function makeContext(memories: ContextMemories) {
  return {
    contextParts: [] as string[],
    systemParts: [] as string[],
    userMessageParts: [] as string[],
    images: [] as never[],
    imageLoadFailures: [] as string[],
    request: {
      contextMemories: memories,
    } as Partial<AgentExecutionRequest> as AgentExecutionRequest,
  };
}

describe('memoryContextProcessor (slim mode)', () => {
  it('injects only identity preferences, not global or workspace', () => {
    const ctx = makeContext({
      preferences: [makeRecord({ id: '1', content: 'nickname: 小汐', category: 'preference' })],
      global: [makeRecord({ id: '2', content: 'used vue once', category: 'observation' })],
      workspace: [makeRecord({ id: '3', content: 'always pnpm', category: 'preference' })],
    });
    memoryContextProcessor.process(ctx);
    const joined = ctx.contextParts.join('\n');
    expect(joined).toContain('nickname: 小汐');
    expect(joined).not.toContain('used vue once');
    expect(joined).not.toContain('always pnpm');
  });

  it('emits a fallback marker when there are no preferences', () => {
    const ctx = makeContext({ preferences: [], global: [], workspace: [] });
    memoryContextProcessor.process(ctx);
    expect(ctx.contextParts.join('')).toMatch(/no identity preferences/i);
  });

  it('always appends the on-demand recall hint', () => {
    const ctx = makeContext({ preferences: [], global: [], workspace: [] });
    memoryContextProcessor.process(ctx);
    expect(ctx.contextParts.join('')).toMatch(/recall/i);
  });
});
