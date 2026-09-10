/* Lumen Terminal — alert rules.
 *
 * Rules are evaluated against the current world whenever it changes and on a timer. Firing is
 * rate-limited per rule so a condition that stays true does not spam; a rule re-arms once its
 * condition has been false for a full cooldown.
 *
 * Delivery is in-app by default. Browser notifications are opt-in and only requested when the
 * user turns them on — never on page load. There is no server, so nothing fires while the tab
 * is closed; that limitation is stated in the UI rather than papered over.
 */
(function (global) {
  'use strict';
  var L = global.Lumen, M = L.M, F = L.F;

  var KEY = 'lumen.alerts.v1';
  var LOGKEY = 'lumen.alertlog.v1';

  var KINDS = {
    exhaustion: {
      n: 'Exhaustion / late-stage move', icon: '🔺',
      d: 'Fires when a symbol is high in its own range AND has been extended for a while. This is the "who is left to buy" warning — it is designed to fire before the level rather than at it.',
      defaults: { rank: 0.88, extBars: 4 },
      fields: [
        { k: 'sym', n: 'Symbol', type: 'sym' },
        { k: 'rank', n: 'Percentile above', type: 'num', min: 0.5, max: 1, step: 0.01 },
        { k: 'extBars', n: 'Bars extended', type: 'num', min: 1, max: 60, step: 1 }
      ]
    },
    level: {
      n: 'Price level', icon: '📏',
      d: 'A plain price cross, with the historical context attached so you see what that level has meant before.',
      defaults: { price: 0, dir: 'above' },
      fields: [
        { k: 'sym', n: 'Symbol', type: 'sym' },
        { k: 'price', n: 'Price', type: 'num' },
        { k: 'dir', n: 'Direction', type: 'pick', opts: ['above', 'below'] }
      ]
    },
    anomaly: {
      n: 'Behaviour anomaly', icon: '🎣',
      d: 'Fires on a sweep, climax, churn or unexplained-volume pattern above your severity threshold.',
      defaults: { severity: 0.5, detector: 'any' },
      fields: [
        { k: 'sym', n: 'Symbol', type: 'sym' },
        { k: 'detector', n: 'Pattern', type: 'pick', opts: ['any', 'sweep', 'climax', 'churn', 'unexplained', 'absorbed', 'gapfade'] },
        { k: 'severity', n: 'Min severity', type: 'num', min: 0.1, max: 1, step: 0.05 }
      ]
    },
    crowding: {
      n: 'Crowded positioning', icon: '👥',
      d: 'Fires when the positioning composite gets stretched in either direction.',
      defaults: { threshold: 0.6 },
      fields: [
        { k: 'sym', n: 'Symbol', type: 'sym' },
        { k: 'threshold', n: 'Absolute score above', type: 'num', min: 0.2, max: 1, step: 0.05 }
      ]
    },
    news: {
      n: 'Catalyst in the wire', icon: '📡',
      d: 'Fires when a story of the chosen class lands at or above an impact threshold.',
      defaults: { cls: 'conflict', imp: 4 },
      fields: [
        { k: 'cls', n: 'Class', type: 'pick', opts: ['any', 'conflict', 'energy', 'monetary', 'trade', 'supplychain', 'policy', 'sovereign', 'climate'] },
        { k: 'imp', n: 'Min impact', type: 'num', min: 1, max: 5, step: 1 }
      ]
    },
    disaster: {
      n: 'Disaster response trigger', icon: '🌊',
      d: 'Fires on a climate or conflict story in a chosen country, and opens the matching response playbook with its buy list.',
      defaults: { country: 'AU', imp: 4 },
      fields: [
        { k: 'country', n: 'Country', type: 'country' },
        { k: 'imp', n: 'Min impact', type: 'num', min: 1, max: 5, step: 1 }
      ]
    }
  };

  function load() {
    try {
      var raw = JSON.parse(localStorage.getItem(KEY));
      if (raw && raw.length) return raw;
    } catch (e) { /* fall through to defaults */ }
    return defaults();
  }
  function defaults() {
    return [
      { id: L.uid('a'), kind: 'exhaustion', enabled: true, cooldownH: 24, sym: 'CL=F', rank: 0.88, extBars: 4 },
      { id: L.uid('a'), kind: 'exhaustion', enabled: true, cooldownH: 24, sym: 'NVDA', rank: 0.90, extBars: 5 },
      { id: L.uid('a'), kind: 'anomaly', enabled: true, cooldownH: 12, sym: 'SPY', detector: 'any', severity: 0.55 },
      { id: L.uid('a'), kind: 'news', enabled: true, cooldownH: 6, cls: 'conflict', imp: 5 },
      { id: L.uid('a'), kind: 'disaster', enabled: true, cooldownH: 24, country: 'AU', imp: 4 }
    ];
  }
  var rules = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(rules)); } catch (e) { /* private mode */ } }

  function loadLog() {
    try { return JSON.parse(localStorage.getItem(LOGKEY)) || []; } catch (e) { return []; }
  }
  var log = loadLog();
  function saveLog() {
    try { localStorage.setItem(LOGKEY, JSON.stringify(log.slice(0, 120))); } catch (e) { /* private mode */ }
  }

  function add(kind) {
    var spec = KINDS[kind];
    if (!spec) return null;
    var r = Object.assign({ id: L.uid('a'), kind: kind, enabled: true, cooldownH: 12, sym: 'SPY' }, spec.defaults);
    rules.push(r); save();
    return r;
  }
  function remove(id) { rules = rules.filter(function (r) { return r.id !== id; }); save(); }
  function update(id, patch) {
    rules.forEach(function (r) { if (r.id === id) Object.assign(r, patch); });
    save();
  }
  function all() { return rules; }
  function history() { return log; }
  function clearLog() { log = []; saveLog(); L.bus.emit('alerts'); }

  /* ---------- evaluation ---------- */
  function evaluate(world, opts) {
    opts = opts || {};
    var fired = [];
    var now = Date.now();

    rules.forEach(function (r) {
      if (!r.enabled) return;
      var cool = (r.cooldownH || 12) * 3600e3;
      if (r.lastFired && now - r.lastFired < cool) return;
      var hit = null;
      try { hit = testRule(r, world); } catch (e) { hit = null; }
      if (!hit) return;
      r.lastFired = now;
      var entry = {
        id: L.uid('f'), ruleId: r.id, kind: r.kind, t: now,
        title: hit.title, body: hit.body, tone: hit.tone || 'warn',
        sym: r.sym || null, action: hit.action || null, data: hit.data || null
      };
      fired.push(entry);
      log.unshift(entry);
    });

    if (fired.length) {
      save(); saveLog();
      L.bus.emit('alerts', fired);
      if (!opts.silent) fired.forEach(notify);
    }
    return fired;
  }

  function testRule(r, world) {
    if (r.kind === 'news' || r.kind === 'disaster') return testStoryRule(r, world);

    var sym = r.sym;
    if (!sym) return null;
    var bars = global.MARKET.bars(sym, '1d', 400, world);
    if (!bars || bars.length < 60) return null;
    var last = bars[bars.length - 1];

    if (r.kind === 'level') {
      if (!r.price) return null;
      var prev = bars[bars.length - 2];
      var crossedUp = r.dir === 'above' && prev.c < r.price && last.c >= r.price;
      var crossedDn = r.dir === 'below' && prev.c > r.price && last.c <= r.price;
      if (!crossedUp && !crossedDn) return null;
      var ex = global.MICRO.exhaustion(bars);
      return {
        title: sym + ' crossed ' + F.num(r.price, 2) + ' (' + r.dir + ')',
        body: 'Now at the ' + (ex.rank * 100).toFixed(0) + 'th percentile of its ' + ex.lookback + '-bar range. ' + (ex.read[0] || ''),
        tone: r.dir === 'above' ? 'warn' : 'i',
        action: { view: 'analysis', sym: sym }, data: { rank: ex.rank }
      };
    }

    if (r.kind === 'exhaustion') {
      var e = global.MICRO.exhaustion(bars);
      if (!e) return null;
      if (e.rank < (r.rank || 0.88)) return null;
      if (e.extendedBars < (r.extBars || 4)) return null;
      var mid = e.horizons[1] || e.horizons[0];
      return {
        title: sym + ' is late in its range — potential sell zone',
        body: F.num(last.c, 2) + ' is the ' + (e.rank * 100).toFixed(0) + 'th percentile, extended ' + e.extendedBars + ' bars. ' +
          (mid && mid.n >= 12 ? 'From comparable levels it was lower ' + ((1 - mid.pUp) * 100).toFixed(0) + '% of the time over ' + mid.h + ' bars (n=' + mid.n + ').'
            : 'Too few comparable instances to give a base rate.'),
        tone: 'warn',
        action: { view: 'analysis', sym: sym }, data: { rank: e.rank, extendedBars: e.extendedBars }
      };
    }

    if (r.kind === 'anomaly') {
      var an = global.MICRO.anomalies(bars, sym, world);
      var recent = an.events.filter(function (ev) {
        return ev.i >= bars.length - 3 && ev.severity >= (r.severity || 0.5) &&
          (r.detector === 'any' || !r.detector || ev.kind === r.detector);
      });
      if (!recent.length) return null;
      var ev = recent[0];
      return {
        title: sym + ': ' + ev.n + ' ' + ev.icon,
        body: ev.note + ' — a pattern consistent with this behaviour, not proof of it.',
        tone: 'warn',
        action: { view: 'analysis', sym: sym }, data: { kind: ev.kind, severity: ev.severity }
      };
    }

    if (r.kind === 'crowding') {
      var cr = global.MICRO.crowding(bars, sym, world);
      if (!cr || Math.abs(cr.score) < (r.threshold || 0.6)) return null;
      return {
        title: sym + ': ' + cr.label.toLowerCase(),
        body: cr.read,
        tone: cr.score > 0 ? 'warn' : 'i',
        action: { view: 'analysis', sym: sym }, data: { score: cr.score }
      };
    }
    return null;
  }

  function testStoryRule(r, world) {
    var since = Date.now() - 12 * 3600e3;
    var stories = ((world && world.stories) || []).filter(function (s) { return s.t >= since; });
    if (r.kind === 'news') {
      var m = stories.filter(function (s) {
        return s.imp >= (r.imp || 4) && (r.cls === 'any' || !r.cls || s.k === r.cls);
      });
      if (!m.length) return null;
      return {
        title: 'Catalyst: ' + m[0].h,
        body: m[0].src + ' · impact ' + m[0].imp + '/5' + (m.length > 1 ? ' · ' + (m.length - 1) + ' more in the last 12h' : ''),
        tone: m[0].imp >= 5 ? 'down' : 'warn',
        action: { view: 'desk' }, data: { storyId: m[0].id }
      };
    }
    /* disaster */
    var country = r.country || 'AU';
    var hit = stories.filter(function (s) {
      return s.imp >= (r.imp || 4) && (s.countries || []).indexOf(country) >= 0 &&
        (s.k === 'climate' || s.k === 'conflict');
    })[0];
    if (!hit) return null;
    var pbId = hit.k === 'climate' ? guessDisaster(hit.h) : 'quake';
    return {
      title: 'Response trigger — ' + ((global.UNIVERSE.COUNTRIES[country] || {}).n || country),
      body: hit.h + ' — opening the ' + pbId + ' response playbook and its phased buy list.',
      tone: 'down',
      action: { view: 'flows', tab: 'disaster', playbook: pbId, country: country },
      data: { storyId: hit.id }
    };
  }

  function guessDisaster(text) {
    var t = String(text).toLowerCase();
    if (/flood|rain|surge|deluge|water level/.test(t)) return 'flood';
    if (/cyclone|hurricane|typhoon|storm|hail|wind/.test(t)) return 'cyclone';
    if (/fire|blaze|bushfire|wildfire|burn/.test(t)) return 'bushfire';
    if (/quake|tsunami|seismic|tremor/.test(t)) return 'quake';
    if (/drought|heat|dry|water restriction/.test(t)) return 'drought';
    return 'flood';
  }

  /* ---------- browser notifications (opt-in) ---------- */
  var notifyEnabled = false;
  function setNotify(on) {
    if (!on) { notifyEnabled = false; return Promise.resolve(false); }
    if (typeof Notification === 'undefined') return Promise.resolve(false);
    return Notification.requestPermission().then(function (p) {
      notifyEnabled = p === 'granted';
      return notifyEnabled;
    }).catch(function () { return false; });
  }
  function canNotify() { return notifyEnabled && typeof Notification !== 'undefined' && Notification.permission === 'granted'; }
  function notify(entry) {
    if (!canNotify()) return;
    try { new Notification('Lumen — ' + entry.title, { body: entry.body, tag: entry.ruleId }); }
    catch (e) { /* some browsers require a service worker; in-app alert still shows */ }
  }

  global.ALERTS = {
    KINDS: KINDS, all: all, add: add, remove: remove, update: update,
    evaluate: evaluate, history: history, clearLog: clearLog,
    setNotify: setNotify, canNotify: canNotify, guessDisaster: guessDisaster,
    reset: function () { rules = defaults(); save(); }
  };
})(window);
