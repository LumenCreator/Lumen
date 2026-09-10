/* Lumen Terminal — Desk: world map, macro wire, market rails. */
(function (global) {
  'use strict';
  var L = global.Lumen, U = global.UNIVERSE, UIx = global.UI, el = L.el, F = L.F, M = L.M;

  var state = { hours: 72, kind: 'ALL', region: 'ALL', minImp: 1, focus: null, overlay: 'news', query: '', open: {} };
  var map = null;

  function mount(world, params) {
    if (params.focus) state.focus = params.focus;
    if (params.newsQuery !== undefined) state.query = params.newsQuery || '';
    var root = el('div', { class: 'desk' });

    var left = el('div', { class: 'desk-l' });
    var mid = el('div', { class: 'desk-m' });
    var right = el('div', { class: 'desk-r' });
    root.appendChild(left); root.appendChild(mid); root.appendChild(right);

    left.appendChild(wirePanel(world));
    mid.appendChild(mapPanel(world));
    mid.appendChild(focusPanel(world));
    right.appendChild(watchPanel(world));
    right.appendChild(leadersPanel(world));
    right.appendChild(flowPanel(world));
    right.appendChild(calendarPanel(world));

    if (params.sector) setTimeout(function () { showSector(params.sector, world); }, 30);
    return root;
  }

  /* ---------- filtering ---------- */
  function filtered(world) {
    var cutoff = Date.now() - state.hours * 3600e3;
    var q = state.query.toLowerCase();
    return world.stories.filter(function (s) {
      if (s.t < cutoff) return false;
      if (s.imp < state.minImp) return false;
      if (state.kind !== 'ALL' && s.k !== state.kind) return false;
      if (state.region !== 'ALL') {
        var ok = (s.countries || []).some(function (c) { return U.COUNTRIES[c] && U.COUNTRIES[c].r === state.region; });
        if (!ok) return false;
      }
      if (state.focus && (s.countries || []).indexOf(state.focus) < 0) return false;
      if (q) {
        var hay = (s.h + ' ' + s.src + ' ' + (s.sectors || []).join(' ') + ' ' + (s.tickers || []).join(' ')).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
  }

  /* ---------- news wire ---------- */
  function wirePanel(world) {
    var listHost = el('div', { class: 'wire' });
    var countEl = el('span', { class: 'pnl-n' });

    function render() {
      var items = filtered(world);
      countEl.textContent = items.length;
      L.clear(listHost);
      if (!items.length) {
        listHost.appendChild(UIx.empty('Nothing matches these filters', 'Widen the window or clear the country focus.'));
        return;
      }
      items.slice(0, 120).forEach(function (s) {
        listHost.appendChild(storyRow(s, world));
      });
      if (items.length > 120) listHost.appendChild(el('div', { class: 'more', text: '+' + (items.length - 120) + ' more in window' }));
    }

    var filters = el('div', { class: 'wire-f' }, [
      UIx.toggleRow([{ v: 24, n: '24h' }, { v: 72, n: '3d' }, { v: 168, n: '7d' }, { v: 720, n: '30d' }], state.hours, function (v) {
        state.hours = +v; refreshAll(world);
      })
    ]);
    var search = el('input', {
      class: 'wire-s', type: 'search', placeholder: 'filter the wire…', value: state.query,
      oninput: L.debounce(function (e) { state.query = e.target.value; render(); }, 200)
    });

    var p = UIx.panel('Macro Wire', {
      icon: '📡', class: 'p-wire',
      actions: [
        el('button', { class: 'mini', text: 'clear focus', onclick: function () { state.focus = null; refreshAll(world); } })
      ]
    }, [filters, search, listHost]);
    p.querySelector('.pnl-t').appendChild(countEl);
    p._render = render;
    render();
    return p;
  }

  function storyRow(s, world) {
    var row = el('article', { class: 'st k-' + s.k + (s.imp >= 5 ? ' hot' : '') });
    var primary = (s.countries || [])[0];
    var cname = U.COUNTRIES[primary] ? U.COUNTRIES[primary].n : null;

    var head = el('div', { class: 'st-line' }, [
      /* the country of main interest leads the headline rather than sitting in a chip below it */
      cname ? el('span', { class: 'st-ctry', text: cname }) : null,
      el('h4', { class: 'st-h', text: s.h })
    ]);
    row.appendChild(head);
    row.appendChild(el('div', { class: 'st-foot' }, [
      el('span', { class: 'st-src', text: s.src }),
      UIx.simBadge(s),
      el('span', { class: 'st-ago', text: F.ago(s.t) }),
      el('i', { class: 'st-caret', text: '▾' })
    ]));

    var panel = el('div', { class: 'st-roll' });
    row.appendChild(panel);

    row.addEventListener('click', function (e) {
      if (e.target.closest('.chip') || e.target.closest('button') || e.target.closest('a')) return;
      var isOpen = row.classList.toggle('open');
      state.open[s.id] = isOpen;
      if (isOpen && !panel.childNodes.length) buildRoll(panel, s, world);
      if (isOpen) {
        map && map.highlight((s.countries || []).filter(function (c) { return U.COUNTRIES[c]; }));
      }
    });
    if (state.open[s.id]) {
      row.classList.add('open');
      buildRoll(panel, s, world);
    }
    return row;
  }

  /* Everything about a story lives in the roll-down: what it touches, the cascade it implies,
     and what it connects to. Nothing opens a separate window. */
  function buildRoll(panel, s, world) {
    L.clear(panel);

    /* --- what it touches --- */
    var tags = el('div', { class: 'st-tags' });
    (s.countries || []).forEach(function (c) {
      if (!U.COUNTRIES[c]) return;
      tags.appendChild(UIx.countryChip(c, function (iso) { setFocus(iso, world); }));
    });
    (s.sectors || []).forEach(function (sec) {
      var chip = UIx.sectorChip(sec, function (id) { showSector(id, world); });
      if (chip) tags.appendChild(chip);
    });
    (s.tickers || []).slice(0, 4).forEach(function (t) {
      tags.appendChild(UIx.tickerChip(t, function (x) { global.APP.execute('chart ' + x); }));
    });
    if (s.choke) {
      var cp = U.CHOKEPOINTS.filter(function (x) { return x.id === s.choke; })[0];
      if (cp) tags.appendChild(el('span', { class: 'chip choke', text: '⚓ ' + cp.n, title: cp.flow }));
    }
    panel.appendChild(el('div', { class: 'roll-meta' }, [
      el('span', { class: 'st-k', text: s.k }),
      el('span', { text: 'impact ' + s.imp + '/5' }),
      el('span', { text: new Date(s.t).toISOString().slice(0, 16).replace('T', ' ') + 'Z' })
    ]));
    panel.appendChild(tags);
    if (s.summary) panel.appendChild(el('p', { class: 'roll-sum', text: s.summary }));

    /* --- cascade, simplified --- */
    panel.appendChild(cascadeBlock(s, world));

    /* --- links, simplified --- */
    panel.appendChild(linkBlock(s, world));

    if (s.url) {
      panel.appendChild(el('div', { class: 'roll-src' }, [
        s.sim
          ? el('span', { text: 'Generated story — no article to open. Source template: ' })
          : el('span', { text: 'Source: ' }),
        el('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer', text: s.src })
      ]));
    }
  }

  function cascadeBlock(s, world) {
    var C = global.CASCADE;
    var seeds = C.seedsForStory(s);
    var seedId = seeds[0] ? seeds[0].id : null;
    if (!seedId) return el('div');
    var sev = M.clamp(0.35 + (s.imp / 5) * 0.5, 0.2, 0.95);
    var run = C.propagate(seedId, sev, { maxDepth: 5, minP: 0.12 });
    var ex = C.expressions(run);

    /* the strongest consumer-facing route, as a compact chain */
    var prefer = ['s_energy', 'pump_prices', 'cpi_up', 'cost_of_living', 'discretionary_down',
      'rates_higher', 'elec_bills', 'battery_demand', 's_battery', 's_semis', 's_defense', 's_mining'];
    var target = null;
    for (var i = prefer.length - 1; i >= 0; i--) if (run.byId[prefer[i]]) { target = prefer[i]; break; }
    if (!target) {
      var deep = run.nodes.filter(function (n) { return n.depth > 0; }).sort(function (a, b) { return b.depth - a.depth; })[0];
      target = deep ? deep.id : seedId;
    }
    var chain = C.chainTo(run, target);

    var wrap = el('section', { class: 'roll-sec' });
    wrap.appendChild(el('h5', {}, [
      'If this runs',
      el('button', { class: 'mini', text: 'full cascade →', onclick: function (e) {
        e.stopPropagation(); global.APP.go('cascade', { seed: seedId, sev: sev });
      } })
    ]));
    wrap.appendChild(el('div', { class: 'mini-chain' }, chain.map(function (c, i) {
      return el('span', { class: 'mc-seg', title: c.edge ? c.edge.why : '' }, [
        el('b', { text: c.n }),
        i > 0 ? el('i', { text: Math.round(c.stepP * 100) + '%' }) : null,
        i < chain.length - 1 ? el('u', { text: '→' }) : null
      ]);
    })));
    var w = ex.winners.slice(0, 3), l = ex.losers.slice(0, 3);
    wrap.appendChild(el('div', { class: 'mini-wl' }, [
      w.length ? el('div', { class: 'mw up' }, [
        el('span', { class: 'mw-l', text: 'Gains' }),
        el('div', {}, w.map(function (x) {
          return el('span', { class: 'mw-s', title: x.n }, [
            el('b', { text: x.n.split(' —')[0] }),
            el('em', { text: x.leaders.slice(0, 3).map(function (y) { return y.t; }).join(' ') })
          ]);
        }))
      ]) : null,
      l.length ? el('div', { class: 'mw down' }, [
        el('span', { class: 'mw-l', text: 'Hurts' }),
        el('div', {}, l.map(function (x) {
          return el('span', { class: 'mw-s', title: x.n }, [
            el('b', { text: x.n.split(' —')[0] }),
            el('em', { text: x.leaders.slice(0, 3).map(function (y) { return y.t; }).join(' ') })
          ]);
        }))
      ]) : null
    ]));
    return wrap;
  }

  function linkBlock(s, world) {
    var LK = global.LINKER;
    /* pick the two things this story is really about */
    var a = (s.tickers || [])[0];
    if (!a && (s.sectors || []).length) {
      var ind = U.findIndustry(s.sectors[0]);
      if (ind) a = ind.leaders[0].t;
    }
    var b = (s.countries || [])[0];
    if (a && b && (s.tickers || []).length > 1 && U.findEntity(s.tickers[1])) {
      /* if the story names two instruments, that pair is more interesting than name↔country */
      b = s.tickers[1];
    }
    if (!a || !b) return el('div');

    var r;
    try { r = LK.analyse(a, b, { world: world, days: 90 }); } catch (e) { r = null; }
    if (!r || r.error) return el('div');

    var wrap = el('section', { class: 'roll-sec' });
    wrap.appendChild(el('h5', {}, [
      'How these connect',
      el('button', { class: 'mini', text: 'full analysis →', onclick: function (e) {
        e.stopPropagation(); global.APP.go('links', { a: a, b: b });
      } })
    ]));
    var tone = r.strength >= 62 ? 'up' : r.strength >= 38 ? 'warn' : 'n';
    wrap.appendChild(el('div', { class: 'mini-link' }, [
      el('span', { class: 'ml-score t-' + tone, text: String(r.strength) }),
      el('div', { class: 'ml-b' }, [
        el('b', { text: r.a.n + ' ↔ ' + r.b.n }),
        el('span', { text: r.verdict.toLowerCase() + ' · ' + r.agreement + '/3 channels agree' +
          (r.stats ? ' · 90d correlation ' + r.stats.corr.toFixed(2) : '') })
      ])
    ]));
    if (r.paths[0]) {
      wrap.appendChild(el('div', { class: 'mini-path' }, r.paths[0].nodes.map(function (n, i) {
        return el('span', {}, [
          el('b', { text: n.n }),
          i < r.paths[0].nodes.length - 1 ? el('u', { text: '→' }) : null
        ]);
      })));
    }
    if (r.read && r.read[0]) wrap.appendChild(el('p', { class: 'roll-sum', text: r.read[0] }));
    return wrap;
  }

  /* ---------- story detail ---------- */
  function showStory(s, world) {
    var seeds = global.CASCADE.seedsForStory(s);
    var body = [
      el('div', { class: 'sd-head' }, [
        UIx.impactDots(s.imp),
        el('span', { class: 'st-k', text: s.k }),
        el('span', { class: 'st-src', text: s.src }),
        UIx.simBadge(s),
        el('span', { class: 'st-ago', text: new Date(s.t).toISOString().slice(0, 16).replace('T', ' ') + 'Z' })
      ]),
      el('h3', { text: s.h }),
      s.summary ? el('p', { class: 'note', text: s.summary }) : null,
      el('div', { class: 'sd-tags' }, [].concat(
        (s.countries || []).map(function (c) { return UIx.countryChip(c, function (iso) { setFocus(iso, world); closeModals(); }); }),
        (s.sectors || []).map(function (x) { return UIx.sectorChip(x, function (id) { closeModals(); showSector(id, world); }); }),
        (s.tickers || []).map(function (t) { return UIx.tickerChip(t, function (x) { closeModals(); global.APP.execute('chart ' + x); }); })
      ))
    ];

    /* implied factor pressure */
    var fkeys = Object.keys(s.f || {}).filter(function (k) { return Math.abs(s.f[k]) > 0.05; });
    if (fkeys.length) {
      body.push(el('h4', { class: 'sd-sub', text: 'Implied factor pressure' }));
      body.push(UIx.canvasBox('', 22 * fkeys.length + 10, function (cv) {
        global.CHART.hbars(cv, fkeys.map(function (k) {
          return { k: global.LINKER.FACTOR_NAMES[k] || k, v: s.f[k] };
        }), { fmt: function (v) { return v.toFixed(2); }, labelW: 120 });
      }));
    }

    body.push(el('h4', { class: 'sd-sub', text: 'Run this as a scenario' }));
    body.push(el('div', { class: 'sd-seeds' }, seeds.map(function (sd) {
      var node = global.CASCADE.NODE_BY_ID[sd.id];
      return el('button', {
        class: 'btn', onclick: function () { closeModals(); global.APP.go('cascade', { seed: sd.id, sev: M.clamp(0.35 + (s.imp / 5) * 0.5, 0.2, 0.95) }); }
      }, ['→ ' + node.n + '  ', UIx.badge('match ' + Math.round(sd.w * 100) + '%', 'i')]);
    })));

    if (s.url) {
      body.push(el('p', { class: 'note' }, [
        s.sim
          ? el('span', { text: 'This is a generated story, so there is no article to open. The link below goes to the wire this source template represents.' })
          : el('span', { text: 'Open the original: ' }),
        el('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer', text: s.url })
      ]));
    }
    UIx.modal(s.k.toUpperCase() + ' · ' + (U.COUNTRIES[(s.countries || [])[0]] || {}).n, body, { class: 'wide' });
  }

  function closeModals() { L.$$('.modal-back').forEach(function (m) { m.remove(); }); }

  /* ---------- map ---------- */
  function mapPanel(world) {
    var host = el('div', { class: 'map-host' });
    var legend = el('div', { class: 'map-legend' });

    var actions = [
      UIx.toggleRow([
        { v: 'news', n: 'Attention' }, { v: 'conflict', n: 'Conflict' }, { v: 'energy', n: 'Energy' }, { v: 'trade', n: 'Trade' }
      ], state.overlay, function (v) { state.overlay = v; paint(world); }),
      el('button', { class: 'mini', text: 'reset view', onclick: function () { if (map) map.reset(); } })
    ];

    var p = UIx.panel('Global Situation Map', { icon: '🌐', class: 'p-map', actions: actions, bodyClass: 'nopad' }, [host, legend]);

    setTimeout(function () {
      map = new global.WORLDMAP.MapView(host);
      map.onCountry = function (iso) { setFocus(iso, world); };
      map.onPin = function (pin) {
        if (pin.data && pin.data.h) showStory(pin.data, world);
        else if (pin.data && pin.data.flow) showChoke(pin.data, world);
      };
      host.addEventListener('mousemove', function (e) { map.moveTip(e); });
      paint(world);
      L.bus.on('projection', function (v) { map.setProjection(v); paint(world); });
    }, 0);

    L.clear(legend);
    legend.appendChild(el('div', { class: 'lg-scale' }, [
      el('span', { text: 'quiet' }),
      el('i', { class: 'lg-grad' }),
      el('span', { text: 'active' })
    ]));
    ['conflict', 'event', 'choke'].forEach(function (k) {
      legend.appendChild(el('span', { class: 'lg-k' }, [el('i', { class: 'lg-pin lm-pin-' + k }), k === 'choke' ? 'chokepoint' : k]));
    });
    legend.appendChild(el('span', { class: 'lg-note', text: 'scroll to zoom · drag to pan · click a country to focus everything on it' }));
    return p;
  }

  function paint(world) {
    if (!map) return;
    var kindFilter = state.overlay === 'news' ? null : function (s) {
      if (state.overlay === 'conflict') return s.k === 'conflict' || (s.f && s.f.war > 0.2);
      if (state.overlay === 'energy') return s.k === 'energy' || (s.f && Math.abs(s.f.oil || 0) > 0.2);
      if (state.overlay === 'trade') return s.k === 'trade' || s.k === 'supplychain';
      return true;
    };
    var stories = world.stories.filter(function (s) { return s.imp >= state.minImp; });
    map.setHeat(global.WORLDMAP.heatFromStories(stories, state.hours, kindFilter));
    map.setPins(global.WORLDMAP.pinsFromStories(stories.filter(function (s) { return !kindFilter || kindFilter(s); }), state.hours, 24));
    map.setArcs(global.WORLDMAP.arcsFromStories(stories.filter(function (s) { return !kindFilter || kindFilter(s); }), state.hours, 16));
    map.highlight(state.focus ? [state.focus] : null);
    if (state.focus) map.focusCountry(state.focus);
  }

  function setFocus(iso, world) {
    state.focus = state.focus === iso ? null : iso;
    refreshAll(world);
    if (map) {
      map.highlight(state.focus ? [state.focus] : null);
      if (state.focus) map.focusCountry(state.focus); else map.reset();
    }
  }

  function refreshAll(world) {
    var wire = L.$('.p-wire');
    if (wire && wire._render) wire._render();
    var fp = L.$('.p-focus');
    if (fp && fp._render) fp._render();
    paint(world);
  }

  function showChoke(cp, world) {
    UIx.modal(cp.n, [
      el('p', { class: 'note', text: cp.flow }),
      el('div', { class: 'sd-tags' }, cp.at.map(function (c) { return UIx.countryChip(c, function (iso) { closeModals(); setFocus(iso, world); }); })),
      el('button', { class: 'btn primary', text: 'Run the disruption scenario', onclick: function () {
        closeModals();
        var seedMap = { hormuz: 'me_conflict', suez: 'me_conflict', taiwan: 'taiwan_crisis', malacca: 'taiwan_crisis', bosphorus: 'russia_escalation' };
        global.APP.go('cascade', { seed: seedMap[cp.id] || 'me_conflict', sev: 0.75 });
      } })
    ]);
  }

  /* ---------- focus / country panel ---------- */
  function focusPanel(world) {
    var host = el('div', { class: 'focus-b' });
    var p = UIx.panel('Focus', { icon: '🎯', class: 'p-focus' }, [host]);
    p._render = function () {
      L.clear(host);
      var title = p.querySelector('.pnl-t span:nth-child(2)');
      if (!state.focus) {
        if (title) title.textContent = 'Focus — global';
        host.appendChild(globalBrief(world));
        return;
      }
      var meta = U.COUNTRIES[state.focus];
      if (title) title.textContent = 'Focus — ' + (meta ? meta.n : state.focus);
      host.appendChild(countryBrief(state.focus, world));
    };
    p._render();
    return p;
  }

  function globalBrief(world) {
    var items = filtered(world);
    var byCountry = {}, bySector = {};
    items.forEach(function (s) {
      (s.countries || []).forEach(function (c) { byCountry[c] = (byCountry[c] || 0) + s.imp; });
      (s.sectors || []).forEach(function (x) { bySector[x] = (bySector[x] || 0) + s.imp; });
    });
    var topC = Object.keys(byCountry).map(function (k) { return { k: k, v: byCountry[k] }; }).sort(function (a, b) { return b.v - a.v; }).slice(0, 8);
    var topS = Object.keys(bySector).map(function (k) { return { k: k, v: bySector[k] }; }).sort(function (a, b) { return b.v - a.v; }).slice(0, 8);
    var wrap = el('div', { class: 'brief2' });
    wrap.appendChild(el('div', {}, [
      el('h4', { text: 'Where the pressure is' }),
      UIx.canvasBox('', Math.max(60, topC.length * 20 + 8), function (cv) {
        global.CHART.hbars(cv, topC.map(function (c) { return { k: (U.COUNTRIES[c.k] || {}).n || c.k, v: c.v, color: global.CHART.theme().warn }; }), { labelW: 110, neutral: true, fmt: function (v) { return v.toFixed(0); } });
      })
    ]));
    wrap.appendChild(el('div', {}, [
      el('h4', { text: 'Sectors in the flow' }),
      UIx.canvasBox('', Math.max(60, topS.length * 20 + 8), function (cv) {
        global.CHART.hbars(cv, topS.map(function (s) {
          var ind = U.findIndustry(s.k);
          return { k: ind ? ind.n.split(' —')[0] : s.k, v: s.v, color: ind ? ind.color : null };
        }), { labelW: 110, neutral: true, fmt: function (v) { return v.toFixed(0); } });
      })
    ]));
    return wrap;
  }

  function countryBrief(iso, world) {
    var meta = U.COUNTRIES[iso];
    var wrap = el('div', { class: 'brief' });
    if (!meta) { wrap.appendChild(UIx.empty('No profile for ' + iso)); return wrap; }
    var stories = world.stories.filter(function (s) { return (s.countries || []).indexOf(iso) >= 0; });
    var recent = stories.filter(function (s) { return s.t > Date.now() - state.hours * 3600e3; });
    var leaders = U.allLeaders().filter(function (l) { return l.c === iso; });
    var chokes = U.CHOKEPOINTS.filter(function (cp) { return cp.at.indexOf(iso) >= 0; });

    wrap.appendChild(el('div', { class: 'grid4' }, [
      UIx.stat('Region', U.REGIONS[meta.r]),
      UIx.stat('Index', meta.idx || '—'),
      UIx.stat('Stories in window', String(recent.length)),
      UIx.stat('Weight', (meta.w * 100).toFixed(0) + '/100', { title: 'Relative geopolitical and financial weight used to scale the models' })
    ]));
    wrap.appendChild(el('div', { class: 'kv' }, [
      el('b', { text: 'Exports / leverage:' }),
      el('span', { text: (meta.ex || []).join(', ') || '—' })
    ]));
    if (chokes.length) {
      wrap.appendChild(el('div', { class: 'kv' }, [
        el('b', { text: 'Chokepoints:' }),
        el('span', { text: chokes.map(function (c) { return c.n; }).join(', ') })
      ]));
    }
    if (leaders.length) {
      wrap.appendChild(el('h4', { text: 'Listed leaders' }));
      wrap.appendChild(UIx.table(
        [{ t: 'Ticker' }, { t: 'Company' }, { t: 'Industry' }, { t: 'Last', align: 'r' }, { t: 'Chg', align: 'r' }],
        leaders.map(function (l) {
          var q = global.MARKET.quote(l.t, world);
          return {
            _class: 'clk',
            _click: function () { global.APP.execute('chart ' + l.t); },
            cells: [l.t, l.n, l.sectorName.split(' —')[0],
              { t: q ? F.num(q.price, 2) : '—', align: 'r' },
              { node: el('span', { class: q && q.chgPct >= 0 ? 'up' : 'down', text: q ? F.pct(q.chgPct) : '—' }), align: 'r' }]
          };
        })
      ));
    }
    wrap.appendChild(el('h4', { text: 'Latest' }));
    var list = el('div', { class: 'wire compact' });
    recent.slice(0, 6).forEach(function (s) { list.appendChild(storyRow(s, world)); });
    if (!recent.length) list.appendChild(UIx.empty('Nothing in this window'));
    wrap.appendChild(list);
    return wrap;
  }

  /* ---------- sector modal ---------- */
  function showSector(id, world) {
    var ind = U.findIndustry(id);
    if (!ind) { UIx.toast('Unknown sector: ' + id, 'warn'); return; }
    var rows = ind.leaders.map(function (l) {
      var q = global.MARKET.quote(l.t, world);
      return {
        _class: 'clk', _click: function () { closeModals(); global.APP.execute('chart ' + l.t); },
        cells: [l.t, l.n, (U.COUNTRIES[l.c] || {}).n || l.c,
          { t: F.usdc(l.mcap), align: 'r' },
          { t: q ? F.num(q.price, 2) : '—', align: 'r' },
          { node: el('span', { class: q && q.chgPct >= 0 ? 'up' : 'down', text: q ? F.pct(q.chgPct) : '—' }), align: 'r' },
          { node: UIx.sparkline(q ? q.spark : [], 70, 20), align: 'r' },
          l.note]
      };
    });
    var expKeys = Object.keys(ind.exp);
    UIx.modal(ind.icon + ' ' + ind.n, [
      el('h4', { class: 'sd-sub', text: 'Macro factor betas' }),
      UIx.canvasBox('', expKeys.length * 20 + 10, function (cv) {
        global.CHART.hbars(cv, expKeys.map(function (k) { return { k: global.LINKER.FACTOR_NAMES[k] || k, v: ind.exp[k] }; }),
          { fmt: function (v) { return v.toFixed(2); }, labelW: 120 });
      }),
      el('h4', { class: 'sd-sub', text: 'Global leaders' }),
      UIx.table([{ t: 'Ticker' }, { t: 'Company' }, { t: 'Country' }, { t: 'Mkt cap', align: 'r' }, { t: 'Last', align: 'r' }, { t: 'Chg', align: 'r' }, { t: '30d', align: 'r' }, { t: 'Why it matters' }], rows)
    ], { class: 'wide' });
  }

  /* ---------- right rail ---------- */
  function watchPanel(world) {
    var host = el('div', {});
    function render() {
      L.clear(host);
      var wl = L.state.settings.watchlist;
      if (!wl.length) { host.appendChild(UIx.empty('Watchlist empty', 'Type: watch NVDA')); return; }
      host.appendChild(UIx.table([{ t: 'Sym' }, { t: 'Last', align: 'r' }, { t: 'Chg', align: 'r' }, { t: '', align: 'r' }],
        wl.map(function (t) {
          var q = global.MARKET.quote(t, world);
          return {
            _class: 'clk', _click: function () { global.APP.execute('chart ' + t); },
            cells: [t,
              { t: q ? F.num(q.price, q.price > 1000 ? 0 : 2) : '—', align: 'r' },
              { node: el('span', { class: q && q.chgPct >= 0 ? 'up' : 'down', text: q ? F.pct(q.chgPct) : '—' }), align: 'r' },
              { node: UIx.sparkline(q ? q.spark : [], 60, 18), align: 'r' }]
          };
        })));
    }
    render();
    return UIx.panel('Watchlist', { icon: '👁', class: 'p-watch' }, [host]);
  }

  function leadersPanel(world) {
    var rows = [];
    U.INDUSTRIES.forEach(function (ind) {
      var qs = ind.leaders.map(function (l) { return global.MARKET.quote(l.t, world); }).filter(Boolean);
      if (!qs.length) return;
      var avg = M.mean(qs.map(function (q) { return q.chgPct; }));
      var best = qs.slice().sort(function (a, b) { return b.chgPct - a.chgPct; })[0];
      rows.push({ ind: ind, avg: avg, best: best });
    });
    rows.sort(function (a, b) { return b.avg - a.avg; });
    return UIx.panel('Industry Board', { icon: '🏭', class: 'p-ind' }, [
      UIx.table([{ t: 'Industry' }, { t: 'Avg', align: 'r' }, { t: 'Leader', align: 'r' }],
        rows.map(function (r) {
          return {
            _class: 'clk', _click: function () { showSector(r.ind.id, world); },
            cells: [
              { node: el('span', {}, [el('i', { class: 'dot', style: { background: r.ind.color } }), ' ' + r.ind.n.split(' —')[0]]) },
              { node: el('span', { class: r.avg >= 0 ? 'up' : 'down', text: F.pct(r.avg) }), align: 'r' },
              { node: el('span', {}, [r.best.t + ' ', el('i', { class: r.best.chgPct >= 0 ? 'up' : 'down', text: F.pct(r.best.chgPct) })]), align: 'r' }
            ]
          };
        }))
    ]);
  }

  function flowPanel(world) {
    var sum = global.WHALES.summarise(world.flows, 24);
    return UIx.panel('Large-Holder Flow · 24h', { icon: '🐋', class: 'p-flow',
      actions: [el('button', { class: 'mini', text: 'open', onclick: function () { global.APP.go('whales'); } })] }, [
      el('div', { class: 'grid3' }, [
        UIx.stat('Net', F.usdc(sum.net), { tone: sum.net >= 0 ? 'up' : 'down', sub: sum.bias }),
        UIx.stat('To exchanges', F.usdc(sum.inflow), { tone: 'down' }),
        UIx.stat('Off exchanges', F.usdc(sum.outflow), { tone: 'up' })
      ]),
      UIx.canvasBox('', Math.max(50, sum.byAsset.slice(0, 5).length * 20 + 8), function (cv) {
        global.CHART.hbars(cv, sum.byAsset.slice(0, 5), { fmt: function (v) { return F.usdc(v); }, labelW: 52 });
      })
    ]);
  }

  function calendarPanel(world) {
    var upcoming = world.calendar.filter(function (e) { return e.t > Date.now() - 3600e3; })
      .sort(function (a, b) { return a.t - b.t; }).slice(0, 7);
    return UIx.panel('Event Calendar', { icon: '📅', class: 'p-cal' }, [
      upcoming.length ? UIx.table([{ t: 'When' }, { t: 'Event' }, { t: 'Imp', align: 'r' }],
        upcoming.map(function (e) {
          var d = new Date(e.t);
          return [d.toISOString().slice(5, 16).replace('T', ' ') + 'Z', e.n,
            { node: UIx.impactDots(e.imp), align: 'r' }];
        })) : UIx.empty('No scheduled events in range')
    ]);
  }

  UIx.register('desk', { mount: mount });
})(window);
