/* Live von Kármán street for the doodle version.
   Vortices peel off the cylinder at the Strouhal frequency for the chosen Reynolds number,
   dye from two injectors (and from the visitor's pointer) is carried by potential flow round
   the cylinder plus the vortices, so it rolls up into the street. Below Re ≈ 47 the wake stays
   steady with two eddies behind the cylinder. Schematic, not a solver. */
(function () {
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fig = document.querySelector('.dl-karman-fig');
  if (!fig || reduce || !window.requestAnimationFrame) return;
  var NS = 'http://www.w3.org/2000/svg';
  var ctl = document.querySelector('.dl-kv-ctl'), slider = ctl && ctl.querySelector('input'), read = ctl && ctl.querySelector('.dl-kv-read');
  if (ctl) ctl.hidden = false;
  var Re = slider ? +slider.value : 150;

  function Sim(svg) {
    var o = JSON.parse(svg.getAttribute('data-kv'));
    this.svg = svg; this.o = o; this.v = []; this.dye = []; this.t = 0; this.next = 0.2; this.top = true; this.on = false;
    var smil = svg.querySelector('.dl-kv-smil'); if (smil) smil.style.display = 'none';
    if (svg.pauseAnimations) svg.pauseAnimations();
    var g = document.createElementNS(NS, 'g'); g.setAttribute('class', 'dl-kv-live'); this.g = g;
    var dyeG = document.createElementNS(NS, 'g'); dyeG.setAttribute('class', 'dl-kv-dye');
    this.dp = [];
    for (var c = 0; c < 2; c++) for (var a = 0; a < 3; a++) {
      var p = document.createElementNS(NS, 'path'); p.setAttribute('class', 'dl-kv-d' + c + ' dl-kv-a' + a); dyeG.appendChild(p); this.dp.push(p);
    }
    var cyl = svg.querySelector('.dl-kv-cyl');
    svg.insertBefore(dyeG, cyl);
    svg.insertBefore(g, cyl);
    this.cyl = cyl;
    var self = this;
    // pointer: drag dye through the water, tap the cylinder to nudge it
    var pt = svg.createSVGPoint ? svg.createSVGPoint() : null, last = 0;
    function local(e) {
      if (!pt || !svg.getScreenCTM()) return null;
      pt.x = e.clientX; pt.y = e.clientY; return pt.matrixTransform(svg.getScreenCTM().inverse());
    }
    svg.addEventListener('pointermove', function (e) {
      var now = performance.now(); if (now - last < 28) return; last = now;
      var q = local(e); if (q) self.add(q.x, q.y, 2, e.pointerType === 'touch' ? 4 : 0);
    });
    svg.addEventListener('pointerdown', function (e) {
      var q = local(e); if (!q) return;
      var dx = q.x - o.cx, dy = q.y - o.cy;
      if (dx * dx + dy * dy < (o.r * 1.5) * (o.r * 1.5)) self.nudge(); else self.add(q.x, q.y, 14, 9);
    });
    cyl.style.cursor = 'pointer';
  }
  Sim.prototype.U = function () { return 56 + Re * 0.6; };
  Sim.prototype.add = function (x, y, n, spread) {
    var o = this.o; if (this.dye.length > 520) this.dye.splice(0, n);
    for (var i = 0; i < n; i++) {
      var px = x + (Math.random() - 0.5) * spread, py = y + (Math.random() - 0.5) * spread, dx = px - o.cx, dy = py - o.cy;
      if (dx * dx + dy * dy < o.r * o.r * 1.1) continue;
      this.dye.push({ x: px, y: py, a: 0, c: this.dye.length % 2 });
    }
  };
  Sim.prototype.shed = function (strong) {
    var o = this.o, top = this.top; this.top = !top;
    this.v.push({ x: o.cx + o.r * 1.1, y: o.cy + (top ? -0.55 : 0.55) * o.r, top: top, age: 0, rot: Math.random() * 360, s: strong ? 1.15 : 1, el: null });
  };
  Sim.prototype.nudge = function () {
    this.shed(true); this.next = this.t + 0.35;
    var c = this.cyl; c.classList.remove('dl-kv-wob'); void c.getBoundingClientRect(); c.classList.add('dl-kv-wob');
  };
  Sim.prototype.vel = function (x, y, U) {
    var o = this.o, dx = x - o.cx, dy = y - o.cy, p2 = dx * dx + dy * dy, r2 = o.r * o.r;
    var u = U, v = 0;
    if (p2 > r2 * 0.8) { var p4 = p2 * p2; u = U * (1 - r2 * (dx * dx - dy * dy) / p4); v = -2 * U * r2 * dx * dy / p4; }
    // behind the cylinder the flow is slower: a soft wake
    if (dx > 0) { var w = Math.exp(-(dy * dy) / (r2 * 1.2)) * Math.exp(-dx / (o.r * 9)); u -= U * 0.55 * w; }
    for (var i = 0; i < this.v.length; i++) {
      var q = this.v[i], ex = x - q.x, ey = y - q.y, d2 = ex * ex + ey * ey + 1, rc = o.r * 0.62 * q.sc;
      var G = (q.top ? 1 : -1) * q.G, k = G / (2 * Math.PI) * (1 - Math.exp(-d2 / (rc * rc))) / d2;
      u += -k * ey; v += k * ex;
    }
    return [u, v];
  };
  Sim.prototype.step = function (dt) {
    var o = this.o, U = this.U(), steady = Re < 47, St = steady ? 0 : 0.198 * (1 - 19.7 / Re), D = 2 * o.r;
    this.t += dt;
    var half = steady ? 1e9 : D / (St * U) / 2;
    if (!steady && this.t > this.next) { this.shed(false); this.next = this.t + half; }
    // steady regime: two eddies sit behind the cylinder
    if (steady) {
      if (!this.eddies) { this.v.forEach(function (q) { if (q.el) q.el.remove(); }); this.v = []; this.eddies = true;
        this.v.push({ x: o.cx + o.r * 1.45, y: o.cy - o.r * 0.42, top: true, age: 9, rot: 0, s: 0.55, fixed: true });
        this.v.push({ x: o.cx + o.r * 1.45, y: o.cy + o.r * 0.42, top: false, age: 9, rot: 0, s: 0.55, fixed: true }); }
      var grow = Math.min(1, (Re - 20) / 27);
      this.v.forEach(function (q) { q.s = 0.35 + 0.35 * grow; q.x = o.cx + o.r * (1.25 + 0.5 * grow); });
    } else if (this.eddies) { this.eddies = false; this.v.forEach(function (q) { if (q.el) q.el.remove(); }); this.v = []; this.next = this.t; }
    var spin = 360 / 1.7 * (U / 140), self = this, b = Math.min(1.5, Math.max(0.8, 0.28 * 0.86 * U * half * 2 / o.r / 2));
    for (var i = this.v.length - 1; i >= 0; i--) {
      var q = this.v[i];
      q.rot += (q.top ? 1 : -1) * spin * dt * (q.fixed ? 0.45 : 1);
      if (!q.fixed) {
        q.age += dt;
        q.x += U * 0.86 * dt;
        var row = o.cy + (q.top ? -1 : 1) * b * o.r, ease = Math.min(1, q.age / (half * 1.4));
        q.y += (row - q.y) * Math.min(1, dt * 2.2) * ease + 0 * dt;
      }
      var life = (q.x - o.cx) / (o.x1 - o.cx);
      q.sc = q.fixed ? q.s : q.s * (0.35 + Math.min(0.65, q.age / (half * 1.2) * 0.65)) * (1 + life * 0.25);
      q.G = 2 * Math.PI * o.r * 0.62 * U * 1.0 * (q.fixed ? 0.45 : Math.min(1, 0.3 + q.age / half));
      q.op = q.fixed ? 0.9 : Math.max(0, Math.min(1, q.age * 4, (o.x1 - q.x) / 90));
      if (q.x > o.x1 + 20) { if (q.el) q.el.remove(); this.v.splice(i, 1); continue; }
      if (this.quiet) continue;
      if (!q.el) {
        q.el = document.createElementNS(NS, 'use');
        q.el.setAttribute('href', '#kv' + (q.top ? 'T' : 'B') + '-' + o.id);
        this.g.appendChild(q.el);
      }
      var sc = (o.R / 40) * q.sc;
      q.el.setAttribute('transform', 'translate(' + q.x.toFixed(1) + ' ' + q.y.toFixed(1) + ') rotate(' + q.rot.toFixed(1) + ') scale(' + sc.toFixed(3) + ')');
      q.el.setAttribute('opacity', q.op.toFixed(2));
    }
    // dye: two injectors just above and below the centreline
    this.injAcc = (this.injAcc || 0) + dt * (o.inj || 18);
    while (this.injAcc > 1) { this.injAcc -= 1; this.add(o.cx - o.r * 3.2, o.cy - o.r * 0.32, 1, 3); this.dye[this.dye.length - 1] && (this.dye[this.dye.length - 1].c = 0);
      this.add(o.cx - o.r * 3.2, o.cy + o.r * 0.32, 1, 3); this.dye[this.dye.length - 1] && (this.dye[this.dye.length - 1].c = 1); }
    var bucket = [['', '', ''], ['', '', '']], keep = [], r = 2.7, life = 7.5;
    for (var j = 0; j < this.dye.length; j++) {
      var p = this.dye[j], vv = this.vel(p.x, p.y, U);
      p.x += vv[0] * dt; p.y += vv[1] * dt; p.a += dt;
      var dx = p.x - o.cx, dy = p.y - o.cy;
      if (dx * dx + dy * dy < o.r * o.r) { var dd = Math.sqrt(dx * dx + dy * dy) || 1; p.x = o.cx + dx / dd * o.r * 1.02; p.y = o.cy + dy / dd * o.r * 1.02; }
      if (p.x > o.W + 5 || p.x < -5 || p.y < -5 || p.y > o.H + 5 || p.a > life) continue;
      keep.push(p);
      if (this.quiet) continue;
      var k = p.a < life * 0.45 ? 0 : p.a < life * 0.75 ? 1 : 2;
      bucket[p.c][k] += 'M' + (p.x - r).toFixed(1) + ' ' + p.y.toFixed(1) + 'a' + r + ' ' + r + ' 0 1 0 ' + (2 * r) + ' 0a' + r + ' ' + r + ' 0 1 0 ' + (-2 * r) + ' 0';
    }
    this.dye = keep;
    if (this.quiet) return;
    for (var c2 = 0; c2 < 2; c2++) for (var a2 = 0; a2 < 3; a2++) this.dp[c2 * 3 + a2].setAttribute('d', bucket[c2][a2] || 'M0 0');
    // the incoming streamlines and shear layers keep time with the flow
    var dur = (28 / (U * 0.7)).toFixed(2) + 's';
    if (dur !== this.dur) {
      this.dur = dur;
      [].forEach.call(this.svg.querySelectorAll('.dl-c-stream'), function (sl) { sl.style.animationDuration = dur; });
      var sh = this.svg.querySelector('.dl-shear');
      if (sh) { sh.style.animationDuration = steady ? '3s' : half.toFixed(2) + 's'; sh.classList.toggle('dl-kv-calm', steady); }
    }
  };

  // the street is already there when it scrolls into view: a few seconds are run ahead, off screen
  Sim.prototype.warm = function () {
    this.quiet = true;
    for (var i = 0; i < 420; i++) this.step(1 / 60);
    this.quiet = false; this.warmed = true;
  };
  var sims = [].map.call(fig.querySelectorAll('svg[data-kv]'), function (s) { return new Sim(s); });
  fig.classList.add('dl-kv-on');
  function label() {
    if (!read) return;
    var U = 56 + Re * 0.6, St = 0.198 * (1 - 19.7 / Re), half = Re < 47 ? 0 : 62 / (St * U) / 2;
    read.textContent = Re < 47 ? 'Re ≈ ' + Re + ': too slow to shed. Two eddies sit still behind the cylinder.'
      : Re < 60 ? 'Re ≈ ' + Re + ': just past Re 47, the wake starts to wobble and shed.'
      : 'Re ≈ ' + Re + ': a vortex peels off about every ' + half.toFixed(1) + ' s, top and bottom in turn.';
    if (slider) slider.setAttribute('aria-valuetext', read.textContent);
  }
  if (slider) slider.addEventListener('input', function () { Re = +slider.value; label(); });
  label();

  var visible = false, lastT = 0;
  function frame(now) {
    if (!visible) { lastT = 0; return; }
    var dt = lastT ? Math.min(0.05, (now - lastT) / 1000) : 0.016; lastT = now;
    sims.forEach(function (s) { if (s.svg.getBoundingClientRect().width > 0) { if (!s.warmed) s.warm(); s.step(dt); } });
    requestAnimationFrame(frame);
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { var was = visible; visible = es[0].isIntersecting; if (visible && !was) requestAnimationFrame(frame); }).observe(fig);
  } else { visible = true; requestAnimationFrame(frame); }
})();
