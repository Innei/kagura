import type Database from 'better-sqlite3';

export type PersistentExecutionStatus =
  | 'running'
  | 'recovering'
  | 'completed'
  | 'failed'
  | 'stopped';

export interface PersistentExecutionRecord {
  attemptCount: number;
  channelId: string;
  executionId: string;
  messageTs: string;
  providerId: string;
  resumeHandle?: string | undefined;
  rootMessageTs: string;
  startedAt: string;
  status: PersistentExecutionStatus;
  teamId?: string | undefined;
  terminalPhase?: string | undefined;
  text: string;
  threadTs: string;
  updatedAt: string;
  userId: string;
}

export interface StartExecutionInput {
  channelId: string;
  executionId: string;
  messageTs: string;
  providerId: string;
  rootMessageTs: string;
  startedAt: string;
  teamId?: string | undefined;
  text: string;
  threadTs: string;
  userId: string;
}

export interface PersistentExecutionStore {
  claimRecoverable: (maxAttempts: number) => PersistentExecutionRecord[];
  markTerminal: (
    executionId: string,
    status: Extract<PersistentExecutionStatus, 'completed' | 'failed' | 'stopped'>,
    terminalPhase?: string | undefined,
  ) => void;
  recordResumeHandle: (executionId: string, resumeHandle: string) => void;
  start: (input: StartExecutionInput) => void;
}

export class SqlitePersistentExecutionStore implements PersistentExecutionStore {
  constructor(private readonly sqlite: Database.Database) {}

  start(input: StartExecutionInput): void {
    this.sqlite
      .prepare(
        `
          INSERT INTO agent_executions (
            execution_id, thread_ts, channel_id, message_ts, root_message_ts,
            user_id, provider_id, status, text, team_id, attempt_count,
            started_at, updated_at
          )
          VALUES (
            @executionId, @threadTs, @channelId, @messageTs, @rootMessageTs,
            @userId, @providerId, 'running', @text, @teamId, 0,
            @startedAt, @startedAt
          )
          ON CONFLICT(execution_id) DO UPDATE SET
            status = 'running',
            updated_at = excluded.updated_at
        `,
      )
      .run({
        ...input,
        teamId: input.teamId ?? null,
      });
  }

  recordResumeHandle(executionId: string, resumeHandle: string): void {
    this.sqlite
      .prepare(
        `
          UPDATE agent_executions
          SET resume_handle = @resumeHandle, updated_at = @updatedAt
          WHERE execution_id = @executionId
        `,
      )
      .run({
        executionId,
        resumeHandle,
        updatedAt: new Date().toISOString(),
      });
  }

  markTerminal(
    executionId: string,
    status: Extract<PersistentExecutionStatus, 'completed' | 'failed' | 'stopped'>,
    terminalPhase?: string | undefined,
  ): void {
    this.sqlite
      .prepare(
        `
          UPDATE agent_executions
          SET status = @status, terminal_phase = @terminalPhase, updated_at = @updatedAt
          WHERE execution_id = @executionId
        `,
      )
      .run({
        executionId,
        status,
        terminalPhase: terminalPhase ?? null,
        updatedAt: new Date().toISOString(),
      });
  }

  claimRecoverable(maxAttempts: number): PersistentExecutionRecord[] {
    const updatedAt = new Date().toISOString();
    const rows = this.sqlite
      .prepare(
        `
          SELECT
            execution_id AS executionId,
            thread_ts AS threadTs,
            channel_id AS channelId,
            message_ts AS messageTs,
            root_message_ts AS rootMessageTs,
            user_id AS userId,
            provider_id AS providerId,
            status,
            text,
            team_id AS teamId,
            resume_handle AS resumeHandle,
            terminal_phase AS terminalPhase,
            attempt_count AS attemptCount,
            started_at AS startedAt,
            updated_at AS updatedAt
          FROM agent_executions
          WHERE status IN ('running', 'recovering')
            AND attempt_count < @maxAttempts
          ORDER BY started_at ASC
        `,
      )
      .all({ maxAttempts }) as Array<Record<string, unknown>>;

    const records = rows.map(rowToRecord);
    const claim = this.sqlite.prepare(
      `
        UPDATE agent_executions
        SET status = 'recovering',
            attempt_count = attempt_count + 1,
            updated_at = @updatedAt
        WHERE execution_id = @executionId
          AND status IN ('running', 'recovering')
          AND attempt_count < @maxAttempts
      `,
    );

    return records.filter((record) => {
      const result = claim.run({
        executionId: record.executionId,
        maxAttempts,
        updatedAt,
      });
      return result.changes > 0;
    });
  }
}

function rowToRecord(row: Record<string, unknown>): PersistentExecutionRecord {
  return {
    attemptCount: Number(row.attemptCount ?? 0),
    channelId: String(row.channelId),
    executionId: String(row.executionId),
    messageTs: String(row.messageTs),
    providerId: String(row.providerId),
    rootMessageTs: String(row.rootMessageTs),
    startedAt: String(row.startedAt),
    status: String(row.status) as PersistentExecutionStatus,
    text: String(row.text),
    threadTs: String(row.threadTs),
    updatedAt: String(row.updatedAt),
    userId: String(row.userId),
    ...(typeof row.resumeHandle === 'string' && row.resumeHandle
      ? { resumeHandle: row.resumeHandle }
      : {}),
    ...(typeof row.teamId === 'string' && row.teamId ? { teamId: row.teamId } : {}),
    ...(typeof row.terminalPhase === 'string' && row.terminalPhase
      ? { terminalPhase: row.terminalPhase }
      : {}),
  };
}
