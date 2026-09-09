/* Lumen Terminal — link analysis.
   Answers "how is A connected to B?" three independent ways and reconciles them:
     1. MECHANISM  — paths through a structural graph (ownership, inputs, geography, policy)
     2. STATISTICS — rolling correlation, beta and lead/lag on daily returns
     3. NARRATIVE  — co-occurrence in the news corpus, incl. deals / trades / mergers
   Agreement between the three is what makes a link tradeable; disagreement is the signal
   that a correlation is spurious. */
(function (global) {
  'use strict';
  var L = global.Lumen, U = global.UNIVERSE, C = global.CASCADE, M = L.M;

  var FACTORS = ['oil', 'rates', 'usd', 'war', 'china', 'consumer', 'inflation'];
  var FACTOR_NAMES = {
    oil: 'Crude oil complex', rates: 'Interest rates', usd: 'US dollar', war: 'Conflict risk',
    china: 'China demand', consumer: 'Consumer spending', inflation: 'Inflation'
  };

  /* ---------- entity resolution ---------- */
  var ALIASES = {
    'crudeoil': 'CL=F', 'crude': 'CL=F', 'oil': 'CL=F', 'wti': 'CL=F', 'brent': 'BZ=F',
    'natgas': 'NG=F', 'naturalgas': 'NG=F', 'gas': 'NG=F', 'ttf': 'TTF',
    'gold': 'GC=F', 'copper': 'HG=F', 'wheat': 'ZW=F', 'lithium': 'LI', 'uranium': 'URA',
    'bitcoin': 'BTC', 'btc': 'BTC', 'ether': 'ETH', 'ethereum': 'ETH',
    'yields': 'US10Y', '10y': 'US10Y', 'rates': 'US10Y', 'dollar': 'DXY', 'dxy': 'DXY',
    'vix': 'VIX', 'vol': 'VIX', 'spx': 'SPY', 'sp500': 'SPY', 'nasdaq': 'QQQ',
    'freight': 'BDI', 'tankers': 'TNKR',
    'tesla': 'TSLA', 'nvidia': 'NVDA', 'apple': 'AAPL', 'microsoft': 'MSFT', 'exxon': 'XOM',
    'lockheed': 'LMT', 'tsmc': 'TSM', 'aramco': '2222.SR', 'shell': 'SHEL', 'chevron': 'CVX'
  };

  function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9=.]/g, ''); }

  function resolve(q) {
    var raw = String(q || '').trim();
    if (!raw) return null;
    var n = norm(raw), up = raw.toUpperCase();

    if (ALIASES[n]) return resolve(ALIASES[n]);

    var e = U.findEntity(up);
    if (e) return { type: e.macro ? 'macro' : 'ticker', id: e.t, n: e.n, e: e };

    /* country by ISO or name */
    if (U.COUNTRIES[up]) return { type: 'country', id: up, n: U.COUNTRIES[up].n };
    for (var ck in U.COUNTRIES) {
      if (norm(U.COUNTRIES[ck].n) === n) return { type: 'country', id: ck, n: U.COUNTRIES[ck].n };
    }
    /* sector */
    for (var i = 0; i < U.INDUSTRIES.length; i++) {
      var ind = U.INDUSTRIES[i];
      if (ind.id === n || norm(ind.n).indexOf(n) === 0) return { type: 'sector', id: ind.id, n: ind.n };
    }
    /* factor */
    if (FACTORS.indexOf(n) >= 0) return { type: 'factor', id: n, n: FACTOR_NAMES[n] };
    /* chokepoint */
    for (var j = 0; j < U.CHOKEPOINTS.length; j++) {
      if (U.CHOKEPOINTS[j].id === n || norm(U.CHOKEPOINTS[j].n).indexOf(n) >= 0) {
        return { type: 'choke', id: U.CHOKEPOINTS[j].id, n: U.CHOKEPOINTS[j].n };
      }
    }
    /* cascade node */
    if (C.NODE_BY_ID[n]) return { type: 'event', id: n, n: C.NODE_BY_ID[n].n };
    for (var k in C.NODE_BY_ID) {
      if (norm(C.NODE_BY_ID[k].n).indexOf(n) >= 0 && n.length > 3) return { type: 'event', id: k, n: C.NODE_BY_ID[k].n };
    }
    /* partial company-name match */
    var L2 = U.allLeaders();
    for (var m = 0; m < L2.length; m++) {
      if (norm(L2[m].n).indexOf(n) === 0 && n.length > 2) return { type: 'ticker', id: L2[m].t, n: L2[m].n, e: L2[m] };
    }
    return null;
  }

  /* ---------- structural graph ---------- */
  var _graph = null, _alias = {};
  function graph() {
    if (_graph) return _graph;
    var nodes = {}, adj = {};
    function node(key, label, type, meta) {
      if (!nodes[key]) { nodes[key] = { key: key, n: label, type: type, meta: meta || {} }; adj[key] = []; }
      return nodes[key];
    }
    function link(a, b, w, why, kind) {
      if (!nodes[a] || !nodes[b] || a === b) return;
      adj[a].push({ to: b, w: w, why: why, kind: kind });
      adj[b].push({ to: a, w: w, why: why, kind: kind });
    }

    FACTORS.forEach(function (f) { node('F:' + f, FACTOR_NAMES[f], 'factor'); });
    for (var ck in U.COUNTRIES) node('C:' + ck, U.COUNTRIES[ck].n, 'country', { iso: ck });
    /* what actually moves through each chokepoint — a blanket oil link would make the Taiwan
       Strait look like an energy asset and produce nonsense paths */
    var CHOKE_F = {
      hormuz: { oil: 0.92, war: 0.75, inflation: 0.45 },
      suez: { oil: 0.45, war: 0.6, inflation: 0.45, consumer: -0.3 },
      malacca: { china: 0.75, oil: 0.5, war: 0.55 },
      taiwan: { china: 0.8, war: 0.85 },
      bosphorus: { inflation: 0.5, war: 0.6, oil: 0.35 },
      panama: { consumer: -0.3, inflation: 0.35 },
      danish: { oil: 0.4, war: 0.4 },
      gibraltar: { oil: 0.25, inflation: 0.2 }
    };
    U.CHOKEPOINTS.forEach(function (cp) {
      node('K:' + cp.id, cp.n, 'choke', cp);
      cp.at.forEach(function (c) { if (U.COUNTRIES[c]) link('K:' + cp.id, 'C:' + c, 0.72, cp.n + ' borders or serves ' + U.COUNTRIES[c].n + ' — ' + cp.flow, 'geography'); });
      var cf = CHOKE_F[cp.id] || { war: cp.sev * 0.6 };
      for (var f in cf) {
        if (FACTORS.indexOf(f) < 0) continue;
        link('K:' + cp.id, 'F:' + f, Math.abs(cf[f]) * cp.sev, cp.n + ' carries ' + cp.flow + ' — a disruption transmits through ' + FACTOR_NAMES[f].toLowerCase() + '.', 'chokepoint');
      }
    });

    U.MACRO.forEach(function (mm) {
      node('T:' + mm.t, mm.n, 'macro', mm);
      var exp = global.MARKET ? global.MARKET.exposure(mm.t) : {};
      for (var f in exp) {
        if (FACTORS.indexOf(f) < 0) continue;
        link('T:' + mm.t, 'F:' + f, Math.min(0.95, Math.abs(exp[f])), mm.n + ' loads ' + (exp[f] > 0 ? 'positively' : 'negatively') + ' on ' + FACTOR_NAMES[f] + '.', 'exposure');
      }
    });

    U.INDUSTRIES.forEach(function (ind) {
      node('S:' + ind.id, ind.n, 'sector', ind);
      for (var f in ind.exp) {
        if (FACTORS.indexOf(f) < 0) continue;
        link('S:' + ind.id, 'F:' + f, Math.min(0.95, Math.abs(ind.exp[f])), ind.n + ' has a ' + (ind.exp[f] > 0 ? 'positive' : 'negative') + ' beta of ' + ind.exp[f].toFixed(2) + ' to ' + FACTOR_NAMES[f] + '.', 'exposure');
      }
      ind.leaders.forEach(function (l) {
        node('T:' + l.t, l.n, 'ticker', l);
        link('T:' + l.t, 'S:' + ind.id, 0.90, l.n + ' is a constituent of ' + ind.n + '. ' + (l.note || ''), 'membership');
        if (U.COUNTRIES[l.c]) link('T:' + l.t, 'C:' + l.c, 0.62, l.n + ' is domiciled in ' + U.COUNTRIES[l.c].n + ' — exposed to its policy, tax and currency regime.', 'domicile');
      });
    });

    /* country export exposure → factors and commodities */
    var EXPORT_F = {
      crude: ['F:oil', 0.85], lng: ['F:oil', 0.6], gas: ['F:oil', 0.55],
      wheat: ['F:inflation', 0.6], agri: ['F:inflation', 0.5], soy: ['F:inflation', 0.45],
      'rare-earths': ['F:china', 0.7], batteries: ['F:china', 0.6], solar: ['F:china', 0.55],
      manufacturing: ['F:china', 0.5], foundry: ['F:china', 0.5], semis: ['F:china', 0.45],
      copper: ['F:china', 0.7], iron: ['F:china', 0.75], nickel: ['F:china', 0.6],
      lithium: ['F:china', 0.5], cobalt: ['F:china', 0.55], coal: ['F:china', 0.5],
      defense: ['F:war', 0.7], finance: ['F:rates', 0.6], 'sovereign-fund': ['F:usd', 0.45],
      hormuz: ['F:oil', 0.9], suez: ['F:oil', 0.5], straits: ['F:oil', 0.45],
      autos: ['F:consumer', 0.6], luxury: ['F:consumer', 0.7], tourism: ['F:consumer', 0.6],
      pharma: ['F:consumer', 0.3], tech: ['F:rates', 0.5], services: ['F:consumer', 0.4]
    };
    for (var cc in U.COUNTRIES) {
      (U.COUNTRIES[cc].ex || []).forEach(function (x) {
        var m = EXPORT_F[x];
        if (m) link('C:' + cc, m[0], m[1] * 0.8, U.COUNTRIES[cc].n + ' is a major exporter of ' + x + ', tying it to ' + nodes[m[0]].n + '.', 'trade');
      });
    }

    /* Cascade mechanisms become graph edges too. Cascade sector nodes (s_energy, ...) are the
       same thing as the industry nodes, so alias rather than duplicate them. */
    var alias = {};
    C.NODES.forEach(function (cn) { if (cn.sec) alias['E:' + cn.id] = 'S:' + cn.sec; });
    function A(k) { return alias[k] || k; }
    C.NODES.forEach(function (cn) {
      if (cn.sec) return;   /* aliased onto S:<sector> */
      node('E:' + cn.id, cn.n, 'event', cn);
      (cn.c || []).forEach(function (c) { if (U.COUNTRIES[c]) link('E:' + cn.id, 'C:' + c, 0.55, cn.n + ' is centred on ' + U.COUNTRIES[c].n + '.', 'geography'); });
      (cn.px || []).forEach(function (t) { link('E:' + cn.id, 'T:' + t, 0.80, cn.n + ' is expressed directly in ' + t + '.', 'instrument'); });
      if (cn.choke) link('E:' + cn.id, 'K:' + cn.choke, 0.85, cn.n + ' is a chokepoint event.', 'chokepoint');
    });
    C.EDGES.forEach(function (e) {
      link(A('E:' + e[0]), A('E:' + e[1]), M.clamp(e[2] * e[4], 0.05, 0.95), e[6], 'causal');
    });
    _alias = alias;

    _graph = { nodes: nodes, adj: adj };
    return _graph;
  }

  function keyFor(ent) {
    if (!ent) return null;
    graph();
    var k = ({ ticker: 'T:', macro: 'T:', country: 'C:', sector: 'S:', factor: 'F:', choke: 'K:', event: 'E:' }[ent.type] || 'T:') + ent.id;
    return _alias[k] || k;
  }

  /* ---------- k best paths (weight = product of edge strengths) ---------- */
  function paths(aKey, bKey, k, maxLen) {
    var g = graph();
    if (!g.nodes[aKey] || !g.nodes[bKey]) return [];
    k = k || 6; maxLen = maxLen || 5;
    var found = [], bestAt = {};
    var stack = [{ at: aKey, path: [aKey], edges: [], w: 1, seen: {} }];
    stack[0].seen[aKey] = true;
    var guard = 0;
    while (stack.length && guard++ < 90000) {
      var cur = stack.pop();
      if (cur.at === bKey) { found.push(cur); continue; }
      if (cur.path.length > maxLen) continue;
      var edges = g.adj[cur.at] || [];
      /* strongest edges first, and prune obviously weak branches */
      edges = edges.slice().sort(function (x, y) { return x.w - y.w; });
      for (var i = 0; i < edges.length; i++) {
        var e = edges[i];
        if (cur.seen[e.to]) continue;
        var w = cur.w * e.w;
        if (w < 0.02) continue;
        var kk = e.to + '@' + cur.path.length;
        if (bestAt[kk] && bestAt[kk] > w * 1.6) continue;
        bestAt[kk] = Math.max(bestAt[kk] || 0, w);
        var seen = Object.create(cur.seen); seen[e.to] = true;
        stack.push({ at: e.to, path: cur.path.concat([e.to]), edges: cur.edges.concat([e]), w: w, seen: seen });
      }
    }
    found.sort(function (x, y) { return y.w - x.w; });
    /* de-duplicate paths that share the same node set */
    var out = [], sigs = {};
    for (var j = 0; j < found.length && out.length < k; j++) {
      var sig = found[j].path.slice(1, -1).sort().join('|');
      if (sigs[sig]) continue;
      sigs[sig] = 1;
      out.push({
        w: found[j].w,
        hops: found[j].path.length - 1,
        nodes: found[j].path.map(function (p) { return g.nodes[p]; }),
        edges: found[j].edges
      });
    }
    return out;
  }

  /* ---------- statistics ---------- */
  /* equal-weight index of a list of {t} */
  function basket(list, days, world) {
    var comps = list.map(function (l) { return global.MARKET.closeSeries(l.t, days, world); })
      .filter(function (c) { return c && c.length > 5; });
    if (!comps.length) return null;
    var len = Math.min.apply(null, comps.map(function (c) { return c.length; }));
    var out = [];
    for (var i = 0; i < len; i++) {
      var acc = 0;
      comps.forEach(function (c) {
        var o = c[c.length - len];
        acc += c[c.length - len + i].c / (o.c || 1);
      });
      out.push({ t: comps[0][comps[0].length - len + i].t, c: acc / comps.length * 100 });
    }
    return out;
  }

  function priceSeries(ent, days, world) {
    if (!global.MARKET) return null;
    if (ent.type === 'ticker' || ent.type === 'macro') return global.MARKET.closeSeries(ent.id, days, world);
    if (ent.type === 'sector') {
      var ind = U.findIndustry(ent.id);
      return ind ? basket(ind.leaders.slice(0, 5), days, world) : null;
    }
    if (ent.type === 'country') {
      /* proxy a country with its own listed leaders; fall back to its export exposure basket */
      var ls = U.allLeaders().filter(function (l) { return l.c === ent.id; }).slice(0, 5);
      if (!ls.length) {
        var meta = U.COUNTRIES[ent.id];
        var proxyBy = { crude: 'CL=F', lng: 'NG=F', gas: 'NG=F', wheat: 'ZW=F', iron: 'HG=F',
          copper: 'HG=F', lithium: 'LI', cobalt: 'LI', nickel: 'LI', coal: 'HG=F',
          gold: 'GC=F', platinum: 'GC=F', hormuz: 'CL=F', suez: 'CL=F', straits: 'CL=F',
          soy: 'ZW=F', agri: 'ZW=F', 'rare-earths': 'HG=F', batteries: 'LI', uranium: 'URA' };
        var px = (meta && meta.ex || []).map(function (x) { return proxyBy[x]; }).filter(Boolean);
        if (!px.length) return null;
        ls = px.filter(function (v, i, a) { return a.indexOf(v) === i; }).map(function (t) { return { t: t }; });
      }
      return basket(ls, days, world);
    }
    if (ent.type === 'choke') {
      var cp = U.CHOKEPOINTS.filter(function (x) { return x.id === ent.id; })[0];
      if (!cp) return null;
      return basket([{ t: 'CL=F' }, { t: 'TNKR' }, { t: 'BDI' }], days, world);
    }
    if (ent.type === 'factor') {
      var byFactor = { oil: 'CL=F', rates: 'US10Y', usd: 'DXY', war: 'GC=F', china: 'HG=F', consumer: 'SPY', inflation: 'ZW=F' };
      return byFactor[ent.id] ? global.MARKET.closeSeries(byFactor[ent.id], days, world) : null;
    }
    return null;
  }

  function stats(entA, entB, days, world) {
    var a = priceSeries(entA, days, world), b = priceSeries(entB, days, world);
    if (!a || !b || a.length < 20 || b.length < 20) return null;
    var n = Math.min(a.length, b.length);
    var ra = M.returns(a.slice(-n).map(function (x) { return x.c; }));
    var rb = M.returns(b.slice(-n).map(function (x) { return x.c; }));
    var corr = M.pearson(ra, rb);
    var w = Math.min(30, Math.floor(ra.length / 3));
    var rolling = [];
    for (var i = w; i <= ra.length; i++) {
      rolling.push({ t: a[a.length - n + i].t, c: M.pearson(ra.slice(i - w, i), rb.slice(i - w, i)) });
    }
    var varB = M.stdev(rb); var beta = varB ? corr * (M.stdev(ra) / varB) : 0;
    /* lead-lag: which series' move shows up in the other first */
    var lags = [];
    for (var lag = -5; lag <= 5; lag++) {
      var x = [], y = [];
      for (var j = 0; j < ra.length; j++) {
        var jj = j + lag;
        if (jj < 0 || jj >= rb.length) continue;
        x.push(ra[j]); y.push(rb[jj]);
      }
      lags.push({ lag: lag, c: M.pearson(x, y) });
    }
    var best = lags.slice().sort(function (p, q) { return Math.abs(q.c) - Math.abs(p.c); })[0];
    return {
      corr: corr, beta: beta, n: ra.length, window: w, rolling: rolling,
      recent: rolling.length ? rolling[rolling.length - 1].c : corr,
      min: Math.min.apply(null, rolling.map(function (x) { return x.c; }).concat([corr])),
      max: Math.max.apply(null, rolling.map(function (x) { return x.c; }).concat([corr])),
      lags: lags, bestLag: best,
      stable: M.stdev(rolling.map(function (x) { return x.c; })) < 0.22
    };
  }

  /* ---------- narrative ---------- */
  function tagsFor(ent) {
    var t = { tickers: [], countries: [], sectors: [] };
    if (ent.type === 'ticker' || ent.type === 'macro') {
      t.tickers.push(ent.id);
      var e = U.findEntity(ent.id);
      if (e && e.sector) t.sectors.push(e.sector);
      if (e && e.c) t.countries.push(e.c);
    } else if (ent.type === 'country') t.countries.push(ent.id);
    else if (ent.type === 'sector') t.sectors.push(ent.id);
    else if (ent.type === 'choke') {
      var cp = U.CHOKEPOINTS.filter(function (x) { return x.id === ent.id; })[0];
      if (cp) t.countries = cp.at.slice();
    } else if (ent.type === 'event') {
      var cn = C.NODE_BY_ID[ent.id];
      if (cn) { t.countries = (cn.c || []).slice(); if (cn.sec) t.sectors.push(cn.sec); (cn.px || []).forEach(function (p) { t.tickers.push(p); }); }
    } else if (ent.type === 'factor') {
      U.INDUSTRIES.forEach(function (ind) { if (Math.abs(ind.exp[ent.id] || 0) > 0.5) t.sectors.push(ind.id); });
    }
    return t;
  }
  function matches(story, tags) {
    var hit = [];
    tags.tickers.forEach(function (x) { if ((story.tickers || []).indexOf(x) >= 0) hit.push('ticker:' + x); });
    tags.countries.forEach(function (x) { if ((story.countries || []).indexOf(x) >= 0) hit.push('country:' + x); });
    tags.sectors.forEach(function (x) { if ((story.sectors || []).indexOf(x) >= 0) hit.push('sector:' + x); });
    return hit;
  }
  function narrative(entA, entB, stories) {
    var ta = tagsFor(entA), tb = tagsFor(entB);
    var both = [], onlyA = 0, onlyB = 0;
    (stories || []).forEach(function (s) {
      var ha = matches(s, ta), hb = matches(s, tb);
      if (ha.length && hb.length) both.push({ s: s, ha: ha, hb: hb });
      else if (ha.length) onlyA++;
      else if (hb.length) onlyB++;
    });
    both.sort(function (x, y) { return (y.s.imp - x.s.imp) || (y.s.t - x.s.t); });
    var deals = both.filter(function (x) { return ['corporate', 'trade', 'policy'].indexOf(x.s.k) >= 0; });
    var total = (stories || []).length || 1;
    var pA = (both.length + onlyA) / total, pB = (both.length + onlyB) / total;
    var lift = (pA * pB) > 0 ? (both.length / total) / (pA * pB) : 0;
    return { coStories: both, deals: deals, count: both.length, lift: lift, onlyA: onlyA, onlyB: onlyB };
  }

  /* ---------- verdict ---------- */
  function analyse(qa, qb, opts) {
    opts = opts || {};
    var world = opts.world, stories = (world && world.stories) || [];
    var days = opts.days || 90;
    var A = resolve(qa), B = resolve(qb);
    if (!A) return { error: 'Could not resolve "' + qa + '". Try a ticker (TSLA), a commodity (crude, gold), a country (Iran), a sector (semis) or an event (hormuz_risk).' };
    if (!B) return { error: 'Could not resolve "' + qb + '".' };
    if (keyFor(A) === keyFor(B)) return { error: 'Both sides resolve to the same entity.' };

    var ps = paths(keyFor(A), keyFor(B), 6, 5);
    var st = stats(A, B, days, world);
    var nr = narrative(A, B, stories);

    /* score each channel 0..1 */
    var mech = ps.length ? M.clamp(ps[0].w * 1.6, 0, 1) : 0;
    var statScore = st ? M.clamp(Math.abs(st.corr) * 1.25, 0, 1) : 0;
    var narrScore = M.clamp(Math.log(1 + nr.count) / Math.log(26), 0, 1) * M.clamp(nr.lift / 2.2, 0.15, 1);
    var strength = Math.round((mech * 0.42 + statScore * 0.33 + narrScore * 0.25) * 100);

    var dir = st ? (st.corr >= 0 ? 'positive' : 'inverse') : 'undetermined';
    var read = [];
    if (ps[0] && ps[0].hops <= 3 && mech > 0.45) {
      read.push('They are structurally close — ' + ps[0].hops + ' hops: ' + describePath(ps[0]) + '.');
    } else if (ps[0] && mech > 0.25) {
      read.push('The link is indirect. The strongest route is ' + ps[0].hops + ' hops and runs through ' +
        ps[0].nodes.slice(1, -1).map(function (x) { return x.n; }).join(' → ') +
        ' — the transmission is real but it is diluted at every step.');
    } else {
      read.push('No strong structural path was found; anything you see in the price is more likely shared beta to the broad market than a direct relationship.');
    }

    if (st) {
      read.push('Realised ' + days + '-day correlation is ' + st.corr.toFixed(2) + ' (' + dir + '), ' +
        (st.stable ? 'and it has been stable' : 'but it has swung between ' + st.min.toFixed(2) + ' and ' + st.max.toFixed(2) + ', so it is regime-dependent') + '.');
      /* lag > 0 correlates A(t) with B(t+lag): A is the leader. Only worth saying when the
         lagged fit is both material and clearly better than the contemporaneous one. */
      if (st.bestLag && st.bestLag.lag !== 0 &&
          Math.abs(st.bestLag.c) > 0.25 && Math.abs(st.bestLag.c) > Math.abs(st.corr) * 1.15) {
        var leader = st.bestLag.lag > 0 ? A.n : B.n;
        var follower = st.bestLag.lag > 0 ? B.n : A.n;
        read.push(leader + ' moves first in this window: its returns fit ' + follower + '\u2019s ' +
          Math.abs(st.bestLag.lag) + ' day(s) later at r=' + st.bestLag.c.toFixed(2) +
          ', against ' + st.corr.toFixed(2) + ' same-day. With ' + st.n + ' observations treat that as a hint, not a signal.');
      }
    }
    if (nr.count) {
      read.push(nr.count + ' stories in the window touch both, ' +
        (nr.lift > 1.6 ? 'well above what independence would produce (lift ' + nr.lift.toFixed(1) + '×) — they are being reported as one story'
          : 'about what you would expect by chance (lift ' + nr.lift.toFixed(1) + '×)') + '.');
    } else read.push('No story in the window mentions both — the link is structural, not yet a narrative.');
    if (nr.deals.length) read.push(nr.deals.length + ' of those are deal, trade or policy items — the channel most likely to produce a re-rating.');

    var verdict = strength >= 62 ? 'STRONG' : strength >= 38 ? 'MODERATE' : strength >= 18 ? 'WEAK' : 'NEGLIGIBLE';
    var agree = (mech > 0.45 ? 1 : 0) + (statScore > 0.45 ? 1 : 0) + (narrScore > 0.35 ? 1 : 0);

    return {
      a: A, b: B, paths: ps, stats: st, narrative: nr,
      scores: { mechanism: mech, statistical: statScore, narrative: narrScore },
      strength: strength, verdict: verdict, agreement: agree, direction: dir, read: read, days: days
    };
  }

  function describePath(p) {
    if (!p) return '';
    return p.nodes.map(function (x) { return x.n; }).join(' → ');
  }

  /* ---------- broad scan: what is most connected to X? ---------- */
  function scan(q, opts) {
    opts = opts || {};
    var A = resolve(q);
    if (!A) return { error: 'Could not resolve "' + q + '".' };
    var g = graph(), src = keyFor(A);
    /* one-pass weighted spread from the source */
    var score = {}, cur = {}, seen = {};
    cur[src] = 1; seen[src] = true;
    for (var d = 0; d < 3; d++) {
      var next = {};
      for (var k in cur) {
        (g.adj[k] || []).forEach(function (e) {
          var w = cur[k] * e.w * 0.72;
          if (w < 0.03) return;
          next[e.to] = Math.max(next[e.to] || 0, w);
          score[e.to] = Math.max(score[e.to] || 0, w);
        });
      }
      cur = next;
    }
    var out = Object.keys(score).filter(function (k) { return k !== src; })
      .map(function (k) { return { key: k, node: g.nodes[k], w: score[k] }; })
      .sort(function (x, y) { return y.w - x.w; });
    return { a: A, ranked: out };
  }

  global.LINKER = {
    resolve: resolve, graph: graph, paths: paths, analyse: analyse, scan: scan,
    keyFor: keyFor, describePath: describePath, FACTOR_NAMES: FACTOR_NAMES
  };
})(window);
