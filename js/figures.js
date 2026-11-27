/* The interactive figures. Each one is a sketch that explains an idea;
   none of them shows solver output or measured data, and the captions
   say so. Every figure draws a still frame when motion is reduced. */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var NS = 'http://www.w3.org/2000/svg';
  var mk = function (tag, attrs) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); return e; };

  /* one shared clock; a figure only runs while it is on screen */
  var jobs = [];
  function animate(el, fn) {
    var job = { fn: fn, on: !('IntersectionObserver' in window), page: !el.closest('.sheet-src') };
    if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { job.on = e[0].isIntersecting; }, { rootMargin: '80px' }).observe(el);
    jobs.push(job);
  }
  var last = 0;
  function tick(now) {
    var dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016); last = now;
    var covered = document.documentElement.classList.contains('sheet-lock') || !!document.querySelector('#lightbox[open]');
    if (!document.hidden) for (var i = 0; i < jobs.length; i++) if (jobs[i].on && !(covered && jobs[i].page)) jobs[i].fn(now / 1000, dt);
    requestAnimationFrame(tick);
  }
  function fitCanvas(cv) {
    var r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    var w = Math.max(1, r.width), h = Math.max(1, r.height);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    var c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { c: c, w: w, h: h };
  }

  /* ===================== Fig: two loops carry the heat out ==================== */
  (function loops() {
    var svg = $('#loops'), title = $('#loops-title'), text = $('#loops-text');
    if (!svg || !title) return;
    var INFO = {
      rack: ['Chips and cold plates', 'A cold plate sits on each processor and the coolant passes through it. In a single-phase loop it leaves as warmer liquid; in a two-phase loop part of it leaves as vapour. In the twins I have studied, this end is one fixed thermal resistance.'],
      tcs: ['Technology loop (TCS)', 'The technology cooling system is the closed loop inside the hall. It carries treated coolant from the CDU to the rack manifolds and cold plates, and back again.'],
      cdu: ['Coolant distribution unit (CDU)', 'The CDU holds the pumps and the heat exchanger that keeps the two loops apart. Heat crosses from the technology loop to the facility loop here, and the fluids never mix. In a two-phase loop this is usually where the vapour condenses.'],
      fws: ['Facility loop (FWS)', 'The facility water system takes the heat from the CDU and carries it out of the hall to the plant.'],
      reject: ['Heat rejection', 'Chillers, cooling towers or dry coolers pass the heat to the outdoor air. Warm return water can also go to heat reuse.']
    };
    var rest = [title.textContent, text.textContent], parts = Array.prototype.slice.call(svg.querySelectorAll('.lp'));
    function show(el) {
      parts.forEach(function (p) { p.classList.toggle('is-on', p === el); });
      var d = el ? INFO[el.dataset.part] : rest;
      title.textContent = d[0]; text.textContent = d[1];
    }
    parts.forEach(function (el) {
      el.addEventListener('pointerenter', function () { show(el); });
      el.addEventListener('focus', function () { show(el); });
      el.addEventListener('click', function () { show(el); });
    });
    svg.addEventListener('pointerleave', function () { if (!svg.contains(document.activeElement)) show(null); });
    var dots = [];
    [['lp-tcs-r', 'w', 4], ['lp-tcs-s', 'c', 4], ['lp-fws-r', 'w', 4], ['lp-fws-s', 'c', 4], ['lpv-tcs-r', 'w', 3], ['lpv-tcs-s', 'c', 3], ['lpv-fws-r', 'w', 3], ['lpv-fws-s', 'c', 3]].forEach(function (d) {
      var p = document.getElementById(d[0]); if (!p || !p.getTotalLength) return;
      var g = p.ownerSVGElement.querySelector('.lp-dots'), L = 0;
      for (var j = 0; j < d[2]; j++) { var c = mk('circle', { r: 6.5, 'class': 'lp-dot-' + d[1] }); g.appendChild(c); dots.push({ c: c, p: p, L: L, o: j / d[2] }); }
    });
    /* only the drawing that is on screen (wide or tall) is measured and moved */
    var place = function (t) {
      dots.forEach(function (d) {
        try {
          if (!d.p.ownerSVGElement.getClientRects().length) return;
          if (!d.L) d.L = d.p.getTotalLength();
          var pt = d.p.getPointAtLength(((t * 0.16 + d.o) % 1) * d.L);
          d.c.setAttribute('cx', pt.x.toFixed(1)); d.c.setAttribute('cy', pt.y.toFixed(1));
        } catch (e) { /* not laid out yet */ }
      });
    };
    place(0.9);
    if (!reduce) animate(svg, place); else window.addEventListener('resize', function () { place(0.9); });
  })();

  /* ============ Fig: single-phase and two-phase direct-to-chip plates ========= */
  (function boil() {
    var svg = $('#boil-svg'), cv1 = $('#plate-1'), cv2 = $('#plate-2'), input = $('#boil-q');
    if (!svg || !cv1 || !cv2 || !input) return;
    var XO = 0.25, K = 0.5, XMAX = 1.15, YMAX = 1.3;
    var fixed = function (x) { return x; };
    var real = function (x) {
      if (x <= XO) return x;
      if (x <= 1) return XO + K * (Math.cbrt(x) - Math.cbrt(XO));
      return XO + K * (1 - Math.cbrt(XO)) + (x - 1) * 9;
    };
    /* the chart redraws in a narrower, taller frame on phones, so its lettering stays readable */
    var L = 58, R = 500, T = 26, B = 322, narrow = null;
    var px = function (x) { return L + (R - L) * x / XMAX; };
    var py = function (y) { return B - (B - T) * Math.min(y, YMAX) / YMAX; };
    function build() {
      var n = (svg.getBoundingClientRect().width || 520) < 440;
      if (n === narrow) return false;
      narrow = n;
      var W = n ? 380 : 520, H = n ? 360 : 380;
      L = n ? 44 : 58; R = W - (n ? 14 : 20); T = n ? 30 : 26; B = H - (n ? 64 : 58);
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      var d = '', i, x;
      for (i = 0; i <= 100; i++) { x = i / 100; d += (i ? 'L' : 'M') + px(x).toFixed(1) + ' ' + py(real(x)).toFixed(1); }
      var xTop = 1 + (YMAX - real(1)) / 9;
      var chf = n ? '<text class="c-text" x="' + R + '" y="' + (B + 22) + '" text-anchor="end">critical heat flux</text>'
                  : '<text class="c-text" x="' + px(1) + '" y="' + (B + 20) + '" text-anchor="middle">critical heat flux</text>';
      svg.innerHTML =
        '<line class="c-grid" x1="' + px(XO) + '" y1="' + T + '" x2="' + px(XO) + '" y2="' + B + '"/>' +
        '<line class="c-grid" x1="' + px(1) + '" y1="' + T + '" x2="' + px(1) + '" y2="' + B + '"/>' +
        '<path class="c-axis" d="M' + L + ' ' + T + 'V' + B + 'H' + R + '"/>' +
        '<text class="c-text" x="' + px(XO) + '" y="' + (B + (n ? 22 : 20)) + '" text-anchor="middle">onset of boiling</text>' + chf +
        '<text class="c-text-strong" x="' + R + '" y="' + (B + (n ? 52 : 46)) + '" text-anchor="end">Chip heat flux</text>' +
        '<text class="c-text-strong" transform="translate(' + (n ? 16 : 20) + ' ' + T + ') rotate(-90)" text-anchor="end">Wall temperature rise</text>' +
        '<path class="c-fixed" d="M' + px(0) + ' ' + py(0) + 'L' + px(XMAX) + ' ' + py(fixed(XMAX)) + '"/>' +
        '<path class="c-real" d="' + d + '"/>' +
        '<path class="c-real-hot" d="M' + px(1) + ' ' + py(real(1)) + 'L' + px(xTop).toFixed(1) + ' ' + py(YMAX) + '"/>' +
        '<path class="c-real-hot" d="M' + (px(xTop) - 7).toFixed(1) + ' ' + (py(YMAX) + 10) + 'L' + px(xTop).toFixed(1) + ' ' + py(YMAX) + 'l8 7"/>' +
        '<line class="c-fixed" x1="' + (L + 14) + '" y1="' + (T + 12) + '" x2="' + (L + 48) + '" y2="' + (T + 12) + '"/>' +
        '<text class="c-text" x="' + (L + 56) + '" y="' + (T + 16) + '">' + (n ? 'Fixed resistance' : 'Fixed resistance: single-phase plate, and today’s twins') + '</text>' +
        '<line class="c-real" x1="' + (L + 14) + '" y1="' + (T + 34) + '" x2="' + (L + 48) + '" y2="' + (T + 34) + '"/>' +
        '<text class="c-text" x="' + (L + 56) + '" y="' + (T + 38) + '">' + (n ? 'Two-phase plate' : 'Two-phase plate, as it really behaves') + '</text>' +
        '<line class="c-guide" id="boil-guide" y1="' + T + '" y2="' + B + '"/>' +
        '<line class="c-gap" id="boil-gap"/>' +
        '<circle class="c-dot-fixed" id="boil-df" r="6"/>' +
        '<circle class="c-dot" id="boil-dr" r="7"/>' +
        '<text class="c-text-strong" id="boil-note" text-anchor="end"></text>';
      return true;
    }
    build();

    var regime = $('#boil-regime'), text = $('#boil-text'), out = $('#boil-out');
    var m1 = $('#meter-1'), m2 = $('#meter-2');
    var COPY = [
      ['Both plates are still all liquid', 'The coolant just warms up as it passes over the chip, so the wall temperature climbs in a straight line.', 'Gets this right. A fixed resistance is a fair model here, and today’s twins handle it well.'],
      ['The two-phase plate is boiling', 'Bubbles form on the hot wall and carry heat away as the coolant turns to vapour, so the wall temperature barely climbs.', 'Still draws a straight line, so it guesses too hot. That errs on the safe side, but a controller trusting it would cool harder than it needs to.'],
      ['Close to the limit', 'Bubbles are crowding the wall and the margin to critical heat flux is almost gone.', 'Still shows a comfortable straight line and gives no warning.'],
      ['Past critical heat flux', 'A film of vapour covers the wall and cuts it off from the liquid, so the chip temperature shoots up.', 'Misses this completely. A twin used for control has to know where this limit is.']
    ];
    var STATE = ['just warm', 'stays cool', 'close to the limit', 'too hot!'];
    var q = 0.58;
    function update() {
      q = parseFloat(input.value) / 100;
      var yf = fixed(q), yr = real(q), X = px(q);
      $('#boil-guide').setAttribute('x1', X); $('#boil-guide').setAttribute('x2', X);
      $('#boil-df').setAttribute('cx', X); $('#boil-df').setAttribute('cy', py(yf));
      $('#boil-dr').setAttribute('cx', X); $('#boil-dr').setAttribute('cy', py(yr));
      var gap = $('#boil-gap');
      gap.setAttribute('x1', X); gap.setAttribute('x2', X); gap.setAttribute('y1', py(yf)); gap.setAttribute('y2', py(yr));
      var note = $('#boil-note'), diff = yr - yf;
      var words = Math.abs(diff) < 0.02 ? '' : (diff < 0 ? 'guesses too hot' : 'misses the dry-out');
      var nx = X < L + (R - L) * 0.45 ? X + 12 : X - 12, ny = (py(yf) + py(yr)) / 2 + 5;
      note.setAttribute('text-anchor', X < L + (R - L) * 0.45 ? 'start' : 'end');
      if (ny < T + 70) ny = Math.max(py(yf), py(yr)) + 26;
      note.setAttribute('x', nx); note.setAttribute('y', ny);
      note.textContent = '';
      if (words && narrow) {
        /* on a phone the note goes on two short lines */
        var t1 = document.createElementNS(NS, 'tspan'), t2 = document.createElementNS(NS, 'tspan');
        t1.setAttribute('x', nx); t1.setAttribute('dy', '-0.55em'); t1.textContent = 'fixed resistance';
        t2.setAttribute('x', nx); t2.setAttribute('dy', '1.15em'); t2.textContent = words;
        note.appendChild(t1); note.appendChild(t2);
      } else if (words) note.textContent = 'fixed resistance ' + words;
      var k = q <= XO ? 0 : q <= 0.88 ? 1 : q <= 1 ? 2 : 3;
      regime.textContent = COPY[k][0]; text.textContent = COPY[k][1]; var tw = $('#boil-twin'); if (tw) tw.textContent = COPY[k][2]; var rd = $('#boil-read'); if (rd) rd.setAttribute('data-k', k);
      out.textContent = k === 0 ? 'Warmer liquid out' : 'Liquid and vapour out';
      input.setAttribute('aria-valuetext', COPY[k][0]);
      if (m1) { m1.querySelector('i').style.width = (Math.min(yf / YMAX, 1) * 100).toFixed(1) + '%'; m1.querySelector('b').textContent = q <= 0.3 ? 'just warm' : q <= 0.65 ? 'warm' : q <= 0.98 ? 'hot' : 'very hot'; }
      if (m2) { m2.querySelector('i').style.width = (Math.min(yr / YMAX, 1) * 100).toFixed(1) + '%'; m2.querySelector('b').textContent = STATE[k]; m2.classList.toggle('is-over', k === 3); }
    }
    input.addEventListener('input', function () { update(); if (reduce) still(); });
    window.addEventListener('resize', function () { if (build()) update(); });

    /* one cold plate, drawn by hand in section along the flow. mode 1: liquid only, mode 2: boiling allowed.
       Bubbles grow on nucleation sites on the hot wall, lift off, drift with the flow and merge into
       slugs downstream; past the critical heat flux a vapour film covers the wall. Schematic, not data. */
    function Plate(cv, mode) {
      this.cv = cv; this.mode = mode; this.free = []; this.up = []; this.dash = []; this.rnd = [];
      for (var n = 0; n < 16; n++) this.dash.push({ x: Math.random(), y: 0.15 + Math.random() * 0.7, v: 0.75 + Math.random() * 0.5 });
      for (var r = 0; r < 600; r++) this.rnd.push(Math.random() * 2 - 1);
      this.sites = [];
      for (var s = 0; s < 15; s++) this.sites.push({ u: (s + 0.5 + (Math.random() - 0.5) * 0.7) / 15, on: Math.random(), r: 0, wait: Math.random() * 0.4, rd: 1 });
    }
    var mix = function (a, b, t) { return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * t) + ',' + Math.round(a[1] + (b[1] - a[1]) * t) + ',' + Math.round(a[2] + (b[2] - a[2]) * t) + ')'; };
    Plate.prototype.step = function (tt, dt) {
      var g = fitCanvas(this.cv), c = g.c, w = g.w, h = g.h, mode = this.mode, rnd = this.rnd, k = 0;
      var night = document.documentElement.dataset.mode === 'night';
      var INK = night ? '#efe7df' : '#1b1614', PAPER = night ? '#211c1a' : '#fffaf2';
      var COLD = night ? [43, 74, 96] : [191, 224, 243], WARM = night ? [112, 60, 34] : [248, 196, 156];
      var BLUE = night ? '#7cc0ef' : '#1f6fb2', HOT = night ? '#ff8a5c' : '#c2410c', RED = night ? '#ff6b5e' : '#c0321f';
      var R = function () { k = (k + 1) % rnd.length; return rnd[k]; };
      function ln(x1, y1, x2, y2, passes) {
        var dx = x2 - x1, dy = y2 - y1, L = Math.sqrt(dx * dx + dy * dy) || 1, nx = -dy / L, ny = dx / L, bow = Math.min(2, L * 0.01);
        for (var p = 0; p < (passes || 2); p++) {
          var mb = R() * bow;
          c.moveTo(x1 + R() * 0.7, y1 + R() * 0.7);
          c.quadraticCurveTo((x1 + x2) / 2 + nx * mb, (y1 + y2) / 2 + ny * mb, x2 + R() * 0.7, y2 + R() * 0.7);
        }
      }
      function box(x, y, bw, bh, col, lw) { c.strokeStyle = col || INK; c.lineWidth = lw || 1.6; c.beginPath(); ln(x, y, x + bw, y); ln(x + bw, y, x + bw, y + bh); ln(x + bw, y + bh, x, y + bh); ln(x, y + bh, x, y); c.stroke(); }
      function hatch(x, y, bw, bh, gap, col, lw) {
        c.save(); c.beginPath(); c.rect(x, y, bw, bh); c.clip();
        c.strokeStyle = col; c.lineWidth = lw || 1.2; c.beginPath();
        for (var t = -bh; t < bw; t += gap) ln(x + t, y + bh, x + t + bh, y, 1);
        c.stroke(); c.restore();
      }
      var fs = clamp(Math.round(h * 0.115), 17, 21);
      var x0 = w * 0.03, x1 = w * 0.97, pw = Math.max(14, w * 0.045);
      var pTop = fs + 8, yT = h * 0.45, lid = h * 0.065, yB = h * 0.69, base = h * 0.07;
      var cx0 = w * 0.3, cx1 = w * 0.7, yC = yB + base + 3, chH = Math.min(h * 0.15, h - yC - 3);
      var heatK = clamp(q / 1.05, 0, 1), I = clamp((q - XO) / (1 - XO), 0, 1), dry = mode === 2 && q > 1;
      var kk = q <= XO ? 0 : q <= 0.88 ? 1 : q <= 1 ? 2 : 3;
      var inX = x0 + w * 0.025, outX = x1 - w * 0.025 - pw;
      c.clearRect(0, 0, w, h);
      c.lineCap = 'round'; c.lineJoin = 'round';

      /* the chip, glowing as the heat flux rises */
      c.fillStyle = night ? '#4a403b' : '#3b3431'; c.fillRect(cx0, yC, cx1 - cx0, chH);
      hatch(cx0, yC, cx1 - cx0, chH, 5, dry ? '#ff3b2f' : mix([122, 111, 104], [234, 90, 28], heatK), 1.6);
      box(cx0, yC, cx1 - cx0, chH, INK, 1.8);
      c.strokeStyle = '#9aa7b3'; c.lineWidth = 2; c.beginPath(); ln(cx0 - 4, yC - 1.5, cx1 + 4, yC - 1.5, 1); c.stroke();
      /* copper base */
      c.fillStyle = dry ? (night ? '#5a2018' : '#f8c3b3') : (night ? '#3a2416' : '#f6d3b5'); c.fillRect(x0, yB, x1 - x0, base);
      hatch(x0, yB, x1 - x0, base, 6, dry ? '#e2603a' : '#d9823f', 1.3);
      box(x0, yB, x1 - x0, base, INK, 1.7);

      /* the coolant: it warms along the plate; much less so when it can boil */
      var outT = mode === 1 ? heatK : heatK * 0.22;
      var liq = c.createLinearGradient(x0, 0, x1, 0);
      liq.addColorStop(0, mix(COLD, COLD, 0)); liq.addColorStop(0.28, mix(COLD, COLD, 0)); liq.addColorStop(1, mix(COLD, WARM, outT));
      c.fillStyle = liq; c.fillRect(x0, yT, x1 - x0, yB - yT);
      /* a warm layer grows from the hot wall while the coolant is all liquid */
      if (mode === 1 || kk === 0) {
        var lay = c.createLinearGradient(0, yB, 0, yT);
        lay.addColorStop(0, 'rgba(' + WARM.join(',') + ',' + (0.35 + 0.55 * heatK).toFixed(2) + ')'); lay.addColorStop(1, 'rgba(' + WARM.join(',') + ',0)');
        c.fillStyle = lay; c.beginPath(); c.moveTo(cx0 - 10, yB);
        for (var xx = cx0 - 10; xx <= x1; xx += 8) { var f = clamp((xx - cx0 + 10) / (x1 - cx0), 0, 1); c.lineTo(xx, yB - (yB - yT) * (0.12 + 0.6 * Math.pow(f, 0.6)) * (0.25 + 0.75 * heatK)); }
        c.lineTo(x1, yB); c.closePath(); c.fill();
        /* heat rising off the wall */
        c.strokeStyle = HOT; c.lineWidth = 1.6; c.globalAlpha = 0.35 + 0.5 * heatK; c.beginPath();
        for (var s3 = 0; s3 < 3; s3++) {
          var hx = cx0 + (cx1 - cx0) * (0.22 + 0.28 * s3), top = yB - (yB - yT) * (0.3 + 0.4 * heatK);
          for (var yy = yB - 2; yy >= top; yy -= 2) { var px = hx + 3 * Math.sin(yy * 0.35 + tt * 6 + s3); if (yy === yB - 2) c.moveTo(px, yy); else c.lineTo(px, yy); }
        }
        c.stroke(); c.globalAlpha = 1;
      }
      /* flow marks */
      var U = (x1 - x0) * 0.2;
      c.strokeStyle = INK; c.globalAlpha = 0.28; c.lineWidth = 1.4; c.beginPath();
      this.dash.forEach(function (d) {
        d.x += d.v * dt * 0.2; if (d.x > 1) { d.x = 0; d.y = 0.15 + Math.random() * 0.7; }
        var sx = x0 + d.x * (x1 - x0), sy = yT + d.y * (yB - yT);
        c.moveTo(sx, sy); c.quadraticCurveTo(sx + 5, sy - 2, sx + 11, sy);
      });
      c.stroke(); c.globalAlpha = 1;

      if (mode === 2) {
        var H = yB - yT, free = this.free, up = this.up, sites = this.sites;
        var bubFill = night ? 'rgba(239,231,223,.82)' : 'rgba(255,255,255,.92)', bubLine = night ? 'rgba(239,231,223,.95)' : 'rgba(27,22,20,.75)';
        /* nucleation sites: more of them wake up, and they fire faster, as the flux rises */
        if (q > XO && !dry) sites.forEach(function (st) {
          if (st.on > 0.2 + 0.8 * I) { st.r = 0; return; }
          if (st.wait > 0) { st.wait -= dt; return; }
          if (!st.r) { st.r = 0.6; st.rd = (2.6 + 3.4 * I) * (0.8 + 0.4 * Math.random()); }
          st.r += dt * (5 + 16 * I);
          if (st.r >= st.rd) {
            free.push({ x: cx0 - 14 + st.u * (cx1 - cx0 + 34), y: yB - st.r, r: st.r, vy: 0 });
            st.r = 0; st.wait = (0.45 - 0.35 * I) * (0.6 + 0.8 * Math.random());
          }
        });
        /* past the limit the film itself sheds big blobs of vapour */
        if (dry && Math.random() < dt * 5) free.push({ x: cx0 + Math.random() * (cx1 - cx0), y: yB - 9, r: 4 + 5 * Math.random(), vy: 0 });
        /* free bubbles drift with the flow, rise, grow a little and merge */
        for (var i = free.length - 1; i >= 0; i--) {
          var o = free[i];
          o.vy = Math.min(o.vy + dt * 50, 26); o.y -= o.vy * dt; o.x += U * (1.05 + 0.3 * (yB - o.y) / H) * dt;
          o.r = Math.min(o.r + dt * 0.8 * I, H * 2.2);
          var ry = Math.min(o.r, H * 0.42), rx = o.r * o.r / ry;
          if (o.y < yT + ry + 1) o.y = yT + ry + 1;
          if (o.y > yB - ry - 1) o.y = yB - ry - 1;
          o.rx = rx; o.ry = ry;
          if (o.x - rx > outX + pw * 0.5) { free.splice(i, 1); continue; }
          if (o.x > outX && o.x < outX + pw && up.length < 30 && Math.random() < 0.06) up.push({ x: outX + pw * (0.3 + 0.4 * Math.random()), y: yT - 2, r: Math.min(pw * 0.32, 1.5 + o.r * 0.3) });
        }
        for (var a = 0; a < free.length; a++) for (var b = a + 1; b < free.length; b++) {
          var A = free[a], B = free[b], ddx = A.x - B.x, ddy = A.y - B.y, lim = (A.rx + B.rx) * 0.55;
          if (ddx * ddx + ddy * ddy < lim * lim) {
            var aa = A.r * A.r, bb = B.r * B.r;
            A.x = (A.x * aa + B.x * bb) / (aa + bb); A.y = (A.y * aa + B.y * bb) / (aa + bb); A.r = Math.sqrt(aa + bb);
            A.ry = Math.min(A.r, H * 0.42); A.rx = A.r * A.r / A.ry; free.splice(b, 1); b--;
          }
        }
        if (free.length > 140) free.splice(0, free.length - 140);
        c.fillStyle = bubFill; c.strokeStyle = bubLine; c.lineWidth = 1.2;
        sites.forEach(function (st) { if (st.r > 0.8) { c.beginPath(); c.arc(cx0 - 14 + st.u * (cx1 - cx0 + 34), yB - st.r, st.r, 0, Math.PI * 2); c.fill(); c.stroke(); } });
        free.forEach(function (o) { c.beginPath(); c.ellipse(o.x, o.y, o.rx, o.ry, 0, 0, Math.PI * 2); c.fill(); c.stroke(); });
        /* close to the limit, dry patches flicker on the wall; past it, a vapour film covers it */
        if (q > 0.9) {
          var fa = clamp((q - 0.9) / 0.12, 0, 1);
          c.fillStyle = bubFill; c.strokeStyle = bubLine; c.lineWidth = 1.3; c.beginPath(); c.moveTo(cx0 - 8, yB);
          for (var fx = cx0 - 8; fx <= x1; fx += 5) {
            var patch = dry ? 1 : Math.max(0, Math.sin(fx * 0.05 + tt * 3)) * fa;
            c.lineTo(fx, yB - (dry ? 5 + 6 * fa : 1 + 6 * patch) - (dry ? 2.2 * Math.sin(fx * 0.09 + tt * 5) : 0));
          }
          c.lineTo(x1, yB); c.closePath(); c.fill(); c.stroke();
        }
        /* vapour going up the outlet */
        for (var u2 = up.length - 1; u2 >= 0; u2--) { var v = up[u2]; v.y -= dt * 46; if (v.y < pTop + 2) up.splice(u2, 1); }
        this.upDraw = up;
      }

      /* lid and ports */
      c.fillStyle = night ? '#3a3f44' : '#e8ebee'; c.fillRect(x0, yT - lid, x1 - x0, lid);
      hatch(x0, yT - lid, x1 - x0, lid, 7, '#9aa7b3', 1.1);
      c.fillStyle = mix(COLD, COLD, 0); c.fillRect(inX, pTop, pw, yT - pTop + 1);
      c.fillStyle = mix(COLD, WARM, outT); c.fillRect(outX, pTop, pw, yT - pTop + 1);
      if (this.upDraw) { c.fillStyle = mode === 2 && night ? 'rgba(239,231,223,.82)' : 'rgba(255,255,255,.92)'; c.strokeStyle = night ? 'rgba(239,231,223,.95)' : 'rgba(27,22,20,.7)'; c.lineWidth = 1; this.upDraw.forEach(function (v) { c.beginPath(); c.arc(v.x, v.y, v.r, 0, Math.PI * 2); c.fill(); c.stroke(); }); }
      c.strokeStyle = INK; c.lineWidth = 1.8; c.beginPath();
      ln(x0, yT - lid, inX, yT - lid); ln(inX + pw, yT - lid, outX, yT - lid); ln(outX + pw, yT - lid, x1, yT - lid);
      ln(inX, pTop, inX, yT - lid); ln(inX + pw, pTop, inX + pw, yT - lid); ln(outX, pTop, outX, yT - lid); ln(outX + pw, pTop, outX + pw, yT - lid);
      ln(inX, yT, inX + pw, yT, 1); ln(outX, yT, outX + pw, yT, 1);
      ln(x0, yT - lid, x0, yB + base); ln(x1, yT - lid, x1, yB + base);
      ln(x0, yT, inX, yT); ln(inX + pw, yT, outX, yT); ln(outX + pw, yT, x1, yT);
      c.stroke();
      /* arrows in the ports */
      c.strokeStyle = INK; c.lineWidth = 1.8; c.beginPath();
      var ax = inX + pw / 2, bx = outX + pw / 2, ay = pTop + 6, al = Math.min(14, yT - lid - pTop - 10);
      c.moveTo(ax, ay); c.lineTo(ax, ay + al); c.moveTo(ax - 4, ay + al - 4); c.lineTo(ax, ay + al); c.lineTo(ax + 4, ay + al - 4);
      c.moveTo(bx, ay + al); c.lineTo(bx, ay); c.moveTo(bx - 4, ay + 4); c.lineTo(bx, ay); c.lineTo(bx + 4, ay + 4);
      c.stroke();

      /* a little thermometer in the outlet: it climbs with the heat when the coolant only warms up,
         and barely moves once the coolant boils (boiling happens at an almost steady temperature) */
      var tgt = mode === 1 ? 0.1 + 0.84 * heatK : 0.1 + 0.84 * Math.min(heatK, 0.26) + 0.05 * Math.max(0, heatK - 0.26);
      this.lvl = this.lvl == null ? tgt : this.lvl + (tgt - this.lvl) * Math.min(1, dt * 4);
      var sayW = 0, sayTxt = mode === 1 ? (q < 0.12 ? 'liquid warms up a little' : 'the liquid warms up as it goes') : ['no bubbles yet, just warming', 'bubbles carry the heat away', 'bubbles crowd the hot wall', 'vapour film: the wall overheats!'][kk];
      c.font = '700 ' + (fs - 1) + 'px Caveat, "Segoe Print", cursive'; sayW = c.measureText(sayTxt).width;
      var thx = outX - Math.max(15, w * 0.03), thT = pTop + 5, thB = yT - lid - 9, tubeW = 5, bulbR = 5.2;
      if (thB - thT > 24 && (inX + pw + outX) / 2 + sayW / 2 + 10 < thx - bulbR) {
        var tubeTop = thT, tubeBot = thB - bulbR + 1, lvlY = tubeBot - (tubeBot - tubeTop - 2) * clamp(this.lvl, 0, 1);
        c.fillStyle = PAPER; c.fillRect(thx - tubeW / 2, tubeTop, tubeW, tubeBot - tubeTop);
        c.fillStyle = RED; c.fillRect(thx - tubeW / 2 + 1.2, lvlY, tubeW - 2.4, tubeBot - lvlY + 1);
        c.beginPath(); c.arc(thx, thB, bulbR, 0, Math.PI * 2); c.fill();
        c.strokeStyle = INK; c.lineWidth = 1.4; c.beginPath();
        ln(thx - tubeW / 2, tubeBot, thx - tubeW / 2, tubeTop + 2, 1); ln(thx + tubeW / 2, tubeBot, thx + tubeW / 2, tubeTop + 2, 1);
        c.moveTo(thx + tubeW / 2, tubeTop + 2); c.arc(thx, tubeTop + 2, tubeW / 2, 0, Math.PI, true);
        c.stroke();
        c.beginPath(); c.arc(thx, thB, bulbR, -Math.PI * 0.35, Math.PI * 1.35); c.stroke();
        c.lineWidth = 1; c.beginPath();
        for (var tk = 1; tk <= 3; tk++) { var ty = tubeBot - (tubeBot - tubeTop) * tk / 4; c.moveTo(thx - tubeW / 2 - 4, ty); c.lineTo(thx - tubeW / 2 - 1, ty); }
        c.stroke();
      }

      /* words, by hand */
      c.font = '700 ' + fs + 'px Caveat, "Segoe Print", "Comic Sans MS", cursive'; c.textBaseline = 'alphabetic';
      c.textAlign = 'left'; c.fillStyle = BLUE; c.fillText('cool liquid in', inX - 2, fs + 2);
      c.textAlign = 'right'; c.fillStyle = mode === 2 && kk > 0 ? INK : HOT;
      c.fillText(mode === 2 && kk > 0 ? 'liquid + vapour out' : 'warm liquid out', outX + pw + 2, fs + 2);
      /* the chip's name on a little paper tag, so it reads on the hatching */
      var cf = Math.max(14, Math.min(fs - 1, chH * 1.05)), ct = dry ? 'chip, too hot!' : 'chip';
      c.font = '700 ' + cf + 'px Caveat, "Segoe Print", cursive'; c.textAlign = 'center';
      var tw2 = c.measureText(ct).width + 12, tcx = (cx0 + cx1) / 2, tcy = yC + chH / 2;
      c.fillStyle = PAPER; c.fillRect(tcx - tw2 / 2, tcy - cf * 0.55, tw2, cf * 1.1);
      c.strokeStyle = INK; c.lineWidth = 1.2; c.strokeRect(tcx - tw2 / 2, tcy - cf * 0.55, tw2, cf * 1.1);
      c.fillStyle = dry ? RED : INK; c.textBaseline = 'middle'; c.fillText(ct, tcx, tcy + 1); c.textBaseline = 'alphabetic';
      var say = sayTxt;
      c.font = '700 ' + (fs - 1) + 'px Caveat, "Segoe Print", cursive';
      c.fillStyle = mode === 2 && kk === 3 ? RED : INK; c.globalAlpha = mode === 2 && kk === 3 ? 1 : 0.78;
      c.fillText(say, (inX + pw + outX) / 2, yT - lid - 7);
      c.globalAlpha = 1;
    };
    var plates = [new Plate(cv1, 1), new Plate(cv2, 2)];
    function still() { for (var n = 0; n < 90; n++) plates.forEach(function (p) { p.step(n / 30, 1 / 30); }); }
    update();
    if (reduce) { still(); window.addEventListener('resize', still); window.addEventListener('themechange', still); if (document.fonts && document.fonts.load) document.fonts.load('700 16px Caveat').then(still, function () {}); }
    else plates.forEach(function (p) { animate(p.cv, function (tt, dt) { p.step(tt, dt); }); });
  })();

  /* ====================== Fig: the loop a twin closes ====================== */
  (function loop() {
    var g = $('#loop-dots'), a = $('#loop-a'), b = $('#loop-b');
    if (!g || !a || !a.getTotalLength) return;
    var dots = [];
    [a, b].forEach(function (p, i) {
      for (var j = 0; j < 4; j++) { var c = mk('circle', { r: 4, 'class': i ? 'loop-dot-b' : 'loop-dot-a' }); g.appendChild(c); dots.push({ c: c, p: p, L: p.getTotalLength(), o: j / 4 }); }
    });
    var place = function (t) { dots.forEach(function (d) { var pt = d.p.getPointAtLength(((t * 0.26 + d.o) % 1) * d.L); d.c.setAttribute('cx', pt.x.toFixed(1)); d.c.setAttribute('cy', pt.y.toFixed(1)); }); };
    place(0.4);
    if (!reduce) animate($('#loop-svg'), place);
  })();

  /* ================== Fig: flags in a wake, and the 36 cases ================= */
  (function flags() {
    var cv = $('#vortex'), grid = $('#cases'), read = $('#cases-read');
    if (!cv) return;
    var g1 = 3, g2 = 2;                       /* indices 0..5 into the six gap values */
    var val = function (i) { return 0.25 + i * 0.25; };
    var W = 0, H = 0, R = 1, cx = 0, cy = 0, U = 60, LEN = 1;
    var vort = [], parts = [], t = 0, sign = 1, next = 0, sized = '';
    var trail = document.createElement('canvas'), tc = trail.getContext('2d');
    var spawn = function (p, anywhere) { p.x = anywhere ? Math.random() * W : Math.random() * W * 0.06; p.y = Math.random() * H; p.px = p.x; p.py = p.y; p.life = 0; return p; };
    function layout(c) {
      var g = fitCanvas(cv);
      if (sized === g.w + 'x' + g.h) return g;
      sized = g.w + 'x' + g.h; W = g.w; H = g.h;
      trail.width = cv.width; trail.height = cv.height; tc.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
      R = H * 0.1; cx = Math.max(R * 2.2, W * 0.1); cy = H * 0.5; U = Math.max(50, W * 0.075);
      LEN = Math.min(R * 2.5, (W - cx - R - 12) / 5);
      vort = []; parts = []; for (var i = 0; i < Math.round(W * 0.4); i++) parts.push(spawn({}, true));
      return g;
    }
    function vel(x, y) {
      var dx = x - cx, dy = y - cy, r2 = dx * dx + dy * dy, a2 = R * R, u = U, v = 0;
      if (r2 > a2) { u = U * (1 - a2 * (dx * dx - dy * dy) / (r2 * r2)); v = -U * 2 * a2 * dx * dy / (r2 * r2); }
      for (var i = 0; i < vort.length; i++) { var k = vort[i], ex = x - k.x, ey = y - k.y, d = ex * ex + ey * ey + k.c; u += -k.g * ey / d; v += k.g * ex / d; }
      return [u, v];
    }
    function step(now, dt) {
      var g = layout(), c = g.c;
      t += dt;
      if (t > next) { vort.push({ x: cx + R * 1.5, y: cy + sign * R * 0.5, g: -sign * U * R * 1.7, c: R * R * 0.6 }); sign *= -1; next = t + (2 * R / U) * 2.3; }
      vort.forEach(function (k) { k.x += U * 0.8 * dt; });
      vort = vort.filter(function (k) { return k.x < W + R * 4; });
      parts.forEach(function (p) {
        var uv = vel(p.x, p.y); p.px = p.x; p.py = p.y; p.x += uv[0] * dt; p.y += uv[1] * dt; p.life += dt;
        var dx = p.x - cx, dy = p.y - cy;
        if (p.x > W || p.y < 0 || p.y > H || dx * dx + dy * dy < R * R || p.life > 12) spawn(p, false);
      });
      tc.globalCompositeOperation = 'destination-out'; tc.fillStyle = 'rgba(0,0,0,0.08)'; tc.fillRect(0, 0, W, H);
      tc.globalCompositeOperation = 'source-over'; tc.strokeStyle = 'rgba(255,224,204,0.55)'; tc.lineWidth = 1.1; tc.beginPath();
      parts.forEach(function (p) { if (p.life === 0) return; tc.moveTo(p.px, p.py); tc.lineTo(p.x, p.y); });
      tc.stroke();
      c.clearRect(0, 0, W, H); c.drawImage(trail, 0, 0, W, H);
      c.fillStyle = '#f5efe9'; c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fill();
      var x1 = cx + R + val(g1) * LEN, x2 = x1 + LEN + val(g2) * LEN;
      [x1, x2].forEach(function (x0, i) {
        c.strokeStyle = '#ff7a45'; c.lineWidth = 2.6; c.lineCap = 'round'; c.beginPath();
        for (var s = 0; s <= LEN + 0.01; s += LEN / 24) { var a = R * 0.6 * (s / LEN) * (s / LEN), y = cy + a * Math.sin(t * 5 - (s / LEN) * 4 - i * 1.3); if (s === 0) c.moveTo(x0 + s, y); else c.lineTo(x0 + s, y); }
        c.stroke(); c.fillStyle = '#ff7a45'; c.beginPath(); c.arc(x0, cy, 3.2, 0, Math.PI * 2); c.fill();
      });
      /* gap dimensions */
      c.strokeStyle = 'rgba(245,239,233,.5)'; c.lineWidth = 1; c.setLineDash([3, 4]);
      var yd = cy + R * 2.1;
      [[cx + R, x1], [x1 + LEN, x2]].forEach(function (s2) { c.beginPath(); c.moveTo(s2[0], yd - 5); c.lineTo(s2[0], yd + 5); c.moveTo(s2[0], yd); c.lineTo(s2[1], yd); c.moveTo(s2[1], yd - 5); c.lineTo(s2[1], yd + 5); c.stroke(); });
      c.setLineDash([]);
    }
    function still() { sized = ''; for (var i = 0; i < 520; i++) step(0, 1 / 60); }

    if (grid) {
      var cells = [];
      for (var r = 5; r >= 0; r--) for (var q = 0; q < 6; q++) {
        var b = document.createElement('button');
        b.type = 'button'; b.setAttribute('role', 'gridcell'); b.dataset.a = String(q); b.dataset.b = String(r);
        b.setAttribute('aria-label', 'Body-to-flag gap level ' + (q + 1) + ' of 6, flag-to-flag gap level ' + (r + 1) + ' of 6');
        grid.appendChild(b); cells.push(b);
      }
      var select = function (a, b2, focus) {
        g1 = clamp(a, 0, 5); g2 = clamp(b2, 0, 5);
        cells.forEach(function (el) {
          var on = +el.dataset.a === g1 && +el.dataset.b === g2;
          el.setAttribute('aria-selected', String(on)); el.tabIndex = on ? 0 : -1;
          if (on && focus) el.focus();
        });
        if (read) read.textContent = 'Case ' + (g2 * 6 + g1 + 1) + ' of 36. Body-to-flag gap at step ' + (g1 + 1) + ' of 6, flag-to-flag gap at step ' + (g2 + 1) + ' of 6.';
        if (reduce) still();
      };
      grid.addEventListener('click', function (e) { var el = e.target.closest('button'); if (el) select(+el.dataset.a, +el.dataset.b, false); });
      grid.addEventListener('keydown', function (e) {
        var m = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
        if (!m) return; e.preventDefault(); select(g1 + m[0], g2 + m[1], true);
      });
      select(g1, g2, false);
    }
    if (reduce) { still(); window.addEventListener('resize', still); } else animate(cv, step);
  })();

  /* ====================== Fig: cells sorting in a channel ==================== */
  (function channel() {
    var svg = $('#chan-svg'), g = $('#chan-cells'), flow = $('#chan-flow');
    var paths = [$('#chan-p0'), $('#chan-p1')];
    if (!svg || !g || !paths[0] || !paths[0].getTotalLength) return;
    var lens = paths.map(function (p) { return p.getTotalLength(); }), cells = [];
    for (var j = 0; j < 16; j++) {
      var wbc = j % 3 === 0, c = mk('g', {});
      if (wbc) { c.appendChild(mk('circle', { r: 4.8, 'class': 'chan-wbc' })); c.appendChild(mk('circle', { r: 1.8, cx: 0.8, cy: -0.6, 'class': 'chan-wbc-n' })); }
      else c.appendChild(mk('circle', { r: 3.3, fill: 'url(#rbc)' }));
      g.appendChild(c);
      cells.push({ c: c, p: paths[wbc ? 0 : 1], L: lens[wbc ? 0 : 1], o: j / 16, side: wbc ? -1 : 1, jit: (Math.random() - 0.5) * 2 });
    }
    var place = function (t) {
      if (flow) flow.style.strokeDashoffset = String(-(t * 26) % 16);
      cells.forEach(function (d) {
        var u = (t * 0.06 + d.o) % 1, s = u * d.L;
        var a = d.p.getPointAtLength(s), b = d.p.getPointAtLength(Math.min(d.L, s + 1));
        var nx = -(b.y - a.y), ny = b.x - a.x, m = Math.hypot(nx, ny) || 1; nx /= m; ny /= m;
        var k = Math.min(1, u * 1.6), off = d.side * k * 3.6 + d.jit * (1 - k);
        d.c.setAttribute('transform', 'translate(' + (a.x + nx * off).toFixed(2) + ' ' + (a.y + ny * off).toFixed(2) + ')');
      });
    };
    place(3.3);
    if (!reduce) animate(svg, place);
  })();

  /* ======================== Fig: textured raceway ============================ */
  (function texture() {
    var grid = $('#tex-grid'), roll = $('#tex-roll'), range = $('#tex-range');
    if (!grid || !range) return;
    var names = ['Circular', 'Elliptical', 'Triangular'], kind = 0;
    var X0 = 262, Y0 = 44, WW = 358, HH = 150, COLS = 9, ROWS = 4, cw = WW / COLS, chh = HH / ROWS, A = cw * chh;
    function build() {
      var rho = parseFloat(range.value) / 100;
      while (grid.firstChild) grid.removeChild(grid.firstChild);
      for (var r = 0; r < ROWS; r++) for (var c = -1; c < COLS; c++) {
        var x = X0 + (c + 0.5 + (r % 2 ? 0.5 : 0)) * cw, y = Y0 + (r + 0.5) * chh, e;
        if (kind === 0) e = mk('circle', { cx: x, cy: y, r: Math.sqrt(rho * A / Math.PI).toFixed(2) });
        else if (kind === 1) { var bb = Math.sqrt(rho * A / (2 * Math.PI)); e = mk('ellipse', { cx: x, cy: y, rx: (2 * bb).toFixed(2), ry: bb.toFixed(2) }); }
        else { var s = Math.sqrt(4 * rho * A / Math.sqrt(3)), hh = s / Math.sqrt(3); e = mk('polygon', { points: x + ',' + (y - hh).toFixed(2) + ' ' + (x + s / 2).toFixed(2) + ',' + (y + hh / 2).toFixed(2) + ' ' + (x - s / 2).toFixed(2) + ',' + (y + hh / 2).toFixed(2) }); }
        e.setAttribute('fill', 'url(#pit)'); e.setAttribute('stroke', '#5d6673'); e.setAttribute('stroke-width', '0.6');
        grid.appendChild(e);
      }
      $('#tex-shape').textContent = names[kind];
      $('#tex-dens').textContent = 'Area density ' + range.value + '%';
      $('#tex-out').textContent = range.value + '%';
    }
    range.addEventListener('input', build);
    Array.prototype.forEach.call(document.querySelectorAll('input[name="tex-kind"]'), function (el) {
      el.addEventListener('change', function () { kind = +el.value; build(); });
    });
    build();
    if (roll) { roll.setAttribute('x', '420'); if (!reduce) animate($('#tex-svg'), function (t) { roll.setAttribute('x', String(200 + ((t * 70) % 480))); }); }
  })();

  /* ====================== Fig: the stress-strain model ======================= */
  (function stress() {
    var svg = $('#ss-svg');
    if (!svg) return;
    var ids = ['e', 'y', 'c', 't'], inp = {}, out = {};
    ids.forEach(function (k) { inp[k] = $('#ss-' + k); out[k] = $('#ss-' + k + '-o'); });
    if (!inp.e) return;
    var L = 60, R = 504, T = 34, B = 254, EMAX = 0.05;
    /* the rules of the original script */
    function curve(E, Y, C, Tc) {
      var fT = Math.max(0.3, 1 - 0.0005 * Math.max(0, Tc - 25));
      var Ee = E * 1000 * fT, Ye = Y * fT * (1 + 0.02 * Math.max(0, C - 1)), ey = Ye / Ee;
      return { ey: ey, Ye: Ye, end: Ye + 0.05 * Ee * (EMAX - ey) };
    }
    function draw() {
      var E = +inp.e.value, Y = +inp.y.value, C = +inp.c.value, Tc = +inp.t.value;
      out.e.textContent = E + ' GPa'; out.y.textContent = Y + ' MPa'; out.c.textContent = C + ' °C/s'; out.t.textContent = Tc + ' °C';
      var a = curve(E, Y, C, Tc), ref = curve(E, Y, 1, 25);
      var top = Math.max(a.end, ref.end), smax = top <= 500 ? 500 : top <= 1000 ? 1000 : top <= 1500 ? 1500 : 2000;
      var px = function (e) { return L + (R - L) * e / EMAX; }, py = function (s) { return B - (B - T) * s / smax; };
      var h = '';
      for (var i = 0; i <= 5; i++) {
        var s = smax * i / 5, e = EMAX * i / 5;
        h += '<line class="c-grid" x1="' + L + '" x2="' + R + '" y1="' + py(s) + '" y2="' + py(s) + '"/>';
        h += '<text class="c-text" x="' + (L - 8) + '" y="' + (py(s) + 4) + '" text-anchor="end">' + s + '</text>';
        h += '<text class="c-text" x="' + px(e) + '" y="' + (B + 18) + '" text-anchor="middle">' + (e * 100).toFixed(0) + '</text>';
      }
      var path = function (c) { return 'M' + px(0) + ' ' + py(0) + 'L' + px(c.ey).toFixed(1) + ' ' + py(c.Ye).toFixed(1) + 'L' + px(EMAX) + ' ' + py(c.end).toFixed(1); };
      h += '<path class="c-axis" d="M' + L + ' ' + T + 'V' + B + 'H' + R + '"/>';
      h += '<text class="c-text-strong" x="' + R + '" y="' + (B + 40) + '" text-anchor="end">Strain, %</text>';
      h += '<text class="c-text-strong" x="8" y="18">Stress, MPa</text>';
      h += '<path class="c-ref" d="' + path(ref) + '"/><path class="c-real" d="' + path(a) + '"/>';
      h += '<circle class="c-dot" r="6" cx="' + px(a.ey).toFixed(1) + '" cy="' + py(a.Ye).toFixed(1) + '"/>';
      h += '<text class="c-text-strong" x="' + (px(a.ey) + 12).toFixed(1) + '" y="' + (py(a.Ye) + 20).toFixed(1) + '">yield ' + Math.round(a.Ye) + ' MPa</text>';
      svg.innerHTML = h;
    }
    ids.forEach(function (k) { inp[k].addEventListener('input', draw); });
    draw();
  })();

  /* ============ Experience: the line is a thermometer, hot to cold ============ */
  (function thermo() {
    var root = $('.thermo'); if (!root) return;
    var boil = $('.thermo-boil', root), ice = $('.thermo-ice', root), bead = $('.thermo-bead', root), tubeEl = $('.thermo-tube', root);
    var STOPS = [[0, 224, 67, 47], [0.12, 234, 90, 28], [0.34, 246, 165, 68], [0.52, 243, 227, 194], [0.68, 191, 224, 243], [0.84, 111, 187, 234], [1, 63, 159, 219]];
    var col = function (v) {
      var a = STOPS[0], b = STOPS[STOPS.length - 1];
      for (var k = 0; k < STOPS.length - 1; k++) if (v >= STOPS[k][0] && v <= STOPS[k + 1][0]) { a = STOPS[k]; b = STOPS[k + 1]; break; }
      var u = (v - a[0]) / ((b[0] - a[0]) || 1);
      return 'rgb(' + Math.round(a[1] + (b[1] - a[1]) * u) + ',' + Math.round(a[2] + (b[2] - a[2]) * u) + ',' + Math.round(a[3] + (b[3] - a[3]) * u) + ')';
    };
    /* a bead rides the tube as the page scrolls and takes the colour of where it is;
       the job it passes lights up, and the bead can be dragged, tapped or stepped with the keys */
    var roles = Array.prototype.slice.call(document.querySelectorAll('.roles > .role'));
    var hit = $('.thermo-hit', root), glow = $('.thermo-glow', root), read = $('.thermo-read', root);
    var pending = false, near = null, best = null, drag = null, settling = 0, heat = { on: false, y: 0 };
    var dotY = function (r) { return r.getBoundingClientRect().top + 55.5; };
    var label = function (r) {
      var org = r.querySelector('.org'), h = r.querySelector('h3'), when = r.querySelector('.role-meta p');
      var name = org ? org.textContent.replace(/\s*\(.*\)$/, '') : (h ? h.textContent : '');
      var date = when ? when.innerHTML.split(/<br\s*\/?>/i)[0].replace(/<[^>]+>/g, '').trim() : '';
      return name.trim() + (date ? ' · ' + date : '');
    };
    var paint = function () {
      pending = false;
      var r = root.getBoundingClientRect(), b = bead.getBoundingClientRect(), by = b.top + b.height / 2;
      bead.style.background = col(clamp((by - r.top) / Math.max(1, r.height), 0, 1));
      var bd = 1e9; best = null;
      roles.forEach(function (ro) { var d = Math.abs(dotY(ro) - by); if (d < bd) { bd = d; best = ro; } });
      var act = bd < 64 ? best : null;
      if (act !== near) {
        if (near) near.classList.remove('is-near');
        if (act) { act.style.setProperty('--dot-c', col(clamp((dotY(act) - r.top) / Math.max(1, r.height), 0, 1))); act.classList.add('is-near'); }
        near = act;
      }
      if (best) read.textContent = label(best);
    };
    var queue = function () { if (!pending) { pending = true; requestAnimationFrame(paint); } };
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    paint();

    /* bring a job's dot to the bead */
    function goTo(ro) {
      if (!ro) return;
      var bh = bead.offsetHeight, rr = root.getBoundingClientRect();
      var target = window.scrollY + dotY(ro) - (window.innerHeight * 0.46 + bh / 2);
      bead.style.position = 'absolute'; bead.style.left = '0'; bead.style.top = (dotY(ro) - rr.top - bh / 2) + 'px';
      clearTimeout(settling);
      window.scrollTo({ top: target, behavior: reduce ? 'auto' : 'smooth' });
      settling = setTimeout(function () {
        /* hand the bead back to the page without animating the jump in its position rules */
        bead.style.transition = 'none';
        bead.style.position = ''; bead.style.top = ''; bead.style.left = '';
        void bead.offsetWidth; bead.style.transition = '';
        paint();
      }, reduce ? 30 : 750);
    }
    function place(cy) {
      var rr = root.getBoundingClientRect(), bh = bead.offsetHeight;
      var y = clamp(cy - rr.top, bh / 2, rr.height - 30);
      bead.style.position = 'absolute'; bead.style.left = '0'; bead.style.top = (y - bh / 2) + 'px';
      paint();
    }
    bead.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      clearTimeout(settling);
      drag = { id: e.pointerId, y0: e.clientY, moved: false };
      try { bead.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
      root.classList.add('is-drag'); bead.classList.add('was-used');
      e.preventDefault();
    });
    bead.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      if (!drag.moved && Math.abs(e.clientY - drag.y0) < 4) return;
      drag.moved = true;
      /* near the top or bottom of the screen the page follows */
      if (e.clientY < 90) window.scrollBy({ top: -16, behavior: 'instant' });
      else if (e.clientY > window.innerHeight - 90) window.scrollBy({ top: 16, behavior: 'instant' });
      place(e.clientY);
    });
    var release = function (e) {
      if (!drag || (e && e.pointerId !== drag.id)) return;
      var d = drag; drag = null; root.classList.remove('is-drag');
      if (d.moved) { goTo(best); bead._dragged = true; setTimeout(function () { bead._dragged = false; }, 50); }
    };
    bead.addEventListener('pointerup', release);
    bead.addEventListener('pointercancel', release);
    /* a tap or Enter opens the job the bead is on */
    bead.addEventListener('click', function () {
      if (bead._dragged) return;
      bead.classList.add('was-used');
      var ro = near || best, a = ro && ro.querySelector('.tile-hit');
      if (a) a.click();
    });
    bead.addEventListener('keydown', function (e) {
      var i = roles.indexOf(near || best), k = -1;
      if (e.key === 'ArrowDown') k = Math.min(roles.length - 1, i + 1);
      else if (e.key === 'ArrowUp') k = Math.max(0, i - 1);
      else if (e.key === 'Home') k = 0;
      else if (e.key === 'End') k = roles.length - 1;
      if (k < 0) return;
      e.preventDefault(); bead.classList.add('was-used'); goTo(roles[k]);
    });
    /* point along the tube to warm it; click to send the bead there */
    hit.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      var rr = root.getBoundingClientRect();
      heat.on = true; heat.y = e.clientY;
      glow.style.setProperty('--gy', (e.clientY - rr.top) + 'px');
      glow.style.setProperty('--gc', col(clamp((e.clientY - rr.top) / rr.height, 0, 1)));
      root.classList.add('is-heat');
    });
    hit.addEventListener('pointerleave', function () { heat.on = false; root.classList.remove('is-heat'); });
    hit.addEventListener('click', function (e) {
      var bd = 1e9, pick = null;
      roles.forEach(function (ro) { var d = Math.abs(dotY(ro) - e.clientY); if (d < bd) { bd = d; pick = ro; } });
      bead.classList.add('was-used'); goTo(pick);
    });
    var night = function () { return document.documentElement.dataset.mode === 'night'; };

    /* top: vapour bubbles rise in the tube and leave it as steam */
    var bub = [], TOPPAD = 34;
    function stepBoil(tt, dt) {
      var g = fitCanvas(boil), c = g.c, w = g.w, h = g.h, cx = w / 2, half = Math.max(2.5, tubeEl.offsetWidth / 2 - 1.5);
      var want = Math.round(h / 8);
      while (bub.length < want) {
        var u = Math.random();
        bub.push({ y: TOPPAD + u * u * (h - TOPPAD), x: (Math.random() - 0.5) * 2, r: 1.1 + Math.random() * (half * 0.58), v: 24 + Math.random() * 48, ph: Math.random() * 6.3, out: false, a: 1 });
      }
      if (heat.on) {
        var hy = heat.y - boil.getBoundingClientRect().top;
        if (hy > TOPPAD && hy < h) for (var q = 0; q < 2; q++) bub.push({ y: hy + (Math.random() - 0.5) * 12, x: (Math.random() - 0.5) * 2, r: 1.6 + Math.random() * (half * 0.75), v: 70 + Math.random() * 80, ph: Math.random() * 6.3, out: false, a: 1 });
      }
      if (bub.length > want * 3) bub.splice(0, bub.length - want * 3);
      c.clearRect(0, 0, w, h);
      var steam = night() ? '255,255,255' : '224,67,47';
      for (var i = bub.length - 1; i >= 0; i--) {
        var o = bub[i];
        o.y -= o.v * dt;
        if (!o.out && o.y < TOPPAD + 4) { o.out = true; }
        if (o.out) { o.r += dt * 8; o.a -= dt * 0.6; o.x += Math.sin(tt * 2 + o.ph) * dt * 1.4; if (o.a <= 0 || o.y < 0) { bub.splice(i, 1); continue; } }
        var x = cx + (o.out ? o.x * (half + 6) : (o.x * 0.6 + 0.25 * Math.sin(tt * 3 + o.ph)) * half);
        var fade = o.out ? o.a * 0.55 : clamp(1.15 - (o.y - TOPPAD) / (h - TOPPAD), 0, 1);
        c.beginPath(); c.arc(x, o.y, o.r, 0, Math.PI * 2);
        if (o.out) { c.strokeStyle = 'rgba(' + steam + ',' + fade.toFixed(2) + ')'; c.lineWidth = 1.2; c.stroke(); }
        else { c.fillStyle = 'rgba(255,255,255,' + (0.5 * fade).toFixed(2) + ')'; c.fill(); c.strokeStyle = 'rgba(255,255,255,' + (0.95 * fade).toFixed(2) + ')'; c.lineWidth = 1; c.stroke(); }
      }
    }

    /* bottom: frost crystals gather round the cold end */
    var flakes = null, snow = [];
    function stepIce(tt, dt) {
      var g = fitCanvas(ice), c = g.c, w = g.w, h = g.h, cx = w / 2, half = tubeEl.offsetWidth / 2, k = clamp(w / 56, 0.6, 1);
      if (!flakes || flakes.key !== w + 'x' + h) {
        flakes = []; flakes.key = w + 'x' + h; snow = [];
        var n = Math.round(h / (w < 40 ? 26 : 15));
        for (var i = 0; i < n; i++) {
          var u = Math.pow(Math.random(), 1.7), side = i % 2 ? 1 : -1;
          flakes.push({ y: h - 46 - u * (h - 70), x: cx + side * (half + 5 * k + Math.random() * (w / 2 - half - 10 * k)), r: (4 + Math.random() * 6) * k, ph: Math.random() * 6.3, sp: 0.5 + Math.random() * 1.1, rot: Math.random() * 1.05 });
        }
        for (var j = 0; j < Math.round(n * 1.3); j++) snow.push({ y: Math.random() * h, x: Math.random(), v: 7 + Math.random() * 14 });
      }
      c.clearRect(0, 0, w, h);
      var rgb = night() ? '168,216,245' : '63,159,219';
      c.lineCap = 'round';
      var my = heat.on ? heat.y - ice.getBoundingClientRect().top : -1e4;
      flakes.forEach(function (f) {
        f.melt = clamp((f.melt || 0) + (Math.abs(f.y - my) < 46 ? dt * 2.4 : -dt * 0.35), 0, 1);
        var depth = f.y / h, a = (0.3 + 0.7 * (0.5 + 0.5 * Math.sin(tt * f.sp + f.ph))) * (0.25 + 0.75 * depth) * (1 - f.melt);
        if (a < 0.02) return;
        c.strokeStyle = 'rgba(' + rgb + ',' + a.toFixed(2) + ')'; c.lineWidth = Math.max(0.9, 1.15 * k);
        c.beginPath();
        for (var m = 0; m < 6; m++) {
          var an = f.rot + tt * 0.06 + m * Math.PI / 3, ca = Math.cos(an), sa = Math.sin(an);
          c.moveTo(f.x, f.y); c.lineTo(f.x + ca * f.r, f.y + sa * f.r);
          var bx = f.x + ca * f.r * 0.58, by = f.y + sa * f.r * 0.58, br = f.r * 0.34;
          c.moveTo(bx, by); c.lineTo(bx + Math.cos(an + 1.05) * br, by + Math.sin(an + 1.05) * br);
          c.moveTo(bx, by); c.lineTo(bx + Math.cos(an - 1.05) * br, by + Math.sin(an - 1.05) * br);
        }
        c.stroke();
      });
      c.fillStyle = 'rgba(' + rgb + ',.55)';
      snow.forEach(function (s) {
        s.y += s.v * dt; if (s.y > h - 30) s.y = h * 0.15 * Math.random();
        var x = s.x * w + Math.sin(tt * 0.8 + s.x * 9) * 2;
        if (Math.abs(x - cx) < half + 2) return;
        var a2 = clamp(s.y / h, 0, 1); c.globalAlpha = a2 * 0.7; c.fillRect(x, s.y, 1.4, 1.4);
      });
      c.globalAlpha = 1;
    }
    if (reduce) {
      var still = function () { flakes = null; for (var n = 0; n < 40; n++) stepBoil(n / 10, 0.1); stepIce(1.2, 0); };
      still(); window.addEventListener('resize', still);
    } else { animate(boil, stepBoil); animate(ice, stepIce); }
  })();

  /* ===== Current studies: flow past a cylinder, drawn with dye, that the visitor can move and stir =====
     A point-vortex sketch: potential flow round a cylinder, plus vortices shed alternately from its
     top and bottom at the Strouhal frequency from Roshko's fit. Below Re 47 the wake holds two
     attached vortices and nothing is shed. Not a CFD solution, and the note under the controls says so. */
  (function flow() {
    var cv = $('#studies-flow'), sec = $('#studies'), ui = $('#flow-ui');
    if (!cv || !cv.getContext || !sec || !ui) return;
    var gripBody = $('#flow-body'), pin1 = $('#flow-pin-1'), pin2 = $('#flow-pin-2');
    var reIn = $('#flow-re'), reOut = $('#flow-re-out'), read = $('#flow-read'), pauseBtn = $('#flow-pause');
    var modeBtns = Array.prototype.slice.call(ui.querySelectorAll('[data-mode]'));
    ui.hidden = false; gripBody.hidden = false;

    /* the dye builds up on the section's own canvas; the flags go on a thin layer above it */
    var top = document.createElement('canvas'); top.className = 'studies-flow studies-flow-top'; top.setAttribute('aria-hidden', 'true');
    cv.parentNode.insertBefore(top, cv.nextSibling);
    var tc = cv.getContext('2d'), oc = top.getContext('2d'), trail = cv, topDirty = false;
    var W = 0, H = 0, sized = '', R = 24, D = 48, U = 90, t = 0, grad = {};
    function fit(el, ctx) {
      var r = el.getBoundingClientRect(), dpr = Math.min(1.25, window.devicePixelRatio || 1), w = Math.max(1, r.width), h = Math.max(1, r.height);
      if (el.width !== Math.round(w * dpr) || el.height !== Math.round(h * dpr)) { el.width = Math.round(w * dpr); el.height = Math.round(h * dpr); }
      ctx.setTransform(el.width / w, 0, 0, el.height / h, 0, 0);
      return { w: w, h: h };
    }
    var body = { x: 0, y: 0, fx: 0.56, fy: 0.3 };          /* fx, fy: where the visitor left it, as fractions */
    var mode = 'street', Re = 150, paused = false, moved = false;
    var vort = [], free = [], dye = [], phase = 0, side = 1, steady = [];
    var GAPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5], gap1 = 3, gap2 = 3;   /* indices into the study's six values */
    var flags = [mkFlag(), mkFlag()];
    var ptr = { x: -1e4, y: -1e4, vx: 0, vy: 0, on: false, t: 0 };
    var COL = {
      day: { free: 'rgba(86,160,214,0.42)', top: '#ea5a1c', bot: '#f2a03c', puff: ['#4aa8e0', '#ea5a1c', '#f2a03c'], body: '#1b1614', rim: 'rgba(255,255,255,0.5)', flag: '#1b1614' },
      night: { free: 'rgba(120,170,210,0.22)', top: '#ff7a45', bot: '#ffb347', puff: ['#7cc4f0', '#ff7a45', '#ffb347'], body: '#f5efe9', rim: 'rgba(0,0,0,0.4)', flag: '#f5efe9' }
    };
    var night = function () { return document.documentElement.dataset.mode === 'night'; };
    function mkFlag() { var n = 18, f = { n: n, y: [], v: [], x0: 0, y0: 0, len: 0 }; for (var i = 0; i < n; i++) { f.y.push(0); f.v.push(0); } return f; }

    /* ---------------------------------- physics ---------------------------------- */
    function St() { return Math.max(0.12, 0.198 * (1 - 19.7 / Re)); }
    function addV(px, py, out) {
      /* uniform stream plus the cylinder's doublet */
      var x = px - body.x, y = py - body.y, r2 = x * x + y * y, a2 = R * R, u = U, v = 0;
      if (r2 > 1) { var r4 = r2 * r2; u = U * (1 - a2 * (x * x - y * y) / r4); v = -U * 2 * a2 * x * y / r4; }
      var list = vort.concat(steady);
      for (var k = 0; k < list.length; k++) {
        var q = list[k];
        u += vel(px, py, q.x, q.y, q.g, q.rc, 0); v += vel(px, py, q.x, q.y, q.g, q.rc, 1);
        /* its image inside the cylinder keeps the flow from passing through the wall */
        var dx = q.x - body.x, dy = q.y - body.y, d2 = dx * dx + dy * dy;
        if (d2 < 64 * a2 && d2 > a2) {
          var s = a2 / d2, ix = body.x + dx * s, iy = body.y + dy * s;
          u += vel(px, py, ix, iy, -q.g, q.rc * 0.6, 0); v += vel(px, py, ix, iy, -q.g, q.rc * 0.6, 1);
        }
      }
      out[0] = u; out[1] = v;
    }
    /* a Lamb-Oseen vortex: g > 0 turns clockwise on screen */
    function vel(px, py, cx, cy, g, rc, comp) {
      var dx = px - cx, dy = py - cy, r2 = dx * dx + dy * dy + 1e-6;
      var f = g / (2 * Math.PI * r2) * (1 - Math.exp(-r2 / (rc * rc)));
      return comp ? f * dx : -f * dy;
    }
    var tmp = [0, 0], tmp2 = [0, 0];
    function advect(p, dt) {
      addV(p.x, p.y, tmp);
      var mx = p.x + tmp[0] * dt * 0.5, my = p.y + tmp[1] * dt * 0.5;
      addV(mx, my, tmp2);
      p.px = p.x; p.py = p.y;
      p.x += tmp2[0] * dt; p.y += tmp2[1] * dt;
      /* stirred by the pointer */
      if (ptr.on) {
        var dx = p.x - ptr.x, dy = p.y - ptr.y, d2 = dx * dx + dy * dy, rr = 80 * 80;
        if (d2 < rr) { var w = (1 - d2 / rr); p.x += ptr.vx * dt * w * 0.9; p.y += ptr.vy * dt * w * 0.9; }
      }
      /* nothing goes inside the cylinder */
      var bx = p.x - body.x, by = p.y - body.y, b2 = bx * bx + by * by;
      if (b2 < R * R) { var m = Math.sqrt(b2) || 1; p.x = body.x + bx / m * R * 1.02; p.y = body.y + by / m * R * 1.02; }
    }
    function shed(dt) {
      steady.length = 0;
      if (Re < 47) {
        /* steady wake: a twin pair sits behind the cylinder, longer as Re grows */
        var Lw = (0.05 * Re) * D, g0 = 1.5 * U * D * Math.sqrt(Re / 47);
        steady.push({ x: body.x + R + 0.45 * Lw, y: body.y - 0.36 * D, g: g0, rc: 0.32 * D + 0.1 * Lw });
        steady.push({ x: body.x + R + 0.45 * Lw, y: body.y + 0.36 * D, g: -g0, rc: 0.32 * D + 0.1 * Lw });
      } else {
        var half = D / (St() * U) / 2, jitter = Re > 190 ? (Re - 190) / 110 : 0;
        phase += dt;
        if (phase >= half) {
          phase = 0; side = -side;
          vort.push({ x: body.x + 0.7 * R, y: body.y - side * 0.8 * R, g: 0, g0: 1.9 * U * D * (1 + 0.15 * jitter * (Math.random() - 0.5)), rc: 0.3 * D, age: 0, s: side, born: half * (1 + 0.25 * jitter * (Math.random() - 0.5)) });
        }
      }
      for (var k = vort.length - 1; k >= 0; k--) {
        var q = vort[k]; q.age += dt;
        if (q.age < q.born) {
          /* still forming in the near wake */
          var f = q.age / q.born, e = f * f * (3 - 2 * f);
          q.g = q.s * q.g0 * e;
          q.x = body.x + R * (0.7 + 1.9 * e); q.y = body.y - q.s * R * (0.8 - 0.25 * e);
        } else {
          /* released: carried downstream, settling into the street, slowly diffusing */
          var dist = (q.x - body.x) / D;
          q.x += 0.86 * U * dt;
          var hy = body.y - q.s * D * (0.32 + 0.025 * Math.min(dist, 12));
          q.y += (hy - q.y) * Math.min(1, dt * 1.2) + (Re > 190 ? (Math.random() - 0.5) * 6 * dt * (Re - 190) / 30 : 0);
          q.g *= Math.exp(-dt / 14); q.rc += dt * 0.05 * D;
        }
        if (q.x > W + 4 * D || (q.age > q.born && Math.abs(q.g) < 0.05 * U * D)) vort.splice(k, 1);
      }
    }

    /* ---------------------------------- flags ---------------------------------- */
    function placeFlags() {
      var L = 1.1 * D, x1 = body.x + R + GAPS[gap1] * D, x2 = x1 + L + GAPS[gap2] * D;
      flags[0].x0 = x1; flags[1].x0 = x2; flags[0].len = flags[1].len = L; flags[0].y0 = flags[1].y0 = body.y;
    }
    function stepFlags(dt) {
      /* each flag flaps with the shedding, as a wave that travels down it at the speed the vortices are carried */
      placeFlags();
      var f0 = Re >= 47 ? St() * U / D : 0, lam = f0 ? 0.86 * U / f0 : 1;
      for (var j = 0; j < 2; j++) {
        var f = flags[j], ds = f.len / (f.n - 1);
        f.amp = (f.amp || 0) + ((f0 ? (0.2 + 0.06 * j) * D : 0) - (f.amp || 0)) * Math.min(1, dt * 1.5);
        for (var i = 0; i < f.n; i++) {
          var sN = i / (f.n - 1), x = f.x0 + i * ds;
          f.y[i] = f.amp * Math.pow(sN, 1.5) * Math.sin(2 * Math.PI * (f0 * t - (x - body.x) / lam));
        }
      }
    }

    /* --------------------------------- drawing ---------------------------------- */
    function layout() {
      var r = cv.getBoundingClientRect(), key = Math.round(r.width) + 'x' + Math.round(r.height);
      if (sized === key) return;
      var first = !sized;
      var g = fit(cv, tc); fit(top, oc);
      sized = key; W = g.w; H = g.h; grad = {};
      R = clamp(W * 0.018, 14, 24); D = 2 * R; U = clamp(W * 0.072, 58, 112);
      if (first || !moved) defaultSpot();
      body.x = body.fx * W; body.y = body.fy * H;
      free = []; var n = Math.round(clamp(W * 0.42, 140, 620));
      for (var i = 0; i < n; i++) free.push(spawn({}, true));
      dye = []; vort = []; phase = 0;
      grips();
    }
    function defaultSpot() {
      /* just right of the heading on wide screens; on phones, in the band left above the heading */
      var h2 = sec.querySelector('h2'), cr = cv.getBoundingClientRect();
      var hr = h2 ? h2.getBoundingClientRect() : null;
      if (W < 700) { body.fx = 0.13; body.fy = clamp((hr ? hr.top - cr.top - 46 : 50) / H, 0.05, 0.3); }
      else { body.fx = clamp(((hr ? hr.right - cr.left : W * 0.36) + 0.045 * W) / W, 0.3, 0.5); body.fy = clamp((hr ? hr.top + hr.height * 0.3 - cr.top : H * 0.3) / H, 0.1, 0.5); }
    }
    function spawn(p, anywhere) { p.x = anywhere ? Math.random() * W : -6 - Math.random() * 20; p.y = Math.random() * H; p.px = p.x; p.py = p.y; return p; }
    function emitDye(dt) {
      if (dye.length > 1500) return;
      var n = Math.max(1, Math.round(dt * 66));
      for (var i = 0; i < n; i++) {
        for (var s = -1; s <= 1; s += 2) {
          var a = (Math.PI / 2) * s + (Math.random() - 0.5) * 0.25;   /* the top and bottom of the cylinder */
          var x = body.x + Math.cos(a) * R * 0.15 + (Math.random() - 0.5) * 2, y = body.y + Math.sin(a) * R * 1.06;
          dye.push({ x: x, y: y, px: x, py: y, c: s < 0 ? 1 : 2 });
        }
      }
    }
    function puff(x, y) {
      var pal = Math.floor(Math.random() * 3);
      for (var i = 0; i < 130; i++) {
        var a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 26;
        dye.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, px: x, py: y, c: 3 + pal });
      }
    }
    function step(now, dt) {
      layout();
      if (!paused) {
        t += dt;
        shed(dt);
        if (mode === 'flags') stepFlags(dt);
        emitDye(dt);
        for (var i = 0; i < free.length; i++) {
          var p = free[i]; advect(p, dt);
          if (p.x > W + 10 || p.y < -30 || p.y > H + 30) spawn(p, false);
        }
        for (var j = dye.length - 1; j >= 0; j--) {
          var q = dye[j]; advect(q, dt);
          if (q.x > W + 10 || q.y < -40 || q.y > H + 40 || q.x < -40) dye.splice(j, 1);
        }
        ptr.vx *= 0.85; ptr.vy *= 0.85;
        if (performance.now() - ptr.t > 120) ptr.on = false;
      }
      draw(paused ? 0 : 1);
    }
    function draw(fade) {
      var col = night() ? COL.night : COL.day;
      if (fade) { tc.globalCompositeOperation = 'destination-out'; tc.fillStyle = 'rgba(0,0,0,0.07)'; tc.fillRect(0, 0, W, H); }
      tc.globalCompositeOperation = 'source-over'; tc.lineCap = 'round';
      if (fade) {
        tc.lineWidth = 1.3; tc.strokeStyle = col.free; tc.beginPath();
        for (var i = 0; i < free.length; i++) { var p = free[i]; if (p.px > -1) { tc.moveTo(p.px, p.py); tc.lineTo(p.x, p.y); } }
        tc.stroke();
        var cols = [null, col.top, col.bot, col.puff[0], col.puff[1], col.puff[2]];
        for (var k = 1; k <= 5; k++) {
          tc.lineWidth = k > 2 ? 2.2 : 1.7; tc.strokeStyle = cols[k]; tc.globalAlpha = k > 2 ? 0.9 : 0.72; tc.beginPath();
          for (var j = 0; j < dye.length; j++) { var q = dye[j]; if (q.c === k) { tc.moveTo(q.px, q.py); tc.lineTo(q.x, q.y); } }
          tc.stroke();
        }
        tc.globalAlpha = 1;
        /* fade the dye out towards the cards below and, on wide screens, under the text on the left;
           done here rather than with a CSS mask, which costs a lot to repaint every frame */
        tc.globalCompositeOperation = 'destination-out';
        var y0 = H * 0.6;
        if (!grad.v) { grad.v = tc.createLinearGradient(0, y0, 0, H); grad.v.addColorStop(0, 'rgba(0,0,0,0)'); grad.v.addColorStop(1, 'rgba(0,0,0,1)'); }
        tc.fillStyle = grad.v; tc.fillRect(0, y0, W, H - y0);
        if (W >= 700) {
          if (!grad.h) { grad.h = tc.createLinearGradient(0, 0, W * 0.46, 0); grad.h.addColorStop(0, 'rgba(0,0,0,0.2)'); grad.h.addColorStop(1, 'rgba(0,0,0,0)'); }
          tc.fillStyle = grad.h; tc.fillRect(0, 0, W * 0.46, H);
        }
        tc.globalCompositeOperation = 'source-over';
      }
      /* the cylinder itself is the handle drawn over the canvas, so the canvas's fade never dims it */
      var c = oc;
      if (topDirty || mode === 'flags') { c.clearRect(0, 0, W, H); topDirty = false; }
      if (mode === 'flags') {
        topDirty = true;
        c.strokeStyle = col.flag; c.lineWidth = 2.6; c.lineJoin = 'round'; c.lineCap = 'round';
        for (var f = 0; f < 2; f++) {
          var fl = flags[f], ds = fl.len / (fl.n - 1);
          c.beginPath(); c.moveTo(fl.x0, fl.y0 + fl.y[0]);
          for (var n = 1; n < fl.n - 1; n++) {
            var xa = fl.x0 + n * ds, ya = fl.y0 + fl.y[n], xb = fl.x0 + (n + 1) * ds, yb = fl.y0 + fl.y[n + 1];
            c.quadraticCurveTo(xa, ya, (xa + xb) / 2, (ya + yb) / 2);
          }
          c.lineTo(fl.x0 + (fl.n - 1) * ds, fl.y0 + fl.y[fl.n - 1]);
          c.stroke();
          c.fillStyle = col.flag; c.beginPath(); c.arc(fl.x0, fl.y0, 4.5, 0, Math.PI * 2); c.fill();
        }
      }
      grips();
    }

    /* ------------------------------- the controls ------------------------------- */
    function readout() {
      reOut.textContent = String(Re);
      var txt;
      if (Re < 47) txt = 'Steady wake: two vortices stay attached behind the cylinder, and nothing is shed.';
      else if (Re < 190) txt = 'Periodic shedding, a von Kármán street. St ≈ ' + St().toFixed(2) + '.';
      else txt = 'Shedding, St ≈ ' + St().toFixed(2) + '. A real wake turns three-dimensional above about Re 190, so this flat sketch no longer holds.';
      if (mode === 'flags') {
        var k = gap1 * 6 + gap2 + 1;
        txt = 'Body-to-flag gap ' + GAPS[gap1].toFixed(2) + ', flag-to-flag gap ' + GAPS[gap2].toFixed(2) + ': case ' + k + ' of the study’s 36. ' + (Re === 300 ? 'Re 300, as in the study. ' : '') + 'Drag either flag to change its gap.';
      }
      read.textContent = txt;
    }
    function setMode(m) {
      mode = m;
      modeBtns.forEach(function (b) { b.setAttribute('aria-checked', b.dataset.mode === m ? 'true' : 'false'); });
      pin1.hidden = pin2.hidden = m !== 'flags';
      if (m === 'flags') { Re = 300; reIn.value = 300; placeFlags(); flags.forEach(function (f) { for (var i = 0; i < f.n; i++) { f.y[i] = 0; f.v[i] = 0; } }); }
      else if (Re === 300) { Re = 150; reIn.value = 150; }
      vort = []; phase = 0;
      readout(); if (reduce || paused) still();
    }
    modeBtns.forEach(function (b) { b.addEventListener('click', function () { setMode(b.dataset.mode); }); });
    ui.querySelector('.flow-modes').addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault(); var i = modeBtns.findIndex(function (b) { return b.dataset.mode === mode; });
      var nb = modeBtns[(i + (e.key === 'ArrowRight' ? 1 : modeBtns.length - 1)) % modeBtns.length];
      setMode(nb.dataset.mode); nb.focus();
    });
    reIn.addEventListener('input', function () { Re = +reIn.value; readout(); if (reduce || paused) still(); });
    pauseBtn.addEventListener('click', function () {
      paused = !paused; pauseBtn.setAttribute('aria-pressed', paused ? 'true' : 'false');
      pauseBtn.setAttribute('aria-label', paused ? 'Play the flow' : 'Pause the flow');
    });

    /* handles that sit over the cylinder and the flag pins, so they can be dragged and focused */
    function grips() {
      var cr = cv.getBoundingClientRect(), sr = sec.getBoundingClientRect(), ox = cr.left - sr.left, oy = cr.top - sr.top, pad = 10;
      gripBody.style.transform = 'translate(' + (ox + body.x - R - pad) + 'px,' + (oy + body.y - R - pad) + 'px)';
      gripBody.style.width = gripBody.style.height = (2 * (R + pad)) + 'px';
      gripBody.style.setProperty('--pad', pad + 'px');
      if (mode === 'flags') {
        [pin1, pin2].forEach(function (b, i) {
          b.style.transform = 'translate(' + (ox + flags[i].x0 - 16) + 'px,' + (oy + flags[i].y0 - 16) + 'px)';
        });
      }
    }
    function dragger(el, onMove, onKey) {
      var on = null;
      el.addEventListener('pointerdown', function (e) {
        on = { id: e.pointerId }; el.classList.add('is-drag'); el.classList.add('was-used');
        try { el.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
        e.preventDefault();
      });
      el.addEventListener('pointermove', function (e) {
        if (!on || e.pointerId !== on.id) return;
        var cr = cv.getBoundingClientRect(); onMove(e.clientX - cr.left, e.clientY - cr.top);
      });
      var end = function () { on = null; el.classList.remove('is-drag'); };
      el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
      el.addEventListener('keydown', function (e) { if (onKey(e.key, e.shiftKey ? 3 : 1)) { e.preventDefault(); el.classList.add('was-used'); } });
    }
    function floorY() {
      /* keep the cylinder above the cards, where it can be seen */
      var bento = sec.querySelector('.bento'), cr = cv.getBoundingClientRect();
      return bento ? Math.min(H - R - 4, bento.getBoundingClientRect().top - cr.top - R - 12) : H - R - 4;
    }
    function moveBody(x, y) {
      body.x = clamp(x, R + 4, W - R - 4); body.y = clamp(y, R + 4, Math.max(R + 4, floorY()));
      body.fx = body.x / W; body.fy = body.y / H; moved = true;
      if (reduce || paused) still(); else grips();
    }
    dragger(gripBody, moveBody, function (k, m) {
      var s = 14 * m;
      if (k === 'ArrowLeft') moveBody(body.x - s, body.y); else if (k === 'ArrowRight') moveBody(body.x + s, body.y);
      else if (k === 'ArrowUp') moveBody(body.x, body.y - s); else if (k === 'ArrowDown') moveBody(body.x, body.y + s); else return false;
      return true;
    });
    function snapGap(px) { var g = px / D, best = 0; for (var i = 1; i < 6; i++) if (Math.abs(GAPS[i] - g) < Math.abs(GAPS[best] - g)) best = i; return best; }
    dragger(pin1, function (x) { gap1 = snapGap(x - (body.x + R)); placeFlags(); readout(); if (reduce || paused) still(); }, function (k) {
      if (k === 'ArrowLeft') gap1 = Math.max(0, gap1 - 1); else if (k === 'ArrowRight') gap1 = Math.min(5, gap1 + 1); else return false;
      placeFlags(); readout(); if (reduce || paused) still(); return true;
    });
    dragger(pin2, function (x) { gap2 = snapGap(x - (flags[0].x0 + flags[0].len)); placeFlags(); readout(); if (reduce || paused) still(); }, function (k) {
      if (k === 'ArrowLeft') gap2 = Math.max(0, gap2 - 1); else if (k === 'ArrowRight') gap2 = Math.min(5, gap2 + 1); else return false;
      placeFlags(); readout(); if (reduce || paused) still(); return true;
    });

    /* stir with the pointer; tap or click the background to release dye */
    sec.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      var cr = cv.getBoundingClientRect(), x = e.clientX - cr.left, y = e.clientY - cr.top, nowT = performance.now();
      if (y < 0 || y > H) { ptr.on = false; return; }
      var dtp = Math.max(8, nowT - ptr.t) / 1000;
      if (ptr.on) { ptr.vx = clamp((x - ptr.x) / dtp, -900, 900); ptr.vy = clamp((y - ptr.y) / dtp, -900, 900); }
      ptr.x = x; ptr.y = y; ptr.t = nowT; ptr.on = !(e.target.closest && e.target.closest('.tile, .flow-ui, a, button'));
    }, { passive: true });
    sec.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('a, button, input, label, .tile, .flow-ui, .sheet-store')) return;
      if (window.getSelection && String(window.getSelection())) return;
      var cr = cv.getBoundingClientRect(), x = e.clientX - cr.left, y = e.clientY - cr.top;
      if (y < 0 || y > H * 0.92) return;
      puff(x, y); if (reduce || paused) still();
    });
    window.addEventListener('themechange', function () { tc.clearRect(0, 0, W, H); if (reduce || paused) still(); });

    /* a still frame: run the flow for a few seconds out of sight, then draw it once */
    function still() {
      sized = sized || ''; layout();
      tc.clearRect(0, 0, W, H);
      var keep = paused; paused = false;
      for (var n = 0; n < 300; n++) {
        t += 1 / 60; shed(1 / 60); if (mode === 'flags') stepFlags(1 / 60); emitDye(1 / 60);
        for (var i = 0; i < free.length; i++) { var p = free[i]; advect(p, 1 / 60); if (p.x > W + 10 || p.y < -30 || p.y > H + 30) spawn(p, false); }
        for (var j = dye.length - 1; j >= 0; j--) { var q = dye[j]; advect(q, 1 / 60); if (q.x > W + 10 || q.y < -40 || q.y > H + 40) dye.splice(j, 1); }
        if (n > 240) draw(1);
      }
      paused = keep; draw(0);
    }
    readout();
    if (reduce) {
      pauseBtn.hidden = true;
      layout(); still();
      window.addEventListener('resize', function () { sized = ''; still(); });
    } else animate(cv, step);
  })();

  if (!reduce && jobs.length) requestAnimationFrame(tick);
})();
