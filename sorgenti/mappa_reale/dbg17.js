// sonda: una cella (con le 8 tile vicine unite, come nel gioco) e un punto (u,v): raster delle quote stradali, proprietario dei pixel,
// pezzi di strada vicini con le loro quote, nodi vicini. Uso: SET=real_test_andorra node dbg17.js x15 y15 u v
const fs = require('fs'), B = (process.env.DATI || __dirname) + '/' /* DATI: cartella che contiene next/<set> (tile di prova salvate col pulsante «Dati zona» e importate con importa_zona.py) */, SET = process.env.SET || 'real_test_andorra', DD = B + 'next/' + SET + '/';
const CELLA = process.env.CELLA || 'cella_dbg.js';
const src = ['mvt.js', 'earcut.js', 'dem.js', CELLA].map(f => fs.readFileSync(__dirname + '/' + f, 'utf8').replace(/if \(typeof module[^\n]*\n/g, '')).join('\n');
const wsrc = fs.readFileSync(__dirname + '/worker_main.js', 'utf8'); const pick = n => { const i = wsrc.indexOf('function ' + n + '('); let d = 0, j = wsrc.indexOf('{', i); for (; j < wsrc.length; j++) { if (wsrc[j] === '{') d++; else if (wsrc[j] === '}' && --d === 0) break } return wsrc.slice(i, j + 1) };
const M = new Function(src + '\n' + pick('subLayers') + '\n' + pick('tileDens') + '\n' + pick('mergeTiles') + ';return {decodeMVT,buildCell,makeDem,earcut,subLayers,tileDens,mergeTiles,ME,MH}')();
const x = +process.argv[2], y = +process.argv[3], pu = +process.argv[4], pv = +process.argv[5], RAD = +(process.env.RAD || 10);
const lat0 = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + .5) / 32768))) * 180 / Math.PI, K = Math.cos(lat0 * Math.PI / 180), Sm = M.ME / 32768;
const dem = M.makeDem(12, (tx, ty) => { const f = DD + `dem/12/${tx}/${ty}.f32`; return fs.existsSync(f) ? new Float32Array(fs.readFileSync(f).buffer.slice(0)) : null });
const tileAt = (tx, ty) => { const f = DD + `vt/14/${tx}/${ty}.pbf`; return fs.existsSync(f) ? M.decodeMVT(fs.readFileSync(f)) : null };
const x14 = x >> 1, y14 = y >> 1, L14 = tileAt(x14, y14), nb = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) { const L2 = tileAt(x14 + dx, y14 + dy); if (L2) nb.push({ L: L2, dx, dy }) }
const L = M.subLayers(M.mergeTiles(L14, nb), x & 1, y & 1, 2);
const r = M.buildCell(L, { S: Sm * K, mxL: -M.MH + x * Sm, myT: M.MH - y * Sm, K, dem, lod: 'A', earcut: M.earcut, cx: x, cy: y, blo: -4096, bhi: 8192, blou: -(1 + (x & 1)) * 4096, bhiu: (3 - (x & 1)) * 4096, blov: -(1 + (y & 1)) * 4096, bhiv: (3 - (y & 1)) * 4096, dens: M.tileDens(L14), dbg: 1, dbgN: [pu, pv], dbgR: +(process.env.DBGR || 12) });
console.log('cella', x, y, 'S', r.S.toFixed(1), 'RHN', r.RHN);
const rpx = r.S / r.RHN, i0 = Math.floor(pu / rpx), j0 = Math.floor(pv / rpx);
console.log('raster RH / proprietario attorno al pixel', i0, j0, '(passo', rpx.toFixed(2), 'm)');
for (let j = j0 - 4; j <= j0 + 4; j++) { let s = ''; for (let i = i0 - 4; i <= i0 + 4; i++) { const p = j * r.RHN + i, h = (i < 0 || j < 0 || i >= r.RHN || j >= r.RHN) ? NaN : r.RH[p]; s += (h === h ? h.toFixed(1) : "  --  ").padStart(7) + (r.ROW ? '/' + String(r.ROW[p]).padStart(3) : '') } console.log(s) }
for (const R of r.stat._dbg.RD) { let bd = 1e9, bq = 0; for (let q = 0; q < R.m; q++) { const dd = Math.hypot(R.S2[q * 2] - pu, R.S2[q * 2 + 1] - pv); if (dd < bd) { bd = dd; bq = q } } if (bd < RAD) console.log('RD', R.idx, R.c, R.bridge ? 'ponte' : '', R.tun ? 'gall' : '', 'w', R.w, 'd', bd.toFixed(1), 'q', bq, '/', R.m, 'estremi', R.S2[0].toFixed(0), R.S2[1].toFixed(0), '->', R.S2[R.m * 2 - 2].toFixed(0), R.S2[R.m * 2 - 1].toFixed(0), 'quote', Array.from(R.h).slice(Math.max(0, bq - 4), bq + 5).map(v => (v + R.lift).toFixed(1)).join(' ')) }
console.log('nodi', JSON.stringify(r.stat.dbgN)); console.log('profili', JSON.stringify(r.stat.dbgP));
