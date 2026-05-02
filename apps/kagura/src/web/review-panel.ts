import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { URL } from 'node:url';

import type { AppLogger } from '~/logger/index.js';
import type { GitReviewService } from '~/review/git-review-service.js';

export interface ReviewPanelServerOptions {
  assetsDir: string;
  baseUrl: string;
  host: string;
  logger: AppLogger;
  port: number;
  reviewService: GitReviewService;
}

export interface ReviewPanelServer {
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

const CONTENT_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

export function createReviewPanelServer(options: ReviewPanelServerOptions): ReviewPanelServer {
  const server = http.createServer((request, response) => {
    void handleRequest(request, response, options).catch((error) => {
      options.logger.warn('Review panel request failed: %s', String(error));
      sendJson(response, 500, { error: 'Internal Server Error' });
    });
  });

  return {
    start: () =>
      new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(options.port, options.host, () => {
          server.off('error', reject);
          options.logger.info('Review panel listening on %s', options.baseUrl);
          resolve();
        });
      }),
    stop: () =>
      new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      }),
  };
}

async function handleRequest(
  request: http.IncomingMessage,
  response: http.ServerResponse,
  options: ReviewPanelServerOptions,
): Promise<void> {
  const url = new URL(request.url ?? '/', options.baseUrl);
  const apiMatch = url.pathname.match(/^\/api\/reviews\/([^/]+)(?:\/([^/]+))?$/);

  if (request.method !== 'GET') {
    sendJson(response, 405, { error: 'Method Not Allowed' });
    return;
  }

  if (apiMatch?.[1]) {
    await handleApiRequest(response, options.reviewService, apiMatch[1], apiMatch[2], url);
    return;
  }

  await serveReviewPanelAsset(response, options.assetsDir, url.pathname);
}

async function handleApiRequest(
  response: http.ServerResponse,
  reviewService: GitReviewService,
  executionId: string,
  resource: string | undefined,
  url: URL,
): Promise<void> {
  const apiResource = resource ?? 'session';

  if (apiResource === 'session') {
    const session = reviewService.getSession(executionId);
    if (!session) {
      sendJson(response, 404, { error: 'Review session not found.' });
      return;
    }
    sendJson(response, 200, session);
    return;
  }

  if (apiResource === 'tree') {
    const tree = reviewService.listTree(executionId);
    if (!tree) {
      sendJson(response, 404, { error: 'Review session not found.' });
      return;
    }
    sendJson(response, 200, { entries: tree });
    return;
  }

  if (apiResource === 'diff') {
    try {
      const diff = reviewService.getDiff(executionId, url.searchParams.get('path') ?? undefined);
      if (diff === undefined) {
        sendJson(response, 404, { error: 'Review session not found.' });
        return;
      }
      sendJson(response, 200, { diff });
    } catch {
      sendJson(response, 400, { error: 'Invalid file path.' });
    }
    return;
  }

  if (apiResource === 'file') {
    const filePath = url.searchParams.get('path');
    if (!filePath) {
      sendJson(response, 400, { error: 'Missing path.' });
      return;
    }
    try {
      const file = await reviewService.getFile(executionId, filePath);
      if (!file) {
        sendJson(response, 404, { error: 'Review session not found.' });
        return;
      }
      sendJson(response, 200, file);
    } catch {
      sendJson(response, 400, { error: 'Invalid file path.' });
    }
    return;
  }

  sendJson(response, 404, { error: 'Not Found' });
}

async function serveReviewPanelAsset(
  response: http.ServerResponse,
  assetsDir: string,
  urlPathname: string,
): Promise<void> {
  const filePath = resolveAssetPath(assetsDir, urlPathname);
  if (!filePath) {
    sendHtml(response, renderMissingAssetsPage(assetsDir), 503);
    return;
  }

  try {
    const content = await fs.readFile(filePath);
    const contentType = CONTENT_TYPES[path.extname(filePath)] ?? 'application/octet-stream';
    response.writeHead(200, {
      'cache-control': filePath.endsWith('index.html') ? 'no-store' : 'public, max-age=31536000',
      'content-type': contentType,
    });
    response.end(content);
  } catch {
    if (urlPathname.startsWith('/assets/')) {
      sendJson(response, 404, { error: 'Not Found' });
      return;
    }
    sendHtml(response, renderMissingAssetsPage(assetsDir), 503);
  }
}

function resolveAssetPath(assetsDir: string, urlPathname: string): string | undefined {
  const relativePath =
    urlPathname === '/' || urlPathname.startsWith('/reviews/')
      ? 'index.html'
      : decodeURIComponent(urlPathname.replace(/^\/+/, ''));
  const absoluteAssetsDir = path.resolve(assetsDir);
  const absoluteTarget = path.resolve(absoluteAssetsDir, relativePath);
  const relative = path.relative(absoluteAssetsDir, absoluteTarget);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return undefined;
  }
  return absoluteTarget;
}

function sendJson(response: http.ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify(body));
}

function sendHtml(response: http.ServerResponse, html: string, status = 200): void {
  response.writeHead(status, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(html);
}

function renderMissingAssetsPage(assetsDir: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Kagura Review</title>
</head>
<body>
  <p>Kagura Review Panel assets were not found.</p>
  <p>Run <code>pnpm -F @kagura/web build</code> and set <code>KAGURA_REVIEW_PANEL_ASSETS_DIR</code> to the generated dist directory.</p>
  <p>Current assets directory: <code>${escapeHtml(assetsDir)}</code></p>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
