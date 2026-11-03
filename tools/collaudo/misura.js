// Misura i difetti di ogni cella z15 delle tile z14 date, con il generatore vero del gioco (sorgenti/mappa_reale/cella.js) e lo stesso
// misuratore di difetti.js. Scrive una riga JSON per cella (in coda al file di uscita).
// Uso: node misura.js <cartella dati: vt/14/x/y.pbf, dem/12/x/y.f32> <uscita.jsonl> x,y x,y ...
const fs = require('fs'), path = require('path');
const D = require(path.join(__dirname, '..', '..', 'sorgenti', 'mappa_reale', 'difetti.js')), I = require('./italia.js');
const [DD, OUT, ...TT] = process.argv.slice(2), TILES = TT.map(s => s.split(',').map(Number));
const ripulisci = T => { const o = {}; for (const [k, v] of Object.entries(T)) if (typeof v === 'number') o[k] = Math.round(v * 10) / 10; if (T.blocchi) o.bloccati = T.blocchi.v31; return o };
// nome del luogo più vicino al centro della cella (strato "place" delle tile)
const luogo = L => { const ly = L && L.place; if (!ly) return null; const c = ly.ext / 2; let best = null, bd = 1e18; const peso = { city: 0, town: 1, village: 2, suburb: 2, hamlet: 3, neighbourhood: 3, quarter: 3, isolated_dwelling: 4, locality: 4 };
  for (let i = 0; i < ly.n; i++) { const f = ly.feat(i), p = f.props || {}; if (!p.name) continue; const pt = f.parts && f.parts[0]; if (!pt) continue; const d = Math.hypot(pt[0] - c, pt[1] - c) * (1 + (peso[p.class] ?? 3) * .5); if (d < bd) { bd = d; best = p.name } } return best };
let n = 0; const righe = [];
D.celleDa(DD.endsWith('/') ? DD : DD + '/', TILES, { uno: C => { const t0 = Date.now(), T = D.misura([C], C.name, true), m = ripulisci(T);
  m.cella = C.name; m.lat = +I.y2lat(C.y + .5, 15).toFixed(5); m.lon = +I.x2lon(C.x + .5, 15).toFixed(5); m.luogo = luogo(C.L); m.strade = (C.r.stat && C.r.stat.strade) || 0; m.edifici = (C.r.stat && C.r.stat.edifici) || 0; m.msMisura = Date.now() - t0;
  // esempi (coordinate nella cella) dei casi peggiori, per ritrovarli
  const ex = {}; for (const [k, a] of Object.entries(T.ex || {})) if (a.length) ex[k] = a.slice(0, 3); if (Object.keys(ex).length) m.esempi = ex;
  righe.push(JSON.stringify(m)); n++ } });
fs.appendFileSync(OUT, righe.length ? righe.join('\n') + '\n' : ''); console.log('celle misurate:', n);
