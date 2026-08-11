#!/usr/bin/env node
/**
 * measure-hero-contrast.mjs — contrast of the hero text against the pixels
 * actually rendered behind its glyphs.
 *
 *   npm run measure:hero                  # the ten pages that carry a hero
 *   npm run measure:hero -- visit.html    # re-measure one page quickly
 *   npm run measure:hero -- --box         # deliberately WRONG, for comparison
 *
 * WHY THIS EXISTS
 * ---------------
 * axe cannot compute contrast for text sitting on a background image: it has no
 * way to know what colour is under the glyphs, so it declines to judge and
 * reports the node as "needs review". `npm run audit:a11y` therefore says 0
 * violations while flagging .ntgoc-page-hero__eyebrow across 20 page-runs. The
 * ten photograph heroes are the one part of this site that CI does not measure
 * at all. This tool measures them.
 *
 * THE GLYPH-RUN DISTINCTION — the whole point
 * -------------------------------------------
 * An eyebrow is a block. Its border box runs the full width of the hero body,
 * a thousand pixels past the end of the word, straight across the brightest
 * part of the photograph — where no glyph is ever painted. Sampling the box
 * therefore measures contrast against pixels the reader never sees behind text,
 * and invents failures: measured that way six pages score 2.8-3.4:1 while every
 * string on them is comfortably legible.
 *
 * So: take a Range over each text node, call getClientRects() — which returns
 * one rect per rendered LINE, tight to the text — and sample only inside those.
 * Run with --box to see the false failures the box method produces; the glyph
 * numbers must always be the better of the two, and if they are not, this tool
 * is broken.
 *
 * HOW THE PIXELS ARE READ
 * -----------------------
 * The text is hidden with `visibility: hidden` (never `display: none`, which
 * would reflow the hero and move the very rects we just measured), the hero
 * region is screenshotted, and the PNG is handed to a blank page as a data URI,
 * drawn to a canvas and read back with getImageData. That decodes a PNG without
 * adding an image library — this repo ships no dependencies of its own and the
 * two dev ones are for auditing.
 *
 * Every pixel under the glyph rects is scored, and the WORST ratio is reported,
 * not an average: legibility is decided by the brightest patch of photograph
 * behind the word, not by the mean.
 *
 * TWO TRAPS
 * ---------
 * - Await `document.fonts.ready` before measuring anything. An earlier attempt
 *   sampled with fallback fonts still in place, got a different line layout,
 *   and reported 1.00:1 from coordinates that had landed on the parchment
 *   section below the hero.
 * - Do not pipe this into `head`/`tail`/`grep` when you care about the exit
 *   code. A pipeline reports the last command's status, not this one's.
 *
 * A NOTE ON THRESHOLDS
 * --------------------
 * Titles are held to 3:1 — they are 38-66px, large text under WCAG 1.4.3 at
 * every viewport. Everything else is held to 4.5:1. That is stricter than WCAG
 * for .ntgoc-page-hero__lede--serif at desktop, which is 24px and so counts as
 * large text there; it drops to 20px on mobile and needs the full 4.5:1, and
 * holding one string to two different bars across a breakpoint would make the
 * table harder to read than it is worth.
 *
 * This tool is NOT in `npm run check`. It needs a browser, real fonts and the
 * photographs, and its numbers want human judgement about what to trade — a
 * darker scrim, a lighter gold, a different crop. It documents; it does not
 * gate. It still exits non-zero on a failure so it can be used as a gate
 * deliberately.
 */

import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.SITE_URL || `file://${REPO}`;

/* Resolve a browser: CI runners and local machines put it in different places. */
const CHROME = [
  process.env.CHROME_PATH,
  '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable',
  '/opt/google/chrome/chrome',
].find(p => p && existsSync(p));
if (!CHROME) {
  console.error('No Chrome/Chromium found. Set CHROME_PATH to a browser binary.');
  process.exit(2);
}

const args = process.argv.slice(2);
const BOX_MODE = args.includes('--box');
const pageArgs = args.filter(a => !a.startsWith('--'));

/* The pages carrying .ntgoc-page-hero, with the labels ACCESSIBILITY.md
   uses. Any page named on the command line wins instead, so a single hero can
   be re-measured in a few seconds while it is being adjusted.

   A new page with a hero has to be added here. Nothing else will notice: the
   component guarantees the scrim, not the strings set against it, and an
   unmeasured hero is one nobody has checked. */
const HERO_PAGES = [
  ['index.html', 'Home'],
  ['parish-life.html', 'Parish Life'],
  ['fellowship-care.html', 'Fellowship & Care'],
  ['faith.html', 'Our Faith'],
  ['calendar.html', 'Calendar'],
  ['about.html', 'About'],
  ['events.html', 'Events'],
  ['contact.html', 'Contact'],
  ['visit.html', 'Plan a visit'],
  ['festival.html', 'Festival'],
  ['for-our-parish.html', 'For Our Parish'],
  ['welcome.html', 'Welcome'],
];
const LABELS = new Map(HERO_PAGES);
const PAGES = pageArgs.length ? pageArgs : HERO_PAGES.map(([f]) => f);

const onDisk = new Set(readdirSync(REPO).filter(f => f.endsWith('.html')));
const missing = PAGES.filter(f => !onDisk.has(f));
if (missing.length) {
  console.error(`No such page: ${missing.join(', ')}`);
  process.exit(2);
}

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

/* Selector, the name to print, and the ratio it has to clear. */
const STRINGS = [
  { sel: '.ntgoc-page-hero__eyebrow', name: 'eyebrow', need: 4.5 },
  { sel: '.ntgoc-page-hero__title', name: 'title', need: 3.0 },
  { sel: '.ntgoc-page-hero__lede', name: 'lede', need: 4.5 },
  { sel: '.ntgoc-page-hero__lede--serif', name: 'lede--serif', need: 4.5 },
  /* Welcome sets its opening line in its own class rather than the component's,
     and it is gold on the photograph like every eyebrow here, so it needs
     measuring too. A hero string that no selector here names is a string
     nothing checks. */
  { sel: '.ntgoc-welcome-hero__lede', name: 'welcome-lede', need: 4.5 },
];

/* ------------------------------------------------------------------ */
/* Runs in the page: geometry, colours, and hiding the text.           */
/* ------------------------------------------------------------------ */

/** One rect per rendered line, tight to the glyphs — or the border box, if we
 *  have been asked for the wrong answer on purpose. */
function collectRuns(selectors, boxMode) {
  const hero = document.querySelector('.ntgoc-page-hero');
  if (!hero) return null;
  const hb = hero.getBoundingClientRect();

  const out = [];
  for (const { sel, name, need } of selectors) {
    /* --serif is a modifier on its own element here, so a plain query is
       enough; querySelectorAll keeps it honest if a page ever has two. */
    for (const el of document.querySelectorAll(`.ntgoc-page-hero ${sel}`)) {
      const cs = getComputedStyle(el);
      const rects = [];
      if (boxMode) {
        const r = el.getBoundingClientRect();
        rects.push({ x: r.x, y: r.y, width: r.width, height: r.height });
      } else {
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          if (!n.nodeValue || !n.nodeValue.trim()) continue;   // whitespace between tags
          const range = document.createRange();
          range.selectNodeContents(n);
          for (const r of range.getClientRects()) {
            if (r.width < 1 || r.height < 1) continue;
            rects.push({ x: r.x, y: r.y, width: r.width, height: r.height });
          }
        }
      }
      out.push({
        sel, name, need,
        color: cs.color,
        fontSize: parseFloat(cs.fontSize),
        text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60),
        rects,
      });
    }
  }
  return { hero: { x: hb.x, y: hb.y, width: hb.width, height: hb.height }, strings: out };
}

/* getComputedStyle always hands back rgb()/rgba(); the WCAG luminance maths
   itself lives in the decoder page, next to the pixels it scores. */
function parseColor(css) {
  const m = css.match(/rgba?\(([^)]+)\)/);
  if (!m) throw new Error(`unparseable colour: ${css}`);
  const [r, g, b] = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
  return { r, g, b };
}

/* ------------------------------------------------------------------ */

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--allow-file-access-from-files',
         '--force-device-scale-factor=1', '--font-render-hinting=none'],
});

/* One scratch page decodes every screenshot. Nothing is fetched into it; the
   PNG arrives as a data: URI, which does not taint the canvas. */
const decoder = await browser.newPage();
await decoder.goto('about:blank');

/**
 * Score every pixel under `rects` against `text`, and return the worst.
 * The scoring runs inside the decoder page so a 1440x560 hero never has to
 * cross the DevTools protocol as three million numbers.
 */
async function scorePixels(pngBase64, clip, rects, text, need) {
  return decoder.evaluate(async (png, clip, rects, text, need) => {
    const img = new Image();
    img.src = `data:image/png;base64,${png}`;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const lum = (r, g, b) => {
      const f = c => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const lt = lum(text.r, text.g, text.b);
    const cr = l => { const [hi, lo] = lt >= l ? [lt, l] : [l, lt]; return (hi + 0.05) / (lo + 0.05); };

    let worst = Infinity, worstAt = null, sampled = 0, below = 0;
    for (const r of rects) {
      /* rects are viewport coordinates; the screenshot starts at clip.x/clip.y */
      const x0 = Math.max(0, Math.floor(r.x - clip.x));
      const y0 = Math.max(0, Math.floor(r.y - clip.y));
      const x1 = Math.min(width, Math.ceil(r.x - clip.x + r.width));
      const y1 = Math.min(height, Math.ceil(r.y - clip.y + r.height));
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * width + x) * 4;
          const v = cr(lum(data[i], data[i + 1], data[i + 2]));
          sampled++;
          if (v < need) below++;
          if (v < worst) {
            worst = v;
            worstAt = { x: Math.round(clip.x + x), y: Math.round(clip.y + y),
                        rgb: [data[i], data[i + 1], data[i + 2]] };
          }
        }
      }
    }
    return { worst, worstAt, sampled, below };
  }, pngBase64, clip, rects, text, need);
}

const results = [];
const notes = [];

for (const file of PAGES) {
  for (const vp of VIEWPORTS) {
    const page = await browser.newPage();
    await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 1 });
    await page.goto(`${BASE}/${file}`, { waitUntil: 'networkidle0', timeout: 45000 });

    /* Trap 1. Fonts change line breaking, which changes every rect below. */
    await page.evaluate(() => document.fonts.ready);
    /* The hero photograph is a CSS background; networkidle0 covers the request
       but decoding is what puts pixels on the screen. Ask for it explicitly. */
    await page.evaluate(async () => {
      const el = document.querySelector('.ntgoc-page-hero__photo');
      if (!el) return;
      const url = getComputedStyle(el).backgroundImage.match(/url\("?(.*?)"?\)/);
      if (!url) return;
      const img = new Image();
      img.src = url[1];
      try { await img.decode(); } catch { /* a broken image is the lint's problem */ }
    });

    let geom = await page.evaluate(collectRuns, STRINGS, BOX_MODE);
    if (!geom) {
      notes.push(`${file}: no .ntgoc-page-hero — skipped.`);
      await page.close();
      continue;
    }

    /* The screenshot has to contain the whole hero. Hero height is set in px
       (min-height, no vh anywhere on it) so growing the viewport's HEIGHT
       cannot change its layout — only the width matters, and that is left at
       the nominal viewport. Re-measure afterwards regardless, rather than
       trusting that reasoning. */
    const needed = Math.ceil(geom.hero.y + geom.hero.height) + 20;
    if (needed > vp.height) {
      await page.setViewport({ width: vp.width, height: needed, deviceScaleFactor: 1 });
      await page.evaluate(() => document.fonts.ready);
      geom = await page.evaluate(collectRuns, STRINGS, BOX_MODE);
      notes.push(`${file} @${vp.name}: hero is ${Math.round(geom.hero.height)}px tall and ran past the ` +
                 `${vp.height}px viewport; captured at ${needed}px. Width unchanged, so layout is not affected.`);
    }

    /* Trap: display:none would reflow the hero and invalidate the rects. */
    await page.evaluate(sels => {
      for (const s of sels) {
        for (const el of document.querySelectorAll(`.ntgoc-page-hero ${s}`)) {
          el.style.visibility = 'hidden';
        }
      }
    }, STRINGS.map(s => s.sel));

    const clip = {
      x: Math.max(0, Math.floor(geom.hero.x)),
      y: Math.max(0, Math.floor(geom.hero.y)),
      width: Math.ceil(geom.hero.width),
      height: Math.ceil(geom.hero.height),
    };
    const png = await page.screenshot({ clip, encoding: 'base64', type: 'png',
                                        captureBeyondViewport: false });

    for (const s of geom.strings) {
      if (!s.rects.length) {
        notes.push(`${file} @${vp.name}: ${s.name} present but rendered no glyph rects — not measured.`);
        continue;
      }
      const text = parseColor(s.color);
      const px = await scorePixels(png, clip, s.rects, text, s.need);
      const area = s.rects.reduce((n, r) => n + r.width * r.height, 0);
      results.push({
        file, label: LABELS.get(file) || file, viewport: vp.name,
        name: s.name, need: s.need, text: s.text,
        fontSize: s.fontSize, color: s.color,
        ratio: px.worst, worstAt: px.worstAt,
        sampled: px.sampled, below: px.below,
        lines: s.rects.length, area: Math.round(area),
        pass: px.worst >= s.need,
      });
    }

    await page.close();
  }
}

await browser.close();

/* ------------------------------------------------------------------ */
/* Report                                                              */
/* ------------------------------------------------------------------ */

const r2 = n => (Math.round(n * 100) / 100).toFixed(2);

console.log(`\n# Hero text contrast — measured behind the ${BOX_MODE ? 'ELEMENT BOX (wrong, for comparison)' : 'glyph runs'}`);
console.log(`\nHeadless Chromium at ${VIEWPORTS.map(v => `${v.width}x${v.height}`).join(' and ')}, device scale 1.`);
console.log(`${PAGES.length} pages x ${VIEWPORTS.length} viewports. Titles need 3:1 (large text); everything else 4.5:1.\n`);

console.log('| Page | Viewport | String | Needs | Measured | Result |');
console.log('|---|---|---|---:|---:|---|');
for (const r of results) {
  console.log(`| ${r.label} | ${r.viewport} | \`${r.name}\` | ${r2(r.need)} | ${r2(r.ratio)}:1 | ${r.pass ? 'pass' : '**FAIL**'} |`);
}

const failures = results.filter(r => !r.pass);
if (failures.length) {
  console.log('\n## Failures in detail\n');
  console.log('For each, how much of the glyph-run area is below the threshold. A small');
  console.log('fraction is one bad stretch of photograph behind a word or two; a large one');
  console.log('means the whole string is short of contrast.\n');
  for (const r of failures) {
    const pct = (100 * r.below / r.sampled).toFixed(1);
    console.log(`- **${r.label} @ ${r.viewport}, \`${r.name}\`** — ${r2(r.ratio)}:1, needs ${r2(r.need)}. ` +
      `${pct}% of the glyph area (${r.below} of ${r.sampled} px, ${r.lines} line${r.lines === 1 ? '' : 's'}) is below ${r2(r.need)}. ` +
      `Worst pixel rgb(${r.worstAt.rgb.join(', ')}) at ${r.worstAt.x},${r.worstAt.y}. ` +
      `Text ${r.color} at ${r.fontSize}px. "${r.text}"`);
  }
}

if (notes.length) {
  console.log('\n## Notes\n');
  for (const n of notes) console.log(`- ${n}`);
}

const worst = results.reduce((a, r) => {
  const margin = r.ratio - r.need;
  return (!a || margin < a.margin) ? { margin, r } : a;
}, null);

console.log(`\n## Summary\n`);
console.log(`- Strings measured: ${results.length}`);
console.log(`- Failing: ${failures.length}`);
if (worst) {
  console.log(`- Worst margin: ${worst.margin >= 0 ? '+' : ''}${r2(worst.margin)} ` +
    `(${worst.r.label} @ ${worst.r.viewport}, ${worst.r.name}: ${r2(worst.r.ratio)}:1 against ${r2(worst.r.need)})`);
}
const bestPass = results.filter(r => r.pass).reduce((a, r) => (!a || r.ratio < a.ratio ? r : a), null);
if (bestPass && !failures.length) {
  console.log(`- Every string clears its threshold; the closest is ${bestPass.label} @ ${bestPass.viewport}.`);
}

if (failures.length) {
  console.error(`\n  ✗ ${failures.length} of ${results.length} hero strings are below their contrast threshold.\n`);
  process.exit(1);
}
console.log(`\n  ✓ all ${results.length} hero strings clear their threshold.\n`);
