import { css } from 'styled-system/css';

export const root = css`
  align-items: center;
  background: token(colors.bg.canvas);
  border-bottom: 1px solid token(colors.border.default);
  display: flex;
  flex-shrink: 0;
  gap: token(spacing.3);
  height: 32px;
  padding: 0 token(spacing.4);
  position: relative;
`;

export const tab = css`
  align-items: baseline;
  background: transparent;
  border: 0;
  color: token(colors.fg.dim);
  cursor: pointer;
  display: inline-flex;
  font: inherit;
  font-size: token(fontSizes.sm);
  font-weight: 500;
  gap: token(spacing.1.5);
  padding: 0;
  transition: color 140ms token(easings.standard);

  &:hover:not([aria-selected='true']) {
    color: token(colors.fg.muted);
  }
`;

export const tabActive = css`
  color: token(colors.fg.default);
  anchor-name: --review-sidebar-tab;
`;

export const count = css`
  color: token(colors.fg.dim);
  font-family: token(fonts.mono);
  font-size: token(fontSizes.xs);
  font-variant-numeric: tabular-nums;
  transition: color 140ms token(easings.standard);

  [aria-selected='true'] & {
    color: token(colors.fg.muted);
  }
`;

export const indicator = css`
  background: token(colors.fg.default);
  bottom: -1px;
  height: 1px;
  left: anchor(--review-sidebar-tab left);
  pointer-events: none;
  position: absolute;
  right: anchor(--review-sidebar-tab right);
  transition:
    left 240ms cubic-bezier(0.2, 0, 0, 1),
    right 240ms cubic-bezier(0.2, 0, 0, 1);

  @supports not (anchor-name: --x) {
    display: none;
  }
`;
