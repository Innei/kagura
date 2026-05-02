import type Database from 'better-sqlite3';

import type {
  ReviewSessionRecord,
  ReviewSessionStatus,
  ReviewSessionStore,
  StartReviewSessionInput,
} from './types.js';

export class SqliteReviewSessionStore implements ReviewSessionStore {
  constructor(private readonly sqlite: Database.Database) {}

  start(input: StartReviewSessionInput): void {
    this.sqlite
      .prepare(
        `
          INSERT INTO review_sessions (
            execution_id, thread_ts, channel_id, workspace_path, workspace_repo_id,
            workspace_label, base_head, base_branch, status, created_at, updated_at
          )
          VALUES (
            @executionId, @threadTs, @channelId, @workspacePath, @workspaceRepoId,
            @workspaceLabel, @baseHead, @baseBranch, 'running', @createdAt, @createdAt
          )
          ON CONFLICT(execution_id) DO UPDATE SET
            thread_ts = excluded.thread_ts,
            channel_id = excluded.channel_id,
            workspace_path = excluded.workspace_path,
            workspace_repo_id = excluded.workspace_repo_id,
            workspace_label = excluded.workspace_label,
            base_head = excluded.base_head,
            base_branch = excluded.base_branch,
            status = 'running',
            updated_at = excluded.updated_at
        `,
      )
      .run({
        ...input,
        baseBranch: input.baseBranch ?? null,
        baseHead: input.baseHead ?? null,
        workspaceLabel: input.workspaceLabel ?? null,
        workspaceRepoId: input.workspaceRepoId ?? null,
      });
  }

  complete(
    executionId: string,
    status: Exclude<ReviewSessionStatus, 'running'>,
    head?: string | undefined,
  ): void {
    this.sqlite
      .prepare(
        `
          UPDATE review_sessions
          SET status = @status,
              head = @head,
              updated_at = @updatedAt
          WHERE execution_id = @executionId
        `,
      )
      .run({
        executionId,
        head: head ?? null,
        status,
        updatedAt: new Date().toISOString(),
      });
  }

  get(executionId: string): ReviewSessionRecord | undefined {
    const row = this.sqlite
      .prepare(
        `
          SELECT
            execution_id AS executionId,
            thread_ts AS threadTs,
            channel_id AS channelId,
            workspace_path AS workspacePath,
            workspace_repo_id AS workspaceRepoId,
            workspace_label AS workspaceLabel,
            base_head AS baseHead,
            base_branch AS baseBranch,
            head,
            status,
            created_at AS createdAt,
            updated_at AS updatedAt
          FROM review_sessions
          WHERE execution_id = @executionId
        `,
      )
      .get({ executionId }) as Record<string, unknown> | undefined;

    return row ? rowToRecord(row) : undefined;
  }
}

function rowToRecord(row: Record<string, unknown>): ReviewSessionRecord {
  return {
    channelId: String(row.channelId),
    createdAt: String(row.createdAt),
    executionId: String(row.executionId),
    status: String(row.status) as ReviewSessionStatus,
    threadTs: String(row.threadTs),
    updatedAt: String(row.updatedAt),
    workspacePath: String(row.workspacePath),
    ...(typeof row.baseBranch === 'string' && row.baseBranch ? { baseBranch: row.baseBranch } : {}),
    ...(typeof row.baseHead === 'string' && row.baseHead ? { baseHead: row.baseHead } : {}),
    ...(typeof row.head === 'string' && row.head ? { head: row.head } : {}),
    ...(typeof row.workspaceLabel === 'string' && row.workspaceLabel
      ? { workspaceLabel: row.workspaceLabel }
      : {}),
    ...(typeof row.workspaceRepoId === 'string' && row.workspaceRepoId
      ? { workspaceRepoId: row.workspaceRepoId }
      : {}),
  };
}
