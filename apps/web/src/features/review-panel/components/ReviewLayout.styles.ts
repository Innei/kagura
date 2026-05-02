import { css } from 'styled-system/css';

export const root = css`
  background: token(colors.bg.canvas);
  color: token(colors.fg.default);
  height: 100vh;
  width: 100%;
  overflow: hidden;
`;

export const sidebar = css`
  background: token(colors.bg.surface);
  border-right: 1px solid token(colors.border.default);
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  height: 100%;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
`;

export const sidebarCollapsed = css`
  background: token(colors.bg.surface);
  border-right: 1px solid token(colors.border.default);
  display: grid;
  height: 100%;
  place-items: center;
  padding: token(spacing.2) 0;
`;

export const expandButton = css`
  background: transparent;
  border: 1px solid token(colors.border.default);
  border-radius: token(radii.md);
  color: token(colors.fg.muted);
  cursor: pointer;
  font: inherit;
  font-size: token(fontSizes.xs);
  height: token(sizes.control.md);
  padding: 0;
  width: token(sizes.control.md);
  &:hover {
    background: token(colors.bg.hover);
    color: token(colors.fg.default);
  }
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
    z-index: 99999;
    transition: background 120ms token(easings.standard);
  }
  &:hover::before,
  &[data-resize-handle-active]::before {
    background: token(colors.border.strong);
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
