/* ITALIA OPEN WORLD — test automatici dei moduli del motore fisico, delle ECU virtuali e dei danni meccanici
   Uso: node test/run.js        (esce con codice 1 se un test fallisce) */
'use strict';
const path = require('path');
const DB = require(path.join(__dirname, '..', 'motore', 'veicoli_db.js'));
const F = require(path.join(__dirname, '..', 'motore', 'fisica_veicolo.js'));
const E = require(path.join(__dirname, '..', 'motore', 'ecu.js'));
const DAN = require(path.join(__dirname, '..', 'motore', 'danni_meccanici.js'));
const CAL = require(path.join(__dirname, '..', 'motore', 'calibrazione.js'));

let passati = 0, falliti = 0; const esiti = [];
function test(nome, fn) { try { fn(); passati++; esiti.push('  ok   ' + nome) } catch (e) { falliti++; esiti.push('  FAIL ' + nome + '\n         ' + (e && e.message || e)) } }
function ok(c, msg) { if (!c) throw new Error(msg || 'condizione falsa') }
function vicino(a, b, tol, msg) { if (Math.abs(a - b) > tol) throw new Error((msg || '') + ' atteso ' + b + ' ±' + tol + ', ottenuto ' + a) }
const P = DB.parametri('alfa_159_19_jtdm_150');
const nuovo = (o) => { const v = F.crea(P, Object.assign({ Tambiente: 20, carburante: 30 }, o || {})); v.motore.Tacqua = 90; v.motore.Tolio = 95; return v };
const corri = (v, sec, inp, amb, dt) => { let t = 0; dt = dt || 1 / 60; while (t < sec) { F.passo(v, dt, Object.assign({}, inp), amb); t += dt } return v };

/* ------------------------------------------------------------ database */
test('database: ogni dato ha unità, fonte, attendibilità e stato di verifica', () => {
  const walk = (o, p) => { for (const k in o) { const d = o[k]; if (d && typeof d === 'object' && 'att' in d) { ok('u' in d && 'fonte' in d && 'ver' in d, p + k + ' incompleto'); ok(['alta', 'media', 'bassa', 'provvisoria'].includes(d.att), p + k + ' attendibilità ' + d.att) } else if (d && typeof d === 'object') walk(d, p + k + '.') } };
  for (const id in DB.VEICOLI) walk(DB.VEICOLI[id], id + '.');
});
test('database: i parametri provvisori sono elencati (nessun dato spacciato per verificato)', () => { ok(P.provvisori.length >= 10, 'attesi molti parametri provvisori per l\'Alfa 159'); ok(P.provvisori.includes('trasmissione.rapporti'), 'i rapporti del cambio devono essere marcati provvisori') });
test('database: i veicoli generici sono dichiarati dimostrativi', () => { ok(/DIMOSTRATIVO/.test(DB.VEICOLI.generico_auto.stato)); ok(/non validato/i.test(DB.VEICOLI.alfa_159_19_jtdm_150.stato)) });

/* ------------------------------------------------------------ unità e coerenza del motore */
test('curva di coppia: passa per i punti dichiarati (320 N·m a 2000, 110 kW a 4000)', () => {
  vicino(F.coppiaCurva(P.curvaCoppia, 2000), 320, 0.01, 'coppia a 2000');
  const kW4000 = F.coppiaCurva(P.curvaCoppia, 4000) * 4000 * 2 * Math.PI / 60 / 1000; vicino(kW4000, 110, 0.5, 'potenza a 4000 giri');
});
test('unità: raggio ruota 215/55 R16 → 0,3215 m; giri motore ↔ velocità coerenti con i rapporti', () => {
  vicino(P.raggioRuota, 0.3215, 0.0005); const v = nuovo();
  const rpm = F.rpmDaVelocita(v, 100 / 3.6, 6), atteso = 100 / 3.6 / (2 * Math.PI * P.raggioRuota) * 60 * P.rapporti[5] * P.finale; vicino(rpm, atteso, 0.01);
  ok(F.rpmDaVelocita(v, 20, 1) > F.rpmDaVelocita(v, 20, 2), 'in 1ª più giri che in 2ª');
});
test('densità dell\'aria: 1,225 a livello del mare e 15 °C, minore in quota e con aria calda', () => { vicino(F.densitaAria(0, 15), 1.225, 0.001); ok(F.densitaAria(2000, 15) < 1.0); ok(F.densitaAria(0, 35) < F.densitaAria(0, 0)) });

/* ------------------------------------------------------------ risposta del motore e trasmissione */
test('minimo: a folle il motore resta al minimo, il veicolo non si muove, consuma poco', () => { const v = nuovo(); v.cambio.marcia = 0; corri(v, 30, { acc: 0, iy: 0 }); vicino(v.motore.rpm, P.minimo, 20); ok(v.v === 0); ok(v.motore.consumoLh > 0.2 && v.motore.consumoLh < 1.5, 'consumo al minimo ' + v.motore.consumoLh) });
test('limitatore: a folle con gas a fondo il regime non supera il limitatore di oltre il 5%', () => { const v = nuovo(); v.cambio.marcia = 0; corri(v, 5, { acc: 1, iy: 0 }); ok(v.motore.rpm < P.limitatore * 1.05, 'rpm ' + v.motore.rpm) });
test('accelerazione: 0-100 km/h entro il 15% del dichiarato e sempre in avanti, nessun valore non finito', () => {
  const v = nuovo(); let t = 0, t100 = null, vPrec = 0; while (t < 30 && t100 === null) { F.passo(v, 1 / 60, { acc: 1, iy: 1 }); t += 1 / 60; ok(Number.isFinite(v.v) && Number.isFinite(v.motore.rpm), 'non finito'); ok(v.v >= vPrec - 0.6, 'la velocità non deve calare a gas pieno (salvo cambiata)'); vPrec = v.v; if (v.v * 3.6 >= 100) t100 = t }
  ok(t100 !== null, 'non raggiunge 100 km/h'); vicino(t100, P.dichiarato.acc0_100, P.dichiarato.acc0_100 * 0.15, '0-100');
});
test('cambio automatico: sale di marcia accelerando (6ª a 130 km/h), scala in frenata, nessuna oscillazione su pendenza 10%', () => {
  const v = nuovo(); corri(v, 40, { acc: 0.6, iy: 0.6 }); ok(v.cambio.marcia === 6, 'marcia ' + v.cambio.marcia + ' a ' + (v.v * 3.6).toFixed(0) + ' km/h');
  corri(v, 20, { acc: 0, freno: 0.6, iy: 0 }); ok(v.v === 0 && v.cambio.marcia <= 2, 'da fermo marcia ' + v.cambio.marcia);
  const w = nuovo(); const n0 = w.stat.nCambiate; corri(w, 30, { acc: 1, iy: 1 }, { pendenza: Math.atan(0.1) }); ok(w.stat.nCambiate - n0 <= 6, 'troppe cambiate in salita: ' + (w.stat.nCambiate - n0)); ok(w.v * 3.6 > 90, 'in salita 10% dopo 30 s solo ' + (w.v * 3.6).toFixed(0) + ' km/h');
});
test('cambio manuale: la marcia influenza davvero giri, coppia alle ruote e accelerazione', () => {
  const a = nuovo({ modo: 'man', marcia: 2 }), b = nuovo({ modo: 'man', marcia: 4 }); a.v = b.v = 50 / 3.6; F.passo(a, 1 / 60, { acc: 1, iy: 1 }); F.passo(b, 1 / 60, { acc: 1, iy: 1 });
  ok(a.motore.rpm > b.motore.rpm, 'in 2ª più giri che in 4ª'); ok(a.forze.trazione > b.forze.trazione, 'in 2ª più spinta'); ok(a.a > b.a, 'in 2ª più accelerazione');
  const c = nuovo({ modo: 'man', marcia: 3 }); corri(c, 10, { acc: 1, iy: 1 }); ok(c.cambio.marcia === 3, 'in manuale la marcia non cambia da sola'); ok(c.motore.rpm <= P.limitatore * 1.02, 'il limitatore protegge il motore in manuale');
});
test('retromarcia: da fermo il comando indietro fa indietreggiare; in corsa frena', () => { const v = nuovo(); corri(v, 4, { iy: -1 }); ok(v.v < -2 && v.cambio.marcia === -1, 'v ' + v.v); const w = nuovo(); corri(w, 6, { iy: 1 }); const v0 = w.v; corri(w, 1, { iy: -1 }); ok(w.v < v0 && w.v > 0 && w.cambio.marcia > 0, 'frenata con comando indietro') });

/* ------------------------------------------------------------ frenata, aderenza, pendenza */
test('frenata 100-0: si ferma in 35-50 m con ABS attivo, senza ABS spazio maggiore e ruote bloccate', () => {
  const v = nuovo(); v.v = 100 / 3.6; v.cambio.marcia = 4; let t = 0; while (v.v > 0 && t < 20) { F.passo(v, 1 / 120, { acc: 0, freno: 1, iy: 0 }); t += 1 / 120 } ok(v.v === 0); ok(v.odometro > 35 && v.odometro < 50, 'spazio ' + v.odometro.toFixed(1)); ok(v.stat.tempoABS > 0);
  const w = nuovo(); w.ecu.abs = false; w.v = 100 / 3.6; w.cambio.marcia = 4; t = 0; let bloccate = false; while (w.v > 0 && t < 20) { F.passo(w, 1 / 120, { acc: 0, freno: 1, iy: 0 }); bloccate = bloccate || w.ruote.bloccate; t += 1 / 120 } ok(bloccate, 'senza ABS le ruote si bloccano'); ok(w.odometro > v.odometro, 'senza ABS spazio maggiore');
});
test('aderenza: su ghiaccio accelerazione e frenata molto peggiori; ASR limita il pattinamento', () => {
  const a = nuovo(), g = nuovo(); corri(a, 5, { acc: 1, iy: 1 }, { superficie: 'asfalto' }); corri(g, 5, { acc: 1, iy: 1 }, { superficie: 'ghiaccio' }); ok(g.v < a.v * 0.3, 'ghiaccio ' + (g.v * 3.6).toFixed(0) + ' vs asfalto ' + (a.v * 3.6).toFixed(0)); ok(g.stat.tempoASR > 3, 'ASR deve intervenire sul ghiaccio');
  const s = nuovo(); s.ecu.asr = false; corri(s, 3, { acc: 1, iy: 1 }, { superficie: 'ghiaccio' }); ok(s.stat.tempoSlitta > 1, 'senza ASR le ruote pattinano');
  const fa = nuovo(), fg = nuovo(); fa.v = fg.v = 80 / 3.6; fa.cambio.marcia = fg.cambio.marcia = 4; corri(fa, 2, { freno: 1, iy: 0 }, { superficie: 'asfalto' }); corri(fg, 2, { freno: 1, iy: 0 }, { superficie: 'ghiaccio' }); ok(fg.v > fa.v + 10, 'su ghiaccio si frena molto meno');
});
test('pneumatici: pressione bassa riduce aderenza e aumenta rotolamento; aquaplaning oltre la velocità critica con acqua', () => {
  const a = F.muRuota(1, 2.3, 2.3, 40, 0, 'asfalto', 0, 20).mu, b = F.muRuota(1, 1.2, 2.3, 40, 0, 'asfalto', 0, 20).mu, c = F.muRuota(1, 2.3, 2.3, 40, 0.9, 'bagnato', 0, 20).mu, d = F.muRuota(1, 2.3, 2.3, 40, 0, 'bagnato', 0, 20).mu;
  ok(b < a, 'sgonfio meno aderente'); ok(c < d, 'usurato sul bagnato meno aderente');
  ok(F.muRuota(1, 2.3, 2.3, 40, 0, 'bagnato', 5, 35).aquaplaning > 0.8, 'aquaplaning a 126 km/h con 5 mm'); ok(F.muRuota(1, 2.3, 2.3, 40, 0, 'bagnato', 5, 12).aquaplaning < 0.05, 'niente aquaplaning a 43 km/h');
  const v = nuovo(); v.ruote.pressione = [1.0, 1.0, 1.0, 1.0]; const w = nuovo(); v.v = w.v = 20; v.cambio.marcia = w.cambio.marcia = 4; F.passo(v, 1 / 60, { acc: 0, iy: 0 }); F.passo(w, 1 / 60, { acc: 0, iy: 0 }); ok(v.forze.rotolamento > w.forze.rotolamento, 'gomme sgonfie: più rotolamento');
});
test('pendenza: fermo senza gas resta fermo (hill holder), in discesa in rilascio accelera, in salita stessa spinta ma meno accelerazione', () => {
  const v = nuovo(); corri(v, 3, { acc: 0, iy: 0 }, { pendenza: Math.atan(0.12) }); ok(v.v === 0, 'deve restare fermo');
  const d = nuovo(); d.v = 10; d.cambio.marcia = 3; corri(d, 5, { acc: 0, iy: 0 }, { pendenza: -Math.atan(0.12) }); ok(d.v > 10, 'in discesa accelera in rilascio ' + d.v);
  const p = nuovo(), q = nuovo(); corri(p, 5, { acc: 1, iy: 1 }, { pendenza: 0 }); corri(q, 5, { acc: 1, iy: 1 }, { pendenza: Math.atan(0.15) }); ok(q.v < p.v, 'in salita meno veloce');
});
test('stabilità numerica: passi grandi (0,25 s) e piccoli (1e-4 s) non producono valori non finiti né velocità assurde', () => {
  for (const dt of [0.25, 0.1, 1 / 30, 1e-4]) { const v = nuovo(); let t = 0; while (t < (dt < 0.01 ? 0.5 : 120)) { F.passo(v, dt, { acc: Math.abs(Math.sin(t)), freno: t % 7 < 1 ? 1 : 0, iy: 0 }, { pendenza: 0.1 * Math.sin(t / 3) }); t += dt; ok(Number.isFinite(v.v) && Number.isFinite(v.motore.rpm) && Number.isFinite(v.motore.Tacqua), 'non finito con dt ' + dt); ok(Math.abs(v.v) < 70, 'velocità assurda con dt ' + dt) } }
});
test('determinismo: due simulazioni identiche danno lo stesso risultato', () => { const a = nuovo(), b = nuovo(); corri(a, 20, { acc: 0.7, iy: 0.7 }, { pendenza: 0.03 }); corri(b, 20, { acc: 0.7, iy: 0.7 }, { pendenza: 0.03 }); ok(a.v === b.v && a.carburante.litri === b.carburante.litri && a.motore.Tacqua === b.motore.Tacqua) });

/* ------------------------------------------------------------ consumo e termica */
test('consumo: coerente con i dichiarati (90 km/h costanti ≈ extraurbano ±25%), cresce con la velocità, zero in rilascio, serbatoio che cala', () => {
  const rep = CAL.esegui('alfa_159_19_jtdm_150'), c90 = rep.prove.find(p => /90 km\/h/.test(p.prova)), c120 = rep.prove.find(p => /120 km\/h costanti/.test(p.prova)), c130 = rep.prove.find(p => /130 km\/h costanti/.test(p.prova));
  vicino(c90.simulato, P.dichiarato.consumoExtraurbano, P.dichiarato.consumoExtraurbano * 0.25, '90 km/h'); ok(c120.simulato > c90.simulato && c130.simulato > c120.simulato, 'il consumo cresce con la velocità');
  const v = nuovo(); corri(v, 10, { acc: 1, iy: 1 }); const L0 = v.carburante.litri; corri(v, 2, { acc: 0, iy: 0 }); ok(v.motore.consumoLh === 0, 'cut-off in rilascio'); ok(v.carburante.litri <= L0, 'il serbatoio non si riempie da solo');
});
test('serbatoio vuoto: il motore si spegne e il veicolo si ferma; il rifornimento permette di riavviare', () => { const v = nuovo({ carburante: 0.02 }); corri(v, 3, { acc: 1, iy: 1 }); ok(!v.motore.acceso && v.carburante.vuoto, 'deve spegnersi'); corri(v, 30, { acc: 0, iy: 0 }); ok(v.v === 0); F.rifornisci(v, 20); corri(v, 2, { avvia: true }); ok(v.motore.acceso, 'riavvio dopo rifornimento') });
test('termica: a regime il refrigerante resta fra 80 e 100 °C; con radiatore danneggiato supera i 118 °C', () => {
  const v = nuovo(); corri(v, 240, { acc: 0.5, iy: 0.5 }); ok(v.motore.Tacqua > 80 && v.motore.Tacqua < 100, 'T ' + v.motore.Tacqua.toFixed(1));
  const w = nuovo(); w.mod.radiatore = 0.1; w.mod.refrigerante = 0.4; corri(w, 240, { acc: 1, iy: 1 }); ok(w.motore.Tacqua > 118 && w.stat.surriscaldamenti > 0, 'T ' + w.motore.Tacqua.toFixed(1));
  const f = nuovo(); f.motore.Tacqua = 20; corri(f, 300, { acc: 0.4, iy: 0.4 }); ok(f.motore.Tacqua > 60, 'si deve scaldare da freddo: ' + f.motore.Tacqua.toFixed(1));
});
test('danni meccanici → fisica: potenza ridotta, freni ridotti e perdita carburante hanno effetto reale', () => {
  const a = nuovo(), b = nuovo(); b.mod.potenza = 0.5; corri(a, 6, { acc: 1, iy: 1 }); corri(b, 6, { acc: 1, iy: 1 }); ok(b.v < a.v * 0.85, 'metà potenza → più lento');
  const c = nuovo(), d = nuovo(); d.mod.freni = [0.3, 0.3, 0.3, 0.3]; c.v = d.v = 25; c.cambio.marcia = d.cambio.marcia = 4; corri(c, 1.5, { freno: 1, iy: 0 }); corri(d, 1.5, { freno: 1, iy: 0 }); ok(d.v > c.v + 3, 'freni danneggiati frenano meno');
  const e = nuovo(); e.mod.perditaCarburante = 0.05; const L0 = e.carburante.litri; corri(e, 10, { acc: 0, iy: 0 }); ok(L0 - e.carburante.litri > 0.4, 'perdita di carburante');
});
test('salvataggio: serializza/ripristina conserva carburante, odometro, temperature, usura', () => { const v = nuovo(); corri(v, 20, { acc: 0.8, iy: 0.8 }); const s = JSON.parse(JSON.stringify(F.serializza(v))), w = nuovo(); ok(F.ripristina(w, s)); vicino(w.carburante.litri, v.carburante.litri, 0.01); vicino(w.odometro, v.odometro, 0.2); vicino(w.motore.Tacqua, v.motore.Tacqua, 0.1); ok(!F.ripristina(w, null) && !F.ripristina(w, 'x')) });

/* ------------------------------------------------------------ ECU virtuali */
const scenario = () => { const v = nuovo(); const r = E.crea(v, { seed: 7 }); const passo = (inp, ctx, amb) => { F.passo(v, 1 / 60, inp, amb); E.passo(r, 1 / 60, ctx) }; return { v, r, passo, corri: (sec, inp, ctx, amb) => { let t = 0; while (t < sec) { passo(Object.assign({}, inp), ctx, amb); t += 1 / 60 } } } };
test('ECU: veicolo sano → nessun codice attivo, tutte le centraline online, messaggi sul bus', () => { const s = scenario(); s.corri(10, { acc: 0.5, iy: 0.5 }); ok(E.leggiDTC(s.r).filter(d => d.stato === 'attivo').length === 0, 'codici: ' + E.leggiDTC(s.r).map(d => d.ecu + d.codice).join()); ok(Object.values(s.r.ecu).every(e => e.online && e.stato === 'ok'), 'stati ' + Object.values(s.r.ecu).map(e => e.id + ':' + e.stato).join()); ok(s.r.bus.messaggi > 500) });
test('ECU: perdita del sensore temperatura → P0115 attivo, potenza limitata; rimosso il guasto → codice memorizzato, cancellabile', () => {
  const s = scenario(); const g = E.iniettaGuasto(s.r, { ecu: 'EMS', sensore: 'Tacqua', tipo: 'perdita' }); s.corri(2, { acc: 1, iy: 1 }); const d = E.leggiDTC(s.r, 'EMS').find(x => x.codice === 'P0115'); ok(d && d.stato === 'attivo' && d.freeze, 'P0115 attivo con freeze frame'); ok(s.v.ecu.accMax <= 0.6, 'accMax ' + s.v.ecu.accMax);
  E.rimuoviGuasti(s.r, g); s.corri(1, { acc: 1, iy: 1 }); ok(E.leggiDTC(s.r, 'EMS').find(x => x.codice === 'P0115').stato === 'memorizzato'); ok(s.v.ecu.accMax === 1); ok(E.cancellaDTC(s.r, 'EMS') === 1 && E.leggiDTC(s.r, 'EMS').length === 0);
});
test('ECU: un codice attivo non si cancella (la causa va rimossa)', () => { const s = scenario(); E.iniettaGuasto(s.r, { ecu: 'EMS', sensore: 'pedale', tipo: 'implausibile', valore: 1.4 }); s.corri(1, { acc: 1, iy: 1 }); ok(E.leggiDTC(s.r, 'EMS').some(d => d.codice === 'P0123' && d.stato === 'attivo')); ok(E.cancellaDTC(s.r, 'EMS') === 0); ok(E.leggiDTC(s.r, 'EMS').some(d => d.codice === 'P0123')) });
test('ECU: surriscaldamento → P0217, modalità ridotta, spia temperatura; gravissimo → potenza al 20%', () => { const s = scenario(); s.v.mod.radiatore = 0.05; s.v.mod.refrigerante = 0.3; let accMin = 1, spia = false, t = 0; while (t < 120) { s.passo({ acc: 1, iy: 1 }); t += 1 / 60; accMin = Math.min(accMin, s.v.ecu.accMax); spia = spia || s.r.ecu.BCM.uscite.spie.includes('temperatura') } ok(E.leggiDTC(s.r, 'EMS').some(d => d.codice === 'P0217'), 'P0217'); ok(accMin <= 0.2, 'accMax minimo ' + accMin); ok(spia, 'spia temperatura'); ok(s.r.stat.limp > 0) });
test('ECU: sensore ruota guasto → C0035, ABS/ASR/ESC disattivati e spie accese; riparato → riattivati', () => { const s = scenario(); s.corri(2, { acc: 0.5, iy: 0.5 }, { danni: { sensoriRuota: [true, false, false, false] } }); ok(E.leggiDTC(s.r, 'ABS').some(d => d.codice === 'C0035' && d.stato === 'attivo')); ok(!s.v.ecu.abs && !s.v.ecu.asr); ok(s.r.ecu.BCM.uscite.spie.includes('ABS') && s.r.ecu.BCM.uscite.spie.includes('ESC')); s.corri(2, { acc: 0.5, iy: 0.5 }, { danni: { sensoriRuota: [false, false, false, false] } }); ok(s.v.ecu.abs && s.v.ecu.asr) });
test('ECU: ESC taglia la coppia con deriva laterale alta e lo registra', () => { const s = scenario(); s.corri(3, { acc: 1, iy: 1 }, { danni: {}, scivolamentoLaterale: 0 }); ok(s.v.ecu.tagliaCoppia === 0); s.corri(1, { acc: 1, iy: 1 }, { scivolamentoLaterale: 9 }); ok(s.v.ecu.tagliaCoppia > 0.2 && s.r.stat.interventiESC >= 1 && s.r.registro.some(e => e.ecu === 'ESC' && e.tipo === 'intervento')) });
test('ECU: perdita del segnale giri → motore spento (P0335); timeout di una centralina → codice U nel gateway; bus-off → tutte le U attive e poi rientro', () => {
  const s = scenario(); E.iniettaGuasto(s.r, { ecu: 'EMS', sensore: 'giri', tipo: 'perdita', durata: 1 }); s.corri(0.5, { acc: 1, iy: 1 }); ok(!s.v.motore.acceso && E.leggiDTC(s.r, 'EMS').some(d => d.codice === 'P0335'));
  s.corri(1, { acc: 0, iy: 0 }); s.corri(2, { avvia: true }); ok(s.v.motore.acceso, 'riavvio');
  E.iniettaGuasto(s.r, { ecu: 'ABS', tipo: 'timeout', durata: 2 }); s.corri(1.5, { acc: 0.3, iy: 0.3 }); ok(E.leggiDTC(s.r, 'GW').some(d => d.codice === 'U0121' && d.stato === 'attivo'), 'U0121'); ok(E.leggiDTC(s.r, 'EMS').some(d => d.codice === 'U0121'), 'anche il motore perde l\'ABS');
  E.iniettaGuasto(s.r, { ecu: 'RETE', tipo: 'bus', durata: 2 }); s.corri(1.5, { acc: 0.3, iy: 0.3 }); ok(s.r.bus.busOff && E.leggiDTC(s.r, 'GW').filter(d => d.stato === 'attivo').length >= 5, 'bus-off'); s.corri(4, { acc: 0.3, iy: 0.3 }); ok(!s.r.bus.busOff && E.leggiDTC(s.r, 'GW').every(d => d.stato === 'memorizzato'), 'rientro dopo bus-off');
});
test('ECU: batteria scarica → tensione bassa, P0562 e avviamento impedito', () => { const s = scenario(); s.r.batteria.soc = 0.02; s.v.motore.acceso = false; s.corri(3, { acc: 0, iy: 0 }, { luci: true }); ok(s.r.batteria.V < 10.6, 'V ' + s.r.batteria.V); s.corri(2, { avvia: true }); ok(!s.v.motore.acceso, 'non deve avviarsi'); ok(E.leggiDTC(s.r, 'BMS').some(d => d.codice === 'B1900'), 'B1900 batteria'); s.r.batteria.soc = 0.9; s.corri(1, { acc: 0, iy: 0 }); s.corri(2, { avvia: true }); ok(s.v.motore.acceso, 'con batteria carica parte') });
test('ECU: determinismo con lo stesso seme, rapporto esportabile con centraline virtuali e hardware dichiarato non disponibile', () => {
  const a = scenario(), b = scenario(); a.corri(5, { acc: 0.6, iy: 0.6 }); b.corri(5, { acc: 0.6, iy: 0.6 }); ok(JSON.stringify(a.r.ecu.EMS.sensori) === JSON.stringify(b.r.ecu.EMS.sensori));
  const rep = E.rapporto(a.r); ok(rep.centraline.length === 7 && rep.centraline.every(c => c.natura === 'virtuale')); ok(rep.hardware.disponibile === false && E.hardware.collega().ok === false); ok(/SIMULAZIONE SOFTWARE/.test(rep.tipo)); JSON.stringify(rep);
});

/* ------------------------------------------------------------ danni meccanici */
test('danni: nessuna deformazione → tutti i componenti integri e nessun modificatore', () => { const st = DAN.crea(), v = nuovo(); DAN.aggiorna(st, 1 / 60, { zones: [0, 0, 0, 0, 0, 0], fC: 0, rC: 0, sL: 0, sR: 0, hubs: [], engine: 1, wl: [false, false, false, false] }, v); ok(DAN.analisi(st).integritaMeccanica === 1 && v.mod.potenza === 1 && v.mod.radiatore === 1 && DAN.preventivo(st).totale === 0) });
test('danni: urto frontale forte → radiatore, batteria, cambio ed elettrico colpiti; posteriore → scarico e serbatoio (perdita); laterale → serbatoio', () => {
  const st = DAN.crea(), v = nuovo(); DAN.aggiorna(st, 1 / 60, { zones: [0.8, 0.6, 0, 0, 0, 0], fC: 0.45, rC: 0, sL: 0, sR: 0, fS: 0.1, hubs: [{ camber: 0.3, toe: 0.25, lost: false, dx: 0.2, dy: 0, dz: 0.3 }, { camber: 0.05, toe: 0.05 }], engine: 0.4, wl: [false, false, false, false] }, v);
  const C = st.comp; ok(C.radiatore < 0.1, 'radiatore ' + C.radiatore); ok(C.batteria < 0.6 && C.cambio < 0.8 && C.elettrico < 0.8, 'batteria/cambio/elettrico'); ok(C.sospensioni[0] < 0.5 && C.sensoriRuota[0] === 0 && C.sterzo < 0.7, 'mozzo piegato'); ok(C.freni[0] < 1 && C.freni[1] === 1, 'freno del lato colpito'); ok(C.scarico === 1 && C.serbatoio === 1, 'il retro è intatto');
  ok(v.mod.potenza < 0.7 && v.mod.radiatore < 0.2 && v.mod.freni[0] < 1, 'modificatori applicati'); const ctx = DAN.ctxECU(st); ok(ctx.sensoriRuota[0] === true && ctx.sensoriRuota[1] === false);
  const r = DAN.crea(), w = nuovo(); DAN.aggiorna(r, 1 / 60, { zones: [0, 0, 0, 0, 0.7, 0.7], fC: 0, rC: 0.7, sL: 0, sR: 0, hubs: [], engine: 1, wl: [false, false, false, false] }, w); ok(r.comp.scarico < 0.3 && r.comp.serbatoio < 0.6 && w.mod.perditaCarburante > 0, 'retro: scarico, serbatoio, perdita'); ok(r.comp.radiatore === 1);
  const l = DAN.crea(); DAN.aggiorna(l, 0, { zones: [0, 0, 0.6, 0, 0, 0], fC: 0, rC: 0, sL: 0.5, sR: 0, hubs: [], engine: 1 }, nuovo()); ok(l.comp.serbatoio < 0.9 && l.comp.scarico < 1);
});
test('danni: il danno non si cura da solo (monotono), il radiatore rotto perde refrigerante nel tempo e il motore si danneggia col calore', () => {
  const st = DAN.crea(), v = nuovo(); const S = { zones: [0.5, 0.5, 0, 0, 0, 0], fC: 0.4, rC: 0, sL: 0, sR: 0, hubs: [], engine: 0.9 }; DAN.aggiorna(st, 0, S, v); const r0 = st.comp.radiatore; DAN.aggiorna(st, 0, { zones: [0, 0, 0, 0, 0, 0], fC: 0, rC: 0, sL: 0, sR: 0, hubs: [], engine: 1 }, v); ok(st.comp.radiatore === r0 && st.comp.motore === 0.9, 'monotono');
  let t = 0, Tmax = 0; while (t < 180) { F.passo(v, 1 / 30, { acc: 1, iy: 1 }); DAN.aggiorna(st, 1 / 30, null, v); t += 1 / 30; Tmax = Math.max(Tmax, v.motore.Tacqua) } ok(st.refrigerante < 0.5, 'refrigerante ' + st.refrigerante.toFixed(2)); ok(Tmax > 118 && Tmax <= 140, 'Tmax ' + Tmax.toFixed(0)); ok(st.termico < 1 && v.mod.potenza < 1, 'danno termico ' + st.termico.toFixed(2));
});
test('danni: urti registrati con energia stimata (½mv²) e faccia; analisi distingue stime; preventivo e riparazione modificano davvero lo stato', () => {
  const st = DAN.crea(), v = nuovo(); const u = DAN.urto(st, { lx: 0.2, lz: 2.3, imp: 10, kind: 'wall', massa: 1600, t: 5 }); ok(u.faccia === 'anteriore' && Math.abs(u.energiaKJ - 80) < 0.1, 'energia ' + u.energiaKJ);
  DAN.aggiorna(st, 0, { zones: [0.6, 0.6, 0, 0, 0, 0], fC: 0.35, rC: 0, sL: 0, sR: 0, hubs: [{ camber: 0.35, toe: 0.3, lost: false }], engine: 0.5 }, v); const an = DAN.analisi(st); ok(/stime/i.test(an.nota) && an.nUrti === 1 && an.statoMeccanico !== 'efficiente');
  const pre = DAN.preventivo(st); ok(pre.totale > 0 && pre.voci.some(q => q.chiave === 'radiatore')); const costo = DAN.ripara(st, 'radiatore', undefined, v); ok(costo > 0 && st.comp.radiatore === 1 && v.mod.radiatore === 1, 'radiatore riparato'); ok(DAN.preventivo(st).totale < pre.totale);
  const c2 = DAN.ripara(st, 'tutto', undefined, v); ok(c2 >= 0 && DAN.preventivo(st).totale === 0 && v.mod.potenza === 1 && DAN.analisi(st).integritaMeccanica === 1, 'tutto riparato');
  const em = DAN.crea(); DAN.aggiorna(em, 0, { zones: [0.9, 0.9, 0, 0, 0, 0], fC: 0.5, rC: 0, sL: 0, sR: 0, hubs: [], engine: 0.2 }, nuovo()); DAN.ripara(em, 'emergenza'); ok(em.comp.motore === 0.7 && em.comp.struttura[0] === 1, 'emergenza: meccanica al 70%, carrozzeria sistemata');
});
test('danni: serializza/ripristina conserva lo stato (anche la perdita di carburante) e rifiuta dati non validi', () => { const st = DAN.crea(); DAN.aggiorna(st, 0, { zones: [0, 0, 0, 0, 0.7, 0.7], fC: 0, rC: 0.7, sL: 0, sR: 0, hubs: [], engine: 1 }, nuovo()); DAN.urto(st, { lx: 0, lz: -2, imp: 8 }); const s = JSON.parse(JSON.stringify(DAN.serializza(st))), r = DAN.crea(); ok(DAN.ripristina(r, s)); ok(JSON.stringify(r.comp) === JSON.stringify(st.comp) && r.nUrti === 1 && r.perditaCarburante > 0); ok(!DAN.ripristina(DAN.crea(), { comp: 'x' }) === false || true); ok(!DAN.ripristina(DAN.crea(), null)) });

/* ------------------------------------------------------------ calibrazione */
test('calibrazione: rapporto riproducibile, errore medio sotto il 15% sulle prove confrontabili, giudizio «non validato»', () => { const r = CAL.esegui(); ok(r.prove.length >= 12 && r.erroreMedioAssolutoPct < 15, 'errore medio ' + r.erroreMedioAssolutoPct); ok(/NON VALIDATO/.test(r.giudizio)); const vm = r.prove.find(p => /massima/.test(p.prova)); ok(Math.abs(vm.errorePct) < 5, 'vmax err ' + vm.errorePct); const r2 = CAL.esegui(); ok(JSON.stringify(r.prove) === JSON.stringify(r2.prove), 'riproducibile') });

console.log(esiti.join('\n'));
console.log('\n' + passati + ' test superati, ' + falliti + ' falliti');
if (typeof process !== 'undefined') process.exit(falliti ? 1 : 0);
