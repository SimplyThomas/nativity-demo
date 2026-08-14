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

**The 32 `.html` files at the repo root are SOURCE. Edit them directly.**

They were *generated* from a Claude Design import until 8 August 2026. That
upstream was cut. But 10 of 26 commit messages still say "generated", and
`design-src/` and `tools/archive/` document the old model. If you infer the
workflow from git history or those folders, you will get it backwards.

**Never run `tools/archive/render.mjs`.** It regenerates every page it knows and
`components.css` from the retired design file and would destroy every hand edit
since the switch. It is archived so that running it is deliberate, not
accidental.

The only wholly generated artefact is `dist/chunks/` (`npm run chunks`). The
one other thing a tool writes is the markup between `<!-- BUILD:… -->` markers
inside the pages, which three data files own — see below.

---

## Commands

```sh
npm run dev      # localhost:4000, re-extracts chunks on save
npm run lint     # the hardline rules — run before claiming anything is done
npm run check    # lint + accessibility + reflow (what CI runs)
npm run shell    # propagate header/footer to all 32 pages
npm run rename   # rename a CSS class everywhere; --suggest, --where
npm run chunks   # regenerate dist/chunks/
npm run parish   # render the calendar + announcements into the pages
npm run catechumens # render the catechumen questions, resources and documents
npm run ministries  # render the ministry cards and the eight ministry pages
npm run snap     # layout/colour regression vs tests/layout-baseline.json
npm run links    # do the outbound links still resolve? (monthly in CI)
npm run measure:hero # hero text contrast over the photograph (not in CI)
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

### The three things that ARE generated from data

`npm run parish` renders `data/parish-calendar.json` and
`data/parish-announcements.json` into the blocks marked
`<!-- BUILD:name -->` … `<!-- /BUILD:name -->` on `calendar.html`,
`parish-life.html`, `for-our-parish.html` and `index.html`. It touches nothing
outside those markers, and it is not the retired renderer — it owns five
blocks, not twelve files.

Edit the JSON, not the markup between the markers. The same list of services
used to be hand-written into four pages, and the copies had drifted: 14 and 15
August were dated to the wrong weekdays on Parish Life, and index.html was
leading with a date already two days in the past. That is what this exists to
stop. It is deliberately **not** gated by CI: "upcoming" depends on today's
date, so a CI check would fail every morning.

`npm run catechumens` does the same job for `catechumens.html` and its three
document pages. It reads two files:

- `data/catechumen-faq.json` → the question cards, and `QUESTIONS-FOR-FR-JOHN.md`
- `data/catechumen-resources.json` → the resource cards, the body of each
  document page, and `DOCUMENTS-FOR-FR-JOHN.md`

Add a question or a document by adding an entry to the JSON — never by writing
a card into the markup, which is how one question ends up on the page twice in
two wordings.

Rules the tool enforces, which are the point of the page rather than
housekeeping:

- An answer must record its `source`; a question without one must say
  `"pending": true`, which ships the card with *Content needed from Fr. John*
  on its face. There is no third state where a plausible answer appears with
  nobody behind it.
- **A document lives at exactly one URL, and one URL holds exactly one
  document.** Two register entries claiming the same page is an error. Nothing
  else on this site restates a document — other pages link to it.
- A document's `lastUpdated` is stamped onto its card *and* onto the document
  itself from the same entry, so the two cannot disagree. `published` with no
  date is an error.
- Anything about Baptism, Chrismation, Confession, Communion, fasting,
  godparent eligibility or reception is `governance: "pastoral"`. Filling in
  its requirements without an `approvedBy` is an error — the site distributes
  Fr. John's guidance, it does not author guidance for him.

There are no PDFs anywhere in this project, deliberately: a PDF is a second
copy, and a second copy is what goes stale in a downloads folder while the
website says something else. The document pages print as the document (see the
`@media print` rules at the foot of `components.css`), so the printable version
and the web version are the same file.

Unlike the calendar this output does not depend on today's date, so it **is**
gated: `npm run check` runs `npm run catechumens -- --check`.

`npm run ministries` does the same job for the ministries. It reads one file:

- `data/ministries.json` → the card grid on `ministries.html`, the body of each
  of the eight `ministry-*.html` pages, and `MINISTRIES-FOR-THE-PARISH.md`

Add a ministry by adding an entry to the JSON — never by writing a card into
the markup. A ministry page is mostly a roster and a contact route, and those
are exactly the things that end up at two URLs saying two different things: the
Philoptochos board was published on the ministries grid, and a page that
"introduces the society" would have made a second copy of a list that changes
every time somebody stands down.

Rules the tool enforces, which are the point of the pages rather than
housekeeping:

- **A person renders only with both a `source` and a `permission`.** `source`
  says where the pairing of this person with this ministry came from;
  `permission` names the recorded approval that allows publishing the name at
  all. Missing either is an error, not a silent omission. JOY, AHEPA and the
  Choir have no names anybody has approved, so their pages say on their face
  that the parish has not published who leads them.
- **Titles are not invented.** `role` may only carry a title the source
  actually gives, and the parish newsletter gives an explicit title to almost
  nobody — everywhere else it prints an organisation heading and a bare name.
  `role: null` renders the bare name. Nobody becomes a director, chair,
  coordinator or lead who was not called one in the source.
- **A `photos` entry is a hint, not a file.** It describes what a photograph
  would show and renders an empty frame. The roster approval covers no
  photograph, so an entry that ever gains a `file` is refused until a
  `permission` sits beside it.
- **One ministry, one page**, as in the catechumen register. Two entries
  claiming the same page is an error, which is why the Parish Council's page
  links to the roster on `about.html` rather than restating it.

Each ministry page also carries a hand-written region **outside** the `BUILD:`
markers, for whatever a ministry sends that no schema anticipated; the tool
never reads or rewrites it. A roster or a contact route does **not** go there —
those come from `data/ministries.json` and `data/site.json`, and a second copy
is what goes stale while the register says something else.

Like the catechumen build and unlike the calendar, this output does not depend
on today's date, so it **is** gated: `npm run check` runs
`npm run ministries -- --check`.

`data/site.json` is the other half of the same idea, from the opposite
direction: it lists what a page must NOT say, and lint fails when one says it.
Use that for a fact stated in prose, and these for a list rendered from data.

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
   `<!-- TODO: verify -->` and an entry in `data/parish-facts.json`. 88 markers
   exist; they are the point of the project, not clutter.
3. **Never publish a parishioner's name or face without recorded permission.**
   The names that do appear — the Council roster, the Philoptochos board and
   the lead names on the ministries grid and pages — stand on the Parish
   Council's approval of 2026-08-13,
   recorded in `data/parish-facts.json` → `_rosterPermission`, which covers
   names and offices and **no** photograph. The greeter row and every ministry
   photograph therefore ship as empty frames, deliberately. Fr. John's personal
   mobile is on the live site and is deliberately *not* here.
4. **Every page keeps `noindex`, the draft banner, and no Open Graph tags.**
5. **Class names follow one convention**, enforced by lint:
   `ntgoc-<block>[__<element>][--<modifier>]`, every part lowercase kebab-case —
   `ntgoc-accordion__summary`, `ntgoc-photoslot--dark`, `ntgoc-page-hero__scrim`.
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
0 axe violations across 32 pages × 2 viewports, reflow 32/32 at 320px.

---

## Where to read more

| Question | File |
|---|---|
| How do I make a change safely? | `CONTRIBUTING.md` |
| How does a volunteer import this into EVO? | `IMPORT.md` |
| What is verified, corrected, or withheld? | `data/parish-facts.json` |
| What is the catechumen page still waiting on? | `QUESTIONS-FOR-FR-JOHN.md` |
| Which documents is Fr. John still to write? | `DOCUMENTS-FOR-FR-JOHN.md` |
| What is each ministry still to tell us? | `MINISTRIES-FOR-THE-PARISH.md` |
| What must every page agree on? | `data/site.json` |
| What was the accessibility work? | `ACCESSIBILITY.md` |
| What did the old renderer guarantee? | `tools/archive/README.md` |
| How do I run a real EVO and test an import? | `tools/evo-sandbox/README.md` |
| How do we confirm the parish's CMS version and chunk processor? | `EVO-CHECKS.md` |

## Tone

The audience is a parish council and, eventually, first-time visitors to an
Orthodox church. Copy is plain, warm and unhurried. Do not add marketing
language, exclamation marks, or claims about the parish that nobody has
confirmed.
