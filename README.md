# Nativity of the Theotokos — draft website preview

**⚠️ This is not the parish website.** It is an unofficial draft built by parish
volunteers to show the Parish Council what the Outreach / Evangelism /
Communications ministry could look like online. The real parish site is
<https://www.nativity.va.goarch.org/>.

**Live preview:** <https://simplythomas.github.io/nativity-demo/>

The preview is `noindex, nofollow`, disallowed in `robots.txt`, carries no Open
Graph tags, and shows a persistent banner on every page. It is built not to
compete with the real site in search, and not to be mistaken for it.

---

## Orientation

| Path | What it is |
|---|---|
| `design-src/` | The imported Claude Design files, **unmodified**. The source of truth for how the site looks. Read `design-src/README.md` first. |
| `tools/render.mjs` | Turns the design into 12 static HTML pages + `components.css`. |
| `tools/extract-chunks.mjs` | Turns those pages into paste-ready Evolution CMS chunks. |
| `dist/chunks/` | **Generated.** 35 chunks + an asset-rewritten stylesheet. What a volunteer pastes into EVO. |
| `data/parish-facts.json` | Every parish fact, its source URL, and whether it is verified, corrected, or withheld. |
| `IMPORT.md` | Step-by-step import instructions for a volunteer with no command line. |
| `assets/css/components.css` | **Generated.** Ships to EVO. |
| `assets/css/provisional.css` | Demo only. Contains a reset — never import it. |

The twelve `.html` files at the repo root are **generated**. Edit the design, not
the output.

## Building

No dependencies, no build step in the usual sense — two Node scripts, run in
order:

```sh
node tools/render.mjs          # design-src/ -> pages + CSS
node tools/extract-chunks.mjs  # pages -> dist/chunks/
```

The site works if you open `index.html` from disk.

## Design decisions worth knowing

- **Nothing requires JavaScript.** The design ships as a React single-page app;
  the renderer resolves it all at build time. One small script adds bookstore
  category filtering as pure enhancement. Everything is readable with JS off —
  that is the version that survives the move into Evolution CMS.
- **No CSS reset ships.** The design's global reset is quarantined in
  `provisional.css`, which is never referenced by any chunk.
- **Every class is prefixed `ntgoc-`,** so nothing collides with the Bootstrap
  4.1.3 template the live site runs on.
- **Class names are content-hashed and stable,** so re-importing from Claude
  Design produces a readable diff rather than renaming all 359 classes.
- **No unsourced parish fact goes unflagged.** 22 `<!-- TODO: verify -->` markers
  remain. See "What still has to be verified" in `IMPORT.md`.

## Status

Nothing here is authoritative. Nothing gets imported without Father's review of
the visitor-facing copy, and without the Parish Council's decision to proceed.
