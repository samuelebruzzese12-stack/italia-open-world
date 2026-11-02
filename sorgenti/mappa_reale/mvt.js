/* Italia Open World — mappa reale: lettura delle tile vettoriali (Mapbox Vector Tile 2.1, schema OpenMapTiles),
   ritaglio sui bordi della tile e riempimento di poligoni su griglia. Nessuna libreria esterna. */
'use strict';
const TXD = new TextDecoder();
function Pbf(b) { this.b = b; this.p = 0; this.e = b.length; this.dv = new DataView(b.buffer, b.byteOffset, b.byteLength) }
Pbf.prototype.varint = function () { const b = this.b; let v = 0, m = 1, c; do { c = b[this.p++]; v += (c & 0x7f) * m; m *= 128 } while (c & 0x80); return v };
Pbf.prototype.svarint = function () { const n = this.varint(); return n % 2 === 1 ? -(n + 1) / 2 : n / 2 };
Pbf.prototype.str = function () { const l = this.varint(), s = TXD.decode(this.b.subarray(this.p, this.p + l)); this.p += l; return s };
Pbf.prototype.skip = function (w) { if (w === 0) this.varint(); else if (w === 1) this.p += 8; else if (w === 2) { const l = this.varint(); this.p += l } else if (w === 5) this.p += 4; else throw new Error('tipo di campo pbf ' + w) };
function mvtValue(pb, end) { let v = null; while (pb.p < end) { const t = pb.varint(), f = t >> 3, w = t & 7;
  if (f === 1) v = pb.str(); else if (f === 2) { v = pb.dv.getFloat32(pb.p, true); pb.p += 4 } else if (f === 3) { v = pb.dv.getFloat64(pb.p, true); pb.p += 8 }
  else if (f === 4 || f === 5) v = pb.varint(); else if (f === 6) v = pb.svarint(); else if (f === 7) v = !!pb.varint(); else pb.skip(w) } return v }
// decodifica: { nome_strato: { ext, n, feat(i) -> {type, props, geom} } } con decodifica pigra degli oggetti
function decodeMVT(buf) {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf), pb = new Pbf(b), L = {};
  while (pb.p < pb.e) { const t = pb.varint(), f = t >> 3, w = t & 7;
    if (f === 3 && w === 2) { const l = pb.varint(), end = pb.p + l, ly = { name: '', ext: 4096, keys: [], vals: [], fs: [] };
      while (pb.p < end) { const t2 = pb.varint(), f2 = t2 >> 3, w2 = t2 & 7;
        if (f2 === 1) ly.name = pb.str(); else if (f2 === 2) { const l2 = pb.varint(); ly.fs.push(pb.p, pb.p + l2); pb.p += l2 }
        else if (f2 === 3) ly.keys.push(pb.str()); else if (f2 === 4) { const l2 = pb.varint(), e2 = pb.p + l2; ly.vals.push(mvtValue(pb, e2)); pb.p = e2 }
        else if (f2 === 5) ly.ext = pb.varint(); else pb.skip(w2) }
      pb.p = end; ly.n = ly.fs.length / 2; ly.feat = i => mvtFeature(b, ly, ly.fs[i * 2], ly.fs[i * 2 + 1]); L[ly.name] = ly }
    else pb.skip(w) }
  return L }
function mvtFeature(b, ly, start, end) {
  const pb = new Pbf(b); pb.p = start; let type = 0, tags = null, gs = 0, ge = 0, id = 0;
  while (pb.p < end) { const t = pb.varint(), f = t >> 3, w = t & 7;
    if (f === 1) id = pb.varint(); else if (f === 2) { const l = pb.varint(), e = pb.p + l; tags = []; while (pb.p < e) tags.push(pb.varint()) }
    else if (f === 3) type = pb.varint(); else if (f === 4) { const l = pb.varint(); gs = pb.p; ge = pb.p + l; pb.p = ge } else pb.skip(w) }
  const props = {}; if (tags) for (let i = 0; i + 1 < tags.length; i += 2) props[ly.keys[tags[i]]] = ly.vals[tags[i + 1]];
  // geometria: elenco di parti; ogni parte è un array piatto [x0,y0,x1,y1,...] (anelli senza il punto di chiusura)
  const parts = []; pb.p = gs; let x = 0, y = 0, cur = null;
  while (pb.p < ge) { const ci = pb.varint(), cmd = ci & 7, cnt = ci >> 3;
    if (cmd === 1) { for (let k = 0; k < cnt; k++) { x += pb.svarint(); y += pb.svarint(); cur = [x, y]; parts.push(cur) } }
    else if (cmd === 2) { for (let k = 0; k < cnt; k++) { x += pb.svarint(); y += pb.svarint(); cur.push(x, y) } }
    else if (cmd === 7) { /* chiusura dell'anello: implicita */ } }
  return { id, type, props, parts } }
// area con segno (formula del geometra) in coordinate della tile (y in basso): positiva = anello esterno
function ringArea(r) { let a = 0; const n = r.length; for (let i = 0, j = n - 2; i < n; j = i, i += 2) a += (r[j] * r[i + 1] - r[i] * r[j + 1]); return a / 2 }
// poligoni: [[esterno, buco, buco...], ...]
function polygons(parts) { const out = []; let cur = null;
  for (const r of parts) { if (r.length < 6) continue; const a = ringArea(r); if (a === 0) continue;
    if (a > 0 || !cur) { cur = [r]; out.push(cur) } else cur.push(r) }
  return out }
// ritaglio di un anello sul quadrato [lo,hi]² (Sutherland–Hodgman); i punti sul bordo hanno coordinate esatte lo/hi
function clipRing(r, lo, hi) {
  let pts = r; for (let e = 0; e < 4; e++) { const out = [], n = pts.length; if (n < 6) return out;
    const ax = e === 0 || e === 1, lim = e === 0 || e === 2 ? lo : hi, inn = (px, py) => { const v = ax ? px : py; return e === 0 || e === 2 ? v >= lim : v <= lim };
    for (let i = 0; i < n; i += 2) { const j = (i + 2) % n, px = pts[i], py = pts[i + 1], qx = pts[j], qy = pts[j + 1], pi = inn(px, py), qi = inn(qx, qy);
      if (pi) out.push(px, py);
      if (pi !== qi) { if (ax) { const t = (lim - px) / (qx - px); out.push(lim, py + (qy - py) * t) } else { const t = (lim - py) / (qy - py); out.push(px + (qx - px) * t, lim) } } }
    pts = out }
  return pts }
// ritaglio di una linea sul quadrato (Liang–Barsky per segmento): restituisce più polilinee
function clipLine(l, lo, hi) { const out = []; let cur = null;
  for (let i = 0; i + 3 < l.length; i += 2) { let x0 = l[i], y0 = l[i + 1], x1 = l[i + 2], y1 = l[i + 3], t0 = 0, t1 = 1; const dx = x1 - x0, dy = y1 - y0; let ok = true;
    for (const [p, q] of [[-dx, x0 - lo], [dx, hi - x0], [-dy, y0 - lo], [dy, hi - y0]]) { if (p === 0) { if (q < 0) { ok = false; break } } else { const r = q / p; if (p < 0) { if (r > t1) { ok = false; break } if (r > t0) t0 = r } else { if (r < t0) { ok = false; break } if (r < t1) t1 = r } } }
    if (!ok) { cur = null; continue }
    const ax = x0 + dx * t0, ay = y0 + dy * t0, bx = x0 + dx * t1, by = y0 + dy * t1;
    if (!cur || t0 > 0) { cur = [ax, ay]; out.push(cur) }
    cur.push(bx, by); if (t1 < 1) cur = null }
  return out.filter(p => p.length >= 4) }
// ritaglio di una polilinea su un rettangolo [x0,x1]×[y0,y1] (Liang–Barsky, come clipLine)
function clipLineBox(l, x0, x1, y0, y1) { const out = []; let cur = null;
  for (let i = 0; i + 3 < l.length; i += 2) { let ax = l[i], ay = l[i + 1], bx = l[i + 2], by = l[i + 3], t0 = 0, t1 = 1; const dx = bx - ax, dy = by - ay; let ok = true;
    for (const [p, q] of [[-dx, ax - x0], [dx, x1 - ax], [-dy, ay - y0], [dy, y1 - ay]]) { if (p === 0) { if (q < 0) { ok = false; break } } else { const r = q / p; if (p < 0) { if (r > t1) { ok = false; break } if (r > t0) t0 = r } else { if (r < t0) { ok = false; break } if (r < t1) t1 = r } } }
    if (!ok) { cur = null; continue }
    const cx = ax + dx * t0, cy = ay + dy * t0, ex = ax + dx * t1, ey = ay + dy * t1;
    if (!cur || t0 > 0) { cur = [cx, cy]; out.push(cur) }
    cur.push(ex, ey); if (t1 < 1) cur = null }
  return out.filter(p => p.length >= 4) }
// riempimento di poligoni (con buchi, regola pari/dispari) su una griglia N×N che copre [0,ext]²: chiama put(indice)
function fillPoly(rings, ext, N, put) { const k = N / ext; let y0 = 1e9, y1 = -1e9; for (const r of rings) for (let i = 1; i < r.length; i += 2) { if (r[i] < y0) y0 = r[i]; if (r[i] > y1) y1 = r[i] }
  const ja = Math.max(0, Math.floor(y0 * k - .5)), jb = Math.min(N - 1, Math.ceil(y1 * k - .5)), xs = [];
  for (let j = ja; j <= jb; j++) { const yc = (j + .5) / k; xs.length = 0;
    for (const r of rings) { const n = r.length; for (let i = 0, p = n - 2; i < n; p = i, i += 2) { const ya = r[p + 1], yb = r[i + 1]; if ((ya <= yc) !== (yb <= yc)) xs.push(r[p] + (yc - ya) / (yb - ya) * (r[i] - r[p])) } }
    xs.sort((a, b) => a - b);
    for (let q = 0; q + 1 < xs.length; q += 2) { const ia = Math.max(0, Math.ceil(xs[q] * k - .5)), ib = Math.min(N - 1, Math.floor(xs[q + 1] * k - .5)); for (let i = ia; i <= ib; i++) put(j * N + i) } } }
if (typeof module !== 'undefined') module.exports = { decodeMVT, polygons, clipRing, clipLine, clipLineBox, fillPoly, ringArea };
