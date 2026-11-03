// Fucili moderni (gruppo B, Versione 21 del gioco):
//  - la grande famiglia a scatola superiore e inferiore in alluminio con tubo del calcio (maniglia di trasporto o slitta
//    piatta, guardamano tondo nervato, triangolare, a quattro slitte o tubo flottante), anche in calibro pieno;
//  - il fucile a lamiera stampata con calcio pieghevole, il fucile a pistone con manetta a destra;
//  - i fucili modulari in alluminio e polimero con calcio pieghevole di lato (scatola superiore lunga con slitta continua);
//  - i fucili in polimero con maniglia-ottica e i fucili in polimero a forme tonde;
//  - i bullpup (carenatura con il caricatore dietro l'impugnatura).
// Misure in mm, convenzioni del kit v2: X avanti, Y su, Z lato destro, y = 0 asse della canna.
// Fucili a scatola e modulari: x = 0 retro della scatola superiore. Bullpup: x = 0 retro del calciolo.
window.FAM2 = window.FAM2 || {}; window.MAP2 = window.MAP2 || {};
(function () {
  const PI = Math.PI;
  let K = null, C = null;
  const init = () => { K = window.WK2; C = window.WC; };

  // ====================================================================================== aiuti comuni
  // finiture: alluminio anodizzato (al) e polimero (po) per ogni colore del catalogo
  const TINTE = {
    nera: { al: ['anod', { c: '#27292c' }], po: ['polimero', {}] },
    polimero: { al: ['anod', {}], po: ['poligrigio', {}] },
    coyote: { al: ['coyote', { c: '#6f5b42', m: .3, r: .52 }], po: ['coyote', { c: '#75604a' }] },
    oliva: { al: ['oliva', { c: '#4a4e38', m: .28, r: .52 }], po: ['oliva', { c: '#545a3e' }] },
    sabbia: { al: ['sabbia', { c: '#7d7154', m: .28, r: .52 }], po: ['sabbia', { c: '#857958' }] },
    marrone: { al: ['grigio', { c: '#3a3c3e' }], po: ['polimero', { c: '#5a3820', r: .5 }] },
  };
  const tinta = (spec, def) => { const f = (spec && spec.finitura) || def || 'nera'; return TINTE[f] ? f : 'nera'; };
  function mAl(t, det, extra) { const q = (TINTE[t] || TINTE.nera).al; return K.mat(q[0], det || null, Object.assign({}, q[1], extra || {})); }
  function mPo(t, det, extra) { const q = (TINTE[t] || TINTE.nera).po, o = Object.assign({}, q[1], extra || {}); if (!det && !o.tile) Object.assign(o, { tile: 'grana', rep: [8, 4], ns: .22 }); return K.mat(q[0], det || null, o); }
  // polimero traslucido (caricatori trasparenti): si vedono le cartucce dentro
  const TRASP = {};
  function mTrasp(c, op) {
    const key = (c || '') + (op || ''); if (TRASP[key]) return TRASP[key];
    const T = THREE; return TRASP[key] = new T.MeshStandardMaterial({ color: new T.Color(c || '#4a4a42').convertSRGBToLinear(), metalness: 0, roughness: .28, transparent: true, opacity: op || .6, side: T.DoubleSide, depthWrite: false, envMapIntensity: 1.2 });
  }
  const mBuio = () => K.mat('nero_lucido', null, { c: '#050505', r: .7 });
  // matricola inventata dal numero del catalogo
  const matricola = (spec, pre) => (pre || 'N.') + ' ' + (((spec && spec.id) || 7) * 7919 + 104729).toString().slice(-6);
  const maiusc = s => String(s || '').toUpperCase();

  // solido lungo X da sezioni qualunque con lo stesso numero di punti: st = [{x, r: [[y, z], ...]}]
  // ogni anello parte dal lato destro (+z) e gira verso l'alto (+y), come le sezioni del kit
  function fbSweep(st, o) {
    o = o || {}; const T = THREE;
    const n = st[0].r.length, pos = [], uv = [], x0 = st[0].x, L = Math.max(1e-6, st[st.length - 1].x - x0);
    const P = (s, k) => { const q = s.r[k % n]; return [s.x, q[0], q[1]]; };
    for (let i = 0; i < st.length - 1; i++) for (let k = 0; k < n; k++) {
      const a = P(st[i], k), b = P(st[i + 1], k), c = P(st[i + 1], k + 1), d = P(st[i], k + 1);
      pos.push(...a, ...b, ...c, ...a, ...c, ...d);
      const ua = (st[i].x - x0) / L, ub = (st[i + 1].x - x0) / L, va = .1 + .9 * k / n, vb = .1 + .9 * (k + 1) / n;
      uv.push(ua, va, ub, va, ub, vb, ua, va, ub, vb, ua, vb);
    }
    for (const e of [0, st.length - 1]) {
      if (o.cap === false || (e === 0 && o.cap0 === false) || (e > 0 && o.cap1 === false)) continue;
      const s = st[e]; let cy = 0, cz = 0; for (const q of s.r) { cy += q[0]; cz += q[1]; } cy /= n; cz /= n;
      for (let k = 0; k < n; k++) { const a = P(s, k), b = P(s, k + 1); if (e > 0) pos.push(s.x, cy, cz, ...b, ...a); else pos.push(s.x, cy, cz, ...a, ...b); uv.push(.02, .03, .03, .03, .03, .04); }
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    return K.crease(g, o.ang || 50, { edge: !!o.edge });
  }
  // sezione superellittica (come il kit): mezza altezza sopra/sotto, mezza larghezza, esponenti, centro
  function secSE(n, ht, hb, w, nt, nb, yc, zc) {
    const r = [];
    for (let k = 0; k < n; k++) {
      const a = 2 * PI * k / n, c = Math.cos(a), s = Math.sin(a), e = s >= 0 ? nt : nb, h = s >= 0 ? ht : hb;
      r.push([(yc || 0) + Math.sign(s) * Math.pow(Math.abs(s), 2 / e) * h, (zc || 0) + Math.sign(c) * Math.pow(Math.abs(c), 2 / e) * w]);
    }
    return r;
  }
  // ellisse con nervature lungo X: ribs = nervature sul giro, dep = profondità dei solchi (mm); o.solo(a) limita i solchi
  function secRib(n, ry, rz, ribs, dep, yc, o) {
    o = o || {}; const r = [];
    for (let k = 0; k < n; k++) {
      const a = 2 * PI * k / n, g = Math.cos(a * ribs + (o.fase || 0));
      let d = Math.max(0, Math.min(1, ((o.soglia === undefined ? .2 : o.soglia) - g) * 2.4));
      if (o.solo && !o.solo(a)) d = 0;
      const e = o.e || 2, c = Math.cos(a), s = Math.sin(a), cs = Math.sign(c) * Math.pow(Math.abs(c), 2 / e), ss = Math.sign(s) * Math.pow(Math.abs(s), 2 / e);
      r.push([(yc || 0) + ss * (ry - dep * d), (o.zc || 0) + cs * (rz - dep * d)]);
    }
    return r;
  }
  // sezione da un percorso chiuso nel piano (z, y) con raccordi, ricampionata a n punti per lunghezza d'arco
  function secPath(path, n) {
    let P = K.P2(path).map(p => [p[0], p[1]]);
    let ar = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; ar += p[0] * q[1] - q[0] * p[1]; }
    if (ar < 0) P.reverse();
    let cz = 0, cy = 0; for (const p of P) { cz += p[0]; cy += p[1]; } cz /= P.length; cy /= P.length;
    let i0 = 0, best = 1e9; P.forEach((p, i) => { const a = Math.abs(Math.atan2(p[1] - cy, p[0] - cz)); if (a < best) { best = a; i0 = i; } });
    P = P.slice(i0).concat(P.slice(0, i0));
    const acc = [0]; let L = 0; for (let i = 1; i <= P.length; i++) { const p = P[i - 1], q = P[i % P.length]; L += Math.hypot(q[0] - p[0], q[1] - p[1]); acc.push(L); }
    const out = []; let j = 0;
    for (let k = 0; k < n; k++) { const s = L * k / n; while (j < P.length - 1 && acc[j + 1] < s) j++; const p = P[j], q = P[(j + 1) % P.length], t = (s - acc[j]) / Math.max(1e-9, acc[j + 1] - acc[j]); out.push([p[1] + (q[1] - p[1]) * t, p[0] + (q[0] - p[0]) * t]); }
    return out;
  }
  // sezione costante (funzione di x) su una lista di quote x
  const sweepX = (xs, fn, o) => fbSweep(xs.map(x => ({ x, r: fn(x) })), o);
  const lin = (a, b, t) => a + (b - a) * t;
  const span = (x0, x1, n) => { const o = []; for (let i = 0; i <= n; i++) o.push(x0 + (x1 - x0) * i / n); return o; };
  // pezzo girato verso il lato destro (+z): rotateY(-PI/2) porta +X su +Z
  const versoDestra = g => g.rotateY(-PI / 2);
  // pomello/cilindro lungo Z centrato in (x, y) fra z0 e z1
  function cilZ(x, y, z0, z1, r, seg) { const g = K.rod(0, Math.abs(z1 - z0), r, { seg: seg || 18 }); versoDestra(g); if (z1 < z0) g.scale(1, 1, -1); g.translate(x, y, z0); return g; }
  // cilindro lungo Y (in piedi) centrato in (x, z) fra y0 e y1
  function cilY(x, z, y0, y1, r, seg) { const g = K.rod(0, y1 - y0, r, { seg: seg || 18 }); g.rotateZ(PI / 2); g.translate(x, y0, z); return g; }
  // anello di cinghia
  const maglia = (A, x, y, z, rot, r) => C.put(A, C.swivel(x, y, z, { rot: rot || 0, r: r || 8, t: 1.5, mat: K.mat('nero') }));

  // calcio a telaio con fianchi incavati: contorno spesso (hw) con una finestra riempita da un'anima sottile (hwi)
  function calcioIncavato(A, out, hole, hw, hwi, m, o) {
    o = o || {};
    A.add(K.slab(out, -hw, hw, { b: o.b || 3.2, bs: 4, holes: [hole] }), m);
    A.add(K.slab(hole, -hwi, hwi, { b: 1 }), o.mAnima || m);
  }

  // slitta per accessori (misure standard come quella del kit) più leggera: base a coda di rondine estrusa lungo X
  // e tutti i denti in un unico pettine (profilo laterale); dir: 'su', 'giu', 'dx', 'sx' attorno all'asse della canna
  function slitta(x0, x1, y, o) {
    o = o || {}; const m = o.mat || K.mat('anod');
    const base = K.slabX([[-8, 0, 0], [8, 0, 0], [8, 1.6, .3], [10.6, 3.6, .4], [10.6, 5, .4], [7.8, 6.6, .3], [-7.8, 6.6, .3], [-10.6, 5, .4], [-10.6, 3.6, .4], [-8, 1.6, .3]], x0, x1, { b: .5 });
    const n = Math.floor((x1 - x0 - 2) / 10), off = x0 + (x1 - x0 - n * 10) / 2, comb = [[x0 + .6, 5.4], [x1 - .6, 5.4]];
    for (let i = n - 1; i >= 0; i--) { const a = off + i * 10 + 2.6, b = a + 4.8; comb.push([b + 5.2 > x1 - .6 ? x1 - .6 : b + 5.2, 6.5], [b, 6.5], [b, 9.4, .4], [a, 9.4, .4], [a, 6.5]); }
    comb.push([x0 + .6, 6.5]);
    const g = K.mergeG([base, K.slab(comb, -7.8, 7.8, { b: .45, bs: 1 })]);
    const rot = { su: 0, giu: PI, dx: PI / 2, sx: -PI / 2 }[o.dir || 'su'];
    g.translate(0, y, 0); if (rot) g.applyMatrix4(new THREE.Matrix4().makeRotationX(rot));
    return [[g, m]];
  }

  // ---------------------------------------------------------------------------------- caricatori a scatola
  // linea del caricatore: dritta per la frazione 'dritto', poi curva in avanti con raggio 'raggio'
  function lineaCaricatore(top, o) {
    const n = o.n || 12, out = []; let p = top.slice(), dir = -PI / 2 + (o.ang || 0); const L = o.len, s0 = (o.dritto === undefined ? .4 : o.dritto) * L, ds = L / n;
    for (let i = 0; i <= n; i++) { out.push({ p: p.slice(), t: i / n, dir }); if (i < n) { const ns = (i + .5) * ds; const dd = (o.raggio && ns > s0) ? ds / o.raggio : 0; dir += dd * .5; p = [p[0] + Math.cos(dir) * ds, p[1] + Math.sin(dir) * ds]; dir += dd * .5; } }
    return out;
  }
  // caricatore: tipo 'alluminio' (nervature), 'polimero' (fondo a gradini e righe), 'trasparente' (cartucce visibili), 'acciaio'
  // top = [x, y] centro in alto; d0/d1 profondità in alto/in basso; w = mezza larghezza; parte = 'caricatore'
  function caricatore(A, top, o) {
    const line = lineaCaricatore(top, o), n = line.length - 1, st = [];
    const mat = o.mat || (o.tipo === 'trasparente' ? mTrasp(o.c, o.op) : o.tipo === 'alluminio' ? K.mat('grigio', null, { c: '#2e3134', tile: 'ribs', rep: [1, 9], r: .42, m: .65, ns: .45 }) : o.tipo === 'acciaio' ? K.mat('parker', null, { tile: 'ribs', rep: [1, 7], ns: .35 }) : K.mat('polimero', null, { c: o.c, r: .62 }));
    for (const s of line) { const d = lin(o.d0, o.d1, s.t); st.push({ p: s.p, f: d / 2, r: d / 2, w: o.w, nf: o.nf || 7, nr: o.nr || 7 }); }
    A.add(K.loftS(st, { K: o.K || 28, sub: 2 }), mat, 'caricatore');
    const e = line[n], ae = e.dir, pf = o.piede === undefined ? 2.2 : o.piede, d = o.d1 / 2 + pf, mF = o.matF || (o.tipo === 'trasparente' ? K.mat('polimero') : mat);
    // fondello
    const fondo = o.tipo === 'polimero' ? [[-d - 1, -6.5, 2.5], [d + 1.5, -6.5, 2.5], [d + 1.5, -1, 1], [d - 1, 1, 0], [-d + 1, 1, 0], [-d - 1, -1, 1]] : [[-d, -4.5, 1.6], [d, -4.5, 1.6], [d, 1, 0], [-d, 1, 0]];
    A.add(K.xf(K.slab(fondo, -o.w - pf * .7, o.w + pf * .7, { b: 1.1 }), { r: [0, 0, ae + PI / 2], t: e.p }), mF, 'caricatore');
    if (o.tipo === 'polimero') { // righe di presa in basso sui fianchi
      for (let i = 1; i <= 4; i++) { const s = line[Math.round(n * (1 - i * .055))] || line[n - 1], dd = lin(o.d0, o.d1, s.t) / 2 - 3; A.add(K.xf(K.slab(K.rrect(-dd, -1, dd, 1, .8), -o.w - .8, o.w + .8, { b: .6 }), { r: [0, 0, s.dir + PI / 2], t: s.p }), mF, 'caricatore'); }
    }
    if (o.tipo === 'trasparente') { // colonna di cartucce (ottone) e alimentatore visibili attraverso il corpo
      const mB = K.mat('ottone'), stc = []; const cut = Math.round(n * (o.pieno === undefined ? .85 : o.pieno));
      for (let i = 0; i <= cut; i++) { const s = line[i], dd = lin(o.d0, o.d1, s.t) / 2 - 2.2; stc.push({ p: s.p, f: dd, r: dd, w: o.w - 1.6, nf: 3, nr: 3 }); }
      A.add(K.loftS(stc, { K: 16, sub: 1 }), mB, 'caricatore');
    }
    return line;
  }

  // ---------------------------------------------------------------------------------- impugnatura a pistola
  // attacco sotto la scatola fra x0 (dietro) e x1 (davanti) alla quota y0; ang = inclinazione (gradi dalla verticale)
  // stile: 'liscia' (prima serie, quadrettata), 'dente' (sporgenza per il medio), 'ergo' (gommata con dorso a coda), 'dita' (incavi)
  function impugnatura(A, x0, x1, y0, o) {
    o = o || {}; const a = (o.ang === undefined ? 24 : o.ang) * PI / 180, Lg = o.len || 100, D = (x1 - x0) * Math.cos(a) * (o.prof || 1);
    const ux = -Math.sin(a), uy = -Math.cos(a), nx = Math.cos(a), ny = -Math.sin(a);
    const B = [x0 + ux * Lg, y0 + uy * Lg], F = [B[0] + nx * D, B[1] + ny * D], Ft = [x1, y0];
    const at = (t, off) => [lin(Ft[0], F[0], t) + nx * off, lin(Ft[1], F[1], t) + ny * off];
    const path = [[x0 - 3, y0 + 2, 0, .5], ['q', x0 + ux * Lg * .45 - nx * (o.dorso || 3), y0 + uy * Lg * .45 - ny * (o.dorso || 3), B[0], B[1]], [B[0], B[1], 4], [F[0], F[1], 3.5]];
    if (o.stile === 'dente') path.push(at(.75, 0), [...at(.6, .5), 6], [...at(.5, 4.2), 5], [...at(.4, .3), 6], at(.3, 0));
    else if (o.stile === 'dita') { for (const tt of [.82, .6, .38]) { path.push([...at(tt + .1, 1.6), 5], [...at(tt, -1.2), 4]); } }
    else if (o.stile === 'ergo') path.push([...at(.55, 2.4), 30]);
    path.push([Ft[0], Ft[1] - 1, 2, .5], [x1 + 2, y0 + 2, 0, .5]);
    if (o.stile === 'ergo') { path[0] = [x0 - 9, y0 + 1, 3, .6]; path.splice(1, 0, [x0 - 12, y0 - 6, 6, .8]); }
    const hw = o.hw || 14.5, gb = [Math.min(B[0], x0 - 14) - 2, F[1] - 2, x1 + 4, y0 + 4];
    let m = o.mat;
    if (!m) { // pittore solo se non è stato dato un materiale: quadrettatura o puntinatura sui fianchi, puntinatura sul dorso
      const p = K.painter(gb, { w: 512, h: 1024, rough: .78 });
      const pan = [at(.12, -5), at(.88, -5), [B[0] + nx * 5 - ux * 6, B[1] + ny * 5 - uy * 6], [x0 + nx * 3 + ux * 8, y0 + ny * 3 + uy * 8]];
      if (o.stile === 'liscia' || o.stile === 'dente') p.checker('LR', pan, 1.6, { r: .86 }); else p.stipple('LR', pan, { s: .3, r: .9 });
      p.wallStipple({ s: .9, ay: 1.4 }); p.wallFill({ r: .84 });
      m = o.tinta ? mPo(o.tinta, p.done(2), { ns: .8 }) : K.mat('polimero', p.done(2), { ns: .8 });
    }
    A.add(K.slab(path, -hw, hw, { b: o.b || 7.2, bs: 5, uv: gb }), m);
    return { B, F, mid: [lin(x0, B[0], .5) + nx * D * .5, lin(y0, B[1], .5) + ny * D * .5] };
  }

  // ---------------------------------------------------------------------------------- mire e ottiche
  // mira posteriore ribaltabile a diottra su slitta (alzata): x = centro, yb = cima della slitta, yl = linea di mira
  function diottraRibaltabile(A, x, yb, yl, o) {
    o = o || {}; const m = K.mat(o.kind || 'anod'), hw = o.hw || 10.5;
    A.add(K.slab([[x - 16, yb - 4, 1.5], [x + 14, yb - 4, 1.5], [x + 14, yb + 6, 2], [x - 16, yb + 6, 2]], -hw, hw, { b: 1 }), m);
    // orecchie di protezione e lamina con il foro
    A.add(K.slabX([[-hw, yb + 5, 1], [hw, yb + 5, 1], [hw, yl + 4, 3], [hw - 3.4, yl + 4, 1], [hw - 3.4, yb + 9, 2], [-hw + 3.4, yb + 9, 2], [-hw + 3.4, yl + 4, 1], [-hw, yl + 4, 3]], x - 9, x + 5, { b: .7 }), m);
    A.add(K.slabX([[-5.6, yb + 7, .5], [5.6, yb + 7, .5], [5.6, yl + 3, 2], [-5.6, yl + 3, 2]], x - 3.5, x - 1.5, { b: .4, holes: [K.circ(0, yl, 1.1, 14)] }), m);
    // pomello della deriva sul lato destro
    A.add(cilZ(x + 6, yb + 1, hw - .5, hw + 4.5, 4.2, 16), K.mat('anod', null, { tile: 'knurl', rep: [4, 1] }));
  }
  // mirino ribaltabile su slitta (alzato): torretta con orecchie e lama
  function mirinoRibaltabile(A, x, yb, yl, o) {
    o = o || {}; const m = K.mat(o.kind || 'anod'), hw = o.hw || 10.5;
    A.add(K.slab([[x - 14, yb - 4, 1.5], [x + 14, yb - 4, 1.5], [x + 14, yb + 5, 2], [x - 14, yb + 5, 2]], -hw, hw, { b: 1 }), m);
    A.add(K.slabX([[-hw + 1, yb + 4, 1], [hw - 1, yb + 4, 1], [hw - 1, yl + 4, 3], [hw - 4.2, yl + 4, 1], [hw - 4.2, yb + 10, 3], [-hw + 4.2, yb + 10, 3], [-hw + 4.2, yl + 4, 1], [-hw + 1, yl + 4, 3]], x - 6, x + 6, { b: .7 }), m);
    A.add(K.slab([[x - 1.6, yb + 9, 0], [x + 1.6, yb + 9, 0], [x + 1, yl, .3], [x - 1, yl, .3]], -1.2, 1.2, { b: .3 }), K.mat('nero'));
  }
  // ottica compatta a ingrandimento fisso con fibra ottica sopra e attacco a slitta (x0 = oculare, yb = cima della slitta)
  function otticaCompatta(A, x0, yb, o) {
    o = o || {}; const ma = mAl(o.tinta || 'nera', null, { r: .55 }), ml = K.mat('lente'), y = yb + 31, L = o.len || 150;
    A.add(K.latheX([[x0, 13], [x0, 15.5], [x0 + 3, 16.5], [x0 + 22, 16.5], [x0 + 26, 14.5], [x0 + 32, 14.5], [x0 + 40, 17], [x0 + L - 34, 17.5], [x0 + L - 22, 19.5], [x0 + L - 2, 19.8], [x0 + L, 18.5], [x0 + L, 16]], { seg: 30, cy: y }), ma);
    A.add(K.latheX([[x0 - 14, 12.5], [x0 - 14, 15], [x0 - 12, 16.2], [x0 + 1, 16.2], [x0 + 1, 13]], { seg: 26, cy: y }), K.mat('gomma'));
    A.add(K.discX(x0 + 1.2, y, 0, 12.5, -1, 26), ml); A.add(K.discX(x0 + L - .8, y, 0, 16, 1, 28), ml);
    // corpo squadrato in alto con la fibra ottica e il mirino d'emergenza
    A.add(K.slab([[x0 + 30, y + 8, 2], [x0 + L - 26, y + 8, 2], [x0 + L - 30, y + 22, 3], [x0 + 38, y + 22, 3]], -9, 9, { b: 1.6 }), ma);
    A.add(K.rod(x0 + 42, x0 + L - 34, 3.2, { cy: y + 25, seg: 14 }), K.mat('verde', null, { c: '#3c6a3a', r: .25, m: 0 }));
    A.add(K.slab([[x0 + L - 34, y + 21, 1], [x0 + L - 28, y + 21, 1], [x0 + L - 31, y + 30, 1], [x0 + L - 33, y + 30, 1]], -1.2, 1.2, { b: .3 }), ma);
    // torrette laterali e attacco
    A.add(cilZ(x0 + 78, y, 16, 25, 8.5, 18), ma); A.add(K.box(x0 + 66, y + 9, -8, x0 + 90, y + 19, 8, 1.5), ma);
    A.add(K.slab([[x0 + 46, yb - 1, 1], [x0 + 112, yb - 1, 1], [x0 + 106, y - 10, 4], [x0 + 52, y - 10, 4]], -12, 12, { b: 1.4 }), ma);
    A.add(cilZ(x0 + 62, yb + 5, -18, -12, 6, 16), K.mat('anod', null, { tile: 'knurl', rep: [5, 1] })); A.add(cilZ(x0 + 96, yb + 5, -18, -12, 6, 16), K.mat('anod', null, { tile: 'knurl', rep: [5, 1] }));
    return y;
  }

  // ---------------------------------------------------------------------------------- dispositivi di bocca extra
  // rompifiamma a gabbia aperta (prima serie): sei feritoie tutto intorno
  function gabbiaAperta(A, x0, r, len, m) {
    m = m || K.mat('parker', null, { r: .55 }); const mD = mBuio();
    A.add(K.latheX([[x0, 0], [x0, r - .6], [x0 + 1, r], [x0 + 12, r], [x0 + 12, r - 1.2]], { seg: 26 }), m);
    A.add(K.tube(x0 + 11, x0 + len, r - 1.4, r - 4, { seg: 24 }), mD);
    for (let i = 0; i < 6; i++) { const g = K.box(x0 + 12, -1.4, -1.5, x0 + len - 3, 1.4, 1.5, .35); g.translate(0, r - 1.4, 0); g.applyMatrix4(new THREE.Matrix4().makeRotationX(i * PI / 3 + PI / 6)); A.add(g, m); }
    A.add(K.latheX([[x0 + len - 3.5, r - 1.4], [x0 + len - 3.5, r], [x0 + len, r], [x0 + len, r - 2.6]], { seg: 26 }), m);
  }
  // freno di bocca a tromba (prima serie del calibro pieno): campana con feritoie lunghe
  function freno_tromba(A, x0, r, len, m) {
    m = m || K.mat('grigio', null, { c: '#5a5c5e', m: .7, r: .4 }); const mD = mBuio();
    A.add(K.latheX([[x0, 0], [x0, r], [x0 + 8, r], [x0 + len * .55, r * 1.25], [x0 + len, r * 1.75], [x0 + len, r * 1.45], [x0 + len - 6, r * 1.2]], { seg: 28 }), m);
    A.add(K.discX(x0 + len - 6, 0, 0, r * 1.2, 1, 24), mD);
    for (let i = 0; i < 6; i++) { const g = K.box(x0 + 14, -1.6, -1.3, x0 + len - 6, 1.6, 1.3, .3); g.translate(0, r * 1.18, 0); g.applyMatrix4(new THREE.Matrix4().makeRotationX(i * PI / 3)); A.add(g, mD); }
  }
  // compensatore chiuso con feritoie oblique in alto
  function compensatoreObliquo(A, x0, r, len, m) {
    m = m || K.mat('parker', null, { r: .55 }); const mD = mBuio();
    A.add(K.latheX([[x0, 0], [x0, r - .5], [x0 + 1, r], [x0 + len - 2, r], [x0 + len, r - 1.5], [x0 + len, 0]], { seg: 26 }), m);
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) { const g = K.box(-2.2, -1, -1.2, 2.2, 1, 1.2, .3); g.rotateZ(.5); g.translate(x0 + 10 + i * (len - 16) / 3, r * .62, s * r * .62); g.rotateX(0); A.add(g, mD); }
    A.add(K.discX(x0 + len + .05, 0, 0, r * .4, 1, 14), mD);
  }

  // ====================================================================================== FAMIGLIA A SCATOLA IN ALLUMINIO
  // misure della scatola: calibro intermedio e calibro pieno
  function misureScatola(cal) {
    if (cal === 762) return { L: 206, top: 22, bot: -14, uhw: 14.6, lhw: 13.6, mw0: 108, mw1: 192, mwBot: -66, mwHw: 17, gx0: 28, gx1: 62, tx: 80, bf: 160, port: [76, 148, -7, 13], fa: 34, magD: [76, 82], magW: 12.8, piv: 199 };
    return { L: 178, top: 21, bot: -13, uhw: 13.6, lhw: 12.6, mw0: 96, mw1: 163, mwBot: -60, mwHw: 15.8, gx0: 24, gx1: 58, tx: 74, bf: 136, port: [66, 124, -6, 12], fa: 28, magD: [59, 64], magW: 11.2, piv: 171 };
  }

  // scatola inferiore: corpo, pozzetto del caricatore, perni, comandi, scritte
  function scatolaInferiore(A, R, spec, o) {
    const bb = [-14, R.mwBot - 3, R.L + 3, 20];
    const p = K.painter(bb, { w: 1024, h: 1024, rough: .5 });
    for (const [x, y, r] of [[9, -20, 2.6], [R.piv, -20, 2.6], [R.tx - 11, -24, 2], [R.tx, -28, 2]]) p.pin('LR', x, y, r, { h: .4, a: 1.08 });
    const mx = (R.mw0 + R.mw1) / 2 + 1;
    p.text('L', maiusc(spec.produttore), mx, -22, 3, { spacing: 3 });
    p.text('L', maiusc(spec.nome) + (o.sigla ? ' ' + o.sigla : ''), mx, -29, 3.2, { spacing: 2 });
    p.text('L', 'CAL ' + String(spec.calibro || '5,56×45 mm').replace(' mm', ''), mx, -35.5, 2.5);
    p.text('L', matricola(spec), mx, -41.5, 2.5);
    p.text('L', maiusc(spec.paese || ''), mx, -47.5, 2.2);
    // selettore: segni di sicura / colpo singolo / raffica attorno al perno (lato sinistro)
    const sx = R.gx0 + 16, sy = -20;
    if (o.pittogrammi) { p.fill('L', K.rrect(sx + 9, sy - 1, sx + 12, sy + 1, .5), { h: -.6, a: .9 }); p.fill('L', K.rrect(sx - 1, sy + 9, sx + 1, sy + 12, .5), { h: -.6, a: 1.6 }); p.fill('L', K.rrect(sx - 12, sy - 1, sx - 9, sy + 1, .5), { h: -.6, a: 1.6 }); }
    else { p.text('L', o.sicura || 'SAFE', sx + 13, sy, 2.2); p.text('L', 'SEMI', sx, sy + 10, 2.2); p.text('L', o.raffica || 'AUTO', sx - 13, sy, 2.2); }
    if (o.ambi) { p.text('R', 'S', sx + 10, sy, 2.4); p.text('R', 'F', sx - 10, sy, 2.4); }
    p.line('R', [[R.mw0 + 2, -15], [R.mw1 - 2, -15]], .3, { h: -.4, a: .8 });
    p.noise({ a: .12, r: .18, seed: 4 }); p.walls({ r: .5 });
    const m = o.mat || mAl(o.tinta, p.done(2.3), { ns: .8 });
    // corpo: torretta posteriore del tubo, attacco dell'impugnatura, orecchie della cerniera
    const body = [[-10, -18, 4, .6], [-10, 10, 6, .8], [-4, 16, 2, .6], [0, 16, 0, .4], [0, R.bot, 0, .3], [R.L - 2, R.bot, 0, .3], [R.L - 2, -22, 6, .7], [R.mw1 + 2, -29, 2], [R.mw1, -31],
      [R.mw0, -31], [R.mw0, -38, 2], [R.gx1 + 2, -38, 2], [R.gx1 - 6, -40, 3], [R.gx0 + 2, -40, 3], [R.gx0 - 10, -36, 8], [-4, -27, 6]];
    A.add(K.slab(body, -R.lhw, R.lhw, { b: 1.6, uv: bb }), m);
    // pozzetto del caricatore (più largo) con la bocca svasata
    const mw = [[R.mw0 - 1, R.bot - 1, 0], [R.mw1 + 1, R.bot - 1, 0], [R.mw1 + 1, -27, 3], [R.mw1 - .5, -31, 3], [R.mw1 - .5, R.mwBot + 7, 2], [R.mw1 + 2.5, R.mwBot + 3, 2], [R.mw1 + 3, R.mwBot, 1.2], [R.mw0 - 2, R.mwBot, 1.2], [R.mw0 - 1.5, R.mwBot + 6, 2], [R.mw0 - 1, -37, 1]];
    A.add(K.slab(mw, -R.mwHw, R.mwHw, { b: 1.4, uv: bb }), m);
    A.add(K.box(R.mw0 - 2, R.mwBot, -R.mwHw - 1.3, R.mw1 + 3, R.mwBot + 6, R.mwHw + 1.3, 1.2), m);
    // pulsante di sgancio del caricatore (destra) con il recinto di protezione
    const mS = K.mat('nero');
    A.add(cilZ(R.mw0 + 3, -27, R.mwHw - .5, R.mwHw + 2.2, 4.4, 16), mS);
    if (o.recinto !== false) A.add(K.slab([['a', R.mw0 + 3, -27, 9, -PI * .15, PI * 1.05], ['a', R.mw0 + 3, -27, 6.6, PI * 1.05, -PI * .15]], R.mwHw - .4, R.mwHw + 2.6, { b: .6 }), m);
    // arresto dell'otturatore (sinistra): paletta
    A.add(K.slab([[R.mw0 - 6, -14.5, 2], [R.mw0 + 10, -14.5, 1], [R.mw0 + 12, -19, 2], [R.mw0 + 4, -26, 3], [R.mw0 - 4, -22, 2]], -R.mwHw - 2.2, -R.mwHw + .4, { b: .6 }), mS);
    if (o.ambi) A.add(K.slab([[R.mw0 + 4, -16, 1.5], [R.mw0 + 22, -16, 1.5], [R.mw0 + 22, -21, 1.5], [R.mw0 + 4, -21, 1.5]], R.mwHw - .4, R.mwHw + 1.6, { b: .5 }), mS);
    // leva del selettore (sinistra, e destra se ambidestra), in posizione di sicura (verso avanti)
    const sel = z0 => K.slab([['a', sx, sy, 5.2, PI * .5, PI * 1.5], [sx + 4, sy - 3.4, 1], [sx + 15, sy - 1.6, 1.4], [sx + 15.5, sy + 1.4, 1.4], [sx + 4, sy + 3.4, 1]], z0, z0 + 2.6, { b: .7 });
    A.add(sel(-R.lhw - 2.4), mS); if (o.ambi) A.add(sel(R.lhw - .2), mS);
    // ponticello: barra classica o largo integrato
    if (o.ponticello === 'largo') A.add(K.slab([[R.mw0 + 1, -36, 2], [R.mw0 + 1, -50, 4], [R.mw0 - 8, -56, 6], [R.gx1 - 2, -56, 8], [R.gx1 - 8, -46, 4], [R.gx1 - 6, -40, 2], [R.gx1 + 2, -40, 2], [R.gx1 + 4, -49.5, 4], [R.mw0 - 7, -49.5, 4], [R.mw0 - 5, -38, 2]], -7.5, 7.5, { b: 1.4 }), m);
    else A.add(K.slab([[R.mw0 + 1, -37, 1], [R.mw0 + 1, -51, 3], [R.mw0 - 3, -55, 3], [R.gx1 + 1, -55, 4], [R.gx1 - 4, -48, 3], [R.gx1 - 2, -40, 1], [R.gx1 + 2, -40, 1], [R.gx1 + 4, -50.5, 2.5], [R.mw0 - 3.5, -50.5, 2.5], [R.mw0 - 3, -37, 1]], -5.5, 5.5, { b: 1 }), m);
    // grilletto
    A.add(K.slab([[R.tx - 2, -30, 1], [R.tx + 2.5, -31, 2], [R.tx + 1.5, -40, 6], [R.tx - 1.5, -48.5, 1.2], [R.tx - 4.5, -48, 1], [R.tx - 2, -40, 6], [R.tx - 3, -31, 1]], -3.2, 3.2, { b: .7 }), K.mat('nero'), 'grilletto');
    A.pivot('grilletto', [R.tx, -27, 0]);
    return m;
  }

  // scatola superiore: due metà (destra con la finestra di espulsione), slitta o maniglia, aiuto alla chiusura, deflettore,
  // coperchio della finestra aperto, gruppo otturatore (parte mobile) e leva di armamento a T (manetta)
  function scatolaSuperiore(A, R, spec, o) {
    const bb = [-2, R.bot - 2, R.L + 2, R.top + 2], P = R.port;
    const p = K.painter(bb, { w: 1024, h: 512, rough: .5 });
    p.line('R', K.rrect(P[0] - 1.2, P[2] - 1.2, P[1] + 1.2, P[3] + 1.2, 3), .5, { h: -.5, a: .85 }, true);
    p.pin('LR', R.L - 20, 4, 1.8, { h: .35, a: 1.06 }); p.pin('R', 22, R.bot + 5, 1.6, { h: .35, a: 1.06 });
    if (o.scritta) p.text('L', o.scritta, R.L * .55, 6, 3, { spacing: 2 });
    p.noise({ a: .12, r: .18, seed: 6 }); p.walls({ r: .5 });
    const m = mAl(o.tinta, p.done(2.3), { ns: .8 });
    const out = [[0, R.bot, 1, .4], [R.L, R.bot, 1, .4], [R.L, R.top, 4, 1], [0, R.top, 2.5, 1]];
    A.add(K.slab(out, -R.uhw, 0, { bL: 2.2, bR: 0, uv: bb }), m);
    A.add(K.slab(out, 0, R.uhw, { bL: 0, bR: 2.2, uv: bb, holes: [K.rrect(P[0], P[2], P[1], P[3], 3)] }), m);
    A.add(K.box(P[0], P[2], -1, P[1], P[3], .2, 0), mBuio());
    // anello anteriore (dado della canna)
    A.add(K.latheX([[R.L - 2, 0], [R.L - 2, 15.5], [R.L + 6, 15.5], [R.L + 6, 0]], { seg: 28 }), m);
    if (o.slitta) C.put(A, slitta(1, R.L - 1, R.top - .3, { mat: m }));
    // aiuto alla chiusura (destra, dietro la finestra): tubo inclinato e pulsante a goccia o tondo
    if (o.assist) {
      const fx = R.fa, gH = K.latheX([[0, 0], [0, 6.2], [1, 7], [30, 7], [30, 0]], { seg: 20 });
      const g = K.xf(gH, { t: [fx - 4, 8, R.uhw - 2] }); K.xf(g, { r: [0, .14, 0], p: [fx + 26, 8, R.uhw - 2] }); A.add(g, m);
      const bt = o.assist === 'goccia' ? K.xf(K.slab([['a', 0, 0, 6.5, PI * .5, PI * 1.5], [9, -2.5, 3], [9, 2.5, 3]], -3, 3, { b: 1 }), { r: [0, -PI / 2, 0] }) : K.latheX([[0, 0], [0, 6.8], [1.2, 7.6], [7, 7.6], [8, 6.6], [8, 0]], { seg: 22 });
      const g2 = o.assist === 'goccia' ? K.xf(bt, { t: [fx - 9, 8, R.uhw + 2.8] }) : K.xf(bt, { t: [fx - 12, 8, R.uhw + 1.6] });
      K.xf(g2, { r: [0, .14, 0], p: [fx + 26, 8, R.uhw - 2] }); A.add(g2, o.assist === 'goccia' ? K.mat('nero') : K.mat('nero', null, { tile: 'ribs', rep: [1, 10] }));
    }
    // deflettore dei bossoli dietro la finestra
    if (o.deflettore) A.add(K.slab([[P[0] - 13, R.top - .5, 2], [P[0] - .5, R.top - .5, 0], [P[0] - .5, P[2] + 6, 3], [P[0] - 5, P[2] + 4, 4]], R.uhw - 1, R.uhw + 5.2, { b: 1.2 }), m);
    // coperchio della finestra aperto (cerniera sotto la finestra)
    A.add(K.xf(K.slab([[P[0] + 2, -15, 1.5], [P[1] - 2, -15, 1.5], [P[1] - 2, 0, .5], [P[0] + 2, 0, .5]], 0, 1, { b: .35, uv: bb }), { r: [-.4, 0, 0], t: [0, P[2] - 3.5, R.uhw + .8] }), m);
    A.add(K.xf(K.slab([[P[0] + 2, -15, .5], [P[0] + 9, -15, .5], [P[0] + 9, -11, .5], [P[0] + 2, -11, .5]], .9, 2.2, { b: .3 }), { r: [-.4, 0, 0], t: [0, P[2] - 3.5, R.uhw + .8] }), K.mat('nero'));
    A.add(K.rod(P[0] - 2, P[1] + 2, 1.3, { cy: P[2] - 3.5, cz: R.uhw + .6, seg: 10 }), K.mat('nero'));
    // gruppo otturatore (si vede dalla finestra)
    const mB = K.mat(o.otturatore || 'parker', null, { r: .42 });
    A.add(K.rod(10, R.bf - 7, 12.4, { seg: 24 }), mB, 'otturatore');
    A.add(K.rod(R.bf - 7.5, R.bf, 9.4, { seg: 20 }), K.mat('grigio', null, { r: .38 }), 'otturatore');
    A.add(K.box(P[0] + 6, 6, 9.4, P[0] + 18, 10, 12.6, .6), mB, 'otturatore');
    A.pivot('otturatore', [R.bf, 0, 0]);
    // leva di armamento a T dietro (manetta), con il dente di aggancio a sinistra
    if (o.manettaT !== false) {
      const t0 = R.top - 6.2, t1 = R.top - .4;
      A.add(K.slabY([[-15, -17, 3], [-15, 17, 3], [-10, 20.5, 2], [-5.5, 18, 1.5], [-5.5, 5.5, 1], [6, 5.5, 0], [6, -5.5, 0], [-5.5, -5.5, 1], [-5.5, -16, 1], [-8.5, -24, 1.5], [-13, -24, 1.5]], t0, t1, { b: .8 }), K.mat('nero'), o.tFissa ? 'corpo' : 'manetta');
      if (!o.tFissa) A.pivot('manetta', [-8, t0, 0]);
    }
    return m;
  }

  // maniglia di trasporto fissa con tacca a due diottre fra due orecchie (prima serie)
  function manigliaFissa(A, R, m, o) {
    const y0 = R.top - 1, yb = R.top + 34, yl = o.yl;
    const hp = [[6, y0, 0], [R.L - 14, y0, 0], [R.L - 22, R.top + 14, 9], [R.L - 36, yb, 4], [46, yb, 2], [44, yl - 7, 2], [12, yl - 7, 3], [6, R.top + 14, 3]];
    A.add(K.slab(hp, -6.6, 6.6, { b: 1.6, holes: [[[50, R.top + 3.5, 5], [R.L - 34, R.top + 3.5, 4], [R.L - 44, R.top + 24, 6], [52, R.top + 24, 5]]] }), m);
    A.add(K.slab([[8, y0, 0], [44, y0, 0], [44, yl - 7, 2], [12, yl - 7, 3], [8, R.top + 10, 2]], -10.5, 10.5, { b: 1.4 }), m);
    // orecchie (vista di fronte: U) e diottre ribaltabili
    A.add(K.slabX([[-10.5, yl - 9, 1], [10.5, yl - 9, 1], [10.5, yl + 4.5, 3], [6.5, yl + 4.5, 1], [6.5, yl - 4.5, 2.5], [-6.5, yl - 4.5, 2.5], [-6.5, yl + 4.5, 1], [-10.5, yl + 4.5, 3]], 14, 36, { b: .9 }), m);
    A.add(K.slabX([[-6, yl - 5, .5], [6, yl - 5, .5], [6, yl + 3, 2.4], [-6, yl + 3, 2.4]], 23, 25, { b: .4, holes: [K.circ(0, yl, 1.1, 14)] }), K.mat('nero'));
    A.add(K.xf(K.slabX([[-6, yl - 5, .5], [6, yl - 5, .5], [6, yl + 1, 2.4], [-6, yl + 1, 2.4]], 25, 27, { b: .4 }), { r: [0, 0, -1.1], p: [25, yl - 5, 0] }), K.mat('nero'));
    // tamburo della deriva sul lato destro
    A.add(cilZ(26, yl - 13, 10, 14.5, 7, 20), K.mat('anod', null, { tile: 'knurl', rep: [6, 1] }));
    A.add(cilZ(26, yl - 13, -13.5, -10, 3.6, 14), K.mat('nero'));
  }
  // maniglia di trasporto staccabile su slitta: piede con due pomelli, tamburo dell'alzo, tamburo della deriva
  function manigliaStaccabile(A, R, m, o) {
    const yr = R.top + 9.4, yb = R.top + 36, yl = o.yl, x0 = 8, x1 = 150;
    A.add(K.slab([[x0, yr - 1, 0], [x1, yr - 1, 0], [x1 - 6, yr + 8, 6], [x1 - 22, yb, 4], [x0 + 38, yb, 2], [x0 + 36, yl - 8, 2], [x0 + 4, yl - 8, 3], [x0, yr + 6, 2]], -6.6, 6.6, { b: 1.6, holes: [[[x0 + 42, yr + 4, 4], [x1 - 22, yr + 4, 4], [x1 - 30, yb - 9, 5], [x0 + 44, yb - 9, 5]]] }), m);
    A.add(K.slab([[x0, yr - 6, 1], [x0 + 32, yr - 6, 1], [x0 + 32, yr + 4, 1], [x0, yr + 4, 1]], -12, 12, { b: 1 }), m);
    A.add(K.slab([[x1 - 40, yr - 6, 1], [x1, yr - 6, 1], [x1, yr + 4, 1], [x1 - 40, yr + 4, 1]], -12, 12, { b: 1 }), m);
    A.add(K.slab([[x0 + 2, yr, 0], [x0 + 36, yr, 0], [x0 + 36, yl - 8, 2], [x0 + 6, yl - 8, 3], [x0 + 2, yr + 4, 2]], -10.5, 10.5, { b: 1.4 }), m);
    const mk = K.mat('anod', null, { tile: 'knurl', rep: [6, 1] });
    for (const xk of [x0 + 16, x1 - 20]) A.add(cilZ(xk, yr - 1, -12, -18, 7.5, 20), mk);
    // tamburo dell'alzo (asse verticale) e orecchie con la diottra
    A.add(cilY(x0 + 20, 0, yl - 13, yl - 7, 10.5, 24), mk);
    A.add(K.slabX([[-10, yl - 8, 1], [10, yl - 8, 1], [10, yl + 4.5, 3], [6.2, yl + 4.5, 1], [6.2, yl - 4.5, 2.5], [-6.2, yl - 4.5, 2.5], [-6.2, yl + 4.5, 1], [-10, yl + 4.5, 3]], x0 + 10, x0 + 30, { b: .9 }), m);
    A.add(K.slabX([[-5.6, yl - 5, .5], [5.6, yl - 5, .5], [5.6, yl + 3, 2.4], [-5.6, yl + 3, 2.4]], x0 + 19, x0 + 21, { b: .4, holes: [K.circ(0, yl, 1.1, 14)] }), K.mat('nero'));
    A.add(cilZ(x0 + 20, yl - 12, 10, 15, 6, 18), mk);
  }

  // base del mirino triangolare con il blocco del gas, orecchie di protezione, baionetta e maglia della cinghia
  function mirinoTriangolo(A, x, yl, rb, o) {
    o = o || {}; const m = K.mat('parker', null, { r: .5 }), yt = yl + 4;
    A.add(K.slab([[x - 17, -rb - 3, 3], [x + 16, -rb - 3, 3], [x + 16, rb + 3, 2], [x - 17, rb + 3, 2]], -rb - 1.5, rb + 1.5, { b: 2 }), m);
    A.add(K.slab([[x - 16, rb + 1, 0], [x + 15, rb + 1, 0], [x + 5, yt - 19, 3], [x - 7, yt - 19, 3]], -5.5, 5.5, { b: 1.2 }), m);
    A.add(K.slabX([[-9, yt - 21, 2], [9, yt - 21, 2], [9, yt, 2.5], [5.6, yt, 1], [5.6, yt - 13, 2.5], [-5.6, yt - 13, 2.5], [-5.6, yt, 1], [-9, yt, 2.5]], x - 8, x + 5, { b: .8 }), m);
    A.add(K.slab([[x - 3.2, yt - 14, .3], [x + .8, yt - 14, .3], [x + .2, yl, .3], [x - 2.6, yl, .3]], -1.3, 1.3, { b: .3 }), K.mat('nero'));
    A.add(cilY(x - 1.2, 0, yt - 16, yt - 13, 3.6, 12), K.mat('nero'));
    A.add(K.box(x + 7, -rb - 11, -4, x + 16, -rb - 2, 4, 1), m); // dente della baionetta
    A.add(K.slab([[x - 14, -rb - 2, 1], [x - 4, -rb - 2, 1], [x - 6, -rb - 8, 2], [x - 12, -rb - 8, 2]], -3, 3, { b: .6 }), m);
    maglia(A, x - 9, -rb - 16, 0, 0, 7.5);
    if (o.tubo !== false) A.add(K.rod(x - 60, x - 16, 2.4, { cy: rb + 1, seg: 10 }), K.mat('nero'));
  }

  // calcio fisso pieno sul tubo (prima serie e seconda serie, più lungo e squadrato) con calciolo e sportellino
  function calcioFisso(A, x1, yTop, o) {
    const xb = o.xb, len = x1 - xb, mat = o.mat || K.mat('polimero', null, { tile: 'grana', rep: [10, 4], r: .55, ns: .25 }), H = o.alto || 124;
    const st = [{ x: xb, t: yTop, b: yTop - H, w: 20 }, { x: xb + len * .18, t: yTop + .5, b: yTop - H + 12, w: 19.6 }, { x: xb + len * .55, t: yTop + .5, b: yTop - H * .62, w: 18.2 },
      { x: x1 - 30, t: yTop, b: -32, w: 16.6 }, { x: x1, t: yTop - 1, b: -22, w: 15.4 }].map(s => Object.assign({ nt: 2.6, nb: o.quadro ? 6 : 4 }, s));
    A.add(K.loftX(st, { K: 30, step: 8 }), mat);
    // calciolo con la quadrettatura e lo sportellino del vano
    A.add(K.slabX([[-20.5, yTop - H - 1, 4], [20.5, yTop - H - 1, 4], [20.5, yTop - 4, 8], [0, yTop + 1, 10], [-20.5, yTop - 4, 8]], xb - 8, xb + .5, { b: 1.5 }), K.mat('polimero', null, { tile: 'checker', rep: [5, 12], r: .7 }));
    if (o.sportello) { A.add(K.box(xb - 9, yTop - H * .62, -12, xb - 7.5, yTop - 12, 12, .8), K.mat('polimero', null, { r: .55 })); A.add(cilZ(xb - 8.6, yTop - H * .5, -6, 6, 1.6, 10), K.mat('nero')); }
    maglia(A, xb + 30, yTop - H + 1, 0, 0, 7);
  }
  // tubo del calcio retrattile con ghiera, piastrina e anello; ritorna gli estremi
  function tuboCalcio(A, x0, len, r, o) {
    o = o || {}; const mT = K.mat('anod');
    A.add(K.rod(x0 - len, x0 - 8, r, { seg: 24 }), mT);
    A.add(K.slab([[x0 - len + 4, -r - 4.5, 1], [x0 - 10, -r - 4.5, 1], [x0 - 10, -r + 2, 0], [x0 - len + 4, -r + 2, 0]], -5, 5, { b: .6 }), mT);
    A.add(K.latheX([[x0 - 15, 0], [x0 - 15, r + 3], [x0 - 14, r + 4.2], [x0 - 9, r + 4.2], [x0 - 8, r + 3.2], [x0 - 8, 0]], { seg: 10 }), K.mat('parker'));
    A.add(K.slab([[x0 - 9, -r - 9, 3], [x0 - 7, -r - 9, 3], [x0 - 7, r + 6, 6], [x0 - 9, r + 6, 6]], -r - 2, r + 2, { b: .5 }), K.mat('parker'));
    if (o.anello !== false) maglia(A, x0 - 11, -r - 10, -r - 6, PI / 2, 6);
    return [x0 - len, x0 - 8];
  }
  // calcio retrattile della carabina: guscio tondo attorno al tubo, nervatura sottile che scende al calciolo,
  // pannelli incavati sui fianchi, leva di regolazione sotto e calciolo in gomma
  function calcioRetrattile(A, xb, yt, o) {
    o = o || {}; const L = o.len || 168, H = o.alto || 116, kind = o.kind || 'polimero';
    const bb = [xb - 12, yt - H - 4, xb + L + 4, yt + 4];
    const p = K.painter(bb, { w: 1024, h: 512, rough: .66 });
    p.fill('LR', [[xb + 14, yt - H + 14], [xb + 28, yt - H + 16], [xb + L - 34, -26], [xb + L - 46, -20], [xb + 16, -20]], { h: -.55, a: .82 });
    for (let i = 0; i < 4; i++) p.line('LR', [[xb + 20, -28 - i * 16], [xb + 60 - i * 6, -28 - i * 16]], .9, { h: -.6, a: .8 });
    p.wallFill({ r: .7 }); p.noise({ a: .06, r: .1, seed: 11 });
    const m = K.mat(kind, p.done(2.2), { ns: .8, c: o.c });
    // guscio superiore attorno al tubo
    A.add(K.loftX([{ x: xb, t: yt, b: -19, w: 17.5 }, { x: xb + L - 40, t: yt, b: -19, w: 17 }, { x: xb + L - 8, t: yt - 2, b: -18, w: 16.5 }, { x: xb + L, t: yt - 5, b: -15, w: 15 }].map(s => Object.assign({ nt: 3, nb: 3 }, s)), { K: 28, step: 12 }), K.mat(kind, null, { c: o.c, r: .62 }));
    // nervatura che scende al calciolo (fianchi piani)
    A.add(K.slab([[xb, yt - H, 3], [xb + 22, yt - H + 2, 5], [xb + L - 30, -16, 8], [xb + L - 30, -6, 0], [xb, -6, 0]], -12.5, 12.5, { b: 2.4, uv: bb }), m);
    A.add(K.slab([[xb + L - 46, -17, 2], [xb + L - 8, -17, 2], [xb + L - 12, -25, 2], [xb + L - 42, -24, 3]], -4, 4, { b: .8 }), K.mat('nero'));
    A.add(K.slab([[xb - 9, yt - H - 1, 3], [xb + 1, yt - H + 1, 1], [xb + 1, yt - 1, 3], [xb - 9, yt - 3, 6]], -17.5, 17.5, { b: 2 }), K.mat('gomma'));
    maglia(A, xb + 10, yt - H + 6, 0, 0, 6);
  }

  // costruttore della famiglia: o = {cal, canna, gas, maniglia: 'fissa'|'staccabile'|null, guardamano, calcio, impugnatura,
  // bocca, mire, ottica, bipiede, caricatore, assist, deflettore, ponticello, colore}
  FAM2.fucile_scatola = function (spec, o) {
    init(); o = o || {};
    const A = K.asm('fucile_scatola'), R = misureScatola(o.cal), t = o.tinta || tinta(spec);
    const yl = o.yl || (66 + (o.cal === 762 ? 2 : 0)); // linea di mira delle mire metalliche
    const gas = R.L + ({ carabina: 182, medio: 232, fucile: 334 }[o.gas || 'fucile']);
    const xm = R.bf + o.canna; // bocca della canna
    // ---------------- scatole
    const mU = scatolaSuperiore(A, R, spec, { tinta: t, slitta: o.maniglia !== 'fissa' && !o.senzaSlitta, assist: o.assist, deflettore: o.deflettore, otturatore: o.otturatore, scritta: o.scrittaSup, manettaT: !(o.manettaDx || o.levaManiglia), tFissa: !!o.manettaSx });
    if (o.manettaDx) { // leva di armamento a destra che corre con l'otturatore, nella sua feritoia
      const xh = R.port[1] + 30, mS = K.mat('nero');
      A.add(K.box(R.port[1] + 2, 3.2, R.uhw - .4, R.L - 6, 8.2, R.uhw + .3, .4), mBuio());
      A.add(K.box(xh - 9, 3.6, R.uhw - 1, xh + 9, 7.8, R.uhw + 1.2, .6), mS, 'otturatore');
      A.add(cilZ(xh, 5.7, R.uhw, R.uhw + 14, 2.6, 12), mS, 'otturatore');
      A.add(K.xf(K.latheX([[0, 0], [0, 4.8], [1.5, 5.6], [8, 5.6], [10, 4.4], [10, 0]], { seg: 18 }), { r: [0, -PI / 2, 0], t: [xh, 5.7, R.uhw + 12] }), mS, 'otturatore');
    }
    if (o.levaManiglia) { // leva di armamento a forma di grilletto sotto la maniglia (prima serie del calibro pieno)
      A.add(K.slab([[64, R.top + 25, 1], [72, R.top + 25, 1], [71, R.top + 14, 3], [66, R.top + 5, 1], [62.5, R.top + 6, 1], [66, R.top + 15, 3]], -3, 3, { b: .6 }), K.mat('grigio'), 'manetta');
      A.pivot('manetta', [68, R.top + 25, 0]);
    }
    if (o.diottraTamburo) { // tacca a tamburo con orecchie sul retro della scatola
      const mS = K.mat('nero');
      A.add(K.slab([[4, R.top - 1, 1], [38, R.top - 1, 1], [36, R.top + 6, 2], [6, R.top + 6, 2]], -11, 11, { b: 1 }), mU);
      A.add(K.slabX([[-11, R.top + 4, 1], [11, R.top + 4, 1], [11, yl + 6, 3], [7.5, yl + 6, 1], [7.5, R.top + 9, 2], [-7.5, R.top + 9, 2], [-7.5, yl + 6, 1], [-11, yl + 6, 3]], 8, 32, { b: .9 }), mU);
      A.add(cilZ(20, yl, -7.4, 7.4, 6.2, 18), mS); A.add(K.discX(13.8, yl, 0, 1.2, -1, 10), mBuio());
    }
    const mL = scatolaInferiore(A, R, spec, { tinta: t, sigla: o.sigla, ponticello: o.ponticello, ambi: o.ambi, pittogrammi: o.pittogrammi, raffica: o.raffica, recinto: o.recinto });
    if (o.maniglia === 'fissa') manigliaFissa(A, R, mU, { yl });
    if (o.maniglia === 'staccabile') manigliaStaccabile(A, R, mU, { yl });
    // ---------------- impugnatura
    impugnatura(A, R.gx0, R.gx1, -37, { stile: o.impugnatura || 'dente', ang: 25, len: o.cal === 762 ? 92 : 88, prof: 1.12, tinta: o.impTinta, mat: o.impMat });
    // ---------------- calcio
    const yS = 17;
    if (o.calcio === 'fisso1' || o.calcio === 'fisso2' || o.calcio === 'marrone') {
      calcioFisso(A, -9, yS, { xb: o.xCalcio, mat: o.calcio === 'marrone' ? mPo('marrone') : null, quadro: o.calcio === 'fisso2', sportello: o.calcio !== 'marrone', alto: o.calcio === 'marrone' ? 118 : 124 });
    } else if (o.calcioLat) { // calcio pieghevole di lato, senza tubo (cerniera dietro la scatola)
      calcioLaterale(A, o.calcioLat, 0, o.xCalcio, { top: R.top, lhw: R.lhw }, { tinta: t, matCerniera: mL });
    } else if (o.calcio !== 'pieghevole') {
      const tl = o.tubo || 186; tuboCalcio(A, -2, tl, 14.5);
      if (o.calcio === 'carabina') calcioRetrattile(A, o.xCalcio, yS + 1, { mat: mPo(t) });
      else if (o.calcio === 'pesante') calcioPesante(A, o.xCalcio, yS + 2, { tinta: t });
      else if (o.calcio === 'regolabile') calcioRegolabile(A, o.xCalcio, yS + 2, { tinta: t });
    }
    if (o.calcio === 'pieghevole') { // calcio pieno in polimero ripiegabile sul lato destro, con cerniera dietro la scatola
      const mP = K.mat('polimero', null, { tile: 'grana', rep: [8, 4], r: .6, ns: .22 }), xb = o.xCalcio;
      A.add(K.slab([[-11, -30, 3], [-11, 14, 3], [-30, 15, 2], [-30, -32, 2]], -13, 13, { b: 2 }), mL);
      A.add(cilY(-22, 14.5, -30, 13, 3.4, 14), K.mat('nero'));
      calcioIncavato(A, [[xb, -112, 4], [xb + 20, -114, 8], [-30, -36, 6], [-30, 12, 3], [xb + 30, 14, 10], [xb, 14, 4]], [[xb + 24, -94, 8], [-52, -40, 8], [-52, 2, 4], [xb + 28, 3, 8]], 16, 6, mP, { b: 3.4 });
      A.add(K.slab([[xb - 8, -113, 3], [xb + 1, -113, 1], [xb + 1, 13, 2], [xb - 8, 12, 4]], -17, 17, { b: 2 }), K.mat('polimero', null, { tile: 'ribs', rep: [1, 10], r: .7 }));
      maglia(A, xb + 30, -104, 0, 0, 6.5);
    }
    // ---------------- canna, anello, guardamano, mirino
    const mBar = K.mat('nero', null, { r: .4 }), mD = mBuio(), hgx0 = R.L + 6;
    const rC = o.rCanna || 9.6;
    A.add(K.rod(R.L, xm, o.cal === 762 ? 10.6 : 8.4, { seg: 22 }), mBar);
    if (o.guardamano === 'triangolo' || o.guardamano === 'tondo' || o.guardamano === 'carabina') {
      A.add(K.latheX([[hgx0, 0], [hgx0, 22], [hgx0 + 2, 29.5], [hgx0 + 11, 30], [hgx0 + 13, 27.5], [hgx0 + 13, 0]], { seg: 32 }), K.mat('nero')); // anello a delta
      const x0 = hgx0 + 13, x1 = gas - 24;
      if (o.guardamano === 'triangolo') {
        const sec = (x) => { const u = (x - x0) / (x1 - x0), w = lin(26, 19.5, u), tt = lin(24, 18, u), bo = lin(-34, -24, u); return secPath([[0, bo, 7], [w, tt, 6], [-w, tt, 6]], 48); };
        A.add(sweepX(span(x0, x1, 10), sec), K.mat('polimero', null, { tile: 'grana', rep: [6, 3], r: .6, ns: .3 }));
        // fori di raffreddamento in fila lungo i fianchi alti
        for (let i = 0; i < 9; i++) { const u = (i + .8) / 10, xx = lin(x0, x1, u), w = lin(26, 19.5, u) - 4, yy = lin(24, 18, u) - 6; A.add(cilZ(xx, yy, -w - 2, w + 2, 2.6, 12), mD); }
      } else if (o.guardamano === 'tondo') {
        A.add(sweepX(span(x0, x1, 8), x => secRib(96, 26.5, 26, 16, 1.3, -3, { soglia: .1 }), { ang: 30 }), K.mat('polimero', null, { r: .6 }));
      } else {
        A.add(sweepX(span(x0, x1, 6), x => secRib(84, 27.5, 23.5, 12, 1.6, -4, { soglia: .15 }), { ang: 30 }), K.mat('polimero', null, { r: .6 }));
      }
      A.add(K.latheX([[x1 - 1, 0], [x1 - 1, 21], [x1 + 4, 21], [x1 + 6, 18], [x1 + 6, 0]], { seg: 28 }), K.mat('nero'));
      mirinoTriangolo(A, gas, yl, 9.4, {});
    } else if (o.guardamano === 'quattro') {
      const x1 = o.hgFine || gas + 30;
      guardamanoQuattro(A, R, hgx0, x1, { tinta: t });
      mirinoRibaltabile(A, x1 - 16, R.top + 9.4, yl, {});
      A.add(K.latheX([[x1 - 40, 0], [x1 - 40, 12], [x1 - 10, 12], [x1 - 10, 0]], { seg: 20 }), mBar);
    } else if (o.guardamano === 'tubo') {
      const x1 = o.hgFine || R.L + 360;
      A.add(K.latheX([[hgx0, 0], [hgx0, 20], [hgx0 + 2, 26], [x1 - 3, 26], [x1, 23], [x1, 0]], { seg: 40 }), mAl(t, null, { r: .45 }));
      A.add(K.latheX([[hgx0 - 2, 0], [hgx0 - 2, 22], [hgx0 + 10, 22], [hgx0 + 10, 0]], { seg: 32 }), K.mat('nero', null, { tile: 'knurl', rep: [16, 1] }));
      for (let i = 0; i < 10; i++) A.add(K.box(hgx0 + 30 + i * 22, -1.2, -26.6, hgx0 + 42 + i * 22, 1.2, 26.6, .5), mD);
      A.add(K.slab([[x1 - 40, -24, 1], [x1 - 22, -24, 1], [x1 - 24, -34, 2], [x1 - 38, -34, 2]], -5, 5, { b: .8 }), K.mat('nero'));
    } else if (o.guardamano === 'marrone') {
      const x0 = hgx0, x1 = gas - 20, mH = mPo('marrone', null, { tile: 'grana', rep: [5, 2], ns: .3 });
      A.add(K.latheX([[x0 - 2, 0], [x0 - 2, 22], [x0 + 8, 24], [x0 + 8, 0]], { seg: 28 }), K.mat('grigio'));
      A.add(sweepX(span(x0 + 8, x1, 10), x => { const u = (x - x0) / (x1 - x0); return secRib(80, lin(27, 22, u), lin(26, 21, u), 10, 1.1, -3, { soglia: -.3 }); }, { ang: 30 }), mH);
      for (let i = 0; i < 7; i++) for (const s of [-1, 1]) A.add(K.box(x0 + 30 + i * 30, 8 * s - 2, -26, x0 + 44 + i * 30, 8 * s + 2, 26, .6), mD);
      A.add(K.latheX([[x1, 0], [x1, 21], [x1 + 6, 21], [x1 + 8, 17], [x1 + 8, 0]], { seg: 28 }), K.mat('grigio'));
    }
    if (o.guardamano === 'fessure') { // guardamano lungo in alluminio a fessure, con slitta continua sopra
      const x1 = o.hgFine;
      A.add(K.latheX([[hgx0 - 4, 0], [hgx0 - 4, 16.5], [hgx0 + 4, 16.5], [hgx0 + 4, 0]], { seg: 26 }), mU);
      guardamanoFessure(A, hgx0, x1, Object.assign({ tinta: t, ht: R.top, hb: 28, w: 18, yc: 0 }, o.hg || {}));
      C.put(A, slitta(hgx0 + 1, x1 - 1, R.top - .3, { mat: mU }));
      mirinoRibaltabile(A, x1 - 16, R.top + 9.4, yl, {});
    }
    if (o.manettaSx) { // leva di armamento fissa a sinistra, davanti (si aggiunge alla leva a T)
      const xh = R.L - 16, mS = K.mat('nero');
      A.add(K.slab([[xh - 40, 2, 2], [xh + 4, 2, 2], [xh + 6, 10, 2], [xh - 36, 10, 2]], -R.uhw - 2.4, -R.uhw + .4, { b: .7 }), mS, 'manetta');
      A.add(K.slab([[xh - 4, 0, 2], [xh + 6, 0, 2], [xh + 8, 14, 3], [xh - 2, 15, 3]], -R.uhw - 12, -R.uhw - 2, { b: 1.2 }), mS, 'manetta');
      A.pivot('manetta', [xh, 6, -R.uhw]);
    }
    if (o.guardamano === 'fori') { // guardamano tondo in polimero con file di fori, anelli d'acciaio alle estremità
      const x0 = hgx0, x1 = gas - 26, mH = K.mat('polimero', null, { r: .62 });
      A.add(K.latheX([[x0 - 2, 0], [x0 - 2, 20], [x0 + 8, 21], [x0 + 8, 0]], { seg: 28 }), K.mat('nero'));
      A.add(sweepX(span(x0 + 8, x1, 6), x => secRib(72, 25.5, 24.5, 6, .9, -2, { soglia: -.6 }), { ang: 34 }), mH);
      for (let i = 0; i < 6; i++) for (const yy of [8, -10]) A.add(cilZ(x0 + 30 + i * (x1 - x0 - 50) / 5, yy, -26, 26, 3.2, 12), mD);
      A.add(K.latheX([[x1, 0], [x1, 21], [x1 + 7, 21], [x1 + 9, 17], [x1 + 9, 0]], { seg: 28 }), K.mat('nero'));
    }
    if (o.mirino === 'anello') { // blocco del gas con mirino protetto da un anello
      const mS = K.mat('parker');
      A.add(K.slab([[gas - 16, -15, 3], [gas + 16, -15, 3], [gas + 16, 14, 3], [gas - 16, 14, 3]], -12, 12, { b: 2 }), mS);
      A.add(K.slab([[gas - 8, 12, 0], [gas + 10, 12, 0], [gas + 6, yl - 12, 3], [gas - 5, yl - 12, 3]], -5, 5, { b: 1 }), mS);
      A.add(K.latheX([[gas - 6, 7.4], [gas - 6, 9.6], [gas + 8, 9.6], [gas + 8, 7.4]], { seg: 24, cy: yl - 3 }), mS);
      A.add(K.slab([[gas - .5, yl - 11, .3], [gas + 2.5, yl - 11, .3], [gas + 2, yl, .3], [gas, yl, .3]], -1.2, 1.2, { b: .2 }), K.mat('nero'));
      A.add(K.box(gas + 8, -24, -4, gas + 18, -14, 4, 1), mS); maglia(A, gas - 8, -22, 0, 0, 6.5);
    }
    if (o.mirinoAlto) { // mirino alto sul blocco del gas (calibro pieno, prima serie)
      const mS = K.mat('grigio', null, { c: '#45474a' });
      A.add(K.slab([[gas - 14, -14, 3], [gas + 14, -14, 3], [gas + 14, 12, 2], [gas - 14, 12, 2]], -12, 12, { b: 2 }), mS);
      A.add(K.slab([[gas - 6, 10, 0], [gas + 8, 10, 0], [gas + 4, yl - 4, 2], [gas - 3, yl - 4, 2]], -4.5, 4.5, { b: 1 }), mS);
      A.add(K.slab([[gas - 1, yl - 6, .3], [gas + 2, yl - 6, .3], [gas + 1.5, yl, .3], [gas - .5, yl, .3]], -1.2, 1.2, { b: .2 }), K.mat('nero'));
    }
    // ---------------- bocca
    const rb = o.cal === 762 ? 10.6 : 8.4; let xe = xm;
    if (o.bocca === 'gabbia_aperta') { gabbiaAperta(A, xm - 12, 11, 52); xe = xm + 40; }
    else if (o.bocca === 'gabbia') { C.put(A, C.muzzle('gabbia', xm - 10, 11, { len: 56 })); xe = xm + 46; }
    else if (o.bocca === 'tromba') { freno_tromba(A, xm - 8, 10, 62); xe = xm + 54; }
    else if (o.bocca === 'freno') { C.put(A, C.muzzle('freno', xm - 8, 13, { len: 68, ch: 3 })); xe = xm + 60; }
    else if (o.bocca === 'obliquo') { compensatoreObliquo(A, xm - 8, 11.5, 50); xe = xm + 42; }
    else if (o.bocca === 'tre') { trePunte(A, xm - 10, o.cal === 762 ? 13 : 11.5, 56); xe = xm + 46; }
    else { A.add(K.latheX([[xm - 3, rb], [xm, rb - .8], [xm, 0]], { seg: 22 }), mBar); }
    A.add(K.discX(xe + .1, 0, 0, 3.2, 1, 12), mD);
    // ---------------- ottiche, bipiede
    let yo = null, xo = 24; // xo = oculare (o tacca di mira)
    if (o.ottica === 'compatta') { yo = otticaCompatta(A, 18, R.top + 9.4, { tinta: 'nera' }); xo = 4; }
    if (o.ottica === 'cannocchiale') xo = -26; if (o.ottica === 'grande') xo = -40;
    if (o.ottica === 'cannocchiale') { const y = R.top + 9.4 + 30; C.put(A, C.scope({ x0: -26, x1: 300, y, rt: 15, ro: 26, re: 20, yb: R.top + 9.4, rings: [40, 150] })); yo = y; }
    if (o.ottica === 'grande') { const y = R.top + 9.4 + 34; C.put(A, C.scope({ x0: -40, x1: 320, y, rt: 17, ro: 29, re: 21, yb: R.top + 9.4, rings: [36, 156] })); yo = y; }
    if (o.mireRib) { diottraRibaltabile(A, 14, R.top + 9.4, yl, {}); }
    if (o.bipiede) { C.put(A, C.bipod(o.xBip || gas - 40, o.yBip || -30, { len: 230, open: true }), 'bipiede'); A.pivot('bipiede', [o.xBip || gas - 40, o.yBip || -30, 0]); }
    // ---------------- caricatore
    const cm = o.caricatore || {};
    const top = [R.mw0 + (R.mw1 - R.mw0) / 2 + .5, R.bot + 2];
    caricatore(A, top, Object.assign({ len: 182, d0: R.magD[0], d1: R.magD[1], w: R.magW, ang: .02, dritto: .42, raggio: 330, tipo: 'alluminio' }, cm));
    A.pivot('caricatore', [top[0], R.mwBot, 0]);
    // ---------------- punti di riferimento
    A.anchor('bocca', [xe + .5, 0, 0]); A.anchor('espulsione', [(R.port[0] + R.port[1]) / 2, 4, R.uhw + 1], [0, .35, 1]);
    A.anchor('impugnatura', [R.gx0 - 4, -72, 0]); A.anchor('grilletto', [R.tx - 1, -42, 0]);
    A.anchor('appoggio', [o.xAppoggio || (R.L + 120), -34, -8]);
    A.anchor('mira_post', [xo, yo || yl, 0]); A.anchor('mira_ant', [o.guardamano === 'quattro' || o.guardamano === 'fessure' ? (o.hgFine || gas + 30) - 16 : gas, yl, 0]);
    A.anchor('calcio', [o.xCalcio - 8, -40, 0]); if (yo) A.anchor('ottica', [xo, yo, 0]);
    const r = A.done();
    r.info = { azione: 'auto', bossolo: o.cal === 762 ? 'fucile_lungo' : 'fucile', ciclo: { otturatore: { dx: -(o.cal === 762 ? .1 : .085) }, grilletto: { rz: -.16 } }, ricarica: { caricatore: { dy: -.2, dx: .004 } }, armamento: { manetta: { dx: -.07 } } };
    if (o.semi) r.info.azione = 'semi';
    return r;
  };

  // guardamano a quattro slitte flottante (anima quadrata raccordata con quattro slitte)
  function guardamanoQuattro(A, R, x0, x1, o) {
    const m = mAl(o.tinta, null, { r: .5 }), h = R.top;
    A.add(sweepX([x0, x1], () => secSE(40, h - .5, h - .5, h - .5, 7, 7), { ang: 40 }), m);
    C.put(A, slitta(x0 + 1, x1 - 1, h - .6, { mat: m }));
    for (const d of ['dx', 'sx', 'giu']) C.put(A, slitta(x0 + 26, x1 - 4, h - .6, { dir: d, mat: m }));
    // feritoie di raffreddamento fra le slitte
    const mD = mBuio();
    for (let i = 0; i < Math.floor((x1 - x0 - 40) / 26); i++) for (const a of [PI / 4, 3 * PI / 4, 5 * PI / 4, 7 * PI / 4]) { const g = K.box(x0 + 30 + i * 26, -2.2, -5, x0 + 44 + i * 26, 2.2, 5, 1); g.translate(0, h * 1.02, 0); g.applyMatrix4(new THREE.Matrix4().makeRotationX(a - PI / 2)); A.add(g, mD); }
    A.add(K.latheX([[x0 - 3, 0], [x0 - 3, 19], [x0 + 6, 19], [x0 + 6, 0]], { seg: 28 }), m);
  }
  // calcio pesante a sei posizioni (forma squadrata con vano, calciolo spesso in gomma)
  function calcioPesante(A, xb, yt, o) {
    const L = 182, H = 124, m = mPo(o.tinta), bb = [xb - 14, yt - H - 4, xb + L + 4, yt + 4];
    const p = K.painter(bb, { w: 1024, h: 512, rough: .66 });
    p.fill('LR', [[xb + 30, yt - 24], [xb + L - 30, yt - 18], [xb + L - 40, yt - 36], [xb + 40, yt - 58]], { h: -.35, a: .9 });
    p.line('LR', [[xb + 20, yt - H + 30], [xb + L - 24, -30]], .6, { h: -.6, a: .8 });
    p.wallFill({ r: .72 }); p.noise({ a: .06, r: .1, seed: 9 });
    const mm = K.mat((TINTE[o.tinta] || TINTE.nera).po[0], p.done(2.2), { ns: .8 });
    const path = [[xb, yt - H, 4], [xb + 14, yt - H + 1, 6], [xb + L - 20, -28, 10], [xb + L, -20, 4], [xb + L, yt - 2, 3], [xb + 36, yt + 3, 10], [xb, yt + 1, 5]];
    A.add(K.slab(path, -19, 19, { b: 4, bs: 4, uv: bb }), mm);
    A.add(K.slab([[xb - 13, yt - H - 2, 4], [xb + 1, yt - H, 2], [xb + 1, yt, 2], [xb - 13, yt - 2, 5]], -20, 20, { b: 3 }), K.mat('gomma'));
    A.add(K.slab([[xb + L - 50, -24, 2], [xb + L - 8, -22, 2], [xb + L - 12, -31, 2], [xb + L - 46, -30, 3]], -4.5, 4.5, { b: .8 }), K.mat('nero'));
    maglia(A, xb + 8, yt - H + 10, 0, 0, 6);
  }
  // calcio regolabile di precisione: guanciale con pomello, calciolo regolabile, tubo inferiore
  function calcioRegolabile(A, xb, yt, o) {
    const L = 200, H = 128, mm = mPo(o.tinta, null, { r: .6 }), mA = K.mat('anod'), mk = K.mat('nero', null, { tile: 'knurl', rep: [6, 1] });
    calcioIncavato(A, [[xb, yt - H, 4], [xb + 22, yt - H + 2, 8], [xb + L - 26, -30, 10], [xb + L, -22, 4], [xb + L, yt - 8, 3], [xb, yt - 8, 3]], [[xb + 20, yt - H + 22, 8], [xb + L - 44, -32, 8], [xb + L - 44, yt - 24, 4], [xb + 20, yt - 24, 6]], 18, 7, mm, { b: 4 });
    // guanciale regolabile su due colonnine, con pomello di bloccaggio
    A.add(K.slab([[xb + 22, yt + 3, 3], [xb + L - 34, yt + 3, 3], [xb + L - 44, yt + 17, 8], [xb + 30, yt + 19, 6]], -16, 16, { b: 4 }), mm);
    for (const x of [xb + 56, xb + 124]) A.add(cilY(x, 0, yt - 10, yt + 4, 4.2, 14), mA);
    A.add(cilZ(xb + 90, yt - 4, -24, -18, 6.5, 18), mk);
    // calciolo regolabile in altezza su due aste, monopiede posteriore
    A.add(K.slab([[xb - 18, yt - H - 6, 4], [xb - 6, yt - H - 4, 2], [xb - 6, yt - 4, 2], [xb - 18, yt - 6, 5]], -20, 20, { b: 3 }), K.mat('gomma'));
    for (const y of [yt - 28, yt - H + 26]) A.add(K.rod(xb - 7, xb + 3, 4.2, { cy: y, seg: 12 }), mA);
    A.add(cilZ(xb - 2, yt - H * .5, -22, -18, 5.5, 16), mk);
    A.add(K.slab([[xb + 30, yt - H - 2, 1], [xb + 40, yt - H - 2, 1], [xb + 40, yt - H - 22, 3], [xb + 32, yt - H - 22, 3]], -6, 6, { b: 1.2 }), mA);
    A.add(K.latheX([[0, 0], [0, 7], [2, 8], [6, 8], [6, 0]], { seg: 16 }).rotateZ(-PI / 2).translate(xb + 35, yt - H - 22, 0), K.mat('gomma'));
  }

  // ---------------- voci del catalogo: famiglia a scatola
  // fucile d'assalto di prima serie: maniglia fissa, guardamano triangolare, calcio fisso, gabbia aperta, aiuto a goccia
  MAP2[67] = { f: 'fucile_scatola', o: { canna: 508, gas: 'fucile', maniglia: 'fissa', guardamano: 'triangolo', calcio: 'fisso1', xCalcio: -300, impugnatura: 'liscia', bocca: 'gabbia_aperta', assist: 'goccia', deflettore: false, recinto: false, caricatore: { tipo: 'alluminio' }, xAppoggio: 340 } };
  // carabina: slitta piatta con maniglia staccabile, guardamano tondo nervato corto, calcio retrattile, deflettore
  MAP2[74] = { f: 'fucile_scatola', o: { canna: 368, gas: 'carabina', maniglia: 'staccabile', guardamano: 'carabina', calcio: 'carabina', xCalcio: -284, tubo: 186, impugnatura: 'dente', bocca: 'gabbia', assist: 'tondo', deflettore: true, raffica: 'BURST', caricatore: { tipo: 'alluminio' }, xAppoggio: 280 } };
  // carabina a pistone con guardamano a quattro slitte, mire ribaltabili, calcio pesante
  MAP2[81] = { f: 'fucile_scatola', o: { canna: 368, gas: 'carabina', guardamano: 'quattro', hgFine: 446, calcio: 'pesante', xCalcio: -306, tubo: 236, impugnatura: 'ergo', bocca: 'gabbia', assist: 'tondo', deflettore: true, ponticello: 'largo', ambi: true, pittogrammi: true, mireRib: true, caricatore: { tipo: 'acciaio' }, xAppoggio: 320 } };
  // fucile automatico di squadra: come sopra, canna più lunga, ottica compatta e bipiede
  MAP2[147] = { f: 'fucile_scatola', o: { canna: 419, gas: 'medio', guardamano: 'quattro', hgFine: 470, calcio: 'pesante', xCalcio: -300, tubo: 236, impugnatura: 'ergo', bocca: 'gabbia', assist: 'tondo', deflettore: true, ponticello: 'largo', ambi: true, pittogrammi: true, ottica: 'compatta', bipiede: true, xBip: 430, yBip: -31, caricatore: { tipo: 'polimero', c: '#2a2c2e' }, xAppoggio: 340 } };
  // calibro pieno a pistone: scatola più grande, caricatore traslucido diritto
  MAP2[101] = { f: 'fucile_scatola', o: { cal: 762, canna: 419, gas: 'medio', guardamano: 'quattro', hgFine: 500, calcio: 'pesante', xCalcio: -310, tubo: 236, impugnatura: 'ergo', bocca: 'gabbia', assist: 'tondo', deflettore: true, ponticello: 'largo', ambi: true, pittogrammi: true, mireRib: true, caricatore: { tipo: 'trasparente', len: 150, raggio: 0, d0: 76, d1: 78, w: 13, c: '#3c3a34' }, xAppoggio: 360 } };
  // calibro pieno di precisione: tubo flottante liscio, canna pesante, cannocchiale e bipiede, calcio fisso lungo
  MAP2[113] = { f: 'fucile_scatola', o: { cal: 762, canna: 610, gas: 'fucile', guardamano: 'tubo', hgFine: 560, calcio: 'fisso2', xCalcio: -330, impugnatura: 'dente', bocca: 'liscia', assist: 'tondo', deflettore: true, ottica: 'cannocchiale', bipiede: true, xBip: 520, yBip: -27, semi: true, caricatore: { tipo: 'acciaio', len: 150, raggio: 0, d0: 76, d1: 78, w: 13 }, xAppoggio: 380 } };
  // calibro pieno di precisione color sabbia: quattro slitte lunghe, calcio regolabile, cannocchiale grande, freno
  MAP2[118] = { f: 'fucile_scatola', o: { cal: 762, canna: 419, gas: 'medio', guardamano: 'quattro', hgFine: 540, calcio: 'regolabile', xCalcio: -360, tubo: 236, impugnatura: 'ergo', bocca: 'freno', assist: 'tondo', deflettore: true, ponticello: 'largo', ambi: true, pittogrammi: true, ottica: 'grande', bipiede: true, xBip: 500, yBip: -31, semi: true, tinta: 'sabbia', caricatore: { tipo: 'polimero', len: 120, raggio: 0, d0: 76, d1: 77, w: 13, c: '#1e1f20' }, xAppoggio: 380 } };
  // fucile a pistone con manetta a destra: guardamano a fori, tacca a tamburo, mirino ad anello, calcio pieghevole pieno
  MAP2[76] = { f: 'fucile_scatola', o: { canna: 465, gas: 'fucile', guardamano: 'fori', mirino: 'anello', diottraTamburo: true, yl: 46, senzaSlitta: true, manettaDx: true, calcio: 'pieghevole', xCalcio: -300, impugnatura: 'dente', bocca: 'obliquo', assist: null, deflettore: true, raffica: 'BURST', caricatore: { tipo: 'alluminio' }, xAppoggio: 330 } };
  // americano a scatola inferiore compatibile: guardamano tondo sottile a fessure, calcio scheletrato pieghevole senza tubo, leva a T
  MAP2[87] = { f: 'fucile_scatola', o: { canna: 406, gas: 'medio', guardamano: 'fessure', hgFine: 470, hg: { ht: 21, hb: 24, w: 17, e: 2.4, lf: 26, gap: 14, file: [PI / 2, -PI / 2, PI] }, calcioLat: 'scheletro', xCalcio: -310, impugnatura: 'dente', bocca: 'tre', assist: null, deflettore: true, mireRib: true, caricatore: { tipo: 'polimero', c: '#202224' }, xAppoggio: 330 } };
  // americano a grande calibro color coyote: guardamano lungo, calcio pieghevole con guanciale, due leve di armamento
  MAP2[89] = { f: 'fucile_scatola', o: { cal: 762, canna: 368, gas: 'carabina', guardamano: 'fessure', hgFine: 500, hg: { ht: 22, hb: 30, w: 19, e: 3, lf: 30, file: [PI / 2, -PI / 2, PI, PI * .75, -PI * .75] }, calcioLat: 'monolitico', xCalcio: -320, impugnatura: 'dita', impTinta: 'coyote', bocca: 'tre', assist: null, deflettore: true, manettaSx: true, ponticello: 'largo', ambi: true, mireRib: true, caricatore: { tipo: 'polimero', len: 146, raggio: 0, d0: 76, d1: 78, w: 12.8, c: '#2a2620' }, xAppoggio: 360 } };
  // calibro pieno di prima serie: mobili marroni, maniglia con leva di armamento interna, freno a tromba, mirino alto
  MAP2[96] = { f: 'fucile_scatola', o: { cal: 762, canna: 508, gas: 'fucile', maniglia: 'fissa', levaManiglia: true, guardamano: 'marrone', calcio: 'marrone', xCalcio: -320, impugnatura: 'liscia', impTinta: 'marrone', bocca: 'tromba', assist: null, deflettore: false, recinto: false, mirinoAlto: true, caricatore: { tipo: 'acciaio', len: 140, raggio: 0, d0: 76, d1: 78, w: 13 }, xAppoggio: 360 } };

  // ====================================================================================== FUCILI MODULARI
  // distanza dal centro al bordo di una sezione superellittica nella direzione th (th = 0 sopra, PI/2 destra)
  const raggioSE = (h, w, e, th) => { const cy = Math.abs(Math.cos(th)), sz = Math.abs(Math.sin(th)); return Math.pow(Math.pow(cy / h, e) + Math.pow(sz / w, e), -1 / e); };
  // feritoia scura sulla superficie di un guardamano: rettangolo lungo X ruotato di th attorno all'asse (yc)
  function feritoia(A, x0, x1, r, th, lar, yc, m) {
    const g = K.box(x0, r - 2.6, -lar / 2, x1, r + .25, lar / 2, Math.min(1.6, lar * .3));
    g.applyMatrix4(new THREE.Matrix4().makeRotationX(th)); g.translate(0, yc || 0, 0); A.add(g, m || mBuio());
  }
  // guardamano a fessure (alluminio): sezione superellittica, file di feritoie, anello anteriore, eventuale becco
  function guardamanoFessure(A, x0, x1, o) {
    const m = o.mat || mAl(o.tinta, null, { r: .48 }), e = o.e || 3.2, yc = o.yc || 0, ht = o.ht, hb = o.hb, w = o.w;
    const sec = x => { const u = o.becco ? Math.max(0, (x - (x1 - o.becco)) / o.becco) : 0; return secSE(48, ht, hb * (1 - u * .62), w * (1 - u * .1), e, e, yc + hb * u * .31, 0); };
    const xs = o.becco ? span(x0, x1 - o.becco, 2).concat(span(x1 - o.becco, x1, 5).slice(1)) : [x0, x1];
    A.add(sweepX(xs, sec, { ang: 38 }), m);
    // feritoie: file lungo i lati (th = PI/2 destra, -PI/2 sinistra, PI sotto, diagonali)
    const L = o.lf || 30, gap = o.gap || 12, x1f = x1 - (o.becco || 0) - 14;
    for (const th of o.file || [PI / 2, -PI / 2, PI]) {
      const r = raggioSE(th === PI ? hb : ht, w, e, th);
      for (let x = x0 + (o.inizio || 26); x + L < x1f; x += L + gap) feritoia(A, x, x + L, r, th, o.lar || 7, yc, null);
    }
    return m;
  }
  // rompifiamma a tre punte (forcelle aperte)
  function trePunte(A, x0, r, len, m) {
    m = m || K.mat('parker', null, { r: .5 }); const mD = mBuio();
    A.add(K.latheX([[x0, 0], [x0, r - .6], [x0 + 1, r], [x0 + 14, r], [x0 + 14, r - 1.4]], { seg: 26 }), m);
    A.add(K.tube(x0 + 13, x0 + 22, r - .8, r - 3.6, { seg: 24 }), m);
    for (let i = 0; i < 3; i++) { const g = K.box(x0 + 20, -2.2, -2.6, x0 + len, 2.2, 2.6, .8); g.translate(0, r - 2.4, 0); g.applyMatrix4(new THREE.Matrix4().makeRotationX(i * 2 * PI / 3)); A.add(g, m); }
    A.add(K.discX(x0 + 22.1, 0, 0, r - 3.6, 1, 18), mD);
  }
  // rompifiamma a quattro punte
  function quattroPunte(A, x0, r, len, m) {
    m = m || K.mat('parker', null, { r: .5 });
    A.add(K.latheX([[x0, 0], [x0, r - .6], [x0 + 1, r], [x0 + 16, r], [x0 + 16, r - 1.4]], { seg: 26 }), m);
    for (let i = 0; i < 4; i++) { const g = K.box(x0 + 15, -1.8, -2.4, x0 + len, 1.8, 2.4, .7); g.translate(0, r - 2, 0); g.applyMatrix4(new THREE.Matrix4().makeRotationX(i * PI / 2 + PI / 4)); A.add(g, m); }
    A.add(K.discX(x0 + 16.1, 0, 0, r - 3.4, 1, 18), mBuio());
  }

  // scatola inferiore in polimero (o alluminio) con cerniera del calcio dietro, ponticello integrato, pozzetto, comandi
  function inferioreModulare(A, D, spec, o) {
    const bb = [-18, D.mwBot - 3, D.Lb + 3, D.bot + 2];
    const p = K.painter(bb, { w: 1024, h: 512, rough: o.metallo ? .5 : .66 });
    const sx = D.gx0 + 16, sy = -24;
    p.text('L', maiusc(spec.produttore), (D.mw0 + D.mw1) / 2, -34, 3, { spacing: 2 });
    p.text('L', maiusc(spec.nome), (D.mw0 + D.mw1) / 2, -41, 3.4, { spacing: 2 });
    p.text('L', String(spec.calibro || '').replace(' mm', ''), (D.mw0 + D.mw1) / 2, -48, 2.6);
    p.text('R', matricola(spec), (D.mw0 + D.mw1) / 2, -40, 2.4);
    for (const s of ['L', 'R']) { p.fill(s, K.rrect(sx + 9, sy - 1, sx + 12, sy + 1, .5), { h: -.6, a: .9 }); p.fill(s, K.rrect(sx - 12, sy - 1, sx - 9, sy + 1, .5), { h: -.6, a: 1.5 }); p.text(s, 'S', sx + 10.5, sy + 6, 2.4); p.text(s, 'F', sx - 10.5, sy + 6, 2.4); }
    for (const [x, y] of [[D.gx1 + 8, -22], [D.Lb - 10, D.bot - 6], [-8, -22]]) p.pin('LR', x, y, 2.2, { h: .4, a: 1.06 });
    if (o.puntinato) p.stipple('LR', [[D.mw0 + 4, -52], [D.mw1 - 4, -52], [D.mw1 - 4, D.mwBot + 6], [D.mw0 + 4, D.mwBot + 6]], { s: .3, r: .86 });
    p.wallFill({ r: o.metallo ? .5 : .7 }); p.noise({ a: .08, r: .12, seed: 13 });
    const m = o.metallo ? mAl(o.tinta, p.done(2.2), { ns: .8 }) : mPo(o.tinta, p.done(2.2), { ns: .8 });
    const B = D.bot, tg = [[D.gx1 + 4, -38, 3], [D.mw0 - 6, -38, 3], [D.mw0 - 6, -51, 3], [D.gx1 + 9, -51, 4], [D.gx1 + 3, -44, 2]];
    const body = [[-6, B, 0, .5], [D.Lb, B, 0, .5], [D.Lb, B - 7, 6], [D.mw1 + 3, -34, 4], [D.mw0 - 1, -34, 0], [D.mw0 - 1, -50, 3], [D.mw0 - 8, -58, 5], [D.gx1 + 7, -58, 6], [D.gx1 - 2, -46, 3], [D.gx0 - 4, -44, 4], [-6, -40, 5]];
    A.add(K.slab(body, -D.lhw, D.lhw, { b: o.metallo ? 1.6 : 2.4, holes: [tg], uv: bb }), m);
    const mw = [[D.mw0 - 2, -26, 4], [D.mw1 + 3, -26, 6], [D.mw1 + 4, -32, 5], [D.mw1 + 1.5, D.mwBot + 9, 3], [D.mw1 + 6, D.mwBot, 2], [D.mw0 - 4, D.mwBot, 2], [D.mw0 - 2, -44, 2]];
    A.add(K.slab(mw, -D.mwHw, D.mwHw, { b: o.metallo ? 1.4 : 2.6, bs: 4, uv: bb }), m);
    // comandi ambidestri: selettore, sgancio del caricatore, arresto dell'otturatore
    const mS = K.mat('nero');
    const sel = z0 => K.slab([['a', sx, sy, 5, PI * .5, PI * 1.5], [sx + 4, sy - 3.2, 1], [sx + 14, sy - 1.6, 1.4], [sx + 14.5, sy + 1.4, 1.4], [sx + 4, sy + 3.2, 1]], z0, z0 + 2.4, { b: .7 });
    A.add(sel(-D.lhw - 2.2), mS); A.add(sel(D.lhw - .2), mS);
    A.add(cilZ(D.mw0 + 2, -30, D.mwHw - .5, D.mwHw + 2, 4.2, 16), mS);
    A.add(K.slab([[D.mw0 - 4, -18, 1.5], [D.mw0 + 12, -18, 1.5], [D.mw0 + 12, -23, 1.5], [D.mw0 - 2, -25, 2]], -D.mwHw - 1.8, -D.mwHw + .4, { b: .5 }), mS);
    // leva di sgancio a paletta davanti al ponticello
    A.add(K.slab([[D.mw0 - 7, -44, 1], [D.mw0 - 1, -44, 1], [D.mw0 - 1, -50, 1], [D.mw0 - 6, -49, 1]], -5, 5, { b: .6 }), mS);
    // grilletto
    A.add(K.slab([[D.tx - 2, -31, 1], [D.tx + 2.5, -32, 2], [D.tx + 1.5, -40, 6], [D.tx - 1.5, -48.5, 1.2], [D.tx - 4.5, -48, 1], [D.tx - 2, -40, 6], [D.tx - 3, -32, 1]], -3.2, 3.2, { b: .7 }), K.mat('nero'), 'grilletto');
    A.pivot('grilletto', [D.tx, -28, 0]);
    return m;
  }

  // calci pieghevoli di lato: forma secondo la variante; xh = cerniera (retro della scatola), xb = retro del calciolo
  function calcioLaterale(A, tipo, xh, xb, D, o) {
    const mP = o.mat || mPo(o.tinta), mG = K.mat('gomma'), mS = K.mat('nero'), top = D.top;
    // blocco della cerniera (la cerniera è sul lato destro: il calcio si piega verso destra)
    A.add(K.slab([[xh - 16, -38, 3], [xh, -38, 0], [xh, top - 2, 0], [xh - 16, top - 4, 3]], -D.lhw, D.lhw, { b: 1.6 }), o.matCerniera || K.mat('anod'));
    A.add(cilY(xh - 9, D.lhw + 2.5, -34, top - 6, 3.2, 14), mS);
    if (tipo === 'monolitico') { // calcio telescopico a due guance, con guanciale regolabile e calciolo in gomma
      const m = mP;
      A.add(K.slab([[xh - 70, -30, 3], [xh - 14, -36, 3], [xh - 14, top - 4, 3], [xh - 70, top - 4, 3]], -10, 10, { b: 1.4 }), mS);
      calcioIncavato(A, [[xb, -104, 4], [xb + 26, -106, 8], [xh - 60, -32, 10], [xh - 56, top - 3, 4], [xb + 40, top, 6], [xb, top - 1, 4]], [[xb + 24, -84, 8], [xh - 78, -32, 8], [xh - 78, top - 14, 4], [xb + 22, top - 12, 6]], 17, 7, m, { b: 3.6 });
      A.add(K.slab([[xb + 30, top - 3, 2], [xh - 80, top - 3, 2], [xh - 90, top + 8, 6], [xb + 40, top + 9, 6]], -15, 15, { b: 3 }), mP);
      A.add(K.slab([[xb - 10, -106, 4], [xb + 1, -104, 2], [xb + 1, top - 2, 2], [xb - 10, top - 4, 5]], -18, 18, { b: 2.6 }), mG);
    } else if (tipo === 'scheletro') { // calcio scheletrato sottile (due aste e calciolo)
      const path = [[xb, -96, 3], [xb + 14, -98, 6], [xh - 16, -30, 6], [xh - 16, top - 6, 4], [xb + 10, top - 2, 6], [xb, top - 4, 3]];
      A.add(K.slab(path, -8, 8, { b: 2, holes: [[[xb + 16, -78, 6], [xh - 34, -26, 8], [xh - 34, top - 15, 4], [xb + 16, top - 13, 6]]] }), mP);
      A.add(K.slab([[xb - 9, -98, 3], [xb + 2, -98, 2], [xb + 2, top - 3, 2], [xb - 9, top - 5, 4]], -16, 16, { b: 2.4 }), mG);
    } else if (tipo === 'triangolo') { // calcio angolare con finestra triangolare, guanciale e calciolo regolabile
      const path = [[xb, -106, 3], [xb + 18, -108, 6], [xh - 16, -36, 8], [xh - 16, top - 3, 3], [xb + 20, top + 2, 6], [xb, top, 3]];
      A.add(K.slab(path, -14, 14, { b: 2.8, bs: 4, holes: [[[xb + 34, -80, 8], [xh - 48, -36, 8], [xh - 48, -6, 6], [xb + 34, -6, 8]]] }), mP);
      A.add(K.slab([[xb + 22, top - 2, 2], [xh - 50, top - 2, 2], [xh - 58, top + 9, 5], [xb + 30, top + 10, 5]], -13, 13, { b: 2.6 }), K.mat('polimero', null, { r: .6 }));
      A.add(K.slab([[xb - 11, -108, 3], [xb + 1, -106, 1], [xb + 1, top, 2], [xb - 11, top - 2, 4]], -16, 16, { b: 2.4 }), mG);
      A.add(cilZ(xb + 30, -40, -16, 16, 3.2, 12), mS);
    } else if (tipo === 'tubo') { // tubo pieghevole con calcio retrattile della carabina
      const L = xh - 16 - xb;
      A.add(K.rod(xh - 16 - Math.max(160, L - 40), xh - 16, 14, { seg: 22 }), K.mat('anod'));
      calcioRetrattile(A, xb + 9, top - 4, { kind: (TINTE[o.tinta] || TINTE.nera).po[0], len: 160, alto: 112 });
      if (o.guanciale) A.add(K.slab([[xb + 24, top - 5, 2], [xb + 130, top - 5, 2], [xb + 120, top + 8, 5], [xb + 32, top + 9, 5]], -14, 14, { b: 2.6 }), mP);
    } else if (tipo === 'telaio') { // calcio a telaio aperto (aste sopra e sotto) con aste di regolazione
      const path = [[xb, -100, 3], [xb + 16, -102, 6], [xh - 70, -34, 6], [xh - 70, top - 6, 4], [xb + 12, top - 1, 6], [xb, top - 3, 3]];
      A.add(K.slab(path, -12, 12, { b: 2.6, holes: [[[xb + 18, -80, 6], [xh - 88, -34, 6], [xh - 88, top - 16, 4], [xb + 18, top - 14, 6]]] }), mP);
      A.add(K.rod(xh - 74, xh - 16, 5, { cy: top - 12, seg: 14 }), K.mat('anod')); A.add(K.rod(xh - 74, xh - 16, 5, { cy: -26, seg: 14 }), K.mat('anod'));
      A.add(K.slab([[xb - 10, -102, 3], [xb + 1, -100, 1], [xb + 1, top - 2, 2], [xb - 10, top - 4, 4]], -16, 16, { b: 2.4 }), mG);
    }
    maglia(A, xb + 20, -90, 0, 0, 6);
  }

  // o = {var, grande, canna, Lr (scatola), hg1 (fine del guardamano o della scatola monolitica), calcio, xb, manetta, bocca, caricatore, tinta}
  FAM2.fucile_modulare = function (spec, o) {
    init(); o = o || {};
    const A = K.asm('fucile_modulare'), t = o.tinta || tinta(spec), v = o.var || 'monolitico';
    const big = !!o.grande, top = 21, bot = -14, uhw = big ? 15 : 14;
    const D = { top, bot, uhw, lhw: uhw - .6, mwHw: uhw + 1.4, mw0: big ? 132 : 140, gx0: 64, gx1: 98, tx: 113 };
    D.mw1 = D.mw0 + (big ? 86 : 66); D.mwBot = big ? -72 : -64; D.Lb = D.mw1 + 18;
    const bf = D.mw1 + 2, xm = bf + o.canna, mono = v === 'monolitico', Lr = mono ? o.hg1 : (o.Lr || 232), hg1 = o.hg1;
    const mD = mBuio(), mS = K.mat('nero'), port = [bf - 62, bf - 4];
    // ---------------- scatola superiore (alluminio): due metà, finestra di espulsione a destra
    const ub = [-2, bot - 2, Lr + 2, top + 2];
    const pU = K.painter(ub, { w: 1024, h: 512, rough: .5 });
    pU.text('L', maiusc(spec.produttore) + '  ' + maiusc(spec.nome), port[0] + 20, 6, 3, { spacing: 2 });
    pU.line('R', K.rrect(port[0] - 1.2, -6.2, port[1] + 1.2, 12.2, 3.5), .5, { h: -.5, a: .85 }, true);
    for (const x of [24, Lr - 30]) pU.pin('LR', x, -6, 2, { h: .4, a: 1.06 });
    if (mono) { pU.line('LR', [[D.Lb + 6, bot + 3], [hg1 - 10, bot + 3]], .5, { h: -.5, a: .85 }); for (let x = D.Lb + 40; x < hg1 - 60; x += 46) pU.pin('LR', x, -2, 2.3, { h: .35, a: 1.05 }); }
    pU.noise({ a: .12, r: .18, seed: 21 }); pU.walls({ r: .5 });
    const mU = mAl(t, pU.done(2.3), { ns: .8 });
    const uo = [[0, bot, 1.5, .4], [Lr, bot, 1.5, .4], [Lr, top, 3, 1], [0, top, 2.5, 1]];
    A.add(K.slab(uo, -uhw, 0, { bL: 2.2, bR: 0, uv: ub }), mU);
    A.add(K.slab(uo, 0, uhw, { bL: 0, bR: 2.2, uv: ub, holes: [K.rrect(port[0], -5, port[1], 11, 3)] }), mU);
    A.add(K.box(port[0], -5, -1, port[1], 11, .2, 0), mD);
    C.put(A, slitta(1, hg1 - 1, top - .3, { mat: mU }));
    A.add(K.slab([[port[0] - 12, top - 1, 2], [port[0] - .5, top - 1, 0], [port[0] - .5, -1, 3], [port[0] - 5, -3, 4]], uhw - 1, uhw + 4.6, { b: 1.2 }), mU);
    if ((o.manetta || 'sx') === 'sx' && !mono) A.add(K.box(port[0] - 30, 4.4, -uhw - .4, port[1] + 70, 7.6, -uhw + .3, .3), mD);
    // gruppo otturatore visibile nella finestra
    A.add(K.rod(port[0] - 30, bf - 6, 12.2, { seg: 22 }), K.mat('parker', null, { r: .42 }), 'otturatore');
    A.add(K.rod(bf - 6.5, bf, 9.2, { seg: 18 }), K.mat('grigio', null, { r: .38 }), 'otturatore');
    A.pivot('otturatore', [bf, 0, 0]);
    // ---------------- guardamano
    if (mono) { // parte bassa in polimero sotto la scatola monolitica, slitte laterali corte e slitta inferiore
      const mPoH = mPo(t, null, { r: .62 });
      A.add(K.slab([[D.Lb - 4, bot + 1, 0], [hg1 - 3, bot + 1, 0], [hg1 - 3, bot - 11, 5], [hg1 - 18, bot - 17, 6], [D.Lb + 12, bot - 17, 6], [D.Lb - 4, bot - 8, 4]], -uhw + .8, uhw - .8, { b: 2.4 }), mPoH);
      C.put(A, slitta(D.Lb + 26, hg1 - 22, -(bot - 17) - .3, { dir: 'giu', mat: mU }));
      for (const d of ['dx', 'sx']) C.put(A, slitta(hg1 - 150, hg1 - 6, uhw - .3, { dir: d, mat: mU }));
      // costola lungo il fianco sinistro (guida della leva di armamento)
      A.add(K.slab([[30, 1, 1], [hg1 - 160, 1, 1], [hg1 - 160, 11, 1], [30, 11, 1]], -uhw - 1.4, -uhw + .5, { b: .6 }), mU);
      A.add(K.box(port[0] - 30, 4.4, -uhw - 1.6, port[1] + 70, 7.6, -uhw + .2, .3), mD);
    } else {
      const ov = Object.assign({ tinta: t, ht: top, hb: 30, w: uhw + 3, yc: 0 }, o.hg || {});
      A.add(K.latheX([[Lr - 2, 0], [Lr - 2, 15.5], [Lr + 6, 15.5], [Lr + 6, 0]], { seg: 26 }), mU);
      guardamanoFessure(A, Lr, hg1, ov);
    }
    // ---------------- canna, blocco del gas (sotto la slitta), bocca
    const mBar = K.mat('nero', null, { r: .4 }), rb = big ? 10.4 : 8.6;
    A.add(K.rod(Lr - 10, xm, rb, { seg: 22 }), mBar);
    let xe = xm;
    if (o.bocca === 'tre') { trePunte(A, xm - 10, big ? 13 : 11.5, 56); xe = xm + 46; }
    else if (o.bocca === 'quattro') { quattroPunte(A, xm - 10, 11.5, 52); xe = xm + 42; }
    else if (o.bocca === 'freno') { C.put(A, C.muzzle('freno', xm - 8, big ? 14 : 12.5, { len: 66, ch: 3 })); xe = xm + 58; }
    else if (o.bocca === 'obliquo') { compensatoreObliquo(A, xm - 8, 11.5, 48); xe = xm + 40; }
    else { C.put(A, C.muzzle('gabbia', xm - 10, big ? 12 : 11, { len: 56 })); xe = xm + 46; }
    A.add(K.discX(xe + .1, 0, 0, 3.2, 1, 12), mD);
    // ---------------- scatola inferiore e impugnatura
    inferioreModulare(A, D, spec, { tinta: o.infTinta || t, metallo: !!o.infMetallo, puntinato: !o.infMetallo });
    impugnatura(A, D.gx0, D.gx1, -40, { stile: o.impugnatura || 'dita', ang: 22, len: big ? 92 : 88, prof: 1.12, tinta: o.impTinta || t });
    // ---------------- calcio pieghevole
    calcioLaterale(A, o.calcio || 'monolitico', 0, o.xb, D, { tinta: o.calcioTinta || t, guanciale: o.guanciale, matCerniera: mU });
    // ---------------- leva di armamento
    const ma = o.manetta || 'sx';
    if (ma === 'sx') { // a sinistra, corre con l'otturatore
      const xh = port[1] + 64; A.add(K.box(xh - 8, 3.8, -uhw - 2.4, xh + 8, 8.2, -uhw + .5, .6), mS, 'otturatore');
      A.add(cilZ(xh, 6, -uhw - 2, -uhw - 15, 2.6, 12), mS, 'otturatore');
      A.add(K.xf(K.latheX([[0, 0], [0, 5], [1.5, 6], [9, 6], [11, 4.6], [11, 0]], { seg: 18 }), { r: [0, PI / 2, 0], t: [xh, 6, -uhw - 13] }), mS, 'otturatore');
    } else if (ma === 'sx_fissa') { // a sinistra davanti, non corre con l'otturatore
      const xh = Lr - 14; A.add(K.slab([[xh - 34, 2, 2], [xh + 4, 2, 2], [xh + 6, 10, 2], [xh - 30, 10, 2]], -uhw - 2.6, -uhw + .4, { b: .7 }), mS, 'manetta');
      A.add(K.slab([[xh - 4, 0, 2], [xh + 6, 0, 2], [xh + 8, 14, 3], [xh - 2, 15, 3]], -uhw - 12, -uhw - 2, { b: 1.2 }), mS, 'manetta');
      A.pivot('manetta', [xh, 6, -uhw]);
    } else if (ma === 'alto') { // in alto davanti, sotto la slitta, ripiegabile
      const xh = Lr - 30; A.add(K.box(xh - 40, 13, uhw - .4, xh + 12, 18, uhw + .3, .3), mD);
      A.add(K.box(xh - 9, 12.4, uhw - 1, xh + 9, 18.6, uhw + 2, .8), mS, 'manetta');
      A.add(K.xf(K.slabY([[-5, 0, 2], [5, 0, 2], [2, 26, 3], [-6, 25, 3]], 13.5, 18, { b: .9 }), { r: [0, .5, 0], t: [xh, 0, uhw + 1] }), mS, 'manetta');
      A.pivot('manetta', [xh, 15, uhw]);
    }
    if (ma === 'T' || o.manettaT) { // leva a T dietro (anche come seconda leva)
      A.add(K.slabY([[-15, -17, 3], [-15, 17, 3], [-10, 20.5, 2], [-5.5, 18, 1.5], [-5.5, 5.5, 1], [6, 5.5, 0], [6, -5.5, 0], [-5.5, -5.5, 1], [-5.5, -16, 1], [-8.5, -24, 1.5], [-13, -24, 1.5]], top - 6.2, top - .4, { b: .8 }), mS, ma === 'T' ? 'manetta' : 'corpo');
      if (ma === 'T') A.pivot('manetta', [-8, top - 6, 0]);
    }
    // ---------------- mire ribaltabili o ottica
    const yl = top + 9.4 + 36; let yo = null;
    if (o.ottica === 'reflex') { C.put(A, C.reflex(40, top + 9.4)); yo = top + 9.4 + 21; }
    diottraRibaltabile(A, o.ottica ? 112 : 16, top + 9.4, yl, {});
    mirinoRibaltabile(A, hg1 - 16, top + 9.4, yl, {});
    // ---------------- caricatore
    const cm = o.caricatore || {}, mtop = [(D.mw0 + D.mw1) / 2 + .5, bot + 2];
    caricatore(A, mtop, Object.assign(big ? { len: 150, d0: 76, d1: 78, w: 12.8, ang: .02, raggio: 0, tipo: 'acciaio' } : { len: 182, d0: 59, d1: 64, w: 11.2, ang: .02, dritto: .42, raggio: 330, tipo: 'polimero', c: '#24262a' }, cm));
    A.pivot('caricatore', [mtop[0], D.mwBot, 0]);
    // ---------------- punti di riferimento
    A.anchor('bocca', [xe + .5, 0, 0]); A.anchor('espulsione', [(port[0] + port[1]) / 2, 4, uhw + 1], [0, .35, 1]);
    A.anchor('impugnatura', [D.gx0 - 4, -74, 0]); A.anchor('grilletto', [D.tx - 1, -42, 0]);
    A.anchor('appoggio', [o.xAppoggio || (Lr + 90), -36, -8]); A.anchor('mira_post', [16, yo || yl, 0]); A.anchor('mira_ant', [hg1 - 16, yl, 0]);
    A.anchor('calcio', [o.xb - 6, -40, 0]); if (yo) A.anchor('ottica', [40, yo, 0]);
    const r = A.done();
    r.info = { azione: 'auto', bossolo: big ? 'fucile_lungo' : 'fucile', ciclo: { otturatore: { dx: -(big ? .1 : .085) }, grilletto: { rz: -.16 } }, ricarica: { caricatore: { dy: -.2, dx: .004 } } };
    if (ma !== 'sx') r.info.armamento = { manetta: ma === 'alto' ? { dx: -.08 } : { dx: -.07 } };
    return r;
  };

  // ---------------- voci del catalogo: fucili modulari
  // calibro intermedio: scatola monolitica color coyote con guardamano basso in polimero e slitte corte
  MAP2[82] = { f: 'fucile_modulare', o: { var: 'monolitico', canna: 355, hg1: 448, calcio: 'monolitico', xb: -268, manetta: 'sx', bocca: 'gabbia', impugnatura: 'dente', caricatore: { tipo: 'polimero', c: '#24262a' } } };
  // calibro pieno della stessa famiglia: scatola più grande, caricatore d'acciaio diritto nervato
  MAP2[100] = { f: 'fucile_modulare', o: { var: 'monolitico', grande: true, canna: 400, hg1: 484, calcio: 'monolitico', xb: -276, manetta: 'sx', bocca: 'gabbia', impugnatura: 'dente', caricatore: { tipo: 'acciaio', c: '#202224' } } };
  // giapponese: guardamano a fessure con becco inclinato, calcio su tubo pieghevole con guanciale
  MAP2[90] = { f: 'fucile_modulare', o: { var: 'fessure', canna: 330, Lr: 236, hg1: 430, hg: { ht: 21, hb: 30, w: 17, e: 3, becco: 46, lf: 28 }, calcio: 'tubo', guanciale: true, xb: -268, manetta: 'sx', bocca: 'obliquo', impugnatura: 'dita', caricatore: { tipo: 'polimero', c: '#202224' } } };
  // ceco: guardamano ottagonale a fessure, calcio angolare con finestra, leva fissa a sinistra, caricatore traslucido
  MAP2[84] = { f: 'fucile_modulare', o: { var: 'fessure', canna: 356, Lr: 226, hg1: 446, hg: { ht: 21, hb: 28, w: 18, e: 2.6, lf: 34, file: [PI / 2, -PI / 2, PI, PI * .75, -PI * .75] }, calcio: 'triangolo', xb: -286, manetta: 'sx_fissa', bocca: 'freno', impugnatura: 'dita', caricatore: { tipo: 'trasparente', c: '#3d3a33' } } };
  // polacco oliva: guardamano lungo a feritoie larghe, calcio retrattile su tubo pieghevole
  MAP2[85] = { f: 'fucile_modulare', o: { var: 'fessure', canna: 406, Lr: 230, hg1: 500, hg: { ht: 21, hb: 32, w: 19, e: 3.6, lf: 40, lar: 9, gap: 16 }, calcio: 'tubo', xb: -300, manetta: 'sx', bocca: 'gabbia', impugnatura: 'dita', infTinta: 'oliva', caricatore: { tipo: 'polimero', c: '#202224' } } };
  // tedesco: leva di armamento in alto davanti, guardamano a feritoie lunghe, calcio a telaio aperto
  MAP2[88] = { f: 'fucile_modulare', o: { var: 'fessure', canna: 368, Lr: 238, hg1: 448, hg: { ht: 21, hb: 28, w: 18, e: 3.4, lf: 46, lar: 6, gap: 14 }, calcio: 'telaio', xb: -282, manetta: 'alto', bocca: 'quattro', impugnatura: 'dita', caricatore: { tipo: 'polimero', c: '#202224' } } };

  // ====================================================================================== FUCILE A LAMIERA STAMPATA
  // scatole in lamiera d'acciaio, leva di armamento a destra che corre con l'otturatore, tacca a orecchie sul retro,
  // guardamano in polimero con feritoie, calcio pieno ripiegabile a sinistra
  FAM2.fucile_lamiera = function (spec, o) {
    init(); o = o || {};
    const A = K.asm('fucile_lamiera'), mD = mBuio(), mS = K.mat('nero');
    const Lu = 222, top = 17, bot = -13, hw = 13.4, bf = 150, xm = bf + 464, yl = 38, gas = 452;
    // ---------------- scatola superiore
    const ub = [-2, bot - 2, Lu + 2, top + 2];
    const pU = K.painter(ub, { w: 1024, h: 512, rough: .52 });
    pU.text('L', maiusc(spec.produttore), 118, 5, 3.2, { spacing: 3 }); pU.text('L', maiusc(spec.nome) + '   ' + String(spec.calibro || '').replace(' mm', ''), 118, -2, 2.6);
    pU.text('L', matricola(spec), 118, -8, 2.3);
    pU.line('R', K.rrect(82.8, -6.2, 141.2, 11.2, 3), .5, { h: -.5, a: .85 }, true);
    for (const x of [12, 60, 200]) for (const y of [-8, 10]) pU.pin('LR', x, y, 1.7, { h: .45, a: 1.08 });
    pU.line('LR', [[4, top - 4.5], [Lu - 8, top - 4.5]], .5, { h: .4, a: 1.06 });
    pU.noise({ a: .12, r: .2, seed: 31 }); pU.walls({ r: .55 });
    const mU = K.mat('nero', pU.done(2.3), { ns: .8 });
    const uo = [[0, bot, 1, .4], [Lu, bot, 1, .4], [Lu, top - 3, 5], [Lu - 12, top, 5], [0, top, 5]];
    A.add(K.slab(uo, -hw, 0, { bL: 4, bR: 0, uv: ub }), mU);
    A.add(K.slab(uo, 0, hw, { bL: 0, bR: 4, uv: ub, holes: [K.rrect(84, -5, 140, 10, 2.5)] }), mU);
    A.add(K.box(84, -5, -1, 140, 10, .2, 0), mD);
    A.add(K.xf(K.slab([[85, -17, 1.5], [139, -17, 1.5], [139, 0, .5], [85, 0, .5]], 0, 1.3, { b: .4, uv: ub }), { r: [-.2, 0, 0], t: [0, -8, hw + .6] }), mU);
    // feritoia e leva di armamento a destra (corre con l'otturatore)
    A.add(K.box(141, 2.4, hw - .5, 214, 6.6, hw + .3, .3), mD);
    const xh = 204;
    A.add(K.box(xh - 10, 2.8, hw - 1, xh + 8, 6.2, hw + 1.4, .5), mS, 'otturatore');
    A.add(cilZ(xh, 4.5, hw, hw + 12, 2.4, 12), mS, 'otturatore');
    A.add(K.xf(K.latheX([[0, 0], [0, 4.4], [1.4, 5.2], [8, 5.2], [10, 4], [10, 0]], { seg: 18 }), { r: [0, -PI / 2, 0], t: [xh, 4.5, hw + 10] }), mS, 'otturatore');
    A.add(K.rod(40, bf - 6, 11.8, { seg: 22 }), K.mat('parker', null, { r: .42 }), 'otturatore');
    A.add(K.rod(bf - 6.5, bf, 9, { seg: 18 }), K.mat('grigio', null, { r: .38 }), 'otturatore');
    A.pivot('otturatore', [bf, 0, 0]);
    // tacca a diottra ribaltabile fra due orecchie
    A.add(K.slab([[6, top - 2, 1], [34, top - 2, 1], [32, top + 4, 2], [8, top + 4, 2]], -10, 10, { b: 1 }), mU);
    A.add(K.slabX([[-10, top + 2, 1], [10, top + 2, 1], [10, yl + 5, 3], [6.5, yl + 5, 1], [6.5, top + 6, 2], [-6.5, top + 6, 2], [-6.5, yl + 5, 1], [-10, yl + 5, 3]], 10, 30, { b: .8 }), mU);
    A.add(K.slabX([[-6, top + 4, .5], [6, top + 4, .5], [6, yl + 3, 2.4], [-6, yl + 3, 2.4]], 19, 21, { b: .4, holes: [K.circ(0, yl, 1.1, 14)] }), mS);
    // ---------------- scatola inferiore in lamiera, pozzetto, ponticello, comandi
    const lb = [-34, -60, Lu, 2];
    const pL = K.painter(lb, { w: 1024, h: 512, rough: .55 });
    pL.text('L', 'S', 50, -14, 2.6); pL.text('L', 'R', 38, -12, 2.6); pL.text('L', 'F', 28, -18, 2.6);
    for (const [x, y] of [[8, -20], [64, -24], [76, -28], [155, -19], [-22, -10]]) pL.pin('LR', x, y, 2, { h: .4, a: 1.06 });
    pL.noise({ a: .1, r: .18, seed: 33 }); pL.walls({ r: .55 });
    const mL = K.mat('nero', pL.done(2.2), { ns: .8 });
    A.add(K.slab([[-8, bot, 0, .4], [168, bot, 0, .4], [168, -24, 4], [162, -30, 2], [98, -30], [98, -38, 2], [62, -38, 2], [56, -40, 3], [28, -40, 3], [16, -36, 6], [-8, -30, 5]], -12.6, 12.6, { b: 1.6, uv: lb }), mL);
    A.add(K.slab([[96, bot - 1, 0], [164, bot - 1, 0], [164, -28, 3], [162, -54, 3], [166, -58, 1.5], [95, -58, 1.5], [96, -36, 1]], -15, 15, { b: 1.4, uv: lb }), mL);
    A.add(K.slab([[98, -37, 1], [98, -50, 4], [92, -56, 4], [62, -56, 6], [56, -48, 3], [58, -40, 1], [62, -40, 1], [64, -51, 3], [92, -51, 3], [93, -37, 1]], -6, 6, { b: 1 }), mL);
    A.add(K.slab([[70, -30, 1], [74.5, -31, 2], [73.5, -40, 6], [70.5, -48.5, 1.2], [67.5, -48, 1], [70, -40, 6], [69, -31, 1]], -3.2, 3.2, { b: .7 }), mS, 'grilletto');
    A.pivot('grilletto', [72, -27, 0]);
    A.add(K.slab([['a', 40, -20, 5, PI * .5, PI * 1.5], [44, -23, 1], [54, -21.5, 1.4], [54.5, -18.5, 1.4], [44, -17, 1]], -15, -12.4, { b: .7 }), mS);
    A.add(cilZ(100, -27, 14.6, 17, 4.2, 14), mS);
    // cerniera del calcio dietro la scatola
    A.add(K.slab([[-34, -36, 3], [-8, -34, 2], [-8, 10, 2], [-34, 9, 3]], -13, 13, { b: 1.6, uv: lb }), mL);
    A.add(cilY(-24, -14.5, -32, 6, 3.2, 14), mS);
    // ---------------- impugnatura e calcio pieno ripiegabile
    impugnatura(A, 26, 60, -38, { stile: 'liscia', ang: 18, len: 90, prof: 1.18, hw: 15 });
    const xb = -316, mP = K.mat('polimero', null, { tile: 'grana', rep: [8, 4], r: .58, ns: .22 });
    calcioIncavato(A, [[xb, -114, 5], [xb + 24, -117, 12], [-34, -38, 8], [-34, 8, 3], [xb + 30, 12, 12], [xb, 11, 4]], [[xb + 22, -96, 8], [-58, -40, 8], [-58, 0, 4], [xb + 26, 2, 8]], 16, 6.5, mP, { b: 3.6 });
    A.add(K.slab([[xb - 8, -116, 3], [xb + 1, -116, 1], [xb + 1, 10, 2], [xb - 8, 9, 4]], -17, 17, { b: 2 }), K.mat('polimero', null, { tile: 'ribs', rep: [1, 10], r: .7 }));
    maglia(A, xb + 30, -108, 0, 0, 6.5);
    // ---------------- guardamano in polimero con feritoie in alto, canna, blocco del mirino, bocca
    const mBar = K.mat('nero', null, { r: .4 });
    A.add(K.latheX([[Lu - 2, 0], [Lu - 2, 17], [Lu + 8, 17], [Lu + 8, 0]], { seg: 26 }), mU);
    A.add(sweepX(span(Lu + 8, gas - 22, 6), () => secRib(80, 24, 21, 10, 1.4, -3, { soglia: .1 }), { ang: 30 }), K.mat('polimero', null, { r: .6 }));
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) feritoia(A, Lu + 24 + i * 46, Lu + 58 + i * 46, 21.6, s * PI * .3, 6, -3, mD);
    A.add(K.latheX([[gas - 23, 0], [gas - 23, 18], [gas - 16, 18], [gas - 14, 14], [gas - 14, 0]], { seg: 26 }), mS);
    A.add(K.rod(Lu, xm, 8.4, { seg: 22 }), mBar);
    const mF = K.mat('parker', null, { r: .5 });
    A.add(K.slab([[gas - 14, -13, 3], [gas + 14, -13, 3], [gas + 14, 12, 2], [gas - 14, 12, 2]], -11, 11, { b: 2 }), mF);
    A.add(K.slab([[gas - 9, 10, 0], [gas + 9, 10, 0], [gas + 6, yl - 10, 3], [gas - 6, yl - 10, 3]], -5, 5, { b: 1 }), mF);
    A.add(K.slabX([[-9, yl - 12, 2], [9, yl - 12, 2], [9, yl + 4, 2.5], [5.6, yl + 4, 1], [5.6, yl - 7, 2.5], [-5.6, yl - 7, 2.5], [-5.6, yl + 4, 1], [-9, yl + 4, 2.5]], gas - 7, gas + 6, { b: .8 }), mF);
    A.add(K.slab([[gas - 1.5, yl - 8, .3], [gas + 1.5, yl - 8, .3], [gas + 1, yl, .3], [gas - 1, yl, .3]], -1.2, 1.2, { b: .3 }), mS);
    A.add(K.box(gas + 6, -21, -4, gas + 16, -12, 4, 1), mF); maglia(A, gas - 6, -20, 0, 0, 6.5);
    gabbiaAperta(A, xm - 10, 10.5, 46); const xe = xm + 36;
    A.add(K.discX(xe + .1, 0, 0, 3.2, 1, 12), mD);
    // ---------------- caricatore d'acciaio da 20 colpi
    caricatore(A, [130, bot + 2], { len: 140, d0: 58, d1: 62, w: 11.2, ang: .03, dritto: .3, raggio: 520, tipo: 'acciaio' });
    A.pivot('caricatore', [130, -58, 0]);
    A.anchor('bocca', [xe + .5, 0, 0]); A.anchor('espulsione', [112, 3, hw + 1], [0, .35, 1]); A.anchor('impugnatura', [22, -70, 0]); A.anchor('grilletto', [71, -42, 0]);
    A.anchor('appoggio', [330, -30, -8]); A.anchor('mira_post', [20, yl, 0]); A.anchor('mira_ant', [gas, yl, 0]); A.anchor('calcio', [xb - 6, -50, 0]);
    const r = A.done();
    r.info = { azione: 'auto', bossolo: 'fucile', ciclo: { otturatore: { dx: -.085 }, grilletto: { rz: -.16 } }, ricarica: { caricatore: { dy: -.18, dx: .004 } } };
    return r;
  };
  MAP2[68] = { f: 'fucile_lamiera', o: {} };

  // ====================================================================================== FUCILE IN POLIMERO CON MANIGLIA-OTTICA
  // scatola in polimero, maniglia di trasporto con cannocchiale incorporato e punto rosso sopra, leva di armamento
  // sotto la maniglia, guardamano a feritoie, calcio scheletrato pieghevole a destra, caricatore traslucido con agganci
  FAM2.fucile_polimero_maniglia = function (spec, o) {
    init(); o = o || {};
    const A = K.asm('fucile_polimero_maniglia'), mD = mBuio(), mS = K.mat('nero');
    const top = 20, bot = -18, hw = 16, Lr = 352, bf = 212, xm = bf + 480;
    const pc = '#2b2d2b';
    // ---------------- scatola in polimero
    const rb = [-2, -64, Lr + 2, top + 2];
    const p = K.painter(rb, { w: 1024, h: 512, rough: .66 });
    p.text('L', maiusc(spec.produttore), 250, 4, 3.4, { spacing: 3 }); p.text('L', maiusc(spec.nome) + '   ' + String(spec.calibro || '').replace(' mm', ''), 250, -4, 2.8);
    p.text('L', matricola(spec), 182, -50, 2.6);
    p.line('R', K.rrect(166.8, -5.2, 228.2, 11.2, 3), .5, { h: -.5, a: .8 }, true);
    for (const x of [30, 120, 300]) p.pin('LR', x, -10, 2.4, { h: .45, a: 1.1 });
    p.stipple('LR', [[150, -22], [214, -22], [214, -56], [150, -56]], { s: .3, r: .86 });
    p.line('LR', [[4, -12], [Lr - 6, -12]], .5, { h: -.5, a: .82 });
    p.wallFill({ r: .7 }); p.noise({ a: .07, r: .12, seed: 41 });
    const mR = K.mat('poligrigio', p.done(2.2), { ns: .8, c: pc });
    const ro = [[0, bot, 3, .6], [Lr, bot, 3, .6], [Lr, top, 4], [0, top, 4]];
    A.add(K.slab(ro, -hw, 0, { bL: 3, bR: 0, uv: rb }), mR);
    A.add(K.slab(ro, 0, hw, { bL: 0, bR: 3, uv: rb, holes: [K.rrect(168, -4, 227, 10, 3)] }), mR);
    A.add(K.box(168, -4, -1, 227, 10, .2, 0), mD);
    A.add(K.slab([[156, top - 1, 2], [167, top - 1, 0], [167, -2, 3], [160, -4, 4]], hw - 1, hw + 5, { b: 1.2 }), mR); // deflettore
    A.add(K.slab([[146, bot + 1, 0], [218, bot + 1, 0], [220, -30, 4], [217, -58, 3], [221, -62, 2], [145, -62, 2], [147, -40, 1]], -hw - .5, hw + .5, { b: 2, uv: rb }), mR);
    A.add(K.slab([[0, -48, 3], [22, -48, 4], [30, bot + 1, 0], [0, bot + 1, 0]], -hw + 1, hw - 1, { b: 2, uv: rb }), mR); // attacco del calcio
    A.add(K.rod(bf - 70, bf - 6, 12, { seg: 22 }), K.mat('parker', null, { r: .42 }), 'otturatore');
    A.add(K.rod(bf - 6.5, bf, 9, { seg: 18 }), K.mat('grigio', null, { r: .38 }), 'otturatore');
    // ---------------- gruppo di scatto: impugnatura e ponticello grande
    impugnatura(A, 64, 100, bot + 1, { stile: 'ergo', ang: 17, len: 94, prof: 1.15, mat: K.mat('poligrigio', null, { c: pc, tile: 'stipple', rep: [3, 6], r: .8 }) });
    A.add(K.slab([[60, bot + 1, 0], [146, bot + 1, 0], [146, -44, 4], [138, -62, 8], [106, -66, 8], [94, -58, 4], [98, -48, 2], [60, -40, 3]], -9, 9, { b: 2, holes: [[[106, -30, 3], [138, -30, 3], [134, -54, 5], [110, -57, 5], [104, -46, 3]]] }), mR);
    A.add(K.slab([[118, -26, 1], [122.5, -27, 2], [121.5, -36, 6], [118.5, -44.5, 1.2], [115.5, -44, 1], [118, -36, 6], [117, -27, 1]], -3.2, 3.2, { b: .7 }), mS, 'grilletto');
    A.pivot('grilletto', [120, -23, 0]);
    for (const s of [-1, 1]) A.add(K.slab([['a', 88, -26, 5, PI * .5, PI * 1.5], [92, -29, 1], [102, -27.5, 1.4], [102.5, -24.5, 1.4], [92, -23, 1]], s > 0 ? hw - .3 : -hw - 2.3, s > 0 ? hw + 2 : -hw, { b: .7 }), mS);
    // ---------------- maniglia con cannocchiale e punto rosso
    const hb = [56, top - 2, 336, 92];
    const ph = K.painter(hb, { w: 1024, h: 512, rough: .64 });
    ph.text('L', '3,5×', 300, 76, 3.4); ph.stipple('LR', [[120, 56], [290, 56], [290, 80], [120, 80]], { s: .3, r: .84, k: .6 });
    ph.wallFill({ r: .7 });
    const mH = K.mat('poligrigio', ph.done(2.2), { ns: .8, c: pc });
    const hp = [[60, top - 1, 0], [334, top - 1, 0], [334, 46, 4], [326, 72, 10], [300, 86, 10], [96, 86, 10], [70, 82, 10], [60, 60, 6]];
    A.add(K.slab(hp, -11.5, 11.5, { b: 4.2, bs: 4, uv: hb, holes: [[[110, top + 7, 8], [292, top + 7, 6], [292, 52, 8], [110, 52, 8]]] }), mH);
    A.add(K.latheX([[44, 13], [44, 16], [47, 17.5], [60, 17.5], [60, 14]], { seg: 26, cy: 70 }), K.mat('gomma'));
    A.add(K.discX(46, 70, 0, 12.5, -1, 24), K.mat('lente')); A.add(K.discX(334.6, 66, 0, 12, 1, 24), K.mat('lente'));
    A.add(K.latheX([[330, 0], [330, 14.5], [338, 14.5], [338, 12.6]], { seg: 26, cy: 66 }), mH);
    // punto rosso sopra la maniglia
    A.add(K.slab([[178, 85, 2], [250, 85, 2], [246, 96, 4], [184, 96, 4]], -11, 11, { b: 1.8 }), mH);
    A.add(K.slabX([[-11, 94, 2], [11, 94, 2], [11, 116, 6], [-11, 116, 6]], 200, 236, { b: 1.4, holes: [[[-8, 98, 3], [8, 98, 3], [8, 112, 4], [-8, 112, 4]]] }), mH);
    A.add(K.slabX([[-8.2, 97.8, 0], [8.2, 97.8, 0], [8.2, 112.2, 0], [-8.2, 112.2, 0]], 233, 233.6, { b: 0 }), K.mat('lente', null, { c: '#4a6a70', r: .05 }));
    A.add(K.discX(233.7, 105, 0, .8, -1, 10), K.mat('rosso'));
    // leva di armamento sotto la parte anteriore della maniglia (corre con l'otturatore)
    A.add(K.box(286, top - 1, -5, 310, top + 5, 5, .8), mS, 'otturatore');
    A.add(K.xf(K.slabY([[-4, 0, 2], [5, 0, 2], [4, -22, 3], [-3, -22, 3]], top + 1, top + 5, { b: .8 }), { t: [300, 0, -4] }), mS, 'otturatore');
    A.pivot('otturatore', [bf, 0, 0]);
    // ---------------- guardamano a feritoie, blocco del gas, canna, rompifiamma a quattro punte
    const xh1 = 540;
    A.add(sweepX(span(Lr, xh1, 4), x => { const u = (x - Lr) / (xh1 - Lr); return secSE(44, lin(top, 16, u), lin(32, 26, u), lin(hw + 2, hw, u), 3.2, 3.2, -4); }, { ang: 38 }), mR);
    for (const sg of [1, -1]) for (const yy of [2, -16]) for (let i = 0; i < 5; i++) { const xa = Lr + 22 + i * 32, w = lin(hw + 2, hw, (xa + 11 - Lr) / (xh1 - Lr)); const g = K.box(xa, yy - 3.6, w - 3, xa + 22, yy + 3.6, w + .3, 1.6); if (sg < 0) g.scale(1, 1, -1); A.add(g, mD); }
    for (let i = 0; i < 5; i++) feritoia(A, Lr + 22 + i * 32, Lr + 44 + i * 32, 30, PI, 7, -4, mD);
    A.add(K.latheX([[xh1, 0], [xh1, 14], [xh1 + 26, 14], [xh1 + 28, 11], [xh1 + 28, 0]], { seg: 24, cy: -14 }), K.mat('nero'));
    A.add(K.rod(Lr - 10, xm, 8.8, { seg: 22 }), K.mat('nero', null, { r: .4 }));
    A.add(K.box(xh1 + 8, -32, -4, xh1 + 20, -24, 4, 1), mS); maglia(A, xh1 + 34, -14, 12, PI / 2, 6.5);
    quattroPunte(A, xm - 10, 11.2, 52); const xe = xm + 42;
    // ---------------- calcio scheletrato pieghevole a destra
    const xb = -264, mP = K.mat('poligrigio', null, { c: pc, r: .64 });
    A.add(K.slab([[xb, -104, 4], [xb + 16, -106, 8], [-2, -46, 6], [-2, 8, 4], [xb + 24, 18, 6], [xb, 16, 4]], -12, 12, { b: 2.6, holes: [[[xb + 22, -84, 8], [-24, -40, 8], [-24, -2, 6], [xb + 22, 4, 6]]] }), mP);
    A.add(K.slab([[xb + 20, 8, 3], [-30, 6, 3], [-30, 17, 4], [xb + 26, 21, 5]], -14.5, 14.5, { b: 3 }), mP);
    A.add(K.slab([[xb - 9, -106, 3], [xb + 1, -105, 1], [xb + 1, 16, 2], [xb - 9, 14, 4]], -15, 15, { b: 2.4 }), K.mat('gomma'));
    A.add(cilY(-6, hw + 2, -44, 4, 3.2, 14), mS);
    // ---------------- caricatore traslucido con perni di aggancio
    const ln = caricatore(A, [182, bot + 2], { len: 200, d0: 64, d1: 70, w: 13, ang: .05, dritto: .25, raggio: 300, tipo: 'trasparente', c: '#3a3b37', op: .62 });
    for (const s of [-1, 1]) { const q = ln[3]; A.add(K.box(q.p[0] - 20, q.p[1] - 6, s > 0 ? 12.6 : -16, q.p[0] - 8, q.p[1] + 4, s > 0 ? 16 : -12.6, 1), K.mat('polimero'), 'caricatore'); }
    A.pivot('caricatore', [182, -62, 0]);
    A.anchor('bocca', [xe + .5, 0, 0]); A.anchor('espulsione', [197, 3, hw + 1], [0, .35, 1]); A.anchor('impugnatura', [60, -70, 0]); A.anchor('grilletto', [119, -38, 0]);
    A.anchor('appoggio', [440, -34, -8]); A.anchor('mira_post', [40, 70, 0]); A.anchor('ottica', [40, 70, 0]); A.anchor('mira_ant', [236, 105, 0]); A.anchor('calcio', [xb - 6, -46, 0]);
    const r = A.done();
    r.info = { azione: 'auto', bossolo: 'fucile', ciclo: { otturatore: { dx: -.09 }, grilletto: { rz: -.16 } }, ricarica: { caricatore: { dy: -.2, dx: .01 } } };
    return r;
  };
  MAP2[78] = { f: 'fucile_polimero_maniglia', o: {} };

  // ====================================================================================== FUCILE IN POLIMERO A FORME TONDE
  // guscio unico in polimero (scatola e guardamano) dai contorni morbidi, più profondo verso la bocca, slitta continua
  // sopra, slitte corte ai lati e sotto; ponticello grande, grande pulsante ovale di sgancio, calcio telescopico e
  // pieghevole a trave spessa con finestra, leva di armamento fissa davanti a sinistra
  FAM2.fucile_polimero_tondo = function (spec, o) {
    init(); o = o || {};
    const A = K.asm('fucile_polimero_tondo'), big = !!o.grande, mD = mBuio(), mS = K.mat('nero');
    const top = 21, bot = -15, hw = 18;
    const D = { top, bot, uhw: hw, lhw: 14, mwHw: 15.2, mw0: big ? 144 : 150, gx0: 56, gx1: 90, tx: 106 };
    D.mw1 = D.mw0 + (big ? 84 : 66); D.mwBot = big ? -72 : -64; D.Lb = D.mw1 + 16;
    const bf = D.mw1 + 2, xm = bf + o.canna, hg1 = o.hg1, port = [bf - 60, bf - 4];
    // ---------------- guscio superiore
    const sb = [-2, -50, hg1 + 2, top + 2];
    const p = K.painter(sb, { w: 1024, h: 512, rough: .66 });
    p.text('L', maiusc(spec.produttore), port[0] + 34, 8, 3.4, { spacing: 3 }); p.text('L', maiusc(spec.nome) + (big ? '' : ''), port[0] + 34, 1, 3.2, { spacing: 2 });
    p.text('L', String(spec.calibro || '').replace(' mm', ''), port[0] + 34, -6, 2.6); p.text('R', matricola(spec), 60, -6, 2.6);
    p.line('R', K.rrect(port[0] - 1.2, -6.2, port[1] + 1.2, 12.2, 3.5), .5, { h: -.5, a: .8 }, true);
    p.stipple('LR', [[D.Lb + 70, -16], [hg1 - 34, -16], [hg1 - 40, -40], [D.Lb + 84, -38]], { s: .3, r: .86 });
    p.line('LR', [[D.Lb + 40, -12], [hg1 - 26, -12]], .55, { h: -.55, a: .8 }); p.line('LR', [[12, 12], [port[0] - 16, 12]], .5, { h: -.5, a: .82 });
    for (const x of [26, D.Lb - 10, hg1 - 60]) p.pin('LR', x, -8, 2.4, { h: .45, a: 1.08 });
    p.wallFill({ r: .7 }); p.noise({ a: .07, r: .12, seed: 51 });
    const mG = K.mat('polimero', p.done(2.2), { ns: .8 });
    const sh = [[0, bot, 3, .6], [D.Lb + 2, bot, 0], ['c', D.Lb + 26, bot, D.Lb + 20, -38, D.Lb + 56, -40], ['c', hg1 - 160, -42, hg1 - 70, -48, hg1 - 28, -45], ['c', hg1 - 6, -42, hg1, -30, hg1, -12], [hg1, top - 2, 6], [0, top - 2, 5]];
    A.add(K.slab(sh, -hw, 0, { bL: 8, bR: 0, bs: 5, uv: sb }), mG);
    A.add(K.slab(sh, 0, hw, { bL: 0, bR: 8, bs: 5, uv: sb, holes: [K.rrect(port[0], -5, port[1], 11, 3)] }), mG);
    A.add(K.box(port[0], -5, -1, port[1], 11, .2, 0), mD);
    A.add(K.slab([[port[0] - 12, top - 3, 2], [port[0] - 1, top - 3, 0], [port[0] - 1, -2, 3], [port[0] - 6, -4, 4]], hw - 1.5, hw + 4, { b: 1.2 }), mG); // deflettore
    // nervatura di disegno lungo i fianchi e labbro anteriore del guardamano
    for (const sg of [-1, 1]) A.add(K.slab([[port[1] + 14, -6, 3], [hg1 - 40, -6, 3], [hg1 - 34, 0, 3], [port[1] + 20, 0, 3]], sg > 0 ? hw - 1 : -hw - .6, sg > 0 ? hw + .6 : -hw + 1, { b: .5 }), mG);
    A.add(K.slab([[hg1 - 8, -30, 4], [hg1 + 3, -26, 4], [hg1 + 3, 14, 4], [hg1 - 8, 16, 4]], -hw + 2, hw - 2, { b: 2.4 }), mG);
    const mRail = K.mat('anod');
    C.put(A, slitta(2, hg1 - 2, top - 2.3, { mat: mRail }));
    for (const d of ['dx', 'sx']) C.put(A, slitta(hg1 - (big ? 160 : 120), hg1 - 14, hw - 2.5, { dir: d, mat: mRail }));
    C.put(A, slitta(hg1 - (big ? 140 : 110), hg1 - 34, 44, { dir: 'giu', mat: mRail }));
    A.add(K.rod(port[0] - 30, bf - 6, 12, { seg: 22 }), K.mat('parker', null, { r: .42 }), 'otturatore');
    A.add(K.rod(bf - 6.5, bf, 9, { seg: 18 }), K.mat('grigio', null, { r: .38 }), 'otturatore');
    A.pivot('otturatore', [bf, 0, 0]);
    // ---------------- scatola inferiore, impugnatura, pulsante ovale di sgancio davanti al ponticello
    inferioreModulare(A, D, spec, { tinta: 'nera', puntinato: true });
    impugnatura(A, D.gx0, D.gx1, -40, { stile: 'dita', ang: 20, len: big ? 94 : 90, prof: 1.15 });
    A.add(K.xf(cilZ(0, 0, -D.lhw - 3.2, D.lhw + 3.2, 6.5, 22), { s: [1.3, 1, 1], t: [D.mw0 - 10, -45, 0] }), mS);
    // ---------------- leva di armamento fissa davanti a sinistra (spostabile a destra nell'arma vera)
    const xh = D.Lb + 12;
    A.add(K.slab([[xh - 34, 3, 2], [xh + 4, 3, 2], [xh + 6, 11, 2], [xh - 30, 11, 2]], -hw - 2.4, -hw + 1, { b: .7 }), mS, 'manetta');
    A.add(K.slab([[xh - 4, 1, 2], [xh + 6, 1, 2], [xh + 9, 15, 3], [xh - 1, 16, 3]], -hw - 12, -hw - 1.5, { b: 1.2 }), mS, 'manetta');
    A.pivot('manetta', [xh, 7, -hw]);
    // ---------------- canna e bocca
    A.add(K.rod(hg1 - 20, xm, big ? 10.2 : 8.6, { seg: 22 }), K.mat('nero', null, { r: .4 }));
    A.add(K.latheX([[hg1 + 2, 0], [hg1 + 2, 13], [hg1 + 10, 12], [hg1 + 12, 9.6], [hg1 + 12, 0]], { seg: 24 }), mS);
    let xe;
    if (big) { C.put(A, C.muzzle('freno', xm - 8, 13.5, { len: 66, ch: 3 })); xe = xm + 58; } else { C.put(A, C.muzzle('gabbia', xm - 10, 11, { len: 56 })); xe = xm + 46; }
    A.add(K.discX(xe + .1, 0, 0, 3.2, 1, 12), mD);
    // ---------------- calcio telescopico e pieghevole: cerniera, trave scorrevole, corpo a trave spessa con finestra
    const xb = o.xb, mP = K.mat('polimero', null, { tile: 'grana', rep: [8, 4], r: .62, ns: .22 });
    A.add(K.slab([[-18, -42, 3], [0, -42, 0], [0, top - 4, 0], [-18, top - 6, 3]], -D.lhw, D.lhw, { b: 1.6 }), mP);
    A.add(cilY(-9, D.lhw + 2.4, -38, top - 8, 3.4, 14), mS);
    A.add(K.slab([[-78, -8, 2], [-18, -8, 2], [-18, top - 7, 2], [-78, top - 7, 2]], -9, 9, { b: 1.4 }), K.mat('anod'));
    A.add(K.slab([[xb, -104, 5], [xb + 24, -108, 10], [-58, -24, 10], [-58, top + 1, 4], [xb + 46, top + 5, 14], [xb, top + 3, 5]], -14, 14, { b: 4, bs: 4, holes: [[[xb + 24, -84, 10], [-84, -22, 10], [-84, top - 13, 4], [xb + 26, top - 11, 8]]] }), mP);
    if (big) { A.add(K.slab([[xb + 28, top + 3, 3], [-70, top + 3, 3], [-80, top + 15, 6], [xb + 36, top + 16, 6]], -12, 12, { b: 2.8 }), mP); A.add(cilZ(-90, top + 6, -18, 18, 3.6, 14), mS); }
    A.add(K.slab([[xb - 13, -108, 4], [xb + 1, -106, 2], [xb + 1, top + 3, 3], [xb - 13, top + 1, 6]], -17, 17, { b: 3.2 }), K.mat('gomma'));
    maglia(A, xb + 22, -92, 0, 0, 6);
    // ---------------- mire ribaltabili e caricatore
    const yl = top - 2.3 + 9.4 + 36;
    diottraRibaltabile(A, 18, top - 2.3 + 9.4, yl, {}); mirinoRibaltabile(A, hg1 - 18, top - 2.3 + 9.4, yl, {});
    const mtop = [(D.mw0 + D.mw1) / 2 + .5, bot + 2];
    caricatore(A, mtop, big ? { len: 150, d0: 76, d1: 78, w: 12.8, ang: .02, raggio: 0, tipo: 'polimero', c: '#26282a' } : { len: 182, d0: 59, d1: 64, w: 11.2, ang: .02, dritto: .42, raggio: 330, tipo: 'polimero', c: '#26282a' });
    A.pivot('caricatore', [mtop[0], D.mwBot, 0]);
    A.anchor('bocca', [xe + .5, 0, 0]); A.anchor('espulsione', [(port[0] + port[1]) / 2, 4, hw + 1], [0, .35, 1]); A.anchor('impugnatura', [D.gx0 - 4, -74, 0]); A.anchor('grilletto', [D.tx - 1, -42, 0]);
    A.anchor('appoggio', [D.Lb + 120, -46, -8]); A.anchor('mira_post', [18, yl, 0]); A.anchor('mira_ant', [hg1 - 18, yl, 0]); A.anchor('calcio', [xb - 8, -42, 0]);
    const r = A.done();
    r.info = { azione: 'auto', bossolo: big ? 'fucile_lungo' : 'fucile', ciclo: { otturatore: { dx: -(big ? .1 : .085) }, grilletto: { rz: -.16 } }, ricarica: { caricatore: { dy: -.2, dx: .004 } }, armamento: { manetta: { dx: -.07 } } };
    return r;
  };
  MAP2[83] = { f: 'fucile_polimero_tondo', o: { canna: 406, hg1: 504, xb: -232 } };
  MAP2[103] = { f: 'fucile_polimero_tondo', o: { grande: true, canna: 406, hg1: 540, xb: -280 } };

  // ====================================================================================== BULLPUP
  // guscio laterale con pittore (scritte in rilievo, puntinatura), calciolo in gomma; ritorna il materiale
  function guscio(A, path, hw, bb, spec, o) {
    const p = K.painter(bb, { w: 1024, h: 512, rough: o.rough || .66 });
    if (o.scritte !== false) { p.text(o.latoScritte || 'R', maiusc(spec.produttore), o.xs, o.ys, 4, { spacing: 3, h: .35, a: 1.12 }); p.text(o.latoScritte || 'R', maiusc(spec.nome), o.xs, o.ys - 7, 3.6, { spacing: 2, h: .35, a: 1.12 }); }
    if (o.punti) p.stipple('LR', o.punti, { s: .3, r: .86 });
    if (o.linee) for (const l of o.linee) p.line('LR', l, .55, { h: -.55, a: .8 });
    if (o.perni) for (const [x, y] of o.perni) p.pin('LR', x, y, 2.6, { h: .45, a: 1.08 });
    if (o.finestra) p.line('R', K.rrect(o.finestra[0] - 1.2, o.finestra[1] - 1.2, o.finestra[2] + 1.2, o.finestra[3] + 1.2, 3), .55, { h: -.55, a: .8 }, true);
    p.wallFill({ r: .72 }); p.noise({ a: .07, r: .12, seed: o.seed || 61 });
    const m = o.mat ? o.mat(p.done(2.2)) : K.mat('polimero', p.done(2.2), { ns: .8 });
    if (o.finestra) {
      A.add(K.slab(path, -hw, 0, { bL: o.b || 5, bR: 0, bs: o.bs || 5, uv: bb }), m);
      A.add(K.slab(path, 0, hw, { bL: 0, bR: o.b || 5, bs: o.bs || 5, uv: bb, holes: [K.rrect(o.finestra[0], o.finestra[1], o.finestra[2], o.finestra[3], 3)] }), m);
      A.add(K.box(o.finestra[0], o.finestra[1], -1, o.finestra[2], o.finestra[3], .2, 0), mBuio());
    } else A.add(K.slab(path, -hw, hw, { b: o.b || 5, bs: o.bs || 5, uv: bb }), m);
    return m;
  }
  // ponticello grande che chiude tutta la mano: fascia dal fondo dell'impugnatura fino al guscio davanti
  function ponticelloGrande(A, x0, x1, yTop, yBot, m, o) {
    o = o || {}; const hw = o.hw || 9.5, d = o.spess || 9;
    const out = [[x0 - 4, yTop + 4, 0], [x1, yTop + 4, 0], [x1, yTop - 10, 8], [x1 - (x1 - x0) * .3, yBot + 26, 34], [x0 + 22, yBot, 14], [x0 + 4, yBot + 8, 6]];
    const hole = [[x0 + 26, yTop - 2, 6], [x1 - d * 1.6, yTop - 2, 8], [x1 - (x1 - x0) * .3 - d * .8, yBot + 26 + d, 28], [x0 + 26, yBot + d + 2, 10], [x0 + 20, yBot + 30, 6]];
    A.add(K.slab(out, -hw, hw, { b: 2.4, holes: [hole] }), m);
  }
  // grilletto lungo collegato (bullpup)
  function grillettoBullpup(A, x, y) {
    A.add(K.slab([[x - 2, y, 1], [x + 3, y - 1, 2], [x + 2, y - 10, 6], [x - 1, y - 18.5, 1.2], [x - 4, y - 18, 1], [x - 1.5, y - 10, 6], [x - 3, y - 1, 1]], -3.4, 3.4, { b: .7 }), K.mat('nero'), 'grilletto');
    A.pivot('grilletto', [x, y + 3, 0]);
  }
  function chiudiBullpup(A, info, an) { for (const k in an) A.anchor(k, an[k][0], an[k][1]); const r = A.done(); r.info = info; return r; }

  // ---------------- bullpup austriaco: calcio lungo color oliva, scatola in alluminio con maniglia-ottica, ponticello
  // che chiude la mano, impugnatura anteriore ripiegabile sulla canna, caricatore traslucido, leva di armamento a sinistra
  FAM2.bullpup_austriaco = function (spec, o) {
    init(); o = o || {};
    const A = K.asm('bullpup_austriaco'), mD = mBuio(), mS = K.mat('nero'), t = tinta(spec, 'oliva');
    const bf = 242, xm = bf + 508, hw = 23;
    const path = [[9, -108, 14], [9, -4, 16], [44, 8, 30], [166, 9, 8], [176, 3, 0], [448, 3, 0], ['q', 472, 3, 468, -22], [460, -42, 12], [440, -50, 0], [300, -52, 0], [252, -56, 6], [192, -60, 10], ['q', 120, -64, 74, -98], [40, -114, 18]];
    const mStock = guscio(A, path, hw, [0, -124, 474, 14], spec, { xs: 96, ys: -42, finestra: [222, -16, 266, -3], punti: [[300, -12], [440, -12], [440, -44], [300, -44]], linee: [[[176, 0], [448, 0]], [[60, -30], [150, -30]]], perni: [[150, -20], [430, -26]], b: 9, mat: det => mPo(t, det, { ns: .8 }) });
    A.add(K.slab([[0, -116, 6], [10, -118, 2], [10, 3, 4], [0, 1, 8]], -hw - .6, hw + .6, { b: 3 }), K.mat('gomma'));
    impugnatura(A, 288, 326, -50, { stile: 'dita', ang: 14, len: 94, prof: 1.15, hw: 15, tinta: t });
    ponticelloGrande(A, 296, 440, -50, -146, mPo(t, null, { r: .6 }), { hw: 10 });
    grillettoBullpup(A, 358, -56);
    A.add(cilZ(330, -40, -hw - 2.5, hw + 2.5, 4.2, 16), mS); // sicura a pulsante passante
    // scatola in alluminio con la maniglia-ottica
    const mA = K.mat('anod', null, { r: .5 });
    A.add(sweepX(span(168, 562, 2), () => secSE(48, 16, 15, 20, 3.4, 3.4, 13), { ang: 40 }), mA);
    A.add(K.latheX([[556, 0], [556, 18], [580, 18], [582, 15], [582, 0]], { seg: 28 }), mA);
    A.add(cilZ(568, 8, -21, 21, 4, 14), K.mat('nero'));
    // maniglia a ponte: gamba posteriore larga, gamba anteriore inclinata, cannocchiale in alto
    A.add(K.slab([[288, 24, 3], [346, 24, 3], [340, 44, 10], [334, 52, 6], [296, 52, 6], [290, 40, 4]], -12.5, 12.5, { b: 3 }), mA);
    A.add(K.slab([[452, 24, 3], [530, 24, 3], [516, 52, 8], [482, 52, 8], [470, 40, 10]], -12.5, 12.5, { b: 3 }), mA);
    A.add(K.latheX([[290, 13], [290, 16.5], [296, 17.5], [468, 17.5], [490, 20.5], [520, 21.5], [524, 19.5], [524, 17]], { seg: 34, cy: 64 }), mA);
    A.add(K.latheX([[270, 14], [270, 18], [276, 19.5], [290, 18], [290, 14]], { seg: 30, cy: 64 }), K.mat('gomma'));
    A.add(K.discX(272, 64, 0, 13.5, -1, 24), K.mat('lente')); A.add(K.discX(523.6, 64, 0, 17, 1, 28), K.mat('lente'));
    A.add(K.slab([[316, 77, 1], [480, 77, 1], [474, 84, 2], [322, 84, 2]], -6, 6, { b: 1 }), mA);
    A.add(K.slab([[466, 82, .5], [472, 82, .5], [470, 90, .5], [468, 90, .5]], -1.5, 1.5, { b: .3 }), mA);
    // leva di armamento a sinistra (corre con l'otturatore) e otturatore nella finestra
    A.add(K.box(400, 10, -20.4, 500, 15, -19.6, .3), mD);
    A.add(cilZ(482, 12.5, -19, -36, 3, 12), mS, 'otturatore');
    A.add(K.xf(K.latheX([[0, 0], [0, 6], [2, 7], [10, 7], [12, 5], [12, 0]], { seg: 18 }), { r: [0, PI / 2, 0], t: [482, 12.5, -34] }), mS, 'otturatore');
    A.add(K.rod(196, bf, 11, { seg: 20, cy: -9 }), K.mat('parker', null, { r: .42 }), 'otturatore');
    A.pivot('otturatore', [bf, 0, 0]);
    // canna con l'impugnatura anteriore ripiegabile, cilindro del gas, rompifiamma
    A.add(K.rod(560, xm, 9.6, { seg: 22 }), K.mat('nero', null, { r: .38 }));
    A.add(K.latheX([[572, 0], [572, 15], [596, 15], [596, 0]], { seg: 24 }), mA);
    A.add(K.rod(578, 640, 6.5, { cy: 6, cz: 13, seg: 16 }), mA);
    A.add(K.slab([[570, -12, 2], [598, -12, 2], [598, -22, 6], [592, -112, 8], [576, -120, 8], [566, -112, 8], [570, -22, 4]], -13, 13, { b: 5, bs: 4 }), mPo(t, null, { tile: 'stipple', rep: [2, 5], r: .7 }));
    C.put(A, C.muzzle('gabbia', xm - 10, 11.5, { len: 50 })); const xe = xm + 40;
    A.add(K.discX(xe + .1, 0, 0, 3.4, 1, 12), mD);
    // caricatore traslucido dietro l'impugnatura
    caricatore(A, [216, -20], { len: 210, d0: 62, d1: 68, w: 13, ang: .05, dritto: .3, raggio: 340, tipo: 'trasparente', c: '#3a3c36', op: .6 });
    A.pivot('caricatore', [216, -60, 0]);
    maglia(A, 30, -112, 0, 0, 7); maglia(A, 440, -8, -hw - 2, PI / 2, 7);
    return chiudiBullpup(A, { azione: 'auto', bossolo: 'fucile', ciclo: { otturatore: { dx: -.1 }, grilletto: { rz: -.12 } }, ricarica: { caricatore: { dy: -.2, dx: -.01 } } },
      { bocca: [[xe + .5, 0, 0]], espulsione: [[244, -9, hw], [0, .3, 1]], impugnatura: [[300, -96, 0]], grilletto: [[358, -66, 0]], appoggio: [[580, -70, 0]], mira_post: [[272, 64, 0]], ottica: [[272, 64, 0]], mira_ant: [[469, 90, 0]], calcio: [[2, -56, 0]] });
  };
  MAP2[71] = { f: 'bullpup_austriaco', o: {} };

  // ---------------- bullpup francese: maniglia lunga che porta le mire, leva di armamento sotto la maniglia,
  // bipiede ripiegato lungo i fianchi, guardamano nervato, ponticello che chiude la mano, caricatore diritto
  FAM2.bullpup_trombetta = function (spec, o) {
    init(); o = o || {};
    const A = K.asm('bullpup_trombetta'), mD = mBuio(), mS = K.mat('nero');
    const bf = 232, xm = bf + 488, hw = 22, yl = 74;
    const path = [[10, -114, 6], [10, 6, 8], [40, 12, 30], [120, 16, 10], [390, 18, 0], [390, -44, 0], [300, -46, 0], [212, -50, 4], [140, -54, 4], [90, -80, 24], [40, -114, 12]];
    const mB = guscio(A, path, hw, [0, -120, 400, 22], spec, { xs: 80, ys: -30, finestra: [180, -5, 228, 9], punti: [[30, -40], [120, -40], [120, -90], [60, -100]], perni: [[150, -20], [360, -10]], b: 7 });
    A.add(K.slab([[0, -114, 6], [11, -116, 2], [11, 7, 4], [0, 5, 8]], -hw - .5, hw + .5, { b: 3 }), K.mat('gomma'));
    // guardamano con le scanalature per le dita sotto
    const hp = [[386, 18, 0], [560, 18, 4], [566, 6, 6], [562, -30, 8]];
    for (let i = 0; i < 7; i++) { const x = 548 - i * 22; hp.push([x, -40, 4], [x - 11, -46, 5]); }
    hp.push([392, -44, 0]);
    A.add(K.slab(hp, -hw + 1.5, hw - 1.5, { b: 4, bs: 4 }), K.mat('polimero', null, { tile: 'grana', rep: [6, 3], r: .66, ns: .3 }));
    impugnatura(A, 268, 304, -46, { stile: 'liscia', ang: 12, len: 92, prof: 1.16, hw: 15 });
    ponticelloGrande(A, 274, 404, -46, -142, K.mat('polimero', null, { r: .6 }), { hw: 10 });
    grillettoBullpup(A, 334, -52);
    // maniglia lunga con tacca dietro e mirino davanti
    const mH = K.mat('polimero', null, { r: .58 });
    A.add(K.slab([[118, 15, 0], [150, 15, 0], [160, 48, 8], [520, 50, 8], [540, 15, 0], [574, 15, 0], [566, 60, 10], [540, 66, 8], [150, 66, 8], [126, 60, 10]], -9, 9, { b: 3, bs: 4 }), mH);
    A.add(K.slabX([[-9, 64, 1], [9, 64, 1], [9, yl + 6, 3], [5.4, yl + 6, 1], [5.4, 68, 2], [-5.4, 68, 2], [-5.4, yl + 6, 1], [-9, yl + 6, 3]], 128, 148, { b: .8 }), mH);
    A.add(K.slabX([[-5, 66, .5], [5, 66, .5], [5, yl + 3, 2.2], [-5, yl + 3, 2.2]], 137, 139, { b: .4, holes: [K.circ(0, yl, 1.1, 14)] }), mS);
    A.add(K.slabX([[-9, 64, 1], [9, 64, 1], [9, yl + 6, 3], [5.4, yl + 6, 1], [5.4, 68, 2], [-5.4, 68, 2], [-5.4, yl + 6, 1], [-9, yl + 6, 3]], 548, 566, { b: .8 }), mH);
    A.add(K.slab([[555, 66, .3], [559, 66, .3], [558.5, yl, .3], [555.5, yl, .3]], -1.2, 1.2, { b: .2 }), mS);
    // leva di armamento sotto la maniglia
    A.add(K.slab([[330, 18, 2], [352, 18, 2], [356, 30, 3], [336, 40, 4], [326, 34, 3]], -4, 4, { b: 1 }), mS, 'manetta');
    A.pivot('manetta', [340, 18, 0]);
    // bipiede ripiegato lungo i fianchi del guardamano
    for (const s of [-1, 1]) {
      A.add(K.rod(350, 552, 4.6, { cy: -14, cz: s * (hw + 2.4), seg: 14 }), mS, 'bipiede');
      A.add(K.latheX([[342, 0], [342, 5.5], [350, 6.6], [356, 0]], { cy: -14, cz: s * (hw + 2.4), seg: 14 }), K.mat('gomma'), 'bipiede');
    }
    A.add(K.slab([[546, -20, 2], [566, -20, 2], [566, -8, 2], [546, -8, 2]], -hw - 5, hw + 5, { b: 1.4 }), mS, 'bipiede');
    A.pivot('bipiede', [556, -14, 0]);
    // canna con manicotto lanciagranate ad anelli
    A.add(K.rod(560, xm, 9, { seg: 22 }), K.mat('nero', null, { r: .38 }));
    A.add(K.latheX([[690, 0], [690, 10.6], [757, 10.6], [757, 8]], { seg: 26 }), K.mat('parker'));
    for (const x of [704, 720, 736]) A.add(K.latheX([[x, 10.4], [x, 11.6], [x + 6, 11.6], [x + 6, 10.4]], { seg: 26 }), K.mat('parker'));
    A.add(K.discX(757.1, 0, 0, 7.5, 1, 18), mD); const xe = 757;
    A.add(K.rod(150, bf, 10.6, { seg: 20 }), K.mat('parker', null, { r: .42 }), 'otturatore'); A.pivot('otturatore', [bf, 0, 0]);
    // caricatore diritto da 25 colpi
    caricatore(A, [176, -20], { len: 160, d0: 58, d1: 60, w: 11.2, ang: -.05, raggio: 0, tipo: 'acciaio' });
    A.pivot('caricatore', [176, -54, 0]);
    maglia(A, 30, -110, 0, 0, 7);
    return chiudiBullpup(A, { azione: 'auto', bossolo: 'fucile', ciclo: { otturatore: { dx: -.08 }, grilletto: { rz: -.12 } }, ricarica: { caricatore: { dy: -.18 } }, armamento: { manetta: { dx: -.06 } } },
      { bocca: [[xe + .5, 0, 0]], espulsione: [[204, 2, hw], [0, .3, 1]], impugnatura: [[278, -92, 0]], grilletto: [[334, -62, 0]], appoggio: [[480, -50, 0]], mira_post: [[138, yl, 0]], mira_ant: [[557, yl, 0]], calcio: [[2, -54, 0]] });
  };
  MAP2[72] = { f: 'bullpup_trombetta', o: {} };

  // ---------------- bullpup inglese: scatola rettangolare in lamiera d'acciaio, ottica a lunga estrazione pupillare con
  // oculare in gomma, guardamano in polimero, leva di armamento a destra in una lunga feritoia
  FAM2.bullpup_acciaio = function (spec, o) {
    init(); o = o || {};
    const A = K.asm('bullpup_acciaio'), mD = mBuio(), mS = K.mat('nero');
    const bf = 227, xm = bf + 518, hw = 16, top = 18, bot = -22;
    const rb = [8, -50, 568, top + 2];
    const p = K.painter(rb, { w: 1024, h: 512, rough: .52 });
    p.text('L', maiusc(spec.produttore), 300, 4, 3.4, { spacing: 3 }); p.text('L', maiusc(spec.nome) + '   ' + String(spec.calibro || '').replace(' mm', ''), 300, -4, 2.8);
    p.text('L', matricola(spec), 300, -11, 2.4);
    p.line('R', K.rrect(208.8, -6.2, 266.2, 10.2, 3), .5, { h: -.5, a: .85 }, true);
    for (const x of [30, 160, 290, 400]) for (const y of [-16, 12]) p.pin('LR', x, y, 1.8, { h: .45, a: 1.08 });
    p.line('LR', [[12, -15], [560, -15]], .5, { h: .4, a: 1.06 });
    p.noise({ a: .12, r: .2, seed: 71 }); p.walls({ r: .55 });
    const mR = K.mat('nero', p.done(2.3), { ns: .8 });
    const ro = [[8, bot, 1, .5], [562, bot, 1, .5], [566, -6, 4], [562, top, 3], [8, top, 3]];
    A.add(K.slab(ro, -hw, 0, { bL: 2.2, bR: 0, uv: rb }), mR);
    A.add(K.slab(ro, 0, hw, { bL: 0, bR: 2.2, uv: rb, holes: [K.rrect(210, -5, 265, 9, 2.5)] }), mR);
    A.add(K.box(210, -5, -1, 265, 9, .2, 0), mD);
    A.add(K.xf(K.slab([[211, -16, 1.5], [264, -16, 1.5], [264, 0, .5], [211, 0, .5]], 0, 1.3, { b: .4, uv: rb }), { r: [-.2, 0, 0], t: [0, -7, hw + .6] }), mR);
    // feritoia e leva di armamento a destra
    A.add(K.box(300, 1, hw - .5, 452, 6, hw + .3, .3), mD);
    A.add(K.box(434, 1.4, hw - 1, 452, 5.6, hw + 1.6, .5), mS, 'otturatore');
    A.add(cilZ(444, 3.5, hw, hw + 13, 2.6, 12), mS, 'otturatore');
    A.add(K.xf(K.latheX([[0, 0], [0, 5], [1.5, 6], [9, 6], [11, 4.6], [11, 0]], { seg: 18 }), { r: [0, -PI / 2, 0], t: [444, 3.5, hw + 11] }), mS, 'otturatore');
    A.add(K.rod(170, bf, 11, { seg: 20 }), K.mat('parker', null, { r: .42 }), 'otturatore'); A.pivot('otturatore', [bf, 0, 0]);
    // calcio in polimero sotto la parte posteriore, calciolo con sportellino, guanciale a sinistra
    const mP = K.mat('polimero', null, { tile: 'grana', rep: [6, 4], r: .6, ns: .25 });
    A.add(K.slab([[10, -100, 6], [10, bot + 1, 0], [168, bot + 1, 0], [168, -40, 8], ['q', 110, -48, 76, -84], [40, -102, 12]], -hw + .5, hw - .5, { b: 3, bs: 4 }), mP);
    A.add(K.slab([[0, -100, 6], [11, -102, 2], [11, top, 3], [0, top - 2, 5]], -hw - 1.5, hw + 1.5, { b: 2.6 }), K.mat('gomma'));
    A.add(K.slab([[70, -12, 6], [210, -12, 6], [210, top - 2, 6], [70, top - 2, 6]], -hw - 4, -hw + .5, { b: 2 }), mP);
    // pozzetto, impugnatura, ponticello
    A.add(K.slab([[164, bot + 1, 0], [234, bot + 1, 0], [234, -44, 3], [238, -50, 1.5], [162, -50, 1.5], [165, -44, 2]], -hw - .5, hw + .5, { b: 1.6, uv: rb }), mR);
    impugnatura(A, 306, 340, bot, { stile: 'dita', ang: 16, len: 92, prof: 1.15, hw: 15 });
    A.add(K.slab([[300, bot + 2, 0], [404, bot + 2, 0], [404, -34, 6], [380, -64, 18], [340, -70, 8], [330, -62, 4], [330, -40, 2]], -8, 8, { b: 2, holes: [[[346, -30, 4], [392, -30, 4], [374, -56, 12], [346, -60, 6]]] }), mP);
    grillettoBullpup(A, 356, -32);
    // guardamano in polimero (sopra e sotto la canna) con nervature
    const hgp = [[404, bot + 4, 0], [552, bot + 4, 0], [556, -30, 6]];
    for (let i = 0; i < 6; i++) { const x = 540 - i * 22; hgp.push([x, -44, 5], [x - 11, -47, 5]); }
    hgp.push([408, -46, 8], [400, -34, 6]);
    A.add(K.slab(hgp, -hw - 2.5, hw + 2.5, { b: 4, bs: 4 }), K.mat('polimero', null, { tile: 'grana', rep: [6, 3], r: .62, ns: .25 }));
    A.add(K.slab([[412, top - 2, 3], [548, top - 2, 3], [548, top + 6, 4], [412, top + 6, 4]], -hw + 2, hw - 2, { b: 2 }), K.mat('polimero', null, { tile: 'grana', rep: [6, 2], r: .62, ns: .25 }));
    for (let i = 0; i < 5; i++) for (const s of [-1, 1]) A.add(K.box(424 + i * 25, -40, s > 0 ? hw + 1.6 : -hw - 3.2, 436 + i * 25, -27, s > 0 ? hw + 3.2 : -hw - 1.6, .8), mD);
    // ottica a ingrandimento fisso con oculare in gomma e mira d'emergenza sopra
    const mO = K.mat('anod', null, { r: .55 }), yo = 54;
    A.add(K.slab([[268, top - 1, 2], [292, top - 1, 2], [290, yo - 12, 4], [270, yo - 12, 4]], -12, 12, { b: 1.6 }), mO);
    A.add(K.slab([[386, top - 1, 2], [410, top - 1, 2], [408, yo - 12, 4], [388, yo - 12, 4]], -12, 12, { b: 1.6 }), mO);
    A.add(sweepX(span(250, 430, 1), () => secSE(32, 17, 17, 16, 3, 3, yo), { ang: 40 }), mO);
    A.add(K.latheX([[430, 13], [430, 17], [446, 19], [452, 19], [452, 16]], { seg: 28, cy: yo }), mO);
    A.add(K.latheX([[214, 15], [214, 22], [222, 24], [240, 21], [252, 15], [252, 12]], { seg: 28, cy: yo }), K.mat('gomma'));
    A.add(K.discX(232, yo, 0, 13, -1, 24), K.mat('lente')); A.add(K.discX(451, yo, 0, 15.5, 1, 26), K.mat('lente'));
    A.add(K.slab([[300, yo + 15, 2], [420, yo + 15, 2], [416, yo + 22, 2], [304, yo + 22, 2]], -5, 5, { b: 1 }), mO);
    A.add(K.slab([[410, yo + 20, .5], [414, yo + 20, .5], [413, yo + 30, .5], [411, yo + 30, .5]], -1.2, 1.2, { b: .3 }), mS);
    A.add(cilZ(340, yo + 4, 15, 22, 7, 16), mO);
    // canna, cilindro del gas, rompifiamma, dente della baionetta
    A.add(K.rod(560, xm, 9, { seg: 22 }), K.mat('nero', null, { r: .38 }));
    A.add(K.slab([[566, -14, 2], [590, -14, 2], [590, 12, 2], [566, 12, 2]], -11, 11, { b: 1.6 }), mS); maglia(A, 578, -24, 0, 0, 6.5);
    C.put(A, C.muzzle('gabbia', xm - 10, 11, { len: 52 })); const xe = xm + 42;
    A.add(K.discX(xe + .1, 0, 0, 3.2, 1, 12), mD);
    A.add(K.box(xm - 30, -18, -4, xm - 14, -10, 4, 1), mS);
    caricatore(A, [200, bot + 2], { len: 182, d0: 59, d1: 64, w: 11.2, ang: .02, dritto: .42, raggio: 330, tipo: 'alluminio' });
    A.pivot('caricatore', [200, -50, 0]);
    return chiudiBullpup(A, { azione: 'auto', bossolo: 'fucile', ciclo: { otturatore: { dx: -.09 }, grilletto: { rz: -.12 } }, ricarica: { caricatore: { dy: -.2 } } },
      { bocca: [[xe + .5, 0, 0]], espulsione: [[238, 2, hw], [0, .3, 1]], impugnatura: [[316, -66, 0]], grilletto: [[356, -42, 0]], appoggio: [[480, -50, 0]], mira_post: [[232, yo, 0]], ottica: [[232, yo, 0]], mira_ant: [[412, yo + 30, 0]], calcio: [[2, -42, 0]] });
  };
  MAP2[77] = { f: 'bullpup_acciaio', o: {} };

  // ---------------- bullpup cinese: guscio unico in polimero, maniglia alta con le mire, ponticello che chiude la mano,
  // guanciale a sinistra; variante d'appoggio con canna lunga, bipiede e caricatore a tamburo
  FAM2.bullpup_cinese = function (spec, o) {
    init(); o = o || {};
    const A = K.asm('bullpup_cinese'), mD = mBuio(), mS = K.mat('nero'), pc = '#262a26';
    const bf = 257, canna = o.canna || 463, xm = bf + canna, hw = 22, yl = 80;
    const path = [[9, -108, 6], [9, 18, 8], [50, 22, 26], [560, 22, 6], [566, 10, 6], [562, -36, 8], [540, -46, 6], [410, -48, 0], [330, -50, 0], [228, -52, 4], [158, -54, 4], [100, -76, 26], [40, -108, 12]];
    guscio(A, path, hw, [0, -114, 570, 24], spec, { xs: 110, ys: -30, finestra: [196, -4, 246, 10], punti: [[420, 10], [550, 10], [550, -34], [420, -34]], linee: [[[60, -6], [180, -6]], [[400, -44], [560, -44]]], perni: [[150, -10], [380, -20]], b: 10, mat: det => K.mat('polimero', det, { ns: .8, c: pc }) });
    A.add(K.slab([[0, -108, 6], [10, -110, 2], [10, 19, 4], [0, 17, 7]], -hw - .5, hw + .5, { b: 3 }), K.mat('gomma'));
    A.add(K.slab([[54, -10, 8], [190, -10, 8], [190, 20, 6], [54, 20, 8]], -hw - 4, -hw + .5, { b: 2.4 }), K.mat('polimero', null, { c: pc, r: .6 }));
    impugnatura(A, 296, 330, -50, { stile: 'dita', ang: 15, len: 88, prof: 1.15, hw: 15, mat: K.mat('polimero', null, { c: pc, tile: 'stipple', rep: [3, 6], r: .8 }) });
    ponticelloGrande(A, 302, 420, -48, -140, K.mat('polimero', null, { c: pc, r: .6 }), { hw: 10 });
    grillettoBullpup(A, 356, -54);
    // maniglia alta con tacca a tamburo dietro e mirino incappucciato davanti
    const mH = K.mat('polimero', null, { c: pc, r: .58 });
    A.add(K.slab([[262, 20, 0], [292, 20, 0], [300, 46, 8], [446, 46, 8], [456, 20, 0], [482, 20, 0], [472, 64, 10], [446, 72, 10], [292, 72, 10], [268, 64, 10]], -9, 9, { b: 3, bs: 4 }), mH);
    A.add(K.slabX([[-9, 70, 1], [9, 70, 1], [9, yl + 6, 3], [5.6, yl + 6, 1], [5.6, 73, 2], [-5.6, 73, 2], [-5.6, yl + 6, 1], [-9, yl + 6, 3]], 270, 290, { b: .8 }), mH);
    A.add(cilZ(280, yl, -5.4, 5.4, 4.6, 16), mS);
    A.add(K.latheX([[456, 6.6], [456, 8.6], [474, 8.6], [474, 6.6]], { seg: 22, cy: yl - 2 }), mH);
    A.add(K.slab([[460, 70, 1], [470, 70, 1], [466, yl - 9, 1], [464, yl - 9, 1]], -2, 2, { b: .5 }), mH);
    A.add(K.slab([[463.5, yl - 10, .3], [466.5, yl - 10, .3], [466, yl, .3], [464, yl, .3]], -1.1, 1.1, { b: .2 }), mS);
    // leva di armamento sotto la maniglia (corre con l'otturatore)
    A.add(K.slab([[370, 21, 2], [390, 21, 2], [392, 32, 3], [374, 36, 3]], -4, 4, { b: 1 }), mS, 'otturatore');
    A.add(K.rod(180, bf, 10.6, { seg: 20 }), K.mat('parker', null, { r: .42 }), 'otturatore'); A.pivot('otturatore', [bf, 0, 0]);
    // canna, blocco del gas, bocca
    const lp = !!o.appoggio;
    A.add(K.rod(560, xm, lp ? 10.4 : 9, { seg: 22 }), K.mat('nero', null, { r: .38 }));
    A.add(K.slab([[566, -16, 2], [592, -16, 2], [592, 12, 2], [566, 12, 2]], -11, 11, { b: 1.6 }), mS);
    A.add(K.box(xm - 34, -19, -4, xm - 16, -10, 4, 1), mS); maglia(A, 580, -24, 0, 0, 6.5);
    C.put(A, C.muzzle('gabbia', xm - 10, 11.5, { len: 50 })); const xe = xm + 40;
    A.add(K.discX(xe + .1, 0, 0, 3.2, 1, 12), mD);
    if (lp) { C.put(A, C.bipod(xm - 70, -11, { len: 240, open: true }), 'bipiede'); A.pivot('bipiede', [xm - 70, -11, 0]); }
    // caricatore curvo o tamburo
    if (lp) {
      const mT = K.mat('polimero', null, { c: '#2a2c2a', r: .55 }), cx = 192, cy = -128;
      A.add(K.slab([[164, -20, 2], [220, -20, 2], [222, -76, 4], [162, -76, 4]], -11.5, 11.5, { b: 1.4 }), mT, 'caricatore');
      A.add(K.latheX([[-29, 0], [-29, 68], [-27, 72], [27, 72], [29, 68], [29, 0]], { seg: 44 }).rotateY(PI / 2).translate(cx, cy, 0), mT, 'caricatore');
      for (const s of [-1, 1]) { A.add(K.xf(K.latheX([[0, 0], [0, 50], [2.5, 52], [2.5, 0]], { seg: 40 }), { r: [0, s > 0 ? -PI / 2 : PI / 2, 0], t: [cx, cy, s * 28.6] }), K.mat('polimero', null, { c: '#1e201e', tile: 'ribs', rep: [1, 16], r: .6 }), 'caricatore'); A.add(cilZ(cx, cy, s * 29, s * 34, 9, 18), mS, 'caricatore'); }
      A.pivot('caricatore', [192, -54, 0]);
    } else {
      caricatore(A, [190, -20], { len: 190, d0: 60, d1: 66, w: 12, ang: .06, dritto: .3, raggio: 300, tipo: 'acciaio' });
      A.pivot('caricatore', [190, -54, 0]);
    }
    maglia(A, 30, -104, 0, 0, 7);
    return chiudiBullpup(A, { azione: 'auto', bossolo: 'fucile', ciclo: { otturatore: { dx: -.09 }, grilletto: { rz: -.12 } }, ricarica: { caricatore: lp ? { dy: -.22, dx: -.02 } : { dy: -.2 } } },
      { bocca: [[xe + .5, 0, 0]], espulsione: [[222, 3, hw], [0, .3, 1]], impugnatura: [[306, -92, 0]], grilletto: [[356, -64, 0]], appoggio: [[490, -52, 0]], mira_post: [[280, yl, 0]], mira_ant: [[465, yl, 0]], calcio: [[2, -44, 0]] });
  };
  MAP2[79] = { f: 'bullpup_cinese', o: {} };
  MAP2[145] = { f: 'bullpup_cinese', o: { appoggio: true, canna: 557 } };

  // ---------------- bullpup israeliano: guscio morbido e tondeggiante, slitta corta con mirino reflex, ponticello che
  // chiude la mano fino al guardamano, leva di armamento a sinistra davanti
  FAM2.bullpup_israeliano = function (spec, o) {
    init(); o = o || {};
    const A = K.asm('bullpup_israeliano'), mD = mBuio(), mS = K.mat('nero'), t = tinta(spec, 'polimero');
    const bf = 230, xm = bf + 460, hw = 23;
    const path = [[10, -102, 10], [10, 14, 10], [60, 20, 30], [552, 20, 8], [560, 6, 8], [556, -36, 12], [530, -48, 8], [430, -50, 0], [320, -52, 0], [220, -54, 4], [150, -56, 6], [100, -76, 30], [40, -102, 16]];
    guscio(A, path, hw, [0, -108, 566, 22], spec, { xs: 90, ys: -30, finestra: [178, -4, 226, 10], punti: [[440, 12], [548, 12], [548, -38], [440, -38]], linee: [[[410, 16], [552, 16]], [[60, -10], [170, -10]]], perni: [[140, -20], [400, -20]], b: 12, mat: det => K.mat('polimero', det, { ns: .8 }) });
    A.add(K.slab([[0, -102, 8], [11, -104, 2], [11, 15, 4], [0, 13, 8]], -hw - .5, hw + .5, { b: 3.4 }), K.mat('gomma'));
    impugnatura(A, 280, 314, -52, { stile: 'dita', ang: 12, len: 86, prof: 1.16, hw: 15, mat: K.mat('polimero', null, { tile: 'stipple', rep: [3, 6], r: .8 }) });
    ponticelloGrande(A, 286, 432, -50, -138, K.mat('polimero', null, { r: .6 }), { hw: 11 });
    grillettoBullpup(A, 340, -56);
    C.put(A, slitta(300, 470, 19.7));
    // mirino reflex squadrato
    const mO = K.mat('anod', null, { r: .5 });
    A.add(K.slab([[326, 29, 2], [408, 29, 2], [404, 38, 3], [330, 38, 3]], -13, 13, { b: 1.6 }), mO);
    A.add(K.slabX([[-14, 36, 3], [14, 36, 3], [14, 70, 7], [-14, 70, 7]], 340, 400, { b: 1.6, holes: [[[-10, 42, 4], [10, 42, 4], [10, 64, 5], [-10, 64, 5]]] }), mO);
    A.add(K.slabX([[-10.2, 41.8, 0], [10.2, 41.8, 0], [10.2, 64.2, 0], [-10.2, 64.2, 0]], 396, 396.6, { b: 0 }), K.mat('lente', null, { c: '#4a6a70', r: .05 }));
    A.add(K.discX(396.7, 53, 0, .8, -1, 10), K.mat('rosso')); A.add(cilZ(372, 52, 14, 20, 6, 16), mO);
    // leva di armamento a sinistra davanti (non corre con l'otturatore)
    A.add(K.box(430, 4, -hw + 1, 520, 9, -hw + 1.6, .3), mD);
    A.add(cilZ(506, 6.5, -hw, -hw - 12, 2.8, 12), mS, 'manetta');
    A.add(K.xf(K.latheX([[0, 0], [0, 5.5], [1.5, 6.6], [10, 6.6], [12, 5], [12, 0]], { seg: 18 }), { r: [0, PI / 2, 0], t: [506, 6.5, -hw - 10] }), mS, 'manetta');
    A.pivot('manetta', [506, 6.5, -hw]);
    A.add(K.rod(170, bf, 10.6, { seg: 20 }), K.mat('parker', null, { r: .42 }), 'otturatore'); A.pivot('otturatore', [bf, 0, 0]);
    A.add(K.rod(556, xm, 9, { seg: 22 }), K.mat('nero', null, { r: .38 }));
    C.put(A, C.muzzle('gabbia', xm - 10, 11, { len: 50 })); const xe = xm + 40;
    A.add(K.discX(xe + .1, 0, 0, 3.2, 1, 12), mD);
    caricatore(A, [184, -20], { len: 182, d0: 59, d1: 64, w: 11.2, ang: .02, dritto: .42, raggio: 330, tipo: 'polimero', c: '#24262a' });
    A.pivot('caricatore', [184, -56, 0]);
    maglia(A, 30, -98, 0, 0, 7); maglia(A, 540, -30, -hw - 2, PI / 2, 7);
    return chiudiBullpup(A, { azione: 'auto', bossolo: 'fucile', ciclo: { otturatore: { dx: -.09 }, grilletto: { rz: -.12 } }, ricarica: { caricatore: { dy: -.2 } }, armamento: { manetta: { dx: -.07 } } },
      { bocca: [[xe + .5, 0, 0]], espulsione: [[202, 3, hw], [0, .3, 1]], impugnatura: [[290, -92, 0]], grilletto: [[340, -66, 0]], appoggio: [[490, -52, 0]], mira_post: [[340, 53, 0]], ottica: [[340, 53, 0]], mira_ant: [[396, 53, 0]], calcio: [[2, -44, 0]] });
  };
  MAP2[80] = { f: 'bullpup_israeliano', o: {} };
})();
