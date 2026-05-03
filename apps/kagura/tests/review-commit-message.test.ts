import { describe, expect, it, vi } from 'vitest';

import { createCommitMessageGenerator } from '~/review/commit-message-generator.js';

function createMockQueryResult() {
  return (async function* () {
    yield {
      type: 'assistant',
      message: { content: [{ type: 'text', text: 'feat: add new feature' }] },
      session_id: 'forked-123',
    };
  })();
}

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  forkSession: vi.fn().mockResolvedValue({ sessionId: 'forked-123' }),
  query: vi.fn().mockImplementation(() => createMockQueryResult()),
}));

function createMockReviewService() {
  return {
    getSession: vi.fn().mockReturnValue({
      threadTs: '123.456',
      workspacePath: '/tmp/test-repo',
    }),
    getDiff: vi.fn().mockReturnValue('diff --git a/foo.ts b/foo.ts\n+added line'),
  };
}

function createMockSessionStore() {
  return {
    get: vi.fn().mockReturnValue({ providerSessionId: 'sess-abc' }),
  };
}

function createTestLogger() {
  return {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  };
}

describe('CommitMessageGenerator', () => {
  it('generates commit message via forked session', async () => {
    const reviewService = createMockReviewService();
    const sessionStore = createMockSessionStore();
    const logger = createTestLogger();

    const generator = createCommitMessageGenerator({
      reviewService: reviewService as never,
      sessionStore: sessionStore as never,
      logger: logger as never,
    });

    const message = await generator.generateCommitMessage('exec-1');
    expect(message).toBe('feat: add new feature');
    expect(reviewService.getSession).toHaveBeenCalledWith('exec-1');
    expect(sessionStore.get).toHaveBeenCalledWith('123.456');
  });

  it('falls back without fork when no providerSessionId', async () => {
    const reviewService = createMockReviewService();
    const sessionStore = { get: vi.fn().mockReturnValue({}) };
    const logger = createTestLogger();

    const generator = createCommitMessageGenerator({
      reviewService: reviewService as never,
      sessionStore: sessionStore as never,
      logger: logger as never,
    });

    const message = await generator.generateCommitMessage('exec-1');
    expect(message).toBe('feat: add new feature');
  });

  it('throws when query fails', async () => {
    const { query } = await import('@anthropic-ai/claude-agent-sdk');
    vi.mocked(query).mockImplementationOnce(() => {
      throw new Error('API error');
    });

    const reviewService = createMockReviewService();
    const sessionStore = createMockSessionStore();
    const logger = createTestLogger();

    const generator = createCommitMessageGenerator({
      reviewService: reviewService as never,
      sessionStore: sessionStore as never,
      logger: logger as never,
    });

    await expect(generator.generateCommitMessage('exec-1')).rejects.toThrow(
      'Failed to generate commit message',
    );
  });
});
