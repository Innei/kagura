import { randomUUID } from 'node:crypto';

import { eq, or } from 'drizzle-orm';

import type { AppDatabase } from '~/db/index.js';
import { memoryIngestionCandidates, memoryIngestionRuns } from '~/db/schema.js';

import type { AppliedMemoryCandidate } from './types.js';

export interface StartMemoryIngestionRunInput {
  channelId: string;
  executionId: string;
  finalTextHash: string;
  input: unknown;
  messageTs: string;
  providerId: string;
  repoId?: string | undefined;
  threadTs: string;
  workspaceLabel?: string | undefined;
}

export class SqliteMemoryIngestionAuditStore {
  constructor(private readonly db: AppDatabase) {}

  hasCompletedOrRunningRun(executionId: string, finalTextHash: string): boolean {
    const row = this.db
      .select({ id: memoryIngestionRuns.id })
      .from(memoryIngestionRuns)
      .where(
        or(
          eq(memoryIngestionRuns.executionId, executionId),
          eq(memoryIngestionRuns.finalTextHash, finalTextHash),
        ),
      )
      .get();
    return Boolean(row);
  }

  start(input: StartMemoryIngestionRunInput): string {
    const id = randomUUID();
    this.db
      .insert(memoryIngestionRuns)
      .values({
        id,
        executionId: input.executionId,
        finalTextHash: input.finalTextHash,
        status: 'running',
        providerId: input.providerId,
        channelId: input.channelId,
        threadTs: input.threadTs,
        messageTs: input.messageTs,
        repoId: input.repoId ?? null,
        workspaceLabel: input.workspaceLabel ?? null,
        input: JSON.stringify(input.input),
        rawResponse: null,
        error: null,
        startedAt: new Date().toISOString(),
        completedAt: null,
      })
      .run();
    return id;
  }

  complete(runId: string, rawResponse: string, candidates: AppliedMemoryCandidate[]): void {
    this.finish(runId, 'completed', rawResponse, null, candidates);
  }

  skip(runId: string, rawResponse: string, candidates: AppliedMemoryCandidate[]): void {
    this.finish(runId, 'skipped', rawResponse, null, candidates);
  }

  fail(runId: string, error: string, rawResponse?: string | undefined): void {
    this.db
      .update(memoryIngestionRuns)
      .set({
        status: 'failed',
        rawResponse: rawResponse ?? null,
        error,
        completedAt: new Date().toISOString(),
      })
      .where(eq(memoryIngestionRuns.id, runId))
      .run();
  }

  private finish(
    runId: string,
    status: 'completed' | 'skipped',
    rawResponse: string,
    error: string | null,
    candidates: AppliedMemoryCandidate[],
  ): void {
    const now = new Date().toISOString();
    this.db.transaction((tx) => {
      tx.update(memoryIngestionRuns)
        .set({
          status,
          rawResponse,
          error,
          completedAt: now,
        })
        .where(eq(memoryIngestionRuns.id, runId))
        .run();

      for (const item of candidates) {
        tx.insert(memoryIngestionCandidates)
          .values({
            id: randomUUID(),
            runId,
            action: item.candidate.action,
            status: item.status,
            category: item.candidate.category ?? null,
            scope: item.candidate.scope ?? null,
            content: item.candidate.content ?? null,
            confidence: item.candidate.confidence ?? null,
            reason: item.candidate.reason ?? null,
            memoryId: item.memoryId ?? null,
            payload: JSON.stringify(item.candidate),
            createdAt: now,
          })
          .run();
      }
    });
  }
}
