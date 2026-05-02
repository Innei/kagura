import { css } from 'styled-system/css';

export const root = css`
  align-items: center;
  border-bottom: 1px solid token(colors.border.default);
  color: token(colors.fg.muted);
  display: flex;
  font: token(fontSizes.xs) token(fonts.mono);
  gap: token(spacing.3);
  height: token(sizes.control.sm);
  justify-content: space-between;
  padding: 0 token(spacing.3);
`;

export const left = css`
  align-items: center;
  display: flex;
  gap: token(spacing.2.5);
  min-width: 0;
  overflow: hidden;
`;

export const additions = css`
  color: token(colors.diff.add);
`;

export const deletions = css`
  color: token(colors.diff.del);
`;

export const right = css`
  align-items: center;
  color: token(colors.fg.muted);
  display: flex;
  gap: token(spacing.2.5);
`;

export const kbd = css`
  background: token(colors.bg.subtle);
  border: 1px solid token(colors.border.default);
  border-radius: token(radii.sm);
  color: token(colors.fg.default);
  font: inherit;
  padding: 1px token(spacing.1);
`;
