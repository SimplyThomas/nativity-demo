#!/usr/bin/env node
/**
 * build-parish.mjs — render the parish calendar and the parish announcements
 * into the pages that show them.
 *
 *   npm run parish                 # rebuild, then re-extract chunks and lint
 *   npm run parish -- --check      # report what is stale, write nothing
 *   npm run parish -- --today 2026-09-06
 *
 * WHY THIS EXISTS
 *
 * The same list of services was hand-written into three places: the month grid
 * on calendar.html, "The next few weeks" on parish-life.html, and (now) "This
 * week at Nativity" on for-our-parish.html. Two of the three had already
 * drifted — parish-life.html showed the Sunday Liturgy at 9:00 a.m. when the
 * parish had confirmed 10:00, and gave 14 and 15 August the wrong weekday
 * names. parish-life.html even carried a comment admitting the list goes stale.
 *
 * So the calendar lives in data/parish-calendar.json and this renders it. Same
 * for announcements: data/parish-announcements.json is the whole editing
 * surface, so the parish administrator adds a notice without touching markup.
 *
 * WHAT IT MAY TOUCH
 *
 * Only the text between a matching pair of <!-- BUILD:name --> markers. It
 * refuses to run if a marker is missing rather than guessing where the block
 * went. Everything outside those markers is hand-written source and is never
 * read, rewritten or reformatted — this is deliberately NOT the retired
 * renderer in tools/archive/, which owned whole files.
 *
 * NOT run by CI, and lint does not require its output to be current: "upcoming"
 * depends on today's date, so a CI check would fail every morning. Rebuild when
 * you change either data file, and before you publish.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const CHECK = argv.includes('--check');
const todayArg = argv.indexOf('--today');

const read = rel => readFileSync(join(ROOT, rel), 'utf8');
const json = rel => JSON.parse(read(rel));

/* How many events "this week" shows before it stops. The brief asked for five
   to seven; seven covers a fortnight of a normal parish week without the block
   turning into a second calendar page. */
const WEEK_LIMIT = 7;
/* "The next few weeks" on parish-life.html was five hand-written rows covering
   five different days. Counted in DAYS rather than events, so a Sunday with
   Orthros and Liturgy on it does not spend two of the five. */
const AGENDA_DAYS = 5;

/* ------------------------------------------------------------------ *
 * Dates
 *
 * Parsed as LOCAL dates. `new Date('2026-08-15')` is parsed as UTC and lands on
 * the 14th for everyone west of Greenwich, which is the whole parish.
 * ------------------------------------------------------------------ */
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function parseDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) throw new Error(`"${iso}" is not an ISO YYYY-MM-DD date`);
  return new Date(+m[1], +m[2] - 1, +m[3]);
}

const isoOf = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dayMonth = d => `${d.getDate()} ${MONTHS[d.getMonth()]}`;
const weekday = d => DAYS[d.getDay()];

const TODAY = todayArg !== -1 ? parseDate(argv[todayArg + 1]) : parseDate(isoOf(new Date()));

/**
 * "9:00 a.m." -> "9a", "6:30 p.m." -> "6:30p".
 * A month cell is about twenty characters wide, so the long form does not fit.
 * Anything this does not recognise is passed through untouched rather than
 * mangled — a time nobody can parse is better than a time silently wrong.
 */
function shortTime(time) {
  const m = /^(\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s*m\.?$/i.exec(String(time || '').trim());
  if (!m) return time || '';
  return m[1] + (m[2] && m[2] !== '00' ? ':' + m[2] : '') + m[3].toLowerCase();
}

/* ------------------------------------------------------------------ *
 * Escaping
 *
 * Everything in the two data files is plain text and is escaped on the way in.
 * The EVO bracket sequences are rejected outright: they cannot be escaped into
 * safety, because it is the CMS parser and not the browser that eats them.
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

/** Unverified claims stay flagged, in every place the event is rendered. */
const todo = ev => (ev.verify ? '<!-- TODO: verify -->' : '');

/* ------------------------------------------------------------------ *
 * The data
 * ------------------------------------------------------------------ */
const calendar = json('data/parish-calendar.json');
const announcements = json('data/parish-announcements.json');

const events = [...(calendar.events || [])]
  .map((ev, i) => {
    if (!ev.name) throw new Error(`data/parish-calendar.json: event ${i} has no name`);
    if (ev.kind !== 'service' && ev.kind !== 'parish') {
      throw new Error(`data/parish-calendar.json: event ${i} ("${ev.name}") has kind "${ev.kind}" — it must be "service" or "parish"`);
    }
    return { ...ev, at: parseDate(ev.date) };
  })
  .sort((a, b) => a.at - b.at);

const KIND_LABEL = { service: 'Divine service', parish: 'Parish life' };

/* ------------------------------------------------------------------ *
 * The month grid on calendar.html
 *
 * Six rows of seven, which is what the hand-written grid had: enough for any
 * month, so the grid never changes height between months.
 * ------------------------------------------------------------------ */
function renderMonthGrid() {
  const [year, month] = String(calendar.month.id).split('-').map(Number);
  const first = new Date(year, month - 1, 1);
  const days = new Date(year, month, 0).getDate();
  const lead = first.getDay();

  const byDay = new Map();
  for (const ev of events) {
    if (ev.at.getFullYear() !== year || ev.at.getMonth() !== month - 1) continue;
    if (!byDay.has(ev.at.getDate())) byDay.set(ev.at.getDate(), []);
    byDay.get(ev.at.getDate()).push(ev);
  }

  const cells = [];
  for (let i = 0; i < 42; i++) {
    const day = i - lead + 1;
    if (day < 1 || day > days) {
      cells.push('              <div class="ntgoc-calendar-day">\n' +
                 '                <div class="ntgoc-calendar-daynum"></div>\n' +
                 '              </div>');
      continue;
    }
    const todays = byDay.get(day) || [];
    const chips = todays.map(ev => {
      const label = ev.short || `${ev.service || ev.name} ${shortTime(ev.time)}`.trim();
      // The kind is carried as a data attribute and styled from it, so a parish
      // event needs no new class. Colour is never the only signal: a parish
      // event also announces itself, for anyone who cannot see the colour.
      const spoken = ev.kind === 'parish'
        ? '<span class="ntgoc-visually-hidden">Parish event: </span>' : '';
      return `                  <div class="ntgoc-calendar-event" data-ntgoc-kind="${ev.kind}">${spoken}${esc(label, 'calendar event')}${todo(ev)}</div>`;
    });

    cells.push('              <div class="ntgoc-calendar-day">\n' +
      `                <div class="ntgoc-calendar-daynum">${day}</div>\n` +
      (chips.length
        ? '                <div class="ntgoc-calendar-day__events">\n' + chips.join('\n') + '\n                </div>\n'
        : '') +
      '              </div>');
  }
  return cells.join('\n');
}

/* ------------------------------------------------------------------ *
 * Upcoming events, grouped by day
 *
 * Everything from today onwards. Today counts: a parishioner opening this on a
 * Sunday morning wants to see Sunday morning.
 * ------------------------------------------------------------------ */
function upcoming(limit, unit) {
  const days = [];
  let count = 0;
  for (const ev of events) {
    if (ev.at < TODAY) continue;
    const last = days[days.length - 1];
    const sameDay = last && last.iso === ev.date;
    if (unit === 'days' ? (!sameDay && days.length >= limit) : count >= limit) break;
    if (sameDay) last.events.push(ev);
    else days.push({ iso: ev.date, at: ev.at, events: [ev] });
    count++;
  }
  return { days, count, total: events.filter(e => e.at >= TODAY).length };
}

/**
 * "This week at Nativity" on for-our-parish.html.
 *
 * Each day carries data-ntgoc-date so the browser can drop a day that has
 * already passed. The page is static and may sit unrebuilt for a fortnight;
 * with JavaScript off the list is still correct as of the date printed under it.
 */
function renderThisWeek() {
  const { days, count, total } = upcoming(WEEK_LIMIT, 'events');
  if (!days.length) {
    return '        <p class="ntgoc-body-lg">Nothing further is on the parish calendar at the moment. ' +
      'The calendar is the place to check.</p>';
  }

  /* Every row is labelled "Divine service" or "Parish life", but the label is
     only SHOWN when the list actually holds both. A week of nothing but
     services does not need every row saying so on screen — that is the clutter
     the brief warned about — while a screen reader gets the label either way,
     and the moment the parish adds a meeting or a class it becomes visible on
     every row. So the burgundy/gold distinction is never carried by colour
     alone at the point where it means something. */
  const mixed = new Set(days.flatMap(d => d.events.map(e => e.kind))).size > 1;

  const rows = days.map(day => {
    const items = day.events.map(ev => {
      const name = esc(ev.name, 'event name');
      const detail = [ev.service ? esc(ev.service, 'event service') : '', ev.note ? esc(ev.note, 'event note') : '']
        .filter(Boolean).join(' &middot; ');
      return [
        `            <div class="ntgoc-our-parish-week__event" data-ntgoc-kind="${ev.kind}">`,
        '              <div>',
        `                <div class="ntgoc-our-parish-week__name">${name}${todo(ev)}</div>`,
        detail ? `                <div class="ntgoc-our-parish-week__note">${detail}</div>` : '',
        ev.location ? `                <div class="ntgoc-our-parish-week__note">${esc(ev.location, 'event location')}</div>` : '',
        `                <div class="ntgoc-our-parish-week__kind${mixed ? '' : ' ntgoc-visually-hidden'}">${KIND_LABEL[ev.kind]}</div>`,
        '              </div>',
        `              <div class="ntgoc-our-parish-week__time">${ev.time ? esc(ev.time, 'event time') : '&mdash;'}</div>`,
        '            </div>',
      ].filter(Boolean).join('\n');
    }).join('\n');

    return [
      `        <li class="ntgoc-our-parish-week__day" data-ntgoc-date="${day.iso}">`,
      '          <div class="ntgoc-our-parish-week__when">',
      `            <div class="ntgoc-our-parish-week__weekday">${weekday(day.at)}</div>`,
      `            <div class="ntgoc-our-parish-week__date">${dayMonth(day.at)}</div>`,
      '          </div>',
      '          <div class="ntgoc-our-parish-week__events">',
      items,
      '          </div>',
      '        </li>',
    ].join('\n');
  });

  const more = total > count
    ? ` The next ${count} of ${total} on the calendar this month.`
    : '';

  return [
    '      <ol class="ntgoc-our-parish-week" data-ntgoc-week>',
    rows.join('\n'),
    '      </ol>',
    '      <p class="ntgoc-our-parish-week__asof" data-ntgoc-week-empty hidden>Everything listed here has now passed. ' +
      'The parish calendar has what is coming next.</p>',
    `      <p class="ntgoc-our-parish-week__asof">Taken from the parish calendar on ${dayMonth(TODAY)} ${TODAY.getFullYear()}.${more}</p>`,
  ].join('\n');
}

/** "The next few weeks" on parish-life.html — the same data, that page's markup. */
function renderAgenda() {
  const { days } = upcoming(AGENDA_DAYS, 'days');
  if (!days.length) return '        <!-- Nothing upcoming on the parish calendar. -->';

  return days.flatMap(day => day.events.map((ev, i) => {
    const detail = [ev.service ? esc(ev.service, 'event service') : '', ev.note ? esc(ev.note, 'event note') : '']
      .filter(Boolean).join(' &middot; ');
    // This page's rows are one per service, not one per day, so a Sunday with
    // Orthros and Liturgy would otherwise print its date twice in a column.
    // The date is written once and the second row's cell left empty, which
    // keeps the three columns lined up.
    const when = i === 0 ? `${weekday(day.at)} ${dayMonth(day.at)}` : '';
    return [
      '          <div class="ntgoc-parish-life-agenda__row">',
      `            <div class="ntgoc-parish-life-agenda__when">${when}</div>`,
      '            <div>',
      `              <div class="ntgoc-parish-life-agenda__name">${esc(ev.name, 'event name')}${todo(ev)}</div>`,
      detail ? `              <div class="ntgoc-parish-life-agenda__note">${detail}</div>` : '',
      '            </div>',
      `            <div class="ntgoc-parish-life-agenda__time">${ev.time ? esc(ev.time, 'event time') : ''}</div>`,
      '          </div>',
    ].filter(Boolean).join('\n');
  })).join('\n');
}

/* ------------------------------------------------------------------ *
 * Announcements
 * ------------------------------------------------------------------ */
const live = [...(announcements.announcements || [])]
  .filter(a => {
    if (!a.expires) return true;
    return parseDate(a.expires) >= TODAY;      // the expiry date is the last day it shows
  })
  .sort((a, b) => parseDate(b.posted) - parseDate(a.posted));

/**
 * `level` is the heading level for the title. The urgent panel sits directly
 * under the page's h1 and so has to be an h2; the ordinary announcements sit
 * under the section's own h2 and so are h3. Getting this wrong is a skipped
 * heading level, which lint fails on.
 */
function announcementBody(a, indent, level) {
  const pad = ' '.repeat(indent);
  const meta = [`Posted ${dayMonth(parseDate(a.posted))}`];
  if (a.expires) meta.push(`comes down after ${dayMonth(parseDate(a.expires))}`);
  const link = a.link && a.link.href
    ? `${pad}  <p class="ntgoc-our-parish-note"><a href="${esc(a.link.href, 'announcement link')}" class="ntgoc-faith-card__more">${esc(a.link.label || 'Read more', 'announcement link label')} →</a></p>\n`
    : '';
  const sample = a.sample
    ? `${pad}  <span class="ntgoc-our-parish-news__sample">Sample</span>\n`
    : '';
  return sample +
    `${pad}  <h${level} class="ntgoc-our-parish-news__title">${esc(a.title, `announcement "${a.id}" title`)}</h${level}>\n` +
    `${pad}  <p class="ntgoc-our-parish-news__body">${esc(a.body, `announcement "${a.id}" body`)}</p>\n` +
    link +
    `${pad}  <p class="ntgoc-our-parish-news__meta">${meta.join(' &middot; ')}</p>\n`;
}

/** The urgent panel, which sits above everything else on the page. */
function renderUrgent() {
  const urgent = live.filter(a => a.urgent);
  if (!urgent.length) {
    return '  <!-- No urgent notice. Set "urgent": true on an entry in\n' +
           '       data/parish-announcements.json and rebuild to put one here. -->';
  }
  return [
    '  <section class="ntgoc-our-parish-urgent" role="region" aria-label="Urgent parish notice" data-ntgoc-urgent>',
    '    <div class="ntgoc-our-parish-urgent__inner ntgoc-gutter ntgoc-shell">',
    urgent.map(a =>
      `      <article class="ntgoc-our-parish-news__item ntgoc-our-parish-news__item--urgent"${a.expires ? ` data-ntgoc-expires="${a.expires}"` : ''}>\n` +
      `        <div class="ntgoc-our-parish-urgent__flag">Parish notice</div>\n` +
      announcementBody(a, 6, 2) +
      '      </article>').join('\n'),
    '    </div>',
    '  </section>',
  ].join('\n');
}

/** The ordinary announcements list. */
function renderAnnouncements() {
  const ordinary = live.filter(a => !a.urgent);
  if (!ordinary.length) {
    return '        <p class="ntgoc-body-lg">Nothing is posted at the moment. ' +
      'Announcements appear here as the parish office adds them &mdash; and come down again on their own ' +
      'once they are out of date.</p>';
  }
  return ordinary.map(a =>
    `        <article class="ntgoc-our-parish-news__item"${a.expires ? ` data-ntgoc-expires="${a.expires}"` : ''}>\n` +
    announcementBody(a, 8, 3) +
    '        </article>').join('\n');
}

/* ------------------------------------------------------------------ *
 * Splice the rendered blocks into the pages
 * ------------------------------------------------------------------ */
const REGIONS = [
  ['calendar.html', 'calendarMonth', renderMonthGrid],
  ['parish-life.html', 'nextFewWeeks', renderAgenda],
  ['for-our-parish.html', 'urgentNotice', renderUrgent],
  ['for-our-parish.html', 'thisWeek', renderThisWeek],
  ['for-our-parish.html', 'announcements', renderAnnouncements],
];

const changed = [];
const pages = new Map();

for (const [page, name, render] of REGIONS) {
  if (!pages.has(page)) {
    if (!existsSync(join(ROOT, page))) {
      console.error(`  ✗ ${page} does not exist.`);
      process.exit(1);
    }
    pages.set(page, read(page));
  }
  const src = pages.get(page);
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

  const body = '\n' + render() + '\n';
  const before = src.slice(a + open.length, b);
  if (before !== body) changed.push(`${page}: ${name}`);
  pages.set(page, src.slice(0, a + open.length) + body + src.slice(b));
}

console.log(`\n  parish build — ${events.length} calendar event(s), ` +
  `${live.length} live announcement(s), as of ${dayMonth(TODAY)} ${TODAY.getFullYear()}`);

const dropped = (announcements.announcements || []).length - live.length;
if (dropped > 0) console.log(`  ${dropped} announcement(s) past their expiry date, left out`);

if (!changed.length) {
  console.log('  ✓ every generated block is already current\n');
  process.exit(0);
}

console.log(`\n  ${CHECK ? 'stale' : 'rewritten'}:`);
for (const c of changed) console.log(`    ${c}`);

if (CHECK) {
  console.log('\n  Run "npm run parish" to rebuild.\n');
  process.exit(1);
}

for (const [page, src] of pages) writeFileSync(join(ROOT, page), src);

console.log('\n  re-extracting chunks and linting…\n');
execFileSync(process.execPath, [join(ROOT, 'tools', 'extract-chunks.mjs')], { cwd: ROOT, stdio: 'pipe' });
try {
  execFileSync(process.execPath, [join(ROOT, 'tools', 'lint.mjs')], { cwd: ROOT, stdio: 'inherit' });
} catch {
  console.error('  ✗ lint failed after the build — review `git diff`.\n');
  process.exit(1);
}
