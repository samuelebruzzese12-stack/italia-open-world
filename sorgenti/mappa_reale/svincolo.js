// cella sintetica "svincolo autostradale in collina" (come l'A3 fra Nocera e Cava de' Tirreni, ma inventata): autostrada a due carreggiate in salita
// con curva, viadotto su una valle, sottopasso poco profondo, cavalcavia con rampe (anche ad anello), strada di servizio parallela, tornante di
// superstrada a due carreggiate, rotatoria vera, strade di campagna in collina con incroci a T, distributore; copertura WorldCover finta
// (boschi lungo l'autostrada, edificato, suolo nudo, "neve" a bassa quota). Coordinate in metri della cella (u verso est, v verso sud).
function SVINCOLO(k) {
  const E = 4096, T = m => m / k, L = [], line = (pts, props) => L.push({ type: 2, props, parts: [pts.flatMap(([u, v]) => [T(u), T(v)])] });
  const P = t => [-100 + 1100 * t, 700 - 520 * t + 120 * Math.sin(Math.PI * t)];
  const tang = t => { const a = P(t - .002), b = P(t + .002), l = Math.hypot(b[0] - a[0], b[1] - a[1]); return [(b[0] - a[0]) / l, (b[1] - a[1]) / l] };
  const off = (t, o) => { const p = P(t), d = tang(t); return [p[0] - d[1] * o, p[1] + d[0] * o] };   // o > 0: a destra di chi va verso t crescente
  const carr = (t0, t1, o, rev) => { const pts = []; for (let i = 0; i <= 40; i++) { const t = t0 + (t1 - t0) * i / 40; pts.push(off(t, o)) } return rev ? pts.reverse() : pts };
  // carreggiata A (verso est, t crescente) e B (verso ovest): tratti normale / sottopasso / normale / viadotto / normale
  const cuts = [[-0.02, .30, null], [.30, .335, 'tunnel'], [.335, .62, null], [.62, .74, 'bridge'], [.74, 1.02, null]];
  for (const [a, b, br] of cuts) { const pa = { class: 'motorway', oneway: 1, ref: 'A3' }, pb = { class: 'motorway', oneway: 1, ref: 'A3' }; if (br) { pa.brunnel = br; pb.brunnel = br; if (br === 'bridge') { pa.layer = 1; pb.layer = 1 } }
    line(carr(a, b, 7.5), pa); line(carr(a, b, -7.5, true), pb) }
  // strada sopra il sottopasso (a raso, il sottopasso ci passa sotto)
  { const c = P(.3175), d = tang(.3175); line([[c[0] + d[1] * 160, c[1] - d[0] * 160], [c[0] - d[1] * 160, c[1] + d[0] * 160]], { class: 'minor' }) }
  // cavalcavia (strada provinciale) che scavalca l'autostrada a t = .46; rampe di entrata/uscita, una ad anello
  const cX = P(.46), dX = tang(.46), nX = [-dX[1], dX[0]], sp = s => [cX[0] + nX[0] * s, cX[1] + nX[1] * s];
  line([sp(-283), sp(-45)], { class: 'secondary' }); line([sp(-45), sp(45)], { class: 'secondary', brunnel: 'bridge', layer: 1 }); line([sp(45), sp(420)], { class: 'secondary' });
  { const a = off(.43, 7.5), b = sp(-45 - 70); const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push([a[0] + (b[0] - a[0]) * t + nX[0] * 18 * Math.sin(Math.PI * t), a[1] + (b[1] - a[1]) * t + nX[1] * 18 * Math.sin(Math.PI * t)]) } line(pts, { class: 'motorway', ramp: 1, oneway: 1 }) }   // uscita
  { const c0 = sp(70), R0 = 38, pts = []; for (let i = 0; i <= 28; i++) { const a = Math.PI * .5 + i / 28 * Math.PI * 1.5; pts.push([c0[0] + dX[0] * 40 + Math.cos(a) * R0, c0[1] + dX[1] * 40 + Math.sin(a) * R0]) } pts.push(off(.49, -7.5)); line(pts, { class: 'motorway', ramp: 1, oneway: 1 }) }   // anello
  // strada di servizio parallela all'autostrada (30 m a sud), più bassa
  line(carr(.52, .60, 34), { class: 'service' });
  // superstrada a due carreggiate con tornante (le due carreggiate girano in versi opposti: non è una rotatoria)
  { const c0 = [190, 120], A = [], B = []; for (let i = 0; i <= 24; i++) { const a = -Math.PI * .1 + i / 24 * Math.PI * 1.2; A.push([c0[0] + Math.cos(a) * 46, c0[1] + Math.sin(a) * 46]); B.push([c0[0] + Math.cos(a) * 32, c0[1] + Math.sin(a) * 32]) }
    line([[c0[0] + 46 * Math.cos(-Math.PI * .1) + 200, c0[1] + 46 * Math.sin(-Math.PI * .1)]].concat(A), { class: 'trunk', oneway: 1 }); line(B.reverse().concat([[c0[0] + 32 * Math.cos(-Math.PI * .1) + 200, c0[1] + 32 * Math.sin(-Math.PI * .1)]]), { class: 'trunk', oneway: 1 }) }
  // rotatoria vera in fondo alla provinciale (anello chiuso a senso unico, antiorario) con tre strade
  { const rc = sp(-300), r = 17, ring = []; for (let i = 0; i <= 32; i++) { const a = -i / 32 * 2 * Math.PI; ring.push([rc[0] + Math.cos(a) * r, rc[1] + Math.sin(a) * r]) } line(ring, { class: 'tertiary', oneway: 1 });
    line([[rc[0] + r, rc[1]], [rc[0] + r + 260, rc[1] - 60]], { class: 'tertiary' }); line([[rc[0] - r, rc[1]], [rc[0] - r - 200, rc[1] + 40]], { class: 'tertiary' }) }
  // strade di campagna in collina con incroci a T
  { const pts = []; for (let i = 0; i <= 30; i++) pts.push([560 + i * 14, 610 + Math.sin(i * .4) * 30 + i * 4]); line(pts, { class: 'minor' }); line([pts[12], [pts[12][0] + 20, pts[12][1] + 220]], { class: 'minor' }); line([pts[22], [pts[22][0] - 60, pts[22][1] + 200]], { class: 'track' }) }
  { const pts = []; for (let i = 0; i <= 26; i++) pts.push([60 + i * 13, 820 - i * 3 + Math.sin(i * .5) * 18]); line(pts, { class: 'tertiary' }) }
  // distributore vicino all'autostrada
  const POI = [{ type: 1, props: { class: 'fuel', subclass: 'fuel', name: 'Q8' }, parts: [[T(off(.57, 26)[0]), T(off(.57, 26)[1])]] }];
  // quota: collina che sale verso est, valle sotto il viadotto, poggio a nord-ovest
  const h = (u, v) => { const vt = P(.68), vd = tang(.68), dv = Math.abs((u - vt[0]) * vd[0] + (v - vt[1]) * vd[1]); return 45 + .045 * u + 26 * (1 - Math.cos(v / 260)) + 14 * Math.sin(u / 120 + v / 170) - 24 * Math.exp(-((dv / 55) ** 2)) + 30 * Math.exp(-(((u - 150) / 160) ** 2 + ((v - 120) / 140) ** 2)) };
  // WorldCover finto (256×256 sulla tile z14, cella nel quarto 0,0): bosco in fascia lungo l'autostrada, edificato, suolo nudo, neve
  const N = 256, d = new Uint8Array(N * N); for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const u = (i + .5) / N * 2 * 4096 * k, v = (j + .5) / N * 2 * 4096 * k, a = Math.sin(u * .02) + Math.cos(v * .017); d[j * N + i] = a > 1.2 ? 70 : a > .5 ? 10 : a > -.2 ? 50 : a > -.9 ? 30 : 60 }
  return { L: { transportation: { ext: E, n: L.length, feat: i => L[i] }, poi: { ext: E, n: POI.length, feat: i => POI[i] } }, h, lc: { N, d, qx: 0, qy: 0 }, P, off, sp }
}
if (typeof module !== 'undefined') module.exports = { SVINCOLO };
