import { css } from 'styled-system/css';

export const overlay = css`
  align-items: center;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  inset: 0;
  justify-content: center;
  position: fixed;
  z-index: 100;
`;

export const dialog = css`
  background: token(colors.bg.surface);
  border: 1px solid token(colors.border.default);
  border-radius: token(radii.md);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.24);
  display: flex;
  flex-direction: column;
  gap: token(spacing.3);
  max-width: 520px;
  padding: token(spacing.4);
  width: 90vw;
`;

export const title = css`
  color: token(colors.fg.default);
  font-size: token(fontSizes.md);
  font-weight: 600;
`;

export const textarea = css`
  background: token(colors.bg.canvas);
  border: 1px solid token(colors.border.default);
  border-radius: token(radii.sm);
  color: token(colors.fg.default);
  font: token(fontSizes.md) token(fonts.mono);
  min-height: 100px;
  padding: token(spacing.2) token(spacing.3);
  resize: vertical;
  width: 100%;

  &:focus {
    border-color: token(colors.accent.fg);
    outline: none;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
`;

export const error = css`
  color: token(colors.diff.del);
  font-size: token(fontSizes.xs);
`;

export const actions = css`
  display: flex;
  gap: token(spacing.2);
  justify-content: flex-end;
`;

export const button = css`
  align-items: center;
  border: 1px solid token(colors.border.default);
  border-radius: token(radii.sm);
  cursor: pointer;
  display: inline-flex;
  font-size: token(fontSizes.xs);
  font-weight: 500;
  gap: token(spacing.1.5);
  height: token(sizes.control.sm);
  padding: 0 token(spacing.3);
  transition: background 140ms token(easings.standard);

  &:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
`;

export const buttonSecondary = css`
  background: transparent;
  color: token(colors.fg.muted);

  &:hover:not(:disabled) {
    background: token(colors.bg.hover);
    color: token(colors.fg.default);
  }
`;

export const buttonPrimary = css`
  background: token(colors.accent.bg);
  border-color: token(colors.accent.fg);
  color: token(colors.accent.fg);

  &:hover:not(:disabled) {
    opacity: 0.9;
  }
`;
