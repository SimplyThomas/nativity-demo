# content/ — parish-authored sections (REFERENCE ONLY, stale)

> **No longer spliced in at build time, and no longer an input at all.** This
> copy was folded into `visit.html` directly by hand on 8 August 2026, the same
> day the Claude Design renderer was retired (see `/CLAUDE.md`, "Read this
> first — the history lies"). `visit.html` is the source now. Nothing reads
> this folder. Editing it does nothing. If it drifts from `visit.html`, delete
> it rather than "fix" it — a future contributor could otherwise mistake this
> for a live input, which is exactly the trap `design-src/` also sets.

| File | Was injected into (no longer happens) |
|---|---|
| `visit-sections.html` | `visit.html`, between the Sunday-morning timeline and the directions block |

## What this used to be

`design-src/` held what Claude Design produced, overwritten on every re-import;
this folder held copy written **by the parish** for sections the design source
never covered, so a re-import wouldn't silently destroy it. The now-archived
`tools/archive/render.mjs` read this file, filled `<!-- SLOT:... -->`
placeholders from `VISIT_GREETERS` and `VISIT_VIDEOS`, and spliced the result
into the Visit page at build time.

**Do not follow the old instruction to write inline `style=""` attributes
here.** That told the renderer what to lift into a hashed `.ntgoc-*` class.
There is no renderer, no lifting, and no hashed classes left (see
`CONTRIBUTING.md`, "Naming CSS classes"); a page with an inline `style=""`
fails `npm run lint` (rule 5) and fails CI. If the Visit page needs a change,
edit `visit.html` directly with an existing `.ntgoc-*` class, or add one to
`assets/css/components.css` following the naming convention.

The two rules that do still hold anywhere on the site — no unsourced claim
goes in unflagged, no EVO reserved sequences (`[[ ]]`, `[! !]`, `{{ }}`,
`[* *]`, `[( )]`, `[~ ~]`, `[+ +]`) — are documented once, in `CLAUDE.md` and
`CONTRIBUTING.md`. This folder does not need its own copy of them.
