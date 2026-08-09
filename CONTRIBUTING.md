# Making changes

Short version: **the twelve `.html` files at the repo root are output, not
source.** So is `assets/css/components.css` and everything in `dist/chunks/`.
Editing them feels like it works, right up until the next build erases it.

```sh
npm install     # only needed for the audit tools
npm run dev     # http://localhost:4000, rebuilds when you save
```

`npm run dev` watches `design-src/`, `tools/` and `data/` — the things you
actually edit — and rebuilds on save. It deliberately does *not* watch the
generated HTML.

---

## Where does my change go?

| I want to change… | Edit this | Notes |
|---|---|---|
| Layout, spacing, colour, typography, copy, a whole new section | **The Claude Design project**, then re-import | Design is the source of truth for how it looks |
| A parish fact that is wrong | `CORRECTIONS` in `tools/render.mjs`, and record it in `data/parish-facts.json` | Always with a source, or tag it `TODO: verify` |
| Reorder, hide, or tweak a block without touching Design | `applyLocalEdits()` in `tools/render.mjs` | Warns on rebuild if it stops matching |
| How it behaves on a phone | the responsive layer at the bottom of the generated CSS, authored in `tools/render.mjs` | The design has no media queries of its own |
| A contrast or accessibility problem | `CONTRAST_FIX` / `DECLARATION_FIX` in `tools/render.mjs` | See `ACCESSIBILITY.md` |
| Which blocks become EVO chunks, or their names | `CHUNK_NAMES` in `tools/render.mjs` | |
| Add a page | `PAGES` **and** `CHUNK_NAMES` in `tools/render.mjs` | The renderer will not invent a filename for a route it hasn't been told about |
| The EVO asset path | `ASSET_ROOT` at the top of `tools/extract-chunks.mjs` | One line; rewrites every chunk and the stylesheet |
| Images | add to `assets/img/`, register in `IMAGES` in `tools/render.mjs` | Record provenance in `data/parish-facts.json` |
| Anything in `*.html`, `components.css`, `dist/chunks/` | **nowhere — it's generated** | Find the real source above |

---

## Why is it built this way?

Because the design has to keep flowing in from Claude Design, and the site has
to keep flowing out into Evolution CMS. Both ends are moving:

```
Claude Design  ->  design-src/  ->  render.mjs  ->  12 pages + CSS
                                                          |
                                                  extract-chunks.mjs
                                                          |
                                                    dist/chunks/  ->  paste into EVO
```

If pages were hand-maintained, every re-import from Design would mean manually
re-applying weeks of fixes — the contrast corrections, the verified facts, the
responsive layer, the chunk delimiters, the recovered content. Instead each of
those is a **rule**, so they survive re-import automatically and the diff after
a re-import shows only what genuinely changed in the design.

That is a real trade: you give up editing the HTML directly. In exchange the
corrections are durable and re-importing is a five-minute job instead of a day.

---

## If you already hand-edited a generated file

```sh
npm run verify
```

It snapshots every generated file, rebuilds, and tells you what moved. If your
edit was overwritten, the previous contents are saved to `.verify-backup/` so
you can diff and move the change somewhere durable.

Run it before committing. It exits non-zero on drift, so it also works as a
pre-commit hook:

```sh
printf '#!/bin/sh\nnpm run --silent verify\n' > .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

Two different things make `verify` fail, and they need opposite responses:

- **You hand-edited output.** The edit is gone; recover it from
  `.verify-backup/` and re-express it as a rule.
- **You changed a source and didn't commit the rebuild.** Harmless — review
  `git diff` and commit.

---

## A worked example

You move a card on the home page by editing `index.html`. It looks right in the
browser. The next `npm run build` erases it.

The durable version — this is genuinely in the repo, from exactly this mistake:

```js
// applyLocalEdits(), tools/render.mjs
const out = withinChunk(body, 'ntgocHomeServiceTimes', chunk => {
  const moved = moveCardLast(chunk, 'Afterwards');
  applied = moved !== null;
  return moved ?? chunk;
});
if (!applied) {
  console.warn('  ! local edit did not apply: home "Afterwards" card reorder.');
}
```

Note the warning. A rule that silently stops matching is worse than no rule, so
every local edit announces itself when the design shifts underneath it.

Better still, make the change in Claude Design and re-import — then it lives
with the rest of the design instead of as a patch on top of it.

---

## Checks before you push

```sh
npm run verify        # output matches sources
npm run audit:a11y    # axe-core, 12 pages x 2 viewports — expect 0 violations
npm run audit:reflow  # 320px reflow + focus indicators — expect 12/12
```

`extract-chunks.mjs` additionally refuses to emit any chunk containing an EVO
reserved sequence (`[[ ]]`, `[! !]`, `{{ }}`, `[* *]`, `[( )]`, `[~ ~]`, `[+ +]`)
and exits non-zero instead. If that fires, fix the source — never the chunk.

## Re-importing from Claude Design

Covered in `design-src/README.md`, including the DesignSync quirks and the known
defects in the design source. The short version: re-fetch both files, overwrite
`design-src/`, `git diff design-src/` to see what changed, rebuild, and review.
Class names are content-hashed, so unchanged styles keep their names and the
diff stays readable.
