/* ITALIA OPEN WORLD — Motore fisico del veicolo (dinamica longitudinale, motore, cambio, pneumatici, termica, consumo)
   ============================================================================================================
   Modulo puro (nessuna dipendenza dal gioco o da three.js): gira nel browser (window.IOW_FISICA) e in Node
   (module.exports) e per questo è verificabile con test automatici (test/run.js) e benchmark (motore/calibrazione.js).

   COSA CALCOLA (unità SI: m, kg, s, N, N·m, W; angoli in radianti; temperature in °C)
   - Motore: coppia a pieno carico da curva (giri → N·m), carico parziale, attrito interno, minimo con regolatore,
     limitatore, inerzia rotante, risposta del turbo (ritardo del primo ordine), temperatura refrigerante e olio,
     consumo da consumo specifico (BSFC) in funzione di carico e regime.
   - Trasmissione: cambio a rapporti reali (manuale o automatico con logica TCU), retromarcia, frizione con
     slittamento in partenza, taglio di coppia durante la cambiata, rendimento, rapporto finale, trazione
     anteriore/posteriore/integrale (ripartizione della coppia).
   - Dinamica longitudinale: massa + masse rotanti equivalenti, resistenza aerodinamica (densità dell'aria
     con quota e temperatura, vento), resistenza al rotolamento (superficie, pressione), pendenza,
     trasferimento di carico fra gli assi, limite di aderenza con controllo di trazione (ASR) virtuale,
     freni con ripartizione, ABS virtuale, freno a mano.
   - Pneumatici: modello parametrico semplificato: coefficiente di attrito = picco × superficie × pressione ×
     temperatura × usura × aquaplaning (formula di Horne semplificata). NON è un modello Pacejka: è
     documentato come approssimazione e predisposto per esserne sostituito (funzione muRuota).
   - Integrazione: Eulero semi-implicito con sottopassi (dt massimo 1/120 s) e arresto netto a velocità nulla.

   COSA NON FA (dichiarato): dinamica laterale completa (il gioco mantiene il suo modello di deriva, al quale
   questo modulo fornisce il coefficiente di aderenza), sospensioni a più gradi di libertà, modello termico
   dei freni, dinamica del turbo a mappa. Nessun valore è «validato» su veicolo reale: vedi docs/MOTORE_FISICO.md. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(typeof require === 'function' ? require('./veicoli_db.js') : null);
  else root.IOW_FISICA = factory(root.IOW_VEICOLI || null);
})(typeof self !== 'undefined' ? self : this, function (DB) {
  'use strict';
  const G = 9.80665, PI2 = Math.PI * 2;
  const cl = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (e0, e1, x) => { const t = cl((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t) };

  /* ------------------------------------------------------------------ superfici: aderenza e rotolamento relativi all'asfalto asciutto
     Valori di letteratura (ordine di grandezza, non misure del gioco): asfalto bagnato ~0,7, ghiaia ~0,6, neve
     compatta ~0,3, ghiaccio 0,1-0,15. Il coefficiente assoluto dipende dal pneumatico (parametro muMax del veicolo). */
  const SUPERFICI = {
    asfalto: { mu: 1.00, crr: 1.00, nome: 'asfalto asciutto' },
    cemento: { mu: 0.95, crr: 1.00, nome: 'cemento' },
    bagnato: { mu: 0.72, crr: 1.08, nome: 'asfalto bagnato' },
    lastricato: { mu: 0.80, crr: 1.15, nome: 'lastricato' },
    ghiaia: { mu: 0.60, crr: 1.80, nome: 'ghiaia' },
    terra: { mu: 0.68, crr: 1.60, nome: 'terra battuta' },
    erba: { mu: 0.55, crr: 2.20, nome: 'erba' },
    neve: { mu: 0.30, crr: 2.50, nome: 'neve' },
    ghiaccio: { mu: 0.12, crr: 1.00, nome: 'ghiaccio' },
  };

  /* curva di coppia: interpolazione lineare fra i punti [giri, N·m]; fuori dall'intervallo si estrapola piatta */
  function coppiaCurva(curva, rpm) {
    if (rpm <= curva[0][0]) return curva[0][1];
    for (let i = 1; i < curva.length; i++) { if (rpm <= curva[i][0]) { const a = curva[i - 1], b = curva[i]; return lerp(a[1], b[1], (rpm - a[0]) / (b[0] - a[0])) } }
    return curva[curva.length - 1][1];
  }

  /* ------------------------------------------------------------------ pneumatico: coefficiente di attrito effettivo di una ruota
     p: pressione [bar], pNom: pressione nominale, T: temperatura gomma [°C], usura 0..1, sup: superficie,
     acqua: altezza d'acqua sulla strada [mm], v: velocità [m/s]. Restituisce { mu, aquaplaning (0..1) }. */
  function muRuota(muMax, p, pNom, T, usura, sup, acqua, v) {
    const S = SUPERFICI[sup] || SUPERFICI.asfalto;
    const fp = p <= 0.2 ? 0.55 : 1 - 0.35 * Math.min(1, Math.abs(p / pNom - 1));           // sgonfio o troppo gonfio: meno impronta utile
    const fT = T < 0 ? 0.93 : T < 45 ? lerp(0.93, 1.0, T / 45) : T < 110 ? 1.0 : Math.max(0.75, 1 - (T - 110) / 200); // gomma fredda o surriscaldata
    const fu = 1 - 0.25 * cl(usura, 0, 1) * (sup === 'bagnato' ? 2.2 : 1);                   // l'usura pesa soprattutto sul bagnato
    let aq = 0;
    if (acqua > 0.5 && p > 0.3) {
      // Horne (NASA): velocità di aquaplaning ≈ 6,35·√p(psi) in km/h ... in nodi 9·√p(psi); qui in m/s: 0,447·10,35·√p(psi)
      const vp = 0.447 * 10.35 * Math.sqrt(p * 14.5038);
      aq = smooth(0.8 * vp, 1.1 * vp, Math.abs(v)) * smooth(0.5, 4, acqua);
    }
    const mu = muMax * S.mu * fp * fT * fu * (1 - 0.85 * aq);
    return { mu: Math.max(0.03, mu), aquaplaning: aq };
  }

  /* densità dell'aria [kg/m3]: atmosfera standard con quota [m] e temperatura [°C] */
  function densitaAria(quota, tempC) { return 1.225 * Math.exp(-(quota || 0) / 8434) * 288.15 / ((tempC === undefined ? 15 : tempC) + 273.15) }

  /* ------------------------------------------------------------------ creazione dello stato del veicolo */
  function crea(par, opt) {
    opt = opt || {};
    const P = Object.assign({}, par);
    const n = P.rapporti.length;
    const v = {
      par: P, t: 0, v: 0, a: 0, odometro: 0,
      motore: { acceso: opt.acceso !== false, rpm: P.minimo, coppia: 0, carico: 0, acc: 0, accEff: 0, boost: 0, Tacqua: opt.Tambiente !== undefined ? opt.Tambiente : 20, Tolio: opt.Tambiente !== undefined ? opt.Tambiente : 20, consumoLh: 0, potenzaKW: 0, limitatore: false, avviamentoT: 0, stallo: false },
      cambio: { marcia: opt.marcia !== undefined ? opt.marcia : 1, nMarce: n, modo: opt.modo || 'auto', cambiataT: 0, frizione: 1, slitta: false, rpmRuote: 0, ultimoCambio: -9, ultimoVerso: 0 },
      carburante: { litri: opt.carburante !== undefined ? opt.carburante : P.serbatoio * 0.6, serbatoio: P.serbatoio, riserva: false, vuoto: false, consumoTot: 0 },
      ruote: {
        pressione: [P.pressioneNom, P.pressioneNom, P.pressioneNom, P.pressioneNom], temperatura: [20, 20, 20, 20], usura: [0, 0, 0, 0],
        mu: [1, 1, 1, 1], aquaplaning: 0, slitta: false, bloccate: false, bloccatePost: false, slip: 0, carichi: [0, 0], aderenza: 1,
      },
      freni: { richiesta: 0, forza: 0, abs: false, mano: false, temperatura: 20 },
      forze: { trazione: 0, freno: 0, aero: 0, rotolamento: 0, pendenza: 0, extra: 0, netta: 0, massaEq: P.massa },
      /* modificatori imposti dall'esterno (danni meccanici, ECU). Tutti 1 = veicolo sano. */
      mod: { potenza: 1, radiatore: 1, refrigerante: 1, freni: [1, 1, 1, 1], cambio: 1, trasmissione: 1, frizione: 1, differenziale: 1, muRuota: [1, 1, 1, 1], attritoExtra: 0, muMult: 1, massaExtra: 0, perditaCarburante: 0, alternatore: 1, avviamento: 1 },   // frizione/differenziale/muRuota: dal Vehicle Damage Solver e da danni_meccanici
      /* limiti imposti dalle ECU virtuali (vedi motore/ecu.js). */
      ecu: { accMax: 1, limitatore: P.limitatore, asr: !!P.esc, abs: !!P.abs, tagliaCoppia: 0, cambioBloccato: false, marciaMaxTCU: n, spegni: false },
      amb: { pendenza: 0, superficie: 'asfalto', acqua: 0, tempAria: 20, quota: 0, vento: 0 },
      eventi: [],
      stat: { tempoSlitta: 0, tempoABS: 0, tempoASR: 0, surriscaldamenti: 0, nCambiate: 0 },
    };
    v.motore.rpm = v.motore.acceso ? P.minimo : 0;
    return v;
  }

  /* rapporto totale della marcia corrente (0 in folle) */
  function rapportoTot(v) { const c = v.cambio, P = v.par; if (c.marcia === 0) return 0; return (c.marcia < 0 ? -P.retro : P.rapporti[c.marcia - 1]) * P.finale }
  /* giri delle ruote motrici → giri motore per la marcia data */
  function rpmDaVelocita(v, vel, marcia) { const P = v.par, r = marcia === 0 ? 0 : (marcia < 0 ? -P.retro : P.rapporti[marcia - 1]) * P.finale; return Math.abs(vel) / (PI2 * P.raggioRuota) * 60 * Math.abs(r) }

  function evento(v, tipo, dati) { v.eventi.push(Object.assign({ t: +v.t.toFixed(3), tipo }, dati || {})); if (v.eventi.length > 400) v.eventi.splice(0, 100) }

  /* ------------------------------------------------------------------ logica del cambio automatico (TCU virtuale)
     Scelta della marcia in base a giri e acceleratore: salita di marcia a regime crescente con il gas (diesel: 2200-4300),
     scalata a basso regime, kick-down con gas a fondo. La cambiata dura 0,3 s con taglio di coppia. */
  function tcu(v, dt, acc, frena, iy) {
    const c = v.cambio, m = v.motore, P = v.par;
    if (c.cambiataT > 0) { c.cambiataT -= dt; if (c.cambiataT <= 0) { c.cambiataT = 0; c.frizione = 1 } return }
    if (v.ecu.cambioBloccato) return;
    const vel = v.v;
    // retromarcia e prima: con il veicolo quasi fermo si segue il verso richiesto dal comando
    if (Math.abs(vel) < 0.6) {
      if (iy < -0.05 && c.marcia >= 0) { cambia(v, -1); return }
      if (iy > 0.05 && c.marcia <= 0) { cambia(v, 1); return }
    }
    if (c.marcia <= 0) return;
    if (c.modo !== 'auto') return;
    const rpm = m.rpm, up = lerp(1750, Math.min(P.limitatore - 250, P.regimePotenzaMax * 1.08), acc * acc), dn = lerp(1150, 1900, acc);   // a gas leggero sale presto di marcia (consumi), a gas pieno tira fino al regime di potenza
    const maxM = Math.min(c.nMarce, v.ecu.marciaMaxTCU || c.nMarce), daUltimo = v.t - c.ultimoCambio;
    if (rpm > up && c.marcia < maxM && !frena && !(c.ultimoVerso < 0 && daUltimo < 0.8)) { cambia(v, c.marcia + 1); return }
    if (c.marcia > 1 && !(c.ultimoVerso > 0 && daUltimo < 1.5)) {
      const rpmGiu = rpmDaVelocita(v, vel, c.marcia - 1);
      const kick = acc > 0.85 && rpm < Math.min(2300, P.regimeCoppiaMax * 1.1) && rpmGiu < P.limitatore - 600;   // kick-down: solo se la marcia inferiore porta vicino alla coppia massima senza sfiorare il limitatore
      if ((rpm < dn || kick) && rpmGiu < P.limitatore - 150) cambia(v, c.marcia - 1);
    }
  }
  function cambia(v, marcia) {
    const c = v.cambio; marcia = cl(Math.round(marcia), -1, c.nMarce);
    if (marcia === c.marcia) return false;
    if (v.ecu.cambioBloccato) return false;
    if (marcia < 0 && v.v > 1.5) return false;            // niente retromarcia in corsa
    if (marcia > 0 && v.v < -1.5) return false;
    c.ultimoVerso = marcia > c.marcia ? 1 : -1; c.marcia = marcia; c.cambiataT = marcia === 0 ? 0 : (c.modo === 'auto' ? 0.28 : 0.38) * (2 - v.mod.cambio); c.frizione = 0; c.ultimoCambio = v.t; v.stat.nCambiate++;
    evento(v, 'cambiata', { marcia });
    return true;
  }

  /* ------------------------------------------------------------------ un passo di simulazione (chiamato dal gioco ogni fotogramma)
     input: { acc 0..1, freno 0..1, frenoMano bool, iy (-1..1 comando del giocatore: serve per retromarcia), marciaCmd:'su'|'giu'|'folle'|null,
              scivolamentoLaterale m/s (dal modello di deriva del gioco), avvia bool }
     amb:   { pendenza rad (+ salita), superficie, acqua mm, tempAria °C, quota m, vento m/s (+ contrario), carico kg }
     Legge e aggiorna v.v (velocità longitudinale). Restituisce v. */
  function passo(v, dt, input, amb) {
    if (!(dt > 0)) return v;
    input = input || {}; if (amb) Object.assign(v.amb, amb);
    const n = Math.max(1, Math.ceil(dt / (1 / 120))), h = dt / n;
    for (let i = 0; i < n; i++) sottopasso(v, h, input);
    return v;
  }

  function sottopasso(v, dt, inp) {
    const P = v.par, m = v.motore, c = v.cambio, R = v.ruote, F = v.forze, A = v.amb, M = v.mod, E = v.ecu;
    v.t += dt;
    const massa = P.massa + (A.carico || 0) + (M.massaExtra || 0);
    const vel = v.v, sgn = vel > 0.02 ? 1 : vel < -0.02 ? -1 : 0, cosP = Math.cos(A.pendenza || 0), sinP = Math.sin(A.pendenza || 0);
    const iy = inp.iy !== undefined ? inp.iy : (inp.acc || 0) - (inp.freno || 0);
    // acceleratore e freno: con comando "indietro" il freno agisce se si avanza, altrimenti si va in retromarcia (come nel gioco)
    let acc = cl(inp.acc !== undefined ? inp.acc : Math.max(0, iy), 0, 1), freno = cl(inp.freno !== undefined ? inp.freno : Math.max(0, -iy), 0, 1);
    if (c.marcia < 0) { const t = acc; acc = freno; freno = t; if (vel < -0.6 && iy > 0.05) { acc = 0; freno = iy } }
    else if (vel > 0.6 && iy < -0.05) { acc = 0; freno = -iy }
    if (Math.abs(vel) < 0.6 && c.marcia >= 0 && iy < -0.05) { acc = -iy; freno = 0 }   // comando «indietro» da fermo: si innesta la retromarcia (tcu) e si parte
    if (c.marcia < 0 && Math.abs(vel) < 0.6 && iy < -0.05) { acc = -iy; freno = 0 }
    if (Math.abs(vel) < 0.6 && c.marcia < 0 && iy > 0.05) { acc = iy; freno = 0 }
    // comandi manuali del cambio
    if (inp.marciaCmd === 'su') { cambia(v, c.marcia + 1); inp.marciaCmd = null } else if (inp.marciaCmd === 'giu') { cambia(v, c.marcia - 1); inp.marciaCmd = null } else if (inp.marciaCmd === 'folle') { cambia(v, 0); inp.marciaCmd = null }
    if (c.modo === 'auto' || Math.abs(vel) < 0.6) tcu(v, dt, acc, freno > 0.1, iy); else if (c.cambiataT > 0) { c.cambiataT -= dt; if (c.cambiataT <= 0) { c.cambiataT = 0; c.frizione = 1 } }

    /* --- carburante e avviamento --- */
    const carb = v.carburante;
    carb.vuoto = carb.litri <= 0.05; carb.riserva = carb.litri < carb.serbatoio * 0.1;
    if (m.acceso && (carb.vuoto || E.spegni)) { m.acceso = false; m.stallo = carb.vuoto; evento(v, carb.vuoto ? 'motore_spento_carburante' : 'motore_spento_ecu') }
    if (!m.acceso && inp.avvia && !carb.vuoto && M.avviamento > 0.2) { m.avviamentoT += dt; if (m.avviamentoT > 0.6 / M.avviamento) { m.acceso = true; m.avviamentoT = 0; m.stallo = false; evento(v, 'motore_avviato') } } else m.avviamentoT = 0;

    /* --- motore: regime, coppia disponibile --- */
    const r = P.raggioRuota, rap = rapportoTot(v), ratio = Math.abs(rap);
    c.rpmRuote = Math.abs(vel) / (PI2 * r) * 60 * ratio;                    // giri che il motore avrebbe a frizione chiusa
    const inCambiata = c.cambiataT > 0, innestata = c.marcia !== 0 && !inCambiata;
    const accECU = m.acceso ? Math.min(acc, E.accMax) * (1 - cl(E.tagliaCoppia, 0, 1)) : 0;
    // limitatore: taglio del gas sopra il regime massimo (quello del motore o quello imposto dall'ECU)
    const rpmLim = Math.min(P.limitatore, E.limitatore || P.limitatore);
    m.limitatore = m.acceso && m.rpm > rpmLim;
    let accEff = m.limitatore ? 0 : accECU;
    // regolatore del minimo: a frizione aperta o in partenza il motore si mantiene al minimo
    let rpmTarget;
    if (innestata) {
      const rpmMin = P.minimo * (0.95 + 1.6 * accEff);                             // in partenza la frizione slitta e il motore sta sopra il minimo (a gas pieno ~2000 giri)
      c.slitta = c.rpmRuote < rpmMin && m.acceso;
      rpmTarget = m.acceso ? Math.max(c.rpmRuote, rpmMin) : c.rpmRuote;
      c.frizione = 1;                                                                 // la frizione trasmette tutta la coppia anche slittando (capacità > coppia motore)
    } else if (inCambiata && c.marcia !== 0) { c.slitta = false; rpmTarget = m.acceso ? Math.max(P.minimo, c.rpmRuote) : 0; accEff = 0 }   // durante la cambiata: taglio del gas e regime che si porta a quello della nuova marcia
    else { c.slitta = false; rpmTarget = m.acceso ? P.minimo + (rpmLim - P.minimo) * accEff * 0.9 : 0 }
    // dinamica del regime: in presa segue le ruote (rigido), a vuoto risponde con l'inerzia del volano
    if (innestata && !c.slitta) m.rpm = rpmTarget;
    else { const tau = innestata ? 0.12 : 0.35 / Math.max(0.3, 1 + accEff); m.rpm += (rpmTarget - m.rpm) * Math.min(1, dt / tau) }
    if (!m.acceso) m.rpm = Math.max(0, m.rpm - 1500 * dt * (innestata ? 0 : 1));
    if (m.acceso && !innestata && m.rpm < P.minimo * 0.6) m.rpm = P.minimo * 0.6;
    // turbo: la pressione segue il gas con ritardo; a bassi giri il turbo non spinge
    if (P.turbo) { const target = accEff * P.boostMax * cl((m.rpm - 1000) / 900, 0.15, 1); m.boost += (target - m.boost) * Math.min(1, dt / (target > m.boost ? 0.55 : 0.25)) } else m.boost = 0;
    // coppia: a pieno carico dalla curva (scalata per i danni), con il turbo che aggiunge la sua parte; a carico parziale attrito motore
    const Twot = coppiaCurva(P.curvaCoppia, m.rpm) * M.potenza, Tfric = P.attrito[0] + P.attrito[1] * m.rpm;
    const kTurbo = P.turbo ? (0.6 + 0.4 * cl(m.boost / Math.max(0.01, P.boostMax * Math.max(0.15, accEff)), 0, 1)) : 1;
    let Teng = m.acceso ? accEff * Twot * kTurbo - (1 - accEff) * Tfric : -Tfric * (m.rpm > 10 ? 1 : 0);
    if (m.acceso && !innestata) Teng = 0;                                          // in folle la coppia va solo al volano (già nel rpmTarget)
    if (m.acceso && c.slitta && Teng < 0) Teng = 0;                                 // frizione che slitta al minimo: il freno motore non arriva alle ruote
    m.coppia = Teng; m.carico = Twot > 0 ? cl(Math.max(0, Teng) / Twot, 0, 1) : 0; m.acc = acc; m.accEff = accEff;
    m.potenzaKW = m.coppia * m.rpm * PI2 / 60 / 1000;

    /* --- forze alle ruote --- */
    const rho = densitaAria(A.quota, A.tempAria), vRel = vel + (A.vento || 0);
    F.aero = 0.5 * rho * P.cx * P.area * vRel * vRel * Math.sign(vRel);
    // pneumatici: pressione, temperatura, usura → coefficiente di attrito per ruota; la media fra gli assi guida il modello
    const S = SUPERFICI[A.superficie] || SUPERFICI.asfalto;
    let muAnt = 0, muPos = 0, aq = 0;
    for (let k = 0; k < 4; k++) { const q = muRuota(P.muMax, R.pressione[k], P.pressioneNom, R.temperatura[k], R.usura[k], A.superficie, A.acqua || 0, vel); const mk = M.muMult * (M.muRuota && Number.isFinite(M.muRuota[k]) ? M.muRuota[k] : 1); R.mu[k] = q.mu * mk; aq = Math.max(aq, q.aquaplaning); if (k < 2) muAnt += q.mu * mk / 2; else muPos += q.mu * mk / 2 }   // muRuota: aderenza per ruota dai danni (mozzo, cerchio, foratura)
    R.aquaplaning = aq; R.aderenza = cl((muAnt + muPos) / 2 / Math.max(0.05, P.muMax), 0, 1);
    const pMedia = (R.pressione[0] + R.pressione[1] + R.pressione[2] + R.pressione[3]) / 4;
    const crr = 0.011 * S.crr * Math.sqrt(P.pressioneNom / Math.max(0.3, pMedia)) * (1 + 0.5 * cl(v.ruote.usura[0], 0, 1) * 0);
    F.rotolamento = crr * massa * G * cosP * (sgn || (Math.abs(vel) > 0.001 ? Math.sign(vel) : 0));
    F.pendenza = massa * G * sinP;
    F.extra = (M.attritoExtra || 0) * (sgn || 0);
    // carichi sugli assi con trasferimento longitudinale (dall'accelerazione del passo precedente: stabile e sufficiente)
    const Nf = cl(massa * G * cosP * P.quotaAnt - massa * v.a * P.hCg / P.passo, 0.05 * massa * G, 0.95 * massa * G), Nr = Math.max(0.05 * massa * G, massa * G * cosP - Nf);
    R.carichi = [Nf, Nr];
    // coppia alle ruote motrici
    let Ftraz = 0; R.slitta = false;
    if (innestata) {
      const capF = M.frizione === undefined ? 1 : M.frizione, capD = M.differenziale === undefined ? 1 : M.differenziale;   // danni: frizione che slitta (limita la coppia), differenziale rotto (niente trazione)
      const Twheel = Teng * rap * P.rendimento * M.trasmissione * c.frizione * capD * (Teng > 0 ? capF : 1);      // segno: retromarcia → negativo
      Ftraz = Twheel / r;
      const fwd = P.trazione === 'anteriore', awd = P.trazione === 'integrale';
      const Nmot = awd ? Nf + Nr : fwd ? Nf : Nr, muMot = awd ? (muAnt + muPos) / 2 : fwd ? muAnt : muPos;
      const Fmax = muMot * Nmot;
      if (Math.abs(Ftraz) > Fmax && Teng > 0) {
        if (E.asr) { Ftraz = Math.sign(Ftraz) * Fmax * 0.97; v.stat.tempoASR += dt; R.slip = 0.12 }        // controllo di trazione: tiene le ruote al limite
        else { Ftraz = Math.sign(Ftraz) * Fmax * 0.8; R.slitta = true; v.stat.tempoSlitta += dt; R.slip = 0.5 } // pattinamento: aderenza di scivolamento
      } else R.slip = Math.abs(Ftraz) / Math.max(1, Fmax) * 0.1;
    } else R.slip = 0;
    F.trazione = Ftraz;
    // freni: ripartizione 68/32, limite di aderenza per asse, ABS virtuale (mantiene il 96% dell'aderenza), freno a mano sul retrotreno
    const Fb = [0, 0, 0, 0];
    v.freni.richiesta = freno; v.freni.mano = !!inp.frenoMano;
    const Freq = freno * massa * P.decelMax, mf = (M.freni[0] + M.freni[1]) / 2, mr = (M.freni[2] + M.freni[3]) / 2;
    let FbAnt = Freq * 0.68 * mf, FbPos = Freq * 0.32 * mr;
    const FmaxAnt = muAnt * Nf, FmaxPos = muPos * Nr;
    R.bloccate = false; v.freni.abs = false;
    if (FbPos > FmaxPos) { if (E.abs) { FbAnt += (FbPos - FmaxPos * 0.96) * mf / Math.max(0.2, mr); FbPos = FmaxPos * 0.96; v.freni.abs = true } else { FbPos = FmaxPos * 0.72; R.bloccate = R.bloccate || Math.abs(vel) > 1 } }   // EBD: la richiesta in eccesso sul retrotreno passa all'anteriore
    if (FbAnt > FmaxAnt) { if (E.abs) { FbAnt = FmaxAnt * 0.96; v.freni.abs = true } else { FbAnt = FmaxAnt * 0.72; R.bloccate = true } }
    if (v.freni.abs) v.stat.tempoABS += dt;
    R.bloccatePost = false;
    if (inp.frenoMano) { const Fhb = Math.min(0.42 * massa * G, FmaxPos * 1.2); FbPos = Math.max(FbPos, Math.min(Fhb, FmaxPos * 0.75)); if (Math.abs(vel) > 1.5) R.bloccatePost = true }
    F.freno = (FbAnt + FbPos) * (sgn || 0);
    Fb[0] = Fb[1] = FbAnt / 2; Fb[2] = Fb[3] = FbPos / 2;
    // massa equivalente: masse rotanti (ruote ≈ 4×1,2 kg·m2, motore e cambio riportati alle ruote)
    const Ieq = 4 * 1.2 + (innestata && !c.slitta ? P.inerzia * ratio * ratio * P.rendimento : 0);
    F.massaEq = massa + Ieq / (r * r);
    F.netta = F.trazione - F.freno - F.aero - F.rotolamento - F.pendenza - F.extra;
    /* --- integrazione: con il veicolo fermo le resistenze non lo mettono in moto all'indietro --- */
    let a = F.netta / F.massaEq, vNew = vel + a * dt;
    const tieneFermo = freno + (inp.frenoMano ? 1 : 0) > 0.05 || accEff < 0.05 || !m.acceso;                                  // freno, freno a mano o «hill holder» automatico (senza gas il veicolo resta fermo in pendenza)
    if (sgn === 0 && Math.abs(F.trazione) < Math.abs(F.pendenza) + 0.02 * massa * G && tieneFermo) { vNew = 0; a = 0 }
    else if (sgn === 0 && Math.abs(F.trazione) <= Math.abs(F.pendenza) + crr * massa * G * 0.5 && Math.abs(F.pendenza) < crr * massa * G) { vNew = 0; a = 0 } // in piano senza gas: fermo
    else if (sgn !== 0 && Math.sign(vNew) !== sgn && Math.abs(F.trazione) < Math.abs(F.freno) + Math.abs(F.rotolamento) + Math.abs(F.extra) + Math.abs(F.pendenza) * (Math.sign(F.pendenza) === sgn ? 0 : 1)) { vNew = 0; a = -vel / dt } // frenata o resistenze: arresto netto, niente oscillazione attorno allo zero
    // in salita senza freno il veicolo può indietreggiare: lo permette solo se la pendenza supera la trazione
    v.a = a; v.v = vNew; v.odometro += Math.abs(vNew) * dt;
    if (!m.acceso && Math.abs(vNew) < 0.05) v.v = 0;

    /* --- consumo: dal consumo specifico (BSFC) in funzione di carico e regime; al minimo valore fisso --- */
    let Lh = 0;
    if (m.acceso) {
      const Pbrake = Math.max(0, m.coppia) * m.rpm * PI2 / 60 / 1000;                  // potenza al volano [kW] (il BSFC è già riferito alla potenza utile)
      const rpmBest = P.regimeCoppiaMax, load = m.carico;
      const bsfc = P.bsfcMin * (1 + 0.45 * Math.pow(1 - load, 2) + 0.3 * Math.pow((m.rpm - rpmBest) / rpmBest, 2));   // g/kWh: peggiora a carico parziale e lontano dal regime di coppia
      const dens = P.diesel ? 0.835 : 0.745;
      const minimoLh = P.consumoMinimo * Math.max(1, m.rpm / P.minimo) * (innestata ? 0.5 : 1);                      // portata minima per tenere acceso il motore
      Lh = minimoLh + Pbrake * bsfc / 1000 / dens;
      if (m.coppia <= 0 && innestata && m.rpm > P.minimo * 1.3) Lh = 0;              // rilascio in marcia: taglio dell'iniezione (cut-off)
    }
    m.consumoLh = Lh;
    const dL = Lh / 3600 * dt + (M.perditaCarburante || 0) * dt;
    carb.litri = Math.max(0, carb.litri - dL); carb.consumoTot += Lh / 3600 * dt;

    /* --- termica: refrigerante e olio. Calore dal carburante (≈28% al refrigerante), scambio al radiatore con termostato --- */
    const Tamb = A.tempAria === undefined ? 20 : A.tempAria;
    if (m.acceso || m.Tacqua > Tamb) {
      const Pfuel = m.acceso ? Lh / 3600 * (P.diesel ? 835 : 745) * 42.6e3 : 0;      // W (potere calorifico ≈42,6 MJ/kg)
      const Qin = m.acceso ? 0.28 * Pfuel + 250 : 0;
      const termostato = smooth(84, 93, m.Tacqua);
      const kRad = (300 + 24 * Math.abs(vel)) * M.radiatore * (0.35 + 0.65 * M.refrigerante);   // W/K: radiatore (ventola a basse velocità inclusa nel termine fisso)
      const Qout = (termostato * kRad + 45) * (m.Tacqua - Tamb);
      const Ccool = 26e3 * (0.4 + 0.6 * M.refrigerante);                              // J/K: capacità termica del circuito
      m.Tacqua = Math.min(140, m.Tacqua + (Qin - Qout) / Ccool * dt);                 // oltre ~140 °C il liquido bolle: il modello non segue la fase vapore (limite dichiarato)
      m.Tolio += ((m.Tacqua + 8 * m.carico + 4) - m.Tolio) * Math.min(1, dt / 40);
      if (m.Tacqua > 118) { if (!m.surriscaldato) { m.surriscaldato = true; v.stat.surriscaldamenti++; evento(v, 'surriscaldamento', { T: +m.Tacqua.toFixed(1) }) } } else if (m.Tacqua < 105) m.surriscaldato = false;
    }
    /* --- pneumatici: temperatura (riscaldamento con velocità, frenata e slittamento) e usura; pressione sale con la temperatura --- */
    for (let k = 0; k < 4; k++) {
      const riscald = 0.012 * Math.abs(vel) + 0.6 * R.slip * Math.abs(vel) * (k < 2 ? 1 : 0.6) + Fb[k] / 20000 * Math.abs(vel) * 0.3 + (R.bloccatePost && k >= 2 ? 0.8 : 0);
      R.temperatura[k] += (riscald * 1.0 - (R.temperatura[k] - Tamb) * 0.012) * dt;
      if (R.slip > 0.3 || (R.bloccatePost && k >= 2)) R.usura[k] = Math.min(1, R.usura[k] + 2e-4 * Math.abs(vel) * dt);
      else R.usura[k] = Math.min(1, R.usura[k] + 3e-9 * Math.abs(vel) * dt);           // usura normale: ~0,1 ogni 10.000 km... (ordine di grandezza)
    }
    return v;
  }

  /* ------------------------------------------------------------------ utilità per il gioco e i test */
  function rifornisci(v, litri) { const c = v.carburante, add = Math.max(0, Math.min(litri, c.serbatoio - c.litri)); c.litri += add; if (c.litri > 0.2) c.vuoto = false; return add }
  function telemetria(v) {
    const m = v.motore, c = v.cambio, R = v.ruote;
    return {
      t: +v.t.toFixed(2), velocitaKmh: +(v.v * 3.6).toFixed(1), accelerazione: +v.a.toFixed(2), marcia: c.marcia, modoCambio: c.modo, rpm: Math.round(m.rpm), acceso: m.acceso,
      coppiaNm: +m.coppia.toFixed(0), potenzaKW: +m.potenzaKW.toFixed(1), carico: +m.carico.toFixed(2), boostBar: +m.boost.toFixed(2), limitatore: m.limitatore,
      Tacqua: +m.Tacqua.toFixed(1), Tolio: +m.Tolio.toFixed(1), consumoLh: +m.consumoLh.toFixed(2), carburanteL: +v.carburante.litri.toFixed(2), riserva: v.carburante.riserva,
      pressioni: R.pressione.map(p => +p.toFixed(2)), Tgomme: R.temperatura.map(t => Math.round(t)), aderenza: +R.aderenza.toFixed(2), aquaplaning: +R.aquaplaning.toFixed(2),
      slitta: R.slitta, bloccate: R.bloccate, abs: v.freni.abs, asr: v.stat.tempoASR > 0, carichi: R.carichi.map(n => Math.round(n)),
      forze: { trazione: Math.round(v.forze.trazione), freno: Math.round(v.forze.freno), aero: Math.round(v.forze.aero), rotolamento: Math.round(v.forze.rotolamento), pendenza: Math.round(v.forze.pendenza), extra: Math.round(v.forze.extra) },
      odometroKm: +(v.odometro / 1000).toFixed(3), superficie: v.amb.superficie, pendenzaPct: +(Math.tan(v.amb.pendenza || 0) * 100).toFixed(1),
    };
  }
  /* stato minimo da salvare (il resto si ricostruisce) */
  function serializza(v) { return { v: 2, carburante: +v.carburante.litri.toFixed(3), consumoTot: +v.carburante.consumoTot.toFixed(4), odometro: +v.odometro.toFixed(1), Tacqua: +v.motore.Tacqua.toFixed(1), Tolio: +v.motore.Tolio.toFixed(1), usura: v.ruote.usura.map(u => +u.toFixed(5)), pressione: v.ruote.pressione.map(p => +p.toFixed(3)), modo: v.cambio.modo, acceso: v.motore.acceso, stat: v.stat } }
  function ripristina(v, s) { if (!s || typeof s !== 'object') return false; const n = (x, fb) => Number.isFinite(x) ? x : fb; v.carburante.litri = cl(n(s.carburante, v.carburante.litri), 0, v.carburante.serbatoio); v.carburante.consumoTot = n(s.consumoTot, 0); v.odometro = n(s.odometro, 0); v.motore.Tacqua = n(s.Tacqua, 20); v.motore.Tolio = n(s.Tolio, 20); if (Array.isArray(s.usura) && s.usura.length === 4) v.ruote.usura = s.usura.map(u => cl(n(u, 0), 0, 1)); if (Array.isArray(s.pressione) && s.pressione.length === 4) v.ruote.pressione = s.pressione.map(p => cl(n(p, v.par.pressioneNom), 0, 5)); if (s.modo === 'man' || s.modo === 'auto') v.cambio.modo = s.modo; if (typeof s.acceso === 'boolean') { v.motore.acceso = s.acceso; if (!s.acceso) v.motore.rpm = 0 } if (s.stat && typeof s.stat === 'object') Object.assign(v.stat, s.stat); return true }

  return { versione: '1.1.0', SUPERFICI, coppiaCurva, muRuota, densitaAria, crea, passo, cambia, rapportoTot, rpmDaVelocita, rifornisci, telemetria, serializza, ripristina, DB, G };
});
