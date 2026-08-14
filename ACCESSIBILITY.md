# Accessibility audit

**Audited:** 8 August 2026 · **Standard:** WCAG 2.1 AA (plus axe "best-practice" rules)
**Tool:** axe-core 4.13.0 driven by headless Chromium
**Scope:** all 23 pages × 2 viewports (1440×900 desktop, 390×844 mobile) = 46 runs

## Result

| | Before | After |
|---|---:|---:|
| Distinct rule violations | 4 | **0** |
| Failing nodes | 492 | **0** |
| Needing manual review | 25 | 37 *(all verified by hand — see below)* |

**Re-run on 8 August 2026** after six parish-authored sections were added to the
Visit page. One new violation appeared and was fixed (below); the manual-review
count rose from 25 to 37 because that page now carries four video embeds and a
scrolling row of portraits. Still **0 violations, and every page passing reflow.**

**Re-checked 9 August 2026.** `npm run audit:reflow` now reports **17 of 17
passing** at 320px, and axe still reports 0 violations across 32 page-runs. The
"12 of 16" above is the 8 August state, kept as the record of it — CLAUDE.md's
"Expected clean state" has said 16/16 for a while, so this line read as a
regression that was not one.

**Re-checked 10 August 2026**, after the photograph heroes were collapsed onto
one component and again after Get Involved was added. Still **0 violations
across 36 page-runs.** Two counts moved and neither is a regression:

- Reflow was **18 of 18**. The Mobile views mock-up page was retired once the
  site itself used the mobile layout, taking the count to 16 of 16; the Welcome
  page brought it back to seventeen, and Get Involved made eighteen.
- The manual-review count was **164 nodes**, not 37. That number tracks how
  much of a page axe can resolve, not how much is wrong: it rises when a
  gradient, a placeholder frame or a carousel puts text somewhere axe declines to
  judge. Every one of the 164 was accounted for below, from the twelve heroes
  that stood at the time.

**Re-checked again 13 August 2026**, after Traditions was added (its own hero
included) and the Get Involved rename settled. Reflow is **19 of 19**. Still
**0 violations**, now across **38 page-runs**; the manual-review count is now
**186 nodes across 27 of the 38 page-runs** (`npm run audit:a11y`). The
breakdown below is the 10 August split of the 164 and has not been re-run
against that growth — see the note at "The 164 'needs review' items". The
thirteen heroes are now measured by a tool rather than by hand.

**Re-run 13 August 2026, later the same day**, after `catechumens.html` was
added. **0 violations across 40 page-runs**, reflow **20 of 20** at 320px, and
**2,508 focus stops checked with 0 missing a focus indicator**. The
manual-review count reads **138 nodes across 29 of the 40 page-runs** — lower
than the 186 above because axe reports colour-contrast "incomplete" per node
rendered over a photograph, and the run happened to resolve more of them, not
because anything was fixed. It is still the same unresolved class of item, and
the breakdown below still has not been re-split.

The new page found one real violation on the way in, now fixed: the two links
in the patron-saint section's lede were `link-in-text-block` failures —
distinguishable only by colour, at 1.24:1 against the surrounding text —
because `.ntgoc-stage__lede` was not in the running-text link rule at the top of
`components.css`. It is now. Any new container that holds a link inside a
sentence needs adding there; nothing else catches it.

**Re-run again 13 August 2026**, after the resource register and the three
document pages were added. **0 violations across 46 page-runs**, reflow **23 of
23** at 320px, **2,809 focus stops with 0 missing a focus indicator**. The
manual-review count is unchanged at **138 nodes across 29 page-runs** — the new
pages carry no photograph behind text, which is the only thing generating it.

The document pages introduced the first `@media print` block in this project,
which no automated check here can see: axe and the reflow audit both read the
screen stylesheet. It was checked by rendering the pages with print media
emulated. Two things about it are accessibility decisions rather than styling
ones. The masthead that appears only in print is `aria-hidden="true"`, because
on screen it would repeat the page's own `<h1>` to a screen reader for no
reason. And the draft-preview banner deliberately survives printing, in a
quieter form: a sheet headed with the parish's name and *Adult Baptism &amp;
Chrismation checklist* would otherwise read as an official parish document the
moment it left the printer.

Reproduce it yourself:

```sh
npm install          # axe-core + puppeteer-core, dev only
npm run audit:a11y   # 23 pages x 2 viewports
npm run audit:reflow # WCAG 1.4.10 at 320px + focus-indicator check
npm run measure:hero # the thirteen photograph heroes, which axe declines to judge
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
- **Content outside landmarks** (`region`, every page): the top bar sat
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

### The 164 "needs review" items

One rule is flagged for review: `color-contrast`, 164 nodes across 25 of the 36
page-runs, as of the 10 August recheck. axe defers whenever it cannot resolve
what is behind the text. For 148 of these nodes the reason it gives is a
background gradient; for the other 16 it is that the element is partly out of
view. None is a violation. All three groups are accounted for below, as they
stood on 10 August.

**Traditions and Get Involved's current shape have since pushed the total to
186 nodes across 27 of the 38 page-runs** (`npm run audit:a11y`, 13 August
2026). The breakdown has not been re-split by reason since — doing that
accurately needs the per-node detail the audit script does not currently
record, not just a rerun. Treat the 164/148/16/74/74/16 figures below as the
10 August record, not the current total.

#### Contrast over a background image — 74 nodes

These are the twelve photograph heroes: the eyebrow, the headline, the lede, the
outlined hero button on the three pages that carry one, on Parish Life a second
serif lede, and on Welcome a gold italic opening line of its own. axe has no way
to know what colour is under the glyphs, so it declines to judge them.

**How they are measured.** `npm run measure:hero` samples the brightest pixel
actually rendered behind each **glyph run** — not behind the element box. That
distinction matters: an eyebrow is a full-width block whose box runs a thousand
pixels past the text, across the brightest part of the photograph, where no
glyph is ever painted. `npm run measure:hero -- --box` does it the wrong way on
purpose, for comparison. Run against the heroes as they stood before this work,
the box method invented failures on six pages at 2.82–3.44:1 while every string
on them was comfortably legible; run against the present scrim it invents one,
the Festival eyebrow at 4.28:1. The glyph numbers must always be the better of
the two.

The tool is deliberately **not** part of `npm run check`. It needs a browser,
real fonts and the photographs, and its numbers want a human judgement about
what to trade — a darker scrim, a lighter gold, a different crop. It still exits
non-zero on a failure, so it can be used as a gate when someone means to.

**Every hero string has a selector here, and that is the point.** The tool
measures what it is told to measure, so a hero string no selector names is a
string nothing checks — which is the failure mode the tool exists to prevent.
Welcome sets its opening line, "We're so glad you came.", in its own
`.ntgoc-welcome-hero__lede` rather than the component's classes. It is gold on
the photograph like every eyebrow here, and until the Welcome page was merged
nothing measured it. It is now the fifth selector in the list. Anyone adding a
hero string in a class of its own should add it there too.

**Where they stand.** All thirteen heroes are one component now: one scrim, the
photograph at full strength, two heights, the text aligned to the bottom.
Headlines are held to 3:1, being large text at both viewports; everything else
to 4.5:1. Measured 13 August 2026 (after the Get Involved rename and the
Traditions hero were added to `HERO_PAGES`), 74 strings, all passing:

| Page | Viewport | Eyebrow (4.5) | Headline (3) | Lede (4.5) | Second lede (4.5) † |
|---|---|---:|---:|---:|---:|
| Home | desktop | 6.78:1 | 11.32:1 | 9.74:1 | — |
| Home | mobile | 5.71:1 | 9.83:1 | 9.38:1 | — |
| Parish Life | desktop | 7.57:1 | 11.69:1 | 9.74:1 | 7.51:1 |
| Parish Life | mobile | 7.13:1 | 10.26:1 | 8.97:1 | 7.85:1 |
| Get Involved | desktop | 7.29:1 | 10.47:1 | 7.30:1 | — |
| Get Involved | mobile | 7.56:1 | 11.91:1 | 7.12:1 | — |
| Our Faith | desktop | 7.79:1 | 11.23:1 | — | — |
| Our Faith | mobile | 7.76:1 | 10.37:1 | — | — |
| Calendar | desktop | 7.77:1 | 12.23:1 | — | — |
| Calendar | mobile | 6.63:1 | 12.44:1 | — | — |
| About | desktop | 7.77:1 | 10.16:1 | — | — |
| About | mobile | 7.09:1 | 10.37:1 | — | — |
| Events | desktop | 7.98:1 | 12.55:1 | 10.33:1 | — |
| Events | mobile | 6.90:1 | 11.01:1 | 9.14:1 | — |
| Contact | desktop | 7.95:1 | 12.05:1 | — | — |
| Contact | mobile | 7.68:1 | 12.44:1 | — | — |
| Plan a visit | desktop | 7.66:1 | 8.85:1 | 7.59:1 | — |
| Plan a visit | mobile | 7.38:1 | 9.80:1 | 8.15:1 | — |
| Festival | desktop | 8.51:1 | 8.00:1 | 9.00:1 | — |
| Festival | mobile | 6.14:1 | 10.76:1 | 9.37:1 | — |
| For Our Parish | desktop | 7.53:1 | 11.70:1 | 9.05:1 | — |
| For Our Parish | mobile | 6.57:1 | 10.67:1 | 8.66:1 | — |
| Welcome | desktop | 7.76:1 | 11.14:1 | 9.84:1 | 7.57:1 |
| Welcome | mobile | 6.75:1 | 9.99:1 | 9.71:1 | 7.27:1 |
| Traditions | desktop | 7.66:1 | 11.42:1 | 9.45:1 | — |
| Traditions | mobile | 7.25:1 | 10.68:1 | 10.03:1 | — |

† Two different strings share that column, because only two pages carry a second
line in the hero and a column each would leave twenty rows of dashes. On Parish
Life it is `.ntgoc-page-hero__lede--serif`; on Welcome it is the gold italic
`.ntgoc-welcome-hero__lede`. Both are held to 4.5:1 and both are reported by
`npm run measure:hero` under their own names, `lede--serif` and `welcome-lede`.

The closest of the 74 is the home eyebrow on mobile, at 5.71:1 against 4.5. The
outlined hero buttons on Home, Plan a visit and Get Involved are not in the
table because the tool does not track them — they are three buttons, and so six
of the 74 nodes axe defers on. Measured the same way they are 11.39:1 at worst.

**Below 900px the scrim is re-weighted, and the reason is geometry rather than
taste.** The stops in `linear-gradient(75deg, …)` are percentages along the
gradient line, and that line's length is W·sin75 + H·cos75 — it depends on the
box's proportions, not on where the words are. On the 1440×560 home hero the
line is 1536px long and the lede occupies 12–53% of it, under the dense end.
Narrow the same hero to 390px and the line is only 506px while the text still
runs nearly the full width: the identical words now span 13–84% of it, out in
the light end. Narrowing the viewport drags the text *into* the bright part of
the scrim, which is the opposite of what the stops read as. So below 900px the
horizontal pass becomes `to right` rather than an angle. On a horizontal
gradient the line is exactly the box width, so a stop percentage means the same
fraction of the text column at every viewport and cannot rotate out from under
the words again. The foot gradient is unchanged.

**900px rather than 640px, and that was measured.** The heroes keep the desktop
40px gutter and desktop type down to 641px, so at 720px the Plan a visit lede
reaches 88% along an 822px gradient line — further into the light end than 390px
ever manages. Sampled at 720px and 899px against the old scrim, three lede
measurements failed there: Home at 899px (4.25:1), and Plan a visit at both
720px (4.06:1) and 899px (4.13:1). That band is the worst case, not the
narrowest one. `npm run measure:hero` samples 390 and 1440 only, so nothing
would have caught it.

That band was re-sampled again on 10 August 2026, after the Welcome page and then
Get Involved were merged, so the figure covers all twelve heroes rather than
the ten it was first taken from: **all 68 strings pass, the closest at 6.44:1** —
the home eyebrow at 720px, the same string and the same number through all three
re-samples. Get Involved's own worst is its eyebrow at 899px, 7.17:1. It
inherits the component untouched, which is the point of there being a component:
a new page gets the measured scrim rather than a fresh guess. The tool takes no viewport
argument, so the re-sample is done by copying it outside the repo and changing
the two entries in `VIEWPORTS` to 720 and 899. Nothing else about it changes,
and the copy is thrown away afterwards; keeping a second viewport list in the
tool would imply CI samples that band, and it does not.

**Mobile had never been measured before this.** The table above used to be
desktop-only. Measured at the point this work started, **three strings were
already failing** and had been for as long as the mobile layout has existed —
the ledes on Parish Life (3.68:1), Plan a visit (3.76:1) and For Our Parish
(4.47:1), all at 390px. Nothing could see them: axe declines to judge text over
a background image, so `npm run audit:a11y` reported 0 violations throughout.

**Then this branch broke five more before fixing all eight.** Collapsing the
heroes onto one component dropped the photograph dimming that two of them relied
on — the home hero at 42% opacity and the Festival hero at 45% — and the shared
scrim alone was not a substitute at 390px. The home eyebrow fell to **1.47:1**
and the Festival eyebrow to 2.68:1; the home and Festival ledes fell with them;
and the Events lede, already at 4.72:1 with 0.22 to spare, tipped to 3.56:1
under the slightly lighter scrim. All 27 desktop strings of the ten heroes then
in place passed throughout, which is exactly why a desktop-only table was not
enough. The re-weighted mobile scrim fixed all eight — the five this work broke
and the three that predated it.

**The paragraph this replaces called it.** It read: *"This is why the home hero
keeps its 42% opacity … matching that page's treatment as well — the image at
full strength — was measured and drops the gold eyebrow to 4.32:1 … If the two
heroes are ever made identical, the eyebrow needs a darker scrim or a lighter
gold, and the number above has to be re-measured."* The two heroes have now been
made identical and the eyebrow has been re-measured. On desktop it came out
better than predicted, at 6.78:1, because the shared component brought Parish
Life's second gradient and its lower, bottom-aligned text along with the
full-strength photograph, not the photograph alone. At 390px — which that
paragraph had no way to check, since nothing measured mobile then — the same
eyebrow fell to 1.47:1. The remedy was the first of the two it named: a darker
scrim, below 900px only, so the gold is unchanged everywhere.

#### Placeholder photo frames — 74 nodes

The empty frames on the Parish Life page, and the four on Get Involved, each
carry a label ("Photograph to come") and a hint naming what belongs there ("Holy
Week", "Coffee hour in the parish hall"), over a placeholder fill: `#efe7d9` with
a 10%-opacity gold stripe ruled across it at 135°. axe sees the stripe as a
gradient and defers.

Measured behind the glyphs, the label is 4.33:1 at worst and the hint 4.31:1.
Against `#efe7d9` alone both clear the bar — 4.78:1 and 4.75:1 — and it is the
stripe crossing a letter that pulls them under it. **This is a real shortfall,
not a false alarm**, but it is confined to placeholder furniture: every one of
these frames is waiting to be replaced by a photograph, at which point the
label, the hint and the stripe all go. Worth closing while the frames are still
here — a slightly darker hint colour, or a fainter stripe, is enough.

#### Copies that are scrolled out of view — 16 nodes

Eight on the home page: the four strings on the banquet slide, which is the
second slide of the promo carousel and so sits off to the side at both
viewports. Seven on the Visit page: the text on greeter cards two, three and
four, which at 390px are the cards past the edge of the scrolling row. One on
the Bookstore page, at 390px: a category label on a reading-list cover past the
edge of its row. In all three cases the pixels are never painted, so axe reports
the nodes as partly obscured.
Their visible siblings — the same classes, the same colours, the same
backgrounds, one slide or one card along — axe resolves without complaint and
passes. There is nothing different about the ones it cannot see.

#### One calendar entry — no longer appears

Earlier runs reported one more obscured node: a single event chip on the August
grid, `#5e1f1f` on `#f2e5dd`, which axe said was partly covered by another
element. It was measured at the time and came out at 11.03:1. Today's run does
not report it: the chip is still on the page, and axe now resolves it without
deferring. That is why the obscured count is 15 rather than 16. If it returns,
the measurement above still stands and the answer is unchanged.

#### `frame-tested` no longer appears

The 8 August run reported 8 of these — axe cannot audit inside a cross-origin
iframe, so it said it could not test the four YouTube embeds at either viewport.
Today's run does not report the rule at all, on the same four embeds. If it
returns, the answer is unchanged: it is a statement about YouTube's player, not
about this site, and what *is* ours is set — every embed carries a `title`
naming the episode and the presenter. If DIM refuses third-party embeds at
import (see `IMPORT.md`), the frames become plain links and the question
disappears.

### Reflow — WCAG 1.4.10

At a 320px viewport, no page scrolls horizontally. **23 of 23 pass**, Welcome,
Get Involved, Traditions, the catechumen page and its three document pages
included.

The Mobile views reference page initially failed (406px wide) because it drew
phone frames at their true 375px width. Rather than shrink the mock-ups — which
would have defeated their purpose — the frames were given their own scroll
container with `tabindex="0"` and a label, so it was reachable by keyboard and
the page body never scrolled sideways. That page has since been retired, which
took the count to 16 of 16; the Welcome page then took it back to 17, Get
Involved to 18, Traditions to 19, the catechumen page to 20, and its three
document pages to 23.

### Keyboard

67 focusable elements on the contact page. The check reports **17 without a
visible focus indicator**, and all 17 are the links inside the mobile navigation
drawer. The drawer is a closed `<details>` at the 1440px width the check runs
at, so `el.focus()` does nothing, no `:focus-visible` rule can match, and the
check counts them as bare. Opened at 390px they take the same 3px gold outline
at 2px offset as everything else. The other 50 pass where they stand.

The bookstore category filters were
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
