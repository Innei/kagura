import type { AppLogger } from '~/logger/index.js';

import type { SlackActionsBlock, SlackSectionBlock, SlackWebClientLike } from '../types.js';

export const PERMISSION_APPROVE_ACTION_ID = 'permission_approve_action';
export const PERMISSION_DENY_ACTION_ID = 'permission_deny_action';

export interface SlackPermissionRequest {
  channelId: string;
  description?: string | undefined;
  input?: Record<string, unknown> | undefined;
  signal?: AbortSignal | undefined;
  threadTs: string;
  toolName: string;
}

export interface SlackPermissionResponse {
  allowed: boolean;
}

interface PendingSlackPermissionRequest {
  channelId: string;
  messageTs: string;
  reject: (reason?: unknown) => void;
  resolve: (value: SlackPermissionResponse) => void;
  threadTs: string;
  toolName: string;
}

interface PermissionActionBody {
  channel?: { id?: string };
  message?: { ts?: string; thread_ts?: string };
  user?: { id?: string };
}

export class SlackPermissionBridge {
  private readonly pendingByMessageTs = new Map<string, PendingSlackPermissionRequest>();
  private readonly pendingMessageByThread = new Map<string, string>();

  constructor(private readonly logger: AppLogger) {}

  hasPending(threadTs: string): boolean {
    return this.pendingMessageByThread.has(threadTs);
  }

  async requestPermission(
    client: SlackWebClientLike,
    request: SlackPermissionRequest,
  ): Promise<SlackPermissionResponse> {
    const existingMessageTs = this.pendingMessageByThread.get(request.threadTs);
    if (existingMessageTs) {
      throw new Error(`Thread ${request.threadTs} is already waiting for permission.`);
    }

    const text = buildPermissionRequestText(request);
    const response = await client.chat.postMessage({
      blocks: buildPermissionRequestBlocks(request),
      channel: request.channelId,
      text,
      thread_ts: request.threadTs,
    });

    const messageTs = response.ts?.trim();
    if (!messageTs) {
      throw new Error('Slack did not return a ts for the permission request message.');
    }

    if (request.signal?.aborted) {
      await this.updateResolvedMessage(client, {
        actionUserId: undefined,
        allowed: false,
        channelId: request.channelId,
        messageTs,
        reason: 'cancelled',
        toolName: request.toolName,
      });
      throw request.signal.reason ?? new Error(`Permission request aborted for ${request.threadTs}`);
    }

    return await new Promise<SlackPermissionResponse>((resolve, reject) => {
      const cleanupAbort = this.attachAbortHandler(client, messageTs, request, reject);
      this.pendingMessageByThread.set(request.threadTs, messageTs);
      this.pendingByMessageTs.set(messageTs, {
        channelId: request.channelId,
        messageTs,
        reject: (reason) => {
          cleanupAbort();
          this.pendingByMessageTs.delete(messageTs);
          this.pendingMessageByThread.delete(request.threadTs);
          reject(reason);
        },
        resolve: (value) => {
          cleanupAbort();
          this.pendingByMessageTs.delete(messageTs);
          this.pendingMessageByThread.delete(request.threadTs);
          resolve(value);
        },
        threadTs: request.threadTs,
        toolName: request.toolName,
      });
    });
  }

  async handleAction(
    client: SlackWebClientLike,
    body: unknown,
    allowed: boolean,
  ): Promise<boolean> {
    const parsed = body as PermissionActionBody;
    const messageTs = parsed.message?.ts?.trim();
    if (!messageTs) {
      return false;
    }

    const pending = this.pendingByMessageTs.get(messageTs);
    if (!pending) {
      return false;
    }

    const actionUserId = parsed.user?.id?.trim();
    await this.updateResolvedMessage(client, {
      actionUserId,
      allowed,
      channelId: pending.channelId,
      messageTs,
      toolName: pending.toolName,
    });

    this.logger.info(
      'Resolved Slack permission request for thread %s tool %s: allowed=%s',
      pending.threadTs,
      pending.toolName,
      String(allowed),
    );
    pending.resolve({ allowed });
    return true;
  }

  private attachAbortHandler(
    client: SlackWebClientLike,
    messageTs: string,
    request: SlackPermissionRequest,
    reject: (reason?: unknown) => void,
  ): () => void {
    if (!request.signal) {
      return () => {};
    }

    const onAbort = () => {
      const pending = this.pendingByMessageTs.get(messageTs);
      if (!pending) {
        return;
      }
      void this.updateResolvedMessage(client, {
        actionUserId: undefined,
        allowed: false,
        channelId: request.channelId,
        messageTs,
        reason: 'cancelled',
        toolName: request.toolName,
      });
      pending.reject(
        request.signal?.reason ?? new Error(`Permission request aborted for ${request.threadTs}`),
      );
    };

    request.signal.addEventListener('abort', onAbort, { once: true });
    return () => request.signal?.removeEventListener('abort', onAbort);
  }

  private async updateResolvedMessage(
    client: SlackWebClientLike,
    input: {
      actionUserId?: string | undefined;
      allowed: boolean;
      channelId: string;
      messageTs: string;
      reason?: 'cancelled' | undefined;
      toolName: string;
    },
  ): Promise<void> {
    const text = buildResolvedPermissionText(input);
    await client.chat.update({
      blocks: buildResolvedPermissionBlocks(input),
      channel: input.channelId,
      text,
      ts: input.messageTs,
    });
  }
}

export function createPermissionActionHandler(
  bridge: SlackPermissionBridge,
  allowed: boolean,
) {
  return async (args: {
    ack: () => Promise<void>;
    body: unknown;
    client: unknown;
  }): Promise<void> => {
    await args.ack();
    await bridge.handleAction(args.client as SlackWebClientLike, args.body, allowed);
  };
}

function buildPermissionRequestText(request: SlackPermissionRequest): string {
  const description = request.description?.trim();
  const preview = formatInputPreview(request.input);
  return [
    '需要你的授权',
    '',
    `Claude 想要使用 ${request.toolName} 工具。`,
    ...(description ? ['', description] : []),
    ...(preview ? ['', preview] : []),
  ].join('\n');
}

function buildPermissionRequestBlocks(request: SlackPermissionRequest): Array<SlackSectionBlock | SlackActionsBlock> {
  const text = buildPermissionRequestText(request);
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text,
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          action_id: PERMISSION_APPROVE_ACTION_ID,
          style: 'primary',
          text: {
            type: 'plain_text',
            text: 'Approve',
            emoji: true,
          },
        },
        {
          type: 'button',
          action_id: PERMISSION_DENY_ACTION_ID,
          style: 'danger',
          text: {
            type: 'plain_text',
            text: 'Deny',
            emoji: true,
          },
        },
      ],
    },
  ];
}

function buildResolvedPermissionText(input: {
  actionUserId?: string | undefined;
  allowed: boolean;
  reason?: 'cancelled' | undefined;
  toolName: string;
}): string {
  if (input.reason === 'cancelled') {
    return `权限请求已取消：${input.toolName}`;
  }

  const actor = input.actionUserId ? ` by <@${input.actionUserId}>` : '';
  return input.allowed
    ? `已批准 ${input.toolName}${actor}`
    : `已拒绝 ${input.toolName}${actor}`;
}

function buildResolvedPermissionBlocks(input: {
  actionUserId?: string | undefined;
  allowed: boolean;
  reason?: 'cancelled' | undefined;
  toolName: string;
}): SlackSectionBlock[] {
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: buildResolvedPermissionText(input),
      },
    },
  ];
}

function formatInputPreview(input: Record<string, unknown> | undefined): string | undefined {
  if (!input || Object.keys(input).length === 0) {
    return undefined;
  }

  const serialized = JSON.stringify(input, null, 2);
  const truncated = serialized.length > 1200 ? `${serialized.slice(0, 1197)}...` : serialized;
  return ['```', truncated, '```'].join('\n');
}
