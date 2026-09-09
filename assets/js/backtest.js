/* Lumen Terminal — fair value gap (FVG) detection, statistics and strategy backtester.
   Pure functions over OHLC arrays: works on the built-in engine, on live provider bars,
   or on a TradingView CSV export. */
(function (global) {
  'use strict';
  var L = global.Lumen, M = L.M;

  /* ---------- indicators ---------- */
  function atr(bars, n) {
    n = n || 14;
    var out = new Array(bars.length).fill(0), tr = [];
    for (var i = 0; i < bars.length; i++) {
      var b = bars[i], p = bars[i - 1];
      var t = p ? Math.max(b.h - b.l, Math.abs(b.h - p.c), Math.abs(b.l - p.c)) : b.h - b.l;
      tr.push(t);
      if (i === n - 1) out[i] = M.mean(tr.slice(0, n));
      else if (i >= n) out[i] = (out[i - 1] * (n - 1) + t) / n;
      else out[i] = M.mean(tr.slice(0, i + 1));
    }
    return out;
  }
  function ema(vals, n) {
    var k = 2 / (n + 1), out = [], prev = vals[0];
    for (var i = 0; i < vals.length; i++) {
      prev = i === 0 ? vals[0] : vals[i] * k + prev * (1 - k);
      out.push(prev);
    }
    return out;
  }

  var DEFAULTS = {
    minGapAtr: 0.10,      // gap height must exceed this multiple of ATR
    minGapPct: 0.0,       // ...and this % of price
    requireDisplacement: true,
    displacementAtr: 0.80, // middle candle body vs ATR
    volumeConfirm: false,
    fillRule: 'touch',    // touch | half | full
    maxAge: 200,          // bars an unfilled gap stays tracked
    trendFilter: 'ema50', // none | ema50 | ema200
    entry: 'edge',        // edge | mid | far
    stopBufferAtr: 0.25,
    target: 'rr',         // rr | opposite
    rr: 2.0,
    riskPct: 1.0,
    maxBarsInTrade: 60,
    allowShorts: true,
    sessionFilter: 'all'  // all | rth | first2h
  };

  /* ---------- detection ---------- */
  /* Returns gaps: {i, t, dir, top, bot, size, sizeAtr, displaced, filled, fillIdx, barsToFill, maxPen} */
  function detect(bars, opts) {
    var o = Object.assign({}, DEFAULTS, opts || {});
    var A = atr(bars, 14);
    var gaps = [];
    for (var i = 2; i < bars.length; i++) {
      var c1 = bars[i - 2], c2 = bars[i - 1], c3 = bars[i];
      var a = A[i] || (c3.h - c3.l) || 1e-9;
      var dir = 0, top = 0, bot = 0;
      if (c3.l > c1.h) { dir = 1; bot = c1.h; top = c3.l; }
      else if (c3.h < c1.l) { dir = -1; bot = c3.h; top = c1.l; }
      if (!dir) continue;
      var size = top - bot;
      if (size <= 0) continue;
      if (size < o.minGapAtr * a) continue;
      if (o.minGapPct > 0 && size / c3.c * 100 < o.minGapPct) continue;
      var body = Math.abs(c2.c - c2.o);
      var displaced = body >= o.displacementAtr * a;
      if (o.requireDisplacement && !displaced) continue;
      if (o.volumeConfirm && c2.v && c1.v && c2.v < 1.3 * ((c1.v + (bars[i - 3] ? bars[i - 3].v : c1.v)) / 2)) continue;
      gaps.push({
        i: i, t: c3.t, dir: dir, top: top, bot: bot, mid: (top + bot) / 2,
        size: size, sizeAtr: size / a, sizePct: size / c3.c * 100,
        displaced: displaced, bodyAtr: body / a, atr: a,
        eventBar: !!(c2.ev || c3.ev),
        filled: false, fillIdx: null, barsToFill: null, maxPen: 0
      });
    }
    trackFills(bars, gaps, o);
    return gaps;
  }

  function penetration(g, b) {
    // 0..1 how deep price traded into the gap
    if (g.dir === 1) return M.clamp((g.top - b.l) / (g.size || 1e-9), 0, 1);
    return M.clamp((b.h - g.bot) / (g.size || 1e-9), 0, 1);
  }
  function fillThreshold(rule) { return rule === 'full' ? 0.999 : rule === 'half' ? 0.5 : 0.0001; }

  function trackFills(bars, gaps, o) {
    var thr = fillThreshold(o.fillRule);
    gaps.forEach(function (g) {
      for (var j = g.i + 1; j < bars.length && j - g.i <= o.maxAge; j++) {
        var pen = penetration(g, bars[j]);
        if (pen > g.maxPen) g.maxPen = pen;
        if (pen >= thr && !g.filled) {
          g.filled = true; g.fillIdx = j; g.barsToFill = j - g.i;
          if (o.fillRule !== 'touch') break;
          break;
        }
      }
    });
  }

  /* ---------- statistics ---------- */
  function stats(bars, gaps, tf) {
    if (!bars.length) return null;
    var days = {}, dow = {}, hour = {}, evt = { event: 0, normal: 0 }, evtDays = { event: 0, normal: 0 };
    bars.forEach(function (b) {
      var k = L.F.date(new Date(b.t));
      if (!days[k]) days[k] = { n: 0, gaps: 0, bull: 0, bear: 0, ev: 0, atrSum: 0 };
      days[k].n++;
      if (b.ev) days[k].ev = 1;
    });
    gaps.forEach(function (g) {
      var d = new Date(g.t), k = L.F.date(d);
      if (days[k]) { days[k].gaps++; days[k][g.dir === 1 ? 'bull' : 'bear']++; }
      var dw = L.weekdayName(d);
      dow[dw] = (dow[dw] || 0) + 1;
      var h = d.getUTCHours();
      hour[h] = (hour[h] || 0) + 1;
      if (g.eventBar) evt.event++; else evt.normal++;
    });
    var dayKeys = Object.keys(days).sort();
    var evDays = dayKeys.filter(function (k) { return days[k].ev; });
    var nmDays = dayKeys.filter(function (k) { return !days[k].ev; });
    function dens(keys) {
      if (!keys.length) return 0;
      var g = 0, n = 0;
      keys.forEach(function (k) { g += days[k].gaps; n += days[k].n; });
      return n ? g / n * 100 : 0;
    }
    var filled = gaps.filter(function (g) { return g.filled; });
    var ttf = filled.map(function (g) { return g.barsToFill; });
    /* mitigation depth reached, independent of the configured fill rule */
    var reachedHalf = gaps.filter(function (g) { return g.maxPen >= 0.5; }).length;
    var reachedFull = gaps.filter(function (g) { return g.maxPen >= 0.999; }).length;
    var reachedTouch = gaps.filter(function (g) { return g.maxPen > 0.0001; }).length;
    var perDay = dayKeys.map(function (k) { return days[k].gaps; });

    // weekday normalised density (gaps per session)
    var dowSessions = {};
    dayKeys.forEach(function (k) {
      var w = L.weekdayName(new Date(k + 'T00:00:00Z'));
      dowSessions[w] = (dowSessions[w] || 0) + 1;
    });
    var dowNorm = {};
    Object.keys(dowSessions).forEach(function (w) {
      dowNorm[w] = (dow[w] || 0) / dowSessions[w];
    });

    return {
      tf: tf, bars: bars.length, sessions: dayKeys.length,
      total: gaps.length, bull: gaps.filter(function (g) { return g.dir === 1; }).length,
      bear: gaps.filter(function (g) { return g.dir === -1; }).length,
      perSession: dayKeys.length ? gaps.length / dayKeys.length : 0,
      fillRate: gaps.length ? filled.length / gaps.length * 100 : 0,
      fillTouch: gaps.length ? reachedTouch / gaps.length * 100 : 0,
      fillHalf: gaps.length ? reachedHalf / gaps.length * 100 : 0,
      fillFull: gaps.length ? reachedFull / gaps.length * 100 : 0,
      medianBarsToFill: M.median(ttf), meanBarsToFill: M.mean(ttf),
      p90BarsToFill: M.quantile(ttf, 0.9),
      medianSizeAtr: M.median(gaps.map(function (g) { return g.sizeAtr; })),
      medianSizePct: M.median(gaps.map(function (g) { return g.sizePct; })),
      unfilled: gaps.length - filled.length,
      openGaps: gaps.filter(function (g) { return !g.filled; }),
      byDay: days, dayKeys: dayKeys, byDow: dow, byDowNorm: dowNorm, byHour: hour,
      eventSplit: evt,
      densityEventDays: dens(evDays), densityNormalDays: dens(nmDays),
      eventDayCount: evDays.length, normalDayCount: nmDays.length,
      maxDayGaps: Math.max.apply(null, perDay.concat([0])),
      hotDays: dayKeys.map(function (k) { return { d: k, g: days[k].gaps, ev: days[k].ev, n: days[k].n }; })
        .sort(function (a, b) { return b.g - a.g; }).slice(0, 12)
    };
  }

  /* ---------- strategy backtest ---------- */
  function run(bars, opts, equityStart) {
    var o = Object.assign({}, DEFAULTS, opts || {});
    var gaps = detect(bars, o);
    var A = atr(bars, 14);
    var closesArr = bars.map(function (b) { return b.c; });
    var e50 = ema(closesArr, 50), e200 = ema(closesArr, 200);

    var equity = equityStart || 100000;
    var start = equity;
    var trades = [], curve = [{ t: bars[0] ? bars[0].t : 0, e: equity }];
    var peak = equity, maxDD = 0;
    var open = null;

    function trendOk(i, dir) {
      if (o.trendFilter === 'none') return true;
      var ref = o.trendFilter === 'ema200' ? e200[i] : e50[i];
      return dir === 1 ? bars[i].c > ref : bars[i].c < ref;
    }
    function sessionOk(t) {
      if (o.sessionFilter === 'all') return true;
      var h = new Date(t).getUTCHours() + new Date(t).getUTCMinutes() / 60;
      if (o.sessionFilter === 'rth') return h >= 13.5 && h <= 20;
      if (o.sessionFilter === 'first2h') return h >= 13.5 && h <= 15.5;
      return true;
    }

    /* pending zones: gaps not yet touched */
    var pending = gaps.slice().sort(function (a, b) { return a.i - b.i; });
    var pi = 0, active = [];

    for (var i = 0; i < bars.length; i++) {
      var b = bars[i];
      while (pi < pending.length && pending[pi].i <= i) { active.push(pending[pi]); pi++; }
      active = active.filter(function (g) { return i - g.i <= o.maxAge; });

      /* manage open trade */
      if (open) {
        var hitStop = open.dir === 1 ? b.l <= open.stop : b.h >= open.stop;
        var hitTgt = open.dir === 1 ? b.h >= open.target : b.l <= open.target;
        var exit = null, why = null;
        if (hitStop && hitTgt) { exit = open.stop; why = 'stop (ambiguous bar)'; }
        else if (hitStop) { exit = open.stop; why = 'stop'; }
        else if (hitTgt) { exit = open.target; why = 'target'; }
        else if (i - open.i >= o.maxBarsInTrade) { exit = b.c; why = 'time'; }
        if (exit !== null) {
          var pl = (exit - open.entry) * open.qty * open.dir;
          equity += pl;
          var rMult = open.riskAmt ? pl / open.riskAmt : 0;
          trades.push({
            dir: open.dir, entryT: open.t, exitT: b.t, entry: open.entry, exit: exit,
            stop: open.stop, target: open.target, qty: open.qty, pl: pl, r: rMult,
            bars: i - open.i, why: why, gapSizeAtr: open.gapSizeAtr, eventBar: open.eventBar
          });
          curve.push({ t: b.t, e: equity });
          peak = Math.max(peak, equity);
          maxDD = Math.max(maxDD, (peak - equity) / peak * 100);
          open = null;
        }
      }

      /* look for entry */
      if (!open && sessionOk(b.t)) {
        for (var k = 0; k < active.length; k++) {
          var g = active[k];
          if (g.used || g.i >= i) continue;
          if (g.dir === -1 && !o.allowShorts) continue;
          var touched = g.dir === 1 ? b.l <= g.top : b.h >= g.bot;
          if (!touched) continue;
          g.used = true;
          if (!trendOk(i, g.dir)) continue;
          var a = A[i] || g.atr;
          var entry = o.entry === 'mid' ? g.mid : o.entry === 'far' ? (g.dir === 1 ? g.bot : g.top) : (g.dir === 1 ? g.top : g.bot);
          // must be reachable within this bar
          if (g.dir === 1 && b.l > entry) entry = b.l;
          if (g.dir === -1 && b.h < entry) entry = b.h;
          var stop = g.dir === 1 ? g.bot - o.stopBufferAtr * a : g.top + o.stopBufferAtr * a;
          var riskPer = Math.abs(entry - stop);
          if (riskPer <= 0) continue;
          var riskAmt = equity * (o.riskPct / 100);
          var qty = riskAmt / riskPer;
          var target = g.dir === 1 ? entry + riskPer * o.rr : entry - riskPer * o.rr;
          open = {
            i: i, t: b.t, dir: g.dir, entry: entry, stop: stop, target: target,
            qty: qty, riskAmt: riskAmt, gapSizeAtr: g.sizeAtr, eventBar: g.eventBar
          };
          break;
        }
      }
      if (i % 10 === 0) curve.push({ t: b.t, e: equity + (open ? (b.c - open.entry) * open.qty * open.dir : 0) });
    }

    var wins = trades.filter(function (t) { return t.pl > 0; });
    var losses = trades.filter(function (t) { return t.pl <= 0; });
    var rs = trades.map(function (t) { return t.r; });
    var grossW = M.sum(wins.map(function (t) { return t.pl; }));
    var grossL = Math.abs(M.sum(losses.map(function (t) { return t.pl; })));
    var dailyR = {};
    trades.forEach(function (t) {
      var k = L.F.date(new Date(t.exitT));
      dailyR[k] = (dailyR[k] || 0) + t.r;
    });
    var dr = Object.keys(dailyR).map(function (k) { return dailyR[k]; });
    var sharpe = M.stdev(dr) ? (M.mean(dr) / M.stdev(dr)) * Math.sqrt(252) : 0;

    return {
      opts: o, gaps: gaps, trades: trades, curve: curve,
      stats: {
        n: trades.length,
        winRate: trades.length ? wins.length / trades.length * 100 : 0,
        expectancyR: M.mean(rs),
        totalR: M.sum(rs),
        profitFactor: grossL ? grossW / grossL : (grossW > 0 ? Infinity : 0),
        pl: equity - start,
        plPct: (equity - start) / start * 100,
        equity: equity,
        maxDD: maxDD,
        avgBars: M.mean(trades.map(function (t) { return t.bars; })),
        bestR: trades.length ? Math.max.apply(null, rs) : 0,
        worstR: trades.length ? Math.min.apply(null, rs) : 0,
        sharpe: sharpe,
        longs: trades.filter(function (t) { return t.dir === 1; }).length,
        shorts: trades.filter(function (t) { return t.dir === -1; }).length,
        eventTrades: trades.filter(function (t) { return t.eventBar; }).length,
        eventR: M.mean(trades.filter(function (t) { return t.eventBar; }).map(function (t) { return t.r; })) || 0,
        normalR: M.mean(trades.filter(function (t) { return !t.eventBar; }).map(function (t) { return t.r; })) || 0
      }
    };
  }

  /* ---------- parameter sweep ---------- */
  function sweep(bars, base, param, values) {
    return values.map(function (v) {
      var o = Object.assign({}, base);
      o[param] = v;
      var res = run(bars, o);
      return { v: v, n: res.stats.n, winRate: res.stats.winRate, expectancyR: res.stats.expectancyR, totalR: res.stats.totalR, pf: res.stats.profitFactor, maxDD: res.stats.maxDD };
    });
  }

  /* ---------- TradingView CSV import ---------- */
  function parseCSV(text) {
    var lines = text.trim().split(/\r?\n/);
    if (lines.length < 3) throw new Error('CSV too short');
    var head = lines[0].split(/[,;\t]/).map(function (s) { return s.trim().toLowerCase().replace(/^"|"$/g, ''); });
    function idx() {
      for (var i = 0; i < arguments.length; i++) {
        var k = head.indexOf(arguments[i]);
        if (k >= 0) return k;
      }
      return -1;
    }
    var it = idx('time', 'date', 'datetime', 'timestamp');
    var io = idx('open'), ih = idx('high'), il = idx('low'), ic = idx('close', 'price'), iv = idx('volume', 'vol');
    if (it < 0 || io < 0 || ih < 0 || il < 0 || ic < 0) throw new Error('CSV needs time,open,high,low,close columns (TradingView export format)');
    var out = [];
    for (var i = 1; i < lines.length; i++) {
      var p = lines[i].split(/[,;\t]/).map(function (s) { return s.trim().replace(/^"|"$/g, ''); });
      if (p.length < 5) continue;
      var raw = p[it], t;
      if (/^\d{10}$/.test(raw)) t = parseInt(raw, 10) * 1000;
      else if (/^\d{13}$/.test(raw)) t = parseInt(raw, 10);
      else t = Date.parse(raw.indexOf('T') < 0 && raw.indexOf(' ') > 0 ? raw.replace(' ', 'T') + 'Z' : raw);
      if (isNaN(t)) continue;
      var bar = { t: t, o: +p[io], h: +p[ih], l: +p[il], c: +p[ic], v: iv >= 0 ? +p[iv] || 0 : 0, imp: 0, ev: 0 };
      if ([bar.o, bar.h, bar.l, bar.c].some(function (x) { return isNaN(x); })) continue;
      out.push(bar);
    }
    out.sort(function (a, b) { return a.t - b.t; });
    if (out.length < 30) throw new Error('Parsed only ' + out.length + ' bars — check the export');
    return out;
  }

  global.BACKTEST = {
    DEFAULTS: DEFAULTS, atr: atr, ema: ema,
    detect: detect, stats: stats, run: run, sweep: sweep, parseCSV: parseCSV
  };
})(window);
