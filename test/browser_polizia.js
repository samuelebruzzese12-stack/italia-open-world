// Polizia (vita.js) nel gioco vero con dati veri: livello di ricerca 2, 90 s di gioco a passi sincroni di 1/60 s, giocatore in auto fermo
// su una strada. Misura: pattuglie nate e quando, distanza dalla strada (asse della via più vicina − metà carreggiata), velocità massima,
// tempo contromano sulle vie a senso unico, salti fra due passi (teletrasporto), quota rispetto al suolo, urti registrati sull'auto.
// Uso: SCENES=test/browser_polizia.js PAGE='http://…/index.html?vt=…&dem=…&pos=lat,lon' node test/scene_chromium.js
module.exports = { init: () => ({ ok: !!window.__iow.REAL }), scenes: [{ name: 'p0', wait: +(process.env.ATTESA || 45000), eval: () => 'attendo', skip: 1 },
  { name: 'p1_ferma', wait: 2500, skip: 1, eval: () => { window.requestAnimationFrame = cb => 0; return 'ciclo fermo' } },
  { name: 'p2_polizia', wait: 300, skip: 1, eval: () => { const g = window.__iow, V = g.VITA, PL = V.PL, W = V.G.ways; if (!W.length) return 'nessuna strada caricata';
    if (!g.inCar) { g.P.x = g.C.x + 2; g.P.z = g.C.z; const a = g.near(); if (a && a.t === 'Sali in auto') a.a() }
    // auto ferma sull'asse della via più vicina al punto di partenza
    let best = null; for (const w of W) for (let i = 0; i < w.m; i++) { const d = Math.hypot(w.pts[i * 2] - g.C.x, w.pts[i * 2 + 1] - g.C.z); if (!best || d < best[0]) best = [d, w.pts[i * 2], w.pts[i * 2 + 1]] }
    g.C.x = best[1]; g.C.z = best[2]; g.V.vx = g.V.vz = 0; g.V.y = g.REAL.ground(g.C.x, g.C.z);
    const distStrada = (x, z) => { let b = 1e9, wb = null, sb = 0, ib = 0; for (const w of W) for (let i = 0; i + 1 < w.m; i++) { const ax = w.pts[i * 2], az = w.pts[i * 2 + 1], dx = w.pts[i * 2 + 2] - ax, dz = w.pts[i * 2 + 3] - az, l2 = dx * dx + dz * dz || 1e-9, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)), d = Math.hypot(ax + dx * t - x, az + dz * t - z) - w.w / 2; if (d < b) { b = d; wb = w; ib = i } } return [b, wb, ib] };
    PL.heat = 2; PL.seenT = PL.t; const ev0 = g.VDS && g.VDS.st ? g.VDS.st.nEventi : 0, R = { nate: [], fuoriStradaS: 0, campioni: 0, vMaxKmh: 0, salti: 0, saltoMax: 0, contromanoS: 0, quotaMax: 0, inseguimento: 0, primaPattugliaS: null };
    const prima = new Map(); let t = 0;
    for (let i = 0; i < 90 * 60; i++) { g.step(1 / 60); t += 1 / 60; if (PL.heat <= 0) { PL.heat = 2; PL.seenT = PL.t }   // la ricerca resta attiva per tutta la prova
      for (const u of PL.units) { if (!prima.has(u.id)) { prima.set(u.id, [u.x, u.z]); const ds = distStrada(u.x, u.z); R.nate.push({ t: +t.toFixed(1), stato: u.state, daGiocatoreM: +Math.hypot(u.x - g.C.x, u.z - g.C.z).toFixed(0), fuoriStradaM: +Math.max(0, ds[0]).toFixed(1) }); if (R.primaPattugliaS === null && u.state === 'chase') R.primaPattugliaS = +t.toFixed(1) }
        const p = prima.get(u.id), salto = Math.hypot(u.x - p[0], u.z - p[1]); if (salto > Math.max(2, u.v / 60 * 3)) { R.salti++; R.saltoMax = Math.max(R.saltoMax, salto) } prima.set(u.id, [u.x, u.z]); R.vMaxKmh = Math.max(R.vMaxKmh, Math.abs(u.v) * 3.6) }
      if (i % 15 === 0) for (const u of PL.units) { if (u.state !== 'chase') continue; R.campioni++; const [d, w, k] = distStrada(u.x, u.z); if (d > 2) R.fuoriStradaS += .25; R.quotaMax = Math.max(R.quotaMax, Math.abs(u.y - g.REAL.ground(u.x, u.z, u.y)));
        if (w && w.one && d < 2) { const tx = w.pts[k * 2 + 2] - w.pts[k * 2], tz = w.pts[k * 2 + 3] - w.pts[k * 2 + 1]; if ((Math.sin(u.h) * tx + Math.cos(u.h) * tz) < 0 && u.v > 2) R.contromanoS += .25 } } }
    R.inseguimento = PL.units.filter(u => u.state === 'chase').length; R.urtiAuto = g.VDS && g.VDS.st ? g.VDS.st.nEventi - ev0 : null; R.vie = W.length; R.campioniInseguimento = R.campioni; delete R.campioni;
    R.fuoriStradaS = +R.fuoriStradaS.toFixed(1); R.contromanoS = +R.contromanoS.toFixed(1); R.vMaxKmh = +R.vMaxKmh.toFixed(0); R.saltoMax = +R.saltoMax.toFixed(1); R.quotaMax = +R.quotaMax.toFixed(1); return R } }] };
