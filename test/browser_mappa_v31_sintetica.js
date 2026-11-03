// V31 — prima/dopo sulle celle sintetiche (svincolo in collina e periferia) costruite nella pagina con il codice vero del caricatore,
// fotografate da telecamere fisse (ciclo del gioco fermo). Stesso file per la pagina v30 (prima) e v31 (dopo).
const fs = require('fs');
const SVSRC = fs.readFileSync(__dirname + '/../sorgenti/mappa_reale/svincolo.js', 'utf8').replace(/if \(typeof module[^\n]*\n/g, '');
const window = {};
window.__mk = (nome, cx, cy, dens) => { const g = window.__iow, R = g.REAL; window.requestAnimationFrame = cb => 0;
  const src = document.getElementById('realw').textContent; const M = new Function(src + ';return {buildCell,earcut,ME,MH}')();
  const F = new Function(window.__SVSRC + ';return ' + nome)();
  const Sm = M.ME / 32768, K = R.K, S = Sm * K, k = S / 4096, mxL = -M.MH + cx * Sm, myT = M.MH - cy * Sm, SV = F(k), dem = (mx, my) => SV.h((mx - mxL) * K, (myT - my) * K);
  const r = M.buildCell(SV.L, { S, mxL, myT, K, dem, lod: 'A', earcut: M.earcut, cx, cy, blo: -4096, bhi: 8192, dens, lc: SV.lc || null, RHN: 512 });
  const c = R._mkCell({ x: cx, y: cy, key: cx * 65536 + cy, lod: 'A' }, r); g.sc.add(c.g); R.CELLS.set(cx * 65536 + cy, c);
  const NG = r.NG, d = r.S / (NG - 1), H = r.H, ter = (u, v) => { const fx0 = Math.min(NG - 1.0001, Math.max(0, u / d)), fy0 = Math.min(NG - 1.0001, Math.max(0, v / d)), i = Math.floor(fx0), j = Math.floor(fy0), fx = fx0 - i, fy = fy0 - j, p = j * NG + i; return fx + fy <= 1 ? H[p] + (H[p + 1] - H[p]) * fx + (H[p + NG] - H[p]) * fy : H[p + NG + 1] + (H[p + NG] - H[p + NG + 1]) * (1 - fx) + (H[p + 1] - H[p + NG + 1]) * (1 - fy) };
  const road = (u, v) => { if (!r.RH) return NaN; const n = r.RHN, i = Math.floor(u / r.S * n), j = Math.floor(v / r.S * n); if (i < 0 || j < 0 || i >= n || j >= n) return NaN; const q = r.RH[j * n + i]; return q ? (r.RHB || 0) + (q - 1) * .04 : NaN };
  const surf = (u, v) => { const a = road(u, v), b = ter(u, v); return a === a ? Math.max(a, b) : b };
  (window.__cells || (window.__cells = {}))[nome] = { c, r, SV, surf, ter, w: (u, v, y) => [c.X - u, y, c.Z - v] };
  return { nome, stat: r.stat, rails: (r.rails || []).length / 7, wallsY: (r.wallsY || []).length / 2 } };
// telecamera: cella, (u,v) a quota suolo + hc (o assoluta se hc è una stringa "a<quota>"), guarda (u2,v2) + ht
window.__cam = (nome, u, v, hc, u2, v2, ht, fov, terr) => { const g = window.__iow, T = window.THREE, S = window.__cells[nome]; const cam = new T.PerspectiveCamera(fov || 62, innerWidth / innerHeight, .3, 12000);
  const base = terr ? S.ter : S.surf, p = S.w(u, v, base(u, v) + hc), q = S.w(u2, v2, base(u2, v2) + ht); cam.position.set(...p); cam.lookAt(new T.Vector3(...q)); cam.updateMatrixWorld();
  try { g.REAL.ERBA.update(p[0], p[2]) } catch (e) {} try { g.REAL.CIELO.update(p[0], p[2]) } catch (e) {} g.R.render(g.sc, cam); return { img: g.R.domElement.toDataURL('image/jpeg', .9), cam: [p.map(x => +x.toFixed(0)), q.map(x => +x.toFixed(0))] } };
const src = ['__mk', '__cam'].map(k => 'window.' + k + '=' + window[k].toString() + ';').join('\n');
const v = (name, a) => ({ name, wait: 1800, eval: new Function('const S=window.__cells.SVINCOLO.SV,P=S.P,o=S.off,sp=S.sp;return __cam(' + a + ')') });
module.exports = {
  init: new Function('window.__SVSRC=' + JSON.stringify(SVSRC) + ';' + src + 'return {ok:!!window.__iow.REAL}'),
  scenes: [{ name: 's0_attesa', wait: 16000, eval: () => 'attendo', skip: 1 }, { name: 's0b_ferma', wait: 3000, eval: () => { window.requestAnimationFrame = cb => 0; return 'ciclo fermo' }, skip: 1 },
    { name: 's1_celle', wait: 2500, eval: () => { for (const id of ['rld', 'ld']) { const e = document.getElementById(id); if (e) e.style.display = 'none' } const a = __mk('SVINCOLO', 17063, 11946, .02), b = __mk('PERIFERIA', 17065, 11946, .3), g = window.__iow, c = window.__cells.SVINCOLO.c; g.C.x = g.P.x = c.X - 450; g.C.z = g.P.z = c.Z - 450; return [a, b] }, skip: 1 },   // il giocatore sta sulla cella: il gioco non la scarta
    v('b1_cavalcavia_lato', "'SVINCOLO',o(.43,-40)[0],o(.43,-40)[1],2,o(.46,0)[0],o(.46,0)[1],5,60,1"),
    v('b2_cavalcavia_sotto', "'SVINCOLO',o(.452,3)[0],o(.452,3)[1],1.6,sp(30)[0],sp(30)[1],6,70"),
    v('b3_rampa_si_stacca', "'SVINCOLO',o(.405,9)[0],o(.405,9)[1],2.2,o(.44,10)[0],o(.44,10)[1],1"),
    v('b4_rampa_dall_alto', "'SVINCOLO',o(.43,30)[0],o(.43,30)[1],38,o(.43,6)[0],o(.43,6)[1],0,60"),
    v('b5_viadotto_lato', "'SVINCOLO',o(.68,-70)[0],o(.68,-70)[1],2,o(.68,0)[0],o(.68,0)[1],-6,60,1"),
    v('b6_alberi_vicino', "'SVINCOLO',120,60,3.2,180,170,3"),
    v('b7_rilevato_basso', "'SVINCOLO',o(.585,-32)[0],o(.585,-32)[1],1.7,o(.60,-8)[0],o(.60,-8)[1],0,60,1"),
    v('b8_rampa_lato', "'SVINCOLO',sp(-150)[0]+12,sp(-150)[1]+12,1.7,sp(-95)[0],sp(-95)[1],0,60,1"),
    { name: 'p1_incrocio', wait: 1800, eval: () => __cam('PERIFERIA', 98, 104, 1.7, 118, 118, 0) },
    { name: 'p2_tetti_alto', wait: 1800, eval: () => __cam('PERIFERIA', 160, 210, 70, 200, 260, 0, 55) },
    { name: 'p3_tetti_obliquo', wait: 1800, eval: () => __cam('PERIFERIA', 120, 160, 22, 200, 260, 0, 55) },
    { name: 'p4_casa_alto', wait: 1800, eval: () => { const S = window.__cells.PERIFERIA, r = S.r; let best = null; const W = r.walls; for (let i = 0; i + 5 < W.length; i += 6) { const d = Math.hypot(W[i] - 230, W[i + 1] - 300); if (!best || d < best[0]) best = [d, W[i], W[i + 1]] } return __cam('PERIFERIA', best[1] + 9, best[2] + 9, 26, best[1], best[2], 0, 50) } },
    { name: 'p5_casa_strada', wait: 1800, eval: () => { const S = window.__cells.PERIFERIA, r = S.r; let best = null; const W = r.walls; for (let i = 0; i + 5 < W.length; i += 6) { const d = Math.hypot(W[i] - 230, W[i + 1] - 300); if (!best || d < best[0]) best = [d, W[i], W[i + 1]] } return __cam('PERIFERIA', best[1] + 22, best[2] + 16, 1.7, best[1], best[2], 4, 60) } }] };
