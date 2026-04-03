# SPEC-006: Session Lifecycle and Storage

## 1. Scope

| Item                 | Definition                           |
| -------------------- | ------------------------------------ |
| Session identity     | Slack thread-scoped Claude work unit |
| Primary key          | Slack `threadTs`                     |
| Current storage mode | In-memory store                      |
| Future storage mode  | Replaceable persistent backend       |

- This specification defines how thread-level work is tracked across ingress, streaming, and completion.
- It separates transient runtime mechanics from executor semantics.

## 2. Session Objectives

| Objective           | Requirement                                            |
| ------------------- | ------------------------------------------------------ |
| Stable identity     | One canonical record per Slack thread                  |
| Stream continuity   | Store the active Slack stream timestamp when available |
| Executor continuity | Store Claude session identifiers when available        |
| Replaceability      | The storage implementation must remain pluggable       |

## 3. State Machine

```text
[Unseen Thread]
      |
      v
[Registered]
  - rootMessageTs known
  - threadTs known
      |
      v
[Bootstrapped]
  - bootstrapMessageTs known
      |
      v
[Streaming]
  - streamMessageTs known
      |
      +--> [Completed]
      |
      +--> [Failed]
```

- The in-memory implementation may store only the latest record snapshot.
- The logical state machine remains valid regardless of storage backend.

## 4. Session Record Contract

| Field                | Required | Meaning                             |
| -------------------- | -------- | ----------------------------------- |
| `channelId`          | Yes      | Slack channel                       |
| `threadTs`           | Yes      | Canonical thread key                |
| `rootMessageTs`      | Yes      | Original mention timestamp          |
| `bootstrapMessageTs` | No       | First service-authored thread reply |
| `streamMessageTs`    | No       | Slack stream timestamp              |
| `claudeSessionId`    | No       | Backend Claude session identifier   |
| `createdAt`          | Yes      | Record creation instant             |
| `updatedAt`          | Yes      | Last mutation instant               |

## 5. Mutation Rules

| Operation | Requirement                                         |
| --------- | --------------------------------------------------- |
| `get`     | Return the current snapshot for a thread or nothing |
| `upsert`  | Create or replace the thread record atomically      |
| `patch`   | Update selected fields and refresh `updatedAt`      |

- Callers must treat the store as the source of thread/session truth.
- Mutation methods must not mutate caller-owned objects in place.

## 6. Recovery and Evolution

| Topic                   | Requirement                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------ |
| Process restart         | Current in-memory store loses state                                                        |
| Durable store migration | Future backend must implement the same interface                                           |
| Resume semantics        | Must depend on persisted `threadTs`, `streamMessageTs`, and `claudeSessionId` if available |
| Orphan cleanup          | Future persistent backends must define retention policy                                    |

- The current in-memory implementation is acceptable for scaffold-stage development.
- Production-ready deployment requires a durable persistence plan.

## 7. Failure Semantics

| Failure                      | Required behavior                      |
| ---------------------------- | -------------------------------------- |
| Missing session during patch | Return a non-throwing miss result      |
| Duplicate upsert             | Replace the snapshot deterministically |
| Partial bootstrap failure    | Preserve enough state for diagnostics  |

## 8. Acceptance Criteria

| Criterion                                            | Evidence                             |
| ---------------------------------------------------- | ------------------------------------ |
| The application can map a thread to its session data | Session store tests                  |
| Stream timestamps are persisted when created         | Integration or unit verification     |
| Storage backend replacement is structurally possible | Interface-only coupling from callers |
