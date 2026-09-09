/* Lumen Terminal — Book & Risk: the paper book, its exposure, and what scenarios do to it. */
(function (global) {
  'use strict';
  var L = global.Lumen, U = global.UNIVERSE, R = global.RISK, C = global.CASCADE, UIx = global.UI, el = L.el, F = L.F, M = L.M;

  var BKEY = 'lumen.book.v1';
  var book = load(), bodyEl = null;

  function load() {
    try { return JSON.parse(localStorage.getItem(BKEY)) || { positions: [], journal: [] }; }
    catch (e) { return { positions: [], journal: [] }; }
  }
  function save() {
    try { localStorage.setItem(BKEY, JSON.stringify(book)); } catch (e) { /* private mode */ }
    global.APP.positions = book.positions;
  }

  function mount(world) {
    global.APP.positions = book.positions;
    var root = el('div', { class: 'book' });
    bodyEl = el('div', { id: 'book-body' });
    root.appendChild(bodyEl);
    setTimeout(function () { render(world); }, 0);
    return root;
  }

  function marked(world) {
    return book.positions.map(function (p) {
      var q = global.MARKET.quote(p.t, world);
      var px = q ? q.price : p.entry;
      var dir = p.side === 'short' ? -1 : 1;
      var pl = (px - p.entry) * p.qty * dir;
      var e = U.findEntity(p.t);
      return Object.assign({}, p, {
        price: px, pl: pl, plPct: p.entry ? (px - p.entry) / p.entry * 100 * dir : 0,
        notional: px * p.qty, sector: e ? e.sector : null, sectorName: e ? e.sectorName : '—',
        country: e ? e.c : null
      });
    });
  }

  function render(world) {
    var host = bodyEl;
    if (!host) return;
    L.clear(host);
    var pos = marked(world);
    var eq = L.state.settings.account.equity;

    host.appendChild(alpacaPanel());
    host.appendChild(positionsPanel(pos, world, eq));
    if (pos.length) {
      host.appendChild(el('div', { class: 'book-cols' }, [exposurePanel(pos, eq), riskPanel(pos, eq)]));
      host.appendChild(scenarioPanel(pos, eq, world));
    } else {
      host.appendChild(UIx.panel('Scenario impact', { icon: '⚡' }, [
        UIx.empty('Add a position to see what each scenario does to the book',
          'Everything here is local paper — nothing is sent anywhere unless you configure Alpaca.')
      ]));
    }
    host.appendChild(matrixPanel(pos, eq, world));
  }

  /* ---------- Alpaca paper trading ---------- */
  function alpacaPanel() {
    var A = global.PROVIDERS.alpaca;
    var host = el('div', {});
    var why = A.why();

    if (why) {
      host.appendChild(el('div', { class: 'alp-off' }, [
        UIx.badge('NOT CONNECTED', 'n'),
        el('span', { text: why }),
        el('button', { class: 'mini', text: 'open settings', onclick: function () { global.APP.showSettings(); } })
      ]));
      host.appendChild(el('p', { class: 'note small', text: 'Until Alpaca is connected the book above is local paper only: it lives in this browser and no order ever leaves the page. That is the safe default — connect Alpaca when you actually want fills on their paper venue.' }));
      return UIx.panel('Alpaca paper account', { icon: '🧾', class: 'p-alp' }, [host]);
    }

    host.appendChild(el('div', { class: 'loading', text: 'Loading Alpaca paper account…' }));

    var p = UIx.panel('Alpaca paper account', {
      icon: '🧾', class: 'p-alp',
      actions: [
        el('button', { class: 'btn', text: 'Order ticket', onclick: function () { orderTicket(); } }),
        el('button', { class: 'mini', text: 'refresh', onclick: function () { load(); } })
      ]
    }, [host]);

    function load() {
      L.clear(host);
      host.appendChild(el('div', { class: 'loading', text: 'Loading…' }));
      Promise.all([A.account(), A.positions(), A.orders('open')])
        .then(function (res) {
          var acct = res[0], positions = res[1] || [], orders = res[2] || [];
          L.clear(host);
          host.appendChild(el('div', { class: 'grid4' }, [
            UIx.stat('Equity', F.usd(+acct.equity, 0)),
            UIx.stat('Cash', F.usd(+acct.cash, 0)),
            UIx.stat('Buying power', F.usd(+acct.buying_power, 0)),
            UIx.stat('Status', acct.status, { tone: acct.status === 'ACTIVE' ? 'up' : 'warn' })
          ]));
          host.appendChild(el('h4', { class: 'sd-sub', text: 'Positions' }));
          host.appendChild(positions.length
            ? UIx.table([{ t: 'Sym' }, { t: 'Qty', align: 'r' }, { t: 'Avg', align: 'r' }, { t: 'Mark', align: 'r' }, { t: 'P/L', align: 'r' }, { t: '', align: 'r' }],
                positions.map(function (x) {
                  return {
                    cells: [x.symbol, { t: F.num(+x.qty, 0), align: 'r' },
                      { t: F.num(+x.avg_entry_price, 2), align: 'r' },
                      { t: F.num(+x.current_price, 2), align: 'r' },
                      { node: el('span', { class: +x.unrealized_pl >= 0 ? 'up' : 'down', text: F.usd(+x.unrealized_pl, 0) }), align: 'r' },
                      { node: el('button', { class: 'mini', text: 'flatten', onclick: function () {
                        A.submit({ symbol: x.symbol, qty: Math.abs(+x.qty), side: +x.qty > 0 ? 'sell' : 'buy', type: 'market', time_in_force: 'day' })
                          .then(function () { UIx.toast('Close order sent for ' + x.symbol, 'up'); load(); })
                          .catch(function (e) { UIx.toast(e.message, 'warn', 7000); });
                      } }), align: 'r' }]
                  };
                }))
            : UIx.empty('No open positions on the paper account'));
          if (orders.length) {
            host.appendChild(el('h4', { class: 'sd-sub', text: 'Open orders' }));
            host.appendChild(UIx.table([{ t: 'Sym' }, { t: 'Side' }, { t: 'Qty', align: 'r' }, { t: 'Type' }, { t: 'Status' }, { t: '', align: 'r' }],
              orders.map(function (o) {
                return {
                  cells: [o.symbol, o.side, { t: o.qty, align: 'r' }, o.type, o.status,
                    { node: el('button', { class: 'mini', text: 'cancel', onclick: function () {
                      A.cancel(o.id).then(function () { UIx.toast('Cancelled', 'n'); load(); })
                        .catch(function (e) { UIx.toast(e.message, 'warn'); });
                    } }), align: 'r' }]
                };
              })));
          }
        })
        .catch(function (e) {
          L.clear(host);
          host.appendChild(el('div', { class: 'alp-off' }, [
            UIx.badge('ERROR', 'down'),
            el('span', { text: e.message })
          ]));
          host.appendChild(el('p', { class: 'note small', text: 'Check that the proxy is deployed, that ALPACA_KEY and ALPACA_SECRET are set in its environment, and that the key is a paper key.' }));
        });
    }
    load();
    return p;
  }

  function orderTicket() {
    var A = global.PROVIDERS.alpaca;
    var o = { symbol: 'AAPL', qty: 1, side: 'buy', type: 'market', time_in_force: 'day', limit_price: null };
    var symIn = el('input', { value: o.symbol, spellcheck: 'false', oninput: function () { o.symbol = symIn.value.trim().toUpperCase(); } });
    var limWrap = el('div', { style: { display: 'none' } }, [
      UIx.field('Limit price', UIx.number(0, function (v) { o.limit_price = v; }))
    ]);
    var m = UIx.modal('Alpaca paper order', [
      el('p', { class: 'note', text: 'This sends a real order to your Alpaca PAPER account through your proxy. It does not touch a live brokerage account.' }),
      el('div', { class: 'bt-grid' }, [
        UIx.field('Symbol', symIn),
        UIx.field('Side', UIx.toggleRow([{ v: 'buy', n: 'Buy' }, { v: 'sell', n: 'Sell' }], o.side, function (v) { o.side = v; })),
        UIx.field('Quantity', UIx.number(o.qty, function (v) { o.qty = v; }, { min: 1, step: 1 })),
        UIx.field('Type', UIx.toggleRow([{ v: 'market', n: 'Market' }, { v: 'limit', n: 'Limit' }], o.type, function (v) {
          o.type = v; limWrap.style.display = v === 'limit' ? '' : 'none';
        })),
        UIx.field('Time in force', UIx.toggleRow([{ v: 'day', n: 'Day' }, { v: 'gtc', n: 'GTC' }], o.time_in_force, function (v) { o.time_in_force = v; }))
      ]),
      limWrap
    ], {
      footer: [
        el('button', { class: 'btn', text: 'Cancel', onclick: function () { m.close(); } }),
        el('button', { class: 'btn primary', text: 'Send paper order', onclick: function () {
          var payload = { symbol: o.symbol, qty: o.qty, side: o.side, type: o.type, time_in_force: o.time_in_force };
          if (o.type === 'limit') payload.limit_price = o.limit_price;
          A.submit(payload)
            .then(function (r) { UIx.toast('Order ' + r.id + ' accepted (' + r.status + ')', 'up', 6000); m.close(); global.APP.go('book'); })
            .catch(function (e) { UIx.toast(e.message, 'warn', 8000); });
        } })
      ]
    });
  }

  /* ---------- add / edit ---------- */
  function addForm(world, onDone) {
    var f = { t: 'NVDA', side: 'long', qty: 100, entry: 0, stop: 0, note: '' };
    var q0 = global.MARKET.quote(f.t, world);
    f.entry = q0 ? +q0.price.toFixed(2) : 0;
    f.stop = +(f.entry * 0.97).toFixed(2);

    var symIn = el('input', { value: f.t, spellcheck: 'false' });
    var qtyIn = UIx.number(f.qty, function (v) { f.qty = v; recalc(); }, { min: 0 });
    var entIn = UIx.number(f.entry, function (v) { f.entry = v; recalc(); });
    var stpIn = UIx.number(f.stop, function (v) { f.stop = v; recalc(); });
    var out = el('div', { class: 'size-out' });

    symIn.addEventListener('change', function () {
      f.t = symIn.value.trim().toUpperCase();
      var q = global.MARKET.quote(f.t, world);
      if (q) { f.entry = +q.price.toFixed(2); entIn.value = f.entry; f.stop = +(f.entry * 0.97).toFixed(2); stpIn.value = f.stop; }
      recalc();
    });

    function recalc() {
      L.clear(out);
      var s = L.state.settings.account;
      var plan = R.plan({ t: f.t, equity: s.equity, riskPct: s.riskPerTrade, entry: f.entry, stop: f.stop, rr: 2 });
      if (!plan) { out.appendChild(el('span', { class: 'warn', text: 'Entry and stop must differ' })); return; }
      out.appendChild(el('div', { class: 'grid4' }, [
        UIx.stat('Suggested qty', F.num(plan.size.qty, 2), { sub: 'at ' + s.riskPerTrade + '% risk' }),
        UIx.stat('Risking', F.usd(plan.size.riskAmt, 0), { tone: 'down' }),
        UIx.stat('Notional', F.usd(f.qty * f.entry, 0)),
        UIx.stat('Breakeven WR at 2R', F.pctRaw(plan.breakevenWinRate, 0))
      ]));
      out.appendChild(el('button', {
        class: 'mini', text: 'use suggested size',
        onclick: function () { f.qty = +plan.size.qty.toFixed(2); qtyIn.value = f.qty; recalc(); }
      }));
    }
    recalc();

    var m = UIx.modal('Add position', [
      el('div', { class: 'bt-grid' }, [
        UIx.field('Symbol', symIn),
        UIx.field('Side', UIx.toggleRow([{ v: 'long', n: 'Long' }, { v: 'short', n: 'Short' }], f.side, function (v) { f.side = v; recalc(); })),
        UIx.field('Quantity', qtyIn),
        UIx.field('Entry', entIn),
        UIx.field('Stop', stpIn)
      ]),
      out
    ], {
      footer: [
        el('button', { class: 'btn', text: 'Cancel', onclick: function () { m.close(); } }),
        el('button', {
          class: 'btn primary', text: 'Add to book', onclick: function () {
            if (!f.t || !f.qty || !f.entry) { UIx.toast('Symbol, quantity and entry are required', 'warn'); return; }
            book.positions.push({ id: L.uid('p'), t: f.t, side: f.side, qty: f.qty, entry: f.entry, stop: f.stop, opened: Date.now() });
            book.journal.push({ t: Date.now(), a: 'open', s: f.t, qty: f.qty, px: f.entry });
            save(); m.close(); onDone();
          }
        })
      ]
    });
  }

  function positionsPanel(pos, world, eq) {
    var totalPL = M.sum(pos.map(function (p) { return p.pl; }));
    var gross = M.sum(pos.map(function (p) { return Math.abs(p.notional); }));
    return UIx.panel('Paper book', {
      icon: '📒', class: 'p-book', count: pos.length,
      actions: [
        el('button', { class: 'btn', text: '+ position', onclick: function () { addForm(world, function () { render(world); }); } }),
        pos.length ? el('button', { class: 'mini', text: 'clear book', onclick: function () {
          if (!confirm('Remove all ' + pos.length + ' positions from the local paper book?')) return;
          book.positions = []; save(); render(world);
        } }) : null
      ]
    }, [
      el('div', { class: 'grid4' }, [
        UIx.stat('Equity setting', F.usd(eq, 0), { sub: 'Settings → Account' }),
        UIx.stat('Open P/L', F.usd(totalPL, 0), { tone: UIx.tone(totalPL) }),
        UIx.stat('Gross exposure', F.usd(gross, 0), { sub: F.pctRaw(gross / eq * 100, 0) + ' of equity' }),
        UIx.stat('Positions', String(pos.length))
      ]),
      pos.length ? UIx.table(
        [{ t: 'Sym' }, { t: 'Side' }, { t: 'Qty', align: 'r' }, { t: 'Entry', align: 'r' }, { t: 'Mark', align: 'r' },
         { t: 'P/L', align: 'r' }, { t: '%', align: 'r' }, { t: 'Stop', align: 'r' }, { t: 'Industry' }, { t: '', align: 'r' }],
        pos.map(function (p) {
          return {
            cells: [p.t,
              { node: UIx.badge(p.side.toUpperCase(), p.side === 'long' ? 'up' : 'down') },
              { t: F.num(p.qty, 2), align: 'r' },
              { t: F.num(p.entry, 2), align: 'r' },
              { t: F.num(p.price, 2), align: 'r' },
              { node: el('span', { class: p.pl >= 0 ? 'up' : 'down', text: F.usd(p.pl, 0) }), align: 'r' },
              { node: el('span', { class: p.plPct >= 0 ? 'up' : 'down', text: F.pct(p.plPct) }), align: 'r' },
              { t: p.stop ? F.num(p.stop, 2) : '—', align: 'r' },
              p.sectorName ? p.sectorName.split(' —')[0] : '—',
              { node: el('button', { class: 'mini', text: 'close', onclick: function (e) {
                e.stopPropagation();
                book.positions = book.positions.filter(function (x) { return x.id !== p.id; });
                book.journal.push({ t: Date.now(), a: 'close', s: p.t, qty: p.qty, px: p.price, pl: p.pl });
                save(); render(world);
              } }), align: 'r' }]
          };
        })) : UIx.empty('Book is empty', 'Add a position, or run "risk NVDA 178 172" in the command bar to size one first.')
    ]);
  }

  function exposurePanel(pos, eq) {
    var ex = R.portfolioExposure(pos);
    var secs = Object.keys(ex.bySector).map(function (k) {
      var ind = U.findIndustry(k);
      return { k: ind ? ind.n.split(' —')[0] : k, v: ex.bySector[k] / eq * 100, color: ind ? ind.color : null };
    }).sort(function (a, b) { return Math.abs(b.v) - Math.abs(a.v); });
    var ctys = Object.keys(ex.byCountry).map(function (k) {
      return { k: (U.COUNTRIES[k] || {}).n || k, v: ex.byCountry[k] / eq * 100 };
    }).sort(function (a, b) { return Math.abs(b.v) - Math.abs(a.v); });
    return UIx.panel('Exposure', { icon: '🧱', class: 'p-expo' }, [
      el('div', { class: 'grid3' }, [
        UIx.stat('Gross', F.pctRaw(ex.gross / eq * 100, 0)),
        UIx.stat('Net', F.pctRaw(ex.net / eq * 100, 0), { tone: UIx.tone(ex.net) }),
        UIx.stat('Sectors', String(secs.length))
      ]),
      el('h4', { class: 'sd-sub', text: 'By industry (% of equity)' }),
      UIx.canvasBox('', Math.max(50, secs.length * 20 + 8), function (cv) {
        global.CHART.hbars(cv, secs, { labelW: 118, fmt: function (v) { return v.toFixed(0) + '%'; } });
      }),
      ctys.length ? el('h4', { class: 'sd-sub', text: 'By country of domicile' }) : null,
      ctys.length ? UIx.canvasBox('', Math.max(50, ctys.length * 20 + 8), function (cv) {
        global.CHART.hbars(cv, ctys, { labelW: 118, fmt: function (v) { return v.toFixed(0) + '%'; } });
      }) : null
    ]);
  }

  function riskPanel(pos, eq) {
    var lim = { sectorPct: L.state.settings.account.maxSectorPct, namePct: 15, grossPct: 200 };
    var con = R.concentration(pos, eq, lim);
    var v1 = R.varEstimate(pos, eq, 0.95, 1);
    var v5 = R.varEstimate(pos, eq, 0.95, 5);
    return UIx.panel('Risk', { icon: '🛡', class: 'p-risk' }, [
      el('div', { class: 'grid4' }, [
        UIx.stat('1-day VaR 95%', F.usd(v1.var, 0), { tone: 'down', sub: F.pctRaw(v1.pct, 1) + ' of equity' }),
        UIx.stat('5-day VaR 95%', F.usd(v5.var, 0), { tone: 'down', sub: F.pctRaw(v5.pct, 1) }),
        UIx.stat('Gross', F.pctRaw(con.grossPct, 0)),
        UIx.stat('Net', F.pctRaw(con.netPct, 0))
      ]),
      con.warnings.length
        ? el('ul', { class: 'warns' }, con.warnings.map(function (w) {
            return el('li', { class: 'w-' + w.level }, [UIx.badge(w.k, w.level === 'high' ? 'down' : 'warn'), ' ', w.msg]);
          }))
        : el('p', { class: 'ok-note', text: 'No concentration limits breached at the current settings.' }),
      el('p', { class: 'note small', text: 'VaR is parametric: each position\'s own volatility, combined under a flat ' + Math.round(v1.rho * 100) + '% correlation assumption. It understates the tail — in a real shock correlations go to one, which is exactly what the scenario panel below is for.' })
    ]);
  }

  function scenarioPanel(pos, eq, world) {
    var host = el('div', {});
    var sel = { seed: (global.APP.scenario && global.APP.scenario.run) ? global.APP.scenario.run.seed : 'me_conflict', sev: 0.7 };
    function draw() {
      L.clear(host);
      var run = C.propagate(sel.seed, sel.sev);
      var ex = C.expressions(run);
      var pl = R.scenarioPL(pos, ex, eq);
      var hedge = R.hedges(ex, pos, eq);
      host.appendChild(el('div', { class: 'grid3' }, [
        UIx.stat('Modelled book impact', F.usd(pl.total, 0), { tone: UIx.tone(pl.total) }),
        UIx.stat('As % of equity', F.pct(pl.pctOfEquity), { tone: UIx.tone(pl.pctOfEquity) }),
        UIx.stat('Worst position', pl.rows[0] ? pl.rows[0].t + ' ' + F.usd(pl.rows[0].pl, 0) : '—', { tone: 'down' })
      ]));
      host.appendChild(UIx.table([{ t: 'Sym' }, { t: 'Industry' }, { t: 'Implied move', align: 'r' }, { t: 'P/L', align: 'r' }],
        pl.rows.map(function (r) {
          return [r.t, r.sectorName.split(' —')[0],
            { node: el('span', { class: r.movePct >= 0 ? 'up' : 'down', text: F.pct(r.movePct, 1) }), align: 'r' },
            { node: el('span', { class: r.pl >= 0 ? 'up' : 'down', text: F.usd(r.pl, 0) }), align: 'r' }];
        })));
      if (hedge.length) {
        host.appendChild(el('h4', { class: 'sd-sub', text: 'What that suggests' }));
        host.appendChild(el('ul', { class: 'hedges' }, hedge.map(function (h) {
          return el('li', { class: 'h-' + h.kind }, [
            UIx.badge(h.kind, h.kind === 'add' ? 'up' : h.kind === 'reduce' ? 'down' : 'n'),
            el('b', { text: ' ' + h.sectorName.split(' —')[0] + ': ' }),
            el('span', { text: h.why + ' ' + h.how })
          ]);
        })));
      }
    }
    var p = UIx.panel('Scenario impact on the book', {
      icon: '⚡', class: 'p-scen',
      actions: [
        UIx.select(C.seeds().map(function (n) { return { v: n.id, n: n.n }; }), sel.seed, function (v) { sel.seed = v; draw(); }),
        UIx.slider(sel.sev, 0.1, 1, 0.05, function (v) { sel.sev = v; draw(); }, function (v) { return Math.round(v * 100) + '%'; })
      ]
    }, [host]);
    draw();
    return p;
  }

  function matrixPanel(pos, eq, world) {
    var runs = C.seeds().map(function (n) {
      return { p: baseRate(n.id, world), run: C.propagate(n.id, 0.7) };
    });
    var mx = R.matrix(runs, pos, eq);
    return UIx.panel('Probability × impact', { icon: '🎲', class: 'p-matrix' }, [
      el('p', { class: 'note', text: 'Likelihood on the horizontal axis comes from how much the current wire is already talking about each scenario; impact is the modelled effect on your book (or on sector scores when the book is empty). Top-right is what deserves a plan.' }),
      UIx.canvasBox('', 260, function (cv) {
        global.CHART.scatter(cv, mx.map(function (m) {
          return { x: m.p, y: m.impact, label: m.short || m.name, size: 0.3, color: m.impactPct < 0 ? global.CHART.theme().down : global.CHART.theme().up };
        }), { maxX: 1 });
      }),
      UIx.table([{ t: 'Scenario' }, { t: 'Wire pressure', align: 'r' }, { t: 'Book impact', align: 'r' }, { t: 'Thrives' }, { t: 'Suffers' }, { t: '', align: 'r' }],
        mx.map(function (m) {
          return {
            cells: [m.name,
              { node: UIx.bar(m.p * 100, m.p > 0.6 ? 'down' : 'n'), align: 'r' },
              { node: el('span', { class: (m.impactPct || 0) >= 0 ? 'up' : 'down', text: m.impactPct === null ? '—' : F.pct(m.impactPct) }), align: 'r' },
              m.winners.join(', '), m.losers.join(', '),
              { node: el('button', { class: 'mini', text: 'open', onclick: function () { global.APP.go('cascade', { seed: m.id, sev: 0.7 }); } }), align: 'r' }]
          };
        }))
    ]);
  }

  /* how loudly is the wire already carrying this scenario? */
  function baseRate(seedId, world) {
    var cutoff = Date.now() - 14 * 86400e3;
    var hits = 0, tot = 0;
    world.stories.forEach(function (s) {
      if (s.t < cutoff) return;
      tot++;
      var seeds = C.seedsForStory(s);
      seeds.forEach(function (sd) { if (sd.id === seedId) hits += sd.w * (s.imp / 5); });
    });
    return M.clamp(hits / Math.max(1, tot) * 6, 0.02, 0.95);
  }

  UIx.register('book', { mount: mount });
})(window);
