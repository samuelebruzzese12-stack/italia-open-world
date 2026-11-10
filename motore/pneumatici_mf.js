/* ITALIA OPEN WORLD — Pneumatici: Magic Formula di Pacejka a scorrimento combinato (struttura MF 5.2)
   ==================================================================================================
   Modulo puro (nessuna dipendenza): gira nel browser (window.IOW_PNEUMATICI) e in Node (module.exports).

   COSA CALCOLA (unità SI: N, N·m, m, rad; scorrimento longitudinale κ adimensionale)
   Per una ruota con carico verticale Fz, scorrimento longitudinale κ e angolo di deriva α:
   - forza longitudinale pura   Fx0(κ)  = Dx·sin(Cx·atan(Bx·κx − Ex·(Bx·κx − atan(Bx·κx)))) + SVx
   - forza laterale pura        Fy0(α)  = Dy·sin(Cy·atan(By·αy − Ey·(By·αy − atan(By·αy)))) + SVy
   - scorrimento combinato (funzioni peso coseno della MF 5.2):
        Fx = Gxα(α, κ, Fz) · Fx0          Gxα = cos(Cxα·atan(Bxα·αS − Exα·(Bxα·αS − atan(Bxα·αS)))) / (stessa con αS = SHxα)
        Fy = Gyκ(κ, α, Fz) · Fy0 + SVyκ   Gyκ = cos(Cyκ·atan(Byκ·κS − Eyκ·(Byκ·κS − atan(Byκ·κS)))) / (stessa con κS = SHyκ)
     con Bxα = RBX1·cos(atan(RBX2·κ)), Byκ = RBY1·cos(atan(RBY2·(α − RBY3))): la forza longitudinale cala quando la gomma deriva
     e la forza laterale cala quando la gomma frena o pattina, come nel «cerchio d'aderenza» ma con la forma misurata dei pneumatici;
   - momento autoallineante Mz = −t·Fy,α + Mzr + s·Fx (scia pneumatica t a coseno, momento residuo Mzr) nella forma della MF 5.2;
   - sensibilità al carico: dfz = (Fz − Fz0)/Fz0; il coefficiente d'attrito cala con il carico (PDX2, PDY2), la rigidezza di deriva
     satura (PKY1·Fz0·sin(2·atan(Fz/(PKY2·Fz0)))), la rigidezza longitudinale cresce con il carico (PKX1..PKX3);
   - fattori di scala λ della MF (LMUX, LMUY, LKX, LKY…): con questi il motore fisico porta dentro la formula superficie, pressione,
     temperatura, usura, aquaplaning e danni della ruota (il coefficiente d'attrito di picco del veicolo diventa il D della formula);
   - lunghezza di rilassamento laterale σα = Kyα / Cy,carcassa (modello a deflessione del primo ordine, usato dal motore fisico);
   - scorrimento di picco: il κ che dà la massima |Fx| alle condizioni correnti (Fz, α, superficie), con ricerca a sezione aurea sulla
     formula COMBINATA. È il valore di riferimento dei regolatori PID di ABS e TCS («zona di massimo grip»).

   CONVENZIONI
   κ = (ω·Re − Vx) / max(|Vx|, |ω·Re|, vMin): −1 = ruota bloccata che striscia, 0 = rotolamento puro, > 0 = trazione.
   α > 0 quando la velocità del centro ruota è rivolta a destra della ruota (asse y della ruota verso sinistra): α > 0 → Fy > 0.
   Fx > 0 spinge in avanti. Mz > 0 ruota la ruota verso sinistra (attorno all'asse verticale verso l'alto).

   COEFFICIENTI (dichiarato)
   Il set predefinito ha la struttura e l'ordine di grandezza del pneumatico d'esempio MF 5.2 della letteratura (205/60 R15,
   carico nominale 4000 N, come riportato nei testi sulla Magic Formula). I valori sono scritti a memoria e NON ricontrollati sul testo,
   portati nella convenzione dei segni di questo modulo, con le asimmetrie (conicità, sterzo da tele, campanatura) azzerate: l'auto del
   gioco è simmetrica. Ritoccati (dichiarato) PEX1 0,344→0,60, PCY1 1,193→1,50, PEY1 −1,003→−0,60, PEY2 −0,537→0, PKY1 14,95→21: con i valori
   d'origine la forza laterale aveva il picco a ~15° di deriva; ora picco a ~8°, rigidezza di deriva ~1250 N/grado a 4,7 kN e strisciamento
   a ruota bloccata ~0,72 del picco, ordini di grandezza tipici di un pneumatico stradale estivo (verifica in test/pneumatici_dinamica.js);
   RBX1 12,35→15 e RBY1 6,46→8 perché con i valori d'origine la forza combinata usciva del 7 % dall'ellisse d'aderenza (ora ≤ 0,3 %);
   QEZ4 0,174→0 (asimmetria del momento autoallineante). NON sono i dati del 215/55 R16 dell'Alfa 159: sono un pneumatico stradale generico, e il motore fisico ne scala il
   coefficiente d'attrito con il μ del veicolo (motore/veicoli_db.js). Nessun valore è validato su misure al banco. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.IOW_PNEUMATICI = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const atan = Math.atan, sin = Math.sin, cos = Math.cos, abs = Math.abs;
  const sgn = x => x > 0 ? 1 : x < 0 ? -1 : 0;

  /* ------------------------------------------------------------------ set di coefficienti predefinito (vedi nota in testa) */
  const MF52_GENERICO = Object.freeze({
    nome: 'MF 5.2 generico (struttura del pneumatico d\'esempio 205/60 R15 della letteratura, simmetrizzato)',
    stato: 'provvisorio — coefficienti di letteratura scritti a memoria, non ricontrollati; non sono dati del pneumatico dell\'Alfa 159',
    FNOMIN: 4000, R0: 0.3215,
    // longitudinale pura
    PCX1: 1.65, PDX1: 1.21, PDX2: -0.037, PDX3: 0, PEX1: 0.60, PEX2: 0.095, PEX3: -0.020, PEX4: 0,
    PKX1: 21.51, PKX2: -0.163, PKX3: 0.245, PHX1: 0, PHX2: 0, PVX1: 0, PVX2: 0,
    // laterale pura (convenzione: coefficienti positivi, α > 0 → Fy > 0)
    PCY1: 1.50, PDY1: 0.990, PDY2: -0.145, PDY3: 0, PEY1: -0.60, PEY2: 0, PEY3: 0, PEY4: 0,
    PKY1: 21.0, PKY2: 2.130, PKY3: 0, PHY1: 0, PHY2: 0, PHY3: 0, PVY1: 0, PVY2: 0, PVY3: 0, PVY4: 0,
    // combinato
    RBX1: 15.0, RBX2: -10.77, RCX1: 1.092, REX1: 0, REX2: 0, RHX1: 0,
    RBY1: 8.0, RBY2: 4.196, RBY3: 0, RCY1: 1.081, REY1: 0, REY2: 0, RHY1: 0, RHY2: 0,
    RVY1: 0, RVY2: 0, RVY3: 0, RVY4: 35.44, RVY5: 1.9, RVY6: -10.71,
    // momento autoallineante
    QBZ1: 8.964, QBZ2: -1.106, QBZ3: -0.842, QBZ9: 18.47, QBZ10: 0, QCZ1: 1.180, QDZ1: 0.100, QDZ2: -0.001, QDZ6: 0, QDZ7: 0, QDZ8: 0, QDZ9: 0,
    QEZ1: -1.609, QEZ2: 0.359, QEZ3: 0, QEZ4: 0, QEZ5: 0, QHZ1: 0, QHZ2: 0, SSZ1: 0, SSZ2: 0, SSZ3: 0, SSZ4: 0,
    // carcassa: rigidezza laterale per la lunghezza di rilassamento [N/m]
    CY_CARCASSA: 1.6e5, CX_CARCASSA: 4.0e5,
  });

  /* fattori di scala λ (1 = pneumatico del set). Il motore fisico imposta LMUX/LMUY per superficie e stato della gomma. */
  function scalaNeutra() { return { LFZO: 1, LMUX: 1, LMUY: 1, LKX: 1, LKY: 1, LCX: 1, LCY: 1, LEX: 1, LEY: 1, LXAL: 1, LYKA: 1, LVYKA: 1, LT: 1, LMR: 1, LS: 1 } }

  /* parte comune della formula: y = D·sin(C·atan(B·x − E·(B·x − atan(B·x)))) */
  const mf = (B, C, D, E, x) => { const Bx = B * x; return D * sin(C * atan(Bx - E * (Bx - atan(Bx)))) };
  const pesoCos = (B, C, E, x) => { const Bx = B * x; return cos(C * atan(Bx - E * (Bx - atan(Bx)))) };

  /* ------------------------------------------------------------------ forze della gomma (risultato in un oggetto riusabile per non creare spazzatura a 200 Hz)
     p: coefficienti, Fz [N] ≥ 0, k: κ, a: α [rad] (si usa tan α come nella MF), L: scale λ (facoltative), out: oggetto di uscita facoltativo */
  function forze(p, Fz, k, a, L, out) {
    out = out || {};
    L = L || NEUTRA;
    if (!(Fz > 0)) { out.Fx = out.Fy = out.Mz = out.Fx0 = out.Fy0 = 0; out.Gxa = out.Gyk = 1; out.mux = out.muy = 0; out.Kxk = out.Kya = 0; return out }
    const Fz0 = p.FNOMIN * L.LFZO, dfz = (Fz - Fz0) / Fz0;
    const ta = Math.tan(Math.max(-1.45, Math.min(1.45, a)));       // α* = tan α (limitato a ±83°: oltre la gomma striscia di traverso)
    /* --- longitudinale pura --- */
    const SHx = (p.PHX1 + p.PHX2 * dfz), kx = k + SHx;
    const Cx = p.PCX1 * L.LCX;
    const mux = (p.PDX1 + p.PDX2 * dfz) * L.LMUX;
    const Dx = mux * Fz;
    let Ex = (p.PEX1 + p.PEX2 * dfz + p.PEX3 * dfz * dfz) * (1 - p.PEX4 * sgn(kx)) * L.LEX; if (Ex > 1) Ex = 1;
    const Kxk = Fz * (p.PKX1 + p.PKX2 * dfz) * Math.exp(p.PKX3 * dfz) * L.LKX;
    const Bx = Kxk / (Cx * Dx + 1e-9);
    const SVx = Fz * (p.PVX1 + p.PVX2 * dfz) * L.LMUX;
    const Fx0 = mf(Bx, Cx, Dx, Ex, kx) + SVx;
    /* --- laterale pura --- */
    const SHy = (p.PHY1 + p.PHY2 * dfz), ay = ta + SHy;
    const Cy = p.PCY1 * L.LCY;
    const muy = (p.PDY1 + p.PDY2 * dfz) * L.LMUY;
    const Dy = muy * Fz;
    let Ey = (p.PEY1 + p.PEY2 * dfz) * (1 - p.PEY3 * sgn(ay)) * L.LEY; if (Ey > 1) Ey = 1;
    const Kya = p.PKY1 * Fz0 * sin(2 * atan(Fz / (p.PKY2 * Fz0))) * L.LKY;
    const By = Kya / (Cy * Dy + 1e-9);
    const SVy = Fz * (p.PVY1 + p.PVY2 * dfz) * L.LMUY;
    const Fy0 = mf(By, Cy, Dy, Ey, ay) + SVy;
    /* --- scorrimento combinato --- */
    const Bxa = p.RBX1 * cos(atan(p.RBX2 * k)) * L.LXAL, Cxa = p.RCX1, Exa = Math.min(1, p.REX1 + p.REX2 * dfz), SHxa = p.RHX1;
    const Gxa = pesoCos(Bxa, Cxa, Exa, ta + SHxa) / pesoCos(Bxa, Cxa, Exa, SHxa);
    const Byk = p.RBY1 * cos(atan(p.RBY2 * (ta - p.RBY3))) * L.LYKA, Cyk = p.RCY1, Eyk = Math.min(1, p.REY1 + p.REY2 * dfz), SHyk = p.RHY1 + p.RHY2 * dfz;
    const Gyk = pesoCos(Byk, Cyk, Eyk, k + SHyk) / pesoCos(Byk, Cyk, Eyk, SHyk);
    const DVyk = muy * Fz * (p.RVY1 + p.RVY2 * dfz) * cos(atan(p.RVY4 * ta));
    const SVyk = DVyk * sin(p.RVY5 * atan(p.RVY6 * k)) * L.LVYKA;
    const Fx = Gxa * Fx0, Fy = Gyk * Fy0 + SVyk;
    /* --- momento autoallineante (MF 5.2, senza campanatura): scia pneumatica t(αt) e momento residuo Mzr(αr), braccio s per Fx --- */
    const R0 = p.R0, at = ta, ar = ta + SHy + SVy / (Kya + 1e-9);
    const Bt = (p.QBZ1 + p.QBZ2 * dfz + p.QBZ3 * dfz * dfz) * L.LKY / L.LMUY, Ct = p.QCZ1, Dt = Fz * (p.QDZ1 + p.QDZ2 * dfz) * (R0 / Fz0) * L.LT;
    const Et = Math.min(1, (p.QEZ1 + p.QEZ2 * dfz + p.QEZ3 * dfz * dfz) * (1 + (p.QEZ4 + p.QEZ5 * 0) * (2 / Math.PI) * atan(Bt * Ct * at)));
    // scorrimento equivalente per il combinato: αt,eq = √(αt² + (Kxκ/Kyα)²·κ²)·sgn(αt)
    const rk = Kxk / (Kya + 1e-9), ateq = Math.sqrt(at * at + rk * rk * k * k) * (at >= 0 ? 1 : -1), areq = Math.sqrt(ar * ar + rk * rk * k * k) * (ar >= 0 ? 1 : -1);
    const t = Dt * cos(Ct * atan(Bt * ateq - Et * (Bt * ateq - atan(Bt * ateq)))) * cos(a);
    const Br = p.QBZ9 * L.LKY / L.LMUY + p.QBZ10 * By * Cy, Dr = Fz * R0 * (p.QDZ6 + p.QDZ7 * dfz) * L.LMR * cos(a);
    const Mzr = Dr * cos(atan(Br * areq));
    const s = R0 * (p.SSZ1 + p.SSZ2 * (Fy / Fz0) + (p.SSZ3 + p.SSZ4 * dfz) * 0) * L.LS;
    const Fyp = Fy - SVyk;                                               // Fy' senza la parte indotta dallo scorrimento longitudinale
    out.Fx = Fx; out.Fy = Fy; out.Mz = -t * Fyp + Mzr + s * Fx; out.scia = t;
    out.Fx0 = Fx0; out.Fy0 = Fy0; out.Gxa = Gxa; out.Gyk = Gyk; out.mux = mux; out.muy = muy; out.Kxk = Kxk; out.Kya = Kya;
    return out;
  }
  const NEUTRA = Object.freeze(scalaNeutra());

  /* rigidezze a scorrimento nullo (per lunghezze di rilassamento e linearizzazioni) */
  function rigidezze(p, Fz, L) { const o = forze(p, Math.max(1, Fz), 0, 0, L); return { Kxk: o.Kxk, Kya: o.Kya } }
  /* lunghezza di rilassamento laterale σα = Kyα / Cy,carcassa [m] (con un minimo di 0,12 m) */
  function rilassamentoLaterale(p, Fz, L) { const K = rigidezze(p, Fz, L).Kya; return Math.max(0.12, K / p.CY_CARCASSA) }

  /* ------------------------------------------------------------------ scorrimento di picco con la formula combinata
     verso +1 (trazione) o −1 (frenata). Ricerca a sezione aurea su |Fx(κ)| in [0, 0,6]·verso. Restituisce { kappa, Fx, mu }. */
  const OUTP = {};
  function piccoKappa(p, Fz, a, L, verso, vicino, out) {
    verso = verso < 0 ? -1 : 1; out = out || {};
    if (!(Fz > 0)) { out.kappa = 0.12 * verso; out.Fx = 0; out.mu = 0; return out }
    const f = x => abs(forze(p, Fz, x * verso, a, L, OUTP).Fx);
    // con un valore vicino (il picco del ciclo precedente: carico e deriva cambiano poco in 5 ms) basta cercare in [0,6·κ, 1,6·κ]
    let lo = 0.005, hi = 0.6, it = 22;
    if (vicino && abs(vicino) > 0.01 && abs(vicino) < 0.5) { lo = abs(vicino) * 0.6; hi = abs(vicino) * 1.6; it = 15 }
    const g = 0.6180339887;
    let x1 = hi - g * (hi - lo), x2 = lo + g * (hi - lo), f1 = f(x1), f2 = f(x2);
    for (let i = 0; i < it; i++) {
      if (f1 > f2) { hi = x2; x2 = x1; f2 = f1; x1 = hi - g * (hi - lo); f1 = f(x1) }
      else { lo = x1; x1 = x2; f1 = f2; x2 = lo + g * (hi - lo); f2 = f(x2) }
    }
    const k = (lo + hi) / 2, F = f(k);
    out.kappa = k * verso; out.Fx = F * verso; out.mu = F / Fz; return out;
  }
  /* angolo di deriva di picco (forza laterale pura massima) */
  function piccoAlfa(p, Fz, L) {
    let best = 0, Fb = 0;
    for (let d = 0.5; d <= 25; d += 0.25) { const a = d * Math.PI / 180, F = forze(p, Fz, 0, a, L, OUTP).Fy; if (F > Fb) { Fb = F; best = a } }
    return { alfa: best, Fy: Fb, mu: Fb / Fz };
  }

  /* curve campionate (per documentazione, pannello e test) */
  function curve(p, Fz, L) {
    const kx = [], ay = [], comb = [];
    for (let i = -100; i <= 100; i += 2) { const k = i / 100, o = forze(p, Fz, k, 0, L); kx.push([k, o.Fx]) }
    for (let d = -20; d <= 20; d += 0.5) { const a = d * Math.PI / 180, o = forze(p, Fz, 0, a, L); ay.push([d, o.Fy, o.Mz]) }
    for (const d of [0, 2, 4, 8]) for (let i = -40; i <= 40; i += 2) { const o = forze(p, Fz, i / 100, d * Math.PI / 180, L); comb.push([d, i / 100, o.Fx, o.Fy]) }
    return { kx, ay, comb };
  }

  return { versione: '1.0.0', MF52_GENERICO, scalaNeutra, forze, rigidezze, rilassamentoLaterale, piccoKappa, piccoAlfa, curve };
});
