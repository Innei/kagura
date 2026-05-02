import { assignVars, createThemeContract, globalStyle } from '@vanilla-extract/css';

import { darkTokens, lightTokens } from './tokens';

export const vars = createThemeContract({
  bg: {
    canvas: 'bg-canvas',
    surface: 'bg-surface',
    hover: 'bg-hover',
    subtle: 'bg-subtle',
    selected: 'bg-selected',
  },
  fg: {
    default: 'fg-default',
    muted: 'fg-muted',
    onSelected: 'fg-on-selected',
  },
  border: {
    default: 'border-default',
    strong: 'border-strong',
  },
  focus: {
    ring: 'focus-ring',
  },
  diff: {
    add: 'diff-add',
    del: 'diff-del',
  },
});

export const fonts = {
  sans: "'Geist', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  mono: "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
} as const;

globalStyle(':root[data-theme="light"]', {
  vars: assignVars(vars, lightTokens),
});

globalStyle(':root[data-theme="dark"]', {
  vars: assignVars(vars, darkTokens),
});

globalStyle('html, body', {
  margin: 0,
  padding: 0,
});

globalStyle('body', {
  background: vars.bg.canvas,
  color: vars.fg.default,
  font: `13px/1.5 ${fonts.sans}`,
  WebkitFontSmoothing: 'antialiased',
  MozOsxFontSmoothing: 'grayscale',
});

globalStyle('*, *::before, *::after', {
  boxSizing: 'border-box',
});

globalStyle(':focus-visible', {
  outline: `2px solid ${vars.focus.ring}`,
  outlineOffset: 2,
  borderRadius: 4,
});

globalStyle(':focus:not(:focus-visible)', {
  outline: 'none',
});
