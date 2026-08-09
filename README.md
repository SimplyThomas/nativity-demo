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
| `design-src/` | Archive of the original Claude Design import. **No longer an input** — the upstream link was cut on 2026-08-08. |
| `content/` | Reference copy of the eight parish-authored Visit sections. **No longer an input** — edit `visit.html`, then mirror the copy here. |
| `tools/lint.mjs` | Enforces the rules that used to be guaranteed by the renderer. Run by CI. |
| `tools/extract-chunks.mjs` | Turns those pages into paste-ready Evolution CMS chunks. |
| `dist/chunks/` | **Generated.** 70 chunks + an asset-rewritten stylesheet. What a volunteer pastes into EVO. |
| `data/parish-facts.json` | Every parish fact, its source URL, and whether it is verified, corrected, or withheld. |
| `data/parish-calendar.json` | The parish calendar, once. Rendered into three pages by `npm run parish`. |
| `data/parish-announcements.json` | Parish announcements, with optional expiry dates. Same build. |
| `IMPORT.md` | Step-by-step import instructions for a volunteer with no command line. |
| `CONTRIBUTING.md` | How to make changes, and the rules that must not break. |
| `assets/css/components.css` | **Generated.** Ships to EVO. |
| `assets/css/provisional.css` | Demo only. Contains a reset — never import it. |

The seventeen `.html` files at the repo root are the **source** — edit them
directly. The generated artefacts are `dist/chunks/`, and the five blocks
between `<!-- BUILD:… -->` markers that `npm run parish` renders from the two
calendar and announcement data files.

## Building

There is no build. The HTML and CSS are the source — edit them and reload.

```sh
npm install    # once, for the audit tools only
npm run dev    # http://localhost:4000
npm run lint   # the hardline rules, before you commit
npm run check  # lint + accessibility + reflow
```

`npm run chunks` regenerates `dist/chunks/` (the Evolution CMS import files);
`npm run dev` does it automatically on save. The site itself has no
dependencies and works if you open `index.html` from disk.

**Read `CONTRIBUTING.md` before editing** — it lists the rules that must not
break and why, all of which CI enforces on every push.


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
- **No unsourced parish fact goes unflagged.** 34 `<!-- TODO: verify -->` markers
  remain. See "What still has to be verified" in `IMPORT.md`.
- **Nobody's face or name goes up without asking.** The Visit page's "Faces You
  Might See" row ships as empty frames; the Parish Council block ships without
  names. Both are filled in only with each person's permission.

## Status

Nothing here is authoritative. Nothing gets imported without Father's review of
the visitor-facing copy, and without the Parish Council's decision to proceed.
