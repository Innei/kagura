import { claudeFormatter } from '@kagura/prompt-formatter-claude';
import { openaiFormatter } from '@kagura/prompt-formatter-openai';
import { createPipeline, definePlugin } from '@kagura/prompt-pipeline';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

describe('Full pipeline integration', () => {
  const systemRole = definePlugin({
    name: 'system-role',
    slot: 'system',
    async process(ctx) {
      ctx.append('You are a helpful coding assistant in a Slack workspace.');
      ctx.append('IMPORTANT SAFETY RULES: ...');
    },
  });

  const toolDecl = definePlugin({
    name: 'tool-declaration',
    slot: 'afterSystem',
    async process(ctx) {
      ctx.append('Available tools: publish_state, recall_memory, save_memory, upload_slack_file');
    },
  });

  const memoryContext = definePlugin({
    name: 'memory-context',
    slot: 'firstUserMessageContext',
    inject: z.object({
      contextMemories: z
        .object({
          preferences: z.array(z.string()),
          global: z.array(z.string()),
          workspace: z.array(z.string()),
        })
        .optional(),
    }),
    async process(ctx, deps) {
      if (!deps.contextMemories) {
        ctx.append('<conversation_memory>\nNo memories.\n</conversation_memory>');
        return;
      }
      const lines: string[] = [];
      if (deps.contextMemories.preferences.length > 0) {
        lines.push('=== PREFERENCES ===', ...deps.contextMemories.preferences);
      }
      ctx.append(`<conversation_memory>\n${lines.join('\n')}\n</conversation_memory>`);
    },
  });

  const userMessage = definePlugin({
    name: 'user-message',
    slot: 'lastUserMessage',
    inject: z.object({ userId: z.string(), mentionText: z.string() }),
    async process(ctx, deps) {
      ctx.append(`From <@${deps.userId}>:\n${deps.mentionText}`);
    },
  });

  const inputSchema = z.object({
    userId: z.string(),
    mentionText: z.string(),
    contextMemories: z
      .object({
        preferences: z.array(z.string()),
        global: z.array(z.string()),
        workspace: z.array(z.string()),
      })
      .optional(),
  });

  it('produces correct message sequence with Claude formatter', async () => {
    const pipeline = createPipeline({
      input: inputSchema,
      plugins: [userMessage, memoryContext, systemRole, toolDecl],
    });

    const payload = await pipeline.runWith(
      {
        userId: 'U123',
        mentionText: 'Explain the bug.',
        contextMemories: { preferences: ['Reply in English'], global: [], workspace: [] },
        messages: [
          { role: 'user', content: 'check the logs' },
          { role: 'assistant', content: 'I found an error in line 42...' },
        ],
      },
      claudeFormatter,
    );

    expect(payload.system).toContain('helpful coding assistant');
    expect(payload.system).toContain('SAFETY RULES');

    // messages: afterSystem → first(context) → history → last(user msg)
    expect(payload.messages).toHaveLength(5);
    expect(payload.messages[0]).toEqual({
      role: 'user',
      content: 'Available tools: publish_state, recall_memory, save_memory, upload_slack_file',
    });
    expect((payload.messages[1] as any).content).toContain('PREFERENCES');
    expect((payload.messages[1] as any).content).toContain('Reply in English');
    expect(payload.messages[2]).toEqual({ role: 'user', content: 'check the logs' });
    expect(payload.messages[3]).toEqual({
      role: 'assistant',
      content: 'I found an error in line 42...',
    });
    expect((payload.messages[4] as any).content).toContain('From <@U123>');
    expect((payload.messages[4] as any).content).toContain('Explain the bug.');
  });

  it('produces correct message sequence with OpenAI formatter', async () => {
    const pipeline = createPipeline({
      input: inputSchema,
      plugins: [systemRole, userMessage],
    });

    const payload = await pipeline.runWith({ userId: 'U1', mentionText: 'hello' }, openaiFormatter);

    expect(payload.messages[0]!.role).toBe('system');
    expect(payload.messages[0]!.content).toContain('helpful coding assistant');
    expect(payload.messages[1]!.role).toBe('user');
    expect(payload.messages[1]!.content).toContain('hello');
  });

  it('trace captures all plugin executions in slot order', async () => {
    const pipeline = createPipeline({
      input: inputSchema,
      plugins: [userMessage, memoryContext, systemRole, toolDecl],
    });

    const result = await pipeline.run({
      userId: 'U1',
      mentionText: 'test',
    });

    const pluginNames = result.trace.map((t) => t.plugin);
    expect(pluginNames).toEqual([
      'system-role',
      'tool-declaration',
      'memory-context',
      'user-message',
    ]);
  });
});
