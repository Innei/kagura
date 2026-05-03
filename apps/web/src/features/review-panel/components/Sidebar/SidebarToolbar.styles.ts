import { css } from 'styled-system/css';

export const root = css`
  align-items: center;
  background: token(colors.bg.canvas);
  display: flex;
  gap: token(spacing.3);
  padding: token(spacing.2.5) token(spacing.4) token(spacing.1.5);
`;

export const filterField = css`
  align-items: center;
  background: transparent;
  border: 0;
  box-shadow: inset 0 -1px 0 transparent;
  display: flex;
  flex: 1;
  gap: token(spacing.1.5);
  min-width: 0;
  padding: token(spacing.1) 0;
  transition: box-shadow 140ms token(easings.standard);

  &:focus-within {
    box-shadow: inset 0 -1px 0 token(colors.fg.dim);
  }
`;

export const filterIcon = css`
  color: token(colors.fg.dim);
  flex-shrink: 0;
`;

export const filterInput = css`
  background: transparent;
  border: 0;
  color: token(colors.fg.default);
  flex: 1;
  font: inherit;
  font-size: token(fontSizes.md);
  min-width: 0;
  padding: 0;

  &::placeholder {
    color: token(colors.fg.dim);
  }
  &:focus {
    outline: none;
  }
  &::-webkit-search-cancel-button {
    -webkit-appearance: none;
  }
`;

export const viewGroup = css`
  align-items: baseline;
  color: token(colors.fg.dim);
  display: inline-flex;
  font-size: token(fontSizes.xs);
  gap: 0;
`;

export const viewButton = css`
  background: transparent;
  border: 0;
  color: token(colors.fg.dim);
  cursor: pointer;
  font: inherit;
  font-size: token(fontSizes.xs);
  padding: 0 token(spacing.1.5);
  transition: color 140ms token(easings.standard);

  &:hover:not([aria-selected='true']) {
    color: token(colors.fg.muted);
  }
  &[aria-selected='true'] {
    color: token(colors.fg.default);
    font-weight: 500;
  }
`;

export const viewSeparator = css`
  color: token(colors.border.default);
`;
