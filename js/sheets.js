/* Detail sheets. Each section shows short cards; the full story waits in
   the page (it reads in place with scripts off) and is lifted into a sheet
   when a card is pressed. The sheet grows out of the card and shrinks back
   into it, the back button closes it, and the arrows step through the rest
   of the section. */
(function () {
  'use strict';
  var doc = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ------------------------- cards rise into view ------------------------ */
  var cards = $$('.tile, .role-tile');
  if (!reduce && 'IntersectionObserver' in window) {
    doc.classList.add('reveal-on');
    var rise = new IntersectionObserver(function (es) {
      var n = 0;
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.style.setProperty('--d', (n++ * 90) + 'ms');
        e.target.classList.add('is-in');
        rise.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -6% 0px' });
    cards.forEach(function (c) { rise.observe(c); });
  }

  /* a warm spot follows the pointer across a card */
  if (fine && !reduce) {
    document.addEventListener('pointermove', function (e) {
      var t = e.target.closest ? e.target.closest('.tile') : null;
      if (!t) return;
      var r = t.getBoundingClientRect();
      t.style.setProperty('--mx', Math.round(e.clientX - r.left) + 'px');
      t.style.setProperty('--my', Math.round(e.clientY - r.top) + 'px');
    }, { passive: true });
  }

  /* the drawings on the cards only move while they are on screen */
  var arts = $$('svg.art').filter(function (s) { return typeof s.pauseAnimations === 'function'; });
  arts.forEach(function (s) { s.pauseAnimations(); });
  if (!reduce && 'IntersectionObserver' in window) {
    var play = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) e.target.unpauseAnimations(); else e.target.pauseAnimations(); });
    }, { rootMargin: '60px' });
    arts.forEach(function (s) { play.observe(s); });
  }

  /* ------------------ skills rack: a unit slides out to show its uses ------------------ */
  var units = $$('.unit');
  function setUnit(u, on) {
    u.classList.toggle('is-open', on);
    var b = $('.unit-btn', u); if (b) b.setAttribute('aria-expanded', on ? 'true' : 'false');
  }
  units.forEach(function (u) {
    var b = $('.unit-btn', u);
    if (!b) return;
    b.addEventListener('click', function () {
      var on = !u.classList.contains('is-open');
      units.forEach(function (o) { if (o !== u) setUnit(o, false); });
      setUnit(u, on);
    });
  });

  /* -------------------------------- the sheet ---------------------------- */
  var dlg = $('#sheet');
  if (!dlg || typeof dlg.showModal !== 'function') return;
  var panel = $('.sheet-panel', dlg), scrim = $('.sheet-scrim', dlg), bar = $('.sheet-bar', dlg);
  var scroller = $('#sheet-scroll'), inner = $('#sheet-inner'), slot = $('#sheet-slot'), foot = $('#sheet-foot');
  var crumb = $('#sheet-crumb'), count = $('#sheet-count');
  var btnPrev = $('.sheet-prev', dlg), btnFwd = $('.sheet-fwd', dlg), btnClose = $('.sheet-close', dlg);
  var ARROW = '<svg class="i-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  var GROUPS = { about: 'About', research: 'Research', studies: 'Current studies', edu: 'Education', exp: 'Experience', proj: 'Undergraduate projects' };
  var EASE = 'cubic-bezier(.2,.85,.15,1)';
  var animates = typeof panel.animate === 'function' && !reduce;

  /* every detail block remembers where it lives, so it can go home after */
  var srcs = $$('.sheet-src');
  srcs.forEach(function (s) { s._home = document.createComment(' ' + s.id + ' '); s.parentNode.insertBefore(s._home, s); });

  var cur = null, from = null, back = null, busy = false, closing = false, after = null, dragged = false, selfClosed = 0, skipPop = false;

  function byId(id) { var el = id ? document.getElementById(id) : null; return el && el.classList.contains('sheet-src') ? el : null; }
  function members(src) { return srcs.filter(function (s) { return s.dataset.group === src.dataset.group; }); }
  function titleOf(src) { var h = $('h2', src); return h ? h.textContent.replace(/\s+/g, ' ').trim() : ''; }
  function cardFor(src) {
    var a = $('main .tile-hit[href="#' + src.id + '"]');
    return a ? a.closest('.tile, .role-tile') : null;
  }
  function onScreen(el) {
    if (!el || !el.getClientRects().length) return false;
    var r = el.getBoundingClientRect();
    return r.width > 4 && r.height > 4 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  }
  function radii(el, fallback) {
    var cs = getComputedStyle(el);
    var v = [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius];
    if (fallback && v.every(function (x) { return !parseFloat(x); })) return fallback;
    return v.map(function (x) { return (parseFloat(x) || 0) + 'px'; }).join(' ');
  }
  /* the clip that makes the open panel look like the card it came from */
  function clipAt(el) {
    if (!onScreen(el)) return null;
    var r = el.getBoundingClientRect(), p = panel.getBoundingClientRect();
    var t = Math.max(0, r.top - p.top), l = Math.max(0, r.left - p.left);
    var b = Math.max(0, p.bottom - r.bottom), rt = Math.max(0, p.right - r.right);
    if (t + b > p.height - 8 || l + rt > p.width - 8) return null;
    return 'inset(' + t.toFixed(1) + 'px ' + rt.toFixed(1) + 'px ' + b.toFixed(1) + 'px ' + l.toFixed(1) + 'px round ' + radii(el, '8px 8px 8px 8px') + ')';
  }
  /* fully open: the clip sits outside the panel, so its shadow shows */
  function clipOpen() { return 'inset(-90px -90px -90px -90px round ' + radii(panel) + ')'; }

  function parts(src) {
    var list = [], head = $('.sh-head', src), body = $('.sh-body', src);
    if (head) list.push(head);
    if (body) list = list.concat(Array.prototype.slice.call(body.children, 0, 5));
    return list;
  }
  function stop() {
    var els = [panel, scrim, inner].concat(cur ? parts(cur) : []);
    els.forEach(function (el) { if (el.getAnimations) el.getAnimations().forEach(function (a) { a.cancel(); }); });
  }
  function eager(src) { $$('img[loading="lazy"]', src).forEach(function (im) { im.loading = 'eager'; }); }
  function jumpTo(card) {
    var r = card.getBoundingClientRect();
    if (r.top >= 70 && r.bottom <= innerHeight - 16) return;
    var y = window.scrollY + r.top - Math.max(84, (innerHeight - r.height) / 2);
    var sb = doc.style.scrollBehavior;
    doc.style.scrollBehavior = 'auto';
    window.scrollTo(0, Math.max(0, y));
    doc.style.scrollBehavior = sb;
  }

  function fill(src) {
    var g = members(src), i = g.indexOf(src), n = g.length;
    crumb.textContent = GROUPS[src.dataset.group] || '';
    count.textContent = n > 1 ? (i + 1) + ' / ' + n : '';
    btnPrev.hidden = btnFwd.hidden = n < 2;
    foot.textContent = '';
    if (n > 1) {
      var nx = g[(i + 1) % n], a = document.createElement('a');
      a.className = 'sheet-next'; a.href = '#' + nx.id;
      a.innerHTML = '<small></small><strong></strong>' + ARROW;
      a.children[0].textContent = i + 1 < n ? 'Next in ' + (GROUPS[src.dataset.group] || '').toLowerCase() : 'Back to the first';
      a.children[1].textContent = titleOf(nx);
      foot.appendChild(a);
    }
    var h = $('h2', src);
    if (h && h.id) dlg.setAttribute('aria-labelledby', h.id);
  }
  function mount(src) { slot.appendChild(src); fill(src); scroller.scrollTop = 0; eager(src); }
  function unmount(src) { if (src && src._home && src._home.parentNode) src._home.parentNode.insertBefore(src, src._home.nextSibling); }

  /* ---------------------------------- open -------------------------------- */
  var queued = null;
  function open(src, origin, viaHistory) {
    if (!src) return;
    if (closing) { queued = [src, origin]; return; }   /* pressed during a close: open once it has finished */
    if (dlg.open) { swap(src, viaHistory); return; }
    cur = src; from = origin || cardFor(src); back = document.activeElement;
    mount(src);
    doc.classList.add('sheet-lock');
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    dlg.showModal();
    scroller.scrollTop = 0;
    try { scroller.focus({ preventScroll: true }); } catch (e) { scroller.focus(); }
    if (!viaHistory) { try { history.pushState({ sheet: src.id }, '', '#' + src.id); } catch (e) { /* file:// in some browsers */ } }
    if (!animates) return;
    busy = true;
    var clip = clipAt(from), last;
    scrim.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 420, easing: 'ease-out' });
    if (clip) last = panel.animate([{ clipPath: clip, opacity: 0 }, { opacity: 1, offset: 0.22 }, { clipPath: clipOpen(), opacity: 1 }], { duration: 700, easing: EASE });
    else last = panel.animate([{ opacity: 0, transform: 'translateY(34px) scale(.965)' }, { opacity: 1, transform: 'none' }], { duration: 520, easing: EASE });
    parts(src).forEach(function (el, i) {
      el.animate([{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'none' }],
        { duration: 600, delay: (clip ? 240 : 140) + i * 60, easing: EASE, fill: 'backwards' });
    });
    last.onfinish = function () { busy = false; };
  }

  /* -------------------------- step to another sheet ----------------------- */
  function swap(src, viaHistory) {
    if (!src || src === cur || closing) return;
    var old = cur, g = members(old), dir = g.indexOf(src) > -1 && g.indexOf(src) < g.indexOf(old) ? -1 : 1;
    stop();
    busy = true;
    var go = function () {
      unmount(old); cur = src; mount(src);
      var card = cardFor(src);
      if (card) { from = card; jumpTo(card); }
      if (!viaHistory) { try { history.replaceState({ sheet: src.id }, '', '#' + src.id); } catch (e) { /* ignore */ } }
      if (!animates) { busy = false; return; }
      inner.animate([{ opacity: 0, transform: 'translateX(' + 30 * dir + 'px)' }, { opacity: 1, transform: 'none' }], { duration: 460, easing: EASE })
        .onfinish = function () { busy = false; };
    };
    if (!animates) { go(); return; }
    var out = inner.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(' + -30 * dir + 'px)' }], { duration: 170, easing: 'ease-in', fill: 'forwards' });
    out.onfinish = function () { out.cancel(); go(); };
  }
  function step(k) {
    if (!cur || busy || closing) return;
    var g = members(cur), i = g.indexOf(cur);
    if (g.length > 1) swap(g[(i + k + g.length) % g.length]);
  }

  /* --------------------------------- close -------------------------------- */
  function requestClose(then) {
    if (!dlg.open) { if (then) then(); return; }
    if (then) after = then;
    if (history.state && history.state.sheet) history.back();   /* popstate closes it */
    else shut();
  }
  function tidy(src) {
    stop();
    panel.style.transform = '';
    doc.classList.remove('sheet-lock');
    unmount(src);
    cur = null; closing = false; busy = false; dragged = false;
    if ('scrollRestoration' in history) history.scrollRestoration = 'auto';
  }
  function shut() {
    if (!dlg.open || closing) return;
    closing = true;
    var src = cur, card = cardFor(src) || from;
    stop();
    var end = function () {
      selfClosed++;
      dlg.close();
      tidy(src);
      var f = back && back !== document.body && document.contains(back) && !dlg.contains(back) ? back : (card && $('.tile-hit', card)) || card;
      if (f && f.focus) { try { f.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
      if (after) { var a = after; after = null; a(); }
      if (queued) { var q = queued; queued = null; open(q[0], q[1]); }
    };
    if (!animates) { end(); return; }
    var clip = dragged ? null : clipAt(card), last;
    inner.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'ease-in', fill: 'forwards' });
    scrim.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 440, easing: 'ease-in', fill: 'forwards' });
    if (dragged) last = panel.animate([{ transform: panel.style.transform || 'none' }, { transform: 'translateY(105%)' }], { duration: 300, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' });
    else if (clip) last = panel.animate([{ clipPath: clipOpen(), opacity: 1 }, { opacity: 1, offset: 0.6 }, { clipPath: clip, opacity: 0 }], { duration: 440, easing: 'cubic-bezier(.5,0,.15,1)', fill: 'forwards' });
    else last = panel.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(26px) scale(.97)' }], { duration: 280, easing: 'ease-in', fill: 'forwards' });
    last.onfinish = end;
  }
  /* the browser can close a modal on its own (a second Escape): tidy up after it */
  dlg.addEventListener('close', function () {
    if (selfClosed) { selfClosed--; return; }
    var src = cur;
    if (src) tidy(src);
    if (history.state && history.state.sheet) { skipPop = true; history.back(); }
  });

  window.addEventListener('popstate', function (e) {
    if (skipPop) { skipPop = false; return; }
    var src = byId(e.state && e.state.sheet);
    if (src) open(src, null, true);
    else if (dlg.open) shut();
  });

  /* --------------------------------- wiring ------------------------------- */
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!a) return;
    var id = decodeURIComponent(a.getAttribute('href').slice(1)), src = byId(id);
    if (src) {
      e.preventDefault();
      if (dlg.open) swap(src); else open(src, a.closest('.tile, .role-tile') || a);
      return;
    }
    /* an ordinary page link inside a sheet: close, then go there */
    if (dlg.open && dlg.contains(a)) {
      var target = id ? document.getElementById(id) : null;
      if (!target) return;
      e.preventDefault();
      requestClose(function () { target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); });
    }
  });

  /* start loading a sheet's pictures as soon as its card is pointed at */
  function warm(e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href^="#s-"]') : null;
    var src = a ? byId(a.getAttribute('href').slice(1)) : null;
    if (src && !src._warm) { src._warm = true; eager(src); }
  }
  document.addEventListener('pointerover', warm, { passive: true });
  document.addEventListener('focusin', warm);

  btnPrev.addEventListener('click', function () { step(-1); });
  btnFwd.addEventListener('click', function () { step(1); });
  btnClose.addEventListener('click', function () { requestClose(); });
  scrim.addEventListener('click', function () { requestClose(); });
  dlg.addEventListener('click', function (e) { if (e.target === dlg) requestClose(); });
  dlg.addEventListener('cancel', function (e) { e.preventDefault(); requestClose(); });
  dlg.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    var t = e.target;
    /* leave sliders, case grids and other controls their own arrow keys */
    if (t !== scroller && t !== dlg && !(t.closest && t.closest('.sheet-bar'))) return;
    e.preventDefault();
    step(e.key === 'ArrowRight' ? 1 : -1);
  });

  /* on a phone, pull the sheet down by its top bar to close it */
  var drag = null;
  bar.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse' || busy || closing || (e.target.closest && e.target.closest('button'))) return;
    drag = { id: e.pointerId, y0: e.clientY, t0: performance.now(), dy: 0 };
    try { bar.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
  });
  bar.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    drag.dy = Math.max(0, e.clientY - drag.y0);
    panel.style.transform = 'translateY(' + drag.dy + 'px)';
  });
  function release() {
    if (!drag) return;
    var d = drag; drag = null;
    var v = d.dy / Math.max(1, performance.now() - d.t0);
    if (d.dy > 110 || (d.dy > 30 && v > 0.55)) { dragged = true; requestClose(); return; }
    if (!d.dy) return;
    var tr = panel.style.transform; panel.style.transform = '';
    if (panel.animate) panel.animate([{ transform: tr }, { transform: 'none' }], { duration: 320, easing: EASE });
  }
  bar.addEventListener('pointerup', release);
  bar.addEventListener('pointercancel', release);

  /* a link straight to a sheet (…/#s-twins) opens it over its section */
  var first = byId(decodeURIComponent(location.hash.slice(1)));
  if (first) {
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* ignore */ }
    var start = function () { var c = cardFor(first); if (c) jumpTo(c); open(first, c); };
    if (document.readyState === 'complete') start(); else window.addEventListener('load', start);
  }
})();
