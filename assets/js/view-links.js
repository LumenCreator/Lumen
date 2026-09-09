/* Lumen Terminal — Link Analysis. */
(function (global) {
  'use strict';
  var L = global.Lumen, U = global.UNIVERSE, UIx = global.UI, el = L.el, F = L.F, M = L.M;

  var st = { a: 'TSLA', b: 'CL=F', days: 90, mode: 'link', scanQ: 'hormuz' };
  var bodyEl = null;

  function mount(world, params) {
    if (params.a) { st.a = params.a; st.mode = 'link'; }
    if (params.b) st.b = params.b;
    if (params.scan) { st.scanQ = params.scan; st.mode = 'scan'; }
    var root = el('div', { class: 'links' });
    root.appendChild(controls(world));
    bodyEl = el('div', { class: 'links-body', id: 'links-body' });
    root.appendChild(bodyEl);
    run(world);
    return root;
  }

  function controls(world) {
    var ia = el('input', { class: 'ent-in', value: st.a, spellcheck: 'false', placeholder: 'TSLA, Iran, semis, hormuz…' });
    var ib = el('input', { class: 'ent-in', value: st.b, spellcheck: 'false', placeholder: 'crude oil, US10Y, defense…' });
    function go() { st.a = ia.value; st.b = ib.value; st.mode = 'link'; run(world); }
    ia.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
    ib.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });

    var scanIn = el('input', { class: 'ent-in', value: st.scanQ, spellcheck: 'false', placeholder: 'entity to expand' });
    scanIn.addEventListener('keydown', function (e) { if (e.key === 'Enter') { st.scanQ = scanIn.value; st.mode = 'scan'; run(world); } });

    var presets = [
      ['TSLA', 'CL=F'], ['NVDA', 'Taiwan'], ['XOM', 'Iran'], ['LMT', 'russia_escalation'],
      ['BTC', 'US10Y'], ['DAL', 'crude'], ['BHP', 'China'], ['NTR', 'wheat']
    ];

    return UIx.panel('Link two things', { icon: '🔗', class: 'p-linkset' }, [
      el('div', { class: 'link-row' }, [
        UIx.field('A', ia), el('span', { class: 'link-to', text: '↔' }), UIx.field('B', ib),
        UIx.field('Window', UIx.toggleRow([{ v: 30, n: '30d' }, { v: 60, n: '60d' }, { v: 90, n: '90d' }, { v: 180, n: '180d' }], st.days,
          function (v) { st.days = +v; run(world); })),
        el('button', { class: 'btn primary', text: 'Analyse', onclick: go })
      ]),
      el('div', { class: 'presets' }, presets.map(function (p) {
        return el('button', { class: 'chip', text: p[0] + ' ↔ ' + p[1], onclick: function () { ia.value = p[0]; ib.value = p[1]; go(); } });
      })),
      el('div', { class: 'link-row scan-row' }, [
        UIx.field('Expand one entity', scanIn, 'Ranks everything in the graph by how tightly it is wired to this.'),
        el('button', { class: 'btn', text: 'Scan', onclick: function () { st.scanQ = scanIn.value; st.mode = 'scan'; run(world); } })
      ])
    ]);
  }

  function run(world) {
    var host = bodyEl;
    if (!host) return;
    L.clear(host);
    if (st.mode === 'scan') { host.appendChild(scanView(world)); return; }
    var r = global.LINKER.analyse(st.a, st.b, { world: world, days: st.days });
    if (r.error) { host.appendChild(UIx.empty('Could not run that', r.error)); return; }
    host.appendChild(verdictPanel(r));
    host.appendChild(el('div', { class: 'links-cols' }, [pathsPanel(r), statsPanel(r)]));
    host.appendChild(narrativePanel(r, world));
  }

  function verdictPanel(r) {
    var tone = r.strength >= 62 ? 'up' : r.strength >= 38 ? 'warn' : 'n';
    return UIx.panel('Verdict', { icon: '⚖', class: 'p-verdict' }, [
      el('div', { class: 'vd-head' }, [
        el('div', { class: 'vd-score t-' + tone }, [
          el('b', { text: String(r.strength) }),
          el('span', { text: '/100' })
        ]),
        el('div', { class: 'vd-t' }, [
          el('h3', { text: r.a.n + '  ↔  ' + r.b.n }),
          el('div', {}, [
            UIx.badge(r.verdict, tone),
            UIx.badge(r.direction + ' correlation', r.direction === 'inverse' ? 'down' : 'up'),
            UIx.badge(r.agreement + '/3 channels agree', r.agreement >= 2 ? 'up' : 'n')
          ])
        ])
      ]),
      el('div', { class: 'vd-bars' }, [
        chanBar('Mechanism', r.scores.mechanism, 'A causal route through supply chains, geography or policy.'),
        chanBar('Statistics', r.scores.statistical, 'Realised correlation of daily returns over the window.'),
        chanBar('Narrative', r.scores.narrative, 'How often the wire treats them as one story.')
      ]),
      el('ul', { class: 'vd-read' }, r.read.map(function (line) { return el('li', { text: line }); })),
      el('p', { class: 'note small', text: 'One channel on its own is thin. Mechanism without correlation means the link is dormant; correlation without mechanism is usually shared market beta and will break when the regime changes.' })
    ]);
  }

  function chanBar(name, v, hint) {
    return el('div', { class: 'chan', title: hint }, [
      el('span', { class: 'chan-n', text: name }),
      UIx.bar(v * 100, v > 0.55 ? 'up' : v > 0.3 ? 'warn' : 'n'),
      el('b', { text: Math.round(v * 100) + '' })
    ]);
  }

  function pathsPanel(r) {
    if (!r.paths.length) return UIx.panel('Mechanism', { icon: '🧩' }, [UIx.empty('No route found within 5 hops')]);
    return UIx.panel('Mechanism — how A reaches B', { icon: '🧩', class: 'p-paths', count: r.paths.length }, [
      el('div', { class: 'paths' }, r.paths.map(function (p, i) {
        return el('div', { class: 'path' + (i === 0 ? ' best' : '') }, [
          el('div', { class: 'path-h' }, [
            UIx.badge(p.hops + ' hop' + (p.hops === 1 ? '' : 's'), i === 0 ? 'up' : 'n'),
            el('span', { class: 'path-w', text: 'strength ' + p.w.toFixed(3) })
          ]),
          el('div', { class: 'path-n' }, p.nodes.map(function (n, j) {
            return el('span', { class: 'pn t-' + n.type }, [
              el('b', { text: n.n }),
              j < p.nodes.length - 1 ? el('u', { text: '→' }) : null
            ]);
          })),
          el('ol', { class: 'path-why' }, p.edges.map(function (e) {
            return el('li', {}, [el('i', { class: 'ek', text: e.kind }), ' ', e.why]);
          }))
        ]);
      }))
    ]);
  }

  function statsPanel(r) {
    if (!r.stats) {
      return UIx.panel('Statistics', { icon: '📈' }, [UIx.empty('No price proxy for one side', 'Countries and events are proxied by their listed leaders or export basket; some have neither.')]);
    }
    var s = r.stats;
    return UIx.panel('Statistics — ' + r.days + ' day window', { icon: '📈', class: 'p-lstats' }, [
      el('div', { class: 'grid4' }, [
        UIx.stat('Correlation', s.corr.toFixed(3), { tone: UIx.tone(s.corr) }),
        UIx.stat('Beta (A on B)', s.beta.toFixed(3)),
        UIx.stat('Range', s.min.toFixed(2) + ' … ' + s.max.toFixed(2), { sub: s.stable ? 'stable' : 'regime-dependent', tone: s.stable ? 'up' : 'warn' }),
        UIx.stat('Observations', String(s.n), { sub: s.window + '-day rolling' })
      ]),
      el('h4', { class: 'sd-sub', text: 'Rolling correlation' }),
      UIx.canvasBox('', 150, function (cv) {
        global.CHART.line(cv, s.rolling.map(function (x) { return x.c; }), { zero: 0, min: -1, max: 1, color: global.CHART.theme().accent });
      }),
      el('h4', { class: 'sd-sub', text: 'Lead / lag (correlation at each offset, days)' }),
      UIx.canvasBox('', s.lags.length * 16 + 10, function (cv) {
        global.CHART.hbars(cv, s.lags.map(function (x) {
          return { k: (x.lag > 0 ? '+' : '') + x.lag + 'd', v: x.c };
        }), { labelW: 44, rowH: 15, fmt: function (v) { return v.toFixed(2); } });
      }),
      el('p', { class: 'note small', text: 'Negative offsets mean A\'s move lines up best with B\'s move that many days later — i.e. A leads. With this few observations a small edge in the lag profile is noise; treat anything under about 0.2 as nothing.' })
    ]);
  }

  function narrativePanel(r, world) {
    var n = r.narrative;
    var body = [
      el('div', { class: 'grid3' }, [
        UIx.stat('Stories touching both', String(n.count)),
        UIx.stat('Co-occurrence lift', n.lift ? n.lift.toFixed(2) + '×' : '—', { tone: n.lift > 1.6 ? 'up' : 'n', sub: 'vs independence' }),
        UIx.stat('Deal / trade / policy', String(n.deals.length), { tone: n.deals.length ? 'warn' : 'n' })
      ])
    ];
    if (n.deals.length) {
      body.push(el('h4', { class: 'sd-sub', text: 'Deals, trades and policy items connecting them' }));
      body.push(el('div', { class: 'wire compact' }, n.deals.slice(0, 6).map(function (x) { return storyMini(x.s, world); })));
    }
    if (n.coStories.length) {
      body.push(el('h4', { class: 'sd-sub', text: 'Everything else in the window' }));
      body.push(el('div', { class: 'wire compact' }, n.coStories.slice(0, 10).map(function (x) { return storyMini(x.s, world); })));
    } else {
      body.push(UIx.empty('No story in the window mentions both'));
    }
    return UIx.panel('Narrative — are they being reported together?', { icon: '📰', class: 'p-narr' }, body);
  }

  function storyMini(s, world) {
    return el('article', { class: 'st k-' + s.k }, [
      el('div', { class: 'st-top' }, [
        UIx.impactDots(s.imp),
        el('span', { class: 'st-k', text: s.k }),
        el('span', { class: 'st-src', text: s.src }),
        UIx.simBadge(s),
        el('span', { class: 'st-ago', text: F.ago(s.t) })
      ]),
      el('h4', { class: 'st-h', text: s.h }),
      el('div', { class: 'st-tags' }, (s.countries || []).slice(0, 3).map(function (c) {
        return UIx.countryChip(c, function (iso) { global.APP.go('desk', { focus: iso }); });
      }))
    ]);
  }

  /* ---------- scan ---------- */
  function scanView(world) {
    var r = global.LINKER.scan(st.scanQ);
    if (r.error) return UIx.empty('Could not scan that', r.error);
    var byType = {};
    r.ranked.forEach(function (x) {
      if (!x.node) return;
      (byType[x.node.type] || (byType[x.node.type] = [])).push(x);
    });
    var TYPES = { ticker: 'Instruments', sector: 'Industries', country: 'Countries', factor: 'Macro factors', choke: 'Chokepoints', event: 'Events & mechanisms', macro: 'Macro instruments' };
    var wrap = el('div', {});
    wrap.appendChild(UIx.panel('Everything wired to ' + r.a.n, { icon: '🛰', class: 'p-scan' }, [
      el('p', { class: 'note', text: 'Weighted spread through the structural graph, three hops out. Higher is a tighter link.' }),
      el('div', { class: 'scan-cols' }, Object.keys(byType).map(function (t) {
        return el('div', { class: 'scan-col' }, [
          el('h4', { text: TYPES[t] || t }),
          UIx.canvasBox('', Math.min(300, byType[t].slice(0, 12).length * 19 + 8), function (cv) {
            global.CHART.hbars(cv, byType[t].slice(0, 12).map(function (x) { return { k: x.node.n, v: x.w }; }),
              { labelW: 118, rowH: 18, fmt: function (v) { return v.toFixed(2); } });
          }),
          el('div', { class: 'sd-tags' }, byType[t].slice(0, 6).map(function (x) {
            return el('button', {
              class: 'chip', text: x.node.n.length > 22 ? x.node.n.slice(0, 21) + '…' : x.node.n,
              onclick: function () { st.b = x.node.n; st.mode = 'link'; st.a = r.a.n; run(world); }
            });
          }))
        ]);
      }))
    ]));
    return wrap;
  }

  UIx.register('links', { mount: mount });
})(window);
