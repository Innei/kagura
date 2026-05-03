import { useEffect, useState } from 'react';
import { codeToHtml } from 'shiki';

const LANG_BY_EXT: Record<string, string> = {
  // JS / TS
  ts: 'typescript',
  tsx: 'tsx',
  mts: 'typescript',
  cts: 'typescript',
  js: 'javascript',
  jsx: 'jsx',
  mjs: 'javascript',
  cjs: 'javascript',
  // Python
  py: 'python',
  pyi: 'python',
  // Go / Rust / Java / Kotlin / Scala / Swift
  go: 'go',
  rs: 'rust',
  java: 'java',
  kt: 'kotlin',
  kts: 'kotlin',
  scala: 'scala',
  swift: 'swift',
  // C family
  c: 'c',
  h: 'c',
  cc: 'cpp',
  cpp: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  hh: 'cpp',
  m: 'objective-c',
  mm: 'objective-cpp',
  cs: 'csharp',
  // Scripting / shells
  rb: 'ruby',
  php: 'php',
  pl: 'perl',
  pm: 'perl',
  lua: 'lua',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  fish: 'fish',
  ps1: 'powershell',
  psm1: 'powershell',
  // Data / config
  json: 'json',
  jsonc: 'jsonc',
  json5: 'json5',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  ini: 'ini',
  xml: 'xml',
  // Markup / docs
  md: 'markdown',
  mdx: 'mdx',
  markdown: 'markdown',
  rst: 'rst',
  tex: 'latex',
  // Web
  html: 'html',
  htm: 'html',
  vue: 'vue',
  svelte: 'svelte',
  astro: 'astro',
  css: 'css',
  scss: 'scss',
  sass: 'sass',
  less: 'less',
  // Query / data
  sql: 'sql',
  graphql: 'graphql',
  gql: 'graphql',
  // Other common
  dart: 'dart',
  ex: 'elixir',
  exs: 'elixir',
  erl: 'erlang',
  hs: 'haskell',
  ml: 'ocaml',
  r: 'r',
  zig: 'zig',
  proto: 'proto',
  dockerfile: 'docker',
  makefile: 'make',
  mk: 'make',
  nix: 'nix',
  diff: 'diff',
  patch: 'diff',
};

const LANG_BY_BASENAME: Record<string, string> = {
  Dockerfile: 'docker',
  Makefile: 'make',
  GNUmakefile: 'make',
  CMakeLists: 'cmake',
};

function langFor(path?: string): string {
  if (!path) return 'text';
  const slash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  const basename = slash >= 0 ? path.slice(slash + 1) : path;
  const exact = LANG_BY_BASENAME[basename];
  if (exact) return exact;
  const dot = basename.lastIndexOf('.');
  if (dot < 0) return 'text';
  return LANG_BY_EXT[basename.slice(dot + 1).toLowerCase()] ?? 'text';
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
