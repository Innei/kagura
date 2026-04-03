import { type SlackMessage, SlackMessageSchema } from '../../schemas/slack/message.js';

export interface NormalizedThreadMessage {
  authorId: string | null;
  rawText: string;
  text: string;
  threadTs: string;
  ts: string;
}

export function normalizeThreadMessages(messages: unknown[]): NormalizedThreadMessage[] {
  return messages.flatMap((message) => {
    const parsed = SlackMessageSchema.safeParse(message);

    if (!parsed.success) {
      return [];
    }

    const normalized = normalizeThreadMessage(parsed.data);
    return normalized.text ? [normalized] : [];
  });
}

export function normalizeThreadMessage(message: SlackMessage): NormalizedThreadMessage {
  const threadTs = message.thread_ts ?? message.ts;
  const blockText = extractTextFromBlocks(message);
  const rawText = [message.text, blockText].filter(Boolean).join('\n').trim();

  return {
    ts: message.ts,
    threadTs,
    authorId: message.user ?? message.bot_id ?? null,
    text: dedupeLines(rawText),
    rawText,
  };
}

function extractTextFromBlocks(message: SlackMessage): string {
  const segments: string[] = [];

  for (const block of message.blocks ?? []) {
    if (block.type !== 'section') {
      continue;
    }

    const sectionBlock = block as {
      text?: {
        text?: string;
      };
      fields?: Array<{
        text?: string;
      }>;
    };

    if (sectionBlock.text?.text) {
      segments.push(sectionBlock.text.text);
    }

    for (const field of sectionBlock.fields ?? []) {
      if (field.text) {
        segments.push(field.text);
      }
    }
  }

  return segments.join('\n').trim();
}

function dedupeLines(value: string): string {
  const lines = value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return [...new Set(lines)].join('\n');
}
