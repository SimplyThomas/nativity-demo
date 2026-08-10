# Making changes

**Edit the HTML and CSS directly.** They are the source.

```sh
npm install    # once — only for the audit tools
npm run dev    # http://localhost:4000
# edit index.html, visit.html, assets/css/components.css … and reload
npm run lint   # before you commit
```

That is the whole workflow. If you have used this repo before and remember
being told never to edit the HTML, that changed on **8 August 2026** — see
[What changed](#what-changed-and-why) below.

---

## Where things live

| File / folder | What it is |
|---|---|
| `*.html` (17 pages) | **Source.** Edit directly — except the blocks between `<!-- BUILD:… -->` markers. |
| `data/site.json` | **Source of truth** for any fact stated on more than one page. Lint enforces it. |
| `data/parish-calendar.json` | **Source of truth** for the calendar. Rendered into three pages by `npm run parish`. |
| `data/parish-announcements.json` | **Source of truth** for parish announcements. Same build. |
| `assets/css/components.css` | **Source.** Ships to the parish CMS. |
| `assets/css/provisional.css` | **Source.** Demo only — contains a reset, never import it. |
| `assets/js/ntgoc-enhance.js` | **Source.** Progressive enhancement only. |
| `assets/img/` | Images, provenance recorded in `data/parish-facts.json`. |
| `dist/chunks/` | **Generated** by `npm run chunks`. Never edit — paste into EVO. |
| `data/parish-facts.json` | Every parish fact, its source, and whether it is verified. |
| `content/` | Parish-authored copy, kept for reference. Already spliced into `visit.html`. |
| `design-src/` | Archive of the original Claude Design import. No longer an input. |
| `tools/archive/` | The retired renderer. Do not run it — see its README. |

The **only** generated thing left is `dist/chunks/`. `npm run dev` keeps it in
step automatically; `npm run lint` fails if it has drifted.

---

## The rules that must not break

These are not style preferences. Each one exists because breaking it corrupts
the CMS import, breaks the live parish template, or publishes something that
should not be published. `npm run lint` enforces all of them, and CI runs it on
every push and pull request.

| Rule | Why |
|---|---|
| No `[[ ]]`, `[! !]`, `{{ }}`, `[* *]`, `[( )]`, `[~ ~]`, `[+ +]` in content | Evolution CMS interprets these and silently eats the surrounding markup |
| Every reusable block wrapped in `<!-- CHUNK:ntgocName -->` … `<!-- /CHUNK:ntgocName -->` | These delimiters are how the EVO chunks get extracted |
| A shared chunk (header, footer) must be byte-identical on every page | Otherwise the import silently takes one page's copy for the whole site |
| Every custom class prefixed `ntgoc-` | The live site runs Bootstrap 4.1.3; anything unprefixed can collide |
| No CSS reset and no bare element selectors in `components.css` | A reset pasted into EVO breaks the surrounding parish template |
| Image URLs in `components.css` are `../img/…` | URLs in a stylesheet resolve against the stylesheet, not the page |
| `noindex` + draft banner on every page, `robots.txt` disallowing all | This must never compete with the real parish site or be mistaken for it |
| No Open Graph tags | A shared link must not render a convincing preview card |
| One `<h1>` per page, no skipped heading levels | Accessibility floor |
| Unverified parish facts tagged `<!-- TODO: verify -->` | Never assert a service time or a name we cannot source |

Two further checks run in CI and are worth running locally before a big change:

```sh
npm run snap           # layout + colour regression (the only check that sees layout)
npm run audit:a11y     # axe-core, WCAG 2.1 AA, 17 pages x 2 viewports
npm run audit:reflow   # 320px reflow + focus indicators
npm run check          # all of the above
npm run links          # outbound links still resolve (monthly in CI, never gates)
```

### `npm run snap` — the one that sees layout

`lint` and `axe` check structure and semantics. Neither notices a collapsed
grid or a hero pushed off-screen, which is the breakage nobody spots in a diff.
`snap` records the geometry and key computed styles of every element and
compares them against `tests/layout-baseline.json`.

It records a fingerprint, not pixels — font rendering differs between a laptop
and a CI runner, so pixel baselines would fail constantly. Keys exclude the
class name, so a pure rename can be *proved* cosmetic: the 28-class rename was
verified as 0 changes across 3616 elements.

If a layout change is intended: `npm run snap -- --update`, then commit the
baseline in the same commit as the change that caused it.

### About the TODO markers

There are 30-odd `<!-- TODO: verify -->` comments in the pages. They are
invisible to visitors and they are **the point of this project** — each one
marks a claim nobody has confirmed. Do not delete one unless you have actually
verified the fact; when you do, record the source in `data/parish-facts.json`.
`IMPORT.md` lists what is still outstanding.

---

## Two tools that save you from the two worst chores

### Editing the header, nav or footer — `npm run shell`

Those four blocks (`ntgocDraftBanner`, `ntgocTopBar`, `ntgocSiteHeader`,
`ntgocSiteFooter`) are the same markup on all seventeen pages — about a third of
all the HTML here. Edit them **once, in one page**, then propagate:

```sh
npm run shell                      # from index.html to the other sixteen
npm run shell -- --from visit.html # if you edited the shell there instead
npm run shell -- --check           # report drift, change nothing (CI runs this)
```

It handles the one thing you cannot copy verbatim: `aria-current="page"` marks
the link to the page you are on, so it is stripped from the source and
re-applied per page. Do not hand-copy the shell between files — CI fails the
moment one page disagrees with the rest.

### Naming CSS classes

```
ntgoc-<block>[__<element>][--<modifier>]
```

Every part lowercase kebab-case. `npm run lint` rejects anything else, and
`npm run rename` refuses to create it.

| | Example |
|---|---|
| Block | `.ntgoc-accordion`, `.ntgoc-footer`, `.ntgoc-parish-life-hero` |
| Element of a block | `.ntgoc-accordion__summary`, `.ntgoc-footer__address` |
| Variant of either | `.ntgoc-photoslot--dark`, `.ntgoc-band--dark` |

Two further rules, both from mistakes this repo actually made:

- **Spell the area out.** `ntgoc-parish-life-hero`, never `ntgoc-pl-hero`. The
  abbreviated prefix ran alongside the spelled-out ones for a while and produced
  `ntgoc-pl-kicker` and `ntgoc-page-eyebrow` as two names for one identical rule.
  Lint warns on abbreviated prefixes.
- **No bare numeric suffixes.** `ntgoc-clergy-body-muted` tells you what it is;
  `ntgoc-clergy-text-6` does not, and six of those in one block is a sign the
  rules should be merged. A handful survive from an automated pass; replace one
  whenever you touch it.

Before adding a class, check whether an existing one already does the job —
`npm run lint` warns when two classes end up with identical rules and tells you
the exact `--merge` command.

### Changing a service time or posting a notice — `npm run parish`

The parish calendar and the parish announcements live in two JSON files and are
rendered into the pages:

```sh
npm run parish                    # rebuild, re-extract chunks, lint
npm run parish -- --check         # what is stale? change nothing
npm run parish -- --today 2026-09-06   # render as if it were another day
```

| Edit this | To change |
|---|---|
| `data/parish-calendar.json` | the month grid on Calendar, "This week at Nativity" on For Our Parish, and "The next few weeks" on Parish Life |
| `data/parish-announcements.json` | the announcement cards on For Our Parish, urgent ones included |

It only ever rewrites what is between `<!-- BUILD:name -->` and
`<!-- /BUILD:name -->`, and refuses to run if a marker is missing. Everything
else on those pages is hand-edited source as usual. **Do not edit inside the
markers** — the next build overwrites it.

This exists because the same list of services was written out by hand in three
places, and two of them had quietly gone wrong: Parish Life showed the Sunday
Liturgy at 9:00 a.m. when the parish had confirmed 10:00, and dated 14 and 15
August to the wrong weekdays. One file, three renderings.

An event marked `"verify": true` gets a `<!-- TODO: verify -->` marker in every
one of those renderings, so an unconfirmed feast-day time cannot be laundered
into fact by being displayed three times.

Not run by CI: "upcoming" depends on today's date, so a CI check on it would
fail every morning. Run it when you change either file, and before you publish.

### Renaming a class — `npm run rename`

Every class now has a descriptive name; the `.ntgoc-s504123` content hashes
left over from the generated era are gone.

```sh
npm run rename -- --suggest              # any hashes that creep back in
npm run rename -- --where ntgoc-card     # what does it style? which pages?
npm run rename -- ntgoc-card ntgoc-panel
npm run rename -- --from-file map.json   # batch, {"old":"new"}
npm run rename -- --merge <from> <into>  # fold a duplicate into an existing class
```

`--merge` compares *every* rule each class carries, media queries and `:hover`
included, and refuses if they differ. Matching base declarations are not enough:
merging `ntgoc-pl-section` into the Visit directions shell once shrank that
section by 48px on mobile, because only one of them had a mobile padding
override. The snapshot caught it; the merge check now prevents it.

It rewrites every page, `components.css` and the JS together, re-extracts the
chunks and runs lint, so a rename that breaks something fails immediately.

Bulk renames are safe **because `npm run snap` can prove them cosmetic** — the
338-class sweep was verified as 0 changes across 4648 elements. Run the
snapshot either side of any large rename.

> **A trap worth knowing:** `git checkout -- '*.html'` reverts the markup but
> **not** `components.css`, which leaves the two halves of a rename out of step
> and every page unstyled. `npm run lint` now catches exactly this (a class used
> in markup but defined in no stylesheet) — it was added after doing it twice.

## Editing safely

**Adding a section?** Wrap it in chunk delimiters and give it an `ntgoc`-prefixed
camelCase name:

```html
<!-- CHUNK:ntgocVisitorParking -->
<section class="ntgoc-parking">
  <h2 class="ntgoc-h3">Where to park</h2>
</section>
<!-- /CHUNK:ntgocVisitorParking -->
```

**Adding CSS?** Put it in `components.css` as a single `.ntgoc-*` class, and keep
the responsive layer at the bottom of the file last so it still wins on source
order.

**Touching the header or footer?** Edit one page and run `npm run shell` — see
above. Do not make the change seventeen times by hand; `npm run shell -- --check`
runs in CI and will fail if you miss one.

**Adding an item to the Parish Life dropdown?** One more
`<a class="ntgoc-inherit ntgoc-navgroup__item">` inside `.ntgoc-navgroup__menu`,
then `npm run shell`. The menu uses no JavaScript: it opens on `:hover` for
pointers and on `:focus-within` for keyboards. That second half only works
because the parent link sits **inside** `.ntgoc-navgroup` and **before** the
panel — focusing it is what reveals the panel, and revealing the panel is what
makes the links inside it tabbable. Move either one and the submenu silently
disappears from the tab order, which no automated check will catch. Tab to
"Parish Life" after you touch it.

**Adding a page?** Copy an existing one for the shell, and check `lint` passes:
it verifies the draft banner, `noindex`, the heading structure and the links.

---

## What changed, and why

Until 8 August 2026 the pages were **generated** from a Claude Design
import by `tools/archive/render.mjs`. Editing a page directly did nothing — the next
build erased it.

That made sense while the design was still arriving from upstream. Once the
import was complete it stopped earning its keep: every small copy change meant a
round trip through Claude Design instead of just editing the file.

So the upstream link was cut. Everything the renderer used to apply on each
build is now **baked permanently into the committed HTML and CSS** — the
contrast corrections, the verified facts, the responsive layer, the chunk
delimiters, the recovered content. Nothing was lost.

The trade is that those things are no longer re-applied automatically. That is
what `npm run lint` and CI are for: the disciplines the renderer used to
guarantee are now checked instead of regenerated.

`tools/archive/README.md` has the full before/after table, and explains how to
diff against a fresh design import if that is ever wanted again.
