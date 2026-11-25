# ⦃param⦄ ai/Studio design tokens (v0.2)

Shared tokens for the new ai/Studio app.

- **Colours and type** come from the paramai.studio design language, which is the current brand.
- **Layout and component feel** follow Claude web: a warm paper canvas, a left sidebar, one centred conversation column, a large rounded composer, and a side panel for artefacts and receipts.

v0.1 took its values from the old landing page (`index.html`: `#5046e5`, Readex Pro, Oxygen). That version was dropped because it doesn't match the current brand.

| File | What it is |
| --- | --- |
| `tokens.css` | CSS custom properties: the raw brand palette, semantic and role tokens, a dark theme built from the brand's console palette, and the layout sizes |
| `tokens.json` | The same values in W3C design-token format. Guessed values carry `"$extensions": { "guess": true }` |
| `components.css` | App parts (`as-` prefix): app frame, sidebar, conversation, composer, buttons, chips, status dots, run steps, cards, attachment, design/run zones, console receipt panel, side panel, menu |
| `preview.html` | Open it locally to see a mock app screen and the token sheet. Add `#dark` to the URL for the dark theme |

## Source

The brand values come from the paramai.studio visual-language reference, the same tokens used for ⦃param⦄ figures and posts. paramai.studio itself couldn't be fetched from the build environment, so these values haven't been checked against the live site's CSS yet.

## The brand rules the tokens encode

- **Colour is semantic, never decoration.**
  - Green means deterministic, governed or settled.
  - Clay marks where the model enters and where attention is needed. It is also the brand mark.
  - Grey is neutral.
  - Purple is used only for LLM chain-of-thought.

  In the app this becomes `--color-governed`, `--color-model`, `--color-reasoning` and `--color-document`. Run steps, receipts and status dots use them consistently.
- **Use clay sparingly.** It goes on the "ai/Studio" lockup, the composer send button and the one thing on screen that needs attention. Primary buttons are ink on paper, as in Claude web.
- **Paper for the argument, console for real output.** The dark console panel (radius 18, 44px title bar, mono rows) is for receipts, traces and code.
- **Type.** Bricolage Grotesque 600 at −0.03em for display. Geist Light for body and Geist Medium for emphasis. Geist Mono for labels, ids, numbers and receipts.
- **The ⦃ ⦄ glyphs** are missing from Bricolage and Geist. Wrap them in `.as-glyph`, which falls back to DejaVu Sans, or write `{ param }` in mono.
- **Zones.** `zone-design` and `zone-run` tint design-time and run-time areas. This supports merging the developer and enterprise-user views into one window.

## Guesses

| Token | Why it is a guess |
| --- | --- |
| App type scale (11–36px) | The brand gives faces and weights, not UI sizes. Sized like Claude web |
| Sidebar colour (`paper-3`) | Not in the brand. One step darker than the canvas, as in Claude web |
| Hover/active overlays, `surface-raised` | Not in the brand |
| Radii 6 and 8px | The brand only defines cards (12–14) and console panels (18) |
| Shadow values | The brand says "soft shadow" without a value |
| `--color-danger` `#a8321e` | The brand has no error red. This is a darker clay so it reads as related |
| Focus ring and selection (clay at low alpha) | Not in the brand |
| Dark theme sidebar, zones and console step | Derived from the console palette. Contrast not yet checked |
| Sidebar, side panel and top bar sizes, motion timings | Claude web proportions, measured by eye |
| Send button in clay | Matches Claude web and the "one clay action" rule. Could be ink if clay should stay purely semantic |
