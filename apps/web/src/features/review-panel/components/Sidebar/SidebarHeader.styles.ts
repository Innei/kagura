import { css } from 'styled-system/css';

export const root = css`
  display: grid;
  border-bottom: 1px solid token(colors.border.default);
`;

export const meta = css`
  display: grid;
  gap: token(spacing.1);
  padding: token(spacing.2.5) token(spacing.3) token(spacing.2);
`;

export const repo = css`
  font-size: token(fontSizes.md);
  font-weight: 600;
  letter-spacing: -0.01em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
`;

export const subtitle = css`
  align-items: center;
  color: token(colors.fg.muted);
  display: flex;
  flex-wrap: wrap;
  font: token(fontSizes.xs) / 1.4 token(fonts.mono);
  gap: token(spacing.1.5);
  min-width: 0;
`;

export const branch = css`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 50%;
`;

export const subtitleDot = css`
  color: token(colors.border.strong);
  opacity: 0.4;
`;

export const additions = css`
  color: token(colors.diff.add);
`;

export const deletions = css`
  color: token(colors.diff.del);
`;

export const filterContainer = css`
  align-items: stretch;
  border-top: 1px solid token(colors.border.default);
  display: grid;
  grid-template-columns: 1fr auto;
`;

export const filterField = css`
  align-items: center;
  border-right: 1px solid token(colors.border.default);
  display: flex;
  gap: token(spacing.2);
  height: token(sizes.control.md);
  padding-left: token(spacing.3);
  padding-right: token(spacing.2);
  min-width: 0;
  &:focus-within {
    background: token(colors.bg.hover);
  }
`;

export const filterIcon = css`
  color: token(colors.fg.muted);
  flex-shrink: 0;
`;

export const filterInput = css`
  background: transparent;
  border: 0;
  border-radius: 0;
  color: token(colors.fg.default);
  flex: 1;
  font: inherit;
  font-size: token(fontSizes.sm);
  height: 100%;
  min-width: 0;
  padding: 0;
  &::placeholder {
    color: token(colors.fg.muted);
  }
  &:focus {
    outline: none;
  }
`;

export const viewSwitch = css`
  align-items: stretch;
  display: inline-flex;
  height: token(sizes.control.md);
`;

export const viewButton = css`
  background: transparent;
  border: 0;
  border-left: 1px solid token(colors.border.default);
  color: token(colors.fg.muted);
  cursor: pointer;
  font: inherit;
  font-size: token(fontSizes.xs);
  height: 100%;
  letter-spacing: 0.04em;
  padding: 0 14px;
  text-transform: uppercase;
  &:first-of-type {
    border-left: 0;
  }
  &:hover {
    color: token(colors.fg.default);
  }
`;

export const viewButtonActive = css`
  background: token(colors.fg.default);
  color: token(colors.bg.surface);
  &:hover {
    color: token(colors.bg.surface);
  }
`;
