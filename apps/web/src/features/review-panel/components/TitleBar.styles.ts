import { css } from 'styled-system/css';

export const root = css`
  align-items: center;
  background: token(colors.bg.canvas);
  border-bottom: 1px solid token(colors.border.default);
  display: flex;
  flex-shrink: 0;
  gap: token(spacing.3.5);
  height: 40px;
  padding: 0 token(spacing.4);
  @media (max-width: 640px) {
    gap: token(spacing.2);
    padding: 0 token(spacing.3);
  }
`;

export const repo = css`
  color: token(colors.fg.default);
  font-size: token(fontSizes.md);
  font-weight: 600;
  letter-spacing: -0.15px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const branch = css`
  color: token(colors.fg.muted);
  flex-shrink: 0;
  font: token(fontSizes.xs) token(fonts.mono);
  letter-spacing: -0.1px;
  @media (max-width: 640px) {
    display: none;
  }
`;

export const branchArrow = css`
  color: token(colors.fg.dim);
  margin: 0 token(spacing.1);
`;

export const summary = css`
  align-items: baseline;
  color: token(colors.fg.muted);
  display: flex;
  flex-shrink: 0;
  font-size: token(fontSizes.xs);
  font-variant-numeric: tabular-nums;
  gap: token(spacing.3);
  margin-left: auto;
`;

export const deltas = css`
  display: inline-flex;
  font: token(fontSizes.xs) token(fonts.mono);
  font-variant-numeric: tabular-nums;
  gap: token(spacing.1.5);
  @media (max-width: 640px) {
    display: none;
  }
`;

export const additions = css`
  color: token(colors.diff.add);
`;

export const deletions = css`
  color: token(colors.diff.del);
`;
