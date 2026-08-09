#!/usr/bin/env node
/**
 * verify.mjs — is the committed output actually what the sources produce?
 *
 *   npm run verify
 *
 * Snapshots every generated file, rebuilds, and compares. Anything that
 * changed means one of two things:
 *
 *   1. Someone hand-edited a generated file. That edit is now GONE — the
 *      snapshot of it is printed so you can move it somewhere durable.
 *   2. A source changed and the rebuild was never committed.
 *
 * Run it before committing, and before trusting anything in dist/chunks/.
 * Exits non-zero if anything moved, so it works as a pre-commit hook or in CI.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const generated = [
  ...readdirSync(ROOT).filter(f => f.endsWith('.html')),
  'assets/css/components.css',
  'assets/css/provisional.css',
  ...(existsSync(join(ROOT, 'dist/chunks'))
    ? readdirSync(join(ROOT, 'dist/chunks')).map(f => `dist/chunks/${f}`)
    : []),
];

const before = new Map();
for (const rel of generated) {
  const p = join(ROOT, rel);
  if (existsSync(p)) before.set(rel, readFileSync(p, 'utf8'));
}

console.log(`  snapshotting ${before.size} generated files, rebuilding…\n`);
for (const script of ['render.mjs', 'extract-chunks.mjs']) {
  execFileSync(process.execPath, [join(ROOT, 'tools', script)], { cwd: ROOT, stdio: 'inherit' });
}

const changed = [];
for (const [rel, old] of before) {
  const p = join(ROOT, rel);
  const now = existsSync(p) ? readFileSync(p, 'utf8') : '';
  if (now !== old) changed.push(rel);
}
const added = generated.filter(rel => !before.has(rel) && existsSync(join(ROOT, rel)));

if (!changed.length && !added.length) {
  console.log('\n  ✓ in sync — the committed output matches what the sources produce.');
  process.exit(0);
}

console.log('\n  ✗ the build output does NOT match what was on disk.\n');
for (const rel of changed) console.log(`      changed: ${rel}`);
for (const rel of added) console.log(`      new:     ${rel}`);

/* Preserve whatever was overwritten, so a hand edit is recoverable. */
const backup = join(ROOT, '.verify-backup');
mkdirSync(backup, { recursive: true });
for (const rel of changed) {
  const dest = join(backup, rel.replace(/[/\\]/g, '__'));
  writeFileSync(dest, before.get(rel));
}

console.log(`
  If you hand-edited one of these, that edit has just been overwritten.
  The previous contents were saved to .verify-backup/ — diff it, then move
  the change somewhere durable:

      layout / copy / colour ....  the Claude Design project, then re-import
      a wrong parish fact .......  CORRECTIONS in tools/render.mjs
      reorder or hide a block ...  applyLocalEdits() in tools/render.mjs

  If instead you changed a source on purpose, this is just an uncommitted
  rebuild: review 'git diff' and commit it.

  See CONTRIBUTING.md.
`);
process.exit(1);
