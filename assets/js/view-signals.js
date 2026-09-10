/* Lumen Terminal — Signals: behaviour, exhaustion, positioning, event studies and alerts. */
(function (global) {
  'use strict';
  var L = global.Lumen, U = global.UNIVERSE, MI = global.MICRO, A = global.ALERTS,
      UIx = global.UI, el = L.el, F = L.F, M = L.M;

  var st = { sym: 'CL=F', tf: '1d', days: 400, eventClass: 'oilspike', tab: 'read' };
  var bodyEl = null, cache = null;

  function mount(world, params) {
    if (params.sym) st.sym = params.sym;
    if (params.tab) st.tab = params.tab;
    var root = el('div', { class: 'sig' });
    root.appendChild(controls(world));
    bodyEl = el('div', { id: 'sig-body' });
    root.appendChild(bodyEl);
    recompute(world);
    return root;
  }

  function recompute(world) {
    var bars = global.MARKET.bars(st.sym, st.tf, st.days, world);
    cache = {
      bars: bars,
      assess: MI.assess(st.sym, bars, world),
      study: MI.eventStudy(bars, world, st.eventClass)
    };
    render(world);
  }

  function controls(world) {
    var symIn = el('input', { class: 'sym-in', value: st.sym, spellcheck: 'false' });
    symIn.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { st.sym = symIn.value.trim().toUpperCase(); recompute(world); }
    });
    return UIx.panel('Behaviour scan', { icon: '🔍', class: 'p-sigset' }, [
      el('div', { class: 'sig-ctl' }, [
        UIx.field('Symbol', symIn),
        UIx.field('Timeframe', UIx.toggleRow(['15m', '1h', '4h', '1d'], st.tf, function (v) { st.tf = v; recompute(world); })),
        UIx.field('History', UIx.toggleRow([
          { v: 120, n: '4m' }, { v: 250, n: '8m' }, { v: 400, n: '13m' }, { v: 730, n: '2y' }
        ], st.days, function (v) { st.days = +v; recompute(world); })),
        UIx.field('View', UIx.toggleRow([
          { v: 'read', n: 'Read' }, { v: 'anomalies', n: 'Anomalies' },
          { v: 'events', n: 'Event studies' }, { v: 'alerts', n: 'Alerts' }
        ], st.tab, function (v) { st.tab = v; render(world); }))
      ]),
      el('div', { class: 'presets' }, ['CL=F', 'NVDA', 'SPY', 'GC=F', 'BTC', 'XOM', 'TSLA', 'BKW.AX'].map(function (t) {
        return el('button', { class: 'chip' + (t === st.sym ? ' on' : ''), text: t, onclick: function () { st.sym = t; symIn.value = t; recompute(world); } });
      }))
    ]);
  }

  function render(world) {
    if (!bodyEl) return;
    L.clear(bodyEl);
    bodyEl.appendChild(caveat());
    if (st.tab === 'read') renderRead(world);
    else if (st.tab === 'anomalies') renderAnomalies(world);
    else if (st.tab === 'events') renderEvents(world);
    else renderAlerts(world);
  }

  function caveat() {
    return el('div', { class: 'bt-banner tone-sim' }, [
      UIx.badge('READ THIS', 'sim'),
      el('span', {}, [
        'These are patterns in price and volume. Bars carry no order book, no cancellations and no counterparty identity, so nothing here can establish that manipulation occurred — only that the shape is consistent with it, and most of these shapes also occur for ordinary reasons. Base rates come from overlapping windows on a single price path, so sample sizes overstate confidence. Every number below shows its n for that reason.'
      ])
    ]);
  }

  /* ---------- read ---------- */
  function renderRead(world) {
    var a = cache.assess, e = a.exhaustion, c = a.crowding;
    if (!e) { bodyEl.appendChild(UIx.empty('Not enough history for ' + st.sym)); return; }
    var q = global.MARKET.quote(st.sym, world);

    bodyEl.appendChild(UIx.panel('Where this is in its own history', { icon: '📍', class: 'p-exh' }, [
      el('div', { class: 'exh-head' }, [
        el('div', { class: 'exh-gauge t-' + a.level }, [
          el('b', { text: (a.risk * 100).toFixed(0) }),
          el('span', { text: 'late-stage risk' })
        ]),
        el('div', { class: 'exh-t' }, [
          el('h3', {}, [st.sym + ' ', el('i', { class: 'exh-px', text: F.num(e.price, 2) })]),
          el('div', {}, [
            UIx.badge((e.rank * 100).toFixed(0) + 'th percentile', e.rank > 0.85 ? 'warn' : 'n'),
            UIx.badge(c ? c.label : '—', c && Math.abs(c.score) > 0.5 ? 'warn' : 'n'),
            e.virgin ? UIx.badge('no precedent above', 'down') : null,
            e.extendedBars >= 3 ? UIx.badge('extended ' + e.extendedBars + ' bars', 'warn') : null
          ])
        ])
      ]),
      el('div', { class: 'range-bar' }, [
        el('div', { class: 'rb-track' }, [
          el('i', { class: 'rb-fill', style: { width: (e.rank * 100) + '%' } }),
          el('u', { class: 'rb-mark', style: { left: (e.rank * 100) + '%' } }),
          /* the live price rides the marker so the label always points at where price actually is */
          el('b', { class: 'rb-now', style: { left: M.clamp(e.rank * 100, 5, 95) + '%' }, text: F.num(e.price, 2) })
        ]),
        el('div', { class: 'rb-lbl' }, [
          el('span', { text: F.num(e.low, 2) + '  low' }),
          el('span', { text: 'high  ' + F.num(e.high, 2) })
        ])
      ]),
      el('ul', { class: 'vd-read' }, e.read.map(function (line) { return el('li', { text: line }); })),
      c ? el('p', { class: 'note', text: c.read }) : null
    ]));

    /* forward base rates */
    bodyEl.appendChild(UIx.panel('What has happened from levels like this', { icon: '📊', class: 'p-fwd' }, [
      UIx.table(
        [{ t: 'Horizon' }, { t: 'n', align: 'r' }, { t: 'Went up', align: 'r' }, { t: 'Base rate', align: 'r' },
         { t: 'Edge', align: 'r' }, { t: 'Median', align: 'r' }, { t: 'Up when right', align: 'r' }, { t: 'Down when wrong', align: 'r' }, { t: 'Payoff', align: 'r' }],
        e.horizons.map(function (h) {
          return [
            '+' + h.h + ' bars',
            { t: String(h.n), align: 'r', class: h.n < 15 ? 'thin' : '' },
            { node: el('span', { class: h.pUp > 0.5 ? 'up' : 'down', text: h.pUp === null ? '—' : (h.pUp * 100).toFixed(0) + '%' }), align: 'r' },
            { t: (h.baseUp * 100).toFixed(0) + '%', align: 'r' },
            { node: el('span', { class: (h.edge || 0) > 0 ? 'up' : 'down', text: h.edge === null ? '—' : ((h.edge > 0 ? '+' : '') + (h.edge * 100).toFixed(0) + 'pts') }), align: 'r' },
            { node: el('span', { class: h.median >= 0 ? 'up' : 'down', text: F.pct(h.median * 100, 2) }), align: 'r' },
            { t: F.pct(h.medUp * 100, 1), align: 'r' },
            { t: F.pct(h.medDn * 100, 1), align: 'r' },
            { t: h.payoff === null ? '—' : h.payoff.toFixed(2) + '×', align: 'r' }
          ];
        })),
      el('p', { class: 'note small', text: 'Rows with a small n are greyed. "Edge" is the conditional hit rate minus the unconditional one — if it is near zero, being at this level tells you nothing that being in this instrument does not already tell you. Payoff is median gain when right divided by median loss when wrong; a high hit rate with a payoff below 1 is still a losing setup.' })
    ]));

    /* chart with anomalies marked */
    var marks = a.anomalies.map(function (ev) { return { i: ev.i, kind: ev.kind, dir: ev.dir, sev: ev.severity }; });
    bodyEl.appendChild(UIx.panel(st.sym + ' with flagged bars', { icon: '📈', class: 'p-sigchart', bodyClass: 'nopad' }, [
      UIx.canvasBox('big', 320, function (cv) {
        global.CHART.candles(cv, cache.bars, { window: 200, marks: marks });
      })
    ]));
  }

  /* ---------- anomalies ---------- */
  function renderAnomalies(world) {
    var a = cache.assess;
    var counts = {};
    a.anomalies.forEach(function (e) { counts[e.kind] = (counts[e.kind] || 0) + 1; });

    bodyEl.appendChild(UIx.panel('Detectors', { icon: '🧬', class: 'p-det' }, [
      el('div', { class: 'det-grid' }, Object.keys(MI.DETECTORS).map(function (k) {
        var d = MI.DETECTORS[k];
        return el('div', { class: 'det' + (counts[k] ? ' hit' : '') }, [
          el('div', { class: 'det-h' }, [
            el('span', { class: 'det-i', text: d.icon }),
            el('b', { text: d.n }),
            el('span', { class: 'det-n', text: counts[k] ? counts[k] + ' flagged' : 'none' })
          ]),
          el('p', { text: d.d })
        ]);
      })),
      a.pin ? el('div', { class: 'pin-note' }, [
        el('b', { text: a.pin.icon + ' ' + a.pin.n + ': ' }), el('span', { text: a.pin.note })
      ]) : null
    ]));

    bodyEl.appendChild(UIx.panel('Flagged bars', { icon: '🚩', class: 'p-flags', count: a.anomalies.length }, [
      a.anomalies.length
        ? UIx.table([{ t: 'When' }, { t: 'Pattern' }, { t: 'Bias' }, { t: 'Severity', align: 'r' }, { t: 'Price', align: 'r' }, { t: 'What the bar did' }],
            a.anomalies.slice(0, 60).map(function (ev) {
              return {
                _class: ev.severity > 0.6 ? 'loss' : '',
                cells: [
                  new Date(ev.t).toISOString().slice(0, 16).replace('T', ' '),
                  { node: el('span', {}, [ev.icon + ' ' + ev.n]) },
                  { node: ev.dir === 0 ? el('span', { text: 'neutral' })
                      : UIx.badge(ev.dir > 0 ? 'upward' : 'downward', ev.dir > 0 ? 'up' : 'down') },
                  { node: UIx.bar(ev.severity * 100, ev.severity > 0.6 ? 'down' : 'warn'), align: 'r' },
                  { t: F.num(ev.price, 2), align: 'r' },
                  ev.note
                ]
              };
            }))
        : UIx.empty('Nothing flagged in this window', 'That is a normal result — these patterns are supposed to be rare.')
    ]));
  }

  /* ---------- event studies ---------- */
  function renderEvents(world) {
    var s = cache.study;
    var picker = el('div', { class: 'presets' }, Object.keys(MI.EVENT_CLASSES).map(function (k) {
      return el('button', {
        class: 'chip' + (k === st.eventClass ? ' on' : ''), text: MI.EVENT_CLASSES[k].n,
        onclick: function () { st.eventClass = k; recompute(world); }
      });
    }));

    bodyEl.appendChild(UIx.panel('After this kind of event, what did ' + st.sym + ' do?', { icon: '⏱', class: 'p-study' }, [
      picker,
      !s || !s.events
        ? UIx.empty('No events of this class in the window')
        : el('div', {}, [
            el('div', { class: 'grid4' }, [
              UIx.stat('Events found', String(s.events)),
              UIx.stat('Class', s.name),
              UIx.stat('Window', st.days + ' days'),
              UIx.stat('Instrument', st.sym)
            ]),
            UIx.table([{ t: 'Horizon' }, { t: 'n', align: 'r' }, { t: 'Positive', align: 'r' }, { t: 'Base rate', align: 'r' },
                       { t: 'Edge', align: 'r' }, { t: 'Median', align: 'r' }, { t: 'Mean', align: 'r' }, { t: 't-stat', align: 'r' },
                       { t: 'Best', align: 'r' }, { t: 'Worst', align: 'r' }],
              s.rows.map(function (r) {
                return [
                  '+' + r.h + ' bars',
                  { t: String(r.n), align: 'r', class: r.n < 10 ? 'thin' : '' },
                  { node: el('span', { class: r.pUp > 0.5 ? 'up' : 'down', text: r.pUp === null ? '—' : (r.pUp * 100).toFixed(0) + '%' }), align: 'r' },
                  { t: (r.baseUp * 100).toFixed(0) + '%', align: 'r' },
                  { node: el('span', { class: (r.edge || 0) > 0 ? 'up' : 'down', text: ((r.edge || 0) > 0 ? '+' : '') + ((r.edge || 0) * 100).toFixed(0) + 'pts' }), align: 'r' },
                  { node: el('span', { class: r.median >= 0 ? 'up' : 'down', text: F.pct(r.median * 100, 2) }), align: 'r' },
                  { t: F.pct(r.mean * 100, 2), align: 'r' },
                  { node: el('span', { class: Math.abs(r.t) > 1.8 ? 'warn' : '', text: r.t.toFixed(2) }), align: 'r' },
                  { t: F.pct(r.best * 100, 1), align: 'r' },
                  { t: F.pct(r.worst * 100, 1), align: 'r' }
                ];
              })),
            el('ul', { class: 'vd-read' }, (s.read || []).map(function (l) { return el('li', { text: l }); })),
            el('p', { class: 'note small', text: 'This is the honest version of "people will buy after X". It measures what the instrument actually did after every event of that class in the window, and puts the unconditional rate beside it so a 55% hit rate cannot masquerade as an edge when the instrument rises 54% of the time anyway. The t-statistic assumes independent observations, which overlapping forward windows are not — so treat anything under about 2.5 as noise, not signal.' })
          ])
    ]));
  }

  /* ---------- alerts ---------- */
  function renderAlerts(world) {
    var log = A.history();

    var addRow = el('div', { class: 'presets' }, Object.keys(A.KINDS).map(function (k) {
      return el('button', {
        class: 'chip', text: '+ ' + A.KINDS[k].n,
        onclick: function () { A.add(k); render(world); }
      });
    }));

    bodyEl.appendChild(UIx.panel('Alert rules', {
      icon: '🔔', class: 'p-rules', count: A.all().length,
      actions: [
        el('button', { class: 'mini', text: A.canNotify() ? 'browser alerts on' : 'enable browser alerts', onclick: function () {
          A.setNotify(true).then(function (ok) {
            UIx.toast(ok ? 'Browser notifications enabled' : 'Permission denied — in-app alerts still work', ok ? 'up' : 'warn');
            render(world);
          });
        } }),
        el('button', { class: 'btn', text: 'Run checks now', onclick: function () {
          var fired = A.evaluate(world);
          UIx.toast(fired.length ? fired.length + ' alert(s) fired' : 'Checked every rule — nothing triggered', fired.length ? 'warn' : 'n');
          render(world);
        } })
      ]
    }, [
      el('p', { class: 'note', text: 'Rules run whenever the world refreshes and every few minutes while this tab is open. There is no server behind this, so nothing fires while the tab is closed — if you need alerts overnight, the check has to run somewhere that stays up.' }),
      addRow,
      el('div', { class: 'rules' }, A.all().map(function (r) { return ruleRow(r, world); }))
    ]));

    bodyEl.appendChild(UIx.panel('Alert history', {
      icon: '📜', class: 'p-alog', count: log.length,
      actions: log.length ? [el('button', { class: 'mini', text: 'clear', onclick: function () { A.clearLog(); render(world); } })] : []
    }, [
      log.length
        ? el('div', { class: 'alog' }, log.slice(0, 40).map(function (e) {
            return el('div', { class: 'al t-' + e.tone, onclick: function () {
              if (!e.action) return;
              if (e.action.view === 'signals' && e.action.sym) { st.sym = e.action.sym; recompute(world); }
              else if (e.action.view === 'mainstreet') global.APP.go('mainstreet', e.action);
              else global.APP.go(e.action.view || 'desk');
            } }, [
              el('div', { class: 'al-h' }, [
                el('b', { text: e.title }),
                el('span', { text: F.ago(e.t) + ' ago' })
              ]),
              el('p', { text: e.body })
            ]);
          }))
        : UIx.empty('No alerts yet', 'Hit "Run checks now" to evaluate every rule against the current world.')
    ]));
  }

  function ruleRow(r, world) {
    var spec = A.KINDS[r.kind];
    var wrap = el('div', { class: 'rule' + (r.enabled ? '' : ' off') });
    wrap.appendChild(el('div', { class: 'rule-h' }, [
      el('span', { class: 'det-i', text: spec.icon }),
      el('b', { text: spec.n }),
      el('label', { class: 'sw-t' }, [
        el('input', { type: 'checkbox', checked: r.enabled ? 'checked' : null, onchange: function (e) {
          A.update(r.id, { enabled: e.target.checked }); wrap.classList.toggle('off', !e.target.checked);
        } }),
        el('span', { text: 'on' })
      ]),
      el('button', { class: 'mini', text: 'remove', onclick: function () { A.remove(r.id); render(world); } })
    ]));
    var fields = el('div', { class: 'rule-f' });
    spec.fields.forEach(function (f) {
      var ctl;
      if (f.type === 'num') {
        ctl = UIx.number(r[f.k], function (v) { A.update(r.id, (function () { var o = {}; o[f.k] = v; return o; })()); }, { min: f.min, max: f.max, step: f.step });
      } else if (f.type === 'pick') {
        ctl = UIx.select(f.opts, r[f.k], function (v) { var o = {}; o[f.k] = v; A.update(r.id, o); });
      } else if (f.type === 'country') {
        ctl = UIx.select(Object.keys(U.COUNTRIES).map(function (c) { return { v: c, n: U.COUNTRIES[c].n }; }), r[f.k], function (v) { A.update(r.id, { country: v }); });
      } else {
        var i = el('input', { value: r[f.k] || '', spellcheck: 'false', onchange: function () { A.update(r.id, (function () { var o = {}; o[f.k] = i.value.trim().toUpperCase(); return o; })()); } });
        ctl = i;
      }
      fields.appendChild(UIx.field(f.n, ctl));
    });
    fields.appendChild(UIx.field('Cooldown (h)', UIx.number(r.cooldownH || 12, function (v) { A.update(r.id, { cooldownH: v }); }, { min: 1, max: 168, step: 1 })));
    wrap.appendChild(fields);
    wrap.appendChild(el('p', { class: 'note small', text: spec.d }));
    if (r.lastFired) wrap.appendChild(el('div', { class: 'rule-last', text: 'last fired ' + F.ago(r.lastFired) + ' ago' }));
    return wrap;
  }

  UIx.register('signals', { mount: mount });
})(window);
