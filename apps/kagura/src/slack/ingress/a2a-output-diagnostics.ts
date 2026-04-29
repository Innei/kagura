import fs from 'node:fs/promises';
import path from 'node:path';

import type { AppLogger } from '~/logger/index.js';

export type A2AOutputMode = 'verbose' | 'quiet';

export interface QuietAssistantMessageRecord {
  channelId: string;
  createdAt: string;
  executionId?: string | undefined;
  logLabel?: string | undefined;
  mode: A2AOutputMode;
  reason: 'quiet_final_buffered';
  text: string;
  threadTs: string;
  userId?: string | undefined;
}

export interface QuietAssistantMessageRecorder {
  record: (record: QuietAssistantMessageRecord) => Promise<void>;
}

export class FileQuietAssistantMessageRecorder implements QuietAssistantMessageRecorder {
  constructor(
    private readonly diagnosticsDir: string,
    private readonly logger: AppLogger,
  ) {}

  async record(record: QuietAssistantMessageRecord): Promise<void> {
    const filePath = this.filePathForThread(record.threadTs);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.appendFile(filePath, `${JSON.stringify(record)}\n`, 'utf8');
    this.logger.info(
      'Captured quiet A2A assistant message for thread %s execution %s in %s',
      record.threadTs,
      record.executionId ?? 'unknown',
      filePath,
    );
  }

  private filePathForThread(threadTs: string): string {
    return path.join(
      path.resolve(process.cwd(), this.diagnosticsDir),
      `${threadTs.replaceAll(/[^\w.-]/gu, '_')}.jsonl`,
    );
  }
}
