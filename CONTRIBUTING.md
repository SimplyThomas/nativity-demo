# Making changes

**Edit the HTML and CSS directly.** They are the source.

```sh
npm install    # once — only for the audit tools
npm run dev    # http://localhost:4000
# edit index.html, visit.html, assets/css/components.css … and reload
npm run lint   # before you commit
```

That is the whole workflow. If you have used this repo before and remember
being told never to edit the HTML, that changed on **8 August 2026** — see
[What changed](#what-changed-and-why) below.

---

## Where things live

| File / folder | What it is |
|---|---|
| `*.html` (12 pages) | **Source.** Edit directly. |
| `assets/css/components.css` | **Source.** Ships to the parish CMS. |
| `assets/css/provisional.css` | **Source.** Demo only — contains a reset, never import it. |
| `assets/js/ntgoc-enhance.js` | **Source.** Progressive enhancement only. |
| `assets/img/` | Images, provenance recorded in `data/parish-facts.json`. |
| `dist/chunks/` | **Generated** by `npm run chunks`. Never edit — paste into EVO. |
| `data/parish-facts.json` | Every parish fact, its source, and whether it is verified. |
| `content/` | Parish-authored copy, kept for reference. Already spliced into `visit.html`. |
| `design-src/` | Archive of the original Claude Design import. No longer an input. |
| `tools/archive/` | The retired renderer. Do not run it — see its README. |

The **only** generated thing left is `dist/chunks/`. `npm run dev` keeps it in
step automatically; `npm run lint` fails if it has drifted.

---

## The rules that must not break

These are not style preferences. Each one exists because breaking it corrupts
the CMS import, breaks the live parish template, or publishes something that
should not be published. `npm run lint` enforces all of them, and CI runs it on
every push and pull request.

| Rule | Why |
|---|---|
| No `[[ ]]`, `[! !]`, `{{ }}`, `[* *]`, `[( )]`, `[~ ~]`, `[+ +]` in content | Evolution CMS interprets these and silently eats the surrounding markup |
| Every reusable block wrapped in `<!-- CHUNK:ntgocName -->` … `<!-- /CHUNK:ntgocName -->` | These delimiters are how the EVO chunks get extracted |
| A shared chunk (header, footer) must be byte-identical on every page | Otherwise the import silently takes one page's copy for the whole site |
| Every custom class prefixed `ntgoc-` | The live site runs Bootstrap 4.1.3; anything unprefixed can collide |
| No CSS reset and no bare element selectors in `components.css` | A reset pasted into EVO breaks the surrounding parish template |
| Image URLs in `components.css` are `../img/…` | URLs in a stylesheet resolve against the stylesheet, not the page |
| `noindex` + draft banner on every page, `robots.txt` disallowing all | This must never compete with the real parish site or be mistaken for it |
| No Open Graph tags | A shared link must not render a convincing preview card |
| One `<h1>` per page, no skipped heading levels | Accessibility floor |
| Unverified parish facts tagged `<!-- TODO: verify -->` | Never assert a service time or a name we cannot source |

Two further checks run in CI and are worth running locally before a big change:

```sh
npm run audit:a11y     # axe-core, WCAG 2.1 AA, 12 pages x 2 viewports
npm run audit:reflow   # 320px reflow + focus indicators
npm run check          # all three
```

### About the TODO markers

There are 30-odd `<!-- TODO: verify -->` comments in the pages. They are
invisible to visitors and they are **the point of this project** — each one
marks a claim nobody has confirmed. Do not delete one unless you have actually
verified the fact; when you do, record the source in `data/parish-facts.json`.
`IMPORT.md` lists what is still outstanding.

---

## Editing safely

**Adding a section?** Wrap it in chunk delimiters and give it an `ntgoc`-prefixed
camelCase name:

```html
<!-- CHUNK:ntgocVisitorParking -->
<section class="ntgoc-parking">
  <h2 class="ntgoc-h3">Where to park</h2>
</section>
<!-- /CHUNK:ntgocVisitorParking -->
```

**Adding CSS?** Put it in `components.css` as a single `.ntgoc-*` class, and keep
the responsive layer at the bottom of the file last so it still wins on source
order.

**Touching the header or footer?** Apply the identical change to all twelve
pages. `npm run lint` will tell you if you missed one — that is the check that
catches it, not code review.

**Adding a page?** Copy an existing one for the shell, and check `lint` passes:
it verifies the draft banner, `noindex`, the heading structure and the links.

---

## What changed, and why

Until 8 August 2026 the twelve pages were **generated** from a Claude Design
import by `tools/render.mjs`. Editing a page directly did nothing — the next
build erased it.

That made sense while the design was still arriving from upstream. Once the
import was complete it stopped earning its keep: every small copy change meant a
round trip through Claude Design instead of just editing the file.

So the upstream link was cut. Everything the renderer used to apply on each
build is now **baked permanently into the committed HTML and CSS** — the
contrast corrections, the verified facts, the responsive layer, the chunk
delimiters, the recovered content. Nothing was lost.

The trade is that those things are no longer re-applied automatically. That is
what `npm run lint` and CI are for: the disciplines the renderer used to
guarantee are now checked instead of regenerated.

`tools/archive/README.md` has the full before/after table, and explains how to
diff against a fresh design import if that is ever wanted again.
