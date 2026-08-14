# Find Your Place — Outreach-Strategy Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One PR that turns the site from "information about the parish" toward
"the life of the parish and how to enter it" — self-discovery pathways, a
top-level Get Involved, a Care & Support page, a Parish Directory landing, a
stronger homepage second half with the Greek Festival demoted — while keeping
every fact-discipline rule intact.

**Architecture:** Static hand-edited HTML (31 → 33 root pages), shared shell
propagated by `npm run shell`, chunks extracted for Evolution CMS import,
data-driven blocks owned by three build tools. No framework, no build step for
content. All new UI reuses the existing `ntgoc-` component vocabulary; the
existing `ntgoc-proposal` treatment is the status-state system.

**Tech stack:** vanilla HTML/CSS, tools/*.mjs (node), no dependencies for lint.

**Branch:** `find-your-place`, stacked on `ministry-subpages` (PR #50). The PR
targets base `ministry-subpages` so reviewers see only this redesign's diff.

---

## Context every implementer must hold (from the three inspection reports)

1. **Nothing has a hardcoded page list.** New root `.html` files are picked up
   automatically by lint, shell, chunks, snapshot, a11y, reflow. Consequences:
   - `npm run snap` FAILS after any page add/reorder until
     `npm run snap -- --update` + committing `tests/layout-baseline.json`
     (done ONCE, in the final integration task — intermediate tasks must NOT
     update the baseline).
   - `stale-count` lint rule FAILS on any root `.md` that says "31 pages",
     "31 .html files", "N chunks", or "31 pages × 2 viewports = 62" once counts
     change. Fixed in Task 8.
   - Lint itself rewrites `dist/chunks/` — commit the regenerated chunks with
     each task's commit or CI's `git diff --exit-code dist/chunks` job fails.
2. **New page skeleton:** copy the head + four shell chunks from `index.html`
   (`ministry-goya.html` is the cleanest model): DOCTYPE, `lang="en"`, charset,
   viewport, robots noindex, `<title>… — Nativity of the Theotokos</title>`, NO
   Open Graph, **all four favicon links**, fonts preconnect + stylesheet,
   `provisional.css` then `components.css`; `<body class="ntgoc-page">`, skip
   link; chunks `ntgocDraftBanner`, `ntgocTopBar`, `ntgocSiteHeader`,
   `<main id="ntgoc-main">`, `ntgocSiteFooter`. After creating, run
   `npm run shell` so the shell is authoritative, not hand-copied.
3. **Chunk names** are `ntgocCamelCase`; every body section must be wrapped
   `<!-- CHUNK:ntgocX --> … <!-- /CHUNK:ntgocX -->` or it can never be imported
   into Evolution CMS. **CSS classes** are `ntgoc-<block>[__<element>][--<modifier>]`
   lowercase kebab, defined in `components.css`, no numeric suffixes, no
   duplicate rule shapes (lint prints a merge command if you collide).
4. **Never write the EVO-reserved openers** `[[`, `[!`, `{{`, `[*`, `[(`, `[~`,
   `[+` anywhere in content, CSS or JS.
5. **Nav edits:** edit `index.html`'s header chunk only, then `npm run shell`.
   Desktop `.ntgoc-nav` and drawer `.ntgoc-drawer__list` must carry identical
   href SETS (`nav-drawer-parity`). The drawer's `__utility` (Give) and
   `__service` blocks are outside the parity check — leave them.
6. **BUILD markers** are owned by tools: `homeUpcoming` (index),
   `nextFewWeeks` (parish-life), `thisWeek` + `announcements` (for-our-parish),
   `calendarMonth` (calendar), 12 blocks on catechumens.html + 1 per document
   page, `ministriesGrid` + 1 per ministry page. Do not hand-edit inside them;
   edit the JSON and run the tool. Content OUTSIDE markers is never touched by
   tools.
7. **Fact discipline:** no invented parish facts; unsourced claims get
   `<!-- TODO: verify -->` + an entry in `data/parish-facts.json`; proposals
   carry the visible `ntgoc-proposal` treatment; corrections add the old
   wording to `canonical.forbidden` in `data/site.json`. A null link in
   `data/site.json → links` renders as a labelled inert placeholder, never a
   bare `href="#"`.
8. **Dead-link rule:** you cannot link to a page before its file exists — hence
   new pages are created (Tasks 2–3) before the nav references them (Task 4).
9. **Verification commands:** `npm run lint` (fast, no deps) after every task;
   the full gate before the PR is `npm run check` PLUS `npm run shell -- --check`
   PLUS `git diff --exit-code -- dist/chunks` (CI runs the latter two; local
   `check` runs catechumens/ministries `--check` which CI doesn't).

## Decisions locked by the lead (do not re-litigate in sub-tasks)

**D1 — Navigation.** Top level becomes: Our Faith · Parish Life · Get Involved ·
Calendar · Events · About · [Plan a visit]. Contact moves under About. Full
markup in Task 4.

**D2 — A/B mechanism.** Control = `main` (the deployed GitHub Pages site and the
base of PR #50). Variant = this branch. No duplicated pages, no flags: a static
hand-portable-HTML repo cannot flag its nav per-visitor, and a `variant/` copy
of 33 pages would violate the one-URL-one-document rule and double every future
edit. Reviewers compare the live site against `npm run dev` on this branch (or
the PR file view). The PR description carries exact side-by-side journey
instructions. This is the least invasive mechanism the repository supports.

**D3 — Status states.** The existing `ntgoc-proposal` block + `ntgoc-proposal__tag`
IS the design system. Vocabulary: no badge = current parish practice;
`Proposed — …` = outreach-plan idea; `Example — not a real notice` = demo
content; `Pending parish approval` / `To be confirmed by the parish` = needs
Fr. John / Council. "Coming soon" is deliberately unused (nothing is approved
but unlaunched). Task 8 documents this in CLAUDE.md. No new badge CSS unless a
tag must sit inline outside a proposal box — then add modifier classes on
`ntgoc-proposal__tag`.

**D4 — Care & Support.** New `care.html` becomes the canonical care page. The
two care chunks on get-involved.html (`ntgocGetInvolvedCare`,
`ntgocGetInvolvedAsk`) MOVE there (renamed `ntgocCareHelp`, `ntgocCareAsk`);
get-involved keeps its "Care for one another" pathway card but it now routes to
`care.html`. No second copy of care content anywhere.

**D5 — Directory.** New `directory.html` is a Proposed landing: what an opt-in,
members-only directory would be; privacy principles; integration point for an
established parish-management system. NO member data, NO shared-password
model, NO fake login. Registered in `data/site.json → proposed.items`.

**D6 — Homepage "This Week".** No fake announcements. The homepage gains the
`announcements` BUILD region (extend `tools/build-parish.mjs` REGIONS to
render the same `data/parish-announcements.json` into index.html), plus a
static `ntgoc-proposal` block naming the card types the section is built to
carry (service · volunteer need · flowers · meal support · class · family
activity). Empty data renders an honest empty state, exactly as
for-our-parish.html handles it.

**D7 — Ministries split.** `ministries.html`'s generated grid stays untouched.
A hand-written "Ways to serve" section is added OUTSIDE the BUILD markers,
routing to get-involved.html's anchors — ministries & organizations vs ways to
serve become two visibly different models on one page. No duplicated rosters.

**D8 — Audit findings to fix in this PR** (from the content audit):
bookstore ordering flow gets the Proposed treatment + a `canonical.forbidden`
entry for the reinstated narthex wording; the homepage festival carousel loses
its unsourced specifics; the Sunday School "registration" link label in
`data/ministries.json` is de-claimed. `festival.html` (orphaned) is out of
scope — noted in the PR.

---

### Task 1: Content-accuracy fixes (bookstore, ministries register)

**Files:**
- Modify: `bookstore.html` (ordering-flow region, ~lines 140–160 and the
  Reserve/In-stock labels' intro)
- Modify: `data/site.json` (`canonical.forbidden`)
- Modify: `data/ministries.json` (Sunday School `links` + `needs`)
- Regenerated: `ministry-sunday-school.html`, `MINISTRIES-FOR-THE-PARISH.md`,
  `dist/chunks/`

- [ ] **Step 1:** In `bookstore.html`, wrap the reserve-and-collect flow
  ("Order here and collect…", the numbered 1-2-3 steps, and the sentence
  introducing the Reserve controls) in the existing proposal treatment:
  a `ntgoc-proposal` container (or apply `ntgoc-proposal__tag` labelled
  `Proposed — no ordering system yet` at the head of that block if a full box
  fights the catalogue layout — match the page's own look). The copy must stop
  asserting "We set it aside and email you a confirmation" as current practice —
  rephrase inside the proposal as what the parish COULD offer. Remove
  ", in the narthex" from step 3 (the fact note says the table's location is
  unsourced and was already removed once). Leave the 15 inert `Reserve`
  controls and `In stock` labels in place but ensure the section they sit in is
  inside/under the proposal framing. Also fix `bookstore.html:556` "Most
  Orthodox titles can be ordered in within a week or two." — unsourced: either
  move inside the proposal or add `<!-- TODO: verify -->`.
- [ ] **Step 2:** Add to `data/site.json → canonical.forbidden`:
  ```json
  {
    "pattern": "bookstore table[^.]{0,60}narthex",
    "why": "The bookstore table's location is not sourced. The 'in the narthex' claim was removed once (see parish-facts.json → bookstore note) and crept back; this closes the door."
  }
  ```
- [ ] **Step 3:** In `data/ministries.json`, find the Sunday School entry's
  `links` array. Change the label "Sunday School registration, on the parish
  website" to "Sunday School on the parish website" (the URL is unverified as a
  registration page — goarch.org blocks fetches, and the register's own `needs`
  says enrolment is unknown). Append to that ministry's `needs`: whether the
  parish-site Sunday School page actually carries registration, so the old
  label can return if confirmed.
- [ ] **Step 4:** Run `npm run ministries` (regenerates the ministry page +
  MINISTRIES-FOR-THE-PARISH.md), then `npm run lint`. Expect: PASS (same 3
  unused-class warnings as baseline).
- [ ] **Step 5:** Commit everything including `dist/chunks/`:
  `git commit -m "The bookstore stops claiming an ordering service it does not have"`

### Task 2: Create care.html (Care & Support)

**Files:**
- Create: `care.html`
- Modify: `get-involved.html` (remove the two care chunks; retarget the
  "Care for one another" pathway card to `care.html`)
- Modify: `assets/css/components.css` (only if a new class is genuinely needed)

- [ ] **Step 1:** Read `get-involved.html`'s `ntgocGetInvolvedCare` and
  `ntgocGetInvolvedAsk` chunks in full, including their HTML comments (they
  carry the privacy reasoning) and every `Proposed` tag and TODO marker.
- [ ] **Step 2:** Create `care.html` with the standard skeleton (context §2).
  Title: `Care & Support — Nativity of the Theotokos`. Body chunks:
  - `ntgocCareHero` — h1 "Care & Support", lede establishing the symmetric
    idea: the parish looks after its own, and there are two doors —
    "I'd like to help" and "My family could use some help" — of equal dignity.
    Two anchor CTAs, one per door. No new facts.
  - `ntgocCareHelp` — the MOVED content of `ntgocGetInvolvedCare` (meal train
    etc.), headings adjusted so the page reads as its own (one h1, h2s below),
    keeping every `Proposed` label and null-link placeholder exactly as the
    site.json `links` discipline requires (`mealTrain` is null).
  - `ntgocCareAsk` — the MOVED content of `ntgocGetInvolvedAsk` ("How can our
    parish family help?"), keeping the private-request framing: requests go to
    a person (the office route), never to a public page; nothing is
    transmitted by the demo form. `mealSupportRequest` stays null/inert.
  - `ntgocCareClosing` — short: nobody has to know whom to ask; the office
    route (`data/site.json → contact.priestRoute` wording) and a link back to
    `get-involved.html` and `parish-life.html`.
  Class reuse first: the moved chunks bring their classes with them; the hero
  uses the same hero classes as get-involved.html's.
- [ ] **Step 3:** In `get-involved.html`: delete the two moved chunks; in the
  `ntgocGetInvolvedPathways` chooser, retarget the "Care for one another" card
  from `#ntgoc-care` (in-page) to `care.html`, wording intact. If other
  in-page anchors reference the removed sections, retarget them to `care.html`.
- [ ] **Step 4:** `npm run shell` (fills the new page's shell), then
  `npm run lint`. Expect PASS. Do NOT run snap.
- [ ] **Step 5:** Commit: `git commit -m "Care & Support becomes its own front door"`

### Task 3: Create directory.html (Parish Directory landing)

**Files:**
- Create: `directory.html`
- Modify: `data/site.json` (`proposed.items` + a null `links.parishDirectory`)

- [ ] **Step 1:** Create `directory.html`, standard skeleton. Title:
  `Parish Directory — Nativity of the Theotokos`. The ENTIRE page is a
  proposal — hero then one `ntgoc-proposal`-treated body. Chunks:
  - `ntgocDirectoryHero` — h1 "Parish Directory", lede: knowing one another by
    name is how a parish works; the parish has no published directory today
    and this page proposes one.
  - `ntgocDirectoryProposal` — inside proposal treatment, tag
    `Proposed — no directory exists yet`: what it would be (opt-in, each
    household choosing what to share), who could see it (approved parish
    members only — not the public, not this demo), and that it would live in
    an established parish-management system rather than anything built here.
    State plainly: no shared password, no member data on this site, ever.
    Mention the kinds of things a household COULD choose to share (name day,
    ministries, a skill or tradition they could teach — tying to
    traditions.html) as possibilities, not fields that exist.
  - `ntgocDirectoryContact` — until then: the parish office is the way to
    reach anyone (office contact from site.json wording; link contact.html).
  No form, no login UI, no fake "member area" link.
- [ ] **Step 2:** In `data/site.json`: add `"parishDirectory": null` to
  `links` (with the null-note discipline it inherits), and add
  `"An opt-in, members-only parish directory (directory.html)"` to
  `proposed.items`.
- [ ] **Step 3:** `npm run shell`, then `npm run lint`. Expect PASS.
- [ ] **Step 4:** Commit: `git commit -m "A doorway for a parish directory that does not yet exist"`

### Task 4: Navigation & footer rework, shell propagation

**Files:**
- Modify: `index.html` (header chunk + footer chunk), then ALL pages via
  `npm run shell`

- [ ] **Step 1:** Replace the `ntgoc-nav` contents in `index.html`'s
  `ntgocSiteHeader` chunk with exactly this structure (reusing existing
  classes; carets/menus as in the current markup):
  - **Our Faith** ▾ → `faith.html`; items: Our Faith → `faith.html`;
    For Catechumens &amp; Inquirers → `catechumens.html`
  - **Parish Life** ▾ → `parish-life.html`; items: Parish Life →
    `parish-life.html`; For Our Parish → `for-our-parish.html`;
    Care &amp; Support → `care.html`; Parish Directory → `directory.html`;
    Parish Bookstore → `bookstore.html`; The Light newsletter →
    `newsletter.html`
  - **Get Involved** ▾ → `get-involved.html`; items: Get Involved →
    `get-involved.html`; Ministries → `ministries.html`;
    Living the Traditions → `traditions.html`
  - **Calendar** → `calendar.html` (no dropdown)
  - **Events** ▾ → `events.html`; items: Events → `events.html`;
    Greek Festival → `https://www.fredgreek.org/` (external, target/rel as
    current); Hall Rental → `hall.html`
  - **About** ▾ → `about.html`; items: About the Parish → `about.html`;
    Parish Council Committees → `committees.html`; Contact → `contact.html`
  - **Plan a visit** → `visit.html` (primary button, unchanged)
- [ ] **Step 2:** Mirror the same href set in the drawer `__list` (same order
  as desktop, sub-links using `ntgoc-drawer__sub` under their group's
  `ntgoc-drawer__link`, `visit.html` staying as the `__cta`). Leave `__utility`
  (Give) and `__service` untouched. Parity rule: the SETS must match —
  desktop set is exactly {faith, catechumens, parish-life, for-our-parish,
  care, directory, bookstore, newsletter, get-involved, ministries,
  traditions, calendar, events, fredgreek.org, hall, about, committees,
  contact, visit}.
- [ ] **Step 3:** Footer, same file: in the "Parish" column add
  Care &amp; Support → `care.html` (after "Get involved") and
  Parish Directory → `directory.html` (after "For our parish"). Leave the
  rest of the footer alone.
- [ ] **Step 4:** `npm run shell` (propagates to all 33 pages; re-runs
  extract-chunks + lint itself). Then `npm run lint` to confirm. Expect PASS —
  in particular `nav-drawer-parity` and `dead-link` (both new pages exist).
- [ ] **Step 5:** Commit (33 pages + dist/chunks):
  `git commit -m "Get Involved steps up to the top of the menu"`

### Task 5: Homepage second half

**Files:**
- Modify: `index.html` (sections 4–7 area), `assets/css/components.css`,
  `tools/build-parish.mjs` (REGIONS), possibly `data/parish-announcements.json`
  (no fake notices — structural only if needed)

- [ ] **Step 1:** Read `get-involved.html`'s `ntgocGetInvolvedPathways` chunk
  and reuse its card classes for the new section if they fit a six-card grid;
  otherwise define a `ntgoc-findplace` block in `components.css` (grid +
  card + title + text classes, styled with the page's existing tokens:
  Newsreader headings, #3a1414 ink, #7d2b2b accents, hairline borders — match
  neighbouring sections, no drop shadows, no "startup" cards).
- [ ] **Step 2:** Insert new chunk `ntgocHomeFindYourPlace` AFTER
  `ntgocHomeUpcomingServices`: h2 "Find your place at Nativity", one-line
  lede ("The parish is not a building to visit but a life to enter…" — write
  in the site's plain, unhurried voice), then six cards:
  - **Worship** — services, feasts, the sacramental life → `calendar.html`
    (secondary link `visit.html`)
  - **Learn** — the faith, classes, becoming Orthodox → `faith.html`
    (secondary `catechumens.html`)
  - **Serve** — practical ways to help → `get-involved.html`
  - **Connect** — coffee hour, fellowship, one another → `parish-life.html`
  - **Care** — offer or receive practical support → `care.html`
  - **Traditions** — learn, teach, prepare, take part → `traditions.html`
  Every card is a link (whole-card anchor like `ntgoc-home-ministries-promo-link`
  does it) — a door, not a description.
- [ ] **Step 3:** Add chunk `ntgocHomeThisWeek` after Find Your Place:
  h2 "This week at Nativity". Extend `tools/build-parish.mjs`'s REGIONS table
  so `index.html` also owns an `announcements` region, and place
  `<!-- BUILD:announcements -->…<!-- /BUILD:announcements -->` inside the
  chunk (copy the container markup for-our-parish.html uses around its own
  announcements block so the same renderer output fits). Below the BUILD
  block, OUTSIDE the markers, add a compact `ntgoc-proposal` box, tag
  `Proposed — what this space is for`: one sentence each that this section is
  built to carry parish announcements and practical needs — a service note, a
  volunteer need, flowers for a feast, a meal for a household, a class — as
  the parish starts publishing them, with links to `for-our-parish.html` and
  `get-involved.html`. Run `npm run parish` and check the result renders
  sanely with the CURRENT announcement data (do not invent notices; if the
  data is empty the section must read as a deliberate shape, which the
  proposal box provides).
- [ ] **Step 4:** MOVE `ntgocHomeFestivalPromo` (the dark carousel band) to
  after `ntgocHomeMinistriesPromo`, so the order becomes: Hero · ServiceTimes ·
  Welcome · UpcomingServices · **FindYourPlace** · **ThisWeek** ·
  MinistriesPromo ("The life of the parish") · FestivalPromo · ForOurParish.
  While touching the carousel, fix the audit finding in the festival slide:
  drop the unsourced specifics ("Every autumn", "Three days of food, music and
  dancing", "open for tours all weekend") in favour of what is sourced — the
  parish runs a Greek Festival, it is open to the whole city, many neighbours
  first walk through the doors there, details at fredgreek.org. Keep the
  slide, the emblem, and both links.
- [ ] **Step 5:** `npm run lint`. Expect PASS. (Snap will change — that is
  Task 9's single update.)
- [ ] **Step 6:** Commit:
  `git commit -m "The homepage's second half: find your place, then this week"`

### Task 6: Parish Life doors + Stay Connected surfacing

**Files:**
- Modify: `parish-life.html`, `assets/css/components.css` (reuse Task 5's
  card classes — do NOT define a near-duplicate; lint's duplicate-rule warning
  is the tripwire)

- [ ] **Step 1:** Insert a new chunk `ntgocParishLifeDoors` directly after the
  hero: h2 in the page's voice (e.g. "Doors into this life"), six door-cards —
  Learn → `faith.html` + the page's own Learning &amp; Formation section
  anchor; Serve → `get-involved.html`; Connect → the page's own Fellowship
  section anchor; Care → `care.html`; Celebrate → `calendar.html` + the
  Worship &amp; Feast Days anchor; Share / Teach → `traditions.html#ntgoc-traditions-teach`.
  A reader must be able to act on intent without knowing which committee owns
  what — the doors sit above the descriptive sections, which remain.
- [ ] **Step 2:** In the page's closing chunk (`ntgocParishLifeNext`), add a
  quiet Stay Connected row: The Light → `newsletter.html`, the calendar, and
  contact — one line, not a band.
- [ ] **Step 3:** Add `id` anchors to the Fellowship / Formation / Worship
  sections if they lack them (grammar-conformant ids).
- [ ] **Step 4:** `npm run lint`; expect PASS. Commit:
  `git commit -m "Parish Life opens with doors, not descriptions"`

### Task 7: Get Involved capacity lens · Ministries "Ways to serve" · Traditions outbound

**Files:**
- Modify: `get-involved.html`, `ministries.html` (outside BUILD markers only),
  `traditions.html`, `newsletter.html`, `calendar.html`

- [ ] **Step 1 (get-involved):** Inside/beside the `ntgocGetInvolvedPathways`
  chooser add a second, capacity-based lens — a compact row titled "However
  much time you have": *A few minutes* → the coffee-hour/bring-something
  anchor; *Now and then* → Prepare &amp; beautify; *Regularly* → Serve the
  parish; *I'd like to learn* → Learn the traditions; *I could teach* →
  `traditions.html#ntgoc-traditions-teach`; *I want to help someone* →
  `care.html`. Reuse existing link-row classes; this is one row of six links,
  not a second card grid. Keep "There is a place for you here." exactly as is.
- [ ] **Step 2 (ministries):** After the closing `/BUILD:ministriesGrid`
  marker (verify position — outside the markers), add a hand-written chunk
  section "Ways to serve" (within the page's existing body chunk or a new
  `ntgocMinistriesWays` chunk): two or three sentences — not everything in
  parish life is an organisation with a roster; flowers, coffee hour, meals,
  prosphora, festival help are ways anyone serves without joining anything —
  followed by links to `get-involved.html`'s section anchors. No rosters, no
  duplicated descriptions.
- [ ] **Step 3 (traditions):** The page is terminal — add onward routes in its
  closing chunk: Get Involved, Care &amp; Support, the calendar. Also add one
  line + link under the prosphora-adjacent theme pointing at
  `get-involved.html`'s prosphora section so the two treatments reference each
  other instead of drifting.
- [ ] **Step 4 (newsletter):** Add a short "Receive The Light" block: today
  the route is the parish office / `newsletter@ntgoc.org` (both already
  public in site.json); the self-serve sign-up remains on the proposed list —
  render it as a labelled proposed placeholder consistent with
  welcome.html's, NOT a live form, and do not duplicate welcome.html's copy.
- [ ] **Step 5 (calendar):** Un-dead-end it: a single quiet row under the
  month grid — Events → `events.html`, This week for the parish →
  `for-our-parish.html`, Plan a visit → `visit.html`.
- [ ] **Step 6:** `npm run lint`; expect PASS. Commit:
  `git commit -m "Serving by capacity, and pages that lead somewhere"`

### Task 8: CLAUDE.md principles + doc-count sweep

**Files:**
- Modify: `CLAUDE.md`, `README.md` / `CONTRIBUTING.md` / `ACCESSIBILITY.md` /
  `IMPORT.md` (wherever stale counts live), `data/site.json` if any wording
  needs a forbidden entry

- [ ] **Step 1:** Add to CLAUDE.md, after the Tone section, a section titled
  `## Product & content principles (the Find Your Place strategy)` containing,
  in this repo's voice: the six page questions (What is this / Why does it
  matter / Can I participate / How / Who can help / What next — a page that
  only says "the parish has X" is incomplete); the journey rule (Discover →
  Understand → Connect → Participate → Serve or Receive Care → Teach); the
  self-discovery rule (route by intent — Learn, Serve, Connect, Care,
  Celebrate, Share — never require knowing which committee owns a thing); the
  relationship rule (the site connects people to people; it must never feel
  like it IS the community); the Orthodox identity rule (explain terms, never
  flatten them); the action rule (every described opportunity carries a real
  next step where one exists, and a labelled placeholder where it does not —
  see `links` nulls in data/site.json); the care rule (help offered and help
  needed are symmetric doors; requests for help are private, never a public
  page); the mobile rule (QR/phone arrivals are the norm — 320px reflow and
  the drawer are gating); the source-of-truth rule (this site is canonical;
  newsletter and social point INTO it, and no content is restated in a second
  place); and the status-state vocabulary from decision D3.
- [ ] **Step 2:** Update the same file's structural facts: 33 pages, the new
  nav shape, care.html/directory.html existence, the extended build-parish
  REGIONS (index.html now carries `announcements`), and remove/adjust the
  hardcoded "88 markers" figure to whatever `npm run lint` now reports (or
  drop the number in favour of "lint prints the count").
- [ ] **Step 3:** Grep ALL root `.md` files for `31` / `62` / chunk counts and
  fix every stale figure (`stale-count` enforces this; run `npm run lint` to
  find stragglers).
- [ ] **Step 4:** `npm run lint`; expect PASS. Commit:
  `git commit -m "The strategy, written down where the next agent will read it"`

### Task 9: Integration review, full verification, PR

**Files:** none new — fixes only; `tests/layout-baseline.json`

- [ ] **Step 1:** Dispatch a fresh integration-review subagent over every
  changed page with the twelve final review questions (purpose, primary user,
  why it matters, obvious next step, insider knowledge, person-connection,
  proposal-as-fact, duplication, invented pastoral content, mobile, still
  unmistakably Nativity, parish life before traffic). It reports; the lead
  applies fixes.
- [ ] **Step 2:** `npm install` if needed, then the full gate, in order:
  `npm run lint` → `npm run snap -- --update` (ONCE; review the printed diff —
  every change must be explainable by this PR's edits, and any colour change
  is suspect) → `npm run check` → `npm run shell -- --check` →
  `git diff --exit-code -- dist/chunks` (should be clean because each task
  committed regenerated chunks) → `git status` clean apart from intended.
- [ ] **Step 3:** Commit baseline + any review fixes:
  `git commit -m "One baseline for the new shape of the site"`
- [ ] **Step 4:** Push `find-your-place`; open ONE PR, base `ministry-subpages`,
  titled "Find your place: the outreach strategy, as one coherent change" with
  the full description (Why / Strategic principles / What changed / Control vs
  Variant per D2 / Intentionally NOT implemented / Parish approval checklist /
  Testing). Do NOT merge. Body ends with the standard generated-with footer.

---

## Self-review notes

- Spec coverage: nav (T4), homepage (T5), Parish Life (T6), Get Involved (T7),
  Care (T2), Traditions (T7), Offerings/Prosphora (already the repo's
  strongest section — routed to via T5/T6, untouched otherwise), Catechumens
  (already a distinct Our Faith experience with FAQ + resource centre — nav
  keeps it; no change needed), resource centre (exists on catechumens.html —
  no change), Directory (T3), Stay Connected (T5/T6/T7), Calendar/Events
  cleanup (T7; events.html already a thin router — no duplication to remove),
  Festival demotion (T5), status states (D3/T8), CLAUDE.md (T8), A/B (D2),
  a11y/responsive (T9 via check: axe 2 viewports + 320px reflow + keyboard
  pass), audit (done pre-plan; fixes in T1/T5), TODO documentation (PR body).
- Deliberately NOT done, to state in the PR: real signup integrations (all
  `links` nulls stay null), authenticated directory, sacramental content
  (checklist pages stay pending Fr. John), newsletter backend, festival.html
  rehabilitation, Welcome Ministry naming, any new parish fact.
