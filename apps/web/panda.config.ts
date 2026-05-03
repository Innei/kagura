import { defineConfig } from '@pandacss/dev';

const neutral = {
  50: '#fafafa',
  100: '#f5f5f5',
  200: '#e5e5e5',
  300: '#d4d4d4',
  400: '#a3a3a3',
  500: '#737373',
  600: '#525252',
  700: '#404040',
  800: '#262626',
  900: '#171717',
  950: '#0a0a0a',
} as const;

export default defineConfig({
  syntax: 'template-literal',
  hash: true,
  preflight: true,
  jsxFramework: 'react',
  include: ['./src/**/*.{ts,tsx}'],
  exclude: [],
  outdir: 'styled-system',
  conditions: {
    dark: '[data-theme=dark] &',
  },
  theme: {
    tokens: {
      colors: {
        neutral: {
          50: { value: neutral[50] },
          100: { value: neutral[100] },
          200: { value: neutral[200] },
          300: { value: neutral[300] },
          400: { value: neutral[400] },
          500: { value: neutral[500] },
          600: { value: neutral[600] },
          700: { value: neutral[700] },
          800: { value: neutral[800] },
          900: { value: neutral[900] },
          950: { value: neutral[950] },
        },
        diff: {
          addLight: { value: '#1a7f37' },
          addDark: { value: '#3fb950' },
          delLight: { value: '#cf222e' },
          delDark: { value: '#f85149' },
        },
        accent: {
          light: { value: neutral[900] },
          dark: { value: neutral[50] },
        },
        status: {
          addedLight: { value: '#1a7f37' },
          addedDark: { value: '#3fb950' },
          modifiedLight: { value: '#9a6700' },
          modifiedDark: { value: '#d29922' },
          deletedLight: { value: '#cf222e' },
          deletedDark: { value: '#f85149' },
          renamedLight: { value: '#8250df' },
          renamedDark: { value: '#bc8cff' },
        },
      },
      spacing: {
        1: { value: '4px' },
        '1.5': { value: '6px' },
        2: { value: '8px' },
        '2.5': { value: '10px' },
        3: { value: '12px' },
        '3.5': { value: '14px' },
        4: { value: '16px' },
      },
      sizes: {
        control: {
          xs: { value: '24px' },
          sm: { value: '26px' },
          md: { value: '28px' },
          lg: { value: '32px' },
          xl: { value: '36px' },
        },
      },
      radii: {
        sm: { value: '4px' },
        md: { value: '6px' },
      },
      fontSizes: {
        xs: { value: '12px' },
        sm: { value: '13px' },
        md: { value: '14px' },
        lg: { value: '15px' },
      },
      fonts: {
        sans: {
          value:
            "'Geist', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        },
        mono: {
          value: "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
        },
      },
      easings: {
        standard: { value: 'cubic-bezier(0.4, 0, 0.2, 1)' },
      },
    },
    semanticTokens: {
      colors: {
        bg: {
          canvas: {
            value: { base: '{colors.neutral.50}', _dark: '{colors.neutral.950}' },
          },
          surface: {
            value: { base: '#ffffff', _dark: '{colors.neutral.900}' },
          },
          hover: {
            value: { base: '{colors.neutral.100}', _dark: '{colors.neutral.800}' },
          },
          subtle: {
            value: { base: '{colors.neutral.100}', _dark: '{colors.neutral.800}' },
          },
          wash: {
            value: { base: 'rgba(0,0,0,0.04)', _dark: 'rgba(255,255,255,0.04)' },
          },
          selected: {
            value: { base: '{colors.neutral.900}', _dark: '{colors.neutral.50}' },
          },
        },
        fg: {
          default: {
            value: { base: '{colors.neutral.950}', _dark: '{colors.neutral.50}' },
          },
          muted: {
            value: { base: '{colors.neutral.500}', _dark: '{colors.neutral.400}' },
          },
          dim: {
            value: { base: '{colors.neutral.400}', _dark: '{colors.neutral.600}' },
          },
          onSelected: {
            value: { base: '{colors.neutral.50}', _dark: '{colors.neutral.950}' },
          },
        },
        border: {
          default: {
            value: { base: '{colors.neutral.200}', _dark: '{colors.neutral.800}' },
          },
          subtle: {
            value: { base: '{colors.neutral.100}', _dark: '{colors.neutral.900}' },
          },
          strong: {
            value: { base: '{colors.neutral.900}', _dark: '{colors.neutral.50}' },
          },
        },
        focus: {
          ring: {
            value: { base: '{colors.neutral.900}', _dark: '{colors.neutral.50}' },
          },
        },
        diff: {
          add: {
            value: { base: '{colors.diff.addLight}', _dark: '{colors.diff.addDark}' },
          },
          del: {
            value: { base: '{colors.diff.delLight}', _dark: '{colors.diff.delDark}' },
          },
        },
        accent: {
          fg: {
            value: { base: '{colors.accent.light}', _dark: '{colors.accent.dark}' },
          },
          bg: {
            value: { base: 'rgba(0,0,0,0.06)', _dark: 'rgba(255,255,255,0.08)' },
          },
        },
        status: {
          added: {
            value: { base: '{colors.status.addedLight}', _dark: '{colors.status.addedDark}' },
          },
          modified: {
            value: { base: '{colors.status.modifiedLight}', _dark: '{colors.status.modifiedDark}' },
          },
          deleted: {
            value: { base: '{colors.status.deletedLight}', _dark: '{colors.status.deletedDark}' },
          },
          renamed: {
            value: { base: '{colors.status.renamedLight}', _dark: '{colors.status.renamedDark}' },
          },
        },
      },
    },
  },
  globalCss: {
    ':root': {
      'colorScheme': 'light dark',
      // Pierre/diffs (shadow DOM)
      '--diffs-font-family':
        "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
      '--diffs-header-font-family':
        "'Geist', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      '--diffs-font-size': '14px',
      '--diffs-line-height': '1.55',
      // Pierre/trees (shadow DOM)
      '--trees-font-family-override':
        "'Geist', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      '--trees-font-size-override': '14px',
    },
    'html, body': { margin: 0, padding: 0 },
    'body': {
      background: '{colors.bg.canvas}',
      color: '{colors.fg.default}',
      font: '{fontSizes.md}/1.5 {fonts.sans}',
      WebkitFontSmoothing: 'antialiased',
      MozOsxFontSmoothing: 'grayscale',
    },
    ':focus-visible': {
      outline: '2px solid {colors.focus.ring}',
      outlineOffset: '2px',
      borderRadius: '{radii.sm}',
    },
    ':focus:not(:focus-visible)': { outline: 'none' },
  },
});
