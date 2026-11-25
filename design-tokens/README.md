# ai/Studio design tokens (v0.1)

First pass at shared design tokens for the new ai/Studio app, pulled from the
marketing landing page (`index.html`). The landing page is the only brand
source today, so anything it does not show is marked **GUESS** and should be
checked against real product designs.

| File | What it is |
| --- | --- |
| `tokens.css` | CSS custom properties: raw scales, role tokens, a guessed dark theme, aliases for the app shell |
| `tokens.json` | The same values in W3C design-token format (for Style Dictionary or a TS theme). Guessed values carry `"$extensions": { "guess": true }` |
| `components.css` | The patterns that repeat on the landing page, rebuilt on tokens (`as-` class prefix) |
| `preview.html` | Open in a browser to see every token and component |

## Usage

```css
@import './design-tokens/tokens.css';
@import './design-tokens/components.css'; /* optional */
```

Components should use **role tokens** (`--color-text`, `--color-surface`,
`--color-accent`, …) rather than raw scales, so the dark theme
(`<html data-theme="dark">`) works without changes.

The app shell (Vite + React + TS, plain CSS) uses `--color-primary`,
`--font-heading` and `--font-body`; those names are provided as aliases.

## What came from the landing page

- **Fonts.** Readex Pro (300–700) for headings, logo, tabs and step titles.
  Oxygen (300/400/700) for body, buttons and UI text.
- **Brand colour.** `#5046e5` is the only brand hue (≈111 uses), with
  `#4338ca` for hover and three translucent tints (4%, 8%, 15%) for surfaces,
  badges and icon tiles.
- **Neutrals.** Twelve greys from `#fafafa` to `#000`. `#f0f0f0` is the
  default border; `#555` secondary text; `#333` body; `#1a1a1a` headings.
- **Status.** Blue `#0d6efd`, green `#28a745` and red `#e53e3e`, all used as
  accents. Blue and green have light backgrounds on the page.
- **Human-in-the-loop roles.** The page's story is "AI proposes, human
  refines, outcome lands", shown as callouts with a 3px left rule:
  AI = brand purple, human = blue, outcome = green. These became
  `--color-ai`, `--color-human` and `--color-outcome`, which should map well to
  agent runs, review steps and artefacts in the app.
- **Shape and depth.** Radii 4 / 6 / 8px plus pills; very soft shadows
  (all at 5% black); cards lift 2–5px on hover over 0.2–0.3s.
- **Layout.** 1200px container (1000px in some sections), 20px gutter, 80px
  section padding, a single 768px breakpoint.

**Recurring components:** logo, buttons (primary, secondary, ghost, black
pill), approach badge, overline, certification chip, card (feature, value,
industry, example with tinted header), icon tile, conversation callouts
(prompt, AI, human, outcome), step flow / timeline, tabs (underline on
desktop, pill on mobile), metric bar, check list, divided list, section
heading, sticky header with nav links, round icon button.

## Guesses and judgement calls

| Token | Why it is a guess |
| --- | --- |
| `--color-brand-700` `#3730a3` | No pressed state on the page; next step of the same indigo ramp |
| `--color-warning-*` | No warning colour on the page; amber picked to sit with the existing blue/green/red |
| `--color-danger-50` | Red is only an icon colour on the page |
| `--color-focus-ring` | The page has no focus styles |
| `--font-mono` | No code on the page; system mono stack |
| Dark theme | The page is light only; derived by hand, not tested for contrast |
| `--header-height`, z-index overlay/toast | Not on the page |
| Button weight 700 | The page sets 500 on Oxygen buttons, but Oxygen has no 500, so browsers render 400. 700 used instead; switch to 400 if the lighter look was intended |
| `--color-gray-900` `#1a1a1a` | The page mixes `#1a1a1a` and `#111` for headings; unified on `#1a1a1a` |
| `--space-7` = 30px | The page uses 30px for card padding and grid gaps, so the scale keeps it instead of 28/32 |
| `--radius-pill` | The page uses 20px and 50px for the same pill shape |
| Disabled button style | Not on the page |

## Inconsistencies spotted in `index.html`

- Several `<style>` blocks redefine global `h2`, `h3`, `.container` and
  `.btn`, so later sections silently restyle earlier ones (for example the
  last `.container` wins at 1200px, `h3` ends up 18px / 500).
- Fonts are loaded four times (one `<link>` plus three `@import`s).
- Secondary text appears as `#555`, `#666` and `#777`; only `#555` and `#777`
  were kept.
