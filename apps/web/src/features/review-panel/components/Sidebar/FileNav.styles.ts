import { css } from 'styled-system/css';

export const root = css`
  display: grid;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
`;

export const treeWrap = css`
  display: block;
  height: 100%;
  min-height: 0;
  overflow: hidden;
`;

export const tree = css`
  display: block;
  height: 100%;
  min-height: 0;
  overflow: hidden;
`;

export const empty = css`
  color: token(colors.fg.muted);
  padding: token(spacing.2) token(spacing.4);
`;
