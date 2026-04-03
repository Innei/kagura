# Slack Claude SDK Specification Index

## 1. Specification Set

| Spec ID    | Document                                                                                                                       | Theme                                               | Primary Output                            |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- | ----------------------------------------- |
| `SPEC-001` | [Runtime and Configuration](/Users/innei/git/innei-repo/slack-cc-bot/docs/specs/spec-001-runtime-and-config.md)                | Runtime, compiler, env, logger                      | Stable process and configuration baseline |
| `SPEC-002` | [Slack Ingress and Threading](/Users/innei/git/innei-repo/slack-cc-bot/docs/specs/spec-002-slack-ingress-and-threading.md)     | `@mention` intake and thread creation               | Deterministic Slack entry flow            |
| `SPEC-003` | [Slack Rendering and State](/Users/innei/git/innei-repo/slack-cc-bot/docs/specs/spec-003-slack-rendering-and-state.md)         | Streaming output, loading messages, status          | Unified Slack presentation contract       |
| `SPEC-004` | [Claude Executor Contract](/Users/innei/git/innei-repo/slack-cc-bot/docs/specs/spec-004-claude-executor-contract.md)           | Agent SDK boundary and event model                  | Replaceable Claude execution interface    |
| `SPEC-005` | [Thread Context Normalization](/Users/innei/git/innei-repo/slack-cc-bot/docs/specs/spec-005-thread-context-normalization.md)   | Slack message flattening rules                      | Canonical thread prompt material          |
| `SPEC-006` | [Session Lifecycle and Storage](/Users/innei/git/innei-repo/slack-cc-bot/docs/specs/spec-006-session-lifecycle-and-storage.md) | Thread/session mapping and recovery                 | Stable session orchestration model        |
| `SPEC-007` | [Security and Permissions](/Users/innei/git/innei-repo/slack-cc-bot/docs/specs/spec-007-security-and-permissions.md)           | Secret handling, tool boundaries, permission policy | Operational safety baseline               |

- This index is the entry point for all future implementation batches.
- Every implementation batch must cite at least one of the documents listed above.
- The previous single-document baseline has been decomposed into the focused specifications below.

## 2. Implementation Mapping

| Batch   | Driving Specs          | Expected Outcome                                                 |
| ------- | ---------------------- | ---------------------------------------------------------------- |
| Batch A | `SPEC-001`, `SPEC-002` | Production-grade Slack bootstrap, configuration, and intake path |
| Batch B | `SPEC-003`, `SPEC-004` | Live Claude Agent SDK streaming and UI-state rendering           |
| Batch C | `SPEC-005`, `SPEC-006` | Full thread replay, session continuity, and resumability         |
| Batch D | `SPEC-007`             | Hardened permission model, redaction, and operational controls   |

```text
[Specification Set]
        |
        v
[Implementation Batch]
        |
        v
[Verification]
        |
        v
[Next Specification Revision]
```

- The project will advance in specification-first increments.
- A batch is ready for implementation only after its governing spec set is stable.
