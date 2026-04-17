import { describe, expect, it, vi } from 'vitest';

import type { AppLogger } from '~/logger/index.js';
import {
  createAlertBlock,
  createCardBlock,
  createCarouselBlock,
  createChartBlock,
  createDataTableBlock,
} from '~/slack/render/blocks/index.js';
import { SlackRenderer } from '~/slack/render/slack-renderer.js';
import type { SlackBlock, SlackWebClientLike } from '~/slack/types.js';

function createTestLogger(): AppLogger {
  const logger = {
    debug: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    info: vi.fn(),
    trace: vi.fn(),
    warn: vi.fn(),
    withTag: vi.fn(),
  };
  logger.withTag.mockReturnValue(logger);
  return logger as unknown as AppLogger;
}

function createClientFixture(): {
  client: SlackWebClientLike;
  postCalls: Array<Parameters<SlackWebClientLike['chat']['postMessage']>[0]>;
} {
  const postCalls: Array<Parameters<SlackWebClientLike['chat']['postMessage']>[0]> = [];

  const client: SlackWebClientLike = {
    assistant: { threads: { setStatus: vi.fn().mockResolvedValue({}) } },
    chat: {
      delete: vi.fn().mockResolvedValue({}),
      postMessage: vi.fn().mockImplementation(async (args) => {
        postCalls.push(args);
        return { ts: 'post-ts' };
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    conversations: { replies: vi.fn().mockResolvedValue({ messages: [] }) },
    files: { uploadV2: vi.fn() },
    reactions: {
      add: vi.fn().mockResolvedValue({}),
      remove: vi.fn().mockResolvedValue({}),
    },
    views: {
      open: vi.fn().mockResolvedValue({}),
      publish: vi.fn().mockResolvedValue({}),
    },
  };

  return { client, postCalls };
}

describe('Block factories', () => {
  it('createDataTableBlock produces correct shape', () => {
    const block = createDataTableBlock(
      [{ name: 'col_a', title: 'Column A' }],
      [{ col_a: 'value' }],
    );
    expect(block.type).toBe('data_table');
    expect(block.columns).toEqual([{ name: 'col_a', title: 'Column A' }]);
    expect(block.rows).toEqual([{ col_a: 'value' }]);
  });

  it('createChartBlock produces correct shape', () => {
    const data = [{ x: 1, y: 2 }];
    const block = createChartBlock('bar', data, { title: 'Usage' });
    expect(block.type).toBe('chart');
    expect(block.chart_type).toBe('bar');
    expect(block.data).toEqual(data);
    expect(block.title).toBe('Usage');
  });

  it('createCardBlock produces correct shape', () => {
    const elements: SlackBlock[] = [{ type: 'section', text: { type: 'mrkdwn', text: 'hi' } }];
    const block = createCardBlock(elements, { title: 'Summary' });
    expect(block.type).toBe('card');
    expect(block.title).toBe('Summary');
    expect(block.elements).toEqual(elements);
  });

  it('createAlertBlock produces correct shape', () => {
    const block = createAlertBlock('warning', 'Disk full', { title: 'Alert' });
    expect(block.type).toBe('alert');
    expect(block.level).toBe('warning');
    expect(block.text).toBe('Disk full');
    expect(block.title).toBe('Alert');
  });

  it('createCarouselBlock produces correct shape', () => {
    const items = [
      { type: 'section' as const, text: { type: 'mrkdwn' as const, text: 'slide 1' } },
    ];
    const block = createCarouselBlock(items);
    expect(block.type).toBe('carousel');
    expect(block.items).toEqual(items);
  });
});

describe('SlackRenderer.postStructuredReply', () => {
  it('sends blocks in a single message when under the limit', async () => {
    const { client, postCalls } = createClientFixture();
    const renderer = new SlackRenderer(createTestLogger());

    const blocks: SlackBlock[] = [
      { type: 'section', text: { type: 'mrkdwn', text: 'Hello' } },
      { type: 'divider' },
    ];
    await renderer.postStructuredReply(client, 'C123', 'ts1', blocks, { fallbackText: 'Hi' });

    expect(postCalls).toHaveLength(1);
    expect(postCalls[0]!.channel).toBe('C123');
    expect(postCalls[0]!.thread_ts).toBe('ts1');
    expect(postCalls[0]!.text).toBe('Hi');
    expect(postCalls[0]!.blocks).toEqual(blocks);
  });

  it('prefixes workspaceLabel and toolHistory as context blocks', async () => {
    const { client, postCalls } = createClientFixture();
    const renderer = new SlackRenderer(createTestLogger());

    const blocks: SlackBlock[] = [{ type: 'section', text: { type: 'mrkdwn', text: 'Hello' } }];
    const toolHistory = new Map([['Read', 2]]);
    await renderer.postStructuredReply(client, 'C123', 'ts1', blocks, {
      fallbackText: 'Hi',
      workspaceLabel: 'my-repo',
      toolHistory,
    });

    expect(postCalls).toHaveLength(1);
    const sentBlocks = postCalls[0]!.blocks as SlackBlock[];
    expect(sentBlocks[0]).toEqual({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: '_Working in my-repo_' }],
    });
    expect(sentBlocks[1]).toEqual({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: 'Read x2' }],
    });
    expect(sentBlocks[2]).toEqual(blocks[0]);
  });

  it('splits blocks across multiple messages when exceeding 50 blocks', async () => {
    const { client, postCalls } = createClientFixture();
    const renderer = new SlackRenderer(createTestLogger());

    const blocks: SlackBlock[] = Array.from({ length: 55 }, (_, i) => ({
      type: 'section' as const,
      text: { type: 'mrkdwn' as const, text: `Block ${i}` },
    }));
    await renderer.postStructuredReply(client, 'C123', 'ts1', blocks);

    expect(postCalls).toHaveLength(2);
    expect((postCalls[0]!.blocks as SlackBlock[]).length).toBe(50);
    expect((postCalls[1]!.blocks as SlackBlock[]).length).toBe(5);
    expect(postCalls[0]!.text).toBe('Structured message (1/2)');
    expect(postCalls[1]!.text).toBe('Structured message (2/2)');
  });

  it('returns undefined for empty blocks', async () => {
    const { client } = createClientFixture();
    const renderer = new SlackRenderer(createTestLogger());

    const result = await renderer.postStructuredReply(client, 'C123', 'ts1', []);
    expect(result).toBeUndefined();
  });
});

describe('SlackRenderer convenience methods', () => {
  it('postDataTable delegates to postStructuredReply', async () => {
    const { client, postCalls } = createClientFixture();
    const renderer = new SlackRenderer(createTestLogger());

    await renderer.postDataTable(client, 'C123', 'ts1', [{ name: 'A' }], [{ A: 1 }]);

    expect(postCalls).toHaveLength(1);
    const blocks = postCalls[0]!.blocks as SlackBlock[];
    expect(blocks[0]).toMatchObject({ type: 'data_table', columns: [{ name: 'A' }], rows: [{ A: 1 }] });
  });

  it('postChart delegates to postStructuredReply', async () => {
    const { client, postCalls } = createClientFixture();
    const renderer = new SlackRenderer(createTestLogger());

    await renderer.postChart(client, 'C123', 'ts1', 'line', [{ x: 1 }], { title: 'T' });

    expect(postCalls).toHaveLength(1);
    const blocks = postCalls[0]!.blocks as SlackBlock[];
    expect(blocks[0]).toMatchObject({ type: 'chart', chart_type: 'line', title: 'T' });
  });

  it('postCard delegates to postStructuredReply', async () => {
    const { client, postCalls } = createClientFixture();
    const renderer = new SlackRenderer(createTestLogger());

    const elements: SlackBlock[] = [{ type: 'section', text: { type: 'mrkdwn', text: 'body' } }];
    await renderer.postCard(client, 'C123', 'ts1', elements, { title: 'Card Title' });

    expect(postCalls).toHaveLength(1);
    const blocks = postCalls[0]!.blocks as SlackBlock[];
    expect(blocks[0]).toMatchObject({ type: 'card', title: 'Card Title', elements });
  });

  it('postAlert delegates to postStructuredReply', async () => {
    const { client, postCalls } = createClientFixture();
    const renderer = new SlackRenderer(createTestLogger());

    await renderer.postAlert(client, 'C123', 'ts1', 'error', 'Oops', { title: 'Err' });

    expect(postCalls).toHaveLength(1);
    const blocks = postCalls[0]!.blocks as SlackBlock[];
    expect(blocks[0]).toMatchObject({ type: 'alert', level: 'error', text: 'Oops', title: 'Err' });
  });

  it('postCarousel delegates to postStructuredReply', async () => {
    const { client, postCalls } = createClientFixture();
    const renderer = new SlackRenderer(createTestLogger());

    const items = [{ type: 'section' as const, text: { type: 'mrkdwn' as const, text: 's1' } }];
    await renderer.postCarousel(client, 'C123', 'ts1', items);

    expect(postCalls).toHaveLength(1);
    const blocks = postCalls[0]!.blocks as SlackBlock[];
    expect(blocks[0]).toMatchObject({ type: 'carousel', items });
  });
});
