import { css } from 'styled-system/css';

export const root = css`
  background: transparent;
  font: token(fontSizes.md) / 1.55 token(fonts.mono);
  height: 100%;
  overflow: auto;
  scrollbar-width: thin;
`;

export const list = css`
  display: grid;
  min-width: max-content;
  padding: token(spacing.1) 0;
`;

export const row = css`
  display: grid;
  grid-template-columns: 48px 3px 1fr;
  min-height: 1.55em;
`;

export const ln = css`
  color: token(colors.fg.dim);
  font-variant-numeric: tabular-nums;
  padding: 0 token(spacing.2) 0 0;
  text-align: right;
  user-select: none;
`;

export const gutter = css`
  background: transparent;
  height: 100%;
  width: 100%;
`;

export const gutterAdded = css`
  background: token(colors.diff.add);
`;

export const gutterDeleted = css`
  background: token(colors.diff.del);
`;

export const codeLine = css`
  color: token(colors.fg.default);
  padding: 0 token(spacing.4);
  white-space: pre;
`;

export const codeAdded = css`
  background: rgba(46, 160, 67, 0.06);
`;

export const codeDeleted = css`
  background: rgba(248, 81, 73, 0.06);
  text-decoration: line-through;
  text-decoration-color: token(colors.diff.del);
  text-decoration-thickness: 1px;
  opacity: 0.85;
`;

export const skipRow = css`
  align-items: center;
  color: token(colors.fg.dim);
  display: block;
  font: token(fontSizes.xs) token(fonts.mono);
  grid-column: 1 / -1;
  padding: token(spacing.1.5) token(spacing.4);

  &::before {
    color: token(colors.border.default);
    content: '··· ';
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
  text-align: center;
`;

export const shiki = css`
  & .shiki span {
    color: inherit;
  }
`;
