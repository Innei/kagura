# SPEC-002: Slack Ingress and Threading

## 1. Scope

| Item                          | Definition                                 |
| ----------------------------- | ------------------------------------------ |
| Primary trigger               | Slack `app_mention`                        |
| Primary surfaces              | Channel root messages and existing threads |
| First visible acknowledgement | Slack reaction on the mentioned message    |
| Execution target              | Thread-scoped Claude session               |

- This specification defines how Slack mentions become thread-bound execution requests.
- It does not define Claude stream semantics or UI-state payload structure; those belong to later specifications.

## 2. Ingress Objectives

| Objective                     | Requirement                                                            |
| ----------------------------- | ---------------------------------------------------------------------- |
| Deterministic acknowledgement | The service must react before beginning long-running work              |
| Thread continuity             | Every execution must bind to a single Slack thread                     |
| Idempotent handling           | Duplicate deliveries must not spawn duplicate work                     |
| Context capture               | The full target thread must be replayed before Claude execution begins |

## 3. High-Level Flow

```text
[Slack app_mention event]
        |
        v
[Ack to Slack]
        |
        v
[Add Reaction to Mentioned Message]
        |
        v
[Resolve Target Thread]
  - if thread_ts exists -> continue thread
  - else -> use event.ts as thread root
        |
        v
[Post Bootstrap Reply]
        |
        v
[Load Thread Context]
        |
        v
[Open Stream + Delegate to Claude]
```

- Reaction emission is the first operator-visible action.
- The bootstrap reply establishes the working thread for channel-root mentions.
- Thread resolution must be complete before any execution request is built.

## 4. Event Contract

| Field       | Source              | Requirement              |
| ----------- | ------------------- | ------------------------ |
| `type`      | Slack event payload | Must equal `app_mention` |
| `channel`   | Slack event payload | Required                 |
| `user`      | Slack event payload | Required                 |
| `text`      | Slack event payload | Required                 |
| `ts`        | Slack event payload | Required                 |
| `thread_ts` | Slack event payload | Optional                 |

- The inbound event must be schema-validated before orchestration begins.
- Unknown additional fields may be preserved but must not be required for core flow correctness.

## 5. Thread Resolution Rules

| Situation                         | `threadTs` result | Required action                           |
| --------------------------------- | ----------------- | ----------------------------------------- |
| Mention on root channel message   | `event.ts`        | Create bootstrap reply in new thread      |
| Mention inside existing thread    | `event.thread_ts` | Continue the existing thread              |
| Invalid or missing timestamp data | None              | Fail the request and log an ingress error |

- The root mention timestamp remains the canonical thread key for new work.
- Thread resolution must not depend on message text parsing.

## 6. Bootstrap Rules

| Step                 | Required behavior                                                      |
| -------------------- | ---------------------------------------------------------------------- |
| Acknowledgement      | Add configured reaction to the mentioned message                       |
| Thread creation      | Post a first service-authored reply in the target thread               |
| Stream start         | Open a Slack stream tied to the target thread                          |
| Session registration | Persist the thread/session record before execution advances materially |

- The bootstrap reply may be minimal, but it must exist for root mentions.
- The stream message and bootstrap reply may be separate Slack artifacts.

## 7. Idempotency and Deduplication

| Risk                               | Required mitigation                                                     |
| ---------------------------------- | ----------------------------------------------------------------------- |
| Duplicate Slack event delivery     | Store and reject duplicate `event_id` or equivalent ingress fingerprint |
| Replayed root mention              | Reuse existing thread/session if already created                        |
| Late retries after partial success | Operations must be safe to replay when practical                        |

- The current scaffold does not yet implement a durable deduplication store.
- This requirement is normative for the next implementation batch.

## 8. Failure Semantics

| Failure point               | Required behavior                                                          |
| --------------------------- | -------------------------------------------------------------------------- |
| Reaction failure            | Log the failure; decide whether to continue based on recoverability policy |
| Bootstrap reply failure     | Abort execution; the thread contract has not been established              |
| Thread context load failure | Abort execution and emit operator-visible failure text if possible         |
| Stream start failure        | Abort execution; Claude must not start without a render target             |

```text
[Ingress Step]
      |
      +--> success -> next step
      |
      +--> failure -> log + classify
                       |
                       +--> recoverable -> continue
                       +--> terminal -> abort request
```

- Terminal failures must be explicit in logs.
- Recoverability policy must be documented per failure class.

## 9. Acceptance Criteria

| Criterion                                        | Evidence                               |
| ------------------------------------------------ | -------------------------------------- |
| Root `@mention` creates a thread-scoped workflow | Integration verification against Slack |
| Thread `@mention` continues the original thread  | Integration verification against Slack |
| Reaction is emitted before long-running work     | Timestamped ingress/render logs        |
| Target thread is resolved deterministically      | Unit coverage of resolution rules      |
