import { style } from '@vanilla-extract/css';

import { fonts, vars } from '../../../../theme/theme.css';

export const root = style({
  alignItems: 'center',
  background: vars.bg.surface,
  borderBottom: `1px solid ${vars.border.default}`,
  display: 'flex',
  gap: 8,
  height: 36,
  minWidth: 0,
  padding: '0 12px',
});

export const navGroup = style({
  alignItems: 'center',
  display: 'flex',
  gap: 4,
});

export const iconButton = style({
  alignItems: 'center',
  background: 'transparent',
  border: `1px solid ${vars.border.default}`,
  borderRadius: 6,
  color: vars.fg.muted,
  cursor: 'pointer',
  display: 'inline-flex',
  font: 'inherit',
  fontSize: 12,
  gap: 6,
  height: 26,
  justifyContent: 'center',
  padding: '0 8px',
  selectors: {
    '&:hover:not(:disabled)': {
      background: vars.bg.hover,
      color: vars.fg.default,
    },
    '&:disabled': {
      cursor: 'not-allowed',
      opacity: 0.5,
    },
  },
});

export const squareButton = style({
  width: 26,
  padding: 0,
});

export const breadcrumb = style({
  color: vars.fg.muted,
  flex: 1,
  font: `12px ${fonts.mono}`,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const breadcrumbStrong = style({
  color: vars.fg.default,
});

export const allBadge = style({
  color: vars.fg.muted,
  font: `11px/1 ${fonts.mono}`,
});
