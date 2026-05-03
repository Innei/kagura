import { describe, expect, it, vi } from 'vitest';

import { memoryIngestionCandidates, memoryIngestionRuns } from '~/db/schema.js';
import { createRootLogger } from '~/logger/index.js';
import { SqliteMemoryIngestionAuditStore } from '~/memory/ingestion/audit-store.js';
import { parseMemoryIngestionCandidates } from '~/memory/ingestion/parser.js';
import { MemoryIngestionService } from '~/memory/ingestion/service.js';
import { SqliteMemoryStore } from '~/memory/memory-store.js';
import { SqliteReconcileStateStore } from '~/memory/reconciler/state-store.js';

import { createTestDatabase } from './fixtures/test-database.js';

describe('parseMemoryIngestionCandidates', () => {
  it('accepts save and skip candidates only', () => {
    const candidates = parseMemoryIngestionCandidates(
      JSON.stringify({
        candidates: [
          {
            action: 'save',
            category: 'decision',
            scope: 'workspace',
            content: 'Use host-side memory ingestion.',
            confidence: 0.91,
            reason: 'durable decision',
          },
          { action: 'skip', confidence: 0.2, reason: 'routine status' },
        ],
      }),
    );

    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toMatchObject({ action: 'save', category: 'decision' });
    expect(candidates[1]).toMatchObject({ action: 'skip' });
  });

  it('rejects unsupported destructive actions', () => {
    expect(() =>
      parseMemoryIngestionCandidates(
        JSON.stringify({
          candidates: [{ action: 'delete', confidence: 1, reason: 'nope' }],
        }),
      ),
    ).toThrow('action must be save or skip');
  });
});

describe('MemoryIngestionService', () => {
  it('saves only high-confidence candidates and audits all candidates', async () => {
    const { db } = createTestDatabase();
    const reconcileStore = new SqliteReconcileStateStore(db);
    const memoryStore = new SqliteMemoryStore(db, createRootLogger(), reconcileStore);
    const auditStore = new SqliteMemoryIngestionAuditStore(db);
    const llm = {
      chat: vi.fn().mockResolvedValue(
        JSON.stringify({
          candidates: [
            {
              action: 'save',
              category: 'task_completed',
              scope: 'workspace',
              content: 'Implemented host-side memory ingestion.',
              confidence: 0.92,
              reason: 'completed durable implementation',
            },
            {
              action: 'save',
              category: 'observation',
              scope: 'workspace',
              content: 'The agent said it is thinking.',
              confidence: 0.31,
              reason: 'low value',
            },
          ],
        }),
      ),
    };
    const service = new MemoryIngestionService({
      auditStore,
      llm,
      logger: createRootLogger(),
      memoryStore,
    });

    await service.ingest({
      channelId: 'C123',
      executionId: 'exec-1',
      finalAssistantText: 'Implemented the memory ingestion pipeline.',
      messageTs: '111.222',
      providerId: 'codex-cli',
      threadTs: '111.000',
      userText: 'optimize memory ingestion',
      workspace: { label: 'repo', path: '/tmp/repo', repoId: 'owner/repo' },
    });

    const memories = memoryStore.search('owner/repo', { category: 'task_completed' });
    expect(memories).toHaveLength(1);
    expect(memories[0]?.content).toBe('Implemented host-side memory ingestion.');

    const run = db.select().from(memoryIngestionRuns).get();
    expect(run).toMatchObject({ executionId: 'exec-1', status: 'completed' });
    const candidates = db.select().from(memoryIngestionCandidates).all();
    expect(candidates).toHaveLength(2);
    expect(candidates.map((candidate) => candidate.status)).toEqual(['applied', 'skipped']);
  });

  it('is idempotent by execution id', async () => {
    const { db } = createTestDatabase();
    const reconcileStore = new SqliteReconcileStateStore(db);
    const memoryStore = new SqliteMemoryStore(db, createRootLogger(), reconcileStore);
    const auditStore = new SqliteMemoryIngestionAuditStore(db);
    const llm = {
      chat: vi.fn().mockResolvedValue(
        JSON.stringify({
          candidates: [
            {
              action: 'save',
              category: 'decision',
              scope: 'global',
              content: 'Keep only two agent memory tools.',
              confidence: 0.95,
              reason: 'explicit user preference',
            },
          ],
        }),
      ),
    };
    const service = new MemoryIngestionService({
      auditStore,
      llm,
      logger: createRootLogger(),
      memoryStore,
    });
    const context = {
      channelId: 'C123',
      executionId: 'exec-duplicate',
      finalAssistantText: 'Done.',
      messageTs: '111.222',
      providerId: 'claude-code',
      threadTs: '111.000',
      userText: 'finish',
    };

    await service.ingest(context);
    await service.ingest(context);

    expect(llm.chat).toHaveBeenCalledTimes(1);
    expect(memoryStore.search(undefined, { category: 'decision' })).toHaveLength(1);
  });
});
