import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import type { AgentExecutionRequest, AgentExecutionSink } from '~/agent/types.js';
import { createToolDefinitions } from '~/agent/tools/tool-definitions.js';
import type { MemoryRecord, MemoryStore } from '~/memory/types.js';

function createTestLogger() {
  return {
    debug: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    info: vi.fn(),
    trace: vi.fn(),
    warn: vi.fn(),
    withTag: vi.fn().mockReturnThis(),
  };
}

function createMemoryStore(initial: MemoryRecord[] = []): MemoryStore {
  const records = [...initial];
  return {
    countAll: () => records.length,
    delete: () => false,
    deleteAll: () => 0,
    listRecent: () => [],
    listForContext: () => ({ global: [], workspace: [], preferences: [] }),
    prune: () => 0,
    pruneAll: () => 0,
    save: (input) => {
      const record: MemoryRecord = {
        ...input,
        scope: input.repoId ? 'workspace' : 'global',
        createdAt: new Date().toISOString(),
        id: `mem-${records.length + 1}`,
      };
      records.push(record);
      return record;
    },
    saveWithDedup: (input) => createMemoryStore().save(input),
    search: (repoId, options = {}) => {
      return records
        .filter((r) => (repoId ? r.repoId === repoId : !r.repoId))
        .filter((r) => !options.category || r.category === options.category)
        .filter((r) => !options.query || r.content.toLowerCase().includes(options.query.toLowerCase()))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, options.limit ?? 10);
    },
  };
}

function createChannelPreferenceStore() {
  const prefs = new Map<string, string>();
  return {
    get: (channelId: string) => prefs.get(channelId) ?? null,
    upsert: (channelId: string, workspaceInput: string) => prefs.set(channelId, workspaceInput),
  };
}

function createDeps(overrides?: {
  request?: Partial<AgentExecutionRequest>;
  sink?: AgentExecutionSink;
}) {
  return {
    channelPreferenceStore: createChannelPreferenceStore() as unknown as import('~/channel-preference/types.js').ChannelPreferenceStore,
    logger: createTestLogger() as unknown as import('~/logger/index.js').AppLogger,
    memoryStore: createMemoryStore(),
    request: {
      channelId: 'C123',
      mentionText: '',
      threadContext: {
        channelId: 'C123',
        fileLoadFailures: [],
        imageLoadFailures: [],
        loadedFiles: [],
        loadedImages: [],
        messages: [],
        renderedPrompt: '',
        threadTs: 'ts1',
      },
      threadTs: 'ts1',
      userId: 'U123',
      ...overrides?.request,
    } as AgentExecutionRequest,
    sink: overrides?.sink ?? {
      onEvent: vi.fn().mockResolvedValue(undefined),
    },
  };
}

describe('createToolDefinitions', () => {
  it('exposes all 4 tools', () => {
    const tools = createToolDefinitions(createDeps());
    const names = tools.map((t) => t.name);
    expect(names).toContain('recall_memory');
    expect(names).toContain('save_memory');
    expect(names).toContain('set_channel_default_workspace');
    expect(names).toContain('upload_slack_file');
  });

  it('recall_memory returns matching global memories', async () => {
    const store = createMemoryStore();
    store.save({ category: 'context', content: 'hello world', threadTs: 'ts1' });
    const deps = createDeps();
    deps.memoryStore = store;

    const tool = createToolDefinitions(deps).find((t) => t.name === 'recall_memory')!;
    const result = (await tool.execute({ query: 'hello', scope: 'global' })) as {
      content: Array<{ type: string; text: string }>;
    };

    expect(result.content[0]!.text).toContain('hello world');
  });

  it('recall_memory returns guidance when workspace scope is requested without repo', async () => {
    const deps = createDeps();
    const tool = createToolDefinitions(deps).find((t) => t.name === 'recall_memory')!;
    const result = (await tool.execute({ query: 'test', scope: 'workspace' })) as {
      content: Array<{ type: string; text: string }>;
    };

    expect(result.content[0]!.text).toContain('No workspace is set');
  });

  it('save_memory persists a global memory', async () => {
    const store = createMemoryStore();
    const deps = createDeps();
    deps.memoryStore = store;

    const tool = createToolDefinitions(deps).find((t) => t.name === 'save_memory')!;
    const result = (await tool.execute({
      category: 'context',
      content: 'saved note',
      scope: 'global',
    })) as { content: Array<{ type: string; text: string }> };

    expect(result.content[0]!.text).toContain('Memory saved (global)');
    expect(store.search(undefined, { query: 'saved note' }).length).toBe(1);
  });

  it('set_channel_default_workspace updates the store', async () => {
    const deps = createDeps();
    const tool = createToolDefinitions(deps).find((t) => t.name === 'set_channel_default_workspace')!;
    const result = (await tool.execute({ workspaceInput: 'my-repo' })) as {
      content: Array<{ type: string; text: string }>;
    };

    expect(result.content[0]!.text).toContain('default workspace set to: my-repo');
    expect(deps.channelPreferenceStore.get('C123')).toBe('my-repo');
  });

  it('upload_slack_file queues a file via sink and returns queued message', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tool-defs-'));
    const filePath = path.join(tmpDir, 'test.txt');
    fs.writeFileSync(filePath, 'hello');

    const deps = createDeps({ request: { workspacePath: tmpDir } });
    const tool = createToolDefinitions(deps).find((t) => t.name === 'upload_slack_file')!;
    const result = (await tool.execute({ path: 'test.txt' })) as {
      content: Array<{ type: string; text: string }>;
    };

    expect(result.content[0]!.text).toContain('Queued test.txt for Slack upload');
    expect(deps.sink.onEvent).toHaveBeenCalled();

    fs.unlinkSync(filePath);
    fs.rmdirSync(tmpDir);
  });
});
