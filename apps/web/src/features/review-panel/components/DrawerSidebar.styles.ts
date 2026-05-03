import { css } from 'styled-system/css';

export const scrim = css`
  align-items: stretch;
  background: rgba(0, 0, 0, 0.32);
  display: flex;
  inset: 0;
  position: fixed;
  z-index: 100;
`;

export const drawer = css`
  background: token(colors.bg.canvas);
  display: flex;
  flex-direction: column;
  height: 100%;
  max-width: 360px;
  min-width: 0;
  width: 80%;
`;
