# content/ — parish-authored sections (REFERENCE)

> **No longer spliced in at build time.** These sections are now part of
> `visit.html` directly, like the rest of the page. This folder is kept as the
> clean, un-marked-up record of the parish's own copy. See `CONTRIBUTING.md`.

Everything else on this site is generated from `design-src/Nativity Website.dc.html`.
This folder is the exception: it holds copy written **by the parish**, for pages
the Claude Design source does not cover.

| File | Injected into |
|---|---|
| `visit-sections.html` | `visit.html`, between the Sunday-morning timeline and the directions block |

## Why it is not in `design-src/`

`design-src/` is the record of what Claude Design produced, and it is overwritten
verbatim on every re-import (see `design-src/README.md`). Copy written here would
be silently destroyed the first time somebody re-syncs the design. Keeping it in
`content/` means a re-import changes the design-derived sections and leaves these
alone.

## How it gets onto the page

The archived renderer read this file, filled its `<!-- SLOT:... -->` placeholders from
the `VISIT_GREETERS` and `VISIT_VIDEOS` tables in that script, and splices the
result into the Visit page's `<main>` after the second top-level block. Each
`<section>` then becomes its own EVO chunk, exactly like the design-derived ones.

Write it the way the design writes markup: **inline `style=""` attributes**, reusing
style strings that already appear in the design where you can. The renderer lifts
every inline style into a hashed `.ntgoc-*` class, so an identical style string
costs nothing — it reuses the class the design already generated.

Two rules carried over from the rest of the project:

1. **No unsourced claim goes in unflagged.** Anything that needs Father, the office,
   or a parishioner's permission gets `<!-- TODO: verify -->` next to it, and a line
   in `IMPORT.md` under "What still has to be verified".
2. **No EVO reserved sequences**: `[[ ]]`, `[! !]`, `{{ }}`, `[* *]`, `[( )]`,
   `[~ ~]`, `[+ +]`. `tools/extract-chunks.mjs` refuses to write a chunk containing
   one. This is why placeholders here read `Photo to come` rather than `[PHOTO]`.

Rebuild after editing:

```sh
npm run chunks
node tools/extract-chunks.mjs
```
