import { describe, expect, it, vi } from 'vitest';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import type { AgentExecutionRequest, AgentExecutionSink } from '~/agent/types.js';
import { createKaguraMcpServer } from '~/agent/mcp-server/create-server.js';
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

function createServerOptions() {
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
    } as AgentExecutionRequest,
    sink: {
      onEvent: vi.fn().mockResolvedValue(undefined),
    } as AgentExecutionSink,
  };
}

async function createConnectedClient(
  server: ReturnType<typeof createKaguraMcpServer>,
): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'test-client', version: '1.0' });
  await client.connect(clientTransport);
  return client;
}

describe('createKaguraMcpServer', () => {
  it('lists all 4 tools', async () => {
    const server = createKaguraMcpServer(createServerOptions());
    const client = await createConnectedClient(server);
    const result = await client.listTools();
    const toolNames = result.tools.map((t) => t.name);
    expect(toolNames).toContain('recall_memory');
    expect(toolNames).toContain('save_memory');
    expect(toolNames).toContain('set_channel_default_workspace');
    expect(toolNames).toContain('upload_slack_file');
  });

  it('exposes non-empty input schemas for tool discovery', async () => {
    const server = createKaguraMcpServer(createServerOptions());
    const client = await createConnectedClient(server);
    const result = await client.listTools();

    const recallMemory = result.tools.find((tool) => tool.name === 'recall_memory');
    expect(recallMemory?.inputSchema).toMatchObject({
      type: 'object',
      properties: {
        query: { type: 'string' },
        scope: { type: 'string' },
      },
    });

    const uploadSlackFile = result.tools.find((tool) => tool.name === 'upload_slack_file');
    expect(uploadSlackFile?.inputSchema).toMatchObject({
      type: 'object',
      properties: {
        path: { type: 'string' },
      },
    });
  });

  it('calls recall_memory and returns results', async () => {
    const options = createServerOptions();
    options.memoryStore.save({ category: 'context', content: 'mcp test', threadTs: 'ts1' });

    const server = createKaguraMcpServer(options);
    const client = await createConnectedClient(server);
    const result = await client.callTool({
      name: 'recall_memory',
      arguments: { query: 'mcp', scope: 'global' },
    });
    const content = result.content as Array<{ type: string; text?: string }>;

    expect(content[0]).toMatchObject({
      type: 'text',
      text: expect.stringContaining('mcp test'),
    });
  });

  it('returns error for unknown tool', async () => {
    const server = createKaguraMcpServer(createServerOptions());
    const client = await createConnectedClient(server);
    const result = await client.callTool({
      name: 'unknown_tool',
      arguments: {},
    });
    const content = result.content as Array<{ type: string; text?: string }>;

    expect(result.isError).toBe(true);
    expect(content[0]).toMatchObject({
      type: 'text',
      text: expect.stringContaining('Unknown tool'),
    });
  });
});
