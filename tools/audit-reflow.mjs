import puppeteer from 'puppeteer-core';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.SITE_URL || `file://${REPO}`;

/* Resolve a browser: CI runners and local machines put it in different places. */
import { existsSync } from 'node:fs';
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
/* Read the pages off disk rather than listing them, the way lint.mjs does.
   This list used to be hard-coded, which meant a page added to the repo was
   silently never audited — the run still said every page passed. */
import { readdirSync } from 'node:fs';
const PAGES = readdirSync(REPO).filter(f => f.endsWith('.html')).sort();
const b=await puppeteer.launch({executablePath:CHROME,headless:true,args:['--no-sandbox','--disable-gpu']});
console.log('WCAG 1.4.10 Reflow — viewport 320x800, no horizontal scrolling allowed\n');
let bad=0;
const focusOffenders = [];   // {page, viewport, sel}
let focusChecked = 0;

/* Build a short, human-identifiable label for a DOM element: tag, id,
   classes, and (for links) the href — enough to find it in the source. */
const describeFn = `
  function describe(e){
    let s = e.tagName.toLowerCase();
    if (e.id) s += '#' + e.id;
    if (e.className && typeof e.className === 'string' && e.className.trim())
      s += '.' + e.className.trim().split(/\\s+/).join('.');
    const text = (e.textContent || '').trim().replace(/\\s+/g,' ').slice(0, 24);
    if (text) s += ' "' + text + '"';
    return s;
  }
`;

/* Walk the page with real keyboard Tab presses (not el.focus()) and check
   :focus-visible after each stop.
   Why not el.focus() + computed style, the way this used to work: calling
   .focus() from script is NOT a keyboard interaction, so Chromium's
   :focus-visible heuristic mostly does not apply for it (only "always
   focus-visible" controls like text inputs reliably show a ring that way).
   That produced false positives for every link, button and summary on the
   page — the CSS was fine, the probe just never triggered it. It also
   called .focus() on elements hidden by responsive CSS (display:none),
   which is a no-op, so hidden-at-this-viewport elements were flagged as
   "no ring" even though a real keyboard user can never land on them in that
   state. Real Tab presses (via CDP input events) trigger the browser's own
   focus-visible algorithm and naturally skip anything not tab-reachable,
   which is what a keyboard user actually experiences. */
async function tabAudit(page, { pageName, viewportLabel, openDrawer }) {
  const seen = [];
  const CAP = 600;
  for (let i = 0; i < CAP; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(`(() => {
      ${describeFn}
      const e = document.activeElement;
      if (!e || e === document.body || e === document.documentElement) return null;
      const cs = getComputedStyle(e);
      const visible = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none';
      return { sel: describe(e), visible, isDrawerToggle: e.tagName === 'SUMMARY' && e.closest('[data-ntgoc-drawer]') };
    })()`);
    if (!info) break; // Tab left the document — end of the real tab order.
    seen.push(info);
    // The mobile drawer's links live inside <details>; closed, they are
    // display:none and correctly unreachable. Open it, the way a real
    // keyboard user would with Enter/Space on the toggle, so the rest of
    // the panel is exercised too.
    if (openDrawer && info.isDrawerToggle) await page.keyboard.press('Enter');
  }
  focusChecked += seen.length;
  const bad = seen.filter(s => !s.visible);
  for (const o of bad) focusOffenders.push({ page: pageName, viewport: viewportLabel, sel: o.sel });
  return { total: seen.length, bad: bad.length };
}

for(const f of PAGES){
  const p=await b.newPage();
  await p.setViewport({width:320,height:800});
  await p.goto(`${BASE}/${f}`,{waitUntil:'networkidle0'});
  const r=await p.evaluate(()=>{
    const d=document.documentElement;
    const over=[...document.querySelectorAll('*')]
      .filter(e=>e.getBoundingClientRect().right > d.clientWidth+1)
      .slice(0,3).map(e=>e.tagName.toLowerCase()+'.'+(e.className||'').split(' ')[0]);
    return {scrollW:d.scrollWidth, clientW:d.clientWidth, over};
  });
  const ok = r.scrollW <= r.clientW+1;
  if(!ok) bad++;
  console.log(`  ${ok?'PASS':'FAIL'}  ${f.padEnd(18)} scrollWidth ${r.scrollW} vs ${r.clientW}${ok?'':'   overflowing: '+r.over.join(', ')}`);

  // Reuse this same page/load for the mobile-viewport keyboard pass: below
  // the 900px breakpoint the drawer, not the horizontal nav, carries
  // navigation, so this is the state a phone user actually tabs through.
  await tabAudit(p, { pageName: f, viewportLabel: '320w drawer', openDrawer: true });
  await p.close();
}

// Desktop-viewport keyboard pass, where the horizontal nav (and its
// hover/focus-within dropdowns) is what's on screen instead of the drawer.
for (const f of PAGES) {
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 900 });
  await p.goto(`${BASE}/${f}`, { waitUntil: 'networkidle0' });
  await tabAudit(p, { pageName: f, viewportLabel: '1440w desktop', openDrawer: false });
  await p.close();
}

// Counted, not written down: the page count changes, and a number in a report
// that nobody rechecks is worse than no number. Same reasoning as lint's
// stale-count rule, which polices exactly this in the documentation.
console.log(`\nKeyboard focus — real Tab traversal, ${PAGES.length} pages × 2 viewports (320w with drawer opened, 1440w desktop nav)`);
console.log(`  ${focusChecked} focus stops checked, ${focusOffenders.length} without a visible focus indicator`);
for (const o of focusOffenders) {
  console.log(`    NO RING  ${o.page.padEnd(18)} [${o.viewport}]  ${o.sel}`);
}

await b.close();
/* This check now gates the build: the false positives that made it
   unreliable (see tabAudit's comment above) are gone, so a real failure
   here means a real keyboard user gets no visible focus ring. */
process.exit((bad || focusOffenders.length) ? 1 : 0);
