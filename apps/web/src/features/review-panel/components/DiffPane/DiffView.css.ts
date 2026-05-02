import { style } from '@vanilla-extract/css';

import { vars } from '../../../../theme/theme.css';

export const content = style({
  background: vars.bg.surface,
  flex: 1,
  minHeight: 0,
  minWidth: 0,
  overflow: 'auto',
});

export const empty = style({
  background: vars.bg.surface,
  color: vars.fg.muted,
  flex: 1,
  minHeight: 0,
  minWidth: 0,
  overflow: 'auto',
  padding: 16,
});

export const patch = style({
  selectors: {
    '& + &': {
      borderTop: `1px solid ${vars.border.default}`,
    },
  },
});
