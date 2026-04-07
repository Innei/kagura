import { describe, expect, it, vi } from 'vitest';

import type { AppLogger } from '~/logger/index.js';
import {
  formatPermissionDecisionMessage,
  formatPermissionRequestMessage,
  PERMISSION_APPROVE_ACTION_ID,
  PERMISSION_DENY_ACTION_ID,
  SlackPermissionBridge,
} from '~/slack/interaction/permission-bridge.js';

describe('SlackPermissionBridge', () => {
  it('resolves with allowed=true when approved', async () => {
    const bridge = new SlackPermissionBridge(createTestLogger());
    const pending = bridge.awaitDecision({
      expectedUserId: 'U123',
      request: { toolName: 'Bash', input: { command: 'rm -rf /tmp/test' } },
      threadTs: 'thread-1',
    });

    expect(bridge.hasPending('thread-1')).toBe(true);

    const result = bridge.submitDecision({
      allowed: true,
      threadTs: 'thread-1',
      userId: 'U123',
    });
    expect(result).toMatchObject({ handled: true });

    await expect(pending).resolves.toMatchObject({ allowed: true });
    expect(bridge.hasPending('thread-1')).toBe(false);
  });

  it('resolves with allowed=false when denied', async () => {
    const bridge = new SlackPermissionBridge(createTestLogger());
    const pending = bridge.awaitDecision({
      expectedUserId: 'U123',
      request: { toolName: 'Edit', input: { file_path: '/etc/hosts' } },
      threadTs: 'thread-2',
    });

    const result = bridge.submitDecision({
      allowed: false,
      threadTs: 'thread-2',
      userId: 'U123',
    });
    expect(result).toMatchObject({ handled: true });

    await expect(pending).resolves.toMatchObject({ allowed: false });
  });

  it('rejects decisions from wrong user', async () => {
    const bridge = new SlackPermissionBridge(createTestLogger());
    void bridge.awaitDecision({
      expectedUserId: 'U123',
      request: { toolName: 'Bash', input: { command: 'ls' } },
      threadTs: 'thread-3',
    });

    const result = bridge.submitDecision({
      allowed: true,
      threadTs: 'thread-3',
      userId: 'U999',
    });

    expect(result).toMatchObject({ handled: true });
    expect(result.feedback).toContain('U123');
    expect(bridge.hasPending('thread-3')).toBe(true);
  });

  it('returns handled=false when no pending request', () => {
    const bridge = new SlackPermissionBridge(createTestLogger());
    const result = bridge.submitDecision({
      allowed: true,
      threadTs: 'thread-nonexistent',
      userId: 'U123',
    });
    expect(result).toMatchObject({ handled: false });
  });

  it('throws when thread already has pending request', async () => {
    const bridge = new SlackPermissionBridge(createTestLogger());
    void bridge.awaitDecision({
      request: { toolName: 'Bash', input: { command: 'ls' } },
      threadTs: 'thread-4',
    });

    await expect(
      bridge.awaitDecision({
        request: { toolName: 'Edit', input: { file_path: 'x' } },
        threadTs: 'thread-4',
      }),
    ).rejects.toThrow('already waiting');
  });

  it('rejects immediately when signal is already aborted', async () => {
    const bridge = new SlackPermissionBridge(createTestLogger());
    const controller = new AbortController();
    controller.abort();

    await expect(
      bridge.awaitDecision({
        request: { toolName: 'Bash', input: { command: 'ls' } },
        signal: controller.signal,
        threadTs: 'thread-5',
      }),
    ).rejects.toBeDefined();

    expect(bridge.hasPending('thread-5')).toBe(false);
  });

  it('rejects pending request when signal is aborted after creation', async () => {
    const bridge = new SlackPermissionBridge(createTestLogger());
    const controller = new AbortController();

    const pending = bridge.awaitDecision({
      request: { toolName: 'Bash', input: { command: 'ls' } },
      signal: controller.signal,
      threadTs: 'thread-6',
    });

    controller.abort('superseded');
    await expect(pending).rejects.toBe('superseded');
    expect(bridge.hasPending('thread-6')).toBe(false);
  });

  it('allows any user when expectedUserId is not set', async () => {
    const bridge = new SlackPermissionBridge(createTestLogger());
    const pending = bridge.awaitDecision({
      request: { toolName: 'Bash', input: { command: 'ls' } },
      threadTs: 'thread-7',
    });

    const result = bridge.submitDecision({
      allowed: true,
      threadTs: 'thread-7',
      userId: 'U_ANY',
    });
    expect(result).toMatchObject({ handled: true });
    await expect(pending).resolves.toMatchObject({ allowed: true });
  });
});

describe('formatPermissionRequestMessage', () => {
  it('includes tool name and action buttons', () => {
    const result = formatPermissionRequestMessage({
      toolName: 'Bash',
      input: { command: 'echo hello' },
    });

    expect(result.text).toContain('Bash');
    expect(result.blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'actions',
          elements: expect.arrayContaining([
            expect.objectContaining({
              action_id: PERMISSION_APPROVE_ACTION_ID,
              style: 'primary',
            }),
            expect.objectContaining({
              action_id: PERMISSION_DENY_ACTION_ID,
              style: 'danger',
            }),
          ]),
        }),
      ]),
    );
  });

  it('shows command for Bash tool input', () => {
    const result = formatPermissionRequestMessage({
      toolName: 'Bash',
      input: { command: 'rm -rf /tmp/test' },
    });

    expect(result.blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'section',
          text: expect.objectContaining({
            text: expect.stringContaining('rm -rf /tmp/test'),
          }),
        }),
      ]),
    );
  });

  it('shows file_path for Edit tool input', () => {
    const result = formatPermissionRequestMessage({
      toolName: 'Edit',
      input: { file_path: '/src/index.ts', old_string: 'foo', new_string: 'bar' },
    });

    expect(result.blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'section',
          text: expect.objectContaining({
            text: expect.stringContaining('/src/index.ts'),
          }),
        }),
      ]),
    );
  });
});

describe('formatPermissionDecisionMessage', () => {
  it('formats approved message', () => {
    const result = formatPermissionDecisionMessage('Bash', true, 'U123');
    expect(result.text).toContain('\u2705');
    expect(result.text).toContain('已批准');
    expect(result.text).toContain('U123');
    expect(result.text).toContain('Bash');
  });

  it('formats denied message', () => {
    const result = formatPermissionDecisionMessage('Bash', false, 'U123');
    expect(result.text).toContain('\u274C');
    expect(result.text).toContain('已拒绝');
  });
});

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
