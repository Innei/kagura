import { css } from 'styled-system/css';

export const root = css`
  background: token(colors.bg.canvas);
  color: token(colors.fg.default);
  display: grid;
  grid-template-rows: auto 1fr auto;
  height: 100vh;
  min-height: 0;
  overflow: hidden;
  width: 100%;
`;

export const panels = css`
  height: 100%;
  min-height: 0;
  width: 100%;
`;

export const resizeHandle = css`
  background: transparent;
  cursor: col-resize;
  outline: none;
  position: relative;
  width: 0px;
  &::before {
    background: transparent;
    content: '';
    inset: 0 -1px;
    position: absolute;
    transition: background 120ms token(easings.standard);
    z-index: 99999;
  }
  &:hover::before,
  &[data-resize-handle-active]::before {
    background: token(colors.accent.fg);
  }
  &:focus-visible::before {
    background: token(colors.focus.ring);
  }
`;

export const skipLink = css`
  background: token(colors.bg.selected);
  border: 1px solid token(colors.border.strong);
  border-radius: token(radii.md);
  color: token(colors.fg.onSelected);
  font-size: token(fontSizes.sm);
  left: token(spacing.2);
  padding: token(spacing.1.5) token(spacing.2.5);
  position: absolute;
  text-decoration: none;
  top: token(spacing.2);
  transform: translateY(-200%);
  transition: transform 120ms token(easings.standard);
  z-index: 10;
  &:focus,
  &:focus-visible {
    transform: translateY(0);
  }
`;
