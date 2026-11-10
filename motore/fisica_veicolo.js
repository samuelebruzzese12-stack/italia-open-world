/* ITALIA OPEN WORLD — Motore fisico del veicolo (motore, cambio, dinamica a 7 gradi di libertà con la Magic Formula, centralina, termica, consumo)
   ===========================================================================================================================================
   Modulo puro (nessuna dipendenza dal gioco o da three.js): gira nel browser (window.IOW_FISICA) e in Node (module.exports) e per questo è
   verificabile con test automatici (test/run.js, test/pneumatici_dinamica.js) e benchmark (motore/calibrazione.js).
   Richiede motore/pneumatici_mf.js (Magic Formula combinata) e motore/controllo_dinamica.js (ABS, TCS, ESP, EBD, blackout), caricati prima.

   COSA CALCOLA (unità SI: m, kg, s, N, N·m, W; angoli in radianti; temperature in °C)
   - Motore: coppia a pieno carico da curva (giri → N·m), carico parziale, attrito interno, minimo con regolatore, limitatore, risposta del
     turbo (ritardo del primo ordine), temperatura refrigerante e olio, consumo da consumo specifico (BSFC) in funzione di carico e regime.
   - Trasmissione: cambio a rapporti reali (manuale o automatico con logica TCU), retromarcia, frizione con slittamento in partenza, taglio
     di coppia durante la cambiata, rendimento, rapporto finale, trazione anteriore/posteriore/integrale con differenziale aperto
     (coppia uguale sulle ruote motrici). In frenata decisa o con il freno a mano la frizione si apre (convertitore/conducente).
   - Dinamica a 7 gradi di libertà a passo FISSO di 5 ms (200 Hz), come tools/dinamica/dinamica_7dof.py:
       m·(v̇x − r·vy) = Σ (Fx,i·cos δi − Fy,i·sin δi) − F_aria − F_rotolamento − F_pendenza + F_esterna
       m·(v̇y + r·vx) = Σ (Fx,i·sin δi + Fy,i·cos δi) + F_esterna
       Iz·ṙ           = Σ (xi·Fy,i^c − yi·Fx,i^c + Mz,i) + M_esterno
       Iw·ω̇i          = Tmotrice,i − Tfreno,i·sgn ωi − Re·Fx,i        (con la frizione chiusa le ruote motrici trascinano l'inerzia del motore:
                                                                     matrice delle masse con Ie·τ²/n² fra le ruote motrici)
     vx e le ω libere si integrano con Eulero all'indietro linearizzato ((M − h·J)·Δq = h·Q, J con dFx/dκ di ogni ruota): le equazioni delle
     ruote sono rigide (costante di tempo Iw·v/(Re²·Cκ) sotto il millisecondo a bassa velocità). vy e r con Eulero semi-implicito.
     Scorrimento κ = (ω·Re − Vx,ruota)/max(|Vx|, |ω·Re|, 1 m/s): ruota ferma → κ = −1 esatto. Deriva α con lunghezza di rilassamento
     (σα = Kyα/C carcassa), limitata allo strisciamento. Carichi verticali con trasferimento longitudinale e laterale (accelerazioni filtrate,
     ripartizione del rollio fra gli assi). Sterzo con Ackermann parziale. Forze della Magic Formula combinata di ogni ruota con il suo
     coefficiente d'attrito (superficie, pressione, temperatura, usura, aquaplaning, danni) come fattore di scala λμ della formula; a pieno
     strisciamento la forza passa all'attrito isotropo (opposta alla velocità di strisciamento). Bloccaggio geometrico: quando il freno porta
     la ruota a zero e trattiene la coppia che strada e motore le applicano, ω resta esattamente 0 finché il freno non molla.
   - Centralina (motore/controllo_dinamica.js) a ogni passo: ABS e TCS con PID sullo scorrimento di picco della formula, ESP sull'imbardata
     di riferimento, EBD; blackout oltre 15 g (urto()) con freni grezzi. Impianto idraulico con ritardo di 12 ms.
   - Pneumatici: temperatura e usura dalla potenza di strisciamento del contatto; aquaplaning (formula di Horne semplificata).
   - Il gioco passa ogni fotogramma vx (v.v), vy (v.vy) e lo sterzo; riceve vx, vy e l'imbardata v.r. Il tempo del fotogramma si accumula e
     si integra a passi interi di 5 ms.

   COSA NON FA (dichiarato): sospensioni a più gradi di libertà (beccheggio e rollio sono filtri sul trasferimento di carico), campanatura e
   convergenza statiche, modello termico dei freni, dinamica del turbo a mappa, stima della velocità del veicolo nella centralina (usa quella
   vera). Nessun valore è «validato» su veicolo reale: vedi docs/MOTORE_FISICO.md e docs/PNEUMATICI_DINAMICA.md. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./veicoli_db.js'), require('./pneumatici_mf.js'), require('./controllo_dinamica.js'));
  else root.IOW_FISICA = factory(root.IOW_VEICOLI || null, root.IOW_PNEUMATICI, root.IOW_CONTROLLO);
})(typeof self !== 'undefined' ? self : this, function (DB, IOW_MF, IOW_CTL) {
  'use strict';
  if (!IOW_MF || !IOW_CTL) throw new Error('fisica_veicolo.js: servono motore/pneumatici_mf.js e motore/controllo_dinamica.js (caricarli prima)');
  const DT = 0.005;                 // passo fisso della dinamica e della centralina: 200 Hz
  const VMIN = 1.0;                 // velocità minima al denominatore dello scorrimento [m/s]: sopra, una ruota ferma ha κ = −1 esatto
  const OTMP = {};
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
      ecu: { accMax: 1, limitatore: P.limitatore, asr: !!P.esc, abs: !!P.abs, esp: !!P.esc, tagliaCoppia: 0, cambioBloccato: false, marciaMaxTCU: n, spegni: false },
      /* dinamica a 7 gradi di libertà (v.v è vx; v.vy e v.r sono la velocità laterale verso sinistra e l'imbardata verso sinistra) */
      vy: 0, r: 0,
      dyn: {
        om: [0, 0, 0, 0], blocc: [false, false, false, false], ta: [0, 0, 0, 0], kap: [0, 0, 0, 0], alf: [0, 0, 0, 0], Fz: [0, 0, 0, 0], Fx: [0, 0, 0, 0], Fy: [0, 0, 0, 0], Mz: [0, 0, 0, 0],
        uxw: [0, 0, 0, 0], uyw: [0, 0, 0, 0], den: [1, 1, 1, 1], gk: [0, 0, 0, 0], cd: [1, 1, 1, 1], sd: [0, 0, 0, 0], del: [0, 0, 0, 0], delta: 0,
        Tb: [0, 0, 0, 0], Tbt: [0, 0, 0, 0], TbRich: [0, 0, 0, 0], Tdrv: [0, 0, 0, 0], FbTel: [0, 0, 0, 0], Pstr: [0, 0, 0, 0], sigCache: [0.4, 0.4, 0.3, 0.3], nSig: 99,
        L: [0, 1, 2, 3].map(() => IOW_MF.scalaNeutra()), o: [{}, {}, {}, {}], axF: 0, ayF: 0, ax: 0, ay: 0, taglioVDC: 0, vxFine: 0, accum: 0, passi: 0,
        pk: {}, idx: [0, 0, 0, 0, 0], Am: new Float64Array(25), bq: new Float64Array(5), dq: new Float64Array(5),
      },
      gomma: opt.pneumatico || IOW_MF.MF52_GENERICO,
      centralina: IOW_CTL.crea({ sogliaG: opt.sogliaG || 15 }),
      ctlIn: { kPiccoF: [-0.12, -0.12, -0.12, -0.12], FxPiccoF: [0, 0, 0, 0], kPiccoT: [0.12, 0.12, 0.12, 0.12], FxPiccoT: [0, 0, 0, 0], abilita: { abs: true, tcs: true, esp: true } },
      amb: { pendenza: 0, superficie: 'asfalto', acqua: 0, tempAria: 20, quota: 0, vento: 0 },
      eventi: [],
      stat: { tempoSlitta: 0, tempoABS: 0, tempoASR: 0, surriscaldamenti: 0, nCambiate: 0 },
    };
    v.motore.rpm = v.motore.acceso ? P.minimo : 0;
    return v;
  }

  /* geometria e masse per la dinamica (calcolate una volta dai parametri del veicolo) */
  function geometria(v) {
    if (v.geo) return v.geo;
    const P = v.par, L = P.passo || 2.7, q = P.quotaAnt || 0.6, cr = P.carreggiate || [1.55, 1.55], m = P.massa;
    const a = L * (1 - q), b = L * q, wf = cr[0], wr = cr[1], Re = P.raggioRuota;
    const tr = P.trazione === 'posteriore' ? [2, 3] : P.trazione === 'integrale' ? [0, 1, 2, 3] : [0, 1];
    const Fd = (P.decelMax || 9.5) * m * 1.25;                              // capacità dell'impianto: il 25 % oltre la decelerazione massima (con il pedale a fondo, senza ABS, si blocca)
    v.geo = {
      L, a, b, wf, wr, hcg: P.hCg || 0.55, Re, Iw: P.inerziaRuota || 1.2, Iz: P.Iz || m * (L * L + 1.83 * 1.83) / 12 * 0.95,
      x: [a, a, -b, -b], y: [wf / 2, -wf / 2, wr / 2, -wr / 2], motrici: tr, ack: P.ackermann !== undefined ? P.ackermann : 0.5, rollAnt: P.rollioAnt || 0.55,
      TbMax: [Fd * 0.68 / 2 * Re, Fd * 0.68 / 2 * Re, Fd * 0.32 / 2 * Re, Fd * 0.32 / 2 * Re], TbMano: P.frenoManoCoppia || 1600,
    };
    return v.geo;
  }
  /* eliminazione di Gauss con pivot parziale su una matrice n×n (n ≤ 5) memorizzata a righe di 5 */
  function risolvi(A, b, n, x) {
    for (let k = 0; k < n; k++) {
      let p = k, mx = Math.abs(A[k * 5 + k]);
      for (let i = k + 1; i < n; i++) { const v = Math.abs(A[i * 5 + k]); if (v > mx) { mx = v; p = i } }
      if (p !== k) { for (let j = 0; j < n; j++) { const t = A[k * 5 + j]; A[k * 5 + j] = A[p * 5 + j]; A[p * 5 + j] = t } const t = b[k]; b[k] = b[p]; b[p] = t }
      const d = A[k * 5 + k] || 1e-12;
      for (let i = k + 1; i < n; i++) { const f = A[i * 5 + k] / d; if (f === 0) continue; for (let j = k; j < n; j++) A[i * 5 + j] -= f * A[k * 5 + j]; b[i] -= f * b[k] }
    }
    for (let i = n - 1; i >= 0; i--) { let s = b[i]; for (let j = i + 1; j < n; j++) s -= A[i * 5 + j] * x[j]; x[i] = s / (A[i * 5 + i] || 1e-12) }
    return x;
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
    if (!Number.isFinite(v.vy)) v.vy = 0; if (!Number.isFinite(v.r)) v.r = 0;
    sincronizzaRuote(v);
    // passo fisso di 5 ms (200 Hz): il tempo del fotogramma si accumula e si integra a passi interi (il resto resta per il fotogramma dopo)
    const D = v.dyn; D.accum += dt; let k = 0;
    while (D.accum >= DT - 1e-9 && k < 600) { D.accum -= DT; sottopasso(v, DT, input); k++ }
    if (k === 600) D.accum = 0;                                 // oltre 3 s in una chiamata (scheda rimasta in background): si scarta il resto
    D.passi += k;
    return v;
  }

  /* se il veicolo è fermo con le ruote ferme e qualcuno gli imposta una velocità (test, teletrasporto) le ruote partono già in rotolamento */
  function sincronizzaRuote(v) {
    const D = v.dyn;
    const libere = !D.blocc[0] && !D.blocc[1] && !D.blocc[2] && !D.blocc[3], ferme = Math.abs(D.om[0]) + Math.abs(D.om[1]) + Math.abs(D.om[2]) + Math.abs(D.om[3]) < 0.4;
    if (libere && ferme && Math.abs(D.vxFine) < 0.05 && Math.abs(v.v) > 0.1) { const Re = geometria(v).Re; for (let i = 0; i < 4; i++) D.om[i] = v.v / Re }
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
    const gm = geometria(v), om = v.dyn.om; let wMot = 0; for (const i of gm.motrici) wMot += om[i]; wMot /= gm.motrici.length;
    c.rpmRuote = Math.abs(wMot) / PI2 * 60 * ratio;                          // giri che il motore avrebbe a frizione chiusa (dalla rotazione delle ruote motrici)
    const inCambiata = c.cambiataT > 0, innestata = c.marcia !== 0 && !inCambiata;
    const frizioneAperta = innestata && (freno > 0.3 || !!inp.frenoMano) && Math.min(acc, E.accMax) < 0.05 && Math.abs(vel) > 0.5;   // frenata decisa o freno a mano: frizione premuta / convertitore aperto
    const accECU = m.acceso ? Math.min(acc, E.accMax) * (1 - cl(E.tagliaCoppia, 0, 1)) : 0;
    // limitatore: taglio del gas sopra il regime massimo (quello del motore o quello imposto dall'ECU)
    const rpmLim = Math.min(P.limitatore, E.limitatore || P.limitatore);
    m.limitatore = m.acceso && m.rpm > rpmLim;
    let accEff = m.limitatore ? 0 : accECU;
    // regolatore del minimo: a frizione aperta o in partenza il motore si mantiene al minimo
    let rpmTarget;
    if (frizioneAperta) { c.slitta = false; rpmTarget = m.acceso ? Math.max(P.minimo, Math.min(c.rpmRuote, rpmLim)) : 0 }
    else if (innestata) {
      const rpmMin = P.minimo * (0.95 + 1.6 * accEff);                             // in partenza la frizione slitta e il motore sta sopra il minimo (a gas pieno ~2000 giri)
      c.slitta = c.rpmRuote < rpmMin && m.acceso;
      rpmTarget = m.acceso ? Math.max(c.rpmRuote, rpmMin) : c.rpmRuote;
      c.frizione = 1;                                                                 // la frizione trasmette tutta la coppia anche slittando (capacità > coppia motore)
    } else if (inCambiata && c.marcia !== 0) { c.slitta = false; rpmTarget = m.acceso ? Math.max(P.minimo, c.rpmRuote) : 0; accEff = 0 }   // durante la cambiata: taglio del gas e regime che si porta a quello della nuova marcia
    else { c.slitta = false; rpmTarget = m.acceso ? P.minimo + (rpmLim - P.minimo) * accEff * 0.9 : 0 }
    // dinamica del regime: in presa segue le ruote (rigido), a vuoto risponde con l'inerzia del volano
    if (innestata && !c.slitta && !frizioneAperta) m.rpm = rpmTarget;
    else { const tau = innestata ? 0.12 : 0.35 / Math.max(0.3, 1 + accEff); m.rpm += (rpmTarget - m.rpm) * Math.min(1, dt / tau) }
    if (!m.acceso) m.rpm = Math.max(0, m.rpm - 1500 * dt * (innestata ? 0 : 1));
    if (m.acceso && !innestata && m.rpm < P.minimo * 0.6) m.rpm = P.minimo * 0.6;
    // turbo: la pressione segue il gas con ritardo; a bassi giri il turbo non spinge
    if (P.turbo) { const target = accEff * P.boostMax * cl((m.rpm - 1000) / 900, 0.15, 1); m.boost += (target - m.boost) * Math.min(1, dt / (target > m.boost ? 0.55 : 0.25)) } else m.boost = 0;
    // coppia: a pieno carico dalla curva (scalata per i danni), con il turbo che aggiunge la sua parte; a carico parziale attrito motore
    const Twot = coppiaCurva(P.curvaCoppia, m.rpm) * M.potenza, Tfric = P.attrito[0] + P.attrito[1] * m.rpm;
    const kTurbo = P.turbo ? (0.6 + 0.4 * cl(m.boost / Math.max(0.01, P.boostMax * Math.max(0.15, accEff)), 0, 1)) : 1;
    let Teng = m.acceso ? accEff * Twot * kTurbo - (1 - accEff) * Tfric : -Tfric * (m.rpm > 10 ? 1 : 0);
    if ((m.acceso && !innestata) || frizioneAperta) Teng = 0;                                          // in folle la coppia va solo al volano (già nel rpmTarget)
    if (m.acceso && c.slitta && Teng < 0) Teng = 0;                                 // frizione che slitta al minimo: il freno motore non arriva alle ruote
    m.coppia = Teng; m.carico = Twot > 0 ? cl(Math.max(0, Teng) / Twot, 0, 1) : 0; m.acc = acc; m.accEff = accEff;
    m.potenzaKW = m.coppia * m.rpm * PI2 / 60 / 1000;

    /* --- forze alle ruote: dinamica a 7 gradi di libertà (vx, vy, r, ω×4) con la Magic Formula combinata, a 200 Hz ---
       Ruote nell'ordine 0 ant. sin., 1 ant. des., 2 post. sin., 3 post. des.; asse x avanti, y a sinistra, imbardata r positiva a sinistra. */
    const g = geometria(v), D = v.dyn, h = dt, TP = v.gomma;
    const rho = densitaAria(A.quota, A.tempAria), vRel = vel + (A.vento || 0);
    F.aero = 0.5 * rho * P.cx * P.area * vRel * vRel * Math.sign(vRel);
    // pneumatici: pressione, temperatura, usura, superficie, danni → coefficiente d'attrito di picco PER RUOTA (diventa il D della formula)
    const S = SUPERFICI[A.superficie] || SUPERFICI.asfalto;
    let aq = 0, muTot = 0;
    for (let k = 0; k < 4; k++) { const q = muRuota(P.muMax, R.pressione[k], P.pressioneNom, R.temperatura[k], R.usura[k], A.superficie, A.acqua || 0, vel); const mk = M.muMult * (M.muRuota && Number.isFinite(M.muRuota[k]) ? M.muRuota[k] : 1) * (inp.muGioco > 0 ? inp.muGioco : 1); R.mu[k] = Math.max(0.02, q.mu * mk); aq = Math.max(aq, q.aquaplaning); muTot += R.mu[k] }
    R.aquaplaning = aq; R.aderenza = cl(muTot / 4 / Math.max(0.05, P.muMax), 0, 1);
    const pMedia = (R.pressione[0] + R.pressione[1] + R.pressione[2] + R.pressione[3]) / 4;
    const crr = 0.011 * S.crr * Math.sqrt(P.pressioneNom / Math.max(0.3, pMedia));
    F.rotolamento = crr * massa * G * cosP * (sgn || (Math.abs(vel) > 0.001 ? Math.sign(vel) : 0));
    F.pendenza = massa * G * sinP;
    F.extra = (M.attritoExtra || 0) * (sgn || 0);
    const Fe = inp.forzaEsterna || null, FeX = Fe && Fe.Fx || 0, FeY = Fe && Fe.Fy || 0, FeM = Fe && Fe.Mz || 0;
    let vx = vel, vy = v.vy, rr = v.r;
    // sterzo con geometria di Ackermann parziale (la ruota interna sterza di più)
    const delta = cl(Number.isFinite(inp.sterzo) ? inp.sterzo : 0, -0.75, 0.75);
    let dSin = delta, dDes = delta;
    if (Math.abs(delta) > 1e-4 && g.ack > 0) {
      const ad = Math.abs(delta), Rg = g.L / Math.tan(ad), dIn = Math.atan(g.L / Math.max(0.3, Rg - g.wf / 2)), dOut = Math.atan(g.L / (Rg + g.wf / 2));
      const dI = ad + g.ack * (dIn - ad), dO = ad + g.ack * (dOut - ad);
      if (delta > 0) { dSin = dI; dDes = dO } else { dSin = -dO; dDes = -dI }
    }
    D.del[0] = dSin; D.del[1] = dDes; D.del[2] = 0; D.del[3] = 0; D.delta = delta;
    // carichi verticali: statico + trasferimento longitudinale e laterale (accelerazioni filtrate: beccheggio e rollio non istantanei)
    const W = massa * G * cosP, dX = massa * D.axF * g.hcg / g.L, dYf = massa * D.ayF * g.hcg / g.wf * g.rollAnt, dYr = massa * D.ayF * g.hcg / g.wr * (1 - g.rollAnt);
    const Fza = (W * g.b / g.L - dX) / 2, Fzp = (W * g.a / g.L + dX) / 2;
    const Fz = D.Fz; Fz[0] = Math.max(0, Fza - dYf); Fz[1] = Math.max(0, Fza + dYf); Fz[2] = Math.max(0, Fzp - dYr); Fz[3] = Math.max(0, Fzp + dYr);   // ay > 0 (verso sinistra) scarica le ruote di sinistra
    R.carichi = [Fz[0] + Fz[1], Fz[2] + Fz[3]];
    /* cinematica delle ruote, scorrimenti, forze della formula e loro derivate */
    const Re = g.Re, uxw = D.uxw, uyw = D.uyw, den = D.den, kap = D.kap, alf = D.alf, FX = D.Fx, FY = D.Fy, MZ = D.Mz, gk = D.gk, cdel = D.cd, sdel = D.sd;
    for (let i = 0; i < 4; i++) {
      const xi = g.x[i], yi = g.y[i], cd = Math.cos(D.del[i]), sd = Math.sin(D.del[i]); cdel[i] = cd; sdel[i] = sd;
      const ux = vx - rr * yi, uy = vy + rr * xi;
      uxw[i] = ux * cd + uy * sd; uyw[i] = -ux * sd + uy * cd;
      const Li = D.L[i], mui = R.mu[i];
      Li.LMUX = mui / TP.PDX1; Li.LMUY = mui / TP.PDY1; Li.LKX = Li.LKY = 0.55 + 0.45 * Math.min(1, mui / Math.max(0.3, P.muMax));
      // angolo di deriva con rilassamento (modello a deflessione del primo ordine): σ·d(tan α')/dt + |Vx|·tan α' = −Vy
      const sig = Fz[i] > 1 ? D.sigCache[i] : 0.3, kr = Math.abs(uxw[i]) / sig, q = kr * h, e = Math.exp(-q);
      // la deflessione della carcassa non supera quella di strisciamento: a bassa velocità tan α' resta entro il picco (~9°),
      // a velocità normale il limite è lo scorrimento cinematico (in derapata α' può arrivare a ~85°)
      const tlim = 0.16 + Math.min(12, Math.abs(uyw[i]) / Math.max(Math.abs(uxw[i]), 0.05)) * smooth(0.5, 3, Math.abs(uxw[i]));
      D.ta[i] = cl(D.ta[i] * e + (-uyw[i] / sig) * (q > 1e-7 ? (1 - e) / kr : h), -tlim, tlim);
      alf[i] = Math.atan(D.ta[i]);
      den[i] = Math.max(Math.abs(uxw[i]), Math.abs(D.om[i] * Re), VMIN);
      kap[i] = cl((D.om[i] * Re - uxw[i]) / den[i], -1, 1);               // ruota bloccata (ω = 0) a più di 1 m/s → κ = −1 esatto
      const o = IOW_MF.forze(TP, Fz[i], kap[i], alf[i], Li, D.o[i]);
      FX[i] = o.Fx; FY[i] = o.Fy; MZ[i] = o.Mz;
      // strisciamento pieno (|κ| → 1, ruota bloccata o che pattina): la gomma striscia come un corpo con attrito isotropo e la forza si
      // oppone alla velocità di strisciamento del contatto. Le funzioni peso della MF 5.2 a κ = −1 lasciano invece la forza lungo l'asse
      // della ruota (con le ruote sterzate e bloccate l'auto girerebbe dalla parte opposta): si passa con continuità alla direzione vera.
      const ws = smooth(0.25, 0.8, Math.abs(kap[i]));
      if (ws > 0) {
        const vsx = D.om[i] * Re - uxw[i], vsy = -uyw[i], vs = Math.hypot(vsx, vsy), Fm = Math.hypot(FX[i], FY[i]);
        if (vs > 0.2 && Fm > 0) { const fx = FX[i] * (1 - ws) + ws * Fm * vsx / vs, fy = FY[i] * (1 - ws) + ws * Fm * vsy / vs, f2 = Math.hypot(fx, fy) || 1; FX[i] = fx * Fm / f2; FY[i] = fy * Fm / f2 }
      }
      // smorzamento laterale a bassa velocità (la deflessione della carcassa non si smorza da sola quando l'auto è quasi ferma)
      const wl = 1 - smooth(1.5, 4, Math.abs(uxw[i]));
      if (wl > 0 && Fz[i] > 1) {
        const cdmp = 1.2 * Math.sqrt(TP.CY_CARCASSA * Fz[i] / G), fd = cl(-cdmp * uyw[i], -mui * Fz[i], mui * Fz[i]) * wl; FY[i] += fd;
        const lim = Math.max(o.mux, o.muy) * Fz[i], Ft = Math.hypot(FX[i], FY[i]); if (Ft > lim) { FX[i] *= lim / Ft; FY[i] *= lim / Ft }   // mai oltre l'aderenza
      }
      // derivata dFx/dκ (per l'integrazione implicita delle ruote): differenza finita sulla formula combinata, mai negativa
      if (D.blocc[i] || Fz[i] <= 1) gk[i] = 0;
      else { const o2 = IOW_MF.forze(TP, Fz[i], cl(kap[i] + 1e-3, -1, 1), alf[i], Li, OTMP); gk[i] = Math.max(0, (o2.Fx - FX[i]) / 1e-3) / den[i] }
    }
    if (++D.nSig >= 8) { D.nSig = 0; for (let i = 0; i < 4; i++) D.sigCache[i] = IOW_MF.rilassamentoLaterale(TP, Math.max(200, Fz[i]), D.L[i]) }   // σα cambia lentamente con il carico: 25 Hz bastano
    /* coppia motrice alle ruote (differenziale aperto: coppia uguale sulle ruote motrici) */
    const mot = g.motrici, nm = mot.length;
    let Tw = 0;
    const trasmette = innestata && !frizioneAperta;
    if (trasmette) {
      const capF = M.frizione === undefined ? 1 : M.frizione, capD = M.differenziale === undefined ? 1 : M.differenziale;   // danni: frizione che slitta (limita la coppia), differenziale rotto (niente trazione)
      Tw = Teng * rap * P.rendimento * M.trasmissione * c.frizione * capD * (Teng > 0 ? capF : 1);      // segno: retromarcia → negativo
    }
    const accoppiato = trasmette && !c.slitta && m.acceso;                  // frizione chiusa: l'inerzia di motore e volano è trascinata dalle ruote motrici
    /* freni: richiesta del pedale per ruota (capacità dell'impianto oltre l'aderenza: senza ABS la ruota si blocca) */
    const TbRich = D.TbRich;
    for (let i = 0; i < 4; i++) TbRich[i] = freno * g.TbMax[i] * (M.freni[i] === undefined ? 1 : M.freni[i]);
    /* scorrimenti di picco per i regolatori (Magic Formula combinata con carico, deriva e aderenza correnti) */
    const cen = v.centralina, ctl = v.ctlIn;
    // a 200 Hz per ogni ruota che un regolatore sta usando (o che si avvicina al picco); per le altre ogni 8 passi (25 Hz, per il quadro)
    const op = cen.stato === 'OPERATIVA', fren = op && (freno > 0.01 || (cen.esp && cen.esp.attivo)), trz = op && Math.abs(Tw) > 30, lento = D.nSig === 0, PK = D.pk;
    for (let i = 0; i < 4; i++) {
      const kr = kap[i] * (uxw[i] >= 0 ? 1 : -1);
      if (Fz[i] > 1 && fren && (cen.abs.attivo[i] || kr < 0.6 * ctl.kPiccoF[i] || lento)) { IOW_MF.piccoKappa(TP, Fz[i], alf[i], D.L[i], -1, ctl.kPiccoF[i], PK); ctl.kPiccoF[i] = PK.kappa; ctl.FxPiccoF[i] = PK.Fx }
      else if (!fren || Fz[i] <= 1) { ctl.kPiccoF[i] = ctl.kPiccoF[i] || -0.12; ctl.FxPiccoF[i] = -R.mu[i] * Fz[i] }
      if (Fz[i] > 1 && trz && mot.indexOf(i) >= 0 && (cen.tcs.attivo || kr > 0.6 * ctl.kPiccoT[i] || lento)) { IOW_MF.piccoKappa(TP, Fz[i], alf[i], D.L[i], 1, ctl.kPiccoT[i], PK); ctl.kPiccoT[i] = PK.kappa; ctl.FxPiccoT[i] = PK.Fx }
      else if (!trz || Fz[i] <= 1) { ctl.kPiccoT[i] = ctl.kPiccoT[i] || 0.12; ctl.FxPiccoT[i] = R.mu[i] * Fz[i] }
    }
    ctl.vx = vx; ctl.vy = vy; ctl.r = rr; ctl.delta = delta; ctl.mu = muTot / 4; ctl.L = g.L; ctl.w = g.wf; ctl.Re = Re; ctl.n = mot;
    ctl.kappa = kap; ctl.uxw = uxw; ctl.Fz = Fz; ctl.muR = R.mu; ctl.TbRich = TbRich; ctl.TmotRich = Tw;
    ctl.abilita.abs = !!E.abs; ctl.abilita.tcs = !!E.asr; ctl.abilita.esp = E.esp !== undefined ? !!E.esp : !!(E.asr && P.esc);
    const uc = IOW_CTL.passo(cen, h, ctl);
    // coppia motrice dopo TCS (limite di coppia) ed ESP (riduzione durante l'intervento)
    let TwApp = Tw;
    if (cen.stato === 'OPERATIVA' && cen.tcs.attivo && Number.isFinite(cen.tcs.Tlim) && Tw * (vx >= 0 ? 1 : -1) > 0) TwApp = Math.sign(Tw) * Math.min(Math.abs(Tw), cen.tcs.Tlim);
    if (cen.stato === 'OPERATIVA' && cen.esp.attivo && Tw > 0) TwApp *= 1 - cen.esp.taglio;
    D.taglioVDC = Tw !== 0 ? 1 - TwApp / Tw : 0;
    // impianto idraulico: la pressione segue il comando con un ritardo di 12 ms (modulatore ABS o pompa freno senza centralina)
    const kh = 1 - Math.exp(-h / 0.012), Tbt = D.Tbt;
    for (let i = 0; i < 4; i++) { D.Tb[i] += (uc.Tb[i] - D.Tb[i]) * kh; Tbt[i] = D.Tb[i] + (inp.frenoMano && i >= 2 ? g.TbMano * (M.freni[i] === undefined ? 1 : M.freni[i]) : 0) }   // freno a mano: meccanico, sul retrotreno, fuori dall'ABS
    /* ruote bloccate: si sbloccano se il freno non trattiene più la coppia che la strada e il motore applicano alla ruota */
    const Tdrv = D.Tdrv;
    for (let i = 0; i < 4; i++) Tdrv[i] = mot.indexOf(i) >= 0 ? TwApp / nm : 0;
    for (let i = 0; i < 4; i++) if (D.blocc[i]) { const net = Tdrv[i] - Re * FX[i]; if (Tbt[i] < Math.abs(net) * 0.98) D.blocc[i] = false }
    /* integrazione implicita linearizzata (Eulero all'indietro) di vx e delle ω libere: (M − h·J)·Δq = h·Q.
       J contiene dFx/dκ di ogni ruota: senza, a bassa velocità le equazioni delle ruote sono troppo rigide per il passo di 5 ms. */
    const Ier = accoppiato ? P.inerzia * ratio * ratio * P.rendimento : 0, idx = D.idx; let n = 1;
    for (let i = 0; i < 4; i++) if (!D.blocc[i]) idx[n++] = i;
    const Am = D.Am, bq = D.bq;
    for (let p0 = 0; p0 < n; p0++) { bq[p0] = 0; for (let q0 = 0; q0 < n; q0++) Am[p0 * 5 + q0] = 0 }
    let Qx = massa * rr * vy - F.aero - F.rotolamento - F.pendenza - F.extra + FeX;
    let Jxx = 0;
    for (let i = 0; i < 4; i++) { Qx += FX[i] * cdel[i] - FY[i] * sdel[i]; Jxx -= gk[i] * cdel[i] * cdel[i] }
    Am[0] = massa - h * Jxx; bq[0] = h * Qx;
    for (let p0 = 1; p0 < n; p0++) {
      const i = idx[p0], sw = D.om[i] > 1e-6 ? 1 : D.om[i] < -1e-6 ? -1 : -Math.sign(Tdrv[i] - Re * FX[i]);
      const Qw = Tdrv[i] - Re * FX[i] - Tbt[i] * sw;
      Am[p0 * 5 + p0] = g.Iw + h * Re * Re * gk[i];
      Am[p0 * 5] = -h * Re * gk[i] * cdel[i]; Am[p0] = -h * gk[i] * Re * cdel[i];
      bq[p0] = h * Qw;
      if (Ier > 0 && mot.indexOf(i) >= 0) for (let q0 = 1; q0 < n; q0++) if (mot.indexOf(idx[q0]) >= 0) Am[p0 * 5 + q0] += Ier / (nm * nm);
    }
    risolvi(Am, bq, n, D.dq);
    const vxN = vx + D.dq[0];
    for (let p0 = 1; p0 < n; p0++) {
      const i = idx[p0], w0 = D.om[i], w1 = w0 + D.dq[p0];
      // bloccaggio geometrico: il freno porta la ruota a zero e la trattiene (attrito statico del disco)
      if (Tbt[i] > 0 && !(accoppiato && mot.indexOf(i) >= 0) && (w0 * w1 < 0 || (Math.abs(w1) < 0.05 && Math.abs(w1) <= Math.abs(w0))) && Tbt[i] >= Math.abs(Tdrv[i] - Re * FX[i])) { D.om[i] = 0; D.blocc[i] = true }
      else D.om[i] = w1;
    }
    /* moto laterale e imbardata (Eulero semi-implicito: le forze laterali hanno già il ritardo del rilassamento) */
    let Fyb = FeY, Mzb = FeM;
    for (let i = 0; i < 4; i++) { const fxb = FX[i] * cdel[i] - FY[i] * sdel[i], fyb = FX[i] * sdel[i] + FY[i] * cdel[i]; Fyb += fyb; Mzb += g.x[i] * fyb - g.y[i] * fxb + MZ[i] }
    const vyN = vy + h * (-rr * vx + Fyb / massa), rN = rr + h * Mzb / g.Iz;
    const axB = (vxN - vx) / h - rr * vy, ayB = Fyb / massa;
    const kf = 1 - Math.exp(-h / 0.07); D.axF += (cl(axB, -25, 25) - D.axF) * kf; D.ayF += (cl(ayB, -25, 25) - D.ayF) * kf; D.ax = axB; D.ay = ayB;
    // forze per la telemetria e per i moduli che le leggono
    let Ftr = 0, Fpn = 0;
    for (let i = 0; i < 4; i++) { Fpn += FX[i] * cdel[i] - FY[i] * sdel[i]; if (mot.indexOf(i) >= 0) Ftr += FX[i] }
    F.trazione = Ftr; F.pneumatici = Fpn; F.freno = (Tbt[0] + Tbt[1] + Tbt[2] + Tbt[3]) / Re * (sgn || 0); F.laterale = Fyb; F.imbardata = Mzb;
    F.massaEq = massa;
    /* --- fermo: con il veicolo fermo le resistenze non lo mettono in moto all'indietro --- */
    let a = axB, vNew = vxN, vyNew = vyN, rNew = rN;
    const Fmot = Math.abs(TwApp) / Re;
    const tieneFermo = freno + (inp.frenoMano ? 1 : 0) > 0.05 || accEff < 0.05 || !m.acceso;                                  // freno, freno a mano o «hill holder» automatico (senza gas il veicolo resta fermo in pendenza)
    const quasiFermo = sgn === 0 && Math.abs(vy) < 0.3 && Math.abs(rr) < 0.2;
    let ferma = false;
    if (quasiFermo && Fmot < Math.abs(F.pendenza) + 0.02 * massa * G && tieneFermo) ferma = true;
    else if (quasiFermo && Fmot <= Math.abs(F.pendenza) + crr * massa * G * 0.5 && Math.abs(F.pendenza) < crr * massa * G) ferma = true; // in piano senza gas: fermo
    else if (sgn !== 0 && Math.sign(vNew) !== sgn && (freno > 0.05 || inp.frenoMano || Fmot < Math.abs(F.rotolamento) + Math.abs(F.extra) + Math.abs(F.pendenza))) { vNew = 0; a = -vel / dt; for (let i = 0; i < 4; i++) D.om[i] = 0 } // frenata o resistenze: arresto netto, niente oscillazione attorno allo zero
    if (ferma) { vNew = 0; a = 0; vyNew = 0; rNew = 0; for (let i = 0; i < 4; i++) { D.om[i] = 0; D.ta[i] = 0 } }
    F.netta = massa * a;
    v.a = a; v.v = vNew; v.vy = vyNew; v.r = rNew; v.odometro += Math.hypot(vNew, vyNew) * dt;
    if (!m.acceso && Math.abs(vNew) < 0.05 && Math.abs(vyNew) < 0.05) { v.v = 0; v.vy = 0 }
    D.vxFine = v.v;
    /* stato delle ruote per gioco, ECU e quadro */
    let slipMot = 0, slitta = false;
    for (const i of mot) { const k = kap[i] * (vx >= 0 ? 1 : -1); if (k > slipMot) slipMot = k; if (k > 0.25 && !cen.tcs.attivo) slitta = true }
    R.slip = slipMot; R.slitta = slitta && Math.abs(vx) > 0.5 || (slitta && Math.abs(D.om[mot[0]]) * Re > 3);
    R.bloccate = Math.abs(vx) > 1 && (D.blocc[0] || D.blocc[1] || kap[0] < -0.6 || kap[1] < -0.6);
    R.bloccatePost = Math.abs(vx) > 1 && (D.blocc[2] || D.blocc[3] || kap[2] < -0.6 || kap[3] < -0.6);
    v.freni.abs = cen.stato === 'OPERATIVA' && cen.abs.attivo.some(Boolean); v.freni.forza = F.freno;
    if (R.slitta) v.stat.tempoSlitta += dt;
    if (v.freni.abs) v.stat.tempoABS += dt;
    if (cen.stato === 'OPERATIVA' && cen.tcs.attivo) v.stat.tempoASR += dt;
    const Fb = D.FbTel; for (let i = 0; i < 4; i++) Fb[i] = Tbt[i] / Re;

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
    /* --- pneumatici: temperatura e usura dalla potenza dissipata nello strisciamento del contatto (Fx·Vsx + Fy·Vsy) ---
       60 % del calore nel battistrada (capacità termica efficace 12 kJ/K), rotolamento 0,012 K/s per m/s, raffreddamento con la velocità.
       Usura: 5,4·10⁻⁸ per joule di strisciamento + usura normale di rotolamento (ordini di grandezza, non misure). */
    for (let k = 0; k < 4; k++) {
      const vsx = D.om[k] * Re - uxw[k], Pss = Math.abs(FX[k] * vsx) + Math.abs(FY[k] * uyw[k]);
      D.Pstr[k] = Pss;
      const riscald = 0.012 * Math.abs(vel) + 0.6 * Pss / 12000 + Fb[k] / 20000 * Math.abs(vel) * 0.05;
      R.temperatura[k] += (riscald - (R.temperatura[k] - Tamb) * (0.010 + 0.0006 * Math.abs(vel))) * dt;
      R.usura[k] = Math.min(1, R.usura[k] + 5.4e-8 * Pss * dt + 3e-9 * Math.abs(vel) * dt);           // usura normale: ~0,1 ogni 10.000 km (ordine di grandezza)
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
      velocitaLateraleMs: +(v.vy || 0).toFixed(2), imbardataRadS: +(v.r || 0).toFixed(3), derivaGradi: +(Math.atan2(v.vy || 0, Math.max(Math.abs(v.v), 0.5)) * 180 / Math.PI).toFixed(1),
      accLongG: +(v.dyn.ax / G).toFixed(2), accLatG: +(v.dyn.ay / G).toFixed(2), sterzoGradi: +(v.dyn.delta * 180 / Math.PI).toFixed(1),
      lambda: v.dyn.kap.map(k => +k.toFixed(3)), alfaGradi: v.dyn.alf.map(a => +(a * 180 / Math.PI).toFixed(1)), Fz: v.dyn.Fz.map(Math.round), Fx: v.dyn.Fx.map(Math.round), Fy: v.dyn.Fy.map(Math.round),
      ruoteBloccate: v.dyn.blocc.slice(), centralina: v.centralina.stato, absRuote: v.centralina.abs.attivo.slice(), tcs: v.centralina.tcs.attivo, esp: v.centralina.esp.attivo, espMz: Math.round(v.centralina.esp.Mz),
      urtoMaxG: +v.centralina.urtoMaxG.toFixed(1), passi200Hz: v.dyn.passi,
    };
  }
  /* urto letto dalla carrozzeria: accelerazione di picco in g → centralina (blackout oltre la soglia, 15 g). Restituisce true se è andata in blackout */
  function urto(v, gPicco, info) { const bo = IOW_CTL.urto(v.centralina, gPicco, info); if (bo) evento(v, 'centralina_ko', { g: +gPicco.toFixed(1) }); return bo }
  function riavviaCentralina(v) { IOW_CTL.riavvia(v.centralina); evento(v, 'centralina_riavviata') }
  /* impone la velocità del veicolo (nel riferimento dell'auto) con le ruote in rotolamento puro: per test e teletrasporti */
  function impostaVelocita(v, vx, vy, r) { const D = v.dyn, Re = geometria(v).Re; v.v = vx; v.vy = vy || 0; v.r = r || 0; for (let i = 0; i < 4; i++) { D.om[i] = vx / Re; D.blocc[i] = false; D.ta[i] = 0 } D.vxFine = vx; return v }
  /* stato delle ruote (per il quadro, i test e la telemetria a 200 Hz) */
  function ruote(v) {
    const D = v.dyn, Re = geometria(v).Re, c = v.centralina;
    return [0, 1, 2, 3].map(i => ({ omega: D.om[i], vRuota: D.om[i] * Re, lambda: D.kap[i], alfa: D.alf[i], Fz: D.Fz[i], Fx: D.Fx[i], Fy: D.Fy[i], Mz: D.Mz[i], mu: v.ruote.mu[i], bloccata: D.blocc[i], Tfreno: D.Tbt[i], Tmotrice: D.Tdrv[i], kPiccoFreno: v.ctlIn.kPiccoF[i], abs: c.abs.attivo[i], potenzaStrisciamento: D.Pstr[i] }));
  }

  /* cambia i parametri del veicolo (altra auto comprata, assetto modificato) senza ricreare lo stato: geometria e cambio si ricalcolano */
  function cambiaParametri(v, P) {
    const nuovi = JSON.parse(JSON.stringify(P)); for (const k in nuovi) v.par[k] = nuovi[k];
    v.geo = null; const n = v.par.rapporti.length; v.cambio.nMarce = n; if (v.cambio.marcia > n) v.cambio.marcia = n;
    v.carburante.serbatoio = v.par.serbatoio; v.carburante.litri = Math.min(v.carburante.litri, v.par.serbatoio); v.ecu.limitatore = v.par.limitatore; v.ecu.marciaMaxTCU = n; v.ecu.abs = !!v.par.abs; v.ecu.asr = v.ecu.esp = !!v.par.esc;
    evento(v, 'parametri_cambiati', { id: v.par.id }); return v;
  }

  /* stato minimo da salvare (il resto si ricostruisce) */
  function serializza(v) { return { v: 3, centralina: v.centralina.stato, carburante: +v.carburante.litri.toFixed(3), consumoTot: +v.carburante.consumoTot.toFixed(4), odometro: +v.odometro.toFixed(1), Tacqua: +v.motore.Tacqua.toFixed(1), Tolio: +v.motore.Tolio.toFixed(1), usura: v.ruote.usura.map(u => +u.toFixed(5)), pressione: v.ruote.pressione.map(p => +p.toFixed(3)), modo: v.cambio.modo, acceso: v.motore.acceso, stat: v.stat } }
  function ripristina(v, s) { if (!s || typeof s !== 'object') return false; const n = (x, fb) => Number.isFinite(x) ? x : fb; v.carburante.litri = cl(n(s.carburante, v.carburante.litri), 0, v.carburante.serbatoio); v.carburante.consumoTot = n(s.consumoTot, 0); v.odometro = n(s.odometro, 0); v.motore.Tacqua = n(s.Tacqua, 20); v.motore.Tolio = n(s.Tolio, 20); if (Array.isArray(s.usura) && s.usura.length === 4) v.ruote.usura = s.usura.map(u => cl(n(u, 0), 0, 1)); if (Array.isArray(s.pressione) && s.pressione.length === 4) v.ruote.pressione = s.pressione.map(p => cl(n(p, v.par.pressioneNom), 0, 5)); if (s.modo === 'man' || s.modo === 'auto') v.cambio.modo = s.modo; if (typeof s.acceso === 'boolean') { v.motore.acceso = s.acceso; if (!s.acceso) v.motore.rpm = 0 } if (s.stat && typeof s.stat === 'object') Object.assign(v.stat, s.stat); if (s.centralina === 'BLACKOUT') v.centralina.stato = 'BLACKOUT'; return true }

  return { versione: '2.0.0', DT, SUPERFICI, coppiaCurva, muRuota, densitaAria, crea, passo, cambia, rapportoTot, rpmDaVelocita, rifornisci, telemetria, serializza, ripristina, urto, riavviaCentralina, impostaVelocita, cambiaParametri, ruote, geometria, piccoG: IOW_CTL.piccoG, MF: IOW_MF, CTL: IOW_CTL, DB, G };
});
