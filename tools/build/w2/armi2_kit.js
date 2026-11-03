// Kit di modellazione delle armi, versione 2 (Versione 21 del gioco).
// Unità di disegno: millimetri. Asse X = avanti (verso la bocca), Y = su, Z = lato destro del tiratore.
// Il profilo laterale si disegna nel piano XY e si estrude in Z.
// Contenuto:
//  - percorsi 2D con raccordi e curve (rpoly, expand: [x,y] [x,y,r] ['c',x1,y1,x2,y2,x,y] ['q',x1,y1,x,y] ['a',cx,cy,r,a0,a1]);
//  - slab: estrusione con smusso esatto (le misure esterne restano quelle del profilo) e UV nel piano del profilo;
//  - loftX / loftS: solidi a sezione superellittica lungo X o lungo una linea curva (calci, impugnature, caricatori curvi);
//  - latheX: solidi di rotazione attorno a X (canne, freni di bocca, ottiche);
//  - crease: normali levigate entro un angolo (spigoli smussati lucidi, facce piane piane) e usura sugli spigoli;
//  - pittore di dettagli: zigrinature, scritte incise (marchi di fantasia), perni, viti, puntinatura, quadrettatura,
//    tradotti in mappa normale, rugosità e colore nel piano del profilo (lato sinistro e destro separati, scritte leggibili);
//  - materiali PBR (acciaio brunito, fosfatato, alluminio anodizzato, inox, polimero, vernici, legni, gomma, ottone, lenti);
//  - assemblaggio: parti fisse unite per materiale, parti mobili separate con il loro perno, punti di riferimento.
window.WK2 = (function () {
  const T = THREE, MM = 0.001, PI = Math.PI;

  // ------------------------------------------------------------------ percorsi 2D
  function arcPts(cx, cy, r, a0, a1, seg) {
    const out = [], n = seg || Math.max(3, Math.ceil(Math.abs(a1 - a0) * Math.sqrt(Math.max(r, .5)) * 2.2));
    for (let k = 0; k <= n; k++) { const a = a0 + (a1 - a0) * k / n; out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    return out;
  }
  function bez3(p0, p1, p2, p3, n) {
    const out = [];
    for (let k = 1; k <= n; k++) { const t = k / n, u = 1 - t; out.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]); }
    return out;
  }
  // espande le curve in punti; i vertici [x,y,r] conservano il raggio del raccordo
  function expand(path) {
    const out = [];
    for (const e of path) {
      if (typeof e[0] === 'string') {
        const last = out.length ? out[out.length - 1] : [0, 0];
        if (e[0] === 'c') { const p3 = [e[5], e[6]], L = Math.hypot(p3[0] - last[0], p3[1] - last[1]); for (const p of bez3(last, [e[1], e[2]], [e[3], e[4]], p3, Math.max(4, Math.min(24, Math.ceil(L / 2.5))))) out.push(p); }
        else if (e[0] === 'q') { const c = [e[1], e[2]], p2 = [e[3], e[4]], L = Math.hypot(p2[0] - last[0], p2[1] - last[1]); for (const p of bez3(last, [last[0] + (c[0] - last[0]) * 2 / 3, last[1] + (c[1] - last[1]) * 2 / 3], [p2[0] + (c[0] - p2[0]) * 2 / 3, p2[1] + (c[1] - p2[1]) * 2 / 3], p2, Math.max(4, Math.min(20, Math.ceil(L / 2.5))))) out.push(p); }
        else if (e[0] === 'a') { const pts = arcPts(e[1], e[2], e[3], e[4], e[5], e[6]); for (const p of pts) out.push(p); }
      } else { const q = e.slice(); out.push(q); }
    }
    // togli i punti doppi consecutivi
    const res = [];
    // fattore dello smusso: i punti delle curve prendono quello del punto precedente
    let lastS = 1; for (const p of out) { if (p[3] !== undefined) lastS = p[3]; else p[3] = lastS; }
    for (const p of out) { const q = res[res.length - 1]; if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-4) res.push(p); else if (p[2]) q[2] = p[2]; }
    if (res.length > 2) { const a = res[0], b = res[res.length - 1]; if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-4) res.pop(); }
    return res;
  }
  // raccordi circolari nei vertici con raggio
  function rpoly(pts) {
    const out = [], n = pts.length;
    for (let i = 0; i < n; i++) {
      const p = pts[i], r = p[2] || 0;
      const sv = p[3] === undefined ? 1 : p[3];
      if (!r) { out.push([p[0], p[1], 0, sv]); continue; }
      const a = pts[(i + n - 1) % n], b = pts[(i + 1) % n];
      let ux = a[0] - p[0], uy = a[1] - p[1], vx = b[0] - p[0], vy = b[1] - p[1];
      const lu = Math.hypot(ux, uy), lv = Math.hypot(vx, vy);
      if (lu < 1e-6 || lv < 1e-6) { out.push([p[0], p[1], 0, sv]); continue; }
      ux /= lu; uy /= lu; vx /= lv; vy /= lv;
      const th = Math.acos(Math.max(-1, Math.min(1, ux * vx + uy * vy)));
      if (th < 1e-3 || th > PI - 1e-3) { out.push([p[0], p[1], 0, sv]); continue; }
      let d = r / Math.tan(th / 2), rr = r; const dmax = Math.min(lu, lv) * .5;
      if (d > dmax) { d = dmax; rr = d * Math.tan(th / 2); }
      let bx = ux + vx, by = uy + vy; const lb = Math.hypot(bx, by); bx /= lb; by /= lb;
      const dc = rr / Math.sin(th / 2), cx = p[0] + bx * dc, cy = p[1] + by * dc;
      const p1 = [p[0] + ux * d, p[1] + uy * d], p2 = [p[0] + vx * d, p[1] + vy * d];
      const a1 = Math.atan2(p1[1] - cy, p1[0] - cx); let da = Math.atan2(p2[1] - cy, p2[0] - cx) - a1;
      while (da > PI) da -= 2 * PI; while (da < -PI) da += 2 * PI;
      const seg = Math.max(2, Math.min(10, Math.ceil(Math.abs(da) * Math.sqrt(rr) * 1.5)));
      for (let k = 0; k <= seg; k++) { const t = a1 + da * k / seg; out.push([cx + Math.cos(t) * rr, cy + Math.sin(t) * rr, 0, sv]); }
    }
    return out;
  }
  const P2 = path => rpoly(expand(path));
  function rrect(x0, y0, x1, y1, r) { return [[x0, y0, r], [x1, y0, r], [x1, y1, r], [x0, y1, r]]; }
  function circ(cx, cy, r, n) { const o = []; n = n || Math.max(10, Math.ceil(r * 3)); for (let k = 0; k < n; k++) { const a = 2 * PI * k / n; o.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return o; }
  function bbox2(pts) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const p of pts) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; } return [x0, y0, x1, y1]; }

  // ------------------------------------------------------------------ UV: tre zone nella stessa trama
  // v in [0,.3]: pareti e smussi; [.3,.65]: lato sinistro (z minore); [.65,1]: lato destro (z maggiore)
  const VL = [.3, .65], VR = [.65, 1], VW = [0, .3];
  function uvSlab(b, depth, bev) {
    const zmid = depth / 2, zt = depth + 2 * bev;
    const sx = 1 / Math.max(1e-6, b[2] - b[0]), sy = 1 / Math.max(1e-6, b[3] - b[1]);
    return {
      generateTopUV(g, v, a, bb, c) {
        const z = (v[a * 3 + 2] + v[bb * 3 + 2] + v[c * 3 + 2]) / 3, R = z > zmid ? VR : VL;
        return [a, bb, c].map(i => new T.Vector2((v[i * 3] - b[0]) * sx, R[0] + (R[1] - R[0]) * (v[i * 3 + 1] - b[1]) * sy));
      },
      generateSideWallUV(g, v, a, bb, c, d) {
        const ax = v[a * 3], ay = v[a * 3 + 1], bx = v[bb * 3], by = v[bb * 3 + 1], hz = Math.abs(ay - by) < Math.abs(ax - bx);
        const f = i => new T.Vector2(hz ? (v[i * 3] - b[0]) * sx : (v[i * 3 + 1] - b[1]) * sy, VW[0] + .01 + .08 * Math.max(0, Math.min(1, (v[i * 3 + 2] + bev) / zt)));
        return [f(a), f(bb), f(c), f(d)];
      }
    };
  }

  // ------------------------------------------------------------------ normali con piega e usura degli spigoli
  // geo non indicizzata; ang = angolo massimo (gradi) fra facce levigate insieme; wear: segna i vertici interni agli smussi
  function crease(geo, ang, opt) {
    if (geo.index) geo = geo.toNonIndexed();
    const pos = geo.attributes.position.array, nv = pos.length / 3, nt = nv / 3;
    const fn = new Float32Array(nt * 3), fa = new Float32Array(nt);
    for (let t = 0; t < nt; t++) {
      const i = t * 9, ax = pos[i], ay = pos[i + 1], az = pos[i + 2];
      const ux = pos[i + 3] - ax, uy = pos[i + 4] - ay, uz = pos[i + 5] - az, vx = pos[i + 6] - ax, vy = pos[i + 7] - ay, vz = pos[i + 8] - az;
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz);
      fa[t] = l * .5; if (l > 1e-12) { nx /= l; ny /= l; nz /= l; } fn[t * 3] = nx; fn[t * 3 + 1] = ny; fn[t * 3 + 2] = nz;
    }
    const map = new Map(), q = 1e3;
    for (let i = 0; i < nv; i++) { const k = Math.round(pos[i * 3] * q) + ',' + Math.round(pos[i * 3 + 1] * q) + ',' + Math.round(pos[i * 3 + 2] * q); let a = map.get(k); if (!a) map.set(k, a = []); a.push(i); }
    const nrm = new Float32Array(nv * 3), col = new Float32Array(nv * 3), cosA = Math.cos((ang || 40) * PI / 180), ew = opt && opt.edge;
    const zaxis = opt && opt.zcap;
    for (const grp of map.values()) {
      for (const i of grp) {
        const ti = (i / 3) | 0; let sx = 0, sy = 0, sz = 0;
        for (const j of grp) {
          const tj = (j / 3) | 0, d = fn[ti * 3] * fn[tj * 3] + fn[ti * 3 + 1] * fn[tj * 3 + 1] + fn[ti * 3 + 2] * fn[tj * 3 + 2];
          if (d >= cosA || ti === tj) { const w = Math.max(fa[tj], 1e-9); sx += fn[tj * 3] * w; sy += fn[tj * 3 + 1] * w; sz += fn[tj * 3 + 2] * w; }
        }
        const l = Math.hypot(sx, sy, sz) || 1; nrm[i * 3] = sx / l; nrm[i * 3 + 1] = sy / l; nrm[i * 3 + 2] = sz / l;
        let e = 0;
        if (ew) {
          if (zaxis) { // estrusione: interno smusso = nessuna faccia del gruppo è parete (|nz|~0) o fianco (|nz|~1)
            let inner = true; for (const j of grp) { const tj = (j / 3) | 0, az = Math.abs(fn[tj * 3 + 2]); if (az < .17 || az > .985) { inner = false; break; } } e = inner ? 1 : 0;
          } else { // altri solidi: piega forte fra facce vicine
            let mn = 1; for (const j of grp) { const tj = (j / 3) | 0; const d = fn[ti * 3] * fn[tj * 3] + fn[ti * 3 + 1] * fn[tj * 3 + 1] + fn[ti * 3 + 2] * fn[tj * 3 + 2]; if (d < mn) mn = d; }
            e = mn < .5 ? 1 : 0;
          }
        }
        col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = e;
      }
    }
    geo.setAttribute('normal', new T.BufferAttribute(nrm, 3));
    geo.setAttribute('wear', new T.BufferAttribute(col, 3));
    return geo;
  }

  // ------------------------------------------------------------------ solidi
  // estrusione del profilo (mm) fra z0 e z1. Smussi indipendenti sui due lati: bL (lato z0) e bR (lato z1), 0 = spigolo vivo
  // (per unire pezzi affiancati senza solchi). holes = fori passanti; uv = riquadro del profilo per le trame del pittore.
  function offsets(c) { // direzioni di spostamento verso l'esterno (contorno antiorario), con limite sugli spigoli acuti
    const n = c.length, m = [];
    for (let i = 0; i < n; i++) {
      const a = c[(i + n - 1) % n], p = c[i], b = c[(i + 1) % n];
      let e1x = p[0] - a[0], e1y = p[1] - a[1], e2x = b[0] - p[0], e2y = b[1] - p[1]; const l1 = Math.hypot(e1x, e1y) || 1, l2 = Math.hypot(e2x, e2y) || 1;
      e1x /= l1; e1y /= l1; e2x /= l2; e2y /= l2;
      const n1x = e1y, n1y = -e1x, n2x = e2y, n2y = -e2x; let mx = n1x + n2x, my = n1y + n2y; const d = 1 + n1x * n2x + n1y * n2y;
      if (d < 1e-3) { const f = p[3] === undefined ? 1 : p[3]; m.push([n1x * f, n1y * f]); continue; }
      mx /= d; my /= d; const L = Math.hypot(mx, my); if (L > 2.5) { mx *= 2.5 / L; my *= 2.5 / L; }
      const f = p[3] === undefined ? 1 : p[3]; m.push([mx * f, my * f]);
    }
    return m;
  }
  function area2(c) { let a = 0; for (let i = 0, n = c.length; i < n; i++) { const p = c[i], q = c[(i + 1) % n]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; }
  function slab(path, z0, z1, o) {
    o = o || {};
    let C = P2(path); if (area2(C) < 0) C.reverse();
    const Hs = (o.holes || []).map(h => { let q = P2(h); if (area2(q) > 0) q.reverse(); return q; });
    const th = z1 - z0, bb = o.uv || bbox2(C), sx = 1 / Math.max(1e-6, bb[2] - bb[0]), sy = 1 / Math.max(1e-6, bb[3] - bb[1]);
    const bd = o.b === undefined ? .6 : o.b; let bL = o.bL === undefined ? bd : o.bL, bR = o.bR === undefined ? bd : o.bR;
    const lim = th * .48; bL = Math.min(bL, lim); bR = Math.min(bR, lim);
    const S = o.bs || 3, contours = [C].concat(Hs), offs = contours.map(offsets);
    // anelli: lista di {z, k} con k = spostamento verso l'esterno (negativo = rientrato)
    const rings = [];
    if (bL > .01) for (let i = 0; i <= S; i++) { const t = i / S; rings.push({ z: z0 + bL * (1 - Math.cos(t * PI / 2)), k: -bL * (1 - Math.sin(t * PI / 2)) }); }
    else rings.push({ z: z0, k: 0 });
    if (bR > .01) for (let i = S; i >= 0; i--) { const t = i / S; rings.push({ z: z1 - bR * (1 - Math.cos(t * PI / 2)), k: -bR * (1 - Math.sin(t * PI / 2)) }); }
    else rings.push({ z: z1, k: 0 });
    const pos = [], uv = [], zt = Math.max(1e-6, th);
    const wuv = (x, y, z, hz) => [hz ? (x - bb[0]) * sx : (y - bb[1]) * sy, VW[0] + .01 + (VW[1] - VW[0] - .02) * Math.max(0, Math.min(1, (z - z0) / zt))];
    contours.forEach((c, ci) => {
      const m = offs[ci], n = c.length;
      const P = (r, i) => [c[i][0] + m[i][0] * r.k, c[i][1] + m[i][1] * r.k, r.z];
      for (let ri = 0; ri < rings.length - 1; ri++) for (let i = 0; i < n; i++) {
        const j = (i + 1) % n, a = P(rings[ri], i), b = P(rings[ri], j), cc = P(rings[ri + 1], j), d = P(rings[ri + 1], i);
        const hz = Math.abs(c[j][1] - c[i][1]) < Math.abs(c[j][0] - c[i][0]);
        pos.push(...a, ...b, ...cc, ...a, ...cc, ...d);
        for (const q of [a, b, cc, a, cc, d]) uv.push(...wuv(q[0], q[1], q[2], hz));
      }
    });
    // tappi: contorno rientrato dello smusso, triangolato con i fori
    for (const side of [0, 1]) {
      const r = side ? rings[rings.length - 1] : rings[0], R = side ? VR : VL;
      const cs = contours.map((c, ci) => c.map((p, i) => new T.Vector2(p[0] + offs[ci][i][0] * r.k, p[1] + offs[ci][i][1] * r.k)));
      const all = [].concat(...cs), tri = T.ShapeUtils.triangulateShape(cs[0], cs.slice(1));
      for (const t of tri) {
        const A = all[t[0]], B = all[t[1]], Cq = all[t[2]], sa = (B.x - A.x) * (Cq.y - A.y) - (Cq.x - A.x) * (B.y - A.y);
        const ids = (sa > 0) === !!side ? [t[0], t[1], t[2]] : [t[0], t[2], t[1]];
        for (const id of ids) { const v = all[id]; pos.push(v.x, v.y, r.z); uv.push((v.x - bb[0]) * sx, R[0] + (R[1] - R[0]) * (v.y - bb[1]) * sy); }
      }
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    return crease(g, o.ang || 38, { edge: true, zcap: true });
  }
  // solido lungo X: st = [{x, t, b, w, nt, nb, cz}] (t/b = quote alto/basso, w = mezza larghezza, n = esponente superellisse)
  function densify(st, step) {
    if (!step) return st;
    const out = [];
    for (let i = 0; i < st.length - 1; i++) {
      const a = st[i], c = st[i + 1], n = Math.max(1, Math.ceil(Math.abs(c.x - a.x) / step));
      const p = st[i - 1] || a, d = st[i + 2] || c, lin = a.lin || c.lin;
      for (let k = 0; k < n; k++) {
        const t = k / n, o = {};
        for (const key of ['x', 't', 'b', 'w', 'nt', 'nb', 'cz']) {
          const A = a[key] === undefined ? (key === 'cz' ? 0 : 4) : a[key], C = c[key] === undefined ? (key === 'cz' ? 0 : 4) : c[key];
          if (lin || key === 'x') { o[key] = A + (C - A) * t; continue; }
          const P = p[key] === undefined ? A : p[key], Dd = d[key] === undefined ? C : d[key];
          // Catmull-Rom con limiti per non uscire dall'intervallo dei vicini
          const t2 = t * t, t3 = t2 * t; let v = .5 * ((2 * A) + (-P + C) * t + (2 * P - 5 * A + 4 * C - Dd) * t2 + (-P + 3 * A - 3 * C + Dd) * t3);
          const lo = Math.min(A, C), hi = Math.max(A, C); if (v < lo) v = lo; if (v > hi) v = hi; o[key] = v;
        }
        out.push(o);
      }
    }
    out.push(Object.assign({}, st[st.length - 1]));
    return out;
  }
  function seRing(K, ht, hb, w, nt, nb) { // punti (y,z) di una sezione superellittica con esponenti diversi sopra e sotto
    const r = [];
    for (let k = 0; k <= K; k++) {
      const a = 2 * PI * k / K, c = Math.cos(a), s = Math.sin(a), n = s >= 0 ? nt : nb, h = s >= 0 ? ht : hb;
      r.push([Math.sign(s) * Math.pow(Math.abs(s), 2 / n) * h, Math.sign(c) * Math.pow(Math.abs(c), 2 / n) * w]);
    }
    return r;
  }
  function loftX(st, o) {
    o = o || {}; st = densify(st, o.step === undefined ? 4 : o.step);
    const K = o.K || 28, pos = [], uv = [], x0 = st[0].x, x1 = st[st.length - 1].x, L = Math.max(1e-6, x1 - x0);
    const rings = st.map(s => { const yc = (s.t + s.b) / 2, h = (s.t - s.b) / 2; return seRing(K, h, h, s.w, s.nt || 4, s.nb || s.nt || 4).map(p => [s.x, yc + p[0], (s.cz || 0) + p[1]]); });
    const V = o.vr || [VW[0] + .01, VW[1] - .01];
    for (let i = 0; i < st.length - 1; i++) for (let k = 0; k < K; k++) {
      const a = rings[i][k], b = rings[i + 1][k], c = rings[i + 1][k + 1], d = rings[i][k + 1];
      const ua = (st[i].x - x0) / L, ub = (st[i + 1].x - x0) / L, va = .1 + .9 * k / K, vb = .1 + .9 * (k + 1) / K;
      pos.push(...a, ...b, ...c, ...a, ...c, ...d);
      uv.push(ua, va, ub, va, ub, vb, ua, va, ub, vb, ua, vb);
    }
    for (const end of [0, st.length - 1]) { if (o.cap === false || (end === 0 && o.cap0 === false) || (end > 0 && o.cap1 === false)) continue;
      const r = rings[end], s = st[end], cx = s.x, cy = (s.t + s.b) / 2, cz = s.cz || 0, f = end === 0 ? -1 : 1;
      for (let k = 0; k < K; k++) { const a = r[k], b = r[k + 1]; if (f > 0) pos.push(cx, cy, cz, ...b, ...a); else pos.push(cx, cy, cz, ...a, ...b); uv.push(.02, .03, .03, .03, .03, .04); }
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    return crease(g, o.ang || 55, { edge: !!o.edge });
  }
  // solido lungo una linea curva nel piano XY: st = [{p:[x,y], f, r, w, nf, nr}] (f/r = mezza misura verso la normale +/-, w = mezza larghezza in Z)
  function loftS(st, o) {
    o = o || {}; const K = o.K || 24, pos = [], uv = [];
    // ricampiona la linea con Catmull-Rom
    const pts = [];
    const n0 = st.length, sub = o.sub || 4;
    for (let i = 0; i < n0 - 1; i++) {
      const A = st[Math.max(0, i - 1)], B = st[i], C = st[i + 1], D = st[Math.min(n0 - 1, i + 2)];
      for (let k = 0; k < sub; k++) {
        const t = k / sub, t2 = t * t, t3 = t2 * t, cr = (a, b, c, d) => .5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3), li = (b, c) => b + (c - b) * t;
        const q = { p: [cr(A.p[0], B.p[0], C.p[0], D.p[0]), cr(A.p[1], B.p[1], C.p[1], D.p[1])] };
        for (const key of ['f', 'r', 'w', 'nf', 'nr', 'cz']) { const bv = B[key] === undefined ? (key === 'cz' ? 0 : 4) : B[key], cv = C[key] === undefined ? (key === 'cz' ? 0 : 4) : C[key]; q[key] = li(bv, cv); }
        pts.push(q);
      }
    }
    const Ls = st[n0 - 1]; pts.push({ p: Ls.p.slice(), f: Ls.f, r: Ls.r, w: Ls.w, nf: Ls.nf || 4, nr: Ls.nr || 4, cz: Ls.cz || 0 });
    let len = 0; const acc = [0]; for (let i = 1; i < pts.length; i++) { len += Math.hypot(pts[i].p[0] - pts[i - 1].p[0], pts[i].p[1] - pts[i - 1].p[1]); acc.push(len); }
    const rings = pts.map((s, i) => {
      const a = pts[Math.max(0, i - 1)].p, b = pts[Math.min(pts.length - 1, i + 1)].p; let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      const nx = -ty, ny = tx, ring = seRing(K, s.f, s.r, s.w, s.nf || 4, s.nr || 4);
      return ring.map(q => [s.p[0] + nx * q[0], s.p[1] + ny * q[0], (s.cz || 0) + q[1]]);
    });
    for (let i = 0; i < pts.length - 1; i++) for (let k = 0; k < K; k++) {
      const a = rings[i][k], b = rings[i + 1][k], c = rings[i + 1][k + 1], d = rings[i][k + 1], ua = acc[i] / len, ub = acc[i + 1] / len, va = .1 + .9 * k / K, vb = .1 + .9 * (k + 1) / K;
      pos.push(...a, ...b, ...c, ...a, ...c, ...d); uv.push(ua, va, ub, va, ub, vb, ua, va, ub, vb, ua, vb);
    }
    for (const end of [0, pts.length - 1]) { if (o.cap === false) continue; const r = rings[end], s = pts[end], cz = s.cz || 0, f = end === 0 ? -1 : 1;
      // centro della sezione: media del contorno
      let cx = 0, cy = 0; for (let k = 0; k < K; k++) { cx += r[k][0]; cy += r[k][1]; } cx /= K; cy /= K;
      for (let k = 0; k < K; k++) { const a = r[k], b = r[k + 1]; if (f > 0) pos.push(cx, cy, cz, ...b, ...a); else pos.push(cx, cy, cz, ...a, ...b); uv.push(.02, .03, .03, .03, .03, .04); } }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    return crease(g, o.ang || 55, { edge: !!o.edge });
  }
  // rotazione attorno all'asse X: prof = [[x, r], ...] (r = raggio), aperto alle estremità se r=0 non dato
  function latheX(prof, o) {
    o = o || {}; const N = o.seg || 24, pos = [], uv = [], a0 = o.a0 || 0, a1 = o.a1 === undefined ? 2 * PI : o.a1, cy = o.cy || 0, cz = o.cz || 0;
    const P = prof; let len = 0; const acc = [0]; for (let i = 1; i < P.length; i++) { len += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); acc.push(len); }
    const pt = (i, j) => { const a = a0 + (a1 - a0) * j / N; return [P[i][0], cy + Math.cos(a) * P[i][1], cz + Math.sin(a) * P[i][1]]; };
    for (let i = 0; i < P.length - 1; i++) for (let j = 0; j < N; j++) {
      const a = pt(i, j), b = pt(i + 1, j), c = pt(i + 1, j + 1), d = pt(i, j + 1), ua = acc[i] / (len || 1), ub = acc[i + 1] / (len || 1), va = .1 + .9 * j / N, vb = .1 + .9 * (j + 1) / N;
      pos.push(...a, ...c, ...b, ...a, ...d, ...c); uv.push(ua, va, ub, vb, ub, va, ua, va, ua, vb, ub, vb);
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    return crease(g, o.ang || 50, { edge: !!o.edge });
  }
  // tubo pieno lungo X con smussi alle estremità
  function rod(x0, x1, r, o) { o = o || {}; const c = Math.min(o.c === undefined ? r * .12 : o.c, r * .5, (x1 - x0) * .3); const p = [[x0, 0], [x0, r - c], [x0 + c, r], [x1 - c, r], [x1, r - c], [x1, 0]]; return latheX(p, { seg: o.seg || 20, cy: o.cy || 0, cz: o.cz || 0, ang: 50 }); }
  // tubo cavo (canna): raggio esterno, interno
  function tube(x0, x1, r, ri, o) { o = o || {}; const c = Math.min(r * .1, .6); const p = [[x0 + .01, ri], [x0, ri + c * .3], [x0, r - c], [x0 + c, r], [x1 - c, r], [x1, r - c], [x1, ri + c * .3], [x1 - .3, ri], [x1 - Math.min(8, (x1 - x0) * .5), ri * .985]]; return latheX(p, { seg: o.seg || 20, cy: o.cy || 0, cz: o.cz || 0, ang: 50 }); }
  // scatola smussata (misure esterne esatte)
  function box(x0, y0, z0, x1, y1, z1, b, r) { return slab(rrect(x0, y0, x1, y1, r || 0), z0, z1, { b: b === undefined ? .5 : b }); }

  // estrusione lungo X di un profilo disegnato nel piano (z, y); lungo Y di un profilo nel piano (x, z)
  function slabX(path, x0, x1, o) { return xf(slab(path, -x1, -x0, o), { r: [0, -PI / 2, 0] }); }
  function slabY(path, y0, y1, o) { return xf(slab(path, -y1, -y0, o), { r: [PI / 2, 0, 0] }); }
  // disco piatto rivolto verso +X (dir>0) o -X
  function discX(x, cy, cz, r, dir, seg) { return latheX(dir < 0 ? [[x, 0], [x, r]] : [[x, r], [x, 0]], { cy, cz, seg: seg || 24 }); }
  // ------------------------------------------------------------------ trasformazioni e unione
  function xf(geo, o) {
    const m = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler((o.r || [0, 0, 0])[0], (o.r || [0, 0, 0])[1], (o.r || [0, 0, 0])[2], o.order || 'XYZ');
    q.setFromEuler(e); const s = o.s === undefined ? [1, 1, 1] : (typeof o.s === 'number' ? [o.s, o.s, o.s] : o.s);
    const t = o.t || [0, 0, 0];
    if (o.p) { // rotazione attorno al punto p
      const p = o.p; geo.translate(-p[0], -p[1], -p[2]); m.compose(new T.Vector3(0, 0, 0), q, new T.Vector3(s[0], s[1], s[2])); geo.applyMatrix4(m); geo.translate(p[0] + t[0], p[1] + t[1], p[2] + t[2]);
    } else { m.compose(new T.Vector3(t[0], t[1], t[2]), q, new T.Vector3(s[0], s[1], s[2])); geo.applyMatrix4(m); }
    return geo;
  }
  function mirrorZ(geo) { // copia specchiata (lato opposto) con triangoli girati
    const g = geo.clone(); g.scale(1, 1, -1);
    const p = g.attributes.position.array, n = g.attributes.normal.array, u = g.attributes.uv && g.attributes.uv.array, w = g.attributes.wear && g.attributes.wear.array;
    for (let i = 0; i < p.length; i += 9) for (const arr of [p, n, w].filter(Boolean)) { for (let k = 0; k < 3; k++) { const t = arr[i + 3 + k]; arr[i + 3 + k] = arr[i + 6 + k]; arr[i + 6 + k] = t; } }
    if (u) for (let i = 0; i < u.length; i += 6) { for (let k = 0; k < 2; k++) { const t = u[i + 2 + k]; u[i + 2 + k] = u[i + 4 + k]; u[i + 4 + k] = t; } }
    return g;
  }
  function mergeG(list) {
    let n = 0; for (const g of list) n += g.attributes.position.count;
    const P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2), W = new Float32Array(n * 3);
    let o = 0;
    for (const g0 of list) {
      const g = g0.index ? g0.toNonIndexed() : g0, c = g.attributes.position.count;
      P.set(g.attributes.position.array, o * 3);
      if (g.attributes.normal) N.set(g.attributes.normal.array, o * 3);
      if (g.attributes.uv) U.set(g.attributes.uv.array, o * 2); else U.fill(.03, o * 2, (o + c) * 2);
      if (g.attributes.wear) W.set(g.attributes.wear.array, o * 3);
      o += c;
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(P, 3)); g.setAttribute('normal', new T.BufferAttribute(N, 3)); g.setAttribute('uv', new T.BufferAttribute(U, 2)); g.setAttribute('wear', new T.BufferAttribute(W, 3));
    return g;
  }

  // ------------------------------------------------------------------ rumore e trame
  function hash(x, y, s) { let h = (x * 374761393 + y * 668265263 + (s || 0) * 982451653) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
  function vnoise(x, y, s) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
  function fbm(x, y, s, o) { let v = 0, a = .5, f = 1; for (let i = 0; i < (o || 4); i++) { v += a * vnoise(x * f, y * f, s + i * 17); f *= 2.03; a *= .5; } return v; }
  // tessera di rumore frattale ripetibile (calcolata una volta), campionata con interpolazione bilineare
  let NT = null; const NS = 256;
  function ntile() {
    if (NT) return NT; NT = new Float32Array(NS * NS);
    for (let o = 0; o < 5; o++) { const cs = 64 >> o, per = NS / cs, amp = .5 / (1 << o);
      for (let y = 0; y < NS; y++) for (let x = 0; x < NS; x++) { const gx = x / cs, gy = y / cs, xi = Math.floor(gx), yi = Math.floor(gy), fx = gx - xi, fy = gy - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
        const h = (a, b) => hash(((a % per) + per) % per, ((b % per) + per) % per, o * 31 + 5); const A = h(xi, yi), B = h(xi + 1, yi), C = h(xi, yi + 1), D = h(xi + 1, yi + 1);
        NT[y * NS + x] += amp * (A + (B - A) * u + (C - A) * v + (A - B - C + D) * u * v); } }
    return NT;
  }
  function nz(x, y) { const t = ntile(); x = ((x % NS) + NS) % NS; y = ((y % NS) + NS) % NS; const xi = x | 0, yi = y | 0, fx = x - xi, fy = y - yi, x1 = (xi + 1) % NS, y1 = (yi + 1) % NS;
    const a = t[yi * NS + xi], b = t[yi * NS + x1], c = t[y1 * NS + xi], d = t[y1 * NS + x1]; return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy; }
  const canvasOf = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g0 = c.getContext; c.getContext = function (t, o) { return g0.call(c, t, Object.assign({ willReadFrequently: true }, o || {})); }; return c; };
  function texOf(c, srgb) { const t = new T.CanvasTexture(c); t.anisotropy = 4; if (srgb) t.encoding = T.sRGBEncoding; t.generateMipmaps = true; t.minFilter = T.LinearMipmapLinearFilter; return t; }
  // mappa normale da mappa di altezza (canvas in scala di grigi)
  function heightToNormal(hc, k) {
    const w = hc.width, h = hc.height, src = hc.getContext('2d').getImageData(0, 0, w, h).data, out = canvasOf(w, h), ox = out.getContext('2d'), id = ox.createImageData(w, h), d = id.data;
    const H = (x, y) => src[((Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))) << 2)] / 255;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * k, dy = (H(x, y - 1) - H(x, y + 1)) * k;
      let nx = -dx, ny = -dy, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      const i = (y * w + x) << 2; d[i] = (nx * .5 + .5) * 255; d[i + 1] = (ny * .5 + .5) * 255; d[i + 2] = (nz * .5 + .5) * 255; d[i + 3] = 255;
    }
    ox.putImageData(id, 0, 0); return out;
  }
  // rumore di superficie generico (rugosità e colore) condiviso
  let GRUNGE = null;
  function grunge() {
    if (GRUNGE) return GRUNGE;
    const W = 512, c = canvasOf(W, W), x = c.getContext('2d'), id = x.createImageData(W, W), d = id.data;
    for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) {
      const n = nz(i * .5, j * .5) * .6 + nz(i * 2.1 + 70, j * 2.1 + 30) * .4, sc = Math.pow(hash(i, j, 9), 18) * .25, v = Math.max(0, Math.min(1, .5 + (n - .5) * .7 + sc)), k = (j * W + i) << 2;
      d[k] = d[k + 1] = d[k + 2] = v * 255; d[k + 3] = 255;
    }
    x.putImageData(id, 0, 0); const t = texOf(c, false); t.wrapS = t.wrapT = T.RepeatWrapping; t.userData = { shared: true }; return GRUNGE = t;
  }

  let STP = null;
  function stippleTile() { if (STP) return STP; const N = 128, c = canvasOf(N, N), x = c.getContext('2d'); x.fillStyle = '#808080'; x.fillRect(0, 0, N, N);
    for (let i = 0; i < 420; i++) { const px = hash(i, 1, 21) * N, py = hash(i, 2, 21) * N, r = 2.2 + hash(i, 3, 21) * 2.6, up = hash(i, 4, 21) > .45;
      for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]) { const g = x.createRadialGradient(px + dx, py + dy, 0, px + dx, py + dy, r); g.addColorStop(0, up ? 'rgba(235,235,235,1)' : 'rgba(25,25,25,1)'); g.addColorStop(1, 'rgba(128,128,128,0)'); x.fillStyle = g; x.beginPath(); x.arc(px + dx, py + dy, r, 0, 2 * PI); x.fill(); } }
    return STP = c; }
  // ------------------------------------------------------------------ pittore dei dettagli nel piano del profilo
  // bb = [x0,y0,x1,y1] riquadro del profilo (lo stesso passato a slab come uv); disegna su altezza, colore e rugosità
  function painter(bb, o) {
    o = o || {};
    const W = o.w || 1024, H = o.h || 512, hc = canvasOf(W, H), ac = canvasOf(W, H), rc = canvasOf(W, H);
    const hx = hc.getContext('2d'), ax = ac.getContext('2d'), rx = rc.getContext('2d');
    hx.fillStyle = '#808080'; hx.fillRect(0, 0, W, H);
    ax.fillStyle = '#ffffff'; ax.fillRect(0, 0, W, H);
    const r0 = Math.round((o.rough === undefined ? .5 : o.rough) * 255); rx.fillStyle = `rgb(${r0},${r0},${r0})`; rx.fillRect(0, 0, W, H);
    const sx = 1 / (bb[2] - bb[0]), sy = 1 / (bb[3] - bb[1]);
    const ppmX = W * sx, ppmY = (H * .45) * sy; // pixel per millimetro nelle zone laterali
    function cx(x) { return (x - bb[0]) * sx * W; }
    function cy(side, y) { const R = side === 'L' ? VL : VR; return (1 - (R[0] + (R[1] - R[0]) * (y - bb[1]) * sy)) * H; }
    const sides = s => s === 'LR' || !s ? ['L', 'R'] : [s];
    const gray = v => { const k = Math.round(Math.max(0, Math.min(1, v)) * 255); return `rgb(${k},${k},${k})`; };
    function poly(ctx, side, pts) { ctx.beginPath(); pts.forEach((p, i) => { const X = cx(p[0]), Y = cy(side, p[1]); if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); }); ctx.closePath(); }
    const api = {
      W, H, ppmX, ppmY,
      // riempie un poligono (mm) con altezza h (-1..1 rispetto alla superficie), colore a (moltiplicatore) e rugosità r
      fill(side, path, f) { const pts = P2(path); for (const s of sides(side)) {
        if (f.h !== undefined) { hx.fillStyle = gray(.5 + f.h * .5); poly(hx, s, pts); hx.fill(); }
        if (f.a !== undefined) { ax.fillStyle = gray(f.a); poly(ax, s, pts); ax.fill(); }
        if (f.r !== undefined) { rx.fillStyle = gray(f.r); poly(rx, s, pts); rx.fill(); } } },
      // linea incisa lungo un percorso (aperto o chiuso)
      line(side, path, wmm, f, closed) { const pts = P2(path); for (const s of sides(side)) for (const [ctx, v] of [[hx, f.h === undefined ? -.6 : f.h], [ax, f.a], [rx, f.r]]) {
        if (v === undefined) continue; ctx.strokeStyle = gray(ctx === hx ? .5 + v * .5 : v); ctx.lineWidth = Math.max(1, wmm * ppmX); ctx.lineJoin = 'round'; ctx.beginPath();
        pts.forEach((p, i) => { const X = cx(p[0]), Y = cy(s, p[1]); if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); }); if (closed) ctx.closePath(); ctx.stroke(); } },
      // zigrinatura: scanalature parallele fra x0 e x1, alte da y0 a y1, passo p, inclinazione ang (rad)
      grooves(side, x0, x1, y0, y1, p, f) { f = f || {}; const wr = f.wr || .45, ang = f.ang || 0;
        for (let x = x0 + p * .5; x < x1; x += p) { const dx = Math.tan(ang) * (y1 - y0) * .5;
          this.fill(side, [[x - p * wr * .5 - dx, y0], [x + p * wr * .5 - dx, y0], [x + p * wr * .5 + dx, y1], [x - p * wr * .5 + dx, y1]], { h: f.h === undefined ? -.9 : f.h, a: f.a === undefined ? .62 : f.a, r: f.r }); } },
      // scritta incisa (marchio di fantasia): centrata in (x,y), altezza dei caratteri hmm
      text(side, str, x, y, hmm, f) { f = f || {}; for (const s of sides(side)) for (const [ctx, v] of [[hx, f.h === undefined ? -.7 : f.h], [ax, f.a === undefined ? .55 : f.a], [rx, f.r]]) {
        if (v === undefined) continue; ctx.save(); ctx.translate(cx(x), cy(s, y)); const k = hmm * ppmY / 100; ctx.scale(s === 'L' ? -k * ppmX / ppmY : k * ppmX / ppmY, k);
        ctx.fillStyle = gray(ctx === hx ? .5 + v * .5 : v); ctx.font = (f.weight || 'bold') + ' 100px ' + (f.font || 'Arial, Helvetica, sans-serif'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        if (f.spacing) { let tot = 0; const ws = [...str].map(ch => { const m = ctx.measureText(ch).width; tot += m + f.spacing; return m; }); let xx = -tot / 2; [...str].forEach((ch, i) => { ctx.fillText(ch, xx + ws[i] / 2, 0); xx += ws[i] + f.spacing; }); }
        else ctx.fillText(str, 0, 0);
        ctx.restore(); } },
      // perno o vite (cerchio); slot = intaglio della vite
      pin(side, x, y, r, f) { f = f || {}; const c = circ(x, y, r, 24); this.fill(side, c, { h: f.h === undefined ? .35 : f.h, a: f.a, r: f.r });
        this.line(side, circ(x, y, r, 24), .18, { h: -.5, a: .7 }, true); if (f.slot) this.fill(side, [[x - r * .8, y - r * .14], [x + r * .8, y - r * .14], [x + r * .8, y + r * .14], [x - r * .8, y + r * .14]], { h: -.8, a: .5 }); },
      // puntinatura (impugnature in polimero) dentro un poligono
      stipple(side, path, f) { f = f || {}; const pts = P2(path), pat = hx.createPattern(stippleTile(), 'repeat'), k = (f.s || .3) / 3.2; // un puntino del motivo ~3.2 px
        for (const s of sides(side)) { hx.save(); poly(hx, s, pts); hx.clip(); hx.setTransform(k * ppmX, 0, 0, k * ppmY, 0, 0); hx.fillStyle = pat; hx.globalAlpha = f.k === undefined ? 1 : f.k; hx.fillRect(0, 0, W / (k * ppmX), H / (k * ppmY)); hx.restore();
          rx.save(); poly(rx, s, pts); rx.clip(); rx.fillStyle = gray(f.r === undefined ? .88 : f.r); rx.fillRect(0, 0, W, H); rx.restore();
          ax.save(); poly(ax, s, pts); ax.clip(); ax.fillStyle = gray(f.a === undefined ? .92 : f.a); ax.fillRect(0, 0, W, H); ax.restore(); } },
      // quadrettatura (guancette in legno o metallo) a rombi di passo p
      checker(side, path, p, f) { f = f || {}; const pts = P2(path), b = bbox2(pts);
        for (const s of sides(side)) { hx.save(); poly(hx, s, pts); hx.clip(); hx.strokeStyle = '#2a2a2a'; hx.lineWidth = Math.max(1, p * .35 * ppmX);
          const D = (b[2] - b[0]) + (b[3] - b[1]);
          for (let t = -D; t < D; t += p) { hx.beginPath(); hx.moveTo(cx(b[0] + t), cy(s, b[1])); hx.lineTo(cx(b[0] + t + (b[3] - b[1])), cy(s, b[3])); hx.stroke(); hx.beginPath(); hx.moveTo(cx(b[0] + t), cy(s, b[3])); hx.lineTo(cx(b[0] + t + (b[3] - b[1])), cy(s, b[1])); hx.stroke(); }
          hx.restore(); if (f.a !== undefined) this.fill(s, path, { a: f.a }); if (f.r !== undefined) this.fill(s, path, { r: f.r }); } },
      // rumore: variazione di colore e rugosità su tutta la trama
      noise(f) { f = f || {}; const ia = ax.getImageData(0, 0, W, H), ir = rx.getImageData(0, 0, W, H), da = ia.data, dr = ir.data, s = f.seed || 1, sc = f.scale || 60;
        const k1 = 256 / sc / 4, so = s * 37;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const n = nz(x * k1 + so, y * k1 + so * .7) - .5, sp = Math.pow(hash(x, y, s + 5), 30), i = (y * W + x) << 2;
          const am = 1 + n * (f.a === undefined ? .18 : f.a) - sp * .15; da[i] *= am; da[i + 1] *= am; da[i + 2] *= am;
          const rv = dr[i] + n * 255 * (f.r === undefined ? .22 : f.r) + sp * 40; dr[i] = dr[i + 1] = dr[i + 2] = Math.max(0, Math.min(255, rv)); }
        ax.putImageData(ia, 0, 0); rx.putImageData(ir, 0, 0); },
      // trama delle pareti (zona bassa): lisciatura lungo la lunghezza
      walls(f) { f = f || {}; const y0 = (1 - VW[1]) * H; for (let i = 0; i < 400; i++) { const y = y0 + hash(i, 5, 3) * (H - y0); rx.fillStyle = gray((f.r === undefined ? .5 : f.r) + (hash(i, 6, 3) - .5) * .12); rx.fillRect(0, y, W, 1); } },
      // zona delle pareti (fronte, dorso, sopra, sotto delle estrusioni): puntinatura o colore su tutta la fascia
      wallFill(f) { const y0 = (1 - VW[1]) * H; if (f.a !== undefined) { ax.fillStyle = gray(f.a); ax.fillRect(0, y0, W, H - y0); } if (f.r !== undefined) { rx.fillStyle = gray(f.r); rx.fillRect(0, y0, W, H - y0); } },
      wallStipple(f) { f = f || {}; const y0 = (1 - VW[1]) * H, pat = hx.createPattern(stippleTile(), 'repeat'), k = (f.s || 1) / 3.2; hx.save(); hx.beginPath(); hx.rect(0, y0, W, H - y0); hx.clip(); hx.setTransform(k, 0, 0, k * (f.ay || 1), 0, 0); hx.fillStyle = pat; hx.globalAlpha = f.k === undefined ? 1 : f.k; hx.fillRect(0, 0, W / k, H / (k * (f.ay || 1))); hx.restore(); },
      done(k) { const nm = heightToNormal(hc, k || 2.2); return { map: texOf(ac, true), normalMap: texOf(nm, false), roughnessMap: texOf(rc, false), canvases: { hc, ac, rc } }; }
    };
    return api;
  }

  // trama del legno (venature lungo u) per calci e guardamani: anelli sottili deformati dal rumore, pori allungati,
  // variazione lenta del colore; vernice semilucida (rugosità .3-.45)
  const WOODC = {};
  function wood(kind) {
    if (WOODC[kind]) return WOODC[kind];
    const P = { noce: ['#6e4a30', '#3c2414', '#8a6244', 46, .42], faggio: ['#8a5634', '#57301a', '#a46a42', 60, .36], betulla: ['#8c5a36', '#5a321c', '#a87048', 64, .34],
      laminato: ['#7a4128', '#4c2414', '#92553a', 90, .32], chiaro: ['#b08a60', '#7e5c3a', '#c8a274', 52, .4], scuro: ['#4a3020', '#24160c', '#5e3e28', 40, .45] }[kind] || ['#6e4a30', '#3c2414', '#8a6244', 46, .42];
    const W = 1024, H = 256, c = canvasOf(W, H), x = c.getContext('2d'), id = x.createImageData(W, H), d = id.data, A = new T.Color(P[0]), B = new T.Color(P[1]), C = new T.Color(P[2]);
    const r = canvasOf(W, H), rx = r.getContext('2d'), ir = rx.createImageData(W, H), dr = ir.data, rings = P[3], rb = P[4], col = new T.Color();
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const warp = (nz(i * .15, j * .9) - .5) * 3.2 + (nz(i * .6 + 40, j * 2.4 + 11) - .5) * .7;
      let g = (j / H) * rings + warp; g -= Math.floor(g);
      const late = Math.pow(Math.max(0, 1 - Math.abs(g - .5) * 2.6), 2.2);                 // linea scura sottile (legno tardivo)
      const pore = Math.pow(hash(i >> 2, j, 41), 40) * .9;                                    // pori allungati lungo la venatura
      const slow = nz(i * .05 + 200, j * .3 + 7);                                             // variazione lenta
      col.copy(A).lerp(C, Math.max(0, slow - .45) * 1.2).lerp(B, late * .55 + pore * .5);
      if (kind === 'laminato') col.lerp(B, (Math.sin((j / H) * 26 * PI + warp * .4) > .82 ? .25 : 0));
      const k = (j * W + i) << 2; d[k] = col.r * 255; d[k + 1] = col.g * 255; d[k + 2] = col.b * 255; d[k + 3] = 255;
      const rv = rb + late * .08 + pore * .3 + (slow - .5) * .06; dr[k] = dr[k + 1] = dr[k + 2] = Math.max(0, Math.min(1, rv)) * 255; dr[k + 3] = 255;
    }
    x.putImageData(id, 0, 0); rx.putImageData(ir, 0, 0);
    const wm = texOf(c, true), wr = texOf(r, false); wm.userData = { shared: true }; wr.userData = { shared: true };
    return WOODC[kind] = { map: wm, roughnessMap: wr };
  }

  // trame ripetibili per superfici curve: puntinatura, quadrettatura, nervature, zigrinatura fine
  const TILES = {};
  function tile(kind) {
    if (TILES[kind]) return TILES[kind];
    const N = 256, hc = canvasOf(N, N), x = hc.getContext('2d'); x.fillStyle = '#808080'; x.fillRect(0, 0, N, N);
    const rc = canvasOf(N, N), rx = rc.getContext('2d'); rx.fillStyle = '#b0b0b0'; rx.fillRect(0, 0, N, N);
    if (kind === 'stipple') { for (let i = 0; i < 2600; i++) { const px = hash(i, 1, 4) * N, py = hash(i, 2, 4) * N, r = 1.4 + hash(i, 3, 4) * 2.2; for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]) { const g = x.createRadialGradient(px + dx, py + dy, 0, px + dx, py + dy, r); const up = hash(i, 5, 4) > .35; g.addColorStop(0, up ? '#e0e0e0' : '#202020'); g.addColorStop(1, 'rgba(128,128,128,0)'); x.fillStyle = g; x.beginPath(); x.arc(px + dx, py + dy, r, 0, 2 * PI); x.fill(); } } rx.fillStyle = '#e4e4e4'; rx.fillRect(0, 0, N, N); }
    else if (kind === 'checker' || kind === 'knurl') { const p = kind === 'checker' ? 32 : 16; x.strokeStyle = '#2a2a2a'; x.lineWidth = p * .38; for (let t = -2 * N; t < 2 * N; t += p) { x.beginPath(); x.moveTo(t, 0); x.lineTo(t + N, N); x.stroke(); x.beginPath(); x.moveTo(t, N); x.lineTo(t + N, 0); x.stroke(); } rx.fillStyle = kind === 'checker' ? '#9a9a9a' : '#909090'; rx.fillRect(0, 0, N, N); }
    else if (kind === 'ribs') { for (let y = 0; y < N; y += 32) { const g = x.createLinearGradient(0, y, 0, y + 32); g.addColorStop(0, '#404040'); g.addColorStop(.5, '#d0d0d0'); g.addColorStop(1, '#404040'); x.fillStyle = g; x.fillRect(0, y, N, 32); } }
    else if (kind === 'grana') { const id = x.getImageData(0, 0, N, N), d = id.data; for (let i = 0; i < N * N; i++) { const v = 128 + (hash(i % N, (i / N) | 0, 77) - .5) * 70; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; } x.putImageData(id, 0, 0); }
    const nm = texOf(heightToNormal(hc, kind === 'stipple' ? 3 : 2), false), rm = texOf(rc, false);
    nm.wrapS = nm.wrapT = rm.wrapS = rm.wrapT = T.RepeatWrapping;
    return TILES[kind] = { normalMap: nm, roughnessMap: rm };
  }
  // ------------------------------------------------------------------ materiali
  const LIB = {
    brunito: { c: '#23272d', m: .85, r: .33, w: 2.2, e: 1.15 },      // acciaio brunito (blu-nero lucido)
    nero: { c: '#1d1e20', m: .6, r: .42, w: 2.0, e: 1.0 },           // acciaio nero opaco / nitrurato
    parker: { c: '#30322f', m: .5, r: .64, w: 1.8, e: .9 },          // fosfatato (grigio verdastro opaco)
    anod: { c: '#1f2124', m: .5, r: .5, w: 2.1, e: 1.0 },            // alluminio anodizzato nero
    grigio: { c: '#3b3e42', m: .55, r: .5, w: 1.7, e: 1.0 },         // finitura grigia
    inox: { c: '#b4b7ba', m: 1, r: .26, w: 1.08, e: 1.2 },           // acciaio inossidabile satinato
    cromo: { c: '#c8cacc', m: 1, r: .12, w: 1.0, e: 1.3 },
    polimero: { c: '#1a1b1d', m: 0, r: .68, w: 1.35, e: .8 },        // polimero nero
    poligrigio: { c: '#2c2e30', m: 0, r: .66, w: 1.3, e: .8 },
    coyote: { c: '#8c7454', m: .02, r: .64, w: 1.22, e: .8 },        // marrone sabbia (FDE)
    sabbia: { c: '#b8a07a', m: .02, r: .62, w: 1.2, e: .8 },
    oliva: { c: '#4b4f37', m: .02, r: .66, w: 1.25, e: .8 },         // verde oliva
    verde: { c: '#38432f', m: .05, r: .6, w: 1.3, e: .8 },
    gomma: { c: '#151515', m: 0, r: .9, w: 1.1, e: .5 },
    ottone: { c: '#b58a3c', m: 1, r: .3, w: 1.15, e: 1.2 },
    rame: { c: '#a8603a', m: 1, r: .32, w: 1.1, e: 1.1 },
    lente: { c: '#0c1824', m: .3, r: .04, w: 1, e: 2.2 },
    bachelite: { c: '#3e1c12', m: 0, r: .42, w: 1.3, e: .9 },       // bachelite bruno-rossiccia
    prugna: { c: '#5a2418', m: 0, r: .45, w: 1.25, e: .9 },          // caricatore color prugna
    nero_lucido: { c: '#0f1012', m: .3, r: .25, w: 1.6, e: 1.1 },
    arancio: { c: '#ff6a10', m: 0, r: .5, w: 1, e: .5, em: '#ff5a00', ei: .9 },
    verdefluo: { c: '#30ff60', m: 0, r: .5, w: 1, e: .5, em: '#30ff60', ei: 1.2 },
    rosso: { c: '#ff2020', m: 0, r: .5, w: 1, e: .5, em: '#ff1010', ei: 1.2 },
    bianco: { c: '#e8e8e8', m: 0, r: .5, w: 1, e: .6 },
  };
  for (const k of ['noce', 'faggio', 'betulla', 'laminato', 'chiaro', 'scuro']) LIB['legno_' + k] = { c: '#ffffff', m: 0, r: .5, w: 1.08, e: .7, wood: k };
  // shader: l'attributo "wear" schiarisce e lucida gli spigoli smussati (metallo nudo che affiora)
  function wearPatch(mt, k, kr) {
    mt.onBeforeCompile = sh => {
      sh.uniforms.uWear = { value: k }; sh.uniforms.uWearR = { value: kr };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 wear;\nvarying float vWear;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWear = wear.x;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uWear;\nuniform float uWearR;\nvarying float vWear;')
        .replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb *= mix(1.0, uWear, vWear);')
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, roughnessFactor * uWearR, vWear);');
    };
    mt.customProgramCacheKey = () => 'wk2wear';
  }
  const MC = {};
  // materiale: kind dalla libreria; det = trame del pittore (map/normalMap/roughnessMap); o = varianti (c, r, m)
  function mat(kind, det, o) {
    o = o || {};
    const key = !det && !o.c && !o.r && !o.m && !o.ns && !o.tile ? kind : null;
    if (key && MC[key]) return MC[key];
    const L = LIB[kind] || LIB.nero, prm = { color: new T.Color(o.c || L.c).convertSRGBToLinear(), metalness: o.m === undefined ? L.m : o.m, roughness: o.r === undefined ? L.r : o.r, envMapIntensity: L.e };
    if (L.em) { prm.emissive = new T.Color(L.em).convertSRGBToLinear(); prm.emissiveIntensity = L.ei; }
    if (L.wood) { const w = wood(L.wood); prm.map = w.map; prm.roughnessMap = w.roughnessMap; prm.roughness = 1; }
    else if (o.tile) { const tl = tile(o.tile), rep = o.rep || [8, 8]; prm.normalMap = tl.normalMap.clone(); prm.normalMap.needsUpdate = true; prm.normalMap.repeat.set(rep[0], rep[1]); prm.normalScale = new T.Vector2(o.ns || .7, o.ns || .7);
      prm.roughnessMap = tl.roughnessMap.clone(); prm.roughnessMap.needsUpdate = true; prm.roughnessMap.repeat.set(rep[0], rep[1]); prm.roughness = Math.min(1, (o.r === undefined ? L.r : o.r) * 1.1); }
    else if (det) { if (det.map) prm.map = det.map; if (det.normalMap) { prm.normalMap = det.normalMap; prm.normalScale = new T.Vector2(o.ns || .8, o.ns || .8); } if (det.roughnessMap) { prm.roughnessMap = det.roughnessMap; prm.roughness = 1; } }
    else { prm.roughnessMap = grunge(); prm.roughness = Math.min(1, (o.r === undefined ? L.r : o.r) * 1.6); }
    const mt = new T.MeshStandardMaterial(prm);
    wearPatch(mt, L.w, L.m > .4 ? .7 : .9);
    mt.userData.kind = kind;
    if (key) { mt.userData.cached = true; MC[key] = mt; }
    return mt;
  }

  // ------------------------------------------------------------------ assemblaggio dell'arma
  // A.add(geo, mat, parte) - A.pivot(parte, [x,y,z]) - A.anchor(nome, [x,y,z]) - A.done() -> {g, parts, anchors, tris}
  function asm(name) {
    const parts = {}, piv = {}, anch = {};
    const A = {
      name,
      add(geo, m, part) { part = part || 'corpo'; const P = parts[part] || (parts[part] = new Map()); const key = m.uuid; if (!P.has(key)) P.set(key, { m, g: [] }); P.get(key).g.push(geo); return A; },
      pivot(part, p) { piv[part] = p; return A; },
      anchor(nm, p, dir) { anch[nm] = { p, dir }; return A; },
      done() {
        const g = new T.Group(); g.name = name; const out = {}; let tris = 0;
        for (const part in parts) {
          const pg = new T.Group(); pg.name = part; const p = piv[part] || [0, 0, 0];
          pg.position.set(p[0] * MM, p[1] * MM, p[2] * MM);
          for (const { m, g: list } of parts[part].values()) {
            const geo = mergeG(list); geo.translate(-p[0], -p[1], -p[2]); geo.scale(MM, MM, MM); geo.computeBoundingSphere(); geo.computeBoundingBox();
            const mesh = new T.Mesh(geo, m); mesh.castShadow = true; mesh.receiveShadow = false; pg.add(mesh); tris += geo.attributes.position.count / 3;
          }
          pg.userData.rest = { p: pg.position.clone(), r: pg.rotation.clone() };
          g.add(pg); out[part] = pg;
        }
        const an = {}; for (const k in anch) { const o3 = new T.Object3D(); o3.name = 'ancora_' + k; o3.position.set(anch[k].p[0] * MM, anch[k].p[1] * MM, anch[k].p[2] * MM); g.add(o3); an[k] = o3; }
        g.userData = { parts: out, anchors: an, tris: Math.round(tris) };
        return { g, parts: out, anchors: an, tris: Math.round(tris) };
      }
    };
    return A;
  }

  return { slabX, slabY, discX, tile, nz, ntile, MM, arcPts, bez3, expand, rpoly, P2, rrect, circ, bbox2, slab, loftX, loftS, latheX, rod, tube, box, xf, mirrorZ, mergeG, crease, painter, wood, mat, LIB, asm, fbm, hash, grunge, heightToNormal, canvasOf, texOf };
})();
