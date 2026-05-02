import { style } from '@vanilla-extract/css';

import { vars } from '../../../theme/theme.css';

export const root = style({
  background: vars.bg.canvas,
  color: vars.fg.default,
  height: '100vh',
  width: '100%',
  overflow: 'hidden',
});

export const sidebar = style({
  background: vars.bg.surface,
  borderRight: `1px solid ${vars.border.default}`,
  display: 'grid',
  gridTemplateRows: 'auto minmax(0, 1fr)',
  height: '100%',
  minHeight: 0,
  minWidth: 0,
  overflow: 'hidden',
});

export const sidebarCollapsed = style({
  background: vars.bg.surface,
  borderRight: `1px solid ${vars.border.default}`,
  display: 'grid',
  height: '100%',
  placeItems: 'center',
  padding: '8px 0',
});

export const expandButton = style({
  background: 'transparent',
  border: `1px solid ${vars.border.default}`,
  borderRadius: 6,
  color: vars.fg.muted,
  cursor: 'pointer',
  font: 'inherit',
  fontSize: 11,
  height: 28,
  padding: 0,
  width: 28,
  selectors: {
    '&:hover': {
      background: vars.bg.hover,
      color: vars.fg.default,
    },
  },
});

export const resizeHandle = style({
  background: 'transparent',
  cursor: 'col-resize',
  width: 4,
  outline: 'none',
  position: 'relative',
  selectors: {
    '&:hover, &[data-resize-handle-active]': {
      background: vars.border.strong,
    },
    '&:focus-visible': {
      background: vars.focus.ring,
    },
  },
});

export const skipLink = style({
  background: vars.bg.selected,
  border: `1px solid ${vars.border.strong}`,
  borderRadius: 6,
  color: vars.fg.onSelected,
  fontSize: 12,
  left: 8,
  padding: '6px 10px',
  position: 'absolute',
  textDecoration: 'none',
  top: 8,
  transform: 'translateY(-200%)',
  transition: 'transform 120ms ease',
  zIndex: 10,
  selectors: {
    '&:focus, &:focus-visible': {
      transform: 'translateY(0)',
    },
  },
});
