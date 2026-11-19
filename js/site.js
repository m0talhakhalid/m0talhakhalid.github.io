/* Page behaviour: theme, navigation, reveals, lightbox, small helpers.
   Everything here is progressive: the page reads fine with scripts off. */
(function () {
  'use strict';
  var doc = document.documentElement;
  doc.classList.add('js');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };

  /* ------------------------------ theme ------------------------------ */
  var themeBtn = $('#theme-btn');
  /* the page opens light for everyone; dark is a choice made with the switch */
  var isDark = function () { return doc.dataset.mode === 'night'; };
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var next = isDark() ? 'day' : 'night';
      doc.dataset.mode = next;
      try { localStorage.setItem('mode', next); } catch (e) { /* private mode: the choice lasts for this visit */ }
      window.dispatchEvent(new Event('themechange'));
    });
  }

  /* ---------------------------- navigation --------------------------- */
  var bar = $('#bar');
  var marker = $('.bar-marker');
  var links = $$('.bar-nav a');
  var sections = $$('[data-nav]');
  var halls = $$('.hall');
  var progress = $('#progress');
  var current = null;

  function setCurrent(id) {
    if (id === current) return;
    current = id;
    var hit = null;
    links.forEach(function (a) {
      var on = a.getAttribute('href') === '#' + id && a.offsetParent !== null;
      if (on) { a.setAttribute('aria-current', 'true'); hit = a; } else a.removeAttribute('aria-current');
    });
    if (!marker) return;
    if (hit) {
      marker.style.width = hit.offsetWidth + 'px';
      marker.style.transform = 'translateX(' + hit.offsetLeft + 'px)';
      marker.style.opacity = '1';
    } else marker.style.opacity = '0';
  }

  /* a floating button that always leads to the next section, so the end is a few clicks away */
  var nextBtn = $('#next-btn'), nextName = $('#next-name');
  var NEXT = [['research', 'Research statement'], ['studies', 'Current studies'], ['publications', 'Manuscripts'], ['education', 'Education'], ['experience', 'Experience'], ['projects', 'Undergraduate projects'], ['skills', 'Skills'], ['volunteering', 'Volunteering'], ['writing', 'Writing'], ['contact', 'Contact']];
  function nextUp() {
    if (!nextBtn) return;
    var hit = null;
    for (var i = 0; i < NEXT.length; i++) {
      var el = document.getElementById(NEXT[i][0]);
      if (el && el.getBoundingClientRect().top > Math.max(150, window.innerHeight * 0.45)) { hit = NEXT[i]; break; }
    }
    if (!hit) { nextBtn.hidden = true; return; }
    nextBtn.hidden = false;
    if (nextBtn.getAttribute('href') !== '#' + hit[0]) { nextBtn.setAttribute('href', '#' + hit[0]); nextName.textContent = hit[1]; }
  }

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      var y = window.scrollY, vh = window.innerHeight;
      var max = Math.max(1, doc.scrollHeight - vh);
      if (progress) progress.style.transform = 'scaleX(' + clamp(y / max, 0, 1) + ')';
      var probe = vh * 0.32, id = 'top';
      for (var i = 0; i < sections.length; i++) {
        if (sections[i].getBoundingClientRect().top <= probe) id = sections[i].dataset.nav;
      }
      if (y >= max - 4) id = 'contact';
      setCurrent(id);
      var over = false;
      for (var j = 0; j < halls.length; j++) {
        var r = halls[j].getBoundingClientRect();
        if (r.top <= 30 && r.bottom > 30) over = true;
      }
      if (bar) bar.classList.toggle('bar--hall', over);
      words(); nextUp();
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function () { current = null; onScroll(); });

  var menu = $('#menu'), menuBtn = $('#menu-btn');
  function setMenu(open) {
    if (!menu) return;
    menu.hidden = !open;
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.style.overflow = open ? 'hidden' : '';
    document.body.classList.toggle('menu-open', open);
    if (bar) bar.classList.toggle('bar--menu', open);
    if (open) bar.classList.add('bar--hall'); else onScroll();
  }
  if (menuBtn) {
    menuBtn.addEventListener('click', function () { setMenu(menu.hidden); });
    $$('a', menu).forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !menu.hidden) setMenu(false); });
  }

  /* ---------------- the statement lights up as it is read ------------- */
  var stmt = $('[data-words]'), wordEls = [];
  if (stmt && !reduce) {
    var parts = stmt.textContent.trim().split(/\s+/);
    stmt.setAttribute('aria-label', stmt.textContent.trim());
    stmt.textContent = '';
    parts.forEach(function (w, i) {
      var s = document.createElement('span');
      s.className = 'w'; s.textContent = w; s.setAttribute('aria-hidden', 'true');
      stmt.appendChild(s);
      if (i < parts.length - 1) stmt.appendChild(document.createTextNode(' '));
      wordEls.push(s);
    });
  }
  function words() {
    if (!wordEls.length) return;
    var r = stmt.getBoundingClientRect(), vh = window.innerHeight;
    var p = clamp((vh * 0.96 - r.top) / (vh * 0.34), 0, 1);
    var n = wordEls.length;
    wordEls.forEach(function (el, i) {
      el.style.opacity = String(0.34 + 0.66 * clamp(p * (n + 2) - i, 0, 1));
    });
  }

  /* --------------------- headings rise, numbers count ---------------- */
  if ('IntersectionObserver' in window) {
    var rise = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); rise.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    $$('[data-rise]').forEach(function (el) { rise.observe(el); });

    if (!reduce) {
      var count = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (!e.isIntersecting) return;
          count.unobserve(e.target);
          var el = e.target, to = parseFloat(el.dataset.count), t0 = performance.now(), dur = 1100;
          var step = function (now) {
            var k = clamp((now - t0) / dur, 0, 1), v = 1 - Math.pow(1 - k, 3);
            el.textContent = String(Math.round(to * v));
            if (k < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        });
      }, { threshold: 0.6 });
      $$('[data-count]').forEach(function (el) { count.observe(el); });
    }
  } else {
    $$('[data-rise]').forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ------------------------------ lightbox --------------------------- */
  var lb = $('#lightbox'), zooms = $$('[data-zoom]'), at = 0;
  function show(i) {
    at = (i + zooms.length) % zooms.length;
    var a = zooms[at], img = $('img', a), fig = a.closest('figure');
    var cap = a.dataset.caption || (fig && $('figcaption', fig) ? $('figcaption', fig).textContent.trim() : '') || (img ? img.alt : '');
    $('#lb-img').src = a.getAttribute('href');
    $('#lb-img').alt = img ? img.alt : cap;
    $('#lb-cap').textContent = cap;
  }
  if (lb && lb.showModal) {
    zooms.forEach(function (a, i) {
      a.addEventListener('click', function (e) { e.preventDefault(); show(i); lb.showModal(); });
    });
    $('.lb-close', lb).addEventListener('click', function () { lb.close(); });
    $('.lb-prev', lb).addEventListener('click', function () { show(at - 1); });
    $('.lb-next', lb).addEventListener('click', function () { show(at + 1); });
    lb.addEventListener('click', function (e) { if (e.target === lb) lb.close(); });
    lb.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') show(at + 1);
      if (e.key === 'ArrowLeft') show(at - 1);
    });
  }

  /* -------------------------- map and its list ----------------------- */
  var pins = $$('.map-pin'), rows = $$('.sites li');
  var mapSvg = $('#sitemap'), mapBox = $('#map-box'), tip = $('#map-tip');
  var setView = function () {}, showTip = function () {}, hideTip = function () {};
  if (mapSvg && mapBox && tip) {
    var REGION = mapSvg.dataset.region.split(' ').map(Number), COUNTRY = [0, 0, 640, 480];
    var cur = REGION.slice(), view = 'region', anim = 0, invs = $$('.map-inv', mapSvg), radios = $$('input[name="map-view"]');
    var apply = function (vb) {
      mapSvg.setAttribute('viewBox', vb.map(function (n) { return n.toFixed(2); }).join(' '));
      var wpx = mapSvg.clientWidth || 640, inv = (vb[2] / wpx * clamp(wpx / 600, 0.74, 1)).toFixed(4);
      invs.forEach(function (g) { g.setAttribute('transform', 'scale(' + inv + ')'); });
    };
    hideTip = function () { tip.hidden = true; };
    showTip = function (el, title, body) {
      var r = el.getBoundingClientRect(), b = mapBox.getBoundingClientRect();
      tip.innerHTML = '';
      var st = document.createElement('strong'); st.textContent = title; tip.appendChild(st);
      if (body) { var sp = document.createElement('span'); sp.textContent = body; tip.appendChild(sp); }
      tip.hidden = false;
      var x = clamp(r.left + r.width / 2 - b.left, 124, Math.max(124, b.width - 124));
      tip.style.left = x + 'px'; tip.style.top = Math.max(64, r.top - b.top) + 'px';
    };
    setView = function (v) {
      if (v === view) return;
      view = v; mapSvg.dataset.view = v; mapBox.dataset.view = v; hideTip();
      radios.forEach(function (r) { r.checked = r.value === v; });
      var from = cur.slice(), to = v === 'region' ? REGION : COUNTRY, t0 = performance.now(), dur = reduce ? 0 : 900;
      cancelAnimationFrame(anim);
      var step = function (now) {
        var k = dur ? clamp((now - t0) / dur, 0, 1) : 1, e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        /* zoom geometrically, so the motion reads as one steady pull */
        var w = from[2] * Math.pow(to[2] / from[2], e), fr = (w - from[2]) / ((to[2] - from[2]) || 1);
        cur = [from[0] + (to[0] - from[0]) * fr, from[1] + (to[1] - from[1]) * fr, w, from[3] + (to[3] - from[3]) * fr];
        apply(cur);
        if (k < 1) anim = requestAnimationFrame(step);
      };
      step(performance.now());
    };
    apply(REGION);
    window.addEventListener('resize', function () { apply(cur); });
    window.addEventListener('load', function () { apply(cur); });
    radios.forEach(function (r) { r.addEventListener('change', function () { if (r.checked) setView(r.value); }); });
    mapBox.addEventListener('click', function (e) {
      if (view === 'region' && e.target.closest('.map-pin')) return;
      setView(view === 'region' ? 'country' : 'region');
    });
    var area = $('#map-area');
    if (area) {
      var areaTip = function () { showTip(area, 'Field area', 'Islamabad, Rawalpindi, Chakwal and three well sites. Click to zoom in.'); };
      area.addEventListener('pointerenter', areaTip); area.addEventListener('focus', areaTip);
      area.addEventListener('pointerleave', hideTip); area.addEventListener('blur', hideTip);
      area.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setView('region'); } });
    }
  }
  var facts = function (id) {
    var li = rows.filter(function (r) { return r.dataset.site === id; })[0];
    if (!li) return ['', ''];
    var dim = $('.dim', li), main = li.lastElementChild.firstChild;
    return [main ? main.textContent.trim() : '', dim ? dim.textContent.trim() : ''];
  };
  function site(id, on) {
    pins.concat(rows).forEach(function (el) { if (el.dataset.site === id) el.classList.toggle('is-on', on); });
  }
  pins.forEach(function (el) {
    var id = el.dataset.site;
    var on = function () { site(id, true); var f = facts(id); showTip(el, f[0], f[1]); };
    var off = function () { site(id, false); hideTip(); };
    el.addEventListener('pointerenter', on); el.addEventListener('focus', on); el.addEventListener('click', on);
    el.addEventListener('pointerleave', off); el.addEventListener('blur', off);
  });
  rows.forEach(function (el) {
    var id = el.dataset.site;
    el.addEventListener('mouseenter', function () { site(id, true); });
    el.addEventListener('mouseleave', function () { site(id, false); });
    el.addEventListener('click', function () {
      setView('region');
      var pin = pins.filter(function (p) { return p.dataset.site === id; })[0];
      if (pin) setTimeout(function () { var f = facts(id); site(id, true); showTip(pin, f[0], f[1]); setTimeout(function () { site(id, false); }, 1800); }, reduce ? 0 : 950);
    });
  });

  /* ---------------------------- small figures ------------------------ */
  var rg = $('#review-grid');
  if (rg) { for (var i = 0; i < 132; i++) { rg.appendChild(document.createElement('i')); } }
  var runs = $('#runs');
  if (runs) {
    for (var b = 0; b < 4; b++) {
      var blk = document.createElement('div');
      for (var c = 0; c < 28; c++) { var cell = document.createElement('i'); cell.style.setProperty('--r', String(Math.floor(c / 4))); blk.appendChild(cell); }
      runs.appendChild(blk);
    }
  }
  $$('.ladder').forEach(function (l) { $$('span', l).forEach(function (s, k) { s.style.setProperty('--i', String(k)); }); });

  /* -------------------------- magnetic buttons ----------------------- */
  if (fine && !reduce) {
    $$('.magnetic').forEach(function (el) {
      el.addEventListener('mousemove', function (e) {
        var r = el.getBoundingClientRect();
        el.style.transition = 'transform .12s linear';
        el.style.transform = 'translate(' + ((e.clientX - r.left - r.width / 2) * 0.22).toFixed(1) + 'px,' + ((e.clientY - r.top - r.height / 2) * 0.3).toFixed(1) + 'px)';
      });
      el.addEventListener('mouseleave', function () {
        el.style.transition = 'transform .6s cubic-bezier(.2,1.6,.3,1)';
        el.style.transform = '';
      });
    });
  }

  /* ----------------------------- the ticker -------------------------- */
  var ticker = $('#ticker');
  if (ticker) {
    var fields = ['Two-phase heat transfer', 'Digital twins', 'Direct-to-chip cooling', 'Immersion cooling', 'CFD', 'Fluid-structure interaction', 'Microfluidic flow', 'Electronics cooling'];
    var html = '';
    for (var rep = 0; rep < 2; rep++) fields.forEach(function (f) { html += '<span>' + f + '</span>'; });
    ticker.innerHTML = html;
    if (!reduce) {
      var x = 0, lastY = window.scrollY, vel = 0, seen = false;
      new IntersectionObserver(function (es) { seen = es[0].isIntersecting; }, { rootMargin: '120px' }).observe(ticker);
      var tick = function () {
        var y = window.scrollY, dy = y - lastY; lastY = y;
        vel += (dy - vel) * 0.12;
        if (seen) {
          var half = ticker.scrollWidth / 2;
          x -= 0.6 + Math.abs(vel) * 0.5;
          if (x <= -half) x += half;
          ticker.style.transform = 'translate3d(' + x.toFixed(1) + 'px,0,0)';
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  }

  /* ------------------------------ contact ---------------------------- */
  var clock = $('#clock');
  if (clock) {
    var fmt;
    try { fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Karachi' }); } catch (e) { fmt = null; }
    var setClock = function () { if (fmt) clock.textContent = fmt.format(new Date()); };
    setClock(); setInterval(setClock, 20000);
  }
  var note = $('#letter-note'), copyBtn = $('#copy-email');
  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      var text = copyBtn.dataset.copy;
      var done = function () { note.textContent = 'Email address copied.'; };
      var fail = function () { note.textContent = text; };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fail); else fail();
    });
  }
  var letter = $('#letter');
  if (letter) {
    letter.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = $('#l-name').value.trim(), org = $('#l-org').value.trim(), topic = $('#l-topic').value.trim();
      var body = 'Hello Talha,\n\nI am ' + (name || '…') + (org ? ' from ' + org : '') + ', and I would like to talk about ' + (topic || '…') + '.\n\n';
      var href = 'mailto:talhakhalidraja692@gmail.com?subject=' + encodeURIComponent(topic ? 'About ' + topic : 'Hello from your portfolio') + '&body=' + encodeURIComponent(body);
      note.textContent = 'Opening your email app. If nothing opens, copy the address instead.';
      window.location.href = href;
    });
  }

  /* ------------- footer name: letters widen toward the cursor --------- */
  var big = $('#bigname');
  if (big) {
    var letters = big.textContent.split('');
    big.textContent = '';
    var spans = letters.map(function (ch) {
      var s = document.createElement('span');
      s.textContent = ch === ' ' ? ' ' : ch;
      big.appendChild(s);
      return s;
    });
    if (fine && !reduce) {
      var w = spans.map(function () { return 100; }), mouse = { x: -9999, y: -9999 }, vis = false, running = false;
      new IntersectionObserver(function (es) { vis = es[0].isIntersecting; if (vis && !running) { running = true; requestAnimationFrame(loop); } }).observe(big);
      window.addEventListener('mousemove', function (e) { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
      var loop = function () {
        if (!vis) { running = false; return; }
        var reach = window.innerWidth * 0.24;
        spans.forEach(function (el, i) {
          var r = el.getBoundingClientRect();
          var dd = Math.hypot(mouse.x - (r.left + r.width / 2), mouse.y - (r.top + r.height / 2));
          var t = clamp(1 - dd / reach, 0, 1); t = t * t * (3 - 2 * t);
          var want = 100 - 34 * t;
          w[i] += (want - w[i]) * 0.14;
          el.style.fontVariationSettings = "'wdth' " + w[i].toFixed(1) + ", 'wght' " + (700 + 150 * t).toFixed(0);
          el.style.color = t > 0.02 ? 'color-mix(in srgb, var(--hall-accent) ' + Math.round(t * 100) + '%, var(--hall-surface-2))' : '';
        });
        requestAnimationFrame(loop);
      };
    }
  }

  onScroll();
  window.addEventListener('load', function () { current = null; onScroll(); });
})();
