/* Lumen Terminal — canvas chart primitives. No external chart library. */
(function (global) {
  'use strict';
  var L = global.Lumen, M = L.M;

  function theme() {
    var cs = getComputedStyle(document.documentElement);
    function v(n, d) { return (cs.getPropertyValue(n) || '').trim() || d; }
    return {
      bg: v('--panel', '#ffffff'), grid: v('--grid', '#eceef1'), text: v('--dim', '#55595f'),
      up: v('--up', '#0a7d4f'), down: v('--down', '#c0342b'), accent: v('--accent', '#111318'),
      warn: v('--warn', '#9a6400'), line: v('--line', '#e3e5e8'),
      onAccent: v('--on-accent', '#ffffff')
    };
  }

  function setup(cv) {
    var dpr = window.devicePixelRatio || 1;
    var w = cv.clientWidth || (cv.parentNode && cv.parentNode.clientWidth) || 600;
    var h = cv.clientHeight || 240;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    }
    var ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx: ctx, w: w, h: h, t: theme() };
  }

  function niceTicks(lo, hi, n) {
    if (!isFinite(lo) || !isFinite(hi) || lo === hi) return [lo];
    var span = hi - lo, step = Math.pow(10, Math.floor(Math.log10(span / n)));
    var err = (span / n) / step;
    if (err >= 7.5) step *= 10; else if (err >= 3.5) step *= 5; else if (err >= 1.5) step *= 2;
    var out = [], v = Math.ceil(lo / step) * step;
    while (v <= hi + step * 0.001) { out.push(v); v += step; }
    return out;
  }

  function fmtAxis(v) {
    var a = Math.abs(v);
    if (a >= 1e9) return (v / 1e9).toFixed(1) + 'B';
    if (a >= 1e6) return (v / 1e6).toFixed(1) + 'M';
    if (a >= 1e4) return (v / 1e3).toFixed(0) + 'K';
    if (a >= 100) return v.toFixed(0);
    if (a >= 1) return v.toFixed(2);
    return v.toFixed(3);
  }

  /* ---------- candlesticks with FVG zones ---------- */
  function candles(cv, bars, opts) {
    opts = opts || {};
    var s = setup(cv), ctx = s.ctx, t = s.t;
    if (!bars || !bars.length) { empty(s, 'no bars'); return null; }
    var padL = 6, padR = 56, padT = 8, padB = 20;
    var plotW = s.w - padL - padR, plotH = s.h - padT - padB;
    var view = bars.slice(-(opts.window || 160));
    var lo = Infinity, hi = -Infinity;
    view.forEach(function (b) { lo = Math.min(lo, b.l); hi = Math.max(hi, b.h); });
    (opts.gaps || []).forEach(function (g) {
      if (g.i >= bars.length - view.length) { lo = Math.min(lo, g.bot); hi = Math.max(hi, g.top); }
    });
    var pad = (hi - lo) * 0.06 || 1;
    lo -= pad; hi += pad;
    var n = view.length, cw = plotW / n;
    var off = bars.length - view.length;

    function x(i) { return padL + (i + 0.5) * cw; }
    function y(v) { return padT + (1 - (v - lo) / (hi - lo)) * plotH; }

    /* grid */
    ctx.strokeStyle = t.grid; ctx.fillStyle = t.text; ctx.lineWidth = 1;
    ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
    niceTicks(lo, hi, 5).forEach(function (v) {
      var yy = Math.round(y(v)) + 0.5;
      ctx.beginPath(); ctx.moveTo(padL, yy); ctx.lineTo(padL + plotW, yy); ctx.stroke();
      ctx.fillText(fmtAxis(v), padL + plotW + 6, yy + 3);
    });
    /* day separators */
    var lastDay = null;
    view.forEach(function (b, i) {
      var d = L.F.date(new Date(b.t));
      if (lastDay && d !== lastDay) {
        ctx.strokeStyle = t.line;
        ctx.beginPath(); ctx.moveTo(Math.round(x(i) - cw / 2) + 0.5, padT); ctx.lineTo(Math.round(x(i) - cw / 2) + 0.5, padT + plotH); ctx.stroke();
        if (cw > 6) { ctx.fillStyle = t.text; ctx.fillText(d.slice(5), x(i) - cw / 2 + 3, s.h - 6); }
      }
      lastDay = d;
    });

    /* FVG zones */
    var maxAge = opts.maxAge || 200;
    (opts.gaps || []).forEach(function (g) {
      var gi = g.i - off;
      /* the bar where this zone stops mattering: mitigation, or the end of its lifespan */
      var endAbs = (g.filled && g.fillIdx !== null) ? g.fillIdx : g.i + maxAge;
      var endI = endAbs - off;
      if (endI < 0 || gi >= n) return;            /* entirely before/after the visible window */
      var x0 = padL + Math.max(0, gi - 2) * cw;
      var x1 = padL + M.clamp(endI + 1, 0, n) * cw;
      if (x1 - x0 < 2) return;
      ctx.fillStyle = g.dir === 1
        ? (g.filled ? 'rgba(10,125,79,0.07)' : 'rgba(10,125,79,0.15)')
        : (g.filled ? 'rgba(192,52,43,0.07)' : 'rgba(192,52,43,0.15)');
      ctx.fillRect(x0, y(g.top), Math.max(2, x1 - x0), Math.max(1, y(g.bot) - y(g.top)));
      if (!g.filled) {
        ctx.strokeStyle = g.dir === 1 ? 'rgba(10,125,79,0.55)' : 'rgba(192,52,43,0.55)';
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(x0, y(g.top), Math.max(2, x1 - x0), Math.max(1, y(g.bot) - y(g.top)));
        ctx.setLineDash([]);
      }
    });

    /* candles */
    var bw = Math.max(1, Math.min(cw * 0.72, 14));
    view.forEach(function (b, i) {
      var up = b.c >= b.o;
      var col = up ? t.up : t.down;
      ctx.strokeStyle = col; ctx.fillStyle = col;
      var xx = Math.round(x(i)) + (bw % 2 ? 0.5 : 0);
      ctx.beginPath(); ctx.moveTo(xx, y(b.h)); ctx.lineTo(xx, y(b.l)); ctx.stroke();
      var yo = y(b.o), yc = y(b.c);
      var top = Math.min(yo, yc), hgt = Math.max(1, Math.abs(yc - yo));
      if (bw <= 2) { ctx.fillRect(xx - 0.5, top, 1.5, hgt); }
      else if (up) { ctx.fillRect(xx - bw / 2, top, bw, hgt); }
      else { ctx.fillRect(xx - bw / 2, top, bw, hgt); }
    });

    /* trades */
    (opts.trades || []).forEach(function (tr) {
      var ei = view.findIndex(function (b) { return b.t >= tr.entryT; });
      var xi = view.findIndex(function (b) { return b.t >= tr.exitT; });
      if (ei < 0) return;
      ctx.strokeStyle = tr.pl > 0 ? t.up : t.down;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x(ei), y(tr.entry));
      ctx.lineTo(x(xi < 0 ? n - 1 : xi), y(tr.exit)); ctx.stroke();
      ctx.lineWidth = 1;
      ctx.fillStyle = tr.dir === 1 ? t.up : t.down;
      ctx.beginPath(); ctx.arc(x(ei), y(tr.entry), 2.6, 0, 6.3); ctx.fill();
    });

    /* flagged bars from the behaviour scan */
    var MK = {
      sweep: { c: '#9a6400' }, climax: { c: '#c0342b' },
      churn: { c: '#5b4bb5' }, unexplained: { c: '#1f4f8f' },
      absorbed: { c: '#1d6b78' }, gapfade: { c: '#8a4f9e' }
    };
    (opts.marks || []).forEach(function (m) {
      var mi = m.i - off;
      if (mi < 0 || mi >= n) return;
      var spec = MK[m.kind] || { c: t.accent };
      var b = view[mi];
      var above = m.dir < 0 || m.kind === 'climax';
      var yy = above ? y(b.h) - 7 : y(b.l) + 7;
      ctx.fillStyle = spec.c;
      ctx.globalAlpha = 0.35 + (m.sev || 0.5) * 0.65;
      ctx.beginPath();
      if (above) {
        ctx.moveTo(x(mi), yy + 5); ctx.lineTo(x(mi) - 4, yy - 2); ctx.lineTo(x(mi) + 4, yy - 2);
      } else {
        ctx.moveTo(x(mi), yy - 5); ctx.lineTo(x(mi) - 4, yy + 2); ctx.lineTo(x(mi) + 4, yy + 2);
      }
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
    });

    /* last price */
    var last = view[view.length - 1];
    ctx.fillStyle = last.c >= last.o ? t.up : t.down;
    ctx.fillRect(padL + plotW, y(last.c) - 7, padR, 14);
    ctx.fillStyle = t.onAccent; ctx.font = 'bold 10px ui-monospace, monospace';
    ctx.fillText(fmtAxis(last.c), padL + plotW + 5, y(last.c) + 3.5);

    return { x: x, y: y, view: view, off: off, padL: padL, plotW: plotW, cw: cw };
  }

  function empty(s, msg) {
    s.ctx.fillStyle = s.t.text;
    s.ctx.font = '11px ui-monospace, monospace';
    s.ctx.fillText(msg || 'no data', 10, s.h / 2);
  }

  /* ---------- line / equity ---------- */
  function line(cv, series, opts) {
    opts = opts || {};
    var s = setup(cv), ctx = s.ctx, t = s.t;
    if (!series || series.length < 2) { empty(s); return; }
    var vals = series.map(function (p) { return typeof p === 'number' ? p : p.c !== undefined ? p.c : p.e; });
    var lo = opts.min !== undefined ? opts.min : Math.min.apply(null, vals);
    var hi = opts.max !== undefined ? opts.max : Math.max.apply(null, vals);
    if (lo === hi) { lo -= 1; hi += 1; }
    var padL = 6, padR = opts.axis === false ? 6 : 50, padT = 8, padB = opts.axis === false ? 6 : 16;
    var plotW = s.w - padL - padR, plotH = s.h - padT - padB;
    function x(i) { return padL + (i / (vals.length - 1)) * plotW; }
    function y(v) { return padT + (1 - (v - lo) / (hi - lo)) * plotH; }

    if (opts.axis !== false) {
      ctx.strokeStyle = t.grid; ctx.fillStyle = t.text; ctx.font = '10px ui-monospace, monospace';
      niceTicks(lo, hi, 4).forEach(function (v) {
        var yy = Math.round(y(v)) + 0.5;
        ctx.beginPath(); ctx.moveTo(padL, yy); ctx.lineTo(padL + plotW, yy); ctx.stroke();
        ctx.fillText(opts.pctAxis ? (v * 100).toFixed(0) + '%' : fmtAxis(v), padL + plotW + 5, yy + 3);
      });
    }
    if (opts.zero !== undefined && opts.zero >= lo && opts.zero <= hi) {
      ctx.strokeStyle = t.line; ctx.setLineDash([2, 3]);
      var zy = Math.round(y(opts.zero)) + 0.5;
      ctx.beginPath(); ctx.moveTo(padL, zy); ctx.lineTo(padL + plotW, zy); ctx.stroke();
      ctx.setLineDash([]);
    }

    var col = opts.color || (vals[vals.length - 1] >= vals[0] ? t.up : t.down);
    if (opts.fill !== false) {
      var grad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
      grad.addColorStop(0, hexA(col, 0.26)); grad.addColorStop(1, hexA(col, 0));
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.moveTo(x(0), padT + plotH);
      vals.forEach(function (v, i) { ctx.lineTo(x(i), y(v)); });
      ctx.lineTo(x(vals.length - 1), padT + plotH); ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = col; ctx.lineWidth = opts.lw || 1.6;
    ctx.beginPath();
    vals.forEach(function (v, i) { i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v)); });
    ctx.stroke(); ctx.lineWidth = 1;

    if (opts.markers) {
      opts.markers.forEach(function (m) {
        var xi = Math.round(m.i * (vals.length - 1) / (opts.markerScale || (vals.length - 1)));
        ctx.fillStyle = m.color || t.warn;
        ctx.beginPath(); ctx.arc(x(m.i), y(vals[m.i]), 2.5, 0, 6.3); ctx.fill();
      });
    }
  }

  function hexA(hex, a) {
    var h = String(hex).replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (h.length !== 6) return 'rgba(76,154,255,' + a + ')';
    return 'rgba(' + parseInt(h.slice(0, 2), 16) + ',' + parseInt(h.slice(2, 4), 16) + ',' + parseInt(h.slice(4, 6), 16) + ',' + a + ')';
  }

  function spark(cv, vals, color) {
    var s = setup(cv), ctx = s.ctx;
    if (!vals || vals.length < 2) return;
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    if (lo === hi) { lo -= 1; hi += 1; }
    var col = color || (vals[vals.length - 1] >= vals[0] ? s.t.up : s.t.down);
    ctx.strokeStyle = col; ctx.lineWidth = 1.2;
    ctx.beginPath();
    vals.forEach(function (v, i) {
      var x = (i / (vals.length - 1)) * (s.w - 2) + 1;
      var y = (1 - (v - lo) / (hi - lo)) * (s.h - 4) + 2;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.stroke();
  }

  /* ---------- histogram / bars ---------- */
  function hbars(cv, items, opts) {
    opts = opts || {};
    var s = setup(cv), ctx = s.ctx, t = s.t;
    if (!items || !items.length) { empty(s); return; }
    var max = Math.max.apply(null, items.map(function (i) { return Math.abs(i.v); })) || 1;
    var padL = opts.labelW || 74, padR = 44;
    var rowH = Math.min(opts.rowH || 20, (s.h - 4) / items.length);
    ctx.font = '10px ui-monospace, monospace';
    items.forEach(function (it, i) {
      var y = 2 + i * rowH;
      ctx.fillStyle = t.text; ctx.textAlign = 'right';
      ctx.fillText(String(it.k).slice(0, 14), padL - 6, y + rowH * 0.68);
      ctx.textAlign = 'left';
      var w = (Math.abs(it.v) / max) * (s.w - padL - padR);
      /* counts are not directional — colouring them green reads as "good" when it only means
         "more". Directional series keep the up/down encoding. */
      ctx.fillStyle = it.color || (opts.neutral ? t.accent : (it.v >= 0 ? t.up : t.down));
      ctx.fillRect(padL, y + 2, Math.max(1, w), rowH - 6);
      ctx.fillStyle = t.text;
      ctx.fillText(opts.fmt ? opts.fmt(it.v) : fmtAxis(it.v), padL + w + 5, y + rowH * 0.68);
    });
  }

  /* ---------- calendar heatmap ---------- */
  function calendar(cv, days, opts) {
    opts = opts || {};
    var s = setup(cv), ctx = s.ctx, t = s.t;
    if (!days || !days.length) { empty(s); return; }
    var max = Math.max.apply(null, days.map(function (d) { return d.v; })) || 1;
    var cols = Math.ceil(days.length / 7);
    var cell = Math.min(Math.floor((s.w - 26) / cols), Math.floor((s.h - 18) / 7));
    cell = Math.max(6, cell);
    var ox = 24, oy = 4;
    ctx.font = '9px ui-monospace, monospace';
    ['M', 'T', 'W', 'T', 'F', 'S', 'S'].forEach(function (d, i) {
      ctx.fillStyle = t.text; ctx.fillText(d, 6, oy + i * cell + cell * 0.75);
    });
    days.forEach(function (d, i) {
      var date = new Date(d.d + 'T00:00:00Z');
      var dow = (date.getUTCDay() + 6) % 7;      // Mon=0
      var col = Math.floor(i / 7);
      var wk = Math.floor((i + ((7 - ((days.length % 7) || 7)) % 7)) / 7);
      var x = ox + (d.col !== undefined ? d.col : Math.floor(i / 7)) * cell;
      x = ox + (d.week !== undefined ? d.week : col) * cell;
      var y = oy + dow * cell;
      var a = d.v / max;
      ctx.fillStyle = d.v === 0 ? 'rgba(255,255,255,0.04)' : hexA(d.ev ? t.warn : t.accent, 0.18 + a * 0.8);
      ctx.fillRect(x, y, cell - 2, cell - 2);
      if (d.ev) {
        ctx.strokeStyle = hexA(t.warn, 0.9);
        ctx.strokeRect(x + 0.5, y + 0.5, cell - 3, cell - 3);
      }
    });
    return { cell: cell, ox: ox, oy: oy };
  }

  /* ---------- scatter (probability × impact) ---------- */
  function scatter(cv, pts, opts) {
    opts = opts || {};
    var s = setup(cv), ctx = s.ctx, t = s.t;
    var padL = 40, padB = 24, padT = 12, padR = 12;
    var plotW = s.w - padL - padR, plotH = s.h - padT - padB;
    var maxX = opts.maxX || 1, maxY = opts.maxY || Math.max.apply(null, pts.map(function (p) { return Math.abs(p.y); })) || 1;
    ctx.strokeStyle = t.grid; ctx.fillStyle = t.text; ctx.font = '9px ui-monospace, monospace';
    for (var i = 0; i <= 4; i++) {
      var yy = Math.round(padT + (i / 4) * plotH) + 0.5;
      ctx.beginPath(); ctx.moveTo(padL, yy); ctx.lineTo(padL + plotW, yy); ctx.stroke();
      ctx.fillText(((1 - i / 4) * maxY).toFixed(1), 4, yy + 3);
      var xx = Math.round(padL + (i / 4) * plotW) + 0.5;
      ctx.beginPath(); ctx.moveTo(xx, padT); ctx.lineTo(xx, padT + plotH); ctx.stroke();
      ctx.fillText(((i / 4) * maxX * 100).toFixed(0) + '%', xx - 8, s.h - 8);
    }
    ctx.font = '9px ui-monospace, monospace';
    pts.forEach(function (p) {
      var r = 4 + (p.size || 0) * 6;
      var x = M.clamp(padL + (p.x / maxX) * plotW, padL + r, padL + plotW - r);
      var y = M.clamp(padT + (1 - Math.abs(p.y) / maxY) * plotH, padT + r, padT + plotH - r);
      ctx.fillStyle = hexA(p.color || t.accent, 0.55);
      ctx.beginPath(); ctx.arc(x, y, r, 0, 6.3); ctx.fill();
      ctx.strokeStyle = p.color || t.accent; ctx.stroke();
      var label = String(p.label);
      var lw = ctx.measureText(label).width;
      /* flip the label to the left when it would run off the right edge */
      var lx = (x + r + 4 + lw > padL + plotW) ? x - r - 4 - lw : x + r + 4;
      ctx.fillStyle = t.text;
      ctx.fillText(label, lx, y + 3);
    });
  }

  global.CHART = { candles: candles, line: line, spark: spark, hbars: hbars, calendar: calendar, scatter: scatter, theme: theme, hexA: hexA };
})(window);
