/* Hero: a data-centre aisle in one-point perspective, drawn twice.
   Left of the divider it is the hall as built: racks, status lights,
   supply and return pipes. Right of it is the same geometry as a twin
   would hold it: a wireframe coloured by temperature. Moving the pointer
   over a rack adds load to it. Illustration only; nothing is solved. */
(function () {
  'use strict';
  var stage = document.getElementById('hero-stage');
  var cv = document.getElementById('hall-canvas');
  var splitEl = document.getElementById('split');
  if (!stage || !cv || !cv.getContext) return;
  var ctx = cv.getContext('2d');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var W = 0, H = 0, dpr = 1, vx = 0, vy = 0, f = 0, bvx = 0, bvy = 0;
  var N = 11, D = 1, Z0 = 1.02, ZMIN = 0.4, U = 13;
  var HALF = 1.3, TOP = -1.02, FLOOR = 0.92, CEIL = -1.52;
  var TW = 0.74, TT = 0.36;            /* immersion tank: depth into the aisle, height of its open top */
  var RUN = (window.__hallRun = (window.__hallRun || 0) + 1);   /* a newer copy of this script takes over */
  var travel = 0, t = 0, split = 1.02, splitTo = 0.5, userSplit = false;
  var ptr = { x: 0, y: 0, nx: 0, ny: 0, inside: false };
  var heat = {};

  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var hash = function (n) { var s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

  /* two palettes: a white hall by day, a charcoal one when the page is switched to dark */
  var LIGHT = {
    bg: '#f8f7f5', glow: 'rgba(255,255,255,.95)', floor: '#ebe7e1', ceil: '#ffffff', tile: [27, 22, 20, 0.03, 0.09],
    lamp: [255, 255, 255, 0.55, 0.45], lampEdge: 'rgba(27,22,20,.14)', shine: [255, 255, 255, 0.15, 0.5],
    upper: '#e3dfd8', body: '#26211f', slotA: '#3b3430', slotB: '#2f2926', edge: 'rgba(255,255,255,.45)',
    wall: '#dedad3', door: '#c6bfb6', supply: '#5fb2e6', ret: '#ea5a1c', retHot: '#c93a12', pulse: '#ffffff',
    ledOk: '#43e08b', ledWarn: '#ffab40', ledLink: '#ffffff', load: '#ff6a35',
    tank: '#d6d1c9', tankEnd: '#c9c3ba', bath: '#bfe3f5',
    tBg: '#fbfaf8', tFloor: '#f4f1ec', tCeil: '#fbfaf8', tGrid: [27, 22, 20, 0.06, 0.22], tWire: 'rgba(27,22,20,.5)', tBody: '#efeae3', tUpper: '#f6f3ee',
    ramp: [[0, 142, 203, 240], [0.28, 207, 230, 243], [0.5, 247, 224, 181], [0.75, 246, 165, 68], [1, 234, 90, 28]]
  };
  var DARK = {
    bg: '#151211', glow: 'rgba(255,214,180,.22)', floor: '#1b1715', ceil: '#0d0b0a', tile: [245, 239, 233, 0.02, 0.07],
    lamp: [255, 238, 220, 0.12, 0.55], lampEdge: 'rgba(0,0,0,0)', shine: [255, 220, 190, 0.02, 0.1],
    upper: '#100e0d', body: '#1f1b19', slotA: '#352e2a', slotB: '#29231f', edge: 'rgba(255,240,225,.22)',
    wall: '#1d1917', door: '#2b2522', supply: '#8fa3b0', ret: '#ff6a35', retHot: '#ff3b2f', pulse: '#ffffff',
    ledOk: '#43e08b', ledWarn: '#ffab40', ledLink: '#ffe9d6', load: '#ff6a35',
    tank: '#29231f', tankEnd: '#312a26', bath: '#22323a',
    tBg: '#120f0e', tFloor: '#171311', tCeil: '#0f0c0b', tGrid: [255, 122, 69, 0.05, 0.22], tWire: 'rgba(255,150,100,.6)', tBody: '#1a1513', tUpper: '#141110',
    ramp: [[0, 58, 47, 42], [0.3, 138, 59, 30], [0.55, 232, 73, 29], [0.8, 255, 179, 71], [1, 255, 241, 201]]
  };
  var C = LIGHT, LUT = [];
  function palette() {
    C = document.documentElement.dataset.mode === 'night' ? DARK : LIGHT;
    LUT = [];
    for (var i = 0; i < 64; i++) {
      var v = i / 63, a = C.ramp[0], b = C.ramp[C.ramp.length - 1];
      for (var k = 0; k < C.ramp.length - 1; k++) if (v >= C.ramp[k][0] && v <= C.ramp[k + 1][0]) { a = C.ramp[k]; b = C.ramp[k + 1]; break; }
      var u = (v - a[0]) / ((b[0] - a[0]) || 1);
      LUT.push('rgb(' + Math.round(a[1] + (b[1] - a[1]) * u) + ',' + Math.round(a[2] + (b[2] - a[2]) * u) + ',' + Math.round(a[3] + (b[3] - a[3]) * u) + ')');
    }
  }
  var ramp = function (v) { return LUT[Math.round(clamp(v, 0, 1) * 63)]; };
  var rgba = function (c, k) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (c[3] + c[4] * k).toFixed(3) + ')'; };

  function size() {
    var r = stage.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var narrow = W < 620;
    bvx = W * 0.5; bvy = H * (narrow ? 0.5 : 0.46);
    f = H * (narrow ? 0.72 : 0.6);
  }

  var P = function (x, y, z) { return [vx + f * x / z, vy + f * y / z]; };
  function quad(a, b, c, d) {
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath();
  }
  function seg(a, b) { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }

  function scene(twin) {
    var frac = travel % D, base = Math.floor(travel / D), zFar = Z0 + N * D;
    var fogBg = twin ? C.tBg : C.bg;
    ctx.globalAlpha = 1;
    ctx.fillStyle = fogBg; ctx.fillRect(0, 0, W, H);

    /* floor and ceiling planes */
    ctx.fillStyle = twin ? C.tFloor : C.floor;
    quad(P(-HALF, FLOOR, ZMIN), P(HALF, FLOOR, ZMIN), P(HALF, FLOOR, zFar), P(-HALF, FLOOR, zFar)); ctx.fill();
    ctx.fillStyle = twin ? C.tCeil : C.ceil;
    quad(P(-HALF, CEIL, ZMIN), P(HALF, CEIL, ZMIN), P(HALF, CEIL, zFar), P(-HALF, CEIL, zFar)); ctx.fill();

    /* end wall and its door */
    var e1 = P(-HALF, CEIL, zFar), e2 = P(HALF, FLOOR, zFar), d1 = P(-0.34, -0.5, zFar), d2 = P(0.34, FLOOR, zFar);
    if (twin) { ctx.strokeStyle = C.tWire; ctx.lineWidth = 1; ctx.strokeRect(e1[0], e1[1], e2[0] - e1[0], e2[1] - e1[1]); ctx.strokeRect(d1[0], d1[1], d2[0] - d1[0], d2[1] - d1[1]); }
    else { ctx.fillStyle = C.wall; ctx.fillRect(e1[0], e1[1], e2[0] - e1[0], e2[1] - e1[1]); ctx.fillStyle = C.door; ctx.fillRect(d1[0], d1[1], d2[0] - d1[0], d2[1] - d1[1]); }

    /* light at the end of the aisle */
    var g = ctx.createRadialGradient(vx, vy, 0, vx, vy, H * 0.5);
    g.addColorStop(0, C.glow); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    /* floor tiles */
    ctx.lineWidth = 1;
    var tl = twin ? C.tGrid : C.tile;
    for (var k = -2; k <= 2; k++) { ctx.strokeStyle = rgba(tl, 1); seg(P(k * HALF / 2, FLOOR, ZMIN), P(k * HALF / 2, FLOOR, zFar)); }
    for (var j = 0; j < N * 2 + 2; j++) {
      var zt = Z0 - 1 + j * 0.5 - (travel % 0.5);
      if (zt < ZMIN) continue;
      ctx.strokeStyle = rgba(tl, clamp(1 - (zt - Z0) / (N * D), 0, 1));
      seg(P(-HALF, FLOOR, zt), P(HALF, FLOOR, zt));
    }

    /* ceiling lights and their sheen on the floor */
    for (var l = 0; l < N / 2 + 2; l++) {
      var zl = Z0 - 1 + l * 2 - (travel % 2);
      var z1 = Math.max(ZMIN, zl), z2 = zl + 0.95;
      if (z2 <= ZMIN) continue;
      var al = clamp(1 - (zl - Z0) / (N * D), 0, 1);
      quad(P(-0.11, CEIL, z1), P(0.11, CEIL, z1), P(0.11, CEIL, z2), P(-0.11, CEIL, z2));
      if (twin) { ctx.strokeStyle = rgba(C.tGrid, al); ctx.stroke(); }
      else {
        ctx.fillStyle = rgba(C.lamp, al); ctx.fill(); ctx.strokeStyle = C.lampEdge; ctx.stroke();
        ctx.fillStyle = rgba(C.shine, al);
        quad(P(-0.34, FLOOR, z1), P(0.34, FLOOR, z1), P(0.34, FLOOR, z2), P(-0.34, FLOOR, z2)); ctx.fill();
      }
    }

    /* racks, far to near */
    var sh = (FLOOR - TOP - 0.08) / U;
    for (var i = N; i >= -1; i--) {
      var zA = Z0 + i * D - frac, zB = zA + D * 0.93;
      if (zB <= ZMIN + 0.02) continue;
      var zN = Math.max(zA, ZMIN);
      var fog = clamp(1 - (zA - Z0) / (N * D), 0, 1);
      var a = 0.12 + 0.88 * Math.pow(fog, 1.2);
      for (var s = -1; s <= 1; s += 2) {
        var id = (i + base) * 2 + (s > 0 ? 1 : 0);
        var hot = heat[id] || 0;
        if (s > 0) { tank(id, hot, a, zA, twin); continue; }
        var X = s * HALF;
        ctx.globalAlpha = a;
        /* panel above the rack, up to the ceiling */
        ctx.fillStyle = twin ? C.tUpper : C.upper;
        quad(P(X, CEIL, zN), P(X, CEIL, zA + D), P(X, TOP, zA + D), P(X, TOP, zN)); ctx.fill();
        /* rack body */
        ctx.fillStyle = twin ? C.tBody : C.body;
        quad(P(X, TOP, zN), P(X, TOP, zB), P(X, FLOOR, zB), P(X, FLOOR, zN)); ctx.fill();
        if (twin) { ctx.strokeStyle = C.tWire; ctx.lineWidth = 1; ctx.stroke(); }
        /* server slots */
        var s1 = Math.max(zA + 0.14, ZMIN), s2 = zB - 0.06;
        for (var r = 0; r < U; r++) {
          var y0 = TOP + 0.05 + r * sh, y1 = y0 + sh * 0.76;
          if (twin) {
            var T = 0.1 + 0.3 * hash(id * 13.7) + 0.2 * (1 - r / (U - 1)) + 0.12 * Math.sin(t * 0.9 + id * 1.7 + r * 0.45) + hot * (0.45 + 0.25 * hash(id + r * 3.1));
            ctx.fillStyle = ramp(T);
          } else ctx.fillStyle = (r % 4 === 3) ? C.slotB : C.slotA;
          quad(P(X, y0, s1), P(X, y0, s2), P(X, y1, s2), P(X, y1, s1)); ctx.fill();
          if (!twin) {
            if (hot > 0.02) {
              ctx.globalAlpha = a * hot * 0.85; ctx.fillStyle = C.load;
              quad(P(X, y0, s1), P(X, y0, s2), P(X, y1, s2), P(X, y1, s1)); ctx.fill();
              ctx.globalAlpha = a;
            }
            /* status lights at the near end of each server */
            var zL = zA + 0.2;
            if (zL > ZMIN + 0.05) {
              var sz = Math.max(1.6, f * 0.015 / zL), ym = (y0 + y1) / 2;
              var seed = id * 31 + r * 7.3, rate = 0.6 + hash(seed) * 2.2;
              var on1 = hash(seed + Math.floor(t * rate)) > 0.22;
              var on2 = hash(seed * 1.7 + Math.floor(t * rate * 1.9)) > 0.45;
              var p1 = P(X, ym, zL), p2 = P(X, ym, zL + 0.07);
              ctx.fillStyle = hot > 0.35 ? C.ledWarn : (hash(seed * 3.3) > 0.88 ? C.ledWarn : C.ledOk);
              if (on1) ctx.fillRect(p1[0] - sz / 2, p1[1] - sz / 2, sz, sz);
              ctx.fillStyle = C.ledLink;
              if (on2) ctx.fillRect(p2[0] - sz / 2, p2[1] - sz / 2, sz, sz);
            }
          }
        }
        /* direct-to-chip manifold down the rack's near end: supply and return */
        var zm = zA + 0.045;
        if (zm > ZMIN + 0.03) {
          ctx.lineWidth = Math.max(1.4, f * 0.013 / zm);
          ctx.strokeStyle = C.supply; seg(P(X, TOP + 0.04, zm), P(X, FLOOR - 0.04, zm));
          ctx.strokeStyle = hot > 0.3 ? C.retHot : C.ret; seg(P(X, TOP + 0.04, zm + 0.05), P(X, FLOOR - 0.04, zm + 0.05));
        }
        /* near edge of the rack catches the light */
        if (zA > ZMIN) {
          ctx.strokeStyle = twin ? C.tWire : C.edge; ctx.lineWidth = twin ? 1 : 1.5;
          seg(P(X, TOP, zA), P(X, FLOOR, zA));
        }
        /* supply and return drops from the overhead pipes */
        var zd = zA + 0.32;
        if (zd > ZMIN + 0.1) {
          var py = CEIL + 0.2;
          ctx.lineWidth = Math.max(1, f * 0.014 / zd);
          ctx.strokeStyle = C.supply; seg(P(s * 1.2, py, zd), P(s * 1.2, TOP, zd));
          ctx.strokeStyle = hot > 0.3 ? C.retHot : C.ret; seg(P(s * 1.08, py, zd + 0.3), P(s * 1.08, TOP, zd + 0.3));
        }
      }
    }
    ctx.globalAlpha = 1;

    /* overhead pipes: supply outboard, return inboard */
    [[1.2, C.supply, 1], [1.08, C.ret, -1]].forEach(function (p) {
      for (var sd = -1; sd <= 1; sd += 2) {
        var x = sd * p[0], y = CEIL + 0.2, w = 0.03;
        var a1 = P(x - w, y, ZMIN), a2 = P(x + w, y, ZMIN), b1 = P(x + w, y, zFar), b2 = P(x - w, y, zFar);
        var lg = ctx.createLinearGradient(a1[0], a1[1], b1[0], b1[1]);
        lg.addColorStop(0, p[1]); lg.addColorStop(0.75, p[1]); lg.addColorStop(1, fogBg);
        ctx.globalAlpha = 0.95; ctx.fillStyle = lg;
        quad(a1, a2, b1, b2); ctx.fill();
        /* pulses of flow: supply runs away from you, return comes back */
        ctx.fillStyle = C.pulse;
        for (var q = 0; q < 9; q++) {
          var u = ((q / 9 + p[2] * t * 0.09) % 1 + 1) % 1;
          var zp = Z0 + 0.4 + u * (zFar - Z0 - 0.4);
          ctx.globalAlpha = 0.9 * clamp(1 - (zp - Z0) / (N * D), 0, 1) * clamp((zp - Z0 - 0.4) * 2, 0, 1);
          quad(P(x - w, y, zp), P(x + w, y, zp), P(x + w, y, zp + 0.16), P(x - w, y, zp + 0.16)); ctx.fill();
        }
      }
    });
    ctx.globalAlpha = 1;
  }

  /* one immersion tank: a waist-high bath with boards standing in the fluid */
  function tank(id, hot, a, zA, twin) {
    var zB = zA + D * 0.9, zN = Math.max(zA, ZMIN), X1 = HALF, X0 = HALF - TW, k;
    ctx.globalAlpha = a;
    ctx.fillStyle = twin ? C.tUpper : C.upper;                       /* wall behind the tanks */
    quad(P(X1, CEIL, zN), P(X1, CEIL, zA + D), P(X1, TT, zA + D), P(X1, TT, zN)); ctx.fill();
    var hy = TT - 0.3;                                               /* supply and return headers along the wall */
    ctx.lineWidth = Math.max(1, f * 0.011 / Math.max(zN, 0.8));
    ctx.strokeStyle = C.supply; seg(P(X1, hy, zN), P(X1, hy, zA + D));
    ctx.strokeStyle = hot > 0.3 ? C.retHot : C.ret; seg(P(X1, hy - 0.09, zN), P(X1, hy - 0.09, zA + D));
    ctx.fillStyle = twin ? C.tBody : C.tank;                         /* side facing the aisle */
    quad(P(X0, TT, zN), P(X0, TT, zB), P(X0, FLOOR, zB), P(X0, FLOOR, zN)); ctx.fill();
    if (twin) { ctx.strokeStyle = C.tWire; ctx.lineWidth = 1; ctx.stroke(); }
    var b1 = Math.max(zA + 0.05, ZMIN), b2 = zB - 0.05;
    if (b2 > b1) {                                                   /* the bath, seen from above */
      ctx.fillStyle = twin ? ramp(0.06 + 0.16 * hash(id * 5.1) + hot * 0.35) : C.bath;
      quad(P(X0 + 0.05, TT, b1), P(X1 - 0.03, TT, b1), P(X1 - 0.03, TT, b2), P(X0 + 0.05, TT, b2)); ctx.fill();
      var NB = 8, pitch = (zB - zA - 0.16) / NB;
      for (k = 0; k < NB; k++) {
        var zk = zA + 0.08 + k * pitch + pitch * 0.2, zk2 = zk + pitch * 0.55;
        if (zk < ZMIN) continue;
        if (twin) ctx.fillStyle = ramp(0.12 + 0.3 * hash(id * 13.7) + 0.16 * (k / NB) + 0.12 * Math.sin(t * 0.9 + id * 1.7 + k * 0.6) + hot * (0.45 + 0.25 * hash(id + k * 3.1)));
        else ctx.fillStyle = (k % 3 === 2) ? C.slotB : C.slotA;
        quad(P(X0 + 0.11, TT, zk), P(X1 - 0.09, TT, zk), P(X1 - 0.09, TT, zk2), P(X0 + 0.11, TT, zk2)); ctx.fill();
        if (!twin && hot > 0.02) { ctx.globalAlpha = a * hot * 0.85; ctx.fillStyle = C.load; ctx.fill(); ctx.globalAlpha = a; }
      }
    }
    if (zA > ZMIN) {                                                 /* near end of the tank */
      ctx.fillStyle = twin ? C.tBody : C.tankEnd;
      quad(P(X0, TT, zA), P(X1, TT, zA), P(X1, FLOOR, zA), P(X0, FLOOR, zA)); ctx.fill();
      if (twin) { ctx.strokeStyle = C.tWire; ctx.lineWidth = 1; ctx.stroke(); }
      else {
        var q1 = P(X0 + 0.07, TT + 0.07, zA), q2 = P(X0 + 0.34, TT + 0.2, zA);
        ctx.fillStyle = C.slotB; ctx.fillRect(q1[0], q1[1], q2[0] - q1[0], q2[1] - q1[1]);        /* service panel */
        var sz = Math.max(1.8, f * 0.018 / zA), p1 = P(X0 + 0.1, TT + 0.12, zA), on = hash(id * 9.1 + Math.floor(t * 1.3)) > 0.2;
        ctx.fillStyle = hot > 0.35 ? C.ledWarn : C.ledOk; if (on) ctx.fillRect(p1[0], p1[1], sz, sz);
        ctx.fillStyle = C.ledLink; ctx.fillRect(p1[0] + sz * 2, p1[1], sz, sz);
      }
    }
    ctx.strokeStyle = twin ? C.tWire : C.edge; ctx.lineWidth = twin ? 1 : 1.5;   /* rim along the aisle */
    seg(P(X0, TT, zN), P(X0, TT, zB));
    var zd = zA + 0.32;                                              /* supply and return drops into the bath */
    if (zd > ZMIN + 0.1) {
      ctx.lineWidth = Math.max(1, f * 0.014 / zd);
      ctx.strokeStyle = C.supply; seg(P(1.2, CEIL + 0.2, zd), P(1.2, TT, zd));
      ctx.strokeStyle = hot > 0.3 ? C.retHot : C.ret; seg(P(1.08, CEIL + 0.2, zd + 0.3), P(1.08, TT, zd + 0.3));
    }
  }

  var read = document.getElementById('rack-read'), shown = null;
  function label(id) {
    if (!read || id === shown) return;
    shown = id;
    if (id === null) { read.hidden = true; return; }
    var n = ((Math.floor(id / 2) % 24) + 24) % 24 + 1;
    read.textContent = (id % 2 ? 'Tank B' : 'Rack A') + (n < 10 ? '0' : '') + n + ': load rising';
    read.hidden = false;
  }
  function pick(dt) {
    for (var k in heat) { heat[k] -= dt * 0.28; if (heat[k] <= 0) delete heat[k]; }
    if (!ptr.inside) return label(null);
    var dx = ptr.x - vx;
    if (Math.abs(dx) < 6) return label(null);
    var s = dx < 0 ? -1 : 1, z = f * HALF / Math.abs(dx), y = (ptr.y - vy) * z / f, far = Z0 + N * D;
    if (s < 0) { if (y < TOP || y > FLOOR || z < ZMIN || z > far) return label(null); }
    else {
      /* a tank: its aisle-facing side first, then its open top */
      var hit = false, zz = f * (HALF - TW) / dx, yy = (ptr.y - vy) * zz / f;
      if (yy >= TT && yy <= FLOOR && zz >= ZMIN && zz <= far) hit = true;
      else if (ptr.y - vy > 2) { zz = f * TT / (ptr.y - vy); var xx = dx * zz / f; hit = xx >= HALF - TW && xx <= HALF && zz >= ZMIN && zz <= far; }
      if (!hit) return label(null);
      z = zz;
    }
    var i = Math.floor((z - Z0 + (travel % D)) / D), id = (i + Math.floor(travel / D)) * 2 + (s > 0 ? 1 : 0);
    heat[id] = clamp((heat[id] || 0) + dt * 3.4, 0, 1);
    /* the load spills a little into the neighbours on the same row */
    heat[id - 2] = clamp((heat[id - 2] || 0) + dt * 1.1, 0, 0.55); heat[id + 2] = clamp((heat[id + 2] || 0) + dt * 1.1, 0, 0.55);
    label(id);
  }

  function draw() {
    vx += (bvx - ptr.nx * 26 - vx) * 0.08; vy += (bvy - ptr.ny * 14 - vy) * 0.08;
    var sx = clamp(split, 0, 1) * W;
    /* the handle always sits exactly where the picture is cut */
    var want = (clamp(split, 0, 1) * 100).toFixed(2) + '%';
    if (splitEl.style.left !== want) splitEl.style.left = want;
    if (sx > 0) { ctx.save(); ctx.beginPath(); ctx.rect(0, 0, sx, H); ctx.clip(); scene(false); ctx.restore(); }
    if (sx < W) { ctx.save(); ctx.beginPath(); ctx.rect(sx, 0, W - sx, H); ctx.clip(); scene(true); ctx.restore(); }
  }

  function setSplit(v) {
    split = v;
    splitEl.style.left = (clamp(v, 0, 1) * 100).toFixed(2) + '%';
    splitEl.setAttribute('aria-valuenow', String(Math.round(clamp(v, 0, 1) * 100)));
  }

  /* ---- input ---- */
  window.addEventListener('pointermove', function (e) {
    var r = stage.getBoundingClientRect();
    ptr.x = e.clientX - r.left; ptr.y = e.clientY - r.top;
    ptr.inside = ptr.x >= 0 && ptr.y >= 0 && ptr.x <= r.width && ptr.y <= r.height;
    ptr.nx = clamp(ptr.x / r.width * 2 - 1, -1, 1); ptr.ny = clamp(ptr.y / r.height * 2 - 1, -1, 1);
    if (reduce) once();
  }, { passive: true });
  document.addEventListener('pointerleave', function () { ptr.inside = false; });

  var dragging = false;
  splitEl.addEventListener('pointerdown', function (e) { dragging = true; userSplit = true; splitEl.setPointerCapture(e.pointerId); e.preventDefault(); });
  splitEl.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    var r = stage.getBoundingClientRect();
    splitTo = clamp((e.clientX - r.left) / r.width, 0.04, 0.96); setSplit(splitTo);
    if (reduce) once();
  });
  var endDrag = function () { dragging = false; };
  splitEl.addEventListener('pointerup', endDrag); splitEl.addEventListener('pointercancel', endDrag);
  splitEl.addEventListener('keydown', function (e) {
    var d = e.key === 'ArrowLeft' ? -0.04 : e.key === 'ArrowRight' ? 0.04 : 0;
    if (e.key === 'Home') { splitTo = 0.04; d = 1e-9; }
    if (e.key === 'End') { splitTo = 0.96; d = 1e-9; }
    if (!d) return;
    e.preventDefault(); userSplit = true;
    splitTo = clamp(splitTo + (Math.abs(d) > 1e-6 ? d : 0), 0.04, 0.96);
    if (reduce) { setSplit(splitTo); once(); }
  });

  /* ---- loop ---- */
  var visible = true, last = 0, lastY = window.scrollY, sv = 0;
  function once() { size(); vx = bvx; vy = bvy; draw(); }
  function frame(now) {
    if (RUN !== window.__hallRun) return;
    var dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016); last = now;
    if (visible && !document.hidden) {
      var y = window.scrollY; sv += ((y - lastY) - sv) * 0.1; lastY = y;
      t += dt; travel += dt * (0.3 + Math.min(3, Math.abs(sv) * 0.07));
      if (!dragging && Math.abs(splitTo - split) > 0.0005) setSplit(split + (splitTo - split) * 0.06);
      pick(dt); draw();
    }
    requestAnimationFrame(frame);
  }

  palette(); size();
  if ('ResizeObserver' in window) new ResizeObserver(function () { size(); if (reduce) once(); }).observe(stage);
  else window.addEventListener('resize', function () { size(); if (reduce) once(); });
  if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { visible = e[0].isIntersecting; last = 0; }).observe(stage);
  var retheme = function () { palette(); if (reduce) once(); };
  window.addEventListener('themechange', retheme);
  if ('MutationObserver' in window) new MutationObserver(retheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-mode'] });

  vx = bvx; vy = bvy;
  if (reduce) { t = 3.1; travel = 0.35; setSplit(splitTo); draw(); }
  else { setSplit(1.02); requestAnimationFrame(frame); }
})();
