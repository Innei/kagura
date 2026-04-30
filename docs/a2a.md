# Agent-to-Agent (A2A) Conversation Mode

Kagura separates normal Slack chat from Agent-to-Agent (A2A) coordination. The Slack app subscribes to message events (`message.channels`, `message.groups`, and `message.im`) and filters them in process: ordinary channel messages are ignored, direct bot mentions become single-agent sessions, and configured agent user-group mentions become A2A sessions. The app no longer depends on Slack's `app_mention` event.

A2A mode starts when the root message either mentions a configured Slack user group, such as `@agents`, or co-mentions multiple configured agent apps. Slack user groups cannot contain bot users, so the user group is only the group-moment signal; the actual agent participants come from `agentTeams` config and any explicit agent `@mentions` in the same first non-empty line.

In an A2A thread, one agent is the lead. The lead owns user-facing coordination, task assignment, and the final summary. Standby agents only run when they are explicitly addressed by the user or by the lead.

Configure A2A teams in `config.json`:

```json
{
  "a2a": {
    "outputMode": "quiet",
    "diagnosticsDir": "./data/a2a-diagnostics"
  },
  "agentTeams": {
    "S0123456789": {
      "name": "agents",
      "defaultLead": "U0123456789",
      "members": [
        {
          "id": "U0123456789",
          "label": "codex",
          "role": "implementation, verification, and final summary"
        },
        {
          "id": "U9876543210",
          "label": "claude",
          "role": "design review and alternate implementation"
        }
      ]
    }
  }
}
```

`agentTeams` keys are Slack user group IDs from `<!subteam^S...>`. `defaultLead` is a bot user ID. `members` accepts either bot user ID strings or objects with `id`, optional `label`, and optional `role`; labels and roles are injected into A2A prompts so agents know which peer to mention for delegation or review. Every production bot instance that should participate in the same team must load compatible `agentTeams` config and be present in the Slack channel where message events should be received.

Set `a2a.outputMode` to `quiet` to reduce Slack thread noise during A2A work. In quiet mode, Kagura buffers non-delegation assistant messages and posts the final message for the turn; explicit `<@agent>` delegation remains public so standby agents can still wake up. Buffered messages are written to `a2a.diagnosticsDir` as per-thread JSONL files for debugging. The default `verbose` mode preserves the legacy behavior.

## A2A routing cases

| Case                                                                  | Expected behavior                                                                                     |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Ordinary root message without bot or configured group mention         | Ignored.                                                                                              |
| Root message directly mentions one bot                                | Creates a normal single-agent session for that bot.                                                   |
| Root message mentions `@agents`                                       | Creates an A2A session; the configured/default lead runs first.                                       |
| Root message mentions `@agents` and explicitly mentions one agent     | Creates an A2A session; the explicitly mentioned configured agent becomes lead.                       |
| Root message co-mentions multiple agent apps                          | Creates an A2A session; the first mentioned/configured lead runs first, other agents stay on standby. |
| User replies in the A2A thread without mentioning an agent            | The lead handles the reply.                                                                           |
| User explicitly mentions one standby agent                            | That mentioned agent handles the reply.                                                               |
| User explicitly mentions multiple agents                              | The lead handles the reply, decides whether to delegate, and may assign tasks.                        |
| Lead explicitly mentions one or more standby agents                   | Mentioned standby agents run; multiple standby agents may run in parallel.                            |
| All assigned standby agents reach `completed`, `failed`, or `stopped` | Kagura automatically wakes the original lead provider to post the final summary.                      |
| Bot-authored messages in General Chat                                 | Still ignored by default.                                                                             |
| Bot-authored lead messages in A2A                                     | Allowed to trigger mentioned standby participants; self-mentions are ignored to avoid loops.          |

Final summaries are driven by Kagura's execution lifecycle, not by parsing Slack prose. The summary should report successful work, failed or stopped assignments, and the user-visible conclusion.

## Verified A2A live cases

The live E2E suite includes:

- `dual-agent-a2a-auto-summary`: user starts with `@agents`; lead assigns a standby agent; standby completes; Kagura wakes the lead for a final summary.
- `dual-agent-a2a-user-reply-routing`: verifies ordinary root messages are ignored, `@agents` root messages start the lead, user replies route correctly with no explicit agent mention, one explicit agent mention, and multiple explicit agent mentions, and a later standby agent can use prior thread history. The multi-agent reply path validates `lead reply -> task dispatch -> standby completion -> lead summary`.
