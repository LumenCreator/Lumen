/* Lumen Terminal — Analysis: behaviour scanning and backtesting on one symbol.
   Signals and the Backtest Lab were the same question asked twice — "what is this instrument
   doing" — with two symbol pickers. One setup bar now drives both. */
(function (global) {
  'use strict';
  var L = global.Lumen, UIx = global.UI, el = L.el, B = global.BACKTEST;

  var st = { sym: 'CL=F', tf: '1d', days: 400, tab: 'read' };

  var TABS = [
    { v: 'read', n: 'Behaviour', g: 'sig' },
    { v: 'anomalies', n: 'Anomalies', g: 'sig' },
    { v: 'events', n: 'Event studies', g: 'sig' },
    { v: 'alerts', n: 'Alerts', g: 'sig' },
    { v: 'gaps', n: 'Gaps', g: 'bt' },
    { v: 'strategy', n: 'Strategy', g: 'bt' },
    { v: 'periodic', n: 'Periodic', g: 'bt' },
    { v: 'sweep', n: 'Sweep', g: 'bt' }
  ];
  /* the two families want different history lengths, so each keeps its own sensible default */
  var TF_DEFAULT = { sig: { tf: '1d', days: 400 }, bt: { tf: '15m', days: 90 } };

  var bodyEl = null;

  function mount(world, params) {
    params = params || {};
    if (params.sym) st.sym = params.sym.toUpperCase();
    if (params.tab) st.tab = params.tab;
    if (params.tf) st.tf = params.tf;
    if (params.days) st.days = params.days;
    if (!params.tf && !params.days) {
      var d = TF_DEFAULT[groupOf(st.tab)];
      st.tf = d.tf; st.days = d.days;
    }

    var root = el('div', { class: 'anl' });
    root.appendChild(setupPanel(world));
    bodyEl = el('div', { id: 'anl-body' });
    root.appendChild(bodyEl);
    render(world);
    return root;
  }

  function groupOf(tab) {
    for (var i = 0; i < TABS.length; i++) if (TABS[i].v === tab) return TABS[i].g;
    return 'sig';
  }

  function setupPanel(world) {
    var symIn = el('input', { class: 'sym-in', value: st.sym, spellcheck: 'false' });
    symIn.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      st.sym = symIn.value.trim().toUpperCase();
      global.SEC_BACKTEST.clearCSV();
      render(world);
    });

    var file = el('input', {
      type: 'file', accept: '.csv,text/csv', style: { display: 'none' },
      onchange: function (e) {
        var f = e.target.files[0];
        if (!f) return;
        var rd = new FileReader();
        rd.onload = function () {
          try {
            var bars = B.parseCSV(String(rd.result));
            global.SEC_BACKTEST.importCSV(bars, f.name);
            UIx.toast('Loaded ' + bars.length + ' bars from ' + f.name, 'up', 5000);
            if (groupOf(st.tab) !== 'bt') st.tab = 'gaps';
            render(world);
          } catch (err) { UIx.toast(err.message, 'warn', 7000); }
        };
        rd.readAsText(f);
      }
    });
    var imported = global.SEC_BACKTEST.importedName();

    var tabRow = el('div', { class: 'anl-tabs' });
    var lastGroup = null;
    TABS.forEach(function (t) {
      if (lastGroup && t.g !== lastGroup) tabRow.appendChild(el('i', { class: 'tab-sep' }));
      lastGroup = t.g;
      tabRow.appendChild(el('button', {
        class: 'anl-tab' + (st.tab === t.v ? ' on' : ''), text: t.n,
        onclick: function () {
          var prev = groupOf(st.tab);
          st.tab = t.v;
          /* moving between the behaviour and backtest families resets to that family's
             natural history length rather than leaving 400 daily bars on a 15m scan */
          if (groupOf(t.v) !== prev) {
            var d = TF_DEFAULT[groupOf(t.v)];
            st.tf = d.tf; st.days = d.days;
          }
          render(world);
        }
      }));
    });

    return UIx.panel('Analysis', {
      icon: '🔬', class: 'p-anlset',
      actions: [
        el('button', { class: 'btn', text: '⭳ TradingView CSV', onclick: function () { file.click(); } }),
        file,
        imported ? el('span', { class: 'imp-name' }, [
          UIx.badge('CSV: ' + imported, 'up'),
          el('button', { class: 'mini', text: 'clear', onclick: function () { global.SEC_BACKTEST.clearCSV(); render(world); } })
        ]) : null
      ]
    }, [
      el('div', { class: 'anl-ctl' }, [
        UIx.field('Symbol', symIn),
        UIx.field('Timeframe', UIx.toggleRow(['5m', '15m', '1h', '4h', '1d'], st.tf, function (v) { st.tf = v; render(world); })),
        UIx.field('History', UIx.toggleRow([
          { v: 30, n: '1m' }, { v: 90, n: '3m' }, { v: 180, n: '6m' }, { v: 400, n: '13m' }, { v: 730, n: '2y' }
        ], st.days, function (v) { st.days = +v; render(world); }))
      ]),
      el('div', { class: 'presets' }, ['CL=F', 'NVDA', 'SPY', 'GC=F', 'BTC', 'XOM', 'TSLA', 'BKW.AX'].map(function (t) {
        return el('button', {
          class: 'chip' + (t === st.sym ? ' on' : ''), text: t,
          onclick: function () { st.sym = t; symIn.value = t; global.SEC_BACKTEST.clearCSV(); render(world); }
        });
      })),
      tabRow
    ]);
  }

  function render(world) {
    var root = L.$('.anl');
    if (root) {
      /* rebuild the setup panel so the tab and preset highlighting stay in sync */
      var old = root.firstChild;
      root.replaceChild(setupPanel(world), old);
    }
    if (!bodyEl) return;
    L.clear(bodyEl);
    var g = groupOf(st.tab);
    if (g === 'sig') {
      global.SEC_SIGNALS.configure({ sym: st.sym, tf: st.tf, days: st.days });
      global.SEC_SIGNALS.invalidate();
      global.SEC_SIGNALS.render(bodyEl, world, st.tab);
    } else {
      global.SEC_BACKTEST.configure({ sym: st.sym, tf: st.tf, days: st.days });
      global.SEC_BACKTEST.render(bodyEl, world, st.tab);
    }
  }

  UIx.register('analysis', { mount: mount });
})(window);
