// Gruppo "fucili A" del kit v2 (Italia Open World, Versione 21): fucili d'assalto e da battaglia di impostazione classica.
// Costruttori (nomi neutri, nessun nome reale; scritte incise solo con produttore e nome di fantasia del catalogo):
//   fa_girevole     otturatore girevole con pistone lungo: scatola fresata o stampata, legno massello o laminato, polimero prugna,
//                   versioni moderne con slitte, mitragliatrice leggera con canna pesante, bipiede e calcio a piede di mazza;
//   fa_tubolare     derivato con scatola fresata lunga, manetta piegata in su, calcio tubolare pieghevole (anche con bipiede e maniglia);
//   fa_rulli        chiusura ritardata a rulli: fucile con calcio in polimero, versione con legno e bipiede ripiegato,
//                   fucile di precisione con calcio regolabile e cannocchiale, mitragliatrice a nastro;
//   fa_basculante   otturatore basculante: versione con legno e versione con calciatura sintetica nera;
//   fa_maniglia     fucile d'assalto con maniglia di trasporto piatta (anche versione pesante con bipiede);
//   fa_trasparente  fucile con caricatori trasparenti, calcio a scheletro pieghevole e bipiede integrato (anche versione moderna 7,62);
//   fa_camicia      fucile da battaglia con camicia forata, calcio in linea gommato e bipiede anteriore;
//   fa_legno_lungo  fucili da battaglia con calciatura intera in legno e asta di armamento a destra (anche con tricompensatore e bipiede);
//   fa_due_pezzi    fucile semiautomatico con calcio e astina separati e lanciagranate in bocca;
//   fa_scheletro    fucile semiautomatico di precisione con calcio a scheletro in legno e cannocchiale laterale.
// Unità: mm. X avanti (verso la bocca), Y su, Z verso il lato destro; y = 0 asse della canna, x = 0 retro della scatola di culatta.
window.FAM2 = window.FAM2 || {}; window.MAP2 = window.MAP2 || {};
(function () {
  const K = WK2, T = THREE, PI = Math.PI;

  // ================================================================== aiuti comuni del gruppo (prefisso fa)
  const faScuro = () => K.mat('nero_lucido', null, { c: '#050505', r: .7 });
  const faSt = (arr, def) => arr.map(s => Object.assign({}, def, s));        // stazioni di loft con valori di base
  const faSer = (spec, pre) => pre + ' ' + (10000 + ((spec.id || 7) * 7919 + 1301) % 89999); // matricola inventata
  const faUp = (s, d) => String(s || d || '').toUpperCase();

  // tornitura con profilo che dipende dall'angolo a (0 = sopra, PI/2 = destra): prof(a) -> [[x, r], ...] sempre con lo stesso numero di punti
  function faTorniVar(prof, o) {
    o = o || {}; const N = o.seg || 24, cy = o.cy || 0, cz = o.cz || 0, pos = [], uv = [], P = [];
    for (let j = 0; j <= N; j++) P.push(prof(2 * PI * j / N));
    const n = P[0].length, pt = (i, j) => { const a = 2 * PI * j / N, q = P[j][i]; return [q[0], cy + Math.cos(a) * q[1], cz + Math.sin(a) * q[1]]; };
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < N; j++) {
      const a = pt(i, j), b = pt(i + 1, j), c = pt(i + 1, j + 1), d = pt(i, j + 1);
      pos.push(...a, ...c, ...b, ...a, ...d, ...c);
      const ua = i / (n - 1), ub = (i + 1) / (n - 1), va = .1 + .9 * j / N, vb = .1 + .9 * (j + 1) / N;
      uv.push(ua, va, ub, vb, ub, va, ua, va, ua, vb, ub, vb);
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    return K.crease(g, o.ang || 45, { edge: o.edge !== false });
  }
  // settore anulare lungo X fra i raggi ri e ro e gli angoli a0..a1 nel piano (z, y): 0 = destra, PI/2 = sopra (finestre dei freni, feritoie)
  function faSettore(x0, x1, ri, ro, a0, a1, o) {
    o = o || {}; const cy = o.cy || 0, cz = o.cz || 0;
    return K.slabX([['a', cz, cy, ro, a0, a1], ['a', cz, cy, ri, a1, a0]], x0, x1, { b: o.b === undefined ? .35 : o.b });
  }
  // cupola di un rivetto sul fianco (lato 1 = destro, -1 = sinistro) alla quota zs della superficie
  function faRivetto(x, y, zs, lato, r, h) {
    const g = K.latheX([[-.3, r], [h * .45, r * .82], [h * .85, r * .42], [h, 0]], { seg: 10 });
    g.rotateY(lato > 0 ? -PI / 2 : PI / 2); g.translate(x, y, zs); return g;
  }
  const faRodZ = (z0, z1, r, x, y, seg) => K.rod(z0, z1, r, { seg: seg || 16 }).rotateY(-PI / 2).translate(x, y, 0);   // cilindro lungo Z
  const faRodY = (y0, y1, r, x, z, seg) => K.rod(y0, y1, r, { seg: seg || 16 }).rotateZ(PI / 2).translate(x, 0, z);     // cilindro lungo Y
  // disco rivolto verso +Z (dir 1) o -Z (dir -1): fori finti su superfici laterali
  const faDiscZ = (x, y, z, r, dir, seg) => K.discX(0, 0, 0, r, 1, seg || 12).rotateY(dir > 0 ? -PI / 2 : PI / 2).translate(x, y, z);

  // pittore nello spazio UV di loft e torniture (u lungo X da 0 a 1, v attorno alla sezione da .1 a 1): rilievo, colore, rugosità
  function faTela(W, H, rough) {
    const mk = () => K.canvasOf(W, H), hc = mk(), ac = mk(), rc = mk(), hx = hc.getContext('2d'), ax = ac.getContext('2d'), rx = rc.getContext('2d');
    const g = v => { const k = Math.round(Math.max(0, Math.min(1, v)) * 255); return 'rgb(' + k + ',' + k + ',' + k + ')'; };
    hx.fillStyle = g(.5); hx.fillRect(0, 0, W, H); ax.fillStyle = '#ffffff'; ax.fillRect(0, 0, W, H); rx.fillStyle = g(rough === undefined ? .5 : rough); rx.fillRect(0, 0, W, H);
    const each = (f, fn) => { for (const [c, val] of [[hx, f.h === undefined ? undefined : .5 + f.h * .5], [ax, f.a], [rx, f.r]]) if (val !== undefined) { c.fillStyle = g(val); fn(c); } };
    const api = {
      poly(pts, f) { each(f, c => { c.beginPath(); pts.forEach((p, i) => { const X = p[0] * W, Y = (1 - p[1]) * H; if (i) c.lineTo(X, Y); else c.moveTo(X, Y); }); c.closePath(); c.fill(); }); },
      rect(u0, v0, u1, v1, f) { api.poly([[u0, v0], [u1, v0], [u1, v1], [u0, v1]], f); },
      ell(u, v, du, dv, f) { each(f, c => { c.beginPath(); c.ellipse(u * W, (1 - v) * H, Math.abs(du * W), Math.abs(dv * H), 0, 0, 2 * PI); c.fill(); }); },
      // macchie leggere di colore e rugosità (usura), poche ellissi
      blots(n, f) { f = f || {}; for (let i = 0; i < n; i++) { const u = K.hash(i, 3, f.seed || 1), v = K.hash(i, 7, f.seed || 1), s = 3 + K.hash(i, 9, f.seed || 1) * 20;
        ax.fillStyle = 'rgba(0,0,0,' + (f.a || .05) + ')'; rx.fillStyle = 'rgba(255,255,255,' + (f.r || .05) + ')'; for (const c of [ax, rx]) { c.beginPath(); c.ellipse(u * W, v * H, s * 2.4, s, 0, 0, 2 * PI); c.fill(); } } },
      canvases: { hc, ac, rc },
      done(k) { const nm = K.heightToNormal(hc, k || 2); return { map: K.texOf(ac, true), normalMap: K.texOf(nm, false), roughnessMap: K.texOf(rc, false) }; }
    };
    return api;
  }

  // tela che parte dalla trama del legno del kit (i materiali legno ignorano trame proprie): poi si disegnano feritoie, scanalature...
  function faTelaLegno(kind, W, H) {
    const tl = faTela(W, H, .4), w = K.wood(kind), ac = tl.canvases.ac.getContext('2d'), rc = tl.canvases.rc.getContext('2d');
    ac.drawImage(w.map.image, 0, 0, W, H); rc.drawImage(w.roughnessMap.image, 0, 0, W, H); return tl;
  }
  // materiale "legno" con trame disegnate (stessa resa del legno del kit)
  const faMatLegno = (det, c) => { const m = K.mat('bachelite', det, { ns: .9, c: c || '#ffffff' }); m.envMapIntensity = .75; return m; };

  // ---------------- caricatore a fianchi piani (curvo o dritto) come estrusione del profilo laterale
  // o: top [x,y] centro della bocca (dentro l'arma), ang (inclinazione iniziale in avanti, rad), R (raggio della linea media, 0 = dritto),
  //    L (lunghezza lungo la linea), d0/d1 (profondità davanti-dietro in alto e in fondo)
  function faCurva(o) {
    const R = o.R || 1e5, ang = o.ang || 0, C = [o.top[0] + R * Math.cos(ang), o.top[1] + R * Math.sin(ang)], ph0 = PI + ang, L = o.L;
    const d = s => o.d0 + (o.d1 - o.d0) * Math.max(0, Math.min(1, s / L));
    const pt = (s, q) => { const ph = ph0 + s / R; return [C[0] + (R + q) * Math.cos(ph), C[1] + (R + q) * Math.sin(ph)]; };   // q > 0 verso il retro
    function band(s0, s1, q0, q1, rr, step) {   // striscia fra q0(s) e q1(s), da s0 a s1, raccordo rr agli angoli
      const m = Math.max(2, Math.ceil((s1 - s0) / (step || 6))), p = [];
      for (let i = 0; i <= m; i++) { const s = s0 + (s1 - s0) * i / m, q = pt(s, q0(s)); p.push(i === 0 || i === m ? [q[0], q[1], rr] : q); }
      for (let i = m; i >= 0; i--) { const s = s0 + (s1 - s0) * i / m, q = pt(s, q1(s)); p.push(i === 0 || i === m ? [q[0], q[1], rr] : q); }
      return p;
    }
    return {
      R, C, L, d, pt, band, ang: s => ph0 + s / R,
      outline: rr => band(0, L, s => -d(s) / 2, s => d(s) / 2, rr === undefined ? 2 : rr),
      rib: (s0, s1, f, wr) => band(s0, s1, s => f * d(s) - wr / 2, s => f * d(s) + wr / 2, wr * .45),   // costola alla frazione f (-.5 davanti, .5 dietro)
      // piastra trasversale (fondello) all'ascissa s: sporgenze davanti/dietro, spessore verso il basso, mezza larghezza
      plate: (s, lipF, lipR, th, wz, rr) => { const dd = d(s), ph = ph0 + s / R;
        const g = K.slab([[-dd / 2 - lipF, -1.2, rr * .4], [dd / 2 + lipR, -1.2, rr * .4], [dd / 2 + lipR, th, rr], [-dd / 2 - lipF, th, rr]], -wz, wz, { b: Math.min(1.2, th * .35) });
        const p = pt(s, 0); return K.xf(g, { r: [0, 0, ph], t: [p[0], p[1], 0] }); }
    };
  }
  // caricatore completo (corpo, costole, dorso, fondello) nella parte 'caricatore'
  function faCaricatore(A, cv, o) {
    const w = o.w, mB = o.mat;
    A.add(K.slab(cv.outline(o.rr === undefined ? 2.5 : o.rr), -w, w, { b: o.b === undefined ? 1.6 : o.b, uv: o.uv }), o.matCorpo || mB, 'caricatore');
    for (const f of (o.costole || [])) for (const s of [-1, 1]) {
      const z0 = s > 0 ? w - .4 : -w - (o.hr || .9), z1 = s > 0 ? w + (o.hr || .9) : -w + .4;
      A.add(K.slab(cv.rib(o.s0, o.s1, f, o.wr || 3.4), z0, z1, s > 0 ? { bL: 0, bR: .45 } : { bL: .45, bR: 0 }), mB, 'caricatore');
    }
    if (o.dorso) A.add(K.slab(cv.band(o.s0, cv.L - 2, s => cv.d(s) / 2 - .8, s => cv.d(s) / 2 + 1.3, 1), -3.2, 3.2, { b: .5 }), mB, 'caricatore');
    if (o.piede !== false) A.add(cv.plate(cv.L, o.lipF === undefined ? 2 : o.lipF, o.lipR === undefined ? 2.5 : o.lipR, o.th || 4, w + (o.pw === undefined ? 1.2 : o.pw), 2), o.matPiede || mB, 'caricatore');
    const pF = cv.pt(0, -cv.d(0) / 2); A.pivot('caricatore', [pF[0], pF[1], 0]);
  }
  // reticolo inciso sui fianchi di un caricatore (trama del pittore): righe x colonne fra s0 e s1
  function faCaricReticolo(cv, bb, o) {
    const p = K.painter(bb, { w: 512, h: 512, rough: o.rough || .62 });
    const rows = o.righe || 8, cols = o.colonne || 2, s0 = o.s0, s1 = o.s1, gap = o.gap || 2.2;
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
      const sa = s0 + (s1 - s0) * i / rows + gap / 2, sb = s0 + (s1 - s0) * (i + 1) / rows - gap / 2;
      const fa = -.36 + .72 * j / cols, fb = -.36 + .72 * (j + 1) / cols;
      const c = cv.band(sa, sb, s => fa * cv.d(s) + gap / 2, s => fb * cv.d(s) - gap / 2, 1.2, 4);
      p.fill('LR', c, { h: -.75, a: .78 });
    }
    if (o.testo) p.text('LR', o.testo, cv.pt(o.s1 + 8, 0)[0], cv.pt(o.s1 + 8, 0)[1], 3.2, { a: .7 });
    p.noise({ a: .08, r: .12, seed: 21 }); p.walls({ r: .6 });
    return p.done(2.2);
  }
  // bipiede: collare attorno alla canna (raggio rc) e due gambe; aperto o ripiegato all'indietro (dir -1) / in avanti (dir 1). Parte 'bipiede'.
  function faBipiede(A, x, rc, o) {
    o = o || {}; const m = o.mat || K.mat('nero'), L = o.len || 250, y0 = -rc - 7, dir = o.dir || -1, zl = o.zl || 7.5;
    A.add(K.latheX([[x - 9, rc - .5], [x - 9, rc + 2.4], [x - 8, rc + 3.4], [x + 8, rc + 3.4], [x + 9, rc + 2.4], [x + 9, rc - .5]], { seg: 24 }), m, 'bipiede');
    A.add(K.slab([[x - 8, y0 - 6, 2], [x + 8, y0 - 6, 2], [x + 8, -rc + 1, 0], [x - 8, -rc + 1, 0]], -zl - 3.5, zl + 3.5, { b: 1 }), m, 'bipiede');
    for (const s of [-1, 1]) {
      const leg = K.mergeG([K.rod(0, L * .58, 4.3, { seg: 12 }), K.rod(L * .55, L, 3.3, { seg: 10 }), K.latheX([[L, 0], [L, 5.8], [L + 2.5, 6.6], [L + 7, 4.4], [L + 8, 0]], { seg: 12 })]);
      if (o.aperto) { leg.rotateZ(-PI / 2 + .1 * dir); leg.rotateX(-s * .3); leg.translate(x, y0 - 3, s * zl); }
      else { if (dir < 0) leg.rotateY(PI); leg.rotateZ(dir < 0 ? .045 : -.045); leg.translate(x, y0 - 3, s * zl); }
      A.add(leg, m, 'bipiede');
      A.add(faRodZ(s > 0 ? zl - 4.5 : -zl - 4.5, s > 0 ? zl + 4.5 : -zl + 4.5, 3, x, y0 - 3, 12), m, 'bipiede');
    }
    A.pivot('bipiede', [x, y0 - 3, 0]);
  }
  // compensatore obliquo: tubo con la bocca tagliata di traverso (il labbro in basso a sinistra sporge di "cut")
  function faObliquo(A, x0, L, ro, ri, cut, m, dk) {
    A.add(faTorniVar(a => { const k = (1 + Math.cos(a + .4)) / 2, xe = x0 + L - cut * k;
      return [[x0, ri], [x0, ro - .7], [x0 + .7, ro], [xe - .8, ro], [xe, ro - .8], [xe, ri + .5], [xe - .5, ri], [x0 + 3, ri]]; }, { seg: 28 }), m);
    A.add(K.discX(x0 + L - cut - 2, 0, 0, ri + .1, 1, 16), dk);
  }
  // freno di bocca a camera con due grandi finestre laterali (settori sopra e sotto)
  function faFrenoFinestre(A, x0, r, m, dk, o) {
    o = o || {}; const L = o.L || 82, xa = x0 + (o.la || 22), xb = x0 + L - (o.lf || 14), ri = r - (o.sp || 2.2), aw = o.aw || .3;
    A.add(K.latheX([[x0, 0], [x0, r - 1.2], [x0 + 1.2, r], [xa + .4, r]], { seg: 28 }), m);
    for (const [a0, a1] of [[PI * aw, PI * (1 - aw)], [PI * (1 + aw), PI * (2 - aw)]]) A.add(faSettore(xa, xb, ri, r, a0, a1, { b: .45 }), m);
    A.add(K.latheX([[xb - .4, r], [x0 + L - 1.2, r], [x0 + L, r - 1.2], [x0 + L, (o.rb || 4.4) + .6], [x0 + L - .6, o.rb || 4.4], [x0 + L - 3, o.rb || 4.4]], { seg: 28 }), m);
    A.add(K.discX(xa + .05, 0, 0, ri, 1, 24), dk); A.add(K.discX(xb - .05, 0, 0, ri, -1, 24), dk);              // pareti della camera
    A.add(K.rod(xa, xb, (o.rb || 4.4) + 1.4, { seg: 16 }), dk);                                                // manicotto del foro di passaggio
    if (o.porte) for (const [px, a] of o.porte) A.add(K.xf(faDiscZ(0, 0, 0, 1.7, 1, 10), { r: [-a, 0, 0], t: [px, 0, 0] }).translate(0, Math.sin(a) * (r + .05), Math.cos(a) * (r + .05) - (0)), dk);
  }
  // spegnifiamma a feritoie: anello posteriore, denti fra le feritoie (larghe sl mm), anello anteriore se chiuso; feritoia in basso omessa se chiusoSotto
  function faSpegni(A, x0, L, r, m, dk, o) {
    o = o || {}; const n = o.n || 4, lb = o.lb || 12, lf = o.chiuso ? (o.lf || 5) : 0, ri = o.ri || r - 2.2, sl = o.sl || 3.2;
    const xa = x0 + lb, xb = x0 + L - lf, da = sl / r, a00 = o.a0 === undefined ? PI / 2 : o.a0;
    A.add(K.latheX([[x0, 0], [x0, r - .8], [x0 + .8, r], [xa + .3, r]], { seg: 28 }), m);
    const sl0 = []; for (let k = 0; k < n; k++) { const a = a00 + k * 2 * PI / n; if (o.chiusoSotto && Math.abs(Math.sin(a) + 1) < .05) continue; sl0.push(a); }
    for (let k = 0; k < sl0.length; k++) { const a = sl0[k], b = k + 1 < sl0.length ? sl0[k + 1] : sl0[0] + 2 * PI; A.add(faSettore(xa, xb + (lf ? .3 : 0), ri, r, a + da / 2, b - da / 2, { b: .3 }), m); }
    if (lf) A.add(K.latheX([[xb - .3, r], [x0 + L - .8, r], [x0 + L, r - .8], [x0 + L, ri + .4], [x0 + L - .5, ri]], { seg: 28 }), m);
    A.add(K.rod(xa - 1, xb - (lf ? 0 : 1), ri - .05, { seg: 18 }), dk);
  }

  // ======================================================================================================
  // FAMIGLIA 1: otturatore girevole con pistone lungo e scatola di culatta a coperchio (sei varianti)
  // v: 'fresata' (scatola fresata con scassi di alleggerimento, legno massello, caricatore liscio, coprivite in bocca, blocco del gas a 90°),
  //    'stampata' (lamiera con rilievo sopra il pozzetto, legno laminato con rigonfiamenti, compensatore obliquo, blocco a 45°, caricatore a costole),
  //    'cal545' (polimero prugna, calcio con scanalature, freno a camera con finestre, caricatore prugna meno curvo),
  //    'mod12' (coperchio rigido con slitta lunga e diottra, astina con asole e slitta, freno lungo, calcio telescopico a scheletro, caricatore a reticolo),
  //    'mod203' (coperchio con slitta, astina a quattro slitte, calcio telescopico pieghevole su tubo, caricatore nero a costole),
  //    'leggera' (canna pesante lunga, bipiede ripiegato, calcio a piede di mazza, caricatore lungo da 40)
  FAM2.fa_girevole = function (spec, o) {
    o = o || {}; spec = spec || {};
    const v = o.v || 'stampata', A = K.asm('fa_girevole');
    const is47 = v === 'fresata', is74 = v === 'cal545', is12 = v === 'mod12', is203 = v === 'mod203', isP = v === 'leggera', mod = is12 || is203;
    const RL = 256, RB = -32, RT = 8, RW = 14.6;                 // scatola: lunghezza, fondo, sommità dei fianchi, mezza larghezza
    const prod = faUp(spec.produttore, 'Kama Arsenal'), nome = faUp(spec.nome, ''), ser = faSer(spec, 'KA');
    // ---------------- materiali
    const mSt = K.mat('nero'), mBlu = K.mat('brunito', null, { r: .34 }), mDk = faScuro();
    let mWood, mGrip, mMag;
    if (is47) { mWood = K.mat('legno_betulla', null, { c: '#a68068' }); mGrip = K.mat('legno_scuro', null, { c: '#c09878' }); mMag = K.mat('nero', null, { c: '#2b2d2f', r: .4 }); }
    else if (is74) { mWood = K.mat('prugna', null, { tile: 'grana', rep: [4, 8], ns: .3, c: '#3c1c18' }); mGrip = K.mat('prugna', null, { tile: 'ribs', rep: [1, 5], ns: .5, c: '#3c1c18' }); mMag = K.mat('prugna', null, { c: '#45211a', r: .5 }); }
    else if (mod) { mWood = K.mat('polimero', null, { tile: 'grana', rep: [6, 8], ns: .25 }); mGrip = K.mat('polimero', null, { tile: 'stipple', rep: [3, 4], ns: .6 }); mMag = K.mat('polimero', null, { r: .6 }); }
    else { mWood = K.mat('legno_laminato', null, { c: '#9c7664' }); mGrip = K.mat('bachelite', null, { tile: 'ribs', rep: [1, 7], ns: 1.1, c: '#4a1e10' }); mMag = K.mat('parker', null, { c: '#262827', r: .5 }); }

    // ---------------- scatola di culatta: fianchi con trame (rivetti, perni, scritte, segni del selettore)
    const rb = [-2, RB - 4, RL + 2, RT + 4];
    const pR = K.painter(rb, { w: 1024, h: 512, rough: is47 ? .42 : .5 });
    if (!is47) { const dm = K.rrect(163, RB + 6, 197, RB + 15, 3); pR.fill('LR', dm, { h: -.75, a: .84 }); }      // rilievo guida del caricatore
    pR.line('LR', [[3, RB + 2.6], [RL - 2, RB + 2.6]], .6, { h: -.35, a: .9 });                                      // piega del bordo inferiore
    for (const [x, y] of [[101, -20], [121, -20], [83, -7]]) pR.pin('LR', x, y, 2.3, { h: .5, a: 1.1 });             // perni del gruppo di scatto
    pR.line('L', [[77, -3], [83, -7], [101, -17.5], [121, -17.5], [125, -21]], .8, { h: .6, a: 1.15 });              // molla di ritegno dei perni
    pR.text('L', prod, 116, -2.8, 2.9, { spacing: 3 });
    pR.text('L', nome, 116, -8.6, 2.6, { spacing: 2 });
    pR.text('L', ser, 42, -24, 2.6, { spacing: 2 });
    pR.text('R', 'АВ', 203, -12, 3.2); pR.text('R', 'ОД', 203, -20, 3.2);                                          // automatico / colpo singolo
    pR.text('R', ser, 236, -25, 2.2);
    pR.noise({ a: .14, r: .2, seed: 5 + (spec.id || 0) }); pR.walls({ r: .55 });
    const mR = K.mat('nero', pR.done(2.4), { ns: .8 });
    const prL = [[0, RB + 7, 2], [6, RB, 2], [RL, RB, 1.5], [RL, RT], [0, RT]];
    const prR = [[0, RB + 7, 2], [6, RB, 2], [RL, RB, 1.5], [RL, RT], [233, RT, .6], [233, -.5, 1.2], [208, -.5, 1], [206, -7, 1.5], [150, -7, 1.5], [148, -.5, 1], [92, -.5, 1.2], [92, RT, .6], [0, RT]];
    if (is47) {   // fresata: pelle esterna con lo scasso di alleggerimento sopra il pozzetto del caricatore
      const cut = [[150, RB + 7, 2.5], [228, RB + 7, 2.5], [228, RB + 17, 2.5], [150, RB + 17, 2.5]], sk = 2.4;
      A.add(K.slab(prL, -RW, -RW + sk, { bL: 1.1, bR: 0, holes: [cut], uv: rb }), mR);
      A.add(K.slab(prL, -RW + sk, 0, { b: 0, uv: rb }), mR);
      A.add(K.slab(prR, 0, RW - sk, { b: 0, uv: rb }), mR);
      A.add(K.slab(prR, RW - sk, RW, { bL: 0, bR: 1.1, holes: [cut], uv: rb }), mR);
    } else {
      A.add(K.slab(prL, -RW, 0, { bL: 1.3, bR: 0, uv: rb }), mR);
      A.add(K.slab(prR, 0, RW, { bL: 0, bR: 1.3, uv: rb }), mR);
    }
    // rivetti dei tappi (posteriore, centrale, anteriore)
    const rv = is47 ? [[139, -25], [241, -25]] : [[9, -3], [9, -19], [21, -26], [143, -6], [143, -21], [224, -6], [224, -22], [240, -14]];
    if (isP) rv.push([249, -6], [249, -22]);
    for (const [x, y] of rv) { A.add(faRivetto(x, y, RW, 1, 2.4, .9), mSt); A.add(faRivetto(x, y, -RW, -1, 2.4, .9), mSt); }

    // ---------------- otturatore: portaotturatore, testina girevole visibile nella finestra, manetta di armamento (parte mobile)
    const hx = 216;
    A.add(K.box(96, -3, -9, 207, 7.4, 12.6, .8), mBlu, 'otturatore');
    A.add(K.rod(150, 216, 8.8, { cy: -.5, seg: 18 }), mBlu, 'otturatore');
    A.add(K.box(168, -7.6, 5, 200, -3.4, 9.4, .4), mBlu, 'otturatore');                       // estrattore
    A.add(K.box(hx - 8, -1, 0, hx + 8, 5.6, 12.6, .6), mBlu, 'otturatore');
    A.add(K.box(hx - 5.5, .3, 10, hx + 5.5, 5.3, 24.5, .9), mBlu, 'otturatore');               // braccio della manetta
    const kr = mod ? 7.6 : 6.4;
    A.add(K.latheX([[0, 0], [0, kr - 1], [1.4, kr], [10.5, kr + .3], [12.8, kr - 1], [13.8, kr * .45], [14, 0]], { seg: 20 }).rotateY(-PI / 2).translate(hx, 2.8, 22.5), mBlu, 'otturatore');
    if (mod) A.add(K.latheX([[0, kr], [12, kr + .3]], { seg: 20 }).rotateY(-PI / 2).translate(hx, 2.8, 23.5), K.mat('polimero', null, { tile: 'knurl', rep: [4, 3], ns: .8 }), 'otturatore');

    // ---------------- coperchio della scatola
    const cT = is12 ? 30 : RT + 14.5, cW = RW + .6, cB = RT - 2;
    const cv = [{ x: 2.5, t: cT - 6, b: cB, w: cW - 1.2, lin: 1 }, { x: 7.5, t: cT - .5, b: cB, w: cW }];
    if (!is47 && !is12) for (const xr of [26, 42, 58, 74, 90, 106]) cv.push({ x: xr - 2.6, t: cT, w: cW, b: cB }, { x: xr - 1, t: cT + .75, w: cW + .7, b: cB }, { x: xr + 1, t: cT + .75, w: cW + .7, b: cB }, { x: xr + 2.6, t: cT, w: cW, b: cB });
    cv.push({ x: 238, t: cT, b: cB, w: cW });
    A.add(K.loftX(faSt(cv, { nt: is12 ? 5 : 2.3, nb: 10 }), { K: 32, step: 0 }), mSt);
    A.add(K.box(-1.2, RT + 4, -3.6, 8, RT + 10.5, 3.6, 1), mSt);                                 // pulsante della guida della molla di recupero
    if (is12 || is203) WC.put(A, WC.rail(is12 ? 14 : 24, is12 ? 232 : 224, cT - .4, { mat: mSt }));

    // ---------------- blocco della tacca di mira con alzo a ritto, slitta e rampe (non nella versione con diottra)
    let yNotch = 33;
    if (!is12) {
      A.add(K.slab([[230, -8, 2], [236, -13.5, 4], [292, -13.5, 4], [300, -8, 2], [300, 30.5, 2.5], [292, 32, 2], [286, 25, 2], [244, 25, 3], [230, 24.5, 1]], -12.4, 12.4, { b: 1.8 }), mSt);
      for (const s of [-1, 1]) A.add(K.slab([[250, 24], [287, 24], [287, 30.5, 1.5], [270, 28.8, 14], [252, 26.6, 2]], s > 0 ? 6 : -9.4, s > 0 ? 9.4 : -6, { b: .6 }), mSt);
      A.add(K.slab([[245, 27.4, .6], [288, 26.4, .6], [289, 28.8, 1], [247, 30.4, .8]], -5.2, 5.2, { b: .45 }), mSt);       // ritto dell'alzo
      A.add(K.slabX([[-5.6, 29], [5.6, 29], [5.6, 34.6, .6], [1.3, 34.6, .3], [1.3, 32.4, .9], [-1.3, 32.4, .9], [-1.3, 34.6, .3], [-5.6, 34.6, .6]], 243.6, 247.6, { b: .45 }), mSt);
      yNotch = 33;
      A.add(K.box(266, 25.6, -7.2, 276, 31.4, 7.2, .8), mSt);                                                      // cursore
      for (const s of [-1, 1]) A.add(faRodZ(s > 0 ? 7 : -8.8, s > 0 ? 8.8 : -7, 2, 271, 28.6, 12), mSt);
      A.add(K.slab([[287, 12, 2], [298, 12, 2], [298, 25, 3], [292, 29, 2], [287, 25, 2]], 12.2, 13.9, { b: .5 }), mSt);  // leva del tubo del gas
      if (isP) A.add(faRodZ(9, 13, 2.6, 279, 27, 14), mSt);                                                         // pomello di deriva
    } else {
      A.add(K.slab([[230, -8, 2], [236, -13.5, 4], [256, -13.5, 4], [262, -8, 2], [262, 29.6, 2], [230, 29.6, 1]], -13.2, 13.2, { b: 1.6 }), mSt);   // cerniera del coperchio
      A.add(faRodZ(-14.4, 14.4, 3.2, 250, 24, 16), mSt);
      // diottra posteriore sulla slitta
      const yr = cT + 9;
      A.add(K.box(14, yr, -10.6, 36, yr + 4, 10.6, 1), mSt);
      for (const s of [-1, 1]) A.add(K.slab([[16, yr + 3], [34, yr + 3], [34, yr + 16, 3], [28, yr + 20, 3], [16, yr + 18, 3]], s > 0 ? 7.2 : -10.4, s > 0 ? 10.4 : -7.2, { b: .7 }), mSt);
      A.add(K.slabX(K.circ(0, yr + 12, 5.6, 24), 22, 26.5, { b: .6, holes: [K.circ(0, yr + 12, 1.5, 14)] }), mSt);
      A.add(K.box(22.5, yr + 3, -2.5, 26, yr + 7, 2.5, .4), mSt);
      yNotch = yr + 12;
    }

    // ---------------- canna, tubo del gas, guardamano
    const xMz = isP ? 807 : 632, rB = isP ? 10.8 : 9.6, rF = isP ? 9.4 : 8.1;
    A.add(K.latheX([[226, 0], [226, 11.5], [302, 11.5], [304, rB], [470, rB], [472, rF], [xMz - 6, rF - .2], [xMz - 6, 7.1], [xMz, 7.1], [xMz, 0]], { seg: 26 }), mBlu);
    if (!is12) {
      A.add(K.rod(296, 472, 9.4, { cy: 21, seg: 22 }), mSt);
      for (const xh of [458, 464]) for (const s of [-1, 1]) A.add(faDiscZ(xh, 22, s * 9.45, 1.6, s, 10), mDk);
    }
    if (!mod) {
      // guardamano superiore sul tubo del gas e inferiore con i rigonfiamenti per il palmo
      const tw = is47 ? 14.6 : 15.6;
      A.add(K.loftX(faSt([{ x: 298, t: 31.2, b: 11, w: tw - 2 }, { x: 304, t: 34, b: 10, w: tw - .4 }, { x: 330, t: 34.6, b: 10, w: tw }, { x: 420, t: 34.2, b: 10, w: tw - .2 }, { x: 444, t: 33, b: 10.4, w: tw - 1 }, { x: 452, t: 30.6, b: 12, w: 11.6 }], { nt: 2.3, nb: 6 }), { K: 30, step: 6 }), mWood);
      const lw = is47 ? [16, 16.6, 16.8, 16.4] : [17.4, 19.2, 18.4, 16.6];
      A.add(K.loftX(faSt([{ x: 289, t: 7.4, b: -20, w: 13.6 }, { x: 296, t: 7.8, b: -27.5, w: lw[0] }, { x: 330, t: 7.8, b: -31.5, w: lw[1] }, { x: 400, t: 7.8, b: -31.5, w: lw[2] }, { x: 452, t: 7.8, b: -29, w: lw[3] }, { x: 466, t: 7.2, b: -21, w: 13.6 }], { nt: 10, nb: 2.6 }), { K: 32, step: 5 }), mWood);
      if (is74) for (const s of [-1, 1]) for (const yy of [-12, -19]) A.add(K.box(312, yy - 1.2, s > 0 ? 17.6 : -18.6, 440, yy + 1.2, s > 0 ? 18.6 : -17.6, .5), mWood);   // nervature
      // fermi del guardamano: coppa posteriore con leva, coppa anteriore
      A.add(K.loftX(faSt([{ x: 280.5, t: 8, b: -18, w: 13.4 }, { x: 283, t: 8.6, b: -24.6, w: 15.6 }, { x: 292, t: 8.6, b: -25, w: 16.2 }], { nt: 10, nb: 2.6 }), { K: 28, step: 0 }), mSt);
      A.add(K.slab([[283.5, -4, 1], [290, -4, 1], [291, 9, 2], [287, 11.5, 2], [283.5, 7, 1]], 15.4, 17, { b: .5 }), mSt);
      A.add(K.loftX(faSt([{ x: 459, t: 8.2, b: -22.5, w: 14.6 }, { x: 468, t: 8.2, b: -21, w: 14 }, { x: 470, t: 6, b: -16, w: 12 }], { nt: 10, nb: 2.6 }), { K: 28, step: 0 }), mSt);
    } else if (is12) {
      // astina unica con asole sui fianchi e slitta in alto
      const hb = [262, -27, 476, 31];
      const pH = K.painter(hb, { w: 1024, h: 256, rough: .68 });
      for (let i = 0; i < 6; i++) for (const yy of [-13, 6]) { const x0 = 282 + i * 30; pH.fill('LR', K.rrect(x0, yy - 3.6, x0 + 19, yy + 3.6, 3.4), { h: -1, a: .15 }); }
      pH.text('L', prod, 300, 22, 3, { a: .7 }); pH.noise({ a: .05, r: .08, seed: 9 }); pH.wallFill({ r: .7 });
      const mH = K.mat('polimero', pH.done(2.6), { ns: .9 });
      A.add(K.slab([[262, -25, 5], [476, -25, 5], [476, 29.6, 2], [262, 29.6, 2]], -17, 17, { b: 4, uv: hb }), mH);
      for (let i = 0; i < 5; i++) A.add(K.box(286 + i * 36, -25.2, -4, 306 + i * 36, -24.4, 4, .3), mDk);
      WC.put(A, WC.rail(264, 474, 29.2, { mat: mSt }));
    } else {
      // astina a quattro slitte (alluminio) con coperchio liscio in alto
      const mA = K.mat('anod');
      A.add(K.slab([[284, -24, 3], [470, -24, 3], [470, 31.5, 4], [284, 31.5, 4]], -15.6, 15.6, { b: 1.6 }), mA);
      WC.put(A, WC.rail(290, 466, 24, { dir: 'giu', mat: mA })); WC.put(A, WC.rail(300, 456, 15.6, { dir: 'dx', mat: mA })); WC.put(A, WC.rail(300, 456, 15.6, { dir: 'sx', mat: mA }));
      for (let i = 0; i < 6; i++) for (const s of [-1, 1]) A.add(faDiscZ(296 + i * 30, 24, s * 15.65, 2.6, s, 12), mDk);
    }
    // blocco del gas (45° o 90°) con anello sulla canna, cilindro del gas e piede per la bacchetta
    const gx = 470, g45 = v === 'stampata' || isP || is12;
    A.add(K.latheX([[gx, 9], [gx, 12.2], [gx + 1, 13], [gx + 39, 13], [gx + 40, 12], [gx + 40, 8]], { seg: 26 }), mSt);
    if (g45) {
      const X0 = gx + 24;
      A.add(faTorniVar(a => [[gx - 3, 0], [gx - 3, 11], [gx - 2, 12], [X0 - 12 * Math.cos(a) - .8, 12], [X0 - 11.2 * Math.cos(a), 11.2], [X0, 0]], { cy: 21, seg: 24 }), mSt);
      A.add(K.slab([[gx + 1, 1], [gx + 39, 1], [gx + 39, 6], [gx + 24, 21], [gx + 1, 21]], -7.5, 7.5, { b: 1 }), mSt);
    } else {
      const X0 = gx + 34;
      A.add(K.latheX([[gx - 3, 0], [gx - 3, 11], [gx - 2, 12], [X0 - 1, 12], [X0, 11], [X0, 0]], { cy: 21, seg: 24 }), mSt);
      A.add(K.slab([[gx + 1, 1], [gx + 39, 1], [gx + 39, 7], [X0, 11], [X0, 21], [gx + 1, 21]], -7.5, 7.5, { b: 1 }), mSt);
    }
    A.add(K.slab([[gx + 6, -9], [gx + 22, -9], [gx + 22, -16, 2], [gx + 18, -19.5, 2], [gx + 10, -19.5, 2], [gx + 6, -16, 2]], -4.5, 4.5, { b: .6 }), mSt);
    if (!mod) WC.put(A, WC.swivel(gx + 18, 4, -14.2, { r: 6.2, t: 1.3, mat: mSt }));
    // blocco del mirino a orecchie con baionetta (o mirino sul blocco del gas nella versione moderna 12)
    let fx = xMz - 36, yPost = 34;
    if (!is12) {
      const yE = isP ? 44 : 40, yP = isP ? 38 : 34;
      A.add(K.latheX([[fx, 6], [fx, 10.2], [fx + 1, 11], [fx + 31, 11], [fx + 32, 10.2], [fx + 32, 6]], { seg: 24 }), mSt);
      A.add(K.slab([[fx + 2, 8], [fx + 30, 8], [fx + 29, 18, 3], [fx + 23, yP - 7, 3], [fx + 9, yP - 7, 3], [fx + 3, 18, 3]], -5.6, 5.6, { b: 1 }), mSt);
      for (const s of [-1, 1]) A.add(K.slab([[fx + 4, 8], [fx + 28, 8], [fx + 28, yE - 9, 4], [fx + 22, yE, 4], [fx + 11, yE, 4], [fx + 4, yE - 9, 4]], s > 0 ? 5.6 : -8.8, s > 0 ? 8.8 : -5.6, { b: .8 }), mSt);
      A.add(faRodZ(-5.6, 5.6, 4.4, fx + 16, yP - 8, 16), mSt);
      A.add(faRodY(yP - 8, yP, 1.15, fx + 16, 0, 12), mSt);
      A.add(K.slab([[fx + 4, -9], [fx + 31, -9], [fx + 31, -14, 1], [fx + 27, -17.5, 1], [fx + 8, -17.5, 1], [fx + 4, -14, 1]], -4.2, 4.2, { b: .6 }), mSt);   // dente della baionetta
      yPost = yP;
    } else {
      const yE = cT + 9 + 18, yP = cT + 9 + 12;
      A.add(K.slab([[gx + 8, 10], [gx + 34, 10], [gx + 34, yE - 10, 3], [gx + 28, yE - 14, 3], [gx + 14, yE - 14, 3], [gx + 8, yE - 10, 3]], -5.6, 5.6, { b: 1 }), mSt);
      for (const s of [-1, 1]) A.add(K.slab([[gx + 10, 12], [gx + 32, 12], [gx + 32, yE - 7, 4], [gx + 27, yE, 4], [gx + 15, yE, 4], [gx + 10, yE - 7, 4]], s > 0 ? 5.6 : -8.6, s > 0 ? 8.6 : -5.6, { b: .8 }), mSt);
      A.add(faRodY(yE - 14, yP, 1.2, gx + 21, 0, 12), mSt);
      fx = gx; yPost = yP;
    }
    // bacchetta di pulizia sotto la canna
    if (!is12) { A.add(K.rod(gx + 4, xMz - 4, 3, { cy: -15.5, seg: 12 }), mBlu); A.add(K.box(xMz - 14, -19, -3.4, xMz - 3, -12, 3.4, .8), mBlu); }

    // ---------------- dispositivo di bocca
    let xEnd = xMz;
    if (v === 'stampata') { faObliquo(A, xMz - 5, 33, 10.6, 4.4, 11, mSt, mDk); xEnd = xMz + 28; }
    else if (is74 || is203) { faFrenoFinestre(A, xMz - 5, is203 ? 12 : 11, mSt, mDk, { L: 84, la: 24, lf: 15, rb: is203 ? 4.6 : 3.4 }); xEnd = xMz + 79; }
    else if (is12) { faFrenoFinestre(A, xMz - 5, 12.6, mSt, mDk, { L: 92, la: 20, lf: 22, aw: .26, rb: 3.6 }); A.add(K.latheX([[xMz + 67, 12.8], [xMz + 71, 13.4], [xMz + 77, 13.4], [xMz + 81, 12.8]], { seg: 28 }), mSt); xEnd = xMz + 87; }
    else { A.add(K.latheX([[xMz - 6, 7.4], [xMz - 6, 8.8], [xMz - 5, 9.4], [xMz + 6, 9.4], [xMz + 7, 8.6], [xMz + 7, 4.6], [xMz + 6, 4.2]], { seg: 24 }), mSt); A.add(K.discX(xMz + 1, 0, 0, 4.3, 1, 14), mDk); xEnd = xMz + 7; }
    if (isP) faBipiede(A, xMz - 54, rF, { len: 262, dir: -1, mat: mSt });

    // ---------------- calcio
    let xButt, yButt;
    if (!mod) {
      let st;
      if (is47) st = [{ x: 0, t: 6, b: -28, w: 14 }, { x: -12, t: 3.6, b: -33, w: 14.6 }, { x: -40, t: -1.5, b: -46, w: 15.6 }, { x: -90, t: -10, b: -74, w: 17.4 }, { x: -150, t: -20, b: -112, w: 19 }, { x: -210, t: -31, b: -150, w: 20.3 }, { x: -228, t: -34, b: -158, w: 20.6 }];
      else if (isP) st = [{ x: 0, t: 6, b: -29, w: 14 }, { x: -12, t: 4.4, b: -33.5, w: 14.6 }, { x: -40, t: .6, b: -44, w: 15.4 }, { x: -100, t: -7, b: -62, w: 17.2 }, { x: -150, t: -13, b: -80, w: 18.4 }, { x: -178, t: -16, b: -104, w: 19.4 }, { x: -200, t: -18.5, b: -142, w: 20.2 }, { x: -216, t: -20, b: -158, w: 20.6 }];
      else st = [{ x: 0, t: 6, b: -29, w: 14 }, { x: -12, t: 4.6, b: -33.5, w: 14.4 }, { x: -38, t: 1.4, b: -45, w: 15.2 }, { x: -86, t: -5, b: -75, w: 17 }, { x: -146, t: -13, b: -110, w: 19 }, { x: -200, t: -20, b: -141, w: 20.1 }, { x: is74 ? -224 : -212, t: is74 ? -22.6 : -21.6, b: is74 ? -150 : -147, w: 20.4 }];
      const mStock = is74 ? (() => { const tl = faTela(512, 256, .5); for (const v0 of [.1, .55, 1]) tl.rect(.18, v0 - .022, .82, v0 + .022, { h: -1, a: .62 }); tl.blots(40, { seed: 4 }); return K.mat('prugna', tl.done(3.2), { ns: 1, c: '#3c1c18' }); })() : mWood;
      st.sort((a, b) => a.x - b.x);                                 // il loft vuole le stazioni con X crescente (facce verso l'esterno)
      A.add(K.loftX(faSt(st, { nt: 2.6, nb: 2.4 }), { K: 32, step: 6 }), mStock);
      const e = st[0]; xButt = e.x - 5; yButt = (e.t + e.b) / 2;
      // calciolo (acciaio con sportellino; gomma a nervature per il polimero)
      const mBp = is74 ? K.mat('gomma', null, { tile: 'ribs', rep: [1, 6], ns: .6 }) : mSt;
      A.add(K.loftX(faSt([{ x: e.x - 5, t: e.t - 1, b: e.b + 1, w: e.w - .6 }, { x: e.x - 4, t: e.t + .4, b: e.b - .4, w: e.w + .4 }, { x: e.x + .5, t: e.t + .4, b: e.b - .4, w: e.w + .4 }], { nt: 2.6, nb: 2.4 }), { K: 32, step: 0 }), mBp);
      if (!is74) { A.add(K.slabX(K.rrect(-9, yButt - 28, 9, yButt + 22, 6), e.x - 5.6, e.x - 4.6, { b: .3 }), mSt); A.add(faRodZ(-4, 4, 1.6, e.x - 5.4, yButt + 25, 10), mSt); }
      // codolo superiore con vite e maglia della cinghia sul lato sinistro
      const tAt = x => { for (let i = 0; i < st.length - 1; i++) if (x >= st[i].x && x <= st[i + 1].x) return st[i].t + (st[i + 1].t - st[i].t) * (x - st[i].x) / (st[i + 1].x - st[i].x); return st[st.length - 1].t; };
      A.add(K.slab([[-60, tAt(-60) - 2.4, 1], [-6, tAt(-6) - 2], [2, 6.8], [2, 9.4], [-6, tAt(-6) + 1.2], [-60, tAt(-60) + .6, 2]], -5.4, 5.4, { b: .8 }), mSt);
      A.add(faRodY(0, 2.4, 2.6, -42, 0, 12).translate(0, tAt(-42) + .2, 0), mSt);
      WC.put(A, WC.swivel(e.x + 34, yButt - 6, -e.w - .6, { r: 7, t: 1.4, mat: mSt }));
      A.add(K.slab(K.rrect(e.x + 24, yButt - 14, e.x + 44, yButt + 2, 4), -e.w - .8, -e.w + 1.2, { b: .5 }), mSt);
    } else if (is12) {
      // calcio telescopico pieghevole a scheletro con poggiaguancia regolabile
      A.add(K.slab([[-16, -27, 3], [0, -29], [0, 7], [-16, 5, 3]], -13.6, 13.6, { b: 1.4 }), mSt);
      A.add(K.rod(-150, -14, 9, { cy: -2, seg: 18 }), mSt);
      const sb = [-214, -132, -84, 14];
      const pS = K.painter(sb, { w: 512, h: 512, rough: .7 }); pS.stipple('LR', [[-200, -40], [-110, -10], [-110, -28], [-196, -110]], { s: .3 }); pS.noise({ a: .05, r: .08, seed: 3 }); pS.wallFill({ r: .7 });
      const mS = K.mat('polimero', pS.done(2), { ns: .7 });
      A.add(K.slab([[-206, -122, 4], [-150, -60, 8], [-112, -30, 6], [-98, -24, 3], [-98, 9, 3], [-206, 9, 5]], -15.5, 15.5, { b: 3, holes: [[[-188, -78, 6], [-152, -40, 8], [-188, -14, 6]]], uv: sb }), mS);
      A.add(K.slab([[-196, 9, 3], [-112, 9, 3], [-116, 15, 4], [-190, 15, 4]], -11, 11, { b: 2.5 }), mS);   // poggiaguancia
      A.add(K.slab([[-213, -128, 5], [-205, -128, 2], [-205, 15, 2], [-213, 15, 5]], -17, 17, { b: 2.4 }), K.mat('gomma', null, { tile: 'stipple', rep: [3, 3], ns: .5 }));
      xButt = -213; yButt = -56;
    } else {
      // calcio telescopico su tubo con cerniera di ripiegamento
      A.add(K.slab([[-16, -27, 3], [0, -29], [0, 7], [-16, 5, 3]], -13.6, 13.6, { b: 1.4 }), mSt);
      A.add(K.rod(-200, -14, 14.5, { cy: -6, seg: 24 }), K.mat('anod'));
      const sb = [-216, -118, -100, 12];
      const pS = K.painter(sb, { w: 512, h: 512, rough: .7 }); pS.fill('LR', [[-200, -24], [-130, -24], [-150, -50], [-198, -98]], { h: -.5, a: .9 }); pS.noise({ a: .05, r: .08, seed: 4 }); pS.wallFill({ r: .7 });
      const mS = K.mat('polimero', pS.done(2), { ns: .7 });
      A.add(K.slab([[-208, -112, 4], [-170, -70, 10], [-130, -30, 6], [-112, -24, 3], [-112, 10, 3], [-208, 10, 4]], -19, 19, { b: 3.4, uv: sb }), mS);
      A.add(K.slab([[-215, -116, 5], [-207, -116, 2], [-207, 12, 2], [-215, 12, 5]], -19.8, 19.8, { b: 2.4 }), K.mat('gomma', null, { tile: 'stipple', rep: [3, 3], ns: .5 }));
      xButt = -215; yButt = -52;
    }

    // ---------------- impugnatura, ponticello, grilletto, leva di sgancio del caricatore
    const gs = [];
    for (let i = 0; i <= 8; i++) { const t = i / 8, bump = mod ? Math.exp(-Math.pow((t - .42) / .14, 2)) * 2.6 - Math.exp(-Math.pow((t - .2) / .08, 2)) * 1.2 : 0;
      gs.push({ p: [90 - t * 27, RB + 6 - t * 96], f: 14.2 + t * 2.6 + bump, r: 16.6 + t * 1.8 + (mod ? Math.sin(t * PI) * 1.6 : 0), w: 13.4 + Math.sin(t * PI) * 1.4 + t * .6, nf: 2.3, nr: 2.2 }); }
    A.add(K.loftS(gs, { K: 28, sub: 3 }), mGrip);
    if (mod) A.add(K.xf(K.slab([[-18, -2, 3], [19, -2, 3], [20, 3, 2], [-19, 3, 2]], -15, 15, { b: 1.5 }), { r: [0, 0, -.27], t: [63 - 1, RB + 6 - 96 - 2, 0] }), K.mat('polimero'));
    const tgS = mod ? 3 : 0;
    A.add(K.slab([[93, RB + 1.5], [148, RB + 1.5], [148, RB - 3, 1.5], [144, RB - 20 - tgS, 6], [102, RB - 21 - tgS, 7], [93, RB - 9, 4]], -5, 5, { b: .9, holes: [[[99, RB - 1.2, 1], [143, RB - 1.2, 1], [140, RB - 16.5 - tgS, 4.5], [105, RB - 17.5 - tgS, 5.5], [99, RB - 8, 3]]] }), mSt);
    A.add(K.slab([[146.5, RB + 1], [154, RB + 1], [154.5, RB - 4, 1.5], [152.5, RB - 14 - tgS, 2], [148.5, RB - 13.5 - tgS, 1.5], [149.5, RB - 4, 1]], -5.5, 5.5, { b: .7 }), mSt);
    A.add(K.slab([[117.5, RB + 2, 1], [123.5, RB + 2, 1], [122.6, RB - 6, 4], [118.2, RB - 15.5, 1.2], [114.8, RB - 14.5, 1], [118.2, RB - 6, 4]], -3.2, 3.2, { b: .7 }), mSt, 'grilletto');
    A.pivot('grilletto', [120.5, RB + 4, 0]);
    // selettore a leva sul lato destro (posizione di fuoco automatico), con appoggio per il dito nelle versioni moderne
    const sel = [[-7, 0, 6], [-4, 6.4, 2], [20, 7, 0], [126, 7, 1.5], [131, 4.5, 2], [132.5, -3, 2], [128, -9.5, 2.5], [122, -9.5, 2], [119, -3, 3], [24, -3.2, 4], [0, -7.2, 5], [-6, -4.5, 4]];
    A.add(K.xf(K.slab(sel, RW, RW + 1.7, { bL: 0, bR: .6 }), { r: [0, 0, -.13], t: [64, 1, 0] }), mSt);
    if (mod) A.add(K.xf(K.slab([[96, -5, 2], [110, -5, 2], [106, -19, 3], [100, -19, 3]], RW + .4, RW + 2.6, { b: .6 }), { r: [0, 0, -.13], t: [64, 1, 0] }), mSt);
    A.add(faRodZ(RW - .5, RW + 3, 4.2, 64, 1, 16), mSt);
    if (is12) A.add(K.slab([[86, -12, 2], [104, -14, 2], [106, -10, 2], [92, -6, 3]], -RW - 1.8, -RW + .2, { b: .5 }), mSt);   // leva del pollice a sinistra

    // ---------------- caricatore (parte mobile)
    const cvo = is74 || is12 ? { top: [182, -9], ang: .1, R: 470, L: 222, d0: 57, d1: 63 } : isP ? { top: [183, -9], ang: .12, R: 330, L: 296, d0: 62, d1: 76 } : { top: [183, -9], ang: .12, R: 300, L: 236, d0: 62, d1: 73 };
    const cvm = faCurva(cvo);
    let mMagC = mMag;
    if (is12) { const ol = cvm.outline(2.5), bb = K.bbox2(ol); mMagC = K.mat('polimero', faCaricReticolo(cvm, bb, { s0: 34, s1: cvo.L - 16, righe: 8, colonne: 2 }), { ns: .9 }); faCaricatore(A, cvm, { w: 11.8, mat: mMag, matCorpo: mMagC, uv: bb, dorso: true, s0: 26, s1: cvo.L - 10, lipF: 2.5, lipR: 3, th: 5 }); }
    else faCaricatore(A, cvm, { w: is74 ? 11.6 : 12.5, mat: mMagC, costole: is47 ? [] : is74 ? [.28] : [-.25, 0, .25], s0: 30, s1: cvo.L - 12, dorso: !is47, wr: is74 ? 4.4 : 5, hr: 1.3, lipF: 2, lipR: 2.6, th: is74 ? 5 : 4 });

    // ---------------- punti di riferimento e animazioni
    A.anchor('bocca', [xEnd + .5, 0, 0]); A.anchor('espulsione', [180, 2, RW + 1], [0, .3, 1]);
    A.anchor('impugnatura', [74, -72, 0]); A.anchor('grilletto', [119, RB - 9, 0]);
    A.anchor('appoggio', [isP ? 420 : 380, -26, -14]); A.anchor('mira_post', [is12 ? 24 : 245.6, yNotch, 0]); A.anchor('mira_ant', [fx + 16 + (is12 ? 5 : 0), yPost, 0]);
    A.anchor('calcio', [xButt, yButt, 0]);
    const r = A.done();
    r.info = { azione: 'auto', bossolo: 'fucile', ciclo: { otturatore: { dx: -.112 }, grilletto: { rz: -.15 } }, ricarica: { caricatore: { dx: .012, dy: -.075, rz: .35 } } };
    return r;
  };
  MAP2[63] = { f: 'fa_girevole', o: { v: 'fresata' } };
  MAP2[66] = { f: 'fa_girevole', o: { v: 'stampata' } };
  MAP2[70] = { f: 'fa_girevole', o: { v: 'cal545' } };
  MAP2[86] = { f: 'fa_girevole', o: { v: 'mod12' } };
  MAP2[91] = { f: 'fa_girevole', o: { v: 'mod203' } };
  MAP2[140] = { f: 'fa_girevole', o: { v: 'leggera' } };

  // ======================================================================================================
  // FAMIGLIA 2: chiusura ritardata a rulli, scatola in lamiera con tubo d'armamento sopra la canna e manetta a sinistra
  // v: 'polimero' (calcio fisso e astina sottile in polimero, diottra a tamburo, mirino ad anello, spegnifiamma a 4 feritoie),
  //    'legno' (calcio e astina in legno, alzo ribaltabile, mirino a orecchie, bipiede ripiegato lungo l'astina, spegnifiamma lungo),
  //    'precisione' (canna pesante senza dispositivo di bocca, astina larga con guida, calcio regolabile, impugnatura con appoggio per il palmo,
  //                  cannocchiale su attacco a griffe, caricatore corto da 5, pomello di chiusura silenziosa),
  //    'nastro' (mitragliatrice: alimentatore a nastro al posto del pozzetto, astina forata in lamiera, maniglia, bipiede, nastro con cartucce)
  FAM2.fa_rulli = function (spec, o) {
    o = o || {}; spec = spec || {};
    const v = o.v || 'polimero', A = K.asm('fa_rulli'), isW = v === 'legno', isS = v === 'precisione', isN = v === 'nastro';
    const RL = 330, RT = 27, RB = -21, RW = 16, xBr = 262;                // scatola: lunghezza, sommità, fondo, mezza larghezza, culatta
    const prod = faUp(spec.produttore, 'Harzwerk'), nome = faUp(spec.nome, ''), ser = faSer(spec, isW ? 'TA' : 'HW');
    const mSt = K.mat('nero'), mBlu = K.mat('brunito', null, { r: .36 }), mDk = faScuro(), mPol = K.mat('polimero');
    const mWood = K.mat('legno_faggio', null, { c: '#9a7a68' });
    // ---------------- scatola in lamiera: fianchi con nervature stampate, finestra di espulsione a destra, scritte a sinistra
    const rb = [-4, RB - 34, RL + 4, RT + 4];
    const pR = K.painter(rb, { w: 1024, h: 512, rough: .52 });
    pR.line('LR', [[6, 10], [RL - 4, 10]], 1.3, { h: -.7, a: .8 });                 // guida stampata del portaotturatore
    pR.line('LR', [[6, -9], [168, -9]], 1, { h: -.5, a: .86 });
    for (const [x, y] of [[12, 2], [12, -14], [302, 2], [302, -12]]) pR.pin('LR', x, y, 2.2, { h: .4, a: 1.1 });
    pR.text('L', prod, 212, -30, 2.8, { spacing: 2 }); pR.text('L', nome + '  7,62', 212, -36, 2.6, { spacing: 2 }); pR.text('L', ser + '  ' + (spec.anno || 1960) % 100 + '/04', 212, -42, 2.4);
    pR.noise({ a: .12, r: .18, seed: 11 + (spec.id || 0) }); pR.walls({ r: .5 });
    const mR = K.mat('nero', pR.done(2.4), { ns: .85 });
    const pL = [[0, RB + 1, 2], [RL - 64, RB, 4], [RL, -12, 5], [RL, RT - 2, 3], [RL - 6, RT, 2], [4, RT, 3], [0, RT - 4, 2]];
    const pRt = [[0, RB + 1, 2], [RL - 64, RB, 4], [RL, -12, 5], [RL, RT - 2, 3], [RL - 6, RT, 2], [4, RT, 3], [0, RT - 4, 2]];
    A.add(K.slab(pL, -RW, 0, { bL: 2.2, bR: 0, uv: rb }), mR);
    A.add(K.loftX(faSt([{ x: 1, t: RT - 2, b: RT - 9, w: RW - .4 }, { x: 5, t: RT + 1.2, b: RT - 9, w: RW + .35 }, { x: RL - 9, t: RT + 1.2, b: RT - 9, w: RW + .35 }, { x: RL - 2, t: RT - 1.5, b: RT - 9, w: RW - .8 }], { nt: 2.4, nb: 10 }), { K: 32, step: 0 }), mSt);
    // lato destro: finestra di espulsione (taglio fino a metà larghezza) davanti al pozzetto
    const port = [[198, -1, 1.5], [260, -1, 1.5], [260, 15, 1.5], [198, 15, 1.5]];
    A.add(K.slab(pRt, 0, RW - 3, { b: 0, uv: rb, holes: [port] }), mR);
    A.add(K.slab(pRt, RW - 3, RW, { bL: 0, bR: 2.2, uv: rb, holes: [port] }), mR);
    // fondo della finestra (parete interna) e otturatore a rulli visibile
    A.add(K.box(196, -3, -RW + 2, 262, 17, 1, .5), mDk);
    A.add(K.rod(170, xBr, 10.2, { cy: 4, seg: 20 }), mBlu, 'otturatore');
    A.add(K.box(222, 10, 3, 256, 16, 11, .5), mBlu, 'otturatore');
    A.add(K.box(236, -1, 7, 252, 3, 10.6, .4), mBlu, 'otturatore');                 // estrattore
    // pozzetto del caricatore (o alimentatore a nastro), tappo posteriore con le spine del calcio
    if (!isN) {
      A.add(K.slab([[171, RB + 2], [252, RB + 2], [252, RB - 22, 2], [256, RB - 28, 2], [252, RB - 31, 1.5], [171, RB - 31, 2], [168, RB - 26, 2], [171, RB - 22, 1]], -14.6, 14.6, { b: 1.4 }), mR);
      A.add(faRodZ(10, 17.4, 3.4, 248, RB - 8, 14), mSt);                                  // pulsante di sgancio (destra)
    }
    A.add(K.box(-8, RB + 2, -RW - .6, 2, RT - 1, RW + .6, 1.6), mSt);
    for (const yy of [RT - 9, RB + 9]) for (const s of [-1, 1]) A.add(faDiscZ(-3, yy, s * (RW + .65), 2.6, s, 14), mSt);
    // ---------------- tubo d'armamento sopra la canna, manetta a sinistra (parte separata: non si muove sparando)
    const tY = 17, tR = 10.6, tX1 = isS ? 620 : 600;
    A.add(K.latheX([[RL - 10, 0], [RL - 10, tR], [tX1 - 2, tR], [tX1, tR - 1.5], [tX1, 0]], { seg: 24, cy: tY }), mSt);
    A.add(K.box(RL + 6, tY - 2, -tR - .5, RL + 92, tY + 2.6, -tR + 2, .4), mDk);                    // feritoia della manetta
    A.add(K.box(RL + 4, tY + 2.6, -tR - .2, RL + 14, tY + 6, -tR + 1.4, .3), mSt);                    // tacca di aggancio
    const hX = RL + 82;
    A.add(K.box(hX - 4, tY - 3, -tR - 4, hX + 4, tY + 3, -tR + 1, .8), mSt, 'manetta');
    A.add(K.xf(K.slab([[-3, 0, 1.5], [3, 0, 1.5], [3.4, 18, 2], [-1, 22, 3], [-3.4, 18, 2]], -2.4, 2.4, { b: .8 }), { r: [-PI / 2 + .25, 0, .3], t: [hX, tY + 1, -tR - 3] }), mSt, 'manetta');
    A.add(K.latheX([[0, 0], [0, 5], [1.2, 6], [8, 6], [9, 5], [9.4, 0]], { seg: 16 }).rotateY(PI / 2).rotateX(-.25).translate(hX + 5.5, tY + 6.4, -tR - 21.5), mPol, 'manetta');
    A.pivot('manetta', [hX, tY, -tR]);
    // ---------------- canna e guardamano
    const xMz = isS ? 915 : 714, rBr = isS ? 13 : isN ? 10.5 : 9;
    A.add(K.latheX([[xBr - 4, 0], [xBr - 4, 13], [RL + 4, 13], [RL + 6, rBr + 1.2], [RL + 40, rBr + 1], [RL + 60, rBr], [xMz - 8, isS ? rBr : rBr - .8], [xMz - 8, 8.2], [xMz, 8.2], [xMz, 0]], { seg: 26 }), mBlu);
    let xHg1 = 556;
    if (v === 'polimero') {
      const tl = faTela(512, 256, .7); for (let i = 0; i < 9; i++) tl.rect(.08, .2 + i * .085, .92, .2 + i * .085 + .03, { h: -1, a: .7 }); tl.blots(30, { seed: 7 });
      A.add(K.loftX(faSt([{ x: RL + 2, t: 14, b: -18, w: 15.4 }, { x: RL + 10, t: 15.4, b: -21.5, w: 17.6 }, { x: 540, t: 15.4, b: -21.5, w: 17.6 }, { x: 552, t: 15, b: -19, w: 16.2 }, { x: 556, t: 14, b: -16, w: 14.6 }], { nt: 4, nb: 2.6 }), { K: 32, step: 6 }), K.mat('polimero', tl.done(2.4), { ns: .9 }));
    } else if (isW) {
      A.add(K.loftX(faSt([{ x: RL + 2, t: 14, b: -18, w: 15.4 }, { x: RL + 12, t: 15.4, b: -25.5, w: 20 }, { x: 536, t: 15.4, b: -25.5, w: 20 }, { x: 552, t: 14.8, b: -21, w: 17.6 }, { x: 558, t: 14, b: -16, w: 14.6 }], { nt: 4, nb: 2.4 }), { K: 32, step: 6 }), mWood);
      A.add(K.latheX([[556, 10], [556, 12.6], [557, 13.4], [568, 13.4], [569, 12.6], [569, 10]], { seg: 24 }), mSt);          // fascetta anteriore
      // gambe del bipiede ripiegate lungo i fianchi dell'astina, cerniera sotto la fascetta
      for (const s of [-1, 1]) { A.add(K.rod(350, 562, 3.6, { seg: 12, cy: -14, cz: s * 21.6 }), mSt, 'bipiede'); A.add(K.latheX([[342, 0], [342, 4.5], [346, 5.2], [352, 4], [352, 0]], { seg: 12, cy: -14, cz: s * 21.6 }), mSt, 'bipiede'); }
      A.add(K.slab([[556, -12, 2], [572, -12, 2], [572, -20, 2], [556, -20, 2]], -24, 24, { b: 1 }), mSt, 'bipiede');
      A.pivot('bipiede', [564, -16, 0]);
      xHg1 = 569;
    } else if (isS) {
      const hb = [RL, -36, 652, 34];
      const pH = K.painter(hb, { w: 1024, h: 256, rough: .66 });
      for (let i = 0; i < 9; i++) pH.fill('LR', K.rrect(372 + i * 28, -14, 388 + i * 28, 10, 7.5), { h: -1, a: .12 });
      pH.text('R', prod, 360, 22, 3.2, { a: .75 }); pH.noise({ a: .05, r: .08, seed: 5 }); pH.wallFill({ r: .66 });
      A.add(K.slab([[RL + 2, -29, 6], [650, -29, 6], [652, -22, 3], [652, 26, 3], [646, 31, 4], [RL + 2, 31, 3]], -21, 21, { b: 4.5, uv: hb }), K.mat('polimero', pH.done(2.6), { ns: .9 }));
      A.add(K.slab([[372, -35, 1], [624, -35, 1], [624, -29, 1], [372, -29, 1]], -5, 5, { b: .6 }), K.mat('anod'));          // guida a T per la mano e il treppiede
      A.add(K.slab([[372, -39, 1], [624, -39, 1], [624, -34.5, 1], [372, -34.5, 1]], -9.5, 9.5, { b: .8 }), K.mat('anod'));
      xHg1 = 652;
    } else {
      // mitragliatrice: astina in lamiera forata attraverso la quale si vede la canna
      const holes = []; for (let i = 0; i < 8; i++) for (const yy of [-12, 6]) holes.push(K.circ(352 + i * 26, yy, 6.6, 18));
      A.add(K.box(RL + 6, -23, -16.5, 566, 26, 16.5, 0), mDk);
      A.add(K.slab([[RL + 2, -27, 4], [566, -27, 4], [570, -22, 2], [570, 30, 2], [RL + 2, 30, 2]], -19.5, 19.5, { b: .9, holes }), mSt);
      xHg1 = 570;
      // maniglia di trasporto sulla canna
      A.add(K.latheX([[612, rBr - .4], [612, rBr + 3], [613, rBr + 4], [632, rBr + 4], [633, rBr + 3], [633, rBr - .4]], { seg: 24 }), mSt);
      A.add(K.xf(K.slab([[-6, 0, 2], [6, 0, 2], [5, 20, 3], [-60, 52, 8], [-108, 52, 8], [-108, 44, 4], [-62, 44, 6], [-4, 14, 3]], -6, 6, { b: 2 }), { r: [-PI / 2 + .02, 0, 0], t: [623, rBr + 2, -6] }), mPol);
    }
    // blocco del mirino (anello o orecchie) all'estremità del tubo d'armamento
    let yPost = RT + 13;
    if (!isS) {
      const fx = tX1 - 26;
      A.add(K.slab([[fx, -6, 3], [fx + 26, -6, 3], [fx + 26, tY + 9, 3], [fx + 20, tY + 13, 3], [fx + 6, tY + 13, 3], [fx, tY + 9, 3]], -9, 9, { b: 1.6 }), mSt);
      A.add(K.latheX([[fx + 2, 10], [fx + 2, 12], [fx + 3, 12.8], [fx + 24, 12.8], [fx + 25, 12], [fx + 25, 10]], { seg: 24 }), mSt);
      if (isW) {
        for (const s of [-1, 1]) A.add(K.slab([[fx + 6, tY + 9], [fx + 22, tY + 9], [fx + 22, yPost + 2, 3], [fx + 17, yPost + 6, 3], [fx + 9, yPost + 6, 3], [fx + 6, yPost + 1, 3]], s > 0 ? 4.6 : -7.6, s > 0 ? 7.6 : -4.6, { b: .7 }), mSt);
      } else {
        A.add(K.slab([[fx + 8, tY + 9], [fx + 20, tY + 9], [fx + 18, yPost - 6, 2], [fx + 10, yPost - 6, 2]], -4, 4, { b: .7 }), mSt);
        A.add(K.latheX([[fx + 7, 8.6], [fx + 7, 10.4], [fx + 8, 11], [fx + 20, 11], [fx + 21, 10.4], [fx + 21, 8.6], [fx + 19.6, 8.6], [fx + 8.4, 8.6]], { seg: 28, cy: yPost }), mSt);   // anello di protezione
      }
      A.add(faRodY(tY + 9, yPost, 1.15, fx + 14, 0, 12), mSt);
      A.anchor('mira_ant', [fx + 14, yPost, 0]);
    }
    // dispositivo di bocca
    let xEnd = xMz;
    if (v === 'polimero' || isN) { faSpegni(A, xMz - 6, 56, 11, mSt, mDk, { n: 4, lb: 14, sl: 4, a0: PI / 4 }); xEnd = xMz + 50; }
    else if (isW) { faSpegni(A, xMz - 6, 72, 11.4, mSt, mDk, { n: 6, lb: 16, sl: 3.4, chiuso: true, lf: 7 }); A.add(K.latheX([[xMz + 4, 11.4], [xMz + 4, 12.6], [xMz + 8, 12.6], [xMz + 8, 11.4]], { seg: 28 }), mSt); xEnd = xMz + 66; }
    else { A.add(K.discX(xMz + .05, 0, 0, 4, 1, 16), mDk); A.add(K.latheX([[xMz, 3.9], [xMz, 6], [xMz - 1, 6.6]], { seg: 24 }), mBlu); }
    // ---------------- mire posteriori: diottra a tamburo (o alzo ribaltabile), nessuna nel fucile di precisione
    if (!isS) {
      A.add(K.slab([[16, RT - 1, 2], [54, RT - 1, 2], [54, RT + 6, 2], [48, RT + 9, 2], [22, RT + 9, 2], [16, RT + 6, 2]], -12, 12, { b: 1.2 }), mSt);
      if (isW) {
        A.add(K.slab([[26, RT + 7, 1], [44, RT + 7, 1], [40, RT + 16, 2], [30, RT + 16, 2]], -5, 5, { b: .6 }), mSt);
        A.add(K.slabX([[-5.5, RT + 14], [5.5, RT + 14], [5.5, RT + 20.5, 1], [1.2, RT + 20.5, .3], [1.2, RT + 17.4, .8], [-1.2, RT + 17.4, .8], [-1.2, RT + 20.5, .3], [-5.5, RT + 20.5, 1]], 30, 34, { b: .4 }), mSt);
        yPost = RT + 18;
      } else {
        A.add(faRodZ(-6.5, 6.5, 8.6, 34, RT + 13, 22), mSt);
        for (let i = 0; i < 4; i++) { const a = PI + i * PI / 2; A.add(faRodZ(-1, 1, 1.4, 34 + Math.cos(a) * 8.7, RT + 13 + Math.sin(a) * 8.7, 10), mDk); }
        for (const s of [-1, 1]) A.add(K.slab([[18, RT + 5], [50, RT + 5], [50, RT + 16, 3], [44, RT + 23, 4], [24, RT + 23, 4], [18, RT + 16, 3]], s > 0 ? 7.4 : -11, s > 0 ? 11 : -7.4, { b: .8 }), mSt);
        A.add(faRodZ(10.6, 13.6, 2.4, 34, RT + 4.5, 12), mSt);
        yPost = RT + 13;
      }
      A.anchor('mira_post', [isW ? 32 : 26, yPost, 0]);
    } else {
      // attacco a griffe e cannocchiale
      A.add(K.slab([[42, RT - 2, 2], [270, RT - 2, 2], [270, RT + 9, 3], [42, RT + 9, 3]], -12, 12, { b: 1.5 }), K.mat('anod'));
      for (const xx of [60, 252]) A.add(K.box(xx - 8, RT - 6, -RW - 1.6, xx + 8, RT + 4, RW + 1.6, 1), K.mat('anod'));
      WC.put(A, WC.scope({ x0: -14, x1: 352, y: RT + 48, rt: 15, ro: 27, re: 21, rings: [92, 224], yb: RT + 9 }));
      A.anchor('ottica', [-14, RT + 48, 0]); A.anchor('mira_post', [-14, RT + 48, 0]); A.anchor('mira_ant', [352, RT + 48, 0]);
      // pomello per la chiusura silenziosa dell'otturatore (lato destro)
      A.add(K.latheX([[0, 0], [0, 6], [1, 7], [12, 7], [13, 6], [13.4, 0]], { seg: 18 }).rotateY(-PI / 2).translate(176, 12, RW - 1), mSt);
    }

    // ---------------- calcio
    let xButt, yButt;
    if (isS) {
      const sb = [-332, -150, 2, 52];
      const pS = K.painter(sb, { w: 1024, h: 512, rough: .7 }); pS.stipple('LR', [[-250, -20], [-120, -14], [-120, -50], [-250, -86]], { s: .32 }); pS.noise({ a: .05, r: .08, seed: 6 }); pS.wallFill({ r: .7 });
      const mS = K.mat('polimero', pS.done(2), { ns: .7 });
      A.add(K.slab([[-300, -128, 6], [-200, -82, 30], [-60, -44, 16], [0, -24, 2], [0, 20, 2], [-300, 20, 6]], -18, 18, { b: 5, uv: sb }), mS);
      A.add(K.slab([[-268, 20], [-128, 20], [-128, 30, 5], [-140, 36, 6], [-262, 36, 6], [-268, 30, 3]], -14, 14, { b: 4 }), mS);   // poggiaguancia regolabile
      for (const xx of [-236, -160]) A.add(K.rod(14, 22, 3.4, { seg: 12 }).rotateZ(PI / 2).translate(xx, 0, 0), mSt);
      A.add(K.slab([[-318, -140, 6], [-304, -132, 3], [-304, 24, 3], [-316, 28, 6], [-322, 10, 10], [-322, -110, 12]], -19, 19, { b: 3 }), K.mat('gomma', null, { tile: 'stipple', rep: [3, 4], ns: .5 }));
      A.add(K.box(-306, -126, -15, -298, 20, 15, 1), mSt);                                       // distanziali regolabili
      xButt = -320; yButt = -54;
    } else if (isW) {
      const st = [{ x: -258, t: 2, b: -116, w: 20 }, { x: -250, t: 3, b: -114, w: 20 }, { x: -170, t: 7, b: -88, w: 18.6 }, { x: -90, t: 11, b: -56, w: 17 }, { x: -30, t: 14, b: -32, w: 16 }, { x: -6, t: 15, b: -24, w: 15.6 }];
      A.add(K.loftX(faSt(st, { nt: 3, nb: 2.6 }), { K: 32, step: 6 }), mWood);
      A.add(K.loftX(faSt([{ x: -264, t: 1.6, b: -115.6, w: 19.6 }, { x: -263, t: 3.4, b: -117.4, w: 20.6 }, { x: -257, t: 3.4, b: -117.4, w: 20.6 }], { nt: 3, nb: 2.6 }), { K: 32, step: 0 }), mSt);
      xButt = -264; yButt = -56;
    } else {
      const tl = faTela(512, 256, .68); tl.blots(50, { seed: 12, a: .04 });
      const st = [{ x: -258, t: 8, b: -112, w: 19.8 }, { x: -246, t: 9, b: -110, w: 20 }, { x: -170, t: 12, b: -84, w: 18.4 }, { x: -90, t: 15, b: -56, w: 17 }, { x: -30, t: 17.4, b: -30, w: 16.6 }, { x: -6, t: 18, b: -22, w: 16.4 }];
      A.add(K.loftX(faSt(st, { nt: 4, nb: 3 }), { K: 32, step: 6 }), K.mat('polimero', tl.done(1.5), { ns: .4 }));
      A.add(K.loftX(faSt([{ x: -272, t: 7, b: -111, w: 19.4 }, { x: -270, t: 9, b: -113, w: 20.6 }, { x: -259, t: 9, b: -113, w: 20.6 }], { nt: 4, nb: 3 }), { K: 32, step: 0 }), K.mat('gomma', null, { tile: 'ribs', rep: [1, 7], ns: .6 }));
      WC.put(A, WC.swivel(-232, -108, 0, { r: 7.5, t: 1.6, rot: PI / 2, mat: mSt }));
      xButt = -272; yButt = -52;
    }

    // ---------------- gruppo di scatto con impugnatura e ponticello, selettore a sinistra
    const hb = [24, -70, 182, -16];
    const pT = K.painter(hb, { w: 512, h: 256, rough: isW ? .5 : .68 }), kB = .13;   // base chiara scurita: le lettere restano bianche
    pT.fill('LR', [[hb[0], hb[1]], [hb[2], hb[1]], [hb[2], hb[3]], [hb[0], hb[3]]], { a: kB }); pT.wallFill({ a: kB, r: isW ? .5 : .68 });
    pT.text('L', 'S', 69, -24.5, 3.6, { a: .8, h: .2 }); pT.text('L', isW ? 'T' : 'E', 84, -21.5, 3.6, { a: .8, h: .2 }); pT.text('L', isW ? 'R' : 'F', 93, -30, 3.6, { a: isW ? .8 : .55, h: .2 });
    for (const [x, y] of [[40, -26], [164, -26]]) pT.pin('LR', x, y, 2.6, { h: .4, a: kB * 1.3 });
    pT.noise({ a: .05, r: .08, seed: 3 });
    const mT = K.mat(isW ? 'nero' : 'polimero', pT.done(2), { ns: .8, c: '#c4c4c4' });
    A.add(K.slab([[24, RB + 1, 2], [176, RB + 1, 1], [176, -30, 3], [170, -60, 7], [116, -62, 8], [104, -40, 5], [60, -36, 6], [30, -34, 6]], -13, 13, { b: 2, holes: [[[120, -33, 3], [164, -33, 3], [161, -52, 5], [123, -54, 6]]], uv: hb }), mT);
    const gs = []; const vert = isS ? .12 : .3;
    for (let i = 0; i <= 8; i++) { const t = i / 8; gs.push({ p: [96 - t * 96 * vert, -34 - t * 92], f: 15.4 + t * 2.4 + (isS ? Math.exp(-Math.pow((t - .5) / .15, 2)) * 2.5 : 0), r: 17.6 + t * 2.2, w: 14.6 + Math.sin(t * PI) * 1.6, nf: 2.4, nr: 2.2 }); }
    A.add(K.loftS(gs, { K: 28, sub: 3 }), isW ? K.mat('legno_scuro', null, { tile: undefined }) : K.mat('polimero', null, { tile: 'stipple', rep: [3, 4], ns: .6 }));
    if (isS) A.add(K.xf(K.slab([[-30, -3, 4], [34, -3, 4], [36, 3, 3], [-34, 3, 3]], -18, 18, { b: 2 }), { r: [0, 0, -.08], t: [96 - 92 * .12 - 2, -128, 0] }), mPol);   // appoggio per il palmo
    A.add(K.xf(K.slab([[0, -3, 2], [24, -1.6, 1], [26, 1.6, 1], [0, 3, 2]], -1.6, 1.6, { b: .5 }), { r: [0, 0, -.7], t: [80, -27, -14] }), mSt);   // leva del selettore a sinistra
    A.add(faRodZ(-15, -12.6, 4, 80, -27, 14), mSt);
    const tw = isS ? 6 : 3.2;
    A.add(K.slab([[138, -31, 1], [144, -31, 1], [143, -38, 4], [139, -49, 1.2], [135.4, -48, 1], [139, -38, 4]], -tw, tw, { b: .7 }), isS ? K.mat('anod') : mSt, 'grilletto');
    A.pivot('grilletto', [141, -29, 0]);
    if (!isN) A.add(K.slab([[168, RB - 3], [176, RB - 3], [175, -42, 2], [170, -42, 2]], -6, 6, { b: .6 }), mSt);   // leva di sgancio a paletta

    // ---------------- caricatore o alimentatore a nastro
    if (!isN) {
      const cvo = isS ? { top: [212, -12], ang: .02, R: 0, L: 74, d0: 76, d1: 77 } : { top: [212, -12], ang: .05, R: 1100, L: isW ? 172 : 176, d0: 76, d1: 79 };
      const cvm = faCurva(cvo);
      faCaricatore(A, cvm, { w: 12.6, mat: isW ? K.mat('nero', null, { c: '#2a2b2c', r: .45 }) : K.mat('anod', null, { c: '#2a2c2e', r: .5 }), costole: isS ? [] : isW ? [-.2, .2] : [-.3, -.1, .1, .3], s0: 34, s1: cvo.L - 10, wr: isW ? 5 : 3.2, hr: 1.1, dorso: !isS, lipF: 2, lipR: 3, th: 5 });
    } else {
      // alimentatore: scatola sotto la scatola di culatta, sportello e guida del nastro a sinistra
      A.add(K.slab([[168, RB + 2], [256, RB + 2], [256, -50, 3], [168, -50, 3]], -22, 18, { b: 1.6 }), mSt);
      A.add(K.slab([[176, -50], [248, -50], [248, -56, 2], [176, -56, 2]], -18, 14, { b: 1 }), mSt);
      A.add(K.slab([[180, -24], [244, -24], [244, -46, 2], [180, -46, 2]], -34, -21, { b: 1 }), mSt);
      A.add(faRodZ(-36, 20, 3, 252, -32, 14), mSt);
      // nastro: cartucce con maglie che entrano da sinistra, piegano verso il basso e pendono (parte 'nastro')
      const mBr = K.mat('ottone'), mLk = K.mat('nero', null, { r: .55 });
      const bPt = s0 => {   // percorso del nastro nel piano (z, y): tratto orizzontale, curva di raggio 30, discesa
        if (s0 < 22) return [-34 - s0, -35, 0];
        const s1 = s0 - 22, th = Math.min(PI / 2, s1 / 30);
        if (s1 < 30 * PI / 2) return [-56 + 30 * Math.cos(PI / 2 + th) * 1, -65 + 30 * Math.sin(PI / 2 + th), th];
        return [-86, -65 - (s1 - 30 * PI / 2), PI / 2];
      };
      for (let i = 0; i < 10; i++) {
        const [zz, yy, th] = bPt(i * 12.6);
        const c = K.latheX([[-38, 0], [-38, 5.9], [-37, 6.1], [-36.4, 5.4], [-35.4, 5.4], [-35, 6], [4, 5.7], [8, 4.3], [13, 4.3], [20, 4.1], [32, 1.6], [33, 0]], { seg: 12 });
        A.add(c.translate(214, yy, zz), mBr, 'nastro');
        for (const xl of [194, 222]) A.add(K.xf(K.box(-5.5, -6.6, -5.8, 5.5, 6.6, 5.8, .8), { r: [-th, 0, 0], t: [xl, yy, zz] }), mLk, 'nastro');
      }
      A.pivot('nastro', [214, -34, -30]);
      faBipiede(A, 588, rBr + 1, { len: 236, dir: -1, mat: mSt, zl: 24 });
    }

    // ---------------- punti di riferimento e animazioni
    A.anchor('bocca', [xEnd + .5, 0, 0]); A.anchor('espulsione', [230, 8, RW + 1], [.25, .35, 1]);
    A.anchor('impugnatura', [84, -78, 0]); A.anchor('grilletto', [139, -42, 0]);
    A.anchor('appoggio', [isS ? 480 : 440, -30, -18]); A.anchor('calcio', [xButt, yButt, 0]);
    const r = A.done();
    r.info = { azione: isS ? 'semi' : 'auto', bossolo: 'fucile_lungo', ciclo: { otturatore: { dx: -.092 }, grilletto: { rz: -.14 } },
      ricarica: isN ? { nastro: { dz: -.05, dy: -.04 } } : { caricatore: { dx: .004, dy: -.09, rz: .05 } } };
    if (isN) r.info.nastro = { parte: 'nastro', colpi: spec.colpi || 100 };
    return r;
  };
  MAP2[65] = { f: 'fa_rulli', o: { v: 'polimero' } };
  MAP2[94] = { f: 'fa_rulli', o: { v: 'legno' } };
  MAP2[108] = { f: 'fa_rulli', o: { v: 'precisione' } };
  MAP2[159] = { f: 'fa_rulli', o: { v: 'nastro' } };

  // ======================================================================================================
  // FAMIGLIA 3: otturatore basculante a recupero di gas, scatola alta in due parti (superiore fresata, inferiore con pozzetto)
  // v: 'legno' (calciatura in legno, maniglia di trasporto ripiegata, manetta fissa, spegnifiamma lungo aperto, selettore a tre posizioni),
  //    'sintetico' (calciatura sintetica nera più lunga, astina nervata con feritoie, manetta ripiegabile, spegnifiamma chiuso, solo semiautomatico)
  FAM2.fa_basculante = function (spec, o) {
    o = o || {}; spec = spec || {};
    const v = o.v || 'legno', A = K.asm('fa_basculante'), isY = v === 'sintetico';
    const RL = 252, UT = 23, UB = -16, LB = -40, RW = 15;           // scatola superiore (lunghezza, sommità, fondo), fondo dell'inferiore, mezza larghezza
    const prod = faUp(spec.produttore, 'Ardenne Armes'), nome = faUp(spec.nome, ''), ser = faSer(spec, isY ? 'TA' : 'AA');
    const mSt = K.mat('nero'), mBlu = K.mat('brunito', null, { r: .36 }), mDk = faScuro();
    const mWood = isY ? K.mat('polimero', null, { tile: 'grana', rep: [6, 6], ns: .3 }) : K.mat('legno_noce', null, { c: '#a08470' });
    // ---------------- scatole: superiore e inferiore con le stesse trame
    const rb = [-14, -62, RL + 4, UT + 4];
    const pR = K.painter(rb, { w: 1024, h: 512, rough: .5 }), kB = .16;
    pR.fill('LR', [[-14, -62], [RL + 4, -62], [RL + 4, UB - .5], [-14, UB - .5]], { a: kB * 6.2 });   // inferiore: tono normale
    pR.line('LR', [[2, UB + .2], [RL - 30, UB + .2]], .8, { h: -.8, a: .55 });                        // giunzione fra le due scatole
    pR.text('L', prod, 150, 10, 3, { spacing: 3 }); pR.text('L', nome, 150, 3, 2.8, { spacing: 2 }); pR.text('L', ser, 60, 8, 2.6, { spacing: 2 });
    pR.text('R', ser, 90, -30, 2.4);
    pR.text('L', 'S', 64, -18.5, 3.2, { h: .2 }); pR.text('L', isY ? 'R' : 'A', 76, -20.5, 3.2, { h: .2 }); if (!isY) pR.text('L', 'R', 72, -32.5, 3.2, { h: .2 });
    for (const [x, y] of [[36, -26], [120, -26], [214, -24]]) pR.pin('LR', x, y, 2.4, { h: .45, a: 1.1 });
    pR.fill('LR', K.rrect(96, 2, 236, 6, 2), { h: -.6, a: .8 });                                        // scanalatura del carrello
    pR.noise({ a: .12, r: .18, seed: 17 + (spec.id || 0) }); pR.walls({ r: .5 });
    const mR = K.mat('nero', pR.done(2.4), { ns: .85 });
    const up = [[0, UB, 2], [RL, UB, 2], [RL, UT - 4, 3], [RL - 6, UT, 2], [0, UT, 2]];
    const upR = [[0, UB, 2], [RL, UB, 2], [RL, UT - 4, 3], [RL - 6, UT, 2], [0, UT, 2]];
    const port = [[124, -5, 2], [204, -5, 2], [204, 15, 2], [124, 15, 2]];
    const panL = [[26, -10, 3], [104, -10, 3], [104, 12, 3], [26, 12, 3]], panR = [[26, -10, 3], [112, -10, 3], [112, 12, 3], [26, 12, 3]];   // scassi di alleggerimento
    A.add(K.slab(up, -RW, -RW + 2.4, { bL: 1.1, bR: 0, uv: rb, holes: [panL] }), mR);
    A.add(K.slab(up, -RW + 2.4, 0, { b: 0, uv: rb }), mR);
    A.add(K.slab(upR, 0, RW - 3, { b: 0, uv: rb, holes: [port] }), mR);
    A.add(K.slab(upR, RW - 3, RW, { bL: 0, bR: 1.1, uv: rb, holes: [port, panR] }), mR);
    A.add(K.box(122, -7, -RW + 2, 206, 17, 1, .5), mDk);
    // portaotturatore visibile nella finestra (parte mobile) e scanalature anti sabbia nella versione sintetica
    A.add(K.box(80, -3, -8, 216, 16, 11.6, 1), mBlu, 'otturatore');
    A.add(K.box(150, -5, 3, 202, 1, 11, .5), mBlu, 'otturatore');
    if (isY) for (let i = 0; i < 5; i++) A.add(K.box(132 + i * 14, 2, 11.2, 138 + i * 14, 14, 11.9, .3), mDk, 'otturatore');
    // scatola inferiore: pozzetto del caricatore, perno di cerniera, leva di smontaggio, ponticello
    const lo = [[-12, UB, 1], [226, UB, 1], [226, -26, 4], [222, -54, 3], [146, -54, 2], [146, LB, 2], [-12, LB + 4, 6]];
    A.add(K.slab(lo, -RW + .4, RW - .4, { b: 1.6, uv: rb }), mR);
    A.add(faRodZ(-RW - 1.2, RW + 1.2, 4.2, 216, -24, 18), mSt);
    A.add(K.slab([[206, -27, 2], [216, -28, 4.2], [226, -27, 2], [228, -40, 3], [222, -42, 2]], -RW - 2.2, -RW - .4, { b: .6 }), mSt);   // leva della cerniera
    A.add(K.slab([[2, -10, 2], [10, -10, 2], [28, -18, 2], [26, -22, 2], [2, -16, 3]], -RW - 1.6, -RW + .2, { b: .5 }), mSt);              // leva di smontaggio
    A.add(K.slab([[88, LB + 1], [148, LB + 1], [148, -46, 2], [142, -62, 6], [96, -63, 7], [88, -50, 4]], -6, 6, { b: 1, holes: [[[94, LB - 2, 1.5], [142, LB - 2, 1.5], [138, -57, 4.5], [99, -58, 5], [94, -48, 3]]] }), mSt);
    A.add(K.slab([[116, LB + 1, 1], [122, LB + 1, 1], [121, -47, 4], [117, -56.5, 1.2], [113.4, -55.5, 1], [117, -47, 4]], -3.4, 3.4, { b: .7 }), mSt, 'grilletto');
    A.pivot('grilletto', [119, LB + 3, 0]);
    A.add(K.xf(K.slab([[0, -3, 2], [22, -1.6, 1], [24, 1.6, 1], [0, 3, 2]], -1.6, 1.6, { b: .5 }), { r: [0, 0, -.55], t: [68, -26, -RW - 1.4] }), mSt);  // selettore
    A.add(faRodZ(-RW - 3, -RW + .5, 4.4, 68, -26, 14), mSt);
    A.add(K.slab([[150, -56, 1], [156, -56, 1], [154, -66, 2], [150, -66, 2]], -RW + 2, -RW + 5, { b: .4 }), mSt);                          // leva di sgancio
    // ---------------- coperchio superiore, mira posteriore a diottra con orecchie, manetta di armamento a sinistra
    A.add(K.slab([[22, UT - .4, 1], [204, UT - .4, 1], [208, UT + 2.6, 1], [26, UT + 2.6, 1]], -RW + 1.6, RW - 1.6, { b: .7 }), mSt);
    A.add(K.slab([[2, UT - 1, 2], [30, UT - 1, 2], [30, UT + 6, 2], [2, UT + 6, 2]], -11.5, 11.5, { b: 1 }), mSt);
    for (const s of [-1, 1]) A.add(K.slab([[4, UT + 5], [28, UT + 5], [28, UT + 13, 3], [22, UT + 17, 3], [10, UT + 17, 3], [4, UT + 13, 3]], s > 0 ? 7 : -10.6, s > 0 ? 10.6 : -7, { b: .8 }), mSt);
    A.add(K.slabX([[-5, UT + 5], [5, UT + 5], [5, UT + 15, 2], [-5, UT + 15, 2]], 13, 16.5, { b: .5, holes: [K.circ(0, UT + 12, 1.4, 12)] }), mSt);
    A.anchor('mira_post', [14.5, UT + 12, 0]);
    const hX = 224;
    A.add(K.box(hX - 5, 2, -RW - 3, hX + 5, 9, -RW + 1, .8), mSt, 'manetta');
    if (isY) A.add(K.xf(K.slab([[-2.5, 0, 1], [2.5, 0, 1], [3, 26, 2.5], [-3, 26, 2.5]], -2, 2, { b: .7 }), { r: [-PI / 2 + .1, 0, .55], t: [hX, 5.5, -RW - 2] }), mSt, 'manetta');
    else { A.add(K.xf(K.slab([[-2.5, 0, 1], [2.5, 0, 1], [2.5, 22, 2], [-2.5, 22, 2]], -2.2, 2.2, { b: .7 }), { r: [-PI / 2 + .3, 0, .4], t: [hX, 5.5, -RW - 2] }), mSt, 'manetta');
      A.add(K.latheX([[0, 0], [0, 5], [1, 5.6], [9, 5.6], [10, 4.6], [10.4, 0]], { seg: 16 }).rotateY(PI / 2).translate(hX + 9, 12, -RW - 22), mSt, 'manetta'); }
    A.pivot('manetta', [hX, 5.5, -RW]);
    // ---------------- canna, guardamano, blocco del gas con regolatore e mirino, dispositivo di bocca
    const xMz = isY ? 770 : 758;
    A.add(K.latheX([[214, 0], [214, 13], [RL + 8, 13], [RL + 10, 11], [560, 10], [570, 9], [xMz - 8, 8.4], [xMz - 8, 7.6], [xMz, 7.6], [xMz, 0]], { seg: 26 }), mBlu);
    A.add(K.rod(RL, 566, 6.4, { cy: 18, seg: 16 }), mSt);
    if (!isY) {
      A.add(K.loftX(faSt([{ x: RL + 2, t: 25, b: -17, w: 15.4 }, { x: RL + 12, t: 30, b: -23, w: 19.4 }, { x: 420, t: 31, b: -24, w: 20.2 }, { x: 540, t: 30, b: -22, w: 19.2 }, { x: 556, t: 27, b: -17, w: 16 }], { nt: 2.6, nb: 2.4 }), { K: 32, step: 6 }), mWood);
      A.add(K.box(RL + 14, 28, -.5, 548, 31.4, .5, 0), mDk);                                    // giunzione delle due metà
    } else {
      const tl = faTela(1024, 256, .7);
      for (let i = 0; i < 7; i++) for (const vv of [.3, .8]) tl.rect(.12 + i * .11, vv - .06, .18 + i * .11, vv + .06, { h: -1, a: .12 });
      for (let i = 0; i < 12; i++) tl.rect(0, .5 + i * .04, 1, .5 + i * .04 + .012, { h: .6 });
      tl.blots(30, { seed: 3 });
      A.add(K.loftX(faSt([{ x: RL + 2, t: 25, b: -17, w: 15.4 }, { x: RL + 12, t: 31, b: -24, w: 20.4 }, { x: 420, t: 32, b: -25.5, w: 21.4 }, { x: 540, t: 31, b: -24, w: 20.4 }, { x: 556, t: 27, b: -17, w: 16 }], { nt: 3, nb: 2.4 }), { K: 36, step: 6 }), K.mat('polimero', tl.done(2.6), { ns: 1 }));
    }
    A.add(K.latheX([[RL + 1, 11], [RL + 1, 13.6], [RL + 2, 14.4], [RL + 10, 14.4], [RL + 11, 13.6], [RL + 11, 11]], { seg: 24 }), mSt);
    const gx = 560;
    A.add(K.latheX([[gx, 8], [gx, 11.4], [gx + 1, 12], [gx + 46, 12], [gx + 47, 11], [gx + 47, 8]], { seg: 24 }), mSt);
    A.add(K.latheX([[gx - 2, 0], [gx - 2, 9], [gx - 1, 10], [gx + 48, 10], [gx + 49, 9], [gx + 49, 0]], { seg: 22, cy: 18 }), mSt);
    A.add(K.slab([[gx + 2, 2], [gx + 45, 2], [gx + 45, 18], [gx + 2, 18]], -7, 7, { b: .8 }), mSt);
    A.add(K.latheX([[gx + 49, 0], [gx + 49, 7.6], [gx + 50, 8.2], [gx + 60, 8.2], [gx + 61, 7.4], [gx + 64, 6.4], [gx + 66, 3], [gx + 66, 0]], { seg: 20, cy: 18 }), K.mat('nero', null, { tile: 'knurl', rep: [3, 2], ns: .8 }));   // regolatore del gas
    A.add(K.box(gx + 63, 17.2, -5, gx + 67, 18.8, 5, .3), mDk);
    // mirino: piede, orecchie e mirino sul blocco del gas
    const yP = UT + 12;
    A.add(K.slab([[gx + 8, 24, 2], [gx + 40, 24, 2], [gx + 36, 32, 3], [gx + 12, 32, 3]], -6, 6, { b: .8 }), mSt);
    for (const s of [-1, 1]) A.add(K.slab([[gx + 12, 26], [gx + 36, 26], [gx + 36, yP + 1, 3], [gx + 30, yP + 6, 3], [gx + 18, yP + 6, 3], [gx + 12, yP + 1, 3]], s > 0 ? 5 : -8, s > 0 ? 8 : -5, { b: .7 }), mSt);
    A.add(faRodY(28, yP, 1.2, gx + 24, 0, 12), mSt);
    A.anchor('mira_ant', [gx + 24, yP, 0]);
    A.add(K.slab([[gx + 10, -10], [gx + 40, -10], [gx + 40, -17, 1.5], [gx + 36, -20, 1.5], [gx + 14, -20, 1.5], [gx + 10, -16, 1.5]], -4.4, 4.4, { b: .6 }), mSt);   // dente della baionetta
    WC.put(A, WC.swivel(gx + 24, -14, -9, { r: 6.5, t: 1.4, rot: PI / 2, mat: mSt }));
    let xEnd;
    if (isY) { faSpegni(A, xMz - 8, 70, 11, mSt, mDk, { n: 6, lb: 12, sl: 3.6, chiuso: true, lf: 7 }); xEnd = xMz + 62; }
    else { faSpegni(A, xMz - 8, 64, 11.2, mSt, mDk, { n: 6, lb: 14, sl: 3.4 }); A.add(K.latheX([[xMz - 6, 11.2], [xMz - 6, 12.4], [xMz, 12.4], [xMz, 11.2]], { seg: 28 }), mSt); xEnd = xMz + 56; }
    // maniglia di trasporto ripiegata a sinistra (anello sulla canna, braccio e impugnatura)
    A.add(K.latheX([[RL + 14, 12.6], [RL + 14, 15.4], [RL + 15, 16.2], [RL + 32, 16.2], [RL + 33, 15.4], [RL + 33, 12.6]], { seg: 24 }), mSt);
    A.add(K.xf(K.slab([[0, -3, 1.5], [70, -3, 2], [74, 0, 2], [70, 3, 2], [0, 3, 1.5]], -2.4, 2.4, { b: .8 }), { r: [0, -.08, 0], t: [RL + 24, 17, -18.6] }), mSt);
    A.add(K.rod(RL + 40, RL + 88, 5.2, { cy: 17, cz: -22.6, seg: 14 }), isY ? K.mat('polimero') : mWood);
    // ---------------- calcio, impugnatura, caricatore
    let st;
    if (isY) st = [{ x: -300, t: -2, b: -128, w: 20.4 }, { x: -290, t: 0, b: -126, w: 20.6 }, { x: -200, t: 6, b: -98, w: 19.4 }, { x: -110, t: 11, b: -70, w: 17.6 }, { x: -40, t: 15, b: -48, w: 16.4 }, { x: -12, t: 16, b: -40, w: 15.6 }];
    else st = [{ x: -272, t: -4, b: -126, w: 20 }, { x: -262, t: -2, b: -124, w: 20.2 }, { x: -190, t: 4, b: -98, w: 19 }, { x: -110, t: 10, b: -70, w: 17.4 }, { x: -40, t: 15, b: -48, w: 16.2 }, { x: -12, t: 16, b: -40, w: 15.6 }];
    A.add(K.loftX(faSt(st, { nt: 2.8, nb: 2.4 }), { K: 32, step: 6 }), mWood);
    const e = st[0];
    A.add(K.loftX(faSt([{ x: e.x - 7, t: e.t - 1, b: e.b + 1, w: e.w - .8 }, { x: e.x - 6, t: e.t + .4, b: e.b - .4, w: e.w + .4 }, { x: e.x + .5, t: e.t + .4, b: e.b - .4, w: e.w + .4 }], { nt: 2.8, nb: 2.4 }), { K: 32, step: 0 }), isY ? K.mat('gomma', null, { tile: 'ribs', rep: [1, 6], ns: .6 }) : mSt);
    A.add(K.latheX([[-14, 0], [-14, 15.8], [-13, 16.6], [-4, 16.6], [-3, 15.8], [-3, 0]], { seg: 28, cy: -12 }), mSt);   // ghiera del calcio
    WC.put(A, WC.swivel(e.x + 40, e.b + 16, 0, { r: 7.5, t: 1.6, rot: PI / 2, mat: mSt }));
    const gs = []; for (let i = 0; i <= 8; i++) { const t = i / 8; gs.push({ p: [84 - t * 30, LB + 6 - t * 92], f: 14.6 + t * 2.4, r: 16.4 + t * 2, w: 14 + Math.sin(t * PI) * 1.6, nf: 2.4, nr: 2.2 }); }
    A.add(K.loftS(gs, { K: 28, sub: 3 }), isY ? K.mat('polimero', null, { tile: 'checker', rep: [2, 5], ns: .9 }) : K.mat('legno_noce', null, { c: '#9a7058' }));
    const cvo = { top: [186, -10], ang: .05, R: 0, L: 168, d0: 76, d1: 77 }, cvm = faCurva(cvo);
    faCaricatore(A, cvm, { w: 12.6, mat: K.mat('nero', null, { c: '#2a2b2c', r: .42 }), costole: [-.22, .22], s0: 48, s1: cvo.L - 12, wr: 6, hr: 1.2, dorso: true, lipF: 2, lipR: 3.4, th: 5 });
    // ---------------- punti di riferimento e animazioni
    A.anchor('bocca', [xEnd + .5, 0, 0]); A.anchor('espulsione', [164, 6, RW + 1], [0, .3, 1]);
    A.anchor('impugnatura', [70, -86, 0]); A.anchor('grilletto', [117, -50, 0]);
    A.anchor('appoggio', [440, -24, -20]); A.anchor('calcio', [e.x - 7, (e.t + e.b) / 2, 0]);
    const r = A.done();
    r.info = { azione: isY ? 'semi' : 'auto', bossolo: 'fucile_lungo', ciclo: { otturatore: { dx: -.1 }, grilletto: { rz: -.14 } }, ricarica: { caricatore: { dx: .012, dy: -.08, rz: .3 } } };
    return r;
  };
  MAP2[64] = { f: 'fa_basculante', o: { v: 'legno' } };
  MAP2[98] = { f: 'fa_basculante', o: { v: 'sintetico' } };

  // ======================================================================================================
  // FAMIGLIA 4: otturatore girevole su scatola fresata lunga con calcio tubolare pieghevole a destra, manetta piegata in su,
  // leva del selettore anche a sinistra sopra l'impugnatura, tubo del gas scoperto, alzo ribaltabile in coda alla scatola
  // v: 'assalto' (5,56, astina in polimero, caricatore lungo da 35), 'supporto' (7,62, astina in legno, bipiede, maniglia, caricatore da 25)
  FAM2.fa_tubolare = function (spec, o) {
    o = o || {}; spec = spec || {};
    const v = o.v || 'assalto', A = K.asm('fa_tubolare'), isS = v === 'supporto';
    const RL = 272, RB = -33, RT = 8, RW = 15.4;
    const prod = faUp(spec.produttore, 'Negba'), nome = faUp(spec.nome, ''), ser = faSer(spec, 'NG');
    const mSt = K.mat('nero'), mBlu = K.mat('brunito', null, { r: .36 }), mDk = faScuro(), mPol = K.mat('polimero');
    // ---------------- scatola fresata con scasso sopra il pozzetto, finestra e feritoia a destra
    const rb = [-12, RB - 4, RL + 2, RT + 4];
    const pR = K.painter(rb, { w: 1024, h: 512, rough: .46 });
    pR.text('L', prod, 112, -4, 3, { spacing: 3 }); pR.text('L', nome + (isS ? '  7,62' : '  5,56'), 112, -10.5, 2.6, { spacing: 2 }); pR.text('L', ser, 40, -24, 2.6);
    pR.text('L', 'S', 74, -13, 3.2, { h: .2 }); pR.text('L', 'A', 92, -15, 3.2, { h: .2 }); pR.text('L', 'R', 96, -25, 3.2, { h: .2 });
    for (const [x, y] of [[104, -21], [126, -21], [86, -8]]) pR.pin('LR', x, y, 2.4, { h: .5, a: 1.1 });
    pR.noise({ a: .12, r: .18, seed: 23 + (spec.id || 0) }); pR.walls({ r: .48 });
    const mR = K.mat('nero', pR.done(2.4), { ns: .85 });
    const prL = [[-10, RB + 6, 3], [-4, RB, 2], [RL, RB, 2], [RL, RT], [-10, RT, 2]];
    const prR = [[-10, RB + 6, 3], [-4, RB, 2], [RL, RB, 2], [RL, RT], [248, RT, .6], [248, -.5, 1.2], [226, -.5, 1], [224, -7, 1.5], [166, -7, 1.5], [164, -.5, 1], [104, -.5, 1.2], [104, RT, .6], [-10, RT, 2]];
    const cut = [[168, RB + 6, 2.5], [244, RB + 6, 2.5], [244, RB + 15, 2.5], [168, RB + 15, 2.5]], sk = 2.4;
    A.add(K.slab(prL, -RW, -RW + sk, { bL: 1.2, bR: 0, holes: [cut], uv: rb }), mR);
    A.add(K.slab(prL, -RW + sk, 0, { b: 0, uv: rb }), mR);
    A.add(K.slab(prR, 0, RW - sk, { b: 0, uv: rb }), mR);
    A.add(K.slab(prR, RW - sk, RW, { bL: 0, bR: 1.2, holes: [cut], uv: rb }), mR);
    // coperchio liscio lungo, alzo ribaltabile a "L" con orecchie in coda
    A.add(K.loftX(faSt([{ x: 22, t: RT + 10, b: RT - 2, w: RW - .5, lin: 1 }, { x: 28, t: RT + 14.2, b: RT - 2, w: RW + .5 }, { x: 252, t: RT + 14.2, b: RT - 2, w: RW + .5 }], { nt: 2.3, nb: 10 }), { K: 32, step: 0 }), mSt);
    A.add(K.slab([[-10, RT - 1, 2], [24, RT - 1, 2], [24, RT + 12, 2], [-10, RT + 12, 3]], -12.5, 12.5, { b: 1.4 }), mSt);
    for (const s of [-1, 1]) A.add(K.slab([[-6, RT + 10], [20, RT + 10], [20, RT + 24, 3], [14, RT + 29, 3], [-2, RT + 29, 3], [-6, RT + 24, 3]], s > 0 ? 7.4 : -11, s > 0 ? 11 : -7.4, { b: .8 }), mSt);
    A.add(K.slabX([[-5.4, RT + 11], [5.4, RT + 11], [5.4, RT + 27, 2.5], [-5.4, RT + 27, 2.5]], 6, 9, { b: .5, holes: [K.circ(0, RT + 23, 1.5, 12)] }), mSt);
    A.add(K.box(2, RT + 11, -4, 6, RT + 19, 4, .4), mSt);
    A.anchor('mira_post', [7.5, RT + 23, 0]);
    // ---------------- otturatore con manetta piegata verso l'alto
    A.add(K.box(108, -3, -9, 226, 7.4, 13.4, .8), mBlu, 'otturatore');
    A.add(K.rod(166, 238, 8.8, { cy: -.5, seg: 18 }), mBlu, 'otturatore');
    const hx = 236;
    A.add(K.box(hx - 7, -1, 0, hx + 7, 5.6, 13.4, .6), mBlu, 'otturatore');
    A.add(K.box(hx - 5, .5, 10, hx + 5, 5.3, 23, .9), mBlu, 'otturatore');
    A.add(K.latheX([[0, 0], [0, 5.2], [1.4, 6.2], [12, 6.4], [14, 5], [14.6, 0]], { seg: 18 }).rotateZ(PI / 2).translate(hx, 2, 26), mBlu, 'otturatore');
    // selettore a leva a destra e leva del pollice a sinistra
    const sel = [[-7, 0, 6], [-4, 6.4, 2], [20, 7, 0], [136, 7, 1.5], [141, 4.5, 2], [142.5, -3, 2], [138, -9.5, 2.5], [132, -9.5, 2], [129, -3, 3], [24, -3.2, 4], [0, -7.2, 5], [-6, -4.5, 4]];
    A.add(K.xf(K.slab(sel, RW, RW + 1.7, { bL: 0, bR: .6 }), { r: [0, 0, -.13], t: [66, 1, 0] }), mSt);
    A.add(faRodZ(RW - .5, RW + 3, 4.2, 66, 1, 16), mSt);
    A.add(K.xf(K.slab([[0, -3.5, 2], [26, -2, 2], [28, 2.5, 2], [0, 3.5, 2]], -1.8, 1.8, { b: .6 }), { r: [0, 0, -.6], t: [84, -14, -RW - 1.6] }), mSt);
    A.add(faRodZ(-RW - 3, -RW + .5, 4.6, 84, -14, 14), mSt);
    // ---------------- canna, tubo del gas scoperto, astina, blocco del gas, mirino alto, spegnifiamma
    const xMz = isS ? 752 : 700, gx = isS ? 520 : 478;
    A.add(K.latheX([[240, 0], [240, 12], [RL + 6, 12], [RL + 8, 10.4], [gx, 10.4], [gx + 2, 9], [xMz - 8, 8.6], [xMz - 8, 7.4], [xMz, 7.4], [xMz, 0]], { seg: 26 }), mBlu);
    A.add(K.slab([[RL - 4, -14, 3], [RL + 22, -14, 3], [RL + 22, 30, 2], [RL - 4, 30, 2]], -13.6, 13.6, { b: 1.6 }), mSt);       // tappo anteriore
    A.add(K.rod(RL + 20, gx + 4, 9, { cy: 21, seg: 22 }), mSt);
    for (let i = 0; i < 4; i++) for (const sd of [-1, 1]) A.add(faDiscZ(gx - 16 - i * 7, 23, sd * 9.05, 1.5, sd, 10), mDk);
    if (isS) A.add(K.loftX(faSt([{ x: RL + 22, t: 9, b: -22, w: 15 }, { x: RL + 30, t: 10, b: -29, w: 19.6 }, { x: gx - 26, t: 10, b: -31, w: 20.4 }, { x: gx - 10, t: 10, b: -26, w: 18 }, { x: gx - 4, t: 9, b: -20, w: 14 }], { nt: 6, nb: 2.4 }), { K: 32, step: 6 }), K.mat('legno_noce', null, { c: '#9c7c66' }));
    else { const tl = faTela(512, 256, .7); for (let i = 0; i < 6; i++) for (const vv of [.12, .57]) tl.rect(.1 + i * .14, vv - .04, .18 + i * .14, vv + .04, { h: -1, a: .2 }); tl.blots(20, { seed: 8 });
      A.add(K.loftX(faSt([{ x: RL + 22, t: 9, b: -22, w: 15 }, { x: RL + 30, t: 10, b: -28, w: 18.6 }, { x: gx - 22, t: 10, b: -29, w: 19 }, { x: gx - 8, t: 10, b: -24, w: 17 }, { x: gx - 2, t: 9, b: -19, w: 13.6 }], { nt: 6, nb: 2.6 }), { K: 32, step: 6 }), K.mat('polimero', tl.done(2.4), { ns: .9 })); }
    A.add(K.latheX([[gx - 2, 8], [gx - 2, 12.4], [gx - 1, 13], [gx + 30, 13], [gx + 31, 12], [gx + 31, 8]], { seg: 24 }), mSt);
    A.add(K.latheX([[gx - 4, 0], [gx - 4, 10], [gx - 3, 11], [gx + 24, 11], [gx + 25, 10], [gx + 25, 0]], { cy: 21, seg: 22 }), mSt);
    A.add(K.slab([[gx, 1], [gx + 30, 1], [gx + 30, 6], [gx + 24, 12], [gx + 24, 21], [gx, 21]], -7.5, 7.5, { b: 1 }), mSt);
    const fx = xMz - 44, yP = RT + 23, yE = yP + 6;
    A.add(K.latheX([[fx, 6], [fx, 10.4], [fx + 1, 11.2], [fx + 33, 11.2], [fx + 34, 10.4], [fx + 34, 6]], { seg: 24 }), mSt);
    A.add(K.slab([[fx + 2, 6], [fx + 32, 6], [fx + 30, 22, 4], [fx + 24, yP - 9, 3], [fx + 10, yP - 9, 3], [fx + 4, 22, 4]], -6, 6, { b: 1.2 }), mSt);
    for (const sd of [-1, 1]) A.add(K.slab([[fx + 6, 12], [fx + 30, 12], [fx + 30, yE - 10, 4], [fx + 24, yE, 4], [fx + 12, yE, 4], [fx + 6, yE - 10, 4]], sd > 0 ? 6 : -9.4, sd > 0 ? 9.4 : -6, { b: .8 }), mSt);
    A.add(faRodY(yP - 10, yP, 1.2, fx + 18, 0, 12), mSt);
    A.add(K.box(fx + 14, yP - 14, -3, fx + 22, yP - 9, 3, .6), mSt);
    A.anchor('mira_ant', [fx + 18, yP, 0]);
    faSpegni(A, xMz - 6, 50, 10.6, mSt, mDk, { n: 4, lb: 12, sl: 3.6, a0: PI / 4 }); const xEnd = xMz + 44;
    if (isS) {
      faBipiede(A, gx + 14, 13, { len: 220, dir: -1, mat: mSt, zl: 22 });
      // maniglia di trasporto ripiegata sul tappo anteriore
      A.add(K.slab([[RL + 2, 28, 2], [RL + 18, 28, 2], [RL + 18, 34, 2], [RL + 2, 34, 2]], -8, 8, { b: 1 }), mSt);
      A.add(K.xf(K.slab([[0, -3, 1.5], [96, -3, 4], [100, 2, 3], [96, 6, 3], [0, 4, 1.5]], -3, 3, { b: 1 }), { r: [0, 0, .02], t: [RL + 8, 33, -6] }), mSt);
      A.add(K.rod(RL + 30, RL + 90, 5.4, { cy: 37, cz: -6, seg: 14 }), mPol);
    }
    // ---------------- calcio tubolare pieghevole (tubo alto dritto, tubo basso curvo, calciolo in gomma)
    A.add(K.slab([[-26, -30, 4], [-10, -32, 2], [-10, 6, 2], [-26, 4, 4]], -13, 13, { b: 1.6 }), mSt);
    A.add(faRodY(-34, 8, 3.4, -18, RW - 1, 12), mSt);
    const mTb = K.mat('nero', null, { r: .38 });
    A.add(K.rod(-214, -24, 7.4, { cy: -2, seg: 16 }), mTb);
    const tb = []; for (let i = 0; i <= 10; i++) { const t = i / 10; tb.push({ p: [-24 - t * 188, -26 - t * 70 - Math.sin(t * PI) * 10], f: 7, r: 7, w: 7, nf: 2, nr: 2 }); }
    A.add(K.loftS(tb, { K: 16, sub: 2 }), mTb);
    A.add(K.slab([[-230, -112, 6], [-212, -110, 3], [-212, 6, 3], [-226, 8, 5], [-232, -20, 12]], -18, 18, { b: 3 }), K.mat('gomma', null, { tile: 'ribs', rep: [1, 6], ns: .6 }));
    A.add(K.slab([[-214, -104, 3], [-206, -104, 3], [-206, 2, 3], [-214, 2, 3]], -16, 16, { b: 1.2 }), mSt);
    // ---------------- impugnatura, ponticello, grilletto, sgancio
    const gs = []; for (let i = 0; i <= 8; i++) { const t = i / 8; gs.push({ p: [92 - t * 30, RB + 6 - t * 92], f: 14 + t * 2.6 + Math.exp(-Math.pow((t - .9) / .08, 2)) * 3, r: 16.6 + t * 1.8, w: 13.6 + Math.sin(t * PI) * 1.5, nf: 2.3, nr: 2.2 }); }
    A.add(K.loftS(gs, { K: 28, sub: 3 }), K.mat('polimero', null, { tile: 'stipple', rep: [3, 4], ns: .6 }));
    A.add(K.slab([[96, RB + 1.5], [156, RB + 1.5], [156, RB - 3, 1.5], [152, RB - 21, 6], [105, RB - 22, 7], [96, RB - 9, 4]], -5, 5, { b: .9, holes: [[[102, RB - 1.2, 1], [151, RB - 1.2, 1], [148, RB - 17.5, 4.5], [108, RB - 18.5, 5.5], [102, RB - 8, 3]]] }), mSt);
    A.add(K.slab([[154.5, RB + 1], [162, RB + 1], [162.5, RB - 4, 1.5], [160.5, RB - 14, 2], [156.5, RB - 13.5, 1.5], [157.5, RB - 4, 1]], -5.5, 5.5, { b: .7 }), mSt);
    A.add(K.slab([[122.5, RB + 2, 1], [128.5, RB + 2, 1], [127.6, RB - 6, 4], [123.2, RB - 15.5, 1.2], [119.8, RB - 14.5, 1], [123.2, RB - 6, 4]], -3.2, 3.2, { b: .7 }), mSt, 'grilletto');
    A.pivot('grilletto', [125.5, RB + 4, 0]);
    // ---------------- caricatore
    const cvo = isS ? { top: [198, -10], ang: .06, R: 900, L: 186, d0: 76, d1: 80 } : { top: [198, -10], ang: .08, R: 520, L: 236, d0: 60, d1: 64 };
    const cvm = faCurva(cvo);
    faCaricatore(A, cvm, { w: isS ? 12.8 : 11.4, mat: K.mat('nero', null, { c: '#2c2e30', r: .45 }), costole: isS ? [-.24, .24] : [-.2, .2], s0: 32, s1: cvo.L - 12, wr: 4.4, hr: 1.1, dorso: true, lipF: 2.5, lipR: 3, th: 5 });
    // ---------------- punti di riferimento
    A.anchor('bocca', [xEnd + .5, 0, 0]); A.anchor('espulsione', [196, 2, RW + 1], [0, .3, 1]);
    A.anchor('impugnatura', [76, -72, 0]); A.anchor('grilletto', [124, RB - 9, 0]);
    A.anchor('appoggio', [RL + 120, -26, -16]); A.anchor('calcio', [-230, -50, 0]);
    const r = A.done();
    r.info = { azione: 'auto', bossolo: isS ? 'fucile_lungo' : 'fucile', ciclo: { otturatore: { dx: -.11 }, grilletto: { rz: -.15 } }, ricarica: { caricatore: { dx: .012, dy: -.08, rz: .3 } } };
    return r;
  };
  MAP2[69] = { f: 'fa_tubolare', o: { v: 'assalto' } };
  MAP2[99] = { f: 'fa_tubolare', o: { v: 'supporto' } };

  // ======================================================================================================
  // FAMIGLIA 5: fucile d'assalto con scatola stampata a sezione trapezia, maniglia di trasporto piatta smontabile con la diottra,
  // astina a sezione triangolare, mirino alto a orecchie sul blocco del gas, calcio fisso in polimero, caricatore normalizzato
  // v: 'assalto' (canna leggera), 'pesante' (canna pesante fissa, bipiede ripiegato, astina più lunga, freno-spegnifiamma)
  FAM2.fa_maniglia = function (spec, o) {
    o = o || {}; spec = spec || {};
    const v = o.v || 'assalto', A = K.asm('fa_maniglia'), isH = v === 'pesante';
    const RL = 262, UT = 22, UB = -14, LB = -34, RW = 14.4;
    const prod = faUp(spec.produttore, 'Vesuvia Armi'), nome = faUp(spec.nome, ''), ser = faSer(spec, 'VA');
    const mSt = K.mat('nero'), mBlu = K.mat('brunito', null, { r: .36 }), mDk = faScuro(), mPol = K.mat('polimero', null, { tile: 'grana', rep: [6, 6], ns: .3 });
    // ---------------- scatola superiore (trapezia) e inferiore
    const rb = [-6, -56, RL + 30, UT + 4];
    const pR = K.painter(rb, { w: 1024, h: 512, rough: .5 });
    pR.text('L', prod, 116, 8, 3, { spacing: 3 }); pR.text('L', nome + '  5,56', 116, 1.5, 2.6, { spacing: 2 }); pR.text('L', ser, 116, -4.5, 2.4);
    pR.text('R', ser, 70, -25, 2.4);
    for (const [t, x, y] of [['S', 60, -17], ['1', 70, -14.5], ['3', 80, -15.5], ['A', 86, -22.5]]) pR.text('LR', t, x, y, 2.8, { h: .25 });
    pR.line('LR', [[4, UB + .3], [RL - 4, UB + .3]], .8, { h: -.8, a: .6 });
    for (const [x, y] of [[24, -22], [128, -22], [208, -6]]) pR.pin('LR', x, y, 2.4, { h: .45, a: 1.1 });
    pR.line('LR', [[10, 15], [RL - 30, 15]], 1, { h: -.5, a: .8 });
    pR.noise({ a: .1, r: .16, seed: 29 + (spec.id || 0) }); pR.walls({ r: .5 });
    const mR = K.mat('nero', pR.done(2.4), { ns: .85 });
    const up = [[0, UB, 2], [RL - 12, UB, 3], [RL + 22, 2, 4], [RL + 22, 12, 3], [RL, UT, 3], [0, UT, 2]];
    const port = [[150, -4, 2], [214, -4, 2], [214, 12, 2], [150, 12, 2]];
    A.add(K.slab(up, -RW, 0, { bL: 2.4, bR: 0, uv: rb }), mR);
    A.add(K.slab(up, 0, RW - 3, { b: 0, uv: rb, holes: [port] }), mR);
    A.add(K.slab(up, RW - 3, RW, { bL: 0, bR: 2.4, uv: rb, holes: [port] }), mR);
    A.add(K.box(148, -6, -RW + 2, 216, 14, 1, .5), mDk);
    A.add(K.loftX(faSt([{ x: 2, t: UT + 1, b: UT - 6, w: RW - 1.5 }, { x: 6, t: UT + 2.2, b: UT - 6, w: RW - .6 }, { x: RL - 4, t: UT + 2.2, b: UT - 6, w: RW - .6 }, { x: RL + 2, t: UT, b: UT - 6, w: RW - 2 }], { nt: 6, nb: 10 }), { K: 28, step: 0 }), mSt);
    const lo = [[2, UB, 2], [214, UB, 2], [214, -24, 2], [210, -48, 3], [142, -48, 2], [140, LB, 2], [10, LB + 2, 6], [2, -24, 4]];
    A.add(K.slab(lo, -RW + .5, RW - .5, { b: 1.6, uv: rb }), mR);
    // otturatore con manetta a destra (si muove sparando)
    A.add(K.box(90, -2, -8, 214, 12.6, 11.4, .8), mBlu, 'otturatore');
    A.add(K.rod(160, 214, 8.4, { cy: 2, seg: 18 }), mBlu, 'otturatore');
    A.add(K.box(196, 4, 8, 210, 10, RW + 3, .8), mBlu, 'otturatore');
    A.add(K.latheX([[0, 0], [0, 5.4], [1.4, 6.4], [11, 6.6], [13, 5.2], [13.6, 0]], { seg: 18 }).rotateY(-PI / 2).translate(203, 7, RW + 2.5), mBlu, 'otturatore');
    // ---------------- maniglia di trasporto con diottra posteriore
    const yH = UT + 36;
    A.add(K.slab([[14, UT, 3], [52, UT, 3], [52, UT + 8, 3], [196, UT + 8, 3], [196, UT, 3], [222, UT, 3], [222, UT + 10, 4], [206, yH, 6], [40, yH, 5], [14, yH - 4, 4]], -9, 9, { b: 2.4, holes: [[[60, UT + 14, 6], [192, UT + 14, 6], [196, yH - 8, 5], [56, yH - 8, 5]]] }), mSt);
    for (const sd of [-1, 1]) A.add(K.slab([[16, yH - 6], [40, yH - 6], [40, yH + 6, 3], [34, yH + 9, 3], [20, yH + 9, 3], [16, yH + 4, 3]], sd > 0 ? 5 : -9, sd > 0 ? 9 : -5, { b: .7 }), mSt);
    A.add(K.slabX([[-4.6, yH - 4], [4.6, yH - 4], [4.6, yH + 7, 2], [-4.6, yH + 7, 2]], 26, 29, { b: .4, holes: [K.circ(0, yH + 3, 1.4, 12)] }), mSt);
    for (const xx of [30, 206]) A.add(faRodZ(-11, 11, 3, xx, UT + 4, 12), mSt);
    A.anchor('mira_post', [27.5, yH + 3, 0]);
    // ---------------- canna, astina triangolare, blocco del gas con mirino alto, spegnifiamma
    const xMz = isH ? 690 : 680, rBr = isH ? 11 : 8.6, gx = isH ? 560 : 520;
    A.add(K.latheX([[228, 0], [228, 12], [RL + 24, 12], [RL + 26, rBr + 1.4], [gx, rBr + 1], [gx + 2, rBr], [xMz - 8, rBr - .2], [xMz - 8, 7.6], [xMz, 7.6], [xMz, 0]], { seg: 26 }), mBlu);
    const hgL = gx - 4;
    const tl = faTela(1024, 256, .7);
    for (let i = 0; i < 9; i++) for (const vv of [.15, .6]) tl.rect(.08 + i * .1, vv - .025, .14 + i * .1, vv + .025, { h: -1, a: .15 });
    for (let i = 0; i < 4; i++) tl.rect(.04, .3 + i * .05, .96, .3 + i * .05 + .012, { h: .8 });
    tl.blots(30, { seed: 13 });
    A.add(K.loftX(faSt([{ x: RL + 22, t: 22, b: -16, w: 16 }, { x: RL + 30, t: 24, b: -27, w: 21 }, { x: hgL - 10, t: 24, b: -27, w: 21 }, { x: hgL, t: 21, b: -20, w: 17 }], { nt: 6, nb: 1.15 }), { K: 32, step: 6 }), K.mat('polimero', tl.done(2.6), { ns: 1 }));
    A.add(K.latheX([[hgL - 2, rBr], [hgL - 2, 13], [hgL, 14.4], [hgL + 8, 14.4], [hgL + 9, 13], [hgL + 9, rBr]], { seg: 24 }), mSt);
    // blocco del gas e mirino
    const fx = gx + 4, yP = yH + 3;
    A.add(K.latheX([[fx, rBr - .5], [fx, rBr + 3], [fx + 1, rBr + 4], [fx + 34, rBr + 4], [fx + 35, rBr + 3], [fx + 35, rBr - .5]], { seg: 24 }), mSt);
    A.add(K.slab([[fx + 4, 4], [fx + 32, 4], [fx + 28, yP - 16, 4], [fx + 22, yP - 12, 3], [fx + 12, yP - 12, 3], [fx + 6, yP - 16, 4]], -6, 6, { b: 1.4 }), mSt);
    for (const sd of [-1, 1]) A.add(K.slab([[fx + 8, yP - 16], [fx + 28, yP - 16], [fx + 28, yP + 1, 3], [fx + 23, yP + 6, 3], [fx + 13, yP + 6, 3], [fx + 8, yP + 1, 3]], sd > 0 ? 5 : -8, sd > 0 ? 8 : -5, { b: .7 }), mSt);
    A.add(faRodY(yP - 14, yP, 1.2, fx + 18, 0, 12), mSt);
    A.anchor('mira_ant', [fx + 18, yP, 0]);
    A.add(K.latheX([[fx + 35, 0], [fx + 35, 6], [fx + 36, 7], [fx + 46, 7], [fx + 48, 5], [fx + 48, 0]], { cy: 16, seg: 18 }), K.mat('nero', null, { tile: 'knurl', rep: [2, 2], ns: .8 }));   // regolatore del gas
    A.add(K.slab([[fx + 6, -8], [fx + 32, -8], [fx + 32, -15, 1.5], [fx + 28, -18, 1.5], [fx + 10, -18, 1.5], [fx + 6, -14, 1.5]], -4.4, 4.4, { b: .6 }), mSt);
    let xEnd;
    if (isH) { faFrenoFinestre(A, xMz - 6, 12, mSt, mDk, { L: 64, la: 16, lf: 12, aw: .28, rb: 4 }); xEnd = xMz + 58; faBipiede(A, gx - 30, rBr + 2, { len: 230, dir: -1, mat: mSt, zl: 25 }); }
    else { faSpegni(A, xMz - 6, 52, 11, mSt, mDk, { n: 6, lb: 12, sl: 3.4, chiuso: true, lf: 6 }); xEnd = xMz + 46; }
    // ---------------- calcio fisso in polimero
    const sb = [-262, -134, 4, 24];
    const pS = K.painter(sb, { w: 1024, h: 512, rough: .7 });
    pS.fill('LR', [[-236, -18], [-60, -6], [-60, -24], [-232, -82]], { h: -.5, a: .9 }); pS.noise({ a: .05, r: .08, seed: 31 }); pS.wallFill({ r: .7 });
    A.add(K.slab([[-252, -122, 5], [-150, -78, 30], [-40, -40, 12], [2, -26, 2], [2, 20, 2], [-30, 20, 4], [-252, 8, 6]], -18, 18, { b: 5, uv: sb }), K.mat('polimero', pS.done(2), { ns: .7 }));
    A.add(K.slab([[-262, -128, 5], [-250, -124, 2], [-250, 10, 2], [-262, 12, 5]], -19, 19, { b: 2.4 }), K.mat('gomma', null, { tile: 'ribs', rep: [1, 6], ns: .6 }));
    WC.put(A, WC.swivel(-214, -106, 0, { r: 7, t: 1.5, rot: PI / 2, mat: mSt }));
    // ---------------- impugnatura con appoggi per le dita, ponticello largo, grilletto, sgancio
    const gs = []; for (let i = 0; i <= 8; i++) { const t = i / 8, fg = Math.sin(t * PI * 3) * (t > .2 && t < .95 ? 1.4 : 0); gs.push({ p: [86 - t * 32, LB + 6 - t * 90], f: 14.4 + t * 2.4 + fg, r: 16.6 + t * 2.2, w: 14 + Math.sin(t * PI) * 1.6, nf: 2.4, nr: 2.2 }); }
    A.add(K.loftS(gs, { K: 28, sub: 3 }), K.mat('polimero', null, { tile: 'stipple', rep: [3, 4], ns: .6 }));
    A.add(K.slab([[86, LB + 1], [140, LB + 1], [140, -40, 2], [136, -58, 4], [90, -60, 5]], -7, 7, { b: 1.4, holes: [[[94, LB - 2, 2], [134, LB - 2, 2], [131, -54, 3.5], [95, -55, 4]]] }), mPol);
    A.add(K.slab([[110, LB + 1, 1], [116, LB + 1, 1], [115, -42, 4], [111, -51.5, 1.2], [107.4, -50.5, 1], [111, -42, 4]], -3.4, 3.4, { b: .7 }), mSt, 'grilletto');
    A.pivot('grilletto', [113, LB + 3, 0]);
    for (const sd of [-1, 1]) A.add(K.xf(K.slab([[0, -2.6, 2], [18, -1.6, 1], [20, 1.6, 1], [0, 2.6, 2]], -1.4, 1.4, { b: .5 }), { r: [0, 0, -.4], t: [68, -22, sd * (RW + 1.2)] }), mSt);
    A.add(faRodZ(-RW - 2.6, RW + 2.6, 4, 68, -22, 14), mSt);
    A.add(faRodZ(RW - 1, RW + 2.4, 3.4, 204, -38, 12), mSt);
    // caricatore normalizzato (dritto in alto, curvo in basso)
    const cvo = { top: [178, -8], ang: .05, R: 620, L: 196, d0: 62, d1: 64 }, cvm = faCurva(cvo);
    faCaricatore(A, cvm, { w: 11.2, mat: K.mat('anod', null, { c: '#2a2d30', r: .5 }), costole: [-.3, .3], s0: 40, s1: cvo.L - 14, wr: 3, hr: .9, dorso: false, lipF: 1.5, lipR: 2, th: 4.6, b: 1.2 });
    // ---------------- punti di riferimento
    A.anchor('bocca', [xEnd + .5, 0, 0]); A.anchor('espulsione', [182, 4, RW + 1], [0, .3, 1]);
    A.anchor('impugnatura', [70, -78, 0]); A.anchor('grilletto', [111, -46, 0]);
    A.anchor('appoggio', [RL + 140, -26, -20]); A.anchor('calcio', [-262, -58, 0]);
    const r = A.done();
    r.info = { azione: 'auto', bossolo: 'fucile', ciclo: { otturatore: { dx: -.096 }, grilletto: { rz: -.15 } }, ricarica: { caricatore: { dx: .004, dy: -.1, rz: .04 } } };
    return r;
  };
  MAP2[73] = { f: 'fa_maniglia', o: { v: 'assalto' } };
  MAP2[149] = { f: 'fa_maniglia', o: { v: 'pesante' } };

  // ======================================================================================================
  // FAMIGLIA 6: fucile con scatola stampata bassa, gruppo di scatto in polimero con impugnatura integrata, caricatori trasparenti
  // con perni di accoppiamento, calcio a scheletro pieghevole a destra, manetta tonda a destra
  // v: 'standard' (5,56: diottra a tamburo, astina ovale con bipiede integrato ripiegato, spegnifiamma a gabbia),
  //    'moderna' (7,62: slitta continua sulla scatola e sull'astina, calcio telescopico con poggiaguancia, spegnifiamma lungo, canna corta)
  // materiale trasparente del caricatore (si vedono le cartucce all'interno)
  function faTrasparente(c) { const m = K.mat('polimero', null, { c: c || '#5a3c1c', r: .2 }); m.transparent = true; m.opacity = .64; m.metalness = 0; m.envMapIntensity = 1.4; return m; }
  FAM2.fa_trasparente = function (spec, o) {
    o = o || {}; spec = spec || {};
    const v = o.v || 'standard', A = K.asm('fa_trasparente'), isM = v === 'moderna';
    const RL = 250, UT = 18, UB = -16, RW = 14.2;
    const prod = faUp(spec.produttore, 'Brunner & Keller'), nome = faUp(spec.nome, ''), ser = faSer(spec, 'BK');
    const mSt = K.mat('nero'), mBlu = K.mat('brunito', null, { r: .36 }), mDk = faScuro();
    const mPol = K.mat('polimero', null, { c: isM ? '#1b1c1e' : '#20241e', tile: 'grana', rep: [6, 6], ns: .3 });
    // ---------------- scatola stampata con finestra di espulsione a destra
    const rb = [-6, -50, RL + 34, UT + 4];
    const pR = K.painter(rb, { w: 1024, h: 512, rough: .5 });
    pR.line('LR', [[6, 6], [RL - 2, 6]], 1.2, { h: -.7, a: .8 }); pR.line('LR', [[6, -8], [RL - 40, -8]], .9, { h: -.5, a: .85 });
    pR.text('L', prod, 150, -1, 2.8, { spacing: 2 }); pR.text('L', nome + (isM ? '  7,62' : '  5,56'), 150, -12, 2.6, { spacing: 2 }); pR.text('L', ser, 60, -12, 2.4);
    for (const [x, y] of [[14, 0], [14, -11], [226, -2]]) pR.pin('LR', x, y, 2.2, { h: .4, a: 1.1 });
    pR.noise({ a: .1, r: .16, seed: 37 + (spec.id || 0) }); pR.walls({ r: .5 });
    const mR = K.mat('nero', pR.done(2.4), { ns: .85 });
    const up = [[0, UB, 2], [RL - 6, UB, 3], [RL + 30, -8, 4], [RL + 30, 10, 3], [RL + 4, UT, 3], [0, UT, 2]];
    const port = [[132, -6, 2], [196, -6, 2], [196, 10, 2], [132, 10, 2]];
    A.add(K.slab(up, -RW, 0, { bL: 2.2, bR: 0, uv: rb }), mR);
    A.add(K.slab(up, 0, RW - 3, { b: 0, uv: rb, holes: [port] }), mR);
    A.add(K.slab(up, RW - 3, RW, { bL: 0, bR: 2.2, uv: rb, holes: [port] }), mR);
    A.add(K.box(130, -8, -RW + 2, 198, 12, 1, .5), mDk);
    A.add(K.loftX(faSt([{ x: 1, t: UT, b: UT - 6, w: RW - 1.4 }, { x: 5, t: UT + 1.6, b: UT - 6, w: RW - .4 }, { x: RL, t: UT + 1.6, b: UT - 6, w: RW - .4 }, { x: RL + 6, t: UT - .5, b: UT - 6, w: RW - 2 }], { nt: 3, nb: 10 }), { K: 28, step: 0 }), mSt);
    // pozzetto del caricatore in lamiera
    A.add(K.slab([[136, UB + 1, 1], [206, UB + 1, 1], [206, -38, 2], [210, -44, 2], [134, -44, 2], [134, -38, 1]], -13.6, 13.6, { b: 1.4, uv: rb }), mR);
    // otturatore e manetta tonda a destra
    A.add(K.box(70, -4, -8, 206, 13.6, 11.4, .8), mBlu, 'otturatore');
    A.add(K.rod(140, 206, 8.4, { cy: 0, seg: 18 }), mBlu, 'otturatore');
    A.add(K.box(206, 0, 4, 216, 8, RW + 6, .8), mBlu, 'otturatore');
    A.add(K.latheX([[0, 0], [0, 6.6], [1.4, 7.6], [9, 7.8], [11, 6.6], [11.6, 0]], { seg: 20 }).rotateY(-PI / 2).translate(211, 4, RW + 5), mBlu, 'otturatore');
    // ---------------- gruppo di scatto in polimero con impugnatura e ponticello ribaltabile
    const hb = [10, -132, 206, -14];
    const pT = K.painter(hb, { w: 512, h: 512, rough: .7 }), kB = .14;
    pT.fill('LR', [[hb[0], hb[1]], [hb[2], hb[1]], [hb[2], hb[3]], [hb[0], hb[3]]], { a: kB }); pT.wallFill({ a: kB, r: .7 });
    for (const [t, x, y] of [['S', 56, -19], ['1', 68, -17], ['20', 78, -24]]) pT.text('L', t, x, y, 3, { a: .8, h: .2 });
    pT.stipple('LR', [[54, -50], [84, -50], [70, -118], [38, -118]], { s: .3, a: kB * .9 });
    pT.noise({ a: .04, r: .06, seed: 2 });
    const mT = K.mat('polimero', pT.done(2), { ns: .8, c: isM ? '#c4c4c4' : '#c8d0c4' });
    A.add(K.slab([[10, UB + 1, 2], [134, UB + 1, 1], [134, -38, 2], [96, -40, 4], [86, -50, 6], [80, -118, 6], [84, -128, 4], [46, -128, 5], [44, -118, 6], [56, -60, 10], [36, -40, 8], [12, -36, 6]], -13, 13, { b: 4.5, uv: hb }), mT);
    A.add(K.slab([[96, -40, 2], [134, -40, 2], [134, -46, 2], [128, -58, 5], [96, -58, 5], [94, -50, 3]], -6, 6, { b: 1.2, holes: [[[100, -44, 2], [128, -44, 2], [125, -54, 3], [100, -54, 3]]] }), mPol);
    A.add(K.slab([[110, -38, 1], [116, -38, 1], [115, -45, 3], [111, -53, 1], [107.6, -52, 1], [111, -45, 3]], -3.2, 3.2, { b: .7 }), mSt, 'grilletto');
    A.pivot('grilletto', [113, -36, 0]);
    A.add(K.xf(K.slab([[0, -2.6, 2], [18, -1.6, 1], [20, 1.6, 1], [0, 2.6, 2]], -1.4, 1.4, { b: .5 }), { r: [0, 0, -.3], t: [62, -22, -13.8] }), mSt);
    A.add(faRodZ(-15, -12, 4, 62, -22, 14), mSt);
    A.add(faRodZ(12, 15.6, 3.2, 200, -32, 12), mSt);
    // ---------------- canna, astina, blocco del gas, mirino, spegnifiamma
    const xMz = isM ? 650 : 760, gx = isM ? 520 : 600, rBr = isM ? 10 : 8.6;
    A.add(K.latheX([[218, 0], [218, 12], [RL + 34, 12], [RL + 36, rBr + 1.6], [gx, rBr + 1.2], [gx + 2, rBr], [xMz - 8, rBr - .4], [xMz - 8, 7.6], [xMz, 7.6], [xMz, 0]], { seg: 26 }), mBlu);
    let yP;
    if (!isM) {
      const tl = faTela(1024, 256, .7);
      for (let i = 0; i < 14; i++) tl.rect(.18 + i * .045, .12, .2 + i * .045, .98, { h: .9, a: 1 });
      for (const vv of [.33, .78]) tl.rect(.1, vv - .02, .92, vv + .02, { h: -1, a: .3 });
      tl.blots(30, { seed: 19 });
      A.add(K.loftX(faSt([{ x: RL + 28, t: 12, b: -14, w: 15 }, { x: RL + 36, t: 18, b: -26, w: 20 }, { x: 420, t: 20, b: -30, w: 22 }, { x: gx - 40, t: 18, b: -27, w: 20.4 }, { x: gx - 18, t: 13, b: -19, w: 15 }], { nt: 3.2, nb: 2.3 }), { K: 32, step: 6 }), K.mat('polimero', tl.done(2.8), { ns: 1, c: '#20241e' }));
      // bipiede integrato: gambe ripiegate all'indietro lungo i fianchi bassi dell'astina, cerniera sotto il blocco del gas
      faBipiede(A, gx - 6, rBr + 1, { len: 270, dir: -1, mat: mSt, zl: 21.5 });
      yP = UT + 26;
    } else {
      A.add(K.slab([[RL + 28, -26, 4], [gx - 4, -26, 4], [gx - 4, UT - .5, 2], [RL + 28, UT - .5, 2]], -17, 17, { b: 3 }), mPol);
      const mA = K.mat('anod');
      WC.put(A, WC.rail(4, gx - 6, UT + 1.4, { mat: mA }));
      WC.put(A, WC.rail(RL + 60, gx - 12, 17, { dir: 'dx', mat: mA })); WC.put(A, WC.rail(RL + 60, gx - 12, 17, { dir: 'sx', mat: mA })); WC.put(A, WC.rail(RL + 60, gx - 12, 26, { dir: 'giu', mat: mA }));
      yP = UT + 26;
    }
    A.add(K.latheX([[gx - 4, rBr - .3], [gx - 4, rBr + 3], [gx - 3, rBr + 4], [gx + 30, rBr + 4], [gx + 31, rBr + 3], [gx + 31, rBr - .3]], { seg: 24 }), mSt);
    A.add(K.latheX([[gx - 6, 0], [gx - 6, 7], [gx - 5, 8], [gx + 22, 8], [gx + 23, 7], [gx + 23, 0]], { cy: 16, seg: 20 }), mSt);
    A.add(K.slab([[gx, 4], [gx + 28, 4], [gx + 26, yP - 14, 4], [gx + 20, yP - 10, 3], [gx + 8, yP - 10, 3], [gx + 2, yP - 14, 4]], -5.6, 5.6, { b: 1.2 }), mSt);
    A.add(K.latheX([[gx + 7, 8.4], [gx + 7, 10.2], [gx + 8, 10.8], [gx + 21, 10.8], [gx + 22, 10.2], [gx + 22, 8.4], [gx + 20.6, 8.4], [gx + 8.4, 8.4]], { seg: 28, cy: yP - 1 }), mSt);
    A.add(faRodY(yP - 12, yP, 1.2, gx + 14, 0, 12), mSt);
    A.anchor('mira_ant', [gx + 14, yP, 0]);
    let xEnd;
    if (isM) { faSpegni(A, xMz - 6, 70, 11.6, mSt, mDk, { n: 6, lb: 14, sl: 3.6 }); xEnd = xMz + 64; }
    else { faSpegni(A, xMz - 6, 46, 11, mSt, mDk, { n: 5, lb: 12, sl: 3.6, chiuso: true, lf: 6, chiusoSotto: true, a0: -PI / 2 }); xEnd = xMz + 40; }
    // mire posteriori
    if (!isM) {
      A.add(K.slab([[8, UT, 2], [44, UT, 2], [44, UT + 6, 2], [8, UT + 6, 2]], -11, 11, { b: 1 }), mSt);
      A.add(faRodZ(-6, 6, 8.4, 26, UT + 14, 22), mSt);
      for (let i = 0; i < 4; i++) { const a = PI + i * PI / 2; A.add(faRodZ(-1, 1, 1.3, 26 + Math.cos(a) * 8.5, UT + 14 + Math.sin(a) * 8.5, 10), mDk); }
      for (const sd of [-1, 1]) A.add(K.slab([[10, UT + 4], [42, UT + 4], [42, UT + 15, 3], [36, UT + 22, 4], [16, UT + 22, 4], [10, UT + 15, 3]], sd > 0 ? 6.6 : -10.2, sd > 0 ? 10.2 : -6.6, { b: .8 }), mSt);
      A.anchor('mira_post', [18, UT + 14, 0]);
    } else {
      A.add(K.slab([[10, UT + 10.8], [34, UT + 10.8], [34, UT + 16, 2], [10, UT + 16, 2]], -10, 10, { b: .8 }), mSt);
      for (const sd of [-1, 1]) A.add(K.slab([[12, UT + 15], [32, UT + 15], [32, UT + 24, 3], [26, UT + 28, 3], [16, UT + 28, 3], [12, UT + 24, 3]], sd > 0 ? 6 : -9.4, sd > 0 ? 9.4 : -6, { b: .7 }), mSt);
      A.add(K.slabX(K.circ(0, UT + 23, 5, 22), 20, 23, { b: .5, holes: [K.circ(0, UT + 23, 1.4, 12)] }), mSt);
      A.anchor('mira_post', [21.5, UT + 23, 0]);
    }
    // ---------------- calcio pieghevole a scheletro (o telescopico) con calciolo in gomma
    A.add(K.slab([[-18, -24, 3], [0, -26], [0, 14], [-18, 12, 3]], -12.6, 12.6, { b: 1.4 }), mSt);
    A.add(faRodY(-26, 14, 3, -9, 13.4, 12), mSt);
    if (!isM) {
      const sb = [-220, -130, -14, 22];
      A.add(K.slab([[-206, -118, 6], [-120, -66, 18], [-40, -34, 10], [-16, -26, 3], [-16, 16, 3], [-206, 10, 6]], -16, 16, { b: 4, uv: sb, holes: [[[-182, -84, 8], [-62, -26, 8], [-72, 2, 6], [-182, 0, 8]]] }), mPol);
      A.add(K.slab([[-216, -124, 5], [-204, -120, 2], [-204, 12, 2], [-216, 14, 5]], -17.4, 17.4, { b: 2.4 }), K.mat('gomma', null, { tile: 'ribs', rep: [1, 6], ns: .6 }));
    } else {
      A.add(K.rod(-180, -16, 8.6, { cy: 2, seg: 18 }), K.mat('anod'));
      A.add(K.slab([[-226, -110, 5], [-180, -70, 16], [-150, -26, 8], [-142, -6, 3], [-142, 12, 3], [-226, 12, 5]], -17, 17, { b: 3.6, holes: [[[-206, -70, 6], [-172, -40, 8], [-206, -12, 5]]] }), mPol);
      A.add(K.slab([[-214, 12, 3], [-150, 12, 3], [-154, 22, 4], [-208, 22, 4]], -12, 12, { b: 3 }), mPol);
      A.add(K.slab([[-236, -116, 5], [-224, -112, 2], [-224, 16, 2], [-236, 18, 5]], -18, 18, { b: 2.4 }), K.mat('gomma', null, { tile: 'stipple', rep: [3, 3], ns: .5 }));
    }
    // ---------------- caricatore trasparente con cartucce visibili e perni di accoppiamento
    const cvo = isM ? { top: [172, -8], ang: .04, R: 0, L: 168, d0: 78, d1: 79 } : { top: [170, -8], ang: .07, R: 520, L: 178, d0: 62, d1: 64 };
    const cvm = faCurva(cvo), mTr = faTrasparente(isM ? '#3e3428' : '#5e3e1e');
    faCaricatore(A, cvm, { w: isM ? 12.6 : 11.4, mat: mTr, b: 1.4, s0: 30, s1: cvo.L - 10, costole: [], dorso: false, lipF: 1.6, lipR: 2.4, th: 5, matPiede: mPol });
    A.add(K.slab(cvm.band(4, cvo.L - 8, s => -cvm.d(s) / 2 + 3, s => -cvm.d(s) / 2 + 3 + (isM ? 60 : 50), 2), -5.6, 5.6, { b: .6 }), K.mat('ottone'), 'caricatore');
    for (const [sx, q] of [[46, -.3], [cvo.L - 30, .28]]) for (const sd of [-1, 1]) { const p0 = cvm.pt(sx, q * cvm.d(sx)); A.add(faRodZ(sd > 0 ? (isM ? 12.6 : 11.4) - .5 : -(isM ? 12.6 : 11.4) - 2.4, sd > 0 ? (isM ? 12.6 : 11.4) + 2.4 : -(isM ? 12.6 : 11.4) + .5, 3, p0[0], p0[1], 12), mPol, 'caricatore'); }
    // ---------------- punti di riferimento
    A.anchor('bocca', [xEnd + .5, 0, 0]); A.anchor('espulsione', [164, 2, RW + 1], [0, .3, 1]);
    A.anchor('impugnatura', [66, -84, 0]); A.anchor('grilletto', [110, -48, 0]);
    A.anchor('appoggio', [RL + 150, -28, -20]); A.anchor('calcio', [isM ? -236 : -216, -54, 0]);
    const r = A.done();
    r.info = { azione: 'auto', bossolo: isM ? 'fucile_lungo' : 'fucile', ciclo: { otturatore: { dx: -.1 }, grilletto: { rz: -.15 } }, ricarica: { caricatore: { dx: .006, dy: -.09, rz: .08 } } };
    return r;
  };
  MAP2[75] = { f: 'fa_trasparente', o: { v: 'standard' } };
  MAP2[102] = { f: 'fa_trasparente', o: { v: 'moderna' } };

  // ======================================================================================================
  // FAMIGLIA 7: fucili da battaglia con calciatura intera in legno, scatola corta con otturatore a vista sopra, asta di armamento
  // con manetta a uncino sul lato destro, cilindro del gas sotto la canna, copricanna superiore in legno
  // v: 'standard' (spegnifiamma a denti con mirino, astina lunga), 'tricomp' (tricompensatore con anelli lanciagranate, alzo per granate,
  //    bipiede ripiegato sotto l'astina, canna più corta)
  FAM2.fa_legno_lungo = function (spec, o) {
    o = o || {}; spec = spec || {};
    const v = o.v || 'standard', A = K.asm('fa_legno_lungo'), isB = v === 'tricomp';
    const RL = 226, RT = 16, RB = -10, RW = 13.6;
    const prod = faUp(spec.produttore, 'Brookfield Armory'), nome = faUp(spec.nome, ''), ser = faSer(spec, isB ? 'VA' : 'BA');
    const mSt = K.mat(isB ? 'brunito' : 'parker', null, { r: isB ? .4 : .62 }), mBlu = K.mat('brunito', null, { r: .36 }), mDk = faScuro();
    const mWood = K.mat('legno_noce', null, { c: isB ? '#8e6e5e' : '#a68672' });
    // ---------------- scatola: fianchi con scritte, otturatore a vista sopra, mira posteriore con manopole
    const rb = [-4, RB - 4, RL + 4, RT + 6];
    const pR = K.painter(rb, { w: 1024, h: 256, rough: isB ? .4 : .6 });
    pR.text('L', prod, 150, 2, 2.8, { spacing: 2 }); pR.text('L', nome + '  7,62', 150, -4, 2.4, { spacing: 2 }); pR.text('L', ser, 60, 2, 2.4);
    pR.text('R', ser, 60, -4, 2.2);
    pR.noise({ a: .12, r: .18, seed: 41 + (spec.id || 0) }); pR.walls({ r: isB ? .4 : .6 });
    const mR = K.mat(isB ? 'brunito' : 'parker', pR.done(2.4), { ns: .85 });
    const prS = [[0, RB, 2], [RL, RB, 2], [RL, 6, 2], [RL - 10, RT, 2], [150, RT, 1], [146, RT - 3, 2], [60, RT - 3, 2], [56, RT, 1], [8, RT + 4, 3], [0, RT + 2, 3]];
    const prR = [[0, RB, 2], [RL, RB, 2], [RL, 6, 2], [RL - 10, RT, 2], [150, RT, 1], [146, RT - 3, 2], [146, -1, 1.5], [70, -1, 1.5], [60, RT - 3, 2], [56, RT, 1], [8, RT + 4, 3], [0, RT + 2, 3]];
    A.add(K.slab(prS, -RW, 0, { bL: 1.8, bR: 0, uv: rb }), mR);
    A.add(K.slab(prR, 0, RW, { bL: 0, bR: 1.8, uv: rb }), mR);
    // otturatore cilindrico a vista con rullo, asta di armamento lungo il fianco destro con manetta a uncino (parte mobile)
    A.add(K.rod(56, 152, 9.4, { cy: 6, seg: 20 }), mBlu, 'otturatore');
    A.add(K.box(70, -1, 2, 146, 13, 12.2, 1), mBlu, 'otturatore');
    A.add(faRodZ(0, 9, 4.6, 140, 13, 14), mBlu, 'otturatore');
    A.add(K.rod(150, isB ? 520 : 560, 4, { cy: 2, cz: 15.2, seg: 12 }), mBlu, 'otturatore');
    A.add(K.box(150, -2, 12, 176, 7, 20, 1.2), mBlu, 'otturatore');
    A.add(K.slab([[150, -4, 2], [180, -4, 2], [184, 4, 3], [178, 14, 4], [166, 15, 4], [168, 6, 2], [150, 6, 2]], 19, 27, { b: 1.6 }), mBlu, 'otturatore');
    A.add(K.box(110, RT - 1, -8, 126, RT + 4, 8, .8), mSt);                                              // guida del caricatore a lastrine
    // mira posteriore a diottra con orecchie, manopole di alzo (sinistra) e deriva (destra)
    A.add(K.slab([[4, RT + 1, 2], [40, RT + 1, 2], [40, RT + 7, 2], [4, RT + 7, 2]], -11, 11, { b: 1 }), mSt);
    for (const sd of [-1, 1]) A.add(K.slab([[8, RT + 6], [36, RT + 6], [36, RT + 14, 3], [30, RT + 19, 3], [14, RT + 19, 3], [8, RT + 14, 3]], sd > 0 ? 6 : -9.6, sd > 0 ? 9.6 : -6, { b: .7 }), mSt);
    A.add(K.slabX([[-5.4, RT + 6], [5.4, RT + 6], [5.4, RT + 17, 2], [-5.4, RT + 17, 2]], 18, 21, { b: .4, holes: [K.circ(0, RT + 13, 1.3, 12)] }), mSt);
    A.add(faRodZ(-17, -10, 7, 22, RT + 6, 22), K.mat('nero', null, { tile: 'knurl', rep: [6, 1], ns: .8 }));
    A.add(faRodZ(10, 15.5, 5, 22, RT + 6, 18), K.mat('nero', null, { tile: 'knurl', rep: [5, 1], ns: .8 }));
    A.anchor('mira_post', [19.5, RT + 13, 0]);
    // ---------------- canna, copricanna, fascetta, cilindro del gas, dispositivo di bocca con mirino
    const xMz = isB ? 686 : 754, gx = isB ? 520 : 556;
    A.add(K.latheX([[196, 0], [196, 12], [RL + 6, 12], [RL + 8, 10.4], [gx, 9.4], [xMz - 10, 8.4], [xMz - 10, 7.6], [xMz, 7.6], [xMz, 0]], { seg: 26 }), mBlu);
    A.add(K.loftX(faSt([{ x: RL - 2, t: 12, b: -1, w: 13.6 }, { x: RL + 6, t: 17, b: -1, w: 15 }, { x: gx - 100, t: 16.4, b: -1, w: 14.6 }, { x: gx - 88, t: 14, b: -1, w: 13 }], { nt: 2.3, nb: 10 }), { K: 30, step: 6 }), isB ? mWood : K.mat('legno_noce', null, { c: '#a48068' }));
    if (!isB) for (let i = 0; i < 3; i++) for (const sd of [-1, 1]) A.add(K.xf(faDiscZ(0, 0, 0, 1, sd, 12), { s: [1, 1, 1] }).scale(6, 2.2, 1).translate(RL + 60 + i * 70, 12, sd * 14.4), mDk);
    // fascetta anteriore con maglia, cilindro del gas, blocco del cilindro
    A.add(K.loftX(faSt([{ x: gx - 22, t: 12, b: -27, w: 14 }, { x: gx - 21, t: 13, b: -28, w: 14.8 }, { x: gx - 4, t: 13, b: -28, w: 14.8 }, { x: gx - 3, t: 12, b: -27, w: 14 }], { nt: 3, nb: 2.6 }), { K: 28, step: 0 }), mSt);
    WC.put(A, WC.swivel(gx - 12, -34, 0, { r: 6.5, t: 1.5, rot: PI / 2, mat: mSt }));
    A.add(K.latheX([[gx - 4, 0], [gx - 4, 9.6], [gx - 3, 10.4], [gx + 80, 10.4], [gx + 81, 9.6], [gx + 81, 0]], { cy: -15.5, seg: 22 }), mSt);
    A.add(K.slab([[gx + 4, -6], [gx + 40, -6], [gx + 40, 8, 3], [gx + 4, 8, 3]], -9, 9, { b: 1 }), mSt);
    A.add(K.slab([[gx + 50, -27, 2], [gx + 84, -27, 2], [gx + 84, 2, 3], [gx + 50, 2, 3]], -9.4, 9.4, { b: 1.2 }), mSt);
    A.add(K.slab([[gx + 74, -30, 1.5], [gx + 92, -30, 1.5], [gx + 92, -22, 1.5], [gx + 74, -22, 1.5]], -4.4, 4.4, { b: .6 }), mSt);   // dente della baionetta
    let xEnd, yP = RT + 13;
    if (!isB) {
      // spegnifiamma a denti con il mirino a orecchie sopra
      faSpegni(A, xMz - 14, 64, 11.4, mSt, mDk, { n: 5, lb: 18, sl: 3.6, chiuso: true, lf: 5, chiusoSotto: true, a0: -PI / 2 });
      A.add(K.slab([[xMz - 2, 8], [xMz + 22, 8], [xMz + 22, 14, 2], [xMz - 2, 14, 2]], -6, 6, { b: .8 }), mSt);
      for (const sd of [-1, 1]) A.add(K.slab([[xMz, 12], [xMz + 20, 12], [xMz + 20, yP + 1, 3], [xMz + 15, yP + 5, 3], [xMz + 5, yP + 5, 3], [xMz, yP + 1, 3]], sd > 0 ? 4.6 : -7.4, sd > 0 ? 7.4 : -4.6, { b: .6 }), mSt);
      A.add(K.slab([[xMz + 6, 12], [xMz + 14, 12], [xMz + 12.4, yP, .5], [xMz + 7.6, yP, .5]], -1.1, 1.1, { b: .3 }), mSt);
      A.anchor('mira_ant', [xMz + 10, yP, 0]); xEnd = xMz + 50;
    } else {
      // tricompensatore: manicotto lanciagranate ad anelli, camera con finestre, spegnifiamma a feritoie
      const t0 = xMz - 12;
      A.add(K.latheX([[t0, 0], [t0, 13], [t0 + 1, 14], [t0 + 40, 14]], { seg: 28 }), mSt);
      for (let i = 0; i < 4; i++) A.add(K.latheX([[t0 + 4 + i * 9, 14], [t0 + 5 + i * 9, 15.2], [t0 + 9 + i * 9, 15.2], [t0 + 10 + i * 9, 14]], { seg: 28 }), mSt);
      faFrenoFinestre(A, t0 + 40, 13, mSt, mDk, { L: 34, la: 6, lf: 6, aw: .32, rb: 9 });
      faSpegni(A, t0 + 74, 34, 12, mSt, mDk, { n: 6, lb: 6, sl: 3.4 });
      xEnd = t0 + 108;
      // mirino sul blocco del cilindro e alzo per le granate ripiegato sul cilindro del gas
      for (const sd of [-1, 1]) A.add(K.slab([[gx + 52, 0], [gx + 82, 0], [gx + 82, yP + 1, 3], [gx + 76, yP + 6, 3], [gx + 58, yP + 6, 3], [gx + 52, yP + 1, 3]], sd > 0 ? 5 : -8.4, sd > 0 ? 8.4 : -5, { b: .7 }), mSt);
      A.add(K.slab([[gx + 62, 0], [gx + 72, 0], [gx + 70.4, yP, .5], [gx + 63.6, yP, .5]], -1.1, 1.1, { b: .3 }), mSt);
      A.anchor('mira_ant', [gx + 67, yP, 0]);
      A.add(K.slab([[gx + 8, 8, 1], [gx + 46, 8, 1], [gx + 46, 12, 1], [gx + 8, 12, 1]], -5, 5, { b: .5 }), mSt);
      A.add(faRodZ(-7, 7, 2.6, gx + 10, 10, 12), mSt);
      faBipiede(A, gx + 34, 12, { len: 250, dir: -1, mat: mSt, zl: 17 });
    }
    // ---------------- calciatura intera in legno: calcio con collo a mezza pistola, ventre sotto la scatola, astina
    const xB = isB ? -306 : -322;
    const st = faSt([{ x: xB, t: -20, b: -148, w: 21 }, { x: xB + 12, t: -19, b: -146, w: 21.2 }, { x: -200, t: -12, b: -112, w: 20 }, { x: -110, t: -5, b: -80, w: 18.2 },
      { x: -56, t: -1, b: -62, w: 16.4 }, { x: -24, t: 2, b: -66, w: 16.8 }, { x: 6, t: 4, b: -46, w: 17.2 }, { x: 190, t: 4, b: -41, w: 17.4 }, { x: 236, t: 0, b: -31, w: 16 },
      { x: 300, t: -1, b: -26, w: 15.2 }, { x: gx - 26, t: -1, b: -21, w: 13.2 }, { x: gx - 21, t: -2, b: -20, w: 12.6 }], { nt: 2.4, nb: 2.4 });
    A.add(K.loftX(st, { K: 34, step: 7 }), mWood);
    // calciolo in acciaio con spalliera ribaltabile ripiegata (versione standard)
    A.add(K.loftX(faSt([{ x: xB - 6, t: -21, b: -147, w: 20.4 }, { x: xB - 5, t: -19.4, b: -148.6, w: 21.4 }, { x: xB + .5, t: -19.4, b: -148.6, w: 21.4 }], { nt: 2.4, nb: 2.4 }), { K: 32, step: 0 }), mSt);
    if (!isB) A.add(K.slab([[xB - 9, -60, 2], [xB - 5, -60, 1], [xB - 5, -20, 1], [xB - 9, -20, 2]], -9, 9, { b: .8 }), mSt);
    WC.put(A, WC.swivel(xB + 46, -134, 0, { r: 7, t: 1.5, rot: PI / 2, mat: mSt }));
    // ponticello in acciaio con sicura, grilletto
    A.add(K.slab([[-34, -40], [44, -40], [44, -46, 2], [38, -64, 6], [-24, -64, 6], [-34, -50, 4]], -6, 6, { b: 1, holes: [[[-26, -44, 2], [38, -44, 2], [33, -59, 4], [-20, -59, 4]]] }), mSt);
    A.add(K.slab([[38, -44, 1], [44, -44, 1], [44, -54, 1], [40, -54, 1]], -3, 3, { b: .5 }), mSt);
    A.add(K.slab([[2, -36, 1], [8, -36, 1], [7, -46, 4], [3, -55, 1.2], [-.4, -54, 1], [3, -46, 4]], -3.2, 3.2, { b: .7 }), mSt, 'grilletto');
    A.pivot('grilletto', [5, -34, 0]);
    // caricatore dritto da 20
    const cvo = { top: [112, -4], ang: .03, R: 0, L: 132, d0: 76, d1: 78 }, cvm = faCurva(cvo);
    faCaricatore(A, cvm, { w: 12.4, mat: K.mat('parker', null, { c: '#2c2e2c', r: .55 }), costole: [-.28, .28], s0: 44, s1: cvo.L - 10, wr: 5, hr: 1, dorso: true, lipF: 3, lipR: 3, th: 5.4 });
    A.add(K.slab([[150, -40, 1], [158, -40, 1], [158, -50, 2], [150, -50, 2]], -5, 5, { b: .6 }), mSt);
    // ---------------- punti di riferimento
    A.anchor('bocca', [xEnd + .5, 0, 0]); A.anchor('espulsione', [110, 14, 8], [0, .6, .8]);
    A.anchor('impugnatura', [-30, -54, 0]); A.anchor('grilletto', [3, -50, 0]);
    A.anchor('appoggio', [400, -24, -16]); A.anchor('calcio', [xB - 6, -84, 0]);
    const r = A.done();
    r.info = { azione: 'semi', bossolo: 'fucile_lungo', ciclo: { otturatore: { dx: -.1 }, grilletto: { rz: -.14 } }, ricarica: { caricatore: { dx: .004, dy: -.08, rz: .06 } } };
    if (isB || spec.cadenza) r.info.azione = 'auto';
    return r;
  };
  MAP2[92] = { f: 'fa_legno_lungo', o: { v: 'standard' } };
  MAP2[95] = { f: 'fa_legno_lungo', o: { v: 'tricomp' } };

  // ======================================================================================================
  // FAMIGLIA 8: fucile semiautomatico a sottrazione di gas diretta con calcio e astina separati, scatola fresata alta con coperchio,
  // slitta a coda di rondine sul fianco sinistro per il cannocchiale, canna scoperta davanti alla fascetta, lanciagranate in bocca,
  // alzo per granate ripiegato sul fianco sinistro della fascetta, caricatore corto da 10
  FAM2.fa_due_pezzi = function (spec, o) {
    o = o || {}; spec = spec || {};
    const A = K.asm('fa_due_pezzi'), RL = 200, RT = 18, RB = -14, RW = 13.4;
    const prod = faUp(spec.produttore, 'Saint-Martin Armes'), nome = faUp(spec.nome, ''), ser = faSer(spec, 'SM');
    const mSt = K.mat('brunito', null, { r: .42 }), mBlu = K.mat('brunito', null, { r: .34 }), mDk = faScuro();
    const mWood = K.mat('legno_noce', null, { c: '#9c7c66' });
    // ---------------- scatola fresata con finestra, scritte, slitta laterale sinistra
    const rb = [-4, RB - 4, RL + 4, RT + 4];
    const pR = K.painter(rb, { w: 1024, h: 256, rough: .42 });
    pR.text('R', prod, 70, 6, 2.6, { spacing: 2 }); pR.text('R', nome + '  7,5', 70, 0, 2.4, { spacing: 2 }); pR.text('L', ser, 120, -6, 2.4);
    for (const [x, y] of [[20, -6], [182, -6]]) pR.pin('LR', x, y, 2.2, { h: .4, a: 1.1 });
    pR.noise({ a: .12, r: .18, seed: 43 }); pR.walls({ r: .42 });
    const mR = K.mat('brunito', pR.done(2.4), { ns: .85 });
    const pr = [[0, RB, 2], [RL, RB, 2], [RL, 8, 3], [RL - 12, RT, 3], [6, RT, 3], [0, RT - 6, 3]];
    const port = [[112, -2, 2], [172, -2, 2], [172, 12, 2], [112, 12, 2]];
    A.add(K.slab(pr, -RW, 0, { bL: 1.8, bR: 0, uv: rb }), mR);
    A.add(K.slab(pr, 0, RW - 2.6, { b: 0, uv: rb, holes: [port] }), mR);
    A.add(K.slab(pr, RW - 2.6, RW, { bL: 0, bR: 1.8, uv: rb, holes: [port] }), mR);
    A.add(K.box(110, -4, -RW + 2, 174, 14, 1, .5), mDk);
    A.add(K.slab([[30, RT - 1, 2], [176, RT - 1, 2], [176, RT + 3, 2], [30, RT + 3, 2]], -RW + .6, RW - .6, { b: 1 }), mSt);       // coperchio
    A.add(K.slabX([[-RW - 4, -2], [-RW + .2, -2], [-RW + .2, 10], [-RW - 4, 10], [-RW - 5.2, 8.6], [-RW - 5.2, -.6]], 40, 172, { b: .6 }), mSt);   // slitta del cannocchiale
    // portaotturatore con manetta a destra (parte mobile)
    A.add(K.box(60, -1, -7, 176, 12, 10.6, .8), mBlu, 'otturatore');
    A.add(K.box(150, 2, 8, 160, 8, RW + 6, .8), mBlu, 'otturatore');
    A.add(K.latheX([[0, 0], [0, 5], [1.2, 5.8], [8, 6], [9.4, 4.8], [10, 0]], { seg: 16 }).rotateY(-PI / 2).translate(155, 5, RW + 5), mBlu, 'otturatore');
    // alzo a diottra con orecchie in coda alla scatola
    A.add(K.slab([[4, RT - 1, 2], [32, RT - 1, 2], [32, RT + 5, 2], [4, RT + 5, 2]], -10, 10, { b: 1 }), mSt);
    for (const sd of [-1, 1]) A.add(K.slab([[6, RT + 4], [30, RT + 4], [30, RT + 12, 3], [24, RT + 17, 3], [12, RT + 17, 3], [6, RT + 12, 3]], sd > 0 ? 5.4 : -8.8, sd > 0 ? 8.8 : -5.4, { b: .7 }), mSt);
    A.add(K.slabX([[-5, RT + 4], [5, RT + 4], [5, RT + 15, 2], [-5, RT + 15, 2]], 15, 18, { b: .4, holes: [K.circ(0, RT + 11, 1.3, 12)] }), mSt);
    A.anchor('mira_post', [16.5, RT + 11, 0]);
    // ---------------- canna, tubo del gas, copricanna e astina in legno, fascetta, mirino, lanciagranate
    const xMz = 690, fb = 452;
    A.add(K.latheX([[168, 0], [168, 12], [RL + 6, 12], [RL + 8, 10], [fb, 9.4], [xMz - 10, 8.4], [xMz - 10, 7.6], [xMz, 7.6], [xMz, 0]], { seg: 26 }), mBlu);
    A.add(K.rod(RL, 612, 3.6, { cy: 12.6, seg: 12 }), mSt);
    A.add(K.loftX(faSt([{ x: RL - 2, t: 16, b: 6, w: 12 }, { x: RL + 8, t: 20, b: 5, w: 13.6 }, { x: fb - 4, t: 19.4, b: 5, w: 13.2 }], { nt: 2.3, nb: 8 }), { K: 28, step: 6 }), mWood);
    A.add(K.loftX(faSt([{ x: 136, t: 3, b: -30, w: 15.4 }, { x: RL + 10, t: 4, b: -28, w: 16 }, { x: 380, t: 4, b: -25, w: 15.4 }, { x: fb, t: 4, b: -21, w: 14 }], { nt: 8, nb: 2.4 }), { K: 32, step: 6 }), mWood);
    A.add(K.loftX(faSt([{ x: fb - 10, t: 20, b: -22, w: 14.6 }, { x: fb - 9, t: 21.2, b: -23.2, w: 15.6 }, { x: fb + 8, t: 21.2, b: -23.2, w: 15.6 }, { x: fb + 9, t: 20, b: -22, w: 14.6 }], { nt: 3, nb: 2.6 }), { K: 28, step: 0 }), mSt);
    WC.put(A, WC.swivel(fb, -29, 0, { r: 6.5, t: 1.5, rot: PI / 2, mat: mSt }));
    // alzo per granate ripiegato sul fianco sinistro della fascetta
    A.add(K.slab([[fb - 6, -14, 2], [fb + 36, -10, 2], [fb + 38, -4, 2], [fb - 6, -4, 2]], -16.6, -15.4, { b: .4 }), mSt);
    A.add(faRodZ(-18, -15, 3.2, fb, -9, 12), mSt);
    // blocco del gas e mirino a cappuccio
    const fx = 606;
    A.add(K.latheX([[fx, 8], [fx, 11], [fx + 1, 11.8], [fx + 30, 11.8], [fx + 31, 11], [fx + 31, 8]], { seg: 24 }), mSt);
    A.add(K.slab([[fx + 2, 6], [fx + 30, 6], [fx + 28, 22, 4], [fx + 4, 22, 4]], -7, 7, { b: 1.2 }), mSt);
    A.add(K.latheX([[fx + 6, 7.6], [fx + 6, 9.4], [fx + 7, 10], [fx + 25, 10], [fx + 26, 9.4], [fx + 26, 7.6], [fx + 24.6, 7.6], [fx + 7.4, 7.6]], { seg: 28, cy: RT + 11 - 1 }), mSt);
    A.add(faRodY(20, RT + 11, 1.2, fx + 16, 0, 12), mSt);
    A.anchor('mira_ant', [fx + 16, RT + 11, 0]);
    A.add(K.slab([[fx + 4, -10], [fx + 30, -10], [fx + 30, -17, 1.5], [fx + 26, -20, 1.5], [fx + 8, -20, 1.5], [fx + 4, -16, 1.5]], -4.2, 4.2, { b: .6 }), mSt);
    // lanciagranate: manicotto con anelli e spegnifiamma
    const t0 = xMz - 12;
    A.add(K.latheX([[t0, 0], [t0, 10.6], [t0 + 1, 11.2], [t0 + 44, 11.2]], { seg: 28 }), mSt);
    for (let i = 0; i < 3; i++) A.add(K.latheX([[t0 + 10 + i * 10, 11.2], [t0 + 11 + i * 10, 12.4], [t0 + 15 + i * 10, 12.4], [t0 + 16 + i * 10, 11.2]], { seg: 28 }), mSt);
    faSpegni(A, t0 + 43, 22, 11.2, mSt, mDk, { n: 6, lb: 3, sl: 3 });
    const xEnd = t0 + 65;
    // ---------------- calcio con collo dritto, calciolo, ponticello, grilletto, caricatore corto
    const st = faSt([{ x: -276, t: -20, b: -142, w: 20 }, { x: -264, t: -19, b: -140, w: 20.2 }, { x: -170, t: -11, b: -104, w: 19 }, { x: -90, t: -5, b: -72, w: 17.4 }, { x: -40, t: -1, b: -58, w: 16 }, { x: -12, t: 4, b: -42, w: 15.6 }, { x: 2, t: 8, b: -36, w: 15 }], { nt: 2.5, nb: 2.4 });
    A.add(K.loftX(st, { K: 32, step: 6 }), mWood);
    A.add(K.loftX(faSt([{ x: -282, t: -21, b: -141, w: 19.4 }, { x: -281, t: -19.4, b: -142.6, w: 20.6 }, { x: -275.5, t: -19.4, b: -142.6, w: 20.6 }], { nt: 2.5, nb: 2.4 }), { K: 32, step: 0 }), mSt);
    WC.put(A, WC.swivel(-230, -130, 0, { r: 7, t: 1.5, rot: PI / 2, mat: mSt }));
    A.add(K.slab([[2, RB, 2], [136, RB, 2], [136, -32, 2], [2, -30, 2]], -RW + .4, RW - .4, { b: 1.2 }), mSt);          // gruppo di scatto
    A.add(K.slab([[18, -30], [84, -30], [84, -36, 2], [78, -54, 6], [26, -54, 6], [18, -40, 4]], -6, 6, { b: 1, holes: [[[24, -33, 2], [78, -33, 2], [74, -49, 4], [30, -49, 4]]] }), mSt);
    A.add(K.slab([[46, -28, 1], [52, -28, 1], [51, -36, 4], [47, -45, 1.2], [43.6, -44, 1], [47, -36, 4]], -3.2, 3.2, { b: .7 }), mSt, 'grilletto');
    A.pivot('grilletto', [49, -26, 0]);
    const cvo = { top: [120, -8], ang: .02, R: 0, L: 92, d0: 74, d1: 75 }, cvm = faCurva(cvo);
    faCaricatore(A, cvm, { w: 12.2, mat: K.mat('brunito', null, { c: '#262a2e', r: .45 }), costole: [0], s0: 34, s1: cvo.L - 10, wr: 8, hr: .9, dorso: false, lipF: 2, lipR: 2, th: 5 });
    A.add(K.slab([[84, -30, 1], [92, -30, 1], [91, -42, 2], [86, -42, 2]], -5, 5, { b: .6 }), mSt);
    // ---------------- punti di riferimento
    A.anchor('bocca', [xEnd + .5, 0, 0]); A.anchor('espulsione', [142, 6, RW + 1], [0, .4, 1]);
    A.anchor('impugnatura', [-24, -48, 0]); A.anchor('grilletto', [47, -42, 0]);
    A.anchor('appoggio', [330, -24, -16]); A.anchor('calcio', [-282, -80, 0]);
    const r = A.done();
    r.info = { azione: 'semi', bossolo: 'fucile_lungo', ciclo: { otturatore: { dx: -.09 }, grilletto: { rz: -.14 } }, ricarica: { caricatore: { dx: .004, dy: -.07, rz: .05 } } };
    return r;
  };
  MAP2[97] = { f: 'fa_due_pezzi', o: {} };

  // ======================================================================================================
  // FAMIGLIA 9: fucile semiautomatico di precisione a pistone corto su scatola fresata lunga, calcio a scheletro in legno laminato
  // con poggiaguancia, guardamano forato, canna lunga scoperta, spegnifiamma a cinque feritoie, cannocchiale su attacco laterale sinistro
  FAM2.fa_scheletro = function (spec, o) {
    o = o || {}; spec = spec || {};
    const A = K.asm('fa_scheletro'), RL = 286, RB = -30, RT = 8, RW = 14.2;
    const prod = faUp(spec.produttore, 'Ural Precision'), nome = faUp(spec.nome, ''), ser = faSer(spec, 'UP');
    const mSt = K.mat('nero'), mBlu = K.mat('brunito', null, { r: .36 }), mDk = faScuro();
    const mWood = K.mat('legno_laminato', null, { c: '#94705f' });
    // ---------------- scatola con finestra e feritoia a destra, slitta del cannocchiale a sinistra
    const rb = [-2, RB - 4, RL + 2, RT + 4];
    const pR = K.painter(rb, { w: 1024, h: 512, rough: .46 });
    pR.text('L', prod, 150, -24, 2.8, { spacing: 2 }); pR.text('L', ser, 150, -18, 2.4); pR.text('R', nome, 60, -22, 2.6, { spacing: 2 });
    for (const [x, y] of [[104, -20], [126, -20], [86, -7]]) pR.pin('LR', x, y, 2.3, { h: .5, a: 1.1 });
    pR.noise({ a: .12, r: .18, seed: 47 }); pR.walls({ r: .48 });
    const mR = K.mat('nero', pR.done(2.4), { ns: .85 });
    const prL = [[0, RB + 6, 2], [6, RB, 2], [RL, RB, 2], [RL, RT], [0, RT]];
    const prR = [[0, RB + 6, 2], [6, RB, 2], [RL, RB, 2], [RL, RT], [262, RT, .6], [262, -.5, 1.2], [240, -.5, 1], [238, -7, 1.5], [176, -7, 1.5], [174, -.5, 1], [110, -.5, 1.2], [110, RT, .6], [0, RT]];
    A.add(K.slab(prL, -RW, 0, { bL: 1.3, bR: 0, uv: rb }), mR);
    A.add(K.slab(prR, 0, RW, { bL: 0, bR: 1.3, uv: rb }), mR);
    A.add(K.slab([[44, -26, 2], [236, -26, 2], [236, 4, 2], [44, 4, 2]], -RW - 3, -RW + .4, { b: .8 }), mSt);                     // piastra della slitta
    A.add(K.slabX([[-RW - 7, -12], [-RW - 2.6, -12], [-RW - 2.6, -2], [-RW - 7, -2], [-RW - 8, -3.4], [-RW - 8, -10.6]], 70, 210, { b: .5 }), mSt);
    A.add(K.loftX(faSt([{ x: 2, t: RT + 9, b: RT - 2, w: RW - 1, lin: 1 }, { x: 8, t: RT + 13.6, b: RT - 2, w: RW + .5 }, { x: 266, t: RT + 13.6, b: RT - 2, w: RW + .5 }], { nt: 2.3, nb: 10 }), { K: 32, step: 0 }), mSt);
    // otturatore con manetta (parte mobile), leva di sicura a destra
    A.add(K.box(112, -3, -9, 240, 7.4, 12.2, .8), mBlu, 'otturatore');
    A.add(K.rod(176, 250, 8.4, { cy: -.5, seg: 18 }), mBlu, 'otturatore');
    A.add(K.box(244, -1, 0, 258, 5.6, 12.4, .6), mBlu, 'otturatore');
    A.add(K.box(246, .3, 10, 256, 5.3, 23, .9), mBlu, 'otturatore');
    A.add(K.latheX([[0, 0], [0, 5.2], [1.4, 6.2], [10, 6.4], [12, 5.2], [12.6, 0]], { seg: 18 }).rotateY(-PI / 2).translate(251, 2.8, 21.5), mBlu, 'otturatore');
    A.add(K.xf(K.slab([[-7, 0, 6], [-4, 6.4, 2], [20, 7, 0], [140, 7, 1.5], [145, 4.5, 2], [146.5, -3, 2], [142, -9.5, 2.5], [136, -9.5, 2], [133, -3, 3], [24, -3.2, 4], [0, -7.2, 5], [-6, -4.5, 4]], RW, RW + 1.7, { bL: 0, bR: .6 }), { r: [0, 0, -.06], t: [70, 1, 0] }), mSt);
    A.add(faRodZ(RW - .5, RW + 3, 4.2, 70, 1, 16), mSt);
    // blocco dell'alzo davanti alla scatola
    A.add(K.slab([[RL - 4, -10, 2], [RL + 2, -14, 4], [RL + 50, -14, 4], [RL + 56, -8, 2], [RL + 56, 26, 2.5], [RL + 46, 27, 2], [RL + 40, 24, 2], [RL + 6, 23.5, 3], [RL - 4, 23, 1]], -12, 12, { b: 1.6 }), mSt);
    A.add(K.slab([[RL + 6, 24.4, .6], [RL + 42, 23.8, .6], [RL + 43, 26.4, 1], [RL + 8, 27.6, .8]], -5, 5, { b: .45 }), mSt);
    A.add(K.slabX([[-5.4, 26], [5.4, 26], [5.4, 31.4, .6], [1.3, 31.4, .3], [1.3, 29.2, .9], [-1.3, 29.2, .9], [-1.3, 31.4, .3], [-5.4, 31.4, .6]], RL + 5, RL + 9, { b: .4 }), mSt);
    // ---------------- canna lunga, guardamano forato in legno, blocco del gas, mirino, spegnifiamma
    const xMz = 862, gx = 572;
    A.add(K.latheX([[240, 0], [240, 12], [RL + 58, 12], [RL + 60, 10.2], [gx, 10], [gx + 2, 8.4], [xMz - 10, 7.8], [xMz - 10, 7], [xMz, 7], [xMz, 0]], { seg: 26 }), mBlu);
    A.add(K.rod(RL + 54, gx + 4, 7.6, { cy: 19, seg: 18 }), mSt);
    const tl = faTelaLegno('laminato', 1024, 256);
    for (let i = 0; i < 6; i++) for (const vv of [.13, .58]) tl.ell(.17 + i * .125, vv, .03, .05, { h: -1, a: .08, r: .9 });
    for (let i = 0; i < 6; i++) tl.ell(.17 + i * .125, 1.0, .03, .03, { h: -1, a: .08, r: .9 });
    A.add(K.loftX(faSt([{ x: RL + 56, t: 27, b: -18, w: 15 }, { x: RL + 64, t: 30, b: -24, w: 18.6 }, { x: gx - 22, t: 29, b: -23, w: 18 }, { x: gx - 8, t: 26, b: -19, w: 15.4 }], { nt: 2.6, nb: 2.4 }), { K: 32, step: 6 }), faMatLegno(tl.done(2.6), '#ae8a7c'));
    A.add(K.loftX(faSt([{ x: gx - 10, t: 27, b: -20, w: 16 }, { x: gx - 9, t: 28.2, b: -21.2, w: 17 }, { x: gx + 1, t: 28.2, b: -21.2, w: 17 }, { x: gx + 2, t: 27, b: -20, w: 16 }], { nt: 2.6, nb: 2.4 }), { K: 28, step: 0 }), mSt);
    A.add(K.latheX([[gx + 2, 7], [gx + 2, 11], [gx + 3, 12], [gx + 34, 12], [gx + 35, 11], [gx + 35, 7]], { seg: 24 }), mSt);
    A.add(K.latheX([[gx, 0], [gx, 8.6], [gx + 1, 9.4], [gx + 30, 9.4], [gx + 31, 8.6], [gx + 31, 0]], { cy: 19, seg: 20 }), mSt);
    A.add(K.slab([[gx + 4, 2], [gx + 32, 2], [gx + 32, 19], [gx + 4, 19]], -6.5, 6.5, { b: .8 }), mSt);
    A.add(faRodZ(-11, 11, 3.2, gx + 24, 19, 12), mSt);                                                                   // regolatore
    const fx = xMz - 46, yP = 30;
    A.add(K.latheX([[fx, 6], [fx, 9.4], [fx + 1, 10.2], [fx + 31, 10.2], [fx + 32, 9.4], [fx + 32, 6]], { seg: 24 }), mSt);
    A.add(K.slab([[fx + 2, 6], [fx + 30, 6], [fx + 29, 16, 3], [fx + 23, yP - 7, 3], [fx + 9, yP - 7, 3], [fx + 3, 16, 3]], -5.6, 5.6, { b: 1 }), mSt);
    for (const sd of [-1, 1]) A.add(K.slab([[fx + 4, 8], [fx + 28, 8], [fx + 28, yP - 2, 4], [fx + 22, yP + 6, 4], [fx + 11, yP + 6, 4], [fx + 4, yP - 2, 4]], sd > 0 ? 5.6 : -8.8, sd > 0 ? 8.8 : -5.6, { b: .8 }), mSt);
    A.add(faRodY(yP - 8, yP, 1.1, fx + 16, 0, 12), mSt);
    A.add(K.slab([[fx + 4, -8], [fx + 31, -8], [fx + 31, -13, 1], [fx + 27, -16.5, 1], [fx + 8, -16.5, 1], [fx + 4, -13, 1]], -4.2, 4.2, { b: .6 }), mSt);
    faSpegni(A, xMz - 8, 74, 10.2, mSt, mDk, { n: 5, lb: 14, sl: 3.6, a0: PI / 2 + PI / 5 });
    const xEnd = xMz + 66;
    // ---------------- cannocchiale sull'attacco laterale sinistro (asse spostato a sinistra)
    const yS = 64, zS = -6, mA = K.mat('anod', null, { r: .55 });
    A.add(K.slab([[86, -14, 3], [196, -14, 3], [200, 14, 4], [182, yS - 14, 6], [104, yS - 14, 6], [82, 14, 4]], -RW - 9.6, -RW - 4, { b: 1.4 }), mA);
    A.add(faRodZ(-RW - 14, -RW - 9, 6, 120, -6, 16), mA); A.add(K.slab([[110, -14, 2], [130, -14, 2], [134, -2, 2], [106, -2, 2]], -RW - 13, -RW - 9.4, { b: .8 }), mA);
    const scope = K.latheX([[24, 15], [24, 17.6], [30, 18.4], [56, 18.6], [60, 15], [86, 13.2], [96, 13], [212, 13], [222, 14], [262, 18.4], [318, 18.6], [320, 17], [320, 15]], { seg: 32, cy: yS, cz: zS });
    A.add(scope, mA);
    A.add(K.latheX([[2, 18.4], [2, 21.4], [4, 22.2], [26, 21], [28, 18.6], [28, 15]], { seg: 28, cy: yS, cz: zS }), K.mat('gomma'));
    A.add(K.latheX([[318, 18.2], [318, 19.6], [330, 19.6], [372, 19.2], [372, 17.6], [366, 17.2], [330, 17.2]], { seg: 30, cy: yS, cz: zS }), mA);
    A.add(K.discX(25, yS, zS, 15.2, -1, 24), K.mat('lente')); A.add(K.discX(334, yS, zS, 16.8, 1, 24), K.mat('lente'));
    for (const xx of [110, 182]) A.add(K.latheX([[xx - 7, 12.8], [xx - 7, 15.6], [xx - 6, 16.4], [xx + 6, 16.4], [xx + 7, 15.6], [xx + 7, 12.8]], { seg: 28, cy: yS, cz: zS }), mA);
    A.add(K.latheX([[0, 0], [0, 9], [1, 10], [13, 10], [14, 8.6], [14.6, 0]], { seg: 24 }).rotateZ(PI / 2).translate(146, yS + 12, zS), K.mat('anod', null, { tile: 'knurl', rep: [8, 1], ns: .8 }));
    A.add(K.latheX([[0, 0], [0, 9], [1, 10], [13, 10], [14, 8.6], [14.6, 0]], { seg: 24 }).rotateY(PI / 2).translate(146, yS, zS - 12), K.mat('anod', null, { tile: 'knurl', rep: [8, 1], ns: .8 }));
    A.add(K.latheX([[0, 0], [0, 7], [1, 7.6], [10, 7.6], [11, 6.6], [11.4, 0]], { seg: 20 }).rotateY(PI / 2).translate(176, yS - 2, zS - 11), mA);
    A.anchor('ottica', [2, yS, zS]); A.anchor('mira_post', [RL + 7, 29.2, 0]); A.anchor('mira_ant', [fx + 16, yP, 0]);
    // ---------------- calcio a scheletro con poggiaguancia e calciolo in gomma, impugnatura ricavata nel calcio
    const sb = [-318, -160, 104, 14];
    A.add(K.slab([[-300, -150, 6], [-200, -124, 30], [-40, -114, 20], [30, -120, 8], [58, -118, 5], [94, -34, 3], [94, RB + 2, 0], [0, RB + 2, 0], [0, 4, 2], [-296, -10, 4]], -14, 14,
      { b: 4, uv: sb, holes: [[[-262, -114, 10], [-200, -100, 18], [-30, -95, 12], [22, -97, 6], [50, -52, 8], [40, -47, 6], [-40, -47, 10], [-262, -55, 10]]] }), mWood);
    A.add(K.slab([[-250, -6, 6], [-120, -1, 8], [-80, 2, 4], [-80, 12, 4], [-110, 16, 8], [-246, 14, 8]], -12.6, 12.6, { b: 4 }), mWood);   // poggiaguancia
    A.add(K.slab([[-312, -154, 6], [-299, -151, 2], [-296, -8, 2], [-308, -6, 6], [-316, -40, 14]], -15.4, 15.4, { b: 2.6 }), K.mat('gomma', null, { tile: 'ribs', rep: [1, 6], ns: .6 }));
    A.add(K.box(-268, -9, -12.8, -258, 15, 12.8, 1.2), mSt); A.add(K.box(-104, -4, -12.8, -94, 16, 12.8, 1.2), mSt);           // fascette del poggiaguancia
    // ponticello, grilletto, caricatore corto da 10
    A.add(K.slab([[96, RB + 1.5], [160, RB + 1.5], [160, RB - 3, 1.5], [156, RB - 20, 6], [104, RB - 21, 7], [96, RB - 9, 4]], -5, 5, { b: .9, holes: [[[102, RB - 1.2, 1], [155, RB - 1.2, 1], [152, RB - 16.5, 4.5], [108, RB - 17.5, 5.5], [102, RB - 8, 3]]] }), mSt);
    A.add(K.slab([[124.5, RB + 2, 1], [130.5, RB + 2, 1], [129.6, RB - 6, 4], [125.2, RB - 15.5, 1.2], [121.8, RB - 14.5, 1], [125.2, RB - 6, 4]], -3.2, 3.2, { b: .7 }), mSt, 'grilletto');
    A.pivot('grilletto', [127.5, RB + 4, 0]);
    A.add(K.slab([[158.5, RB + 1], [166, RB + 1], [166.5, RB - 4, 1.5], [164.5, RB - 14, 2], [160.5, RB - 13.5, 1.5], [161.5, RB - 4, 1]], -5.5, 5.5, { b: .7 }), mSt);
    const cvo = { top: [205, -9], ang: .1, R: 520, L: 136, d0: 76, d1: 78 }, cvm = faCurva(cvo);
    faCaricatore(A, cvm, { w: 12.8, mat: K.mat('nero', null, { c: '#2a2b2c', r: .5 }), costole: [-.3, -.1, .1, .3], s0: 34, s1: cvo.L - 10, wr: 3, hr: .9, dorso: true, lipF: 2, lipR: 2.5, th: 4.6 });
    // ---------------- punti di riferimento
    A.anchor('bocca', [xEnd + .5, 0, 0]); A.anchor('espulsione', [206, 2, RW + 1], [0, .3, 1]);
    A.anchor('impugnatura', [62, -76, 0]); A.anchor('grilletto', [126, RB - 10, 0]);
    A.anchor('appoggio', [460, -26, -18]); A.anchor('calcio', [-312, -80, 0]);
    const r = A.done();
    r.info = { azione: 'semi', bossolo: 'fucile_lungo', ciclo: { otturatore: { dx: -.11 }, grilletto: { rz: -.14 } }, ricarica: { caricatore: { dx: .012, dy: -.07, rz: .3 } } };
    return r;
  };
  MAP2[104] = { f: 'fa_scheletro', o: {} };

  // ======================================================================================================
  // FAMIGLIA 10: fucile da battaglia a chiusura ritardata con calcio in linea gommato, scatola tonda nervata, camicia di raffreddamento
  // forata attorno alla canna, freno-lanciagranate lungo, mire alte ribaltabili, bipiede anteriore ripiegato sotto la camicia,
  // grilletto invernale ribaltabile sotto il ponticello, caricatore dritto da 24
  FAM2.fa_camicia = function (spec, o) {
    o = o || {}; spec = spec || {};
    const A = K.asm('fa_camicia'), RL = 300, RT = 24, RB = -22, RW = 15.6;
    const prod = faUp(spec.produttore, 'Brunner & Keller'), nome = faUp(spec.nome, ''), ser = faSer(spec, 'BK');
    const mSt = K.mat('nero'), mBlu = K.mat('brunito', null, { r: .36 }), mDk = faScuro(), mRub = K.mat('gomma', null, { tile: 'grana', rep: [8, 4], ns: .4 });
    // ---------------- scatola tonda con nervature, finestra a destra
    const rb = [-4, RB - 4, RL + 4, RT + 4];
    const pR = K.painter(rb, { w: 1024, h: 256, rough: .5 });
    pR.text('L', prod, 120, -12, 2.8, { spacing: 2 }); pR.text('L', nome + '  7,5', 120, -18, 2.4, { spacing: 2 }); pR.text('L', ser, 230, -12, 2.4);
    for (const [x, y] of [[20, -10], [276, -10]]) pR.pin('LR', x, y, 2.4, { h: .4, a: 1.1 });
    pR.noise({ a: .12, r: .18, seed: 53 }); pR.walls({ r: .5 });
    const mR = K.mat('nero', pR.done(2.4), { ns: .85 });
    const pr = [[0, RB, 2], [RL, RB, 2], [RL, 10, 2], [0, 10, 2]];
    const port = [[160, -14, 2], [232, -14, 2], [232, 6, 2], [160, 6, 2]];
    A.add(K.slab(pr, -RW, 0, { bL: 2.4, bR: 0, uv: rb }), mR);
    A.add(K.slab(pr, 0, RW - 3, { b: 0, uv: rb, holes: [port] }), mR);
    A.add(K.slab(pr, RW - 3, RW, { bL: 0, bR: 2.4, uv: rb, holes: [port] }), mR);
    A.add(K.box(158, -16, -RW + 2, 234, 8, 1, .5), mDk);
    const cs = [{ x: 0, t: RT - 4, b: 4, w: RW - .6 }, { x: 4, t: RT, b: 4, w: RW + .3 }];
    for (let i = 0; i < 9; i++) { const xr = 24 + i * 28; cs.push({ x: xr - 3, t: RT, b: 4, w: RW + .3 }, { x: xr - 1.2, t: RT + 1.4, b: 4, w: RW + .3 }, { x: xr + 1.2, t: RT + 1.4, b: 4, w: RW + .3 }, { x: xr + 3, t: RT, b: 4, w: RW + .3 }); }
    cs.push({ x: RL - 2, t: RT, b: 4, w: RW + .3 }, { x: RL + 4, t: RT - 3, b: 4, w: RW - 1 });
    A.add(K.loftX(faSt(cs, { nt: 2.2, nb: 10 }), { K: 32, step: 0 }), mSt);
    A.add(K.rod(150, 236, 9.6, { cy: -4, seg: 18 }), mBlu, 'otturatore');
    A.add(K.box(196, -2, 4, 230, 4, 11, .5), mBlu, 'otturatore');
    // manetta di armamento a destra (non segue l'otturatore)
    A.add(K.box(236, 0, 8, 250, 8, RW + 6, 1), mSt, 'manetta');
    A.add(K.latheX([[0, 0], [0, 7.4], [1.6, 8.6], [10, 8.8], [12, 7.4], [12.6, 0]], { seg: 20 }).rotateY(-PI / 2).translate(243, 4, RW + 5), mSt, 'manetta');
    A.pivot('manetta', [243, 4, RW]);
    // ---------------- camicia forata, canna, freno-lanciagranate, mire alte ribaltabili, bipiede
    const xJ1 = 640, rJ = 17.4, xMz = 676;
    A.add(K.latheX([[RL - 6, 0], [RL - 6, 12], [xMz - 8, 10], [xMz - 8, 8], [xMz, 8], [xMz, 0]], { seg: 24 }), mBlu);
    const tl = faTela(1024, 256, .5);
    for (let i = 0; i < 15; i++) for (let j = 0; j < 9; j++) { const u = .07 + i * .062, vv = .1 + (j + (i % 2) * .5) * .1; if (vv > .99) continue; tl.ell(u, vv, .012, .026, { h: -1, a: .06, r: .9 }); }
    A.add(K.latheX([[RL - 2, 15], [RL - 2, rJ - .6], [RL - 1, rJ], [xJ1 - 1, rJ], [xJ1, rJ - .6], [xJ1, 12]], { seg: 32 }), K.mat('nero', tl.done(2.8), { ns: 1 }));
    A.add(K.latheX([[RL - 8, 14], [RL - 8, rJ + 1.6], [RL - 7, rJ + 2.4], [RL + 6, rJ + 2.4], [RL + 7, rJ + 1.6], [RL + 7, 14]], { seg: 32 }), mSt);
    A.add(K.latheX([[xJ1 - 14, 10], [xJ1 - 14, rJ + 1.6], [xJ1 - 13, rJ + 2.4], [xJ1 + 4, rJ + 2.4], [xJ1 + 6, rJ], [xJ1 + 8, 12], [xJ1 + 8, 9]], { seg: 32 }), mSt);
    // freno di bocca con lanciagranate ad anelli
    const t0 = xMz - 10;
    A.add(K.latheX([[t0, 0], [t0, 11.4], [t0 + 1, 12], [t0 + 46, 12]], { seg: 28 }), mSt);
    for (let i = 0; i < 4; i++) A.add(K.latheX([[t0 + 8 + i * 9, 12], [t0 + 9 + i * 9, 13.2], [t0 + 13 + i * 9, 13.2], [t0 + 14 + i * 9, 12]], { seg: 28 }), mSt);
    faFrenoFinestre(A, t0 + 46, 12, mSt, mDk, { L: 44, la: 8, lf: 8, aw: .3, rb: 4.2 });
    const xEnd = t0 + 90;
    // mire alte ribaltabili (alzate)
    const yS = RT + 40;
    A.add(K.slab([[28, RT, 2], [66, RT, 2], [66, RT + 8, 2], [28, RT + 8, 2]], -10, 10, { b: 1 }), mSt);
    for (const sd of [-1, 1]) A.add(K.slab([[32, RT + 6], [62, RT + 6], [62, yS + 4, 3], [56, yS + 10, 3], [38, yS + 10, 3], [32, yS + 4, 3]], sd > 0 ? 5.4 : -8.6, sd > 0 ? 8.6 : -5.4, { b: .7 }), mSt);
    A.add(faRodZ(-5.4, 5.4, 7.2, 47, yS, 20), mSt);
    for (let i = 0; i < 4; i++) { const a = PI + i * PI / 2; A.add(faRodZ(-1, 1, 1.2, 47 + Math.cos(a) * 7.3, yS + Math.sin(a) * 7.3, 10), mDk); }
    A.add(faRodZ(-12, 12, 3, 47, RT + 4, 12), mSt);
    A.anchor('mira_post', [40, yS, 0]);
    const fx = xJ1 - 30;
    A.add(K.slab([[fx, rJ - 2, 2], [fx + 26, rJ - 2, 2], [fx + 26, rJ + 6, 2], [fx, rJ + 6, 2]], -9, 9, { b: 1 }), mSt);
    for (const sd of [-1, 1]) A.add(K.slab([[fx + 2, rJ + 4], [fx + 24, rJ + 4], [fx + 24, yS + 2, 3], [fx + 19, yS + 7, 3], [fx + 7, yS + 7, 3], [fx + 2, yS + 2, 3]], sd > 0 ? 4.4 : -7.4, sd > 0 ? 7.4 : -4.4, { b: .6 }), mSt);
    A.add(K.slab([[fx + 9, rJ + 4], [fx + 17, rJ + 4], [fx + 15, yS, .5], [fx + 11, yS, .5]], -1.2, 1.2, { b: .4 }), mSt);
    A.anchor('mira_ant', [fx + 13, yS, 0]);
    faBipiede(A, xJ1 - 6, rJ + 2, { len: 280, dir: -1, mat: mSt, zl: 13 });
    // ---------------- calcio in linea gommato con calciolo, impugnatura, ponticello con grilletto invernale
    const st = faSt([{ x: -346, t: 18, b: -104, w: 21 }, { x: -336, t: 19, b: -103, w: 21.4 }, { x: -240, t: 21, b: -84, w: 20 }, { x: -140, t: 22.5, b: -62, w: 18.6 }, { x: -50, t: 23.5, b: -36, w: 17.4 }, { x: -6, t: 24, b: -24, w: 16.6 }, { x: 2, t: 23.6, b: -22, w: 16 }], { nt: 3, nb: 2.6 });
    A.add(K.loftX(st, { K: 32, step: 7 }), mRub);
    A.add(K.loftX(faSt([{ x: -360, t: 14, b: -102, w: 20 }, { x: -357, t: 19.6, b: -105.6, w: 22 }, { x: -345, t: 19.6, b: -105.6, w: 22 }], { nt: 3, nb: 2.6 }), { K: 32, step: 0 }), K.mat('gomma', null, { tile: 'ribs', rep: [1, 7], ns: .6 }));
    const gs = []; for (let i = 0; i <= 8; i++) { const t = i / 8; gs.push({ p: [86 - t * 36, RB + 4 - t * 92], f: 13.8 + t * 2, r: 16 + t * 2, w: 13.6 + Math.sin(t * PI) * 1.4, nf: 2.4, nr: 2.2 }); }
    A.add(K.loftS(gs, { K: 28, sub: 3 }), K.mat('polimero', null, { tile: 'ribs', rep: [1, 6], ns: .6 }));
    A.add(K.slab([[86, RB + 1], [150, RB + 1], [150, -30, 2], [144, -50, 6], [96, -52, 7], [86, -38, 4]], -6, 6, { b: 1, holes: [[[94, RB - 3, 2], [144, RB - 3, 2], [139, -45, 4.5], [100, -46, 5], [94, -36, 3]]] }), mSt);
    A.add(K.slab([[112, RB + 1, 1], [118, RB + 1, 1], [117, -32, 4], [113, -41, 1.2], [109.4, -40, 1], [113, -32, 4]], -3.2, 3.2, { b: .7 }), mSt, 'grilletto');
    A.add(K.slab([[110, -46, 2], [118, -46, 2], [140, -60, 3], [136, -66, 3], [108, -54, 2]], -3, 3, { b: .7 }), mSt, 'grilletto');   // grilletto invernale ribaltabile
    A.pivot('grilletto', [115, RB + 3, 0]);
    // caricatore dritto da 24
    const cvo = { top: [196, -14], ang: .02, R: 0, L: 196, d0: 74, d1: 76 }, cvm = faCurva(cvo);
    faCaricatore(A, cvm, { w: 12.4, mat: K.mat('nero', null, { c: '#2a2b2c', r: .45 }), costole: [-.25, 0, .25], s0: 30, s1: cvo.L - 12, wr: 4, hr: 1, dorso: true, lipF: 2, lipR: 3, th: 5 });
    A.add(K.slab([[150, RB - 1, 1], [158, RB - 1, 1], [157, -36, 2], [151, -36, 2]], -6, 6, { b: .6 }), mSt);
    // ---------------- punti di riferimento
    A.anchor('bocca', [xEnd + .5, 0, 0]); A.anchor('espulsione', [196, -4, RW + 1], [0, .3, 1]);
    A.anchor('impugnatura', [68, -64, 0]); A.anchor('grilletto', [112, -38, 0]);
    A.anchor('appoggio', [460, -22, -20]); A.anchor('calcio', [-360, -44, 0]);
    const r = A.done();
    r.info = { azione: 'auto', bossolo: 'fucile_lungo', ciclo: { otturatore: { dx: -.09 }, grilletto: { rz: -.14 } }, ricarica: { caricatore: { dx: .004, dy: -.1, rz: .04 } } };
    return r;
  };
  MAP2[93] = { f: 'fa_camicia', o: {} };
})();
