export type ThreadExecutionStopReason = 'user_stop';

export interface RegisteredThreadExecution {
  channelId: string;
  executionId: string;
  providerId: string;
  startedAt: string;
  stop: (reason: ThreadExecutionStopReason) => Promise<void>;
  threadTs: string;
  userId: string;
}

export interface StopAllResult {
  failed: number;
  stopped: number;
}

export interface ThreadExecutionRegistry {
  listActive: (threadTs: string) => RegisteredThreadExecution[];
  register: (execution: RegisteredThreadExecution) => () => void;
  stopAll: (threadTs: string, reason: ThreadExecutionStopReason) => Promise<StopAllResult>;
}

export function createThreadExecutionRegistry(): ThreadExecutionRegistry {
  const byThread = new Map<string, Map<string, RegisteredThreadExecution>>();

  return {
    listActive(threadTs) {
      const bucket = byThread.get(threadTs);
      if (!bucket) return [];
      return [...bucket.values()];
    },

    register(execution) {
      let bucket = byThread.get(execution.threadTs);
      if (!bucket) {
        bucket = new Map();
        byThread.set(execution.threadTs, bucket);
      }
      bucket.set(execution.executionId, execution);

      return () => {
        const b = byThread.get(execution.threadTs);
        if (!b) return;
        b.delete(execution.executionId);
        if (b.size === 0) {
          byThread.delete(execution.threadTs);
        }
      };
    },

    async stopAll(threadTs, reason) {
      const bucket = byThread.get(threadTs);
      if (!bucket) {
        return { failed: 0, stopped: 0 };
      }
      if (bucket.size === 0) {
        byThread.delete(threadTs);
        return { failed: 0, stopped: 0 };
      }

      byThread.delete(threadTs);
      const executions = [...bucket.values()];

      let stopped = 0;
      let failed = 0;
      const failedExecutions: RegisteredThreadExecution[] = [];

      for (const execution of executions) {
        try {
          await execution.stop(reason);
          stopped += 1;
        } catch {
          failed += 1;
          failedExecutions.push(execution);
        }
      }

      if (failedExecutions.length > 0) {
        let restoreBucket = byThread.get(threadTs);
        if (!restoreBucket) {
          restoreBucket = new Map();
          byThread.set(threadTs, restoreBucket);
        }
        for (const execution of failedExecutions) {
          restoreBucket.set(execution.executionId, execution);
        }
      }

      return { failed, stopped };
    },
  };
}
