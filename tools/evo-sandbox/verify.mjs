#!/usr/bin/env node
/**
 * Prove that the chunks in dist/chunks/ actually survive Evolution CMS — on
 * both 1.4.18 and 3.5.7.
 *
 * This is the point of the sandbox. IMPORT.md asserts that these blocks are
 * hand-portable into EVO; without this, that is a claim in a document. Here it
 * is a check with an exit code.
 *
 * Four assertions per page, per version:
 *
 *   1. HTTP 200.
 *   2. No unresolved EVO tag in the output. A literal {{ }}, [~ ~], [* *],
 *      [( )], [[ ]] or [! !] in rendered HTML means the parser did not consume
 *      it — the silent-corruption failure mode CLAUDE.md rule 1 exists for.
 *   3. Round-trip fidelity: every literal run of each expected chunk's body
 *      appears in the rendered page, whitespace-normalised. This is what makes
 *      "the chunks import cleanly" a measurement.
 *   4. Every data-ntgoc-link placeholder resolved — no href="#" left.
 *
 * What it does NOT cover, deliberately: it exercises the database path, so it
 * says nothing about a human pasting into the manager textarea, and it cannot
 * test TinyMCE mangling. Avoiding TinyMCE is the whole point of chunks; see
 * the manual checks in this directory's README.
 *
 * Usage: npm run evo:verify
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const CHUNKS = join(ROOT, 'dist', 'chunks');

const INSTANCES = [
  { label: 'EVO 1.4.18', port: process.env.PORT_EVO14 || '8014' },
  { label: 'EVO 3.5.7', port: process.env.PORT_EVO35 || '8035' },
];

/** Tags EVO must have consumed. Same list as tools/lint.mjs. */
const RESERVED = [
  ['[[', ']]', 'cached snippet call'],
  ['[!', '!]', 'uncached snippet call'],
  ['{{', '}}', 'chunk call'],
  ['[*', '*]', 'template variable'],
  ['[(', ')]', 'system setting'],
  ['[~', '~]', 'link by resource id'],
  ['[+', '+]', 'placeholder'],
];

let failures = 0;
let checks = 0;
let skipped = 0;

const fail = (where, msg) => { failures++; console.error(`  FAIL  ${where}\n        ${msg}`); };
const pass = () => { checks++; };

/**
 * EVO re-emits chunk bodies verbatim, but Apache, the template and the page
 * assembly all shift indentation around. Comparing on collapsed whitespace
 * keeps the check strict about content and silent about layout.
 */
const normalise = s => s.replace(/\s+/g, ' ').trim();

/** Read a chunk's body the way seed.php does: without the header comment. */
function chunkBody(name) {
  const raw = readFileSync(join(CHUNKS, `${name}.html`), 'utf8');
  const m = raw.match(/^\s*<!--.*?-->\s*/s);
  return m ? raw.slice(m[0].length) : raw;
}

/**
 * Split a chunk body on its link placeholders. The literal runs between them
 * must survive into the rendered page byte for byte (modulo whitespace); the
 * placeholders themselves are expected to have become [~id~] and then a URL.
 */
function literalRuns(body) {
  return body
    .split(/href="#"\s+data-ntgoc-link="[^"]+"/)
    .map(normalise)
    .filter(run => run.length >= 24);
}

async function get(url) {
  const res = await fetch(url, { redirect: 'follow' });
  return { status: res.status, body: await res.text() };
}

async function verifyInstance({ label, port }) {
  const base = `http://127.0.0.1:${port}`;
  console.log(`\n${label}  (${base})`);

  let manifest;
  try {
    const res = await get(`${base}/assets/templates/ntgoc/seed-manifest.json`);
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
    manifest = JSON.parse(res.body);
  } catch (e) {
    // A stopped instance is a choice, not a failure. Once the parish's version
    // is settled there is little reason to keep the other one running, and
    // `docker compose stop evo35` should not turn this check red. A refused
    // connection means "not running"; anything else means it is up and broken.
    if (e.cause?.code === 'ECONNREFUSED' || e.message.includes('fetch failed')) {
      console.log(`  SKIP  not running (${base}) — start it with \`npm run evo:up\``);
      skipped++;
      return;
    }
    fail(label, `is running but cannot serve seed-manifest.json (${e.message}). Re-run \`npm run evo:seed\`.`);
    return;
  }

  console.log(`  manifest: ${manifest.pages.length} pages, ${manifest.chunkCount} chunks, ` +
              `${manifest.linksResolved} links resolved`);

  for (const page of manifest.pages) {
    const where = `${label} ${page.alias} (id ${page.id})`;
    const { status, body } = await get(`${base}/index.php?id=${page.id}`);

    if (status !== 200) { fail(where, `HTTP ${status}`); continue; }
    pass();

    // 2. no unresolved EVO tags
    for (const [open, close, meaning] of RESERVED) {
      if (body.includes(open) && body.includes(close)) {
        fail(where, `rendered output still contains ${open} ${close} (${meaning}) — EVO did not parse it`);
      } else pass();
    }

    // 4. every placeholder resolved
    if (/href="#"\s+data-ntgoc-link=/.test(body)) {
      fail(where, 'an unresolved href="#" data-ntgoc-link placeholder reached the page');
    } else pass();

    // 3. round-trip fidelity, for the page's own chunks and the shell chunks
    const flat = normalise(body);
    for (const name of [...manifest.shellChunks, ...page.chunks]) {
      if (!existsSync(join(CHUNKS, `${name}.html`))) {
        fail(where, `manifest names chunk ${name}, which is not in dist/chunks`);
        continue;
      }
      const missing = literalRuns(chunkBody(name)).filter(run => !flat.includes(run));
      if (missing.length > 0) {
        fail(where, `chunk ${name} did not survive rendering. First missing run:\n        ` +
                    `${JSON.stringify(missing[0].slice(0, 160))}`);
      } else pass();
    }
  }
}

const known = new Set(
  readdirSync(CHUNKS).filter(f => f.endsWith('.html') && !f.startsWith('_')).map(f => f.slice(0, -5))
);
console.log(`verifying ${known.size} chunks against ${INSTANCES.length} Evolution CMS installations`);

for (const instance of INSTANCES) {
  await verifyInstance(instance);
}

const tail = skipped > 0 ? `, ${skipped} instance(s) skipped` : '';
console.log(`\n  ${checks} assertions passed, ${failures} failed${tail}\n`);

if (checks === 0 && failures === 0) {
  console.error('  Nothing was verified — no instance was reachable. `npm run evo:up` first.\n');
  process.exit(1);
}
process.exit(failures > 0 ? 1 : 0);
