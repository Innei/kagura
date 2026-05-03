import { describe, expect, it } from 'vitest';

import {
  RecallMemoryToolInputSchema,
  SaveMemoryToolInputSchema,
} from '~/agent/providers/claude-code/schemas/memory-tools.js';
import { buildCodexPrompt } from '~/agent/providers/codex-cli/prompt.js';
import { RECALL_MEMORY_TOOL_NAME, SAVE_MEMORY_TOOL_NAME } from '~/agent/slack-runtime-tools.js';
import type { AgentExecutionRequest } from '~/agent/types.js';

describe('memory tool surface', () => {
  it('keeps Claude memory tools to save and recall schemas', () => {
    expect(SAVE_MEMORY_TOOL_NAME).toBe('save_memory');
    expect(RECALL_MEMORY_TOOL_NAME).toBe('recall_memory');
    expect(
      SaveMemoryToolInputSchema.safeParse({ category: 'decision', content: 'x' }).success,
    ).toBe(true);
    expect(RecallMemoryToolInputSchema.safeParse({ category: 'decision' }).success).toBe(true);
  });

  it('does not expose update/delete memory commands to Codex', () => {
    const prompt = buildCodexPrompt(createRequest(), {
      channelOpsPath: './ops.jsonl',
      generatedArtifactsDir: './artifacts',
      memoryDbPath: './sessions.db',
      runtimeDir: './runtime',
    });

    expect(prompt).toContain('kagura-memory save');
    expect(prompt).toContain('kagura-memory recall');
    expect(prompt).not.toContain('kagura-memory update');
    expect(prompt).not.toContain('kagura-memory delete');
  });
});

function createRequest(): AgentExecutionRequest {
  return {
    channelId: 'C1',
    mentionText: 'hello',
    threadContext: {
      channelId: 'C1',
      fileLoadFailures: [],
      imageLoadFailures: [],
      loadedFiles: [],
      loadedImages: [],
      messages: [],
      renderedPrompt: '',
      threadTs: '1712345678.000100',
    },
    threadTs: '1712345678.000100',
    userId: 'U1',
  };
}
