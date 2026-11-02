// prova sintetica (Node): autostrada con casello, distributore (area di servizio), strada di campagna in pendenza, rotatoria con strade d'ingresso,
// chiesa e scuola con i loro punti d'interesse, campi tutt'intorno. Controlla che le nuove geometrie della Versione 28 vengano create e siano valide.
const fs = require('fs'), B = (process.env.DATI || __dirname) + '/';
const src = ['mvt.js', 'earcut.js', 'dem.js', 'cella.js'].map(f => fs.readFileSync(__dirname + '/' + f, 'utf8').replace(/if \(typeof module[^\n]*\n/g, '')).join('\n');
const M = new Function(src + ';return {buildCell,earcut,ME,MH}')();
const E = 4096, lat0 = 43.5, K = Math.cos(lat0 * Math.PI / 180), Sm = M.ME / 32768, S = Sm * K, k = S / E;   // cella z15 ~ 890 m
const lay = feats => ({ ext: E, n: feats.length, feat: i => feats[i] });
const line = (pts, props) => ({ type: 2, props, parts: [pts] }), pt = (x, y, props) => ({ type: 1, props, parts: [[x, y]] });
const rect = (cx, cy, w, h, ang) => { const c = Math.cos(ang), s = Math.sin(ang), P = []; for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) P.push(cx + (a * w / 2 * c - b * h / 2 * s) / k, cy + (a * w / 2 * s + b * h / 2 * c) / k); P.push(P[0], P[1]); return P };
const ringPos = r => { let a = 0; for (let i = 0, j = r.length - 4; i < r.length - 2; j = i, i += 2) a += r[j] * r[i + 1] - r[i] * r[j + 1]; return a > 0 ? r : (() => { const o = []; for (let i = r.length - 2; i >= 0; i -= 2) o.push(r[i], r[i + 1]); return o })() };
// autostrada (senso unico, verso est), strada di campagna in salita, rotatoria (raggio 18 m) con due strade d'ingresso
const T = [line([0, 1900, E, 2050], { class: 'motorway', oneway: 1 }), line([0, 2150, E, 2300].reverse().flatMap((v, i, a) => i % 2 ? [] : [a[i + 1], a[i]]).reverse(), { class: 'motorway', oneway: 1 })];
const rural = []; for (let i = 0; i <= 40; i++) { const x = 300 + i * 85, y = 600 + Math.sin(i * .35) * 120; rural.push(x, y) } T.push(line(rural, { class: 'minor' }));
const rc = [2600, 3300], rr = 18 / k, ring = []; for (let i = 0; i <= 32; i++) { const a = -i / 32 * 2 * Math.PI; ring.push(rc[0] + Math.cos(a) * rr, rc[1] + Math.sin(a) * rr) } T.push(line(ring, { class: 'tertiary', oneway: 1 }));
T.push(line([rc[0] - rr - 400, rc[1], rc[0] - rr, rc[1]], { class: 'tertiary' })); T.push(line([rc[0], rc[1] + rr, rc[0], rc[1] + rr + 500], { class: 'tertiary' })); T.push(line([rc[0] + rr, rc[1], rc[0] + rr + 500, rc[1] - 40], { class: 'tertiary' }));
const POI = [pt(2048, 1975, { class: 'toll_booth', subclass: 'toll_booth', name: 'Firenze Sud' }), pt(1200, 1850, { class: 'fuel', subclass: 'fuel', name: 'Eni' }), pt(1500, 3000, { class: 'place_of_worship', subclass: 'christian', name: 'Pieve di San Pietro' }), pt(3400, 2700, { class: 'school', subclass: 'school', name: 'Scuola Primaria Dante Alighieri' })];
const BLD = [{ type: 3, props: {}, parts: [ringPos(rect(1500, 3000, 34, 15, .3))] }, { type: 3, props: {}, parts: [ringPos(rect(3400, 2700, 30, 14, -.2))] }];
const LC = [{ type: 3, props: { class: 'farmland' }, parts: [ringPos([0, 0, E, 0, E, E, 0, E, 0, 0])] }];
const L = { transportation: lay(T), poi: lay(POI), building: lay(BLD), landcover: lay(LC) };
const mxL = -M.MH + 17400 * Sm, myT = M.MH - 11900 * Sm, dem = (mx, my) => 120 + (mx - mxL) * .01 + Math.sin((myT - my) * .01) * 6;
const r = M.buildCell(L, { S, mxL, myT, K, dem, lod: 'A', earcut: M.earcut, cx: 17400, cy: 11900, blo: -4096, bhi: 8192, dens: .02 });
let bad = 0; const chk = (o, n) => { if (!o) return 0; for (const v of o.P) if (!isFinite(v)) bad++; for (const i of o.I) if (i >= o.P.length / 3) bad++; return o.I.length / 3 };
const tri = {}; for (const kk of ['T', 'R', 'Rst', 'Rdi', 'Rba', 'Rsw', 'Mc', 'MS', 'HG', 'M', 'W']) tri[kk] = chk(r[kk], kk); for (const o of r.BW) chk(o, 'BW'); for (const o of r.BR) chk(o, 'BR');
console.log('stat', JSON.stringify(r.stat)); console.log('triangoli', JSON.stringify(tri), 'muri', r.BW.reduce((s, o) => s + o.I.length / 3, 0), 'tetti', r.BR.reduce((s, o) => s + o.I.length / 3, 0));
console.log('testi', r.texts.filter(t => /SOS|PEDAGGIO|ENI|AREA|ros|portale/.test((t.txt || '') + (t.sub || '') + t.k)).map(t => t.k + ':' + (t.txt || '') + '/' + (t.sub || '')).join(' | '));
console.log('oggetti (tipo 9 bandiere):', Array.from(r.objs).filter((v, i) => i % 6 === 0 && v >= 9).length, 'chiese', r.chiese.length / 3, 'rotatorie', r.rotatorie.length / 4, 'alberi', r.trees.length / 5);
const need = ['chiese', 'rotatorie', 'frecce', 'distributori', 'caselli']; const miss = need.filter(n => !r.stat[n]); if (!(tri.MS > 0)) miss.push('muretti/muri di sostegno'); if (!(r.texts.some(t => t.txt === 'SOS'))) miss.push('piazzole SOS');
console.log(bad ? 'VALORI NON VALIDI ' + bad : 'valori ok', miss.length ? 'MANCANO: ' + miss.join(', ') : 'tutte le nuove geometrie presenti');
