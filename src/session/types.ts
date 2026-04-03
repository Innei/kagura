export interface SessionRecord {
  bootstrapMessageTs?: string;
  channelId: string;
  claudeSessionId?: string;
  createdAt: string;
  rootMessageTs: string;
  streamMessageTs?: string;
  threadTs: string;
  updatedAt: string;
}

export type SessionState = 'registered' | 'bootstrapped' | 'streaming' | 'completed' | 'failed';

export function getSessionState(record: SessionRecord): SessionState {
  if (record.streamMessageTs) return 'streaming';
  if (record.bootstrapMessageTs) return 'bootstrapped';
  return 'registered';
}

export interface SessionStore {
  get: (threadTs: string) => SessionRecord | undefined;
  patch: (threadTs: string, patch: Partial<SessionRecord>) => SessionRecord | undefined;
  upsert: (record: SessionRecord) => SessionRecord;
}
