#!/usr/bin/env node
/**
 * build-catechumens.mjs — render the catechumen page and its documents.
 *
 *   npm run catechumens              # rebuild, then re-extract chunks and lint
 *   npm run catechumens -- --check   # report what is stale, write nothing
 *
 * Two data files, one page and its three documents:
 *
 *   data/catechumen-faq.json        -> the question cards on catechumens.html,
 *                                      and QUESTIONS-FOR-FR-JOHN.md
 *   data/catechumen-resources.json  -> the resource cards on catechumens.html,
 *                                      the body of each document page, and
 *                                      DOCUMENTS-FOR-FR-JOHN.md
 *
 * WHY THIS EXISTS
 *
 * The page exists so that a question Fr. John has already answered does not
 * have to be asked again, which means questions will keep being added to it for
 * years. If each one were a hand-written block of markup, the fifth person to
 * add one would copy the fourth person's card, the answer would end up on the
 * page twice in two wordings, and the two would drift — the same failure that
 * put the parish calendar into four pages at three different times.
 *
 * So the questions live in data/catechumen-faq.json and this renders them.
 * Adding a question is a JSON entry and one command; nobody has to touch the
 * markup, and nobody CAN accidentally give one question two answers.
 *
 * The documents exist for the same reason at a larger scale. A parish that
 * emails a checklist out one copy at a time ends up with as many versions as it
 * has sent emails, and no way to tell which one a person is holding — which is
 * how the baptism checklist now in use came to be both out of date and the only
 * copy anyone can find. Here a document has exactly one URL, its date is
 * stamped onto the document and onto the card that links to it from the same
 * entry in the register, and nothing on this site restates it.
 *
 * WHAT IT MAY TOUCH
 *
 * Only the text between a matching pair of <!-- BUILD:name --> markers, on
 * catechumens.html and on the document pages the register names, plus
 * QUESTIONS-FOR-FR-JOHN.md and DOCUMENTS-FOR-FR-JOHN.md, which are generated in
 * full. The pages' headings, prose and section order are hand-written source
 * and are never read, rewritten or reformatted. Like tools/build-parish.mjs and
 * unlike the retired renderer in tools/archive/, this owns blocks, not files.
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

const PAGE = 'catechumens.html';
const DATA = 'data/catechumen-faq.json';
const RESOURCES = 'data/catechumen-resources.json';
const REVIEW_LIST = 'QUESTIONS-FOR-FR-JOHN.md';
const DOC_LIST = 'DOCUMENTS-FOR-FR-JOHN.md';

/* ------------------------------------------------------------------ *
 * Escaping
 *
 * Same rule as the parish build: everything in the data file is plain text and
 * is escaped on the way in, and the EVO bracket sequences are rejected rather
 * than escaped — it is the CMS parser, not the browser, that eats them.
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

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

/** "2026-08-13" -> "13 August 2026". Anything unparseable is passed through. */
function longDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return String(iso || '');
  return `${+m[3]} ${MONTHS[+m[2] - 1]} ${m[1]}`;
}

/* ------------------------------------------------------------------ *
 * The data
 * ------------------------------------------------------------------ */
const faq = JSON.parse(read(DATA));
const sections = faq.sections || [];

const seen = new Set();
for (const section of sections) {
  if (!section.id || !section.build || !section.category) {
    throw new Error(`${DATA}: every section needs an id, a build marker name and a category`);
  }
  for (const q of section.questions || []) {
    if (!q.id || !q.q) throw new Error(`${DATA}: a question in "${section.category}" has no id or no text`);
    // The id becomes an element id on the page, and a duplicate is both a
    // broken deep link and a lint error two steps later.
    if (seen.has(q.id)) throw new Error(`${DATA}: question id "${q.id}" is used more than once`);
    seen.add(q.id);
    const answered = Array.isArray(q.a) && q.a.length;
    if (answered && q.pending) {
      throw new Error(`${DATA}: "${q.id}" is marked pending but carries an answer — it is one or the other`);
    }
    if (!answered && !q.pending) {
      throw new Error(`${DATA}: "${q.id}" has neither an answer nor "pending": true. ` +
        'A question with nothing under it must say why it is empty.');
    }
    // An answer nobody can trace back to the parish is the thing this whole
    // project exists to keep off the pages.
    if (answered && !q.source) {
      throw new Error(`${DATA}: "${q.id}" carries an answer with no "source". ` +
        'Record where the wording came from — see CLAUDE.md rule 2.');
    }
  }
}

/* ------------------------------------------------------------------ *
 * One question card
 *
 * <details>/<summary>, the same component the Welcome page's questions use, so
 * it needs no JavaScript, is keyboard-operable, is announced as expandable by
 * the browser itself, and survives the move into EVO. The search field on the
 * page is an enhancement layered on top of exactly this markup.
 * ------------------------------------------------------------------ */
const PAD = ' '.repeat(10);
const external = href => /^https?:/.test(href);

function moreLink(link, where) {
  const attrs = external(link.href) ? ' target="_blank" rel="noreferrer"' : '';
  return `<a href="${esc(link.href, where)}"${attrs} class="ntgoc-inherit ntgoc-faith-card__more">` +
    `${esc(link.label, where)} →</a>`;
}

function card(q, section) {
  const where = `question "${q.id}"`;
  const pending = !!q.pending;
  const out = [];

  /* The keywords are what someone types when they do not yet know the word the
     Church uses — "sponsor" for godparent, "diabetes" for the fasting question.
     The card's own text is searched too, at runtime; this attribute only has to
     carry what the text does not say.

     Deliberately NOT the section's category. Folding it in made every card in
     "Prayer, fasting & parish life" a hit for "fasting" — nineteen results
     where four were meant — and a search that returns a whole category is a
     search that has told you nothing. */
  const keywords = q.keywords || '';

  out.push(`${PAD}<details class="ntgoc-question" id="ntgoc-faq-${esc(q.id, where)}"` +
    ` data-ntgoc-faq="${esc(keywords, where)}">`);
  out.push(`${PAD}  <summary class="ntgoc-question__summary">`);
  out.push(`${PAD}    <h3 class="ntgoc-question__title">${esc(q.q, where)}</h3>`);
  if (pending) {
    out.push(`${PAD}    <p class="ntgoc-question__preview ntgoc-question__preview--pending">` +
      `${esc(faq.pending.cardPreview, 'pending.cardPreview')}</p>`);
  } else if (q.preview) {
    out.push(`${PAD}    <p class="ntgoc-question__preview">${esc(q.preview, where)}</p>`);
  }
  out.push(`${PAD}  </summary>`);
  out.push(`${PAD}  <div class="ntgoc-question__body">`);

  if (pending) {
    out.push(`${PAD}    <p class="ntgoc-question__pending">` +
      `<span class="ntgoc-question__tag">${esc(faq.pending.tag, 'pending.tag')}</span>` +
      `${esc(faq.pending.text, 'pending.text')}</p>`);
  } else {
    /* An unsourced claim stays flagged where the claim is, exactly as the
       calendar renderer flags an unconfirmed service. */
    if (q.verify) out.push(`${PAD}    <!-- TODO: verify -->`);
    for (const para of q.a) out.push(`${PAD}    <p class="ntgoc-body">${esc(para, where)}</p>`);
  }

  if (q.askFather) {
    /* On a pending card the placeholder has already said to ask him, so the
       sentence would be the third time of asking in four lines. The link still
       goes out — it is the useful half. */
    out.push(`${PAD}    <p class="ntgoc-question__ask">` +
      (pending ? '' : esc(faq.askFatherText, 'askFatherText') + ' ') +
      moreLink(faq.contact, 'contact') + '</p>');
  }
  if (q.link) {
    out.push(`${PAD}    <p class="ntgoc-question__more">${moreLink(q.link, where)}</p>`);
  }
  if (q.reviewed) {
    out.push(`${PAD}    <p class="ntgoc-question__reviewed">Answer last reviewed ${esc(longDate(q.reviewed), where)}</p>`);
  }

  out.push(`${PAD}  </div>`);
  out.push(`${PAD}</details>`);
  return out.join('\n');
}

/* ------------------------------------------------------------------ *
 * The register of documents
 *
 * Validated harder than the questions are, because a document is something a
 * person acts on: they buy a cross, book a date, or turn up on a Saturday
 * morning with the wrong things. A card and a document that disagree about
 * which version is current would be worse than no document at all, so both are
 * stamped from this one entry and the build refuses anything it cannot stamp.
 * ------------------------------------------------------------------ */
const register = JSON.parse(read(RESOURCES));
const categories = register.categories || [];
const allResources = categories.flatMap(c => (c.resources || []).map(r => ({ ...r, category: c.title })));

{
  const ids = new Set();
  const pages = new Map();
  for (const r of allResources) {
    if (!r.id || !r.title) throw new Error(`${RESOURCES}: a resource has no id or no title`);
    if (ids.has(r.id)) throw new Error(`${RESOURCES}: resource id "${r.id}" is used more than once`);
    ids.add(r.id);

    if (!register.statusLabels[r.status]) {
      throw new Error(`${RESOURCES}: "${r.id}" has status "${r.status}" — it must be one of ` +
        Object.keys(register.statusLabels).join(', '));
    }
    /* ONE canonical version, enforced rather than asked for: two register
       entries pointing at one page is two documents claiming to be the same
       thing, and only one of them can carry the right date. */
    if (r.page) {
      if (pages.has(r.page)) {
        throw new Error(`${RESOURCES}: "${r.id}" and "${pages.get(r.page)}" both claim ${r.page}. ` +
          'A document lives at exactly one URL, and a URL holds exactly one document.');
      }
      pages.set(r.page, r.id);
      if (!existsSync(join(ROOT, r.page))) {
        throw new Error(`${RESOURCES}: "${r.id}" names ${r.page}, which does not exist`);
      }
      if (!r.document || !Array.isArray(r.document.sections) || !r.document.sections.length) {
        throw new Error(`${RESOURCES}: "${r.id}" has a page but no document.sections to put on it`);
      }
    } else if (r.document) {
      throw new Error(`${RESOURCES}: "${r.id}" has a document but no page to render it on`);
    }

    if (r.status === 'published' && !r.lastUpdated) {
      throw new Error(`${RESOURCES}: "${r.id}" is published with no lastUpdated. ` +
        'A document nobody can date is a document nobody can trust.');
    }
    /* The governance rule, made mechanical. Anything touching the sacraments,
       fasting or godparent eligibility may not acquire content here without a
       name against it — see CLAUDE.md rule 2 and the content-governance note in
       data/catechumen-resources.json. */
    const hasContent = (r.document?.sections || []).some(s => (s.items || []).length);
    if (hasContent && r.governance === 'pastoral' && !r.approvedBy) {
      throw new Error(`${RESOURCES}: "${r.id}" is pastoral content with requirements filled in but no ` +
        '"approvedBy". Record who approved the wording before it goes on a page.');
    }
  }
}

/** "Last updated" as it appears on a card and at the head of a document. */
const stamp = r => (r.lastUpdated ? longDate(r.lastUpdated) : register.print.notIssued);

/* ------------------------------------------------------------------ *
 * A resource card
 * ------------------------------------------------------------------ */
function resourceCard(r) {
  const where = `resource "${r.id}"`;
  const status = register.statusLabels[r.status];
  const pad = ' '.repeat(10);
  const out = [];

  out.push(`${pad}<div class="ntgoc-resource" id="ntgoc-resource-${esc(r.id, where)}">`);
  out.push(`${pad}  <div class="ntgoc-resource__status ntgoc-resource__status--${esc(r.status, where)}">` +
    `${esc(status.label, 'statusLabels')}</div>`);
  /* h4: the page's own h2 heads the section, an h3 heads each category, and a
     card sits under one of those. Lint checks the levels do not skip. */
  out.push(`${pad}  <h4 class="ntgoc-h3">${esc(r.title, where)}</h4>`);
  out.push(`${pad}  <p class="ntgoc-body">${esc(r.blurb, where)}</p>`);
  if (r.warning) out.push(`${pad}  <p class="ntgoc-resource__warning">${esc(r.warning, where)}</p>`);
  out.push(`${pad}  <p class="ntgoc-resource__note">${esc(status.note, 'statusLabels')}</p>`);

  const actions = [];
  if (r.page) {
    actions.push(`<a href="${esc(r.page, where)}" class="ntgoc-inherit ntgoc-resource__cta">Open it</a>`);
  } else {
    actions.push(`<a href="${esc(faq.contact.href, 'contact')}" class="ntgoc-inherit ntgoc-resource__quiet">` +
      'Ask Fr. John</a>');
  }
  if (r.related) {
    actions.push(`<a href="${esc(r.related.href, where)}" class="ntgoc-inherit ntgoc-resource__quiet">` +
      `${esc(r.related.label, where)}</a>`);
  }
  out.push(`${pad}  <div class="ntgoc-resource__row">${actions.join('')}</div>`);

  /* No PDF is offered and none is stored. The page IS the printable version —
     see the print rules in components.css — so there is never a downloaded copy
     going quietly out of date in somebody's downloads folder. */
  if (r.print) {
    out.push(`${pad}  <p class="ntgoc-resource__print">Print-ready: open it and use your browser's ` +
      'Print command, which will also save it as a PDF.</p>');
  }
  out.push(`${pad}  <div class="ntgoc-resource__meta">Last updated: ${esc(stamp(r), where)}</div>`);
  out.push(`${pad}</div>`);
  return out.join('\n');
}

/** The list of documents that could be added later. Not cards: none exists. */
function futureList() {
  const pad = ' '.repeat(8);
  const out = [`${pad}<p class="ntgoc-body">${esc(register.future.intro, 'future.intro')}</p>`];
  out.push(`${pad}<ul class="ntgoc-doclist">`);
  for (const item of register.future.items) {
    out.push(`${pad}  <li class="ntgoc-doclist__item"><span class="ntgoc-doclist__name">` +
      `${esc(item.title, 'future item')}</span> ${esc(item.note, 'future item')}</li>`);
  }
  out.push(`${pad}</ul>`);
  return out.join('\n');
}

/* ------------------------------------------------------------------ *
 * A document page's body
 *
 * The masthead is hidden on screen and printed at the top of the sheet, so a
 * checklist that leaves the building on paper still says which parish it came
 * from, which document it is, when it was last changed, and who to ring. That
 * last point is the one that matters: an undated checklist in a drawer is
 * indistinguishable from a current one.
 * ------------------------------------------------------------------ */
function documentBody(r) {
  const where = `document "${r.id}"`;
  const doc = r.document;
  const status = register.statusLabels[r.status];
  const pad = ' '.repeat(8);
  const out = [];

  out.push(`${pad}<div class="ntgoc-doc__masthead" aria-hidden="true">`);
  out.push(`${pad}  <div class="ntgoc-doc__parish">${esc(register.print.parish, 'print.parish')}</div>`);
  out.push(`${pad}  <div class="ntgoc-doc__printtitle">${esc(r.title, where)}</div>`);
  out.push(`${pad}  <div class="ntgoc-doc__printmeta">Last updated: ${esc(stamp(r), where)}</div>`);
  out.push(`${pad}</div>`);

  out.push(`${pad}<p class="ntgoc-doc__audience">${esc(doc.audience, where)}</p>`);
  out.push(`${pad}<p class="ntgoc-doc__intro">${esc(doc.intro, where)}</p>`);
  out.push(`${pad}<div class="ntgoc-doc__status">` +
    `<span class="ntgoc-question__tag">${esc(status.label, 'statusLabels')}</span>` +
    `${esc(status.note, 'statusLabels')}</div>`);
  if (r.warning) out.push(`${pad}<p class="ntgoc-resource__warning">${esc(r.warning, where)}</p>`);

  doc.sections.forEach((section, i) => {
    out.push(`${pad}<section class="ntgoc-doc__section">`);
    out.push(`${pad}  <h2 class="ntgoc-doc__heading">` +
      `<span class="ntgoc-doc__number">${i + 1}</span>${esc(section.title, where)}</h2>`);
    const items = section.items || [];
    if (items.length) {
      out.push(`${pad}  <ul class="ntgoc-doc__list">`);
      for (const item of items) {
        out.push(`${pad}    <li class="ntgoc-doc__item">${esc(item, where)}</li>`);
      }
      out.push(`${pad}  </ul>`);
    } else {
      out.push(`${pad}  <p class="ntgoc-doc__pending">` +
        `<span class="ntgoc-question__tag">${esc(faq.pending.tag, 'pending.tag')}</span>` +
        `This section will say: ${esc(section.prompt, where)}</p>`);
    }
    out.push(`${pad}</section>`);
  });

  out.push(`${pad}<p class="ntgoc-doc__foot">${esc(register.print.questions, 'print.questions')}</p>`);
  out.push(`${pad}<p class="ntgoc-doc__foot ntgoc-doc__foot--screen">Last updated: ` +
    `${esc(stamp(r), where)}. This page is the current version — there is no other copy of it, ` +
    'and any printout is only as current as the date it carries.</p>');
  return out.join('\n');
}

/* ------------------------------------------------------------------ *
 * The list of documents still waiting on Fr. John
 * ------------------------------------------------------------------ */
function documentList() {
  const lines = [
    '# Documents for Fr. John',
    '',
    '<!-- GENERATED by tools/build-catechumens.mjs from data/catechumen-resources.json.',
    '     Do not edit this file; edit the JSON and run `npm run catechumens`. -->',
    '',
    'The *Resources for your journey* section of `catechumens.html` is a register of',
    'the documents a catechumen, a godparent or a parent might need. **None of them',
    'has been written**: what is on the site is the shell of each one, saying plainly',
    'that it is waiting on you. Nothing has been adapted from another parish, and',
    'nothing has been carried over from the baptism checklist now in use — which was',
    'reported as out of date, and written for infant baptisms.',
    '',
    'For each document below: what it is for, and what would have to come from you.',
    'Where a document already has its headings on the site, they are listed, so the',
    'quickest way to answer may be to reply heading by heading.',
    '',
    'A document becomes live by putting your wording into `data/catechumen-resources.json`',
    '— the requirements go in each section\'s `items`, `approvedBy` records that you',
    'approved them, `lastUpdated` gets the date, `status` becomes `published` — and',
    'running `npm run catechumens`. The card on the catechumen page and the document',
    'itself both take that date from the same place, so they cannot disagree.',
    '',
    `Generated from \`${RESOURCES}\`, last updated ${longDate(register._updated)}.`,
    '',
  ];

  let n = 0;
  for (const category of categories) {
    lines.push(`## ${category.title}`, '');
    for (const r of category.resources || []) {
      n++;
      lines.push(`### ${n}. ${r.title}`, '');
      lines.push(`*${r.blurb}*`, '');
      lines.push(`**Where:** ${r.page ? `\`${r.page}\`` : 'not on the site yet'} · ` +
        `**Status:** ${register.statusLabels[r.status].label}`, '');
      if (r.warning) lines.push(`> ${r.warning}`, '');
      lines.push(`**What is needed:** ${r.needs}`, '');
      for (const s of r.document?.sections || []) {
        lines.push(`- **${s.title}** — ${s.prompt}`);
      }
      if (r.document) lines.push('');
    }
  }

  lines.push('## Possible later documents', '', register.future.intro, '');
  for (const item of register.future.items) lines.push(`- **${item.title}** — ${item.note}`);
  lines.push('', '---', '',
    `**${n} documents in the register, none of them written.** The three checklists have`,
    'their headings on the site already; the rest are titles and a description of what',
    'they would hold. If any of them should not exist at all, say so — a register entry',
    'is easier to delete than a document is to unpublish.', '');

  return lines.join('\n');
}

/* ------------------------------------------------------------------ *
 * The list of questions still waiting on Fr. John
 *
 * Generated rather than kept by hand, because the whole value of it is that it
 * is exactly what the page is currently unable to answer. A hand-kept copy
 * would be wrong the first time a question was added.
 * ------------------------------------------------------------------ */
function reviewList() {
  const lines = [
    '# Questions for Fr. John',
    '',
    '<!-- GENERATED by tools/build-catechumens.mjs from data/catechumen-faq.json.',
    '     Do not edit this file; edit the JSON and run `npm run catechumens`. -->',
    '',
    'Every question below is on the draft catechumen page at `catechumens.html`,',
    'and every one of them is currently showing *“Content needed from Fr. John”*',
    'in place of an answer. Nothing has been guessed and nothing has been filled',
    'in from another parish\'s practice.',
    '',
    'When Fr. John answers one, put **his wording** into `data/catechumen-faq.json`',
    'under that question\'s `a`, record where it came from in `source`, set',
    '`reviewed` to the date, and remove `pending`. Then run `npm run catechumens`. The card',
    'on the page changes from the placeholder to the answer, and the question drops',
    'off this list on its own.',
    '',
    `Generated from \`${DATA}\`, last updated ${longDate(faq._updated)}.`,
    '',
  ];

  let total = 0;
  for (const section of sections) {
    const waiting = (section.questions || []).filter(q => q.pending);
    if (!waiting.length) continue;
    lines.push(`## ${section.category}`, '');
    for (const q of waiting) {
      total++;
      lines.push(`${total}. **${q.q}**  `);
      lines.push(`   \`${q.id}\`${q.askFather ? ' · also routed to you on the page as a pastoral question' : ''}`);
    }
    lines.push('');
  }

  const answered = sections.flatMap(s => s.questions || []).filter(q => !q.pending).length;
  lines.push('---', '',
    `**${total} waiting on an answer.** ${answered} other questions on the page are already`,
    'answered from what the parish has confirmed or from wording already published',
    'elsewhere on this site; each one records its own source in the JSON, and those',
    'are worth a read too — an answer that is right but not how you would put it is',
    'still worth correcting.', '');

  return lines.join('\n');
}

/* ------------------------------------------------------------------ *
 * Splice the rendered blocks into the page
 * ------------------------------------------------------------------ */
if (!existsSync(join(ROOT, PAGE))) {
  console.error(`  ✗ ${PAGE} does not exist.`);
  process.exit(1);
}

const changed = [];
const pages = new Map();

/** Replace one BUILD block, refusing to guess if its markers are gone. */
function splice(page, name, body) {
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
  const wrapped = '\n' + body + '\n' + ' '.repeat(8);
  if (src.slice(a + open.length, b) !== wrapped) changed.push(`${page}: ${name}`);
  pages.set(page, src.slice(0, a + open.length) + wrapped + src.slice(b));
}

/* The question cards. Their blocks sit two levels deeper in the markup than the
   resource ones, hence the extra indent on the closing marker. */
for (const section of sections) {
  const open = `<!-- BUILD:${section.build} -->`;
  const close = `<!-- /BUILD:${section.build} -->`;
  if (!pages.has(PAGE)) pages.set(PAGE, read(PAGE));
  const src = pages.get(PAGE);
  const a = src.indexOf(open);
  const b = src.indexOf(close);
  if (a === -1 || b === -1 || b < a) {
    console.error(`  ✗ ${PAGE} has no <!-- BUILD:${section.build} --> … <!-- /BUILD:${section.build} --> pair.`);
    console.error('    The markers are how this tool knows what it may replace. Put them back;');
    console.error('    it will not guess where the block used to be.');
    process.exit(1);
  }
  const body = '\n' + (section.questions || []).map(q => card(q, section)).join('\n') + '\n' + ' '.repeat(8);
  if (src.slice(a + open.length, b) !== body) changed.push(`${PAGE}: ${section.build}`);
  pages.set(PAGE, src.slice(0, a + open.length) + body + src.slice(b));
}

/* The resource cards, the future list, and each document that has a page. */
for (const category of categories) {
  splice(PAGE, category.build,
    (category.resources || []).map(resourceCard).join('\n'));
}
splice(PAGE, register.future.build, futureList());
for (const r of allResources.filter(r => r.page)) {
  splice(r.page, `doc${r.id.replace(/(^|-)([a-z])/g, (m, s, c) => c.toUpperCase())}`, documentBody(r));
}

const review = reviewList();
if (!existsSync(join(ROOT, REVIEW_LIST)) || read(REVIEW_LIST) !== review) changed.push(REVIEW_LIST);
const docs = documentList();
if (!existsSync(join(ROOT, DOC_LIST)) || read(DOC_LIST) !== docs) changed.push(DOC_LIST);

const questions = sections.flatMap(s => s.questions || []);
const waiting = questions.filter(q => q.pending).length;
const written = allResources.filter(r => r.status === 'published').length;

console.log(`\n  catechumen page — ${questions.length} question(s) across ${sections.length} section(s), ` +
  `${waiting} waiting on Fr. John`);
console.log(`  documents — ${allResources.length} in the register, ${written} written, ` +
  `${allResources.filter(r => r.page).length} with a page of their own`);

if (!changed.length) {
  console.log('  ✓ every page and both review lists are already current\n');
  process.exit(0);
}

console.log(`\n  ${CHECK ? 'stale' : 'rewritten'}:`);
for (const c of changed) console.log(`    ${c}`);

if (CHECK) {
  console.log('\n  Run "npm run catechumens" to rebuild.\n');
  process.exit(1);
}

for (const [page, body] of pages) writeFileSync(join(ROOT, page), body);
writeFileSync(join(ROOT, REVIEW_LIST), review);
writeFileSync(join(ROOT, DOC_LIST), docs);

console.log('\n  re-extracting chunks and linting…\n');
execFileSync(process.execPath, [join(ROOT, 'tools', 'extract-chunks.mjs')], { cwd: ROOT, stdio: 'pipe' });
try {
  execFileSync(process.execPath, [join(ROOT, 'tools', 'lint.mjs')], { cwd: ROOT, stdio: 'inherit' });
} catch {
  console.error('  ✗ lint failed after the build — review `git diff`.\n');
  process.exit(1);
}
