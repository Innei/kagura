export const neutral = {
  '50': '#fafafa',
  '100': '#f5f5f5',
  '200': '#e5e5e5',
  '300': '#d4d4d4',
  '400': '#a3a3a3',
  '500': '#737373',
  '600': '#525252',
  '700': '#404040',
  '800': '#262626',
  '900': '#171717',
  '950': '#0a0a0a',
} as const;

export const lightTokens = {
  bg: {
    canvas: neutral[50],
    surface: '#ffffff',
    hover: neutral[100],
    subtle: neutral[100],
    selected: neutral[900],
  },
  fg: {
    default: neutral[950],
    muted: neutral[500],
    onSelected: neutral[50],
  },
  border: {
    default: neutral[200],
    strong: neutral[900],
  },
  focus: {
    ring: neutral[900],
  },
  diff: {
    add: '#1a7f37',
    del: '#cf222e',
  },
} as const;

export const darkTokens = {
  bg: {
    canvas: neutral[950],
    surface: neutral[900],
    hover: neutral[800],
    subtle: neutral[800],
    selected: neutral[50],
  },
  fg: {
    default: neutral[50],
    muted: neutral[400],
    onSelected: neutral[950],
  },
  border: {
    default: neutral[800],
    strong: neutral[50],
  },
  focus: {
    ring: neutral[50],
  },
  diff: {
    add: '#3fb950',
    del: '#f85149',
  },
} as const;

export type ThemeTokens = typeof lightTokens;
