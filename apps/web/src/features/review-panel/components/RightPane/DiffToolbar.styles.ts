import { css } from 'styled-system/css';

export const root = css`
  align-items: center;
  background: token(colors.bg.surface);
  border-bottom: 1px solid token(colors.border.default);
  display: flex;
  flex-shrink: 0;
  gap: token(spacing.2);
  height: 32px;
  min-width: 0;
  padding: 0 token(spacing.3);
`;

export const navGroup = css`
  align-items: center;
  display: inline-flex;
  gap: 0;
  margin-right: token(spacing.1);
`;

export const iconButton = css`
  align-items: center;
  background: transparent;
  border: 0;
  border-radius: token(radii.sm);
  color: token(colors.fg.dim);
  cursor: pointer;
  display: inline-flex;
  font: inherit;
  font-size: token(fontSizes.xs);
  height: 22px;
  justify-content: center;
  min-width: 22px;
  padding: 0 token(spacing.1);
  position: relative;
  transform-origin: center;
  transition:
    color 140ms token(easings.standard),
    background 140ms token(easings.standard),
    transform 120ms token(easings.standard);

  &::after {
    content: '';
    height: 32px;
    inset: 50% 0 auto 0;
    position: absolute;
    transform: translateY(-50%);
  }
  &:hover:not(:disabled) {
    background: token(colors.bg.wash);
    color: token(colors.fg.default);
  }
  &:active:not(:disabled) {
    transform: scale(0.96);
  }
  &:disabled {
    cursor: not-allowed;
    opacity: 0.4;
  }
`;

export const breadcrumb = css`
  color: token(colors.fg.dim);
  flex: 1;
  font: token(fontSizes.sm) token(fonts.mono);
  letter-spacing: -0.1px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const breadcrumbSep = css`
  color: token(colors.border.default);
  padding: 0 1px;
`;

export const breadcrumbStrong = css`
  color: token(colors.fg.default);
  font-weight: 500;
`;

export const allBadge = css`
  color: token(colors.fg.muted);
  font: token(fontSizes.sm) token(fonts.sans);
`;

export const divider = css`
  background: token(colors.border.default);
  flex-shrink: 0;
  height: 14px;
  margin: 0 token(spacing.1);
  width: 1px;
`;
