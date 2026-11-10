/* ITALIA OPEN WORLD — Centralina della dinamica del veicolo: ABS, TCS (ASR), ESP, EBD a 200 Hz e blackout dopo un urto
   ======================================================================================================================
   Modulo puro (nessuna dipendenza): browser (window.IOW_CONTROLLO) e Node (module.exports). Lo usa motore/fisica_veicolo.js a ogni
   passo di 5 ms (200 Hz): riceve i «sensori» (velocità delle ruote, scorrimenti, carichi stimati, imbardata, sterzo) e restituisce le coppie
   frenanti per ruota e la riduzione della coppia motrice.

   REGOLATORI (tutti PID discreti a 200 Hz con derivata filtrata e anti-windup a integrazione condizionata)
   - ABS, uno per ruota: errore e = κ − κ*, con κ* = scorrimento di PICCO in frenata calcolato a ogni ciclo dalla Magic Formula combinata
     con il carico, la deriva e l'aderenza correnti della ruota (motore/pneumatici_mf.js → piccoKappa). Coppia comandata
     Tb = Tff + Kp·e + Ki·∫e + Kd·ė, con Tff = Re·|Fx,picco| (la coppia che la gomma può trasmettere al picco) e Tb ≤ coppia chiesta dal
     guidatore. Entra quando la ruota supera il picco (κ < κ*) e passa la richiesta del guidatore quando questa torna sotto il limite.
     Ogni ruota usa la propria velocità di avanzamento; sotto 1,5 m/s si spegne (come gli ABS reali sotto ~5 km/h).
   - TCS, uno per ruota motrice: errore e = κ − κ*,trazione. Riduce la coppia del motore (PID sulla ruota peggiore, con Tff = n·Re·|Fx,picco|
     della ruota con meno aderenza: con il differenziale aperto è lei a limitare la spinta) e frena la ruota che pattina più dell'altra
     (BTCS: con il differenziale aperto la coppia torna alla ruota che ha aderenza).
   - ESP: imbardata di riferimento r* = vx·δ / (L + Ku·vx²/g), limitata a 0,85·μ·g/vx; errore er = r* − r; momento correttivo
     Mz = Kp·er + Kd·ėr (zona morta 0,04 rad/s, o deriva β oltre 7°); applicato frenando una ruota (anteriore dello stesso lato + 30 % alla
     posteriore): ΔTb = |Mz| / (carreggiata/2) · Re. Durante l'intervento la coppia motrice si riduce.
   - EBD: la coppia frenante di ogni ruota posteriore non supera 0,75·μ·Fz·Re (il retrotreno scaricato in frenata non deve bloccarsi).
     È una funzione del modulo ABS: con l'ABS disattivato (guasto, spia accesa) manca anche l'EBD.
   Ordine: TCS → ESP → EBD → ABS (l'ABS lavora sulla coppia finale, anche su quella aggiunta dall'ESP), come nelle centraline reali.

   BLACKOUT
   urto(c, gPicco): se l'accelerazione di picco dell'urto supera la soglia (15 g) la centralina va in BLACKOUT: ABS, TCS, ESP ed EBD
   spenti. Le coppie frenanti arrivano alle ruote così come le chiede il pedale (impianto idraulico senza modulatore): appena superano
   ciò che la gomma può trasmettere la ruota si ferma e resta ferma (bloccaggio geometrico: ω = 0, κ = −1 esatto, gestito da
   fisica_veicolo.js). Il blackout resta fino a riavvia() (officina).

   Limiti dichiarati: la velocità di riferimento del veicolo è quella vera (nelle centraline reali è stimata da ruote e accelerometro);
   i guadagni sono tarati sul modello del gioco, non su un veicolo reale. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.IOW_CONTROLLO = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const G = 9.80665;
  const cl = (v, a, b) => v < a ? a : v > b ? b : v;

  /* PID discreto: derivata filtrata (primo ordine, τd), anti-windup a integrazione condizionata */
  function pid(kp, ki, kd, td) { return { kp, ki, kd, td: td || 0.01, i: 0, e0: 0, d: 0, u: 0, primo: true } }
  function pidReset(p, uIniz) { p.i = uIniz || 0; p.e0 = 0; p.d = 0; p.u = uIniz || 0; p.primo = true }
  /* ff: termine in avanti; lo..hi: limiti dell'uscita. Restituisce u = ff + Kp·e + I + Kd·ė */
  function pidPasso(p, e, dt, ff, lo, hi) {
    const de = p.primo ? 0 : (e - p.e0) / dt; p.primo = false; p.e0 = e;
    p.d += (de - p.d) * Math.min(1, dt / p.td);
    const iNuovo = p.i + p.ki * e * dt;
    let u = ff + p.kp * e + iNuovo + p.kd * p.d;
    if (u > hi) { u = hi; if (e < 0) p.i = iNuovo } else if (u < lo) { u = lo; if (e > 0) p.i = iNuovo } else p.i = iNuovo;   // integra solo se non spinge oltre il limite
    p.u = u; return u;
  }

  function crea(opz) {
    opz = opz || {};
    const c = {
      stato: 'OPERATIVA', sogliaG: opz.sogliaG || 15, t: 0, ultimoUrtoG: 0, urtoMaxG: 0,
      ku: opz.ku !== undefined ? opz.ku : 0.0025,                                         // gradiente di sottosterzo di riferimento [rad/(m/s²)]
      abs: { pid: [0, 1, 2, 3].map(() => pid(9000, 90000, 40, 0.008)), attivo: [false, false, false, false], sotto: [0, 0, 0, 0], kTarget: [0, 0, 0, 0], Tb: [0, 0, 0, 0], cicli: 0 },
      tcs: { pid: pid(2500, 40000, 15, 0.01), pidB: [0, 1, 2, 3].map(() => pid(5000, 30000, 0, 0.01)), attivo: false, libero: 0, taglio: 0, Tlim: Infinity, Tb: [0, 0, 0, 0], kTarget: [0, 0, 0, 0] },
      esp: { kp: 9000, kd: 300, er0: 0, der: 0, Mz: 0, attivo: false, rDes: 0, beta: 0, taglio: 0 },
      ebd: { attivo: false },
      uscita: { Tb: [0, 0, 0, 0], taglioMotore: 0 },
      log: [], stat: { cicliABS: 0, tempoABS: 0, tempoTCS: 0, tempoESP: 0, interventiESP: 0 },
    };
    return c;
  }
  function nota(c, msg) { c.log.push({ t: +c.t.toFixed(3), msg }); if (c.log.length > 60) c.log.splice(0, 20) }

  /* urto letto dalla carrozzeria (fisica dei corpi morbidi del gioco): gPicco in g */
  function urto(c, gPicco, info) {
    if (!(gPicco >= 0)) return false;
    c.ultimoUrtoG = gPicco; c.urtoMaxG = Math.max(c.urtoMaxG, gPicco);
    if (gPicco > c.sogliaG && c.stato === 'OPERATIVA') {
      c.stato = 'BLACKOUT';
      for (let i = 0; i < 4; i++) { c.abs.attivo[i] = false; pidReset(c.abs.pid[i], 0) }
      c.tcs.attivo = false; c.tcs.taglio = 0; c.esp.attivo = false; c.esp.Mz = 0;
      nota(c, '[CENTRALINA KO] urto di ' + gPicco.toFixed(1) + ' g oltre ' + c.sogliaG + ' g' + (info && info.dove ? ' (' + info.dove + ')' : '') + ': ABS, TCS, ESP ed EBD disattivati — controllo puramente meccanico');
      return true;
    }
    if (c.stato === 'OPERATIVA') nota(c, '[CENTRALINA OK] urto di ' + gPicco.toFixed(1) + ' g sotto la soglia di ' + c.sogliaG + ' g');
    return false;
  }
  function riavvia(c) { if (c.stato !== 'OPERATIVA') { c.stato = 'OPERATIVA'; nota(c, 'centralina sostituita: ABS, TCS, ESP ed EBD di nuovo attivi') } }

  /* un ciclo di controllo (5 ms).
     s = { vx, r, delta, mu (aderenza media), L, w (carreggiata ant.), Re, n (ruote motrici: indici), kappa[4], Fz[4], muR[4],
           kPiccoF[4], FxPiccoF[4] (frenata, Fx < 0), kPiccoT[4], FxPiccoT[4] (trazione), TbRich[4] (coppie chieste dal pedale),
           TmotRich (coppia motrice totale alle ruote chiesta), abilita: { abs, tcs, esp } }
     Uscita: c.uscita = { Tb[4], taglioMotore 0..1 } */
  function passo(c, dt, s) {
    c.t += dt;
    const out = c.uscita, Tb = out.Tb;
    for (let i = 0; i < 4; i++) Tb[i] = Math.max(0, s.TbRich[i] || 0);
    out.taglioMotore = 0;
    if (c.stato !== 'OPERATIVA') { c.esp.attivo = false; c.tcs.attivo = false; c.ebd.attivo = false; for (let i = 0; i < 4; i++) c.abs.attivo[i] = false; return out }   // blackout: idraulica grezza
    const ab = s.abilita || { abs: true, tcs: true, esp: true }, vx = s.vx, vabs = Math.abs(vx), Re = s.Re;
    const avanti = vx >= 0 ? 1 : -1;                                      // in retromarcia gli scorrimenti si leggono rispetto al verso del moto
    /* ---------------- TCS ---------------- */
    const T = c.tcs; let taglio = 0;
    for (let i = 0; i < 4; i++) T.Tb[i] = 0;
    if (ab.tcs && s.TmotRich * avanti > 50 && vabs < 70) {
      let peggio = -1, ePeg = -9, FminPicco = Infinity;
      for (const i of s.n) { const k = s.kappa[i] * avanti, kt = Math.max(0.04, s.kPiccoT[i]); T.kTarget[i] = kt; const e = k - kt; if (e > ePeg) { ePeg = e; peggio = i } FminPicco = Math.min(FminPicco, Math.abs(s.FxPiccoT[i])) }
      if (!T.attivo && ePeg > 0) { T.attivo = true; pidReset(T.pid, 0); T.libero = 0 }
      if (T.attivo) {
        const richiesta = Math.abs(s.TmotRich), ff = s.n.length * Re * FminPicco;
        const lim = pidPasso(T.pid, -ePeg, dt, ff, 0, richiesta * 1.2);   // e > 0 (pattina) → meno coppia
        T.Tlim = lim; taglio = cl(1 - lim / Math.max(1, richiesta), 0, 0.95);
        if (ePeg < -0.02 && lim >= richiesta) { T.libero += dt; if (T.libero > 0.25) { T.attivo = false; T.Tlim = Infinity } } else T.libero = 0;
        // BTCS: frena la ruota motrice che pattina più dell'altra (differenziale aperto)
        if (s.n.length === 2 || s.n.length === 4) {
          for (let q = 0; q < s.n.length; q += 2) {
            const a = s.n[q], b = s.n[q + 1], ea = s.kappa[a] * avanti - T.kTarget[a], eb = s.kappa[b] * avanti - T.kTarget[b], d = ea - eb;
            const iPat = d > 0 ? a : b, diff = Math.abs(d);
            if (diff > 0.04 && Math.max(ea, eb) > 0) T.Tb[iPat] = pidPasso(T.pidB[iPat], diff - 0.04, dt, 0, 0, 1500); else pidReset(T.pidB[iPat], 0);
          }
        }
        c.stat.tempoTCS += dt;
      }
    } else { if (T.attivo) { T.attivo = false; T.Tlim = Infinity } }
    T.taglio = taglio;
    /* ---------------- ESP ---------------- */
    const E = c.esp; E.Mz = 0; E.taglio = 0;
    if (ab.esp && vx > 5) {                                           // in retromarcia l'ESP non interviene
      const rd0 = vx / (s.L + c.ku * vx * vx / G) * s.delta, rlim = 0.85 * Math.max(0.1, s.mu) * G / Math.max(vabs, 1);
      E.rDes = cl(rd0, -rlim, rlim);
      E.beta = Math.atan2(s.vy || 0, Math.max(vabs, 0.1));
      const er = E.rDes - s.r, der = (er - E.er0) / dt; E.er0 = er; E.der += (der - E.der) * Math.min(1, dt / 0.02);
      const fuori = Math.abs(er) > 0.04 || Math.abs(E.beta) > 0.122;
      if (fuori) {
        let Mz = E.kp * er + E.kd * E.der;
        if (Math.abs(E.beta) > 0.122) Mz += Math.sign(E.beta) * 6000 * (Math.abs(E.beta) - 0.122);   // deriva eccessiva (β > 0: la velocità punta a sinistra del muso) → momento che porta il muso verso la velocità
        Mz = cl(Mz, -12000, 12000); E.Mz = Mz;
        const dT = Math.abs(Mz) / (s.w / 2) * Re, sx = Mz > 0 ? 0 : 1;   // Mz > 0 (serve imbardata a sinistra) → freni a sinistra (0 ant. sin., 2 post. sin.)
        Tb[sx] += dT * 0.7; Tb[sx + 2] += dT * 0.3;
        E.taglio = cl(Math.abs(Mz) / 6000, 0.2, 0.9);
        if (!E.attivo) { E.attivo = true; c.stat.interventiESP++ }
        c.stat.tempoESP += dt;
      } else E.attivo = false;
    } else { E.attivo = false; E.er0 = 0; E.der = 0 }
    for (let i = 0; i < 4; i++) Tb[i] += T.Tb[i];
    out.taglioMotore = Math.max(taglio, E.taglio);
    /* ---------------- EBD ---------------- */
    c.ebd.attivo = false;
    if (ab.abs) for (const i of [2, 3]) { const lim = 0.75 * Math.max(0.05, s.muR[i]) * s.Fz[i] * Re; if (Tb[i] > lim && (s.TbRich[i] || 0) > 0) { Tb[i] = lim; c.ebd.attivo = true } }
    /* ---------------- ABS (sulla coppia finale) ---------------- */
    const A = c.abs; let inABS = false;
    for (let i = 0; i < 4; i++) {
      // ogni ruota con la sua velocità di avanzamento (nel testacoda le ruote non vanno tutte nello stesso verso)
      const ur = s.uxw ? s.uxw[i] : vx, k = s.kappa[i] * (ur >= 0 ? 1 : -1), kt = Math.min(-0.03, s.kPiccoF[i]), Tff = Re * Math.abs(s.FxPiccoF[i]), Treq = Tb[i];
      A.kTarget[i] = kt;
      if (!ab.abs || Math.abs(ur) < 1.5 || Treq <= 0) { if (A.attivo[i]) { A.attivo[i] = false } continue }
      if (!A.attivo[i] && k < kt) { A.attivo[i] = true; pidReset(A.pid[i], 0); A.sotto[i] = 0; A.cicli++; c.stat.cicliABS++ }
      if (A.attivo[i]) {
        const u = pidPasso(A.pid[i], k - kt, dt, Tff, 0, Treq);           // e < 0: la ruota scivola oltre il picco → meno coppia
        Tb[i] = u; inABS = true;
        if (u >= Treq * 0.999 && k > kt * 0.5) { A.sotto[i] += dt; if (A.sotto[i] > 0.08) A.attivo[i] = false } else A.sotto[i] = 0;
      }
      A.Tb[i] = Tb[i];
    }
    if (inABS) c.stat.tempoABS += dt;
    return out;
  }

  /* accelerazione di picco [g] di un urto, dal registro del Vehicle Damage Solver (o da una stima se mancano i dati).
     u = { J impulso sull'auto [N·s] | dv [m/s], massa [kg], vn velocità d'avvicinamento [m/s], durata [s] | schiacciamento [m] | Eown [J] }
     Impulso a semi-seno: a_picco = (π/2) · Δv / durata. Senza durata: schiacciamento s = √(E/k) con rigidezza di carrozzeria k ≈ 1 MN/m
     (ordine di grandezza delle prove frontali), durata = 2·s / vn. */
  function piccoG(u) {
    const m = u.massa > 0 ? u.massa : 1500, vn = Math.max(0, +u.vn || 0);
    const dv = Number.isFinite(u.dv) ? Math.abs(u.dv) : Number.isFinite(u.J) ? Math.abs(u.J) / m : vn * 1.1;
    let dur = Number.isFinite(u.durata) && u.durata > 0 ? u.durata : null;
    if (dur === null) {
      const E = Number.isFinite(u.Eown) && u.Eown > 0 ? u.Eown : 0.5 * m * vn * vn, s = Number.isFinite(u.schiacciamento) && u.schiacciamento > 0 ? u.schiacciamento : Math.sqrt(E / 1.0e6);
      dur = vn > 0.1 ? 2 * Math.max(0.02, s) / vn : 0.1;
    }
    dur = cl(dur, 0.025, 0.25);
    return Math.PI / 2 * dv / dur / G;
  }

  return { versione: '1.0.0', crea, passo, urto, riavvia, piccoG, pid, pidPasso, pidReset };
});
