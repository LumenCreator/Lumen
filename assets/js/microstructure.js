/* Lumen Terminal — market behaviour engine.
 *
 * Four things, all computed from OHLCV plus the news corpus:
 *
 *   ANOMALIES   — bar patterns consistent with stop runs, distribution, churn and unexplained
 *                 participation.
 *   EXHAUSTION  — where price sits in its own history, how long it has been extended, and what
 *                 has historically happened from comparable levels. This is the "oil is at $110,
 *                 who is left to buy it" question, answered as a conditional base rate.
 *   CROWDING    — a positioning read: is the move being pushed by people already in it.
 *   EVENT STUDY — after catalysts of a given class, what did this instrument actually do, and
 *                 was that different from its unconditional behaviour.
 *
 * WHAT THIS CANNOT DO, stated plainly because the alternative is a tool that misleads:
 * OHLCV bars carry no identity, no order book, no cancellations and no counterparty. Spoofing,
 * layering, wash trading and marking the close are defined by *intent* and by order-level
 * behaviour that is simply not present in this data. Everything below flags a PATTERN that is
 * CONSISTENT WITH those behaviours; a pattern is not proof, and most of these patterns also
 * occur for entirely ordinary reasons (an index rebalance, a large hedger, a scheduled roll).
 * Treat every flag as "look at this", never as "this happened". Real surveillance requires
 * full order-book and participant data that no retail API provides.
 *
 * The base rates are honest but small-sample: a conditional statistic drawn from a few dozen
 * historical instances has wide error bars, and every function reports its sample size so you
 * can see when the number is too thin to lean on.
 */
(function (global) {
  'use strict';
  var L = global.Lumen, M = L.M, B = global.BACKTEST;

  /* ---------- helpers ---------- */
  function rets(bars) {
    var out = [];
    for (var i = 1; i < bars.length; i++) out.push((bars[i].c - bars[i - 1].c) / bars[i - 1].c);
    return out;
  }
  function rollMean(v, i, n) {
    var s = 0, c = 0;
    for (var j = Math.max(0, i - n + 1); j <= i; j++) { s += v[j]; c++; }
    return c ? s / c : 0;
  }
  function rollStd(v, i, n) {
    var m = rollMean(v, i, n), s = 0, c = 0;
    for (var j = Math.max(0, i - n + 1); j <= i; j++) { s += (v[j] - m) * (v[j] - m); c++; }
    return c > 1 ? Math.sqrt(s / (c - 1)) : 0;
  }
  function zscore(v, i, n) {
    var sd = rollStd(v, i, n);
    return sd ? (v[i] - rollMean(v, i, n)) / sd : 0;
  }
  function pctRank(arr, v) {
    if (!arr.length) return 0.5;
    var below = 0;
    for (var i = 0; i < arr.length; i++) if (arr[i] <= v) below++;
    return below / arr.length;
  }
  function rsi(bars, n) {
    n = n || 14;
    var out = new Array(bars.length).fill(50), g = 0, l = 0;
    for (var i = 1; i < bars.length; i++) {
      var d = bars[i].c - bars[i - 1].c;
      var up = d > 0 ? d : 0, dn = d < 0 ? -d : 0;
      if (i <= n) { g += up / n; l += dn / n; }
      else { g = (g * (n - 1) + up) / n; l = (l * (n - 1) + dn) / n; }
      out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
    }
    return out;
  }

  /* ---------- 1. anomaly detection ---------- */
  var DETECTORS = {
    sweep: {
      n: 'Liquidity sweep', icon: '🎣',
      d: 'Price pushed through an obvious prior high or low on raised volume, then closed back inside the range. This is the shape left behind when resting stop orders are triggered and the move does not follow through. It is also the shape of an ordinary failed breakout.'
    },
    climax: {
      n: 'Climax & distribution', icon: '📛',
      d: 'A large, fast, high-volume advance that closes weakly. Consistent with supply meeting an extended move — the point where whoever was accumulating starts selling into strength. Also consistent with a plain exhaustion top.'
    },
    churn: {
      n: 'Churn', icon: '🌀',
      d: 'Heavy volume with almost no price progress. Consistent with inventory being shuffled or with wash-like activity in thin names. Also what happens when a large buyer and a large seller meet.'
    },
    unexplained: {
      n: 'Unexplained participation', icon: '❓',
      d: 'Volume far above normal on a day with nothing in the wire touching this name or its sector. Someone is acting on information the feed does not carry yet — which may be a pending announcement, a fund reallocation, or an index event.'
    },
    absorbed: {
      n: 'Absorbed catalyst', icon: '🧱',
      d: 'A high-impact story landed and the price barely moved. Either it was already priced, or size is deliberately taking the other side. The second case usually resolves violently.'
    },
    gapfade: {
      n: 'Gap and fade', icon: '↩',
      d: 'Opened well away from the prior close and gave the whole move back within the session. Repeated instances suggest the open is being set away from where the day actually trades.'
    },
    pin: {
      n: 'Round-number pinning', icon: '🎯',
      d: 'Closes cluster near round numbers more than chance would produce. Typical near large option strikes into expiry.'
    }
  };

  function anomalies(bars, sym, world, opts) {
    opts = opts || {};
    if (!bars || bars.length < 40) return [];
    var out = [];
    var A = B.atr(bars, 14);
    var vols = bars.map(function (b) { return b.v || 0; });
    var rr = rets(bars);
    var sens = opts.sensitivity === undefined ? 1 : opts.sensitivity;   // 0.6 strict … 1.4 loose

    /* map day -> stories touching this symbol or its sector */
    var ent = global.UNIVERSE.findEntity(sym);
    var sector = ent ? ent.sector : null;
    var storiesByDay = {};
    ((world && world.stories) || []).forEach(function (s) {
      var hit = (s.tickers || []).indexOf(sym) >= 0 || (sector && (s.sectors || []).indexOf(sector) >= 0);
      if (!hit) return;
      var k = L.F.date(new Date(s.t));
      (storiesByDay[k] || (storiesByDay[k] = [])).push(s);
    });

    for (var i = 25; i < bars.length; i++) {
      var b = bars[i], a = A[i] || 1e-9;
      var vz = zscore(vols, i, 20);
      var day = L.F.date(new Date(b.t));
      var news = storiesByDay[day] || [];
      var maxImp = news.reduce(function (m, s) { return Math.max(m, s.imp); }, 0);
      var range = b.h - b.l;
      var body = Math.abs(b.c - b.o);
      var retSigma = rollStd(rr, i - 1, 20);
      var barRet = i > 0 ? (b.c - bars[i - 1].c) / bars[i - 1].c : 0;

      /* prior swing over the previous 20 bars, excluding this one */
      var sh = -Infinity, sl = Infinity;
      for (var j = i - 20; j < i; j++) { sh = Math.max(sh, bars[j].h); sl = Math.min(sl, bars[j].l); }

      /* --- liquidity sweep --- */
      var overshootUp = (b.h - sh) / a, overshootDn = (sl - b.l) / a;
      if (overshootUp > 0.12 / sens && b.c < sh && (b.h - Math.max(b.o, b.c)) > 0.45 * range && vz > 0.9 / sens) {
        out.push(mk(i, b, 'sweep', -1, M.clamp(overshootUp * 0.5 + vz * 0.18, 0.2, 1),
          'Took out the 20-bar high by ' + overshootUp.toFixed(2) + ' ATR on ' + vz.toFixed(1) + 'σ volume, then closed back below it.',
          { overshootAtr: overshootUp, volZ: vz, level: sh }));
      }
      if (overshootDn > 0.12 / sens && b.c > sl && (Math.min(b.o, b.c) - b.l) > 0.45 * range && vz > 0.9 / sens) {
        out.push(mk(i, b, 'sweep', 1, M.clamp(overshootDn * 0.5 + vz * 0.18, 0.2, 1),
          'Took out the 20-bar low by ' + overshootDn.toFixed(2) + ' ATR on ' + vz.toFixed(1) + 'σ volume, then closed back above it.',
          { overshootAtr: overshootDn, volZ: vz, level: sl }));
      }

      /* --- climax / distribution --- */
      if (i >= 30) {
        var run5 = (b.c - bars[i - 5].c) / bars[i - 5].c;
        var runSig = retSigma ? run5 / (retSigma * Math.sqrt(5)) : 0;
        var closePos = range ? (b.c - b.l) / range : 0.5;
        if (runSig > 2.0 / sens && vz > 1.2 / sens && closePos < 0.36) {
          out.push(mk(i, b, 'climax', -1, M.clamp(runSig * 0.22 + vz * 0.15, 0.25, 1),
            'Advanced ' + (run5 * 100).toFixed(1) + '% over five bars (' + runSig.toFixed(1) + 'σ) on ' + vz.toFixed(1) + 'σ volume, then closed in the bottom third of the bar.',
            { run5: run5, sigma: runSig, volZ: vz }));
        }
        if (runSig < -2.0 / sens && vz > 1.2 / sens && closePos > 0.64) {
          out.push(mk(i, b, 'climax', 1, M.clamp(-runSig * 0.22 + vz * 0.15, 0.25, 1),
            'Fell ' + (run5 * 100).toFixed(1) + '% over five bars on ' + vz.toFixed(1) + 'σ volume, then closed in the top third — capitulation shape.',
            { run5: run5, sigma: runSig, volZ: vz }));
        }
      }

      /* --- churn --- */
      if (vz > 1.8 / sens && range < 0.55 * a) {
        out.push(mk(i, b, 'churn', 0, M.clamp(vz * 0.2, 0.2, 0.9),
          vz.toFixed(1) + 'σ volume inside a range of only ' + (range / a).toFixed(2) + ' ATR — heavy participation, no progress.',
          { volZ: vz, rangeAtr: range / a }));
      }

      /* --- unexplained participation --- */
      if (vz > 2.3 / sens && !news.length && Math.abs(barRet) > retSigma * 1.2) {
        out.push(mk(i, b, 'unexplained', Math.sign(barRet), M.clamp(vz * 0.22, 0.3, 1),
          vz.toFixed(1) + 'σ volume and a ' + (barRet * 100).toFixed(1) + '% move with nothing in the wire on this name or sector.',
          { volZ: vz, ret: barRet }));
      }

      /* --- absorbed catalyst --- */
      if (maxImp >= 5 && retSigma && Math.abs(barRet) < retSigma * 0.3 && vz > 1.0 / sens) {
        out.push(mk(i, b, 'absorbed', 0, M.clamp(maxImp * 0.14 + vz * 0.14, 0.2, 0.9),
          'Impact-' + maxImp + ' story landed; the bar moved only ' + (barRet * 100).toFixed(2) + '% on above-average volume.',
          { impact: maxImp, ret: barRet, volZ: vz, headline: news[0] ? news[0].h : '' }));
      }

      /* --- gap and fade --- */
      if (i > 0) {
        var gap = (b.o - bars[i - 1].c) / bars[i - 1].c;
        if (Math.abs(gap) > retSigma * 1.4 && retSigma) {
          var faded = gap > 0 ? (b.c <= bars[i - 1].c) : (b.c >= bars[i - 1].c);
          if (faded) {
            out.push(mk(i, b, 'gapfade', -Math.sign(gap), M.clamp(Math.abs(gap) / (retSigma * 3), 0.2, 0.9),
              'Opened ' + (gap * 100).toFixed(1) + '% away from the prior close and closed all the way back through it.',
              { gap: gap }));
          }
        }
      }
    }

    /* --- round-number pinning: a property of the series, not one bar --- */
    var scale = Math.pow(10, Math.floor(Math.log10(bars[bars.length - 1].c)) - 1);
    var near = 0;
    bars.forEach(function (b) {
      var d = Math.abs(b.c - Math.round(b.c / scale) * scale) / b.c;
      if (d < 0.0015) near++;
    });
    var expected = bars.length * (0.003 / (scale / bars[bars.length - 1].c));
    var pinRatio = expected > 0 ? near / expected : 0;
    var pin = null;
    if (pinRatio > 1.6 && near >= 6) {
      pin = {
        kind: 'pin', n: DETECTORS.pin.n, icon: DETECTORS.pin.icon,
        severity: M.clamp((pinRatio - 1) * 0.5, 0.2, 0.9),
        note: near + ' of ' + bars.length + ' closes landed within 0.15% of a round number — about ' + pinRatio.toFixed(1) + '× what chance would give.',
        series: true
      };
    }

    out.sort(function (x, y) { return y.t - x.t; });
    return { events: out, pin: pin };

    function mk(i, b, kind, dir, sev, note, ev) {
      return {
        i: i, t: b.t, kind: kind, n: DETECTORS[kind].n, icon: DETECTORS[kind].icon,
        dir: dir, severity: sev, note: note, evidence: ev, price: b.c
      };
    }
  }

  /* ---------- 2. exhaustion ----------
     Answers: price is here — historically, who was left to buy, and what happened next? */
  function exhaustion(bars, opts) {
    opts = opts || {};
    if (!bars || bars.length < 60) return null;
    var horizons = opts.horizons || [5, 10, 20];
    var closes = bars.map(function (b) { return b.c; });
    var last = closes[closes.length - 1];
    var look = Math.min(opts.lookback || closes.length, closes.length);
    var hist = closes.slice(-look);
    var rank = pctRank(hist, last);

    /* consecutive bars spent above the 85th percentile — how long has it been stretched */
    var extThresh = M.quantile(hist, 0.85);
    var runNow = 0;
    for (var i = closes.length - 1; i >= 0 && closes[i] >= extThresh; i--) runNow++;

    /* all historical runs above the same threshold, for context on how long they last */
    var runs = [], cur = 0;
    for (var j = 0; j < closes.length; j++) {
      if (closes[j] >= extThresh) cur++;
      else if (cur) { runs.push(cur); cur = 0; }
    }
    var runPct = runs.length ? pctRank(runs, runNow) : 0.5;

    /* conditional forward returns from comparable percentile levels */
    var band = opts.band === undefined ? 0.06 : opts.band;
    var byHorizon = horizons.map(function (h) {
      var cond = [], uncond = [];
      for (var k = 60; k < closes.length - h; k++) {
        var r = pctRank(closes.slice(Math.max(0, k - look), k + 1), closes[k]);
        var fwd = (closes[k + h] - closes[k]) / closes[k];
        uncond.push(fwd);
        if (Math.abs(r - rank) <= band) cond.push(fwd);
      }
      var up = cond.filter(function (x) { return x > 0; });
      var dn = cond.filter(function (x) { return x <= 0; });
      var uncondUp = uncond.filter(function (x) { return x > 0; }).length / Math.max(1, uncond.length);
      return {
        h: h, n: cond.length,
        pUp: cond.length ? up.length / cond.length : null,
        baseUp: uncondUp,
        edge: cond.length ? (up.length / cond.length) - uncondUp : null,
        median: M.median(cond), mean: M.mean(cond),
        medUp: M.median(up), medDn: M.median(dn),
        p10: M.quantile(cond, 0.10), p90: M.quantile(cond, 0.90),
        /* how much you make when right vs lose when wrong, from here */
        payoff: (up.length && dn.length) ? Math.abs(M.median(up) / M.median(dn)) : null
      };
    });

    /* room: is there any precedent above this level at all */
    var above = hist.filter(function (c) { return c > last; }).length;
    var mid = byHorizon[Math.min(1, byHorizon.length - 1)];

    return {
      price: last, rank: rank, lookback: look,
      high: Math.max.apply(null, hist), low: Math.min.apply(null, hist),
      barsAbove: above, virgin: above === 0,
      extendedBars: runNow, extendedPct: runPct, medianRun: M.median(runs), runs: runs.length,
      horizons: byHorizon,
      /* asymmetry: >1 means the historical payoff from here favours the upside */
      asymmetry: mid && mid.payoff !== null && mid.pUp !== null
        ? (mid.payoff * mid.pUp) / Math.max(0.01, (1 - mid.pUp))
        : null,
      read: exhaustionRead(rank, runNow, runPct, above, mid)
    };
  }

  function exhaustionRead(rank, runNow, runPct, above, mid) {
    var lines = [];
    var pct = (rank * 100).toFixed(0);
    if (above === 0) {
      lines.push('Price is at the top of its entire lookback — there is no historical trade above here to reference. Every buyer is in profit and no overhead supply is trapped, which cuts both ways: nothing to stop it, and nothing to catch it.');
    } else if (rank > 0.92) {
      lines.push('At the ' + pct + 'th percentile of its own range, only ' + (100 - +pct) + '% of the lookback traded higher. The pool of buyers who have not already acted is thin.');
    } else if (rank > 0.80) {
      lines.push('At the ' + pct + 'th percentile, price is in the upper part of its range but not at an extreme. There is still overhead supply above, and still buyers who have not acted.');
    } else if (rank < 0.20 && rank >= 0.08) {
      lines.push('At the ' + pct + 'th percentile, price is in the lower part of its range without being at an extreme.');
    } else if (rank < 0.08) {
      lines.push('At the ' + pct + 'th percentile, this is near the floor of its range — the mirror image: most sellers have already sold.');
    } else {
      lines.push('At the ' + pct + 'th percentile of its range, price is inside the zone where it spends most of its time. Nothing about the level itself is stretched.');
    }
    /* A one- or two-bar touch of the threshold is not a stretch; don't dress it up as one. */
    if (runNow >= 3) {
      var cmp = runPct >= 0.995 ? 'longer than any previous stretch in the window'
        : runPct >= 0.9 ? 'longer than ' + (runPct * 100).toFixed(0) + '% of previous stretches'
        : 'about the ' + (runPct * 100).toFixed(0) + 'th percentile of previous stretches';
      lines.push('It has held above the 85th percentile for ' + runNow + ' bars, ' + cmp +
        '. The longer a move stays extended, the more of it is being carried by people who are already positioned.');
    }
    if (mid && mid.n >= 12 && mid.pUp !== null) {
      var dirn = mid.pUp > 0.5 ? 'higher' : 'lower';
      var edgePts = (mid.edge * 100);
      lines.push('From comparable levels, over the next ' + mid.h + ' bars, price went ' + dirn + ' ' +
        (Math.max(mid.pUp, 1 - mid.pUp) * 100).toFixed(0) + '% of the time across ' + mid.n + ' instances, median ' +
        (mid.median * 100).toFixed(1) + '%. Unconditionally it rises ' + (mid.baseUp * 100).toFixed(0) + '% of the time, so the level is worth ' +
        (edgePts > 0 ? '+' : '') + edgePts.toFixed(0) + ' points against the base rate.');
      /* The honest caveat: these windows overlap and come from one price path, so n is not
         n independent observations. Say so in proportion to how thin the sample is. */
      if (Math.abs(edgePts) < 5) {
        lines.push('That is inside the noise. The level is not telling you anything here — look elsewhere for the signal.');
      } else if (mid.n < 25) {
        lines.push('Before leaning on that: those ' + mid.n + ' windows overlap each other and come from a single price path, so they are nowhere near ' + mid.n + ' independent observations. A gap this size on a sample this thin is suggestive at best — enough to size down into, not enough to size up on.');
      } else {
        lines.push('The windows still overlap, so treat the magnitude as approximate — but the direction is consistent across ' + mid.n + ' instances, which is worth respecting.');
      }
    } else if (mid) {
      lines.push('Only ' + mid.n + ' comparable historical instances — too few to draw a base rate from. Treat the level as context, not a signal.');
    }
    return lines;
  }

  /* ---------- 3. crowding / positioning ---------- */
  function crowding(bars, sym, world) {
    if (!bars || bars.length < 60) return null;
    var closes = bars.map(function (b) { return b.c; });
    var A = B.atr(bars, 14);
    var e20 = B.ema(closes, 20), e50 = B.ema(closes, 50);
    var R = rsi(bars, 14);
    var i = bars.length - 1;
    var vols = bars.map(function (b) { return b.v || 0; });

    var extension = A[i] ? (closes[i] - e20[i]) / A[i] : 0;
    var trend = A[i] ? (e20[i] - e50[i]) / A[i] : 0;
    var volTrend = zscore(vols, i, 30);
    var rank = pctRank(closes.slice(-Math.min(250, closes.length)), closes[i]);
    var rsiV = R[i];

    /* news skew over the last week: is the story flow one-sided */
    var cutoff = bars[i].t - 7 * 86400e3;
    var ent = global.UNIVERSE.findEntity(sym);
    var sector = ent ? ent.sector : null;
    var skew = 0, nStories = 0;
    ((world && world.stories) || []).forEach(function (s) {
      if (s.t < cutoff) return;
      var hit = (s.tickers || []).indexOf(sym) >= 0 || (sector && (s.sectors || []).indexOf(sector) >= 0);
      if (!hit) return;
      nStories++;
      var f = s.f || {};
      var net = 0;
      for (var k in f) net += f[k];
      skew += Math.sign(net) * (s.imp / 5);
    });
    skew = nStories ? skew / nStories : 0;

    var score = M.clamp(
      M.clamp(extension / 2.5, -1, 1) * 0.32 +
      M.clamp(trend / 1.5, -1, 1) * 0.18 +
      ((rsiV - 50) / 50) * 0.24 +
      ((rank - 0.5) * 2) * 0.16 +
      M.clamp(skew, -1, 1) * 0.10, -1, 1);

    var label = score > 0.55 ? 'Crowded long' : score > 0.2 ? 'Leaning long'
      : score < -0.55 ? 'Crowded short' : score < -0.2 ? 'Leaning short' : 'Balanced';

    var fuel = M.clamp(1 - Math.abs(score), 0, 1);
    return {
      score: score, label: label, fuel: fuel,
      extension: extension, trend: trend, rsi: rsiV, rank: rank, volTrend: volTrend,
      newsSkew: skew, newsCount: nStories,
      read: score > 0.55
        ? 'Price is ' + extension.toFixed(1) + ' ATR above its 20-bar mean with RSI at ' + rsiV.toFixed(0) + ' and the story flow one-sided. Positioning is doing the work, which means the marginal buyer is arriving late. Continuation is possible; it just needs new money rather than the same money.'
        : score < -0.55
          ? 'Price is ' + extension.toFixed(1) + ' ATR below its 20-bar mean with RSI at ' + rsiV.toFixed(0) + '. The selling is concentrated and the marginal seller is late. Squeezes start from here.'
          : 'Positioning is not stretched in either direction — ' + extension.toFixed(1) + ' ATR from the 20-bar mean, RSI ' + rsiV.toFixed(0) + '. There is room for a move without it being a crowd unwinding.'
    };
  }

  /* ---------- 4. event study ----------
     "After X happens, do people buy?" — measured, with the unconditional rate alongside. */
  var EVENT_CLASSES = {
    oilspike: { n: 'Oil / energy shock', test: function (s) { return (s.f && (s.f.oil || 0) > 0.35) && s.imp >= 4; } },
    conflict: { n: 'Conflict escalation', test: function (s) { return s.k === 'conflict' && s.imp >= 4; } },
    ratehawk: { n: 'Hawkish rate surprise', test: function (s) { return (s.f && (s.f.rates || 0) > 0.35) && s.imp >= 4; } },
    tariff: { n: 'Trade / tariff action', test: function (s) { return s.k === 'trade' && s.imp >= 4; } },
    supply: { n: 'Supply-chain disruption', test: function (s) { return s.k === 'supplychain' && s.imp >= 3; } },
    inflation: { n: 'Inflation surprise', test: function (s) { return (s.f && (s.f.inflation || 0) > 0.35) && s.imp >= 4; } },
    chokepoint: { n: 'Chokepoint threatened', test: function (s) { return !!s.choke && s.imp >= 4; } }
  };

  function eventStudy(bars, world, classId, opts) {
    opts = opts || {};
    var cls = EVENT_CLASSES[classId];
    if (!cls || !bars || bars.length < 40) return null;
    var horizons = opts.horizons || [1, 3, 5, 10, 20];
    var closes = bars.map(function (b) { return b.c; });
    var times = bars.map(function (b) { return b.t; });

    var eventDays = {};
    ((world && world.stories) || []).forEach(function (s) {
      if (cls.test(s)) eventDays[L.F.date(new Date(s.t))] = Math.max(eventDays[L.F.date(new Date(s.t))] || 0, s.imp);
    });
    var keys = Object.keys(eventDays);
    if (!keys.length) return { classId: classId, n: 0, name: cls.n, rows: [], events: 0 };

    /* index of the first bar on or after each event day */
    var idx = [];
    keys.forEach(function (k) {
      var t = Date.parse(k + 'T00:00:00Z');
      for (var i = 0; i < times.length; i++) {
        if (times[i] >= t) { idx.push(i); break; }
      }
    });
    idx = idx.filter(function (v, i, a) { return a.indexOf(v) === i; }).sort(function (a, b) { return a - b; });

    var rows = horizons.map(function (h) {
      var cond = [], uncond = [];
      for (var k = 1; k < closes.length - h; k++) uncond.push((closes[k + h] - closes[k]) / closes[k]);
      idx.forEach(function (i) {
        if (i + h >= closes.length) return;
        cond.push((closes[i + h] - closes[i]) / closes[i]);
      });
      var up = cond.filter(function (x) { return x > 0; }).length;
      var baseUp = uncond.filter(function (x) { return x > 0; }).length / Math.max(1, uncond.length);
      var sd = M.stdev(cond);
      return {
        h: h, n: cond.length,
        pUp: cond.length ? up / cond.length : null,
        baseUp: baseUp,
        edge: cond.length ? up / cond.length - baseUp : null,
        median: M.median(cond), mean: M.mean(cond),
        baseMean: M.mean(uncond),
        /* rough t-stat of the mean difference; small n makes this fragile and it is shown as such */
        t: (cond.length > 2 && sd) ? (M.mean(cond) - M.mean(uncond)) / (sd / Math.sqrt(cond.length)) : 0,
        best: cond.length ? Math.max.apply(null, cond) : 0,
        worst: cond.length ? Math.min.apply(null, cond) : 0
      };
    });

    var strong = rows.filter(function (r) { return r.n >= 8 && Math.abs(r.t) > 1.8; });
    return {
      classId: classId, name: cls.n, events: idx.length, rows: rows,
      significant: strong,
      read: buildEventRead(cls.n, idx.length, rows)
    };
  }

  function buildEventRead(name, n, rows) {
    if (n < 6) return ['Only ' + n + ' events of this class in the window — not enough to say anything. Widen the period or pick a more common catalyst.'];
    var lines = [];
    var best = rows.slice().filter(function (r) { return r.n >= 6; }).sort(function (a, b) { return Math.abs(b.t) - Math.abs(a.t); })[0];
    if (!best) return ['Not enough overlapping bars to measure the response.'];
    var dir = best.mean > 0 ? 'rose' : 'fell';
    lines.push('Across ' + n + ' events, the ' + best.h + '-bar response ' + dir + ' a median of ' +
      (best.median * 100).toFixed(2) + '%, positive ' + ((best.pUp || 0) * 100).toFixed(0) + '% of the time.');
    lines.push('Unconditionally this instrument is positive ' + (best.baseUp * 100).toFixed(0) + '% of the time over the same horizon, so the catalyst is worth ' +
      ((best.edge || 0) > 0 ? '+' : '') + ((best.edge || 0) * 100).toFixed(0) + ' percentage points of directional edge.');
    if (Math.abs(best.t) < 1.8) {
      lines.push('That difference is inside the noise at this sample size (t = ' + best.t.toFixed(2) + '). Read it as "no measurable reaction", not as a weak one.');
    } else {
      lines.push('The difference clears the noise at this sample size (t = ' + best.t.toFixed(2) + '), which is suggestive — but a t-statistic on ' + best.n + ' overlapping windows overstates confidence, so size accordingly.');
    }
    return lines;
  }

  /* ---------- combined read for one symbol ---------- */
  function assess(sym, bars, world, opts) {
    var an = anomalies(bars, sym, world, opts);
    var ex = exhaustion(bars, opts);
    var cr = crowding(bars, sym, world);
    var recent = an.events.filter(function (e) { return e.i >= bars.length - 30; });

    /* headline risk score: extension + crowding + recent distribution signals */
    var risk = 0;
    if (ex) {
      risk += M.clamp((ex.rank - 0.75) / 0.25, 0, 1) * 0.30;
      risk += M.clamp(ex.extendedPct - 0.5, 0, 0.5) * 0.30;
      if (ex.virgin) risk += 0.12;
    }
    if (cr) risk += M.clamp((Math.abs(cr.score) - 0.4) / 0.6, 0, 1) * 0.25;
    var distSignals = recent.filter(function (e) { return e.kind === 'climax' || e.kind === 'sweep'; }).length;
    risk += M.clamp(distSignals * 0.08, 0, 0.25);
    risk = M.clamp(risk, 0, 1);

    return {
      sym: sym, anomalies: an.events, pin: an.pin, recent: recent,
      exhaustion: ex, crowding: cr,
      risk: risk,
      level: risk > 0.66 ? 'high' : risk > 0.38 ? 'elevated' : 'normal'
    };
  }

  global.MICRO = {
    DETECTORS: DETECTORS, EVENT_CLASSES: EVENT_CLASSES,
    anomalies: anomalies, exhaustion: exhaustion, crowding: crowding,
    eventStudy: eventStudy, assess: assess, rsi: rsi, pctRank: pctRank, zscore: zscore
  };
})(window);
