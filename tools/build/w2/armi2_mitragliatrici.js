// Mitragliatrici leggere, medie e pesanti (gruppo "mitragliatrici", kit v2): versioni di fantasia di armi reali, con nastro
// di cartucce in ottone, coperchio di alimentazione, maniglia di trasporto, canna sostituibile, bipiede o treppiede.
// Misure in mm: x = 0 retro della scatola di culatta, y = 0 asse della canna, z verso il lato destro del tiratore.
// Parti mobili: otturatore (o manetta), grilletto, coperchio (perno sulla cerniera anteriore: rz negativo = aperto),
// nastro (fermo rispetto all'arma), caricatore (scatola portanastro o tamburo), bipiede (perno sull'attacco: rz negativo =
// gambe ripiegate all'indietro, vedi r.info.piega). Il treppiede delle armi pesanti è nella parte "treppiede" (fissa), così il
// gioco può nasconderlo quando l'arma è portata a mano.
window.FAM2 = window.FAM2 || {}; window.MAP2 = window.MAP2 || {};
(function () {
  const PI = Math.PI;

  // ================================================================ attrezzi comuni del gruppo
  // ---- geometria libera: vertici [x, y, z, u, v]; ogni triangolo è girato in modo che la normale stia dalla parte di "ref"
  function tri(P, U, a, b, c, ref) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const d = (uy * vz - uz * vy) * ref[0] + (uz * vx - ux * vz) * ref[1] + (ux * vy - uy * vx) * ref[2];
    for (const p of (d >= 0 ? [a, b, c] : [a, c, b])) { P.push(p[0], p[1], p[2]); U.push(p[3] || 0, p[4] || 0); }
  }
  function quad(P, U, a, b, c, d, ref) { tri(P, U, a, b, c, ref); tri(P, U, a, c, d, ref); }
  function geo(P, U, ang, edge) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
    return WK2.crease(g, ang || 40, { edge: !!edge });
  }
  // orienta una geometria costruita lungo +X nella direzione d e la porta nel punto p
  function lungo(g, p, d) {
    const v = new THREE.Vector3(d[0], d[1], d[2]).normalize(), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), v);
    g.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(q)); g.translate(p[0], p[1], p[2]); return g;
  }
  // asta cilindrica fra due punti qualunque
  function asta(p0, p1, r, seg) { const d = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]]; return lungo(WK2.rod(0, Math.hypot(d[0], d[1], d[2]), r, { seg: seg || 12 }), p0, d); }
  // numero di matricola inventato
  function serie(spec) { return 'N° ' + (4127 + (spec.id || 0) * 37) + (spec.id % 2 ? ' A' : ' K'); }

  // ---- lamiera cilindrica forata (camicie della canna, supporti, spegnifiamma, freni) attorno a un asse parallelo a X.
  // o = {x0, x1, r (raggio esterno), t (spessore), nx, na (celle lungo x e attorno), a0, a1 (arco: 0 = sopra, PI/2 = destra),
  //      foro(i, j, x, a) -> null | {w, h (mezze misure del foro lungo x e lungo l'arco), n (2 = ellisse, 6 = asola), u, v (spostamento)},
  //      m (punti in più su ogni lato della cella), cy, cz (asse)}. Fori veri con le pareti: si vede la canna attraverso.
  function forata(o) {
    const P = [], U = [], r = o.r, ri = r - (o.t || 1.2), nx = o.nx, na = o.na, m = o.m === undefined ? 2 : o.m;
    const a0 = o.a0 || 0, a1 = o.a1 === undefined ? a0 + 2 * PI : o.a1, full = Math.abs(a1 - a0 - 2 * PI) < 1e-6;
    const dx = (o.x1 - o.x0) / nx, da = (a1 - a0) / na, cy = o.cy || 0, cz = o.cz || 0, HX = dx / 2, HV = da * r / 2;
    const B = [], side = (u0, v0, u1, v1) => { for (let k = 0; k <= m; k++) { const t = k / (m + 1); B.push([u0 + (u1 - u0) * t, v0 + (v1 - v0) * t]); } };
    side(HX, -HV, HX, HV); side(HX, HV, -HX, HV); side(-HX, HV, -HX, -HV); side(-HX, -HV, HX, -HV);
    const nb = B.length, s1 = m + 1, neg = v => [-v[0], -v[1], -v[2]];
    for (let i = 0; i < nx; i++) for (let j = 0; j < na; j++) {
      const xc = o.x0 + (i + .5) * dx, ac = a0 + (j + .5) * da, h = o.foro ? o.foro(i, j, xc, ac) : null;
      const V = (q, rr) => { const a = ac + q[1] / r; return [xc + q[0], cy + Math.cos(a) * rr, cz + Math.sin(a) * rr, (xc + q[0]) / 40, a * r / 40]; };
      const RD = q => { const a = ac + q[1] / r; return [0, Math.cos(a), Math.sin(a)]; }, TG = q => { const a = ac + q[1] / r; return [0, -Math.sin(a), Math.cos(a)]; };
      if (h) {
        const n = h.n || 2, cu = h.u || 0, cv = h.v || 0;
        const H = B.map(q => { const f = Math.atan2(q[1], q[0]), c = Math.abs(Math.cos(f)) / h.w, s = Math.abs(Math.sin(f)) / h.h, rho = Math.pow(Math.pow(c, n) + Math.pow(s, n), -1 / n); return [cu + Math.cos(f) * rho, cv + Math.sin(f) * rho]; });
        for (let k = 0; k < nb; k++) {
          const k2 = (k + 1) % nb, rd = RD(H[k]);
          quad(P, U, V(B[k], r), V(B[k2], r), V(H[k2], r), V(H[k], r), rd);
          quad(P, U, V(B[k], ri), V(B[k2], ri), V(H[k2], ri), V(H[k], ri), neg(rd));
          const mu = (H[k][0] + H[k2][0]) / 2, mv = (H[k][1] + H[k2][1]) / 2, tg = TG([mu, mv]);
          quad(P, U, V(H[k], r), V(H[k2], r), V(H[k2], ri), V(H[k], ri), [cu - mu, (cv - mv) * tg[1], (cv - mv) * tg[2]]);
        }
      } else {
        const c0 = [0, 0], rd = RD(c0);
        for (let k = 0; k < nb; k++) { const k2 = (k + 1) % nb; tri(P, U, V(c0, r), V(B[k], r), V(B[k2], r), rd); tri(P, U, V(c0, ri), V(B[k], ri), V(B[k2], ri), neg(rd)); }
      }
      const wall = (k0, k1, ref) => { for (let k = k0; k < k1; k++) { const k2 = (k + 1) % nb; quad(P, U, V(B[k], r), V(B[k2], r), V(B[k2], ri), V(B[k], ri), ref); } };
      if (i === nx - 1) wall(0, s1, [1, 0, 0]);
      if (i === 0) wall(2 * s1, 3 * s1, [-1, 0, 0]);
      if (!full && j === na - 1) wall(s1, 2 * s1, TG([0, HV]));
      if (!full && j === 0) wall(3 * s1, 4 * s1, neg(TG([0, -HV])));
    }
    return geo(P, U, 40, true);
  }

  // ---- tornito con scanalature longitudinali (canne scanalate): prof = [[x, raggio, profondità delle scanalature]], ns = numero
  function scanalata(prof, ns, o) {
    o = o || {}; const N = o.seg || ns * 6, P = [], U = [], cy = o.cy || 0, cz = o.cz || 0;
    const V = (i, j) => { const a = 2 * PI * j / N, g = Math.pow(Math.max(0, -Math.cos(ns * a)), .6), rr = prof[i][1] - (prof[i][2] || 0) * g; return [prof[i][0], cy + Math.cos(a) * rr, cz + Math.sin(a) * rr, prof[i][0] / 40, j / N * 4]; };
    for (let i = 0; i < prof.length - 1; i++) {
      const dx = prof[i + 1][0] - prof[i][0], dr = prof[i + 1][1] - prof[i][1];
      for (let j = 0; j < N; j++) { const a = 2 * PI * (j + .5) / N; quad(P, U, V(i, j), V(i + 1, j), V(i + 1, j + 1), V(i, j + 1), [-dr, dx * Math.cos(a), dx * Math.sin(a)]); }
    }
    return geo(P, U, o.ang || 32, false);
  }

  // ---- cartucce (mm): l bossolo, rr fondello, rb corpo, rs spalla, xs inizio della spalla, rn colletto, lt lunghezza totale,
  // rp palla, orlo (fondello sporgente), passo del nastro
  const CART = {
    c556: { l: 44.7, rr: 4.8, rb: 4.75, rs: 4.5, xs: 36.4, rn: 3.15, lt: 57.4, rp: 2.85, passo: 11.6 },
    c762c: { l: 38.7, rr: 5.6, rb: 5.6, rs: 5.3, xs: 30.5, rn: 4.25, lt: 56, rp: 3.95, passo: 13.6 },
    c762: { l: 51, rr: 5.95, rb: 5.95, rs: 5.7, xs: 43, rn: 4.35, lt: 71, rp: 3.9, passo: 14.2 },
    c762r: { l: 53.7, rr: 7.2, rb: 6.2, rs: 5.8, xs: 44.5, rn: 4.2, lt: 77, rp: 3.95, orlo: 1, passo: 15.8 },
    c762l: { l: 63.3, rr: 6, rb: 5.95, rs: 5.5, xs: 52.6, rn: 4.3, lt: 84.8, rp: 3.9, passo: 14.6 },
    c127: { l: 99, rr: 10.2, rb: 10.2, rs: 9.7, xs: 80, rn: 7, lt: 138, rp: 6.5, passo: 24.5 },
    c127r: { l: 108, rr: 10.9, rb: 10.9, rs: 10.4, xs: 88, rn: 7.1, lt: 147, rp: 6.5, passo: 26 }
  };
  const CG = {};
  function cartuccia(cal) {
    if (CG[cal]) return CG[cal];
    const K = WK2, c = CART[cal], seg = c.rr > 8 ? 12 : 8, rim = c.rr * (c.orlo ? .22 : .24);
    const pc = [[0, 0], [0, c.rr - .5], [.4, c.rr], [rim, c.rr]];
    if (c.orlo) pc.push([rim + .25, c.rb]); else pc.push([rim + .25, c.rr * .84], [rim + c.rr * .24, c.rr * .84], [rim + c.rr * .42, c.rb]);
    pc.push([c.xs, c.rs], [c.xs + (c.rs - c.rn) * 1.7, c.rn], [c.l, c.rn], [c.l, c.rp + .05]);
    const xb = c.l + (c.lt - c.l) * .26, L = c.lt - xb;
    const pb = [[c.l - .6, c.rp], [xb, c.rp], [xb + L * .32, c.rp * .92], [xb + L * .6, c.rp * .72], [xb + L * .84, c.rp * .42], [c.lt, c.rp * .13], [c.lt, 0]];
    const pt = [[xb + L * .66, c.rp * .69], [xb + L * .84, c.rp * .45], [c.lt + .08, c.rp * .16], [c.lt + .08, 0]];
    return CG[cal] = { c, seg, bossolo: K.latheX(pc, { seg }), palla: K.latheX(pb, { seg }), punta: K.latheX(pt, { seg }) };
  }
  // ---- nastro di cartucce lungo una linea: o = {cal, pts: [[x, y, z], ...] (centro del fondello), n (massimo), passo,
  //      anelli: [[frazione del bossolo, larghezza]] (maglie), traccianti (una ogni n, punta rossa), vuote (maglie vuote in fondo), mat, parte}
  function nastro(A, o) {
    const K = WK2, G = cartuccia(o.cal), c = G.c, part = o.parte || 'nastro', passo = o.passo || c.passo, pts = o.pts, F = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      for (let k = 0; k < 12; k++) { const t = k / 12, t2 = t * t, t3 = t2 * t; F.push([0, 1, 2].map(d => .5 * (2 * p1[d] + (p2[d] - p0[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (3 * p1[d] - p0[d] - 3 * p2[d] + p3[d]) * t3))); }
    }
    F.push(pts[pts.length - 1].slice());
    const S = [0]; for (let i = 1; i < F.length; i++) S.push(S[i - 1] + Math.hypot(F[i][0] - F[i - 1][0], F[i][1] - F[i - 1][1], F[i][2] - F[i - 1][2]));
    const at = s => { let i = 1; while (i < F.length - 1 && S[i] < s) i++; const t = Math.min(1, Math.max(0, (s - S[i - 1]) / Math.max(1e-6, S[i] - S[i - 1]))); return [0, 1, 2].map(d => F[i - 1][d] + (F[i][d] - F[i - 1][d]) * t); };
    const C = [], Lt = S[S.length - 1]; for (let s = 0; s <= Lt + .01 && C.length < (o.n || 60); s += passo) C.push(at(s));
    const mB = K.mat('ottone'), mP = K.mat('rame'), mL = o.mat || K.mat('parker', null, { r: .5 }), mT = K.mat('bianco', null, { c: '#a8301a', r: .5 });
    const an = o.anelli || [[.16, c.rr * .55], [.6, c.rr * .9]], nv = o.vuote || 0;
    const ring = an.map(([f, w]) => K.latheX([[c.l * f, c.rb + .15], [c.l * f, c.rb + .9], [c.l * f + w, c.rb + .9], [c.l * f + w, c.rb + .15]], { seg: G.seg }));
    C.forEach((p, i) => {
      if (i < C.length - nv) {
        A.add(G.bossolo.clone().translate(p[0], p[1], p[2]), mB, part);
        A.add(G.palla.clone().translate(p[0], p[1], p[2]), mP, part);
        if (o.traccianti && i % o.traccianti === 2) A.add(G.punta.clone().translate(p[0], p[1], p[2]), mT, part);
      }
      for (const g of ring) A.add(g.clone().translate(p[0], p[1], p[2]), mL, part);
      if (i < C.length - 1) { // piastrine delle maglie fra una cartuccia e la successiva
        const q = C[i + 1], dz = q[2] - p[2], dy = q[1] - p[1], L = Math.hypot(dz, dy) || 1, e = (c.rb + .6) / L, tz = -dy / L * .55, ty = dz / L * .55;
        const a = [p[2] + dz * e, p[1] + dy * e], b = [q[2] - dz * e, q[1] - dy * e], xm = (p[0] + q[0]) / 2;
        if (L > 2 * (c.rb + .6) + .3) for (const [f, w] of an) A.add(K.slabX([[a[0] - tz, a[1] - ty], [b[0] - tz, b[1] - ty], [b[0] + tz, b[1] + ty], [a[0] + tz, a[1] + ty]], xm + c.l * f, xm + c.l * f + w, { b: 0 }), mL, part);
      }
    });
    return C;
  }

  // ---- scatola portanastro: o = {x0, x1, y0, y1, z0, z1, mat, parte, nerv (nervature sui fianchi), maniglia, coperchio (altezza)}
  function scatola(A, o) {
    const K = WK2, m = o.mat, part = o.parte || 'caricatore', hc = o.coperchio || Math.min(12, (o.y1 - o.y0) * .14);
    A.add(K.box(o.x0, o.y0, o.z0, o.x1, o.y1 - hc, o.z1, 1.6, 3.5), m, part);
    A.add(K.box(o.x0 - 1.2, o.y1 - hc - 1.5, o.z0 - 1.2, o.x1 + 1.2, o.y1, o.z1 + 1.2, 1.3, 4), m, part);
    const nr = o.nerv === undefined ? 2 : o.nerv;
    for (let k = 0; k < nr; k++) {
      const x = o.x0 + (o.x1 - o.x0) * (k + 1) / (nr + 1);
      for (const s of [-1, 1]) { const z = s > 0 ? o.z1 : o.z0; A.add(K.box(x - 6, o.y0 + 12, z - 1.2 + s * .9, x + 6, o.y1 - hc - 12, z + 1.2 + s * .9, .9, 5), m, part); }
    }
    A.add(K.box(o.x0 + 5, o.y0 - 1.5, o.z0 + 5, o.x1 - 5, o.y0 + 2, o.z1 - 5, .8, 3), m, part);
    if (o.maniglia !== false) { // maniglia a filo piegato sul coperchio
      const xm = (o.x0 + o.x1) / 2, zm = (o.z0 + o.z1) / 2, hw = Math.min(38, (o.x1 - o.x0) * .3), y = o.y1, mh = K.mat('nero', null, { r: .45 });
      for (const s of [-1, 1]) A.add(asta([xm + s * hw, y - 1, zm], [xm + s * hw, y + 9, zm], 2.4, 10), mh, part);
      A.add(asta([xm - hw - 2, y + 9, zm], [xm + hw + 2, y + 9, zm], 2.6, 10), mh, part);
    }
  }

  // ---- bipiede: o = {x, ya (asse del tubo che lo porta), rc (raggio del collare), yh (quota delle cerniere), len, r (raggio delle gambe),
  //      apre (rad, verso i lati), avanti (rad), piede ('punta' | 'piatto' | 'disco'), w (mezza distanza delle cerniere), mat, collare}
  function bipiede(A, o) {
    const K = WK2, m = o.mat || K.mat('nero', null, { r: .5 }), part = 'bipiede', rc = o.rc || 10, L = o.len || 300, r = o.r || 5, w = o.w || 10, yh = o.yh;
    if (o.collare !== false) A.add(K.latheX([[o.x - 11, rc - .3], [o.x - 11, rc + 3], [o.x - 10, rc + 4.2], [o.x + 10, rc + 4.2], [o.x + 11, rc + 3], [o.x + 11, rc - .3]], { seg: 24, cy: o.ya }), m, part);
    A.add(K.slab([[o.x - 12, yh - 7, 3], [o.x + 12, yh - 7, 3], [o.x + 10, o.ya - rc + 2, 0], [o.x - 10, o.ya - rc + 2, 0]], -w - 5, w + 5, { b: 1.4 }), m, part);
    A.add(lungo(K.rod(0, 2 * w + 16, 3.4, { seg: 12 }), [o.x, yh - 2, -w - 8], [0, 0, 1]), m, part);
    const sp = o.apre === undefined ? .28 : o.apre, fw = o.avanti === undefined ? .1 : o.avanti;
    for (const s of [-1, 1]) {
      const d = [Math.sin(fw), -Math.cos(fw) * Math.cos(sp), s * Math.cos(fw) * Math.sin(sp)];
      const g = [K.latheX([[-5, 0], [-5, r + 1.6], [9, r + 1.6], [12, r], [12, 0]], { seg: 12 }), K.rod(10, L * .6, r, { seg: 12 }), K.latheX([[L * .56, r * 1.12], [L * .62, r * 1.12], [L * .63, r * .74]], { seg: 12 }), K.rod(L * .6, L - 4, r * .74, { seg: 10 })];
      if (o.piede === 'punta') g.push(K.latheX([[L - 6, r * .9], [L, r * 1.05], [L + 16, 1.2], [L + 17, 0]], { seg: 10 }));
      else if (o.piede === 'piatto') g.push(K.box(L - 5, -r * 2.4, -r * 1.7, L + 5, r * 2.4, r * 1.7, 1.2, 2));
      else g.push(K.latheX([[L - 8, r * .8], [L - 2, r * .8], [L - 1, r * 2.2], [L + 4, r * 2.4], [L + 6, r * 1.6], [L + 6, 0]], { seg: 12 }));
      A.add(lungo(K.mergeG(g), [o.x, yh - 2, s * w], d), m, part);
    }
    A.pivot(part, [o.x, yh, 0]);
  }

  // ---- maniglia di trasporto sulla canna: collare, braccio e impugnatura parallela alla canna
  // o = {x (collare), xa, xb (estremi dell'impugnatura), y (asse), rc (raggio della canna), h (quota dell'impugnatura), ri, mat, matI, parte}
  function maniglia(A, o) {
    const K = WK2, m = o.mat, mi = o.matI || m, ri = o.ri || 9, rc = o.rc, yi = o.y + o.h;
    A.add(K.latheX([[o.x - 12, rc - .2], [o.x - 12, rc + 3], [o.x - 11, rc + 4.5], [o.x + 11, rc + 4.5], [o.x + 12, rc + 3], [o.x + 12, rc - .2]], { seg: 28, cy: o.y }), m, o.parte);
    A.add(K.slab([[o.x - 11, o.y + rc + 2, 2], [o.x + 11, o.y + rc + 2, 2], [o.x + 8, yi - ri * .2, 1], [o.x - 8, yi - ri * .2, 1]], -5, 5, { b: 1.3 }), m, o.parte);
    A.add(K.slab([[o.xa + 2, yi - ri - 2, 2], [o.xb - 2, yi - ri - 2, 2], [o.xb - 2, yi - ri * .2, 1], [o.xa + 2, yi - ri * .2, 1]], -4, 4, { b: 1 }), m, o.parte);
    A.add(K.loftX([{ x: o.xa, t: yi + ri * .7, b: yi - ri * .8, w: ri * .7 }, { x: o.xa + 6, t: yi + ri, b: yi - ri, w: ri }, { x: o.xb - 6, t: yi + ri, b: yi - ri, w: ri }, { x: o.xb, t: yi + ri * .7, b: yi - ri * .8, w: ri * .7 }].map(s => Object.assign({ nt: 2.4, nb: 2.4 }, s)), { K: 24, step: 0 }), mi, o.parte);
  }

  // ---- polimero puntinato per le impugnature (trama ripetuta lungo la linea della loftS)
  function matImp(c) { return WK2.mat('polimero', null, { tile: 'stipple', rep: [3, 7], ns: .55, r: .74, c }); }
  // ---- impugnatura a pistola (loftS): o = {x, y (alto, centro), ang (inclinazione all'indietro, rad), len, f0, f1, r0, r1 (mezze profondità
  //      davanti/dietro in alto e in basso), w0, w1 (mezze larghezze), dita (profondità degli incavi per le dita), palmo (rigonfiamento dietro),
  //      base (svasatura in fondo), mat}. Restituisce il punto in basso dell'asse.
  function impugnatura(A, o, part) {
    const K = WK2, st = [], n = 18, s = Math.sin(o.ang), c = Math.cos(o.ang), dita = o.dita === undefined ? 1.6 : o.dita, palmo = o.palmo === undefined ? 2.2 : o.palmo, base = o.base === undefined ? 2.2 : o.base;
    for (let i = 0; i <= n; i++) {
      const t = i / n, g = t > .1 && t < .86 ? Math.pow(Math.max(0, Math.sin((t - .1) / .76 * PI * 3)), 1.3) : 0;
      const sw = palmo * Math.sin(PI * Math.min(1, Math.max(0, (t - .05) / .7))), fl = t > .9 ? base * Math.pow((t - .9) / .1, 1.5) : 0;
      st.push({ p: [o.x - s * o.len * t, o.y - c * o.len * t], f: o.f0 + (o.f1 - o.f0) * t - dita * g + fl * .6 + (t < .1 ? 0 : dita * .3), r: o.r0 + (o.r1 - o.r0) * t + sw + fl, w: o.w0 + (o.w1 - o.w0) * t + Math.sin(t * PI) * 1.4 + fl * .5, nf: 2.6, nr: 2.2 });
    }
    A.add(K.loftS(st, { K: 28, sub: 2 }), o.mat, part);
    return [o.x - s * o.len, o.y - c * o.len];
  }

  // ---- calcio pieno a sezione arrotondata (loftX): st = [[x, alto, basso, mezza larghezza], ...] dal calciolo verso la culatta
  function calcioPieno(st, o) { o = o || {}; return WK2.loftX(st.map(q => ({ x: q[0], t: q[1], b: q[2], w: q[3], nt: o.nt || 3, nb: o.nb || 2.5 })), { K: o.K || 30, step: o.step || 8 }); }
  // ---- solido di rotazione con asse verticale: prof = [[y, raggio]], centro in (x, z)
  function verticale(prof, x, z, seg) { const g = WK2.latheX(prof, { seg: seg || 20 }); g.rotateZ(PI / 2); g.translate(x, 0, z); return g; }
  // ---- alette di raffreddamento sulla canna: n dischi di spessore t fra i raggi ri e re
  function alette(x0, x1, n, ri, re, t, seg) {
    const p = [], pitch = (x1 - x0) / n;
    for (let i = 0; i < n; i++) { const a = x0 + i * pitch + (pitch - t) / 2; p.push([a, ri], [a, re], [a + t, re], [a + t, ri]); }
    return WK2.latheX(p, { seg: seg || 20, ang: 50 });
  }
  // ---- riga di rivetti sul pittore
  function rivetti(p, side, x0, x1, y, n, r) { for (let i = 0; i < n; i++) p.pin(side, x0 + (x1 - x0) * (n > 1 ? i / (n - 1) : .5), y, r, { h: .5, a: 1.1 }); }
  // ---- treppiede a tre gambe: o = {testa: [x, y] (sotto l'arma), yt (quota del terreno), ant (x del piede anteriore), post: [x, z] (piedi posteriori),
  //      r (raggio delle gambe), mat, perno (quota alta del perno verso l'arma), barra (frazione lungo le gambe posteriori della barra di brandeggio),
  //      te: quota dell'attacco del congegno di elevazione sotto il retro dell'arma}
  function treppiede(A, o) {
    const K = WK2, m = o.mat, part = 'treppiede', hx = o.testa[0], hy = o.testa[1], yt = o.yt, r = o.r || 12;
    A.add(verticale([[hy - 34, 0], [hy - 34, 24], [hy - 31, 30], [hy + 6, 30], [hy + 9, 25], [hy + 9, 0]], hx, 0, 24), m, part);
    if (o.perno) A.add(verticale([[hy + 8, 0], [hy + 8, 15], [o.perno - 6, 15], [o.perno - 4, 19], [o.perno, 19], [o.perno, 0]], hx, 0, 18), m, part);
    const p0 = [hx, hy - 20, 0], feet = [[o.ant, yt, 0], [o.post[0], yt, -o.post[1]], [o.post[0], yt, o.post[1]]];
    for (const f of feet) {
      const d = [f[0] - p0[0], f[1] - p0[1], f[2] - p0[2]], L = Math.hypot(d[0], d[1], d[2]);
      A.add(lungo(K.mergeG([K.latheX([[8, 0], [8, r + 6], [10, r + 7], [54, r + 7], [60, r]], { seg: 16 }), K.rod(56, L * .62, r, { seg: 16 }),
        K.latheX([[L * .58, r * 1.2], [L * .64, r * 1.2], [L * .65, r * .76]], { seg: 16 }), K.rod(L * .6, L - 14, r * .76, { seg: 14 })]), p0, d), m, part);
      A.add(K.slab([[f[0] - 26, yt, 3], [f[0] + 26, yt, 3], [f[0] + 18, yt + 7, 2], [f[0] - 18, yt + 7, 2]], f[2] - 16, f[2] + 16, { b: 1.4 }), m, part);
      A.add(lungo(K.latheX([[0, r * .9], [16, r * .9], [22, 3], [24, 0]], { seg: 12 }), [f[0] - d[0] / L * 14, yt + 10, f[2] - d[2] / L * 14], [d[0] / L, -.4, d[2] / L]), m, part);
    }
    if (o.barra) { // barra di brandeggio fra le gambe posteriori e congegno di elevazione
      const t = o.barra, P = s => [hx + (o.post[0] - hx) * t, hy - 20 + (yt - hy + 20) * t, s * o.post[1] * t];
      A.add(asta(P(-1), P(1), r * .7, 14), m, part);
      A.add(K.box(P(0)[0] - 30, P(0)[1] - 8, -60, P(0)[0] + 30, P(0)[1] + 8, 60, 2, 3), m, part);
      if (o.te !== undefined) {
        const c = P(0); A.add(asta([c[0], c[1], 0], [c[0], o.te, 0], 9, 14), m, part);
        A.add(verticale([[c[1] + 24, 0], [c[1] + 24, 30], [c[1] + 30, 30], [c[1] + 30, 0]], c[0], 0, 22), m, part);
        A.add(lungo(K.rod(0, 26, 3, { seg: 10 }), [c[0], c[1] + 27, 30], [0, 0, 1]), m, part);
      }
    }
  }
  // ---- impugnature a vanghe dietro la piastra di culatta: o = {x (faccia posteriore della piastra), y0, y1 (estensione delle impugnature),
  //      z (mezzo interasse), r, d (distanza dalla piastra), mat, matI, yg (quota del grilletto a farfalla)}
  function vanghe(A, o) {
    const K = WK2, m = o.mat, mi = o.matI, xg = o.x - (o.d || 70), z = o.z, r = o.r || 15;
    A.add(K.slab([[o.x - 18, o.y0 - 14, 5], [o.x + 2, o.y0 - 14, 2], [o.x + 2, o.y1 + 16, 2], [o.x - 18, o.y1 + 16, 5]], -z + 6, z - 6, { b: 2.2 }), m);
    for (const s of [-1, 1]) {
      for (const yy of [o.y1 + 2, o.y0 - 2]) A.add(K.slab([[xg - 4, yy - 9, 4], [o.x - 12, yy - 9, 0], [o.x - 12, yy + 9, 0], [xg - 4, yy + 9, 4]], s * z - 8, s * z + 8, { b: 1.6 }), m);
      A.add(verticale([[o.y0 + 6, 0], [o.y0 + 6, r * .9], [o.y0 + 10, r], [o.y1 - 10, r], [o.y1 - 6, r * .9], [o.y1 - 6, 0]], xg, s * z, 20), mi);
      A.add(verticale([[o.y0 - 12, 0], [o.y0 - 12, r * .7], [o.y0 - 9, r * .8], [o.y0 + 7, r * .8], [o.y0 + 7, 0]], xg, s * z, 16), m);
      A.add(verticale([[o.y1 - 7, 0], [o.y1 - 7, r * .8], [o.y1 + 9, r * .8], [o.y1 + 12, r * .7], [o.y1 + 12, 0]], xg, s * z, 16), m);
    }
    A.add(K.slab([[xg + 14, o.yg - 22, 3], [o.x - 22, o.yg - 22, 1], [o.x - 22, o.yg + 2, 1], [xg + 10, o.yg + 6, 4]], -z + 22, z - 22, { b: 1.5 }), m, 'grilletto');
    A.pivot('grilletto', [o.x - 22, o.yg - 22, 0]);
  }

  // ================================================================ mitragliatrice media a calcio scheletrato (alimentazione da destra)
  // 151: prima serie con calcio, impugnatura e maniglia in legno laminato e canna scanalata; 152: serie modernizzata in polimero.
  FAM2.mtr_media_calcio_cavo = function (spec, o) {
    o = o || {};
    const K = WK2, A = K.asm('mtr_media_calcio_cavo'), legno = !!o.legno, sn = serie(spec);
    const mSt = K.mat('nero', null, { r: .46 }), mDark = K.mat('nero_lucido', null, { c: '#050505', r: .7 }), mBar = K.mat('brunito', null, { r: .34 });
    const mF = legno ? K.mat('legno_laminato') : K.mat('polimero', null, { tile: 'grana', rep: [5, 3], ns: .35 });
    // ---------------- scatola di culatta in lamiera stampata: x 0..304, y -46..16, mezza larghezza 22
    const rb = [0, -48, 306, 18];
    const pR = K.painter(rb, { w: 1024, h: 512, rough: .5 });
    pR.fill('LR', K.rrect(30, -24, 262, -15, 4), { h: .4, a: 1.05 });                  // nervatura stampata lungo il fianco
    for (const [x, y] of [[9, 8], [9, -38], [22, -41], [278, 8], [292, 8], [278, -38], [292, -38], [285, -14], [128, -41], [166, -41], [70, -41]]) pR.pin('LR', x, y, 2.3, { h: .5, a: 1.1 });
    pR.line('LR', [[270, -46], [270, 16]], .5, { h: -.7, a: .6 }); pR.line('LR', [[34, -46], [34, 16]], .5, { h: -.7, a: .6 });
    pR.fill('R', K.rrect(140, -34, 246, -27, 2.5), { h: -.95, a: .2, r: .8 });          // feritoia della manetta
    pR.text('L', spec.produttore.toUpperCase(), 100, 6, 4.4, { spacing: 6 }); pR.text('L', sn, 230, -36, 3.2);
    pR.text('R', spec.nome.toUpperCase(), 92, 6, 4.4, { spacing: 5 }); pR.text('R', spec.calibro || '', 92, -36, 3.2);
    pR.noise({ a: .12, r: .18, seed: 7 }); pR.walls({ r: .48 });
    const mR = K.mat('nero', pR.done(2.4), { ns: .85 });
    // metà sinistra (finestra di espulsione e uscita delle maglie), metà destra (apertura di alimentazione)
    const rL = [[0, -46, 2, .5], [298, -46, 1.5, .5], [304, -38, 1, .5], [304, 16, 0, .5], [246, 16, 0, .4], [246, 5, 1, .3], [198, 5, 1, .3], [198, 16, 0, .4], [0, 16, 0, .5]];
    const rR = [[0, -46, 2, .5], [298, -46, 1.5, .5], [304, -38, 1, .5], [304, 16, 0, .5], [266, 16, 0, .4], [266, 3, 1.5, .3], [172, 3, 1.5, .3], [172, 16, 0, .4], [0, 16, 0, .5]];
    A.add(K.slab(rL, -22, 0, { bL: 1.6, bR: 0, uv: rb, holes: [[[150, -31, 2], [214, -31, 2], [214, -9, 2], [150, -9, 2]]] }), mR);
    A.add(K.slab(rR, 0, 22, { bL: 0, bR: 1.6, uv: rb }), mR);
    A.add(K.box(-5, -44, -20, 1, 13, 20, 1.2, 3), mSt);                                  // piastra posteriore
    A.add(K.box(172, -2, 0, 266, 3.2, 21, .4, 0), mDark);                                // fondo della finestra di alimentazione
    A.add(K.slab([[284, -24, 2], [298, -24, 2], [300, 12, 2], [286, 12, 2]], -25, -22, { b: .7 }), mSt); // leva del blocco della canna
    A.add(K.slab([[64, -44, 1], [96, -44, 1], [96, -39, 2], [70, -37, 2]], 21.5, 24, { b: .5 }), mSt); // sicura (lato destro)
    // otturatore: carrello visibile dalla finestra e manetta d'armamento a destra (si muove col carrello)
    const mBolt = K.mat('brunito', null, { r: .3 });
    A.add(K.box(150, -30, -19, 214, -10, -3, .8, 2), mBolt, 'otturatore');
    A.add(lungo(K.rod(0, 25, 3.8, { seg: 14 }), [238, -30.5, 19], [0, 0, 1]), mBolt, 'otturatore');
    A.add(lungo(K.latheX([[0, 0], [0, 5.5], [3, 7.2], [12, 7.2], [15, 5.2], [16, 0]], { seg: 18 }), [238, -30.5, 42], [0, 0, 1]), mBolt, 'otturatore');
    A.pivot('otturatore', [238, -30, 0]);
    // ---------------- coperchio di alimentazione (cerniera davanti) e alzo sul blocco anteriore
    const cov = [[44, 16, 0, .5], [282, 16, 0, .5], [284, 26, 3, .8], [276, 33, 4, 1], [128, 35, 6, 1], [102, 31, 8, 1], [58, 29, 6, 1], [44, 23, 3, .6]];
    A.add(K.slab(cov, -20.5, 20.5, { b: 2.2 }), mSt, 'coperchio');
    A.add(K.box(124, 33, -6.5, 266, 37.5, 6.5, 1.2, 2), mSt, 'coperchio');
    A.add(K.box(40, 17, -11, 54, 29, 11, 1, 2), mSt, 'coperchio');
    A.add(lungo(K.rod(0, 46, 3, { seg: 12 }), [280, 26, -23], [0, 0, 1]), mSt);
    A.pivot('coperchio', [280, 26, 0]);
    A.add(K.slab([[284, 16, 0], [318, 16, 0], [318, 25, 2], [306, 30, 2], [288, 30, 2]], -11, 11, { b: 1 }), mSt);
    A.add(K.slab([[292, 29, 1], [344, 29, 1], [344, 32.5, 1], [296, 33.5, 1]], -6, 6, { b: .6 }), mSt);
    A.add(K.box(318, 30, -8, 330, 35, 8, .6, 1), mSt);
    A.add(K.slabX([[-6, 31, .5], [6, 31, .5], [6, 38, .8], [1.3, 38, .3], [1.3, 35, .5], [-1.3, 35, .5], [-1.3, 38, .3], [-6, 38, .8]], 289, 295, { b: .4 }), mSt);
    // ---------------- canna, cilindro del gas, regolatore, mirino, spegnifiamma
    A.add(K.latheX([[300, 0], [300, 17], [302, 18], [324, 18], [328, 16], [338, 13.4], [338, 0]], { seg: 28 }), mBar);
    if (legno) A.add(scanalata([[336, 13], [352, 12.6, 0], [362, 12.3, 2.4], [596, 11.4, 2.4], [606, 11.1, 0], [858, 9.6, 0]], 6, { seg: 36 }), mBar);
    else A.add(K.latheX([[336, 13], [352, 12.4], [606, 11], [858, 9.6], [860, 0]], { seg: 26 }), mBar);
    A.add(K.tube(304, 646, 8.6, 6, { seg: 20, cy: -25 }), mSt);
    A.add(K.latheX([[632, 10.5], [632, 15], [634, 16], [662, 16], [664, 15], [664, 10.5]], { seg: 26 }), mSt);
    A.add(K.slab([[636, -26, 0], [660, -26, 0], [660, -6, 2], [636, -6, 2]], -9, 9, { b: 1.2 }), mSt);
    A.add(K.latheX([[644, 0], [644, 10.5], [646, 11.5], [676, 11.5], [678, 10.5], [678, 6], [700, 6], [702, 0]], { seg: 22, cy: -25 }), mSt);
    A.add(K.latheX([[680, 7.5], [680, 10], [694, 10], [694, 7.5]], { seg: 22, cy: -25 }), K.mat('nero', null, { tile: 'knurl', rep: [6, 2], r: .5 }));
    bipiede(A, { x: 664, ya: -25, rc: 9, yh: -42, len: 330, r: 5.2, piede: 'piatto', apre: .2, avanti: .12, mat: mSt });
    A.add(K.latheX([[812, 9], [812, 13], [814, 14.5], [844, 14.5], [846, 13], [846, 9]], { seg: 24 }), mSt);
    A.add(K.slab([[816, 10, 0], [842, 10, 0], [842, 22, 2], [834, 26, 2], [822, 26, 2], [816, 20, 2]], -7, 7, { b: 1 }), mSt);
    for (const s of [-1, 1]) A.add(K.slab([[818, 18, 0], [840, 18, 0], [838, 43, 4], [823, 43, 4]], s > 0 ? 4.8 : -7.8, s > 0 ? 7.8 : -4.8, { b: .7 }), mSt);
    A.add(K.slab([[827, 24, 0], [833, 24, 0], [832.4, 40, .5], [827.6, 40, .5]], -1.2, 1.2, { b: .3 }), mSt);
    A.add(K.latheX([[856, 0], [856, 10.5], [858, 12.4], [868, 12.4], [868, 0]], { seg: 25 }), mSt);
    A.add(forata({ x0: 866, x1: 938, r: 12.4, t: 2.6, nx: 1, na: 5, m: 2, foro: () => ({ w: 25, h: 2.7, n: 6, u: 5 }) }), mSt);
    A.add(K.discX(858.5, 0, 0, 4.2, 1, 16), mDark);
    // maniglia di trasporto sulla canna (impugnatura in legno o polimero)
    maniglia(A, { x: 368, xa: 322, xb: 428, y: 0, rc: 12.6, h: 60, ri: 9.5, mat: mSt, matI: mF });
    // ---------------- impugnatura, ponticello, grilletto
    impugnatura(A, { x: 70, y: -42, ang: .27, len: 110, f0: 13, f1: 15, r0: 15, r1: 17, w0: 13, w1: 14.2, mat: mF });
    A.add(K.xf(K.slab([[-17, -4, 3], [19, -4, 3], [20, 1, 0], [-18, 1, 0]], -15, 15, { b: 1.5 }), { r: [0, 0, -.27], t: [70 - Math.sin(.27) * 110, -42 - Math.cos(.27) * 110, 0] }), mSt);
    A.add(K.slab([[90, -44, 0], [162, -44, 0], [163, -52, 3], [154, -80, 7], [106, -82, 9], [90, -66, 5]], -5.5, 5.5, { b: 1, holes: [[[101, -50, 3], [151, -50, 3], [146, -73, 6], [108, -74, 7]]] }), mSt);
    A.add(K.slab([[114, -44, 1], [121, -44, 1], [120, -53, 4], [116, -67, 1.2], [111.5, -66.5, 1.2], [115.5, -54, 4]], -3, 3, { b: .6 }), mSt, 'grilletto');
    A.pivot('grilletto', [118, -46, 0]);
    // ---------------- calcio scheletrato con calciolo in acciaio
    const sb = [-266, -142, 4, 14];
    const stock = [[2, 12, 0, .4], [-10, 12, 4], [-246, -2, 8], [-254, -6, 3], [-254, -134, 4], [-246, -140, 6], [-120, -96, 20], [-34, -62, 14], [2, -44, 0, .4]];
    const hole = [[-218, -24, 12], [-58, -12, 12], [-46, -26, 8], [-66, -50, 10], [-218, -104, 14]];
    A.add(K.slab(stock, -18, 18, { b: legno ? 6 : 4.5, holes: [hole], uv: sb }), mF);
    A.add(K.slab([[-262, -5, 3], [-252, -5, 0], [-252, -137, 0], [-262, -137, 3]], -19, 19, { b: 1.4 }), mSt);
    WC.put(A, WC.screw(-257, -30, 19, 2.6, 1)); WC.put(A, WC.screw(-257, -110, 19, 2.6, 1));
    WC.put(A, WC.swivel(-150, -118, 0, { rot: 0, r: 8 }));
    // ---------------- scatola portanastro sotto il lato destro e nastro che sale nell'apertura di alimentazione
    const mBox = K.mat('parker', null, { c: '#2f322c', r: .62 });
    A.add(K.box(196, -54, 2, 296, -45, 26, .8, 2), mSt);
    scatola(A, { x0: 166, x1: 330, y0: -180, y1: -54, z0: -4, z1: 66, mat: mBox, nerv: 2 });
    A.add(K.box(176, -54.2, 32, 262, -53, 58, .3, 2), mDark, 'caricatore');
    nastro(A, { cal: 'c762r', pts: [[180, 10.5, 8], [180, 10, 27], [180, -2, 41], [180, -22, 48], [180, -42, 47], [180, -56, 44]], anelli: [[.12, 9], [.5, 12]], traccianti: 5 });
    A.pivot('nastro', [180, 10, 10]); A.pivot('caricatore', [248, -54, 30]);
    // ---------------- punti di riferimento
    A.anchor('bocca', [939, 0, 0]); A.anchor('espulsione', [182, -20, -23], [0, -.3, -1]); A.anchor('impugnatura', [56, -92, 0]); A.anchor('grilletto', [116, -60, 0]);
    A.anchor('appoggio', [430, -44, -8]); A.anchor('mira_post', [292, 38, 0]); A.anchor('mira_ant', [830, 40, 0]); A.anchor('calcio', [-262, -70, 0]);
    const r = A.done();
    r.info = { azione: 'auto', bossolo: 'fucile_lungo', ciclo: { otturatore: { dx: -.095 }, grilletto: { rz: -.15 } },
      ricarica: { coperchio: { rz: -1.15 }, caricatore: { dy: -.09, dz: .05 }, nastro: { dy: -.09, dz: .05 } }, piega: { bipiede: { rz: -1.45 } } };
    return r;
  };
  MAP2[151] = { f: 'mtr_media_calcio_cavo', o: { legno: true } };
  MAP2[152] = { f: 'mtr_media_calcio_cavo', o: { legno: false } };

  // ================================================================ mitragliatrice media a scatola rivettata (alimentazione da sinistra,
  // espulsione in basso): culatta alta e lunga con file di rivetti, coperchio a gradino, regolatore del gas grande, calcio lungo in polimero
  FAM2.mtr_media_rivettata = function (spec, o) {
    o = o || {};
    const K = WK2, A = K.asm('mtr_media_rivettata'), sn = serie(spec), hw = 28;
    const mSt = K.mat('nero', null, { r: .46 }), mDark = K.mat('nero_lucido', null, { c: '#050505', r: .7 }), mBar = K.mat('brunito', null, { r: .36 });
    const mPol = K.mat('polimero', null, { tile: 'grana', rep: [6, 3], ns: .3 });
    // ---------------- scatola di culatta: x 0..420, y -64..28
    const rb = [0, -66, 422, 30];
    const pR = K.painter(rb, { w: 1024, h: 512, rough: .5 });
    rivetti(pR, 'LR', 14, 404, 21.5, 16, 2.3); rivetti(pR, 'LR', 14, 392, -57.5, 15, 2.3);
    for (const [x, y] of [[392, 2], [392, -26], [406, 2], [406, -26], [24, -12], [24, -34], [206, -40], [236, -40]]) pR.pin('LR', x, y, 2.8, { h: .5, a: 1.1 });
    pR.fill('LR', K.rrect(46, -44, 372, -31, 3), { h: -.3, a: .9 });
    pR.line('LR', [[378, -64], [378, 28]], .5, { h: -.7, a: .6 }); pR.line('LR', [[36, -64], [36, 28]], .5, { h: -.7, a: .6 });
    pR.text('L', spec.produttore.toUpperCase(), 130, 4, 5, { spacing: 7 }); pR.text('L', sn, 300, -16, 3.4);
    pR.text('R', spec.nome.toUpperCase(), 120, 4, 5, { spacing: 7 }); pR.text('R', spec.calibro || '', 120, -16, 3.4);
    pR.noise({ a: .12, r: .18, seed: 11 }); pR.walls({ r: .48 });
    const mR = K.mat('nero', pR.done(2.4), { ns: .85 });
    const rL = [[0, -64, 2, .5], [404, -64, 2, .5], [420, -50, 1, .5], [420, 28, 0, .5], [334, 28, 0, .4], [334, 10, 1.5, .3], [228, 10, 1.5, .3], [228, 28, 0, .4], [0, 28, 0, .5]];
    const rR = [[0, -64, 2, .5], [404, -64, 2, .5], [420, -50, 1, .5], [420, 28, 0, .5], [322, 28, 0, .4], [322, 14, 1.5, .3], [244, 14, 1.5, .3], [244, 28, 0, .4], [0, 28, 0, .5]];
    A.add(K.slab(rL, -hw, 0, { bL: 1.8, bR: 0, uv: rb }), mR);
    A.add(K.slab(rR, 0, hw, { bL: 0, bR: 1.8, uv: rb }), mR);
    A.add(K.box(228, 8, -hw + 1, 334, 10.4, -1, .3, 0), mDark); A.add(K.box(244, 12, 1, 322, 14.4, hw - 1, .3, 0), mDark);
    A.add(K.box(-14, -58, -24, 2, 24, 24, 2, 4), mSt);                                       // attacco del calcio
    A.add(K.box(18, -75, -16, 206, -62, 16, 1.2, 3), mSt);                                    // scatola dello scatto
    // otturatore (si vede solo dall'apertura in basso) e manetta d'armamento a destra, che non si muove sparando
    A.add(K.box(230, -63, -12, 330, -50, 12, .8, 2), K.mat('brunito', null, { r: .3 }), 'otturatore'); A.pivot('otturatore', [280, -56, 0]);
    A.add(K.box(232, -64.6, -13, 332, -63.4, 13, .2, 0), mDark);
    A.add(K.slab([[300, -16, 2], [384, -16, 2], [384, -6, 2], [300, -6, 2]], hw - .5, hw + 2.5, { b: .6 }), mSt);
    A.add(lungo(K.rod(0, 30, 4.2, { seg: 14 }), [366, -11, hw + 1], [0, 0, 1]), mSt, 'manetta');
    A.add(lungo(K.latheX([[0, 0], [0, 6], [3, 8], [26, 8], [29, 6], [30, 0]], { seg: 18 }), [366, -11, hw + 28], [0, -1, 0]).translate(0, 15, 0), mSt, 'manetta');
    A.pivot('manetta', [366, -11, hw]);
    // ---------------- coperchio a gradino (cerniera davanti) e alzo a foglia sulla culatta
    const cov = [[168, 28, 0, .5], [400, 28, 0, .5], [404, 36, 3, .8], [396, 46, 4, 1], [262, 48, 6, 1], [236, 44, 6, 1], [178, 42, 6, 1], [168, 34, 3, .6]];
    A.add(K.slab(cov, -hw + 1, hw - 1, { b: 2.4 }), mSt, 'coperchio');
    A.add(K.box(272, 46, -9, 384, 51, 9, 1.2, 2), mSt, 'coperchio');
    A.add(K.box(164, 30, -13, 180, 41, 13, 1, 2), mSt, 'coperchio');
    A.add(lungo(K.rod(0, 2 * hw + 2, 3.4, { seg: 12 }), [398, 38, -hw - 1], [0, 0, 1]), mSt);
    A.pivot('coperchio', [398, 38, 0]);
    A.add(K.slab([[90, 28, 0], [154, 28, 0], [154, 33, 2], [96, 35, 2]], -13, 13, { b: 1 }), mSt);
    A.add(K.slab([[104, 34, 1], [164, 34, 1], [164, 37, 1], [108, 38.5, 1]], -7.5, 7.5, { b: .5 }), mSt);
    A.add(K.slabX([[-7, 36, .5], [7, 36, .5], [7, 44, .8], [1.4, 44, .3], [1.4, 40.5, .5], [-1.4, 40.5, .5], [-1.4, 44, .3], [-7, 44, .8]], 98, 104, { b: .4 }), mSt);
    // ---------------- canna, cilindro del gas con regolatore, bipiede, mirino, spegnifiamma, maniglia
    A.add(K.latheX([[398, 0], [398, 18.5], [400, 19.5], [438, 19.5], [442, 16], [452, 14.5], [905, 12], [907, 0]], { seg: 28 }), mBar);
    A.add(K.tube(418, 842, 11, 8, { seg: 22, cy: -32 }), mSt);
    A.add(K.latheX([[826, 11.5], [826, 16], [828, 17], [858, 17], [860, 16], [860, 11.5]], { seg: 26 }), mSt);
    A.add(K.slab([[830, -36, 0], [856, -36, 0], [856, -12, 2], [830, -12, 2]], -10, 10, { b: 1.2 }), mSt);
    A.add(K.latheX([[842, 0], [842, 13], [844, 14.6], [870, 14.6], [872, 12], [872, 0]], { seg: 22, cy: -32 }), mSt);
    A.add(K.slab([[866, -32, 2], [880, -32, 2], [880, -18, 2], [866, -18, 2]], -3, 3, { b: .8 }), mSt);
    bipiede(A, { x: 806, ya: -32, rc: 11, yh: -52, len: 320, r: 5.5, piede: 'punta', apre: .2, avanti: .1, mat: mSt });
    A.add(K.latheX([[876, 11], [876, 15], [878, 16.5], [900, 16.5], [902, 15], [902, 11]], { seg: 24 }), mSt);
    A.add(K.slab([[880, 14, 0], [898, 14, 0], [896, 30, 3], [884, 30, 3]], -6, 6, { b: 1 }), mSt);
    for (const s of [-1, 1]) A.add(K.slab([[882, 26, 0], [896, 26, 0], [895, 45, 3], [883, 45, 3]], s > 0 ? 5 : -8, s > 0 ? 8 : -5, { b: .6 }), mSt);
    A.add(K.slab([[886, 28, 0], [892, 28, 0], [891.4, 44, .6], [886.6, 44, .6]], -1.4, 1.4, { b: .3 }), mSt);
    A.add(K.latheX([[903, 0], [903, 11], [905, 13], [915, 13], [915, 0]], { seg: 24 }), mSt);
    A.add(forata({ x0: 913, x1: 966, r: 13.6, t: 2.6, nx: 1, na: 6, m: 1, foro: () => ({ w: 17, h: 2.8, n: 6, u: 4 }) }), mSt);
    A.add(K.discX(906, 0, 0, 4.4, 1, 16), mDark);
    maniglia(A, { x: 476, xa: 432, xb: 540, y: 0, rc: 14.4, h: 58, ri: 10, mat: mSt, matI: mPol });
    // ---------------- impugnatura, ponticello, grilletto
    impugnatura(A, { x: 96, y: -70, ang: .3, len: 106, f0: 13, f1: 15, r0: 15, r1: 17, w0: 13.5, w1: 14.5, dita: 1.6, mat: matImp() });
    A.add(K.slab([[116, -72, 0], [196, -72, 0], [198, -80, 3], [188, -106, 7], [132, -108, 9], [116, -92, 5]], -6, 6, { b: 1, holes: [[[127, -78, 3], [186, -78, 3], [181, -100, 6], [134, -101, 7]]] }), mSt);
    A.add(K.slab([[142, -72, 1], [149, -72, 1], [148, -81, 4], [144, -95, 1.2], [139.5, -94.5, 1.2], [143.5, -82, 4]], -3, 3, { b: .6 }), mSt, 'grilletto');
    A.pivot('grilletto', [146, -73, 0]);
    // ---------------- calcio lungo in polimero con calciolo in gomma
    A.add(calcioPieno([[-298, 8, -134, 21], [-286, 10, -136, 21], [-172, 15, -110, 20], [-64, 20, -80, 18.5], [-14, 21.5, -66, 18], [4, 22, -62, 18]]), mPol);
    A.add(K.box(-250, -12, 19.5, -60, -6, 20.6, .5, 2), mPol); A.add(K.box(-250, -12, -20.6, -60, -6, -19.5, .5, 2), mPol);
    A.add(K.slab([[-308, 6, 4], [-298, 6, 0], [-298, -134, 0], [-308, -134, 4]], -21, 21, { b: 2.4 }), K.mat('gomma'));
    WC.put(A, WC.swivel(-210, -116, 0, { r: 8 }));
    // ---------------- nastro libero che pende dal lato sinistro
    nastro(A, { cal: 'c762', pts: [[252, 19, -10], [252, 19, -30], [252, 8, -46], [252, -14, -54], [252, -50, -56], [252, -100, -52], [252, -150, -46], [252, -196, -40]], traccianti: 5 });
    A.pivot('nastro', [252, 19, -10]);
    A.anchor('bocca', [967, 0, 0]); A.anchor('espulsione', [280, -66, 0], [0, -1, .15]); A.anchor('impugnatura', [80, -118, 0]); A.anchor('grilletto', [144, -88, 0]);
    A.anchor('appoggio', [560, -50, -6]); A.anchor('mira_post', [101, 44, 0]); A.anchor('mira_ant', [889, 44, 0]); A.anchor('calcio', [-306, -64, 0]);
    const r = A.done();
    r.info = { azione: 'auto', bossolo: 'fucile_lungo', ciclo: { otturatore: { dx: -.1 }, grilletto: { rz: -.15 } },
      ricarica: { coperchio: { rz: -1.15 }, manetta: { dx: -.1 }, nastro: { dy: -.08 } }, piega: { bipiede: { rz: -1.45 } } };
    return r;
  };
  MAP2[153] = { f: 'mtr_media_rivettata', o: {} };

  // ================================================================ mitragliatrice media ad astina tonda (alimentazione da sinistra, espulsione
  // a destra): impugnatura a pistola avanzata, astina cilindrica nervata, bipiede sul cilindro del gas, calcio lungo con appoggio per la spalla
  FAM2.mtr_media_astina_tonda = function (spec, o) {
    o = o || {};
    const K = WK2, A = K.asm('mtr_media_astina_tonda'), sn = serie(spec), hw = 25;
    const mSt = K.mat('nero', null, { r: .46 }), mDark = K.mat('nero_lucido', null, { c: '#050505', r: .7 }), mBar = K.mat('parker', null, { c: '#2a2c2b', r: .45 });
    const mPol = K.mat('polimero', null, { tile: 'grana', rep: [6, 3], ns: .3 });
    // ---------------- scatola di culatta: x 0..330, y -46..18
    const rb = [0, -48, 332, 20];
    const pR = K.painter(rb, { w: 1024, h: 512, rough: .52 });
    for (const [x, y] of [[12, 10], [12, -38], [306, 10], [318, 10], [306, -36], [318, -36], [150, -40], [176, -40], [80, -40]]) pR.pin('LR', x, y, 2.3, { h: .5, a: 1.1 });
    pR.line('LR', [[296, -46], [296, 18]], .5, { h: -.7, a: .6 }); pR.fill('LR', K.rrect(24, -18, 186, -10, 3), { h: .35, a: 1.04 });
    pR.text('L', spec.produttore.toUpperCase(), 110, 4, 4.4, { spacing: 6 }); pR.text('L', sn, 110, -30, 3.2);
    pR.text('R', spec.nome.toUpperCase(), 108, 4, 4.4, { spacing: 6 }); pR.text('R', (spec.calibro || '') + '  ' + sn, 108, -30, 3);
    pR.noise({ a: .12, r: .18, seed: 13 }); pR.walls({ r: .5 });
    const mR = K.mat('parker', pR.done(2.4), { c: '#2a2c2b', ns: .85 });
    const rL = [[0, -46, 2, .5], [322, -46, 1.5, .5], [330, -38, 1, .5], [330, 18, 0, .5], [264, 18, 0, .4], [264, 4, 1.5, .3], [180, 4, 1.5, .3], [180, 18, 0, .4], [0, 18, 0, .5]];
    const rR = [[0, -46, 2, .5], [322, -46, 1.5, .5], [330, -38, 1, .5], [330, 18, 0, .5], [0, 18, 0, .5]];
    A.add(K.slab(rL, -hw, 0, { bL: 1.6, bR: 0, uv: rb }), mR);
    A.add(K.slab(rR, 0, hw, { bL: 0, bR: 1.6, uv: rb, holes: [[[198, -24, 2], [262, -24, 2], [262, 0, 2], [198, 0, 2]]] }), mR);
    A.add(K.box(180, 2.4, -hw + 1, 264, 4.4, -1, .3, 0), mDark);
    A.add(K.box(196, -24, 2, 264, 0, 4, .3, 0), mDark);
    A.add(K.box(200, -22, 5, 260, -2, 18, .8, 2), K.mat('brunito', null, { r: .3 }), 'otturatore'); A.pivot('otturatore', [230, -12, 10]);
    A.add(K.box(-10, -44, -22, 2, 16, 22, 1.5, 3), mSt);
    A.add(K.box(62, -58, -15, 206, -45, 15, 1.2, 3), mSt);                                   // scatola dello scatto avanzata
    // manetta a destra davanti (non si muove sparando)
    A.add(K.slab([[268, -30, 2], [322, -30, 2], [322, -20, 2], [268, -20, 2]], hw - .5, hw + 2, { b: .5 }), mSt);
    A.add(lungo(K.rod(0, 24, 4, { seg: 14 }), [300, -25, hw], [0, 0, 1]), mSt, 'manetta');
    A.add(lungo(K.latheX([[0, 0], [0, 5.5], [2, 7.5], [16, 7.5], [18, 5.5], [18, 0]], { seg: 18 }), [300, -25, hw + 22], [0, 0, 1]), mSt, 'manetta');
    A.pivot('manetta', [300, -25, hw]);
    // ---------------- coperchio bombato (cerniera davanti) e alzo a foglia ribaltabile
    A.add(K.loftX([{ x: 120, t: 30, b: 17, w: 22 }, { x: 128, t: 36, b: 17, w: 24 }, { x: 300, t: 40, b: 17, w: 24 }, { x: 316, t: 34, b: 17, w: 23 }, { x: 320, t: 26, b: 17, w: 20 }].map(s => Object.assign({ nt: 3, nb: 12 }, s)), { K: 28, step: 6 }), mSt, 'coperchio');
    A.add(K.box(112, 18, -10, 126, 30, 10, 1, 2), mSt, 'coperchio');
    A.add(lungo(K.rod(0, 2 * hw, 3, { seg: 12 }), [314, 26, -hw], [0, 0, 1]), mSt);
    A.pivot('coperchio', [314, 26, 0]);
    A.add(K.slab([[52, 18, 0], [112, 18, 0], [112, 23, 2], [58, 27, 3]], -14, 14, { b: 1 }), mSt);
    A.add(K.slab([[64, 26, 1], [118, 26, 1], [118, 29, 1], [66, 31, 1]], -8, 8, { b: .5 }), mSt);
    A.add(lungo(K.latheX([[0, 0], [0, 6], [8, 6], [8, 0]], { seg: 16 }), [86, 24, 14], [0, 0, 1]), K.mat('nero', null, { tile: 'knurl', rep: [4, 1], r: .5 }));
    A.add(K.slabX([[-7, 28, .5], [7, 28, .5], [7, 36, .8], [1.4, 36, .3], [1.4, 32.5, .5], [-1.4, 32.5, .5], [-1.4, 36, .3], [-7, 36, .8]], 60, 66, { b: .4 }), mSt);
    // ---------------- astina tonda nervata, canna, cilindro del gas, bipiede, mirino, spegnifiamma, maniglia
    A.add(K.latheX([[316, 0], [316, 20], [318, 21], [338, 21], [342, 17], [342, 0]], { seg: 28 }), mSt);
    A.add(K.loftX([{ x: 336, t: 12, b: -38, w: 24, nt: 2.2, nb: 2.6 }, { x: 346, t: 17, b: -45, w: 28 }, { x: 562, t: 17, b: -45, w: 28 }, { x: 574, t: 11, b: -38, w: 23 }].map(s => Object.assign({ nt: 2.2, nb: 2.6 }, s)), { K: 32, step: 6 }), K.mat('polimero', null, { tile: 'ribs', rep: [1, 3], ns: .9, r: .62 }));
    A.add(K.latheX([[338, 0], [338, 15], [574, 13.2], [735, 11], [737, 0]], { seg: 26 }), mBar);
    A.add(K.latheX([[574, 0], [574, 12], [576, 13], [640, 13], [642, 11], [642, 0]], { seg: 22, cy: -26 }), mSt);
    A.add(K.slab([[600, -28, 0], [632, -28, 0], [632, -8, 2], [600, -8, 2]], -9, 9, { b: 1.2 }), mSt);
    A.add(K.latheX([[598, 11], [598, 15], [600, 16], [632, 16], [634, 15], [634, 11]], { seg: 24 }), mSt);
    bipiede(A, { x: 622, ya: -26, rc: 13, yh: -44, len: 300, r: 5.2, piede: 'disco', apre: .2, avanti: .1, mat: mSt });
    A.add(K.latheX([[704, 10], [704, 13.5], [706, 15], [728, 15], [730, 13.5], [730, 10]], { seg: 24 }), mSt);
    A.add(K.slab([[708, 12, 0], [726, 12, 0], [724, 26, 3], [710, 26, 3]], -5, 5, { b: .9 }), mSt);
    A.add(K.slab([[714, 24, 0], [720, 24, 0], [719.4, 37, .6], [714.6, 37, .6]], -1.3, 1.3, { b: .3 }), mSt);
    A.add(K.latheX([[734, 0], [734, 12], [736, 13.5], [748, 13.5], [748, 0]], { seg: 24 }), mSt);
    A.add(forata({ x0: 746, x1: 826, r: 13.5, t: 2.4, nx: 1, na: 6, m: 2, foro: () => ({ w: 30, h: 3, n: 6, u: 6 }) }), mSt);
    A.add(K.discX(738, 0, 0, 4.2, 1, 16), mDark);
    maniglia(A, { x: 366, xa: 338, xb: 446, y: 0, rc: 14.6, h: 54, ri: 9.5, mat: mSt, matI: mPol });
    // ---------------- impugnatura avanzata, ponticello, grilletto
    impugnatura(A, { x: 98, y: -54, ang: .26, len: 104, f0: 13, f1: 15, r0: 15, r1: 17, w0: 13.5, w1: 14.5, mat: matImp() });
    A.add(K.slab([[118, -56, 0], [198, -56, 0], [200, -64, 3], [190, -90, 7], [134, -92, 9], [118, -76, 5]], -6, 6, { b: 1, holes: [[[129, -62, 3], [188, -62, 3], [183, -84, 6], [136, -85, 7]]] }), mSt);
    A.add(K.slab([[144, -56, 1], [151, -56, 1], [150, -65, 4], [146, -79, 1.2], [141.5, -78.5, 1.2], [145.5, -66, 4]], -3, 3, { b: .6 }), mSt, 'grilletto');
    A.pivot('grilletto', [148, -57, 0]);
    // ---------------- calcio lungo in polimero con appoggio ribaltabile sul calciolo
    A.add(calcioPieno([[-272, 10, -128, 20], [-262, 10.5, -126, 20], [-160, 12.5, -96, 19.5], [-80, 14.5, -70, 18.5], [-20, 16, -50, 17.5], [2, 16, -44, 17]]), mPol);
    A.add(K.slab([[-280, 8, 3], [-272, 8, 0], [-272, -126, 0], [-280, -126, 3]], -20, 20, { b: 1.6 }), mSt);
    A.add(K.slab([[-284, 8, 2], [-278, 8, 2], [-278, 34, 3], [-284, 34, 3]], -14, 14, { b: 1 }), mSt);
    WC.put(A, WC.swivel(-190, -100, 0, { r: 8 }));
    // ---------------- nastro dal lato sinistro
    nastro(A, { cal: 'c762', pts: [[186, 11, -8], [186, 11, -28], [186, 0, -42], [186, -24, -48], [186, -70, -50], [186, -120, -46], [186, -170, -40]], traccianti: 5 });
    A.pivot('nastro', [186, 11, -8]);
    A.anchor('bocca', [827, 0, 0]); A.anchor('espulsione', [230, -12, 26], [0, .2, 1]); A.anchor('impugnatura', [82, -100, 0]); A.anchor('grilletto', [146, -72, 0]);
    A.anchor('appoggio', [460, -48, -6]); A.anchor('mira_post', [63, 36, 0]); A.anchor('mira_ant', [717, 37, 0]); A.anchor('calcio', [-280, -60, 0]);
    const r = A.done();
    r.info = { azione: 'auto', bossolo: 'fucile_lungo', ciclo: { otturatore: { dx: -.08 }, grilletto: { rz: -.15 } },
      ricarica: { coperchio: { rz: -1.15 }, manetta: { dx: -.09 }, nastro: { dy: -.08 } }, piega: { bipiede: { rz: -1.45 } } };
    return r;
  };
  MAP2[146] = { f: 'mtr_media_astina_tonda', o: {} };

  // ================================================================ mitragliatrice media con camicia forata (alimentazione da sinistra,
  // espulsione in basso): camicia della canna con fori ovali e finestra a destra per il cambio rapido, rafforzatore di bocca, calcio in polimero
  FAM2.mtr_media_camicia_forata = function (spec, o) {
    o = o || {};
    const K = WK2, A = K.asm('mtr_media_camicia_forata'), sn = serie(spec), hw = 25;
    const mSt = K.mat('nero', null, { r: .46 }), mDark = K.mat('nero_lucido', null, { c: '#050505', r: .7 }), mBar = K.mat('brunito', null, { r: .36 });
    const mPol = K.mat('polimero', null, { tile: 'grana', rep: [6, 3], ns: .3 });
    // ---------------- scatola di culatta: x 0..330, y -50..16
    const rb = [0, -52, 332, 18];
    const pR = K.painter(rb, { w: 1024, h: 512, rough: .5 });
    for (const [x, y] of [[10, 8], [10, -40], [24, -44], [300, 8], [314, 8], [300, -40], [314, -40], [160, -45], [190, -45], [96, -45]]) pR.pin('LR', x, y, 2.4, { h: .5, a: 1.1 });
    pR.fill('LR', K.rrect(36, -30, 286, -20, 4), { h: .38, a: 1.05 }); pR.line('LR', [[292, -50], [292, 16]], .5, { h: -.7, a: .6 });
    pR.text('L', spec.produttore.toUpperCase(), 120, 5, 4.4, { spacing: 6 }); pR.text('L', sn, 230, -40, 3.2);
    pR.text('R', spec.nome.toUpperCase(), 116, 5, 4.4, { spacing: 6 }); pR.text('R', spec.calibro || '', 116, -40, 3.2);
    pR.noise({ a: .12, r: .18, seed: 17 }); pR.walls({ r: .48 });
    const mR = K.mat('nero', pR.done(2.4), { ns: .85 });
    const rL = [[0, -50, 2, .5], [324, -50, 1.5, .5], [330, -42, 1, .5], [330, 16, 0, .5], [292, 16, 0, .4], [292, 2, 1.5, .3], [200, 2, 1.5, .3], [200, 16, 0, .4], [0, 16, 0, .5]];
    const rR = [[0, -50, 2, .5], [324, -50, 1.5, .5], [330, -42, 1, .5], [330, 16, 0, .5], [288, 16, 0, .4], [288, 6, 1.5, .3], [210, 6, 1.5, .3], [210, 16, 0, .4], [0, 16, 0, .5]];
    A.add(K.slab(rL, -hw, 0, { bL: 1.6, bR: 0, uv: rb }), mR);
    A.add(K.slab(rR, 0, hw, { bL: 0, bR: 1.6, uv: rb }), mR);
    A.add(K.box(200, .4, -hw + 1, 292, 2.4, -1, .3, 0), mDark); A.add(K.box(210, 4.4, 1, 288, 6.4, hw - 1, .3, 0), mDark);
    A.add(K.box(-8, -48, -21, 2, 14, 21, 1.5, 3), mSt);
    A.add(K.box(6, -62, -15, 170, -49, 15, 1.2, 3), mSt);
    A.add(K.box(210, -50.5, -12, 300, -40, 12, .6, 2), K.mat('brunito', null, { r: .3 }), 'otturatore'); A.pivot('otturatore', [255, -45, 0]);
    A.add(K.slab([[244, -20, 2], [318, -20, 2], [318, -8, 2], [244, -8, 2]], hw - .5, hw + 2, { b: .5 }), mSt);
    A.add(lungo(K.rod(0, 22, 4, { seg: 14 }), [296, -14, hw], [0, 0, 1]), mSt, 'manetta');
    A.add(lungo(K.rod(0, 34, 5.5, { seg: 16 }), [296, -31, hw + 21], [0, 1, 0]), mSt, 'manetta');
    A.pivot('manetta', [296, -14, hw]);
    // ---------------- coperchio (cerniera davanti) col rilievo dell'alimentatore
    const cov = [[96, 16, 0, .5], [318, 16, 0, .5], [322, 24, 3, .8], [314, 34, 5, 1], [268, 38, 8, 1], [212, 37, 8, 1], [150, 33, 8, 1], [104, 29, 4, 1], [96, 22, 2, .6]];
    A.add(K.slab(cov, -hw + .5, hw - .5, { b: 2.4 }), mSt, 'coperchio');
    A.add(K.loftX([{ x: 214, t: 44, b: 30, w: 15 }, { x: 222, t: 46, b: 30, w: 17 }, { x: 286, t: 44, b: 30, w: 17 }, { x: 296, t: 40, b: 30, w: 14 }].map(s => Object.assign({ nt: 3, nb: 10 }, s)), { K: 26, step: 0 }), mSt, 'coperchio');
    A.add(K.box(92, 17, -11, 104, 27, 11, 1, 2), mSt, 'coperchio');
    A.add(lungo(K.rod(0, 2 * hw, 3, { seg: 12 }), [316, 26, -hw], [0, 0, 1]), mSt);
    A.pivot('coperchio', [316, 26, 0]);
    // ---------------- camicia forata con finestra per il cambio della canna, alzo, mirino, rafforzatore di bocca
    const R = 26, foro = (i, j, x, a) => { const s = Math.sin(a); return Math.abs(Math.cos(a)) > .97 && Math.cos(a) < 0 ? null : { w: 15, h: 5.2, n: 2.6 }; };
    A.add(K.latheX([[328, 0], [328, 23], [330, 24.6], [338, 24.6], [338, 0]], { seg: 36 }), mSt);
    A.add(forata({ x0: 338, x1: 566, r: R, t: 1.6, nx: 5, na: 9, a0: PI / 2 + .62, a1: PI / 2 - .62 + 2 * PI, m: 2, foro }), mSt);
    A.add(forata({ x0: 566, x1: 794, r: R, t: 1.6, nx: 5, na: 12, m: 2, foro }), mSt);
    A.add(K.latheX([[792, 0], [792, R], [794, R + 1.4], [818, R + 1.4], [822, R - 2], [822, 0]], { seg: 36 }), mSt);
    A.add(K.latheX([[330, 0], [330, 12], [800, 10.5], [800, 0]], { seg: 22 }), mBar);
    A.add(K.slab([[336, 22, 0], [378, 22, 0], [378, 30, 2], [342, 33, 2]], -12, 12, { b: 1 }), mSt);
    A.add(K.slab([[344, 31, 1], [404, 31, 1], [404, 34, 1], [348, 35.5, 1]], -7, 7, { b: .5 }), mSt);
    A.add(K.slabX([[-7, 33, .5], [7, 33, .5], [7, 41, .8], [1.4, 41, .3], [1.4, 37.5, .5], [-1.4, 37.5, .5], [-1.4, 41, .3], [-7, 41, .8]], 340, 346, { b: .4 }), mSt);
    A.add(K.slab([[776, 24, 0], [800, 24, 0], [798, 32, 2], [778, 32, 2]], -8, 8, { b: .8 }), mSt);
    for (const s of [-1, 1]) A.add(K.slab([[780, 30, 0], [796, 30, 0], [795, 48, 3], [781, 48, 3]], s > 0 ? 4.5 : -7.5, s > 0 ? 7.5 : -4.5, { b: .6 }), mSt);
    A.add(K.slab([[785, 30, 0], [791, 30, 0], [790.4, 45, .6], [785.6, 45, .6]], -1.3, 1.3, { b: .3 }), mSt);
    A.add(K.latheX([[820, 0], [820, 20], [824, 22], [858, 22], [862, 18.5], [868, 17], [868, 0]], { seg: 30 }), mSt);
    A.add(forata({ x0: 866, x1: 906, r: 19, t: 2.6, nx: 1, na: 8, m: 1, foro: () => ({ w: 12, h: 3.6, n: 4, u: 3 }) }), mSt);
    A.add(K.discX(868.2, 0, 0, 6, 1, 16), mDark);
    bipiede(A, { x: 770, ya: 0, rc: R + .5, yh: -36, len: 300, r: 5.5, piede: 'piatto', apre: .22, avanti: .1, mat: mSt });
    // ---------------- impugnatura, ponticello, grilletto
    impugnatura(A, { x: 50, y: -60, ang: .3, len: 104, f0: 13, f1: 15, r0: 15, r1: 17, w0: 13.5, w1: 14.6, dita: 1.8, mat: matImp() });
    A.add(K.slab([[72, -61, 0], [150, -61, 0], [152, -69, 3], [142, -96, 7], [88, -98, 9], [72, -82, 5]], -6, 6, { b: 1, holes: [[[83, -67, 3], [140, -67, 3], [135, -90, 6], [90, -91, 7]]] }), mSt);
    A.add(K.slab([[98, -61, 1], [105, -61, 1], [104, -70, 4], [100, -84, 1.2], [95.5, -83.5, 1.2], [99.5, -71, 4]], -3, 3, { b: .6 }), mSt, 'grilletto');
    A.pivot('grilletto', [102, -62, 0]);
    // ---------------- calcio in polimero inclinato con appoggio ribaltabile
    A.add(calcioPieno([[-262, -18, -142, 20], [-250, -14, -140, 20], [-140, -2, -108, 19], [-40, 9, -64, 17], [2, 13, -48, 16]], { nt: 2.8 }), mPol);
    A.add(K.slab([[-270, -16, 3], [-262, -16, 0], [-262, -142, 0], [-270, -142, 3]], -20, 20, { b: 1.6 }), mSt);
    A.add(K.slab([[-274, -18, 2], [-268, -18, 2], [-266, 6, 3], [-272, 6, 3]], -12, 12, { b: 1 }), mSt);
    WC.put(A, WC.swivel(-180, -118, 0, { r: 8 }));
    // ---------------- nastro libero a sinistra
    nastro(A, { cal: 'c762', pts: [[212, 9, -8], [212, 9, -30], [212, -2, -44], [212, -26, -50], [212, -70, -52], [212, -120, -48], [212, -170, -42]], traccianti: 5 });
    A.pivot('nastro', [212, 9, -8]);
    A.anchor('bocca', [907, 0, 0]); A.anchor('espulsione', [255, -52, 0], [0, -1, .1]); A.anchor('impugnatura', [34, -106, 0]); A.anchor('grilletto', [100, -78, 0]);
    A.anchor('appoggio', [560, -34, -10]); A.anchor('mira_post', [343, 41, 0]); A.anchor('mira_ant', [788, 45, 0]); A.anchor('calcio', [-268, -80, 0]);
    const r = A.done();
    r.info = { azione: 'auto', bossolo: 'fucile_lungo', ciclo: { otturatore: { dx: -.07 }, grilletto: { rz: -.15 } },
      ricarica: { coperchio: { rz: -1.2 }, manetta: { dx: -.1 }, nastro: { dy: -.08 } }, piega: { bipiede: { rz: -1.45 } } };
    return r;
  };
  MAP2[150] = { f: 'mtr_media_camicia_forata', o: {} };

  // ================================================================ mitragliatrice pesante a impugnature a vanghe (cal. 12,7, alimentazione da
  // sinistra): culatta a cassetta rivettata, supporto della canna forato, canna pesante con maniglia, slitta d'armamento a destra,
  // cassetta delle munizioni a sinistra, treppiede basso con barra di brandeggio e congegno di elevazione
  FAM2.mtr_pesante_vanghe = function (spec, o) {
    o = o || {};
    const K = WK2, A = K.asm('mtr_pesante_vanghe'), sn = serie(spec), hw = 56;
    const mSt = K.mat('parker'), mDark = K.mat('nero_lucido', null, { c: '#050505', r: .7 }), mBar = K.mat('parker', null, { c: '#2b2d2b', r: .5 });
    // ---------------- scatola di culatta: x 0..600, y -100..40
    const rb = [0, -102, 602, 42];
    const pR = K.painter(rb, { w: 1024, h: 512, rough: .62 });
    rivetti(pR, 'LR', 14, 588, 33, 16, 3.2); rivetti(pR, 'LR', 14, 588, -93, 16, 3.2);
    for (const [x, y] of [[530, 12], [530, -18], [530, -48], [560, 12], [560, -18], [560, -48], [586, -3], [586, -36], [24, 4], [24, -40]]) pR.pin('LR', x, y, 3.6, { h: .5, a: 1.1 });
    pR.line('LR', [[512, -100], [512, 40]], .6, { h: -.7, a: .6 }); pR.line('LR', [[42, -100], [42, 40]], .6, { h: -.7, a: .6 });
    pR.fill('L', K.rrect(170, -76, 400, -20, 3), { h: .25, a: .96 }); pR.line('L', K.rrect(170, -76, 400, -20, 3), .5, { h: -.6, a: .7 }, true);
    pR.text('L', spec.produttore.toUpperCase(), 285, -32, 8, { spacing: 10 }); pR.text('L', spec.nome.toUpperCase() + '   ' + (spec.calibro || ''), 285, -50, 5);
    pR.text('L', sn, 285, -65, 5); pR.text('R', spec.nome.toUpperCase(), 420, -78, 6, { spacing: 8 });
    pR.noise({ a: .14, r: .2, seed: 19 }); pR.walls({ r: .6 });
    const mR = K.mat('parker', pR.done(2.4), { ns: .85 });
    const rL = [[0, -100, 2, .5], [600, -100, 2, .5], [600, 40, 0, .5], [482, 40, 0, .4], [482, 8, 2, .3], [326, 8, 2, .3], [326, 40, 0, .4], [0, 40, 0, .5]];
    const rR = [[0, -100, 2, .5], [600, -100, 2, .5], [600, 40, 0, .5], [472, 40, 0, .4], [472, 14, 2, .3], [340, 14, 2, .3], [340, 40, 0, .4], [0, 40, 0, .5]];
    A.add(K.slab(rL, -hw, 0, { bL: 2.4, bR: 0, uv: rb }), mR);
    A.add(K.slab(rR, 0, hw, { bL: 0, bR: 2.4, uv: rb }), mR);
    A.add(K.box(326, 5, -hw + 1, 482, 8.4, -1, .3, 0), mDark); A.add(K.box(340, 11, 1, 472, 14.4, hw - 1, .3, 0), mDark);
    A.add(K.box(518, -120, -24, 584, -98, 24, 2, 4), mSt);                                     // attacco anteriore del perno
    A.add(K.box(14, -114, -16, 64, -98, 16, 1.5, 3), mSt);                                     // attacco posteriore dell'elevazione
    vanghe(A, { x: 0, y0: -98, y1: -14, z: 50, r: 15, d: 80, mat: mSt, matI: K.mat('legno_scuro'), yg: -2 });
    A.add(K.box(-14, 22, -10, 2, 38, 10, 1.5, 3), mSt);                                       // sgancio dell'otturatore
    // slitta d'armamento a destra con la sua impugnatura (manetta: non si muove sparando)
    A.add(K.slab([[118, -62, 3], [312, -62, 3], [312, -12, 3], [118, -12, 3]], hw - .5, hw + 4, { b: 1.2 }), mSt);
    A.add(K.box(128, -42, hw + 3, 300, -32, hw + 6, .8, 2), mDark);
    A.add(lungo(K.rod(0, 30, 6, { seg: 14 }), [186, -37, hw + 3], [0, 0, 1]), mSt, 'manetta');
    A.add(verticale([[-62, 0], [-62, 9], [-58, 12], [-16, 12], [-12, 9], [-12, 0]], 186, hw + 32, 18), mSt, 'manetta');
    A.pivot('manetta', [186, -37, hw]);
    A.add(K.box(360, -99.5, -16, 470, -88, 16, .8, 2), K.mat('parker', null, { c: '#1e201e', r: .4 }), 'otturatore'); A.pivot('otturatore', [415, -92, 0]);
    // ---------------- coperchio (cerniera davanti) e alzo a foglia sul retro
    const cov = [[220, 40, 0, .5], [596, 40, 0, .5], [598, 50, 4, .8], [588, 64, 6, 1], [252, 66, 8, 1], [228, 60, 6, 1], [220, 50, 3, .6]];
    A.add(K.slab(cov, -hw + 2, hw - 2, { b: 3 }), mSt, 'coperchio');
    A.add(K.box(224, 56, -12, 248, 72, 12, 1.5, 3), mSt, 'coperchio');
    A.add(K.box(300, 63, -16, 560, 68.5, 16, 1.4, 3), mSt, 'coperchio');
    A.add(lungo(K.rod(0, 2 * hw - 2, 4.4, { seg: 14 }), [590, 54, -hw + 1], [0, 0, 1]), mSt);
    A.pivot('coperchio', [590, 54, 0]);
    A.add(K.slab([[34, 40, 0], [122, 40, 0], [122, 47, 3], [42, 50, 3]], -17, 17, { b: 1.2 }), mSt);
    A.add(K.slab([[52, 48, 1], [146, 48, 1], [146, 52, 1], [56, 54, 1]], -9, 9, { b: .6 }), mSt);
    A.add(K.slabX([[-9, 51, .5], [9, 51, .5], [9, 61, .8], [1.8, 61, .3], [1.8, 56, .5], [-1.8, 56, .5], [-1.8, 61, .3], [-9, 61, .8]], 50, 58, { b: .5 }), mSt);
    // ---------------- supporto forato della canna, canna pesante, maniglia, mirino, spegnifiamma
    A.add(K.latheX([[598, 0], [598, 36], [602, 38], [614, 38], [616, 34.5], [616, 0]], { seg: 32 }), mSt);
    A.add(forata({ x0: 616, x1: 776, r: 34.5, t: 2.4, nx: 6, na: 10, m: 2, foro: (i, j, x, a) => Math.cos(a) < -.8 ? null : { w: 7.4, h: 7.4, n: 2 } }), mSt);
    A.add(K.latheX([[774, 0], [774, 34.5], [776, 36], [796, 36], [800, 31], [800, 0]], { seg: 32 }), mSt);
    A.add(K.latheX([[600, 0], [600, 23], [800, 22.4], [804, 25], [832, 25], [836, 22.2], [1540, 19.2], [1542, 0]], { seg: 28 }), mBar);
    A.add(K.latheX([[1538, 0], [1538, 21], [1541, 22.5], [1558, 22.5], [1579, 25], [1579, 11], [1572, 9.5], [1572, 0]], { seg: 28 }), mSt);
    A.add(K.discX(1572.3, 0, 0, 7, 1, 18), mDark);
    A.add(K.slab([[776, 32, 0], [798, 32, 0], [796, 44, 2], [778, 44, 2]], -11, 11, { b: 1 }), mSt);
    for (const s of [-1, 1]) A.add(K.slab([[780, 40, 0], [794, 40, 0], [793, 62, 3], [781, 62, 3]], s > 0 ? 5 : -9, s > 0 ? 9 : -5, { b: .7 }), mSt);
    A.add(K.slab([[784, 42, 0], [790, 42, 0], [789.4, 60, .6], [784.6, 60, .6]], -1.6, 1.6, { b: .3 }), mSt);
    maniglia(A, { x: 872, xa: 830, xb: 950, y: 0, rc: 22, h: 70, ri: 11, mat: mSt, matI: K.mat('polimero') });
    // ---------------- cassetta delle munizioni a sinistra e nastro che sale nella via di alimentazione
    const mCan = K.mat('oliva', null, { c: '#40452f', r: .62 });
    scatola(A, { x0: 296, x1: 566, y0: -252, y1: -66, z0: -188, z1: -84, mat: mCan, nerv: 3 });
    A.add(K.box(310, -66.6, -152, 500, -65, -112, .3, 2), mDark, 'caricatore');
    A.add(K.box(400, -96, -86, 470, -76, -54, 1, 2), mSt, 'caricatore');
    nastro(A, { cal: 'c127', pts: [[335, 24, -38], [335, 24, -66], [335, 6, -92], [335, -24, -112], [335, -52, -128], [335, -74, -134]], anelli: [[.12, 10], [.55, 16]], traccianti: 5 });
    A.pivot('nastro', [335, 24, -40]); A.pivot('caricatore', [430, -66, -136]);
    // ---------------- treppiede basso
    treppiede(A, { testa: [545, -160], yt: -390, ant: 1120, post: [-180, 360], r: 15, mat: K.mat('parker', null, { c: '#383b32', r: .62 }), perno: -118, barra: .72, te: -112 });
    A.anchor('bocca', [1580, 0, 0]); A.anchor('espulsione', [415, -102, 0], [0, -1, 0]); A.anchor('impugnatura', [-80, -56, 50]); A.anchor('grilletto', [-44, -10, 0]);
    A.anchor('appoggio', [-80, -56, -50]); A.anchor('mira_post', [54, 60, 0]); A.anchor('mira_ant', [787, 60, 0]);
    const r = A.done();
    r.info = { azione: 'auto', bossolo: 'pesante', ciclo: { otturatore: { dx: -.06 }, grilletto: { rz: -.12 } },
      ricarica: { coperchio: { rz: -1.0 }, manetta: { dx: -.12 }, caricatore: { dy: -.05, dz: -.06 }, nastro: { dy: -.05, dz: -.06 } } };
    return r;
  };
  MAP2[156] = { f: 'mtr_pesante_vanghe', o: {} };

  // ================================================================ mitragliatrice pesante con alette di raffreddamento (cal. 12,7, alimentazione
  // da sinistra): canna con radiatore ad alette, freno di bocca piatto a finestre, coperchio con leva d'alimentazione, impugnature a vanghe, treppiede
  FAM2.mtr_pesante_alette = function (spec, o) {
    o = o || {};
    const K = WK2, A = K.asm('mtr_pesante_alette'), sn = serie(spec), hw = 38;
    const mSt = K.mat('verde'), mMet = K.mat('nero', null, { r: .45 }), mDark = K.mat('nero_lucido', null, { c: '#050505', r: .7 }), mBar = K.mat('brunito', null, { r: .38 });
    // ---------------- scatola di culatta: x 0..470, y -66..30
    const rb = [0, -68, 472, 32];
    const pR = K.painter(rb, { w: 1024, h: 512, rough: .58 });
    rivetti(pR, 'LR', 12, 460, 24, 14, 2.8); rivetti(pR, 'LR', 12, 460, -60, 14, 2.8);
    for (const [x, y] of [[430, 6], [430, -20], [430, -44], [452, 6], [452, -20], [452, -44], [24, -4], [24, -36]]) pR.pin('LR', x, y, 3.2, { h: .5, a: 1.1 });
    pR.line('LR', [[414, -66], [414, 30]], .6, { h: -.7, a: .6 }); pR.fill('LR', K.rrect(46, -46, 400, -34, 3), { h: .3, a: 1.04 });
    pR.text('L', spec.produttore.toUpperCase(), 200, -10, 6, { spacing: 8 }); pR.text('L', sn, 200, -22, 4);
    pR.text('R', spec.nome.toUpperCase(), 160, -10, 6, { spacing: 8 }); pR.text('R', spec.calibro || '', 160, -22, 4);
    pR.noise({ a: .16, r: .2, seed: 23 }); pR.walls({ r: .6 });
    const mR = K.mat('verde', pR.done(2.4), { ns: .85 });
    const rL = [[0, -66, 2, .5], [470, -66, 2, .5], [470, 30, 0, .5], [440, 30, 0, .4], [440, 6, 2, .3], [272, 6, 2, .3], [272, 30, 0, .4], [0, 30, 0, .5]];
    const rR = [[0, -66, 2, .5], [470, -66, 2, .5], [470, 30, 0, .5], [424, 30, 0, .4], [424, 12, 2, .3], [292, 12, 2, .3], [292, 30, 0, .4], [0, 30, 0, .5]];
    A.add(K.slab(rL, -hw, 0, { bL: 2, bR: 0, uv: rb }), mR);
    A.add(K.slab(rR, 0, hw, { bL: 0, bR: 2, uv: rb }), mR);
    A.add(K.box(272, 3, -hw + 1, 440, 6.4, -1, .3, 0), mDark); A.add(K.box(292, 9, 1, 424, 12.4, hw - 1, .3, 0), mDark);
    A.add(K.box(380, -84, -18, 446, -64, 18, 2, 4), mSt); A.add(K.box(30, -80, -14, 80, -64, 14, 1.5, 3), mSt);
    vanghe(A, { x: 0, y0: -84, y1: -12, z: 44, r: 14, d: 78, mat: mSt, matI: K.mat('legno_scuro'), yg: 2 });
    // manetta di armamento in basso a destra, solidale col carrello (si muove sparando)
    A.add(K.box(150, -60, hw - .5, 360, -46, hw + 2, .5, 2), mDark);
    A.add(lungo(K.rod(0, 26, 5, { seg: 14 }), [330, -53, hw - 2], [0, 0, 1]), mMet, 'otturatore');
    A.add(lungo(K.latheX([[0, 0], [0, 7], [3, 9.5], [22, 9.5], [25, 7], [25, 0]], { seg: 18 }), [330, -53, hw + 22], [0, 0, 1]), mMet, 'otturatore');
    A.pivot('otturatore', [330, -53, 0]);
    // ---------------- coperchio con la leva d'alimentazione a destra e alzo a quadro
    const cov = [[150, 30, 0, .5], [452, 30, 0, .5], [454, 40, 3, .8], [446, 52, 5, 1], [182, 54, 8, 1], [160, 48, 6, 1], [150, 38, 3, .6]];
    A.add(K.slab(cov, -hw + 1.5, hw - 1.5, { b: 2.6 }), mSt, 'coperchio');
    A.add(K.slab([[196, 38, 3], [430, 40, 4], [446, 46, 4], [440, 54, 3], [204, 50, 4]], hw - 1, hw + 5, { b: 1.2 }), mSt, 'coperchio');
    A.add(lungo(K.rod(0, 12, 9, { seg: 16 }), [434, 46, hw - 2], [0, 0, 1]), mSt, 'coperchio');
    A.add(K.box(146, 32, -12, 162, 46, 12, 1, 2), mSt, 'coperchio');
    A.add(lungo(K.rod(0, 2 * hw, 4, { seg: 14 }), [448, 44, -hw], [0, 0, 1]), mSt);
    A.pivot('coperchio', [448, 44, 0]);
    A.add(K.slab([[30, 30, 0], [104, 30, 0], [104, 37, 3], [36, 40, 3]], -14, 14, { b: 1.2 }), mSt);
    for (const s of [-1, 1]) A.add(K.slab([[44, 36, 1], [58, 36, 1], [56, 58, 2], [46, 58, 2]], s > 0 ? 6 : -10, s > 0 ? 10 : -6, { b: .6 }), mSt);
    A.add(K.slab([[44, 52, 1], [58, 52, 1], [58, 60, 1], [44, 60, 1]], -10, 10, { b: .6, holes: [K.circ(51, 56, 1.6, 10)] }), mSt);
    // ---------------- canna con radiatore, cilindro del gas, maniglia, mirino, freno di bocca
    A.add(K.latheX([[466, 0], [466, 26], [470, 28], [478, 28], [480, 21], [480, 0]], { seg: 28 }), mMet);
    A.add(alette(480, 902, 34, 21, 37, 3.4, 22), mBar);
    A.add(K.latheX([[476, 0], [476, 21], [906, 21], [910, 19.5], [1428, 16.8], [1430, 0]], { seg: 24 }), mBar);
    A.add(K.latheX([[470, 0], [470, 13], [1180, 13], [1182, 0]], { seg: 20, cy: -42 }), mMet);
    A.add(K.slab([[1166, -54, 2], [1206, -54, 2], [1206, -12, 2], [1196, 6, 3], [1176, 6, 3], [1166, -12, 2]], -14, 14, { b: 1.5 }), mMet);
    A.add(K.latheX([[1206, 0], [1206, 11], [1208, 12.5], [1232, 12.5], [1234, 10], [1234, 0]], { seg: 20, cy: -42 }), mMet);
    A.add(K.latheX([[1352, 16.8], [1352, 21], [1354, 22.5], [1392, 22.5], [1394, 21], [1394, 16.8]], { seg: 24 }), mMet);
    A.add(K.slab([[1356, 18, 0], [1390, 18, 0], [1388, 36, 3], [1358, 36, 3]], -9, 9, { b: 1 }), mMet);
    for (const s of [-1, 1]) A.add(K.slab([[1360, 32, 0], [1386, 32, 0], [1384, 60, 4], [1362, 60, 4]], s > 0 ? 5.5 : -9.5, s > 0 ? 9.5 : -5.5, { b: .7 }), mMet);
    A.add(K.slab([[1370, 34, 0], [1376, 34, 0], [1375.4, 56, .6], [1370.6, 56, .6]], -1.6, 1.6, { b: .3 }), mMet);
    A.add(K.latheX([[1426, 0], [1426, 18], [1430, 22], [1446, 22], [1448, 26], [1448, 0]], { seg: 28 }), mMet);
    A.add(forata({ x0: 1448, x1: 1532, r: 31, t: 4, nx: 2, na: 4, a0: -PI / 4, m: 2, foro: (i, j) => j % 2 ? { w: 13, h: 15, n: 6 } : null }), mMet);
    A.add(K.latheX([[1530, 0], [1530, 31], [1532, 32], [1540, 32], [1542, 30], [1542, 9], [1538, 8], [1538, 0]], { seg: 28 }), mMet);
    A.add(K.discX(1450, 0, 0, 27, 1, 24), mDark);
    maniglia(A, { x: 962, xa: 920, xb: 1032, y: 0, rc: 19.6, h: 66, ri: 11, mat: mMet, matI: K.mat('legno_scuro') });
    // ---------------- cassetta del nastro a sinistra, nastro, treppiede
    const mBox = K.mat('verde', null, { c: '#3d4630', r: .6 });
    scatola(A, { x0: 250, x1: 520, y0: -250, y1: -92, z0: -200, z1: -100, mat: mBox, nerv: 3 });
    A.add(K.box(266, -92.6, -168, 470, -91, -128, .3, 2), mDark, 'caricatore');
    A.add(K.box(330, -100, -102, 420, -80, -36, 1, 2), mSt, 'caricatore');
    nastro(A, { cal: 'c127r', pts: [[282, 16, -24], [282, 16, -50], [282, 0, -76], [282, -30, -100], [282, -66, -136], [282, -98, -148]], anelli: [[.1, 22], [.62, 14]], traccianti: 5 });
    A.pivot('nastro', [282, 16, -26]); A.pivot('caricatore', [390, -92, -150]);
    treppiede(A, { testa: [400, -150], yt: -410, ant: 1050, post: [-220, 360], r: 13, mat: K.mat('verde', null, { c: '#3a432e', r: .6 }), perno: -84, barra: .58, te: -80 });
    A.anchor('bocca', [1542, 0, 0]); A.anchor('espulsione', [360, -68, 0], [0, -1, 0]); A.anchor('impugnatura', [-78, -48, 44]); A.anchor('grilletto', [-40, -4, 0]);
    A.anchor('appoggio', [-78, -48, -44]); A.anchor('mira_post', [51, 56, 0]); A.anchor('mira_ant', [1373, 56, 0]);
    const r = A.done();
    r.info = { azione: 'auto', bossolo: 'pesante', ciclo: { otturatore: { dx: -.07 }, grilletto: { rz: -.12 } },
      ricarica: { coperchio: { rz: -1.0 }, otturatore: { dx: -.12 }, caricatore: { dy: -.05, dz: -.06 }, nastro: { dy: -.05, dz: -.06 } } };
    return r;
  };
  MAP2[157] = { f: 'mtr_pesante_alette', o: {} };

  // ================================================================ mitragliatrice pesante lunga (cal. 12,7, alimentazione da destra): culatta
  // rettangolare lunga e rivettata, canna pesante con maniglia. Variante su treppiede con culla, calcio e impugnatura dell'affusto e
  // spegnifiamma conico; variante con bipiede, calcio, impugnatura e grande freno di bocca a finestre.
  FAM2.mtr_pesante_lunga = function (spec, o) {
    o = o || {};
    const K = WK2, A = K.asm('mtr_pesante_lunga'), sn = serie(spec), hw = 34, bip = !!o.bipiede;
    const mSt = bip ? K.mat('nero', null, { r: .5 }) : K.mat('verde'), mMet = K.mat('nero', null, { r: .45 }), mDark = K.mat('nero_lucido', null, { c: '#050505', r: .7 });
    const mBar = K.mat('brunito', null, { r: .38 }), mPol = K.mat('polimero', null, { tile: 'grana', rep: [6, 3], ns: .3 });
    // ---------------- scatola di culatta: x 0..520, y -72..26
    const rb = [0, -74, 522, 28];
    const pR = K.painter(rb, { w: 1024, h: 512, rough: .55 });
    rivetti(pR, 'LR', 12, 508, 19, 18, 2.6); rivetti(pR, 'LR', 12, 508, -65, 18, 2.6);
    for (const x of [30, 470, 490]) rivetti(pR, 'LR', x, x, -50, 1, 3), rivetti(pR, 'LR', x, x, -20, 1, 3), rivetti(pR, 'LR', x, x, 4, 1, 3);
    pR.line('LR', [[456, -72], [456, 26]], .6, { h: -.7, a: .6 }); pR.line('LR', [[60, -72], [60, 26]], .6, { h: -.7, a: .6 });
    pR.fill('LR', K.rrect(80, -46, 440, -32, 3), { h: .3, a: 1.04 });
    pR.text('L', spec.produttore.toUpperCase(), 250, -12, 6.5, { spacing: 8 }); pR.text('L', sn, 250, -24, 4);
    pR.text('R', spec.nome.toUpperCase(), 160, -12, 6.5, { spacing: 8 }); pR.text('R', spec.calibro || '', 160, -24, 4);
    pR.noise({ a: .15, r: .2, seed: 29 }); pR.walls({ r: .55 });
    const mR = bip ? K.mat('nero', pR.done(2.4), { ns: .85 }) : K.mat('verde', pR.done(2.4), { ns: .85 });
    // destra: apertura di alimentazione; sinistra: uscita delle maglie
    const rL = [[0, -72, 2, .5], [512, -72, 2, .5], [520, -62, 1, .5], [520, 26, 0, .5], [444, 26, 0, .4], [444, 10, 2, .3], [322, 10, 2, .3], [322, 26, 0, .4], [0, 26, 0, .5]];
    const rR = [[0, -72, 2, .5], [512, -72, 2, .5], [520, -62, 1, .5], [520, 26, 0, .5], [470, 26, 0, .4], [470, 3, 2, .3], [300, 3, 2, .3], [300, 26, 0, .4], [0, 26, 0, .5]];
    A.add(K.slab(rL, -hw, 0, { bL: 2, bR: 0, uv: rb }), mR);
    A.add(K.slab(rR, 0, hw, { bL: 0, bR: 2, uv: rb }), mR);
    A.add(K.box(322, 7, -hw + 1, 444, 10.4, -1, .3, 0), mDark); A.add(K.box(300, 0, 1, 470, 3.4, hw - 1, .3, 0), mDark);
    A.add(K.box(-10, -68, -28, 2, 20, 28, 2, 4), mSt);
    A.add(K.box(360, -71.5, -14, 470, -60, 14, .8, 2), K.mat('brunito', null, { r: .3 }), 'otturatore'); A.pivot('otturatore', [415, -66, 0]);
    // manetta d'armamento a sinistra (non si muove sparando)
    A.add(K.box(150, -36, -hw - 3, 330, -24, -hw + .5, .6, 2), mSt);
    A.add(lungo(K.rod(0, 26, 5.5, { seg: 14 }), [300, -30, -hw + 1], [0, 0, -1]), mMet, 'manetta');
    A.add(verticale([[-58, 0], [-58, 8], [-54, 10.5], [-18, 10.5], [-14, 8], [-14, 0]], 300, -hw - 24, 18).translate(0, 14, 0), mMet, 'manetta');
    A.pivot('manetta', [300, -30, -hw]);
    // ---------------- coperchio piatto nervato (cerniera davanti) e alzo davanti
    const cov = [[110, 26, 0, .5], [498, 26, 0, .5], [500, 36, 3, .8], [492, 46, 4, 1], [136, 48, 8, 1], [116, 42, 6, 1], [110, 34, 3, .6]];
    A.add(K.slab(cov, -hw + 1.5, hw - 1.5, { b: 2.6 }), mSt, 'coperchio');
    for (const z of [-18, 0, 18]) A.add(K.box(150, 46, z - 3, 470, 50, z + 3, 1, 1.5), mSt, 'coperchio');
    A.add(K.box(106, 28, -12, 120, 42, 12, 1, 2), mSt, 'coperchio');
    A.add(lungo(K.rod(0, 2 * hw, 4, { seg: 14 }), [494, 40, -hw], [0, 0, 1]), mSt);
    A.pivot('coperchio', [494, 40, 0]);
    A.add(K.slab([[498, 26, 0], [530, 26, 0], [530, 34, 2], [504, 38, 2]], -14, 14, { b: 1 }), mSt);
    A.add(K.slab([[500, 36, 1], [560, 36, 1], [560, 39, 1], [504, 41, 1]], -8, 8, { b: .5 }), mSt);
    A.add(K.slabX([[-8, 39, .5], [8, 39, .5], [8, 48, .8], [1.6, 48, .3], [1.6, 44, .5], [-1.6, 44, .5], [-1.6, 48, .3], [-8, 48, .8]], 500, 507, { b: .4 }), mSt);
    // ---------------- canna, cilindro del gas, maniglia, mirino, dispositivo di bocca
    A.add(K.latheX([[516, 0], [516, 28], [520, 30], [548, 30], [552, 24], [560, 21], [1470, 17.5], [1472, 0]], { seg: 28 }), mBar);
    A.add(K.latheX([[518, 0], [518, 13], [984, 13], [986, 0]], { seg: 20, cy: -40 }), mMet);
    A.add(K.slab([[962, -54, 2], [1000, -54, 2], [1000, -12, 2], [990, 4, 3], [972, 4, 3], [962, -12, 2]], -13, 13, { b: 1.5 }), mMet);
    A.add(K.latheX([[1000, 0], [1000, 11], [1002, 12.5], [1024, 12.5], [1026, 10], [1026, 0]], { seg: 20, cy: -40 }), mMet);
    A.add(K.latheX([[1380, 17], [1380, 21.5], [1382, 23], [1414, 23], [1416, 21.5], [1416, 17]], { seg: 24 }), mMet);
    A.add(K.slab([[1384, 18, 0], [1412, 18, 0], [1410, 34, 3], [1386, 34, 3]], -9, 9, { b: 1 }), mMet);
    for (const s of [-1, 1]) A.add(K.slab([[1388, 30, 0], [1408, 30, 0], [1406, 52, 4], [1390, 52, 4]], s > 0 ? 5 : -9, s > 0 ? 9 : -5, { b: .7 }), mMet);
    A.add(K.slab([[1395, 32, 0], [1401, 32, 0], [1400.4, 49, .6], [1395.6, 49, .6]], -1.5, 1.5, { b: .3 }), mMet);
    maniglia(A, { x: 640, xa: 596, xb: 726, y: 0, rc: 21, h: 72, ri: 11, mat: mMet, matI: mPol });
    let xb;
    if (bip) { // grande freno di bocca a finestre
      A.add(K.latheX([[1466, 0], [1466, 19], [1470, 23], [1486, 23], [1490, 28], [1490, 0]], { seg: 28 }), mMet);
      A.add(forata({ x0: 1490, x1: 1610, r: 28, t: 3.6, nx: 4, na: 6, a0: -PI / 6, m: 2, foro: (i, j) => (j === 1 || j === 4) ? { w: 9, h: 11, n: 6 } : (j === 0 || j === 3) ? null : { w: 6, h: 6, n: 2 } }), mMet);
      A.add(K.latheX([[1608, 0], [1608, 28], [1612, 29], [1622, 29], [1624, 27], [1624, 10], [1618, 9], [1618, 0]], { seg: 28 }), mMet);
      A.add(K.discX(1492, 0, 0, 24, 1, 24), mDark); xb = 1624;
    } else { // spegnifiamma conico a feritoie
      A.add(K.latheX([[1466, 0], [1466, 19], [1470, 21], [1484, 21], [1500, 27], [1500, 0]], { seg: 28 }), mMet);
      A.add(forata({ x0: 1498, x1: 1562, r: 29, t: 2.6, nx: 1, na: 8, m: 1, foro: () => ({ w: 22, h: 4, n: 6, u: 5 }) }), mMet);
      A.add(K.discX(1501, 0, 0, 8, 1, 18), mDark); xb = 1562;
    }
    // ---------------- cassetta del nastro a destra e nastro che entra da destra
    const mBox = bip ? K.mat('parker', null, { c: '#30332c', r: .62 }) : K.mat('verde', null, { c: '#3d4630', r: .6 });
    if (bip) {
      scatola(A, { x0: 262, x1: 500, y0: -230, y1: -82, z0: 46, z1: 150, mat: mBox, nerv: 3 });
      A.add(K.box(276, -82.6, 72, 470, -81, 112, .3, 2), mDark, 'caricatore'); A.add(K.box(330, -88, 30, 420, -70, 50, 1, 2), mSt, 'caricatore');
      nastro(A, { cal: 'c127r', pts: [[312, 10, 16], [312, 10, 42], [312, -6, 66], [312, -36, 84], [312, -70, 92], [312, -88, 92]], anelli: [[.1, 22], [.62, 14]], traccianti: 5 });
      A.pivot('caricatore', [380, -82, 98]);
    } else {
      scatola(A, { x0: 262, x1: 500, y0: -280, y1: -112, z0: 54, z1: 158, mat: mBox, nerv: 3 });
      A.add(K.box(276, -112.6, 80, 470, -111, 120, .3, 2), mDark, 'caricatore');
      nastro(A, { cal: 'c127r', pts: [[312, 10, 16], [312, 10, 42], [312, -6, 66], [312, -38, 86], [312, -80, 100], [312, -118, 102]], anelli: [[.1, 22], [.62, 14]], traccianti: 5 });
      A.pivot('caricatore', [380, -112, 106]);
    }
    A.pivot('nastro', [312, 10, 18]);
    // ---------------- calcio, impugnatura, grilletto (sull'arma o sulla culla dell'affusto)
    const yb = bip ? -72 : -96;
    if (!bip) { // culla dell'affusto sotto la culatta
      A.add(K.slab([[20, -96, 3], [480, -96, 3], [490, -86, 2], [480, -72, 0], [20, -72, 0]], -30, 30, { b: 2 }), mSt);
      A.add(K.box(360, -132, -22, 440, -94, 22, 2, 4), mSt);
    }
    const gp = impugnatura(A, { x: 70, y: yb + 2, ang: .22, len: 112, f0: 14, f1: 16, r0: 16, r1: 18, w0: 14, w1: 15, dita: 1.6, mat: matImp() });
    A.add(K.slab([[92, yb, 0], [176, yb, 0], [178, yb - 8, 3], [168, yb - 36, 8], [110, yb - 38, 10], [92, yb - 22, 5]], -6.5, 6.5, { b: 1, holes: [[[104, yb - 6, 3], [166, yb - 6, 3], [160, yb - 30, 7], [112, yb - 31, 8]]] }), mSt);
    A.add(K.slab([[120, yb, 1], [127, yb, 1], [126, yb - 9, 4], [122, yb - 24, 1.2], [117.5, yb - 23.5, 1.2], [121.5, yb - 10, 4]], -3.2, 3.2, { b: .6 }), mSt, 'grilletto');
    A.pivot('grilletto', [124, yb - 1, 0]);
    // calcio a tubo con poggiaspalla in gomma e appoggio della guancia
    const xs = bip ? -330 : -300, ys = yb + 30;
    A.add(K.slab([[0, yb + 70, 3], [-8, yb + 70, 0], [-8, yb + 10, 0], [0, yb + 10, 3]], -24, 24, { b: 1.4 }), mSt);
    A.add(asta([-6, ys + 26, 0], [xs + 20, ys + 26, 0], 11, 16), mSt); A.add(asta([-6, ys - 22, 0], [xs + 20, ys - 34, 0], 9, 14), mSt);
    A.add(K.slab([[xs + 26, ys + 40, 4], [xs + 4, ys + 42, 4], [xs + 4, ys - 66, 8], [xs + 26, ys - 58, 4]], -20, 20, { b: 3 }), mSt);
    A.add(K.slab([[xs + 6, ys + 46, 6], [xs - 22, ys + 44, 10], [xs - 22, ys - 74, 12], [xs + 6, ys - 70, 6]], -26, 26, { b: 7, bs: 4 }), K.mat('gomma'));
    A.add(K.loftX([{ x: xs + 40, t: ys + 46, b: ys + 30, w: 16 }, { x: xs + 60, t: ys + 52, b: ys + 30, w: 20 }, { x: -70, t: ys + 52, b: ys + 30, w: 20 }, { x: -40, t: ys + 44, b: ys + 30, w: 16 }].map(s => Object.assign({ nt: 2.4, nb: 6 }, s)), { K: 24, step: 0 }), K.mat('gomma'));
    if (bip) bipiede(A, { x: 470, ya: -60, rc: 14, collare: false, yh: -82, len: 380, r: 7, w: 20, piede: 'piatto', apre: .28, avanti: .14, mat: mMet });
    else treppiede(A, { testa: [400, -170], yt: -430, ant: 1000, post: [-180, 360], r: 13, mat: K.mat('verde', null, { c: '#3a432e', r: .6 }), perno: -130 });
    A.anchor('bocca', [xb + 1, 0, 0]); A.anchor('espulsione', [415, -74, 0], [.3, -1, 0]); A.anchor('impugnatura', [gp[0] + 12, yb - 52, 0]); A.anchor('grilletto', [122, yb - 16, 0]);
    A.anchor('appoggio', bip ? [-60, ys - 30, -14] : [-60, ys - 30, -14]); A.anchor('mira_post', [503, 48, 0]); A.anchor('mira_ant', [1398, 49, 0]); A.anchor('calcio', [xs - 22, ys - 14, 0]);
    const r = A.done();
    r.info = { azione: 'auto', bossolo: 'pesante', ciclo: { otturatore: { dx: -.07 }, grilletto: { rz: -.15 } },
      ricarica: { coperchio: { rz: -1.0 }, manetta: { dx: -.12 }, caricatore: { dy: -.05, dz: .06 }, nastro: { dy: -.05, dz: .06 } } };
    if (bip) r.info.piega = { bipiede: { rz: 1.4 } };
    return r;
  };
  MAP2[154] = { f: 'mtr_pesante_lunga', o: { bipiede: false } };
  MAP2[155] = { f: 'mtr_pesante_lunga', o: { bipiede: true } };

  // ================================================================ mitragliatrice media su treppiede (raffreddata ad aria, alimentazione da
  // sinistra): culatta a cassetta, camicia forata a fori tondi, rafforzatore di bocca conico, impugnatura a pistola sulla piastra posteriore
  FAM2.mtr_media_treppiede = function (spec, o) {
    o = o || {};
    const K = WK2, A = K.asm('mtr_media_treppiede'), sn = serie(spec), hw = 32;
    const mSt = K.mat('parker'), mDark = K.mat('nero_lucido', null, { c: '#050505', r: .7 }), mBar = K.mat('parker', null, { c: '#2b2d2b', r: .5 });
    // ---------------- scatola di culatta: x 0..400, y -60..30
    const rb = [0, -62, 402, 32];
    const pR = K.painter(rb, { w: 1024, h: 512, rough: .62 });
    rivetti(pR, 'LR', 12, 388, 24, 13, 2.4); rivetti(pR, 'LR', 12, 388, -54, 13, 2.4);
    for (const [x, y] of [[352, 6], [352, -24], [376, 6], [376, -24], [20, -6], [20, -32]]) pR.pin('LR', x, y, 2.8, { h: .5, a: 1.1 });
    pR.line('LR', [[338, -60], [338, 30]], .5, { h: -.7, a: .6 });
    pR.fill('L', K.rrect(110, -46, 300, -6, 3), { h: .25, a: .96 }); pR.line('L', K.rrect(110, -46, 300, -6, 3), .45, { h: -.6, a: .7 }, true);
    pR.text('L', spec.produttore.toUpperCase(), 205, -15, 5.6, { spacing: 7 }); pR.text('L', spec.nome.toUpperCase() + '  ' + (spec.calibro || ''), 205, -27, 3.8);
    pR.text('L', sn, 205, -38, 3.8);
    pR.noise({ a: .14, r: .2, seed: 31 }); pR.walls({ r: .6 });
    const mR = K.mat('parker', pR.done(2.4), { ns: .85 });
    const rL = [[0, -60, 2, .5], [400, -60, 2, .5], [400, 30, 0, .5], [330, 30, 0, .4], [330, 8, 2, .3], [222, 8, 2, .3], [222, 30, 0, .4], [0, 30, 0, .5]];
    const rR = [[0, -60, 2, .5], [400, -60, 2, .5], [400, 30, 0, .5], [318, 30, 0, .4], [318, 14, 2, .3], [236, 14, 2, .3], [236, 30, 0, .4], [0, 30, 0, .5]];
    A.add(K.slab(rL, -hw, 0, { bL: 2, bR: 0, uv: rb }), mR);
    A.add(K.slab(rR, 0, hw, { bL: 0, bR: 2, uv: rb }), mR);
    A.add(K.box(222, 5, -hw + 1, 330, 8.4, -1, .3, 0), mDark); A.add(K.box(236, 11, 1, 318, 14.4, hw - 1, .3, 0), mDark);
    A.add(K.box(360, -78, -18, 400, -58, 18, 1.5, 3), mSt);
    // piastra posteriore con impugnatura a pistola in legno e grilletto sotto il retro della culatta
    A.add(K.slab([[-16, -60, 3], [2, -60, 0], [2, 30, 0], [-16, 30, 4]], -hw + 2, hw - 2, { b: 2 }), mSt);
    const gp = impugnatura(A, { x: -16, y: -40, ang: .5, len: 104, f0: 14, f1: 15, r0: 15, r1: 17, w0: 14, w1: 15, mat: K.mat('legno_noce') });
    A.add(K.slab([[-10, -42, 2], [24, -58, 2], [26, -66, 2], [-12, -60, 2]], -10, 10, { b: 1 }), mSt);
    A.add(K.slab([[10, -60, 1], [17, -60, 1], [16, -69, 3], [12, -80, 1]], -3.2, 3.2, { b: .6 }), mSt, 'grilletto');
    A.pivot('grilletto', [14, -60, 0]);
    // manetta dell'otturatore a destra (si muove col carrello)
    A.add(K.box(80, -18, hw - .5, 250, -8, hw + 1.5, .4, 2), mDark);
    A.add(lungo(K.rod(0, 18, 4, { seg: 12 }), [210, -13, hw - 1], [0, 0, 1]), mSt, 'otturatore');
    A.add(lungo(K.latheX([[0, 0], [0, 6], [2, 7.5], [10, 7.5], [12, 5.5], [12, 0]], { seg: 16 }), [210, -13, hw + 16], [0, 0, 1]), mSt, 'otturatore');
    A.pivot('otturatore', [210, -13, 0]);
    // ---------------- coperchio (cerniera davanti) e alzo laterale a sinistra
    const cov = [[60, 30, 0, .5], [392, 30, 0, .5], [394, 38, 3, .8], [386, 48, 4, 1], [86, 50, 8, 1], [66, 44, 6, 1], [60, 36, 3, .6]];
    A.add(K.slab(cov, -hw + 1.5, hw - 1.5, { b: 2.4 }), mSt, 'coperchio');
    A.add(K.box(56, 32, -12, 70, 46, 12, 1, 2), mSt, 'coperchio');
    A.add(lungo(K.rod(0, 2 * hw, 3.6, { seg: 14 }), [388, 40, -hw], [0, 0, 1]), mSt);
    A.pivot('coperchio', [388, 40, 0]);
    A.add(K.slab([[18, 20, 2], [72, 20, 2], [72, 38, 2], [18, 34, 2]], -hw - 9, -hw + .5, { b: .8 }), mSt);
    A.add(K.slab([[30, 36, 1], [44, 36, 1], [43, 60, 2], [31, 60, 2]], -hw - 8, -hw - 2, { b: .6, holes: [K.circ(37, 55, 1.6, 10)] }), mSt);
    // ---------------- camicia forata, cuscinetto anteriore col mirino, rafforzatore di bocca
    A.add(K.latheX([[398, 0], [398, 24.5], [400, 26], [414, 26], [416, 22.5], [416, 0]], { seg: 32 }), mSt);
    A.add(forata({ x0: 416, x1: 896, r: 22.5, t: 1.5, nx: 16, na: 8, m: 2, foro: (i, j, x, a) => ({ w: 6.2, h: 6.2, n: 2 }) }), mSt);
    A.add(K.latheX([[400, 0], [400, 12], [930, 10.5], [930, 0]], { seg: 20 }), mBar);
    A.add(K.latheX([[894, 0], [894, 22.5], [896, 24], [922, 24], [926, 20], [926, 0]], { seg: 32 }), mSt);
    A.add(K.slab([[898, 20, 0], [922, 20, 0], [920, 32, 2], [900, 32, 2]], -7, 7, { b: .8 }), mSt);
    A.add(K.slab([[906, 30, 0], [914, 30, 0], [913.4, 60, .8], [906.6, 60, .8]], -1.6, 1.6, { b: .4 }), mSt);
    A.add(K.latheX([[924, 0], [924, 14], [928, 15], [968, 20], [972, 20], [972, 8], [966, 7], [966, 0]], { seg: 28 }), mSt);
    A.add(K.discX(966.3, 0, 0, 6, 1, 16), mDark);
    // ---------------- nastro libero a sinistra, treppiede basso
    nastro(A, { cal: 'c762l', pts: [[232, 19, -12], [232, 19, -38], [232, 6, -54], [232, -20, -62], [232, -70, -64], [232, -120, -60], [232, -170, -54]], traccianti: 5 });
    A.pivot('nastro', [232, 19, -12]);
    treppiede(A, { testa: [372, -112], yt: -350, ant: 900, post: [-200, 300], r: 11, mat: K.mat('parker', null, { c: '#383b32', r: .62 }), perno: -78, barra: .6, te: -60 });
    A.anchor('bocca', [973, 0, 0]); A.anchor('espulsione', [280, -62, 0], [0, -1, 0]); A.anchor('impugnatura', [gp[0] + 30, gp[1] + 40, 0]); A.anchor('grilletto', [13, -72, 0]);
    A.anchor('appoggio', [40, -40, -hw - 20]); A.anchor('mira_post', [37, 57, -hw - 5]); A.anchor('mira_ant', [910, 60, 0]);
    const r = A.done();
    r.info = { azione: 'auto', bossolo: 'fucile_lungo', ciclo: { otturatore: { dx: -.06 }, grilletto: { rz: -.15 } },
      ricarica: { coperchio: { rz: -1.1 }, otturatore: { dx: -.08 }, nastro: { dy: -.06 } } };
    return r;
  };
  MAP2[158] = { f: 'mtr_media_treppiede', o: {} };

  // ---- contenitore a tamburo con l'asse lungo Z: centro (x, y), raggio R, mezza profondità h, smusso b
  function tamburoZ(x, y, R, h, b, seg) {
    const p = [[-h, 0], [-h, R - b], [-h + b * .3, R - b * .3], [-h + b, R], [h - b, R], [h - b * .3, R - b * .3], [h, R - b], [h, 0]];
    const g = WK2.latheX(p, { seg: seg || 40 }); g.rotateY(PI / 2); g.translate(x, y, 0); return g;
  }
  // ---- astina a nervature trasversali (anelli in rilievo): stazioni con la sezione superellittica
  function astinaNervata(x0, x1, n, t, b, w, d, o) {
    const st = [], L = (x1 - x0) / n; o = o || {};
    st.push({ x: x0, t: t - d, b: b + d * .6, w: w - d, lin: true });
    for (let i = 0; i < n; i++) { const a = x0 + i * L; st.push({ x: a + L * .12, t, b, w, lin: true }, { x: a + L * .62, t, b, w, lin: true }, { x: a + L * .74, t: t - d, b: b + d * .6, w: w - d, lin: true }, { x: a + L, t: t - d, b: b + d * .6, w: w - d, lin: true }); }
    return WK2.loftX(st.map(s => Object.assign({ nt: o.nt || 2.4, nb: o.nb || 2.6 }, s)), { K: 28, step: 0, ang: 40 });
  }

  // ================================================================ mitragliatrice leggera a doppia alimentazione (nastro o caricatore):
  // culatta in lamiera, coperchio piatto, pozzetto del caricatore inclinato a sinistra, scudo termico sopra la canna, astina sotto,
  // maniglia pieghevole, scatola portanastro in plastica agganciata sotto. Versione 5,56 con calcio fisso e versione 7,62 con calcio
  // telescopico e slitte.
  FAM2.mtr_leggera_doppia_alim = function (spec, o) {
    o = o || {};
    const K = WK2, A = K.asm('mtr_leggera_doppia_alim'), sn = serie(spec), big = o.cal === 'c762', s = big ? 1.07 : 1, hw = big ? 26 : 24;
    const mSt = K.mat('nero', null, { r: .46 }), mDark = K.mat('nero_lucido', null, { c: '#050505', r: .7 }), mBar = K.mat('parker', null, { c: '#2a2c2b', r: .45 });
    const mPol = K.mat('polimero', null, { tile: 'grana', rep: [6, 3], ns: .3 }), X = v => v * s;
    const yT = big ? 16 : 14, yB = big ? -50 : -46, xr = X(350);
    // ---------------- scatola di culatta: x 0..350, y -46..14
    const rb = [0, yB - 2, xr + 2, yT + 2];
    const pR = K.painter(rb, { w: 1024, h: 512, rough: .5 });
    for (const [x, y] of [[10, 6], [10, -36], [X(330), 6], [X(330), -36], [X(318), -14], [X(150), yB + 5], [X(180), yB + 5], [X(60), yB + 5]]) pR.pin('LR', x, y, 2.2, { h: .5, a: 1.1 });
    pR.fill('LR', K.rrect(X(24), -24, X(300), -16, 3), { h: .35, a: 1.04 }); pR.line('LR', [[X(312), yB], [X(312), yT]], .5, { h: -.7, a: .6 });
    pR.text('L', spec.produttore.toUpperCase(), X(110), 4, 4, { spacing: 5 }); pR.text('L', sn, X(110), -34, 3);
    pR.text('R', spec.nome.toUpperCase(), X(100), 4, 4.2, { spacing: 6 }); pR.text('R', spec.calibro || '', X(100), -34, 3);
    pR.noise({ a: .12, r: .18, seed: 37 }); pR.walls({ r: .48 });
    const mR = K.mat('nero', pR.done(2.4), { ns: .85 });
    const xf0 = X(196), xf1 = X(196) + (big ? 86 : 72);
    const rL = [[0, yB, 2, .5], [xr - 8, yB, 1.5, .5], [xr, yB + 8, 1, .5], [xr, yT, 0, .5], [xf1, yT, 0, .4], [xf1, 1, 1.5, .3], [xf0, 1, 1.5, .3], [xf0, yT, 0, .4], [0, yT, 0, .5]];
    const rR = [[0, yB, 2, .5], [xr - 8, yB, 1.5, .5], [xr, yB + 8, 1, .5], [xr, yT, 0, .5], [0, yT, 0, .5]];
    A.add(K.slab(rL, -hw, 0, { bL: 1.6, bR: 0, uv: rb }), mR);
    A.add(K.slab(rR, 0, hw, { bL: 0, bR: 1.6, uv: rb }), mR);
    A.add(K.box(xf0, -1, -hw + 1, xf1, 1.4, -1, .3, 0), mDark);
    A.add(K.box(-8, yB + 2, -hw + 3, 2, yT - 2, hw - 3, 1.5, 3), mSt);
    A.add(K.box(X(66), yB - 14, -15, X(212), yB + 1, 15, 1.4, 3), mPol);                     // scatola dello scatto in polimero
    // pozzetto del caricatore inclinato in basso a sinistra sotto la via del nastro (la versione 7,62 è solo a nastro)
    if (!big) A.add(K.xf(K.slab([[-24, -9, 3], [24, -9, 3], [24, 9, 3], [-24, 9, 3]], 0, 34, { b: 1.4, holes: [[[-17, -4, 1], [17, -4, 1], [17, 4, 1], [-17, 4, 1]]] }), { r: [-.75, 0, 0], t: [xf0 + 30, yB + 8, -hw + 4] }), mSt); // solo la 5,56 accetta caricatori
    // otturatore (dall'apertura di espulsione in basso) e manetta pieghevole a destra (non si muove sparando)
    A.add(K.box(X(200), yB + .5, -10, X(280), yB + 10, 10, .6, 2), K.mat('brunito', null, { r: .3 }), 'otturatore'); A.pivot('otturatore', [X(240), yB + 5, 0]);
    A.add(K.box(X(250), -20, hw - .5, X(330), -10, hw + 1.5, .5, 2), mDark);
    A.add(lungo(K.rod(0, 20, 3.6, { seg: 12 }), [X(316), -15, hw], [0, 0, 1]), mSt, 'manetta');
    A.add(lungo(K.latheX([[0, 0], [0, 4.5], [2, 6.5], [22, 6.5], [24, 4.5], [24, 0]], { seg: 16 }), [X(316), -15, hw + 18], [-1, 0, 0]).translate(12, 0, 0), mSt, 'manetta');
    A.pivot('manetta', [X(316), -15, hw]);
    // ---------------- coperchio piatto (cerniera davanti), slitta, alzo posteriore a tamburo
    const xc0 = X(108), xc1 = X(300), ct = yT + (big ? 26 : 24);
    A.add(K.slab([[xc0, yT, 0, .5], [xc1, yT, 0, .5], [xc1 + 4, yT + 8, 3, .8], [xc1 - 6, ct, 4, 1], [xc0 + 16, ct, 6, 1], [xc0, yT + 12, 4, .6]], -hw + 1, hw - 1, { b: 2.4 }), mSt, 'coperchio');
    if (o.slitte) WC.put(A, WC.rail(xc0 + 22, xc1 - 10, ct - .6), 'coperchio');
    else A.add(K.box(xc0 + 30, ct - 1, -8, xc1 - 20, ct + 2.5, 8, 1, 2), mSt, 'coperchio');
    A.add(K.box(xc0 - 4, yT + 1, -12, xc0 + 10, yT + 11, 12, 1, 2), mSt, 'coperchio');
    A.add(lungo(K.rod(0, 2 * hw, 3, { seg: 12 }), [xc1 - 2, yT + 10, -hw], [0, 0, 1]), mSt);
    A.pivot('coperchio', [xc1 - 2, yT + 10, 0]);
    const ys = o.slitte ? ct + 10 : ct;
    A.add(K.slab([[X(40), yT, 0], [X(100), yT, 0], [X(100), yT + 6, 2], [X(48), ys - 2, 3]], -13, 13, { b: 1 }), mSt);
    A.add(lungo(K.latheX([[0, 0], [0, 7], [10, 7], [10, 0]], { seg: 18 }), [X(70), ys - 6, 13], [0, 0, 1]), K.mat('nero', null, { tile: 'knurl', rep: [4, 1], r: .5 }));
    A.add(K.slab([[X(56), ys - 4, 1], [X(68), ys - 4, 1], [X(66), ys + 10, 2], [X(58), ys + 10, 2]], -6, 6, { b: .6, holes: [K.circ(X(62), ys + 5, 1.6, 10)] }), mSt);
    const yBar = 0, rb0 = big ? 12.5 : 10.5;
    // ---------------- canna, scudo termico, astina, blocco del gas, bipiede, mirino, spegnifiamma, maniglia
    A.add(K.latheX([[xr - 14, 0], [xr - 14, 18], [xr - 12, 19.5], [xr + 12, 19.5], [xr + 16, 16], [xr + 16, 0]], { seg: 28 }), mSt);
    A.add(K.latheX([[xr, 0], [xr, rb0 + 2], [X(560), rb0], [X(725), rb0 - 1], [X(727), 0]], { seg: 24 }), mBar);
    A.add(forata({ x0: xr + 16, x1: X(560), r: rb0 + 9, t: 1.2, nx: 6, na: 3, a0: -1.05, a1: 1.05, m: 2, foro: () => null }), mSt);
    const ha = { t: -6, b: big ? -54 : -50, w: big ? 25 : 23 };
    A.add(K.loftX([{ x: xr + 12, t: ha.t, b: ha.b + 6, w: ha.w - 3 }, { x: xr + 22, t: ha.t, b: ha.b, w: ha.w }, { x: X(528), t: ha.t, b: ha.b, w: ha.w }, { x: X(540), t: ha.t, b: ha.b + 8, w: ha.w - 4 }].map(q => Object.assign({ nt: 10, nb: 2.4 }, q)), { K: 28, step: 0 }), K.mat('polimero', null, { tile: 'ribs', rep: [1, 3], ns: .8, r: .62 }));
    if (o.slitte) for (const d of ['dx', 'sx', 'giu']) WC.put(A, WC.rail(xr + 40, X(510), d === 'giu' ? -ha.b - 1 : ha.w - 1, { dir: d }));
    A.add(K.tube(xr + 10, X(570), 7, 5, { seg: 16, cy: -24 }), mSt);
    A.add(K.latheX([[X(548), rb0], [X(548), rb0 + 4], [X(550), rb0 + 5], [X(588), rb0 + 5], [X(590), rb0 + 4], [X(590), rb0]], { seg: 24 }), mSt);
    A.add(K.slab([[X(552), -32, 2], [X(586), -32, 2], [X(586), -6, 2], [X(552), -6, 2]], -10, 10, { b: 1.2 }), mSt);
    A.add(K.latheX([[X(586), 0], [X(586), 8], [X(588), 9], [X(604), 9], [X(606), 7], [X(606), 0]], { seg: 18, cy: -24 }), mSt);
    bipiede(A, { x: X(572), ya: -24, rc: 8, collare: false, yh: -40, len: big ? 320 : 300, r: 5, piede: 'disco', apre: .2, avanti: .12, mat: mSt });
    const fs = X(690), ysf = ys + 2;
    A.add(K.latheX([[fs - 12, rb0 - 1], [fs - 12, rb0 + 3], [fs - 10, rb0 + 4.5], [fs + 10, rb0 + 4.5], [fs + 12, rb0 + 3], [fs + 12, rb0 - 1]], { seg: 22 }), mSt);
    A.add(K.slab([[fs - 9, 8, 0], [fs + 9, 8, 0], [fs + 7, ysf - 12, 3], [fs - 7, ysf - 12, 3]], -6, 6, { b: 1 }), mSt);
    for (const z of [-1, 1]) A.add(K.slab([[fs - 6, ysf - 16, 0], [fs + 6, ysf - 16, 0], [fs + 5, ysf + 2, 3], [fs - 5, ysf + 2, 3]], z > 0 ? 4 : -7, z > 0 ? 7 : -4, { b: .6 }), mSt);
    A.add(K.slab([[fs - 2.5, ysf - 14, 0], [fs + 2.5, ysf - 14, 0], [fs + 2, ysf, .5], [fs - 2, ysf, .5]], -1.2, 1.2, { b: .3 }), mSt);
    WC.put(A, WC.muzzle('gabbia', X(725), rb0 + .5, { len: big ? 52 : 46, mat: mSt }));
    A.add(K.discX(X(726), 0, 0, rb0 * .45, 1, 16), mDark);
    maniglia(A, { x: xr + 40, xa: xr + 10, xb: xr + 120, y: 0, rc: rb0 + 9.5, h: big ? 60 : 56, ri: 9, mat: mSt, matI: mPol });
    // ---------------- impugnatura, ponticello largo, grilletto
    const gy = yB - 12;
    impugnatura(A, { x: X(88), y: gy, ang: .3, len: 100, f0: 12.5, f1: 14, r0: 15, r1: 17, w0: 13, w1: 14, dita: 1.4, mat: matImp() });
    A.add(K.slab([[X(104), gy, 0], [X(200), gy, 0], [X(202), gy - 8, 3], [X(192), gy - 36, 8], [X(124), gy - 38, 10], [X(104), gy - 22, 5]], -6, 6, { b: 1.2, holes: [[[X(115), gy - 6, 3], [X(190), gy - 6, 3], [X(184), gy - 30, 7], [X(126), gy - 31, 8]]] }), mPol);
    A.add(K.slab([[X(130), gy, 1], [X(137), gy, 1], [X(136), gy - 9, 4], [X(132), gy - 23, 1.2], [X(127.5), gy - 22.5, 1.2], [X(131.5), gy - 10, 4]], -3, 3, { b: .6 }), mSt, 'grilletto');
    A.pivot('grilletto', [X(134), gy - 1, 0]);
    // ---------------- calcio
    let xb;
    if (o.calcio === 'telescopico') {
      A.add(K.latheX([[-206, 0], [-206, 13], [-204, 15], [-6, 15], [-4, 17], [4, 17], [4, 0]], { seg: 24, cy: -6 }), mSt);
      A.add(K.slab([[-236, 20, 6], [-112, 20, 6], [-104, 10, 4], [-104, -24, 6], [-138, -46, 14], [-226, -112, 8], [-236, -112, 4]], -19, 19, { b: 4.5 }), mPol);
      A.add(K.latheX([[-122, 14], [-122, 18.5], [-119, 20.5], [-100, 20.5], [-98, 18], [-98, 14]], { seg: 24, cy: -6 }), mPol);
      A.add(K.slab([[-228, 20, 4], [-140, 20, 4], [-136, 31, 6], [-224, 35, 6]], -15, 15, { b: 4 }), mPol);
      A.add(K.box(-136, -28, -5, -112, -20, 5, 1, 2), mSt);
      A.add(K.slab([[-252, 28, 6], [-236, 28, 2], [-236, -118, 2], [-252, -118, 6]], -22, 22, { b: 5, bs: 4 }), K.mat('gomma'));
      xb = -252;
    } else {
      A.add(K.loftX([{ x: -270, t: 8, b: -126, w: 21 }, { x: -250, t: 9, b: -120, w: 22 }, { x: -150, t: 10, b: -88, w: 20 }, { x: -60, t: 11, b: -60, w: 18 }, { x: 0, t: 12, b: -44, w: 18 }].map(q => Object.assign({ nt: 3, nb: 2.6 }, q)), { K: 30, step: 6 }), mPol);
      A.add(K.slab([[-284, 10, 5], [-268, 10, 2], [-268, -128, 2], [-284, -128, 5]], -22, 22, { b: 5, bs: 4 }), K.mat('gomma'));
      WC.put(A, WC.swivel(-200, -104, 0, { r: 8 }));
      xb = -284;
    }
    // ---------------- scatola portanastro in plastica agganciata sotto e nastro che sale a sinistra
    const c = big ? 'c762' : 'c556', xh = xf0 + 6, bx0 = X(206), by1 = yB - 6;
    scatola(A, { x0: bx0, x1: X(342), y0: by1 - (big ? 124 : 112), y1: by1, z0: -92, z1: 8, mat: K.mat('polimero', null, { c: big ? '#2e3026' : '#3a3d30', r: .7 }), nerv: 3, maniglia: false });
    A.add(K.box(xh - 4, by1 - .6, -84, xh + (big ? 76 : 62), by1 + .8, -50, .3, 2), mDark, 'caricatore');
    nastro(A, { cal: c, pts: [[xh, 8, -10], [xh, 8, -hw - 8], [xh, -4, -hw - 22], [xh, -24, -hw - 32], [xh, by1 - 2, -hw - 40]], traccianti: 5 });
    A.pivot('nastro', [xh, 8, -10]); A.pivot('caricatore', [X(270), by1, -40]);
    A.anchor('bocca', [X(727) + (big ? 52 : 46), 0, 0]); A.anchor('espulsione', [X(240), yB - 2, 0], [0, -1, .1]); A.anchor('impugnatura', [X(72), gy - 46, 0]); A.anchor('grilletto', [X(132), gy - 16, 0]);
    A.anchor('appoggio', [X(440), ha.b - 6, -6]); A.anchor('mira_post', [X(62), ys + 5, 0]); A.anchor('mira_ant', [fs, ysf, 0]); A.anchor('calcio', [xb, -56, 0]);
    const r = A.done();
    r.info = { azione: 'auto', bossolo: big ? 'fucile_lungo' : 'fucile', ciclo: { otturatore: { dx: -.07 }, grilletto: { rz: -.15 } },
      ricarica: { coperchio: { rz: -1.15 }, manetta: { dx: -.09 }, caricatore: { dy: -.08 }, nastro: { dy: -.08 } }, piega: { bipiede: { rz: -1.45 } } };
    return r;
  };
  MAP2[141] = { f: 'mtr_leggera_doppia_alim', o: { cal: 'c556', calcio: 'fisso' } };
  MAP2[161] = { f: 'mtr_leggera_doppia_alim', o: { cal: 'c762', calcio: 'telescopico', slitte: true } };

  // ================================================================ mitragliatrice leggera in polimero (alimentazione da sinistra): culatta
  // squadrata con slitta lunga sul coperchio, castello in polimero con impugnatura e ponticello integrati, calcio scheletrato
  // ripiegabile (5,56) o calcio regolabile con guanciale (7,62), astina corta, maniglia, contenitore del nastro sotto
  FAM2.mtr_leggera_polimero = function (spec, o) {
    o = o || {};
    const K = WK2, A = K.asm('mtr_leggera_polimero'), sn = serie(spec), big = o.cal === 'c762', s = big ? 1.08 : 1, hw = big ? 26 : 24, X = v => v * s;
    const mSt = K.mat('nero', null, { r: .46 }), mDark = K.mat('nero_lucido', null, { c: '#050505', r: .7 }), mBar = K.mat('parker', null, { c: '#2a2c2b', r: .45 });
    const mPol = K.mat('polimero', null, { tile: 'grana', rep: [6, 3], ns: .3 });
    const yT = big ? 17 : 15, yB = big ? -40 : -36, xr = X(336);
    // ---------------- culatta (parte alta in acciaio)
    const rb = [0, yB - 2, xr + 2, yT + 2];
    const pR = K.painter(rb, { w: 1024, h: 512, rough: .5 });
    for (const [x, y] of [[10, 8], [X(318), 8], [X(318), -24], [X(300), -24]]) pR.pin('LR', x, y, 2.2, { h: .5, a: 1.1 });
    pR.line('LR', [[X(296), yB], [X(296), yT]], .5, { h: -.7, a: .6 }); pR.line('LR', [[X(30), -6], [X(280), -6]], .4, { h: -.5, a: .75 });
    pR.text('L', spec.produttore.toUpperCase(), X(150), 5, 4.2, { spacing: 6 }); pR.text('R', spec.nome.toUpperCase() + '  ' + (spec.calibro || ''), X(140), 5, 3.8, { spacing: 4 });
    pR.text('L', sn, X(150), -18, 3);
    pR.noise({ a: .12, r: .18, seed: 41 }); pR.walls({ r: .5 });
    const mR = K.mat('nero', pR.done(2.4), { ns: .85 });
    const xf0 = X(188), xf1 = xf0 + (big ? 80 : 66);
    const rL = [[0, yB, 2, .5], [xr - 6, yB, 1.5, .5], [xr, yB + 6, 1, .5], [xr, yT, 0, .5], [xf1, yT, 0, .4], [xf1, 1, 1.5, .3], [xf0, 1, 1.5, .3], [xf0, yT, 0, .4], [0, yT, 0, .5]];
    const rR = [[0, yB, 2, .5], [xr - 6, yB, 1.5, .5], [xr, yB + 6, 1, .5], [xr, yT, 0, .5], [0, yT, 0, .5]];
    A.add(K.slab(rL, -hw, 0, { bL: 1.8, bR: 0, uv: rb }), mR);
    A.add(K.slab(rR, 0, hw, { bL: 0, bR: 1.8, uv: rb }), mR);
    A.add(K.box(xf0, -1, -hw + 1, xf1, 1.4, -1, .3, 0), mDark);
    // castello in polimero con impugnatura e ponticello integrati
    const yl = yB - 22, gx = X(84);
    A.add(K.slab([[X(26), yB + 2, 0, .4], [X(236), yB + 2, 0, .4], [X(246), yB - 8, 6], [X(236), yl, 6], [X(40), yl, 6], [X(20), yB - 6, 6]], -hw + 2, hw - 2, { b: 3 }), mPol);
    impugnatura(A, { x: gx, y: yl + 4, ang: .28, len: 98, f0: 13, f1: 14.5, r0: 15, r1: 17, w0: 13.5, w1: 14.5, dita: 1.8, mat: matImp() });
    A.add(K.slab([[gx + 14, yl, 0], [X(212), yl, 0], [X(214), yl - 8, 3], [X(204), yl - 34, 9], [gx + 30, yl - 36, 10], [gx + 14, yl - 20, 5]], -6.5, 6.5, { b: 1.6, holes: [[[gx + 24, yl - 5, 3], [X(202), yl - 5, 3], [X(196), yl - 28, 8], [gx + 34, yl - 29, 8]]] }), mPol);
    A.add(K.slab([[gx + 44, yl, 1], [gx + 51, yl, 1], [gx + 50, yl - 9, 4], [gx + 46, yl - 23, 1.2], [gx + 41.5, yl - 22.5, 1.2], [gx + 45.5, yl - 10, 4]], -3, 3, { b: .6 }), mSt, 'grilletto');
    A.pivot('grilletto', [gx + 48, yl - 1, 0]);
    A.add(K.slab([[gx - 6, yl + 10, 2], [gx + 22, yl + 10, 2], [gx + 22, yl + 16, 2], [gx - 6, yl + 16, 2]], hw - 2.5, hw - .5, { b: .6 }), mSt);   // sicura
    A.add(K.box(X(200), yB - 2, -9, X(270), yB + 8, 9, .6, 2), K.mat('brunito', null, { r: .3 }), 'otturatore'); A.pivot('otturatore', [X(235), yB + 3, 0]);
    // manetta ripiegabile a destra davanti (non si muove sparando)
    A.add(K.box(X(240), -12, hw - .5, X(326), -2, hw + 1.5, .5, 2), mDark);
    A.add(lungo(K.rod(0, 18, 3.6, { seg: 12 }), [X(312), -7, hw], [0, 0, 1]), mSt, 'manetta');
    A.add(lungo(K.latheX([[0, 0], [0, 4.5], [2, 6.5], [20, 6.5], [22, 4.5], [22, 0]], { seg: 16 }), [X(312), -7, hw + 16], [0, -1, 0]).translate(0, 10, 0), mSt, 'manetta');
    A.pivot('manetta', [X(312), -7, hw]);
    // ---------------- coperchio con slitta lunga e alzo ribaltabile; mirino ribaltabile in testa alla culatta
    const xc0 = X(96), xc1 = X(296), ct = yT + 18;
    A.add(K.slab([[xc0, yT, 0, .5], [xc1, yT, 0, .5], [xc1 + 4, yT + 8, 3, .8], [xc1 - 4, ct, 3, 1], [xc0 + 8, ct, 4, 1], [xc0, yT + 10, 3, .6]], -hw + 1, hw - 1, { b: 2.2 }), mSt, 'coperchio');
    WC.put(A, WC.rail(xc0 + 6, xc1 - 6, ct - .6), 'coperchio');
    A.add(lungo(K.rod(0, 2 * hw, 3, { seg: 12 }), [xc1 - 2, yT + 9, -hw], [0, 0, 1]), mSt);
    A.pivot('coperchio', [xc1 - 2, yT + 9, 0]);
    const yr = ct + 8.8;
    A.add(K.slab([[xc0 + 12, yr, 1], [xc0 + 40, yr, 1], [xc0 + 38, yr + 14, 2], [xc0 + 16, yr + 14, 2]], -9, 9, { b: .8, holes: [K.circ(xc0 + 27, yr + 9, 1.8, 10)] }), mSt, 'coperchio');
    A.add(K.slab([[xr - 4, yT, 1], [xr + 18, yT, 1], [xr + 14, yT + 10, 2], [xr - 2, yT + 10, 2]], -10, 10, { b: .8 }), mSt);
    A.add(K.slab([[xr + 2, yT + 8, 1], [xr + 12, yT + 8, 1], [xr + 10, yr + 12, 2], [xr + 4, yr + 12, 2]], -5, 5, { b: .6 }), mSt);
    // ---------------- canna, astina corta, blocco del gas, bipiede, maniglia, spegnifiamma
    const rb0 = big ? 12.5 : 10.5;
    A.add(K.latheX([[xr - 10, 0], [xr - 10, 18], [xr - 8, 19.5], [xr + 14, 19.5], [xr + 18, 16], [xr + 18, 0]], { seg: 28 }), mSt);
    const xmz = big ? X(745) + 50 : X(722);
    A.add(K.latheX([[xr, 0], [xr, rb0 + 2], [X(560), rb0], [xmz, rb0 - 1], [xmz + 2, 0]], { seg: 24 }), mBar);
    const ha = { t: big ? 14 : 12, b: big ? -42 : -38, w: big ? 26 : 24 };
    A.add(K.loftX([{ x: xr + 14, t: ha.t - 4, b: ha.b + 6, w: ha.w - 3 }, { x: xr + 24, t: ha.t, b: ha.b, w: ha.w }, { x: X(510), t: ha.t, b: ha.b, w: ha.w }, { x: X(520), t: ha.t - 6, b: ha.b + 8, w: ha.w - 4 }].map(q => Object.assign({ nt: 4, nb: 3 }, q)), { K: 30, step: 0 }), mPol);
    for (let x = xr + 44; x < X(500); x += 26) for (const z of [-1, 1]) A.add(K.box(x, -16, z > 0 ? ha.w - 2.4 : -ha.w - .6, x + 14, -6, z > 0 ? ha.w + .6 : -ha.w + 2.4, .8, 2.5), mDark);
    if (big) { WC.put(A, WC.rail(xr + 30, X(505), -ha.b - 1, { dir: 'giu' })); WC.put(A, WC.rail(xr + 30, X(505), ha.w - 1, { dir: 'dx' })); WC.put(A, WC.rail(xr + 30, X(505), ha.w - 1, { dir: 'sx' })); }
    A.add(K.tube(xr + 10, X(578), 7, 5, { seg: 16, cy: -22 }), mSt);
    A.add(K.latheX([[X(556), rb0], [X(556), rb0 + 4], [X(558), rb0 + 5], [X(596), rb0 + 5], [X(598), rb0 + 4], [X(598), rb0]], { seg: 24 }), mSt);
    A.add(K.slab([[X(560), -30, 2], [X(594), -30, 2], [X(594), -6, 2], [X(560), -6, 2]], -10, 10, { b: 1.2 }), mSt);
    bipiede(A, { x: X(580), ya: -22, rc: 8, collare: false, yh: -38, len: big ? 320 : 300, r: 5, piede: 'disco', apre: .2, avanti: .12, mat: mSt });
    maniglia(A, { x: xr + 60, xa: xr + 26, xb: xr + 132, y: 0, rc: rb0 + 2, h: big ? 64 : 58, ri: 9, mat: mSt, matI: mPol });
    WC.put(A, WC.muzzle('gabbia', xmz, rb0 + .5, { len: big ? 54 : 46, mat: mSt }));
    A.add(K.discX(xmz + 1, 0, 0, rb0 * .45, 1, 16), mDark);
    // ---------------- calcio
    let xb;
    if (big) { // calcio regolabile con guanciale
      A.add(K.latheX([[-200, 0], [-200, 13], [-198, 15], [-6, 15], [-4, 17], [4, 17], [4, 0]], { seg: 24, cy: -4 }), mSt);
      A.add(K.slab([[-246, 24, 6], [-104, 20, 8], [-98, 6, 4], [-98, -22, 6], [-120, -36, 10], [-228, -124, 8], [-246, -124, 4]], -19, 19, { b: 3.5, holes: [[[-222, -6, 8], [-128, -10, 10], [-132, -26, 8], [-222, -98, 10]]] }), mPol);
      for (const x of [-214, -160]) A.add(K.box(x - 5, 20, -6, x + 5, 31, 6, 1, 1), mSt);
      A.add(K.slab([[-236, 30, 5], [-136, 27, 6], [-132, 38, 5], [-232, 43, 6]], -15, 15, { b: 4 }), mPol);
      A.add(lungo(K.latheX([[0, 0], [0, 6], [6, 6], [6, 0]], { seg: 16 }), [-186, 24, 19], [0, 0, 1]), K.mat('nero', null, { tile: 'knurl', rep: [4, 1], r: .5 }));
      A.add(K.box(-122, -26, -5, -100, -18, 5, 1, 2), mSt);
      A.add(K.slab([[-254, 30, 6], [-238, 30, 2], [-238, -122, 2], [-254, -122, 6]], -22, 22, { b: 5, bs: 4 }), K.mat('gomma'));
      xb = -254;
    } else { // calcio scheletrato ripiegabile
      A.add(K.box(-10, yB + 2, -hw + 4, 4, yT - 2, hw - 4, 2, 3), mSt);
      A.add(K.slab([[0, 12, 0, .4], [-14, 12, 6], [-246, 6, 10], [-256, 0, 4], [-256, -124, 6], [-238, -132, 10], [-150, -86, 30], [-40, -46, 16], [0, -34, 0, .4]], -18, 18, { b: 6, holes: [[[-222, -8, 10], [-60, -4, 14], [-52, -20, 10], [-90, -42, 12], [-222, -104, 14]]], uv: [-260, -136, 4, 16] }), mPol);
      A.add(K.slab([[-268, 4, 6], [-254, 4, 2], [-254, -128, 2], [-268, -128, 6]], -21, 21, { b: 5, bs: 4 }), K.mat('gomma'));
      xb = -268;
    }
    // ---------------- contenitore del nastro sotto e nastro che sale a sinistra
    const c = big ? 'c762' : 'c556', xh = xf0 + 5, by1 = yl - 2;
    scatola(A, { x0: X(216), x1: X(350), y0: by1 - (big ? 120 : 106), y1: by1, z0: -90, z1: 6, mat: K.mat('polimero', null, { c: '#3a3d30', r: .7 }), nerv: 2, maniglia: false });
    A.add(K.box(xh - 4, by1 - .6, -82, xh + (big ? 76 : 62), by1 + .8, -50, .3, 2), mDark, 'caricatore');
    nastro(A, { cal: c, pts: [[xh, 8, -10], [xh, 8, -hw - 8], [xh, -4, -hw - 22], [xh, -26, -hw - 32], [xh, by1 - 2, -hw - 40]], traccianti: 5 });
    A.pivot('nastro', [xh, 8, -10]); A.pivot('caricatore', [X(280), by1, -40]);
    A.anchor('bocca', [xmz + 2 + (big ? 54 : 46), 0, 0]); A.anchor('espulsione', [X(235), yB - 2, 0], [0, -1, .1]); A.anchor('impugnatura', [gx - 14, yl - 46, 0]); A.anchor('grilletto', [gx + 46, yl - 16, 0]);
    A.anchor('appoggio', [X(440), ha.b - 6, -6]); A.anchor('mira_post', [xc0 + 27, yr + 9, 0]); A.anchor('mira_ant', [xr + 7, yr + 12, 0]); A.anchor('calcio', [xb, -58, 0]);
    const r = A.done();
    r.info = { azione: 'auto', bossolo: big ? 'fucile_lungo' : 'fucile', ciclo: { otturatore: { dx: -.07 }, grilletto: { rz: -.15 } },
      ricarica: { coperchio: { rz: -1.15 }, manetta: { dx: -.09 }, caricatore: { dy: -.08 }, nastro: { dy: -.08 } }, piega: { bipiede: { rz: -1.45 } } };
    return r;
  };
  MAP2[142] = { f: 'mtr_leggera_polimero', o: { cal: 'c556' } };
  MAP2[160] = { f: 'mtr_leggera_polimero', o: { cal: 'c762' } };

  // ================================================================ mitragliatrice leggera ad astina nervata (alimentazione da sinistra o a
  // caricatore): astina in polimero a nervature trasversali con il bipiede che vi si ripiega, calcio scheletrato tubolare pieghevole,
  // maniglia sulla canna, contenitore del nastro tondeggiante sotto la culatta
  FAM2.mtr_leggera_nervata = function (spec, o) {
    o = o || {};
    const K = WK2, A = K.asm('mtr_leggera_nervata'), sn = serie(spec), hw = 22;
    const mSt = K.mat('nero', null, { r: .46 }), mDark = K.mat('nero_lucido', null, { c: '#050505', r: .7 }), mBar = K.mat('parker', null, { c: '#2a2c2b', r: .45 });
    const mPol = K.mat('polimero', null, { tile: 'grana', rep: [6, 3], ns: .3 });
    const yT = 14, yB = -40, xr = 300;
    const rb = [0, yB - 2, xr + 2, yT + 2];
    const pR = K.painter(rb, { w: 1024, h: 512, rough: .5 });
    for (const [x, y] of [[10, 6], [10, -32], [284, 6], [284, -32], [140, -35], [170, -35]]) pR.pin('LR', x, y, 2.2, { h: .5, a: 1.1 });
    pR.fill('LR', K.rrect(22, -22, 270, -14, 3), { h: .35, a: 1.04 }); pR.line('LR', [[272, yB], [272, yT]], .5, { h: -.7, a: .6 });
    pR.text('L', spec.produttore.toUpperCase(), 110, 4, 4.2, { spacing: 6 }); pR.text('L', sn, 110, -31, 3);
    pR.text('R', spec.nome.toUpperCase(), 100, 4, 4.2, { spacing: 6 }); pR.text('R', spec.calibro || '', 100, -31, 3);
    pR.noise({ a: .12, r: .18, seed: 43 }); pR.walls({ r: .5 });
    const mR = K.mat('nero', pR.done(2.4), { ns: .85 });
    const xf0 = 178, xf1 = 248;
    const rL = [[0, yB, 2, .5], [xr - 6, yB, 1.5, .5], [xr, yB + 6, 1, .5], [xr, yT, 0, .5], [xf1, yT, 0, .4], [xf1, 1, 1.5, .3], [xf0, 1, 1.5, .3], [xf0, yT, 0, .4], [0, yT, 0, .5]];
    const rR = [[0, yB, 2, .5], [xr - 6, yB, 1.5, .5], [xr, yB + 6, 1, .5], [xr, yT, 0, .5], [0, yT, 0, .5]];
    A.add(K.slab(rL, -hw, 0, { bL: 1.6, bR: 0, uv: rb }), mR);
    A.add(K.slab(rR, 0, hw, { bL: 0, bR: 1.6, uv: rb, holes: [[[150, -22, 2], [206, -22, 2], [206, -2, 2], [150, -2, 2]]] }), mR);
    A.add(K.box(xf0, -1, -hw + 1, xf1, 1.4, -1, .3, 0), mDark); A.add(K.box(148, -22, 1, 208, -2, 3, .3, 0), mDark);
    A.add(K.box(152, -20, 4, 204, -4, 17, .8, 2), K.mat('brunito', null, { r: .3 }), 'otturatore'); A.pivot('otturatore', [178, -12, 10]);
    A.add(K.box(-8, yB + 2, -hw + 3, 2, yT - 2, hw - 3, 1.5, 3), mSt);
    A.add(K.box(40, yB - 10, -15, 214, yB + 1, 15, 1.4, 3), mSt);
    // pozzetto del caricatore sotto la culatta (si usa senza nastro) e manetta a destra (non si muove sparando)
    A.add(K.slab([[178, yB - 4, 2], [222, yB - 4, 2], [222, yB - 30, 3], [178, yB - 30, 3]], -14, 14, { b: 1.4, holes: [[[184, yB - 8, 2], [216, yB - 8, 2], [216, yB - 26, 2], [184, yB - 26, 2]]] }), mSt);
    A.add(K.box(230, -16, hw - .5, 292, -6, hw + 1.5, .5, 2), mDark);
    A.add(lungo(K.rod(0, 20, 3.8, { seg: 12 }), [280, -11, hw], [0, 0, 1]), mSt, 'manetta');
    A.add(lungo(K.latheX([[0, 0], [0, 5], [2, 7], [14, 7], [16, 5], [16, 0]], { seg: 16 }), [280, -11, hw + 18], [0, 0, 1]), mSt, 'manetta');
    A.pivot('manetta', [280, -11, hw]);
    // ---------------- coperchio bombato con l'alzo a tamburo in coda
    A.add(K.loftX([{ x: 92, t: 24, b: 13, w: 19 }, { x: 100, t: 34, b: 13, w: 21 }, { x: 272, t: 36, b: 13, w: 21 }, { x: 290, t: 28, b: 13, w: 19 }].map(q => Object.assign({ nt: 3, nb: 12 }, q)), { K: 26, step: 6 }), mSt, 'coperchio');
    A.add(K.box(88, 14, -10, 100, 26, 10, 1, 2), mSt, 'coperchio');
    A.add(lungo(K.rod(0, 2 * hw, 3, { seg: 12 }), [284, 22, -hw], [0, 0, 1]), mSt);
    A.pivot('coperchio', [284, 22, 0]);
    A.add(K.slab([[40, yT, 0], [92, yT, 0], [92, yT + 8, 2], [48, yT + 16, 3]], -12, 12, { b: 1 }), mSt);
    A.add(lungo(K.latheX([[0, 0], [0, 9], [16, 9], [16, 0]], { seg: 20 }), [62, yT + 18, -8], [0, 0, 1]), K.mat('nero', null, { tile: 'knurl', rep: [6, 1], r: .5 }));
    A.add(K.slab([[56, yT + 16, 1], [68, yT + 16, 1], [67, yT + 32, 2], [57, yT + 32, 2]], -5, 5, { b: .6, holes: [K.circ(62, yT + 27, 1.7, 10)] }), mSt);
    // ---------------- astina nervata, canna, blocco del gas, bipiede, mirino, spegnifiamma, maniglia
    A.add(K.latheX([[xr - 8, 0], [xr - 8, 17], [xr - 6, 18.5], [xr + 12, 18.5], [xr + 16, 15], [xr + 16, 0]], { seg: 28 }), mSt);
    A.add(K.latheX([[xr, 0], [xr, 12], [520, 10.5], [700, 9.8], [702, 0]], { seg: 24 }), mBar);
    A.add(astinaNervata(xr + 12, 470, 9, 12, -40, 23, 2.6), K.mat('polimero', null, { r: .62 }));
    A.add(K.tube(470, 520, 7, 5, { seg: 16, cy: -22 }), mSt);
    A.add(K.latheX([[500, 10], [500, 14], [502, 15], [532, 15], [534, 14], [534, 10]], { seg: 24 }), mSt);
    A.add(K.slab([[504, -32, 2], [530, -32, 2], [530, -6, 2], [504, -6, 2]], -9, 9, { b: 1.2 }), mSt);
    A.add(lungo(K.latheX([[0, 0], [0, 6], [2, 8], [12, 8], [14, 6], [14, 0]], { seg: 16 }), [520, -22, 9], [0, 0, 1]), K.mat('nero', null, { tile: 'knurl', rep: [4, 1], r: .5 }));
    bipiede(A, { x: 482, ya: -22, rc: 8, collare: false, yh: -40, len: 290, r: 4.8, piede: 'punta', apre: .2, avanti: .12, mat: mSt });
    A.add(K.latheX([[640, 9], [640, 13], [642, 14.5], [664, 14.5], [666, 13], [666, 9]], { seg: 22 }), mSt);
    A.add(K.slab([[644, 10, 0], [662, 10, 0], [660, 30, 3], [646, 30, 3]], -6, 6, { b: 1 }), mSt);
    A.add(lungo(K.latheX([[0, 7.5], [0, 9.5], [10, 9.5], [10, 7.5]], { seg: 22 }), [648, 40, 0], [1, 0, 0]), mSt);
    A.add(K.slab([[651, 28, 0], [655, 28, 0], [654.6, 44, .5], [651.4, 44, .5]], -1.1, 1.1, { b: .3 }), mSt);
    WC.put(A, WC.muzzle('gabbia', 700, 10.5, { len: 44, mat: mSt }));
    A.add(K.discX(701, 0, 0, 4.6, 1, 16), mDark);
    maniglia(A, { x: 334, xa: 306, xb: 404, y: 0, rc: 13, h: 52, ri: 9, mat: mSt, matI: mPol });
    // ---------------- impugnatura, ponticello, grilletto
    const gy = yB - 10;
    impugnatura(A, { x: 70, y: gy, ang: .3, len: 100, f0: 13, f1: 14.5, r0: 15, r1: 17, w0: 13.5, w1: 14.5, dita: 1.4, mat: matImp() });
    A.add(K.slab([[86, gy, 0], [172, gy, 0], [174, gy - 8, 3], [164, gy - 34, 7], [104, gy - 36, 9], [86, gy - 20, 5]], -6, 6, { b: 1, holes: [[[97, gy - 6, 3], [162, gy - 6, 3], [157, gy - 28, 6], [106, gy - 29, 7]]] }), mSt);
    A.add(K.slab([[112, gy, 1], [119, gy, 1], [118, gy - 9, 4], [114, gy - 23, 1.2], [109.5, gy - 22.5, 1.2], [113.5, gy - 10, 4]], -3, 3, { b: .6 }), mSt, 'grilletto');
    A.pivot('grilletto', [116, gy - 1, 0]);
    // ---------------- calcio tubolare scheletrato pieghevole con calciolo pieno
    A.add(K.box(-14, -36, -14, 2, 8, 14, 2, 3), mSt);
    A.add(asta([-10, 2, 0], [-236, -4, 0], 8.5, 16), mSt);
    A.add(asta([-10, -30, 0], [-236, -104, 0], 8.5, 16), mSt);
    A.add(asta([-150, -2, 0], [-150, -74, 0], 6, 12), mSt);
    A.add(K.slab([[-252, 10, 6], [-232, 10, 4], [-226, -2, 4], [-226, -110, 6], [-232, -120, 6], [-252, -120, 6]], -19, 19, { b: 5, bs: 4 }), mPol);
    A.add(K.slab([[-262, 8, 5], [-250, 8, 2], [-250, -118, 2], [-262, -118, 5]], -20, 20, { b: 4, bs: 4 }), K.mat('gomma'));
    // ---------------- contenitore del nastro tondeggiante sotto e nastro che sale a sinistra
    const xh = xf0 + 6, by1 = yB - 12;
    A.add(K.loftX([{ x: 186, t: by1, b: by1 - 104, w: 30 }, { x: 196, t: by1 + 2, b: by1 - 118, w: 40 }, { x: 314, t: by1 + 2, b: by1 - 118, w: 40 }, { x: 324, t: by1, b: by1 - 104, w: 30 }].map(q => Object.assign({ nt: 3.4, nb: 2.6, cz: -22 }, q)), { K: 32, step: 0 }), K.mat('polimero', null, { c: '#2d3026', r: .75, tile: 'grana', rep: [5, 5], ns: .4 }), 'caricatore');
    A.add(K.box(xh - 4, by1 + 1, -50, xh + 62, by1 + 2.6, -28, .3, 2), mDark, 'caricatore');
    A.add(K.box(200, by1 - 30, 18, 310, by1 - 10, 19.5, .4, 2), K.mat('nero', null, { r: .6 }), 'caricatore');
    nastro(A, { cal: 'c556', pts: [[xh, 8, -10], [xh, 8, -hw - 8], [xh, -6, -hw - 20], [xh, -26, -hw - 24], [xh, by1 - 2, -hw - 18]], traccianti: 5 });
    A.pivot('nastro', [xh, 8, -10]); A.pivot('caricatore', [255, by1, -22]);
    A.anchor('bocca', [745, 0, 0]); A.anchor('espulsione', [178, -12, 23], [0, .2, 1]); A.anchor('impugnatura', [54, gy - 46, 0]); A.anchor('grilletto', [114, gy - 16, 0]);
    A.anchor('appoggio', [400, -46, -6]); A.anchor('mira_post', [62, yT + 27, 0]); A.anchor('mira_ant', [653, 44, 0]); A.anchor('calcio', [-262, -56, 0]);
    const r = A.done();
    r.info = { azione: 'auto', bossolo: 'fucile', ciclo: { otturatore: { dx: -.07 }, grilletto: { rz: -.15 } },
      ricarica: { coperchio: { rz: -1.15 }, manetta: { dx: -.09 }, caricatore: { dy: -.08 }, nastro: { dy: -.08 } }, piega: { bipiede: { rz: -1.45 } } };
    return r;
  };
  MAP2[143] = { f: 'mtr_leggera_nervata', o: {} };

  // ================================================================ mitragliatrice leggera a tamburo (caricatore a tamburo da 100 colpi sotto la
  // culatta): culatta sottile, astina tonda forata con impugnatura anteriore verticale, bipiede vicino alla bocca, calcio fisso in polimero
  FAM2.mtr_leggera_tamburo = function (spec, o) {
    o = o || {};
    const K = WK2, A = K.asm('mtr_leggera_tamburo'), sn = serie(spec), hw = 18;
    const mSt = K.mat('nero', null, { r: .46 }), mDark = K.mat('nero_lucido', null, { c: '#050505', r: .7 }), mBar = K.mat('parker', null, { c: '#2a2c2b', r: .45 });
    const mPol = K.mat('polimero', null, { tile: 'grana', rep: [6, 3], ns: .3 });
    const yT = 14, yB = -32, xr = 310;
    const rb = [0, yB - 2, xr + 2, yT + 2];
    const pR = K.painter(rb, { w: 1024, h: 512, rough: .5 });
    for (const [x, y] of [[10, 4], [10, -24], [296, 4], [296, -24], [120, -27], [240, -27]]) pR.pin('LR', x, y, 2, { h: .5, a: 1.1 });
    pR.line('LR', [[20, -9], [290, -9]], .4, { h: -.5, a: .75 }); pR.line('LR', [[282, yB], [282, yT]], .5, { h: -.7, a: .6 });
    pR.fill('L', K.rrect(150, -14, 268, -4, 2.5), { h: -.95, a: .2, r: .8 });            // feritoia della manetta (sinistra)
    pR.text('L', spec.produttore.toUpperCase(), 90, 4, 3.8, { spacing: 5 }); pR.text('L', sn, 90, -20, 2.8);
    pR.text('R', spec.nome.toUpperCase(), 90, 4, 4, { spacing: 6 }); pR.text('R', spec.calibro || '', 90, -20, 2.8);
    pR.noise({ a: .12, r: .18, seed: 47 }); pR.walls({ r: .5 });
    const mR = K.mat('nero', pR.done(2.4), { ns: .85 });
    const rcv = [[0, yB, 2, .5], [xr - 6, yB, 1.5, .5], [xr, yB + 6, 1, .5], [xr, yT - 2, 3, .8], [0, yT - 2, 3, .8]];
    A.add(K.slab(rcv, -hw, 0, { bL: 3, bR: 0, uv: rb }), mR);
    A.add(K.slab(rcv, 0, hw, { bL: 0, bR: 3, uv: rb, holes: [[[156, -18, 2], [214, -18, 2], [214, 4, 2], [156, 4, 2]]] }), mR);
    A.add(K.loftX([{ x: 2, t: yT + 4, b: yT - 6, w: hw - 1 }, { x: xr - 2, t: yT + 4, b: yT - 6, w: hw - 1 }].map(q => Object.assign({ nt: 2.2, nb: 10 }, q)), { K: 24, step: 0 }), mSt);
    A.add(K.box(154, -18, 1, 216, 4, 3, .3, 0), mDark);
    A.add(K.box(158, -16, 4, 212, 2, 15, .8, 2), K.mat('brunito', null, { r: .3 }), 'otturatore'); A.pivot('otturatore', [185, -7, 8]);
    A.add(lungo(K.rod(0, 18, 3.8, { seg: 12 }), [258, -9, -hw], [0, 0, -1]), mSt, 'manetta');
    A.add(lungo(K.latheX([[0, 0], [0, 5], [2, 7], [12, 7], [14, 5], [14, 0]], { seg: 16 }), [258, -9, -hw - 16], [0, 0, -1]), mSt, 'manetta');
    A.pivot('manetta', [258, -9, -hw]);
    A.add(K.box(-8, yB + 2, -hw + 2, 2, yT - 2, hw - 2, 1.5, 3), mSt);
    A.add(K.box(40, yB - 10, -13, 140, yB + 1, 13, 1.4, 3), mSt);
    // alzo a tamburo in coda e mirino incappucciato davanti
    A.add(K.slab([[14, yT + 2, 0], [60, yT + 2, 0], [60, yT + 8, 2], [20, yT + 12, 3]], -11, 11, { b: 1 }), mSt);
    A.add(lungo(K.latheX([[0, 0], [0, 10], [18, 10], [18, 0]], { seg: 20 }), [36, yT + 22, -9], [0, 0, 1]), K.mat('nero', null, { tile: 'knurl', rep: [6, 1], r: .5 }));
    A.add(K.slab([[28, yT + 28, 1], [44, yT + 28, 1], [43, yT + 36, 2], [29, yT + 36, 2]], -5, 5, { b: .6, holes: [K.circ(36, yT + 32, 1.6, 10)] }), mSt);
    // ---------------- astina tonda forata con impugnatura verticale, canna, blocco del gas, bipiede, mirino, spegnifiamma
    A.add(K.latheX([[xr - 6, 0], [xr - 6, 22], [xr - 4, 24], [xr + 8, 24], [xr + 10, 22], [xr + 10, 0]], { seg: 32 }), mSt);
    A.add(forata({ x0: xr + 10, x1: 560, r: 23, t: 1.6, nx: 8, na: 8, m: 2, foro: (i, j, x, a) => Math.cos(a) < -.6 ? null : { w: 10, h: 4.4, n: 4 } }), mPol);
    A.add(K.latheX([[558, 0], [558, 23], [560, 24], [572, 24], [574, 20], [574, 0]], { seg: 32 }), mSt);
    A.add(K.latheX([[xr, 0], [xr, 11], [580, 10], [730, 9.4], [732, 0]], { seg: 24 }), mBar);
    A.add(K.latheX([[xr + 10, 0], [xr + 10, 6], [640, 6], [640, 0]], { seg: 14, cy: -15 }), mSt);
    impugnatura(A, { x: 452, y: -20, ang: -.1, len: 92, f0: 12, f1: 13, r0: 12, r1: 13, w0: 12, w1: 13, dita: 1.2, mat: matImp() });
    A.add(K.latheX([[626, 9], [626, 13], [628, 14.5], [660, 14.5], [662, 13], [662, 9]], { seg: 22 }), mSt);
    A.add(K.slab([[630, -26, 2], [658, -26, 2], [658, 8, 2], [630, 8, 2]], -9, 9, { b: 1.2 }), mSt);
    bipiede(A, { x: 644, ya: -15, rc: 7, collare: false, yh: -34, len: 280, r: 4.6, piede: 'disco', apre: .22, avanti: .1, mat: mSt });
    A.add(K.slab([[634, 12, 0], [656, 12, 0], [654, 30, 3], [636, 30, 3]], -6, 6, { b: 1 }), mSt);
    A.add(lungo(K.latheX([[0, 7.5], [0, 9.5], [12, 9.5], [12, 7.5]], { seg: 22 }), [639, 38, 0], [1, 0, 0]), mSt);
    A.add(K.slab([[643, 28, 0], [647, 28, 0], [646.6, 42, .5], [643.4, 42, .5]], -1.1, 1.1, { b: .3 }), mSt);
    WC.put(A, WC.muzzle('gabbia', 730, 10, { len: 42, mat: mSt }));
    A.add(K.discX(731, 0, 0, 4.4, 1, 16), mDark);
    // ---------------- impugnatura, ponticello, grilletto
    const gy = yB - 8;
    impugnatura(A, { x: 74, y: gy, ang: .3, len: 98, f0: 12.5, f1: 14, r0: 15, r1: 17, w0: 13, w1: 14, dita: 1.4, mat: matImp() });
    A.add(K.slab([[90, gy, 0], [160, gy, 0], [162, gy - 8, 3], [152, gy - 32, 7], [104, gy - 34, 9], [90, gy - 18, 5]], -6, 6, { b: 1, holes: [[[100, gy - 6, 3], [150, gy - 6, 3], [146, gy - 26, 6], [108, gy - 27, 7]]] }), mSt);
    A.add(K.slab([[114, gy, 1], [121, gy, 1], [120, gy - 9, 4], [116, gy - 22, 1.2], [111.5, gy - 21.5, 1.2], [115.5, gy - 10, 4]], -3, 3, { b: .6 }), mSt, 'grilletto');
    A.pivot('grilletto', [118, gy - 1, 0]);
    // ---------------- calcio fisso in polimero
    A.add(K.loftX([{ x: -246, t: 10, b: -116, w: 20 }, { x: -230, t: 11, b: -110, w: 21 }, { x: -135, t: 12, b: -72, w: 19 }, { x: -54, t: 12, b: -40, w: 17 }, { x: 0, t: 12, b: -30, w: 16 }].map(q => Object.assign({ nt: 3, nb: 2.6 }, q)), { K: 30, step: 6 }), mPol);
    A.add(K.slab([[-260, 12, 5], [-244, 12, 2], [-244, -118, 2], [-260, -118, 5]], -21, 21, { b: 5, bs: 4 }), K.mat('gomma'));
    WC.put(A, WC.swivel(-180, -90, 0, { r: 8 }));
    // ---------------- caricatore a tamburo con collo d'innesto
    const tc = [230, -128], mT = K.mat('nero', null, { r: .55 });
    A.add(tamburoZ(tc[0], tc[1], 84, 36, 7, 48), mT, 'caricatore');
    A.add(tamburoZ(tc[0], tc[1], 30, 39, 3, 28), mSt, 'caricatore');
    A.add(lungo(K.latheX([[0, 0], [0, 12], [4, 14], [10, 14], [12, 10], [12, 0]], { seg: 18 }), [tc[0], tc[1], 39], [0, 0, 1]), mSt, 'caricatore');
    A.add(lungo(K.box(-2, -26, -3, 2, 26, 3, .8), [tc[0], tc[1], 52], [0, 0, 1]), mSt, 'caricatore');
    for (let k = 0; k < 8; k++) { const a = k * PI / 4; A.add(K.xf(K.box(tc[0] + 40, tc[1] - 4, 33, tc[0] + 70, tc[1] + 4, 37.5, .8, 3), { r: [0, 0, a], p: [tc[0], tc[1], 0] }), mT, 'caricatore'); }
    A.add(K.slab([[200, yB + 2, 2], [258, yB + 2, 2], [256, tc[1] + 70, 6], [202, tc[1] + 70, 6]], -16, 16, { b: 2 }), mT, 'caricatore');
    A.pivot('caricatore', [230, yB, 0]);
    A.anchor('bocca', [773, 0, 0]); A.anchor('espulsione', [185, -7, 19], [0, .2, 1]); A.anchor('impugnatura', [58, gy - 46, 0]); A.anchor('grilletto', [116, gy - 16, 0]);
    A.anchor('appoggio', [446, -64, -4]); A.anchor('mira_post', [36, yT + 32, 0]); A.anchor('mira_ant', [645, 42, 0]); A.anchor('calcio', [-260, -54, 0]);
    const r = A.done();
    r.info = { azione: 'auto', bossolo: 'fucile', ciclo: { otturatore: { dx: -.065 }, grilletto: { rz: -.15 } },
      ricarica: { caricatore: { dy: -.1, rz: .2 }, manetta: { dx: -.08 } }, piega: { bipiede: { rz: -1.45 } } };
    return r;
  };
  MAP2[144] = { f: 'mtr_leggera_tamburo', o: {} };

  // ================================================================ mitragliatrice leggera in legno con nastro nel contenitore a tamburo
  // (cartuccia intermedia): calcio, impugnatura e astina in legno, canna lunga e sottile, cilindro del gas, bipiede vicino alla bocca,
  // contenitore tondo appeso sotto la culatta, alzo a tangente davanti al coperchio
  FAM2.mtr_leggera_legno = function (spec, o) {
    o = o || {};
    const K = WK2, A = K.asm('mtr_leggera_legno'), sn = serie(spec), hw = 21;
    const mSt = K.mat('brunito', null, { r: .38 }), mDark = K.mat('nero_lucido', null, { c: '#050505', r: .7 }), mBar = K.mat('brunito', null, { r: .34 });
    const mW = K.mat('legno_noce');
    const yT = 16, yB = -40, xr = 300;
    const rb = [0, yB - 2, xr + 2, yT + 2];
    const pR = K.painter(rb, { w: 1024, h: 512, rough: .4 });
    for (const [x, y] of [[10, 6], [10, -32], [24, -36], [280, 6], [280, -32], [292, -14], [130, -36], [160, -36]]) pR.pin('LR', x, y, 2.2, { h: .5, a: 1.1 });
    pR.fill('LR', K.rrect(26, -22, 262, -14, 3), { h: .35, a: 1.04 }); pR.line('LR', [[268, yB], [268, yT]], .5, { h: -.7, a: .6 });
    pR.fill('R', K.rrect(120, -32, 246, -26, 2.5), { h: -.95, a: .2, r: .8 });
    pR.text('L', spec.produttore.toUpperCase(), 110, 5, 4, { spacing: 6 }); pR.text('L', sn, 110, -31, 3);
    pR.text('R', spec.nome.toUpperCase(), 92, 5, 4.2, { spacing: 6 }); pR.text('R', spec.calibro || '', 200, 5, 3);
    pR.noise({ a: .12, r: .16, seed: 53 }); pR.walls({ r: .4 });
    const mR = K.mat('brunito', pR.done(2.4), { ns: .85 });
    const xf0 = 176, xf1 = 240;
    const rL = [[0, yB, 2, .5], [xr - 6, yB, 1.5, .5], [xr, yB + 6, 1, .5], [xr, yT, 0, .5], [xf1, yT, 0, .4], [xf1, 2, 1.5, .3], [xf0, 2, 1.5, .3], [xf0, yT, 0, .4], [0, yT, 0, .5]];
    const rR = [[0, yB, 2, .5], [xr - 6, yB, 1.5, .5], [xr, yB + 6, 1, .5], [xr, yT, 0, .5], [0, yT, 0, .5]];
    A.add(K.slab(rL, -hw, 0, { bL: 1.6, bR: 0, uv: rb }), mR);
    A.add(K.slab(rR, 0, hw, { bL: 0, bR: 1.6, uv: rb }), mR);
    A.add(K.box(xf0, 0, -hw + 1, xf1, 2.4, -1, .3, 0), mDark);
    A.add(K.box(-8, yB + 2, -hw + 3, 2, yT - 2, hw - 3, 1.5, 3), mSt);
    // manetta a destra solidale col carrello (si muove sparando)
    A.add(lungo(K.rod(0, 20, 3.6, { seg: 12 }), [236, -29, hw - 1], [0, 0, 1]), mSt, 'otturatore');
    A.add(lungo(K.latheX([[0, 0], [0, 5], [2, 7], [12, 7], [14, 5], [14, 0]], { seg: 16 }), [236, -29, hw + 18], [0, 0, 1]), mSt, 'otturatore');
    A.pivot('otturatore', [236, -29, 0]);
    // ---------------- coperchio (cerniera davanti) e alzo a tangente sul blocco anteriore
    const cov = [[96, yT, 0, .5], [262, yT, 0, .5], [264, yT + 8, 3, .8], [256, yT + 16, 4, 1], [120, yT + 18, 6, 1], [100, yT + 12, 4, .6]];
    A.add(K.slab(cov, -hw + .5, hw - .5, { b: 2 }), mSt, 'coperchio');
    A.add(K.box(92, yT + 1, -10, 104, yT + 11, 10, 1, 2), mSt, 'coperchio');
    A.add(lungo(K.rod(0, 2 * hw, 3, { seg: 12 }), [260, yT + 8, -hw], [0, 0, 1]), mSt);
    A.pivot('coperchio', [260, yT + 8, 0]);
    A.add(K.slab([[264, yT, 0], [304, yT, 0], [304, yT + 8, 2], [292, yT + 12, 2], [268, yT + 12, 2]], -11, 11, { b: 1 }), mSt);
    A.add(K.slab([[270, yT + 11, 1], [330, yT + 11, 1], [330, yT + 14, 1], [274, yT + 15, 1]], -6, 6, { b: .5 }), mSt);
    A.add(K.box(300, yT + 12, -8, 310, yT + 17, 8, .5, 1), mSt);
    A.add(K.slabX([[-6, yT + 13, .5], [6, yT + 13, .5], [6, yT + 20, .8], [1.3, yT + 20, .3], [1.3, yT + 17, .5], [-1.3, yT + 17, .5], [-1.3, yT + 20, .3], [-6, yT + 20, .8]], 266, 272, { b: .4 }), mSt);
    // ---------------- astina in legno, canna lunga, cilindro del gas, bipiede, mirino incappucciato
    A.add(K.latheX([[xr - 6, 0], [xr - 6, 16], [xr - 4, 17.5], [xr + 12, 17.5], [xr + 16, 14], [xr + 16, 0]], { seg: 28 }), mSt);
    A.add(K.latheX([[xr, 0], [xr, 11], [540, 9.6], [762, 8.6], [764, 0]], { seg: 24 }), mBar);
    A.add(K.latheX([[xr, 0], [xr, 8], [600, 8], [602, 0]], { seg: 18, cy: -22 }), mSt);
    A.add(K.loftX([{ x: 284, t: 8, b: -40, w: 20 }, { x: 296, t: 8, b: -48, w: 23 }, { x: 384, t: 8, b: -44, w: 22 }, { x: 402, t: 8, b: -34, w: 18 }].map(q => Object.assign({ nt: 10, nb: 2.4 }, q)), { K: 30, step: 6 }), mW);
    A.add(K.latheX([[400, 7.5], [400, 12], [402, 13], [410, 13], [412, 12], [412, 7.5]], { seg: 20, cy: -22 }), mSt);
    A.add(K.latheX([[582, 8.6], [582, 12.5], [584, 14], [610, 14], [612, 12.5], [612, 8.6]], { seg: 22 }), mSt);
    A.add(K.slab([[586, -32, 2], [608, -32, 2], [608, -6, 2], [586, -6, 2]], -8, 8, { b: 1 }), mSt);
    bipiede(A, { x: 704, ya: 0, rc: 9.4, yh: -18, len: 290, r: 4.4, piede: 'punta', apre: .2, avanti: .12, mat: mSt });
    A.add(K.latheX([[740, 8.4], [740, 12], [742, 13.5], [762, 13.5], [764, 12], [764, 8.4]], { seg: 22 }), mSt);
    A.add(K.slab([[744, 10, 0], [762, 10, 0], [760, 24, 3], [746, 24, 3]], -6, 6, { b: 1 }), mSt);
    A.add(lungo(K.latheX([[0, 7.5], [0, 9.5], [14, 9.5], [14, 7.5]], { seg: 22 }), [746, 30, 0], [1, 0, 0]), mSt);
    A.add(K.slab([[751, 22, 0], [755, 22, 0], [754.6, 36, .5], [751.4, 36, .5]], -1.1, 1.1, { b: .3 }), mSt);
    A.add(K.latheX([[762, 0], [762, 8], [766, 9.5], [776, 9.5], [776, 4], [772, 3.5], [772, 0]], { seg: 22 }), mSt);
    A.add(K.discX(772.2, 0, 0, 3.6, 1, 14), mDark);
    // ---------------- impugnatura in legno, ponticello, grilletto
    const gy = yB;
    A.add(K.box(40, yB - 8, -12, 170, yB + 1, 12, 1.2, 3), mSt);
    impugnatura(A, { x: 64, y: gy - 4, ang: .34, len: 100, f0: 13, f1: 15, r0: 15, r1: 17, w0: 13.5, w1: 14.5, mat: mW });
    A.add(K.slab([[84, gy - 8, 0], [160, gy - 8, 0], [162, gy - 15, 3], [152, gy - 40, 7], [102, gy - 42, 9], [84, gy - 26, 5]], -5.5, 5.5, { b: 1, holes: [[[95, gy - 13, 3], [150, gy - 13, 3], [145, gy - 34, 6], [104, gy - 35, 7]]] }), mSt);
    A.add(K.slab([[110, gy - 8, 1], [117, gy - 8, 1], [116, gy - 17, 4], [112, gy - 30, 1.2], [107.5, gy - 29.5, 1.2], [111.5, gy - 18, 4]], -3, 3, { b: .6 }), mSt, 'grilletto');
    A.pivot('grilletto', [114, gy - 9, 0]);
    // ---------------- calcio in legno a collo diritto con calciolo in acciaio
    A.add(K.loftX([{ x: -255, t: 2, b: -120, w: 20 }, { x: -243, t: 3, b: -116, w: 21 }, { x: -150, t: 6, b: -78, w: 19 }, { x: -62, t: 10, b: -44, w: 16 }, { x: -18, t: 13, b: -36, w: 15 }, { x: 0, t: 14, b: -36, w: 16 }].map(q => Object.assign({ nt: 2.6, nb: 2.4 }, q)), { K: 30, step: 6 }), mW);
    A.add(K.slab([[-261, 4, 2], [-253, 4, 0], [-253, -122, 0], [-261, -122, 2]], -21, 21, { b: 1.4 }), mSt);
    WC.put(A, WC.screw(-257, -20, 21, 2.4, 1)); WC.put(A, WC.screw(-257, -100, 21, 2.4, 1)); WC.put(A, WC.swivel(-180, -92, 0, { r: 8 }));
    // ---------------- contenitore tondo del nastro appeso sotto la culatta
    const tc = [232, -126], mT = K.mat('nero', null, { r: .5 });
    A.add(tamburoZ(tc[0], tc[1], 76, 34, 6, 44), mT, 'caricatore');
    A.add(tamburoZ(tc[0], tc[1], 58, 36, 2, 40), mT, 'caricatore');
    A.add(K.slab([[196, yB + 2, 2], [270, yB + 2, 2], [268, tc[1] + 62, 6], [198, tc[1] + 62, 6]], -22, 22, { b: 2 }), mT, 'caricatore');
    A.add(K.box(222, tc[1] - 80, -6, 242, tc[1] - 70, 6, 1, 2), mSt, 'caricatore');
    for (const z of [-1, 1]) A.add(lungo(K.latheX([[0, 0], [0, 9], [3, 10], [6, 9], [6, 0]], { seg: 16 }), [tc[0], tc[1], z * 36], [0, 0, z]), mSt, 'caricatore');
    nastro(A, { cal: 'c762c', pts: [[xf0 + 4, 9, -8], [xf0 + 4, 9, -hw - 6], [xf0 + 4, -6, -hw - 14], [xf0 + 4, -30, -hw - 14]], traccianti: 5, n: 5 });
    A.pivot('nastro', [xf0 + 4, 9, -8]); A.pivot('caricatore', [232, yB, 0]);
    A.anchor('bocca', [777, 0, 0]); A.anchor('espulsione', [200, yB - 2, 0], [0, -1, .1]); A.anchor('impugnatura', [46, gy - 50, 0]); A.anchor('grilletto', [112, gy - 22, 0]);
    A.anchor('appoggio', [350, -52, -6]); A.anchor('mira_post', [269, yT + 20, 0]); A.anchor('mira_ant', [753, 36, 0]); A.anchor('calcio', [-259, -60, 0]);
    const r = A.done();
    r.info = { azione: 'auto', bossolo: 'fucile', ciclo: { otturatore: { dx: -.085 }, grilletto: { rz: -.15 } },
      ricarica: { coperchio: { rz: -1.15 }, caricatore: { dy: -.09 }, nastro: { dy: -.05 } }, piega: { bipiede: { rz: -1.45 } } };
    return r;
  };
  MAP2[139] = { f: 'mtr_leggera_legno', o: {} };

  // ================================================================ mitragliatrice leggera ad alimentazione laterale: culatta monoblocco in
  // alluminio con slitta continua dalla coda alla bocca, alimentatore sul fianco sinistro con coperchio laterale (incernierato in alto,
  // si apre ruotando attorno a X), astina con feritoie, calcio pieghevole e regolabile, mirino a punto rosso, borsa del nastro in tessuto
  FAM2.mtr_leggera_laterale = function (spec, o) {
    o = o || {};
    const K = WK2, A = K.asm('mtr_leggera_laterale'), sn = serie(spec), hw = 21;
    const mAl = K.mat('anod'), mSt = K.mat('nero', null, { r: .46 }), mDark = K.mat('nero_lucido', null, { c: '#050505', r: .7 }), mBar = K.mat('parker', null, { c: '#2a2c2b', r: .45 });
    const mPol = K.mat('polimero', null, { tile: 'grana', rep: [6, 3], ns: .3 });
    const yT = 16, yB = -26, xr = 300;
    // ---------------- culatta monoblocco: x 0..300, y -26..16, con finestra di espulsione a destra
    const rb = [0, -56, xr + 2, yT + 2];
    const pR = K.painter(rb, { w: 1024, h: 512, rough: .45 });
    pR.line('LR', [[10, yB], [xr - 4, yB]], .4, { h: -.6, a: .7 });
    for (const [x, y] of [[40, -40], [200, -40], [286, 4], [286, -16]]) pR.pin('LR', x, y, 2, { h: .4, a: 1.1 });
    pR.fill('R', K.rrect(126, -16, 196, 6, 2), { h: -.2, a: .85 });
    pR.text('R', spec.produttore.toUpperCase(), 240, -8, 3.6, { spacing: 4 }); pR.text('R', spec.nome.toUpperCase() + '  ' + (spec.calibro || ''), 70, -8, 3.2, { spacing: 3 });
    pR.text('L', sn, 60, -36, 2.8); pR.text('L', 'S   1   F', 66, -46, 2.6);
    pR.noise({ a: .1, r: .14, seed: 59 }); pR.walls({ r: .45 });
    const mR = K.mat('anod', pR.done(2.2), { ns: .8 });
    const up = [[0, yB, 2, .5], [xr, yB, 1.5, .5], [xr, yT, 1, .6], [0, yT, 2, .6]];
    A.add(K.slab(up, -hw, 0, { bL: 2, bR: 0, uv: rb }), mR);
    A.add(K.slab(up, 0, hw, { bL: 0, bR: 2, uv: rb, holes: [[[130, -14, 2], [192, -14, 2], [192, 4, 2], [130, 4, 2]]] }), mR);
    A.add(K.box(128, -14, 1, 194, 4, 3, .3, 0), mDark);
    A.add(K.box(132, -12, 4, 190, 2, 16, .8, 2), K.mat('brunito', null, { r: .3 }), 'otturatore'); A.pivot('otturatore', [160, -5, 10]);
    // castello inferiore con impugnatura e ponticello
    const lw = [[24, yB, 0, .4], [236, yB, 0, .4], [244, yB - 8, 4], [236, -50, 5], [44, -50, 5], [26, yB - 10, 4]];
    A.add(K.slab(lw, -hw + 2, hw - 2, { b: 2.4, uv: rb }), mR);
    impugnatura(A, { x: 74, y: -46, ang: .36, len: 96, f0: 12.5, f1: 13.5, r0: 15, r1: 16.5, w0: 13, w1: 13.5, dita: 1.2, mat: matImp() });
    A.add(K.slab([[92, -50, 0], [156, -50, 0], [158, -56, 2], [150, -76, 6], [106, -77, 8], [92, -66, 4]], -6, 6, { b: 1, holes: [[[102, -55, 2], [146, -55, 2], [142, -71, 5], [108, -72, 6]]] }), mR);
    A.add(K.slab([[114, -50, 1], [120, -50, 1], [119, -58, 4], [115.5, -70, 1.2], [111.5, -69.5, 1.2], [115, -59, 4]], -3, 3, { b: .6 }), mSt, 'grilletto');
    A.pivot('grilletto', [117, -51, 0]);
    A.add(lungo(K.latheX([[0, 0], [0, 7], [3, 7], [3, 0]], { seg: 16 }), [62, -40, -hw + 1], [0, 0, -1]), mSt);
    A.add(K.slab([[56, -42, 1], [72, -40, 1], [74, -36, 1], [58, -37, 1]], -hw - 4.5, -hw - 3, { b: .4 }), mSt);
    // manetta di armamento a destra davanti (non si muove sparando)
    A.add(K.box(210, -6, hw - .5, 286, 4, hw + 1.5, .5, 2), mDark);
    A.add(lungo(K.rod(0, 16, 3.6, { seg: 12 }), [268, -1, hw], [0, 0, 1]), mSt, 'manetta');
    A.add(lungo(K.latheX([[0, 0], [0, 5], [2, 7], [14, 7], [16, 5], [16, 0]], { seg: 16 }), [268, -1, hw + 14], [0, 0, 1]), mSt, 'manetta');
    A.pivot('manetta', [268, -1, hw]);
    // ---------------- alimentatore laterale a sinistra con coperchio incernierato in alto
    A.add(K.slab([[118, -22, 3], [276, -22, 3], [284, -10, 3], [284, 12, 3], [118, 12, 3]], -hw - 20, -hw + 1, { b: 2 }), mAl);
    A.add(K.slab([[112, -24, 4], [282, -24, 4], [290, -12, 4], [290, 14, 3], [112, 14, 3]], -hw - 25, -hw - 20, { b: 1.6 }), mAl, 'coperchio');
    A.add(K.box(126, -6, -hw - 27, 270, 6, -hw - 24.5, 1, 2), mAl, 'coperchio');
    A.add(lungo(K.rod(0, 182, 3, { seg: 12 }), [110, 14, -hw - 22], [1, 0, 0]), mSt);
    A.pivot('coperchio', [195, 14, -hw - 22]);
    A.add(K.box(150, -34, -hw - 20, 220, -22, -hw - 6, .6, 2), mDark);
    // ---------------- slitta continua, astina con feritoie, canna, bipiede, spegnifiamma, mire
    WC.put(A, WC.rail(6, 612, yT - .6));
    A.add(K.loftX([{ x: xr - 2, t: yT, b: -38, w: hw + 2 }, { x: 604, t: yT, b: -38, w: hw + 2 }, { x: 612, t: yT - 2, b: -34, w: hw }].map(q => Object.assign({ nt: 6, nb: 5 }, q)), { K: 32, step: 0 }), mAl);
    for (let x = 330; x < 590; x += 34) for (const z of [-1, 1]) A.add(K.box(x, -22, z > 0 ? hw + 1 : -hw - 3.4, x + 22, -10, z > 0 ? hw + 3.4 : -hw - 1, 1, 3), mDark);
    for (let x = 334; x < 590; x += 34) A.add(K.box(x, -40, -6, x + 20, -36, 6, .8, 2), mDark);
    WC.put(A, WC.rail(530, 600, -38, { dir: 'giu' }));
    A.add(K.latheX([[xr - 6, 0], [xr - 6, 12], [612, 10.5], [672, 9.8], [674, 0]], { seg: 22 }), mBar);
    A.add(K.latheX([[670, 0], [670, 11], [672, 12.5], [682, 12.5], [682, 0]], { seg: 22 }), mSt);
    for (let k = 0; k < 3; k++) A.add(K.xf(K.slab([[682, 4, 1], [720, 4.6, 1], [720, 11.5, 1.5], [682, 12.5, 1]], -3.2, 3.2, { b: .8 }), { r: [k * 2 * PI / 3, 0, 0] }), mSt);
    A.add(K.discX(682.2, 0, 0, 4.4, 1, 16), mDark);
    const bp = yT + 9.4;
    A.add(K.slab([[18, bp, 1], [42, bp, 1], [40, bp + 6, 2], [20, bp + 6, 2]], -10, 10, { b: .8 }), mSt);
    A.add(K.slab([[22, bp + 4, 1], [36, bp + 4, 1], [34, bp + 9, 1], [24, bp + 9, 1]], -7, 7, { b: .5 }), mSt);
    A.add(K.slab([[588, bp, 1], [606, bp, 1], [604, bp + 6, 2], [590, bp + 6, 2]], -10, 10, { b: .8 }), mSt);
    WC.put(A, WC.reflex(70, bp));
    bipiede(A, { x: 566, ya: -42, rc: 8, collare: false, yh: -50, len: 280, r: 4.8, piede: 'disco', apre: .22, avanti: .12, mat: mAl });
    // ---------------- calcio pieghevole e regolabile
    A.add(K.box(-14, yB + 2, -14, 2, yT - 2, 14, 2, 3), mAl);
    A.add(K.latheX([[-130, 0], [-130, 11], [-128, 13], [-14, 13], [-12, 11], [-12, 0]], { seg: 22, cy: -2 }), mAl);
    A.add(K.slab([[-236, 30, 6], [-126, 22, 8], [-120, 8, 6], [-120, -16, 6], [-162, -44, 18], [-226, -106, 8], [-236, -106, 4]], -18, 18, { b: 6, holes: [[[-214, 4, 6], [-160, -2, 8], [-164, -22, 10], [-214, -76, 8]]] }).translate(20, 0, 0), mPol);
    A.add(K.slab([[-230, 30, 6], [-140, 24, 8], [-136, 34, 6], [-226, 40, 8]], -15, 15, { b: 5 }).translate(20, 0, 0), mPol);
    A.add(K.slab([[-250, 32, 6], [-234, 32, 2], [-234, -110, 2], [-250, -110, 6]], -21, 21, { b: 5, bs: 4 }).translate(20, 0, 0), K.mat('gomma'));
    // ---------------- borsa del nastro in tessuto sotto il fianco sinistro, nastro che sale nell'alimentatore
    const mTes = K.mat('coyote', null, { c: '#5a4b37', tile: 'grana', rep: [10, 10], ns: .6, r: .95 }), mCin = K.mat('coyote', null, { c: '#5a4a34', r: .9 });
    A.add(K.loftX([{ x: 142, t: -62, b: -146, w: 22 }, { x: 150, t: -57, b: -160, w: 31 }, { x: 214, t: -55, b: -166, w: 34 }, { x: 284, t: -57, b: -160, w: 31 }, { x: 294, t: -62, b: -146, w: 22 }].map(q => Object.assign({ nt: 2.3, nb: 2.8, cz: -40 }, q)), { K: 30, step: 6 }), mTes, 'caricatore');
    A.add(K.loftX([{ x: 146, t: -50, b: -74, w: 30 }, { x: 290, t: -50, b: -74, w: 30 }].map(q => Object.assign({ nt: 2.4, nb: 6, cz: -40 }, q)), { K: 26, step: 0 }), mTes, 'caricatore');
    for (const x of [176, 258]) A.add(K.box(x - 8, -112, -6, x + 8, -58, -4.6, .6, 2), mCin, 'caricatore'), A.add(K.box(x - 8, -112, -75.4, x + 8, -58, -74, .6, 2), mCin, 'caricatore');
    A.add(K.box(196, -96, -76.5, 236, -84, -73.5, .8, 3), mCin, 'caricatore');
    nastro(A, { cal: 'c556', pts: [[156, -14, -hw - 10], [156, -24, -hw - 20], [156, -40, -hw - 24], [156, -58, -hw - 22]], traccianti: 5 });
    A.pivot('nastro', [156, -14, -hw - 10]); A.pivot('caricatore', [220, -56, -40]);
    A.anchor('bocca', [721, 0, 0]); A.anchor('espulsione', [160, -5, 22], [0, .2, 1]); A.anchor('impugnatura', [58, -92, 0]); A.anchor('grilletto', [114, -64, 0]);
    A.anchor('appoggio', [480, -44, -6]); A.anchor('mira_post', [80, bp + 21, 0]); A.anchor('mira_ant', [110.5, bp + 21, 0]); A.anchor('ottica', [78, bp + 21, 0]); A.anchor('calcio', [-230, -40, 0]);
    const r = A.done();
    r.info = { azione: 'auto', bossolo: 'fucile', ciclo: { otturatore: { dx: -.065 }, grilletto: { rz: -.15 } },
      ricarica: { coperchio: { rx: 1.2 }, manetta: { dx: -.08 }, caricatore: { dy: -.08 }, nastro: { dy: -.08 } }, piega: { bipiede: { rz: -1.45 } } };
    return r;
  };
  MAP2[148] = { f: 'mtr_leggera_laterale', o: {} };
})();
