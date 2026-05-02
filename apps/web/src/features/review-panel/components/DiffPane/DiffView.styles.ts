import { css } from 'styled-system/css';

export const content = css`
  background: token(colors.bg.surface);
  flex: 1;
  min-height: 0;
  min-width: 0;
  overflow: auto;
`;

export const empty = css`
  background: token(colors.bg.surface);
  color: token(colors.fg.muted);
  flex: 1;
  min-height: 0;
  min-width: 0;
  overflow: auto;
  padding: token(spacing.4);
`;

export const patch = css`
  & + & {
    border-top: 1px solid token(colors.border.default);
  }
`;
