import { css } from 'styled-system/css';

export const content = css`
  display: flex;
  flex-direction: column;
`;

export const patch = css`
  background: transparent;
  overflow: hidden;

  & + & {
    border-top: 1px solid token(colors.border.default);
  }

  & diffs-container,
  & diffs-container > * {
    height: auto !important;
    min-height: 0;
  }
`;

export const empty = css`
  align-items: center;
  color: token(colors.fg.muted);
  display: flex;
  font-size: token(fontSizes.xs);
  height: 100%;
  justify-content: center;
  padding: token(spacing.4);
`;
