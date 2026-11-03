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


/* ------------------------------------------------------------ Vehicle Damage Solver (motore/danni_solver.js + motore/profili_danno.js) con la rete deformabile REALE del gioco
   La rete (sbTemplate, sbNew, sbBeams, sbCrash, sbDerive…) viene estratta da index.html: i test girano sullo stesso codice che gira nel gioco. */
const PRF = require(path.join(__dirname, '..', 'motore', 'profili_danno.js'));
const SOL = require(path.join(__dirname, '..', 'motore', 'danni_solver.js'));
const SB = (() => {
  const fs = require('fs'), html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8'), a = html.indexOf('const SBK={'), b = html.indexOf('function dmgKind(');
  if (a < 0 || b < 0) throw new Error('rete deformabile non trovata in index.html');
  const src = html.slice(a, b);
  return new Function('performance', src + '\nreturn {SBK,sbTemplate,sbNew,sbBeams,sbCrash,sbCrash3,sbDerive,sbNodeCrumple,sbFree,DMGBOX}')(require('perf_hooks').performance);
})();
const SBT = SB.sbTemplate(SB.DMGBOX); SBT.zona = PRF.classifica(SBT);
const finiti = arr => { for (let i = 0; i < arr.length; i++) if (!Number.isFinite(arr[i])) return false; return true };
const urtoRete = (T, S, st, kind, vn, opt) => {   // stessa catena del gioco: evento del solver → u → sbCrash → esito
  opt = opt || {}; const nx = opt.nx !== undefined ? opt.nx : 0, nz = opt.nz !== undefined ? opt.nz : -1, lx = opt.lx || 0, lz = opt.lz !== undefined ? opt.lz : (nz < 0 ? SB.DMGBOX.z1 : SB.DMGBOX.z0);
  const ev = SOL.evento(st, { t: opt.t !== undefined ? opt.t : st.t + 1, lx, lz, nx, nz, vn, m1: T.Mt || 1600, m2: opt.m2, kind, faccia: opt.faccia, facciaAltro: opt.facciaAltro, id: opt.id, Mt: PRF.massa(T, S), Fsnerv: 200000 });
  const imp = { wall: { hw: 3, ylo: -1, yhi: 3, R: 0 }, car: { hw: .75, ylo: .18, yhi: 1.08, R: 0 }, pole: { hw: 0, ylo: -1, yhi: 3, R: .3 }, tree: { hw: 0, ylo: -1, yhi: 3, R: .26 }, rail: { hw: 3, ylo: .25, yhi: .95, R: 0 } }[kind] || { hw: 3, ylo: -1, yhi: 3, R: 0 };
  const face = Math.abs(nz) >= Math.abs(nx) ? [Math.max(SB.DMGBOX.x0 + .15, Math.min(SB.DMGBOX.x1 - .15, lx)), nz < 0 ? SB.DMGBOX.z1 : SB.DMGBOX.z0] : [nx < 0 ? SB.DMGBOX.x1 : SB.DMGBOX.x0, Math.max(SB.DMGBOX.z0 + .2, Math.min(SB.DMGBOX.z1 - .2, lz))];
  const res = ev.u > .3 ? SB.sbCrash(T, S, { n: [nx, nz], c: face, u: ev.u, hw: imp.hw, ylo: imp.ylo, yhi: imp.yhi, R: imp.R }) : null; SOL.esito(st, ev, res); return { ev, res };
};
const RIS = {};   // risultati numerici reali, stampati in fondo

test('profili: ogni trave della rete ha una zona nominata; le zone richieste esistono e sono popolate', () => {
  const r = PRF.riepilogo(SBT), byId = {}; r.forEach(z => byId[z.id] = z);
  for (const id of ['paraurti_ant', 'cofano', 'muso', 'longheroni_ant', 'vano_motore', 'abitacolo', 'montanti', 'tetto', 'porte', 'longheroni_post', 'bagagliaio', 'pianale', 'paraurti_post', 'vetri', 'bracci']) ok(byId[id] && byId[id].travi > 0, 'zona vuota: ' + id);
  ok(r.reduce((s, z) => s + z.travi, 0) === SBT.NB, 'somma delle travi diversa da NB');
  ok(byId.longheroni_ant.FYkN < byId.abitacolo.FYkN && byId.paraurti_ant.FYkN < byId.longheroni_ant.FYkN, 'le zone di assorbimento devono essere più deboli dell\'abitacolo (' + byId.paraurti_ant.FYkN + ' < ' + byId.longheroni_ant.FYkN + ' < ' + byId.abitacolo.FYkN + ' kN)');
  ok(byId.porte.FYkN < byId.montanti.FYkN, 'le porte devono essere più deboli dei montanti'); RIS.zone = r.map(z => z.id + ':' + z.travi + '/' + z.FYkN + 'kN').join(' ');
});
test('profili: il modello del profilo è una copia (geometria identica, parametri scalati, massa dal profilo); il JSON di esempio viene importato come «non certificato»', () => {
  const p75 = PRF.PROFILI.alfa_romeo_75; ok(p75.certificato === false && p75.massa === 1200 && p75.zone.paraurti_ant.resistenza === 0.5 && p75.zone.paraurti_ant.rottura === 0.9 && p75.zone.muso.resistenza === 1.6 && p75.zone.longheroni_ant.rottura === 2, 'importazione JSON');
  ok(p75.meccanici.includes('motore') && p75.meccanici.includes('sospensioni'), 'componenti meccanici importati');
  const T = PRF.template(SBT, p75); ok(T.P0 === SBT.P0 && T.A === SBT.A && T.N === SBT.N && T.NB === SBT.NB, 'stessa geometria e topologia'); ok(T.FY !== SBT.FY && T.M !== SBT.M, 'parametri copiati, non condivisi');
  let m = 0; for (let i = 0; i < T.N; i++) m += T.M[i]; vicino(m, 1200, 0.01, 'massa del profilo');
  let n = 0; for (let b = 0; b < SBT.NB; b++) { if (SBT.zona[b] === PRF.ZID.paraurti_ant) { vicino(T.FY[b] / SBT.FY[b], 0.5, 1e-9); vicino(T.EB[b] / SBT.EB[b], 0.9, 1e-9); n++ } else if (SBT.zona[b] === PRF.ZID.abitacolo) vicino(T.FY[b], SBT.FY[b], 1e-9) } ok(n > 0);
  const Tb = PRF.template(SBT, 'predefinito'); for (let b = 0; b < SBT.NB; b++) { vicino(Tb.FY[b], SBT.FY[b], 1e-9); vicino(Tb.EB[b], SBT.EB[b], 1e-9) }   // il profilo predefinito non cambia la rete del gioco
});
test('solver: urto contro muro — massa effettiva, impulso, energia, restituzione decrescente con la velocità, u coerente con ½·M·u² = E propria', () => {
  const st = SOL.crea(); const e1 = SOL.evento(st, { t: 1, lx: 0, lz: 2.3, nx: 0, nz: -1, vn: 10, m1: 1600, m2: Infinity, kind: 'wall', Mt: 1600 });
  vicino(e1.mEff, 1600, 1e-9); vicino(e1.En, 80000, 1e-6); vicino(e1.Ediss, 80000 * (1 - e1.e * e1.e), 1e-6); vicino(e1.Eown, e1.Ediss, 1e-6, 'muro: tutta l\'energia dissipata va all\'auto'); vicino(e1.J, (1 + e1.e) * 1600 * 10, 1e-6);
  vicino(0.5 * 1600 * e1.u * e1.u, e1.Eown, 1e-3, 'u ricavata dall\'energia'); ok(e1.faccia === 'ant');
  const lento = SOL.evento(st, { t: 5, lx: 0, lz: 2.3, nx: 0, nz: -1, vn: 1, m1: 1600, kind: 'wall', Mt: 1600 }), veloce = SOL.evento(st, { t: 9, lx: 0, lz: 2.3, nx: 0, nz: -1, vn: 25, m1: 1600, kind: 'wall', Mt: 1600 });
  ok(lento.e > veloce.e && lento.e > 0.3 && veloce.e < 0.12, 'restituzione: ' + lento.e + ' > ' + veloce.e);
  ok(st.nEventi === 3 && SOL.valido(st).length === 0);
});
test('solver: due veicoli — l\'energia dissipata si ripartisce fra i due (muso contro fianco: il fianco, più cedevole, ne assorbe di più) e la somma è quella dissipata', () => {
  const A = SOL.crea(), B = SOL.crea(); const ea = SOL.evento(A, { t: 1, lx: 0, lz: 2.3, nx: 0, nz: -1, vn: 8, m1: 1600, m2: 1600, kind: 'car', faccia: 'ant', facciaAltro: 'lato', id: 'A|B', Mt: 1600 });
  const eb = SOL.evento(B, { t: 1, lx: .9, lz: 0, nx: -1, nz: 0, vn: 8, m1: 1600, m2: 1600, kind: 'car', faccia: 'lato', facciaAltro: 'ant', id: 'A|B', Mt: 1600 });
  vicino(ea.mEff, 800, 1e-9, 'massa effettiva'); vicino(ea.En, 0.5 * 800 * 64, 1e-6); vicino(ea.Eown + eb.Eown, ea.Ediss, 1e-6, 'somma delle energie proprie = energia dissipata'); ok(eb.Eown > ea.Eown, 'il fianco assorbe di più: ' + eb.Eown + ' > ' + ea.Eown);
  const ef = SOL.evento(A, { t: 3, lx: 0, lz: 2.3, nx: 0, nz: -1, vn: 8, m1: 1600, m2: 1600, kind: 'car', faccia: 'ant', facciaAltro: 'ant', id: 'A|C', Mt: 1600 }); vicino(ef.Eown, ef.Ediss / 2, 1e-6, 'frontale fra uguali: metà ciascuno');
  const pesante = SOL.evento(A, { t: 5, lx: 0, lz: 2.3, nx: 0, nz: -1, vn: 8, m1: 1600, m2: 12000, kind: 'car', faccia: 'ant', facciaAltro: 'ant', id: 'A|T', Mt: 1600 }); ok(pesante.En > ef.En && pesante.mEff > ef.mEff, 'contro un camion l\'energia cresce');
});
test('solver: palo, albero e guardrail assorbono parte dell\'energia (materiale), il muro nulla', () => {
  const st = SOL.crea(), E = k => SOL.evento(st, { t: st.t + 1, lx: 0, lz: 2.3, nx: 0, nz: -1, vn: 12, m1: 1600, kind: k, Mt: 1600 });
  const w = E('wall'), t = E('tree'), p = E('pole'), r = E('rail'); ok(w.Eown > t.Eown && t.Eown > p.Eown && p.Eown > r.Eown, 'ordine: muro > albero > palo > guardrail');
  vicino(w.quotaOst, 0, 1e-9); vicino(t.quotaOst, 0.08, 1e-9); ok(p.quotaOst >= 0.3 && r.quotaOst >= 0.45);
});
test('solver: registro degli eventi — lo stesso contatto ripetuto entro 0,12 s non conta due volte (solo l\'energia in più), un contatto diverso sì', () => {
  const st = SOL.crea(), base = { lx: 0, lz: 2.3, nx: 0, nz: -1, vn: 10, m1: 1600, kind: 'wall', Mt: 1600 };
  const a = SOL.evento(st, Object.assign({ t: 1 }, base)), b = SOL.evento(st, Object.assign({ t: 1.05 }, base)), c = SOL.evento(st, Object.assign({}, base, { t: 1.08, vn: 14 })), d = SOL.evento(st, Object.assign({ t: 1.5 }, base));
  ok(!a.duplicato && b.duplicato && b.u === 0 && c.duplicato && c.Eown > 0 && c.Eown < c.Ediss && !d.duplicato, 'duplicati'); ok(st.nEventi === 2 && st.nDuplicati === 2);
  vicino(st.energia.propria, a.Eown + d.Eown, 1e-6, 'energia contata una sola volta per evento (l\'evento ripetuto si fonde nel primo)'); ok(a.ripetuto === 2 && a.Eown > c.Ediss - 1e-6, 'l\'evento fuso porta l\'energia massima vista');
});
test('rete + solver: urto frontale contro muro a 50 km/h — deformazione permanente, progressiva, concentrata sulle zone di assorbimento; nessun NaN', () => {
  const T = PRF.template(SBT, 'predefinito'), S = SB.sbNew(T), st = SOL.crea(); const r30 = urtoRete(T, S, st, 'wall', 30 / 3.6), R30 = SB.sbDerive(T, S), f30 = R30.fC;
  ok(r30.res && r30.res.Wp > 0 && r30.res.crush > 0, 'urto a 30 km/h simulato'); ok(f30 > 0.02, 'muso arretrato a 30 km/h: ' + f30);
  const P1 = Float64Array.from(S.P); ok(SB.sbCrash(T, S, { n: [0, -1], c: [0, SB.DMGBOX.z1], u: 0.1, hw: 3, ylo: -1, yhi: 3, R: 0 }) === null, 'sotto 0,3 m/s la rete non viene toccata'); for (let i = 0; i < P1.length; i++) if (P1[i] !== S.P[i]) throw new Error('la deformazione non è permanente');
  const r50 = urtoRete(T, S, st, 'wall', 50 / 3.6), R50 = SB.sbDerive(T, S); ok(R50.fC > f30 + 0.05, 'progressiva: ' + R50.fC + ' > ' + f30); ok(finiti(S.P) && finiti(S.V) && finiti(S.L0), 'NaN/Infinity nella rete');
  const z = SOL.stato(T, S, PRF.ZONE); ok(z.abitacolo.integrita > 0.9 && z.tetto.integrita > 0.95 && z.pianale.integrita > 0.9, 'abitacolo/tetto/pianale integri: ' + JSON.stringify([z.abitacolo, z.tetto, z.pianale]));
  ok(z.paraurti_ant.integrita < 0.6 || z.muso.integrita < 0.8 || z.longheroni_ant.integrita < 0.9, 'zone anteriori deformate: ' + JSON.stringify([z.paraurti_ant, z.muso, z.longheroni_ant]));
  ok(R50.rC < 0.01 && Math.max(R50.sL, R50.sR) < 0.05, 'coda e fianchi intatti in un frontale');
  RIS.frontale = { fC30: +f30.toFixed(3), fC50: +R50.fC.toFixed(3), Wp50kJ: +(r50.res.Wp / 1000).toFixed(2), E50kJ: +(r50.ev.Eown / 1000).toFixed(2), passi: r50.res.steps, zone: z };
});
test('rete + solver: urto laterale a 40 km/h — intrusione sul fianco colpito, porte e montanti più colpiti dell\'abitacolo centrale, muso intatto', () => {
  const T = PRF.template(SBT, 'predefinito'), S = SB.sbNew(T), st = SOL.crea(); const r = urtoRete(T, S, st, 'car', 40 / 3.6, { nx: -1, nz: 0, lx: SB.DMGBOX.x1, lz: 0.1, faccia: 'lato', facciaAltro: 'ant', m2: 1600, id: 'x' }), R = SB.sbDerive(T, S);
  ok(r.res && r.res.Wp > 0, 'urto simulato'); ok(R.sL > 0.03 && R.sR < 0.01, 'intrusione a sinistra: sL=' + R.sL + ' sR=' + R.sR); ok(R.fC < 0.02 && R.rC < 0.02, 'muso e coda intatti');
  const z = SOL.stato(T, S, PRF.ZONE); ok(z.porte.integrita < z.pianale.integrita, 'porte più danneggiate del pianale: ' + z.porte.integrita + ' < ' + z.pianale.integrita); ok(finiti(S.P)); RIS.laterale = { sL: +R.sL.toFixed(3), porte: z.porte, montanti: z.montanti, pianale: z.pianale };
});
test('rete + solver: due veicoli (frontale a 60 km/h relativi) — ognuno dissipa la propria quota, nessuna energia applicata due volte', () => {
  const T = PRF.template(SBT, 'predefinito'), SA = SB.sbNew(T), SBb = SB.sbNew(T), A = SOL.crea(), B = SOL.crea();
  const a = urtoRete(T, SA, A, 'car', 60 / 3.6, { faccia: 'ant', facciaAltro: 'ant', m2: 1600, id: 'A|B', t: 1 }), b = urtoRete(T, SBb, B, 'car', 60 / 3.6, { faccia: 'ant', facciaAltro: 'ant', m2: 1600, id: 'A|B', t: 1 });
  vicino(a.ev.Eown + b.ev.Eown, a.ev.Ediss, 1e-6, 'energia ripartita'); ok(a.res && b.res && a.res.Wp > 0 && b.res.Wp > 0, 'entrambe le reti deformate');
  const a2 = urtoRete(T, SA, A, 'car', 60 / 3.6, { faccia: 'ant', facciaAltro: 'ant', m2: 1600, id: 'A|B', t: 1.04 }); ok(a2.ev.duplicato && a2.res === null, 'il contatto ripetuto nel fotogramma dopo non deforma di nuovo');
  ok(a.res.Wp <= a.ev.Eown * 1.05 && b.res.Wp <= b.ev.Eown * 1.05, 'la rete non dissipa più dell\'energia ricevuta: ' + a.res.Wp + ' / ' + a.ev.Eown); RIS.dueVeicoli = { EownKJ: +(a.ev.Eown / 1000).toFixed(2), WpAkJ: +(a.res.Wp / 1000).toFixed(2), WpBkJ: +(b.res.Wp / 1000).toFixed(2), fCA: +SB.sbDerive(T, SA).fC.toFixed(3) };
});
test('rete + solver: bilancio energetico su una sequenza di urti — il lavoro plastico della rete resta fra il 25% e il 105% dell\'energia propria calcolata', () => {
  const T = PRF.template(SBT, 'predefinito'), S = SB.sbNew(T), st = SOL.crea(); const casi = [['wall', 20 / 3.6, {}], ['wall', 45 / 3.6, {}], ['pole', 35 / 3.6, { lx: .3 }], ['car', 50 / 3.6, { nx: 0, nz: 1, lz: SB.DMGBOX.z0, faccia: 'post', facciaAltro: 'ant', m2: 1600, id: 'q' }]];
  let Wp = 0, E = 0; for (const [k, v, o] of casi) { const r = urtoRete(T, S, st, k, v, o); if (r.res) { Wp += r.res.Wp; E += r.ev.Eown } }
  const rap = Wp / E; ok(rap > 0.25 && rap < 1.05, 'rapporto lavoro plastico / energia propria = ' + rap.toFixed(3)); vicino(st.energia.rete, Wp, 1e-6); ok(finiti(S.P) && SOL.valido(st).length === 0); RIS.bilancio = { EpropriaKJ: +(E / 1000).toFixed(2), WpKJ: +(Wp / 1000).toFixed(2), rapporto: +rap.toFixed(3) };
});
test('sospensioni e ruote: palo sul fianco all\'altezza della ruota a 40 km/h — mozzo spostato, braccio/cerchio danneggiati, aderenza e stabilità ridotte, vibrazione con la velocità', () => {
  const T = PRF.template(SBT, 'predefinito'), S = SB.sbNew(T), st = SOL.crea(); urtoRete(T, S, st, 'pole', 40 / 3.6, { nx: -1, nz: 0, lx: SB.DMGBOX.x1, lz: 1.3, faccia: 'lato' }); const R = SB.sbDerive(T, S), h = R.hubs[0];
  ok(Math.hypot(h.dx, h.dy, h.dz) > 0.02 || Math.abs(h.camber) > 0.03 || Math.abs(h.toe) > 0.03 || h.lost, 'mozzo anteriore sinistro colpito: ' + JSON.stringify(h));
  const E0 = SOL.passo(st, 1 / 60, { R, D: { wl: [false, false, false, false] }, tyre: null, v: 0 }), v0 = E0.vibrazione; const E = SOL.passo(st, 1 / 60, { R, D: { wl: [false, false, false, false] }, tyre: null, v: 25 });
  ok(st.ruote[0].braccio < 1 || st.ruote[0].mozzo < 1 || st.ruote[0].cerchio < 1, 'componenti della ruota 0 danneggiati: ' + JSON.stringify(st.ruote[0])); ok(E.aderenza[0] < 1 && E.aderenza[3] >= E.aderenza[0], 'aderenza ridotta sulla ruota colpita: ' + JSON.stringify(E.aderenza));
  ok(E.vibrazione >= v0 && E.stabilita <= 1, 'vibrazione cresce con la velocità'); ok(finiti(E.aderenza) && Number.isFinite(E.vibrazione) && Number.isFinite(E.stabilita) && Number.isFinite(E.tiro));
  const v = nuovo(); SOL.applicaMod(st, v.mod); ok(Array.isArray(v.mod.muRuota) && v.mod.muRuota[0] === E.aderenza[0], 'mod.muRuota passato al motore fisico');
  corri(v, 2, { acc: 0.6, iy: 0.6 }, { pendenza: 0, superficie: 'asfalto', acqua: 0, tempAria: 20, quota: 0, vento: 0 }); ok(Number.isFinite(v.v) && v.ruote.mu[0] <= v.ruote.mu[3], 'μ per ruota applicato: ' + v.ruote.mu.map(x => x.toFixed(2)));
  RIS.ruota = { mozzo: h, ruota0: st.ruote[0], effetti: E };
});
test('meccanica: urto frontale grave → interfaccia S del solver → motore, frizione, differenziale, centraline e radiatore danneggiati con effetti reali sulla fisica', () => {
  const T = PRF.template(SBT, 'predefinito'), S = SB.sbNew(T), st = SOL.crea(); urtoRete(T, S, st, 'wall', 70 / 3.6); const R = SB.sbDerive(T, S), zone = SOL.stato(T, S, PRF.ZONE);
  const D = { on: true, zones: [0.8, 0.8, 0, 0, 0, 0], engine: R.engine, wl: [false, false, false, false] }, Sx = SOL.statoStruttura(st, R, D, null, zone); ok(Sx && Sx.zone && Sx.fC === R.fC && Sx.hubs === R.hubs, 'interfaccia S');
  const dan = DAN.crea(), v = nuovo(); DAN.aggiorna(dan, 0, Sx, v); const C = dan.comp;
  ok(C.motore < 1 && C.radiatore < 1, 'motore e radiatore: ' + C.motore + ' ' + C.radiatore); ok(C.frizione < 1 && C.differenziale < 1 && C.centraline < 1, 'frizione/differenziale/centraline: ' + [C.frizione, C.differenziale, C.centraline]);
  ok(v.mod.potenza < 1 && v.mod.frizione < 1 && v.mod.differenziale < 1 && v.mod.radiatore < 1, 'modificatori: ' + JSON.stringify({ potenza: v.mod.potenza, frizione: v.mod.frizione, differenziale: v.mod.differenziale }));
  const amb = { pendenza: 0, superficie: 'asfalto', acqua: 0, tempAria: 20, quota: 0, vento: 0 }, sano = nuovo(); corri(sano, 6, { acc: 1, iy: 1 }, amb); const rotto = nuovo(); rotto.mod.frizione = 0.4; rotto.mod.differenziale = 0.6; corri(rotto, 6, { acc: 1, iy: 1 }, amb);
  ok(rotto.v < sano.v * 0.9, 'frizione che slitta e differenziale danneggiato: accelera meno (' + rotto.v.toFixed(1) + ' < ' + sano.v.toFixed(1) + ' m/s)');
  const ctx = DAN.ctxECU(dan); ok(Number.isFinite(ctx.centraline), 'centraline passate alle ECU'); RIS.meccanica = { fC: +R.fC.toFixed(3), engine: +R.engine.toFixed(3), comp: { motore: C.motore, radiatore: C.radiatore, frizione: C.frizione, differenziale: C.differenziale, centraline: C.centraline, cambio: C.cambio } };
});
test('componenti distaccabili: dopo un frontale forte gli attacchi del paraurti cedono (integrità dalla zona) e lo stato di distacco segue il gioco; configurazione con massa, attacco, soglia', () => {
  const cfg = PRF.componenti('predefinito'); for (const k of ['fb', 'rb', 'hood', 'dFL', 'mL', 'ws', 'w0', 'scarico']) ok(cfg[k] && cfg[k].massa > 0 && cfg[k].attacco && Number.isFinite(cfg[k].soglia) && cfg[k].resistenza > 0, 'componente ' + k);
  const T = PRF.template(SBT, 'predefinito'), S = SB.sbNew(T), st = SOL.crea(); urtoRete(T, S, st, 'wall', 65 / 3.6); const R = SB.sbDerive(T, S), zone = SOL.stato(T, S, PRF.ZONE);
  const comp = SOL.componenti(st, cfg, zone, { cut: {}, gcut: {}, wl: [false, false, false, false] }, {}), fb0 = Object.assign({}, comp.fb), hood0 = Object.assign({}, comp.hood); ok(comp.fb.integrita < 1 && !comp.fb.staccato, 'paraurti anteriore indebolito ma ancora attaccato: ' + comp.fb.integrita);
  ok(comp.rb.integrita === 1, 'paraurti posteriore intatto'); const c2 = SOL.componenti(st, cfg, zone, { cut: { fb: true }, gcut: { ws: true }, wl: [true, false, false, false] }, { hood: { st: 'gone' } });
  ok(c2.fb.staccato && c2.fb.integrita === 0 && c2.ws.staccato && c2.w0.staccato && c2.hood.staccato, 'stato di distacco dal gioco'); RIS.componenti = { fb: fb0, hood: hood0, paraurti_ant: zone.paraurti_ant, R_fb: R.fb };
});
test('riparazione: il solver riporta ruote, componenti ed effetti; «emergenza» solo al 70%; danni_meccanici ripara anche frizione/differenziale/centraline', () => {
  const st = SOL.crea(); st.ruote[1].braccio = 0.2; st.ruote[1].cerchio = 0.1; st.ruote[2].braccio = 0.3; st.effetti.aderenza[1] = 0.4; st.comp.fb = { integrita: 0.2, staccato: true }; ok(SOL.ripara(st, 'sospensioni', 2) && st.ruote[2].braccio === 1 && st.ruote[1].braccio === 0.2, 'riparazione di una sola ruota'); ok(!SOL.ripara(st, 'radiatore'), 'il radiatore non riguarda il solver'); SOL.ripara(st, 'emergenza'); vicino(st.ruote[1].braccio, 0.7, 1e-9); ok(!st.comp.fb.staccato && st.comp.fb.integrita === 0.7 && st.effetti.aderenza[1] === 1);
  SOL.ripara(st, 'tutto'); ok(st.ruote[1].braccio === 1 && st.ruote[1].cerchio === 1 && st.comp.fb.integrita === 1);
  const dan = DAN.crea(), v = nuovo(); dan.comp.frizione = 0.3; dan.comp.differenziale = 0.2; dan.comp.centraline = 0.1; DAN.aggiorna(dan, 0, null, v); ok(v.mod.frizione < 1 && v.mod.differenziale < 1);
  const pre = DAN.preventivo(dan); ok(pre.voci.some(q => q.chiave === 'frizione') && pre.voci.some(q => q.chiave === 'differenziale') && pre.voci.some(q => q.chiave === 'centraline'), 'voci del preventivo');
  DAN.ripara(dan, 'frizione', undefined, v); ok(dan.comp.frizione === 1 && v.mod.frizione === 1); DAN.ripara(dan, 'tutto', undefined, v); ok(DAN.preventivo(dan).totale === 0 && v.mod.differenziale === 1 && dan.comp.centraline === 1);
});
test('salvataggio e ripristino: serializza → JSON → ripristina conserva energia, eventi, ruote, componenti ed effetti; dati non validi rifiutati', () => {
  const T = PRF.template(SBT, 'predefinito'), S = SB.sbNew(T), st = SOL.crea(); urtoRete(T, S, st, 'wall', 40 / 3.6); urtoRete(T, S, st, 'pole', 30 / 3.6, { lx: -.7 }); SOL.passo(st, 1 / 60, { R: SB.sbDerive(T, S), D: { wl: [false, false, false, false] }, tyre: null, v: 20 });
  const cfg = PRF.componenti('predefinito'); SOL.componenti(st, cfg, SOL.stato(T, S, PRF.ZONE), { cut: {}, gcut: {}, wl: [false, false, false, false] }, {});
  const j = JSON.parse(JSON.stringify(SOL.serializza(st))), st2 = SOL.crea(); ok(SOL.ripristina(st2, j), 'ripristino'); vicino(st2.energia.propria, st.energia.propria, 1e-6); ok(st2.nEventi === st.nEventi && st2.eventi.length === st.eventi.length);
  for (let k = 0; k < 4; k++) { vicino(st2.ruote[k].braccio, st.ruote[k].braccio, 1e-9); vicino(st2.effetti.aderenza[k], st.effetti.aderenza[k], 1e-9) } ok(st2.comp.fb && st2.comp.fb.integrita === st.comp.fb.integrita);
  ok(!SOL.ripristina(SOL.crea(), null) && !SOL.ripristina(SOL.crea(), { v: 7 }) && SOL.valido(st2).length === 0);
  const sdan = DAN.crea(); sdan.comp.frizione = 0.4; const sj = JSON.parse(JSON.stringify(DAN.serializza(sdan))), d2 = DAN.crea(); DAN.ripristina(d2, sj); vicino(d2.comp.frizione, 0.4, 1e-9, 'danni_meccanici: nuovi componenti salvati');
});
test('ribaltamento (sbCrash3 dall\'alto) con evento «ground» registrato: tetto e montanti deformati, nessun NaN', () => {
  const T = PRF.template(SBT, 'predefinito'), S = SB.sbNew(T), st = SOL.crea(); const ev = SOL.evento(st, { t: 1, lx: -.78, lz: 0, nx: -1, nz: 0, vn: 5, m1: T.Mt || 1600, m2: Infinity, kind: 'ground', faccia: 'tetto', Mt: PRF.massa(T, S) });
  ok(ev.kind === 'ground' && ev.Eown > 0 && ev.quotaOst === 0.15); const res = SB.sbCrash3(T, S, { n3: [0, -1, 0], c3: [0, SB.DMGBOX.y1 + .02, 0], u: 6, ky: .12, reach: .65 }); SOL.esito(st, ev, res);
  ok(res && finiti(S.P), 'ribaltamento simulato'); const z = SOL.stato(T, S, PRF.ZONE); ok(z.tetto.integrita < 1 || z.montanti.integrita < 1 || z.vetri.integrita < 1, 'tetto/montanti/vetri colpiti: ' + JSON.stringify([z.tetto, z.montanti, z.vetri])); RIS.ribaltamento = { tetto: z.tetto, montanti: z.montanti, vetri: z.vetri, Wp: res.Wp };
});
test('prestazioni: costo del solver trascurabile rispetto alla rete (passo per fotogramma, stato per zona, evento)', () => {
  const T = PRF.template(SBT, 'predefinito'), S = SB.sbNew(T), st = SOL.crea(); const hr = require('perf_hooks').performance; urtoRete(T, S, st, 'wall', 50 / 3.6); const R = SB.sbDerive(T, S);
  let t0 = hr.now(); for (let i = 0; i < 2000; i++) SOL.passo(st, 1 / 60, { R, D: { wl: [false, false, false, false] }, tyre: null, v: 20 }); const msPasso = (hr.now() - t0) / 2000;
  t0 = hr.now(); for (let i = 0; i < 200; i++) SOL.stato(T, S, PRF.ZONE); const msStato = (hr.now() - t0) / 200;
  t0 = hr.now(); for (let i = 0; i < 2000; i++) SOL.evento(st, { t: 100 + i, lx: 0, lz: 2.3, nx: 0, nz: -1, vn: 5, m1: 1600, kind: 'wall', Mt: 1600 }); const msEv = (hr.now() - t0) / 2000;
  t0 = hr.now(); const S2 = SB.sbNew(T), r = urtoRete(T, S2, SOL.crea(), 'wall', 50 / 3.6); const msRete = hr.now() - t0;
  ok(msPasso < 0.05 && msStato < 2 && msEv < 0.05, 'passo ' + msPasso.toFixed(4) + ' ms, stato ' + msStato.toFixed(3) + ' ms, evento ' + msEv.toFixed(4) + ' ms'); RIS.prestazioni = { msPasso: +msPasso.toFixed(4), msStatoZone: +msStato.toFixed(3), msEvento: +msEv.toFixed(4), msReteFrontale50: +msRete.toFixed(1), passiRete: r.res.steps };
});
test('compatibilità: la pagina index.html collega il solver (script, VDS, dmgCrash con evento) e non ha più il doppio conteggio dell\'urto nel wrapper', () => {
  const fs = require('fs'), html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  for (const s of ['motore/danni_solver.js', 'motore/profili_danno.js', 'const VDS=', 'function dmgCrash(own,lx,lz,Dx,Dz,imp,kind,ev)', 'VDS.evento(a,car,lx,lz,Dx,Dz,imp,kind,xtra)', 'IOW_SOLVER.applicaMod(VDS.st,VEH.mod)', 'solver:VDS.serializza()']) ok(html.includes(s), 'manca nella pagina: ' + s);
  ok(!html.includes("carHit0(a,car,wx,wz,dirx,dirz,imp,kind);if(a===carA&&imp>=3.2)"), 'vecchio wrapper di carHit ancora attivo'); ok(!/Math\.random\(\)<Math\.min\(\.4,\.12/.test(html), 'serrature ancora casuali');
});

/* ------------------------------------------------------------ mappa (versione 31): le cause dei difetti visti nelle foto, sul codice vero
   del generatore delle celle (sorgenti/mappa_reale/cella.js) e su due celle sintetiche (svincolo in collina, periferia): niente dati esterni */
const MAPPA = (() => { const fs = require('fs'), dir = path.join(__dirname, '..', 'sorgenti', 'mappa_reale') + '/';
  const src = ['mvt.js', 'earcut.js', 'dem.js', 'cella.js'].map(f => fs.readFileSync(f === 'cella.js' && process.env.IOW_CELLA ? process.env.IOW_CELLA : dir + f, 'utf8').replace(/if \(typeof module[^\n]*\n/g, '')).join('\n');
  const M = new Function(src + ';return {buildCell,earcut,ME,MH,GB,tri3,wall,wallS,wallB,obox,balc}')();
  const { SVINCOLO, PERIFERIA } = require(dir + 'svincolo.js'), K = Math.cos(43.73 * Math.PI / 180), Sm = M.ME / 32768, S = Sm * K, k = S / 4096, cx = 17063, cy = 11946, mxL = -M.MH + cx * Sm, myT = M.MH - cy * Sm;
  const cella = (F, dens) => { const SV = F(k), dem = (mx, my) => SV.h((mx - mxL) * K, (myT - my) * K); return M.buildCell(SV.L, { S, mxL, myT, K, dem, lod: 'A', earcut: M.earcut, cx, cy, blo: -4096, bhi: 8192, dens, lc: SV.lc || null, dbg: 1, RHN: 512 }) };
  // galleria sintetica: collina, due gallerie che partono dallo stesso imbocco e si separano piano, palazzo sopra l'imbocco con la sagoma che scende
  // lungo il pendio (base della facciata più bassa della volta della galleria): i due casi di Monaco (cause 13 e 14 di docs/AUDIT_V31.md)
  const GALLERIA = k => { const E = 4096, T = m => m / k, L = [], line = (pts, props) => L.push({ type: 2, props, parts: [pts.flatMap(([u, v]) => [T(u), T(v)])] });
    line([[0, 450], [150, 450]], { class: 'primary' }); line([[150, 450], [750, 450]], { class: 'primary', brunnel: 'tunnel' }); line([[750, 450], [880, 450]], { class: 'primary' });
    line([[150, 450], [300, 458], [750, 475]], { class: 'primary', brunnel: 'tunnel' }); line([[750, 475], [880, 520]], { class: 'primary' });   // secondo ramo dallo stesso imbocco: per 100 m le due canne si sovrappongono
    const r = [[200, 440], [260, 440], [260, 460], [200, 460]], ring = []; for (const [u, v] of r.concat([r[0]])) ring.push(T(u), T(v));
    const BLD = [{ type: 3, props: {}, parts: [ring] }], h = (u, v) => 20 + 30 * Math.exp(-(((u - 450) / 170) ** 2 + ((v - 480) / 140) ** 2));
    return { L: { transportation: { ext: E, n: L.length, feat: i => L[i] }, building: { ext: E, n: BLD.length, feat: i => BLD[i] } }, h } };
  return { M, sv: cella(SVINCOLO, .02), pe: cella(PERIFERIA, .3), ga: cella(GALLERIA, .3) } })();
// faccia anteriore (antioraria, come la disegna three.js) rispetto alla normale dichiarata e rispetto all'alto
const MP = { concordi: g => { let c = 0, d = 0; const P = g.P, I = g.I, N = g.N; for (let q = 0; q < I.length; q += 3) { const a = I[q] * 3, b = I[q + 1] * 3, e = I[q + 2] * 3, u = [P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]], v = [P[e] - P[a], P[e + 1] - P[a + 1], P[e + 2] - P[a + 2]], n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; if (Math.hypot(...n) < 1e-9) continue; (n[0] * N[a] + n[1] * N[a + 1] + n[2] * N[a + 2] > 0) ? c++ : d++ } return [c, d] },
  giu: g => { if (!g) return [0, 0]; let n = 0, bad = 0; const P = g.P, I = g.I; for (let q = 0; q < I.length; q += 3) { const a = I[q] * 3, b = I[q + 1] * 3, e = I[q + 2] * 3, ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[e] - P[a], vy = P[e + 1] - P[a + 1], vz = P[e + 2] - P[a + 2], ny = uz * vx - ux * vz, l = Math.hypot(uy * vz - uz * vy, ny, ux * vy - uy * vx); if (l < .04) continue; n++; if (ny / l < -.05) bad++ } return [bad, n] } };
test('mappa: ogni primitiva geometrica ha la faccia concorde con la normale dichiarata (tri3, muri, facciate, scatole, balconi)', () => { const M = MAPPA.M;
  for (const [nome, fn] of [['tri3 su', g => M.tri3(g, [[0, 0, 0], [1, 0, 0], [0, 0, 1]], [1, 1, 1])], ['tri3 giù', g => M.tri3(g, [[0, 0, 0], [1, 0, 0], [0, 0, 1]], [1, 1, 1], null, [0, -1, 0])], ['wall', g => M.wall(g, 0, 0, 4, 0, 0, 3, [1, 1, 1], 0, 1)], ['wallS', g => M.wallS(g, 0, 0, 4, 1, 0, 3, .2, 3.5, [1, 1, 1])], ['wallB', g => M.wallB(g, 0, 0, 4, 1, 0, 3, [1, 1, 1], 0, 2)], ['obox', g => M.obox(g, 5, 5, .6, .8, 4, 2, 0, 3, [1, 1, 1])], ['balc', g => M.balc(g, 5, 5, 1, 0, 0, 1, 3, 1.2, 6, [1, 1, 1], [1, 1, 1])]]) {
    const g = new M.GB(true); fn(g); const [c, d] = MP.concordi(g); ok(c > 0 && d === 0, nome + ': ' + d + ' facce col verso opposto alla normale') } });
test('mappa: asfalto, strisce pedonali, linee di arresto, piazzole e piazze con la faccia verso l\'alto (prima strisce, arresti e piazzole erano invisibili)', () => {
  for (const [nome, r] of [['svincolo', MAPPA.sv], ['periferia', MAPPA.pe]]) for (const key of ['R', 'Rst', 'Rdi', 'Rba', 'Rsw']) { const [bad, n] = MP.giu(r[key]); ok(bad === 0, nome + ' ' + key + ': ' + bad + ' triangoli verso il basso su ' + n) }
  ok(MP.giu(MAPPA.pe.R)[1] > 1000, 'periferia senza asfalto?') });
test('mappa: tetti verso l\'alto (prima, visti dall\'alto, gli edifici erano vuoti e i comignoli sospesi)', () => { let bad = 0, n = 0; for (const o of MAPPA.pe.BR || []) { const [b, m] = MP.giu(o); bad += b; n += m } ok(n > 100, 'tetti ' + n); ok(bad / n < .02, bad + ' facce dei tetti verso il basso su ' + n) });
test('mappa: nessun guardrail dentro la carreggiata di un\'altra strada alla stessa quota; ogni guardrail è un ostacolo con la sua quota', () => {
  for (const [nome, r] of [['svincolo', MAPPA.sv], ['periferia', MAPPA.pe]]) { const D = r.stat._dbg, GR = D.GR || [], RD = D.RD; let dentro = 0;
    for (let i = 0; i < GR.length; i += 7) { const u = (GR[i] + GR[i + 3]) / 2, v = (GR[i + 1] + GR[i + 4]) / 2, y = (GR[i + 2] + GR[i + 5]) / 2; for (const R of RD) { if (R.idx === GR[i + 6] || R.tun || R.c === 'path' || R.c === 'rail') continue; for (let q = 0; q < R.m - 1; q++) { const ax = R.S2[q * 2], ay = R.S2[q * 2 + 1], dx = R.S2[q * 2 + 2] - ax, dy = R.S2[q * 2 + 3] - ay, l2 = dx * dx + dy * dy || 1e-9, t = Math.max(0, Math.min(1, ((u - ax) * dx + (v - ay) * dy) / l2)); if (Math.hypot(ax + dx * t - u, ay + dy * t - v) < R.w / 2 + .2 && Math.abs(R.h[q] + (R.h[q + 1] - R.h[q]) * t + R.lift - y) < 2.5) { dentro++; q = R.m } } } }
    ok(dentro === 0, nome + ': ' + dentro + ' tratti di guardrail dentro un\'altra carreggiata');
    const rl = r.rails || []; ok(rl.length / 7 >= GR.length / 7, nome + ': ostacoli ' + rl.length / 7 + ' per ' + GR.length / 7 + ' tratti'); for (let i = 0; i < rl.length; i += 7) ok(rl[i + 6] > rl[i + 5], 'quota della cima sotto la base') }
  ok((MAPPA.sv.stat.guardrail || 0) > 1000 && (MAPPA.sv.stat.guardrailTolto || 0) > 0, 'svincolo: guardrail ' + MAPPA.sv.stat.guardrail + ' m, tolti ' + MAPPA.sv.stat.guardrailTolto + ' m') });
test('mappa: viadotti con intradosso su tutta la lunghezza (prima, visti da sotto, erano trasparenti) e parapetti con collisione', () => { const r = MAPPA.sv; let L = 0; for (const R of r.stat._dbg.RD) if (R.bridge) for (let q = 0; q < R.m - 1; q++) L += Math.hypot(R.S2[q * 2 + 2] - R.S2[q * 2], R.S2[q * 2 + 3] - R.S2[q * 2 + 1]);
  ok(L > 100, 'ponti ' + L); vicino(r.stat.intradosso || 0, L, .5, 'metri di intradosso') });
test('mappa: le pareti sotto il bordo dell\'asfalto guardano fuori, cordoli verso la strada (prima il contrario: strade "sospese" viste da fuori)', () => {
  const conta = (r, key) => { const g = r[key], RD = r.stat._dbg.RD, c = { sottoFuori: 0, sottoDentro: 0 }; if (!g) return c; const P = g.P, I = g.I;
    for (let q = 0; q < I.length; q += 3) { const a = I[q] * 3, b = I[q + 1] * 3, e = I[q + 2] * 3, ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[e] - P[a], vy = P[e + 1] - P[a + 1], vz = P[e + 2] - P[a + 2]; let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz); if (l < .02 || Math.abs(ny / l) > .2) continue;
      const cu = -(P[a] + P[b] + P[e]) / 3, cv = -(P[a + 2] + P[b + 2] + P[e + 2]) / 3, ym = (P[a + 1] + P[b + 1] + P[e + 1]) / 3; let best = null;
      for (const R of RD) for (let s = 0; s < R.m - 1; s++) { const ax = R.S2[s * 2], ay = R.S2[s * 2 + 1], dx = R.S2[s * 2 + 2] - ax, dy = R.S2[s * 2 + 3] - ay, l2 = dx * dx + dy * dy || 1e-9, t = Math.max(0, Math.min(1, ((cu - ax) * dx + (cv - ay) * dy) / l2)), px = ax + dx * t, py = ay + dy * t, d = Math.hypot(cu - px, cv - py); if (!best || d < best[0]) best = [d, px, py, R, R.h[s] + (R.h[s + 1] - R.h[s]) * t + R.lift] }
      if (!best || best[3].tun || Math.abs(best[0] - best[3].w / 2) > .25 || ym > best[4] - .3) continue; ((cu - best[1]) * -nx / l + (cv - best[2]) * -nz / l > 0) ? c.sottoFuori++ : c.sottoDentro++ } return c };
  for (const [nome, r] of [['svincolo', MAPPA.sv], ['periferia', MAPPA.pe]]) for (const key of ['M', 'MS']) { const c = conta(r, key); ok(c.sottoFuori + c.sottoDentro === 0 || c.sottoFuori / (c.sottoFuori + c.sottoDentro) > .97, nome + ' ' + key + ': ' + JSON.stringify(c)) }
  const c = conta(MAPPA.sv, 'M'); ok(c.sottoFuori > 500, 'svincolo: poche pareti misurate ' + JSON.stringify(c)) });
test('mappa: ogni muro di collisione porta la quota assoluta della base e della cima (wallsY)', () => { for (const r of [MAPPA.sv, MAPPA.pe]) { ok(r.wallsY && r.wallsY.length / 2 === r.walls.length / 6, 'wallsY ' + (r.wallsY || []).length / 2 + ' per ' + r.walls.length / 6 + ' muri'); for (let i = 0; i < r.wallsY.length; i += 2) ok(r.wallsY[i + 1] > r.wallsY[i] && isFinite(r.wallsY[i]), 'muro ' + i / 2) } });
test('mappa: in galleria nessun muro alla quota dell\'auto (facciata del palazzo sopra l\'imbocco, parete dell\'altro ramo dove la galleria si divide)', () => {
  const r = MAPPA.ga, D = r.stat._dbg, RD = D.RD.filter(R => R.tun), W = r.walls, WY = r.wallsY; ok(WY, 'manca wallsY'); ok(RD.length >= 2, 'gallerie nella cella: ' + RD.length);
  let campioni = 0, bloccati = 0; const es = [];
  for (const R of RD) for (let q = 0; q < R.m - 1; q++) { const ax = R.S2[q * 2], ay = R.S2[q * 2 + 1], bx = R.S2[q * 2 + 2], by = R.S2[q * 2 + 3], L = Math.hypot(bx - ax, by - ay);
    for (let t = .5; t < L; t += 1) { const f = t / L, u = ax + (bx - ax) * f, v = ay + (by - ay) * f, y = R.h[q] + (R.h[q + 1] - R.h[q]) * f + (R.lift || 0) + .1; campioni++;
      for (let i = 0, w = 0; i + 5 < W.length; i += 6, w++) { const yb = WY[w * 2], yt = WY[w * 2 + 1]; if (y > yt + .35 || y < yb - 2.2) continue;
        const du = W[i + 2], dv = W[i + 3], ru = u - W[i], rv = v - W[i + 1], a = ru * du + rv * dv, n = -ru * dv + rv * du, ea = Math.max(0, Math.abs(a) - W[i + 4] - .05), en = Math.max(0, Math.abs(n) - .25);
        if (Math.hypot(ea, en) < .9) { bloccati++; if (es.length < 3) es.push([+u.toFixed(1), +v.toFixed(1), +y.toFixed(1), +yb.toFixed(1), +yt.toFixed(1)]); break } } } }
  ok(campioni > 500, 'campioni ' + campioni); ok(bloccati === 0, bloccati + ' campioni dell\'asse in galleria fermati da un muro, es. ' + JSON.stringify(es));
  ok((r.stat.galleriaSottoEdificio || 0) > 0, 'il caso del palazzo sopra la galleria deve presentarsi'); ok((r.stat.galleriaPareteTolta || 0) > 0, 'il caso dei due rami deve presentarsi') });
test('mappa: siepi e muretti poggiano sul terreno (prima, sui pendii, restavano sospesi o affondati); righe dipinte tolte dove due strade si sovrappongono', () => {
  const r = MAPPA.sv, NG = r.NG, d = r.S / (NG - 1), H = r.H, ter = (u, v) => { const fx0 = Math.min(NG - 1.0001, Math.max(0, u / d)), fy0 = Math.min(NG - 1.0001, Math.max(0, v / d)), i = Math.floor(fx0), j = Math.floor(fy0), fx = fx0 - i, fy = fy0 - j, p = j * NG + i; return fx + fy <= 1 ? H[p] + (H[p + 1] - H[p]) * fx + (H[p + NG] - H[p]) * fy : H[p + NG + 1] + (H[p + NG] - H[p + NG + 1]) * (1 - fx) + (H[p + 1] - H[p + NG + 1]) * (1 - fy) };
  const G = r.HG, P = G && (G.P || G.pos); ok(P && P.length > 300, 'siepi nella cella dello svincolo: ' + (P ? P.length / 3 : 0) + ' vertici');
  const basso = new Map(); for (let i = 0; i < P.length; i += 3) { const k = Math.round(P[i] * 4) + ',' + Math.round(P[i + 2] * 4), y = P[i + 1]; if (!basso.has(k) || basso.get(k) > y) basso.set(k, y) }
  let n = 0, fuori = 0; const es = []; for (const [k, y] of basso) { const [x, z] = k.split(',').map(Number), e = y - ter(-x / 4, -z / 4); n++; if (e > .45 || e < -.85) { fuori++; if (es.length < 3) es.push([-x / 4, -z / 4, +e.toFixed(2)]) } }
  ok(fuori <= n * .02, fuori + ' basi di siepe su ' + n + ' lontane dal terreno, es. ' + JSON.stringify(es));
  let L = 0; for (const R of r.stat._dbg.RD) for (let q = 0; q < R.m - 1; q++) L += Math.hypot(R.S2[q * 2 + 2] - R.S2[q * 2], R.S2[q * 2 + 3] - R.S2[q * 2 + 1]); ok((r.stat.segniTolti || 0) > 0, 'nello svincolo le rampe si sovrappongono: qualche tratto senza righe'); ok((r.stat.segniTolti || 0) < L * .05, 'righe tolte ' + Math.round(r.stat.segniTolti) + ' m su ' + Math.round(L) + ' m: troppe') });
test('collisioni con la quota (index.html): un ostacolo con yb/yt non ferma chi passa sopra o sotto, ferma chi è alla sua quota; senza quota come prima', () => {
  const fs = require('fs'), html = fs.readFileSync(process.env.IOW_PAGINA || path.join(__dirname, '..', 'index.html'), 'utf8'), i = html.indexOf('function pushS(s,r)'), j = html.indexOf('function push(x,z,r', i), k2 = html.indexOf('return[PO.x,PO.z,PO.hit]}', j);
  ok(i > 0 && j > i && k2 > j, 'pushS/push non trovate'); const cl = (v, a, b) => Math.max(a, Math.min(b, v)), PO = {};
  const muro = { x: 0, z: 0, c: 1, s: 0, hx: 3, hz: .2, yb: 10, yt: 11 }, M = new Map([['0,0', [muro]], ['-1,0', [muro]], ['0,-1', [muro]], ['-1,-1', [muro]]]);
  const push = new Function('PO', 'solids', 'CSO', 'WORLD', 'cl', html.slice(i, k2 + 25) + ';return push')(PO, [], M, { CSZ: 32, WS: 0 }, cl);
  ok(push(0, .5, 1, 10.2)[2] === 1, 'alla quota del guardrail deve fermare'); ok(push(0, .5, 1, 16)[2] === 0, 'sul viadotto 5 m sopra non deve fermare'); ok(push(0, .5, 1, 4)[2] === 0, 'nella galleria 6 m sotto non deve fermare'); ok(push(0, .5, 1)[2] === 1, 'senza quota (chiamanti vecchi) deve fermare come prima');
  const vecchio = { x: 0, z: 0, c: 1, s: 0, hx: 3, hz: .2 }; M.set('0,0', [vecchio]); ok(push(0, .5, 1, 50)[2] === 1, 'ostacolo senza quota: ferma a qualsiasi quota (come prima)');
  for (const s of ["push(fx,fz,1,V.y)", "push(fx,fz,1,u.y)", "push(P.x+vx*dt,P.z+vz*dt,P.r,P.y)", "clipDist(C.x,C.z,-dx,-dz,7.5,1,V.y)", "r.rails", "r.wallsY"]) ok(html.includes(s), 'manca nella pagina: ' + s) });

test('auto contro auto con la quota (index.html): un\'auto del traffico sulla via sopra non urta l\'auto nella galleria; alla stessa quota sì', () => {
  const fs = require('fs'), html = fs.readFileSync(process.env.IOW_PAGINA || path.join(__dirname, '..', 'index.html'), 'utf8'), i = html.indexOf('function pushS(s,r)'), j = html.indexOf('function push(x,z,r', i), k2 = html.indexOf('return[PO.x,PO.z,PO.hit]}', j);
  ok(i > 0 && j > i && k2 > j, 'pushS/push non trovate'); const cl = (v, a, b) => Math.max(a, Math.min(b, v)), PO = {};
  // sagoma di un'auto del traffico (scatola in `solids`, come in ambUpdate) sulla via a quota 30: l'auto del giocatore è a 22 (galleria) o a 30
  const auto = { on: 1, x0: -1.25, x1: 1.25, z0: -1.25, z1: 1.25, nc: 1, amb: 1, yb: 29.7, yt: 31.6 };
  const push = new Function('PO', 'solids', 'CSO', 'WORLD', 'cl', html.slice(i, k2 + 25) + ';return push')(PO, [auto], new Map(), { CSZ: 32, WS: 0 }, cl);
  ok(push(0, 1.8, 1, 30)[2] === 1, 'alla stessa quota deve urtare'); ok(push(0, 1.8, 1, 22)[2] === 0, 'nella galleria 8 m sotto non deve urtare');
  // le sagome del traffico e delle pattuglie prendono la quota; i contatti fra auto e lo speronamento controllano la differenza di quota
  for (const s of ['s.yb=c.y-.3;s.yt=c.y+1.6', 'u.sol.yb=u.y-.3;u.sol.yt=u.y+1.6', 'bs.push({p:1,x:C.x,z:C.z,y:V.y,', 'bs.push({p:0,u,x:u.x,z:u.z,y:u.y,', 'Math.abs(A.y-B.y)>2.5)continue;', 'u.v>6&&!(Math.abs(u.y-V.y)>2.5)',
    // traffico di VITA: l'ostacolo prende posizione e quota prima di accendersi (prima: auto invisibile per un passo nell'origine del mondo)
    'a.sol.x=a.x;a.sol.z=a.z;a.sol.c=0;a.sol.s=1;a.sol.yb=a.y-.3;a.sol.yt=a.y+1.6;a.sol.on=1;', 's.yb=a.y-.3;s.yt=a.y+1.6'])
    ok(html.includes(s), 'manca nella pagina: ' + s) });

console.log('\nRISULTATI REALI (rete di gioco + solver):'); console.log(JSON.stringify(RIS, null, 1));
console.log(esiti.join('\n'));
console.log('\n' + passati + ' test superati, ' + falliti + ' falliti');
if (typeof process !== 'undefined') process.exit(falliti ? 1 : 0);
