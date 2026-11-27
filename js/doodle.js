/* Doodle version: draws each sketch in, pen-stroke by pen-stroke, when it scrolls into view,
   runs the single-phase / two-phase switches on the cooling sketches, and pauses the moving
   bits (bubbles, coolant, fans, vortices) while they are off screen.
   With reduced motion every doodle is simply shown, standing still. */
(function () {
  var root = document.documentElement;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canWatch = 'IntersectionObserver' in window;
  var smil = [].slice.call(document.querySelectorAll('svg.dl-smil')).filter(function (s) {
    return typeof s.pauseAnimations === 'function';
  });

  // single-phase / two-phase switches
  [].forEach.call(document.querySelectorAll('.dl-ex'), function (fig) {
    var btns = fig.querySelectorAll('.dl-switch button');
    [].forEach.call(btns, function (btn) {
      btn.addEventListener('click', function () {
        var v = btn.getAttribute('data-set');
        if (fig.getAttribute('data-phase') === v) return;
        fig.setAttribute('data-phase', v);
        [].forEach.call(btns, function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
        var art = fig.querySelector('.dl-v[data-v="' + v + '"] svg');
        if (art && root.classList.contains('dl-anim')) {
          art.classList.remove('is-drawn');
          void art.getBoundingClientRect();
          art.classList.add('is-drawn');
        }
      });
    });
  });

  // the doodled clock shows the real time in Islamabad (UTC+5)
  var hh = document.querySelectorAll('.dl-hand-h'), mm = document.querySelectorAll('.dl-hand-m');
  function tick() {
    var d = new Date(Date.now() + 5 * 3600e3), m = d.getUTCMinutes(), hr = (d.getUTCHours() % 12) + m / 60;
    [].forEach.call(hh, function (el) { el.style.transform = 'rotate(' + hr * 30 + 'deg)'; });
    [].forEach.call(mm, function (el) { el.style.transform = 'rotate(' + m * 6 + 'deg)'; });
  }
  if (hh.length) { tick(); setInterval(tick, 20000); }

  // skills: flip a card to see where each skill shows up
  var cards = [].slice.call(document.querySelectorAll('.dl-sk'));
  cards.forEach(function (card) {
    var open = card.querySelector('.dl-sk-btn'), close = card.querySelector('.dl-sk-close');
    if (!open || !close) return;
    card._set = function (on, focus) {
      card.classList.toggle('is-flipped', on);
      open.setAttribute('aria-expanded', String(on));
      if (focus) setTimeout(function () { (on ? close : open).focus({ preventScroll: true }); }, reduce ? 20 : 480);
    };
    open.addEventListener('click', function () {
      cards.forEach(function (c) { if (c !== card && c._set && c.classList.contains('is-flipped')) c._set(false); });
      card._set(true, true);
    });
    close.addEventListener('click', function () { card._set(false, true); });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    cards.forEach(function (c) { if (c._set && c.classList.contains('is-flipped')) c._set(false, c.contains(document.activeElement)); });
  });

  // the postcard: posted straight to my inbox (no email app needed); the reply address is optional
  var letter = document.getElementById('letter');
  function fly() {
    if (!letter || !root.classList.contains('dl-anim')) return;
    var env = letter.querySelector('.dl-mb-env'), box = document.querySelector('.dl-pillar-wrap'), slot = box && box.querySelector('.dl-pb-slot');
    var btn = letter.querySelector('button[type="submit"]');
    if (env && btn) {
      var f = letter.getBoundingClientRect(), s0 = btn.getBoundingClientRect();
      var s1 = slot && slot.getBoundingClientRect().width ? slot.getBoundingClientRect() : { left: f.right - 60, top: f.top - 40, width: 40, height: 10 };
      env.style.setProperty('--x0', (s0.left + s0.width / 2 - f.left) + 'px'); env.style.setProperty('--y0', (s0.top - f.top) + 'px');
      env.style.setProperty('--x1', (s1.left + s1.width / 2 - f.left) + 'px'); env.style.setProperty('--y1', (s1.top + s1.height / 2 - f.top) + 'px');
    }
    [letter, box].forEach(function (el) { if (!el) return; el.classList.remove('dl-sent'); void el.offsetWidth; el.classList.add('dl-sent'); });
    setTimeout(function () { [letter, box].forEach(function (el) { if (el) el.classList.remove('dl-sent'); }); }, 2400);
  }
  if (letter) {
    var endpoint = (letter.getAttribute('data-endpoint') || '').trim();
    var sendBtn = letter.querySelector('button[type="submit"]'), note = document.getElementById('letter-note');
    var val = function (id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; };
    document.addEventListener('submit', function (e) {
      if (e.target !== letter) return;
      e.preventDefault(); e.stopPropagation();
      var d = { name: val('l-name'), org: val('l-org'), topic: val('l-topic'), email: val('l-email'), message: val('l-msg'),
        website: (letter.querySelector('.dl-hp') || {}).value || '', page: location.href };
      if (!d.message && !d.topic) { note.textContent = 'Write a few words first.'; document.getElementById('l-msg').focus(); return; }
      if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) { note.textContent = 'That reply address does not look right. You can also leave it empty.'; document.getElementById('l-email').focus(); return; }
      if (d.website) { note.textContent = 'Sent. Thank you!'; letter.reset(); return; }   // bots fill the hidden field; drop quietly
      if (!endpoint) {
        var body = 'Hello Talha,\n\n' + (d.message ? d.message + '\n\n' : '') + (d.name ? d.name + '\n' : '') + (d.email ? d.email + '\n' : '');
        note.textContent = 'Opening your email app. If nothing opens, copy the address instead.';
        fly();
        var go = 'mailto:talhakhalidraja692@gmail.com?subject=' + encodeURIComponent('Hello from your portfolio') + '&body=' + encodeURIComponent(body);
        setTimeout(function () { window.location.href = go; }, root.classList.contains('dl-anim') ? 1300 : 0);
        return;
      }
      if (letter.getAttribute('data-busy')) return;
      letter.setAttribute('data-busy', '1'); sendBtn.disabled = true; note.textContent = 'Sending…';
      var subject = 'Postcard from ' + (d.name || 'a visitor') + (d.org ? ', ' + d.org : '') + (d.topic ? ' (' + d.topic + ')' : '');
      var req;
      if (/formsubmit\.co/.test(endpoint)) {
        var payload = { name: d.name || '(no name)', from: d.org || '-', topic: d.topic || '-', message: d.message || '-', page: d.page,
          _subject: subject, _template: 'table', _captcha: 'false' };
        if (d.email) { payload.email = d.email; payload._replyto = d.email; }
        req = fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload) });
      } else {
        req = fetch(endpoint, { method: 'POST', body: JSON.stringify(d) });   // Google Apps Script (Code.gs)
      }
      req.then(function (r) { return r.json().catch(function () { return { ok: r.ok }; }); })
        .then(function (res) {
          var ok = res && (res.ok === true || res.success === true || res.success === 'true');
          if (!ok) throw new Error((res && res.message) || 'not sent');
          note.textContent = 'Sent! Thank you' + (d.email ? ', I will write back soon.' : '.');
          letter.reset(); fly();
        })
        .catch(function (err) {
          // nothing is lost: the same postcard can go from the visitor's own email app
          var body = 'Hello Talha,\n\n' + (d.topic ? 'About: ' + d.topic + '\n\n' : '') + (d.message ? d.message + '\n\n' : '') + (d.name ? d.name + (d.org ? ', ' + d.org : '') + '\n' : '');
          var a = document.createElement('a');
          a.href = 'mailto:talhakhalidraja692@gmail.com?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
          a.textContent = 'send it from your email app';
          var setup = /activat/i.test((err && err.message) || '');
          var preview = /claude|anthropic/i.test(location.hostname);
          note.textContent = setup ? 'The postbox is not switched on yet. For now you can '
            : preview ? 'This preview cannot post cards (the live site can). For now you can '
            : 'It could not be sent from here. You can ';
          note.appendChild(a); note.appendChild(document.createTextNode(' instead; your words are already in it.'));
        })
        .then(function () { letter.removeAttribute('data-busy'); sendBtn.disabled = false; });
    }, true);
  }

  // doodled notes on the boiling chart; figures.js redraws the chart on resize, so they are put back each time
  var bsvg = document.getElementById('boil-svg'), bstore = document.querySelector('.dl-bn-store');
  if (bsvg && bstore) {
    var placeNotes = function () {
      if (bsvg.querySelector('.dl-chart-notes')) return;
      var narrowChart = (bsvg.getAttribute('viewBox') || '').indexOf('0 0 380') === 0;
      if (narrowChart) return;  // on a phone the reading under the chart says the same, larger
      var src = bstore.querySelector('[data-n="w"]');
      if (src) bsvg.insertBefore(src.cloneNode(true), bsvg.querySelector('#boil-guide'));
    };
    placeNotes();
    if ('MutationObserver' in window) new MutationObserver(placeNotes).observe(bsvg, { childList: true });
  }

  // city notes: a pin or a place in the list opens a small card of tidbits
  var cityBox = document.getElementById('dl-city'), mapBox = document.getElementById('map-box'), cityData = null;
  try { cityData = JSON.parse((document.getElementById('dl-cities') || {}).textContent || 'null'); } catch (e) { cityData = null; }
  if (cityBox && mapBox && cityData) {
    var lastFrom = null, cur = '';
    var closeCity = function (back) {
      cityBox.hidden = true; mapBox.classList.remove('dl-note-open'); cur = '';
      [].forEach.call(document.querySelectorAll('.sites li.dl-picked'), function (li) { li.classList.remove('dl-picked'); });
      if (back && lastFrom && lastFrom.focus) lastFrom.focus({ preventScroll: true });
    };
    var openCity = function (id, from) {
      var c = cityData[id]; if (!c) return;
      lastFrom = from || null; cur = id;
      cityBox.innerHTML = '';
      var x = document.createElement('button'); x.type = 'button'; x.className = 'dl-city-x'; x.setAttribute('aria-label', 'Close notes'); x.textContent = '×';
      x.addEventListener('click', function (e) { e.stopPropagation(); closeCity(true); });
      var head = document.createElement('div'); head.className = 'dl-city-head';
      var art = document.createElement('span'); art.className = 'dl-city-art'; art.setAttribute('aria-hidden', 'true'); art.innerHTML = c.art;
      var tt = document.createElement('div');
      var h4 = document.createElement('h4'); h4.textContent = c.t;
      var sub = document.createElement('div'); sub.className = 'dl-city-sub'; sub.textContent = c.s;
      tt.appendChild(h4); tt.appendChild(sub); head.appendChild(art); head.appendChild(tt);
      var ul = document.createElement('ul');
      c.b.forEach(function (line) { var li = document.createElement('li'); li.textContent = line; ul.appendChild(li); });
      cityBox.appendChild(x); cityBox.appendChild(head); cityBox.appendChild(ul);
      cityBox.setAttribute('aria-label', 'Notes about ' + c.t);
      var pin = document.querySelector('.map-pin[data-site="' + id + '"]'), side = 'left';
      if (pin) { var pr = pin.getBoundingClientRect(), mr = mapBox.getBoundingClientRect(); if (pr.left + pr.width / 2 < mr.left + mr.width / 2) side = 'right'; }
      cityBox.setAttribute('data-side', side);
      cityBox.hidden = false; mapBox.classList.add('dl-note-open');
      var svgArt = art.querySelector('svg'); if (svgArt) svgArt.classList.add('is-drawn');
      [].forEach.call(document.querySelectorAll('.sites li'), function (li) { li.classList.toggle('dl-picked', li.getAttribute('data-site') === id); });
    };
    cityBox.addEventListener('click', function (e) { e.stopPropagation(); });
    // while a note is open, a tap on the map just closes it (it does not zoom)
    mapBox.addEventListener('click', function (e) {
      if (cityBox.hidden || cityBox.contains(e.target) || e.target.closest('.map-pin')) return;
      e.stopPropagation(); e.preventDefault(); closeCity();
    }, true);
    document.addEventListener('click', function (e) {
      if (cityBox.hidden || cityBox.contains(e.target) || e.target.closest('.map-pin, .sites li')) return;
      closeCity();
    });
    [].forEach.call(document.querySelectorAll('input[name="map-view"]'), function (r) { r.addEventListener('change', function () { closeCity(); }); });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { if (!es[0].isIntersecting) closeCity(); }).observe(mapBox);
    [].forEach.call(document.querySelectorAll('.map-pin'), function (pin) {
      var id = pin.getAttribute('data-site');
      pin.addEventListener('click', function (e) { e.stopPropagation(); if (cur === id) closeCity(); else openCity(id, pin); });
      pin.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCity(id, pin); } });
    });
    [].forEach.call(document.querySelectorAll('.sites li[data-site]'), function (li) {
      var id = li.getAttribute('data-site');
      var go = function () {
        openCity(id, li);
        var r = mapBox.getBoundingClientRect();
        if (r.bottom < 60 || r.top > window.innerHeight - 120) mapBox.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
      };
      li.addEventListener('click', go);
      li.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !cityBox.hidden) closeCity(true); });
  }

  // bubbles rise from the headline's full stop
  var sb = document.querySelector('.dl-stopbub-wrap'), stmtEl = document.querySelector('.research-top .statement');
  if (sb && stmtEl) stmtEl.appendChild(sb);

  // cooling drawings: tap a label for a short note about it
  var hotData = null;
  try { hotData = JSON.parse((document.getElementById('dl-hot-data') || {}).textContent || 'null'); } catch (e) { hotData = null; }
  if (hotData) {
    var tipc = document.createElement('div'); tipc.className = 'dl-tipc'; tipc.hidden = true; tipc.setAttribute('role', 'status');
    var tipOwner = null;
    var hideTipc = function () { tipc.hidden = true; if (tipOwner) tipOwner.classList.remove('is-on'); tipOwner = null; };
    var showTipc = function (g) {
      var k = g.getAttribute('data-k'), d = hotData[k], fig = g.closest('.dl-ex'); if (!d || !fig) return;
      if (tipOwner === g && !tipc.hidden) { hideTipc(); return; }
      if (tipOwner) tipOwner.classList.remove('is-on');
      tipOwner = g; g.classList.add('is-on');
      tipc.innerHTML = '<b></b><span></span>'; tipc.firstChild.textContent = d[0]; tipc.lastChild.textContent = d[1];
      fig.appendChild(tipc); tipc.hidden = false;
      var fr = fig.getBoundingClientRect(), gr = g.getBoundingClientRect(), w = Math.min(280, fr.width - 24);
      tipc.style.width = w + 'px';
      var x = Math.max(12, Math.min(fr.width - w - 12, gr.left + gr.width / 2 - fr.left - w / 2));
      var y = gr.bottom - fr.top + 8;
      if (y + tipc.offsetHeight > fr.height - 8) y = gr.top - fr.top - tipc.offsetHeight - 8;
      tipc.style.left = x + 'px'; tipc.style.top = Math.max(8, y) + 'px';
    };
    [].forEach.call(document.querySelectorAll('.dl-hot'), function (g) {
      g.addEventListener('click', function (e) { e.stopPropagation(); showTipc(g); });
      g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showTipc(g); } });
    });
    document.addEventListener('click', function (e) { if (!tipc.hidden && !tipc.contains(e.target)) hideTipc(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !tipc.hidden) hideTipc(); });
    [].forEach.call(document.querySelectorAll('.dl-switch button'), function (b) { b.addEventListener('click', hideTipc); });
  }

  // postcard topics fill the hidden topic field
  var topicField = document.getElementById('l-topic');
  [].forEach.call(document.querySelectorAll('.dl-pc-topics input'), function (r) {
    r.addEventListener('change', function () {
      if (!r.checked || !topicField) return;
      topicField.value = r.value;
      if (r.value === 'something else') { var m = document.getElementById('l-msg'); if (m) m.focus(); }
    });
  });
  var pcForm = document.getElementById('letter');
  if (pcForm) pcForm.addEventListener('reset', function () { if (topicField) setTimeout(function () { topicField.value = ''; }, 0); });

  // sketch mode: diagrams get a wobbly pen and hand lettering; labels grow a little to suit the handwriting
  var SKETCH = '#chan-svg, #loop-svg, .loops-svg, #tex-svg, #ss-svg, #boil-svg, .tile-cover svg:not(.doodle), .tile-art svg:not(.doodle)';
  var bump = function (svgEl) {
    [].forEach.call(svgEl.querySelectorAll('text:not(.dl-t)'), function (t) {
      if (t.getAttribute('data-dlfs')) return;
      var fs = parseFloat(getComputedStyle(t).fontSize) || 0;
      if (fs) { t.style.fontSize = (fs * 1.2).toFixed(1) + 'px'; t.setAttribute('data-dlfs', '1'); }
    });
  };
  [].forEach.call(document.querySelectorAll(SKETCH), function (svgEl) {
    svgEl.classList.add('dl-sketch');
    bump(svgEl);
    if ('MutationObserver' in window) new MutationObserver(function () { bump(svgEl); }).observe(svgEl, { childList: true, subtree: true });
  });

  if (reduce || !canWatch) {
    // still pictures: bubbles parked part-way along their paths
    smil.forEach(function (s) { s.pauseAnimations(); try { s.setCurrentTime(1.1); } catch (e) {} });
    return;
  }
  root.classList.add('dl-anim');

  var seen = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-drawn');
      seen.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -10% 0px' });

  var live = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      var on = e.isIntersecting;
      e.target.classList.toggle('dl-off', !on);
      if (typeof e.target.pauseAnimations === 'function' && e.target.classList.contains('dl-smil')) {
        if (on) e.target.unpauseAnimations(); else e.target.pauseAnimations();
      }
    });
  });

  [].forEach.call(document.querySelectorAll('.dl-draw, .dl-ur'), function (el) {
    if (el.closest('.sheet-src, dialog')) { el.classList.add('is-drawn'); return; }
    seen.observe(el);
  });
  [].forEach.call(document.querySelectorAll('.dl-loop'), function (el) { live.observe(el); });

  // pop-up panels: their doodles draw themselves in each time a panel opens
  var dlg = document.getElementById('sheet'), slot = document.getElementById('sheet-slot');
  if (dlg && slot && 'MutationObserver' in window) {
    var pending = 0;
    var redraw = function () {
      pending = 0;
      if (!dlg.open) return;
      [].forEach.call(slot.querySelectorAll('.dl-draw'), function (el) {
        el.classList.remove('is-drawn'); void el.getBoundingClientRect(); el.classList.add('is-drawn');
      });
    };
    var soon = function () { if (!pending) pending = requestAnimationFrame(redraw); };
    new MutationObserver(soon).observe(slot, { childList: true });
    new MutationObserver(soon).observe(dlg, { attributes: true, attributeFilter: ['open'] });
  }

  window.addEventListener('resize', function () {
    [].forEach.call(document.querySelectorAll('.dl-draw:not(.is-drawn), .dl-ur:not(.is-drawn)'), function (el) {
      if (el.getBoundingClientRect().width) { seen.unobserve(el); seen.observe(el); }
    });
  });
})();
