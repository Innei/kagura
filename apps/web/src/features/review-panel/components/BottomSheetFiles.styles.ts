import { css } from 'styled-system/css';

export const scrim = css`
  align-items: flex-end;
  background: rgba(0, 0, 0, 0);
  display: flex;
  inset: 0;
  position: fixed;
  transition: background 220ms token(easings.standard);
  z-index: 100;
  &[data-shown='true'] {
    background: rgba(0, 0, 0, 0.32);
  }
`;

export const sheet = css`
  background: token(colors.bg.canvas);
  border-top: 1px solid token(colors.border.default);
  border-top-left-radius: 14px;
  border-top-right-radius: 14px;
  display: flex;
  flex-direction: column;
  max-height: 70vh;
  min-height: 40vh;
  padding-bottom: env(safe-area-inset-bottom, 0);
  transform: translateY(100%);
  transition: transform 260ms cubic-bezier(0.32, 0.72, 0, 1);
  width: 100%;
  will-change: transform;
  &[data-shown='true'] {
    transform: translateY(0);
  }
  @media (prefers-reduced-motion: reduce) {
    transition-duration: 0ms;
  }
`;

export const handle = css`
  align-self: center;
  background: token(colors.fg.dim);
  border-radius: 2px;
  height: 3px;
  margin-top: token(spacing.2);
  opacity: 0.6;
  width: 36px;
`;

export const header = css`
  align-items: baseline;
  border-bottom: 1px solid token(colors.border.default);
  display: flex;
  gap: token(spacing.2);
  padding: token(spacing.3) token(spacing.4) token(spacing.2.5);
`;

export const title = css`
  color: token(colors.fg.default);
  font-size: token(fontSizes.md);
  font-weight: 600;
  letter-spacing: -0.15px;
`;

export const count = css`
  color: token(colors.fg.dim);
  font: token(fontSizes.xs) token(fonts.mono);
`;

export const list = css`
  flex: 1;
  list-style: none;
  margin: 0;
  min-height: 0;
  overflow-y: auto;
  padding: 0;
`;

export const row = css`
  align-items: center;
  background: transparent;
  border: 0;
  border-bottom: 1px solid token(colors.border.subtle);
  color: token(colors.fg.default);
  cursor: pointer;
  display: grid;
  font: inherit;
  gap: token(spacing.2);
  grid-template-columns: 14px minmax(0, 1fr) auto;
  padding: token(spacing.2.5) token(spacing.4);
  text-align: left;
  width: 100%;
  &:hover {
    background: token(colors.bg.hover);
  }
`;

export const rowActive = css`
  background: token(colors.bg.hover);
`;

export const status = css`
  color: token(colors.fg.dim);
  font: token(fontSizes.xs) / 1 token(fonts.mono);
  font-weight: 700;
  text-align: center;
`;

export const name = css`
  display: flex;
  flex-direction: column;
  min-width: 0;
`;

export const nameStrong = css`
  color: token(colors.fg.default);
  font: token(fontSizes.md) token(fonts.mono);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const dir = css`
  color: token(colors.fg.dim);
  font: token(fontSizes.xs) token(fonts.mono);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const deltas = css`
  display: inline-flex;
  font: token(fontSizes.xs) / 1 token(fonts.mono);
  font-variant-numeric: tabular-nums;
  gap: token(spacing.1.5);
`;

export const additions = css`
  color: token(colors.diff.add);
`;

export const deletions = css`
  color: token(colors.diff.del);
`;

export const statusAdded = css`
  color: token(colors.status.added);
`;

export const statusModified = css`
  color: token(colors.status.modified);
`;

export const statusDeleted = css`
  color: token(colors.status.deleted);
`;

export const statusRenamed = css`
  color: token(colors.status.renamed);
`;
