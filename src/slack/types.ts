export interface SlackReactionsApi {
  add: (args: { channel: string; timestamp: string; name: string }) => Promise<unknown>;
}

export interface SlackAssistantThreadsApi {
  setStatus: (args: {
    channel_id: string;
    thread_ts: string;
    status: string;
    loading_messages?: string[];
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
  text: SlackTextObject;
  type: 'section';
}

export interface SlackContextBlock {
  elements: SlackMrkdwnTextObject[];
  type: 'context';
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

export type SlackBlock = SlackActionsBlock | SlackContextBlock | SlackSectionBlock;

export interface SlackChatApi {
  delete: (args: { channel: string; ts: string }) => Promise<unknown>;
  postMessage: (args: {
    blocks?: unknown[];
    channel: string;
    text: string;
    thread_ts?: string;
  }) => Promise<{ ts?: string }>;
  update: (args: {
    blocks?: SlackBlock[];
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
  reactions: SlackReactionsApi;
  views: SlackViewsApi;
}
