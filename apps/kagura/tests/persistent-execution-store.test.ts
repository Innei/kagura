import { describe, expect, it } from 'vitest';

import { SqlitePersistentExecutionStore } from '~/slack/execution/persistent-execution-store.js';

import { createTestDatabase } from './fixtures/test-database.js';

describe('SqlitePersistentExecutionStore', () => {
  it('claims stale running executions and enforces the attempt limit', () => {
    const { sqlite } = createTestDatabase();
    const store = new SqlitePersistentExecutionStore(sqlite);

    store.start({
      channelId: 'C123',
      executionId: 'exec-1',
      messageTs: '111.222',
      providerId: 'codex-cli',
      rootMessageTs: '111.222',
      startedAt: '2026-05-02T00:00:00.000Z',
      text: '<@Ubot> do work',
      threadTs: '111.222',
      userId: 'U123',
    });
    store.recordResumeHandle('exec-1', 'resume-1');

    const firstClaim = store.claimRecoverable(2);
    expect(firstClaim).toHaveLength(1);
    expect(firstClaim[0]).toMatchObject({
      attemptCount: 0,
      channelId: 'C123',
      executionId: 'exec-1',
      providerId: 'codex-cli',
      resumeHandle: 'resume-1',
      status: 'running',
    });

    const secondClaim = store.claimRecoverable(2);
    expect(secondClaim).toHaveLength(1);
    expect(secondClaim[0]?.attemptCount).toBe(1);

    expect(store.claimRecoverable(2)).toHaveLength(0);

    sqlite.close();
  });

  it('does not recover terminal executions', () => {
    const { sqlite } = createTestDatabase();
    const store = new SqlitePersistentExecutionStore(sqlite);

    store.start({
      channelId: 'C123',
      executionId: 'exec-1',
      messageTs: '111.222',
      providerId: 'codex-cli',
      rootMessageTs: '111.222',
      startedAt: '2026-05-02T00:00:00.000Z',
      text: '<@Ubot> do work',
      threadTs: '111.222',
      userId: 'U123',
    });
    store.markTerminal('exec-1', 'completed', 'completed');

    expect(store.claimRecoverable(2)).toHaveLength(0);

    sqlite.close();
  });
});
