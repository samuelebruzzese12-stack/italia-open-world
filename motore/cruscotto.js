/* ITALIA OPEN WORLD — Quadro strumenti del veicolo e comandi di guida a schermo (versione 33.1)
   =============================================================================================
   Modulo puro: gira nel browser (window.IOW_CRUSCOTTO) e in Node (module.exports). La LOGICA (aggiorna, comandi) non usa il DOM ed è
   provata in Node (test/cruscotto.js); il DISEGNO (disegna) usa solo l'API Canvas 2D ed è provato in Chromium con il controllo dei pixel
   (test/browser_cruscotto.js). Disegno originale del progetto, vettoriale: nessuna immagine esterna.

   ASPETTO (33.1): plancia bassa e compatta, due strumenti «a cannocchiale» con cornice cromata (contagiri a sinistra, tachimetro a destra,
   scala a 270°), display monocromatico al centro con le frecce sopra, temperatura a sinistra e carburante a destra, tutte le altre spie in
   una sola fila in basso. Proporzioni 1200 × 470: sul telefono occupa circa un terzo della larghezza e meno di un terzo dell'altezza.

   STRUMENTI
   - Contagiri 0–8 (×1000 giri/min), zona rossa dal regime del limitatore del veicolo (diesel 1.9 JTDm: 4600 giri), arancione 500 giri prima.
   - Tachimetro 0–280 km/h, legato a |vx| della dinamica a 200 Hz (tolleranza di lettura configurabile, predefinita 0 %), con in basso il
     consumo istantaneo km/l (0–30): v[km/h] / consumo[L/h], filtrato 0,6 s; in rilascio (iniezione tagliata) a fondo scala, da fermo zero.
   - Display: chilometri totali (6 cifre) e parziali della sessione (0,1 km) con cifre a 7 segmenti, marcia, chiave dell'assistenza.
     Percorrenza misurata sulla MAPPA (spostamento dell'auto fra un fotogramma e l'altro; salti oltre 80 m/s esclusi: teletrasporti).
   - Temperatura del refrigerante C–H (strumento «tamponato» come nei veicoli reali: fermo a metà fra 80 e 105 °C) e livello del
     carburante E–F (galleggiante smorzato 6 s, risalita rapida all'accensione).
   - Lancette con dinamica del secondo ordine (motori passo-passo: pulsazione 16 rad/s, smorzamento 0,72) e «giro di prova» all'accensione.

   SPIE (21) — stato da variabili del motore fisico, della centralina a 200 Hz, della rete ECU, dei danni e del gioco:
   ABS (arancione) e ESP/TCS (ambra, auto che sbanda): LAMPEGGIANO (2 Hz) mentre i regolatori intervengono (per almeno 0,5 s dopo ogni
   intervento); ACCESE FISSE con la centralina in BLACKOUT (urto oltre 15 g) o con ABS/ESC disattivati dalla rete (guasto). Guasto motore
   (gialla) e pressione olio (rossa): motore KO (integrità sotto 0,30 dalla carrozzeria deformabile) o codice di guasto del motore; con il
   quadro acceso e il motore spento si accendono come nelle auto vere. Freno a mano (P) e portiere: freno a mano tirato, oppure portiere
   bloccate dal telaio deformato, accese finché il giocatore non sfonda il parabrezza (10 calci). Abbaglianti (blu), anabbaglianti e luci
   di posizione (verdi), retronebbia, frecce/emergenza (verdi, 1,5 Hz), sensori di parcheggio (in retromarcia), batteria, impianto
   frenante (freni danneggiati o EBD perso nel blackout), luci esterne guaste, temperatura, riserva, cintura, lunotto termico, liquido
   lavavetri (le ultime due: il gioco non ha questi impianti, restano spente dopo l'autotest). Autotest di 2 s all'accensione. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.IOW_CRUSCOTTO = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const cl = (v, a, b) => v < a ? a : v > b ? b : v, D2R = Math.PI / 180;
  const W = 1200, H = 470;

  /* ------------------------------------------------------------------ disposizione (coordinate di progetto 1200 × 470) */
  const COL = { rosso: '#ff2b1c', arancione: '#ff7417', ambra: '#ffb400', giallo: '#ffd21f', verde: '#18e07c', blu: '#1f9dff', bianco: '#f4f4f4' };
  const FILA = ['abbaglianti', 'anabbaglianti', 'posizione', 'retronebbia', 'luciGuaste', 'sensoriPark', 'cintura', 'porte', 'frenoMano', 'freno', 'abs', 'esp', 'motore', 'olio', 'batteria', 'temperatura', 'riserva', 'lunotto', 'lavavetri'];
  const SPIE = {
    abbaglianti: { c: 'blu', n: 'Abbaglianti' }, anabbaglianti: { c: 'verde', n: 'Anabbaglianti' }, posizione: { c: 'verde', n: 'Luci di posizione' }, retronebbia: { c: 'ambra', n: 'Retronebbia' },
    luciGuaste: { c: 'arancione', n: 'Luci esterne guaste' }, sensoriPark: { c: 'bianco', n: 'Sensori di parcheggio' }, cintura: { c: 'rosso', n: 'Cintura di sicurezza' }, porte: { c: 'rosso', n: 'Portiere' },
    frenoMano: { c: 'rosso', n: 'Freno di stazionamento' }, freno: { c: 'rosso', n: 'Impianto frenante' }, abs: { c: 'arancione', n: 'ABS' }, esp: { c: 'ambra', n: 'ESP / controllo di trazione' },
    motore: { c: 'giallo', n: 'Guasto motore' }, olio: { c: 'rosso', n: 'Pressione olio' }, batteria: { c: 'rosso', n: 'Batteria / alternatore' }, temperatura: { c: 'rosso', n: 'Temperatura refrigerante' },
    riserva: { c: 'ambra', n: 'Riserva carburante' }, lunotto: { c: 'ambra', n: 'Lunotto termico' }, lavavetri: { c: 'ambra', n: 'Liquido lavavetri' },
    frecciaSx: { x: 563, y: 74, c: 'verde', n: 'Freccia sinistra' }, frecciaDx: { x: 637, y: 74, c: 'verde', n: 'Freccia destra' },
  };
  FILA.forEach((id, i) => { SPIE[id].x = 96 + i * 56; SPIE[id].y = 433 });
  const LAYOUT = {
    W, H, dimSpia: 40,
    giri: { cx: 352, cy: 222, r: 162, a0: 135, a1: 405, max: 8 },
    vel: { cx: 848, cy: 222, r: 162, a0: 135, a1: 405, max: 280 },
    kml: { cx: 848, cy: 338, r: 44, a0: 212, a1: 328, max: 30 },
    temp: { cx: 150, cy: 236, r: 86, a0: 135, a1: 225 },
    carb: { cx: 1050, cy: 236, r: 86, a0: 45, a1: -45 },
    lcd: { x: 528, y: 118, w: 144, h: 186 },
    spie: SPIE,
  };
  const ID_SPIE = Object.keys(LAYOUT.spie);
  const NON_IN_AUTOTEST = { frecciaSx: 1, frecciaDx: 1, abbaglianti: 1, posizione: 1, anabbaglianti: 1, retronebbia: 1, sensoriPark: 1 };
  /* angolo [gradi, canvas: 0 = destra, positivi in senso orario] di una frazione 0..1 della scala */
  const angolo = (g, f) => g.a0 + (g.a1 - g.a0) * cl(f, 0, 1);

  /* ------------------------------------------------------------------ stato */
  function crea(opz) {
    opz = opz || {};
    const ago = () => ({ p: 0, v: 0 });
    return {
      t: 0, quadro: false, tAcceso: -99, autotest: opz.autotest !== undefined ? opz.autotest : 2.0, giroProva: opz.giroProva !== undefined ? opz.giroProva : 1.4,
      tolleranza: opz.tolleranzaTachimetro || 0, redline: opz.redline || 4600,
      aghi: { giri: ago(), vel: ago(), kml: ago(), temp: ago(), carb: ago() }, wn: 16, zeta: 0.72,
      kmlF: 0, carbF: null, tempF: null,
      odo: { totaleKm: Number.isFinite(opz.odoKm) ? opz.odoKm : 157256, parzialeKm: 0, ultimo: null },
      mem: { absT: -99, tcsT: -99, cinturaT: 0 },
      spie: {}, motivi: {},
    };
  }

  /* strumento della temperatura «tamponato»: 40 °C → 0, 80–105 °C → 0,5 (fermo), 130 °C → 1 */
  function tempFrazione(T) {
    if (!Number.isFinite(T)) return 0;
    if (T <= 40) return 0; if (T < 80) return 0.5 * (T - 40) / 40; if (T <= 105) return 0.5; if (T < 130) return 0.5 + 0.5 * (T - 105) / 25; return 1;
  }
  function kmlIstantaneo(vKmh, Lh) { if (vKmh < 2) return 0; if (!(Lh > 0.05)) return 30; return cl(vKmh / Lh, 0, 30) }

  /* ------------------------------------------------------------------ aggiornamento (ogni fotogramma)
     I = { quadro, motoreAcceso, rpm, vx [m/s], consumoLh, Tacqua, carbL, serbatoioL, riserva, marcia, frenoMano, freniIntegrita (0..1),
           centralina: { stato, abs (bool), tcs (bool), esp (bool) }, absOK, espOK, batteriaV, alternatore (0..1), milDTC, motoreIntegrita,
           fari: 'spenti'|'posizione'|'anabbaglianti'|'abbaglianti', fariGuasti, retronebbia, emergenza, freccia (-1/0/1),
           porteBloccate, portaAperta, posizione {x, z}, assistenza (bool) } */
  function aggiorna(s, dt, I) {
    dt = cl(dt || 0, 0, 0.25); s.t += dt; I = I || {};
    const q = !!I.quadro;
    if (q && !s.quadro) { s.tAcceso = s.t; s.mem.cinturaT = 0; s.carbF = null }
    if (!q && s.quadro) s.odo.ultimo = null;
    s.quadro = q;
    const ta = s.t - s.tAcceso, inAutotest = q && ta < s.autotest, sweep = q && ta < s.giroProva;
    /* --- percorrenza sulla mappa --- */
    if (q && I.posizione && Number.isFinite(I.posizione.x)) {
      const u = s.odo.ultimo;
      if (u) { const d = Math.hypot(I.posizione.x - u.x, I.posizione.z - u.z); if (d < 80 * dt + 5) { s.odo.totaleKm += d / 1000; s.odo.parzialeKm += d / 1000 } }
      s.odo.ultimo = { x: I.posizione.x, z: I.posizione.z };
    }
    /* --- bersagli delle lancette (frazioni di scala) --- */
    const vKmh = Math.abs(I.vx || 0) * 3.6 * (1 + s.tolleranza);
    s.kmlF += (kmlIstantaneo(Math.abs(I.vx || 0) * 3.6, I.consumoLh) - s.kmlF) * Math.min(1, dt / 0.6);
    const fC = I.serbatoioL > 0 ? cl(I.carbL / I.serbatoioL, 0, 1) : 0;
    if (s.carbF === null) s.carbF = 0;
    s.carbF += (fC - s.carbF) * Math.min(1, dt / (ta < 3 ? 0.8 : 6));     // galleggiante smorzato; all'accensione la lancetta sale in fretta
    const fT = tempFrazione(I.Tacqua);
    s.tempF = s.tempF === null ? fT : s.tempF + (fT - s.tempF) * Math.min(1, dt / 3);
    let bG = q ? (I.rpm || 0) / 1000 / LAYOUT.giri.max : 0, bV = q ? vKmh / LAYOUT.vel.max : 0, bK = q ? s.kmlF / LAYOUT.kml.max : 0;
    let bT = q ? s.tempF : 0, bC = q ? s.carbF : 0;
    if (sweep) { const f = Math.sin(Math.PI * cl(ta / s.giroProva, 0, 1)); bG = Math.max(bG, f); bV = Math.max(bV, f); bK = Math.max(bK, f) }   // giro di prova
    const tgt = { giri: bG, vel: bV, kml: bK, temp: bT, carb: bC };
    /* --- dinamica delle lancette: x'' = wn²(b − x) − 2ζ·wn·x', integrata a passi ≤ 1/240 s --- */
    const n = Math.max(1, Math.ceil(dt * 240)), h = dt / n, wn = s.wn, z = s.zeta;
    for (const k in s.aghi) { const a = s.aghi[k], b = cl(tgt[k], 0, 1.03); for (let i = 0; i < n; i++) { a.v += (wn * wn * (b - a.p) - 2 * z * wn * a.v) * h; a.p += a.v * h } if (a.p < -0.01) { a.p = -0.01; a.v = 0 } }
    /* --- spie --- */
    const c = I.centralina || {}, blackout = c.stato === 'BLACKOUT', S = {}, M = {};
    const set = (id, stato, motivo) => { S[id] = stato; if (stato !== 'spenta') M[id] = motivo };
    if (c.abs) s.mem.absT = s.t; if (c.tcs || c.esp) s.mem.tcsT = s.t;
    const motoreKO = Number.isFinite(I.motoreIntegrita) && I.motoreIntegrita < 0.3, spento = !I.motoreAcceso || (I.rpm || 0) < 350;
    if (!q) { for (const id of ID_SPIE) S[id] = 'spenta' }
    else {
      // ABS e ESP/TCS: fisse nel blackout o con le funzioni disattivate; lampeggio mentre intervengono
      if (blackout) { set('abs', 'accesa', 'centralina in BLACKOUT dopo un urto oltre 15 g: ABS fuori servizio'); set('esp', 'accesa', 'centralina in BLACKOUT: ESP e controllo di trazione fuori servizio') }
      else {
        if (I.absOK === false) set('abs', 'accesa', 'ABS disattivato dalla rete di bordo (guasto)'); else if (s.t - s.mem.absT < 0.5) set('abs', 'lampeggio', 'ABS in regolazione'); else set('abs', 'spenta');
        if (I.espOK === false) set('esp', 'accesa', 'ESP disattivato dalla rete di bordo (guasto)'); else if (s.t - s.mem.tcsT < 0.5) set('esp', 'lampeggio', c.esp ? 'ESP in regolazione' : 'controllo di trazione in regolazione'); else set('esp', 'spenta');
      }
      set('motore', motoreKO ? 'accesa' : I.milDTC ? 'accesa' : spento ? 'accesa' : 'spenta', motoreKO ? 'motore KO (danni alla carrozzeria deformabile)' : I.milDTC ? 'codice di guasto del motore' : 'quadro acceso, motore spento');
      set('olio', motoreKO ? 'accesa' : spento ? 'accesa' : 'spenta', motoreKO ? 'motore KO: pressione dell\'olio persa' : 'motore spento: pompa dell\'olio ferma');
      set('batteria', spento || (I.batteriaV > 0 && I.batteriaV < 11.8) || (I.alternatore !== undefined && I.alternatore < 0.35) ? 'accesa' : 'spenta', spento ? 'motore spento: alternatore fermo' : 'tensione bassa o alternatore danneggiato');
      set('freno', blackout || (I.freniIntegrita !== undefined && I.freniIntegrita < 0.6) || I.frenoMano ? 'accesa' : 'spenta', blackout ? 'ripartizione elettronica (EBD) persa nel blackout' : I.frenoMano ? 'freno di stazionamento tirato' : 'freni danneggiati');
      set('frenoMano', I.frenoMano || I.porteBloccate ? 'accesa' : 'spenta', I.porteBloccate ? 'auto accartocciata: telaio deformato, portiere bloccate' : 'freno di stazionamento tirato');
      set('porte', I.porteBloccate || I.portaAperta ? 'accesa' : 'spenta', I.porteBloccate ? 'portiere bloccate dal telaio: 10 calci sul parabrezza per uscire' : 'portiera aperta');
      const temp = I.Tacqua || 0; set('temperatura', temp > 120 ? 'lampeggio' : temp > 112 ? 'accesa' : 'spenta', 'refrigerante a ' + Math.round(temp) + ' °C');
      set('riserva', I.riserva ? 'accesa' : 'spenta', 'riserva');
      set('luciGuaste', I.fariGuasti ? 'accesa' : 'spenta', 'fari o fanali rotti');
      const fari = I.fari || 'spenti';
      set('posizione', fari !== 'spenti' ? 'accesa' : 'spenta', 'luci accese'); set('anabbaglianti', fari === 'anabbaglianti' || fari === 'abbaglianti' ? 'accesa' : 'spenta', 'anabbaglianti'); set('abbaglianti', fari === 'abbaglianti' ? 'accesa' : 'spenta', 'abbaglianti');
      set('retronebbia', I.retronebbia ? 'accesa' : 'spenta', 'retronebbia');
      const fr = I.emergenza ? 2 : (I.freccia || 0); set('frecciaSx', fr === 2 || fr < 0 ? 'freccia' : 'spenta', I.emergenza ? 'luci di emergenza' : 'freccia'); set('frecciaDx', fr === 2 || fr > 0 ? 'freccia' : 'spenta', I.emergenza ? 'luci di emergenza' : 'freccia');
      set('sensoriPark', I.marcia < 0 ? 'accesa' : 'spenta', 'retromarcia: sensori attivi');
      s.mem.cinturaT += dt; const slacciata = s.mem.cinturaT < 2.5;
      set('cintura', slacciata ? (vKmh > 20 ? 'lampeggio' : 'accesa') : 'spenta', 'cintura da allacciare');
      set('lunotto', 'spenta'); set('lavavetri', 'spenta');
      if (inAutotest) for (const id of ID_SPIE) if (!NON_IN_AUTOTEST[id]) { if (S[id] === 'spenta') M[id] = 'autotest all\'accensione'; S[id] = S[id] === 'spenta' ? 'autotest' : S[id] }
    }
    s.spie = S; s.motivi = M;
    return modello(s, I);
  }

  /* acceso in questo istante (lampeggi: 2 Hz per ABS/ESP e temperatura, 1,5 Hz per le frecce) */
  function accesa(s, id) { const st = s.spie[id]; if (!st || st === 'spenta') return false; if (st === 'lampeggio') return (s.t * 4) % 2 < 1; if (st === 'freccia') return (s.t * 3) % 2 < 1; return true }

  function modello(s, I) {
    const ag = {}; for (const k in s.aghi) ag[k] = s.aghi[k].p;
    const sp = {}; for (const id of ID_SPIE) sp[id] = { stato: s.spie[id] || 'spenta', accesa: accesa(s, id), motivo: s.motivi[id] || '' };
    const tot = Math.floor(s.odo.totaleKm), par = Math.floor(s.odo.parzialeKm * 10) / 10;
    const m = I && I.marcia !== undefined ? (I.marcia < 0 ? 'R' : I.marcia === 0 ? 'N' : String(I.marcia)) : '';
    return {
      quadro: s.quadro, aghi: ag, angoli: { giri: angolo(LAYOUT.giri, ag.giri), vel: angolo(LAYOUT.vel, ag.vel), kml: angolo(LAYOUT.kml, ag.kml), temp: angolo(LAYOUT.temp, ag.temp), carb: angolo(LAYOUT.carb, ag.carb) },
      lcd: { totale: String(Math.min(999999, tot)).padStart(6, ' '), parziale: par.toFixed(1), marcia: m, kml: s.kmlF, assistenza: !!(I && I.assistenza) },
      spie: sp, redline: s.redline, t: s.t,
    };
  }

  /* ------------------------------------------------------------------ comandi di guida a schermo (al posto della levetta)
     Due frecce (sterzo a rampa: 0 → pieno in 0,22 s, ritorno al centro in 0,15 s) e due pedali analogici: la pressione dipende dal punto
     toccato (in alto 100 %, in basso 25 %, trascinando il dito cambia) e il pedale la segue con il ritardo del piede (60 ms). */
  function creaComandi() { return { sx: false, dx: false, ped: { acc: { giu: false, rich: 0, val: 0 }, freno: { giu: false, rich: 0, val: 0 } }, sterzo: 0 } }
  function premi(c, id, relY) {
    if (id === 'sx' || id === 'dx') { c[id] = true; return }
    const p = c.ped[id]; if (!p) return; p.giu = true; p.rich = cl(0.25 + 0.75 * (1 - cl(Number.isFinite(relY) ? relY : 0, 0, 1)), 0.25, 1);
  }
  function rilascia(c, id) { if (id === 'sx' || id === 'dx') { c[id] = false; return } const p = c.ped[id]; if (p) { p.giu = false; p.rich = 0 } }
  function passoComandi(c, dt) {
    dt = cl(dt || 0, 0, 0.1);
    const b = (c.dx ? 1 : 0) - (c.sx ? 1 : 0);
    if (b === 0) c.sterzo -= Math.sign(c.sterzo) * Math.min(Math.abs(c.sterzo), dt / 0.15);
    else { if (Math.sign(c.sterzo) !== b && c.sterzo !== 0) c.sterzo = 0; c.sterzo = cl(c.sterzo + b * dt / 0.22, -1, 1) }
    for (const k in c.ped) { const p = c.ped[k]; p.val += (p.rich - p.val) * Math.min(1, dt / 0.06); if (!p.giu && p.val < 0.01) p.val = 0 }
    const acc = c.ped.acc.val, fr = c.ped.freno.val;
    return { ix: c.sterzo, acc, freno: fr, iy: cl(acc - fr, -1, 1) };
  }

  /* ================================================================== DISEGNO (Canvas 2D) ================================================================== */
  const FONT = '"Helvetica Neue",Helvetica,Arial,system-ui,sans-serif';
  function arco(g, cx, cy, r, a0, a1, ccw) { g.beginPath(); g.arc(cx, cy, r, a0 * D2R, a1 * D2R, !!ccw) }
  function polare(cx, cy, r, aDeg) { return [cx + r * Math.cos(aDeg * D2R), cy + r * Math.sin(aDeg * D2R)] }

  /* --- plancia: palpebra scura che avvolge i due cannocchiali, fascia delle spie in basso --- */
  function plancia(g) {
    const G = LAYOUT; g.save();
    const forma = () => { g.beginPath(); if (g.roundRect) g.roundRect(14, 96, W - 28, H - 104, 38); else g.rect(14, 96, W - 28, H - 104); g.moveTo(G.giri.cx + 186, G.giri.cy); g.arc(G.giri.cx, G.giri.cy, 186, 0, Math.PI * 2); g.moveTo(G.vel.cx + 186, G.vel.cy); g.arc(G.vel.cx, G.vel.cy, 186, 0, Math.PI * 2) };
    g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 18; g.shadowOffsetY = 6;
    const gr = g.createLinearGradient(0, 30, 0, H); gr.addColorStop(0, '#24262b'); gr.addColorStop(0.18, '#121317'); gr.addColorStop(1, '#08090b'); g.fillStyle = gr; forma(); g.fill('nonzero');
    g.shadowColor = 'transparent'; g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,.10)';
    for (const Q of [G.giri, G.vel]) { arco(g, Q.cx, Q.cy, 185, 200, 340); g.stroke() }
    // trama morbida della palpebra (finto materiale goffrato)
    g.globalAlpha = 0.045; for (let i = 0; i < 700; i++) { g.fillStyle = i % 2 ? '#fff' : '#000'; g.fillRect(20 + (i * 137) % (W - 40), 100 + (i * 59) % (H - 110), 2, 2) } g.globalAlpha = 1;
    // fascia delle spie: incassata
    const fy = 408, fh = 50; g.fillStyle = '#040405'; g.beginPath(); if (g.roundRect) g.roundRect(60, fy, W - 120, fh, 14); else g.rect(60, fy, W - 120, fh); g.fill();
    const ig = g.createLinearGradient(0, fy, 0, fy + fh); ig.addColorStop(0, 'rgba(0,0,0,.8)'); ig.addColorStop(0.3, 'rgba(0,0,0,0)'); g.fillStyle = ig; g.fill();
    g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 1.5; g.stroke(); g.restore();
  }
  /* --- cannocchiale: cornice cromata, tubo profondo, quadrante, scala --- */
  function cannocchiale(g, Q, opz) {
    const { cx, cy, r } = Q; g.save();
    // tubo (profondità): anello scuro con sfumatura verso l'interno
    let tg = g.createRadialGradient(cx, cy, r * 0.9, cx, cy, r + 20); tg.addColorStop(0, '#000'); tg.addColorStop(1, '#2a2c31'); g.fillStyle = tg; arco(g, cx, cy, r + 20, 0, 360); g.fill();
    // cornice cromata
    const cg = g.createLinearGradient(cx - r, cy - r - 20, cx + r * 0.6, cy + r + 20); cg.addColorStop(0, '#fbfbfc'); cg.addColorStop(0.25, '#8b8f96'); cg.addColorStop(0.5, '#e4e6ea'); cg.addColorStop(0.75, '#5d6067'); cg.addColorStop(1, '#c9ccd2');
    g.lineWidth = 9; g.strokeStyle = cg; arco(g, cx, cy, r + 12, 0, 360); g.stroke(); g.lineWidth = 1.2; g.strokeStyle = 'rgba(0,0,0,.8)'; arco(g, cx, cy, r + 7, 0, 360); g.stroke();
    // quadrante
    const fg = g.createRadialGradient(cx, cy - r * 0.35, r * 0.1, cx, cy, r + 6); fg.addColorStop(0, '#202227'); fg.addColorStop(0.7, '#0d0e11'); fg.addColorStop(1, '#030304'); g.fillStyle = fg; arco(g, cx, cy, r + 6, 0, 360); g.fill();
    // ombra della palpebra in alto (il quadrante sta in fondo al tubo)
    const og = g.createLinearGradient(0, cy - r, 0, cy - r * 0.35); og.addColorStop(0, 'rgba(0,0,0,.55)'); og.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = og; arco(g, cx, cy, r + 6, 0, 360); g.fill();
    // scala
    const tick = (f, l0, l1, w, col) => { const a = angolo(Q, f), [x0, y0] = polare(cx, cy, r - l0, a), [x1, y1] = polare(cx, cy, r - l1, a); g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke() };
    if (opz.rosso !== undefined) { g.save(); g.strokeStyle = 'rgba(230,24,16,.9)'; g.lineWidth = 9; arco(g, cx, cy, r - 9, angolo(Q, opz.rosso / Q.max), angolo(Q, 1)); g.stroke(); g.strokeStyle = 'rgba(255,140,30,.75)'; arco(g, cx, cy, r - 9, angolo(Q, opz.arancio / Q.max), angolo(Q, opz.rosso / Q.max)); g.stroke(); g.restore() }
    g.save(); g.shadowColor = 'rgba(220,235,255,.55)'; g.shadowBlur = 3;
    for (let i = 0; i <= opz.nMin; i++) { const f = i / opz.nMin, v = f * Q.max, maj = Math.abs(v / opz.maj - Math.round(v / opz.maj)) < 1e-6, med = !maj && opz.med && Math.abs(v / opz.med - Math.round(v / opz.med)) < 1e-6;
      tick(f, 4, maj ? 24 : med ? 16 : 11, maj ? 4.2 : med ? 2.4 : 1.4, '#f1f3f6') }
    g.fillStyle = '#f4f6f8'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let v = 0; v <= Q.max + 1e-6; v += opz.maj) { const [x, y] = polare(cx, cy, r - opz.rNum, angolo(Q, v / Q.max)); g.font = '600 ' + opz.fs + 'px ' + FONT; g.save(); g.translate(x, y); g.scale(opz.cond || 1, 1); g.fillText(String(Math.round(v)), 0, 0); g.restore() }
    g.restore();
    g.fillStyle = '#9fa4ad'; g.font = '500 15px ' + FONT; g.textAlign = 'center'; g.fillText(opz.unita, cx, cy - r * 0.36);
    g.restore();
  }
  function quadranteKml(g) {
    const Q = LAYOUT.kml; g.save(); g.strokeStyle = '#d9dce2';
    for (let i = 0; i <= 30; i++) { const a = angolo(Q, i / 30), maj = i % 10 === 0, med = i % 5 === 0, [x0, y0] = polare(Q.cx, Q.cy, Q.r, a), [x1, y1] = polare(Q.cx, Q.cy, Q.r - (maj ? 10 : med ? 7 : 4), a); g.lineWidth = maj ? 2.4 : 1.2; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke() }
    g.fillStyle = '#d9dce2'; g.font = '600 13px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const [v, t] of [[0, '0'], [15, '15'], [30, '30']]) { const [x, y] = polare(Q.cx, Q.cy, Q.r + 11, angolo(Q, v / 30)); g.fillText(t, x, y) }
    g.fillStyle = '#9fa4ad'; g.font = '500 12px ' + FONT; g.fillText('km/l', Q.cx, Q.cy + 14); g.restore();
  }
  /* --- strumento laterale ad arco (temperatura, carburante) --- */
  function laterale(g, Q, et0, et1, icona, r0, r1) {
    g.save();
    g.fillStyle = '#060607'; g.beginPath(); g.moveTo(Q.cx, Q.cy); g.arc(Q.cx, Q.cy, Q.r + 10, Math.min(Q.a0, Q.a1) * D2R - 0.12, Math.max(Q.a0, Q.a1) * D2R + 0.12); g.closePath(); g.fill();
    for (let i = 0; i <= 16; i++) { const f = i / 16, a = angolo(Q, f), maj = i % 4 === 0, rs = (f >= r0 - 1e-6 && f <= r1 + 1e-6), [x0, y0] = polare(Q.cx, Q.cy, Q.r, a), [x1, y1] = polare(Q.cx, Q.cy, Q.r - (maj ? 15 : 8), a);
      g.strokeStyle = rs ? '#ff2a18' : '#eceef2'; g.lineWidth = maj ? 3.4 : 1.6; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke() }
    g.fillStyle = '#f2f4f7'; g.font = '700 22px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
    let [x, y] = polare(Q.cx, Q.cy, Q.r - 32, angolo(Q, 0)); g.fillText(et0, x, y); [x, y] = polare(Q.cx, Q.cy, Q.r - 32, angolo(Q, 1)); g.fillText(et1, x, y);
    const [ix, iy] = polare(Q.cx, Q.cy, Q.r - 4, angolo(Q, 1.32)); simbolo(g, icona, ix, iy, 28, '#c9ccd2', false); g.restore();
  }
  /* --- lancetta rossa --- */
  function lancetta(g, cx, cy, aDeg, lung, coda, larg, perno) {
    g.save(); g.translate(cx, cy); g.rotate(aDeg * D2R);
    g.shadowColor = 'rgba(255,50,30,.75)'; g.shadowBlur = 8;
    const gr = g.createLinearGradient(-coda, 0, lung, 0); gr.addColorStop(0, '#6a0703'); gr.addColorStop(0.3, '#e8200f'); gr.addColorStop(1, '#ff7a4a');
    g.fillStyle = gr; g.beginPath(); g.moveTo(-coda, -larg); g.lineTo(lung, -larg * 0.25); g.lineTo(lung + 2, 0); g.lineTo(lung, larg * 0.25); g.lineTo(-coda, larg); g.closePath(); g.fill();
    g.restore();
    g.save(); const hg = g.createRadialGradient(cx - perno * 0.35, cy - perno * 0.35, 1, cx, cy, perno); hg.addColorStop(0, '#d7d9de'); hg.addColorStop(0.35, '#5c6067'); hg.addColorStop(1, '#141518'); g.fillStyle = hg; arco(g, cx, cy, perno, 0, 360); g.fill();
    g.fillStyle = '#0a0a0c'; arco(g, cx, cy, perno * 0.55, 0, 360); g.fill(); g.restore();
  }
  /* --- cifre a 7 segmenti (display) --- */
  const SEG = { '0': 'abcdef', '1': 'bc', '2': 'abged', '3': 'abgcd', '4': 'fgbc', '5': 'afgcd', '6': 'afgedc', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg', '-': 'g', ' ': '', 'R': 'efab', 'N': 'ecab', 'P': 'abfge' };
  function cifra(g, ch, x, y, w, h, on, off) {
    const t = Math.max(2, w * 0.18), k = SEG[ch] !== undefined ? SEG[ch] : '', sl = w * 0.12;
    const segs = { a: [[t, 0], [w - t, 0]], b: [[w, t], [w, h / 2 - t / 2]], c: [[w, h / 2 + t / 2], [w, h - t]], d: [[t, h], [w - t, h]], e: [[0, h / 2 + t / 2], [0, h - t]], f: [[0, t], [0, h / 2 - t / 2]], g: [[t, h / 2], [w - t, h / 2]] };
    g.save(); g.lineCap = 'round'; g.lineWidth = t;
    for (const s in segs) { const acceso = k.indexOf(s) >= 0, [p0, p1] = segs[s]; g.strokeStyle = acceso ? on : off; const sk = yy => (h - yy) / h * sl; g.beginPath(); g.moveTo(x + p0[0] + sk(p0[1]), y + p0[1]); g.lineTo(x + p1[0] + sk(p1[1]), y + p1[1]); g.stroke() }
    g.restore();
  }
  function testo7(g, str, x, y, w, h, gap, on, off) { let cx = x; for (const ch of str) { cifra(g, ch, cx, y, w, h, on, off); cx += w + gap } return cx }
  /* display monocromatico (cristalli liquidi negativi: cifre chiare su fondo nero) */
  function display(g, M) {
    const L = LAYOUT.lcd; g.save();
    g.fillStyle = '#020203'; g.beginPath(); if (g.roundRect) g.roundRect(L.x, L.y, L.w, L.h, 10); else g.rect(L.x, L.y, L.w, L.h); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 2; g.stroke(); g.restore();
    if (!M || !M.quadro) return;
    const on = '#e9f1f6', off = 'rgba(200,220,235,.06)', x0 = L.x + 12;
    g.save(); g.fillStyle = '#8c949c'; g.font = '600 12px ' + FONT; g.textBaseline = 'alphabetic'; g.fillText('TOTALE', x0, L.y + 22); g.fillText('PARZIALE', x0, L.y + 82); g.restore();
    testo7(g, M.lcd.totale, x0 + 2, L.y + 30, 13, 26, 6, on, off);
    g.save(); g.fillStyle = on; g.font = '600 13px ' + FONT; g.fillText('km', L.x + L.w - 30, L.y + 22); g.restore();
    const par = M.lcd.parziale.padStart(5, ' ').replace('.', ''); testo7(g, par, x0 + 21, L.y + 90, 13, 26, 6, on, off);
    g.save(); g.fillStyle = on; g.fillRect(x0 + 21 + 3 * 19 - 4, L.y + 113, 4, 4); g.restore();
    g.save(); g.strokeStyle = 'rgba(255,255,255,.1)'; g.beginPath(); g.moveTo(L.x + 10, L.y + 132); g.lineTo(L.x + L.w - 10, L.y + 132); g.stroke(); g.restore();
    if (M.lcd.marcia) { g.save(); g.fillStyle = '#8c949c'; g.font = '600 12px ' + FONT; g.fillText('MARCIA', x0, L.y + 160); g.fillStyle = on; g.font = '700 30px ' + FONT; g.textAlign = 'right'; g.textBaseline = 'middle'; g.fillText(M.lcd.marcia, L.x + L.w - 14, L.y + 158); g.restore() }
    if (M.lcd.assistenza) simbolo(g, 'chiave', L.x + L.w - 58, L.y + 158, 20, '#ffb400', true);
  }
  /* riflesso del vetro sopra ogni cannocchiale */
  function vetro(g, cx, cy, r) { g.save(); arco(g, cx, cy, r, 0, 360); g.clip(); const gr = g.createLinearGradient(cx - r, cy - r, cx + r * 0.3, cy + r * 0.2); gr.addColorStop(0, 'rgba(255,255,255,.09)'); gr.addColorStop(0.42, 'rgba(255,255,255,.02)'); gr.addColorStop(0.43, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(cx - r, cy - r, 2 * r, 2 * r); g.restore() }
  /* --- simboli delle spie (disegno vettoriale originale, forme dei pittogrammi normalizzati ISO 2575) --- */
  function simbolo(g, id, x, y, sz, col, acceso) {
    g.save(); g.translate(x, y); const k = sz / 60; g.scale(k, k);
    g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 3.4; g.lineCap = 'round'; g.lineJoin = 'round';
    if (acceso) { g.shadowColor = col; g.shadowBlur = 16 / k }
    const L = (pts) => { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.stroke() };
    const fascio = (incl) => { g.beginPath(); g.moveTo(2, -14); g.bezierCurveTo(22, -14, 22, 14, 2, 14); g.closePath(); g.stroke(); for (const yy of [-11, -3.5, 4, 11.5]) L([-6, yy, -24, yy + incl]) };
    const testo = (t, fs, yy) => { g.font = '700 ' + fs + 'px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, 0, yy || 0) };
    const raggi = (r0, r1, n) => { for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; L([Math.cos(a) * r0, Math.sin(a) * r0, Math.cos(a) * r1, Math.sin(a) * r1]) } };
    switch (id) {
      case 'abbaglianti': fascio(0); break;
      case 'anabbaglianti': fascio(7); break;
      case 'retronebbia': { g.beginPath(); g.moveTo(-2, -14); g.bezierCurveTo(-22, -14, -22, 14, -2, 14); g.closePath(); g.stroke(); for (const yy of [-9, 0, 9]) L([4, yy, 22, yy]); g.beginPath(); for (let t = -16; t <= 16; t += 1) g.lineTo(13 + Math.sin(t * 0.55) * 3, t); g.stroke(); break }
      case 'posizione': { g.beginPath(); g.arc(0, 0, 9, 0, Math.PI * 2); g.stroke(); raggi(13, 21, 8); break }
      case 'luciGuaste': { g.beginPath(); g.arc(0, 0, 11, 0, Math.PI * 2); g.stroke(); raggi(15, 22, 8); testo('!', 17, 1); break }
      case 'batteria': { g.strokeRect(-20, -11, 40, 25); g.fillRect(-15, -16, 7, 5); g.fillRect(8, -16, 7, 5); L([-15, 1, -7, 1]); L([7, 1, 15, 1]); L([11, -3, 11, 5]); break }
      case 'olio': { g.beginPath(); g.moveTo(-24, -2); g.lineTo(-10, -2); g.lineTo(-6, -8); g.lineTo(8, -8); g.lineTo(22, -14); g.lineTo(10, 4); g.lineTo(-20, 4); g.lineTo(-20, -2); g.stroke(); L([-2, -8, -2, -13]); L([-7, -13, 3, -13]); g.beginPath(); g.moveTo(24, -4); g.quadraticCurveTo(28, 4, 24, 6); g.quadraticCurveTo(20, 4, 24, -4); g.fill(); break }
      case 'freno': { g.beginPath(); g.arc(0, 0, 13, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(0, 0, 20, Math.PI * 0.72, Math.PI * 1.28); g.stroke(); g.beginPath(); g.arc(0, 0, 20, -Math.PI * 0.28, Math.PI * 0.28); g.stroke(); testo('!', 18, 1); break }
      case 'frenoMano': { g.beginPath(); g.arc(0, 0, 13, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(0, 0, 20, Math.PI * 0.72, Math.PI * 1.28); g.stroke(); g.beginPath(); g.arc(0, 0, 20, -Math.PI * 0.28, Math.PI * 0.28); g.stroke(); testo('P', 17, 1); break }
      case 'motore': { L([-24, -2, -20, -2, -20, -8, -12, -8, -12, -13, 2, -13, 2, -8, 10, -8, 14, -12, 20, -12, 20, 12, 14, 12, 10, 8, -12, 8, -16, 12, -20, 12, -20, 4, -24, 4, -24, -2]); L([-6, -13, -6, -17]); L([-10, -17, -2, -17]); break }
      case 'frecciaSx': case 'frecciaDx': { const s = id === 'frecciaSx' ? -1 : 1; g.beginPath(); g.moveTo(-16 * s, -7); g.lineTo(2 * s, -7); g.lineTo(2 * s, -15); g.lineTo(18 * s, 0); g.lineTo(2 * s, 15); g.lineTo(2 * s, 7); g.lineTo(-16 * s, 7); g.closePath(); g.fill(); break }
      case 'sensoriPark': { testo('P', 30, 0); g.beginPath(); g.arc(4, 0, 18, -0.6, 0.6); g.stroke(); g.beginPath(); g.arc(4, 0, 25, -0.6, 0.6); g.stroke(); g.beginPath(); g.moveTo(32, 12); g.lineTo(44, 12); g.lineTo(38, 2); g.closePath(); g.fill(); break }
      case 'esp': { g.beginPath(); g.moveTo(-18, 0); g.lineTo(-13, -12); g.lineTo(13, -12); g.lineTo(18, 0); g.lineTo(18, 7); g.lineTo(-18, 7); g.closePath(); g.stroke(); g.fillRect(-16, 7, 6, 5); g.fillRect(10, 7, 6, 5);
        for (const xx of [-9, 7]) { g.beginPath(); for (let t = 0; t <= 14; t++) g.lineTo(xx + Math.sin(t * 0.6) * 4, 16 + t); g.stroke() } break }
      case 'abs': { g.beginPath(); g.arc(0, 0, 14, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(0, 0, 21, Math.PI * 0.72, Math.PI * 1.28); g.stroke(); g.beginPath(); g.arc(0, 0, 21, -Math.PI * 0.28, Math.PI * 0.28); g.stroke(); testo('ABS', 10, 1); break }
      case 'temperatura': { L([0, -18, 0, 6]); L([0, -14, 7, -14]); L([0, -8, 7, -8]); L([0, -2, 7, -2]); g.beginPath(); g.arc(0, 9, 4.5, 0, Math.PI * 2); g.fill(); for (const yy of [16, 22]) { g.beginPath(); for (let t = -20; t <= 20; t++) g.lineTo(t, yy + Math.sin(t * 0.5) * 2); g.stroke() } break }
      case 'termometro': { L([0, -18, 0, 4]); L([0, -14, 7, -14]); L([0, -8, 7, -8]); g.beginPath(); g.arc(0, 8, 4.5, 0, Math.PI * 2); g.fill(); for (const yy of [16, 21]) { g.beginPath(); for (let t = -16; t <= 16; t++) g.lineTo(t, yy + Math.sin(t * 0.55) * 1.8); g.stroke() } break }
      case 'riserva': case 'carburante': { g.strokeRect(-14, -16, 18, 32); g.fillRect(-11, -13, 12, 9); L([4, -8, 10, -8, 10, 8, 14, 8, 14, -10, 9, -16]); g.fillRect(-18, 14, 26, 4); break }
      case 'lunotto': { g.beginPath(); g.moveTo(-22, 14); g.lineTo(-18, -12); g.quadraticCurveTo(0, -18, 18, -12); g.lineTo(22, 14); g.closePath(); g.stroke(); for (const xx of [-8, 0, 8]) { g.beginPath(); for (let t = 10; t >= -8; t--) g.lineTo(xx + Math.sin(t * 0.7) * 2, t); g.stroke(); L([xx - 3, -5, xx, -9, xx + 3, -5]) } break }
      case 'porte': { g.beginPath(); if (g.roundRect) g.roundRect(-10, -20, 20, 40, 6); else g.rect(-10, -20, 20, 40); g.stroke(); L([-10, -4, -20, 6]); L([10, -4, 20, 6]); L([-6, -12, 6, -12]); break }
      case 'cintura': { g.beginPath(); g.arc(-2, -15, 5, 0, Math.PI * 2); g.fill(); L([-4, -8, -8, 6, 6, 6, 10, 18]); L([-8, 6, -12, 18]); L([-12, -6, 8, 8]); g.beginPath(); g.arc(9, 9, 3, 0, Math.PI * 2); g.fill(); break }
      case 'lavavetri': { g.beginPath(); g.moveTo(-22, 16); g.quadraticCurveTo(-24, -2, -18, -6); g.quadraticCurveTo(0, -10, 18, -6); g.quadraticCurveTo(24, -2, 22, 16); g.closePath(); g.stroke(); L([0, -10, 0, -18]); for (const a of [-1, -0.5, 0.5, 1]) L([a * 3, -20, a * 10, -26]); g.beginPath(); for (let t = -18; t <= 18; t++) g.lineTo(t, 8 + Math.sin(t * 0.5) * 2); g.stroke(); break }
      case 'chiave': { g.lineWidth = 4; L([-12, 12, 6, -6]); g.beginPath(); g.arc(10, -10, 7, Math.PI * 0.2, Math.PI * 1.5); g.stroke(); break }
    }
    g.restore();
  }

  /* fondo statico (plancia, cannocchiali, scale, etichette, simboli spenti) in una tela fuori schermo, rifatta solo se cambia la dimensione */
  const CACHE = { k: '', c: null };
  function sfondo(crea2d, w, h, redline) {
    const key = w + 'x' + h + ':' + redline; if (CACHE.k === key) return CACHE.c;
    const c = crea2d(w, h), g = c.getContext('2d'), s = Math.min(w / W, h / H);
    g.save(); g.translate((w - W * s) / 2, (h - H * s) / 2); g.scale(s, s);
    plancia(g);
    laterale(g, LAYOUT.temp, 'C', 'H', 'termometro', 0.8, 1);
    laterale(g, LAYOUT.carb, 'E', 'F', 'carburante', 0, 0.12);
    cannocchiale(g, LAYOUT.giri, { nMin: 40, maj: 1, med: 0.5, fs: 30, rNum: 46, unita: '×1000 giri/min', rosso: redline / 1000, arancio: (redline - 500) / 1000 });
    cannocchiale(g, LAYOUT.vel, { nMin: 140, maj: 20, med: 10, fs: 22, rNum: 44, cond: 0.82, unita: 'km/h' });
    quadranteKml(g);
    for (const id of ID_SPIE) { const p = LAYOUT.spie[id]; g.save(); g.globalAlpha = 0.07; simbolo(g, id, p.x, p.y, LAYOUT.dimSpia, '#a0a0a0', false); g.restore() }   // spie spente: appena visibili dietro il vetro fumé
    g.restore(); CACHE.k = key; CACHE.c = c; return c;
  }

  /* disegno completo. ctx: contesto 2D della tela visibile (w × h in pixel); crea2d(w,h): crea una tela fuori schermo */
  function disegna(ctx, M, crea2d) {
    const w = ctx.canvas.width, h = ctx.canvas.height, s = Math.min(w / W, h / H);
    crea2d = crea2d || ((a, b) => { if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(a, b); const c = document.createElement('canvas'); c.width = a; c.height = b; return c });
    ctx.clearRect(0, 0, w, h); ctx.drawImage(sfondo(crea2d, w, h, M ? M.redline : 4600), 0, 0);
    ctx.save(); ctx.translate((w - W * s) / 2, (h - H * s) / 2); ctx.scale(s, s);
    display(ctx, M);
    if (M) {
      for (const id of ID_SPIE) { const sp = M.spie[id]; if (sp && sp.accesa) { const p = LAYOUT.spie[id]; simbolo(ctx, id, p.x, p.y, LAYOUT.dimSpia, COL[p.c], true) } }
      const A = M.angoli, G = LAYOUT;
      lancetta(ctx, G.kml.cx, G.kml.cy, A.kml, G.kml.r - 6, 6, 2.6, 7);
      lancetta(ctx, G.temp.cx, G.temp.cy, A.temp, G.temp.r - 6, 10, 3.6, 10);
      lancetta(ctx, G.carb.cx, G.carb.cy, A.carb, G.carb.r - 6, 10, 3.6, 10);
      lancetta(ctx, G.giri.cx, G.giri.cy, A.giri, G.giri.r - 14, 30, 5.5, 16);
      lancetta(ctx, G.vel.cx, G.vel.cy, A.vel, G.vel.r - 14, 30, 5.5, 16);
    }
    vetro(ctx, LAYOUT.giri.cx, LAYOUT.giri.cy, LAYOUT.giri.r + 8); vetro(ctx, LAYOUT.vel.cx, LAYOUT.vel.cy, LAYOUT.vel.r + 8);
    ctx.restore();
  }
  /* punto (in pixel della tela w × h) di una coordinata di progetto: per i test e per i tocchi */
  function aPixel(w, h, x, y) { const s = Math.min(w / W, h / H); return [(w - W * s) / 2 + x * s, (h - H * s) / 2 + y * s] }

  return { versione: '1.1.0', W, H, LAYOUT, COL, ID_SPIE, crea, aggiorna, accesa, tempFrazione, kmlIstantaneo, angolo, creaComandi, premi, rilascia, passoComandi, disegna, simbolo, aPixel };
});
