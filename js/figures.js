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
    var job = { fn: fn, on: !('IntersectionObserver' in window) };
    if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { job.on = e[0].isIntersecting; }, { rootMargin: '80px' }).observe(el);
    jobs.push(job);
  }
  var last = 0;
  function tick(now) {
    var dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016); last = now;
    if (!document.hidden) for (var i = 0; i < jobs.length; i++) if (jobs[i].on) jobs[i].fn(now / 1000, dt);
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
    var L = 58, R = 500, T = 26, B = 322;
    var px = function (x) { return L + (R - L) * x / XMAX; };
    var py = function (y) { return B - (B - T) * Math.min(y, YMAX) / YMAX; };
    var d = '', i, x;
    for (i = 0; i <= 100; i++) { x = i / 100; d += (i ? 'L' : 'M') + px(x).toFixed(1) + ' ' + py(real(x)).toFixed(1); }
    var xTop = 1 + (YMAX - real(1)) / 9;
    svg.innerHTML =
      '<line class="c-grid" x1="' + px(XO) + '" y1="' + T + '" x2="' + px(XO) + '" y2="' + B + '"/>' +
      '<line class="c-grid" x1="' + px(1) + '" y1="' + T + '" x2="' + px(1) + '" y2="' + B + '"/>' +
      '<path class="c-axis" d="M' + L + ' ' + T + 'V' + B + 'H' + R + '"/>' +
      '<text class="c-text" x="' + px(XO) + '" y="' + (B + 20) + '" text-anchor="middle">onset of boiling</text>' +
      '<text class="c-text" x="' + px(1) + '" y="' + (B + 20) + '" text-anchor="middle">critical heat flux</text>' +
      '<text class="c-text-strong" x="' + R + '" y="' + (B + 46) + '" text-anchor="end">Chip heat flux</text>' +
      '<text class="c-text-strong" transform="translate(20 ' + T + ') rotate(-90)" text-anchor="end">Wall temperature rise</text>' +
      '<path class="c-fixed" d="M' + px(0) + ' ' + py(0) + 'L' + px(XMAX) + ' ' + py(fixed(XMAX)) + '"/>' +
      '<path class="c-real" d="' + d + '"/>' +
      '<path class="c-real-hot" d="M' + px(1) + ' ' + py(real(1)) + 'L' + px(xTop).toFixed(1) + ' ' + py(YMAX) + '"/>' +
      '<path class="c-real-hot" d="M' + (px(xTop) - 7).toFixed(1) + ' ' + (py(YMAX) + 10) + 'L' + px(xTop).toFixed(1) + ' ' + py(YMAX) + 'l8 7"/>' +
      '<line class="c-fixed" x1="' + (L + 14) + '" y1="' + (T + 12) + '" x2="' + (L + 48) + '" y2="' + (T + 12) + '"/>' +
      '<text class="c-text" x="' + (L + 56) + '" y="' + (T + 16) + '">Single-phase plate, a fixed resistance</text>' +
      '<line class="c-real" x1="' + (L + 14) + '" y1="' + (T + 34) + '" x2="' + (L + 48) + '" y2="' + (T + 34) + '"/>' +
      '<text class="c-text" x="' + (L + 56) + '" y="' + (T + 38) + '">Two-phase plate</text>' +
      '<line class="c-guide" id="boil-guide" y1="' + T + '" y2="' + B + '"/>' +
      '<line class="c-gap" id="boil-gap"/>' +
      '<circle class="c-dot-fixed" id="boil-df" r="6"/>' +
      '<circle class="c-dot" id="boil-dr" r="7"/>' +
      '<text class="c-text-strong" id="boil-note" text-anchor="end"></text>';

    var regime = $('#boil-regime'), text = $('#boil-text'), out = $('#boil-out');
    var m1 = $('#meter-1'), m2 = $('#meter-2');
    var COPY = [
      ['Both plates run single-phase', 'Below the onset of boiling the two plates behave alike, and one fixed thermal resistance describes either of them. Current twins handle this case well enough.'],
      ['Two-phase plate in nucleate boiling', 'Bubbles now carry most of the heat, so the two-phase wall runs cooler than the single-phase one, and cooler than a fixed resistance predicts. Here the model has to resolve boiling and conjugate heat transfer in some form, and the right level of detail is not yet settled.'],
      ['Two-phase plate near its limit', 'The margin to critical heat flux is closing. A twin with a fixed resistance still draws a comfortable straight line and gives no warning.'],
      ['Past critical heat flux', 'Vapour blankets the wall of the two-phase plate and its temperature runs away. A fixed resistance misses this entirely, which is why a twin used for control has to know where the limit is.']
    ];
    var STATE = ['liquid', 'boiling', 'near limit', 'dry-out'];
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
      note.textContent = Math.abs(diff) < 0.02 ? '' : (diff < 0 ? 'fixed resistance: too hot' : 'fixed resistance: too cold');
      note.setAttribute('y', (py(yf) + py(yr)) / 2 + 5);
      if (X < L + (R - L) * 0.45) { note.setAttribute('text-anchor', 'start'); note.setAttribute('x', X + 12); } else { note.setAttribute('text-anchor', 'end'); note.setAttribute('x', X - 12); }
      var k = q <= XO ? 0 : q <= 0.88 ? 1 : q <= 1 ? 2 : 3;
      regime.textContent = COPY[k][0]; text.textContent = COPY[k][1];
      out.textContent = k === 0 ? 'Warmer liquid out' : 'Liquid and vapour out';
      input.setAttribute('aria-valuetext', COPY[k][0]);
      if (m1) { m1.querySelector('i').style.width = (Math.min(yf / YMAX, 1) * 100).toFixed(1) + '%'; m1.querySelector('b').textContent = 'liquid'; }
      if (m2) { m2.querySelector('i').style.width = (Math.min(yr / YMAX, 1) * 100).toFixed(1) + '%'; m2.querySelector('b').textContent = STATE[k]; m2.classList.toggle('is-over', k === 3); }
    }
    input.addEventListener('input', function () { update(); if (reduce) still(); });

    /* one cold plate, in section along the flow. mode 1: liquid only, mode 2: boiling allowed */
    function Plate(cv, mode) {
      this.cv = cv; this.mode = mode; this.bubbles = []; this.acc = 0; this.streaks = [];
      for (var n = 0; n < 22; n++) this.streaks.push({ x: Math.random(), y: Math.random(), v: 0.5 + Math.random() * 0.6 });
    }
    Plate.prototype.step = function (tt, dt) {
      var g = fitCanvas(this.cv), c = g.c, w = g.w, h = g.h, mode = this.mode;
      var x0 = w * 0.05, x1 = w * 0.95, yT = h * 0.34, yB = h * 0.6, lid = h * 0.08, base = h * 0.085;
      var cx0 = w * 0.28, cx1 = w * 0.72, heatK = clamp(q / 1.05, 0, 1), dry = mode === 2 && q > 1;
      c.clearRect(0, 0, w, h);
      /* chip, and the heat it sheds into the base */
      var cy = yB + base + 3, ch = h * 0.13;
      var glow = c.createLinearGradient(0, cy + ch, 0, yB - 2);
      glow.addColorStop(0, 'rgba(255,106,53,' + (0.2 + 0.6 * heatK).toFixed(2) + ')'); glow.addColorStop(1, 'rgba(255,106,53,0)');
      c.fillStyle = glow; c.fillRect(cx0 - 12, yB - 2, cx1 - cx0 + 24, cy + ch - yB + 2);
      c.fillStyle = dry ? '#ff3b2f' : 'rgb(' + Math.round(70 + 180 * heatK) + ',' + Math.round(62 + 50 * heatK) + ',' + Math.round(56 - 6 * heatK) + ')';
      c.beginPath(); if (c.roundRect) c.roundRect(cx0, cy, cx1 - cx0, ch, 4); else c.rect(cx0, cy, cx1 - cx0, ch); c.fill();
      /* ports through the lid */
      var pw = w * 0.05, pt = h * 0.2;
      c.fillStyle = '#8d8780';
      c.fillRect(x0 + w * 0.02 - 3, pt, pw + 6, yT - lid - pt); c.fillRect(x1 - w * 0.02 - pw - 3, pt, pw + 6, yT - lid - pt);
      /* plate: lid, channel, copper base */
      c.fillRect(x0, yT - lid, x1 - x0, lid);
      c.fillStyle = dry ? '#e2603a' : '#c9743b'; c.fillRect(x0, yB, x1 - x0, base);
      c.fillStyle = '#3a322e'; c.fillRect(cx0 - 6, yB + base, cx1 - cx0 + 12, 3);
      var liq = c.createLinearGradient(x0, 0, x1, 0), warm = mode === 1 ? heatK : heatK * 0.25;
      /* by day the coolant is drawn light blue, warming toward orange; the night palette is unchanged */
      if (document.documentElement.dataset.mode === 'night') {
        liq.addColorStop(0, '#4d606b'); liq.addColorStop(0.25, '#4d606b');
        liq.addColorStop(1, 'rgb(' + Math.round(77 + 150 * warm) + ',' + Math.round(96 + 10 * warm) + ',' + Math.round(107 - 50 * warm) + ')');
      } else {
        liq.addColorStop(0, '#4da3da'); liq.addColorStop(0.25, '#4da3da');
        liq.addColorStop(1, 'rgb(' + Math.round(77 + 160 * warm) + ',' + Math.round(163 - 40 * warm) + ',' + Math.round(218 - 150 * warm) + ')');
      }
      c.fillStyle = liq; c.fillRect(x0, yT, x1 - x0, yB - yT);
      c.fillRect(x0 + w * 0.02, pt, pw, yT - lid - pt + lid); c.fillRect(x1 - w * 0.02 - pw, pt, pw, yT - pt);
      /* flow */
      c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = 1.2; c.beginPath();
      this.streaks.forEach(function (s) {
        s.x += s.v * dt * 0.32; if (s.x > 1) { s.x = 0; s.y = Math.random(); }
        var sx = x0 + s.x * (x1 - x0), sy = yT + 4 + s.y * (yB - yT - 8);
        c.moveTo(sx, sy); c.lineTo(Math.min(x1, sx + 13), sy);
      });
      c.stroke();
      /* arrows at the ports */
      c.strokeStyle = '#f5efe9'; c.lineWidth = 1.8; c.lineCap = 'round'; c.beginPath();
      var ax = x0 + w * 0.02 + pw / 2, bx = x1 - w * 0.02 - pw / 2, ay = pt + 5;
      c.moveTo(ax, ay); c.lineTo(ax, ay + 12); c.moveTo(ax - 4, ay + 8); c.lineTo(ax, ay + 12); c.lineTo(ax + 4, ay + 8);
      c.moveTo(bx, ay + 12); c.lineTo(bx, ay); c.moveTo(bx - 4, ay + 4); c.lineTo(bx, ay); c.lineTo(bx + 4, ay + 4);
      c.stroke();
      if (mode !== 2) return;
      /* bubbles nucleate on the heated wall, grow, lift off and are carried out */
      var bub = this.bubbles, rate = q > XO ? 4 + 70 * (q - XO) : 0;
      this.acc += rate * dt;
      while (this.acc > 1 && bub.length < 160) { this.acc -= 1; bub.push({ x: cx0 + Math.random() * (cx1 - cx0), y: yB, r: 0.6, rd: 2.4 + Math.random() * (2.4 + 5 * q), free: false, vy: 0 }); }
      c.fillStyle = 'rgba(255,255,255,.2)'; c.strokeStyle = 'rgba(255,255,255,.92)'; c.lineWidth = 1.1;
      for (var b = bub.length - 1; b >= 0; b--) {
        var o = bub[b];
        if (!o.free) { o.r += dt * (3 + 9 * q); if (o.r >= o.rd) o.free = true; o.y = yB - o.r; }
        else { o.x += dt * (w * 0.2); o.vy = Math.min(o.vy + dt * 40, 24); o.y -= o.vy * dt; if (o.y < yT + o.r) o.y = yT + o.r; }
        if (o.x > x1 - o.r) { bub.splice(b, 1); continue; }
        c.beginPath(); c.arc(o.x, o.y, o.r, 0, Math.PI * 2); c.fill(); c.stroke();
      }
      /* past the limit a vapour film covers the wall */
      if (q > 0.94) {
        var a = clamp((q - 0.94) / 0.08, 0, 1);
        c.fillStyle = 'rgba(255,255,255,' + (0.8 * a).toFixed(2) + ')'; c.beginPath(); c.moveTo(cx0 - 6, yB);
        for (var xx = cx0 - 6; xx <= x1; xx += 6) c.lineTo(xx, yB - (4 + 6 * a) - 2.5 * Math.sin(xx * 0.09 + tt * 5));
        c.lineTo(x1, yB); c.closePath(); c.fill();
      }
    };
    var plates = [new Plate(cv1, 1), new Plate(cv2, 2)];
    function still() { for (var n = 0; n < 90; n++) plates.forEach(function (p) { p.step(n / 30, 1 / 30); }); }
    update();
    if (reduce) { still(); window.addEventListener('resize', still); }
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
    /* a bead rides the tube as the page scrolls and takes the colour of where it is */
    var pending = false;
    var paint = function () {
      pending = false;
      var r = root.getBoundingClientRect(), b = bead.getBoundingClientRect();
      bead.style.background = col(clamp((b.top + b.height / 2 - r.top) / Math.max(1, r.height), 0, 1));
    };
    window.addEventListener('scroll', function () { if (!pending) { pending = true; requestAnimationFrame(paint); } }, { passive: true });
    paint();
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
      flakes.forEach(function (f) {
        var depth = f.y / h, a = (0.3 + 0.7 * (0.5 + 0.5 * Math.sin(tt * f.sp + f.ph))) * (0.25 + 0.75 * depth);
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

  /* ======= Current studies: coolant streaming across, cool to warm, parting round the pointer ======= */
  (function flow() {
    var cv = $('#studies-flow'); if (!cv || !cv.getContext) return;
    var trail = document.createElement('canvas'), tc = trail.getContext('2d');
    var parts = [], W = 0, H = 0, sized = '', t = 0, ptr = { x: -999, y: -999, on: false };
    var DAY = ['#4aa8e0', '#6bb4df', '#9fc1cf', '#e3b178', '#f08a3c', '#ea5a1c'], NIGHT = ['#7a3a22', '#a8491f', '#d9501d', '#ff7a45', '#ff9a55', '#ffb347'];
    window.addEventListener('pointermove', function (e) {
      var r = cv.getBoundingClientRect();
      ptr.x = e.clientX - r.left; ptr.y = e.clientY - r.top; ptr.on = e.pointerType !== 'touch' && ptr.y > -60 && ptr.y < r.height + 60;
    }, { passive: true });
    var spawn = function (p, anywhere) { p.x = anywhere ? Math.random() * W : -8; p.y = Math.random() * H; p.px = p.x; p.py = p.y; p.life = 0; return p; };
    function layout() {
      var g = fitCanvas(cv);
      if (sized === g.w + 'x' + g.h) return g;
      sized = g.w + 'x' + g.h; W = g.w; H = g.h;
      trail.width = cv.width; trail.height = cv.height; tc.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
      parts = []; for (var i = 0, n = Math.round(clamp(W * 0.42, 120, 640)); i < n; i++) parts.push(spawn({}, true));
      return g;
    }
    function step(now, dt) {
      var g = layout(), c = g.c, U = Math.max(38, W * 0.052), R = 58, a2 = R * R, bins = [[], [], [], [], [], []];
      t += dt;
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        var u = U * (0.78 + 0.22 * Math.sin(p.y * 0.013 + t * 0.2));
        var v = U * 0.2 * Math.sin(p.x * 0.008 + p.y * 0.011 + t * 0.35) + U * 0.1 * Math.sin(p.x * 0.021 - t * 0.5);
        if (ptr.on) {
          var dx = p.x - ptr.x, dy = p.y - ptr.y, r2 = dx * dx + dy * dy;
          if (r2 > a2) { u -= U * a2 * (dx * dx - dy * dy) / (r2 * r2); v -= U * 2 * a2 * dx * dy / (r2 * r2); }
          else { var m = Math.sqrt(r2) || 1; p.x = ptr.x + dx / m * R; p.y = ptr.y + dy / m * R; }
        }
        p.px = p.x; p.py = p.y; p.x += u * dt; p.y += v * dt; p.life += dt;
        if (p.x > W + 8 || p.y < -8 || p.y > H + 8) { spawn(p, false); continue; }
        if (p.life > dt * 1.5) bins[clamp(Math.floor(p.x / W * 6), 0, 5)].push(p);
      }
      tc.globalCompositeOperation = 'destination-out'; tc.fillStyle = 'rgba(0,0,0,0.04)'; tc.fillRect(0, 0, W, H);
      tc.globalCompositeOperation = 'source-over'; tc.lineWidth = 2; tc.lineCap = 'round';
      var cols = document.documentElement.dataset.mode === 'night' ? NIGHT : DAY;
      for (var k = 0; k < 6; k++) {
        if (!bins[k].length) continue;
        tc.strokeStyle = cols[k]; tc.beginPath();
        for (var j = 0; j < bins[k].length; j++) { var q = bins[k][j]; tc.moveTo(q.px, q.py); tc.lineTo(q.x, q.y); }
        tc.stroke();
      }
      c.clearRect(0, 0, W, H); c.drawImage(trail, 0, 0, W, H);
    }
    if (reduce) { var still = function () { sized = ''; for (var n = 0; n < 420; n++) step(0, 1 / 60); }; still(); window.addEventListener('resize', still); }
    else animate(cv, step);
  })();

  if (!reduce && jobs.length) requestAnimationFrame(tick);
})();
