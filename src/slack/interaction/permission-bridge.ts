import type { AppLogger } from '~/logger/index.js';

export interface PermissionRequest {
  description?: string | undefined;
  input: Record<string, unknown>;
  toolName: string;
}

export interface PermissionDecision {
  allowed: boolean;
}

interface PendingPermissionRequest {
  expectedUserId?: string | undefined;
  reject: (reason?: unknown) => void;
  request: PermissionRequest;
  resolve: (value: PermissionDecision) => void;
}

export class SlackPermissionBridge {
  private readonly pendingByThread = new Map<string, PendingPermissionRequest>();

  constructor(private readonly logger: AppLogger) {}

  hasPending(threadTs: string): boolean {
    return this.pendingByThread.has(threadTs);
  }

  async awaitDecision(params: {
    expectedUserId?: string | undefined;
    request: PermissionRequest;
    signal?: AbortSignal | undefined;
    threadTs: string;
  }): Promise<PermissionDecision> {
    if (this.pendingByThread.has(params.threadTs)) {
      throw new Error(`Thread ${params.threadTs} is already waiting for a permission decision.`);
    }

    if (params.signal?.aborted) {
      throw (
        params.signal.reason ??
        new Error(`Permission request aborted for thread ${params.threadTs}`)
      );
    }

    return await new Promise<PermissionDecision>((resolve, reject) => {
      const cleanupAbort = this.attachAbortHandler(params.threadTs, params.signal, reject);

      this.pendingByThread.set(params.threadTs, {
        expectedUserId: params.expectedUserId,
        request: params.request,
        reject: (reason) => {
          cleanupAbort();
          this.pendingByThread.delete(params.threadTs);
          reject(reason);
        },
        resolve: (value) => {
          cleanupAbort();
          this.pendingByThread.delete(params.threadTs);
          resolve(value);
        },
      });
    });
  }

  submitDecision(params: { allowed: boolean; threadTs: string; userId: string }): {
    feedback?: string;
    handled: boolean;
  } {
    const pending = this.pendingByThread.get(params.threadTs);
    if (!pending) {
      return { handled: false };
    }

    if (pending.expectedUserId && pending.expectedUserId !== params.userId) {
      return {
        handled: true,
        feedback: `只有 <@${pending.expectedUserId}> 可以批准或拒绝此操作。`,
      };
    }

    this.logger.info(
      'Permission decision for thread %s: %s (tool=%s)',
      params.threadTs,
      params.allowed ? 'allowed' : 'denied',
      pending.request.toolName,
    );
    pending.resolve({ allowed: params.allowed });
    return { handled: true };
  }

  private attachAbortHandler(
    threadTs: string,
    signal: AbortSignal | undefined,
    reject: (reason?: unknown) => void,
  ): () => void {
    if (!signal) {
      return () => {};
    }

    const onAbort = () => {
      const pending = this.pendingByThread.get(threadTs);
      if (!pending) {
        return;
      }
      pending.reject(
        signal.reason ?? new Error(`Permission request aborted for thread ${threadTs}`),
      );
    };

    signal.addEventListener('abort', onAbort, { once: true });
    return () => signal.removeEventListener('abort', onAbort);
  }
}

export const PERMISSION_APPROVE_ACTION_ID = 'permission_approve_action';
export const PERMISSION_DENY_ACTION_ID = 'permission_deny_action';

export function formatPermissionRequestMessage(
  request: PermissionRequest,
  options?: {
    description?: string | undefined;
  },
): {
  blocks: Array<Record<string, unknown>>;
  text: string;
} {
  const toolLabel = request.toolName;
  const description = options?.description ?? request.description;
  const inputSummary = summarizeToolInput(request.toolName, request.input);

  const textParts = [
    `*需要你的授权*`,
    '',
    `Claude 想要使用 *${toolLabel}* 工具。`,
    ...(description ? [`> ${description}`] : []),
    ...(inputSummary ? ['', inputSummary] : []),
    '',
    '请选择是否允许此操作：',
  ];

  const text = textParts.join('\n');

  const blocks: Array<Record<string, unknown>> = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: [
          `*需要你的授权*`,
          '',
          `Claude 想要使用 *${toolLabel}* 工具。`,
          ...(description ? [`> ${description}`] : []),
        ].join('\n'),
      },
    },
    ...(inputSummary
      ? [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: inputSummary,
            },
          },
        ]
      : []),
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Approve',
            emoji: true,
          },
          style: 'primary',
          action_id: PERMISSION_APPROVE_ACTION_ID,
          value: 'approve',
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Deny',
            emoji: true,
          },
          style: 'danger',
          action_id: PERMISSION_DENY_ACTION_ID,
          value: 'deny',
        },
      ],
    },
  ];

  return { text, blocks };
}

export function formatPermissionDecisionMessage(
  toolName: string,
  allowed: boolean,
  userId: string,
): {
  blocks: Array<Record<string, unknown>>;
  text: string;
} {
  const icon = allowed ? '\u2705' : '\u274C';
  const action = allowed ? '已批准' : '已拒绝';
  const text = `${icon} <@${userId}> ${action}了 *${toolName}* 的使用请求。`;

  return {
    text,
    blocks: [
      {
        type: 'context',
        elements: [{ type: 'mrkdwn', text }],
      },
    ],
  };
}

function summarizeToolInput(toolName: string, input: Record<string, unknown>): string | undefined {
  const lowerTool = toolName.toLowerCase();

  if (lowerTool === 'bash' && typeof input.command === 'string') {
    return `\`\`\`\n${truncate(input.command, 500)}\n\`\`\``;
  }

  if (lowerTool === 'edit' && typeof input.file_path === 'string') {
    return `File: \`${input.file_path}\``;
  }

  if (lowerTool === 'write' && typeof input.file_path === 'string') {
    return `File: \`${input.file_path}\``;
  }

  if (lowerTool === 'read' && typeof input.file_path === 'string') {
    return `File: \`${input.file_path}\``;
  }

  // Generic: show the first few keys
  const keys = Object.keys(input).slice(0, 3);
  if (keys.length === 0) {
    return undefined;
  }

  const parts = keys.map((key) => {
    const value = input[key];
    if (typeof value === 'string') {
      return `\`${key}\`: ${truncate(value, 100)}`;
    }
    return `\`${key}\`: ${truncate(JSON.stringify(value), 100)}`;
  });

  return parts.join('\n');
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}
