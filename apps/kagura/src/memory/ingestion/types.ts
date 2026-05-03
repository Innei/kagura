import type { MemoryCategory, MemoryRecord, MemoryScope } from '../types.js';

export interface MemoryIngestionContext {
  channelId: string;
  executionId: string;
  finalAssistantText: string;
  messageTs: string;
  providerId: string;
  threadTs: string;
  userText: string;
  workspace?: {
    label: string;
    path: string;
    repoId: string;
  };
}

export interface MemoryIngestionInput {
  context: MemoryIngestionContext;
  existingMemories: MemoryRecord[];
}

export type MemoryIngestionAction = 'save' | 'skip';
export type MemoryIngestionCandidateStatus = 'applied' | 'skipped' | 'invalid';

export interface ParsedMemoryCandidate {
  action: MemoryIngestionAction;
  category?: MemoryCategory | undefined;
  confidence?: number | undefined;
  content?: string | undefined;
  expiresAt?: string | undefined;
  reason?: string | undefined;
  scope?: MemoryScope | undefined;
}

export interface AppliedMemoryCandidate {
  candidate: ParsedMemoryCandidate;
  memoryId?: string | undefined;
  status: MemoryIngestionCandidateStatus;
}

export interface MemoryIngestionLlm {
  chat: (
    messages: Array<{ content: string; role: 'system' | 'user' | 'assistant' }>,
  ) => Promise<string>;
}
