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
        xs: { value: '11px' },
        sm: { value: '12px' },
        md: { value: '13px' },
        lg: { value: '14px' },
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
          onSelected: {
            value: { base: '{colors.neutral.50}', _dark: '{colors.neutral.950}' },
          },
        },
        border: {
          default: {
            value: { base: '{colors.neutral.200}', _dark: '{colors.neutral.800}' },
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
      },
    },
  },
  globalCss: {
    ':root': { colorScheme: 'light dark' },
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
