# Importing this draft into the parish website (Evolution CMS)

**Who this is for:** a parish volunteer with editor access to the church's
Evolution CMS manager. No command line needed. Everything you paste is in
`dist/chunks/` — 45 plain text chunk files plus a stylesheet.

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
4. Upload the twelve files listed below from this repo's `assets/img/` folder.
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
   are corrected together. Do **not** hand-edit paths in 45 files.

The twelve images to upload:

| File | Used on |
|---|---|
| `hero-anastasis-icon.jpg` | Home hero, Mobile views |
| `clergy-fr-john.jpg` | About — clergy |
| `faith-resurrection.jpg` | Our Faith hero |
| `faith-ascension.jpg`, `faith-holy-sites.jpg`, `faith-elders.jpg` | Our Faith — further reading |
| `feast-transfiguration.jpg` | Home — upcoming services |
| `festival-banquet.png` | Home, Greek Festival |
| `give-building-projects.png` | Giving — building projects |
| `directions-map.jpg` | Visit, Contact — the parish's own directions map |
| `goa-seal.png` | Site header, every page |
| `goa-seal-full.png` | Site footer colophon, every page |

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
| **Home** | `ntgocHomeHero`, `ntgocHomeServiceTimes`, `ntgocHomeWelcome`, `ntgocHomeFirstSunday`, `ntgocHomeUpcomingServices`, `ntgocHomeFestivalPromo`, `ntgocHomeMinistriesPromo` |
| **Visit** *(the one that matters)* | `ntgocVisitorHero`, `ntgocVisitorOnThisPage`, `ntgocVisitorFirstSunday`, `ntgocVisitorLanguage`, `ntgocVisitorWhatToWear`, `ntgocVisitorWhatToBring`, `ntgocVisitorChildren`, `ntgocVisitorSundaySchool`, `ntgocVisitorGreeters`, `ntgocVisitorWhenYouArrive`, `ntgocVisitorVideos`, `ntgocVisitorDirections` |
| **Our Faith** | `ntgocFaithHero`, `ntgocFaithIntro`, `ntgocFaithTopics`, `ntgocFaithWatchRead` |
| **Calendar** | `ntgocCalendarHero`, `ntgocCalendarGrid` |
| **Ministries** | `ntgocMinistriesHero`, `ntgocMinistriesGrid` |
| **About** | `ntgocAboutHero`, `ntgocAboutClergy`, `ntgocAboutParishCouncil`, `ntgocAboutNewsletter` |
| **Giving** | `ntgocGiveWays`, `ntgocGiveProjects` |
| **Contact** | `ntgocContactCard` |
| **Greek Festival** | `ntgocFestivalHero`, `ntgocFestivalDetails` — *nothing links to this page, see below* |
| **Hall Rental** | `ntgocHallRental` |
| **Bookstore** | `ntgocBookstoreHero`, `ntgocBookstoreCatalog`, `ntgocBookstoreNotes` |

> **Nothing links to the Greek Festival page any more.** On 8 August 2026 the
> parish asked that every "Greek Festival" link go to the festival's own site,
> <https://www.fredgreek.org/> — so all 25 of them do: the top bar and the
> footer on every page, and the "Festival details" button on the home page.
> `festival.html` still exists and its two chunks are still extracted, but a
> visitor has no way to reach it.
>
> **Decide before importing:** either skip `ntgocFestivalHero` and
> `ntgocFestivalDetails` entirely, or give the page a link from somewhere. Note
> that its dates and the "two-hour volunteer shifts" line were never verified
> (see below), so the festival's own site is the more reliable destination
> regardless.

`ntgocMobileViews` is **not a real page.** It is a design reference showing what
the site looks like on a phone. Do not import it.

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
> **`ntgocVisitorOnThisPage` is the exception:** it is a jump list, and every
> link in it points at an `id` on one of the other chunks. Import it last, and
> if the parish decides to leave a section out, delete that section's line from
> the list — otherwise the link goes nowhere. The ids are `#ntgoc-sunday-morning`,
> `#ntgoc-language`, `#ntgoc-wear`, `#ntgoc-bring`, `#ntgoc-children`,
> `#ntgoc-sunday-school`, `#ntgoc-greeters`, `#ntgoc-when-you-arrive`,
> `#ntgoc-videos` and `#ntgoc-directions`.

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

Search each chunk for `data-ntgoc-link` — there is one per link, and the
attribute value tells you which page it should point at. External links (the
Archdiocese, Square giving, the Google registration form, fredgreek.org) are real
URLs already and need no change.

### Step 6a — Wire up the contact form (needed)

`ntgocContactCard` contains a real, fully labelled `<form>`, but it has **no
backend**. In the draft it says so plainly and offers an email and phone
fallback instead of pretending to work.

Before this page goes live, either:

- point the form at whatever mail handler DIM provides (ask them — this is
  question 3 in the list below), **or**
- delete the form from the chunk and keep only the email and telephone links.

Do not leave it as-is on a live parish site: a form that silently discards a
visitor's message is worse than no form at all.

### Step 6 — The JavaScript (optional)

One file: `assets/js/ntgoc-enhance.js`. It does exactly one thing — filters the
bookstore catalogue by category.

**It is optional.** With JavaScript off, every bookstore item is already visible
and the category buttons simply do nothing. Nothing else on the site needs
JavaScript at all. If in doubt, skip it.

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
- **Fr. John's mobile number.** It is on the live site's contact page; it is not
  in this draft. Re-publishing a personal number was not ours to decide.

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
npm run chunks   # the 12 HTML pages -> dist/chunks/
npm run lint     # checks everything this guide depends on
```

The twelve `.html` files at the repo root are the source and are edited by hand.
They were generated from a Claude Design import until 8 August 2026; that link
has been cut. **Do not run `tools/archive/render.mjs`** — it would overwrite all
twelve pages from the old design file. See `CONTRIBUTING.md`.

The extraction step refuses to write any chunk containing an EVO reserved
sequence (`[[ ]]`, `[! !]`, `{{ }}`, `[* *]`, `[( )]`, `[~ ~]`, `[+ +]`) and exits
with an error instead. If that ever fires, the fix belongs in the source, not in
the chunk. Full detail in `design-src/README.md`.
