# Web Review Panel — Design Spec

This document captures the visual language, typography rule, and component
decisions for `apps/web`'s review panel UI. It is the source of truth for
polish work; treat it as binding when adding or refactoring chrome.

## North star

**vercel + flat + line + immersive.**

- **Vercel-flat:** monochrome surfaces, no gradients, no shadows, no inset
  highlights. Hierarchy comes from typography and hairlines, not fills.
- **Lines:** depth is conveyed by 1px borders. Thicker rules and filled boxes
  are reserved for status (e.g. diff add/del color washes).
- **Immersive:** chrome is minimal. The TitleBar, Sidebar, RightPane and
  StatusBar share `bg.canvas`. Seams are 1px hairlines only — no `bg.surface`
  bumps to advertise structure.
- **Color discipline:** color carries semantic meaning, not decoration.
  - Diff add/del → `colors.diff.{add,del}`
  - Status badges → `colors.status.{added,modified,deleted,renamed}`
  - Accent (`accent.fg` blue) is reserved for resize-handle hover and diff
    rendering by `@pierre/diffs`. It never marks active tabs, focused inputs,
    or selected pills — those use foreground-color contrast instead.

## Typography rule (must follow)

| Tier          | Min size | Token          | Used by                                                                          |
| ------------- | -------- | -------------- | -------------------------------------------------------------------------------- |
| **Primary**   | 14px     | `fontSizes.md` | File rows, tab labels, breadcrumb filename, filter input, code (diff and source) |
| **Secondary** | 12px     | `fontSizes.xs` | Counts, hints, branch chip, deltas, kbd, status bar                              |

`fontSizes.sm` (13px) exists but is rarely the right choice — pick `xs` or
`md` based on tier. Do not introduce hardcoded `px` font sizes; always go
through tokens.

### Fonts

- **Sans:** `'Geist'` (loaded via `@fontsource/geist` 400/500/600).
- **Mono:** `'Geist Mono'` (loaded via `@fontsource/geist-mono` 400/500/600).

`@font-face` is declared in `src/index.css`. Pierre's shadow DOMs inherit
font availability and consume the project fonts via CSS custom properties
injected in Panda's `globalCss`:

```ts
'--diffs-font-family':       "'Geist Mono', ui-monospace, monospace",
'--diffs-header-font-family': "'Geist', ui-sans-serif, system-ui, sans-serif",
'--diffs-font-size':         '14px',
'--diffs-line-height':       '1.55',
'--trees-font-family-override': "'Geist', ui-sans-serif, system-ui, sans-serif",
'--trees-font-size-override':   '14px',
```

If you change project fonts, update these vars in tandem.

## Color tokens

Semantic tokens (preferred) flip via the `_dark` condition. Always prefer
semantic over raw.

| Token            | Light              | Dark                     | Usage                                                   |
| ---------------- | ------------------ | ------------------------ | ------------------------------------------------------- |
| `bg.canvas`      | `neutral.50`       | `neutral.950`            | Every chrome surface (TitleBar, Sidebar, panes, status) |
| `bg.surface`     | `#fff`             | `neutral.900`            | Reserved for elevated cards (rarely needed in this UI)  |
| `bg.hover`       | `neutral.100`      | `neutral.800`            | Hover fill, Pill active indicator                       |
| `bg.wash`        | `rgba(0,0,0,0.04)` | `rgba(255,255,255,0.04)` | Ghost-button hover, kbd hints                           |
| `bg.subtle`      | `neutral.100`      | `neutral.800`            | Inline section backgrounds (rare)                       |
| `fg.default`     | `neutral.950`      | `neutral.50`             | Primary text                                            |
| `fg.muted`       | `neutral.500`      | `neutral.400`            | Secondary text (deltas summary, branch label)           |
| `fg.dim`         | `neutral.400`      | `neutral.600`            | Inactive tabs, line numbers, separators, placeholders   |
| `border.default` | `neutral.200`      | `neutral.800`            | Standard 1px hairline                                   |
| `border.subtle`  | `neutral.100`      | `neutral.900`            | Very faint inner separators                             |
| `border.strong`  | `neutral.900`      | `neutral.50`             | Skip link, focus ring                                   |

Never use raw `neutral.*` for component styles — go through semantic.

## Spacing & density

- Page horizontal padding: `spacing.4` (16px) for TitleBar, Sidebar zones,
  DiffToolbar, StatusBar — establishes a vertical alignment column.
- Bar heights:
  - TitleBar: 40px
  - DiffToolbar: 40px
  - SidebarTabs: padding `spacing.2.5` 0 (≈ 34px tall)
  - StatusBar: 28px
- Pill / icon-button height: `sizes.control.sm` (26px) and 22px respectively.
- Code line-height: 1.55 (set on `--diffs-line-height` and SourceView root).

## Animation primitive: anchor-positioned indicator

Active-state indicators that need to slide between options use **CSS Anchor
Positioning** — no `framer-motion`, no JS measurement, no `useLayoutEffect`.

```css
.option[aria-selected='true'] {
  anchor-name: --my-anchor;
}
.indicator {
  position: absolute;
  left: anchor(--my-anchor left);
  right: anchor(--my-anchor right);
  transition:
    left 240ms cubic-bezier(0.2, 0, 0, 1),
    right 240ms cubic-bezier(0.2, 0, 0, 1);
}
```

For components that may render multiple instances on one page (`Pill`), the
component generates a unique anchor name from `useId()` and applies it via
inline `style.anchorName` / `style.positionAnchor`. See `Pill.tsx`.

Always include the no-op fallback so Firefox renders without animation:

```css
@supports not (anchor-name: --x) {
  display: none; /* indicator hidden — selected text contrast still conveys state */
}
```

## Component palette

### `TitleBar`

- 40px tall, `bg.canvas`, 1px `border-bottom`.
- Repo name: `fontSizes.md`, weight 600, `letter-spacing: -0.15px`.
- Branch: plain mono text (no chip), `${base} → ${head7}` with the arrow
  in `fg.dim`.
- Right-aligned summary: `N files` (sans) + monospace deltas cluster.
- Tabular numerals everywhere numeric.

### `SidebarTabs`

- Underline indicator slides via anchor positioning (1px, `fg.default`).
- Inactive tab: `fg.dim`; hover: `fg.muted`; active: `fg.default`.
- Count: mono `fontSizes.xs`, `fg.dim` → `fg.muted` when active. **No
  pill chip background.**
- Bottom hairline marks the seam from toolbar.

### `SidebarToolbar` (embedded variant)

- No background fill, no border-bottom.
- Filter: transparent input. Focus shows an inset bottom hairline only
  (`box-shadow: inset 0 -1px 0 fg.dim`). No box border, no accent ring.
- Tree/Flat toggle: text pair `Tree / Flat` separated by a `border.default`
  slash. No animation, no container — pure typography contrast.

### `FileTree`

Built on `@pierre/trees`. Uses pierre defaults intentionally — only fonts
and sizes are overridden via `--trees-*` custom properties. Decoration
deltas are split via `unsafeCSS` in `FileTree.tsx`.

### `DiffToolbar`

- 40px tall, `bg.canvas`, 1px `border-bottom`.
- Nav `↑` / `↓`: ghost icon buttons (transparent → `bg.wash` on hover,
  `fg.dim` → `fg.default`).
- Breadcrumb: mono `fontSizes.md`, path segments in `fg.dim` separated by
  `/` glyphs in `border.default`. Filename gets `fg.default` + weight 500.
- Pills (Diff/Source, Split/Unified): use the shared `Pill` component
  (sliding fill via anchor positioning).
- 1×14px hairline divider between pills and the copy/more action group.

### `DiffView`

- No wrapper card. Patches flow continuously, separated by a single
  `border-top: 1px solid border.default` between consecutive patches.
- Pierre handles internal rendering — we only wrap `<PatchDiff>`.

### `SourceView`

- No wrapper card, no margin. Fills the right pane.
- Row grid: 48px line# / 3px gutter / 1fr code.
- Line numbers in `fg.dim`, tabular, no opacity tricks.
- Gutter bar: 3px, `diff.add` / `diff.del` only on changed lines.
- Skip rows: inline left-aligned text `··· N lines hidden`. No dashed-border
  card. Drop-cap `···` rendered via `::before` in `border.default`.
- Font: `fontSizes.md` (14px) / 1.55 mono — same as `--diffs-font-size`,
  so source and diff read at one density.

### `StatusBar`

- 28px tall, `bg.canvas`, 1px `border-top`.
- Status letter: bare mono `fontSizes.xs` weight 700 in `colors.status.*`.
  Fixed 10px slot for column alignment. **No badge box.**
- Filename: mono `fontSizes.xs`, `fg.default`, ellipsis at 32ch.
- Deltas: monospace cluster, no `·` between add/del.
- Position: `N / M` mono `fg.dim`.
- Inter-group seams: 1×12px hairline divider.
- Kbd hints: `bg.wash` 3px-radius pill (no border), action word in
  `fg.dim`.

### `Pill`

- Container: 1px hairline border, `radii.sm`, padding 2px, height
  `sizes.control.sm` (26px).
- Buttons: transparent, `fg.dim` → `fg.default` on active.
- Indicator: `bg.hover` filled rectangle, anchored to the active button,
  240ms `cubic-bezier(0.2, 0, 0, 1)` on `left` / `right`.

## Pierre integration

`@pierre/diffs` and `@pierre/trees` render inside their own shadow DOMs.
We control their look only through their published CSS custom properties.

- **Fonts and sizes:** declared once at `:root` in `globalCss` (see
  Typography → Fonts above). Custom properties cross shadow boundaries
  via inheritance.
- **Colors (trees):** `themeToTreeStyles({ type, bg, fg })` is called in
  `FileTree.tsx` with the JS-runtime tokens from `theme/tokens.ts`. Use
  `bg.canvas` (not surface) so the tree blends with the immersive
  Sidebar.
- **Decoration deltas (trees):** `unsafeCSS` in `FileTree.tsx` injects
  selectors against `[data-item-section="decoration"]` to color and split
  the `+N −M` numerals. Pierre updates its own DOM, so we observe with a
  `MutationObserver` (see `observeDecorations`).
- **Themes (diffs):** pierre's diff uses
  `theme: { dark: 'github-dark-high-contrast', light: 'github-light-high-contrast' }`.
  Switch themes with care — they affect line colors directly.

We do **not** fork pierre or replace it with a custom tree/diff. Any visual
limitation that would require touching pierre's row markup is out of scope
and should be raised upstream.

## Anti-patterns

Don't:

- Use `bg.surface` for chrome. The whole UI is `bg.canvas`.
- Add `box-shadow` ornaments. We're flat.
- Use `accent.fg` (blue) for non-diff signaling.
- Use raw `neutral.*` in component styles.
- Hardcode `px` for font-size, padding, or color (apart from rgba opacity
  values).
- Introduce a third tier of font weight beyond what tokens express.
- Animate via `useLayoutEffect` + `getBoundingClientRect` when anchor
  positioning fits.
- Import a motion library — anchor positioning + CSS transitions cover the
  current needs.

## Migration checklist when adding a new chrome zone

1. Surface = `bg.canvas`. Seam = 1px `border.default`.
2. Padding horizontal = `spacing.4`.
3. Primary text uses `fontSizes.md`+; secondary uses `fontSizes.xs`.
4. Active states use foreground contrast first, then a hairline indicator.
   Color fills only for status semantics (diff add/del, file status).
5. If an indicator slides between options, use anchor positioning.
6. Run `pnpm typecheck` and `pnpm dev:mock` before considering done.
