#!/usr/bin/env node
/**
 * sync-shell.mjs — propagate the shared shell to every page.
 *
 *   node tools/sync-shell.mjs                  # from index.html to all others
 *   node tools/sync-shell.mjs --from visit.html
 *   node tools/sync-shell.mjs --check          # report drift, change nothing
 *   node tools/sync-shell.mjs --dry            # show what would change
 *
 * The header, top bar, footer and draft banner are the same markup on all
 * twelve pages — about a third of all the HTML in this repo. Editing them by
 * hand means making the identical change twelve times, and missing one is
 * silent until a volunteer pastes the wrong copy into the parish CMS.
 *
 * Edit the shell once, in one page, then run this. It is deliberately not a
 * template engine: the pages stay plain, hand-editable HTML with no build step.
 *
 * The one thing it cannot copy verbatim is `aria-current="page"`, which marks
 * the link to the page you are on and so differs per page. It is stripped from
 * the source and re-applied per target from that page's own filename.
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const CHECK = argv.includes('--check');
const DRY = argv.includes('--dry') || CHECK;
const fromIdx = argv.indexOf('--from');
const SOURCE = fromIdx !== -1 ? argv[fromIdx + 1] : 'index.html';

/* Chunks that are shared by every page. Anything page-specific stays put. */
const SHELL = ['ntgocDraftBanner', 'ntgocTopBar', 'ntgocSiteHeader', 'ntgocSiteFooter'];

const pages = readdirSync(ROOT).filter(f => f.endsWith('.html')).sort();
const read = rel => readFileSync(join(ROOT, rel), 'utf8');

if (!pages.includes(SOURCE)) {
  console.error(`  ✗ --from ${SOURCE} is not one of the pages.`);
  process.exit(1);
}

const marker = name => ({
  open: `<!-- CHUNK:${name} -->`,
  close: `<!-- /CHUNK:${name} -->`,
});

/** Pull one chunk's inner markup out of a page. */
function extract(src, name) {
  const { open, close } = marker(name);
  const a = src.indexOf(open);
  const b = src.indexOf(close);
  if (a === -1 || b === -1 || b < a) return null;
  return src.slice(a + open.length, b);
}

/** Replace one chunk's inner markup in a page. */
function replace(src, name, body) {
  const { open, close } = marker(name);
  const a = src.indexOf(open);
  const b = src.indexOf(close);
  if (a === -1 || b === -1 || b < a) return null;
  return src.slice(0, a + open.length) + body + src.slice(b);
}

/**
 * aria-current marks the link to the page you are currently on, so it is the
 * one part of the shell that legitimately differs. Strip it, then re-apply it
 * to whichever links point at the target page.
 */
const stripCurrent = s => s.replace(/\s+aria-current="page"/g, '');

function applyCurrent(body, page) {
  return body.replace(
    new RegExp(`(<a\\s+href="${page.replace('.', '\\.')}")`, 'g'),
    '$1 aria-current="page"');
}

/* ------------------------------------------------------------------ */

const source = read(SOURCE);
const shell = {};
for (const name of SHELL) {
  const body = extract(source, name);
  if (body === null) {
    console.error(`  ✗ ${SOURCE} has no ${name} chunk — cannot use it as the source.`);
    process.exit(1);
  }
  shell[name] = stripCurrent(body);
}

const drift = [];
let written = 0;

for (const page of pages) {
  if (page === SOURCE) continue;
  let src = read(page);
  let changed = false;

  for (const name of SHELL) {
    const current = extract(src, name);
    if (current === null) { drift.push(`${page}: missing ${name}`); continue; }

    const wanted = applyCurrent(shell[name], page);
    if (current === wanted) continue;

    drift.push(`${page}: ${name} differs`);
    const next = replace(src, name, wanted);
    if (next === null) { drift.push(`${page}: could not rewrite ${name}`); continue; }
    src = next;
    changed = true;
  }

  if (changed && !DRY) { writeFileSync(join(ROOT, page), src); written++; }
}

/* The source page needs its own aria-current to be right too. */
if (!DRY) {
  let src = source;
  for (const name of SHELL) {
    src = replace(src, name, applyCurrent(shell[name], SOURCE)) ?? src;
  }
  if (src !== source) { writeFileSync(join(ROOT, SOURCE), src); written++; }
}

/* ------------------------------------------------------------------ */

console.log(`\n  shell source: ${SOURCE}   (${SHELL.join(', ')})`);

if (!drift.length) {
  console.log(`  ✓ all ${pages.length} pages already in sync\n`);
  process.exit(0);
}

console.log(`\n  ${CHECK ? 'drift found' : DRY ? 'would update' : 'updated'}:`);
for (const d of drift.slice(0, 20)) console.log(`    ${d}`);
if (drift.length > 20) console.log(`    … and ${drift.length - 20} more`);

if (CHECK) { console.log(`\n  Run "npm run shell" to propagate.\n`); process.exit(1); }
if (DRY) { console.log(`\n  Nothing written (--dry).\n`); process.exit(0); }

console.log(`\n  wrote ${written} page(s); re-extracting chunks and linting…\n`);
execFileSync(process.execPath, [join(ROOT, 'tools', 'extract-chunks.mjs')], { cwd: ROOT, stdio: 'pipe' });
try {
  execFileSync(process.execPath, [join(ROOT, 'tools', 'lint.mjs')], { cwd: ROOT, stdio: 'inherit' });
} catch {
  console.error('  ✗ lint failed after the sync — review `git diff`, and `git checkout .` to undo.\n');
  process.exit(1);
}
