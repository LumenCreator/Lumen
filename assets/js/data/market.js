/* Lumen Terminal — deterministic market data engine (demo mode).
   Prices are generated from the same news/calendar world the map and cascade engine use, so
   displacement (and therefore fair-value gaps) genuinely clusters around macro events. */
(function (global) {
  'use strict';
  var L = global.Lumen, U = global.UNIVERSE, M = L.M;

  var TF = {
    '5m': 5, '15m': 15, '30m': 30, '1h': 60, '4h': 240, '1d': 1440
  };

  /* asset class → trading session (UTC minutes from midnight) */
  function sessionOf(sym) {
    var e = U.findEntity(sym);
    var cls = e && e.macro ? e.macro.cls : 'equity';
    if (sym === 'BTC' || sym === 'ETH' || cls === 'crypto') return { open: 0, close: 1440, days: [0, 1, 2, 3, 4, 5, 6], k: 'crypto' };
    if (cls === 'commodity' || cls === 'fx' || cls === 'rate') return { open: 0, close: 1380, days: [1, 2, 3, 4, 5], k: 'futures' };
    return { open: 810, close: 1200, days: [1, 2, 3, 4, 5], k: 'equity' };   // 13:30–20:00 UTC
  }

  /* Reference spot levels (approximate, for the demo engine only — LIVE mode overwrites them). */
  var BASE_PX = {
    NVDA: 178, MSFT: 425, AAPL: 224, GOOGL: 176, AMZN: 186, META: 512, AVGO: 172, AMD: 148,
    INTC: 24, TSM: 172, ASML: 880, TSLA: 245, GM: 48, F: 11, TM: 185, STLA: 13,
    XOM: 116, CVX: 152, SHEL: 68, TTE: 62, COP: 104, SLB: 44, PBR: 14,
    LMT: 465, RTX: 118, NOC: 480, GD: 292, ESLT: 310,
    JPM: 214, BAC: 40, GS: 496, 'BRK.B': 448, UNH: 512, LLY: 780, JNJ: 158, PFE: 28, AZN: 78,
    WMT: 78, COST: 880, HD: 372, NKE: 78, MCD: 292, PG: 168, BKNG: 3900, DAL: 48, UAL: 52, LUV: 28, CCL: 18,
    BHP: 58, RIO: 66, VALE: 11, FCX: 47, NEM: 44, AA: 34, MP: 14, ALB: 92, ENPH: 118, FSLR: 218,
    NEE: 74, DUK: 108, SO: 82, CEG: 210, VST: 92, PWR: 268, ADM: 60, BG: 92, NTR: 52, MOS: 27, CF: 76, DE: 380, TSN: 58,
    UPS: 132, FDX: 262, ZIM: 18, FRO: 22, STNG: 68, INFY: 19,
    BTC: 96000, ETH: 3400, COIN: 232, MSTR: 1420, MARA: 18, IBIT: 54, HOOD: 22, CRCL: 88,
    SPY: 552, QQQ: 478
  };

  function profile(sym) {
    var e = U.findEntity(sym);
    if (e && e.macro) {
      return { base: e.macro.base, vol: e.macro.vol, sector: e.macro.cls, name: e.macro.n, unit: e.macro.unit };
    }
    if (e) {
      var ind = U.findIndustry(e.sector);
      var r = L.rng('px:' + sym);
      var base = BASE_PX[e.t];
      if (!base) {
        /* not in the reference table: derive something plausible and stable from the ticker */
        base = 15 + r() * 240;
        if (e.mcap > 5e11) base = 60 + r() * 260;
      }
      var volBySector = {
        semis: 0.026, crypto: 0.038, autos: 0.028, battery: 0.030, airlines: 0.026, mining: 0.022,
        energy: 0.019, defense: 0.014, banks: 0.016, tech: 0.017, health: 0.013, consumer: 0.012,
        utilities: 0.011, agri: 0.015, shipping: 0.030
      };
      return { base: base, vol: volBySector[e.sector] || 0.018, sector: e.sector, name: e.n, unit: '$', exp: ind ? ind.exp : null };
    }
    var rr = L.rng('px:' + sym);
    return { base: BASE_PX[String(sym).toUpperCase()] || (30 + rr() * 200), vol: 0.02, sector: 'equity', name: sym, unit: '$' };
  }

  /* Common-factor betas. Without a shared market and sector factor every symbol would be an
     independent random walk and cross-asset correlation — which the link analysis depends on —
     would be structurally zero. */
  var MKT_BETA = {
    SPY: 1.00, QQQ: 1.18, VIX: -0.85, 'GC=F': 0.05, 'CL=F': 0.25, 'BZ=F': 0.25, 'NG=F': 0.10,
    TTF: 0.08, 'HG=F': 0.45, 'ZW=F': 0.05, LI: 0.25, URA: 0.30, US10Y: 0.10, DXY: -0.25,
    BDI: 0.30, TNKR: 0.15, BTC: 0.85, ETH: 0.95
  };
  function betas(sym) {
    var e = U.findEntity(sym);
    var bm = MKT_BETA[sym];
    if (bm === undefined) {
      var sec = e ? e.sector : 'equity';
      var bySec = {
        semis: 1.35, tech: 1.10, crypto: 1.45, autos: 1.25, battery: 1.30, airlines: 1.15,
        banks: 1.05, mining: 0.95, energy: 0.80, shipping: 1.05, defense: 0.70,
        health: 0.65, consumer: 0.70, utilities: 0.55, agri: 0.70
      };
      bm = bySec[sec] === undefined ? 0.95 : bySec[sec];
    }
    return { m: bm, s: (e && e.sector && !e.macro) ? 0.55 : 0.20, sector: (e && e.sector) || 'macro' };
  }
  /* shared daily draws — same value for every symbol on a given day */
  function commonDay(dayMs, tag) { return L.gauss(L.rng('cf:' + tag + ':' + dayMs)); }
  function commonStep(dayMs, i, tag) { return L.gauss(L.rng('cs:' + tag + ':' + dayMs + ':' + i)); }

  /* macro factor exposure for any symbol */
  function exposure(sym) {
    var e = U.findEntity(sym);
    if (e && e.macro) {
      var m = {
        'CL=F': { oil: 1.0, war: 0.6, china: 0.3, usd: -0.3, inflation: 0.2 },
        'BZ=F': { oil: 1.0, war: 0.65, china: 0.3, usd: -0.3, inflation: 0.2 },
        'NG=F': { oil: 0.45, war: 0.35, inflation: 0.3 },
        'TTF': { oil: 0.5, war: 0.6, inflation: 0.35 },
        'GC=F': { war: 0.55, rates: -0.45, usd: -0.55, inflation: 0.35 },
        'HG=F': { china: 0.85, oil: 0.2, usd: -0.4, rates: -0.2 },
        'ZW=F': { war: 0.55, inflation: 0.5, oil: 0.25 },
        'LI': { china: 0.6, consumer: 0.3, rates: -0.3 },
        'URA': { war: 0.35, oil: 0.3, rates: -0.2 },
        'US10Y': { rates: 1.0, inflation: 0.6, oil: 0.25 },
        'DXY': { usd: 1.0, rates: 0.55, war: 0.25 },
        'VIX': { war: 0.8, rates: 0.3, consumer: -0.5, china: -0.3 },
        'SPY': { consumer: 0.65, rates: -0.5, war: -0.5, china: 0.25, oil: -0.15 },
        'QQQ': { consumer: 0.55, rates: -0.75, war: -0.45, china: 0.3 },
        'BDI': { china: 0.7, oil: 0.2, war: 0.2 },
        'TNKR': { war: 0.7, oil: 0.4, china: 0.2 }
      };
      return m[e.t] || { rates: -0.2 };
    }
    var p = profile(sym);
    return p.exp || { consumer: 0.3, rates: -0.3 };
  }

  /* ---------- daily factor shocks derived from the story corpus ---------- */
  var _shockCache = null;
  function factorShocks(stories, calendar, days, endMs) {
    if (_shockCache && _shockCache.n === stories.length && _shockCache.days === days) return _shockCache.map;
    var end = endMs || Date.now();
    var start = end - days * 86400e3;
    var map = {};
    function bucket(t) { return L.F.date(new Date(t)); }
    stories.forEach(function (s) {
      if (s.t < start) return;
      var b = bucket(s.t), m = map[b] || (map[b] = {});
      for (var k in s.f) m[k] = (m[k] || 0) + s.f[k] * (s.imp / 5) * 0.30;
    });
    (calendar || []).forEach(function (e) {
      if (e.t < start) return;
      var b = bucket(e.t), m = map[b] || (map[b] = {});
      var r = L.rng('cal:' + e.id + b);
      for (var k in e.f) m[k] = (m[k] || 0) + e.f[k] * (L.gauss(r) * 0.55) * (e.imp / 5);
      m._event = Math.max(m._event || 0, e.imp);
    });
    _shockCache = { n: stories.length, days: days, map: map };
    return map;
  }
  function resetShocks() { _shockCache = null; }

  /* ---------- bar generation ---------- */
  /* One base series per symbol (fine granularity), aggregated up to the requested timeframe.
     Every timeframe therefore tells the same story — a 1d bar is exactly its intraday bars. */

  function baseStepFor(step) { return step <= 15 ? 5 : step <= 60 ? 15 : 30; }

  function generateBase(sym, baseStep, startMs, endMs, world) {
    var p = profile(sym), exp = exposure(sym), sess = sessionOf(sym), bt = betas(sym);
    var days = Math.ceil((endMs - startMs) / 86400e3) + 10;
    var shocks = world ? factorShocks(world.stories, world.calendar, days, endMs) : {};
    var r = L.rng('bars:' + sym + ':' + baseStep + ':' + (world ? world.seed : 0));

    var out = [];
    var price = p.base * (1 - (L.gauss(r) * 0.05));
    var vol = p.vol;
    var stepsPerDay = Math.max(1, Math.round((sess.close - sess.open) / baseStep));
    /* CALIB scales the intraday random walk so realised daily sigma lands on the profile's
       `vol` after impulses, garch and the overnight gap are layered on top. */
    var CALIB = 0.42;
    var sigStep = (vol * CALIB) / Math.sqrt(stepsPerDay);
    var garch = 1;

    var d = new Date(startMs); d.setUTCHours(0, 0, 0, 0);
    while (d.getTime() <= endMs) {
      var dayMs = d.getTime(), dow = d.getUTCDay();
      if (sess.days.indexOf(dow) === -1) { d = new Date(dayMs + 86400e3); continue; }
      var sh = shocks[L.F.date(d)] || {};

      var drift = 0, shockMag = 0;
      for (var f in exp) {
        if (f.charAt(0) === '_') continue;
        var sv = sh[f] || 0;
        drift += exp[f] * sv;
        shockMag += Math.abs(exp[f] * sv);
      }
      drift = M.clamp(drift, -2.2, 2.2) * vol * 0.45;
      var eventDay = (sh._event || 0) >= 4 || shockMag > 0.9;
      /* slow anchor keeps a multi-month path inside a plausible range */
      var anchor = M.clamp(Math.log(p.base / price), -0.7, 0.7) * 0.030;

      /* common factors for this session, shared across the whole universe */
      var mktDay = commonDay(dayMs, 'mkt'), secDay = commonDay(dayMs, 'sec:' + bt.sector);

      if (out.length) {
        var gap = (L.gauss(r) * vol * 0.22 * 0.6)
                + (mktDay * vol * 0.22 * bt.m * 0.55)
                + drift * 0.25 + anchor * 0.5;
        if (eventDay) gap *= 1.6;
        price = price * (1 + gap);
      }

      garch = 0.86 * garch + 0.14 * (1 + Math.abs(L.gauss(r)) * 0.6);
      var dayVolMult = M.clamp(garch * (eventDay ? 1.45 : 1) * (1 + M.clamp(shockMag, 0, 2) * 0.22), 0.65, 2.1);

      /* impulse steps: displacement candles, which are what leave fair value gaps behind */
      var impulseCount = (eventDay ? 1 : 0) + (r() < (0.28 + shockMag * 0.40) ? 1 : 0) + (r() < 0.10 ? 1 : 0);
      var impulses = {};
      for (var ii = 0; ii < impulseCount; ii++) {
        var slot = Math.floor(r() * stepsPerDay);
        if (eventDay && ii === 0) slot = Math.floor(stepsPerDay * (0.05 + r() * 0.25));
        impulses[slot] = 1;
      }

      for (var i = 0; i < stepsPerDay; i++) {
        var t = dayMs + (sess.open + i * baseStep) * 60e3;
        if (t > endMs) break;
        var o = price;
        var isImp = !!impulses[i];
        var mult = dayVolMult * (isImp ? 2.4 + r() * 1.6 : 0.85 + r() * 0.5);
        /* impulses usually follow macro pressure but not always: a series that always continues
           in the shock direction would make any backtest run on it meaningless */
        var dir = 0;
        if (isImp) dir = (drift !== 0 && r() < 0.66) ? Math.sign(drift) : (r() < 0.5 ? -1 : 1);
        /* split the random walk into idiosyncratic + market + sector so that peers co-move */
        var idio = L.gauss(r) * sigStep * mult * 0.62;
        var mkt = (commonStep(dayMs, i, 'mkt') * 0.75 + mktDay * 0.35) * sigStep * mult * bt.m * 0.62;
        var sec = (commonStep(dayMs, i, 'sec:' + bt.sector) * 0.75 + secDay * 0.35) * sigStep * mult * bt.s * 0.55;
        var ret = idio + mkt + sec + (drift / stepsPerDay) + (anchor / stepsPerDay)
                + (isImp ? dir * sigStep * mult * 0.75 : 0);
        var c = o * (1 + ret);
        var body = Math.abs(c - o);
        var noise = o * sigStep * mult;
        var hi, lo;
        if (isImp) {
          hi = Math.max(o, c) + body * (0.05 + r() * 0.16);
          lo = Math.min(o, c) - body * (0.05 + r() * 0.16);
        } else {
          hi = Math.max(o, c) + noise * (0.35 + r() * 1.05);
          lo = Math.min(o, c) - noise * (0.35 + r() * 1.05);
        }
        if (hi <= lo) { hi = o * 1.0005; lo = o * 0.9995; }
        out.push({
          t: t, o: o, h: hi, l: lo, c: c,
          v: Math.round((500000 + r() * 800000) * (isImp ? 3.5 : 1) * (eventDay ? 1.8 : 1)),
          imp: isImp ? 1 : 0, ev: eventDay ? 1 : 0
        });
        price = M.clamp(c, p.base * 0.55, p.base * 1.85);
      }
      d = new Date(dayMs + 86400e3);
    }
    return out;
  }

  function aggregate(base, step, sess) {
    if (!base.length) return [];
    var buckets = {}, order = [];
    base.forEach(function (b) {
      var d = new Date(b.t);
      var dayMs = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
      var key, ts;
      if (step >= 1440) { key = String(dayMs); ts = dayMs + sess.open * 60e3; }
      else {
        var mod = (b.t - dayMs) / 60e3;
        var idx = Math.floor((mod - sess.open) / step);
        key = dayMs + ':' + idx;
        ts = dayMs + (sess.open + idx * step) * 60e3;
      }
      var g = buckets[key];
      if (!g) {
        buckets[key] = { t: ts, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v, imp: b.imp, ev: b.ev };
        order.push(key);
      } else {
        g.h = Math.max(g.h, b.h); g.l = Math.min(g.l, b.l); g.c = b.c;
        g.v += b.v; g.imp = Math.max(g.imp, b.imp); g.ev = Math.max(g.ev, b.ev);
      }
    });
    return order.map(function (k) { return buckets[k]; }).sort(function (a, b) { return a.t - b.t; });
  }

  var _barCache = {};
  function bars(sym, tf, lookbackDays, world) {
    var step = TF[tf] || 60;
    var bs = baseStepFor(step);
    var end = (world && world.now) || Date.now();
    end = Math.floor(end / (bs * 60e3)) * bs * 60e3;
    var start = end - lookbackDays * 86400e3;
    var ck = sym + '|' + bs + '|' + lookbackDays + '|' + end + '|' + (world ? world.seed : 0);
    var base = _barCache[ck];
    if (!base) {
      base = generateBase(sym, bs, start, end, world);
      _barCache[ck] = base;
      var keys = Object.keys(_barCache);
      if (keys.length > 60) delete _barCache[keys[0]];
    }
    if (step === bs) return base.slice();
    return aggregate(base, step, sessionOf(sym));
  }

  function isCrypto(sym) { return sym === 'BTC' || sym === 'ETH'; }

  var _quoteCache = {};
  function quote(sym, world) {
    var ck = sym + ':' + (world ? world.seed : 0);
    if (_quoteCache[ck] && Date.now() - _quoteCache[ck].at < 8000) return _quoteCache[ck].q;
    var b = bars(sym, '1d', 40, world);
    if (!b.length) return null;
    var last = b[b.length - 1], prev = b[b.length - 2] || last;
    var p = profile(sym);
    var q = {
      t: sym, name: p.name, unit: p.unit, price: last.c,
      chg: last.c - prev.c, chgPct: prev.c ? ((last.c - prev.c) / prev.c) * 100 : 0,
      open: last.o, high: last.h, low: last.l, vol: last.v,
      spark: b.slice(-30).map(function (x) { return x.c; }),
      sector: p.sector, ts: last.t
    };
    _quoteCache[ck] = { at: Date.now(), q: q };
    return q;
  }
  function clearQuotes() { _quoteCache = {}; _barCache = {}; }

  /* daily close series (for correlation work) */
  function closes(sym, days, world) {
    return bars(sym, '1d', days, world).map(function (b) { return b.c; });
  }
  function closeSeries(sym, days, world) {
    return bars(sym, '1d', days, world).map(function (b) { return { t: b.t, c: b.c }; });
  }

  global.MARKET = {
    TF: TF, betas: betas, bars: bars, quote: quote, closes: closes, closeSeries: closeSeries,
    profile: profile, exposure: exposure, sessionOf: sessionOf,
    factorShocks: factorShocks, resetShocks: resetShocks, clearQuotes: clearQuotes
  };
})(window);
