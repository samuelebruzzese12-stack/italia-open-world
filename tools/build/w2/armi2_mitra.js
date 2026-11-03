// Mitra e pistole mitragliatrici (gruppo "mitra", id 40-62 del catalogo): modelli procedurali con parti mobili.
// Ogni costruttore rifà la sagoma e i dettagli che rendono riconoscibile un'arma (scritte con i nomi di fantasia del catalogo).
// Unità: mm. X avanti (verso la bocca), Y su, Z verso il lato destro. x = 0 retro della scatola di culatta, y = 0 asse della canna.
// Funzioni aggiunte dal gruppo (prefisso mi): tubo di lamiera con finestre e fori veri, pittore per tubi, filo/tubo piegato in 3D,
// caricatore a scatola con nervature, mire (alzo a L con orecchie, mirino con orecchie, mirino ad anello, diottra a tamburo).
window.FAM2 = window.FAM2 || {}; window.MAP2 = window.MAP2 || {};
(function () {
  'use strict';
  let K = null, C = null; const PI = Math.PI;
  // ogni costruttore riceve il kit al momento della chiamata (l'ordine di caricamento dei file non conta)
  const def = (nome, fn) => { FAM2[nome] = function (spec, o) { K = WK2; C = WC; return fn(spec || {}, o || {}); }; };

  // ================================================================ materiali e scritte
  function miMat(spec) {
    const f = String(spec.finitura || 'nera');
    const acc = f === 'parkerizzata' ? 'parker' : f === 'brunita' ? 'brunito' : 'nero';
    return {
      acc,
      st: K.mat(acc),                                                     // lamiera e acciaio della finitura
      nero: K.mat('nero'),
      bar: K.mat('brunito', null, { r: .36 }),                            // canna
      bolt: K.mat('grigio', null, { c: '#3d4045', r: .34, m: .85 }),      // otturatore (si vede dalla finestra)
      dk: K.mat('nero_lucido', null, { c: '#050505', r: .7 }),            // bocche, fori, interni
      pol: K.mat('polimero'),
      gom: K.mat('gomma'),
      anod: K.mat('anod'),
    };
  }
  function miTesti(spec) {
    const prod = String(spec.produttore || 'ARMI').toUpperCase(), nome = String(spec.nome || '').toUpperCase(), paese = String(spec.paese || '').toUpperCase();
    const cal = String(spec.calibro || '9×19 mm').replace(/\s*\(.*\)/, '').replace(/\s*mm.*/, '');
    const sigla = (prod.replace(/[^A-Z]/g, '').slice(0, 2) || 'XX');
    const num = String(10000 + (((spec.id || 0) * 7919 + (spec.anno || 0) * 31) % 89999));
    return { prod, nome, paese, cal: 'CAL. ' + cal, mat: sigla + ' ' + num, anno: String(spec.anno || '') };
  }

  // ================================================================ piccole geometrie
  const v3 = {
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    len: a => Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]), nrm: a => { const l = Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  };
  function geoOf(pos, uv, ang, edge) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv || new Array(pos.length / 3 * 2).fill(.03), 2));
    return K.crease(g, ang || 40, { edge: !!edge });
  }
  // cilindro lungo Z (perni, cerniere) fra z0 e z1 con centro (x, y)
  function rodZ(z0, z1, r, x, y, seg) { const g = K.rod(z0, z1, r, { seg: seg || 14 }); g.rotateY(-PI / 2); g.translate(x, y, 0); return g; }
  // cilindro verticale (asse Y) fra y0 e y1 con centro (x, z)
  function rodY(y0, y1, r, x, z, seg) { const g = K.rod(y0, y1, r, { seg: seg || 14 }); g.rotateZ(PI / 2); g.translate(x, 0, z); return g; }
  // anello o manicotto lungo X (raggio esterno ro, interno ri), chiuso alle due facce
  function anello(x0, x1, ro, ri, o) { o = o || {}; return K.latheX([[x0, ri], [x0, ro - .4], [x0 + .4, ro], [x1 - .4, ro], [x1, ro - .4], [x1, ri], [x0, ri]], { seg: o.seg || 24, cy: o.cy || 0, cz: o.cz || 0 }); }
  // pomello (stelo e testa) costruito lungo +X e orientato verso la direzione d (vettore unitario), con la base in p
  function pomello(p, d, o) {
    o = o || {}; const L = o.L || 12, rs = o.rs || 2.6, rh = o.rh || 5, hl = o.hl || 5;
    const g = K.latheX([[0, 0], [0, rs], [L - hl, rs], [L - hl + .8, rh], [L - .8, rh], [L, rh - 1.2], [L, 0]], { seg: o.seg || 16 });
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), new THREE.Vector3(d[0], d[1], d[2]).normalize());
    g.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(q)); g.translate(p[0], p[1], p[2]); return g;
  }

  // ================================================================ filo o tubo piegato lungo una spezzata 3D
  // pts = [[x, y, z, raggio_di_piega], ...]: calci a filo d'acciaio, telai tubolari, cinghie
  function miFilo(pts, r, o) {
    o = o || {}; const seg = o.seg || 10, P = [], { sub, add, mul, dot, cross, len, nrm } = v3;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i].slice(0, 3), rc = pts[i][3] || 0;
      if (!rc || i === 0 || i === pts.length - 1) { P.push(p); continue; }
      const a = pts[i - 1], b = pts[i + 1], u = sub(a, p), v = sub(b, p), lu = len(u), lv = len(v), un = mul(u, 1 / lu), vn = mul(v, 1 / lv);
      const th = Math.acos(Math.max(-1, Math.min(1, dot(un, vn))));
      if (th > PI - .01) { P.push(p); continue; }
      const d = Math.min(rc / Math.tan(th / 2), lu * .48, lv * .48), p1 = add(p, mul(un, d)), p2 = add(p, mul(vn, d)), n = Math.max(2, Math.ceil((PI - th) / .2));
      for (let k = 0; k <= n; k++) { const t = k / n, w0 = (1 - t) * (1 - t), w1 = 2 * t * (1 - t), w2 = t * t; P.push([p1[0] * w0 + p[0] * w1 + p2[0] * w2, p1[1] * w0 + p[1] * w1 + p2[1] * w2, p1[2] * w0 + p[2] * w1 + p2[2] * w2]); }
    }
    const N = P.length, Tg = [];
    for (let i = 0; i < N; i++) Tg.push(nrm(sub(P[Math.min(N - 1, i + 1)], P[Math.max(0, i - 1)])));
    let nn = nrm(Math.abs(Tg[0][1]) < .9 ? cross(Tg[0], [0, 1, 0]) : cross(Tg[0], [1, 0, 0]));
    const rings = [], acc = [0];
    for (let i = 0; i < N; i++) {
      const t = Tg[i]; nn = nrm(sub(nn, mul(t, dot(nn, t)))); const b = cross(t, nn), ring = [];
      for (let k = 0; k <= seg; k++) { const a = 2 * PI * k / seg; ring.push(add(P[i], add(mul(nn, Math.cos(a) * r), mul(b, Math.sin(a) * r)))); }
      rings.push(ring); if (i) acc.push(acc[i - 1] + len(sub(P[i], P[i - 1])));
    }
    const pos = [], uv = [], L = acc[N - 1] || 1;
    for (let i = 0; i < N - 1; i++) for (let k = 0; k < seg; k++) {
      const a = rings[i][k], b = rings[i + 1][k], c = rings[i + 1][k + 1], d = rings[i][k + 1], u0 = acc[i] / L, u1 = acc[i + 1] / L, w0 = .1 + .9 * k / seg, w1 = .1 + .9 * (k + 1) / seg;
      pos.push(...a, ...c, ...b, ...a, ...d, ...c); uv.push(u0, w0, u1, w1, u1, w0, u0, w0, u0, w1, u1, w1);
    }
    if (o.cap !== false) for (const e of [0, N - 1]) { const c = P[e]; for (let k = 0; k < seg; k++) { const a = rings[e][k], b = rings[e][k + 1]; if (e === 0) pos.push(...c, ...b, ...a); else pos.push(...c, ...a, ...b); uv.push(.02, .03, .03, .03, .03, .04); } }
    return geoOf(pos, uv, 60, false);
  }

  // ================================================================ tubo di lamiera con finestre e fori veri
  // Superficie cilindrica lungo X (asse in y = cy, z = cz), raggio r, spessore t, divisa in celle dalle rotture xs (lungo X) e as
  // (angoli in rad: 0 = sopra, PI/2 = lato destro, PI = sotto, 3PI/2 = lato sinistro; as da 0 a 2PI per il giro completo).
  // cella(i, j) -> null (lamiera piena) | 'via' (finestra: cella aperta, con le pareti dello spessore)
  //               | { r } foro tondo al centro della cella | { lx, la, rr } asola (mezze misure lungo X e attorno, mm)
  // UV come latheX: u = (x - x0) / (x1 - x0), v = .1 + .9 * angolo / 2PI (vale per miPittoreTubo). Dentro: superficie interna liscia.
  function miLamieraTubo(xs, as, r, t, cella, o) {
    o = o || {}; const cy = o.cy || 0, cz = o.cz || 0, X0 = xs[0], X1 = xs[xs.length - 1], maxDa = o.maxDa || .2, hn = o.hn || 10, ri = r - t;
    const full = Math.abs(as[as.length - 1] - as[0] - 2 * PI) < 1e-4;
    const pos = [], uv = [];
    const P3 = (x, a, rr) => [x, cy + Math.cos(a) * rr, cz + Math.sin(a) * rr];
    const UV = (x, a) => [(x - X0) / (X1 - X0), .1 + .9 * Math.max(0, Math.min(1, a / (2 * PI)))];
    const ni = xs.length - 1, nj = as.length - 1, typ = [], nx = [], na = [];
    for (let i = 0; i < ni; i++) { typ.push([]); for (let j = 0; j < nj; j++) typ[i].push(cella ? cella(i, j) : null); }
    const isHole = c => c && c !== 'via';
    for (let i = 0; i < ni; i++) { let h = false; for (let j = 0; j < nj; j++) if (isHole(typ[i][j])) h = true; nx.push(h ? 2 : 1); }
    for (let j = 0; j < nj; j++) { let h = false; for (let i = 0; i < ni; i++) if (isHole(typ[i][j])) h = true; na.push(Math.max(h ? 2 : 1, Math.ceil((as[j + 1] - as[j]) / maxDa))); }
    // triangolo sulla superficie esterna dai punti (x, a): orientato verso l'esterno
    function triOut(p, q, s) {
      const sa = (q[0] - p[0]) * (s[1] - p[1]) - (s[0] - p[0]) * (q[1] - p[1]);
      const list = sa > 0 ? [p, s, q] : [p, q, s]; // in (x, angolo) il verso antiorario guarda dentro
      for (const e of list) { pos.push(...P3(e[0], e[1], r)); uv.push(...UV(e[0], e[1])); }
    }
    // parete dello spessore fra (x, a) p e q, girata verso il punto c (x, a) che sta dalla parte aperta
    function wall(p, q, c) {
      const a = P3(p[0], p[1], r), b = P3(q[0], q[1], r), d = P3(p[0], p[1], ri), e = P3(q[0], q[1], ri), m = v3.mul(v3.add(a, b), .5), cc = P3(c[0], c[1], r);
      const n = v3.cross(v3.sub(b, a), v3.sub(d, a)), flip = v3.dot(n, v3.sub(cc, m)) < 0;
      const quad = flip ? [a, d, e, a, e, b] : [a, b, e, a, e, d], uvs = flip ? [p, p, q, p, q, q] : [p, q, q, p, q, p];
      for (let k = 0; k < 6; k++) { pos.push(...quad[k]); uv.push(...UV(uvs[k][0], uvs[k][1])); }
    }
    const edgePts = (x0, a0, x1, a1, n) => { const out = []; for (let k = 0; k <= n; k++) out.push([x0 + (x1 - x0) * k / n, a0 + (a1 - a0) * k / n]); return out; };
    for (let i = 0; i < ni; i++) for (let j = 0; j < nj; j++) {
      const c = typ[i][j], x0 = xs[i], x1 = xs[i + 1], a0 = as[j], a1 = as[j + 1];
      if (!c) { // lamiera piena: griglia di quadrilateri
        for (let p = 0; p < nx[i]; p++) for (let q = 0; q < na[j]; q++) {
          const xa = x0 + (x1 - x0) * p / nx[i], xb = x0 + (x1 - x0) * (p + 1) / nx[i], aa = a0 + (a1 - a0) * q / na[j], ab = a0 + (a1 - a0) * (q + 1) / na[j];
          triOut([xa, aa], [xb, aa], [xb, ab]); triOut([xa, aa], [xb, ab], [xa, ab]);
        }
      } else if (c === 'via') { // finestra: pareti verso le celle piene vicine
        const cen = [(x0 + x1) / 2, (a0 + a1) / 2];
        const nb = (ii, jj) => { if (jj < 0 || jj >= nj) { if (!full) return null; jj = (jj + nj) % nj; } if (ii < 0 || ii >= ni) return o.apertoAiCapi ? 'via' : null; return typ[ii][jj]; };
        const sides = [[nb(i, j - 1), edgePts(x0, a0, x1, a0, nx[i])], [nb(i, j + 1), edgePts(x0, a1, x1, a1, nx[i])], [nb(i - 1, j), edgePts(x0, a0, x0, a1, na[j])], [nb(i + 1, j), edgePts(x1, a0, x1, a1, na[j])]];
        for (const [n, pts] of sides) if (n !== 'via') for (let k = 0; k < pts.length - 1; k++) wall(pts[k], pts[k + 1], cen);
      } else { // foro tondo o asola dentro la cella
        const xc = (x0 + x1) / 2, ac = (a0 + a1) / 2, cont = [];
        for (const e of edgePts(x0, a0, x1, a0, nx[i]).slice(0, -1)) cont.push(e);
        for (const e of edgePts(x1, a0, x1, a1, na[j]).slice(0, -1)) cont.push(e);
        for (const e of edgePts(x1, a1, x0, a1, nx[i]).slice(0, -1)) cont.push(e);
        for (const e of edgePts(x0, a1, x0, a0, na[j]).slice(0, -1)) cont.push(e);
        const hole = [];
        if (c.r) for (let k = 0; k < hn; k++) { const a = 2 * PI * k / hn; hole.push([xc + Math.cos(a) * c.r, ac + Math.sin(a) * c.r / r]); }
        else { // asola: rettangolo con le testate tonde
          const lx = c.lx, la = c.la, rr = Math.min(c.rr === undefined ? Math.min(lx, la) : c.rr, lx, la), m = Math.max(2, Math.round(hn / 4));
          const corners = [[lx - rr, la - rr, 0], [-lx + rr, la - rr, PI / 2], [-lx + rr, -la + rr, PI], [lx - rr, -la + rr, 3 * PI / 2]];
          for (const [cx2, cy2, a0c] of corners) for (let k = 0; k <= m; k++) { const a = a0c + (PI / 2) * k / m; hole.push([xc + cx2 + Math.cos(a) * rr, ac + (cy2 + Math.sin(a) * rr) / r]); }
        }
        // triangolazione nel piano (x, mm attorno)
        const V2 = p => new THREE.Vector2(p[0], p[1] * r), tri = THREE.ShapeUtils.triangulateShape(cont.map(V2), [hole.map(V2)]), all = cont.concat(hole);
        for (const tr of tri) triOut(all[tr[0]], all[tr[1]], all[tr[2]]);
        for (let k = 0; k < hole.length; k++) wall(hole[k], hole[(k + 1) % hole.length], [xc, ac]);
      }
    }
    const geos = [geoOf(pos, uv, 40, true)];
    if (o.interno !== false) geos.push(K.latheX([[X1, ri], [X0, ri]], { seg: o.segI || 28, cy, cz })); // superficie interna (guarda dentro)
    if (o.cap0) geos.push(K.latheX([[X0, ri], [X0, r]], { seg: 32, cy, cz }));
    if (o.cap1) geos.push(K.latheX([[X1, r], [X1, ri]], { seg: 32, cy, cz }));
    return K.mergeG(geos);
  }
  // rotture degli angoli attorno al tubo: passo regolare piu' gli angoli dati (ordinati, senza doppioni)
  function giro(passo, extra) { const s = new Set(); for (let a = 0; a < 2 * PI - 1e-6; a += passo) s.add(+a.toFixed(5)); for (const e of extra || []) s.add(+e.toFixed(5)); s.add(+(2 * PI).toFixed(5)); return [...s].sort((a, b) => a - b); }
  const gradi = g => g * PI / 180;

  // ================================================================ pittore per i tubi (stesse UV di latheX e miLamieraTubo)
  // lati: 'R' (fianco destro, angolo PI/2) e 'L' (sinistro, 3PI/2); s = quota in mm sulla superficie misurata dal mezzo del fianco, verso l'alto
  function miPittoreTubo(x0, x1, r, o) {
    o = o || {}; const W = o.w || 1024, H = o.h || 512;
    const hc = K.canvasOf(W, H), ac = K.canvasOf(W, H), rc = K.canvasOf(W, H), hx = hc.getContext('2d'), ax = ac.getContext('2d'), rx = rc.getContext('2d');
    const g = v => { const k = Math.round(Math.max(0, Math.min(1, v)) * 255); return `rgb(${k},${k},${k})`; };
    hx.fillStyle = '#808080'; hx.fillRect(0, 0, W, H); ax.fillStyle = '#ffffff'; ax.fillRect(0, 0, W, H); rx.fillStyle = g(o.rough === undefined ? .5 : o.rough); rx.fillRect(0, 0, W, H);
    const ppx = W / (x1 - x0), ppa = .9 * H / (2 * PI * r);
    const cX = x => (x - x0) * ppx, cY = a => { a = ((a % (2 * PI)) + 2 * PI) % (2 * PI); return (1 - (.1 + .9 * a / (2 * PI))) * H; };
    const ang = (side, s) => side === 'R' ? PI / 2 - s / r : 3 * PI / 2 + s / r;
    const sides = s => (!s || s === 'LR') ? ['L', 'R'] : [s];
    const poly = (ctx, side, pts) => { ctx.beginPath(); pts.forEach((p, i) => { const X = cX(p[0]), Y = cY(ang(side, p[1])); if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); }); ctx.closePath(); };
    const layers = f => [[hx, f.h === undefined ? undefined : .5 + f.h * .5], [ax, f.a], [rx, f.r]];
    return {
      fill(side, path, f) { const pts = K.P2(path); for (const s of sides(side)) for (const [ctx, v] of layers(f)) { if (v === undefined) continue; ctx.fillStyle = g(v); poly(ctx, s, pts); ctx.fill(); } },
      line(side, path, wmm, f, closed) { const pts = K.P2(path); f = Object.assign({ h: -.6 }, f); for (const s of sides(side)) for (const [ctx, v] of layers(f)) { if (v === undefined) continue;
        ctx.strokeStyle = g(v); ctx.lineWidth = Math.max(1, wmm * ppx); ctx.lineJoin = 'round'; ctx.beginPath(); pts.forEach((p, i) => { const X = cX(p[0]), Y = cY(ang(s, p[1])); if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); }); if (closed) ctx.closePath(); ctx.stroke(); } },
      text(side, str, x, s, hmm, f) { f = Object.assign({ h: -.7, a: .55 }, f || {}); for (const sd of sides(side)) for (const [ctx, v] of layers(f)) { if (v === undefined) continue;
        ctx.save(); ctx.translate(cX(x), cY(ang(sd, s))); const k = hmm * ppa / 100; ctx.scale((sd === 'L' ? -1 : 1) * k * ppx / ppa, (sd === 'R' ? -1 : 1) * k);
        ctx.fillStyle = g(v); ctx.font = (f.weight || 'bold') + ' 100px Arial, Helvetica, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(str, 0, 0); ctx.restore(); } },
      pin(side, x, s, rr, f) { f = f || {}; const c = K.circ(x, s, rr, 20); this.fill(side, c, { h: f.h === undefined ? .4 : f.h, a: f.a }); this.line(side, c, .2, { h: -.5, a: .7 }, true); },
      // scanalature lungo X (s0..s1 sul fianco), passo lungo X
      grooves(side, xa, xb, s0, s1, p, f) { f = f || {}; for (let x = xa + p * .5; x < xb; x += p) this.fill(side, [[x - p * (f.wr || .45) * .5, s0], [x + p * (f.wr || .45) * .5, s0], [x + p * (f.wr || .45) * .5, s1], [x - p * (f.wr || .45) * .5, s1]], { h: f.h === undefined ? -.9 : f.h, a: f.a === undefined ? .62 : f.a }); },
      // zigrinatura a rombi su tutta la circonferenza fra xa e xb
      knurl(xa, xb, p, f) { f = f || {}; hx.save(); hx.beginPath(); hx.rect(cX(xa), 0, cX(xb) - cX(xa), H); hx.clip(); hx.strokeStyle = '#2a2a2a'; hx.lineWidth = Math.max(1, p * .35 * ppx);
        const D = H / (ppa * p); for (let t = -D; t < D * 2; t++) { hx.beginPath(); hx.moveTo(cX(xa) + t * p * ppx, 0); hx.lineTo(cX(xa) + t * p * ppx + H * ppx / ppa, H); hx.stroke(); hx.beginPath(); hx.moveTo(cX(xa) + t * p * ppx, H); hx.lineTo(cX(xa) + t * p * ppx + H * ppx / ppa, 0); hx.stroke(); } hx.restore(); },
      // variazione di colore e rugosità con la trama di rumore del kit (niente cicli per pixel)
      noise(f) { f = f || {}; const img = K.grunge().image; ax.save(); ax.globalAlpha = f.a === undefined ? .18 : f.a; ax.globalCompositeOperation = 'multiply'; ax.drawImage(img, 0, 0, W, H); ax.restore();
        rx.save(); rx.globalAlpha = f.r === undefined ? .25 : f.r; rx.globalCompositeOperation = 'overlay'; rx.drawImage(img, 0, 0, W / 2, H, 0, 0, W, H); rx.restore(); },
      done(k) { const nm = K.heightToNormal(hc, k || 2.2); return { map: K.texOf(ac, true), normalMap: K.texOf(nm, false), roughnessMap: K.texOf(rc, false) }; }
    };
  }

  // ================================================================ grilletto, caricatore, mire, canna
  // grilletto a lama curva (incavo per il dito davanti): perno (px, py) in alto; L = lunghezza della lama
  function miGrilletto(A, px, py, m, o) {
    o = o || {}; const s = (o.L || 20) / 19, hw = o.hw || 3;
    const P = [[-3.4, 4, 0], [2.6, 4, 0], [2.8, -2, 1.5], [.6, -9.5, 9], [1.9, -17.6, 1.2], [-.6, -19, 1], [-2.9, -10, 9], [-3.4, -2, 1]];
    A.add(K.slab(P.map(p => [px + p[0] * s, py + p[1] * s, p[2] * s]), -hw, hw, { b: .7 }), m, 'grilletto');
    A.pivot('grilletto', [px, py + 2, 0]);
  }
  // caricatore a scatola visto di lato (piano XY): linea centrale da top verso il basso, ang = inclinazione (positiva = fondo in avanti),
  // curva = raggio (0 = dritto, positivo = curvo in avanti), d0/d1 = profondità in alto e in fondo, w = mezza larghezza.
  // o.tex: pittore con nervature, fori di controllo e scritte; o.piede = sporgenza del fondello. Parte 'caricatore'.
  function miCaricatore(A, o) {
    const n = 14, cl = [], L = o.L, d0 = o.d0, d1 = o.d1 === undefined ? o.d0 : o.d1, kk = o.curva ? (L / o.curva) / n : 0;
    let p = o.top.slice(), dir = -PI / 2 + (o.ang || 0);
    for (let i = 0; i <= n; i++) { const t = i / n; cl.push({ p: p.slice(), dir, d: d0 + (d1 - d0) * t }); if (i < n) { p = [p[0] + Math.cos(dir + kk / 2) * L / n, p[1] + Math.sin(dir + kk / 2) * L / n]; dir += kk; } }
    const off = (c, k) => [c.p[0] - Math.sin(c.dir) * k, c.p[1] + Math.cos(c.dir) * k];
    const fr = cl.map(c => off(c, c.d / 2)), bk = cl.map(c => off(c, -c.d / 2));
    const rb = o.rb === undefined ? 2.5 : o.rb; fr[n] = fr[n].concat([rb]); bk[n] = bk[n].concat([rb]);
    const prof = fr.concat(bk.slice().reverse());
    const bb0 = K.bbox2(prof), bb = [bb0[0] - 2, bb0[1] - 2, bb0[2] + 2, bb0[3] + 2];
    let m = o.mat || K.mat('nero', null, { r: .5 });
    if (o.tex) {
      const pM = K.painter(bb, { w: o.tw || 256, h: o.th || 512, rough: o.rough === undefined ? .5 : o.rough });
      const along = k => cl.slice(1).map(c => off(c, k));
      for (const k of (o.nerv || [-.22, .22])) pM.line('LR', along(k * (d0 + d1) / 2), o.nervW || 2.6, { h: o.nervH === undefined ? .55 : o.nervH, a: 1.04 });
      if (o.fori) { const st = Math.max(1, Math.floor(n / (o.fori + 1))); for (let i = 1; i <= o.fori; i++) { const c = cl[Math.min(n - 1, 1 + i * st)], q = off(c, -c.d * .28); pM.pin('L', q[0], q[1], 1.5, { h: -1, a: .15 }); pM.text('L', String(i * (o.foriPasso || 5)), q[0] + 5.5, q[1], 2.2, { h: -.4, a: .7 }); } }
      if (o.scritta) { const c = cl[Math.round(n * .55)]; pM.text('R', o.scritta, c.p[0], c.p[1], 2.4, { h: -.5, a: .7 }); }
      pM.noise({ a: .1, r: .14, seed: o.seed || 4 }); pM.walls({ r: .5 });
      m = K.mat(o.kind || 'nero', pM.done(2.2), { ns: .8 });
    }
    const post = o.xf || (g => g), part = o.part || 'caricatore';
    A.add(post(K.slab(prof, -o.w, o.w, { b: o.b === undefined ? 1 : o.b, uv: bb })), m, part);
    // fondello
    const ce = cl[n], pf = o.piede === undefined ? 2.2 : o.piede, d = ce.d / 2 + pf;
    if (pf >= 0) A.add(post(K.xf(K.slab([[-d, -(o.hp || 5), 2], [d + (o.lab || 0), -(o.hp || 5), 2], [d + (o.lab || 0), 1, 0], [-d, 1, 0]], -o.w - pf * .6, o.w + pf * .6, { b: 1.1 }), { r: [0, 0, ce.dir + PI / 2], t: ce.p })), o.matPiede || m, part);
    if (o.pivot !== false) A.pivot(part, Array.isArray(o.pivot) ? o.pivot : [o.top[0], o.top[1], 0]);
    return { cl, prof, end: ce };
  }
  // tacca di mira a foglia ribaltabile con due orecchie di protezione (x = centro, y = quota della base)
  function miAlzoL(A, m, x, y, o) {
    o = o || {}; const hw = o.hw || 7.5, h = o.h || 11, L = o.L || 18, t = o.t || 2.2;
    A.add(K.slab([[x - L / 2, y - 3, 1], [x + L / 2, y - 3, 1], [x + L / 2, y + 2, 1], [x - L / 2, y + 2, 1]], -hw, hw, { b: .8 }), m);
    for (const s of [-1, 1]) A.add(K.slab([[x - L / 2 + 1, y + 1], [x + L / 2 - 1, y + 1], [x + L / 2 - 2.5, y + h, 2.5], [x - L / 2 + 2.5, y + h, 2.5]], s > 0 ? hw - t : -hw, s > 0 ? hw : -hw + t, { b: .6 }), m);
    A.add(K.slabX([[-3.6, y + 1], [3.6, y + 1], [3.6, y + h - 2, 1.2], [-3.6, y + h - 2, 1.2]], x - 1, x + 1, { b: .35, holes: [K.circ(0, y + h - 5.4, 1.2, 12)] }), m);
    A.add(rodZ(-hw + .3, hw - .3, 1.1, x - 3, y + 3.2, 10), m);
  }
  // mirino a lama con orecchie di protezione (x = centro, y = quota della base)
  function miMirinoOrecchie(A, m, x, y, o) {
    o = o || {}; const hw = o.hw || 6.5, h = o.h || 11, L = o.L || 12, t = o.t || 2;
    A.add(K.slab([[x - L / 2 - 2, y - 3], [x + L / 2 + 2, y - 3], [x + L / 2, y + 2, 1], [x - L / 2, y + 2, 1]], -hw, hw, { b: .8 }), m);
    for (const s of [-1, 1]) A.add(K.slab([[x - L / 2, y + 1], [x + L / 2, y + 1], [x + L / 2 - 1.5, y + h, 2.5], [x - L / 2 + 1.5, y + h, 2.5]], s > 0 ? hw - t : -hw, s > 0 ? hw : -hw + t, { b: .6 }), m);
    A.add(K.slab([[x - 2, y + 1], [x + 2.5, y + 1], [x + 1.2, y + h - 1.5, .6], [x - .8, y + h - 1.5, .6]], -1.1, 1.1, { b: .3 }), m);
  }
  // mirino a palo protetto da un anello (tubo corto lungo X); y = quota della base
  function miMirinoAnello(A, m, x, y, o) {
    o = o || {}; const R = o.R || 8, L = o.L || 9, yc = y + (o.alto || R + 3);
    A.add(K.slab([[x - L / 2 - 3, y - 4], [x + L / 2 + 3, y - 4], [x + L / 2 + 1, y + 3, 2], [x - L / 2 - 1, y + 3, 2]], -(o.hw || 6), o.hw || 6, { b: .8 }), m);
    A.add(K.slab([[x - L / 2, y + 2], [x + L / 2, y + 2], [x + L / 2, yc - R + 1], [x - L / 2, yc - R + 1]], -2.6, 2.6, { b: .5 }), m);
    A.add(anello(x - L / 2, x + L / 2, R, R - 1.7, { cy: yc, seg: 28 }), m);
    A.add(K.slab([[x - 1.2, yc - R], [x + 1.2, yc - R], [x + .6, yc + 1.5, .3], [x - .6, yc + 1.5, .3]], -.9, .9, { b: .25 }), m);
  }
  // diottra a tamburo (asse verticale, zigrinata) sulla sua staffa; y = quota della base
  function miTamburo(A, m, x, y, o) {
    o = o || {}; const R = o.R || 8, h = o.h || 10, yb = y + 5;
    A.add(K.slab([[x - 14, y - 3, 1], [x + 12, y - 3, 1], [x + 9, y + 6, 2], [x - 12, y + 6, 2]], -9, 9, { b: .9 }), m);
    for (const s of [-1, 1]) A.add(K.slab([[x - 9, y + 5], [x + 6, y + 5], [x + 5, yb + h + 3, 3], [x - 8, yb + h + 3, 3]], s > 0 ? R + .4 : -R - 2.6, s > 0 ? R + 2.6 : -R - .4, { b: .5 }), m);
    const mk = K.mat('nero', null, { tile: 'knurl', rep: [1, 10], r: .55 });
    const g = K.latheX([[0, 0], [0, R - .6], [.6, R], [h - .6, R], [h, R - .6], [h, 0]], { seg: 22 }); g.rotateZ(PI / 2); g.translate(x - 1, yb, 0); A.add(g, mk);
    A.add(K.slabX([[-2.2, yb + h * .3], [2.2, yb + h * .3], [2.2, yb + h * .78, 1], [-2.2, yb + h * .78, 1]], x - 1 - R - .2, x - 1 - R + 1, { b: .2 }), K.mat('nero_lucido', null, { c: '#050505', r: .6 }));
    A.add(rodZ(-R - 3, R + 3, 1.6, x - 1, yb + h * .5, 12), m);
  }
  // profilo di un'impugnatura inclinata nel piano XY. o = {x, y: centro in alto; h: lunghezza lungo l'asse; ang: inclinazione (positiva = fondo indietro);
  //   d0, d1: profondità avanti-dietro in alto e in fondo; bf, bb: pancia davanti e dietro; dita, dp: numero e profondità degli incavi per le dita;
  //   coda: sporgenza in alto dietro; alto: prolungamento sopra y (entra nel fusto); rf, rb: raggi degli spigoli in fondo}
  function profImpugnatura(o) {
    const s = Math.sin(o.ang || 0), c = Math.cos(o.ang || 0), ax = [-s, -c], nf = [c, -s], n = 20, F = [], B = [];
    const at = (t, k) => [o.x + ax[0] * t * o.h + nf[0] * k, o.y + ax[1] * t * o.h + nf[1] * k];
    for (let i = 0; i <= n; i++) {
      const t = i / n, d = (o.d0 + ((o.d1 === undefined ? o.d0 : o.d1) - o.d0) * t) / 2;
      let kf = d + (o.bf || 0) * Math.sin(PI * t), kb = d + (o.bb || 0) * Math.sin(PI * Math.min(1, t * 1.1));
      if (o.dita) { const u = (t - .1) / .8; if (u > 0 && u < 1) kf -= (o.dp || 2.4) * Math.pow(Math.sin(PI * u * o.dita) ** 2, .6); }
      F.push(at(t, kf)); B.push(at(t, -kb));
    }
    const up = o.alto === undefined ? 3 : o.alto, P = [];
    P.push([B[0][0] - (o.coda || 0), o.y + up, 0]); P.push([F[0][0], o.y + up, 0]);
    for (let i = 1; i <= n; i++) P.push(i === n ? [F[i][0], F[i][1], o.rf === undefined ? 6 : o.rf] : [F[i][0], F[i][1], 0]);
    for (let i = n; i >= 1; i--) P.push(i === n ? [B[i][0], B[i][1], o.rb === undefined ? 6 : o.rb] : [B[i][0], B[i][1], 0]);
    if (o.coda) P.push([B[0][0] - o.coda, o.y - 2, Math.min(4, o.coda)]);
    return P;
  }
  // impugnatura tonda (loftS lungo l'asse inclinato): stessi parametri di profImpugnatura più w0, w1 (mezze larghezze in alto e in fondo),
  // wb (pancia laterale), nf, nr (esponenti della sezione davanti e dietro). Restituisce la geometria e i punti del bordo davanti (F) e dietro (B).
  function miImpugnaturaTonda(o) {
    const s = Math.sin(o.ang || 0), c = Math.cos(o.ang || 0), ax = [-s, -c], nv = [c, -s], n = o.n || 16, st = [], d1 = o.d1 === undefined ? o.d0 : o.d1;
    const pos = t => [o.x + ax[0] * t * o.h, o.y + ax[1] * t * o.h];
    const kf = t => { let k = (o.d0 + (d1 - o.d0) * t) / 2 + (o.bf || 0) * Math.sin(PI * Math.max(0, Math.min(1, t))); if (o.dita) { const u = (t - .1) / .8; if (u > 0 && u < 1) k -= (o.dp || 2.4) * Math.pow(Math.sin(PI * u * o.dita) ** 2, .6); } return k; };
    const kb = t => (o.d0 + (d1 - o.d0) * t) / 2 + (o.bb || 0) * Math.sin(PI * Math.max(0, Math.min(1, t * 1.1)));
    const kw = t => (o.w0 + ((o.w1 === undefined ? o.w0 : o.w1) - o.w0) * t) + (o.wb || 0) * Math.sin(PI * Math.max(0, Math.min(1, t)));
    const nf = o.nf || 2.6, nr = o.nr || 2.4, up = (o.alto === undefined ? 6 : o.alto) / o.h;
    st.push({ p: pos(-up), f: kf(0), r: kb(0), w: kw(0), nf, nr });
    for (let i = 0; i <= n; i++) { const t = i / n; st.push({ p: pos(t), f: kf(t), r: kb(t), w: kw(t), nf, nr }); }
    for (const [dt, k] of [[1.8, .86], [3.2, .6]]) st.push({ p: pos(1 + dt / o.h), f: kf(1) * k, r: kb(1) * k, w: kw(1) * (k * .45 + .55), nf, nr });
    const g = K.loftS(st, { K: o.K || 24, sub: 2 });
    return { g, F: t => { const p = pos(t), k = kf(t); return [p[0] + nv[0] * k, p[1] + nv[1] * k]; }, B: t => { const p = pos(t), k = kb(t); return [p[0] - nv[0] * k, p[1] - nv[1] * k]; } };
  }
  // materiale a trama ripetuta (per superfici curve), con la trama ruotata di 90 gradi se gira = true (es. righe attraverso un'impugnatura)
  function matTrama(tipo, tile, rep, o) {
    o = o || {}; const m = K.mat(tipo, null, Object.assign({ tile, rep }, o.opz || {}));
    if (o.gira) for (const t of [m.normalMap, m.roughnessMap]) if (t) { t.rotation = PI / 2; t.center.set(.5, .5); }
    return m;
  }
  // mire abbattibili alzate su una slitta (y = quota del piano superiore della slitta): diottra dietro (xr), mirino con orecchie davanti (xf)
  function miMireSlitta(A, m, xr, xf, y) {
    A.add(K.box(xr - 10, y - 1.5, -10.6, xr + 10, y + 4, 10.6, 1), m);
    A.add(K.slabX([[-9, y + 3], [9, y + 3], [9, y + 15, 2], [5, y + 19, 2], [-5, y + 19, 2], [-9, y + 15, 2]], xr - 2, xr + 2, { b: .6, holes: [K.circ(0, y + 13, 1.8, 14)] }), m);
    A.add(K.box(xf - 9, y - 1.5, -10.6, xf + 9, y + 4, 10.6, 1), m);
    A.add(K.slabX([[-9, y + 3], [9, y + 3], [9, y + 18, 2], [6, y + 19.5, 1.5], [6, y + 8, 1.5], [-6, y + 8, 1.5], [-6, y + 19.5, 1.5], [-9, y + 18, 2]], xf - 2.5, xf + 2.5, { b: .6 }), m);
    A.add(K.slab([[xf - 1.2, y + 7], [xf + 1.2, y + 7], [xf + .7, y + 17, .3], [xf - .7, y + 17, .3]], -1, 1, { b: .3 }), m);
  }
  // manetta di armamento a T in fondo alla scatola (non segue l'otturatore): x = retro della scatola, y = quota
  function miManettaT(A, m, x, y) {
    A.add(K.box(x - 16, y - 3, -4, x + 6, y + 3, 4, .8), m, 'manetta');
    A.add(K.slab([[x - 24, y - 4, 2], [x - 14, y - 4, 2], [x - 14, y + 4, 2], [x - 24, y + 4, 2]], -15, 15, { b: 1.5 }), m, 'manetta');
    A.add(K.box(x - 22, y - 3, -19, x - 16, y + 3, -14, .6), m, 'manetta');
    A.pivot('manetta', [x, y, 0]);
  }
  // calcio scheletrato pieghevole (aperto): telaio con un grande foro, cerniera davanti, calciolo in gomma dietro
  function miCalcioScheletro(A, m, o) {
    const xa = o.xa, xb = o.xb, yt = o.yt, yb = o.yb, yt2 = o.yt2, yb2 = o.yb2, hw = o.hw || 10, d = o.bordo || 9;
    const out = [[xa, yt, 2], [xb + 12, yt2, 5], [xb, yt2, 3], [xb, yb2, 4], [xb + 16, yb2, 6], [xa, yb, 3]];
    const hole = [[xa - 18, yt - d, 4], [xb + 12 + d, yt2 - d, 6], [xb + 12 + d, yb2 + d + 6, 8], [xa - 26, yb + d * .5, 6]];
    A.add(K.slab(out, -hw, hw, { b: 2.5, holes: [hole] }), m);
    A.add(K.slab([[xb - 11, yb2 - 2, 3], [xb + 1, yb2 - 2, 1], [xb + 1, yt2 + 2, 1], [xb - 11, yt2 + 2, 3]], -hw - 3, hw + 3, { b: 3.5 }), o.matPad || K.mat('gomma'));
    A.add(K.slab([[xa - 2, yt + 2, 2], [xa + 10, yt + 2, 2], [xa + 10, yb - 2, 2], [xa - 2, yb - 2, 2]], -hw - 2, hw + 2, { b: 1.5 }), m);
    if (o.guancia) A.add(K.slab([[xb + 14, yt2, 3], [xb + 110, yt2 - 4, 6], [xb + 110, yt2 + 9, 4], [xb + 14, yt2 + 12, 4]], -hw - 1, hw + 1, { b: 3 }), m);
  }
  // canna con bocca scura (tubo cavo) e disco interno della rigatura
  function miCanna(A, m, x0, x1, r, ri, o) { o = o || {}; A.add(K.tube(x0, x1, r, ri, { seg: o.seg || 22, cy: o.cy || 0 }), m, o.part); A.add(K.discX(x1 - 5, o.cy || 0, 0, ri + .05, 1, 16), K.mat('nero_lucido', null, { c: '#040404', r: .8 }), o.part); }

  // ================================================================ 40: tubo con impugnatura anteriore (scatola tubolare, calcio laterale a tubo)
  def('mitra_tubo_impugnatura_anteriore', function (spec, o) {
    const A = K.asm('mitra_tubo_impugnatura_anteriore'), M = miMat(spec), S = miTesti(spec);
    const R = 21, T = 1.6, XR = 332;
    // ---- scatola di culatta tubolare: finestra di espulsione a destra, feritoia della manetta a sinistra
    const xs = [0, 60, 120, 176, 214, 236, 318, XR];
    const aP0 = gradi(36), aP1 = gradi(104), aS0 = gradi(281), aS1 = gradi(291);
    const as = giro(gradi(15), [aP0, aP1, aS0, aS1]);
    const pT = miPittoreTubo(0, XR, R, { rough: .48 });
    pT.text('L', S.prod + '  ·  ' + S.nome, 118, -2.5, 4.3);
    pT.text('L', S.cal + '  ·  ' + S.paese, 118, -9.5, 3.1, { weight: 'normal' });
    pT.text('R', S.mat, 92, -8, 3.1);
    for (const sd of ['L', 'R']) pT.line(sd, [[6, 12.5], [XR - 6, 12.5]], .5, { h: -.35, a: .82 });     // saldatura dei due gusci
    pT.line('L', [[210, 4], [322, 4]], .3, { h: .3, a: 1.08 }); pT.line('L', [[210, 15.5], [322, 15.5]], .3, { h: .3, a: 1.08 });
    pT.noise();
    const mRcv = K.mat(M.acc, pT.done(2.2), { ns: .8 });
    A.add(miLamieraTubo(xs, as, R, T, (i, j) => {
      const a = (as[j] + as[j + 1]) / 2;
      if ((i === 3 || i === 4) && a > aP0 && a < aP1) return 'via';
      if ((i === 4 || i === 5) && a > aS0 && a < aS1) return 'via';
      return null;
    }), mRcv);
    // tappo posteriore con la cerniera del calcio, tappo anteriore, ghiera zigrinata della canna, canna
    A.add(K.latheX([[-7, 0], [-7, 17], [-6, 19.6], [-3, 21.8], [3, 21.8], [3.6, 21]], { seg: 32 }), M.st);
    A.add(K.latheX([[XR - 2, 21], [XR - 1.4, 21.7], [XR + 5, 21.7], [XR + 6, 20.4], [XR + 6, 16.5]], { seg: 32 }), M.st);
    A.add(K.latheX([[XR + 6, 0], [XR + 6, 15.8], [XR + 7, 16.6], [XR + 19, 16.6], [XR + 20, 15.6], [XR + 20, 9]], { seg: 28 }), K.mat(M.acc, null, { tile: 'knurl', rep: [2, 26], r: .55 }));
    miCanna(A, M.bar, XR + 19, 420, 8.2, 4.5);
    // mire: mirino con orecchie sul davanti, alzo a L con orecchie dietro
    miMirinoOrecchie(A, M.st, 322, R - 1.5, { h: 12, hw: 7 });
    miAlzoL(A, M.st, 22, R - 1.5, { h: 11, hw: 8 });
    // ---- fusto stampato sotto il tubo: ponticello, pozzetto del caricatore
    const bbF = [40, -72, 310, -8];
    const pF = K.painter(bbF, { w: 1024, h: 512, rough: .5 });
    pF.text('L', 'S', 98, -21, 3.2); pF.text('L', '1', 108, -21, 3.2); pF.text('L', 'A', 118, -21, 3.2);
    pF.pin('LR', 76, -20, 2, {}); pF.pin('LR', 172, -20, 2, {}); pF.pin('LR', 228, -38, 1.8, {}); pF.pin('LR', 280, -20, 2, {});
    pF.line('LR', [[190, -31], [190, -66]], .4, { h: -.5, a: .8 }); pF.line('LR', [[236, -31], [236, -66]], .4, { h: -.5, a: .8 });
    pF.text('R', S.mat, 212, -50, 2.4, { weight: 'normal' });
    pF.noise({ a: .12, r: .18, seed: 6 }); pF.walls({ r: .5 });
    const mFr = K.mat(M.acc, pF.done(2.3), { ns: .8 });
    A.add(K.slab([[60, -11], [306, -11], [306, -23, 3], [301, -31, 4], [64, -31, 4], [58, -22, 4]], -11.5, 11.5, { b: 1.6, uv: bbF }), mFr);
    A.add(K.slab([[188, -27], [238, -27], [238, -64, 2], [236, -68, 1.5], [190, -68, 1.5], [188, -64, 2]], -14.5, 14.5, { b: 1.5, uv: bbF }), mFr);
    A.add(K.slab([[116, -28], [192, -28], [192, -38, 4], [181, -60, 9], [128, -60, 9], [116, -50, 6]], -5.4, 5.4, { b: .9, uv: bbF, holes: [[[126, -32, 2], [183, -32, 2], [181, -41, 4], [173, -54.5, 6], [134, -54.5, 6], [126, -47, 4]]] }), mFr);
    A.add(K.slab([[238, -60, 1.2], [244, -60, 1.2], [244, -66, 1.2], [238, -66, 1.2]], -5, 5, { b: .6 }), M.st);   // pulsante di sgancio del caricatore
    A.add(K.slab([[96, -20, 1], [104, -20, 1], [104, -26, 1], [96, -26, 1]], -13.5, 13.5, { b: .8 }), M.nero);   // selettore a pulsante passante
    miGrilletto(A, 150, -30, M.st, { L: 21, hw: 3.2 });
    // ---- impugnature in polimero zigrinato (a pistola e anteriore), sicura dorsale
    const mG = matTrama('polimero', 'checker', [5, 9], { opz: { ns: .55 } });
    const gr = miImpugnaturaTonda({ x: 94, y: -29, h: 104, ang: gradi(13), d0: 42, d1: 37, bf: 2.5, bb: 3, w0: 13, w1: 14.5, wb: 1 });
    const fgr = miImpugnaturaTonda({ x: 273, y: -29, h: 92, ang: gradi(-7), d0: 38, d1: 35, bf: 1.5, bb: 1.5, dita: 3, dp: 1.8, w0: 12, w1: 13.5, wb: .8 });
    A.add(gr.g, mG); A.add(fgr.g, mG);
    const b0 = gr.B(.04), b1 = gr.B(.4);   // sicura dorsale sul dorso dell'impugnatura
    A.add(K.slab([[b0[0] + 4, b0[1] + 3, 1], [b0[0] - 2.6, b0[1] + 3, 1], [b1[0] - 2.6, b1[1], 2.5], [b1[0] + 4, b1[1], 2]], -6, 6, { b: .8 }), M.st);
    // ---- caricatore dritto da 32 colpi
    miCaricatore(A, { top: [213, -30], L: 188, d0: 33, w: 11, tex: true, fori: 4, foriPasso: 8, scritta: S.cal, mat: M.st, kind: M.acc });
    // ---- otturatore (visibile dalla finestra) e manetta di armamento a sinistra (non segue l'otturatore)
    A.add(K.latheX([[120, 0], [120, R - T - .4], [300, R - T - .4], [300, 0]], { seg: 28 }), M.bolt, 'otturatore');
    A.add(K.box(170, 2, R - T - 3.5, 230, 8, R - T - .6, .5), M.dk, 'otturatore');      // incavo dell'estrattore
    A.pivot('otturatore', [200, 0, 0]);
    const aM = gradi(286), dM = [0, Math.cos(aM), Math.sin(aM)];
    A.add(pomello([314, dM[1] * (R - 1), dM[2] * (R - 1)], dM, { L: 13, rs: 2.8, rh: 5.4, hl: 6 }), M.st, 'manetta');
    A.pivot('manetta', [314, dM[1] * R, dM[2] * R]);
    // ---- calcio laterale a tubo d'acciaio (aperto) con calciolo
    A.add(K.slab([[-14, -22, 3], [2, -22, 3], [2, 14, 3], [-14, 14, 3]], -12, 12, { b: 2 }), M.st);
    A.add(rodY(-26, 18, 4.2, -8, 13.5, 14), M.st);
    A.add(miFilo([[-12, 9, 6], [-40, 8, 0, 20], [-196, 3, 0, 16], [-200, -92, 0, 16], [-12, -17, 6]], 6.2, { seg: 12 }), M.st);
    A.add(K.slabX([[-19, -106, 6], [19, -106, 6], [19, 12, 7], [-19, 12, 7]], -214, -204, { b: 2 }), M.st);
    A.add(K.slabX([[-16, -100, 5], [16, -100, 5], [16, 6, 5], [-16, 6, 5]], -216, -213, { b: 1 }), M.gom);
    C.put(A, C.swivel(296, 0, -22.5, { rot: PI / 2, r: 7 }));
    // ---- punti di riferimento
    A.anchor('bocca', [420.5, 0, 0]); A.anchor('espulsione', [206, 14, 16], [0, .5, 1]); A.anchor('impugnatura', [88, -72, 0]); A.anchor('grilletto', [151, -44, 0]);
    A.anchor('appoggio', [278, -70, -4]); A.anchor('mira_post', [22, R + 8, 0]); A.anchor('mira_ant', [322.5, R + 9, 0]); A.anchor('calcio', [-215, -45, 0]);
    const r = A.done();
    r.info = { azione: 'auto', bossolo: 'pistola', ciclo: { otturatore: { dx: -.075 }, grilletto: { rz: -.14 } }, ricarica: { caricatore: { dy: -.16 } }, armamento: { manetta: { dx: -.09 } } };
    return r;
  });
  MAP2[40] = { f: 'mitra_tubo_impugnatura_anteriore', o: {} };

  // ================================================================ 41: scatola stampata, caricatore nell'impugnatura, manetta in alto, calcio metallico pieghevole
  def('mitra_scatola_caricatore_impugnatura', function (spec, o) {
    const A = K.asm('mitra_scatola_caricatore_impugnatura'), M = miMat(spec), S = miTesti(spec);
    const XR = 405, hw = 21;
    // ---- scatola di culatta in lamiera con tre nervature per lato; finestra di espulsione a destra
    const bbR = [-4, -30, 410, 18];
    const pR = K.painter(bbR, { w: 1024, h: 512, rough: .5 });
    for (const y of [6, -5]) { pR.line('L', [[16, y], [390, y]], 3.4, { h: .6, a: 1.06 }); pR.line('R', [[16, y], [194, y]], 3.4, { h: .6, a: 1.06 }); pR.line('R', [[268, y], [390, y]], 3.4, { h: .6, a: 1.06 }); }
    pR.line('LR', [[16, -16], [390, -16]], 3.4, { h: .6, a: 1.06 });
    pR.text('L', S.prod + '  ·  ' + S.nome, 96, -10.5, 3.6); pR.text('L', S.cal, 300, -10.5, 3.2);
    pR.text('R', S.mat, 100, -10.5, 3.2); pR.text('R', S.paese, 330, -10.5, 3);
    pR.text('L', 'S', 166, -22.5, 3); pR.text('L', 'R', 177, -22.5, 3); pR.text('L', 'A', 188, -22.5, 3);
    for (const x of [10, 396]) pR.pin('LR', x, 10, 1.8, {});
    pR.line('R', [[197, -12], [265, -12], [265, 13], [197, 13]], .45, { h: -.4, a: .8 }, true);
    pR.noise({ a: .12, r: .18, seed: 5 }); pR.walls({ r: .5 });
    const mR = K.mat(M.acc, pR.done(2.4), { ns: .85 });
    const prof = [[0, -27, 1.5], [XR, -27, 1.5], [XR, 14, 0], [0, 14, 0]];
    A.add(K.slab(prof, -hw, 0, { bL: 1.6, bR: 0, uv: bbR }), mR);
    A.add(K.slab(prof, 0, hw, { bL: 0, bR: 1.6, uv: bbR, holes: [[[200, -9, 2.5], [262, -9, 2.5], [262, 10, 2.5], [200, 10, 2.5]]] }), mR);
    // coperchio superiore bombato, con la feritoia della manetta
    const cov = [[-22, 12, 0], [22, 12, 0], [22, 19, 3], [15, 26, 5], [-15, 26, 5], [-22, 19, 3]];
    A.add(K.slabX(cov, -1, 238, { b: .8 }), M.st); A.add(K.slabX(cov, 390, 406, { b: .8 }), M.st);
    A.add(K.slabX([[-22, 12, 0], [-3.2, 12, 0], [-3.2, 26, .5], [-15, 26, 5], [-22, 19, 3]], 238, 390, { b: .6 }), M.st);
    A.add(K.slabX([[3.2, 12, 0], [22, 12, 0], [22, 19, 3], [15, 26, 5], [3.2, 26, .5]], 238, 390, { b: .6 }), M.st);
    // manetta in alto (a due lobi, con l'incavo per la mira), non segue l'otturatore
    A.add(K.box(377, 16, -3, 389, 28, 3, .5), M.st, 'manetta');
    for (const s of [-1, 1]) A.add(K.slab([[372, 26, 1.5], [392, 26, 1.5], [390, 34, 3.5], [374, 34, 3.5]], s > 0 ? 1.6 : -9.5, s > 0 ? 9.5 : -1.6, { b: 1.4 }), M.st, 'manetta');
    A.pivot('manetta', [383, 26, 0]);
    // mire con orecchie di protezione
    miAlzoL(A, M.st, 20, 25.5, { h: 13, hw: 9, L: 22 });
    miMirinoOrecchie(A, M.st, 394, 25.5, { h: 13, hw: 8.5, L: 16 });
    // ghiera zigrinata della canna e canna
    A.add(K.latheX([[XR - 1, 0], [XR - 1, 17.4], [XR, 18.4], [XR + 13, 18.4], [XR + 14, 17.2], [XR + 14, 9.5]], { seg: 32 }), K.mat(M.acc, null, { tile: 'knurl', rep: [2, 28], r: .55 }));
    miCanna(A, M.bar, XR + 13, 470, 9.2, 4.6);
    // ---- impugnatura con guancette rigate (contiene il caricatore), sicura dorsale, ponticello, guardamano
    const bbG = [130, -164, 396, -22];
    const pG = K.painter(bbG, { w: 512, h: 512, rough: .72 });
    for (let y = -40; y > -150; y -= 4.4) pG.line('LR', [[136, y], [216, y + 2]], 1.7, { h: -.75, a: .84 });
    for (const y of [-32, -36.5, -41]) pG.line('LR', [[306, y], [382, y]], 1.5, { h: -.6, a: .85 });
    pG.text('L', S.prod.split(' ')[0], 170, -156, 2.4, { h: -.4, a: .85 });
    pG.wallFill({ r: .8 }); pG.noise({ a: .06, r: .1, seed: 11 });
    const mG = K.mat('polimero', pG.done(2.2), { ns: .8 });
    const go = { x: 186, y: -27, h: 126, ang: gradi(8), d0: 47, d1: 43, bf: 1.5, bb: 2.5, rf: 6, rb: 7 };
    A.add(K.slab(profImpugnatura(Object.assign({}, go, { d0: 51, d1: 47 })), -12.5, 12.5, { b: 1.4 }), M.st);
    A.add(K.slab(profImpugnatura(go), -16, 16, { b: 5, bs: 4, uv: bbG }), mG);
    A.add(K.slab([[162, -32, 1], [157, -32, 1], [149.5, -98, 2], [153.5, -98, 2]], -7, 7, { b: .7 }), M.st);   // sicura dorsale
    A.add(K.box(150, -146, -17.5, 158, -138, -15, .8), M.st);                                                  // sgancio del caricatore
    A.add(K.slab([[204, -26], [294, -26], [294, -34, 3], [284, -74, 12], [222, -78, 12], [205, -64, 8]], -5.5, 5.5, { b: 1, holes: [[[215, -31, 2], [284, -31, 2], [280, -40, 3], [274, -68, 9], [226, -71, 9], [215, -58, 6]]] }), M.st);
    miGrilletto(A, 234, -28, M.st, { L: 22 });
    A.add(K.slab([[296, -26], [392, -26], [392, -36, 6], [384, -46, 8], [304, -46, 8], [296, -36, 6]], -19.5, 19.5, { b: 4.5, uv: bbG }), mG);
    A.add(K.slab([[170, -18, 2], [184, -18, 2], [182, -26, 2], [172, -26, 2]], -23.5, -21, { b: .6 }), M.st);  // selettore
    // ---- caricatore nell'impugnatura
    miCaricatore(A, { top: [186, -28], L: 182, d0: 33, w: 11, ang: -gradi(8), tex: true, fori: 3, foriPasso: 8, scritta: S.cal, mat: M.st, kind: M.acc });
    // ---- otturatore visibile nella finestra
    A.add(K.box(150, -9.4, .5, 300, 10.4, 18.6, .8), M.bolt, 'otturatore');
    A.add(K.box(206, 1.5, 17, 258, 4.5, 18.8, .3), M.dk, 'otturatore');
    A.pivot('otturatore', [230, 0, 0]);
    // ---- calcio metallico pieghevole (aperto): due bracci piatti e calciolo incernierato
    A.add(K.slab([[-8, -27, 2], [3, -27, 2], [3, -10, 2], [-8, -10, 2]], -20, 20, { b: 1.2 }), M.st);
    A.add(rodZ(-21, 21, 3.4, -3, -18.5, 14), M.st);
    for (const s of [-1, 1]) A.add(K.slab([[-4, -15, 2], [-4, -24, 2], [-158, -42, 2], [-158, -30, 2]], s > 0 ? 14 : -17, s > 0 ? 17 : -14, { b: .8 }), M.st);
    A.add(K.slabX([[-19, -78, 6], [19, -78, 6], [19, 6, 7], [-19, 6, 7]], -168, -160, { b: 2 }), M.st);
    A.add(rodZ(-18, 18, 3.6, -158, -36, 14), M.st);
    C.put(A, C.swivel(372, -6, -22, { rot: PI / 2, r: 7 })); C.put(A, C.swivel(28, -6, -22, { rot: PI / 2, r: 7 }));
    // ---- punti di riferimento
    A.anchor('bocca', [470.5, 0, 0]); A.anchor('espulsione', [232, 1, 22], [0, .3, 1]); A.anchor('impugnatura', [176, -88, 0]); A.anchor('grilletto', [236, -50, 0]);
    A.anchor('appoggio', [342, -42, -8]); A.anchor('mira_post', [20, 37, 0]); A.anchor('mira_ant', [394, 37.5, 0]); A.anchor('calcio', [-168, -36, 0]);
    const r = A.done();
    r.info = { azione: 'auto', bossolo: 'pistola', ciclo: { otturatore: { dx: -.085 }, grilletto: { rz: -.15 } }, ricarica: { caricatore: { dx: -.025, dy: -.18 } }, armamento: { manetta: { dx: -.14 } } };
    return r;
  });
  MAP2[41] = { f: 'mitra_scatola_caricatore_impugnatura', o: {} };

  // ================================================================ 42: tubo con camicia forata, caricatore laterale curvo, calcio ripiegabile sotto
  def('mitra_camicia_forata', function (spec, o) {
    const A = K.asm('mitra_camicia_forata'), M = miMat(spec), S = miTesti(spec);
    const R = 23.5, T = 1.5, XJ = 250, XF = 446;
    // ---- scatola di culatta: finestra di espulsione a destra, feritoia della manetta a sinistra
    const aP0 = gradi(58), aP1 = gradi(118), aS0 = gradi(264), aS1 = gradi(276);
    const xs = [0, 62, 176, 200, 244, XJ], as = giro(gradi(15), [aP0, aP1, aS0, aS1]);
    const pT = miPittoreTubo(0, XJ, R, { rough: .5 });
    pT.text('L', S.prod, 118, 10, 3.8); pT.text('L', S.nome + '  ·  ' + S.cal, 118, 15.5, 3, { weight: 'normal' });
    pT.text('L', S.mat, 118, -8, 3); pT.text('R', S.mat, 110, 0, 3); pT.text('R', S.paese + '  ' + S.anno, 110, -6, 2.6, { weight: 'normal' });
    pT.noise();
    const mRcv = K.mat(M.acc, pT.done(2.2), { ns: .8 });
    A.add(miLamieraTubo(xs, as, R, T, (i, j) => { const a = (as[j] + as[j + 1]) / 2; if (i === 3 && a > aP0 && a < aP1) return 'via'; if (i === 1 && a > aS0 && a < aS1) return 'via'; return null; }), mRcv);
    // ---- camicia forata della canna: file di fori tondi tutto attorno (sotto resta piena)
    const nl = 12, xsJ = []; for (let i = 0; i <= nl; i++) xsJ.push(XJ + (XF - XJ) * i / nl);
    A.add(miLamieraTubo(xsJ, giro(gradi(30)), R, T, (i, j) => (j === 5 || j === 6) ? null : { r: 4.7 }, { hn: 12 }), M.st);
    A.add(K.latheX([[XF - .5, R], [XF, R + .7], [XF + 5, R + .7], [XF + 6, R - .5], [XF + 6, 10.5]], { seg: 32 }), M.st);
    A.add(K.latheX([[-13, 0], [-13, 14], [-11.5, 19], [-7, 23], [-2, 24.2], [2.5, 24.2], [3, 23.5]], { seg: 32 }), M.st);
    miCanna(A, M.bar, XJ - 10, XF + 12, 9.6, 4.6);
    // mire e attacco della baionetta
    miAlzoL(A, M.st, 18, R - 1.5, { h: 12, hw: 8 });
    miMirinoOrecchie(A, M.st, 437, R - 1, { h: 12, hw: 7.5, L: 13 });
    A.add(K.box(418, -5, R - 4, 446, 4, R + 5, .8), M.st);
    // ---- castello dello scatto, impugnatura zigrinata, ponticello
    A.add(K.slab([[92, -15], [204, -15], [204, -26, 3], [200, -34, 3], [94, -34, 3], [90, -26, 3]], -11.5, 11.5, { b: 1.5 }), M.st);
    A.add(miImpugnaturaTonda({ x: 118, y: -33, h: 98, ang: gradi(12), d0: 42, d1: 38, bf: 2.5, bb: 3, w0: 13, w1: 14, wb: 1 }).g, matTrama('polimero', 'checker', [5, 9], { opz: { ns: .55 } }));
    A.add(K.slab([[134, -31], [210, -31], [210, -38, 3], [200, -64, 10], [146, -64, 10], [136, -52, 5]], -5.4, 5.4, { b: 1, holes: [[[146, -35, 2], [201, -35, 2], [198, -43, 3], [192, -58, 7], [151, -58, 7], [146, -48, 4]]] }), M.st);
    miGrilletto(A, 162, -33, M.st, { L: 21 });
    // ---- pozzetto del caricatore sul lato sinistro e caricatore curvo orizzontale
    A.add(K.box(200, -13.5, -58, 244, 13.5, -14, 1.6), M.st); A.add(K.box(198, -15.5, -61, 246, 15.5, -56, 1.2), M.st);
    A.add(K.box(191, -6, -52, 200, 6, -42, .8), M.st);
    miCaricatore(A, { top: [222, -36], L: 196, d0: 33, d1: 36, w: 11, curva: 700, tex: true, nerv: [-.2, .2], scritta: S.cal, mat: M.st, kind: M.acc, xf: g => g.rotateX(PI / 2), pivot: [222, 0, -36] });
    // ---- otturatore con la manetta (si muove con l'otturatore)
    A.add(K.latheX([[110, 0], [110, R - T - .4], [244, R - T - .4], [244, 0]], { seg: 28 }), M.bolt, 'otturatore');
    A.add(K.box(205, 3, R - T - 3, 240, 7, R - T - .3, .4), M.dk, 'otturatore');
    A.add(pomello([172, 0, -(R - 1)], [0, 0, -1], { L: 16, rs: 3, rh: 5.5, hl: 7 }), M.st, 'otturatore');
    A.pivot('otturatore', [170, 0, 0]);
    // ---- calcio ripiegabile (aperto): cerniera sotto il tappo, bracci, puntone e calciolo
    A.add(K.slab([[-12, -26, 3], [6, -26, 3], [6, -14, 2], [-12, -14, 2]], -14, 14, { b: 1.2 }), M.st);
    A.add(rodZ(-15, 15, 3.6, -4, -21, 14), M.st);
    for (const s of [-1, 1]) A.add(K.slab([[-2, -16, 1], [-2, -25, 1], [-222, -34, 1], [-222, -24, 1]], s > 0 ? 9 : -12, s > 0 ? 12 : -9, { b: .7 }), M.st);
    A.add(miFilo([[-216, -98, 0], [-10, -26, 0]], 4.2, { seg: 10 }), M.st);
    A.add(K.slabX([[-20, -110, 6], [20, -110, 6], [20, -14, 7], [-20, -14, 7]], -232, -222, { b: 2 }), M.st);
    C.put(A, C.swivel(424, 0, -24.5, { rot: PI / 2, r: 7 }));
    // ---- punti di riferimento
    A.anchor('bocca', [458.5, 0, 0]); A.anchor('espulsione', [222, 12, 22], [0, .4, 1]); A.anchor('impugnatura', [108, -72, 0]); A.anchor('grilletto', [163, -47, 0]);
    A.anchor('appoggio', [300, -26, -8]); A.anchor('mira_post', [18, R + 9.5, 0]); A.anchor('mira_ant', [437, R + 10, 0]); A.anchor('calcio', [-232, -62, 0]);
    const r = A.done();
    r.info = { azione: 'auto', bossolo: 'pistola', ciclo: { otturatore: { dx: -.085 }, grilletto: { rz: -.14 } }, ricarica: { caricatore: { dz: -.13 } } };
    return r;
  });
  MAP2[42] = { f: 'mitra_camicia_forata', o: {} };

  // ================================================================ 43: scatola stampata, pozzetto del caricatore ribaltabile in avanti, calcio a filo retrattile
  def('mitra_caricatore_ribaltabile', function (spec, o) {
    const A = K.asm('mitra_caricatore_ribaltabile'), M = miMat(spec), S = miTesti(spec);
    const XR = 252, hw = 18;
    const bbR = [-2, -26, 256, 22];
    const pR = K.painter(bbR, { w: 1024, h: 512, rough: .55 });
    pR.text('L', S.prod, 90, 9, 3.6); pR.text('L', S.nome + '  ·  ' + S.cal, 90, 3, 3, { weight: 'normal' });
    pR.text('R', S.mat, 90, 6, 3); pR.text('R', S.paese, 90, 0, 2.6, { weight: 'normal' });
    pR.fill('L', K.rrect(138, 4, 232, 8.5, 2.2), { h: -1, a: .12, r: .8 });
    for (const [x, y] of [[8, -16], [8, 12], [244, -16], [244, 12], [120, -18], [205, -18]]) pR.pin('LR', x, y, 1.7, { h: .4, a: 1.05 });
    pR.line('LR', [[4, -20], [248, -20]], .6, { h: -.4 });
    pR.noise({ a: .14, r: .2, seed: 7 }); pR.walls({ r: .55 });
    const mR = K.mat(M.acc, pR.done(2.4), { ns: .85 });
    const prof = [[0, -24, 2], [XR, -24, 2], [XR, 20, 3], [0, 20, 6]];
    A.add(K.slab(prof, -hw, 0, { bL: 3.5, bR: 0, uv: bbR }), mR);
    A.add(K.slab(prof, 0, hw, { bL: 0, bR: 3.5, uv: bbR, holes: [[[168, -7, 2], [228, -7, 2], [228, 11, 2], [168, 11, 2]]] }), mR);
    // ---- camicia della canna forata (fori sopra e sui fianchi)
    const XF = 440, RJ = 16.5, nl = 9, xsJ = []; for (let i = 0; i <= nl; i++) xsJ.push(XR + (XF - XR) * i / nl);
    A.add(miLamieraTubo(xsJ, giro(gradi(30)), RJ, 1.3, (i, j) => (i === 0 || i === nl - 1 || (j >= 4 && j <= 7)) ? null : { r: 4.2 }, { hn: 10 }), M.st);
    A.add(K.latheX([[XF - .5, RJ], [XF, RJ + .6], [XF + 6, RJ + .6], [XF + 7, RJ - .5], [XF + 7, 9.5]], { seg: 28 }), M.st);
    miCanna(A, M.bar, XR - 6, XF + 14, 9, 4.6);
    miMirinoOrecchie(A, M.st, XF - 4, RJ - 1, { h: 12, hw: 7 });
    miAlzoL(A, M.st, 22, 19, { h: 12, hw: 8 });
    // ---- castello, impugnatura con guancette e sicura dorsale, ponticello
    A.add(K.slab([[56, -22], [196, -22], [196, -30, 3], [190, -36, 3], [62, -36, 3], [56, -30, 3]], -11, 11, { b: 1.4 }), M.st);
    const go = { x: 92, y: -34, h: 98, ang: gradi(16), d0: 44, d1: 40, bf: 2, bb: 3, rf: 7, rb: 8 };
    const bbG = [36, -140, 130, -28];
    const pG = K.painter(bbG, { w: 512, h: 512, rough: .5 });
    for (let k = -3; k <= 3; k++) pG.line('LR', [[92 + k * 4.6, -44], [92 + k * 4.6 - 21, -120]], 1.5, { h: -.7, a: .85 });
    pG.pin('LR', 80, -82, 2.4, { slot: true, h: .5, a: 1.1 }); pG.noise({ a: .07, r: .1, seed: 8 });
    A.add(K.slab(profImpugnatura(Object.assign({}, go, { d0: 47, d1: 43 })), -10.5, 10.5, { b: 1.3 }), M.st);
    A.add(K.slab(profImpugnatura(go), -14, 14, { b: 5.5, bs: 4, uv: bbG }), K.mat('bachelite', pG.done(2), { ns: .8, c: '#2a150d' }));
    A.add(K.slab([[68, -40, 1], [64, -40, 1], [52, -100, 2], [56, -100, 2]], -6.5, 6.5, { b: .7 }), M.st);   // sicura dorsale
    A.add(K.slab([[112, -34], [186, -34], [186, -40, 3], [176, -70, 12], [124, -70, 12], [114, -56, 6]], -5.4, 5.4, { b: 1, holes: [[[122, -38, 2], [178, -38, 2], [175, -45, 3], [169, -64, 8], [130, -64, 8], [122, -52, 5]]] }), M.st);
    miGrilletto(A, 140, -35, M.st, { L: 21 });
    // ---- pozzetto del caricatore incernierato davanti (aperto, inclinato in avanti) e caricatore
    const aH = gradi(14), hp = [206, -24];
    A.add(K.xf(K.slab([[-24, 2, 0], [22, 2, 0], [22, -76, 2], [-24, -76, 2]], -14.5, 14.5, { b: 1.5 }), { r: [0, 0, aH], t: [hp[0], hp[1], 0] }), M.st);
    A.add(K.xf(K.slab([[-26, -70, 1], [24, -70, 1], [24, -77, 1.5], [-26, -77, 1.5]], -16, 16, { b: 1 }), { r: [0, 0, aH], t: [hp[0], hp[1], 0] }), M.st);
    A.add(rodZ(-16, 16, 3.2, hp[0] + 20, hp[1] + 3, 12), M.st);
    const ax = [Math.sin(aH), -Math.cos(aH)];
    miCaricatore(A, { top: [hp[0] - 1 + ax[0] * 10, hp[1] + ax[1] * 10], L: 196, d0: 33, w: 11, ang: aH, tex: true, fori: 3, foriPasso: 8, scritta: S.cal, mat: M.st, kind: M.acc });
    // ---- otturatore e manetta a sinistra (non segue l'otturatore)
    A.add(K.box(150, -7.5, .5, 300, 11.5, 15.5, .8), M.bolt, 'otturatore');
    A.add(K.box(172, 2, 14, 224, 5, 15.7, .3), M.dk, 'otturatore');
    A.pivot('otturatore', [200, 0, 0]);
    A.add(pomello([226, 6.2, -hw + .5], [0, 0, -1], { L: 14, rs: 2.8, rh: 5.2, hl: 6 }), M.st, 'manetta');
    A.pivot('manetta', [226, 6.2, -hw]);
    // ---- calcio a filo retrattile (aperto): tubi guida ai fianchi, filo piegato, calciolo
    for (const s of [-1, 1]) A.add(K.latheX([[2, 0], [2, 4.4], [3, 5], [150, 5], [151, 4.4], [151, 0]], { seg: 14, cy: -16, cz: s * (hw + 4.2) }), M.st);
    A.add(miFilo([[148, -16, -(hw + 4.2)], [-240, -16, -(hw + 4.2), 9], [-244, -94, -(hw + 1), 9], [-244, -94, hw + 1, 9], [-240, -16, hw + 4.2, 9], [148, -16, hw + 4.2]], 3.6, { seg: 10 }), M.st);
    A.add(K.slabX([[-24, -102, 6], [24, -102, 6], [24, -10, 6], [-24, -10, 6]], -256, -248, { b: 2 }), M.st);
    // ---- punti di riferimento
    A.anchor('bocca', [454.5, 0, 0]); A.anchor('espulsione', [198, 3, 19], [0, .3, 1]); A.anchor('impugnatura', [80, -76, 0]); A.anchor('grilletto', [141, -50, 0]);
    A.anchor('appoggio', [222, -80, -6]); A.anchor('mira_post', [22, 31, 0]); A.anchor('mira_ant', [436, RJ + 11, 0]); A.anchor('calcio', [-256, -56, 0]);
    const r = A.done();
    r.info = { azione: 'auto', bossolo: 'pistola', ciclo: { otturatore: { dx: -.08 }, grilletto: { rz: -.14 } }, ricarica: { caricatore: { dx: .044, dy: -.175 } }, armamento: { manetta: { dx: -.08 } } };
    return r;
  });
  MAP2[43] = { f: 'mitra_caricatore_ribaltabile', o: {} };

  // ================================================================ 44: tubo lungo con camicia ad asole, caricatore lungo, calcio laterale a tubo
  def('mitra_tubo_asole', function (spec, o) {
    const A = K.asm('mitra_tubo_asole'), M = miMat(spec), S = miTesti(spec);
    const R = 19.5, T = 1.4, XJ = 275, XF = 515;
    const aS0 = gradi(48), aS1 = gradi(58), aP0 = gradi(72), aP1 = gradi(128);
    const xs = [0, 38, 152, 166, 214, XJ], as = giro(gradi(15), [aS0, aS1, aP0, aP1]);
    const pT = miPittoreTubo(0, XJ, R, { rough: .5 });
    pT.text('L', S.prod, 140, 4, 3.6); pT.text('L', S.nome + '  ·  ' + S.cal + '  ·  ' + S.anno, 140, -2.5, 2.8, { weight: 'normal' });
    pT.text('R', S.mat, 95, -6, 2.8); pT.noise();
    const mRcv = K.mat(M.acc, pT.done(2.2), { ns: .8 });
    A.add(miLamieraTubo(xs, as, R, T, (i, j) => { const a = (as[j] + as[j + 1]) / 2; if (i === 1 && a > aS0 && a < aS1) return 'via'; if (i === 3 && a > aP0 && a < aP1) return 'via'; return null; }), mRcv);
    // ---- camicia con le asole lunghe
    const nl = 5, xsJ = []; for (let i = 0; i <= nl; i++) xsJ.push(XJ + (XF - XJ) * i / nl);
    A.add(miLamieraTubo(xsJ, giro(gradi(45)), R, T, (i, j) => (j === 3 || j === 4) ? null : { lx: 17, la: 5.2, rr: 5.2 }, { hn: 12 }), M.st);
    A.add(K.latheX([[XF - .5, R], [XF, R + 1], [XF + 9, R + 1], [XF + 10, R - .5], [XF + 10, 9]], { seg: 28 }), M.st);
    A.add(K.latheX([[-10, 0], [-10, 14], [-8, 18], [-4, 20.2], [2, 20.2], [2.5, 19.6]], { seg: 28 }), M.st);
    miCanna(A, M.bar, XJ - 20, 535, 8.6, 4.6);
    miMirinoOrecchie(A, M.st, XF + 4, R, { h: 12, hw: 7, L: 10 });
    miAlzoL(A, M.st, 24, R - 1.5, { h: 11, hw: 7.5 });
    // ---- castello, impugnatura, ponticello
    A.add(K.slab([[92, -12], [212, -12], [212, -24, 3], [207, -31, 3], [96, -31, 3], [92, -24, 3]], -11, 11, { b: 1.4 }), M.st);
    A.add(miImpugnaturaTonda({ x: 120, y: -30, h: 97, ang: gradi(10), d0: 40, d1: 37, bf: 2, bb: 3, w0: 13, w1: 14, wb: 1 }).g, matTrama('polimero', 'checker', [5, 9], { opz: { ns: .55 } }));
    A.add(K.slab([[136, -28], [206, -28], [206, -34, 3], [197, -62, 10], [148, -62, 10], [138, -50, 5]], -5.2, 5.2, { b: 1, holes: [[[147, -32, 2], [198, -32, 2], [195, -40, 3], [190, -56, 7], [152, -56, 7], [147, -46, 4]]] }), M.st);
    miGrilletto(A, 166, -30, M.st, { L: 20 });
    // ---- pozzetto e caricatore lungo da 36 colpi
    A.add(K.slab([[206, -12], [256, -12], [256, -62, 2], [206, -62, 2]], -15, 15, { b: 1.6 }), M.st);
    A.add(K.box(256, -40, -6, 262, -30, 6, .8), M.st);
    miCaricatore(A, { top: [231, -22], L: 236, d0: 34, w: 12.5, tex: true, fori: 3, foriPasso: 12, scritta: S.cal, mat: M.st, kind: M.acc });
    // ---- otturatore con la manetta a destra (si muove con l'otturatore)
    A.add(K.latheX([[100, 0], [100, R - T - .4], [250, R - T - .4], [250, 0]], { seg: 28 }), M.bolt, 'otturatore');
    A.add(K.box(170, -8, R - T - 3, 210, -4, R - T - .3, .4), M.dk, 'otturatore');
    const aM = gradi(53), dM = [0, Math.cos(aM), Math.sin(aM)];
    A.add(pomello([146, dM[1] * (R - 1), dM[2] * (R - 1)], dM, { L: 15, rs: 3, rh: 5.5, hl: 6.5 }), M.st, 'otturatore');
    A.pivot('otturatore', [150, 0, 0]);
    // ---- calcio laterale a tubo (aperto)
    A.add(K.slab([[-14, -18, 3], [2, -18, 3], [2, 12, 3], [-14, 12, 3]], -11, 13, { b: 2 }), M.st);
    A.add(rodY(-22, 16, 4, -6, 12, 14), M.st);
    A.add(miFilo([[-10, 7, 8], [-40, 6, 2, 18], [-254, 1, 0, 16], [-262, -86, 0, 16], [-40, -20, 2, 18], [-10, -14, 8]], 6, { seg: 12 }), M.st);
    A.add(K.slabX([[-14, -94, 5], [14, -94, 5], [14, 8, 5], [-14, 8, 5]], -270, -264, { b: 1.5 }), M.st);
    // ---- punti di riferimento
    A.anchor('bocca', [535.5, 0, 0]); A.anchor('espulsione', [190, -4, 21], [0, .1, 1]); A.anchor('impugnatura', [112, -72, 0]); A.anchor('grilletto', [167, -45, 0]);
    A.anchor('appoggio', [231, -100, -8]); A.anchor('mira_post', [24, R + 8.5, 0]); A.anchor('mira_ant', [519, R + 11, 0]); A.anchor('calcio', [-270, -45, 0]);
    const r = A.done();
    r.info = { azione: 'auto', bossolo: 'pistola', ciclo: { otturatore: { dx: -.09 }, grilletto: { rz: -.14 } }, ricarica: { caricatore: { dy: -.2 } } };
    return r;
  });
  MAP2[44] = { f: 'mitra_tubo_asole', o: {} };

  // ================================================================ 45: tubo stampato grosso, coperchio della finestra, leva a manovella, calcio a filo
  def('mitra_tubo_stampato', function (spec, o) {
    const A = K.asm('mitra_tubo_stampato'), M = miMat(spec), S = miTesti(spec);
    const R = 27.5, T = 1.5, XR = 318;
    const aP0 = gradi(40), aP1 = gradi(122);
    const xs = [0, 60, 176, 252, XR], as = giro(gradi(15), [aP0, aP1]);
    const pT = miPittoreTubo(0, XR, R, { rough: .62 });
    pT.text('L', S.prod, 118, 7, 4.2); pT.text('L', S.nome + '  ·  ' + S.cal, 118, 0, 3.4, { weight: 'normal' }); pT.text('L', S.paese + '  ' + S.anno, 118, -6.5, 3, { weight: 'normal' });
    pT.text('R', S.mat, 100, 0, 3.2);
    for (const sd of ['L', 'R']) pT.line(sd, [[4, -20], [XR - 4, -20]], .6, { h: -.4, a: .85 });
    pT.noise({ a: .22, r: .3 });
    const mRcv = K.mat(M.acc, pT.done(2.2), { ns: .8 });
    A.add(miLamieraTubo(xs, as, R, T, (i, j) => { const a = (as[j] + as[j + 1]) / 2; return (i === 2 && a > aP0 && a < aP1) ? 'via' : null; }), mRcv);
    // coperchio della finestra aperto (incernierato sotto)
    const cov = K.latheX([[174, R + 1.2], [254, R + 1.2], [254, R - .2], [174, R - .2], [174, R + 1.2]], { seg: 10, a0: aP0 - .05, a1: aP1 + .05 });
    const ah = aP1 + .09, hy = Math.cos(ah) * (R + .5), hz = Math.sin(ah) * (R + .5);
    A.add(K.xf(cov, { r: [gradi(100), 0, 0], p: [0, hy, hz] }), M.st);
    A.add(K.rod(176, 252, 1.8, { cy: hy, cz: hz, seg: 10 }), M.st);
    // tappo posteriore, anello e ghiera della canna, canna
    A.add(K.latheX([[-7, 0], [-7, 18], [-5, 24], [-2, 27.9], [3, 27.9], [3.5, 27.3]], { seg: 32 }), M.st);
    A.add(K.latheX([[XR - 1, 26.5], [XR, 27.9], [XR + 3, 27.9], [XR + 4, 26], [XR + 4, 18]], { seg: 32 }), M.st);
    A.add(K.latheX([[XR + 4, 0], [XR + 4, 18], [XR + 19, 18], [XR + 21, 16], [XR + 21, 9.5]], { seg: 28 }), K.mat(M.acc, null, { tile: 'knurl', rep: [2, 26], r: .6 }));
    miCanna(A, M.bar, XR + 18, 502, 9.3, 4.7);
    // mire: lama davanti, diottra fissa dietro
    A.add(K.slab([[298, R - 3], [314, R - 3], [314, R + 1.5, 1], [298, R + 1.5, 1]], -5, 5, { b: .7 }), M.st);
    A.add(K.slab([[302, R], [311, R], [309.5, R + 8, 1], [304, R + 8, 1]], -1.4, 1.4, { b: .4 }), M.st);
    A.add(K.box(12, R - 3, -7, 30, R + 3, 7, 1), M.st);
    A.add(K.slabX([[-6, R + 2], [6, R + 2], [6, R + 14, 2], [-6, R + 14, 2]], 20, 23, { b: .5, holes: [K.circ(0, R + 9, 1.4, 12)] }), M.st);
    // ---- pozzetto del caricatore, castello stampato con impugnatura e ponticello
    A.add(K.slab([[188, -18], [248, -18], [248, -66, 2], [188, -66, 2]], -16.5, 16.5, { b: 1.6 }), M.st);
    A.add(K.box(186, -70, -18, 250, -64, 18, 1.2), M.st);
    A.add(K.slab([[236, -36, 1], [250, -36, 1], [250, -50, 1], [236, -50, 1]], -19.5, -16.5, { b: .6 }), M.st);
    const bbF = [30, -150, 192, -16];
    const pF = K.painter(bbF, { w: 1024, h: 512, rough: .62 });
    const go = { x: 86, y: -38, h: 100, ang: gradi(22), d0: 42, d1: 36, bf: 1.5, bb: 2.5, rf: 6, rb: 6 };
    pF.line('LR', profImpugnatura(Object.assign({}, go, { d0: 32, d1: 26, h: 86, x: go.x - 2, y: go.y - 5, alto: 0 })), .7, { h: -.5, a: .85 }, true);
    pF.text('L', 'SICURA', 120, -26, 2.4, { weight: 'normal' }); pF.text('R', S.mat, 120, -26, 2.4, { weight: 'normal' });
    pF.pin('LR', 70, -26, 1.8, {}); pF.pin('LR', 176, -26, 1.8, {});
    pF.noise({ a: .16, r: .22, seed: 13 }); pF.walls({ r: .6 });
    const mF = K.mat(M.acc, pF.done(2.2), { ns: .8 });
    A.add(K.slab([[60, -18], [190, -18], [190, -30, 3], [184, -40, 3], [66, -40, 3], [60, -30, 3]], -13.5, 13.5, { b: 1.5, uv: bbF }), mF);
    A.add(K.slab(profImpugnatura(go), -13, 13, { b: 3.5, bs: 3, uv: bbF }), mF);
    A.add(K.slab([[104, -38], [186, -38], [186, -44, 3], [176, -74, 12], [118, -74, 12], [106, -60, 6]], -5.4, 5.4, { b: 1, holes: [[[114, -42, 2], [178, -42, 2], [174, -50, 3], [168, -68, 9], [122, -68, 9], [114, -56, 5]]] }), M.st);
    miGrilletto(A, 134, -39, M.st, { L: 21 });
    miCaricatore(A, { top: [218, -28], L: 205, d0: 34, w: 12.5, tex: true, nerv: [-.25, 0, .25], scritta: S.cal, mat: M.st, kind: M.acc });
    // ---- leva di armamento a manovella sul fianco destro (non segue l'otturatore)
    const cp = [184, -29, 14.8];
    A.add(K.slab([[-6, -4, 3], [6, -4, 3], [6, 4, 3], [-56, 6, 2.5], [-62, 2, 2.5], [-60, -3, 2]].map(p => [cp[0] + p[0], cp[1] + p[1], p[2]]), 13.6, 16.2, { b: .6 }), M.st, 'manetta');
    A.add(rodZ(13, 18, 4.5, cp[0], cp[1], 14), M.st, 'manetta');
    A.add(pomello([cp[0] - 56, cp[1] + 2, 16], [0, 0, 1], { L: 14, rs: 3, rh: 5, hl: 9 }), M.st, 'manetta');
    A.pivot('manetta', cp);
    // ---- otturatore visibile dalla finestra
    A.add(K.latheX([[110, 0], [110, R - T - .4], [300, R - T - .4], [300, 0]], { seg: 30 }), M.bolt, 'otturatore');
    A.add(K.box(190, 6, R - T - 4, 246, 10, R - T - .3, .4), M.dk, 'otturatore');
    A.pivot('otturatore', [210, 0, 0]);
    // ---- calcio a filo retrattile (aperto) con i tubi guida
    for (const s of [-1, 1]) A.add(K.latheX([[-4, 0], [-4, 4.6], [-3, 5.2], [68, 5.2], [69, 4.6], [69, 0]], { seg: 14, cy: -20, cz: s * 19 }), M.st);
    A.add(miFilo([[64, -20, -19], [-224, -20, -16, 10], [-234, -96, -12, 10], [-234, -96, 12, 10], [-224, -20, 16, 10], [64, -20, 19]], 3.7, { seg: 10 }), M.st);
    C.put(A, C.swivel(40, 0, -28.5, { rot: PI / 2, r: 7 }));
    // ---- punti di riferimento
    A.anchor('bocca', [502.5, 0, 0]); A.anchor('espulsione', [214, 14, 30], [0, .3, 1]); A.anchor('impugnatura', [76, -88, 0]); A.anchor('grilletto', [135, -53, 0]);
    A.anchor('appoggio', [218, -100, -10]); A.anchor('mira_post', [21.5, R + 9, 0]); A.anchor('mira_ant', [306, R + 7, 0]); A.anchor('calcio', [-234, -58, 0]);
    const r = A.done();
    r.info = { azione: 'auto', bossolo: 'pistola', ciclo: { otturatore: { dx: -.07 }, grilletto: { rz: -.13 } }, ricarica: { caricatore: { dy: -.18 } }, armamento: { manetta: { rz: .8 } } };
    return r;
  });
  MAP2[45] = { f: 'mitra_tubo_stampato', o: {} };

  // ================================================================ 46: pistola mitragliatrice tascabile, caricatore curvo, calcio a filo ripiegato sopra
  def('mitra_tascabile_calcio_sopra', function (spec, o) {
    const A = K.asm('mitra_tascabile_calcio_sopra'), M = miMat(spec), S = miTesti(spec);
    const XR = 238, hw = 13.5, wi = 6.5;
    const bbR = [-2, -20, 242, 15];
    const pR = K.painter(bbR, { w: 1024, h: 512, rough: .4 });
    pR.text('L', S.prod + ' · ' + S.nome, 72, -8, 3.2); pR.text('L', S.cal, 72, -13.5, 2.6, { weight: 'normal' });
    pR.text('R', S.mat, 80, -10, 2.8);
    pR.fill('LR', K.rrect(118, 3.6, 207, 7.6, 2), { h: -1, a: .1, r: .8 });
    pR.text('L', '0', 46, 2, 2.4); pR.text('L', '1', 54, 6, 2.4); pR.text('L', '20', 62, 2, 2.4);
    for (const x of [10, 228]) pR.pin('LR', x, -12, 1.6, {});
    pR.noise({ a: .12, r: .18, seed: 3 }); pR.walls({ r: .4 });
    const mR = K.mat(M.acc, pR.done(2.4), { ns: .85 });
    const prof = [[0, -18, 2], [XR, -18, 2], [XR, 13, 2], [0, 13, 5]];
    A.add(K.slab(prof, -hw, -wi, { bL: 2, bR: 0, uv: bbR }), mR);
    A.add(K.slab(prof, wi, hw, { bL: 0, bR: 2, uv: bbR }), mR);
    A.add(K.slab([[0, -18], [XR, -18], [XR, 13], [176, 13], [176, -5, 1], [112, -5, 1], [112, 13], [0, 13]], -wi, wi, { b: 0, uv: bbR }), mR);
    miCanna(A, M.bar, XR - 10, 262, 6.8, 3.9);
    A.add(anello(XR, XR + 12, 8.6, 6.6, { seg: 24 }), M.st);
    miMirinoOrecchie(A, M.st, 228, 12.5, { h: 10, hw: 6.5, L: 11 });
    miAlzoL(A, M.st, 16, 12.5, { h: 10, hw: 7, L: 15 });
    // ---- impugnatura: telaio d'acciaio e guancette in bachelite quadrettata
    const go = { x: 64, y: -17, h: 90, ang: gradi(10), d0: 42, d1: 40, bf: 1.5, bb: 2.5, rf: 6, rb: 7 };
    A.add(K.slab(profImpugnatura(Object.assign({}, go, { d0: 44, d1: 42 })), -9.5, 9.5, { b: 1.5 }), M.st);
    const sa = Math.sin(go.ang), ca = Math.cos(go.ang), gpn = Object.assign({}, go, { x: go.x - 4 * sa, y: go.y - 4 * ca, h: go.h - 4, alto: 0 });
    const bbG = [24, -112, 96, -14];
    const pG = K.painter(bbG, { w: 512, h: 512, rough: .45 });
    pG.checker('LR', profImpugnatura(Object.assign({}, gpn, { d0: 34, d1: 32, h: 74, x: gpn.x - 3 * sa, y: gpn.y - 3 * ca, alto: 0 })), 1.9, { a: .9, r: .6 });
    pG.pin('LR', 58, -62, 2.2, { slot: true, h: .5, a: 1.2 }); pG.noise({ a: .08, r: .1, seed: 2 });
    A.add(K.slab(profImpugnatura(gpn), -13.5, 13.5, { b: 3.5, bs: 3, uv: bbG }), K.mat('bachelite', pG.done(2), { ns: .8, c: '#2c160e' }));
    A.add(K.slab([[80, -17], [160, -17], [158, -28, 6], [140, -58, 14], [100, -60, 14], [84, -44, 8]], -4.5, 4.5, { b: .9, holes: [[[92, -21, 2], [150, -21, 2], [149, -30, 6], [134, -52, 11], [104, -53, 11], [94, -40, 6]]] }), M.st);
    miGrilletto(A, 112, -18, M.st, { L: 19, hw: 2.8 });
    A.add(K.slab([[44, -4, 2], [60, -1, 2], [60, -7, 2], [46, -9, 2]], -15.5, -13.5, { b: .5 }), M.st);   // selettore
    // ---- pozzetto corto e caricatore curvo da 20 colpi
    A.add(K.slab([[156, -16], [196, -16], [196, -30, 2], [156, -30, 2]], -10.5, 10.5, { b: 1.2 }), M.st);
    miCaricatore(A, { top: [176, -20], L: 146, d0: 26, d1: 27, w: 8.6, curva: 280, tex: true, nerv: [0], nervW: 2.2, scritta: S.cal, mat: M.st, kind: M.acc });
    // ---- otturatore (visibile dalla finestra in alto) con i due pomelli di armamento
    A.add(K.box(100, -4.5, -6.3, 230, 3.2, 6.3, .6), M.bolt, 'otturatore');
    for (const s of [-1, 1]) A.add(pomello([204, 5.6, s * (hw - .5)], [0, 0, s], { L: 8, rs: 2.4, rh: 4.4, hl: 5 }), M.st, 'otturatore');
    A.pivot('otturatore', [180, 0, 0]);
    // ---- calcio a filo (aperto) con la cerniera dietro
    A.add(K.slab([[-7, 0, 2], [4, 0, 2], [4, 13, 2], [-7, 13, 2]], -11.5, 11.5, { b: 1 }), M.st);
    A.add(rodZ(-12, 12, 2.6, -2, 6.5, 12), M.st);
    A.add(miFilo([[2, 6.5, -9], [-226, 4, -9, 6], [-238, -50, -9, 6], [-238, -50, 9, 6], [-226, 4, 9, 6], [2, 6.5, 9]], 2.9, { seg: 10 }), M.st);
    C.put(A, C.swivel(30, -10, -14.5, { rot: PI / 2, r: 6, t: 1.4 }));
    // ---- punti di riferimento
    A.anchor('bocca', [262.5, 0, 0]); A.anchor('espulsione', [144, 13, 0], [0, 1, .35]); A.anchor('impugnatura', [56, -60, 0]); A.anchor('grilletto', [113, -33, 0]);
    A.anchor('appoggio', [176, -100, -4]); A.anchor('mira_post', [16, 22.5, 0]); A.anchor('mira_ant', [228, 22.5, 0]); A.anchor('calcio', [-238, -23, 0]);
    const r = A.done();
    r.info = { azione: 'auto', bossolo: 'pistola', ciclo: { otturatore: { dx: -.045 }, grilletto: { rz: -.13 } }, ricarica: { caricatore: { dx: .02, dy: -.14 } } };
    return r;
  });
  MAP2[46] = { f: 'mitra_tascabile_calcio_sopra', o: {} };

  // ================================================================ 47 e 52: chiusura a rulli, tubo d'armamento sopra la canna, caricatore molto curvo
  // o.corta: versione corta con impugnatura anteriore e senza calcio
  def('mitra_rulli', function (spec, o) {
    const A = K.asm('mitra_rulli'), M = miMat(spec), S = miTesti(spec), corta = !!o.corta;
    const XR = corta ? 232 : 292, xT = corta ? 0 : 46, xW = corta ? 118 : 176, xP = corta ? 138 : 196;
    const xC0 = corta ? 168 : 222, xC1 = corta ? 290 : 402, xH0 = corta ? 186 : 246, xH1 = corta ? 284 : 396, xM = corta ? 325 : 455, hw = 20;
    // ---- scatola di culatta in lamiera: nervatura stampata, incavi per gli attacchi, finestra a destra
    const bbR = [-8, -30, XR + 4, 24];
    const pR = K.painter(bbR, { w: 1024, h: 512, rough: .5 });
    pR.line('LR', [[8, 9], [xW + 30, 9]], 3, { h: .5, a: 1.05 }); pR.line('LR', [[8, 4.5], [xW + 30, 4.5]], .5, { h: -.6, a: .8 });
    for (const x of (corta ? [26, 60, 150] : [30, 72, 200, 236])) pR.fill('LR', K.rrect(x - 3.5, 18, x + 3.5, 23, .8), { h: -1, a: .3 });
    pR.text('L', S.prod + '  ·  ' + S.nome, corta ? 62 : 96, -6, 3.4); pR.text('L', S.cal + '  ·  ' + S.anno, corta ? 62 : 96, -13, 2.8, { weight: 'normal' });
    pR.text('R', S.mat, corta ? 70 : 100, -8, 3);
    for (const x of [6, XR - 10]) pR.pin('LR', x, -18, 1.6, {});
    pR.noise({ a: .12, r: .18, seed: 8 }); pR.walls({ r: .5 });
    const mR = K.mat(M.acc, pR.done(2.4), { ns: .85 });
    const prof = [[0, -26, 1.5], [XR - 70, -26, 1.5], [XR - 58, -13, 5], [XR, -13, 1], [XR, 22, 1.5], [0, 22, 3]];
    A.add(K.slab(prof, -hw, 0, { bL: 2.5, bR: 0, uv: bbR }), mR);
    A.add(K.slab(prof, 0, hw, { bL: 0, bR: 2.5, uv: bbR, holes: [[[xP, -4, 2], [xP + 50, -4, 2], [xP + 50, 12, 2], [xP, 12, 2]]] }), mR);
    A.add(K.slab([[xW - 2, -24], [xW + 46, -24], [xW + 46, -40, 2], [xW + 48, -48, 1.5], [xW - 4, -48, 1.5], [xW - 2, -40, 2]], -14.5, 14.5, { b: 1.5 }), M.st);
    A.add(K.slab([[xW - 12, -40, 1], [xW - 4, -40, 1], [xW - 6, -53, 2], [xW - 13, -51, 1]], -8, 8, { b: .5 }), M.nero);     // leva di sgancio
    // ---- tubo d'armamento con la feritoia a sinistra, manetta inclinata in avanti (non segue l'otturatore)
    const aS0 = gradi(258), aS1 = gradi(282), xs = [xC0, xC1 - 92, xC1 - 8, xC1], as = giro(gradi(20), [aS0, aS1]);
    A.add(miLamieraTubo(xs, as, 9.6, 1.2, (i, j) => { const a = (as[j] + as[j + 1]) / 2; return (i === 1 && a > aS0 && a < aS1) ? 'via' : null; }, { cy: 13, segI: 16 }), M.st);
    const dM = v3.nrm([0, .5, -.866]);
    A.add(pomello([xC1 - 14, 13, -9], dM, { L: 30, rs: 3, rh: 4.6, hl: 9 }), M.st, 'manetta');
    A.pivot('manetta', [xC1 - 14, 13, -9]);
    // ---- guardamano in polimero attorno a canna e tubo
    const mH = K.mat('polimero', null, { tile: 'grana', rep: [6, 4], ns: .5 });
    A.add(K.loftX([{ x: xH0, t: 11, b: -15, w: 16.5 }, { x: xH0 + 8, t: 14, b: -21, w: 19.5 }, { x: xH1 - 14, t: 14, b: -21, w: 19.5 }, { x: xH1 - 5, t: 14, b: -23.5, w: 20.6 }, { x: xH1, t: 12, b: -17, w: 17 }].map(s => Object.assign({ nt: 6, nb: 2.8 }, s)), { K: 30, step: 5 }), mH);
    // blocco del mirino, mirino ad anello, canna con i tre tenoni
    A.add(K.slab([[xC1 - 4, -9, 2], [xC1 + 18, -9, 2], [xC1 + 18, 23, 2], [xC1 - 4, 23, 2]], -10, 10, { b: 1.5 }), M.st);
    miMirinoAnello(A, M.st, xC1 + 8, 22, { R: 8.5, L: 9, alto: 13, hw: 7 });
    miCanna(A, M.bar, XR - 20, xM, 8.2, 4.6);
    for (let k = 0; k < 3; k++) A.add(K.xf(K.box(xM - 26, 7.5, -2.6, xM - 12, 10.5, 2.6, .5), { r: [k * 2 * PI / 3, 0, 0] }), M.st);
    A.add(K.latheX([[xM - 10, 0], [xM - 10, 9.6], [xM - 1, 9.6], [xM, 8.8], [xM, 4.8]], { seg: 24 }), M.st);
    miTamburo(A, M.st, 26, 22, { R: 8, h: 9 });
    // ---- gruppo di scatto in polimero: impugnatura, ponticello, selettore, perni
    const mP = K.mat('polimero', null, { r: .62 });
    A.add(K.slab([[xT, -24], [xT + 130, -24], [xT + 130, -31, 2], [xT + 124, -38, 3], [xT + 6, -38, 3], [xT, -31, 2]], -13.5, 13.5, { b: 2 }), mP);
    A.add(miImpugnaturaTonda({ x: xT + 46, y: -36, h: 100, ang: gradi(18), d0: 44, d1: 38, bf: 1.5, bb: 3, w0: 14, w1: 15.5, wb: 1 }).g, matTrama('polimero', 'stipple', [5, 8], { opz: { ns: .5 } }));
    A.add(K.slab([[xT + 72, -36], [xT + 130, -36], [xT + 130, -42, 3], [xT + 120, -72, 12], [xT + 82, -74, 10], [xT + 72, -60, 6]], -6, 6, { b: 1.5, holes: [[[xT + 80, -40, 2], [xT + 122, -40, 2], [xT + 119, -48, 3], [xT + 113, -66, 9], [xT + 86, -68, 8], [xT + 80, -56, 5]]] }), mP);
    miGrilletto(A, xT + 96, -37, M.st, { L: 21 });
    A.add(K.slab([[xT + 30, -26, 2], [xT + 44, -26, 2], [xT + 50, -38, 2], [xT + 42, -40, 2]], -15.5, -13.5, { b: .5 }), M.nero);
    for (const x of [xT + 7, xT + 124]) A.add(rodZ(-14.6, 14.6, 2.2, x, -30, 12), M.st);
    // ---- caricatore curvo da 30 colpi
    miCaricatore(A, { top: [xW + 21, -30], L: 182, d0: 33, d1: 35, w: 11, curva: 330, tex: true, fori: 0, nerv: [-.24, .24], scritta: S.cal, mat: M.st, kind: M.acc });
    // ---- portaotturatore visibile nella finestra
    A.add(K.box(xP - 50, -4.5, .5, xP + 104, 12.5, 17.5, .8), M.bolt, 'otturatore');
    A.add(K.box(xP + 8, 3, 16, xP + 44, 6, 17.8, .3), M.dk, 'otturatore');
    A.pivot('otturatore', [xP + 25, 4, 0]);
    // ---- calcio fisso in polimero (normale) o tappo con l'anello per la cinghia (corta); impugnatura anteriore (corta)
    A.add(K.slab([[-7, -23, 3], [3, -23, 3], [3, 20, 3], [-7, 20, 3]], -19.5, 19.5, { b: 2 }), M.st);
    if (!corta) {
      const mS = K.mat('polimero', null, { tile: 'grana', rep: [8, 4], ns: .45, r: .6 });
      A.add(K.slab([[-6, 19, 2], [-198, 15, 10], [-214, 15, 4], [-214, -97, 6], [-196, -99, 12], [-70, -42, 40], [-6, -25, 3]], -17.5, 17.5, { b: 6.5, bs: 4 }), mS);
      A.add(K.slab([[-228, 16, 4], [-212, 16, 2], [-212, -99, 2], [-228, -99, 5]], -19, 19, { b: 4 }), M.gom);
      C.put(A, C.swivel(-190, -101, 0, { r: 6 }));
    } else {
      C.put(A, C.swivel(-12, 2, 0, { r: 8, t: 1.8 }));
      A.add(miImpugnaturaTonda({ x: 240, y: -19, h: 90, ang: gradi(-4), d0: 34, d1: 32, bf: 1, bb: 1, dita: 4, dp: 2, w0: 12, w1: 13, wb: .8 }).g, matTrama('polimero', 'stipple', [5, 7], { opz: { ns: .5 } }));
      A.add(K.slab([[xH1 - 6, -12], [xH1 + 6, -12], [xH1 + 8, -40, 4], [xH1 - 2, -42, 4]], -15, 15, { b: 3.5 }), mH);
    }
    // ---- punti di riferimento
    A.anchor('bocca', [xM + .5, 0, 0]); A.anchor('espulsione', [xP + 25, 4, 21], [0, .3, 1]); A.anchor('impugnatura', [xT + 38, -80, 0]); A.anchor('grilletto', [xT + 97, -52, 0]);
    A.anchor('appoggio', corta ? [238, -60, -4] : [320, -24, -8]); A.anchor('mira_post', [25, 32, 0]); A.anchor('mira_ant', [xC1 + 8, 36.5, 0]);
    if (!corta) A.anchor('calcio', [-228, -40, 0]);
    const r = A.done();
    r.info = { azione: 'auto', bossolo: 'pistola', ciclo: { otturatore: { dx: -.06 }, grilletto: { rz: -.13 } }, ricarica: { caricatore: { dx: .015, dy: -.12, rz: .12 } }, armamento: { manetta: { dx: -.09 } } };
    return r;
  });
  MAP2[47] = { f: 'mitra_rulli', o: {} };
  MAP2[52] = { f: 'mitra_rulli', o: { corta: true } };

  // ================================================================ 48 e 49: scatola di lamiera, caricatore nell'impugnatura, pomello in alto, calcio a due aste
  // o.scala: misura (1 = grande; 0,84 = piccola); o.calcio = lunghezza delle aste (nelle misure della grande)
  def('mitra_scatola_filo', function (spec, o) {
    const s = o.scala || 1, A0 = K.asm('mitra_scatola_filo'), M = miMat(spec), S = miTesti(spec);
    const sc = v => v.map(c => c * s);   // tutto è disegnato nelle misure della grande e scalato
    const A = { add: (g, m, p) => (A0.add(g.scale(s, s, s), m, p), A), pivot: (p, v) => (A0.pivot(p, sc(v)), A), anchor: (n, v, d) => (A0.anchor(n, sc(v), d), A), done: () => A0.done() };
    const XR = 267, hw = 24, yT = 26, yB = -14, L = o.calcio || 236;
    // ---- scatola superiore: due fianchi e la parte centrale con la feritoia del pomello
    const bbR = [-4, -40, 272, 30];
    const pR = K.painter(bbR, { w: 1024, h: 512, rough: .62 });
    pR.text('L', S.prod, 92, 8, 4.4); pR.text('L', S.nome + '  ·  ' + S.cal, 92, 1, 3.4, { weight: 'normal' }); pR.text('L', S.paese, 92, -5.5, 3, { weight: 'normal' });
    pR.text('R', S.mat, 96, 6, 3.4);
    for (const [x, y] of [[8, 20], [8, -6], [258, 20], [258, -6], [12, -30], [254, -30], [80, -30], [220, -30]]) pR.pin('LR', x, y, 1.8, { h: .45, a: 1.05 });
    pR.line('LR', [[2, yB], [XR - 2, yB]], .6, { h: -.7, a: .7 });
    pR.text('R', 'S', 178, -24, 2.6); pR.text('R', 'A', 192, -24, 2.6);
    pR.noise({ a: .2, r: .25, seed: 9 }); pR.walls({ r: .6 });
    const mR = K.mat(M.acc, pR.done(2.4), { ns: .85 });
    const profU = [[0, yB, 0], [XR, yB, 0], [XR, yT, 1.5], [0, yT, 1.5]];
    A.add(K.slab(profU, -hw, -3.6, { bL: 1.8, bR: 0, uv: bbR }), mR);
    A.add(K.slab(profU, 3.6, hw, { bL: 0, bR: 1.8, uv: bbR, holes: [[[148, -6, 2], [192, -6, 2], [192, 12, 2], [148, 12, 2]]] }), mR);
    A.add(K.slab([[0, yB], [XR, yB], [XR, yT], [232, yT], [232, 19], [56, 19], [56, yT], [0, yT]], -3.6, 3.6, { b: 0, uv: bbR }), mR);
    // ---- castello inferiore con l'impugnatura (pozzetto), il ponticello rettangolare, la sicura
    const profL = [[1, yB, 0], [XR - 1, yB, 0], [XR - 1, -30, 2], [XR - 9, -38, 3], [9, -38, 3], [1, -30, 2]];
    A.add(K.slab(profL, -hw + .8, hw - .8, { b: 1.6, uv: bbR }), mR);
    A.add(K.slab(profImpugnatura({ x: 114, y: -36, h: 90, ang: gradi(4), d0: 46, d1: 46, rf: 4, rb: 4, alto: 2 }), -16.5, 16.5, { b: 2.4 }), M.st);
    A.add(K.box(82, -127, -6, 92, -119, 6, .8), M.st);
    A.add(K.slab([[134, -36], [198, -36], [198, -42, 2], [194, -82, 4], [140, -82, 4], [134, -76, 2]], -5, 5, { b: 1, holes: [[[142, -40, 1.5], [190, -40, 1.5], [187, -75, 3], [142, -75, 3]]] }), M.st);
    miGrilletto(A, 156, -38, M.st, { L: 23 });
    A.add(K.box(190, -54, -4.5, 200, -45, 4.5, .6), M.st);                                   // sicura sul ponticello
    A.add(K.slab([[168, -20, 2], [184, -20, 2], [184, -27, 2], [168, -27, 2]], hw - .5, hw + 1.8, { b: .5 }), M.st);  // selettore a destra
    miCaricatore(A, { top: [113, -40], L: 172, d0: 34, w: 12, ang: -gradi(4), tex: true, fori: 2, foriPasso: 10, scritta: S.cal, mat: M.st, kind: M.acc });
    // ---- mire fisse con orecchie, canna filettata sporgente, cinghietto davanti
    A.add(K.box(2, yT - 1, -11, 22, yT + 3, 11, 1), M.st);
    for (const z of [-1, 1]) A.add(K.slab([[4, yT + 2], [20, yT + 2], [18, yT + 13, 2], [6, yT + 13, 2]], z > 0 ? 8 : -10.5, z > 0 ? 10.5 : -8, { b: .6 }), M.st);
    A.add(K.slabX([[-8, yT + 2], [8, yT + 2], [8, yT + 11, 1], [-8, yT + 11, 1]], 11, 13, { b: .4, holes: [K.circ(0, yT + 7.5, 1.4, 12)] }), M.st);
    miMirinoOrecchie(A, M.st, 255, yT - 1, { h: 12, hw: 8, L: 14 });
    miCanna(A, M.bar, 250, 292, 10, 4.6);
    A.add(K.latheX([[XR + 1, 10.6], [290, 10.6], [292, 9.8]], { seg: 22 }), matTrama(M.acc, 'ribs', [14, 1], { gira: true }));
    const mStr = K.mat('nero', null, { c: '#232323', r: .9, m: 0 });
    for (const z of [-1, 1]) A.add(K.slab([[236, -10, 0], [256, -10, 0], [256, -44, 6], [236, -44, 6]], z > 0 ? hw - .4 : -hw - 1.2, z > 0 ? hw + 1.2 : -hw + .4, { b: .4 }), mStr);
    A.add(K.box(236, -45.6, -hw - 1.2, 256, -44, hw + 1.2, .5), mStr);
    // ---- otturatore con il pomello in alto (segue l'otturatore)
    A.add(K.box(100, -6.5, 4, 266, 12.5, 21.5, .8), M.bolt, 'otturatore');
    A.add(K.box(156, 2, 20, 186, 5, 21.8, .3), M.dk, 'otturatore');
    A.add(K.box(218, 16, -3.2, 226, 28, 3.2, .5), M.st, 'otturatore');
    const kn = K.latheX([[0, 0], [0, 7.5], [1, 8], [8, 8], [9, 7.2], [9.5, 0]], { seg: 20 }); kn.rotateZ(PI / 2); kn.translate(222, yT + 1, 0);
    A.add(kn, matTrama(M.acc, 'ribs', [3, 1], { gira: true }), 'otturatore');
    A.pivot('otturatore', [222, 0, 0]);
    // ---- calcio a due aste (aperto) con il calciolo ribaltabile
    for (const z of [-1, 1]) A.add(K.rod(-L, 40, 4, { cy: -24, cz: z * 19, seg: 14 }), M.st);
    A.add(K.box(-L - 2, -30, -23, -L + 6, -18, 23, 1.5), M.st);
    A.add(rodZ(-23, 23, 4.5, -L + 2, -24, 14), M.st);
    A.add(K.slabX([[-24, -94, 5], [24, -94, 5], [24, -14, 5], [-24, -14, 5]], -L - 8, -L, { b: 1.8 }), M.st);
    A.add(K.slabX([[-21, -90, 4], [21, -90, 4], [21, -18, 4], [-21, -18, 4]], -L - 11, -L - 7, { b: 1.2 }), M.gom);
    // ---- punti di riferimento
    A.anchor('bocca', [292.5, 0, 0]); A.anchor('espulsione', [170, 3, 24], [0, .3, 1]); A.anchor('impugnatura', [108, -80, 0]); A.anchor('grilletto', [158, -56, 0]);
    A.anchor('appoggio', [246, -40, -8]); A.anchor('mira_post', [12, yT + 11, 0]); A.anchor('mira_ant', [255, yT + 11, 0]); A.anchor('calcio', [-L - 10, -54, 0]);
    const r = A.done();
    r.info = { azione: 'auto', bossolo: 'pistola', ciclo: { otturatore: { dx: -.06 * s }, grilletto: { rz: -.14 } }, ricarica: { caricatore: { dx: -.01 * s, dy: -.15 * s } } };
    return r;
  });
  MAP2[48] = { f: 'mitra_scatola_filo', o: { scala: 1, calcio: 248 } };
  MAP2[49] = { f: 'mitra_scatola_filo', o: { scala: .84, calcio: 332 } };

  // ================================================================ 50: tubo con calcio, impugnatura e impugnatura anteriore in legno
  def('mitra_legno', function (spec, o) {
    const A = K.asm('mitra_legno'), M = miMat(spec), S = miTesti(spec);
    const R = 19, T = 1.4, XR = 300;
    const aS0 = gradi(44), aS1 = gradi(54), aP0 = gradi(68), aP1 = gradi(124);
    const xs = [0, 118, 172, 232, 244, XR], as = giro(gradi(15), [aS0, aS1, aP0, aP1]);
    const pT = miPittoreTubo(0, XR, R, { rough: .4 });
    pT.text('L', S.prod, 132, 4, 3.8); pT.text('L', S.nome + '  ·  ' + S.cal, 132, -2.5, 3, { weight: 'normal' }); pT.text('L', S.paese + '  ' + S.anno, 132, -8, 2.6, { weight: 'normal' });
    pT.text('R', S.mat, 70, -2, 3); pT.noise({ a: .12, r: .2 });
    const mRcv = K.mat(M.acc, pT.done(2.2), { ns: .8 });
    A.add(miLamieraTubo(xs, as, R, T, (i, j) => { const a = (as[j] + as[j + 1]) / 2; if ((i === 1 || i === 2) && a > aS0 && a < aS1) return 'via'; if (i === 2 && a > aP0 && a < aP1) return 'via'; return null; }), mRcv);
    A.add(K.latheX([[-8, 0], [-8, 14], [-6, 18], [-2, 19.6], [3, 19.6], [3.5, 19]], { seg: 28 }), M.st);
    A.add(K.latheX([[XR - 1, 0], [XR - 1, 15], [XR, 16], [XR + 13, 16], [XR + 14, 15], [XR + 14, 10]], { seg: 26 }), K.mat(M.acc, null, { tile: 'knurl', rep: [2, 24], r: .5 }));
    A.add(K.latheX([[XR + 12, 0], [XR + 12, 10.4], [480, 10], [520, 9.4], [520, 4.8]], { seg: 22 }), M.bar);
    A.add(K.discX(515, 0, 0, 4.85, 1, 16), M.dk);
    // mire: diottra in alto dietro, mirino a lama su una fascetta vicino alla bocca
    A.add(K.box(14, R - 3, -7, 38, R + 3, 7, 1), M.st);
    for (const z of [-1, 1]) A.add(K.slab([[16, R + 2], [36, R + 2], [33, R + 13, 2], [19, R + 13, 2]], z > 0 ? 5 : -7, z > 0 ? 7 : -5, { b: .5 }), M.st);
    A.add(K.slabX([[-4.5, R + 2], [4.5, R + 2], [4.5, R + 11, 1.5], [-4.5, R + 11, 1.5]], 25, 27, { b: .4, holes: [K.circ(0, R + 7.5, 1.3, 12)] }), M.st);
    A.add(anello(500, 512, 12, 9.6, { seg: 24 }), M.st);
    A.add(K.slab([[502, 10], [510, 10], [508.5, 22, 1], [503.5, 22, 1]], -1.4, 1.4, { b: .4 }), M.st);
    // ---- fusto d'acciaio, pozzetto, ponticello
    A.add(K.slab([[46, -12], [XR, -12], [XR, -22, 3], [XR - 6, -28, 3], [52, -28, 3], [46, -22, 3]], -11, 11, { b: 1.5 }), M.st);
    A.add(K.slab([[184, -24], [232, -24], [232, -62, 2], [184, -62, 2]], -15, 15, { b: 1.6 }), M.st);
    A.add(K.slab([[104, -26], [176, -26], [176, -32, 3], [166, -62, 10], [116, -62, 10], [106, -48, 5]], -5.4, 5.4, { b: 1, holes: [[[114, -30, 2], [168, -30, 2], [165, -38, 3], [159, -56, 7], [120, -56, 7], [114, -45, 4]]] }), M.st);
    miGrilletto(A, 132, -27, M.st, { L: 21 });
    miCaricatore(A, { top: [208, -28], L: 186, d0: 34, w: 12.5, tex: true, fori: 3, foriPasso: 10, scritta: S.cal, mat: M.st, kind: M.acc });
    // ---- legni: impugnatura, impugnatura anteriore con gli incavi, calcio con calciolo d'acciaio
    const mW = K.mat('legno_noce');
    A.add(miImpugnaturaTonda({ x: 84, y: -27, h: 100, ang: gradi(16), d0: 42, d1: 38, bf: 2, bb: 3, w0: 14, w1: 15, wb: 1 }).g, mW);
    A.add(miImpugnaturaTonda({ x: 268, y: -26, h: 96, ang: gradi(-8), d0: 40, d1: 36, bf: 1, bb: 1.5, dita: 4, dp: 2.6, w0: 14, w1: 15.5, wb: 1 }).g, mW);
    A.add(K.loftX([{ x: -238, t: 3, b: -112, w: 20 }, { x: -226, t: 4, b: -108, w: 20.5 }, { x: -150, t: 6, b: -80, w: 19 }, { x: -80, t: 8, b: -50, w: 16.5 }, { x: -30, t: 10, b: -32, w: 15 }, { x: -6, t: 12, b: -26, w: 14.5 }].map(q => Object.assign({ nt: 2.8, nb: 2.4 }, q)), { K: 30, step: 6 }), mW);
    A.add(K.slab([[-244, -114, 1], [-237, -114, 1], [-237, 5, 1], [-244, 4, 1]], -21, 21, { b: 1.5 }), M.st);
    A.add(K.slab([[-12, -10, 2], [2, -10, 2], [2, -26, 2], [-12, -28, 2]], -14.5, 14.5, { b: 1.2 }), M.st);
    C.put(A, C.swivel(-150, -84, 0, { r: 7 })); C.put(A, C.swivel(506, -14, 0, { r: 7 }));
    // ---- otturatore con la manetta a destra (segue l'otturatore)
    A.add(K.latheX([[96, 0], [96, R - T - .4], [262, R - T - .4], [262, 0]], { seg: 28 }), M.bolt, 'otturatore');
    A.add(K.box(182, -9, R - T - 3.5, 226, -5, R - T - .3, .4), M.dk, 'otturatore');
    const aM = gradi(49), dM = [0, Math.cos(aM), Math.sin(aM)];
    A.add(pomello([226, dM[1] * (R - 1), dM[2] * (R - 1)], dM, { L: 15, rs: 3, rh: 5.5, hl: 7 }), M.st, 'otturatore');
    A.pivot('otturatore', [200, 0, 0]);
    // ---- punti di riferimento
    A.anchor('bocca', [520.5, 0, 0]); A.anchor('espulsione', [202, -6, 20], [0, .1, 1]); A.anchor('impugnatura', [76, -74, 0]); A.anchor('grilletto', [133, -45, 0]);
    A.anchor('appoggio', [262, -74, -6]); A.anchor('mira_post', [26, R + 11, 0]); A.anchor('mira_ant', [506, 22, 0]); A.anchor('calcio', [-244, -55, 0]);
    const r = A.done();
    r.info = { azione: 'auto', bossolo: 'pistola', ciclo: { otturatore: { dx: -.08 }, grilletto: { rz: -.14 } }, ricarica: { caricatore: { dy: -.18 } } };
    return r;
  });
  MAP2[50] = { f: 'mitra_legno', o: {} };

  // ================================================================ 51: scatola compatta, camicia forata corta, impugnatura anteriore, caricatore quadrifilare, calcio ripiegabile sopra
  def('mitra_quadrifilare', function (spec, o) {
    const A = K.asm('mitra_quadrifilare'), M = miMat(spec), S = miTesti(spec);
    const XR = 236, hw = 21;
    const bbR = [-4, -30, 240, 26];
    const pR = K.painter(bbR, { w: 1024, h: 512, rough: .55 });
    pR.text('L', S.prod, 96, 8, 3.8); pR.text('L', S.nome + '  ·  ' + S.cal, 96, 1.5, 3, { weight: 'normal' }); pR.text('L', S.paese, 96, -4.5, 2.6, { weight: 'normal' });
    pR.text('R', S.mat, 90, 6, 3);
    pR.fill('L', K.rrect(126, 5.5, 214, 10.5, 2.5), { h: -1, a: .12, r: .8 });
    pR.line('LR', [[4, -14], [XR - 4, -14]], 2.6, { h: .45, a: 1.04 });
    for (const [x, y] of [[8, 16], [8, -20], [228, 16], [228, -20]]) pR.pin('LR', x, y, 1.7, {});
    pR.noise({ a: .12, r: .18, seed: 10 }); pR.walls({ r: .55 });
    const mR = K.mat(M.acc, pR.done(2.4), { ns: .85 });
    const prof = [[0, -26, 2], [XR, -26, 2], [XR, 22, 2], [0, 22, 5]];
    A.add(K.slab(prof, -hw, 0, { bL: 2.5, bR: 0, uv: bbR }), mR);
    A.add(K.slab(prof, 0, hw, { bL: 0, bR: 2.5, uv: bbR, holes: [[[158, -6, 2], [212, -6, 2], [212, 12, 2], [158, 12, 2]]] }), mR);
    // ---- camicia forata corta
    const XF = 330, RJ = 16, nl = 6, xsJ = []; for (let i = 0; i <= nl; i++) xsJ.push(XR + (XF - XR) * i / nl);
    A.add(miLamieraTubo(xsJ, giro(gradi(30)), RJ, 1.3, (i, j) => (j >= 4 && j <= 7) ? null : { r: 4 }, { hn: 10 }), M.st);
    A.add(K.latheX([[XF - .5, RJ], [XF, RJ + .6], [XF + 5, RJ + .6], [XF + 6, RJ - .5], [XF + 6, 9]], { seg: 28 }), M.st);
    miCanna(A, M.bar, XR - 6, 344, 8.4, 4.6);
    miMirinoOrecchie(A, M.st, 322, RJ - 1, { h: 12, hw: 7 });
    miAlzoL(A, M.st, 18, 21.5, { h: 11, hw: 8 });
    // ---- impugnatura anteriore sotto la camicia
    const mP = matTrama('polimero', 'stipple', [5, 7], { opz: { ns: .5 } });
    A.add(K.slab([[258, -18, 2], [292, -18, 2], [292, -10, 0], [258, -10, 0]], -9, 9, { b: 1.2 }), M.st);
    A.add(miImpugnaturaTonda({ x: 276, y: -16, h: 80, ang: gradi(-10), d0: 30, d1: 28, bf: 1, bb: 1, dita: 3, dp: 1.5, w0: 11, w1: 12, wb: .6 }).g, mP);
    // ---- impugnatura, ponticello, pozzetto largo e caricatore a quattro file
    A.add(miImpugnaturaTonda({ x: 66, y: -25, h: 98, ang: gradi(15), d0: 44, d1: 38, bf: 2, bb: 3.5, w0: 14, w1: 15.5, wb: 1 }).g, mP);
    A.add(K.slab([[84, -24], [152, -24], [152, -30, 3], [144, -64, 12], [96, -66, 10], [86, -52, 6]], -6, 6, { b: 1.4, holes: [[[92, -28, 2], [144, -28, 2], [140, -38, 3], [134, -58, 9], [100, -60, 8], [92, -46, 5]]] }), M.st);
    miGrilletto(A, 112, -26, M.st, { L: 21 });
    A.add(K.slab([[150, -24], [202, -24], [202, -46, 2], [204, -52, 1.5], [148, -52, 1.5], [150, -46, 2]], -19.5, 19.5, { b: 1.6 }), M.st);
    miCaricatore(A, { top: [176, -30], L: 196, d0: 35, w: 16.5, tex: true, fori: 4, foriPasso: 10, scritta: S.cal, mat: M.st, kind: M.acc });
    // ---- otturatore e manetta a sinistra (non segue l'otturatore)
    A.add(K.box(110, -6.5, .5, 234, 12.5, 18.5, .8), M.bolt, 'otturatore');
    A.add(K.box(166, 2, 17, 204, 5, 18.8, .3), M.dk, 'otturatore');
    A.pivot('otturatore', [185, 3, 0]);
    A.add(pomello([208, 8, -hw + .5], [0, 0, -1], { L: 13, rs: 3, rh: 5.4, hl: 6 }), M.st, 'manetta');
    A.pivot('manetta', [208, 8, -hw]);
    // ---- calcio ripiegabile sopra (aperto): cerniera, due bracci piatti, puntone, calciolo
    A.add(K.slab([[-9, 10, 2], [4, 10, 2], [4, 24, 2], [-9, 24, 2]], -17, 17, { b: 1.2 }), M.st);
    A.add(rodZ(-18, 18, 3.4, -3, 17, 14), M.st);
    for (const z of [-1, 1]) A.add(K.slab([[-2, 21, 1], [-2, 13, 1], [-222, 0, 1], [-222, 9, 1]], z > 0 ? 12 : -15, z > 0 ? 15 : -12, { b: .7 }), M.st);
    A.add(K.slab([[-6, -24, 2], [3, -24, 2], [3, -12, 2], [-6, -12, 2]], -9, 9, { b: 1 }), M.st);
    A.add(miFilo([[-218, -78, 0], [-2, -18, 0]], 4, { seg: 10 }), M.st);
    A.add(K.slabX([[-19, -88, 6], [19, -88, 6], [19, 12, 6], [-19, 12, 6]], -232, -222, { b: 2 }), M.st);
    A.add(K.slabX([[-16, -84, 5], [16, -84, 5], [16, 8, 5], [-16, 8, 5]], -235, -231, { b: 1 }), M.gom);
    // ---- punti di riferimento
    A.anchor('bocca', [344.5, 0, 0]); A.anchor('espulsione', [185, 3, 21], [0, .3, 1]); A.anchor('impugnatura', [58, -72, 0]); A.anchor('grilletto', [113, -44, 0]);
    A.anchor('appoggio', [274, -60, -4]); A.anchor('mira_post', [18, 32.5, 0]); A.anchor('mira_ant', [322, RJ + 11, 0]); A.anchor('calcio', [-234, -38, 0]);
    const r = A.done();
    r.info = { azione: 'auto', bossolo: 'pistola', ciclo: { otturatore: { dx: -.06 }, grilletto: { rz: -.14 } }, ricarica: { caricatore: { dy: -.18 } }, armamento: { manetta: { dx: -.08 } } };
    return r;
  });
  MAP2[51] = { f: 'mitra_quadrifilare', o: {} };

  // ================================================================ 53: arma a "proiettile" in polimero, caricatore orizzontale trasparente sopra, mirino ottico a tunnel
  def('mitra_proiettile', function (spec, o) {
    const A = K.asm('mitra_proiettile'), M = miMat(spec), S = miTesti(spec);
    const mPol = K.mat('polimero', null, { r: .6 });
    // ---- corpo: calcio, foro per il pollice, colonna dell'impugnatura, apertura del grilletto e anello anteriore
    const bb = [-4, -132, 482, 14];
    const p = K.painter(bb, { w: 1024, h: 512, rough: .66 });
    p.text('L', S.prod, 262, -10, 4.2); p.text('L', S.nome + '  ·  ' + S.cal, 262, -17, 3.2, { weight: 'normal' });
    p.text('R', S.mat, 262, -12, 3.2); p.text('R', S.paese, 262, -19, 2.6, { weight: 'normal' });
    p.stipple('LR', [[166, -46], [210, -46], [208, -112], [164, -112]], { s: .3, r: .86 });
    p.stipple('LR', [[352, -44], [398, -44], [372, -100], [344, -96]], { s: .3, r: .86 });
    p.line('LR', [[22, -3], [444, -3]], .5, { h: -.5, a: .85 });
    p.noise({ a: .06, r: .1, seed: 14 }); p.walls({ r: .62 });
    const mB = K.mat('polimero', p.done(2.2), { ns: .8 });
    const body = [[10, 10, 8], [470, 10, 3], [478, 4, 3], [478, -14, 4], [452, -24, 8], ['c', 430, -34, 400, -60, 384, -92], [372, -112, 12], [330, -120, 20], [130, -124, 26], [52, -122, 18], ['c', 22, -118, 6, -100, 3, -70], [0, -30, 10]];
    const thumb = []; for (let k = 0; k < 18; k++) { const a = 2 * PI * k / 18; thumb.push([138 + Math.cos(a) * 25, -73 + Math.sin(a) * 30]); }
    const front = [[214, -44, 12], [322, -44, 14], [352, -92, 12], [338, -106, 10], [228, -108, 12], [212, -78, 12]];
    A.add(K.slab(body, -26, 26, { b: 9, bs: 4, uv: bb, holes: [thumb, front] }), mB);
    A.add(K.slab([[-6, 6, 6], [8, 6, 0], [8, -100, 0], [-6, -98, 8]], -24, 24, { b: 5 }), M.gom);
    A.add(K.box(124, -127.6, -11, 154, -125.6, 11, .5), M.dk);                       // espulsione dal basso
    A.add(rodY(-106.6, -103.5, 8, 236, 0, 20), K.mat('polimero', null, { c: '#30302e', r: .5 }));   // selettore a disco sotto il grilletto
    // ---- caricatore orizzontale trasparente con le cartucce di traverso
    const mMag = K.mat('polimero', null, { c: '#3d362f', r: .15, m: .05 }); mMag.transparent = true; mMag.opacity = .55; mMag.depthWrite = false;
    A.add(K.slab([[54, 10, 2], [352, 10, 2], [356, 16, 3], [356, 42, 4], [348, 47, 4], [62, 47, 6], [54, 40, 4]], -24.5, 24.5, { b: 4 }), mMag, 'caricatore');
    const mBr = K.mat('ottone'), mPt = K.mat('grigio', null, { c: '#2a2c2e', r: .4, m: .8 });
    const caseG = K.latheX([[0, 3.6], [.6, 3.9], [21, 3.9], [24, 2.95]], { seg: 6 }), tipG = K.latheX([[23.9, 2.9], [27, 2.85], [35, 1.3], [36.6, 0]], { seg: 6 });
    for (let k = 0; k < 25; k++) for (const row of [0, 1]) {
      const x = 74 + k * 10.9 + row * 5.45, y = row ? 33 : 22;
      A.add(caseG.clone().translate(-18.3, 0, 0).rotateY(-PI / 2).translate(x, y, 0), mBr, 'caricatore');
      A.add(tipG.clone().translate(-18.3, 0, 0).rotateY(-PI / 2).translate(x, y, 0), mPt, 'caricatore');
    }
    A.pivot('caricatore', [200, 28, 0]);
    A.add(K.slab([[44, 10, 1], [58, 10, 1], [58, 24, 2], [46, 22, 2]], -10, 10, { b: 1 }), mPol);
    // ---- mirino ottico a tunnel con le lenti, canna e spegnifiamma
    A.add(K.slabX([[-16, 8, 0], [16, 8, 0], [16, 46, 5], [11, 64, 8], [-11, 64, 8], [-16, 46, 5]], 352, 440, { b: 2.5, holes: [K.circ(0, 44, 9.5, 22)] }), K.mat('polimero', null, { r: .55 }));
    A.add(K.discX(398, 44, 0, 9.6, -1, 24), K.mat('lente')); A.add(K.discX(436, 44, 0, 9.6, 1, 24), K.mat('lente'));
    A.add(K.discX(399, 44, 0, 1.1, -1, 10), K.mat('rosso'));
    A.add(K.latheX([[466, 0], [466, 8.6], [490, 8.6], [490, 0]], { seg: 22 }), M.bar);
    C.put(A, C.muzzle('gabbia', 488, 9.5, { len: 18, mat: K.mat('nero', null, { r: .5 }) }));
    // ---- manette sui due lati (non seguono l'otturatore), grilletto, otturatore interno
    for (const s of [-1, 1]) A.add(pomello([440, -8, s * 24], [0, 0, s], { L: 9, rs: 3, rh: 4.8, hl: 5 }), mPol, 'manetta');
    A.pivot('manetta', [440, -8, 0]);
    miGrilletto(A, 226, -40, mPol, { L: 24, hw: 3.4 });
    A.add(K.box(150, -12, -8, 210, 6, 8, 1), M.bolt, 'otturatore'); A.pivot('otturatore', [180, 0, 0]);
    C.put(A, C.swivel(22, -112, 0, { r: 6 })); C.put(A, C.swivel(466, -18, 0, { r: 6 }));
    // ---- punti di riferimento
    A.anchor('bocca', [506.5, 0, 0]); A.anchor('espulsione', [139, -128, 0], [0, -1, 0]); A.anchor('impugnatura', [186, -76, 0]); A.anchor('grilletto', [228, -60, 0]);
    A.anchor('appoggio', [345, -70, -10]); A.anchor('mira_post', [352, 44, 0]); A.anchor('ottica', [352, 44, 0]); A.anchor('mira_ant', [440, 44, 0]); A.anchor('calcio', [-6, -48, 0]);
    const r = A.done();
    r.info = { azione: 'auto', bossolo: 'pistola', ciclo: { otturatore: { dx: -.03 }, grilletto: { rz: -.12 } }, ricarica: { caricatore: { dx: -.035, dy: .04 } }, armamento: { manetta: { dx: -.06 } } };
    return r;
  });
  MAP2[53] = { f: 'mitra_proiettile', o: {} };

  // ================================================================ 54: arma compatta in polimero, caricatore nell'impugnatura, impugnatura anteriore pieghevole, calcio a due aste
  def('mitra_pdw_polimero', function (spec, o) {
    const A = K.asm('mitra_pdw_polimero'), M = miMat(spec), S = miTesti(spec), hw = 19;
    const bbR = [-4, -30, 348, 24];
    const pR = K.painter(bbR, { w: 1024, h: 512, rough: .66 });
    pR.text('L', S.prod, 96, 4, 3.6); pR.text('L', S.nome + '  ·  ' + S.cal, 96, -3, 2.8, { weight: 'normal' });
    pR.text('R', S.mat, 250, 2, 3);
    pR.stipple('LR', [[214, -4], [298, -4], [298, -22], [214, -22]], { s: .3, r: .86 });
    pR.line('LR', [[6, -10], [320, -10]], .5, { h: -.5, a: .85 });
    pR.noise({ a: .06, r: .1, seed: 15 }); pR.walls({ r: .62 });
    const mR = K.mat('polimero', pR.done(2.2), { ns: .8 }), mP = K.mat('polimero', null, { r: .62 }), mG = matTrama('polimero', 'stipple', [5, 8], { opz: { ns: .5 } });
    const prof = [[0, 20, 4], [316, 20, 6], [338, 10, 6], [344, -4, 4], [334, -16, 6], [300, -26, 8], [60, -26, 8], [0, -14, 6]];
    A.add(K.slab(prof, -hw, 0, { bL: 4, bR: 0, uv: bbR }), mR);
    A.add(K.slab(prof, 0, hw, { bL: 0, bR: 4, uv: bbR, holes: [[[140, -3, 2], [184, -3, 2], [184, 12, 2], [140, 12, 2]]] }), mR);
    C.put(A, C.rail(14, 322, 20));
    miMireSlitta(A, M.nero, 34, 304, 29.4);
    miManettaT(A, M.nero, 0, 15);
    miCanna(A, M.bar, 300, 384, 8, 3.2);
    C.put(A, C.muzzle('obliquo', 380, 9.2, { len: 22, mat: K.mat('nero', null, { r: .5 }) }));
    // ---- impugnatura con il caricatore, ponticello, selettori, impugnatura anteriore aperta
    A.add(miImpugnaturaTonda({ x: 150, y: -24, h: 102, ang: gradi(17), d0: 46, d1: 42, bf: 1.5, bb: 3.5, dita: 3, dp: 1.4, w0: 15, w1: 16, wb: 1 }).g, mG);
    miCaricatore(A, { top: [150, -30], L: 104, d0: 32, w: 10.5, ang: -gradi(17), mat: K.mat('polimero', null, { r: .5 }), piede: 3, hp: 6 });
    A.add(K.slab([[174, -24], [230, -24], [230, -30, 3], [222, -70, 12], [186, -72, 10], [176, -58, 6]], -6.5, 6.5, { b: 1.6, holes: [[[184, -28, 2], [222, -28, 2], [218, -38, 3], [212, -64, 9], [190, -66, 8], [184, -52, 5]]] }), mP);
    miGrilletto(A, 202, -26, M.nero, { L: 21 });
    for (const s of [-1, 1]) A.add(K.slab([[112, -9, 2], [128, -9, 2], [128, -15, 2], [112, -15, 2]], s > 0 ? hw - .5 : -hw - 1.6, s > 0 ? hw + 1.6 : -hw + .5, { b: .5 }), M.nero);
    A.add(K.slab([[262, -22, 2], [290, -22, 2], [290, -30, 2], [262, -30, 2]], -9, 9, { b: 1.2 }), mP);
    A.add(rodZ(-10, 10, 3, 266, -27, 12), M.nero);
    A.add(miImpugnaturaTonda({ x: 276, y: -28, h: 78, ang: gradi(-6), d0: 26, d1: 24, w0: 9.5, w1: 10.5, nf: 3, nr: 3 }).g, mG);
    // ---- otturatore nella finestra
    A.add(K.box(110, -3.5, .5, 240, 12.5, 16.5, .8), M.bolt, 'otturatore'); A.add(K.box(150, 3, 15.5, 176, 6, 16.8, .3), M.dk, 'otturatore');
    A.pivot('otturatore', [162, 4, 0]);
    // ---- calcio a due aste (aperto) con il calciolo
    for (const z of [-1, 1]) A.add(K.rod(-226, 40, 4.5, { cy: -6, cz: z * 16, seg: 14 }), M.nero);
    A.add(K.slab([[-238, 8, 4], [-226, 8, 4], [-226, -70, 6], [-238, -70, 6]], -26, 26, { b: 4 }), mP);
    A.add(K.slab([[-244, 6, 4], [-236, 6, 2], [-236, -68, 2], [-244, -68, 4]], -24, 24, { b: 3 }), M.gom);
    // ---- punti di riferimento
    A.anchor('bocca', [402.5, 0, 0]); A.anchor('espulsione', [162, 4, 19], [0, .3, 1]); A.anchor('impugnatura', [138, -72, 0]); A.anchor('grilletto', [203, -46, 0]);
    A.anchor('appoggio', [272, -64, -4]); A.anchor('mira_post', [34, 42.4, 0]); A.anchor('mira_ant', [304, 46.4, 0]); A.anchor('calcio', [-244, -30, 0]);
    const r = A.done();
    r.info = { azione: 'auto', bossolo: 'pistola', ciclo: { otturatore: { dx: -.05 }, grilletto: { rz: -.13 } }, ricarica: { caricatore: { dx: -.03, dy: -.1 } }, armamento: { manetta: { dx: -.06 } } };
    return r;
  });
  MAP2[54] = { f: 'mitra_pdw_polimero', o: {} };

  // ================================================================ 55: pistola mitragliatrice compatta, ponticello unito all'impugnatura anteriore, calcio laterale
  def('mitra_compatto_impugnatura_anteriore', function (spec, o) {
    const A = K.asm('mitra_compatto_impugnatura_anteriore'), M = miMat(spec), S = miTesti(spec), hw = 17;
    const bbR = [-4, -22, 276, 22];
    const pR = K.painter(bbR, { w: 1024, h: 512, rough: .6 });
    pR.text('L', S.prod + '  ·  ' + S.nome, 104, -6, 3.2); pR.text('L', S.cal + '  ·  ' + S.paese, 104, -12, 2.6, { weight: 'normal' });
    pR.text('R', S.mat, 220, -8, 2.8);
    pR.line('LR', [[4, 2], [262, 2]], .45, { h: -.5, a: .85 });
    pR.noise({ a: .06, r: .1, seed: 16 }); pR.walls({ r: .6 });
    const mR = K.mat('polimero', pR.done(2.2), { ns: .8 }), mP = K.mat('polimero', null, { r: .62 }), mG = matTrama('polimero', 'stipple', [5, 8], { opz: { ns: .5 } });
    const prof = [[0, 18, 3], [266, 18, 3], [272, 10, 3], [272, -12, 3], [264, -18, 3], [0, -18, 3]];
    A.add(K.slab(prof, -hw, 0, { bL: 3, bR: 0, uv: bbR }), mR);
    A.add(K.slab(prof, 0, hw, { bL: 0, bR: 3, uv: bbR, holes: [[[116, -4, 2], [160, -4, 2], [160, 10, 2], [116, 10, 2]]] }), mR);
    C.put(A, C.rail(4, 266, 18));
    miMireSlitta(A, M.nero, 16, 252, 27.4);
    miManettaT(A, M.nero, 0, 8);
    miCanna(A, M.bar, 250, 300, 8.6, 4.6);
    A.add(K.latheX([[284, 0], [284, 9.8], [299, 9.8], [300, 9], [300, 4.8]], { seg: 22 }), matTrama('nero', 'ribs', [8, 1], { gira: true }));
    // ---- fusto: impugnatura con il caricatore, ponticello unito all'impugnatura anteriore
    A.add(K.slab([[40, -12], [252, -12], [252, -20, 3], [246, -24, 3], [46, -24, 3], [40, -20, 3]], -15, 15, { b: 2 }), mP);
    A.add(miImpugnaturaTonda({ x: 94, y: -22, h: 96, ang: gradi(10), d0: 44, d1: 42, bf: 1.5, bb: 3, w0: 15, w1: 15.5, wb: .8 }).g, mG);
    A.add(miImpugnaturaTonda({ x: 216, y: -22, h: 84, ang: gradi(-8), d0: 34, d1: 32, bf: 1, bb: 1, dita: 3, dp: 1.6, w0: 13, w1: 14 }).g, mG);
    A.add(K.slab([[112, -22], [204, -22], [202, -56, 6], [196, -62, 6], [120, -62, 6], [112, -50, 6]], -7, 7, { b: 2, holes: [[[124, -27, 3], [192, -27, 3], [190, -52, 6], [128, -54, 6], [124, -44, 5]]] }), mP);
    miGrilletto(A, 140, -24, M.nero, { L: 22 });
    A.add(rodZ(-17.5, 17.5, 3, 152, -16, 12), M.nero);
    miCaricatore(A, { top: [94, -26], L: 178, d0: 32, w: 11, ang: -gradi(10), mat: K.mat('polimero', null, { c: '#2e2b28', r: .35 }), piede: 2.5 });
    // ---- otturatore nella finestra, calcio laterale scheletrato (aperto)
    A.add(K.box(70, -4.5, .5, 200, 10.5, 14.5, .8), M.bolt, 'otturatore'); A.add(K.box(122, 1.5, 13.5, 154, 4.5, 14.8, .3), M.dk, 'otturatore');
    A.pivot('otturatore', [138, 3, 0]);
    miCalcioScheletro(A, mP, { xa: -2, xb: -214, yt: 14, yb: -14, yt2: 16, yb2: -84, hw: 9 });
    // ---- punti di riferimento
    A.anchor('bocca', [300.5, 0, 0]); A.anchor('espulsione', [138, 3, 17], [0, .3, 1]); A.anchor('impugnatura', [86, -64, 0]); A.anchor('grilletto', [142, -42, 0]);
    A.anchor('appoggio', [210, -64, -4]); A.anchor('mira_post', [16, 40.4, 0]); A.anchor('mira_ant', [252, 44.4, 0]); A.anchor('calcio', [-225, -35, 0]);
    const r = A.done();
    r.info = { azione: 'auto', bossolo: 'pistola', ciclo: { otturatore: { dx: -.05 }, grilletto: { rz: -.13 } }, ricarica: { caricatore: { dx: -.03, dy: -.17 } }, armamento: { manetta: { dx: -.06 } } };
    return r;
  });
  MAP2[55] = { f: 'mitra_compatto_impugnatura_anteriore', o: {} };

  // ================================================================ 56: polimero moderno, pozzetto davanti al ponticello, guardamano a feritoie, calcio laterale con poggiaguancia
  def('mitra_polimero_moderno', function (spec, o) {
    const A = K.asm('mitra_polimero_moderno'), M = miMat(spec), S = miTesti(spec), hw = 19;
    const bbR = [-4, -20, 340, 24];
    const pR = K.painter(bbR, { w: 1024, h: 512, rough: .62 });
    pR.text('L', S.prod, 104, 4, 3.6); pR.text('L', S.nome + '  ·  ' + S.cal, 104, -3, 2.8, { weight: 'normal' });
    pR.text('R', S.mat, 104, 4, 3);
    for (let k = 0; k < 4; k++) pR.fill('LR', K.rrect(232 + k * 14, -11, 241 + k * 14, 5, 4), { h: -1, a: .15, r: .8 });
    pR.fill('L', K.rrect(226, 9.5, 306, 14.5, 2.5), { h: -1, a: .12, r: .8 });
    pR.line('LR', [[6, -8], [222, -8]], .5, { h: -.5, a: .85 });
    pR.noise({ a: .06, r: .1, seed: 17 }); pR.walls({ r: .62 });
    const mR = K.mat('polimero', pR.done(2.2), { ns: .8 }), mP = K.mat('polimero', null, { r: .62 }), mG = matTrama('polimero', 'stipple', [5, 8], { opz: { ns: .5 } });
    const prof = [[0, 20, 4], [332, 20, 3], [336, 12, 3], [336, -12, 4], [328, -16, 3], [0, -16, 3]];
    A.add(K.slab(prof, -hw, 0, { bL: 3.5, bR: 0, uv: bbR }), mR);
    A.add(K.slab(prof, 0, hw, { bL: 0, bR: 3.5, uv: bbR, holes: [[[150, -4, 2], [206, -4, 2], [206, 13, 2], [150, 13, 2]]] }), mR);
    C.put(A, C.rail(6, 330, 20));
    for (const d of ['dx', 'sx']) C.put(A, C.rail(292, 328, hw, { dir: d }));
    miMireSlitta(A, M.nero, 20, 318, 29.4);
    miCanna(A, M.bar, 320, 392, 8.4, 4.6);
    C.put(A, C.muzzle('gabbia', 390, 9.5, { len: 22, mat: K.mat('nero', null, { r: .5 }) }));
    A.add(pomello([300, 12, -hw + .5], [0, 0, -1], { L: 12, rs: 3.4, rh: 5.6, hl: 6 }), M.nero, 'manetta');
    A.pivot('manetta', [300, 12, -hw]);
    // ---- fusto: impugnatura, ponticello, pozzetto svasato, caricatore dritto
    A.add(K.slab([[50, -12], [240, -12], [240, -22, 3], [236, -28, 3], [56, -28, 3], [50, -22, 3]], -16, 16, { b: 2 }), mP);
    A.add(miImpugnaturaTonda({ x: 96, y: -26, h: 106, ang: gradi(18), d0: 46, d1: 40, bf: 1.5, bb: 3.5, dita: 3, dp: 1.6, w0: 15, w1: 16, wb: 1 }).g, mG);
    A.add(K.slab([[118, -26], [184, -26], [184, -32, 3], [176, -74, 12], [130, -76, 10], [120, -62, 6]], -6.5, 6.5, { b: 1.6, holes: [[[128, -30, 2], [176, -30, 2], [172, -40, 3], [166, -68, 9], [134, -70, 8], [128, -56, 5]]] }), mP);
    miGrilletto(A, 146, -28, M.nero, { L: 21 });
    A.add(K.slab([[190, -24], [238, -24], [238, -42, 2], [242, -54, 2], [186, -54, 2], [190, -42, 2]], -15.5, 15.5, { b: 1.6 }), mP);
    miCaricatore(A, { top: [214, -28], L: 188, d0: 33, d1: 34, w: 11.5, mat: K.mat('polimero', null, { c: '#2c2a28', r: .38 }), piede: 2.5 });
    A.add(K.box(110, -4.5, .5, 260, 12.5, 16.5, .8), M.bolt, 'otturatore'); A.add(K.box(160, 2.5, 15.5, 196, 5.5, 16.8, .3), M.dk, 'otturatore');
    A.pivot('otturatore', [178, 4, 0]);
    miCalcioScheletro(A, mP, { xa: -2, xb: -228, yt: 16, yb: -14, yt2: 18, yb2: -94, hw: 11, guancia: true });
    // ---- punti di riferimento
    A.anchor('bocca', [412.5, 0, 0]); A.anchor('espulsione', [178, 4, 19], [0, .3, 1]); A.anchor('impugnatura', [86, -72, 0]); A.anchor('grilletto', [148, -48, 0]);
    A.anchor('appoggio', [270, -24, -10]); A.anchor('mira_post', [20, 42.4, 0]); A.anchor('mira_ant', [318, 46.4, 0]); A.anchor('calcio', [-239, -38, 0]);
    const r = A.done();
    r.info = { azione: 'auto', bossolo: 'pistola', ciclo: { otturatore: { dx: -.06 }, grilletto: { rz: -.13 } }, ricarica: { caricatore: { dy: -.17 } }, armamento: { manetta: { dx: -.07 } } };
    return r;
  });
  MAP2[56] = { f: 'mitra_polimero_moderno', o: {} };

  // ================================================================ 57: polimero con slitta lunga, slitte sul guardamano, caricatore curvo fumé, calcio laterale
  def('mitra_polimero_rotaia', function (spec, o) {
    const A = K.asm('mitra_polimero_rotaia'), M = miMat(spec), S = miTesti(spec), hw = 19;
    const bbR = [-4, -22, 350, 24];
    const pR = K.painter(bbR, { w: 1024, h: 512, rough: .62 });
    pR.text('L', S.prod, 92, 4, 3.6); pR.text('L', S.nome + '  ·  ' + S.cal, 92, -3, 2.8, { weight: 'normal' });
    pR.text('R', S.mat, 100, 4, 3);
    pR.fill('L', K.rrect(196, 3.5, 292, 8.5, 2.5), { h: -1, a: .12, r: .8 });
    pR.line('LR', [[4, 13], [238, 13]], .5, { h: -.5, a: .85 }); pR.stipple('LR', [[24, -4], [140, -4], [140, -14], [24, -14]], { s: .3, r: .86 });
    pR.noise({ a: .06, r: .1, seed: 18 }); pR.walls({ r: .62 });
    const mR = K.mat('polimero', pR.done(2.2), { ns: .8 }), mP = K.mat('polimero', null, { r: .62 }), mG = matTrama('polimero', 'stipple', [5, 8], { opz: { ns: .5 } });
    const prof = [[0, 20, 3], [342, 20, 3], [346, 12, 3], [346, -12, 3], [338, -18, 3], [232, -18, 3], [222, -16, 2], [0, -16, 3]];
    A.add(K.slab(prof, -hw, 0, { bL: 3.5, bR: 0, uv: bbR }), mR);
    A.add(K.slab(prof, 0, hw, { bL: 0, bR: 3.5, uv: bbR, holes: [[[150, -4, 2], [204, -4, 2], [204, 13, 2], [150, 13, 2]]] }), mR);
    C.put(A, C.rail(0, 342, 20));
    for (const d of ['dx', 'sx']) C.put(A, C.rail(264, 338, hw, { dir: d }));
    C.put(A, C.rail(264, 338, 18, { dir: 'giu' }));
    miMireSlitta(A, M.nero, 16, 330, 29.4);
    miCanna(A, M.bar, 330, 382, 8.2, 4.6);
    C.put(A, C.muzzle('gabbia', 380, 9.5, { len: 24, mat: K.mat('nero', null, { r: .5 }) }));
    A.add(pomello([286, 6, -hw + .5], [0, 0, -1], { L: 13, rs: 3.2, rh: 5.4, hl: 6 }), M.nero, 'manetta');
    A.pivot('manetta', [286, 6, -hw]);
    // ---- fusto con l'impugnatura a dorso pieno, ponticello grande, pozzetto svasato
    A.add(K.slab([[40, -12], [234, -12], [234, -24, 3], [228, -30, 3], [46, -30, 3], [40, -22, 3]], -16, 16, { b: 2 }), mP);
    A.add(miImpugnaturaTonda({ x: 90, y: -28, h: 108, ang: gradi(20), d0: 46, d1: 40, bf: 2, bb: 4.5, w0: 15, w1: 16.5, wb: 1.5 }).g, mG);
    A.add(K.slab([[112, -28], [180, -28], [180, -34, 3], [172, -80, 14], [126, -82, 10], [114, -66, 6]], -6.5, 6.5, { b: 1.6, holes: [[[122, -32, 2], [172, -32, 2], [168, -42, 3], [162, -74, 10], [130, -76, 8], [122, -60, 5]]] }), mP);
    miGrilletto(A, 140, -30, M.nero, { L: 21 });
    A.add(K.slab([[184, -26], [232, -26], [232, -44, 2], [238, -58, 2], [180, -58, 2], [184, -44, 2]], -16, 16, { b: 1.8 }), mP);
    miCaricatore(A, { top: [208, -30], L: 186, d0: 33, d1: 35, w: 11.5, curva: 650, mat: K.mat('polimero', null, { c: '#27231f', r: .3 }), piede: 2.5 });
    A.add(K.box(110, -4.5, .5, 256, 12.5, 16.5, .8), M.bolt, 'otturatore'); A.add(K.box(160, 2.5, 15.5, 194, 5.5, 16.8, .3), M.dk, 'otturatore');
    A.pivot('otturatore', [177, 4, 0]);
    miCalcioScheletro(A, mP, { xa: -2, xb: -268, yt: 16, yb: -14, yt2: 16, yb2: -96, hw: 11 });
    // ---- punti di riferimento
    A.anchor('bocca', [404.5, 0, 0]); A.anchor('espulsione', [177, 4, 19], [0, .3, 1]); A.anchor('impugnatura', [80, -76, 0]); A.anchor('grilletto', [142, -50, 0]);
    A.anchor('appoggio', [300, -28, -10]); A.anchor('mira_post', [16, 42.4, 0]); A.anchor('mira_ant', [330, 46.4, 0]); A.anchor('calcio', [-279, -40, 0]);
    const r = A.done();
    r.info = { azione: 'auto', bossolo: 'pistola', ciclo: { otturatore: { dx: -.06 }, grilletto: { rz: -.13 } }, ricarica: { caricatore: { dx: .01, dy: -.16, rz: .1 } }, armamento: { manetta: { dx: -.07 } } };
    return r;
  });
  MAP2[57] = { f: 'mitra_polimero_rotaia', o: {} };

  // ================================================================ 58 e 59: struttura tipo fucile moderno (scatole superiore e inferiore, manetta a T dietro)
  // o.variante: 'napf' (guardamano tondo a feritoie, calcio telescopico) | 'furka' (scatola superiore unica con slitte, calcio laterale)
  def('mitra_ar', function (spec, o) {
    const A = K.asm('mitra_ar'), M = miMat(spec), S = miTesti(spec), apc = o.variante === 'furka', hw = 17;
    const XU = apc ? 330 : 188, xM = apc ? 395 : 418, mAl = K.mat('anod');
    const bbU = [-4, -16, XU + 6, 22];
    const pU = K.painter(bbU, { w: 1024, h: 512, rough: .5 });
    pU.text('L', S.prod, 60, 4, 3.4); pU.text('L', S.nome + '  ·  ' + S.cal, 60, -3, 2.6, { weight: 'normal' });
    pU.text('R', S.mat, apc ? 220 : 40, 2, 2.8);
    if (apc) for (let k = 0; k < 4; k++) pU.fill('LR', K.rrect(176 + k * 22, -10, 190 + k * 22, -3, 3), { h: -1, a: .15, r: .8 });
    pU.noise({ a: .1, r: .14, seed: 19 }); pU.walls({ r: .5 });
    const mU = K.mat('anod', pU.done(2.2), { ns: .8 });
    const profU = apc ? [[0, 18, 2], [XU, 18, 2], [XU + 4, 10, 2], [XU + 4, -10, 3], [XU - 6, -14, 2], [0, -12, 2]] : [[0, 18, 2], [XU, 18, 2], [XU, -12, 2], [0, -12, 2]];
    A.add(K.slab(profU, -hw, 0, { bL: 1.6, bR: 0, uv: bbU }), mU);
    A.add(K.slab(profU, 0, hw, { bL: 0, bR: 1.6, uv: bbU, holes: [[[86, -3, 2], [150, -3, 2], [150, 11, 2], [86, 11, 2]]] }), mU);
    A.add(K.box(87, -19, hw + .2, 149, -4, hw + 1.6, .3), mAl);                       // coperchio della finestra aperto
    if (!apc) A.add(K.slab([[70, 6, 1], [84, 6, 1], [84, 15, 2], [74, 15, 2]], hw - 1, hw + 4, { b: 1 }), mAl);   // deflettore dei bossoli
    miManettaT(A, M.nero, 0, 13);
    if (apc) { C.put(A, C.rail(0, XU, 18)); for (const d of ['dx', 'sx']) C.put(A, C.rail(236, XU - 4, hw, { dir: d })); C.put(A, C.rail(250, XU - 8, 14, { dir: 'giu' })); }
    else {
      C.put(A, C.rail(2, 372, 18));
      const bbH = [184, -24, 380, 22];
      const pH = K.painter(bbH, { w: 1024, h: 256, rough: .5 });
      for (let k = 0; k < 4; k++) for (const y of [-2, -13]) { const x = 202 + k * 40 + (y < -5 ? 20 : 0); pH.fill('LR', K.rrect(x, y - 3.4, x + 24, y + 3.4, 3.3), { h: -1, a: .12, r: .8 }); }
      pH.noise({ a: .08, r: .12, seed: 20 }); pH.walls({ r: .5 });
      A.add(K.slab([[188, 18, 1], [372, 18, 1], [376, 12, 3], [376, -16, 6], [370, -21, 4], [188, -21, 3]], -19.5, 19.5, { b: 5, bs: 4, uv: bbH }), K.mat('anod', pH.done(2.2), { ns: .8 }));
    }
    miCanna(A, M.bar, XU - 10, apc ? 374 : 398, 8.2, 4.6);
    C.put(A, C.muzzle(apc ? 'obliquo' : 'gabbia', apc ? 372 : 396, apc ? 9.5 : 10.5, { len: apc ? 23 : 22, mat: K.mat('nero', null, { r: .5 }) }));
    miMireSlitta(A, M.nero, 12, apc ? 318 : 360, 27.4);
    // ---- scatola inferiore: pozzetto svasato, impugnatura, ponticello, comandi
    const mL = apc ? K.mat('polimero', null, { r: .6 }) : mAl;
    A.add(K.slab([[4, -12], [186, -12], [186, -22, 3], [180, -28, 3], [10, -28, 3], [4, -22, 3]], -16, 16, { b: 2 }), mL);
    A.add(K.slab([[118, -24], [164, -24], [164, -40, 2], [168, -52, 2], [114, -52, 2], [118, -40, 2]], -15.5, 15.5, { b: 1.6 }), mL);
    A.add(miImpugnaturaTonda({ x: 62, y: -26, h: 96, ang: gradi(24), d0: 40, d1: 36, bf: 1.5, bb: 4.5, dita: apc ? 3 : 0, dp: 1.4, w0: 14, w1: 15, wb: 1 }).g, matTrama('polimero', 'stipple', [5, 8], { opz: { ns: .5 } }));
    A.add(K.slab([[82, -26], [118, -26], [118, -32, 2], [112, -60, 6], [86, -60, 6], [82, -54, 3]], -5, 5, { b: 1, holes: [[[88, -30, 2], [112, -30, 2], [108, -54, 4], [88, -54, 4]]] }), mL);
    miGrilletto(A, 98, -27, M.nero, { L: 20 });
    A.add(K.slab([[56, -15, 2], [72, -15, 2], [74, -21, 2], [54, -21, 2]], -19, -16, { b: .5 }), M.nero);
    A.add(K.slab([[106, -17, 1], [116, -17, 1], [116, -26, 1], [106, -26, 1]], -18, -16, { b: .4 }), M.nero);
    A.add(rodZ(16, 19, 3.6, 110, -36, 12), M.nero);
    miCaricatore(A, { top: [141, -28], L: apc ? 176 : 180, d0: 33, d1: apc ? 33 : 34.5, w: 11.5, curva: apc ? 0 : 900, mat: K.mat('polimero', null, apc ? { c: '#2e2b28', r: .35 } : { r: .55 }), piede: 2.5 });
    A.add(K.box(60, -3.5, .5, 180, 11.5, 14.5, .8), M.bolt, 'otturatore'); A.add(K.box(100, 2, 13.5, 136, 5, 14.8, .3), M.dk, 'otturatore');
    A.pivot('otturatore', [118, 4, 0]);
    // ---- calcio: laterale scheletrato (furka) o telescopico su tubo (napf)
    if (apc) miCalcioScheletro(A, mL, { xa: -2, xb: -202, yt: 14, yb: -14, yt2: 16, yb2: -86, hw: 10 });
    else {
      A.add(K.slab([[-10, 12, 2], [2, 12, 2], [2, -14, 2], [-10, -14, 2]], -16, 16, { b: 1.5 }), mAl);
      A.add(K.rod(-150, -8, 10.5, { cy: -2, seg: 22 }), mAl);
      A.add(K.slab([[-118, 14, 4], [-186, 14, 6], [-192, 8, 3], [-192, -82, 6], [-178, -84, 6], [-130, -22, 20], [-118, -16, 4]], -17, 17, { b: 5 }), K.mat('polimero', null, { r: .6 }));
      A.add(K.slab([[-200, 12, 3], [-191, 12, 2], [-191, -82, 2], [-200, -82, 4]], -18, 18, { b: 3 }), M.gom);
    }
    // ---- punti di riferimento
    A.anchor('bocca', [xM + .5, 0, 0]); A.anchor('espulsione', [118, 4, 17], [0, .3, 1]); A.anchor('impugnatura', [52, -70, 0]); A.anchor('grilletto', [99, -44, 0]);
    A.anchor('appoggio', [apc ? 280 : 290, -26, -10]); A.anchor('mira_post', [12, 40.4, 0]); A.anchor('mira_ant', [apc ? 318 : 360, 44.4, 0]); A.anchor('calcio', [apc ? -213 : -200, -35, 0]);
    const r = A.done();
    r.info = { azione: 'auto', bossolo: 'pistola', ciclo: { otturatore: { dx: -.07 }, grilletto: { rz: -.13 } }, ricarica: { caricatore: { dy: -.17 } }, armamento: { manetta: { dx: -.06 } } };
    return r;
  });
  MAP2[58] = { f: 'mitra_ar', o: { variante: 'napf' } };
  MAP2[59] = { f: 'mitra_ar', o: { variante: 'furka' } };

  // ================================================================ 60: scatola squadrata in polimero con slitte, ponticello grande, manetta in alto a sinistra
  def('mitra_scatola_polimero', function (spec, o) {
    const A = K.asm('mitra_scatola_polimero'), M = miMat(spec), S = miTesti(spec), hw = 24;
    const bbR = [-4, -34, 400, 26];
    const pR = K.painter(bbR, { w: 1024, h: 512, rough: .64 });
    pR.text('L', S.prod, 110, 4, 4); pR.text('L', S.nome + '  ·  ' + S.cal, 110, -4, 3, { weight: 'normal' });
    pR.text('R', S.mat, 120, 4, 3.2);
    pR.fill('L', K.rrect(256, 11.5, 360, 16.5, 2.5), { h: -1, a: .12, r: .8 });
    for (let k = 0; k < 6; k++) pR.fill('LR', K.rrect(290 + k * 15, -25, 298 + k * 15, -13, 3), { h: -.9, a: .3 });
    pR.line('LR', [[6, -17], [270, -17]], .5, { h: -.5, a: .85 }); pR.stipple('LR', [[30, -6], [150, -6], [150, -14], [30, -14]], { s: .3, r: .86 });
    pR.noise({ a: .06, r: .1, seed: 21 }); pR.walls({ r: .64 });
    const mR = K.mat('polimero', pR.done(2.2), { ns: .8 }), mP = K.mat('polimero', null, { r: .62 }), mG = matTrama('polimero', 'stipple', [5, 8], { opz: { ns: .5 } });
    const prof = [[0, 22, 4], [392, 22, 3], [396, 14, 3], [396, -14, 4], [388, -30, 4], [0, -28, 4]];
    A.add(K.slab(prof, -hw, 0, { bL: 4, bR: 0, uv: bbR }), mR);
    A.add(K.slab(prof, 0, hw, { bL: 0, bR: 4, uv: bbR, holes: [[[176, -4, 2], [236, -4, 2], [236, 14, 2], [176, 14, 2]]] }), mR);
    C.put(A, C.rail(36, 384, 22));
    for (const d of ['dx', 'sx']) C.put(A, C.rail(300, 382, hw, { dir: d }));
    C.put(A, C.rail(300, 382, 30, { dir: 'giu' }));
    miCanna(A, M.bar, 380, 440, 9.6, 5.8);
    A.add(anello(426, 440, 11.2, 6, { seg: 24 }), M.nero);
    miTamburo(A, M.nero, 50, 31.4, { R: 8, h: 9 });
    miMirinoAnello(A, M.nero, 372, 31.4, { R: 8.5, L: 9, alto: 13 });
    A.add(pomello([352, 14, -hw + .5], v3.nrm([0, .25, -1]), { L: 14, rs: 3.2, rh: 5.4, hl: 6 }), M.nero, 'manetta');
    A.pivot('manetta', [352, 14, -hw]);
    // ---- impugnatura, ponticello grande, pozzetto, caricatore dritto fumé
    A.add(miImpugnaturaTonda({ x: 118, y: -26, h: 112, ang: gradi(16), d0: 46, d1: 42, bf: 1.5, bb: 3.5, w0: 15, w1: 16, wb: 1 }).g, mG);
    A.add(K.slab([[136, -26], [212, -26], [212, -32, 3], [200, -84, 14], [150, -88, 12], [138, -70, 8]], -7, 7, { b: 2, holes: [[[146, -31, 3], [202, -31, 3], [194, -76, 10], [154, -80, 10], [146, -64, 6]]] }), mP);
    miGrilletto(A, 168, -28, M.nero, { L: 23 });
    A.add(K.slab([[214, -26], [266, -26], [266, -44, 2], [270, -56, 2], [210, -56, 2], [214, -44, 2]], -17, 17, { b: 1.8 }), mP);
    miCaricatore(A, { top: [240, -30], L: 178, d0: 37, w: 13, mat: K.mat('polimero', null, { c: '#2e2b28', r: .35 }), piede: 2.5 });
    A.add(K.box(130, -4.5, .5, 290, 14.5, 21.5, .8), M.bolt, 'otturatore'); A.add(K.box(186, 3, 20.5, 226, 6, 21.8, .3), M.dk, 'otturatore');
    A.pivot('otturatore', [206, 5, 0]);
    miCalcioScheletro(A, mP, { xa: -2, xb: -250, yt: 18, yb: -18, yt2: 18, yb2: -100, hw: 12 });
    // ---- punti di riferimento
    A.anchor('bocca', [440.5, 0, 0]); A.anchor('espulsione', [206, 5, 24], [0, .3, 1]); A.anchor('impugnatura', [106, -78, 0]); A.anchor('grilletto', [170, -50, 0]);
    A.anchor('appoggio', [320, -36, -12]); A.anchor('mira_post', [49, 41, 0]); A.anchor('mira_ant', [372, 46, 0]); A.anchor('calcio', [-261, -42, 0]);
    const r = A.done();
    r.info = { azione: 'auto', bossolo: 'pistola', ciclo: { otturatore: { dx: -.07 }, grilletto: { rz: -.13 } }, ricarica: { caricatore: { dy: -.16 } }, armamento: { manetta: { dx: -.09 } } };
    return r;
  });
  MAP2[60] = { f: 'mitra_scatola_polimero', o: {} };

  // ================================================================ 61: canna bassa, castello davanti inclinato con il carrello che scende, caricatore inclinato in avanti
  def('mitra_otturatore_discendente', function (spec, o) {
    const A = K.asm('mitra_otturatore_discendente'), M = miMat(spec), S = miTesti(spec), hw = 22;
    const bbR = [-4, -86, 346, 36];
    const pR = K.painter(bbR, { w: 1024, h: 512, rough: .62 });
    pR.text('L', S.prod, 96, 12, 3.8); pR.text('L', S.nome + '  ·  ' + S.cal, 96, 5, 3, { weight: 'normal' });
    pR.text('R', S.mat, 110, 12, 3);
    pR.fill('L', K.rrect(236, 11.5, 320, 16.5, 2.5), { h: -1, a: .12, r: .8 });
    pR.line('LR', [[2, -8], [188, -8], [230, -22]], .5, { h: -.55, a: .8 });
    pR.line('LR', [[298, -16], [262, -70]], .5, { h: -.55, a: .8 });
    pR.stipple('LR', [[218, -30], [270, -30], [254, -70], [212, -70]], { s: .3, r: .86 });
    pR.noise({ a: .06, r: .1, seed: 22 }); pR.walls({ r: .62 });
    const mR = K.mat('polimero', pR.done(2.2), { ns: .8 }), mP = K.mat('polimero', null, { r: .62 }), mG = matTrama('polimero', 'stipple', [5, 8], { opz: { ns: .5 } });
    const prof = [[0, 32, 3], [334, 32, 3], [342, 26, 3], [342, -12, 3], [304, -14, 4], ['c', 292, -32, 272, -60, 258, -78], [254, -82, 2], [200, -82, 2], [196, -76, 2], [196, -44, 4], [140, -38, 3], [40, -34, 6], [0, -24, 4]];
    A.add(K.slab(prof, -hw, 0, { bL: 3.5, bR: 0, uv: bbR }), mR);
    A.add(K.slab(prof, 0, hw, { bL: 0, bR: 3.5, uv: bbR, holes: [[[214, -6, 2], [262, -6, 2], [262, 14, 2], [214, 14, 2]]] }), mR);
    C.put(A, C.rail(8, 332, 32));
    miMireSlitta(A, M.nero, 24, 318, 41.4);
    miCanna(A, M.bar, 320, 382, 8.4, 5.8);
    C.put(A, C.muzzle('gabbia', 380, 10, { len: 24, mat: K.mat('nero', null, { r: .5 }) }));
    A.add(pomello([312, 14, -hw + .5], [0, 0, -1], { L: 13, rs: 3.2, rh: 5.4, hl: 6 }), M.nero, 'manetta');
    A.pivot('manetta', [312, 14, -hw]);
    // ---- impugnatura, ponticello, caricatore inclinato in avanti nel suo pozzetto svasato
    A.add(miImpugnaturaTonda({ x: 104, y: -34, h: 104, ang: gradi(20), d0: 44, d1: 40, bf: 1.5, bb: 4, w0: 15, w1: 16, wb: 1 }).g, mG);
    A.add(K.slab([[132, -36], [198, -36], [198, -84, 3], [190, -88, 4], [146, -88, 6], [134, -74, 8]], -6.5, 6.5, { b: 1.6, holes: [[[142, -42, 3], [190, -42, 3], [190, -80, 4], [148, -80, 6], [142, -66, 5]]] }), mP);
    miGrilletto(A, 166, -38, M.nero, { L: 22 });
    const aMg = gradi(12);
    A.add(K.xf(K.slab([[-26, 4], [26, 4], [28, -12, 2], [-28, -12, 2]], -16, 16, { b: 2 }), { r: [0, 0, aMg], t: [228, -78, 0] }), mP);
    miCaricatore(A, { top: [226, -66], L: 128, d0: 32, w: 12.5, ang: aMg, mat: K.mat('polimero', null, { r: .5 }), piede: 3 });
    // ---- carrello dell'otturatore (scende in diagonale nel castello)
    A.add(K.box(200, -7, .5, 280, 15, 19.5, .8), M.bolt, 'otturatore'); A.add(K.box(222, 2, 18.5, 256, 5, 20, .3), M.dk, 'otturatore');
    A.pivot('otturatore', [240, 4, 0]);
    // ---- calcio su tubo con l'adattatore pieghevole
    A.add(K.slab([[-14, 20, 3], [2, 20, 3], [2, -20, 3], [-14, -20, 3]], -16, 16, { b: 2 }), mP);
    A.add(K.rod(-150, -12, 14.5, { cy: 4, seg: 24 }), M.nero);
    A.add(K.slab([[-118, 22, 4], [-206, 22, 6], [-212, 16, 3], [-212, -70, 6], [-198, -72, 8], [-150, -24, 24], [-118, -12, 4]], -18, 18, { b: 5 }), mP);
    A.add(K.slab([[-220, 20, 3], [-210, 20, 2], [-210, -70, 2], [-220, -70, 4]], -19, 19, { b: 3 }), M.gom);
    // ---- punti di riferimento
    A.anchor('bocca', [404.5, 0, 0]); A.anchor('espulsione', [238, 4, 22], [0, .3, 1]); A.anchor('impugnatura', [94, -80, 0]); A.anchor('grilletto', [168, -58, 0]);
    A.anchor('appoggio', [272, -44, -12]); A.anchor('mira_post', [24, 54.4, 0]); A.anchor('mira_ant', [318, 58.4, 0]); A.anchor('calcio', [-220, -25, 0]);
    const r = A.done();
    r.info = { azione: 'auto', bossolo: 'pistola', ciclo: { otturatore: { dx: -.022, dy: -.03 }, grilletto: { rz: -.13 } }, ricarica: { caricatore: { dx: .027, dy: -.125 } }, armamento: { manetta: { dx: -.07 } } };
    return r;
  });
  MAP2[61] = { f: 'mitra_otturatore_discendente', o: {} };

  // ================================================================ 62: compatto con scatola superiore in alluminio e fusto in polimero, senza calcio (piastra posteriore)
  def('mitra_compatto_alluminio', function (spec, o) {
    const A = K.asm('mitra_compatto_alluminio'), M = miMat(spec), S = miTesti(spec), hw = 17;
    const bbU = [-10, -22, 314, 22];
    const pU = K.painter(bbU, { w: 1024, h: 512, rough: .5 });
    pU.text('L', S.prod, 76, 4, 3.4); pU.text('L', S.nome + '  ·  ' + S.cal, 76, -3, 2.6, { weight: 'normal' });
    pU.text('R', S.mat, 60, 2, 2.8);
    for (let k = 0; k < 3; k++) for (const y of [-2, -12]) { const x = 188 + k * 36 + (y < -5 ? 14 : 0); pU.fill('LR', K.rrect(x, y - 3, x + 24, y + 3, 3), { h: -1, a: .12, r: .8 }); }
    pU.fill('L', K.rrect(186, 3.5, 268, 8.5, 2.5), { h: -1, a: .12, r: .8 });
    pU.noise({ a: .1, r: .14, seed: 23 }); pU.walls({ r: .5 });
    const mU = K.mat('anod', pU.done(2.2), { ns: .8 }), mP = K.mat('polimero', null, { r: .62 }), mG = matTrama('polimero', 'stipple', [5, 8], { opz: { ns: .5 } });
    const prof = [[0, 18, 2], [306, 18, 2], [310, 12, 2], [310, -14, 3], [302, -18, 2], [176, -18, 2], [170, -12, 2], [0, -12, 2]];
    A.add(K.slab(prof, -hw, 0, { bL: 1.8, bR: 0, uv: bbU }), mU);
    A.add(K.slab(prof, 0, hw, { bL: 0, bR: 1.8, uv: bbU, holes: [[[118, -3, 2], [168, -3, 2], [168, 11, 2], [118, 11, 2]]] }), mU);
    C.put(A, C.rail(4, 306, 18));
    miMireSlitta(A, M.nero, 14, 296, 27.4);
    miCanna(A, M.bar, 296, 350, 8.4, 4.6);
    C.put(A, C.muzzle('gabbia', 348, 9.5, { len: 22, mat: K.mat('nero', null, { r: .5 }) }));
    A.add(K.slab([[-9, 16, 2], [2, 16, 2], [2, -12, 2], [-9, -12, 2]], -16, 16, { b: 2 }), K.mat('anod'));
    C.put(A, C.swivel(-12, 2, 0, { r: 7, t: 1.6 }));
    A.add(pomello([262, 6, -hw + .5], [0, 0, -1], { L: 12, rs: 3.2, rh: 5.2, hl: 6 }), M.nero, 'manetta');
    A.pivot('manetta', [262, 6, -hw]);
    // ---- fusto in polimero: impugnatura, ponticello, pozzetto svasato, caricatore curvo
    A.add(K.slab([[30, -10], [176, -10], [176, -20, 3], [170, -26, 3], [36, -26, 3], [30, -20, 3]], -15.5, 15.5, { b: 2 }), mP);
    A.add(miImpugnaturaTonda({ x: 78, y: -24, h: 104, ang: gradi(18), d0: 44, d1: 40, bf: 1.5, bb: 3.5, dita: 3, dp: 1.4, w0: 15, w1: 15.5, wb: .8 }).g, mG);
    A.add(K.slab([[96, -24], [164, -24], [164, -30, 3], [156, -68, 10], [108, -70, 8], [98, -56, 6]], -6.5, 6.5, { b: 1.6, holes: [[[106, -28, 2], [156, -28, 2], [152, -38, 3], [146, -62, 8], [112, -64, 7], [106, -50, 5]]] }), mP);
    miGrilletto(A, 124, -26, M.nero, { L: 21 });
    A.add(K.slab([[166, -22], [214, -22], [214, -40, 2], [218, -52, 2], [162, -52, 2], [166, -40, 2]], -15, 15, { b: 1.6 }), mP);
    miCaricatore(A, { top: [190, -26], L: 182, d0: 33, d1: 35, w: 11.5, curva: 600, mat: K.mat('polimero', null, { r: .5 }), piede: 2.5 });
    A.add(K.box(80, -3.5, .5, 220, 11.5, 14.5, .8), M.bolt, 'otturatore'); A.add(K.box(126, 2, 13.5, 160, 5, 14.8, .3), M.dk, 'otturatore');
    A.pivot('otturatore', [143, 4, 0]);
    // ---- punti di riferimento (niente calcio)
    A.anchor('bocca', [370.5, 0, 0]); A.anchor('espulsione', [143, 4, 17], [0, .3, 1]); A.anchor('impugnatura', [70, -72, 0]); A.anchor('grilletto', [126, -46, 0]);
    A.anchor('appoggio', [250, -24, -10]); A.anchor('mira_post', [14, 40.4, 0]); A.anchor('mira_ant', [296, 44.4, 0]);
    const r = A.done();
    r.info = { azione: 'auto', bossolo: 'pistola', ciclo: { otturatore: { dx: -.06 }, grilletto: { rz: -.13 } }, ricarica: { caricatore: { dx: .01, dy: -.16, rz: .1 } }, armamento: { manetta: { dx: -.07 } } };
    return r;
  });
  MAP2[62] = { f: 'mitra_compatto_alluminio', o: {} };
})();
