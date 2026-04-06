# Stop Slash Command

Add a `/stop` slash command that can be invoked inside a Slack thread to stop all in-flight bot executions for that thread, preserve already-posted partial output, and clearly mark the interrupted response as user-stopped.

## Problem

The bot currently supports thread-scoped replies, provider switching, session inspection, and memory/workspace commands, but it does not provide a user-controlled way to interrupt an in-progress reply.

This creates three problems:

- Long-running replies cannot be interrupted from Slack once started.
- Temporary Slack UI such as thinking/progress state can remain visible until the run ends naturally.
- Partial output looks indistinguishable from a normal completion if the user wants to stop the run midway.

The current architecture also does not expose cancellation in the executor contract. Thread replies call `handleThreadConversation()`, which ultimately awaits `executor.execute(...)`, but there is no thread-scoped execution registry and no abort path in `AgentExecutionRequest` or `AgentExecutor`.

## Goals

- Add a new `/stop` slash command.
- Restrict `/stop` to use inside the target thread.
- Stop all active bot executions associated with the current thread.
- Preserve any bot output already posted before the stop.
- Mark interrupted output as stopped by the user.
- Clear transient Slack UI such as thinking/progress state during stop finalization.
- Keep the current thread behavior otherwise unchanged: future messages in the thread may still trigger new runs.

## Non-goals

- Do not introduce thread pausing or resume semantics.
- Do not add new permissions or ownership checks; anyone in the thread can invoke `/stop`.
- Do not change the existing concurrency model. If multiple runs are already active in one thread, `/stop` stops all of them.
- Do not redesign unrelated slash command infrastructure.

## Approach

Introduce thread-scoped execution tracking plus real cancellation propagation from the Slack command layer to the executor layer.

The feature has four main pieces:

1. A `ThreadExecutionRegistry` that tracks all active executions by `threadTs`.
2. A cancellation-capable executor contract so active runs can be aborted.
3. A `/stop` slash command handler that resolves the current thread and stops every active execution registered for it.
4. A stopped-finalization path in the Slack activity/rendering flow that clears transient UI but preserves visible partial output and annotates it as stopped.

## User-facing behavior

### Successful use

When a user invokes `/stop` inside a thread that has active runs:

- The command stops every active execution for that `thread_ts`.
- The command replies ephemerally with a summary such as `Stopped 2 in-progress replies in this thread.`
- Any already-posted assistant content remains in the thread.
- Temporary UI such as thinking state or progress indicators is cleared.
- The interrupted assistant output is marked with a visible stopped note such as `_Stopped by user._`

### Invalid context

When a user invokes `/stop` outside a thread:

- The command returns an ephemeral response such as `Use /stop inside the thread you want to stop.`

### No active work

When the thread has no active runs:

- The command returns an ephemeral response such as `There is no in-progress reply in this thread.`

### Partial failure

If multiple active runs exist and only some stop successfully:

- The command uses best-effort cancellation for all runs.
- The response reports both the number stopped and the number that failed to stop.
- Failures are logged for diagnosis.

## File and type changes

### Slash commands

Add:

- `src/slack/commands/stop-command.ts`

Update:

- `src/slack/commands/register.ts`
- `src/slack/commands/manifest-sync.ts`
- `src/slack/commands/types.ts`

`/stop` should follow the existing `/provider` registration pattern because it needs `command.thread_ts` and `command.channel_id`, not just `command.text`.

### Execution tracking

Add a new thread-scoped registry module, for example:

- `src/slack/execution/thread-execution-registry.ts`

This module owns active execution registration and stop lookup. It should not own rendering or session persistence.

### Executor contract

Update:

- `src/agent/types.ts`
- `src/agent/providers/claude-code/adapter.ts`
- Any provider-registry types or call sites that depend on `AgentExecutor`

The contract should expose real cancellation, preferably via `AbortSignal`, while still preserving the current `execute()` call shape as much as possible.

### Conversation pipeline and rendering

Update:

- `src/slack/ingress/conversation-pipeline.ts`
- `src/slack/ingress/activity-sink.ts`
- `src/slack/render/slack-renderer.ts`

The pipeline should register executions before starting the agent, unregister them in every terminal path, and distinguish normal completion, failure, and user stop.

## ThreadExecutionRegistry design

The registry tracks active executions per thread. It exists to answer one question reliably: "what can be stopped for this thread right now?"

Suggested public interface:

```ts
export interface RegisteredThreadExecution {
  executionId: string;
  threadTs: string;
  channelId: string;
  userId: string;
  providerId: string;
  startedAt: string;
  stop: (reason: 'user_stop') => Promise<void>;
}

export interface StopAllResult {
  stopped: number;
  failed: number;
}

export interface ThreadExecutionRegistry {
  register: (execution: RegisteredThreadExecution) => () => void;
  listActive: (threadTs: string) => RegisteredThreadExecution[];
  stopAll: (threadTs: string, reason: 'user_stop') => Promise<StopAllResult>;
}
```

Design notes:

- `register()` returns a cleanup function so the pipeline can reliably unregister in `finally`.
- `stopAll()` performs best-effort cancellation across every active execution in the thread.
- The registry is in-memory only. Active executions are process-local and do not need persistence.
- This is intentionally thread-scoped, not session-scoped, because `/stop` is a thread UX feature.

## Executor cancellation design

The current `AgentExecutionRequest` and `AgentExecutor` interfaces do not support aborting a run. This feature requires explicit cancellation support.

Recommended change:

```ts
export interface AgentExecutionRequest {
  channelId: string;
  mentionText: string;
  threadContext: NormalizedThreadContext;
  threadTs: string;
  userId: string;
  abortSignal?: AbortSignal;
  contextMemories?: ContextMemories;
  resumeHandle?: string;
  workspaceLabel?: string;
  workspacePath?: string;
  workspaceRepoId?: string;
}
```

The conversation pipeline should create an `AbortController` per execution and pass `controller.signal` into `execute()`.

`ClaudeAgentSdkExecutor` should translate that signal into a real stop of the SDK-backed run. If the Claude SDK already supports abort propagation, use it directly. If not, the adapter should wrap the execution loop with an interruptible mechanism so an aborted signal terminates the stream and does not emit further assistant output into Slack.

Stopping a run must be treated as a distinct terminal state, not as a generic failure.

## Conversation lifecycle

### Start path

For every inbound thread-triggered run:

1. Build the normal pipeline context.
2. Create an `AbortController` for the execution.
3. Register the execution in `ThreadExecutionRegistry` before calling the executor.
4. Run the executor.
5. In `finally`, unregister the execution and finalize the activity sink.

### Stop path

When `/stop` is invoked inside a thread:

1. Resolve `thread_ts` from the Slack command payload.
2. Validate that `thread_ts` exists; otherwise return the "use inside a thread" message.
3. Call `threadExecutionRegistry.stopAll(threadTs, 'user_stop')`.
4. Return an ephemeral summary based on the stop result.

### Terminal paths

Each run must end in exactly one of these states:

- `completed`
- `failed`
- `stopped`

This state should drive finalization behavior so Slack UI cleanup is consistent and downstream code does not have to infer whether a thrown error was a user stop or a genuine execution failure.

## Rendering and finalization

The activity/rendering layer currently knows how to show thinking/progress and finalize output, but it needs an explicit stopped path.

Requirements for stopped finalization:

- Clear thinking indicator or assistant status.
- Clear or delete transient progress UI.
- Preserve any assistant messages already posted.
- Avoid posting the generic failure reply.
- Add a visible stopped note to the run's final visible output, for example `_Stopped by user._`

The stopped note does not need to retroactively edit every previously posted chunk. It is sufficient to annotate the final visible output associated with the interrupted run, as long as the thread clearly communicates that the reply was intentionally interrupted.

## Error handling

- `/stop` outside a thread returns a validation error to the caller and does not attempt any registry lookup.
- `/stop` on a thread with no active executions returns a no-op success response.
- If cancellation throws for one execution, the registry continues attempting to stop the remaining ones.
- A stopped run should not surface as `An error occurred while processing your request.`
- If an already-stopped or already-finished run receives another stop signal, treat it as harmless and idempotent.

## Testing strategy

Per project convention, this feature needs implementation tests under `tests/` plus a live Slack E2E scenario.

### Unit tests

Add or update tests for:

- `/stop` outside a thread returns the expected ephemeral validation message.
- `/stop` with no active execution returns the expected no-op message.
- `/stop` stops all active executions for the thread.
- Partial stop failure reports both stopped and failed counts.
- The conversation pipeline unregisters executions on completion, failure, and stop.
- A stopped run does not emit the generic error reply.
- The renderer/activity sink clears transient UI and emits the stopped marker.

### Live E2E

Add a new live scenario under `src/e2e/live/` that:

1. Starts the app.
2. Posts a thread message that triggers a long-running reply.
3. Invokes `/stop` in the same thread while the reply is still active.
4. Polls until the thread stops changing.
5. Asserts that:

- no further assistant output is added after stop settles
- temporary loading/progress UI is gone
- the thread contains a visible stopped marker

## Rollout notes

- The command name is `/stop`.
- Anyone in the thread may invoke it.
- The scope is the current Slack thread only.
- Existing concurrency behavior remains unchanged; `/stop` simply stops every currently active run for that thread.

## Open design decision resolved

The system may already allow overlapping executions in a single thread because there is no current thread-level lock in the ingress pipeline. This design does not change that behavior. Instead, it makes `/stop` explicitly mean "stop all active executions for this thread."
