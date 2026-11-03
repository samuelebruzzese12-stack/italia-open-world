// Uso: SCENES=test/browser_mappa_v31_gallerie.js PAGE='http://127.0.0.1:8765/index.html?vt=<dati>/real_test/vt/{z}/{x}/{y}.pbf&dem=<dati>/real_test/dem/{z}/{x}/{y}.webp&pos=43.731818,7.415354' OUTDIR=prove node test/scene_chromium.js
// V31 — gallerie vere di Monaco (dati salvati, caricati dal gioco): si trovano le gallerie campionando gli impalcati sotto il terreno,
// si calcola la linea media (scansione perpendicolare dell'impalcato), si fotografa l'interno delle due gallerie più lunghe e poi si guida
// lungo la linea media delle tre più lunghe a 40 km/h (direzione tenuta sulla linea media: prova delle collisioni, non della guida).
// A ogni primo urto si torna allo stato prima del passo e si elenca che cosa ferma l'auto (push del gioco, ostacolo per ostacolo).
const ATT = +(process.env.ATTESA || 45000);
const trova = `const g = window.__iow, R = g.REAL;
  if (!window.__GAL) { const st3 = 3, N = 280, pts = new Map();
    for (let i = -N; i <= N; i++) for (let j = -N; j <= N; j++) { const x = i * st3, z = j * st3, t = R.terrainH(x, z), b = R.bridgeH(x, z, t - 8); if (b !== null && b < t - 4) pts.set(i + ',' + j, [x, z, b]) }
    const seen = new Set(), comp = []; for (const [k, p] of pts) { if (seen.has(k)) continue; const C = [], st = [k]; seen.add(k); while (st.length) { const kk = st.pop(), [a, b] = kk.split(',').map(Number); C.push(pts.get(kk)); for (let da = -1; da <= 1; da++) for (let db = -1; db <= 1; db++) { const k2 = (a + da) + ',' + (b + db); if (pts.has(k2) && !seen.has(k2)) { seen.add(k2); st.push(k2) } } } comp.push(C) }
    comp.sort((a, b) => b.length - a.length); const GAL = [];
    for (const C of comp.slice(0, 3)) { if (C.length < 25) break; let mx = 0, mz = 0; for (const p of C) { mx += p[0]; mz += p[1] } mx /= C.length; mz /= C.length; let sxx = 0, sxz = 0, szz = 0; for (const p of C) { const a = p[0] - mx, b = p[1] - mz; sxx += a * a; sxz += a * b; szz += b * b }
      const th = .5 * Math.atan2(2 * sxz, sxx - szz), ex = Math.cos(th), ez = Math.sin(th), bins = new Map(); for (const p of C) { const s = (p[0] - mx) * ex + (p[1] - mz) * ez, k = Math.round(s / 4); if (!bins.has(k)) bins.set(k, [0, 0, 0, 0]); const B = bins.get(k); B[0] += p[0]; B[1] += p[1]; B[2] += p[2]; B[3]++ }
      const L = [...bins.entries()].sort((a, b) => a[0] - b[0]).map(e => [e[1][0] / e[1][3], e[1][1] / e[1][3], e[1][2] / e[1][3]]); if (L.length < 8) continue;
      for (let k = 0; k < L.length; k++) { const A = L[Math.max(0, k - 1)], B = L[Math.min(L.length - 1, k + 1)], ll = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1, px = -(B[1] - A[1]) / ll, pz = (B[0] - A[0]) / ll; let lo = null, hi = null;
        for (let o = -14; o <= 14; o += .25) { const x = L[k][0] + px * o, z = L[k][1] + pz * o, t = R.terrainH(x, z), b = R.bridgeH(x, z, L[k][2]); if (b !== null && Math.abs(b - L[k][2]) < 1.5 && b < t - 1) { if (lo === null) lo = o; hi = o } }
        if (lo !== null) { const m = (lo + hi) / 2; L[k] = [L[k][0] + px * m, L[k][1] + pz * m, L[k][2]] } }
      GAL.push(L) } window.__GAL = GAL }
  const GAL = window.__GAL;`;
const foto = (nome, gi, ka, kb) => ({ name: nome, wait: 600, eval: new Function(trova + `const L = GAL[${gi}]; if (!L) return 'galleria mancante'; const T = window.THREE; for (const id of ['rld', 'ld']) { const e = document.getElementById(id); if (e) e.style.display = 'none' }
  const a = L[Math.min(L.length - 1, ${ka})], b = L[Math.min(L.length - 1, ${kb})], k = new T.PerspectiveCamera(70, innerWidth / innerHeight, .2, 12000); k.position.set(a[0], a[2] + 1.6, a[1]); k.lookAt(new T.Vector3(b[0], b[2] + 1.4, b[1])); k.updateMatrixWorld();
  try { R.ERBA.update(a[0], a[1]) } catch (e) {} try { R.CIELO.update(a[0], a[1]) } catch (e) {} g.R.render(g.sc, k); return { img: g.R.domElement.toDataURL('image/jpeg', .9), da: a.map(v => +v.toFixed(1)), verso: b.map(v => +v.toFixed(1)) }`) });
module.exports = { init: () => ({ ok: !!window.__iow.REAL }), scenes: [{ name: 'k0', wait: ATT, eval: () => 'attendo', skip: 1 },
  { name: 'k1_ferma', wait: 2500, skip: 1, eval: () => { window.requestAnimationFrame = cb => 0; return 'ciclo fermo' } },
  { name: 'k2_trova', wait: 300, skip: 1, eval: new Function(trova + `return GAL.map(L => ({ punti: L.length, lunghezzaM: (L.length - 1) * 4, quota: +L[0][2].toFixed(1) }))`) },
  foto('t1_galleria_ingresso', 0, 0, 5), foto('t2_galleria_dentro', 0, 2, 7), foto('t3_galleria_ritorno', 0, 8, 3), foto('t4_seconda_galleria', 1, 1, 6),
  { name: 'k3_guida', wait: 300, skip: 1, eval: new Function(trova + `g.WORLD.wet = () => false; const out = [];
    for (const L of GAL) { if (!g.inCar) { g.P.x = g.C.x + 2; g.P.z = g.C.z; const q = g.near(); if (q && q.t === 'Sali in auto') q.a() }
      const s0 = 2, a = L[s0], b = L[s0 + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]), dx = (b[0] - a[0]) / l, dz = (b[1] - a[1]) / l, v0 = 40 / 3.6;
      g.C.x = a[0]; g.C.z = a[1]; g.C.h = Math.atan2(dx, dz); g.V.y = a[2] + .05; g.V.vx = dx * v0; g.V.vz = dz * v0; g.cs.v = v0; if (g.VEH) { g.VEH.v = v0; g.VEH.motore.acceso = true; g.VEH.cambio.marcia = 3 }
      const st = g.VDS && g.VDS.st, n0 = st ? st.nEventi : 0; let perc = 0, px = g.C.x, pz = g.C.z, vMin = 1e9, yMin = 1e9, yMax = -1e9, diag = null; const lun = (L.length - 1 - s0 - 2) * 4, tr = [];
      for (let i = 0; i < 900 && perc < lun; i++) { let bi = 0, bd = 1e9; for (let k = 0; k < L.length; k++) { const d = Math.hypot(L[k][0] - g.C.x, L[k][1] - g.C.z); if (d < bd) { bd = d; bi = k } } const tg = L[Math.min(L.length - 1, bi + 2)], hd = Math.atan2(tg[0] - g.C.x, tg[1] - g.C.z), sp = Math.hypot(g.V.vx, g.V.vz);
        g.C.h = hd; g.V.vx = Math.sin(hd) * sp; g.V.vz = Math.cos(hd) * sp; const pre = { x: g.C.x, z: g.C.z, h: g.C.h, y: g.V.y, vx: g.V.vx, vz: g.V.vz }, ne = st ? st.nEventi : 0;
        g.step(1 / 60);
        if (!diag && st && st.nEventi > ne) { const u = st.ultimo, sn = Math.sin(pre.h), cn = Math.cos(pre.h), nx = pre.x + pre.vx / 60, nz = pre.z + pre.vz / 60, ost = [], sp2 = [];
          for (const o of [1.3, -1.3]) { const fx = nx + sn * o, fz = nz + cn * o; for (let k = 0; k < 6; k++) { const q = g.push(fx, fz, 1, pre.y); if (!q[2]) break; const s2 = g.PO.s; if (!s2) break; ost.push({ o, yb: s2.yb, yt: s2.yt, hx: s2.hx, hz: s2.hz, tipo: s2.tree ? 'albero' : s2.amb || s2.nc ? 'auto' : s2.rail ? 'guardrail' : s2.lo ? 'basso' : 'muro' }); sp2.push([s2, s2.on]); s2.on = 0 } }
          for (const [s3, o] of sp2) { if (o === undefined) delete s3.on; else s3.on = o } diag = { passo: i, yAuto: +pre.y.toFixed(2), urto: u ? { tipo: u.kind, kmh: +(u.vn * 3.6).toFixed(0) } : null, ostacoli: ost } }
        perc += Math.hypot(g.C.x - px, g.C.z - pz); px = g.C.x; pz = g.C.z; vMin = Math.min(vMin, Math.hypot(g.V.vx, g.V.vz)); yMin = Math.min(yMin, g.V.y); yMax = Math.max(yMax, g.V.y); if (i % 45 === 0) tr.push([+(sp * 3.6).toFixed(0), +g.V.y.toFixed(1)]) }
      const ev = st ? st.nEventi - n0 : null; out.push({ lineaMediaM: (L.length - 1) * 4, daPercorrereM: lun, percorsiM: +perc.toFixed(1), velMinKmh: +(vMin * 3.6).toFixed(0), quota: [+yMin.toFixed(1), +yMax.toFixed(1)], traccia: tr, eventiDanno: ev, primoUrto: diag }) }
    return out`) }] };
