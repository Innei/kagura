import type {
  SlackAlertBlock,
  SlackBlock,
  SlackCardBlock,
  SlackCarouselBlock,
  SlackChartBlock,
  SlackDataTableBlock,
} from '~/slack/types.js';

export function createDataTableBlock(
  columns: SlackDataTableBlock['columns'],
  rows: SlackDataTableBlock['rows'],
): SlackDataTableBlock {
  return {
    type: 'data_table',
    columns,
    rows,
  };
}

export function createChartBlock(
  chartType: SlackChartBlock['chart_type'],
  data: SlackChartBlock['data'],
  options?: {
    title?: string;
  },
): SlackChartBlock {
  return {
    type: 'chart',
    chart_type: chartType,
    data,
    ...(options?.title ? { title: options.title } : {}),
  };
}

export function createCardBlock(
  elements: SlackBlock[],
  options?: {
    title?: string;
  },
): SlackCardBlock {
  return {
    type: 'card',
    elements,
    ...(options?.title ? { title: options.title } : {}),
  };
}

export function createAlertBlock(
  level: SlackAlertBlock['level'],
  text: string,
  options?: {
    title?: string;
  },
): SlackAlertBlock {
  return {
    type: 'alert',
    level,
    text,
    ...(options?.title ? { title: options.title } : {}),
  };
}

export function createCarouselBlock(
  items: SlackCarouselBlock['items'],
): SlackCarouselBlock {
  return {
    type: 'carousel',
    items,
  };
}
