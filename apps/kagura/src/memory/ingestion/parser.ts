import { MEMORY_CATEGORIES, type MemoryCategory, type MemoryScope } from '../types.js';
import type { ParsedMemoryCandidate } from './types.js';

const MEMORY_CATEGORY_SET = new Set<string>(MEMORY_CATEGORIES);
const MEMORY_SCOPE_SET = new Set<string>(['global', 'workspace']);

export function parseMemoryIngestionCandidates(raw: string): ParsedMemoryCandidate[] {
  const parsed = JSON.parse(raw) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('memory ingestion response must be a JSON object');
  }

  const candidates = parsed.candidates;
  if (!Array.isArray(candidates)) {
    throw new Error('memory ingestion response must include candidates array');
  }

  return candidates.map((candidate, index) => parseCandidate(candidate, index));
}

function parseCandidate(candidate: unknown, index: number): ParsedMemoryCandidate {
  if (!isRecord(candidate)) {
    throw new Error(`candidate ${index} must be an object`);
  }

  const action = candidate.action;
  if (action !== 'save' && action !== 'skip') {
    throw new Error(`candidate ${index} action must be save or skip`);
  }

  const category = parseOptionalCategory(candidate.category, index);
  const scope = parseOptionalScope(candidate.scope, index);
  const content = parseOptionalString(candidate.content);
  const reason = parseOptionalString(candidate.reason);
  const expiresAt = parseOptionalString(candidate.expiresAt);
  const confidence = parseOptionalNumber(candidate.confidence, index);

  return {
    action,
    ...(category ? { category } : {}),
    ...(scope ? { scope } : {}),
    ...(content ? { content } : {}),
    ...(reason ? { reason } : {}),
    ...(expiresAt ? { expiresAt } : {}),
    ...(confidence !== undefined ? { confidence } : {}),
  };
}

function parseOptionalCategory(value: unknown, index: number): MemoryCategory | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string' || !MEMORY_CATEGORY_SET.has(value)) {
    throw new Error(`candidate ${index} category is invalid`);
  }
  return value as MemoryCategory;
}

function parseOptionalScope(value: unknown, index: number): MemoryScope | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string' || !MEMORY_SCOPE_SET.has(value)) {
    throw new Error(`candidate ${index} scope is invalid`);
  }
  return value as MemoryScope;
}

function parseOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseOptionalNumber(value: unknown, index: number): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`candidate ${index} confidence is invalid`);
  }
  return Math.max(0, Math.min(1, value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
