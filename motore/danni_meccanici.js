/* ITALIA OPEN WORLD — Danni meccanici per componente
   ==================================================
   Il gioco ha già una carrozzeria deformabile a nodi e travi (rete «soft body» in index.html) con ammaccature
   permanenti, rottura dei collegamenti, vetri, fari, ruote staccate, gomme a terra, ribaltamento e incendio.
   Questo modulo aggiunge lo strato MECCANICO: da quella deformazione (misurata, non casuale) ricava lo stato di
   ogni componente e lo collega al motore fisico (motore/fisica_veicolo.js) e alle ECU virtuali (motore/ecu.js).

   Componenti: radiatore, motore, cambio, frizione, differenziale, sterzo, sospensioni ×4, freni ×4, batteria, scarico,
   serbatoio, impianto elettrico, centraline, sensori ruota ×4, fari ×2, fanali ×2, pneumatici ×4 (stato dal gioco), struttura (zone ×6).
   Ogni componente ha integrità 0..1, soglie configurabili (SOGLIE), stato testuale, collegamenti (quale dato
   strutturale lo governa) e costo di riparazione.

   Effetti (tutti dipendenti da tipo ed entità del danno, nessuna conseguenza arbitraria):
     radiatore → scambio termico ridotto e perdita progressiva di refrigerante → temperatura sale → protezione EMS → danno termico al motore
     motore    → potenza ridotta fino all'arresto (deriva dalla rete deformabile + danno termico accumulato)
     cambio    → cambiate più lente; la TCU limita le marce o blocca il cambio
     frizione  → coppia trasmissibile ridotta (slitta sotto carico); differenziale → trazione ridotta fino a nulla
     centraline → con la scatola delle ECU nel vano motore schiacciata le centraline non essenziali vanno fuori linea
     sterzo    → corsa dello sterzo ridotta e tiraggio laterale (il gioco usa già la convergenza dei mozzi)
     sospensioni → attrito di avanzamento, assetto storto (il gioco inclina già l'auto con i mozzi piegati)
     freni     → forza frenante ridotta per ruota (ripartizione reale nel motore fisico)
     batteria / elettrico → tensione bassa, avviamento difficile, bus CAN con errori o spento, alternatore
     scarico   → nessun effetto sulla potenza oltre il 20% (rumore non modellato); scarico staccato segnalato
     serbatoio → perdita di carburante proporzionale alla deformazione posteriore/laterale
   Ciò che NON è modellato: temperatura dei freni, usura meccanica nel tempo, elettronica di dettaglio.
   L'energia d'urto è una STIMA del modello (½·m·v_n², oppure l'energia propria calcolata dal Vehicle Damage Solver,
   motore/danni_solver.js, quando viene passata), non una misura di crash test.
   Interfaccia con la rete deformabile: l'oggetto S di aggiorna() (documentato sotto) lo costruisce il solver
   (IOW_SOLVER.statoStruttura) dalle grandezze di sbDerive; questo modulo non legge mai la rete direttamente. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.IOW_DANNI = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const cl = (v, a, b) => v < a ? a : v > b ? b : v;
  const smooth = (e0, e1, x) => { const t = cl((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t) };

  /* soglie (metri di deformazione o radianti) e costi di riparazione in centesimi di euro (prezzi indicativi di officina, non listini reali) */
  const SOGLIE = {
    radiatore: { inizio: 0.05, fine: 0.38 }, cambio: { inizio: 0.30, fine: 0.85 }, batteria: { inizio: 0.18, fine: 0.60 }, elettrico: { inizio: 0.22, fine: 0.75 },
    scarico: { inizio: 0.10, fine: 0.50 }, serbatoio: { inizio: 0.40, fine: 0.80 }, sospCamber: 0.4, sterzoToe: 0.45, sensoreRuotaToe: 0.18, sensoreRuotaCamber: 0.25,
    termico: { inizio: 118, fine: 135 }, frizione: { inizio: 0.34, fine: 0.9 }, differenziale: { inizio: 0.36, fine: 0.9 }, centraline: { inizio: 0.26, fine: 0.7 },
  };
  const COSTI = { struttura: 90000, radiatore: 35000, motore: 420000, cambio: 260000, frizione: 75000, differenziale: 120000, centraline: 90000, sterzo: 65000, sospensione: 42000, freno: 26000, batteria: 15000, scarico: 32000, serbatoio: 55000, elettrico: 48000, sensoreRuota: 9000, faro: 18000, fanale: 12000, pneumatico: 12000, refrigerante: 4000 };
  const NOMI = { radiatore: 'Radiatore', motore: 'Motore', cambio: 'Cambio e trasmissione', frizione: 'Frizione', differenziale: 'Differenziale', centraline: 'Centraline elettroniche', sterzo: 'Sterzo', sospensioni: 'Sospensioni', freni: 'Freni', batteria: 'Batteria', scarico: 'Scarico', serbatoio: 'Serbatoio', elettrico: 'Impianto elettrico', sensoriRuota: 'Sensori ruota (ABS)', fari: 'Fari', fanali: 'Fanali', pneumatici: 'Pneumatici', struttura: 'Struttura e carrozzeria' };
  const RUOTE = ['ant. sin.', 'ant. des.', 'post. sin.', 'post. des.'];

  function crea() {
    return {
      v: 1, comp: { radiatore: 1, motore: 1, cambio: 1, frizione: 1, differenziale: 1, centraline: 1, sterzo: 1, sospensioni: [1, 1, 1, 1], freni: [1, 1, 1, 1], batteria: 1, scarico: 1, serbatoio: 1, elettrico: 1, sensoriRuota: [1, 1, 1, 1], fari: [1, 1], fanali: [1, 1], pneumatici: [1, 1, 1, 1], struttura: [1, 1, 1, 1, 1, 1] },
      refrigerante: 1, termico: 1, perditaCarburante: 0, storico: [], energiaTot: 0, deformazioneMax: 0, nUrti: 0, riparazioni: [], ultimo: null,
    };
  }

  /* registra un urto (dal gioco o dal solver): lx,lz punto in coordinate auto; imp velocità normale d'urto [m/s]; kind 'wall'|'car'|'pole'|'tree'|'rail'|'ground';
     energia [J] opzionale = energia propria già ripartita dal solver (altrimenti ½·m·imp²); duplicato = evento già contato (non si somma) */
  function urto(st, u) {
    const m = u.massa || 1600, E = Number.isFinite(u.energia) ? Math.max(0, u.energia) : 0.5 * m * u.imp * u.imp;   // J: energia (stima)
    const faccia = Math.abs(u.lz) >= Math.abs(u.lx) ? (u.lz > 0 ? 'anteriore' : 'posteriore') : (u.lx > 0 ? 'lato sinistro' : 'lato destro');
    const e = { t: u.t !== undefined ? +u.t.toFixed(1) : null, faccia, kmh: +(u.imp * 3.6).toFixed(0), energiaKJ: +(E / 1000).toFixed(1), contro: u.kind || 'ostacolo', lx: +u.lx.toFixed(2), lz: +u.lz.toFixed(2) };
    if (u.duplicato) { st.energiaTot += E; if (st.ultimo) st.ultimo.energiaKJ = +((st.ultimo.energiaKJ * 1000 + E) / 1000).toFixed(1); return st.ultimo }
    st.storico.push(e); if (st.storico.length > 40) st.storico.splice(0, 10); st.energiaTot += E; st.nUrti++; st.ultimo = e;
    return e;
  }

  /* aggiorna i componenti dalla struttura deformata. S = { zones[6], fC, rC, sL, sR, fS, hubs[4]{camber,toe,lost}, engine, wl[4], lampF[2], lampR[2], tyreF[4], tyreShred[4] }
     veh = stato del motore fisico (per temperatura e modificatori); dt per i processi nel tempo (perdite, danno termico). */
  function aggiorna(st, dt, S, veh) {
    const C = st.comp, min = (a, b) => Math.min(a, b);
    if (S) {
      const fC = S.fC || 0, rC = S.rC || 0, sL = S.sL || 0, sR = S.sR || 0, z = S.zones || [0, 0, 0, 0, 0, 0];
      st.deformazioneMax = Math.max(st.deformazioneMax, fC, rC, sL, sR);
      for (let i = 0; i < 6; i++) C.struttura[i] = min(C.struttura[i], 1 - cl(z[i] || 0, 0, 1));
      C.radiatore = min(C.radiatore, 1 - smooth(SOGLIE.radiatore.inizio, SOGLIE.radiatore.fine, fC) - 0.4 * smooth(0.06, 0.2, S.fS || 0));
      C.motore = min(C.motore, cl(S.engine === undefined ? 1 : S.engine, 0, 1));
      C.cambio = min(C.cambio, 1 - 0.9 * smooth(SOGLIE.cambio.inizio, SOGLIE.cambio.fine, fC) - 0.5 * smooth(0.25, 0.6, z[0] || 0));   // cambio trasversale a sinistra del motore
      // frizione (campana fra motore e cambio) e differenziale (nel cambio a trazione anteriore; nel ponte posteriore a trazione posteriore)
      const vano = S.zone && S.zone.vano_motore ? 1 - S.zone.vano_motore.integrita : 0, post = veh && veh.par && veh.par.trazione === 'posteriore';
      C.frizione = min(C.frizione, 1 - 0.85 * smooth(SOGLIE.frizione.inizio, SOGLIE.frizione.fine, fC) - 0.4 * smooth(0.3, 0.7, z[0] || 0) - 0.3 * smooth(0.5, 0.9, vano));
      C.differenziale = min(C.differenziale, post ? 1 - 0.9 * smooth(SOGLIE.differenziale.inizio, SOGLIE.differenziale.fine, rC) - 0.4 * smooth(0.4, 0.8, Math.max(z[4] || 0, z[5] || 0))
        : 1 - 0.8 * smooth(SOGLIE.differenziale.inizio, SOGLIE.differenziale.fine, fC) - 0.4 * smooth(0.35, 0.75, Math.max(z[0] || 0, z[1] || 0)));
      C.centraline = min(C.centraline, 1 - 0.8 * smooth(SOGLIE.centraline.inizio, SOGLIE.centraline.fine, fC) - 0.5 * smooth(0.4, 0.8, Math.max(z[0] || 0, z[1] || 0)) - 0.5 * smooth(0.6, 1, vano));
      C.batteria = min(C.batteria, 1 - 0.7 * smooth(SOGLIE.batteria.inizio, SOGLIE.batteria.fine, fC) - 0.5 * smooth(0.2, 0.6, z[0] || 0));
      C.elettrico = min(C.elettrico, 1 - 0.8 * smooth(SOGLIE.elettrico.inizio, SOGLIE.elettrico.fine, fC) - 0.3 * smooth(0.3, 0.7, Math.max(z[0] || 0, z[1] || 0)));
      C.scarico = min(C.scarico, 1 - 0.8 * smooth(SOGLIE.scarico.inizio, SOGLIE.scarico.fine, rC) - 0.3 * smooth(0.2, 0.5, Math.max(sL, sR)));
      C.serbatoio = min(C.serbatoio, 1 - smooth(SOGLIE.serbatoio.inizio, SOGLIE.serbatoio.fine, rC) - 0.6 * smooth(0.3, 0.6, Math.max(sL, sR)));
      const H = S.hubs || [];
      let toeF = 0;
      for (let k = 0; k < 4; k++) {
        const h = H[k] || { camber: 0, toe: 0, lost: false }, lost = !!(h.lost || (S.wl && S.wl[k]));
        C.sospensioni[k] = min(C.sospensioni[k], lost ? 0 : 1 - cl(Math.abs(h.camber) / SOGLIE.sospCamber, 0, 1) * 0.85 - cl(Math.abs(h.toe) / 0.35, 0, 1) * 0.3);
        C.freni[k] = min(C.freni[k], lost ? 0 : 1 - 0.5 * smooth(0.12, 0.35, Math.hypot(h.dx || 0, h.dy || 0, h.dz || 0)));
        C.sensoriRuota[k] = min(C.sensoriRuota[k], lost || Math.abs(h.toe) > SOGLIE.sensoreRuotaToe || Math.abs(h.camber) > SOGLIE.sensoreRuotaCamber ? 0 : 1);
        if (k < 2) toeF += Math.abs(h.toe);
        if (S.tyreShred && S.tyreShred[k]) C.pneumatici[k] = 0; else if (S.tyreF) C.pneumatici[k] = min(C.pneumatici[k], 1 - cl(S.tyreF[k], 0, 1));
      }
      C.sterzo = min(C.sterzo, 1 - cl(toeF / SOGLIE.sterzoToe, 0, 1) * 0.9 - (H[0] && H[0].lost || H[1] && H[1].lost ? 0.5 : 0));
      if (S.lampF) { C.fari[0] = S.lampF[0] ? 0 : C.fari[0]; C.fari[1] = S.lampF[1] ? 0 : C.fari[1] }
      if (S.lampR) { C.fanali[0] = S.lampR[0] ? 0 : C.fanali[0]; C.fanali[1] = S.lampR[1] ? 0 : C.fanali[1] }
      for (const k in C) { if (Array.isArray(C[k])) { for (let i = 0; i < C[k].length; i++) C[k][i] = cl(C[k][i], 0, 1) } else C[k] = cl(C[k], 0, 1) }   // integrità sempre in 0..1 (le somme dei contributi possono scendere sotto zero)
    }
    /* processi nel tempo */
    if (veh && dt > 0) {
      const m = veh.motore;
      if (C.radiatore < 0.7) st.refrigerante = Math.max(0, st.refrigerante - (0.7 - C.radiatore) * 0.012 * dt * (m.acceso ? 1 : 0.2));   // perdita: circa 1 minuto per svuotarsi con radiatore distrutto
      if (m.Tacqua > SOGLIE.termico.inizio && m.acceso) st.termico = Math.max(0, st.termico - smooth(SOGLIE.termico.inizio, SOGLIE.termico.fine, m.Tacqua) * 0.02 * dt);   // ~50 s a 135 °C per distruggere il motore
      st.perditaCarburante = C.serbatoio < 0.95 ? (1 - C.serbatoio) * 0.03 : 0;   // L/s: fino a ~110 L/h con serbatoio sfondato
    }
    /* → modificatori per il motore fisico */
    if (veh) {
      const M = veh.mod, motore = Math.min(C.motore, st.termico);
      M.potenza = motore < 0.06 ? 0 : 0.3 + 0.7 * motore;
      M.radiatore = 0.1 + 0.9 * C.radiatore; M.refrigerante = st.refrigerante;
      M.cambio = C.cambio; M.trasmissione = 0.85 + 0.15 * C.cambio;
      M.frizione = C.frizione < 0.08 ? 0 : 0.3 + 0.7 * C.frizione;            // coppia massima trasmissibile (frizione che slitta sotto carico)
      M.differenziale = C.differenziale < 0.08 ? 0 : 0.35 + 0.65 * C.differenziale;   // trazione: coppia che arriva alle ruote
      M.freni = C.freni.map(f => 0.15 + 0.85 * f);
      M.attritoExtra = (4 - C.sospensioni.reduce((a, b) => a + b, 0)) * 220;   // N per sospensione piegata
      M.perditaCarburante = st.perditaCarburante;
      M.alternatore = 0.2 + 0.8 * C.elettrico;
      if (!(veh.ecu && veh.ecu.spegni) && M.avviamento !== 0) M.avviamento = C.batteria < 0.2 ? 0.3 : 1;
    }
    return ctxECU(st);
  }
  /* contesto per le ECU virtuali */
  function ctxECU(st) { const C = st.comp; return { elettrico: C.elettrico, batteria: C.batteria, cambio: C.cambio, centraline: C.centraline, frizione: C.frizione, sensoriRuota: C.sensoriRuota.map(s => s < 0.5), lampF: [C.fari[0] < 0.5, C.fari[1] < 0.5], lampR: [C.fanali[0] < 0.5, C.fanali[1] < 0.5], absPompa: C.elettrico } }

  /* effetti sulla guida del gioco (oltre a quelli già calcolati dal gioco con la rete) */
  function effettiGuida(st) { const C = st.comp; return { sterzoCorsa: 0.45 + 0.55 * C.sterzo, sterzoTiro: (1 - C.sterzo) * 0.04 * ((C.sospensioni[0] - C.sospensioni[1]) >= 0 ? 1 : -1) } }

  /* preventivo: componenti da riparare con costo (centesimi) */
  function preventivo(st) {
    const C = st.comp, out = [], add = (chiave, nome, integ, costoPieno, idx) => { if (integ >= 0.999) return; out.push({ chiave, idx, nome, integrita: +integ.toFixed(2), costo: Math.round(costoPieno * (1 - integ)) }) };
    C.struttura.forEach((v, i) => add('struttura', 'Carrozzeria zona ' + ['ant. sin.', 'ant. des.', 'centr. sin.', 'centr. des.', 'post. sin.', 'post. des.'][i], v, COSTI.struttura, i));
    add('radiatore', NOMI.radiatore, C.radiatore, COSTI.radiatore); if (st.refrigerante < 0.98) out.push({ chiave: 'refrigerante', nome: 'Rabbocco refrigerante', integrita: +st.refrigerante.toFixed(2), costo: Math.round(COSTI.refrigerante * (1 - st.refrigerante)) });
    add('motore', NOMI.motore + (st.termico < 0.999 ? ' (anche danno termico)' : ''), Math.min(C.motore, st.termico), COSTI.motore);
    add('cambio', NOMI.cambio, C.cambio, COSTI.cambio); add('frizione', NOMI.frizione, C.frizione, COSTI.frizione); add('differenziale', NOMI.differenziale, C.differenziale, COSTI.differenziale); add('centraline', NOMI.centraline, C.centraline, COSTI.centraline); add('sterzo', NOMI.sterzo, C.sterzo, COSTI.sterzo);
    C.sospensioni.forEach((v, i) => add('sospensioni', 'Sospensione ' + RUOTE[i], v, COSTI.sospensione, i)); C.freni.forEach((v, i) => add('freni', 'Freno ' + RUOTE[i], v, COSTI.freno, i));
    add('batteria', NOMI.batteria, C.batteria, COSTI.batteria); add('scarico', NOMI.scarico, C.scarico, COSTI.scarico); add('serbatoio', NOMI.serbatoio, C.serbatoio, COSTI.serbatoio); add('elettrico', NOMI.elettrico, C.elettrico, COSTI.elettrico);
    C.sensoriRuota.forEach((v, i) => add('sensoriRuota', 'Sensore ruota ' + RUOTE[i], v, COSTI.sensoreRuota, i)); C.fari.forEach((v, i) => add('fari', 'Faro ' + (i ? 'destro' : 'sinistro'), v, COSTI.faro, i)); C.fanali.forEach((v, i) => add('fanali', 'Fanale ' + (i ? 'destro' : 'sinistro'), v, COSTI.fanale, i));
    C.pneumatici.forEach((v, i) => add('pneumatici', 'Pneumatico ' + RUOTE[i], v, COSTI.pneumatico, i));
    return { voci: out, totale: out.reduce((s, q) => s + q.costo, 0) };
  }

  /* riparazione: chiave + indice, oppure 'tutto' (officina) oppure 'emergenza' (bordo strada: meccanica al massimo al 70%, niente refrigerante né elettronica). Restituisce il costo applicato. */
  function ripara(st, chiave, idx, veh) {
    const C = st.comp, pre = preventivo(st); let costo = 0;
    const porta = (k, i) => { if (Array.isArray(C[k])) { if (i === undefined) C[k] = C[k].map(() => 1); else C[k][i] = 1 } else C[k] = 1 };
    if (chiave === 'tutto') { costo = pre.totale; for (const k in C) porta(k); st.refrigerante = 1; st.termico = 1; st.perditaCarburante = 0; st.deformazioneMax = 0 }
    else if (chiave === 'emergenza') { for (const k in C) { if (Array.isArray(C[k])) C[k] = C[k].map(v => Math.max(v, k === 'struttura' || k === 'pneumatici' || k === 'fari' || k === 'fanali' ? 1 : 0.7)); else C[k] = Math.max(C[k], 0.7) } st.deformazioneMax = 0; st.perditaCarburante = C.serbatoio < 0.95 ? (1 - C.serbatoio) * 0.03 : 0; costo = 0 }
    else { const voce = pre.voci.find(q => q.chiave === chiave && (idx === undefined || q.idx === idx)); if (!voce) return 0; costo = voce.costo; if (chiave === 'refrigerante') st.refrigerante = 1; else if (chiave === 'motore') { C.motore = 1; st.termico = 1 } else porta(chiave, idx); if (chiave === 'serbatoio') st.perditaCarburante = 0 }
    st.riparazioni.push({ t: Date.now(), cosa: chiave + (idx !== undefined ? '[' + idx + ']' : ''), costo }); if (st.riparazioni.length > 30) st.riparazioni.splice(0, 10);
    if (veh) aggiorna(st, 0, null, veh);
    return costo;
  }

  /* analisi per il pannello */
  function analisi(st) {
    const C = st.comp, media = a => a.reduce((s, v) => s + v, 0) / a.length;
    const strutt = media(C.struttura), mecc = media([C.motore * 0.3 + st.termico * 0.7 * 0 + Math.min(C.motore, st.termico) * 0.7, C.cambio, C.frizione, C.differenziale, C.sterzo, media(C.sospensioni), media(C.freni), C.radiatore]);
    return {
      nota: 'Stime del modello di gioco (rete deformabile + regole di questo modulo): non sono risultati di prove d\'urto reali.',
      integritaStrutturale: +strutt.toFixed(2), integritaMeccanica: +mecc.toFixed(2), deformazioneMaxM: +st.deformazioneMax.toFixed(2), energiaUrtiKJ: +(st.energiaTot / 1000).toFixed(1), nUrti: st.nUrti,
      refrigerante: +st.refrigerante.toFixed(2), dannoTermicoMotore: +(1 - st.termico).toFixed(2), perditaCarburanteLh: +(st.perditaCarburante * 3600).toFixed(1),
      componenti: Object.keys(C).map(k => ({ chiave: k, nome: NOMI[k] || k, integrita: Array.isArray(C[k]) ? C[k].map(v => +v.toFixed(2)) : +C[k].toFixed(2) })),
      statoStrutturale: strutt > 0.9 ? 'integro' : strutt > 0.6 ? 'deformato' : strutt > 0.3 ? 'gravemente deformato' : 'compromesso', statoMeccanico: mecc > 0.9 ? 'efficiente' : mecc > 0.6 ? 'ridotto' : mecc > 0.3 ? 'critico' : 'fuori uso',
      storico: st.storico.slice(-10), riparazioni: st.riparazioni.slice(-5), preventivo: preventivo(st),
    };
  }

  function serializza(st) { return { v: 1, comp: st.comp, refrigerante: +st.refrigerante.toFixed(3), termico: +st.termico.toFixed(3), storico: st.storico.slice(-20), energiaTot: Math.round(st.energiaTot), deformazioneMax: +st.deformazioneMax.toFixed(3), nUrti: st.nUrti, riparazioni: st.riparazioni.slice(-10) } }
  function ripristina(st, s) {
    if (!s || typeof s !== 'object' || !s.comp) return false; const n = (x, fb) => Number.isFinite(x) ? cl(x, 0, 1) : fb;
    for (const k in st.comp) { const d = s.comp[k]; if (d === undefined) continue; if (Array.isArray(st.comp[k])) { if (Array.isArray(d) && d.length === st.comp[k].length) st.comp[k] = d.map(x => n(x, 1)) } else st.comp[k] = n(d, 1) }
    st.refrigerante = n(s.refrigerante, 1); st.termico = n(s.termico, 1); if (Array.isArray(s.storico)) st.storico = s.storico.slice(-40); st.energiaTot = Number.isFinite(s.energiaTot) ? s.energiaTot : 0; st.deformazioneMax = Number.isFinite(s.deformazioneMax) ? s.deformazioneMax : 0; st.nUrti = Number.isFinite(s.nUrti) ? s.nUrti : 0; if (Array.isArray(s.riparazioni)) st.riparazioni = s.riparazioni.slice(-30);
    st.perditaCarburante = st.comp.serbatoio < 0.95 ? (1 - st.comp.serbatoio) * 0.03 : 0;
    return true;
  }

  return { versione: '1.1.0', SOGLIE, COSTI, NOMI, RUOTE, crea, urto, aggiorna, ctxECU, effettiGuida, preventivo, ripara, analisi, serializza, ripristina };
});
