#!/usr/bin/env node
/**
 * lint.mjs — the hardline rules, enforced.
 *
 *   npm run lint
 *
 * These pages used to be generated, and the renderer guaranteed all of this on
 * every build. The pages are hand-edited now, so the guarantees have to be
 * checked instead. Every rule here exists because breaking it either corrupts
 * the Evolution CMS import, breaks the live parish template, or publishes
 * something that should not be published.
 *
 * Exits non-zero on any error. Warnings do not fail the build.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGES = readdirSync(ROOT).filter(f => f.endsWith('.html')).sort();

const errors = [];
const warnings = [];
const err = (rule, file, msg) => errors.push({ rule, file, msg });
const warn = (rule, file, msg) => warnings.push({ rule, file, msg });
const read = rel => readFileSync(join(ROOT, rel), 'utf8');

/* ------------------------------------------------------------------ *
 * 1. EVO reserved sequences
 *    The CMS parser interprets these and silently eats or corrupts the
 *    surrounding markup. They must not appear in content anywhere.
 * ------------------------------------------------------------------ */
const RESERVED = [
  ['[[', ']]', 'cached snippet call'], ['[!', '!]', 'uncached snippet call'],
  ['{{', '}}', 'chunk call'], ['[*', '*]', 'template variable'],
  ['[(', ')]', 'system setting'], ['[~', '~]', 'link by resource id'],
  ['[+', '+]', 'placeholder'],
];

const chunkFiles = existsSync(join(ROOT, 'dist/chunks'))
  ? readdirSync(join(ROOT, 'dist/chunks')).filter(f => f.endsWith('.html') || f.endsWith('.css'))
  : [];

for (const rel of [...PAGES, 'assets/css/components.css', ...chunkFiles.map(f => `dist/chunks/${f}`)]) {
  const body = read(rel);
  for (const [open, close, meaning] of RESERVED) {
    if (body.includes(open) || body.includes(close)) {
      err('evo-reserved', rel, `contains ${open} ${close} (${meaning}) — EVO will corrupt this`);
    }
  }
}

/* ------------------------------------------------------------------ *
 * 2. Chunk delimiters — balanced, matched, uniquely named
 * ------------------------------------------------------------------ */
const chunkBodies = new Map();
for (const rel of PAGES) {
  const body = read(rel);
  const opens = [...body.matchAll(/<!-- CHUNK:(\w+) -->/g)].map(m => m[1]);
  const closes = [...body.matchAll(/<!-- \/CHUNK:(\w+) -->/g)].map(m => m[1]);

  for (const name of opens) {
    if (!closes.includes(name)) err('chunk-unclosed', rel, `<!-- CHUNK:${name} --> is never closed`);
    if (!/^ntgoc[A-Z]/.test(name)) err('chunk-name', rel, `chunk "${name}" must be ntgoc-prefixed camelCase`);
  }
  for (const name of closes) {
    if (!opens.includes(name)) err('chunk-unopened', rel, `<!-- /CHUNK:${name} --> has no opening marker`);
  }
  for (const m of body.matchAll(/<!-- CHUNK:(\w+) -->([\s\S]*?)<!-- \/CHUNK:\1 -->/g)) {
    const [, name, inner] = m;
    const normalised = inner.replace(/ aria-current="page"/g, '').trim();
    const seen = chunkBodies.get(name);
    // A shared chunk (header, footer) must be identical everywhere it appears,
    // or the EVO import silently picks one page's copy for the whole site.
    if (seen && seen.body !== normalised) {
      err('chunk-drift', rel, `chunk "${name}" differs from the copy in ${seen.file} — they must match`);
    } else if (!seen) {
      chunkBodies.set(name, { body: normalised, file: rel });
    }
  }
}

/* ------------------------------------------------------------------ *
 * 2b. Well-formed markup
 *
 * The single easiest mistake to make now that these pages are hand-edited is
 * dropping or doubling a closing tag. Browsers paper over it, so the page can
 * look fine while the extracted chunk is broken — and that chunk is what gets
 * pasted into the parish CMS. Checked here, and BEFORE chunk extraction, so
 * the reported error is the real cause rather than "chunks are stale".
 * ------------------------------------------------------------------ */
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr']);

function checkWellFormed(rel) {
  const src = read(rel)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');

  const lineAt = i => src.slice(0, i).split('\n').length;
  const stack = [];
  let bad = 0;

  for (const m of src.matchAll(/<(\/?)([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g)) {
    const [, closing, rawTag, attrs, selfClose] = m;
    const tag = rawTag.toLowerCase();
    if (VOID.has(tag) || selfClose) continue;

    if (!closing) { stack.push({ tag, line: lineAt(m.index) }); continue; }

    if (!stack.length) {
      err('html-malformed', rel, `stray </${tag}> at line ${lineAt(m.index)}`); bad++; continue;
    }
    if (stack[stack.length - 1].tag === tag) { stack.pop(); continue; }

    const at = stack.map(f => f.tag).lastIndexOf(tag);
    if (at === -1) {
      err('html-malformed', rel, `stray </${tag}> at line ${lineAt(m.index)}`); bad++;
    } else {
      for (const f of stack.slice(at + 1)) {
        err('html-malformed', rel, `<${f.tag}> opened at line ${f.line} is never closed`); bad++;
      }
      stack.length = at;
    }
    if (bad > 6) return true;          // enough to diagnose; stop the noise
  }
  for (const f of stack) {
    err('html-malformed', rel, `<${f.tag}> opened at line ${f.line} is never closed`); bad++;
  }
  return bad > 0;
}

let malformed = false;
for (const rel of PAGES) malformed = checkWellFormed(rel) || malformed;

/* ------------------------------------------------------------------ *
 * 3. Draft-preview safety — this must never be mistaken for the real site
 * ------------------------------------------------------------------ */
for (const rel of PAGES) {
  const body = read(rel);
  if (!/<meta name="robots"[^>]*noindex/i.test(body)) err('noindex', rel, 'missing <meta name="robots" ... noindex>');
  if (!body.includes('ntgoc-draft-banner')) err('draft-banner', rel, 'missing the draft-preview banner');
  if (!/<html lang="[a-z]{2}/i.test(body)) err('lang', rel, 'missing lang on <html>');
  if (/property="og:|name="twitter:/i.test(body)) {
    err('opengraph', rel, 'has Open Graph/Twitter tags — a shared link must not preview as the real parish site');
  }
}
/* ------------------------------------------------------------------ *
 * 3b. Favicon links — the one part of the shell sync-shell cannot carry
 *
 * The header and footer travel between pages as chunks, so `npm run shell`
 * keeps them identical. The <head> is not chunked and never will be — in EVO
 * the template owns it — so the icon <link>s are the one shared thing that a
 * new page silently misses. That is exactly what happened to the four pages
 * added on 2026-08-09: they had the seal in the header and footer and no
 * favicon at all. Nothing else here would have caught it.
 * ------------------------------------------------------------------ */
const ICONS = [
  ['assets/img/goa-seal.png', '196x196'],
  ['assets/img/goa-seal-32.png', '32x32'],
  ['assets/img/goa-seal-16.png', '16x16'],
  ['assets/img/goa-seal-apple-touch.png', '152x152'],
];
for (const rel of PAGES) {
  const head = read(rel).split(/<\/head>/i)[0];
  for (const [href, sizes] of ICONS) {
    if (!head.includes(href)) {
      err('favicon', rel, `<head> is missing the ${sizes} icon link to ${href}`);
    }
  }
}

if (!existsSync(join(ROOT, 'robots.txt'))) err('robots', 'robots.txt', 'missing');
else if (!/Disallow:\s*\/\s*$/m.test(read('robots.txt'))) err('robots', 'robots.txt', 'does not disallow all crawlers');
if (!existsSync(join(ROOT, '.nojekyll'))) err('nojekyll', '.nojekyll', 'missing — GitHub Pages will not serve files verbatim');

/* ------------------------------------------------------------------ *
 * 4. Heading structure — one h1, no skipped levels
 * ------------------------------------------------------------------ */
for (const rel of PAGES) {
  const body = read(rel);
  const levels = [...body.matchAll(/<h([1-6])[\s>]/g)].map(m => +m[1]);
  const h1 = levels.filter(l => l === 1).length;
  if (h1 !== 1) err('heading-h1', rel, `expected exactly one <h1>, found ${h1}`);
  levels.forEach((lvl, i) => {
    if (i && lvl > levels[i - 1] + 1) err('heading-skip', rel, `jumps h${levels[i - 1]} -> h${lvl}`);
  });
}

/* ------------------------------------------------------------------ *
 * 5. CSS that has to survive being pasted into the live Bootstrap template
 * ------------------------------------------------------------------ */
{
  const css = read('assets/css/components.css').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of css.matchAll(/(^|\})\s*([^@{}][^{}]*?)\s*\{/g)) {
    for (const sel of m[2].split(',').map(s => s.trim()).filter(Boolean)) {
      if (sel.startsWith(':root') || sel.startsWith('@') || sel.startsWith('from') || sel.startsWith('to')) continue;
      if (/^[a-z][\w-]*(\s*[,:]|\s*$)/i.test(sel) && !sel.includes('.')) {
        err('css-bare-selector', 'assets/css/components.css',
          `bare element selector "${sel}" would restyle the live parish template`);
      }
      for (const cls of sel.match(/\.[-\w]+/g) || []) {
        if (!cls.startsWith('.ntgoc-')) {
          err('css-prefix', 'assets/css/components.css', `selector "${sel}" uses un-prefixed class ${cls}`);
        }
      }
    }
  }
  if (/(^|\})\s*\*\s*\{/.test(css) || /(^|\})\s*html\s*[,{]/.test(css)) {
    err('css-reset', 'assets/css/components.css', 'contains a reset — this will break the surrounding EVO template');
  }
  // Image URLs in a stylesheet resolve against the stylesheet, not the page.
  for (const m of css.matchAll(/url\(['"]?([^'")]+)['"]?\)/g)) {
    const u = m[1];
    if (u.startsWith('assets/')) {
      err('css-url', 'assets/css/components.css',
        `url(${u}) resolves against assets/css/ — use ../img/… instead`);
    }
    if (u.startsWith('../')) {
      const p = join(ROOT, 'assets/css', u);
      if (!existsSync(p)) err('missing-asset', 'assets/css/components.css', `url(${u}) does not exist`);
    }
  }
}

/* provisional.css is demo-only and must never be referenced by a chunk. */
for (const f of chunkFiles) {
  if (read(`dist/chunks/${f}`).includes('provisional.css')) {
    err('provisional-leak', `dist/chunks/${f}`, 'references provisional.css — that stylesheet is a reset and must not ship');
  }
}

/* ------------------------------------------------------------------ *
 * 6. Class prefixing in the markup
 * ------------------------------------------------------------------ */
const ALLOWED = new Set(['ntgoc']);   // everything custom must start ntgoc-

/**
 * The house naming convention, enforced so it cannot drift again:
 *
 *     ntgoc-<block>[__<element>][--<modifier>]
 *
 * every part lowercase kebab-case. Documented under "Naming CSS classes" in
 * CONTRIBUTING.md and summarised in CLAUDE.md. This repo previously ran two
 * conventions at once and ended up with `ntgoc-pl-kicker` and
 * `ntgoc-page-eyebrow` as two names for one identical rule.
 */
const CLASS_GRAMMAR =
  /^ntgoc-[a-z0-9]+(?:-[a-z0-9]+)*(?:__[a-z0-9]+(?:-[a-z0-9]+)*)?(?:--[a-z0-9]+(?:-[a-z0-9]+)*)?$/;

{
  const css = read('assets/css/components.css');
  const declared = new Set([...css.matchAll(/^\.(ntgoc-[\w-]+)/gm)].map(m => m[1]));
  for (const cls of declared) {
    if (!CLASS_GRAMMAR.test(cls)) {
      err('class-grammar', 'assets/css/components.css',
        `"${cls}" does not match ntgoc-<block>[__<element>][--<modifier>]`);
    }
    // Abbreviated area prefixes read as noise next to the spelled-out ones.
    if (/^ntgoc-(pl|nav|hdr|ftr|btn-|img)-/.test(cls) && !/^ntgoc-(nav|btn)-/.test(cls)) {
      warn('class-abbrev', 'assets/css/components.css',
        `"${cls}" uses an abbreviated prefix; spell the area out (ntgoc-parish-life-…)`);
    }
  }
}
for (const rel of PAGES) {
  for (const m of read(rel).matchAll(/\sclass="([^"]+)"/g)) {
    for (const cls of m[1].split(/\s+/).filter(Boolean)) {
      if (!cls.startsWith('ntgoc-') && !ALLOWED.has(cls)) {
        err('class-prefix', rel, `class "${cls}" is not ntgoc- prefixed`);
      }
    }
  }
}

/* ------------------------------------------------------------------ *
 * 6b. Every class used in the markup is actually defined
 *
 * With the CSS hand-edited, markup and stylesheet can drift apart silently —
 * a half-finished rename leaves the HTML asking for a class that no longer
 * exists, and the page renders unstyled while every other check passes.
 * Caught here rather than by someone noticing the footer looks wrong.
 * ------------------------------------------------------------------ */
{
  const css = read('assets/css/components.css') + read('assets/css/provisional.css');
  const defined = new Set([...css.matchAll(/\.(ntgoc-[\w-]+)/g)].map(m => m[1]));
  const used = new Map();
  for (const rel of PAGES) {
    for (const m of read(rel).matchAll(/\sclass="([^"]+)"/g)) {
      for (const cls of m[1].split(/\s+/).filter(c => c.startsWith('ntgoc-'))) {
        if (!used.has(cls)) used.set(cls, rel);
      }
    }
  }
  // Classes applied at runtime exist only in JS. These count as "used" — they
  // suppress the unused warning — but are NOT required to resolve, since the
  // same scan also sees data-attribute names like data-ntgoc-cat.
  const runtime = new Set();
  const jsDir = join(ROOT, 'assets/js');
  for (const f of existsSync(jsDir) ? readdirSync(jsDir) : []) {
    for (const m of read(`assets/js/${f}`).matchAll(/['"`]([\w\s-]*ntgoc-[\w-]+[\w\s-]*)['"`]/g)) {
      for (const cls of m[1].split(/\s+/).filter(c => c.startsWith('ntgoc-'))) runtime.add(cls);
    }
  }
  for (const [cls, rel] of used) {
    if (!defined.has(cls)) {
      err('class-undefined', rel, `class "${cls}" is used but defined in no stylesheet`);
    }
  }
  for (const cls of defined) {
    if (!used.has(cls) && !runtime.has(cls) && !cls.startsWith('ntgoc-draft-banner') && cls !== 'ntgoc-page') {
      warn('class-unused', 'assets/css/components.css', `"${cls}" is defined but used on no page`);
    }
  }
}

/* ------------------------------------------------------------------ *
 * 6c. The drawer and the desktop nav must offer the same links
 *
 * Below 900px the horizontal nav is hidden and the <details> drawer is the
 * whole navigation. The two lists are the same links written twice, and
 * nothing but this check stops one being updated while the other quietly
 * rots — which on a phone means a page nobody can reach.
 *
 * Sets, not sequences: the drawer leads with "Plan a visit" the way the
 * mobile design does, and that is deliberate. .ntgoc-drawer__utility and
 * .ntgoc-drawer__service are drawer-only and are not compared.
 * ------------------------------------------------------------------ */
{
  /* Pull the hrefs out of the element carrying `cls`, by walking from its
     opening tag to the matching close and counting nesting on the way. A
     plain non-greedy match would stop at the first </div> instead. */
  const hrefsIn = (body, cls) => {
    const opener = new RegExp(
      `<(\\w+)[^>]*\\sclass="[^"]*(?<![\\w-])${cls}(?![\\w-])[^"]*"[^>]*>`);
    const m = body.match(opener);
    if (!m) return null;

    const start = m.index;
    let depth = 0, end = -1;
    for (const t of body.matchAll(new RegExp(`<(/?)${m[1]}\\b[^>]*>`, 'g'))) {
      if (t.index < start) continue;
      depth += t[1] ? -1 : 1;
      if (depth === 0) { end = t.index; break; }
    }
    if (end === -1) return null;

    return new Set([...body.slice(start, end).matchAll(/<a\s+href="([^"]+)"/g)]
      .map(x => x[1]));
  };

  for (const rel of PAGES) {
    const body = read(rel);
    const nav = hrefsIn(body, 'ntgoc-nav');
    const drawer = hrefsIn(body, 'ntgoc-drawer__list');
    if (!nav && !drawer) continue;
    if (!drawer) {
      err('nav-drawer-parity', rel,
        'has a desktop nav but no .ntgoc-drawer__list — below 900px there is no navigation at all');
      continue;
    }
    if (!nav) {
      err('nav-drawer-parity', rel, 'has a .ntgoc-drawer__list but no .ntgoc-nav');
      continue;
    }
    for (const h of [...nav].filter(h => !drawer.has(h))) {
      err('nav-drawer-parity', rel, `"${h}" is in the desktop nav but missing from the drawer`);
    }
    for (const h of [...drawer].filter(h => !nav.has(h))) {
      err('nav-drawer-parity', rel, `"${h}" is in the drawer but missing from the desktop nav`);
    }
  }
}

/* ------------------------------------------------------------------ *
 * 7. Assets referenced from the markup actually exist
 * ------------------------------------------------------------------ */
for (const rel of PAGES) {
  for (const m of read(rel).matchAll(/(?:src|href)="((?!https?:|mailto:|tel:|#)[^"]+)"/g)) {
    const target = m[1].split(/[?#]/)[0];
    if (target.endsWith('.html')) continue;          // page links checked below
    if (!existsSync(join(ROOT, target))) err('missing-asset', rel, `references ${target}, which does not exist`);
  }
  for (const m of read(rel).matchAll(/href="([\w-]+\.html)"/g)) {
    if (!existsSync(join(ROOT, m[1]))) err('dead-link', rel, `links to ${m[1]}, which does not exist`);
  }
}

/* ------------------------------------------------------------------ *
 * 8. Unverified parish facts must stay flagged
 * ------------------------------------------------------------------ */
{
  const todos = PAGES.reduce((n, rel) => n + (read(rel).match(/TODO: verify/g) || []).length, 0);
  if (todos === 0) {
    warn('todo-flags', '(all pages)',
      'no TODO: verify markers left. If facts were confirmed, record them in data/parish-facts.json; ' +
      'if they were merely deleted, unsourced claims may now be presented as fact.');
  }

  // The fact record is the only defence against an unsourced claim reaching a
  // parish page. If it stops parsing, nothing downstream will notice.
  if (!existsSync(join(ROOT, 'data/parish-facts.json'))) {
    err('facts-missing', 'data/parish-facts.json', 'missing — this is the record of what is verified');
  } else {
    try {
      const facts = JSON.parse(read('data/parish-facts.json'));
      if (!facts.facts || typeof facts.facts !== 'object') {
        err('facts-shape', 'data/parish-facts.json', 'has no "facts" object');
      }
    } catch (e) {
      err('facts-invalid', 'data/parish-facts.json', `is not valid JSON: ${String(e.message).slice(0, 80)}`);
    }
  }
  console.log(`  ${todos} TODO: verify marker(s) across ${PAGES.length} pages — see IMPORT.md\n`);
}

/* ------------------------------------------------------------------ *
 * 8a. Canonical facts — data/site.json is the one source of truth
 *
 * Service times, the name of the fellowship meal, the Divine Liturgy book,
 * parking and accessibility are all stated on more than one page. A correction
 * applied to four pages out of six is worse than no correction, because the
 * site then contradicts itself and a visitor acts on whichever page they found.
 *
 * There is no build step to inject values into hand-edited HTML, so the guard
 * runs the other way: data/site.json lists what a page must NOT say, and this
 * fails the build when one says it. Making a correction stick means adding the
 * old wording to `canonical.forbidden` — otherwise the next rewrite reinstates
 * it, which is exactly how "complimentary prayer book" came back twice.
 * ------------------------------------------------------------------ */
{
  const rel = 'data/site.json';
  if (!existsSync(join(ROOT, rel))) {
    err('site-config-missing', rel, 'missing — this is the source of truth for shared facts');
  } else {
    let site = null;
    try { site = JSON.parse(read(rel)); }
    catch (e) { err('site-config-invalid', rel, `is not valid JSON: ${String(e.message).slice(0, 80)}`); }

    for (const rule of site?.canonical?.forbidden ?? []) {
      // Case matters for a few: 'the Agape Meal' as a heading is wrong, while
      // 'an agape meal' explaining the term in passing is fine.
      const re = new RegExp(rule.pattern, rule.caseSensitive ? 'g' : 'gi');
      for (const page of PAGES) {
        if ((rule.allowIn ?? []).includes(page)) continue;
        // Comments carry the reasoning for a correction and legitimately quote
        // the wording being corrected, so they are not scanned.
        const body = read(page).replace(/<!--[\s\S]*?-->/g, '');
        const hit = body.match(re);
        if (hit) err('canonical-fact', page, `says "${hit[0]}" — ${rule.why}`);
      }
    }
  }
}

/* ------------------------------------------------------------------ *
 * 8b. Documentation must not point at the retired renderer
 *
 * The docs told a volunteer to run `node tools/render.mjs` for months after it
 * was archived. Following that instruction would overwrite all twelve pages
 * from the old design file. Doc rot with teeth, so it is checked.
 * ------------------------------------------------------------------ */
{
  const docs = readdirSync(ROOT).filter(f => f.endsWith('.md'));
  for (const dir of ['design-src', 'content', 'data']) {
    if (existsSync(join(ROOT, dir))) {
      for (const f of readdirSync(join(ROOT, dir)).filter(f => f.endsWith('.md'))) docs.push(`${dir}/${f}`);
    }
  }
  for (const rel of docs) {
    const body = read(rel);
    // `tools/render.mjs` no longer exists; the archived copy must be named in full.
    for (const m of body.matchAll(/tools\/render\.mjs/g)) {
      const line = body.slice(0, m.index).split('\n').length;
      err('stale-doc', rel, `line ${line}: refers to tools/render.mjs, which was archived — say tools/archive/render.mjs`);
    }
    if (/^\s*node tools\/archive\/render\.mjs\s*$/m.test(body) && !/SCRATCH|scratch|do not run|Do not run/i.test(body)) {
      err('stale-doc', rel, 'shows a bare `node tools/archive/render.mjs` command without warning that it overwrites every page');
    }
  }
}

/* ------------------------------------------------------------------ *
 * 8c. Cross-references inside a page must resolve
 *
 * The retired renderer had a guard that THREW if the Visit FAQ stopped matching
 * the sections it pointed at, rather than let the page contradict itself. That
 * guard was lost when the renderer was archived, and the Visit page is the most
 * actively rewritten page here. Same job, done structurally: every in-page
 * anchor must have a target, and every jump-list entry must lead somewhere.
 * ------------------------------------------------------------------ */
for (const rel of PAGES) {
  const body = read(rel);
  const ids = new Set([...body.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
  for (const m of body.matchAll(/href="#([^"]+)"/g)) {
    if (!ids.has(m[1])) {
      err('dead-anchor', rel, `href="#${m[1]}" has no matching id on the page`);
    }
  }
  for (const m of body.matchAll(/\saria-labelledby="([^"]+)"/g)) {
    for (const id of m[1].split(/\s+/)) {
      if (!ids.has(id)) err('dead-aria', rel, `aria-labelledby="${id}" points at no element`);
    }
  }
  for (const m of body.matchAll(/\saria-describedby="([^"]+)"/g)) {
    for (const id of m[1].split(/\s+/)) {
      if (!ids.has(id)) err('dead-aria', rel, `aria-describedby="${id}" points at no element`);
    }
  }
  const dupes = [...body.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
  for (const id of new Set(dupes)) {
    if (dupes.filter(d => d === id).length > 1) err('duplicate-id', rel, `id="${id}" appears more than once`);
  }
}

/* ------------------------------------------------------------------ *
 * 8d. Counts quoted in the docs must still be true
 *
 * "12 pages" and "42 chunks" are all over the documentation and go stale every
 * time a page is added — ACCESSIBILITY.md spent a while claiming an audit
 * covered 12 pages when it covered 16. A number in prose that nobody rechecks
 * is worse than no number.
 * ------------------------------------------------------------------ */
{
  const docs = readdirSync(ROOT).filter(f => f.endsWith('.md'));
  const realChunks = chunkFiles.filter(f => f.endsWith('.html')).length;
  for (const rel of docs) {
    const body = read(rel);
    for (const m of body.matchAll(/(\d+)\s+(?:plain text chunk files|chunk files|chunks)\b/g)) {
      if (+m[1] !== realChunks) {
        err('stale-count', rel, `says "${m[0]}" but there are ${realChunks}`);
      }
    }
    for (const m of body.matchAll(/(\d+)\s+pages\b/g)) {
      if (+m[1] !== PAGES.length) err('stale-count', rel, `says "${m[0]}" but there are ${PAGES.length}`);
    }
    for (const m of body.matchAll(/(\d+)\s+pages?\s*(?:x|×)\s*2\s+viewports?\s*=\s*(\d+)/gi)) {
      if (+m[1] !== PAGES.length || +m[2] !== PAGES.length * 2) {
        err('stale-count', rel, `says "${m[0]}" but it is ${PAGES.length} × 2 = ${PAGES.length * 2}`);
      }
    }
  }
}

/* ------------------------------------------------------------------ *
 * 8e. Assets that nothing references
 *
 * The reverse of the missing-asset check. An image left behind after a redesign
 * still gets uploaded to the parish CMS by a volunteer working from the folder.
 * A warning, not an error — some are kept deliberately, and the reason belongs
 * in data/parish-facts.json.
 * ------------------------------------------------------------------ */
{
  const haystack = [...PAGES, 'assets/css/components.css', 'assets/css/provisional.css']
    .map(read).join('\n');
  // Files kept on purpose are declared in data/parish-facts.json, so this only
  // ever fires for something genuinely forgotten.
  let retained = [];
  try {
    retained = JSON.parse(read('data/parish-facts.json'))
      .assetProvenance?._retainedUnused?.files ?? [];
  } catch { /* the facts file is validated separately */ }

  const imgDir = join(ROOT, 'assets/img');
  for (const f of existsSync(imgDir) ? readdirSync(imgDir) : []) {
    if (!haystack.includes(f) && !retained.includes(f)) {
      warn('unused-asset', `assets/img/${f}`,
        'referenced by no page or stylesheet. Delete it, or add it to ' +
        'assetProvenance._retainedUnused in data/parish-facts.json with a reason.');
    }
  }
}

/* ------------------------------------------------------------------ *
 * 8f. Two classes with byte-identical declarations
 *
 * Usually means a new page re-declared a rule that already existed under
 * another name. Harmless to render, but it doubles what has to be kept in step.
 * ------------------------------------------------------------------ */
{
  const css = read('assets/css/components.css').replace(/\/\*[\s\S]*?\*\//g, '');

  // Compare EVERY rule a class carries, not just its base one. Two classes with
  // matching base declarations are not interchangeable if one also has a media
  // query or :hover the other lacks — merging those changes behaviour. This is
  // the same equivalence test `npm run rename -- --merge` enforces.
  const allRules = new Map();
  for (const m of css.matchAll(/\.(ntgoc-[\w-]+)(?![\w-])([^{]*)\{([^}]*)\}/g)) {
    if (!allRules.has(m[1])) allRules.set(m[1], []);
    allRules.get(m[1]).push(`${m[2].trim()}{${m[3].split(/\s+/).join(' ').trim()}}`);
  }

  const byShape = new Map();
  for (const [name, rules] of allRules) {
    const shape = rules.slice().sort().join('|');
    if (shape.length < 40) continue;                // one-liners are not worth merging
    if (!byShape.has(shape)) byShape.set(shape, []);
    byShape.get(shape).push(name);
  }
  for (const [shape, names] of byShape) {
    if (names.length > 1) {
      warn('duplicate-rule', 'assets/css/components.css',
        `${names.join(' and ')} are equivalent — merge with ` +
        `\`npm run rename -- --merge ${names[1]} ${names[0]}\` (${shape.slice(0, 40)}…)`);
    }
  }
}

/* ------------------------------------------------------------------ *
 * 9. dist/chunks must match the pages it was extracted from
 * ------------------------------------------------------------------ */
if (malformed) {
  warn('chunks-skipped', 'dist/chunks',
    'not re-extracted — fix the malformed markup first, or the chunks will be broken too');
} else {
  const before = new Map(chunkFiles.map(f => [f, read(`dist/chunks/${f}`)]));
  try {
    execFileSync(process.execPath, [join(ROOT, 'tools', 'extract-chunks.mjs')], { cwd: ROOT, stdio: 'pipe' });
    // Compare like with like: `before` only holds .html/.css, so filter the
    // same way or every other file looks newly added on each run.
    const now = readdirSync(join(ROOT, 'dist/chunks')).filter(f => f.endsWith('.html') || f.endsWith('.css'));
    const stale = [...before.keys()].filter(f => !now.includes(f) || before.get(f) !== read(`dist/chunks/${f}`));
    const added = now.filter(f => !before.has(f));
    for (const f of [...stale, ...added]) {
      err('chunks-stale', `dist/chunks/${f}`,
        'was out of date with the pages. It has just been regenerated — review and commit it.');
    }
  } catch (e) {
    err('chunks-extract', 'tools/extract-chunks.mjs', `failed to run: ${String(e.message).split('\n')[0]}`);
  }
}

/* ------------------------------------------------------------------ *
 * Report
 * ------------------------------------------------------------------ */
const byRule = new Map();
for (const e of errors) {
  if (!byRule.has(e.rule)) byRule.set(e.rule, []);
  byRule.get(e.rule).push(e);
}

console.log(`\n  lint — ${PAGES.length} pages, ${chunkFiles.length} chunk files\n`);
for (const [rule, list] of byRule) {
  console.log(`  ✗ ${rule} (${list.length})`);
  for (const e of list.slice(0, 8)) console.log(`      ${e.file}: ${e.msg}`);
  if (list.length > 8) console.log(`      … and ${list.length - 8} more`);
}
for (const w of warnings) console.log(`  ! ${w.rule} — ${w.file}: ${w.msg}`);

if (!errors.length) {
  console.log(`  ✓ all checks passed${warnings.length ? ` (${warnings.length} warning${warnings.length > 1 ? 's' : ''})` : ''}\n`);
  process.exit(0);
}
console.log(`\n  ${errors.length} error${errors.length > 1 ? 's' : ''}. See CONTRIBUTING.md.\n`);
process.exit(1);
