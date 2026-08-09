#!/usr/bin/env node
/**
 * extract-chunks.mjs — pull every delimited block out of the rendered pages and
 * write it to dist/chunks/<chunkName>.html, ready to paste into the Evolution
 * CMS manager (Elements → Chunks → New Chunk).
 *
 *   node tools/extract-chunks.mjs
 *
 * What it does:
 *   - Walks every .html file at the repo root.
 *   - Finds <!-- CHUNK:name --> ... <!-- /CHUNK:name --> pairs.
 *   - Rewrites relative asset paths to the EVO asset root (see ASSET_ROOT).
 *   - Rewrites page links (visit.html) to EVO link placeholders a volunteer can
 *     replace with the real resource id.
 *   - Refuses to write a chunk containing an EVO reserved character sequence.
 *
 * A chunk that appears on several pages (the header, the footer) is written once;
 * the script checks that every copy is identical and warns if they have drifted.
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'dist', 'chunks');

/* ------------------------------------------------------------------ *
 * CONFIGURE ME
 *
 * Where images will live once uploaded through the EVO file manager.
 * The live site serves its template assets from /assets/templates/, and a
 * custom.css already sits there — but the exact folder for a new template has
 * NOT been confirmed with the Department of Internet Ministries. Confirm before
 * importing, then change this one line and re-run.
 * ------------------------------------------------------------------ */
const ASSET_ROOT = '/assets/templates/ntgoc/';

/**
 * EVO reserved sequences. If any of these reach a chunk, the CMS parser will
 * eat or corrupt the markup. This is a hard gate, not a warning.
 */
const RESERVED = [
  ['[[', ']]', 'cached snippet call'],
  ['[!', '!]', 'uncached snippet call'],
  ['{{', '}}', 'chunk call'],
  ['[*', '*]', 'resource field / template variable'],
  ['[(', ')]', 'system setting'],
  ['[~', '~]', 'link to resource by id'],
  ['[+', '+]', 'placeholder'],
];

/* Page file -> a human note for the volunteer replacing the link in EVO.
   Read off disk rather than hand-listed: this list had silently fallen three
   pages behind the site, so links to them were left as .html hrefs in the
   extracted chunks instead of becoming EVO link placeholders. */
const PAGE_LINKS = readdirSync(ROOT).filter(f => f.endsWith('.html')).sort();

/* ------------------------------------------------------------------ */

function rewriteAssets(html) {
  let out = html;

  // assets/img/foo.jpg -> <ASSET_ROOT>img/foo.jpg   (also inside url('...'))
  out = out.replace(/(["'(])assets\/(img|css|js)\//g, `$1${ASSET_ROOT}$2/`);

  // Internal page links become an obvious placeholder rather than a broken href:
  // a volunteer swaps each for EVO's link-by-id syntax once resources exist.
  //
  // The fragment is kept and carried through. A link to another page's section
  // — parish-life.html#ntgoc-children — used not to match at all, so it left the
  // chunk as a raw .html href: silently broken once imported, and invisible
  // because every other link on the page had been rewritten around it.
  for (const page of PAGE_LINKS) {
    const name = page.replace(/\.html$/, '');
    out = out.replace(
      new RegExp(`href="${page.replace('.', '\\.')}(#[^"]*)?"`, 'g'),
      (_, frag) => `href="${frag || '#'}" data-ntgoc-link="${name}"`);
  }

  return out;
}

function scanReserved(html) {
  const found = [];
  for (const [open, close, meaning] of RESERVED) {
    if (html.includes(open) || html.includes(close)) {
      found.push(`${open} ${close}  (${meaning})`);
    }
  }
  return found;
}

/* ------------------------------------------------------------------ */

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const pages = readdirSync(ROOT).filter(f => f.endsWith('.html'));
const chunks = new Map();   // name -> { body, sources: [] }

for (const page of pages) {
  const html = readFileSync(join(ROOT, page), 'utf8');
  const re = /<!-- CHUNK:(\w+) -->([\s\S]*?)<!-- \/CHUNK:\1 -->/g;
  for (const m of html.matchAll(re)) {
    const [, name, raw] = m;
    // aria-current marks the active nav item and is therefore per-page state.
    // It must not be baked into a reusable chunk — in EVO the template decides
    // which item is current — so it is stripped before the chunk is stored.
    const body = raw.trim().replace(/ aria-current="page"/g, '');
    const seen = chunks.get(name);
    if (seen) {
      if (seen.body !== body) {
        console.warn(`  ! ${name} differs between ${seen.sources[0]} and ${page} — keeping the ${seen.sources[0]} copy`);
      }
      seen.sources.push(page);
    } else {
      chunks.set(name, { body, sources: [page] });
    }
  }
}

let written = 0, blocked = 0;
const manifest = [];

for (const [name, { body, sources }] of [...chunks].sort()) {
  const out = rewriteAssets(body);
  const bad = scanReserved(out);

  if (bad.length) {
    blocked++;
    console.error(`  ✗ ${name}: contains EVO reserved sequence(s):\n      ${bad.join('\n      ')}`);
    continue;
  }

  const header = `<!--
  ${name}
  Generated by tools/extract-chunks.mjs — do not edit here.
  Source: ${sources.join(', ')}
  Paste the markup BELOW this comment into EVO: Elements -> Chunks -> New Chunk,
  with the chunk name set to exactly:  ${name}
  Asset paths point at ${ASSET_ROOT} — confirm that path before importing.
-->
`;
  writeFileSync(join(OUT, `${name}.html`), header + out + '\n');
  manifest.push({ name, bytes: out.length, pages: sources.length });
  written++;
}

/* ------------------------------------------------------------------ *
 * components.css, with asset paths rewritten for EVO.
 *
 * The background images live in the stylesheet rather than in the chunks
 * (they were inline background-image declarations in the design), so the
 * same path rewrite has to be applied here or the icons will 404 in EVO.
 * ------------------------------------------------------------------ */

const css = readFileSync(join(ROOT, 'assets/css/components.css'), 'utf8');
const cssOut = css
  // Paths in the stylesheet are relative to assets/css/ (see render.mjs).
  .replace(/(["'(])\.\.\/(img|js)\//g, `$1${ASSET_ROOT}$2/`)
  .replace(/(["'(])assets\/(img|css|js)\//g, `$1${ASSET_ROOT}$2/`);
const cssBad = scanReserved(cssOut);

if (cssBad.length) {
  console.error(`  ✗ components.css contains EVO reserved sequence(s):\n      ${cssBad.join('\n      ')}`);
  blocked++;
} else {
  writeFileSync(join(OUT, '_components.evo.css'),
    `/* components.css, prepared for Evolution CMS.\n` +
    `   Generated by tools/extract-chunks.mjs — do not edit here.\n` +
    `   Asset paths rewritten to ${ASSET_ROOT}\n` +
    `   Upload as a stylesheet, or paste into the template <head>. See IMPORT.md. */\n\n` +
    cssOut);
}

/* ------------------------------------------------------------------ *
 * Link map — every internal link a volunteer must repoint in EVO.
 *
 * Extraction rewrites page-to-page links to a placeholder, because EVO
 * addresses pages by numeric resource id and those ids do not exist until the
 * pages are created. Without this table the volunteer is hunting through 45
 * placeholders across 46 files, which is exactly how one gets missed.
 * ------------------------------------------------------------------ */

const linkRows = [];
const targets = new Set();
for (const [name, { body }] of [...chunks].sort()) {
  const out = rewriteAssets(body);
  const links = [...out.matchAll(/data-ntgoc-link="([^"]+)"/g)].map(m => m[1]);
  if (!links.length) continue;
  const tally = new Map();
  for (const l of links) { tally.set(l, (tally.get(l) || 0) + 1); targets.add(l); }
  linkRows.push({ name, tally, total: links.length });
}

writeFileSync(join(OUT, '_link-map.md'),
  `# Internal links to repoint in Evolution CMS\n\n` +
  `Generated by \`npm run chunks\`. See step 5 of IMPORT.md.\n\n` +
  `Each \`<a href="#" data-ntgoc-link="x">\` must become \`<a href="[~<id>~]">\`,\n` +
  `where \`<id>\` is the numeric resource id EVO assigns that page.\n\n` +
  `## 1. Write down the resource ids first\n\n` +
  `| Page | EVO resource id |\n|---|---|\n` +
  [...targets].sort().map(t => `| \`${t}\` | _________ |`).join('\n') +
  `\n\n## 2. Then work through the chunks\n\n` +
  `${linkRows.reduce((n, r) => n + r.total, 0)} links across ${linkRows.length} chunks.\n\n` +
  `| Chunk | Links to | Done |\n|---|---|:--:|\n` +
  linkRows.map(r => `| \`${r.name}\` | ${[...r.tally].map(([t, n]) => `${t}${n > 1 ? ` ×${n}` : ''}`).join(', ')} | ☐ |`).join('\n') +
  `\n\n> Search each chunk for \`data-ntgoc-link\`. External links (the Archdiocese,\n` +
  `> Square, the Google form, fredgreek.org) are real URLs already — leave them.\n`);

/* A small index so a volunteer can see the whole set at a glance. */
writeFileSync(join(OUT, '_index.md'),
  `# Extracted EVO chunks\n\n` +
  `Generated by \`node tools/extract-chunks.mjs\`.\n` +
  `Asset root: \`${ASSET_ROOT}\` — confirm with the Department of Internet Ministries before import.\n\n` +
  `Tick each chunk off as you paste it into Elements → Chunks. The name must\n` +
  `match the filename exactly — that is how pages call it.\n\n` +
  `| Done | Chunk | Size | Appears on | Has links to repoint |\n|:--:|---|---:|---:|:--:|\n` +
  manifest.map(c => {
    const links = linkRows.find(r => r.name === c.name);
    return `| ☐ | \`${c.name}\` | ${c.bytes} b | ${c.pages} page${c.pages > 1 ? 's' : ''} | ${links ? `yes (${links.total})` : '—'} |`;
  }).join('\n') +
  `\n\nSee \`_link-map.md\` for the links, and \`_components.evo.css\` for the stylesheet.\n`);

console.log(`extracted ${written} chunks -> dist/chunks/`);
if (blocked) {
  console.error(`\n${blocked} chunk(s) BLOCKED by the reserved-sequence gate. Fix the source before importing.`);
  process.exit(1);
}
