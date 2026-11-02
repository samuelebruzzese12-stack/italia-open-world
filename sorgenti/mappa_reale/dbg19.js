// sonda sul vertice del terreno più vicino a (u,v) nella cella sintetica (svincolo): limiti del movimento terra. Uso: node dbg19.js u v
const fs = require('fs'), B = (process.env.DATI || __dirname) + '/' /* DATI: cartella che contiene next/<set> (tile di prova salvate col pulsante «Dati zona» e importate con importa_zona.py) */;
const src = ['mvt.js', 'earcut.js', 'dem.js', 'cella_dbg.js'].map(f => fs.readFileSync(__dirname + '/' + f, 'utf8').replace(/if \(typeof module[^\n]*\n/g, '')).join('\n');
const M = new Function(src + ';return {buildCell,earcut,ME,MH}')(), { SVINCOLO } = require(__dirname + '/svincolo.js');
const lat0 = 43.73, K = Math.cos(lat0 * Math.PI / 180), Sm = M.ME / 32768, S = Sm * K, k = S / 4096, cx = 17063, cy = 11946, mxL = -M.MH + cx * Sm, myT = M.MH - cy * Sm;
const SV = SVINCOLO(k), dem = (mx, my) => SV.h((mx - mxL) * K, (myT - my) * K);
for (let a = 2; a + 1 < process.argv.length; a += 2) { const r = M.buildCell(SV.L, { S, mxL, myT, K, dem, lod: 'A', earcut: M.earcut, cx, cy, blo: -4096, bhi: 8192, dens: .02, lc: SV.lc, dbg: 1, dbgV: [+process.argv[a], +process.argv[a + 1]] });
  const D = r.stat.dbgV; console.log(JSON.stringify(Object.fromEntries(Object.entries(D).map(([k, v]) => [k, typeof v === 'number' ? +v.toFixed(2) : v])))) }
