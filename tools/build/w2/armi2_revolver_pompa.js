// Revolver (doppia azione con tamburo basculante, singola azione con sportellino, canna bassa che spara dalla camera
// inferiore) e fucili a canna liscia calibro 12 (pompa, semiautomatici, doppio funzionamento, bullpup a due serbatoi).
// Kit v2: misure in mm, X avanti, Y su, Z verso il lato destro.
// Revolver: x = 0 faccia posteriore del tamburo, y = 0 asse della canna.
// Fucili: x = 0 retro della scatola di culatta, y = 0 asse della canna.
window.FAM2 = window.FAM2 || {}; window.MAP2 = window.MAP2 || {};
(function () {
  const K = WK2, T = THREE, PI = Math.PI;

  // ================================================================== utilità comuni del gruppo
  // sigla del produttore di fantasia (iniziali delle parole, "&" conservata)
  function rp_sigla(s) { return (s || '').split(/\s+/).filter(w => /^[A-ZÀ-Ý&]/.test(w)).map(w => w === '&' ? '&' : w[0]).join(''); }
  // calibro breve dalla voce del catalogo: "9×33 mm R (.357)" -> ".357"
  function rp_cal(spec) { const m = /\(([^)]+)\)/.exec(spec.calibro || ''); return m ? m[1] : (spec.calibro || '').toUpperCase(); }
  function rp_matr(spec, pre) { const n = ((spec.id || 1) * 7919 + 13457) % 900000 + 100000; return (pre || '') + n; }
  function rp_up(s) { return (s || '').toUpperCase(); }
  // acciaio secondo la finitura del catalogo
  function rp_acc(fin, det, o) {
    o = Object.assign({}, o || {});
    if (fin === 'inox') return K.mat('inox', det, Object.assign({ r: .3 }, o));
    if (fin === 'nera') return K.mat('nero', det, o);
    if (fin === 'parker') return K.mat('parker', det, o);
    return K.mat('brunito', det, o);
  }
  // trasforma i punti di un percorso (anche i punti di controllo delle curve)
  function rp_tp(path, f) {
    return path.map(p => {
      if (typeof p[0] !== 'string') { const q = f(p[0], p[1]); return [q[0], q[1]].concat(p.slice(2)); }
      if (p[0] === 'c') { const a = f(p[1], p[2]), b = f(p[3], p[4]), c = f(p[5], p[6]); return ['c', a[0], a[1], b[0], b[1], c[0], c[1]]; }
      if (p[0] === 'q') { const a = f(p[1], p[2]), c = f(p[3], p[4]); return ['q', a[0], a[1], c[0], c[1]]; }
      return p;
    });
  }
  // contorno rientrato di d (mm) di un percorso chiuso (per i bordi lisci delle quadrettature)
  function rp_inset(path, d) {
    const P = K.P2(path), n = P.length; let A = 0;
    for (let i = 0; i < n; i++) { const p = P[i], q = P[(i + 1) % n]; A += p[0] * q[1] - q[0] * p[1]; }
    const sg = A > 0 ? 1 : -1, out = [];
    for (let i = 0; i < n; i++) {
      const a = P[(i + n - 1) % n], b = P[(i + 1) % n]; let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      out.push([P[i][0] - ty * d * sg, P[i][1] + tx * d * sg]);
    }
    return out;
  }
  // legno con i dettagli del pittore (quadrettatura, bordi): la venatura viene moltiplicata nella trama del colore
  function rp_legno(p, kind, k, ns) {
    const det = p.done(k || 2.0), w = K.wood(kind || 'noce'), c = det.canvases.ac, x = c.getContext('2d');
    x.save(); x.globalCompositeOperation = 'multiply'; x.fillStyle = 'rgb(196,176,160)'; x.fillRect(0, 0, c.width, c.height); x.drawImage(w.map.image, 0, 0, c.width, c.height); x.restore();
    const m = new T.MeshStandardMaterial({ map: det.map, normalMap: det.normalMap, normalScale: new T.Vector2(ns || .9, ns || .9), roughnessMap: det.roughnessMap, roughness: 1, metalness: 0, envMapIntensity: .75 });
    m.userData.kind = 'legno_' + (kind || 'noce');
    return m;
  }
  // superficie chiusa attorno a un asse parallelo a X (y = cy, z = 0); rf(x, a) = raggio, a = angolo (0 = +z, PI/2 = +y)
  function rp_giro(xs, angs, rf, cy, ang) {
    const pos = [], uv = [], nA = angs.length, nx = xs.length, P = [];
    for (let i = 0; i < nx; i++) { const row = []; for (let j = 0; j < nA; j++) { const a = angs[j], r = rf(xs[i], a); row.push([xs[i], cy + Math.sin(a) * r, Math.cos(a) * r]); } P.push(row); }
    for (let i = 0; i < nx - 1; i++) for (let j = 0; j < nA; j++) {
      const j1 = (j + 1) % nA, a = P[i][j], b = P[i + 1][j], c = P[i + 1][j1], d = P[i][j1];
      pos.push(...a, ...b, ...c, ...a, ...c, ...d);
      const u0 = i / (nx - 1), u1 = (i + 1) / (nx - 1), v0 = .1 + .9 * j / nA, v1 = .1 + .9 * (j + 1) / nA;
      uv.push(u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1);
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    return K.crease(g, ang || 40, { edge: true });
  }
  // restringe in Z la parte alta di un pezzo estruso (ponte superiore più stretto dei fianchi), poi ricalcola normali e usura
  function rp_rastrema(geo, y0, y1, k, ang) {
    const p = geo.attributes.position.array;
    for (let i = 0; i < p.length; i += 3) { let t = (p[i + 1] - y0) / (y1 - y0); t = Math.max(0, Math.min(1, t)); t = t * t * (3 - 2 * t); p[i + 2] *= 1 - k * t; }
    geo.attributes.position.needsUpdate = true; geo.deleteAttribute('normal');
    return K.crease(geo, ang || 38, { edge: true, zcap: true });
  }
  // punto a frazione t (0..1, per lunghezza) lungo una spezzata
  function rp_lungo(pts, t) {
    let L = 0; const acc = [0]; for (let i = 1; i < pts.length; i++) { L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); acc.push(L); }
    const s = Math.max(0, Math.min(1, t)) * L; let i = 1; while (i < pts.length - 1 && acc[i] < s) i++;
    const a = pts[i - 1], b = pts[i], k = (s - acc[i - 1]) / Math.max(1e-9, acc[i] - acc[i - 1]); return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  }
  // impugnatura avvolgente (gomma) da due contorni: davanti (dal ponticello al fondo) e dietro (dalla gobba del telaio al tallone);
  // dita = profondità degli incavi per le dita (mm), w(t) = mezza larghezza
  function rp_impGomma(front, back, o) {
    const n = o.n || 22, st = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, f0 = rp_lungo(front, t), b0 = rp_lungo(back, t);
      const fing = o.dita && t > .12 && t < .9 ? Math.pow(Math.abs(Math.sin(PI * (t - .12) / (.78 / 3))), .75) * o.dita : 0;
      const dx = f0[0] - b0[0], dy = f0[1] - b0[1], d = Math.hypot(dx, dy), ux = dx / d, uy = dy / d;
      const fp = [f0[0] - ux * fing, f0[1] - uy * fing], c = [(fp[0] + b0[0]) / 2, (fp[1] + b0[1]) / 2], h = Math.hypot(fp[0] - b0[0], fp[1] - b0[1]) / 2;
      const end = t > .93 ? Math.sqrt(Math.max(.05, 1 - Math.pow((t - .93) / .07, 2))) : 1;
      st.push({ p: c, f: h * (o.hf || 1), r: h * (o.hr || 1), w: o.w(t) * (.55 + .45 * end), nf: o.nf || 2.3, nr: o.nr || 2.5 });
    }
    return K.loftS(st, { K: o.K || 28, sub: 2 });
  }
  // disco o pomello rivolto verso +Z (dir 1) o -Z (dir -1) da un profilo di rivoluzione [[h, r], ...] (h = sporgenza)
  function rp_pomoZ(prof, x, y, z, dir, seg) {
    const g = K.latheX(prof.map(p => [p[0], p[1]]), { seg: seg || 20 });
    g.rotateY(dir < 0 ? PI / 2 : -PI / 2); g.translate(x, y, z); return g;
  }

  // ================================================================== scritte incise su un pezzo tornito (latheX, a0 = 0, a1 = 2π)
  // Il pittore del kit lavora solo nel piano del profilo delle estrusioni: qui le scritte vengono disegnate direttamente
  // nelle coordinate UV del tornio (u = lunghezza lungo il profilo, v = .1 + .9 * angolo / 2π; lato destro v = .325, sinistro v = .775).
  // voci: {lato: 'L'|'R', testo, x (centro, mm), h (altezza lettere, mm), r (raggio locale), dy (spostamento verso l'alto, mm)}
  function rp_scritteTornio(prof, voci, o) {
    o = o || {};
    const W = 1024, H = 256, acc = [0]; let len = 0;
    for (let i = 1; i < prof.length; i++) { len += Math.hypot(prof[i][0] - prof[i - 1][0], prof[i][1] - prof[i - 1][1]); acc.push(len); }
    const uOf = x => { for (let i = 1; i < prof.length; i++) { const a = prof[i - 1], b = prof[i]; if (b[0] > a[0] && x >= a[0] && x <= b[0]) return (acc[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]) * (x - a[0]) / (b[0] - a[0])) / len; } return .5; };
    const hc = K.canvasOf(W, H), ac = K.canvasOf(W, H), rc = K.canvasOf(W, H), hx = hc.getContext('2d'), ax = ac.getContext('2d'), rx = rc.getContext('2d');
    hx.fillStyle = '#808080'; hx.fillRect(0, 0, W, H); ax.fillStyle = '#ffffff'; ax.fillRect(0, 0, W, H);
    const r0 = Math.round((o.rough || .34) * 255); rx.fillStyle = `rgb(${r0},${r0},${r0})`; rx.fillRect(0, 0, W, H);
    // leggera variazione della rugosità lungo la canna (lucidatura)
    for (let i = 0; i < 160; i++) { const y = K.hash(i, 3, 17) * H, g = r0 + (K.hash(i, 4, 17) - .5) * 30; rx.fillStyle = `rgb(${g | 0},${g | 0},${g | 0})`; rx.fillRect(0, y, W, 1); }
    for (const t of voci) {
      const ppmU = W / len, ppmV = H * .9 / (2 * PI * t.r), v = (t.lato === 'L' ? .775 : .325) + (t.lato === 'L' ? 1 : -1) * .9 * (t.dy || 0) / (2 * PI * t.r);
      const X = uOf(t.x) * W, Y = (1 - v) * H, k = t.h * ppmV / 100;
      for (const [ctx, col] of [[hx, '#262626'], [ax, '#8a8a8a']]) {
        ctx.save(); ctx.translate(X, Y); ctx.scale((t.lato === 'L' ? -1 : 1) * k * ppmU / ppmV, (t.lato === 'L' ? 1 : -1) * k);
        ctx.fillStyle = col; ctx.font = 'bold 100px Arial, Helvetica, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        if (t.spazio) { let tot = 0; const ws = [...t.testo].map(c => { const m = ctx.measureText(c).width; tot += m + t.spazio; return m; }); let xx = -tot / 2; [...t.testo].forEach((c, i) => { ctx.fillText(c, xx + ws[i] / 2, 0); xx += ws[i] + t.spazio; }); }
        else ctx.fillText(t.testo, 0, 0);
        ctx.restore();
      }
    }
    return { map: K.texOf(ac, true), normalMap: K.texOf(K.heightToNormal(hc, o.k || 2.2), false), roughnessMap: K.texOf(rc, false) };
  }

  // ================================================================== tamburo del revolver
  // corpo scanalato (fresa a punta sferica: le scanalature finiscono a cucchiaio) o esagonale, piastra anteriore con le
  // camere forate, proiettili visibili nelle camere, fondelli in ottone nella luce posteriore, tacche di arresto.
  function rp_tamburo(A, o) {
    const n = o.n, per = 2 * PI / n, R = o.R, cy = o.cy, Lc = o.Lc, xp = Lc - (o.plate || 3.2), c0 = o.c0 || 1.1;
    const th0 = o.low ? -PI / 2 : PI / 2;           // camera allineata con la canna
    const fl = o.flute, hex = o.hex, mt = o.mat, dk = K.mat('nero_lucido', null, { c: '#050505', r: .75 });
    const df = fl ? R + fl.rf - fl.depth : 0, wsp = fl ? Math.sqrt(Math.max(0, fl.rf * fl.rf - (df - R) * (df - R))) : 0;
    const wrapd = a => { let d = (((a - th0 - per / 2) % (2 * PI)) + 2 * PI) % per; if (d > per / 2) d -= per; return d; };
    const rf = (x, a) => {
      let r = R;
      if (hex) r = Math.min(hex.Rr, hex.Rf / Math.cos(wrapd(a)));
      if (x < c0) r -= (c0 - x) * .9;
      if (fl) {
        let q = 0;
        if (x >= fl.xa && x <= fl.xb) q = fl.rf; else if (x < fl.xa) q = Math.sqrt(Math.max(0, fl.rf * fl.rf - (fl.xa - x) ** 2)); else q = Math.sqrt(Math.max(0, fl.rf * fl.rf - (x - fl.xb) ** 2));
        if (q > 0) { const d = wrapd(a), s = df * Math.sin(d), c = df * Math.cos(d); if (Math.abs(s) < q) { const t = c - Math.sqrt(q * q - s * s); if (t < r) r = t; } }
      }
      return r;
    };
    // angoli: fitti nelle scanalature, lati del tamburo a passo di ~4.5°
    const angs = [];
    if (fl) {
      const al = Math.acos(Math.min(1, (R * R + df * df - fl.rf * fl.rf) / (2 * R * df)));
      for (let k = 0; k < n; k++) {
        const f0 = th0 + per / 2 + k * per - al;
        for (let j = 0; j < 10; j++) angs.push(f0 + 2 * al * j / 10);
        const land = per - 2 * al, nl = Math.max(3, Math.ceil(land / (4.5 * PI / 180)));
        for (let j = 0; j < nl; j++) angs.push(f0 + 2 * al + land * j / nl);
      }
    } else { const m = hex ? 12 : 16; for (let k = 0; k < n * m; k++) angs.push(th0 + 2 * PI * k / (n * m)); }
    const xs = [0, c0 * .5, c0];
    if (fl) { for (let j = 0; j <= 6; j++) xs.push(fl.xa - wsp + wsp * j / 6); for (let j = 0; j <= 6; j++) xs.push(fl.xb + wsp * j / 6); }
    else xs.push(Lc * .5);
    xs.push(xp); xs.sort((a, b) => a - b);
    const xu = xs.filter((v, i) => i === 0 || v - xs[i - 1] > 1e-3);
    A.add(rp_giro(xu, angs, rf, cy, 34), mt, 'tamburo');
    A.add(K.discX(0, cy, 0, R - c0 * .9, -1, 40), mt, 'tamburo');
    // piastra anteriore con le camere forate (smusso solo davanti)
    const cont = angs.map(a => { const r = rf(xp, a); return [Math.cos(a) * r, cy + Math.sin(a) * r]; });
    const holes = [], ch = [];
    for (let k = 0; k < n; k++) { const t = th0 + k * per, z = Math.cos(t) * o.rc, y = cy + Math.sin(t) * o.rc; ch.push([z, y]); holes.push(K.circ(z, y, o.rch, 18)); }
    A.add(K.slabX(cont, xp, Lc, { bL: .7, bR: 0, holes }), mt, 'tamburo');
    // fondo delle camere, proiettili (piombo a punta tonda o rame a punta cava), fondelli in ottone dietro
    const mB = o.bullet === 'rame' ? K.mat('rame') : K.mat('grigio', null, { c: '#77797b', m: .35, r: .55 }), mBr = K.mat('ottone');
    const rr = o.rim || o.rch * 1.18;
    for (const [z, y] of ch) {
      A.add(K.discX(xp + .03, y, z, o.rch + .05, 1, 18), dk, 'tamburo');
      const xt = Lc - 1.2, r = o.rch * .96;
      if (o.bullet === 'rame') {
        A.add(K.latheX([[xp - 1, r], [xt - .7, r * .97], [xt - .15, r * .78], [xt, r * .52], [xt, 0]], { seg: 16, cy: y, cz: z }), mB, 'tamburo');
        A.add(K.discX(xt + .02, y, z, r * .32, 1, 12), dk, 'tamburo');
      } else A.add(K.latheX([[xp - 1, r], [xt - 3.2, r * .93], [xt - 1.7, r * .72], [xt - .6, r * .4], [xt, 0]], { seg: 16, cy: y, cz: z }), mB, 'tamburo');
      A.add(K.latheX([[-1.35, 0], [-1.35, rr * .92], [-1.25, rr], [-.05, rr], [0, rr * .9]], { seg: 18, cy: y, cz: z }), mBr, 'tamburo');
    }
    // tacche di arresto sopra le camere (fascia posteriore)
    if (o.notch !== false && !hex) {
      const mN = K.mat('nero', null, { c: '#0b0b0c', r: .9, m: .2 }), gs = [];
      for (let k = 0; k < n; k++) { const t = th0 + k * per, xn = o.notchX || Lc * .16; gs.push(K.xf(K.box(xn, R - .9, -1.6, xn + 4.6, R + .04, 1.6, .25), { r: [PI / 2 - t, 0, 0] }).translate(0, cy, 0)); }
      A.add(K.mergeG(gs), mN, 'tamburo');
    }
    return ch;
  }

  // ================================================================== canna tonda del revolver (con spalla, corona e anima scura)
  // scritte = {kind: materiale, voci: [...]} per incidere produttore e calibro sui fianchi della canna
  function rp_cannaRev(A, x0, x1, r0, r1, ri, mt, part, scritte) {
    const prof = [[x0, 0], [x0, r0 + .45], [x0 + 5.5, r0 + .45], [x0 + 6.3, r0], [x1 - 1.6, r1], [x1 - .2, r1 - .5], [x1, r1 - 1.1], [x1, ri + .6], [x1 - .7, ri], [x1 - 9, ri]];
    if (scritte) mt = K.mat(scritte.kind, rp_scritteTornio(prof, scritte.voci, { rough: scritte.kind === 'inox' ? .3 : .32 }), { ns: .8 });
    A.add(K.latheX(prof, { seg: 30 }), mt, part);
    A.add(K.discX(x1 - 8.6, 0, 0, ri + .05, 1, 18), K.mat('nero_lucido', null, { c: '#040404', r: .8 }), part);
  }

  // ================================================================== revolver a doppia azione (tamburo basculante a sinistra)
  // Modello base disegnato per un telaio medio con tamburo lungo 40: i punti dietro al tamburo scalano con S,
  // quelli davanti partono dalla faccia anteriore reale del tamburo (Lc).
  const RP_TELAI = {
    piccolo5: { S: .9, R: 16.4, rc: 10.4, n: 5, Lc: 40.6, hw: 11.3, rch: 4.75 },
    piccolo6: { S: .93, R: 17.3, rc: 10.8, n: 6, Lc: 40.6, hw: 11.6, rch: 4.75 },
    medio: { S: 1, R: 18.3, rc: 11.1, n: 6, Lc: 39.7, hw: 12.4, rch: 4.8 },
    medio357: { S: 1, R: 18.4, rc: 11.2, n: 6, Lc: 41.2, hw: 12.4, rch: 4.8 },
    medio7: { S: 1.03, R: 19.2, rc: 12.3, n: 7, Lc: 41.2, hw: 12.8, rch: 4.6 },
    grande: { S: 1.06, R: 19.7, rc: 11.9, n: 6, Lc: 41.6, hw: 13.3, rch: 4.85 },
    enorme: { S: 1.36, R: 27.2, rc: 17.2, n: 5, Lc: 58.5, hw: 17.6, rch: 6.75 }
  };
  FAM2.revolver_doppia = function (spec, o) {
    o = Object.assign({}, RP_TELAI[o.telaio || 'medio'], o || {});
    const A = K.asm('revolver_doppia'), S = o.S, Lc = o.Lc, R = o.R, rc = o.rc, hw = o.hw, st = o.stile || 'a';
    const fin = spec.finitura === 'inox' ? 'inox' : (spec.finitura === 'nera' ? 'nera' : 'brunita');
    const X = x => x <= 0 ? x * S : (x >= 40 ? Lc + (x - 40) * S : x * Lc / 40), Y = y => y * S;
    const M = path => path.map(p => typeof p[0] === 'string' ? p : [X(p[0]), Y(p[1]), (p[2] || 0) * S, p[3]]);
    const yWt = R - rc + 1.1, yTop = yWt + 5.4 * S, xF = X(50.5), yBot = Y(-35.5), yWb = -rc - R - 1;
    const mDark = K.mat('nero_lucido', null, { c: '#050505', r: .75 });
    // ---------------- telaio (con finestra del tamburo) e trame di dettaglio
    // fattore dello smusso per tratto: ponte superiore arrotondato, fondo e finestra quasi vivi
    const top = yTop, tS = top / S, gru = [[50.5, -9.5, 1.5, .45], [47.6, -12.5, 2, .45], [46.4, -29, 5, .4], [42, -35.5, 4, .3]];
    let F;
    if (st === 'b') F = [[50.5, tS, 2.5, .6], [-4, tS, 3, .7], [-9, tS + 1.4, 3, .75], ['c', -18, tS + 1.6, -29, tS - 1.5, -33.8, 1], [-36.2, -10, 4, .7], [-36.8, -16, 3, .6], [-30, -30, 3, .4], [-24, -35.5, 2, .3]].concat(gru);
    else if (st === 'c') F = [[50.5, tS, 2, .6], [-9, tS, 2, .75], ['c', -20, tS + .1, -30, tS - 3, -34, 0], [-36.2, -9, 4, .7], [-36.8, -16, 3, .6], [-30, -30, 3, .4], [-24, -35.5, 2, .3]].concat(gru);
    else F = [[50.5, tS, 5, .7], [-8, tS, 2, .75], ['c', -19, tS + .2, -30, tS - 2.5, -34.6, 2], [-36.6, -8, 4, .75], [-36.8, -16, 3, .6], [-30, -30, 3, .4], [-24, -35.5, 2, .3]].concat(gru);
    const FR = M(F);
    const win = [[-1.6, yWb, 2, .12], [Lc + .25, yWb, 2, .12], [Lc + .25, yWt, .8, .12], [-1.6, yWt, .8, .12]];
    const fb = [X(-37), yBot - 1, xF + 1, top + 3];
    const pF = K.painter(fb, { w: 1024, h: 512, rough: fin === 'inox' ? .32 : .34 });
    const iniziali = rp_sigla(spec.produttore), nome = rp_up(spec.nome);
    // lato destro: cartella (piastra laterale) con le viti, giunzione della gru, scritta del paese
    if (st === 'a' || st === 'b') {
      const side = st === 'a' ? 'R' : 'L';
      const plate = M([[-8.5, 6], [-21, 7.5, 3], [-30.5, -2, 6], [-32.5, -26, 4], [-25, -32.4, 3], [-9, -32.4, 2], [-8.5, -10, 2]]);
      pF.line(side, plate, .32, { h: -.75, a: .62 }, true);
      for (const [x, y] of [[-25.5, -24], [-26.5, -2], [-14.5, -28.5]]) pF.pin(side, X(x), Y(y), 2.1 * S, { slot: true, h: .25, a: 1.05 });
    } else {
      // telaio pieno: perni del meccanismo e linea del gruppo di scatto
      for (const [x, y] of [[-22, -12], [8, -31], [-14, -27]]) pF.pin('LR', X(x), Y(y), 2.0 * S, { h: .3, a: 1.08 });
      pF.line('LR', M([[-31, -30], [-20, -32.6], [40, -32.6]]), .3, { h: -.7, a: .65 });
    }
    pF.line('LR', [[Lc + 5.6 * S, yWb], [Lc + 5.6 * S, -rc + 5 * S], ['q', Lc + 5.6 * S, yWt - 4, Lc + 3 * S, yWt - 2.6]], .3, { h: -.7, a: .62 });   // giunzione della gru
    pF.pin('R', Lc + 2.6 * S, yBot + 2.4, 1.5 * S, { slot: true, h: .25, a: 1.05 });
    pF.text('L', iniziali, X(-19), Y(-16), 3.4 * S, { spacing: 6, a: .5 });
    pF.text('R', rp_up(spec.paese), X(-19), Y(-12.5), 1.35 * S, { a: .55 });
    pF.text('R', rp_matr(spec, iniziali.replace('&', '')), X(-19), Y(-16.5), 1.35 * S, { a: .55 });
    pF.noise({ a: fin === 'inox' ? .08 : .12, r: .14, seed: 21 }); pF.walls({ r: fin === 'inox' ? .3 : .36 });
    const mFr = rp_acc(fin, pF.done(2.4), { ns: .8 });
    A.add(rp_rastrema(K.slab(FR, -hw, hw, { b: 5.6 * S, holes: [win], uv: fb, bs: 4 }), yWt - 3 * S, top, o.rastrema || .3), mFr);
    // scudo di rinculo: anello sporgente dietro al tamburo (copre i fondelli)
    A.add(K.latheX([[-8.2 * S, 0], [-8.2 * S, R - 4.5], [-5.5 * S, R - 1.3], [-3.6 * S, R - .55], [-1.6, R - .55], [-1.6, 0]], { seg: 40, cy: -rc }), mFr);
    // ---------------- impugnatura: dorsale metallica e guancette
    const mPlain = rp_acc(fin, null, fin === 'inox' ? { r: .34 } : {});
    const imp = o.imp || 'legno_quadro', g = o.ig || 1;
    const GX = x => X(-36) + (x + 36) * S * g, GY = y => Y(-34.5) + (y + 34.5) * S * g;
    const MG = path => path.map(p => typeof p[0] === 'string' ? p : [GX(p[0]), GY(p[1]), (p[2] || 0) * S * g, p[3]]);
    // impugnatura inclinata di circa 22° (112° rispetto alla canna): la dorsale scende dalla gobba del telaio sotto il cane
    // in una curva continua; fondo squadrato solo per i telai che lo hanno davvero, altrimenti arrotondato
    let gripFrame = null, panel = null, gripC = [-52, -74], med = [-39.5, -30], vite = [-53, -76], gripW = null;
    if (imp === 'legno_quadro' || imp === 'legno_tiro') {
      gripFrame = [[-36.6, -8], ['c', -39, -24, -51, -44, -60, -58], ['c', -67, -70, -73, -88, -77, -101], [-79, -108, 4], [-50, -105, 4], [-47.5, -98], ['c', -43, -86, -38, -74, -33.5, -62], ['c', -29.5, -53, -26, -47, -23.4, -42], [-22.6, -34], [-27, -18]];
      panel = [[-36.4, -13, 4], ['c', -39.6, -26, -51.4, -45, -60.4, -58.6], ['c', -67.4, -70.6, -73.3, -88.4, -77.2, -101], [-78.4, -107.4, 4], [-50.4, -104.4, 4], [-48.1, -98], ['c', -43.6, -86, -38.6, -74, -34.2, -62], ['c', -30.2, -53, -26.8, -47.4, -24.2, -43], [-25.5, -37, 5], [-30.5, -27, 6]];
      if (imp === 'legno_tiro') { panel = [[-35.5, -11, 4], ['c', -40, -26, -56, -48, -68, -62], ['c', -79, -76, -88, -94, -91, -108], [-89, -117, 6], [-48, -114, 6], [-45.5, -104, 4], ['c', -41, -97, -45, -90, -40.4, -84], ['c', -36, -77, -39.4, -69, -35.2, -63], ['c', -31.2, -57, -33.4, -51, -28, -47], [-23.6, -42, 4], [-25, -36, 4], [-30, -24, 6]]; gripC = [-53, -76]; vite = [-54, -79]; }
    } else if (imp === 'legno_tondo') {
      gripFrame = [[-36.6, -8], ['c', -39, -22, -48, -40, -55, -52], ['c', -61, -63, -64.5, -76, -64, -86], ['c', -63.5, -95, -55, -99, -47.5, -96.5], ['c', -43.5, -95, -42, -92, -40.5, -88], ['c', -36.5, -76, -31, -61, -27, -51], [-23.4, -42, 4], [-22.6, -34], [-27, -18]];
      panel = [[-36.4, -13, 4], ['c', -39.6, -25, -48.6, -40.6, -55.6, -52.4], ['c', -61.6, -63.4, -65.1, -76.2, -64.6, -86.2], ['c', -64.1, -95.8, -55.2, -99.8, -47.4, -97.2], ['c', -43.2, -95.6, -41.4, -92.4, -39.9, -88.2], ['c', -35.9, -76.2, -30.4, -61.2, -26.4, -51.2], [-24.2, -43, 4], [-25.5, -37, 5], [-30.5, -27, 6]];
      gripC = [-48, -66]; vite = [-49, -68];
      if (o.tondoLungo) { panel = [[-36.4, -13, 4], ['c', -39.6, -25, -52.6, -44.6, -62.6, -58.4], ['c', -70.6, -70.4, -74.6, -84.4, -72.6, -96.2], ['c', -70.6, -106.4, -58.2, -110.6, -50, -105.4], ['c', -45.8, -102.4, -43.6, -98.2, -42, -93.2], ['c', -37, -78.2, -30.4, -61.2, -26.4, -51.2], [-24.2, -43, 4], [-25.5, -37, 5], [-30.5, -27, 6]]; gripC = [-52, -70]; vite = [-53, -72]; }
    }
    if (gripFrame) A.add(K.slab(MG(gripFrame), -6.6 * S, 6.6 * S, { b: 2.4 * S, bs: 3 }), mPlain);
    if (panel) {
      // guancette in legno costruite nel riferimento dell'impugnatura (venatura lungo l'impugnatura)
      const rho = (o.rake || 22) * PI / 180, rz = -PI / 2 - rho, t0 = [GX(-36), GY(-20)];
      const ca = Math.cos(-rz), sa = Math.sin(-rz), toL = (x, y) => [(x - t0[0]) * ca - (y - t0[1]) * sa, (x - t0[0]) * sa + (y - t0[1]) * ca];
      const PL = rp_tp(MG(panel), toL), gb = K.bbox2(K.P2(PL)), gbb = [gb[0] - 1, gb[1] - 1, gb[2] + 1, gb[3] + 1];
      const pG = K.painter(gbb, { w: 1024, h: 512, rough: .5 });
      pG.checker('LR', rp_inset(PL, 4 * S), 1.55, { a: .74, r: .74 });
      pG.line('LR', rp_inset(PL, 4 * S), .35, { h: -.6, a: .7 }, true);
      const mc = toL(GX(vite[0]), GY(vite[1]));
      pG.fill('LR', K.circ(mc[0], mc[1], 4.2 * S, 24), { h: .1, a: 1 });
      pG.pin('L', mc[0], mc[1], 3.0 * S, { h: .45, a: .55, slot: true });
      pG.pin('R', mc[0], mc[1], 3.0 * S, { h: .45, a: .55 });
      pG.noise({ a: .06, r: .1, seed: 33 });
      const mW = rp_legno(pG, o.legno || 'noce', 2.2, .9);
      const ghw = (imp === 'legno_tiro' ? 17 : 15.2) * S;
      A.add(K.xf(K.slab(PL, -ghw, ghw, { b: 5.2 * S, bs: 5, uv: gbb }), { r: [0, 0, rz], t: [t0[0], t0[1], 0] }), mW);
      // medaglione in alto e vite delle guancette (dado a destra)
      const md = toL(GX(med[0]), GY(med[1]));
      const mMed = K.mat('ottone', null, { c: '#c9b27a', r: .35 });
      for (const s of [-1, 1]) { const q = [t0[0] + md[0] * Math.cos(rz) - md[1] * Math.sin(rz), t0[1] + md[0] * Math.sin(rz) + md[1] * Math.cos(rz)]; A.add(rp_pomoZ([[0, 3.3 * S], [.35, 3.3 * S], [.55, 2.6 * S], [.6, 0]], q[0], q[1], s * (ghw - .6), s), mMed); }
      gripW = [GX(gripC[0]), GY(gripC[1])];
    } else {
      // impugnatura avvolgente in gomma (copre la dorsale), fondo arrotondato, con o senza incavi per le dita
      const gs = (o.gs || 1), dita = imp !== 'gomma_liscia';
      const P = (x, y) => [GX(-36) + (x + 36) * gs, GY(-34.5) + (y + 34.5) * gs];
      const gd = o.gd === undefined ? 1 : o.gd;
      const F0 = [[-22.4, -34], [-23.6, -44], [-28, -58], [-34.5, -76], [-41, -93], [-47, -103], [-54, -108.5]], F1 = [[-22.4, -34], [-23.6, -44], [-28.5, -58], [-36, -76], [-44.5, -94], [-53, -106], [-62, -113]];
      const front = F0.map((q, i) => P(q[0] + (F1[i][0] - q[0]) * gd, q[1] + (F1[i][1] - q[1]) * gd));
      const B0 = [[-34.5, -4], [-39, -18], [-49, -38], [-59, -58], [-67, -78], [-72, -95], [-70, -104], [-63, -109]], B1 = [[-34.5, -4], [-41, -18], [-54, -38], [-67, -58], [-79, -80], [-88, -98], [-86, -108], [-77, -113]];
      const back = B0.map((q, i) => P(q[0] + (B1[i][0] - q[0]) * gd, q[1] + (B1[i][1] - q[1]) * gd));
      const mR = K.mat('gomma', null, { tile: 'stipple', rep: [5, 3], ns: .55 });
      A.add(rp_impGomma(front, back, { dita: dita ? 2.6 * gs : 0, w: t => (12.6 + 3.2 * Math.sin(Math.min(1, t * 1.15) * PI) + (t < .1 ? 0 : .6)) * gs, n: 26 }), mR);
      if (imp === 'gomma_inserti') {
        // inserti in legno sui fianchi (dorso dell'impugnatura)
        for (const s of [-1, 1]) A.add(K.slab([P(-42, -30).concat([6]), P(-60, -80).concat([8]), P(-52, -90).concat([6]), P(-37, -40).concat([6])], s > 0 ? 13 * gs : -16.2 * gs, s > 0 ? 16.2 * gs : -13 * gs, { b: 1.6 }), K.mat('legno_scuro'));
      }
      const f5 = rp_lungo(front, .45), b5 = rp_lungo(back, .45);
      gripW = [(f5[0] + b5[0]) / 2, (f5[1] + b5[1]) / 2];
    }
    // ---------------- ponticello
    const TG = st === 'b'
      ? [[32.5, -33], ['c', 29.5, -34, 28, -36, 28, -40], ['c', 28.5, -52, 20, -62, 6, -62.5], ['c', -8, -63, -20, -55, -23.6, -44], ['c', -24.4, -39, -26, -36, -30, -33], [-18.6, -35], [-18.4, -41], ['c', -16, -51, -6, -58.6, 6, -58.6], ['c', 17, -58.6, 23.6, -50, 23.2, -40], [23, -35]]
      : [[33, -33], ['c', 30, -34, 28.4, -36, 28.4, -40], ['c', 29.6, -52, 22, -63.5, 6, -63.6], ['c', -9, -63.7, -20.5, -56, -23.6, -45], ['c', -24.4, -40, -26, -36, -30, -33], [-18.6, -34], [-18.4, -42], ['c', -15.5, -52, -6, -59.6, 6, -59.6], ['c', 18, -59.6, 24.6, -51, 23.4, -39.5], [23, -34]];
    A.add(K.slab(M(TG), -4.4 * S, 4.4 * S, { b: 1.9 * S, bs: 3 }), mPlain);
    // ---------------- grilletto e cane (parti mobili)
    const mHT = fin === 'inox' ? K.mat('inox', null, { r: .28 }) : K.mat('brunito', null, { c: '#3a3836', r: .3 });
    const tiro = o.cane === 'tiro';
    const GR = tiro ? [[4.5, -33], [11, -33], [13.6, -40, 6], [13.2, -48, 8], [10, -55.5, 5], [6.6, -58.4, 2], [3.4, -56.5, 2], [5.2, -49, 8], [5.6, -41, 8], [4.2, -36]]
      : [[4.5, -33], [10.5, -33], [12.8, -40, 6], [12.4, -48, 8], [9.5, -55, 5], [6.4, -58, 2], [3.6, -56.5, 2], [5.2, -49, 8], [5.6, -41, 8], [4.2, -36]];
    A.add(K.slab(M(GR), (tiro ? -5 : -3.8) * S, (tiro ? 5 : 3.8) * S, { b: 1.1 * S, bs: 3 }), mHT, 'grilletto');
    if (tiro) for (let i = 0; i < 7; i++) { const yy = -40.5 - i * 2.2; A.add(K.box(X(12.4 + (i > 3 ? -0.6 * (i - 3) : 0)), Y(yy - .45), -4.6 * S, X(13.9 + (i > 3 ? -0.6 * (i - 3) : 0)), Y(yy + .45), 4.6 * S, .2), mHT, 'grilletto'); }
    A.pivot('grilletto', [X(8), Y(-31), 0]);
    // cane: corpo nella fessura del telaio, sperone ricurvo dietro la gobba del telaio
    const HB = st === 'b'
      ? [[-9.6, -2, 2], [-9.4, 10.5, 1.5], [-12, tS + 1.6, 2.5], [-21, tS + 2, 6], [-31, tS + 2.4, 6], ['c', -36, tS + 3, -41, tS + 2.2, -44, tS - .2], [-44.4, tS - 2.6, 1.8], ['c', -42, tS - 4.6, -37.5, tS - 6.5, -33.5, tS - 9], [-31.5, 0, 6], [-29.5, -12, 6], [-22, -19, 5], [-14.5, -14, 4]]
      : [[-9.6, -2, 2], [-9.4, 10, 1.5], [-11.5, tS + .3, 2], [-20, tS + .9, 4], [-28, tS + 1.5, 5], ['c', -32.5, tS + 2, -36.5, tS + 1.4, -39.2, tS - .8], [-39.6, tS - 3, 1.6], ['c', -38, tS - 5, -35.5, tS - 6.5, -33.5, tS - 8.5], [-32.4, 0, 6], [-29.5, -12, 6], [-22, -19, 5], [-14.5, -14, 4]];
    A.add(K.slab(M(HB), -3.1 * S, 3.1 * S, { b: .9 * S, bs: 3 }), mHT, 'cane');
    // cresta zigrinata dello sperone (poco più larga del corpo)
    const sp = st === 'b' ? [[-30, tS + 2.2], [-31, tS + 2.4, 6], ['c', -36, tS + 3, -41, tS + 2.2, -44, tS - .2], [-43.2, tS - 1.4], ['c', -40.5, tS + .6, -36, tS + 1.2, -31, tS + .9], [-30, tS + .8]]
      : [[-26, tS + 1.3], [-28, tS + 1.5, 5], ['c', -32.5, tS + 2, -36.5, tS + 1.4, -39.2, tS - .8], [-38.4, tS - 2], ['c', -36, tS - .2, -32.5, tS + .4, -28, tS + .1], [-26, tS - .1]];
    const spw = (tiro ? 6.4 : 4.2) * S;
    A.add(K.slab(M(sp), -spw, spw, { b: .7 * S, bs: 3 }), K.mat(fin === 'inox' ? 'inox' : 'brunito', null, { tile: 'knurl', rep: [10, 3], r: .45, ns: 1, c: fin === 'inox' ? undefined : '#3a3836' }), 'cane');
    A.pivot('cane', [X(-22), Y(-12), 0]);
    // ---------------- leva di apertura del tamburo (lato sinistro)
    const mLat = K.mat(fin === 'inox' ? 'inox' : 'brunito', null, { tile: 'knurl', rep: [6, 2], ns: .9, r: .4 });
    if (st === 'a') A.add(K.slab(M([[-17, -4.5, 2], [-4, -4.5, 2], [-3.4, 3.6, 2.5], [-16, 3.6, 2.5]]), -hw - 2.4 * S, -hw + 1, { bL: 1, bR: 0 }), mLat);
    else if (st === 'b') A.add(K.slab(M([[-14, -1, 2], [-5.5, -2.6, 2], [-3, 3, 3], [-6, 8.5, 3], [-12.5, 6.5, 3]]), -hw - 2.2 * S, -hw + 1, { bL: 1, bR: 0 }), mLat);
    else A.add(rp_pomoZ([[0, 4.2 * S], [1.6 * S, 4.2 * S], [2.2 * S, 3.4 * S], [2.4 * S, 0]], X(-12), Y(-9), -hw + .2, -1, 22), K.mat(fin === 'inox' ? 'inox' : 'brunito'));
    // ---------------- canna, carenatura, costola, mire
    const Lb = o.canna, xM = Lc + .25 + Lb, rb0 = (o.rb0 || 8.2) * (o.rbS || 1), rb1 = (o.rb1 || 6.8) * (o.rbS || 1), tipo = o.tipo || 'conica';
    const mBar = fin === 'inox' ? K.mat('inox', null, { r: .3 }) : rp_acc(fin, null, o.lucido ? { r: .22 } : {});
    const piena = tipo === 'piena' || tipo === 'ventilata', tonda = tipo === 'conica' || tipo === 'conica_nuda';
    const xT = (xF + xM) / 2 - (tipo === 'conica' ? 6 * S : 0), rT = (rb0 + rb1) / 2;
    rp_cannaRev(A, xF - 2, xM, piena ? rb1 : rb0, rb1, o.ri || 4.6, mBar, undefined, tonda && !o.lucido ? { kind: fin === 'inox' ? 'inox' : 'brunito', voci: [
      { lato: 'L', testo: rp_up(spec.produttore), x: xT, h: 1.9 * S, r: rT, dy: 1.2, spazio: 6 }, { lato: 'L', testo: nome, x: xT, h: 1.6 * S, r: rT, dy: -1.6, spazio: 8 },
      { lato: 'R', testo: 'CAL. ' + rp_cal(spec), x: xT, h: 1.9 * S, r: rT, spazio: 6 }] } : undefined);
    let ySight = rb1, xFs = xM - 9 * S;
    const yLug = -rc - (o.lugB || 6.4) * S;
    if (piena || tipo === 'carenata') {
      const xe = tipo === 'carenata' ? Math.min(xM - 18 * S, Lc + 66 * S) : xM;
      const lw = (o.lugW || rb1 * .8);
      const prof = tipo === 'carenata'
        ? [[xF - 2, 0], [xe - 14 * S, 0], ['c', xe - 7 * S, 0, xe, yLug * .45, xe, yLug + 3 * S], [xe - 3.5 * S, yLug, 3 * S], [xF - 2, yLug]]
        : [[xF - 2, 0], [xe, 0], [xe, yLug + 4.5 * S, 4.5 * S, .6], [xe - 6 * S, yLug, 5 * S], [xF - 2, yLug]];
      const lb = [xF - 3, yLug - 1, xM + 1, 1];
      const pL = K.painter(lb, { w: 1024, h: 512, rough: fin === 'inox' ? .32 : .34 });
      const xc = (xF + xe) / 2 - 2;
      pL.text('L', rp_up(spec.produttore), xc, yLug * .52 + 1.8 * S, 2.6 * S, { spacing: 4, a: .5 });
      pL.text('L', nome, xc, yLug * .52 - 2.6 * S, 2.2 * S, { spacing: 6, a: .5 });
      pL.text('R', rp_cal(spec) + (rp_cal(spec).length < 6 ? ' MAGNUM' : ''), xc, yLug * .52, 2.4 * S, { spacing: 5, a: .5 });
      pL.noise({ a: .08, r: .12, seed: 4 }); pL.walls({ r: .34 });
      A.add(K.slab(prof, -lw, lw, { b: 1.6 * S, uv: lb, bs: 3 }), rp_acc(fin, pL.done(2.2), fin === 'inox' ? { r: .3, ns: .8 } : { ns: .8 }));
    }
    if (tipo === 'conica' || tipo === 'conica_nuda') {
      // astina dell'estrattore scoperta, con testa zigrinata; dente di bloccaggio sotto la canna
      const xr = Lc + (o.astaL || 52) * S;
      A.add(K.rod(Lc, xr - 6 * S, 2.9 * S, { cy: -rc, seg: 14 }), mBar, 'tamburo');
      A.add(K.latheX([[xr - 6.4 * S, 0], [xr - 6.4 * S, 3.5 * S], [xr - .6, 3.5 * S], [xr, 2.8 * S], [xr, 0]], { seg: 16, cy: -rc }), K.mat(fin === 'inox' ? 'inox' : 'brunito', null, { tile: 'knurl', rep: [3, 6], ns: .9 }), 'tamburo');
      if (tipo === 'conica') A.add(K.slab([[xr + .3, -1], [xr + 12 * S, -1], [xr + 12 * S, -rc + 1.5 * S, 1.5], [xr + 6 * S, -rc - 4.2 * S, 3 * S], [xr + .3, -rc - 3.8 * S, 1]], -3.4 * S, 3.4 * S, { b: .9 }), mBar);
    }
    // costola sopra la canna: piena (con zigrinatura) o ventilata (con finestre)
    if (o.costola) {
      const rb = piena ? rb1 : rb0, yR = rb + (o.costola === 'ventilata' ? 3.4 : 2.4) * S, x0 = xF - 2, x1 = xM - .4, rw = (o.costolaW || 4.4) * S;
      const holes = [];
      if (o.costola === 'ventilata') { const nH = Math.max(3, Math.round((x1 - x0 - 26) / 24)), pitch = (x1 - x0 - 22) / nH; for (let i = 0; i < nH; i++) { const a = x0 + 12 + i * pitch + 4.5; holes.push(K.rrect(a, rb + .25, a + pitch - 9, yR - 1.1 * S, 1.2)); } }
      A.add(K.slab([[x0, rb - 3], [x1, rb - 3], [x1, yR - 1.4, 1.2], [x1 - 1.4, yR, 1.2], [x0, yR]], -rw, rw, { b: .8, holes }), mBar);
      A.add(K.box(x0 + 2, yR - .02, -rw + 1, x1 - 3, yR + .06, rw - 1, 0), K.mat('nero', null, { tile: 'knurl', rep: [30, 1], r: .7 }));
      ySight = yR; xFs = xM - 10 * S;
    }
    // mirino
    const mirino = o.mirino || 'mezzaluna';
    if (mirino === 'mezzaluna') {
      const pts = []; const hx = 7 * S, hy = 7.2 * S, yb = ySight - .8;
      for (let i = 0; i <= 14; i++) { const a = PI * (1 - i / 14); pts.push([xFs + Math.cos(a) * hx, yb + Math.sin(a) * hy]); }
      A.add(K.slab(pts, -1.5 * S, 1.5 * S, { b: .5 }), mBar);
      A.add(K.slab([[xFs - 9 * S, ySight - 2.5], [xFs + 9 * S, ySight - 2.5], [xFs + 8 * S, ySight + .6, 1], [xFs - 8 * S, ySight + .6, 1]], -2.8 * S, 2.8 * S, { b: .7 }), mBar);
    } else {
      const h = (o.mirinoH || 7.4) * S, yb = ySight - .6;
      A.add(K.slab([[xFs - 17 * S, yb], [xFs + 2.4 * S, yb], [xFs + 2.4 * S, yb + h, .6], [xFs - 1.2 * S, yb + h, .6], ['q', xFs - 9 * S, yb + h * .6, xFs - 17 * S, yb]], -1.6 * S, 1.6 * S, { b: .45 }), mirino === 'rampa_rossa' ? K.mat('nero', null, { r: .5 }) : mBar);
      if (mirino === 'rampa_rossa') A.add(K.slab([[xFs - 3.4 * S, yb + h - 3.8 * S], [xFs - .4 * S, yb + h - 3.8 * S], [xFs - .4 * S, yb + h - .6 * S], [xFs - 2.2 * S, yb + h - .6 * S]], -1.7 * S, 1.7 * S, { b: .2 }), K.mat('rosso', null, { c: '#d81414' }));
      A.add(K.slab([[xFs - 19 * S, ySight - 3], [xFs + 4.5 * S, ySight - 3], [xFs + 4.5 * S, ySight + .4, 1], [xFs - 19 * S, ySight + .4, 1]], -2.6 * S, 2.6 * S, { b: .6 }), mBar);
    }
    const yFsTop = ySight - .8 + (mirino === 'mezzaluna' ? 7.2 : (o.mirinoH || 7.4)) * S;
    // tacca di mira: scanalatura nel ponte superiore (fissa) o tacca regolabile
    let yRear = top;
    if (o.mire === 'regolabili') {
      const xs0 = X(-13), xs1 = X(8), yb = top - .3, ht = 4.2 * S, mS = K.mat('nero', null, { r: .45 });
      A.add(K.slab([[xs0, yb], [xs1, yb], [xs1 - 1, yb + 2.4 * S, 1], [xs0 + 5 * S, yb + ht, 1], [xs0, yb + ht, .5]], -4.6 * S, 4.6 * S, { b: .6 }), mS);
      A.add(K.slabX([[-5.6 * S, yb + 1], [5.6 * S, yb + 1], [5.6 * S, yb + ht + 2.6 * S, .6], [1.25 * S, yb + ht + 2.6 * S, .2], [1.25 * S, yb + ht - .2 * S, .2], [-1.25 * S, yb + ht - .2 * S, .2], [-1.25 * S, yb + ht + 2.6 * S, .2], [-5.6 * S, yb + ht + 2.6 * S, .6]], xs0, xs0 + 3.6 * S, { b: .5 }), mS);
      A.add(rp_pomoZ([[0, 1.2 * S], [.8, 1.2 * S], [1, 0]], xs0 + 1.8 * S, yb + ht, 5.6 * S, 1, 12), mS);
      A.add(K.latheX([[0, 0], [0, 1.5 * S], [.9, 1.3 * S], [1, 0]], { seg: 12 }).rotateZ(PI / 2).translate(xs1 - 5 * S, yb + 2.6 * S, 0), mS);
      yRear = yb + ht + 2.6 * S - .1;
    } else A.add(K.box(X(-12), top - .02, -1.4 * S, xF - 3, top + .05, 1.4 * S, 0), mDark);
    // ---------------- tamburo (parte mobile con perno sul suo asse)
    const flute = o.scanalature === false ? null : { rf: 5 * S, depth: 2.3 * S, xa: o.fxa || Lc * .4, xb: Lc - (o.fxb || 6.5 * S) };
    rp_tamburo(A, { n: o.n, R, rc, cy: -rc, Lc, rch: o.rch, flute, mat: rp_acc(fin, null, fin === 'inox' ? { r: .28 } : (o.lucido ? { r: .22 } : {})), bullet: o.proiettile || (o.n === 5 && S > 1.2 ? 'rame' : 'piombo'), notchX: o.notchX });
    A.pivot('tamburo', [Lc / 2, -rc, 0]);
    // freno di bocca (calibro enorme)
    if (o.freno) {
      const x0 = xM - o.freno, mf = mBar;
      for (let i = 0; i < 3; i++) A.add(K.box(x0 + 6 + i * (o.freno - 10) / 3, 2.4 * S, -rb1 - .3, x0 + 6 + i * (o.freno - 10) / 3 + (o.freno - 18) / 3 * .62, rb1 + 3.2 * S, rb1 + .3, .3), mDark);
    }
    // ---------------- punti di riferimento
    A.anchor('bocca', [xM + .5, 0, 0]);
    A.anchor('espulsione', [Lc / 2, -rc, -R], [0, -.5, -1]);
    A.anchor('impugnatura', [gripW[0], gripW[1], 0]);
    A.anchor('grilletto', [X(12), Y(-47), 0]);
    A.anchor('appoggio', [gripW[0] + 2, gripW[1] - 6, -20 * S]);
    A.anchor('mira_post', [X(-11), yRear, 0]); A.anchor('mira_ant', [xFs, yFsTop, 0]);
    const r = A.done();
    r.info = { azione: 'revolver', bossolo: null, ciclo: { cane: { rz: .62 }, grilletto: { rz: -.32 } },
      ricarica: { tamburo: { dz: -.026 * S, dy: -.011 * S } }, tamburo: { parte: 'tamburo', colpi: o.n } };
    return r;
  };

  // ================================================================== guancette in legno costruite nel riferimento dell'impugnatura
  // contorno in coordinate del mondo; venatura lungo l'asse dell'impugnatura (rake = inclinazione in gradi)
  function rp_guancette(A, outline, o) {
    const rho = (o.rake || 17) * PI / 180, rz = -PI / 2 - rho, t0 = o.t0, ca = Math.cos(-rz), sa = Math.sin(-rz);
    const toL = (x, y) => [(x - t0[0]) * ca - (y - t0[1]) * sa, (x - t0[0]) * sa + (y - t0[1]) * ca];
    const toW = (u, v) => [t0[0] + u * Math.cos(rz) - v * Math.sin(rz), t0[1] + u * Math.sin(rz) + v * Math.cos(rz)];
    const PL = rp_tp(outline, toL), gb = K.bbox2(K.P2(PL)), gbb = [gb[0] - 1, gb[1] - 1, gb[2] + 1, gb[3] + 1];
    const pG = K.painter(gbb, { w: 1024, h: 512, rough: o.rough || .45 });
    if (o.quadretti) { pG.checker('LR', rp_inset(PL, o.bordo || 4), 1.55, { a: .74, r: .74 }); pG.line('LR', rp_inset(PL, o.bordo || 4), .35, { h: -.6, a: .7 }, true); }
    if (o.vite) { const mc = toL(o.vite[0], o.vite[1]); pG.fill('LR', K.circ(mc[0], mc[1], 4.2, 24), { h: .1, a: 1 }); pG.pin('L', mc[0], mc[1], 3, { h: .45, a: .55, slot: true }); pG.pin('R', mc[0], mc[1], 3, { h: .45, a: .55 }); }
    pG.noise({ a: .06, r: .1, seed: 33 });
    A.add(K.xf(K.slab(PL, -o.hw, o.hw, { b: o.b || 4.8, bs: 5, uv: gbb }), { r: [0, 0, rz], t: [t0[0], t0[1], 0] }), rp_legno(pG, o.legno || 'noce', 2.2, .9));
    if (o.medaglione) { const mMed = K.mat('ottone', null, { c: '#c9b27a', r: .35 }); for (const s of [-1, 1]) A.add(rp_pomoZ([[0, o.mr || 3.3], [.35, o.mr || 3.3], [.55, (o.mr || 3.3) * .8], [.6, 0]], o.medaglione[0], o.medaglione[1], s * (o.hw - .7), s), mMed); }
    return { toL, toW };
  }

  // ================================================================== revolver ad azione singola (sportellino di caricamento a destra)
  FAM2.revolver_singola = function (spec, o) {
    o = o || {};
    const A = K.asm('revolver_singola'), R = 21.2, rc = 12.8, Lc = 41.6, n = 6, hw = 16.4;
    const fin = spec.finitura === 'inox' ? 'inox' : 'brunita';
    const yWt = R - rc + 1.2, top = yWt + 7.2, yWb = -rc - R - 1, yBot = yWb - 4.5, xF = Lc + 12;
    const mDark = K.mat('nero_lucido', null, { c: '#050505', r: .75 });
    // ---------------- telaio: ponte superiore piatto con le alette che proteggono la tacca, fronte lungo con il perno del tamburo
    const dr = 14;   // il telaio del modello ad azione singola è più lungo dietro il tamburo
    const F = [[xF, top, 2.5, .7], [-3, top, 1, .6], [-4.6, top + 2.6, 1, .6], [-15.4 - dr, top + 2.6, 1, .6], [-16.6 - dr, top - 1, 2, .7], ['c', -21 - dr, top - 2, -26 - dr, top - 6, -27.2 - dr, 2], [-27.6 - dr, -6, 3, .6], [-24 - dr, -17, 3, .4], [-8, -20, 3, .4], [-6, yBot, 3, .3], [Lc + 3, yBot, 6, .3], [xF - 3, -22, 5, .4], [xF, -9, 2, .5]];
    const win = [[-1.4, yWb, 2, .12], [Lc + .3, yWb, 2, .12], [Lc + .3, yWt, .8, .12], [-1.4, yWt, .8, .12]];
    const fb = [-30, yBot - 1, xF + 1, top + 4];
    const pF = K.painter(fb, { w: 1024, h: 512, rough: .34 });
    for (const [x, y] of [[-17, -2], [-11, -15], [Lc + 6, -26]]) pF.pin('LR', x, y, 2.0, { slot: true, h: .25, a: 1.05 });
    pF.text('L', rp_up(spec.produttore), Lc / 2, yBot + 2.1, 1.7, { spacing: 3, a: .55 });
    pF.text('R', rp_matr(spec), Lc / 2, yBot + 2.1, 1.7, { spacing: 3, a: .55 });
    pF.noise({ a: .12, r: .14, seed: 22 }); pF.walls({ r: .36 });
    const mFr = rp_acc(fin, pF.done(2.4), { ns: .8 });
    A.add(rp_rastrema(K.slab(F, -hw, hw, { b: 4.2, holes: [win], uv: fb, bs: 4 }), yWt - 2, top + 2.6, .22), mFr);
    // sportellino di caricamento sul lato destro dello scudo di rinculo
    A.add(K.slab([[-11.5, -rc - 13, 3], [-1.7, -rc - 13, 1.5], [-1.7, -rc + 5, 1.5], [-6.5, -rc + 7.5, 3], [-11.5, -rc + 2, 3]], hw - 1, hw + .7, { bL: 0, bR: .7 }), mFr);
    A.add(rp_pomoZ([[0, 1.4], [.5, 1.4], [.6, 0]], -8.6, -rc - 9, hw + .6, 1, 12), mFr);
    // ---------------- impugnatura a manico d'aratro: dorsale e ponticello (lega nera) e guancette lisce in noce
    const mGF = fin === 'inox' ? K.mat('inox', null, { r: .3 }) : K.mat('anod', null, { r: .42 });
    const strap = [[-20, -14], [-24.8 - dr, 12], ['c', -27 - dr, 9, -29.5 - dr, 4, -31 - dr, -6], ['c', -52, -32, -70, -64, -88, -88], ['c', -98, -99, -99, -108, -88, -111], ['c', -75, -113, -61, -107, -53, -99], ['c', -38, -82, -22, -62, -16.4, -46], [-15, -36], [-14, -22]];
    A.add(K.slab(strap, -6.8, 6.8, { b: 2, bs: 3 }), mGF);
    const TG = [[13, -36], [13.5, -42], ['c', 14, -52, 6.5, -59, -1.5, -59], ['c', -9, -59, -14.8, -52.5, -15.6, -44], [-15.5, -36], [-10.8, -37.5], [-11, -44], ['c', -10.4, -50.5, -6, -55, -1.5, -55], ['c', 4, -55, 8.8, -50.5, 8.8, -42], [8.4, -37.5]];
    A.add(K.slab(TG, -4.6, 4.6, { b: 1.4, bs: 3 }), mGF);
    const panel = [[-21, -19.5, 3], [-44.6, -15.5, 4], ['c', -52.4, -33, -70.4, -64.6, -86.6, -87.6], ['c', -95.6, -98.4, -96.4, -106.4, -87, -108.8], ['c', -75.4, -110.6, -62, -105, -54.4, -97.8], ['c', -39.6, -81.4, -24.6, -61.4, -17.6, -46], [-16.8, -38, 3], [-17.5, -26, 4]];
    rp_guancette(A, panel, { t0: [-24, -20], rake: 26, hw: 17.2, b: 6, legno: 'noce', medaglione: [-36, -34], mr: 4.2, rough: .38 });
    // ---------------- grilletto e cane
    const mHT = fin === 'inox' ? K.mat('inox', null, { r: .28 }) : K.mat('brunito', null, { c: '#3a3836', r: .3 });
    A.add(K.slab([[.4, -37], [3.8, -37], ['c', 6.2, -42, 6.2, -48, 3.6, -54], [1.8, -53.6, 1], ['c', 3.2, -48, 2.8, -43, .2, -40]], -2.8, 2.8, { b: .8, bs: 3 }), mHT, 'grilletto');
    A.pivot('grilletto', [2, -36, 0]);
    const HB = [[-6.4, 3], [-6.4, top - 3, 1.5], [-9, top, 2.5], [-17 - dr, top + .8, 4], [-26 - dr, top + 1.6, 6], ['c', -31 - dr, top + 2.2, -35 - dr, top + 1.4, -37.6 - dr, top - 1], [-38 - dr, top - 3.4, 2], ['c', -36.5 - dr, top - 5.5, -33 - dr, top - 7.5, -30.5 - dr, top - 10], [-28.4 - dr, 2, 5], [-25 - dr, -10, 5], [-18 - dr, -16, 5], [-11, -12, 4]];
    A.add(K.slab(HB, -3.6, 3.6, { b: 1, bs: 3 }), mHT, 'cane');
    A.add(K.slab([[-25 - dr, top + 1.4], [-26 - dr, top + 1.6, 6], ['c', -31 - dr, top + 2.2, -35 - dr, top + 1.4, -37.6 - dr, top - 1], [-36.8 - dr, top - 2.2], ['c', -34.5 - dr, top - .2, -31 - dr, top + .6, -26 - dr, top + .2], [-25 - dr, top]], -6.2, 6.2, { b: .8, bs: 3 }), K.mat('brunito', null, { tile: 'knurl', rep: [10, 3], r: .45, ns: 1, c: '#3a3836' }), 'cane');
    A.pivot('cane', [-18 - dr * .6, -10, 0]);
    // ---------------- canna, perno del tamburo, alloggiamento dell'astina di espulsione (a destra)
    const xM = Lc + .3 + (o.canna || 117.5), rb0 = 9.4, rb1 = 8.6;
    const mBar = rp_acc(fin, null, {});
    rp_cannaRev(A, xF - 2, xM, rb0, rb1, 4.6, mBar, undefined, { kind: fin === 'inox' ? 'inox' : 'brunito', voci: [
      { lato: 'L', testo: rp_up(spec.produttore) + '  ' + rp_up(spec.paese), x: xF + 46, h: 2, r: 9, dy: 1.3, spazio: 6 }, { lato: 'L', testo: rp_up(spec.nome), x: xF + 46, h: 1.8, r: 9, dy: -1.7, spazio: 8 },
      { lato: 'R', testo: 'CAL. ' + rp_cal(spec), x: xF + 46, h: 2, r: 9, spazio: 6 }] });
    A.add(K.latheX([[xF - 1, 0], [xF - 1, 3.4], [xF + 3.5, 3.4], [xF + 4, 4.4], [xF + 9.5, 4.4], [xF + 10, 3.6], [xF + 10, 0]], { seg: 18, cy: -rc }), K.mat('brunito', null, { tile: 'knurl', rep: [4, 6], ns: .9 }));
    A.add(rp_pomoZ([[0, 2.6], [.9, 2.6], [1.2, 0]], xF - 5, -rc - 2, -hw + .2, -1, 14), mBar);
    const ez = 7.4, ey = -7.8, xe1 = Math.min(xM - 8, Lc + 104);
    A.add(K.latheX([[xF - 2, 0], [xF - 2, 4.7], [xe1 - 6, 4.7], [xe1 - 2, 4.4], [xe1, 3.2], [xe1, 0]], { seg: 20, cy: ey, cz: ez }), mBar);
    A.add(K.box(xF + 4, ey - .9, ez + 4.2, xe1 - 12, ey + .9, ez + 4.85, .2), mDark);
    A.add(rp_pomoZ([[0, 3.2], [2.6, 3.2], [3.2, 2], [3.4, 0]], xF + 12, ey, ez + 4.4, 1, 16), K.mat('brunito', null, { tile: 'knurl', rep: [4, 2], ns: .8 }));
    A.add(rp_pomoZ([[0, 1.6], [.8, 1.6], [1, 0]], xe1 - 4, ey, ez + 4.6, 1, 12), mBar);
    // mirino a rampa su base, tacca regolabile fra le alette
    const xFs = xM - 9;
    A.add(K.slab([[xFs - 22, rb1 - 1], [xFs + 3, rb1 - 1], [xFs + 3, rb1 + 9.6, .6], [xFs - .8, rb1 + 9.6, .6], ['q', xFs - 12, rb1 + 6, xFs - 22, rb1 - 1]], -1.7, 1.7, { b: .45 }), mBar);
    A.add(K.slab([[xFs - 24, rb1 - 3], [xFs + 5, rb1 - 3], [xFs + 5, rb1 + .6, 1], [xFs - 24, rb1 + .6, 1]], -2.8, 2.8, { b: .6 }), mBar);
    const mS = K.mat('nero', null, { r: .45 });
    A.add(K.slabX([[-4.6, top - 1], [4.6, top - 1], [4.6, top + 4.4, .5], [1.3, top + 4.4, .2], [1.3, top + 2, .2], [-1.3, top + 2, .2], [-1.3, top + 4.4, .2], [-4.6, top + 4.4, .5]], -14.6, -11, { b: .4 }), mS);
    A.add(K.box(-11, top - .5, -4.2, -4.5, top + 1.6, 4.2, .4), mS);
    // ---------------- tamburo
    rp_tamburo(A, { n, R, rc, cy: -rc, Lc, rch: 4.85, flute: { rf: 5.4, depth: 2.4, xa: Lc * .36, xb: Lc - 5 }, mat: rp_acc(fin, null, {}), bullet: 'rame', notchX: Lc * .1 });
    A.pivot('tamburo', [Lc / 2, -rc, 0]);
    // ---------------- punti di riferimento
    A.anchor('bocca', [xM + .5, 0, 0]); A.anchor('espulsione', [-4, -rc - 4, hw + 2], [-.2, -.6, 1]);
    A.anchor('impugnatura', [-44, -60, 0]); A.anchor('grilletto', [4, -47, 0]); A.anchor('appoggio', [-42, -68, -20]);
    A.anchor('mira_post', [-12.8, top + 2.2, 0]); A.anchor('mira_ant', [xFs, rb1 + 9.6, 0]);
    const r = A.done();
    r.info = { azione: 'singola', bossolo: null, ciclo: { cane: { rz: .78 }, grilletto: { rz: -.1 } }, manuale: [{ cane: { rz: .78 } }],
      ricarica: { tamburo: { rx: 2 * PI / n } }, tamburo: { parte: 'tamburo', colpi: n } };
    return r;
  };

  // ================================================================== revolver a canna bassa: spara dalla camera inferiore, tamburo esagonale
  FAM2.revolver_canna_bassa = function (spec, o) {
    o = o || {};
    const A = K.asm('revolver_canna_bassa'), rc = 11.6, Lc = 40.5, n = 6, hw = 12.8, cy = rc;
    const hex = { Rf: 16.9, Rr: 18.9 }, Rmax = 18.9;
    const yWb = cy - Rmax - 1, yWt = cy + Rmax + 1.2, top = yWt + 5.6, xM = Lc + .3 + (o.canna || 101.6), yBot = -10.6;
    const mDark = K.mat('nero_lucido', null, { c: '#050505', r: .75 });
    // ---------------- telaio in lega con la carenatura della canna in un solo pezzo (fianco con l'incavo)
    const F = [[xM - 17, top, 2, .6], [-14, top, 2, .6], [-18, top - 2, 2, .7], [-31, top - 2, 6, .7], [-34, top - 8, 8, .65], [-32, 4, 6, .55], [-27, -4, 3, .4], [-10, yBot, 3, .3], [xM - 2, yBot, 2, .35], ['c', xM - 2, -2, xM - 8, top - 18, xM - 17, top]];
    const win = [[-1.4, yWb, 2, .12], [Lc + .3, yWb, 2, .12], [Lc + .3, yWt, .8, .12], [-1.4, yWt, .8, .12]];
    const groove = [[Lc + 12, 9.5, 4], [xM - 26, 9.5, 4], [xM - 18, 26, 4], [Lc + 12, 26, 4]];
    const fb = [-36, yBot - 1, xM + 1, top + 2];
    const pF = K.painter(fb, { w: 1024, h: 512, rough: .5 });
    pF.text('L', rp_up(spec.produttore), (Lc + xM) / 2 - 10, 17.8, 3.2, { spacing: 5, a: .62 });
    pF.text('R', rp_up(spec.nome) + '  ' + rp_cal(spec), (Lc + xM) / 2 - 10, 17.8, 3.2, { spacing: 5, a: .62 });
    pF.text('L', rp_matr(spec, 'FL'), -18, -1, 1.6, { a: .6 });
    for (const [x, y] of [[-24, 12], [-14, -4], [Lc + 6, yBot + 2.5]]) pF.pin('LR', x, y, 1.9, { slot: true, h: .25, a: 1.1 });
    pF.noise({ a: .08, r: .14, seed: 23 }); pF.walls({ r: .5 });
    const mFr = K.mat('anod', pF.done(2.2), { ns: .8, r: .5 });
    A.add(K.slab(F, -hw, hw, { b: 3.6, holes: [win, groove], uv: fb, bs: 4 }), mFr);
    A.add(K.slab(groove, -hw + 2.2, hw - 2.2, { b: .5, uv: fb }), mFr);
    // slitta corta sopra la carenatura e mire a fibra
    A.add(K.slab([[Lc + 16, top - .5], [xM - 20, top - .5], [xM - 20, top + 2.6, .5], [Lc + 16, top + 2.6, .5]], -5.6, 5.6, { b: .5 }), K.mat('anod', null, { r: .45 }));
    for (let x = Lc + 20; x < xM - 24; x += 7) A.add(K.box(x, top + 2.4, -5.6, x + 3.6, top + 4.2, 5.6, .3), K.mat('anod', null, { r: .45 }));
    const mS = K.mat('nero', null, { r: .45 });
    A.add(K.slab([[xM - 32, top - .5], [xM - 19, top - .5], [xM - 19.5, top + 8, .8], [xM - 26, top + 8, .8]], -2.4, 2.4, { b: .5 }), mS);
    A.add(K.rod(xM - 27.5, xM - 19.6, 1.05, { cy: top + 6.6, seg: 10 }), K.mat('verdefluo'));
    A.add(K.slabX([[-5.4, top - 1], [5.4, top - 1], [5.4, top + 6, .5], [1.4, top + 6, .2], [1.4, top + 3.2, .2], [-1.4, top + 3.2, .2], [-1.4, top + 6, .2], [-5.4, top + 6, .5]], -16, -11, { b: .4 }), mS);
    for (const s of [-1, 1]) A.add(K.rod(-11.2, -10.9, .9, { cy: top + 4.6, seg: 10 }).translate(0, 0, s * 3.4), K.mat('rosso'));
    // ---------------- canna (in basso, allineata alla camera inferiore)
    const mBar = K.mat('nero', null, { r: .4 });
    rp_cannaRev(A, Lc + 2, xM, 8.4, 8.4, 4.6, mBar);
    // ---------------- impugnatura avvolgente in gomma, molto alta (la mano sta all'altezza della canna)
    const rho = 21 * PI / 180, dir = [-Math.sin(rho), -Math.cos(rho)], p0 = [-19, 3], L = 102, stz = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24, s = t * L, fing = s > 16 && s < 88 ? Math.pow(Math.abs(Math.sin(PI * (s - 16) / 24)), .7) * 2.2 : 0;
      stz.push({ p: [p0[0] + dir[0] * s, p0[1] + dir[1] * s], f: 11 + 5.6 * Math.min(1, t * 3) - fing, r: 9 + 9 * Math.min(1, t * 5) - (t > .92 ? (t - .92) * 30 : 0), w: (14 + 2.4 * Math.sin(Math.min(1, t * 1.2) * PI)) * (t < .1 ? .85 + t * 1.5 : 1), nf: 2.4, nr: 2.6 });
    }
    A.add(K.loftS(stz, { K: 28, sub: 2 }), K.mat('gomma', null, { tile: 'stipple', rep: [5, 3], ns: .55 }));
    // ponticello squadrato
    const TG = [[30, -8], [30.5, -14], ['c', 31, -27, 26, -36.5, 14, -36.8], [-4, -37], ['c', -9, -37, -12.6, -33, -13, -26], [-13, -8], [-8.6, -9], [-8.8, -25], ['c', -8.4, -30.6, -6, -32.6, -3, -32.6], [14, -32.6], ['c', 23, -32.4, 26.4, -26, 25.8, -15], [25.4, -9]];
    A.add(K.slab(TG, -4.6, 4.6, { b: 1.4, bs: 3 }), mFr);
    // leva di apertura del tamburo (lato sinistro, sopra il ponticello)
    A.add(K.slab([[-6, -8.6, 1.5], [24, -8.6, 1.5], [27, -6, 1.5], [24, -3.6, 1.5], [-6, -3.6, 1.5]], -hw - 2, -hw + .6, { bL: .8, bR: 0 }), K.mat('nero', null, { tile: 'knurl', rep: [8, 1], ns: .8 }));
    // ---------------- grilletto e leva di armamento (al posto del cane)
    const mHT = K.mat('nero', null, { r: .38 });
    A.add(K.slab([[5.2, -10], [10, -10], ['c', 12.4, -16, 12.4, -24, 8.6, -30.6], [6, -30.2, 1.2], ['c', 7.6, -24, 7.4, -17, 4.8, -13]], -3.6, 3.6, { b: .9, bs: 3 }), mHT, 'grilletto');
    A.pivot('grilletto', [7, -9, 0]);
    A.add(K.slab([[-17, 12], [-18.2, top - 2.5, 2], [-21, top + 1, 2.5], ['c', -25, top + 2, -30, top + 2.2, -34, top + .6], [-35, top - 2, 1.4], ['c', -32, top - 3.5, -28.5, top - 5, -26.4, top - 8], [-25, 8, 3], [-21, 4, 3]], -3.4, 3.4, { b: .9, bs: 3 }), mHT, 'cane');
    A.add(K.slab([[-22, top + 1.6], ['c', -25, top + 2, -30, top + 2.2, -34, top + .6], [-33.6, top - .6], ['c', -30, top + .8, -25.5, top + .6, -22, top + .2]], -5.4, 5.4, { b: .6 }), K.mat('nero', null, { tile: 'knurl', rep: [10, 3], ns: 1 }), 'cane');
    A.pivot('cane', [-21, 6, 0]);
    // ---------------- tamburo esagonale con perno sopra la canna
    rp_tamburo(A, { n, R: Rmax, rc, cy, Lc, rch: 4.8, hex, low: true, mat: K.mat('grigio', null, { r: .3, m: .75, c: '#33363b' }), bullet: 'rame', notch: false });
    A.pivot('tamburo', [Lc / 2, cy, 0]);
    // ---------------- punti di riferimento
    A.anchor('bocca', [xM + .5, 0, 0]); A.anchor('espulsione', [Lc / 2, cy, -Rmax], [0, -.5, -1]);
    A.anchor('impugnatura', [-35, -46, 0]); A.anchor('grilletto', [10, -22, 0]); A.anchor('appoggio', [-34, -54, -20]);
    A.anchor('mira_post', [-13.5, top + 3.2, 0]); A.anchor('mira_ant', [xM - 23.5, top + 7.7, 0]);
    const r = A.done();
    r.info = { azione: 'revolver', bossolo: null, ciclo: { cane: { rz: .55 }, grilletto: { rz: -.3 } },
      ricarica: { tamburo: { dz: -.028, dy: .006 } }, tamburo: { parte: 'tamburo', colpi: n } };
    return r;
  };

  // ================================================================== FUCILI A CANNA LISCIA (calibro 12)
  // pezzi comuni: canna con camera e corona, tubo serbatoio con tappo zigrinato, perlina, costola ventilata, paracalore forato
  function rp_cannaLiscia(A, x0, xM, rb, o) {
    o = o || {};
    const ri = o.ri || 9.25, mB = o.mat, dk = K.mat('nero_lucido', null, { c: '#040404', r: .8 });
    const prof = [[x0, 0], [x0, rb + 1.8], [x0 + (o.cam || 52), rb + 1.8], [x0 + (o.cam || 52) + 22, rb + .15], [xM - 2, rb], [xM - .3, rb - .5], [xM, rb - 1.1], [xM, ri + .5], [xM - .8, ri], [xM - 12, ri]];
    A.add(K.latheX(prof, { seg: 32 }), o.scritte ? K.mat(o.scritte.kind, rp_scritteTornio(prof, o.scritte.voci, { rough: .36 }), { ns: .8 }) : mB);
    A.add(K.discX(xM - 11.5, 0, 0, ri + .05, 1, 20), dk);
  }
  function rp_serbatoio(A, x0, x1, ym, rm, mT, mCap) {
    A.add(K.latheX([[x0, 0], [x0, rm], [x1, rm], [x1, 0]], { seg: 28, cy: ym }), mT);
    A.add(K.latheX([[x1 - 1, 0], [x1 - 1, rm + .3], [x1, rm + 1], [x1 + 13, rm + 1], [x1 + 15, rm - .4], [x1 + 17.5, rm - 3], [x1 + 18, 0]], { seg: 28, cy: ym }), mCap);
  }
  function rp_perlina(A, x, y, mat) {
    A.add(K.latheX([[0, 0], [0, 1.1], [1.2, 1.1], [1.6, 1.9], [2.6, 2.2], [3.6, 1.9], [4.2, 0]], { seg: 14 }).rotateZ(PI / 2).translate(x, y - .6, 0), mat || K.mat('ottone'));
  }
  // paracalore: guscio forato sopra la canna (fori come dischi scuri sul guscio)
  function rp_paracalore(A, x0, x1, rb, mat) {
    const r0 = rb + 2.6, r1 = rb + 3.6, a = 1.95;
    A.add(K.latheX([[x0, r0], [x0, r1], [x1, r1], [x1, r0], [x0 + .01, r0]], { seg: 30, a0: -a, a1: a }), mat);
    const dk = K.mat('nero_lucido', null, { c: '#030303', r: .8 }), holes = [];
    for (let x = x0 + 12; x < x1 - 10; x += 16) for (const ang of [-1.45, -.85, -.28, .28, .85, 1.45]) {
      const g = K.latheX([[0, 2.9], [.06, 0]], { seg: 12 }); g.rotateZ(PI / 2); // disco rivolto verso +Y
      g.translate(0, r1 + .05, 0); g.rotateX(-ang); g.translate(x + (Math.abs(ang) > 1 ? 8 : 0), 0, 0); holes.push(g);
    }
    A.add(K.mergeG(holes), dk);
  }
  // impugnatura a pistola dei fucili (loftS dalla sommità verso il basso e indietro)
  function rp_pistolaFucile(top, o) {
    o = o || {}; const rho = (o.rake || 22) * PI / 180, L = o.L || 100, st = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10, s = t * L, fing = o.dita && t > .18 && t < .85 ? Math.pow(Math.abs(Math.sin(PI * (t - .18) / (.67 / 3))), .8) * o.dita : 0;
      st.push({ p: [top[0] - Math.sin(rho) * s, top[1] - Math.cos(rho) * s], f: (o.f || 14) + t * 1.5 - fing, r: (o.r || 15.5) + t * 2 + (o.becco && t > .78 ? (t - .78) * o.becco : 0), w: (o.w || 14) + Math.sin(t * PI) * 1.6, nf: 2.3, nr: 2.4 });
    }
    return K.loftS(st, { K: 26, sub: 3 });
  }

  // contorni laterali delle scatole di culatta (x = 0 retro, y = 0 asse della canna)
  function rp_scatola(stile, Lr, yT, yB) {
    switch (stile) {
      case 'squadro': return [[Lr, yT, 2, .6], [14, yT, 6, .9], [0, yT - 5, 2, .7], [0, yB, 2, .4], [Lr - 8, yB, 2, .4], [Lr, yB + 7, 3, .5]];
      case 'chiuso': return [[Lr, yT - 1, 3, .6], [44, yT - 1, 30, .9], [10, yT - 7, 10, .9], [0, yT - 11, 2, .7], [0, yB + 6, 6, .5], ['c', 30, yB - 2.5, 120, yB - 2.5, Lr - 22, yB + 2], [Lr, yB + 10, 4, .5]];
      case 'lega': return [[Lr, yT, 2, .6], [72, yT, 60, .9], [14, yT - 9, 14, .9], [0, yT - 15, 2, .7], [0, yB, 2, .4], [Lr, yB, 2, .4]];
      case 'semi': return [[Lr, yT - 2, 2, .6], [10, yT - 2, 5, .9], [0, yT - 7, 2, .7], [0, yB + 4, 2, .4], [Lr - 34, yB + 4, 8, .4], [Lr, yB + 18, 4, .5]];
      case 'semi2': return [[Lr, yT - 1, 2, .6], [16, yT - 1, 8, .9], [0, yT - 8, 2, .7], [0, yB + 2, 2, .4], [Lr - 46, yB + 2, 10, .4], [Lr, yB + 16, 5, .5]];
      case 'gobba': return [[Lr, yT - 2, 2, .6], [46, yT - 2, 20, .9], [26, yT + 1.6, 8, .9], [8, yT - 2, 8, .9], [0, yT - 9, 2, .7], [0, yB + 2, 2, .4], [Lr - 40, yB + 2, 10, .4], [Lr, yB + 14, 5, .5]];
      case 'poli': return [[Lr, yT, 3, .6], [Lr - 24, yT + 3, 12, .8], [40, yT + 3, 20, .8], [0, yT - 2, 4, .7], [0, yB, 2, .4], [Lr - 10, yB, 3, .4], [Lr, yB + 8, 4, .5]];
      default: return [[Lr, yT, 2, .6], [52, yT, 40, .9], [12, yT - 6, 14, .9], [0, yT - 12, 2, .7], [0, yB, 2, .4], [Lr, yB, 2, .4]];
    }
  }

  // ================================================================== fucile a canna liscia generico: pompa, semiautomatico, doppio funzionamento
  FAM2.fucile_liscio = function (spec, o) {
    o = Object.assign({ Lr: 210, yT: 14, yB: -44, hw: 15.5, rb: 10.3, rm: 11.2, ym: -24.5, tP: 72, lop: 356 }, o || {});
    const A = K.asm('fucile_liscio'), Lr = o.Lr, yT = o.yT, yB = o.yB, hw = o.hw, rb = o.rb, rm = o.rm, ym = o.ym, tP = o.tP;
    const xb = Lr - 24, xM = xb + o.canna, tipo = o.tipo || 'pompa';
    const mDark = K.mat('nero_lucido', null, { c: '#050505', r: .75 });
    const metal = { brunito: () => K.mat('brunito', null, { r: .32 }), anod: () => K.mat('anod', null, { r: .46 }), parker: () => K.mat('parker'), nero: () => K.mat('nero', null, { r: .45 }), polimero: () => K.mat('poligrigio', null, { r: .62 }) };
    const kindR = o.fin === 'parker' ? 'parker' : o.fin === 'brunito' ? 'brunito' : o.fin === 'polimero' ? 'poligrigio' : o.fin === 'nero' ? 'nero' : 'anod';
    const mBar = o.fin === 'parker' ? K.mat('parker') : K.mat(o.fin === 'brunito' ? 'brunito' : 'nero', null, { r: o.fin === 'brunito' ? .3 : .42 });
    const mPoly = K.mat(o.poli || 'polimero', null, { tile: 'grana', rep: [6, 4], ns: .35, r: .62 }), mPolyT = K.mat(o.poli || 'polimero', null, { tile: 'stipple', rep: [6, 3], ns: .5 });
    const mWood = o.legno ? K.mat('legno_' + o.legno, null, { c: '#b39a88' }) : null;
    // ---------------- scatola di culatta: metà sinistra piena, metà destra con la finestra di espulsione
    const out = rp_scatola(o.scat, Lr, yT, yB);
    const port = o.espulsione === 'sotto' ? null : [[Lr - 98, -11, 2, .2], [Lr - 26, -11, 2, .2], [Lr - 26, yT - 5, 2, .2], [Lr - 98, yT - 5, 2, .2]];
    const rb_ = [-2, yB - 2, Lr + 2, yT + 5];
    const pR = K.painter(rb_, { w: 1024, h: 512, rough: kindR === 'poligrigio' ? .62 : .42 });
    pR.text('L', rp_up(spec.produttore), Lr * .5, (yT + yB) / 2 + 5, 5.6, { spacing: 8, a: .42, h: -.85 });
    pR.text('L', rp_up(spec.nome), Lr * .5, (yT + yB) / 2 - 5, 4.2, { spacing: 12, a: .42, h: -.85 });
    pR.line('LR', [[10, yB + 13], [Lr - 10, yB + 13]], .35, { h: -.5, a: .72 });
    pR.text('R', rp_matr(spec, rp_sigla(spec.produttore).replace('&', '')), Lr * .32, yB + 8, 2.2, { a: .55 });
    pR.text('R', 'CAL. 12', Lr - 62, yB + 8, 2.4, { spacing: 4, a: .55 });
    if (port) pR.fill('R', port, { a: .12, r: .9 });
    for (const x of [tP - 30, tP + 34]) pR.pin('LR', x, yB + 6.5, 2.3, { h: .35, a: 1.06 });
    if (o.scat === 'poli') { pR.fill('LR', [[30, yB + 14, 6], [Lr - 40, yB + 14, 6], [Lr - 46, yT - 8, 6], [40, yT - 8, 6]], { h: -.35, a: .9 }); pR.stipple('LR', [[34, yB + 17], [Lr - 44, yB + 17], [Lr - 50, yT - 11], [44, yT - 11]], { s: .3, r: .8 }); }
    pR.noise({ a: .1, r: .14, seed: 41 }); pR.walls({ r: kindR === 'poligrigio' ? .62 : .44 });
    const mR = K.mat(kindR, pR.done(2.2), { ns: .8 });
    const bR = o.scat === 'poli' ? 5 : 3.2;
    A.add(K.slab(out, -hw, 0, { bL: bR, bR: 0, uv: rb_, bs: 4 }), mR);
    A.add(K.slab(out, 0, hw, { bL: 0, bR: bR, uv: rb_, bs: 4, holes: port ? [port] : [] }), mR);
    // otturatore visibile nella finestra (si muove con la pompa o da solo nei semiautomatici)
    const pBolt = tipo === 'semi' || tipo === 'doppio' ? 'otturatore' : 'pompa';
    const mBolt = K.mat('grigio', null, { c: o.otturatoreChiaro === false ? '#2a2c2e' : '#6f7376', m: .9, r: .3 });
    if (port) {
      A.add(K.box(Lr - 108, -10, 1, Lr - 23, yT - 6, hw - 1.6, .6), mBolt, pBolt);
      A.add(K.box(Lr - 90, -2.5, hw - 1.9, Lr - 40, 2.5, hw - 1.5, .2), mDark, pBolt);
    }
    if (tipo === 'semi' || tipo === 'doppio') {
      // leva di armamento sporgente a destra e pulsante di sgancio dell'otturatore
      const xl = Lr - 52;
      A.add(K.latheX([[0, 0], [0, 3.6], [12, 3.6], [13.5, 5.6], [20, 5.8], [21, 4.6], [21.4, 0]], { seg: 16 }).rotateY(-PI / 2).translate(xl, 1, hw - 3), K.mat('cromo', null, { r: .25 }), pBolt);
      A.add(K.slab([[Lr - 70, yB + 3, 2], [Lr - 40, yB + 3, 2], [Lr - 40, yB + 11, 2], [Lr - 70, yB + 11, 2]], hw - .5, hw + 1.6, { b: .7 }), K.mat('nero', null, { tile: 'knurl', rep: [4, 1], ns: .8 }));
    }
    // slitta sopra la scatola (versioni tattiche)
    if (o.slitta) WC.put(A, WC.rail(18, Lr - 8, yT - .5, { mat: K.mat('anod', null, { r: .45 }) }));
    // ---------------- gruppo di scatto: ponticello, grilletto, sicura
    const mTG = o.ponticello === 'metallo' ? K.mat(kindR === 'poligrigio' ? 'nero' : kindR) : K.mat('polimero', null, { r: .55 });
    const TG = [[tP + 38, yB + 3], [tP + 38.5, yB - 8], ['c', tP + 39, yB - 24, tP + 30, yB - 32, tP + 12, yB - 32], [tP - 18, yB - 32], ['c', tP - 30, yB - 32, tP - 36, yB - 22, tP - 37, yB - 8], [tP - 37, yB + 3], [tP - 31, yB + 1], [tP - 31, yB - 8], ['c', tP - 30, yB - 20, tP - 26, yB - 26.5, tP - 16, yB - 26.5], [tP + 10, yB - 26.5], ['c', tP + 26, yB - 26.5, tP + 32.5, yB - 21, tP + 32.5, yB - 8], [tP + 32.5, yB + 1]];
    A.add(K.slab(TG, -5.6, 5.6, { b: 1.6, bs: 3 }), mTG);
    A.add(K.slab([[tP - 40, yB + 1], [tP + 42, yB + 1], [tP + 42, yB - 3.5, 2], [tP - 40, yB - 3.5, 2]], -hw + 2.5, hw - 2.5, { b: 1.2 }), mTG);
    A.add(K.slab([[tP - 1.5, yB], [tP + 3.6, yB], ['c', tP + 6.6, yB - 7, tP + 6, yB - 15, tP + 1, yB - 22.5], [tP - 1.8, yB - 21.6, 1], ['c', tP + 2, yB - 15, tP + 2, yB - 8, tP - 1.6, yB - 3]], -3.4, 3.4, { b: .9, bs: 3 }), K.mat('nero', null, { r: .4 }), 'grilletto');
    A.pivot('grilletto', [tP + 2, yB - 1, 0]);
    if (o.sicura === 'codetta') A.add(K.slab([[4, yT - 1], [18, yT - 1], [17, yT + 3.2, 1.5], [6, yT + 3.2, 1.5]], -4.5, 4.5, { b: .8 }), K.mat('nero', null, { tile: 'knurl', rep: [3, 1], ns: .9 }));
    else { const xs = o.sicura === 'avanti' ? tP + 34 : tP - 28; A.add(K.latheX([[-7.4, 0], [-7.4, 3.2], [7.4, 3.2], [7.4, 0]], { seg: 14 }).rotateY(PI / 2).translate(xs, yB - 5, 0), K.mat('nero', null, { r: .5 })); A.add(K.latheX([[7.3, 2.6], [7.5, 2.6], [7.5, 0]], { seg: 12 }).rotateY(PI / 2).translate(xs, yB - 5, 0), K.mat('rosso', null, { c: '#c01010' })); }
    // ---------------- canna, costola, paracalore, serbatoio, anello di fissaggio
    const xTc = tipo === 'semi' ? Lr + (o.astL || 250) + 46 : Lr + 44;
    rp_cannaLiscia(A, Lr - 6, xM, rb, { mat: mBar, scritte: { kind: o.fin === 'parker' ? 'parker' : o.fin === 'brunito' ? 'brunito' : 'nero', voci: [
      { lato: 'L', testo: 'CAL. 12 - 70 MM', x: xTc, h: 2.6, r: rb, spazio: 8 }, { lato: 'R', testo: rp_up(spec.produttore), x: xTc, h: 2.6, r: rb, spazio: 6 }] } });
    if (o.costola) {
      const yR = rb + 5.2, x0 = Lr - 4, x1 = xM - 1, holes = [], pitch = 26;
      for (let x = x0 + 14; x < x1 - 24; x += pitch) holes.push(K.rrect(x, rb - .2, x + pitch - 6, yR - 1.6, 1));
      A.add(K.slab([[x0, rb - 2.5], [x1, rb - 2.5], [x1, yR, .8], [x0, yR, .8]], -4.4, 4.4, { b: .5, holes }), mBar);
      A.add(K.box(x0 + 2, yR - .02, -3.6, x1 - 2, yR + .08, 3.6, 0), K.mat('nero', null, { tile: 'knurl', rep: [60, 1], r: .7 }));
    }
    if (o.scudo) rp_paracalore(A, Lr + 4, Lr + o.scudo, rb, K.mat('parker', null, { r: .6 }));
    const xMag = o.serb === 'bocca' ? xM - 20 : Lr + (o.serb || 300);
    rp_serbatoio(A, Lr - 3, xMag, ym, rm, mBar, K.mat(o.fin === 'parker' ? 'parker' : 'nero', null, { tile: 'knurl', rep: [2, 8], ns: .7 }));
    A.add(K.slab([[xMag - 26, ym], [xMag - 4, ym], [xMag - 4, -2, 2], [xMag - 26, -2, 2]], -6.4, 6.4, { b: 1.2 }), mBar);
    A.add(K.latheX([[xMag - 27, 0], [xMag - 27, rb + 2.2], [xMag - 3, rb + 2.2], [xMag - 3, 0]], { seg: 28 }), mBar);
    // ---------------- mire
    const yTop = o.costola ? rb + 5.2 : rb;
    if (o.mire === 'diottra') {
      const mS = K.mat('nero', null, { r: .45 }), yb = o.slitta ? yT + 9 : yT - .5, xr = o.slitta ? 30 : 20;
      A.add(K.slab([[xr - 12, yb], [xr + 12, yb], [xr + 10, yb + 6, 2], [xr - 10, yb + 6, 2]], -9, 9, { b: .8 }), mS);
      for (const s of [-1, 1]) A.add(K.slabX([[s * 5.5, yb + 4], [s * 9, yb + 4], [s * 8.4, yb + 19, 1.5], [s * 5.6, yb + 19, 1.5]], xr - 6, xr + 4, { b: .6 }), mS);
      const ring = K.latheX([[-2, 3.8], [-2, 6.2], [2, 6.2], [2, 3.8], [-1.99, 3.8]], { seg: 22 }); ring.translate(xr - 1, yb + 13, 0); A.add(ring, mS);
      A.add(K.slabX([[-1.6, yb + 4], [1.6, yb + 4], [1.6, yb + 7.2], [-1.6, yb + 7.2]], xr - 2.5, xr + .5, { b: .3 }), mS);
      // mirino a lama fra due orecchie su un collare della canna (la cima allineata con il centro della diottra)
      const xf = xM - 22, yP = yb + 13;
      A.add(K.latheX([[xf - 12, 0], [xf - 12, rb + 1.6], [xf + 12, rb + 1.6], [xf + 12, 0]], { seg: 26 }), mS);
      A.add(K.slab([[xf - 10, rb], [xf + 10, rb], [xf + 9, rb + 5, 1.5], [xf - 9, rb + 5, 1.5]], -7, 7, { b: .8 }), mS);
      for (const s of [-1, 1]) A.add(K.slabX([[s * 3.4, rb + 3], [s * 7, rb + 3], [s * 6.2, yP + 1.5, 1.4], [s * 3.6, yP + 1.5, 1.4]], xf - 5, xf + 5, { b: .5 }), mS);
      A.add(K.slab([[xf - 2.4, rb + 3], [xf + 2.4, rb + 3], [xf + 1.4, yP + .6, .4], [xf - 1.4, yP + .6, .4]], -1.3, 1.3, { b: .3 }), mS);
      A.add(K.discX(xf - 1.45, yP - .4, 0, .8, -1, 10), K.mat('verdefluo'));
      A.anchor('mira_post', [xr - 1, yP, 0]); A.anchor('mira_ant', [xf, yP + .6, 0]);
    } else {
      rp_perlina(A, xM - 7, yTop, o.perlina === 'bianca' ? K.mat('bianco') : K.mat('ottone'));
      if (o.costola) rp_perlina(A, xM - (xM - Lr) * .5, yTop, K.mat('bianco'));
      A.anchor('mira_post', [Lr - 10, yTop + 1.2, 0]); A.anchor('mira_ant', [xM - 7, yTop + 2.2, 0]);
    }
    // ---------------- astina (pompa: con le aste di comando; semiautomatico: fissa)
    const ast = o.astina || 'liscia', fissa = tipo === 'semi', xa0 = fissa ? Lr + 2 : Lr + (o.astX || 92), La = o.astL || (fissa ? 250 : 190);
    const pPump = fissa ? 'corpo' : 'pompa', yaT = o.astT || -1.5, yaB = ym - rm - (fissa ? 8 : 10), wa = o.astW || (fissa ? 21.5 : 23);
    const mA = mWood && ast !== 'tattica' ? mWood : (ast === 'scanalata' ? K.mat(o.poli || 'polimero', null, { tile: 'ribs', rep: [1, 14], ns: .9, r: .6 }) : ast === 'tattica' ? mPolyT : mPoly);
    const st = [];
    if (ast === 'anelli') {
      // astina corta ad anelli (presa a "pannocchia")
      const nR = o.anelli || 10, p = La / (nR + 1);
      st.push({ x: xa0, t: yaT - 3, b: yaB + 3, w: wa - 3, lin: true });
      for (let i = 0; i <= nR; i++) { const x = xa0 + 6 + i * p; st.push({ x, t: yaT, b: yaB, w: wa, lin: true }); if (i < nR) { st.push({ x: x + p * .55, t: yaT, b: yaB, w: wa, lin: true }); st.push({ x: x + p * .7, t: yaT - 2.6, b: yaB + 2.6, w: wa - 2.6, lin: true }); st.push({ x: x + p * .92, t: yaT - 2.6, b: yaB + 2.6, w: wa - 2.6, lin: true }); } }
      st.push({ x: xa0 + La, t: yaT - 3, b: yaB + 3, w: wa - 3, lin: true });
      A.add(K.loftX(st.map(s => Object.assign({ nt: 2.4, nb: 2.6 }, s)), { K: 30, step: 0 }), mA, pPump);
    } else if (fissa) {
      // astina fissa dei semiautomatici: più alta dietro (pistoni del gas), raccordata alla scatola
      const gas = o.gas ? 5 : 0;
      A.add(K.loftX([{ x: xa0 - 2, t: yaT + 2, b: yB + 16, w: hw - .6 }, { x: xa0 + 20, t: yaT + 2, b: yaB - gas, w: wa + gas * .6 }, { x: xa0 + 70, t: yaT + 1, b: yaB - gas, w: wa + gas * .6 }, { x: xa0 + 110, t: yaT, b: yaB, w: wa }, { x: xa0 + La - 14, t: yaT, b: yaB + 1, w: wa - .5 }, { x: xa0 + La, t: yaT - 2, b: yaB + 6, w: wa - 4 }].map(s => Object.assign({ nt: 2.6, nb: 2.8 }, s)), { K: 30, step: 6 }), mA, 'corpo');
    } else {
      // astina della pompa con incavi per le dita
      // astina della pompa: rigonfia al centro, con due solchi per le dita (versione liscia) o tutta zigrinata
      const sts = [{ x: xa0, t: yaT - 2, b: yaB + 4, w: wa - 4 }, { x: xa0 + 8, t: yaT, b: yaB, w: wa }];
      if (ast === 'liscia') for (const fx of [.32, .52]) { const x = xa0 + La * fx; sts.push({ x: x - 6, t: yaT, b: yaB - 1.2, w: wa + .4, lin: true }, { x: x - 2, t: yaT - 1.6, b: yaB + 1.4, w: wa - 1.6, lin: true }, { x: x + 2, t: yaT - 1.6, b: yaB + 1.4, w: wa - 1.6, lin: true }, { x: x + 6, t: yaT, b: yaB - 1.2, w: wa + .4, lin: true }); }
      else sts.push({ x: xa0 + La * .3, t: yaT, b: yaB - 1.5, w: wa + .6 });
      sts.push({ x: xa0 + La * .7, t: yaT, b: yaB - 1.5, w: wa + .6 }, { x: xa0 + La - 10, t: yaT, b: yaB + 1, w: wa - .5 }, { x: xa0 + La, t: yaT - 2.5, b: yaB + 5, w: wa - 4 });
      A.add(K.loftX(sts.map(s => Object.assign({ nt: 2.5, nb: 2.7 }, s)), { K: 30, step: 5 }), mA, pPump);
    }
    if (!fissa) {
      // aste di comando fra l'astina e l'otturatore (visibili quando l'astina è avanti)
      for (const s of [-1, 1]) A.add(K.box(Lr - 30, ym - 2.4, s > 0 ? rm + .4 : -rm - 2.2, xa0 + 12, ym + 2.4, s > 0 ? rm + 2.2 : -rm - .4, .3), K.mat('nero', null, { r: .4 }), 'pompa');
    }
    // ---------------- calcio
    const xE = tP - o.lop, D = -xE - 22, cal = o.calcio || 'pieno', mS = mWood || mPoly;
    const yTr = out.reduce((m, p) => (typeof p[0] !== 'string' && p[0] <= 1 ? Math.max(m, p[1]) : m), -99);
    let butt = null;
    if (cal === 'pieno' || cal === 'mono') {
      const dr = o.drop || 61, H = o.Hc || 132;
      const st = [{ x: 2, t: yTr - .5, b: yB + (o.scat === 'chiuso' ? 6 : 0), w: hw - .4 }, { x: -14, t: yTr - 4, b: yB - 9, w: 15 }, { x: -40, t: yTr - 9, b: yB - 30, w: 15.4 }, { x: -64, t: yTr - 14, b: yB - 47, w: 16.6 }, { x: -86, t: yTr - 18, b: yB - 41, w: 18 }, { x: -D * .6, t: yT - dr * .8, b: yT - dr * .8 - H * .86, w: 20.6 }, { x: -D, t: yT - dr, b: yT - dr - H, w: 21.6 }];
      A.add(K.loftX(st.map(s => Object.assign({ nt: 2.7, nb: 2.9 }, s)), { K: 32, step: 6 }), mS);
      butt = { x: -D, t: yT - dr, b: yT - dr - H, w: 21.6 };
    } else if (cal === 'pistola') {
      const dr = o.drop || 46, H = o.Hc || 128;
      const st = [{ x: 2, t: yTr - .5, b: yB, w: hw - .4 }, { x: -20, t: yTr - 3, b: yB - 6, w: 15.5 }, { x: -60, t: yT - dr * .45, b: yB - 16, w: 17.5 }, { x: -D * .55, t: yT - dr * .75, b: yT - dr * .75 - H * .78, w: 19.5 }, { x: -D, t: yT - dr, b: yT - dr - H, w: 21 }];
      A.add(K.loftX(st.map(s => Object.assign({ nt: 2.8, nb: 2.8 }, s)), { K: 32, step: 6 }), mS);
      A.add(rp_pistolaFucile([tP - 34, yB + 2], { rake: 20, L: 96, dita: 1.8 }), mPolyT);
      butt = { x: -D, t: yT - dr, b: yT - dr - H, w: 21 };
    } else if (cal === 'telescopico') {
      // tubo guida, calcio scorrevole con appoggio per la guancia, impugnatura a pistola
      const yt = yTr - 16, mA2 = K.mat('anod', null, { r: .5 });
      A.add(K.latheX([[2, 0], [2, 15.5], [-6, 15.5], [-8, 14.6], [-D + 40, 14.6], [-D + 40, 0]], { seg: 28, cy: yt }), mA2);
      const xs = -D + 8;
      A.add(K.slab([[xs, yt + 18, 4], [xs + 108, yt + 18, 6], [xs + 112, yt + 4, 3], [xs + 100, yt - 16, 4], [xs + 50, yt - 24, 10], [xs + 10, yt - 100, 6], [xs, yt - 104, 2]], -19, 19, { b: 4, bs: 4 }), mPoly);
      A.add(K.slab([[xs + 14, yt + 17], [xs + 100, yt + 17], [xs + 96, yt + 27, 6], [xs + 22, yt + 29, 8]], -15, 15, { b: 5, bs: 4 }), mPolyT);
      A.add(rp_pistolaFucile([tP - 34, yB + 2], { rake: 18, L: 98, dita: 2 }), mPolyT);
      A.add(K.slab([[-D - 22, yt + 18, 3], [xs, yt + 18, 1], [xs, yt - 104, 1], [-D - 22, yt - 100, 6]], -19.5, 19.5, { b: 5, bs: 4 }), K.mat('gomma', null, { tile: 'stipple', rep: [3, 4], ns: .4 }));
      butt = null; A.anchor('calcio', [-D - 22, yt - 40, 0]);
    } else if (cal === 'solo_pistola') {
      // impugnatura a becco d'uccello montata sul retro della scatola (niente calcio)
      const st = [{ p: [8, yB + 26], f: 19, r: 16, w: hw - .3 }, { p: [-6, yB + 4], f: 19, r: 16, w: 16.4 }, { p: [-22, yB - 22], f: 17, r: 16.5, w: 17.4 }, { p: [-38, yB - 48], f: 16, r: 18, w: 18 }, { p: [-52, yB - 68], f: 16, r: 22, w: 18.6 }, { p: [-60, yB - 80], f: 14, r: 25, w: 17.6 }, { p: [-63, yB - 85], f: 10, r: 22, w: 15 }];
      A.add(K.loftS(st.map(s => Object.assign({ nf: 2.4, nr: 2.6 }, s)), { K: 28, sub: 4 }), mPolyT);
      A.anchor('calcio', [-80, yB - 80, 0]);
    }
    if (butt) {
      // calciolo in gomma
      A.add(K.loftX([{ x: butt.x - 22, t: butt.t - 1, b: butt.b + 1, w: butt.w - .6 }, { x: butt.x - 18, t: butt.t + .3, b: butt.b - .3, w: butt.w + .3 }, { x: butt.x + .5, t: butt.t + .3, b: butt.b - .3, w: butt.w + .3 }].map(s => Object.assign({ nt: 2.7, nb: 2.9 }, s)), { K: 32, step: 0 }), K.mat('gomma', null, { tile: 'grana', rep: [3, 6], ns: .4 }));
      A.add(K.latheX([[0, 0], [0, 3.4], [3, 3], [4.5, 0]], { seg: 12 }).rotateZ(-PI / 2).translate(butt.x + 62, butt.b + 15.5, 0), K.mat('brunito'));
      WC.put(A, WC.swivel(butt.x + 62, butt.b + 7, 0, { r: 5.5, t: 1.1 }));
      A.anchor('calcio', [butt.x - 22, (butt.t + butt.b) / 2, 0]);
    }
    // ---------------- punti di riferimento
    A.anchor('bocca', [xM + .5, 0, 0]);
    if (o.espulsione === 'sotto') A.anchor('espulsione', [Lr - 60, yB, 0], [0, -1, .15]); else A.anchor('espulsione', [Lr - 62, 2, hw], [0, .35, 1]);
    A.anchor('impugnatura', cal === 'pieno' || cal === 'mono' ? [-52, yB - 26, 0] : [tP - 52, yB - 46, 0]);
    A.anchor('grilletto', [tP + 2, yB - 14, 0]);
    A.anchor('appoggio', [xa0 + La * .45, yaB - 2, 0]);
    const r = A.done();
    const ciclo = { grilletto: { rz: -.16 } };
    if (tipo === 'semi') ciclo.otturatore = { dx: -.075 };
    r.info = { azione: tipo === 'semi' ? 'semi' : 'pompa', bossolo: 'cal12', ciclo,
      manuale: tipo === 'semi' ? undefined : [tipo === 'doppio' ? { pompa: { dx: -.088 }, otturatore: { dx: -.088 } } : { pompa: { dx: -.088 } }],
      ricarica: tipo === 'semi' ? { otturatore: { dx: -.075 } } : { pompa: { dx: -.088 } } };
    if (tipo === 'doppio') r.info.doppio = { azione: 'semi', ciclo: { otturatore: { dx: -.075 }, grilletto: { rz: -.16 } } };
    if (!r.info.manuale) delete r.info.manuale;
    return r;
  };

  // gruppo di scatto comune ai fucili speciali: ponticello in polimero, grilletto, impugnatura a pistola
  function rp_scattoFucile(A, tP, yB, o) {
    o = o || {};
    const TG = [[tP + 38, yB + 3], [tP + 38.5, yB - 8], ['c', tP + 39, yB - 24, tP + 30, yB - 32, tP + 12, yB - 32], [tP - 18, yB - 32], ['c', tP - 30, yB - 32, tP - 36, yB - 22, tP - 37, yB - 8], [tP - 37, yB + 3], [tP - 31, yB + 1], [tP - 31, yB - 8], ['c', tP - 30, yB - 20, tP - 26, yB - 26.5, tP - 16, yB - 26.5], [tP + 10, yB - 26.5], ['c', tP + 26, yB - 26.5, tP + 32.5, yB - 21, tP + 32.5, yB - 8], [tP + 32.5, yB + 1]];
    A.add(K.slab(TG, -5.8, 5.8, { b: 1.6, bs: 3 }), o.mat || K.mat('polimero', null, { r: .55 }));
    A.add(K.slab([[tP - 1.5, yB], [tP + 3.6, yB], ['c', tP + 6.6, yB - 7, tP + 6, yB - 15, tP + 1, yB - 22.5], [tP - 1.8, yB - 21.6, 1], ['c', tP + 2, yB - 15, tP + 2, yB - 8, tP - 1.6, yB - 3]], -3.4, 3.4, { b: .9, bs: 3 }), K.mat('nero', null, { r: .4 }), 'grilletto');
    A.pivot('grilletto', [tP + 2, yB - 1, 0]);
    A.add(rp_pistolaFucile([tP - 33, yB + 3], { rake: o.rake || 19, L: o.L || 100, dita: o.dita === undefined ? 2 : o.dita, f: o.f, r: o.r, w: o.w }), o.matG || K.mat('polimero', null, { tile: 'stipple', rep: [6, 3], ns: .5 }));
  }

  // ================================================================== fucile da combattimento a doppio funzionamento con paracalore forato
  // (astina della pompa grande, leva di armamento laterale, calcio pieghevole in lamiera con gancio)
  FAM2.fucile_combattimento_scudo = function (spec, o) {
    o = o || {};
    const A = K.asm('fucile_combattimento_scudo'), Lr = 236, yT = 17, yB = -46, hw = 16, rb = 10.6, rm = 11.6, ym = -27, tP = 66;
    const xM = Lr - 24 + (o.canna || 546), mDark = K.mat('nero_lucido', null, { c: '#050505', r: .75 });
    const mBar = K.mat('nero', null, { r: .45 }), mPoly = K.mat('polimero', null, { r: .62 });
    // ---------------- scatola di culatta in lega
    const out = [[Lr, yT, 2, .6], [26, yT, 6, .9], [8, yT - 3, 4, .8], [0, yT - 8, 2, .7], [0, yB + 10, 3, .5], [12, yB, 3, .4], [Lr - 6, yB, 2, .4], [Lr, yB + 6, 3, .5]];
    const port = [[Lr - 104, -12, 2, .2], [Lr - 30, -12, 2, .2], [Lr - 30, yT - 6, 2, .2], [Lr - 104, yT - 6, 2, .2]];
    const rb_ = [-2, yB - 2, Lr + 2, yT + 4];
    const pR = K.painter(rb_, { w: 1024, h: 512, rough: .5 });
    pR.text('L', rp_up(spec.produttore), Lr * .55, 6, 4, { spacing: 8, a: .58 }); pR.text('L', rp_up(spec.nome) + '  CAL. 12', Lr * .55, -3, 3.2, { spacing: 8, a: .58 });
    pR.text('R', rp_matr(spec, 'OB'), 70, yB + 9, 2.2, { a: .58 });
    pR.fill('R', port, { a: .12, r: .9 });
    for (const [x, y] of [[tP - 30, yB + 7], [tP + 34, yB + 7], [Lr - 20, yB + 14]]) pR.pin('LR', x, y, 2.4, { h: .35, a: 1.06 });
    pR.fill('LR', [[Lr - 120, yB + 3], [Lr - 10, yB + 3], [Lr - 10, yB + 5], [Lr - 120, yB + 5]], { h: -.6, a: .7 });
    pR.noise({ a: .1, r: .14, seed: 51 }); pR.walls({ r: .5 });
    const mR = K.mat('anod', pR.done(2.2), { ns: .8, r: .5 });
    A.add(K.slab(out, -hw, 0, { bL: 3, bR: 0, uv: rb_, bs: 4 }), mR);
    A.add(K.slab(out, 0, hw, { bL: 0, bR: 3, uv: rb_, bs: 4, holes: [port] }), mR);
    // otturatore con la grossa leva di armamento a destra
    const mBolt = K.mat('grigio', null, { c: '#8b8e91', m: .9, r: .28 });
    A.add(K.box(Lr - 112, -11, 1, Lr - 27, yT - 7, hw - 1.6, .6), mBolt, 'otturatore');
    A.add(K.slab([[Lr - 74, -7, 2], [Lr - 56, -7, 2], [Lr - 58, 5, 2], [Lr - 72, 5, 2]], hw - 3, hw + 15, { b: 1.4 }), K.mat('nero', null, { r: .4 }), 'otturatore');
    // ---------------- gruppo di scatto e impugnatura a pistola
    rp_scattoFucile(A, tP, yB, { dita: 2.2 });
    A.add(K.latheX([[-8, 0], [-8, 3.4], [8, 3.4], [8, 0]], { seg: 14 }).rotateY(PI / 2).translate(tP + 33, yB - 5, 0), K.mat('nero', null, { r: .5 }));
    // ---------------- canna, paracalore forato (con fori passanti), serbatoio, astina della pompa
    rp_cannaLiscia(A, Lr - 6, xM, rb, { mat: mBar });
    const xs0 = Lr + 2, xs1 = xM - 46, holes = [];
    for (let x = xs0 + 18, k = 0; x < xs1 - 16; x += 21, k++) for (const [y, dx] of [[10.4, 0], [-1.6, 10.5]]) if (x + dx < xs1 - 14) holes.push(K.circ(x + dx, y, 4.6, 12));
    A.add(K.slab([[xs0, -9.5, 2, .5], [xs1, -9.5, 2, .5], [xs1, rb + 7.4, 5, 1], [xs0, rb + 7.4, 4, 1]], -15.6, 15.6, { b: 7.2, holes, bs: 4 }), K.mat('parker', null, { c: '#4a4d4a', r: .6 }));
    A.add(K.latheX([[xs1 - 1, 0], [xs1 - 1, rb + 5.8], [xs1 + 18, rb + 5.8], [xs1 + 20, rb + 3], [xs1 + 20, 0]], { seg: 28 }), mBar);
    A.add(K.slab([[xs1 + 2, rb + 3], [xs1 + 16, rb + 3], [xs1 + 14, rb + 13, 1], [xs1 + 7, rb + 13, 1]], -1.4, 1.4, { b: .4 }), mBar);
    for (const s of [-1, 1]) A.add(K.slabX([[s * 3.6, rb + 4], [s * 6.6, rb + 4], [s * 6, rb + 14, 1.2], [s * 3.8, rb + 14, 1.2]], xs1 + 4, xs1 + 14, { b: .5 }), mBar);
    const xMag = xM - 66;
    rp_serbatoio(A, Lr - 3, xMag, ym, rm, mBar, K.mat('nero', null, { tile: 'knurl', rep: [2, 8], ns: .7 }));
    A.add(K.slab([[xMag - 24, ym], [xMag - 4, ym], [xMag - 4, -2, 2], [xMag - 24, -2, 2]], -7, 7, { b: 1.2 }), mBar);
    // astina della pompa, grande, a nervature
    const xa0 = Lr + 26, La = 236, mA = K.mat('polimero', null, { tile: 'ribs', rep: [1, 16], ns: .9, r: .6 });
    A.add(K.loftX([{ x: xa0, t: -9, b: -44, w: 19 }, { x: xa0 + 10, t: -5, b: -50, w: 24 }, { x: xa0 + 120, t: -5, b: -52, w: 24.6 }, { x: xa0 + La - 14, t: -5, b: -50, w: 24 }, { x: xa0 + La, t: -9, b: -44, w: 19 }].map(s => Object.assign({ nt: 2.6, nb: 3 }, s)), { K: 32, step: 6 }), mA, 'pompa');
    A.add(K.latheX([[0, 0], [0, 4.4], [1.8, 4.4], [2.4, 0]], { seg: 16 }).rotateZ(-PI / 2).translate(xa0 + La - 30, -52, 0), K.mat('nero', null, { r: .4 }), 'pompa');
    for (const s of [-1, 1]) A.add(K.box(Lr - 30, ym - 2.4, s > 0 ? rm + .4 : -rm - 2.2, xa0 + 12, ym + 2.4, s > 0 ? rm + 2.2 : -rm - .4, .3), K.mat('nero', null, { r: .4 }), 'pompa');
    // ---------------- diottra posteriore
    const mS = K.mat('nero', null, { r: .45 });
    A.add(K.slab([[16, yT - .5], [44, yT - .5], [42, yT + 4, 2], [18, yT + 4, 2]], -9, 9, { b: .8 }), mS);
    const ring = K.latheX([[-2, 3.6], [-2, 5.8], [2, 5.8], [2, 3.6], [-1.99, 3.6]], { seg: 22 }); ring.translate(26, yT + 10, 0); A.add(ring, mS);
    A.add(K.slabX([[-1.6, yT + 3], [1.6, yT + 3], [1.6, yT + 4.6], [-1.6, yT + 4.6]], 24, 28, { b: .3 }), mS);
    // ---------------- calcio pieghevole in lamiera (aperto) con il gancio ripiegato sotto
    const mSt = K.mat('nero', null, { r: .5 });
    A.add(K.slab([[-8, yT - 2, 3], [4, yT - 2, 2], [4, yT - 16, 2], [-8, yT - 16, 3]], -hw + 1, hw - 1, { b: 2 }), mSt);
    A.add(K.slab([[-2, yT - 2, 2], [-262, -16, 2], [-262, -38, 2], [-2, yT - 20, 2]], -13.5, 13.5, { b: 2.4, bs: 3 }), mSt);
    A.add(K.box(-250, -36, -11, -14, -31, 11, .8), mDark);
    A.add(K.slab([[-282, -10, 4], [-262, -12, 2], [-262, -128, 3], [-282, -132, 6], ['c', -286, -100, -287, -40, -282, -10]], -20, 20, { b: 4, bs: 4 }), mSt);
    A.add(K.slab([[-286.5, -14, 3], [-281, -14, 1], [-281, -130, 1], [-286.5, -128, 4], ['c', -290, -100, -291, -40, -286.5, -14]], -19, 19, { b: 3.4, bs: 4 }), K.mat('gomma', null, { tile: 'grana', rep: [2, 6], ns: .4 }));
    A.add(K.slab([[-258, -118, 3], [-206, -112, 6], ['c', -196, -110, -192, -100, -199, -94], [-205, -97, 2], ['c', -201, -102, -204, -106, -212, -106], [-258, -110, 3]], -4.4, 4.4, { b: 1.2, bs: 3 }), mSt);
    A.add(K.slab([[-262, -34], [-246, -34], [-258, -110], [-262, -110]], -6, 6, { b: 1 }), mSt);
    // ---------------- punti di riferimento
    A.anchor('bocca', [xM + .5, 0, 0]); A.anchor('espulsione', [Lr - 66, 2, hw], [0, .35, 1]);
    A.anchor('impugnatura', [tP - 52, yB - 46, 0]); A.anchor('grilletto', [tP + 2, yB - 14, 0]); A.anchor('appoggio', [xa0 + La * .45, -54, 0]);
    A.anchor('mira_post', [26, yT + 10, 0]); A.anchor('mira_ant', [xs1 + 10.5, rb + 13, 0]); A.anchor('calcio', [-288, -70, 0]);
    const r = A.done();
    r.info = { azione: 'pompa', bossolo: 'cal12', ciclo: { grilletto: { rz: -.16 } }, manuale: [{ pompa: { dx: -.09 }, otturatore: { dx: -.09 } }],
      ricarica: { pompa: { dx: -.09 }, otturatore: { dx: -.09 } }, doppio: { azione: 'semi', ciclo: { otturatore: { dx: -.08 }, grilletto: { rz: -.16 } } } };
    return r;
  };

  // ================================================================== fucile da combattimento a doppio funzionamento con caricatore amovibile
  // (maniglia di trasporto con la diottra, cilindro del gas sotto la canna con l'astina della pompa, calcio tubolare ripiegabile)
  FAM2.fucile_combattimento_caricatore = function (spec, o) {
    o = o || {};
    const A = K.asm('fucile_combattimento_caricatore'), Lr = 262, yT = 20, yB = -44, hw = 17, rb = 10.6, tP = 70;
    const xM = Lr - 24 + (o.canna || 450), mDark = K.mat('nero_lucido', null, { c: '#050505', r: .75 });
    const mBar = K.mat('nero', null, { r: .45 }), mPoly = K.mat('polimero', null, { r: .62 });
    // ---------------- scatola di culatta squadrata in lega
    const out = [[Lr, yT, 2, .6], [12, yT, 4, .9], [0, yT - 6, 2, .7], [0, yB, 2, .4], [Lr, yB, 2, .4]];
    const port = [[Lr - 112, -12, 2, .2], [Lr - 34, -12, 2, .2], [Lr - 34, yT - 8, 2, .2], [Lr - 112, yT - 8, 2, .2]];
    const rb_ = [-2, yB - 2, Lr + 2, yT + 2];
    const pR = K.painter(rb_, { w: 1024, h: 512, rough: .5 });
    pR.text('L', rp_up(spec.produttore), Lr * .5, 6, 4, { spacing: 8, a: .58 }); pR.text('L', rp_up(spec.nome) + '  CAL. 12', Lr * .5, -3.5, 3.2, { spacing: 8, a: .58 });
    pR.text('R', rp_matr(spec, 'OB'), 60, yB + 9, 2.2, { a: .58 }); pR.fill('R', port, { a: .12, r: .9 });
    for (const [x, y] of [[tP - 30, yB + 7], [tP + 34, yB + 7], [Lr - 16, yB + 12], [Lr - 16, 10]]) pR.pin('LR', x, y, 2.4, { h: .35, a: 1.06 });
    pR.fill('LR', [[8, yB + 16], [Lr - 130, yB + 16], [Lr - 130, yB + 18], [8, yB + 18]], { h: -.6, a: .7 });
    pR.noise({ a: .1, r: .14, seed: 52 }); pR.walls({ r: .5 });
    const mR = K.mat('anod', pR.done(2.2), { ns: .8, r: .5 });
    A.add(K.slab(out, -hw, 0, { bL: 3, bR: 0, uv: rb_, bs: 4 }), mR);
    A.add(K.slab(out, 0, hw, { bL: 0, bR: 3, uv: rb_, bs: 4, holes: [port] }), mR);
    A.add(K.box(Lr - 120, -11, 1, Lr - 31, yT - 9, hw - 1.6, .6), K.mat('grigio', null, { c: '#8b8e91', m: .9, r: .28 }), 'otturatore');
    // maniglia di trasporto con la diottra
    const mH = K.mat('anod', null, { r: .5 });
    A.add(K.slab([[30, yT - 1, 2], [58, yT - 1, 2], [52, yT + 30, 4], [36, yT + 30, 4]], -6.5, 6.5, { b: 1.4 }), mH);
    A.add(K.slab([[Lr - 70, yT - 1, 2], [Lr - 44, yT - 1, 2], [Lr - 52, yT + 30, 4], [Lr - 66, yT + 30, 4]], -6.5, 6.5, { b: 1.4 }), mH);
    A.add(K.slab([[34, yT + 26, 4], [Lr - 50, yT + 26, 4], [Lr - 50, yT + 37, 5], [34, yT + 37, 5]], -8, 8, { b: 2.4 }), mH);
    A.add(K.box(70, yT + 36.9, -6.5, Lr - 90, yT + 37.1, 6.5, 0), K.mat('nero', null, { tile: 'knurl', rep: [30, 2], r: .7 }));
    const ring = K.latheX([[-2, 3.4], [-2, 6], [2, 6], [2, 3.4], [-1.99, 3.4]], { seg: 22 }); ring.translate(46, yT + 19, 0); A.add(ring, mH);
    // ---------------- caricatore amovibile e pozzetto
    const xm0 = tP + 46, xm1 = tP + 130;
    A.add(K.slab([[xm0 - 6, yB + 2, 2], [xm1 + 6, yB + 2, 2], [xm1 + 6, yB - 12, 3], [xm0 - 6, yB - 12, 3]], -hw + 1, hw - 1, { b: 2 }), mR);
    const mMag = K.mat('polimero', null, { r: .55 });
    A.add(K.slab([[xm0, yB - 4, 3], [xm1, yB - 4, 3], [xm1 + 6, yB - 130, 6], [xm0 + 4, yB - 130, 6]], -14, 14, { b: 2.4, bs: 3 }), mMag, 'caricatore');
    A.add(K.slab([[xm0 + 2, yB - 128], [xm1 + 8, yB - 128], [xm1 + 9, yB - 138, 2], [xm0 + 1, yB - 138, 2]], -15.4, 15.4, { b: 1.6 }), mMag, 'caricatore');
    for (let i = 0; i < 4; i++) A.add(K.box(xm0 + 14, yB - 30 - i * 24, 13.6, xm1 - 8, yB - 27 - i * 24, 14.3, .3), mMag, 'caricatore');
    A.pivot('caricatore', [(xm0 + xm1) / 2, yB, 0]);
    // ---------------- gruppo di scatto e impugnatura a pistola
    rp_scattoFucile(A, tP, yB, { dita: 2.2 });
    // ---------------- canna, cilindro del gas, astina della pompa, mirino su colonnino
    rp_cannaLiscia(A, Lr - 6, xM, rb, { mat: mBar });
    A.add(K.latheX([[Lr - 4, 0], [Lr - 4, 9.4], [Lr + 286, 9.4], [Lr + 290, 7], [Lr + 290, 0]], { seg: 26, cy: -23 }), mBar);
    A.add(K.slab([[Lr + 276, -23], [Lr + 296, -23], [Lr + 296, -2, 2], [Lr + 276, -2, 2]], -6.5, 6.5, { b: 1.2 }), mBar);
    const xa0 = Lr + 28, La = 206, mA = K.mat('polimero', null, { tile: 'ribs', rep: [1, 14], ns: .9, r: .6 });
    A.add(K.loftX([{ x: xa0, t: -8, b: -38, w: 16 }, { x: xa0 + 10, t: -3, b: -45, w: 20.5 }, { x: xa0 + La - 10, t: -3, b: -45, w: 20.5 }, { x: xa0 + La, t: -8, b: -38, w: 16 }].map(s => Object.assign({ nt: 2.4, nb: 3 }, s)), { K: 30, step: 6 }), mA, 'pompa');
    const xf = xM - 58;
    A.add(K.slab([[xf - 14, -12, 2], [xf + 12, -12, 2], [xf + 8, rb + 6, 3], [xf + 2, yT + 18, 2], [xf - 6, yT + 18, 2], [xf - 12, rb + 6, 3]], -7, 7, { b: 1.4 }), mBar);
    for (const s of [-1, 1]) A.add(K.slabX([[s * 3.2, yT + 10], [s * 6.4, yT + 10], [s * 5.8, yT + 27, 1.2], [s * 3.4, yT + 27, 1.2]], xf - 7, xf + 3, { b: .5 }), mBar);
    A.add(K.slab([[xf - 4, yT + 12], [xf, yT + 12], [xf - .5, yT + 24.5, .4], [xf - 3.5, yT + 24.5, .4]], -1.2, 1.2, { b: .3 }), mBar);
    // ---------------- calcio tubolare ripiegabile (aperto) con calciolo in gomma
    const mT = K.mat('nero', null, { r: .45 });
    A.add(K.slab([[-12, yT - 4, 3], [2, yT - 4, 2], [2, yB + 6, 2], [-12, yB + 6, 3]], -hw + 2, hw - 2, { b: 2 }), mT);
    const tubo = (a, b, r) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]); return K.rod(0, L, r, { seg: 16 }).rotateZ(Math.atan2(b[1] - a[1], b[0] - a[0])).translate(a[0], a[1], 0); };
    for (const s of [-1, 1]) { A.add(tubo([-6, 8], [-242, -12], 6).translate(0, 0, s * 9), mT); A.add(tubo([-6, -30], [-242, -96], 6).translate(0, 0, s * 9), mT); }
    A.add(K.slab([[-250, -4, 3], [-238, -4, 2], [-238, -106, 2], [-250, -108, 4]], -18, 18, { b: 3 }), mT);
    A.add(K.slab([[-268, -2, 4], [-249, -2, 1], [-249, -110, 1], [-268, -112, 5]], -19, 19, { b: 4, bs: 4 }), K.mat('gomma', null, { tile: 'grana', rep: [2, 6], ns: .4 }));
    // ---------------- punti di riferimento
    A.anchor('bocca', [xM + .5, 0, 0]); A.anchor('espulsione', [Lr - 72, 2, hw], [0, .35, 1]);
    A.anchor('impugnatura', [tP - 52, yB - 46, 0]); A.anchor('grilletto', [tP + 2, yB - 14, 0]); A.anchor('appoggio', [xa0 + La * .45, -47, 0]);
    A.anchor('mira_post', [46, yT + 19, 0]); A.anchor('mira_ant', [xf - 2, yT + 24.5, 0]); A.anchor('calcio', [-268, -56, 0]);
    const r = A.done();
    r.info = { azione: 'pompa', bossolo: 'cal12', ciclo: { grilletto: { rz: -.16 } }, manuale: [{ pompa: { dx: -.085 }, otturatore: { dx: -.085 } }],
      ricarica: { caricatore: { dx: .008, dy: -.13 } }, doppio: { azione: 'semi', ciclo: { otturatore: { dx: -.08 }, grilletto: { rz: -.16 } } } };
    return r;
  };

  // ================================================================== fucile a pompa bullpup con due serbatoi tubolari affiancati
  // x = 0 retro del calciolo; espulsione dal basso dietro l'impugnatura; slitta superiore per tutta la lunghezza
  FAM2.fucile_bullpup_doppio = function (spec, o) {
    o = o || {};
    const A = K.asm('fucile_bullpup_doppio'), xM = o.L || 663, rb = 10.3, ym = -26, zm = 13.4, rm = 12, tP = 296, hw = 28;
    const mDark = K.mat('nero_lucido', null, { c: '#050505', r: .75 }), mBar = K.mat('nero', null, { r: .42 });
    // ---------------- guscio in polimero (contiene scatola, serbatoi e calcio)
    const out = [[2, 24, 4, .8], [344, 24, 4, .8], [352, 14, 4, .6], [352, -50, 5, .4], [336, -58, 4, .4], [248, -58, 3, .4], [212, -60, 6, .4], [2, -76, 6, .4]];
    const sb = [0, -78, 354, 26];
    const pS = K.painter(sb, { w: 1024, h: 512, rough: .66 });
    pS.text('L', rp_up(spec.produttore), 140, 2, 5, { spacing: 10, a: .7 }); pS.text('L', rp_up(spec.nome) + '  CAL. 12', 140, -9, 3.6, { spacing: 8, a: .7 });
    pS.text('R', rp_matr(spec, 'BW'), 140, -6, 2.4, { a: .7 });
    pS.fill('LR', [[20, -66, 4], [190, -56, 4], [190, -20, 4], [20, -20, 4]], { h: -.3, a: .92 });
    pS.stipple('LR', [[24, -62], [186, -53], [186, -24], [24, -24]], { s: .3, r: .82 });
    for (const [x, y] of [[60, 12], [200, 12], [300, 12], [320, -36]]) pS.pin('LR', x, y, 2.6, { h: .35, a: 1.1 });
    pS.line('LR', [[350, 18], [260, 18], [230, -40], [205, -58]], .4, { h: -.6, a: .7 });
    pS.noise({ a: .06, r: .1, seed: 61 }); pS.walls({ r: .66 });
    const mSh = K.mat('polimero', pS.done(2.0), { ns: .7 });
    A.add(K.slab(out, -hw, hw, { b: 7, uv: sb, bs: 4 }), mSh);
    // calciolo in gomma
    A.add(K.slab([[-14, 22, 3], [3, 22, 1], [3, -74, 1], [-14, -76, 6]], -hw + .5, hw - .5, { b: 5, bs: 4 }), K.mat('gomma', null, { tile: 'grana', rep: [2, 6], ns: .4 }));
    // finestra di espulsione sul fondo, dietro l'impugnatura
    A.add(K.box(110, -71.5, -15, 196, -60, 15, 1), mDark);
    A.add(K.box(116, -64, -12, 190, -59, 12, .5), K.mat('grigio', null, { c: '#8b8e91', m: .9, r: .3 }));
    // ---------------- gruppo di scatto, impugnatura, selettore dei serbatoi
    rp_scattoFucile(A, tP, -56, { dita: 2.2, rake: 18 });
    A.add(K.slab([[214, -60], [232, -62], [232, -70, 2], [214, -68, 2]], -6, 6, { b: 1 }), K.mat('nero', null, { tile: 'knurl', rep: [3, 1], ns: .8 }));
    // ---------------- canna e serbatoi gemelli scoperti davanti al guscio
    rp_cannaLiscia(A, 340, xM, rb, { mat: mBar, cam: 4 });
    for (const s of [-1, 1]) A.add(K.latheX([[350, 0], [350, rm], [xM - 74, rm], [xM - 74, 0]], { seg: 26, cy: ym, cz: s * zm }), mBar);
    // supporto anteriore (regge serbatoi e slitta)
    A.add(K.slab([[xM - 80, -44, 3], [xM - 62, -44, 3], [xM - 62, 22, 3], [xM - 80, 22, 3]], -hw + 2, hw - 2, { b: 3, holes: [] }), mSh);
    // slitta superiore continua
    WC.put(A, WC.rail(150, xM - 62, 23.5, { mat: K.mat('anod', null, { r: .45 }) }));
    // mire abbattibili (abbassate) sulla slitta
    const mS = K.mat('nero', null, { r: .45 });
    A.add(K.slab([[176, 32.5], [200, 32.5], [200, 38, 2], [180, 40, 2]], -8, 8, { b: .8 }), mS);
    A.add(K.slab([[xM - 92, 32.5], [xM - 68, 32.5], [xM - 70, 40, 2], [xM - 88, 38, 2]], -8, 8, { b: .8 }), mS);
    // ---------------- astina della pompa attorno ai due serbatoi, con slitta corta sotto
    const xa0 = 392, La = 150, mA = K.mat('polimero', null, { tile: 'ribs', rep: [1, 18], ns: .8, r: .62 });
    A.add(K.loftX([{ x: xa0, t: -8, b: -44, w: 24 }, { x: xa0 + 8, t: -5, b: -48, w: 29 }, { x: xa0 + La - 8, t: -5, b: -48, w: 29 }, { x: xa0 + La, t: -8, b: -44, w: 24 }].map(s => Object.assign({ nt: 3.2, nb: 3.6 }, s)), { K: 32, step: 6 }), mA, 'pompa');
    WC.put(A, WC.rail(xa0 + 30, xa0 + La - 22, -47, { dir: 'giu', mat: K.mat('polimero', null, { r: .55 }) }), 'pompa');
    for (const s of [-1, 1]) A.add(K.box(352 - 30, ym - 2.4, s * (zm + rm + .4) - (s < 0 ? 1.8 : 0), xa0 + 12, ym + 2.4, s * (zm + rm + .4) + (s > 0 ? 1.8 : 0), .3), mBar, 'pompa');
    // ---------------- punti di riferimento
    A.anchor('bocca', [xM + .5, 0, 0]); A.anchor('espulsione', [152, -72, 0], [0, -1, -.1]);
    A.anchor('impugnatura', [tP - 52, -56 - 46, 0]); A.anchor('grilletto', [tP + 2, -70, 0]); A.anchor('appoggio', [xa0 + La * .5, -52, 0]);
    A.anchor('mira_post', [188, 40, 0]); A.anchor('mira_ant', [xM - 80, 40, 0]); A.anchor('calcio', [-14, -26, 0]);
    const r = A.done();
    r.info = { azione: 'pompa', bossolo: 'cal12', ciclo: { grilletto: { rz: -.16 } }, manuale: [{ pompa: { dx: -.085 } }], ricarica: { pompa: { dx: -.085 } } };
    return r;
  };

  // ================================================================== voci del catalogo: fucili (id 125-138)
  MAP2[125] = { f: 'fucile_liscio', o: { tipo: 'pompa', scat: 'tondo', fin: 'nero', canna: 356, serb: 'bocca', astina: 'tattica', calcio: 'solo_pistola', mire: 'perlina', astX: 70, astL: 176 } };
  MAP2[126] = { f: 'fucile_liscio', o: { tipo: 'pompa', scat: 'squadro', fin: 'anod', canna: 470, serb: 300, astina: 'scanalata', calcio: 'pieno', mire: 'perlina', sicura: 'codetta', tP: 60, lop: 335, Lr: 215, perlina: 'bianca' } };
  MAP2[127] = { f: 'fucile_liscio', o: { tipo: 'pompa', scat: 'chiuso', fin: 'brunito', canna: 508, serb: 'bocca', astina: 'anelli', astL: 150, astX: 96, calcio: 'pieno', legno: 'noce', mire: 'perlina', espulsione: 'sotto', ponticello: 'metallo', drop: 58 } };
  MAP2[128] = { f: 'fucile_liscio', o: { tipo: 'pompa', scat: 'lega', fin: 'brunito', canna: 660, costola: true, serb: 270, astina: 'liscia', calcio: 'pieno', legno: 'noce', mire: 'perlina', ponticello: 'metallo', sicura: 'avanti' } };
  MAP2[129] = { f: 'fucile_combattimento_scudo', o: { canna: 546 } };
  MAP2[130] = { f: 'fucile_liscio', o: { tipo: 'doppio', scat: 'semi', fin: 'anod', canna: 500, serb: 'bocca', astina: 'tattica', calcio: 'pistola', mire: 'diottra', sicura: 'avanti', astX: 60, astL: 200 } };
  MAP2[131] = { f: 'fucile_liscio', o: { tipo: 'semi', scat: 'semi', fin: 'anod', canna: 470, serb: 'bocca', astina: 'fissa', gas: true, calcio: 'telescopico', mire: 'diottra', slitta: true, sicura: 'avanti', Lr: 226, tP: 58, lop: 372, astL: 270 } };
  MAP2[132] = { f: 'fucile_combattimento_caricatore', o: { canna: 450 } };
  MAP2[133] = { f: 'fucile_liscio', o: { tipo: 'pompa', scat: 'squadro', fin: 'parker', canna: 508, scudo: 250, serb: 'bocca', astina: 'scanalata', calcio: 'pieno', mire: 'perlina', sicura: 'codetta', ponticello: 'metallo', tP: 60, lop: 350, Lr: 215, otturatoreChiaro: false } };
  MAP2[134] = { f: 'fucile_liscio', o: { tipo: 'pompa', scat: 'poli', fin: 'polimero', poli: 'poligrigio', canna: 470, serb: 'bocca', astina: 'scanalata', calcio: 'mono', mire: 'perlina', yT: 16, otturatoreChiaro: false } };
  MAP2[135] = { f: 'fucile_liscio', o: { tipo: 'pompa', scat: 'poli', fin: 'polimero', canna: 470, serb: 'bocca', astina: 'tattica', calcio: 'pistola', mire: 'diottra', yT: 16, otturatoreChiaro: false } };
  MAP2[136] = { f: 'fucile_liscio', o: { tipo: 'semi', scat: 'semi2', fin: 'anod', canna: 470, serb: 330, astina: 'fissa', calcio: 'pieno', mire: 'diottra', slitta: true, sicura: 'avanti', lop: 345, astL: 240 } };
  MAP2[137] = { f: 'fucile_bullpup_doppio', o: { L: 663 } };
  MAP2[138] = { f: 'fucile_liscio', o: { tipo: 'semi', scat: 'gobba', fin: 'anod', canna: 711, costola: true, serb: 200, astina: 'fissa', gas: true, calcio: 'pieno', mire: 'perlina', perlina: 'bianca', sicura: 'avanti', Hc: 138, astL: 250 } };

  // ================================================================== voci del catalogo: revolver (id 27-39)
  MAP2[27] = { f: 'revolver_doppia', o: { telaio: 'medio', canna: 101.6, tipo: 'conica', imp: 'legno_quadro', stile: 'a', mire: 'fisse', mirino: 'mezzaluna', rb0: 7.9, rb1: 6.9, astaL: 52 } };
  MAP2[28] = { f: 'revolver_doppia', o: { telaio: 'piccolo6', S: 1, tondoLungo: true, canna: 50.8, tipo: 'conica_nuda', imp: 'legno_tondo', stile: 'b', mire: 'fisse', mirino: 'rampa', mirinoH: 6.6, rb0: 7.8, rb1: 7.3, astaL: 45 } };
  MAP2[29] = { f: 'revolver_doppia', o: { telaio: 'piccolo5', canna: 47.6, tipo: 'conica', imp: 'legno_tondo', stile: 'a', mire: 'fisse', mirino: 'rampa', mirinoH: 6.6, rb0: 7.6, rb1: 7.2, astaL: 38 } };
  MAP2[30] = { f: 'revolver_doppia', o: { telaio: 'grande', S: 1.1, canna: 152.4, tipo: 'ventilata', costola: 'ventilata', imp: 'legno_tiro', stile: 'b', mire: 'regolabili', mirino: 'rampa_rossa', rb1: 9.2, lugW: 7.6, lucido: true } };
  MAP2[31] = { f: 'revolver_singola', o: { canna: 117.5 } };
  MAP2[32] = { f: 'revolver_doppia', o: { telaio: 'medio357', canna: 108, ig: 1.2, tipo: 'carenata', costola: 'piena', costolaW: 3.4, imp: 'legno_tiro', stile: 'a', mire: 'regolabili', mirino: 'rampa', cane: 'tiro', rb0: 8.4, rb1: 8.1, lucido: true } };
  MAP2[33] = { f: 'revolver_doppia', o: { telaio: 'medio357', canna: 101.6, tipo: 'carenata', imp: 'gomma_liscia', stile: 'c', mire: 'regolabili', mirino: 'rampa', rb0: 8.6, rb1: 8.2 } };
  MAP2[34] = { f: 'revolver_doppia', o: { telaio: 'grande', canna: 165, gs: 1.08, tipo: 'piena', costola: 'piena', imp: 'gomma_dita', stile: 'a', mire: 'regolabili', mirino: 'rampa_rossa', cane: 'tiro', rb1: 9.4, lugW: 7.8 } };
  MAP2[35] = { f: 'revolver_doppia', o: { telaio: 'grande', canna: 106.7, tipo: 'piena', costola: 'piena', imp: 'gomma_liscia', stile: 'c', mire: 'regolabili', mirino: 'rampa_rossa', rb1: 9.4, lugW: 8 } };
  MAP2[36] = { f: 'revolver_doppia', o: { telaio: 'medio7', canna: 152.4, gd: 0, tipo: 'piena', costola: 'piena', imp: 'gomma_dita', stile: 'a', mire: 'regolabili', mirino: 'rampa_rossa', rb1: 9, lugW: 7.4 } };
  MAP2[37] = { f: 'revolver_canna_bassa', o: { canna: 101.6 } };
  MAP2[38] = { f: 'revolver_doppia', o: { telaio: 'grande', canna: 76.2, gd: .8, tipo: 'piena', costola: 'piena', imp: 'gomma_dita', stile: 'b', mire: 'fisse', mirino: 'rampa_rossa', rb1: 9.2, lugW: 7.6 } };
  MAP2[39] = { f: 'revolver_doppia', o: { telaio: 'enorme', canna: 212.7, tipo: 'piena', costola: 'piena', imp: 'gomma_dita', gs: 1.12, stile: 'a', mire: 'regolabili', mirino: 'rampa_rossa', rb1: 12.6, lugW: 10.4, freno: 36, ri: 6.4 } };
})();
