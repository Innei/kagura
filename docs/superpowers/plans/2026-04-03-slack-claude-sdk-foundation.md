# Slack Claude SDK Foundation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a compilable TypeScript service skeleton for a Slack-native Claude Agent SDK integration, and capture the agreed architecture in a formal specification.

**Architecture:** The service runs as a local Node.js Socket Mode application. Slack remains the interaction surface, while a Claude executor boundary encapsulates Agent SDK integration and emits text plus structured UI state for Slack rendering.

**Tech Stack:** TypeScript, `tsc`, Node.js ESM, Slack Bolt, Claude Agent SDK, T3 Env, Zod, `@innei/pretty-logger-core`

---

## Chunk 1: Project Foundation

### Task 1: Establish build and runtime skeleton

**Files:**

- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `.env.example`

- [ ] **Step 1: Define runtime and build constraints**
- [ ] **Step 2: Add pinned dependencies and scripts**
- [ ] **Step 3: Configure NodeNext TypeScript compilation**
- [ ] **Step 4: Add repository hygiene files**

### Task 2: Add validated environment bootstrap and logger foundation

**Files:**

- Create: `src/env/server.ts`
- Create: `src/logger/index.ts`

- [ ] **Step 1: Define a strict server-side environment schema with T3 Env**
- [ ] **Step 2: Validate all runtime variables through Zod**
- [ ] **Step 3: Create a root logger factory backed by `@innei/pretty-logger-core`**
- [ ] **Step 4: Ensure the logger can be tagged by subsystem**

## Chunk 2: Slack and Claude Boundaries

### Task 3: Create Slack-facing module boundaries

**Files:**

- Create: `src/slack/types.ts`
- Create: `src/schemas/slack/app-mention-event.ts`
- Create: `src/schemas/slack/message.ts`
- Create: `src/slack/context/message-normalizer.ts`
- Create: `src/slack/context/thread-context-loader.ts`
- Create: `src/slack/render/slack-renderer.ts`
- Create: `src/slack/ingress/app-mention-handler.ts`
- Create: `src/slack/app.ts`

- [ ] **Step 1: Define structural Slack client contracts**
- [ ] **Step 2: Validate inbound mention and message payloads with Zod**
- [ ] **Step 3: Normalize thread text, including `section` block content**
- [ ] **Step 4: Implement the `@mention -> reaction -> thread bootstrap -> stream` orchestration skeleton**

### Task 4: Create Claude executor contracts

**Files:**

- Create: `src/schemas/claude/publish-state.ts`
- Create: `src/claude/tools/publish-state.ts`
- Create: `src/claude/executor/types.ts`
- Create: `src/claude/executor/anthropic-agent-sdk.ts`

- [ ] **Step 1: Define the structured Slack UI state contract produced by Claude**
- [ ] **Step 2: Create the executor event model**
- [ ] **Step 3: Add the initial Claude Agent SDK adapter scaffold**
- [ ] **Step 4: Preserve a clean seam for later full SDK implementation**

## Chunk 3: Composition and Documentation

### Task 5: Compose the application and session storage

**Files:**

- Create: `src/session/types.ts`
- Create: `src/session/in-memory-session-store.ts`
- Create: `src/application.ts`
- Create: `src/index.ts`

- [ ] **Step 1: Create the in-memory thread/session registry**
- [ ] **Step 2: Wire logger, Slack services, session store, and Claude executor together**
- [ ] **Step 3: Add startup and shutdown lifecycle handling**

### Task 6: Write the formal specification

**Files:**

- Create: `docs/spec.md`

- [ ] **Step 1: Document goals, non-goals, and technical choices**
- [ ] **Step 2: Capture the Slack `@mention` flow and Claude UI-state contract**
- [ ] **Step 3: Record env, logging, and directory conventions**
- [ ] **Step 4: Describe the extension path from scaffold to full SDK integration**
