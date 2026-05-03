import { createHash } from 'node:crypto';

import type { AppLogger } from '~/logger/index.js';

import type { MemoryRecord, MemoryStore, SaveMemoryInput } from '../types.js';
import type { SqliteMemoryIngestionAuditStore } from './audit-store.js';
import { parseMemoryIngestionCandidates } from './parser.js';
import type {
  AppliedMemoryCandidate,
  MemoryIngestionContext,
  MemoryIngestionInput,
  MemoryIngestionLlm,
  ParsedMemoryCandidate,
} from './types.js';

const HIGH_CONFIDENCE_THRESHOLD = 0.78;
const MAX_EXISTING_MEMORIES = 12;
const MAX_FINAL_TEXT_LENGTH = 4_000;
const MAX_USER_TEXT_LENGTH = 1_500;

const SYSTEM_PROMPT = `You extract durable memory candidates from one completed Slack agent turn.

Return strictly JSON: {"candidates":[...]}.

Each candidate must be:
- {"action":"save","category":"task_completed|decision|context|observation|preference","scope":"global|workspace","content":"...","confidence":0..1,"reason":"..."}
- {"action":"skip","confidence":0..1,"reason":"..."}

Rules:
- Only save facts that are useful in future sessions: explicit user preferences, durable project decisions, stable repo/workspace context, completed implementation outcomes, or concrete observations.
- Prefer workspace scope for repo-specific facts. Use global only for user-wide preferences or host-wide behavior.
- Do not save routine status, transient progress, generic summaries, uncertain claims, or content already covered by existing memories.
- Do not update or delete memory. This extractor only proposes save or skip.
- Keep saved content concise, factual, and standalone.`;

export class MemoryIngestionService {
  constructor(
    private readonly options: {
      auditStore: SqliteMemoryIngestionAuditStore;
      llm: MemoryIngestionLlm;
      logger: AppLogger;
      memoryStore: MemoryStore;
    },
  ) {}

  async ingest(context: MemoryIngestionContext): Promise<void> {
    const finalAssistantText = context.finalAssistantText.trim();
    if (!finalAssistantText) {
      return;
    }

    const finalTextHash = hashText(finalAssistantText);
    if (this.options.auditStore.hasCompletedOrRunningRun(context.executionId, finalTextHash)) {
      this.options.logger.debug(
        'Skipping memory ingestion for execution %s; audit run already exists',
        context.executionId,
      );
      return;
    }

    const existingMemories = collectExistingMemories(this.options.memoryStore, context);
    const input: MemoryIngestionInput = {
      context: {
        ...context,
        finalAssistantText: truncate(finalAssistantText, MAX_FINAL_TEXT_LENGTH),
        userText: truncate(context.userText, MAX_USER_TEXT_LENGTH),
      },
      existingMemories,
    };

    const runId = this.options.auditStore.start({
      channelId: context.channelId,
      executionId: context.executionId,
      finalTextHash,
      input,
      messageTs: context.messageTs,
      providerId: context.providerId,
      repoId: context.workspace?.repoId,
      threadTs: context.threadTs,
      workspaceLabel: context.workspace?.label,
    });

    let raw: string;
    try {
      raw = await this.options.llm.chat([
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: JSON.stringify(toLlmPayload(input), null, 2),
        },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.options.auditStore.fail(runId, message);
      this.options.logger.warn(
        'Memory ingestion LLM call failed for execution %s: %s',
        context.executionId,
        message,
      );
      return;
    }

    let candidates: ParsedMemoryCandidate[];
    try {
      candidates = parseMemoryIngestionCandidates(raw);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.options.auditStore.fail(runId, message, raw);
      this.options.logger.warn(
        'Memory ingestion parse failed for execution %s: %s; raw=%s',
        context.executionId,
        message,
        raw.slice(0, 500),
      );
      return;
    }

    const applied = candidates.map((candidate) =>
      applyCandidate(candidate, context, existingMemories, this.options.memoryStore),
    );
    const anyApplied = applied.some((item) => item.status === 'applied');
    if (anyApplied) {
      this.options.auditStore.complete(runId, raw, applied);
    } else {
      this.options.auditStore.skip(runId, raw, applied);
    }
  }
}

function collectExistingMemories(
  memoryStore: MemoryStore,
  context: MemoryIngestionContext,
): MemoryRecord[] {
  const repoId = context.workspace?.repoId;
  const fromContext = memoryStore.listForContext(repoId, { global: 4, workspace: 8 });
  return dedupeMemories([
    ...fromContext.preferences,
    ...fromContext.workspace,
    ...fromContext.global,
  ]).slice(0, MAX_EXISTING_MEMORIES);
}

function toLlmPayload(input: MemoryIngestionInput): unknown {
  const { context, existingMemories } = input;
  return {
    execution: {
      executionId: context.executionId,
      providerId: context.providerId,
      channelId: context.channelId,
      threadTs: context.threadTs,
      messageTs: context.messageTs,
      userText: context.userText,
      finalAssistantText: context.finalAssistantText,
      ...(context.workspace
        ? {
            workspace: {
              repoId: context.workspace.repoId,
              label: context.workspace.label,
              path: context.workspace.path,
            },
          }
        : {}),
    },
    existingMemories: existingMemories.map((memory) => ({
      id: memory.id,
      category: memory.category,
      scope: memory.scope,
      content: memory.content,
      createdAt: memory.createdAt,
      ...(memory.repoId ? { repoId: memory.repoId } : {}),
    })),
  };
}

function applyCandidate(
  candidate: ParsedMemoryCandidate,
  context: MemoryIngestionContext,
  existingMemories: MemoryRecord[],
  memoryStore: MemoryStore,
): AppliedMemoryCandidate {
  const invalid = validateCandidate(candidate, context);
  if (invalid) {
    return { candidate: { ...candidate, reason: invalid }, status: 'invalid' };
  }

  if (candidate.action === 'skip') {
    return { candidate, status: 'skipped' };
  }

  if ((candidate.confidence ?? 0) < HIGH_CONFIDENCE_THRESHOLD) {
    return {
      candidate: {
        ...candidate,
        reason: candidate.reason ?? `confidence below ${HIGH_CONFIDENCE_THRESHOLD}`,
      },
      status: 'skipped',
    };
  }

  if (isDuplicate(candidate, existingMemories)) {
    return {
      candidate: {
        ...candidate,
        reason: candidate.reason ?? 'duplicate of existing memory',
      },
      status: 'skipped',
    };
  }

  const saveInput: SaveMemoryInput = {
    category: candidate.category!,
    content: candidate.content!,
    metadata: {
      source: 'host_memory_ingestion',
      executionId: context.executionId,
      providerId: context.providerId,
      channelId: context.channelId,
      messageTs: context.messageTs,
      confidence: candidate.confidence,
      reason: candidate.reason,
    },
    threadTs: context.threadTs,
    ...(candidate.scope === 'workspace' ? { repoId: context.workspace!.repoId } : {}),
    ...(candidate.expiresAt ? { expiresAt: candidate.expiresAt } : {}),
  };
  const saved = memoryStore.save(saveInput);
  return { candidate, memoryId: saved.id, status: 'applied' };
}

function validateCandidate(
  candidate: ParsedMemoryCandidate,
  context: MemoryIngestionContext,
): string | undefined {
  if (candidate.action === 'skip') {
    return undefined;
  }
  if (!candidate.category) return 'save candidate missing category';
  if (!candidate.scope) return 'save candidate missing scope';
  if (!candidate.content) return 'save candidate missing content';
  if (candidate.scope === 'workspace' && !context.workspace?.repoId) {
    return 'workspace-scoped candidate without workspace';
  }
  return undefined;
}

function isDuplicate(candidate: ParsedMemoryCandidate, existingMemories: MemoryRecord[]): boolean {
  const normalized = normalizeMemoryText(candidate.content ?? '');
  return existingMemories.some(
    (memory) =>
      memory.category === candidate.category &&
      memory.scope === candidate.scope &&
      normalizeMemoryText(memory.content) === normalized,
  );
}

function dedupeMemories(memories: MemoryRecord[]): MemoryRecord[] {
  const seen = new Set<string>();
  const result: MemoryRecord[] = [];
  for (const memory of memories) {
    if (seen.has(memory.id)) continue;
    seen.add(memory.id);
    result.push(memory);
  }
  return result;
}

function normalizeMemoryText(value: string): string {
  return value.trim().replaceAll(/\s+/g, ' ').toLowerCase();
}

function hashText(value: string): string {
  return createHash('sha256').update(normalizeMemoryText(value)).digest('hex');
}

function truncate(value: string, maxLength: number): string {
  const normalized = value.trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return normalized.slice(0, maxLength);
}
