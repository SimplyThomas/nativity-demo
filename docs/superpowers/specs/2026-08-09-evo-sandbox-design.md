# A local Evolution CMS sandbox for mock imports

**Date:** 2026-08-09
**Branch:** `feat/evo-sandbox`
**Status:** implemented and verified — 524 assertions passing on both versions
from a cold boot. Findings marked **found during implementation** below correct
what this document originally claimed.

## Why

`IMPORT.md` describes, in detail, how a volunteer pastes 58 chunks into the
parish's Evolution CMS. Nobody has ever run it. The version is *reported* as
1.4.x and unconfirmed, the chunk syntax has never been parsed by an actual EVO,
and `dist/chunks/_link-map.md` is a blank worksheet whose correctness is
assumed rather than tested.

This adds a disposable, local Evolution CMS — two of them — that comes up
pre-loaded with the whole draft site. It exists so that:

1. Someone can learn the Evolution manager UI before touching the parish's
   live install.
2. The claim "these chunks import cleanly" becomes a check that runs, rather
   than a paragraph in a document.
3. The 1.4.x-versus-3.x question can be settled by looking at both.

The sandbox is a development aid. It is not shipped, not part of CI, and not
referenced by the published site.

## Scope

**In:** two Evolution CMS instances (1.4.18 and 3.5.7) on one MariaDB, installed
non-interactively, seeded on first boot with all chunks, a template and 16
resources, plus a verification harness that asserts the rendered output matches
`dist/chunks/`.

**Out:** email, HTTPS, production hardening, multi-user permissions, browser
automation of the manager UI, and any attempt to reproduce the parish's real
resource tree or menu structure beyond the 16 source pages.

## Findings that shaped the design

These were established by reading the Evolution CMS sources at each tag before
the design was fixed. They are recorded because several are counter-intuitive.

| Finding | Consequence |
|---|---|
| No official EVO 1.4 Docker image exists. `dmi3yy/evolution-cms` carries only `nightly` and `arm64`, both 3.x. | Both images are built from the GitHub source tarballs. |
| ~~Both 1.4.18 and 3.5.7 commit their `vendor/` directory to the tag, so no Composer step is needed.~~ **Wrong for 3.x, found during implementation.** 3.5.7's installer calls `composer update --working-dir=core` itself (`cli-install.php:400`). | The 3.x image pre-runs Composer at build time so the runtime step is a fast no-op and a network-less boot still installs (the installer treats a Composer failure as a warning). |
| **3.5.7's source tarball is not a working tree.** Its `.gitattributes` contains `LICENSE export-ignore`, and that pattern matches *every* path component named LICENSE — so GitHub's archive omits `core/vendor/composer/composer/LICENSE`, which the bundled Composer opens on startup. The install dies in `composer update`. | The 3.x image `git clone`s the tag instead. `export-ignore` does not apply to clones. 1.4.18 is unaffected and still uses the tarball. |
| **3.5.7's installer must run with `install/` as the working directory** — `initEvo()` does `include '../index.php'`, a relative path. | The entrypoint `cd`s into `install/` for 3.x. 1.4's installer resolves its own path and does not care. |
| Both ship `install/cli-install.php`. | Installation is non-interactive; no web wizard on every boot. |
| **1.4.18's `--installData=n` installs the demo site.** `cli-install.php:110` reads `if ($installData == 'y') { $installData = 1; }` and everything downstream tests `if ($installData)`. The string `'n'` is truthy. | Pass `--installData=0`, which is falsy. The file's own usage comment shows `=n` and is wrong. |
| **EVO ships `ht.access`, not `.htaccess`,** and both versions install with friendly URLs on, 301-ing `index.php?id=N` to an alias. | The entrypoint copies `ht.access` to `.htaccess`, and both Dockerfiles change Apache's `AllowOverride None` to `All`. Without both, every page is a 404. |
| **A config file does not prove an install succeeded.** Both versions write their config before running migrations, so a failed install leaves the marker behind. | The "already installed?" check queries the database for `<prefix>site_templates` instead. A file check made the container skip the installer forever and crash-loop in the seeder. |
| **PHP's `ext-readline` will not build on `php:8.3`** — its configure insists on libedit, and `readline.c` then fails on the GNU-only `rl_mark` and `rl_pending_input`. | Not built. Nothing needs it, and its absence turns a bad installer argument into an immediate error rather than a hang. |
| The installers take **completely different arguments**. 1.4.18: `--database_server --database_user --table_prefix --cmsadmin --mode=new --installData=n`. 3.5.7: `--typeInstall --databaseType --databaseServer --databaseUser --tablePrefix --cmsAdmin --cmsPassword`, with no `--mode` or `--installData`. | The install step is per-version. There is no shared invocation. |
| 3.5.7's installer falls back to interactive `readline()` when an argument is missing or invalid (`install/cli-install.php:245`, `:301`). | The entrypoint must run it with stdin from `/dev/null` under `timeout`, so a bad argument fails fast instead of hanging the container forever. |
| Both versions store chunks in `site_htmlsnippets`, templates in `site_templates`, resources in `site_content`, with compatible columns (`name`/`description`/`snippet`, `templatename`/`content`) and defaults on every column. | One seeder, plain INSERTs, no version-specific column lists. |
| 3.5.7 adds `site_content_closure`, a hierarchy table 1.4.18 does not have. | The seeder writes closure rows on 3.x, mirroring the shape of the installer's own default document rather than guessing the convention. |
| **3.x keeps its cache in `core/storage/bootstrap/`, not `core/storage/cache/`.** Clearing the wrong directory leaves `siteCache.idx.php` holding a pre-seed alias listing. | Every seeded page 404s while the CMS quietly serves the default document, and nothing logs it. Cost an hour; the seeder now clears both locations. |
| 3.5.7 still implements `{{ }}`, `[* *]`, `[( )]` and `[~ ~]` (`core/src/Core.php:1717`, `:1460`, `:1656`, `:2707`). | The same 58 chunks and the same resource bodies work unmodified on both versions. `IMPORT.md`'s 3.x warning is about the manager's handling of elements, not about tag syntax. |
| `tools/lint.mjs:46` applies the EVO reserved-sequence rule only to the root pages, `assets/css/components.css` and `dist/chunks/`. | Files under `tools/evo-sandbox/` may contain `{{chunkName}}` and `[~id~]`, which they must, since resource bodies are made of them. |
| `tools/lint.mjs` scans `.md` files at the repo root and in `design-src/`, `content/` and `data/`. | This spec and `tools/evo-sandbox/README.md` are outside every doc rule, including `stale-count`. |

## Architecture

One MariaDB, two databases, two web services.

| Service | Image | Port | Database |
|---|---|---|---|
| `db` | `mariadb:10.11` | not published | `evo14`, `evo35` |
| `evo14` | built on `php:7.4-apache` | `127.0.0.1:8014` | `evo14` |
| `evo35` | built on `php:8.3-apache` | `127.0.0.1:8035` | `evo35` |

One database server rather than two keeps the container count down and lets both
schemas be compared from a single `docker compose exec db mysql`. The PHP
versions are forced apart by the CMSes: 3.5.7's `composer.json` requires
`^8.3`, and 1.4.18 is a PHP 5.6-era codebase that should not run under 8.3.

Each Dockerfile installs the PHP extensions that version needs, obtains the
source, enables `mod_rewrite` and loosens `AllowOverride` so EVO's `.htaccess`
takes effect. The two diverge in how they get the source and what they build:
1.4.18 takes the release tarball and needs only `mysqli` and `pdo_mysql` — no
`apt-get` at all, which matters because its Debian bullseye base is heading for
archive. 3.5.7 is cloned (see the findings table), adds `zip`, and pre-runs
Composer at build time.

The webroot of each EVO service is a **named volume**, so manager edits survive
`docker compose restart`. `npm run evo:reset` (`docker compose down -v`) is the
reset button.

Ports bind to `127.0.0.1` only.

## Boot sequence

`entrypoint.sh` is shared and branches on `$EVO_MAJOR`:

1. **Wait for the database** — PDO connect in a retry loop with a bounded
   ceiling, then exit non-zero. Prevents a half-installed CMS from `depends_on`
   racing.
2. **Install, once.** Skipped if `manager/includes/config.inc.php` already names
   a database. Otherwise run that version's `cli-install.php` invocation, with
   `</dev/null` under `timeout`.
3. **Seed** — `php /opt/ntgoc/seed.php`.
4. `exec apache2-foreground`.

## Seeding

`seed.php` runs inside the container, over PDO, reading `dist/chunks/` mounted
read-only at `/opt/ntgoc/chunks`. It is idempotent: it looks each record up by
name and updates or inserts, so `npm run evo:seed` can re-push after
`npm run chunks` without a rebuild.

It writes three things, mirroring `IMPORT.md` steps 4–6:

- **The chunks** into `site_htmlsnippets` — every `dist/chunks/*.html` except the
  `_`-prefixed files. Name is the filename without `.html`; description is taken
  from the header comment; body is everything after that comment.
- **One template** into `site_templates`, carrying the vendored GOARCH `<head>`,
  the header chunk calls, `[*content*]`, and the footer chunk call.
- **16 resources** into `site_content`, one per source page, each body a list of
  `{{chunkName}}` calls. The page-to-chunk order is read from the
  `<!-- CHUNK:name -->` markers in the source pages rather than from IMPORT.md's
  table, so it cannot drift; that also means `festival.html` is seeded even
  though nothing links to it. Resources are written with `richtext = 0`, so
  opening one in the manager cannot let TinyMCE rewrite its own body. On 3.5.7
  the `site_content_closure` rows are written too.

Then the part that earns the exercise. The chunks carry 60 internal links as
`<a href="#" data-ntgoc-link="about">` placeholders across 23 chunks, and
`_link-map.md` is a worksheet a volunteer fills in by hand. **The seeder resolves
them**: once the resources exist it knows each page's real EVO id, and rewrites
every placeholder to `[~<id>~]`. If a placeholder names a page with no resource,
it aborts and says which chunk. The ids differ between the two versions, which
is itself worth seeing — the link map is per-installation, not a constant.

Its last step is to clear EVO's page and alias caches — `assets/cache/` on 1.4,
`core/storage/bootstrap/` on 3.x — because writing to the tables behind the
CMS's back leaves stale cached pages. It also writes `seed-manifest.json` into
the webroot: the alias-to-id mapping, served over HTTP, which the host-side
verifier needs and which doubles as the filled-in `_link-map.md`.

## Verification

`npm run evo:verify` runs on the host and fetches every seeded page from both
`:8014` and `:8035`, asserting:

- **HTTP 200** on all 16 pages on both versions.
- **No unresolved tags in the output.** A literal `{{`, `[~` or `[*` in rendered
  HTML means the parser did not consume it. This is the most valuable assertion,
  because it catches EVO silently eating markup — the failure mode CLAUDE.md
  rule 1 exists for.
- **Round-trip fidelity.** For each chunk, the rendered page must still contain
  the `.ntgoc-*` class markers and text of the corresponding
  `dist/chunks/*.html`. This is what turns "these chunks are importable" into a
  measured claim.
- **Every `data-ntgoc-link` resolved** — no `href="#"` left behind.

Two things it deliberately does not cover, stated rather than papered over: it
exercises the CLI and database path, so it does **not** prove that a human
pasting into the manager textarea gets the same result, and it cannot test
TinyMCE mangling, since avoiding TinyMCE is the entire point of the chunk
approach. Both stay manual; the sandbox gives them a place to happen.

## Template fidelity and vendored assets

The seeded template mirrors the live parish template. The live site loads
Bootstrap 4.1.3, jQuery, Popper, FontAwesome 5.2 and Google Fonts from public
CDNs, and four stylesheets plus one script from its own server.

**CDN resources stay as CDN links**, exactly as the live template writes them.
Vendoring them would add megabytes for no fidelity gain. Consequence: the
sandbox needs internet access to *look* right, though it boots and serves
without it.

**The five parish-server files are vendored** into
`tools/evo-sandbox/vendor-assets/` — about 30 KB total:

| File | Size | Owner |
|---|---|---|
| `assets/templates/common/css/template.css` | 8.9 KB | Archdiocese (shared template) |
| `assets/templates/common/css/content.css` | 14.9 KB | Archdiocese (shared template) |
| `assets/templates/common/js/main.js` | 4.7 KB | Archdiocese (shared template) |
| `assets/templates/t05.css` | 1.2 KB | Archdiocese (shared template) |
| `assets/templates/custom.css` | 155 B | parish |

**This was a considered decision with a known cost.** Committing
Archdiocese-owned template assets into a public repository is the same
provenance problem `data/parish-facts.json` already records for the GOARCH seal
images, and this repo's first rule is that it must never be mistaken for the
real site. The alternative — fetching at build time into the container only —
was offered and declined in favour of reproducible offline builds.

The mitigation is disclosure, using the repo's existing mechanism: a new
top-level `templateAssetProvenance` key in `data/parish-facts.json` (a sibling
of `assetProvenance`, so the existing lint check on `facts` is unaffected),
recording for each file its source URL, fetch date, owner, and the fact that it
is present for local sandbox use only, is not served by GitHub Pages, and that
redistribution is an open question for DIM.

The parish's own images are mounted read-only from `assets/img/` at
`/assets/templates/ntgoc/img/`, matching the path `IMPORT.md` step 2 specifies.

## Repository surface

```
tools/evo-sandbox/
  docker-compose.yml
  .env.example
  README.md
  evo14/Dockerfile
  evo35/Dockerfile
  entrypoint.sh
  seed.php
  verify.mjs
  template/ntgoc.tpl
  vendor-assets/
  db-init/01-databases.sh
docs/superpowers/specs/2026-08-09-evo-sandbox-design.md
```

New npm scripts: `evo:up`, `evo:down`, `evo:seed`, `evo:verify`, `evo:reset`,
`evo:logs`.

At the time of writing the verifier reports **524 assertions passed, 0 failed**,
from a cold boot on empty volumes.

`npm run check` is **not** modified. The sandbox must not become a CI
dependency; CI has no Docker daemon.

## Failure modes

| Failure | Handling |
|---|---|
| 3.5.7 installer hits a missing argument and prompts | stdin `</dev/null` under `timeout`; fails fast and loud |
| Database not ready | bounded PDO retry loop, then non-zero exit |
| Re-run against an installed instance | install skipped when `config.inc.php` names a database; seeder upserts by name |
| Stale cached pages after direct DB writes | seeder empties the cache directories as its last step |
| `data-ntgoc-link` names a page with no resource | seeder aborts, naming the chunk and the bad target |
| Chunks regenerated but not re-seeded | `evo:verify` fails the round-trip diff and names the chunk |
| No Docker daemon | only the `evo:*` scripts fail; `lint` and `check` are untouched |

## Security posture

Localhost-bound ports, a dev-default admin password in `.env.example`, no HTTPS,
no email. The sandbox is disposable and must never be exposed to a network. The
`.env` file itself is gitignored.
