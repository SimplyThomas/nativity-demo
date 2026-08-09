import puppeteer from 'puppeteer-core';

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
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.SITE_URL || `file://${REPO}`;
const SITE = process.argv[2] || BASE;
/* Read the pages off disk rather than listing them, the way lint.mjs does.
   This list used to be hard-coded, which meant a page added to the repo was
   silently never audited — the run still said every page passed. */
import { readdirSync } from 'node:fs';
const PAGES = readdirSync(REPO).filter(f => f.endsWith('.html')).sort();
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--allow-file-access-from-files'],
});

const all = [];

for (const vp of VIEWPORTS) {
  for (const file of PAGES) {
    const page = await browser.newPage();
    await page.setViewport({ width: vp.width, height: vp.height });
    await page.goto(`${SITE}/${file}`, { waitUntil: 'networkidle0', timeout: 45000 });
    await page.evaluate(axeSource);
    const res = await page.evaluate(async () => await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
      resultTypes: ['violations', 'incomplete'],
    }));
    for (const v of res.violations) {
      all.push({
        viewport: vp.name, page: file, id: v.id, impact: v.impact,
        help: v.help, count: v.nodes.length,
        sample: v.nodes.slice(0, 999).map(n => ({
          target: n.target.join(' '),
          summary: (n.failureSummary || '').replace(/\s+/g, ' ').slice(0, 400),
        })),
      });
    }
    for (const v of res.incomplete) {
      all.push({
        viewport: vp.name, page: file, id: v.id, impact: 'NEEDS-REVIEW',
        help: v.help, count: v.nodes.length,
        sample: v.nodes.slice(0, 1).map(n => ({ target: n.target.join(' '), summary: '' })),
      });
    }
    await page.close();
  }
}

await browser.close();
writeFileSync(new URL('../axe-results.json', import.meta.url), JSON.stringify(all, null, 2));

/* ---- summary ---- */
const order = { critical: 0, serious: 1, moderate: 2, minor: 3, 'NEEDS-REVIEW': 4 };
const byRule = new Map();
for (const r of all) {
  const k = `${r.impact}|${r.id}`;
  if (!byRule.has(k)) byRule.set(k, { ...r, pages: new Set(), nodes: 0 });
  const e = byRule.get(k);
  e.pages.add(`${r.page}@${r.viewport}`);
  e.nodes += r.count;
}
const rows = [...byRule.values()].sort((a, b) =>
  (order[a.impact] ?? 9) - (order[b.impact] ?? 9) || b.nodes - a.nodes);

console.log(`\nPages audited: ${PAGES.length} x ${VIEWPORTS.length} viewports = ${PAGES.length * VIEWPORTS.length} runs`);
console.log(`Distinct issues: ${rows.length}\n`);
console.log('IMPACT        RULE                             NODES  PAGE-RUNS  DESCRIPTION');
for (const r of rows) {
  console.log(
    `${(r.impact || '?').padEnd(13)} ${r.id.padEnd(32)} ${String(r.nodes).padStart(5)}  ${String(r.pages.size).padStart(9)}  ${r.help}`);
  for (const s of r.sample) console.log(`              -> ${s.target}`.slice(0, 140));
}
if (!rows.length) console.log('  No violations and nothing flagged for review.');

/* Only real violations fail the build. "NEEDS-REVIEW" is axe declining to judge
   text over background images; those are verified by hand in ACCESSIBILITY.md. */
const violations = rows.filter(r => r.impact !== 'NEEDS-REVIEW');
const nodes = violations.reduce((n, r) => n + r.nodes, 0);
if (violations.length) {
  console.error(`\n  ✗ ${violations.length} accessibility rule(s) violated across ${nodes} node(s).`);
  console.error('    See ACCESSIBILITY.md for how the existing ones were resolved.\n');
  process.exit(1);
}
console.log(`\n  ✓ no WCAG 2.1 AA violations across ${PAGES.length * VIEWPORTS.length} page-runs.\n`);
