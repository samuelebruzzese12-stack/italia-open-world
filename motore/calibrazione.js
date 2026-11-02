/* ITALIA OPEN WORLD — Calibrazione: confronto fra la simulazione e i valori dichiarati dal costruttore
   ===================================================================================================
   Esegue prove riproducibili sul motore fisico (senza grafica) e calcola errori percentuali rispetto ai dati
   dichiarati nel database (motore/veicoli_db.js). I valori dichiarati sono quelli di stampa (omologazione NEDC per
   i consumi, prove del costruttore per 0-100 e velocità massima): NON sono misure strumentali fatte da noi, quindi
   il confronto dice quanto il modello è coerente con la scheda tecnica, non che sia «validato» su strada.
   Uso: node motore/calibrazione.js [idVeicolo]   oppure   IOW_CALIB.esegui(id) nel browser. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./veicoli_db.js'), require('./fisica_veicolo.js'));
  else root.IOW_CALIB = factory(root.IOW_VEICOLI, root.IOW_FISICA);
})(typeof self !== 'undefined' ? self : this, function (DB, F) {
  'use strict';
  const DT = 1 / 120;
  function nuovo(P) { const v = F.crea(P, { Tambiente: 20, carburante: P.serbatoio * 0.5 }); v.motore.Tacqua = 90; v.motore.Tolio = 95; v.ruote.temperatura = [40, 40, 40, 40]; return v }
  function errore(sim, dich) { if (!dich) return null; return +((sim - dich) / dich * 100).toFixed(1) }
  /* intervallo di incertezza: le fonti divergono → l'errore è calcolato verso il valore medio e verso l'estremo più vicino */
  function confronto(nome, unita, sim, dich, range) {
    const o = { prova: nome, unita, simulato: +sim.toFixed(2), dichiarato: dich || null, errorePct: errore(sim, dich) };
    if (range) { o.intervalloDichiarato = range; const dentro = sim >= range[0] && sim <= range[1]; o.erroreVersoIntervalloPct = dentro ? 0 : errore(sim, sim < range[0] ? range[0] : range[1]) }
    return o;
  }

  function acc(P, da, a) { const v = nuovo(P); v.v = da / 3.6; let t = 0, t0 = null; if (da > 0) { v.cambio.marcia = 3 } while (t < 60) { F.passo(v, DT, { acc: 1, iy: 1 }, {}); t += DT; if (t0 === null && v.v * 3.6 >= da + 0.01) t0 = t; if (v.v * 3.6 >= a) return da > 0 ? t - (t0 || 0) : t } return NaN }
  function vmax(P) { const v = nuovo(P); let t = 0, vm = 0; while (t < 240) { F.passo(v, DT, { acc: 1, iy: 1 }, {}); t += DT; vm = Math.max(vm, v.v) } return { kmh: vm * 3.6, marcia: v.cambio.marcia, rpm: v.motore.rpm, kW: v.motore.potenzaKW } }
  function frenata(P, da) { const v = nuovo(P); v.v = da / 3.6; v.cambio.marcia = 4; let t = 0; const d0 = v.odometro; while (v.v > 0 && t < 30) { F.passo(v, DT, { acc: 0, freno: 1, iy: 0 }, {}); t += DT } return { s: t, m: v.odometro - d0, abs: v.stat.tempoABS > 0 } }
  function crociera(P, kmh, sec) { const v = nuovo(P); v.v = kmh / 3.6; let t = 0, I = 0, L0 = null, d0 = null; const warm = Math.min(120, sec * 0.4); while (t < sec) { const err = kmh / 3.6 - v.v; I += err * DT; const a = Math.max(0, Math.min(1, 0.08 * err + 0.03 * I + 0.15)); F.passo(v, DT, { acc: a, iy: a }, {}); t += DT; if (t > warm && L0 === null) { L0 = v.carburante.consumoTot; d0 = v.odometro } } const L = v.carburante.consumoTot - L0, d = v.odometro - d0; return { l100: L / d * 1e5, rpm: v.motore.rpm, marcia: v.cambio.marcia, kW: v.motore.potenzaKW, Lh: v.motore.consumoLh } }
  /* ciclo urbano semplificato e riproducibile (4 ripetizioni: 0→50 km/h, 20 s costante, frenata, 15 s al minimo) — NON è il ciclo NEDC/WLTP */
  function urbano(P) { const v = nuovo(P); let t = 0; const L0 = v.carburante.consumoTot, d0 = v.odometro; for (let r = 0; r < 4; r++) { let p = 0; while (p < 60) { let inp; if (v.v * 3.6 < 50 && p < 25) inp = { acc: 0.5, iy: 0.5 }; else if (p < 40) { const err = 50 / 3.6 - v.v; const a = Math.max(0, Math.min(1, 0.2 * err + 0.12)); inp = { acc: a, iy: a } } else if (v.v > 0) inp = { acc: 0, freno: 0.5, iy: 0 }; else inp = { acc: 0, iy: 0 }; F.passo(v, DT, inp, {}); p += DT; t += DT } } const L = v.carburante.consumoTot - L0, d = v.odometro - d0; return { l100: L / d * 1e5, km: d / 1000 } }
  function pendenza(P, pct) { const v = nuovo(P); let t = 0; while (t < 60) { F.passo(v, DT, { acc: 1, iy: 1 }, { pendenza: Math.atan(pct / 100) }); t += DT } return { kmh: v.v * 3.6, marcia: v.cambio.marcia } }
  function rpmAVelocita(P, kmh, marcia) { const v = nuovo(P); v.cambio.modo = 'man'; v.cambio.marcia = marcia; v.v = kmh / 3.6; F.passo(v, DT, { acc: 0.3, iy: 0.3 }, {}); return v.motore.rpm }

  function esegui(id) {
    const P = DB.parametri(id || 'alfa_159_19_jtdm_150'), S = DB.VEICOLI[P.id], dich = P.dichiarato, t0 = Date.now();
    const rng = k => { const d = S.prestazioniDichiarate && S.prestazioniDichiarate[k]; return d && Array.isArray(d.v) ? d.v : null };
    const prove = [];
    const a100 = acc(P, 0, 100); prove.push(confronto('Accelerazione 0-100 km/h', 's', a100, dich.acc0_100, rng('acc0_100')));
    prove.push(confronto('Accelerazione 0-50 km/h', 's', acc(P, 0, 50), null));
    prove.push(confronto('Ripresa 60-100 km/h (cambio automatico, gas a fondo)', 's', acc(P, 60, 100), null));
    prove.push(confronto('Ripresa 80-120 km/h', 's', acc(P, 80, 120), null));
    const vm = vmax(P); prove.push(Object.assign(confronto('Velocità massima', 'km/h', vm.kmh, dich.vmax, rng('velocitaMax')), { marcia: vm.marcia, rpm: Math.round(vm.rpm), kW: +vm.kW.toFixed(1) }));
    const fr = frenata(P, 100); prove.push(Object.assign(confronto('Frenata 100-0 km/h: spazio', 'm', fr.m, null), { tempoS: +fr.s.toFixed(2), decelerazioneMedia: +((100 / 3.6) / fr.s).toFixed(2), abs: fr.abs, nota: 'valore tipico di stampa per berline di questa classe 36-42 m: non dichiarato dal costruttore' }));
    const c90 = crociera(P, 90, 300), c120 = crociera(P, 120, 300), c130 = crociera(P, 130, 300), c50 = crociera(P, 50, 300);
    prove.push(Object.assign(confronto('Consumo a 90 km/h costanti', 'L/100km', c90.l100, dich.consumoExtraurbano || null), { rpm: Math.round(c90.rpm), marcia: c90.marcia, nota: 'il dichiarato extraurbano NEDC comprende accelerazioni fino a 120 km/h: confronto solo indicativo' }));
    prove.push(Object.assign(confronto('Consumo a 120 km/h costanti', 'L/100km', c120.l100, null), { rpm: Math.round(c120.rpm), marcia: c120.marcia }));
    prove.push(Object.assign(confronto('Consumo a 130 km/h costanti', 'L/100km', c130.l100, null), { rpm: Math.round(c130.rpm), marcia: c130.marcia }));
    prove.push(Object.assign(confronto('Consumo a 50 km/h costanti', 'L/100km', c50.l100, null), { rpm: Math.round(c50.rpm), marcia: c50.marcia }));
    const ub = urbano(P); prove.push(Object.assign(confronto('Ciclo urbano semplificato (stop and go)', 'L/100km', ub.l100, dich.consumoUrbano || null), { nota: 'ciclo del gioco, non NEDC: confronto indicativo' }));
    const misto = (ub.l100 * 0.37 + c90.l100 * 0.4 + c120.l100 * 0.23); prove.push(confronto('Consumo misto stimato (37% urbano, 40% 90 km/h, 23% 120 km/h)', 'L/100km', misto, dich.consumoMisto, rng('consumoMisto')));
    const p10 = pendenza(P, 10); prove.push(Object.assign(confronto('Velocità raggiunta in 60 s su pendenza 10%', 'km/h', p10.kmh, null), { marcia: p10.marcia }));
    prove.push(confronto('Regime a 130 km/h in ultima marcia', 'giri/min', rpmAVelocita(P, 130, P.rapporti.length), null));
    prove.push(confronto('Regime a 50 km/h in 3ª', 'giri/min', rpmAVelocita(P, 50, 3), null));
    const conf = prove.filter(p => p.errorePct !== null), errMedio = conf.length ? conf.reduce((s, p) => s + Math.abs(p.errorePct), 0) / conf.length : null;
    return {
      veicolo: P.nome, id: P.id, stato: P.stato, parametriProvvisori: P.provvisori, generato: new Date().toISOString(), durataMs: Date.now() - t0, passoS: DT,
      prove, erroreMedioAssolutoPct: errMedio === null ? null : +errMedio.toFixed(1),
      giudizio: 'NON VALIDATO: confronto con i dati dichiarati di stampa, nessuna misura strumentale reale disponibile. ' + (errMedio !== null && errMedio < 10 ? 'Coerenza con la scheda tecnica entro il 10% sulle prove confrontabili.' : 'Scostamenti oltre il 10% su almeno una prova confrontabile.'),
    };
  }

  function testo(rep) {
    const L = ['CALIBRAZIONE — ' + rep.veicolo, 'Stato: ' + rep.stato, 'Parametri provvisori: ' + rep.parametriProvvisori.length + ' (' + rep.parametriProvvisori.join(', ') + ')', ''];
    for (const p of rep.prove) L.push(p.prova.padEnd(70) + String(p.simulato).padStart(8) + ' ' + p.unita.padEnd(9) + (p.dichiarato ? 'dich. ' + (p.intervalloDichiarato ? p.intervalloDichiarato.join('–') : p.dichiarato) + '  err ' + p.errorePct + '%' + (p.erroreVersoIntervalloPct !== undefined ? ' (verso intervallo ' + p.erroreVersoIntervalloPct + '%)' : '') : '(nessun dato dichiarato)') + (p.nota ? '  — ' + p.nota : ''));
    L.push('', 'Errore medio assoluto sulle prove confrontabili: ' + rep.erroreMedioAssolutoPct + '%', rep.giudizio);
    return L.join('\n');
  }
  if (typeof module === 'object' && module.exports && typeof require === 'function' && require.main === module) { const rep = esegui(process.argv[2]); console.log(testo(rep)) }
  return { esegui, testo, versione: '1.0.0' };
});
