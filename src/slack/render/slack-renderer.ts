import { markdownToBlocks, splitBlocksWithText } from 'markdown-to-slack-blocks';

import { env } from '~/env/server.js';
import type { AppLogger } from '~/logger/index.js';
import type { ClaudeUiState } from '~/schemas/claude/publish-state.js';

import type { SlackBlock, SlackMrkdwnTextObject, SlackWebClientLike } from '../types.js';
import type { SlackStatusProbe } from './status-probe.js';

const DEFAULT_LOADING_MESSAGES = [
  'Reading the thread context...',
  'Planning the next steps...',
  'Generating a response...',
] as const;

const DEFAULT_PROGRESS_STATUS = 'Working on your request...';

export class SlackRenderer {
  constructor(
    private readonly logger: AppLogger,
    private readonly statusProbe?: SlackStatusProbe,
  ) {}

  async addAcknowledgementReaction(
    client: SlackWebClientLike,
    channelId: string,
    messageTs: string,
  ): Promise<void> {
    await client.reactions.add({
      channel: channelId,
      timestamp: messageTs,
      name: env.SLACK_REACTION_NAME,
    });

    this.logger.debug('Added acknowledgement reaction to message %s', messageTs);
  }

  async showThinkingIndicator(
    client: SlackWebClientLike,
    channelId: string,
    threadTs: string,
    loadingMessages: readonly string[] = DEFAULT_LOADING_MESSAGES,
  ): Promise<void> {
    await this.setUiState(client, channelId, {
      threadTs,
      status: 'Thinking...',
      loadingMessages: [...loadingMessages],
      clear: false,
    });
  }

  async setUiState(
    client: SlackWebClientLike,
    channelId: string,
    state: ClaudeUiState,
  ): Promise<void> {
    if (state.clear) {
      await this.clearUiState(client, channelId, state.threadTs);
      return;
    }

    await client.assistant.threads.setStatus({
      channel_id: channelId,
      thread_ts: state.threadTs,
      status: state.status ?? '',
      ...(state.loadingMessages ? { loading_messages: state.loadingMessages } : {}),
    });
    await this.statusProbe?.recordStatus({
      channelId,
      clear: false,
      kind: 'status',
      ...(state.loadingMessages ? { loadingMessages: [...state.loadingMessages] } : {}),
      recordedAt: new Date().toISOString(),
      status: state.status ?? '',
      threadTs: state.threadTs,
    });
  }

  async clearUiState(
    client: SlackWebClientLike,
    channelId: string,
    threadTs: string,
  ): Promise<void> {
    await client.assistant.threads.setStatus({
      channel_id: channelId,
      thread_ts: threadTs,
      status: '',
    });
    await this.statusProbe?.recordStatus({
      channelId,
      clear: true,
      kind: 'status',
      recordedAt: new Date().toISOString(),
      status: '',
      threadTs,
    });
  }

  async upsertThreadProgressMessage(
    client: SlackWebClientLike,
    channelId: string,
    threadTs: string,
    state: ClaudeUiState,
    progressMessageTs?: string,
  ): Promise<string | undefined> {
    if (state.clear) {
      if (progressMessageTs) {
        await this.deleteThreadProgressMessage(client, channelId, threadTs, progressMessageTs);
      }
      return undefined;
    }

    const text = this.buildProgressMessageText(state);
    const blocks = this.buildProgressMessageBlocks(state);

    if (progressMessageTs) {
      await client.chat.update({
        channel: channelId,
        ts: progressMessageTs,
        text,
        blocks,
      });
      await this.statusProbe?.recordProgressMessage({
        action: 'update',
        channelId,
        kind: 'progress-message',
        messageTs: progressMessageTs,
        recordedAt: new Date().toISOString(),
        text,
        threadTs,
      });
      return progressMessageTs;
    }

    const response = await client.chat.postMessage({
      channel: channelId,
      thread_ts: threadTs,
      text,
      blocks,
    });

    await this.statusProbe?.recordProgressMessage({
      action: 'post',
      channelId,
      kind: 'progress-message',
      ...(response.ts ? { messageTs: response.ts } : {}),
      recordedAt: new Date().toISOString(),
      text,
      threadTs,
    });

    return response.ts;
  }

  async deleteThreadProgressMessage(
    client: SlackWebClientLike,
    channelId: string,
    threadTs: string,
    progressMessageTs: string,
  ): Promise<void> {
    await client.chat.delete({
      channel: channelId,
      ts: progressMessageTs,
    });
    await this.statusProbe?.recordProgressMessage({
      action: 'delete',
      channelId,
      kind: 'progress-message',
      messageTs: progressMessageTs,
      recordedAt: new Date().toISOString(),
      threadTs,
    });
  }

  async finalizeThreadProgressMessage(
    client: SlackWebClientLike,
    channelId: string,
    threadTs: string,
    progressMessageTs: string,
    toolActivity?: readonly string[],
  ): Promise<void> {
    const summaryItems = (toolActivity ?? []).map((entry) => entry.replace(/\.{3}$/, '')).slice(-5);
    const summaryLine = summaryItems.length > 0 ? summaryItems.join(' · ') : 'Done';
    const text = `\u2705 ${summaryLine}`;
    const blocks: SlackBlock[] = [
      {
        type: 'context',
        elements: [{ type: 'mrkdwn', text }],
      },
    ];

    await client.chat.update({
      channel: channelId,
      ts: progressMessageTs,
      text,
      blocks,
    });
    await this.statusProbe?.recordProgressMessage({
      action: 'finalize',
      channelId,
      kind: 'progress-message',
      messageTs: progressMessageTs,
      recordedAt: new Date().toISOString(),
      text,
      threadTs,
    });
  }

  async postThreadReply(
    client: SlackWebClientLike,
    channelId: string,
    threadTs: string,
    text: string,
    options?: { workspaceLabel?: string },
  ): Promise<string | undefined> {
    if (!text.trim()) {
      return undefined;
    }

    const blocks = markdownToBlocks(normalizeUnderscoreEmphasis(text), {
      preferSectionBlocks: false,
    });
    const batches = splitBlocksWithText(blocks);

    if (options?.workspaceLabel && batches.length > 0) {
      const first = batches[0]!;
      first.blocks = [
        {
          type: 'context',
          elements: [{ type: 'mrkdwn', text: `_Working in ${options.workspaceLabel}_` }],
        },
        ...(first.blocks ?? []),
      ];
    }

    let lastTs: string | undefined;
    for (const batch of batches) {
      const response = await client.chat.postMessage({
        channel: channelId,
        thread_ts: threadTs,
        text: batch.text,
        blocks: batch.blocks,
      });
      lastTs = response.ts;
    }

    return lastTs;
  }

  private buildProgressMessageText(state: ClaudeUiState): string {
    const status = (state.status ?? '').trim() || DEFAULT_PROGRESS_STATUS;
    const detail = this.collectRecentProgressDetails(state.loadingMessages, 1).at(0);

    return detail && detail !== status ? `${status} — ${detail}` : status;
  }

  private buildProgressMessageBlocks(state: ClaudeUiState): SlackBlock[] {
    const status = this.buildProgressStatusLine(state.status);
    const contextElements = this.buildProgressContextElements(state.loadingMessages, status);

    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: status,
        },
      },
      ...(contextElements.length > 0
        ? [
            {
              type: 'context' as const,
              elements: contextElements,
            },
          ]
        : []),
    ];
  }

  private buildProgressStatusLine(status: string | undefined): string {
    const normalized = status?.trim();
    if (!normalized) {
      return DEFAULT_PROGRESS_STATUS;
    }

    return normalized.endsWith('...') ? normalized : `${normalized}`;
  }

  private buildProgressContextElements(
    loadingMessages: readonly string[] | undefined,
    status: string,
  ): SlackMrkdwnTextObject[] {
    const details = this.collectRecentProgressDetails(loadingMessages, 3).filter(
      (detail) => detail !== status,
    );

    return details.slice(-2).map((detail) => ({
      type: 'mrkdwn',
      text: detail,
    }));
  }

  private collectRecentProgressDetails(
    loadingMessages: readonly string[] | undefined,
    maxItems: number,
  ): string[] {
    const deduped: string[] = [];
    const seen = new Set<string>();

    for (const rawMessage of [...(loadingMessages ?? [])].reverse()) {
      const message = rawMessage.trim();
      if (!message || seen.has(message)) {
        continue;
      }

      seen.add(message);
      deduped.unshift(message);

      if (deduped.length >= maxItems) {
        break;
      }
    }

    return deduped;
  }
}

const FENCED_CODE_BLOCK = /^(`{3}|~{3})[^\n]*\n.+?\n\1/gms;
const INLINE_CODE = /`[^\n`]+`/g;
const UNDERSCORE_EMPHASIS = /\b_([^\n_]+)_\b/g;

export function normalizeUnderscoreEmphasis(markdown: string): string {
  const codeRanges: Array<[number, number]> = [];
  for (const match of markdown.matchAll(FENCED_CODE_BLOCK)) {
    codeRanges.push([match.index, match.index + match[0].length]);
  }
  for (const match of markdown.matchAll(INLINE_CODE)) {
    codeRanges.push([match.index, match.index + match[0].length]);
  }

  return markdown.replaceAll(UNDERSCORE_EMPHASIS, (full, inner, offset) => {
    if (codeRanges.some(([start, end]) => offset >= start && offset < end)) {
      return full;
    }
    return `*${inner}*`;
  });
}
