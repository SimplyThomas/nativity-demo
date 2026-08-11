# One hero component across the site

**Date:** 9 August 2026
**Branch:** `worktree-hero-consistency`

## The problem

Ten pages carry a photograph hero. They are built four different ways.

| Family | Pages | Height | Photo | Gradient |
|---|---|---|---|---|
| `ntgoc-page-hero` | about, calendar, contact, events, faith, for-our-parish, visit | `min-height:400px`, centred | full strength | 2 layers, `75deg` @ .96/.9/.6/.28 |
| `ntgoc-parish-life-hero` | parish-life | `height:660px`, bottom | full strength | 2 layers, `75deg` @ .94/.86/.55/.25 |
| `ntgoc-home-hero-box` | index | `height:640px`, centred | `opacity:.42` | 1 layer, `100deg` @ .94/.72/.25 |
| `ntgoc-festival-hero-on-ink` | festival | `height:460px`, centred | `opacity:.45` | 1 layer, `90deg` @ .94/.45 |

Parish Life is the one that reads best, and the reason is its second gradient —
a vertical `to top` pass that darkens the foot of the frame where its text sits.
Home and Festival have no such pass; they fake the same depth by dimming the
photograph, which flattens the picture instead of grading it.

Four heights, two alignments and three title sizes are the rest of it.

## What we are building

One component, `.ntgoc-page-hero`, with a single `--tall` modifier, used by all
ten pages. Parish Life's scrim becomes the standard. The photograph runs at full
strength everywhere.

Each page keeps the chunk wrapper it already has — `ntgocHomeHero`,
`ntgocParishLifeHero`, `ntgocFestivalHero`, `ntgocAboutHero`, `ntgocCalendarHero`,
`ntgocContactHero`, `ntgocEventsHero`, `ntgocFaithHero`, `ntgocParishHero`,
`ntgocVisitorHero`. Only the markup inside each wrapper changes, so the import
story in `IMPORT.md` is untouched and no volunteer has to re-paste a differently
named chunk.

### Markup

```html
<section class="ntgoc-page-hero ntgoc-page-hero--tall">
  <div role="img" aria-label="…" class="ntgoc-page-hero__photo"></div>
  <div class="ntgoc-page-hero__scrim"></div>
  <div class="ntgoc-page-hero__inner ntgoc-gutter ntgoc-shell">
    <div class="ntgoc-page-hero__body">
      <div class="ntgoc-page-hero__eyebrow">…</div>
      <h1  class="ntgoc-page-hero__title">…</h1>
      <p   class="ntgoc-page-hero__lede">…</p>
      <p   class="ntgoc-page-hero__lede--serif">…</p>
      <div class="ntgoc-page-hero__actions">
        <a href="…" class="ntgoc-inherit ntgoc-page-hero__action--primary">…</a>
        <a href="…" class="ntgoc-inherit ntgoc-page-hero__action--secondary">…</a>
      </div>
    </div>
  </div>
</section>
```

`__lede`, `__lede--serif` and `__actions` are optional; `--tall` appears on index
and parish-life only. Festival keeps its own `aria-label` and its own photograph
(see *Festival* below); the other nine keep the nave label they already carry.

`__body` is new. It is the one measure control, replacing three: today
`__title{max-width:18ch}` plus `__lede{max-width:58ch}` on the shared component,
`__body{max-width:660px}` on Parish Life, and `__box-5{max-width:620px}` on Home.

### Scrim

Parish Life's, verbatim, on all ten:

```css
.ntgoc-page-hero__scrim {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(to top, rgba(58,20,20,.45) 0%, rgba(58,20,20,0) 45%),
    linear-gradient(75deg,  rgba(58,20,20,.94) 0%, rgba(58,20,20,.86) 45%,
                            rgba(58,20,20,.55) 72%, rgba(58,20,20,.25) 100%);
  pointer-events: none;
}
```

`.ntgoc-page-hero__photo` carries no `opacity`. The `.42` on Home and the `.45`
on Festival both go.

### Sizing and alignment

| | standard | `--tall` |
|---|---:|---:|
| `min-height` | 420px | 560px |
| `__title` font-size | 54px | 66px |
| pages | about, calendar, contact, events, faith, for-our-parish, visit, festival | index, parish-life |

Content bottom-aligns on all ten. `__inner` becomes `align-self: flex-end` with
padding `96px 40px 76px`.

At `max-width: 640px`: `min-height` 320 / 400, `__title` 38 / 44, `__inner`
padding `52px 20px 44px`.

Every hero uses `min-height`, never `height`. That distinction is the whole
subject of the comment block at `components.css:1288` — three heroes used
`height`, their inner columns asked for `height:100%` against it, and below 900px
where `.ntgoc-tall` swapped the fixed height for a `min-height` the percentage
resolved to `auto` and `justify-content` silently stopped working. A component
that only ever uses `min-height` cannot have that bug, so both the compensation
rule and its comment are deleted.

### Why bottom alignment, specifically

`ACCESSIBILITY.md:177` records that this exact change has been measured before:

> **This is why the home hero keeps its 42% opacity.** The photograph was changed
> to match Parish Life's; matching that page's *treatment* as well — the image at
> full strength — was measured and drops the gold eyebrow to **4.32:1**, under
> the 4.5 minimum for text that size. Parish Life gets away with full strength
> because its scrim has a second bottom gradient and its eyebrow sits lower.

Both halves of that sentence are the design. The second gradient is adopted, and
"its eyebrow sits lower" becomes the rule rather than one page's accident. Parish
Life scores 7.47:1 on the identical scrim because its text sits in the zone the
vertical pass darkens. Bottom-aligning is therefore not a style preference chosen
alongside the gradient; it is the condition under which the gradient is legible.

## Classes retired

Deleted from `components.css`, all rules and any media-query overrides:

- `.ntgoc-home-hero-box`, `-media`, `-box-4`, `-row-shell`, `-box-5`,
  `-micro-caps`, `-title`, `-text`, `-row`
- `.ntgoc-parish-life-hero`, `__photo`, `__scrim`, `__inner`, `__body`,
  `.ntgoc-parish-life-eyebrow`, `-h1`, `-lede`, `-lede--serif`
- `.ntgoc-festival-hero-on-ink`, `-media`, `-box`, `-title`, `-text`
- `.ntgoc-faith-hero-row`, `.ntgoc-faith-hero-eyebrow`
- the `@media (max-width:900px)` block at `components.css:1288` and its comment
- `.ntgoc-parish-life-hero__inner` override at `components.css:1146`
- the `.ntgoc-parish-life-lede` / `--serif` overrides at `components.css:1155`,
  which move to `__lede` / `__lede--serif`

Renamed rather than deleted, with `npm run rename`:

- `.ntgoc-home-hero-small-bold` → `.ntgoc-page-hero__action--primary`
- `.ntgoc-home-hero-eyebrow` → `.ntgoc-page-hero__action--secondary`

These are the hero buttons. They are used on visit.html as well as index.html, so
they are part of the component and are misnamed today, not dead.

Kept:

- `.ntgoc-tall` — still used by `about.html:141` and `visit.html:709` on media
  boxes. Only its three uses on hero sections go.
- `.ntgoc-display-type` — if removing it from the index and parish-life heroes
  leaves it with no remaining use in any page, delete the rule too.

`.ntgoc-hero-band` and the bookstore/committees/ministries/newsletter parchment
headers are out of scope and unchanged. give.html and hall.html have no hero.

## Festival is the one risk

Festival's photograph is not the nave. It is `festival-banquet.png`, a poster,
and its `opacity:.45` is doing legibility work that the nave photograph does not
need. Taking it to full strength under the standard scrim may fail contrast.

Measure it. If the eyebrow, title or lede falls below its threshold, stop and
report the number rather than quietly restoring a per-page dim. The decision of
what to trade — a lighter gold, a darker scrim for that page, a different crop,
or accepting the poster reads through — is the user's, not the implementer's.

## Accessibility documentation

`ACCESSIBILITY.md` does not merely need its numbers refreshed. The table of
twenty measurements and the entire "*This is why the home hero keeps its 42%
opacity*" paragraph document the state this change removes.

- Re-measure all twenty strings against the new scrim, by sampling the brightest
  pixel behind each **glyph run**, not behind the element box — the distinction
  the existing section is careful about and the reason six pages once looked
  like failures at 2.8–3.4:1.
- Add Festival, which the table currently omits.
- Replace the 42%-opacity paragraph with what was actually done: the scrim is now
  one value site-wide, the photograph is never dimmed, and the margin comes from
  the vertical gradient plus bottom alignment.

## Verification

- `npm run lint` — clean. One pre-existing warning
  (`ntgoc-about-clergy-shell` / `ntgoc-contact-card-shell` are equivalent) is
  unrelated and stays.
- `npm run check` — 0 axe violations across 16 pages × 2 viewports, reflow 16/16
  at 320px.
- `npm run snap` — will report changes on all ten hero pages. That is the point
  of the work, so review them, then `npm run snap -- --update` and commit
  `tests/layout-baseline.json`.
- `npm run chunks` — regenerate `dist/chunks/`.
- Contrast re-measured by hand and written into `ACCESSIBILITY.md`.

## Out of scope

No copy changes. No parish facts touched, so `data/site.json` and
`data/parish-facts.json` are untouched and the 48 `TODO: verify` markers stay
exactly where they are — including the one inside the Festival headline, which
must survive the hero rewrite.
