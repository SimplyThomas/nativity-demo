#!/usr/bin/env node
/**
 * build-ministries.mjs — render the ministry cards and the ministry pages.
 *
 *   npm run ministries              # rebuild, then re-extract chunks and lint
 *   npm run ministries -- --check   # report what is stale, write nothing
 *
 * One data file, one index page and eight ministry pages:
 *
 *   data/ministries.json  -> the card grid on ministries.html,
 *                            the body of each ministry's own page, and
 *                            MINISTRIES-FOR-THE-PARISH.md
 *
 * WHY THIS EXISTS
 *
 * A ministry page is mostly a roster and a contact route, and both of those are
 * exactly the things that end up at two URLs saying two different things. The
 * Philoptochos board is the case in point: nine names, published once on the
 * ministries grid, and the moment a second page wanted to "introduce the
 * society" there would have been two copies of a list that changes every time
 * somebody stands down. Here the board is in the register, it renders onto one
 * page, and the reversal path recorded in data/parish-facts.json →
 * _rosterPermission has one place to point at.
 *
 * The harder reason is consent. Publishing a parishioner's name is not a
 * formatting decision, and a hand-written page makes it look like one — a
 * volunteer adding a "meet the team" section has no way of knowing that the
 * Parish Council's approval of 2026-08-13 covers twenty-one names and no
 * photographs. So this refuses to render a person who does not carry both a
 * `source` and a `permission`, and refuses a photograph outright until one is
 * recorded. What cannot be published simply does not appear, and the page says
 * so on its face rather than quietly omitting it.
 *
 * WHAT IT MAY TOUCH
 *
 * Only the text between a matching pair of <!-- BUILD:name --> markers, on
 * ministries.html and on the eight pages the register names, plus
 * MINISTRIES-FOR-THE-PARISH.md, which is generated in full. Each ministry page
 * also carries a hand-written section OUTSIDE its markers, for whatever a
 * ministry sends that no schema anticipated; this never reads or rewrites it.
 * Like tools/build-parish.mjs and tools/build-catechumens.mjs, and unlike the
 * retired renderer in tools/archive/, this owns blocks, not files.
 *
 * Unlike the parish calendar this output does NOT depend on today's date, so it
 * is safe to gate: `npm run check` runs it in --check mode.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.slice(2).includes('--check');

const read = rel => readFileSync(join(ROOT, rel), 'utf8');

const PAGE = 'ministries.html';
const DATA = 'data/ministries.json';
const SITE = 'data/site.json';
const ASK_LIST = 'MINISTRIES-FOR-THE-PARISH.md';

/* ------------------------------------------------------------------ *
 * Escaping
 *
 * Same rule as the parish and catechumen builds: everything in the data file is
 * plain text and is escaped on the way in, and the EVO bracket sequences are
 * rejected rather than escaped — it is the CMS parser, not the browser, that
 * eats them.
 * ------------------------------------------------------------------ */
const RESERVED = ['[[', ']]', '[!', '!]', '{{', '}}', '[*', '*]', '[(', ')]', '[~', '~]', '[+', '+]'];

function esc(value, where) {
  const s = String(value ?? '');
  for (const seq of RESERVED) {
    if (s.includes(seq)) {
      throw new Error(`${where}: contains "${seq}", which Evolution CMS interprets. See CLAUDE.md.`);
    }
  }
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ------------------------------------------------------------------ *
 * The data
 * ------------------------------------------------------------------ */
const register = JSON.parse(read(DATA));
const site = JSON.parse(read(SITE));
const ministries = register.ministries || [];
const labels = register.statusLabels || {};

const contact = site.contact || {};
for (const key of ['phone', 'phoneHref', 'officeEmail', 'officeHours']) {
  if (!contact[key]) {
    throw new Error(`${SITE}: contact.${key} is missing, and ${DATA} deliberately does not carry a second copy of it`);
  }
}

const ids = new Set();
const pages = new Set();

for (const m of ministries) {
  const where = `${DATA}: "${m.id || m.title || '(unnamed)'}"`;

  for (const key of ['id', 'page', 'build', 'chunk', 'title', 'eyebrow', 'card', 'cardSource', 'status', 'needs']) {
    if (!m[key]) throw new Error(`${where} has no ${key}`);
  }
  if (typeof m.verified !== 'boolean') {
    throw new Error(`${where} has no \`verified\` flag. Say true if the description is sourced, ` +
      'false if it still needs a TODO: verify marker. There is no third state.');
  }
  if (!labels[m.status]) {
    throw new Error(`${where} has status "${m.status}", which is not one of: ${Object.keys(labels).join(', ')}`);
  }

  // The id becomes an element id on the grid, and a duplicate is both a broken
  // deep link and a lint error two steps later.
  if (ids.has(m.id)) throw new Error(`${DATA}: ministry id "${m.id}" is used more than once`);
  ids.add(m.id);

  // ONE MINISTRY, ONE PAGE. Two entries on one page is the failure this whole
  // register exists to make impossible; see _rules.
  if (pages.has(m.page)) {
    throw new Error(`${DATA}: two ministries claim ${m.page}. A ministry lives at exactly one URL, ` +
      'and one URL holds exactly one ministry.');
  }
  pages.add(m.page);

  /* Consent. A name renders only if somebody recorded where the pairing came
     from AND which approval allows publishing it. Before the Council's approval
     of 2026-08-13 these were doing double duty — standing for an unverified
     roster and for absent consent at the same time — so they are separate
     fields now and both are required. */
  for (const p of m.team || []) {
    if (!p.name) throw new Error(`${where} has a team member with no name`);
    if (!p.source) {
      throw new Error(`${where}: "${p.name}" has no \`source\`. Where does the pairing between ` +
        'this person and this ministry come from?');
    }
    if (!p.permission) {
      throw new Error(`${where}: "${p.name}" has no \`permission\`. Naming a parishioner needs a ` +
        'recorded approval — see data/parish-facts.json → _rosterPermission. Remove the entry ' +
        'rather than guessing; the page says plainly when nobody is named.');
    }
    if ('role' in p === false) {
      throw new Error(`${where}: "${p.name}" has no \`role\` key. Use null for a bare name — titles ` +
        'are never invented, and an absent key reads like an oversight rather than a decision.');
    }
  }

  /* Photographs. _rosterPermission item (3) is explicit that the roster
     approval covers no photograph, so a hint renders a placeholder and a file
     needs consent of its own. */
  for (const photo of m.photos || []) {
    if (!photo.hint) throw new Error(`${where} has a photo entry with no hint`);
    if (photo.file && !photo.permission) {
      throw new Error(`${where}: the photograph "${photo.file}" has no \`permission\`. No face is ` +
        'published on this site without recorded consent — see data/parish-facts.json → ' +
        'assetProvenance._permissionPolicy.');
    }
  }

  // `current` asserts that the ministry has supplied its content. Asserting it
  // with nothing to show is how a page ends up claiming to be finished while
  // saying nothing.
  if (m.status === 'current' && !(m.team || []).length && !(m.links || []).length) {
    throw new Error(`${where} is "current" but names nobody and links nowhere. Use "awaiting" or ` +
      '"partial" until the ministry has actually supplied something.');
  }

  // askFor points at a person the reader can ask for by name at the office, so
  // it has to be somebody this page actually names.
  const askFor = m.involve && m.involve.askFor;
  if (askFor && !(m.team || []).some(p => p.name === askFor)) {
    throw new Error(`${where}: involve.askFor is "${askFor}", who is not in this ministry's team. ` +
      'Telling a reader to ask for somebody the page does not name is how an invented contact starts.');
  }
}

/* ------------------------------------------------------------------ *
 * Rendering — the grid card on ministries.html
 * ------------------------------------------------------------------ */
function card(m) {
  const where = `${DATA}: "${m.id}"`;
  const marker = m.verified ? '' : '<!-- TODO: verify -->';
  const lead = (m.team || []).find(p => p.role) || (m.team || [])[0];
  const leadLine = lead
    ? `\n          <div class="ntgoc-leads-line">${esc(lead.name, where)}` +
      `${lead.role ? `, ${esc(lead.role, where)}` : ''}</div>`
    : '';

  return `        <div class="ntgoc-card-lg" id="ntgoc-ministry-${esc(m.id, where)}">
          <div class="ntgoc-ministry-eyebrow">${esc(m.eyebrow, where)}</div>
          <h2 class="ntgoc-h3-lg">${esc(m.title, where)}</h2>
          <p class="ntgoc-body">${esc(m.card, where)}${marker}</p>${leadLine}
          <a href="${esc(m.page, where)}" class="ntgoc-inherit ntgoc-ministry-card__more">More about ${esc(m.title, where)}</a>
        </div>`;
}

/* ------------------------------------------------------------------ *
 * Rendering — the body of a ministry page
 * ------------------------------------------------------------------ */
function statusBlock(m) {
  const where = `${DATA}: "${m.id}"`;
  const label = labels[m.status];
  return `        <div class="ntgoc-ministry__status">` +
    `<span class="ntgoc-question__tag">${esc(label.label, where)}</span>` +
    `${esc(label.note, where)}</div>`;
}

function teamBlock(m) {
  const where = `${DATA}: "${m.id}"`;
  const out = ['        <section class="ntgoc-ministry__section">',
    '          <h2 class="ntgoc-h3-lg">Who leads it</h2>'];

  if (m.teamNote) out.push(`          <p class="ntgoc-body">${esc(m.teamNote, where)}</p>`);

  if ((m.team || []).length) {
    out.push('          <div class="ntgoc-person-grid ntgoc-grid">');
    for (const p of m.team) {
      out.push('            <div class="ntgoc-person-card">');
      out.push(`              <h3 class="ntgoc-person-name">${esc(p.name, where)}</h3>`);
      // A bare name is a decision, not an omission: the newsletter prints an
      // organisation heading and a name, and inventing "Coordinator" to fill
      // the gap would be inventing a parish fact.
      if (p.role) out.push(`              <div class="ntgoc-person-role">${esc(p.role, where)}</div>`);
      out.push('            </div>');
    }
    out.push('          </div>');
    out.push(`          <div class="ntgoc-ministry__note">${esc(register.noPersonalContact, DATA)}</div>`);
  } else if (!m.teamNote) {
    out.push(`          <p class="ntgoc-ministry__pending">` +
      `<span class="ntgoc-question__tag">${esc(labels.awaiting.label, DATA)}</span>` +
      `${esc(register.noTeamNote, DATA)}</p>`);
  }

  out.push('        </section>');
  return out.join('\n');
}

function photoBlock(m) {
  const where = `${DATA}: "${m.id}"`;
  if (!(m.photos || []).length) return '';
  const frames = m.photos.map(photo => `            <div class="ntgoc-ministry__frame">
              <div class="ntgoc-photoslot">
                <span class="ntgoc-photoslot__label">Photograph to come</span>
                <span class="ntgoc-photoslot__hint">${esc(photo.hint, where)}</span>
              </div>
            </div>`).join('\n');

  return `        <section class="ntgoc-ministry__section">
          <h2 class="ntgoc-h3-lg">Photographs</h2>
          <div class="ntgoc-ministry__photos ntgoc-grid">
${frames}
          </div>
          <div class="ntgoc-ministry__note">Frames rather than photographs, deliberately. Nobody's face is published on this site without their recorded permission, and no photograph here identifies anyone.</div>
        </section>`;
}

function involveBlock(m) {
  const where = `${DATA}: "${m.id}"`;
  /* "the person the parish lists for this ministry" is the wording already on
     the ministries hero, and it is exact: for most of these people the source
     is an organisation heading in the newsletter with a name under it and no
     title at all. Where the source DOES give a title, use it and say no more. */
  const askFor = m.involve && m.involve.askFor;
  const asked = askFor && (m.team || []).find(p => p.name === askFor);
  const ask = asked
    ? asked.role
      ? ` Ask for ${esc(asked.name, where)}, ${esc(asked.role, where)}.`
      : ` Ask for ${esc(asked.name, where)}, who is the person the parish lists for this ministry.`
    : '';

  const links = (m.links || []).map(l =>
    `            <a href="${esc(l.href, where)}" class="ntgoc-inherit ntgoc-ministry__link"` +
    `${/^https?:/.test(l.href) ? ' target="_blank" rel="noreferrer"' : ''}>${esc(l.label, where)}</a>`
  ).join('\n');

  /* The default line says the ministry welcomes newcomers. That is true of most
     of them and false of at least one: the Parish Council is elected, and an
     invitation to come along and join it would be inventing a way in that does
     not exist. So an entry may override it — see involve.intro. */
  const intro = (m.involve && m.involve.intro) || register.involveIntro;

  // officeHours already ends in "3:00 p.m." and a second full stop reads as a
  // typo on eight pages at once.
  const hours = String(contact.officeHours).replace(/\.$/, '');

  return `        <section class="ntgoc-ministry__section">
          <h2 class="ntgoc-h3-lg">How to get involved</h2>
          <p class="ntgoc-body">${esc(intro, DATA)}${ask}</p>
          <p class="ntgoc-body">The parish office — <a href="${esc(contact.phoneHref, SITE)}">${esc(contact.phone, SITE)}</a>, <a href="mailto:${esc(contact.officeEmail, SITE)}">${esc(contact.officeEmail, SITE)}</a>, ${esc(hours, SITE)}.</p>${links ? `
          <div class="ntgoc-ministry__links ntgoc-grid">
${links}
          </div>` : ''}
        </section>`;
}

function body(m) {
  const where = `${DATA}: "${m.id}"`;
  // The same description appears on the card and here, so an unsourced one
  // carries its TODO: verify marker in both places. A marker on the grid alone
  // would say the claim had been checked everywhere it is actually made.
  const marker = m.verified ? '' : '<!-- TODO: verify -->';
  return [
    `        <p class="ntgoc-ministry__lede">${esc(m.card, where)}${marker}</p>`,
    statusBlock(m),
    teamBlock(m),
    photoBlock(m),
    involveBlock(m),
  ].filter(Boolean).join('\n');
}

/* ------------------------------------------------------------------ *
 * MINISTRIES-FOR-THE-PARISH.md
 *
 * The counterpart to QUESTIONS-FOR-FR-JOHN.md, addressed to ministry leads
 * rather than to the priest: what a ministry does is the ministry's to answer.
 * ------------------------------------------------------------------ */
function askList() {
  const lines = [
    '# What each ministry still needs to tell us',
    '',
    '<!-- Generated by tools/build-ministries.mjs from data/ministries.json. Do not edit by hand. -->',
    '',
    'Every parish ministry now has a page of its own. Most of those pages are',
    'mostly empty, and deliberately so: this draft states nothing about a ministry',
    'that nobody has confirmed, so a page says it is waiting rather than filling',
    'the space with something plausible.',
    '',
    'Below is what each ministry would need to supply to fill its page. None of it',
    'is a form — a paragraph in reply, or five minutes at coffee hour, is enough.',
    '',
    `Generated from \`data/ministries.json\`, last updated ${register._updated}.`,
    '',
  ];

  for (const m of ministries) {
    lines.push(`## ${m.title}`);
    lines.push('');
    lines.push(`*${labels[m.status].label} — [${m.page}](${m.page})*`);
    lines.push('');
    if ((m.team || []).length) {
      const named = m.team.map(p => p.role ? `${p.name} (${p.role})` : p.name).join(', ');
      lines.push(`Named on the page: ${named}.`);
    } else if (m.teamNote) {
      // Empty `team` plus a `teamNote` means the roster is published elsewhere
      // on purpose — the Parish Council's is on about.html. Saying nobody is
      // named would send somebody looking for a roster that already exists.
      lines.push(`Nobody is named on this page by design. ${m.teamNote}`);
    } else {
      lines.push('Nobody is named on this page — the parish has not published who leads it.');
    }
    lines.push('');
    lines.push(m.needs);
    lines.push('');
  }

  // Only the ministries with nobody named ANYWHERE — not the Parish Council,
  // whose roster is on about.html and is meant to stay there.
  const unnamed = ministries.filter(m => !(m.team || []).length && !m.teamNote);
  lines.push('---');
  lines.push('');
  lines.push('## A note on names and photographs');
  lines.push('');
  lines.push('Twenty-one parishioners are named in this draft, and the Parish Council');
  lines.push('approved that. The approval covers names and offices only — no personal');
  lines.push('email address, telephone number, photograph or biography. See');
  lines.push('`data/parish-facts.json` → `_rosterPermission`.');
  lines.push('');
  if (unnamed.length) {
    // "N ministry pages", not "N pages": lint's stale-count rule reads any
    // "<number> pages" in a .md file as a claim about how many pages the site
    // has, and would fail this file every time a ministry was added.
    lines.push(`So ${unnamed.length} of the ${ministries.length} ministry pages name nobody at all:`);
    lines.push(`${unnamed.map(m => m.title).join(', ')}. If those ministries have a lead who is`);
    lines.push('willing to be named, that is the single most useful thing to send back.');
    lines.push('');
  }
  lines.push('Every photograph on every ministry page is an empty frame with a caption');
  lines.push('describing what it would show. A photograph can replace a frame as soon as');
  lines.push('somebody records who is in it and that they agreed to appear.');
  lines.push('');

  return lines.join('\n');
}

/* ------------------------------------------------------------------ *
 * Splice the rendered blocks into the pages
 * ------------------------------------------------------------------ */
if (!existsSync(join(ROOT, PAGE))) {
  console.error(`  ✗ ${PAGE} does not exist.`);
  process.exit(1);
}

const changed = [];
const sources = new Map();

/** Replace one BUILD block, refusing to guess if its markers are gone. */
function splice(page, name, content, indent) {
  if (!sources.has(page)) {
    if (!existsSync(join(ROOT, page))) {
      console.error(`  ✗ ${page} does not exist.`);
      console.error('    This tool renders blocks into pages; it does not create them. Create the');
      console.error(`    page with its <!-- BUILD:${name} --> markers first — every other ministry`);
      console.error('    page is a working example.');
      process.exit(1);
    }
    sources.set(page, read(page));
  }
  const src = sources.get(page);
  const open = `<!-- BUILD:${name} -->`;
  const close = `<!-- /BUILD:${name} -->`;
  const a = src.indexOf(open);
  const b = src.indexOf(close);
  if (a === -1 || b === -1 || b < a) {
    console.error(`  ✗ ${page} has no <!-- BUILD:${name} --> … <!-- /BUILD:${name} --> pair.`);
    console.error('    The markers are how this tool knows what it may replace. Put them back;');
    console.error('    it will not guess where the block used to be.');
    process.exit(1);
  }
  const wrapped = '\n' + content + '\n' + ' '.repeat(indent);
  if (src.slice(a + open.length, b) !== wrapped) changed.push(`${page}: ${name}`);
  sources.set(page, src.slice(0, a + open.length) + wrapped + src.slice(b));
}

splice(PAGE, 'ministriesGrid', ministries.map(card).join('\n'), 8);
for (const m of ministries) splice(m.page, m.build, body(m), 8);

const asks = askList();
if (!existsSync(join(ROOT, ASK_LIST)) || read(ASK_LIST) !== asks) changed.push(ASK_LIST);

/* ------------------------------------------------------------------ *
 * Report
 * ------------------------------------------------------------------ */
const named = ministries.reduce((n, m) => n + (m.team || []).length, 0);
const waiting = ministries.filter(m => m.status === 'awaiting').length;
const frames = ministries.reduce((n, m) => n + (m.photos || []).length, 0);

console.log(`\n  ministries — ${ministries.length} in the register, ${waiting} waiting on the ministry itself`);
console.log(`  people — ${named} named, every one with a recorded source and permission`);
console.log(`  photographs — 0 published, ${frames} empty frame(s)`);

if (!changed.length) {
  console.log('  ✓ every page and the review list are already current\n');
  process.exit(0);
}

console.log(`\n  ${CHECK ? 'stale' : 'rewritten'}:`);
for (const c of changed) console.log(`    ${c}`);

if (CHECK) {
  console.log('\n  Run "npm run ministries" to rebuild.\n');
  process.exit(1);
}

for (const [page, text] of sources) writeFileSync(join(ROOT, page), text);
writeFileSync(join(ROOT, ASK_LIST), asks);

console.log('\n  re-extracting chunks and linting…\n');
execFileSync(process.execPath, [join(ROOT, 'tools', 'extract-chunks.mjs')], { cwd: ROOT, stdio: 'pipe' });
try {
  execFileSync(process.execPath, [join(ROOT, 'tools', 'lint.mjs')], { cwd: ROOT, stdio: 'inherit' });
} catch {
  console.error('  ✗ lint failed after the build — review `git diff`.\n');
  process.exit(1);
}
