/* ITALIA OPEN WORLD — Soccorso stradale: carro attrezzi a pianale con dinamica a 200 Hz, guida sulle strade vere, aggancio e traino
   =================================================================================================================================
   Modulo puro (nessuna dipendenza dal gioco o da three.js): browser (window.IOW_CARRO) e Node (module.exports). Il gioco gli passa il
   percorso stradale (pdRoute della polizia: Dijkstra sul grafo delle strade di OpenStreetMap delle celle caricate) e una funzione per la
   quota del suolo; il modulo restituisce la posa del camion, del pianale e dell'auto agganciata a ogni fotogramma.

   VEICOLO (di fantasia: «Ivoria Soccorso 190», ispirato ai carri attrezzi a pianale scorrevole su autotelaio da 19 t)
   massa 9 400 kg (+ auto caricata), passo 4,6 m, lunghezza 8,6 m, larghezza 2,5 m, velocità massima 90 km/h (limitatore dei mezzi pesanti),
   accelerazione 0,9 m/s² a vuoto e 0,6 m/s² carico, frenata di servizio 3,2 m/s², accelerazione laterale ammessa 2,2 m/s² (baricentro alto),
   sterzo massimo 0,6 rad con velocità di sterzata 0,55 rad/s.

   DINAMICA (passo fisso di 5 ms = 200 Hz, il tempo del fotogramma si accumula)
   - Modello a bicicletta cinematico: ẋ = v·sin ψ, ż = v·cos ψ, ψ̇ = v·tan δ / passo (ψ cresce verso sinistra, come nel gioco).
   - Sterzo «pure pursuit» sul percorso spostato di 1,75 m a destra dell'asse stradale (si tiene la propria corsia; nelle carreggiate a senso
     unico delle autostrade è la corsia di destra): punto bersaglio a L = 7 + 0,55·v metri avanti, curvatura 2·sin α / L, δ = atan(curvatura·passo),
     limitato in ampiezza e in velocità di sterzata.
   - Profilo di velocità sul percorso ricampionato ogni 2 m: v ≤ 90 km/h, v ≤ √(a_lat / κ) in curva, passata all'indietro con la decelerazione
     di frenata (rallenta prima delle curve e si ferma esattamente a fine percorso). Il comando di velocità rispetta accelerazione e frenata.
   - Quota e beccheggio dal suolo del gioco (ruote anteriori e posteriori), così il camion segue ponti, gallerie e salite.

   MISSIONE: chiamata (centralino, 8 s) → avvicinamento (da ~1 km, sulle strade) → aggancio (pianale che si inclina e scorre, verricello che
   tira l'auto: 7 s) → traino verso l'officina più vicina (fino a 90 km/h, auto solidale al pianale: posizione e QUOTA aggiornate a ogni
   passo) → scarico (5 s) → fattura (l'auto torna utilizzabile solo dopo il pagamento). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.IOW_CARRO = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const DT = 0.005, cl = (v, a, b) => v < a ? a : v > b ? b : v, wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a };
  const PARAMETRI = Object.freeze({
    nome: 'Ivoria Soccorso 190', nota: 'veicolo di fantasia (carro attrezzi a pianale scorrevole su autotelaio da 19 t)',
    massa: 9400, passo: 4.6, lunghezza: 8.6, larghezza: 2.5, vmax: 25, aLat: 2.2, acc: 0.9, accCarico: 0.6, fren: 3.2, sterzoMax: 0.6, sterzoVel: 0.55,
    corsia: 1.75, passoCampione: 2, fermata: 0.6,
    pianale: { dietro: 1.7, quota: 1.12, lunghezza: 6.0, inclMax: 0.16, scorr: 2.4 },
    tempi: { chiamata: 8, aggancio: 7, scarico: 5 },
  });

  /* ------------------------------------------------------------------ percorso: ricampionamento, corsia, curvatura, profilo di velocità */
  function preparaPercorso(pts, opz) {
    opz = opz || {}; const P = Object.assign({}, PARAMETRI, opz.parametri || {}), ds = P.passoCampione;
    const src = (pts || []).filter((p, i, a) => i === 0 || Math.hypot(p[0] - a[i - 1][0], p[1] - a[i - 1][1]) > 0.05);
    if (src.length < 2) return { ok: false, pts: [], len: 0, why: 'percorso troppo corto' };
    // ricampiona ogni ds metri lungo la spezzata
    const R = [[src[0][0], src[0][1]]]; let resto = 0;
    for (let i = 1; i < src.length; i++) {
      const ax = src[i - 1][0], az = src[i - 1][1], bx = src[i][0], bz = src[i][1], L = Math.hypot(bx - ax, bz - az); let t = ds - resto;
      while (t <= L) { R.push([ax + (bx - ax) * t / L, az + (bz - az) * t / L]); t += ds }
      resto = L - (t - ds);
    }
    const last = src[src.length - 1]; if (Math.hypot(R[R.length - 1][0] - last[0], R[R.length - 1][1] - last[1]) > 0.2) R.push([last[0], last[1]]);
    const n = R.length;
    // spostamento a destra della direzione di marcia (corsia), con le direzioni mediate per non creare gradini nelle curve
    const off = opz.corsia !== undefined ? opz.corsia : P.corsia, Q = new Array(n);
    for (let i = 0; i < n; i++) {
      const a = R[Math.max(0, i - 1)], b = R[Math.min(n - 1, i + 1)]; let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      const fade = opz.corsiaFine === false ? 1 : Math.min(1, (n - 1 - i) * ds / 25);        // nell'ultimo tratto si accosta al punto esatto
      Q[i] = [R[i][0] - dz * off * fade, R[i][1] + dx * off * fade];
    }
    // ascissa curvilinea e curvatura (cambio di direzione / lunghezza media)
    const s = new Float64Array(n), k = new Float64Array(n), v = new Float64Array(n);
    for (let i = 1; i < n; i++) s[i] = s[i - 1] + Math.hypot(Q[i][0] - Q[i - 1][0], Q[i][1] - Q[i - 1][1]);
    for (let i = 1; i < n - 1; i++) {
      const h1 = Math.atan2(Q[i][0] - Q[i - 1][0], Q[i][1] - Q[i - 1][1]), h2 = Math.atan2(Q[i + 1][0] - Q[i][0], Q[i + 1][1] - Q[i][1]);
      k[i] = Math.abs(wrap(h2 - h1)) / Math.max(0.5, (s[i + 1] - s[i - 1]) / 2);
    }
    // curvatura massima in una finestra di ±6 m (il camion è lungo: rallenta per tutta la curva)
    const kf = new Float64Array(n); for (let i = 0; i < n; i++) { let m = 0; for (let j = Math.max(0, i - 3); j <= Math.min(n - 1, i + 3); j++) m = Math.max(m, k[j]); kf[i] = m }
    const vmax = opz.vmax || P.vmax;
    for (let i = 0; i < n; i++) v[i] = Math.min(vmax, kf[i] > 1e-6 ? Math.sqrt(P.aLat / kf[i]) : vmax);
    v[n - 1] = 0;
    for (let i = n - 2; i >= 0; i--) v[i] = Math.min(v[i], Math.sqrt(v[i + 1] * v[i + 1] + 2 * P.fren * 0.8 * (s[i + 1] - s[i])));   // frenata all'80 % della massima
    return { ok: true, pts: Q, s, k: kf, v, len: s[n - 1], n };
  }
  /* proiezione della posizione sul percorso a partire dall'indice precedente (ricerca locale) */
  function proietta(pc, x, z, i0) {
    let best = i0 || 0, bd = 1e18; const a = Math.max(0, (i0 || 0) - 10), b = Math.min(pc.n - 2, (i0 || 0) + 60);
    for (let i = a; i <= b; i++) { const p = pc.pts[i], q = pc.pts[i + 1], dx = q[0] - p[0], dz = q[1] - p[1], l2 = dx * dx + dz * dz || 1, t = cl(((x - p[0]) * dx + (z - p[1]) * dz) / l2, 0, 1), d = Math.hypot(p[0] + dx * t - x, p[1] + dz * t - z); if (d < bd) { bd = d; best = i } }
    const p = pc.pts[best], q = pc.pts[best + 1], dx = q[0] - p[0], dz = q[1] - p[1], l2 = dx * dx + dz * dz || 1, t = cl(((x - p[0]) * dx + (z - p[1]) * dz) / l2, 0, 1);
    return { i: best, s: pc.s[best] + t * (pc.s[best + 1] - pc.s[best]), d: bd, lato: (x - p[0]) * dz - (z - p[1]) * dx >= 0 ? 1 : -1 };
  }
  function puntoAs(pc, sv) { sv = cl(sv, 0, pc.len); let lo = 0, hi = pc.n - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (pc.s[m] <= sv) lo = m; else hi = m } const t = (sv - pc.s[lo]) / Math.max(1e-6, pc.s[hi] - pc.s[lo]); return [pc.pts[lo][0] + (pc.pts[hi][0] - pc.pts[lo][0]) * t, pc.pts[lo][1] + (pc.pts[hi][1] - pc.pts[lo][1]) * t, pc.v[lo] + (pc.v[hi] - pc.v[lo]) * t] }

  /* ------------------------------------------------------------------ camion */
  function creaCamion(x, z, h, y) { return { x, z, y: y || 0, h, v: 0, st: 0, beccheggio: 0, i: 0, accum: 0, passi: 0, odo: 0, aMax: 0, aLatMax: 0, scostMax: 0, vMax: 0 } }
  /* un passo di 5 ms lungo il percorso. carico: true se trasporta l'auto. suolo(x,z,y) → quota */
  function passoCamion(c, pc, P, carico, suolo) {
    const pr = proietta(pc, c.x, c.z, c.i); c.i = pr.i;
    const rem = pc.len - pr.s;
    // velocità desiderata: profilo nel punto attuale e un po' avanti (il muso arriva prima della curva)
    let vp = puntoAs(pc, pr.s)[2]; if (rem > 6) vp = Math.min(vp, puntoAs(pc, pr.s + 4)[2]);
    // ultimi metri: velocità di accosto √(2·a·d) con un minimo di 0,6 m/s finché non si è sul punto (il camion non resta «appeso» a un metro)
    let vt = rem < P.fermata ? 0 : Math.max(Math.min(vp, Math.sqrt(2 * P.fren * 0.5 * rem)), Math.min(0.6, rem));
    const acc = carico ? P.accCarico : P.acc, a = cl((vt - c.v) / 0.6, -P.fren, acc);
    c.v = Math.max(0, c.v + a * DT);
    // sterzo pure pursuit
    const L = 7 + 0.55 * c.v, tg = puntoAs(pc, Math.min(pc.len, pr.s + L)), al = wrap(Math.atan2(tg[0] - c.x, tg[1] - c.z) - c.h), Ld = Math.max(2, Math.hypot(tg[0] - c.x, tg[1] - c.z));
    const dt0 = cl(Math.atan(2 * Math.sin(al) / Ld * P.passo), -P.sterzoMax, P.sterzoMax);
    c.st += cl(dt0 - c.st, -P.sterzoVel * DT, P.sterzoVel * DT);
    // bicicletta cinematica
    const w = c.v * Math.tan(c.st) / P.passo; c.h = wrap(c.h + w * DT); c.x += c.v * Math.sin(c.h) * DT; c.z += c.v * Math.cos(c.h) * DT; c.odo += c.v * DT;
    if (suolo) { const sn = Math.sin(c.h), cn = Math.cos(c.h), yf = suolo(c.x + sn * 2.3, c.z + cn * 2.3, c.y), yr = suolo(c.x - sn * 2.3, c.z - cn * 2.3, c.y); if (Number.isFinite(yf) && Number.isFinite(yr)) { c.y = (yf + yr) / 2; c.beccheggio = Math.atan2(yf - yr, 4.6) } }
    // misure (per i test e il registro)
    c.aMax = Math.max(c.aMax, Math.abs(a)); c.aLatMax = Math.max(c.aLatMax, Math.abs(w * c.v)); c.vMax = Math.max(c.vMax, c.v); c.passi++;
    if (pr.s > 10 && rem > 25) c.scostMax = Math.max(c.scostMax, pr.d);
    return rem;
  }

  /* posa del pianale (centro del piano di carico): dietro al centro del camion, alla quota del telaio, con inclinazione e scorrimento */
  function posaPianale(c, P, incl, scorr) {
    const sn = Math.sin(c.h), cn = Math.cos(c.h), d = P.pianale.dietro + (scorr || 0);
    return { x: c.x - sn * d, z: c.z - cn * d, y: c.y + P.pianale.quota - Math.sin(incl || 0) * 1.6, h: c.h, incl: incl || 0 };
  }

  /* ------------------------------------------------------------------ missione */
  function crea(opz) {
    opz = opz || {}; const P = Object.assign({}, PARAMETRI, opz.parametri || {});
    return { P, fase: 'chiamata', t: 0, tFase: 0, camion: null, pc: null, auto: null, autoSu: false, incl: 0, scorr: 0, agg: 0, registro: [], km: { avvicinamento: 0, traino: 0 }, accum: 0, eventi: [], officina: opz.officina || null, notte: !!opz.notte };
  }
  function nota(m, msg) { m.registro.push({ t: +m.t.toFixed(2), fase: m.fase, msg }); if (m.registro.length > 80) m.registro.splice(0, 20) }
  function fase(m, f, msg) { m.fase = f; m.tFase = 0; m.eventi.push(f); nota(m, msg || f) }
  /* parte il camion: posizione e direzione iniziali, percorso fino all'auto (già esteso oltre l'auto di ~11 m: il camion la supera e si ferma
     con il pianale davanti all'auto) */
  function avvia(m, x, z, h, y, percorso) { m.camion = creaCamion(x, z, h, y); m.pc = preparaPercorso(percorso); if (!m.pc.ok) { fase(m, 'annullata', 'percorso non valido: ' + m.pc.why); return false } nota(m, 'camion partito, ' + Math.round(m.pc.len) + ' m di strada fino all\'auto'); return true }
  function impostaTraino(m, percorso) { m.pc = preparaPercorso(percorso); m.camion.i = 0; if (!m.pc.ok) { fase(m, 'annullata', 'percorso verso l\'officina non valido'); return false } nota(m, Math.round(m.pc.len) + ' m fino all\'officina'); return true }
  /* auto: { x, z, y, h } posa dell'auto ferma (prima dell'aggancio) */
  function impostaAuto(m, auto) { m.auto = Object.assign({}, auto); m.auto0 = Object.assign({}, auto) }

  /* avanza la missione. g = { suolo(x,z,y), dt } → restituisce le pose { camion, pianale, auto } */
  function passo(m, dt, g) {
    g = g || {}; m.accum += cl(dt, 0, 0.5); let n = 0;
    while (m.accum >= DT - 1e-9 && n < 200) { m.accum -= DT; n++; passo5(m, g) }
    return pose(m);
  }
  function passo5(m, g) {
    const P = m.P; m.t += DT; m.tFase += DT; const c = m.camion;
    switch (m.fase) {
      case 'chiamata': if (m.tFase >= P.tempi.chiamata) fase(m, c ? 'avvicinamento' : 'attesa', c ? 'operatore: «Un nostro mezzo sta arrivando»' : 'in attesa del percorso'); break;
      case 'avvicinamento': { const rem = passoCamion(c, m.pc, P, false, g.suolo); m.km.avvicinamento = c.odo / 1000; if (rem < P.fermata + 0.05 && c.v < 0.05) { c.v = 0; fase(m, 'aggancio', 'arrivato sul posto: aggancio') } break }
      case 'aggancio': {
        const T = P.tempi.aggancio, u = m.tFase / T;
        // 0–25 %: il pianale si inclina e scorre indietro; 25–80 %: il verricello tira l'auto sulla rampa; 80–100 %: il pianale torna orizzontale
        m.incl = P.pianale.inclMax * (u < 0.25 ? u / 0.25 : u < 0.8 ? 1 : (1 - u) / 0.2); m.scorr = P.pianale.scorr * (u < 0.25 ? u / 0.25 : u < 0.8 ? 1 : (1 - u) / 0.2);
        m.agg = cl((u - 0.25) / 0.55, 0, 1); if (u >= 1) { m.incl = 0; m.scorr = 0; m.agg = 1; m.autoSu = true; c.odo = 0; fase(m, 'pronto_traino', 'auto agganciata e fissata con le cinghie') }
        break;
      }
      case 'traino': { const rem = passoCamion(c, m.pc, P, true, g.suolo); m.km.traino = c.odo / 1000; if (rem < P.fermata + 0.05 && c.v < 0.05) { c.v = 0; fase(m, 'scarico', 'arrivati all\'officina: scarico') } break }
      case 'scarico': { const T = P.tempi.scarico, u = m.tFase / T; m.incl = P.pianale.inclMax * (u < 0.3 ? u / 0.3 : u < 0.8 ? 1 : (1 - u) / 0.2); m.scorr = P.pianale.scorr * Math.min(1, u / 0.3) * (u < 0.8 ? 1 : (1 - u) / 0.2); m.agg = u < 0.3 ? 1 : u < 0.8 ? 1 - (u - 0.3) / 0.5 : 0;
        if (u >= 1) { m.incl = 0; m.scorr = 0; m.agg = 0; m.autoSu = false; const b = posaPianale(c, P, 0, 0), sn = Math.sin(c.h), cn = Math.cos(c.h); m.auto = { x: b.x - sn * 6.5, z: b.z - cn * 6.5, y: g.suolo ? g.suolo(b.x - sn * 6.5, b.z - cn * 6.5, c.y) : c.y, h: c.h }; m.auto0 = Object.assign({}, m.auto); fase(m, 'fattura', 'auto scaricata davanti all\'officina: fattura') } break }
    }
  }
  /* pose correnti: l'auto, durante l'aggancio, scorre dalla posa a terra al pianale lungo la rampa (quota aggiornata a ogni passo) */
  function pose(m) {
    const c = m.camion, P = m.P; if (!c) return { camion: null, pianale: null, auto: m.auto };
    const b = posaPianale(c, P, m.incl, m.scorr); let auto = m.auto;
    if (m.auto0 && (m.fase === 'aggancio' || m.fase === 'scarico' || m.autoSu || m.fase === 'pronto_traino' || m.fase === 'traino')) {
      const sn = Math.sin(c.h), cn = Math.cos(c.h), su = { x: b.x + sn * 0.2, z: b.z + cn * 0.2, y: b.y + 0.02, h: c.h };
      if (m.fase === 'aggancio' || m.fase === 'scarico') {
        const a0 = m.fase === 'aggancio' ? m.auto0 : { x: b.x - sn * 6.5, z: b.z - cn * 6.5, y: m.auto0.y, h: c.h }, f = m.agg, ff = f * f * (3 - 2 * f);
        // la rampa: l'auto sale con la pendenza del pianale inclinato (quota lineare sulla parte finale)
        const rampa = { x: b.x - sn * (P.pianale.lunghezza / 2 + m.scorr), z: b.z - cn * (P.pianale.lunghezza / 2 + m.scorr), y: a0.y + 0.05, h: c.h };
        const fA = cl(ff / 0.45, 0, 1), fB = cl((ff - 0.45) / 0.55, 0, 1), dh = wrap(c.h - a0.h);
        auto = ff < 0.45 ? { x: a0.x + (rampa.x - a0.x) * fA, z: a0.z + (rampa.z - a0.z) * fA, y: a0.y + (rampa.y - a0.y) * fA, h: a0.h + dh * fA, beccheggio: 0 }
          : { x: rampa.x + (su.x - rampa.x) * fB, z: rampa.z + (su.z - rampa.z) * fB, y: rampa.y + (su.y - rampa.y) * fB, h: c.h, beccheggio: -Math.atan2(su.y - rampa.y, Math.hypot(su.x - rampa.x, su.z - rampa.z)) * (1 - fB) };
      } else auto = { x: su.x, z: su.z, y: su.y, h: c.h, beccheggio: -c.beccheggio };   // beccheggio dell'auto nella convenzione del gioco (rotazione x: + = muso in giù)
      m.auto = auto;
    }
    return { camion: { x: c.x, y: c.y, z: c.z, h: c.h, v: c.v, sterzo: c.st, beccheggio: c.beccheggio }, pianale: b, auto };
  }
  function iniziaTraino(m) { if (m.fase === 'pronto_traino') fase(m, 'traino', 'traino verso l\'officina') }

  /* ------------------------------------------------------------------ fattura amministrativa simulata (centesimi di euro) */
  let numeroFattura = 1;
  function fattura(m, opz) {
    opz = opz || {}; const v = [], add = (voce, qta, unit, um) => { const imp = Math.round(qta * unit); v.push({ voce, qta: +qta.toFixed(2), um: um || '', unitario: unit, importo: imp }); return imp };
    add('Diritto di chiamata e uscita del mezzo di soccorso', 1, 9500, 'n.');
    add('Percorrenza del carro attrezzi verso il luogo del soccorso', Math.max(1, m.km.avvicinamento), 190, 'km');
    add('Traino con carro attrezzi a pianale fino all\'officina', Math.max(1, m.km.traino), 260, 'km');
    add('Manodopera di aggancio e scarico (verricello, cinghie)', 0.5, 4800, 'h');
    if (m.notte) add('Maggiorazione servizio notturno (30 % sulle voci di soccorso)', 1, Math.round(v.reduce((a, b) => a + b.importo, 0) * 0.3), 'n.');
    if (opz.riparazione > 0) add('Riparazione in officina (preventivo dei danni meccanici e di carrozzeria)', 1, opz.riparazione, 'n.');
    if (opz.centralina) add('Sostituzione modulo ABS/ESP e codifica della centralina', 1, 68000, 'n.');
    add('Diritti amministrativi e pratica di soccorso', 1, 1600, 'n.');
    const imponibile = v.reduce((a, b) => a + b.importo, 0), iva = Math.round(imponibile * 0.22), bollo = 200;
    return { numero: 'FT-' + new Date().getFullYear() + '/' + String(numeroFattura++).padStart(5, '0'), fornitore: 'Soccorso Stradale Ivoria di fantasia S.r.l. — P. IVA 00000000000 (fittizia)', voci: v, imponibile, ivaAliquota: 22, iva, bollo, totale: imponibile + iva + bollo };
  }

  return { versione: '1.0.0', DT, PARAMETRI, preparaPercorso, proietta, puntoAs, creaCamion, passoCamion, posaPianale, crea, avvia, impostaTraino, impostaAuto, passo, iniziaTraino, fattura, fase };
});
