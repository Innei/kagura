import {
  type SaveMemoryToolInput,
  SaveMemoryToolInputSchema,
} from '~/schemas/claude/memory-tools.js';

export const SAVE_MEMORY_TOOL_NAME = 'save_memory';
export const SAVE_MEMORY_TOOL_DESCRIPTION =
  'Persist an important memory for future sessions. Use "global" scope for user preferences and cross-workspace knowledge, "workspace" scope for project-specific decisions. IMPORTANT: Always save a conversation summary before ending a conversation.';

export function parseSaveMemoryToolInput(input: unknown): SaveMemoryToolInput {
  return SaveMemoryToolInputSchema.parse(input);
}
