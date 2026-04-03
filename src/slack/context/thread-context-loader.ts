import type { AppLogger } from '../../logger/index.js';
import type { SlackWebClientLike } from '../types.js';
import { type NormalizedThreadMessage, normalizeThreadMessages } from './message-normalizer.js';

export interface NormalizedThreadContext {
  channelId: string;
  messages: NormalizedThreadMessage[];
  renderedPrompt: string;
  threadTs: string;
}

export class SlackThreadContextLoader {
  constructor(private readonly logger: AppLogger) {}

  async loadThread(
    client: SlackWebClientLike,
    channelId: string,
    threadTs: string,
  ): Promise<NormalizedThreadContext> {
    const response = await client.conversations.replies({
      channel: channelId,
      ts: threadTs,
      inclusive: true,
      limit: 200,
    });

    const messages = normalizeThreadMessages(response.messages ?? []);
    this.logger.debug(
      'Loaded %d normalized Slack messages for thread %s',
      messages.length,
      threadTs,
    );

    return {
      channelId,
      threadTs,
      messages,
      renderedPrompt: renderThreadPrompt(messages),
    };
  }
}

function renderThreadPrompt(messages: NormalizedThreadMessage[]): string {
  const filtered = messages.filter((message) => message.text.trim() !== '');
  const renderedLines = filtered.flatMap((message, index) => {
    const header = `Message ${index + 1} | ts=${message.ts} | author=${message.authorId ?? 'unknown'}`;
    return [header, message.text];
  });

  return ['Slack thread context:', ...renderedLines].join('\n');
}
