import http from 'node:http';
import { URL } from 'node:url';

import type { AppLogger } from '~/logger/index.js';
import type { GitReviewService } from '~/review/git-review-service.js';

export interface ReviewPanelServerOptions {
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
  const reviewMatch = url.pathname.match(/^\/reviews\/([^/]+)$/);
  const apiMatch = url.pathname.match(/^\/api\/reviews\/([^/]+)(?:\/([^/]+))?$/);

  if (request.method !== 'GET') {
    sendJson(response, 405, { error: 'Method Not Allowed' });
    return;
  }

  if (url.pathname === '/') {
    sendHtml(response, renderIndexPage());
    return;
  }

  if (reviewMatch?.[1]) {
    sendHtml(response, renderReviewPage(reviewMatch[1]));
    return;
  }

  if (!apiMatch?.[1]) {
    sendJson(response, 404, { error: 'Not Found' });
    return;
  }

  const executionId = apiMatch[1];
  const resource = apiMatch[2] ?? 'session';

  if (resource === 'session') {
    const session = options.reviewService.getSession(executionId);
    if (!session) {
      sendJson(response, 404, { error: 'Review session not found.' });
      return;
    }
    sendJson(response, 200, session);
    return;
  }

  if (resource === 'tree') {
    const tree = options.reviewService.listTree(executionId);
    if (!tree) {
      sendJson(response, 404, { error: 'Review session not found.' });
      return;
    }
    sendJson(response, 200, { entries: tree });
    return;
  }

  if (resource === 'diff') {
    try {
      const diff = options.reviewService.getDiff(
        executionId,
        url.searchParams.get('path') ?? undefined,
      );
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

  if (resource === 'file') {
    const filePath = url.searchParams.get('path');
    if (!filePath) {
      sendJson(response, 400, { error: 'Missing path.' });
      return;
    }
    try {
      const file = await options.reviewService.getFile(executionId, filePath);
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

function sendJson(response: http.ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify(body));
}

function sendHtml(response: http.ServerResponse, html: string): void {
  response.writeHead(200, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(html);
}

function renderIndexPage(): string {
  return '<!doctype html><meta charset="utf-8"><title>Kagura Review</title><body><p>Kagura review panel is running.</p></body>';
}

function renderReviewPage(executionId: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Kagura Review</title>
  <style>${PANEL_CSS}</style>
</head>
<body>
  <aside>
    <header>
      <strong id="title">Review</strong>
      <small id="meta"></small>
    </header>
    <div class="section-title">Changed Files</div>
    <div id="changed" class="list"></div>
    <div class="section-title">File Tree</div>
    <div id="tree" class="list"></div>
  </aside>
  <main>
    <div class="toolbar">
      <button id="allDiff" type="button">Full Diff</button>
      <span id="selected"></span>
    </div>
    <pre id="diff"></pre>
  </main>
  <script>window.__REVIEW_EXECUTION_ID__ = ${JSON.stringify(executionId)};</script>
  <script>${PANEL_JS}</script>
</body>
</html>`;
}

const PANEL_CSS = `
* { box-sizing: border-box; }
body { margin: 0; height: 100vh; display: grid; grid-template-columns: 340px 1fr; font: 13px/1.45 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #202124; background: #f6f8fa; }
aside { min-width: 0; border-right: 1px solid #d0d7de; background: #fff; overflow: auto; }
header { padding: 14px 16px 12px; border-bottom: 1px solid #d0d7de; display: grid; gap: 4px; }
header strong { font-size: 15px; }
header small { color: #57606a; overflow-wrap: anywhere; }
main { min-width: 0; display: grid; grid-template-rows: 44px 1fr; }
.toolbar { display: flex; align-items: center; gap: 12px; padding: 8px 12px; border-bottom: 1px solid #d0d7de; background: #fff; }
button { border: 1px solid #d0d7de; background: #f6f8fa; border-radius: 6px; height: 28px; padding: 0 10px; cursor: pointer; }
button:hover { background: #eef1f4; }
.section-title { padding: 12px 16px 6px; color: #57606a; font-size: 11px; font-weight: 700; text-transform: uppercase; }
.list { padding: 0 8px 8px; }
.row { display: grid; grid-template-columns: 34px 1fr; gap: 6px; align-items: center; min-height: 28px; padding: 4px 8px; border-radius: 6px; cursor: pointer; }
.row:hover, .row.active { background: #eef6ff; }
.status { color: #57606a; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; }
.path { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#selected { color: #57606a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#diff { margin: 0; padding: 16px; overflow: auto; background: #fff; font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.add { background: #e6ffec; color: #116329; display: block; }
.del { background: #ffebe9; color: #82071e; display: block; }
.hunk { background: #ddf4ff; color: #0550ae; display: block; }
.file { color: #8250df; font-weight: 700; display: block; }
@media (max-width: 760px) { body { grid-template-columns: 1fr; grid-template-rows: 44vh 56vh; } aside { border-right: 0; border-bottom: 1px solid #d0d7de; } }
`;

const PANEL_JS = `
const executionId = window.__REVIEW_EXECUTION_ID__;
const state = { selected: null };
const $ = (id) => document.getElementById(id);

async function getJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function row(entry, onClick) {
  const el = document.createElement('div');
  el.className = 'row';
  el.innerHTML = '<span class="status"></span><span class="path"></span>';
  el.querySelector('.status').textContent = entry.status || '';
  el.querySelector('.path').textContent = entry.path;
  el.title = entry.path;
  el.addEventListener('click', () => onClick(entry.path, el));
  return el;
}

function renderList(id, entries) {
  const container = $(id);
  container.textContent = '';
  for (const entry of entries) container.appendChild(row(entry, selectPath));
}

function setActive(path) {
  for (const item of document.querySelectorAll('.row')) {
    item.classList.toggle('active', item.title === path);
  }
}

async function selectPath(path) {
  state.selected = path;
  setActive(path);
  $('selected').textContent = path;
  const payload = await getJson('/api/reviews/' + encodeURIComponent(executionId) + '/diff?path=' + encodeURIComponent(path));
  renderDiff(payload.diff || 'No diff for this file.');
}

async function loadAllDiff() {
  state.selected = null;
  setActive('');
  $('selected').textContent = 'All changed files';
  const payload = await getJson('/api/reviews/' + encodeURIComponent(executionId) + '/diff');
  renderDiff(payload.diff || 'No diff.');
}

function renderDiff(text) {
  $('diff').innerHTML = text.split('\\n').map((line) => {
    const escaped = line.replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
    const cls = line.startsWith('+++') || line.startsWith('---') || line.startsWith('diff --git') ? 'file' :
      line.startsWith('@@') ? 'hunk' :
      line.startsWith('+') ? 'add' :
      line.startsWith('-') ? 'del' : '';
    return cls ? '<span class="' + cls + '">' + escaped + '</span>' : escaped;
  }).join('\\n');
}

async function init() {
  const session = await getJson('/api/reviews/' + encodeURIComponent(executionId));
  $('title').textContent = session.workspaceLabel || session.workspaceRepoId || 'Review';
  $('meta').textContent = session.status + ' · ' + session.executionId;
  renderList('changed', session.changedFiles || []);
  const tree = await getJson('/api/reviews/' + encodeURIComponent(executionId) + '/tree');
  renderList('tree', tree.entries || []);
  await loadAllDiff();
}

$('allDiff').addEventListener('click', loadAllDiff);
init().catch((error) => {
  renderDiff('Failed to load review: ' + error.message);
});
`;
