import { css } from 'styled-system/css';

export const root = css`
  align-items: center;
  background: token(colors.bg.canvas);
  border-top: 1px solid token(colors.border.default);
  color: token(colors.fg.dim);
  display: flex;
  flex-shrink: 0;
  font-size: token(fontSizes.xs);
  font-variant-numeric: tabular-nums;
  gap: token(spacing.3);
  height: 28px;
  padding: 0 token(spacing.4);
`;

export const status = css`
  font: token(fontSizes.xs) / 1 token(fonts.mono);
  font-weight: 700;
  text-align: center;
  width: 10px;
`;

export const filename = css`
  color: token(colors.fg.default);
  font: token(fontSizes.xs) token(fonts.mono);
  max-width: 32ch;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const deltas = css`
  display: inline-flex;
  font: token(fontSizes.xs) / 1 token(fonts.mono);
  gap: token(spacing.1.5);
`;

export const position = css`
  color: token(colors.fg.dim);
  font: token(fontSizes.xs) / 1 token(fonts.mono);
`;

export const divider = css`
  background: token(colors.border.default);
  flex-shrink: 0;
  height: 12px;
  width: 1px;
`;

export const additions = css`
  color: token(colors.diff.add);
`;

export const deletions = css`
  color: token(colors.diff.del);
`;

export const hint = css`
  align-items: center;
  display: inline-flex;
  font-size: token(fontSizes.xs);
  gap: token(spacing.3.5);
  margin-left: auto;
`;

export const hintItem = css`
  align-items: center;
  display: inline-flex;
  gap: token(spacing.1);
`;

export const kbd = css`
  background: token(colors.bg.wash);
  border-radius: 3px;
  color: token(colors.fg.default);
  font: token(fontSizes.xs) / 1 token(fonts.mono);
  padding: 2px 6px;
`;

export const action = css`
  color: token(colors.fg.dim);
`;

export const empty = css`
  color: token(colors.fg.muted);
`;

export const statusAdded = css`
  color: token(colors.status.added);
`;
export const statusModified = css`
  color: token(colors.status.modified);
`;
export const statusDeleted = css`
  color: token(colors.status.deleted);
`;
export const statusRenamed = css`
  color: token(colors.status.renamed);
`;
