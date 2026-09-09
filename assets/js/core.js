/* Lumen Terminal — core runtime: store, event bus, deterministic RNG, formatting, DOM helpers. */
(function (global) {
  'use strict';

  /* ---------- deterministic RNG (mulberry32) ---------- */
  function hashStr(s) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    var a = typeof seed === 'string' ? hashStr(seed) : (seed >>> 0);
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(r) {
    var u = 0, v = 0;
    while (u === 0) u = r();
    while (v === 0) v = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /* ---------- math ---------- */
  var M = {
    clamp: function (v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; },
    lerp: function (a, b, t) { return a + (b - a) * t; },
    sum: function (a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s; },
    mean: function (a) { return a.length ? M.sum(a) / a.length : 0; },
    stdev: function (a) {
      if (a.length < 2) return 0;
      var m = M.mean(a), s = 0;
      for (var i = 0; i < a.length; i++) s += (a[i] - m) * (a[i] - m);
      return Math.sqrt(s / (a.length - 1));
    },
    median: function (a) {
      if (!a.length) return 0;
      var b = a.slice().sort(function (x, y) { return x - y; });
      var m = b.length >> 1;
      return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2;
    },
    quantile: function (a, q) {
      if (!a.length) return 0;
      var b = a.slice().sort(function (x, y) { return x - y; });
      var p = (b.length - 1) * q, lo = Math.floor(p), hi = Math.ceil(p);
      return lo === hi ? b[lo] : M.lerp(b[lo], b[hi], p - lo);
    },
    pearson: function (x, y) {
      var n = Math.min(x.length, y.length);
      if (n < 3) return 0;
      var mx = M.mean(x.slice(0, n)), my = M.mean(y.slice(0, n));
      var sxy = 0, sxx = 0, syy = 0;
      for (var i = 0; i < n; i++) {
        var dx = x[i] - mx, dy = y[i] - my;
        sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
      }
      var d = Math.sqrt(sxx * syy);
      return d === 0 ? 0 : sxy / d;
    },
    returns: function (series) {
      var out = [];
      for (var i = 1; i < series.length; i++) {
        var p = series[i - 1], c = series[i];
        out.push(p ? (c - p) / p : 0);
      }
      return out;
    }
  };

  /* ---------- formatting ---------- */
  var F = {
    num: function (v, dp) {
      if (v === null || v === undefined || isNaN(v)) return '—';
      return Number(v).toLocaleString('en-US', {
        minimumFractionDigits: dp === undefined ? 2 : dp,
        maximumFractionDigits: dp === undefined ? 2 : dp
      });
    },
    usd: function (v, dp) { return (v < 0 ? '-$' : '$') + F.num(Math.abs(v), dp === undefined ? 2 : dp); },
    compact: function (v) {
      if (v === null || v === undefined || isNaN(v)) return '—';
      var s = v < 0 ? '-' : '', a = Math.abs(v);
      if (a >= 1e12) return s + (a / 1e12).toFixed(2) + 'T';
      if (a >= 1e9) return s + (a / 1e9).toFixed(2) + 'B';
      if (a >= 1e6) return s + (a / 1e6).toFixed(2) + 'M';
      if (a >= 1e3) return s + (a / 1e3).toFixed(1) + 'K';
      return s + a.toFixed(0);
    },
    usdc: function (v) { return (v < 0 ? '-$' : '$') + F.compact(Math.abs(v)); },
    pct: function (v, dp) {
      if (v === null || v === undefined || isNaN(v)) return '—';
      return (v >= 0 ? '+' : '') + v.toFixed(dp === undefined ? 2 : dp) + '%';
    },
    pctRaw: function (v, dp) {
      if (v === null || v === undefined || isNaN(v)) return '—';
      return v.toFixed(dp === undefined ? 1 : dp) + '%';
    },
    signed: function (v, dp) { return (v >= 0 ? '+' : '') + F.num(v, dp); },
    date: function (d) {
      var x = (d instanceof Date) ? d : new Date(d);
      return x.toISOString().slice(0, 10);
    },
    time: function (d) {
      var x = (d instanceof Date) ? d : new Date(d);
      return x.toISOString().slice(11, 16) + 'Z';
    },
    ago: function (d) {
      var x = (d instanceof Date) ? d : new Date(d);
      var s = (Date.now() - x.getTime()) / 1000;
      if (s < 60) return Math.max(0, Math.round(s)) + 's';
      if (s < 3600) return Math.round(s / 60) + 'm';
      if (s < 86400) return Math.round(s / 3600) + 'h';
      return Math.round(s / 86400) + 'd';
    },
    dur: function (bars, tf) {
      var mins = { '5m': 5, '15m': 15, '1h': 60, '4h': 240, '1d': 1440 }[tf] || 60;
      var t = bars * mins;
      if (t < 60) return t + 'm';
      if (t < 1440) return (t / 60).toFixed(1) + 'h';
      return (t / 1440).toFixed(1) + 'd';
    },
    ticker: function (s) { return String(s || '').toUpperCase(); }
  };

  /* ---------- DOM ---------- */
  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
        var v = attrs[k];
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class') n.className = v;
        else if (k === 'text') n.textContent = v;
        else if (k === 'html') n.innerHTML = v;
        else if (k === 'style' && typeof v === 'object') { for (var s in v) n.style[s] = v[s]; }
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') n.addEventListener(k.slice(2), v);
        else if (k.slice(0, 5) === 'data-') n.setAttribute(k, v);
        else n.setAttribute(k, v);
      }
    }
    if (children) {
      (Array.isArray(children) ? children : [children]).forEach(function (c) {
        if (c === null || c === undefined || c === false) return;
        n.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
      });
    }
    return n;
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }
  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ---------- event bus ---------- */
  var handlers = {};
  var bus = {
    on: function (ev, fn) {
      (handlers[ev] || (handlers[ev] = [])).push(fn);
      return function () { bus.off(ev, fn); };
    },
    off: function (ev, fn) {
      if (!handlers[ev]) return;
      handlers[ev] = handlers[ev].filter(function (f) { return f !== fn; });
    },
    emit: function (ev, payload) {
      (handlers[ev] || []).forEach(function (f) {
        try { f(payload); } catch (e) { console.error('[bus:' + ev + ']', e); }
      });
    }
  };

  /* ---------- persisted settings ---------- */
  var SKEY = 'lumen.settings.v1';
  var defaults = {
    mode: 'demo',                 // 'demo' | 'live'
    proxyBase: '',                // e.g. /.netlify/functions/proxy
    keys: { alpaca: '', alpacaSecret: '', finnhub: '', marketaux: '', etherscan: '', fmp: '' },
    account: { equity: 100000, riskPerTrade: 1.0, maxPositions: 8, maxSectorPct: 30 },
    watchlist: ['SPY', 'NVDA', 'TSLA', 'XOM', 'LMT', 'GC=F', 'CL=F', 'BTC'],
    filters: { region: 'ALL', sector: 'ALL', minImpact: 2 },
    projection: 'robinson',
    ackedDisclaimer: false
  };
  function deepMerge(base, over) {
    var out = {};
    for (var k in base) out[k] = base[k];
    for (var j in over) {
      if (over[j] && typeof over[j] === 'object' && !Array.isArray(over[j]) && base[j] && typeof base[j] === 'object' && !Array.isArray(base[j])) {
        out[j] = deepMerge(base[j], over[j]);
      } else if (over[j] !== undefined) out[j] = over[j];
    }
    return out;
  }
  function loadSettings() {
    try {
      var raw = localStorage.getItem(SKEY);
      return raw ? deepMerge(defaults, JSON.parse(raw)) : deepMerge(defaults, {});
    } catch (e) { return deepMerge(defaults, {}); }
  }
  function saveSettings(s) {
    try { localStorage.setItem(SKEY, JSON.stringify(s)); } catch (e) { /* private mode */ }
  }

  /* ---------- app state ---------- */
  var state = {
    settings: loadSettings(),
    view: 'desk',
    focusCountry: null,     // ISO-2
    focusStory: null,       // story id
    selectedSymbol: 'NVDA',
    scenario: null,         // active cascade run
    clock: new Date(),
    live: { ok: false, note: 'demo dataset' }
  };
  function setSetting(path, value) {
    var parts = path.split('.'), o = state.settings;
    for (var i = 0; i < parts.length - 1; i++) o = o[parts[i]];
    o[parts[parts.length - 1]] = value;
    saveSettings(state.settings);
    bus.emit('settings', state.settings);
  }

  /* ---------- misc ---------- */
  function debounce(fn, ms) {
    var t;
    return function () {
      var self = this, args = arguments;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms || 150);
    };
  }
  function uid(prefix) { return (prefix || 'id') + '_' + Math.random().toString(36).slice(2, 9); }
  function dayKey(d) { return F.date(d); }
  function weekdayName(d) {
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][(d instanceof Date ? d : new Date(d)).getUTCDay()];
  }
  function copy(text) {
    try {
      if (navigator.clipboard) return navigator.clipboard.writeText(text);
    } catch (e) { /* noop */ }
    return Promise.resolve();
  }

  global.Lumen = {
    rng: rng, gauss: gauss, hash: hashStr,
    M: M, F: F,
    el: el, $: $, $$: $$, clear: clear, esc: esc,
    bus: bus, state: state, setSetting: setSetting, saveSettings: function () { saveSettings(state.settings); },
    debounce: debounce, uid: uid, dayKey: dayKey, weekdayName: weekdayName, copy: copy
  };
})(window);
