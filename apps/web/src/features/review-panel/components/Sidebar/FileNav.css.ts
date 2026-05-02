import { style } from '@vanilla-extract/css';

import { fonts, vars } from '../../../../theme/theme.css';

export const root = style({
  display: 'grid',
  minHeight: 0,
  minWidth: 0,
  overflow: 'hidden',
});

export const treeWrap = style({
  display: 'block',
  height: '100%',
  minHeight: 0,
  overflow: 'hidden',
});

export const tree = style({
  display: 'block',
  height: '100%',
  minHeight: 0,
  overflow: 'hidden',
});

export const flatList = style({
  boxSizing: 'border-box',
  display: 'grid',
  gap: 1,
  overflow: 'auto',
  padding: '4px 8px 8px',
  minHeight: 0,
});

export const flatRow = style({
  alignItems: 'center',
  background: 'transparent',
  border: 0,
  borderRadius: 6,
  color: vars.fg.default,
  cursor: 'pointer',
  display: 'grid',
  font: 'inherit',
  fontSize: 12,
  gap: 8,
  gridTemplateColumns: '14px minmax(0, 1fr) auto',
  minHeight: 24,
  padding: '4px 8px',
  textAlign: 'left',
  width: '100%',
  selectors: {
    '&:hover': {
      background: vars.bg.hover,
    },
  },
});

export const flatRowActive = style({
  background: vars.bg.selected,
  color: vars.fg.onSelected,
  selectors: {
    '&:hover': {
      background: vars.bg.selected,
    },
  },
});

export const badge = style({
  color: vars.fg.muted,
  font: `11px/1 ${fonts.mono}`,
  textAlign: 'center',
  width: 14,
});

export const badgeActive = style({
  color: vars.fg.onSelected,
});

export const path = style({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const stats = style({
  color: vars.fg.muted,
  display: 'inline-flex',
  font: `11px/1 ${fonts.mono}`,
  gap: 6,
});

export const statsActive = style({
  color: vars.fg.onSelected,
});

export const additions = style({
  color: vars.diff.add,
});

export const additionsActive = style({
  color: vars.fg.onSelected,
});

export const deletions = style({
  color: vars.diff.del,
});

export const deletionsActive = style({
  color: vars.fg.onSelected,
});

export const empty = style({
  color: vars.fg.muted,
  padding: '8px 16px',
});
