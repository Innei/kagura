# slack-cc-bot

Run [Anthropic Claude Agent SDK](https://docs.anthropic.com/en/docs/agents) natively in Slack — mention the bot in any channel or thread, route the session into the right repository, and get streamed, context-aware responses with real-time UI state.

![Node version](https://img.shields.io/badge/Node.js->=22-3c873a?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue?style=flat-square&logo=typescript&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-10.33-f69220?style=flat-square)

## Overview

**slack-cc-bot** is a production-ready scaffold for running the Claude Agent SDK inside a Slack workspace via [Socket Mode](https://api.slack.com/apis/socket-mode). It handles the full lifecycle — ingress, thread context loading, streaming output, session resumption, and UI state management — so you can focus on customizing the agent's behavior.

### How it works

1. A user `@mentions` the bot in a Slack channel/thread, or invokes the workspace Message Action on a Slack message
2. The bot resolves the target repository/workdir from the message text or manual selection
3. The bot fetches the full thread history and normalizes it into a prompt
4. Claude Agent SDK runs with the resolved `cwd`, streaming text back in real time
5. A custom MCP server (`slack-ui`) lets Claude update Slack's assistant UI status
6. Sessions are persisted in SQLite with their bound workspace for multi-turn continuity

### Key features

- **Streaming responses** via Slack's `chat.appendStream` API
- **Thread-aware context** — full conversation history passed to Claude on every turn
- **Session resumption** — conversations persist across bot restarts (SQLite + Drizzle ORM)
- **Workspace-aware routing** — each Slack thread binds to a specific repo/workdir instead of the bot process `cwd`
- **Message Action fallback** — manually choose a repo/path when automatic detection is missing or ambiguous
- **UI state management** — Claude can set status text and loading indicators via a custom MCP tool
- **Strict validation** — all external inputs (env, Slack events, tool calls) validated with Zod
- **Secret redaction** in logs

## Prerequisites

- [Node.js](https://nodejs.org/) >= 22.0.0
- [pnpm](https://pnpm.io/) >= 10.33.0
- A [Slack app](https://api.slack.com/apps) configured with:
  - **Socket Mode** enabled
  - **Interactivity** enabled
  - **Event Subscriptions** with `app_mention` scope
  - A **Message Shortcut** configured with callback ID `workspace_message_action`
  - Bot token scopes: `app_mentions:read`, `chat:write`, `channels:history`, `groups:history`, `reactions:write`, `assistant:write`
- An [Anthropic API key](https://console.anthropic.com/)

## Getting started

### 1. Clone and install

```bash
git clone https://github.com/innei-repo/slack-cc-bot.git
cd slack-cc-bot
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in the required values:

| Variable               | Description                                  |
| ---------------------- | -------------------------------------------- |
| `SLACK_BOT_TOKEN`      | Bot user OAuth token (`xoxb-...`)            |
| `SLACK_APP_TOKEN`      | App-level token for Socket Mode (`xapp-...`) |
| `SLACK_SIGNING_SECRET` | Request verification secret                  |
| `REPO_ROOT_DIR`        | Root directory containing candidate repos    |

See [`.env.example`](.env.example) for all available options including `REPO_SCAN_DEPTH`, `CLAUDE_MODEL`, `CLAUDE_MAX_TURNS`, and logging configuration.

The bot scans `REPO_ROOT_DIR` recursively up to `REPO_SCAN_DEPTH` and binds each Slack thread to a concrete workspace path. It no longer falls back to the bot process `cwd` when no repo is identified.

### 3. Set up the database

```bash
pnpm db:generate
pnpm db:migrate
```

### 4. Run

```bash
# Development (with hot reload)
pnpm dev

# Production
pnpm build && pnpm start
```

## Project structure

```
src/
├── index.ts                    # Entry point
├── application.ts              # Composition root (wires all dependencies)
├── env/server.ts               # Validated environment schema
├── logger/                     # Structured logging with redaction
├── db/                         # SQLite database + Drizzle schema
├── session/                    # Session persistence (SQLite-backed)
├── workspace/                  # Repo discovery and workspace resolution
├── slack/
│   ├── app.ts                  # @slack/bolt initialization
│   ├── ingress/                # @mention / thread / assistant ingress
│   ├── interactions/           # Message Action + modal handlers
│   ├── context/                # Thread history loading & normalization
│   └── render/                 # Streaming output & UI state rendering
├── claude/
│   ├── executor/               # Agent SDK wrapper + MCP server
│   └── tools/                  # publish_state tool definition
└── schemas/                    # Zod schemas for Slack events & Claude tools
```

## Scripts

| Command            | Description                 |
| ------------------ | --------------------------- |
| `pnpm dev`         | Run with tsx (development)  |
| `pnpm build`       | Compile TypeScript          |
| `pnpm e2e`         | Run real Slack live E2E     |
| `pnpm test`        | Run Vitest test suite       |
| `pnpm start`       | Run compiled output         |
| `pnpm typecheck`   | Type-check without emitting |
| `pnpm db:generate` | Generate Drizzle migrations |
| `pnpm db:migrate`  | Apply migrations            |
| `pnpm db:studio`   | Open Drizzle Studio         |

## Architecture

The application follows a **composition root** pattern — `application.ts` assembles the entire dependency graph:

```
Logger → Database → SessionStore → SlackApp → ClaudeExecutor
```

All modules receive dependencies via function parameters (no global singletons). The Claude executor exposes a custom MCP server (`slack-ui`) with a single `publish_state` tool that lets the agent control Slack's assistant thread UI.

## Workspace routing

New threads try to infer the target repository from the incoming Slack message. Mention a repo name such as `slack-cc-bot`, a relative repo path such as `team/slack-cc-bot`, or an absolute path under `REPO_ROOT_DIR`.

If the bot cannot determine the workspace confidently, use the Slack Message Action on the relevant message:

1. Run the `workspace_message_action` shortcut.
2. Accept the detected repo, or choose a repo/path manually in the modal.
3. Decide whether to take over the current thread or start a new thread/session.

Once a thread is bound, follow-up replies reuse the same workspace. If you switch the workspace for that thread, the bot starts a fresh Claude session instead of resuming the old one with the wrong `cwd`.

> [!NOTE]
> Detailed specifications for each subsystem are available in [`docs/specs/`](docs/specs/).

## Live E2E

The repository includes a real Slack <-> Claude live E2E runner that starts the local Socket Mode app, posts a real `@mention` into a dedicated Slack channel, waits for the Claude-backed reply, and records every `assistant.threads.setStatus` payload to a local JSONL probe.

### Additional prerequisites

- A dedicated Slack test channel ID for `SLACK_E2E_CHANNEL_ID`
- A user token for `SLACK_E2E_TRIGGER_USER_TOKEN` that can post into that channel
- The existing bot token must already be installed in that channel and have the scopes listed above

Recommended safety setup:

- Use a dedicated Slack channel for live E2E traffic
- Use a dedicated test user/token for the trigger account
- Avoid reusing production channels because the runner posts real messages

### Environment

Add these values to your `.env`:

```bash
SLACK_E2E_ENABLED=true
SLACK_E2E_CHANNEL_ID=C0123456789
SLACK_E2E_TRIGGER_USER_TOKEN=xoxp-or-xoxc-...
SLACK_E2E_STATUS_PROBE_PATH=./artifacts/slack-live-e2e/status-probe.jsonl
SLACK_E2E_RESULT_PATH=./artifacts/slack-live-e2e/result.json
SLACK_E2E_TIMEOUT_MS=180000
```

### Run the live E2E

```bash
pnpm e2e
```

The runner will:

1. Start the local Socket Mode app
2. Post a real mention into `SLACK_E2E_CHANNEL_ID`
3. Poll Slack for the final assistant reply
4. Read the local status probe file
5. Save a structured result JSON to `SLACK_E2E_RESULT_PATH`

The current live scenario validates the loading-message/status chain by checking for:

- a tool-derived status such as `Running ReadFile (...)...`
- a summary-like loading message generated during execution
- a stream-event-derived loading message such as `Reading ...`
- a final assistant reply in the Slack thread
