/* ITALIA OPEN WORLD — misure della dinamica del GIOCO (motore/fisica_veicolo.js + pneumatici_mf.js + controllo_dinamica.js).
   Uso: node tools/dinamica/misure_js.js            → scrive docs/test/pneumatici_dinamica_misure.txt (e lo stampa)
   Tutto deterministico: due esecuzioni danno lo stesso file. Le stesse proprietà sono controllate (con soglie) da test/pneumatici_dinamica.js. */
'use strict';
const path = require('path'), fs = require('fs');
const R = path.join(__dirname, '..', '..');
const F = require(path.join(R, 'motore', 'fisica_veicolo.js')), MF = F.MF, P = F.DB.parametri('alfa_159_19_jtdm_150'), TP = MF.MF52_GENERICO;
const D2R = Math.PI / 180, out = [], scrivi = s => out.push(s);
const nuovo = () => { const v = F.crea(P, { Tambiente: 20, carburante: 30 }); v.motore.Tacqua = 90; v.motore.Tolio = 95; return v };
const L1 = () => { const L = MF.scalaNeutra(); L.LMUX = 1 / TP.PDX1; L.LMUY = 1 / TP.PDY1; return L };

scrivi('ITALIA OPEN WORLD — misure della dinamica del veicolo (Magic Formula combinata, 7 gradi di libertà a 200 Hz, centralina)');
scrivi('Veicolo: ' + P.nome + ' — ' + P.massa + ' kg, Iz ' + P.Iz + ' kg·m², passo ' + P.passo + ' m, quota anteriore ' + P.quotaAnt + ', trazione ' + P.trazione);
scrivi('Pneumatico: ' + TP.nome + ' — ' + TP.stato);
scrivi('Nessun valore è validato su misure reali: sono le uscite del modello del gioco.\n');

scrivi('1. MAGIC FORMULA (μ di picco scalato a 1,0 al carico nominale di 4000 N)');
scrivi('   Fz [N]   κ* frenata   μx picco   Fx(κ=−1)/picco   α* [°]   μy picco   Kyα [N/°]   σα [m]');
for (const Fz of [2000, 3000, 4000, 4740, 6000, 7500]) {
  const L = L1(), pk = MF.piccoKappa(TP, Fz, 0, L, -1), pa = MF.piccoAlfa(TP, Fz, L), lk = Math.abs(MF.forze(TP, Fz, -1, 0, L).Fx) / Math.abs(pk.Fx);
  scrivi('   ' + [Fz, pk.kappa.toFixed(3), pk.mu.toFixed(3), lk.toFixed(3), (pa.alfa / D2R).toFixed(2), pa.mu.toFixed(3), (MF.rigidezze(TP, Fz, L).Kya * D2R).toFixed(0), MF.rilassamentoLaterale(TP, Fz, L).toFixed(3)].map(x => String(x).padStart(9)).join(' '));
}
scrivi('\n   Scorrimento combinato a 4000 N: Fx/Fz ; Fy/Fz (|F|/Fz)');
for (const d of [0, 2, 4, 8, 12]) { let r = '   α ' + String(d).padStart(2) + '°:'; for (const k of [0, -0.05, -0.1, -0.2, -0.5, -1]) { const o = MF.forze(TP, 4000, k, d * D2R, L1()); r += '  κ ' + k.toFixed(2) + ' ' + (o.Fx / 4000).toFixed(2) + ';' + (o.Fy / 4000).toFixed(2) + ' (' + (Math.hypot(o.Fx, o.Fy) / 4000).toFixed(2) + ')' } scrivi(r) }

scrivi('\n2. FRENATA 100-0 km/h (pedale a fondo)');
scrivi('   superficie   configurazione        spazio [m]  tempo [s]  errore medio |κ−κ*| ABS   ruote bloccate (tutte) [s]');
for (const sup of ['asfalto', 'bagnato', 'neve']) for (const conf of ['ABS', 'senza ABS', 'blackout 16 g']) {
  const v = nuovo(); F.impostaVelocita(v, 100 / 3.6); v.cambio.marcia = 4; if (conf === 'senza ABS') v.ecu.abs = false; if (conf === 'blackout 16 g') F.urto(v, 16);
  let t = 0, e = 0, n = 0, lk = 0;
  while (v.v > 0 && t < 30) { F.passo(v, 1 / 60, { acc: 0, freno: 1, iy: 0 }, { superficie: sup }); t += 1 / 60; for (let k = 0; k < 4; k++) if (v.v > 4 && v.centralina.abs.attivo[k]) { e += Math.abs(v.dyn.kap[k] - v.ctlIn.kPiccoF[k]); n++ } if (v.dyn.kap.every(k => k === -1)) lk += 1 / 60 }
  scrivi('   ' + sup.padEnd(12) + conf.padEnd(22) + v.odometro.toFixed(1).padStart(9) + t.toFixed(2).padStart(10) + (n ? (e / n).toFixed(4) : '   —  ').padStart(22) + lk.toFixed(2).padStart(24));
}

scrivi('\n3. ACCELERAZIONE A GAS PIENO (TCS)');
scrivi('   superficie   TCS   0-100 [s]   km/h dopo 25 s   κ medio ant. con TCS attivo   κ* trazione');
for (const sup of ['asfalto', 'bagnato', 'neve', 'ghiaccio']) for (const tcs of [true, false]) {
  const v = nuovo(); v.ecu.asr = tcs; let t = 0, t100 = null, ks = 0, n = 0;
  while (t < 25) { F.passo(v, 1 / 60, { acc: 1, iy: 1 }, { superficie: sup }); t += 1 / 60; if (v.centralina.tcs.attivo) { ks += Math.max(v.dyn.kap[0], v.dyn.kap[1]); n++ } if (t100 === null && v.v * 3.6 >= 100) t100 = t }
  scrivi('   ' + sup.padEnd(12) + (tcs ? 'sì ' : 'no ') + (t100 ? t100.toFixed(2) : '—').padStart(10) + (v.v * 3.6).toFixed(1).padStart(17) + (n ? (ks / n).toFixed(3) : '—').padStart(30) + v.ctlIn.kPiccoT[0].toFixed(3).padStart(14));
}

scrivi('\n4. CURVA A REGIME (sterzo alle ruote costante, velocità tenuta con il gas)');
scrivi('   sterzo  km/h   acc. lat. [g]   raggio [m]   deriva β [°]   α ant. / post. [°]');
for (const [dg, vk] of [[6, 20], [6, 40], [6, 50], [6, 60], [6, 70], [6, 80], [2, 80], [2, 120], [2, 140]]) {
  const v = nuovo(), vt = vk / 3.6; F.impostaVelocita(v, vt); v.cambio.marcia = vt > 25 ? 4 : 3; let ie = 0;
  for (let i = 0; i < 480; i++) { const e = vt - v.v; ie += e / 60; const acc = Math.max(0, Math.min(1, 0.3 + 0.4 * e + 0.2 * ie)); F.passo(v, 1 / 60, { acc, iy: acc, sterzo: dg * D2R }) }
  scrivi('   ' + (dg + '°').padStart(5) + String(vk).padStart(6) + (v.dyn.ay / 9.81).toFixed(3).padStart(14) + (v.v / v.r).toFixed(1).padStart(13) + (Math.atan2(v.vy, v.v) / D2R).toFixed(2).padStart(14) + ('   ' + ((v.dyn.alf[0] + v.dyn.alf[1]) / 2 / D2R).toFixed(2) + ' / ' + ((v.dyn.alf[2] + v.dyn.alf[3]) / 2 / D2R).toFixed(2)));
}
scrivi('   (raggio cinematico a passo d\'uomo con 6°: L/tan δ = ' + (P.passo / Math.tan(6 * D2R)).toFixed(1) + ' m)');

scrivi('\n5. MANOVRA PIT a 180 km/h: forza laterale sul paraurti posteriore per 0,5 s (da t = 1 s), sterzo dritto — confronto con tools/dinamica/dinamica_7dof.py');
scrivi('   forza   frenata   centralina   rotazione [°]   deriva max [°]   km/h a 6 s   λ = −1 su tutte [s]');
for (const [Fp, tf] of [[3000, 99], [3000, 1.5], [3000, 3], [6000, 1.5]]) for (const g of [6, 16]) {
  const v = nuovo(); F.impostaVelocita(v, 50); v.cambio.marcia = 6; const br = -(F.geometria(v).b + 0.9); let t = 0, psi = 0, bm = 0, lk = 0, c = false;
  while (t < 6) { const on = t >= 1 && t < 1.5; if (on && !c) { F.urto(v, g); c = true } const fr = t >= tf ? 1 : 0; F.passo(v, 1 / 200, { acc: t < 1 ? 0.35 : 0, freno: fr, iy: t < 1 ? 0.35 : 0, sterzo: 0, forzaEsterna: on ? { Fy: Fp, Mz: Fp * br } : null }); t += 1 / 200; psi += v.r / 200; bm = Math.max(bm, Math.abs(Math.atan2(v.vy, Math.max(Math.abs(v.v), 0.1)))); if (v.dyn.kap.every(k => k === -1)) lk += 1 / 200 }
  scrivi('   ' + (Fp / 1000 + ' kN').padEnd(8) + (tf < 10 ? 'da ' + tf + ' s' : 'no').padEnd(10) + (g > 15 ? 'BLACKOUT' : 'operativa').padEnd(12) + (psi / D2R).toFixed(1).padStart(13) + (bm / D2R).toFixed(1).padStart(17) + (Math.hypot(v.v, v.vy) * 3.6).toFixed(1).padStart(13) + lk.toFixed(2).padStart(21));
}

scrivi('\n6. STERZABILITÀ IN FRENATA a fondo da 90 km/h (sterzo 4,6° da 0,5 a 2 s)');
for (const ko of [false, true]) { const v = nuovo(); F.impostaVelocita(v, 90 / 3.6); v.cambio.marcia = 4; if (ko) F.urto(v, 20); let psi = 0; for (let i = 0; i < 200; i++) { F.passo(v, 1 / 60, { acc: 0, freno: 1, iy: 0, sterzo: i >= 30 && i < 120 ? 0.08 : 0 }); psi += v.r / 60 } scrivi('   ' + (ko ? 'blackout (ruote bloccate)' : 'ABS').padEnd(28) + 'imbardata ' + (psi / D2R).toFixed(2) + '°') }

scrivi('\n7. ACCELERAZIONE DI PICCO STIMATA DEGLI URTI (controllo_dinamica.piccoG; soglia del blackout 15 g)');
for (const kmh of [10, 15, 20, 25, 30, 50, 70]) { const vn = kmh / 3.6; scrivi('   urto frontale contro un muro a ' + String(kmh).padStart(2) + ' km/h (senza dati del solver): ' + F.piccoG({ vn, massa: P.massa }).toFixed(1) + ' g') }
scrivi('   con i dati del solver (50 km/h: Δv 15,3 m/s, durata 0,078 s): ' + F.piccoG({ J: P.massa * 15.3, massa: P.massa, vn: 13.9, durata: 0.078 }).toFixed(1) + ' g');

scrivi('\n8. COSTO DI CALCOLO (Node ' + process.version + ', questo processore)');
for (const [nome, inp] of [['crociera', { acc: 0.4, iy: 0.4, sterzo: 0.02 }], ['frenata con ABS', { freno: 1, iy: 0, sterzo: 0.05 }], ['gas a fondo', { acc: 1, iy: 1 }]]) {
  const v = nuovo(); F.impostaVelocita(v, 30); const t0 = process.hrtime.bigint(); for (let i = 0; i < 3000; i++) { if (v.v < 5) F.impostaVelocita(v, 30); F.passo(v, 1 / 60, inp) }
  scrivi('   ' + nome.padEnd(18) + (Number(process.hrtime.bigint() - t0) / 1e6 / 3000 * 1000).toFixed(0) + ' µs per fotogramma (3,33 passi da 5 ms)  [varia con la macchina]');
}
const testo = out.join('\n') + '\n';
const dest = path.join(R, 'docs', 'test', 'pneumatici_dinamica_misure.txt');
fs.writeFileSync(dest, testo.replace(/\n8\. COSTO[\s\S]*$/, '\n8. COSTO DI CALCOLO: vedi uscita a schermo (dipende dalla macchina, non si salva per tenere il file riproducibile)\n'));
console.log(testo);
