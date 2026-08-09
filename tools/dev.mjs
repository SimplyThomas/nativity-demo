#!/usr/bin/env node
/**
 * dev.mjs — local preview with rebuild-on-save.
 *
 *   npm run dev        then open http://localhost:4000
 *
 * Watches the things you actually edit (design-src/, tools/, data/), re-runs
 * the build, and serves the repo as static files. No dependencies — just
 * node:http and node:fs — so this stays true to "the site works if you open
 * index.html from disk".
 *
 * It deliberately does NOT watch the generated .html files. Editing those is
 * the one thing you should not do; see CONTRIBUTING.md.
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { watch } from 'node:fs';
import { execFile } from 'node:child_process';
import { join, extname, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 4000;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.md': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

/* ---------------- build ---------------- */

let building = false;
let queued = false;

function run(script) {
  return new Promise(resolve => {
    execFile(process.execPath, [join(ROOT, 'tools', script)], { cwd: ROOT },
      (err, stdout, stderr) => resolve({ err, stdout, stderr }));
  });
}

async function build(reason) {
  if (building) { queued = true; return; }
  building = true;
  const started = Date.now();
  process.stdout.write(`\n  rebuilding (${reason})… `);

  const render = await run('render.mjs');
  if (render.err) {
    console.log('FAILED');
    console.error(render.stderr || render.stdout);
  } else {
    const chunks = await run('extract-chunks.mjs');
    if (chunks.err) {
      console.log('FAILED (chunk extraction)');
      console.error(chunks.stderr || chunks.stdout);
    } else {
      console.log(`ok in ${Date.now() - started}ms`);
      for (const line of (render.stdout + chunks.stdout).trim().split('\n')) {
        if (line.trim()) console.log(`    ${line.trim()}`);
      }
      // Surface the warning applyLocalEdits() emits when a hand edit stops matching.
      if (render.stderr.trim()) console.error(render.stderr.trim());
    }
  }

  building = false;
  if (queued) { queued = false; await build('queued change'); }
}

/* ---------------- watch ---------------- */

const WATCHED = ['design-src', 'tools', 'data'];
let debounce;

for (const dir of WATCHED) {
  watch(join(ROOT, dir), { recursive: true }, (_event, file) => {
    if (!file || file.endsWith('~') || file.includes('node_modules')) return;
    if (file === 'dev.mjs') return;                 // editing this file; restart manually
    clearTimeout(debounce);
    debounce = setTimeout(() => build(`${dir}/${file}`), 120);
  });
}

/* ---------------- serve ---------------- */

createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (path.endsWith('/')) path += 'index.html';

    // Keep the server inside the repo.
    const full = join(ROOT, normalize(path).replace(/^(\.\.[/\\])+/, ''));
    if (!full.startsWith(ROOT)) { res.writeHead(403).end('Forbidden'); return; }

    const info = await stat(full).catch(() => null);
    if (!info || !info.isFile()) {
      res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
      res.end('<h1>404</h1><p>Not found. Try <a href="/">/</a>.</p>');
      return;
    }

    res.writeHead(200, {
      'content-type': TYPES[extname(full).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-store',   // always see the latest build
    });
    res.end(await readFile(full));
  } catch (e) {
    res.writeHead(500).end(String(e));
  }
}).listen(PORT, () => {
  console.log(`\n  Nativity draft preview`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`  watching: ${WATCHED.join(', ')}   (generated .html is not watched — do not edit it)`);
  build('startup');
});
