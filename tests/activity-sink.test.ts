import { describe, expect, it, vi } from 'vitest';

import type { AgentActivityState } from '~/agent/types.js';
import type { AppLogger } from '~/logger/index.js';
import type { SessionStore } from '~/session/types.js';
import { createActivitySink } from '~/slack/ingress/activity-sink.js';
import type { SlackRenderer } from '~/slack/render/slack-renderer.js';
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

function createRendererStub(): SlackRenderer {
  return {
    addAcknowledgementReaction: vi.fn().mockResolvedValue(undefined),
    clearUiState: vi.fn().mockResolvedValue(undefined),
    deleteThreadProgressMessage: vi.fn().mockResolvedValue(undefined),
    finalizeThreadProgressMessage: vi.fn().mockResolvedValue(undefined),
    finalizeThreadProgressMessageStopped: vi.fn().mockResolvedValue(undefined),
    postThreadReply: vi.fn().mockResolvedValue(undefined),
    setUiState: vi.fn().mockResolvedValue(undefined),
    showThinkingIndicator: vi.fn().mockResolvedValue(undefined),
    upsertThreadProgressMessage: vi.fn().mockResolvedValue('progress-ts'),
  } as unknown as SlackRenderer;
}

function createMockClient(): SlackWebClientLike {
  return {
    assistant: { threads: { setStatus: vi.fn().mockResolvedValue({}) } },
    auth: { test: vi.fn().mockResolvedValue({ user_id: 'U_BOT' }) },
    chat: {
      delete: vi.fn().mockResolvedValue({}),
      postMessage: vi.fn().mockResolvedValue({ ts: 'msg-ts' }),
      update: vi.fn().mockResolvedValue({}),
    },
    conversations: { replies: vi.fn().mockResolvedValue({ messages: [] }) },
    reactions: { add: vi.fn().mockResolvedValue({}) },
    views: { open: vi.fn().mockResolvedValue({}) },
  } as unknown as SlackWebClientLike;
}

function createMockSessionStore(): SessionStore {
  return {
    countAll: () => 0,
    get: vi.fn().mockReturnValue(undefined),
    patch: vi.fn().mockReturnValue(undefined),
    upsert: vi.fn().mockImplementation((r) => r),
  } as unknown as SessionStore;
}

describe('createActivitySink', () => {
  it('posts a thread reply on assistant-message events', async () => {
    const renderer = createRendererStub();
    const sink = createActivitySink({
      channel: 'C123',
      client: createMockClient(),
      logger: createTestLogger(),
      renderer,
      sessionStore: createMockSessionStore(),
      threadTs: 'ts1',
    });

    await sink.onEvent({ type: 'assistant-message', text: 'Hello!' });

    expect(renderer.postThreadReply).toHaveBeenCalledWith(
      expect.anything(),
      'C123',
      'ts1',
      'Hello!',
      expect.any(Object),
    );
  });

  it('clears UI state after assistant-message', async () => {
    const renderer = createRendererStub();
    const sink = createActivitySink({
      channel: 'C123',
      client: createMockClient(),
      logger: createTestLogger(),
      renderer,
      sessionStore: createMockSessionStore(),
      threadTs: 'ts1',
    });

    await sink.onEvent({ type: 'assistant-message', text: 'Hello!' });

    expect(renderer.clearUiState).toHaveBeenCalled();
  });

  it('patches session with resume handle on lifecycle events', async () => {
    const sessionStore = createMockSessionStore();
    const sink = createActivitySink({
      channel: 'C123',
      client: createMockClient(),
      logger: createTestLogger(),
      renderer: createRendererStub(),
      sessionStore,
      threadTs: 'ts1',
    });

    await sink.onEvent({ type: 'lifecycle', phase: 'started', resumeHandle: 'session-42' });

    expect(sessionStore.patch).toHaveBeenCalledWith('ts1', { claudeSessionId: 'session-42' });
  });

  it('posts error message on lifecycle failed', async () => {
    const renderer = createRendererStub();
    const sink = createActivitySink({
      channel: 'C123',
      client: createMockClient(),
      logger: createTestLogger(),
      renderer,
      sessionStore: createMockSessionStore(),
      threadTs: 'ts1',
    });

    await sink.onEvent({ type: 'lifecycle', phase: 'failed', error: 'boom' });

    expect(renderer.postThreadReply).toHaveBeenCalledWith(
      expect.anything(),
      'C123',
      'ts1',
      'An error occurred while processing your request.',
    );
  });

  it('finalize clears UI state', async () => {
    const renderer = createRendererStub();
    const sink = createActivitySink({
      channel: 'C123',
      client: createMockClient(),
      logger: createTestLogger(),
      renderer,
      sessionStore: createMockSessionStore(),
      threadTs: 'ts1',
    });

    await sink.finalize();

    expect(renderer.clearUiState).toHaveBeenCalledWith(expect.anything(), 'C123', 'ts1');
  });

  it('tracks tool activity in toolHistory', async () => {
    const renderer = createRendererStub();
    const sink = createActivitySink({
      channel: 'C123',
      client: createMockClient(),
      logger: createTestLogger(),
      renderer,
      sessionStore: createMockSessionStore(),
      threadTs: 'ts1',
    });

    const state: AgentActivityState = {
      threadTs: 'ts1',
      status: 'Reading files...',
      activities: ['Reading src/index.ts...'],
      clear: false,
    };
    await sink.onEvent({ type: 'activity-state', state });

    expect(sink.toolHistory.get('Reading')).toBe(2);
  });

  it('lifecycle stopped with no progress posts _Stopped by user._ and not the generic error', async () => {
    const renderer = createRendererStub();
    const sink = createActivitySink({
      channel: 'C123',
      client: createMockClient(),
      logger: createTestLogger(),
      renderer,
      sessionStore: createMockSessionStore(),
      threadTs: 'ts1',
    });

    await sink.onEvent({ type: 'lifecycle', phase: 'stopped', reason: 'user_stop' });

    expect(renderer.postThreadReply).toHaveBeenCalledWith(
      expect.anything(),
      'C123',
      'ts1',
      '_Stopped by user._',
    );
    expect(renderer.postThreadReply).not.toHaveBeenCalledWith(
      expect.anything(),
      'C123',
      'ts1',
      'An error occurred while processing your request.',
    );
  });

  it('finalize uses stopped progress finalizer when stopped with progress and no assistant reply yet', async () => {
    const renderer = createRendererStub();
    const sink = createActivitySink({
      channel: 'C123',
      client: createMockClient(),
      logger: createTestLogger(),
      renderer,
      sessionStore: createMockSessionStore(),
      threadTs: 'ts1',
    });

    const state: AgentActivityState = {
      threadTs: 'ts1',
      status: 'Reading files...',
      activities: ['Reading src/index.ts...'],
      clear: false,
    };
    await sink.onEvent({ type: 'activity-state', state });
    await sink.onEvent({ type: 'lifecycle', phase: 'stopped', reason: 'user_stop' });

    expect(renderer.postThreadReply).not.toHaveBeenCalledWith(
      expect.anything(),
      'C123',
      'ts1',
      '_Stopped by user._',
    );

    await sink.finalize();

    expect(renderer.finalizeThreadProgressMessageStopped).toHaveBeenCalledWith(
      expect.anything(),
      'C123',
      'ts1',
      'progress-ts',
      sink.toolHistory,
    );
    expect(renderer.finalizeThreadProgressMessage).not.toHaveBeenCalled();
    expect(renderer.postThreadReply).not.toHaveBeenCalledWith(
      expect.anything(),
      'C123',
      'ts1',
      '_Stopped by user._',
    );
  });
});
