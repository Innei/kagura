export interface SlackReactionsApi {
  add: (args: { channel: string; timestamp: string; name: string }) => Promise<unknown>;
  remove: (args: { channel: string; timestamp: string; name: string }) => Promise<unknown>;
}

export interface SlackAssistantThreadsApi {
  setStatus: (args: {
    channel_id: string;
    thread_ts: string;
    status: string;
    loading_messages?: string[];
    composing?: boolean;
  }) => Promise<unknown>;
  setSuggestedPrompts?: (args: {
    channel_id: string;
    thread_ts: string;
    title: string;
    prompts: Array<{ title: string; message: string }>;
  }) => Promise<unknown>;
  setTitle?: (args: {
    channel_id: string;
    thread_ts: string;
    title: string;
  }) => Promise<unknown>;
}

export interface SlackAssistantApi {
  threads: SlackAssistantThreadsApi;
}

export interface SlackAuthApi {
  test: () => Promise<{
    user_id?: string;
  }>;
}

export interface SlackConversationsApi {
  replies: (args: {
    channel: string;
    ts: string;
    inclusive?: boolean;
    limit?: number;
  }) => Promise<{ messages?: unknown[] }>;
}

export interface SlackMrkdwnTextObject {
  text: string;
  type: 'mrkdwn';
}

export interface SlackPlainTextObject {
  emoji?: boolean;
  text: string;
  type: 'plain_text';
}

export type SlackTextObject = SlackMrkdwnTextObject | SlackPlainTextObject;

export interface SlackSectionBlock {
  fields?: SlackTextObject[];
  text?: SlackTextObject;
  type: 'section';
}

export interface SlackContextBlock {
  elements: SlackTextObject[];
  type: 'context';
}

export interface SlackHeaderBlock {
  text: SlackPlainTextObject;
  type: 'header';
}

export interface SlackDividerBlock {
  type: 'divider';
}

export interface SlackRichTextBlock {
  elements: unknown[];
  type: 'rich_text';
}

export interface SlackButtonElement {
  action_id: string;
  style?: 'danger' | 'primary';
  text: SlackPlainTextObject;
  type: 'button';
  value?: string;
}

export interface SlackActionsBlock {
  block_id?: string;
  elements: SlackButtonElement[];
  type: 'actions';
}

export interface SlackImageBlock {
  alt_text?: string;
  slack_file?: { id: string };
  image_url?: string;
  type: 'image';
}

export interface SlackDataTableBlock {
  columns: Array<{ name: string; title?: string; type?: string }>;
  rows: Array<Record<string, string | number | boolean>>;
  type: 'data_table';
  [key: string]: unknown;
}

export interface SlackChartBlock {
  chart_type: 'bar' | 'line' | 'pie' | string;
  data: unknown;
  title?: string;
  type: 'chart';
  [key: string]: unknown;
}

export interface SlackCardBlock {
  elements: SlackBlock[];
  title?: string;
  type: 'card';
  [key: string]: unknown;
}

export interface SlackAlertBlock {
  level: 'info' | 'warning' | 'error' | 'success';
  text: string;
  title?: string;
  type: 'alert';
  [key: string]: unknown;
}

export interface SlackCarouselBlock {
  items: Array<SlackSectionBlock | SlackImageBlock>;
  type: 'carousel';
  [key: string]: unknown;
}

export type SlackBlock =
  | SlackActionsBlock
  | SlackAlertBlock
  | SlackCardBlock
  | SlackCarouselBlock
  | SlackChartBlock
  | SlackContextBlock
  | SlackDataTableBlock
  | SlackDividerBlock
  | SlackHeaderBlock
  | SlackImageBlock
  | SlackRichTextBlock
  | SlackSectionBlock;

export interface SlackFilesUploadV2Response {
  file?: { id?: string };
  files?: Array<{ id?: string }>;
}

export interface SlackFilesApi {
  uploadV2: (args: {
    alt_text?: string;
    channel_id: string;
    file: Buffer;
    filename: string;
    thread_ts: string;
    title?: string;
  }) => Promise<SlackFilesUploadV2Response>;
}

export interface SlackChatApi {
  delete: (args: { channel: string; ts: string }) => Promise<unknown>;
  postEphemeral?: (args: {
    channel: string;
    text: string;
    thread_ts?: string;
    user: string;
  }) => Promise<unknown>;
  postMessage: (args: {
    blocks?: unknown[];
    channel: string;
    text: string;
    thread_ts?: string;
  }) => Promise<{ ts?: string }>;
  update: (args: {
    blocks?: unknown[];
    channel: string;
    text: string;
    ts: string;
  }) => Promise<unknown>;
}

export interface SlackViewsApi {
  open: (args: { trigger_id: string; view: unknown }) => Promise<unknown>;
  publish: (args: { user_id: string; view: unknown }) => Promise<unknown>;
}

export interface SlackWebClientLike {
  assistant: SlackAssistantApi;
  auth?: SlackAuthApi;
  chat: SlackChatApi;
  conversations: SlackConversationsApi;
  files: SlackFilesApi;
  reactions: SlackReactionsApi;
  views: SlackViewsApi;
}
