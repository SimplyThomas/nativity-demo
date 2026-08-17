# Ministry sub-pages

**Date:** 2026-08-13
**Status:** approved, awaiting implementation

## The problem

`ministries.html` lists eight ministries as cards in a grid. Each card carries a
category, a one-line description, and — for four of them — the name the parish
lists for that ministry. There is nowhere to say more.

The parish wants more: who is on a ministry team, what the ministry actually
does, photographs, and how somebody joins.

## What we do not have

This shapes the whole design, so it comes before the design.

Almost none of that content exists in sourced form.

- On 2026-08-09 the ministry descriptions were deliberately **stripped** of
  meeting frequencies, grade ranges, basketball, retreats, the Metropolis summer
  camp, named charitable programmes and term dates, because none of it was
  sourced. `data/parish-facts.json → ministries.note` records the reasoning:
  "accurate and brief beats polished and invented."
- The live parish site's `/parish-ministries/` page carries **no names at all**,
  checked 2026-08-13. The four names on our grid come from the parish
  newsletter, relayed by the volunteer maintaining this repo.
- The Parish Council's 2026-08-13 approval covers twenty-one names and their
  offices. `_rosterPermission` states plainly what it does not cover, and item
  (3) is **any photograph**. Nobody's face is published by that approval.

So a ministry sub-page is, on day one, mostly a container for content the parish
has not supplied. That is not a reason to skip it. It is the same situation
`catechumens.html` was built for, and the same answer applies: ship the
structure, mark every gap on its face, and generate the list of what to ask for.

## Decisions

| Question | Decision |
|---|---|
| What are the pages on day one? | Structured asks, like the catechumen documents |
| Photographs | Empty `ntgoc-photoslot` frames only, with a hint of the subject |
| Which ministries | All eight, uniformly |
| "Get involved" route | The parish office, plus a name to ask for where the newsletter gives one |
| Architecture | Generated spine from a register, plus one hand-authored region per page |
| Navigation | Not in the menu; reached from the grid, with a breadcrumb back |

## Architecture

### 1. The register — `data/ministries.json`

One entry per ministry:

```jsonc
{
  "id": "sunday-school",
  "page": "ministry-sunday-school.html",
  "build": "ministrySundaySchool",   // BUILD marker name on that page
  "chunk": "ntgocMinistrySundaySchool",
  "title": "Sunday School",
  "eyebrow": "Youth",
  "card": "Classes for the children of the parish during the school year…",
  "cardSource": "data/parish-facts.json → ministries",
  "status": "awaiting",              // awaiting | partial | current
  "team": [
    {
      "name": "Michael Euripides",
      "role": null,                  // null renders a bare name — see below
      "source": "parishOrganizations",
      "permission": "_rosterPermission"
    }
  ],
  "photos": [{ "hint": "A Sunday School class in the hall" }],
  "involve": { "contact": "office", "askFor": "Michael Euripides" },
  "links": [{ "label": "Sunday School registration, on the parish website",
              "href": "https://www.nativity.va.goarch.org/parish-ministries/sunday-school" }],
  "needs": "What ages the classes cover, when they meet, how a family enrols, and who else teaches."
}
```

**`needs` is never rendered to the website.** It is what
`MINISTRIES-FOR-THE-PARISH.md` is built from, exactly as `needs` works in
`data/catechumen-resources.json`.

### 2. Rules the build enforces

These are the point of the register rather than housekeeping. Each is an error
at `--check` time, not a silent omission.

1. **A person renders only with both `source` and `permission`.** `source` says
   where the pairing came from; `permission` names the recorded approval that
   allows publishing the name. Under the 2026-08-13 approval that publishes
   Michael Euripides, Dr. Judy Marrs, the nine Philoptochos officers and board
   members, and the nine Council members. JOY, AHEPA and the Choir have no
   names, so their pages say on their face that the parish has not published who
   leads them.
2. **Titles are not invented.** `role` may only hold a title the source gives.
   `parish-facts.json → parishOrganizations.note` is emphatic: the newsletter
   gives an explicit title to Dr. Judy Marrs (Director) and to the Council and
   Philoptochos officers, and nowhere else. `role: null` renders a bare name.
   Nobody becomes a director, chair, coordinator or lead who was not called one
   in the source.
3. **A `photos[]` entry holds a hint, not a file.** If an entry ever gains a
   `file` key, the build refuses it until a `permission` key sits beside it.
   This mirrors `_rosterPermission` item (3) and
   `assetProvenance._permissionPolicy`.
4. **One ministry, one page; one page, one ministry.** Two entries claiming the
   same `page` is an error, as in the catechumen register.
5. **A ministry with `status: "current"` and an empty `team` and no body content
   is an error** — "current" asserts that the content is in.

### 3. Eight pages, `ministry-<slug>.html`

Mirroring the existing `catechumen-` prefix:

```
ministry-sunday-school.html    ministry-dance-troupe.html
ministry-goya.html             ministry-ahepa.html
ministry-joy.html              ministry-parish-council.html
ministry-philoptochos.html     ministry-choir.html
```

Each is a **hand-created source file**. The build refuses to touch a page that
does not exist and refuses to guess if its `BUILD:` markers are missing — the
same two guards `tools/build-catechumens.mjs` already implements.

Inside each page:

- A generated spine between `<!-- BUILD:ministryX -->` markers: status notice,
  what the ministry is, the team block, photo slots, how to get involved, and
  any links.
- One hand-authored section **outside** the markers, for material a ministry
  sends that no schema anticipated. The build never touches it. `npm run lint`
  still fails it if it carries a wording forbidden by `data/site.json`.
- The whole body wrapped in `<!-- CHUNK:ntgocMinistryX -->`, per rule 6.
- A breadcrumb back to `ministries.html`.

### 4. The Philoptochos move

`ntgocPhiloptochosBoard` leaves `ministries.html` for
`ministry-philoptochos.html`, rendered from the register, so the nine-person
roster stays at exactly one URL.

This **obliges** an edit to `data/parish-facts.json`. Two entries name
`ministries.html` as the place those names live:

- `philoptochosBoard.pages`
- the "TO REVERSE" list inside `_rosterPermission`, which names "the
  `ntgocPhiloptochosBoard` chunk and the four lead lines on ministries.html"

That list is the documented path for removing somebody's name on request.
Leaving it stale would break it. Correcting both is part of this work, not
follow-up.

### 5. The Parish Council page forwards

`ministry-parish-council.html` describes the Council and links to `about.html`
for the roster and `committees.html` for the committees. It restates neither.
Its team block says where the roster is rather than reproducing nine names at a
second URL.

### 6. The grid

The card grid on `ministries.html` becomes a `BUILD:ministriesGrid` block
rendered from the register. Each card gains a link to its sub-page. The ninth
cell — "Register your family" — is not a ministry and stays as hand-written
markup outside the block; `parish-facts.json` notes the grid is "three columns
and nine cells exactly", and that stays true.

### 7. `MINISTRIES-FOR-THE-PARISH.md`

Built from every `needs` field, grouped by ministry. The counterpart to
`QUESTIONS-FOR-FR-JOHN.md` and `DOCUMENTS-FOR-FR-JOHN.md`, addressed to ministry
leads rather than to Fr. John — these are questions about what a ministry does,
which is the ministry's to answer, not the priest's.

Added to the "Where to read more" table in `CLAUDE.md`.

### 8. Commands

```
npm run ministries              # render the register into the pages
npm run ministries -- --check   # fail if the rendered output is stale
```

The `--check` form joins `npm run check`. The output does not depend on today's
date — unlike the calendar, which is why that one deliberately is not gated.

## Non-goals

- **No new navigation entries.** The Parish Life menu keeps its single
  "Ministries" item. The mobile drawer is already eighteen links deep and is
  duplicated into every page.
- **No new CSS unless a component genuinely does not exist.** Reuse
  `ntgoc-card-lg`, `ntgoc-person-card`, `ntgoc-photoslot`, `ntgoc-band` and the
  existing hero classes. Anything new goes through `npm run rename -- --suggest`
  first, because lint warns when two classes end up with identical rules.
- **No PDFs**, per the standing rule.
- **No invented content.** If a sub-page would be empty without inventing
  something, it ships saying it is waiting for the ministry.

## Verification

- `npm run lint`
- `npm run ministries -- --check`
- `npm run check` — the audits discover pages rather than hardcoding a count, so
  reflow becomes 31/31 and axe covers 31 pages × 2 viewports
- `npm run snap` — the grid gains card links and eight pages appear, so the
  baseline needs `-- --update`, and `tests/layout-baseline.json` is committed
- `npm run chunks` — eight new chunks

Expected clean state: lint passes, 0 axe violations across 31 pages × 2
viewports, reflow 31/31.
