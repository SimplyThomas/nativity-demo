/*
 * ntgoc-enhance.js — progressive enhancement only.
 *
 * Everything on this site is complete and readable with JavaScript disabled.
 * This file adds two conveniences:
 *
 *   1. filtering the bookstore catalogue by category;
 *   2. dropping days and announcements that have already passed on the
 *      For Our Parish page.
 *
 * With JS off, every bookstore item is already visible and the category buttons
 * simply do nothing; the For Our Parish lists show exactly what they showed when
 * the page was last built, which is stated on the page in words. That is the
 * version that survives the move into Evolution CMS.
 *
 * No dependencies. Safe to paste into EVO as a chunk or an external file.
 */
(function () {
  'use strict';

  var filters = document.querySelectorAll('[data-ntgoc-filter]');
  var items = document.querySelectorAll('[data-ntgoc-cat]');
  if (!filters.length || !items.length) return;

  /* The design expresses the active/idle pill as two different style strings,
     which the renderer turned into two generated classes. Rather than hard-code
     those hashed names, read them off the markup as rendered. */
  var activeBtn = filters[0];
  var idleBtn = null;
  for (var i = 0; i < filters.length; i++) {
    if (filters[i].className !== activeBtn.className) { idleBtn = filters[i]; break; }
  }
  if (!idleBtn) return;

  var activeClass = activeBtn.className;
  var idleClass = idleBtn.className;

  var status = document.createElement('p');
  status.className = 'ntgoc-visually-hidden';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  filters[0].parentNode.appendChild(status);

  function apply(category) {
    var shown = 0;
    for (var i = 0; i < items.length; i++) {
      var match = category === 'All' || items[i].getAttribute('data-ntgoc-cat') === category;
      items[i].hidden = !match;
      if (match) shown++;
    }
    for (var j = 0; j < filters.length; j++) {
      var on = filters[j].getAttribute('data-ntgoc-filter') === category;
      filters[j].className = on ? activeClass : idleClass;
      filters[j].setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    status.textContent = shown + (shown === 1 ? ' item' : ' items') +
      (category === 'All' ? '' : ' in ' + category);
  }

  for (var k = 0; k < filters.length; k++) {
    filters[k].setAttribute('aria-pressed', filters[k] === activeBtn ? 'true' : 'false');
    filters[k].addEventListener('click', function (event) {
      apply(event.currentTarget.getAttribute('data-ntgoc-filter'));
    });
  }
}());

/*
 * For Our Parish — let the page age gracefully.
 *
 * "This week at Nativity" and the announcements are rendered by
 * `npm run parish` and then committed, so the page is only as fresh as the last
 * build. A parish website is not rebuilt every morning. This drops a day that
 * has already gone and an announcement past its expiry date, so a page nobody
 * has touched for a fortnight is still not actively wrong.
 *
 * It only ever HIDES. It cannot invent an event that is not already in the
 * markup, so the JS-off version is a superset of this one, never a different
 * one — the page stays honest either way, and says in words which date it was
 * built from.
 */
(function () {
  'use strict';

  /* Local midnight today, as YYYY-MM-DD. Compared as strings, which is safe for
     a fixed-width ISO date and avoids every timezone trap in Date parsing. */
  var now = new Date();
  var today = now.getFullYear() + '-' +
    ('0' + (now.getMonth() + 1)).slice(-2) + '-' +
    ('0' + now.getDate()).slice(-2);

  var days = document.querySelectorAll('[data-ntgoc-date]');
  var remaining = 0;
  for (var i = 0; i < days.length; i++) {
    var past = days[i].getAttribute('data-ntgoc-date') < today;
    days[i].hidden = past;
    if (!past) remaining++;
  }

  /* If every listed day has gone, say so rather than leaving a bare rule. */
  if (days.length && !remaining) {
    var list = document.querySelector('[data-ntgoc-week]');
    var empty = document.querySelector('[data-ntgoc-week-empty]');
    if (list) list.hidden = true;
    if (empty) empty.hidden = false;
  }

  var notices = document.querySelectorAll('[data-ntgoc-expires]');
  for (var j = 0; j < notices.length; j++) {
    notices[j].hidden = notices[j].getAttribute('data-ntgoc-expires') < today;
  }

  /* An urgent notice that has expired must not leave its red band behind,
     empty, at the top of the page. */
  var band = document.querySelector('[data-ntgoc-urgent]');
  if (band) {
    var live = band.querySelectorAll('[data-ntgoc-expires]:not([hidden])');
    var all = band.querySelectorAll('[data-ntgoc-expires]');
    if (all.length && !live.length) band.hidden = true;
  }
}());
