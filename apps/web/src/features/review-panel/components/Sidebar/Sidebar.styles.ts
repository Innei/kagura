import { css } from 'styled-system/css';

export const root = css`
  background: token(colors.bg.canvas);
  border-right: 1px solid token(colors.border.default);
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  height: 100%;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
`;

export const collapsed = css`
  background: token(colors.bg.canvas);
  border-right: 1px solid token(colors.border.default);
  display: grid;
  height: 100%;
  place-items: start center;
  padding: token(spacing.2) 0;
`;

export const loading = css`
  color: token(colors.fg.muted);
  font-size: token(fontSizes.xs);
  padding: token(spacing.3);
  text-align: center;
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
  position: relative;
  transform-origin: center;
  transition:
    background 140ms token(easings.standard),
    color 140ms token(easings.standard),
    transform 120ms token(easings.standard);
  width: token(sizes.control.md);

  &::after {
    content: '';
    height: 40px;
    left: 50%;
    min-width: 40px;
    position: absolute;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 100%;
  }
  &:hover {
    background: token(colors.bg.hover);
    color: token(colors.fg.default);
  }
  &:active {
    transform: scale(0.96);
  }
`;
