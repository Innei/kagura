import { css } from 'styled-system/css';

export const root = css`
  align-items: center;
  background: token(colors.bg.canvas);
  color: token(colors.fg.default);
  display: grid;
  min-height: 100vh;
  padding: token(spacing.6);
  width: 100%;
`;

export const content = css`
  display: grid;
  gap: token(spacing.4);
  max-width: 520px;
  width: 100%;
`;

export const iconWrap = css`
  align-items: center;
  background: token(colors.bg.surface);
  border: 1px solid token(colors.border.default);
  border-radius: token(radii.md);
  color: token(colors.fg.muted);
  display: inline-flex;
  height: 40px;
  justify-content: center;
  width: 40px;
`;

export const eyebrow = css`
  color: token(colors.fg.muted);
  font-size: token(fontSizes.xs);
  font-weight: 600;
  letter-spacing: 0;
  text-transform: uppercase;
`;

export const title = css`
  font-size: 32px;
  font-weight: 600;
  letter-spacing: -0.4px;
  line-height: 1.15;
  margin: 0;
  text-wrap: balance;
`;

export const description = css`
  color: token(colors.fg.muted);
  font-size: token(fontSizes.sm);
  line-height: 1.6;
  margin: 0;
  max-width: 440px;
  text-wrap: pretty;
`;

export const path = css`
  background: token(colors.bg.surface);
  border: 1px solid token(colors.border.default);
  border-radius: token(radii.md);
  color: token(colors.fg.muted);
  font-family: token(fonts.mono);
  font-size: token(fontSizes.xs);
  line-height: 1.5;
  overflow-wrap: anywhere;
  padding: token(spacing.2) token(spacing.2.5);
`;
