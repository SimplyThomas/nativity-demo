#!/usr/bin/env node
/**
 * dev.mjs — local preview.
 *
 *   npm run dev        then open http://localhost:4000
 *
 * The HTML and CSS in this repo are the source: edit them directly and reload.
 * Nothing is generated from them except the Evolution CMS chunks, so the only
 * thing this watcher does on save is re-extract those, keeping dist/chunks/ in
 * step with the pages.
 *
 * No dependencies — node:http and node:fs only — which keeps the promise that
 * the site works if you just open index.html from disk.
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
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.md': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
};

let busy = false, queued = false;

async function extractChunks(reason) {
  if (busy) { queued = true; return; }
  busy = true;
  process.stdout.write(`  ${reason} → re-extracting chunks… `);
  await new Promise(resolve => {
    execFile(process.execPath, [join(ROOT, 'tools', 'extract-chunks.mjs')], { cwd: ROOT },
      (err, stdout, stderr) => {
        console.log(err ? 'FAILED' : (stdout.trim().split('\n').pop() || 'ok'));
        if (err) console.error(stderr || stdout);
        resolve();
      });
  });
  busy = false;
  if (queued) { queued = false; await extractChunks('queued change'); }
}

/* Watch what you actually edit. dist/chunks is output — watching it would loop. */
let debounce;
for (const target of ['index.html', 'assets']) {
  watch(join(ROOT, target), { recursive: true }, (_e, file) => {
    if (!file || file.endsWith('~') || file.includes('node_modules')) return;
    clearTimeout(debounce);
    debounce = setTimeout(() => extractChunks(file), 150);
  });
}
watch(ROOT, (_e, file) => {
  if (!file || !file.endsWith('.html')) return;
  clearTimeout(debounce);
  debounce = setTimeout(() => extractChunks(file), 150);
});

createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (path.endsWith('/')) path += 'index.html';
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
      'cache-control': 'no-store',
    });
    res.end(await readFile(full));
  } catch (e) {
    res.writeHead(500).end(String(e));
  }
}).listen(PORT, () => {
  console.log(`\n  Nativity draft preview   http://localhost:${PORT}`);
  console.log(`  Edit the .html files and assets/css/ directly, then reload.`);
  console.log(`  Chunks re-extract on save. Run "npm run lint" before committing.\n`);
});
