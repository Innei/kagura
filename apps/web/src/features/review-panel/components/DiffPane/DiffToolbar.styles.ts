import { css } from 'styled-system/css';

export const root = css`
  align-items: center;
  background: token(colors.bg.surface);
  border-bottom: 1px solid token(colors.border.default);
  display: flex;
  gap: token(spacing.2);
  height: token(sizes.control.xl);
  min-width: 0;
  padding: 0 token(spacing.3);
`;

export const navGroup = css`
  align-items: center;
  display: flex;
  gap: token(spacing.1);
`;

export const iconButton = css`
  align-items: center;
  background: transparent;
  border: 1px solid token(colors.border.default);
  border-radius: token(radii.md);
  color: token(colors.fg.muted);
  cursor: pointer;
  display: inline-flex;
  font: inherit;
  font-size: token(fontSizes.sm);
  gap: token(spacing.1.5);
  height: token(sizes.control.sm);
  justify-content: center;

  &:hover:not(:disabled) {
    background: token(colors.bg.hover);
    color: token(colors.fg.default);
  }
  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
`;

export const squareButton = css`
  width: token(sizes.control.sm);
  padding: 0;
`;

export const breadcrumb = css`
  color: token(colors.fg.muted);
  flex: 1;
  font: token(fontSizes.sm) token(fonts.mono);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const breadcrumbStrong = css`
  color: token(colors.fg.default);
`;

export const allBadge = css`
  color: token(colors.fg.muted);
  font: token(fontSizes.xs) / 1 token(fonts.mono);
`;
