# App Mention Handler Refactoring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decompose the 906-line `src/slack/ingress/app-mention-handler.ts` into focused modules with a pipeline-based orchestration pattern, making every piece independently unit-testable.

**Architecture:** Extract 6 concern-based modules from the monolithic handler file. Replace the 394-line `handleThreadConversation` with a pipeline runner that executes a sequence of async steps enriching a shared context object. Each step is a standalone function that can be tested in isolation. Backward compatibility is maintained via re-exports.

**Tech Stack:** TypeScript strict mode, ESM, Vitest, Zod (for existing schemas only)

---

### Task 1: Extract shared types to `ingress/types.ts`

**Files:**

- Create: `src/slack/ingress/types.ts`
- Modify: `src/slack/ingress/app-mention-handler.ts`
- **Step 1: Create the types file**

Create `src/slack/ingress/types.ts` with all shared interfaces extracted from the handler:

```typescript
import type { AgentExecutor } from '~/agent/types.js';
import type { ContextMemories } from '~/memory/types.js';
import type { SessionRecord } from '~/session/types.js';
import type { NormalizedThreadContext } from '../context/thread-context-loader.js';
import type { SlackWebClientLike } from '../types.js';
import type { AgentProviderRegistry } from '~/agent/registry.js';
import type { AppLogger } from '~/logger/index.js';
import type { MemoryStore } from '~/memory/types.js';
import type { SessionStore } from '~/session/types.js';
import type { SlackThreadContextLoader } from '../context/thread-context-loader.js';
import type { SlackRenderer } from '../render/slack-renderer.js';
import type { WorkspaceResolver } from '~/workspace/resolver.js';
import type { ResolvedWorkspace } from '~/workspace/types.js';

export interface SlackIngressDependencies {
  claudeExecutor: AgentExecutor;
  logger: AppLogger;
  memoryStore: MemoryStore;
  providerRegistry?: AgentProviderRegistry;
  renderer: SlackRenderer;
  sessionStore: SessionStore;
  threadContextLoader: SlackThreadContextLoader;
  workspaceResolver: WorkspaceResolver;
}

export interface ThreadConversationMessage {
  channel: string;
  team: string;
  text: string;
  thread_ts?: string | undefined;
  ts: string;
  user: string;
}

export interface ThreadConversationOptions {
  addAcknowledgementReaction: boolean;
  forceNewSession?: boolean;
  logLabel: string;
  rootMessageTs: string;
  workspaceOverride?: ResolvedWorkspace;
}

export interface ConversationPipelineContext {
  client: SlackWebClientLike;
  deps: SlackIngressDependencies;
  message: ThreadConversationMessage;
  options: ThreadConversationOptions;
  threadTs: string;

  existingSession?: SessionRecord;
  workspace?: ResolvedWorkspace;
  resumeHandle?: string;
  threadContext?: NormalizedThreadContext;
  contextMemories?: ContextMemories;
}

export type PipelineStepResult = { action: 'continue' } | { action: 'done'; reason: string };

export type PipelineStep = (ctx: ConversationPipelineContext) => Promise<PipelineStepResult>;
```

- **Step 2: Update app-mention-handler.ts to import from types.ts**

In `src/slack/ingress/app-mention-handler.ts`, remove the `SlackIngressDependencies`, `ThreadConversationMessage`, and `ThreadConversationOptions` interface definitions. Replace with imports:

```typescript
import type {
  SlackIngressDependencies,
  ThreadConversationMessage,
  ThreadConversationOptions,
} from './types.js';
```

Add re-exports at the top of the file to preserve the public API:

```typescript
export type { SlackIngressDependencies, ThreadConversationMessage } from './types.js';
```

Also remove these now-unnecessary type imports from the handler file (they were only needed for the interface definitions):

- `AgentProviderRegistry` (if only used in the interface)
- `MemoryStore` (if only used in the interface)
- `SessionStore` (type import — keep the value import if used)
- `WorkspaceResolver` (if only used in the interface)
- `SlackThreadContextLoader` (if only used in the interface)
- `SlackRenderer` (if only used in the interface)

Keep imports that are used in function bodies (e.g., `SessionRecord` for `resolveWorkspaceForConversation`).

- **Step 3: Run tests to verify nothing broke**

Run: `pnpm test`
Expected: All tests pass. No import resolution errors.

- **Step 4: Run typecheck**

Run: `pnpm typecheck`
Expected: No type errors.

- **Step 5: Commit**

```bash
git add src/slack/ingress/types.ts src/slack/ingress/app-mention-handler.ts
git commit -m "refactor: extract shared ingress types to types.ts"
```

---

### Task 2: Extract runtime logging to `logger/runtime.ts`

**Files:**

- Create: `src/logger/runtime.ts`
- Modify: `src/slack/ingress/app-mention-handler.ts`
- **Step 1: Create the runtime logging module**

Create `src/logger/runtime.ts`:

```typescript
import type { AppLogger } from './index.js';

export function runtimeInfo(logger: AppLogger, message: string, ...args: unknown[]): void {
  logger.info(message, ...args);
  console.info(message, ...args);
}

export function runtimeError(logger: AppLogger, message: string, ...args: unknown[]): void {
  logger.error(message, ...args);
  console.error(message, ...args);
}

export function runtimeWarn(logger: AppLogger, message: string, ...args: unknown[]): void {
  logger.warn(message, ...args);
  console.warn(message, ...args);
}
```

- **Step 2: Update app-mention-handler.ts**

Remove the three `runtimeInfo`, `runtimeError`, `runtimeWarn` function definitions from the handler file (lines 671-684). Replace with:

```typescript
import { runtimeError, runtimeInfo, runtimeWarn } from '~/logger/runtime.js';
```

- **Step 3: Run tests**

Run: `pnpm test`
Expected: All tests pass.

- **Step 4: Commit**

```bash
git add src/logger/runtime.ts src/slack/ingress/app-mention-handler.ts
git commit -m "refactor: extract runtime dual-logging helpers to logger/runtime.ts"
```

---

### Task 3: Extract message filter to `message-filter.ts`

**Files:**

- Create: `src/slack/ingress/message-filter.ts`
- Create: `tests/message-filter.test.ts`
- Modify: `src/slack/ingress/app-mention-handler.ts`
- **Step 1: Write the failing test**

Create `tests/message-filter.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest';

import type { AppLogger } from '~/logger/index.js';
import {
  createBotUserIdResolver,
  shouldSkipBotAuthoredMessage,
  shouldSkipMessageForForeignMention,
} from '~/slack/ingress/message-filter.js';
import type { SlackWebClientLike } from '~/slack/types.js';

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

describe('shouldSkipBotAuthoredMessage', () => {
  it('skips messages with non-bot subtypes', () => {
    const logger = createTestLogger();
    const result = shouldSkipBotAuthoredMessage(
      logger,
      'test',
      'ts1',
      {
        text: 'hello',
        subtype: 'channel_join',
      },
      'U_BOT',
    );
    expect(result).toBe(true);
  });

  it('does not skip human-authored messages', () => {
    const logger = createTestLogger();
    const result = shouldSkipBotAuthoredMessage(
      logger,
      'test',
      'ts1',
      {
        text: 'hello',
        user: 'U_HUMAN',
      },
      'U_BOT',
    );
    expect(result).toBe(false);
  });

  it('skips bot-authored messages that do not mention the bot', () => {
    const logger = createTestLogger();
    const result = shouldSkipBotAuthoredMessage(
      logger,
      'test',
      'ts1',
      {
        text: 'status update',
        user: 'U_BOT',
      },
      'U_BOT',
    );
    expect(result).toBe(true);
  });

  it('allows bot-authored messages that explicitly mention the bot', () => {
    const logger = createTestLogger();
    const result = shouldSkipBotAuthoredMessage(
      logger,
      'test',
      'ts1',
      {
        text: '<@U_BOT> continue please',
        user: 'U_BOT',
      },
      'U_BOT',
    );
    expect(result).toBe(false);
  });
});

describe('shouldSkipMessageForForeignMention', () => {
  it('returns false when message has no mentions', () => {
    const logger = createTestLogger();
    const result = shouldSkipMessageForForeignMention(
      logger,
      'test',
      'ts1',
      'hello world',
      'U_BOT',
    );
    expect(result).toBe(false);
  });

  it('returns false when only the bot is mentioned', () => {
    const logger = createTestLogger();
    const result = shouldSkipMessageForForeignMention(
      logger,
      'test',
      'ts1',
      '<@U_BOT> hello',
      'U_BOT',
    );
    expect(result).toBe(false);
  });

  it('returns true when another user is mentioned', () => {
    const logger = createTestLogger();
    const result = shouldSkipMessageForForeignMention(
      logger,
      'test',
      'ts1',
      'ask <@U456> to review',
      'U_BOT',
    );
    expect(result).toBe(true);
  });

  it('returns false when botUserId is undefined', () => {
    const logger = createTestLogger();
    const result = shouldSkipMessageForForeignMention(
      logger,
      'test',
      'ts1',
      '<@U456> hello',
      undefined,
    );
    expect(result).toBe(false);
  });
});

describe('shouldSkipBotAuthoredMessage edge cases', () => {
  it('skips messages with bot_id but no user field', () => {
    const logger = createTestLogger();
    const result = shouldSkipBotAuthoredMessage(
      logger,
      'test',
      'ts1',
      {
        text: 'automated message',
        bot_id: 'B123',
      },
      'U_BOT',
    );
    expect(result).toBe(true);
  });

  it('does not skip when botUserId is undefined and message has no bot markers', () => {
    const logger = createTestLogger();
    const result = shouldSkipBotAuthoredMessage(
      logger,
      'test',
      'ts1',
      {
        text: 'hello',
        user: 'U_HUMAN',
      },
      undefined,
    );
    expect(result).toBe(false);
  });
});

describe('shouldSkipMessageForForeignMention edge cases', () => {
  it('returns true when multiple users are mentioned and one is foreign', () => {
    const logger = createTestLogger();
    const result = shouldSkipMessageForForeignMention(
      logger,
      'test',
      'ts1',
      '<@U_BOT> and <@U456> please',
      'U_BOT',
    );
    expect(result).toBe(true);
  });
});

describe('createBotUserIdResolver', () => {
  it('resolves and caches the bot user id', async () => {
    const logger = createTestLogger();
    const resolver = createBotUserIdResolver(logger);
    const client = {
      auth: { test: vi.fn().mockResolvedValue({ user_id: 'U_BOT' }) },
    } as unknown as SlackWebClientLike;

    const first = await resolver(client);
    const second = await resolver(client);

    expect(first).toBe('U_BOT');
    expect(second).toBe('U_BOT');
    expect(client.auth!.test).toHaveBeenCalledOnce();
  });

  it('returns undefined when auth.test is not available', async () => {
    const logger = createTestLogger();
    const resolver = createBotUserIdResolver(logger);
    const client = {} as unknown as SlackWebClientLike;

    const result = await resolver(client);
    expect(result).toBeUndefined();
  });
});
```

- **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/message-filter.test.ts`
Expected: FAIL — module `~/slack/ingress/message-filter.js` not found.

- **Step 3: Create the message filter module**

Create `src/slack/ingress/message-filter.ts`:

```typescript
import type { AppLogger } from '~/logger/index.js';
import { runtimeInfo, runtimeWarn } from '~/logger/runtime.js';

import type { SlackWebClientLike } from '../types.js';

const SLACK_USER_MENTION_PATTERN = /<@([\dA-Z]+)>/g;

export function createBotUserIdResolver(
  logger: AppLogger,
): (client: SlackWebClientLike) => Promise<string | undefined> {
  let cachedBotUserId: Promise<string | undefined> | undefined;

  return async (client: SlackWebClientLike): Promise<string | undefined> => {
    if (!cachedBotUserId) {
      cachedBotUserId = resolveBotUserId(client, logger);
    }
    return cachedBotUserId;
  };
}

export function shouldSkipBotAuthoredMessage(
  logger: AppLogger,
  logLabel: string,
  threadTs: string,
  message: {
    bot_id?: string | undefined;
    subtype?: string | undefined;
    text: string;
    user?: string | undefined;
  },
  botUserId: string | undefined,
): boolean {
  if (message.subtype && message.subtype !== 'bot_message') {
    return true;
  }

  const botAuthored =
    Boolean(message.bot_id) || message.subtype === 'bot_message' || message.user === botUserId;
  if (!botAuthored) {
    return false;
  }

  if (mentionsUser(message.text, botUserId)) {
    return false;
  }

  runtimeInfo(
    logger,
    'Skipping %s for thread %s because bot-authored message does not mention this app',
    logLabel,
    threadTs,
  );
  return true;
}

export function shouldSkipMessageForForeignMention(
  logger: AppLogger,
  logLabel: string,
  threadTs: string,
  messageText: string,
  botUserId: string | undefined,
): boolean {
  if (!messageText.includes('<@') || !botUserId) {
    return false;
  }

  const foreignMentionedUserId = getForeignMentionedUserId(messageText, botUserId);
  if (!foreignMentionedUserId) {
    return false;
  }

  runtimeInfo(
    logger,
    'Skipping %s for thread %s because mention targets another user: %s',
    logLabel,
    threadTs,
    foreignMentionedUserId,
  );
  return true;
}

async function resolveBotUserId(
  client: SlackWebClientLike,
  logger: AppLogger,
): Promise<string | undefined> {
  if (!client.auth?.test) {
    runtimeWarn(logger, 'Slack client does not expose auth.test; mention filtering disabled');
    return undefined;
  }

  try {
    const identity = await client.auth.test();
    const botUserId = identity.user_id?.trim();
    if (!botUserId) {
      runtimeWarn(
        logger,
        'Slack auth.test did not return a bot user id; mention filtering disabled',
      );
      return undefined;
    }
    return botUserId;
  } catch (error) {
    runtimeWarn(logger, 'Failed to resolve bot user id for mention filtering: %s', String(error));
    return undefined;
  }
}

function getForeignMentionedUserId(messageText: string, botUserId: string): string | undefined {
  for (const match of messageText.matchAll(SLACK_USER_MENTION_PATTERN)) {
    const mentionedUserId = match[1]?.trim();
    if (mentionedUserId && mentionedUserId !== botUserId) {
      return mentionedUserId;
    }
  }
  return undefined;
}

function mentionsUser(messageText: string, userId: string | undefined): boolean {
  if (!userId) {
    return false;
  }
  return messageText.includes(`<@${userId}>`);
}
```

- **Step 4: Run the new test to verify it passes**

Run: `pnpm test -- tests/message-filter.test.ts`
Expected: All tests PASS.

- **Step 5: Update app-mention-handler.ts to use the new module**

Remove from `app-mention-handler.ts`:

- `SLACK_USER_MENTION_PATTERN` constant
- `createBotUserIdResolver` function
- `resolveBotUserId` function
- `shouldSkipBotAuthoredMessage` function
- `shouldSkipMessageForForeignMention` function
- `getForeignMentionedUserId` function
- `mentionsUser` function

Add import:

```typescript
import {
  createBotUserIdResolver,
  shouldSkipBotAuthoredMessage,
  shouldSkipMessageForForeignMention,
} from './message-filter.js';
```

- **Step 6: Run full test suite**

Run: `pnpm test`
Expected: All tests pass (including existing `thread-reply-ingress.test.ts`).

- **Step 7: Commit**

```bash
git add src/slack/ingress/message-filter.ts tests/message-filter.test.ts src/slack/ingress/app-mention-handler.ts
git commit -m "refactor: extract message filter logic to message-filter.ts"
```

---

### Task 4: Extract workspace resolution to `workspace-resolution.ts`

**Files:**

- Create: `src/slack/ingress/workspace-resolution.ts`
- Create: `tests/workspace-resolution.test.ts`
- Modify: `src/slack/ingress/app-mention-handler.ts`
- **Step 1: Write the failing test**

Create `tests/workspace-resolution.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest';

import type { SessionRecord } from '~/session/types.js';
import {
  buildWorkspaceResolutionBlocks,
  resolveWorkspaceForConversation,
  WORKSPACE_PICKER_ACTION_ID,
} from '~/slack/ingress/workspace-resolution.js';
import type { WorkspaceResolver } from '~/workspace/resolver.js';
import type { ResolvedWorkspace, WorkspaceResolution } from '~/workspace/types.js';

describe('resolveWorkspaceForConversation', () => {
  it('returns the override when provided', () => {
    const override: ResolvedWorkspace = {
      input: '/tmp/repo',
      matchKind: 'repo',
      repo: {
        aliases: [],
        id: 'repo-1',
        label: 'repo-1',
        name: 'repo',
        relativePath: 'repo-1',
        repoPath: '/tmp/repo',
      },
      source: 'manual',
      workspaceLabel: 'repo',
      workspacePath: '/tmp/repo',
    };
    const resolver = { resolveFromText: vi.fn() } as unknown as WorkspaceResolver;

    const result = resolveWorkspaceForConversation('some text', undefined, resolver, override);

    expect(result).toEqual({ status: 'unique', workspace: override });
    expect(resolver.resolveFromText).not.toHaveBeenCalled();
  });

  it('reconstructs workspace from existing session', () => {
    const session: SessionRecord = {
      channelId: 'C123',
      createdAt: new Date().toISOString(),
      rootMessageTs: 'ts1',
      threadTs: 'ts1',
      updatedAt: new Date().toISOString(),
      workspaceLabel: 'my-repo',
      workspacePath: '/tmp/my-repo',
      workspaceRepoId: 'org/my-repo',
      workspaceRepoPath: '/tmp/my-repo',
    };
    const resolver = { resolveFromText: vi.fn() } as unknown as WorkspaceResolver;

    const result = resolveWorkspaceForConversation('text', session, resolver);

    expect(result.status).toBe('unique');
    expect(resolver.resolveFromText).not.toHaveBeenCalled();
  });

  it('falls back to resolver when no session workspace', () => {
    const missing: WorkspaceResolution = { status: 'missing', query: 'hello', reason: 'no match' };
    const resolver = {
      resolveFromText: vi.fn().mockReturnValue(missing),
    } as unknown as WorkspaceResolver;

    const result = resolveWorkspaceForConversation('hello', undefined, resolver);

    expect(result).toEqual(missing);
    expect(resolver.resolveFromText).toHaveBeenCalledWith('hello', 'auto');
  });
});

describe('buildWorkspaceResolutionBlocks', () => {
  it('builds blocks with candidate labels and a picker button', () => {
    const resolution = {
      status: 'ambiguous' as const,
      query: 'my-app',
      reason: 'multiple matches',
      candidates: [
        {
          aliases: [],
          id: 'org1/my-app',
          label: 'org1/my-app',
          name: 'my-app',
          relativePath: 'org1/my-app',
          repoPath: '/tmp/org1/my-app',
        },
        {
          aliases: [],
          id: 'org2/my-app',
          label: 'org2/my-app',
          name: 'my-app',
          relativePath: 'org2/my-app',
          repoPath: '/tmp/org2/my-app',
        },
      ],
    };

    const { blocks, text } = buildWorkspaceResolutionBlocks(resolution, 'work on my-app');

    expect(text).toContain("couldn't tell which repository");
    expect(text).toContain('org1/my-app');
    expect(text).toContain('org2/my-app');
    expect(blocks).toHaveLength(2);
    expect(blocks[1]).toMatchObject({
      type: 'actions',
      block_id: 'workspace_picker',
    });
  });
});

describe('WORKSPACE_PICKER_ACTION_ID', () => {
  it('is a string constant', () => {
    expect(typeof WORKSPACE_PICKER_ACTION_ID).toBe('string');
  });
});
```

- **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/workspace-resolution.test.ts`
Expected: FAIL — module not found.

- **Step 3: Create the workspace resolution module**

Create `src/slack/ingress/workspace-resolution.ts`:

```typescript
import type { SessionRecord } from '~/session/types.js';
import type { ResolvedWorkspace, WorkspaceResolution } from '~/workspace/types.js';
import type { WorkspaceResolver } from '~/workspace/resolver.js';

import { encodeWorkspacePickerButtonValue } from '../interactions/workspace-picker-payload.js';
import type { SlackBlock } from '../types.js';

export const WORKSPACE_PICKER_ACTION_ID = 'workspace_picker_open_modal';

export function resolveWorkspaceForConversation(
  messageText: string,
  existingSession: SessionRecord | undefined,
  workspaceResolver: WorkspaceResolver,
  workspaceOverride?: ResolvedWorkspace,
): WorkspaceResolution {
  if (workspaceOverride) {
    return {
      status: 'unique',
      workspace: workspaceOverride,
    };
  }

  if (
    existingSession?.workspacePath &&
    existingSession.workspaceRepoId &&
    existingSession.workspaceRepoPath &&
    existingSession.workspaceLabel
  ) {
    return {
      status: 'unique',
      workspace: {
        input: existingSession.workspacePath,
        matchKind:
          existingSession.workspacePath === existingSession.workspaceRepoPath ? 'repo' : 'path',
        repo: {
          aliases: [],
          id: existingSession.workspaceRepoId,
          label: existingSession.workspaceRepoId,
          name:
            existingSession.workspaceRepoId.split('/').at(-1) ?? existingSession.workspaceRepoId,
          repoPath: existingSession.workspaceRepoPath,
          relativePath: existingSession.workspaceRepoId,
        },
        source: existingSession.workspaceSource ?? 'manual',
        workspaceLabel: existingSession.workspaceLabel,
        workspacePath: existingSession.workspacePath,
      },
    };
  }

  return workspaceResolver.resolveFromText(messageText, 'auto');
}

export function buildWorkspaceResolutionBlocks(
  resolution: Extract<WorkspaceResolution, { status: 'ambiguous' }>,
  originalMessageText: string,
): { blocks: SlackBlock[]; text: string } {
  const labels = resolution.candidates
    .slice(0, 5)
    .map((candidate) => `\`${candidate.label}\``)
    .join(', ');
  const text = `I couldn't tell which repository to use — matched: ${labels}`;

  return {
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text } },
      {
        type: 'actions',
        block_id: 'workspace_picker',
        elements: [
          {
            action_id: WORKSPACE_PICKER_ACTION_ID,
            style: 'primary',
            text: { type: 'plain_text' as const, text: 'Choose Workspace' },
            type: 'button' as const,
            value: encodeWorkspacePickerButtonValue(originalMessageText),
          },
        ],
      },
    ],
    text,
  };
}
```

- **Step 4: Run the new test to verify it passes**

Run: `pnpm test -- tests/workspace-resolution.test.ts`
Expected: All tests PASS.

- **Step 5: Update app-mention-handler.ts**

Remove from `app-mention-handler.ts`:

- `resolveWorkspaceForConversation` function
- `buildWorkspaceResolutionBlocks` function
- `WORKSPACE_PICKER_ACTION_ID` constant
- The import of `encodeWorkspacePickerButtonValue` (no longer needed in this file)

Add import:

```typescript
import {
  buildWorkspaceResolutionBlocks,
  resolveWorkspaceForConversation,
  WORKSPACE_PICKER_ACTION_ID,
} from './workspace-resolution.js';
```

Add re-export for backward compat:

```typescript
export { WORKSPACE_PICKER_ACTION_ID } from './workspace-resolution.js';
```

- **Step 6: Run full test suite**

Run: `pnpm test`
Expected: All tests pass (including `workspace-picker-action.test.ts`).

- **Step 7: Commit**

```bash
git add src/slack/ingress/workspace-resolution.ts tests/workspace-resolution.test.ts src/slack/ingress/app-mention-handler.ts
git commit -m "refactor: extract workspace resolution to workspace-resolution.ts"
```

---

### Task 5: Extract session manager to `session-manager.ts`

**Files:**

- Create: `src/slack/ingress/session-manager.ts`
- Create: `tests/session-manager.test.ts`
- Modify: `src/slack/ingress/app-mention-handler.ts`
- **Step 1: Write the failing test**

Create `tests/session-manager.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';

import type { SessionRecord, SessionStore } from '~/session/types.js';
import { resolveAndPersistSession } from '~/slack/ingress/session-manager.js';
import type { ResolvedWorkspace } from '~/workspace/types.js';

function createMemorySessionStore(records: SessionRecord[] = []): SessionStore {
  const store = new Map(records.map((r) => [r.threadTs, { ...r }]));
  return {
    countAll: () => store.size,
    get: (threadTs) => {
      const r = store.get(threadTs);
      return r ? { ...r } : undefined;
    },
    patch: (threadTs, patch) => {
      const existing = store.get(threadTs);
      if (!existing) return undefined;
      const next: SessionRecord = {
        ...existing,
        ...patch,
        threadTs,
        updatedAt: new Date().toISOString(),
      };
      store.set(threadTs, next);
      return { ...next };
    },
    upsert: (record) => {
      const next = { ...record };
      store.set(record.threadTs, next);
      return { ...next };
    },
  };
}

const WORKSPACE: ResolvedWorkspace = {
  input: '/tmp/repo',
  matchKind: 'repo',
  repo: {
    aliases: [],
    id: 'org/repo',
    label: 'org/repo',
    name: 'repo',
    relativePath: 'org/repo',
    repoPath: '/tmp/repo',
  },
  source: 'auto',
  workspaceLabel: 'repo',
  workspacePath: '/tmp/repo',
};

describe('resolveAndPersistSession', () => {
  it('creates a new session when none exists', () => {
    const store = createMemorySessionStore();
    const result = resolveAndPersistSession('ts1', 'C123', 'ts1', WORKSPACE, false, store);

    expect(result.session.threadTs).toBe('ts1');
    expect(result.session.workspacePath).toBe('/tmp/repo');
    expect(result.resumeHandle).toBeUndefined();
    expect(store.get('ts1')).toBeDefined();
  });

  it('patches existing session and returns resume handle', () => {
    const existing: SessionRecord = {
      channelId: 'C123',
      claudeSessionId: 'session-1',
      createdAt: new Date().toISOString(),
      rootMessageTs: 'ts1',
      threadTs: 'ts1',
      updatedAt: new Date().toISOString(),
      workspacePath: '/tmp/repo',
      workspaceRepoId: 'org/repo',
      workspaceRepoPath: '/tmp/repo',
      workspaceLabel: 'repo',
    };
    const store = createMemorySessionStore([existing]);

    const result = resolveAndPersistSession('ts1', 'C123', 'ts1', WORKSPACE, false, store);

    expect(result.resumeHandle).toBe('session-1');
  });

  it('resets session when workspace changes', () => {
    const existing: SessionRecord = {
      channelId: 'C123',
      claudeSessionId: 'session-1',
      createdAt: new Date().toISOString(),
      rootMessageTs: 'ts1',
      threadTs: 'ts1',
      updatedAt: new Date().toISOString(),
      workspacePath: '/tmp/old-repo',
      workspaceRepoId: 'org/old-repo',
      workspaceRepoPath: '/tmp/old-repo',
      workspaceLabel: 'old-repo',
    };
    const store = createMemorySessionStore([existing]);

    const result = resolveAndPersistSession('ts1', 'C123', 'ts1', WORKSPACE, false, store);

    expect(result.resumeHandle).toBeUndefined();
    expect(store.get('ts1')?.claudeSessionId).toBeUndefined();
  });

  it('resets session when forceNewSession is true', () => {
    const existing: SessionRecord = {
      channelId: 'C123',
      claudeSessionId: 'session-1',
      createdAt: new Date().toISOString(),
      rootMessageTs: 'ts1',
      threadTs: 'ts1',
      updatedAt: new Date().toISOString(),
      workspacePath: '/tmp/repo',
      workspaceRepoId: 'org/repo',
      workspaceRepoPath: '/tmp/repo',
      workspaceLabel: 'repo',
    };
    const store = createMemorySessionStore([existing]);

    const result = resolveAndPersistSession('ts1', 'C123', 'ts1', WORKSPACE, true, store);

    expect(result.resumeHandle).toBeUndefined();
  });

  it('creates session without workspace fields when workspace is undefined', () => {
    const store = createMemorySessionStore();
    const result = resolveAndPersistSession('ts1', 'C123', 'ts1', undefined, false, store);

    expect(result.session.threadTs).toBe('ts1');
    expect(result.session.workspacePath).toBeUndefined();
    expect(result.session.workspaceRepoId).toBeUndefined();
    expect(result.resumeHandle).toBeUndefined();
  });

  it('preserves existing workspace when patching without new workspace', () => {
    const existing: SessionRecord = {
      channelId: 'C123',
      claudeSessionId: 'session-1',
      createdAt: new Date().toISOString(),
      rootMessageTs: 'ts1',
      threadTs: 'ts1',
      updatedAt: new Date().toISOString(),
      workspacePath: '/tmp/repo',
      workspaceRepoId: 'org/repo',
      workspaceRepoPath: '/tmp/repo',
      workspaceLabel: 'repo',
    };
    const store = createMemorySessionStore([existing]);

    const result = resolveAndPersistSession('ts1', 'C123', 'ts1', undefined, false, store);

    expect(result.resumeHandle).toBe('session-1');
    expect(store.get('ts1')?.workspacePath).toBe('/tmp/repo');
  });
});
```

- **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/session-manager.test.ts`
Expected: FAIL — module not found.

- **Step 3: Create the session manager module**

Create `src/slack/ingress/session-manager.ts`:

```typescript
import type { SessionRecord, SessionStore } from '~/session/types.js';
import type { ResolvedWorkspace } from '~/workspace/types.js';

export interface SessionResolution {
  resumeHandle: string | undefined;
  session: SessionRecord;
}

export function resolveAndPersistSession(
  threadTs: string,
  channelId: string,
  rootMessageTs: string,
  workspace: ResolvedWorkspace | undefined,
  forceNewSession: boolean,
  sessionStore: SessionStore,
): SessionResolution {
  const existingSession = sessionStore.get(threadTs);

  const shouldResetSession =
    forceNewSession ||
    Boolean(
      workspace &&
      existingSession?.claudeSessionId &&
      existingSession.workspacePath !== workspace.workspacePath,
    );
  const resumeHandle = shouldResetSession ? undefined : existingSession?.claudeSessionId;

  const workspaceFields = workspace
    ? {
        workspaceLabel: workspace.workspaceLabel,
        workspacePath: workspace.workspacePath,
        workspaceRepoId: workspace.repo.id,
        workspaceRepoPath: workspace.repo.repoPath,
        workspaceSource: workspace.source,
      }
    : {};

  if (existingSession) {
    const patched = sessionStore.patch(threadTs, {
      channelId,
      rootMessageTs,
      ...workspaceFields,
      ...(shouldResetSession ? { claudeSessionId: undefined } : {}),
    });
    return { resumeHandle, session: patched ?? existingSession };
  }

  const session = sessionStore.upsert({
    channelId,
    threadTs,
    rootMessageTs,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...workspaceFields,
  });

  return { resumeHandle, session };
}
```

- **Step 4: Run the new test to verify it passes**

Run: `pnpm test -- tests/session-manager.test.ts`
Expected: All tests PASS.

- **Step 5: Update app-mention-handler.ts**

In `handleThreadConversation`, replace the session management block (lines 310-351 approximately — from `const shouldResetSession` through the `else { deps.sessionStore.upsert(...) }` block) with:

```typescript
import { resolveAndPersistSession } from './session-manager.js';

// Inside handleThreadConversation, replace the session block with:
const { resumeHandle } = resolveAndPersistSession(
  threadTs,
  message.channel,
  options.rootMessageTs,
  workspace,
  options.forceNewSession === true,
  deps.sessionStore,
);
```

Remove the now-unused `existingSession` variable reference in the session block (but keep the one used earlier for workspace resolution and the one used later for `resolveExecutor`). The `existingSession` lookup at line 268 (`const existingSession = deps.sessionStore.get(threadTs)`) stays — it's still needed for workspace resolution and executor resolution.

- **Step 6: Run full test suite**

Run: `pnpm test`
Expected: All tests pass.

- **Step 7: Commit**

```bash
git add src/slack/ingress/session-manager.ts tests/session-manager.test.ts src/slack/ingress/app-mention-handler.ts
git commit -m "refactor: extract session management to session-manager.ts"
```

---

### Task 6: Extract activity sink to `activity-sink.ts`

**Files:**

- Create: `src/slack/ingress/activity-sink.ts`
- Create: `tests/activity-sink.test.ts`
- Modify: `src/slack/ingress/app-mention-handler.ts`
- **Step 1: Write the failing test**

Create `tests/activity-sink.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest';

import type { AgentActivityState } from '~/agent/types.js';
import type { AppLogger } from '~/logger/index.js';
import { createActivitySink } from '~/slack/ingress/activity-sink.js';
import type { SlackRenderer } from '~/slack/render/slack-renderer.js';
import type { SessionStore } from '~/session/types.js';
import type { SlackWebClientLike } from '~/slack/types.js';

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

function createRendererStub(): SlackRenderer {
  return {
    addAcknowledgementReaction: vi.fn().mockResolvedValue(undefined),
    clearUiState: vi.fn().mockResolvedValue(undefined),
    deleteThreadProgressMessage: vi.fn().mockResolvedValue(undefined),
    finalizeThreadProgressMessage: vi.fn().mockResolvedValue(undefined),
    postThreadReply: vi.fn().mockResolvedValue(undefined),
    setUiState: vi.fn().mockResolvedValue(undefined),
    showThinkingIndicator: vi.fn().mockResolvedValue(undefined),
    upsertThreadProgressMessage: vi.fn().mockResolvedValue('progress-ts'),
  } as unknown as SlackRenderer;
}

function createMockClient(): SlackWebClientLike {
  return {
    assistant: { threads: { setStatus: vi.fn().mockResolvedValue({}) } },
    auth: { test: vi.fn().mockResolvedValue({ user_id: 'U_BOT' }) },
    chat: {
      delete: vi.fn().mockResolvedValue({}),
      postMessage: vi.fn().mockResolvedValue({ ts: 'msg-ts' }),
      update: vi.fn().mockResolvedValue({}),
    },
    conversations: { replies: vi.fn().mockResolvedValue({ messages: [] }) },
    reactions: { add: vi.fn().mockResolvedValue({}) },
    views: { open: vi.fn().mockResolvedValue({}) },
  } as unknown as SlackWebClientLike;
}

function createMockSessionStore(): SessionStore {
  return {
    countAll: () => 0,
    get: vi.fn().mockReturnValue(undefined),
    patch: vi.fn().mockReturnValue(undefined),
    upsert: vi.fn().mockImplementation((r) => r),
  } as unknown as SessionStore;
}

describe('createActivitySink', () => {
  it('posts a thread reply on assistant-message events', async () => {
    const renderer = createRendererStub();
    const sink = createActivitySink({
      channel: 'C123',
      client: createMockClient(),
      logger: createTestLogger(),
      renderer,
      sessionStore: createMockSessionStore(),
      threadTs: 'ts1',
    });

    await sink.onEvent({ type: 'assistant-message', text: 'Hello!' });

    expect(renderer.postThreadReply).toHaveBeenCalledWith(
      expect.anything(),
      'C123',
      'ts1',
      'Hello!',
      expect.any(Object),
    );
  });

  it('clears UI state after assistant-message', async () => {
    const renderer = createRendererStub();
    const sink = createActivitySink({
      channel: 'C123',
      client: createMockClient(),
      logger: createTestLogger(),
      renderer,
      sessionStore: createMockSessionStore(),
      threadTs: 'ts1',
    });

    await sink.onEvent({ type: 'assistant-message', text: 'Hello!' });

    expect(renderer.clearUiState).toHaveBeenCalled();
  });

  it('patches session with resume handle on lifecycle events', async () => {
    const sessionStore = createMockSessionStore();
    const sink = createActivitySink({
      channel: 'C123',
      client: createMockClient(),
      logger: createTestLogger(),
      renderer: createRendererStub(),
      sessionStore,
      threadTs: 'ts1',
    });

    await sink.onEvent({ type: 'lifecycle', phase: 'started', resumeHandle: 'session-42' });

    expect(sessionStore.patch).toHaveBeenCalledWith('ts1', { claudeSessionId: 'session-42' });
  });

  it('posts error message on lifecycle failed', async () => {
    const renderer = createRendererStub();
    const sink = createActivitySink({
      channel: 'C123',
      client: createMockClient(),
      logger: createTestLogger(),
      renderer,
      sessionStore: createMockSessionStore(),
      threadTs: 'ts1',
    });

    await sink.onEvent({ type: 'lifecycle', phase: 'failed', error: 'boom' });

    expect(renderer.postThreadReply).toHaveBeenCalledWith(
      expect.anything(),
      'C123',
      'ts1',
      'An error occurred while processing your request.',
    );
  });

  it('finalize clears UI state', async () => {
    const renderer = createRendererStub();
    const sink = createActivitySink({
      channel: 'C123',
      client: createMockClient(),
      logger: createTestLogger(),
      renderer,
      sessionStore: createMockSessionStore(),
      threadTs: 'ts1',
    });

    await sink.finalize();

    expect(renderer.clearUiState).toHaveBeenCalledWith(expect.anything(), 'C123', 'ts1');
  });

  it('tracks tool activity in toolHistory', async () => {
    const renderer = createRendererStub();
    const sink = createActivitySink({
      channel: 'C123',
      client: createMockClient(),
      logger: createTestLogger(),
      renderer,
      sessionStore: createMockSessionStore(),
      threadTs: 'ts1',
    });

    const state: AgentActivityState = {
      threadTs: 'ts1',
      status: 'Reading files...',
      activities: ['Reading src/index.ts...'],
      clear: false,
    };
    await sink.onEvent({ type: 'activity-state', state });

    // Both status and activity match TOOL_VERB_PATTERN with verb "Reading",
    // and they are distinct strings, so the count is 2.
    expect(sink.toolHistory.get('Reading')).toBe(2);
  });
});
```

- **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/activity-sink.test.ts`
Expected: FAIL — module not found.

- **Step 3: Create the activity sink module**

Create `src/slack/ingress/activity-sink.ts`. This is the largest extraction. Move all activity/progress-related code from `handleThreadConversation`:

```typescript
import type { AgentActivityState, AgentExecutionEvent } from '~/agent/types.js';
import type { AppLogger } from '~/logger/index.js';
import { redact } from '~/logger/redact.js';
import { runtimeError } from '~/logger/runtime.js';
import type { SessionStore } from '~/session/types.js';

import type { SlackRenderer } from '../render/slack-renderer.js';
import type { SlackWebClientLike } from '../types.js';

export interface ActivitySinkOptions {
  channel: string;
  client: SlackWebClientLike;
  logger: AppLogger;
  renderer: SlackRenderer;
  sessionStore: SessionStore;
  threadTs: string;
  workspaceLabel?: string;
}

export interface ActivitySink {
  finalize: () => Promise<void>;
  onEvent: (event: AgentExecutionEvent) => Promise<void>;
  readonly toolHistory: Map<string, number>;
}

const TOOL_VERB_PATTERN =
  /^(Reading|Searching|Finding|Fetching|Calling|Running|Exploring|Recalling|Saving|Checking|Applying|Editing|Generating|Waiting|Using) (.+?)(?:\.{3})?$/;

export function createActivitySink(options: ActivitySinkOptions): ActivitySink {
  const { channel, client, logger, renderer, sessionStore, threadTs, workspaceLabel } = options;

  let progressMessageTs: string | undefined;
  let progressMessageActive = false;
  const toolHistory = new Map<string, number>();
  const seenActivities = new Set<string>();
  let lastStateKey: string | undefined;

  const defaultThinkingState = createDefaultThinkingState(threadTs);
  const defaultThinkingStateKey = JSON.stringify(defaultThinkingState);

  const isMeaningfulActivityState = (state: AgentActivityState): boolean => {
    if (state.clear) return false;
    if (JSON.stringify(state) === defaultThinkingStateKey) return false;

    const normalizedStatus = state.status?.trim();
    if (normalizedStatus && normalizedStatus !== defaultThinkingState.status) return true;

    const meaningfulActivity = state.activities?.some((activity) => {
      const normalizedActivity = activity.trim();
      return (
        normalizedActivity.length > 0 &&
        normalizedActivity !== normalizedStatus &&
        !(defaultThinkingState.activities ?? []).includes(normalizedActivity)
      );
    });

    return meaningfulActivity === true;
  };

  const toRendererState = (state: AgentActivityState) => ({
    threadTs: state.threadTs,
    ...(state.status != null ? { status: state.status } : {}),
    ...(state.activities != null ? { loadingMessages: state.activities } : {}),
    ...(state.composing != null ? { composing: state.composing } : {}),
    ...(toolHistory.size > 0 ? { toolHistory } : {}),
    clear: state.clear ?? false,
  });

  const updateInFlightIndicator = async (state: AgentActivityState): Promise<void> => {
    if (progressMessageActive) {
      progressMessageTs = await renderer.upsertThreadProgressMessage(
        client,
        channel,
        threadTs,
        toRendererState(state),
        progressMessageTs,
      );
      return;
    }
    await renderer.setUiState(client, channel, toRendererState(state));
  };

  const activateProgressMessage = async (state: AgentActivityState): Promise<void> => {
    if (!progressMessageActive) {
      progressMessageActive = true;
      await renderer.clearUiState(client, channel, threadTs).catch((error) => {
        logger.warn('Failed to clear fallback Slack thinking indicator: %s', String(error));
      });
    }
    progressMessageTs = await renderer.upsertThreadProgressMessage(
      client,
      channel,
      threadTs,
      toRendererState(state),
      progressMessageTs,
    );
  };

  const handleAssistantMessage = async (text: string): Promise<void> => {
    await renderer.postThreadReply(client, channel, threadTs, text, {
      ...(workspaceLabel ? { workspaceLabel } : {}),
      ...(toolHistory.size > 0 ? { toolHistory } : {}),
    });
    if (progressMessageActive && progressMessageTs) {
      await renderer
        .deleteThreadProgressMessage(client, channel, threadTs, progressMessageTs)
        .catch((error) => {
          logger.warn(
            'Failed to delete thread progress message after assistant reply: %s',
            String(error),
          );
        });
      progressMessageTs = undefined;
      progressMessageActive = false;
    }
    lastStateKey = undefined;
    toolHistory.clear();
    seenActivities.clear();
    await renderer.clearUiState(client, channel, threadTs).catch((error) => {
      logger.warn('Failed to clear UI state after assistant reply: %s', String(error));
    });
  };

  const handleActivityState = async (state: AgentActivityState): Promise<void> => {
    const nextStateKey = JSON.stringify(state);
    if (nextStateKey === lastStateKey) return;
    lastStateKey = nextStateKey;

    if (!state.clear) {
      collectToolActivity(state, toolHistory, seenActivities);
    }

    if (state.composing && !state.clear) {
      if (progressMessageActive && progressMessageTs) {
        await renderer
          .upsertThreadProgressMessage(
            client,
            channel,
            threadTs,
            {
              threadTs,
              status: 'Composing response...',
              loadingMessages: ['Composing response...'],
              ...(toolHistory.size > 0 ? { toolHistory } : {}),
              clear: false,
            },
            progressMessageTs,
          )
          .catch((error) => {
            logger.warn('Failed to update progress message on composing: %s', String(error));
          });
      } else {
        await renderer
          .setUiState(client, channel, { threadTs, status: 'Composing response...', clear: false })
          .catch((error) => {
            logger.warn('Failed to set composing status: %s', String(error));
          });
      }
      return;
    }

    if (state.clear) {
      if (progressMessageActive && progressMessageTs) {
        await renderer.deleteThreadProgressMessage(client, channel, threadTs, progressMessageTs);
        progressMessageTs = undefined;
        progressMessageActive = false;
        return;
      }
      await renderer.clearUiState(client, channel, threadTs);
      return;
    }

    if (!progressMessageActive && isMeaningfulActivityState(state)) {
      await activateProgressMessage(state);
      return;
    }

    await updateInFlightIndicator(state);
  };

  const handleLifecycleEvent = async (
    event: Extract<AgentExecutionEvent, { type: 'lifecycle' }>,
  ): Promise<void> => {
    if (event.resumeHandle) {
      sessionStore.patch(threadTs, { claudeSessionId: event.resumeHandle });
    }
    if (event.phase === 'started' || event.phase === 'completed') return;
    if (event.phase === 'failed') {
      runtimeError(
        logger,
        'Execution failed for thread %s: %s',
        threadTs,
        redact(String(event.error ?? '')),
      );
      await renderer.postThreadReply(
        client,
        channel,
        threadTs,
        'An error occurred while processing your request.',
      );
    }
  };

  return {
    toolHistory,

    async onEvent(event: AgentExecutionEvent): Promise<void> {
      if (event.type === 'assistant-message') {
        await handleAssistantMessage(event.text);
        return;
      }
      if (event.type === 'activity-state') {
        await handleActivityState(event.state);
        return;
      }
      if (event.type === 'task-update') return;
      await handleLifecycleEvent(event as Extract<AgentExecutionEvent, { type: 'lifecycle' }>);
    },

    async finalize(): Promise<void> {
      await renderer.clearUiState(client, channel, threadTs).catch((err) => {
        logger.warn('Failed to clear UI state: %s', String(err));
      });
      if (progressMessageTs) {
        await renderer
          .finalizeThreadProgressMessage(client, channel, threadTs, progressMessageTs, toolHistory)
          .catch((err) => {
            logger.warn('Failed to finalize progress message: %s', String(err));
          });
      }
    },
  };
}

function createDefaultThinkingState(threadTs: string): AgentActivityState {
  return {
    threadTs,
    status: 'Thinking...',
    activities: [
      'Reading the thread context...',
      'Planning the next steps...',
      'Generating a response...',
    ],
    clear: false,
  };
}

function collectToolActivity(
  state: AgentActivityState,
  history: Map<string, number>,
  seenActivities: Set<string>,
): void {
  const candidates = [...(state.activities ?? [])];
  if (state.status?.trim()) candidates.push(state.status);

  for (const msg of candidates) {
    const trimmed = msg.trim();
    if (!trimmed || seenActivities.has(trimmed)) continue;
    const match = trimmed.match(TOOL_VERB_PATTERN);
    if (!match) continue;
    seenActivities.add(trimmed);
    const verb = match[1]!;
    const label = verb === 'Using' ? (match[2]!.split(/\s/)[0] ?? verb) : verb;
    history.set(label, (history.get(label) ?? 0) + 1);
  }
}
```

- **Step 4: Run the new test to verify it passes**

Run: `pnpm test -- tests/activity-sink.test.ts`
Expected: All tests PASS.

- **Step 5: Update app-mention-handler.ts**

Remove from `app-mention-handler.ts`:

- `TOOL_VERB_PATTERN` constant
- `collectToolActivity` function
- `createDefaultThinkingState` function
- The entire sink/progress/activity section inside `handleThreadConversation` (lines 353-581 approximately — from `let activeActivityState` through the `sink` object definition)
- The `finally` block content (lines 626-643)

Replace with a call to `createActivitySink` and use `sink.finalize()` in the `finally` block. This will be completed fully in Task 7 when the pipeline is assembled.

For now, add the import and restructure `handleThreadConversation` to use the sink:

```typescript
import { createActivitySink } from './activity-sink.js';
```

Replace the mutable state setup + sink definition + try/catch/finally with:

```typescript
// After thread context loading and memory loading...

const sink = createActivitySink({
  channel: message.channel,
  client,
  logger: deps.logger,
  renderer: deps.renderer,
  sessionStore: deps.sessionStore,
  threadTs,
  ...(workspace ? { workspaceLabel: workspace.workspaceLabel } : {}),
});

try {
  const executor = resolveExecutor(existingSession, deps);
  runtimeInfo(
    deps.logger,
    'Starting agent execution for thread %s (provider=%s)',
    threadTs,
    executor.providerId,
  );
  await executor.execute(
    {
      channelId: message.channel,
      threadTs,
      userId: message.user,
      mentionText: message.text,
      threadContext,
      contextMemories,
      ...(workspace
        ? {
            workspaceLabel: workspace.workspaceLabel,
            workspacePath: workspace.workspacePath,
            workspaceRepoId: workspace.repo.id,
          }
        : {}),
      ...(resumeHandle ? { resumeHandle } : {}),
    },
    sink,
  );
  runtimeInfo(deps.logger, 'Agent execution completed for thread %s', threadTs);
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  runtimeError(
    deps.logger,
    'Agent execution failed for thread %s: %s',
    threadTs,
    redact(errorMessage),
  );
  await deps.renderer.postThreadReply(
    client,
    message.channel,
    threadTs,
    'An error occurred while processing your request.',
  );
} finally {
  await sink.finalize();
}
```

- **Step 6: Run full test suite**

Run: `pnpm test`
Expected: All tests pass (especially `slack-loading-status.test.ts`).

- **Step 7: Commit**

```bash
git add src/slack/ingress/activity-sink.ts tests/activity-sink.test.ts src/slack/ingress/app-mention-handler.ts
git commit -m "refactor: extract activity sink to activity-sink.ts"
```

---

### Task 7: Create conversation pipeline (`conversation-pipeline.ts`)

**Files:**

- Create: `src/slack/ingress/conversation-pipeline.ts`
- Create: `tests/conversation-pipeline.test.ts`
- Modify: `src/slack/ingress/app-mention-handler.ts`
- **Step 1: Write the failing test for the pipeline runner**

Create `tests/conversation-pipeline.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest';

import type { AgentExecutor } from '~/agent/types.js';
import type { AppLogger } from '~/logger/index.js';
import type { MemoryStore } from '~/memory/types.js';
import type { SessionRecord, SessionStore } from '~/session/types.js';
import type { SlackThreadContextLoader } from '~/slack/context/thread-context-loader.js';
import {
  DEFAULT_CONVERSATION_STEPS,
  runConversationPipeline,
} from '~/slack/ingress/conversation-pipeline.js';
import type { SlackRenderer } from '~/slack/render/slack-renderer.js';
import type { SlackWebClientLike } from '~/slack/types.js';
import type { WorkspaceResolver } from '~/workspace/resolver.js';
import type { WorkspaceResolution } from '~/workspace/types.js';
import type { ConversationPipelineContext, PipelineStep } from '~/slack/ingress/types.js';

describe('runConversationPipeline', () => {
  it('runs all steps in order', async () => {
    const calls: string[] = [];
    const steps: PipelineStep[] = [
      async () => {
        calls.push('a');
        return { action: 'continue' };
      },
      async () => {
        calls.push('b');
        return { action: 'continue' };
      },
      async () => {
        calls.push('c');
        return { action: 'continue' };
      },
    ];
    const ctx = {} as ConversationPipelineContext;

    await runConversationPipeline(ctx, steps);

    expect(calls).toEqual(['a', 'b', 'c']);
  });

  it('stops on early exit', async () => {
    const calls: string[] = [];
    const steps: PipelineStep[] = [
      async () => {
        calls.push('a');
        return { action: 'continue' };
      },
      async () => {
        calls.push('b');
        return { action: 'done', reason: 'ambiguous' };
      },
      async () => {
        calls.push('c');
        return { action: 'continue' };
      },
    ];
    const ctx = {} as ConversationPipelineContext;

    await runConversationPipeline(ctx, steps);

    expect(calls).toEqual(['a', 'b']);
  });

  it('propagates step errors', async () => {
    const steps: PipelineStep[] = [
      async () => {
        throw new Error('boom');
      },
    ];
    const ctx = {} as ConversationPipelineContext;

    await expect(runConversationPipeline(ctx, steps)).rejects.toThrow('boom');
  });
});

describe('DEFAULT_CONVERSATION_STEPS', () => {
  it('exports the expected number of steps', () => {
    expect(DEFAULT_CONVERSATION_STEPS).toHaveLength(5);
  });

  it('contains only functions', () => {
    for (const step of DEFAULT_CONVERSATION_STEPS) {
      expect(typeof step).toBe('function');
    }
  });
});

describe('acknowledgeAndLog step', () => {
  it('sets existingSession on context from session store', async () => {
    const { acknowledgeAndLog } = await import('~/slack/ingress/conversation-pipeline.js');
    const session = {
      channelId: 'C123',
      createdAt: '',
      rootMessageTs: 'ts1',
      threadTs: 'ts1',
      updatedAt: '',
    };
    const ctx = createMinimalPipelineContext({
      sessionStoreRecords: [session],
    });

    const result = await acknowledgeAndLog(ctx);

    expect(result.action).toBe('continue');
    expect(ctx.existingSession).toBeDefined();
    expect(ctx.existingSession?.threadTs).toBe('ts1');
  });

  it('adds acknowledgement reaction when configured', async () => {
    const { acknowledgeAndLog } = await import('~/slack/ingress/conversation-pipeline.js');
    const ctx = createMinimalPipelineContext({ addAcknowledgementReaction: true });

    await acknowledgeAndLog(ctx);

    expect(ctx.deps.renderer.addAcknowledgementReaction).toHaveBeenCalledWith(
      ctx.client,
      'C123',
      'ts1',
    );
  });
});

describe('resolveWorkspaceStep step', () => {
  it('returns done when workspace is ambiguous', async () => {
    const { resolveWorkspaceStep } = await import('~/slack/ingress/conversation-pipeline.js');
    const ctx = createMinimalPipelineContext({
      workspaceResolverResult: {
        status: 'ambiguous',
        query: 'my-app',
        reason: 'multiple',
        candidates: [
          {
            aliases: [],
            id: 'org1/my-app',
            label: 'org1/my-app',
            name: 'my-app',
            relativePath: 'org1/my-app',
            repoPath: '/tmp/1',
          },
          {
            aliases: [],
            id: 'org2/my-app',
            label: 'org2/my-app',
            name: 'my-app',
            relativePath: 'org2/my-app',
            repoPath: '/tmp/2',
          },
        ],
      },
    });

    const result = await resolveWorkspaceStep(ctx);

    expect(result.action).toBe('done');
    expect(ctx.client.chat.postMessage).toHaveBeenCalled();
  });

  it('sets workspace on context when unique', async () => {
    const { resolveWorkspaceStep } = await import('~/slack/ingress/conversation-pipeline.js');
    const workspace = {
      input: '/tmp/repo',
      matchKind: 'repo' as const,
      repo: {
        aliases: [],
        id: 'r1',
        label: 'r1',
        name: 'repo',
        relativePath: 'r1',
        repoPath: '/tmp/repo',
      },
      source: 'auto' as const,
      workspaceLabel: 'repo',
      workspacePath: '/tmp/repo',
    };
    const ctx = createMinimalPipelineContext({
      workspaceResolverResult: { status: 'unique', workspace },
    });

    const result = await resolveWorkspaceStep(ctx);

    expect(result.action).toBe('continue');
    expect(ctx.workspace).toEqual(workspace);
  });
});

describe('resolveSessionStep step', () => {
  it('sets resumeHandle on context', async () => {
    const { resolveSessionStep } = await import('~/slack/ingress/conversation-pipeline.js');
    const ctx = createMinimalPipelineContext();

    const result = await resolveSessionStep(ctx);

    expect(result.action).toBe('continue');
    expect(ctx.resumeHandle).toBeUndefined(); // no existing session
  });
});

describe('prepareThreadContext step', () => {
  it('loads thread context and sets it on ctx', async () => {
    const { prepareThreadContext } = await import('~/slack/ingress/conversation-pipeline.js');
    const ctx = createMinimalPipelineContext();

    const result = await prepareThreadContext(ctx);

    expect(result.action).toBe('continue');
    expect(ctx.threadContext).toBeDefined();
    expect(ctx.deps.threadContextLoader.loadThread).toHaveBeenCalled();
  });
});
```

The `createMinimalPipelineContext` helper used by the step tests:

```typescript
function createMinimalPipelineContext(overrides?: {
  addAcknowledgementReaction?: boolean;
  sessionStoreRecords?: SessionRecord[];
  workspaceResolverResult?: WorkspaceResolution;
}): ConversationPipelineContext {
  const records = new Map(
    (overrides?.sessionStoreRecords ?? []).map((r) => [r.threadTs, { ...r }]),
  );
  const sessionStore: SessionStore = {
    countAll: () => records.size,
    get: (ts) => {
      const r = records.get(ts);
      return r ? { ...r } : undefined;
    },
    patch: vi.fn((ts, patch) => {
      const existing = records.get(ts);
      if (!existing) return undefined;
      const next = { ...existing, ...patch, threadTs: ts, updatedAt: new Date().toISOString() };
      records.set(ts, next);
      return { ...next };
    }),
    upsert: vi.fn((record) => {
      records.set(record.threadTs, { ...record });
      return { ...record };
    }),
  };
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

  return {
    client: {
      assistant: { threads: { setStatus: vi.fn().mockResolvedValue({}) } },
      auth: { test: vi.fn().mockResolvedValue({ user_id: 'U_BOT' }) },
      chat: {
        delete: vi.fn().mockResolvedValue({}),
        postMessage: vi.fn().mockResolvedValue({ ts: 'msg-ts' }),
        update: vi.fn().mockResolvedValue({}),
      },
      conversations: { replies: vi.fn().mockResolvedValue({ messages: [] }) },
      reactions: { add: vi.fn().mockResolvedValue({}) },
      views: { open: vi.fn().mockResolvedValue({}) },
    } as unknown as SlackWebClientLike,
    deps: {
      claudeExecutor: {
        providerId: 'claude',
        execute: vi.fn().mockResolvedValue(undefined),
        drain: vi.fn(),
      } as unknown as AgentExecutor,
      logger: logger as unknown as AppLogger,
      memoryStore: {
        listForContext: vi.fn().mockReturnValue({ global: [], workspace: [], preferences: [] }),
      } as unknown as MemoryStore,
      renderer: {
        addAcknowledgementReaction: vi.fn().mockResolvedValue(undefined),
        clearUiState: vi.fn().mockResolvedValue(undefined),
        deleteThreadProgressMessage: vi.fn().mockResolvedValue(undefined),
        finalizeThreadProgressMessage: vi.fn().mockResolvedValue(undefined),
        postThreadReply: vi.fn().mockResolvedValue(undefined),
        setUiState: vi.fn().mockResolvedValue(undefined),
        showThinkingIndicator: vi.fn().mockResolvedValue(undefined),
        upsertThreadProgressMessage: vi.fn().mockResolvedValue(undefined),
      } as unknown as SlackRenderer,
      sessionStore,
      threadContextLoader: {
        loadThread: vi.fn().mockResolvedValue({
          channelId: 'C123',
          messages: [],
          renderedPrompt: '',
          threadTs: 'ts1',
        }),
      } as unknown as SlackThreadContextLoader,
      workspaceResolver: {
        resolveFromText: vi
          .fn()
          .mockReturnValue(
            overrides?.workspaceResolverResult ?? { status: 'missing', query: '', reason: 'none' },
          ),
      } as unknown as WorkspaceResolver,
    },
    message: { channel: 'C123', team: 'T123', text: 'hello', ts: 'ts1', user: 'U123' },
    options: {
      addAcknowledgementReaction: overrides?.addAcknowledgementReaction ?? false,
      logLabel: 'test',
      rootMessageTs: 'ts1',
    },
    threadTs: 'ts1',
  };
}
```

- **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/conversation-pipeline.test.ts`
Expected: FAIL — module not found.

- **Step 3: Create the conversation pipeline module**

Create `src/slack/ingress/conversation-pipeline.ts`:

```typescript
import type { AgentExecutor } from '~/agent/types.js';
import { redact } from '~/logger/redact.js';
import { runtimeError, runtimeInfo, runtimeWarn } from '~/logger/runtime.js';
import type { SessionRecord } from '~/session/types.js';

import type { SlackWebClientLike } from '../types.js';

import { createActivitySink } from './activity-sink.js';
import { resolveAndPersistSession } from './session-manager.js';
import type {
  ConversationPipelineContext,
  PipelineStep,
  PipelineStepResult,
  SlackIngressDependencies,
  ThreadConversationMessage,
  ThreadConversationOptions,
} from './types.js';
import {
  buildWorkspaceResolutionBlocks,
  resolveWorkspaceForConversation,
} from './workspace-resolution.js';

export async function runConversationPipeline(
  ctx: ConversationPipelineContext,
  steps: PipelineStep[],
): Promise<void> {
  for (const step of steps) {
    const result = await step(ctx);
    if (result.action === 'done') return;
  }
}

export async function handleThreadConversation(
  client: SlackWebClientLike,
  message: ThreadConversationMessage,
  deps: SlackIngressDependencies,
  options: ThreadConversationOptions,
): Promise<void> {
  const ctx: ConversationPipelineContext = {
    client,
    deps,
    message,
    options,
    threadTs: message.thread_ts ?? message.ts,
  };
  await runConversationPipeline(ctx, DEFAULT_CONVERSATION_STEPS);
}

const CONTINUE: PipelineStepResult = { action: 'continue' };

export async function acknowledgeAndLog(
  ctx: ConversationPipelineContext,
): Promise<PipelineStepResult> {
  const { deps, message, options, threadTs } = ctx;

  runtimeInfo(
    deps.logger,
    'Received %s in channel %s, root ts %s, thread ts %s',
    options.logLabel,
    message.channel,
    message.ts,
    threadTs,
  );

  ctx.existingSession = deps.sessionStore.get(threadTs);

  if (options.addAcknowledgementReaction) {
    await deps.renderer.addAcknowledgementReaction(ctx.client, message.channel, message.ts);
  }

  return CONTINUE;
}

export async function resolveWorkspaceStep(
  ctx: ConversationPipelineContext,
): Promise<PipelineStepResult> {
  const { deps, message, threadTs } = ctx;

  const workspaceResolution = resolveWorkspaceForConversation(
    message.text,
    ctx.existingSession,
    deps.workspaceResolver,
    ctx.options.workspaceOverride,
  );

  if (workspaceResolution.status === 'ambiguous') {
    runtimeWarn(
      deps.logger,
      'Ambiguous workspace for thread %s (%s)',
      threadTs,
      workspaceResolution.reason,
    );
    const { blocks, text } = buildWorkspaceResolutionBlocks(workspaceResolution, message.text);
    await ctx.client.chat.postMessage({
      blocks,
      channel: message.channel,
      text,
      thread_ts: threadTs,
    });
    return { action: 'done', reason: 'ambiguous workspace' };
  }

  ctx.workspace =
    workspaceResolution.status === 'unique' ? workspaceResolution.workspace : undefined;

  if (workspaceResolution.status === 'missing') {
    runtimeInfo(
      deps.logger,
      'No workspace detected for thread %s — proceeding without workspace (%s)',
      threadTs,
      workspaceResolution.reason,
    );
  }

  return CONTINUE;
}

export async function resolveSessionStep(
  ctx: ConversationPipelineContext,
): Promise<PipelineStepResult> {
  const { deps, message, options, threadTs, workspace } = ctx;

  const { resumeHandle } = resolveAndPersistSession(
    threadTs,
    message.channel,
    options.rootMessageTs,
    workspace,
    options.forceNewSession === true,
    deps.sessionStore,
  );
  ctx.resumeHandle = resumeHandle;

  return CONTINUE;
}

export async function prepareThreadContext(
  ctx: ConversationPipelineContext,
): Promise<PipelineStepResult> {
  const { client, deps, message, threadTs, workspace } = ctx;

  await deps.renderer.showThinkingIndicator(client, message.channel, threadTs).catch((error) => {
    deps.logger.warn('Failed to show Slack thinking indicator: %s', String(error));
  });

  runtimeInfo(deps.logger, 'Loading thread context for %s', threadTs);
  ctx.threadContext = await deps.threadContextLoader.loadThread(client, message.channel, threadTs);
  runtimeInfo(
    deps.logger,
    'Thread context loaded for %s (%d messages)',
    threadTs,
    ctx.threadContext.messages.length,
  );

  ctx.contextMemories = deps.memoryStore.listForContext(workspace?.repo.id);

  return CONTINUE;
}

export async function executeAgent(ctx: ConversationPipelineContext): Promise<PipelineStepResult> {
  const {
    client,
    deps,
    message,
    threadTs,
    workspace,
    resumeHandle,
    threadContext,
    contextMemories,
  } = ctx;

  if (!threadContext) {
    throw new Error('Pipeline invariant: threadContext must be set before executeAgent');
  }

  const executor = resolveExecutor(ctx.existingSession, deps);
  const sink = createActivitySink({
    channel: message.channel,
    client,
    logger: deps.logger,
    renderer: deps.renderer,
    sessionStore: deps.sessionStore,
    threadTs,
    ...(workspace ? { workspaceLabel: workspace.workspaceLabel } : {}),
  });

  try {
    runtimeInfo(
      deps.logger,
      'Starting agent execution for thread %s (provider=%s)',
      threadTs,
      executor.providerId,
    );
    await executor.execute(
      {
        channelId: message.channel,
        threadTs,
        userId: message.user,
        mentionText: message.text,
        threadContext,
        contextMemories,
        ...(workspace
          ? {
              workspaceLabel: workspace.workspaceLabel,
              workspacePath: workspace.workspacePath,
              workspaceRepoId: workspace.repo.id,
            }
          : {}),
        ...(resumeHandle ? { resumeHandle } : {}),
      },
      sink,
    );
    runtimeInfo(deps.logger, 'Agent execution completed for thread %s', threadTs);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    runtimeError(
      deps.logger,
      'Agent execution failed for thread %s: %s',
      threadTs,
      redact(errorMessage),
    );
    await deps.renderer.postThreadReply(
      client,
      message.channel,
      threadTs,
      'An error occurred while processing your request.',
    );
  } finally {
    await sink.finalize();
  }

  return CONTINUE;
}

function resolveExecutor(
  session: SessionRecord | undefined,
  deps: SlackIngressDependencies,
): AgentExecutor {
  if (session?.agentProvider && deps.providerRegistry?.has(session.agentProvider)) {
    return deps.providerRegistry.getExecutor(session.agentProvider);
  }
  return deps.claudeExecutor;
}

export const DEFAULT_CONVERSATION_STEPS: PipelineStep[] = [
  acknowledgeAndLog,
  resolveWorkspaceStep,
  resolveSessionStep,
  prepareThreadContext,
  executeAgent,
];
```

- **Step 4: Run the new test to verify it passes**

Run: `pnpm test -- tests/conversation-pipeline.test.ts`
Expected: All tests PASS.

- **Step 5: Commit**

```bash
git add src/slack/ingress/conversation-pipeline.ts tests/conversation-pipeline.test.ts
git commit -m "refactor: create conversation pipeline with step definitions"
```

---

### Task 8: Rewrite `app-mention-handler.ts` to use the pipeline

**Files:**

- Modify: `src/slack/ingress/app-mention-handler.ts`
- **Step 1: Rewrite the handler file**

Replace the entire file content with the slimmed version that uses the pipeline. The file should contain only handler factories and re-exports:

```typescript
import type { AssistantThreadStartedMiddleware, AssistantUserMessageMiddleware } from '@slack/bolt';

import { redact } from '~/logger/redact.js';
import { runtimeError } from '~/logger/runtime.js';
import { SlackAppMentionEventSchema } from '~/schemas/slack/app-mention-event.js';
import { SlackMessageSchema } from '~/schemas/slack/message.js';

import type { SlackWebClientLike } from '../types.js';

import { handleThreadConversation } from './conversation-pipeline.js';
import {
  createBotUserIdResolver,
  shouldSkipBotAuthoredMessage,
  shouldSkipMessageForForeignMention,
} from './message-filter.js';
import type { SlackIngressDependencies } from './types.js';

export type { SlackIngressDependencies, ThreadConversationMessage } from './types.js';
export { handleThreadConversation } from './conversation-pipeline.js';
export { WORKSPACE_PICKER_ACTION_ID } from './workspace-resolution.js';

const DEFAULT_ASSISTANT_PROMPTS = [
  {
    title: 'Summarize a thread',
    message: 'Please summarize the latest discussion in this thread.',
  },
  {
    title: 'Review code changes',
    message: 'Please review the recent code changes and call out risks.',
  },
  {
    title: 'Draft a plan',
    message: 'Please create an implementation plan for this task.',
  },
] as const;

export function createAppMentionHandler(deps: SlackIngressDependencies) {
  return async (args: { client: unknown; event: unknown }): Promise<void> => {
    const mention = SlackAppMentionEventSchema.parse(args.event);
    await handleThreadConversation(args.client as SlackWebClientLike, mention, deps, {
      logLabel: 'app mention',
      addAcknowledgementReaction: true,
      rootMessageTs: mention.ts,
    });
  };
}

export function createThreadReplyHandler(deps: SlackIngressDependencies) {
  const getBotUserId = createBotUserIdResolver(deps.logger);

  return async (args: { client: unknown; event: unknown }): Promise<void> => {
    const parsed = SlackMessageSchema.safeParse(args.event);
    if (!parsed.success) {
      return;
    }

    const message = parsed.data;
    const threadTs = message.thread_ts;
    const client = args.client as SlackWebClientLike;

    if (!threadTs) {
      return;
    }

    const session = deps.sessionStore.get(threadTs);
    if (!session) {
      return;
    }

    const channelId = typeof message.channel === 'string' ? message.channel : undefined;
    const teamId = typeof message.team === 'string' ? message.team : undefined;
    if (!channelId || !teamId) {
      runtimeError(
        deps.logger,
        'Skipping thread reply without channel/team id for thread %s',
        threadTs,
      );
      return;
    }

    const botUserId = await getBotUserId(client);
    const senderId = message.user?.trim() || message.bot_id?.trim();
    if (!senderId) {
      return;
    }

    if (shouldSkipBotAuthoredMessage(deps.logger, 'thread reply', threadTs, message, botUserId)) {
      return;
    }

    if (
      shouldSkipMessageForForeignMention(
        deps.logger,
        'thread reply',
        threadTs,
        message.text,
        botUserId,
      )
    ) {
      return;
    }

    await handleThreadConversation(
      client,
      {
        channel: channelId,
        team: teamId,
        text: message.text,
        thread_ts: threadTs,
        ts: message.ts,
        user: senderId,
      },
      deps,
      {
        logLabel: 'thread reply',
        addAcknowledgementReaction: false,
        rootMessageTs: session.rootMessageTs,
      },
    );
  };
}

export function createAssistantThreadStartedHandler(
  deps: SlackIngressDependencies,
): AssistantThreadStartedMiddleware {
  return async ({ logger, setSuggestedPrompts }) => {
    try {
      await setSuggestedPrompts({
        title: 'Try asking me to...',
        prompts: [...DEFAULT_ASSISTANT_PROMPTS],
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      runtimeError(
        deps.logger,
        'Failed to configure assistant thread prompts: %s',
        redact(errorMessage),
      );
      logger.error('Failed to configure assistant thread prompts: %s', errorMessage);
    }
  };
}

export function createAssistantUserMessageHandler(
  deps: SlackIngressDependencies,
): AssistantUserMessageMiddleware {
  const getBotUserId = createBotUserIdResolver(deps.logger);

  return async (args) => {
    const parsed = SlackMessageSchema.safeParse(args.message);
    if (!parsed.success) {
      return;
    }

    const message = parsed.data;
    const threadTs = message.thread_ts;
    const channelId = typeof message.channel === 'string' ? message.channel : undefined;
    const teamId =
      typeof args.context.teamId === 'string'
        ? args.context.teamId
        : typeof args.body.team_id === 'string'
          ? args.body.team_id
          : undefined;
    const userId =
      typeof args.context.userId === 'string'
        ? args.context.userId
        : typeof message.user === 'string'
          ? message.user
          : undefined;

    if (!threadTs || !channelId || !teamId || !userId || !message.text.trim()) {
      runtimeError(
        deps.logger,
        'Skipping assistant message without required identifiers (channel=%s thread=%s team=%s user=%s)',
        channelId ?? 'missing',
        threadTs ?? 'missing',
        teamId ?? 'missing',
        userId ?? 'missing',
      );
      return;
    }

    const client = args.client as unknown as SlackWebClientLike;
    const botUserId = await getBotUserId(client);
    if (
      shouldSkipMessageForForeignMention(
        deps.logger,
        'assistant user message',
        threadTs,
        message.text,
        botUserId,
      )
    ) {
      return;
    }

    const existingSession = deps.sessionStore.get(threadTs);
    if (!existingSession) {
      await args.setTitle(message.text).catch((error: unknown) => {
        deps.logger.warn('Failed to set assistant thread title: %s', String(error));
      });
    }

    await handleThreadConversation(
      client,
      {
        channel: channelId,
        team: teamId,
        text: message.text,
        thread_ts: threadTs,
        ts: message.ts,
        user: userId,
      },
      deps,
      {
        logLabel: 'assistant user message',
        addAcknowledgementReaction: false,
        rootMessageTs: threadTs,
      },
    );
  };
}
```

- **Step 2: Run full test suite**

Run: `pnpm test`
Expected: ALL tests pass — `slack-loading-status.test.ts`, `thread-reply-ingress.test.ts`, `workspace-picker-action.test.ts`, and all new tests.

- **Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: No type errors.

- **Step 4: Commit**

```bash
git add src/slack/ingress/app-mention-handler.ts
git commit -m "refactor: rewrite app-mention-handler to use conversation pipeline"
```

---

### Task 9: Final verification

**Files:** None (verification only)

- **Step 1: Run the full test suite**

Run: `pnpm test`
Expected: All tests pass.

- **Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: No type errors.

- **Step 3: Run build**

Run: `pnpm build`
Expected: Build succeeds with no errors.

- **Step 4: Verify file sizes**

Run: `wc -l src/slack/ingress/*.ts src/logger/runtime.ts`

Expected approximate line counts:

- `app-mention-handler.ts`: ~150 lines
- `activity-sink.ts`: ~180 lines
- `conversation-pipeline.ts`: ~120 lines
- `message-filter.ts`: ~100 lines
- `session-manager.ts`: ~60 lines
- `types.ts`: ~60 lines
- `workspace-resolution.ts`: ~80 lines
- `logger/runtime.ts`: ~15 lines

No single file should exceed ~200 lines.

- **Step 5: Final commit (if any formatting changes from build)**

```bash
git add -A
git status
# Only commit if there are formatting changes from the build step
git commit -m "chore: format after refactoring"
```
