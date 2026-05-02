import { style } from '@vanilla-extract/css';

import { vars } from '../../../../theme/theme.css';

export const root = style({
  display: 'inline-flex',
  alignItems: 'stretch',
  border: `1px solid ${vars.border.default}`,
  borderRadius: 6,
  overflow: 'hidden',
  height: 24,
  fontSize: 11,
  background: vars.bg.surface,
});

export const button = style({
  background: 'transparent',
  border: 0,
  color: vars.fg.muted,
  cursor: 'pointer',
  font: 'inherit',
  height: '100%',
  padding: '0 10px',
  selectors: {
    '&:hover': {
      color: vars.fg.default,
    },
  },
});

export const active = style({
  background: vars.fg.default,
  color: vars.bg.surface,
  selectors: {
    '&:hover': {
      color: vars.bg.surface,
    },
  },
});
