/* Lumen Terminal — risk framing.
   Position sizing, scenario P&L, concentration checks and the probability×impact matrix that
   sits behind every idea the terminal proposes. */
(function (global) {
  'use strict';
  var L = global.Lumen, U = global.UNIVERSE, M = L.M;

  /* ---------- position sizing ---------- */
  function size(opts) {
    var equity = opts.equity, riskPct = opts.riskPct, entry = opts.entry, stop = opts.stop;
    var riskAmt = equity * (riskPct / 100);
    var per = Math.abs(entry - stop);
    if (!per) return null;
    var qty = riskAmt / per;
    var notional = qty * entry;
    return {
      riskAmt: riskAmt, perUnit: per, qty: qty, notional: notional,
      leverage: notional / equity,
      stopPct: per / entry * 100,
      target1R: entry + (entry > stop ? per : -per),
      target2R: entry + (entry > stop ? 2 * per : -2 * per),
      target3R: entry + (entry > stop ? 3 * per : -3 * per)
    };
  }

  function expectancy(winRate, rr, costR) {
    var w = winRate / 100;
    return w * rr - (1 - w) * 1 - (costR || 0);
  }
  function kelly(winRate, rr) {
    var w = winRate / 100, b = rr;
    var f = (w * (b + 1) - 1) / b;
    return M.clamp(f, 0, 1);
  }
  function breakevenWinRate(rr) { return 100 / (1 + rr); }

  /* ---------- portfolio ---------- */
  function portfolioExposure(positions) {
    var bySector = {}, byCountry = {}, gross = 0, net = 0;
    positions.forEach(function (p) {
      var e = U.findEntity(p.t);
      var sec = e ? e.sector : 'other', c = e ? e.c : null;
      var v = p.qty * p.price * (p.side === 'short' ? -1 : 1);
      gross += Math.abs(v); net += v;
      bySector[sec] = (bySector[sec] || 0) + v;
      if (c) byCountry[c] = (byCountry[c] || 0) + v;
    });
    return { gross: gross, net: net, bySector: bySector, byCountry: byCountry };
  }

  function concentration(positions, equity, limits) {
    var lim = Object.assign({ sectorPct: 30, namePct: 15, grossPct: 200 }, limits || {});
    var ex = portfolioExposure(positions);
    var warns = [];
    Object.keys(ex.bySector).forEach(function (s) {
      var pct = Math.abs(ex.bySector[s]) / equity * 100;
      if (pct > lim.sectorPct) {
        var ind = U.findIndustry(s);
        warns.push({ level: pct > lim.sectorPct * 1.5 ? 'high' : 'med', k: 'sector',
          msg: (ind ? ind.n : s) + ' is ' + pct.toFixed(0) + '% of equity (limit ' + lim.sectorPct + '%)' });
      }
    });
    positions.forEach(function (p) {
      var pct = Math.abs(p.qty * p.price) / equity * 100;
      if (pct > lim.namePct) warns.push({ level: pct > lim.namePct * 1.6 ? 'high' : 'med', k: 'name',
        msg: p.t + ' is ' + pct.toFixed(0) + '% of equity (limit ' + lim.namePct + '%)' });
    });
    var gp = ex.gross / equity * 100;
    if (gp > lim.grossPct) warns.push({ level: 'high', k: 'gross', msg: 'Gross exposure ' + gp.toFixed(0) + '% of equity' });
    return { exposure: ex, grossPct: gp, netPct: ex.net / equity * 100, warnings: warns };
  }

  /* ---------- scenario P&L ---------- */
  /* Applies a cascade run's sector scores to current positions. */
  function scenarioPL(positions, expressions, equity) {
    if (!expressions) return null;
    var bySec = {};
    expressions.sectors.forEach(function (s) { bySec[s.id] = s; });
    var rows = positions.map(function (p) {
      var e = U.findEntity(p.t);
      var sec = e ? e.sector : null;
      var s = sec ? bySec[sec] : null;
      var prof = global.MARKET ? global.MARKET.profile(p.t) : { vol: 0.02 };
      var movePct = s ? M.clamp(s.score * 1.5, -4, 4) * prof.vol * 100 * Math.sqrt(5) : 0;
      var dirMult = p.side === 'short' ? -1 : 1;
      var pl = p.qty * p.price * (movePct / 100) * dirMult;
      return { t: p.t, sector: sec, sectorName: s ? s.n : '—', movePct: movePct, pl: pl, notional: p.qty * p.price * dirMult };
    });
    var total = M.sum(rows.map(function (r) { return r.pl; }));
    return {
      rows: rows.sort(function (a, b) { return a.pl - b.pl; }),
      total: total,
      pctOfEquity: equity ? total / equity * 100 : 0,
      worst: rows.slice(0, 3), best: rows.slice(-3).reverse()
    };
  }

  /* rough parametric VaR from position vols + a shared correlation assumption */
  function varEstimate(positions, equity, conf, horizonDays, rho) {
    conf = conf || 0.95; horizonDays = horizonDays || 1; rho = rho === undefined ? 0.45 : rho;
    if (!positions.length) return { var: 0, pct: 0 };
    var sigmas = positions.map(function (p) {
      var prof = global.MARKET ? global.MARKET.profile(p.t) : { vol: 0.02 };
      return Math.abs(p.qty * p.price) * prof.vol;
    });
    var sumSq = M.sum(sigmas.map(function (x) { return x * x; }));
    var sum = M.sum(sigmas);
    /* variance with a flat correlation across the book */
    var variance = sumSq + rho * (sum * sum - sumSq);
    var sd = Math.sqrt(Math.max(0, variance)) * Math.sqrt(horizonDays);
    var z = conf >= 0.99 ? 2.326 : conf >= 0.975 ? 1.96 : 1.645;
    var v = sd * z;
    return { var: v, pct: equity ? v / equity * 100 : 0, sd: sd, conf: conf, horizonDays: horizonDays, rho: rho };
  }

  /* ---------- probability × impact matrix ---------- */
  function matrix(runs, positions, equity) {
    return (runs || []).map(function (r) {
      var ex = global.CASCADE.expressions(r.run);
      var pl = positions && positions.length ? scenarioPL(positions, ex, equity) : null;
      var impact = pl ? Math.abs(pl.pctOfEquity) : Math.abs(M.sum(ex.sectors.map(function (s) { return s.score; })));
      return {
        id: r.run.seed, name: r.run.seedNode.n, short: r.run.seedNode.short || r.run.seedNode.n, severity: r.run.severity,
        p: r.p === undefined ? r.run.severity : r.p,
        impactPct: pl ? pl.pctOfEquity : null,
        impact: impact,
        winners: ex.winners.slice(0, 3).map(function (s) { return s.n.split(' —')[0]; }),
        losers: ex.losers.slice(0, 3).map(function (s) { return s.n.split(' —')[0]; }),
        ex: ex, pl: pl
      };
    }).sort(function (a, b) { return (b.p * b.impact) - (a.p * a.impact); });
  }

  /* ---------- hedge suggestions ---------- */
  function hedges(expressions, positions, equity) {
    if (!expressions) return [];
    var out = [];
    var worstSectors = expressions.losers.slice(0, 3);
    var bestSectors = expressions.winners.slice(0, 3);
    var held = {};
    (positions || []).forEach(function (p) {
      var e = U.findEntity(p.t);
      if (e && e.sector) held[e.sector] = (held[e.sector] || 0) + p.qty * p.price;
    });
    worstSectors.forEach(function (s) {
      if (held[s.id]) {
        out.push({
          kind: 'reduce', sector: s.id, sectorName: s.n,
          why: 'You hold ' + L.F.usdc(held[s.id]) + ' in ' + s.n.split(' —')[0] + ', which this scenario scores at ' + s.score.toFixed(2) + '.',
          how: 'Trim, or offset with a long in ' + (bestSectors[0] ? bestSectors[0].n.split(' —')[0] : 'a beneficiary sector') + '.'
        });
      } else {
        out.push({ kind: 'avoid', sector: s.id, sectorName: s.n,
          why: s.n.split(' —')[0] + ' scores ' + s.score.toFixed(2) + ' under this scenario.',
          how: 'Stay flat, or express the downside via the sector leaders.' });
      }
    });
    bestSectors.forEach(function (s) {
      var lead = s.leaders && s.leaders[0];
      out.push({ kind: 'add', sector: s.id, sectorName: s.n,
        why: s.n.split(' —')[0] + ' is the strongest beneficiary at score ' + s.score.toFixed(2) + '.',
        how: 'Leaders: ' + (s.leaders || []).slice(0, 3).map(function (x) { return x.t; }).join(', ') + (lead ? '. Highest-conviction: ' + lead.n + '.' : '') });
    });
    return out;
  }

  /* ---------- trade plan ---------- */
  function plan(opts) {
    var sz = size(opts);
    if (!sz) return null;
    var be = breakevenWinRate(opts.rr || 2);
    return {
      symbol: opts.t, side: opts.entry > opts.stop ? 'long' : 'short',
      entry: opts.entry, stop: opts.stop, size: sz,
      rr: opts.rr || 2,
      breakevenWinRate: be,
      expectancyAtWin: function (wr) { return expectancy(wr, opts.rr || 2); },
      note: 'Risking ' + L.F.usd(sz.riskAmt, 0) + ' (' + opts.riskPct + '% of ' + L.F.usdc(opts.equity) + '). ' +
        'You need to be right more than ' + be.toFixed(0) + '% of the time at ' + (opts.rr || 2) + 'R for this to make money.'
    };
  }

  global.RISK = {
    size: size, expectancy: expectancy, kelly: kelly, breakevenWinRate: breakevenWinRate,
    portfolioExposure: portfolioExposure, concentration: concentration,
    scenarioPL: scenarioPL, varEstimate: varEstimate, matrix: matrix, hedges: hedges, plan: plan
  };
})(window);
