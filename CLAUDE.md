# CLAUDE.md

Draft preview site for **Nativity of the Theotokos Greek Orthodox Church**
(Fredericksburg, VA). Unofficial — built by parish volunteers to show the Parish
Council. It must never be mistaken for the real site
(<https://www.nativity.va.goarch.org/>). Live at
<https://simplythomas.github.io/nativity-demo/>.

The end goal is not this site. It is **hand-portable blocks of HTML** a volunteer
can paste into the parish's Evolution CMS (reported 1.4.x, unconfirmed) through a
browser, with no shell access.

---

## Read this first — the history lies

**The seventeen `.html` files at the repo root are SOURCE. Edit them directly.**

They were *generated* from a Claude Design import until 8 August 2026. That
upstream was cut. But 10 of 26 commit messages still say "generated", and
`design-src/` and `tools/archive/` document the old model. If you infer the
workflow from git history or those folders, you will get it backwards.

**Never run `tools/archive/render.mjs`.** It regenerates all seventeen pages and
`components.css` from the retired design file and would destroy every hand edit
since the switch. It is archived so that running it is deliberate, not
accidental.

The only generated artefact is `dist/chunks/` (`npm run chunks`).

---

## Commands

```sh
npm run dev      # localhost:4000, re-extracts chunks on save
npm run lint     # the hardline rules — run before claiming anything is done
npm run check    # lint + accessibility + reflow (what CI runs)
npm run shell    # propagate header/footer to all 17 pages
npm run rename   # rename a CSS class everywhere; --suggest, --where
npm run chunks   # regenerate dist/chunks/
npm run snap     # layout/colour regression vs tests/layout-baseline.json
npm run links    # do the outbound links still resolve? (monthly in CI)
npm run evo:up   # a real Evolution CMS on localhost, pre-loaded with the site
npm run evo:verify  # prove the chunks still render correctly inside EVO
```

`npm run snap` is the only check that sees *layout*. You cannot look at the
page; lint and axe check structure and semantics, not whether a grid collapsed.
Run it after any CSS change. If a change is intended:
`npm run snap -- --update`, then commit `tests/layout-baseline.json`.

`npm run lint` needs no dependencies. The audits need `npm install`. The `evo:*`
commands need Docker and are **not** part of `npm run check` — CI has no Docker
daemon. They are the only way to see the chunks inside a real Evolution CMS
rather than inferring that they would work; `tools/evo-sandbox/README.md`
records the gotchas, several of which are unguessable.

---

## Rules that are not negotiable

`npm run lint` enforces these and CI gates on them. They exist because breaking
one corrupts the CMS import, breaks the live parish template, or publishes
something that should not be published.

1. **Never write `[[ ]]`, `[! !]`, `{{ }}`, `[* *]`, `[( )]`, `[~ ~]`, `[+ +]` in
   content.** Evolution CMS interprets these and silently eats the surrounding
   markup. This is unguessable and the most damaging rule to break.
2. **Never invent a parish fact.** No service times, clergy names, phone numbers,
   capacities or dates unless sourced. Unsourced claims get
   `<!-- TODO: verify -->` and an entry in `data/parish-facts.json`. ~34 markers
   exist; they are the point of the project, not clutter.
3. **Never publish a parishioner's name or face without recorded permission.**
   The Parish Council block ships with placeholders and the greeter row ships as
   empty frames, deliberately. Fr. John's personal mobile is on the live site and
   is deliberately *not* here.
4. **Every page keeps `noindex`, the draft banner, and no Open Graph tags.**
5. **Class names follow one convention**, enforced by lint:
   `ntgoc-<block>[__<element>][--<modifier>]`, every part lowercase kebab-case —
   `ntgoc-accordion__summary`, `ntgoc-photoslot--dark`, `ntgoc-parish-life-hero`.
   Spell the area out (never `ntgoc-pl-`), and no bare numeric suffixes
   (`ntgoc-clergy-body-muted`, not `ntgoc-clergy-text-6`). `components.css`
   carries no reset and no bare element selectors — the live site runs
   Bootstrap 4.1.3, and anything unscoped would restyle the parish template.
6. **Reusable blocks stay wrapped** in `<!-- CHUNK:ntgocName -->` … `<!-- /CHUNK:ntgocName -->`.
   That is the entire import mechanism.
7. **A shared fact is stated once, in `data/site.json`.** Service times, the name
   of the fellowship meal, the Divine Liturgy book, parking and accessibility all
   appear on several pages. `data/site.json` holds the agreed value plus a list of
   wordings a page must *not* carry, and lint fails on any page that carries one.
   Correcting a fact means fixing the pages **and** adding the old wording to
   `canonical.forbidden` — otherwise the next rewrite quietly reinstates it, which
   is how "complimentary prayer book" came back twice.

---

## Traps that have already caught someone

- **Editing the header/footer in one page.** They are duplicated across every
  page (a third of all HTML). Edit one, then `npm run shell`. Hand-copying
  drifts and CI fails.
- **`git checkout -- '*.html'`** reverts markup but *not* `components.css`. After
  a rename that leaves the two halves out of step and every page unstyled. Lint
  catches it now (`class-undefined`) — it was added after this happened twice.
- **Dropping a closing tag.** Browsers hide it; the extracted chunk is broken and
  that is what gets pasted into the CMS. Lint checks tag balance.
- **Editing `dist/chunks/`.** Generated. Regenerate from the pages instead.
- **Correcting a fact on the page you happen to be editing.** Every one of these
  facts is on three or four pages. Add it to `canonical.forbidden` in
  `data/site.json` and let lint find the rest.
- **Adding a class without checking for an existing one.** Lint warns when two
  classes end up with identical rules and prints the exact
  `npm run rename -- --merge` command. Merging compares media queries and
  `:hover` too — matching base declarations are not enough, and ignoring that
  once shrank the Visit directions section by 48px on mobile.

---

## Verifying

Do not claim work is complete without running `npm run lint`, and `npm run check`
for anything touching markup or CSS. Both are cheap. CI runs the same checks, so
a wrong claim surfaces within a minute anyway.

Expected clean state: lint passes, snapshot reports no layout or colour change,
0 axe violations across 17 pages × 2 viewports, reflow 17/17 at 320px.

---

## Where to read more

| Question | File |
|---|---|
| How do I make a change safely? | `CONTRIBUTING.md` |
| How does a volunteer import this into EVO? | `IMPORT.md` |
| What is verified, corrected, or withheld? | `data/parish-facts.json` |
| What must every page agree on? | `data/site.json` |
| What was the accessibility work? | `ACCESSIBILITY.md` |
| What did the old renderer guarantee? | `tools/archive/README.md` |
| How do I run a real EVO and test an import? | `tools/evo-sandbox/README.md` |

## Tone

The audience is a parish council and, eventually, first-time visitors to an
Orthodox church. Copy is plain, warm and unhurried. Do not add marketing
language, exclamation marks, or claims about the parish that nobody has
confirmed.
