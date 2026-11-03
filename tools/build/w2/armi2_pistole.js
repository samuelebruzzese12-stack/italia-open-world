// Pistole semiautomatiche del gioco (gruppo "pistole", id 0-26 del catalogo): modelli procedurali realistici con parti mobili.
// Tutti i nomi sono di fantasia: i costruttori hanno nomi descrittivi in italiano, le scritte incise usano produttore e nome
// del catalogo del gioco. Misure in mm: x = 0 retro del carrello, y = 0 asse della canna, z verso il lato destro del tiratore.
window.FAM2 = window.FAM2 || {}; window.MAP2 = window.MAP2 || {};
(function () {
  const K = WK2, PI = Math.PI;

  // =====================================================================================================================
  // utilità comuni del gruppo (prefisso ps)
  // =====================================================================================================================
  // materiali costanti condivisi (come quelli semplici del kit)
  const MC = {};
  const psM = (key, kind, o) => MC[key] || (MC[key] = K.mat(kind, null, o));
  const psDark = () => psM('buio', 'nero_lucido', { c: '#050505', r: .7 });
  const psWhite = () => K.mat('bianco');
  // materiale delle canne e dei pezzi in acciaio lucidato
  const psSteel = (k) => k === 'inox' ? psM('canna_inox', 'inox', { r: .3 }) : k === 'nera' ? psM('canna_nera', 'nero', { c: '#26282b', r: .38, m: .8 }) : psM('canna', 'grigio', { c: '#55585c', r: .4, m: .85 });

  // riquadro (con margine) che contiene uno o più percorsi
  function psBB(paths, pad) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const pth of paths) { const b = K.bbox2(K.P2(pth)); x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]); }
    pad = pad === undefined ? 1 : pad; return [x0 - pad, y0 - pad, x1 + pad, y1 + pad];
  }
  // iniziali del produttore (per i loghi incisi)
  const psIni = s => s.split(/[\s&]+/).filter(w => w.length > 2 || /^[A-Z]/.test(w)).map(w => w[0]).join('').toUpperCase().slice(0, 3);
  // calibro breve per le scritte (es. "9×19 mm" -> "9×19")
  const psCal = s => String(s || '').replace(/\s*mm.*$/, '').replace(/\s*\(.*\)/, '').trim();
  // matricola inventata (stabile per id)
  const psSer = (spec, pre) => (pre || '') + String(100000 + ((spec.id || 0) * 7919 + 4111) % 899999).slice(0, 5) + String.fromCharCode(65 + ((spec.id || 0) * 7) % 26);

  // finestra di espulsione: intaglio nel bordo superiore del profilo (lato destro) fra x0 e x1 fino alla quota yb
  function psNotch(path, x0, x1, yb, o) {
    o = o || {}; const P = K.expand(path), n = P.length, out = []; let st = 0;
    const r = o.r === undefined ? 1.2 : o.r, re = o.re === undefined ? .5 : o.re, sl = o.slant || 0;
    const yAt = (a, b, x) => a[1] + (b[1] - a[1]) * (a[0] - x) / (a[0] - b[0]);
    for (let i = 0; i < n; i++) {
      const a = P[i], b = P[(i + 1) % n];
      if (st !== 1) out.push(a);
      if (st === 0 && a[0] >= x1 && b[0] < x1 && Math.min(a[1], b[1]) > yb) { out.push([x1, yAt(a, b, x1), re, .5], [x1 - sl, yb, r, .3]); st = 1; }
      if (st === 1 && a[0] >= x0 && b[0] < x0) { out.push([x0, yb, r, .3], [x0 - (o.back || 0), yAt(a, b, x0 - (o.back || 0)), re, .5]); st = 2; }
    }
    return out;
  }

  // carrello: due metà estruse dal profilo laterale (sinistra piena, destra con la finestra di espulsione)
  // d = {out, outR, port:[x0,x1,yb], portO, hw, b, bs, mat, c, r, m, ns, k, rough, paint(p,bb), part}
  function psSlide(A, d) {
    const outR = d.outR || (d.port ? psNotch(d.out, d.port[0], d.port[1], d.port[2], d.portO) : d.out);
    const bb = d.bb || psBB([d.out], 1.5);
    const p = K.painter(bb, { w: 1024, h: 512, rough: d.rough === undefined ? .42 : d.rough });
    if (d.paint) d.paint(p, bb);
    p.noise({ a: d.na === undefined ? .1 : d.na, r: .14, seed: d.seed || 3 }); p.walls({ r: d.wr === undefined ? .42 : d.wr });
    const m = K.mat(d.mat || 'nero', p.done(d.k || 2.6), { ns: d.ns || .9, c: d.c, m: d.m });
    const part = d.part || 'carrello', b = d.b === undefined ? 2.4 : d.b, hwL = d.hwL || d.hw;
    A.add(K.slab(d.out, -hwL, 0, { bL: b, bR: 0, uv: bb, bs: d.bs }), m, part);
    A.add(K.slab(outR, 0, d.hw, { bL: 0, bR: b, uv: bb, bs: d.bs }), m, part);
    return { m, bb };
  }

  // pezzo estruso con trama del pittore (fusto, impugnatura, guancette): d = {out, z0, z1, b, bL, bR, bs, holes, bb, w, h, mat, c, m, rough, paint(p), k, ns, part}
  function psPainted(d) {
    const bb = d.bb || psBB([d.out], 1.5);
    const p = K.painter(bb, { w: d.w || 1024, h: d.h || 512, rough: d.rough === undefined ? .6 : d.rough });
    if (d.paint) d.paint(p, bb);
    if (d.noise !== false) p.noise({ a: d.na === undefined ? .06 : d.na, r: .1, seed: d.seed || 8 });
    if (d.walls !== false) p.walls({ r: d.wr === undefined ? .66 : d.wr });
    return { p, bb, m: K.mat(d.mat || 'polimero', p.done(d.k || 2.2), { ns: d.ns || .8, c: d.c, m: d.m }) };
  }

  // ---------------------------------------------------------------- mire
  // tacca di mira posteriore (profilo nel piano z,y estruso lungo x fra x0 e x1, base alla quota y0)
  // tipo: 'U' (tacca a U con contorno bianco), '3p' (tacca quadra e due punti bianchi), 'nuda' (tacca quadra senza punti),
  //       'gi' (lamina bassa e stretta), 'larga' (blocco largo con dorso zigrinato e punti), 'trizio' (punti verdi)
  function psRear(A, kind, x0, x1, y0, o) {
    o = o || {}; const part = o.part || 'carrello', m = o.mat || K.mat('nero');
    const w = o.w || 5.6, h = o.h || 6.2, nw = o.nw || 1.75, nd = o.nd || 2.6, top = y0 + h;
    const prof = [[-w, y0 - .6, .5], [w, y0 - .6, .5], [w, top - .6, 1.2], [w - .6, top, .6], [nw, top, .3], [nw, top - nd, kind === 'U' ? nw * .95 : .3], [-nw, top - nd, kind === 'U' ? nw * .95 : .3], [-nw, top, .3], [-w + .6, top, .6], [-w, top - .6, 1.2]];
    if (o.slope) { prof[2][1] = top - .6 - o.slope; } // dorso inclinato
    A.add(K.slabX(prof, x0, x1, { b: o.b === undefined ? .55 : o.b }), m, part);
    const wh = o.dotMat || psWhite();
    if (kind === 'U') { // contorno bianco a U sulla faccia posteriore
      const t = .55, u = [[-nw - t, top - .4], [-nw, top - .4], [-nw, top - nd + .2, nw * .9], [nw, top - nd + .2, nw * .9], [nw, top - .4], [nw + t, top - .4], [nw + t, top - nd - t + .2, nw + t], [-nw - t, top - nd - t + .2, nw + t]];
      A.add(K.slabX(u, x0 - .12, x0 + .05, { b: 0 }), wh, part);
    } else if (kind === '3p' || kind === 'larga' || kind === 'trizio') {
      const dm = kind === 'trizio' ? psM('trizio', 'verdefluo') : wh;
      for (const s of [-1, 1]) A.add(K.discX(x0 - .08, top - nd * .62, s * (nw + (w - nw) * .5), o.dot || 1.05, -1, 14), dm, part);
    }
    if (kind === 'larga') { // dorso con righe orizzontali antiriflesso
      for (let k = 0; k < 4; k++) A.add(K.slabX([[-w + .8, top - 1.4 - k * 1.1], [-nw - .3, top - 1.4 - k * 1.1], [-nw - .3, top - 1.0 - k * 1.1], [-w + .8, top - 1.0 - k * 1.1]], x0 - .25, x0 + .1, { b: 0 }), psDark(), part);
    }
    return top;
  }
  // mirino: profilo laterale estruso in z (mezza larghezza w), base y0, alto h
  // tipo: 'punto' (punto bianco), 'lama' (lamina nuda), 'rampa' (rampa zigrinata), 'mezzaluna', 'fibra' (fibra ottica colorata), 'trizio'
  function psFront(A, kind, x0, x1, y0, o) {
    o = o || {}; const part = o.part || 'carrello', m = o.mat || K.mat('nero'), w = o.w || 1.65, h = o.h || 5.4, top = y0 + h;
    let prof;
    if (kind === 'rampa') prof = [[x0, y0 - .5, 0], [x1, y0 - .5, 0], [x1, top - .5, .8], [x1 - 1.5, top, .6], [x0 + (x1 - x0) * .35, top, 1], [x0, y0 + .3, .5]];
    else if (kind === 'mezzaluna') prof = [[x0, y0 - .5, 0], [x1, y0 - .5, 0], ['q', x1 + 1, top, (x0 + x1) / 2, top], ['q', x0 - 1, top, x0, y0 + .2]];
    else prof = [[x0, y0 - .5, .3], [x1, y0 - .5, .3], [x1 - .5, top, .7], [x0 + .4, top, .5]];
    A.add(K.slab(prof, -w, w, { b: Math.min(.45, w * .4) }), m, part);
    const xd = x0 + .4 * (h - 1) / (h + .5) - .06; // faccia posteriore inclinata all'altezza del punto
    if (kind === 'punto') A.add(K.discX(xd, top - 1.5, 0, o.dot || .95, -1, 14), psWhite(), part);
    if (kind === 'trizio') A.add(K.discX(xd, top - 1.5, 0, o.dot || .95, -1, 14), psM('trizio', 'verdefluo'), part);
    if (kind === 'fibra') A.add(K.rod(x0 + .3, x1 - .6, .9, { cy: top - 1.3, seg: 10 }), psM('fibra_' + (o.col || 'rosso'), o.col || 'rosso'), part);
    if (kind === 'rampa') for (let k = 0; k < 5; k++) { const xx = x0 + (x1 - x0) * (.42 + k * .1); A.add(K.box(xx, top - .25 - (k === 0 ? .4 : 0), -w + .2, xx + .35, top + .12, w - .2, 0), psDark(), part); }
    return top;
  }

  // ---------------------------------------------------------------- canna
  // d = {x0, x1 (bocca), r, ri, hood:[x0,x1,yTop,hw], fisso, mat, crown (sporgenza dal carrello)}
  function psBarrel(A, d) {
    const part = d.fisso ? 'corpo' : 'canna', m = d.mat || psSteel();
    A.add(K.tube(d.x0, d.x1, d.r, d.ri, { seg: d.seg || 28 }), m, part);
    A.add(K.discX(d.x1 - 4.5, 0, 0, d.ri + .05, 1, 18), psDark(), part);
    if (d.hood) { const [h0, h1, ht, hw] = d.hood; A.add(K.slab([[h0, -3, .5], [h1, -3, .5], [h1, ht, .9], [h0, ht, .9]], -hw, hw, { b: .7 }), m, part);
      // gradino della camera visto nella finestra (il fronte della camera è più basso)
      if (d.step) A.add(K.slab([[h1 - .1, -3], [h1 + d.step, -3], [h1 + d.step, ht - 2.4, .8], [h1 - .1, ht - 2.4]], -hw + .6, hw - .6, { b: .5 }), m, part); }
    if (!d.fisso) A.pivot('canna', [d.x1, 0, 0]);
  }
  // bocca del carrello: luce scura attorno alla canna e foro della guida della molla
  function psMuzzle(A, x, r, o) {
    o = o || {}; const part = o.part || 'carrello';
    A.add(K.discX(x + .04, 0, 0, r, 1, 30), psDark(), part);
    if (o.guide) A.add(K.discX(x + .04, o.guide[0], 0, o.guide[1], 1, 18), psDark(), part);
  }

  // ---------------------------------------------------------------- cane (perno in (px,py), cane abbassato)
  // tipo: 'sperone' (sperone largo zigrinato), 'anello' (testa tonda con foro), 'tondo' (sperone tondo con foro piccolo),
  //       'mozzo' (moncone basso arrotondato), 'stretto' (sperone sottile), 'pm' (sperone tondo a pettine)
  function psHammer(A, kind, px, py, o) {
    o = o || {}; const w = o.w || 3, m = o.mat || K.mat('brunito'), s = o.s || 1, part = 'cane';
    let pth, holes = [];
    if (kind === 'sperone') pth = [[-4.5, -4, 3], [4, -5, 3], [6.6, 2, 2], [7.2, 10, 1], [7, 15.5, .6], [5.4, 19, 2], [1, 21.6, 3], [-5, 22.8, 2], [-10.6, 21.4, 1.5], [-11.4, 18.8, 1.5], [-7.2, 16.6, 3], [-6.2, 10, 4], [-6, 4, 3]];
    else if (kind === 'anello') { pth = [[-4.5, -4, 3], [4, -5, 3], [6.6, 2, 2], [7.2, 10, 1], [6.8, 15, 2], [3.6, 20.4, 4], [-2.6, 22.6, 5], [-8.6, 20.6, 4], [-10.8, 15.6, 4], [-8.6, 10.6, 4], [-6.2, 4, 3]]; holes = [K.circ(-3.4, 15.4, 3, 18)]; }
    else if (kind === 'tondo') { pth = [[-4.5, -4, 3], [4, -5, 3], [6.6, 2, 2], [7.2, 10, 1], [6.8, 15.6, 2], [3, 20.4, 3], [-2.6, 21.8, 4], [-8.4, 20.4, 3], [-10.2, 17.4, 2.5], [-7.8, 12, 4], [-6.2, 4, 3]]; holes = [K.circ(-3.2, 16.4, 2, 14)]; }
    else if (kind === 'mozzo') pth = [[-4.5, -4, 3], [4, -5, 3], [6.6, 2, 2], [7.2, 10, 1], [6.6, 15.5, 2.5], [2, 18.6, 3], [-4.5, 18.6, 3], [-8.2, 15, 3], [-7.6, 9, 3], [-6.2, 3, 3]];
    else if (kind === 'stretto') pth = [[-4.2, -4, 3], [3.8, -5, 3], [6.2, 2, 2], [6.8, 10, 1], [6.6, 15.4, .5], [4.4, 18.6, 2], [-.6, 21, 3], [-7, 22, 2], [-10.4, 21, 1.5], [-10.4, 18.8, 1.5], [-6.6, 17.4, 3], [-5.4, 11, 4], [-5.6, 4, 3]];
    else /* pm */ pth = [[-4.5, -4, 3], [4, -5, 3], [6.6, 2, 2], [7.2, 10, 1], [6.6, 15.6, 2], [2.4, 20.4, 4], [-4, 22.2, 4], [-9.4, 20.2, 3.5], [-10, 15.8, 3], [-7, 11.6, 4], [-6.2, 4, 3]];
    const g = K.slab(pth, -w, w, { b: Math.min(1, w * .3), holes });
    if (s !== 1) g.scale(s, s, 1);
    if (o.rot) K.xf(g, { r: [0, 0, o.rot] });
    g.translate(px, py, 0); A.add(g, m, part);
    // zigrinatura del dorso (righe trasversali sullo sperone)
    if (o.ribs !== false && kind !== 'mozzo') {
      const rib = kind === 'sperone' ? [[-9.6, 21.6], [-6.8, 22.5], [-4, 22.6], [-1.2, 22]] : kind === 'stretto' ? [[-9.4, 21.4], [-6.8, 21.9], [-4.2, 21.6], [-1.6, 20.9]] : kind === 'pm' ? [[-8.8, 20], [-6.6, 21.6], [-4, 22.2], [-1.4, 21.6]] : [[-8, 20.4], [-5.6, 21.6], [-2.8, 21.9]];
      for (const [x, y] of rib) { const q = K.box(-.35, -.55, -w + .3, .35, .45, w - .3, 0); K.xf(q, { r: [0, 0, Math.atan2(y - 6, x + 2) - PI / 2] }); q.translate(x * s, y * s, 0); if (o.rot) K.xf(q, { r: [0, 0, o.rot] }); q.translate(px, py, 0); A.add(q, psDark(), part); }
    }
    A.pivot('cane', [px, py, 0]);
  }

  // ---------------------------------------------------------------- grilletto (perno in alto)
  // tipo: 'curvo' (grilletto d'acciaio curvo), 'lamella' (con lamella di sicura al centro), 'piatto' (faccia piatta),
  //       'scorrevole' (pattino diritto zigrinato), 'largo' (polimero largo con faccia curva)
  function psTrigger(A, kind, px, py, o) {
    o = o || {}; const m = o.mat || K.mat('nero'), s = o.s || 1, part = 'grilletto';
    let pth, w = o.w || 3;
    if (kind === 'curvo') pth = [[-2.4, .5], [2.6, .5, 1], [3.6, -5, 5], [3.3, -11, 6], [1.6, -16, 4], [-1, -19.6, 1.2], [-3, -19.6, 1], [-3.2, -17.6, 2], [-1.2, -13.6, 5], [-.6, -8.4, 6], [-1.4, -3, 3]];
    else if (kind === 'lamella' || kind === 'largo') { pth = [[-2.2, .5], [2.8, -.5, 1], [3.6, -6, 5], [2.6, -12.5, 6], [-.2, -18.4, 1.2], [-3.2, -18.4, 1], [-2.6, -15.4, 3], [-1.4, -10, 6], [-1.8, -4, 3]]; w = o.w || 3.5; }
    else if (kind === 'piatto') { pth = [[-2.2, .5], [2.8, -.5, 1], [3.6, -5, 3], [3.6, -16.6, 1.2], [2.6, -18.6, 1], [-1.2, -18.6, 1], [-1.8, -16, 2], [-1.2, -9, 5], [-1.8, -3, 3]]; w = o.w || 3.3; }
    else /* scorrevole */ { pth = [[-3.5, .5], [3, .5], [3, -1.5, .5], [2.2, -2.2, .4], [2.2, -14, 1.2], [1.2, -15.6, 1], [-2.6, -15.6, 1], [-3.5, -14, 1]]; w = o.w || 3; }
    const g = K.slab(pth, -w, w, { b: Math.min(.9, w * .28) }); if (s !== 1) g.scale(s, s, 1); g.translate(px, py, 0); A.add(g, m, part);
    if (kind === 'lamella') A.add(K.slab([[1.6, -3.6, .4], [3.6, -4.5, .4], [3.4, -9, 2], [1.6, -14.6, .4], [.4, -14, .4], [1.2, -8, 2]], -1.05, 1.05, { b: .3 }).translate(px, py, 0), o.mat2 || psDark(), part);
    if (kind === 'scorrevole') for (let k = 0; k < 6; k++) A.add(K.box(2.0, -3.6 - k * 1.8, -w + .3, 2.5, -3.1 - k * 1.8, w - .3, 0).translate(px, py, 0), psDark(), part);
    A.pivot('grilletto', [px, py, 0]);
  }

  // ---------------------------------------------------------------- caricatore: fondello e corpo (parte mobile)
  // d = {a:[x,y] retro del fondo dell'impugnatura, b:[x,y] davanti, base: percorso locale del fondello (x lungo il fondo da 0=a, y su),
  //      w: mezza larghezza del fondello, body: [hw, alto, x0, x1] corpo nascosto, mat, matBody}
  function psMag(A, d) {
    const ang = Math.atan2(d.b[1] - d.a[1], d.b[0] - d.a[0]);
    const tf = g => K.xf(g, { r: [0, 0, ang], t: [d.a[0], d.a[1], 0] });
    A.add(tf(K.slab(d.base, -d.w, d.w, { b: d.bb === undefined ? 1.5 : d.bb, bs: 3 })), d.mat, 'caricatore');
    if (d.body) { const [hw, hh, x0, x1] = d.body; A.add(tf(K.box(x0, 0, -hw, x1, hh, hw, .8)), d.matBody || K.mat('nero'), 'caricatore'); }
    if (d.extra) for (const [g, mm] of d.extra) A.add(tf(g), mm, 'caricatore');
    A.pivot('caricatore', [(d.a[0] + d.b[0]) / 2, (d.a[1] + d.b[1]) / 2, 0]);
    // spostamento per la ricarica: lungo l'asse dell'impugnatura (perpendicolare al fondo), in metri
    const len = (d.drop || 115) * .001; return { dx: -Math.sin(-ang) * len, dy: -Math.cos(ang) * len };
  }

  // ---------------------------------------------------------------- slitta integrata sotto il copricanna
  // profilo laterale con gli intagli trasversali: da x0 a x1, attacco alla quota y, altezza h, mezza larghezza hw
  function psRail(x0, x1, y, h, hw, slots, sw, o) {
    o = o || {}; const pth = [[x0, y + .5, 0, .4], [x1, y + .5, 0, .4], [x1, y - h, .6, .5]];
    for (const s of slots.slice().sort((a, b) => b - a)) pth.push([s + sw / 2, y - h, .3, .4], [s + sw / 2, y - h * .45, .5, .4], [s - sw / 2, y - h * .45, .5, .4], [s - sw / 2, y - h, .3, .4]);
    pth.push([x0 + (o.ramp || 0), y - h, .6, .5]);
    return pth;
  }

  // leva o pulsante estruso su un lato: z0..z1 (lato sinistro: z negativi)
  const psLever = (A, pth, z0, z1, m, part, b) => A.add(K.slab(pth, z0, z1, { b: b === undefined ? .45 : b }), m, part || 'corpo');
  // bottone tondo rivolto verso -z o +z (sgancio del caricatore, sicura a pulsante)
  function psButton(A, x, y, z, r, side, m, h, part) {
    const g = K.latheX([[0, 0], [0, r], [h * .7, r], [h, r * .82], [h, 0]], { seg: 18 }); g.rotateY(side < 0 ? PI / 2 : -PI / 2); g.translate(x, y, z); A.add(g, m, part || 'corpo');
  }
  // perni passanti visibili su entrambi i lati (testa tonda appena rilevata)
  function psPin(A, x, y, hw, r, m) { A.add(K.rod(0, 2 * hw + .6, r, { seg: 12 }).rotateY(-PI / 2).translate(x, y, -hw - .3), m || K.mat('nero')); }

  // dita: incavi lungo il davanti dell'impugnatura fra (xa,ya) in alto e (xb,yb) in basso; n incavi profondi d.
  // I punti vanno dal basso verso l'alto (verso del contorno dell'impugnatura).
  function psFingers(xa, ya, xb, yb, n, d, s) {
    const pts = [], N = n * 8;
    for (let i = N - 1; i >= 1; i--) { const t = i / N, x = xa + (xb - xa) * t, y = ya + (yb - ya) * t, k = Math.pow(Math.abs(Math.sin(PI * t * n)), .7); pts.push([x - d * k, y, 0, s === undefined ? 1 : s]); }
    return pts;
  }

  // scritte standard del carrello (lato sinistro: nome e produttore; lato destro: matricola)
  function psMarks(p, spec, x, y, o) {
    o = o || {}; const h = o.h || 4.6;
    p.text(o.side || 'L', (o.nome || spec.nome || '').toUpperCase(), x, y, h, { spacing: o.sp === undefined ? 8 : o.sp, weight: o.weight });
    if (o.sub !== false) p.text(o.side || 'L', (spec.produttore || '').toUpperCase() + (o.paese === false ? '' : '  ' + (spec.paese || '').toUpperCase().split(/[\s/]/)[0]), x + (o.dx2 || 0), y - h * .5 - 2.6, o.h2 || 2.1);
  }

  // ponticello del grilletto (fascia sottile): op = [x retro apertura, x fronte apertura, y fondo apertura], yt = quota dove entra nel copricanna,
  // fr = spessore davanti, bt = spessore sotto, st = forma ('squadra', 'tonda', 'uncino', 'obliqua', 'gradino'), xr = x dove la fascia entra nell'impugnatura
  function psGuard(o) {
    const [x0, x1, yb] = o.op, fr = o.fr || 6.8, bt = o.bt || 6.6, yt = o.yt, st = o.st || 'squadra', xr = o.xr || x0 - 12, ob = yb - bt, xf = x1 + fr;
    let front;
    if (st === 'squadra') front = [[xf + .8, yt, 0], [xf, ob + 4.5, 2.6], [xf - 3.2, ob, 3.4]];
    else if (st === 'tonda') front = [[xf + 1.2, yt, 0], [xf - .4, ob + 12, 10], [xf - 10, ob, 10]];
    else if (st === 'uncino') front = [[xf + .2, yt, 0], [xf - 1.6, ob + 10, 5], [xf + 1.4, ob + 4, 1.2], [xf + .6, ob + 1, 1.4], [xf - 2.4, ob, 1.6]];
    else if (st === 'gradino') front = [[xf + .4, yt, 0], [xf, ob + 6, 1.4], [xf + 2.4, ob + 4.2, .8], [xf + 1.6, ob, 1.6]];
    else /* obliqua */ front = [[xf - .6, yt, 0], [xf + 2.4, ob + 4.5, 3.6], [xf - 2, ob, 4.2]];
    return front.concat([[x0 + 9, ob, o.ru || 8], [xr + 4, ob + 3.4, 4], [xr, ob + 8], [xr, yb + 4], [x0 + .4, yb + 4, 1.4], [x0 + 4.4, yb, 4], [x1 - 1, yb, o.ri || 3], [x1 + .2, yt, 0]]);
  }

  // impugnatura in polimero dai parametri: rake = inclinazione dalla verticale (gradi: 22 = angolo 112° con la canna), J = davanti in alto
  // (raccordo col ponticello), yb = quota del fondo davanti, D = profondità orizzontale a metà altezza, hump = rigonfiamento del palmo,
  // ext = quanto il dorso si allarga verso la coda in alto, web = incavo della mano sotto la coda, xo = retro dell'apertura del ponticello,
  // dita = [numero, profondità] degli incavi per le dita (null = davanti liscio), bulge = leggera pancia del davanti
  function psGripP(g) {
    const a = g.rake * PI / 180, ca = Math.cos(a), sa = Math.sin(a), J = g.J, B = [J[0] - (J[1] - g.yb) * Math.tan(a), g.yb];
    const Dp = g.D * ca, hump = g.hump === undefined ? 2 : g.hump, ext = g.ext === undefined ? 12 : g.ext;
    const F = t => [J[0] + (B[0] - J[0]) * t, J[1] + (B[1] - J[1]) * t];
    const bk = t => { const f = F(t), d = Dp + ext * Math.pow(Math.max(0, 1 - t / .45), 2) + hump * Math.sin(PI * Math.min(1, Math.max(0, (t - .1) / .75))) - 2 * t; return [f[0] - d * ca, f[1] + d * sa]; };
    const R = bk(1), out = [[g.xo - 4, -22, 3, 1], [g.web[0] + 8, -20, 4, 1], [g.web[0], g.web[1], 6, 1]];
    for (const t of [.14, .32, .5, .68, .86]) { const p = bk(t); out.push([p[0], p[1], 14, 1]); }
    out.push([R[0], R[1], 3.6, .9], [B[0], B[1], 3.6, .9]);
    if (g.dita) for (const p of psFingers(J[0] - .4, J[1] - .6, B[0] + 1.2, B[1] + 3, g.dita[0], g.dita[1])) out.push(p);
    else { const q1 = F(.88), q2 = F(.45); out.push([q1[0] + .5, q1[1], 8, 1], [q2[0] + (g.bulge === undefined ? 1 : g.bulge), q2[1], 40, 1]); }
    out.push([J[0], J[1], 3, 1], [J[0] + 4.2, J[1] + 5.4, 2, 1], [g.xo - 1.6, -31, 3, 1], [g.xo - 1.6, -25, 3, 1]);
    const zone = [], ins = 4.4;
    for (const t of [.1, .3, .5, .7, .9]) { const p = bk(t); zone.push([p[0] + ins * ca, p[1] - ins * sa]); }
    for (const t of [.92, .5, .08]) { const p = F(t); zone.push([p[0] - ins * ca, p[1] + ins * sa]); }
    const c = F(.42); return { out, R, B, zone, c: [c[0] - g.D * .5, c[1] - 2] };
  }
  // parte alta dell'impugnatura con la coda (larga quasi come il carrello): xf = davanti, tang = punti della coda dal carrello al dorso, yb = fondo (nascosto)
  const psFrG = (xf, bot, tang, yb) => [[xf + 5, bot, 0, .5]].concat(tang, [[2, yb, 0, 1], [xf - 3, yb - 2, 3, 1], [xf + 5, -22, 6, 1]]);
  // raccordo morbido fra il bordo alto e il davanti dell'impugnatura (niente spigolo sporgente accanto al ponticello):
  // il primo punto è l'angolo alto davanti, il secondo l'alto dietro, gli ultimi due il davanti sotto il fusto
  function psSoftGrip(g) {
    const out = g.map(p => p.slice()), a = out[0], b = out[1], n = out.length, z = out[n - 1];
    const t = 18 / Math.max(20, a[0] - b[0]);
    out[0] = [a[0] - (a[0] - b[0]) * t, a[1] + (b[1] - a[1]) * t - .3, 8, 1];
    out[n - 1] = [z[0] - 4, z[1] - 4, 10, 1];
    return out;
  }
  // parte bassa in polimero: fusto alto (guide, copricanna e coda) stretto, ponticello sottile, slitta, impugnatura larga
  // d = {frU, hwU, bU, guard, hwG, bG, rail:[x0,x1,y,h,hw,slots,sw], grip, hwP, bP, col, c, paintU(p), paintG(p)}
  function psPolyLower(A, d) {
    const fbb = psBB(d.frG ? [d.frU, d.guard, d.frG] : [d.frU, d.guard], 1.5);
    const F = psPainted({ out: d.frU, bb: fbb, mat: d.col, c: d.c, rough: .64, paint: d.paintU });
    A.add(K.slab(d.frU, -d.hwU, d.hwU, { b: d.bU || 2.2, uv: fbb }), F.m);
    if (d.frG) A.add(K.slab(d.frG, -d.hwF, d.hwF, { b: d.bF || 2.8, bs: 3, uv: fbb }), F.m);
    A.add(K.slab(d.guard, -d.hwG, d.hwG, { b: d.bG || 2.3, uv: fbb }), F.m);
    if (d.rail) A.add(K.slab(psRail(...d.rail), -d.rail[4], d.rail[4], { b: .55, uv: fbb }), F.m);
    const grip = d.frG && d.soft !== false ? psSoftGrip(d.grip) : d.grip;
    const gbb = psBB([grip], 1.5);
    const G = psPainted({ out: grip, bb: gbb, w: 1024, h: 1024, mat: d.col, c: d.c, rough: .76, paint: d.paintG, wr: .8 });
    A.add(K.slab(grip, -d.hwP, d.hwP, { b: d.bP || 6.4, bs: 4, uv: gbb }), G.m);
    return { F, G, fbb, gbb };
  }
  // trama standard dell'impugnatura in polimero: zona puntinata (o quadrettata) con bordo inciso, pareti puntinate, logo
  function psGripTex(p, zone, o) {
    o = o || {};
    if (o.checker) { p.checker('LR', zone, o.checker, { r: .84 }); }
    else p.stipple('LR', zone, { s: o.s || .26, r: .9, k: o.k });
    if (o.border !== false) p.line('LR', zone, .45, { h: -.55, a: .8 }, true);
    if (o.ws) p.wallStipple({ s: o.ws, ay: .6, k: .5 }); p.wallFill({ r: .84 });
  }
  // punti di riferimento comuni: a = {L, port:[x0,x1], hw, gc:[x,y] centro dell'impugnatura, tg:[x,y] perno del grilletto, rs:[x,y] tacca, fs:[x,y] mirino, ghw}
  function psAnchors(A, a) {
    A.anchor('bocca', [a.L + .5, 0, 0]); A.anchor('espulsione', [(a.port[0] + a.port[1]) / 2, 8, a.hw], [0, .4, 1]);
    A.anchor('impugnatura', [a.gc[0], a.gc[1], 0]); A.anchor('grilletto', [a.tg[0] + 1.5, a.tg[1] - 13, 0]);
    A.anchor('appoggio', [a.gc[0], a.gc[1] - 12, -(a.ghw || 14.5) - 2]); A.anchor('mira_post', [a.rs[0], a.rs[1], 0]); A.anchor('mira_ant', [a.fs[0], a.fs[1], 0]);
  }

  // costruzione comune delle pistole in polimero: P = descrizione del modello
  // P = {nome, L, slide:{...psSlide}, rear:[tipo,x0,x1,o], front:[tipo,x0,x1,o], muz, guide, barrel:{...}, lower:{...psPolyLower},
  //      trigger:[tipo,px,py,o], hammer:[tipo,px,py,o], levers:[[percorso,z0,z1,mat,parte]], slideX(A), extra(A,Lo), mag:{...psMag}, gc, ciclo}
  function psPolyGun(spec, P) {
    const A = K.asm(P.nome), top = P.top, sl = P.slide, ar = P.arr || 0;
    if (ar) { // ponticello, grilletto e comandi arretrati di |ar| mm (il copricanna resta dov'è)
      const sh = pth => pth.map(p => typeof p[0] === 'string' || p[0] <= 50 || p[0] >= 125 ? p : [p[0] + ar].concat(p.slice(1)));
      P.lower.frU = sh(P.lower.frU); if (P.lower.frG) P.lower.frG = sh(P.lower.frG);
      P.lower.guard = P.lower.guard.map(p => [p[0] + ar].concat(p.slice(1)));
      P.trigger = [P.trigger[0], P.trigger[1] + ar, P.trigger[2], P.trigger[3]];
      P.levers = (P.levers || []).map(lv => { const xs = lv[0].map(p => p[0]), xm = (Math.min(...xs) + Math.max(...xs)) / 2; return xm > 40 && xm < 125 ? [lv[0].map(p => [p[0] + ar].concat(p.slice(1)))].concat(lv.slice(1)) : lv; });
    }
    psSlide(A, sl);
    const rt = P.rear ? psRear(A, P.rear[0], P.rear[1], P.rear[2], top - .4, P.rear[3]) : top;
    const ft = P.front ? psFront(A, P.front[0], P.front[1], P.front[2], top - .4, P.front[3]) : top;
    psMuzzle(A, P.L, P.muz || 7.3, { guide: P.guide === undefined ? [-8.6, 2.6] : P.guide });
    psBarrel(A, P.barrel);
    if (P.slideX) P.slideX(A);
    const Lo = psPolyLower(A, P.lower);
    if (P.flare) { // bocca del pozzetto del caricatore svasata
      const ma = P.mag.a, mb = P.mag.b, ml = Math.hypot(mb[0] - ma[0], mb[1] - ma[1]), e = P.flare;
      A.add(K.xf(K.slab([[-e, -1, 2], [ml + e, -1, 2], [ml + e + 1, 3.4, 2], [-e - 1, 3.4, 2]], -P.lower.hwP - 1.1, P.lower.hwP + 1.1, { b: 1.6 }), { r: [0, 0, Math.atan2(mb[1] - ma[1], mb[0] - ma[0])], t: [ma[0], ma[1], 0] }), Lo.G.m);
    }
    if (P.hammer) psHammer(A, P.hammer[0], P.hammer[1], P.hammer[2], P.hammer[3]);
    psTrigger(A, P.trigger[0], P.trigger[1], P.trigger[2], P.trigger[3]);
    for (const lv of P.levers || []) psLever(A, lv[0], lv[1], lv[2], lv[3], lv[4], lv[5]);
    if (P.extra) P.extra(A, Lo);
    const rel = psMag(A, P.mag);
    psAnchors(A, { L: P.L, port: sl.port, hw: sl.hw, gc: P.gc, tg: [P.trigger[1], P.trigger[2]], rs: [(P.rear[1] + P.rear[2]) / 2, rt], fs: [(P.front[1] + P.front[2]) / 2, ft], ghw: P.lower.hwP });
    const r = A.done();
    const ciclo = Object.assign({ carrello: { dx: -(P.corsa || 36) * .001 }, grilletto: { rz: -.12 } }, P.barrel.fisso ? {} : { canna: { dx: -.003, rz: P.tilt === undefined ? .03 : P.tilt } }, P.hammer ? { cane: { rz: .62 } } : {}, P.ciclo || {});
    r.info = { azione: 'semi', bossolo: 'pistola', ciclo, ricarica: { caricatore: rel } };
    return r;
  }
  // percorso del fondello del caricatore (locale: x lungo il fondo dell'impugnatura, y su); ml = lunghezza del fondo
  function psBase(ml, o) {
    o = o || {}; const fw = o.fw || 2.5, bk = o.bk || 0, d = o.d || 6.4;
    if (o.dito) return [[.2, .5, 0, .3], [ml + .5, .5, 0, .3], [ml + 4.5, -2.6, 2, 1], [ml + 3.5, -6.5, 2.5, 1], [ml - 9, -5.6, 5, 1], [ml - 18, -d + .6, 4, 1], [.2 - bk, -d + .6, 2.5, 1]];
    return [[.2 - bk, .5, 0, .3], [ml + .5, .5, 0, .3], [ml + fw + .5, -d * .45, 1.2, 1], [ml + .5, -d, 2.5, 1], [.4 - bk, -d, 2.5, 1], [-.6 - bk, -d * .4, 1, 1]];
  }
  const psMagO = (a, b, col, o) => { o = o || {}; const ml = Math.hypot(b[0] - a[0], b[1] - a[1]); return { a, b, w: o.w || 13.5, mat: K.mat(col, null, { r: .6, c: o.c }), base: psBase(ml, o), body: [o.bw || 10.8, 92, 12, ml - 6], drop: o.drop || 118 }; };

  // =====================================================================================================================
  // 1) pistole in polimero a percussore con carrello squadrato (id 11 standard, 12 compatta, 22 ibrida color sabbia)
  // =====================================================================================================================
  FAM2.pistola_polimero_squadrata = function (spec, o) {
    o = o || {}; const v = o.variante || 'standard', corto = v !== 'standard', g5 = v === 'ibrida';
    const L = corto ? 173 : 186.5, top = 15.2, bot = -13.3, hw = 12.7, dg = v === 'compatta' ? 11 : 0, col = g5 ? 'coyote' : 'polimero';
    const nose = g5 ? [[L - 11.5, bot, 3, .35], [L - 1.2, bot + 7.5, 3, .6], [L, top - 2.5, 2.5, 1], [L - .8, top, 2.2, 1]] : [[L - 4.5, bot, 1.2, .35], [L, bot + 4.5, 1.2, .6], [L, top, 2.4, 1]];
    const fx = L - 14.5, rl = g5 ? [fx - 47, fx - 4] : [fx - 44, fx - 6];
    const G = psGripP({ rake: 22, J: [56.4, -46], yb: -113.4 + dg + (g5 ? 1 : 0), D: 53, hump: 2.4, web: [-3.6, -25.4], xo: 64.4, dita: g5 ? null : [3, 2.2], ext: 10 }), ma = G.R, mb = G.B, grip = G.out;
    const mL = K.mat('nero', null, { r: .45 }), mC = K.mat(col);
    const slideStop = [[55.5, -13.6, .8], [79.5, -13.6, .8], [80.5, -15.8, 1], [63, -17.4, 1.5], [57, -18.6, 1.5]];
    return psPolyGun(spec, {
      nome: 'pistola_polimero_squadrata', L, top,
      slide: { out: [[0, bot, .8, .35]].concat(nose, [[0, top, 1.5, 1]]), port: [63, 101, 2.6], hw, b: 2.7, mat: g5 ? 'coyote' : 'nero', m: g5 ? .3 : undefined, rough: g5 ? .5 : .4,
        paint(p) {
          p.grooves('LR', 5.5, 34, bot + 1.5, top - 1.3, 2.95, { wr: .5 });
          if (g5) p.grooves('LR', L - 30, L - 13, bot + 1.5, top - 1.3, 2.95, { wr: .5 });
          p.text('L', spec.nome.split(' ')[0].toUpperCase(), 120, 6.2, 5.6, { spacing: 12 });
          p.text('L', spec.produttore.toUpperCase() + '  ' + spec.paese.toUpperCase(), 120, -.6, 2.2);
          p.text('L', psCal(spec.calibro), 120, -6.2, 2.4);
          p.text('R', psSer(spec, 'GRW '), L - 40, -7.6, 2.3);
          p.fill('R', K.rrect(45, 3.6, 62.6, 9.4, .9), { h: .3, a: .9 }); p.line('R', K.rrect(45, 3.6, 62.6, 9.4, .9), .25, { h: -.7, a: .55 }, true);
          p.pin('LR', 24, -8.6, 1.2, { h: .15, a: .8 });
        } },
      rear: [g5 ? 'trizio' : 'U', 7.5, 16.5, { w: 5.6, h: 6.2 }], front: [g5 ? 'trizio' : 'punto', L - 15.5, L - 9.5, { h: 5.4 }],
      barrel: { x0: 54, x1: L + .3, r: 6.75, ri: 4.5, hood: [63.4, 100.6, top - .5, 6.6], mat: psSteel('nera') },
      slideX(A) { A.add(K.box(-.35, -9.5, -6.2, .2, 9.5, 6.2, .5), mC, 'carrello'); },
      lower: { col, hwU: 10.6, hwG: 5.5, hwP: 15.2, bP: 7.2, hwF: 12.2,
        frG: psFrG(64, bot, [[-3, bot, 1, .6], [-7.6, -15.6, 2, .8], [-9.2, -20.2, 2.5, .9], [-4.6, -22.6, 2.6, 1], [-1.6, -26.8, 4, 1]], -30),
        frU: [[-3, bot, .5, .4], [fx, bot, 0, .4], [fx, -26.9, 2.6, .6], [111, -27.6, 2, .6], [108.4, -22.8, 1.6, .6], [72.5, -22.8, 2.5, .6], [70, -26, 0, .6], [40, -28, 0, .6], [2, -30, 0, .6], [-1.6, -26.8, 4, 1], [-4.6, -22.6, 2.6, 1], [-9.2, -20.2, 2.5, .9], [-7.6, -15.6, 2, .8]],
        guard: psGuard({ op: [71.4, 104.6, -44.4], yt: -26.5, fr: 7, bt: 6.6, st: 'squadra', xr: 58 }),
        rail: [rl[0], rl[1], -26.8, 4.6, 10.4, g5 ? [rl[0] + 12, rl[0] + 24, rl[0] + 36] : [rl[0] + 19], g5 ? 4.6 : 5.6],
        grip,
        paintU(p) {
          p.text('L', psIni(spec.produttore), 84, -17.6, 3.0, { a: .74, h: -.45 });
          for (const [x, y] of [[84.5, -18.6], [106.5, -16.2]]) p.pin('LR', x, y, 1.25, { h: .25, a: .75 });
          p.line('LR', [[rl[0] - 2, -27.2], [fx - 1, -27.2]], .35, { h: -.6, a: .7 });
          p.fill('R', K.rrect(114, -25.8, 126, -21.6, .6), { h: .2, a: 1.25, r: .4 }); p.text('R', psSer(spec), 120, -23.7, 1.5, { a: .6, h: -.3 });
        },
        paintG(p) {
          psGripTex(p, G.zone);
          p.pin('LR', 14, -24, 1.25, { h: .25, a: .75 });
          p.text('L', psIni(spec.produttore), 30, -28.5, 3.4, { a: .78, h: -.4 });
        } },
      trigger: ['lamella', 85, -19, { mat: mC, mat2: K.mat('nero') }],
      levers: [[slideStop, -12.2, -10.3, mL]].concat(g5 ? [[slideStop, 10.3, 12.2, mL]] : [],
        [[[[95, -14.4, .4], [101.5, -14.4, .4], [101.5, -17.8, .4], [95, -17.8, .4]], -11.5, 11.5, mL]],
        [[[[61, -36.5, 1.5], [67.6, -36.5, 1.5], [67.6, -45, 1.5], [61, -45, 1.5]], -14.6, -12, mC, 'corpo', .8]]),
      extra(A, Lo) {
        if (g5) { // bocca del pozzetto svasata e attacco del cordino
          A.add(K.xf(K.slab([[-4, -1, 2], [56, -1, 2], [57, 3, 2], [-5, 3, 2]], -15.4, 15.4, { b: 1.6 }), { r: [0, 0, Math.atan2(mb[1] - ma[1], mb[0] - ma[0])], t: [ma[0], ma[1], 0] }), Lo.G.m);
          A.add(K.box(-14.5, -97, -4, -8, -90.5, 4, .6), mC);
        }
      },
      mag: psMagO(ma, mb, col, { d: g5 ? 7.6 : 6.4, fw: g5 ? 3 : 2.5, bk: g5 ? 1.2 : 0, w: g5 ? 14.6 : 13.6 }),
      arr: -7, gc: G.c, corsa: corto ? 33 : 36
    });
  };
  MAP2[11] = { f: 'pistola_polimero_squadrata', o: { variante: 'standard' } };
  MAP2[12] = { f: 'pistola_polimero_squadrata', o: { variante: 'compatta' } };
  MAP2[22] = { f: 'pistola_polimero_squadrata', o: { variante: 'ibrida' } };

  // =====================================================================================================================
  // 2) pistole in polimero con carrello dal muso arrotondato e modulo dell'impugnatura (id 21 standard, 25 micro)
  // =====================================================================================================================
  FAM2.pistola_polimero_modulare = function (spec, o) {
    o = o || {}; const mi = o.variante === 'micro';
    const k = mi ? .79 : 1;   // scala verticale dell'impugnatura della micro
    const L = mi ? 144.5 : 199, top = mi ? 14.2 : 16.4, bot = mi ? -12.2 : -13.4, hw = mi ? 11.3 : 12.7;
    const fx = mi ? L - 5 : L - 8.5, dc = mi ? -24.5 : -28.6;
    const op = mi ? [61.5, 90.5, -40.6] : [74, 107, -46];
    const xo = op[0];  // retro dell'apertura del ponticello
    const G = mi ? psGripP({ rake: 18, J: [44.6, -42.2], yb: -88.5, D: 46, hump: 1.6, web: [-3.6, -23], xo: xo - 6, ext: 9 }) : psGripP({ rake: 19, J: [57.4, -47.4], yb: -113, D: 54, hump: 2, web: [-5, -27], xo: xo - 7, ext: 14 });
    const ma = G.R, mb = G.B, grip = G.out;
    const tang = mi ? [[-1.6, -24.5, 3.5, 1], [-6.5, -21.3, 2.6, 1], [-10.6, -19.6, 2.4, .9], [-9.6, -15.4, 2, .8], [-4, bot, 1.6, .6]]
      : [[-2, -28, 4, 1], [-8, -24.5, 3, 1], [-14.5, -22.5, 3, 1], [-15, -19.6, 2, .9], [-6, -15.8, 2.5, .8], [-3, bot, 1, .6]];
    const frU = [[-1, bot, .5, .4], [fx, bot, 0, .4], [fx, dc, 3, .6], [op[1] + 7.4, dc - .6, 2, .6], [op[1] + 4.6, op[2] + 22.6, 1.6, .6], [op[0] + 1, op[2] + 22.6, 2.5, .6], [op[0] - 2, dc + 1.6, 0, .6], [40, dc, 0, .6], [2, dc - 2, 0, .6]].concat(tang);
    const sx = mi ? [4.5, 28, 2.4] : [5, 37.5, 2.45];
    const mL = K.mat('nero', null, { r: .42 }), mC = K.mat('polimero');
    const rx = mi ? [fx - 28, fx - 3, [fx - 15]] : [fx - 50, fx - 4, [fx - 40, fx - 28, fx - 16]];
    const tg = mi ? [72, -17.6] : [88, -20];
    return psPolyGun(spec, {
      nome: 'pistola_polimero_modulare', L, top,
      slide: { out: [[0, bot, .8, .35], [L - 7, bot, 2.5, .35], [L - .5, bot + 6, 2.5, .6], [L, top, mi ? 6.2 : 7.5, 1], [0, top, 2, 1]], port: mi ? [52, 82, 2] : [66, 103, 2.2], hw, b: mi ? 3.8 : 4.3, bs: 4, mat: 'nero', rough: .36,
        paint(p) {
          p.grooves('LR', sx[0], sx[1], bot + 1.6, top - 2.6, sx[2], { wr: .5 });
          if (mi) p.grooves('LR', L - 29, L - 13, bot + 1.6, top - 2.6, 2.4, { wr: .5 });
          p.text('L', spec.produttore.toUpperCase(), mi ? 84 : 128, mi ? 3 : 3.6, mi ? 3.4 : 4.2, { spacing: 5 });
          p.text('R', (spec.nome.split(' ')[0]).toUpperCase(), mi ? 98 : 136, 4.4, mi ? 3.6 : 4.4, { spacing: 6 });
          p.text('R', psCal(spec.calibro) + '   ' + psSer(spec, 'BK'), mi ? 104 : 142, -5.6, 2.1);
          p.fill('R', K.rrect(mi ? 37 : 47, 2.6, mi ? 51.4 : 65.4, 8.2, .8), { h: .3, a: .9 }); p.line('R', K.rrect(mi ? 37 : 47, 2.6, mi ? 51.4 : 65.4, 8.2, .8), .25, { h: -.7, a: .55 }, true);
        } },
      rear: ['trizio', mi ? 6 : 8, mi ? 13.5 : 17, { w: mi ? 5 : 5.4, h: mi ? 5.4 : 6.2 }], front: ['trizio', L - (mi ? 12 : 15), L - (mi ? 7 : 9), { h: mi ? 4.8 : 5.4, w: 1.6 }],
      muz: mi ? 7 : 7.6, guide: [mi ? -7.6 : -8.8, mi ? 2.4 : 2.8],
      barrel: { x0: mi ? 44 : 56, x1: L + .3, r: mi ? 6.6 : 7, ri: 4.5, hood: mi ? [52.4, 81.6, top - .6, 6.4] : [66.4, 102.6, top - .6, 6.9], mat: psSteel('inox') },
      lower: { col: 'polimero', hwU: mi ? 9.6 : 10.6, hwG: 5.3, hwP: mi ? 13.2 : 15.4, bP: mi ? 6 : 7.2, frU, hwF: hw - .4,
        frG: psFrG(xo - 6, bot, tang.slice().reverse(), mi ? -27 : -31),
        guard: psGuard({ op, yt: dc + .4, fr: mi ? 6.4 : 7, bt: mi ? 6 : 6.8, st: 'obliqua', xr: op[0] - 13, ru: 9 }),
        rail: [rx[0], rx[1], dc + .3, mi ? 3.8 : 4.6, mi ? 9.2 : 10.4, rx[2], mi ? 4 : 4.4],
        grip,
        paintU(p) {
          for (const [x, y] of mi ? [[71, -17.4], [87, -15.6]] : [[87.5, -19], [107, -16]]) p.pin('LR', x, y, 1.2, { h: .25, a: .75 });
          p.line('LR', [[rx[0] - 1, dc - .3], [fx - 1, dc - .3]], .35, { h: -.6, a: .7 });
          p.text('R', psSer(spec), mi ? 102 : 124, dc + 4, 1.6, { a: .7, h: -.3 });
        },
        paintG(p) {
          const z = G.zone;
          psGripTex(p, z, { s: .3 });
          p.text('L', psIni(spec.produttore), mi ? 22 : 28, mi ? -26 : -29, 3.2, { a: .8, h: -.45 });
          p.fill('LR', mi ? [[-2, -22], [6, -24], [6, -28], [-2, -26]] : [[-5, -24], [6, -26], [6, -31], [-5, -29]], { h: -.25, a: .85 });
        } },
      trigger: ['curvo', tg[0], tg[1], { mat: K.mat('nero', null, { r: .5 }), w: 3.4, s: mi ? .86 : 1 }],
      levers: mi
        ? [[[[45, -12.8, .7], [64, -12.8, .7], [65, -14.8, 1], [52, -16, 1.2], [46.5, -17, 1.2]], -11, -9.4, mL],
          [[[77, -13.4, .5], [84, -13.4, .5], [84, -16.6, .8], [77, -16.6, .8]], -10.6, -9.4, mL],
          [[[52.6, -32.5, 1.4], [58, -32.5, 1.4], [58, -38.6, 1.4], [52.6, -38.6, 1.4]], -12.9, -10.8, mC, 'corpo', .7]]
        : [[[[58, -14.2, .8], [84, -14.2, .8], [85, -16.4, 1], [66, -18, 1.5], [60, -19.4, 1.5]], -11.9, -10.4, mL],
          [[[92.6, -15.4, .5], [104.4, -15.4, .5], [104.4, -18.6, 1.6], [97, -19.6, 1.6], [92.6, -18, .8]], -11.8, -10.4, mL],
          [[[64, -38, 1.5], [70.4, -38, 1.5], [70.4, -46, 1.5], [64, -46, 1.5]], -15.2, -12.6, mC, 'corpo', .8]],
      mag: psMagO(ma, mb, 'polimero', mi ? { dito: true, d: 5.6, w: 12, bw: 9.6, drop: 95 } : { w: 13.8 }),
      arr: mi ? -6 : -7, gc: G.c, corsa: mi ? 28 : 37
    });
  };
  MAP2[21] = { f: 'pistola_polimero_modulare', o: { variante: 'standard' } };
  MAP2[25] = { f: 'pistola_polimero_modulare', o: { variante: 'micro' } };

  // =====================================================================================================================
  // 3) pistola in polimero di servizio con zigrinature anteriori e posteriori inclinate e smusso alto del carrello (id 26)
  // =====================================================================================================================
  FAM2.pistola_polimero_servizio = function (spec) {
    const L = 188, top = 16, bot = -13.6, hw = 12.9, fx = L - 10, dc = -28.2, op = [73, 106, -45.6];
    const G = psGripP({ rake: 20, J: [55.4, -48.4], yb: -114, D: 53, hump: 2.2, web: [-4.6, -27], xo: 66 }), ma = G.R, mb = G.B;
    const mL = K.mat('nero', null, { r: .42 }), mC = K.mat('polimero');
    const stop = [[57, -14.6, .8], [82, -14.6, .8], [83, -16.8, 1], [65, -18.4, 1.5], [59, -19.6, 1.5]];
    return psPolyGun(spec, {
      nome: 'pistola_polimero_servizio', L, top,
      slide: { out: [[0, bot, .8, .35], [L - 8, bot, 2, .35], [L - .4, bot + 7, 2, .6], [L, top, 3.5, 1], [-1.4, top, 1.5, 1], [0, top - 5, 1, 1]], port: [66, 103, 2.2], hw, b: 3.6, bs: 2, mat: 'nero', rough: .44,
        paint(p) {
          p.grooves('LR', 4, 37, bot + 1.6, top - 2.4, 3, { wr: .5, ang: .14 });
          p.grooves('LR', L - 38, L - 12, bot + 1.6, top - 2.4, 2.9, { wr: .5, ang: -.14 });
          p.text('L', psIni(spec.produttore), 122, 4, 6.2, { weight: '900', spacing: 2 });
          p.text('L', spec.nome.toUpperCase() + '  ' + psCal(spec.calibro), 122, -4.4, 2.6, { spacing: 3 });
          p.text('R', psSer(spec, 'AA'), 130, -6, 2.2);
          p.fill('R', K.rrect(47, 2.6, 65.4, 8.6, .8), { h: .3, a: .9 }); p.line('R', K.rrect(47, 2.6, 65.4, 8.6, .8), .25, { h: -.7, a: .55 }, true);
        } },
      rear: ['3p', 8, 17, { w: 5.6, h: 6 }], front: ['punto', L - 15, L - 9, { h: 5.4 }],
      barrel: { x0: 55, x1: L + .3, r: 7, ri: 4.5, hood: [66.4, 102.6, top - .6, 6.9], mat: psSteel('nera') },
      lower: { col: 'polimero', hwU: 10.6, hwG: 5.4, hwP: 15.4, bP: 7.2,
        frU: [[-3, bot, .5, .4], [fx, bot, 0, .4], [fx, dc, 3, .6], [113, dc - .6, 2, .6], [110.4, -23.2, 1.6, .6], [74, -23.2, 2.5, .6], [71, -27, 0, .6], [40, -29, 0, .6], [2, -31, 0, .6], [-2, -28, 4, 1], [-7, -24.6, 3, 1], [-12.6, -22.6, 3, 1], [-12.6, -19.8, 2, .9], [-5, -15.6, 2.5, .8]],
        guard: psGuard({ op, yt: dc + .4, fr: 6.8, bt: 6.6, st: 'uncino', xr: 59 }),
        rail: [fx - 48, fx - 4, dc + .3, 4.6, 10.4, [fx - 38, fx - 27, fx - 16], 4.4],
        hwF: 12.5, frG: psFrG(67, bot, [[-1.4, bot, 1, .6], [-5, -15.6, 2.5, .8], [-12.6, -19.8, 2, .9], [-12.6, -22.6, 3, 1], [-7, -24.6, 3, 1], [-2, -28, 4, 1]], -31),
        grip: G.out,
        paintU(p) {
          for (const [x, y] of [[86.5, -19.5], [106, -16.8]]) p.pin('LR', x, y, 1.2, { h: .25, a: .75 });
          p.line('LR', [[fx - 50, dc - .3], [fx - 1, dc - .3]], .35, { h: -.6, a: .7 });
          p.text('R', psSer(spec), 126, dc + 4.2, 1.6, { a: .7, h: -.3 });
        },
        paintG(p) {
          // pannelli puntinati separati dal dorso intercambiabile (giunzione incisa)
          psGripTex(p, G.zone, { s: .32 });
          p.line('LR', [[-8, -30], [-6.6, -50], [-9.6, -70], [-12.4, -92]], .5, { h: -.8, a: .7 });
          p.text('L', psIni(spec.produttore), 26, -29.5, 3.6, { a: .8, h: -.45, weight: '900' });
        } },
      trigger: ['lamella', 87, -19.8, { mat: K.mat('nero', null, { r: .5 }), mat2: psDark() }],
      levers: [[stop, -12, -10.4, mL], [stop, 10.4, 12, mL], [[[94, -15.4, .5], [101, -15.4, .5], [101, -18.6, .8], [94, -18.6, .8]], -11.6, 11.6, mL],
        [[[63, -37.6, 1.5], [69.6, -37.6, 1.5], [69.6, -45.6, 1.5], [63, -45.6, 1.5]], -15.2, 15.2, mC, 'corpo', .8]],
      mag: psMagO(ma, mb, 'polimero', { w: 13.8 }),
      arr: -7, flare: 1.2, gc: G.c, corsa: 35
    });
  };
  MAP2[26] = { f: 'pistola_polimero_servizio', o: {} };

  // =====================================================================================================================
  // 4) pistola in polimero compatta con zigrinature anteriori, coda lunga e trama a rombi (id 20)
  // =====================================================================================================================
  FAM2.pistola_polimero_compatta = function (spec) {
    const L = 182, top = 15.6, bot = -13.4, hw = 12.6, fx = L - 9.5, dc = -27.5, op = [70, 102, -44.6];
    const G = psGripP({ rake: 20, J: [53.5, -46], yb: -104.5, D: 52, hump: 2.8, web: [-4.4, -26], xo: 63, bulge: 1.6 }), ma = G.R, mb = G.B;
    const mL = K.mat('nero', null, { r: .42 }), mC = K.mat('polimero');
    return psPolyGun(spec, {
      nome: 'pistola_polimero_compatta', L, top,
      slide: { out: [[0, bot, .8, .35], [L - 10, bot, 5, .35], [L - .3, bot + 7, 3, .6], [L, top, 3, 1], [0, top, 1.5, 1]], port: [62, 98, 2.2], hw, b: 3.2, mat: 'nero', rough: .44,
        paint(p) {
          p.grooves('LR', 5, 34, bot + 1.8, top - 1.8, 3.2, { wr: .48 });
          p.grooves('LR', L - 34, L - 14, bot + 1.8, top - 1.8, 3.2, { wr: .48 });
          p.text('L', spec.produttore.toUpperCase(), 116, 3.6, 3.4, { spacing: 4 });
          p.text('L', spec.nome.toUpperCase() + '   ' + psCal(spec.calibro), 116, -2.6, 2.2, { spacing: 2 });
          p.text('R', psSer(spec, 'MA'), 118, -6.4, 2.2);
          p.fill('R', K.rrect(44, 2.8, 61.4, 8.6, .8), { h: .3, a: .9 }); p.line('R', K.rrect(44, 2.8, 61.4, 8.6, .8), .25, { h: -.7, a: .55 }, true);
        } },
      rear: ['3p', 7.5, 16, { w: 5.5, h: 6 }], front: ['punto', L - 15, L - 9.5, { h: 5.4 }],
      barrel: { x0: 52, x1: L + .3, r: 6.9, ri: 4.5, hood: [62.4, 97.6, top - .6, 6.8], mat: psSteel('nera') },
      lower: { col: 'polimero', hwU: 10.5, hwG: 5.4, hwP: 15, bP: 7.2,
        frU: [[-3, bot, .5, .4], [fx, bot, 0, .4], [fx, dc, 2.8, .6], [108, dc - .6, 2, .6], [105.5, -22.8, 1.6, .6], [70.5, -22.8, 2.5, .6], [68, -26, 0, .6], [38, -28, 0, .6], [2, -30, 0, .6], [-2, -27.2, 4, 1], [-6.8, -23.6, 3, 1], [-12.2, -21.6, 2.6, 1], [-11.6, -18.6, 2, .9], [-4.6, -15.4, 2.2, .8]],
        guard: psGuard({ op, yt: dc + .4, fr: 6.6, bt: 6.4, st: 'gradino', xr: 56, ru: 10 }),
        rail: [fx - 36, fx - 4, dc + .3, 4.4, 10.2, [fx - 25, fx - 14], 4.4],
        hwF: 12.2, frG: psFrG(64, bot, [[-1.4, bot, 1, .6], [-4.6, -15.4, 2.2, .8], [-11.6, -18.6, 2, .9], [-12.2, -21.6, 2.6, 1], [-6.8, -23.6, 3, 1], [-2, -27.2, 4, 1]], -30),
        grip: G.out,
        paintU(p) {
          for (const [x, y] of [[83.5, -18.8], [102, -16]]) p.pin('LR', x, y, 1.2, { h: .25, a: .75 });
          p.line('LR', [[fx - 37, dc - .3], [fx - 1, dc - .3]], .35, { h: -.6, a: .7 });
          p.text('R', psSer(spec), 120, dc + 4, 1.6, { a: .7, h: -.3 });
        },
        paintG(p) {
          const z = G.zone;
          psGripTex(p, z, { checker: 2.1 });
          p.text('L', psIni(spec.produttore), 26, -28.6, 3.2, { a: .8, h: -.45 });
        } },
      trigger: ['piatto', 84, -19.4, { mat: K.mat('nero', null, { r: .5 }) }],
      levers: [[[[54, -13.8, .8], [78, -13.8, .8], [79, -16, 1], [62, -17.6, 1.5], [56, -18.8, 1.5]], -11.9, -10.3, mL],
        [[[90.5, -14.6, .5], [97.5, -14.6, .5], [97.5, -18, .8], [90.5, -18, .8]], -11.5, 11.5, mL],
        [[[60, -36.6, 1.5], [66.4, -36.6, 1.5], [66.4, -44.6, 1.5], [60, -44.6, 1.5]], -14.8, -12.2, mC, 'corpo', .8]],
      mag: psMagO(ma, mb, 'polimero', { w: 13.4, d: 7, fw: 3.2 }),
      arr: -7, gc: G.c, corsa: 33
    });
  };
  MAP2[20] = { f: 'pistola_polimero_compatta', o: {} };

  // =====================================================================================================================
  // 5) pistola in polimero ergonomica: carrello con smusso alto largo, appoggi per le dita, sgancio a leva nel ponticello (id 18)
  // =====================================================================================================================
  FAM2.pistola_polimero_ergonomica = function (spec) {
    const L = 176, top = 15.4, bot = -13.6, hw = 12.6, fx = L - 6, dc = -28, op = [70, 100, -45.6];
    const G = psGripP({ rake: 20, J: [54.5, -46.6], yb: -108, D: 52, hump: 3.2, web: [-4.4, -26.4], xo: 63, dita: [3, 1.5] }), ma = G.R, mb = G.B;
    const mL = K.mat('nero', null, { r: .42 }), mC = K.mat('polimero');
    return psPolyGun(spec, {
      nome: 'pistola_polimero_ergonomica', L, top,
      slide: { out: [[0, bot, .8, .3], [L - 7, bot, 2, .3], [L - .4, bot + 7.5, 2, .55], [L, top, 3, 1], [0, top, 1.5, 1]], port: [61, 96, 2.4], hw, b: 5.6, bs: 1, mat: 'nero', rough: .42,
        paint(p) {
          p.grooves('LR', 5, 30, bot + 1.6, top - 5.6, 3.1, { wr: .5 });
          p.grooves('LR', L - 30, L - 13, bot + 1.6, top - 5.6, 3.0, { wr: .5 });
          p.text('L', spec.produttore.toUpperCase(), 108, 3.4, 3.2, { spacing: 4, weight: '900' });
          p.text('L', spec.nome.toUpperCase(), 108, -2.4, 2.6, { spacing: 6 });
          p.text('L', psCal(spec.calibro), 136, -7.2, 2.2);
          p.text('R', psSer(spec, 'EW'), 120, -6.6, 2.2);
          p.fill('R', K.rrect(43, 2.8, 60.4, 8.2, .8), { h: .3, a: .9 }); p.line('R', K.rrect(43, 2.8, 60.4, 8.2, .8), .25, { h: -.7, a: .55 }, true);
        } },
      rear: ['3p', 7, 15.5, { w: 5.4, h: 6 }], front: ['punto', L - 14.5, L - 9, { h: 5.4 }],
      barrel: { x0: 52, x1: L + .3, r: 6.8, ri: 4.5, hood: [61.4, 95.6, top - .6, 6.6], mat: psSteel('nera') },
      lower: { col: 'polimero', hwU: 10.5, hwG: 5.6, hwP: 15.4, bP: 7.2,
        frU: [[-3, bot, .5, .4], [fx, bot, 0, .4], [fx, dc, 3, .6], [106, dc - .6, 2, .6], [103.5, -23, 1.6, .6], [70, -23, 2.5, .6], [67, -26.5, 0, .6], [38, -28.5, 0, .6], [2, -30.5, 0, .6], [-2, -27.6, 4, 1], [-6.4, -23.8, 3, 1], [-11, -21.6, 2.6, 1], [-10.4, -18.4, 2, .9], [-4.4, -15.4, 2.2, .8]],
        guard: psGuard({ op, yt: dc + .4, fr: 7, bt: 7, st: 'obliqua', xr: 57 }),
        rail: [fx - 40, fx - 4, dc + .3, 4.5, 10.3, [fx - 27, fx - 15], 4.4],
        hwF: 12.2, frG: psFrG(62, bot, [[-1.4, bot, 1, .6], [-4.4, -15.4, 2.2, .8], [-10.4, -18.4, 2, .9], [-11, -21.6, 2.6, 1], [-6.4, -23.8, 3, 1], [-2, -27.6, 4, 1]], -30),
        grip: G.out,
        paintU(p) {
          for (const [x, y] of [[83, -19.4], [100, -16.4]]) p.pin('LR', x, y, 1.2, { h: .25, a: .75 });
          p.line('LR', [[fx - 41, dc - .3], [fx - 1, dc - .3]], .35, { h: -.6, a: .7 });
          p.text('R', psSer(spec), 116, dc + 4.2, 1.6, { a: .7, h: -.3 });
        },
        paintG(p) {
          const z = G.zone;
          psGripTex(p, z, { s: .22 });
          for (let i = 0; i < 5; i++) p.line('LR', [[-6 + i * 1.6, -44 - i * 9], [8 + i * 4, -46 - i * 9.5]], .3, { h: -.45 }); // onde sul dorso
          p.text('L', psIni(spec.produttore), 25, -28.6, 3.2, { a: .8, h: -.45 });
        } },
      trigger: ['lamella', 83, -19.6, { mat: K.mat('nero', null, { r: .5 }), mat2: psDark() }],
      levers: [[[[53, -14, .8], [77, -14, .8], [78, -16.2, 1], [61, -17.8, 1.5], [55, -19, 1.5]], -11.9, -10.3, mL],
        [[[53, -14, .8], [77, -14, .8], [78, -16.2, 1], [61, -17.8, 1.5], [55, -19, 1.5]], 10.3, 11.9, mL],
        [[[89, -14.8, .5], [96, -14.8, .5], [96, -18.2, .8], [89, -18.2, .8]], -11.5, 11.5, mL],
        // sgancio a leva nel ponticello (ambidestro)
        [[[63, -46, .8], [72.6, -46, .8], [74.4, -49, 1.2], [71, -53.4, 1.6], [63.4, -52.6, 1.6]], -6.6, 6.6, mL]],
      mag: psMagO(ma, mb, 'polimero', { w: 13.6 }),
      arr: -7, gc: G.c, corsa: 34
    });
  };
  MAP2[18] = { f: 'pistola_polimero_ergonomica', o: {} };

  // =====================================================================================================================
  // 6) pistola in polimero con carrello lungo, zigrinature profonde a dente e piastra per l'ottica (id 23)
  // =====================================================================================================================
  FAM2.pistola_polimero_ottica = function (spec) {
    const L = 211, top = 16.6, bot = -13.6, hw = 13, fx = L - 12, dc = -28.6, op = [74, 106, -46];
    const G = psGripP({ rake: 20, J: [56, -49], yb: -117, D: 54, hump: 2, web: [-5.6, -27.4], xo: 67, ext: 14 }), ma = G.R, mb = G.B;
    const mL = K.mat('nero', null, { r: .42 }), mC = K.mat('polimero');
    return psPolyGun(spec, {
      nome: 'pistola_polimero_ottica', L, top,
      slide: { out: [[0, bot, .8, .3], [L - 10, bot, 3, .3], [L - .5, bot + 7, 3, .55], [L, top - 1, 3, 1], [L - 2, top, 2, 1], [0, top, 1.6, 1]], port: [76, 114, 2.2], hw, b: 3.6, bs: 2, mat: 'nero', rough: .46,
        paint(p) {
          for (const [x0, x1] of [[3, 46], [L - 50, L - 12]]) for (let x = x0; x < x1; x += 5.3) {
            p.fill('LR', [[x, bot + 1.4], [x + 2.9, bot + 1.4], [x + 3.9, top - 1.5], [x + 1, top - 1.5]], { h: -1, a: .5 });
            p.line('LR', [[x + 2.9, bot + 1.4], [x + 3.9, top - 1.5]], .45, { h: .4, a: 1.1 });
          }
          p.text('L', spec.produttore.toUpperCase(), 136, 4.4, 3.6, { spacing: 4, weight: '900' });
          p.text('L', spec.nome.toUpperCase() + '   ' + psCal(spec.calibro), 136, -2.2, 2.4, { spacing: 3 });
          p.text('R', psSer(spec, 'EW'), 146, -6.4, 2.2);
          p.fill('R', K.rrect(56, 2.6, 74.6, 8.4, .8), { h: .3, a: .9 }); p.line('R', K.rrect(56, 2.6, 74.6, 8.4, .8), .25, { h: -.7, a: .55 }, true);
        } },
      rear: ['larga', 5, 13, { w: 6.2, h: 6.6 }], front: ['punto', L - 16, L - 10, { h: 5.8, w: 1.75 }],
      barrel: { x0: 64, x1: L + .3, r: 7, ri: 4.5, hood: [76.4, 113.6, top - .6, 7], mat: psSteel('nera') },
      slideX(A) { // piastra di copertura dell'attacco dell'ottica con due viti
        const mP = K.mat('nero', null, { r: .5 });
        A.add(K.slab([[16, top - 1, .4], [62, top - 1, .4], [62, top + 1.5, 1.4], [16, top + 1.5, 1.4]], -9.8, 9.8, { b: .7 }), mP, 'carrello');
        for (const x of [25, 53]) { A.add(K.latheX([[0, 0], [0, 2.4], [.6, 2.2], [.8, 0]], { seg: 14 }).rotateZ(PI / 2).translate(x, top + 1.5, 0), K.mat('brunito'), 'carrello'); A.add(K.box(x - 1.6, top + 2.1, -.35, x + 1.6, top + 2.4, .35, 0), psDark(), 'carrello'); }
      },
      lower: { col: 'polimero', hwU: 10.6, hwG: 5.5, hwP: 15.6, bP: 7.2,
        frU: [[-3, bot, .5, .4], [fx, bot, 0, .4], [fx, dc, 3, .6], [114, dc - .6, 2, .6], [111.4, -23.4, 1.6, .6], [75, -23.4, 2.5, .6], [72, -27, 0, .6], [42, -29, 0, .6], [2, -31, 0, .6], [-2, -28, 4, 1], [-8, -24.6, 3, 1], [-15, -22.6, 3, 1], [-15.4, -19.4, 2, .9], [-6, -15.6, 2.5, .8]],
        guard: psGuard({ op, yt: dc + .4, fr: 7, bt: 6.8, st: 'gradino', xr: 60, ru: 10 }),
        rail: [fx - 50, fx - 4, dc + .3, 4.6, 10.4, [fx - 36, fx - 24, fx - 12], 4.4],
        hwF: 12.6, frG: psFrG(69, bot, [[-1.4, bot, 1, .6], [-6, -15.6, 2.5, .8], [-15.4, -19.4, 2, .9], [-15, -22.6, 3, 1], [-8, -24.6, 3, 1], [-2, -28, 4, 1]], -31),
        grip: G.out,
        paintU(p) {
          for (const [x, y] of [[87, -19.6], [108, -16.6]]) p.pin('LR', x, y, 1.2, { h: .25, a: .75 });
          p.line('LR', [[fx - 51, dc - .3], [fx - 1, dc - .3]], .35, { h: -.6, a: .7 });
          p.text('R', psSer(spec), 130, dc + 4.2, 1.6, { a: .7, h: -.3 });
        },
        paintG(p) {
          const z = G.zone;
          psGripTex(p, z, { s: .5, ws: 1.1 });
          p.fill('LR', [[-4, -40], [4, -36], [10, -40], [6, -46]], { h: -.4, a: .8 }); // appoggio del pollice
          p.text('L', psIni(spec.produttore), 28, -29.4, 3.4, { a: .8, h: -.45, weight: '900' });
        } },
      trigger: ['piatto', 88, -20, { mat: K.mat('nero', null, { r: .5 }) }],
      levers: [[[[58, -14.4, .8], [84, -14.4, .8], [85, -16.6, 1], [66, -18.2, 1.5], [60, -19.4, 1.5]], -12, -10.4, mL],
        [[[58, -14.4, .8], [84, -14.4, .8], [85, -16.6, 1], [66, -18.2, 1.5], [60, -19.4, 1.5]], 10.4, 12, mL],
        [[[94, -15.2, .5], [101, -15.2, .5], [101, -18.6, .8], [94, -18.6, .8]], -11.6, 11.6, mL],
        [[[64.4, -38, 1.5], [71, -38, 1.5], [71, -46.2, 1.5], [64.4, -46.2, 1.5]], -15.2, -12.6, mC, 'corpo', .8]],
      mag: psMagO(ma, mb, 'polimero', { w: 13.8, d: 7.4, fw: 3 }),
      arr: -7, flare: 1.6, gc: G.c, corsa: 38
    });
  };
  MAP2[23] = { f: 'pistola_polimero_ottica', o: {} };

  // =====================================================================================================================
  // 7) pistola in polimero squadrata con zigrinature larghe e profonde davanti e dietro (id 19)
  // =====================================================================================================================
  FAM2.pistola_polimero_zigrinata = function (spec) {
    const L = 190, top = 16.4, bot = -13.6, hw = 13.2, fx = L - 9, dc = -28.4, op = [75, 109, -46];
    const G = psGripP({ rake: 19, J: [58, -47.6], yb: -118, D: 54, hump: 1.6, web: [-4.6, -27.4], xo: 68 }), ma = G.R, mb = G.B;
    const mL = K.mat('nero', null, { r: .42 }), mC = K.mat('polimero');
    return psPolyGun(spec, {
      nome: 'pistola_polimero_zigrinata', L, top,
      slide: { out: [[0, bot, .8, .35], [L - 5, bot, 1.5, .35], [L, bot + 5, 1.5, .6], [L, top, 2.8, 1], [0, top, 1.6, 1]], port: [70, 106, 2.4], hw, b: 2.6, mat: 'nero', rough: .46,
        paint(p) {
          for (const [x0, x1] of [[3, 62], [L - 56, L - 8]]) for (let x = x0 + 1; x < x1 - 2; x += 6.4) {
            p.fill('LR', [[x, bot + 1.2, 1], [x + 3.2, bot + 1.2, 1], [x + 3.2, top - .8, 1.5], [x, top - .8, 1.5]], { h: -1, a: .42 });
            p.line('LR', [[x + 3.2, bot + 1.2], [x + 3.2, top - .8]], .5, { h: .5, a: 1.15 });
          }
          p.text('L', spec.produttore.toUpperCase(), 116, 4.2, 3, { spacing: 4 });
          p.text('L', spec.nome.toUpperCase(), 116, -2, 4.2, { spacing: 10, weight: '900' });
          p.text('R', psSer(spec, 'VA'), 116, -6.4, 2.2);
          p.text('R', psCal(spec.calibro), 116, 4.6, 2.4);
        } },
      rear: ['3p', 7.5, 16.5, { w: 6, h: 6 }], front: ['punto', L - 15, L - 9, { h: 5.4, w: 1.7 }],
      barrel: { x0: 58, x1: L + .3, r: 7, ri: 4.5, hood: [70.4, 105.6, top - .6, 7], mat: psSteel('nera') },
      lower: { col: 'polimero', hwU: 10.8, hwG: 5.6, hwP: 15.6, bP: 7.2,
        frU: [[-3, bot, .5, .4], [fx, bot, 0, .4], [fx, dc, 2.6, .6], [117, dc - .6, 1.6, .6], [114.4, -23.4, 1.4, .6], [76, -23.4, 2.5, .6], [73, -27, 0, .6], [42, -29, 0, .6], [2, -31, 0, .6], [-2, -28, 4, 1], [-7, -24.6, 3, 1], [-12.4, -22.4, 2.6, 1], [-12, -19.4, 2, .9], [-5, -15.6, 2.4, .8]],
        guard: psGuard({ op, yt: dc + .4, fr: 7.2, bt: 6.8, st: 'squadra', xr: 61, ru: 6 }),
        rail: [fx - 50, fx - 4, dc + .3, 4.6, 10.6, [fx - 40, fx - 28, fx - 16], 4.4],
        hwF: 12.8, frG: psFrG(70, bot, [[-1.4, bot, 1, .6], [-5, -15.6, 2.4, .8], [-12, -19.4, 2, .9], [-12.4, -22.4, 2.6, 1], [-7, -24.6, 3, 1], [-2, -28, 4, 1]], -31),
        grip: G.out,
        paintU(p) {
          for (const [x, y] of [[89, -19.6], [111, -16.6]]) p.pin('LR', x, y, 1.2, { h: .25, a: .75 });
          p.line('LR', [[fx - 51, dc - .3], [fx - 1, dc - .3]], .35, { h: -.6, a: .7 });
          // finestra della matricola del telaio interno
          p.fill('R', K.rrect(118, -26.2, 132, -21.8, .6), { h: -.3, a: .6 }); p.fill('R', K.rrect(119, -25.6, 131, -22.4, .4), { h: -.1, a: 1.25, r: .35 }); p.text('R', psSer(spec), 125, -24, 1.4, { a: .5, h: -.2 });
        },
        paintG(p) {
          const z = G.zone;
          psGripTex(p, z, { s: .42, ws: 1 });
          p.text('L', psIni(spec.produttore), 28, -29.6, 3.4, { a: .8, h: -.45 });
        } },
      trigger: ['lamella', 90, -20.2, { mat: K.mat('nero', null, { r: .5 }), mat2: psDark() }],
      levers: [[[[57, -14.4, .8], [84, -14.4, .8], [85, -16.6, 1], [66, -18.2, 1.5], [59, -19.4, 1.5]], -12.2, -10.6, mL],
        [[[57, -14.4, .8], [84, -14.4, .8], [85, -16.6, 1], [66, -18.2, 1.5], [59, -19.4, 1.5]], 10.6, 12.2, mL],
        [[[96, -15.2, .5], [103, -15.2, .5], [103, -18.6, .8], [96, -18.6, .8]], -11.8, 11.8, mL],
        [[[65, -38.4, 1.5], [71.6, -38.4, 1.5], [71.6, -46.4, 1.5], [65, -46.4, 1.5]], -15.4, -12.8, mC, 'corpo', .8]],
      mag: psMagO(ma, mb, 'polimero', { w: 14, d: 7, fw: 2.6 }),
      arr: -7, gc: G.c, corsa: 36
    });
  };
  MAP2[19] = { f: 'pistola_polimero_zigrinata', o: {} };

  // =====================================================================================================================
  // 8) pistola in polimero alta per cartuccia piccola veloce: carrello rivestito liscio, impugnatura lunga, sicura sopra il grilletto (id 14)
  // =====================================================================================================================
  FAM2.pistola_polimero_alta = function (spec) {
    const L = 201, top = 17.6, bot = -14.2, hw = 13.6, fx = L - 6, dc = -30.6, op = [79, 113, -48.5];
    const G = psGripP({ rake: 18, J: [62, -51], yb: -112, D: 57, hump: 2, web: [-5.6, -29], xo: 72 }), ma = G.R, mb = G.B;
    const mL = K.mat('nero', null, { r: .45 }), mC = K.mat('polimero');
    return psPolyGun(spec, {
      nome: 'pistola_polimero_alta', L, top,
      slide: { out: [[0, bot, .8, .35], [L - 3, bot, 1.5, .35], [L, bot + 6, 2.5, .6], [L - 6, top, 7, 1], [0, top, 2.5, 1], [-1, top - 9, 3, 1]], port: [70, 99, 3.2], hw, b: 6, bs: 4, mat: 'polimero', c: '#1c1d1f', m: .05, rough: .6,
        paint(p) {
          for (let x = 6; x < 44; x += 6.2) p.fill('LR', [[x, bot + 2.5], [x + 3, bot + 2.5], [x + 3 + 6, top - 4], [x + 6, top - 4]], { h: -.9, a: .7 });
          p.text('L', spec.produttore.toUpperCase(), 128, 5, 3.4, { spacing: 6, a: .7, h: -.3 });
          p.text('L', spec.nome.toUpperCase() + '  ' + psCal(spec.calibro), 128, -1.4, 2.6, { spacing: 4, a: .7, h: -.3 });
          p.text('R', psSer(spec, 'AA'), 132, -7, 2.2, { a: .7 });
        } },
      rear: ['3p', 8, 18, { w: 6.4, h: 6.6 }], front: ['punto', L - 17, L - 11, { h: 5.6, w: 1.7 }],
      muz: 6.8, guide: [-9, 2.8],
      barrel: { x0: 62, x1: L + 1.6, r: 6.2, ri: 3.1, hood: [70.4, 98.6, top - .8, 6.4], mat: psSteel('nera') },
      lower: { col: 'polimero', hwU: 11, hwG: 5.8, hwP: 15.6, bP: 7.2,
        frU: [[-3, bot, .5, .4], [fx, bot, 0, .4], [fx, dc, 4, .6], [121, dc - .6, 2, .6], [118, -25, 1.6, .6], [79, -25, 2.5, .6], [76, -28.5, 0, .6], [44, -30.5, 0, .6], [2, -33, 0, .6], [-2.4, -30, 4, 1], [-7.6, -26.4, 3, 1], [-12.6, -24, 2.6, 1], [-12.4, -20.6, 2, .9], [-5, -16.6, 2.4, .8]],
        guard: psGuard({ op, yt: dc + .4, fr: 7.2, bt: 6.8, st: 'squadra', xr: 64 }),
        rail: [fx - 68, fx - 4, dc + .3, 4.6, 10.8, [fx - 56, fx - 43, fx - 30, fx - 17], 4.4],
        hwF: 13, frG: psFrG(74, bot, [[-1.4, bot, 1, .6], [-5, -16.6, 2.4, .8], [-12.4, -20.6, 2, .9], [-12.6, -24, 2.6, 1], [-7.6, -26.4, 3, 1], [-2.4, -30, 4, 1]], -33),
        grip: G.out,
        paintU(p) {
          for (const [x, y] of [[92, -21], [116, -18]]) p.pin('LR', x, y, 1.3, { h: .25, a: .75 });
          p.line('LR', [[fx - 69, dc - .3], [fx - 1, dc - .3]], .35, { h: -.6, a: .7 });
          p.text('R', psSer(spec), 132, dc + 4.4, 1.7, { a: .7, h: -.3 });
        },
        paintG(p) {
          const z = G.zone;
          psGripTex(p, z, { checker: 1.5 });
          p.text('L', psIni(spec.produttore), 30, -31, 3.6, { a: .8, h: -.45 });
        } },
      trigger: ['largo', 93, -21.6, { mat: K.mat('nero', null, { r: .5 }), w: 3.6 }],
      levers: [[[[60, -15.2, .8], [87, -15.2, .8], [88, -17.4, 1], [68, -19, 1.5], [62, -20.2, 1.5]], -12.4, -10.8, mL],
        // sicura ambidestra sopra il grilletto
        [[[101, -21.6, 1], [113, -21.6, 1], [113, -25.2, 1.2], [104, -26, 1.4]], -12.4, 12.4, mL],
        [[[68, -40, 1.5], [75, -40, 1.5], [75, -48.4, 1.5], [68, -48.4, 1.5]], -15.2, 15.2, mC, 'corpo', .8]],
      mag: psMagO(ma, mb, 'polimero', { w: 13.8, d: 5.4 }),
      arr: -7, gc: G.c, corsa: 38, tilt: 0
    });
  };
  MAP2[14] = { f: 'pistola_polimero_alta', o: {} };

  // =====================================================================================================================
  // 9) pistola in polimero con cane esterno, leva di comando posteriore e sgancio a leva nel ponticello (id 15)
  // =====================================================================================================================
  FAM2.pistola_polimero_cane_esterno = function (spec) {
    const L = 187, top = 16.2, bot = -14.4, hw = 13.1, fx = L - 7, dc = -29.5, op = [76, 111, -47];
    const G = psGripP({ rake: 19, J: [57.6, -48.6], yb: -111, D: 54, hump: 2.6, web: [-6, -28.4], xo: 69, bulge: 2 }), ma = G.R, mb = G.B;
    const mL = K.mat('nero', null, { r: .42 }), mC = K.mat('polimero');
    return psPolyGun(spec, {
      nome: 'pistola_polimero_cane_esterno', L, top,
      slide: { out: [[0, bot, .8, .35], [L - 5, bot, 2, .35], [L - .3, bot + 5.5, 2, .6], [L, top, 4.5, 1], [0, top, 2.2, 1]], port: [64, 101, 2.4], hw, b: 4.6, bs: 4, mat: 'nero', rough: .4,
        paint(p) {
          p.grooves('LR', 5, 33, bot + 1.8, top - 3.6, 2.8, { wr: .52 });
          p.text('L', spec.produttore.toUpperCase(), 122, 4.4, 3.4, { spacing: 5 });
          p.text('L', spec.nome.toUpperCase() + '   KAL. ' + psCal(spec.calibro), 122, -1.6, 2.4, { spacing: 2 });
          p.text('R', psSer(spec, '24-'), 134, -6.8, 2.2);
          p.fill('R', K.rrect(46, 2.6, 63.4, 8.4, .8), { h: .3, a: .9 }); p.line('R', K.rrect(46, 2.6, 63.4, 8.4, .8), .25, { h: -.7, a: .55 }, true);
        } },
      rear: ['3p', 7, 16.5, { w: 6, h: 6 }], front: ['punto', L - 14, L - 8, { h: 5.4, w: 1.7 }],
      barrel: { x0: 56, x1: L + .3, r: 7, ri: 4.5, hood: [64.4, 100.6, top - .6, 7], mat: psSteel('nera') },
      lower: { col: 'polimero', hwU: 10.8, hwG: 5.8, hwP: 15.6, bP: 7.2,
        frU: [[-6, bot, .5, .4], [fx, bot, 0, .4], [fx, dc, 3.5, .6], [117, dc - .6, 2, .6], [114, -24, 1.6, .6], [77, -24, 2.5, .6], [74, -27.5, 0, .6], [40, -29.5, 0, .6], [2, -31.5, 0, .6], [-2.6, -29, 4, 1], [-8, -25.6, 3, 1], [-13, -23.6, 2.6, 1], [-13.4, -20.4, 2, .9], [-9, -16, 2.2, .8]],
        guard: psGuard({ op, yt: dc + .4, fr: 7.2, bt: 7, st: 'uncino', xr: 62 }),
        hwF: 12.6, frG: psFrG(69, bot, [[-4, bot, 1, .6], [-9, -16, 2.2, .8], [-13.4, -20.4, 2, .9], [-13, -23.6, 2.6, 1], [-8, -25.6, 3, 1], [-2.6, -29, 4, 1]], -32),
        grip: G.out,
        paintU(p) {
          for (const [x, y] of [[89, -20], [112, -17]]) p.pin('LR', x, y, 1.3, { h: .25, a: .75 });
          // scanalature laterali del copricanna per gli accessori
          for (const y of [-24.4, -27.4]) p.line('LR', [[120, y], [fx - 2, y]], 1.1, { h: -.9, a: .55 });
          p.text('R', psSer(spec), 132, -20.6, 1.6, { a: .7, h: -.3 });
        },
        paintG(p) {
          const z = G.zone;
          psGripTex(p, z, { checker: 1.9 });
          p.text('L', psIni(spec.produttore), 30, -29.6, 3.6, { a: .8, h: -.45, weight: '900' });
        } },
      hammer: ['tondo', -5.6, -18.6, { w: 3.2, mat: K.mat('nero', null, { r: .4 }) }],
      trigger: ['curvo', 90, -20.6, { mat: K.mat('nero', null, { r: .5 }), w: 3.3 }],
      levers: [[[[52, -14.8, .8], [80, -14.8, .8], [81, -17, 1], [64, -18.6, 1.5], [55, -19.8, 1.5]], -12.2, -10.6, mL],
        // leva di comando (sicura e abbattimento del cane) sul retro sinistro
        [[[-3, -15.4, 1], [12, -15.4, 1.5], [21, -17.6, 2], [17, -22.8, 3], [4, -24.6, 3], [-6, -21.6, 2]], -12.6, -10.8, mL],
        [[[95, -15.6, .5], [102, -15.6, .5], [102, -19.2, .8], [95, -19.2, .8]], -11.8, 11.8, mL],
        // sgancio del caricatore a leva nel ponticello (ambidestro)
        [[[64, -46.4, .8], [74.6, -46.4, .8], [76.6, -50, 1.2], [72.6, -54.6, 1.8], [64.4, -53.4, 1.8]], -7, 7, mL]],
      mag: psMagO(ma, mb, 'polimero', { w: 14, d: 6 }),
      arr: -7, gc: G.c, corsa: 36
    });
  };
  MAP2[15] = { f: 'pistola_polimero_cane_esterno', o: {} };

  // =====================================================================================================================
  // 10) pistola in polimero a canna rotante con cane mozzo e leve ambidestre sul carrello (id 17)
  // =====================================================================================================================
  FAM2.pistola_polimero_canna_rotante = function (spec) {
    const L = 183, top = 16.2, bot = -13.6, hw = 13, fx = L - 11, dc = -28.8, op = [72, 104, -46];
    const G = psGripP({ rake: 20, J: [54.6, -48.6], yb: -113, D: 53, hump: 2.8, web: [-5, -27.4], xo: 65 }), ma = G.R, mb = G.B;
    const mL = K.mat('nero', null, { r: .42 }), mC = K.mat('polimero');
    const lev = [[1, 4.2, 1, 1], [20, 5.6, 2, 1], [22.6, 9.6, 2, 1], [6, 11.6, 2, 1], [.4, 9, 1, 1]];
    return psPolyGun(spec, {
      nome: 'pistola_polimero_canna_rotante', L, top,
      slide: { out: [[0, bot, .8, .35], [L - 13, bot, 3, .35], [L - 1.6, bot + 7, 3, .6], [L, top - 5, 4, 1], [L - 5, top, 5, 1], [0, top, 2, 1]], port: [62, 98, 2.4], hw, b: 5.2, bs: 4, mat: 'nero', rough: .4,
        paint(p) {
          p.grooves('LR', 26, 50, bot + 1.6, top - 4, 3.1, { wr: .5, ang: .32 });
          p.text('L', spec.produttore.toUpperCase(), 118, 4.4, 3.2, { spacing: 4 });
          p.text('L', spec.nome.toUpperCase(), 118, -1.6, 3.6, { spacing: 8, weight: '900' });
          p.text('L', psCal(spec.calibro), 150, -7, 2.2);
          p.text('R', psSer(spec, 'VA'), 126, -6.6, 2.2);
          p.fill('R', K.rrect(48, 2.6, 61.4, 8.4, .8), { h: .3, a: .9 }); p.line('R', K.rrect(48, 2.6, 61.4, 8.4, .8), .25, { h: -.7, a: .55 }, true);
        } },
      rear: ['3p', 7.5, 16, { w: 5.6, h: 6 }], front: ['punto', L - 15, L - 9, { h: 5.4 }],
      barrel: { x0: 54, x1: L + .3, r: 7, ri: 4.5, hood: [62.4, 97.6, top - .6, 6.8], mat: psSteel('nera') },
      slideX(A) { // leve ambidestre di sicura e abbattimento sul retro del carrello
        for (const s of [-1, 1]) A.add(K.slab(lev, s < 0 ? -hw - 1.8 : hw - .8, s < 0 ? -hw + .8 : hw + 1.8, { b: .6 }), mL, 'carrello');
      },
      lower: { col: 'polimero', hwU: 10.6, hwG: 5.6, hwP: 15.4, bP: 7.2,
        frU: [[-6, bot, .5, .4], [fx, bot, 0, .4], [fx, dc, 4, .6], [111, dc - .6, 2, .6], [108.5, -23.4, 1.6, .6], [72.6, -23.4, 2.5, .6], [70, -27, 0, .6], [40, -29, 0, .6], [2, -31, 0, .6], [-2.4, -28.6, 4, 1], [-7.6, -25.2, 3, 1], [-12, -23, 2.6, 1], [-11.6, -19.6, 2, .9], [-7, -15.6, 2.2, .8]],
        guard: psGuard({ op, yt: dc + .4, fr: 7, bt: 6.6, st: 'tonda', xr: 59 }),
        rail: [fx - 34, fx - 4, dc + .3, 4.4, 10.2, [fx - 18], 4.6],
        hwF: 12.6, frG: psFrG(66, bot, [[-4, bot, 1, .6], [-7, -15.6, 2.2, .8], [-11.6, -19.6, 2, .9], [-12, -23, 2.6, 1], [-7.6, -25.2, 3, 1], [-2.4, -28.6, 4, 1]], -31),
        grip: G.out,
        paintU(p) {
          for (const [x, y] of [[86, -19.6], [104, -16.4]]) p.pin('LR', x, y, 1.2, { h: .25, a: .75 });
          p.line('LR', [[fx - 35, dc - .3], [fx - 1, dc - .3]], .35, { h: -.6, a: .7 });
          p.text('R', psSer(spec), 124, dc + 4.2, 1.6, { a: .7, h: -.3 });
        },
        paintG(p) {
          const z = G.zone;
          psGripTex(p, z, { s: .24 });
          // dorso intercambiabile: giunzione incisa e righe orizzontali
          p.line('LR', [[-7, -30], [-4.6, -46], [-8.6, -66], [-11.6, -92]], .55, { h: -.8, a: .7 });
          for (let i = 0; i < 9; i++) p.line('LR', [[-12 + i * .35, -50 - i * 4.4], [-6 + i * .1, -49 - i * 4.4]], .5, { h: -.5 });
          p.text('L', psIni(spec.produttore), 28, -29.4, 3.4, { a: .8, h: -.45 });
        } },
      hammer: ['mozzo', -5.4, -17.6, { w: 3, mat: K.mat('nero', null, { r: .4 }) }],
      trigger: ['curvo', 86.5, -20, { mat: K.mat('nero', null, { r: .5 }), w: 3.3 }],
      levers: [[[[54, -14.2, .8], [79, -14.2, .8], [80, -16.4, 1], [62, -18, 1.5], [56, -19.2, 1.5]], -12, -10.4, mL],
        [[[92, -15, .5], [99, -15, .5], [99, -18.4, .8], [92, -18.4, .8]], -11.6, 11.6, mL],
        [[[62.4, -37.6, 1.5], [69, -37.6, 1.5], [69, -45.6, 1.5], [62.4, -45.6, 1.5]], -15.2, -12.6, mC, 'corpo', .8]],
      mag: psMagO(ma, mb, 'polimero', { w: 13.8 }),
      arr: -7, gc: G.c, corsa: 35, tilt: 0, ciclo: { canna: { dx: -.004, rx: .5 } }
    });
  };
  MAP2[17] = { f: 'pistola_polimero_canna_rotante', o: {} };

  // =====================================================================================================================
  // PISTOLE D'ACCIAIO O DI LEGA CON GUANCETTE
  // =====================================================================================================================
  // medaglione tondo inciso sulle guancette (con iniziali)
  function psMedal(p, x, y, r, txt) {
    p.fill('LR', K.circ(x, y, r, 28), { h: .4, a: .95, r: .35 }); p.line('LR', K.circ(x, y, r, 28), .35, { h: -.7, a: .6 }, true);
    p.line('LR', K.circ(x, y, r * .8, 28), .2, { h: -.4 }, true); if (txt) p.text('LR', txt, x, y, r * .8, { a: .7, h: -.5 });
  }
  // stella a cinque punte (rilievo)
  function psStar(p, x, y, r, f, side) {
    const pts = []; for (let k = 0; k < 10; k++) { const a = PI / 2 + k * PI / 5, rr = k % 2 ? r * .42 : r; pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
    p.fill(side || 'LR', pts, f || { h: .5, a: .9 });
  }
  // righe parallele (scanalature) dentro un poligono: direzione ang (rad, 0 = orizzontale), passo q
  function psRibs(p, zone, q, ang, f) {
    f = f || {}; const PZ = K.P2(zone), b = K.bbox2(PZ), cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2, R = Math.hypot(b[2] - b[0], b[3] - b[1]) / 2 + 2, ca = Math.cos(ang), sa = Math.sin(ang);
    const inside = (x, y) => { let c = false; for (let i = 0, j = PZ.length - 1; i < PZ.length; j = i++) { if ((PZ[i][1] > y) !== (PZ[j][1] > y) && x < (PZ[j][0] - PZ[i][0]) * (y - PZ[i][1]) / (PZ[j][1] - PZ[i][1]) + PZ[i][0]) c = !c; } return c; };
    for (let t = -R; t <= R; t += q) {
      let seg = null; const out = [];
      for (let u = -R; u <= R; u += .8) { const x = cx + ca * u - sa * t, y = cy + sa * u + ca * t, ins = inside(x, y); if (ins && !seg) seg = [[x, y], [x, y]]; if (ins) seg[1] = [x, y]; if (!ins && seg) { out.push(seg); seg = null; } }
      if (seg) out.push(seg);
      for (const sg of out) p.line('LR', sg, q * (f.w || .42), { h: f.h !== undefined ? f.h : -.8, a: f.a !== undefined ? f.a : .7 });
    }
  }
  // venatura del legno dipinta (linee lunghe leggermente ondulate lungo la direzione ang) per le guancette di noce
  function psGrain(p, zone, ang) {
    const b = K.bbox2(K.P2(zone)), cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2, R = Math.hypot(b[2] - b[0], b[3] - b[1]) / 2, ca = Math.cos(ang), sa = Math.sin(ang);
    for (let i = 0; i < 46; i++) {
      const t = -R + 2 * R * K.hash(i, 3, 7), w = .25 + K.hash(i, 4, 7) * .6, pts = [];
      for (let u = -R; u <= R; u += 4) { const d = Math.sin(u * .08 + i) * 1.2 + Math.sin(u * .023 + i * 1.7) * 2.4; pts.push([cx + ca * u - sa * (t + d), cy + sa * u + ca * (t + d)]); }
      p.line('LR', pts, w * .7, { h: -.05, a: K.hash(i, 5, 7) > .5 ? .86 : 1.05 });
    }
  }
  // contorni classici del fusto: parte alta (a filo del carrello, con la coda) e fusto dell'impugnatura (sotto le guancette)
  // k = {top (bordo alto del fusto), fx (fronte del copricanna), dc (fondo del copricanna), ot (alto dell'apertura del ponticello), op:[x0,x1,yb],
  //      J, B, R (davanti in alto, davanti in basso, dietro in basso), back:[[x,y,r]...] dorso dal basso verso l'alto, web:[x,y] incavo della mano,
  //      tang:[[x,y,r,s]...] coda dalla mano fino al carrello, front:[[x,y,r,s]...] fronte del fusto dall'alto in basso, x0 (inizio in alto dietro)}
  function psClassic(k) {
    const { fx, dc, ot, op, J, B, R } = k, yt = k.top;
    const out = [[k.x0 === undefined ? -3 : k.x0, yt, .5, .5], [fx, yt, 0, .5]].concat(k.front || [[fx + 1.2, yt - 3, 1, .6], [fx + 1.2, dc + 1, 2, .6]],
      [[fx, dc, 2, .6], [op[1] + 7.4, dc - .3, 1.5, .6], [op[1] + 3.4, ot, 1.2, .6], [op[0] + 2, ot, 2, .6], [op[0] - 3, ot - 5, 0, .6], [k.web[0] + 8, ot - 9, 0, .6], [k.web[0], k.web[1], 3, 1]], k.tang);
    const grip = [[op[0] - 1, ot - 1.5, 0, 1], [J[0], J[1], 3, 1], [B[0], B[1], 3, 1], [R[0], R[1], 3, 1]].concat(k.back, [[k.web[0], k.web[1], 3, 1], [k.web[0] + 9, ot - 1.5, 0, 1]]);
    return { out, grip };
  }

  // costruzione comune: P = {nome, L, top, slide, rear:[tipo,x0,x1,o], front:[tipo,x0,x1,o], muz, guide, barrel, slideX(A, S),
  //   frame: {out, hw, b, guard, hwG, bG, grip, hwP, bP, mat, c, m, rough, paint(p), more:[[percorso, hw, b]]},
  //   panels: {out, z0, t, b, mat, c, rough, paint(p), screws:[[x,y,r]], wrap (una sola guancetta avvolgente)},
  //   rail, hammer, trigger, levers, extra(A, F, S), mag, gc, corsa, tilt, ciclo, xb (x della bocca se la canna sporge)}
  function psSteelGun(spec, P) {
    const A = K.asm(P.nome), top = P.top, sl = P.slide;
    const S = psSlide(A, sl);
    const ro = P.rear[3] || {}, fo = P.front[3] || {};
    const rt = psRear(A, P.rear[0], P.rear[1], P.rear[2], ro.y0 !== undefined ? ro.y0 : top - .4, ro);
    const ft = psFront(A, P.front[0], P.front[1], P.front[2], fo.y0 !== undefined ? fo.y0 : top - .4, fo);
    if (P.muz !== false) psMuzzle(A, P.L, P.muz || 7.4, { guide: P.guide });
    psBarrel(A, P.barrel);
    if (P.slideX) P.slideX(A, S);
    // fusto: parte alta, ponticello sottile, impugnatura (sotto le guancette), pezzi in più
    const fr = P.frame, more = fr.more || [];
    const fbb = psBB([fr.out, fr.guard, fr.grip].concat(more.map(m => m[0])), 1.5);
    const F = psPainted({ out: fr.out, bb: fbb, w: 1024, h: 1024, mat: fr.mat || 'brunito', c: fr.c, m: fr.m, rough: fr.rough === undefined ? .42 : fr.rough, paint: fr.paint, k: 2.4, na: .1, wr: .4 });
    A.add(K.slab(fr.out, -fr.hw, fr.hw, { b: Math.max(fr.b || 1.8, 2.4), bs: 4, uv: fbb }), F.m);
    A.add(K.slab(fr.guard, -fr.hwG, fr.hwG, { b: fr.bG || 2, uv: fbb }), F.m);
    A.add(K.slab(fr.grip, -fr.hwP, fr.hwP, { b: Math.max(fr.bP || 2.6, fr.hwP * .46), bs: 5, uv: fbb }), F.m);   // dorso e frontale tondi
    for (const [pth, hw, b] of more) A.add(K.slab(pth, -hw, hw, { b, uv: fbb }), F.m);
    if (P.rail) A.add(K.slab(psRail(...P.rail), -P.rail[4], P.rail[4], { b: .55, uv: fbb }), F.m);
    // guancette (due pezzi) o impugnatura avvolgente (un pezzo)
    const pn = P.panels;
    if (pn) pn.t = Math.min(pn.t, pn.wrap ? 3.6 : 2.6);   // guancette sottili
    if (pn) {
      const pbb = psBB([pn.out], 1.5);
      const PN = psPainted({ out: pn.out, bb: pbb, w: 512, h: 1024, mat: pn.mat || 'polimero', c: pn.c, m: pn.m, rough: pn.rough === undefined ? .5 : pn.rough, paint: pn.paint, k: pn.k || 2.4, ns: pn.ns || .9, wr: pn.wr, na: pn.na });
      if (pn.wrap) A.add(K.slab(pn.out, -pn.z0 - pn.t, pn.z0 + pn.t, { b: pn.b, bs: 4, uv: pbb }), PN.m);
      else {
        A.add(K.slab(pn.out, -pn.z0 - pn.t, -pn.z0 + .3, { bL: pn.b, bR: 0, bs: 4, uv: pbb }), PN.m);
        A.add(K.slab(pn.out, pn.z0 - .3, pn.z0 + pn.t, { bL: 0, bR: pn.b, bs: 4, uv: pbb }), PN.m);
      }
      for (const sc of pn.screws || []) for (const s of [-1, 1]) WC.put(A, WC.screw(sc[0], sc[1], s * (pn.z0 + pn.t - .9), sc[2] || 2.5, s, K.mat(sc[3] || 'brunito')));
    }
    if (P.hammer) psHammer(A, P.hammer[0], P.hammer[1], P.hammer[2], P.hammer[3]);
    psTrigger(A, P.trigger[0], P.trigger[1], P.trigger[2], P.trigger[3]);
    for (const lv of P.levers || []) psLever(A, lv[0], lv[1], lv[2], lv[3], lv[4], lv[5]);
    if (P.extra) P.extra(A, F, S);
    const rel = psMag(A, P.mag);
    psAnchors(A, { L: P.xb || P.L, port: sl.port, hw: sl.hw, gc: P.gc, tg: [P.trigger[1], P.trigger[2]], rs: [(P.rear[1] + P.rear[2]) / 2, rt], fs: [(P.front[1] + P.front[2]) / 2, ft], ghw: pn ? pn.z0 + pn.t : 13 });
    const r = A.done();
    const ciclo = Object.assign({ carrello: { dx: -(P.corsa || 36) * .001 }, grilletto: { rz: P.trigger[0] === 'scorrevole' ? -.06 : -.12 } }, P.barrel.fisso ? {} : { canna: { dx: -.003, rz: P.tilt === undefined ? .03 : P.tilt } }, P.hammer ? { cane: { rz: .62 } } : {}, P.ciclo || {});
    r.info = { azione: 'semi', bossolo: 'pistola', ciclo, ricarica: { caricatore: rel } };
    return r;
  }
  const psMagS = (a, b, o) => { o = o || {}; const ml = Math.hypot(b[0] - a[0], b[1] - a[1]); return { a, b, w: o.w || 11.4, mat: K.mat(o.mat || 'nero', null, { r: .45, c: o.c }), base: psBase(ml, { d: o.d || 3.6, fw: o.fw || 1.2, bk: o.bk || 0 }), body: [o.bw || 9.6, 90, 8, ml - 8], drop: o.drop || 112, bb: .9 }; };
  // leve laterali (sinistra: z negativo; destra: z positivo)
  const psL = (pth, hw, m, t) => [pth, -hw - (t || 1.7), -hw + .3, m];
  // guancette classiche di noce: venatura dipinta, quadrettatura con bordo liscio
  const psWalnut = (zone, inner, q) => p => { p.fill('LR', zone, { a: 1 }); psGrain(p, zone, -1.3); p.checker('LR', inner, q || 1.45, { r: .62 }); p.line('LR', inner, .3, { h: -.5, a: .8 }, true); };

  // =====================================================================================================================
  // 11) pistola governativa d'acciaio fosfatato: carrello con zigrinatura fine, boccola in bocca, sicura dorsale (id 8)
  // =====================================================================================================================
  FAM2.pistola_acciaio_governativa = function (spec) {
    const L = 206, top = 12.5, bot = -15.5, hw = 11.6, mP = K.mat('parker'), mPd = K.mat('parker', null, { c: '#262824', r: .55 });
    const plain = [[0, bot, .8, .35], [157.5, bot, 1.2, .35], [159, -26, 1.5, .5], [L, -26, 1.5, .5], [L, top, 2.2, 1], [0, top, 1.5, 1]];
    const outL = [[0, bot, .8, .35], [101, bot, .4, .35], [103, bot + 3.6, 1.6, .35], [111, bot + 3.6, 1.6, .35], [113, bot, .4, .35], [157.5, bot, 1.2, .35], [159, -26, 1.5, .5], [L, -26, 1.5, .5], [L, top, 2.2, 1], [0, top, 1.5, 1]];
    const k = { top: bot, fx: 157.5, dc: -26, ot: -24.6, op: [60, 94, -46], J: [52, -50], B: [31, -121], R: [-16, -106], x0: -9,
      back: [[-15.2, -92, 8, 1], [-11.4, -76, 20, 1], [-5, -58, 24, 1], [-1.6, -44, 14, 1], [-2.4, -32, 6, 1]], web: [-7.4, -25.6],
      tang: [[-18, -21, 3, 1], [-17.6, -17.6, 2, .9], [-10, -16.4, 2, .8]], front: [[158.6, -18.6, 1, .6], [158.6, -25, 2, .6]] };
    const C = psClassic(k);
    return psSteelGun(spec, {
      nome: 'pistola_acciaio_governativa', L, top,
      slide: { out: outL, outR: psNotch(plain, 72, 104, 3.2), port: [72, 104, 3.2], hw, b: 2.2, mat: 'parker', rough: .62, k: 2.8,
        paint(p) {
          p.grooves('LR', 3, 33, bot + 1.2, top - 1.8, 1.62, { wr: .55 });
          p.text('L', spec.produttore.toUpperCase() + '  MFG. CO.', 120, 3.2, 3, { spacing: 2 });
          p.text('L', spec.nome.toUpperCase() + '  —  CAL. .45', 120, -3, 2.3, { spacing: 2 });
          p.text('R', 'MOD. ' + spec.nome.toUpperCase() + '  ' + spec.anno, 136, 2.6, 2.4, { spacing: 2 });
          p.fill('R', K.rrect(52, 3, 70, 7.4, .6), { h: .25, a: .9 }); p.line('R', K.rrect(52, 3, 70, 7.4, .6), .22, { h: -.6, a: .6 }, true);  // estrattore
        } },
      rear: ['nuda', 8, 14, { w: 4.4, h: 3.6, nw: 1.25, nd: 1.8, mat: mP }], front: ['lama', L - 14, L - 8, { h: 4.4, w: 1.15, mat: mP }],
      muz: 7.8, barrel: { x0: 64, x1: L + 1.2, r: 7.4, ri: 5.7, hood: [72.4, 103.6, top - .7, 7.6], mat: psSteel() },
      slideX(A) { // boccola della canna e tappo della molla di recupero
        A.add(K.latheX([[L - .6, 7.5], [L - .6, 10.4], [L + .6, 10.4], [L + 1.3, 9.8], [L + 1.3, 7.5]], { seg: 30 }), mP, 'carrello');
        A.add(K.rod(L - 3, L + .9, 5.4, { cy: -18.4, seg: 22 }), mP, 'carrello'); A.add(K.discX(L + .95, -18.4, 0, 2.1, 1, 14), psDark(), 'carrello');
      },
      frame: { mat: 'parker', rough: .62, hw: hw - .2, b: 1.4, hwG: 5.6, bG: 2.1, hwP: 9.8, bP: 2.6, out: C.out, grip: C.grip,
        guard: psGuard({ op: k.op, yt: -25.6, fr: 6, bt: 5.6, st: 'tonda', xr: 44, ru: 6 }),
        paint(p) {
          for (const [x, y] of [[2, -20], [80, -24.6], [-3, -30]]) p.pin('LR', x, y, 1.4, { h: .3, a: 1.05 });
          p.text('R', 'N. ' + psSer(spec, ''), 80, -20.4, 2, { spacing: 1 });
          p.text('L', spec.paese.toUpperCase(), 130, -21, 1.8);
        } },
      panels: { out: [[52, -28.6, 3], [27.8, -115, 4], [-11.6, -101.6, 5], [-1.6, -60, 24], [1.8, -34, 6], [3, -28.6, 3]], z0: 9.6, t: 4.2, b: 3, mat: 'bachelite', c: '#3a1d10', rough: .48,
        paint(p) {
          p.checker('LR', [[50, -30.6], [27, -113], [-9.6, -100.2], [.4, -60], [3.8, -34], [4.8, -30.6]], 1.7, { r: .62 });
          for (const [x, y] of [[44, -40], [25, -104]]) { p.fill('LR', K.circ(x, y, 5.4, 24), { h: .25, a: 1.02, r: .4 }); p.line('LR', K.circ(x, y, 5.4, 24), .3, { h: -.6 }, true); }
        }, screws: [[44, -40, 2.6], [25, -104, 2.6]] },
      hammer: ['sperone', -7.8, -14.6, { w: 3.4, s: 1.12, mat: mP }],
      trigger: ['scorrevole', 68.5, -25.2, { mat: mP, w: 3 }],
      levers: [psL([[-2, -17.4, 1], [6, -16.4, 2], [27, -16.8, 2], [29, -19.4, 1.5], [12, -21.4, 2], [4, -25.8, 3], [-3.4, -23, 2]], hw - .2, mPd),
        psL([[60, -16.6, 2], [76, -16.6, 2], [98, -17.4, 4], [100.4, -21, 4], [96, -24.6, 3], [80, -22.4, 2], [61.4, -21.6, 2]], hw - .2, mPd)],
      extra(A) {
        psButton(A, 96, -21, hw - .4, 2.6, 1, mPd, 1.2);             // testa del perno dell'arresto del carrello
        psButton(A, 54, -36.6, -9.6, 4.2, -1, mPd, 2.6);             // sgancio del caricatore
        WC.put(A, WC.swivel(-15.6, -109.6, 0, { r: 3.4, t: 1, mat: mP })); // anello per il cordino
      },
      mag: psMagS(k.R, k.B, { d: 3, fw: 1, w: 10.8 }),
      gc: [18, -72], corsa: 38
    });
  };
  MAP2[8] = { f: 'pistola_acciaio_governativa', o: {} };

  // =====================================================================================================================
  // 12) pistola d'acciaio brunito bifilare con carrello a gradino davanti, cane ad anello, guancette di noce (id 6)
  // =====================================================================================================================
  FAM2.pistola_acciaio_carrello_a_gradino = function (spec) {
    const L = 190, top = 13, bot = -14.6, hw = 11.4, hwF = 10.1, mB = K.mat('brunito'), mBd = K.mat('brunito', null, { r: .4 });
    const k = { top: bot, fx: 150, dc: -24.6, ot: -23.4, op: [56, 86, -44.6], J: [48, -49], B: [32, -116], R: [-13.4, -103.8], x0: -6,
      back: [[-11, -80, 30, 1], [-6.4, -56, 30, 1], [-3.4, -38, 12, 1]], web: [-6.6, -26.4], tang: [[-13, -21.6, 3, 1], [-12.6, -17.6, 2, .9], [-6, -16, 2, .8]],
      front: [[151.4, -17.6, 1, .6], [152, -23.4, 2, .6]] };
    const C = psClassic(k), pz = [[47.6, -27.6, 3], [28.4, -110, 4], [-9.4, -99, 4], [-6.6, -78, 20], [-2.4, -56, 20], [.6, -38, 6], [1.6, -27.6, 3]];
    const rearOut = [[0, bot, .8, .35], [124, bot, 1, .35], ['q', 112, (bot + top) / 2, 128, top], [0, top, 1.6, 1]];
    return psSteelGun(spec, {
      nome: 'pistola_acciaio_carrello_a_gradino', L, top,
      slide: { out: rearOut, port: [60, 94, 3], hw, b: 2.2, mat: 'brunito', rough: .3, bb: [-1, bot - 1, L + 1, top + 1],
        paint(p) {
          p.grooves('LR', 4, 28, bot + 1.2, top - 1.6, 1.9, { wr: .55 });
          p.text('L', spec.produttore.toUpperCase() + ' — ' + spec.paese.toUpperCase(), 92, 2.4, 2.6, { spacing: 2 });
          p.text('L', spec.nome.toUpperCase() + '  CAL. ' + psCal(spec.calibro), 92, -3.6, 2.2, { spacing: 2 });
          p.text('R', psSer(spec, ''), 110, -8, 2);
        } },
      rear: ['nuda', 8, 15, { w: 4.6, h: 4.2, nw: 1.4, nd: 2, mat: mB }], front: ['lama', L - 12, L - 6, { h: 4.6, w: 1.25, mat: mB }],
      muz: 7.4, guide: [-9.2, 2.6], barrel: { x0: 54, x1: L + .6, r: 7, ri: 4.5, hood: [60.4, 93.6, top - .6, 7], mat: psSteel() },
      slideX(A, S) { // parte anteriore più stretta (il gradino)
        const fo = [[110, bot, 0, .35], [L - 2, bot, 1.2, .35], [L, bot + 2.4, 1.2, .6], [L, top, 2, 1], [110, top, 0, 1]];
        A.add(K.slab(fo, -hwF, 0, { bL: 2, bR: 0, uv: S.bb }), S.m, 'carrello'); A.add(K.slab(fo, 0, hwF, { bL: 0, bR: 2, uv: S.bb }), S.m, 'carrello');
      },
      frame: { mat: 'brunito', rough: .32, hw: hw - .2, b: 1.4, hwG: 5.4, bG: 2, hwP: 9.6, bP: 2.4, out: C.out, grip: C.grip,
        guard: psGuard({ op: k.op, yt: -24.2, fr: 6, bt: 5.6, st: 'tonda', xr: 40, ru: 6 }),
        paint(p) { for (const [x, y] of [[4, -20], [76, -23.4]]) p.pin('LR', x, y, 1.3, { h: .3, a: 1.05 }); p.text('R', psSer(spec, ''), 74, -19.4, 1.8); } },
      panels: { out: pz, z0: 9.4, t: 3.6, b: 2.6, mat: 'bachelite', c: '#4a2816', rough: .44,
        paint: psWalnut(pz, [[44.6, -30.6], [28, -106.6], [-6.4, -96.6], [-3.6, -78], [.4, -56], [3.4, -38], [4.4, -30.6]]), screws: [[18, -68, 2.4]] },
      hammer: ['anello', -6.4, -14.4, { w: 3.2, mat: mB }],
      trigger: ['curvo', 65, -22.8, { mat: mB }],
      levers: [psL([[-1, -16.4, 1], [14, -16.2, 1.5], [17.6, -18.4, 1.5], [9, -21.6, 2], [0, -23.4, 2]], hw - .2, mBd),
        psL([[50, -16.6, 1.5], [68, -16.6, 2], [86, -17.4, 3], [88.6, -20.8, 3], [84, -23.4, 2], [68, -21.6, 2], [52, -22, 2], [46, -19.6, 2]], hw - .2, mBd)],
      extra(A) { psButton(A, 50, -35, -9.6, 3.8, -1, mBd, 2.4); psButton(A, 86, -20, hw - .4, 2.4, 1, mBd, 1); },
      mag: psMagS(k.R, k.B, { d: 3.2, fw: 1, w: 11 }),
      gc: [16, -66], corsa: 36
    });
  };
  MAP2[6] = { f: 'pistola_acciaio_carrello_a_gradino', o: {} };

  // =====================================================================================================================
  // 13) pistola d'acciaio sottile a fianchi piatti, senza sicura, boccola in bocca, guancette nere a costole con stella (id 5)
  // =====================================================================================================================
  FAM2.pistola_acciaio_sottile = function (spec) {
    const L = 187, top = 11.4, bot = -14, hw = 10.8, mB = K.mat('brunito'), mBd = K.mat('brunito', null, { r: .38 });
    const k = { top: bot, fx: 140, dc: -23.6, ot: -22.6, op: [56, 84, -43.6], J: [48, -47], B: [38, -114], R: [-10.4, -108], x0: -5,
      back: [[-8, -80, 30, 1], [-5, -50, 30, 1], [-3.6, -34, 8, 1]], web: [-5.6, -24], tang: [[-9.6, -19.4, 2.6, 1], [-9.4, -16, 2, .9], [-4, -15, 1.5, .8]],
      front: [[141.4, -17, 1, .6], [141.4, -22.6, 2, .6]] };
    const C = psClassic(k);
    const out = [[0, bot, .8, .35], [140, bot, 1, .35], [141.5, -23.6, 1.4, .5], [L, -23.6, 1.4, .5], [L, top, 2, 1], [0, top, 1.4, 1]];
    return psSteelGun(spec, {
      nome: 'pistola_acciaio_sottile', L, top,
      slide: { out, port: [60, 92, 2.6], hw, b: 1.8, mat: 'brunito', rough: .3,
        paint(p) {
          p.grooves('LR', 4, 31, bot + 1.1, top - 1.4, 1.75, { wr: .5 });
          psStar(p, 118, 1, 3.4, { h: .5, a: .9 }, 'L');
          p.text('L', spec.produttore.toUpperCase(), 136, 1.4, 2.6, { spacing: 3 });
          p.text('R', psSer(spec, ''), 120, -7, 2.2, { spacing: 1 });
          p.fill('R', K.rrect(46, 2.4, 59.4, 6.4, .6), { h: .25, a: .9 }); p.line('R', K.rrect(46, 2.4, 59.4, 6.4, .6), .22, { h: -.6, a: .6 }, true);
        } },
      rear: ['nuda', 7, 13, { w: 4.2, h: 3.6, nw: 1.2, nd: 1.8, mat: mB }], front: ['mezzaluna', L - 15, L - 7, { h: 4, w: 1.1, mat: mB }],
      muz: 7, barrel: { x0: 54, x1: L + .8, r: 6.6, ri: 3.9, hood: [60.4, 91.6, top - .6, 6.6], mat: psSteel() },
      slideX(A) {
        A.add(K.latheX([[L - .6, 6.8], [L - .6, 9.4], [L + .5, 9.4], [L + 1.1, 8.9], [L + 1.1, 6.8]], { seg: 28 }), mB, 'carrello');
        A.add(K.rod(L - 3, L + .7, 4.6, { cy: -16.6, seg: 20 }), mB, 'carrello'); A.add(K.discX(L + .75, -16.6, 0, 1.8, 1, 12), psDark(), 'carrello');
      },
      frame: { mat: 'brunito', rough: .32, hw: hw - .2, b: 1.3, hwG: 5, bG: 1.9, hwP: 9.2, bP: 2.2, out: C.out, grip: C.grip,
        guard: psGuard({ op: k.op, yt: -23.2, fr: 5.6, bt: 5.2, st: 'tonda', xr: 40, ru: 5 }),
        paint(p) { for (const [x, y] of [[3.4, -19], [74, -22.6]]) p.pin('LR', x, y, 1.2, { h: .3, a: 1.05 }); p.text('R', psSer(spec, ''), 76, -18.4, 1.7); } },
      panels: { out: [[46, -26.4, 3], [34, -107, 3], [-6.6, -103, 3], [-3.2, -60, 40], [-.4, -34, 4], [.6, -26.4, 3]], z0: 9, t: 3, b: 2.2, mat: 'bachelite', c: '#191210', rough: .4,
        paint(p) {
          psRibs(p, [[44, -46], [33.6, -104], [-4.4, -100], [-1.4, -60], [.6, -46]], 2.3, -.15 + PI / 2, { h: -.85, a: .62 });
          p.fill('LR', K.circ(22, -36, 7.6, 28), { h: .3, a: 1 }); p.line('LR', K.circ(22, -36, 7.6, 28), .5, { h: -.7 }, true);
          psStar(p, 22, -36, 6, { h: .6, a: 1.05 });
        } },
      hammer: ['stretto', -6.4, -13.6, { w: 2.8, mat: mB }],
      trigger: ['curvo', 65, -22, { mat: mB, w: 2.6 }],
      levers: [psL([[62, -15.4, 1], [76, -15.4, 1.5], [82, -17.4, 2], [79, -21.4, 2], [66, -20.2, 1.5], [60, -18, 1]], hw - .2, mBd)],
      extra(A) { psButton(A, 50, -33, -9, 3.4, -1, mBd, 2); WC.put(A, WC.swivel(-8.6, -109.6, -6.4, { r: 3, t: .9, rot: PI / 2, mat: mB })); },
      mag: psMagS(k.R, k.B, { d: 3, fw: .8, w: 10 }),
      gc: [18, -68], corsa: 33
    });
  };
  MAP2[5] = { f: 'pistola_acciaio_sottile', o: {} };

  // =====================================================================================================================
  // 14) pistola d'acciaio a rulli: carrello lungo dal muso rastremato, leva di abbattimento posteriore, finitura grigia (id 4)
  // =====================================================================================================================
  FAM2.pistola_acciaio_rulli = function (spec) {
    const L = 203, top = 12.6, bot = -14.4, hw = 11.2, mG = K.mat('grigio', null, { c: '#4a4d50', r: .5 }), mGd = K.mat('grigio', null, { c: '#3a3d40', r: .45 });
    const k = { top: bot, fx: 190, dc: -25.4, ot: -24.6, op: [62, 94, -46], J: [54, -50], B: [36, -121], R: [-12, -108], x0: -5,
      back: [[-9, -80, 30, 1], [-5.6, -54, 30, 1], [-3.6, -36, 10, 1]], web: [-6.4, -25], tang: [[-10.6, -20, 2.6, 1], [-10.4, -16.4, 2, .9], [-4, -15.4, 1.5, .8]],
      front: [[193, -18, 3, .6], [191.4, -24.4, 3, .6]] };
    const C = psClassic(k);
    return psSteelGun(spec, {
      nome: 'pistola_acciaio_rulli', L, top,
      slide: { out: [[0, bot, .8, .35], [L - 4, bot, 2, .35], [L, bot + 4, 2.4, .6], [L, 6.6, 4, 1], [L - 9, 9.8, 8, 1], [146, top, 30, 1], [0, top, 1.6, 1]], port: [66, 100, 2.6], hw, b: 2.4, mat: 'grigio', c: '#4c4f52', m: .55, rough: .5,
        paint(p) {
          p.grooves('LR', 4, 31, bot + 1.3, top - 1.6, 2.2, { wr: .5 });
          p.text('L', spec.produttore.toUpperCase() + '  ' + spec.nome.toUpperCase(), 118, 2.4, 2.6, { spacing: 2 });
          p.text('L', 'CAL. ' + psCal(spec.calibro), 118, -3.6, 2.2);
          p.text('R', psSer(spec, ''), 124, -7, 2.2);
        } },
      rear: ['nuda', 8, 15, { w: 4.6, h: 4, nw: 1.3, nd: 1.9, mat: mG }], front: ['lama', L - 22, L - 15, { h: 4.4, w: 1.2, mat: mG, y0: 10.2 }],
      muz: 7.2, guide: [-8.8, 2.4], barrel: { x0: 56, x1: L + .4, r: 6.8, ri: 3.9, hood: [66.4, 99.6, top - .6, 6.8], mat: psSteel() },
      frame: { mat: 'grigio', c: '#4a4d50', m: .55, rough: .52, hw: hw - .2, b: 1.4, hwG: 5.6, bG: 2, hwP: 9.6, bP: 2.4, out: C.out, grip: C.grip,
        guard: psGuard({ op: k.op, yt: -25, fr: 6.4, bt: 5.6, st: 'tonda', xr: 46, ru: 6 }),
        paint(p) { for (const [x, y] of [[4, -21], [80, -24.6], [150, -22]]) p.pin('LR', x, y, 1.3, { h: .3, a: 1.05 }); p.text('R', psSer(spec, ''), 82, -20, 1.8); } },
      panels: { out: [[54, -28.4, 3], [32.8, -114, 4], [-8, -103, 4], [-4.6, -66, 30], [-.8, -37, 5], [.6, -28.4, 3]], z0: 9.4, t: 3.4, b: 2.6, mat: 'bachelite', c: '#2a1a12', rough: .42,
        paint(p) {
          psRibs(p, [[50, -48], [31.6, -110], [-5.6, -100], [-2.4, -66], [.6, -48]], 2.6, -.26, { h: -.85, a: .65 });
          p.fill('LR', K.circ(24, -40, 6.4, 26), { h: .35, a: 1.02 }); p.line('LR', K.circ(24, -40, 6.4, 26), .45, { h: -.7 }, true); p.text('LR', psIni(spec.produttore), 24, -40, 4, { a: .7, h: -.5 });
        }, screws: [[20, -84, 2.3]] },
      hammer: ['anello', -6.4, -14, { w: 3, mat: mG }],
      trigger: ['curvo', 71, -24, { mat: mG }],
      levers: [psL([[-2, -15.6, 1], [20, -15.6, 2], [24, -17.6, 2], [18, -20.4, 2], [2, -22.6, 2], [-3, -20, 1]], hw - .2, mGd),
        psL([[62, -16.4, 1.5], [82, -16.4, 2], [96, -17, 3], [97.4, -20.6, 3], [92, -23, 2], [70, -21.6, 2], [60, -20, 1.5]], hw - .2, mGd)],
      extra(A) { psButton(A, 56, -38, -9.4, 3.6, -1, mGd, 2.2); },
      mag: psMagS(k.R, k.B, { d: 3.2, fw: 1, w: 10.6, mat: 'grigio' }),
      gc: [20, -72], corsa: 36, tilt: 0
    });
  };
  MAP2[4] = { f: 'pistola_acciaio_rulli', o: {} };

  // =====================================================================================================================
  // 15) pistole d'acciaio con il carrello che scorre dentro le guide del fusto (id 3 monofilare con guancette di noce, id 9 bifilare)
  // =====================================================================================================================
  FAM2.pistola_acciaio_guide_interne = function (spec, o) {
    o = o || {}; const bi = o.variante === 'bifilare';
    const L = 200, top = bi ? 12.4 : 12, bot = bi ? -13 : -13.6, hw = bi ? 10.6 : 10.4, yr = -8;   // yr = bordo alto delle guide del fusto
    const mat = bi ? 'nero' : 'brunito', mS = K.mat(mat), mSd = K.mat(mat, null, { r: .4 });
    const k = bi ? { top: yr, fx: 188, dc: -25.6, ot: -24.4, op: [61, 93, -45.6], J: [52, -50], B: [35, -118], R: [-14, -104], x0: 3,
      back: [[-15, -84, 20, 1], [-11, -62, 30, 1], [-6.4, -40, 12, 1]], web: [-9.6, -25], tang: [[-16, -20.8, 3, 1], [-15.4, -16.6, 2, .9], [-4, -11, 2, .8]],
      front: [[194, -13, 5, .7], [192, -25, 3, .6]] }
      : { top: yr, fx: 186, dc: -25.4, ot: -24, op: [59, 90, -45], J: [51, -49], B: [34, -122], R: [-13, -110], x0: 3,
        back: [[-10, -80, 40, 1], [-6.4, -50, 30, 1], [-4.6, -34, 8, 1]], web: [-7.6, -24], tang: [[-10.6, -20.4, 2.6, 1], [-10.4, -16.4, 2, .9], [-3, -11, 2, .8]],
        front: [[192, -14, 5, .7], [190, -25, 3, .6]] };
    const C = psClassic(k);
    const out = bi ? [[0, bot, .8, .35], [L - 8, bot, 3, .35], [L, bot + 7, 4, .6], [L, top - 3, 4, 1], [L - 5, top - .6, 4, 1], [150, top, 30, 1], [0, top, 2.4, 1]]
      : [[0, bot, .8, .35], [L - 6, bot, 3, .35], [L, bot + 6, 4, .6], [L, top - 4, 5, 1], [L - 5, top, 5, 1], [0, top, 2.4, 1]];
    const pz = bi ? [[52, -27.6, 3], [31.5, -112, 4], [-10.4, -99, 4], [-11, -84, 20], [-7, -62, 30], [-2.4, -40, 10], [-2, -27.6, 3]]
      : [[50.6, -27.4, 3], [30.4, -116, 4], [-9, -105, 4], [-6, -70, 40], [-1.6, -36, 5], [-.6, -27.4, 3]];
    return psSteelGun(spec, {
      nome: 'pistola_acciaio_guide_interne', L, top,
      slide: { out, port: bi ? [64, 98, 2.2] : [64, 96, 2.4], hw, b: 4.4, bs: 4, mat, rough: bi ? .38 : .3,
        paint(p) {
          p.grooves('LR', 4, bi ? 32 : 27, bot + 1.4, top - 4, bi ? 2.1 : 1.8, { wr: .55 });
          p.text('L', spec.produttore.toUpperCase() + (bi ? '' : '  ' + spec.paese.toUpperCase()), 112, 2.6, 2.6, { spacing: 2 });
          p.text('L', spec.nome.toUpperCase() + '   ' + psCal(spec.calibro), 112, -2.6, 2.2, { spacing: 2 });
          p.text('R', psSer(spec, bi ? '' : 'P'), 122, -3, 2);
        } },
      rear: [bi ? '3p' : 'nuda', 7, 14, { w: 4.8, h: 4.2, nw: 1.35, nd: 2, mat: mS }], front: [bi ? 'punto' : 'lama', L - 14, L - 8, { h: 4.6, w: 1.25, mat: mS }],
      muz: 7.2, guide: [-8.6, 2.4], barrel: { x0: 56, x1: L + .4, r: bi ? 6.8 : 6.6, ri: 4.5, hood: [64.4, bi ? 97.6 : 95.6, top - .6, 6.6], mat: psSteel() },
      frame: { mat, rough: bi ? .4 : .32, hw: hw + 1, b: 1.6, hwG: 5.4, bG: 2, hwP: 9.6, bP: 2.4, out: C.out, grip: C.grip,
        guard: psGuard({ op: k.op, yt: -25, fr: 6, bt: 5.6, st: bi ? 'obliqua' : 'tonda', xr: 44, ru: 6 }),
        paint(p) { for (const [x, y] of [[5, -20], [k.op[0] + 20, -24]]) p.pin('LR', x, y, 1.3, { h: .3, a: 1.05 }); p.text('R', psSer(spec, ''), 80, -19.4, 1.7); } },
      panels: bi ? { out: pz, z0: 9.8, t: 3.4, b: 2.6, mat: 'polimero', c: '#141414', rough: .5,
        paint(p) { p.checker('LR', [[49, -30], [30.6, -109], [-8, -97], [-8.6, -84], [-4.6, -62], [0, -40], [.4, -30]], 1.35, { r: .7 }); p.text('LR', psIni(spec.produttore), 22, -40, 3.4, { a: .7, h: -.6 }); }, screws: [[18, -66, 2.4]] }
        : { out: pz, z0: 9.4, t: 3.6, b: 2.6, mat: 'bachelite', c: '#4a2816', rough: .44,
          paint: psWalnut(pz, [[47.6, -30.4], [29.4, -112.6], [-6.4, -102.6], [-3.4, -70], [.8, -36], [1.4, -30.4]]), screws: [[17, -72, 2.3]] },
      hammer: ['tondo', bi ? -7.4 : -6.2, bi ? -12.6 : -13.4, { w: 3, mat: mS }],
      trigger: ['curvo', bi ? 70 : 67.5, -23.6, { mat: mS }],
      levers: bi ? [psL([[-2, -9.6, 1], [12, -9.4, 1.5], [17, -11.6, 2], [11, -15.6, 2], [0, -16.4, 2]], hw + 1, mSd),
        psL([[50, -9.4, 1.5], [82, -9.4, 2], [96, -10.4, 3], [97.6, -14.6, 3], [92, -16.6, 2], [74, -15, 2], [52, -14, 2], [46, -12, 1.5]], hw + 1, mSd)]
        : [psL([[-2, -18.4, 2], [14, -17.6, 2], [22, -19, 3], [18, -23.4, 3], [4, -24, 2], [-4, -21.6, 2]], hw + 1, mSd),
          psL([[56, -9.4, 1.5], [82, -9.4, 2], [94, -10.2, 3], [95, -14, 3], [90, -16, 2], [70, -14.6, 2], [58, -13.6, 1.5]], hw + 1, mSd)],
      extra(A) {
        if (bi) psButton(A, 55, -38, -9.8, 3.8, -1, mSd, 2.4);
        else { A.add(K.box(-13, -113, -3.2, -6, -107, 3.2, .5), mSd); WC.put(A, WC.swivel(-11, -114, -6.4, { r: 3, t: .9, rot: PI / 2, mat: mS })); }
      },
      mag: psMagS(k.R, k.B, { d: 3.4, fw: 1, w: bi ? 11.4 : 10.4 }),
      gc: [17, -70], corsa: 35
    });
  };
  MAP2[3] = { f: 'pistola_acciaio_guide_interne', o: { variante: 'monofilare' } };
  MAP2[9] = { f: 'pistola_acciaio_guide_interne', o: { variante: 'bifilare' } };

  // =====================================================================================================================
  // 16) pistola tascabile a massa battente: carrello col muso arrotondato, sicura sul carrello, impugnatura avvolgente (id 1)
  // =====================================================================================================================
  FAM2.pistola_tascabile_massa_battente = function (spec) {
    const L = 160, top = 12, bot = -12.6, hw = 11.2, mB = K.mat('brunito'), mBd = K.mat('brunito', null, { r: .4 });
    const k = { top: bot, fx: 118, dc: -22.6, ot: -21.6, op: [52, 86, -42], J: [44, -45], B: [32, -104], R: [-12, -94], x0: -4,
      back: [[-9.6, -70, 30, 1], [-6.6, -44, 20, 1], [-5.4, -30, 6, 1]], web: [-6.6, -22], tang: [[-8.4, -18.4, 2.6, 1], [-8, -15, 2, .9], [-3, -14, 1.5, .8]],
      front: [[120, -17, 3, .6], [118, -22.6, 2, .6]] };
    const C = psClassic(k);
    return psSteelGun(spec, {
      nome: 'pistola_tascabile_massa_battente', L, top,
      slide: { out: [[0, bot, .8, .35], [L - 9, bot, 5, .35], [L, -6, 4, .6], [L, 5, 4, 1], [L - 12, top, 14, 1], [0, top, 2, 1]], port: [54, 80, 3], hw, b: 5.2, bs: 4, mat: 'brunito', rough: .3,
        paint(p) {
          p.grooves('LR', 4, 25, bot + 1.6, top - 4.2, 2.6, { wr: .5 });
          p.text('L', spec.produttore.toUpperCase(), 92, 1.6, 2.4, { spacing: 2 });
          p.text('L', psSer(spec, ''), 92, -4.4, 2.2);
          p.text('R', psCal(spec.calibro), 100, -5, 2);
        } },
      rear: ['nuda', 6, 12, { w: 4.4, h: 3.4, nw: 1.2, nd: 1.6, mat: mB }], front: ['rampa', L - 26, L - 16, { h: 3.4, w: 1.2, mat: mB, y0: top - 1.2 }],
      muz: 7, guide: null, barrel: { x0: 48, x1: L + .3, r: 6.2, ri: 4.5, hood: [54.4, 79.6, 5.4, 6], fisso: true, mat: psSteel() },
      slideX(A) { // sicura sul carrello (lato sinistro)
        A.add(K.slab([[3, 1.6, 1], [20, 2.8, 1.5], [23, 7, 2], [6, 8.4, 2], [2, 5.6, 1]], -hw - 1.5, -hw + 1.4, { b: .6 }), mBd, 'carrello');
      },
      frame: { mat: 'brunito', rough: .32, hw: hw - .2, b: 1.4, hwG: 5.4, bG: 2, hwP: 9.4, bP: 2.2, out: C.out, grip: C.grip,
        guard: psGuard({ op: k.op, yt: -22.2, fr: 6, bt: 5.4, st: 'tonda', xr: 36, ru: 6 }),
        paint(p) { for (const [x, y] of [[66, -19.6], [44, -22]]) p.pin('LR', x, y, 1.2, { h: .3, a: 1.05 }); } },
      // impugnatura avvolgente in bachelite con stella
      panels: { wrap: true, out: [[40, -25.6, 4], [27.6, -100, 4], [-13, -92, 6], [-10.6, -70, 30], [-7.6, -44, 20], [-6.4, -30, 6], [-4.4, -25, 4]], z0: 9.4, t: 4.4, b: 5, mat: 'bachelite', c: '#3a1c10', rough: .42,
        paint(p) {
          p.checker('LR', [[36, -44], [26.6, -96], [-9.6, -88.6], [-7.6, -66], [-5.6, -44]], 1.6, { r: .55 });
          p.fill('LR', K.circ(14, -35, 7.4, 28), { h: .3, a: 1 }); p.line('LR', K.circ(14, -35, 7.4, 28), .5, { h: -.7 }, true); psStar(p, 14, -35, 5.8, { h: .6, a: 1.05 });
        }, screws: [] },
      hammer: ['pm', -5.6, -13, { w: 3, s: .92, mat: mB }],
      trigger: ['curvo', 60, -20.6, { mat: mB, s: .92 }],
      levers: [psL([[52, -14, 1], [70, -14, 1.5], [78, -16, 2], [74, -19.6, 2], [58, -18.4, 1.5]], hw - .2, mBd)],
      extra(A) { A.add(K.box(-13.6, -95.4, -3, -6.4, -91.4, 3, .5), mBd); WC.put(A, WC.swivel(-10, -97, -8.6, { r: 3.2, t: .9, rot: PI / 2, mat: mB })); },
      mag: psMagS(k.R, k.B, { d: 3.2, fw: 1, w: 10.4 }),
      gc: [14, -58], corsa: 30
    });
  };
  MAP2[1] = { f: 'pistola_tascabile_massa_battente', o: {} };

  // =====================================================================================================================
  // 17) pistole con carrello aperto in alto (canna scoperta) e blocco di chiusura oscillante
  //     varianti: 'lunga' (id 2, fusto di lega e canna sporgente davanti al carrello), 'monofilare' (id 0), 'servizio' (id 7), 'tattica' (id 24)
  // =====================================================================================================================
  FAM2.pistola_carrello_aperto = function (spec, o) {
    o = o || {}; const v = o.variante || 'servizio';
    const D = {
      lunga: { L: 192, top: 12.6, bot: -14.6, hw: 12.2, xo: [62, 170], ys: 3.4, xp: 100, yp: -1, ext: 18, r: 7.4, sl: 'nero', fr: 'anod',
        k: { fx: 158, dc: -27.6, ot: -26, op: [60, 95, -48], J: [52, -52], B: [36, -122], R: [-12, -108], back: [[-9, -80, 30, 1], [-5.6, -54, 30, 1], [-4, -36, 10, 1]], web: [-7, -25], tang: [[-10.6, -20.6, 2.6, 1], [-10.4, -16.6, 2, .9], [-4, -16, 1.5, .8]], front: [[160, -19, 3, .6], [157, -27, 3, .6]] },
        pz: [[52, -29, 3], [32.4, -116, 4], [-8, -103, 4], [-5, -70, 30], [-1.4, -38, 5], [-.6, -29, 3]] },
      monofilare: { L: 198, top: 12.2, bot: -14, hw: 11.6, xo: [71, 176], ys: 3.4, xp: 106, yp: -.6, ext: .6, r: 7.2, sl: 'brunito', fr: 'anod',
        k: { fx: 172, dc: -25.6, ot: -24, op: [64, 96, -45], J: [56, -49], B: [40, -114], R: [-8, -101], back: [[-5.6, -76, 30, 1], [-3, -50, 20, 1], [-2.6, -34, 8, 1]], web: [-5.6, -23.6], tang: [[-8.6, -19.6, 2.6, 1], [-8.4, -16.2, 2, .9], [-3, -15.4, 1.5, .8]], front: [[175, -18, 3, .6], [172, -25, 3, .6]] },
        pz: [[55.7, -27.4, 3], [36.5, -108, 4], [-4.4, -96, 4], [-1.6, -70, 30], [.6, -36, 5], [1.4, -27.4, 3]] },
      servizio: { L: 211, top: 13, bot: -14.6, hw: 12.7, xo: [76, 188], ys: 3.8, xp: 110, yp: -1, ext: .6, r: 7.6, sl: 'nero', fr: 'anod',
        k: { fx: 192, dc: -28, ot: -26.4, op: [68, 104, -48.6], J: [60, -52], B: [40, -122], R: [-13, -108], back: [[-15, -86, 20, 1], [-11, -62, 30, 1], [-6.6, -40, 12, 1]], web: [-9.4, -25.6], tang: [[-13.6, -20.6, 3, 1], [-13, -17, 2, .9], [-4, -16, 1.5, .8]], front: [[195, -18, 3, .6], [192, -27.4, 3, .6]] },
        pz: [[60.8, -29.6, 3], [36.7, -116, 4], [-9, -103, 4], [-11, -86, 20], [-7, -62, 30], [-2.6, -40, 10], [-2.4, -29.6, 3]] },
      tattica: { L: 205, top: 13, bot: -14.6, hw: 12.7, xo: [76, 182], ys: 3.8, xp: 110, yp: -1, ext: .6, r: 7.6, sl: 'nero', fr: 'anod',
        k: { fx: 188, dc: -28, ot: -26.4, op: [68, 104, -48.6], J: [60, -52], B: [40, -122], R: [-13, -108], back: [[-12.6, -84, 40, 1], [-9, -60, 40, 1], [-6, -40, 12, 1]], web: [-9.4, -25.6], tang: [[-13.6, -20.6, 3, 1], [-13, -17, 2, .9], [-4, -16, 1.5, .8]], front: [[191, -18, 3, .6], [188, -27.4, 3, .6]] },
        pz: [[60.8, -29.6, 3], [36.7, -116, 4], [-9, -103, 4], [-8.6, -84, 40], [-5.4, -60, 40], [-2.4, -40, 10], [-2.4, -29.6, 3]] }
    }[v];
    const { L, top, bot, hw, xo, ys, xp, yp } = D, k = Object.assign({ top: bot, x0: -6 }, D.k), C = psClassic(k), op = k.op, J = k.J;
    const lu = v === 'lunga', mono = v === 'monofilare', tat = v === 'tattica';
    const mS = K.mat(D.sl), mSd = K.mat('nero', null, { r: .4 }), mF = K.mat(D.fr);
    const nose = lu ? [[L - 3, bot, 1.4, .35], [L, bot + 3, 1.4, .6], [L, top, 2.4, 1]] : tat ? [[L - 9, bot, 3, .35], [L, bot + 7, 3, .6], [L, top - 4, 4, 1], [L - 5, top, 4, 1]] : [[L - 6, bot, 3, .35], [L, bot + 5, 3, .6], [L, top - 3, 3.5, 1], [L - 3.5, top, 3.5, 1]];
    const bridge = [[xo[1], top, 2, .8], ['q', xo[1] - 1, ys + .6, xo[1] - 12, ys]];
    const outL = [[0, bot, .8, .35]].concat(nose, bridge, [[xo[0] + 6, ys, 3, .6], [xo[0], top, 2, .8], [0, top, 2.2, 1]]);
    const outR = [[0, bot, .8, .35]].concat(nose, bridge, [[xp + 4, ys, 3, .6], [xp, yp, 2, .4], [xo[0] + 4, yp, 2, .4], [xo[0], top, 2, .8], [0, top, 2.2, 1]]);
    const levR = [[1, 2.4, 1], [22, 3.2, 1.5], [25, 7.6, 2], [6, 9.6, 2], [.6, 6.4, 1]];   // leve di sicura e abbattimento sul carrello
    const xb = L + D.ext, pz = D.pz, hP = mono ? 9.6 : lu ? 10.2 : 10.6;
    return psSteelGun(spec, {
      nome: 'pistola_carrello_aperto', L, top, xb,
      slide: { out: outL, outR, port: [xo[0], xp, yp], hw, b: lu ? 2.6 : 4.4, bs: lu ? 3 : 4, mat: D.sl, rough: lu ? .5 : .36,
        paint(p) {
          if (!lu) p.grooves('LR', mono ? 5 : 27, mono ? 30 : 50, bot + 1.4, top - 3.4, 2.4, { wr: .52 });
          if (tat) p.grooves('LR', L - 52, L - 30, bot + 1.4, ys - 1.2, 2.4, { wr: .52 });
          const tx = lu ? 120 : (xo[0] + xo[1]) / 2 + 6;
          p.text('L', spec.produttore.toUpperCase() + (lu ? '' : ' — ' + spec.paese.toUpperCase()), tx, -1.6, lu ? 3 : 2.4, { spacing: 2 });
          p.text('L', (mono ? 'MOD. ' : '') + spec.nome.toUpperCase() + '  ' + psCal(spec.calibro), tx, -7, lu ? 2.6 : 2.2, { spacing: 2 });
          p.text('R', psSer(spec, ''), tx + 10, -7.6, 2);
          if (lu) p.text('L', psIni(spec.produttore), 36, 3, 4, { spacing: 2, weight: '900' });
        } },
      rear: [tat ? 'larga' : lu || mono ? 'nuda' : '3p', 6, tat ? 15 : 13.5, { w: lu ? 5 : 4.8, h: lu ? 3.6 : 4.4, nw: 1.35, nd: 2, mat: mS }],
      front: [tat ? 'fibra' : lu || mono ? 'lama' : 'punto', L - 15, L - 9, { h: 4.8, w: 1.3, mat: mS, col: 'verdefluo' }],
      muz: D.r + .4, guide: lu ? null : [-9.8, 2.8],
      barrel: lu ? { x0: 56, x1: xb, r: 7.4, ri: 4.5, hood: [xo[0] + .4, xp - .4, 9, 7.6], mat: psSteel('nera') }
        : { x0: 64, x1: L + .6, r: D.r, ri: 4.5, hood: [xo[0] + .4, xp - .4, 9.4, D.r], mat: psSteel(mono ? undefined : 'nera') },
      slideX(A) {
        if (!lu && !mono) for (const s of [-1, 1]) A.add(K.slab(levR, s < 0 ? -hw - 2 : hw - .6, s < 0 ? -hw + .6 : hw + 2, { b: .6 }), mSd, 'carrello');
        if (lu) { A.add(K.slab(levR.map(p => [p[0] + 4, p[1] - .6, p[2]]), -hw - 2, -hw + .6, { b: .6 }), mSd, 'carrello'); A.add(K.rod(-2.4, .6, 1.2, { cy: 6, seg: 10 }), mS, 'carrello'); }
      },
      frame: { mat: D.fr, rough: .4, hw: hw - .8, b: 2, hwG: 5.8, bG: 2.1, hwP: hP, bP: 2.8, out: C.out, grip: C.grip,
        guard: psGuard({ op, yt: k.dc + .4, fr: 6.6, bt: 6, st: v === 'servizio' ? 'uncino' : tat ? 'squadra' : 'tonda', xr: J[0] - 14, ru: 7 }),
        paint(p) {
          for (const [x, y] of [[4, -21], [op[1] - 6, k.ot + 4], [op[0] + 8, k.ot + 2]]) p.pin('LR', x, y, 1.3, { h: .3, a: 1.05 });
          p.text('R', psSer(spec, ''), op[0] + 22, k.ot + 4.6, 1.8);
        } },
      rail: tat ? [140, k.fx - 2, k.dc + .3, 4.6, 10.6, [152, 165, 178], 4.4] : null,
      panels: { out: pz, z0: hP - .2, t: tat ? 2.6 : 3.4, b: tat ? 2 : 2.6, mat: 'polimero', c: '#121314', rough: .5,
        paint(p) {
          const z = pz.map(q => [q[0] + (q[0] > 20 ? -2.6 : 2.6), q[1] + (q[1] > -60 ? -2.4 : 2.4)]);
          if (lu) psRibs(p, z, 2.4, 0, { h: -.85, a: .62 });
          else if (tat) psGripTex(p, z, { s: .45 });
          else p.checker('LR', z, mono ? 1.5 : 1.3, { r: .7 });
          if (!tat && !lu) psMedal(p, 24, -44, 5, psIni(spec.produttore));
          if (lu) { p.fill('LR', K.rrect(8, -46, 38, -40, 2), { h: .3, a: 1 }); p.text('LR', spec.produttore.toUpperCase(), 23, -43, 2.6, { a: .7, h: -.5 }); }
        }, screws: tat ? [[38, -46, 2.2], [22, -102, 2.2]] : [[22, lu ? -96 : -84, 2.4]] },
      hammer: [lu ? 'pm' : mono ? 'sperone' : 'tondo', -7, lu ? -14.4 : -15.2, { w: 3.2, s: mono ? .95 : 1.04, mat: lu ? K.mat('nero') : mS }],
      trigger: ['curvo', op[0] + 10, k.ot + 1, { mat: lu ? K.mat('nero') : mS }],
      levers: [psL([[op[0] - 4, -16.6, 1.5], [op[0] + 18, -16.6, 2], [op[0] + 30, -17.4, 2], [op[0] + 31, -21, 2], [op[0] + 22, -23, 2], [op[0], -22, 2]], hw - .8, mSd)]
        .concat(lu ? [psL([[94, -21.4, 1], [112, -21.4, 2], [114, -24.4, 2], [96, -25.4, 1.5]], hw - .8, mSd)] : mono ? [] : [psL([[op[1] + 4, -17.6, 1], [op[1] + 14, -17.6, 2], [op[1] + 16, -21.2, 2], [op[1] + 6, -22.4, 1.5]], hw - .8, mSd)]),
      extra(A) {
        if (lu) { // bullone esagonale di rinforzo, sgancio al tallone, anello del cordino
          for (const s of [-1, 1]) A.add(K.slab(K.circ(102, -20, 3.4, 6), s < 0 ? -hw - .2 : hw - 1.4, s < 0 ? -hw + 1.4 : hw + .2, { b: .4 }), mF);
          A.add(K.box(-14, -111, -3.2, -7, -105, 3.2, .5), mSd); WC.put(A, WC.swivel(-10, -112.6, -7, { r: 3.2, t: .9, rot: PI / 2, mat: mS }));
        } else {
          psButton(A, J[0] + 2, -38, -hP, 4, -1, mSd, 2.4);
          if (mono) for (const s of [-1, 1]) psButton(A, J[0] - 6, -22, s * (hw - 1), 3, s, mSd, s < 0 ? 1.8 : .8);   // sicura a pulsante passante
          else { psButton(A, op[1] + 9, -20, hw - 1, 2.2, 1, mSd, 1); WC.put(A, WC.swivel(-11, -110.6, -9, { r: 3.2, t: .9, rot: PI / 2, mat: mS })); }
        }
      },
      mag: psMagS(k.R, k.B, { d: lu || mono ? 3.4 : 5, fw: lu || mono ? 1 : 2, w: mono ? 10.4 : 11.6 }),
      gc: [20, -72], corsa: lu ? 40 : 38, tilt: 0, ciclo: { canna: { dx: lu ? -.008 : -.004 } }
    });
  };
  MAP2[2] = { f: 'pistola_carrello_aperto', o: { variante: 'lunga' } };
  MAP2[0] = { f: 'pistola_carrello_aperto', o: { variante: 'monofilare' } };
  MAP2[7] = { f: 'pistola_carrello_aperto', o: { variante: 'servizio' } };
  MAP2[24] = { f: 'pistola_carrello_aperto', o: { variante: 'tattica' } };

  // =====================================================================================================================
  // 18) pistole di lega a doppia azione con carrello alto dal muso tondo e leva di abbattimento sul fusto
  //     (id 10 standard con slitta, id 16 compatta)
  // =====================================================================================================================
  FAM2.pistola_lega_doppia_azione = function (spec, o) {
    o = o || {}; const c = o.variante === 'compatta';
    const L = c ? 174 : 189, top = c ? 16.6 : 17, bot = -14, hw = c ? 12.2 : 12.4, mN = K.mat('nero'), mNd = K.mat('nero', null, { r: .4 }), fx = c ? 166 : 180;
    const k = { top: bot, fx, dc: -29.6, ot: -27.4, op: [68, 102, -50], J: [59, -54], B: c ? [42, -114] : [40, -122], R: c ? [-11, -101] : [-13, -108], x0: -6,
      back: c ? [[-13, -80, 20, 1], [-10.6, -60, 30, 1], [-7, -40, 14, 1]] : [[-15.4, -86, 20, 1], [-11.6, -62, 30, 1], [-7, -40, 14, 1]], web: [-10, -26],
      tang: [[-14.6, -21.6, 3, 1], [-14, -17.6, 2, .9], [-5, -16, 2, .8]], front: [[fx + 2.4, -18, 3, .6], [fx, -29, 3, .6]] };
    const C = psClassic(k), B = k.B, R = k.R;
    const pz = c ? [[59.9, -30.6, 3], [38.6, -108, 4], [-7, -96, 4], [-9, -80, 20], [-6.6, -60, 30], [-3, -40, 10], [-3, -30.6, 3]] : [[59.9, -30.6, 3], [36.7, -116, 4], [-9, -103, 4], [-11.4, -86, 20], [-7.6, -62, 30], [-3, -40, 10], [-3, -30.6, 3]];
    return psSteelGun(spec, {
      nome: 'pistola_lega_doppia_azione', L, top,
      slide: { out: [[0, bot, .8, .35], [L - 6, bot, 2, .35], [L - .5, bot + 6.5, 2, .6], [L, top, c ? 9 : 8, 1], [0, top, 2.4, 1]], port: c ? [60, 100, 2] : [62, 104, 2], hw, b: 5, bs: 4, mat: 'nero', rough: .36,
        paint(p) {
          p.grooves('LR', 4, 36, bot + 1.6, top - 4.4, 2.3, { wr: .52 });
          p.text('L', spec.produttore.toUpperCase(), c ? 122 : 130, 4.4, 3.6, { spacing: 4 });
          p.text('R', spec.nome.split(' ')[0].toUpperCase() + (c ? '  C' : ''), c ? 130 : 140, 5, 3.6, { spacing: 5 });
          p.text('R', psCal(spec.calibro) + '   ' + psSer(spec, 'U'), c ? 136 : 146, -5.6, 2.1);
        } },
      rear: [c ? 'trizio' : '3p', 8, 17, { w: 5.6, h: 5.2, mat: mN }], front: [c ? 'trizio' : 'punto', L - 16, L - 10, { h: 5.2, mat: mN }],
      muz: 7.8, guide: [-9.6, 2.8], barrel: { x0: 56, x1: L + .4, r: 7.2, ri: 4.5, hood: [(c ? 60 : 62) + .4, (c ? 100 : 104) - .4, top - .6, 8.2], mat: psSteel('nera') },
      frame: { mat: 'anod', rough: .45, hw: hw - .6, b: 2, hwG: 5.8, bG: 2.2, hwP: 10.8, bP: 3, out: C.out, grip: C.grip,
        guard: psGuard({ op: k.op, yt: -29.2, fr: 7, bt: 6.6, st: 'squadra', xr: 46, ru: 8 }),
        paint(p) {
          for (const [x, y] of [[4, -22], [86, -21], [76, -26]]) p.pin('LR', x, y, 1.3, { h: .3, a: 1.05 });
          p.text('R', psSer(spec, 'U'), 92, -21.6, 1.8);
          p.line('LR', [[fx - 46, -29.8], [fx - 1, -29.8]], .35, { h: -.6, a: .7 });
        } },
      rail: c ? [fx - 30, fx - 3, -29.4, 4.4, 10.4, [fx - 15], 4.6] : [fx - 46, fx - 3, -29.4, 4.6, 10.6, [fx - 33, fx - 20], 4.4],
      panels: { out: pz, z0: 10.6, t: 3.4, b: 2.6, mat: 'polimero', rough: .6,
        paint(p) {
          psGripTex(p, pz.map(q => [q[0] + (q[0] > 20 ? -3 : 3), q[1] + (q[1] > -60 ? -3 : 3)]), { s: .3 });
          p.text('LR', psIni(spec.produttore), 26, -44, 3.6, { a: .75, h: -.5, weight: '900' });
        }, screws: [[46, -42, 2.3], [B[0] - 14, B[1] + 16, 2.3]] },
      hammer: ['tondo', -8, -16.2, { w: 3.2, s: 1.05, mat: mN }],
      trigger: ['curvo', 78, -27, { mat: mN }],
      levers: [psL([[44, -24.6, 1.5], [58, -24.2, 2], [62, -26.6, 2], [52, -30.2, 2], [42, -28.8, 2]], hw - .6, mNd),
        psL([[48, -17.4, 1.5], [74, -17.4, 2], [84, -18, 2], [85, -21.4, 2], [78, -23, 2], [50, -22, 2]], hw - .6, mNd),
        psL([[90, -17.6, 1], [102, -17.6, 2], [103, -21.6, 2], [91, -22.6, 1.5]], hw - .6, mNd)],
      extra(A) { psButton(A, 62, -40, -10.6, 4, -1, mNd, 2.4); },
      mag: psMagS(R, B, { d: 4.6, fw: 1.6, w: 12 }),
      gc: [18, c ? -70 : -74], corsa: c ? 34 : 36
    });
  };
  MAP2[10] = { f: 'pistola_lega_doppia_azione', o: { variante: 'standard' } };
  MAP2[16] = { f: 'pistola_lega_doppia_azione', o: { variante: 'compatta' } };

  // =====================================================================================================================
  // 19) pistola di lega compatta a canna rotante: carrello chiuso dal muso tondeggiante, leve sul carrello (id 13)
  // =====================================================================================================================
  FAM2.pistola_lega_canna_rotante = function (spec) {
    const L = 174, top = 15.6, bot = -14, hw = 13, mN = K.mat('nero'), mNd = K.mat('nero', null, { r: .4 });
    const k = { top: bot, fx: 158, dc: -28, ot: -26.2, op: [64, 95, -48], J: [56, -51], B: [40, -120], R: [-11, -106], x0: -6,
      back: [[-13, -84, 20, 1], [-9.6, -62, 30, 1], [-5.6, -40, 12, 1]], web: [-8.6, -25], tang: [[-12.6, -20.6, 3, 1], [-12, -17, 2, .9], [-4, -16, 1.5, .8]],
      front: [[161, -18, 3, .6], [158, -27.4, 3, .6]] };
    const C = psClassic(k), pz = [[55.4, -29.4, 3], [36.4, -114, 4], [-7, -101, 4], [-9.4, -84, 20], [-5.6, -62, 30], [-1.6, -40, 10], [-1.6, -29.4, 3]];
    const levR = [[1, 2.4, 1], [21, 3.2, 1.5], [24, 7.6, 2], [6, 9.6, 2], [.6, 6.4, 1]];
    return psSteelGun(spec, {
      nome: 'pistola_lega_canna_rotante', L, top,
      slide: { out: [[0, bot, .8, .35], [L - 12, bot, 6, .35], [L - 1, bot + 7, 4, .6], [L, top - 6, 6, 1], [L - 6, top, 6, 1], [0, top, 2.4, 1]], port: [58, 92, 2.4], hw, b: 5.4, bs: 4, mat: 'nero', rough: .38,
        paint(p) {
          p.grooves('LR', 26, 48, bot + 1.6, top - 4.6, 2.6, { wr: .52 });
          p.text('L', spec.produttore.toUpperCase() + ' — ' + spec.paese.toUpperCase(), 116, 3, 2.6, { spacing: 2 });
          p.text('L', spec.nome.toUpperCase() + '  ' + psCal(spec.calibro), 116, -2.6, 2.4, { spacing: 3 });
          p.text('R', psSer(spec, ''), 124, -6.4, 2.1);
        } },
      rear: ['3p', 6, 14, { w: 5, h: 4.6, mat: mN }], front: ['punto', L - 16, L - 10, { h: 4.8, mat: mN }],
      muz: 7.8, guide: [-9.6, 2.6], barrel: { x0: 50, x1: L + .4, r: 7.4, ri: 4.5, hood: [58.4, 91.6, top - .6, 7.4], mat: psSteel('nera') },
      slideX(A) { for (const s of [-1, 1]) A.add(K.slab(levR, s < 0 ? -hw - 2 : hw - .6, s < 0 ? -hw + .6 : hw + 2, { b: .6 }), mNd, 'carrello'); },
      frame: { mat: 'anod', rough: .45, hw: hw - .8, b: 2, hwG: 5.8, bG: 2.2, hwP: 10.6, bP: 2.8, out: C.out, grip: C.grip,
        guard: psGuard({ op: k.op, yt: -27.6, fr: 6.8, bt: 6, st: 'uncino', xr: 42, ru: 7 }),
        paint(p) { for (const [x, y] of [[4, -21], [92, -20.6], [82, -24]]) p.pin('LR', x, y, 1.3, { h: .3, a: 1.05 }); p.text('R', psSer(spec, ''), 86, -20, 1.8); } },
      panels: { out: pz, z0: 10.4, t: 3.4, b: 2.6, mat: 'polimero', rough: .6,
        paint(p) { psGripTex(p, [[52.4, -32.4], [35, -110.6], [-4.6, -98], [-6.6, -84], [-2.6, -62], [1.4, -40], [1.4, -32.4]], { s: .28 }); psMedal(p, 22, -46, 4.6, psIni(spec.produttore)); }, screws: [[22, -88, 2.3]] },
      hammer: ['tondo', -7, -15.6, { w: 3.2, mat: mN }],
      trigger: ['curvo', 73, -25.2, { mat: mN }],
      levers: [psL([[60, -16.6, 1.5], [82, -16.6, 2], [92, -17.4, 2], [93, -21, 2], [84, -23, 2], [64, -22, 2]], hw - .8, mNd),
        psL([[98, -17.6, 1], [108, -17.6, 2], [110, -21.2, 2], [100, -22.4, 1.5]], hw - .8, mNd)],
      extra(A) { psButton(A, 58, -40, -10.6, 4, -1, mNd, 2.4); },
      mag: psMagS(k.R, k.B, { d: 4.6, fw: 1.6, w: 11.6 }),
      gc: [18, -72], corsa: 34, tilt: 0, ciclo: { canna: { dx: -.004, rx: .5 } }
    });
  };
  MAP2[13] = { f: 'pistola_lega_canna_rotante', o: {} };
})();
