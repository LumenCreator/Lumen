/* Lumen Terminal — command bar.
   Accepts terse commands ("bt nvda 15m 3m") and near-english ("link tsla to crude oil",
   "what if iran closes hormuz"). Unknown input falls back to entity lookup. */
(function (global) {
  'use strict';
  var L = global.Lumen, U = global.UNIVERSE, C = global.CASCADE;

  var HELP = [
    { c: 'link <a> to <b>', d: 'Correlation + mechanism + narrative between any two entities', ex: 'link tsla to crudeoil' },
    { c: 'scan <entity>', d: 'Everything most connected to one entity', ex: 'scan hormuz' },
    { c: 'bt <sym> [tf] [period]', d: 'Run the FVG backtest', ex: 'bt nvda 15m 3m' },
    { c: 'fvg <sym> [tf] [period]', d: 'Same as bt — gap statistics and strategy', ex: 'fvg cl=f 1h 6m' },
    { c: 'cascade <seed> [severity]', d: 'Propagate a shock through the causal graph', ex: 'cascade me_conflict 0.8' },
    { c: 'what if <text>', d: 'Match free text to the closest scenario seed and run it', ex: 'what if iran closes hormuz' },
    { c: 'map <country>', d: 'Focus the world map', ex: 'map iran' },
    { c: 'chart <sym> [tf]', d: 'Open a symbol in the chart', ex: 'chart xom 1h' },
    { c: 'watch <sym>', d: 'Add to the watchlist', ex: 'watch lmt' },
    { c: 'unwatch <sym>', d: 'Remove from the watchlist', ex: 'unwatch spy' },
    { c: 'sector <id>', d: 'Show an industry and its global leaders', ex: 'sector defense' },
    { c: 'whales [asset]', d: 'Large-holder flow ledger', ex: 'whales btc' },
    { c: 'risk <sym> <entry> <stop>', d: 'Position size from your account risk settings', ex: 'risk nvda 178 172' },
    { c: 'news [country|sector]', d: 'Filter the wire', ex: 'news energy' },
    { c: 'go <view>', d: 'desk | cascade | backtest | links | whales | book', ex: 'go cascade' },
    { c: 'help', d: 'This list', ex: 'help' }
  ];

  var PERIODS = { '1m': 30, '3m': 90, '6m': 180, '1y': 365, '2y': 730, '1w': 7, '2w': 14 };
  var TFS = ['5m', '15m', '30m', '1h', '4h', '1d'];

  function parse(input) {
    var raw = String(input || '').trim();
    if (!raw) return null;
    var s = raw.toLowerCase();
    var parts = raw.split(/\s+/);
    var cmd = parts[0].toLowerCase();

    /* link a to b  /  link a b  /  a vs b */
    var m = s.match(/^link\s+(.+?)\s+(?:to|with|and|vs|against)\s+(.+)$/);
    if (m) return { k: 'link', a: m[1], b: m[2] };
    m = s.match(/^(.+?)\s+vs\.?\s+(.+)$/);
    if (m && !TFS.includes(m[1])) return { k: 'link', a: m[1], b: m[2] };
    if (cmd === 'link' && parts.length === 3) return { k: 'link', a: parts[1], b: parts[2] };

    if (cmd === 'scan' && parts[1]) return { k: 'scan', a: parts.slice(1).join(' ') };

    if (cmd === 'bt' || cmd === 'fvg' || cmd === 'backtest') {
      var sym = parts[1], tf = null, days = null;
      parts.slice(2).forEach(function (p) {
        var q = p.toLowerCase();
        if (TFS.indexOf(q) >= 0) tf = q;
        else if (PERIODS[q]) days = PERIODS[q];
        else if (/^\d+d$/.test(q)) days = parseInt(q, 10);
      });
      if (!sym) return { k: 'error', msg: 'Usage: bt <symbol> [timeframe] [period] — e.g. bt nvda 15m 3m' };
      return { k: 'backtest', sym: sym.toUpperCase(), tf: tf || '15m', days: days || 90 };
    }

    if (cmd === 'cascade' || cmd === 'scenario') {
      var seed = parts[1], sev = parseFloat(parts[2]);
      if (!seed) return { k: 'goto', view: 'cascade' };
      var node = C.NODE_BY_ID[seed] ? seed : matchSeed(parts.slice(1).join(' '));
      if (!node) return { k: 'error', msg: 'No scenario matches "' + parts.slice(1).join(' ') + '". Seeds: ' + C.seeds().map(function (n) { return n.id; }).join(', ') };
      return { k: 'cascade', seed: node, sev: isNaN(sev) ? 0.65 : L.M.clamp(sev, 0.05, 1) };
    }

    if (/^(what if|whatif|if)\b/.test(s)) {
      var text = s.replace(/^(what if|whatif|if)\s+/, '');
      var seed2 = matchSeed(text);
      if (!seed2) return { k: 'error', msg: 'Could not match "' + text + '" to a scenario. Try: ' + C.seeds().map(function (n) { return n.id; }).join(', ') };
      var sev2 = /severe|major|full|closes|blockade|war/.test(text) ? 0.85 : /minor|limited|threat/.test(text) ? 0.4 : 0.65;
      return { k: 'cascade', seed: seed2, sev: sev2 };
    }

    if (cmd === 'map' && parts[1]) return { k: 'map', q: parts.slice(1).join(' ') };
    if (cmd === 'chart' && parts[1]) return { k: 'chart', sym: parts[1].toUpperCase(), tf: TFS.indexOf((parts[2] || '').toLowerCase()) >= 0 ? parts[2].toLowerCase() : null };
    if (cmd === 'watch' && parts[1]) return { k: 'watch', sym: parts[1].toUpperCase() };
    if (cmd === 'unwatch' && parts[1]) return { k: 'unwatch', sym: parts[1].toUpperCase() };
    if (cmd === 'sector' && parts[1]) return { k: 'sector', id: parts[1].toLowerCase() };
    if (cmd === 'whales') return { k: 'whales', asset: parts[1] ? parts[1].toUpperCase() : null };
    if (cmd === 'news') return { k: 'news', q: parts.slice(1).join(' ') };
    if (cmd === 'go' && parts[1]) return { k: 'goto', view: parts[1].toLowerCase() };
    if (cmd === 'help' || cmd === '?') return { k: 'help' };
    if (cmd === 'risk' && parts.length >= 4) {
      return { k: 'risk', sym: parts[1].toUpperCase(), entry: parseFloat(parts[2]), stop: parseFloat(parts[3]) };
    }

    /* bare entity */
    var ent = global.LINKER.resolve(raw);
    if (ent) return { k: 'entity', ent: ent };
    return { k: 'error', msg: 'Unrecognised: "' + raw + '". Type help for the command list.' };
  }

  function matchSeed(text) {
    var t = String(text).toLowerCase();
    var kw = [
      { id: 'me_conflict', w: ['iran', 'israel', 'hormuz', 'middle east', 'gulf', 'strait', 'saudi', 'opec attack', 'tehran'] },
      { id: 'taiwan_crisis', w: ['taiwan', 'strait of taiwan', 'tsmc', 'blockade', 'china invasion', 'semiconductor war'] },
      { id: 'russia_escalation', w: ['russia', 'ukraine', 'nato', 'baltic', 'black sea', 'moscow'] },
      { id: 'tariff_shock', w: ['tariff', 'trade war', 'export control', 'sanction', 'customs', 'duties'] },
      { id: 'china_stimulus', w: ['stimulus', 'china package', 'pboc', 'property support', 'beijing spends'] },
      { id: 'rate_shock', w: ['rate', 'fed', 'inflation', 'cpi', 'hike', 'hawkish', 'yields'] },
      { id: 'credit_event', w: ['credit', 'default', 'bank fail', 'lehman', 'liquidity crisis', 'blow up'] },
      { id: 'cyber_infra', w: ['cyber', 'hack', 'ransomware', 'grid attack', 'pipeline attack'] }
    ];
    var best = null, bestScore = 0;
    kw.forEach(function (k) {
      var sc = 0;
      k.w.forEach(function (w) { if (t.indexOf(w) >= 0) sc += w.length; });
      if (sc > bestScore) { bestScore = sc; best = k.id; }
    });
    if (best) return best;
    /* fall back to matching the cascade node names */
    var ids = Object.keys(C.NODE_BY_ID);
    for (var i = 0; i < ids.length; i++) {
      if (C.NODE_BY_ID[ids[i]].n.toLowerCase().indexOf(t) >= 0) return ids[i];
    }
    return null;
  }

  /* ---------- suggestions ---------- */
  function suggest(input) {
    var s = String(input || '').trim().toLowerCase();
    if (!s) return HELP.slice(0, 7).map(function (h) { return { t: h.ex, d: h.d, k: 'cmd' }; });
    var out = [];
    HELP.forEach(function (h) {
      if (h.c.indexOf(s.split(' ')[0]) === 0 || h.c.indexOf(s) >= 0) out.push({ t: h.ex, d: h.d, k: 'cmd' });
    });
    var last = s.split(/\s+/).pop();
    if (last.length >= 1) {
      U.allLeaders().forEach(function (l) {
        if (out.length > 16) return;
        if (l.t.toLowerCase().indexOf(last) === 0 || l.n.toLowerCase().indexOf(last) === 0) {
          out.push({ t: l.t, d: l.n + ' · ' + l.sectorName.split(' —')[0], k: 'ticker' });
        }
      });
      U.MACRO.forEach(function (mm) {
        if (out.length > 20) return;
        if (mm.t.toLowerCase().indexOf(last) === 0 || mm.n.toLowerCase().indexOf(last) >= 0) {
          out.push({ t: mm.t, d: mm.n, k: 'macro' });
        }
      });
      Object.keys(U.COUNTRIES).forEach(function (c) {
        if (out.length > 24) return;
        if (U.COUNTRIES[c].n.toLowerCase().indexOf(last) === 0) out.push({ t: U.COUNTRIES[c].n, d: 'country', k: 'country' });
      });
      C.seeds().forEach(function (n) {
        if (out.length > 28) return;
        if (n.id.indexOf(last) >= 0 || n.n.toLowerCase().indexOf(last) >= 0) {
          out.push({ t: 'cascade ' + n.id, d: n.n, k: 'scenario' });
        }
      });
    }
    return out.slice(0, 12);
  }

  global.TERMINAL = { parse: parse, suggest: suggest, HELP: HELP, matchSeed: matchSeed, PERIODS: PERIODS, TFS: TFS };
})(window);
