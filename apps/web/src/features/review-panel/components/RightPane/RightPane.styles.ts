import { css } from 'styled-system/css';

export const root = css`
  background: token(colors.bg.surface);
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  height: 100%;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
`;

export const body = css`
  background: token(colors.bg.surface);
  height: 100%;
  min-height: 0;
  overflow: auto;
`;

export const empty = css`
  align-items: center;
  color: token(colors.fg.muted);
  display: flex;
  font-size: token(fontSizes.xs);
  height: 100%;
  justify-content: center;
  padding: token(spacing.4);
  text-align: center;
`;
