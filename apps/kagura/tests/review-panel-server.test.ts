import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AppLogger } from '~/logger/index.js';
import type { CommitMessageGenerator } from '~/review/commit-message-generator.js';
import type { GitReviewService } from '~/review/git-review-service.js';
import { createReviewPanelServer, type ReviewPanelServer } from '~/web/review-panel.js';

describe('review panel server assets', () => {
  let assetsDir: string;
  let server: ReviewPanelServer | undefined;
  let baseUrl: string;

  beforeEach(async () => {
    assetsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kagura-review-panel-'));
    await fs.mkdir(path.join(assetsDir, 'assets'), { recursive: true });
    await fs.writeFile(path.join(assetsDir, 'index.html'), '<!doctype html><title>SPA</title>');
    await fs.writeFile(path.join(assetsDir, 'assets', 'app.js'), 'console.log("app");');

    const port = await getAvailablePort();
    baseUrl = `http://127.0.0.1:${port}`;
    server = createReviewPanelServer({
      assetsDir,
      baseUrl,
      host: '127.0.0.1',
      logger: createTestLogger(),
      port,
      reviewService: createReviewService(),
    });
    await server.start();
  });

  afterEach(async () => {
    await server?.stop();
    await fs.rm(assetsDir, { force: true, recursive: true });
    server = undefined;
  });

  it('falls unknown review routes back to the SPA entry', async () => {
    const response = await fetch(`${baseUrl}/reviews/missing-session`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(await response.text()).toContain('<title>SPA</title>');
  });

  it('falls unknown non-asset routes back to the SPA entry', async () => {
    const response = await fetch(`${baseUrl}/unmatched/client/route`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(await response.text()).toContain('<title>SPA</title>');
  });

  it('keeps missing build assets as 404 JSON responses', async () => {
    const response = await fetch(`${baseUrl}/assets/missing.js`);

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({ error: 'Not Found' });
  });

  it('keeps unknown API paths as 404 JSON responses', async () => {
    const response = await fetch(`${baseUrl}/api/unknown`);

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({ error: 'Not Found' });
  });
});

function createReviewService(): GitReviewService {
  return {
    getDiff: () => undefined,
    getFile: () => Promise.resolve(undefined),
    getSession: () => undefined,
    listTree: () => undefined,
  } as unknown as GitReviewService;
}

describe('review panel server POST endpoints', () => {
  let assetsDir: string;
  let server: ReviewPanelServer | undefined;
  let baseUrl: string;

  beforeEach(async () => {
    assetsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kagura-review-panel-'));
    await fs.writeFile(path.join(assetsDir, 'index.html'), '<!doctype html>');

    const port = await getAvailablePort();
    baseUrl = `http://127.0.0.1:${port}`;
    server = createReviewPanelServer({
      assetsDir,
      baseUrl,
      commitMessageGenerator: {
        generateCommitMessage: async () => 'feat: auto-generated message',
      } satisfies CommitMessageGenerator,
      host: '127.0.0.1',
      logger: createTestLogger(),
      port,
      reviewService: {
        ...createReviewService(),
        commitAndPush: () => ({ success: true, commitSha: 'abc123' }),
      } as unknown as GitReviewService,
    });
    await server.start();
  });

  afterEach(async () => {
    await server?.stop();
    await fs.rm(assetsDir, { force: true, recursive: true });
    server = undefined;
  });

  it('handles POST generate-commit-message', async () => {
    const response = await fetch(`${baseUrl}/api/reviews/exec-1/generate-commit-message`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ message: 'feat: auto-generated message' });
  });

  it('handles POST commit-push', async () => {
    const response = await fetch(`${baseUrl}/api/reviews/exec-1/commit-push`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'feat: test commit' }),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ success: true, commitSha: 'abc123' });
  });

  it('rejects POST commit-push without message', async () => {
    const response = await fetch(`${baseUrl}/api/reviews/exec-1/commit-push`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(400);
  });

  it('rejects DELETE method', async () => {
    const response = await fetch(`${baseUrl}/api/reviews/exec-1/session`, {
      method: 'DELETE',
    });
    expect(response.status).toBe(405);
  });

  it('returns 404 for unknown POST routes', async () => {
    const response = await fetch(`${baseUrl}/api/reviews/exec-1/unknown-action`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(404);
  });

  it('returns 503 when commitMessageGenerator is not configured', async () => {
    const port = await getAvailablePort();
    const bareServer = createReviewPanelServer({
      assetsDir,
      baseUrl: `http://127.0.0.1:${port}`,
      host: '127.0.0.1',
      logger: createTestLogger(),
      port,
      reviewService: createReviewService(),
    });
    await bareServer.start();
    try {
      const response = await fetch(
        `http://127.0.0.1:${port}/api/reviews/exec-1/generate-commit-message`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({}),
        },
      );
      expect(response.status).toBe(503);
    } finally {
      await bareServer.stop();
    }
  });
});

function createTestLogger(): AppLogger {
  return {
    debug: () => undefined,
    error: () => undefined,
    info: () => undefined,
    warn: () => undefined,
  } as unknown as AppLogger;
}

function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      if (!address || typeof address === 'string') {
        probe.close(() => reject(new Error('Failed to allocate test port.')));
        return;
      }
      const { port } = address;
      probe.close((error) => {
        if (error) reject(error);
        else resolve(port);
      });
    });
  });
}
