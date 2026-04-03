# SPEC-005: Thread Context Normalization

## 1. Scope

| Item             | Definition                                     |
| ---------------- | ---------------------------------------------- |
| Input            | Slack thread reply history                     |
| Output           | Canonical normalized thread context for Claude |
| Current priority | Correct extraction of `section` block content  |
| Future extension | Broader `rich_text` and block coverage         |

- This specification defines how Slack messages become stable prompt material.
- It is intentionally separate from Slack ingress so normalization rules can evolve independently.

## 2. Normalization Objectives

| Objective    | Requirement                                                                                         |
| ------------ | --------------------------------------------------------------------------------------------------- |
| Determinism  | The same Slack payload must normalize to the same canonical text                                    |
| Fidelity     | Human-authored content in `text`, `section.text`, and `section.fields[]` must survive normalization |
| Safety       | Unknown or malformed blocks must not crash normalization                                            |
| Traceability | Each normalized entry must retain timestamps and author identity when available                     |

## 3. Normalization Pipeline

```text
[Slack replies payload]
        |
        v
[Schema validation]
        |
        v
[Per-message normalization]
  - derive thread ts
  - extract text
  - flatten section text
  - flatten section fields
  - remove empty lines
        |
        v
[Normalized thread message list]
        |
        v
[Rendered thread prompt]
```

## 4. Source Handling Rules

| Source              | Rule                                |
| ------------------- | ----------------------------------- |
| `message.text`      | Include directly                    |
| `section.text`      | Include directly                    |
| `section.fields[]`  | Flatten into line-oriented segments |
| Unknown block types | Ignore in the current version       |
| Empty content       | Drop from normalized output         |

- The current version is intentionally conservative.
- Unsupported blocks are ignored rather than heuristically parsed.

## 5. Message Record Contract

| Field      | Meaning                                     |
| ---------- | ------------------------------------------- |
| `ts`       | Original message timestamp                  |
| `threadTs` | Canonical thread identifier                 |
| `authorId` | Slack user or bot identifier when available |
| `text`     | Cleaned canonical text                      |
| `rawText`  | Pre-deduplication combined text snapshot    |

- `text` is intended for prompt rendering.
- `rawText` is retained for debugging and future refinement.

## 6. Prompt Rendering Rules

| Rule           | Requirement                                                |
| -------------- | ---------------------------------------------------------- |
| Ordering       | Preserve Slack reply order                                 |
| Header format  | Each message must identify sequence, timestamp, and author |
| Empty messages | Exclude from the rendered prompt                           |
| Deduplication  | Remove exact duplicate lines within a message              |

```text
Slack thread context:
Message 1 | ts=<...> | author=<...>
<normalized text>

Message 2 | ts=<...> | author=<...>
<normalized text>
```

- The rendered prompt must remain legible to a human reviewer.
- Message boundaries must not be collapsed across authors.

## 7. Extension Path

| Future area               | Planned handling                                           |
| ------------------------- | ---------------------------------------------------------- |
| `rich_text`               | Add explicit parsing rules rather than ad hoc fallbacks    |
| Attachments and files     | Define a separate attachment normalization policy          |
| Message edits and deletes | Add replay policy when those events are brought into scope |

## 8. Acceptance Criteria

| Criterion                                     | Evidence                            |
| --------------------------------------------- | ----------------------------------- |
| `section.text` is preserved                   | Unit coverage of section extraction |
| `section.fields[]` is preserved               | Unit coverage of field flattening   |
| Unsupported blocks do not break normalization | Negative-path tests                 |
| Prompt output is deterministic                | Snapshot-style normalization tests  |
