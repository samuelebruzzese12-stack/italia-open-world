// misure dei difetti su dati veri (Monaco, 6 tile z14 = 24 celle z15) — uso: node metriche.js [lc] [file cella]
// lc = 1: aggiunge una copertura WorldCover finta (boschi, edificato, roccia, neve) per provare la sostituzione delle classi
const fs = require('fs'), B = (process.env.DATI || __dirname) + '/' /* DATI: cartella che contiene next/<set> (tile di prova salvate col pulsante «Dati zona» e importate con importa_zona.py) */;
const CELLA = process.argv[3] || 'cella.js';
const src = ['mvt.js', 'earcut.js', 'dem.js', CELLA].map(f => fs.readFileSync(__dirname + '/' + f, 'utf8').replace(/if \(typeof module[^\n]*\n/g, '')).join('\n');
const wsrc = fs.readFileSync(__dirname + '/worker_main.js', 'utf8');
const pick = n => { const i = wsrc.indexOf('function ' + n + '('); let d = 0, j = wsrc.indexOf('{', i); for (; j < wsrc.length; j++) { if (wsrc[j] === '{') d++; else if (wsrc[j] === '}' && --d === 0) break } return wsrc.slice(i, j + 1) };
const M = new Function(src + '\n' + pick('subLayers') + '\n' + pick('tileDens') + '\n' + pick('mergeTiles') + ';return {decodeMVT,buildCell,makeDem,earcut,subLayers,tileDens,mergeTiles,ME,MH}')();
// SET: cartella dei dati sotto next/ (real_test = Monaco; real_test_andorra = Andorra con rilievo sintetico); le tile si scelgono fra quelle con più strade
const SET = process.env.SET || 'real_test', DD = B + 'next/' + SET + '/';
const TILES = (() => { if (SET === 'real_test') return [[8529, 5973], [8529, 5974], [8529, 5975], [8530, 5973], [8530, 5974], [8530, 5975]]; const out = []; for (const xs of fs.readdirSync(DD + 'vt/14')) for (const f of fs.readdirSync(DD + 'vt/14/' + xs)) { const L = M.decodeMVT(fs.readFileSync(DD + 'vt/14/' + xs + '/' + f)); const n = L.transportation ? L.transportation.n : 0; if (n >= 12) out.push([+xs, +f.replace('.pbf', ''), n]) } out.sort((a, b) => b[2] - a[2]); return out.slice(0, +(process.env.NT || 30)) })();
const y14m = TILES.reduce((a, t) => a + t[1], 0) / TILES.length, lat0 = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y14m + .5) / 16384))) * 180 / Math.PI, K = Math.cos(lat0 * Math.PI / 180), Sm = M.ME / 32768;
const dem = M.makeDem(12, (tx, ty) => { const f = DD + `dem/12/${tx}/${ty}.f32`; return fs.existsSync(f) ? new Float32Array(fs.readFileSync(f).buffer.slice(0)) : null });
const useLC = process.argv[2] === '1';
const fakeLC = (x, y) => { const N = 256, d = new Uint8Array(N * N); for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = Math.sin((i + x * 256) * .07) + Math.cos((j + y * 256) * .05); d[j * N + i] = a > .9 ? 10 : a > .2 ? 50 : a > -.4 ? 30 : a > -.9 ? 60 : a > -1.3 ? 10 : 70 } return { N, d } };
const cells = new Map(); let tTot = 0;
const TC = new Map(), tileAt = (x, y) => { const k = x + ',' + y; if (TC.has(k)) return TC.get(k); const f = DD + `vt/14/${x}/${y}.pbf`; const L = fs.existsSync(f) ? M.decodeMVT(fs.readFileSync(f)) : null; TC.set(k, L); return L };
const NOMERGE = process.env.NOMERGE === '1';
for (const [x14, y14] of TILES) { const L14 = tileAt(x14, y14), lc = useLC ? fakeLC(x14, y14) : null;
  for (let q = 0; q < 4; q++) { const x = x14 * 2 + (q & 1), y = y14 * 2 + (q >> 1), mxL = -M.MH + x * Sm, myT = M.MH - y * Sm, nx = (q & 1) ? 1 : -1, ny = (q >> 1) ? 1 : -1;
    const nb = []; if (!NOMERGE) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) { const L2 = tileAt(x14 + dx, y14 + dy); if (L2) nb.push({ L: L2, dx, dy }) }
    const L = M.subLayers(M.mergeTiles(L14, nb), q & 1, q >> 1, 2), t = Date.now();
    const r = M.buildCell(L, { S: Sm * K, mxL, myT, K, dem, lod: 'A', earcut: M.earcut, cx: x, cy: y, blo: -4096, bhi: 8192, blou: -(1 + (x & 1)) * 4096, bhiu: (3 - (x & 1)) * 4096, blov: -(1 + (y & 1)) * 4096, bhiv: (3 - (y & 1)) * 4096, dens: M.tileDens(L14), dbg: 1, RHN: +(process.env.RHN || 512), lc: lc ? { N: lc.N, d: lc.d, qx: q & 1, qy: q >> 1 } : null });
    tTot += Date.now() - t; cells.set(x + ',' + y, { x, y, r }) } }
const S = Sm * K;
// strumenti geometrici
const segIdx = RD => { const G = new Map(), C = 12; RD.forEach((R, ri) => { const hw = R.w / 2; for (let q = 0; q < R.m - 1; q++) { const ax = R.S2[q * 2], ay = R.S2[q * 2 + 1], bx = R.S2[q * 2 + 2], by = R.S2[q * 2 + 3], e = hw + 4;
  for (let i = Math.floor((Math.min(ax, bx) - e) / C); i <= Math.floor((Math.max(ax, bx) + e) / C); i++) for (let j = Math.floor((Math.min(ay, by) - e) / C); j <= Math.floor((Math.max(ay, by) + e) / C); j++) { const k = i + ',' + j; let a = G.get(k); if (!a) G.set(k, a = []); a.push([ri, q]) } } }); return { G, C } };
const near = (RD, I, u, v, f) => { const a = I.G.get(Math.floor(u / I.C) + ',' + Math.floor(v / I.C)); if (!a) return; for (const [ri, q] of a) { const R = RD[ri], ax = R.S2[q * 2], ay = R.S2[q * 2 + 1], bx = R.S2[q * 2 + 2], by = R.S2[q * 2 + 3], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1e-9, t = Math.max(0, Math.min(1, ((u - ax) * dx + (v - ay) * dy) / l2)), d = Math.hypot(ax + dx * t - u, ay + dy * t - v); f(R, ri, d, R.h[q] + (R.h[q + 1] - R.h[q]) * t + R.lift, q, t) } };
const terr = (r, u, v) => { const NG = r.NG, d = r.S / (NG - 1), fx0 = Math.min(NG - 1.0001, Math.max(0, u / d)), fy0 = Math.min(NG - 1.0001, Math.max(0, v / d)), i = Math.floor(fx0), j = Math.floor(fy0), fx = fx0 - i, fy = fy0 - j, H = r.H, a = H[j * NG + i], b = H[j * NG + i + 1], e = H[(j + 1) * NG + i], c = H[(j + 1) * NG + i + 1];
  return fx + fy <= 1 ? a + (b - a) * fx + (e - a) * fy : c + (e - c) * (1 - fx) + (b - c) * (1 - fy) };
const hsh = (a, b) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296 };
const T = { alberiStrada: 0, alberiTot: 0, erbaStrada: 0, erbaTot: 0, muriStrada: 0, muriTot: 0, giunzioni: 0, gradini03: 0, gradini1: 0, gradMax: 0, bordi: 0, bordo03: 0, bordo1: 0, bordoMax: 0, sotto: 0, sopra16: 0, campioni: 0, frecceFuori: 0, frecceTot: 0, gallerieFuori: 0, gallerieCamp: 0, rotatorie: 0, guardScalini: 0 };
for (const C of cells.values()) { const r = C.r, D = r.stat._dbg, RD = D.RD, I = segIdx(RD);
  // 1) alberi entro la carreggiata (+0,8 m)
  for (let i = 0; i < r.trees.length; i += 5) { const u = -r.trees[i], v = -r.trees[i + 2]; let on = false; near(RD, I, u, v, (R, ri, d) => { if (!R.tun && d < R.w / 2 + .8) on = true }); T.alberiTot++; if (on) T.alberiStrada++ }
  // 2) ciuffi d'erba (stessa regola del gioco: classi ammesse, raster strade 3,6 m, acqua)
  { const ALLOW = { 6: 1, 3: 1, 0: .65, 5: .3, 12: .5, 4: .35, 10: .6 }; let nu = 0, nw = 0; for (const c of r.cls) { if (c === 2 || c === 11) nu++; if (c === 1) nw++ } const urb = nu / Math.max(1, r.cls.length - nw);
    const st = 1.55, n = Math.floor(r.S / st); for (let gz = 0; gz < n; gz += 2) for (let gx = 0; gx < n; gx += 2) { const h1 = Math.sin(gx * 127.1 + gz * 311.7) * 43758.5453, f1 = h1 - Math.floor(h1), h2 = Math.sin(gx * 269.5 + gz * 183.3) * 43758.5453, f2 = h2 - Math.floor(h2), u = (gx + f1) * st, v = (gz + f2) * st;
      const cl = r.cls[Math.min(r.CR - 1, Math.floor(v / r.S * r.CR)) * r.CR + Math.min(r.CR - 1, Math.floor(u / r.S * r.CR))]; const pr = ALLOW[cl]; if (!pr) continue; if (cl === 0 && (urb > .15 || (r.dens || 0) > .12)) continue;
      const h3 = Math.sin(gx * 41.3 + gz * 97.1) * 9137.31, f3 = h3 - Math.floor(h3); if (f3 > pr) continue;
      if (r.GM) { const gi = Math.min(r.GMN - 1, Math.floor(v / r.S * r.GMN)) * r.GMN + Math.min(r.GMN - 1, Math.floor(u / r.S * r.GMN)); if (r.GM[gi]) continue }
      else if (r.RH) { const ri = Math.min(r.RHN - 1, Math.floor(v / r.S * r.RHN)) * r.RHN + Math.min(r.RHN - 1, Math.floor(u / r.S * r.RHN)); if (r.RH[ri]) continue }
      if (r.wmask) { const wi = Math.min(r.WM - 1, Math.floor(v / r.S * r.WM)) * r.WM + Math.min(r.WM - 1, Math.floor(u / r.S * r.WM)); if (r.wmask[wi]) continue }
      T.erbaTot++; let on = false; near(RD, I, u, v, (R, ri, d) => { if (!R.tun && !R.bridge && d < R.w / 2 + .2) on = true }); if (on) T.erbaStrada++ } }
  // 3) muretti e siepi dentro una carreggiata
  for (const g of [r.MS, r.HG]) { if (!g) continue; for (let i = 0; i < g.P.length; i += 3) { const u = -g.P[i], v = -g.P[i + 2], y = g.P[i + 1]; T.muriTot++; let on = false, onD = false; let onR = null; near(RD, I, u, v, (R, ri, d, h2, q, t) => { if (!R.tun && !R.bridge && d < R.w / 2 - .3 && y > h2 + .25 && y < h2 + 4) { on = true; onR = [R.c, +d.toFixed(1), +(y - h2).toFixed(2)];
      /* v31.7b: anche rispetto all'asfalto DISEGNATO (i sentieri ristretti contro il muro della strada più alta hanno larghezze per lato) */
      let hwS = R.w / 2; if (R.hwL) { const dx = R.S2[q * 2 + 2] - R.S2[q * 2], dy = R.S2[q * 2 + 3] - R.S2[q * 2 + 1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, nz = dx / l, px = R.S2[q * 2] + dx * t, pz = R.S2[q * 2 + 1] + dy * t, W = (u - px) * nx + (v - pz) * nz >= 0 ? R.hwL : R.hwR; hwS = W[q] + (W[q + 1] - W[q]) * t } if (d < hwS - .3) onD = true } }); if (onD) T.muriDisegno = (T.muriDisegno || 0) + 1; if (on) { T.muriStrada++; if (process.env.ESEMPI) (global.EXM = global.EXM || []).push([g === r.MS ? 'muro' : 'siepe', C.x, C.y, +u.toFixed(1), +v.toFixed(1), ...onR]) } } }
  // 4) gradini agli incroci: estremità di una strada che tocca un'altra strada (dentro la cella)
  RD.forEach((R, ri) => { if (R.tun) return; for (const e of [0, R.m - 1]) { const u = R.S2[e * 2], v = R.S2[e * 2 + 1]; if (u < 2 || v < 2 || u > r.S - 2 || v > r.S - 2) continue; const he = R.h[e] + R.lift; let best = null;
    near(RD, I, u, v, (R2, r2, d, h2) => { if (r2 === ri || R2.tun) return; if (d < Math.max(1, R2.w / 2) && (!best || d < best[0])) best = [d, h2] }); if (!best) continue; const dh = Math.abs(he - best[1]); T.giunzioni++; if (dh > .3) T.gradini03++; if (dh > 1) T.gradini1++; T.gradMax = Math.max(T.gradMax, dh); if (dh > 1 && process.env.ESEMPI) (global.EXJ = global.EXJ || []).push([C.x, C.y, +u.toFixed(1), +v.toFixed(1), R.c, +dh.toFixed(2), 'fine', +he.toFixed(2), 'altra', +best[1].toFixed(2), 'd', +best[0].toFixed(1)]) } });
  // 6) terreno che buca la strada / strada sospesa oltre la gonna di 1,6 m
  for (const R of RD) { if (R.bridge || R.tun) continue; const hw = R.w / 2; for (let q = 0; q < R.m; q++) { const qa = Math.max(0, q - 1), qb = Math.min(R.m - 1, q + 1); let tx = R.S2[qb * 2] - R.S2[qa * 2], tz = R.S2[qb * 2 + 1] - R.S2[qa * 2 + 1]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
    for (const f of [-.95, -.5, 0, .5, .95]) { const u = R.S2[q * 2] - tz * hw * f, v = R.S2[q * 2 + 1] + tx * hw * f; if (u < 0 || v < 0 || u > r.S || v > r.S) continue; let top = -1e9; near(RD, I, u, v, (R2, r2, d, h2) => { if (!R2.tun && !R2.bridge && d < R2.w / 2) top = Math.max(top, h2) }); if (top < -1e8) continue;
      const tg = terr(r, u, v); T.campioni++; if (tg > top + .03) T.sotto++; if (Math.abs(f) > .9 && top - tg > 1.6) T.sopra16++ } } }
  // 6b) bordo della strada rispetto al terreno disegnato, strada per strada (positivo = asfalto sospeso)
  for (const R of RD) { if (R.bridge || R.tun || R.c === 'path' || R.c === 'rail') continue; const hw = R.w / 2; for (let q = 0; q < R.m; q++) { const qa = Math.max(0, q - 1), qb = Math.min(R.m - 1, q + 1); let tx = R.S2[qb * 2] - R.S2[qa * 2], tz = R.S2[qb * 2 + 1] - R.S2[qa * 2 + 1]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
    for (const f of [-1, 1]) { const u = R.S2[q * 2] - tz * hw * f, v = R.S2[q * 2 + 1] + tx * hw * f; if (u < 0 || v < 0 || u > r.S || v > r.S) continue; const dh = R.h[q] + R.lift - terr(r, u, v); T.bordoN = (T.bordoN || 0) + 1; T.bordoSum = (T.bordoSum || 0) + Math.abs(dh); if (dh > .6) T.bordo60 = (T.bordo60 || 0) + 1; if (dh > 1.8) T.bordo180 = (T.bordo180 || 0) + 1 } } }
  // 7) segnaletica dipinta (frecce, denti di squalo, anelli) staccata dall'asfalto
  if (r.R && r.R.U) { const pw = 10.5 / 12; for (let i = 0; i < r.R.U.length / 2; i++) { if (Math.abs(r.R.U[i * 2] - pw) > 1e-4 || Math.abs(r.R.U[i * 2 + 1] - .5) > 1e-4) continue; const u = -r.R.P[i * 3], y = r.R.P[i * 3 + 1], v = -r.R.P[i * 3 + 2]; let top = -1e9, dmin = 1e9; near(RD, I, u, v, (R2, r2, d, h2) => { if (!R2.tun && d < R2.w / 2 + .5 && Math.abs(y - h2) < dmin) { dmin = Math.abs(y - h2); top = h2 } }); if (top < -1e8) continue; T.frecceTot++; if (Math.abs(y - top) > .1) T.frecceFuori++ } }
  // 8) gallerie: tetto (strada + 5,2 m) sopra il terreno
  for (const R of RD) { if (!R.tun) continue; for (let q = 0; q < R.m - 1; q++) { const on = R.cov ? Math.min(R.cov[q], R.cov[q + 1]) > -.3 : true; if (!on) continue; T.gallerieCamp++; const u = (R.S2[q * 2] + R.S2[q * 2 + 2]) / 2, v = (R.S2[q * 2 + 1] + R.S2[q * 2 + 3]) / 2; if (terr(r, u, v) < (R.h[q] + R.h[q + 1]) / 2 + R.lift + 5.2 - .5) T.gallerieFuori++ } }
  // 9) guardrail a gradini (dislivello fra due campioni > 15 cm)
  for (const R of RD) { if (R.bridge || R.tun || R.rank < 4) continue; for (let q = 0; q < R.m - 1; q++) if (Math.abs(R.h[q + 1] - R.h[q]) > .15) T.guardScalini++ }
  T.rotatorie += (r.rotatorie || []).length / 4 }
// 5) gradini sui bordi fra celle vicine: estremità sul bordo comune con la stessa posizione
for (const C of cells.values()) for (const [dx, dy] of [[1, 0], [0, 1]]) { const N = cells.get((C.x + dx) + ',' + (C.y + dy)); if (!N) continue; const A = C.r.stat._dbg.RD, Bq = N.r.stat._dbg.RD;
  const endsA = []; for (const R of A) for (const e of [0, R.m - 1]) { const u = R.S2[e * 2], v = R.S2[e * 2 + 1]; if (dx ? Math.abs(u - S) < .05 : Math.abs(v - S) < .05) endsA.push([u, v, R.h[e] + R.lift, R]) }
  for (const R of Bq) for (const e of [0, R.m - 1]) { const u = R.S2[e * 2] + (dx ? S : 0), v = R.S2[e * 2 + 1] + (dy ? S : 0); if (dx ? Math.abs(u - S) > .05 : Math.abs(v - S) > .05) continue;
    let best = null; for (const E of endsA) { const dd = Math.hypot(E[0] - u, E[1] - v); if (dd < 1.5 && E[3].c === R.c && (!best || dd < best[0])) best = [dd, E[2]] } if (!best) continue; const dh = Math.abs(best[1] - (R.h[e] + R.lift)); T.bordi++; if (dh > .3) T.bordo03++; if (dh > 1) T.bordo1++; if (dh > .3 && process.env.ESEMPI) (global.EXB = global.EXB || []).push(['bordo', C.x, C.y, '->', N.x, N.y, +u.toFixed(1), +v.toFixed(1), R.c, +dh.toFixed(2)]); T.bordoMax = Math.max(T.bordoMax, dh) } }
const pc = (a, b) => b ? (100 * a / b).toFixed(1) + '%' : '-';
console.log(`${SET}: tile ${TILES.length}, celle ${cells.size} (${tTot} ms)  lc=${useLC ? 'finta' : 'no'}  file=${CELLA}  lat ${lat0.toFixed(2)}`);
console.log(`alberi sulla carreggiata: ${T.alberiStrada}/${T.alberiTot} (${pc(T.alberiStrada, T.alberiTot)})`);
console.log(`ciuffi d'erba sulla carreggiata: ${T.erbaStrada}/${T.erbaTot} (${pc(T.erbaStrada, T.erbaTot)})`);
console.log(`vertici di muretti/siepi dentro un'altra carreggiata: ${T.muriStrada}/${T.muriTot} (larghezza nominale); dentro l'asfalto disegnato: ${T.muriDisegno || 0}`);
console.log(`incroci: ${T.giunzioni}, gradino >30 cm: ${T.gradini03}, >1 m: ${T.gradini1}, massimo ${T.gradMax.toFixed(2)} m`);
console.log(`bordi fra celle: ${T.bordi}, gradino >30 cm: ${T.bordo03}, >1 m: ${T.bordo1}, massimo ${T.bordoMax.toFixed(2)} m`);
console.log(`campioni di carreggiata: ${T.campioni}, terreno sopra l'asfalto: ${T.sotto} (${pc(T.sotto, T.campioni)}), bordi più alti di 1,6 m (coperti fino al terreno): ${T.sopra16}`);
console.log(`bordo dell'asfalto rispetto al terreno: scarto medio ${(T.bordoSum / T.bordoN).toFixed(2)} m, sospeso oltre 60 cm: ${pc(T.bordo60 || 0, T.bordoN)}, oltre 1,8 m (muro di pietra): ${pc(T.bordo180 || 0, T.bordoN)}`);
console.log(`segnaletica dipinta staccata (>10 cm): ${T.frecceFuori}/${T.frecceTot}`);
console.log(`gallerie: tratti di scatola disegnati col tetto fuori terra (>50 cm) ${T.gallerieFuori}/${T.gallerieCamp}`);
console.log(`rotatorie riconosciute: ${T.rotatorie}`);
if (process.env.ESEMPI) { (global.EXJ || []).sort((a, b) => b[5] - a[5]); for (const e of (global.EXJ || []).slice(0, +process.env.ESEMPI)) console.log('gradino', e.join(' ')) }
if (process.env.ESEMPI) for (const e of (global.EXB || [])) console.log(e.join(' '))
if (process.env.ESEMPI) { const M = global.EXM || [], seen = new Map(); for (const e of M) { const k = e[1] + ',' + e[2] + ',' + Math.round(e[3] / 10) + ',' + Math.round(e[4] / 10); if (!seen.has(k)) seen.set(k, e) } for (const e of Array.from(seen.values()).slice(0, +process.env.ESEMPI)) console.log(e.join(' ')) }
