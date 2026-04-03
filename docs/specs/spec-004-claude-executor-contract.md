# SPEC-004: Claude Executor Contract

## 1. Scope

| Item                | Definition                                                 |
| ------------------- | ---------------------------------------------------------- |
| Execution backend   | Claude Agent SDK                                           |
| Executor role       | Convert normalized Slack work into Claude session activity |
| Output shape        | Text deltas, UI-state updates, lifecycle events            |
| Replaceability goal | Preserve a stable interface even if the backend changes    |

- This specification defines the boundary between application orchestration and Claude execution.
- It does not define Slack rendering details; those are specified separately.

## 2. Request Contract

| Field           | Type              | Meaning                           |
| --------------- | ----------------- | --------------------------------- |
| `channelId`     | `string`          | Slack channel identifier          |
| `threadTs`      | `string`          | Canonical Slack thread identifier |
| `userId`        | `string`          | Slack user who initiated the turn |
| `mentionText`   | `string`          | Raw `@mention` message text       |
| `threadContext` | structured object | Normalized thread replay payload  |

- The executor must not perform Slack API lookups directly if the context has already been provided.
- The executor consumes normalized context, not raw Slack payloads.

## 3. Event Contract

| Event type   | Required fields | Meaning                                |
| ------------ | --------------- | -------------------------------------- |
| `lifecycle`  | `phase`         | Session start, completion, or failure  |
| `text-delta` | `text`          | Incremental user-visible response text |
| `ui-state`   | `state`         | Claude-authored Slack status payload   |

| Lifecycle phase | Required fields               | Meaning                                   |
| --------------- | ----------------------------- | ----------------------------------------- |
| `started`       | optional `sessionId`          | Claude execution has begun                |
| `completed`     | optional `sessionId`          | Claude execution has ended successfully   |
| `failed`        | `error`, optional `sessionId` | Claude execution has ended unsuccessfully |

## 4. Executor Loop

```text
[Normalized Execution Request]
        |
        v
[Create / continue Claude session]
        |
        v
[Consume Agent SDK stream]
        |
        +--> assistant text -> emit text-delta
        |
        +--> publish_state tool -> emit ui-state
        |
        +--> terminal result -> emit lifecycle.complete
        |
        +--> exception/error -> emit lifecycle.failed
```

- The executor is event-driven.
- The application layer owns side effects such as Slack API calls.
- The executor must not assume a single rendering surface.

## 5. Claude UI-State Publication

| Concern         | Requirement                                                        |
| --------------- | ------------------------------------------------------------------ |
| Source          | Claude must publish UI-state via a structured tool contract        |
| Validation      | UI-state must be parsed through Zod before emission                |
| Tool role       | The tool is a state publication mechanism, not a Slack API wrapper |
| Thread affinity | Every payload must name the target `threadTs`                      |

- This preserves the principle that Claude produces state while the application renders it.
- The executor may reject malformed state without attempting fallback text synthesis.

## 6. Agent SDK Requirements

| Area           | Requirement                                         |
| -------------- | --------------------------------------------------- |
| Session mode   | Support multi-turn execution                        |
| Streaming      | Surface partial assistant text incrementally        |
| Tooling        | Support a custom state-publication tool             |
| Limits         | Respect configured max-turn ceilings                |
| Error handling | Convert SDK failures into `lifecycle.failed` events |

- The executor implementation may begin as a scaffold, but the interface is normative now.
- Backend-specific details must remain hidden behind the executor boundary.

## 7. Non-Goals

| Topic                                | Reason for exclusion               |
| ------------------------------------ | ---------------------------------- |
| Slack formatting decisions           | Belongs to renderer specs          |
| Persistent session storage mechanics | Belongs to session lifecycle specs |
| Filesystem permission policy         | Belongs to security specs          |

## 8. Acceptance Criteria

| Criterion                                                | Evidence                                                 |
| -------------------------------------------------------- | -------------------------------------------------------- |
| The executor exposes a stable request and event contract | TypeScript interface review                              |
| Claude-authored UI state flows through a validated path  | Unit coverage of state parsing                           |
| Backend replacement remains possible                     | Application logic depends on the executor interface only |
