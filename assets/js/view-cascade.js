/* Lumen Terminal — Cascade: propagate a shock and read the consequences. */
(function (global) {
  'use strict';
  var L = global.Lumen, U = global.UNIVERSE, C = global.CASCADE, UIx = global.UI, el = L.el, F = L.F, M = L.M;

  var st = { seed: 'me_conflict', sev: 0.65, depth: 5, minP: 0.10, selected: null };
  var run = null, ex = null, bodyEl = null;

  function mount(world, params) {
    if (params.seed) st.seed = params.seed;
    if (params.sev !== undefined) st.sev = params.sev;
    compute();
    var root = el('div', { class: 'casc' });
    root.appendChild(controls(world, root));
    bodyEl = el('div', { class: 'casc-body', id: 'casc-body' });
    root.appendChild(bodyEl);
    renderBody(world);
    return root;
  }

  function compute() {
    run = C.propagate(st.seed, st.sev, { maxDepth: st.depth, minP: st.minP });
    ex = C.expressions(run);
    global.APP.scenario = { run: run, ex: ex };
  }

  function rerender(world) {
    compute();
    renderBody(world);
    var h = L.$('.casc-seedname');
    if (h) h.textContent = run.seedNode.n;
  }

  function controls(world, root) {
    var seedWrap = el('div', { class: 'seed-row' });
    C.seeds().forEach(function (n) {
      seedWrap.appendChild(el('button', {
        class: 'seed-c' + (n.id === st.seed ? ' on' : ''),
        title: n.d,
        onclick: function () {
          st.seed = n.id; st.selected = null;
          L.$$('.seed-c', seedWrap).forEach(function (b) { b.classList.remove('on'); });
          this.classList.add('on');
          rerender(world);
        }
      }, [
        el('b', { text: n.n }),
        el('span', { text: (n.c || []).map(function (c) { return (U.COUNTRIES[c] || {}).n || c; }).slice(0, 3).join(' · ') })
      ]));
    });

    return UIx.panel('Scenario', { icon: '⚡', class: 'p-seed' }, [
      seedWrap,
      el('div', { class: 'casc-ctl' }, [
        UIx.field('Severity', UIx.slider(st.sev, 0.1, 1, 0.05, function (v) { st.sev = v; rerender(world); }, function (v) { return Math.round(v * 100) + '%'; }),
          'How far the shock actually goes — scales every conditional probability in the chain.'),
        UIx.field('Max depth', UIx.slider(st.depth, 2, 7, 1, function (v) { st.depth = v; rerender(world); }, function (v) { return String(v) + ' hops'; }),
          'How many links out to follow.'),
        UIx.field('Probability floor', UIx.slider(st.minP, 0.02, 0.4, 0.02, function (v) { st.minP = v; rerender(world); }, function (v) { return Math.round(v * 100) + '%'; }),
          'Prune branches whose chain probability falls below this.')
      ])
    ]);
  }

  function renderBody(world) {
    var host = bodyEl;
    if (!host) return;
    L.clear(host);
    host.appendChild(headline(world));
    host.appendChild(chainPanel(world));
    host.appendChild(el('div', { class: 'casc-cols' }, [
      winnersPanel(world), losersPanel(world), factorPanel()
    ]));
    host.appendChild(instrumentPanel(world));
    host.appendChild(nextPanel(world));
  }

  /* ---------- headline read ---------- */
  function headline(world) {
    var top = run.nodes.filter(function (n) { return n.depth > 0; }).slice(0, 12);
    var narrative = buildNarrative();
    return UIx.panel('Read', { icon: '📖', class: 'p-read' }, [
      el('div', { class: 'read-head' }, [
        el('h3', {}, [el('span', { class: 'casc-seedname', text: run.seedNode.n })]),
        UIx.badge('severity ' + Math.round(st.sev * 100) + '%', st.sev > 0.75 ? 'down' : st.sev > 0.45 ? 'warn' : 'n'),
        UIx.badge(run.nodes.length + ' nodes reached', 'i')
      ]),
      el('p', { class: 'note', text: run.seedNode.d || '' }),
      el('div', { class: 'chain-text' }, narrative.map(function (seg, i) {
        return el('span', { class: 'ct-seg' }, [
          el('b', { text: seg.n }),
          seg.p !== null ? el('i', { text: Math.round(seg.p * 100) + '%' }) : null,
          i < narrative.length - 1 ? el('u', { text: '→' }) : null
        ]);
      })),
      el('p', { class: 'note small', text: 'Percentages are the probability of that link holding given the previous one did, at the chosen severity. They come from the edge weights in the causal graph — they are modelling assumptions, not measured frequencies.' })
    ]);
  }

  /* the plain-english chain, following the strongest consumer-facing route */
  function buildNarrative() {
    var prefer = ['s_energy', 'oil_spike', 'pump_prices', 'cpi_up', 'cost_of_living', 'discretionary_down',
      'public_anger', 'election_risk', 'subsidies', 'fiscal_deficit', 'bond_supply', 'rates_higher',
      'elec_bills', 'ev_demand', 'battery_demand', 's_battery', 'chip_supply', 's_semis', 's_defense', 's_mining'];
    var target = null;
    for (var i = prefer.length - 1; i >= 0; i--) {
      if (run.byId[prefer[i]]) { target = prefer[i]; break; }
    }
    if (!target) {
      var deep = run.nodes.filter(function (n) { return n.depth > 0; }).sort(function (a, b) { return b.depth - a.depth; })[0];
      target = deep ? deep.id : run.seed;
    }
    return C.chainTo(run, target).map(function (s, i) {
      return { n: s.n, p: i === 0 ? null : s.stepP };
    });
  }

  /* ---------- layered graph ---------- */
  function chainPanel(world) {
    var host = el('div', { class: 'graph-host' });
    var p = UIx.panel('Transmission Graph', { icon: '🕸', class: 'p-graph', bodyClass: 'nopad',
      actions: [el('span', { class: 'lg-note', text: 'click any node to trace its own chain' })] }, [host]);
    setTimeout(function () { drawGraph(host, world); }, 0);
    return p;
  }

  function drawGraph(host, world) {
    L.clear(host);
    var byDepth = {};
    run.nodes.forEach(function (n) {
      if (Math.abs(n.score) < 0.012 && n.depth > 0) return;
      (byDepth[n.depth] || (byDepth[n.depth] = [])).push(n);
    });
    var depths = Object.keys(byDepth).map(Number).sort(function (a, b) { return a - b; });
    depths.forEach(function (d) {
      byDepth[d].sort(function (a, b) { return Math.abs(b.score) - Math.abs(a.score); });
      byDepth[d] = byDepth[d].slice(0, 8);
    });

    var colW = 210, rowH = 54, padX = 14, padY = 16;
    var maxRows = Math.max.apply(null, depths.map(function (d) { return byDepth[d].length; }));
    var w = padX * 2 + depths.length * colW;
    var h = padY * 2 + maxRows * rowH;

    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    svg.setAttribute('class', 'cgraph');
    svg.style.minWidth = w + 'px';
    svg.style.height = h + 'px';

    var pos = {};
    depths.forEach(function (d, di) {
      var col = byDepth[d];
      var offY = (maxRows - col.length) * rowH / 2;
      col.forEach(function (n, i) {
        pos[n.id] = { x: padX + di * colW, y: padY + offY + i * rowH, n: n };
      });
    });

    /* edges */
    var gE = document.createElementNS(NS, 'g');
    Object.keys(pos).forEach(function (id) {
      var node = pos[id].n;
      (C.IN[id] || []).forEach(function (e) {
        var from = pos[e.from];
        if (!from) return;
        var a = { x: from.x + colW - 26, y: from.y + 15 };
        var b = { x: pos[id].x + 2, y: pos[id].y + 15 };
        if (b.x <= a.x) return;
        var path = document.createElementNS(NS, 'path');
        var mx = (a.x + b.x) / 2;
        path.setAttribute('d', 'M' + a.x + ' ' + a.y + ' C' + mx + ' ' + a.y + ' ' + mx + ' ' + b.y + ' ' + b.x + ' ' + b.y);
        path.setAttribute('class', 'cg-e ' + (e.s > 0 ? 'pos' : 'neg'));
        path.setAttribute('stroke-width', (0.6 + e.p * e.mag * 2.4).toFixed(2));
        var t = document.createElementNS(NS, 'title');
        t.textContent = C.NODE_BY_ID[e.from].n + ' → ' + C.NODE_BY_ID[e.to].n + '\n' +
          Math.round(e.p * 100) + '% · +' + e.lag + 'd\n' + e.why;
        path.appendChild(t);
        gE.appendChild(path);
      });
    });
    svg.appendChild(gE);

    /* nodes */
    Object.keys(pos).forEach(function (id) {
      var p = pos[id], n = p.n;
      var g = document.createElementNS(NS, 'g');
      g.setAttribute('transform', 'translate(' + p.x + ',' + p.y + ')');
      g.setAttribute('class', 'cg-n k-' + n.kind + (n.sign > 0 ? ' pos' : ' neg') + (st.selected === id ? ' sel' : ''));
      var r = document.createElementNS(NS, 'rect');
      r.setAttribute('width', colW - 30); r.setAttribute('height', 30);
      r.setAttribute('rx', 4);
      g.appendChild(r);
      var i1 = document.createElementNS(NS, 'rect');
      i1.setAttribute('width', 3); i1.setAttribute('height', 30);
      i1.setAttribute('class', 'cg-bar');
      g.appendChild(i1);
      var tx = document.createElementNS(NS, 'text');
      tx.setAttribute('x', 8); tx.setAttribute('y', 13);
      tx.textContent = n.name.length > 26 ? n.name.slice(0, 25) + '…' : n.name;
      g.appendChild(tx);
      var tx2 = document.createElementNS(NS, 'text');
      tx2.setAttribute('x', 8); tx2.setAttribute('y', 24);
      tx2.setAttribute('class', 'cg-sub');
      tx2.textContent = Math.round(n.chainP * 100) + '% · +' + n.lag + 'd · ' + (n.sign > 0 ? '▲' : '▼');
      g.appendChild(tx2);
      var ti = document.createElementNS(NS, 'title');
      ti.textContent = n.name + '\nbest chain ' + Math.round(n.chainP * 100) + '%, first effect ~' + n.lag + ' days\n' +
        (n.via && n.via[0] ? n.via[0].why : '');
      g.appendChild(ti);
      g.addEventListener('click', function () { st.selected = id; showNode(n, world); });
      svg.appendChild(g);
    });

    host.appendChild(svg);
  }

  function showNode(n, world) {
    var chain = C.chainTo(run, n.id);
    var nexts = C.nextTargets(n.id, st.sev);
    var body = [
      el('div', { class: 'sd-head' }, [
        UIx.badge(n.kind, 'i'),
        UIx.badge(n.sign > 0 ? 'amplifies' : 'suppresses', n.sign > 0 ? 'up' : 'down'),
        UIx.badge('best chain ' + Math.round(n.chainP * 100) + '%', 'n'),
        UIx.badge('~' + n.lag + ' days out', 'n')
      ]),
      el('h3', { text: n.name }),
      n.node.d ? el('p', { class: 'note', text: n.node.d }) : null,
      el('h4', { class: 'sd-sub', text: 'How it gets here' }),
      el('ol', { class: 'chain-ol' }, chain.map(function (s, i) {
        return el('li', {}, [
          el('b', { text: s.n }),
          i > 0 ? el('span', { class: 'ch-m', text: ' ' + Math.round(s.stepP * 100) + '% · +' + s.lag + 'd' }) : null,
          s.edge ? el('div', { class: 'ch-why', text: s.edge.why }) : null
        ]);
      }))
    ];
    if (nexts.length) {
      body.push(el('h4', { class: 'sd-sub', text: 'If this holds, what is next' }));
      body.push(UIx.table([{ t: 'Next' }, { t: 'Chain' }, { t: 'Lag', align: 'r' }, { t: 'Mechanism' }],
        nexts.map(function (t) {
          return [t.name, Math.round(t.p * 100) + '%', { t: '+' + t.lag + 'd', align: 'r' }, t.why];
        })));
    }
    if (n.px && n.px.length) {
      body.push(el('div', { class: 'sd-tags' }, n.px.map(function (t) {
        return UIx.tickerChip(t, function (x) { L.$$('.modal-back').forEach(function (m) { m.remove(); }); global.APP.execute('chart ' + x); });
      })));
    }
    if (n.sec) {
      var ind = U.findIndustry(n.sec);
      if (ind) {
        body.push(el('h4', { class: 'sd-sub', text: 'Sector leaders' }));
        body.push(el('div', { class: 'sd-tags' }, ind.leaders.map(function (l) {
          return UIx.tickerChip(l.t, function (x) { L.$$('.modal-back').forEach(function (m) { m.remove(); }); global.APP.execute('chart ' + x); });
        })));
      }
    }
    UIx.modal('Node', body, { class: 'wide' });
  }

  /* ---------- winners / losers ---------- */
  function sectorList(list, tone) {
    return el('div', { class: 'sec-list' }, list.map(function (s) {
      return el('div', { class: 'sec-row' }, [
        el('div', { class: 'sec-h' }, [
          el('i', { class: 'dot', style: { background: s.color } }),
          el('b', { text: s.n.split(' —')[0] }),
          el('span', { class: tone, text: (s.score >= 0 ? '+' : '') + s.score.toFixed(2) })
        ]),
        UIx.bar(Math.abs(s.score) * 45, tone === 'up' ? 'up' : 'down'),
        el('div', { class: 'sec-lead' }, s.leaders.slice(0, 4).map(function (l) {
          return UIx.tickerChip(l.t, function (t) { global.APP.execute('chart ' + t); });
        })),
        el('div', { class: 'sec-why', text: whySector(s) })
      ]);
    }));
  }

  function whySector(s) {
    var bits = [];
    if (Math.abs(s.direct) > 0.02) bits.push('direct chain effect ' + s.direct.toFixed(2));
    if (Math.abs(s.viaFactor) > 0.02) bits.push('factor exposure ' + s.viaFactor.toFixed(2));
    return bits.join(' · ') || 'small net effect';
  }

  function winnersPanel() {
    return UIx.panel('Who thrives', { icon: '📈', class: 'p-win' }, [
      ex.winners.length ? sectorList(ex.winners, 'up') : UIx.empty('No clear beneficiaries at this severity')
    ]);
  }
  function losersPanel() {
    return UIx.panel('Who suffers', { icon: '📉', class: 'p-lose' }, [
      ex.losers.length ? sectorList(ex.losers, 'down') : UIx.empty('No clear casualties at this severity')
    ]);
  }
  function factorPanel() {
    var keys = Object.keys(ex.factors);
    return UIx.panel('Macro pressure', { icon: '🧭', class: 'p-fact' }, [
      UIx.canvasBox('', keys.length * 22 + 10, function (cv) {
        global.CHART.hbars(cv, keys.map(function (k) {
          return { k: global.LINKER.FACTOR_NAMES[k] || k, v: ex.factors[k] };
        }), { fmt: function (v) { return v.toFixed(2); }, labelW: 116 });
      }),
      el('p', { class: 'note small', text: 'Net standardised pressure on each macro factor, aggregated across every branch of the chain. Sector scores combine this with the direct chain effect.' }),
      ex.macroPx.length ? el('div', { class: 'sd-tags' }, ex.macroPx.slice(0, 8).map(function (m) {
        return el('button', {
          class: 'chip tick ' + (m.sign > 0 ? 'up' : 'down'),
          onclick: function () { global.APP.execute('chart ' + m.t); },
          title: m.from + ' · ' + Math.round(m.p * 100) + '% · +' + m.lag + 'd'
        }, [(m.sign > 0 ? '▲ ' : '▼ ') + m.t]);
      })) : null
    ]);
  }

  /* ---------- instruments ---------- */
  function instrumentPanel(world) {
    var top = ex.instruments.slice(0, 10);
    var bottom = ex.instruments.slice(-10).reverse();
    function rows(list) {
      return list.map(function (x) {
        var q = global.MARKET.quote(x.t, world);
        return {
          _class: 'clk', _click: function () { global.APP.execute('chart ' + x.t); },
          cells: [x.t, x.n, x.sectorName.split(' —')[0],
            { t: q ? F.num(q.price, 2) : '—', align: 'r' },
            { node: el('span', { class: x.expMovePct >= 0 ? 'up' : 'down', text: F.pct(x.expMovePct, 1) }), align: 'r' },
            { node: UIx.bar(x.conf * 100, x.expMovePct >= 0 ? 'up' : 'down'), align: 'r' }]
        };
      });
    }
    var hdr = [{ t: 'Sym' }, { t: 'Name' }, { t: 'Industry' }, { t: 'Last', align: 'r' }, { t: 'Implied 1w', align: 'r' }, { t: 'Conf', align: 'r' }];
    return UIx.panel('Instrument expressions', { icon: '🎯', class: 'p-instr' }, [
      el('div', { class: 'two-col' }, [
        el('div', {}, [el('h4', { text: 'Longs the chain favours' }), UIx.table(hdr, rows(top))]),
        el('div', {}, [el('h4', { text: 'Shorts / avoid' }), UIx.table(hdr, rows(bottom))])
      ]),
      el('p', { class: 'note small', text: 'Implied move = sector score scaled to each name\'s own volatility over roughly a week. It is a sizing hint, not a forecast: it assumes the chain plays out at the severity you set and that historical volatility holds.' })
    ]);
  }

  /* ---------- second order ---------- */
  function nextPanel(world) {
    var sectors = run.nodes.filter(function (n) { return n.kind === 'sector'; }).slice(0, 6);
    var host = el('div', {});
    if (!sectors.length) return UIx.panel('Second order', { icon: '⛓' }, [UIx.empty('No sector-level nodes reached')]);
    host.appendChild(el('p', { class: 'note', text: 'If the first-order casualty absorbs the shock, this is where the pressure travels next. Pick a node to walk it forward.' }));
    var picker = el('div', { class: 'sd-tags' });
    var out = el('div', {});
    sectors.forEach(function (n) {
      picker.appendChild(el('button', {
        class: 'chip', text: n.name.split(' —')[0],
        onclick: function () { renderNext(n.id); }
      }));
    });
    function renderNext(id) {
      L.clear(out);
      var nexts = C.nextTargets(id, st.sev);
      out.appendChild(el('h4', { text: 'After ' + C.NODE_BY_ID[id].n }));
      out.appendChild(UIx.table([{ t: 'Next target' }, { t: 'Kind' }, { t: 'Chain' }, { t: 'Lag', align: 'r' }, { t: 'Mechanism' }],
        nexts.map(function (t) {
          return [t.name, t.kind, Math.round(t.p * 100) + '%', { t: '+' + t.lag + 'd', align: 'r' }, t.why];
        })));
    }
    renderNext(sectors[0].id);
    host.appendChild(picker);
    host.appendChild(out);
    return UIx.panel('Second order — where it goes next', { icon: '⛓', class: 'p-next' }, [host]);
  }

  UIx.register('cascade', { mount: mount });
})(window);
