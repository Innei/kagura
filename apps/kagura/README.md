<div align="center">

# 🎭 Kagura

_Every thread a stage, every response a dance_

[![npm](https://img.shields.io/npm/v/@innei/kagura?style=flat-square&color=cb3837&logo=npm)](https://www.npmjs.com/package/@innei/kagura)
[![Node version](https://img.shields.io/badge/Node.js->=22-3c873a?style=flat-square)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![pnpm](https://img.shields.io/badge/pnpm-10.33-f69220?style=flat-square)](https://pnpm.io)

</div>

> _In Japanese mythology, Ame-no-Uzume performed a divine dance before the closed doors of Amano-Iwato — the heavenly rock cave where Amaterasu had hidden herself, plunging the world into darkness. Her dance, accompanied by music and laughter, drew the sun goddess back into the world. This was the first **kagura** (神楽) — "the entertainment of the gods."_

**Kagura** brings that spirit to Slack. Run [Anthropic Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk-typescript) natively in your workspace — `@mention` the bot, it routes the session into the right repository, and replies with Slack-native rich text, live progress, and persistent memory.

## Why

Running a Claude agent inside Slack requires gluing together thread context, workspace routing, streaming UX, session persistence, and memory — all adapted to Slack's API conventions. **kagura** handles that full lifecycle via [Socket Mode](https://api.slack.com/apis/socket-mode), so you can focus on the agent's behavior.

## How it works

```
@mention / Message Action
  → resolve target repo
  → load thread history (text + files + images)
  → run agent in repo cwd
  → stream progress → post rich-text reply and generated attachments
  → persist session & memory to SQLite
```

## Features

**Conversation** — Thread-aware multimodal context (text + files + images), session resumption across restarts, layered memory (global / workspace / preferences).

**Slack UX** — Rich text rendering (headings, lists, code blocks, auto-splitting), live progress indicators, reaction lifecycle, native assistant typing.

**Workspace routing** — Each thread binds to a repo/workdir. Auto-detected from message text, or manually chosen via Message Action.

**Agent control** — Pluggable provider registry, stop via `stop`/`cancel` keyword, :octagonal_sign: reaction, or message shortcut, slash commands for introspection (`/usage`, `/workspace`, `/memory`, `/session`, `/version`, `/provider`).

**Operations** — Auto-provisioned manifest (commands + shortcuts), online-presence heartbeat, Home tab, Zod-validated inputs, secret redaction in logs.

## Usage

```bash
npm install -g @innei/kagura
kagura
```

On first run, `kagura` notices there is no configuration and launches an interactive wizard:

1. Pick an AI provider (Claude Code or Codex CLI).
2. Create a Slack app — either via Slack's prefill URL or, if you've pasted a config token, fully automatically via the `apps.manifest.create` API.
3. Install the app and paste back the Bot Token, App-Level Token, and Signing Secret. The CLI validates each one against `auth.test` before writing.
4. Point kagura at your repositories (`REPO_ROOT_DIR`).

Everything lands under `~/.config/kagura/` (override with `$KAGURA_HOME`):

```
~/.config/kagura/
├── .env             secrets
├── config.json      tunables
├── data/sessions.db
└── logs/
```

### Subcommands

| Command                  | What it does                                                 |
| ------------------------ | ------------------------------------------------------------ |
| `kagura`                 | Run the bot (launches init wizard if config is incomplete)   |
| `kagura init`            | Run the init wizard unconditionally                          |
| `kagura doctor`          | Diagnose configuration and connectivity (`--json`, `--deep`) |
| `kagura manifest print`  | Print the Kagura-desired Slack manifest                      |
| `kagura manifest export` | Export your Slack app's current manifest                     |
| `kagura manifest sync`   | Push the desired manifest into your app                      |
| `kagura config path`     | Print `~/.config/kagura/`                                    |
| `kagura --version`       | Print version, commit hash, commit date                      |
| `kagura --help`          | Show help (works on subcommands too)                         |
| `kagura-app`             | Run the bot directly, skipping config detection              |

## Getting started (development)

```bash
git clone https://github.com/Innei/kagura.git
cd kagura
pnpm install
cp .env.example .env # fill in SLACK_BOT_TOKEN, SLACK_APP_TOKEN, SLACK_SIGNING_SECRET, REPO_ROOT_DIR
pnpm dev             # or: pnpm build && pnpm start
```

## Documentation

| Document                                            | Contents                                                                                         |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| [Configuration](docs/configuration.md)              | Environment variables, Slack manifest, token rotation, Docker                                    |
| [Architecture](docs/architecture.md)                | Composition root, agent providers, rendering, workspace routing, memory model, project structure |
| [Slash commands & controls](docs/slash-commands.md) | All slash commands, stop controls, reaction lifecycle                                            |
| [Live E2E testing](docs/e2e-testing.md)             | E2E setup, environment, running scenarios                                                        |
| [Specs](docs/specs/)                                | Detailed subsystem specifications                                                                |

## Scripts

| Command                       | Description                   |
| ----------------------------- | ----------------------------- |
| `pnpm dev`                    | Run with nodemon + tsx        |
| `pnpm build`                  | Compile TypeScript            |
| `pnpm test`                   | Run Vitest test suite         |
| `pnpm start`                  | Run compiled output           |
| `pnpm typecheck`              | Type-check without emitting   |
| `pnpm e2e`                    | Run all live Slack E2E cases  |
| `pnpm e2e -- <id>`            | Run a specific scenario by id |
| `pnpm e2e -- --interactive`   | Interactive scenario picker   |
| `pnpm e2e -- --list`          | List all discovered scenarios |
| `pnpm e2e -- --search <term>` | Search/filter by keyword      |
| `pnpm db:generate`            | Generate Drizzle migrations   |
| `pnpm db:migrate`             | Apply migrations              |
| `pnpm db:studio`              | Open Drizzle Studio           |

## License

MIT © Innei, Released under the MIT License.

> [Personal Website](https://innei.in/) · GitHub [@Innei](https://github.com/innei/)
