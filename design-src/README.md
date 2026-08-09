# design-src/ — the imported Claude Design files

**Never edit anything in this folder.** These files are the record of what Claude
Design produced. The site is generated *from* them by `tools/render.mjs`. If you
change them by hand, the next re-import silently overwrites your work and the
diff becomes meaningless.

| File | What it is |
|---|---|
| `Nativity Website.dc.html` | The design. One document, 12 routed views, 1 208 lines. |
| `support.js` | Claude Design's `dc-runtime`. **Not a dependency of this site** — see below. |

---

## How the import was done

The project lives at:

```
https://claude.ai/design/p/4b5c2ead-a240-4947-b6b2-250ed65b3ae3
```

It is read through the **DesignSync** tool (the `claude_design` MCP). Authenticate
first with `/design-login` if the tool reports no design scope.

```
DesignSync  method=get_project   projectId=4b5c2ead-a240-4947-b6b2-250ed65b3ae3
DesignSync  method=list_files    projectId=…      → [".thumbnail", "Nativity Website.dc.html", "support.js"]
DesignSync  method=get_file      projectId=…  path="Nativity Website.dc.html"
DesignSync  method=get_file      projectId=…  path="support.js"
```

### Quirks worth knowing

1. **`get_file` returns JSON, not raw file content.** The response is
   `{"method":"get_file","path":"…","content":"…"}`. You must parse the JSON and
   write `.content` to disk. Writing the raw response gives you a file that
   starts with `{"method":…` and nothing downstream will parse.
2. **Both files exceed the tool-output limit** (120 KB and 69 KB), so the result
   is spilled to a file on disk and only a 2 KB preview is shown. Read the
   spill path, don't try to work from the preview.
3. **The project is `PROJECT_TYPE_PROJECT`, not `PROJECT_TYPE_DESIGN_SYSTEM`.**
   `list_projects` filters to design systems only, so this project will *not*
   appear there. Address it directly by its `projectId`.
4. `.thumbnail` is a preview image the app maintains. Ignore it.

### Writing back to Claude Design

`DesignSync` can write, but the order is enforced:

```
finalize_plan (declares exactly which paths may be written)  →  write_files
```

Writes are only worth doing if a portability fix genuinely belongs in the design
rather than in the renderer. **Prefer fixing it in the renderer.** The design is
the source of truth for how the site *looks*; this repo is the source of truth
for how it *survives Evolution CMS*. See "Round-tripping" below.

---

## What `support.js` actually is

A generated React runtime (`// GENERATED from dc-runtime/src/*.ts`). At load it
pulls **React and ReactDOM from unpkg** and calls `createRoot()` — the page is
empty until JavaScript runs.

It implements a small template language used by the design:

| Construct | Meaning |
|---|---|
| `<x-dc>` | the template root |
| `<sc-if value="{{ expr }}">` | conditional block |
| `<sc-for list="{{ xs }}" as="x">` | repeat block |
| `{{ binding }}` | interpolation |
| `style-hover="…"` | inline hover state |
| `<helmet>` | head injection |

**None of this ships.** `tools/render.mjs` resolves every construct at build time
and emits plain HTML. That is deliberate: a client-side-rendered shell cannot be
imported into EVO, because the import depends on being able to read finished
markup.

---

## Known defects in the design source

Recorded here so they are not "fixed" twice, and so a re-import can be checked
against them.

### 1. Stray `</div>` at line 360

```
360:      </section></main></sc-if></div>
```

That trailing `</div>` closes the page-wrapper `<div>` opened at line 23 — about
26 KB early. From the Visit view onward, every remaining view *and the footer*
render outside the wrapper and lose its `font-family`, `background`, `color` and
`min-height`.

The renderer does not reproduce this. It ignores the wrapper entirely and slices
on landmarks it can trust (header → first `<sc-if>`, views → the `<sc-if>` blocks,
footer → the `<footer>` element), discarding anything between blocks.

**Worth fixing in Claude Design** — it affects the design preview too.

### 2. Internal contradiction on the Sunday service time

- Home view: `9:00 a.m. — Orthros & Divine Liturgy` (one 9:00 start)
- Visit view: Orthros `9:00 AM`, Divine Liturgy `10:00 AM`

The live parish site says *"9 am Orthros & Divine Liturgy"*, which matches the
home view. Both readings are plausible for a real parish, so the renderer picks
neither — every `10:00 AM` claim is tagged `<!-- TODO: verify -->` for Father.

### 3. Founding year was a placeholder

The design said **1963** and self-flagged it. The parish's own history page gives
the real sequence: first Liturgy **9 April 1989** at St. George's Episcopal
Church, charter **1991**, land **1992**, building completed **March 2000**.
Corrected in the renderer; the design still says 1963.

### 4. A ministry that does not exist

The design lists **Choir & Chanters**; the live site has no such ministry. It
also omits **JOY**, which does exist. Flagged rather than swapped — the parish may
well have chanters without a ministry page.

### 5. No media queries anywhere

734 inline `style` attributes, zero classes, zero `@media`. The layout is fixed
desktop (`height:640px`, `padding:0 40px`, `max-width:1440px`). Responsive
behaviour had to be authored, not transcribed — it lives in the clearly-marked
"responsive layer" at the bottom of `assets/css/components.css`. **That layer is
the only part of the CSS that is not a verbatim copy of the design.**

---

## Round-tripping: re-importing after a design change

1. Re-fetch both files with `DesignSync … get_file` (remember: parse the JSON).
2. Write them to `design-src/`, overwriting.
3. `git diff design-src/` — this is the report of what changed in Design.
4. Re-run the build:
   ```sh
   node tools/render.mjs
   node tools/extract-chunks.mjs
   ```
5. `git diff` the generated pages and `assets/css/components.css`.

**Class names are content-hashed and stable.** A style string that did not change
keeps its `.ntgoc-s<hash>` name across rebuilds, so step 5 shows only what really
moved instead of renaming all 359 classes. That is the whole reason for hashing
rather than numbering.

### What to merge, and what not to

- **Do merge**: copy, layout, colour, spacing, new sections, new views.
- **Do not merge back into `design-src/`**: portability fixes. Those belong in
  `tools/render.mjs`, in the `CORRECTIONS` table or the responsive layer, so they
  survive the next re-import automatically.
- **If a new view appears**, add it to `PAGES` and `CHUNK_NAMES` in
  `tools/render.mjs`. The renderer will not invent a filename for a route it has
  never been told about.
- **The Visit view now has parish copy spliced into it** from
  `content/visit-sections.html` (see `content/README.md`), and three of its FAQ
  answers are rewritten to point at those sections. If a re-import changes that
  FAQ copy, the build **fails loudly** — `applyVisitFaqEdits` throws rather than
  leave the page contradicting itself. Update the pattern, don't delete the check.
- **If new parish facts appear**, add them to `data/parish-facts.json` with a
  source URL, or tag them `<!-- TODO: verify -->`. Never let an unsourced claim
  through unflagged — that is the one thing this project exists to prevent.
