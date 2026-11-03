// Componenti comuni delle armi (kit v2): slitte, ottiche, mire reflex, bipiedi, dispositivi di bocca, caricatori,
// bossoli, viti, maglie della cinghia. Tutte le misure in mm, stesse convenzioni del kit (X avanti, Y su, Z destra).
// Ogni funzione restituisce una lista di [geometria, materiale] da aggiungere con WC.put(A, lista, parte).
window.WC = (function () {
  const K = WK2, T = THREE, PI = Math.PI;
  const put = (A, list, part) => { for (const [g, m] of list) A.add(g, m, part); return A; };
  // geometria di three.js qualunque resa compatibile (normali con piega, attributo di usura)
  function wrap(geo, ang) { const g = geo.index ? geo.toNonIndexed() : geo; g.deleteAttribute('normal'); return K.crease(g, ang || 40, {}); }

  // ---------------- slitta tipo Picatinny lungo X fra x0 e x1, base a quota y; dir: 'su' (default), 'giu', 'dx', 'sx'
  // misure standard: larghezza 21,2, passo delle scanalature 10,0, scanalatura 5,2, altezza 9,4
  function rail(x0, x1, y, o) {
    o = o || {}; const m = o.mat || K.mat('anod'), out = [];
    const prof = [[-8, 0, 0], [8, 0, 0], [8, 1.6, .3], [10.6, 3.6, .4], [10.6, 5, .4], [7.8, 6.6, .3], [-7.8, 6.6, .3], [-10.6, 5, .4], [-10.6, 3.6, .4], [-8, 1.6, .3]];
    const geos = [K.slabX(prof, x0, x1, { b: .5 })];
    const n = Math.floor((x1 - x0 - 2) / 10.0);
    const off = x0 + (x1 - x0 - n * 10.0) / 2;
    for (let i = 0; i < n; i++) { const a = off + i * 10 + 2.6, b = a + 4.8; geos.push(K.slabX([[-7.8, 6.4, 0], [7.8, 6.4, 0], [7.8, 9.4, .5], [-7.8, 9.4, .5]], a, b, { b: .45 })); }
    let g = K.mergeG(geos);
    const rot = { su: 0, giu: PI, dx: PI / 2, sx: -PI / 2 }[o.dir || 'su'];
    // rotazione attorno all'asse X passante per la canna (y=0), poi spostamento alla quota
    g.translate(0, y, 0); if (rot) { const mtx = new T.Matrix4().makeRotationX(rot); g.applyMatrix4(mtx); }
    out.push([g, m]); return out;
  }

  // ---------------- cannocchiale di mira lungo X: tubo, campana dell'obiettivo, oculare, torrette, anelli e basi
  // o = {x0 (oculare), x1 (obiettivo), y (asse), rt (raggio tubo: 15 = 30 mm), ro (obiettivo), re (oculare), rings: [x,...], yb (quota della base)}
  function scope(o) {
    const out = [], ma = K.mat('anod', null, { r: .55 }), ml = K.mat('lente'), x0 = o.x0, x1 = o.x1, y = o.y, rt = o.rt || 15, ro = o.ro || 25, re = o.re || 21;
    const L = x1 - x0, xe = x0 + Math.min(85, L * .26), xo = x1 - Math.min(95, L * .3);
    out.push([K.latheX([[x0, re - 2.5], [x0, re], [x0 + 6, re + .4], [x0 + 26, re + .4], [x0 + 30, re - 1], [xe - 18, rt + 3.2], [xe, rt + .2], [xe + 2, rt], [xo - 4, rt], [xo, rt + .5], [x1 - 22, ro], [x1 - 4, ro + .6], [x1, ro + .2], [x1, ro - 3]], { seg: 32, cy: y }), ma]);
    out.push([K.discX(x0 + .6, y, 0, re - 2.4, -1, 28), ml]); out.push([K.discX(x1 - 1.5, y, 0, ro - 2.8, 1, 32), ml]);
    // sella delle torrette
    const xm = (xe + xo) / 2, mk = K.mat('anod', null, { tile: 'knurl', rep: [8, 2], r: .6 });
    out.push([K.latheX([[xm - 24, rt], [xm - 22, rt + 3.5], [xm + 22, rt + 3.5], [xm + 24, rt]], { seg: 32, cy: y }), ma]);
    const tur = (rx, rz) => { const g = K.latheX([[0, 0], [0, 10], [1, 11], [13, 11], [14, 9.6], [14.6, 0]], { seg: 28 }); g.rotateZ(PI / 2); return g; };
    { const g = tur(); g.translate(xm, y + rt + 2, 0); out.push([g, mk]); }
    { const g = tur(); g.rotateX(PI / 2); g.translate(xm, y, rt + 2); out.push([g, mk]); }
    if (o.parallax !== false) { const g = K.latheX([[0, 0], [0, 7], [9, 7], [9.6, 0]], { seg: 22 }); g.rotateZ(PI / 2); g.rotateX(-PI / 2); g.translate(xm, y, -rt - 2); out.push([g, ma]); }
    // anelli con basi fino alla slitta
    for (const xr of (o.rings || [xe + 18, xo - 18])) {
      out.push([K.latheX([[xr - 7, rt - .2], [xr - 7, rt + 2.6], [xr - 6, rt + 3.4], [xr + 6, rt + 3.4], [xr + 7, rt + 2.6], [xr + 7, rt - .2]], { seg: 32, cy: y }), ma]);
      const yb = o.yb === undefined ? y - rt - 10 : o.yb;
      out.push([K.slab([[xr - 7, yb, .5], [xr + 7, yb, .5], [xr + 7, y - rt + 1, 0], [xr - 7, y - rt + 1, 0]], -11, 11, { b: .8 }), ma]);
      out.push([K.slab([[xr - 4, y - 2, .5], [xr + 4, y - 2, .5], [xr + 4, y + 2, .5], [xr - 4, y + 2, .5]], rt + 1, rt + 6.5, { b: .6 }), ma]);
    }
    return out;
  }

  // ---------------- mirino reflex (punto rosso) su slitta: corpo, finestra, punto
  function reflex(x, y, o) {
    o = o || {}; const out = [], ma = K.mat('anod', null, { r: .5 });
    const glass = new T.MeshStandardMaterial({ color: new T.Color('#7fb4c8').convertSRGBToLinear(), metalness: .1, roughness: .05, transparent: true, opacity: .28, envMapIntensity: 2 });
    out.push([K.slab([[x, y, 1], [x + 52, y, 1], [x + 52, y + 9, 1], [x, y + 9, 1]], -11, 11, { b: 1 }), ma]);
    out.push([K.slabX([[-14, y + 7, 2], [14, y + 7, 2], [14, y + 34, 6], [-14, y + 34, 6]], x + 8, x + 44, { b: 1.2, holes: [[[-10.5, y + 11, 3], [10.5, y + 11, 3], [10.5, y + 31, 3], [-10.5, y + 31, 3]]] }), ma]);
    out.push([K.slabX([[-10.6, y + 10.9, 0], [10.6, y + 10.9, 0], [10.6, y + 31.1, 0], [-10.6, y + 31.1, 0]], x + 39.8, x + 40.4, { b: 0 }), glass]);
    out.push([K.discX(x + 40.5, y + 21, 0, .7, -1, 10), K.mat('rosso')]);
    return out;
  }

  // ---------------- bipiede: attacco sotto la canna e due gambe (aperte o chiuse in avanti)
  function bipod(x, y, o) {
    o = o || {}; const out = [], m = o.mat || K.mat('nero', null, { r: .5 }), L = o.len || 220, open = o.open !== false;
    out.push([K.latheX([[x - 12, 0], [x - 12, 11], [x - 11, 12], [x + 11, 12], [x + 12, 11], [x + 12, 0]], { seg: 24, cy: y }), m]);
    out.push([K.slab([[x - 10, y - 20, 2], [x + 10, y - 20, 2], [x + 10, y - 8, 0], [x - 10, y - 8, 0]], -14, 14, { b: 1 }), m]);
    for (const s of [-1, 1]) {
      const g = K.mergeG([K.rod(0, L * .55, 4.6, { seg: 14 }), K.rod(L * .5, L, 3.4, { seg: 12 }), K.latheX([[L, 0], [L, 7], [L + 3, 7.5], [L + 9, 5], [L + 10, 0]], { seg: 14 })]);
      if (open) { g.rotateZ(-PI / 2 + .12); g.rotateX(-s * .32); } else { g.rotateZ(.06); g.translate(0, 0, s * 9); }
      g.translate(x, y - 14, s * (open ? 10 : 0)); out.push([g, m]);
    }
    return out;
  }

  // ---------------- dispositivi di bocca lungo X a partire da x0, raggio r
  function muzzle(kind, x0, r, o) {
    o = o || {}; const out = [], m = o.mat || K.mat('parker', null, { r: .55 }), dk = K.mat('nero_lucido', null, { c: '#060606', r: .7 });
    if (kind === 'gabbia') { // a gabbia con feritoie (chiuso sotto)
      const L = o.len || 45; out.push([K.latheX([[x0, 0], [x0, r - .6], [x0 + 1, r], [x0 + 14, r], [x0 + 14, r - 1.2]], { seg: 28 }), m]);
      out.push([K.tube(x0 + 13, x0 + L, r - 1.2, r - 4, { seg: 28 }), dk]);
      for (let i = 0; i < 5; i++) { const a = PI / 2 + (i - 2) * (PI * 2 / 6); const g = K.box(x0 + 14, -1.5, -1.6, x0 + L - 3, 1.5, 1.6, .4); g.translate(0, r - 1.5, 0); g.applyMatrix4(new T.Matrix4().makeRotationX(a - PI / 2)); out.push([g, m]); }
      { const g = K.box(x0 + 14, -2.8, -4.2, x0 + L - 3, 2.8, 4.2, .4); g.translate(0, -(r - 2.8), 0); out.push([g, m]); }
      out.push([K.latheX([[x0 + L - 3.5, r - 1.5], [x0 + L - 3.5, r], [x0 + L, r], [x0 + L, r - 2.6]], { seg: 28 }), m]);
    } else if (kind === 'freno') { // freno a camere (finestre laterali)
      const L = o.len || 70, ch = o.ch || 3; out.push([K.latheX([[x0, 0], [x0, r], [x0 + 12, r]], { seg: 28 }), m]);
      const seg = (L - 12) / ch;
      for (let i = 0; i < ch; i++) { const a = x0 + 12 + i * seg; out.push([K.slab([[a, -r, 1], [a + seg * .42, -r, 1], [a + seg * .42, r, 1], [a, r, 1]], -r * .95, r * .95, { b: 1 }), m]); out.push([K.box(a + seg * .4, -r * .9, -r * .55, a + seg + .1, r * .9, r * .55, .5), m]); }
      out.push([K.slab([[x0 + L - 4, -r, 1], [x0 + L, -r, 1], [x0 + L, r, 1], [x0 + L - 4, r, 1]], -r * .95, r * .95, { b: 1 }), m]);
      out.push([K.discX(x0 + L + .05, 0, 0, r * .32, 1, 16), dk]);
    } else if (kind === 'obliquo') { // compensatore obliquo
      const L = o.len || 30; out.push([K.latheX([[x0, 0], [x0, r - .5], [x0 + 1, r], [x0 + L - 3, r], [x0 + L, r - 1.2], [x0 + L, 0]], { seg: 28 }), m]); out.push([K.discX(x0 + L + .05, 0, 0, r * .42, 1, 16), dk]);
    } else if (kind === 'silenziatore') {
      const L = o.len || 160; out.push([K.latheX([[x0, 0], [x0, r * .7], [x0 + 6, r], [x0 + L - 6, r], [x0 + L, r * .75], [x0 + L, 0]], { seg: 32 }), K.mat('anod', null, { r: .65 })]); out.push([K.discX(x0 + L + .05, 0, 0, r * .25, 1, 16), dk]);
    } else if (kind === 'conico') { // spegnifiamma conico a lamelle
      const L = o.len || 50; out.push([K.latheX([[x0, 0], [x0, r * .85], [x0 + L, r * 1.18], [x0 + L, r * .95], [x0 + L - 2, r * .9]], { seg: 28 }), m]); out.push([K.discX(x0 + L - 3, 0, 0, r * .9, 1, 18), dk]);
    } else { const L = o.len || 20; out.push([K.latheX([[x0, 0], [x0, r], [x0 + L, r], [x0 + L, 0]], { seg: 24 }), m]); }
    return out;
  }

  // ---------------- caricatore a scatola lungo una linea (dritta o curva): top = [x,y] centro in alto (dentro l'arma), lunghezza, profondità, larghezza
  // o = {len, dTop, dBot, w (mezza larghezza), ang (inclinazione in avanti, rad), curva (raggio, 0 = dritto), mat, piede (sporgenza del fondello)}
  function mag(top, o) {
    const out = [], m = o.mat || K.mat('nero', null, { r: .5 }), n = 10, st = [], a0 = -PI / 2 + (o.ang || 0), len = o.len;
    let p = top.slice(), dir = a0; const k = o.curva ? len / o.curva / n : 0;
    for (let i = 0; i <= n; i++) {
      const t = i / n; st.push({ p: p.slice(), f: (o.dTop + (o.dBot - o.dTop) * t) / 2, r: (o.dTop + (o.dBot - o.dTop) * t) / 2, w: o.w, nf: o.nf || 8, nr: o.nr || 8 });
      if (i < n) { p = [p[0] + Math.cos(dir) * len / n, p[1] + Math.sin(dir) * len / n]; dir += k; }
    }
    out.push([K.loftS(st, { K: 28, sub: 2 }), m]);
    const pe = st[n].p, ae = dir - k, pf = o.piede || 2.5, d = o.dBot / 2 + pf;
    out.push([K.xf(K.slab([[-d, -5, 2], [d, -5, 2], [d, 1, 0], [-d, 1, 0]], -o.w - pf * .6, o.w + pf * .6, { b: 1.2 }), { r: [0, 0, ae + PI / 2], t: pe }), o.matPiede || m]);
    return out;
  }

  // ---------------- bossolo per l'espulsione (m, non mm): tipo 'pistola' | 'fucile' | 'fucile_lungo' | 'cal12' | 'pesante'
  const SHELLS = {};
  function shell(kind) {
    if (SHELLS[kind]) return SHELLS[kind];
    const br = K.mat('ottone'), P = {
      pistola: [[0, 0], [0, 4.7], [.8, 4.9], [1.3, 4.5], [2.2, 4.5], [2.6, 4.9], [19, 4.8], [19, 4.4], [18.6, 0]],
      fucile: [[0, 0], [0, 4.6], [.8, 4.8], [1.3, 4.2], [2.1, 4.2], [2.6, 4.8], [36, 4.5], [39.5, 3.1], [45, 3.1], [45, 2.8]],
      fucile_lungo: [[0, 0], [0, 5.9], [1, 6.1], [1.6, 5.4], [2.6, 5.4], [3.1, 6], [43, 5.7], [46, 4.3], [51, 4.3], [51, 3.9]],
      pesante: [[0, 0], [0, 10], [2, 10.4], [3, 9.4], [5, 9.4], [6, 10.2], [80, 9.7], [88, 7], [99, 7], [99, 6.5]],
      cal12: [[0, 0], [0, 11.2], [1.3, 11.4], [1.6, 10.6], [12, 10.6], [12.4, 10.2], [12.4, 0]]
    }[kind] || [[0, 0], [0, 4.7], [19, 4.8], [19, 0]];
    let g = K.latheX(P, { seg: 14 });
    const list = [[g, br]];
    if (kind === 'cal12') list.push([K.latheX([[12.3, 10.25], [12.3, 10.3], [65, 10.3], [65, 0]], { seg: 14 }), K.mat('rosso', null, { c: '#a8141a', r: .45 })]);
    const geos = list.map(([gg, mm]) => { const c = gg.clone(); c.scale(K.MM, K.MM, K.MM); return [c, mm]; });
    return SHELLS[kind] = geos;
  }

  // ---------------- vite (testa con intaglio) rivolta verso +Z (lato destro) o -Z
  function screw(x, y, z, r, side, m) {
    const g = K.latheX([[0, 0], [0, r], [.6, r * .95], [1.4, r * .6], [1.5, 0]], { seg: 16 });
    g.rotateY(side < 0 ? PI / 2 : -PI / 2); g.translate(x, y, z); const out = [[g, m || K.mat('brunito')]];
    const s = K.box(-r * .9, -.35, -.5, r * .9, .35, .5, 0); s.translate(x, y, z + (side < 0 ? -1.3 : 1.3)); out.push([s, K.mat('nero_lucido', null, { c: '#080808' })]);
    return out;
  }
  // ---------------- maglia per la cinghia (anello)
  function swivel(x, y, z, o) { o = o || {}; const g = wrap(new T.TorusGeometry(o.r || 9, o.t || 1.6, 8, 20)); if (o.rot) g.applyMatrix4(new T.Matrix4().makeRotationY(o.rot)); g.translate(x, y, z); return [[g, o.mat || K.mat('brunito')]]; }

  return { put, wrap, rail, scope, reflex, bipod, muzzle, mag, shell, screw, swivel };
})();
