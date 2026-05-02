import { style } from '@vanilla-extract/css';

const colors = {
  background: '#f5f6f8',
  border: '#d0d7de',
  hover: '#eef6ff',
  muted: '#57606a',
  surface: '#ffffff',
  text: '#202124',
  toolbarButton: '#f6f8fa',
  toolbarButtonHover: '#eef1f4',
};

export const body = style({
  margin: 0,
});

export const appFrame = style({
  background: colors.background,
  boxSizing: 'border-box',
  color: colors.text,
  font: "13px/1.45 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  minHeight: '100vh',
});

export const reviewShell = style({
  'display': 'grid',
  'gridTemplateColumns': 'minmax(280px, 360px) minmax(0, 1fr)',
  'height': '100vh',

  '@media': {
    '(max-width: 760px)': {
      gridTemplateColumns: '1fr',
      gridTemplateRows: '44vh 56vh',
    },
  },
});

export const sidebar = style({
  'background': colors.surface,
  'borderRight': `1px solid ${colors.border}`,
  'boxSizing': 'border-box',
  'display': 'grid',
  'gridTemplateRows': 'auto auto minmax(0, 1fr)',
  'minWidth': 0,
  'overflow': 'hidden',

  '@media': {
    '(max-width: 760px)': {
      borderBottom: `1px solid ${colors.border}`,
      borderRight: 0,
    },
  },
});

export const sidebarHeader = style({
  borderBottom: `1px solid ${colors.border}`,
  boxSizing: 'border-box',
  display: 'grid',
  gap: 4,
  padding: '14px 16px 12px',
});

export const sidebarTitle = style({
  fontSize: 15,
});

export const sidebarMeta = style({
  color: colors.muted,
  overflowWrap: 'anywhere',
});

export const sidebarSection = style({
  minHeight: 0,
  minWidth: 0,
});

export const treeSection = style([
  sidebarSection,
  {
    display: 'grid',
    gridTemplateRows: 'auto minmax(0, 1fr)',
  },
]);

export const sectionTitle = style({
  color: colors.muted,
  fontSize: 11,
  fontWeight: 700,
  padding: '12px 16px 6px',
  textTransform: 'uppercase',
});

export const changedList = style({
  boxSizing: 'border-box',
  padding: '0 8px 8px',
});

export const fileRow = style({
  alignItems: 'center',
  background: 'transparent',
  border: 0,
  borderRadius: 6,
  boxSizing: 'border-box',
  color: 'inherit',
  cursor: 'pointer',
  display: 'grid',
  font: 'inherit',
  gap: 6,
  gridTemplateColumns: '34px minmax(0, 1fr)',
  minHeight: 28,
  padding: '4px 8px',
  textAlign: 'left',
  width: '100%',

  selectors: {
    '&:hover': {
      background: colors.hover,
    },
  },
});

export const activeFileRow = style({
  background: colors.hover,
});

export const status = style({
  color: colors.muted,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  fontSize: 12,
});

export const path = style({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

const mutedText = style({
  color: colors.muted,
});

export const emptyList = style([
  mutedText,
  {
    padding: '4px 16px 12px',
  },
]);

export const fileTree = style({
  border: `1px solid ${colors.border}`,
  borderRadius: 6,
  boxSizing: 'border-box',
  display: 'block',
  height: '100%',
  margin: '0 8px 12px',
  minHeight: 0,
  overflow: 'hidden',
});

export const diffPane = style({
  display: 'grid',
  gridTemplateRows: '44px minmax(0, 1fr)',
  minHeight: 0,
  minWidth: 0,
});

export const toolbar = style({
  alignItems: 'center',
  background: colors.surface,
  borderBottom: `1px solid ${colors.border}`,
  boxSizing: 'border-box',
  display: 'flex',
  gap: 12,
  minWidth: 0,
  padding: '8px 12px',
});

export const toolbarButton = style({
  background: colors.toolbarButton,
  border: `1px solid ${colors.border}`,
  borderRadius: 6,
  boxSizing: 'border-box',
  cursor: 'pointer',
  font: 'inherit',
  height: 28,
  padding: '0 10px',

  selectors: {
    '&:hover': {
      background: colors.toolbarButtonHover,
    },
  },
});

export const toolbarLabel = style({
  color: colors.muted,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const diffContent = style({
  background: colors.surface,
  boxSizing: 'border-box',
  minHeight: 0,
  minWidth: 0,
  overflow: 'auto',
  padding: 16,
});

export const diffPatch = style({
  selectors: {
    '& + &': {
      marginTop: 16,
    },
  },
});

export const diffEmpty = style([
  mutedText,
  {
    background: colors.surface,
    boxSizing: 'border-box',
    minHeight: 0,
    minWidth: 0,
    overflow: 'auto',
    padding: 16,
  },
]);

export const shellState = style([
  mutedText,
  {
    display: 'grid',
    height: '100vh',
    placeItems: 'center',
  },
]);
