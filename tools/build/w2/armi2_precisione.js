// Fucili di precisione (gruppo "precisione", kit v2): otturatore girevole con calcio in legno, sintetico, a pollice passante
// o a telaio; anti-materiale calibro 12,7 semiautomatici e bullpup; bullpup di precisione; lunga gittata con calcio retrattile.
// Misure in mm: x = 0 retro della scatola di culatta, y = 0 asse della canna, z verso il lato destro.
// Parti mobili: leva (otturatore girevole con il manubrio, perno sull'asse della canna: su = rx negativo, indietro = dx negativo),
// otturatore e canna (semiautomatici a corto rinculo), grilletto, caricatore, bipiede (perno sull'attacco).
window.FAM2 = window.FAM2 || {}; window.MAP2 = window.MAP2 || {};
(function () {
  const K = WK2, T = THREE, PI = Math.PI;
  const VL = [.3, .65], VR = [.65, 1], VW = [0, .3];   // zone della trama come nel kit: lato sinistro, lato destro, pareti

  // ================================================================ utilità del gruppo (prefisso pr)
  function prArea(c) { let a = 0; for (let i = 0, n = c.length; i < n; i++) { const p = c[i], q = c[(i + 1) % n]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; }
  // matricola inventata (stabile per id)
  function prMatr(spec, pre) { const id = (spec && spec.id) || 0; return (pre || '') + String(100000 + ((id * 7919 + 4271) % 899999)); }

  // UV compatibili con il pittore: proiezione lungo Z (lato sinistro/destro secondo il segno di z), pareti nella fascia bassa
  function prUV(pos, bb, cz, radiale) {
    const uv = new Float32Array(pos.length / 3 * 2), sx = 1 / (bb[2] - bb[0]), sy = 1 / (bb[3] - bb[1]);
    for (let t = 0; t < pos.length; t += 9) {
      const ux = pos[t + 3] - pos[t], uy = pos[t + 4] - pos[t + 1], uz = pos[t + 5] - pos[t + 2], vx = pos[t + 6] - pos[t], vy = pos[t + 7] - pos[t + 1], vz = pos[t + 8] - pos[t + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, nl = Math.hypot(nx, ny, nz) || 1;
      const gy = (pos[t + 1] + pos[t + 4] + pos[t + 7]) / 3, gz = (pos[t + 2] + pos[t + 5] + pos[t + 8]) / 3 - cz;
      let lato;
      if (radiale) { const rl = Math.hypot(gy - radiale, gz) || 1; lato = (ny * (gy - radiale) + nz * gz) / (nl * rl) > .3; }
      else lato = Math.abs(nz / nl) > .5;
      const R = gz > 0 ? VR : VL;
      for (let k = 0; k < 3; k++) {
        const i = t + k * 3, j = (t / 3 + k) * 2, x = pos[i], y = pos[i + 1];
        uv[j] = (x - bb[0]) * sx;
        uv[j + 1] = lato ? R[0] + (R[1] - R[0]) * Math.max(0, Math.min(1, (y - bb[1]) * sy)) : VW[0] + .01 + .08 * Math.max(0, Math.min(1, (y - bb[1]) * sy));
      }
    }
    return uv;
  }
  function prGeo(pos, uv, ang, edge) {
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', uv instanceof Float32Array ? new T.BufferAttribute(uv, 2) : new T.Float32BufferAttribute(uv, 2));
    return K.crease(g, ang || 40, { edge: !!edge });
  }
  // quadrilatero con l'orientamento voluto (normale verso w)
  function prQuad(pos, a, b, c, d, w) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (nx * w[0] + ny * w[1] + nz * w[2] >= 0) pos.push(...a, ...b, ...c, ...a, ...c, ...d); else pos.push(...a, ...c, ...b, ...a, ...d, ...c);
  }

  // scatola di culatta tonda (tubo spesso) con finestre: xs = stazioni lungo X, as = angoli da 0 a 2PI (0 = sopra, PI/2 = destra),
  // vuoto(xm, am) = la cella di centro (xm, am) è aperta (finestra di espulsione, tacca del manubrio); c = smusso alle estremità
  function prTubo(xs, ro, ri, vuoto, o) {
    o = o || {}; const cy = o.cy || 0, cz = o.cz || 0, c = o.c || 0, pos = [];
    let as = []; const nseg = o.seg || 48, extra = (o.angoli || []).map(a => ((a % (2 * PI)) + 2 * PI) % (2 * PI));
    for (let k = 0; k < nseg; k++) { const a = 2 * PI * k / nseg; if (!extra.some(e => Math.abs(e - a) < .035)) as.push(a); }
    as = as.concat(extra).sort((p, q) => p - q); as.push(as[0] + 2 * PI);
    const nx = xs.length - 1, na = as.length - 1;
    const P = (x, r, a) => [x, cy + Math.cos(a) * r, cz + Math.sin(a) * r];
    const rO = i => (c && (i === 0 || i === nx)) ? ro - c : ro;
    const S = []; for (let i = 0; i < nx; i++) { S.push([]); for (let j = 0; j < na; j++) S[i].push(!vuoto((xs[i] + xs[i + 1]) / 2, (as[j] + as[j + 1]) / 2 % (2 * PI))); }
    const tan = a => [0, -Math.sin(a), Math.cos(a)];
    for (let i = 0; i < nx; i++) for (let j = 0; j < na; j++) {
      if (!S[i][j]) continue;
      const a0 = as[j], a1 = as[j + 1], x0 = xs[i], x1 = xs[i + 1];
      // esterno e interno
      { const A = P(x0, rO(i), a0), B = P(x1, rO(i + 1), a0), C = P(x1, rO(i + 1), a1), D = P(x0, rO(i), a1); pos.push(...A, ...C, ...B, ...A, ...D, ...C); }
      { const A = P(x0, ri, a0), B = P(x1, ri, a0), C = P(x1, ri, a1), D = P(x0, ri, a1); pos.push(...A, ...B, ...C, ...A, ...C, ...D); }
      // pareti verso le celle aperte (in angolo)
      if (!S[i][(j + 1) % na]) { const t = tan(a1); prQuad(pos, P(x0, ri, a1), P(x1, ri, a1), P(x1, rO(i + 1), a1), P(x0, rO(i), a1), t); }
      if (!S[i][(j + na - 1) % na]) { const t = tan(a0); prQuad(pos, P(x0, ri, a0), P(x1, ri, a0), P(x1, rO(i + 1), a0), P(x0, rO(i), a0), [0, -t[1], -t[2]]); }
      // pareti in X (estremità o celle aperte)
      if (i === nx - 1 || !S[i + 1][j]) prQuad(pos, P(x1, ri, a0), P(x1, rO(i + 1), a0), P(x1, rO(i + 1), a1), P(x1, ri, a1), [1, 0, 0]);
      if (i === 0 || !S[i - 1][j]) prQuad(pos, P(x0, ri, a0), P(x0, rO(i), a0), P(x0, rO(i), a1), P(x0, ri, a1), [-1, 0, 0]);
    }
    const uv = o.uv ? prUV(pos, o.uv, cz, cy) : (() => { const u = new Float32Array(pos.length / 3 * 2), L = xs[nx] - xs[0]; for (let k = 0; k < pos.length / 3; k++) { u[k * 2] = (pos[k * 3] - xs[0]) / L; u[k * 2 + 1] = .1 + .9 * (((Math.atan2(pos[k * 3 + 2] - cz, pos[k * 3 + 1] - cy) / (2 * PI)) + 1) % 1); } return u; })();
    return prGeo(pos, uv, 40, true);
  }

  // asta rastremata fra due punti 3D (manubri, gambe, perni)
  function prAsta(p0, p1, r0, r1, o) {
    o = o || {}; const d = new T.Vector3(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]), L = d.length(); d.normalize();
    const c = o.c === undefined ? Math.min(r0, r1) * .2 : o.c;
    const g = K.latheX([[0, 0], [0, r0 - c], [c, r0], [L - c, r1], [L, r1 - c], [L, 0]], { seg: o.seg || 14 });
    g.applyMatrix4(new T.Matrix4().makeRotationFromQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(1, 0, 0), d))); g.translate(p0[0], p0[1], p0[2]); return g;
  }
  // sfera o ellissoide (pomello del manubrio): centro c, raggio r, scala s = [sx, sy, sz]
  function prSfera(c, r, o) {
    o = o || {}; const n = o.n || 10, pr = [];
    for (let k = 0; k <= n; k++) { const t = PI * k / n; pr.push([-Math.cos(t) * r, Math.sin(t) * r]); }
    const g = K.latheX(pr, { seg: o.seg || 18 });
    if (o.s) g.scale(o.s[0], o.s[1], o.s[2]);
    if (o.dir) g.applyMatrix4(new T.Matrix4().makeRotationFromQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(1, 0, 0), new T.Vector3(...o.dir).normalize())));
    g.translate(c[0], c[1], c[2]); return g;
  }
  // tratto di canna scanalata (aperto alle estremità): raggio da R0 a R1, n gole profonde d, estremità arrotondate lunghe re
  function prScan(x0, x1, R0, R1, o) {
    o = o || {}; const n = o.n || 6, d = o.d || 2, re = o.re || 16, hw = PI / n * (o.fr || .58), N = n * (o.sub || 8), off = o.off === undefined ? 0 : o.off;
    const xs = []; for (let k = 0; k <= 5; k++) { const t = k / 5; xs.push(x0 + re * (1 - Math.cos(t * PI / 2))); }
    for (let x = x0 + re + 40; x < x1 - re - 20; x += 40) xs.push(x);
    for (let k = 5; k >= 0; k--) { const t = k / 5; xs.push(x1 - re * (1 - Math.cos(t * PI / 2))); }
    const e = x => { const t = Math.min(1, (x - x0) / re, (x1 - x) / re); return t <= 0 ? 0 : Math.sqrt(1 - (1 - t) * (1 - t)); };
    const R = x => R0 + (R1 - R0) * (x - x0) / (x1 - x0);
    const rad = (x, a) => { let da = ((a - off) % (2 * PI / n) + 2 * PI / n) % (2 * PI / n); da = Math.min(da, 2 * PI / n - da); const g = da < hw ? Math.pow(1 - (da / hw) * (da / hw), .55) : 0; return R(x) - d * e(x) * g; };
    const pos = [], uv = [], cy = o.cy || 0, cz = o.cz || 0;
    const P = (x, a) => { const r = rad(x, a); return [x, cy + Math.cos(a) * r, cz + Math.sin(a) * r]; };
    for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < N; j++) {
      const a0 = 2 * PI * j / N, a1 = 2 * PI * (j + 1) / N, A = P(xs[i], a0), B = P(xs[i + 1], a0), C = P(xs[i + 1], a1), D = P(xs[i], a1);
      pos.push(...A, ...C, ...B, ...A, ...D, ...C);
      const ua = (xs[i] - x0) / (x1 - x0), ub = (xs[i + 1] - x0) / (x1 - x0), va = .1 + .9 * j / N, vb = .1 + .9 * (j + 1) / N;
      uv.push(ua, va, ub, vb, ub, va, ua, va, ua, vb, ub, vb);
    }
    return prGeo(pos, uv, 52, false);
  }
  // tiene solo i triangoli che soddisfano f(centro, normale) (pannelli di zigrinatura sovrapposti)
  function prFiltra(geo, f) {
    const p = geo.attributes.position.array, n = geo.attributes.normal.array, u = geo.attributes.uv.array, w = geo.attributes.wear.array, P = [], N = [], U = [], W = [];
    for (let t = 0; t < p.length / 9; t++) {
      const c = [(p[t * 9] + p[t * 9 + 3] + p[t * 9 + 6]) / 3, (p[t * 9 + 1] + p[t * 9 + 4] + p[t * 9 + 7]) / 3, (p[t * 9 + 2] + p[t * 9 + 5] + p[t * 9 + 8]) / 3];
      const nn = [(n[t * 9] + n[t * 9 + 3] + n[t * 9 + 6]) / 3, (n[t * 9 + 1] + n[t * 9 + 4] + n[t * 9 + 7]) / 3, (n[t * 9 + 2] + n[t * 9 + 5] + n[t * 9 + 8]) / 3];
      if (!f(c, nn)) continue;
      for (let k = 0; k < 9; k++) { P.push(p[t * 9 + k]); N.push(n[t * 9 + k]); W.push(w[t * 9 + k]); }
      for (let k = 0; k < 6; k++) U.push(u[t * 6 + k]);
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(N, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(U, 2)); g.setAttribute('wear', new T.Float32BufferAttribute(W, 3)); return g;
  }
  // ingrandisce una geometria attorno al centro di ogni sezione (copertura sottile per pannelli e parti sovrapposte)
  function prGonfia(geo, d) {
    const p = geo.attributes.position.array, n = geo.attributes.normal.array;
    for (let i = 0; i < p.length; i++) p[i] += n[i] * d;
    geo.attributes.position.needsUpdate = true; return geo;
  }

  // bipiede: tipo 'leggero' (gambe telescopiche con molle, attacco alla maglietta), 'pesante' (12,7: gambe larghe con pattini);
  // aperto = gambe verso il basso, chiuso = ripiegate in avanti sotto il guardamano. Attacco in (x, y).
  function prBipiede(x, y, o) {
    o = o || {}; const out = [], m = o.mat || K.mat('nero', null, { r: .5 }), mg = K.mat('gomma'), L = o.len || 230, open = !!o.open, tipo = o.tipo || 'leggero';
    const mI = K.mat('grigio', null, { c: '#4a4d52', r: .35, m: .8 });
    if (tipo === 'pesante') {
      out.push([K.box(x - 26, y - 22, -24, x + 26, y, 24, 3, 6), m]);
      out.push([K.rod(x - 30, x + 30, 7, { cy: y - 14, seg: 18 }), m]);
      for (const s of [-1, 1]) {
        const g = K.mergeG([K.rod(0, L * .62, 8, { seg: 16 }), K.rod(L * .55, L, 6, { seg: 14 })]);
        const f = K.box(L - 4, -26, -18, L + 6, 26, 18, 2, 6);   // pattino
        for (const gg of [g, f]) { if (open) { gg.rotateZ(-PI / 2 + .1); gg.rotateX(-s * .42); } else { gg.rotateZ(.03); } gg.translate(x, y - 14, s * (open ? 20 : 16)); }
        out.push([g, m], [f, m]);
      }
      return out;
    }
    // corpo con l'attacco alla maglietta e la vite di bloccaggio
    out.push([K.box(x - 15, y - 15, -12, x + 15, y, 12, 1.5, 3), m]);
    out.push([K.rod(0, 9, 5, { seg: 14 }).rotateZ(-PI / 2).translate(x, y - 14, 0), m]);
    out.push([K.box(x - 6, y - 4, -3, x + 6, y + 6, 3, .8), m]);
    for (const s of [-1, 1]) {
      const g = K.mergeG([K.rod(0, L * .56, 5.2, { seg: 14 }), K.rod(L * .5, L * .58, 6.2, { seg: 14 })]);
      const gi = K.rod(L * .5, L - 6, 3.7, { seg: 12 });
      const gf = K.latheX([[L - 8, 0], [L - 8, 5.5], [L - 4, 7], [L + 4, 6.5], [L + 8, 3], [L + 9, 0]], { seg: 14 });
      const gm = K.mergeG([0, 1, 2, 3, 4, 5].map(k => K.rod(L * .12 + k * 6.5, L * .12 + k * 6.5 + 2.6, 6.4, { seg: 12 })));   // molla
      for (const gg of [g, gi, gf, gm]) { if (open) { gg.rotateZ(-PI / 2 - .05); gg.rotateX(-s * .16); } else { gg.rotateZ(.015); } gg.translate(x - 6, y - 9, s * (open ? 15 : 11)); }
      out.push([g, m], [gi, mI], [gf, mg], [gm, m]);
    }
    return out;
  }
  // cannocchiale con anelli; aggiunge i punti 'ottica', 'mira_post' (oculare) e 'mira_ant' (obiettivo)
  function prOttica(A, o) {
    WC.put(A, WC.scope(o));
    if (o.sole) A.add(K.tube(o.x1 - 2, o.x1 + o.sole, o.ro + .3, o.ro - 1.4, { seg: 32, cy: o.y }), K.mat('anod', null, { r: .55 }));
    if (o.tappi) { // tappo dell'obiettivo ribaltato in alto sulla cerniera e anello dell'oculare in gomma
      const xe = o.x1 + (o.sole || 0), R = o.ro + 1.6, mt = K.mat('polimero', null, { r: .5 });
      const g = K.latheX([[0, R - 1.5], [0, R], [7, R], [8, R - 1], [8, 0]], { seg: 28 }); g.translate(xe - 3, o.y, 0);
      A.add(K.xf(g, { r: [0, -1.75, 0], p: [xe + 5, o.y, -R - 1] }), mt);          // tappo aperto di lato, contro la campana
      A.add(K.box(xe - 2, o.y - 5, -R - 4, xe + 6, o.y + 5, -R + 1, .8), mt);      // cerniera sul fianco sinistro
      A.add(K.latheX([[o.x0 - 14, o.re - 2], [o.x0 - 14, o.re + 1], [o.x0 - 2, o.re + 1.6], [o.x0 + 2, o.re + .5], [o.x0 + 2, o.re - 2]], { seg: 28, cy: o.y }), K.mat('gomma'));
      A.anchor('ottica', [o.x0 - 14, o.y, 0]); A.anchor('mira_post', [o.x0 - 14, o.y, 0]); A.anchor('mira_ant', [xe, o.y, 0]); return;
    }
    A.anchor('ottica', [o.x0, o.y, 0]); A.anchor('mira_post', [o.x0, o.y, 0]); A.anchor('mira_ant', [o.x1 + (o.sole || 0), o.y, 0]);
  }

  // pannello di zigrinatura: ricostruisce un solido (funzione geo), tiene i triangoli voluti (filtro su centro e normale) e li solleva
  // di d mm lungo la normale; il materiale ha la quadrettatura ripetuta
  function prZigrina(A, geo, filtro, mat, d) { A.add(prGonfia(prFiltra(geo(), filtro), d || .35), mat); }
  // grilletto curvo con perno in alto (x, y), altezza h
  function prGrilletto(A, x, y, h, m, o) {
    o = o || {}; const w = o.w || 3;
    A.add(K.slab([[x - 2.6, y + 2, .5], [x + 2.6, y + 2, .5], [x + 3.4, y - h * .42, h * .5], [x + 1.4, y - h, 1.4], [x - 1.6, y - h + .6, 1.2], [x - .4, y - h * .42, h * .5]], -w, w, { b: .8 }), m, 'grilletto');
    A.pivot('grilletto', [x, y + 2, 0]);
  }
  // manubrio dell'otturatore: stelo da p0 al pomello in p1 (raggio rk), parte 'leva'
  function prManubrio(A, p0, p1, r0, r1, rk, m, mk, o) {
    o = o || {};
    A.add(prAsta(p0, p1, r0, r1, { seg: 14 }), m, 'leva');
    A.add(prSfera(p1, rk, { s: o.s, dir: o.dir, seg: 20, n: 12 }), mk || m, 'leva');
  }


  // azione con scatola tonda (otturatore a due tenoni anteriori): scatola con finestra a destra e tacca del manubrio, anello del
  // ritegno; otturatore (leva) con corpo, codolo e manubrio a pomello sferico. o = {L, port: [x0, x1], fin, matO, matM, pomo, rk, sigla, cal}
  function prAzioneTonda(A, spec, o) {
    o = o || {};
    const L = o.L || 216, RR = 17.2, RI = 9.2, p0 = (o.port || [84, 156])[0], p1 = (o.port || [84, 156])[1], fin = o.fin || 'brunito';
    const rb = [-20, -20, L + 20, 20], xt = (p1 + L) / 2;
    const pR = K.painter(rb, { w: 1024, h: 512, rough: o.rough || .36 });
    pR.text('L', (spec.produttore || '').toUpperCase(), xt, 8.6, 2.5, { spacing: 2 });
    pR.text('L', (spec.nome || '').toUpperCase(), xt, 4.6, 2.1, { spacing: 3 });
    pR.text('R', prMatr(spec, o.sigla || 'N. '), xt, 8.4, 2.1);
    pR.text('R', 'CAL. ' + (o.cal || String(spec.calibro || '').replace(' mm', '')), xt, 4.6, 2.0);
    for (const x of [6, L - 6]) pR.pin('LR', x, 10, 1.2, { h: .2 });
    pR.noise({ a: .08, r: .12, seed: 21 }); pR.walls({ r: .36 });
    const mRcv = K.mat(fin, pR.done(2.0), { ns: .7 });
    A.add(prTubo([0, 1.6, 22, p0, p1, L - 1.8, L], RR, RI, (x, a) => (x > p0 && x < p1 && a > .14 && a < 1.62) || (x < 22 && a > 1.36 && a < 1.92),
      { c: 1.6, angoli: [.14, 1.62, 1.36, 1.92], uv: rb }), mRcv);
    const mB = K.mat(fin);
    A.add(K.latheX([[L, 0], [L, 17], [L + 1, 17.6], [L + 4, 17.6], [L + 5, 16.5], [L + 5, 0]], { seg: 40 }), mB);   // anello del ritegno
    // otturatore (parte 'leva'): corpo, codolo con il cane armato sotto, manubrio
    const mO = o.matO || K.mat('inox', null, { c: '#b9bcc0', r: .18 }), mM = o.matM || mO;
    A.add(K.rod(-6, p1 + 24, 8.8, { seg: 28 }), mO, 'leva');
    A.add(K.latheX(o.codolo || [[-42, 0], [-42, 5.5], [-40.5, 9], [-34, 11.4], [-8, 12.4], [-4, 12.8], [-1.5, 12.8], [-1.5, 0]], { seg: 32 }), mB, 'leva');
    if (!o.codolo) A.add(K.box(-47, -11, -3.2, -36, -5, 3.2, .8), mB, 'leva');
    prManubrio(A, [12, -.5, 8], o.pomo || [-5, -28, 47], 4.8, 4.1, o.rk || 9.2, mM, o.matK || mM);
    A.pivot('leva', [0, 0, 0]);
    if (o.sicura !== false) A.add(K.slab([[-14, -10, 1], [-3, -10, 1], [-3, -4.5, 1], [-12, -5.5, 1]], 11, 14.5, { b: .6 }), mB);   // sicura a destra
    return { L, RR, mB, mRcv };
  }
  // trame dei calci in fibra verniciati, disegnate con le funzioni del canvas e ripetibili: 'macchie' (mimetica a chiazze),
  // 'ragnatela' (verde con spruzzi neri sottili). Ogni materiale ha la sua ripetizione (u lungo il pezzo, v attorno).
  const PR_TR = {};
  function prTrama(tipo) {
    if (PR_TR[tipo]) return PR_TR[tipo];
    const N = 512, c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d'); let s = 3;
    const rnd = () => K.hash(s++, 7, 91);
    if (tipo === 'macchie') {
      x.fillStyle = '#424a31'; x.fillRect(0, 0, N, N);
      ['#4e3d2a', '#29331f', '#141512', '#36432a'].forEach((col, ci) => {
        x.fillStyle = col;
        for (let i = 0; i < 22; i++) {
          const cx = rnd() * N, cy = rnd() * N, rr = 16 + rnd() * 30, rot = rnd() * PI, n = 7, lob = [];
          for (let k = 0; k < n; k++) lob.push(.62 + .55 * rnd());
          for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]) {
            x.save(); x.translate(cx + dx, cy + dy); x.rotate(rot); x.beginPath();
            for (let k = 0; k <= n; k++) { const a = k / n * 2 * PI, rad = rr * lob[k % n], px = Math.cos(a) * rad * 1.6, py = Math.sin(a) * rad * .8;
              if (!k) x.moveTo(px, py); else { const am = (k - .5) / n * 2 * PI, rm = rr * (lob[k % n] + lob[k - 1]) * .62; x.quadraticCurveTo(Math.cos(am) * rm * 1.6, Math.sin(am) * rm * .8, px, py); } }
            x.closePath(); x.fill(); x.restore();
          }
        }
      });
    } else {
      x.fillStyle = '#3c4330'; x.fillRect(0, 0, N, N);
      x.lineCap = 'round';
      for (let i = 0; i < 1600; i++) {
        const px = rnd() * N, py = rnd() * N, l = 3 + rnd() * 16, a = rnd() * 2 * PI, k = rnd();
        x.strokeStyle = k < .6 ? 'rgba(14,15,12,.9)' : (k < .85 ? 'rgba(34,38,26,.85)' : 'rgba(92,98,72,.55)'); x.lineWidth = .7 + rnd() * 1.3;
        for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]) { x.beginPath(); x.moveTo(px + dx, py + dy); x.quadraticCurveTo(px + dx + Math.cos(a + 1) * l * .6, py + dy + Math.sin(a + 1) * l * .6, px + dx + Math.cos(a) * l, py + dy + Math.sin(a) * l); x.stroke(); }
      }
    }
    const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.encoding = T.sRGBEncoding; t.anisotropy = 4;
    return PR_TR[tipo] = t;
  }
  function prMatTrama(tipo, rep, o) {
    o = o || {}; const t = prTrama(tipo).clone(); t.needsUpdate = true; t.repeat.set(rep[0], rep[1]);
    return K.mat(o.kind || 'oliva', { map: t }, { c: '#ffffff', r: o.r || .72, m: .02 });
  }


  // scatola a fianchi piatti (fucili a pollice passante e a telaio): mezza sinistra piena, mezza destra con la finestra, scritte incise,
  // slitta integrale sopra; otturatore (leva) con codolo cilindrico e manubrio a pomello grande.
  // o = {L, yb, yt, hw, port: [x0, x1, y], rail: [x0, x1], fin, cal, sigla, pomo: [x,y,z], rk, matK}
  function prCulattaPiatta(A, spec, o) {
    const L = o.L, yb = o.yb, yt = o.yt, hw = o.hw, p = o.port, fin = o.fin || 'nero', mDk = K.mat('nero_lucido', null, { c: '#060606', r: .7 });
    const rb = [-10, yb - 2, L + 10, yt + 2], xt = o.xt || (p[0] + 6) / 2 + L * .25;
    const pR = K.painter(rb, { w: 1024, h: 512, rough: o.rough || .5 });
    pR.text('L', (spec.produttore || '').toUpperCase(), L * .5, (yt + yb) / 2 + 4.5, 3.2, { spacing: 3 });
    pR.text('L', (spec.nome || '').toUpperCase(), L * .5, (yt + yb) / 2 - 1.5, 2.6, { spacing: 3 });
    pR.text('R', prMatr(spec, o.sigla || 'N. '), (p[1] + L) / 2, (yt + yb) / 2 + 4, 2.2);
    pR.text('R', 'CAL. ' + (o.cal || String(spec.calibro || '').replace(' mm', '')), (p[1] + L) / 2, (yt + yb) / 2 - 1, 2.2);
    for (const [x, y] of [[8, yb + 6], [L - 8, yb + 6], [L * .38, yb + 5]]) pR.pin('LR', x, y, 2, { h: .4, a: .9 });
    pR.noise({ a: .1, r: .16, seed: 13 }); pR.walls({ r: .5 });
    const mR = K.mat(fin, pR.done(2.2), { ns: .8, c: o.c });
    const ext = [[0, yb, 1.5, .5], [L, yb, 1.5, .5], [L, yt - 3, 3, 1], [L - 3, yt, 3, 1], [3, yt, 3, 1], [0, yt - 3, 3, 1]];
    const prt = [[0, yb, 1.5, .5], [L, yb, 1.5, .5], [L, yt - 3, 3, 1], [L - 3, yt, 3, 1], [p[1], yt, .6, .4], [p[1], p[2], 1.2, .3], [p[0], p[2], 1.2, .3], [p[0], yt, .6, .4], [3, yt, 3, 1], [0, yt - 3, 3, 1]];
    A.add(K.slab(ext, -hw, 0, { bL: 1.6, bR: 0, uv: rb }), mR);
    A.add(K.slab(prt, 0, hw, { bL: 0, bR: 1.6, uv: rb }), mR);
    A.add(K.box(p[0], p[2] - 12, -hw + 3, p[1], p[2], hw - 3, 0), mDk);
    if (o.rail) WC.put(A, WC.rail(o.rail[0], o.rail[1], yt - .5, { mat: K.mat(o.finRail || 'anod') }));
    // otturatore: corpo lucido, codolo, manubrio
    const mO = o.matO || K.mat('grigio', null, { c: '#83878c', r: .25, m: .9 }), mB = K.mat(fin);
    const rbo = o.rbo || 10;
    A.add(K.rod(-6, p[1] + 14, rbo, { seg: 28 }), mO, 'leva');
    A.add(K.latheX(o.codolo || [[-46, 0], [-46, 7], [-44, 10.5], [-30, 12.5], [-8, 13], [-3, 13.5], [-1.2, 13.5], [-1.2, 0]], { seg: 30 }), mB, 'leva');
    prManubrio(A, [14, -.5, rbo - 1], o.pomo || [-6, -30, 52], 5.4, 4.6, o.rk || 11, mB, o.matK || K.mat('polimero', null, { r: .5 }), { s: o.sk });
    A.pivot('leva', [0, 0, 0]);
    return { mR, mB, mDk };
  }
  // freno di bocca cilindrico a deflettori: corpo, n camere aperte sui fianchi (ponti sopra e sotto), foro scuro
  function prFreno(x0, len, r, o) {
    o = o || {}; const n = o.n || 3, m = o.mat || K.mat('nero', null, { r: .45 }), dk = K.mat('nero_lucido', null, { c: '#050505', r: .7 }), out = [];
    const xb = x0 + (o.base || 16), cell = (x0 + len - 6 - xb) / n;
    out.push([K.latheX([[x0, 0], [x0, r - 1.2], [x0 + 1.2, r], [xb + 1, r], [xb + 1, 0]], { seg: 32 }), m]);
    for (let i = 0; i < n; i++) {
      const a = xb + i * cell, w = cell * (o.win || .62);
      out.push([K.rod(a + w - .2, a + cell + .2, r, { seg: 32, c: .6 }), m]);    // deflettore
      out.push([K.rod(a - .1, a + w + .1, r * .55, { seg: 20, c: 0 }), dk]);      // anima scura nella camera
      out.push([K.slab([[a - .2, r * .5, 0], [a + w + .2, r * .5, 0], [a + w + .2, r * .97, 0], [a - .2, r * .97, 0]], -r * .5, r * .5, { b: .4 }), m]);   // ponte sopra
      out.push([K.slab([[a - .2, -r * .97, 0], [a + w + .2, -r * .97, 0], [a + w + .2, -r * .5, 0], [a - .2, -r * .5, 0]], -r * .5, r * .5, { b: .4 }), m]);  // ponte sotto
    }
    out.push([K.latheX([[x0 + len - 6, 0], [x0 + len - 6, r], [x0 + len - .8, r], [x0 + len, r - .8], [x0 + len, 0]], { seg: 32 }), m]);
    out.push([K.discX(x0 + len + .05, 0, 0, o.foro || r * .4, 1, 18), dk]);
    return out;
  }

  // ================================================================ 105: carabina a otturatore con calcio in legno (Monte Carlo)
  // scatola tonda, otturatore lucido, canna sottile rastremata, calcio in noce con poggiaguancia, puntale e coccia neri
  FAM2.prec_otturatore_legno = function (spec, o) {
    o = o || {}; spec = spec || {};
    const A = K.asm('prec_otturatore_legno');
    const mBl = K.mat('brunito'), mDk = K.mat('nero_lucido', null, { c: '#060606', r: .7 });
    const mBolt = K.mat('inox', null, { c: '#b9bcc0', r: .18 }), mHan = K.mat('inox', null, { c: '#9a9ea3', r: .24 });
    const mWood = K.mat('legno_noce', null, { c: '#a8826c' }), mEb = K.mat('nero_lucido', null, { c: '#140f0c', r: .28 }), mPad = K.mat('gomma'), mWh = K.mat('bianco');
    const RR = 17.2, RI = 9.2, XF = 216, XM = 752;
    // ---------------- scatola tonda con finestra a destra, otturatore lucido (leva) con manubrio a pomello
    prAzioneTonda(A, spec, { L: XF, port: [84, 156], sigla: 'RW ', matO: mBolt, matM: mHan });
    // ---------------- canna rastremata con corona e mirino a rampa
    A.add(K.latheX([[XF + 5, 13.8], [XF + 20, 13.8], [XF + 25, 13.1], [XM - 10, 8.6], [XM - 1.2, 8.5], [XM, 7.6], [XM, 4.3], [XM - 2, 3.9], [XM - 10, 3.9]], { seg: 36 }), mBl);
    A.add(K.discX(XM - 9, 0, 0, 4, 1, 18), mDk);
    A.add(K.slab([[692, 7.2, 2], [718, 7.2, 0], [730, 7.2, 1], [730, 14.5, 1], [717, 14.5, 3], [700, 9.6, 8]], -3.4, 3.4, { b: .8 }), mBl);
    A.add(K.slab([[721, 13, .4], [725, 13, .4], [724.5, 19.5, .6], [721.5, 19.5, .6]], -.9, .9, { b: .3 }), mBl);
    A.add(K.discX(721.4, 19, 0, 1.1, -1, 12), K.mat('ottone'));
    // ---------------- cannocchiale da caccia su basi e anelli
    prOttica(A, { x0: -58, x1: 282, y: 46, rt: 12.7, ro: 24, re: 19, rings: [40, 182], yb: 13, parallax: false });
    // ---------------- calcio in noce: calciolo, impugnatura a pistola, zona dell'azione e astina
    const st = (x, t, b, w, nt, nb) => ({ x, t, b, w, nt: nt || 2.6, nb: nb || 2.4 });
    A.add(K.loftX([st(-279, -19, -146, 20), st(-262, -15, -141, 20.3), st(-200, -8, -124, 19.6), st(-150, -6, -110, 18.8), st(-112, -7, -97, 17.8),
      st(-94, -11, -94, 16.8), st(-78, -13, -95, 15.8), st(-64, -12.5, -98, 15.4), st(-50, -12.5, -100, 15.2)], { K: 34, step: 6 }), mWood);
    // impugnatura a pistola: il filo inferiore del calcio scende dolcemente nel dorso dell'impugnatura
    const gp = [{ p: [-50, -38], f: 33, r: 31, w: 15.4 }, { p: [-43, -60], f: 26, r: 26, w: 15.6 }, { p: [-39, -82], f: 22.5, r: 24, w: 16 }, { p: [-37, -98], f: 19.5, r: 21, w: 15.4 }];
    A.add(K.loftS(gp.map(q => Object.assign({ nf: 2.3, nr: 2.2 }, q)), { K: 30, sub: 4 }), mWood);
    const mZ = (ru, rv) => K.mat('bachelite', null, { c: '#4a2a1a', tile: 'checker', rep: [ru, rv], r: .62, ns: 1 });
    prZigrina(A, () => K.loftS(gp.map(q => Object.assign({ nf: 2.3, nr: 2.2 }, q)), { K: 48, sub: 8 }), (c, n) => Math.abs(n[2]) > .5 && c[1] < -50 && c[1] > -92, mZ(5, 9));
    // coccia nera con filetto bianco
    { const d = [2, -16], l = Math.hypot(d[0], d[1]), u = [d[0] / l, d[1] / l], p0 = [-37, -98];
      A.add(K.loftS([{ p: [p0[0] - u[0] * .5, p0[1] - u[1] * .5], f: 19.8, r: 21.3, w: 15.6, nf: 2.3, nr: 2.2 }, { p: [p0[0] + u[0] * 1.2, p0[1] + u[1] * 1.2], f: 19.8, r: 21.3, w: 15.6, nf: 2.3, nr: 2.2 }], { K: 30, sub: 1 }), mWh);
      A.add(K.loftS([{ p: [p0[0] + u[0] * 1.2, p0[1] + u[1] * 1.2], f: 19.6, r: 21.1, w: 15.4, nf: 2.3, nr: 2.2 }, { p: [p0[0] + u[0] * 6, p0[1] + u[1] * 6], f: 18.4, r: 19.8, w: 14.4, nf: 2.3, nr: 2.2 }], { K: 30, sub: 1 }), mEb); }
    A.add(K.loftX([st(-40, -12.5, -50, 15, 6, 2.4), st(-6, -12.5, -50, 16.4, 6, 2.4), Object.assign(st(-1, -4, -50, 18, 7, 2.4), { lin: true }), st(XF, -4, -50, 18.6, 7, 2.4),
      st(240, -3, -46, 18.8, 6, 2.4), st(300, -2.5, -42, 19, 6, 2.4), st(380, -2.5, -37, 18, 6, 2.4), st(430, -3, -33, 16.4, 6, 2.4)], { K: 34, step: 6 }), mWood);
    prZigrina(A, () => K.loftX([st(240, -3, -46, 18.8, 6, 2.4), st(300, -2.5, -42, 19, 6, 2.4), st(380, -2.5, -37, 18, 6, 2.4), st(430, -3, -33, 16.4, 6, 2.4)], { K: 52, step: 3 }),
      (c, n) => Math.abs(n[2]) > .55 && c[0] > 262 && c[0] < 404 && c[1] > -34 && c[1] < -8, mZ(24, 9));
    // puntale nero con filetto bianco
    A.add(K.loftX([st(429.5, -3, -33, 16.5, 6, 2.4), st(431.5, -3, -33, 16.5, 6, 2.4)], { K: 34, step: 0 }), mWh);
    A.add(K.loftX([st(431.5, -3, -33, 16.4, 6, 2.4), st(446, -3.6, -31.5, 15.6, 6, 2.4), st(452, -5.5, -29, 13, 5, 2.4)], { K: 34, step: 3 }), mEb);
    // poggiaguancia (lato sinistro) del calcio Monte Carlo
    A.add(K.loftX([{ x: -248, t: -17, b: -52, w: 5, cz: -16.5, nt: 2.4, nb: 2.2 }, { x: -230, t: -13, b: -60, w: 7, cz: -16.5 }, { x: -170, t: -10, b: -60, w: 7.2, cz: -16 },
      { x: -132, t: -11, b: -52, w: 6, cz: -15 }, { x: -118, t: -14, b: -40, w: 3, cz: -14 }].map(s => Object.assign({ nt: 2.4, nb: 2.2 }, s)), { K: 24, step: 6 }), mWood);
    // calciolo in gomma con filetto bianco
    A.add(K.loftX([st(-281, -19.2, -146.4, 20.2), st(-279, -19.2, -146.4, 20.2)], { K: 34, step: 0 }), mWh);
    A.add(K.loftX([st(-302, -18.6, -147.6, 19.8), st(-296, -19, -147.4, 20.4), st(-281, -19.2, -146.6, 20.3)], { K: 34, step: 0 }), mPad);
    // ---------------- ponticello con sportello del serbatoio, grilletto
    A.add(K.slab([[-6, -49], [64, -49], [64, -53, 1], [58, -56, 4], [52, -71, 8], [24, -75, 11], [8, -64, 7], [0, -55, 4], [-6, -51, 1]], -6, 6,
      { b: 1, holes: [[[9, -54.5, 3], [53, -54.5, 3], [47, -68, 6], [25, -70.5, 8], [14, -62, 4]]] }), mBl);
    A.add(K.slab([[64, -52.5, 1], [166, -52.5, 3], [170, -49, 0], [64, -49, 0]], -11, 11, { b: 1 }), mBl);
    prGrilletto(A, 34, -50, 17.5, mBl);
    // maglie della cinghia
    A.add(K.rod(-4, 4, 3, { seg: 12 }).rotateZ(PI / 2).translate(395, -37, 0), mBl); WC.put(A, WC.swivel(395, -45, 0, { r: 8, t: 1.5 }));
    A.add(K.rod(-4, 4, 3, { seg: 12 }).rotateZ(PI / 2 + .2).translate(-232, -133, 0), mBl); WC.put(A, WC.swivel(-234, -142, 0, { r: 8, t: 1.5, rot: 0 }));
    // ---------------- punti di riferimento
    A.anchor('bocca', [XM + .5, 0, 0]); A.anchor('espulsione', [120, 12, 14], [0, .5, 1]); A.anchor('impugnatura', [-32, -68, 0]);
    A.anchor('grilletto', [36, -60, 0]); A.anchor('appoggio', [330, -42, -6]); A.anchor('calcio', [-302, -83, 0]);
    const r = A.done();
    r.info = { azione: 'otturatore', bossolo: 'fucile', ciclo: { grilletto: { rz: -.12 } }, manuale: [{ leva: { rx: -1.45 } }, { leva: { rx: -1.45, dx: -.092 } }],
      ricarica: { leva: { rx: -1.45, dx: -.092 } }, serbatoio: 'interno' };
    return r;
  };

  // ponticello sportivo con lo sportello del serbatoio (serbatoio interno): arco del ponticello dietro (da x0), sportello lungo lf; yb = fondo del calcio
  function prPonticello(A, x0, yb, lf, m) {
    const Y = y => y + 49 + yb, X = x => x + x0 + 6;
    A.add(K.slab([[X(-6), Y(-49)], [X(64), Y(-49)], [X(64), Y(-53), 1], [X(58), Y(-56), 4], [X(52), Y(-71), 8], [X(24), Y(-75), 11], [X(8), Y(-64), 7], [X(0), Y(-55), 4], [X(-6), Y(-51), 1]], -6, 6,
      { b: 1, holes: [[[X(9), Y(-54.5), 3], [X(53), Y(-54.5), 3], [X(47), Y(-68), 6], [X(25), Y(-70.5), 8], [X(14), Y(-62), 4]]] }), m);
    if (lf > 0) A.add(K.slab([[X(64), Y(-52.5), 1], [X(64 + lf), Y(-52.5), 3], [X(68 + lf), Y(-49), 0], [X(64), Y(-49), 0]], -11, 11, { b: 1 }), m);
    // viti della guardia e perno dello sportello
    for (const x of [X(-2), X(60 + lf)]) A.add(K.discX(0, 0, 0, 2.6, -1, 14).rotateZ(PI / 2).translate(x, Y(-53.2), 0), K.mat('nero_lucido', null, { c: '#0b0b0b' }));
  }

  // ================================================================ 106, 110: fucili di precisione a otturatore con calcio sintetico tattico
  // stessa azione tonda, canna pesante opaca, calcio in fibra a comb alto e dritto, impugnatura quasi verticale con rigonfiamento, astina larga
  // a fondo piatto. var 'marine' = calcio mimetico a chiazze, cannocchiale lungo e sottile a tubo da 25 mm, niente bipiede;
  // 'esercito' = calcio verde a ragnatela, calciolo regolabile staccato su due perni, base unica, cannocchiale da 30 mm con torretta alta,
  // base del mirino metallico in volata, bipiede ripiegato sotto l'astina.
  FAM2.prec_otturatore_tattico = function (spec, o) {
    o = o || {}; spec = spec || {}; const es = o.var === 'esercito';
    const A = K.asm('prec_otturatore_tattico');
    const mNe = K.mat('nero', null, { r: .55 }), mDk = K.mat('nero_lucido', null, { c: '#060606', r: .7 }), mPad = K.mat('gomma'), mAn = K.mat('anod');
    const mBolt = K.mat('grigio', null, { c: '#80848a', r: .28, m: .85 });
    const L = es ? 238 : 216, port = es ? [88, 172] : [84, 156], XM = es ? 802.5 : 788.5, XB = es ? -264 : -305;
    prAzioneTonda(A, spec, { L, port, fin: 'nero', sigla: 'RW ', matO: mBolt, matM: K.mat('nero', null, { r: .4 }), rough: .5 });
    // ---------------- canna pesante opaca con corona
    A.add(K.latheX([[L + 5, 15], [L + 20, 15], [L + 30, 14.3], [XM - 9, 11.3], [XM - 1.2, 11.2], [XM, 10.4], [XM, 4.3], [XM - 2, 3.9], [XM - 10, 3.9]], { seg: 40 }), mNe);
    A.add(K.discX(XM - 9, 0, 0, 4, 1, 18), mDk);
    if (es) { // base del mirino a diottra (smontato)
      A.add(K.slab([[XM - 44, 8, 0], [XM - 12, 8, 0], [XM - 12, 14.8, 1], [XM - 40, 14.8, 2]], -7.5, 7.5, { b: .8 }), mNe);
      A.add(K.slabX([[-5.5, 14.4, .3], [5.5, 14.4, .3], [4, 17.4, .4], [-4, 17.4, .4]], XM - 38, XM - 16, { b: .3 }), mNe);
    }
    // ---------------- cannocchiale
    if (es) {
      A.add(K.slab([[-6, 12, 1], [L - 2, 12, 1], [L - 2, 22, 1.5], [-6, 22, 1.5]], -7.5, 7.5, { b: 1 }), mAn);   // base unica
      for (const x of [8, 60, 180, 226]) A.add(K.discX(0, 0, 0, 2.4, -1, 12).rotateZ(PI / 2).translate(x, 22.1, 0), mDk);
      const x0 = -60, x1 = 273, y = 47; prOttica(A, { x0, x1, y, rt: 15, ro: 25.5, re: 20.5, rings: [34, 164], yb: 21, tappi: true });
      const Ls = x1 - x0, xm = (x0 + Math.min(85, Ls * .26) + x1 - Math.min(95, Ls * .3)) / 2;
      const g = K.latheX([[0, 0], [0, 14], [1, 15], [21, 15], [22.4, 13.4], [23, 0]], { seg: 32 }); g.rotateZ(PI / 2); g.translate(xm, y + 16, 0);
      A.add(g, K.mat('anod', null, { tile: 'knurl', rep: [12, 2], r: .6 }));   // torretta di elevazione alta con le tacche delle distanze
      A.add(K.latheX([[0, 0], [0, 15.2], [3, 15.2], [3, 0]], { seg: 32 }).rotateZ(PI / 2).translate(xm, y + 17.5, 0), K.mat('anod', null, { r: .4 }));
    } else prOttica(A, { x0: -88, x1: 358, y: 43, rt: 12.7, ro: 22.5, re: 19.5, rings: [40, 182], yb: 13, parallax: false });
    // ---------------- calcio in fibra (mimetico o verde a ragnatela)
    const mSt = rep => prMatTrama(es ? 'ragnatela' : 'macchie', rep, { r: es ? .76 : .7 });
    const st = (x, t, b, w, nt, nb) => ({ x, t, b, w, nt: nt || 3, nb: nb || 2.6 });
    A.add(K.loftX([st(XB, -10, -138, 20.6), st(XB + 14, -7, -136, 21), st(-180, -5, -121, 20.4), st(-120, -5, -107, 19.4), st(-98, -7, -103, 18.4),
      st(-84, -12, -102, 17.4), st(-72, -14, -104, 16.8), st(-62, -14, -107, 16.6)], { K: 34, step: 6 }), mSt([es ? 1.3 : 1.6, 1.5]));
    A.add(K.loftS([{ p: [-56, -38], f: 32, r: 30, w: 16.6 }, { p: [-52, -62], f: 25, r: 25.5, w: 17.4 }, { p: [-50, -86], f: 22, r: 24, w: 18 }, { p: [-50.5, -104], f: 20, r: 22, w: 17 },
      { p: [-51, -110], f: 16, r: 18, w: 13.5 }].map(q => Object.assign({ nf: 2.2, nr: 2.1 }, q)), { K: 30, sub: 4 }), mSt([.5, .8]));
    const fx = es ? 570 : 556, fw = es ? 25.5 : 23;
    A.add(K.loftX([st(-46, -14, -52, 16.5, 6), st(-6, -14, -52, 18, 6), Object.assign(st(-1, -4, -52, 19.5, 7), { lin: true }), st(L, -4, -52, 20.5, 7),
      st(L + 24, -6, -50, fw - 1.5, 4, 7), st(L + 90, -7, -47, fw, 4, 8), st(fx - 60, -7, -43, fw - .5, 4, 8), st(fx - 12, -7.5, -41, fw - 2, 4, 7), st(fx, -9, -37, fw - 6.5, 4, 5)], { K: 36, step: 6 }), mSt([es ? 3 : 3.6, 1.1]));
    // calciolo
    if (es) {
      A.add(K.loftX([st(XB - 3, -12, -136, 19), st(XB + .5, -12, -136, 19)], { K: 34, step: 0 }), mAn);
      for (const y of [-42, -104]) A.add(K.rod(XB - 13, XB - 2, 3.6, { cy: y, seg: 14 }), K.mat('inox', null, { c: '#8a8e93', r: .3 }));
      A.add(K.loftX([st(XB - 15, -12, -136, 19), st(XB - 11, -12, -136, 19)], { K: 34, step: 0 }), mAn);
      A.add(K.loftX([st(XB - 26, -11, -139, 19.8), st(XB - 21, -10.6, -138.6, 20.6), st(XB - 15, -10.8, -138, 20.2)], { K: 34, step: 0 }), mPad);
    } else A.add(K.loftX([st(XB - 23, -9.4, -139.6, 20.2), st(XB - 17, -9.8, -139.2, 21.2), st(XB, -10, -138, 20.8)], { K: 34, step: 0 }), mPad);
    // ---------------- ponticello, grilletto, maglie, bipiede
    prPonticello(A, 0, -52, es ? 120 : 100, es ? mAn : mNe);
    prGrilletto(A, 40, -53, 17.5, mNe);
    if (es) {
      A.add(K.rod(-4, 4, 3.2, { seg: 12 }).rotateZ(PI / 2).translate(548, -41, 0), mNe);
      WC.put(A, prBipiede(548, -44, { open: false, len: 235 }), 'bipiede'); A.pivot('bipiede', [548, -44, 0]);
    } else { A.add(K.rod(-4, 4, 3, { seg: 12 }).rotateZ(PI / 2).translate(520, -40, 0), mNe); WC.put(A, WC.swivel(520, -48, 0, { r: 8, t: 1.5 })); }
    A.add(K.rod(-4, 4, 3, { seg: 12 }).rotateZ(PI / 2 + .2).translate(XB + 40, -129, 0), mNe); WC.put(A, WC.swivel(XB + 38, -138, 0, { r: 8, t: 1.5 }));
    // ---------------- punti di riferimento
    const xc = es ? XB - 26 : XB - 23;
    A.anchor('bocca', [XM + .5, 0, 0]); A.anchor('espulsione', [(port[0] + port[1]) / 2, 12, 14], [0, .5, 1]); A.anchor('impugnatura', [-52, -74, 0]);
    A.anchor('grilletto', [42, -64, 0]); A.anchor('appoggio', [es ? 420 : 400, -48, -8]); A.anchor('calcio', [xc, -75, 0]);
    const r = A.done(), dx = es ? -.105 : -.092;
    r.info = { azione: 'otturatore', bossolo: 'fucile', ciclo: { grilletto: { rz: -.12 } }, manuale: [{ leva: { rx: -1.45 } }, { leva: { rx: -1.45, dx } }],
      ricarica: { leva: { rx: -1.45, dx } }, serbatoio: 'interno' };
    if (es) r.info.bipiede = { bipiede: { rz: -1.5 } };
    return r;
  };

  // ================================================================ 107: fucile di precisione con calcio sintetico verde e serbatoio rotante
  // scatola tonda con slitta a coda di rondine integrale, codolo lungo, manubrio inclinato (rotazione di 60°), sicura a slitta sul dorso,
  // serbatoio rotante quasi a filo del calcio con la finestrella trasparente, mire metalliche di riserva, calcio stampato verde con comb
  // rialzato, distanziali neri e calciolo in gomma.
  FAM2.prec_otturatore_rotante = function (spec, o) {
    o = o || {}; spec = spec || {};
    const A = K.asm('prec_otturatore_rotante');
    const mPk = K.mat('parker', null, { r: .58 }), mNe = K.mat('nero', null, { r: .45 }), mDk = K.mat('nero_lucido', null, { c: '#060606', r: .7 }), mPad = K.mat('gomma');
    const mPol = K.mat('polimero', null, { r: .55 });
    const L = 226, XM = 840;
    prAzioneTonda(A, spec, { L, port: [82, 152], fin: 'parker', sigla: 'EW ', matO: K.mat('grigio', null, { c: '#74787d', r: .32, m: .85 }), matM: mPk, matK: mNe,
      pomo: [-15, -27, 45], rk: 8.4, rough: .58, sicura: false,
      codolo: [[-62, 0], [-62, 4], [-60, 7.5], [-52, 9.6], [-10, 11.4], [-4, 12.4], [-1.5, 12.4], [-1.5, 0]] });
    A.add(K.discX(-62.2, 0, 0, 2.2, -1, 12), K.mat('rosso', null, { c: '#b01818' }), 'leva');   // spia del percussore armato
    // slitta a coda di rondine ricavata sulla scatola
    A.add(K.slabX([[-6.5, 13.5, .3], [6.5, 13.5, .3], [8.6, 20.6, .4], [-8.6, 20.6, .4]], 6, 204, { b: .5 }), mPk);
    // canna rastremata e mire metalliche
    A.add(K.latheX([[L + 5, 14.2], [L + 22, 14.2], [L + 30, 13.4], [XM - 10, 10.1], [XM - 1.2, 10], [XM, 9.2], [XM, 4.3], [XM - 2, 3.9], [XM - 10, 3.9]], { seg: 40 }), mNe);
    A.add(K.discX(XM - 9, 0, 0, 4, 1, 18), mDk);
    A.add(K.slab([[262, 8, 0], [284, 8, 0], [284, 17, 1], [266, 17, 2]], -6.5, 6.5, { b: .6 }), mNe);
    A.add(K.slabX([[-6.5, 16.6, .3], [6.5, 16.6, .3], [6.5, 22.6, .5], [1.4, 22.6, .2], [0, 19.6, .2], [-1.4, 22.6, .2], [-6.5, 22.6, .5]], 277, 281, { b: .3 }), mNe);
    A.add(K.slab([[788, 8, 0], [826, 8, 0], [826, 15.5, 1], [812, 15.5, 3], [794, 10.5, 6]], -4, 4, { b: .6 }), mNe);
    A.add(K.slab([[815, 14, .4], [822, 14, .4], [821, 22, .6], [817, 22, .6]], -1, 1, { b: .3 }), mNe);
    // cannocchiale a tubo da 26 mm sulla coda di rondine
    prOttica(A, { x0: -52, x1: 282, y: 47, rt: 13, ro: 25, re: 19.5, rings: [40, 174], yb: 19.5, parallax: false });
    // ---------------- calcio stampato verde: comb rialzato, impugnatura sportiva, astina lunga e sottile
    const mG = (ru, rv) => K.mat('verde', null, { c: '#4a5636', tile: 'grana', rep: [ru, rv], r: .6, ns: .3 }), mGz = (ru, rv) => K.mat('verde', null, { c: '#3d472c', tile: 'checker', rep: [ru, rv], r: .72, ns: .9 });
    const st = (x, t, b, w, nt, nb) => ({ x, t, b, w, nt: nt || 2.7, nb: nb || 2.4 });
    A.add(K.loftX([st(-283, -17, -142, 19), st(-268, -11, -138, 19.2), st(-210, -5, -122, 18.6), st(-150, -4.5, -108, 18), st(-112, -6, -96, 17),
      st(-94, -10.5, -93, 16), st(-78, -13, -94, 15.2), st(-64, -12.5, -97, 14.8), st(-50, -12.5, -99, 14.6)], { K: 34, step: 6 }), mG(30, 34));
    A.add(K.loftS([{ p: [-50, -38], f: 33, r: 31, w: 14.8 }, { p: [-44, -60], f: 26, r: 26, w: 15 }, { p: [-40, -82], f: 22.5, r: 24, w: 15.6 }, { p: [-38, -97], f: 19.5, r: 21, w: 15 },
      { p: [-37.6, -102], f: 16, r: 17.5, w: 12.4 }].map(q => Object.assign({ nf: 2.3, nr: 2.2 }, q)), { K: 30, sub: 4 }), mG(10, 16));
    prZigrina(A, () => K.loftS([{ p: [-50, -38], f: 33, r: 31, w: 14.8 }, { p: [-44, -60], f: 26, r: 26, w: 15 }, { p: [-40, -82], f: 22.5, r: 24, w: 15.6 }, { p: [-38, -97], f: 19.5, r: 21, w: 15 },
      { p: [-37.6, -102], f: 16, r: 17.5, w: 12.4 }].map(q => Object.assign({ nf: 2.3, nr: 2.2 }, q)), { K: 48, sub: 8 }), (c, n) => Math.abs(n[2]) > .5 && c[1] < -52 && c[1] > -92, mGz(5, 9));
    A.add(K.loftX([st(-40, -12.5, -49, 14.8, 6), st(-6, -12.5, -49, 16, 6), Object.assign(st(-1, -3.5, -49, 17.6, 7), { lin: true }), st(L, -3.5, -49, 18, 7),
      st(L + 30, -2.5, -45, 18, 6), st(340, -2.5, -41, 18.2, 6), st(480, -2.5, -36, 17.4, 5), st(548, -3, -32, 16, 5), st(560, -5, -28, 13, 4)], { K: 34, step: 6 }), mG(90, 18));
    prZigrina(A, () => K.loftX([st(L + 30, -2.5, -45, 18, 6), st(340, -2.5, -41, 18.2, 6), st(480, -2.5, -36, 17.4, 5)], { K: 52, step: 3 }),
      (c, n) => Math.abs(n[2]) > .55 && c[0] > 290 && c[0] < 430 && c[1] > -33 && c[1] < -8, mGz(26, 9));
    // distanziali neri e calciolo
    A.add(K.loftX([st(-289, -17, -142.4, 19), st(-283, -17, -142.4, 19)], { K: 34, step: 0 }), mPol);
    A.add(K.loftX([st(-286.4, -16.6, -142.8, 19.3), st(-285.6, -16.6, -142.8, 19.3)], { K: 34, step: 0 }), K.mat('grigio', null, { c: '#3a3c3e' }));
    A.add(K.loftX([st(-300, -16.4, -143.2, 18.8), st(-295, -16.8, -143.2, 19.4), st(-289, -17, -142.8, 19.2)], { K: 34, step: 0 }), mPad);
    // sicura a slitta sul dorso dell'impugnatura
    A.add(K.slab([[-56, -13.5, 1], [-44, -13.5, 1], [-45, -9.5, 1.5], [-55, -9.5, 1.5]], -4.5, 4.5, { b: .6 }), mNe);
    // ---------------- serbatoio rotante (caricatore) con la finestrella posteriore trasparente
    A.add(K.slab([[76, -60, 3], [124, -60, 8], [126, -46, 0], [76, -46, 0]], -15.5, 15.5, { b: 1.2 }), mPol, 'caricatore');
    A.add(K.box(72.4, -59, -12, 77, -47, 12, .8), K.mat('lente', null, { c: '#6c7f88', r: .06 }), 'caricatore');
    for (const zz of [-1, 1]) A.add(K.slab([[82, -57, 2], [100, -57, 2], [100, -50, 2], [82, -50, 2]], zz > 0 ? 15.3 : -15.8, zz > 0 ? 15.8 : -15.3, { b: .3 }), K.mat('ottone'), 'caricatore');
    A.add(K.discX(0, 0, 0, 5, -1, 16).rotateZ(PI / 2).translate(104, -60.1, 0), K.mat('nero_lucido', null, { c: '#0c0c0c' }), 'caricatore');
    A.pivot('caricatore', [100, -50, 0]);
    // ponticello nero e grilletto
    prPonticello(A, -4, -49, 0, mNe);
    prGrilletto(A, 32, -50, 17, mNe);
    // maglie
    A.add(K.rod(-4, 4, 3, { seg: 12 }).rotateZ(PI / 2).translate(510, -33, 0), mNe); WC.put(A, WC.swivel(510, -41, 0, { r: 8, t: 1.5 }));
    A.add(K.rod(-4, 4, 3, { seg: 12 }).rotateZ(PI / 2 + .2).translate(-236, -129, 0), mNe); WC.put(A, WC.swivel(-238, -138, 0, { r: 8, t: 1.5 }));
    // ---------------- punti di riferimento
    A.anchor('bocca', [XM + .5, 0, 0]); A.anchor('espulsione', [117, 12, 14], [0, .5, 1]); A.anchor('impugnatura', [-46, -70, 0]);
    A.anchor('grilletto', [34, -60, 0]); A.anchor('appoggio', [380, -40, -6]); A.anchor('calcio', [-300, -80, 0]);
    const r = A.done();
    r.info = { azione: 'otturatore', bossolo: 'fucile', ciclo: { grilletto: { rz: -.1 } }, manuale: [{ leva: { rx: -1.05 } }, { leva: { rx: -1.05, dx: -.09 } }],
      ricarica: { caricatore: { dy: -.06 } } };
    return r;
  };

  // ================================================================ 109: fucile di precisione a otturatore con manicotto termico
  // scatola a fianchi piatti con la chiusura posteriore e il manubrio piegato in avanti, canna coperta dal manicotto in polimero nero,
  // bipiede su collare davanti alla scatola (gambe ripiegate lungo il manicotto), mirino con orecchie sul collare anteriore, spegnifiamma,
  // caricatore amovibile da 10 colpi sporgente, calcio sintetico nero squadrato con poggiaguancia e distanziali.
  FAM2.prec_otturatore_manicotto = function (spec, o) {
    o = o || {}; spec = spec || {};
    const A = K.asm('prec_otturatore_manicotto');
    const mNe = K.mat('nero', null, { r: .5 }), mDk = K.mat('nero_lucido', null, { c: '#060606', r: .7 }), mPad = K.mat('gomma');
    const mPol = K.mat('polimero', null, { tile: 'grana', rep: [40, 4], r: .62, ns: .25 });
    // ---------------- scatola a fianchi piatti: mezza sinistra piena, mezza destra con la finestra
    const rb = [-10, -18, 215, 22];
    const pR = K.painter(rb, { w: 1024, h: 512, rough: .52 });
    pR.text('L', (spec.produttore || '').toUpperCase(), 118, 5, 3.2, { spacing: 3 });
    pR.text('L', (spec.nome || '').toUpperCase() + '  7,62', 118, -2, 2.6, { spacing: 2 });
    pR.text('R', prMatr(spec, 'SM '), 186, 3, 2.4);
    for (const [x, y] of [[8, -8], [196, -8], [60, -10], [176, 8]]) pR.pin('LR', x, y, 1.8, { h: .4, a: 1.05 });
    pR.noise({ a: .1, r: .16, seed: 9 }); pR.walls({ r: .5 });
    const mRcv = K.mat('nero', pR.done(2.2), { ns: .8 });
    A.add(K.slab([[0, -16, 1.5, .5], [205, -16, 1, .5], [205, 10, 4, 1], [198, 17, 5, 1], [8, 17, 5, 1], [0, 10, 4, 1]], -14, 0, { bL: 2.2, bR: 0, uv: rb }), mRcv);
    A.add(K.slab([[0, -16, 1.5, .5], [205, -16, 1, .5], [205, 10, 4, 1], [198, 17, 5, 1], [160, 17, 1.2, .4], [160, -1, 1.2, .3], [70, -1, 1.2, .3], [70, 17, 1.2, .4], [8, 17, 5, 1], [0, 10, 4, 1]], 0, 14, { bL: 0, bR: 1.8, uv: rb }), mRcv);
    A.add(K.box(70, -10, -12, 160, -1, 12, 0), mDk);   // fondo della finestra
    A.add(K.slab([[20, 16, 1], [192, 16, 1], [192, 23, 1.5], [20, 23, 1.5]], -9.5, 9.5, { b: 1 }), mNe);   // base dell'ottica
    // otturatore (leva): corpo nella finestra, codolo zigrinato, manubrio piegato in avanti
    const mBolt = K.mat('grigio', null, { c: '#6e7277', r: .32, m: .85 });
    A.add(K.rod(-30, 186, 9.2, { seg: 26 }), mBolt, 'leva');
    A.add(K.latheX([[-44, 0], [-44, 8], [-42, 11], [-32, 12], [-30, 10.4], [-28, 12], [-18, 12], [-16, 10.4], [-14, 12], [-4, 12], [-2, 9.5], [-2, 0]], { seg: 28 }), mNe, 'leva');
    A.add(prAsta([12, -.5, 8.5], [14, -5, 30], 5, 4.4), mNe, 'leva');
    A.add(prAsta([14, -5, 30], [36, -21, 41], 4.4, 4), mNe, 'leva');
    A.add(prSfera([38, -22.5, 42.5], 8.6, { seg: 20, n: 12 }), mNe, 'leva');
    A.pivot('leva', [0, 0, 0]);
    // ---------------- manicotto termico sulla canna, collari, mirino, spegnifiamma
    A.add(K.latheX([[205, 0], [205, 16], [207, 17.8], [214, 18.4], [780, 18.4], [783, 17.2], [784, 0]], { seg: 40 }), mPol);
    for (const x of [262, 270, 700, 708]) A.add(K.latheX([[x, 18.2], [x + .6, 18.9], [x + 2.4, 18.9], [x + 3, 18.2]], { seg: 40 }), mPol);
    A.add(K.latheX([[778, 0], [778, 19], [779, 20], [800, 20], [801, 18.8], [801, 0]], { seg: 36 }), mNe);
    A.add(K.slab([[782, 18, 0], [800, 18, 0], [800, 25, 1], [784, 25, 1]], -10, 10, { b: .8 }), mNe);
    for (const zz of [-1, 1]) A.add(K.slab([[784, 23, 0], [798, 23, 0], [797, 36, 3], [786, 36, 3]], zz > 0 ? 5.4 : -8.4, zz > 0 ? 8.4 : -5.4, { b: .6 }), mNe);
    A.add(K.slab([[789, 23, 0], [793, 23, 0], [792.6, 34, .5], [789.4, 34, .5]], -1.1, 1.1, { b: .3 }), mNe);
    A.add(K.tube(800, 818, 10.5, 4, { seg: 28 }), mNe);
    WC.put(A, WC.muzzle('gabbia', 816, 11.5, { len: 42, mat: mNe }));
    // ---------------- bipiede su collare davanti alla scatola, gambe ripiegate lungo il manicotto
    { const mb = K.mat('nero', null, { r: .45 }), mg = K.mat('gomma'), mi = K.mat('grigio', null, { c: '#4a4d52', r: .35, m: .8 }), out = [];
      out.push([K.latheX([[207, 18.6], [207, 21.5], [208, 22.5], [226, 22.5], [227, 21.5], [227, 18.6]], { seg: 36 }), mb]);
      out.push([K.slab([[209, -34, 2], [225, -34, 2], [225, -18, 0], [209, -18, 0]], -16, 16, { b: 1.2 }), mb]);
      for (const s of [-1, 1]) {
        const lg = K.mergeG([K.rod(0, 190, 5, { seg: 14 }), K.rod(180, 192, 6, { seg: 14 })]), li = K.rod(186, 300, 3.8, { seg: 12 }), lf = K.latheX([[300, 0], [300, 5.5], [304, 7], [312, 6], [316, 0]], { seg: 14 });
        for (const g of [lg, li, lf]) { g.rotateZ(.02); g.translate(218, -27, s * 19); }
        out.push([lg, mb], [li, mi], [lf, mg]);
      }
      WC.put(A, out, 'bipiede'); A.pivot('bipiede', [218, -27, 0]); }
    // ---------------- calcio nero squadrato: calcio con impugnatura, astina corta attorno alla scatola, poggiaguancia, distanziali
    const sb = [-290, -115, 245, 10];
    const pS = K.painter(sb, { w: 1024, h: 512, rough: .7 });
    pS.stipple('LR', [[-30, -54], [-24, -100], [-66, -106], [-74, -84]], { s: .28, r: .85 });
    pS.stipple('LR', [[60, -12], [180, -12], [180, -36], [60, -36]], { s: .28, r: .85 });
    pS.noise({ a: .05, r: .08, seed: 4 }); pS.walls({ r: .7 }); pS.wallStipple({ s: 1, k: .35 });
    const mSt = K.mat('polimero', pS.done(2.0), { ns: .7 });
    A.add(K.slab([[-262, -9, 8], [-104, -6, 12], [-84, -14, 8], [-10, -14, 0], [-10, -48, 0], [-22, -52, 8], [-28, -103, 8], [-72, -110, 8], [-80, -84, 12], [-110, -94, 26], [-262, -134, 8]],
      -18.5, 18.5, { b: 7, bs: 4, uv: sb }), mSt);
    A.add(K.slab([[-14, -2, 2], [232, -2, 7], [240, -12, 8], [236, -46, 8], [-14, -48, 2]], -20, 20, { b: 6, bs: 4, uv: sb }), mSt);
    A.add(K.slab([[-232, -10, 3], [-118, -10, 3], [-118, 1, 5], [-226, 2, 5]], -16.5, 16.5, { b: 5, bs: 3 }), mPol);   // poggiaguancia
    for (const x of [-232, -118]) A.add(K.rod(-6, -2, 2.6, { cy: x, seg: 10 }).rotateZ(PI / 2).translate(0, 0, 0).translate(x + 6 - x, 0, 0), mNe);
    A.add(K.slab([[-268, -133, 2], [-262, -133, 2], [-262, -9, 2], [-268, -9, 2]], -18.2, 18.2, { b: 1.5 }), mNe);   // distanziali
    A.add(K.slab([[-281, -135, 5], [-268, -134, 3], [-268, -8, 3], [-281, -9, 5]], -18.6, 18.6, { b: 3 }), mPad);
    // ---------------- caricatore sporgente, ponticello, grilletto
    A.add(K.slab([[86, -45], [150, -45], [148, -98, 2], [88, -98, 2]], -11.5, 11.5, { b: 1.2 }), K.mat('parker', null, { r: .55 }), 'caricatore');
    A.add(K.slab([[84, -104, 2], [152, -104, 2], [152, -97, 1], [84, -97, 1]], -13, 13, { b: 1.4 }), mNe, 'caricatore');
    A.pivot('caricatore', [118, -46, 0]);
    A.add(K.slab([[2, -46], [80, -46], [80, -50, 1], [72, -54, 4], [64, -72, 8], [26, -75, 10], [10, -62, 7], [4, -52, 3]], -6, 6,
      { b: 1, holes: [[[13, -51, 3], [66, -51, 3], [60, -68, 6], [28, -70, 8], [17, -60, 4]]] }), mNe);
    prGrilletto(A, 42, -48, 17, mNe);
    WC.put(A, WC.swivel(-230, -140, 0, { r: 8, t: 1.5 }));
    // ---------------- cannocchiale con oculare in gomma
    prOttica(A, { x0: -58, x1: 292, y: 52, rt: 15, ro: 28.5, re: 21, rings: [44, 172], yb: 22 });
    A.add(K.latheX([[-84, 21], [-84, 25.5], [-80, 26.5], [-66, 25], [-58, 22], [-58, 18], [-82, 20]], { seg: 32, cy: 52 }), mPad);
    A.anchor('ottica', [-84, 52, 0]); A.anchor('mira_post', [-84, 52, 0]);
    // ---------------- punti di riferimento
    A.anchor('bocca', [858.5, 0, 0]); A.anchor('espulsione', [115, 10, 14], [0, .5, 1]); A.anchor('impugnatura', [-50, -72, 0]);
    A.anchor('grilletto', [44, -58, 0]); A.anchor('appoggio', [170, -48, -8]); A.anchor('calcio', [-281, -72, 0]);
    const r = A.done();
    r.info = { azione: 'otturatore', bossolo: 'fucile', ciclo: { grilletto: { rz: -.1 } }, manuale: [{ leva: { rx: -1.45 } }, { leva: { rx: -1.45, dx: -.095 } }],
      ricarica: { caricatore: { dy: -.075 } }, bipiede: { bipiede: { rz: -1.25 } } };
    return r;
  };

  // ================================================================ 112, 115: fucili di precisione con calcio a pollice passante
  // telaio in alluminio dentro un calcio in due metà di polimero imbullonate (bulloni a vista), impugnatura con foro per il pollice,
  // astina lunga squadrata staccata dalla canna, poggiaguancia regolabile, caricatore d'acciaio sporgente davanti al ponticello.
  // var 'base' = verde, calcio fisso, canna liscia con copri-filetto, cannocchiale da 42 mm, caricatore da 10;
  // var 'magnum' = sabbia, calcio pieghevole (cerniera a sinistra), poggiaguancia e calciolo su perni, canna scanalata, freno a camere,
  // cannocchiale grande da 56 mm con tubo da 34 mm, caricatore corto da 5.
  FAM2.prec_pollice_passante = function (spec, o) {
    o = o || {}; spec = spec || {}; const mg = o.var === 'magnum';
    const A = K.asm('prec_pollice_passante');
    const mNe = K.mat('nero', null, { r: .5 }), mDk = K.mat('nero_lucido', null, { c: '#060606', r: .7 }), mPad = K.mat('gomma'), mAn = K.mat('anod');
    const col = mg ? '#7f6c4d' : '#4b5a3b';
    const L = mg ? 250 : 230, XB = mg ? 874 : 868;
    prCulattaPiatta(A, spec, { L, yb: -15, yt: 16, hw: 15, port: [82, mg ? 178 : 160, -2], rail: [2, L - 4], fin: 'nero', sigla: 'AP ', pomo: [-8, -32, 50], rk: 10.5 });
    // ---------------- canna (liscia o scanalata), copri-filetto o freno
    if (mg) {
      A.add(K.latheX([[L, 0], [L, 15.5], [L + 2, 16.2], [L + 40, 16.2], [L + 60, 14.6], [330, 14.6]], { seg: 48 }), mNe);
      A.add(prScan(330, 820, 14.6, 12.6, { n: 6, d: 2.2, re: 18, sub: 8, off: PI / 6 }), mNe);
      A.add(K.latheX([[820, 12.6], [XB, 12.6], [XB, 0]], { seg: 48 }), mNe);
      WC.put(A, prFreno(XB, 92, 16.5, { n: 3, mat: mNe }));
    } else {
      A.add(K.latheX([[L, 0], [L, 15.5], [L + 2, 16.2], [L + 40, 16.2], [L + 60, 14.8], [XB - 2, 12.6], [XB, 12.6], [XB, 0]], { seg: 44 }), mNe);
      A.add(K.latheX([[XB - 1, 0], [XB - 1, 11.6], [XB, 12.4], [XB + 20, 12.4], [XB + 22, 11.4], [XB + 22, 0]], { seg: 32 }), mNe);
      A.add(K.discX(XB + 22.05, 0, 0, 4.2, 1, 18), mDk);
    }
    const XMZ = mg ? XB + 92 : XB + 22;
    // ---------------- calcio: corpo posteriore con foro per il pollice, corpo anteriore (azione e astina)
    const cb = [-300, -150, 10, 10];
    const pB = K.painter(cb, { w: 1024, h: 512, rough: .66 });
    pB.stipple('LR', [[-26, -56], [-32, -112], [-72, -120], [-80, -96], [-72, -32]], { s: .3, r: .84 });
    for (const [x, y] of [[-248, -40], [-248, -110], [-150, -16], [-160, -112], [-40, -20]]) { pB.pin('LR', x, y, 4.2, { h: .35, a: .55 }); pB.fill('LR', K.circ(x, y, 1.9, 6), { h: -.6, a: .25 }); }
    pB.text('L', 'AP', -96, -60, 7, { a: .7, h: -.4 });
    pB.noise({ a: .07, r: .1, seed: 31 }); pB.walls({ r: .66 }); pB.wallStipple({ s: 1, k: .3 });
    const mS = K.mat(mg ? 'sabbia' : 'verde', pB.done(2.0), { ns: .7, c: col });
    const fb = [-30, -60, 640, 10];
    const pF = K.painter(fb, { w: 1024, h: 512, rough: .66 });
    for (const [x, y] of [[20, -30], [170, -30], [330, -24], [560, -24]]) { pF.pin('LR', x, y, 4, { h: .35, a: .55 }); pF.fill('LR', K.circ(x, y, 1.8, 6), { h: -.6, a: .25 }); }
    pF.fill('LR', [[250, -16, 6], [520, -16, 6], [520, -36, 6], [250, -38, 6]], { h: -.3, a: .9 });
    pF.noise({ a: .07, r: .1, seed: 32 }); pF.walls({ r: .66 });
    const mF = K.mat(mg ? 'sabbia' : 'verde', pF.done(2.0), { ns: .7, c: col });
    const hole = [[-150, -28, 18], [-76, -24, 12], [-84, -104, 12], [-140, -108, 22]];
    if (mg) {
      // calcio pieghevole: parte anteriore (ponte, impugnatura, collegamento) e calcio dietro la cerniera
      A.add(K.slab([[-156, -6, 0], [-15, -6, 0], [-15, -46, 0], [-24, -52, 6], [-30, -116, 9], [-70, -126, 10], [-156, -136, 0], [-156, -108, 0], [-140, -108, 16],
        [-84, -104, 12], [-76, -24, 12], [-148, -28, 14], [-156, -28, 0]], -21, 21, { b: 7, bs: 4, uv: cb }), mS);
      A.add(K.slab([[-275, -10, 8], [-159, -6, 0], [-159, -136, 0], [-275, -146, 8]], -21, 21, { b: 7, bs: 4, uv: cb }), mS);
      A.add(K.slab([[-163, -4, 1], [-152, -4, 1], [-152, -30, 1], [-163, -30, 1]], -22.5, -15, { b: .8 }), mAn);   // cerniera a sinistra
      A.add(K.slab([[-163, -106, 1], [-152, -106, 1], [-152, -132, 1], [-163, -132, 1]], -22.5, -15, { b: .8 }), mAn);
      A.add(K.rod(-12, 12, 3, { seg: 12 }).rotateZ(PI / 2).translate(-157.5, -17, -22.6), K.mat('inox', null, { c: '#8d9196' }));
      A.add(K.rod(-12, 12, 3, { seg: 12 }).rotateZ(PI / 2).translate(-157.5, -119, -22.6), K.mat('inox', null, { c: '#8d9196' }));
      // poggiaguancia e calciolo regolabili su perni
      for (const x of [-238, -178]) A.add(K.rod(-12, 6, 3.4, { seg: 12 }).rotateZ(PI / 2).translate(x, -6, 0), K.mat('inox', null, { c: '#8d9196', r: .3 }));
      A.add(K.slab([[-252, 4, 3], [-164, 4, 3], [-164, 13, 5], [-248, 15, 6]], -18, 18, { b: 5, bs: 3 }), mS);
      for (const y of [-34, -118]) A.add(K.rod(-292, -274, 3.6, { cy: y, seg: 12 }), K.mat('inox', null, { c: '#8d9196', r: .3 }));
      A.add(K.slab([[-280, -144, 3], [-274, -144, 3], [-274, -12, 3], [-280, -12, 3]], -19, 19, { b: 1.2 }), mAn);
      A.add(K.slab([[-304, -150, 6], [-288, -149, 3], [-288, -9, 3], [-304, -8, 6]], -20, 20, { b: 3 }), mPad);
      A.add(K.slab([[-290, -148, 2], [-286, -148, 2], [-286, -10, 2], [-290, -10, 2]], -18.5, 18.5, { b: 1 }), mAn);
    } else {
      A.add(K.slab([[-275, -10, 8], [-15, -6, 0], [-15, -46, 0], [-24, -52, 6], [-30, -116, 9], [-70, -126, 10], [-275, -146, 8]], -21, 21, { b: 7, bs: 4, uv: cb, holes: [hole] }), mS);
      // poggiaguancia regolabile con le due viti
      A.add(K.slab([[-244, -9, 3], [-128, -9, 3], [-128, 3, 5], [-240, 5, 6]], -19, 19, { b: 5, bs: 3 }), mS);
      for (const x of [-226, -146]) A.add(K.discX(0, 0, 0, 3, -1, 14).rotateZ(-PI / 2).translate(x, 5.1, 0), K.mat('inox', null, { c: '#8d9196', r: .3 }));
      A.add(K.slab([[-283, -145, 2], [-275, -145, 2], [-275, -10, 2], [-283, -10, 2]], -20, 20, { b: 1.4 }), mNe);    // distanziali
      A.add(K.slab([[-296, -148, 6], [-283, -147, 3], [-283, -9, 3], [-296, -8, 6]], -20.5, 20.5, { b: 3 }), mPad);
      A.add(K.rod(0, 12, 4, { seg: 12 }).rotateZ(-PI / 2).translate(-250, -140, 0), K.mat('inox', null, { c: '#8d9196' }));   // puntale posteriore retratto
    }
    const XF = mg ? 640 : 600;
    A.add(K.slab([[-18, -4, 2], [XF - 30, -6, 6], [XF, -14, 14], [XF - 4, -42, 10], [XF - 40, -48, 8], [200, -52, 4], [-18, -54, 2]], -29, 29, { b: 10, bs: 4, uv: fb }), mF);
    // slitta per il bipiede sotto l'astina e maglia
    A.add(K.slab([[XF - 150, -51, 1], [XF - 30, -49, 1], [XF - 30, -44, 0], [XF - 150, -44, 0]], -9, 9, { b: .8 }), mAn);
    // ---------------- caricatore d'acciaio sporgente, ponticello, grilletto
    const mz = mg ? [76, 176, -86] : [76, 150, -112];
    A.add(K.slab([[mz[0], -40], [mz[1], -40], [mz[1] - 2, mz[2], 2], [mz[0] + 2, mz[2], 2]], -12, 12, { b: 1.2 }), K.mat('parker', null, { r: .5 }), 'caricatore');
    A.add(K.slab([[mz[0] - 2, mz[2] - 6, 2], [mz[1] + 2, mz[2] - 6, 2], [mz[1] + 2, mz[2] + 1, 1], [mz[0] - 2, mz[2] + 1, 1]], -13.5, 13.5, { b: 1.4 }), mNe, 'caricatore');
    A.add(K.slab([[mz[0] + 4, -54, 1], [mz[0] + 14, -54, 1], [mz[0] + 14, mz[2] + 2, 1], [mz[0] + 4, mz[2] + 2, 1]], 11.5, 12.6, { b: .4 }), K.mat('parker', null, { r: .5 }), 'caricatore');
    A.pivot('caricatore', [(mz[0] + mz[1]) / 2, -44, 0]);
    A.add(K.slab([[-6, -50], [72, -50], [72, -54, 1], [64, -58, 4], [56, -76, 8], [18, -79, 10], [2, -66, 7], [-4, -56, 3]], -7, 7,
      { b: 1.2, holes: [[[5, -55, 3], [58, -55, 3], [52, -72, 6], [20, -74, 8], [9, -64, 4]]] }), mNe);
    prGrilletto(A, 32, -52, 17, mNe);
    // ---------------- bipiede ripiegato sotto l'astina
    WC.put(A, prBipiede(XF - 70, -50, { open: false, len: 240 }), 'bipiede'); A.pivot('bipiede', [XF - 70, -50, 0]);
    // ---------------- cannocchiale sulla slitta
    if (mg) prOttica(A, { x0: -78, x1: 344, y: 60, rt: 17, ro: 32, re: 22.5, rings: [40, 198], yb: 25, tappi: true });
    else prOttica(A, { x0: -68, x1: 270, y: 54, rt: 15, ro: 26, re: 21, rings: [36, 168], yb: 25 });
    // ---------------- punti di riferimento
    A.anchor('bocca', [XMZ + .5, 0, 0]); A.anchor('espulsione', [120, 10, 15], [0, .5, 1]); A.anchor('impugnatura', [-50, -80, 0]);
    A.anchor('grilletto', [34, -62, 0]); A.anchor('appoggio', [380, -54, -10]); A.anchor('calcio', [mg ? -304 : -296, -76, 0]);
    const r = A.done();
    r.info = { azione: 'otturatore', bossolo: mg ? 'fucile_lungo' : 'fucile', ciclo: { grilletto: { rz: -.1 } }, manuale: [{ leva: { rx: -1.05 } }, { leva: { rx: -1.05, dx: mg ? -.118 : -.095 } }],
      ricarica: { caricatore: { dy: -.08 } }, bipiede: { bipiede: { rz: -1.5 } } };
    return r;
  };

  // ================================================================ 119, 121, 122, 124: fucili di precisione a telaio in alluminio (chassis)
  // sezione centrale fresata (pozzetto del caricatore, ponticello), astina tubolare a pannelli con le asole (la canna si vede dentro),
  // slitta continua dalla scatola alla punta, impugnatura in polimero, calcio a telaio regolabile, freno di bocca, bipiede ripiegato.
  // var 'cheviot' = scatola a fianchi piatti, calcio pieghevole con due finestre, poggiaguancia a leva, asole piccole, canna liscia, freno tondo;
  // 'lyra' = scatola tonda, calcio fisso a telaio con finestra a goccia e monopiede posteriore, asole ovali lunghe, canna scanalata, freno sottile;
  // 'sagitta' = color sabbia, calcio pieghevole pieno con poggiaguancia a manopola, asole su due file, freno a piastre;
  // 'gaspe' = calcio pieghevole a traliccio con puntone diagonale, finestre rettangolari grandi, canna scanalata, freno a due grandi luci.
  FAM2.prec_telaio = function (spec, o) {
    o = o || {}; spec = spec || {}; const v = o.var || 'cheviot';
    const A = K.asm('prec_telaio');
    const C = {
      cheviot: { L: 250, xF: 668, xB: 891, col: '#202226', colS: '#202226', br: [86, 17, 3], fl: false, sc: { x0: -80, x1: 344, y: 62, rt: 17, ro: 32, re: 22.5 }, mag: [80, 178, -104], bos: 'fucile_lungo', lift: -1.05, dx: -.12, sg: 'AP ' },
      lyra: { L: 225, xF: 622, xB: 800, col: '#1e2023', colS: '#26282c', br: [62, 13, 2], fl: true, sc: { x0: -70, x1: 300, y: 56, rt: 17, ro: 29, re: 22 }, mag: [82, 156, -96], bos: 'fucile', lift: -1.45, dx: -.095, sg: 'VA ' },
      sagitta: { L: 225, xF: 612, xB: 800, col: '#7d6a4c', colS: '#7d6a4c', br: [84, 16, 3], fl: false, sc: { x0: -76, x1: 340, y: 60, rt: 17, ro: 32, re: 22.5, sole: 60 }, mag: [82, 156, -100], bos: 'fucile', lift: -1.45, dx: -.095, sg: 'VA ' },
      gaspe: { L: 225, xF: 628, xB: 800, col: '#1f2124', colS: '#33363b', br: [74, 18, 2], fl: true, sc: { x0: -66, x1: 284, y: 56, rt: 15, ro: 29, re: 21 }, mag: [82, 156, -98], bos: 'fucile', lift: -1.45, dx: -.095, sg: 'LR ' }
    }[v];
    const mCh = K.mat('anod', null, { c: C.col, r: .48 }), mSk = K.mat('anod', null, { c: C.colS, r: .5 }), mNe = K.mat('nero', null, { r: .5 }), mDk = K.mat('nero_lucido', null, { c: '#060606', r: .7 });
    const mPol = K.mat('polimero', null, { r: .62 }), mPad = K.mat('gomma'), mSteel = K.mat('inox', null, { c: '#8d9196', r: .3 });
    const L = C.L, XF = C.xF, XB = C.xB;
    // ---------------- azione: scatola piatta con slitta integrale ('cheviot') o scatola tonda con slitta avvitata
    if (v === 'cheviot') prCulattaPiatta(A, spec, { L, yb: -16, yt: 18, hw: 16, port: [86, 190, -2], fin: 'nero', sigla: C.sg, pomo: [-8, -32, 52], rk: 12 });
    else {
      prAzioneTonda(A, spec, { L, port: [86, 160], fin: 'nero', sigla: C.sg, matO: K.mat('grigio', null, { c: '#868a90', r: .25, m: .9 }), matM: mNe, matK: mPol, pomo: [-8, -30, 50], rk: 11.5, rough: .5 });
      A.add(K.slab([[-6, 13, 1], [L - 2, 13, 1], [L - 2, 18.5, 1], [-6, 18.5, 1]], -9, 9, { b: .8 }), mNe);
    }
    const yr = v === 'cheviot' ? 17.5 : 18;
    WC.put(A, WC.rail(-4, XF - 6, yr, { mat: mNe }));
    // ---------------- canna, freno
    if (C.fl) {
      A.add(K.latheX([[L, 0], [L, 15.6], [L + 2, 16.2], [L + 36, 16.2], [L + 50, 14.6], [330, 14.6]], { seg: 48 }), mNe);
      A.add(prScan(330, XB - 60, 14.6, 12.4, { n: 6, d: 2.3, re: 18, off: PI / 6 }), mNe);
      A.add(K.latheX([[XB - 60, 12.4], [XB, 12.2], [XB, 0]], { seg: 48 }), mNe);
    } else A.add(K.latheX([[L, 0], [L, 15.6], [L + 2, 16.4], [L + 36, 16.4], [L + 50, 15.2], [XB - 2, 13.2], [XB, 13.2], [XB, 0]], { seg: 44 }), mNe);
    if (v === 'sagitta') WC.put(A, WC.muzzle('freno', XB, 15, { len: C.br[0], ch: 3, mat: mNe }));
    else WC.put(A, prFreno(XB, C.br[0], C.br[1], { n: C.br[2], mat: mNe, win: v === 'gaspe' ? .72 : .6 }));
    const XMZ = XB + C.br[0];
    // ---------------- sezione centrale del telaio (pozzetto, ponticello) con le scritte
    const cb = [-60, -90, L + 10, 0];
    const pC = K.painter(cb, { w: 1024, h: 512, rough: .5 });
    pC.text('L', (spec.produttore || '').toUpperCase(), 116, -16, 4, { spacing: 4, a: .7, h: -.5 });
    pC.text('R', (spec.nome || '').toUpperCase(), 116, -16, 4, { spacing: 4, a: .7, h: -.5 });
    for (const [x, y] of [[-20, -16], [60, -14], [196, -14], [L - 6, -30]]) pC.pin('LR', x, y, 2.6, { h: .3, a: .6 });
    pC.fill('LR', [[78, -22, 3], [178, -22, 3], [178, -44, 3], [78, -44, 3]], { h: -.35, a: .82 });
    pC.noise({ a: .08, r: .1, seed: 41 }); pC.walls({ r: .48 });
    const mC = K.mat('anod', pC.done(2.1), { ns: .7, c: C.col });
    A.add(K.slab([[-36, -6, 2], [L + 4, -6, 2], [L + 4, -36, 4], [L - 10, -48, 6], [182, -50, 3], [76, -50, 2], [60, -48, 4], [-36, -48, 4]], -18, 18, { b: 2, uv: cb }), mC);
    A.add(K.slab([[2, -46], [70, -46], [70, -50, 1], [64, -54, 4], [58, -74, 8], [22, -78, 10], [8, -66, 7], [2, -54, 3]], -7, 7,
      { b: 1.2, holes: [[[9, -51, 3], [61, -51, 3], [55, -70, 6], [24, -73, 8], [14, -62, 4]]] }), mCh);
    // ---------------- astina a pannelli con le asole
    const fy0 = -32, fy1 = 13, fw = 23, xa = L + 2;
    const asole = [];
    if (v === 'cheviot') for (let x = xa + 30; x < XF - 40; x += 36) asole.push(K.rrect(x, -14, x + 22, -6, 3.5));
    else if (v === 'lyra') { }
    else if (v === 'sagitta') for (let x = xa + 26; x < XF - 50; x += 44) { asole.push(K.rrect(x, -22, x + 32, -14, 3.8)); asole.push(K.rrect(x, -4, x + 32, 4, 3.8)); }
    else for (let x = xa + 22; x < XF - 70; x += 92) asole.push(K.rrect(x, -22, x + 74, 2, 5));
    const mFo = mCh;
    const side = [[xa, fy0, 3], [XF, fy0, 5], [XF, fy1, 3], [xa, fy1, 0]];
    if (v === 'lyra') {   // astina tonda: tubo con asole lunghe sui fianchi e sotto
      const sl = (x, a) => ((x > xa + 30 && x < xa + 175) || (x > xa + 195 && x < XF - 30)) && ((a > 1.2 && a < 1.95) || (a > 4.33 && a < 5.08) || (a > 2.85 && a < 3.43));
      A.add(prTubo([xa, xa + 2, xa + 30, xa + 175, xa + 195, XF - 30, XF - 2, XF], 24, 21, sl, { cy: -6, c: 1.5, angoli: [1.2, 1.95, 4.33, 5.08, 2.85, 3.43] }), mCh);
    } else {
    A.add(K.slab(side, fw - 3.2, fw, { b: 1, bs: 1, uv: [xa - 2, fy0 - 2, XF + 2, fy1 + 2], holes: asole }), mFo);
    A.add(K.slab(side, -fw, -fw + 3.2, { b: 1, bs: 1, uv: [xa - 2, fy0 - 2, XF + 2, fy1 + 2], holes: asole }), mFo);
    A.add(K.slabY([[xa, -fw + 1, 0], [XF, -fw + 1, 4], [XF, fw - 1, 4], [xa, fw - 1, 0]], fy0, fy0 + 3.4, { b: 1 }), mCh);
    A.add(K.slabY([[xa, -fw + 1, 0], [XF, -fw + 1, 4], [XF, fw - 1, 4], [xa, fw - 1, 0]], fy1 - 3, fy1 + .5, { b: .8 }), mCh);
    A.add(K.slabX([[-fw, fy0, 4], [fw, fy0, 4], [fw, fy1, 3], [-fw, fy1, 3]], XF - 6, XF, { b: 1.2, holes: [K.circ(0, 0, 15.2, 28)] }), mCh);
    A.add(K.slabX([[-fw + 2, fy0 + 2, 3], [fw - 2, fy0 + 2, 3], [fw - 2, fy1 - 2, 2], [-fw + 2, fy1 - 2, 2]], xa - 1, xa + 4, { b: .8, holes: [K.circ(0, 0, 16.6, 28)] }), mCh);
    }
    // ---------------- impugnatura in polimero
    A.add(K.loftS([{ p: [-12, -40], f: 20, r: 22, w: 14.4 }, { p: [-20, -66], f: 18.5, r: 21, w: 15.2 }, { p: [-27, -94], f: 17.5, r: 21, w: 16 }, { p: [-32, -116], f: 17, r: 20, w: 15.4 },
      { p: [-33.5, -122], f: 14, r: 17, w: 12.5 }].map(q => Object.assign({ nf: 2.3, nr: 2.4 }, q)), { K: 28, sub: 4 }), K.mat('polimero', null, { tile: 'stipple', rep: [4, 6], r: .78, ns: .5 }));
    // ---------------- calcio
    const sb = [-320, -170, -30, 30], mK = mSk;
    let xc = -296, ycal = -78;
    if (v === 'cheviot') {
      A.add(K.box(-50, -60, -17, -34, -4, 17, 2, 3), mCh);                                            // cerniera
      A.add(K.rod(-6, 6, 4.5, { seg: 16 }).rotateZ(PI / 2).translate(-42, -32, -17.6), mSteel);
      A.add(K.slab([[-52, -4, 5], [-238, -4, 8], [-262, -10, 8], [-262, -150, 8], [-228, -152, 10], [-52, -64, 6]], -19, 19,
        { b: 3.5, bs: 3, uv: sb, holes: [[[-76, -22, 6], [-216, -22, 6], [-216, -40, 6], [-76, -40, 6]], [[-96, -58, 6], [-212, -60, 8], [-212, -126, 8]]] }), mK);
      A.add(K.slab([[-236, -2, 4], [-112, -2, 4], [-112, 12, 5], [-232, 14, 6]], -17, 17, { b: 4, bs: 3 }), mPol);          // poggiaguancia
      for (const x of [-220, -130]) A.add(K.rod(-8, 2, 3.4, { seg: 12 }).rotateZ(PI / 2).translate(x, -2, 0), mSteel);
      A.add(K.slab([[-104, -10, 2], [-92, -10, 2], [-92, -1, 2], [-104, -1, 2]], 18.5, 22, { b: .8 }), mNe);                 // leva del poggiaguancia
      A.add(K.slab([[-274, -154, 3], [-262, -154, 3], [-262, -6, 3], [-274, -6, 3]], -18, 18, { b: 1.4 }), mCh);
      A.add(K.slab([[-288, -158, 6], [-274, -157, 3], [-274, -3, 3], [-288, -2, 6]], -19.5, 19.5, { b: 3 }), mPad);
      A.add(K.rod(0, 26, 5, { seg: 14 }).rotateZ(-PI / 2).translate(-234, -146, 0), mNe);                                   // monopiede chiuso
      A.add(K.latheX([[0, 0], [0, 9], [2, 10], [8, 10], [9, 0]], { seg: 18 }).rotateZ(-PI / 2).translate(-234, -170, 0), mPad);
      xc = -288; ycal = -80;
    } else if (v === 'lyra') {
      A.add(K.slab([[-34, -4, 5], [-250, -4, 8], [-262, -10, 8], [-262, -150, 8], [-236, -152, 12], [-160, -116, 30], [-60, -62, 8], [-34, -50, 4]], -16, 16,
        { b: 3.5, bs: 3, uv: sb, holes: [[[-70, -20, 10], [-200, -20, 18], [-232, -50, 20], [-224, -122, 12], [-150, -96, 30]]] }), mK);
      for (const x of [-222, -150]) A.add(K.rod(-12, 2, 3.4, { seg: 12 }).rotateZ(PI / 2).translate(x, -4, 0), mSteel);
      A.add(K.slab([[-240, 8, 5], [-128, 8, 5], [-130, 18, 6], [-236, 20, 7]], -16, 16, { b: 4, bs: 3 }), mPol);
      A.add(K.slab([[-274, -156, 3], [-262, -156, 3], [-262, -8, 3], [-274, -8, 3]], -15, 15, { b: 1.4 }), mCh);
      A.add(K.slab([[-288, -160, 6], [-274, -159, 3], [-274, -5, 3], [-288, -4, 6]], -18, 18, { b: 3 }), mPad);
      A.add(K.rod(0, 34, 4.4, { seg: 14 }).rotateZ(-PI / 2).translate(-244, -150, 0), mSteel);                               // monopiede posteriore
      A.add(K.latheX([[0, 0], [0, 7], [1, 8.4], [9, 8.4], [10, 7], [10, 0]], { seg: 20, }).rotateZ(-PI / 2).translate(-244, -160, 0), K.mat('anod', null, { tile: 'knurl', rep: [8, 1] }));
      A.add(K.latheX([[0, 0], [0, 8], [3, 9], [7, 7], [8, 0]], { seg: 16 }).rotateZ(-PI / 2).translate(-244, -184, 0), mPad);
      xc = -288; ycal = -82;
    } else if (v === 'sagitta') {
      A.add(K.box(-50, -60, -17, -34, -4, 17, 2, 3), mCh);
      A.add(K.rod(-6, 6, 4.5, { seg: 16 }).rotateZ(PI / 2).translate(-42, -32, -17.6), mSteel);
      A.add(K.slab([[-52, -4, 5], [-248, -4, 8], [-262, -10, 8], [-262, -148, 8], [-200, -150, 14], [-172, -138, 10], [-120, -116, 30], [-52, -64, 6]], -19, 19, { b: 4, bs: 3, uv: sb }), mK);
      A.add(K.slab([[-236, -2, 4], [-120, -2, 4], [-120, 11, 5], [-232, 13, 6]], -17, 17, { b: 4, bs: 3 }), mK);
      A.add(K.latheX([[0, 0], [0, 9], [1, 10], [8, 10], [9, 9], [9, 0]], { seg: 22 }).rotateY(-PI / 2).translate(-178, -18, 19), K.mat('anod', null, { tile: 'knurl', rep: [10, 1] }));
      A.add(K.slab([[-282, -152, 6], [-262, -151, 3], [-262, -6, 3], [-282, -5, 6]], -19.5, 19.5, { b: 3 }), mPad);
      for (const x of [-268, -265]) A.add(K.slab([[x, -150, 1], [x + 1.2, -150, 1], [x + 1.2, -7, 1], [x, -7, 1]], -19.6, 19.6, { b: .3 }), mNe);
      xc = -282; ycal = -78;
    } else {
      A.add(K.box(-50, -60, -17, -34, -4, 17, 2, 3), mCh);
      A.add(K.rod(-6, 6, 4.5, { seg: 16 }).rotateZ(PI / 2).translate(-42, -32, -17.6), mSteel);
      A.add(K.slab([[-52, -4, 5], [-250, -4, 8], [-266, -12, 8], [-266, -150, 8], [-236, -152, 10], [-52, -64, 6]], -17, 17,
        { b: 3, bs: 3, uv: sb, holes: [[[-66, -18, 5], [-208, -18, 5], [-68, -48, 5]], [[-84, -70, 5], [-236, -34, 5], [-236, -128, 6]]] }), mK);
      A.add(K.slab([[-226, 0, 4], [-136, 0, 4], [-136, 14, 5], [-222, 16, 6]], -15, 15, { b: 3.5, bs: 3 }), mPol);
      A.add(K.rod(-6, 2, 5, { seg: 14 }).rotateZ(PI / 2).translate(-180, -4, 0), mSteel);
      A.add(K.latheX([[0, 0], [0, 8], [1, 9], [7, 9], [8, 8], [8, 0]], { seg: 22 }).rotateY(-PI / 2).translate(-180, -10, 17), K.mat('anod', null, { tile: 'knurl', rep: [10, 1] }));
      A.add(K.slab([[-284, -158, 6], [-266, -157, 3], [-266, -6, 3], [-284, -5, 6]], -18, 18, { b: 3 }), mPad);
      A.add(K.slab([[-264, -160, 2], [-246, -160, 2], [-240, -168, 4], [-262, -170, 4]], -12, 12, { b: 1.5 }), mCh);      // gancio inferiore
      xc = -284; ycal = -80;
    }
    // ---------------- caricatore, grilletto, bipiede
    const mz = C.mag;
    A.add(K.slab([[mz[0], -40], [mz[1], -40], [mz[1] - 2, mz[2], 2], [mz[0] + 2, mz[2], 2]], -13, 13, { b: 1.2 }), K.mat('parker', null, { r: .5 }), 'caricatore');
    A.add(K.slab([[mz[0] - 2, mz[2] - 7, 2], [mz[1] + 2, mz[2] - 7, 2], [mz[1] + 2, mz[2] + 1, 1], [mz[0] - 2, mz[2] + 1, 1]], -14.5, 14.5, { b: 1.5 }), mPol, 'caricatore');
    A.pivot('caricatore', [(mz[0] + mz[1]) / 2, -44, 0]);
    prGrilletto(A, 34, -48, 17, mNe);
    WC.put(A, prBipiede(XF - 40, fy0, { open: false, len: 220 }), 'bipiede'); A.pivot('bipiede', [XF - 40, fy0, 0]);
    // ---------------- cannocchiale sulla slitta
    prOttica(A, Object.assign({ rings: [C.sc.x0 + 120, C.sc.x1 - 120], yb: yr + 9, tappi: v !== 'sagitta' }, C.sc));
    // ---------------- punti di riferimento
    A.anchor('bocca', [XMZ + .5, 0, 0]); A.anchor('espulsione', [130, 10, 16], [0, .5, 1]); A.anchor('impugnatura', [-24, -82, 0]);
    A.anchor('grilletto', [36, -60, 0]); A.anchor('appoggio', [420, fy0 - 2, -10]); A.anchor('calcio', [xc, ycal, 0]);
    const r = A.done();
    r.info = { azione: 'otturatore', bossolo: C.bos, ciclo: { grilletto: { rz: -.1 } }, manuale: [{ leva: { rx: C.lift } }, { leva: { rx: C.lift, dx: C.dx } }],
      ricarica: { caricatore: { dy: -.08 } }, bipiede: { bipiede: { rz: -1.5 } } };
    return r;
  };

  // ================================================================ 120: fucile di precisione con calcio verde regolabile (scheletro in alluminio)
  // azione tonda a tre tenoni (rotazione di 60°) con codolo arrotondato e slitta, canna pesante con copri-filetto, calcio in poliuretano verde:
  // astina larga staccata dalla canna, impugnatura quasi verticale, incavo per la mano sotto il calcio, poggiaguancia su due colonnette,
  // calciolo su due perni con distanziali, ponticello in alluminio, caricatore sporgente, bipiede ripiegato.
  FAM2.prec_calcio_regolabile = function (spec, o) {
    o = o || {}; spec = spec || {};
    const A = K.asm('prec_calcio_regolabile');
    const mNe = K.mat('nero', null, { r: .5 }), mDk = K.mat('nero_lucido', null, { c: '#060606', r: .7 }), mPad = K.mat('gomma'), mAn = K.mat('anod');
    const mSteel = K.mat('inox', null, { c: '#8d9196', r: .3 });
    const L = 230, XB = 822;
    prAzioneTonda(A, spec, { L, port: [86, 162], fin: 'nero', sigla: 'SO ', matO: K.mat('grigio', null, { c: '#83878c', r: .28, m: .88 }), matM: mNe, matK: K.mat('polimero', null, { r: .45 }),
      pomo: [-10, -31, 48], rk: 10.5, rough: .5, sicura: false,
      codolo: [[-50, 0], [-50, 6], [-47, 10], [-36, 12.6], [-10, 13.2], [-4, 13.6], [-1.5, 13.6], [-1.5, 0]] });
    A.add(K.discX(-50.2, 0, 0, 2.4, -1, 12), K.mat('rosso', null, { c: '#b01818' }), 'leva');
    A.add(K.slab([[-14, -12, 1], [-3, -12, 1], [-3, -6, 1], [-12, -7, 1]], 11, 14.5, { b: .6 }), mNe);   // sicura
    A.add(K.slab([[-4, 13, 1], [L - 4, 13, 1], [L - 4, 18.5, 1], [-4, 18.5, 1]], -9, 9, { b: .8 }), mNe);
    WC.put(A, WC.rail(-2, L - 6, 18, { mat: mNe }));
    // canna pesante con copri-filetto
    A.add(K.latheX([[L, 0], [L, 15.4], [L + 2, 16], [L + 34, 16], [L + 48, 14.8], [XB - 2, 12.4], [XB, 12.4], [XB, 0]], { seg: 44 }), mNe);
    A.add(K.latheX([[XB - 1, 0], [XB - 1, 11.4], [XB, 12.2], [XB + 26, 12.2], [XB + 28, 11.2], [XB + 28, 0]], { seg: 32 }), mNe);
    A.add(K.discX(XB + 28.05, 0, 0, 4.4, 1, 18), mDk);
    // ---------------- calcio verde: astina e zona dell'azione, impugnatura e calcio, poggiaguancia e calciolo regolabili
    const mG = K.mat('verde', null, { c: '#4f5c3e', tile: 'grana', rep: [40, 10], r: .62, ns: .3 });
    const sb = [-310, -170, 620, 20];
    A.add(K.slab([[-16, -3, 2], [586, -4, 12], [604, -16, 14], [598, -46, 12], [520, -50, 10], [180, -54, 6], [-16, -54, 4]], -25, 25, { b: 8, bs: 4 }), mG);
    A.add(K.slab([[-14, -4, 0], [-80, -12, 8], [-262, -12, 9], [-262, -150, 9], [-238, -152, 10], [-214, -128, 12], [-186, -120, 18], [-140, -112, 30], [-100, -96, 14], [-88, -86, 10],
      [-72, -102, 12], [-66, -128, 9], [-34, -126, 9], [-24, -58, 8], [-14, -52, 0]], -19, 19, { b: 8, bs: 4 }), mG);
    // poggiaguancia su due colonnette con la manopola
    for (const x of [-226, -150]) A.add(K.rod(-12, 2, 4, { seg: 14 }).rotateZ(PI / 2).translate(x, -6, 0), mSteel);
    A.add(K.slab([[-250, 0, 6], [-120, 0, 6], [-122, 12, 7], [-244, 14, 8]], -17, 17, { b: 6, bs: 3 }), mG);
    A.add(K.latheX([[0, 0], [0, 8], [1, 9], [7, 9], [8, 8], [8, 0]], { seg: 20 }).rotateY(-PI / 2).translate(-188, -10, 19), K.mat('anod', null, { tile: 'knurl', rep: [10, 1] }));
    // calciolo su perni con distanziali
    for (const y of [-40, -118]) A.add(K.rod(-288, -260, 4, { cy: y, seg: 14 }), mSteel);
    for (const x of [-270, -276]) A.add(K.slab([[x - 3, -150, 3], [x, -150, 3], [x, -14, 3], [x - 3, -14, 3]], -17, 17, { b: .8 }), mNe);
    A.add(K.slab([[-300, -156, 8], [-284, -155, 4], [-284, -10, 4], [-300, -9, 8]], -19, 19, { b: 3 }), mPad);
    // ---------------- ponticello in alluminio, grilletto, caricatore, bipiede
    A.add(K.slab([[0, -50], [74, -50], [74, -54, 1], [66, -58, 4], [58, -78, 8], [22, -81, 10], [8, -68, 7], [2, -56, 3]], -7, 7,
      { b: 1.2, holes: [[[9, -55, 3], [62, -55, 3], [55, -74, 6], [24, -77, 8], [14, -65, 4]]] }), mAn);
    prGrilletto(A, 36, -52, 17, mNe);
    A.add(K.slab([[82, -42], [158, -42], [156, -108, 2], [84, -108, 2]], -12.5, 12.5, { b: 1.2 }), K.mat('parker', null, { r: .5 }), 'caricatore');
    A.add(K.slab([[80, -115, 2], [160, -115, 2], [160, -107, 1], [80, -107, 1]], -14, 14, { b: 1.4 }), K.mat('polimero', null, { r: .6 }), 'caricatore');
    A.pivot('caricatore', [120, -46, 0]);
    A.add(K.slab([[480, -53, 1], [590, -51, 1], [590, -47, 0], [480, -47, 0]], -9, 9, { b: .8 }), mAn);
    WC.put(A, prBipiede(548, -52, { open: false, len: 230 }), 'bipiede'); A.pivot('bipiede', [548, -52, 0]);
    // ---------------- cannocchiale
    prOttica(A, { x0: -66, x1: 282, y: 58, rt: 15, ro: 29, re: 21, rings: [40, 170], yb: 27.4, tappi: true });
    // ---------------- punti di riferimento
    A.anchor('bocca', [XB + 28.5, 0, 0]); A.anchor('espulsione', [124, 12, 14], [0, .5, 1]); A.anchor('impugnatura', [-48, -88, 0]);
    A.anchor('grilletto', [38, -62, 0]); A.anchor('appoggio', [400, -54, -10]); A.anchor('calcio', [-300, -82, 0]);
    const r = A.done();
    r.info = { azione: 'otturatore', bossolo: 'fucile_lungo', ciclo: { grilletto: { rz: -.1 } }, manuale: [{ leva: { rx: -1.05 } }, { leva: { rx: -1.05, dx: -.1 } }],
      ricarica: { caricatore: { dy: -.08 } }, bipiede: { bipiede: { rz: -1.5 } } };
    return r;
  };

  // freno di bocca a punta di freccia (12,7): piastre sopra e sotto a trapezio, due deflettori a V verso la bocca, collare e foro
  function prFrenoFreccia(x0, o) {
    o = o || {}; const m = o.mat || K.mat('parker'), dk = K.mat('nero_lucido', null, { c: '#050505', r: .7 }), out = [], h = o.h || 19;
    const tr = [[x0 + 26, -36, 3], [x0 + 34, -41, 3], [x0 + 128, -24, 4], [x0 + 140, -15, 3], [x0 + 140, 15, 3], [x0 + 128, 24, 4], [x0 + 34, 41, 3], [x0 + 26, 36, 3]];
    out.push([K.latheX([[x0, 0], [x0, 19], [x0 + 1.5, 20.5], [x0 + 28, 20.5], [x0 + 28, 0]], { seg: 32 }), m]);
    out.push([K.slabY(tr, h, h + 6.5, { b: 1.2 }), m]); out.push([K.slabY(tr, -h - 6.5, -h, { b: 1.2 }), m]);
    for (const xa of [x0 + 34, x0 + 82]) {
      const w = xa < x0 + 60 ? 39 : 31;
      out.push([K.slabY([[xa, -w, 1], [xa + 10, -w, 1], [xa + 34, -7, 2], [xa + 34, 7, 2], [xa + 10, w, 1], [xa, w, 1], [xa + 24, 7, 2], [xa + 24, -7, 2]], -h - .5, h + .5, { b: 1 }), m]);
    }
    out.push([K.slabY([[x0 + 126, -22, 2], [x0 + 140, -15, 3], [x0 + 140, 15, 3], [x0 + 126, 22, 2]], -h - .5, h + .5, { b: 1.2 }), m]);
    out.push([K.discX(x0 + 140.1, 0, 0, 9, 1, 20), dk]);
    return out;
  }

  // ================================================================ 111, 117: fucili anti-materiale calibro 12,7 semiautomatici a corto rinculo
  // scatola superiore lunga in lamiera stampata con la parte anteriore cava a grandi feritoie (la canna si vede dentro), scatola inferiore
  // con impugnatura, ponticello, pozzetto del caricatore e calcio, grosso calciolo in gomma, maniglia di trasporto, canna scanalata che
  // rincula (parte 'canna') con il freno a punta di freccia, carrello e manetta di armamento a destra (parte 'otturatore'), bipiede aperto.
  // var 'base' = nero fosfatato, slitta corta, piede del monopiede sotto il calcio; var 's' = color sabbia, slitta lunga, impugnatura posteriore.
  FAM2.prec_antimateriale = function (spec, o) {
    o = o || {}; spec = spec || {}; const sv = o.var === 's';
    const A = K.asm('prec_antimateriale');
    const col = sv ? '#8a7756' : '#2b2d2c', kind = sv ? 'sabbia' : 'parker';
    const mPk = K.mat(kind, null, { c: col, r: .62 }), mNe = K.mat('nero', null, { r: .5 }), mDk = K.mat('nero_lucido', null, { c: '#060606', r: .7 }), mPad = K.mat('gomma');
    const mBar = K.mat('parker', null, { c: '#262827', r: .5 });
    // ---------------- scatola superiore: parte posteriore piena (finestra di espulsione a destra), parte anteriore cava con feritoie
    const ub = [-10, -30, 650, 50];
    const pU = K.painter(ub, { w: 1024, h: 512, rough: .6 });
    pU.text('L', (spec.produttore || '').toUpperCase(), 250, 24, 7, { spacing: 6 });
    pU.text('L', (spec.nome || '').toUpperCase() + '   CAL. 12,7×99', 250, 12, 5, { spacing: 4 });
    pU.text('L', prMatr(spec, 'IR '), 250, 2, 4);
    pU.text('R', (spec.nome || '').toUpperCase(), 160, 22, 5, { spacing: 4 });
    for (const [x, y] of [[30, -18], [380, -18], [600, -18], [600, 32], [30, 32]]) pU.pin('LR', x, y, 3.2, { h: .4, a: .8 });
    pU.line('LR', [[0, -18], [640, -18]], .6, { h: -.5, a: .7 });
    pU.noise({ a: .12, r: .16, seed: 51 }); pU.walls({ r: .6 });
    const mU = K.mat(kind, pU.done(2.2), { ns: .8, c: col });
    const ur = [[0, -26, 2, .6], [642, -26, 0, .6], [642, 44, 0, .6], [0, 44, 3, 1]];
    const urP = [[0, -26, 2, .6], [642, -26, 0, .6], [642, 44, 0, .6], [540, 44, .6, .4], [540, 26, 0, .4], [540, -6, 2, .3], [430, -6, 2, .3], [430, 26, 2, .3], [430, 44, .6, .4], [0, 44, 3, 1]];
    A.add(K.slab(ur, -30, 0, { bL: 2, bR: 0, uv: ub }), mU);
    A.add(K.slab([[0, -26, 2, .6], [642, -26, 0, .6], [642, 44, 0, .6], [0, 44, 3, 1]], 0, 30, { bL: 0, bR: 2, uv: ub, holes: [K.rrect(430, -6, 540, 26, 2)] }), mU);
    A.add(K.box(430, -6, 2, 540, 26, 16, 0), mDk);
    // parte anteriore cava
    const fh = []; for (const x of [662, 716, 770, 824]) fh.push(K.rrect(x, -12, x + 40, 30, 15));
    A.add(K.slab([[640, -26, 0], [880, -26, 3], [880, 44, 3], [640, 44, 0]], 25.5, 30, { b: 1, bs: 1, holes: fh }), mPk);
    A.add(K.slab([[640, -26, 0], [880, -26, 3], [880, 44, 3], [640, 44, 0]], -30, -25.5, { b: 1, bs: 1, holes: fh }), mPk);
    A.add(K.slabY([[640, -27, 0], [880, -27, 3], [880, 27, 3], [640, 27, 0]], 39.5, 44, { b: 1 }), mPk);
    A.add(K.slabY([[640, -27, 0], [880, -27, 3], [880, 27, 3], [640, 27, 0]], -26, -21.5, { b: 1 }), mPk);
    A.add(K.slabX([[-30, -26, 3], [30, -26, 3], [30, 44, 3], [-30, 44, 3]], 874, 880, { b: 1.2, holes: [K.circ(0, 0, 18.5, 28)] }), mPk);
    A.add(K.slabX([[-27, -24, 2], [27, -24, 2], [27, 42, 2], [-27, 42, 2]], 640, 646, { b: .8, holes: [K.circ(0, 0, 18.5, 28)] }), mDk);
    // slitta, maniglia di trasporto
    WC.put(A, WC.rail(sv ? 14 : 84, sv ? 866 : 524, 43.5, { mat: mNe }));
    { const y0 = sv ? 53 : 44, mh = K.mat('nero', null, { r: .45 });
      A.add(K.slab([[576, y0 - 1, 2], [624, y0 - 1, 2], [618, y0 + 9, 2], [582, y0 + 9, 2]], -13, 13, { b: 1.2 }), mh);
      A.add(K.rod(-6, 6, 5, { seg: 14, cy: 0 }).rotateY(PI / 2).translate(600, y0 + 6, 0), K.mat('inox', null, { c: '#8d9196', r: .3 }));
      for (const zz of [-11, 11]) A.add(prAsta([600, y0 + 5, zz], [604, y0 + 56, zz], 4.6, 4.6), mh);
      A.add(K.rod(546, 662, 9.5, { cy: y0 + 62, seg: 20 }), K.mat('polimero', null, { tile: 'ribs', rep: [14, 1], r: .7 }));
      for (const x of [546, 662]) A.add(K.latheX([[0, 0], [0, 10], [2, 10.5], [4, 9], [4, 0]], { seg: 20 }).translate(x === 546 ? -4 : 0, 0, 0).translate(x, y0 + 62, 0), mh);
      A.add(K.slab([[596, y0 + 52, 2], [612, y0 + 52, 2], [612, y0 + 70, 4], [596, y0 + 70, 4]], -12, 12, { b: 1 }), mh); }
    // ---------------- scatola inferiore con il calcio, impugnatura, ponticello, monopiede o impugnatura posteriore
    const lb = [-12, -130, 570, -18];
    const pL = K.painter(lb, { w: 1024, h: 512, rough: .62 });
    for (const [x, y] of [[40, -32], [548, -32], [330, -40]]) { pL.pin('LR', x, y, 4.5, { h: .45, a: .9 }); pL.fill('LR', K.circ(x, y, 1.6, 8), { h: -.5, a: .5 }); }
    pL.fill('LR', [[392, -26, 2], [508, -26, 2], [508, -58, 2], [392, -58, 2]], { h: -.3, a: .85 });
    pL.text('L', 'SAFE   FIRE', 315, -46, 3, { a: .9, h: -.4 });
    pL.noise({ a: .12, r: .16, seed: 52 }); pL.walls({ r: .6 });
    const mL = K.mat(kind, pL.done(2.2), { ns: .8, c: col });
    A.add(K.slab([[-8, -22, 0], [562, -22, 0], [562, -46, 10], [522, -62, 6], [384, -62, 4], [376, -56, 0], [298, -56, 0], [280, -62, 8], [40, -118, 24], [-8, -124, 6]], -28, 28, { b: 2.4, uv: lb }), mL);
    A.add(K.slab([[296, -54], [378, -54], [378, -58, 1], [372, -62, 3], [364, -82, 8], [314, -86, 10], [302, -72, 6], [296, -60, 2]], -8, 8,
      { b: 1.2, holes: [[[304, -60, 3], [368, -60, 3], [361, -78, 6], [316, -81, 8], [308, -70, 4]]] }), mPk);
    A.add(K.loftS([{ p: [290, -50], f: 18, r: 23, w: 14 }, { p: [280, -82], f: 17, r: 22, w: 15 }, { p: [270, -114], f: 16.5, r: 21.5, w: 15.6 }, { p: [264, -142], f: 16, r: 20.5, w: 15 },
      { p: [262.5, -152], f: 12.5, r: 16.5, w: 11.5 }].map(q => Object.assign({ nf: 2.6, nr: 2.2 }, q)), { K: 26, sub: 4 }), K.mat('polimero', null, { tile: 'grana', rep: [6, 8], r: .7 }));
    A.add(K.slab([[-10, -122, 2], [-4, -122, 2], [-4, 42, 2], [-10, 42, 2]], -29, 29, { b: 1 }), mNe);                     // piastra del calciolo
    A.add(K.slab([[-52, -128, 14], [-10, -126, 4], [-10, 44, 4], [-52, 40, 14]], -31, 31, { b: 6, bs: 4 }), mPad);
    for (let y = -100; y < 30; y += 24) A.add(K.slab([[-53, y, 2], [-46, y, 2], [-46, y + 7, 2], [-53, y + 7, 2]], -26, 26, { b: 1 }), K.mat('gomma', null, { c: '#222222' }));
    if (sv) {
      A.add(K.loftS([{ p: [88, -104], f: 17, r: 17, w: 15 }, { p: [86, -140], f: 16, r: 17, w: 16 }, { p: [86, -172], f: 16, r: 16.5, w: 15 }, { p: [86, -182], f: 13, r: 13, w: 12 }]
        .map(q => Object.assign({ nf: 2.4, nr: 2.4 }, q)), { K: 24, sub: 4 }), K.mat('polimero', null, { tile: 'grana', rep: [5, 6], r: .7 }));
    } else {
      A.add(K.latheX([[0, 0], [0, 13], [2, 15], [16, 15], [18, 13], [18, 0]], { seg: 24 }).rotateZ(-PI / 2).translate(70, -104, 0), mPk);
      A.add(K.latheX([[0, 0], [0, 9], [1, 10], [12, 10], [13, 9], [13, 0]], { seg: 20 }).rotateZ(-PI / 2).translate(70, -122, 0), mPad);
    }
    // ---------------- caricatore
    A.add(K.slab([[394, -44], [506, -44], [504, -170, 3], [396, -170, 3]], -17, 17, { b: 1.5 }), K.mat('parker', null, { c: '#2c2e2c', r: .55 }), 'caricatore');
    A.add(K.slab([[392, -178, 3], [508, -178, 3], [508, -168, 2], [392, -168, 2]], -18.5, 18.5, { b: 1.6 }), mNe, 'caricatore');
    for (const x of [410, 450, 490]) A.add(K.slab([[x - 3, -60, 1], [x + 3, -60, 1], [x + 3, -160, 1], [x - 3, -160, 1]], 16.6, 17.8, { b: .4 }), K.mat('parker', null, { c: '#2c2e2c', r: .55 }), 'caricatore');
    A.pivot('caricatore', [450, -50, 0]);
    prGrilletto(A, 334, -56, 19, mNe);
    // ---------------- canna scanalata che rincula con il freno (parte 'canna')
    A.add(K.latheX([[540, 0], [540, 19], [560, 19], [566, 17.5], [700, 17.5]], { seg: 36 }), mBar, 'canna');
    A.add(prScan(700, 1236, 17.5, 16, { n: 8, d: 2.6, re: 20, sub: 6, off: PI / 8 }), mBar, 'canna');
    A.add(K.latheX([[1236, 16], [1264, 16], [1264, 0]], { seg: 36 }), mBar, 'canna');
    WC.put(A, prFrenoFreccia(1263, { mat: mBar }), 'canna');
    A.pivot('canna', [880, 0, 0]);
    // ---------------- carrello visibile nella finestra e manetta di armamento a destra (parte 'otturatore')
    A.add(K.box(360, -4, -15, 560, 24, 15, 2), K.mat('grigio', null, { c: '#5d6064', r: .35, m: .85 }), 'otturatore');
    A.add(K.box(438, 4, 14, 532, 16, 15.5, .5), mDk, 'otturatore');
    A.add(K.rod(0, 26, 5, { seg: 14 }).rotateY(-PI / 2).translate(470, 14, 30), mNe, 'otturatore');
    A.add(K.latheX([[0, 0], [0, 7], [2, 9], [12, 9], [14, 7], [14, 0]], { seg: 20 }).rotateY(-PI / 2).translate(470, 14, 54), mNe, 'otturatore');
    A.pivot('otturatore', [470, 10, 0]);
    // ---------------- bipiede aperto sotto la parte anteriore
    WC.put(A, prBipiede(820, -26, { tipo: 'pesante', open: true, len: 300 }), 'bipiede'); A.pivot('bipiede', [820, -26, 0]);
    // ---------------- cannocchiale
    prOttica(A, { x0: 60, x1: 400, y: 98, rt: 15, ro: 28.5, re: 21.5, rings: [140, 310], yb: 53, sole: sv ? 50 : 0 });
    // ---------------- punti di riferimento
    A.anchor('bocca', [1404, 0, 0]); A.anchor('espulsione', [485, 12, 31], [0, .3, 1]); A.anchor('impugnatura', [276, -100, 0]);
    A.anchor('grilletto', [336, -68, 0]); A.anchor('appoggio', [600, -40, -20]); A.anchor('calcio', [-52, -40, 0]);
    const r = A.done();
    r.info = { azione: 'semi', bossolo: 'pesante', ciclo: { canna: { dx: -.025 }, otturatore: { dx: -.11 }, grilletto: { rz: -.1 } },
      ricarica: { caricatore: { dx: .01, dy: -.13 } }, bipiede: { bipiede: { rz: 1.45 } } };
    return r;
  };

  // ================================================================ 114: fucile anti-materiale 12,7 a otturatore girevole, bullpup
  // grande scatola squadrata che fa da calcio: caricatore dietro l'impugnatura, otturatore con il manubrio sul fianco destro sopra il
  // caricatore (si apre verso il tiratore), poggiaguancia in gomma sul dorso, grosso calciolo, slitta lunga, canna scanalata, freno a due
  // camere, bipiede aperto sotto la parte anteriore.
  FAM2.prec_antimateriale_bullpup = function (spec, o) {
    o = o || {}; spec = spec || {};
    const A = K.asm('prec_antimateriale_bullpup');
    const col = '#2a2c2b', mPk = K.mat('parker', null, { c: col, r: .6 }), mNe = K.mat('nero', null, { r: .5 }), mDk = K.mat('nero_lucido', null, { c: '#060606', r: .7 }), mPad = K.mat('gomma');
    const mBar = K.mat('parker', null, { c: '#262827', r: .5 });
    // ---------------- scatola-calcio: mezza sinistra piena, destra con la finestra dell'otturatore
    const bb = [-10, -90, 570, 50];
    const pB = K.painter(bb, { w: 1024, h: 512, rough: .6 });
    pB.text('L', (spec.produttore || '').toUpperCase(), 300, 18, 6.5, { spacing: 6 });
    pB.text('L', (spec.nome || '').toUpperCase() + '   CAL. 12,7×99', 300, 6, 4.6, { spacing: 4 });
    pB.text('R', prMatr(spec, 'IR '), 440, 18, 4);
    for (const [x, y] of [[30, -40], [180, -30], [330, -30], [520, -20], [520, 26], [30, 26]]) { pB.pin('LR', x, y, 3.6, { h: .4, a: .8 }); pB.fill('LR', K.circ(x, y, 1.4, 6), { h: -.5, a: .5 }); }
    pB.line('LR', [[0, -26], [560, -26]], .7, { h: -.5, a: .7 });
    pB.stipple('LR', [[24, -34], [150, -30], [160, -60], [40, -76]], { s: .34, r: .85, a: .9 });
    pB.noise({ a: .12, r: .16, seed: 61 }); pB.walls({ r: .6 });
    const mB = K.mat('parker', pB.done(2.2), { ns: .8, c: col });
    const out = [[0, -82, 8], [0, 42, 4], [540, 42, 8], [562, 30, 8], [562, -36, 8], [452, -40, 4], [340, -44, 4], [196, -52, 10], [64, -82, 18]];
    A.add(K.slab(out, -32, 0, { bL: 2.4, bR: 0, uv: bb }), mB);
    A.add(K.slab(out, 0, 32, { bL: 0, bR: 2.4, uv: bb, holes: [K.rrect(196, -2, 326, 30, 3)] }), mB);
    A.add(K.box(196, -4, 2, 326, 30, 20, 0), mDk);
    WC.put(A, WC.rail(150, 548, 41.5, { mat: mNe }));
    A.add(K.slab([[10, 40, 6], [140, 40, 6], [140, 52, 6], [16, 54, 8]], -26, 26, { b: 5, bs: 3 }), mPad);                    // poggiaguancia
    A.add(K.slab([[-36, -90, 14], [-4, -88, 4], [-4, 44, 4], [-36, 40, 14]], -33, 33, { b: 6, bs: 4 }), mPad);                  // calciolo
    A.add(K.slab([[-6, -86, 2], [0, -86, 2], [0, 43, 2], [-6, 43, 2]], -32, 32, { b: 1 }), mNe);
    // ---------------- otturatore (leva): corpo nella finestra, manubrio con pomello sul fianco destro
    A.add(K.rod(150, 336, 13, { seg: 26 }), K.mat('grigio', null, { c: '#6c7075', r: .3, m: .85 }), 'leva');
    A.add(prAsta([214, 6, 12], [206, -8, 52], 6.5, 5.5), mNe, 'leva');
    A.add(prSfera([204, -11, 58], 12.5, { seg: 22, n: 12 }), K.mat('polimero', null, { r: .5 }), 'leva');
    A.pivot('leva', [0, 6, 0]);
    // ---------------- impugnatura, ponticello, grilletto, caricatore dietro l'impugnatura
    A.add(K.loftS([{ p: [374, -40], f: 18, r: 23, w: 14 }, { p: [364, -74], f: 17, r: 22, w: 15 }, { p: [354, -106], f: 16.5, r: 21.5, w: 15.6 }, { p: [348, -134], f: 16, r: 20.5, w: 15 },
      { p: [346.5, -144], f: 12.5, r: 16.5, w: 11.5 }].map(q => Object.assign({ nf: 2.6, nr: 2.2 }, q)), { K: 26, sub: 4 }), K.mat('polimero', null, { tile: 'grana', rep: [6, 8], r: .7 }));
    A.add(K.slab([[384, -40], [462, -40], [462, -44, 1], [456, -48, 3], [448, -70, 8], [398, -74, 10], [386, -60, 6], [382, -48, 2]], -8, 8,
      { b: 1.2, holes: [[[392, -46, 3], [452, -46, 3], [445, -66, 6], [400, -69, 8], [394, -56, 4]]] }), mPk);
    prGrilletto(A, 418, -42, 19, mNe);
    A.add(K.slab([[214, -48], [308, -48], [306, -158, 3], [216, -158, 3]], -17, 17, { b: 1.5 }), mBar, 'caricatore');
    A.add(K.slab([[212, -166, 3], [310, -166, 3], [310, -156, 2], [212, -156, 2]], -18.5, 18.5, { b: 1.6 }), mNe, 'caricatore');
    A.pivot('caricatore', [261, -50, 0]);
    // ---------------- canna scanalata e freno a due camere
    A.add(K.latheX([[560, 0], [560, 21], [566, 21], [574, 18], [620, 18]], { seg: 36 }), mBar);
    A.add(prScan(620, 960, 18, 16.5, { n: 8, d: 2.6, re: 20, sub: 6, off: PI / 8 }), mBar);
    A.add(K.latheX([[960, 16.5], [1000, 16.5], [1000, 0]], { seg: 36 }), mBar);
    WC.put(A, prFreno(1000, 112, 25, { n: 2, mat: mBar, win: .7, base: 22, foro: 9 }));
    // ---------------- bipiede aperto
    WC.put(A, prBipiede(520, -36, { tipo: 'pesante', open: true, len: 290 }), 'bipiede'); A.pivot('bipiede', [520, -36, 0]);
    // ---------------- cannocchiale
    prOttica(A, { x0: 160, x1: 500, y: 96, rt: 15, ro: 28.5, re: 21.5, rings: [240, 410], yb: 51 });
    // ---------------- punti di riferimento
    A.anchor('bocca', [1112.5, 0, 0]); A.anchor('espulsione', [262, 14, 33], [0, .4, 1]); A.anchor('impugnatura', [358, -92, 0]);
    A.anchor('grilletto', [420, -54, 0]); A.anchor('appoggio', [140, -86, -6]); A.anchor('calcio', [-36, -24, 0]);
    const r = A.done();
    r.info = { azione: 'otturatore', bossolo: 'pesante', ciclo: { grilletto: { rz: -.1 } }, manuale: [{ leva: { rx: -1.3 } }, { leva: { rx: -1.3, dx: -.155 } }],
      ricarica: { caricatore: { dy: -.12 } }, bipiede: { bipiede: { rz: 1.45 } } };
    return r;
  };

  // ================================================================ 116: fucile di precisione a lunga gittata con calcio retrattile
  // scatola squadrata, astina tubolare lunga con file di fori tondi e slitta continua, maniglia di trasporto ad arco sull'astina,
  // canna scanalata libera, grande freno cilindrico a quattro camere, calcio retrattile su due tubi con poggiaguancia staccato e
  // calciolo alto con il monopiede, impugnatura in gomma con le dita, caricatore sporgente, bipiede aperto in punta.
  FAM2.prec_lunga_gittata = function (spec, o) {
    o = o || {}; spec = spec || {};
    const A = K.asm('prec_lunga_gittata');
    const mNe = K.mat('nero', null, { r: .5 }), mAn = K.mat('anod', null, { r: .46 }), mDk = K.mat('nero_lucido', null, { c: '#060606', r: .7 }), mPad = K.mat('gomma');
    const mSteel = K.mat('inox', null, { c: '#8d9196', r: .3 });
    const L = 230, XA = 734, XB = 1062;
    prCulattaPiatta(A, spec, { L, yb: -30, yt: 24, hw: 22, port: [92, 196, 0], fin: 'anod', sigla: 'PR ', pomo: [-12, -36, 56], rk: 12, cal: '10,4×77' });
    WC.put(A, WC.rail(-4, XA - 4, 23.5, { mat: mNe }));
    // ---------------- astina tubolare con fori tondi, ghiera anteriore
    const fh = []; for (let x = L + 40; x < XA - 40; x += 34) { fh.push(K.circ(x, -16, 7, 12)); fh.push(K.circ(x + 17, 2, 7, 12)); }
    const sp = [[L, -36, 0], [XA, -36, 6], [XA, 20, 4], [L, 20, 0]];
    A.add(K.slab(sp, 24.5, 28, { b: 1, bs: 1, holes: fh }), mAn);
    A.add(K.slab(sp, -28, -24.5, { b: 1, bs: 1, holes: fh }), mAn);
    A.add(K.slabY([[L, -26, 0], [XA, -26, 5], [XA, 26, 5], [L, 26, 0]], -36, -32, { b: 1.2 }), mAn);
    A.add(K.slabY([[L, -26, 0], [XA, -26, 5], [XA, 26, 5], [L, 26, 0]], 16, 20, { b: .8 }), mAn);
    A.add(K.slabX([[-28, -36, 6], [28, -36, 6], [28, 20, 4], [-28, 20, 4]], XA - 8, XA, { b: 1.4, holes: [K.circ(0, 0, 16, 28)] }), mAn);
    // maniglia di trasporto ad arco sulla slitta
    { const yb = 33, pts = []; for (let k = 0; k <= 8; k++) { const t = k / 8, a = PI * t; pts.push([548 + 130 * t, yb + Math.sin(a) * 48]); }
      for (let k = 0; k < 8; k++) A.add(prAsta([pts[k][0], pts[k][1], 0], [pts[k + 1][0], pts[k + 1][1], 0], 6, 6, { c: 0 }), mNe);
      for (const x of [548, 678]) A.add(K.box(x - 9, 32, -12, x + 9, 40, 12, 1.5, 2), mNe); }
    // ---------------- canna scanalata, freno cilindrico grande
    A.add(K.latheX([[L, 0], [L, 17], [L + 30, 17], [L + 40, 15.5], [300, 15.5]], { seg: 40 }), mNe);
    A.add(prScan(300, XB - 40, 15.5, 14, { n: 6, d: 2.6, re: 20, off: PI / 6 }), mNe);
    A.add(K.latheX([[XB - 40, 14], [XB, 14], [XB, 0]], { seg: 40 }), mNe);
    WC.put(A, prFreno(XB, 104, 25, { n: 4, mat: mNe, win: .5, base: 18, foro: 8 }));
    // ---------------- calcio retrattile: due tubi, poggiaguancia staccato, calciolo con monopiede
    for (const y of [8, -26]) A.add(K.rod(-196, 2, 8, { cy: y, seg: 20 }), mSteel);
    A.add(K.slab([[-214, -112, 6], [-190, -112, 6], [-190, 30, 6], [-214, 28, 6]], -20, 20, { b: 3 }), mAn);
    A.add(K.slab([[-232, -118, 10], [-214, -116, 4], [-214, 34, 4], [-232, 30, 10]], -22, 22, { b: 4, bs: 3 }), mPad);
    A.add(K.slab([[-178, 16, 4], [-60, 16, 4], [-60, 30, 6], [-172, 34, 8]], -18, 18, { b: 5, bs: 3 }), mAn);
    for (const x of [-160, -80]) A.add(K.box(x - 6, 6, -10, x + 6, 18, 10, 1, 2), mAn);
    A.add(K.rod(0, 60, 6, { seg: 14 }).rotateZ(-PI / 2).translate(-202, -112, 0), mNe);
    A.add(K.latheX([[0, 0], [0, 10], [2, 11], [10, 11], [12, 0]], { seg: 18 }).rotateZ(-PI / 2).translate(-202, -170, 0), mPad);
    // ---------------- impugnatura in gomma con le dita, ponticello, grilletto, caricatore
    A.add(K.loftS([{ p: [4, -28], f: 19, r: 22, w: 15 }, { p: [-4, -56], f: 21, r: 21, w: 16 }, { p: [-10, -76], f: 18, r: 21, w: 16 }, { p: [-15, -94], f: 20.5, r: 21, w: 16.4 },
      { p: [-19, -112], f: 18, r: 20.5, w: 16 }, { p: [-22, -130], f: 19.5, r: 20, w: 15.4 }, { p: [-23, -140], f: 15, r: 16, w: 12 }].map(q => Object.assign({ nf: 2.4, nr: 2.2 }, q)), { K: 26, sub: 4 }), K.mat('gomma', null, { tile: 'stipple', rep: [4, 6], r: .85 }));
    A.add(K.slab([[16, -30], [86, -30], [86, -34, 1], [80, -38, 4], [72, -60, 8], [30, -63, 10], [20, -50, 6], [16, -38, 2]], -7.5, 7.5,
      { b: 1.2, holes: [[[24, -36, 3], [76, -36, 3], [69, -56, 6], [32, -59, 8], [26, -46, 4]]] }), mAn);
    prGrilletto(A, 48, -30, 18, mNe);
    A.add(K.slab([[96, -28], [186, -28], [184, -126, 3], [98, -126, 3]], -14, 14, { b: 1.3 }), K.mat('parker', null, { r: .55 }), 'caricatore');
    A.add(K.slab([[94, -134, 3], [188, -134, 3], [188, -125, 2], [94, -125, 2]], -15.5, 15.5, { b: 1.5 }), mNe, 'caricatore');
    A.pivot('caricatore', [141, -32, 0]);
    // ---------------- bipiede aperto sotto la punta dell'astina
    WC.put(A, prBipiede(700, -36, { open: true, len: 270 }), 'bipiede'); A.pivot('bipiede', [700, -36, 0]);
    // ---------------- cannocchiale con paraluce
    prOttica(A, { x0: -24, x1: 380, y: 76, rt: 15, ro: 32, re: 22.5, rings: [96, 248], yb: 33, sole: 70 });
    // ---------------- punti di riferimento
    A.anchor('bocca', [XB + 104.5, 0, 0]); A.anchor('espulsione', [144, 12, 23], [0, .5, 1]); A.anchor('impugnatura', [-10, -84, 0]);
    A.anchor('grilletto', [50, -44, 0]); A.anchor('appoggio', [520, -38, -12]); A.anchor('calcio', [-232, -42, 0]);
    const r = A.done();
    r.info = { azione: 'otturatore', bossolo: 'fucile_lungo', ciclo: { grilletto: { rz: -.1 } }, manuale: [{ leva: { rx: -1.4 } }, { leva: { rx: -1.4, dx: -.125 } }],
      ricarica: { caricatore: { dy: -.09 } }, bipiede: { bipiede: { rz: 1.5 } }, calcio_retrattile: { dx: .11 } };
    return r;
  };

  // ================================================================ 123: fucile di precisione bullpup a otturatore girevole
  // corpo lungo color sabbia con caricatore davanti al calciolo, impugnatura chiusa da un grande ponticello (a pollice passante),
  // otturatore dietro con il manubrio vicino alla guancia, poggiaguancia su colonnette, astina rettangolare con le asole e slitta continua,
  // canna con freno a tre camere, bipiede ripiegato.
  FAM2.prec_bullpup_precisione = function (spec, o) {
    o = o || {}; spec = spec || {};
    const A = K.asm('prec_bullpup_precisione');
    const col = '#8b7653', mS = K.mat('sabbia', null, { c: col, r: .55 }), mNe = K.mat('nero', null, { r: .5 }), mDk = K.mat('nero_lucido', null, { c: '#060606', r: .7 }), mPad = K.mat('gomma');
    const mSteel = K.mat('inox', null, { c: '#8d9196', r: .3 });
    // ---------------- corpo: scatola con la finestra a destra, pozzetto del caricatore dietro, scritte
    const bb = [-10, -120, 340, 30];
    const pB = K.painter(bb, { w: 1024, h: 512, rough: .55 });
    pB.text('L', (spec.produttore || '').toUpperCase(), 200, 6, 4.6, { spacing: 5 });
    pB.text('L', (spec.nome || '').toUpperCase() + '  8,6×70', 200, -4, 3.4, { spacing: 4 });
    pB.text('R', prMatr(spec, 'MT '), 270, 8, 3);
    for (const [x, y] of [[14, -20], [14, -90], [120, -20], [300, -20]]) { pB.pin('LR', x, y, 3, { h: .4, a: .8 }); pB.fill('LR', K.circ(x, y, 1.2, 6), { h: -.5, a: .5 }); }
    pB.stipple('LR', [[24, -66], [100, -66], [100, -110], [24, -110]], { s: .3, r: .85 });
    pB.noise({ a: .1, r: .14, seed: 71 }); pB.walls({ r: .55 });
    const mB = K.mat('sabbia', pB.done(2.1), { ns: .8, c: col });
    const out = [[0, -116, 6], [0, 22, 4], [334, 22, 0], [334, -38, 0], [114, -40, 6], [108, -64, 4], [22, -64, 4], [20, -116, 4]];
    A.add(K.slab(out, -24, 0, { bL: 2.2, bR: 0, uv: bb }), mB);
    A.add(K.slab(out, 0, 24, { bL: 0, bR: 2.2, uv: bb, holes: [K.rrect(124, -4, 236, 18, 3)] }), mB);
    A.add(K.box(124, -6, 2, 236, 18, 14, 0), mDk);
    // impugnatura chiusa dal ponticello
    A.add(K.slab([[150, -36, 0], [304, -36, 0], [304, -46, 6], [266, -108, 14], [236, -140, 10], [196, -148, 10], [158, -144, 10], [146, -64, 8]], -16, 16,
      { b: 4, bs: 3, uv: bb, holes: [[[178, -48, 8], [288, -46, 6], [254, -100, 12], [226, -124, 10], [196, -128, 8], [186, -70, 10]]] }), mB);
    prGrilletto(A, 202, -44, 18, mNe);
    // ---------------- otturatore dietro (leva) con il manubrio vicino alla guancia
    A.add(K.rod(26, 236, 10, { seg: 24 }), K.mat('grigio', null, { c: '#83878c', r: .25, m: .9 }), 'leva');
    A.add(prAsta([62, 0, 9], [52, -20, 44], 5, 4.4), mNe, 'leva');
    A.add(prSfera([50, -23, 48], 10, { seg: 20, n: 12 }), K.mat('polimero', null, { r: .45 }), 'leva');
    A.pivot('leva', [0, 0, 0]);
    // poggiaguancia su colonnette e calciolo
    for (const x of [26, 96]) A.add(K.rod(-2, 10, 3.6, { seg: 12 }).rotateZ(PI / 2).translate(x, 24, 0), mSteel);
    A.add(K.slab([[8, 32, 5], [118, 32, 5], [114, 44, 6], [12, 46, 7]], -18, 18, { b: 5, bs: 3 }), mS);
    A.add(K.slab([[-26, -122, 8], [0, -120, 3], [0, 30, 3], [-26, 28, 8]], -24, 24, { b: 4, bs: 3 }), mPad);
    // ---------------- astina rettangolare con le asole, slitta continua
    const as = []; for (let x = 360; x < 600; x += 44) { as.push(K.rrect(x, -24, x + 30, -16, 3.8)); as.push(K.rrect(x, -6, x + 30, 2, 3.8)); }
    const sp = [[334, -36, 0], [628, -36, 5], [628, 18, 4], [334, 18, 0]];
    A.add(K.slab(sp, 21, 24, { b: .9, bs: 1, holes: as }), mS);
    A.add(K.slab(sp, -24, -21, { b: .9, bs: 1, holes: as }), mS);
    A.add(K.slabY([[334, -22, 0], [628, -22, 4], [628, 22, 4], [334, 22, 0]], -36, -32.5, { b: 1 }), mS);
    A.add(K.slabY([[334, -22, 0], [628, -22, 4], [628, 22, 4], [334, 22, 0]], 14.5, 18, { b: .8 }), mS);
    A.add(K.slabX([[-24, -36, 5], [24, -36, 5], [24, 18, 4], [-24, 18, 4]], 622, 628, { b: 1.2, holes: [K.circ(0, 0, 15, 28)] }), mS);
    WC.put(A, WC.rail(-2, 624, 21.5, { mat: mNe }));
    // ---------------- canna, freno, caricatore, bipiede
    A.add(K.latheX([[236, 0], [236, 15], [270, 15], [280, 14], [858, 12.4], [860, 12.4], [860, 0]], { seg: 40 }), mNe);
    WC.put(A, prFreno(860, 68, 15.5, { n: 3, mat: mNe }));
    A.add(K.slab([[26, -56], [104, -56], [102, -150, 3], [28, -150, 3]], -12.5, 12.5, { b: 1.2 }), K.mat('parker', null, { r: .55 }), 'caricatore');
    A.add(K.slab([[24, -158, 3], [106, -158, 3], [106, -149, 2], [24, -149, 2]], -14, 14, { b: 1.4 }), K.mat('polimero', null, { r: .6 }), 'caricatore');
    A.pivot('caricatore', [65, -60, 0]);
    WC.put(A, prBipiede(590, -36, { open: false, len: 220 }), 'bipiede'); A.pivot('bipiede', [590, -36, 0]);
    // ---------------- cannocchiale
    prOttica(A, { x0: 100, x1: 440, y: 72, rt: 17, ro: 29, re: 22, rings: [190, 350], yb: 31, tappi: true });
    // ---------------- punti di riferimento
    A.anchor('bocca', [928.5, 0, 0]); A.anchor('espulsione', [180, 8, 25], [0, .4, 1]); A.anchor('impugnatura', [170, -96, 0]);
    A.anchor('grilletto', [204, -56, 0]); A.anchor('appoggio', [470, -38, -10]); A.anchor('calcio', [-26, -46, 0]);
    const r = A.done();
    r.info = { azione: 'otturatore', bossolo: 'fucile_lungo', ciclo: { grilletto: { rz: -.1 } }, manuale: [{ leva: { rx: -1.15 } }, { leva: { rx: -1.15, dx: -.105 } }],
      ricarica: { caricatore: { dy: -.09 } }, bipiede: { bipiede: { rz: -1.5 } } };
    return r;
  };

  MAP2[105] = { f: 'prec_otturatore_legno', o: {} };
  MAP2[106] = { f: 'prec_otturatore_tattico', o: { var: 'marine' } };
  MAP2[110] = { f: 'prec_otturatore_tattico', o: { var: 'esercito' } };
  MAP2[107] = { f: 'prec_otturatore_rotante', o: {} };
  MAP2[109] = { f: 'prec_otturatore_manicotto', o: {} };
  MAP2[111] = { f: 'prec_antimateriale', o: { var: 'base' } };
  MAP2[117] = { f: 'prec_antimateriale', o: { var: 's' } };
  MAP2[112] = { f: 'prec_pollice_passante', o: { var: 'base' } };
  MAP2[114] = { f: 'prec_antimateriale_bullpup', o: {} };
  MAP2[115] = { f: 'prec_pollice_passante', o: { var: 'magnum' } };
  MAP2[116] = { f: 'prec_lunga_gittata', o: {} };
  MAP2[119] = { f: 'prec_telaio', o: { var: 'cheviot' } };
  MAP2[120] = { f: 'prec_calcio_regolabile', o: {} };
  MAP2[121] = { f: 'prec_telaio', o: { var: 'lyra' } };
  MAP2[122] = { f: 'prec_telaio', o: { var: 'sagitta' } };
  MAP2[123] = { f: 'prec_bullpup_precisione', o: {} };
  MAP2[124] = { f: 'prec_telaio', o: { var: 'gaspe' } };
})();
