/* Lumen Terminal — Backtest Lab: fair value gaps, their statistics, and a strategy on top. */
(function (global) {
  'use strict';
  var L = global.Lumen, U = global.UNIVERSE, B = global.BACKTEST, UIx = global.UI, el = L.el, F = L.F, M = L.M;

  var st = {
    sym: 'NVDA', tf: '15m', days: 90,
    opts: Object.assign({}, B.DEFAULTS),
    imported: null, importName: null, period: 'month'
  };
  var cache = { bars: null, gaps: null, stats: null, res: null };
  var bodyEl = null;

  function mount(world, params) {
    if (params.sym) { st.sym = params.sym; st.imported = null; st.importName = null; }
    if (params.tf) st.tf = params.tf;
    if (params.days) st.days = params.days;
    var root = el('div', { class: 'bt' });
    root.appendChild(controls(world));
    bodyEl = el('div', { class: 'bt-body', id: 'bt-body' });
    root.appendChild(bodyEl);
    recompute(world);
    return root;
  }

  function bars(world) {
    if (st.imported) return st.imported;
    return global.MARKET.bars(st.sym, st.tf, st.days, world);
  }

  function recompute(world) {
    var bs = bars(world);
    cache.bars = bs;
    cache.gaps = B.detect(bs, st.opts);
    cache.stats = B.stats(bs, cache.gaps, st.tf);
    cache.res = B.run(bs, st.opts, L.state.settings.account.equity);
    render(world);
  }

  /* ---------- controls ---------- */
  function controls(world) {
    var symIn = el('input', {
      class: 'sym-in', value: st.sym, spellcheck: 'false',
      onkeydown: function (e) { if (e.key === 'Enter') { st.sym = symIn.value.trim().toUpperCase(); st.imported = null; st.importName = null; recompute(world); } }
    });

    var o = st.opts;
    function numOpt(k, label, opts, hint) {
      return UIx.field(label, UIx.number(o[k], function (v) { o[k] = v; recompute(world); }, opts), hint);
    }

    var file = el('input', {
      type: 'file', accept: '.csv,text/csv', style: { display: 'none' },
      onchange: function (e) {
        var f = e.target.files[0];
        if (!f) return;
        var rd = new FileReader();
        rd.onload = function () {
          try {
            st.imported = B.parseCSV(String(rd.result));
            st.importName = f.name;
            UIx.toast('Loaded ' + st.imported.length + ' bars from ' + f.name, 'up', 5000);
            recompute(world);
          } catch (err) { UIx.toast(err.message, 'warn', 7000); }
        };
        rd.readAsText(f);
      }
    });

    return UIx.panel('Setup', { icon: '🔬', class: 'p-btset' }, [
      el('div', { class: 'bt-row1' }, [
        UIx.field('Symbol', symIn),
        UIx.field('Timeframe', UIx.toggleRow(global.TERMINAL.TFS, st.tf, function (v) { st.tf = v; recompute(world); })),
        UIx.field('Period', UIx.toggleRow([
          { v: 30, n: '1m' }, { v: 90, n: '3m' }, { v: 180, n: '6m' }, { v: 365, n: '1y' }
        ], st.days, function (v) { st.days = +v; recompute(world); })),
        el('div', { class: 'bt-import' }, [
          el('button', { class: 'btn', text: '⭳ Import TradingView CSV', onclick: function () { file.click(); } }),
          file,
          st.importName ? el('span', { class: 'imp-name' }, [
            UIx.badge('CSV: ' + st.importName, 'up'),
            el('button', { class: 'mini', text: 'clear', onclick: function () { st.imported = null; st.importName = null; recompute(world); } })
          ]) : null
        ])
      ]),
      el('details', { class: 'bt-adv' }, [
        el('summary', { text: 'Detection & strategy parameters' }),
        el('div', { class: 'bt-grid' }, [
          numOpt('minGapAtr', 'Min gap (× ATR)', { step: 0.05, min: 0 }, 'Ignore gaps smaller than this fraction of ATR.'),
          numOpt('displacementAtr', 'Displacement (× ATR)', { step: 0.1, min: 0 }, 'Middle candle body must exceed this.'),
          UIx.field('Require displacement', UIx.toggleRow([{ v: 'y', n: 'yes' }, { v: 'n', n: 'no' }], o.requireDisplacement ? 'y' : 'n',
            function (v) { o.requireDisplacement = v === 'y'; recompute(world); })),
          UIx.field('Fill rule', UIx.toggleRow([{ v: 'touch', n: 'touch' }, { v: 'half', n: '50%' }, { v: 'full', n: 'full' }], o.fillRule,
            function (v) { o.fillRule = v; recompute(world); }), 'What counts as the gap being mitigated.'),
          UIx.field('Trend filter', UIx.toggleRow([{ v: 'none', n: 'none' }, { v: 'ema50', n: 'EMA50' }, { v: 'ema200', n: 'EMA200' }], o.trendFilter,
            function (v) { o.trendFilter = v; recompute(world); })),
          UIx.field('Entry', UIx.toggleRow([{ v: 'edge', n: 'near edge' }, { v: 'mid', n: 'mid' }, { v: 'far', n: 'far edge' }], o.entry,
            function (v) { o.entry = v; recompute(world); })),
          numOpt('stopBufferAtr', 'Stop buffer (× ATR)', { step: 0.05, min: 0 }),
          numOpt('rr', 'Target (R multiple)', { step: 0.25, min: 0.25 }),
          numOpt('riskPct', 'Risk per trade (%)', { step: 0.1, min: 0.05 }),
          numOpt('maxBarsInTrade', 'Max bars in trade', { step: 5, min: 3 }),
          numOpt('maxAge', 'Gap lifespan (bars)', { step: 10, min: 5 }),
          UIx.field('Session', UIx.toggleRow([{ v: 'all', n: 'all' }, { v: 'rth', n: 'RTH' }, { v: 'first2h', n: 'first 2h' }], o.sessionFilter,
            function (v) { o.sessionFilter = v; recompute(world); })),
          UIx.field('Shorts', UIx.toggleRow([{ v: 'y', n: 'on' }, { v: 'n', n: 'off' }], o.allowShorts ? 'y' : 'n',
            function (v) { o.allowShorts = v === 'y'; recompute(world); }))
        ])
      ])
    ]);
  }

  /* ---------- render ---------- */
  function render(world) {
    var host = bodyEl;
    if (!host) return;
    L.clear(host);
    if (!cache.bars || cache.bars.length < 30) {
      host.appendChild(UIx.empty('Not enough bars for ' + st.sym, 'Try a longer period or a higher timeframe.'));
      return;
    }
    host.appendChild(dataBanner());
    host.appendChild(chartPanel(world));
    host.appendChild(el('div', { class: 'bt-cols' }, [gapStatsPanel(), whenPanel()]));
    host.appendChild(strategyPanel(world));
    host.appendChild(periodicPanel(world));
    host.appendChild(sweepPanel(world));
    host.appendChild(tradesPanel());
  }

  function dataBanner() {
    var src = st.imported ? 'TradingView CSV (' + st.importName + ')'
      : (global.PROVIDERS.isLive() ? 'live provider' : 'built-in demo generator');
    var tone = st.imported ? 'up' : (global.PROVIDERS.isLive() ? 'i' : 'sim');
    var b = el('div', { class: 'bt-banner tone-' + tone }, [
      UIx.badge(st.imported ? 'REAL DATA' : (global.PROVIDERS.isLive() ? 'LIVE' : 'SIMULATED'), tone),
      el('span', {}, ['Bars: ', el('b', { text: String(cache.bars.length) }), ' · ',
        F.date(new Date(cache.bars[0].t)), ' → ', F.date(new Date(cache.bars[cache.bars.length - 1].t)),
        ' · source: ', el('b', { text: src })])
    ]);
    if (!st.imported && !global.PROVIDERS.isLive()) {
      b.appendChild(el('span', { class: 'bt-warn', text: 'These prices are generated, not historical. Statistics below describe this synthetic series — they are not evidence that the strategy works in the market. Import a TradingView CSV of the real instrument to test it for real.' }));
    }
    return b;
  }

  function chartPanel(world) {
    var wnd = { v: 180 };
    var cvHost = el('div', { class: 'chart-host' });
    var cv = UIx.canvasBox('big', 380, function (c) {
      global.CHART.candles(c, cache.bars, { gaps: cache.gaps, trades: cache.res.trades, window: wnd.v, maxAge: st.opts.maxAge });
    });
    cvHost.appendChild(cv);
    var last = cache.bars[cache.bars.length - 1];
    var first = cache.bars[Math.max(0, cache.bars.length - wnd.v)];
    return UIx.panel(st.sym + ' · ' + st.tf, {
      icon: '📊', class: 'p-chart',
      actions: [
        UIx.toggleRow([{ v: 80, n: '80' }, { v: 180, n: '180' }, { v: 400, n: '400' }, { v: 99999, n: 'all' }], wnd.v, function (v) {
          wnd.v = +v; cv._redraw();
        }),
        el('span', { class: 'lg-note' }, [
          el('i', { class: 'sw up' }), 'unfilled bullish gap ',
          el('i', { class: 'sw down' }), 'unfilled bearish gap'
        ])
      ]
    }, [
      el('div', { class: 'chart-top' }, [
        el('b', { class: last.c >= first.c ? 'up' : 'down', text: F.num(last.c, 2) }),
        el('span', { text: F.pct((last.c - first.c) / first.c * 100) + ' over window' }),
        UIx.badge(cache.stats.total + ' gaps', 'i'),
        UIx.badge(cache.stats.unfilled + ' still open', 'warn')
      ]),
      cvHost
    ]);
  }

  /* ---------- gap statistics ---------- */
  function gapStatsPanel() {
    var s = cache.stats;
    var sizes = cache.gaps.map(function (g) { return g.sizeAtr; });
    var ttf = cache.gaps.filter(function (g) { return g.filled; }).map(function (g) { return g.barsToFill; });
    return UIx.panel('Gap statistics', { icon: '📐', class: 'p-gstat' }, [
      el('div', { class: 'grid4' }, [
        UIx.stat('Gaps found', String(s.total), { sub: s.bull + ' bullish / ' + s.bear + ' bearish' }),
        UIx.stat('Per session', s.perSession.toFixed(2), { sub: s.sessions + ' sessions' }),
        UIx.stat('Median size', s.medianSizeAtr.toFixed(2) + ' ATR', { sub: F.pctRaw(s.medianSizePct, 2) + ' of price' }),
        UIx.stat('Still unfilled', String(s.unfilled), { tone: s.unfilled ? 'warn' : 'n', sub: 'live zones' })
      ]),
      el('h4', { class: 'sd-sub', text: 'Mitigation — how often price comes back' }),
      el('div', { class: 'grid3' }, [
        UIx.stat('Touched', F.pctRaw(s.fillTouch, 1), { tone: 'up' }),
        UIx.stat('50% filled', F.pctRaw(s.fillHalf, 1)),
        UIx.stat('Fully filled', F.pctRaw(s.fillFull, 1))
      ]),
      el('div', { class: 'grid3' }, [
        UIx.stat('Median time to fill', s.medianBarsToFill + ' bars', { sub: F.dur(s.medianBarsToFill, st.tf) }),
        UIx.stat('Mean', s.meanBarsToFill.toFixed(1) + ' bars'),
        UIx.stat('90th pct', s.p90BarsToFill.toFixed(0) + ' bars', { sub: F.dur(s.p90BarsToFill, st.tf) })
      ]),
      el('h4', { class: 'sd-sub', text: 'Gap size distribution (× ATR)' }),
      UIx.canvasBox('', 100, function (cv) {
        global.CHART.hbars(cv, histogram(sizes, 6, function (v) { return v.toFixed(1); }), { labelW: 70, rowH: 15, neutral: true, fmt: function (v) { return String(v); } });
      }),
      ttf.length ? el('h4', { class: 'sd-sub', text: 'Bars until mitigation' }) : null,
      ttf.length ? UIx.canvasBox('', 100, function (cv) {
        global.CHART.hbars(cv, histogram(ttf, 6, function (v) { return v.toFixed(0); }), { labelW: 70, rowH: 15, neutral: true, fmt: function (v) { return String(v); } });
      }) : null
    ]);
  }

  function histogram(vals, bins, fmt) {
    if (!vals.length) return [];
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    if (lo === hi) hi = lo + 1;
    var w = (hi - lo) / bins, out = [];
    for (var i = 0; i < bins; i++) {
      var a = lo + i * w, b = a + w;
      var n = vals.filter(function (v) { return v >= a && (i === bins - 1 ? v <= b : v < b); }).length;
      out.push({ k: fmt(a) + '–' + fmt(b), v: n });
    }
    return out;
  }

  /* ---------- when are gaps most apparent ---------- */
  function whenPanel() {
    var s = cache.stats;
    var order = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    var dow = order.filter(function (d) { return s.byDowNorm[d] !== undefined; })
      .map(function (d) { return { k: d, v: s.byDowNorm[d] }; });
    var hours = Object.keys(s.byHour).map(Number).sort(function (a, b) { return a - b; })
      .map(function (h) { return { k: String(h).padStart(2, '0') + ':00Z', v: s.byHour[h] }; });
    var cal = s.dayKeys.map(function (k, i) {
      return { d: k, v: s.byDay[k].gaps, ev: s.byDay[k].ev, week: Math.floor(i / 7) };
    });
    var ratio = s.densityNormalDays ? s.densityEventDays / s.densityNormalDays : 0;

    return UIx.panel('When gaps show up', { icon: '🗓', class: 'p-when' }, [
      el('div', { class: 'grid3' }, [
        UIx.stat('On event days', F.pctRaw(s.densityEventDays, 2) + ' of bars', { tone: 'warn', sub: s.eventDayCount + ' days' }),
        UIx.stat('On quiet days', F.pctRaw(s.densityNormalDays, 2) + ' of bars', { sub: s.normalDayCount + ' days' }),
        UIx.stat('Concentration', ratio ? ratio.toFixed(2) + '×' : '—', { tone: ratio > 1.3 ? 'up' : 'n', sub: 'event vs quiet' })
      ]),
      el('p', { class: 'note', text: ratio > 1.3
        ? 'Displacement clusters on scheduled-event days by a factor of ' + ratio.toFixed(1) + '. If you only want to be at the screen when gaps are likely, the event calendar is the filter that matters most.'
        : 'Gap formation is fairly evenly spread across event and quiet days in this window — the calendar is not adding much here.' }),
      el('h4', { class: 'sd-sub', text: 'By weekday (gaps per session)' }),
      UIx.canvasBox('', dow.length * 20 + 10, function (cv) {
        global.CHART.hbars(cv, dow, { labelW: 44, neutral: true, fmt: function (v) { return v.toFixed(2); } });
      }),
      el('h4', { class: 'sd-sub', text: 'By hour (UTC)' }),
      UIx.canvasBox('', Math.min(280, hours.length * 16 + 10), function (cv) {
        global.CHART.hbars(cv, hours, { labelW: 56, rowH: 15, neutral: true, fmt: function (v) { return String(v); } });
      }),
      el('h4', { class: 'sd-sub', text: 'Daily density — outlined cells are scheduled-event days' }),
      UIx.canvasBox('', 110, function (cv) { global.CHART.calendar(cv, cal); }),
      el('h4', { class: 'sd-sub', text: 'Heaviest sessions' }),
      UIx.table([{ t: 'Date' }, { t: 'Gaps', align: 'r' }, { t: 'Bars', align: 'r' }, { t: 'Event day', align: 'r' }],
        s.hotDays.slice(0, 8).map(function (d) {
          return [d.d, { t: String(d.g), align: 'r' }, { t: String(d.n), align: 'r' },
            { node: d.ev ? UIx.badge('yes', 'warn') : el('span', { text: '—' }), align: 'r' }];
        }))
    ]);
  }

  /* ---------- strategy ---------- */
  function strategyPanel(world) {
    var r = cache.res.stats;
    var curve = cache.res.curve;
    var eq0 = curve.length ? curve[0].e : 0;
    return UIx.panel('Strategy result', { icon: '🧪', class: 'p-strat' }, [
      el('div', { class: 'grid6' }, [
        UIx.stat('Trades', String(r.n), { sub: r.longs + 'L / ' + r.shorts + 'S' }),
        UIx.stat('Win rate', F.pctRaw(r.winRate, 1), { tone: r.winRate >= B.DEFAULTS.rr ? 'n' : 'n' }),
        UIx.stat('Expectancy', r.expectancyR.toFixed(3) + ' R', { tone: UIx.tone(r.expectancyR) }),
        UIx.stat('Total', r.totalR.toFixed(1) + ' R', { tone: UIx.tone(r.totalR) }),
        UIx.stat('Profit factor', isFinite(r.profitFactor) ? r.profitFactor.toFixed(2) : '∞', { tone: UIx.tone(r.profitFactor - 1) }),
        UIx.stat('Max drawdown', F.pctRaw(r.maxDD, 1), { tone: 'down' })
      ]),
      el('div', { class: 'grid6' }, [
        UIx.stat('P/L', F.usd(r.pl, 0), { tone: UIx.tone(r.pl) }),
        UIx.stat('Return', F.pct(r.plPct), { tone: UIx.tone(r.plPct) }),
        UIx.stat('Sharpe (daily R)', r.sharpe.toFixed(2), { tone: UIx.tone(r.sharpe) }),
        UIx.stat('Breakeven WR', F.pctRaw(global.RISK.breakevenWinRate(st.opts.rr), 1), { sub: 'at ' + st.opts.rr + 'R' }),
        UIx.stat('Avg hold', r.avgBars.toFixed(0) + ' bars', { sub: F.dur(r.avgBars || 0, st.tf) }),
        UIx.stat('Best / worst', r.bestR.toFixed(1) + ' / ' + r.worstR.toFixed(1) + ' R')
      ]),
      el('h4', { class: 'sd-sub', text: 'Equity curve' }),
      UIx.canvasBox('', 190, function (cv) {
        global.CHART.line(cv, curve.map(function (c) { return c.e; }), { zero: eq0 });
      }),
      r.n ? el('div', { class: 'ev-split' }, [
        el('h4', { text: 'Event-day trades vs the rest' }),
        UIx.table([{ t: 'Cohort' }, { t: 'Trades', align: 'r' }, { t: 'Avg R', align: 'r' }],
          [['Formed on an event day', { t: String(r.eventTrades), align: 'r' }, { t: r.eventR.toFixed(3), align: 'r' }],
           ['All other', { t: String(r.n - r.eventTrades), align: 'r' }, { t: r.normalR.toFixed(3), align: 'r' }]])
      ]) : null,
      el('p', { class: 'note small', text: 'The engine fills at the gap edge when price trades into the zone, stops beyond the far edge plus a buffer, and exits at the R target or on the bar limit. Where a bar touches both stop and target it is booked as a loss. There is no slippage or commission modelled — subtract roughly 0.05–0.15R per trade for a realistic net.' })
    ]);
  }

  /* ---------- anchored periodic runs ---------- */
  function periodicPanel(world) {
    var host = el('div', {});
    function draw() {
      L.clear(host);
      var r = B.runPeriodic(cache.bars, st.opts, st.period, L.state.settings.account.equity);
      if (!r.summary) { host.appendChild(UIx.empty(r.note)); return; }
      var s = r.summary;
      host.appendChild(el('p', { class: 'note', text:
        'The strategy is restarted at the beginning of every ' + r.periodName.toLowerCase() +
        ' with the same capital and an empty book, so no period inherits the one before it. ' +
        'Each period is also measured against simply buying at the period open and holding — if the strategy cannot beat that, it is work for nothing.' }));

      host.appendChild(el('div', { class: 'grid6' }, [
        UIx.stat(r.periodName + 's', String(s.periods), { sub: s.tradedPeriods + ' with trades' }),
        UIx.stat('Profitable', F.pctRaw(s.consistency, 0), { tone: s.consistency >= 55 ? 'up' : s.consistency >= 45 ? 'n' : 'down', sub: s.profitablePeriods + '/' + s.tradedPeriods }),
        UIx.stat('Beat buy & hold', F.pctRaw(s.beatHold, 0), { tone: s.beatHold >= 55 ? 'up' : 'down' }),
        UIx.stat('Mean per ' + r.periodName.toLowerCase(), s.meanR.toFixed(2) + ' R', { tone: UIx.tone(s.meanR) }),
        UIx.stat('Spread (sd)', s.sdR.toFixed(2) + ' R', { sub: 'period to period' }),
        UIx.stat('Best period share', s.concentration === null ? 'n/a' : F.pctRaw(s.concentration * 100, 0), {
          tone: s.concentration !== null && s.concentration > 0.6 ? 'down' : 'n',
          sub: s.concentration === null ? 'total R is negative' : s.concentration > 0.6 ? 'one period carries it' : 'of total R'
        })
      ]));

      if (s.concentration !== null && s.concentration > 0.6) {
        host.appendChild(el('p', { class: 'bt-warn', text:
          'One ' + r.periodName.toLowerCase() + ' produced ' + (s.concentration * 100).toFixed(0) +
          '% of the entire result. Strip it out and there is very little left — that is a single good run, not a repeatable edge.' }));
      }

      host.appendChild(UIx.canvasBox('', Math.min(420, r.rows.length * 18 + 12), function (cv) {
        global.CHART.hbars(cv, r.rows.map(function (x) { return { k: x.key, v: x.totalR }; }),
          { labelW: 74, rowH: 17, fmt: function (v) { return v.toFixed(1) + 'R'; } });
      }));

      host.appendChild(UIx.table(
        [{ t: r.periodName }, { t: 'Bars', align: 'r' }, { t: 'Gaps', align: 'r' }, { t: 'Trades', align: 'r' },
         { t: 'Win %', align: 'r' }, { t: 'Total R', align: 'r' }, { t: 'Strategy %', align: 'r' },
         { t: 'Buy & hold %', align: 'r' }, { t: 'Difference', align: 'r' }, { t: 'MaxDD %', align: 'r' }],
        r.rows.map(function (x) {
          return {
            _class: x.n === 0 ? 'muted' : x.totalR > 0 ? 'win' : 'loss',
            cells: [
              x.key,
              { t: String(x.bars), align: 'r' },
              { t: String(x.gaps), align: 'r' },
              { t: String(x.n), align: 'r' },
              { t: x.n ? x.winRate.toFixed(0) : '—', align: 'r' },
              { node: el('span', { class: x.totalR >= 0 ? 'up' : 'down', text: x.totalR.toFixed(1) }), align: 'r' },
              { node: el('span', { class: x.plPct >= 0 ? 'up' : 'down', text: F.pct(x.plPct) }), align: 'r' },
              { node: el('span', { class: x.hold >= 0 ? 'up' : 'down', text: F.pct(x.hold) }), align: 'r' },
              { node: el('span', { class: x.vsHold >= 0 ? 'up' : 'down', text: F.pct(x.vsHold) }), align: 'r' },
              { t: x.maxDD.toFixed(1), align: 'r' }
            ]
          };
        })));
    }
    var p = UIx.panel('Anchored periodic runs', {
      icon: '🗓', class: 'p-periodic',
      actions: [UIx.toggleRow(
        Object.keys(B.PERIODS).map(function (k) { return { v: k, n: B.PERIODS[k].n }; }),
        st.period, function (v) { st.period = v; draw(); })]
    }, [host]);
    draw();
    return p;
  }

  /* ---------- sweep ---------- */
  function sweepPanel(world) {
    var host = el('div', {});
    var param = { v: 'rr' };
    var PARAMS = {
      rr: { n: 'Target (R)', vals: [1, 1.5, 2, 2.5, 3, 4] },
      minGapAtr: { n: 'Min gap (ATR)', vals: [0.05, 0.1, 0.2, 0.3, 0.5, 0.8] },
      displacementAtr: { n: 'Displacement (ATR)', vals: [0.4, 0.6, 0.8, 1.0, 1.4, 1.8] },
      stopBufferAtr: { n: 'Stop buffer (ATR)', vals: [0, 0.1, 0.25, 0.5, 0.8] },
      maxBarsInTrade: { n: 'Max bars held', vals: [10, 20, 40, 60, 100, 200] }
    };
    function draw() {
      L.clear(host);
      var cfg = PARAMS[param.v];
      var rows = B.sweep(cache.bars, st.opts, param.v, cfg.vals);
      host.appendChild(UIx.table(
        [{ t: cfg.n }, { t: 'Trades', align: 'r' }, { t: 'Win %', align: 'r' }, { t: 'Exp R', align: 'r' }, { t: 'Total R', align: 'r' }, { t: 'PF', align: 'r' }, { t: 'MaxDD %', align: 'r' }],
        rows.map(function (r) {
          return {
            _class: r.v === st.opts[param.v] ? 'cur' : '',
            cells: [String(r.v), { t: String(r.n), align: 'r' }, { t: r.winRate.toFixed(1), align: 'r' },
              { node: el('span', { class: r.expectancyR >= 0 ? 'up' : 'down', text: r.expectancyR.toFixed(3) }), align: 'r' },
              { t: r.totalR.toFixed(1), align: 'r' },
              { t: isFinite(r.pf) ? r.pf.toFixed(2) : '∞', align: 'r' },
              { t: r.maxDD.toFixed(1), align: 'r' }]
          };
        })));
      host.appendChild(UIx.canvasBox('', rows.length * 20 + 10, function (cv) {
        global.CHART.hbars(cv, rows.map(function (r) { return { k: String(r.v), v: r.totalR }; }),
          { labelW: 50, fmt: function (v) { return v.toFixed(1) + 'R'; } });
      }));
    }
    var p = UIx.panel('Parameter sweep', {
      icon: '🎚', class: 'p-sweep',
      actions: [UIx.toggleRow(Object.keys(PARAMS).map(function (k) { return { v: k, n: PARAMS[k].n }; }), param.v, function (v) { param.v = v; draw(); })]
    }, [
      el('p', { class: 'note', text: 'One parameter at a time, everything else held at your current settings. A result that only works at one value on the grid is a curve fit, not an edge.' }),
      host
    ]);
    draw();
    return p;
  }

  /* ---------- trades ---------- */
  function tradesPanel() {
    var ts = cache.res.trades;
    if (!ts.length) return UIx.panel('Trades', { icon: '🧾' }, [UIx.empty('No trades triggered', 'Loosen the filters — try trend filter "none" or a smaller minimum gap.')]);
    return UIx.panel('Trades', { icon: '🧾', class: 'p-trades', count: ts.length }, [
      UIx.table([{ t: '#' }, { t: 'Dir' }, { t: 'Entry time' }, { t: 'Entry', align: 'r' }, { t: 'Exit', align: 'r' }, { t: 'R', align: 'r' }, { t: 'P/L', align: 'r' }, { t: 'Bars', align: 'r' }, { t: 'Exit reason' }, { t: 'Gap size', align: 'r' }],
        ts.slice().reverse().map(function (t, i) {
          return {
            _class: t.pl > 0 ? 'win' : 'loss',
            cells: [String(ts.length - i),
              { node: UIx.badge(t.dir === 1 ? 'LONG' : 'SHORT', t.dir === 1 ? 'up' : 'down') },
              new Date(t.entryT).toISOString().slice(0, 16).replace('T', ' '),
              { t: F.num(t.entry, 2), align: 'r' },
              { t: F.num(t.exit, 2), align: 'r' },
              { node: el('span', { class: t.r >= 0 ? 'up' : 'down', text: t.r.toFixed(2) }), align: 'r' },
              { node: el('span', { class: t.pl >= 0 ? 'up' : 'down', text: F.usd(t.pl, 0) }), align: 'r' },
              { t: String(t.bars), align: 'r' },
              t.why,
              { t: t.gapSizeAtr.toFixed(2) + ' ATR', align: 'r' }]
          };
        }))
    ]);
  }

  UIx.register('backtest', { mount: mount });
})(window);
