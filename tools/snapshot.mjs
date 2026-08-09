#!/usr/bin/env node
/**
 * snapshot.mjs — catch layout and colour regressions.
 *
 *   npm run snap             # compare against the committed baseline
 *   npm run snap -- --update # re-record the baseline (after an intended change)
 *
 * `lint` checks structure and `audit:a11y` checks semantics and contrast, but
 * neither notices if a CSS edit collapses a grid or pushes the hero off-screen.
 * That is the one class of breakage nobody reviewing a diff can see, and the
 * main risk when renaming classes in bulk.
 *
 * It records a FINGERPRINT rather than pixels: the geometry and a few computed
 * styles of every meaningful element, keyed by the chunk it lives in. Pixel
 * baselines would be useless here — font rendering differs between a laptop and
 * a CI runner, so they would fail constantly for no reason. Geometry does not.
 *
 * Coordinates are rounded to 2px so sub-pixel text-metric differences between
 * machines are ignored, while a real layout move is not.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = join(ROOT, 'tests', 'layout-baseline.json');
const UPDATE = process.argv.includes('--update');
const TOLERANCE = 2;

const CHROME = [
  process.env.CHROME_PATH,
  '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable',
].find(p => p && existsSync(p));
if (!CHROME) { console.error('No Chrome/Chromium found. Set CHROME_PATH.'); process.exit(2); }

const PAGES = readdirSync(ROOT).filter(f => f.endsWith('.html')).sort();
const VIEWPORTS = [{ name: 'desktop', width: 1440, height: 900 },
                   { name: 'mobile', width: 390, height: 844 }];

/**
 * Runs inside the page. Elements are keyed by the chunk that contains them, so
 * a key stays stable when an unrelated part of the page changes.
 */
function collect() {
  const comments = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_COMMENT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const m = (n.nodeValue || '').match(/^\s*(\/?)CHUNK:(\w+)\s*$/);
    if (m) comments.push({ node: n, name: m[2], open: !m[1] });
  }

  const ranges = [];
  const stack = [];
  for (const c of comments) {
    if (c.open) stack.push(c);
    else { const open = stack.pop(); if (open) ranges.push({ name: open.name, start: open.node, end: c.node }); }
  }

  const chunkOf = el => {
    let name = '(page)';
    for (const r of ranges) {
      const afterStart = r.start.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING;
      const beforeEnd = r.end.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING;
      if (afterStart && beforeEnd) name = r.name;      // innermost wins
    }
    return name;
  };

  const TAGS = 'main,header,footer,nav,section,form,h1,h2,h3,img,iframe,input,textarea,select,button';
  const seen = new Map();
  const out = [];

  for (const el of document.querySelectorAll(TAGS + ',[class*="ntgoc-"]')) {
    const b = el.getBoundingClientRect();
    if (!b.width && !b.height) continue;                 // hidden or zero-box
    const s = getComputedStyle(el);
    const cls = (el.className || '').toString().split(/\s+/).filter(Boolean)[0] || '';
    const base = chunkOf(el) + '/' + el.tagName.toLowerCase() + (cls ? '.' + cls : '');
    const i = seen.get(base) || 0;
    seen.set(base, i + 1);
    out.push({
      k: base + '#' + i,
      x: b.x, y: b.y + window.scrollY, w: b.width, h: b.height,
      c: s.color, bg: s.backgroundColor, fs: s.fontSize, d: s.display,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1'],
});

const snap = (n) => Math.round(n / TOLERANCE) * TOLERANCE;
const snapshot = {};

for (const vp of VIEWPORTS) {
  for (const file of PAGES) {
    const page = await browser.newPage();
    await page.setViewport({ width: vp.width, height: vp.height });
    await page.goto(`file://${ROOT}/${file}`, { waitUntil: 'networkidle0', timeout: 45000 });
    await page.evaluate(() => (document.fonts ? document.fonts.ready : null));
    const els = await page.evaluate(collect);
    snapshot[`${file}@${vp.name}`] = Object.fromEntries(els.map(e => [e.k, {
      x: snap(e.x), y: snap(e.y), w: snap(e.w), h: snap(e.h),
      c: e.c, bg: e.bg, fs: e.fs, d: e.d,
    }]));
    await page.close();
  }
}
await browser.close();

const count = Object.values(snapshot).reduce((a, s) => a + Object.keys(s).length, 0);

if (UPDATE || !existsSync(BASELINE)) {
  const fresh = !existsSync(BASELINE);
  mkdirSync(dirname(BASELINE), { recursive: true });
  writeFileSync(BASELINE, JSON.stringify(snapshot, null, 1) + '\n');
  console.log(`\n  baseline ${fresh ? 'created' : 'updated'}: ` +
    `${Object.keys(snapshot).length} scenes, ${count} elements\n`);
  process.exit(0);
}

/* ---------------- compare ---------------- */

const base = JSON.parse(readFileSync(BASELINE, 'utf8'));
const problems = [];

for (const scene of new Set([...Object.keys(base), ...Object.keys(snapshot)])) {
  const b = base[scene] || {};
  const c = snapshot[scene] || {};
  for (const k of Object.keys(b)) if (!(k in c)) problems.push({ scene, k, what: 'disappeared' });
  for (const k of Object.keys(c)) if (!(k in b)) problems.push({ scene, k, what: 'appeared' });
  for (const k of Object.keys(b)) {
    if (!(k in c)) continue;
    const diffs = [];
    for (const p of ['x', 'y', 'w', 'h']) {
      if (Math.abs(b[k][p] - c[k][p]) > TOLERANCE) diffs.push(`${p} ${b[k][p]}→${c[k][p]}`);
    }
    for (const p of ['c', 'bg', 'fs', 'd']) {
      if (b[k][p] !== c[k][p]) diffs.push(`${p} ${b[k][p]}→${c[k][p]}`);
    }
    if (diffs.length) problems.push({ scene, k, what: diffs.join(', ') });
  }
}

console.log(`\n  layout snapshot — ${Object.keys(snapshot).length} scenes, ${count} elements\n`);

if (!problems.length) { console.log('  ✓ no layout or colour changes\n'); process.exit(0); }

const byScene = new Map();
for (const p of problems) {
  if (!byScene.has(p.scene)) byScene.set(p.scene, []);
  byScene.get(p.scene).push(p);
}
for (const [scene, list] of byScene) {
  console.log(`  ✗ ${scene} (${list.length})`);
  for (const p of list.slice(0, 6)) console.log(`      ${p.k}  ${p.what}`);
  if (list.length > 6) console.log(`      … and ${list.length - 6} more`);
}
console.log(`
  ${problems.length} change(s). If they are intended:
      npm run snap -- --update    then commit tests/layout-baseline.json
  If not, something moved that you did not mean to move.
`);
process.exit(1);
