/* ITALIA OPEN WORLD — test del quadro strumenti e dei comandi a frecce e pedali (logica di motore/cruscotto.js guidata dal motore fisico VERO:
   fisica_veicolo + centralina a 200 Hz + rete ECU + danni). Richiamato da test/run.js; da solo: node test/cruscotto.js */
'use strict';
const path = require('path');
module.exports = function (T) {
  const { test, ok, vicino } = T;
  const Q = require(path.join(__dirname, '..', 'motore', 'cruscotto.js'));
  const F = require(path.join(__dirname, '..', 'motore', 'fisica_veicolo.js'));
  const E = require(path.join(__dirname, '..', 'motore', 'ecu.js'));
  const DAN = require(path.join(__dirname, '..', 'motore', 'danni_meccanici.js'));
  const P = F.DB.parametri('alfa_159_19_jtdm_150');
  /* auto completa come nel gioco: fisica + centralina + rete ECU + danni, e il quadro collegato come in sorgenti/patch_cruscotto_v33.py */
  const auto = (o) => {
    const v = F.crea(P, Object.assign({ Tambiente: 20, carburante: 40 }, o || {})); v.motore.Tacqua = 88; v.motore.Tolio = 90;
    const r = E.crea(v, { seed: 3 }), d = DAN.crea(), q = Q.crea({ redline: P.limitatore }); let x = 0, z = 0, h = 0, m = null;
    const ingressi = (fari) => { const cen = v.centralina, mf = v.mod.freni; let mil = false; try { mil = Object.values(r.ecu.EMS.dtc).some(t => t.stato === 'attivo') } catch (e) { }
      return { quadro: true, motoreAcceso: v.motore.acceso, rpm: v.motore.rpm, vx: v.v, consumoLh: v.motore.consumoLh, Tacqua: v.motore.Tacqua, carbL: v.carburante.litri, serbatoioL: P.serbatoio, riserva: v.carburante.riserva, marcia: v.cambio.marcia,
        frenoMano: false, freniIntegrita: (mf[0] + mf[1] + mf[2] + mf[3]) / 4, centralina: { stato: cen.stato, abs: cen.abs.attivo.some(Boolean), tcs: cen.tcs.attivo, esp: cen.esp.attivo }, absOK: !!v.ecu.abs, espOK: v.ecu.esp !== false,
        batteriaV: r.batteria.V, alternatore: v.mod.alternatore, milDTC: mil, motoreIntegrita: Math.min(d.comp.motore, d.termico), fari: fari || 'spenti', posizione: { x, z } } };
    const passo = (dt, inp, amb, fari, extra) => { const ctx = DAN.aggiorna(d, dt, null, v); F.passo(v, dt, inp, amb); E.passo(r, dt, { danni: ctx }); h += v.r * dt; x += (v.v * Math.sin(h) - v.vy * Math.cos(h)) * dt; z += (v.v * Math.cos(h) + v.vy * Math.sin(h)) * dt; m = Q.aggiorna(q, dt, Object.assign(ingressi(fari), extra || {})); return m };
    return { v, r, d, q, passo, get m() { return m }, get pos() { return { x, z } } };
  };
  const corri = (A, sec, inp, amb, fari, extra, ogni) => { const st = []; for (let i = 0; i < Math.round(sec * 60); i++) { A.passo(1 / 60, Object.assign({}, inp), amb, fari, extra); if (ogni) ogni(A.m, i) } return A.m };

  /* ---------------- strumenti ---------------- */
  test('quadro: scale vere (tachimetro 0–280 su 220°, contagiri 0–8 su 190°, zona rossa dal limitatore del veicolo) e funzioni di lettura', () => {
    const L = Q.LAYOUT; vicino(Q.angolo(L.vel, 0), 160, 1e-9); vicino(Q.angolo(L.vel, 140 / 280), 270, 1e-9, '140 km/h in alto'); vicino(Q.angolo(L.vel, 1), 380, 1e-9);
    vicino(Q.angolo(L.giri, 4 / 8), 270, 1e-9, '4000 giri in alto'); ok(Q.crea({ redline: P.limitatore }).redline === P.limitatore, 'zona rossa dal limitatore (' + P.limitatore + ')');
    vicino(Q.tempFrazione(95), 0.5, 1e-9, 'temperatura tamponata a metà'); ok(Q.tempFrazione(40) === 0 && Q.tempFrazione(130) === 1 && Q.tempFrazione(115) > 0.6);
    vicino(Q.kmlIstantaneo(90, 4.5), 20, 1e-9); ok(Q.kmlIstantaneo(0, 0.6) === 0 && Q.kmlIstantaneo(80, 0) === 30, 'fermo 0 km/l, rilascio a fondo scala');
  });
  test('quadro: lancette con dinamica del secondo ordine — giro di prova all\'accensione, poi tachimetro e contagiri sulle variabili della fisica (accelerazione vera)', () => {
    const A = auto(); let sweepMax = 0; corri(A, 1.2, { iy: 0 }, {}, 'spenti', null, m => { sweepMax = Math.max(sweepMax, m.aghi.vel) });
    ok(sweepMax > 0.9, 'giro di prova: ' + sweepMax.toFixed(2));
    corri(A, 2, { iy: 0 }); vicino(A.m.aghi.vel, 0, 0.01, 'da fermo'); vicino(A.m.aghi.giri * 8000, A.v.motore.rpm, 60, 'minimo sul contagiri');
    let errMax = 0; corri(A, 12, { acc: 1, iy: 1 }, {}, 'spenti', null, (m, i) => { if (i > 90) errMax = Math.max(errMax, Math.abs(m.aghi.vel * 280 - Math.abs(A.v.v) * 3.6)) });
    const kmh = Math.abs(A.v.v) * 3.6; ok(kmh > 90, 'velocità ' + kmh.toFixed(0)); vicino(A.m.aghi.vel * 280, kmh, 1.5, 'tachimetro = |vx|'); ok(errMax < 6, 'ritardo massimo della lancetta in accelerazione: ' + errMax.toFixed(2) + ' km/h');
    vicino(A.m.aghi.giri * 8000, A.v.motore.rpm, 120, 'contagiri = giri del motore');
  });
  test('quadro: km/l istantaneo dal consumo del motore (crociera, rilascio con iniezione tagliata, fermo)', () => {
    const A = auto(); F.impostaVelocita(A.v, 90 / 3.6); A.v.cambio.marcia = 6; let ie = 0;
    corri(A, 8, {}, {}, 'spenti', null); for (let i = 0; i < 480; i++) { const e = 25 - A.v.v; ie += e / 60; const a = Math.max(0, Math.min(1, 0.25 + 0.3 * e + 0.1 * ie)); A.passo(1 / 60, { acc: a, iy: a }) }
    const atteso = Math.abs(A.v.v) * 3.6 / A.v.motore.consumoLh; vicino(A.m.lcd.kml, atteso, atteso * 0.12, 'km/l a velocità costante'); ok(A.m.lcd.kml > 12 && A.m.lcd.kml < 30, 'km/l ' + A.m.lcd.kml.toFixed(1));
    corri(A, 1.5, { acc: 0, iy: 0 }); ok(A.m.lcd.kml > 28, 'rilascio: ' + A.m.lcd.kml.toFixed(1)); corri(A, 25, { freno: 1, iy: -0.01 }); ok(A.m.lcd.kml < 1, 'fermo: ' + A.m.lcd.kml.toFixed(2));
  });
  test('quadro: chilometri totali e parziali misurati sulla mappa (percorso con curve), teletrasporti esclusi, display a 6 cifre', () => {
    const A = auto(); corri(A, 30, { acc: 0.7, iy: 0.7, sterzo: 0.03 }); const percorso = A.v.odometro / 1000;
    vicino(A.q.odo.parzialeKm, percorso, 0.01, 'parziale = strada percorsa'); vicino(A.q.odo.totaleKm, 157256 + percorso, 0.01); ok(A.m.lcd.totale === String(Math.floor(157256 + percorso)) && A.m.lcd.parziale === (Math.floor(A.q.odo.parzialeKm * 10) / 10).toFixed(1));
    const prima = A.q.odo.parzialeKm; Q.aggiorna(A.q, 1 / 60, { quadro: true, posizione: { x: A.pos.x + 5000, z: A.pos.z } }); vicino(A.q.odo.parzialeKm, prima, 1e-9, 'salto di 5 km ignorato');
  });
  test('quadro: livello carburante legato al serbatoio che si svuota (consumo vero del motore, galleggiante smorzato 6 s), temperatura che sale al riscaldamento', () => {
    const A = auto({ carburante: 20 }); A.v.motore.Tacqua = 30; corri(A, 6, { iy: 0 }); const f0 = A.m.aghi.carb; vicino(f0, 20 / 70, 0.02, 'livello iniziale');
    const L0 = A.v.carburante.litri, c0 = A.v.carburante.consumoTot; corri(A, 20, { acc: 1, iy: 1 }); const cons = A.v.carburante.consumoTot - c0; vicino(L0 - A.v.carburante.litri, cons, 1e-6, 'il serbatoio scende del consumo calcolato'); ok(cons > 0.03, 'consumati ' + cons.toFixed(3) + ' L');
    A.v.carburante.litri -= 8; corri(A, 1, { acc: 0.4, iy: 0.4 }); const f1 = A.m.aghi.carb, salto = f0 - A.v.carburante.litri / 70; ok(f0 - f1 > 0.005 && f0 - f1 < salto * 0.25, 'dopo 1 s la lancetta è scesa di ' + (f0 - f1).toFixed(3) + ' su ' + salto.toFixed(3) + ' (smorzata)');
    corri(A, 30, { acc: 0.4, iy: 0.4 }); vicino(A.m.aghi.carb, A.v.carburante.litri / 70, 0.01, 'a regime sul livello vero');
    ok(A.m.aghi.temp > Q.tempFrazione(30) && A.v.motore.Tacqua > 30, 'temperatura in salita');
    A.v.carburante.litri = 5; corri(A, 1, { iy: 0 }); ok(A.m.spie.riserva.stato === 'accesa', 'riserva');
  });
  /* ---------------- spie collegate alla centralina a 200 Hz ---------------- */
  test('spie: ABS LAMPEGGIA mentre l\'ABS regola (frenata a fondo da 100 km/h) e si spegne finita la regolazione', () => {
    const A = auto(); F.impostaVelocita(A.v, 100 / 3.6); A.v.cambio.marcia = 4; corri(A, 3, {});
    let lamp = 0, on = 0, off = 0; corri(A, 3, { freno: 1, iy: 0 }, {}, 'spenti', null, m => { if (m.spie.abs.stato === 'lampeggio') { lamp++; m.spie.abs.accesa ? on++ : off++ } });
    ok(A.v.centralina.stat.cicliABS > 0 && lamp > 30 && on > 5 && off > 5, 'lampeggio: ' + lamp + ' fotogrammi (' + on + ' accesa, ' + off + ' spenta)');
    corri(A, 3, { iy: 0 }); ok(A.m.spie.abs.stato === 'spenta', 'spenta a fine frenata');
  });
  test('spie: ESP/TCS LAMPEGGIA quando il controllo di trazione interviene (gas a fondo su neve)', () => {
    const A = auto(); corri(A, 2.5, { iy: 0 }); let lamp = 0; corri(A, 4, { acc: 1, iy: 1 }, { superficie: 'neve' }, 'spenti', null, m => { if (m.spie.esp.stato === 'lampeggio') lamp++ });
    ok(lamp > 30, 'fotogrammi di lampeggio: ' + lamp); ok(A.m.spie.abs.stato === 'spenta', 'ABS spenta');
  });
  test('spie: BLACKOUT oltre 15 g → ABS ed ESP ACCESE FISSE (anche frenando e pattinando: nessun lampeggio), impianto frenante acceso (EBD perso)', () => {
    const A = auto(); F.impostaVelocita(A.v, 90 / 3.6); A.v.cambio.marcia = 4; corri(A, 3, {}); F.urto(A.v, 22);
    let fisse = true; corri(A, 4, { freno: 1, iy: 0 }, {}, 'spenti', null, m => { if (!(m.spie.abs.stato === 'accesa' && m.spie.abs.accesa && m.spie.esp.stato === 'accesa' && m.spie.esp.accesa)) fisse = false });
    corri(A, 3, { acc: 1, iy: 1 }, { superficie: 'neve' }, 'spenti', null, m => { if (m.spie.abs.stato !== 'accesa' || m.spie.esp.stato !== 'accesa') fisse = false });
    ok(fisse, 'ABS ed ESP sempre fisse in blackout'); ok(A.m.spie.freno.stato === 'accesa', 'spia impianto frenante'); ok(/BLACKOUT/.test(A.m.spie.abs.motivo));
    F.riavviaCentralina(A.v); corri(A, 1, { iy: 0 }); ok(A.m.spie.abs.stato === 'spenta' && A.m.spie.esp.stato === 'spenta', 'spente dopo la sostituzione in officina');
  });
  test('spie: urto sotto la soglia (14 g) → nessuna spia fissa; guasto di un sensore ruota → ABS ed ESP fisse (rete di bordo)', () => {
    const A = auto(); corri(A, 3, { iy: 0 }); F.urto(A.v, 14); corri(A, 1, { iy: 0 }); ok(A.m.spie.abs.stato === 'spenta' && A.m.spie.esp.stato === 'spenta');
    E.iniettaGuasto(A.r, { ecu: 'ABS', sensore: 'ruotaAS', tipo: 'perdita' }); corri(A, 1, { iy: 0 }); ok(A.m.spie.abs.stato === 'accesa' && A.m.spie.esp.stato === 'accesa' && /rete di bordo/.test(A.m.spie.abs.motivo));
  });
  test('spie: motore KO (danni della carrozzeria deformabile) → guasto motore e pressione olio accese all\'istante; motore sano → spente', () => {
    const A = auto(); corri(A, 3, { iy: 0 }); ok(A.m.spie.motore.stato === 'spenta' && A.m.spie.olio.stato === 'spenta', 'sano');
    DAN.aggiorna(A.d, 1 / 60, { zones: [0.6, 0.6, 0, 0, 0, 0], fC: 0.8, rC: 0, sL: 0, sR: 0, fS: 0.2, hubs: [], engine: 0.2 }, A.v); A.passo(1 / 60, { iy: 0 });
    ok(A.d.comp.motore < 0.3, 'integrità motore ' + A.d.comp.motore); ok(A.m.spie.motore.stato === 'accesa' && A.m.spie.olio.stato === 'accesa' && /KO/.test(A.m.spie.olio.motivo), 'spie accese nello stesso fotogramma');
  });
  test('spie: quadro acceso e motore spento → olio, batteria e motore accese (come nelle auto vere); autotest di 2 s all\'accensione', () => {
    const A = auto({ acceso: false }); A.passo(1 / 60, { iy: 0 }); const tutte = Q.ID_SPIE.filter(id => !['frecciaSx', 'frecciaDx', 'abbaglianti', 'posizione', 'anabbaglianti', 'retronebbia', 'sensoriPark'].includes(id));
    ok(tutte.every(id => A.m.spie[id].accesa), 'autotest: tutte accese'); corri(A, 2.5, { iy: 0 });
    ok(A.m.spie.olio.stato === 'accesa' && A.m.spie.batteria.stato === 'accesa' && A.m.spie.motore.stato === 'accesa' && A.m.spie.lunotto.stato === 'spenta' && A.m.spie.lavavetri.stato === 'spenta', 'motore spento');
  });
  test('spie: portiere bloccate → freno di stazionamento (P) e portiere accese finché non si esce; fari, frecce di emergenza (1,5 Hz), sensori in retromarcia, cintura', () => {
    const A = auto(); corri(A, 3, { iy: 0 }); corri(A, 0.5, { iy: 0 }, {}, 'spenti', { porteBloccate: true }); ok(A.m.spie.frenoMano.stato === 'accesa' && A.m.spie.porte.stato === 'accesa' && /10 calci/.test(A.m.spie.porte.motivo));
    corri(A, 0.5, { iy: 0 }, {}, 'spenti', { porteBloccate: false }); ok(A.m.spie.frenoMano.stato === 'spenta' && A.m.spie.porte.stato === 'spenta', 'spente dopo l\'uscita');
    corri(A, 0.2, { iy: 0 }, {}, 'abbaglianti'); ok(A.m.spie.abbaglianti.accesa && A.m.spie.anabbaglianti.accesa && A.m.spie.posizione.accesa);
    corri(A, 0.2, { iy: 0 }, {}, 'posizione'); ok(!A.m.spie.abbaglianti.accesa && !A.m.spie.anabbaglianti.accesa && A.m.spie.posizione.accesa);
    let cambi = 0, prec = null; corri(A, 2, { iy: 0 }, {}, 'spenti', { emergenza: true }, m => { if (prec !== null && m.spie.frecciaSx.accesa !== prec) cambi++; prec = m.spie.frecciaSx.accesa; ok(m.spie.frecciaSx.accesa === m.spie.frecciaDx.accesa) });
    ok(cambi >= 5 && cambi <= 7, 'emergenza: ' + cambi + ' cambi in 2 s');
    corri(A, 3, { iy: -0.6 }); ok(A.v.cambio.marcia < 0 && A.m.spie.sensoriPark.stato === 'accesa', 'sensori di parcheggio in retromarcia');
    const B = auto(); B.passo(1 / 60, { iy: 0 }); ok(B.m.spie.cintura.accesa, 'cintura da allacciare all\'accensione'); corri(B, 3, { iy: 0 }); ok(B.m.spie.cintura.stato === 'spenta');
  });

  /* ---------------- comandi a frecce e pedali ---------------- */
  test('comandi: frecce con sterzo a rampa (pieno in 0,22 s, ritorno in 0,15 s), pedali analogici dal punto toccato con il ritardo del piede', () => {
    const c = Q.creaComandi(); Q.premi(c, 'dx'); let o; for (let i = 0; i < 6; i++) o = Q.passoComandi(c, 1 / 60); ok(o.ix > 0.4 && o.ix < 0.6, 'a 0,1 s: ' + o.ix.toFixed(2));
    for (let i = 0; i < 10; i++) o = Q.passoComandi(c, 1 / 60); vicino(o.ix, 1, 1e-9); Q.rilascia(c, 'dx'); for (let i = 0; i < 9; i++) o = Q.passoComandi(c, 1 / 60); vicino(o.ix, 0, 1e-9, 'ritorno al centro');
    Q.premi(c, 'sx'); for (let i = 0; i < 20; i++) o = Q.passoComandi(c, 1 / 60); vicino(o.ix, -1, 1e-9); Q.rilascia(c, 'sx');
    Q.premi(c, 'acc', 0); for (let i = 0; i < 30; i++) o = Q.passoComandi(c, 1 / 60); vicino(o.acc, 1, 0.01, 'pedale in alto = 100 %'); vicino(o.iy, 1, 0.01);
    Q.premi(c, 'acc', 1); for (let i = 0; i < 30; i++) o = Q.passoComandi(c, 1 / 60); vicino(o.acc, 0.25, 0.01, 'pedale in basso = 25 %'); Q.premi(c, 'acc', 0.5); for (let i = 0; i < 30; i++) o = Q.passoComandi(c, 1 / 60); vicino(o.acc, 0.625, 0.01, 'a metà');
    Q.premi(c, 'freno', 0); for (let i = 0; i < 30; i++) o = Q.passoComandi(c, 1 / 60); vicino(o.iy, 0.625 - 1, 0.01, 'freno e gas insieme'); Q.rilascia(c, 'acc'); Q.rilascia(c, 'freno'); for (let i = 0; i < 40; i++) o = Q.passoComandi(c, 1 / 60); ok(o.acc === 0 && o.freno === 0);
  });
  test('comandi: i pedali guidano il motore fisico — acceleratore lineare sulla coppia (25/62/100 %), freno sull\'impianto idraulico (ABS in regolazione)', () => {
    const coppia = rel => { const v = F.crea(P, { Tambiente: 20, carburante: 30 }); v.motore.Tacqua = 90; v.cambio.modo = 'man'; v.cambio.marcia = 3; F.impostaVelocita(v, 14); const c = Q.creaComandi(); Q.premi(c, 'acc', rel); let o; for (let i = 0; i < 40; i++) { o = Q.passoComandi(c, 1 / 60); F.passo(v, 1 / 60, { iy: o.iy }) } return { acc: o.acc, eff: v.motore.accEff, T: v.motore.coppia } };
    const a = coppia(1), b = coppia(0.5), m = coppia(0); vicino(a.eff, 0.25, 0.01); vicino(b.eff, 0.625, 0.01); vicino(m.eff, 1, 0.01); ok(a.T < b.T && b.T < m.T, 'coppia crescente con il pedale: ' + [a.T, b.T, m.T].map(Math.round).join(' < '));
    const v = F.crea(P, { Tambiente: 20, carburante: 30 }); F.impostaVelocita(v, 25); v.cambio.marcia = 4; const c = Q.creaComandi(); Q.premi(c, 'freno', 0); let abs = false; for (let i = 0; i < 120; i++) { const o = Q.passoComandi(c, 1 / 60); F.passo(v, 1 / 60, { iy: o.iy }); if (v.freni.abs) abs = true }
    ok(abs && v.v < 15, 'frenata con il pedale: ABS ' + abs + ', ' + (v.v * 3.6).toFixed(0) + ' km/h');
  });
};
if (require.main === module) {
  let p = 0, f = 0; const T = { test: (n, fn) => { try { fn(); p++; console.log('  ok   ' + n) } catch (e) { f++; console.log('  FAIL ' + n + '\n         ' + (e && e.message || e)) } }, ok: (c, m) => { if (!c) throw new Error(m || 'condizione falsa') }, vicino: (a, b, t, m) => { if (Math.abs(a - b) > t) throw new Error((m || '') + ' atteso ' + b + ' ±' + t + ', ottenuto ' + a) } };
  module.exports(T); console.log('\n' + p + ' test superati, ' + f + ' falliti'); process.exit(f ? 1 : 0);
}
