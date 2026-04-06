# Slack Image Support

Add first-class image support to the Slack conversation pipeline so the bot can read image attachments posted in a Slack thread and send locally generated image files back into the same thread.

## Problem

The current Slack integration is text-only.

- Inbound thread loading normalizes `message.text` and `section` block text, but it does not extract Slack image files from `message.files`.
- The agent request contract only carries text thread context and mention text.
- The Claude adapter always calls the Agent SDK with a plain string prompt, so no multimodal user content reaches the provider.
- Outbound assistant replies are rendered as text plus Slack blocks derived from markdown, but there is no image upload or image block support in the renderer or Slack client types.

This means users can post images in Slack, but the bot cannot actually inspect them, and agent-generated image files cannot be surfaced back to Slack as images.

## Goals

- Read image files attached to Slack thread messages.
- Preserve existing text thread context behavior.
- Pass supported images into the Claude Agent SDK as multimodal user content.
- Detect image files persisted by the agent during a run.
- Upload those image files back to Slack in the same thread.
- Render uploaded images in a clear, native Slack presentation.
- Keep existing text reply behavior unchanged for text-only conversations.

## Non-goals

- Do not support non-image Slack files in the first version.
- Do not support external image URLs or markdown image URLs in outbound replies.
- Do not add OCR, caption generation, or image preprocessing beyond transport and metadata.
- Do not redesign the current stopped or failed execution lifecycle beyond what is needed to preserve compatibility with image replies.
- Do not change provider selection, memory extraction, or workspace resolution semantics.

## Scope decisions

### Supported inbound image sources

The first version supports image files present in Slack message `files` arrays when those files belong to the current thread history returned by `conversations.replies`.

Supported media types should be limited to common image formats accepted by Slack image blocks and the Claude Agent SDK:

- `image/png`
- `image/jpeg`
- `image/gif`
- `image/webp` if the provider accepts it at runtime

If a Slack message contains both text and images, both should be preserved.

### Supported outbound image sources

The first version supports image files that the agent persists locally during execution and reports through the Claude Agent SDK `files_persisted` system event.

The design intentionally does not treat arbitrary URLs in assistant text as images. Only real local files persisted by the run are eligible for upload.

## Approach

The feature has four pieces:

1. Extend Slack message and thread context modeling to include image attachments.
2. Build multimodal Agent SDK input when thread images exist.
3. Capture persisted image files from the Claude Agent SDK output stream.
4. Upload and render those files back into Slack after or alongside the text reply.

## Inbound data model

### Slack schema extensions

Update Slack message parsing to model the subset of `message.files` needed for image transport:

- Slack file id
- filename
- mimetype
- filetype if present
- `url_private`
- title if present

The schema should remain permissive for unrelated Slack file fields.

### Normalized thread context

Extend the normalized thread model with structured image attachments while keeping existing text rendering intact.

Suggested shape:

```ts
export interface NormalizedThreadImage {
  fileId: string;
  fileName: string;
  mimeType: string;
  slackUrl: string;
  title?: string;
  messageTs: string;
  authorId: string | null;
}

export interface NormalizedThreadMessage {
  authorId: string | null;
  images: NormalizedThreadImage[];
  rawText: string;
  text: string;
  threadTs: string;
  ts: string;
}

export interface NormalizedThreadContext {
  channelId: string;
  messages: NormalizedThreadMessage[];
  renderedPrompt: string;
  threadTs: string;
}
```

Text-only messages should continue to render exactly as they do now. Image-only messages should remain in `messages` even if their text is empty, because the image itself is now meaningful context.

This means the current "drop normalized messages whose `text` is empty" behavior must change to "drop only messages that have neither text nor supported images."

### Slack download helper

Add a focused helper that downloads Slack private image bytes using the bot token already configured in the Slack client.

Responsibilities:

- Fetch bytes from `url_private`.
- Validate that the response is an image and within a reasonable size budget.
- Return `Buffer` plus mime type metadata.
- Fail per-image rather than failing the whole thread load.

This helper should not know about prompt formatting or Slack rendering.

## Claude input design

### Agent request contract

Extend `AgentExecutionRequest` to carry structured thread images in addition to existing text context.

Suggested addition:

```ts
export interface AgentExecutionRequest {
  abortSignal?: AbortSignal;
  channelId: string;
  contextMemories?: ContextMemories;
  mentionText: string;
  resumeHandle?: string;
  threadContext: NormalizedThreadContext;
  threadTs: string;
  userId: string;
  workspaceLabel?: string;
  workspacePath?: string;
  workspaceRepoId?: string;
}
```

The shape of `NormalizedThreadContext` should be expanded rather than adding a second parallel image payload to the request. That keeps the thread snapshot self-contained.

### Prompt strategy

Keep the existing `buildPrompt()` behavior for text-only threads.

When thread images exist, switch the Claude adapter from `prompt: string` to `prompt: AsyncIterable<SDKUserMessage>`.

Recommended sequence:

1. First user message contains the existing rendered thread text and the current user mention.
2. Each thread image is sent as a separate follow-up user message with:

- a short text preamble such as `Image from Slack thread message 3 (filename: diagram.png)`
- one image content block containing base64 image bytes and the mime type

This preserves the current prompt-building logic while layering images on top with minimal disruption.

### Fallback behavior

If all image downloads fail, the adapter should fall back to the existing text-only query path.

If some images fail and some succeed:

- Include the successful images.
- Append a short textual note in the primary prompt that some thread images could not be loaded.
- Log per-file failures for diagnosis.

## Claude output capture

### Persisted file events

The Claude Agent SDK exposes a `files_persisted` system event containing local filenames and provider file ids.

The adapter should capture these events during execution and accumulate persisted files for the current run.

Suggested event flow:

- `messages.ts` handles `system` subtype `files_persisted`
- filter to supported image file extensions or mime types
- resolve each file to a local path relative to the execution working directory
- emit a new sink event carrying uploaded-image candidates

Suggested new sink event shape:

```ts
type AgentExecutionEvent =
  | { type: 'assistant-message'; text: string }
  | { type: 'generated-images'; files: GeneratedImageFile[] }
  | ...

export interface GeneratedImageFile {
  fileName: string;
  path: string;
  providerFileId: string;
}
```

This event should be additive so existing text handling remains unchanged.

Because the SDK event includes filenames but not guaranteed absolute paths, the adapter should resolve persisted files against the execution cwd already known from the request or SDK init message.

## Outbound Slack rendering

### Slack client types

Extend `SlackWebClientLike` to support file upload.

The first version should model the subset needed for `filesUploadV2`, including:

- `channel`
- `thread_ts`
- `filename`
- `file`
- optional `title`
- optional `alt_txt`

Also extend block typing to include Slack image blocks using a Slack file object by file id.

### Renderer responsibilities

Add a renderer path that can post text and images to the same thread.

Suggested behavior:

1. Post the normal assistant text reply exactly as today.
2. Upload each generated image file with `filesUploadV2` into the same thread.
3. Post an image block referencing the uploaded Slack file id, with stable alt text and optional title.

Using file upload plus image block gives two benefits:

- the asset is stored in Slack rather than being a local-path artifact
- the thread gets a native visual rendering that is more reliable than raw file messages alone

If there is no text reply and only generated images, the renderer should still upload and display the images.

### Activity sink integration

The activity sink should accumulate generated image events during the run and flush them in the normal assistant reply path or during finalization.

Design constraints:

- Image upload should not erase or replace already-posted text chunks.
- Stopped runs should not upload images that were never fully persisted.
- Failed image upload should not suppress the text reply.

## Error handling

### Inbound

- Unsupported Slack file types are ignored.
- Missing `url_private` means the file is ignored and logged.
- Slack download failure for one image should not fail the whole execution.
- Oversized images should be skipped with a log line.

### Outbound

- Missing local file path or unreadable file should skip that image and log a warning.
- Slack upload failure should not fail the entire response if text was successfully posted.
- If text posting fails, image upload should not proceed because the thread reply path is already in an error state.

### Provider compatibility

If the current provider or SDK invocation rejects multimodal input at runtime, the adapter should surface a normal execution failure rather than silently dropping all images. This keeps misconfiguration visible during rollout.

## File changes

### Slack thread loading

Modify:

- `src/schemas/slack/message.ts`
- `src/slack/context/message-normalizer.ts`
- `src/slack/context/thread-context-loader.ts`

Add:

- `src/slack/context/slack-image-downloader.ts`

### Agent contract and Claude adapter

Modify:

- `src/agent/types.ts`
- `src/agent/providers/claude-code/adapter.ts`
- `src/agent/providers/claude-code/messages.ts`
- `src/agent/providers/claude-code/types.ts` if helper typings need to be re-exported

Add helper modules if needed:

- `src/agent/providers/claude-code/multimodal-prompt.ts`

### Slack rendering

Modify:

- `src/slack/types.ts`
- `src/slack/render/slack-renderer.ts`
- `src/slack/ingress/activity-sink.ts`

## Testing strategy

Per project convention, this feature needs unit tests and should eventually gain a live Slack E2E scenario.

### Unit tests

Add or update tests for:

- Slack message normalization retains image-only messages and extracts supported image file metadata.
- Thread loading downloads supported images and skips unsupported files.
- Claude adapter uses string prompt for text-only runs.
- Claude adapter uses `AsyncIterable<SDKUserMessage>` when thread images exist.
- Partial image download failure still sends the successful images.
- `files_persisted` image events are captured and emitted to the sink.
- Activity sink forwards generated images to the renderer without breaking text reply behavior.
- Renderer uploads generated images and posts image blocks in the same thread.
- Renderer tolerates Slack upload failure without dropping the text reply.

### Live E2E

Add a new scenario under `src/e2e/live/` that:

1. Starts the app.
2. Posts a thread message with an attached image.
3. Waits for the bot to respond using information from the image-aware context.
4. Triggers an image-generating prompt.
5. Polls until a thread reply contains both text output and a Slack-hosted image.

## Rollout notes

- The first release is intentionally narrow: Slack image files in, local generated images out.
- Existing text-only behavior should remain unchanged.
- Existing stopped-execution handling already present in the activity sink and renderer should remain compatible with the new image event flow.
