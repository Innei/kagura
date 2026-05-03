import { useEffect, useState } from 'react';
import { codeToHtml } from 'shiki';

const LANG_BY_EXT: Record<string, string> = {
  ts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  jsx: 'jsx',
  mjs: 'javascript',
  cjs: 'javascript',
  json: 'json',
  md: 'markdown',
  mdx: 'markdown',
  css: 'css',
  scss: 'scss',
  html: 'html',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  sh: 'bash',
  bash: 'bash',
  sql: 'sql',
};

function langFor(path?: string): string {
  if (!path) return 'text';
  const dot = path.lastIndexOf('.');
  if (dot < 0) return 'text';
  return LANG_BY_EXT[path.slice(dot + 1).toLowerCase()] ?? 'text';
}

export function useShikiHtml(
  content: string | undefined,
  path: string | undefined,
  scheme: 'dark' | 'light',
): string | undefined {
  const [html, setHtml] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (content === undefined) {
      setHtml(undefined);
      return;
    }
    let cancelled = false;
    void codeToHtml(content, {
      lang: langFor(path),
      theme: scheme === 'dark' ? 'github-dark-high-contrast' : 'github-light-high-contrast',
    })
      .then((next) => {
        if (!cancelled) setHtml(next);
      })
      .catch(() => {
        if (!cancelled) setHtml(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [content, path, scheme]);

  return html;
}

export function extractShikiLines(html: string): string[] {
  // shiki wraps code in <pre><code>…<span class="line">…token spans…</span>…</code></pre>
  // Use DOMParser so nested token spans don't trip a non-greedy regex.
  if (typeof DOMParser === 'undefined') return [];
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const lines = doc.querySelectorAll('span.line');
  return [...lines].map((line) => line.innerHTML);
}
