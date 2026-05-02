import { style } from '@vanilla-extract/css';

import { vars } from '../../../../theme/theme.css';

export const root = style({
  background: vars.bg.canvas,
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  minWidth: 0,
  height: '100%',
});
