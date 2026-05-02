import { css } from 'styled-system/css';

export const root = css`
  display: grid;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
`;

export const treeWrap = css`
  display: block;
  height: 100%;
  min-height: 0;
  overflow: hidden;
`;

export const tree = css`
  display: block;
  height: 100%;
  min-height: 0;
  overflow: hidden;
`;

export const flatList = css`
  box-sizing: border-box;
  display: grid;
  gap: 1px;
  overflow: auto;
  padding: token(spacing.1) token(spacing.2) token(spacing.2);
  min-height: 0;
`;

export const flatRow = css`
  align-items: center;
  background: transparent;
  border: 0;
  border-radius: token(radii.md);
  color: token(colors.fg.default);
  cursor: pointer;
  display: grid;
  font: inherit;
  font-size: token(fontSizes.sm);
  gap: token(spacing.2);
  grid-template-columns: 14px minmax(0, 1fr) auto;
  min-height: token(sizes.control.xs);
  padding: token(spacing.1) token(spacing.2);
  text-align: left;
  width: 100%;
  &:hover {
    background: token(colors.bg.hover);
  }
`;

export const flatRowActive = css`
  background: token(colors.bg.selected);
  color: token(colors.fg.onSelected);
  &:hover {
    background: token(colors.bg.selected);
  }
`;

export const badge = css`
  color: token(colors.fg.muted);
  font: token(fontSizes.xs) / 1 token(fonts.mono);
  text-align: center;
  width: 14px;
`;

export const badgeActive = css`
  color: token(colors.fg.onSelected);
`;

export const path = css`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const stats = css`
  color: token(colors.fg.muted);
  display: inline-flex;
  font: token(fontSizes.xs) / 1 token(fonts.mono);
  gap: token(spacing.1.5);
`;

export const statsActive = css`
  color: token(colors.fg.onSelected);
`;

export const additions = css`
  color: token(colors.diff.add);
`;

export const additionsActive = css`
  color: token(colors.fg.onSelected);
`;

export const deletions = css`
  color: token(colors.diff.del);
`;

export const deletionsActive = css`
  color: token(colors.fg.onSelected);
`;

export const empty = css`
  color: token(colors.fg.muted);
  padding: token(spacing.2) token(spacing.4);
`;
