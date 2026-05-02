import { style } from '@vanilla-extract/css';

import { fonts, vars } from '../../../../theme/theme.css';

export const root = style({
  display: 'grid',
  borderBottom: `1px solid ${vars.border.default}`,
});

export const meta = style({
  display: 'grid',
  gap: 6,
  padding: '14px 16px 12px',
});

export const repo = style({
  fontSize: 14,
  fontWeight: 600,
  letterSpacing: '-0.01em',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  minWidth: 0,
});

export const branch = style({
  color: vars.fg.muted,
  font: `11px/1.4 ${fonts.mono}`,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const counts = style({
  display: 'flex',
  gap: 10,
  font: `11px/1 ${fonts.mono}`,
  color: vars.fg.muted,
});

export const additions = style({
  color: vars.diff.add,
});

export const deletions = style({
  color: vars.diff.del,
});

export const filterContainer = style({
  alignItems: 'stretch',
  borderTop: `1px solid ${vars.border.default}`,
  display: 'grid',
  gridTemplateColumns: '1fr auto',
});

export const filterField = style({
  alignItems: 'center',
  borderRight: `1px solid ${vars.border.default}`,
  display: 'flex',
  gap: 8,
  height: 32,
  paddingLeft: 12,
  paddingRight: 8,
  minWidth: 0,
  selectors: {
    '&:focus-within': {
      background: vars.bg.hover,
    },
  },
});

export const filterIcon = style({
  color: vars.fg.muted,
  flexShrink: 0,
});

export const filterInput = style({
  background: 'transparent',
  border: 0,
  borderRadius: 0,
  color: vars.fg.default,
  flex: 1,
  font: 'inherit',
  fontSize: 12,
  height: '100%',
  minWidth: 0,
  padding: 0,
  selectors: {
    '&::placeholder': {
      color: vars.fg.muted,
    },
    '&:focus': {
      outline: 'none',
    },
  },
});

export const viewSwitch = style({
  alignItems: 'stretch',
  display: 'inline-flex',
  height: 32,
});

export const viewButton = style({
  background: 'transparent',
  border: 0,
  borderLeft: `1px solid ${vars.border.default}`,
  color: vars.fg.muted,
  cursor: 'pointer',
  font: 'inherit',
  fontSize: 11,
  height: '100%',
  letterSpacing: '0.04em',
  padding: '0 14px',
  textTransform: 'uppercase',
  selectors: {
    '&:first-of-type': {
      borderLeft: 0,
    },
    '&:hover': {
      color: vars.fg.default,
    },
  },
});

export const viewButtonActive = style({
  background: vars.fg.default,
  color: vars.bg.surface,
  selectors: {
    '&:hover': {
      color: vars.bg.surface,
    },
  },
});
