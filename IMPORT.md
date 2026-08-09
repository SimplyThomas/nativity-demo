# Importing this draft into the parish website (Evolution CMS)

**Who this is for:** a parish volunteer with editor access to the church's
Evolution CMS manager. No command line needed. Everything you paste is in
`dist/chunks/` — 35 plain text files.

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
4. Upload all nine files from this repo's `assets/img/` folder.
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
   are corrected together. Do **not** hand-edit paths in 35 files.

The nine images:

| File | Used on |
|---|---|
| `hero-anastasis-icon.jpg` | Home hero, Mobile views |
| `clergy-fr-john.jpg` | About — clergy |
| `faith-resurrection.jpg` | Our Faith hero |
| `faith-ascension.jpg`, `faith-holy-sites.jpg`, `faith-elders.jpg` | Our Faith — further reading |
| `feast-transfiguration.jpg` | Home — upcoming services |
| `festival-banquet.png` | Home, Greek Festival |
| `give-building-projects.png` | Giving — building projects |

> **Provenance:** these were taken from the parish's own live site on 2026-08-08,
> with two caveats recorded in `data/parish-facts.json`:
> `feast-transfiguration.jpg` comes from **onlinechapel.goarch.org** and is
> Archdiocese-owned, not parish-owned — check reuse terms. `clergy-fr-john.jpg`
> is a photograph of a named person; confirm Fr. John is content for it to be
> used before it goes anywhere public.

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
| **Visit** *(the one that matters)* | `ntgocVisitorHero`, `ntgocVisitorFirstSunday`, `ntgocVisitorFaqAndDirections` |
| **Our Faith** | `ntgocFaithHero`, `ntgocFaithIntro`, `ntgocFaithTopics`, `ntgocFaithWatchRead` |
| **Calendar** | `ntgocCalendarHero`, `ntgocCalendarGrid` |
| **Ministries** | `ntgocMinistriesHero`, `ntgocMinistriesGrid` |
| **About** | `ntgocAboutHero`, `ntgocAboutClergy`, `ntgocAboutParishCouncil`, `ntgocAboutNewsletter` |
| **Giving** | `ntgocGiveWays`, `ntgocGiveProjects` |
| **Contact** | `ntgocContactCard` |
| **Greek Festival** | `ntgocFestivalHero`, `ntgocFestivalDetails` |
| **Hall Rental** | `ntgocHallRental` |
| **Bookstore** | `ntgocBookstoreHero`, `ntgocBookstoreCatalog`, `ntgocBookstoreNotes` |

`ntgocMobileViews` is **not a real page.** It is a design reference showing what
the site looks like on a phone. Do not import it.

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

Search the built HTML for `TODO: verify` — there are 22 markers. They are HTML
comments, so visitors never see them, but **none should survive to a live parish
site.** Each is a claim we could not source.

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
- **Greek Festival** — the dates and "two-hour volunteer shifts" appear nowhere
  on the live site or fredgreek.org.
- **Ministries** — the design lists a **Choir & Chanters** ministry that the live
  site does not have, and omits **JOY**, which it does.

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

### If fonts are refused

The design depends on Newsreader (serif headings) and Karla (body). The site
degrades to the system font stack — readable, but noticeably not the design. In
the demo the font `<link>` is marked `<!-- DEMO ONLY -->` in each page's `<head>`
and is deliberately **not** part of any chunk, so nothing breaks if you skip it.
Self-hosting both families in the asset folder is the fallback.

---

## Rebuilding, if the design changes

You do not need this to import. It is here so the next person knows the files in
`dist/chunks/` are generated, not hand-written — never edit them directly, because
the next rebuild overwrites them.

```sh
node tools/render.mjs          # design-src/ -> the 12 HTML pages + CSS
node tools/extract-chunks.mjs  # the HTML pages -> dist/chunks/
```

The extraction step refuses to write any chunk containing an EVO reserved
sequence (`[[ ]]`, `[! !]`, `{{ }}`, `[* *]`, `[( )]`, `[~ ~]`, `[+ +]`) and exits
with an error instead. If that ever fires, the fix belongs in the source, not in
the chunk. Full detail in `design-src/README.md`.
