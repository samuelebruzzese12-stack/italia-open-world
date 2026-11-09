// Auto che affonda nell'asfalto: nel gioco vero (dati di Monaco) si sceglie la via più ripida fra quelle caricate (pendenza misurata con la
// quota del gioco) e si guida l'auto lungo la via a 25 m/s, in salita e in discesa, a passi sincroni di 1/60 s. Si misura di quanto la quota
// dell'auto (V.y) sta sotto la superficie (REAL.ground) durante il percorso. 31.7: anche la distanza minima fra il fondo della carrozzeria
// (4 sonde e centro) e l'asfalto, e i passi a 200 Hz in cui interviene la protezione del pianale.
module.exports = { init: () => ({ ok: !!window.__iow.REAL }), scenes: [{ name: 'a0', wait: +(process.env.ATTESA || 45000), eval: () => 'attendo', skip: 1 },
  { name: 'a1_ferma', wait: 2500, skip: 1, eval: () => { window.requestAnimationFrame = cb => 0; return 'ciclo fermo' } },
  { name: 'a2_salita', wait: 300, skip: 1, eval: () => { const g = window.__iow, R = g.REAL, W = g.VITA.G.ways.filter(w => !w.tun && !w.b && w.len > 80 && w.c !== 'path');
    if (!g.inCar) { g.P.x = g.C.x + 2; g.P.z = g.C.z; const a = g.near(); if (a && a.t === 'Sali in auto') a.a() }
    // via più ripida: dislivello medio su 60 m
    let best = null; for (const w of W) { const y0 = R.ground(w.pts[0], w.pts[1]); let s = 0, yP = y0, xP = w.pts[0], zP = w.pts[1]; for (let i = 1; i < w.m; i++) { const x = w.pts[i * 2], z = w.pts[i * 2 + 1], y = R.ground(x, z, yP); const pend = Math.abs(y - yP) / (Math.hypot(x - xP, z - zP) || 1); if (Math.hypot(x - xP, z - zP) > 20 && (!best || pend > best[0])) best = [pend, w, i - 1]; xP = x; zP = z; yP = y } }
    const w = best[1], out = { pendenza: +(best[0] * 100).toFixed(0) + ' %', viaM: +w.len.toFixed(0) }; const res = [];
    for (const verso of [1, -1]) { const P = []; for (let i = 0; i < w.m; i++) P.push([w.pts[i * 2], w.pts[i * 2 + 1]]); if (verso < 0) P.reverse();
      g.C.x = P[0][0]; g.C.z = P[0][1]; g.V.y = R.ground(g.C.x, g.C.z); g.V.tp = 0; g.V.tr = 0; g.C.h = Math.atan2(P[1][0] - g.C.x, P[1][1] - g.C.z); for (let j = 0; j < 3; j++) g.groundCar(1); g.V.ab = null;   /* la prova sposta l'auto: prima di misurare la si appoggia sul pendio (beccheggio e rollio del punto nuovo, non di quello di prima) */ let k = 1, sotto = 0, sottoMax = 0, n = 0, sopra = 0; const v0 = 25;
      for (let i = 0; i < 900 && k < P.length; i++) { while (k < P.length - 1 && Math.hypot(P[k][0] - g.C.x, P[k][1] - g.C.z) < 4) k++; const h = Math.atan2(P[k][0] - g.C.x, P[k][1] - g.C.z); g.C.h = h; g.V.vx = Math.sin(h) * v0; g.V.vz = Math.cos(h) * v0; g.cs.v = v0; if (g.VEH) g.VEH.v = v0;
        g.step(1 / 60); const gy = R.ground(g.C.x, g.C.z, g.V.y), e = gy - g.V.y; n++; if (e > .05) sotto++; sottoMax = Math.max(sottoMax, e); if (Math.hypot(P[P.length - 1][0] - g.C.x, P[P.length - 1][1] - g.C.z) < 5) break }
      res.push({ verso: verso > 0 ? 'andata' : 'ritorno', passi: n, sottoLaSuperficieOltre5cm: n ? +(100 * sotto / n).toFixed(1) + ' %' : null, sottoMassimoM: +sottoMax.toFixed(2), fondoAsfaltoMinimoM: g.V.ab ? +g.V.ab.min.toFixed(3) : null, fondoAsfaltoCentroMinimoM: g.V.ab ? +g.V.ab.ctr.toFixed(3) : null, passiProtezionePianale: g.V.ab ? g.V.ab.N : null }) }
    out.prove = res; return out } }] };
