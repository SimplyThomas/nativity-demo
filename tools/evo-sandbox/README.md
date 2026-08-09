# A local Evolution CMS to rehearse the import in

`IMPORT.md` describes how a volunteer pastes this draft into the parish's
Evolution CMS. Until now nobody had run it, and the parish's version is
*reported* as 1.4.x and unconfirmed.

This brings up two disposable Evolution CMS instances, pre-loaded with the whole
draft site, so you can learn the manager before touching anything real — and so
"these chunks import cleanly" becomes a check with an exit code.

| | Version | URL | Manager |
|---|---|---|---|
| `evo14` | 1.4.18 — what the parish reportedly runs | <http://localhost:8014> | <http://localhost:8014/manager/> |
| `evo35` | 3.5.7 — the current release | <http://localhost:8035> | <http://localhost:8035/manager/> |

Default login `admin` / `ntgoc-sandbox`. Change it in `.env` if you like; see
`.env.example`. Both ports bind to localhost only.

```sh
npm run evo:up       # build and start (first run: several minutes)
npm run evo:verify   # prove the chunks render correctly on both
npm run evo:seed     # re-push chunks after `npm run chunks`
npm run evo:logs     # follow
npm run evo:down     # stop, keep the databases
npm run evo:reset    # destroy everything and start over
```

This is a development aid. It is not part of `npm run check` — CI has no Docker
daemon — and nothing here is published.

---

## What is already in there

Each instance boots empty, installs itself with no web wizard, then seeds:

- **every chunk** in `dist/chunks/*.html`, into Elements → Chunks
- **one template**, `NTGOC Draft`, holding the `<head>`, the four shell chunks
  and `[*content*]`
- **one resource per source page**, each body a list of `{{chunkName}}` calls

Counts are deliberately not written down here — the seeder reads whatever is in
the repo, so a number in this file would only rot. It prints what it did, and
`seed-manifest.json` records it.

The page → chunk order is read from the `<!-- CHUNK:name -->` markers in the
repo's source pages, not from IMPORT.md's table, so it cannot drift.

**The internal links are resolved.** The chunks ship their internal links as
`<a href="#" data-ntgoc-link="about">` placeholders and `_link-map.md` is a
worksheet for filling them in by hand. The seeder knows each page's real
resource id and rewrites them to `[~id~]`. The finished mapping is served at
`/assets/templates/ntgoc/seed-manifest.json` on each instance — the filled-in
version of that worksheet. The ids differ between the two installations, which
is the point: the link map is per-installation, not a constant.

## What `npm run evo:verify` proves

For every seeded page, on each running version:

1. HTTP 200.
2. No unresolved `{{ }}`, `[~ ~]`, `[* *]`, `[( )]`, `[[ ]]` or `[! !]` in the
   rendered output. A literal tag surviving into the HTML means the parser did
   not consume it — the silent-corruption failure mode CLAUDE.md rule 1 exists
   for.
3. Round-trip fidelity: every literal run of every expected chunk still appears
   in the rendered page.
4. No `href="#"` placeholder left unresolved.

On 9 August 2026 that was 290 assertions across 17 pages and 73 chunks, all
passing on 1.4.18. An instance that is not running is reported as skipped rather
than failed, so stopping `evo35` once the parish's version is settled does not
turn the check red.

## What it does not prove, and what you should do by hand

Verification drives the database. It says nothing about a human pasting into the
manager, and it cannot test TinyMCE mangling — the hazard IMPORT.md section 3
calls the afternoon-waster — because avoiding TinyMCE is the entire reason the
draft is built out of chunks.

Worth doing manually, in that order:

1. **Reproduce the TinyMCE damage on purpose.** Open a resource, tick Rich Text
   on, save, reopen. Compare against `dist/chunks/`. Seeing it once is worth
   more than the warning in IMPORT.md. Resources are seeded with `richtext = 0`
   precisely so this does not happen by accident.
2. **Paste one chunk by hand.** Elements → Chunks → New Chunk, name it
   `ntgocScratch`, paste a `dist/chunks/*.html` body, call it from a resource.
   This is the actual volunteer workflow, end to end.
3. **Compare the two managers.** Elements and Templates are organised
   differently in 1.4 and 3.x. If you can get the parish's real version
   confirmed, this is where you find out what that means for IMPORT.md.

## Things that cost time to find out

Recorded because none of them are guessable, and the next person will otherwise
lose the same afternoon.

- **`--installData=n` installs the demo site.** `cli-install.php:110` in 1.4.18
  reads `if ($installData == 'y') { $installData = 1; }` and everything
  downstream tests `if ($installData)`. The string `'n'` is truthy. Pass
  `--installData=0`.
- **The 3.5.7 source tarball is not a working tree.** Its `.gitattributes` has
  `LICENSE export-ignore`, and that pattern matches *every* path component named
  LICENSE — so GitHub's tarball omits
  `core/vendor/composer/composer/LICENSE`, which the bundled Composer opens on
  startup. The install dies in `composer update`. Clone the tag instead;
  `export-ignore` does not apply to clones.
- **3.5.7's installer must run from `install/`.** `initEvo()` does
  `include '../index.php'`, a relative path.
- **3.5.7's installer prompts interactively** when an argument is missing or
  invalid, which in a container is an unkillable hang. The entrypoint closes
  stdin and wraps it in `timeout`.
- **The two installers share no argument names.** 1.4 wants
  `--database_server --cmsadmin --table_prefix`; 3.x wants `--databaseServer
  --cmsAdmin --tablePrefix --typeInstall --databaseType`.
- **EVO ships `ht.access`, not `.htaccess`,** and installs with friendly URLs
  on. Until it is renamed — and `AllowOverride` is loosened from the php:apache
  default of `None` — every page is a 404.
- **3.x keeps its cache in `core/storage/bootstrap/`, not
  `core/storage/cache/`.** Clear the wrong one after writing to the tables and
  `siteCache.idx.php` keeps a pre-seed alias listing: every new page 404s while
  the CMS quietly serves the default document instead. Nothing logs it.
- **`/manager/` returns 404 to `curl` and 200 to a browser.** Not a fault in the
  sandbox: `manager/includes/accesscontrol.inc.php:6` 404s, with an empty body
  and no log line, any request that arrives without an `Accept-Language` header.
  It is a crude bot guard, and every browser sends one. Add
  `-H 'Accept-Language: en'` when testing the manager from the command line.
- **After a rebase or branch switch, re-create the containers.** Git replaces
  the `dist/chunks` directory rather than editing it in place, which leaves the
  bind mount pointing at an inode that no longer exists. The container then sees
  an empty directory and the seeder aborts with "no chunks found" while the host
  directory is plainly full. `npm run evo:up` passes `--force-recreate` for exactly this
  reason, so re-running it fixes the mount; the named volumes persist, so
  nothing is lost and nothing needs rebuilding.
- **`ext-readline` is deliberately not built** into the 3.x image. On PHP 8.3 its
  configure insists on libedit, which then fails to compile. Nothing here needs
  it, and its absence turns a bad installer argument into an immediate error
  rather than a hang.

## Layout

```
docker-compose.yml    db + evo14 + evo35
entrypoint.sh         populate webroot, wait for db, install once, seed
seed.php              the seeder; runs in both containers, PHP 7.4 compatible
verify.mjs            host-side assertions
template/ntgoc.tpl    the EVO template body
vendor-assets/        the live site's own CSS and JS — see below
db-init/              creates the second database
```

## A note on `vendor-assets/`

To make the sandbox look like the real site, it serves the parish template's own
stylesheets: `common/css/template.css`, `common/css/content.css`,
`common/js/main.js`, `t05.css` and `custom.css`, fetched from
<https://www.nativity.va.goarch.org/> on 2026-08-09 and committed here.

Four of those five are Archdiocese-owned shared template files, not the
parish's. They are here for local rendering only, are not served by GitHub
Pages, and redistributing them is an open question for the Department of
Internet Ministries. The provenance is recorded in `data/parish-facts.json`
under `templateAssetProvenance`, alongside the same question about the GOA seal
images.

Bootstrap 4.1.3, FontAwesome, jQuery, Popper and Google Fonts load from the same
public CDNs the live template uses, so the sandbox needs internet access to look
right. It boots and serves without it.
