// prova in Node della costruzione delle celle z15 (quarti di tile z14) con dati veri (Monaco, OpenMapTiles da OpenStreetMap; rilievo SRTM)
// uso: node prova_cella.js [x14] [y14]   → costruisce i 4 quarti in dettaglio A e B, più la cella lontana, e controlla i valori
const fs = require('fs'), B = (process.env.DATI || __dirname) + '/' /* DATI: cartella che contiene next/<set> (tile di prova salvate col pulsante «Dati zona» e importate con importa_zona.py) */;
const src = ['mvt.js', 'earcut.js', 'dem.js', 'cella.js'].map(f => fs.readFileSync(__dirname + '/' + f, 'utf8').replace(/if \(typeof module[^\n]*\n/g, '')).join('\n');
const wsrc = fs.readFileSync(__dirname + '/worker_main.js', 'utf8');
const pick = n => { const i = wsrc.indexOf('function ' + n + '('); let d = 0, j = wsrc.indexOf('{', i); for (; j < wsrc.length; j++) { if (wsrc[j] === '{') d++; else if (wsrc[j] === '}' && --d === 0) break } return wsrc.slice(i, j + 1) };
const M = new Function(src + '\n' + pick('subLayers') + '\n' + pick('tileDens') + ';return {decodeMVT,buildCell,buildFar,makeDem,demTilesFor,earcut,subLayers,tileDens,ME,MH}')();
const x14 = +process.argv[2] || 8530, y14 = +process.argv[3] || 5973, lat0 = 43.7384, K = Math.cos(lat0 * Math.PI / 180);
const L14 = M.decodeMVT(fs.readFileSync(B + `next/real_test/vt/14/${x14}/${y14}.pbf`));
const dem = M.makeDem(12, (tx, ty) => { const f = B + `next/real_test/dem/12/${tx}/${ty}.f32`; return fs.existsSync(f) ? new Float32Array(fs.readFileSync(f).buffer.slice(0)) : null });
console.log('densità tile', M.tileDens(L14).toFixed(3));
let fail = 0;
const check = (r, tag) => { for (const k of ['T', 'R', 'M', 'W']) { const o = r[k]; if (!o) continue; let bad = 0; for (const v of o.P) if (!isFinite(v)) bad++; for (const i of o.I) if (i >= o.P.length / 3) bad++; if (bad) { fail++; console.log('  VALORI NON VALIDI in', tag, k, bad) } }
  for (const k of ['BW', 'BR']) for (const o of r[k] || []) { let bad = 0; for (const v of o.P) if (!isFinite(v)) bad++; for (const i of o.I) if (i >= o.P.length / 3) bad++; if (o.U) for (const v of o.U) if (!isFinite(v)) bad++; if (bad) { fail++; console.log('  VALORI NON VALIDI in', tag, k, o.sb, bad) } }
  if (r.RH) { let n = 0, bad = 0; for (const v of r.RH) { if (v === v) { n++; if (!isFinite(v) || v < -50 || v > 5000) bad++ } } if (bad) { fail++; console.log('  RH NON VALIDO', tag, bad) } return n } return 0 };
for (let q = 0; q < 4; q++) { const x = x14 * 2 + (q & 1), y = y14 * 2 + (q >> 1), Sm = M.ME / 32768, mxL = -M.MH + x * Sm, myT = M.MH - y * Sm, L = M.subLayers(L14, q & 1, q >> 1, 2);
  for (const lod of ['A', 'B']) { const t = Date.now(); const r = M.buildCell(L, { S: Sm * K, mxL, myT, K, dem, lod, earcut: M.earcut, cx: x, cy: y, blo: -4096, bhi: 8192, blou: -(1 + (x & 1)) * 4096, bhiu: (3 - (x & 1)) * 4096, blov: -(1 + (y & 1)) * 4096, bhiv: (3 - (y & 1)) * 4096, dens: M.tileDens(L14) });
    const cnt = o => o ? (o.I.length / 3) : 0, cntA = a => (a || []).reduce((s, o) => s + o.I.length / 3, 0), nrh = check(r, x + '/' + y + lod);
    console.log(`z15 ${x}/${y} ${lod} ${Date.now() - t} ms`, JSON.stringify(r.stat), '| tri: terreno', cnt(r.T), 'strade', cnt(r.R), 'varie', cnt(r.M), 'acqua', cnt(r.W), 'muri', cntA(r.BW), 'tetti', cntA(r.BR), 'falde', r.stat.falde, 'lampioni', r.lamps.length / 4, 'sosta', r.parked.length / 5, 'nav', r.nav.length, 'testi', r.stat.testi, 'oggetti', r.stat.oggetti, 'vie', (r.names||[]).length, 'blocchi', (r.BW || []).length,
      '| collisioni', r.walls.length / 6, 'ponti', r.bridges.length, 'alberi', r.trees.length / 5, 'pixel strada', nrh, '| luoghi', r.places.map(p => p.name).join(', ') || '—', 'bar', r.pois.length, '| H', Math.min(...r.H).toFixed(1), Math.max(...r.H).toFixed(1)) } }
{ const Sm = M.ME / 16384, mxL = -M.MH + x14 * Sm, myT = M.MH - y14 * Sm, t = Date.now(), r = M.buildFar({ S: Sm * K, mxL, myT, K, dem, N: 17 });
  let bad = 0; for (const v of r.T.P) if (!isFinite(v)) bad++; if (bad) fail++; console.log('lontana', Date.now() - t, 'ms', 'vertici', r.T.P.length / 3, 'terra', r.nL / 3, 'mare', r.nS / 3, 'H', Math.min(...r.H).toFixed(1), Math.max(...r.H).toFixed(1), bad ? 'NON VALIDI ' + bad : 'ok') }
// le celle vicine devono avere gli stessi vertici sul bordo comune del terreno lontano
{ const Sm = M.ME / 16384, N = 17, a = M.buildFar({ S: Sm * K, mxL: -M.MH + x14 * Sm, myT: M.MH - y14 * Sm, K, dem, N }), b = M.buildFar({ S: Sm * K, mxL: -M.MH + (x14 + 1) * Sm, myT: M.MH - y14 * Sm, K, dem, N });
  let md = 0; for (let j = 0; j < N; j++) { const pa = (j * N + N - 1) * 3, pb = (j * N) * 3; md = Math.max(md, Math.abs(a.T.P[pa + 1] - b.T.P[pb + 1])) } console.log('bordo comune fra celle lontane: scarto massimo di quota', md.toFixed(4), 'm'); if (md > 1e-3) fail++ }
console.log(fail ? 'ERRORI: ' + fail : 'TUTTO OK');
