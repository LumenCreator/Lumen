/* Lumen Terminal — shared UI helpers and the view registry. */
(function (global) {
  'use strict';
  var L = global.Lumen, U = global.UNIVERSE, el = L.el;

  var views = {};
  function register(id, def) { views[id] = def; }
  function get(id) { return views[id]; }

  /* ---------- primitives ---------- */
  function panel(title, opts, body) {
    opts = opts || {};
    var head = el('div', { class: 'pnl-h' }, [
      el('div', { class: 'pnl-t' }, [
        opts.icon ? el('span', { class: 'pnl-i', text: opts.icon }) : null,
        el('span', { text: title }),
        opts.count !== undefined ? el('span', { class: 'pnl-n', text: String(opts.count) }) : null
      ]),
      opts.actions ? el('div', { class: 'pnl-a' }, opts.actions) : null
    ]);
    return el('section', { class: 'pnl ' + (opts.class || ''), id: opts.id }, [
      head, el('div', { class: 'pnl-b ' + (opts.bodyClass || '') }, body || [])
    ]);
  }

  function stat(label, value, opts) {
    opts = opts || {};
    return el('div', { class: 'stat ' + (opts.class || ''), title: opts.title || '' }, [
      el('div', { class: 'stat-l', text: label }),
      el('div', { class: 'stat-v ' + (opts.tone ? 'tone-' + opts.tone : ''), text: value }),
      opts.sub ? el('div', { class: 'stat-s', text: opts.sub }) : null
    ]);
  }

  function badge(text, tone, title) {
    return el('span', { class: 'badge b-' + (tone || 'n'), text: text, title: title || '' });
  }

  function tone(v) { return v > 0 ? 'up' : v < 0 ? 'down' : 'n'; }

  function impactDots(n) {
    var wrap = el('span', { class: 'imp', title: 'impact ' + n + '/5' });
    for (var i = 1; i <= 5; i++) wrap.appendChild(el('i', { class: i <= n ? 'on i' + n : '' }));
    return wrap;
  }

  function simBadge(story) {
    if (!story || story.sim !== true) return null;
    return badge('SIM', 'sim', 'Simulated story from the built-in demo world — not real reporting. Switch to LIVE mode in Settings for real wires.');
  }

  function sectorChip(secId, onClick) {
    var ind = U.findIndustry(secId);
    if (!ind) return null;
    return el('button', {
      class: 'chip sec', style: { borderColor: ind.color + '66', color: ind.color },
      title: ind.n, onclick: onClick ? function () { onClick(secId); } : null
    }, [ind.icon + ' ' + ind.n.split(' —')[0]]);
  }

  function tickerChip(t, onClick) {
    return el('button', { class: 'chip tick', onclick: onClick ? function () { onClick(t); } : null, text: t });
  }

  function countryChip(iso, onClick) {
    var c = U.COUNTRIES[iso];
    return el('button', {
      class: 'chip ctry', onclick: onClick ? function () { onClick(iso); } : null,
      text: c ? c.n : iso, title: c ? U.REGIONS[c.r] : ''
    });
  }

  function sparkline(vals, w, h, color) {
    var cv = el('canvas', { class: 'spark', width: w || 76, height: h || 22, style: { width: (w || 76) + 'px', height: (h || 22) + 'px' } });
    setTimeout(function () { global.CHART.spark(cv, vals, color); }, 0);
    return cv;
  }

  function canvasBox(cls, height, draw) {
    var cv = el('canvas', { class: 'cv ' + (cls || ''), style: { height: (height || 200) + 'px' } });
    var run = function () { try { draw(cv); } catch (e) { console.error(e); } };
    setTimeout(run, 0);
    var ro = null;
    if (window.ResizeObserver) {
      ro = new ResizeObserver(L.debounce(run, 90));
      setTimeout(function () { if (cv.parentNode) ro.observe(cv.parentNode); }, 0);
    }
    cv._redraw = run;
    return cv;
  }

  function table(headers, rows, opts) {
    opts = opts || {};
    var t = el('table', { class: 'tbl ' + (opts.class || '') });
    var thead = el('thead');
    thead.appendChild(el('tr', {}, headers.map(function (h) {
      return el('th', { class: h.align ? 'a-' + h.align : '', style: h.w ? { width: h.w } : null, text: h.t !== undefined ? h.t : h });
    })));
    t.appendChild(thead);
    var tb = el('tbody');
    rows.forEach(function (r) {
      var tr = el('tr', { class: r._class || '', onclick: r._click || null });
      (r.cells || r).forEach(function (c) {
        if (c && c.nodeType) tr.appendChild(el('td', {}, [c]));
        else if (c && typeof c === 'object') tr.appendChild(el('td', { class: (c.align ? 'a-' + c.align : '') + ' ' + (c.class || ''), title: c.title || '' }, [c.node || String(c.t)]));
        else tr.appendChild(el('td', { text: c === null || c === undefined ? '—' : String(c) }));
      });
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    return el('div', { class: 'tbl-w' }, [t]);
  }

  function empty(msg, sub) {
    return el('div', { class: 'empty' }, [el('div', { text: msg }), sub ? el('small', { text: sub }) : null]);
  }

  function bar(pct, tone2) {
    return el('div', { class: 'bar' }, [el('i', { class: 'b-' + (tone2 || 'n'), style: { width: L.M.clamp(pct, 0, 100) + '%' } })]);
  }

  function field(label, control, hint) {
    return el('label', { class: 'fld' }, [
      el('span', { class: 'fld-l', text: label }), control,
      hint ? el('small', { class: 'fld-h', text: hint }) : null
    ]);
  }

  function select(options, value, onChange, cls) {
    var s = el('select', { class: cls || '', onchange: function () { onChange(s.value); } });
    options.forEach(function (o) {
      var v = o.v !== undefined ? o.v : o;
      var n = o.n !== undefined ? o.n : o;
      s.appendChild(el('option', { value: v, text: n, selected: String(v) === String(value) ? 'selected' : null }));
    });
    s.value = value;
    return s;
  }

  function number(value, onChange, opts) {
    opts = opts || {};
    var i = el('input', {
      type: 'number', value: value, step: opts.step || 'any',
      min: opts.min, max: opts.max, class: opts.class || '',
      oninput: L.debounce(function () { onChange(parseFloat(i.value)); }, opts.debounce || 260)
    });
    return i;
  }

  function slider(value, min, max, step, onChange, fmt) {
    var out = el('b', { class: 'sld-v', text: fmt ? fmt(value) : String(value) });
    var i = el('input', {
      type: 'range', min: min, max: max, step: step, value: value,
      oninput: function () {
        out.textContent = fmt ? fmt(parseFloat(i.value)) : i.value;
        onChange(parseFloat(i.value));
      }
    });
    return el('div', { class: 'sld' }, [i, out]);
  }

  function toggleRow(items, active, onPick) {
    var wrap = el('div', { class: 'seg' });
    items.forEach(function (it) {
      var v = it.v !== undefined ? it.v : it;
      var n = it.n !== undefined ? it.n : it;
      wrap.appendChild(el('button', {
        class: 'seg-b' + (String(v) === String(active) ? ' on' : ''),
        text: n, title: it.title || '',
        onclick: function () { onPick(v); }
      }));
    });
    return wrap;
  }

  /* ---------- toast ---------- */
  function toast(msg, tone2, ms) {
    var host = L.$('#toasts') || document.body;
    var t = el('div', { class: 'toast t-' + (tone2 || 'n'), text: msg });
    host.appendChild(t);
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 350); }, ms || 3600);
  }

  /* ---------- modal ---------- */
  function modal(title, body, opts) {
    opts = opts || {};
    var back = el('div', { class: 'modal-back', onclick: function (e) { if (e.target === back) close(); } });
    function close() { back.remove(); }
    var box = el('div', { class: 'modal ' + (opts.class || '') }, [
      el('div', { class: 'modal-h' }, [
        el('b', { text: title }),
        el('button', { class: 'x', text: '✕', onclick: close })
      ]),
      el('div', { class: 'modal-b' }, body),
      opts.footer ? el('div', { class: 'modal-f' }, opts.footer) : null
    ]);
    back.appendChild(box);
    document.body.appendChild(back);
    return { close: close, box: box };
  }

  global.UI = {
    register: register, get: get, views: views,
    panel: panel, stat: stat, badge: badge, tone: tone, impactDots: impactDots, simBadge: simBadge,
    sectorChip: sectorChip, tickerChip: tickerChip, countryChip: countryChip,
    sparkline: sparkline, canvasBox: canvasBox, table: table, empty: empty, bar: bar,
    field: field, select: select, number: number, slider: slider, toggleRow: toggleRow,
    toast: toast, modal: modal
  };
})(window);
