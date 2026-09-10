/* Lumen Terminal — Main Street: household cost pressure and disaster response chains. */
(function (global) {
  'use strict';
  var L = global.Lumen, U = global.UNIVERSE, H = global.HOUSEHOLD, UIx = global.UI,
      el = L.el, F = L.F, M = L.M;

  var st = { tab: 'costs', country: 'AU', playbook: 'flood', day: 7 };
  var bodyEl = null;

  function configure(p) {
    if (!p) return;
    if (p.playbook) { st.playbook = p.playbook; st.tab = 'disaster'; }
    if (p.country) st.country = p.country;
    if (p.tab) st.tab = p.tab;
  }
  function renderInto(host, world, tab) {
    if (tab) st.tab = tab;
    bodyEl = host;
    L.clear(host);
    host.appendChild(marketPicker(world));
    var body = el('div', {});
    host.appendChild(body);
    bodyEl = body;
    render(world);
  }
  function marketPicker(world) {
    return el('div', { class: 'ms-ctl' }, [
      UIx.field('Market', UIx.toggleRow([
        { v: 'AU', n: 'Australia' }, { v: 'US', n: 'United States' }
      ], st.country, function (v) { st.country = v; render(world); }),
        'Picks resolve to the companies listed in that market. Australia is covered in depth because the building-materials and insurance chain there is unusually concentrated in a few listed names.')
    ]);
  }

  function render(world) {
    if (!bodyEl) return;
    L.clear(bodyEl);
    if (st.tab === 'costs') renderCosts(world);
    else renderDisaster(world);
  }

  /* ---------- cost of living ---------- */
  function renderCosts(world) {
    var items = H.BASKET.map(function (b) {
      var q = global.MARKET.quote(b.proxy, world);
      var proxyChg = q ? q.chgPct : 0;
      /* pressure: how hard this line is squeezing households right now, from the proxy's
         recent move in the direction that hurts */
      var bars = global.MARKET.bars(b.proxy, '1d', 90, world);
      var chg90 = bars.length > 2 ? (bars[bars.length - 1].c - bars[0].c) / bars[0].c * 100 : 0;
      var pressure = M.clamp((chg90 * b.dir) / 25, -1, 1);
      return { b: b, q: q, chg90: chg90, pressure: pressure, contribution: pressure * b.share };
    });
    var ranked = items.slice().sort(function (a, b) { return b.contribution - a.contribution; });
    var netSqueeze = M.sum(items.map(function (i) { return i.contribution; }));

    bodyEl.appendChild(UIx.panel('Where the household budget is being squeezed', { icon: '💸', class: 'p-squeeze' }, [
      el('div', { class: 'grid4' }, [
        UIx.stat('Net pressure', (netSqueeze * 100).toFixed(0), {
          tone: netSqueeze > 0.08 ? 'down' : netSqueeze < -0.08 ? 'up' : 'n',
          sub: netSqueeze > 0.08 ? 'costs rising faster than relief' : netSqueeze < -0.08 ? 'easing' : 'roughly flat'
        }),
        UIx.stat('Worst line', ranked[0] ? ranked[0].b.n : '—', { tone: 'down', sub: ranked[0] ? F.pct(ranked[0].chg90, 1) + ' over 90d' : '' }),
        UIx.stat('Easing most', ranked[ranked.length - 1] ? ranked[ranked.length - 1].b.n : '—', { tone: 'up' }),
        UIx.stat('Categories tracked', String(H.BASKET.length))
      ]),
      UIx.canvasBox('', H.BASKET.length * 22 + 10, function (cv) {
        global.CHART.hbars(cv, ranked.map(function (i) {
          return { k: i.b.n, v: i.contribution * 100 };
        }), { labelW: 140, fmt: function (v) { return v.toFixed(1); } });
      }),
      el('p', { class: 'note small', text: 'Each line is its share of a typical household budget multiplied by how far its price proxy has moved in the direction that hurts, over 90 days. It is a directional read on which bills are doing the damage, not a measured CPI basket — and the shares are approximations of household expenditure survey shapes, not a specific release.' })
    ]));

    bodyEl.appendChild(UIx.panel('The bills, and who collects them', { icon: '🧾', class: 'p-basket' }, [
      el('div', { class: 'basket' }, ranked.map(function (i) { return basketCard(i, world); }))
    ]));
  }

  function basketCard(item, world) {
    var b = item.b;
    var region = st.country;
    function pickRow(list, tone) {
      return list.filter(function (p) {
        var e = U.findEntity(p.t);
        if (!e) return false;
        if (region === 'AU') return true;                       /* AU view shows both AU and global */
        return String(p.t).indexOf('.AX') < 0;                  /* US view hides ASX lines */
      }).map(function (p) {
        var e = U.findEntity(p.t);
        var q = global.MARKET.quote(p.t, world);
        return el('div', { class: 'bc-row clk', onclick: function () { global.APP.execute('chart ' + p.t); } }, [
          el('code', { text: p.t }),
          el('span', { class: 'bc-n', text: e ? e.n : p.t }),
          el('span', { class: 'bc-w', text: p.w }),
          el('b', { class: q && q.chgPct >= 0 ? 'up' : 'down', text: q ? F.pct(q.chgPct) : '—' })
        ]);
      });
    }
    var winners = pickRow(b.winners || []);
    var losers = pickRow(b.losers || []);
    return el('div', { class: 'bcard' }, [
      el('div', { class: 'bc-h' }, [
        el('span', { class: 'bc-i', text: b.icon }),
        el('b', { text: b.n }),
        UIx.badge((b.share * 100).toFixed(0) + '% of budget', 'n'),
        el('span', { class: item.chg90 >= 0 ? 'down' : 'up', text: F.pct(item.chg90, 1) + ' 90d' })
      ]),
      UIx.bar(Math.abs(item.pressure) * 100, item.pressure > 0 ? 'down' : 'up'),
      el('p', { class: 'bc-pain', text: b.pain }),
      winners.length ? el('div', { class: 'bc-sec' }, [el('h5', { text: 'Gets paid when this rises' })].concat(winners)) : null,
      losers.length ? el('div', { class: 'bc-sec' }, [el('h5', { text: 'Pays for it' })].concat(losers)) : null
    ]);
  }

  /* ---------- disaster response ---------- */
  function renderDisaster(world) {
    var picker = el('div', { class: 'presets' }, H.PLAYBOOKS.map(function (p) {
      return el('button', {
        class: 'chip' + (p.id === st.playbook ? ' on' : ''), text: p.icon + ' ' + p.n,
        onclick: function () { st.playbook = p.id; render(world); }
      });
    }));
    var pb = H.playbook(st.playbook);
    if (!pb) { bodyEl.appendChild(UIx.empty('Unknown playbook')); return; }

    bodyEl.appendChild(UIx.panel('Response playbook', {
      icon: pb.icon, class: 'p-pbset',
      actions: [UIx.field('Days since event', UIx.slider(st.day, 0, 720, 1, function (v) {
        st.day = v;
        var t = L.$('#pb-timeline');
        if (t && t._render) t._render();
        var l = L.$('#pb-list');
        if (l && l._render) l._render();
      }, function (v) { return v < 60 ? v + 'd' : (v / 30).toFixed(0) + 'mo'; }))]
    }, [
      picker,
      el('h3', { text: pb.icon + '  ' + pb.n }),
      el('p', { class: 'note', text: pb.note })
    ]));

    /* timeline */
    var tl = UIx.panel('Phases', { icon: '⏳', class: 'p-timeline' }, []);
    var tlBody = tl.querySelector('.pnl-b');
    tl.id = 'pb-timeline';
    tl._render = function () {
      L.clear(tlBody);
      var maxDay = Math.max.apply(null, pb.phases.map(function (p) { return p.days[1]; }));
      pb.phases.forEach(function (ph) {
        var active = st.day >= ph.days[0] && st.day <= ph.days[1];
        var done = st.day > ph.days[1];
        var picks = ph.picks[st.country] || ph.picks.US || [];
        tlBody.appendChild(el('div', { class: 'phase' + (active ? ' on' : '') + (done ? ' done' : '') }, [
          el('div', { class: 'ph-h' }, [
            el('b', { text: ph.n }),
            UIx.badge(fmtWindow(ph.days), active ? 'warn' : 'n'),
            ph.key ? UIx.badge('largest spend', 'up') : null,
            active ? UIx.badge('live now', 'down') : done ? UIx.badge('passed', 'n') : UIx.badge('ahead', 'i')
          ]),
          el('div', { class: 'ph-track' }, [
            el('i', { style: {
              left: (ph.days[0] / maxDay * 100) + '%',
              width: Math.max(2, (ph.days[1] - ph.days[0]) / maxDay * 100) + '%'
            } }),
            el('u', { style: { left: M.clamp(st.day / maxDay * 100, 0, 100) + '%' } })
          ]),
          el('p', { class: 'ph-what', text: ph.what }),
          ph.caution ? el('p', { class: 'ph-caution' }, [UIx.badge('watch out', 'warn'), ' ', ph.caution]) : null,
          el('div', { class: 'ph-picks' }, picks.map(function (t) {
            var e = U.findEntity(t);
            return el('button', {
              class: 'chip tick', title: e ? e.n + ' — ' + (e.note || '') : t,
              onclick: function () { global.APP.execute('chart ' + t); }, text: t
            });
          }))
        ]));
      });
    };
    tl._render();
    bodyEl.appendChild(tl);

    /* generated buy list */
    var lp = UIx.panel('Generated stock list', {
      icon: '📋', class: 'p-pblist',
      actions: [el('button', { class: 'mini', text: 'copy tickers', onclick: function () {
        var lst = H.buildList(st.playbook, st.country, st.day);
        L.copy(lst.rows.map(function (r) { return r.t; }).join(', '));
        UIx.toast('Tickers copied', 'up');
      } })]
    }, []);
    var lpBody = lp.querySelector('.pnl-b');
    lp.id = 'pb-list';
    lp._render = function () {
      L.clear(lpBody);
      var lst = H.buildList(st.playbook, st.country, st.day);
      lpBody.appendChild(el('p', { class: 'note', text: 'Ranked for day ' + st.day + ' after the event: phases that are live now rank above phases that have passed or have not started. Move the slider and the order changes, because the trade in week one is not the trade in month nine.' }));
      lpBody.appendChild(UIx.table(
        [{ t: '#' }, { t: 'Ticker' }, { t: 'Company' }, { t: 'Role in the chain' }, { t: 'Phase' }, { t: 'Timing' }, { t: 'Last', align: 'r' }, { t: 'Chg', align: 'r' }],
        lst.rows.map(function (r, i) {
          var e = U.findEntity(r.t);
          var q = global.MARKET.quote(r.t, world);
          return {
            _class: 'clk' + (r.active ? ' win' : ''),
            _click: function () { global.APP.execute('chart ' + r.t); },
            cells: [
              String(i + 1),
              { node: el('code', { text: r.t }) },
              e ? e.n : r.t,
              e ? (e.note || '—') : '—',
              r.phase.n,
              { node: r.active ? UIx.badge('live', 'up') : r.upcoming ? UIx.badge('ahead', 'i') : UIx.badge('passed', 'n') },
              { t: q ? F.num(q.price, 2) : '—', align: 'r' },
              { node: el('span', { class: q && q.chgPct >= 0 ? 'up' : 'down', text: q ? F.pct(q.chgPct) : '—' }), align: 'r' }
            ]
          };
        })));
      lpBody.appendChild(el('p', { class: 'note small', text: 'This is a research starting point, not a portfolio. The chain says who is structurally exposed to the rebuild; it says nothing about whether that exposure is already in the price — which after a widely reported disaster it usually partly is. Check the chart and the exhaustion read on each name before acting, and remember that the insurers in the claims phase are a loss first and a beneficiary later.' }));
    };
    lp._render();
    bodyEl.appendChild(lp);

    /* recent stories that could trigger this */
    var recent = (world.stories || []).filter(function (s) {
      return s.imp >= 3 && (s.k === 'climate' || s.k === 'conflict') &&
        (s.countries || []).indexOf(st.country) >= 0;
    }).slice(0, 6);
    bodyEl.appendChild(UIx.panel('Live triggers in the wire', { icon: '📡', class: 'p-trig', count: recent.length }, [
      recent.length
        ? el('div', { class: 'wire compact' }, recent.map(function (s) {
            return el('article', { class: 'st k-' + s.k, onclick: function () { global.APP.go('desk'); } }, [
              el('div', { class: 'st-top' }, [
                UIx.impactDots(s.imp), el('span', { class: 'st-k', text: s.k }),
                el('span', { class: 'st-src', text: s.src }), UIx.simBadge(s),
                el('span', { class: 'st-ago', text: F.ago(s.t) })
              ]),
              el('h4', { class: 'st-h', text: s.h }),
              el('div', { class: 'st-tags' }, [
                el('button', { class: 'chip', text: 'open ' + global.ALERTS.guessDisaster(s.h) + ' playbook', onclick: function (e) {
                  e.stopPropagation(); st.playbook = global.ALERTS.guessDisaster(s.h); st.day = 3; render(world);
                } })
              ])
            ]);
          }))
        : UIx.empty('Nothing in the wire for ' + ((U.COUNTRIES[st.country] || {}).n || st.country) + ' right now',
            'Set a disaster alert in Signals → Alerts and this will open automatically when one lands.')
    ]));
  }

  function fmtWindow(d) {
    function f(x) { return x < 60 ? x + 'd' : x < 730 ? (x / 30).toFixed(0) + 'mo' : (x / 365).toFixed(0) + 'y'; }
    return f(d[0]) + ' – ' + f(d[1]);
  }

  global.SEC_MAINSTREET = { state: st, configure: configure, render: renderInto };
})(window);
