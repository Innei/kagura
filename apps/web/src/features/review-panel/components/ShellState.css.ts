import { style } from '@vanilla-extract/css';

import { vars } from '../../../theme/theme.css';

export const root = style({
  background: vars.bg.canvas,
  color: vars.fg.muted,
  display: 'grid',
  height: '100vh',
  placeItems: 'center',
  width: '100%',
});
