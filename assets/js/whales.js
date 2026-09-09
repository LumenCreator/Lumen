/* Lumen Terminal — large-holder / flow tracking.
   Demo mode synthesises a coherent flow ledger; LIVE mode swaps in on-chain and filings
   providers. Exchange inflows are treated as distribution risk, outflows as accumulation. */
(function (global) {
  'use strict';
  var L = global.Lumen, U = global.UNIVERSE, M = L.M;

  var CHAINS = ['ETH', 'BTC', 'SOL', 'TRON', 'BASE', 'ARB'];

  /* Wallet archetypes. In demo mode the addresses are synthetic placeholders — they are
     deliberately not real addresses. LIVE mode replaces this list with tracked addresses. */
  var ARCHETYPES = [
    { k: 'exchange', n: 'Exchange hot wallet', w: 8, sizeLo: 2e8, sizeHi: 4e9, tone: 'neutral' },
    { k: 'etf', n: 'ETF custodian', w: 5, sizeLo: 5e8, sizeHi: 8e9, tone: 'institutional' },
    { k: 'fund', n: 'Fund / market maker', w: 9, sizeLo: 3e7, sizeHi: 1.2e9, tone: 'smart' },
    { k: 'treasury', n: 'Corporate treasury', w: 4, sizeLo: 1e8, sizeHi: 3e9, tone: 'institutional' },
    { k: 'whale', n: 'Unlabelled whale', w: 14, sizeLo: 1e7, sizeHi: 6e8, tone: 'smart' },
    { k: 'miner', n: 'Miner / validator', w: 5, sizeLo: 5e6, sizeHi: 2e8, tone: 'supply' },
    { k: 'bridge', n: 'Bridge contract', w: 4, sizeLo: 5e7, sizeHi: 1.5e9, tone: 'neutral' },
    { k: 'stable', n: 'Stablecoin issuer', w: 3, sizeLo: 2e8, sizeHi: 5e9, tone: 'liquidity' }
  ];

  var ASSETS = ['BTC', 'ETH', 'SOL', 'USDT', 'USDC', 'WBTC', 'LINK', 'stETH'];

  function fakeAddr(r, chain) {
    var hex = '0123456789abcdef', s = '';
    for (var i = 0; i < 40; i++) s += hex[Math.floor(r() * 16)];
    if (chain === 'BTC') return 'bc1' + s.slice(0, 32);
    if (chain === 'SOL') return s.slice(0, 44).toUpperCase();
    if (chain === 'TRON') return 'T' + s.slice(0, 33);
    return '0x' + s;
  }

  function buildWallets(seed, n) {
    var r = L.rng('whales:' + seed);
    var pool = [];
    ARCHETYPES.forEach(function (a) { for (var i = 0; i < a.w; i++) pool.push(a); });
    var out = [];
    for (var i = 0; i < (n || 42); i++) {
      var a = pool[Math.floor(r() * pool.length)];
      var chain = CHAINS[Math.floor(r() * CHAINS.length)];
      if (a.k === 'miner' && r() < 0.6) chain = 'BTC';
      var bal = a.sizeLo + r() * (a.sizeHi - a.sizeLo);
      out.push({
        id: 'w' + i, addr: fakeAddr(r, chain), chain: chain, kind: a.k, kindName: a.n,
        label: a.k === 'whale' ? 'Whale #' + (i + 1) : a.n + ' ' + String.fromCharCode(65 + (i % 26)),
        bal: bal, tone: a.tone,
        asset: ASSETS[Math.floor(r() * ASSETS.length)],
        first: Date.now() - Math.floor(r() * 900) * 86400e3,
        watch: r() < 0.22, sim: true
      });
    }
    return out.sort(function (x, y) { return y.bal - x.bal; });
  }

  /* transfer ledger over the window */
  function buildFlows(seed, wallets, days, endMs, world) {
    var r = L.rng('flows:' + seed);
    var end = endMs || Date.now();
    var out = [];
    var stories = (world && world.stories) || [];
    /* risk-off days push flows toward exchanges */
    var riskOff = {};
    stories.forEach(function (s) {
      if ((s.f && s.f.war || 0) > 0.3 || (s.f && s.f.rates || 0) > 0.4) {
        riskOff[L.F.date(new Date(s.t))] = (riskOff[L.F.date(new Date(s.t))] || 0) + s.imp / 5;
      }
    });
    var perDay = 9;
    for (var d = 0; d < days; d++) {
      var dayMs = end - (days - 1 - d) * 86400e3;
      var ro = M.clamp((riskOff[L.F.date(new Date(dayMs))] || 0) / 3, 0, 1);
      var count = Math.round(perDay * (0.5 + r() * 1.2) * (1 + ro));
      for (var i = 0; i < count; i++) {
        var from = wallets[Math.floor(r() * wallets.length)];
        var to = wallets[Math.floor(r() * wallets.length)];
        if (from === to) continue;
        var amt = Math.pow(10, 5.6 + r() * 3.0) * (from.kind === 'etf' || from.kind === 'exchange' ? 4 : 1);
        var dir = to.kind === 'exchange' ? 'inflow' : from.kind === 'exchange' ? 'outflow' : 'transfer';
        /* on risk-off days, bias toward exchange inflows (distribution) */
        if (ro > 0.3 && r() < ro * 0.6 && dir === 'outflow') { var t = from; from = to; to = t; dir = 'inflow'; }
        out.push({
          id: 'f' + d + '_' + i,
          t: dayMs + Math.floor(r() * 86400e3),
          from: from, to: to, asset: from.asset, usd: amt, dir: dir,
          chain: from.chain, sim: true,
          note: dir === 'inflow' ? 'Sent to exchange — potential distribution'
            : dir === 'outflow' ? 'Withdrawn from exchange — accumulation / custody'
              : 'Wallet-to-wallet transfer'
        });
      }
    }
    return out.sort(function (a, b) { return b.t - a.t; });
  }

  /* institutional / equity side: 13F-style changes and insider activity */
  function buildInstitutional(seed, endMs) {
    var r = L.rng('inst:' + seed);
    var holders = ['Bridgewater', 'Renaissance', 'Citadel Advisors', 'Millennium', 'Point72',
      'Baupost', 'Tiger Global', 'Coatue', 'Appaloosa', 'Elliott', 'Pershing Square',
      'Norges Bank', 'GIC', 'Mubadala', 'PIF', 'Temasek', 'CPPIB'];
    var leaders = U.allLeaders();
    var out = [];
    for (var i = 0; i < 60; i++) {
      var l = leaders[Math.floor(r() * leaders.length)];
      var h = holders[Math.floor(r() * holders.length)];
      var dir = r() < 0.52 ? 1 : -1;
      var pct = (5 + r() * 180) * dir;
      out.push({
        id: 'i' + i, holder: h, t: l.t, name: l.n, sector: l.sector, sectorName: l.sectorName,
        changePct: pct, value: Math.pow(10, 7 + r() * 2.6),
        asOf: (endMs || Date.now()) - Math.floor(r() * 75) * 86400e3,
        kind: r() < 0.22 ? 'insider' : '13F', sim: true
      });
    }
    return out.sort(function (a, b) { return b.asOf - a.asOf; });
  }

  /* ---------- aggregation ---------- */
  function summarise(flows, hours) {
    var cutoff = Date.now() - (hours || 24) * 3600e3;
    var recent = flows.filter(function (f) { return f.t >= cutoff; });
    var inflow = 0, outflow = 0, byAsset = {}, byChain = {};
    recent.forEach(function (f) {
      if (f.dir === 'inflow') inflow += f.usd;
      if (f.dir === 'outflow') outflow += f.usd;
      var sgn = f.dir === 'inflow' ? -1 : f.dir === 'outflow' ? 1 : 0;
      byAsset[f.asset] = (byAsset[f.asset] || 0) + f.usd * sgn;
      byChain[f.chain] = (byChain[f.chain] || 0) + f.usd * sgn;
    });
    var net = outflow - inflow;
    return {
      window: (hours || 24) + 'h', n: recent.length,
      inflow: inflow, outflow: outflow, net: net,
      bias: net > 0 ? 'accumulation' : net < 0 ? 'distribution' : 'neutral',
      byAsset: Object.keys(byAsset).map(function (k) { return { k: k, v: byAsset[k] }; }).sort(function (a, b) { return Math.abs(b.v) - Math.abs(a.v); }),
      byChain: Object.keys(byChain).map(function (k) { return { k: k, v: byChain[k] }; }).sort(function (a, b) { return Math.abs(b.v) - Math.abs(a.v); }),
      top: recent.slice().sort(function (a, b) { return b.usd - a.usd; }).slice(0, 12)
    };
  }

  function walletActivity(flows, walletId) {
    return flows.filter(function (f) { return f.from.id === walletId || f.to.id === walletId; });
  }

  /* smart-money score: unlabelled whales + funds accumulating while exchanges see inflows */
  function smartMoney(flows, hours) {
    var cutoff = Date.now() - (hours || 168) * 3600e3;
    var byWallet = {};
    flows.filter(function (f) { return f.t >= cutoff; }).forEach(function (f) {
      [[f.from, -1], [f.to, 1]].forEach(function (pair) {
        var w = pair[0], sgn = pair[1];
        if (w.kind === 'exchange' || w.kind === 'bridge') return;
        var e = byWallet[w.id] || (byWallet[w.id] = { w: w, net: 0, n: 0 });
        e.net += f.usd * sgn; e.n++;
      });
    });
    return Object.keys(byWallet).map(function (k) { return byWallet[k]; })
      .sort(function (a, b) { return Math.abs(b.net) - Math.abs(a.net); }).slice(0, 14);
  }

  global.WHALES = {
    CHAINS: CHAINS, ARCHETYPES: ARCHETYPES,
    buildWallets: buildWallets, buildFlows: buildFlows, buildInstitutional: buildInstitutional,
    summarise: summarise, walletActivity: walletActivity, smartMoney: smartMoney
  };
})(window);
