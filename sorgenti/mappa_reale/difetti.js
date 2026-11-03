// Misure dei difetti della mappa (versione 31) sulle stesse celle che costruisce il gioco:
//  1) guardrail dentro la carreggiata di un'altra strada alla stessa quota (le barriere "in mezzo alle corsie" degli svincoli)
//  2) muri di collisione sulla carreggiata: "invisibili" (il muro sta a un'altra quota: edificio sopra una galleria, parete di galleria sotto
//     una strada in superficie) e "veri" (il muro è alla quota della strada: dati incoerenti, edificio che invade la strada)
//  3) triangoli capovolti dell'asfalto e del terreno (faccia verso il basso: buco visto dall'alto)
//  4) pareti alte sotto il bordo delle strade (oltre 6 e 12 m: viadotti non etichettati o rilievo incoerente)
//  5) viadotti: metri di impalcato e metri con intradosso (la faccia di sotto)
// Uso: DATI=<cartella che contiene next/> node difetti.js [monaco|andorra|svincolo|periferia|tutti] [file cella]
//      ESEMPI=n stampa i primi n casi di ogni difetto (coordinate della cella in metri: u verso est, v verso sud)
const fs = require('fs'), B = (process.env.DATI || __dirname) + '/';
const CELLA = process.argv[3] || 'cella.js';
const src = ['mvt.js', 'earcut.js', 'dem.js', CELLA].map(f => fs.readFileSync(__dirname + '/' + f, 'utf8').replace(/if \(typeof module[^\n]*\n/g, '')).join('\n');
const wsrc = fs.readFileSync(__dirname + '/worker_main.js', 'utf8');
const pick = n => { const i = wsrc.indexOf('function ' + n + '('); let d = 0, j = wsrc.indexOf('{', i); for (; j < wsrc.length; j++) { if (wsrc[j] === '{') d++; else if (wsrc[j] === '}' && --d === 0) break } return wsrc.slice(i, j + 1) };
const M = new Function(src + '\n' + pick('subLayers') + '\n' + pick('tileDens') + '\n' + pick('mergeTiles') + ';return {decodeMVT,buildCell,makeDem,earcut,subLayers,tileDens,mergeTiles,ME,MH}')();
const ESEMPI = +(process.env.ESEMPI || 0);

// ---------- costruzione delle celle ----------
function celleSet(SET) {
  const DD = B + 'next/' + SET + '/', out = [];
  const TC = new Map(), tileAt = (x, y) => { const k = x + ',' + y; if (TC.has(k)) return TC.get(k); const f = DD + `vt/14/${x}/${y}.pbf`; const L = fs.existsSync(f) ? M.decodeMVT(fs.readFileSync(f)) : null; TC.set(k, L); return L };
  let TILES; if (SET === 'real_test') TILES = [[8529, 5973], [8529, 5974], [8529, 5975], [8530, 5973], [8530, 5974], [8530, 5975]];
  else { TILES = []; for (const xs of fs.readdirSync(DD + 'vt/14')) for (const f of fs.readdirSync(DD + 'vt/14/' + xs)) { const L = tileAt(+xs, +f.split('.')[0]); const n = L && L.transportation ? L.transportation.n : 0; if (n >= 12) TILES.push([+xs, +f.split('.')[0]]) } }
  const y14m = TILES.reduce((a, t) => a + t[1], 0) / TILES.length, lat0 = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y14m + .5) / 16384))) * 180 / Math.PI, K = Math.cos(lat0 * Math.PI / 180), Sm = M.ME / 32768;
  const dem = M.makeDem(12, (tx, ty) => { const f = DD + `dem/12/${tx}/${ty}.f32`; return fs.existsSync(f) ? new Float32Array(fs.readFileSync(f).buffer.slice(0)) : null });
  for (const [x14, y14] of TILES) { const L14 = tileAt(x14, y14);
    for (let q = 0; q < 4; q++) { const x = x14 * 2 + (q & 1), y = y14 * 2 + (q >> 1), mxL = -M.MH + x * Sm, myT = M.MH - y * Sm;
      const nb = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) { const L2 = tileAt(x14 + dx, y14 + dy); if (L2) nb.push({ L: L2, dx, dy }) }
      const L = M.subLayers(M.mergeTiles(L14, nb), q & 1, q >> 1, 2);
      const r = M.buildCell(L, { S: Sm * K, mxL, myT, K, dem, lod: 'A', earcut: M.earcut, cx: x, cy: y, blo: -4096, bhi: 8192, blou: -(1 + (x & 1)) * 4096, bhiu: (3 - (x & 1)) * 4096, blov: -(1 + (y & 1)) * 4096, bhiv: (3 - (y & 1)) * 4096, dens: M.tileDens(L14), dbg: 1, RHN: 512 });
      out.push({ name: x + '/' + y, r }) } }
  return out }
function celleSintetiche(nome) {
  const { SVINCOLO, PERIFERIA } = require(__dirname + '/svincolo.js'); const lat0 = 43.73, K = Math.cos(lat0 * Math.PI / 180), Sm = M.ME / 32768, S = Sm * K, k = S / 4096, cx = 17063, cy = 11946, mxL = -M.MH + cx * Sm, myT = M.MH - cy * Sm;
  const SV = (nome === 'svincolo' ? SVINCOLO : PERIFERIA)(k), dem = (mx, my) => SV.h((mx - mxL) * K, (myT - my) * K);
  return [{ name: nome, r: M.buildCell(SV.L, { S, mxL, myT, K, dem, lod: 'A', earcut: M.earcut, cx, cy, blo: -4096, bhi: 8192, dens: nome === 'svincolo' ? .02 : .3, lc: SV.lc || null, dbg: 1, RHN: 512 }) }] }

// ---------- strumenti ----------
const terr = (r, u, v) => { const NG = r.NG, d = r.S / (NG - 1), fx0 = Math.min(NG - 1.0001, Math.max(0, u / d)), fy0 = Math.min(NG - 1.0001, Math.max(0, v / d)), i = Math.floor(fx0), j = Math.floor(fy0), fx = fx0 - i, fy = fy0 - j, H = r.H, a = H[j * NG + i], b = H[j * NG + i + 1], e = H[(j + 1) * NG + i], c = H[(j + 1) * NG + i + 1];
  return fx + fy <= 1 ? a + (b - a) * fx + (e - a) * fy : c + (e - c) * (1 - fx) + (b - c) * (1 - fy) };
// indice a griglia dei segmenti di strada: f(R, q, distanza dall'asse, quota dell'asse alla proiezione)
const indice = RD => { const G = new Map(), C = 12; RD.forEach((R, ri) => { const e = R.w / 2 + 4; for (let q = 0; q < R.m - 1; q++) { const ax = R.S2[q * 2], ay = R.S2[q * 2 + 1], bx = R.S2[q * 2 + 2], by = R.S2[q * 2 + 3];
  for (let i = Math.floor((Math.min(ax, bx) - e) / C); i <= Math.floor((Math.max(ax, bx) + e) / C); i++) for (let j = Math.floor((Math.min(ay, by) - e) / C); j <= Math.floor((Math.max(ay, by) + e) / C); j++) { const k = i + ',' + j; let a = G.get(k); if (!a) G.set(k, a = []); a.push(ri, q) } } }); return { G, C, RD } };
const vicini = (I, u, v, f) => { const a = I.G.get(Math.floor(u / I.C) + ',' + Math.floor(v / I.C)); if (!a) return; for (let k = 0; k < a.length; k += 2) { const R = I.RD[a[k]], q = a[k + 1], ax = R.S2[q * 2], ay = R.S2[q * 2 + 1], dx = R.S2[q * 2 + 2] - ax, dy = R.S2[q * 2 + 3] - ay, l2 = dx * dx + dy * dy || 1e-9, t = Math.max(0, Math.min(1, ((u - ax) * dx + (v - ay) * dy) / l2));
  f(R, q, Math.hypot(ax + dx * t - u, ay + dy * t - v), R.h[q] + (R.h[q + 1] - R.h[q]) * t + R.lift) } };
const guidabile = R => !(R.c === 'path' || R.c === 'rail' || R.c === 'transit' || R.c === 'ferry' || R.c === 'track');
// triangoli con la faccia verso il basso (coordinate del gioco, faccia anteriore antioraria), area oltre 2 dm²
const capovolti = (g, ex, nome) => { if (!g) return [0, 0]; const P = g.P, I = g.I, U = g.U; let n = 0, bad = 0; for (let k = 0; k < I.length; k += 3) { const a = I[k] * 3, b = I[k + 1] * 3, c = I[k + 2] * 3, ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz); if (l < .04) continue; n++; if (ny / l < -.05) { bad++; if (ex && ex.length < ESEMPI * 4) ex.push([nome, 'colonna ' + (U ? Math.floor(U[I[k] * 2] * 12) : '-'), (-P[a]).toFixed(1), (-P[a + 2]).toFixed(1), 'area ' + (l / 2).toFixed(2), 'ny ' + (ny / l).toFixed(2)]) } } return [bad, n] };

// ---------- misure ----------
function misura(celle, nomeSet) {
  const T = { grM: 0, grDentroM: 0, campStrada: 0, muroInv: 0, muroVero: 0, capR: 0, totR: 0, capT: 0, totT: 0, bordoM: 0, parete6: 0, parete12: 0, pontiM: 0, intradossoM: 0, ms: 0, ex: { gr: [], inv: [], vero: [], par: [], cap: [], capB: [], blocco: [] } };
  for (const C of celle) { const r = C.r, D = r.stat._dbg, RD = D.RD, I = indice(RD), byIdx = new Map(); RD.forEach(R => byIdx.set(R.idx, R));
    // 1) guardrail
    const GR = D.GR || []; for (let k = 0; k < GR.length; k += 7) { const au = GR[k], av = GR[k + 1], ay = GR[k + 2], bu = GR[k + 3], bv = GR[k + 4], by = GR[k + 5], own = GR[k + 6], L = Math.hypot(bu - au, bv - av); T.grM += L; let dentro = null;
      for (const f of [0, .5, 1]) { const u = au + (bu - au) * f, v = av + (bv - av) * f, y = ay + (by - ay) * f; vicini(I, u, v, (R, q, d, hy) => { if (dentro || R.idx === own || R.tun || R.c === 'path' || R.c === 'rail') return; if (d < R.w / 2 + .3 && Math.abs(hy - y) < 2.5) dentro = [C.name, +u.toFixed(1), +v.toFixed(1), R.c, 'distanza dall\'asse ' + d.toFixed(2), 'metà larghezza ' + (R.w / 2).toFixed(2)] }) }
      if (dentro) { T.grDentroM += L; if (T.ex.gr.length < ESEMPI) T.ex.gr.push(dentro) } }
    // 2) muri di collisione sulla carreggiata (asse delle strade guidabili, ogni 2 m): il muro attraversa l'asse (±0,3 m)
    const W = r.walls, WY = r.wallsY; if (W && WY) { const WG = new Map(), CW = 16; for (let i = 0, w = 0; i + 5 < W.length; i += 6, w++) { const hl = W[i + 4] + .4, cu = W[i], cv = W[i + 1]; for (let a = Math.floor((cu - hl) / CW); a <= Math.floor((cu + hl) / CW); a++) for (let b = Math.floor((cv - hl) / CW); b <= Math.floor((cv + hl) / CW); b++) { const kk = a + ',' + b; let e = WG.get(kk); if (!e) WG.set(kk, e = []); e.push(w) } }
      for (const R of RD) { if (!guidabile(R)) continue; for (let q = 0; q < R.m - 1; q++) { const ax = R.S2[q * 2], ay = R.S2[q * 2 + 1], bx = R.S2[q * 2 + 2], by = R.S2[q * 2 + 3], L = Math.hypot(bx - ax, by - ay), ns = Math.max(1, Math.round(L / 2));
        for (let e = 0; e < ns; e++) { const t = (e + .5) / ns, u = ax + (bx - ax) * t, v = ay + (by - ay) * t; if (u < 0 || v < 0 || u > r.S || v > r.S) continue; const y = R.h[q] + (R.h[q + 1] - R.h[q]) * t + R.lift; T.campStrada++;
          const a = WG.get(Math.floor(u / CW) + ',' + Math.floor(v / CW)); if (!a) continue; let inv = false, vero = false;
          for (const w of a) { const i = w * 6, lx = (u - W[i]) * W[i + 2] + (v - W[i + 1]) * W[i + 3], lz = -(u - W[i]) * W[i + 3] + (v - W[i + 1]) * W[i + 2]; if (Math.abs(lx) > W[i + 4] || Math.abs(lz) > .3) continue;
            const yb = WY[w * 2], yt = WY[w * 2 + 1]; if (y > yt + .3 || y + 1.5 < yb) inv = true; else vero = true }
          if (inv && !vero) { T.muroInv++; if (T.ex.inv.length < ESEMPI) T.ex.inv.push([C.name, R.c, R.tun ? 'galleria' : R.bridge ? 'ponte' : 'superficie', +u.toFixed(1), +v.toFixed(1), 'quota ' + y.toFixed(1)]) }
          if (vero) { T.muroVero++; if (T.ex.vero.length < ESEMPI) T.ex.vero.push([C.name, R.c, +u.toFixed(1), +v.toFixed(1), 'quota ' + y.toFixed(1)]) } } } } }
    // 2b) un'auto (cerchio di 0,9 m, come push() del gioco) sull'asse delle strade guidabili alla quota della strada: è fermata da un ostacolo?
    //     regola v30: solo in pianta; regola v31: un ostacolo con la quota (yb, yt) non ferma chi sta oltre 35 cm sopra la cima o 2,2 m sotto la base
    { const OB = [], add = (u, v, c, s, hx, hz, yb, yt, tipo) => OB.push({ u, v, c, s, hx, hz, yb, yt, tipo });
      const W = r.walls || [], WY = r.wallsY; for (let i = 0, w = 0; i + 5 < W.length; i += 6, w++) add(W[i], W[i + 1], W[i + 2], W[i + 3], W[i + 4] + .05, .25, WY ? WY[w * 2] : undefined, WY ? WY[w * 2 + 1] : undefined, 'muro');
      const RL = r.rails || [], RLD = D.RLD || []; for (let i = 0, k = 0; i + 6 < RL.length; i += 7, k++) { add(RL[i], RL[i + 1], RL[i + 2], RL[i + 3], RL[i + 4] + .06, .14, RL[i + 5], RL[i + 6], 'guardrail'); OB[OB.length - 1].src = RLD[k] }
      const tr = r.trees || []; for (let i = 0; i + 4 < tr.length; i += 5) { const s = tr[i + 3]; add(-tr[i], -tr[i + 2], 1, 0, .22 * s, .22 * s, tr[i + 1] - .5, tr[i + 1] + 6 * s, 'albero') }
      const la = r.lamps || []; for (let i = 0; i + 3 < la.length; i += 4) add(-la[i], -la[i + 2], 1, 0, .12, .12, la[i + 1] - .3, la[i + 1] + 7, 'lampione');
      const pa = r.parked || []; for (let i = 0; i + 4 < pa.length; i += 5) add(-pa[i], -pa[i + 2], Math.sin(pa[i + 3]), Math.cos(pa[i + 3]), 2.2, .92, pa[i + 1] - .3, pa[i + 1] + 1.5, 'auto in sosta');
      const ob = r.objs || []; for (let i = 0; i + 5 < ob.length; i += 6) { const k = ob[i]; if (k == 1 || k == 3 || k == 4 || k == 5 || k == 6 || k == 7) { const tp = k == 5 ? 2.3 : k == 6 ? 3.8 : 1.2; add(ob[i + 1], ob[i + 3], 1, 0, k == 5 ? .45 : .12, k == 5 ? .45 : .12, ob[i + 2] - .3, ob[i + 2] + tp, 'oggetto'); OB[OB.length - 1].src = 'oggetto tipo ' + k } }
      const G = new Map(), CG = 16; OB.forEach((o, n) => { const e = Math.max(o.hx, o.hz) + 1; for (let a = Math.floor((o.u - e) / CG); a <= Math.floor((o.u + e) / CG); a++) for (let b = Math.floor((o.v - e) / CG); b <= Math.floor((o.v + e) / CG); b++) { const kk = a + ',' + b; let l = G.get(kk); if (!l) G.set(kk, l = []); l.push(n) } });
      for (const R of RD) { if (!guidabile(R)) continue; const dove = R.tun ? 'galleria' : R.bridge ? 'ponte' : 'superficie'; for (let q = 0; q < R.m - 1; q++) { const ax = R.S2[q * 2], ay = R.S2[q * 2 + 1], bx = R.S2[q * 2 + 2], by = R.S2[q * 2 + 3], L = Math.hypot(bx - ax, by - ay), ns = Math.max(1, Math.round(L / 2));
        for (let e = 0; e < ns; e++) { const t2 = (e + .5) / ns, u = ax + (bx - ax) * t2, v = ay + (by - ay) * t2; if (u < 0 || v < 0 || u > r.S || v > r.S) continue; const y = R.h[q] + (R.h[q + 1] - R.h[q]) * t2 + R.lift + .1, l = G.get(Math.floor(u / CG) + ',' + Math.floor(v / CG)); if (!l) continue; let h30 = null, h31 = null;
          for (const n of l) { const o = OB[n], dx = u - o.u, dz = v - o.v, lx = dx * o.c + dz * o.s, lz = -dx * o.s + dz * o.c, ex = lx - Math.max(-o.hx, Math.min(o.hx, lx)), ez = lz - Math.max(-o.hz, Math.min(o.hz, lz)); if (ex * ex + ez * ez >= .81) continue;
            if (!h30) h30 = o; if (!h31 && !(o.yb !== undefined && (y > o.yt + .35 || y < o.yb - (o.tipo === 'guardrail' ? 1.6 : 2.2)))) h31 = o }
          const B = T.blocchi || (T.blocchi = { v30: {}, v31: {} }); if (h30) { const kk = dove + ' / ' + h30.tipo; B.v30[kk] = (B.v30[kk] || 0) + 1 } if (h31) { const kk = dove + ' / ' + h31.tipo; B.v31[kk] = (B.v31[kk] || 0) + 1; if (T.ex.blocco && T.ex.blocco.length < ESEMPI && (!process.env.TIPO || h31.tipo === process.env.TIPO) && (!process.env.DOVE || dove === process.env.DOVE)) T.ex.blocco.push([C.name, dove, R.c, 'larghezza ' + R.w, +u.toFixed(1), +v.toFixed(1), h31.tipo, 'quota ' + y.toFixed(1), 'ostacolo ' + (h31.yb === undefined ? '?' : h31.yb.toFixed(1) + '–' + h31.yt.toFixed(1)), h31.src ? 'da: ' + h31.src + ' (questa strada ' + R.idx + ')' : '']) } } } } }
    // 3) triangoli capovolti
    for (const k of ['R', 'Rst', 'Rdi', 'Rba', 'Rsw']) { const [b, n] = capovolti(r[k], T.ex.cap, C.name + ' ' + k); T.capR += b; T.totR += n } { const [b, n] = capovolti(r.T); T.capT += b; T.totT += n } for (const o of r.BR || []) { const [b, n] = capovolti(o, T.ex.capB, C.name + ' tetto'); T.capB = (T.capB || 0) + b; T.totB = (T.totB || 0) + n } { const [b, n] = capovolti(r.W, T.ex.capB, C.name + ' acqua'); T.capW = (T.capW || 0) + b; T.totW = (T.totW || 0) + n }
    // 4) pareti alte sotto il bordo delle strade (bordo − terreno disegnato)
    for (const R of RD) { if (R.bridge || R.tun || !guidabile(R)) continue; const hw = R.w / 2; for (let q = 0; q < R.m - 1; q++) { const L = Math.hypot(R.S2[q * 2 + 2] - R.S2[q * 2], R.S2[q * 2 + 3] - R.S2[q * 2 + 1]), tx = (R.S2[q * 2 + 2] - R.S2[q * 2]) / (L || 1), tz = (R.S2[q * 2 + 3] - R.S2[q * 2 + 1]) / (L || 1);
      for (const s of [-1, 1]) { const u = (R.S2[q * 2] + R.S2[q * 2 + 2]) / 2 - tz * hw * s, v = (R.S2[q * 2 + 1] + R.S2[q * 2 + 3]) / 2 + tx * hw * s; if (u < 0 || v < 0 || u > r.S || v > r.S) continue; const dh = (R.h[q] + R.h[q + 1]) / 2 + R.lift - terr(r, u, v); T.bordoM += L; if (dh > 6) T.parete6 += L; if (dh > 12) { T.parete12 += L; if (T.ex.par.length < ESEMPI) T.ex.par.push([C.name, R.c, +u.toFixed(1), +v.toFixed(1), 'parete ' + dh.toFixed(1) + ' m']) } } } }
    // 5) viadotti
    for (const R of RD) { if (!R.bridge) continue; for (let q = 0; q < R.m - 1; q++) T.pontiM += Math.hypot(R.S2[q * 2 + 2] - R.S2[q * 2], R.S2[q * 2 + 3] - R.S2[q * 2 + 1]) } T.intradossoM += r.stat.intradosso || 0 }
  const pc = (a, b) => b ? (100 * a / b).toFixed(2) + '%' : '-';
  console.log(`== ${nomeSet}: ${celle.length} celle`);
  console.log(`1) guardrail: ${T.grM.toFixed(0)} m, dentro un'altra carreggiata alla stessa quota: ${T.grDentroM.toFixed(0)} m (${pc(T.grDentroM, T.grM)})`);
  console.log(`2) asse delle strade guidabili, campioni ogni 2 m: ${T.campStrada}; attraversati da un muro di collisione a un'altra quota (muro invisibile): ${T.muroInv}; da un muro alla quota della strada: ${T.muroVero}`);
  if (T.blocchi) { const tot = o => Object.values(o).reduce((a, b) => a + b, 0); console.log(`2b) auto ferma sull'asse di una strada guidabile (campioni ogni 2 m): regola v30 (solo in pianta) ${tot(T.blocchi.v30)}, regola v31 (con la quota) ${tot(T.blocchi.v31)}`); console.log('    v30: ' + JSON.stringify(T.blocchi.v30)); console.log('    v31: ' + JSON.stringify(T.blocchi.v31)) }
  console.log(`3) triangoli capovolti: asfalto ${T.capR}/${T.totR} (${pc(T.capR, T.totR)}), terreno ${T.capT}/${T.totT} (${pc(T.capT, T.totT)}), tetti (falde e tetti piani verso il basso) ${T.capB || 0}/${T.totB || 0} (${pc(T.capB || 0, T.totB || 0)}), acqua ${T.capW || 0}/${T.totW || 0}`);
  console.log(`4) bordo delle strade: ${T.bordoM.toFixed(0)} m; con parete sotto oltre 6 m: ${T.parete6.toFixed(0)} m (${pc(T.parete6, T.bordoM)}), oltre 12 m: ${T.parete12.toFixed(0)} m (${pc(T.parete12, T.bordoM)})`);
  console.log(`5) viadotti: ${T.pontiM.toFixed(0)} m di impalcato, con intradosso: ${T.intradossoM.toFixed(0)} m`);
  if (ESEMPI) for (const [k, a] of Object.entries(T.ex)) for (const e of a) console.log('   esempio', k, e.join(' '));
  return T }

const quale = process.argv[2] || 'tutti', R = {};
if (quale === 'monaco' || quale === 'tutti') R.monaco = misura(celleSet('real_test'), 'Monaco (OpenStreetMap e rilievo veri)');
if (quale === 'andorra' || quale === 'tutti') R.andorra = misura(celleSet('real_test_andorra'), 'Andorra (OpenStreetMap vero, rilievo sintetico)');
if (quale === 'svincolo' || quale === 'tutti') R.svincolo = misura(celleSintetiche('svincolo'), 'svincolo sintetico');
if (quale === 'periferia' || quale === 'tutti') R.periferia = misura(celleSintetiche('periferia'), 'periferia sintetica');
if (process.env.JSON) fs.writeFileSync(process.env.JSON, JSON.stringify(Object.fromEntries(Object.entries(R).map(([k, T]) => [k, Object.fromEntries(Object.entries(T).filter(([kk]) => kk !== 'ex'))])), null, 1));
