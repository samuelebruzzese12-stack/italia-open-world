// V31 — collisioni vere nel gioco (passi sincroni di step()) sulla cella sintetica dello svincolo:
// (1) auto a 60 km/h verso il guardrail dell'autostrada con 20° di angolo; (2) auto sul cavalcavia sopra i guardrail dell'autostrada.
// La mappa vera non si scarica da qui: WORLD.inside è forzato a "dentro" solo in questa prova (come nella prova V30 del muro).
const base = require('./browser_mappa_v31_sintetica.js');
const prova = (nome, quale) => ({ name: nome, wait: 400, skip: 1, eval: new Function(`const g = window.__iow, S = window.__cells.SVINCOLO, SV = S.SV, c = S.c, T = window.THREE;
  g.WORLD.inside = () => true; g.WORLD.wet = () => false; const w = (u, v) => [c.X - u, c.Z - v];
  // sale in auto (se non c'è già)
  if (!g.inCar) { g.P.x = g.C.x + 2; g.P.z = g.C.z; const a = g.near(); if (a && a.t === 'Sali in auto') a.a() }
  const quale = ${JSON.stringify(quale)}; let A, B, v0;
  if (quale === 'guardrail') { A = SV.off(.20, 7.5); B = SV.off(.215, 15); v0 = 60 / 3.6 } else { A = SV.sp(-40); B = SV.sp(40); v0 = 50 / 3.6 }
  const pa = w(A[0], A[1]), pb = w(B[0], B[1]), h = Math.atan2(pb[0] - pa[0], pb[1] - pa[1]); g.C.x = pa[0]; g.C.z = pa[1]; g.C.h = h;
  g.V.y = quale === 'guardrail' ? g.REAL.ground(pa[0], pa[1]) : g.REAL.bridgeH(pa[0], pa[1]);   // sul cavalcavia: quota dell'impalcato
  const RL = S.r.rails || [], seg = []; for (let i = 0; i + 6 < RL.length; i += 7) { const cx = c.X - RL[i], cz = c.Z - RL[i + 1], dx = -RL[i + 2] * RL[i + 4], dz = -RL[i + 3] * RL[i + 4]; seg.push([cx - dx, cz - dz, cx + dx, cz + dz, RL[i + 5], RL[i + 6]]) }
  const attraversa = (x0, z0, x1, z1, y) => { let n = 0; for (const s of seg) { if (y > s[5] + .35 || y < s[4] - 2.2) continue; const rx = x1 - x0, rz = z1 - z0, sx = s[2] - s[0], sz = s[3] - s[1], den = rx * sz - rz * sx; if (Math.abs(den) < 1e-9) continue; const a = ((s[0] - x0) * sz - (s[1] - z0) * sx) / den, b = ((s[0] - x0) * rz - (s[1] - z0) * rx) / den; if (a >= 0 && a <= 1 && b >= 0 && b <= 1) n++ } return n }; let incroci = 0;
  const sn = Math.sin(h), cn = Math.cos(h); g.V.vx = sn * v0; g.V.vz = cn * v0; g.cs.v = v0; if (g.VEH) { g.VEH.v = v0; g.VEH.motore.acceso = true; g.VEH.cambio.marcia = 3 }
  const st = g.VDS && g.VDS.st, n0 = st ? st.nEventi : 0, tr = []; let maxLat = -1e9, minV = 1e9, yMin = 1e9, yMax = -1e9;
  // distanza laterale dall'asse della carreggiata A dell'autostrada (u,v della cella) per la prova 1; avanzamento sul cavalcavia per la prova 2
  const P = SV.P, tang = t => { const a = P(t - .002), b = P(t + .002), l = Math.hypot(b[0] - a[0], b[1] - a[1]); return [(b[0] - a[0]) / l, (b[1] - a[1]) / l] };
  const lat = () => { const u = c.X - g.C.x, v = c.Z - g.C.z; let best = 1e9, bt = 0; for (let t = .15; t < .3; t += .0005) { const p = P(t), d = Math.hypot(p[0] - u, p[1] - v); if (d < best) { best = d; bt = t } } const p = P(bt), d = tang(bt); return (u - p[0]) * -d[1] + (v - p[1]) * d[0] };
  for (let i = 0; i < 150; i++) { const x0 = g.C.x, z0 = g.C.z; g.step(1 / 60); incroci += attraversa(x0, z0, g.C.x, g.C.z, g.V.y); if (quale === 'guardrail') { const l = lat(); if (l > maxLat) maxLat = l } minV = Math.min(minV, Math.hypot(g.V.vx, g.V.vz)); yMin = Math.min(yMin, g.V.y); yMax = Math.max(yMax, g.V.y); if (i % 15 === 0) tr.push([+(Math.hypot(g.V.vx, g.V.vz) * 3.6).toFixed(0), +g.V.y.toFixed(1)]) }
  const fatto = Math.hypot(g.C.x - pa[0], g.C.z - pa[1]), ev = st ? st.nEventi - n0 : null, u = st && st.ultimo;
  return { prova: quale, inCar: g.inCar, metriPercorsi: +fatto.toFixed(1), velocitaMinKmh: +(minV * 3.6).toFixed(0), traccia: tr, quotaMin: +yMin.toFixed(2), quotaMax: +yMax.toFixed(2),
    lateraleMaxDallAsse: quale === 'guardrail' ? +maxLat.toFixed(2) : null, guardrailAttraversati: incroci, guardrailNellaCella: seg.length, eventiDanno: ev, ultimoUrto: u && ev ? { tipo: u.kind, kmh: +(u.vn * 3.6).toFixed(0), kJ: +(u.Eown / 1000).toFixed(1) } : null }`) });
module.exports = { init: base.init, scenes: [base.scenes[0], base.scenes[1], base.scenes[2], prova('k1_guardrail', 'guardrail'), prova('k2_cavalcavia', 'cavalcavia')] };
