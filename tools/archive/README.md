# tools/archive/ — the retired Claude Design renderer

**Nothing here runs as part of the normal workflow.** `render.mjs` is kept for
reference, not for use.

## What happened

Until 8 August 2026 this site was *generated*: `design-src/Nativity Website.dc.html`
came from Claude Design, and `render.mjs` turned it into the twelve HTML pages
and `components.css` on every build. Editing a page directly was pointless — the
next build erased it.

That upstream link is now cut. **The HTML and CSS in this repo are the source.**
Edit them directly. See `CONTRIBUTING.md`.

## ⚠️ Do not just run it

`node tools/archive/render.mjs` would **overwrite the pages it knows about and
`components.css`** with output regenerated from the old design file — destroying
every hand edit made since the switch. It is archived here precisely so that
running it is a deliberate act, not an accident.

If you ever do need it, work on a branch and diff before keeping anything.

## What it did, and where that lives now

Everything the renderer used to enforce on each build is now baked into the
committed HTML and CSS. It is permanent, not lost — but it is also no longer
re-applied automatically, so it is now your job to preserve it when editing.
`npm run lint` checks the parts that can be checked mechanically.

| The renderer used to… | Now |
|---|---|
| Resolve `sc-if` / `sc-for` / `{{ }}` into static HTML | Baked in — the pages are plain HTML |
| Lift 734 inline styles into `.ntgoc-*` classes | Baked into `components.css` |
| Correct verified parish facts | Baked into the pages; sources in `data/parish-facts.json` |
| Darken six colours to reach 4.5:1 contrast | Baked into `components.css` — see `ACCESSIBILITY.md` |
| Add the responsive layer (the design has no media queries) | Baked in, at the end of `components.css` |
| Insert `<!-- CHUNK:… -->` delimiters | Baked into the pages — **keep them** when editing; `npm run lint` checks |
| Promote clickable `<span>`s to real `<a>` with `.ntgoc-inherit` | Baked in |
| Normalise heading levels so no page skips one | Baked in — `npm run lint` re-checks |
| Recover content the design orphaned (Visit FAQ + directions) | Baked into `visit.html` |
| Splice `content/visit-sections.html` into the Visit page | Baked in; `content/` is now reference copy, not an input |

## If you want to re-import the design later

The old pipeline still works in principle. `design-src/README.md` documents the
DesignSync calls, the quirks, and the known defects in the design file. The
realistic approach is:

1. Re-import to `design-src/` on a branch.
2. Run this renderer into a scratch directory, not over the repo.
3. Diff that output against the current pages to see what the design changed.
4. Port the wanted changes across by hand.

Class names are content-hashed, so unchanged styles keep their names and that
diff stays readable — which is what makes step 3 tractable.
