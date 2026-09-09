/* Lumen Terminal — world map.
   Robinson projection over Natural Earth outlines, rendered as one SVG so countries are real
   hit targets. Heat, pins and arcs are driven by the same story corpus as the rest of the app. */
(function (global) {
  'use strict';
  var L = global.Lumen, U = global.UNIVERSE, M = L.M;

  /* ---------- Robinson projection ---------- */
  var AA = [1.0000, 0.9986, 0.9954, 0.9900, 0.9822, 0.9730, 0.9600, 0.9427, 0.9216, 0.8962,
    0.8679, 0.8350, 0.7986, 0.7597, 0.7186, 0.6732, 0.6213, 0.5722, 0.5322];
  var BB = [0.0000, 0.0620, 0.1240, 0.1860, 0.2480, 0.3100, 0.3720, 0.4340, 0.4958, 0.5571,
    0.6176, 0.6769, 0.7346, 0.7903, 0.8435, 0.8936, 0.9394, 0.9761, 1.0000];

  var W = 2000, SCALE = W / (2 * 0.8487 * Math.PI);
  var H = Math.round(2 * 1.3523 * SCALE);

  function robinson(lon, lat) {
    var a = Math.abs(lat) / 5, i = Math.min(17, Math.floor(a)), f = a - i;
    var aa = AA[i] + (AA[i + 1] - AA[i]) * f;
    var bb = BB[i] + (BB[i + 1] - BB[i]) * f;
    var x = 0.8487 * SCALE * aa * (lon * Math.PI / 180) + W / 2;
    var y = H / 2 - 1.3523 * SCALE * bb * (lat < 0 ? -1 : 1);
    return [x, y];
  }
  function equirect(lon, lat) {
    return [(lon + 180) / 360 * W, (90 - lat) / 180 * H];
  }
  var projections = { robinson: robinson, equirect: equirect };
  function project(lon, lat, mode) { return (projections[mode] || robinson)(lon, lat); }

  var SVGNS = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs) {
    var n = document.createElementNS(SVGNS, tag);
    for (var k in attrs) if (attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, attrs[k]);
    return n;
  }

  function buildPaths(mode) {
    var geo = global.WORLD_GEOMETRY || [];
    var out = {};
    geo.forEach(function (c) {
      var d = '';
      c.r.forEach(function (flat) {
        for (var i = 0; i < flat.length; i += 2) {
          var p = project(flat[i] / 100, flat[i + 1] / 100, mode);
          d += (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1);
        }
        d += 'Z';
      });
      out[c.id] = { d: d, n: c.n };
    });
    return out;
  }

  function MapView(host) {
    this.host = host;
    this.mode = L.state.settings.projection || 'robinson';
    this.view = { x: 0, y: 0, w: W, h: H };
    this.heat = {};
    this.pins = [];
    this.arcs = [];
    this.onCountry = null;
    this.onPin = null;
    this.build();
  }

  MapView.prototype.build = function () {
    var self = this;
    L.clear(this.host);
    var root = svg('svg', { class: 'worldmap', viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'xMidYMid meet' });
    this.svg = root;

    var defs = svg('defs');
    var glow = svg('filter', { id: 'lm-glow', x: '-60%', y: '-60%', width: '220%', height: '220%' });
    glow.appendChild(svg('feGaussianBlur', { stdDeviation: '5', result: 'b' }));
    var mrg = svg('feMerge');
    mrg.appendChild(svg('feMergeNode', { in: 'b' }));
    mrg.appendChild(svg('feMergeNode', { in: 'SourceGraphic' }));
    glow.appendChild(mrg);
    defs.appendChild(glow);
    root.appendChild(defs);

    this.gGraticule = svg('g', { class: 'lm-grat' });
    this.gCountries = svg('g', { class: 'lm-countries' });
    this.gArcs = svg('g', { class: 'lm-arcs' });
    this.gPins = svg('g', { class: 'lm-pins' });
    root.appendChild(this.gGraticule);
    root.appendChild(this.gCountries);
    root.appendChild(this.gArcs);
    root.appendChild(this.gPins);

    this.drawGraticule();

    var paths = buildPaths(this.mode);
    this.els = {};
    Object.keys(paths).forEach(function (iso) {
      var p = svg('path', { d: paths[iso].d, class: 'lm-c', 'data-iso': iso });
      p.addEventListener('click', function (e) {
        e.stopPropagation();
        if (self.onCountry) self.onCountry(iso, paths[iso].n);
      });
      p.addEventListener('mouseenter', function () { self.showTip(iso, paths[iso].n); });
      p.addEventListener('mouseleave', function () { self.hideTip(); });
      self.gCountries.appendChild(p);
      self.els[iso] = p;
    });

    this.host.appendChild(root);
    this.tip = L.el('div', { class: 'map-tip', style: { display: 'none' } });
    this.host.appendChild(this.tip);
    this.bindNav();
  };

  MapView.prototype.drawGraticule = function () {
    var g = this.gGraticule, self = this;
    L.clear(g);
    for (var lon = -180; lon <= 180; lon += 30) {
      var d = '';
      for (var lat = -90; lat <= 90; lat += 5) {
        var p = project(lon, lat, self.mode);
        d += (lat === -90 ? 'M' : 'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1);
      }
      g.appendChild(svg('path', { d: d, class: 'lm-grat-l' }));
    }
    for (var la = -60; la <= 60; la += 30) {
      var d2 = '';
      for (var lo = -180; lo <= 180; lo += 5) {
        var q = project(lo, la, self.mode);
        d2 += (lo === -180 ? 'M' : 'L') + q[0].toFixed(1) + ' ' + q[1].toFixed(1);
      }
      g.appendChild(svg('path', { d: d2, class: 'lm-grat-l' }));
    }
  };

  MapView.prototype.setProjection = function (mode) {
    this.mode = mode;
    var paths = buildPaths(mode);
    var self = this;
    Object.keys(this.els).forEach(function (iso) {
      if (paths[iso]) self.els[iso].setAttribute('d', paths[iso].d);
    });
    this.drawGraticule();
    this.renderPins();
    this.renderArcs();
  };

  /* ---------- pan / zoom ---------- */
  MapView.prototype.apply = function () {
    var v = this.view;
    this.svg.setAttribute('viewBox', v.x.toFixed(1) + ' ' + v.y.toFixed(1) + ' ' + v.w.toFixed(1) + ' ' + v.h.toFixed(1));
    this.svg.setAttribute('data-zoom', (W / v.w).toFixed(2));
  };
  MapView.prototype.zoomTo = function (cx, cy, factor) {
    var v = this.view;
    var nw = M.clamp(v.w / factor, W / 14, W);
    var nh = nw * (H / W);
    v.x = M.clamp(cx - (cx - v.x) * (nw / v.w), -W * 0.1, W - nw + W * 0.1);
    v.y = M.clamp(cy - (cy - v.y) * (nh / v.h), -H * 0.1, H - nh + H * 0.1);
    v.w = nw; v.h = nh;
    this.apply();
  };
  MapView.prototype.reset = function () {
    this.view = { x: 0, y: 0, w: W, h: H };
    this.apply();
  };
  MapView.prototype.focusCountry = function (iso) {
    var meta = U.COUNTRIES[iso];
    if (!meta) return;
    var p = project(meta.ll[1], meta.ll[0], this.mode);
    var nw = W / 4.5, nh = nw * (H / W);
    this.view = { x: M.clamp(p[0] - nw / 2, -50, W - nw + 50), y: M.clamp(p[1] - nh / 2, -50, H - nh + 50), w: nw, h: nh };
    this.apply();
  };
  MapView.prototype.bindNav = function () {
    var self = this, drag = null;
    this.svg.addEventListener('wheel', function (e) {
      e.preventDefault();
      var r = self.svg.getBoundingClientRect();
      var v = self.view;
      var cx = v.x + ((e.clientX - r.left) / r.width) * v.w;
      var cy = v.y + ((e.clientY - r.top) / r.height) * v.h;
      self.zoomTo(cx, cy, e.deltaY < 0 ? 1.22 : 1 / 1.22);
    }, { passive: false });
    this.svg.addEventListener('mousedown', function (e) {
      drag = { x: e.clientX, y: e.clientY, vx: self.view.x, vy: self.view.y, moved: false };
      self.svg.classList.add('dragging');
    });
    window.addEventListener('mousemove', function (e) {
      if (!drag) return;
      var r = self.svg.getBoundingClientRect();
      var dx = (e.clientX - drag.x) / r.width * self.view.w;
      var dy = (e.clientY - drag.y) / r.height * self.view.h;
      if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
      self.view.x = drag.vx - dx; self.view.y = drag.vy - dy;
      self.apply();
    });
    window.addEventListener('mouseup', function () {
      if (drag) self.svg.classList.remove('dragging');
      drag = null;
    });
  };

  /* ---------- heat ---------- */
  /* heat: {ISO: {v: 0..1, imp, n, label}} */
  MapView.prototype.setHeat = function (heat, palette) {
    this.heat = heat || {};
    var self = this;
    Object.keys(this.els).forEach(function (iso) {
      var h = self.heat[iso];
      var el = self.els[iso];
      if (!h || !h.v) {
        el.setAttribute('class', 'lm-c' + (U.COUNTRIES[iso] ? ' known' : ''));
        el.style.fill = '';
        return;
      }
      var v = M.clamp(h.v, 0, 1);
      var col = (palette || heatColor)(v, h);
      el.setAttribute('class', 'lm-c known hot');
      el.style.fill = col;
    });
  };
  function heatColor(v, h) {
    /* cold slate → amber → red as attention rises */
    var stops = [[26, 34, 45], [30, 66, 88], [72, 108, 90], [188, 148, 60], [214, 84, 60], [232, 52, 52]];
    var t = v * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(t)), f = t - i;
    var a = stops[i], b = stops[i + 1];
    return 'rgb(' + Math.round(M.lerp(a[0], b[0], f)) + ',' + Math.round(M.lerp(a[1], b[1], f)) + ',' + Math.round(M.lerp(a[2], b[2], f)) + ')';
  }

  /* ---------- pins ---------- */
  /* pins: [{ll:[lat,lon], kind, imp, label, id, data}] */
  MapView.prototype.setPins = function (pins) { this.pins = pins || []; this.renderPins(); };
  MapView.prototype.renderPins = function () {
    var self = this;
    L.clear(this.gPins);
    this.pins.forEach(function (p) {
      var xy = project(p.ll[1], p.ll[0], self.mode);
      var g = svg('g', { class: 'lm-pin lm-pin-' + (p.kind || 'event'), transform: 'translate(' + xy[0].toFixed(1) + ',' + xy[1].toFixed(1) + ')' });
      var r = 4 + (p.imp || 2) * 1.9;
      if (p.pulse) {
        var pulse = svg('circle', { r: r, class: 'lm-pulse' });
        g.appendChild(pulse);
      }
      if (p.kind === 'choke') {
        g.appendChild(svg('path', { d: 'M0,-' + r + ' L' + r + ',0 L0,' + r + ' L-' + r + ',0 Z', class: 'lm-pin-shape' }));
      } else {
        g.appendChild(svg('circle', { r: r, class: 'lm-pin-shape' }));
      }
      g.appendChild(svg('circle', { r: 1.6, class: 'lm-pin-core' }));
      g.addEventListener('click', function (e) { e.stopPropagation(); if (self.onPin) self.onPin(p); });
      g.addEventListener('mouseenter', function () { self.showTipRaw(p.label, p.sub); });
      g.addEventListener('mouseleave', function () { self.hideTip(); });
      self.gPins.appendChild(g);
    });
  };

  /* ---------- arcs between countries in one story ---------- */
  /* arcs: [{from:[lat,lon], to:[lat,lon], w, kind, label}] */
  MapView.prototype.setArcs = function (arcs) { this.arcs = arcs || []; this.renderArcs(); };
  MapView.prototype.renderArcs = function () {
    var self = this;
    L.clear(this.gArcs);
    this.arcs.forEach(function (a) {
      var p1 = project(a.from[1], a.from[0], self.mode);
      var p2 = project(a.to[1], a.to[0], self.mode);
      var dx = p2[0] - p1[0], dy = p2[1] - p1[1];
      var dist = Math.hypot(dx, dy);
      /* bow the arc perpendicular to the chord, always toward the top of the map */
      var mx = (p1[0] + p2[0]) / 2, my = (p1[1] + p2[1]) / 2;
      var lift = M.clamp(dist * 0.22, 12, 150);
      var cx = mx, cy = my - lift;
      var path = svg('path', {
        d: 'M' + p1[0].toFixed(1) + ' ' + p1[1].toFixed(1) + ' Q' + cx.toFixed(1) + ' ' + cy.toFixed(1) + ' ' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1),
        class: 'lm-arc lm-arc-' + (a.kind || 'link'),
        'stroke-width': (0.8 + (a.w || 0.5) * 2.6).toFixed(2)
      });
      if (a.label) {
        path.addEventListener('mouseenter', function () { self.showTipRaw(a.label, a.sub); });
        path.addEventListener('mouseleave', function () { self.hideTip(); });
      }
      self.gArcs.appendChild(path);
    });
  };

  /* ---------- tooltip ---------- */
  MapView.prototype.showTip = function (iso, name) {
    var h = this.heat[iso], meta = U.COUNTRIES[iso];
    var lines = [];
    if (meta) lines.push(U.REGIONS[meta.r] + (meta.idx ? ' · ' + meta.idx : ''));
    if (h) lines.push(h.n + ' stor' + (h.n === 1 ? 'y' : 'ies') + ' · peak impact ' + h.imp + '/5');
    else if (meta) lines.push('no flagged activity in window');
    this.showTipRaw(name || (meta ? meta.n : iso), lines.join('  ·  '));
  };
  MapView.prototype.showTipRaw = function (title, sub) {
    this.tip.innerHTML = '<b>' + L.esc(title) + '</b>' + (sub ? '<span>' + L.esc(sub) + '</span>' : '');
    this.tip.style.display = 'block';
  };
  MapView.prototype.hideTip = function () { this.tip.style.display = 'none'; };
  MapView.prototype.moveTip = function (e) {
    var r = this.host.getBoundingClientRect();
    this.tip.style.left = M.clamp(e.clientX - r.left + 14, 4, r.width - 240) + 'px';
    this.tip.style.top = M.clamp(e.clientY - r.top + 14, 4, r.height - 60) + 'px';
  };

  MapView.prototype.highlight = function (isos) {
    var set = {};
    (isos || []).forEach(function (i) { set[i] = 1; });
    var any = Object.keys(set).length;
    var self = this;
    Object.keys(this.els).forEach(function (iso) {
      self.els[iso].classList.toggle('sel', !!set[iso]);
      self.els[iso].classList.toggle('dim', any && !set[iso]);
    });
  };

  /* ---------- derive heat/pins/arcs from stories ---------- */
  function heatFromStories(stories, hours, filterFn) {
    var cutoff = Date.now() - (hours || 72) * 3600e3;
    var acc = {};
    stories.forEach(function (s) {
      if (s.t < cutoff) return;
      if (filterFn && !filterFn(s)) return;
      (s.countries || []).forEach(function (c, i) {
        var e = acc[c] || (acc[c] = { raw: 0, n: 0, imp: 0 });
        e.raw += (s.imp / 5) * (i === 0 ? 1 : 0.55) * (1 + (Date.now() - s.t < 24 * 3600e3 ? 0.6 : 0));
        e.n++; e.imp = Math.max(e.imp, s.imp);
      });
    });
    var max = Math.max.apply(null, Object.keys(acc).map(function (k) { return acc[k].raw; }).concat([1]));
    Object.keys(acc).forEach(function (k) { acc[k].v = Math.pow(acc[k].raw / max, 0.65); });
    return acc;
  }

  function pinsFromStories(stories, hours, limit) {
    var cutoff = Date.now() - (hours || 48) * 3600e3;
    var recent = stories.filter(function (s) { return s.t >= cutoff && s.imp >= 3; })
      .sort(function (a, b) { return (b.imp - a.imp) || (b.t - a.t); }).slice(0, limit || 26);
    var pins = [], used = {};
    recent.forEach(function (s) {
      var iso = (s.countries || [])[0];
      var meta = U.COUNTRIES[iso];
      if (!meta) return;
      var k = iso + ':' + s.k;
      if (used[k]) return;
      used[k] = 1;
      pins.push({
        ll: meta.ll, kind: s.k === 'conflict' ? 'conflict' : 'event', imp: s.imp,
        label: s.h, sub: s.src + ' · ' + L.F.ago(s.t) + ' ago · ' + meta.n,
        id: s.id, data: s, pulse: s.imp >= 5
      });
    });
    /* chokepoints referenced by recent stories */
    var chokeHits = {};
    recent.forEach(function (s) { if (s.choke) chokeHits[s.choke] = (chokeHits[s.choke] || 0) + s.imp; });
    U.CHOKEPOINTS.forEach(function (cp) {
      if (!chokeHits[cp.id]) return;
      pins.push({
        ll: cp.ll, kind: 'choke', imp: Math.min(5, Math.round(chokeHits[cp.id] / 3)),
        label: cp.n, sub: cp.flow, id: cp.id, data: cp, pulse: true
      });
    });
    return pins;
  }

  function arcsFromStories(stories, hours, limit) {
    var cutoff = Date.now() - (hours || 48) * 3600e3;
    var out = [], seen = {};
    stories.filter(function (s) { return s.t >= cutoff && s.imp >= 3 && (s.countries || []).length > 1; })
      .sort(function (a, b) { return b.imp - a.imp; })
      .slice(0, limit || 30)
      .forEach(function (s) {
        var cs = s.countries.filter(function (c) { return U.COUNTRIES[c]; });
        for (var i = 1; i < cs.length; i++) {
          var key = [cs[0], cs[i]].sort().join('-') + ':' + s.k;
          if (seen[key]) continue;
          seen[key] = 1;
          out.push({
            from: U.COUNTRIES[cs[0]].ll, to: U.COUNTRIES[cs[i]].ll,
            w: s.imp / 5, kind: s.k,
            label: s.h, sub: U.COUNTRIES[cs[0]].n + ' ↔ ' + U.COUNTRIES[cs[i]].n + ' · ' + s.src
          });
        }
      });
    return out;
  }

  global.WORLDMAP = {
    MapView: MapView, project: project, robinson: robinson, W: W, H: H,
    heatFromStories: heatFromStories, pinsFromStories: pinsFromStories, arcsFromStories: arcsFromStories,
    heatColor: heatColor
  };
})(window);
