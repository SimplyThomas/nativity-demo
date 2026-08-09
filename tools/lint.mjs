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
}

/* ------------------------------------------------------------------ *
 * 9. dist/chunks must match the pages it was extracted from
 * ------------------------------------------------------------------ */
{
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
