import { css } from 'styled-system/css';

export const root = css`
  height: 100%;
  min-height: 0;
  overflow: hidden;
`;

export const treeWrap = css`
  height: 100%;
  min-height: 0;
  overflow: auto;
  scrollbar-width: thin;
`;

export const tree = css`
  height: 100%;
  min-height: 0;
`;

export const empty = css`
  color: token(colors.fg.muted);
  font-size: token(fontSizes.xs);
  padding: token(spacing.3);
  text-align: center;
`;
