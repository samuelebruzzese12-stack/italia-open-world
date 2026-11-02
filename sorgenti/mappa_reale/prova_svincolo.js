// prova in Node dello svincolo sintetico: uso node prova_svincolo.js [file cella]
const fs = require('fs'), CELLA = process.argv[2] || 'cella.js';
const src = ['mvt.js', 'earcut.js', 'dem.js', CELLA].map(f => fs.readFileSync(__dirname + '/' + f, 'utf8').replace(/if \(typeof module[^\n]*\n/g, '')).join('\n');
const M = new Function(src + ';return {buildCell,earcut,ME,MH}')(), { SVINCOLO } = require(__dirname + '/svincolo.js');
const lat0 = 43.73, K = Math.cos(lat0 * Math.PI / 180), Sm = M.ME / 32768, S = Sm * K, k = S / 4096, cx = 17063, cy = 11946, mxL = -M.MH + cx * Sm, myT = M.MH - cy * Sm;
const SV = SVINCOLO(k), dem = (mx, my) => SV.h((mx - mxL) * K, (myT - my) * K);
const r = M.buildCell(SV.L, { S, mxL, myT, K, dem, lod: 'A', earcut: M.earcut, cx, cy, blo: -4096, bhi: 8192, dens: .02, lc: SV.lc, dbg: 1 });
const st = Object.assign({}, r.stat); const D = st._dbg; delete st._dbg; console.log(CELLA, JSON.stringify(st));
const RD = D ? D.RD : null; if (RD) { let on = 0; for (let i = 0; i < r.trees.length; i += 5) { const u = -r.trees[i], v = -r.trees[i + 2]; for (const R of RD) { if (R.tun) continue; let hit = false; for (let q = 0; q < R.m - 1; q++) { const ax = R.S2[q * 2], ay = R.S2[q * 2 + 1], dx = R.S2[q * 2 + 2] - ax, dy = R.S2[q * 2 + 3] - ay, l2 = dx * dx + dy * dy || 1e-9, t = Math.max(0, Math.min(1, ((u - ax) * dx + (v - ay) * dy) / l2)); if (Math.hypot(ax + dx * t - u, ay + dy * t - v) < R.w / 2 + .8) { hit = true; break } } if (hit) { on++; break } } }
  console.log('alberi', r.trees.length / 5, 'sulla carreggiata', on);
  // franco sotto il cavalcavia: quota impalcato - quota autostrada nel punto d'incrocio
  for (const B2 of RD.filter(R => R.bridge && R.c === 'secondary')) for (const G of RD.filter(R => R.c === 'motorway' && !R.bridge)) for (let q = 0; q < B2.m - 1; q++) for (let p = 0; p < G.m - 1; p++) { const ax = B2.S2[q * 2], ay = B2.S2[q * 2 + 1], bx = B2.S2[q * 2 + 2], by = B2.S2[q * 2 + 3], cx2 = G.S2[p * 2], cy2 = G.S2[p * 2 + 1], dx = G.S2[p * 2 + 2], dy = G.S2[p * 2 + 3];
    const rx = bx - ax, ry = by - ay, sx = dx - cx2, sy = dy - cy2, den = rx * sy - ry * sx; if (Math.abs(den) < 1e-9) continue; const t = ((cx2 - ax) * sy - (cy2 - ay) * sx) / den, w = ((cx2 - ax) * ry - (cy2 - ay) * rx) / den; if (t < 0 || t > 1 || w < 0 || w > 1) continue;
    console.log('franco cavalcavia sull\'autostrada', ((B2.h[q] + (B2.h[q + 1] - B2.h[q]) * t) - (G.h[p] + (G.h[p + 1] - G.h[p]) * w)).toFixed(2), 'm') } }
console.log('rotatorie', (r.rotatorie || []).length / 4, Array.from(r.rotatorie || []).map(x => x.toFixed(0)).join(','));
