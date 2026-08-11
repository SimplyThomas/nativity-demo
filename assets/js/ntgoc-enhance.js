/*
 * ntgoc-enhance.js — progressive enhancement only.
 *
 * Everything on this site is complete and readable with JavaScript disabled.
 * This file adds conveniences, none of them required: filtering the bookstore
 * catalogue by category, polish on the phone navigation drawer, autoplay on the
 * carousel, dropping days and notices that have already passed on For Our
 * Parish, and the three forms and the fold-outs on the Welcome page.
 *
 * With JavaScript off, every bookstore item is already visible; the drawer — a
 * native <details> — still opens and closes; the carousel still scrolls with its
 * dots as ordinary links; the For Our Parish lists show exactly what they showed
 * when the page was last built, which is stated on the page in words; and the
 * Welcome page's questions, groups and forms are all complete and operable,
 * because they are <details> and <form> and nothing else. That is the version
 * that survives the move into Evolution CMS.
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

/*
 * Carousel autoplay — enhancement only, like the filter above.
 *
 * With JavaScript off the carousel is untouched and still works: the dots are
 * ordinary anchors pointing at each slide, and the track scrolls by trackpad,
 * drag or arrow key. All this adds is that the cards advance on their own,
 * that the dots show which slide you are on, and that you can stop them.
 *
 * WCAG 2.2.2 (Pause, Stop, Hide): anything that moves by itself for more than
 * five seconds needs a way to stop it. Hence the pause button — revealed here,
 * because with no script there is nothing to pause — plus pausing on hover, on
 * keyboard focus, and while the tab is in the background. A visitor who has
 * asked for reduced motion gets no autoplay at all.
 */
(function () {
  'use strict';
  var track = document.querySelector('.ntgoc-carousel__track');
  var nav = document.querySelector('.ntgoc-carousel__nav');
  if (!track || !nav) return;

  var slides = track.children;
  var dots = nav.querySelectorAll('.ntgoc-carousel__dot');
  var pauseBtn = nav.querySelector('.ntgoc-carousel__pause');
  if (slides.length < 2 || dots.length !== slides.length) return;

  var DELAY = 7000;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var timer = null;
  var stoppedByUser = false;
  var hovered = false;

  function current() {
    return track.clientWidth ? Math.round(track.scrollLeft / track.clientWidth) : 0;
  }

  function mark() {
    var i = current();
    for (var d = 0; d < dots.length; d++) {
      dots[d].setAttribute('aria-current', d === i ? 'true' : 'false');
    }
  }

  function go(i) {
    track.scrollTo({
      left: i * track.clientWidth,
      behavior: reduce.matches ? 'auto' : 'smooth'
    });
  }

  function stop() { if (timer) { clearInterval(timer); timer = null; } }

  function start() {
    stop();
    if (stoppedByUser || hovered || reduce.matches || document.hidden) return;
    timer = setInterval(function () { go((current() + 1) % slides.length); }, DELAY);
  }

  /* Clicking a dot scrolls the track rather than following the href, so the
     page does not jump and the address bar does not collect a hash. The href
     stays in the markup because it is what makes this work without a script. */
  for (var i = 0; i < dots.length; i++) {
    (function (n) {
      dots[n].addEventListener('click', function (event) {
        event.preventDefault();
        go(n);
        start();
      });
    }(i));
  }

  var scrollTick = null;
  track.addEventListener('scroll', function () {
    if (scrollTick) clearTimeout(scrollTick);
    scrollTick = setTimeout(mark, 120);
  });

  track.addEventListener('mouseenter', function () { hovered = true; stop(); });
  track.addEventListener('mouseleave', function () { hovered = false; start(); });
  track.addEventListener('focusin', function () { hovered = true; stop(); });
  track.addEventListener('focusout', function () { hovered = false; start(); });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else start();
  });
  if (reduce.addEventListener) {
    reduce.addEventListener('change', function () { start(); });
  }

  if (pauseBtn) {
    pauseBtn.hidden = false;
    pauseBtn.addEventListener('click', function () {
      stoppedByUser = !stoppedByUser;
      pauseBtn.textContent = stoppedByUser ? 'Play' : 'Pause';
      pauseBtn.setAttribute('aria-pressed', stoppedByUser ? 'true' : 'false');
      if (stoppedByUser) stop(); else start();
    });
  }

  mark();
  start();
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

  /* If every listed day has gone, say so rather than leaving an empty rule. */
  if (days.length && !remaining) {
    var empty = document.querySelector('[data-ntgoc-week-empty]');
    if (empty) empty.hidden = false;
  }

  var notices = document.querySelectorAll('[data-ntgoc-expires]');
  for (var j = 0; j < notices.length; j++) {
    notices[j].hidden = notices[j].getAttribute('data-ntgoc-expires') < today;
  }
}());

/*
 * Welcome — the three forms on the page behind the QR code.
 *
 * Enhancement only, like everything else here. With JavaScript off all three
 * forms are still complete, labelled and readable; the panel that asks for a
 * name and an email is simply visible from the start instead of appearing when
 * it becomes relevant, and pressing a button reloads the page. Nothing is lost,
 * because nothing is transmitted either way.
 *
 * That last point is the important one. None of these forms has a handler
 * behind it: the parish has no system to receive a question, a survey answer or
 * a mailing-list sign-up, and inventing one would be worse than the gap. Each
 * form sits inside a block that says so and gives the address that does work
 * today. What the script adds is the shape of the exchange — validation, an
 * error the visitor can act on, and the reply they would receive — so that the
 * Council can see the whole thing before deciding whether to build it.
 *
 * Three separate forms, three separate buttons. Asking a question or answering
 * the survey must never add anyone to the mailing list, so there is no shared
 * state between them and the only consent tick on the page is on the list form.
 */
(function () {
  'use strict';

  var forms = document.querySelectorAll('[data-ntgoc-form]');
  if (!forms.length) return;

  /* --- ask for contact details only once they are wanted ------------- */
  var reveals = document.querySelectorAll('[data-ntgoc-reveal]');
  var panels = {};
  for (var i = 0; i < reveals.length; i++) {
    var id = reveals[i].getAttribute('data-ntgoc-reveal');
    var panel = document.getElementById(id);
    if (!panel) continue;
    panels[id] = panel;
    panel.hidden = true;
    reveals[i].addEventListener('change', syncReveal);
  }

  function syncReveal() {
    for (var r = 0; r < reveals.length; r++) {
      var p = panels[reveals[r].getAttribute('data-ntgoc-reveal')];
      if (!p || !reveals[r].checked) continue;
      p.hidden = reveals[r].getAttribute('data-ntgoc-reveal-when') !== 'on';
    }
  }
  syncReveal();

  /* --- a field that becomes required because a box was ticked -------- */
  var conditional = document.querySelectorAll('[data-ntgoc-requires]');
  function syncRequired() {
    var wanted = {};
    for (var c = 0; c < conditional.length; c++) {
      var name = conditional[c].getAttribute('data-ntgoc-requires');
      wanted[name] = wanted[name] || conditional[c].checked;
    }
    for (var key in wanted) {
      if (!Object.prototype.hasOwnProperty.call(wanted, key)) continue;
      var field = document.getElementById(key);
      if (field) field.required = wanted[key];
    }
  }
  for (var q = 0; q < conditional.length; q++) {
    conditional[q].addEventListener('change', syncRequired);
  }
  syncRequired();

  /* --- submitting ---------------------------------------------------- */
  function status(form, kind) {
    return form.querySelector('[data-ntgoc-status="' + kind + '"]');
  }

  /* form.reportValidity() is affected by the form's own novalidate; the same
     method on a single control is not, so the first bad field reports itself. */
  function firstInvalid(form) {
    for (var e = 0; e < form.elements.length; e++) {
      var el = form.elements[e];
      if (el.willValidate && !el.checkValidity()) return el;
    }
    return null;
  }

  /* A field may carry its own wording. The defaults below were written for the
     Welcome page's three forms, which ask for a question and an email address,
     and read as nonsense anywhere else: the meal-support request on Get Involved
     and the teach-a-tradition form both answered a missing NAME with "Please
     write your question before sending it." Set data-ntgoc-complaint on the
     field rather than adding another branch here for every new form. */
  function complaint(el) {
    var own = el.getAttribute('data-ntgoc-complaint');
    if (own) return own;
    if (el.type === 'email') return 'Please add an email address so that we can write back to you.';
    if (el.type === 'checkbox') return 'Please tick the box to confirm you would like to be added.';
    return 'Please write your question before sending it.';
  }

  function onSubmit(event) {
    event.preventDefault();
    var form = event.currentTarget;
    var ok = status(form, 'ok');
    var bad = status(form, 'error');
    var offender = firstInvalid(form);

    if (offender) {
      if (bad) { bad.textContent = complaint(offender); bad.hidden = false; }
      offender.reportValidity();
      return;
    }

    if (bad) bad.hidden = true;
    /* Nothing leaves the page. The fields are locked so the state reads as
       finished rather than as a button that did nothing. */
    for (var f = 0; f < form.elements.length; f++) form.elements[f].disabled = true;
    if (ok) ok.hidden = false;
  }

  for (var n = 0; n < forms.length; n++) {
    forms[n].addEventListener('submit', onSubmit);
  }
}());

/*
 * Open whatever an in-page link points into.
 *
 * Now that the question groups fold, a link like "The Great Entrance →" points
 * at a card inside a closed group, inside a closed section. Newer browsers open
 * the ancestors of a link target for you; older ones scroll to something that is
 * not on screen, which reads as a broken link. So it is done here explicitly,
 * for the target itself as well as its ancestors — the target is a <details> in
 * its own right, and no browser opens that for you.
 *
 * Enhancement, like everything else in this file: with JavaScript off the link
 * still moves the page to the right place, and the reader taps the card open.
 * It is scoped to nothing in particular, so it costs the other pages one event
 * listener that never matches.
 */
(function () {
  'use strict';

  function reveal(target) {
    if (!target) return;
    if (target.tagName === 'DETAILS') target.open = true;
    for (var el = target.parentNode; el && el.tagName; el = el.parentNode) {
      if (el.tagName === 'DETAILS') el.open = true;
    }
  }

  function targetOf(hash) {
    if (!hash || hash.length < 2) return null;
    try { return document.getElementById(decodeURIComponent(hash.slice(1))); }
    catch (e) { return null; }
  }

  document.addEventListener('click', function (event) {
    var el = event.target;
    while (el && el !== document && el.tagName !== 'A') el = el.parentNode;
    if (!el || el.tagName !== 'A') return;
    var href = el.getAttribute('href');
    if (!href || href.charAt(0) !== '#') return;
    reveal(targetOf(href));
  });

  function fromHash() {
    var t = targetOf(window.location.hash);
    if (!t) return;
    reveal(t);
    t.scrollIntoView();
  }

  window.addEventListener('hashchange', fromHash);
  fromHash();
}());
