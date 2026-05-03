import { css } from 'styled-system/css';

export const root = css`
  align-items: stretch;
  background: token(colors.bg.wash);
  border-radius: token(radii.sm);
  display: inline-flex;
  height: token(sizes.control.sm);
  padding: 2px;
  position: relative;
`;

export const button = css`
  align-items: center;
  background: transparent;
  border: 0;
  border-radius: 2px;
  color: token(colors.fg.muted);
  cursor: pointer;
  display: inline-flex;
  font: inherit;
  font-size: token(fontSizes.xs);
  font-weight: 500;
  gap: token(spacing.1);
  justify-content: center;
  padding: 0 token(spacing.2.5);
  position: relative;
  transition:
    color 140ms token(easings.standard),
    background 140ms token(easings.standard),
    transform 120ms token(easings.standard);
  transform-origin: center;
  z-index: 1;

  &:hover:not([aria-selected='true']):not(:disabled) {
    color: token(colors.fg.default);
  }
  &:active:not(:disabled) {
    transform: scale(0.96);
  }
  &:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
  &:focus-visible {
    outline-offset: -2px;
  }
`;

export const active = css`
  color: token(colors.fg.default);
`;

export const indicator = css`
  background: token(colors.bg.surface);
  border-radius: 2px;
  bottom: anchor(bottom);
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.04),
    0 1px 1px rgba(0, 0, 0, 0.04),
    0 2px 4px rgba(0, 0, 0, 0.06);
  left: anchor(left);
  position: absolute;
  right: anchor(right);
  top: anchor(top);
  transition:
    left 240ms cubic-bezier(0.2, 0, 0, 1),
    right 240ms cubic-bezier(0.2, 0, 0, 1);
  z-index: 0;

  @supports not (anchor-name: --x) {
    display: none;
  }
`;
