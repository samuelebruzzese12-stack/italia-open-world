/* Italia Open World — mappa reale: il lavoro in sottofondo (Web Worker). Scarica le tile (vettoriali OpenMapTiles da OpenFreeMap,
   rilievo Terrarium da Mapterhorn), le decodifica e costruisce celle 3D, celle lontane (solo terreno) e immagini per mappa e minimappa.
   Le celle 3D sono quarti di tile z14 (cioè celle z15, circa 0,9 km di lato): la tile vettoriale z14 viene letta una volta sola
   e le sue coordinate vengono riportate sul quarto richiesto (raddoppiate e traslate), poi ritagliate dal costruttore.
   Messaggi: {t:'cfg',cfg} · {t:'cella',id,z:15,x,y,lod} · {t:'lontano',id,z:14,x,y,N} · {t:'mappa',id,z,x,y,px} */
'use strict';
let CFG = null;
const DEMC = new Map(), VTC = new Map();
const tpl = (t, z, x, y) => t.replace('{zz}', String(z).padStart(2, '0')).replace('{z}', z).replace('{x}', x).replace('{y}', y);
function netErr(e, u) { const er = new Error('rete: ' + (e && e.message || e) + ' (' + u.split('/').slice(0, 3).join('/') + ')'); er.net = true; return er }
async function fetchBuf(u) { let r; try { r = await fetch(u, { mode: 'cors', credentials: 'omit' }) } catch (e) { throw netErr(e, u) }
  if (r.status === 404 || r.status === 204) return null; if (!r.ok) throw netErr('HTTP ' + r.status, u); const b = new Uint8Array(await r.arrayBuffer()); return b.length ? b : null }
async function gunzipIf(b) { if (b && b.length > 2 && b[0] === 0x1f && b[1] === 0x8b) { const s = new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip')); return new Uint8Array(await new Response(s).arrayBuffer()) } return b }
function lru(map, k, make, max) { let p = map.get(k); if (p) { map.delete(k); map.set(k, p); return p } p = make(); map.set(k, p); p.catch(() => map.delete(k)); while (map.size > max) map.delete(map.keys().next().value); return p }
const STAT = { dem: 0, vt: 0, bytes: 0 };
function demTile(zd, x, y) { return lru(DEMC, zd + '/' + x + '/' + y, async () => { const b = await fetchBuf(tpl(CFG.dem, zd, x, y)); if (!b) return null; STAT.dem++; STAT.bytes += b.length;
  const bmp = await createImageBitmap(new Blob([b], { type: CFG.demType || 'image/webp' }), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  const c = new OffscreenCanvas(512, 512), g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingEnabled = false; g.drawImage(bmp, 0, 0, 512, 512); if (bmp.close) bmp.close();
  return terrarium(g.getImageData(0, 0, 512, 512).data) }, 20) }
function vtTile(z, x, y) { return lru(VTC, z + '/' + x + '/' + y, async () => { const b = await fetchBuf(tpl(CFG.vt, z, x, y)); if (!b) return {}; STAT.vt++; STAT.bytes += b.length; return decodeMVT(await gunzipIf(b)) }, 24) }
async function demFor(zd, mx0, my0, mx1, my1) { const need = demTilesFor(zd, mx0, my0, mx1, my1), tiles = new Map();
  await Promise.all(need.map(async ([tx, ty]) => { tiles.set(tx * 65536 + ty, await demTile(zd, tx, ty)) }));
  return makeDem(zd, (tx, ty) => tiles.get(tx * 65536 + ty) || null) }
// tile z14 con le tile vicine unite (strade ed edifici): le celle ai bordi della tile vedono le strade anche oltre il bordo (margine di calcolo),
// così due celle di tile diverse calcolano le stesse quote sul bordo comune. Le linee della tile principale si tagliano esattamente sui quattro bordi
// (la fascia di sicurezza della tile duplicherebbe le strade delle vicine e cambierebbe da quarto a quarto); le linee delle vicine si tagliano sulla
// loro area; i pezzi della stessa strada che si toccano sul bordo (stessa classe, ponte/galleria, senso, livello) vengono ricuciti in una sola linea,
// così ponti e gallerie lunghi hanno un profilo unico. Senza vicine, la tile resta com'è (con la sua fascia).
function mergeTiles(main, neigh) { neigh = (neigh || []).filter(n => n && n.L && (n.L.transportation || n.L.building)); if (!neigh.length) return main;
  const out = {}; for (const k in main) out[k] = main[k];
  const shift = (p, ox, oy) => { const q = new Array(p.length); for (let j = 0; j < p.length; j += 2) { q[j] = p[j] + ox; q[j + 1] = p[j + 1] + oy } return q };
  // edifici: unione semplice (traslati)
  { const name = 'building', ly = main[name], ext = ly ? ly.ext : 4096, srcs = []; if (ly) srcs.push({ ly, dx: 0, dy: 0, n: ly.n });
    for (const nb of neigh) { const l2 = nb.L[name]; if (l2 && l2.feat) srcs.push({ ly: l2, dx: nb.dx, dy: nb.dy, n: l2.n }) }
    if (srcs.length) { const tot = srcs.reduce((a, s2) => a + s2.n, 0); out[name] = { name, ext, n: tot, feat: i => { let s2 = 0; while (i >= srcs[s2].n) { i -= srcs[s2].n; s2++ } const S = srcs[s2], ft = S.ly.feat(i); if (!S.dx && !S.dy) return ft; return { id: ft.id, type: ft.type, props: ft.props, parts: ft.parts.map(p => shift(p, S.dx * ext, S.dy * ext)) } } } } }
  // strade: materializzate, ritagliate e ricucite sui bordi
  { const name = 'transportation', ly = main[name], ext = ly ? ly.ext : 4096, feats = [], ends = [];
    const add = (ft, parts, keyBase) => { for (const p of parts) { const f = { id: ft.id, type: ft.type, props: ft.props, parts: [p] }; feats.push(f);
      const onB = (x, y) => Math.abs(x) < 1.5 || Math.abs(x - ext) < 1.5 || Math.abs(y) < 1.5 || Math.abs(y - ext) < 1.5; if (onB(p[0], p[1])) ends.push({ f, e: 0, x: p[0], y: p[1], k: keyBase }); if (onB(p[p.length - 2], p[p.length - 1])) ends.push({ f, e: 1, x: p[p.length - 2], y: p[p.length - 1], k: keyBase }) } };
    const keyOf = pr => pr.class + '|' + (pr.brunnel || '') + '|' + (pr.oneway || 0) + '|' + (pr.layer || 0) + '|' + (pr.ramp || 0) + '|' + (pr.ref || '') + '|' + (pr.name || '');
    if (ly) for (let i = 0; i < ly.n; i++) { const ft = ly.feat(i); if (ft.type !== 2) { feats.push(ft); continue } const parts = []; for (const p of ft.parts) for (const c of clipLineBox(p, 0, ext, 0, ext)) parts.push(c); add(ft, parts, keyOf(ft.props)) }
    for (const nb of neigh) { const l2 = nb.L[name]; if (!l2 || !l2.feat) continue; const ox = nb.dx * ext, oy = nb.dy * ext, x0 = nb.dx < 0 ? -ext : nb.dx > 0 ? ext : 0, x1 = x0 + ext, y0 = nb.dy < 0 ? -ext : nb.dy > 0 ? ext : 0, y1 = y0 + ext;
      for (let i = 0; i < l2.n; i++) { const ft = l2.feat(i); if (ft.type !== 2) { if (ft.type === 3) feats.push({ id: ft.id, type: 3, props: ft.props, parts: ft.parts.map(p => shift(p, ox, oy)) }); continue } const parts = []; for (const p of ft.parts) for (const c of clipLineBox(shift(p, ox, oy), x0, x1, y0, y1)) parts.push(c); add(ft, parts, keyOf(ft.props)) } }
    // ricucitura: estremità sullo stesso punto di bordo con la stessa chiave
    const byK = new Map(); for (const e of ends) { const kk = e.k + '|' + Math.round(e.x / 3) + '|' + Math.round(e.y / 3); let a = byK.get(kk); if (!a) byK.set(kk, a = []); a.push(e) }
    // solo continuazioni nello stesso verso (fine di uno = inizio dell'altro): il senso unico resta giusto e il risultato non dipende dall'ordine
    const alias = new Map(), find = f => { while (alias.has(f)) f = alias.get(f); return f }; let nst = 0;
    for (const a of byK.values()) { if (a.length !== 2) continue; let [A, B] = a; if (Math.hypot(A.x - B.x, A.y - B.y) > 2 || A.e === B.e) continue; if (A.e === 0) { const t = A; A = B; B = t }
      const fa = find(A.f), fb = find(B.f); if (fa === fb) continue; fa.parts[0] = fa.parts[0].concat(fb.parts[0].slice(2)); alias.set(fb, fa); nst++ }
    const kept = feats.filter(f => !alias.has(f)); out[name] = { name, ext, n: kept.length, feat: i => kept[i], __stitched: nst } }
  return out }
// quarto (qx,qy) di una tile: stesse geometrie con coordinate ×f e traslate (la cella torna a coprire [0,ext]²)
function subLayers(L, qx, qy, f) { const out = {};
  for (const name in L) { const ly = L[name]; if (!ly || !ly.feat) continue; const e = ly.ext, ox = qx * e, oy = qy * e;
    out[name] = { name, ext: e, n: ly.n, feat: i => { const ft = ly.feat(i); return { id: ft.id, type: ft.type, props: ft.props, parts: ft.parts.map(p => { const q = new Array(p.length); for (let j = 0; j < p.length; j += 2) { q[j] = p[j] * f - ox; q[j + 1] = p[j + 1] * f - oy } return q }) } } } }
  return out }
// densità edilizia della tile z14 (quota di superficie coperta da edifici, ×2): serve a stimare i piani quando mancano i dati
function tileDens(L) { if (L.__dens !== undefined) return L.__dens; const ly = L.building; let a = 0; if (ly) { for (let i = 0; i < ly.n; i++) { const f = ly.feat(i); if (f.type !== 3) continue; for (const r of f.parts) a += ringArea(r) } a /= ly.ext * ly.ext }
  return (L.__dens = Math.min(1, Math.max(0, a * 2))) }
// --- disegno di una tile in 2D (minimappa e mappa)
const MAPC = { bg: '#ece6d8', water: '#9ec7e2', wood: '#a9cc90', grass: '#c6dfa8', farm: '#ebe4bb', park: '#b8da9c', urban: '#e0d9cd', ind: '#ddd3d2', rock: '#d8d4cb', sand: '#f0e3bd', ice: '#f5f9fb', bld: '#cdbca6' };
const RC = { motorway: ['#e98b3c', 11.5, 9], trunk: ['#f3aa52', 10, 8], primary: ['#f8d572', 9, 7], secondary: ['#fbe9a2', 8, 6], tertiary: ['#ffffff', 7, 5], minor: ['#ffffff', 6, 4], service: ['#ffffff', 4, 3], track: ['#cbb99b', 3, 2], path: ['#f2ede3', 2, 1], rail: ['#8c8c8c', 2, 2], transit: ['#8c8c8c', 2, 2] };
function drawTile(L, size, mPerTile, z) { const c = new OffscreenCanvas(size, size), g = c.getContext('2d'); g.fillStyle = MAPC.bg; g.fillRect(0, 0, size, size);
  const path = (parts, ext, closed) => { const k = size / ext; g.beginPath(); for (const p of parts) { g.moveTo(p[0] * k, p[1] * k); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i] * k, p[i + 1] * k); if (closed) g.closePath() } };
  const fillLayer = (name, colorOf) => { const ly = L[name]; if (!ly) return; for (let i = 0; i < ly.n; i++) { const f = ly.feat(i); if (f.type !== 3) continue; const col = colorOf(f.props); if (!col) continue; path(f.parts, ly.ext, true); g.fillStyle = col; g.fill('evenodd') } };
  fillLayer('landcover', p => ({ wood: MAPC.wood, forest: MAPC.wood, grass: MAPC.grass, farmland: MAPC.farm, rock: MAPC.rock, sand: MAPC.sand, ice: MAPC.ice, wetland: MAPC.grass })[p.class]);
  fillLayer('landuse', p => ({ residential: MAPC.urban, commercial: MAPC.urban, retail: MAPC.urban, industrial: MAPC.ind, railway: MAPC.ind, cemetery: MAPC.park, quarry: MAPC.rock })[p.class]);
  fillLayer('park', () => MAPC.park);
  fillLayer('water', () => MAPC.water);
  const mpp = mPerTile / size;   // metri per pixel
  { const ly = L.waterway; if (ly) { g.strokeStyle = MAPC.water; g.lineCap = 'round'; for (let i = 0; i < ly.n; i++) { const f = ly.feat(i); if (f.type !== 2) continue; g.lineWidth = Math.max(.8, (f.props.class === 'river' ? 12 : 3) / mpp); path(f.parts, ly.ext, false); g.stroke() } } }
  if (mpp < 4) fillLayer('building', () => MAPC.bld);
  { const ly = L.transportation; if (ly) { const fs = []; for (let i = 0; i < ly.n; i++) { const f = ly.feat(i); const st = RC[f.props.class]; if (!st || f.type !== 2) continue; fs.push([st[2], f, st]) } fs.sort((a, b) => a[0] - b[0]);
      g.lineCap = 'round'; g.lineJoin = 'round';
      for (const pass of [0, 1]) for (const [, f, st] of fs) { const rail = st[0] === '#8c8c8c', w = Math.max(z >= 12 ? 1.2 : .8, st[1] / mpp) * (f.props.brunnel === 'tunnel' ? .7 : 1); if (rail && pass === 0) continue;
        g.lineWidth = pass ? w : w + 1.6; g.strokeStyle = pass ? (f.props.brunnel === 'tunnel' ? '#d9d4c9' : st[0]) : 'rgba(80,70,60,.55)'; g.setLineDash(rail ? [4, 3] : []); path(f.parts, ly.ext, false); g.stroke() } g.setLineDash([]) } }
  { const ly = L.boundary; if (ly && z < 13) { g.strokeStyle = 'rgba(120,60,140,.6)'; for (let i = 0; i < ly.n; i++) { const f = ly.feat(i), al = f.props.admin_level; if (f.type !== 2 || !(al <= 4) || f.props.maritime) continue; g.lineWidth = al <= 2 ? 2.2 : 1.2; g.setLineDash(al <= 2 ? [] : [6, 4]); path(f.parts, ly.ext, false); g.stroke() } g.setLineDash([]) } }
  const labels = []; { const ly = L.place; if (ly) { const k = size / ly.ext; for (let i = 0; i < ly.n; i++) { const f = ly.feat(i), p = f.props; if (f.type !== 1 || !p.name) continue; const pt = f.parts[0]; if (!pt) continue; const x = pt[0] * k, y = pt[1] * k; if (x < 0 || y < 0 || x > size || y > size) continue; labels.push({ x, y, n: p['name:it'] || p.name, c: p.class, r: p.rank || 99 }) } } }
  return { img: c.transferToImageBitmap(), labels } }
// --- copertura del suolo ESA WorldCover 2021 (10 m, da Sentinel-1 e Sentinel-2 del programma Copernicus), servita come tile da Terrascope (VITO):
// i colori della legenda diventano classi; servono dove OpenStreetMap non ha la copertura del suolo (boschi, campi, prati, roccia veri).
const LCC = new Map(); let LCFAIL = 0;
const WCL = [[10, 0, 100, 0], [20, 255, 187, 34], [30, 255, 255, 76], [40, 240, 150, 255], [50, 250, 0, 0], [60, 180, 180, 180], [70, 240, 240, 240], [80, 0, 100, 200], [90, 0, 150, 160], [95, 0, 207, 117], [100, 250, 230, 160]];
function lcTile(z, x, y) { if (!CFG.lc || LCFAIL > 3) return Promise.resolve(null);
  return lru(LCC, z + '/' + x + '/' + y, async () => { let blob; try { const ac = new AbortController(), to = setTimeout(() => ac.abort(), 7000); const r = await fetch(tpl(CFG.lc, z, x, y), { mode: 'cors', credentials: 'omit', signal: ac.signal }); clearTimeout(to); if (!r.ok) { LCFAIL++; return null } blob = await r.blob() } catch (e) { LCFAIL++; return null }
    try { const bmp = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' }), N = bmp.width, c = new OffscreenCanvas(N, N), g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingEnabled = false; g.drawImage(bmp, 0, 0); if (bmp.close) bmp.close();
      const d = g.getImageData(0, 0, N, N).data, out = new Uint8Array(N * N); let n = 0; for (let i = 0; i < N * N; i++) { if (d[i * 4 + 3] < 128) continue; const r = d[i * 4], gg = d[i * 4 + 1], bb = d[i * 4 + 2]; let best = 0, bd = 1e9; for (const w of WCL) { const dd = (r - w[1]) ** 2 + (gg - w[2]) ** 2 + (bb - w[3]) ** 2; if (dd < bd) { bd = dd; best = w[0] } } if (bd < 3000) { out[i] = best; n++ } }
      LCFAIL = 0; STAT.lc = (STAT.lc || 0) + 1; return n ? { N, d: out } : null } catch (e) { return null } }, 12) }
// --- celle 3D (z15, dal quarto della tile z14)
async function cell(m) { const z = m.z, Sm = ME / (1 << z), mxL = -MH + m.x * Sm, myT = MH - m.y * Sm, K = CFG.K;
  // le 8 tile vicine (stesso insieme per i quattro quarti della tile: così le celle calcolano le stesse quote sui bordi e sui ponti/gallerie lunghi)
  const x14 = m.x >> 1, y14 = m.y >> 1, nbT = (dx, dy) => vtTile(z - 1, x14 + dx, y14 + dy).then(L2 => ({ L: L2, dx, dy })).catch(() => null), NB = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) NB.push(nbT(dx, dy));
  // rilievo: tile z14 intera più una cella intorno (uguale per i quattro quarti: ponti e gallerie lunghi hanno lo stesso profilo in tutte le celle)
  const qx = m.x & 1, qy = m.y & 1, tw = mxL - qx * Sm, tn = myT + qy * Sm;
  const [dem, L14, lc, ...nbs] = await Promise.all([demFor(Math.min(CFG.demMax || 12, 12), tw - Sm, tn - 3 * Sm, tw + 3 * Sm, tn + Sm), vtTile(z - 1, x14, y14), lcTile(z - 1, x14, y14).catch(() => null)].concat(NB));
  const L = subLayers(mergeTiles(L14, nbs), qx, qy, 2), ext = 4096;
  const r = buildCell(L, { S: Sm * K, mxL, myT, K, dem, lod: m.lod, earcut, cx: m.x, cy: m.y, blo: -ext, bhi: 2 * ext, blou: -(1 + qx) * ext, bhiu: (3 - qx) * ext, blov: -(1 + qy) * ext, bhiv: (3 - qy) * ext, dens: tileDens(L14), lc: lc ? { N: lc.N, d: lc.d, qx, qy } : null });
  r.net = { vt: STAT.vt, dem: STAT.dem, kb: Math.round(STAT.bytes / 1024) }; return r }
async function far(m) { const z = m.z, Sm = ME / (1 << z), mxL = -MH + m.x * Sm, myT = MH - m.y * Sm, N = m.N || 17, pad = Sm / (N - 1);
  const dem = await demFor(Math.min(m.zd || 11, CFG.demMax || 12), mxL - pad, myT - Sm - pad, mxL + Sm + pad, myT + pad); return buildFar({ S: Sm * CFG.K, mxL, myT, K: CFG.K, dem, N, q: [m.x & 1, m.y & 1] }) }
async function mapTile(m) { const L = await vtTile(m.z, m.x, m.y), Sm = ME / (1 << m.z); return drawTile(L, m.px || 256, Sm * CFG.K, m.z) }
function transfers(r) { const t = []; const add = a => { if (a && a.buffer && !t.includes(a.buffer)) t.push(a.buffer) };
  const geo = o => { if (o) { add(o.P); add(o.N); add(o.C); add(o.I); add(o.U) } };
  for (const k of ['T', 'R', 'Rst', 'Rdi', 'Rba', 'Rsw', 'Mc', 'MS', 'HG', 'M', 'W']) geo(r[k]); if (r.T && r.T.W) add(r.T.W); for (const k of ['BW', 'BR']) if (Array.isArray(r[k])) r[k].forEach(geo);
  add(r.H); add(r.cls); add(r.wmask); add(r.RH); add(r.RH2); add(r.NR); add(r.GM); add(r.walls); add(r.trees); add(r.lamps); add(r.parked); add(r.objs); if (r.img) t.push(r.img); return t }
onmessage = async e => { const m = e.data;
  if (m.t === 'cfg') { CFG = m.cfg; return }
  const job = m.t === 'cella' ? cell : m.t === 'lontano' ? far : m.t === 'mappa' ? mapTile : null; if (!job) return;
  const t0 = Date.now();
  try { const res = await job(m); res.ms = Date.now() - t0; postMessage({ t: m.t, id: m.id, ok: true, res }, transfers(res)) }
  catch (err) { postMessage({ t: m.t, id: m.id, ok: false, err: String(err && err.message || err), net: !!(err && err.net) }) } };
