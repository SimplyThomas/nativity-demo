#!/usr/bin/env node
/**
 * check-links.mjs — do the outbound links still resolve?
 *
 *   npm run links
 *
 * The pages point at the parish's own site, the Archdiocese, two Square giving
 * pages, a Google registration form, fredgreek.org and four YouTube embeds.
 * Those rot without anyone noticing, and a dead giving link on a parish page is
 * worse than no link. Run monthly by CI; never gates a commit, because it
 * depends on servers nobody here controls.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const UA = 'Mozilla/5.0 (compatible; NativityDraftLinkCheck/1.0; +https://simplythomas.github.io/nativity-demo/)';
const TIMEOUT = 20000;

/* Collect every external URL, and where it appears. */
const urls = new Map();
for (const file of readdirSync(ROOT).filter(f => f.endsWith('.html'))) {
  const body = readFileSync(join(ROOT, file), 'utf8');
  // Skip preconnect / dns-prefetch: those are bare origins with no document,
  // so fetching them 404s while the font CSS they warm up is perfectly fine.
  const skip = new Set([...body.matchAll(/<link[^>]*rel="(?:preconnect|dns-prefetch)"[^>]*href="([^"]+)"/g)].map(m => m[1]));
  for (const m of body.matchAll(/(?:href|src)="(https?:\/\/[^"]+)"/g)) {
    const url = m[1].replace(/&amp;/g, '&');
    if (skip.has(m[1])) continue;
    if (!urls.has(url)) urls.set(url, new Set());
    urls.get(url).add(file);
  }
}

async function probe(url) {
  for (const method of ['HEAD', 'GET']) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT);
    try {
      const res = await fetch(url, {
        method, redirect: 'follow', signal: ctl.signal,
        headers: { 'user-agent': UA, accept: '*/*' },
      });
      clearTimeout(timer);
      // Some hosts refuse HEAD but serve GET; only fall through on 4xx/405.
      if (method === 'HEAD' && (res.status === 405 || res.status === 403 || res.status === 404)) continue;
      return { ok: res.ok, status: res.status };
    } catch (e) {
      clearTimeout(timer);
      if (method === 'GET') return { ok: false, status: e.name === 'AbortError' ? 'timeout' : 'unreachable' };
    }
  }
  return { ok: false, status: 'unknown' };
}

const sorted = [...urls.keys()].sort();
console.log(`\n  checking ${sorted.length} distinct external links\n`);

const failures = [];
const blocked = [];
const CONCURRENCY = 6;
for (let i = 0; i < sorted.length; i += CONCURRENCY) {
  const batch = sorted.slice(i, i + CONCURRENCY);
  const results = await Promise.all(batch.map(async u => [u, await probe(u)]));
  for (const [url, r] of results) {
    if (r.ok) continue;
    const entry = { url, status: r.status, pages: [...urls.get(url)] };
    // 403/429 from a CDN is bot-blocking, not a dead link — goarch.org returns
    // 403 to a real browser too. Reported, but never a failure.
    if (r.status === 403 || r.status === 429) blocked.push(entry);
    else failures.push(entry);
  }
}

for (const b of blocked) {
  console.log(`  ! ${b.status} (bot-blocked, not necessarily dead)  ${b.url}`);
}
if (blocked.length) console.log('');

if (!failures.length) {
  console.log(`  ✓ ${sorted.length - blocked.length} of ${sorted.length} links resolve` +
    `${blocked.length ? `; ${blocked.length} could not be checked` : ''}\n`);
  process.exit(0);
}

console.log(`  ✗ ${failures.length} link(s) did not resolve:\n`);
for (const f of failures) {
  console.log(`    ${String(f.status).padEnd(12)} ${f.url}`);
  console.log(`    ${' '.repeat(12)} on: ${f.pages.join(', ')}\n`);
}
console.log(`  A redirect or a rename is fine to fix in place. A dead giving or\n` +
            `  registration link should be removed until it works again.\n`);
process.exit(1);
