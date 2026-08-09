# Accessibility audit

**Audited:** 8 August 2026 · **Standard:** WCAG 2.1 AA (plus axe "best-practice" rules)
**Tool:** axe-core 4.13.0 driven by headless Chromium
**Scope:** all 16 pages × 2 viewports (1440×900 desktop, 390×844 mobile) = 24 runs

## Result

| | Before | After |
|---|---:|---:|
| Distinct rule violations | 4 | **0** |
| Failing nodes | 492 | **0** |
| Needing manual review | 25 | 37 *(all verified by hand — see below)* |

**Re-run on 8 August 2026** after six parish-authored sections were added to the
Visit page. One new violation appeared and was fixed (below); the manual-review
count rose from 25 to 37 because that page now carries four video embeds and a
scrolling row of portraits. Still **0 violations, 12 of 16 pages passing reflow.**

Reproduce it yourself:

```sh
npm install          # axe-core + puppeteer-core, dev only
npm run audit:a11y   # 16 pages x 2 viewports
npm run audit:reflow # WCAG 1.4.10 at 320px + focus-indicator check
```

The **site itself has no dependencies.** These two packages are for auditing only
and are never referenced by any page or any exported chunk.

---

## What was found, and what changed

### 1. Contrast — 464 nodes, serious

Six of the design's muted text colours fell below the 4.5:1 minimum for
body-size text, some badly:

| Colour | Role | Worst measured | Now |
|---|---|---:|---:|
| `#a89b88` | faintest captions | 2.14:1 | 4.61:1 |
| `#a0968a` | faint captions | 2.29:1 | 4.60:1 |
| `#a08a6a` | warm grey labels | 2.61:1 | 4.62:1 |
| `#b08442` | gold eyebrow labels | 2.65:1 | 4.62:1 |
| `#8a7f70` | grey-brown subtitles | 3.09:1 | 4.61:1 |
| `#957d71` | on dark oxblood | 4.22:1 | 4.60:1 *(lightened)* |

**This is a deviation from the design, and it was a deliberate one.** The brief
says the design file wins; it also sets adequate contrast as a non-negotiable
accessibility floor. Where those collide the floor wins, but the change is kept
to the minimum that satisfies it:

- **Hue and saturation are untouched.** Only lightness moves, by the smallest
  step that reaches 4.6:1 against the worst background each colour actually
  appears on. The palette still reads as the design's.
- **Only text is affected.** Borders, outlines and backgrounds keep the original
  values, so the gold `#b08442` survives everywhere it is decoration.
- **Large text keeps the original colour.** Text ≥24px (or ≥18.66px bold) needs
  only 3:1 and already passed, so it was left alone.

The corrected values are baked into `assets/css/components.css`. The original
`CONTRAST_FIX` map, with the before/after ratio per colour, is preserved in
`tools/archive/render.mjs` for reference.

One further case had no colour to fix: the footer column headings
("Visit", "Parish", "Support the parish") are 10.5px uppercase at `opacity:.55`,
which renders inherited light text as `#957d71` on `#3a1414` — 4.22:1. Raising
the opacity to `.59` gives 4.67:1, a change of 0.04. Handled as an exact
declaration match (`DECLARATION_FIX`) so it cannot leak to other elements.

### 2. Links promoted to anchors lost their colour — serious

The renderer converts the design's clickable `<span>`/`<div>` into real `<a>`
for keyboard access. Those elements never had a colour of their own — they
inherited a light one from the dark top bar and footer. As anchors they instead
picked up the ambient bare-element link colour:

| | Before | After |
|---|---:|---:|
| Top-bar links on `#3a1414` | **1.60:1** | 8.73:1 |
| Footer links on `#3a1414` | **1.75:1** | 11.02:1 |

They were effectively invisible until hovered. Fixed with
`.ntgoc-inherit { color: inherit }` on converted anchors, at single-class
specificity and placed before the generated rules, so links that *do* declare
their own colour still win and `:hover` always wins.

This ships in `components.css` rather than the demo-only stylesheet, because
Bootstrap sets its own anchor colour and the same bug would reappear in EVO.

### 3. The contact form was a drawing — not caught by any automated tool

The "Send a message" form was empty `<div>`s styled to look like inputs, with a
`<div>` that said Send. **No automated audit can flag this** — there were no
form controls present to fail. For anyone using a keyboard or a screen reader
the form simply did not exist: nothing focusable, nothing labelled, no button.

Rebuilt with a real `<form>`, four `<label for>` / control pairs, a `<select>`
with sensible options, and a real `<button type="submit">` — reusing the
design's own inline styles, so it looks identical.

It has no backend. Rather than fake it, the form states plainly that it is not
connected and offers a real `mailto:` and `tel:` fallback. **Wiring it up is a
task for the EVO import** — noted in `IMPORT.md`.

### 4. Smaller fixes

- **Unlabelled link** (`link-name`): the building-projects tile on the Giving
  page is an image-only link with no text — an unlabelled tab stop and a dead
  end for screen readers. Given an `aria-label`.
- **Links in running text** (`link-in-text-block`): the design removes all
  underlines, leaving colour as the only signal a word is a link — measured at
  1.24:1 against surrounding text. Underlined in body copy only
  (`.ntgoc-body`, `.ntgoc-body-lg`, `.ntgoc-linked-text`); standalone navigation
  links keep the design's clean look.
- **Content outside landmarks** (`region`, all 16 pages): the top bar sat
  outside every landmark, so landmark navigation skipped it. Wrapped in
  `<nav aria-label="Secondary">`.
- **Heading hierarchy**: the design picked heading levels by visual size rather
  than rank, so several pages jumped `h1 → h3`. Re-ranked so no page skips a
  level. Because styling is class-based, this changed the document outline and
  nothing visual.

### 5. Found by the re-run — the greeter row could not be scrolled by keyboard

`scrollable-region-focusable`, serious, one node. Below 640px the "Faces You
Might See" portraits become a horizontal scroller. Nothing inside it is
focusable — they are photographs and names, not links — so a keyboard user
could reach the first card and no further; the rest of the greeters were
simply unreachable without a mouse or a touchscreen.

Fixed the same way the Mobile views frames were: the row takes `tabindex="0"`,
`role="group"` and a name of its own, so it is one tab stop that arrow keys can
scroll. At desktop width it is a plain four-column grid and the tab stop is
harmless.

---

## Verified by hand

### The 95 "needs review" items

**Contrast over a background image.** axe cannot compute contrast for text over
an image, so it defers. Most of these are the gold `#e0b673` eyebrow labels over
the hero images. Measured by sampling the brightest pixel actually rendered
behind each label and computing the ratio against it:

| Hero | Ratio | Needs |
|---|---:|---:|
| Home — nave photograph at 42% under the gradient | **6.62:1** | 4.5 |
| Parish Life — same photograph at full strength under its two-layer scrim | **5.07:1** | 4.5 |
| Over solid oxblood, no image | 8.61:1 | 4.5 |

The home hero's headline (11.07:1) and lede (10.52:1) are far clear of their
thresholds.

**This is why the home hero keeps its 42% opacity.** The photograph was changed
to match Parish Life's; matching that page's *treatment* as well — the image at
full strength — was measured and drops the gold eyebrow to **4.32:1**, under
the 4.5 minimum for text that size. Parish Life gets away with full strength
because its scrim has a second bottom gradient and its eyebrow sits lower. If
the two heroes are ever made identical, the eyebrow needs a darker scrim or a
lighter gold, and the number above has to be re-measured.

**4 more: the greeter names, mobile viewport only.** axe defers on the cards
that sit outside the 390px viewport in the scrolling row. The text is the
greeter's first name, `#3a1414` on `#f6f1e8` — **14.47:1**, the highest-contrast
pairing on the site. Nothing to fix.

**8: `frame-tested`, the YouTube embeds.** axe cannot audit inside a
cross-origin iframe, so it reports that it could not test them (4 videos × 2
viewports). This is a statement about YouTube's player, not about this site, and
nothing here can change it. What *is* ours — the frame's accessible name — is
set: every embed carries a `title` naming the episode and the presenter. If DIM
refuses third-party embeds at import (see `IMPORT.md`), the frames become plain
links and this disappears.

### Reflow — WCAG 1.4.10

At a 320px viewport, no page scrolls horizontally. **12 of 12 pass.**

The Mobile views reference page initially failed (406px wide) because it draws
phone frames at their true 375px width. Rather than shrink the mock-ups — which
would defeat their purpose — the frames were given their own scroll container
with `tabindex="0"` and a label, so it is reachable by keyboard and the page
body never scrolls sideways.

### Keyboard

36 focusable elements on the contact page; **0 without a visible focus
indicator** (3px gold outline, 2px offset). The bookstore category filters were
`<div>`s in the design and are now real `<button>`s with `aria-pressed`, so the
filter is fully keyboard-operable — it was not before.

---

## Known limitations

Automated tools catch roughly a third of WCAG issues. These need a human, ideally
a screen-reader user, and have **not** been done:

- Testing with an actual screen reader (NVDA / JAWS / VoiceOver).
- Whether the copy itself is understandable — reading level, unexplained
  liturgical vocabulary. The Visit page explains *Orthros*, *antidoron* and
  *Agape Meal* in passing, which is good practice, but this has not been tested
  with anyone unfamiliar with Orthodox worship.
- Whether link text makes sense out of context.
- Colour-blindness simulation across the palette.
- Text spacing overrides (WCAG 1.4.12).
- 200% zoom on a real device, as opposed to a scripted viewport.

**One caveat about the import.** This audit covers the demo site. Once these
chunks are pasted into Evolution CMS they sit inside the existing Bootstrap
4.1.3 template, which brings its own colours, focus styles and heading rules.
**The audit must be re-run against the real site after import** — passing here
does not guarantee passing there.
