# Mobile layout — design

**Date:** 2026-08-09
**Status:** approved, not yet implemented

Make the site actually use the mobile design that currently exists only as a
static mock-up on `mobile-views.html`, then delete that page.

---

## Where things stand today

`mobile-views.html` draws two phone screens: a compact header with a hamburger
next to an open navigation drawer, and the home page above the fold. Nothing on
the site uses either. It is reachable from a "Mobile views" link in the top bar,
which is the only link that bar carries.

The real mobile behaviour lives in `components.css` at `@media (max-width: 640px)`.
The header nav *wraps* into a centred pile of about nine links, and the two
dropdown groups are dissolved with `display: contents` so their children sit
inline beside everything else. A comment on that block says why:

> Rather than build a drawer (which the design shows only as a static mock on
> the Mobile views page), let it wrap — every link stays reachable with no
> JavaScript.

Everything else already has an authored responsive pass of varying depth:
Parish Life, Visit, For Our Parish and the page heroes all have breakpoints.
Reflow passes 17/17 at 320px and axe reports 0 violations at 390px, so this work
starts from a compliant baseline and must not lose it.

## What the live parish template provides

Checked against <https://www.nativity.va.goarch.org/> on 2026-08-09:

- The template loads jQuery 3.3.1, Popper 1.12.9 and
  `bootstrap.bundle.min.js` 4.1.3, plus `/assets/templates/common/js/main.js`.
- It has its own mobile drawer — `#offcanvas`, opened by a three-`<span>`
  `.oc-toggler` shown `d-block d-md-none`, driven by `main.js` rather than by
  Bootstrap's collapse.
- `IMPORT.md` imports `ntgocSiteHeader` as the site navigation, so that template
  drawer is replaced and not inherited.

**This demo loads no Bootstrap and no jQuery** — only `ntgoc-enhance.js`. So
markup that depends on Bootstrap's collapse would work once imported into EVO
and be inert in the demo, which is the artefact the Parish Council actually
looks at. Bootstrap is therefore not used.

## Decisions

| Decision | Choice |
|---|---|
| Drawer mechanism | `<details>` / `<summary>`, with `ntgoc-enhance.js` adding polish |
| Breakpoint | Drawer replaces the horizontal nav at ≤900px |
| Drawer vs nav markup | Two link lists, kept honest by a new lint rule |
| Scope | Shell + home above the fold + a 320/390px sweep of all 17 pages |
| Drawer service card | Kept, but naming both services |
| Top bar after removal | Metropolis line alone |
| Delivery | One branch, four commits at the seams |

`<details>` is chosen over a JS-driven button because it opens and closes with no
JavaScript at all, in both the demo and EVO, and brings correct keyboard and
screen-reader behaviour with it. `IMPORT.md` already documents this same pattern
for the Visit page accordions. The JS stays genuinely optional.

Two link lists is chosen over one restyled list because forcing a closed
`<details>` open at desktop width means overriding how the browser hides its
contents — `::details-content` in current Chrome, other mechanisms elsewhere.
That failure would be invisible to lint and visible to `npm run snap` only in
whichever browser it happens to run. Duplication inside a single chunk, guarded
by lint, is the trade this repo has made for every other drift trap.

---

## Part 1 — The shell

`ntgocSiteHeader` gains a drawer alongside the existing nav:

```html
<header class="ntgoc-header ntgoc-sticky">
  <div class="ntgoc-header-inner ntgoc-flex ntgoc-gutter ntgoc-shell">
    <a href="index.html" class="ntgoc-inherit ntgoc-logo ntgoc-flex">…</a>

    <nav class="ntgoc-nav ntgoc-flex">…unchanged…</nav>

    <details class="ntgoc-drawer" data-ntgoc-drawer>
      <summary class="ntgoc-drawer__toggle">
        <span class="ntgoc-drawer__bars" aria-hidden="true"></span>
        <span class="ntgoc-visually-hidden">Menu</span>
      </summary>
      <div class="ntgoc-drawer__panel">
        <div class="ntgoc-drawer__list">…mirrors ntgoc-nav…</div>
        <div class="ntgoc-drawer__utility">…Give…</div>
        <div class="ntgoc-drawer__service">…next service…</div>
      </div>
    </details>
  </div>
</header>
```

### The drawer's contents

**The mock's link list is stale and is not copied.** It predates the Events
group and the Bookstore move: it shows a four-item Parish Life submenu, no
Events group, and puts Greek Festival and Hall Rental in a small-caps tail where
both now live under Events. The drawer mirrors the *current* nav:

- Our Faith
- Parish Life — with For Our Parish, Ministries, Parish Council Committees,
  Parish Bookstore, The Light newsletter indented beneath it
- Calendar
- Events — with Greek Festival (fredgreek.org) and Hall Rental indented beneath
- About
- Contact
- Plan a visit

The mock's *visual grammar* is what carries over: serif ledes for top-level
entries, indented children on `.ntgoc-drawer__sub`. That class already exists as
`.ntgoc-drawer-sub` (`components.css:697`) and is currently used only by the
mock, so it survives the deletion by acquiring a real consumer — renamed via
`npm run rename` to match the `__element` convention the rest of the drawer
follows.

The submenu parent links stay plain links, not nested `<details>`. Every parent
in the current nav is itself a real page, and nesting disclosures inside a
disclosure adds a second tap to reach four of the six Parish Life entries.

`.ntgoc-drawer__utility` carries **Give** — the one link the mock's tail had that
is absent from the header today. Greek Festival and Hall Rental are not repeated
there, because the drawer already carries both under Events.

`.ntgoc-drawer__service` carries the service card. The mock reads "Next service —
Sunday, 9:00 a.m."; 9:00 is Orthros, and `data/site.json` records that pairing a
9:00 start with the service generally is precisely the error the live parish site
makes. The card ships with `sundayLine` from `data/site.json` instead:

> Sunday · Orthros 9:00 a.m. · Divine Liturgy 10:00 a.m.

### Interaction with `sync-shell.mjs`

No change needed. Its `applyCurrent` uses a global regex, so `aria-current="page"`
is applied to both the nav copy and the drawer copy of the current page's link,
which is correct. The regex matches `<a\s+href="page.html"` — the drawer's
anchors must therefore put `href` first with a single space, matching the
existing shell markup.

## Part 2 — CSS

Delete the nav-wrapping rules in `@media (max-width: 640px)`
(`components.css` ~1071–1108): the `.ntgoc-page nav.ntgoc-flex` wrap, the
`header.ntgoc-sticky` column flip, and the whole `.ntgoc-navgroup`
`display: contents` block. They exist only because there was no drawer.

Add a `@media (max-width: 900px)` block:

- `.ntgoc-nav { display: none }`
- `.ntgoc-drawer { display: block }` — and `display: none` above 900px
- `.ntgoc-drawer__panel` — full-width, parchment, scrolls internally
- `.ntgoc-drawer__toggle` — the three-bar mark, ≥44px touch target, and
  `list-style: none` plus `::-webkit-details-marker { display: none }` to
  suppress the native disclosure triangle
- `.ntgoc-drawer__bars` — three bars via `background`/`box-shadow`, no new asset

Also drop `.ntgoc-sticky { position: static !important }` from the ≤640px block.
The mobile header becomes short — seal, name, hamburger — so a sticky header is
affordable now and keeps the drawer reachable part-way down a long page. The
panel scrolls inside itself rather than growing the header.

The responsive layer stays last in the file, per the header comment in
`components.css`.

## Part 3 — JS

About 40 lines appended to `assets/js/ntgoc-enhance.js`, guarded on
`[data-ntgoc-drawer]` so it exits immediately on any page without one (the
existing bookstore-filter block is guarded the same way):

- Escape closes the drawer and returns focus to the toggle
- a click outside the panel closes it
- clicking any link inside closes it
- a class on `document.body` locks background scroll while open

Nothing here is required for the drawer to work. `IMPORT.md`'s Step 6 keeps
describing the file as optional, with the drawer added to the list of things it
improves rather than things it provides.

## Part 4 — Home above the fold

`ntgocHomeHero` and `ntgocHomeServiceTimes` get a ≤900px treatment following the
mock's ordering: hero photograph, headline, a "What to expect on Sunday" link to
`visit.html`, then the brick block —

- Every Sunday
- 9:00 & 10:00 a.m.
- Orthros & Divine Liturgy
- a rule
- 12326 Spotswood Furnace Rd, Fredericksburg, VA 22407
- a **Directions | Call** row — `contact.html` and `tel:+15405482665`

— and the Romans 15:7 quote, which `index.html` already carries at line 152.

No new parish facts. Every value above is already on the page or in
`data/site.json`. The `tel:` href is `contact.phoneHref`.

## Part 5 — The sweep

All 17 pages examined at 320px and 390px, fixing what is actually broken rather
than assuming the existing breakpoints hold. Expected thin spots, to be
confirmed not presumed:

- `visit.html` — 53KB, by far the largest page
- `bookstore.html` — filter pills plus catalogue grid
- `calendar.html` — a month grid, which no existing media query mentions

## Part 6 — Removal and guardrails

Delete:

- `mobile-views.html`
- its 36 rules in `components.css` — **keeping `.ntgoc-drawer__sub`**, which the
  drawer now uses — plus `.ntgoc-scroll-x`, `.ntgoc-topbar-links` and
  `.ntgoc-topbar-link`, which the mock and its top-bar entry were the only
  consumers of
- `dist/chunks/ntgocMobileViews.html` (via `npm run chunks`)
- the top bar's `.ntgoc-topbar-links` div, across all 17 pages via `npm run shell`
- its rows in `tests/layout-baseline.json` (102 references)
- its entries in `IMPORT.md`

The top bar keeps the Metropolis line alone. Its ≤640px rules simplify, since
there is no longer a link row to wrap.

`tools/archive/render.mjs` also references the page. It is archived and must not
be run; it is left alone, consistent with `CLAUDE.md`.

### The page count is hardcoded in prose, and goes stale

Seventeen becomes sixteen, and nine places say so in words:

| File | Lines |
|---|---|
| `CLAUDE.md` | 17, 39, 121 |
| `README.md` | 31 |
| `CONTRIBUTING.md` | 22, 63, 99, 192 |
| `IMPORT.md` | 587 |
| `ACCESSIBILITY.md` | 5, 24 |

All are updated in commit 4. Note that `CLAUDE.md:24` and `tools/lint.mjs:405`
say "twelve pages" about the archived renderer — that is a historical statement
about what the retired renderer produced, and stays as it is.

### New lint rule: `nav-drawer-parity`

The set of `href` values inside `.ntgoc-drawer__list` must equal the set inside
`.ntgoc-nav`. Order is not checked — the drawer is free to lead with "Plan a
visit" as the mock does. `.ntgoc-drawer__utility` and `.ntgoc-drawer__service`
are exempt. Failure message names the hrefs present in one and missing from the
other.

---

## Delivery

One branch, four commits at the seams, `npm run check` clean before each:

1. Shell, CSS and JS — the drawer working
2. Home above the fold
3. The 320/390px sweep
4. Removal of `mobile-views.html`, the lint rule, re-baselined snapshot

Order matters: the mock page is deleted **last**, so it stays available as a
visual reference while the drawer is built against it.

## Verifying

`npm run check` — lint, snapshot, axe, reflow. Through commits 1–3 the expected
clean state is the one `CLAUDE.md` records: lint passes, 0 axe violations across
17 pages × 2 viewports, reflow 17/17 at 320px. Commit 4 deletes a page, so from
then on it is 16 pages × 2 viewports and reflow 16/16 — which is why the prose
counts above are corrected in that same commit.

`npm run snap` will report changes throughout — the header changes on every
page. Each commit re-baselines with `npm run snap -- --update` only after the
reported deltas have been read and found to be the intended ones. A blind
re-baseline would defeat the only check that sees layout.

Two things no automated check covers, to be confirmed in a browser:

- the drawer opens, closes, and traps nothing it should not, with JS disabled
- the sticky header does not obscure content at 320px once the drawer is open
