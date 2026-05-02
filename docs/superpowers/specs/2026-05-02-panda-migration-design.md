# Panda CSS Migration Design — apps/web

**Date**: 2026-05-02
**Scope**: `apps/web` only (React review-panel app)
**Replaces**: `@vanilla-extract/css` + `@vanilla-extract/vite-plugin`
**With**: `@pandacss/dev` in template-literal + hash mode

## Goal

Replace vanilla-extract `style({})` declarations with Panda CSS `css\`...\`` template literals while introducing a comprehensive design system token layer to maximize atomic-class reuse and prevent CSS bloat.

## Decisions (locked)

| Decision          | Choice                                                                                 |
| ----------------- | -------------------------------------------------------------------------------------- |
| CSS engine        | Panda CSS, `syntax: 'template-literal'`, `hash: true`                                  |
| Token scope       | colors + fonts (existing) + spacing + radii + sizes + fontSizes + easings              |
| API form          | `css\`...\``returning className; sibling`X.styles.ts` files                            |
| Theme mechanism   | semanticTokens with `_dark` condition keyed to `[data-theme=dark] &`                   |
| Reset strategy    | `preflight: true`, with manual visual verification and per-element overrides as needed |
| Naming convention | Tailwind/Panda numeric scale (`spacing.1 = 4px`, `sizes.control.md = 28px`)            |
| Easings           | single token `easings.standard`                                                        |

## Token taxonomy

### Raw tokens (`tokens`)

```ts
colors: {
  neutral: { 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950 },  // existing palette
  diff: { addLight: '#1a7f37', addDark: '#3fb950',
          delLight: '#cf222e', delDark: '#f85149' },
}
spacing: { 1: '4px', 1.5: '6px', 2: '8px', 2.5: '10px',
           3: '12px', 3.5: '14px', 4: '16px' }
sizes:   { control: { xs: '24px', sm: '26px', md: '28px', lg: '32px', xl: '36px' } }
radii:   { sm: '4px', md: '6px' }
fontSizes: { xs: '11px', sm: '12px', md: '13px', lg: '14px' }
fonts: {
  sans: "'Geist', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  mono: "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
}
easings: { standard: 'cubic-bezier(0.4, 0, 0.2, 1)' }
```

### Semantic tokens

```ts
colors: {
  bg: {
    canvas:   { value: { base: '{colors.neutral.50}',  _dark: '{colors.neutral.950}' } },
    surface:  { value: { base: '#ffffff',              _dark: '{colors.neutral.900}' } },
    hover:    { value: { base: '{colors.neutral.100}', _dark: '{colors.neutral.800}' } },
    subtle:   { value: { base: '{colors.neutral.100}', _dark: '{colors.neutral.800}' } },
    selected: { value: { base: '{colors.neutral.900}', _dark: '{colors.neutral.50}'  } },
  },
  fg: {
    default:    { value: { base: '{colors.neutral.950}', _dark: '{colors.neutral.50}'  } },
    muted:      { value: { base: '{colors.neutral.500}', _dark: '{colors.neutral.400}' } },
    onSelected: { value: { base: '{colors.neutral.50}',  _dark: '{colors.neutral.950}' } },
  },
  border: {
    default: { value: { base: '{colors.neutral.200}', _dark: '{colors.neutral.800}' } },
    strong:  { value: { base: '{colors.neutral.900}', _dark: '{colors.neutral.50}'  } },
  },
  focus: {
    ring: { value: { base: '{colors.neutral.900}', _dark: '{colors.neutral.50}' } },
  },
  diff: {
    add: { value: { base: '{colors.diff.addLight}', _dark: '{colors.diff.addDark}' } },
    del: { value: { base: '{colors.diff.delLight}', _dark: '{colors.diff.delDark}' } },
  },
}
```

### Conditions

```ts
conditions: {
  dark: '[data-theme=dark] &';
}
```

The `use-color-scheme` hook continues to set `data-theme` on `:root`, unchanged.

## Build integration

### Dependency changes (`apps/web/package.json`)

- Remove: `@vanilla-extract/css`, `@vanilla-extract/vite-plugin`
- Add (devDependencies): `@pandacss/dev`, `autoprefixer`

### Scripts

```json
{
  "scripts": {
    "prepare": "panda codegen",
    "dev": "vite --host 127.0.0.1",
    "dev:mock": "KAGURA_WEB_MOCK_API=true vite --host 127.0.0.1 --open /reviews/mock-review",
    "build": "panda codegen && vite build",
    "preview": "vite preview --host 127.0.0.1",
    "typecheck": "panda codegen && tsc -p tsconfig.json --noEmit"
  }
}
```

### Vite config

```ts
import autoprefixer from 'autoprefixer';
import pandacss from '@pandacss/dev/postcss';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { createMockReviewApiPlugin } from './mock-review-api.js';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const useMockApi = env.KAGURA_WEB_MOCK_API === 'true';
  return {
    css: { postcss: { plugins: [pandacss(), autoprefixer()] } },
    resolve: { tsconfigPaths: true },
    plugins: [react(), ...(useMockApi ? [createMockReviewApiPlugin()] : [])],
    server: !useMockApi
      ? { proxy: { '/api': env.KAGURA_REVIEW_PANEL_API_URL ?? 'http://127.0.0.1:3077' } }
      : {},
  };
});
```

The `vanillaExtractPlugin()` is removed.

### `panda.config.ts` (new file at `apps/web/`)

```ts
import { defineConfig } from '@pandacss/dev';

export default defineConfig({
  syntax: 'template-literal',
  hash: true,
  preflight: true,
  jsxFramework: 'react',
  include: ['./src/**/*.{ts,tsx}'],
  exclude: [],
  outdir: 'styled-system',
  conditions: { dark: '[data-theme=dark] &' },
  theme: {
    tokens: {
      /* see Token taxonomy above */
    },
    semanticTokens: {
      /* see Token taxonomy above */
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
```

`preflight: true` provides Tailwind-style base reset; `globalCss` adds the project-specific layer. Step 2 of implementation requires manual visual verification of preflight effects.

### `.gitignore` (apps/web/) — append

```
styled-system/
```

### Entry point (`apps/web/src/main.tsx`)

```diff
- import './theme/theme.css';
+ import '../styled-system/styles.css';
```

### Files to delete

- `apps/web/src/theme/theme.css.ts`
- `apps/web/src/theme/tokens.ts`

`apps/web/src/theme/use-color-scheme.ts` is retained.

## File layout & migration mapping

### Naming convention

`X.css.ts` → `X.styles.ts` (avoids the `.css` suffix collision with Panda-emitted styles).

### Per-file mapping

| vanilla-extract file                                   | panda template-literal file   |
| ------------------------------------------------------ | ----------------------------- |
| `theme/theme.css.ts` + `theme/tokens.ts`               | merged into `panda.config.ts` |
| `features/review-panel/components/ReviewLayout.css.ts` | `ReviewLayout.styles.ts`      |
| `features/review-panel/components/ShellState.css.ts`   | `ShellState.styles.ts`        |
| `Sidebar/SegmentedControl.css.ts`                      | `SegmentedControl.styles.ts`  |
| `Sidebar/FileNav.css.ts`                               | `FileNav.styles.ts`           |
| `Sidebar/SidebarHeader.css.ts`                         | `SidebarHeader.styles.ts`     |
| `DiffPane/DiffPane.css.ts`                             | `DiffPane.styles.ts`          |
| `DiffPane/DiffToolbar.css.ts`                          | `DiffToolbar.styles.ts`       |
| `DiffPane/DiffStatusBar.css.ts`                        | `DiffStatusBar.styles.ts`     |
| `DiffPane/DiffView.css.ts`                             | `DiffView.styles.ts`          |

### Component import change

```diff
- import * as styles from './X.css';
+ import * as styles from './X.styles';
```

All `styles.foo` usages remain identical. Conditional className concatenation (e.g., `collapsed ? styles.sidebarCollapsed : styles.sidebar`) is unchanged.

### Style block translation example

```ts
// before (X.css.ts)
import { style } from '@vanilla-extract/css';
import { vars } from '../../../theme/theme.css';

export const expandButton = style({
  background: 'transparent',
  border: `1px solid ${vars.border.default}`,
  borderRadius: 6,
  color: vars.fg.muted,
  height: 28,
  width: 28,
  fontSize: 11,
  selectors: {
    '&:hover': { background: vars.bg.hover, color: vars.fg.default },
  },
});

// after (X.styles.ts)
import { css } from '../../../../styled-system/css';

export const expandButton = css`
  background: transparent;
  border: 1px solid {colors.border.default};
  border-radius: {radii.md};
  color: {colors.fg.muted};
  height: {sizes.control.md};
  width: {sizes.control.md};
  font-size: {fontSizes.xs};
  &:hover {
    background: {colors.bg.hover};
    color: {colors.fg.default};
  }
`;
```

### Value → token mapping (canonical)

| Original           | Token                      |
| ------------------ | -------------------------- |
| 4px                | `{spacing.1}`              |
| 6px                | `{spacing.1.5}`            |
| 8px                | `{spacing.2}`              |
| 10px               | `{spacing.2.5}`            |
| 12px               | `{spacing.3}`              |
| 14px               | `{spacing.3.5}`            |
| 16px               | `{spacing.4}`              |
| `border-radius: 4` | `{radii.sm}`               |
| `border-radius: 6` | `{radii.md}`               |
| `height: 24`       | `{sizes.control.xs}`       |
| `height: 26`       | `{sizes.control.sm}`       |
| `height: 28`       | `{sizes.control.md}`       |
| `height: 32`       | `{sizes.control.lg}`       |
| `height: 36`       | `{sizes.control.xl}`       |
| `font-size: 11`    | `{fontSizes.xs}`           |
| `font-size: 12`    | `{fontSizes.sm}`           |
| `font-size: 13`    | `{fontSizes.md}`           |
| `font-size: 14`    | `{fontSizes.lg}`           |
| `120ms ease`       | `120ms {easings.standard}` |

Edge cases retained as raw values: `width: 4` (resize handle), `width: 14` (FileNav badge column). Both are non-control sizing and would inflate the token surface for negligible reuse benefit.

## Implementation order

### Step 1 — Skeleton

- Add/remove dependencies, run `pnpm install`
- Create `apps/web/panda.config.ts` with full token set, `preflight: true`, `globalCss`
- Update `vite.config.ts` to PostCSS chain (drop `vanillaExtractPlugin`)
- Update scripts (`prepare`/`build`/`typecheck`)
- Append `styled-system/` to `apps/web/.gitignore`
- Verify: `apps/web/styled-system/` is generated and contains `css/index.mjs`, `tokens/index.mjs`. `pnpm typecheck` passes.

### Step 2 — Entry point switch + preflight verification

- Change `main.tsx` import to `../styled-system/styles.css`
- Delete `theme/theme.css.ts` and `theme/tokens.ts`
- Run `pnpm dev:mock`. **Visually verify against preflight reset**:
  - light/dark theme toggle still works
  - body font and background match prior look
  - focus ring appears on tabbed elements
  - box-sizing inheritance is correct
- For any element where preflight reset breaks the previous look (likely candidates: `<button>`, `<input>`, `<aside>`), add scoped overrides to `globalCss` rather than disabling preflight wholesale.

### Steps 3–5 — Component migration (one folder per step)

Each step:

1. Author `X.styles.ts` using the value map
2. Update `X.tsx` import suffix `.css` → `.styles`
3. Delete `X.css.ts`
4. `pnpm typecheck` + `pnpm dev:mock` visual diff against the previous commit

- Step 3: `ReviewLayout` + `ShellState`
- Step 4: `Sidebar/{SegmentedControl, FileNav, SidebarHeader}`
- Step 5: `DiffPane/{DiffPane, DiffToolbar, DiffStatusBar, DiffView}`

### Step 6 — Sweep

- Search `apps/web/src` for any residual `@vanilla-extract` imports or `*.css.ts` files; remove
- Confirm no orphan exports

### Step 7 — Final verification

- `pnpm build` (codegen + tsc + vite build) passes with no errors
- Mock review-page visual checklist:
  - sidebar collapse/expand, resize handle hover and focus ring
  - file tree ↔ list view switch, active row selected color (light + dark)
  - SegmentedControl active button, hover state
  - DiffToolbar icon button hover, disabled, breadcrumb truncation
  - DiffStatusBar additions/deletions colors, kbd badge style
  - SidebarHeader filter input focus background
  - keyboard focus ring visible across all interactive elements
- Light ↔ dark toggle exhaustive pass per checklist

## Risks and mitigations

| Risk                                                                                                                              | Mitigation                                                                                                                                                                            |
| --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Preflight rewrites button/input default look across SidebarHeader filterInput, SegmentedControl button, ReviewLayout expandButton | Step 2 dedicated visual pass; add per-element `globalCss` overrides; if cost exceeds value, fall back to `preflight: false` plus manual port of the original five `globalStyle` rules |
| Decimal token keys (`spacing.1.5`) may not parse in template-literal interpolation                                                | After Step 1 codegen, inspect `styled-system/tokens/index.mjs` for the keys; if unsupported, rename to `spacing.1_5` (or similar) and update the value-map table accordingly          |
| `font: 13px/1.5 {fonts.sans}` shorthand may not interpolate cleanly in hash mode                                                  | If broken, split into discrete `font-family`, `font-size`, `line-height` declarations                                                                                                 |
| `vite-plugin-code-inspector` (devDep) source map interaction with `hash: true`                                                    | Verify dev mode in Step 1; if broken, disable the inspector for CSS files or set `hash: false` for development only                                                                   |

## Out of scope

- Other apps in the workspace (this spec is `apps/web` only)
- Migrating to Panda `styled.X\`...\`` factory components
- Recipes / variants — stay with raw className constants matching today's pattern
- Token additions beyond the seven categories agreed in this spec (no shadows, durations, zIndex, layerStyles, textStyles)
- Component refactoring or visual changes; the migration must be visually identical to the pre-migration state
