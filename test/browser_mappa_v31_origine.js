// Uso: come browser_mappa_v31_gallerie.js (stessi dati di Monaco, stessa origine pos=43.731818,7.415354)
// V31 — guida nella galleria di Monaco sotto gli edifici (dati veri caricati dal gioco), a passi sincroni dopo il caricamento
module.exports = { init: () => ({ ok: !!window.__iow.REAL }), scenes: [{ name: 'd0', wait: +(process.env.ATTESA || 50000), eval: () => 'attendo', skip: 1 },
  { name: 'd1_ferma', wait: 2500, skip: 1, eval: () => { window.requestAnimationFrame = cb => 0; return 'ciclo fermo' } },
  { name: 'd2_galleria', wait: 300, skip: 1, eval: () => { const g = window.__iow, R = g.REAL; g.WORLD.wet = () => false;
    if (!g.inCar) { g.P.x = g.C.x + 2; g.P.z = g.C.z; const a = g.near(); if (a && a.t === 'Sali in auto') a.a() }
    const dx = .583, dz = .812, h = Math.atan2(dx, dz), v0 = 40 / 3.6; const sonda = []; for (const s of [-25, -10, 0, 10, 25]) sonda.push([s, R.bridgeH(dx * s, dz * s, 56), +R.ground(dx * s, dz * s, 56).toFixed(1), +R.terrainH(dx * s, dz * s).toFixed(1)]); window.__sonda = sonda; g.C.x = 0; g.C.z = 0; g.C.h = h; g.V.y = 56.0; g.V.vx = dx * v0; g.V.vz = dz * v0; g.cs.v = v0; if (g.VEH) { g.VEH.v = v0; g.VEH.motore.acceso = true; g.VEH.cambio.marcia = 3 }
    const st = g.VDS && g.VDS.st, n0 = st ? st.nEventi : 0, x0 = g.C.x, z0 = g.C.z, tr = []; let yMin = 1e9, yMax = -1e9, vMin = 1e9;
    for (let i = 0; i < 240; i++) { g.step(1 / 60); yMin = Math.min(yMin, g.V.y); yMax = Math.max(yMax, g.V.y); vMin = Math.min(vMin, Math.hypot(g.V.vx, g.V.vz)); if (i % 30 === 0) tr.push([+(Math.hypot(g.V.vx, g.V.vz) * 3.6).toFixed(0), +g.V.y.toFixed(1), +((g.C.x - x0) * dx + (g.C.z - z0) * dz).toFixed(1)]) }
    const ev = st ? st.nEventi - n0 : null, u = st && st.ultimo;
    return { inCar: g.inCar, avanzamento: +((g.C.x - x0) * dx + (g.C.z - z0) * dz).toFixed(1), velMinKmh: +(vMin * 3.6).toFixed(0), quota: [+yMin.toFixed(1), +yMax.toFixed(1)], traccia: tr, eventiDanno: ev, ultimoUrto: u && ev ? { tipo: u.kind, kmh: +(u.vn * 3.6).toFixed(0) } : null, inside: R.inside(g.C.x, g.C.z), sonda: window.__sonda } } }] };
