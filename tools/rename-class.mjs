#!/usr/bin/env node
/**
 * rename-class.mjs — rename a CSS class everywhere, safely.
 *
 *   node tools/rename-class.mjs <old> <new> [<old2> <new2> …]
 *   node tools/rename-class.mjs --where <class>      # what does this class style?
 *   node tools/rename-class.mjs --suggest [n]        # the worst offenders, with context
 *   node tools/rename-class.mjs --dry <old> <new>    # show the damage, change nothing
 *
 * Most of this stylesheet is named `.ntgoc-s504123` — content hashes left over
 * from when the pages were generated from a Claude Design import. The hashes
 * bought stable diffs across re-imports; that upstream is gone, so now they
 * just make the CSS unreadable.
 *
 * Do NOT mass-rename. A 400-class diff is unreviewable and layout breakage
 * would be invisible in it. Rename the classes in a block when you are already
 * editing that block, one commit at a time. This tool makes each rename a
 * five-second operation instead of a careful find-and-replace across 13 files.
 *
 * Touches: every *.html, assets/css/components.css, assets/js/*.js.
 * Then re-extracts chunks and runs lint, so a bad rename fails immediately.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const DRY = argv.includes('--dry');
const args = argv.filter(a => a !== '--dry');

const pages = () => readdirSync(ROOT).filter(f => f.endsWith('.html'));
const jsFiles = () => existsSync(join(ROOT, 'assets/js'))
  ? readdirSync(join(ROOT, 'assets/js')).map(f => `assets/js/${f}`) : [];
const targets = () => [...pages(), 'assets/css/components.css', ...jsFiles()];

const read = rel => readFileSync(join(ROOT, rel), 'utf8');
const write = (rel, s) => writeFileSync(join(ROOT, rel), s);

/* A class name may only be replaced when it is a whole token — otherwise
   `ntgoc-s5` would also rewrite the middle of `ntgoc-s504123`. */
const tokenRe = name => new RegExp(`(?<![\\w-])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`, 'g');

/* ---------------- inspect ---------------- */

function where(cls) {
  console.log(`\n  ${cls}\n`);

  const css = read('assets/css/components.css');
  const rules = [...css.matchAll(new RegExp(`^\\.${cls}(?![\\w-])[^{]*\\{([^}]*)\\}`, 'gm'))];
  if (!rules.length) console.log('  (no rule in components.css)');
  for (const r of rules) console.log(`  css: ${r[0].split('{')[0].trim()} { ${r[1].trim()} }`);

  console.log('');
  let uses = 0;
  for (const p of pages()) {
    const src = read(p);
    for (const m of src.matchAll(new RegExp(`<(\\w+)[^>]*class="[^"]*(?<![\\w-])${cls}(?![\\w-])[^"]*"[^>]*>([^<]{0,60})`, 'g'))) {
      uses++;
      const text = m[2].replace(/\s+/g, ' ').trim();
      if (uses <= 8) console.log(`  ${p.padEnd(18)} <${m[1]}> ${text ? `“${text}”` : '(no text — layout or image)'}`);
    }
  }
  console.log(`\n  used ${uses} time(s)${uses > 8 ? ' (first 8 shown)' : ''}\n`);
}

function suggest(n = 15) {
  const counts = new Map();
  for (const p of pages()) {
    for (const m of read(p).matchAll(/class="([^"]+)"/g)) {
      for (const c of m[1].split(/\s+/)) {
        if (/^ntgoc-s[0-9a-f]{6}$/.test(c)) counts.set(c, (counts.get(c) || 0) + 1);
      }
    }
  }
  const ranked = [...counts].sort((a, b) => b[1] - a[1]).slice(0, n);
  console.log(`\n  ${counts.size} opaque class names remain. The most-used, worth naming first:\n`);
  const css = read('assets/css/components.css');
  for (const [cls, count] of ranked) {
    const rule = css.match(new RegExp(`^\\.${cls}(?![\\w-])[^{]*\\{([^}]*)\\}`, 'm'));
    const decl = rule ? rule[1].trim().replace(/\s+/g, ' ').slice(0, 78) : '(no rule)';
    console.log(`  ${String(count).padStart(3)}x  ${cls}  ${decl}`);
  }
  console.log(`\n  Inspect one:  node tools/rename-class.mjs --where <class>`);
  console.log(`  Rename it:    node tools/rename-class.mjs <old> ntgoc-something-meaningful\n`);
}

/* ---------------- rename ---------------- */

function rename(pairs) {
  const css = read('assets/css/components.css');

  for (const [from, to] of pairs) {
    if (!/^ntgoc-[a-z0-9-]+$/.test(to)) {
      console.error(`  ✗ "${to}" must be lowercase, ntgoc- prefixed, letters/digits/hyphens only.`);
      process.exit(1);
    }
    if (from === to) { console.error(`  ✗ "${from}" and "${to}" are the same.`); process.exit(1); }
    if (tokenRe(to).test(css)) {
      console.error(`  ✗ "${to}" already exists in components.css — pick another name.`);
      process.exit(1);
    }
    if (!tokenRe(from).test(css) && !pages().some(p => tokenRe(from).test(read(p)))) {
      console.error(`  ✗ "${from}" appears nowhere. Check the spelling.`);
      process.exit(1);
    }
  }

  let total = 0;
  const touched = [];
  for (const rel of targets()) {
    const before = read(rel);
    let after = before;
    for (const [from, to] of pairs) after = after.replace(tokenRe(from), to);
    if (after !== before) {
      const n = [...before.matchAll(tokenRe(pairs[0][0]))].length;
      touched.push(rel);
      total += n;
      if (!DRY) write(rel, after);
    }
  }

  console.log(`\n  ${DRY ? '[dry run] would rename' : 'renamed'}:`);
  for (const [from, to] of pairs) console.log(`    ${from}  ->  ${to}`);
  console.log(`  across ${touched.length} file(s): ${touched.join(', ')}\n`);

  if (DRY) { console.log('  Nothing written (--dry).\n'); return; }

  execFileSync(process.execPath, [join(ROOT, 'tools', 'extract-chunks.mjs')], { cwd: ROOT, stdio: 'pipe' });
  try {
    execFileSync(process.execPath, [join(ROOT, 'tools', 'lint.mjs')], { cwd: ROOT, stdio: 'inherit' });
  } catch {
    console.error('  ✗ lint failed after the rename — review `git diff`, and `git checkout .` to undo.\n');
    process.exit(1);
  }
}

/* ---------------- dispatch ---------------- */

if (args[0] === '--suggest') suggest(Number(args[1]) || 15);
else if (args[0] === '--where') {
  if (!args[1]) { console.error('  usage: --where <class>'); process.exit(1); }
  where(args[1].replace(/^\./, ''));
} else if (args.length >= 2 && args.length % 2 === 0) {
  rename(Array.from({ length: args.length / 2 }, (_, i) => [args[i * 2].replace(/^\./, ''), args[i * 2 + 1].replace(/^\./, '')]));
} else {
  console.log(`
  node tools/rename-class.mjs --suggest [n]        the worst offenders, ranked
  node tools/rename-class.mjs --where <class>      what does this class style?
  node tools/rename-class.mjs <old> <new> [...]    rename (pairs), then lint
  node tools/rename-class.mjs --dry <old> <new>    preview only
`);
}
