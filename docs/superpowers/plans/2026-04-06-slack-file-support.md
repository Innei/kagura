# Slack File Support Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Slack thread file support so the bot can read supported text/code attachments from thread history and upload agent-generated files back into the same Slack thread.

**Architecture:** Reuse the existing image-support pipeline, but split responsibilities by modality. Inbound Slack thread normalization will preserve both image attachments and supported non-image text/code files; the thread loader will download text/code files and inject their contents into the prompt as structured context. Outbound Claude SDK `files_persisted` events will be expanded from image-only handling to generic generated files, with Slack rendering uploading ordinary files directly and keeping the existing image-block behavior for images.

**Tech Stack:** TypeScript, Slack Bolt, Slack Web API external upload flow for E2E, Claude Agent SDK, Vitest.

---

### Task 1: Model supported Slack thread files

**Files:**

- Modify: `src/slack/context/message-normalizer.ts`
- Test: `tests/slack-message-normalizer.test.ts`

- [ ] Add normalized metadata for supported non-image text/code files.
- [ ] Preserve file-only messages when they contain supported files.
- [ ] Keep unsupported binary files excluded.
- [ ] Add tests covering text-file extraction, filename fallback, and message retention.

### Task 2: Download thread files into prompt-ready context

**Files:**

- Create: `src/slack/context/slack-text-file-downloader.ts`
- Modify: `src/slack/context/thread-context-loader.ts`
- Test: `tests/thread-context-loader.test.ts`

- [ ] Download supported Slack private files with bot-token auth.
- [ ] Enforce text/code-only and bounded-size loading.
- [ ] Store loaded file contents plus per-file failure notes.
- [ ] Add tests for successful load, truncation/failure handling, and coexistence with image loading.

### Task 3: Inject loaded file contents into the Claude prompt

**Files:**

- Modify: `src/agent/providers/claude-code/prompts.ts`
- Modify: `src/agent/providers/claude-code/prompt-pipeline/processors.ts`
- Modify: `src/agent/providers/claude-code/prompt-pipeline/index.ts`
- Test: `tests/claude-multimodal-prompt.test.ts`

- [ ] Advertise Slack file-view and file-upload capability in the system prompt.
- [ ] Add prompt-pipeline context for loaded thread files and file-load failures.
- [ ] Ensure resume sessions still receive current thread file context.
- [ ] Add regression tests for prompt contract and file-context rendering.

### Task 4: Expand persisted-output handling from images to generic files

**Files:**

- Modify: `src/agent/types.ts`
- Modify: `src/agent/providers/claude-code/messages.ts`
- Modify: `src/slack/ingress/activity-sink.ts`
- Modify: `src/slack/render/slack-renderer.ts`
- Test: `tests/claude-sdk-messages.test.ts`
- Test: `tests/activity-sink.test.ts`
- Test: `tests/slack-renderer.test.ts`

- [ ] Emit a dedicated generated-files event for non-image persisted files.
- [ ] Buffer and flush generated files independently from generated images.
- [ ] Upload generated files into the Slack thread without suppressing the text reply.
- [ ] Keep generated images on the current upload-plus-image-block path.
- [ ] Add tests for mixed image/file output and retry behavior.

### Task 5: Add live Slack E2E for thread file read/write support

**Files:**

- Modify: `src/e2e/live/slack-api-client.ts`
- Create: `src/e2e/live/run-slack-file-support.ts`

- [ ] Upload a real text file into a Slack thread.
- [ ] Verify the bot reads its content and replies with a deterministic marker.
- [ ] Prompt the bot to generate a text file and upload it back into the same thread.
- [ ] Verify the outbound file exists in Slack and contains the expected marker.

### Task 6: Verify and document

**Files:**

- Modify: `README.md`
- Modify: `llm.txt`

- [ ] Update user-facing project description to mention thread file support.
- [ ] Run focused unit tests for normalization, loading, prompting, rendering, and sink behavior.
- [ ] Run the new live E2E scenario against the configured Slack workspace.
