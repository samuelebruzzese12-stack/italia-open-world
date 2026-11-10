/* ITALIA OPEN WORLD — test della Magic Formula combinata, della dinamica a 7 gradi di libertà a 200 Hz e della centralina (ABS, TCS, ESP,
   EBD, blackout oltre 15 g). Richiamato da test/run.js (stessi contatori); si può anche eseguire da solo: node test/pneumatici_dinamica.js */
'use strict';
const path = require('path');
module.exports = function (T) {
  const { test, ok, vicino } = T;
  const F = require(path.join(__dirname, '..', 'motore', 'fisica_veicolo.js'));
  const E = require(path.join(__dirname, '..', 'motore', 'ecu.js'));
  const MF = require(path.join(__dirname, '..', 'motore', 'pneumatici_mf.js'));
  const CTL = require(path.join(__dirname, '..', 'motore', 'controllo_dinamica.js'));
  const P = F.DB.parametri('alfa_159_19_jtdm_150');
  const TP = MF.MF52_GENERICO, D2R = Math.PI / 180;
  const scala = mu => { const L = MF.scalaNeutra(); L.LMUX = mu / TP.PDX1; L.LMUY = mu / TP.PDY1; return L };
  const nuovo = o => { const v = F.crea(P, Object.assign({ Tambiente: 20, carburante: 30 }, o || {})); v.motore.Tacqua = 90; v.motore.Tolio = 95; return v };
  const fin = v => [v.v, v.vy, v.r, ...v.dyn.om, ...v.dyn.Fx, ...v.dyn.Fy, ...v.dyn.Fz, v.motore.rpm].every(Number.isFinite);

  /* ---------------- Magic Formula ---------------- */
  test('MF: forma longitudinale pura (picco a κ 0,08–0,20, μ di picco = scala, ruota bloccata 0,6–0,85 del picco, antisimmetrica)', () => {
    const L = scala(1.0), Fz = 4000, pk = MF.piccoKappa(TP, Fz, 0, L, -1);
    ok(pk.kappa < -0.08 && pk.kappa > -0.2, 'κ di picco ' + pk.kappa); vicino(pk.mu, 1.0, 0.02, 'μ di picco al carico nominale');
    const lock = Math.abs(MF.forze(TP, Fz, -1, 0, L).Fx) / Math.abs(pk.Fx); ok(lock > 0.6 && lock < 0.85, 'strisciamento/picco ' + lock.toFixed(3));
    for (const k of [0.02, 0.1, 0.3, 1]) vicino(MF.forze(TP, Fz, k, 0, L).Fx, -MF.forze(TP, Fz, -k, 0, L).Fx, 1e-6, 'antisimmetria κ=' + k);
    ok(MF.forze(TP, Fz, 0, 0, L).Fx === 0 && MF.forze(TP, Fz, 0, 0, L).Fy === 0, 'nessuna forza a scorrimento nullo (asimmetrie azzerate)');
  });
  test('MF: forma laterale pura (picco a 6–11°, rigidezza di deriva 900–1600 N/grado a 4,7 kN, momento autoallineante che riallinea)', () => {
    const L = scala(1.0), pa = MF.piccoAlfa(TP, 4740, L), K = MF.rigidezze(TP, 4740, L).Kya * D2R;
    ok(pa.alfa > 6 * D2R && pa.alfa < 11 * D2R, 'α di picco ' + (pa.alfa / D2R).toFixed(1)); ok(K > 900 && K < 1600, 'rigidezza ' + K.toFixed(0));
    for (const d of [1, 4, 12]) { const a = MF.forze(TP, 4740, 0, d * D2R, L), b = MF.forze(TP, 4740, 0, -d * D2R, L); vicino(a.Fy, -b.Fy, 1e-6); vicino(a.Mz, -b.Mz, 1e-6); ok(a.Fy > 0 && a.Mz < 0, 'α > 0 → Fy > 0 e Mz che riporta la ruota verso la velocità') }
  });
  test('MF: scorrimento combinato (G = 1 senza l\'altro scorrimento, Fx cala con la deriva, Fy cala con la frenata, |F| ≤ 1,01·μ·Fz ovunque)', () => {
    const L = scala(1.0), Fz = 4500;
    vicino(MF.forze(TP, Fz, -0.1, 0, L).Gxa, 1, 1e-9); vicino(MF.forze(TP, Fz, 0, 5 * D2R, L).Gyk, 1, 1e-9);
    ok(Math.abs(MF.forze(TP, Fz, -0.1, 6 * D2R, L).Fx) < Math.abs(MF.forze(TP, Fz, -0.1, 0, L).Fx) * 0.85, 'la deriva riduce Fx');
    ok(MF.forze(TP, Fz, -0.2, 6 * D2R, L).Fy < MF.forze(TP, Fz, 0, 6 * D2R, L).Fy * 0.75, 'la frenata riduce Fy');
    let mx = 0; for (let k = -1; k <= 1.0001; k += 0.02) for (let d = -30; d <= 30; d += 1) { const o = MF.forze(TP, Fz, k, d * D2R, L); mx = Math.max(mx, Math.hypot(o.Fx, o.Fy) / Fz) }
    ok(mx <= 1.01, 'massimo |F|/Fz = ' + mx.toFixed(3));
  });
  test('MF: sensibilità al carico (μ cala con il carico, la rigidezza di deriva satura) e fattori di scala λ (μ dimezzato → picco dimezzato)', () => {
    const L = scala(1.0);
    ok(MF.piccoKappa(TP, 7000, 0, L, -1).mu < MF.piccoKappa(TP, 2500, 0, L, -1).mu, 'μx cala con il carico'); ok(MF.piccoAlfa(TP, 7000, L).mu < MF.piccoAlfa(TP, 2500, L).mu, 'μy cala con il carico');
    ok(MF.rigidezze(TP, 8000, L).Kya < 2 * MF.rigidezze(TP, 4000, L).Kya, 'la rigidezza di deriva non raddoppia con il carico');
    vicino(MF.piccoKappa(TP, 4000, 0, scala(0.5), -1).mu, 0.5, 0.02, 'μ dimezzato');
  });
  test('MF: lo scorrimento di picco della ricerca a sezione aurea coincide con quello trovato per campionamento fitto (anche con deriva)', () => {
    for (const [Fz, a, mu] of [[4000, 0, 1], [6000, 4 * D2R, 0.9], [2500, 8 * D2R, 0.3]]) {
      const L = scala(mu), pk = MF.piccoKappa(TP, Fz, a, L, -1); let best = 0, kb = 0;
      for (let k = 0.001; k < 0.6; k += 0.0005) { const f = Math.abs(MF.forze(TP, Fz, -k, a, L).Fx); if (f > best) { best = f; kb = -k } }
      vicino(pk.kappa, kb, 0.004, 'κ di picco'); vicino(Math.abs(pk.Fx), best, best * 1e-4, 'forza di picco');
    }
  });

  /* ---------------- dinamica a 200 Hz ---------------- */
  test('200 Hz: passo fisso di 5 ms indipendente dal fotogramma (1 s a 60 fps = 200 passi, 1 s a 37 fps = 200 passi)', () => {
    ok(F.DT === 0.005);
    for (const fps of [60, 37, 144]) { const v = nuovo(); for (let i = 0; i < fps; i++) F.passo(v, 1 / fps, { acc: 0.5, iy: 0.5 }); ok(Math.abs(v.dyn.passi - 200) <= 1, fps + ' fps → ' + v.dyn.passi + ' passi') }
  });
  test('200 Hz: una sola chiamata lunga (avvio automatico del motore della pagina: 0,7 s) integra tutti i passi e avvia il motore', () => {
    const v = nuovo({ acceso: false }); F.passo(v, 0.7, { acc: 0, iy: 0, avvia: true }); ok(v.motore.acceso && v.dyn.passi === 140, 'acceso ' + v.motore.acceso + ', passi ' + v.dyn.passi);
  });
  test('7DoF: guida casuale per 120 s (gas, freno, sterzo, freno a mano, superfici) senza valori non finiti né forze oltre l\'aderenza', () => {
    const v = nuovo(); let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647; const sup = ['asfalto', 'bagnato', 'neve', 'ghiaccio', 'ghiaia'];
    let inp = {}, amb = { superficie: 'asfalto' };
    for (let i = 0; i < 120 * 60; i++) {
      if (i % 45 === 0) { const g = rnd(); inp = { acc: g > 0.4 ? rnd() : 0, freno: g < 0.25 ? rnd() : 0, iy: 0, sterzo: (rnd() - 0.5) * 1.0, frenoMano: rnd() < 0.08 }; inp.iy = inp.acc - inp.freno; if (i % 900 === 0) amb = { superficie: sup[Math.floor(rnd() * sup.length)] } }
      F.passo(v, 1 / 60, inp, amb);
      ok(fin(v), 'non finito a t=' + (i / 60).toFixed(2));
      // limite: il μ che la formula stessa dà a quel carico (con la sensibilità al carico una ruota scarica ha μ più alto del nominale)
      for (let k = 0; k < 4; k++) { const o = v.dyn.o[k], lim = 1.02 * Math.max(o.mux || 0, o.muy || 0) * v.dyn.Fz[k] + 30; ok(Math.hypot(v.dyn.Fx[k], v.dyn.Fy[k]) <= lim, 'forza oltre l\'aderenza alla ruota ' + k + ': ' + Math.hypot(v.dyn.Fx[k], v.dyn.Fy[k]).toFixed(0) + ' > ' + lim.toFixed(0)) }
    }
    ok(v.odometro > 50, 'il veicolo si è mosso: ' + v.odometro.toFixed(0) + ' m');
  });
  test('7DoF: da fermo resta fermo (zeri esatti per 30 s, anche con lo sterzo a fondo e in pendenza al 15 %)', () => {
    for (const [inp, amb] of [[{ iy: 0 }, {}], [{ iy: 0, sterzo: 0.6 }, {}], [{ iy: 0 }, { pendenza: Math.atan(0.15) }], [{ iy: 0, frenoMano: true }, { pendenza: Math.atan(0.2) }]]) {
      const v = nuovo(); for (let i = 0; i < 1800; i++) { F.passo(v, 1 / 60, Object.assign({}, inp), amb); ok(v.v === 0 && v.vy === 0 && v.r === 0, 'si muove: ' + JSON.stringify(inp)) }
    }
  });
  test('7DoF: curva a regime (raggio cinematico L/δ a bassa velocità, sottosterzo della trazione anteriore, aderenza laterale massima 0,78–0,95 g)', () => {
    const regime = (delta, vt) => { const v = nuovo(); F.impostaVelocita(v, vt); v.cambio.marcia = vt > 25 ? 4 : 3; let ie = 0; for (let i = 0; i < 480; i++) { const e = vt - v.v; ie += e / 60; const acc = Math.max(0, Math.min(1, 0.3 + 0.4 * e + 0.2 * ie)); F.passo(v, 1 / 60, { acc, iy: acc, sterzo: delta }) } return v };
    const lento = regime(6 * D2R, 20 / 3.6), R = lento.v / lento.r, Rk = P.passo / Math.tan(6 * D2R); vicino(R, Rk, Rk * 0.05, 'raggio a 20 km/h');
    const medio = regime(6 * D2R, 50 / 3.6), af = (medio.dyn.alf[0] + medio.dyn.alf[1]) / 2, ar = (medio.dyn.alf[2] + medio.dyn.alf[3]) / 2; ok(medio.dyn.ay / 9.81 > 0.5 && af > ar, 'sottosterzo: α ant. ' + (af / D2R).toFixed(2) + '° > α post. ' + (ar / D2R).toFixed(2) + '°');
    const lim = regime(6 * D2R, 80 / 3.6), ay = lim.dyn.ay / 9.81; ok(ay > 0.78 && ay < 0.95, 'aderenza laterale massima ' + ay.toFixed(3) + ' g');
  });
  test('7DoF: retromarcia con lo sterzo (imbardata ≈ vx·tan δ / L, il retrotreno non scivola)', () => {
    const v = nuovo(); for (let i = 0; i < 300; i++) F.passo(v, 1 / 60, { iy: -0.5, sterzo: 0.3 });
    ok(v.v < -3, 'v ' + v.v); vicino(v.r, v.v * Math.tan(0.3) / P.passo, Math.abs(v.v * Math.tan(0.3) / P.passo) * 0.12, 'imbardata');
  });
  test('7DoF: freno a mano a 60 km/h con sterzo → ruote posteriori bloccate e auto che ruota oltre 60°', () => {
    const v = nuovo(); F.impostaVelocita(v, 60 / 3.6); v.cambio.marcia = 3; let psi = 0, bloccate = false;
    for (let i = 0; i < 180; i++) { F.passo(v, 1 / 60, { acc: 0, iy: 0, frenoMano: i < 60, sterzo: i < 60 ? 0.25 : 0 }); psi += v.r / 60; if (v.dyn.blocc[2] && v.dyn.blocc[3] && !v.dyn.blocc[0]) bloccate = true }
    ok(bloccate, 'retrotreno bloccato e avantreno libero'); ok(psi / D2R > 60, 'rotazione ' + (psi / D2R).toFixed(0) + '°');
  });

  /* ---------------- ABS e TCS (PID sulla zona di massimo grip) ---------------- */
  const frenata = (sup, conf) => {
    const v = nuovo(); F.impostaVelocita(v, 100 / 3.6); v.cambio.marcia = 4; if (conf === 'noabs') v.ecu.abs = false; if (conf === 'ko') F.urto(v, 16);
    const err = [0, 0, 0, 0], n = [0, 0, 0, 0]; let t = 0, lockMax = 0, lk = [0, 0, 0, 0];
    while (v.v > 0 && t < 30) {
      F.passo(v, 1 / 60, { acc: 0, freno: 1, iy: 0 }, { superficie: sup }); t += 1 / 60;
      for (let k = 0; k < 4; k++) { if (v.v > 4 && v.centralina.abs.attivo[k]) { err[k] += Math.abs(v.dyn.kap[k] - v.ctlIn.kPiccoF[k]); n[k]++ } lk[k] = v.dyn.blocc[k] && v.v > 2 ? lk[k] + 1 / 60 : 0; lockMax = Math.max(lockMax, lk[k]) }
    }
    return { v, t, x: v.odometro, err: err.map((e, k) => n[k] ? e / n[k] : 0), lockMax };
  };
  test('ABS: il PID tiene ogni ruota sullo scorrimento di picco della Magic Formula (errore medio < 0,02) su asfalto, bagnato e neve', () => {
    for (const sup of ['asfalto', 'bagnato', 'neve']) { const r = frenata(sup); r.err.forEach((e, k) => ok(e < 0.02, sup + ' ruota ' + k + ' errore medio ' + e.toFixed(4))); ok(r.lockMax < 0.1, sup + ': ruota bloccata per ' + r.lockMax.toFixed(2) + ' s') }
  });
  test('ABS: spazio di frenata 100-0 minore che a ruote bloccate (asfalto 35–48 m; bagnato e neve sempre più corto)', () => {
    const a = frenata('asfalto'), b = frenata('asfalto', 'noabs'); ok(a.x > 35 && a.x < 48, 'asfalto con ABS ' + a.x.toFixed(1) + ' m'); ok(b.x > a.x * 1.12, 'senza ABS ' + b.x.toFixed(1) + ' m');
    for (const sup of ['bagnato', 'neve']) { const c = frenata(sup), d = frenata(sup, 'noabs'); ok(d.x > c.x * 1.1, sup + ': ' + c.x.toFixed(1) + ' m con ABS, ' + d.x.toFixed(1) + ' m senza') }
  });
  test('ABS: frenando a fondo l\'auto resta sterzabile; con la centralina in blackout (ruote bloccate) no', () => {
    // sterzo dato da 0,5 s a 2 s, quando in blackout le ruote sono già bloccate
    const prova = ko => { const v = nuovo(); F.impostaVelocita(v, 90 / 3.6); v.cambio.marcia = 4; if (ko) F.urto(v, 20); let psi = 0; for (let i = 0; i < 200; i++) { F.passo(v, 1 / 60, { acc: 0, freno: 1, iy: 0, sterzo: i >= 30 && i < 120 ? 0.08 : 0 }); psi += v.r / 60 } return psi / D2R };
    const sano = prova(false), ko = prova(true); ok(sano > 8 && Math.abs(ko) < 1, 'imbardata con ABS ' + sano.toFixed(1) + '°, in blackout ' + ko.toFixed(2) + '°');
  });
  test('TCS: a gas pieno su neve e bagnato il PID tiene le ruote motrici vicino allo scorrimento di picco in trazione e accelera meglio che senza', () => {
    for (const sup of ['neve', 'bagnato']) {
      const prova = tcs => { const v = nuovo(); v.ecu.asr = tcs; let e = 0, n = 0; for (let i = 0; i < 8 * 60; i++) { F.passo(v, 1 / 60, { acc: 1, iy: 1 }, { superficie: sup }); if (i > 60 && v.centralina.tcs.attivo) { e += Math.abs(Math.max(v.dyn.kap[0], v.dyn.kap[1]) - v.ctlIn.kPiccoT[0]); n++ } } return { v: v.v, e: n ? e / n : 0, n } };
      const con = prova(true), senza = prova(false);
      ok(con.n > 30 && con.e < 0.04, sup + ': errore medio di scorrimento ' + con.e.toFixed(3)); ok(con.v > senza.v * 1.02, sup + ': ' + (con.v * 3.6).toFixed(1) + ' km/h con TCS, ' + (senza.v * 3.6).toFixed(1) + ' senza');
    }
  });
  test('TCS: aderenza diversa fra le ruote motrici (sinistra su ghiaccio) → la ruota che pattina viene frenata e l\'auto parte meglio', () => {
    const prova = tcs => { const v = nuovo(); v.ecu.asr = tcs; v.mod.muRuota = [0.12, 1, 0.12, 1]; let fr = 0; for (let i = 0; i < 6 * 60; i++) { F.passo(v, 1 / 60, { acc: 1, iy: 1 }); fr = Math.max(fr, v.centralina.tcs.Tb[0]) } return { v: v.v, fr } };
    const con = prova(true), senza = prova(false); ok(con.fr > 50, 'frenata della ruota che pattina ' + con.fr.toFixed(0) + ' N·m'); ok(con.v > senza.v * 1.15, (con.v * 3.6).toFixed(1) + ' km/h con TCS, ' + (senza.v * 3.6).toFixed(1) + ' senza');
  });

  /* ---------------- blackout oltre 15 g ---------------- */
  test('Blackout: 14,9 g lascia la centralina operativa, oltre 15 g va in BLACKOUT (messaggio, evento, spie ABS/ESC, codice C1100, ABS ed ESC offline)', () => {
    const v = nuovo(), r = E.crea(v, { seed: 1 }); ok(!F.urto(v, 14.9) && v.centralina.stato === 'OPERATIVA');
    ok(F.urto(v, 15.2) && v.centralina.stato === 'BLACKOUT'); ok(v.centralina.log.some(l => /CENTRALINA KO/.test(l.msg)) && v.eventi.some(e => e.tipo === 'centralina_ko'));
    for (let i = 0; i < 30; i++) { F.passo(v, 1 / 60, { iy: 0 }); E.passo(r, 1 / 60, { danni: {} }) }
    ok(!r.ecu.ABS.online && !r.ecu.ESC.online, 'ABS ed ESC offline'); ok(!v.ecu.abs && !v.ecu.esp, 'funzioni disattivate'); ok(E.leggiDTC(r, 'ABS').some(d => d.codice === 'C1100'), 'C1100'); ok(r.ecu.BCM.uscite.spie.includes('ABS') && r.ecu.BCM.uscite.spie.includes('ESC'), 'spie');
    F.riavviaCentralina(v); for (let i = 0; i < 30; i++) { F.passo(v, 1 / 60, { iy: 0 }); E.passo(r, 1 / 60, { danni: {} }) } ok(v.centralina.stato === 'OPERATIVA' && r.ecu.ABS.online && v.ecu.abs, 'riavvio in officina');
  });
  test('Blackout: frenando dopo l\'urto le 4 ruote si bloccano geometricamente (ω = 0 e λ = −1 esatto per oltre 0,5 s) e nessun regolatore interviene', () => {
    const v = nuovo(); F.impostaVelocita(v, 120 / 3.6); v.cambio.marcia = 5; F.urto(v, 18); let t = 0, tutte = 0, max = 0;
    for (let i = 0; i < 1000 && v.v > 0; i++) {
      F.passo(v, 1 / 200, { acc: 0, freno: 1, iy: -1 }); t += 1 / 200;
      ok(!v.centralina.abs.attivo.some(Boolean) && !v.centralina.tcs.attivo && !v.centralina.esp.attivo && v.centralina.esp.Mz === 0, 'regolatore attivo in blackout');
      const geo = v.dyn.kap.every(k => k === -1) && v.dyn.om.every(w => w === 0); tutte = geo ? tutte + 1 / 200 : 0; max = Math.max(max, tutte);
    }
    ok(max > 0.5, 'λ = −1 su tutte le ruote per ' + max.toFixed(2) + ' s');
  });
  test('Blackout: manovra PIT a 180 km/h (3 kN per 0,5 s sul paraurti posteriore): centralina sana recupera, in blackout testacoda (come tools/dinamica)', () => {
    const pit = g => { const v = nuovo(); F.impostaVelocita(v, 50); v.cambio.marcia = 6; const br = -(F.geometria(v).b + 0.9); let t = 0, psi = 0, c = false;
      while (t < 6) { const on = t >= 1 && t < 1.5; if (on && !c) { F.urto(v, g); c = true } F.passo(v, 1 / 200, { acc: t < 1 ? 0.35 : 0, iy: t < 1 ? 0.35 : 0, sterzo: 0, forzaEsterna: on ? { Fy: 3000, Mz: 3000 * br } : null }); t += 1 / 200; psi += v.r / 200 } return psi / D2R };
    const sano = pit(6), ko = pit(16); ok(Math.abs(sano) < 60, 'sana: rotazione ' + sano.toFixed(1) + '°'); ok(Math.abs(ko) > 150, 'blackout: rotazione ' + ko.toFixed(1) + '°');
  });
  test('Blackout: stima dell\'accelerazione di picco degli urti (frontale a 50 km/h oltre 15 g, urto a 10 km/h sotto) e salvataggio dello stato', () => {
    const g50 = CTL.piccoG({ vn: 13.9, massa: 1610 }), g10 = CTL.piccoG({ vn: 2.8, massa: 1610 }), gS = CTL.piccoG({ J: 1610 * 15.3, massa: 1610, vn: 13.9, durata: 0.078 });
    ok(g50 > 15 && g50 < 60, 'frontale 50 km/h ' + g50.toFixed(1) + ' g'); ok(g10 < 15, 'urto lieve ' + g10.toFixed(1) + ' g'); ok(gS > 25 && gS < 40, 'dal solver ' + gS.toFixed(1) + ' g');
    const v = nuovo(); F.urto(v, 22); const w = nuovo(); F.ripristina(w, JSON.parse(JSON.stringify(F.serializza(v)))); ok(w.centralina.stato === 'BLACKOUT', 'il blackout resta dopo il salvataggio');
  });

  /* ---------------- integrazione nella pagina: il codice VERO di drive() e di VEHX estratto da index.html ---------------- */
  const pagina = () => {
    const fs = require('fs'), html = fs.readFileSync(process.env.IOW_PAGINA || path.join(__dirname, '..', 'index.html'), 'utf8');
    const i = html.indexOf('function drive(dt,ix,iy){'), j = html.indexOf('\nfunction parked(dt)', i);
    const m = n => { const k = html.indexOf(' ' + n + '{'); const e = html.indexOf('},\n', k); ok(k > 0 && e > k, 'metodo ' + n + ' non trovato'); return html.slice(k + 1, e + 1) };
    const k = html.indexOf(' drive(dt,vf,vl,iy,hb,st){'), e = html.indexOf('return VEH.v},', k) + 'return VEH.v}'.length;
    ok(i > 0 && j > i && k > 0 && e > k, 'drive() o VEHX.drive non trovati'); ok(html.indexOf('motore/pneumatici_mf.js') > 0 && html.indexOf('motore/controllo_dinamica.js') > html.indexOf('motore/pneumatici_mf.js') && html.indexOf('motore/fisica_veicolo.js') > html.indexOf('motore/controllo_dinamica.js'), 'ordine degli script');
    return { drive: html.slice(i, j), vehx: '{' + m('imbardataUrto(k)') + ',' + m('urtoG(g,dove)') + ',' + html.slice(k + 1, e) + '}' };
  };
  const mondo = (vehOK, sorgente) => {
    const S = { K: {}, V: { vx: 0, vz: 0, y: 0, st: 0, yw: 0, ywW: 0, pt: 0, rl: 0, af: 0, al: 0, rol: null, flip: false }, C: { x: 0, z: 0, h: 0 }, P: {}, cs: { v: 0 }, CARDMG: { ef: 1, pull: 0, lk: 1, drag: 0, vmax: 56, grip: 1, soft: 1 }, DANS: { comp: { centraline: 1 } }, toasts: [] };
    S.VEH = nuovo(); S.VEH.motore.acceso = true;
    const fn = new Function('S', 'IOW_FISICA', 'IOW_ECU', `const {K,V,C,P,cs,CARDMG,DANS}=S;let VEH=S.VEH;const VEHOK=${vehOK},VDS={ok:true},carA={},PD=undefined,VITA={carHitBy(){}};
      const cl=(v,a,b)=>v<a?a:v>b?b:v,toast=t=>S.toasts.push(t),push=(x,z)=>[x,z,0],crTrip=()=>false,crRollDrive=()=>{},crScrape=()=>{},rlStart=()=>{},carHit=()=>{},groundCar=()=>{},WORLD={wet:()=>false,inside:()=>true};
      const VEHX=Object.assign(${sorgente.vehx},{t:0,cmd:null,vl:0,attritoDAN:0,toastT:0,open:false,guida(){return{sterzoCorsa:1,sterzoTiro:0}},amb(){return{pendenza:0,superficie:'asfalto',acqua:0,tempAria:18,quota:0,vento:0}}});
      ${sorgente.drive};return {drive,VEHX}`);
    return Object.assign(S, fn(S, F, E));
  };
  test('pagina (index.html): drive() vero con la dinamica a 200 Hz — rettilineo, curva a destra con il comando a destra, raggio cinematico a passo d\'uomo', () => {
    const src = pagina(), W = mondo(true, src);
    for (let i = 0; i < 600; i++) W.drive(1 / 60, 0, 1);
    ok(W.VEH.v * 3.6 > 60 && Math.abs(W.C.h) < 1e-6 && Math.abs(W.VEH.vy) < 1e-6, 'rettilineo: ' + (W.VEH.v * 3.6).toFixed(0) + ' km/h, rotta ' + W.C.h);
    vicino(Math.hypot(W.V.vx, W.V.vz), Math.hypot(W.VEH.v, W.VEH.vy), 1e-6, 'velocità del mondo = velocità della dinamica');
    const h0 = W.C.h; for (let i = 0; i < 120; i++) W.drive(1 / 60, 1, 0.3);
    ok(W.C.h < h0 - 0.3 && W.VEH.r < 0, 'comando a destra → imbardata verso destra (rotta che cala come prima): ' + (W.C.h - h0).toFixed(2) + ' rad');
    const L = mondo(true, src); for (let i = 0; i < 90; i++) L.drive(1 / 60, 0, 0.45); let vi = L.VEH.v; for (let i = 0; i < 240; i++) L.drive(1 / 60, 1, L.VEH.v > vi ? 0 : 0.45);
    vicino(L.VEH.v / L.VEH.r, -P.passo / Math.tan(L.V.st), P.passo / Math.tan(L.V.st) * 0.12, 'raggio di sterzata a bassa velocità');
  });
  test('pagina (index.html): spinta laterale (V.yw della polizia) a 100 km/h — centralina sana riprende l\'auto, dopo un urto di 20 g (urtoG) testacoda; quadro e officina', () => {
    const src = pagina(), spinta = g => { const W = mondo(true, src); F.impostaVelocita(W.VEH, 100 / 3.6); W.VEH.cambio.marcia = 5; W.V.vx = 0; W.V.vz = 100 / 3.6; for (let i = 0; i < 30; i++) W.drive(1 / 60, 0, 0.3); if (g) W.VEHX.urtoG(g, 'prova'); W.V.yw = 1.2; const h0 = W.C.h; for (let i = 0; i < 300; i++) W.drive(1 / 60, 0, 0); return { rot: (W.C.h - h0) / D2R, W } };
    const sano = spinta(0), ko = spinta(20);
    ok(Math.abs(sano.rot) < 60, 'sana: ' + sano.rot.toFixed(0) + '°'); ok(Math.abs(ko.rot) > 120, 'blackout: ' + ko.rot.toFixed(0) + '°');
    ok(ko.W.VEH.centralina.stato === 'BLACKOUT' && ko.W.DANS.comp.centraline <= 0.25 && ko.W.toasts.some(t => /CENTRALINA KO/.test(t)), 'blackout segnalato e centraline danneggiate (voce d\'officina)');
    const html = require('fs').readFileSync(process.env.IOW_PAGINA || path.join(__dirname, '..', 'index.html'), 'utf8');
    ok(html.includes("VEH.centralina.stato==='BLACKOUT'&&DANS.comp.centraline>=.6){IOW_FISICA.riavviaCentralina(VEH)"), 'riparazione in officina'); ok(html.includes('Pneumatici (Magic Formula combinata, 200 Hz)'), 'righe del quadro');
    ok(/VEHX\.urtoG\(IOW_FISICA\.piccoG\(\{J:ev\.J,massa:m1,vn:imp,durata:ev\.durata/.test(html), 'urti del solver → accelerazione di picco');
    ok(html.includes("w:(typeof VEHOK!=='undefined'&&VEHOK)?VEH.r:V.yw") && html.includes('VEH.r=pdClamp(b.w,-6,6);V.yw=0'), 'contatti con le pattuglie con l\'imbardata vera');
  });
  test('pagina (index.html): senza i moduli (VEHOK falso) la guida di riserva resta quella di prima', () => {
    const W = mondo(false, pagina()); for (let i = 0; i < 300; i++) W.drive(1 / 60, 0, 1); const v = Math.hypot(W.V.vx, W.V.vz); ok(v > 10 && v < 56, 'arcade ' + v.toFixed(1));
    const h0 = W.C.h; for (let i = 0; i < 60; i++) W.drive(1 / 60, 1, 0.5); ok(W.C.h < h0, 'sterza a destra');
  });
};
if (require.main === module) {
  let p = 0, f = 0; const T = { test: (n, fn) => { try { fn(); p++; console.log('  ok   ' + n) } catch (e) { f++; console.log('  FAIL ' + n + '\n         ' + (e && e.message || e)) } }, ok: (c, m) => { if (!c) throw new Error(m || 'condizione falsa') }, vicino: (a, b, t, m) => { if (Math.abs(a - b) > t) throw new Error((m || '') + ' atteso ' + b + ' ±' + t + ', ottenuto ' + a) } };
  module.exports(T); console.log('\n' + p + ' test superati, ' + f + ' falliti'); process.exit(f ? 1 : 0);
}
