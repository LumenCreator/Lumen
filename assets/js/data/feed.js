/* Lumen Terminal — demo event/news generator.
   IMPORTANT: everything produced here is SIMULATED. Stories carry sim:true and the UI badges
   them so they can never be mistaken for real reporting. Switch to LIVE mode in Settings to
   replace this feed with real wires. The generator is deterministic (seeded) so backtests,
   the map and the cascade engine all reference the same world. */
(function (global) {
  'use strict';
  var L = global.Lumen, U = global.UNIVERSE;

  var SOURCES = [
    { id: 'rt', n: 'Reuters', tier: 1, home: 'https://www.reuters.com/markets/' },
    { id: 'bb', n: 'Bloomberg', tier: 1, home: 'https://www.bloomberg.com/markets' },
    { id: 'ft', n: 'Financial Times', tier: 1, home: 'https://www.ft.com/markets' },
    { id: 'wsj', n: 'WSJ', tier: 1, home: 'https://www.wsj.com/finance' },
    { id: 'ap', n: 'AP', tier: 2, home: 'https://apnews.com/hub/business' },
    { id: 'cnbc', n: 'CNBC', tier: 2, home: 'https://www.cnbc.com/world-markets/' },
    { id: 'nk', n: 'Nikkei Asia', tier: 2, home: 'https://asia.nikkei.com/Business/Markets' },
    { id: 'scmp', n: 'SCMP', tier: 2, home: 'https://www.scmp.com/business' },
    { id: 'aj', n: 'Al Jazeera', tier: 2, home: 'https://www.aljazeera.com/economy/' },
    { id: 'plt', n: 'Platts', tier: 2, home: 'https://www.spglobal.com/commodityinsights/en' },
    { id: 'tass', n: 'Interfax', tier: 3, home: 'https://interfax.com/newsroom/top-stories/' },
    { id: 'xh', n: 'Xinhua', tier: 3, home: 'https://english.news.cn/business.htm' }
  ];

  /* Story templates. f = macro factor deltas the story implies (-1..1 scale of a 1-sigma move). */
  var TEMPLATES = [
    { k: 'conflict', w: 10, imp: [3, 5], src: ['rt', 'aj', 'bb', 'ap'],
      c: ['IR', 'IL', 'SA', 'QA', 'IQ', 'EG', 'RU', 'UA', 'TW', 'CN'],
      f: { oil: 0.7, war: 0.9, rates: 0.1, consumer: -0.2, inflation: 0.4 },
      sec: ['defense', 'energy', 'shipping', 'airlines'],
      h: [
        'Naval escort convoys expanded near {choke} after tanker incident',
        '{A} places air defence units on alert; {B} warns of retaliation',
        'Missile exchange reported near {A} border; energy infrastructure targeted',
        'Shipping insurers lift war-risk premia for {choke} transits',
        '{A} threatens to disrupt transit through {choke} if sanctions tighten'
      ] },
    { k: 'energy', w: 12, imp: [2, 5], src: ['plt', 'rt', 'bb'],
      c: ['SA', 'RU', 'US', 'AE', 'IR', 'NO', 'QA', 'NG', 'VE'],
      f: { oil: 0.8, inflation: 0.5, consumer: -0.3, rates: 0.2 },
      sec: ['energy', 'utilities', 'airlines', 'shipping'],
      h: [
        'OPEC+ signals it will hold quotas through the quarter; spare capacity in focus',
        '{A} crude exports fall {n}% month-on-month on maintenance',
        'LNG cargoes rerouted from {choke}; European gas curve steepens',
        'Refinery outage in {A} tightens diesel cracks',
        'Strategic reserve release under discussion as pump prices climb'
      ] },
    { k: 'monetary', w: 11, imp: [3, 5], src: ['bb', 'rt', 'ft', 'wsj'],
      c: ['US', 'DE', 'JP', 'GB', 'CN'],
      f: { rates: 0.8, usd: 0.5, consumer: -0.2, inflation: -0.3 },
      sec: ['banks', 'tech', 'utilities', 'crypto'],
      h: [
        'Core inflation prints {n} bp above consensus; futures trim rate-cut odds',
        'Central bank holds; guidance flags "higher for longer" if energy costs persist',
        'Bond auction tails; long-end yields push to new range highs',
        'Policymaker says services inflation remains "uncomfortably sticky"',
        'Balance-sheet runoff pace to slow, officials signal'
      ] },
    { k: 'trade', w: 11, imp: [2, 5], src: ['rt', 'ft', 'scmp', 'nk'],
      c: ['US', 'CN', 'EU', 'DE', 'MX', 'IN', 'VN', 'TW', 'KR', 'JP'],
      f: { china: -0.6, consumer: -0.3, inflation: 0.4, usd: 0.2 },
      sec: ['semis', 'autos', 'consumer', 'shipping', 'mining'],
      h: [
        '{A} announces tariffs of {n}% on {good} imports from {B}',
        '{A} adds {n} entities to export-control list, citing dual-use risk',
        '{A} and {B} open talks on critical-minerals offtake agreement',
        '{A} restricts {good} exports; buyers scramble for alternative supply',
        'Port congestion at {A} lifts container spot rates {n}%'
      ] },
    { k: 'supplychain', w: 9, imp: [2, 4], src: ['nk', 'rt', 'bb', 'plt'],
      c: ['TW', 'CN', 'KR', 'JP', 'MY', 'ID', 'CD', 'CL', 'AU'],
      f: { china: -0.4, inflation: 0.3, consumer: -0.2 },
      sec: ['semis', 'battery', 'autos', 'mining'],
      h: [
        'Foundry utilisation at {A} sites reported near capacity for advanced nodes',
        '{A} mine suspension removes {n}kt of {metal} from the seaborne market',
        'Battery-grade {metal} contracts settle {n}% higher for next quarter',
        'Rare-earth processing licences tightened in {A}',
        'Chip packaging bottleneck extends lead times by {n} weeks'
      ] },
    { k: 'policy', w: 10, imp: [2, 5], src: ['rt', 'wsj', 'ft', 'ap'],
      c: ['US', 'CN', 'DE', 'FR', 'GB', 'IN', 'BR', 'SA'],
      f: { war: 0.2, rates: 0.2, consumer: -0.1 },
      sec: ['defense', 'energy', 'health', 'banks'],
      h: [
        'Defence supplemental of ${n}B advances; munitions replenishment prioritised',
        'Sanctions package targets {A} shadow-fleet tankers and their insurers',
        'Subsidy programme for domestic {good} manufacturing expanded',
        'Windfall levy on {good} producers proposed in {A}',
        'Sovereign fund of {A} shifts allocation toward infrastructure and energy'
      ] },
    { k: 'flows', w: 9, imp: [2, 4], src: ['bb', 'ft', 'cnbc'],
      c: ['US', 'CN', 'JP', 'GB', 'CH', 'SG', 'AE'],
      f: { usd: 0.3, rates: 0.2, consumer: 0.1 },
      sec: ['banks', 'crypto', 'tech'],
      h: [
        'Record ${n}B rotates into {sectorName} funds over the week',
        'Reserve managers trim {A} holdings; gold allocations at multi-year high',
        'Spot ETF inflows top ${n}M as institutional allocations broaden',
        'Prime-broker data shows hedge funds cutting net exposure to {sectorName}',
        'Corporate buyback authorisations reach ${n}B for the quarter'
      ] },
    { k: 'corporate', w: 8, imp: [2, 4], src: ['rt', 'bb', 'cnbc', 'wsj'],
      c: ['US', 'DE', 'JP', 'KR', 'TW', 'GB', 'FR'],
      f: { consumer: 0.2, china: 0.2 },
      sec: null,
      h: [
        '{ticker} guides above consensus on {sectorName} demand; peers follow',
        '{ticker} announces ${n}B capacity expansion in {A}',
        '{ticker} in advanced talks to acquire a {sectorName} supplier',
        '{ticker} flags margin pressure from input costs and freight',
        '{ticker} secures multi-year offtake with a {A} state entity'
      ] },
    { k: 'sovereign', w: 7, imp: [2, 5], src: ['ft', 'rt', 'bb'],
      c: ['AR', 'TR', 'EG', 'NG', 'PK', 'BR', 'ZA', 'RU'],
      f: { usd: 0.4, rates: 0.3, consumer: -0.3, inflation: 0.3 },
      sec: ['banks', 'mining', 'agri'],
      h: [
        '{A} currency slides to record low; central bank intervenes',
        '{A} seeks IMF programme extension amid reserve drawdown',
        'Credit rating of {A} placed on negative watch',
        '{A} imposes capital controls on outbound transfers',
        '{A} agrees bilateral swap line with {B}'
      ] },
    { k: 'climate', w: 5, imp: [2, 4], src: ['rt', 'ap', 'plt'],
      c: ['US', 'BR', 'AU', 'IN', 'CN', 'AR'],
      f: { inflation: 0.4, oil: 0.2, consumer: -0.2 },
      sec: ['agri', 'utilities', 'shipping'],
      h: [
        'Drought cuts {A} {good} yield forecast by {n}%',
        'Heatwave drives record power demand in {A}; grid operator issues alert',
        'Low water levels force draft restrictions on key transit route',
        'Hurricane track threatens Gulf production and refining'
      ] }
  ];

  var GOODS = ['steel', 'aluminium', 'semiconductor', 'EV', 'solar module', 'battery cell', 'grain', 'pharmaceutical', 'rare-earth'];
  var METALS = ['lithium', 'cobalt', 'nickel', 'copper', 'graphite', 'uranium'];

  function pick(r, arr) { return arr[Math.floor(r() * arr.length)]; }
  function pickN(r, arr, n) {
    var c = arr.slice(), out = [];
    while (out.length < n && c.length) out.push(c.splice(Math.floor(r() * c.length), 1)[0]);
    return out;
  }

  /* macro calendar: scheduled events that concentrate volatility (drives FVG clustering) */
  function buildCalendar(startMs, endMs) {
    var out = [], d = new Date(startMs);
    d.setUTCHours(0, 0, 0, 0);
    while (d.getTime() <= endMs) {
      var dow = d.getUTCDay(), dom = d.getUTCDate(), t = d.getTime();
      if (dow === 3 && dom <= 7) out.push({ t: t + 18.5 * 3600e3, id: 'fomc', n: 'FOMC decision', imp: 5, f: { rates: 1, usd: 0.6 } });
      if (dom >= 10 && dom <= 13 && dow > 0 && dow < 6) out.push({ t: t + 12.5 * 3600e3, id: 'cpi', n: 'US CPI', imp: 5, f: { rates: 0.8, inflation: 0.9 } });
      if (dow === 5 && dom <= 7) out.push({ t: t + 12.5 * 3600e3, id: 'nfp', n: 'US payrolls', imp: 4, f: { rates: 0.6, consumer: 0.4 } });
      if (dow === 3) out.push({ t: t + 14.5 * 3600e3, id: 'eia', n: 'EIA crude inventories', imp: 3, f: { oil: 0.7 } });
      if (dom === 5) out.push({ t: t + 11 * 3600e3, id: 'opec', n: 'OPEC+ monthly report', imp: 4, f: { oil: 0.8 } });
      if (dom === 15) out.push({ t: t + 2 * 3600e3, id: 'cndata', n: 'China activity data', imp: 4, f: { china: 0.8, oil: 0.3 } });
      d = new Date(t + 86400e3);
    }
    return out.filter(function (e) { return e.t >= startMs && e.t <= endMs; });
  }

  function fill(str, ctx, r) {
    return str
      .replace(/\{A\}/g, ctx.A).replace(/\{B\}/g, ctx.B)
      .replace(/\{choke\}/g, ctx.choke)
      .replace(/\{good\}/g, pick(r, GOODS))
      .replace(/\{metal\}/g, pick(r, METALS))
      .replace(/\{ticker\}/g, ctx.ticker)
      .replace(/\{sectorName\}/g, ctx.sectorName)
      .replace(/\{n\}/g, ctx.n);
  }

  /* Build the story corpus. days = lookback window. */
  function buildStories(seed, days, endMs) {
    var r = L.rng('news:' + seed);
    var end = endMs || Date.now();
    var start = end - days * 86400e3;
    var stories = [];
    var weights = [];
    TEMPLATES.forEach(function (t, i) { for (var k = 0; k < t.w; k++) weights.push(i); });

    // stress windows: two escalation clusters so the map/cascade have live theatres
    var stress = [
      { s: end - Math.round(days * 0.62) * 86400e3, e: end - Math.round(days * 0.50) * 86400e3, k: 'conflict', c: ['IR', 'IL', 'SA'] },
      { s: end - Math.round(days * 0.20) * 86400e3, e: end - Math.round(days * 0.06) * 86400e3, k: 'conflict', c: ['IR', 'QA', 'AE'] }
    ];

    var perDay = 9;
    for (var day = 0; day < days; day++) {
      var dayStart = start + day * 86400e3;
      var dow = new Date(dayStart).getUTCDay();
      var count = Math.round((dow === 0 || dow === 6 ? perDay * 0.35 : perDay) * (0.6 + r() * 0.9));
      for (var i = 0; i < count; i++) {
        var ts = dayStart + Math.floor(r() * 86400e3);
        var inStress = stress.filter(function (s) { return ts >= s.s && ts <= s.e; })[0];
        var tpl = TEMPLATES[weights[Math.floor(r() * weights.length)]];
        if (inStress && r() < 0.45) tpl = TEMPLATES.filter(function (t) { return t.k === inStress.k; })[0];

        var cs = tpl.c.filter(function (c) { return U.COUNTRIES[c]; });
        var primary = inStress && r() < 0.6 ? pick(r, inStress.c) : pick(r, cs);
        if (!U.COUNTRIES[primary]) primary = 'US';
        var others = pickN(r, cs.filter(function (c) { return c !== primary; }), 1 + Math.floor(r() * 2));
        var choke = pick(r, U.CHOKEPOINTS);
        var sectors = tpl.sec ? pickN(r, tpl.sec, 1 + Math.floor(r() * 2)) : [pick(r, U.INDUSTRIES).id];
        var ind = U.findIndustry(sectors[0]) || U.INDUSTRIES[0];
        var lead = pick(r, ind.leaders);
        var ctx = {
          A: U.COUNTRIES[primary].n,
          B: others[0] ? U.COUNTRIES[others[0]].n : 'the United States',
          choke: choke.n, ticker: lead.t, sectorName: ind.n.split(' —')[0],
          n: (1 + Math.floor(r() * 40))
        };
        var imp = tpl.imp[0] + Math.floor(r() * (tpl.imp[1] - tpl.imp[0] + 1));
        if (inStress) imp = Math.min(5, imp + 1);

        var f = {};
        for (var k in tpl.f) f[k] = tpl.f[k] * (0.55 + r() * 0.9) * (imp / 4) * (r() < 0.18 ? -1 : 1);

        var tickers = pickN(r, ind.leaders, 2 + Math.floor(r() * 2)).map(function (x) { return x.t; });
        if (Math.abs(f.oil || 0) > 0.4) tickers.push('CL=F');
        if (Math.abs(f.rates || 0) > 0.4) tickers.push('US10Y');

        var srcId = pick(r, tpl.src);
        var src = SOURCES.filter(function (s) { return s.id === srcId; })[0] || SOURCES[0];

        stories.push({
          id: 'st_' + seed + '_' + day + '_' + i,
          t: ts, k: tpl.k, imp: imp, sim: true,
          h: fill(pick(r, tpl.h), ctx, r),
          src: src.n, srcTier: src.tier, url: src.home,
          countries: [primary].concat(others).filter(function (c) { return U.COUNTRIES[c]; }),
          sectors: sectors, tickers: tickers.filter(function (v, ix, a) { return a.indexOf(v) === ix; }),
          f: f, choke: (tpl.k === 'conflict' || tpl.k === 'energy') && r() < 0.5 ? choke.id : null
        });
      }
    }
    stories.sort(function (a, b) { return b.t - a.t; });
    return stories;
  }

  /* Group stories into running threads ("stories" the map draws arcs for) */
  function buildThreads(stories) {
    var byKey = {};
    stories.forEach(function (s) {
      var key = s.k + ':' + s.countries.slice(0, 2).sort().join('-');
      (byKey[key] || (byKey[key] = [])).push(s);
    });
    return Object.keys(byKey).map(function (k) {
      var arr = byKey[k].sort(function (a, b) { return b.t - a.t; });
      var imp = Math.max.apply(null, arr.map(function (s) { return s.imp; }));
      return {
        id: 'th_' + L.hash(k), key: k, kind: arr[0].k, items: arr,
        countries: arr[0].countries, imp: imp, last: arr[0].t, n: arr.length,
        title: arr[0].h
      };
    }).sort(function (a, b) { return (b.imp * 1e13 + b.last) - (a.imp * 1e13 + a.last); });
  }

  global.FEED = {
    SOURCES: SOURCES, TEMPLATES: TEMPLATES,
    buildStories: buildStories, buildThreads: buildThreads, buildCalendar: buildCalendar
  };
})(window);
