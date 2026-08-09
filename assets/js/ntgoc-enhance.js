/*
 * ntgoc-enhance.js — progressive enhancement only.
 *
 * Everything on this site is complete and readable with JavaScript disabled.
 * This file adds two conveniences: filtering the bookstore catalogue by
 * category, and polish on the phone navigation drawer. Neither is required.
 * With JavaScript off every bookstore item is already visible, and the drawer
 * — a native <details> — still opens and closes.
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

/* ------------------------------------------------------------------------
 * The phone navigation drawer.
 *
 * The drawer is a native <details>, so it opens and closes without any of
 * this. What follows is the polish a hand-built menu would need anyway:
 * Escape closes it, so does a click outside or a tap on any link, and the
 * page behind it stops scrolling while it is open.
 *
 * All of it is optional. Skip this file in EVO and the drawer still works.
 * ---------------------------------------------------------------------- */
(function () {
  'use strict';

  var drawer = document.querySelector('[data-ntgoc-drawer]');
  if (!drawer) return;

  var toggle = drawer.querySelector('summary');
  if (!toggle) return;

  /* The panel covers the viewport, so the page behind it must not scroll
     under it. Nothing here sizes or positions the panel — CSS does all of
     that, which is why the drawer is complete without this file. */
  drawer.addEventListener('toggle', function () {
    if (drawer.open) {
      document.body.className += ' ntgoc-scroll-locked';
    } else {
      document.body.className = document.body.className
        .replace(/\s*ntgoc-scroll-locked/g, '');
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape' || !drawer.open) return;
    drawer.open = false;
    toggle.focus();
  });

  /* There is deliberately no close-on-click-outside here. The panel is
     full screen, so there is no outside left to click — the ✕ is the way
     out, and on a touch screen it is the one people reach for anyway. */

  /* Following a link inside the drawer should not leave it hanging open
     behind the next page's paint. */
  drawer.addEventListener('click', function (event) {
    for (var el = event.target; el && el !== drawer; el = el.parentNode) {
      if (el.tagName === 'A') { drawer.open = false; return; }
    }
  });
}());
