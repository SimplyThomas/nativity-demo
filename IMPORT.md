# Importing this draft into the parish website (Evolution CMS)

**Who this is for:** a parish volunteer with editor access to the church's
Evolution CMS manager. No command line needed. Everything you paste is in
`dist/chunks/` — 105 plain text chunk files plus a stylesheet.

> ### Read this before anything else
>
> **Nothing gets imported without Father's review of the visitor-facing copy.**
> This draft was written by volunteers. It contains statements about worship,
> Communion, and what visitors should expect. Some of it is wrong on purpose —
> flagged, not fixed, because it is not ours to decide. See
> **[What still has to be verified](#what-still-has-to-be-verified)**.
>
> Import is also **not** a decision for one volunteer. Confirm with the Parish
> Council first, and with the Department of Internet Ministries second (see
> [Questions to ask DIM](#questions-to-ask-the-department-of-internet-ministries)).

---

## 0. The week of the import

Things in this repo go stale on their own schedule — a date renders as
"upcoming" only until it isn't. Run this checklist in the days immediately
before import, top to bottom. Every step is a command to run or a link to the
issue that owns the decision.

1. **Refresh the calendar and announcements.**
   ```sh
   npm run parish
   ```
   Commit the result. Run it a second time — it must print
   `✓ every generated block is already current`. If it doesn't, something
   touched `data/parish-calendar.json` or `data/parish-announcements.json`
   after the first run.

2. **Remove the sample announcements.** Delete the two `"sample": true`
   entries in `data/parish-announcements.json` (they render labelled
   "· sample" on `for-our-parish.html`), then re-run `npm run parish`. A real
   first announcement is the parish's to write — going live with none is
   fine, going live with samples is not.

3. **Confirm the calendar data reaches past the import date.**
   `data/parish-calendar.json` currently ends **30 August 2026** — see
   [#24](https://github.com/SimplyThomas/nativity-demo/issues/24). Extend it,
   or accept that "This week at Nativity" and "The next few weeks" render
   their empty state from that date on.

4. **Regenerate the chunks and confirm they're current.**
   ```sh
   npm run chunks
   git diff --exit-code -- dist/chunks
   ```
   A non-empty diff means a page changed after the last extraction.

5. **Run the full check, green.**
   ```sh
   npm run check
   npm run measure:hero
   ```

6. **Verify inside a real Evolution CMS.**
   ```sh
   npm run evo:up
   npm run evo:verify
   ```
   Baseline (2026-08-11): 696 assertions, 19 pages, 105 chunks, passing on
   EVO 1.4.18 and 3.5.7.

7. **Decide what replaces the draft fittings.** The draft banner, `noindex`
   and no Open Graph tags are non-negotiable *for this repo* (rule 4 in
   `CLAUDE.md`). What the production site carries instead is a human call, not
   a volunteer's to improvise on import day — see
   [#27](https://github.com/SimplyThomas/nativity-demo/issues/27), item 6.

Two more open items worth a look the same week, tracked separately because
they need a person's answer, not a command:
[#25](https://github.com/SimplyThomas/nativity-demo/issues/25) (26 parish
facts awaiting verification) and
[#26](https://github.com/SimplyThomas/nativity-demo/issues/26) (the
`.ntgoc-page` body-class import contract).

---

## 1. What Evolution CMS is, in four words

> **Version:** reported as **EVO 1.4.x**, but *not confirmed* — check the manager
> footer or **Help → About** before you start. Everything in this guide uses the
> Evolution **1.x** syntax (`{{chunkName}}` to call a chunk, `[~id~]` to link to a
> resource). Evolution **3.x** handles templates and elements differently, so if
> the About screen says 3.x, stop and re-check this guide against the 3.x docs.


EVO organises a site as:

| Thing | What it is | Where you'll find it |
|---|---|---|
| **Template** | The page shell — header, footer, `<head>` | Elements → Templates |
| **Chunk** | A reusable block of raw HTML | Elements → Chunks |
| **Snippet** | PHP code | Elements → Snippets |
| **Template Variable** | A per-page field | Elements → Template Variables |

**Chunks are the target.** They hold raw HTML, they are editable in a plain text
box, and — unlike page content — they are *not* mangled by the rich text editor.
That is why every reusable block in this draft is already wrapped in chunk
markers.

## 2. Logging in

1. Go to `https://www.nativity.va.goarch.org/manager/`
2. Sign in with your editor credentials. If you don't have them, the parish
   office or DIM issues them — do not share someone else's login.
3. Chunks live under **Elements → Chunks** in the left-hand tree.

If you only see "Resources" and not "Elements", your account does not have
element permissions. Stop here and ask DIM; you cannot do this import.

---

## 3. ⚠️ The TinyMCE warning — the mistake that wastes an afternoon

EVO's rich text editor (TinyMCE) **will silently rewrite complex HTML.** It strips
attributes, collapses empty `<div>`s, re-orders tags, and removes the styling
hooks this design depends on. Paste a chunk into a rich-text field and it will
look broken in a way that is very hard to diagnose, because the source you pasted
is not the source that got saved.

**Two safe routes, in order of preference:**

1. **Put the markup in a chunk** (Elements → Chunks). Chunk bodies are plain
   textareas — no rich text editor, no rewriting. Then call the chunk from the
   page. This is what the whole draft is built for.
2. **If content must go in a resource**, open the resource, and *before pasting*,
   untick **Rich Text** (Settings tab, "Rich Text" / "Use editor" checkbox). Save,
   reopen, then paste. Unticking after pasting does not undo the damage.

Never paste chunk markup into a page while Rich Text is on.

---

## 4. Order of work

Do it in this order. Each step is verifiable before the next one matters.

### Step 1 — Confirm you may add a stylesheet (blocking)

Ask DIM before doing anything else. If custom CSS cannot be added, **stop** — the
chunks will import but will be unstyled, and you'll need to rethink the approach.

Evidence it is probably allowed: the live site already loads
`/assets/templates/custom.css` alongside `t05.css` and the `common/` template
CSS. But "a file exists" is not "you may add one". Get it in writing.

### Step 2 — Upload the images

1. In the manager, open the **File Manager** (Tools → File Manager, or the
   folder icon).
2. Navigate to the template asset folder. On the live site that is
   `/assets/templates/`.
3. Create a folder named `ntgoc`, then a folder `img` inside it.
4. Upload the thirteen files listed below from this repo's `assets/img/` folder.
   The folder holds four more; they are not needed, and the table says why.
5. **Confirm the resulting path.** Click an uploaded image and read the URL the
   manager reports. You are checking it is exactly:

   ```
   /assets/templates/ntgoc/img/hero-anastasis-icon.jpg
   ```

   If the real path is different — and it may well be — tell whoever maintains
   this repo. One line at the top of `tools/extract-chunks.mjs` sets it:

   ```js
   const ASSET_ROOT = '/assets/templates/ntgoc/';
   ```

   Change that line, re-run the extraction, and every chunk and the stylesheet
   are corrected together. Do **not** hand-edit paths in 59 files.

The thirteen images to upload:

| File | Used on |
|---|---|
| `hero-anastasis-icon.jpg` | Home hero |
| `clergy-fr-john.jpg` | About — clergy |
| `faith-resurrection.jpg` | Our Faith hero |
| `faith-ascension.jpg`, `faith-holy-sites.jpg`, `faith-elders.jpg` | Our Faith — further reading |
| `feast-transfiguration.jpg` | Home — upcoming services |
| `festival-banquet.png` | Home, Greek Festival |
| `give-building-projects.png` | Giving — building projects |
| `directions-map.jpg` | Visit, Contact — the parish's own directions map |
| `goa-seal.png` | Site header, every page |
| `goa-seal-full.png` | Site footer colophon, every page |
| `parish-nave-aisle.jpg` | Parish Life hero — **cropped**, see the note below |

And the four you can skip:

| File | Why not |
|---|---|
| `goa-seal-16.png`, `goa-seal-32.png`, `goa-seal-apple-touch.png` | Favicons, for the demo only. The live template already serves these from `/assets/templates/common/icons/` — see the note below. |
| `parish-nave-panorama.jpg` | Harvested but unused; kept as an alternative hero. |

> **Provenance:** these were taken from the parish's own live site on 2026-08-08,
> with three caveats recorded in `data/parish-facts.json`:
> `feast-transfiguration.jpg` comes from **onlinechapel.goarch.org** and is
> Archdiocese-owned, not parish-owned — check reuse terms. `clergy-fr-john.jpg`
> is a photograph of a named person; confirm Fr. John is content for it to be
> used before it goes anywhere public. The two `goa-seal-*` files are the seal
> of the **Greek Orthodox Archdiocese of America**, also not parish-owned —
> confirm with DIM before this goes anywhere public.

> **`parish-nave-aisle.jpg` is cropped, and the crop is the point.** It came
> later, from the church website, and the parish confirmed it owns it. The full
> frame has a parishioner standing at the chanter's stand on the right, so the
> version in this repo stops short of him. Owning a photograph and having the
> agreement of the person in it are two different things, and the parish's own
> rule — printed on the Parish Life page — is that photographs go up only with
> the permission of those pictured. The uncropped 3000×2000 original is recorded
> in `data/parish-facts.json`; use it only if he has agreed to appear.

> **The parish has no logo of its own.** Both the header logo and the favicons
> on the live site are the Archdiocese seal, served from the shared GOARCH
> template folders. That is why the draft uses it too, and why nothing here is a
> parish-specific mark.

#### A note on the favicons

Each page's `<head>` in this repo carries four icon `<link>`s pointing at the
`goa-seal-*` files. **Do not copy them into the EVO template.** The live site
already serves the same seal from `/assets/templates/common/icons/`, so the
favicon is correct the moment the chunks go in. Those `<link>`s exist only so
the demo shows the right icon when opened from disk or from GitHub Pages — they
sit in the `<head>`, which is not part of any chunk, so nothing in
`dist/chunks/` references them.

### Step 3 — Add the stylesheet

The file is `dist/chunks/_components.evo.css`. Its asset paths are already
rewritten to match Step 2.

Two ways, depending on what DIM permits:

- **Preferred** — upload it via the File Manager to
  `/assets/templates/ntgoc/components.css`, then add one line to the template's
  `<head>` (Elements → Templates → the active template):

  ```html
  <link rel="stylesheet" href="/assets/templates/ntgoc/components.css">
  ```

  Place it **after** the Bootstrap `<link>` so it wins where the two overlap.

- **Fallback** — if you may not add files or edit the template, paste the whole
  stylesheet into a chunk called `ntgocStyles`, wrapped in `<style>` tags, and
  call that chunk at the top of each page. Uglier, but it works.

**Why this stylesheet is safe to add:** it contains no CSS reset and no bare
element selectors (`h1`, `p`, `a`, `.card`). Every rule is a single `.ntgoc-*`
class, so it cannot collide with the Bootstrap 4.1.3 template already running.
Do **not** import `assets/css/provisional.css` — that one *is* a reset and it
*will* break the surrounding template. It exists only so the demo site looks
right on GitHub Pages.

### Step 4 — Create the chunks

For each file in `dist/chunks/`:

1. **Elements → Chunks → New Chunk**
2. **Chunk name**: exactly the filename without `.html` — e.g. `ntgocVisitorHero`.
   Names are case-sensitive and are how pages call them.
3. **Description**: paste the first line of the file's header comment.
4. **Chunk code**: open the `.html` file in a plain text editor (Notepad, not
   Word). **Skip the `<!-- ... -->` header comment at the top** — that's
   instructions for you, not markup — and paste everything below it.
5. Save.

Call a chunk from a page or template with `{{chunkName}}`.

Start with these four. If the header and footer render correctly, everything else
will:

| Chunk | What it is |
|---|---|
| `ntgocDraftBanner` | **Import this first and remove it last.** The "not the parish website" banner. |
| `ntgocTopBar` | Metropolis line + Festival / Bookstore / Hall Rental links |
| `ntgocSiteHeader` | Logo lockup and main navigation |
| `ntgocSiteFooter` | Address, phone, social, site map |

Then the page content, grouped by page:

| Page | Chunks, in order |
|---|---|
| **Home** | `ntgocHomeHero`, `ntgocHomeServiceTimes`, `ntgocHomeWelcome`, `ntgocHomeUpcomingServices`, `ntgocHomeFestivalPromo`, `ntgocHomeMinistriesPromo` |
| **Visit** *(the one that matters)* | `ntgocVisitorHero`, `ntgocVisitorEssentials`, `ntgocVisitorFirstSunday`, `ntgocVisitorLanguage`, `ntgocVisitorWhatToWear`, `ntgocVisitorWhatToBring`, `ntgocVisitorChildren`, `ntgocVisitorSundaySchool`, `ntgocVisitorGreeters`, `ntgocVisitorWhenYouArrive`, `ntgocVisitorVideos`, `ntgocVisitorDirections` |
| **Our Faith** | `ntgocFaithHero`, `ntgocFaithIntro`, `ntgocFaithTopics`, `ntgocFaithWatchRead` |
| **Calendar** | `ntgocCalendarHero`, `ntgocCalendarGrid` |
| **Parish Life** | `ntgocParishLifeHero`, `ntgocParishLifeWorship`, `ntgocParishLifeFellowship`, `ntgocParishLifeFormation`, `ntgocParishLifeService`, `ntgocParishLifeEvents`, `ntgocParishLifeBookstore`, `ntgocParishLifeGallery`, `ntgocParishLifeUpcoming` — *read the note below before importing any of these* |
| **Get Involved** | `ntgocGetInvolvedHero`, `ntgocGetInvolvedPathways`, `ntgocGetInvolvedCoffee`, `ntgocGetInvolvedAgape`, `ntgocGetInvolvedCare`, `ntgocGetInvolvedServe`, `ntgocGetInvolvedPrepare`, `ntgocGetInvolvedOffering`, `ntgocGetInvolvedProsphora`, `ntgocGetInvolvedLearn`, `ntgocGetInvolvedAsk`, `ntgocGetInvolvedClosing` — *sits under Parish Life in the menu; ten external destinations and one form are still unconfigured, and `ntgocGetInvolvedAgape` carries a theological constraint — see below* |
| **For Our Parish** | `ntgocParishHero`, `ntgocParishWeek`, `ntgocParishAnnouncements`, `ntgocParishConnected`, `ntgocParishServe`, `ntgocParishStewardship`, `ntgocParishFamilies`, `ntgocParishResources`, `ntgocParishOrthodoxResources`, `ntgocParishAsk` — *see the note below on keeping it up to date* |
| **Events** | `ntgocEventsHero`, `ntgocEventsList` |
| **Ministries** | `ntgocMinistriesHero`, `ntgocMinistriesGrid` |
| **Parish Council Committees** | `ntgocCommitteesHero`, `ntgocCommitteesList` |
| **About** | `ntgocAboutHero`, `ntgocAboutClergy`, `ntgocAboutParishCouncil` |
| **The Light (newsletter)** | `ntgocNewsletterHero`, `ntgocNewsletterArchive` |
| **Giving** | `ntgocGiveWays`, `ntgocGiveProjects` |
| **Contact** | `ntgocContactHero`, `ntgocContactCard` |
| **Greek Festival** | `ntgocFestivalHero`, `ntgocFestivalDetails` — *nothing links to this page, see below* |
| **Hall Rental** | `ntgocHallRental` |
| **Bookstore** | `ntgocBookstoreHero`, `ntgocBookstoreCatechism`, `ntgocBookstoreConverts`, `ntgocBookstoreCatalog`, `ntgocBookstoreNotes` |
| **Welcome** *(the QR-code page)* | `ntgocWelcomeHero`, `ntgocWelcomeIntro`, `ntgocWelcomeNav`, `ntgocWelcomeExperience`, `ntgocWelcomeAsk`, `ntgocWelcomeSurvey`, `ntgocWelcomeLearn`, `ntgocWelcomeConnected`, `ntgocWelcomeStay`, `ntgocWelcomeClosing` — *three of these contain forms with no handler; see Step 6a* |

> **`ntgocWelcomeNav` has to be a direct child of the page's main content area**,
> in the position shown — not nested inside another block. It is the sticky
> section switcher, and a sticky element only sticks within its own parent: drop
> it one level deeper and it stops following the reader after two swipes, which
> is the entire reason it exists. Nothing will look broken, so nothing will tell
> you. Scroll the page once after importing it.

> **For Our Parish is the one page that goes stale on its own.** Two of its
> chunks — `ntgocParishWeek` and `ntgocParishAnnouncements`
> — are rendered from `data/parish-calendar.json` and
> `data/parish-announcements.json` by `npm run parish`. In this repo that means
> one place to edit. Once the page is in Evolution CMS there is no build step,
> so the parish has to decide which of these it wants:
>
> 1. **Edit the chunk in the EVO manager.** No tooling, but the announcement
>    markup has to be copied by hand each time, and the week list is only as
>    right as whoever last retyped it. This is what most parishes end up doing.
> 2. **Keep editing the JSON here, run `npm run parish`, and paste the two
>    chunks in again.** Correct by construction, but it needs somebody who can
>    run a command.
> 3. **Replace them with an EVO snippet** that reads the parish calendar
>    directly. The right answer long-term, and the one to ask the Department of
>    Internet Ministries about — see the questions at the foot of this file.
>    Note that a snippet call is written `[[snippetName]]`, which is exactly the
>    sequence nothing in this repo is allowed to contain, so it has to be added
>    in the manager after import, never pasted in from here.
>
> Until one of those is chosen, the page carries an "as of" line saying which
> date its list was built from, and its JavaScript hides days and announcements
> that have gone past. It ages honestly rather than lying quietly.

> **Get Involved ships with ten destinations that do not exist.** Hosting a
> coffee hour, bringing something to the Agape Meal, viewing current meal trains,
> requesting meal support, sponsoring flowers, helping arrange them, decorating
> for the Nativity, the current feast-day needs, the prosphora rota and the
> prosphora class are all rendered as labelled inert buttons, each with a `TODO`
> comment in the markup naming the key to fill in — `coffeeHourSignup`,
> `agapeSignup`, `mealTrain`, `mealSupportRequest`, `flowerSponsorship`,
> `flowerHelpers`, `decoratingSignup`, `feastDayNeeds`, `prosphoraRota` and
> `prosphoraClassSignup` under `links` in `data/site.json`. The parish intends
> SignUpGenius for the sign-up sheets and Meal Train for meals to a household.
> No account, link or ID has been invented for any of them.
>
> **`flowerSponsorship` and `flowerHelpers` are a pair and must stay two
> destinations.** Paying for an arrangement and arranging one are different
> offers, and a parishioner can very often make one and not the other. A single
> "help with flowers" link asks each of them for the thing they cannot give.
>
> **`prosphoraRota` is not an open sign-up.** If the parish teaches its own
> practice before somebody bakes for the Liturgy, a public join button routes
> around the teaching, and the first anyone knows of it is a loaf that cannot be
> used. Whatever fills that key must admit only bakers the parish has approved,
> and the schedule it shows is for those bakers to coordinate with — not a public
> directory of who is in whose kitchen on a Saturday.
>
> Two things to keep when they are wired up. **The buttons stay parish-facing** —
> "Host a coffee hour", not "Go to SignUpGenius"; which tool handles the sign-up
> is the parish's business, not the parishioner's. And **the "next Agape Meal"
> card ships with its rows empty** rather than an invented date, which is the one
> thing on that page a parishioner could catch out.

> **`ntgocGetInvolvedAgape` is the one chunk on this site with a theological
> constraint, and it is easy to break by improving the prose.** The monthly Agape
> Meal is a parish supper that remembers an early Christian habit. The chunk may
> say that the Eucharist was first celebrated in the setting of a community meal
> called the agape, that the two became distinct very early — by the end of the
> first century or the beginning of the second — and that Christians have gone on
> sharing a table since.
>
> It may **not** say, in any wording, that the meal completes or extends the
> Eucharist, that it is any part of the sacrament, or that anyone is expected to
> stay and eat after the Divine Liturgy. A sentence that does any of those will
> sound more devout than the one it replaced, which is exactly the risk. The
> constraint is repeated in a comment above the chunk in `get-involved.html`
> and recorded under `agapeMeal` in `data/parish-facts.json`; keep the comment
> when you paste, or the next person to edit the chunk in the EVO manager will
> not know.
>
> **Two sources are named in prose and neither is linked**, because no URL for
> either is recorded in this project: the Archdiocese's account of the
> sacramental life of the Church, and Archbishop Elpidophoros's remarks at Holy
> Trinity Cathedral, New Orleans, on 16 March 2025, which the pull quote is taken
> from. **Verify the quotation against the published text before this page goes
> to the Council** — it puts words in the mouth of a named living hierarch. If it
> cannot be sourced, delete the quotation rather than soften the attribution.

> **Nothing links to the Greek Festival *page* any more** — the "Greek Festival"
> entries in the Events menu and on the Events page both go to fredgreek.org,
> not to `festival.html`. On 8 August 2026 the
> parish asked that every "Greek Festival" link go to the festival's own site,
> <https://www.fredgreek.org/> — so all 29 of them do: the top bar and the
> footer on every page, the "Festival details" button on the home page, and the
> "The Greek Festival →" button on the Parish Life page.
> `festival.html` still exists and its two chunks are still extracted, but a
> visitor has no way to reach it.
>
> **Decide before importing:** either skip `ntgocFestivalHero` and
> `ntgocFestivalDetails` entirely, or give the page a link from somewhere. Note
> that its dates and the "two-hour volunteer shifts" line were never verified
> (see below), so the festival's own site is the more reliable destination
> regardless.

> **`ntgocAboutParishCouncil` has shrunk.** The six committees used to sit at
> the foot of that chunk; they are now their own page, `ntgocCommitteesHero` +
> `ntgocCommitteesList`, because the Parish Life menu links to them directly.
> What is left on About is the Council roster and a two-line pointer. **If you
> already created the old chunk in EVO, replace its body** — otherwise the
> committees appear twice, once on each page, and only one copy gets updated
> when the roster finally arrives.
>
> **`ntgocAboutNewsletter` no longer exists.** The Light is its own page now —
> `ntgocNewsletterHero` + `ntgocNewsletterArchive` — reached from the Parish
> Life menu and the footer. **If you already created `ntgocAboutNewsletter` in
> EVO, delete it** and take the two new chunks instead; leaving it in place puts
> the year buttons at the foot of the About page as well as on their own page.
>
> **The Light's year links still go nowhere.** All six (`2026` … `Archive`) are
> `href="#"` placeholders; the parish site has no newsletter archive to point
> them at. Giving them a page of their own makes that more visible, not less —
> a visitor who follows the menu item now lands on a page whose main content
> does nothing. The page says so in plain sight rather than hiding it.
> **Either supply the archive URLs — or the address the issues already live at —
> before importing, or drop the year row and leave the rest of the page.**
>
> The same page carries `newsletter@ntgoc.org` for contributions, which is a
> verified role address (`data/parish-facts.json`), and repeats the parish's
> photograph-permission rule for anyone sending in pictures. What it does *not*
> say is the deadline, the publication schedule, or who edits it — none of that
> could be sourced, so all three are flagged rather than guessed.

> **The Parish Life page is mostly empty photo frames, on purpose.** The design
> builds that page out of twenty-six photographs. The parish has supplied one —
> the nave, in the hero. The other twenty-five are labelled placeholders saying
> what belongs there: "the Agape Meal in the parish hall", "a Bible study or
> catechism class". That is the point: the page is a request for photographs,
> and it should be shown to the Parish Council in that state rather than filled
> with stock images.
>
> **Do not import it as it stands.** Either wait until there are photographs, or
> import it and accept that visitors see the frames. `ntgocParishLifeGallery`
> also carries the parish's photograph-permission note, which has to be true
> before any photograph goes up: permission from those pictured, separate
> permission for any photograph that prominently features a child, and a working
> way to ask for one to be taken down.
>
> `ntgocParishLifeUpcoming` **goes stale.** Its five entries are copied from the
> August 2026 grid on the Calendar page. Either keep the two in step or drop the
> chunk and leave the "View full parish calendar" link that sits above it.

> **The eight middle Visit chunks are parish copy, not design copy.**
> `…Language`, `…WhatToWear`, `…WhatToBring`, `…Children`, `…SundaySchool`,
> `…Greeters`, `…WhenYouArrive` and `…Videos` were written by the parish rather
> than imported from Claude Design; they live in `content/visit-sections.html`.
> They import exactly like the others, but they carry the most unverified
> statements on the site — see below — and `ntgocVisitorGreeters` must not be
> imported at all until real photographs and permissions exist.
>
> Import them **in the order listed above**. They read as a sequence — dress,
> language, children, Sunday School, the greeters, arriving.
>
> **`ntgocVisitorFirstSunday` is now a collapsed row too**, titled "Sunday
> Morning, Step by Step". The times a visitor needs are in
> `ntgocVisitorEssentials` above it, which is why collapsing the schedule does
> not hide anything essential — import the two together or neither.
>
> **Each of the eight is a collapsed accordion row.** The markup is a plain
> `<details>` / `<summary>` — no JavaScript, so it keeps working in EVO exactly
> as it does here. Keep the `<summary>` as the first child of the `<details>`
> when editing; that is what makes the browser announce the row as expandable.
> Two of them, the Creed and the Lord's Prayer, are disclosures *inside* the
> Language row, which is legal and intended.
>
> **A consequence worth knowing before import:** text inside a closed row is
> not reached by the browser's find-on-page in Firefox or Safari, and the
> automated accessibility audit cannot see it either — the four YouTube embeds
> now sit behind a closed row and no longer appear in the axe report.

> **`ntgocVisitorFaqAndDirections` no longer exists.** It has been split: the
> FAQ card was removed and the block is now `ntgocVisitorDirections`. **If you
> already created the old chunk in EVO, delete it and create the new one** —
> otherwise the page keeps a "Questions people ask before coming" card that
> contradicts the sections above it.

### Step 5 — Fix the internal links

Links between pages were rewritten during extraction to an obvious placeholder,
because EVO addresses pages by numeric id and those ids do not exist yet:

```html
<a href="#" data-ntgoc-link="visit">Plan your first visit</a>
```

Once the pages exist in EVO, note each one's **resource id** (shown in the
resource tree) and replace the placeholder with EVO's link syntax:

```html
<a href="[~12~]">Plan your first visit</a>
```

A link into a *section* of another page keeps its anchor, so the placeholder
looks like this and the fragment goes back on the end of the EVO link:

```html
<a href="#ntgoc-children" data-ntgoc-link="parish-life">Children in parish life</a>
<!-- becomes -->
<a href="[~18~]#ntgoc-children">Children in parish life</a>
```

**`dist/chunks/_link-map.md` is the worksheet for this step.** It lists every
page whose resource id you need, then every chunk containing a link and what it
points at, with a tick box per chunk. `dist/chunks/_index.md` is the same idea
for the chunks themselves. Work through those two files rather than hunting
through the markup. External links (the
Archdiocese, Square giving, the Google registration form, fredgreek.org) are real
URLs already and need no change.

### Step 6a — Wire up the forms (needed)

There are **eight** forms in these chunks and **none of them has a backend**. Each
one says so on the page and offers a route that works instead of pretending.

| Chunk | Form | What it would need |
|---|---|---|
| `ntgocContactCard` | Send a message | A mail handler |
| `ntgocWelcomeAsk` | Ask your question | A mail handler, and someone who answers |
| `ntgocWelcomeSurvey` | Visitor survey | Somewhere for answers to go, and someone who reads them |
| `ntgocWelcomeConnected` | Join the parish email list | An email list, which the parish does not have |
| `ntgocTraditionsClasses` | Living the Traditions interest survey | Somewhere for answers to go, and someone to count them |
| `ntgocTraditionsTeach` | Offer to teach a tradition | A mail handler, and someone who follows the offer up |
| `ntgocTraditionsSuggest` | Suggest a tradition | A mail handler |
| `ntgocGetInvolvedCare` | Request meal support | A **private** destination and a named coordinator — see the warning below |

> **The meal support request is the one form on this site that carries a
> confidence.** Everything the other seven collect is ordinary: a question, a
> survey answer, an email address. This one discloses a birth, an illness, an
> operation or a death, from a named household, before anyone has agreed that
> the parish should know. Three things follow, and none of them is optional:
>
> - **It goes to one person, privately.** Not a shared office inbox that several
>   volunteers read, not a mailing list, not a Parish Council thread.
> - **It never creates a public Meal Train by itself.** Someone speaks to the
>   household first and asks what may be shared. A meal train page names the
>   family to everyone who opens it.
> - **No list of requests is ever published**, on this site or anywhere else.
>   The page has no such list today and must not acquire one.
>
> If a private destination cannot be arranged, delete the form and leave the
> parish office telephone number and address printed beside it. That is a worse
> page and a safe one.

Before any of these pages goes live, for **each** form either:

- point it at whatever mail handler DIM provides (ask them — this is question 3
  in the list below), **or**
- delete the form from the chunk and keep only the email and telephone links
  printed beside it.

Do not leave one as-is on a live parish site: a form that silently discards a
visitor's message is worse than no form at all.

Three further things about the Welcome forms specifically:

- **Keep them separate.** Asking a question and answering the survey must never
  add anyone to the mailing list. That is why they are three `<form>` elements
  with three buttons, and why the only consent tick on the page is on the list
  form. If you merge them for convenience, you have changed what the visitor
  agreed to.
- **The survey can be answered anonymously**, and is only worth having if it
  stays that way. It asks for a name and an email at the end, and only if the
  visitor asks to be contacted.
- **The survey's field names are the answer keys.** `firstVisit`, `greeted`,
  `foundBook`, `comfortableAsking`, `knewCoffeeHour`, `introduced`, and the three
  written answers. Whatever form tool is chosen, keep these names: they are what
  a later summary — how many visitors were greeted, how many found a service
  book — would be counted under.

And three about the Living the Traditions forms:

- **The class slugs are the answer keys**, and the same twenty-four are used by
  every control on the page: `attend` and `teach` on the cards, `topChoice1`,
  `topChoice2` and `topChoice3` on the three drop-downs, and `teachClass` on the
  teach-a-tradition form. Keep them and the four counts the Council asked for
  fall out of the data without any further work — how many would attend each
  class, the three most requested, how many could help teach each one, and
  which age groups would come (`ages`).
- **Interest is answered anonymously.** The interest form asks for no name and
  no email; the single email field appears only if someone ticks *Yes, please
  let me know*, and it says on the page that it would not add them to the
  newsletter. Keep it that way — a voting form that demands a name collects
  something other than what people think it collects.
- **Teaching offers are not public.** `teachName`, `teachEmail` and `teachPhone`
  exist so somebody can follow up an offer, and the page promises twice that
  they will not be published or shared. Whatever tool receives them must not
  display them, and the offer itself commits nobody to teaching.

### Step 6 — The JavaScript (optional)

One file: `assets/js/ntgoc-enhance.js`. It does four things — filters the
bookstore catalogue by category, advances the home page's festival cards on
their own, drops days and notices that have already passed on For Our Parish,
and handles the three Welcome forms, the three Living the Traditions forms and
the meal support request on Get Involved.

**It is optional.** With JavaScript off, every bookstore item is already visible
and the category buttons simply do nothing; the festival carousel keeps working
too, because its dots are ordinary links to each card and the strip scrolls by
trackpad, drag or arrow key. All the script adds there is the automatic
advance, the filled dot showing which card you are on, and the Pause button —
which stays hidden without it, since there would be nothing to pause. For Our
Parish shows exactly what it showed when it was last built, which the page
states in words. The Welcome forms stay complete and labelled; the panel asking
for contact details is simply visible from the start rather than appearing when
it becomes relevant. Nothing on the site *needs* JavaScript. If in doubt, skip
it.

Note that the Welcome form script deliberately **does not send anything** — it
intercepts the submit and shows the reply a visitor would get. Once a real
handler exists (Step 6a), that interception is the part to remove.

If you do take it, the autoplay is built to the accessibility rule that matters
here (WCAG 2.2.2): it stops on hover, on keyboard focus, while the tab is in the
background, and for good on a click of Pause — and it never starts at all for a
visitor whose system asks for reduced motion.

If you want it: upload to `/assets/templates/ntgoc/js/ntgoc-enhance.js` and add
before `</body>` in the template:

```html
<script src="/assets/templates/ntgoc/js/ntgoc-enhance.js" defer></script>
```

### Step 7 — Remove the draft banner

Only once Father and the Parish Council have signed off, and only at the moment
this stops being a draft. Delete the `ntgocDraftBanner` chunk call from the
template.

---

## What still has to be verified

Search the built HTML for `TODO: verify` — there are 34 markers, 12 of them on
the Visit page. They are HTML comments, so visitors never see them, but **none
should survive to a live parish site.** Each is a claim we could not source.

### Corrected during the build (from the parish's own live site)

| Claim | The design said | The live site says |
|---|---|---|
| Office hours | Tue–Fri 9:00 a.m. – **2:00** p.m. | Tue–Fri 9:00 – **3:00** |
| Directions | "ten minutes west of I-95, exit **130**" | exit **130B**, west on Route 3 just over 4 miles |
| Founding | **1963** | First Liturgy **9 April 1989**; charter 1991; building completed March 2000 |

### Resolved by the parish

- **The Sunday service time — confirmed: Orthros 9:00 a.m., Divine Liturgy
  10:00 a.m.** The design's Visit timeline was right. Everywhere the draft
  previously showed one 9:00 start against both services now shows both times.
  > **Worth raising separately:** the *live* parish site currently says
  > "9 am Orthros & Divine Liturgy", which compresses two services into one
  > start time. That is the single fact a first-time visitor acts on, and it is
  > wrong on the real site today — independent of whether this draft ever ships.

### Still unresolved — needs Father

- **Great Feast times.** "Vespers the evening before, Liturgy at 9:00 a.m." was
  never confirmed; only the Sunday pattern was. Still flagged.
- **Hall rental specifics** — "≈ 200 seated", "full commercial kitchen", free
  on-site parking. The live hall-rental page states none of these.
- **Greek Festival** — now moot for visitors, since every festival link goes to
  fredgreek.org, but if `festival.html` is ever relinked: the dates and
  "two-hour volunteer shifts" appear nowhere
  on the live site or fredgreek.org.
- **Ministries** — the design lists a **Choir & Chanters** ministry that the live
  site does not have, and omits **JOY**, which it does.
- **A cry room.** The design's FAQ says the church has one. The live parish site
  never mentions it. Flagged.

### Still unresolved — the new Visit sections

Every one of these is a statement about *our* worship, made in the parish's own
voice. None of it can be checked against a source; Father has to read it.

- **What language the service is in.** The new section says both English and
  Greek. The design's FAQ said *"mostly in English"* — a straight contradiction,
  now resolved in favour of "both" and flagged. Confirm what is true of a normal
  Sunday, and that greeters really do hand out a bilingual Divine Liturgy book.
- **The Creed and the Lord's Prayer.** The texts shown are the Archdiocese's
  English translations. Check them word for word against the parish's own Divine
  Liturgy book, and confirm the Lord's Prayer really is prayed in more than one
  language here before the page says so.
- **Head coverings.** The section describes what a visitor will see — some women
  veiled, many not. That is a description of this parish, and only Father or a
  parishioner can confirm it.
- **The daily readings link** points at the Archdiocese Online Chapel
  (`goarch.org/chapel`) because the parish site has no readings page yet. Repoint
  it if one is added.
- **Three of the four videos.** "Welcome to the Orthodox Church" with Frederica
  Mathewes-Green. The featured one — *An Introduction to the Orthodox Worship
  Space* — was supplied by the parish and is confirmed. The other three ids were
  found by title search, not by someone watching them. **Play each one before
  this goes live**: a wrong id plays the wrong episode and no visitor will report
  it. The four ids are in the `ntgocVisitorVideos` block of `visit.html`, as
  plain `youtube-nocookie.com/embed/<id>` URLs. Each unconfirmed one carries a
  `<!-- TODO: verify -->` marker — delete the marker once somebody has actually
  watched that video.

### Still unresolved — the Welcome page

`welcome.html` is written as the page a QR code on the *Understanding the Divine
Liturgy* pew card and in the Welcome Packet would lead to. It is a proposal in
the same sense the visitor follow-up block on the Visit page is: nothing on it
exists today.

- **The pew card and the Welcome Packet.** Neither has been seen by this
  project, and no wording from the printed card has been reproduced. Confirm
  they exist, confirm a QR code is wanted on them, and decide what the URL
  should be before anything is printed.
- **"Understanding the Divine Liturgy".** The card of that name has no page on
  this site. Its entry links to the Visit page's *Sunday morning, step by step*
  — the nearest thing that does exist. Decide whether it should become a page of
  its own, and whether the printed card's text may be reused for it.
- **The explanations themselves.** Each question carries two or three sentences
  of plain Church teaching, written short on purpose. None of it is presented as
  a parish statement, and the deeper reading each one links to is either the
  parish's own Our Faith pages or the Archdiocese. Father should read the
  nineteen answers; several touch on why a visitor may not receive Communion,
  which is the one thing on the page it would be worst to get slightly wrong.

  They were checked against Archdiocese sources on 2026-08-10 and four were
  corrected: the Divine Liturgy is no longer described as having been prayed in
  its present form for sixteen centuries (the Archdiocese's own account is that
  its core is apostolic and its framework settled by about the ninth century);
  the congregation is no longer said to stand through the consecration, since
  kneeling there is expressly permitted; the iconostasis now names the icons in
  the order the Archdiocese gives them; and "the shortest prayer the Church
  prays" became "among the shortest", which is what can be supported.
- **Five links to goarch.org** — the Kyrie Eleison article, the Nativity of the
  Theotokos, fasting, and the Archdiocese's visitor guide. Each was found by
  search rather than by clicking, and **`npm run links` cannot check them**:
  goarch.org returns 403 to any automated request, which is why the existing
  goarch.org links have always reported as unverifiable too. Open each one by
  hand before this goes live. Each carries a `<!-- TODO: verify -->` marker
  saying exactly this.
- **Fasting** links to an Archdiocese article, not to parish guidance. How a
  fast is actually kept is settled with a priest, and the card says so. Confirm
  Father is content with that as a starting point.
- **Children's activity boxes** outside the parish bookstore. Reported by a
  parishioner, not confirmed by the office. Flagged.
- **Touching the priest's vestment at the Great Entrance.** The practice is well
  attested and other Archdiocese parishes describe it in the same words, down to
  the etiquette — reach, but do not tug, do not step into the procession, do not
  move anyone aside. It is expressly *not* universal, though: it varies parish by
  parish. The card is written conditionally ("if you saw this") for that reason.
  Confirm it is the habit here.
- **Where the page belongs.** It is linked from the footer as *After your
  visit*, and from nowhere else — it is not in the main navigation, on the
  assumption that people reach it by scanning rather than by browsing. If the
  Council wants it discoverable, it needs a home in the navigation too.

### Still unresolved — Get Involved

The page was rewritten on 2026-08-11 from *Fellowship & Care* into the single
place that answers "I would like to take part in parish life — how?". The old
material is all still there; what was added is everything a newcomer currently
has to learn by word of mouth. That addition is also where nearly all of the
missing information now sits.

- **Make an Offering is a section of empty rows, and that is the point.** What
  prosphora must be made of, which wine the parish uses, which oil, when any of
  it is wanted and where it should be left are LOCAL decisions. Not one of them
  is recorded anywhere in this project. Every row reads "To be confirmed by the
  parish" and carries a `TODO: verify` marker. **Do not fill these in from
  general Orthodox practice.** "A good-quality dry red wine" is what most
  parishes use and would read here as an instruction from The Nativity; a
  parishioner would follow it to the shop and buy the wrong thing. See
  `liturgicalOfferings` in `data/parish-facts.json`.
- **Prepare & Beautify has the same shape and the same gap.** When the church is
  decorated, who does it now, what help is wanted and what may be brought are all
  unknown here. One question matters more than the rest and is Father's alone:
  which of these tasks any parishioner may simply turn up and do, and which are
  arranged with him because they happen inside the church or around things set
  apart for worship. The page says that line exists; it does not draw it.
- **Two claims about prosphora come from the brief and nowhere else** — that the
  parish offers the classes, and that **Presbytera** teaches them. Both carry
  `TODO: verify`. The second is a statement about a named person's role: no
  surname is printed, but "Presbytera" identifies exactly one person in this
  parish, so her agreement to be named is part of what has to be confirmed, not
  only the fact. If she would rather not be named, "the parish offers
  prosphora-baking classes" loses nothing.
- **The baking rota ships as a table with headings and no rows.** A specimen row
  would be read as the real schedule and would publish a parishioner's name
  against a date. Both decisions behind it should survive review: the rotation is
  *asked about* rather than joined, and the schedule is for approved bakers to
  coordinate with rather than a public listing.
- **Learn the Traditions is a doorway, not a second copy.** The class list, the
  offer-to-teach form and the suggest-a-class form all live on `traditions.html`;
  this section names a few classes and links there. If the two pages ever both
  grow a class list, they will drift, and the drift will be a parishioner told
  two different things about the same workshop.
- **The page was `fellowship-care.html` until 2026-08-11.** The old URL is gone
  rather than redirected — it was one day old and linked only from this draft's
  own navigation. One consequence is easy to miss: `"Agape Meal"` is a forbidden
  pattern in `data/site.json` with a per-page exemption, and that exemption names
  the file. It was moved to `get-involved.html` with the rename. If the page is
  ever renamed again, move it again, or lint will fail on the Agape Meal section
  the moment anyone touches it.

### Still unresolved — Living the Traditions

`traditions.html` is an interest survey, not a programme. Twenty-four possible
classes, none of them scheduled, approved or staffed. The page says so in the
hero card, above the class grid, in the closing panel of every form and in a
section of its own — but it is the page on this site most likely to be read as
an announcement, so nothing about it should be softened.

- **The whole series needs Father's approval before anything is offered.** Not
  only the topics that touch doctrine: whether the parish wants this at all is
  his and the Council's decision, and the page is addressed to them.
- **"The parish already offers this class"** on the *Prosphora baking* card is
  the only claim about the parish on the page. It was reported by the volunteer
  who drafted it, is on neither the live site nor in the newsletter, and carries
  a `<!-- TODO: verify -->` marker. Confirm it, or delete the line. If it is a
  class someone once ran rather than one that runs now, delete it — a card that
  says "already offers" will be read as "sign up".
- **Four classes are conditional and say so on their own cards.** *Incense at
  home* only with Father's approval; *Building a home prayer corner* with any
  pastoral guidance under his direction; *Orthodox memorial and funeral
  traditions* with him leading or approving the pastoral and theological parts;
  *Prayer rope knotting* only if someone qualified is available to teach it.
  *Iconography demonstration* names a qualified iconographer, and is deliberately
  not a paint-your-own-icon session. Keep those notes on the cards.
- **No teacher is named**, and no parishioner appears on the page at all — the
  same rule as the Parish Council block and the greeter row. Anyone who offers
  to help does so through the form, privately.
- **Aggregate counts were asked for and left out.** "18 parishioners are
  interested in this class" would be a number about the parish, and with no form
  handler it could only be invented. Once responses actually exist, the field
  names above are what a count would run on; adding the numbers to the cards is
  a separate decision, and a public leaderboard is not proposed.
- **Where the page belongs.** It sits under *Events* in the navigation, and in
  the *Parish* column of the footer. If the Council would rather it lived under
  *Parish Life*, that is a two-line change in the shell followed by
  `npm run shell`.

### Removed, and not said anywhere else

The design's "Questions people ask before coming" card was removed: the sections
above it now answer the same questions at length, and its one-line answers had
started to contradict them. Two of its six answers are **not** repeated anywhere
else on the site, and the parish may want them back somewhere:

- *"Will I be singled out?"* — **"No. Visitors are never asked to stand or
  introduce themselves. Come, watch, leave whenever you like."** For a visitor
  whose fear is being conspicuous, this is one of the more reassuring lines the
  page had.
- *"I'm interested in becoming Orthodox."* — **re-homed.** It is now the last
  block of `ntgocFaithTopics` on the Our Faith page, spanning the width of the
  topic grid, with two next steps: the parish's own
  `/our-faith/the_church` page ("Procedures for Becoming a Member of the
  Orthodox Christian Church") and the contact page. The Visit page still has no
  next step for an inquirer, which may or may not be right — that is a judgement
  for Father.

A third, *"Is there somewhere to sit?"*, is now covered by "When You Arrive".

### Blocking — `ntgocVisitorGreeters` cannot be imported as it stands

The "Faces You Might See" section ships with four empty frames reading *Photo to
come*. That is deliberate, and it is the same rule that emptied the Parish
Council block: **a photograph of a parishioner and their name go online only with
that person's permission.** Before this section is imported —

1. Ask each greeter, individually, and take yes or no as the whole answer.
2. Add their **first name only**. No surnames, no phone numbers, no email
   addresses, ever.
3. Use a warm, natural photograph of them — not a corporate headshot — and put it
   in `assets/img/`.
4. Fill in the cards in the `ntgocVisitorGreeters` block of `visit.html` —
   first name and photo per card — then run `npm run chunks`. Remove the
   placeholder note under the row once every card is filled.

If nobody has been asked yet, skip this chunk. The section is a kindness to
nervous visitors; it is not worth publishing a parishioner's face without asking.

### Deliberately withheld

- **Parish Council members.** The design named seven people with their personal
  `@ntgoc.org` addresses. Replaced with neutral placeholders — publishing named
  volunteers and harvestable addresses on an unofficial draft is not a volunteer's
  call. Restore real names only with each person's agreement.
- **Fr. John's mobile number — removed from the project entirely (9 Aug 2026).**
  It is on the live site's contact page. It was never rendered into any page of
  this draft, but the digits were written down in two working files:
  `data/parish-facts.json`, which recorded it as withheld, and the retired
  renderer's find-and-replace rule. **This repository is public**, so a number
  sitting in a data file is published whether or not a page displays it. Both
  are now redacted. Every phone number on the site is the parish office line,
  (540) 548-2665.

  > **It is still in the git history.** Redacting a file does not remove it from
  > the commits that carried it — it entered at `577a085` and is readable in
  > every commit since. Erasing it for good means rewriting that history and
  > force-pushing, which rewrites every commit id and has to be co-ordinated
  > with anyone else holding a clone. **That is a decision for the parish, not
  > for a volunteer.** Until it is made, treat the number as still published,
  > and note that GitHub may retain unreachable objects even after a rewrite —
  > the only certain remedy is asking GitHub Support to purge them, or deleting
  > and recreating the repository.

---

## Questions to ask the Department of Internet Ministries

Ask all of these **before** starting. Any "no" changes the plan.

1. **May we add a custom CSS file** to this site, and where should it live?
   (`/assets/templates/custom.css` already exists — is that ours to use, or DIM's?)
2. **May we edit the template** (Elements → Templates) to add a `<link>` and a
   `<script>` tag? Or is the template DIM-managed and overwritten on update?
3. **Are custom snippets permitted?** *(This draft needs none — worth knowing
   for later.)*
4. **What is the real asset path** for uploads? We assumed
   `/assets/templates/ntgoc/`.
5. **May we load external fonts** from Google Fonts? The design uses **Newsreader**
   and **Karla**. If not, they must be self-hosted or substituted — see below.
6. **Is there a staging site**, or does editing happen on the live parish site?
7. **Who can create resources** (new pages), as opposed to editing existing ones?
8. **May we embed YouTube videos?** The Visit page embeds four. They use
   `youtube-nocookie.com` and `loading="lazy"`, which is the least intrusive form
   of a YouTube embed, but it is still a third-party frame on a parish page. If
   embeds are refused, replace each `<iframe>` in the `ntgocVisitorVideos`
   block of `visit.html` with a plain link out to YouTube, then run
   `npm run chunks`.

### If fonts are refused

The design depends on Newsreader (serif headings) and Karla (body). The site
degrades to the system font stack — readable, but noticeably not the design. In
the demo the font `<link>` is marked `<!-- DEMO ONLY -->` in each page's `<head>`
and is deliberately **not** part of any chunk, so nothing breaks if you skip it.
Self-hosting both families in the asset folder is the fallback.

---

## Regenerating the chunk files

You do not need this to import — `dist/chunks/` is already committed. It is here
so the next person knows those files are **generated from the pages** and must
never be edited directly.

```sh
npm run parish   # calendar + announcements JSON -> the BUILD blocks (three pages)
npm run chunks   # the 17 HTML pages -> dist/chunks/
npm run lint     # checks everything this guide depends on
```

The nineteen `.html` files at the repo root are the source and are edited by hand.
They were generated from a Claude Design import until 8 August 2026; that link
has been cut. **Do not run `tools/archive/render.mjs`** — it would overwrite all
every page from the old design file. See `CONTRIBUTING.md`.

The extraction step refuses to write any chunk containing an EVO reserved
sequence (`[[ ]]`, `[! !]`, `{{ }}`, `[* *]`, `[( )]`, `[~ ~]`, `[+ +]`) and exits
with an error instead. If that ever fires, the fix belongs in the source, not in
the chunk. Full detail in `design-src/README.md`.
