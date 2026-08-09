#!/usr/bin/env node
/**
 * rename-class.mjs — rename a CSS class everywhere, safely.
 *
 *   node tools/rename-class.mjs <old> <new> [<old2> <new2> …]
 *   node tools/rename-class.mjs --where <class>      # what does this class style?
 *   node tools/rename-class.mjs --suggest [n]        # the worst offenders, with context
 *   node tools/rename-class.mjs --dry <old> <new>    # show the damage, change nothing
 *
 * Every name must match the house convention:
 *
 *     ntgoc-<block>[__<element>][--<modifier>]
 *
 * Enforced here and by tools/lint.mjs, documented in CONTRIBUTING.md.
 *
 * Bulk renames are safe because `npm run snap` can prove one moved nothing —
 * that is how the original 338 content-hash names were replaced. Run the
 * snapshot either side of anything large.
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
/**
 * The house naming convention: ntgoc-<block>[__<element>][--<modifier>], every
 * part lowercase kebab-case. Enforced here and in tools/lint.mjs; documented in
 * CONTRIBUTING.md. Two conventions drifting apart is how this repo ended up
 * with both `ntgoc-pl-kicker` and `ntgoc-page-eyebrow` for the same rule.
 */
const CLASS_GRAMMAR =
  /^ntgoc-[a-z0-9]+(?:-[a-z0-9]+)*(?:__[a-z0-9]+(?:-[a-z0-9]+)*)?(?:--[a-z0-9]+(?:-[a-z0-9]+)*)?$/;

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
    if (!CLASS_GRAMMAR.test(to)) {
      console.error(`  ✗ "${to}" does not match the naming convention:\n` +
        `      ntgoc-<block>[__<element>][--<modifier>], each part lowercase kebab-case.\n` +
        `      See "Naming CSS classes" in CONTRIBUTING.md.`);
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

/**
 * Merge one class into another that has identical declarations: every use of
 * `from` becomes `to`, and `from`'s now-redundant rule is deleted. Refuses if
 * the declarations differ, because that would silently restyle something.
 */
function merge(from, to) {
  const cssPath = 'assets/css/components.css';
  let css = read(cssPath);
  /**
   * Every rule for the class, not just the top-level one. Comparing only the
   * base rule is not enough: two classes can carry identical declarations and
   * still behave differently, because one of them has a media-query or :hover
   * override the other lacks. Merging those silently applies one block's
   * responsive behaviour to the other — which is exactly what happened when
   * ntgoc-pl-section, carrying a mobile `padding: 64px !important`, was merged
   * into the Visit directions shell and shrank that section by 48px.
   */
  const rulesFor = name => [...css.matchAll(
    new RegExp(`\\.${name}(?![\\w-])([^{]*)\\{([^}]*)\\}`, 'g'))]
    .map(m => `${m[1].trim()}{${m[2].split(/\s+/).join(' ').trim()}}`)
    .sort();

  const a = rulesFor(from);
  const b = rulesFor(to);
  if (!a.length) { console.error(`  ✗ "${from}" has no rule.`); process.exit(1); }
  if (!b.length) { console.error(`  ✗ "${to}" has no rule.`); process.exit(1); }
  if (a.length !== b.length || a.some((r, i) => r !== b[i])) {
    console.error(`  ✗ refusing to merge "${from}" into "${to}" — they are not equivalent.`);
    console.error(`      ${from} has ${a.length} rule(s), ${to} has ${b.length}:`);
    for (const r of a) if (!b.includes(r)) console.error(`      only on ${from}: ${r.slice(0, 84)}`);
    for (const r of b) if (!a.includes(r)) console.error(`      only on ${to}:   ${r.slice(0, 84)}`);
    console.error(`      A difference in a media query or :hover means the two blocks\n` +
                  `      behave differently even where the base declarations match.\n`);
    process.exit(1);
  }

  for (const rel of targets()) {
    if (rel === cssPath) continue;
    const before = read(rel);
    const after = before.replace(tokenRe(from), to);
    if (after !== before && !DRY) write(rel, after);
  }
  // Drop the redundant rule, and any :hover/:focus pair that came with it.
  css = css.replace(new RegExp(`^\\.${from}(?![\\w-])[^{]*\\{[^}]*\\}\\n?`, 'gm'), '');
  css = css.replace(tokenRe(from), to);
  if (!DRY) write(cssPath, css);
  console.log(`  ${DRY ? '[dry] ' : ''}merged ${from} -> ${to} (rule removed)`);
}

if (args[0] === '--merge') {
  if (args.length < 3 || args.length % 2 !== 1) {
    console.error('  usage: --merge <from> <into> [<from2> <into2> …]'); process.exit(1);
  }
  for (let i = 1; i < args.length; i += 2) merge(args[i].replace(/^\./, ''), args[i + 1].replace(/^\./, ''));
  if (!DRY) {
    execFileSync(process.execPath, [join(ROOT, 'tools', 'extract-chunks.mjs')], { cwd: ROOT, stdio: 'pipe' });
    try {
      execFileSync(process.execPath, [join(ROOT, 'tools', 'lint.mjs')], { cwd: ROOT, stdio: 'inherit' });
    } catch {
      console.error('  ✗ lint failed after the merge — `git checkout .` to undo.\n');
      process.exit(1);
    }
  }
} else if (args[0] === '--from-file') {
  // Batch mode. Only worth using with `npm run snap` either side of it: a large
  // rename is safe precisely because the snapshot can prove nothing moved.
  if (!args[1]) { console.error('  usage: --from-file <old-to-new.json>'); process.exit(1); }
  const map = JSON.parse(readFileSync(args[1], 'utf8'));
  const pairs = Object.entries(map);
  console.log(`  ${pairs.length} rename(s) from ${args[1]}`);
  rename(pairs);
} else if (args[0] === '--suggest') suggest(Number(args[1]) || 15);
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
