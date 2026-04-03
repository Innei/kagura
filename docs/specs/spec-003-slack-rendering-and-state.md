# SPEC-003: Slack Rendering and State

## 1. Scope

| Item                  | Definition                                                        |
| --------------------- | ----------------------------------------------------------------- |
| Text rendering        | Slack streaming APIs                                              |
| State rendering       | `assistant.threads.setStatus`                                     |
| State producer        | Claude, not the Slack layer                                       |
| Presentation surfaces | `loading_messages`, `status`, streamed text, future task timeline |

- This specification defines how Claude output is projected onto Slack.
- The Slack layer is a transport adapter, not a state-authoring layer.

## 2. Governing Principle

| Principle          | Requirement                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| State authorship   | `loading_messages` and `status` must be produced by Claude                                                         |
| Transport purity   | Slack renderers may validate, forward, clear, or reject invalid state; they may not invent user-visible state text |
| Surface separation | Text stream and UI-state stream must remain distinct                                                               |

- Hardcoded Slack status copy is explicitly prohibited.
- Slack may clear status on finalization, but it may not synthesize replacement text.

## 3. Rendering Surfaces

| Surface          | Slack API                                                    | Producer                   | Persistence profile  |
| ---------------- | ------------------------------------------------------------ | -------------------------- | -------------------- |
| Loading messages | `assistant.threads.setStatus.loading_messages`               | Claude                     | Ephemeral            |
| Status line      | `assistant.threads.setStatus.status`                         | Claude                     | Ephemeral            |
| Text stream      | `chat.startStream` / `chat.appendStream` / `chat.stopStream` | Claude text deltas         | Conversation-visible |
| Task timeline    | Stream chunks such as `task_update`                          | Claude and executor bridge | Conversation-visible |

## 4. Rendering Flow

```text
[Claude Executor Events]
        |
        +--> [text-delta] -------> [chat.appendStream]
        |
        +--> [ui-state] ---------> [assistant.threads.setStatus]
        |
        +--> [lifecycle.complete] -> [clear status] -> [chat.stopStream]
        |
        +--> [lifecycle.failed] ---> [append failure text] -> [clear status] -> [chat.stopStream]
```

- Stream finalization must clear residual status.
- A failed execution still requires deterministic stream closure.

## 5. UI-State Contract

| Field             | Type        | Requirement                                |
| ----------------- | ----------- | ------------------------------------------ |
| `threadTs`        | `string`    | Required                                   |
| `status`          | `string?`   | Optional, max-length constrained in schema |
| `loadingMessages` | `string[]?` | Optional, maximum 10                       |
| `clear`           | `boolean`   | Required semantic flag                     |

- A `clear` operation overrides all display fields.
- Non-clear updates must contain at least one display-bearing field.
- The renderer must reject invalid payloads before calling Slack.

## 6. Stream Semantics

| Phase        | Requirement                                                           |
| ------------ | --------------------------------------------------------------------- |
| Stream start | One stream per execution attempt                                      |
| Delta append | Append only non-empty text                                            |
| Stream stop  | Always called exactly once on terminal completion or terminal failure |
| Final text   | Optional terminal summary text may be provided during stop            |

- Stream timestamps must be persisted in session state if later resume semantics depend on them.
- Slack renderer implementations must treat stream timestamps as opaque identifiers.

## 7. Future Task Timeline Contract

| Field     | Role                          |
| --------- | ----------------------------- | ----------- | -------- | ------ |
| `id`      | Stable task identity          |
| `title`   | User-visible task label       |
| `status`  | `pending                      | in_progress | complete | error` |
| `details` | Optional supplementary text   |
| `output`  | Optional task result fragment |

- This project reserves support for `task_update` and `plan_update` chunks.
- Task labels may eventually be Claude-authored or executor-authored, but that policy must be specified before implementation.

## 8. Failure Semantics

| Failure                  | Required behavior                                                            |
| ------------------------ | ---------------------------------------------------------------------------- |
| Invalid UI-state payload | Reject locally, log validation failure, do not send malformed state to Slack |
| Status update failure    | Log render failure and continue if text streaming remains viable             |
| Stream append failure    | Treat as terminal render failure unless retry policy is explicitly defined   |
| Stream stop failure      | Log loudly; the session may require manual cleanup                           |

## 9. Acceptance Criteria

| Criterion                                                        | Evidence                                            |
| ---------------------------------------------------------------- | --------------------------------------------------- |
| Claude-authored status is rendered without Slack-side hardcoding | Integration logs and code review                    |
| Text and state paths are separate                                | Module and test coverage of distinct renderer paths |
| Terminal sessions clear status and close streams                 | Integration verification                            |
