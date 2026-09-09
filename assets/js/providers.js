/* Lumen Terminal — data providers.
   DEMO mode uses the built-in deterministic world. LIVE mode calls real APIs.

   Browser CORS reality (this is why the proxy exists):
     - Finnhub and GDELT send permissive CORS headers and work directly from a page.
     - Alpaca's REST API, most news APIs and Etherscan do NOT, so a browser call is blocked
       no matter how valid the key is. Those go through a server-side proxy — deploy the
       included Netlify function and put its path in Settings → Proxy.
   Keys entered in Settings live in this browser's localStorage only. Anything routed through
   the proxy uses keys held in the deploy's environment variables, never the browser's. */
(function (global) {
  'use strict';
  var L = global.Lumen;

  var SPECS = {
    finnhub: { n: 'Finnhub', needsKey: true, cors: true, url: 'https://finnhub.io/api/v1', signup: 'https://finnhub.io/register',
      gives: 'quotes, candles, company news' },
    alpaca: { n: 'Alpaca (paper)', needsKey: true, cors: false, url: 'https://paper-api.alpaca.markets', data: 'https://data.alpaca.markets',
      signup: 'https://alpaca.markets/', gives: 'paper trading, positions, orders, bars' },
    marketaux: { n: 'Marketaux', needsKey: true, cors: false, url: 'https://api.marketaux.com/v1', signup: 'https://www.marketaux.com/',
      gives: 'entity-tagged financial news' },
    gdelt: { n: 'GDELT 2.0', needsKey: false, cors: true, url: 'https://api.gdeltproject.org/api/v2/doc/doc',
      gives: 'global event stream with country tags' },
    etherscan: { n: 'Etherscan', needsKey: true, cors: false, url: 'https://api.etherscan.io/api', signup: 'https://etherscan.io/apis',
      gives: 'wallet balances and transfers' },
    fmp: { n: 'FMP', needsKey: true, cors: false, url: 'https://financialmodelingprep.com/api/v3', signup: 'https://site.financialmodelingprep.com/',
      gives: 'fundamentals, 13F holdings, insider trades' }
  };

  function settings() { return L.state.settings; }
  function key(id) { return (settings().keys || {})[id] || ''; }
  function proxy() { return (settings().proxyBase || '').replace(/\/$/, ''); }
  function isLive() { return settings().mode === 'live'; }

  var status = {};
  function mark(id, ok, note) {
    status[id] = { ok: ok, note: note, at: Date.now() };
    L.bus.emit('provider:status', status);
  }
  function statuses() { return status; }

  /* route a call either direct or through the proxy */
  function call(providerId, path, params, opts) {
    opts = opts || {};
    var spec = SPECS[providerId];
    var qs = Object.keys(params || {}).filter(function (k) { return params[k] !== undefined && params[k] !== null; })
      .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); }).join('&');
    var url, headers = {};

    if (proxy()) {
      url = proxy() + '?provider=' + encodeURIComponent(providerId) + '&path=' + encodeURIComponent(path) + (qs ? '&' + qs : '');
    } else {
      if (!spec.cors) {
        return Promise.reject(new Error(spec.n + ' cannot be called directly from a browser (no CORS headers). ' +
          'Set a proxy in Settings — deploy the bundled netlify/functions/proxy.js and enter /.netlify/functions/proxy.'));
      }
      var base = opts.dataHost && spec.data ? spec.data : spec.url;
      url = base + path + (qs ? (path.indexOf('?') >= 0 ? '&' : '?') + qs : '');
      if (providerId === 'finnhub') headers['X-Finnhub-Token'] = key('finnhub');
    }

    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, opts.timeout || 12000) : null;

    return fetch(url, { headers: headers, signal: ctrl ? ctrl.signal : undefined, method: opts.method || 'GET', body: opts.body })
      .then(function (res) {
        if (timer) clearTimeout(timer);
        if (!res.ok) return res.text().then(function (t) { throw new Error(spec.n + ' ' + res.status + ': ' + t.slice(0, 180)); });
        return res.json();
      })
      .then(function (j) { mark(providerId, true, 'ok'); return j; })
      .catch(function (e) {
        if (timer) clearTimeout(timer);
        mark(providerId, false, e.message);
        throw e;
      });
  }

  /* ---------- quotes ---------- */
  function quote(sym, world) {
    if (!isLive()) return Promise.resolve(global.MARKET.quote(sym, world));
    if (key('finnhub')) {
      return call('finnhub', '/quote', { symbol: sym }).then(function (j) {
        if (j.c === undefined || j.c === 0) throw new Error('no data for ' + sym);
        return {
          t: sym, name: sym, price: j.c, chg: j.d, chgPct: j.dp, open: j.o, high: j.h, low: j.l,
          prevClose: j.pc, ts: (j.t || 0) * 1000, live: true, spark: null
        };
      }).catch(function (e) {
        var q = global.MARKET.quote(sym, world);
        if (q) q.fellBack = e.message;
        return q;
      });
    }
    return Promise.resolve(global.MARKET.quote(sym, world));
  }

  /* ---------- bars ---------- */
  var TF_FINNHUB = { '5m': '5', '15m': '15', '30m': '30', '1h': '60', '4h': '60', '1d': 'D' };
  var TF_ALPACA = { '5m': '5Min', '15m': '15Min', '30m': '30Min', '1h': '1Hour', '4h': '4Hour', '1d': '1Day' };

  function bars(sym, tf, lookbackDays, world) {
    if (!isLive()) return Promise.resolve(global.MARKET.bars(sym, tf, lookbackDays, world));
    var to = Math.floor(Date.now() / 1000), from = to - lookbackDays * 86400;

    if (proxy() && key('alpaca')) {
      return call('alpaca', '/v2/stocks/' + encodeURIComponent(sym) + '/bars', {
        timeframe: TF_ALPACA[tf] || '1Hour',
        start: new Date(from * 1000).toISOString(),
        limit: 10000, adjustment: 'raw', feed: 'iex'
      }, { dataHost: true }).then(function (j) {
        var arr = (j.bars || []).map(function (b) {
          return { t: Date.parse(b.t), o: b.o, h: b.h, l: b.l, c: b.c, v: b.v, imp: 0, ev: 0 };
        });
        if (!arr.length) throw new Error('no bars returned');
        return arr;
      }).catch(function () { return global.MARKET.bars(sym, tf, lookbackDays, world); });
    }
    if (key('finnhub')) {
      return call('finnhub', '/stock/candle', { symbol: sym, resolution: TF_FINNHUB[tf] || '60', from: from, to: to })
        .then(function (j) {
          if (j.s !== 'ok' || !j.t) throw new Error('no candles');
          return j.t.map(function (t, i) {
            return { t: t * 1000, o: j.o[i], h: j.h[i], l: j.l[i], c: j.c[i], v: j.v[i], imp: 0, ev: 0 };
          });
        }).catch(function () { return global.MARKET.bars(sym, tf, lookbackDays, world); });
    }
    return Promise.resolve(global.MARKET.bars(sym, tf, lookbackDays, world));
  }

  /* ---------- news ---------- */
  var MACRO_TERMS = ['tariff', 'sanction', 'opec', 'inflation', 'central bank', 'rate', 'oil', 'gas',
    'export control', 'chip', 'semiconductor', 'strait', 'shipping', 'trade deal', 'stimulus',
    'default', 'bond', 'currency', 'strike', 'supply', 'merger', 'acquisition', 'deficit'];
  var LOCAL_NOISE = ['robbery', 'burglary', 'stabbing', 'crash on', 'local council', 'weather warning',
    'sports', 'celebrity', 'recipe', 'obituary', 'traffic', 'missing dog', 'school board'];

  /* Editorial filter: this terminal only carries market-moving, cross-border news. */
  function isMacro(title, summary) {
    var s = ((title || '') + ' ' + (summary || '')).toLowerCase();
    if (LOCAL_NOISE.some(function (w) { return s.indexOf(w) >= 0; })) return false;
    return MACRO_TERMS.some(function (w) { return s.indexOf(w) >= 0; });
  }

  function news(opts, world) {
    opts = opts || {};
    if (!isLive()) return Promise.resolve((world && world.stories) || []);

    var jobs = [];
    if (key('marketaux') && proxy()) {
      jobs.push(call('marketaux', '/news/all', {
        filter_entities: true, language: 'en', limit: 50,
        api_token: '__PROXY__'
      }).then(function (j) {
        return (j.data || []).map(function (a) {
          return normaliseArticle({
            id: 'mx_' + a.uuid, t: Date.parse(a.published_at), h: a.title, summary: a.description,
            src: (a.source || 'Marketaux'), url: a.url,
            countries: (a.entities || []).map(function (e) { return e.country; }).filter(Boolean),
            tickers: (a.entities || []).map(function (e) { return e.symbol; }).filter(Boolean)
          });
        });
      }).catch(function () { return []; }));
    }
    jobs.push(call('gdelt', '', {
      query: opts.query || '(tariff OR sanctions OR OPEC OR "central bank" OR "export controls" OR "trade deal") sourcelang:english',
      mode: 'ArtList', maxrecords: 60, format: 'json', timespan: opts.timespan || '3d'
    }).then(function (j) {
      return (j.articles || []).map(function (a) {
        return normaliseArticle({
          id: 'gd_' + L.hash(a.url), t: Date.parse(a.seendate ? a.seendate.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, '$1-$2-$3T$4:$5:$6Z') : Date.now()),
          h: a.title, summary: '', src: a.domain, url: a.url,
          countries: a.sourcecountry ? [iso2From(a.sourcecountry)] : [], tickers: []
        });
      });
    }).catch(function () { return []; }));

    return Promise.all(jobs).then(function (lists) {
      var all = [].concat.apply([], lists).filter(function (a) { return a && a.h && isMacro(a.h, a.summary); });
      var seen = {};
      all = all.filter(function (a) { var k = a.h.slice(0, 60); if (seen[k]) return false; seen[k] = 1; return true; });
      all.sort(function (a, b) { return b.t - a.t; });
      if (!all.length) return (world && world.stories) || [];
      return all;
    });
  }

  var GD_ISO = { 'UNITED STATES': 'US', 'CHINA': 'CN', 'RUSSIA': 'RU', 'UNITED KINGDOM': 'GB', 'GERMANY': 'DE',
    'FRANCE': 'FR', 'JAPAN': 'JP', 'INDIA': 'IN', 'IRAN': 'IR', 'ISRAEL': 'IL', 'SAUDI ARABIA': 'SA',
    'TAIWAN': 'TW', 'UKRAINE': 'UA', 'BRAZIL': 'BR', 'CANADA': 'CA', 'AUSTRALIA': 'AU', 'TURKEY': 'TR',
    'SOUTH KOREA': 'KR', 'SINGAPORE': 'SG', 'QATAR': 'QA', 'EGYPT': 'EG', 'NIGERIA': 'NG', 'MEXICO': 'MX' };
  function iso2From(name) { return GD_ISO[String(name || '').toUpperCase()] || null; }

  /* Give a live article the same shape the rest of the app expects, and infer its tags. */
  function normaliseArticle(a) {
    var U2 = global.UNIVERSE;
    var text = ((a.h || '') + ' ' + (a.summary || '')).toLowerCase();
    var countries = (a.countries || []).filter(function (c) { return c && U2.COUNTRIES[c]; });
    for (var ck in U2.COUNTRIES) {
      if (text.indexOf(U2.COUNTRIES[ck].n.toLowerCase()) >= 0 && countries.indexOf(ck) < 0) countries.push(ck);
    }
    var sectors = [], f = {};
    var SECTOR_WORDS = {
      energy: ['oil', 'crude', 'opec', 'refinery', 'lng', 'gas', 'barrel'],
      defense: ['defence', 'defense', 'missile', 'munitions', 'military', 'rearm'],
      semis: ['chip', 'semiconductor', 'foundry', 'wafer', 'euv'],
      shipping: ['shipping', 'freight', 'container', 'tanker', 'port', 'strait', 'canal'],
      banks: ['bank', 'credit', 'lending', 'yield', 'bond', 'rate'],
      mining: ['copper', 'iron ore', 'lithium', 'cobalt', 'nickel', 'rare earth', 'mine'],
      agri: ['wheat', 'grain', 'fertiliser', 'fertilizer', 'harvest', 'food price'],
      autos: ['carmaker', 'vehicle', 'ev ', 'automaker'],
      consumer: ['retail', 'consumer', 'spending', 'sales'],
      tech: ['software', 'cloud', 'ai ', 'platform'],
      utilities: ['power', 'grid', 'electricity', 'nuclear'],
      crypto: ['bitcoin', 'crypto', 'stablecoin', 'ethereum'],
      health: ['pharma', 'drug', 'health'],
      battery: ['battery', 'solar', 'renewable', 'storage'],
      airlines: ['airline', 'flight', 'aviation']
    };
    for (var s in SECTOR_WORDS) {
      if (SECTOR_WORDS[s].some(function (w) { return text.indexOf(w) >= 0; })) sectors.push(s);
    }
    if (/oil|crude|opec|barrel/.test(text)) f.oil = 0.5;
    if (/inflation|cpi|price/.test(text)) f.inflation = 0.45;
    if (/rate|yield|central bank|fed/.test(text)) f.rates = 0.5;
    if (/war|strike|missile|conflict|attack/.test(text)) f.war = 0.6;
    if (/china|beijing/.test(text)) f.china = 0.4;
    if (/tariff|sanction|export control/.test(text)) { f.china = (f.china || 0) - 0.3; f.inflation = (f.inflation || 0) + 0.3; }

    var imp = 2;
    if (/opec|sanction|tariff|strait|central bank|default|invasion/.test(text)) imp = 4;
    if (/hormuz|war|nuclear|blockade|emergency/.test(text)) imp = 5;

    return {
      id: a.id, t: a.t || Date.now(), k: sectors[0] === 'defense' ? 'conflict' : 'macro',
      imp: imp, sim: false, h: a.h, summary: a.summary, src: a.src, url: a.url,
      countries: countries.slice(0, 4), sectors: sectors.slice(0, 3), tickers: a.tickers || [],
      f: f, choke: /hormuz/.test(text) ? 'hormuz' : /suez|red sea/.test(text) ? 'suez' : /malacca/.test(text) ? 'malacca' : null
    };
  }

  /* ---------- on-chain ---------- */
  function onchain(address) {
    if (!isLive() || !key('etherscan')) return Promise.reject(new Error('Etherscan key + proxy required for live on-chain data'));
    return call('etherscan', '', { module: 'account', action: 'balance', address: address, tag: 'latest' })
      .then(function (j) { return { address: address, balanceWei: j.result, balanceEth: Number(j.result) / 1e18 }; });
  }

  /* ---------- Alpaca paper trading ---------- */
  var alpaca = {
    ready: function () { return !!(proxy() && key('alpaca') && key('alpacaSecret')); },
    why: function () {
      if (!key('alpaca') || !key('alpacaSecret')) return 'Add your Alpaca paper key and secret in Settings.';
      if (!proxy()) return 'Alpaca blocks direct browser calls (no CORS). Deploy the bundled proxy function and set its path in Settings.';
      return null;
    },
    account: function () { return call('alpaca', '/v2/account', {}); },
    positions: function () { return call('alpaca', '/v2/positions', {}); },
    orders: function (status) { return call('alpaca', '/v2/orders', { status: status || 'all', limit: 50 }); },
    submit: function (order) {
      return call('alpaca', '/v2/orders', {}, {
        method: 'POST', body: JSON.stringify(order)
      });
    },
    cancel: function (id) { return call('alpaca', '/v2/orders/' + id, {}, { method: 'DELETE' }); }
  };

  global.PROVIDERS = {
    SPECS: SPECS, isLive: isLive, statuses: statuses, proxy: proxy, key: key,
    quote: quote, bars: bars, news: news, onchain: onchain, alpaca: alpaca,
    isMacro: isMacro, normaliseArticle: normaliseArticle, call: call
  };
})(window);
