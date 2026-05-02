import { css } from 'styled-system/css';

export const root = css`
  display: inline-flex;
  align-items: stretch;
  border: 1px solid token(colors.border.default);
  border-radius: token(radii.md);
  overflow: hidden;
  height: token(sizes.control.xs);
  font-size: token(fontSizes.xs);
  background: token(colors.bg.surface);
`;

export const button = css`
  background: transparent;
  border: 0;
  color: token(colors.fg.muted);
  cursor: pointer;
  font: inherit;
  height: 100%;
  padding: 0 token(spacing.2.5);
  &:hover {
    color: token(colors.fg.default);
  }
`;

export const active = css`
  background: token(colors.fg.default);
  color: token(colors.bg.surface);
  &:hover {
    color: token(colors.bg.surface);
  }
`;
