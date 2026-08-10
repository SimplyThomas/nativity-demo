# Hero Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the four different photograph-hero implementations into one `.ntgoc-page-hero` component with a single `--tall` modifier, so all ten hero pages share Parish Life's gradient, one pair of heights, and one alignment.

**Architecture:** `.ntgoc-page-hero` already exists and is used by seven pages. It grows a `__body` measure wrapper, a `--tall` modifier, Parish Life's two-layer scrim, and bottom alignment. The three bespoke heroes (index, parish-life, festival) are rewritten onto it one page per task, each task deleting the CSS it just orphaned so no commit leaves the two halves out of step. Contrast is then re-measured and `ACCESSIBILITY.md` rewritten.

**Tech Stack:** Hand-written HTML and CSS. Verification is `npm run lint`, `npm run check` (lint + snapshot + axe + reflow) and `npm run snap`. There is no unit-test framework — the lint and audit tools are the tests, and every task runs them.

**Spec:** `docs/superpowers/specs/2026-08-09-hero-consistency-design.md`

---

## Before you start

Read `CLAUDE.md`. The rules that bite in this plan:

- **The sixteen root `.html` files are SOURCE.** Edit them directly. Never run `tools/archive/render.mjs`.
- **Never write `[[ ]]`, `[! !]`, `{{ }}`, `[* *]`, `[( )]`, `[~ ~]`, `[+ +]`** anywhere in content. Evolution CMS eats the surrounding markup.
- **Class names are `ntgoc-<block>[__<element>][--<modifier>]`**, all lowercase kebab-case. Lint enforces it.
- **Reusable blocks stay inside their `<!-- CHUNK:ntgocName -->` … `<!-- /CHUNK:ntgocName -->` wrappers.** Every hero already has one. Do not rename, move or remove a wrapper — edit only what is between them.
- **`git checkout -- '*.html'` reverts markup but not `components.css`.** If you need to undo, undo both.
- **Do not edit `dist/chunks/`.** It is generated.

Do not change any copy. The `<!-- TODO: verify -->` marker inside the Festival
headline must survive verbatim.

`npm install` must have completed — the audits need it. `npm run lint` needs
nothing.

**Known-good baseline:** `npm run lint` passes with exactly one warning, that
`ntgoc-about-clergy-shell` and `ntgoc-contact-card-shell` are equivalent. That
warning is pre-existing and unrelated. Do not fix it and do not treat it as a
regression.

---

## File structure

| File | Responsibility | Tasks that touch it |
|---|---|---|
| `assets/css/components.css` | The component, and deletion of the four families it replaces | 1–6 |
| `index.html` | Home hero markup | 1, 3 |
| `parish-life.html` | Parish Life hero markup | 4 |
| `festival.html` | Festival hero markup | 5 |
| `visit.html` | Hero buttons; `__body` wrapper | 1, 2 |
| `about.html`, `calendar.html`, `contact.html`, `events.html`, `faith.html`, `for-our-parish.html` | `__body` wrapper | 2 |
| `tools/measure-hero-contrast.mjs` | New. Re-measures every hero string against the pixels behind its glyphs | 7 |
| `package.json` | One new script, `measure:hero` | 7 |
| `ACCESSIBILITY.md` | The contrast table and the 42%-opacity paragraph | 8 |
| `dist/chunks/`, `tests/layout-baseline.json` | Generated. Regenerated once at the end | 9 |

---

### Task 1: Rename the hero buttons

`.ntgoc-home-hero-small-bold` and `.ntgoc-home-hero-eyebrow` are the hero's
primary and secondary buttons. They are used on `visit.html` as well as
`index.html`, so they are part of the shared component and are misnamed today.
Rename them first, on their own, so the rename is a clean mechanical commit that
does not have to be read alongside the layout work.

**Files:**
- Modify: `assets/css/components.css`
- Modify: `index.html`, `visit.html`

- [ ] **Step 1: Preview the rename**

```bash
npm run rename -- --dry ntgoc-home-hero-small-bold ntgoc-page-hero__action--primary
npm run rename -- --dry ntgoc-home-hero-eyebrow ntgoc-page-hero__action--secondary
```

Expected: each reports the files it would touch — `assets/css/components.css`,
`index.html` and `visit.html` — and no others.

- [ ] **Step 2: Run the rename**

Both pairs in one call, so lint runs once at the end against a consistent state:

```bash
npm run rename -- ntgoc-home-hero-small-bold ntgoc-page-hero__action--primary ntgoc-home-hero-eyebrow ntgoc-page-hero__action--secondary
```

- [ ] **Step 3: Verify no stale references remain**

```bash
grep -rn "ntgoc-home-hero-small-bold\|ntgoc-home-hero-eyebrow" *.html assets/css/components.css
```

Expected: no output. If anything is printed, the rename missed a file — fix it by
hand before continuing.

- [ ] **Step 4: Lint**

```bash
npm run lint
```

Expected: `✓ all checks passed (1 warning)`, the pre-existing
`ntgoc-about-clergy-shell` one.

- [ ] **Step 5: Commit**

```bash
git add assets/css/components.css index.html visit.html
git commit -m "Name the hero buttons after the hero, not the home page"
```

---

### Task 2: Rewrite the component

This is the core of the work. Replace the whole `.ntgoc-page-hero` block, add the
`__body` wrapper to the seven pages already using the component, and update the
mobile rules.

**Files:**
- Modify: `assets/css/components.css:1028-1088` (the `--- Shared photograph hero ---` comment through `.ntgoc-page-hero__actions`)
- Modify: `assets/css/components.css:1192-1194` (the `max-width: 640px` hero rules)
- Modify: `about.html`, `calendar.html`, `contact.html`, `events.html`, `faith.html`, `for-our-parish.html`, `visit.html`

- [ ] **Step 1: Replace the component block**

Find the comment that begins `/* --- Shared photograph hero` and replace
everything from that comment through the `.ntgoc-page-hero__actions` line with:

```css
/* --- The photograph hero ---------------------------------------------
   Every page with a hero uses this one component: the ten named in the
   main navigation plus the home page, Parish Life and the Festival. Four
   near-copies became one, so the scrim — the thing the text's legibility
   depends on — is defined and measured once.

   The scrim is two passes. The 75deg pass grades the picture from the
   text side; the `to top` pass darkens the foot of the frame. The second
   one is why the content bottom-aligns rather than centres: at full photo
   strength the gold eyebrow measures 4.32:1 over the middle of this
   picture and 7.47:1 over the foot of it. Alignment is a legibility
   requirement here, not a preference. The table is in ACCESSIBILITY.md.

   Heights are min-height, never height. Three of these heroes used a
   fixed height, put their words in a height:100% column, and lost their
   alignment entirely below 900px where the height became auto — a
   percentage height against an auto parent is auto. min-height cannot
   have that bug.
   -------------------------------------------------------------------- */
.ntgoc-page-hero { position: relative; min-height: 420px; display: flex; background: #3a1414; overflow: hidden; }
.ntgoc-page-hero--tall { min-height: 560px; }
.ntgoc-page-hero__photo {
  position: absolute;
  inset: 0;
  background-image: url('../img/parish-nave-aisle.jpg');
  background-size: cover;
  background-position: center;
}
/* The Festival is the one hero that is not the nave. */
.ntgoc-page-hero__photo--festival { background-image: url('../img/festival-banquet.png'); }
.ntgoc-page-hero__scrim {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(to top, rgba(58,20,20,.45) 0%, rgba(58,20,20,0) 45%),
    linear-gradient(75deg, rgba(58,20,20,.94) 0%, rgba(58,20,20,.86) 45%, rgba(58,20,20,.55) 72%, rgba(58,20,20,.25) 100%);
  pointer-events: none;
}
.ntgoc-page-hero__inner {
  position: relative;
  z-index: 1;
  max-width: 1240px;
  margin: 0 auto;
  width: 100%;
  padding: 96px 40px 76px;
  align-self: flex-end;
}
.ntgoc-page-hero__body { max-width: 660px; }
.ntgoc-page-hero__eyebrow {
  font-size: 11px;
  letter-spacing: .28em;
  text-transform: uppercase;
  color: #e0b673;
  margin-bottom: 22px;
}
.ntgoc-page-hero__title {
  font-family: Newsreader, serif;
  font-weight: 300;
  font-size: 54px;
  line-height: 1.08;
  margin: 0;
  color: #f6f1e8;
  letter-spacing: -.015em;
  text-wrap: pretty;
}
.ntgoc-page-hero--tall .ntgoc-page-hero__title { font-size: 66px; }
.ntgoc-page-hero__lede {
  font-size: 17.5px;
  line-height: 1.7;
  color: #ede4d3;
  margin: 24px 0 0;
  text-wrap: pretty;
}
/* Parish Life closes its hero with a second, quieter line. */
.ntgoc-page-hero__lede--serif {
  font-family: Newsreader, serif;
  font-style: italic;
  font-weight: 300;
  font-size: 24px;
  line-height: 1.5;
  color: #e0b673;
  margin: 18px 0 0;
  text-wrap: pretty;
}
.ntgoc-page-hero__actions { display: flex; gap: 14px; flex-wrap: wrap; margin-top: 34px; }
```

Note what changed beyond the obvious: `__title` loses `max-width:18ch` and
`__lede` loses `max-width:58ch`, because `__body` now holds the measure for both.

- [ ] **Step 2: Replace the mobile rules**

Find the `@media (max-width: 640px)` block containing `.ntgoc-page-hero { min-height: 320px; }`
and replace those three lines with:

```css
  .ntgoc-page-hero { min-height: 320px; }
  .ntgoc-page-hero--tall { min-height: 400px; }
  .ntgoc-page-hero__inner { padding: 52px 20px 44px; }
  .ntgoc-page-hero__title { font-size: 38px; }
  .ntgoc-page-hero--tall .ntgoc-page-hero__title { font-size: 44px; }
  .ntgoc-page-hero__lede { font-size: 16.5px; }
  .ntgoc-page-hero__lede--serif { font-size: 20px; }
```

- [ ] **Step 3: Add the `__body` wrapper to the seven pages**

In each of `about.html`, `calendar.html`, `contact.html`, `events.html`,
`faith.html`, `for-our-parish.html` and `visit.html`, the hero currently reads:

```html
      <div class="ntgoc-page-hero__inner ntgoc-gutter ntgoc-shell">
        <div class="ntgoc-page-hero__eyebrow">…</div>
```

Wrap the children of `__inner` in a `__body` div. For `about.html` the result is
exactly:

```html
      <div class="ntgoc-page-hero__inner ntgoc-gutter ntgoc-shell">
        <div class="ntgoc-page-hero__body">
          <div class="ntgoc-page-hero__eyebrow">About the parish</div>
          <h1 class="ntgoc-page-hero__title">Nativity of the Theotokos</h1>
        </div>
      </div>
```

Do the same on the other six, keeping each page's own eyebrow, title, lede and
actions unchanged and re-indenting them one level. `events.html`,
`for-our-parish.html` and `visit.html` have a `__lede`; `visit.html` also has a
`__actions` block — all of them go inside `__body`.

Do not change any text.

- [ ] **Step 4: Lint**

```bash
npm run lint
```

Expected: `✓ all checks passed (1 warning)`. Lint checks tag balance, so a
mis-nested `__body` fails here.

- [ ] **Step 5: Look at the layout change**

```bash
npm run snap
```

Expected: **changes reported** on about, calendar, contact, events, faith,
for-our-parish and visit — heroes 400 → 420px tall, content moved from centred to
bottom, scrim lightened. That is the intent. Read the diff and confirm it says
that and nothing else; in particular no page outside those seven should move.

Do **not** update the baseline yet. Task 9 does it once, after all ten pages are
converted.

- [ ] **Step 6: Commit**

```bash
git add assets/css/components.css about.html calendar.html contact.html events.html faith.html for-our-parish.html visit.html
git commit -m "One hero component: Parish Life's scrim, two heights, bottom-aligned"
```

---

### Task 3: Convert the home hero

**Files:**
- Modify: `index.html` (inside `<!-- CHUNK:ntgocHomeHero -->`)
- Modify: `assets/css/components.css` — delete the `.ntgoc-home-hero-*` layout rules

- [ ] **Step 1: Replace the markup**

Between `<!-- CHUNK:ntgocHomeHero -->` and `<!-- /CHUNK:ntgocHomeHero -->`,
replace the `<section>` with exactly:

```html
<section class="ntgoc-page-hero ntgoc-page-hero--tall">
      <div role="img" aria-label="The nave, looking down the centre aisle to the icon screen and the Royal Doors" class="ntgoc-page-hero__photo"></div>
      <div class="ntgoc-page-hero__scrim"></div>
      <div class="ntgoc-page-hero__inner ntgoc-gutter ntgoc-shell">
        <div class="ntgoc-page-hero__body">
          <div class="ntgoc-page-hero__eyebrow">Est. in Fredericksburg &nbsp;·&nbsp; Orthodox Christian</div>
          <h1 class="ntgoc-page-hero__title">Come and see.</h1>
          <p class="ntgoc-page-hero__lede">Nativity of the Theotokos is a Greek Orthodox Christian parish in Fredericksburg, Virginia. Whether you are Orthodox, exploring the ancient Christian faith, or simply visiting, we welcome you to join us in prayer and worship.</p>
          <div class="ntgoc-page-hero__actions">
            <a href="visit.html" class="ntgoc-inherit ntgoc-page-hero__action--primary">Plan your first visit</a>
            <a href="contact.html" class="ntgoc-inherit ntgoc-page-hero__action--secondary">Directions &amp; contact</a>
          </div>
        </div>
      </div>
    </section>
```

The copy is unchanged word for word. `.ntgoc-tall` and `.ntgoc-display-type` are
gone — the component's own `min-height` and `--tall` title size replace them.

- [ ] **Step 2: Delete the orphaned CSS**

Delete these nine rules from `assets/css/components.css`. They sit together in
one run:

```
.ntgoc-home-hero-box
.ntgoc-home-hero-media
.ntgoc-home-hero-box-4
.ntgoc-home-hero-row-shell
.ntgoc-home-hero-box-5
.ntgoc-home-hero-micro-caps
.ntgoc-home-hero-title
.ntgoc-home-hero-text
.ntgoc-home-hero-row
```

Keep `.ntgoc-page-hero__action--primary` and `--secondary`, which Task 1 renamed
and which sit immediately after them.

- [ ] **Step 3: Verify nothing still references them**

```bash
grep -rn "ntgoc-home-hero" *.html assets/css/components.css
```

Expected: no output.

- [ ] **Step 4: Lint**

```bash
npm run lint
```

Expected: `✓ all checks passed (1 warning)`. A missed rule shows up here as
`class-undefined`.

- [ ] **Step 5: Commit**

```bash
git add index.html assets/css/components.css
git commit -m "Home hero onto the shared component"
```

---

### Task 4: Convert the Parish Life hero

**Files:**
- Modify: `parish-life.html` (inside `<!-- CHUNK:ntgocParishLifeHero -->`)
- Modify: `assets/css/components.css` — delete `.ntgoc-parish-life-hero*` and the hero's four type rules, plus two media-query overrides

- [ ] **Step 1: Replace the markup**

Between `<!-- CHUNK:ntgocParishLifeHero -->` and `<!-- /CHUNK:ntgocParishLifeHero -->`,
replace the `<section>` with exactly:

```html
<section class="ntgoc-page-hero ntgoc-page-hero--tall">
      <div role="img" aria-label="The nave, looking down the centre aisle to the icon screen and the Royal Doors" class="ntgoc-page-hero__photo"></div>
      <div class="ntgoc-page-hero__scrim"></div>
      <div class="ntgoc-page-hero__inner ntgoc-gutter ntgoc-shell">
        <div class="ntgoc-page-hero__body">
          <div class="ntgoc-page-hero__eyebrow">Parish life</div>
          <h1 class="ntgoc-page-hero__title">Life Together</h1>
          <p class="ntgoc-page-hero__lede">The life of our parish extends beyond Sunday morning. We worship together, share meals, celebrate feast days, teach our children, serve our neighbors, and grow together in the life of Christ.</p>
          <p class="ntgoc-page-hero__lede--serif">Come and see what parish life looks like at Nativity of the Theotokos.</p>
        </div>
      </div>
    </section>
```

The title drops from 72px to the `--tall` 66px, which is the point of having one
scale. The copy is unchanged.

- [ ] **Step 2: Delete the orphaned CSS**

Delete these nine rules:

```
.ntgoc-parish-life-hero
.ntgoc-parish-life-hero__photo
.ntgoc-parish-life-hero__scrim
.ntgoc-parish-life-hero__inner
.ntgoc-parish-life-hero__body
.ntgoc-parish-life-eyebrow
.ntgoc-parish-life-h1
.ntgoc-parish-life-lede
.ntgoc-parish-life-lede--serif
```

Then delete these three lines from the Parish Life media queries — the first from
the `max-width: 900px` block, the other two from the `max-width: 640px` block.
Their replacements are already in the component's own mobile rules from Task 2.

```css
  .ntgoc-parish-life-hero__inner { padding-bottom: 52px !important; }
  .ntgoc-parish-life-lede { font-size: 16.5px; }
  .ntgoc-parish-life-lede--serif { font-size: 20px; }
```

**Careful:** `.ntgoc-parish-life-h1 { margin-bottom: 18px; }` also sits in that
`max-width: 640px` block and must go with its base rule. But
`.ntgoc-parish-life-h2`, `-body`, `-split`, `-gallery`, `-mosaic`, `-section`,
`-h520`/`-h460`/`-h440`/`-h420`, `-permission` and `-agenda__row` are the rest of
the page, not the hero. Leave every one of them alone.

- [ ] **Step 3: Verify only non-hero Parish Life classes remain**

```bash
grep -rn "ntgoc-parish-life-hero\|ntgoc-parish-life-eyebrow\|ntgoc-parish-life-h1\|ntgoc-parish-life-lede" *.html assets/css/components.css
```

Expected: no output.

- [ ] **Step 4: Lint**

```bash
npm run lint
```

Expected: `✓ all checks passed (1 warning)`.

- [ ] **Step 5: Commit**

```bash
git add parish-life.html assets/css/components.css
git commit -m "Parish Life hero onto the shared component"
```

---

### Task 5: Convert the Festival hero

Festival is the page most likely to need a follow-up, because its photograph is a
poster rather than the nave. Convert it, then measure it in Task 8 and be ready
to report a failure rather than paper over it.

**Files:**
- Modify: `festival.html` (inside `<!-- CHUNK:ntgocFestivalHero -->`)
- Modify: `assets/css/components.css` — delete `.ntgoc-festival-hero-*` and `.ntgoc-faith-hero-*`

- [ ] **Step 1: Replace the markup**

Between `<!-- CHUNK:ntgocFestivalHero -->` and `<!-- /CHUNK:ntgocFestivalHero -->`,
replace the `<section>` with exactly:

```html
<section class="ntgoc-page-hero">
      <div role="img" aria-label="Poster for the parish's 35th Anniversary Banquet" class="ntgoc-page-hero__photo ntgoc-page-hero__photo--festival"></div>
      <div class="ntgoc-page-hero__scrim"></div>
      <div class="ntgoc-page-hero__inner ntgoc-gutter ntgoc-shell">
        <div class="ntgoc-page-hero__body">
          <div class="ntgoc-page-hero__eyebrow">Fredericksburg Greek Festival</div>
          <h1 class="ntgoc-page-hero__title">Three days. Everyone invited.<!-- TODO: verify --></h1>
          <p class="ntgoc-page-hero__lede">Food, music, dancing and church tours on the grounds at Spotswood Furnace Road.</p>
        </div>
      </div>
    </section>
```

Note three things: no `--tall` (Festival is an interior page); the `--festival`
photo modifier alongside the base `__photo`; and the `<!-- TODO: verify -->`
comment kept exactly where it is, inside the `<h1>`, immediately after the full
stop.

- [ ] **Step 2: Delete the orphaned CSS**

Delete these seven rules:

```
.ntgoc-festival-hero-on-ink
.ntgoc-festival-hero-media
.ntgoc-festival-hero-box
.ntgoc-festival-hero-title
.ntgoc-festival-hero-text
.ntgoc-faith-hero-row
.ntgoc-faith-hero-eyebrow
```

`.ntgoc-faith-hero-row` and `-eyebrow` are named after Our Faith but were only
still used by Festival — `faith.html` moved to `.ntgoc-page-hero` some time ago.
Confirm that in the next step before believing it.

- [ ] **Step 3: Verify nothing still references them**

```bash
grep -rn "ntgoc-festival-hero\|ntgoc-faith-hero" *.html assets/css/components.css
```

Expected: no output. If `faith.html` turns out to still use one of them, stop and
report — do not delete a rule that is in use.

- [ ] **Step 4: Verify the TODO marker survived**

```bash
grep -c "TODO: verify" festival.html
npm run lint 2>&1 | grep "TODO: verify marker"
```

Expected: the same count `festival.html` had before this task, and the lint line
still reads `48 TODO: verify marker(s) across 16 pages`.

- [ ] **Step 5: Lint**

```bash
npm run lint
```

Expected: `✓ all checks passed (1 warning)`.

- [ ] **Step 6: Commit**

```bash
git add festival.html assets/css/components.css
git commit -m "Festival hero onto the shared component"
```

---

### Task 6: Remove the dead compensation rule

With all ten heroes on `min-height`, the `@media (max-width: 900px)` block that
patched the fixed-height heroes has nothing left to patch.

**Files:**
- Modify: `assets/css/components.css`

- [ ] **Step 1: Delete the block and its comment**

Delete the comment beginning `/* The three .ntgoc-tall heroes.` together with the
entire media query that follows it:

```css
@media (max-width: 900px) {
  .ntgoc-home-hero-row-shell,
  .ntgoc-faith-hero-row,
  .ntgoc-parish-life-hero__inner {
    min-height: inherit;
    padding-top: 40px;
    padding-bottom: 40px;
  }
}
```

All three selectors were deleted in Tasks 3–5, so this rule now matches nothing.
The reasoning it records is preserved in the new component comment from Task 2.

- [ ] **Step 2: Check whether `.ntgoc-display-type` is now orphaned**

```bash
grep -rn "ntgoc-display-type" *.html
```

If there is **no output**, the class is used by no page — delete its rule from the
`@media (max-width: 900px)` block in `components.css` as well:

```css
  .ntgoc-display-type { font-size: clamp(30px, 8vw, 54px) !important; line-height: 1.15 !important; }
```

If any page still uses it, leave the rule alone.

- [ ] **Step 3: Confirm `.ntgoc-tall` is still needed**

```bash
grep -rn "ntgoc-tall" *.html
```

Expected: exactly two hits — `about.html` and `visit.html`, both on media boxes,
neither on a hero. `.ntgoc-tall`'s own rules stay in `components.css`. If you see
a third hit on a `<section class="ntgoc-page-hero…">`, a previous task missed it.

- [ ] **Step 4: Lint**

```bash
npm run lint
```

Expected: `✓ all checks passed (1 warning)`.

- [ ] **Step 5: Commit**

```bash
git add assets/css/components.css
git commit -m "Retire the fixed-height hero workaround it no longer patches"
```

---

### Task 7: A tool that measures the contrast

`ACCESSIBILITY.md` records twenty measurements taken "by sampling the brightest
pixel actually rendered behind each **glyph run** — not behind the element box".
That distinction is the whole reason six pages once looked like failures at
2.8–3.4:1. Every one of those numbers is now stale, and Festival was never in the
table.

Write the measurement rather than doing it by eye, so the claim in the document is
reproducible.

**Files:**
- Create: `tools/measure-hero-contrast.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the tool**

Create `tools/measure-hero-contrast.mjs`:

```js
/*
 * Hero contrast, measured against the pixels behind the glyphs.
 *
 * axe defers on text over a background image, so these twenty-odd strings are
 * checked here instead. The subtlety this tool exists for: an eyebrow is a
 * full-width block whose box runs a thousand pixels past its text, across the
 * brightest part of the photograph. Measuring the box fails pages that pass.
 * So we take the client rects of the text itself — Range.getClientRects(), one
 * per line — hide the text, screenshot what is behind it, and report the
 * brightest pixel under any glyph run.
 *
 * Not part of `npm run check`. It documents ACCESSIBILITY.md; it does not gate.
 */
import puppeteer from 'puppeteer-core';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('..', import.meta.url));
const CHROME = process.env.CHROME_PATH
  || ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome-stable', '/usr/bin/google-chrome']
       .find(p => existsSync(p));
if (!CHROME) throw new Error('No Chrome found. Set CHROME_PATH.');

const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.json': 'application/json' };

const server = createServer((req, res) => {
  const path = join(REPO, decodeURIComponent(req.url.split('?')[0]).replace(/^\//, ''));
  if (!path.startsWith(REPO) || !existsSync(path)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' });
  res.end(readFileSync(path));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const SITE = `http://127.0.0.1:${server.address().port}`;

/* WCAG relative luminance and contrast ratio. */
const chan = c => { c /= 255; return c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => .2126 * chan(r) + .7152 * chan(g) + .0722 * chan(b);
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + .05) / (y + .05); };
const parseRGB = s => s.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);

const PARTS = [
  ['Eyebrow',  '.ntgoc-page-hero__eyebrow',     4.5],
  ['Headline', '.ntgoc-page-hero__title',       3  ],
  ['Lede',     '.ntgoc-page-hero__lede',        4.5],
  ['Lede 2',   '.ntgoc-page-hero__lede--serif', 4.5],
];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--force-device-scale-factor=1'],
});

const pages = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['index.html', 'parish-life.html', 'faith.html', 'calendar.html', 'about.html',
     'events.html', 'contact.html', 'visit.html', 'for-our-parish.html', 'festival.html'];

const rows = [];
let worst = { r: Infinity };

for (const file of pages) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(`${SITE}/${file}`, { waitUntil: 'networkidle0', timeout: 45000 });

  /* Where is the hero, what colour is each string, and where are its glyphs? */
  const probe = await page.evaluate(parts => {
    const hero = document.querySelector('.ntgoc-page-hero');
    if (!hero) return null;
    const box = hero.getBoundingClientRect();
    const found = [];
    for (const [name, sel] of parts) {
      const el = hero.querySelector(sel);
      if (!el) continue;
      const rects = [];
      for (const node of el.childNodes) {
        if (node.nodeType !== Node.TEXT_NODE || !node.textContent.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const r of range.getClientRects()) {
          if (r.width > 0 && r.height > 0) rects.push({ x: r.x, y: r.y, w: r.width, h: r.height });
        }
      }
      if (rects.length) found.push({ name, sel, color: getComputedStyle(el).color, rects });
    }
    return { box: { x: box.x, y: box.y, w: box.width, h: box.height }, found };
  }, PARTS);

  if (!probe) { console.log(`  ${file}: no .ntgoc-page-hero — skipped`); await page.close(); continue; }

  /* Hide the text but keep its layout, so the screenshot is what sits behind. */
  await page.evaluate(parts => {
    for (const [, sel] of parts) {
      for (const el of document.querySelectorAll(sel)) el.style.visibility = 'hidden';
    }
  }, PARTS);

  const shot = await page.screenshot({
    clip: { x: probe.box.x, y: probe.box.y, width: probe.box.w, height: probe.box.h },
    encoding: 'base64',
  });
  await page.close();

  /* Decode the PNG with the browser rather than a new dependency. */
  const reader = await browser.newPage();
  const pixels = await reader.evaluate(async (b64, box, found) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const cv = document.createElement('canvas');
    cv.width = img.width; cv.height = img.height;
    cv.getContext('2d').drawImage(img, 0, 0);
    const ctx = cv.getContext('2d');
    return found.map(f => {
      let best = null, bestLum = -1;
      for (const r of f.rects) {
        const x0 = Math.max(0, Math.round(r.x - box.x)), y0 = Math.max(0, Math.round(r.y - box.y));
        const w = Math.min(cv.width - x0, Math.round(r.w)), h = Math.min(cv.height - y0, Math.round(r.h));
        if (w <= 0 || h <= 0) continue;
        const d = ctx.getImageData(x0, y0, w, h).data;
        for (let i = 0; i < d.length; i += 4) {
          const L = .2126 * (d[i] / 255) + .7152 * (d[i + 1] / 255) + .0722 * (d[i + 2] / 255);
          if (L > bestLum) { bestLum = L; best = [d[i], d[i + 1], d[i + 2]]; }
        }
      }
      return { name: f.name, color: f.color, bg: best };
    });
  }, shot, probe.box, probe.found);
  await reader.close();

  for (const p of pixels) {
    if (!p.bg) continue;
    const need = PARTS.find(([n]) => n === p.name)[2];
    const r = ratio(parseRGB(p.color), p.bg);
    rows.push({ file, part: p.name, need, r });
    if (r / need < worst.r / (worst.need || 1)) worst = { file, part: p.name, need, r };
  }
}

await browser.close();
server.close();

const w = rows.filter(x => x.r < x.need);
console.log('\n| Page | String | Needs | Measured | |');
console.log('|---|---|---:|---:|---|');
for (const x of rows) {
  console.log(`| ${x.file} | ${x.part} | ${x.need} | ${x.r.toFixed(2)}:1 | ${x.r < x.need ? '**FAILS**' : 'passes'} |`);
}
console.log(`\n  ${rows.length} strings across ${new Set(rows.map(r => r.file)).size} heroes`);
if (w.length) {
  console.log(`\n  ${w.length} FAIL:`);
  for (const x of w) console.log(`    ${x.file} ${x.part} — ${x.r.toFixed(2)}:1, needs ${x.need}`);
  process.exitCode = 1;
} else {
  console.log(`  worst margin: ${worst.file} ${worst.part} at ${worst.r.toFixed(2)}:1 against ${worst.need}`);
}
```

- [ ] **Step 2: Add the script**

In `package.json`, add to `"scripts"`, after `"links"`:

```json
    "measure:hero": "node tools/measure-hero-contrast.mjs",
```

Leave `"check"` alone. This tool documents; it does not gate.

- [ ] **Step 3: Run it**

```bash
npm run measure:hero
```

Expected: a markdown table of about 24 rows across 10 heroes. Every row should
read `passes`. Save the output — Task 8 pastes it into `ACCESSIBILITY.md`.

**If any row FAILS, stop here.** Do not adjust the scrim, the gold, or the photo
to make it pass. Report the page, the string and the number, and let the user
decide the trade. Festival is the expected candidate.

- [ ] **Step 4: Commit**

```bash
git add tools/measure-hero-contrast.mjs package.json
git commit -m "Measure hero contrast against the pixels behind the glyphs"
```

---

### Task 8: Rewrite the accessibility record

**Files:**
- Modify: `ACCESSIBILITY.md` — the "Contrast over a background image" section

- [ ] **Step 1: Replace the table**

In the "Contrast over a background image" section, replace the eight-row table
with the measurements from Task 7 — ten pages now, Festival included, and a
column for Parish Life's second lede. Keep the existing table's shape: page down
the side, string across the top, the threshold in the header.

- [ ] **Step 2: Replace the 42%-opacity paragraph**

Delete the paragraph beginning "**This is why the home hero keeps its 42%
opacity.**" in full. It documents a state that no longer exists. Replace it with:

```markdown
**Why the text sits low.** The scrim is one value site-wide and the photograph is
never dimmed. The margin comes from two things: the scrim's second, vertical pass,
which darkens the foot of the frame, and the fact that every hero bottom-aligns
its text into that darker zone. Both matter. Measured over the middle of the nave
photograph at full strength, the gold eyebrow reads 4.32:1 — under the 4.5
minimum. Measured over the foot of it, where it actually sits, it clears. If a
hero is ever centred again, or the vertical pass removed, these numbers have to be
re-measured before it ships.
```

- [ ] **Step 3: Update the sentence above the table**

The paragraph that begins "Measured on 9 August 2026 by sampling the brightest
pixel..." keeps its explanation of glyph runs versus element boxes — that is still
exactly what is measured — but note the measurement is now reproducible:

```markdown
Measured by `npm run measure:hero`, which samples the brightest pixel actually
rendered behind each **glyph run** — not behind the element box. That distinction
matters: an eyebrow is a full-width block whose box runs a thousand pixels past
the text, across the brightest part of the photograph. Measured that way, six
pages appeared to fail at 2.8–3.4:1. Measured against the glyphs, every string
passes.
```

- [ ] **Step 4: Fix the count**

The section is headed "The 95 'needs review' items" and says the hero strings are
among them. Run `npm run audit:a11y` and, if the needs-review count has changed
now that Festival's hero is a `.ntgoc-page-hero` too, correct the heading and any
number in the surrounding prose that no longer matches.

```bash
npm run audit:a11y
```

- [ ] **Step 5: Commit**

```bash
git add ACCESSIBILITY.md
git commit -m "Re-measure every hero string against the new scrim"
```

---

### Task 9: Regenerate and verify

**Files:**
- Modify: `dist/chunks/` (generated)
- Modify: `tests/layout-baseline.json` (generated)

- [ ] **Step 1: Regenerate the chunks**

```bash
npm run chunks
```

- [ ] **Step 2: Confirm every hero chunk still exists under its own name**

```bash
ls dist/chunks | grep -i hero
```

Expected: the ten chunk files are all still there —
`ntgocHomeHero`, `ntgocParishLifeHero`, `ntgocFestivalHero`, `ntgocAboutHero`,
`ntgocCalendarHero`, `ntgocContactHero`, `ntgocEventsHero`, `ntgocFaithHero`,
`ntgocParishHero`, `ntgocVisitorHero`. If one is missing, a CHUNK wrapper was
damaged — find it and restore it before going on.

- [ ] **Step 3: Review the layout diff, then accept it**

```bash
npm run snap
```

Read what it reports. Expected: changes on all ten hero pages and nothing else.
Then:

```bash
npm run snap -- --update
```

- [ ] **Step 4: Run the full check**

```bash
npm run check
```

Expected: lint clean with the one pre-existing warning; snapshot reports no change
(you just updated it); **0 axe violations across 16 pages × 2 viewports**; reflow
**16/16 at 320px**.

- [ ] **Step 5: Re-run the contrast measurement against the final state**

```bash
npm run measure:hero
```

Expected: every row passes, matching the table committed in Task 8. If a number
has drifted from what is in `ACCESSIBILITY.md`, correct the document.

- [ ] **Step 6: Commit**

```bash
git add dist/chunks tests/layout-baseline.json
git commit -m "Regenerate chunks and the layout baseline"
```

---

## Done when

- All ten heroes use `.ntgoc-page-hero`; `grep -rn "ntgoc-home-hero\|ntgoc-parish-life-hero\|ntgoc-festival-hero\|ntgoc-faith-hero" *.html assets/css/components.css` returns nothing.
- `npm run check` is clean: lint + 1 known warning, 0 axe violations, reflow 16/16.
- `npm run measure:hero` reports every string passing.
- `ACCESSIBILITY.md` describes what the site now does, not what it used to.
- No copy changed; the lint TODO count is still 48 across 16 pages.
