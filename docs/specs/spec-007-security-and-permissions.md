# SPEC-007: Security and Permissions

## 1. Scope

| Item                | Definition                                                               |
| ------------------- | ------------------------------------------------------------------------ |
| Secret scope        | Slack credentials, Anthropic credentials, future persistence credentials |
| Permission scope    | Claude tool execution, filesystem access, networked side effects         |
| Observability scope | Logs, failure messages, and operator diagnostics                         |
| Safety principle    | Minimize silent privilege expansion                                      |

- This specification defines the project-wide security and permission baseline.
- It does not prescribe the final Claude permission mode yet; it defines the policy space and constraints.

## 2. Trust Boundaries

| Boundary                          | Trust level                                   | Notes                                              |
| --------------------------------- | --------------------------------------------- | -------------------------------------------------- |
| Local process configuration       | Trusted if validated at startup               | Secrets must still be redacted from logs           |
| Slack inbound payloads            | Untrusted until parsed                        | All payloads require schema validation             |
| Claude-authored UI state          | Conditionally trusted after schema validation | Display-authoritative, not transport-authoritative |
| Claude tool execution             | High-risk                                     | Requires explicit policy selection                 |
| Filesystem and shell side effects | High-risk                                     | Must be bounded by later implementation policy     |

## 3. Secret Handling Rules

| Secret class           | Requirement                                              |
| ---------------------- | -------------------------------------------------------- |
| Slack tokens           | Env-only input, never logged in cleartext                |
| Anthropic API key      | Env-only input, never logged in cleartext                |
| Future backend secrets | Must follow the same env validation and redaction policy |

- Secret material may appear in memory but must not be emitted to structured logs.
- Diagnostic output must use redacted summaries only.

## 4. Validation Rules

| Boundary                   | Required control                          |
| -------------------------- | ----------------------------------------- |
| Environment variables      | T3 Env + Zod                              |
| Slack events               | Zod                                       |
| Slack messages             | Zod                                       |
| Claude UI-state payloads   | Zod                                       |
| Future persistence records | Zod or structurally equivalent validation |

- No unvalidated external payload may enter the core orchestration path.

## 5. Claude Permission Policy Space

| Mode                     | Meaning                                                        | Policy implication                                |
| ------------------------ | -------------------------------------------------------------- | ------------------------------------------------- |
| Restricted approval mode | Claude requests explicit approval for sensitive tools          | Stronger human control, slower flow               |
| Edit-accepting mode      | File edits may auto-advance while riskier actions remain gated | Balanced operator convenience                     |
| Full bypass mode         | Tool use proceeds without interactive approval                 | Suitable only for tightly controlled local setups |

- The final selected mode must be documented before implementation.
- The existence of a local host does not, by itself, justify unrestricted execution.

## 6. UI-State Safety Principle

| Principle             | Requirement                                                            |
| --------------------- | ---------------------------------------------------------------------- |
| State authorship      | Claude may author `status` and `loading_messages`                      |
| Transport control     | The application decides whether to deliver, reject, or clear a payload |
| No status fabrication | The application must not synthesize user-visible Claude state text     |

```text
[Claude state payload]
        |
        v
[Zod validation]
        |
        +--> valid -> render to Slack
        |
        +--> invalid -> reject + log
```

- This model preserves the product requirement while maintaining validation gates.

## 7. Logging and Diagnostic Safety

| Concern                    | Requirement                                                        |
| -------------------------- | ------------------------------------------------------------------ |
| Error logs                 | Must not expose tokens or secret values                            |
| Prompt context logs        | Must remain minimal and avoid unnecessary user-content duplication |
| Failure text sent to Slack | Must be concise and operationally useful                           |
| File logging               | Optional and environment-driven                                    |

## 8. Filesystem and Command Safety

| Concern                       | Requirement                                                               |
| ----------------------------- | ------------------------------------------------------------------------- |
| Workspace targeting           | Later implementation must define allowed working directories              |
| Destructive commands          | Must be governed by explicit policy before live tool execution is enabled |
| External network side effects | Must be governed by explicit policy before live tool execution is enabled |

- This specification intentionally leaves tool-policy details open until the executor implementation phase.
- The presence of a local Claude executor does not remove the need for policy controls.

## 9. Acceptance Criteria

| Criterion                                                      | Evidence                                      |
| -------------------------------------------------------------- | --------------------------------------------- |
| No raw secret logging is introduced                            | Code review and log inspection                |
| All external payloads are validated                            | Boundary-schema coverage                      |
| Permission mode is treated as an explicit architectural choice | Follow-on implementation ADR or spec revision |
