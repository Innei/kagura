import { style } from '@vanilla-extract/css';

import { fonts, vars } from '../../../../theme/theme.css';

export const root = style({
  alignItems: 'center',
  borderBottom: `1px solid ${vars.border.default}`,
  color: vars.fg.muted,
  display: 'flex',
  font: `11px ${fonts.mono}`,
  gap: 12,
  height: 26,
  justifyContent: 'space-between',
  padding: '0 12px',
});

export const left = style({
  alignItems: 'center',
  display: 'flex',
  gap: 10,
  minWidth: 0,
  overflow: 'hidden',
});

export const additions = style({
  color: vars.diff.add,
});

export const deletions = style({
  color: vars.diff.del,
});

export const right = style({
  alignItems: 'center',
  color: vars.fg.muted,
  display: 'flex',
  gap: 10,
});

export const kbd = style({
  background: vars.bg.subtle,
  border: `1px solid ${vars.border.default}`,
  borderRadius: 4,
  color: vars.fg.default,
  font: `inherit`,
  padding: '1px 4px',
});
