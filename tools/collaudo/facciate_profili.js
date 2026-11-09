// Misure della versione 31.5 sulle celle costruite dal generatore del gioco (sorgenti/mappa_reale/cella.js):
//  1) facciate sospese: per ogni colonna di vertici delle facciate (stesso punto in pianta, griglia di 20 cm) la base più bassa rispetto
//     all'appoggio, cioè la mesh del terreno disegnata o, sopra una galleria, il suo soffitto (5,2 m sopra la strada)
//  2) pieghe dei profili stradali: cambi di pendenza fra due tratti consecutivi oltre il 10 % e il 20 % (ponti e gallerie esclusi)
// Uso: DATI=<cartella che contiene next/<insieme>/> node tools/collaudo/facciate_profili.js [insieme...]   (predefiniti: real_test real_test_andorra)
//      ESEMPI=1 stampa le colonne nella fascia 15 cm – 1 m
const D = require('../../sorgenti/mappa_reale/difetti.js'), B = (process.env.DATI || '.') + '/next/';
const MONACO = [[8529, 5973], [8529, 5974], [8529, 5975], [8530, 5973], [8530, 5974], [8530, 5975]];
const ter = r => { const NG = r.NG, d = r.S / (NG - 1), H = r.H; return (u, v) => { const fx0 = Math.min(NG - 1.0001, Math.max(0, u / d)), fy0 = Math.min(NG - 1.0001, Math.max(0, v / d)), i = Math.floor(fx0), j = Math.floor(fy0), fx = fx0 - i, fy = fy0 - j, p = j * NG + i;
  return fx + fy <= 1 ? H[p] + (H[p + 1] - H[p]) * fx + (H[p + NG] - H[p]) * fy : H[p + NG + 1] + (H[p + NG] - H[p + NG + 1]) * (1 - fx) + (H[p + 1] - H[p + NG + 1]) * (1 - fy) } };
// quota del soffitto di una galleria sopra il punto (u, v), se il punto sta dentro la sua scatola (pareti a carreggiata/2 + 0,9 m; vano della facciata fino a carreggiata/2 + 1,25 m)
const soffitto = (RD, u, v) => { let y = -1e9; for (const R of RD) { if (!R.tun) continue; const S2 = R.S2, lim = R.w / 2 + 1.3;
  for (let q = 0; q < R.m - 1; q++) { const ax = S2[q * 2], ay = S2[q * 2 + 1], sx = S2[q * 2 + 2] - ax, sy = S2[q * 2 + 3] - ay, l2 = sx * sx + sy * sy || 1e-9, t = Math.max(0, Math.min(1, ((u - ax) * sx + (v - ay) * sy) / l2));
    if (Math.hypot(ax + sx * t - u, ay + sy * t - v) < lim) y = Math.max(y, R.h[q] + (R.h[q + 1] - R.h[q]) * t + R.lift + 5.2) } } return y };
const insiemi = process.argv.slice(2).length ? process.argv.slice(2) : ['real_test', 'real_test_andorra'];
for (const SET of insiemi) { let col = 0, f15 = 0, f1 = 0, oltre = 0, tratti = 0, vert = 0, p10 = 0, p20 = 0;
  D.celleDa(B + SET + '/', SET === 'real_test' ? MONACO : null, { uno: C => { const r = C.r, tf = ter(r), RD = r.stat._dbg.RD, basso = new Map();
    for (const g of [].concat(r.BW || []).filter(Boolean)) { const P = g.P; if (!P) continue; for (let i = 0; i < P.length; i += 3) { const k = Math.round(P[i] * 5) + ',' + Math.round(P[i + 2] * 5); if (!basso.has(k) || basso.get(k) > P[i + 1]) basso.set(k, P[i + 1]) } }
    for (const [k, y] of basso) { const [x, z] = k.split(',').map(Number), u = -x / 5, v = -z / 5, e = y - Math.max(tf(u, v), soffitto(RD, u, v)); col++;
      if (e > .15 && e <= 1) { f15++; if (process.env.ESEMPI) console.log('  ', SET, C.name, 'u', u.toFixed(1), 'v', v.toFixed(1), 'scarto', e.toFixed(2), 'm', 'terreno', tf(u, v).toFixed(2), 'soffitto galleria', soffitto(RD, u, v) > -1e8 ? soffitto(RD, u, v).toFixed(2) : '-', 'base', y.toFixed(2)) } else if (e > 1) f1++ }
    for (const R of RD) { if (R.bridge || R.tun) continue; let gp = null;
      for (let q = 0; q < R.m - 1; q++) { const l = Math.hypot(R.S2[q * 2 + 2] - R.S2[q * 2], R.S2[q * 2 + 3] - R.S2[q * 2 + 1]); if (l < .3) continue; tratti++; const g = (R.h[q + 1] - R.h[q]) / l;
        if (gp !== null) { vert++; const dg = Math.abs(g - gp); if (dg > .10) p10++; if (dg > .20) p20++ } gp = g } } } });
  oltre = f1;
  console.log(SET + ': colonne di facciata ' + col + ', sospese 15 cm – 1 m: ' + f15 + ', oltre 1 m: ' + oltre + ' | profili: tratti ' + tratti + ', cambi di pendenza >10 %: ' + p10 + ' (' + (100 * p10 / Math.max(1, vert)).toFixed(2) + ' %), >20 %: ' + p20 + ' (' + (100 * p20 / Math.max(1, vert)).toFixed(2) + ' %)') }
