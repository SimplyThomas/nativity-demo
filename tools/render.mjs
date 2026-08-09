#!/usr/bin/env node
/**
 * render.mjs — one-shot static renderer for the Claude Design source.
 *
 *   node tools/render.mjs
 *
 * Reads  design-src/Nativity Website.dc.html  (never modified)
 * Writes 12 static .html pages + assets/css/components.css + assets/css/provisional.css
 *
 * What it does, in order:
 *   1. Pulls the <x-dc> template and the DCLogic <script> out of the design file.
 *   2. Parses the design's own data (bookstore catalog, calendar events) — no eval.
 *   3. Resolves <sc-if> / <sc-for> / {{ bindings }} per page — the dc-runtime never ships.
 *   4. Turns onClick="{{ goX }}" into real <a href="x.html"> so pages have real URLs.
 *   5. Lifts every inline style="" into a .ntgoc-* class in components.css.
 *   6. Turns style-hover="" into real :hover / :focus-visible rules.
 *   7. Repoints the harvested images at assets/img/.
 *   8. Applies the verified fact corrections recorded in data/parish-facts.json.
 *   9. Wraps reusable blocks in <!-- CHUNK:ntgoc... --> delimiters for EVO extraction.
 *
 * Class naming is deliberately STABLE across runs: a one-off style hashes to the same
 * .ntgoc-s<hash> name every build, so re-importing from Claude Design yields a readable
 * diff instead of renaming the entire stylesheet.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'design-src', 'Nativity Website.dc.html');

/* ------------------------------------------------------------------ *
 * Page definitions
 * ------------------------------------------------------------------ */

const PAGES = [
  { key: 'home', file: 'index.html', title: 'Nativity of the Theotokos Greek Orthodox Church — Fredericksburg, VA',
    desc: 'Orthodox Christian parish in Fredericksburg, Virginia. Orthros and Divine Liturgy every Sunday at 9:00 a.m. Visitors welcome.' },
  { key: 'visit', file: 'visit.html', title: 'Your first Sunday, explained — Nativity of the Theotokos',
    desc: 'What to expect visiting an Orthodox church for the first time: when to arrive, what to wear, and what happens during the service.' },
  { key: 'faith', file: 'faith.html', title: 'Our Faith — Nativity of the Theotokos' },
  { key: 'calendar', file: 'calendar.html', title: 'Parish Calendar — Nativity of the Theotokos' },
  { key: 'ministries', file: 'ministries.html', title: 'Parish Ministries — Nativity of the Theotokos' },
  { key: 'about', file: 'about.html', title: 'About the Parish — Nativity of the Theotokos' },
  { key: 'give', file: 'give.html', title: 'Stewardship & Giving — Nativity of the Theotokos' },
  { key: 'contact', file: 'contact.html', title: 'Contact Us — Nativity of the Theotokos' },
  { key: 'festival', file: 'festival.html', title: 'Fredericksburg Greek Festival — Nativity of the Theotokos' },
  { key: 'hall', file: 'hall.html', title: 'Hall Rental — Nativity of the Theotokos' },
  { key: 'bookstore', file: 'bookstore.html', title: 'Parish Bookstore — Nativity of the Theotokos' },
  { key: 'mobile', file: 'mobile-views.html', title: 'Mobile views (design reference) — Nativity of the Theotokos' },
];

const PAGE_FILE = Object.fromEntries(PAGES.map(p => [p.key, p.file]));

/* The design's `go<Name>` handlers, mapped to route keys. */
const ROUTE_OF_HANDLER = {
  goHome: 'home', goVisit: 'visit', goFaith: 'faith', goCalendar: 'calendar',
  goMinistries: 'ministries', goAbout: 'about', goGive: 'give', goContact: 'contact',
  goFestival: 'festival', goHall: 'hall', goBookstore: 'bookstore', goMobile: 'mobile',
};

/* ------------------------------------------------------------------ *
 * Harvested images: remote filename -> local file + accessible name
 * ------------------------------------------------------------------ */

const IMAGES = {
  'carousel-anastasis-icon%20use.jpg': { file: 'hero-anastasis-icon.jpg',
    alt: 'Icon of the Anastasis — Christ raising Adam and Eve from the tombs' },
  'transfiguration.jpg': { file: 'feast-transfiguration.jpg',
    alt: 'Icon of the Transfiguration of Christ on Mount Tabor' },
  'Banquet%202.png': { file: 'festival-banquet.png',
    alt: 'Parishioners gathered at a banquet in the parish hall' },
  'resurrection.jpg': { file: 'faith-resurrection.jpg',
    alt: 'Icon of the Resurrection' },
  'ascension-christ.jpg': { file: 'faith-ascension.jpg',
    alt: 'Icon of the Ascension of Christ' },
  'Holy-sites.jpg': { file: 'faith-holy-sites.jpg',
    alt: 'A holy site of the early Church' },
  'Elders.jpg': { file: 'faith-elders.jpg',
    alt: 'Portrait of modern Orthodox elders' },
  'Father%27s%20pic.jpg': { file: 'clergy-fr-john.jpg',
    alt: 'Photograph of the Reverend Protopresbyter John C. Katsoulis, presiding priest' },
  'Screenshot%202024-04-27%20at%206.13.23%E2%80%AFPM.png': { file: 'give-building-projects.png',
    alt: 'Rendering of the parish building projects' },
};

/* ------------------------------------------------------------------ *
 * Fact corrections — each traceable to data/parish-facts.json
 * ------------------------------------------------------------------ */

const TODO = '<!-- TODO: verify -->';

/* Applied first: a targeted year swap so unrelated numbers are untouched. */
const YEAR_FIX = { find: />\s*1963\s*</g, repl: '>1989<' };

const CORRECTIONS = [
  // Office hours: the live site says 9:00–3:00; the design said 2:00.
  { find: /Tuesday\s*[–-]\s*Friday,\s*9:00 a\.m\. – 2:00 p\.m\./g,
    repl: 'Tuesday – Friday, 9:00 a.m. – 3:00 p.m.' },
  { find: /Tuesday–Friday, 9:00 a\.m\. – 2:00 p\.m\./g,
    repl: 'Tuesday–Friday, 9:00 a.m. – 3:00 p.m.' },

  // Directions: the design had the wrong interstate exit.
  { find: /About ten minutes west of I-95, exit 130\./g,
    repl: 'From I-95 take exit 130B and go west on Route 3 for just over four miles. ' +
          'After the Harrison Crossing Shopping Center, turn right at the next light onto ' +
          'Spotswood Furnace Road. Riverbend High School is on the right; the church is on ' +
          'the left, just past the school.' },

  // Founding: the design said 1963; the first Liturgy was in 1989.
  { find: /Community founded/g, repl: 'First Divine Liturgy' },
  { find: /Founding year shown as a placeholder — please confirm\./g,
    repl: 'Verified against the parish history page: the first Divine Liturgy was celebrated ' +
          '9 April 1989 at St. George’s Episcopal Church. The parish received its charter in ' +
          '1991 and the church building was completed in March 2000.' },

  // Address spelling normalisation.
  { find: /Spotswood Furnance/g, repl: 'Spotswood Furnace' },

  // Never republish the priest's personal mobile number.
  { find: /\(540\) 645-1427/g, repl: '(540) 548-2665' },

  // A ministry the design invented — flag rather than delete.
  { find: /Choir &amp; Chanters/g, repl: 'Choir &amp; Chanters' + TODO },

  // Parish Council: real names and personal addresses withheld from the draft.
  { find: /Chris Rigopoulos|Dennis Makrinos|Eleni Yiasemides|Jason Yianilos|Nick Roman|Anthony Hatzis|Gamal Salem/g,
    repl: 'Council Member' + TODO },
  { find: /[a-z]+\.[a-z]+@ntgoc\.org/g, repl: 'office@ntgoc.org' },
];

/* Design claims with no source on the live site. Flagged once each. */
const FLAG_ONCE = [
  '≈ 200 seated',
  'Full commercial',
  'Shifts are two hours. Sign-ups open in late summer.',
  'Three days. Everyone invited.',
];

/* ------------------------------------------------------------------ *
 * Curated class names for the most repeated style strings.
 * Everything else gets a stable .ntgoc-s<hash> name.
 * ------------------------------------------------------------------ */

const CURATED = new Map(Object.entries({
  'font-size:15px; line-height:1.7; color:#5b5449; margin:0;': 'ntgoc-body',
  'font-size:15.5px; line-height:1.7; color:#5b5449; margin:0;': 'ntgoc-body-lg',
  'cursor:pointer; opacity:.85;': 'ntgoc-topbar-link',
  'font-family:Newsreader, serif; font-weight:500; font-size:23px; margin:0 0 12px; color:#3a1414;': 'ntgoc-h3',
  'font-family:Newsreader, serif; font-weight:500; font-size:21px; margin:0 0 10px; color:#3a1414;': 'ntgoc-h3-sm',
  'font-family:Newsreader, serif; font-weight:500; font-size:24px; margin:0 0 12px; color:#3a1414;': 'ntgoc-h3-lg',
  'font-family:Newsreader, serif; font-size:20px; color:#3a1414;': 'ntgoc-h4',
  'color:#3a1414;': 'ntgoc-ink',
  'background:#f6f1e8; padding:36px 30px;': 'ntgoc-card',
  'background:#f6f1e8; padding:40px 32px;': 'ntgoc-card-lg',
}));

/* ------------------------------------------------------------------ *
 * Small HTML utilities (no dependencies)
 * ------------------------------------------------------------------ */

const hash = s => createHash('sha1').update(s).digest('hex').slice(0, 6);

const isBoundary = ch => ch === '>' || ch === ' ' || ch === '\n' || ch === '\t' || ch === '\r';

/** Index of the next genuine `<tag` occurrence at or after `from`. */
function findOpen(src, tag, from) {
  const token = `<${tag}`;
  let i = src.indexOf(token, from);
  while (i !== -1 && !isBoundary(src[i + token.length])) i = src.indexOf(token, i + 1);
  return i;
}

/**
 * Locate the matching close tag for a balanced element, honouring nesting.
 * Returns null rather than throwing when the markup is unbalanced — the design
 * source contains one stray </div> (see design-src/README.md), so callers
 * degrade gracefully instead of failing the whole build.
 */
function matchTag(src, tag, openStart) {
  const openTok = `<${tag}`;
  const closeTok = `</${tag}>`;
  const openEnd = src.indexOf('>', openStart) + 1;
  let depth = 1, i = openEnd;
  while (depth > 0) {
    const o = findOpen(src, tag, i);
    const c = src.indexOf(closeTok, i);
    if (c === -1) return null;
    if (o !== -1 && o < c) { depth++; i = o + openTok.length; }
    else { depth--; i = c + closeTok.length; if (depth === 0) return { openEnd, innerEnd: c, end: i }; }
  }
  return null;
}

/** Replace every top-level balanced <tag>...</tag> via a callback. */
function transformTag(src, tag, fn) {
  let out = '', cursor = 0;
  for (;;) {
    const idx = findOpen(src, tag, cursor);
    if (idx === -1) break;
    const m = matchTag(src, tag, idx);
    if (!m) break;
    out += src.slice(cursor, idx) + fn(src.slice(idx, m.openEnd), src.slice(m.openEnd, m.innerEnd));
    cursor = m.end;
  }
  return out + src.slice(cursor);
}

function attr(tagText, name) {
  const m = tagText.match(new RegExp(`\\s${name}="([^"]*)"`, 'i'));
  return m ? m[1] : null;
}

/* ------------------------------------------------------------------ *
 * 1. Parse the design file
 * ------------------------------------------------------------------ */

const raw = readFileSync(SRC, 'utf8');

/* The <helmet> block carries the design's global reset and font links. Both are
   reproduced deliberately in provisional.css / the page shell, so it is dropped
   here rather than rendered — otherwise the reset would leak into every chunk. */
const template = raw
  .slice(raw.indexOf('<x-dc>') + 6, raw.lastIndexOf('</x-dc>'))
  .replace(/<helmet>[\s\S]*?<\/helmet>/, '');
const logic = raw.slice(raw.indexOf('data-dc-script>') + 15, raw.lastIndexOf('</script>'));

/** Slice a balanced bracketed region starting at the first `open` after `from`. */
function sliceBalanced(source, from, open, close) {
  const start = source.indexOf(open, from);
  let depth = 0, inStr = null;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (inStr) { if (ch === '\\') i++; else if (ch === inStr) inStr = null; continue; }
    if (ch === "'" || ch === '"') { inStr = ch; continue; }
    if (ch === open) depth++;
    else if (ch === close && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`unbalanced ${open} in design logic`);
}

const unescapeJs = s => s
  .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
  .replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');

/**
 * Parse a flat JS object literal into a real object. Deliberately NOT an
 * evaluator: this only understands `key: 'string' | number | boolean`, which
 * is all the design's data uses.
 */
function parseObjectLiteral(text) {
  const out = {};
  const re = /(?:'([^']*)'|"([^"]*)"|([\w$]+))\s*:\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|(-?\d+(?:\.\d+)?)|(true|false))/g;
  for (const m of text.matchAll(re)) {
    const key = m[1] ?? m[2] ?? m[3];
    if (m[4] !== undefined) out[key] = unescapeJs(m[4]);
    else if (m[5] !== undefined) out[key] = unescapeJs(m[5]);
    else if (m[6] !== undefined) out[key] = Number(m[6]);
    else out[key] = m[7] === 'true';
  }
  return out;
}

/** Split an array literal of objects into its top-level `{...}` members. */
function parseObjectArray(text) {
  const items = [];
  let cursor = 0;
  for (;;) {
    const open = text.indexOf('{', cursor);
    if (open === -1) break;
    const body = sliceBalanced(text, open, '{', '}');
    items.push(parseObjectLiteral(body));
    cursor = open + body.length;
  }
  return items;
}

const CATALOG = parseObjectArray(sliceBalanced(logic, logic.indexOf('catalog()'), '[', ']'));
const EVENTS = parseObjectLiteral(sliceBalanced(logic, logic.indexOf('const events ='), '{', '}'));

if (!CATALOG.length) throw new Error('bookstore catalog failed to parse');
if (!Object.keys(EVENTS).length) throw new Error('calendar events failed to parse');

function buildDays() {
  const out = [];
  for (let i = 0; i < 6; i++) out.push({ n: '', has: false, label: '' });
  for (let n = 1; n <= 31; n++) out.push({ n: String(n), has: !!EVENTS[n], label: EVENTS[n] || '' });
  while (out.length % 7 !== 0) out.push({ n: '', has: false, label: '' });
  return out;
}

const CAT_ACTIVE = 'cursor:pointer; white-space:nowrap; padding:11px 20px; border:1px solid #7d2b2b; background:#7d2b2b; color:#f6f1e8; font-size:12px; letter-spacing:.12em; text-transform:uppercase;';
const CAT_IDLE = 'cursor:pointer; white-space:nowrap; padding:11px 20px; border:1px solid #ccbda4; background:transparent; color:#5b5449; font-size:12px; letter-spacing:.12em; text-transform:uppercase;';

/* ------------------------------------------------------------------ *
 * 2. Style registry
 * ------------------------------------------------------------------ */

const styleRegistry = new Map();

function classFor(style, hover) {
  const norm = style.trim().replace(/\s+/g, ' ');
  const key = `${norm}||${hover || ''}`;
  const seen = styleRegistry.get(key);
  if (seen) return seen.cls;
  let cls = CURATED.get(norm);
  if (cls && hover) cls = `${cls}-h${hash(hover)}`;
  if (!cls) cls = `ntgoc-s${hash(key)}`;
  styleRegistry.set(key, { cls, style: norm, hover: hover || null });
  return cls;
}

/** Generic hooks so one responsive layer can target many elements. */
function helperClasses(style) {
  const h = [];
  if (/display:\s*grid/.test(style)) h.push('ntgoc-grid');
  if (/display:\s*flex/.test(style)) h.push('ntgoc-flex');
  if (/padding:[^;]*\s40px/.test(style)) h.push('ntgoc-gutter');
  if (/max-width:\s*1[0-4]\d{2}px/.test(style)) h.push('ntgoc-shell');
  const ht = style.match(/(?:^|[^-\w])height:\s*(\d{3,})px/);
  if (ht && +ht[1] >= 320) h.push('ntgoc-tall');
  if (/position:\s*sticky/.test(style)) h.push('ntgoc-sticky');
  if (/font-size:\s*(?:6[0-9]|[7-9]\d|1\d\d)px/.test(style)) h.push('ntgoc-display-type');
  return h;
}

/* ------------------------------------------------------------------ *
 * 3. Resolve sc-if / sc-for / bindings for one page
 * ------------------------------------------------------------------ */

const lookup = (path, scope) =>
  path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), scope);

const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');

/** Add an attribute to the first element in a fragment. */
const injectAttr = (html, extra) =>
  html.replace(/<([a-zA-Z][\w-]*)((?:\s[^>]*)?)>/, (m, tag, attrs) => `<${tag}${attrs}${extra}>`);

/**
 * The design draws the bookstore category filters as clickable <div>s. Promote
 * them to real <button>s so they are keyboard-operable, which the design's
 * version was not.
 */
function asFilterButton(html, name) {
  const t = nextTag(html, 0);
  if (!t) return html;
  const m = matchTag(html, t.tag, t.at);
  if (!m) return html;
  const rest = html.slice(t.at, m.openEnd).slice(t.tag.length + 1, -1);
  const inner = html.slice(m.openEnd, m.innerEnd);
  return html.slice(0, t.at) +
    `<button type="button" class="ntgoc-filter-btn" data-ntgoc-filter="${esc(name)}"${rest}>${inner}</button>` +
    html.slice(m.end);
}

function resolveAll(src, scope) {
  let out = transformTag(src, 'sc-for', (open, inner) => {
    const listName = (attr(open, 'list') || '').replace(/[{}\s]/g, '');
    const as = attr(open, 'as');
    const list = lookup(listName, scope) || [];
    return list.map(item => {
      const rendered = resolveAll(inner, { ...scope, [as]: item });
      // Hooks for the bookstore filter. Everything stays readable without JS;
      // these attributes only give the enhancement script something to target.
      if (listName === 'items') return injectAttr(rendered, ` data-ntgoc-cat="${esc(item.cat)}"`);
      if (listName === 'cats') return asFilterButton(rendered, item.name);
      return rendered;
    }).join('');
  });

  out = transformTag(out, 'sc-if', (open, inner) => {
    const expr = (attr(open, 'value') || '').replace(/[{}\s]/g, '');
    if (expr === 'true') return resolveAll(inner, scope);
    if (expr === 'false') return '';
    return lookup(expr, scope) ? resolveAll(inner, scope) : '';
  });

  return out.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, path) => {
    if (ROUTE_OF_HANDLER[path]) return m;           // navigation — handled by linkify
    const v = lookup(path, scope);
    if (v === undefined || v === null || typeof v === 'function') return '';
    return String(v);
  });
}

function scopeFor(pageKey) {
  const scope = {
    days: buildDays(),
    cats: ['All', 'Books', 'Children', 'Icons', 'Prayer & Home'].map(c => ({
      name: c,
      style: c === 'All' ? CAT_ACTIVE : CAT_IDLE,
    })),
    items: CATALOG.map(it => ({
      ...it,
      priceLabel: '$' + it.price,
      stockLabel: it.stock <= 3 ? 'Only ' + it.stock + ' left' : 'In stock',
    })),
    hasCart: false,
    cartLabel: '0 items reserved',
  };
  for (const route of Object.values(ROUTE_OF_HANDLER)) {
    scope['is' + route[0].toUpperCase() + route.slice(1)] = route === pageKey;
  }
  return scope;
}

/* ------------------------------------------------------------------ *
 * 4. Element rewrites
 * ------------------------------------------------------------------ */

/**
 * Convert every clickable <div>/<span> into a real <a href>, renaming its
 * closing tag correctly. Recursive, so nested clickables are caught too.
 */
function linkify(html, currentPage) {
  const TAGS = ['div', 'span'];

  function walk(s) {
    let out = '', cursor = 0;
    for (;;) {
      let at = -1, tag = null;
      for (const t of TAGS) {
        const i = findOpen(s, t, cursor);
        if (i !== -1 && (at === -1 || i < at)) { at = i; tag = t; }
      }
      if (at === -1) return out + s.slice(cursor);

      const { openEnd, innerEnd, end } = matchTag(s, tag, at);
      const openTag = s.slice(at, openEnd);
      const inner = walk(s.slice(openEnd, innerEnd));
      const handler = (attr(openTag, 'onClick') || '').replace(/[{}\s]/g, '');
      const route = ROUTE_OF_HANDLER[handler];

      out += s.slice(cursor, at);
      if (route) {
        const rest = openTag
          .slice(tag.length + 1, -1)
          .replace(/\sonClick="[^"]*"/i, '')
          .replace(/cursor:pointer;\s*/g, '');
        const current = route === currentPage ? ' aria-current="page"' : '';
        out += `<a href="${PAGE_FILE[route]}"${current}${rest}>${inner}</a>`;
      } else {
        out += openTag + inner + `</${tag}>`;
      }
      cursor = end;
    }
  }
  return walk(html);
}

/** Replace style= / style-hover= with generated .ntgoc-* classes. */
function classify(src) {
  return src.replace(/<([a-zA-Z][\w-]*)((?:\s[^>]*)?)>/g, (m, tag, attrs) => {
    const style = attr(m, 'style');
    const hover = attr(m, 'style-hover');
    if (style === null && hover === null) return m;
    const cls = classFor(style || '', hover);
    const helpers = helperClasses(style || '');
    let rest = attrs
      .replace(/\sstyle="[^"]*"/i, '')
      .replace(/\sstyle-hover="[^"]*"/i, '');
    const all = [cls, ...helpers].join(' ');
    if (/\sclass="/.test(rest)) rest = rest.replace(/\sclass="([^"]*)"/, ` class="$1 ${all}"`);
    else rest += ` class="${all}"`;
    return `<${tag}${rest}>`;
  });
}

/** Repoint harvested images and name the meaningful ones for screen readers. */
function localiseImages(src) {
  let out = src;
  for (const [remote, info] of Object.entries(IMAGES)) {
    const esc = remote.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(`https://[^'")]*${esc}`, 'g'), `assets/img/${info.file}`);
  }
  return out.replace(
    /<div([^>]*background-image:url\('assets\/img\/([^']+)'\)[^>]*)>/g,
    (m, body, file) => {
      const info = Object.values(IMAGES).find(i => i.file === file);
      if (!info || /role="img"/.test(m)) return m;
      return `<div${body} role="img" aria-label="${info.alt}">`;
    });
}

function applyCorrections(src) {
  let out = src.replace(YEAR_FIX.find, YEAR_FIX.repl);
  for (const { find, repl } of CORRECTIONS) out = out.replace(find, repl);
  for (const phrase of FLAG_ONCE) out = out.replace(phrase, phrase + TODO);
  return out;
}

/* ------------------------------------------------------------------ *
 * 5. Chunk delimiters
 * ------------------------------------------------------------------ */

/* Names verified against what each block actually contains — see IMPORT.md,
   which documents chunk-by-chunk what goes where. */
const CHUNK_NAMES = {
  home: ['ntgocHomeHero', 'ntgocHomeServiceTimes', 'ntgocHomeWelcome', 'ntgocHomeFirstSunday',
         'ntgocHomeUpcomingServices', 'ntgocHomeFestivalPromo', 'ntgocHomeMinistriesPromo'],
  visit: ['ntgocVisitorHero', 'ntgocVisitorFirstSunday'],
  faith: ['ntgocFaithHero', 'ntgocFaithIntro', 'ntgocFaithTopics', 'ntgocFaithWatchRead'],
  calendar: ['ntgocCalendarHero', 'ntgocCalendarGrid'],
  ministries: ['ntgocMinistriesHero', 'ntgocMinistriesGrid'],
  about: ['ntgocAboutHero', 'ntgocAboutClergy', 'ntgocAboutParishCouncil', 'ntgocAboutNewsletter'],
  give: ['ntgocGiveWays', 'ntgocGiveProjects'],
  contact: ['ntgocContactCard'],
  festival: ['ntgocFestivalHero', 'ntgocFestivalDetails'],
  hall: ['ntgocHallRental'],
  bookstore: ['ntgocBookstoreHero', 'ntgocBookstoreCatalog', 'ntgocBookstoreNotes'],
  mobile: ['ntgocMobileViews'],
};

/** Next element start at/after `from`, skipping comments and text. */
function nextTag(src, from) {
  const m = src.slice(from).match(/<([a-zA-Z][\w-]*)(?=[\s>])/);
  return m ? { tag: m[1], at: from + m.index } : null;
}

/**
 * Wrap every top-level block inside <main> in chunk delimiters — not just
 * <section>, since several views put whole blocks in bare <div>s.
 */
function markChunks(mainHtml, pageKey) {
  const names = CHUNK_NAMES[pageKey] || [];
  const cap = pageKey[0].toUpperCase() + pageKey.slice(1);

  const mainAt = findOpen(mainHtml, 'main', 0);
  if (mainAt === -1) return mainHtml;
  const main = matchTag(mainHtml, 'main', mainAt);
  if (!main) return mainHtml;

  const body = mainHtml.slice(main.openEnd, main.innerEnd);
  let out = '', cursor = 0, n = 0;
  for (;;) {
    const t = nextTag(body, cursor);
    if (!t) break;
    const el = matchTag(body, t.tag, t.at);
    if (!el) break;
    const name = names[n] || `ntgoc${cap}Block${n + 1}`;
    n++;
    out += body.slice(cursor, t.at) +
      `\n<!-- CHUNK:${name} -->\n${body.slice(t.at, el.end)}\n<!-- /CHUNK:${name} -->\n`;
    cursor = el.end;
  }
  return mainHtml.slice(0, main.openEnd) + out + body.slice(cursor) + mainHtml.slice(main.innerEnd);
}

/* ------------------------------------------------------------------ *
 * 6. Page shell
 * ------------------------------------------------------------------ */

const DRAFT_BANNER = `
<!-- CHUNK:ntgocDraftBanner -->
<div class="ntgoc-draft-banner" role="region" aria-label="Draft preview notice">
  <p class="ntgoc-draft-banner__text">
    <strong>Draft preview — this is not the parish website.</strong>
    An unofficial mock-up by parish volunteers, for the Parish Council. Nothing here is
    authoritative; please do not rely on it for service times. The real parish site is
    <a class="ntgoc-draft-banner__link" href="https://www.nativity.va.goarch.org/">nativity.va.goarch.org</a>.
  </p>
</div>
<!-- /CHUNK:ntgocDraftBanner -->`;

const shell = (page, body) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive, nosnippet">
<title>${page.title}</title>
${page.desc ? `<meta name="description" content="${page.desc}">\n` : ''}<!-- Deliberately no Open Graph or Twitter card tags: a shared link must not render
     a preview that could be mistaken for the real parish website. -->
<!-- DEMO ONLY: Google Fonts. See IMPORT.md — confirm with the Department of Internet
     Ministries whether external font loading is permitted before relying on this. -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,300;1,6..72,400&family=Karla:wght@300;400;500;600;700&display=swap">
<link rel="stylesheet" href="assets/css/provisional.css"><!-- DEMO ONLY — do not import -->
<link rel="stylesheet" href="assets/css/components.css"><!-- Ships to EVO -->
</head>
<body class="ntgoc-page">
<a class="ntgoc-skip-link" href="#ntgoc-main">Skip to main content</a>
${DRAFT_BANNER}
${body}
<script src="assets/js/ntgoc-enhance.js" defer></script>
</body>
</html>
`;

/* ------------------------------------------------------------------ *
 * 7. Build
 * ------------------------------------------------------------------ */

/* The design wraps everything in one presentational <div>, but line 360 of the
   source carries a stray </div> that closes that wrapper 26 KB early — so from
   the Visit view onward the remaining views and the footer sit outside it. That
   is a defect in the design file, not something to reproduce. Rather than trust
   the wrapper, slice on landmarks we can trust: the header runs up to the first
   <sc-if>, the views are the <sc-if> blocks themselves, and the footer is its
   own element. Anything between blocks (including that stray tag) is discarded. */
const wrapOpenEnd = template.indexOf('>', template.indexOf('<div')) + 1;
const firstIf = template.indexOf('<sc-if');
const lastIfEnd = template.lastIndexOf('</sc-if>') + '</sc-if>'.length;
const footerAt = template.indexOf('<footer');

const headerSrc = template.slice(wrapOpenEnd, firstIf);
const viewsSrc = template.slice(firstIf, lastIfEnd);
const footerSrc = template.slice(footerAt, template.indexOf('</footer>') + '</footer>'.length);

/**
 * Select the one <sc-if> view that matches this page and resolve it. Text
 * between top-level blocks is intentionally dropped, so the design's stray
 * </div> never reaches a rendered page.
 */
function viewFor(scope) {
  let out = '', cursor = 0;
  for (;;) {
    const i = findOpen(viewsSrc, 'sc-if', cursor);
    if (i === -1) return out;
    const m = matchTag(viewsSrc, 'sc-if', i);
    if (!m) return out;
    const expr = (attr(viewsSrc.slice(i, m.openEnd), 'value') || '').replace(/[{}\s]/g, '');
    if (lookup(expr, scope)) out += resolveAll(viewsSrc.slice(m.openEnd, m.innerEnd), scope);
    cursor = m.end;
  }
}

mkdirSync(join(ROOT, 'assets/css'), { recursive: true });

const chunksSeen = new Set();

for (const page of PAGES) {
  const scope = scopeFor(page.key);

  // The outer page-wrapper <div> is already stripped; this is topbar + header.
  let head = resolveAll(headerSrc, scope);
  head = head.replace(/<header/, '<!-- /CHUNK:ntgocTopBar -->\n<!-- CHUNK:ntgocSiteHeader -->\n<header');
  head = `<!-- CHUNK:ntgocTopBar -->\n${head}\n<!-- /CHUNK:ntgocSiteHeader -->\n`;

  const main = markChunks(viewFor(scope), page.key)
    .replace(/<main(\s|>)/, '<main id="ntgoc-main"$1');
  const foot = `\n<!-- CHUNK:ntgocSiteFooter -->\n${resolveAll(footerSrc, scope)}\n<!-- /CHUNK:ntgocSiteFooter -->\n`;

  let body = head + main + foot;
  body = applyCorrections(body);
  body = localiseImages(body);
  body = linkify(body, page.key);
  body = classify(body);
  body = body
    .replace(/\shint-placeholder-(?:val|count)="[^"]*"/g, '')
    .replace(/\sonClick="[^"]*"/gi, '')
    .replace(/\sstyle-hover="[^"]*"/gi, '');

  writeFileSync(join(ROOT, page.file), shell(page, body));
  for (const m of body.matchAll(/<!-- CHUNK:(\w+) -->/g)) chunksSeen.add(m[1]);
}

/* ------------------------------------------------------------------ *
 * 8. Stylesheets
 * ------------------------------------------------------------------ */

const rules = [];
for (const { cls, style, hover } of styleRegistry.values()) {
  if (style) rules.push(`.${cls} { ${style} }`);
  if (hover) rules.push(`.${cls}:hover, .${cls}:focus-visible { ${hover.trim()} }`);
}

writeFileSync(join(ROOT, 'assets/css/components.css'), `/* ============================================================
   components.css — SHIPS TO EVO
   Generated by tools/render.mjs from the Claude Design source.
   Do not hand-edit: change the design, re-import, re-run the renderer.

   Every declaration below is copied verbatim from the design file.
   Safe to paste into Evolution CMS as a single stylesheet:
     - No CSS reset, no bare element selectors.
     - Every selector is a single .ntgoc-* class, so nothing can collide
       with the Bootstrap 4.1.3 template already on the live site.
     - Class names are content-hashed and stable across rebuilds, so
       re-importing from Claude Design gives a readable diff.
   ============================================================ */

/* --- design tokens ------------------------------------------------ */
:root {
  --ntgoc-parchment: #f6f1e8;
  --ntgoc-oxblood: #3a1414;
  --ntgoc-brick: #7d2b2b;
  --ntgoc-brick-dark: #5e1f1f;
  --ntgoc-gold: #b08442;
  --ntgoc-gold-light: #e6b96a;
  --ntgoc-ink: #22201d;
  --ntgoc-muted: #5b5449;
  --ntgoc-rule: #ded2be;
  --ntgoc-rule-strong: #ccbda4;
}

/* --- skip link ----------------------------------------------------- */
.ntgoc-skip-link {
  position: absolute;
  left: -9999px;
  top: 0;
  z-index: 200;
  background: #3a1414;
  color: #f6f1e8;
  padding: 12px 20px;
}
.ntgoc-skip-link:focus { left: 0; }

/* --- draft-preview banner ------------------------------------------
   Demo scaffolding, but styled here so it travels with its chunk.
   Remove this block if the draft ever becomes the real site.
   ------------------------------------------------------------------ */
.ntgoc-draft-banner {
  background: #7d2b2b;
  color: #fdf6e9;
  padding: 10px 20px;
  text-align: center;
  position: relative;
  z-index: 100;
}
.ntgoc-draft-banner__text {
  margin: 0 auto;
  max-width: 70rem;
  font-family: Karla, system-ui, sans-serif;
  font-size: 13px;
  line-height: 1.5;
}
.ntgoc-draft-banner__link { color: #ffd98a; text-decoration: underline; }

/* --- interactive bits ---------------------------------------------- */
.ntgoc-filter-btn {
  font: inherit;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
}
.ntgoc-visually-hidden {
  position: absolute;
  width: 1px; height: 1px;
  margin: -1px; padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

/* --- generated component rules (${rules.length} rules) --------------------- */
${rules.join('\n')}

/* --- responsive layer ----------------------------------------------
   The design is fixed-desktop and carries no media queries of its own,
   so this layer is the ONE place where layout was authored rather than
   transcribed from the design. It stays last to win on source order.
   ------------------------------------------------------------------ */
@media (max-width: 900px) {
  .ntgoc-grid { grid-template-columns: 1fr !important; }
  .ntgoc-gutter { padding-left: 20px !important; padding-right: 20px !important; }
  .ntgoc-tall { height: auto !important; min-height: 60vh; }
  .ntgoc-display-type { font-size: clamp(30px, 8vw, 54px) !important; line-height: 1.15 !important; }
  .ntgoc-shell { max-width: 100% !important; }
}
@media (max-width: 640px) {
  .ntgoc-flex { flex-wrap: wrap; }
  .ntgoc-sticky { position: static !important; }
  .ntgoc-gutter { padding-left: 16px !important; padding-right: 16px !important; }
  .ntgoc-tall { min-height: 50vh; }

  /* The header nav is a single fixed row in the design. Rather than build a
     drawer (which the design shows only as a static mock on the Mobile views
     page), let it wrap — every link stays reachable with no JavaScript. */
  .ntgoc-page nav.ntgoc-flex {
    flex-wrap: wrap;
    justify-content: center;
    gap: 14px 18px;
    padding-bottom: 14px;
  }
  .ntgoc-page header.ntgoc-sticky > .ntgoc-flex {
    flex-direction: column;
    height: auto !important;
    gap: 12px;
    padding-top: 14px;
  }
}

/* --- accessibility floor ------------------------------------------ */
.ntgoc-page a:focus-visible,
.ntgoc-page button:focus-visible,
.ntgoc-page [tabindex]:focus-visible {
  outline: 3px solid #b08442;
  outline-offset: 2px;
}
@media (prefers-reduced-motion: reduce) {
  .ntgoc-page *, .ntgoc-page *::before, .ntgoc-page *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
    scroll-behavior: auto !important;
  }
}
`);

writeFileSync(join(ROOT, 'assets/css/provisional.css'), `/* ============================================================
   provisional.css — DEMO ONLY. DELETE BEFORE IMPORTING TO EVO.

   Holds the global reset the Claude Design source carried in its
   <helmet> block. Pasting a reset into Evolution CMS would break the
   surrounding Bootstrap template, so it is isolated here and is never
   referenced by any extracted chunk.
   ============================================================ */

html, body { margin: 0; padding: 0; background: #f6f1e8; }
* { box-sizing: border-box; }
a { color: #7d2b2b; text-decoration: none; }
a:hover { color: #b08442; }
::selection { background: #e6d3b8; }

body.ntgoc-page {
  font-family: Karla, system-ui, sans-serif;
  color: #22201d;
  -webkit-font-smoothing: antialiased;
}
img { max-width: 100%; height: auto; }
`);

console.log(`rendered ${PAGES.length} pages`);
console.log(`  catalog -> ${CATALOG.length} items, calendar -> ${Object.keys(EVENTS).length} events`);
console.log(`  styles  -> ${styleRegistry.size} .ntgoc-* classes, ${rules.length} rules`);
console.log(`  chunks  -> ${chunksSeen.size} delimited blocks`);
