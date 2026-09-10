#!/usr/bin/env node
/* Regenerate assets/js/data/world.js from Natural Earth via world-atlas.
 *
 *   npm i world-atlas@2 topojson-client@3 i18n-iso-countries
 *   node tools/build-world.js
 *
 * Three things this has to get right, each of which is a visible bug if it doesn't:
 *
 *  1. MERGE, don't overwrite. Several Natural Earth features resolve to the same ISO code
 *     (Australia and Ashmore & Cartier Islands are both AU). Keying a map by ISO and assigning
 *     means the last one wins, which is how the Australian mainland disappears and is replaced
 *     by a one-pixel island.
 *  2. SPLIT AT THE ANTIMERIDIAN. Russia and Fiji have rings with vertices at both +179 and
 *     -179. Projected naively, the edge between them draws a straight line across the entire
 *     map. Each crossing has to be cut and both halves closed along the ±180 meridian.
 *  3. Keep every ring of a multipolygon, not just the first — otherwise island nations lose
 *     most of their territory.
 */
const fs = require('path') && require('fs');
const path = require('path');
const topojson = require('topojson-client');
const iso = require('i18n-iso-countries');

const RES = process.argv[2] || '50m';
const TOL = Number(process.argv[3] || 8);          // Douglas-Peucker tolerance, units of 0.01°
const OUT = path.join(__dirname, '..', 'assets', 'js', 'data', 'world.js');

/* ---------- geometry helpers ---------- */
function perp(p, a, b) {
  const [px, py] = p, [ax, ay] = a, [bx, by] = b;
  const dx = bx - ax, dy = by - ay, m = dx * dx + dy * dy;
  let t = m ? ((px - ax) * dx + (py - ay) * dy) / m : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
function simplify(pts, tol) {
  if (pts.length < 4) return pts;
  const keep = new Array(pts.length).fill(false);
  keep[0] = keep[pts.length - 1] = true;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    let mi = -1, md = 0;
    for (let i = s + 1; i < e; i++) {
      const d = perp(pts[i], pts[s], pts[e]);
      if (d > md) { md = d; mi = i; }
    }
    if (md > tol) { keep[mi] = true; stack.push([s, mi], [mi, e]); }
  }
  return pts.filter((_, i) => keep[i]);
}
function area(pts) {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    a += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
  }
  return Math.abs(a / 2);
}

/* Cut a ring wherever consecutive vertices jump across the antimeridian, closing each piece
   along the ±180 meridian so both halves still fill correctly. Coordinates are degrees. */
function splitAntimeridian(ring) {
  let crosses = false;
  for (let i = 1; i < ring.length; i++) {
    if (Math.abs(ring[i][0] - ring[i - 1][0]) > 180) { crosses = true; break; }
  }
  if (!crosses) return [ring];

  const pieces = [];
  let cur = [ring[0]];
  for (let i = 1; i < ring.length; i++) {
    const a = ring[i - 1], b = ring[i];
    if (Math.abs(b[0] - a[0]) > 180) {
      // shift b into a's frame to interpolate the latitude at the meridian
      const bShift = [b[0] + (b[0] < a[0] ? 360 : -360), b[1]];
      const edge = a[0] < bShift[0] ? 180 : -180;
      const t = (edge - a[0]) / (bShift[0] - a[0]);
      const latAt = a[1] + (b[1] - a[1]) * t;
      cur.push([edge, latAt]);
      pieces.push(cur);
      cur = [[-edge, latAt], b];
    } else {
      cur.push(b);
    }
  }
  pieces.push(cur);
  return pieces.filter((p) => p.length >= 4);
}

/* ---------- build ---------- */
const topo = require(`world-atlas/countries-${RES}.json`);
const geo = topojson.feature(topo, topo.objects.countries);

const byId = new Map();
let unnamed = 0;

for (const f of geo.features) {
  const numeric = (f.id === undefined || f.id === null) ? null : String(f.id).padStart(3, '0');
  const a2 = numeric ? iso.numericToAlpha2(numeric) : null;
  // Features with no ISO mapping (disputed areas, glaciers) get a stable synthetic id rather
  // than colliding on a shared "undefined" key.
  const id = a2 || (numeric ? 'N' + numeric : 'X' + (++unnamed));

  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  const rings = [];
  for (const poly of polys) {
    for (const piece of splitAntimeridian(poly[0])) {
      const pts = [];
      let prev = null;
      for (const [lon, lat] of piece) {
        const x = Math.round(lon * 100), y = Math.round(lat * 100);
        if (prev && prev[0] === x && prev[1] === y) continue;
        pts.push([x, y]); prev = [x, y];
      }
      if (pts.length < 4) continue;
      rings.push(pts);
    }
  }
  if (!rings.length) continue;

  // Merge onto any existing entry for this ISO code instead of replacing it.
  const existing = byId.get(id);
  if (existing) {
    existing.rings.push(...rings);
    if (area(rings[0]) > area(existing.rings[0])) existing.n = f.properties.name;
  } else {
    byId.set(id, { id, n: f.properties.name, rings });
  }
}

const out = [];
for (const rec of byId.values()) {
  // Keep the largest ring whatever its size, drop specks beyond that.
  rec.rings.sort((a, b) => area(b) - area(a));
  const kept = [];
  rec.rings.forEach((pts, i) => {
    if (i > 0 && area(pts) < 250) return;
    let s = simplify(pts, TOL);
    if (s.length < 4) s = pts;
    if (s.length < 4) return;
    kept.push(s.flat());
  });
  if (kept.length) out.push({ id: rec.id, n: rec.n, r: kept });
}
out.sort((a, b) => a.id.localeCompare(b.id));

const json = JSON.stringify(out);
fs.writeFileSync(OUT,
  '// Country outlines: Natural Earth 1:' + RES + ' via world-atlas, Douglas-Peucker simplified.\n' +
  '// Generated by tools/build-world.js — do not hand-edit.\n' +
  '// Rings are split at the antimeridian and features sharing an ISO code are merged.\n' +
  '// Format: [{id: ISO-3166-1 alpha-2, n: name, r: [flat lon/lat pairs x100]}]\n' +
  'window.WORLD_GEOMETRY = ' + json + ';\n');

console.log('wrote', path.relative(process.cwd(), OUT));
console.log('  countries:', out.length, '| rings:', out.reduce((s, c) => s + c.r.length, 0), '| bytes:', json.length);
