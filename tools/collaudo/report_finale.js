// Report di collaudo calcolato: esegue le prove, misura, confronta con soglie scritte qui e scrive docs/test/v31_7_misure_finali.txt.
// Niente valori scritti a mano: ogni numero viene dall'uscita di un programma eseguito in questo momento. L'esito complessivo è PASSED solo
// se TUTTI i criteri sono rispettati; un criterio non verificabile (per esempio Chromium non disponibile) conta come non superato.
//
// Uso (dalla cartella del repository):
//   DATI=<cartella che contiene next/real_test e next/real_test_andorra> node tools/collaudo/report_finale.js
//   facoltativo, per le prove nel gioco vero:  PAGINA_URL=<url di index.html servita in locale> DATI_URL=<url di next/real_test>  THREE_JS=<three.min.js r128 locale>
//   facoltativo: PRIMA=<commit di confronto> (predefinito dba1fbe)
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const RADICE = path.join(__dirname, '..', '..'), MAPPA = path.join(RADICE, 'sorgenti', 'mappa_reale'), DATI = process.env.DATI, PRIMA = process.env.PRIMA || 'dba1fbe';
if (!DATI) { console.error('manca DATI (cartella con next/real_test e next/real_test_andorra)'); process.exit(2) }

// ------------------------------------------------------------------ soglie (modificabili; il report le stampa)
const SOGLIE = {
  testJs: 'tutti superati', testPy: 'tutti superati',
  gradiniConfine: { oltre: .30, massimo: 0 },          // gradini fra celle vicine oltre 30 cm: nessuno
  gradiniIncroci: { oltre: .30, massimo: 0 },          // gradini fra l'estremità di una via e la strada su cui finisce oltre 30 cm: nessuno
  facciateSospese: { massimo: 0 },                     // colonne di facciata 15 cm – 1 m sopra l'appoggio: nessuna
  fondoAsfalto: { minimoM: 0 },                        // distanza minima fondo–asfalto sulla via ripida di Monaco: mai negativa (nessun contatto)
  galleria: { percorsiMinimoM: 56 },                   // galleria di 72 m di Monaco: percorsi almeno i 56 m previsti, senza urti
};

const esegui = (cmd, args, env, timeout) => { const r = cp.spawnSync(cmd, args, { cwd: RADICE, env: Object.assign({}, process.env, env || {}), encoding: 'utf8', timeout: timeout || 1800000, maxBuffer: 1 << 28 }); return { codice: r.status, testo: (r.stdout || '') + (r.stderr || '') } };

// ------------------------------------------------------------------ costruzione delle celle con un generatore a scelta (attuale o del commit PRIMA)
function generatore(sorgenteCella) {
  const src = ['mvt.js', 'earcut.js', 'dem.js'].map(f => fs.readFileSync(path.join(MAPPA, f), 'utf8')).concat([sorgenteCella]).map(t => t.replace(/if \(typeof module[^\n]*\n/g, '')).join('\n');
  const wsrc = fs.readFileSync(path.join(MAPPA, 'worker_main.js'), 'utf8'), pick = n => { const i = wsrc.indexOf('function ' + n + '('); let d = 0, j = wsrc.indexOf('{', i); for (; j < wsrc.length; j++) { if (wsrc[j] === '{') d++; else if (wsrc[j] === '}' && --d === 0) break } return wsrc.slice(i, j + 1) };
  return new Function(src + '\n' + pick('subLayers') + '\n' + pick('tileDens') + '\n' + pick('mergeTiles') + ';return {decodeMVT,buildCell,makeDem,earcut,subLayers,tileDens,mergeTiles,ME,MH}')() }
function celle(M, insieme) {
  const DD = path.join(DATI, 'next', insieme) + '/', TC = new Map(), tile = (x, y) => { const k = x + ',' + y; if (TC.has(k)) return TC.get(k); const f = DD + `vt/14/${x}/${y}.pbf`; const L = fs.existsSync(f) ? M.decodeMVT(fs.readFileSync(f)) : null; TC.set(k, L); return L };
  let T = insieme === 'real_test' ? [[8529, 5973], [8529, 5974], [8529, 5975], [8530, 5973], [8530, 5974], [8530, 5975]] : null;
  if (!T) { T = []; for (const xs of fs.readdirSync(DD + 'vt/14')) for (const f of fs.readdirSync(DD + 'vt/14/' + xs)) { const L = tile(+xs, +f.split('.')[0]); if (L && L.transportation && L.transportation.n >= 12) T.push([+xs, +f.split('.')[0]]) } }
  const y14 = T.reduce((a, t) => a + t[1], 0) / T.length, lat0 = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y14 + .5) / 16384))) * 180 / Math.PI, K = Math.cos(lat0 * Math.PI / 180), Sm = M.ME / 32768;
  const dem = M.makeDem(12, (tx, ty) => { const f = DD + `dem/12/${tx}/${ty}.f32`; return fs.existsSync(f) ? new Float32Array(fs.readFileSync(f).buffer.slice(0)) : null }), out = new Map();
  for (const [x14, y14b] of T) { const L14 = tile(x14, y14b); if (!L14) continue;
    for (let q = 0; q < 4; q++) { const x = x14 * 2 + (q & 1), y = y14b * 2 + (q >> 1), nb = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) { const L2 = tile(x14 + dx, y14b + dy); if (L2) nb.push({ L: L2, dx, dy }) }
      const L = M.subLayers(M.mergeTiles(L14, nb), q & 1, q >> 1, 2), mxL = -M.MH + x * Sm, myT = M.MH - y * Sm;
      const r = M.buildCell(L, { S: Sm * K, mxL, myT, K, dem, lod: 'A', earcut: M.earcut, cx: x, cy: y, blo: -4096, bhi: 8192, blou: -(1 + (x & 1)) * 4096, bhiu: (3 - (x & 1)) * 4096, blov: -(1 + (y & 1)) * 4096, bhiv: (3 - (y & 1)) * 4096, dens: M.tileDens(L14), dbg: 1, RHN: 512 });
      out.set(x + ',' + y, { x, y, r: { S: r.S, RD: r.stat._dbg.RD } }) } }
  return out }
// gradini sui confini: estremità di due celle vicine sullo stesso punto del bordo, stessa classe (come sorgenti/mappa_reale/metriche.js)
function confini(C) { const righe = [];
  for (const A of C.values()) for (const [dx, dy] of [[1, 0], [0, 1]]) { const B = C.get((A.x + dx) + ',' + (A.y + dy)); if (!B) continue; const S = A.r.S, ea = [];
    for (const R of A.r.RD) for (const e of [0, R.m - 1]) { const u = R.S2[e * 2], v = R.S2[e * 2 + 1]; if (dx ? Math.abs(u - S) < .05 : Math.abs(v - S) < .05) ea.push([u, v, R.h[e] + R.lift, R.c]) }
    for (const R of B.r.RD) for (const e of [0, R.m - 1]) { const u = R.S2[e * 2] + (dx ? S : 0), v = R.S2[e * 2 + 1] + (dy ? S : 0); if (dx ? Math.abs(u - S) > .05 : Math.abs(v - S) > .05) continue; let best = null;
      for (const E of ea) { const d = Math.hypot(E[0] - u, E[1] - v); if (d < 1.5 && E[3] === R.c && (!best || d < best[0])) best = [d, E[2]] } if (best) righe.push({ celle: A.x + '/' + A.y + ' – ' + B.x + '/' + B.y, punto: [+u.toFixed(1), +v.toFixed(1)], classe: R.c, gradino: Math.abs(best[1] - (R.h[e] + R.lift)) }) } }
  return righe.sort((a, b) => b.gradino - a.gradino) }

// ------------------------------------------------------------------ prove
const righe = [], criteri = [], scrivi = t => righe.push(t), criterio = (nome, ok, valore, soglia) => criteri.push({ nome, esito: ok === null ? 'NON VERIFICATO' : ok ? 'SUPERATO' : 'NON SUPERATO', valore, soglia });
const sporco = esegui('git', ['status', '--porcelain']).testo.split('\n').filter(l => l.trim() && !/docs\/test\/v31_7_misure_finali\.txt$/.test(l)).length, commit = esegui('git', ['log', '--oneline', '-1']).testo.trim() + (sporco ? ' + ' + sporco + ' file modificati non registrati' : ''), oggi = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';

// 1. test automatici
const tj = esegui('node', ['test/run.js']), mj = tj.testo.match(/(\d+) test superati, (\d+) falliti/), falliti = (tj.testo.match(/^ {2}FAIL .*$/mg) || []);
const tp = esegui('python3', ['tools/test_moduli_python.py']), mp = tp.testo.match(/Ran (\d+) tests?/), pyOk = /\nOK\s*$/.test(tp.testo.trim() + '\n') || /^OK$/m.test(tp.testo);
criterio('test JavaScript (node test/run.js)', mj ? +mj[2] === 0 : false, mj ? mj[1] + ' superati, ' + mj[2] + ' falliti' : 'uscita non riconosciuta', SOGLIE.testJs);
criterio('test Python (tools/test_moduli_python.py)', mp ? pyOk : false, mp ? mp[1] + ' test, ' + (pyOk ? 'OK' : 'errori') : 'uscita non riconosciuta', SOGLIE.testPy);

// 2. confini fra celle e incroci: generatore attuale e generatore del commit PRIMA, stesse misure
const vecchio = esegui('git', ['show', PRIMA + ':sorgenti/mappa_reale/cella.js']);
const GEN = { attuale: generatore(fs.readFileSync(path.join(MAPPA, 'cella.js'), 'utf8')) }; if (vecchio.codice === 0) GEN[PRIMA] = generatore(vecchio.testo);
const met = (file, insieme) => { const t = esegui('node', ['sorgenti/mappa_reale/metriche.js', '0', file], { SET: insieme, DATI }).testo, g = re => { const m = t.match(re); return m ? m.slice(1).map(Number) : null };
  return { incroci: g(/incroci: (\d+), gradino >30 cm: (\d+), >1 m: (\d+), massimo ([\d.]+) m/), muri: g(/dentro un'altra carreggiata: (\d+)\/(\d+)/), muriDisegno: g(/dentro l'asfalto disegnato: (\d+)/), segni: g(/staccata \(>10 cm\): (\d+)\/(\d+)/) } };
const tmpVecchio = path.join(MAPPA, '_cella_' + PRIMA + '.js'); if (vecchio.codice === 0) fs.writeFileSync(tmpVecchio, vecchio.testo);
const MIS = {};
try { for (const ins of ['real_test', 'real_test_andorra']) { MIS[ins] = {};
    for (const [nome, M] of Object.entries(GEN)) { const C = celle(M, ins), b = confini(C); MIS[ins][nome] = { celle: C.size, confini: b, met: met(nome === 'attuale' ? 'cella.js' : path.basename(tmpVecchio), ins) } } } }
finally { if (fs.existsSync(tmpVecchio)) fs.unlinkSync(tmpVecchio) }

// 3. facciate e profili (generatore attuale)
const fp = esegui('node', ['tools/collaudo/facciate_profili.js'], { DATI }).testo, fac = {}; for (const m of fp.matchAll(/^(\S+): colonne di facciata (\d+), sospese 15 cm – 1 m: (\d+), oltre 1 m: (\d+) \| profili: tratti (\d+), cambi di pendenza >10 %: (\d+) \(([\d.]+) %\), >20 %: (\d+) \(([\d.]+) %\)/mg)) fac[m[1]] = m.slice(2).map(Number);

// 4. gioco vero in Chromium (facoltativo)
let chrom = null; if (process.env.PAGINA_URL && process.env.DATI_URL) { const U = process.env.DATI_URL, PAGE = process.env.PAGINA_URL + `?vt=${U}/vt/{z}/{x}/{y}.pbf&dem=${U}/dem/{z}/{x}/{y}.webp&pos=43.731818,7.415354`, env = { PAGE, SOLO_LOCALE: '1', THREE_JS: process.env.THREE_JS || '', OUTDIR: fs.mkdtempSync('/tmp/iow_prove_') };
  const pa = (t, k) => { const m = t.match(new RegExp('^' + k + ': (.*)$', 'm')); try { return m ? JSON.parse(m[1]) : null } catch (e) { return null } };
  const a = esegui('node', ['test/scene_chromium.js'], Object.assign({ SCENES: 'test/browser_affondamento.js' }, env), 2400000).testo, g = esegui('node', ['test/scene_chromium.js'], Object.assign({ SCENES: 'test/browser_mappa_v31_gallerie.js' }, env), 2400000).testo;
  chrom = { salita: pa(a, 'a2_salita'), gallerie: pa(g, 'k3_guida'), errori: [a, g].map(t => (t.match(/errori nella pagina: (\d+)/) || [])[1]) } }

// ------------------------------------------------------------------ criteri sulle misure
for (const ins of ['real_test', 'real_test_andorra']) { const A = MIS[ins].attuale, nomeI = ins === 'real_test' ? 'Monaco' : 'Andorra';
  const oltreC = A.confini.filter(x => x.gradino > SOGLIE.gradiniConfine.oltre).length; criterio(nomeI + ': gradini fra celle oltre 30 cm', oltreC <= SOGLIE.gradiniConfine.massimo, oltreC + ' (massimo ' + (A.confini[0] ? A.confini[0].gradino.toFixed(2) : '0') + ' m su ' + A.confini.length + ' estremità)', '≤ ' + SOGLIE.gradiniConfine.massimo);
  const inc = A.met.incroci; criterio(nomeI + ': gradini agli incroci oltre 30 cm', inc ? inc[1] <= SOGLIE.gradiniIncroci.massimo : null, inc ? inc[1] + ' (massimo ' + inc[3].toFixed(2) + ' m su ' + inc[0] + ' incroci)' : 'non misurato', '≤ ' + SOGLIE.gradiniIncroci.massimo);
  const f = fac[ins]; criterio(nomeI + ': facciate sospese 15 cm – 1 m', f ? f[1] <= SOGLIE.facciateSospese.massimo : null, f ? f[1] + ' su ' + f[0] + ' colonne' : 'non misurato', '≤ ' + SOGLIE.facciateSospese.massimo) }
if (chrom && chrom.salita) { const r = chrom.salita.prove.find(p => p.verso === 'ritorno') || chrom.salita.prove[0], mn = Math.min(...chrom.salita.prove.map(p => p.fondoAsfaltoMinimoM)); criterio('Monaco, via ripida: fondo–asfalto minimo', mn >= SOGLIE.fondoAsfalto.minimoM, (mn * 100).toFixed(1) + ' cm', '≥ ' + SOGLIE.fondoAsfalto.minimoM * 100 + ' cm') }
else criterio('Monaco, via ripida: fondo–asfalto minimo', null, 'prova in Chromium non eseguita', '≥ 0 cm');
if (chrom && chrom.gallerie && chrom.gallerie[0]) { const g0 = chrom.gallerie[0]; criterio('Monaco, galleria di 72 m', g0.percorsiM >= SOGLIE.galleria.percorsiMinimoM && !g0.primoUrto, g0.percorsiM + ' m percorsi, urti: ' + (g0.primoUrto ? 'sì' : 'no'), '≥ ' + SOGLIE.galleria.percorsiMinimoM + ' m senza urti') }
else criterio('Monaco, galleria di 72 m', null, 'prova in Chromium non eseguita', '≥ 56 m senza urti');
const superato = criteri.every(c => c.esito === 'SUPERATO');

// ------------------------------------------------------------------ testo del report
const cm = x => (x * 100).toFixed(1) + ' cm';
scrivi('ITALIA OPEN WORLD — REPORT DI COLLAUDO DEL SOFTWARE (calcolato: tools/collaudo/report_finale.js)');
scrivi('Generato: ' + oggi + ' — commit ' + commit + ' — confronto con il commit ' + PRIMA + (vecchio.codice === 0 ? '' : ' (NON disponibile)'));
scrivi('Ambito: misure automatiche su dati salvati in locale (Monaco: OpenStreetMap e rilievo veri; Andorra: OpenStreetMap vero, rilievo');
scrivi('sintetico) e prove nel gioco in Chromium senza schermo con WebGL software. NON sono prove su telefono, PC, console, banco o veicolo');
scrivi('reale; i parametri dell\'auto sono generici e non validati. Non è una certificazione.');
scrivi('');
scrivi('== 1. TELEMETRIA DELLE 4 SONDE DEL PIANALE (200 Hz, forza elastica smorzata nei 5 cm sopra l\'asfalto)');
if (chrom && chrom.salita) { scrivi('Via ripida di Monaco scelta dalla prova: pendenza ' + chrom.salita.pendenza + ', ' + chrom.salita.viaM + ' m, 25 m/s, passi di 1/60 s');
  scrivi('verso      passi  fondo–asfalto min (4 sonde)  fondo–asfalto min (centro)  passi a 200 Hz con la forza  centro sotto il suolo max');
  for (const p of chrom.salita.prove) scrivi(p.verso.padEnd(10) + String(p.passi).padStart(5) + '  ' + cm(p.fondoAsfaltoMinimoM).padStart(27) + '  ' + cm(p.fondoAsfaltoCentroMinimoM).padStart(26) + '  ' + String(p.passiProtezionePianale).padStart(27) + '  ' + cm(p.sottoMassimoM).padStart(24));
  scrivi('(«centro sotto il suolo» è la distanza fra il suolo al centro e il piano delle ruote: con le ruote a terra su una gobba più corta del passo è geometria,');
  scrivi(' non compenetrazione; il fondo della carrozzeria sta 0,23 m sopra quel piano)') }
else scrivi('prova in Chromium non eseguita (servono PAGINA_URL, DATI_URL e THREE_JS)');
const gb = tj.testo.match(/^ {2}(ok|FAIL) +protezione del pianale.*$/m); scrivi('Gobba sintetica di 35 cm (test/run.js, stesso codice della pagina): ' + (gb ? gb[0].trim() : 'test non trovato'));
scrivi('');
scrivi('== 2. NODI E STRADE SUI CONFINI FRA CELLE (estremità sullo stesso punto del bordo, stessa classe di strada)');
for (const ins of ['real_test', 'real_test_andorra']) { scrivi('-- ' + (ins === 'real_test' ? 'Monaco' : 'Andorra') + ' (' + MIS[ins].attuale.celle + ' celle)');
  for (const [nome, X] of Object.entries(MIS[ins])) { const b = X.confini, o = b.filter(x => x.gradino > .3).length, o5 = b.filter(x => x.gradino > .05).length;
    scrivi('  ' + (nome === 'attuale' ? 'dopo (attuale)' : 'prima (' + nome + ')').padEnd(18) + ' estremità confrontate ' + b.length + ', gradino > 5 cm: ' + o5 + ', > 30 cm: ' + o + ', massimo ' + (b[0] ? cm(b[0].gradino) : '0 cm'));
    for (const x of b.slice(0, 5)) if (x.gradino > .05) scrivi('      ' + x.celle + '  punto ' + x.punto.join(', ') + '  ' + x.classe.padEnd(8) + ' ' + cm(x.gradino)) } }
scrivi('');
scrivi('== 3. ALTRE MISURE DELLA MAPPA (sorgenti/mappa_reale/metriche.js; tools/collaudo/facciate_profili.js)');
for (const ins of ['real_test', 'real_test_andorra']) { scrivi('-- ' + (ins === 'real_test' ? 'Monaco' : 'Andorra'));
  for (const [nome, X] of Object.entries(MIS[ins])) { const m = X.met; scrivi('  ' + (nome === 'attuale' ? 'dopo (attuale)' : 'prima (' + nome + ')').padEnd(18) + ' incroci: gradini > 30 cm ' + (m.incroci ? m.incroci[1] + ' (massimo ' + m.incroci[3].toFixed(2) + ' m)' : '?') + ' | muri di pietra dentro un\'altra carreggiata: ' + (m.muri ? m.muri[0] : '?') + ' (nominale)' + (m.muriDisegno ? ', ' + m.muriDisegno[0] + ' (asfalto disegnato)' : '') + ' | segnaletica staccata ' + (m.segni ? m.segni[0] : '?')) }
  const f = fac[ins]; if (f) scrivi('  facciate sospese 15 cm – 1 m: ' + f[1] + ' su ' + f[0] + ' colonne | cambi di pendenza > 10 %: ' + f[5] + ' %, > 20 %: ' + f[7] + ' %') }
scrivi('');
scrivi('== 4. ESITO DEI TEST AUTOMATICI');
scrivi('node test/run.js: ' + (mj ? mj[1] + ' superati, ' + mj[2] + ' falliti' : 'uscita non riconosciuta')); for (const f of falliti) scrivi('  ' + f.trim());
scrivi('python3 tools/test_moduli_python.py: ' + (mp ? mp[1] + ' test, ' + (pyOk ? 'OK' : 'errori') : 'uscita non riconosciuta'));
if (chrom) scrivi('errori nella pagina (Chromium): ' + chrom.errori.join(', ') + ' (risorse esterne non raggiungibili da questo ambiente: tile e copertura del suolo)');
scrivi('');
scrivi('== 5. CRITERI E SOGLIE');
for (const c of criteri) scrivi(c.esito.padEnd(15) + ' ' + c.nome.padEnd(48) + ' valore: ' + c.valore + '   soglia: ' + c.soglia);
scrivi('');
scrivi('INTEGRITY_CHECK = ' + (superato ? 'PASSED' : 'NOT PASSED') + '   (' + criteri.filter(c => c.esito === 'SUPERATO').length + ' criteri su ' + criteri.length + ' superati)');
const uscita = path.join(RADICE, 'docs', 'test', 'v31_7_misure_finali.txt'); fs.writeFileSync(uscita, righe.join('\n') + '\n');
console.log(righe.join('\n')); console.log('\nscritto ' + path.relative(RADICE, uscita)); process.exit(superato ? 0 : 1);
