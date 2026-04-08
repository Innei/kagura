import { describe, expect, it, vi } from 'vitest';

import type { AppLogger } from '~/logger/index.js';
import {
  PERMISSION_APPROVE_ACTION_ID,
  PERMISSION_DENY_ACTION_ID,
  SlackPermissionBridge,
} from '~/slack/interaction/permission-bridge.js';
import type { SlackWebClientLike } from '~/slack/types.js';

function createTestLogger(): AppLogger {
  const logger = {
    debug: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    info: vi.fn(),
    trace: vi.fn(),
    warn: vi.fn(),
    withTag: vi.fn(),
  };
  logger.withTag.mockReturnValue(logger);
  return logger as unknown as AppLogger;
}

function createClient(): SlackWebClientLike {
  return {
    assistant: { threads: { setStatus: vi.fn(async () => ({})) } },
    auth: { test: vi.fn(async () => ({ user_id: 'U_BOT' })) },
    chat: {
      delete: vi.fn(async () => ({})),
      postMessage: vi.fn(async () => ({ ts: 'perm-ts' })),
      update: vi.fn(async () => ({})),
    },
    conversations: { replies: vi.fn(async () => ({ messages: [] })) },
    files: { uploadV2: vi.fn(async () => ({ files: [] })) },
    reactions: { add: vi.fn(async () => ({})), remove: vi.fn(async () => ({ })) },
    views: { open: vi.fn(async () => ({})), publish: vi.fn(async () => ({})) },
  } as unknown as SlackWebClientLike;
}

describe('SlackPermissionBridge', () => {
  it('posts a permission request and resolves on approve action', async () => {
    const bridge = new SlackPermissionBridge(createTestLogger());
    const client = createClient();

    const pending = bridge.requestPermission(client, {
      channelId: 'C1',
      description: 'Need to save memory',
      input: { category: 'context' },
      threadTs: 'thread-1',
      toolName: 'mcp__slack-ui__save_memory',
    });

    await vi.waitFor(() => {
      expect(client.chat.postMessage).toHaveBeenCalledOnce();
    });
    expect(client.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'C1',
        thread_ts: 'thread-1',
        text: expect.stringContaining('需要你的授权'),
        blocks: expect.arrayContaining([
          expect.objectContaining({ type: 'section' }),
          expect.objectContaining({
            type: 'actions',
            elements: expect.arrayContaining([
              expect.objectContaining({ action_id: PERMISSION_APPROVE_ACTION_ID }),
              expect.objectContaining({ action_id: PERMISSION_DENY_ACTION_ID }),
            ]),
          }),
        ]),
      }),
    );

    const handled = await bridge.handleAction(
      client,
      {
        message: { ts: 'perm-ts', thread_ts: 'thread-1' },
        user: { id: 'U123' },
      },
      true,
    );

    expect(handled).toBe(true);
    await expect(pending).resolves.toEqual({ allowed: true });
    expect(client.chat.update).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'C1',
        ts: 'perm-ts',
        text: expect.stringContaining('已批准'),
      }),
    );
  });
});
