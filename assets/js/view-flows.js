/* Lumen Terminal — Money Flows: where household money goes, where rebuild money goes, and
   where large holders are moving theirs. Main Street and the flow ledger merged into one view,
   because they answer the same question at different scales. */
(function (global) {
  'use strict';
  var L = global.Lumen, UIx = global.UI, el = L.el;

  var st = { tab: 'costs' };
  var TABS = [
    { v: 'costs', n: 'Cost of living', g: 'ms' },
    { v: 'disaster', n: 'Disaster response', g: 'ms' },
    { v: 'onchain', n: 'On-chain', g: 'w' },
    { v: 'inst', n: 'Institutional', g: 'w' },
    { v: 'wallets', n: 'Tracked wallets', g: 'w' }
  ];
  var bodyEl = null;

  function groupOf(tab) {
    for (var i = 0; i < TABS.length; i++) if (TABS[i].v === tab) return TABS[i].g;
    return 'ms';
  }

  function mount(world, params) {
    params = params || {};
    if (params.tab) st.tab = params.tab;
    if (params.playbook) st.tab = 'disaster';
    if (params.asset) st.tab = 'onchain';
    global.SEC_MAINSTREET.configure(params);
    global.SEC_WHALES.configure(params);

    var root = el('div', { class: 'flw' });
    root.appendChild(header(world));
    bodyEl = el('div', { id: 'flw-body' });
    root.appendChild(bodyEl);
    render(world);
    return root;
  }

  function header(world) {
    var tabRow = el('div', { class: 'anl-tabs' });
    var lastGroup = null;
    TABS.forEach(function (t) {
      if (lastGroup && t.g !== lastGroup) tabRow.appendChild(el('i', { class: 'tab-sep' }));
      lastGroup = t.g;
      tabRow.appendChild(el('button', {
        class: 'anl-tab' + (st.tab === t.v ? ' on' : ''), text: t.n,
        onclick: function () { st.tab = t.v; render(world); }
      }));
    });
    return UIx.panel('Money Flows', { icon: '💰', class: 'p-flwset' }, [tabRow]);
  }

  function render(world) {
    var root = L.$('.flw');
    if (root) root.replaceChild(header(world), root.firstChild);
    if (!bodyEl) return;
    L.clear(bodyEl);
    if (groupOf(st.tab) === 'ms') global.SEC_MAINSTREET.render(bodyEl, world, st.tab);
    else global.SEC_WHALES.render(bodyEl, world, st.tab === 'onchain' ? 'onchain' : st.tab);
  }

  UIx.register('flows', { mount: mount });
})(window);
