/* Lumen Terminal — application shell: world bootstrap, routing, command bar, settings. */
(function (global) {
  'use strict';
  var L = global.Lumen, U = global.UNIVERSE, UIx = global.UI, el = L.el, F = L.F;

  var App = {
    world: null,
    views: ['desk', 'signals', 'cascade', 'backtest', 'links', 'mainstreet', 'whales', 'book'],
    viewNames: { desk: 'Desk', signals: 'Signals', cascade: 'Cascade', backtest: 'Backtest Lab', links: 'Link Analysis', mainstreet: 'Main Street', whales: 'Flows', book: 'Book & Risk' },
    positions: [],
    scenario: null
  };
  global.APP = App;

  /* ---------- world ---------- */
  function buildWorld(seed) {
    var now = Date.now();
    var stories = global.FEED.buildStories(seed, 120, now);
    var calendar = global.FEED.buildCalendar(now - 120 * 86400e3, now + 14 * 86400e3);
    var wallets = global.WHALES.buildWallets(seed, 46);
    var world = {
      seed: seed, now: now, stories: stories, calendar: calendar,
      threads: global.FEED.buildThreads(stories),
      wallets: wallets,
      flows: global.WHALES.buildFlows(seed, wallets, 30, now, { stories: stories }),
      institutional: global.WHALES.buildInstitutional(seed, now),
      live: false
    };
    global.MARKET.resetShocks();
    global.MARKET.clearQuotes();
    return world;
  }

  function refreshWorld(seed) {
    App.world = buildWorld(seed || ('demo-' + Math.floor(Date.now() / 86400000)));
    L.state.world = App.world;
    L.bus.emit('world', App.world);
    runAlerts();
  }

  /* Alerts are evaluated here rather than inside the Signals view so they keep running
     whichever view is open. Nothing runs while the tab is closed — there is no server. */
  function runAlerts() {
    if (!App.world || !global.ALERTS) return;
    try {
      var fired = global.ALERTS.evaluate(App.world);
      fired.forEach(function (f) {
        UIx.toast(f.title + ' — ' + f.body, f.tone === 'down' ? 'down' : 'warn', 9000);
      });
      updateAlertBadge();
    } catch (e) { console.error('[alerts]', e); }
  }
  function updateAlertBadge() {
    var b = L.$('.nav-b[data-view="signals"]');
    if (!b || !global.ALERTS) return;
    var recent = global.ALERTS.history().filter(function (h) { return Date.now() - h.t < 6 * 3600e3; });
    var dot = b.querySelector('.nav-dot');
    if (recent.length) {
      if (!dot) { dot = el('i', { class: 'nav-dot' }); b.appendChild(dot); }
      dot.textContent = recent.length > 9 ? '9+' : String(recent.length);
    } else if (dot) dot.remove();
  }
  App.runAlerts = runAlerts;

  /* ---------- routing ---------- */
  function go(view, params) {
    if (App.views.indexOf(view) < 0) view = 'desk';
    L.state.view = view;
    L.$$('.nav-b').forEach(function (b) { b.classList.toggle('on', b.dataset.view === view); });
    var host = L.$('#view');
    L.clear(host);
    var def = UIx.get(view);
    if (!def) { host.appendChild(UIx.empty('View "' + view + '" not built')); return; }
    host.appendChild(def.mount(App.world, params || {}));
    try { history.replaceState(null, '', '#' + view); } catch (e) { /* file:// */ }
    L.bus.emit('view', view);
  }
  App.go = go;

  /* ---------- command execution ---------- */
  function execute(input) {
    var cmd = global.TERMINAL.parse(input);
    if (!cmd) return;
    switch (cmd.k) {
      case 'link': go('links', { a: cmd.a, b: cmd.b }); break;
      case 'scan': go('links', { scan: cmd.a }); break;
      case 'backtest': go('backtest', { sym: cmd.sym, tf: cmd.tf, days: cmd.days }); break;
      case 'cascade': go('cascade', { seed: cmd.seed, sev: cmd.sev }); break;
      case 'map': {
        var ent = global.LINKER.resolve(cmd.q);
        if (ent && ent.type === 'country') { go('desk', { focus: ent.id }); }
        else UIx.toast('No country matched "' + cmd.q + '"', 'warn');
        break;
      }
      case 'chart': go('backtest', { sym: cmd.sym, tf: cmd.tf || '1h', days: 90 }); break;
      case 'watch': {
        var wl = L.state.settings.watchlist;
        if (wl.indexOf(cmd.sym) < 0) { wl.push(cmd.sym); L.saveSettings(); UIx.toast(cmd.sym + ' added to watchlist', 'up'); L.bus.emit('watchlist'); }
        break;
      }
      case 'unwatch': {
        var w2 = L.state.settings.watchlist;
        var i = w2.indexOf(cmd.sym);
        if (i >= 0) { w2.splice(i, 1); L.saveSettings(); UIx.toast(cmd.sym + ' removed', 'n'); L.bus.emit('watchlist'); }
        break;
      }
      case 'sector': go('desk', { sector: cmd.id }); break;
      case 'signals': go('signals', { sym: cmd.sym, tab: cmd.tab }); break;
      case 'rebuild': go('mainstreet', { tab: 'disaster', playbook: cmd.playbook, country: cmd.country }); break;
      case 'costs': go('mainstreet', { tab: 'costs', country: cmd.country }); break;
      case 'alerts': go('signals', { tab: 'alerts' }); break;
      case 'whales': go('whales', { asset: cmd.asset }); break;
      case 'news': go('desk', { newsQuery: cmd.q }); break;
      case 'goto': go(cmd.view); break;
      case 'risk': showRisk(cmd); break;
      case 'entity': {
        if (cmd.ent.type === 'country') go('desk', { focus: cmd.ent.id });
        else if (cmd.ent.type === 'sector') go('desk', { sector: cmd.ent.id });
        else if (cmd.ent.type === 'event') go('cascade', { seed: cmd.ent.id, sev: 0.65 });
        else go('backtest', { sym: cmd.ent.id, tf: '1h', days: 90 });
        break;
      }
      case 'help': showHelp(); break;
      case 'error': UIx.toast(cmd.msg, 'warn', 6000); break;
    }
  }
  App.execute = execute;

  function showRisk(cmd) {
    var s = L.state.settings.account;
    var plan = global.RISK.plan({
      t: cmd.sym, equity: s.equity, riskPct: s.riskPerTrade,
      entry: cmd.entry, stop: cmd.stop, rr: 2
    });
    if (!plan) { UIx.toast('Entry and stop must differ', 'warn'); return; }
    UIx.modal('Position size — ' + cmd.sym, [
      el('div', { class: 'grid4' }, [
        UIx.stat('Side', plan.side.toUpperCase()),
        UIx.stat('Quantity', F.num(plan.size.qty, 2)),
        UIx.stat('Notional', F.usd(plan.size.notional, 0)),
        UIx.stat('Risk', F.usd(plan.size.riskAmt, 0), { tone: 'down' }),
        UIx.stat('Stop distance', F.pctRaw(plan.size.stopPct)),
        UIx.stat('Leverage', plan.size.leverage.toFixed(2) + '×'),
        UIx.stat('2R target', F.num(plan.size.target2R, 2), { tone: 'up' }),
        UIx.stat('Breakeven win rate', F.pctRaw(plan.breakevenWinRate, 0))
      ]),
      el('p', { class: 'note', text: plan.note })
    ]);
  }

  function showHelp() {
    UIx.modal('Command reference', [
      el('div', { class: 'help-list' }, global.TERMINAL.HELP.map(function (h) {
        return el('div', { class: 'help-row' }, [
          el('code', { text: h.c }),
          el('span', { text: h.d }),
          el('button', { class: 'mini', text: h.ex, onclick: function () { L.$('#cmd').value = h.ex; execute(h.ex); L.$$('.modal-back').forEach(function (m) { m.remove(); }); } })
        ]);
      }))
    ], { class: 'wide' });
  }

  /* ---------- command bar ---------- */
  function mountCommandBar() {
    var input = L.$('#cmd');
    var drop = L.$('#cmd-drop');
    var sel = -1;

    function renderSuggest() {
      var items = global.TERMINAL.suggest(input.value);
      L.clear(drop);
      if (!items.length || document.activeElement !== input) { drop.style.display = 'none'; return; }
      items.forEach(function (it, i) {
        drop.appendChild(el('div', {
          class: 'cmd-s' + (i === sel ? ' on' : ''),
          onmousedown: function (e) { e.preventDefault(); input.value = it.t; run(); }
        }, [
          el('code', { text: it.t }),
          el('span', { text: it.d }),
          UIx.badge(it.k, it.k === 'cmd' ? 'n' : 'i')
        ]));
      });
      drop.style.display = 'block';
    }
    function run() {
      var v = input.value.trim();
      if (!v) return;
      drop.style.display = 'none';
      execute(v);
    }
    input.addEventListener('input', function () { sel = -1; renderSuggest(); });
    input.addEventListener('focus', renderSuggest);
    input.addEventListener('blur', function () { setTimeout(function () { drop.style.display = 'none'; }, 120); });
    input.addEventListener('keydown', function (e) {
      var items = L.$$('.cmd-s', drop);
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(items.length - 1, sel + 1); renderSuggest(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(-1, sel - 1); renderSuggest(); }
      else if (e.key === 'Enter') {
        if (sel >= 0 && items[sel]) input.value = items[sel].querySelector('code').textContent;
        run();
      } else if (e.key === 'Escape') { drop.style.display = 'none'; input.blur(); }
    });
    window.addEventListener('keydown', function (e) {
      if ((e.key === '/' || (e.key === 'k' && (e.metaKey || e.ctrlKey))) && document.activeElement !== input) {
        e.preventDefault(); input.focus(); input.select();
      }
    });
  }

  /* ---------- status strip ---------- */
  function marketSessions() {
    var now = new Date();
    var h = now.getUTCHours() + now.getUTCMinutes() / 60, d = now.getUTCDay();
    var wd = d >= 1 && d <= 5;
    return [
      { n: 'TOKYO', open: wd && h >= 0 && h < 6 },
      { n: 'LONDON', open: wd && h >= 7 && h < 15.5 },
      { n: 'NEW YORK', open: wd && h >= 13.5 && h < 20 },
      { n: 'CRYPTO', open: true }
    ];
  }

  function renderStatus() {
    var strip = L.$('#status');
    L.clear(strip);
    var s = L.state.settings;
    strip.appendChild(el('div', { class: 'st-clock' }, [
      el('b', { text: new Date().toISOString().slice(11, 19) + 'Z' }),
      el('span', { text: F.date(new Date()) })
    ]));
    var sess = el('div', { class: 'st-sess' });
    marketSessions().forEach(function (m) {
      sess.appendChild(el('span', { class: 'sess' + (m.open ? ' on' : ''), text: m.n }));
    });
    strip.appendChild(sess);

    /* live macro ticker */
    var tick = el('div', { class: 'st-tick' });
    ['CL=F', 'GC=F', 'US10Y', 'DXY', 'VIX', 'BTC', 'SPY'].forEach(function (t) {
      var q = global.MARKET.quote(t, App.world);
      if (!q) return;
      tick.appendChild(el('span', { class: 'tk', onclick: function () { execute('chart ' + t); } }, [
        el('b', { text: t }),
        el('i', { text: F.num(q.price, q.price > 1000 ? 0 : 2) }),
        el('u', { class: q.chgPct >= 0 ? 'up' : 'down', text: F.pct(q.chgPct) })
      ]));
    });
    strip.appendChild(tick);

    var regime = riskRegime();
    strip.appendChild(el('div', { class: 'st-right' }, [
      el('span', { class: 'regime r-' + regime.k, title: regime.why }, [regime.label]),
      el('span', { class: 'mode m-' + s.mode, title: s.mode === 'demo' ? 'Demo world — simulated data' : 'Live providers', text: s.mode.toUpperCase() })
    ]));
  }

  function riskRegime() {
    var w = App.world;
    if (!w) return { k: 'calm', label: 'RISK: —', why: '' };
    var cutoff = Date.now() - 48 * 3600e3;
    var recent = w.stories.filter(function (s) { return s.t >= cutoff; });
    var war = 0, rates = 0, n = 0;
    recent.forEach(function (s) {
      war += Math.abs((s.f && s.f.war) || 0) * (s.imp / 5);
      rates += Math.abs((s.f && s.f.rates) || 0) * (s.imp / 5);
      n++;
    });
    var vix = global.MARKET.quote('VIX', w);
    var score = (war / Math.max(1, n)) * 3 + (vix ? (vix.price - 15) / 18 : 0);
    var k = score > 1.15 ? 'high' : score > 0.6 ? 'elev' : 'calm';
    return {
      k: k,
      label: 'RISK: ' + (k === 'high' ? 'ELEVATED' : k === 'elev' ? 'WATCH' : 'CONTAINED'),
      why: 'Conflict-tagged headline pressure over 48h plus the volatility gauge. VIX ' + (vix ? vix.price.toFixed(1) : '—') + '.'
    };
  }
  App.riskRegime = riskRegime;

  /* ---------- settings ---------- */
  function showSettings() {
    var s = L.state.settings;
    var P = global.PROVIDERS;
    function keyField(id, label, hint) {
      var i = el('input', {
        type: 'password', value: s.keys[id] || '', placeholder: 'not set', autocomplete: 'off',
        oninput: L.debounce(function () { s.keys[id] = i.value.trim(); L.saveSettings(); }, 300)
      });
      return UIx.field(label, i, hint);
    }
    var body = [
      el('div', { class: 'set-sec' }, [
        el('h4', { text: 'Data mode' }),
        UIx.toggleRow([
          { v: 'demo', n: 'DEMO — built-in world' },
          { v: 'live', n: 'LIVE — real providers' }
        ], s.mode, function (v) {
          L.setSetting('mode', v);
          UIx.toast('Mode: ' + v.toUpperCase() + (v === 'live' ? ' — providers will be used where keys and CORS allow' : ''), 'i', 5000);
          renderStatus();
        }),
        el('p', { class: 'note' }, [
          'DEMO runs a deterministic simulated world: every story, price and flow is generated, and is labelled ',
          UIx.badge('SIM', 'sim'),
          '. It exists so the analytics are usable before you have any API keys — never read it as real reporting. ',
          'LIVE swaps in the providers below.'
        ])
      ]),
      el('div', { class: 'set-sec' }, [
        el('h4', { text: 'Proxy' }),
        UIx.field('Proxy base path', (function () {
          var i = el('input', {
            type: 'text', value: s.proxyBase, placeholder: '/.netlify/functions/proxy',
            oninput: L.debounce(function () { L.setSetting('proxyBase', i.value.trim()); }, 300)
          });
          return i;
        })(), 'Alpaca, Marketaux, Etherscan and FMP block direct browser calls. Deploy netlify/functions/proxy.js from this repo, set the keys as environment variables there, and put the function path here.')
      ]),
      el('div', { class: 'set-sec' }, [
        el('h4', { text: 'API keys (stored in this browser only)' }),
        keyField('finnhub', 'Finnhub key', 'Quotes + candles. Works without a proxy.'),
        keyField('alpaca', 'Alpaca key ID', 'Paper trading. Needs the proxy.'),
        keyField('alpacaSecret', 'Alpaca secret', ''),
        keyField('marketaux', 'Marketaux token', 'Entity-tagged news. Needs the proxy.'),
        keyField('etherscan', 'Etherscan key', 'On-chain balances. Needs the proxy.'),
        keyField('fmp', 'FMP key', '13F and insider data. Needs the proxy.')
      ]),
      el('div', { class: 'set-sec' }, [
        el('h4', { text: 'Account & risk' }),
        UIx.field('Account equity (USD)', UIx.number(s.account.equity, function (v) { L.setSetting('account.equity', v || 0); }, { min: 0 })),
        UIx.field('Risk per trade (%)', UIx.number(s.account.riskPerTrade, function (v) { L.setSetting('account.riskPerTrade', v || 0); }, { min: 0.05, max: 10, step: 0.05 })),
        UIx.field('Max sector concentration (%)', UIx.number(s.account.maxSectorPct, function (v) { L.setSetting('account.maxSectorPct', v || 0); }, { min: 5, max: 100 }))
      ]),
      el('div', { class: 'set-sec' }, [
        el('h4', { text: 'Map' }),
        UIx.toggleRow([{ v: 'robinson', n: 'Robinson' }, { v: 'equirect', n: 'Equirectangular' }], s.projection, function (v) {
          L.setSetting('projection', v);
          L.bus.emit('projection', v);
        })
      ]),
      el('div', { class: 'set-sec' }, [
        el('h4', { text: 'Provider reachability' }),
        UIx.table([{ t: 'Provider' }, { t: 'Gives' }, { t: 'Key' }, { t: 'Direct from browser' }],
          Object.keys(P.SPECS).map(function (id) {
            var sp = P.SPECS[id];
            return [sp.n, sp.gives,
              sp.needsKey ? (s.keys[id] ? '✓ set' : '— missing') : 'not required',
              sp.cors ? '✓ yes' : '✗ proxy required'];
          }))
      ])
    ];
    UIx.modal('Settings', body, { class: 'wide' });
  }
  App.showSettings = showSettings;

  /* ---------- disclaimer ---------- */
  function maybeDisclaimer() {
    if (L.state.settings.ackedDisclaimer) return;
    var m = UIx.modal('Read this first', [
      el('p', { text: 'Lumen is an analysis terminal. It is not investment advice, and nothing in it is a recommendation to buy or sell anything.' }),
      el('ul', {}, [
        el('li', {}, ['It ships in ', UIx.badge('DEMO', 'sim'), ' mode: the news, prices, wallets and flows are all simulated by a generator in this repo. They are internally consistent and useful for learning the tools, but they are not real events and backtests run on them are not evidence of an edge.']),
        el('li', { text: 'Live mode uses third-party APIs you supply keys for. Their data, and any conclusion drawn from it, is your responsibility to verify.' }),
        el('li', { text: 'The cascade engine outputs hypotheses with explicit probabilities. Those probabilities are modelling assumptions written into the graph, not measured frequencies.' }),
        el('li', { text: 'Trading is done against Alpaca paper accounts. Do not wire this to a live brokerage account without reviewing the order path yourself.' })
      ])
    ], {
      footer: [el('button', { class: 'btn primary', text: 'Understood', onclick: function () { L.setSetting('ackedDisclaimer', true); m.close(); } })]
    });
  }

  /* ---------- boot ---------- */
  function boot() {
    refreshWorld();
    var nav = L.$('#nav');
    App.views.forEach(function (v) {
      nav.appendChild(el('button', { class: 'nav-b', 'data-view': v, text: App.viewNames[v], onclick: function () { go(v); } }));
    });
    L.$('#btn-settings').addEventListener('click', showSettings);
    L.$('#btn-help').addEventListener('click', showHelp);
    L.$('#btn-refresh').addEventListener('click', function () {
      refreshWorld('demo-' + Math.random().toString(36).slice(2, 8));
      UIx.toast('Regenerated the demo world with a new seed', 'i');
      go(L.state.view);
      renderStatus();
    });
    mountCommandBar();
    renderStatus();
    setInterval(renderStatus, 15000);
    setInterval(runAlerts, 180000);
    L.bus.on('alerts', updateAlertBadge);

    var initial = (location.hash || '').replace('#', '');
    go(App.views.indexOf(initial) >= 0 ? initial : 'desk');
    maybeDisclaimer();

    L.bus.on('watchlist', function () { if (L.state.view === 'desk') go('desk'); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
