/* ITALIA OPEN WORLD — Vehicle Damage Solver (risolutore unificato dei danni)
   ===========================================================================
   Un solo punto di coordinamento fra i sistemi che il gioco ha GIÀ:
     rilevamento dei contatti (push()/pdCollide in index.html) → questo solver → rete deformabile (dmgCrash/sbCrash)
     → grandezze derivate (sbDerive) → danni meccanici (motore/danni_meccanici.js) → motore fisico (mod di
     motore/fisica_veicolo.js) e ECU (motore/ecu.js) → effetti del gioco (sbEffects: vetri, pezzi, ruote; crash.js:
     fumo, perdite, vapore, scintille, suoni; CARDMG: guida).
   Il solver NON simula una seconda carrozzeria e non duplica nessuna di quelle funzioni. Fa tre cose:

   1. EVENTO D'URTO (evento): dai dati del contatto (velocità normale relativa, masse, direzione, punto, tipo di
      ostacolo) calcola massa effettiva, impulso, energia cinetica normale, coefficiente di restituzione, energia
      dissipata e la sua ripartizione fra i due corpi (dalla rigidezza relativa delle facce e dal materiale
      dell'ostacolo). Restituisce la velocità equivalente `u` con cui la rete deve essere schiacciata perché
      dissipi proprio l'energia che le spetta (½·M_rete·u² = E_propria): prima il gioco usava fattori fissi
      (0,92·v per gli ostacoli, 0,5·v fra auto). Un registro degli eventi evita di applicare due volte la stessa
      energia (stesso contatto ripetuto nei fotogrammi seguenti, coppia di auto che si scambiano l'urto).
   2. STATO STRUTTURALE (stato / statoStruttura): legge la rete (travi rotte e snervate per zona nominata) e
      fornisce a danni_meccanici.js l'interfaccia S documentata qui sotto, più l'integrità dei componenti
      distaccabili (paraurti, cofano, porte, specchietti, vetri, ruote, scarico).
   3. PASSO (passo): modello delle sospensioni e delle ruote dai mozzi deformati (braccio, ammortizzatore, molla,
      mozzo, cerchio, convergenza, campanatura, foratura, battistrada) → aderenza per ruota, vibrazione, stabilità
      e tiraggio, che il gioco applica al motore fisico (mod.muRuota) e alla guida (CARDMG). Le voci già
      coperte da danni_meccanici.js (freni, corsa dello sterzo, attrito delle sospensioni piegate) NON vengono
      ricalcolate qui: ogni effetto ha un solo proprietario.

   Interfaccia S verso danni_meccanici.aggiorna (tutte le grandezze vengono dalla rete, in metri/radianti):
     zones[6]  schiacciamento relativo per zona del gioco (ant. sin./des., centr. sin./des., post. sin./des.)
     fC, rC    arretramento massimo del muso / avanzamento della coda;  sL, sR intrusione laterale;  fS spostamento del motore
     hubs[4]   {dx,dy,dz,camber,toe,lost} per mozzo (0 ant. sin., 1 ant. des., 2 post. sin., 3 post. des.)
     engine    integrità del motore dalla rete (0..1);  wl[4] ruote staccate;  lampF/lampR fari/fanali rotti
     tyreF[4], tyreShred[4] gomme a terra / battistrada staccato (dal gioco, TYRE)
     zone      {id: {rotte, snervate, integrita}} per zona nominata (profili_danno.js)   ← nuovo, usato da questo solver
   Nessuna delle grandezze è una misura reale: sono lo stato della rete di gioco. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.IOW_SOLVER = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const cl = (v, a, b) => v < a ? a : v > b ? b : v, fin = v => Number.isFinite(v);

  /* ------------------------------------------------------------------ materiali degli ostacoli (parametri di gioco, non misure)
     e0: restituzione a bassa velocità; assorbe: quota dell'energia dissipata che l'ostacolo si tiene (si piega, si rompe, si sposta);
     cede: oltre questa energia [J] l'ostacolo cede e assorbe di più (pali, guardrail); locale: contatto concentrato (la rete lo riceve con raggio R) */
  const MATERIALI = {
    wall: { nome: 'muro / edificio', e0: 0.10, assorbe: 0.0, cede: Infinity, locale: false },
    rail: { nome: 'guardrail', e0: 0.15, assorbe: 0.45, cede: 25000, locale: false },
    pole: { nome: 'palo', e0: 0.05, assorbe: 0.30, cede: 40000, locale: true },
    tree: { nome: 'albero', e0: 0.06, assorbe: 0.08, cede: 400000, locale: true },
    car: { nome: 'veicolo', e0: 0.22, assorbe: null, cede: Infinity, locale: false },   // assorbe: dalla rigidezza relativa delle facce
    ground: { nome: 'terreno (ribaltamento)', e0: 0.05, assorbe: 0.15, cede: Infinity, locale: false },
  };
  const FACCE = ['ant', 'post', 'lato'];
  const PROF_FACCE = { ant: 1, post: 0.8, lato: 0.6, tetto: 0.7 };

  /* restituzione decrescente con la velocità: urti lenti (parcheggio) quasi elastici, urti veloci quasi plastici */
  function restituzione(mat, vn) { const e0 = mat.e0; return cl(e0 + (0.45 - e0) * Math.exp(-vn / 4), 0.02, 0.6) }
  /* faccia colpita e obliquità: n = direzione dell'urto in coordinate auto (verso l'interno), p = punto in coordinate auto */
  function faccia(nx, nz, lx, lz) { if (Math.abs(nz) >= Math.abs(nx)) return nz < 0 ? 'ant' : 'post'; return 'lato' }

  function crea(opt) {
    opt = opt || {};
    return {
      v: 1, t: 0, prof: opt.profilo || 'predefinito', facce: Object.assign({}, PROF_FACCE, opt.facce || {}),
      eventi: [], nEventi: 0, nDuplicati: 0, ultimo: null,
      energia: { cinetica: 0, dissipata: 0, propria: 0, ostacoli: 0, rete: 0 },   // J: somme sugli eventi (rete = lavoro plastico dichiarato da sbCrash)
      ruote: [0, 1, 2, 3].map(() => ({ braccio: 1, ammortizzatore: 1, molla: 1, mozzo: 1, cerchio: 1, toe: 0, camber: 0, foro: 0, distrutta: false, persa: false })),
      comp: {},   // componenti distaccabili: {integrita, staccato, massa, attacco}
      effetti: { aderenza: [1, 1, 1, 1], vibrazione: 0, stabilita: 1, tiro: 0, ammortizzazione: 1, frenataMax: 1 },
      zone: null, dirty: true,
    };
  }

  /* ------------------------------------------------------------------ 1. evento d'urto
     ev: { t, lx, lz, nx, nz, vn, m1, m2, kind, facciaAltro, id, Mt, locale }
       vn   velocità normale relativa di avvicinamento al contatto [m/s] (>0); lx,lz punto in coordinate auto; nx,nz direzione dell'urto (verso l'interno dell'auto)
       m1   massa propria [kg]; m2 massa dell'altro corpo [kg] (Infinity per muro/palo/albero/terreno)
       kind 'wall'|'rail'|'pole'|'tree'|'car'|'ground'; facciaAltro 'ant'|'post'|'lato' (solo fra veicoli); id identificatore della coppia (per non contare due volte)
       Mt   massa della rete che dovrà dissipare l'energia (sbTemplate.M sommata) */
  function evento(st, ev) {
    const mat = MATERIALI[ev.kind] || MATERIALI.wall, vn = Math.max(0, +ev.vn || 0), m1 = fin(ev.m1) && ev.m1 > 0 ? ev.m1 : 1500, m2 = ev.m2 === undefined || ev.m2 === null ? Infinity : ev.m2;
    const mEff = m2 === Infinity ? m1 : m1 * m2 / (m1 + m2), e = restituzione(mat, vn), J = (1 + e) * mEff * vn, En = 0.5 * mEff * vn * vn, Ediss = En * (1 - e * e);
    const nx = +ev.nx || 0, nz = +ev.nz || 0, nl = Math.hypot(nx, nz) || 1, fa = ev.faccia || faccia(nx / nl, nz / nl, ev.lx, ev.lz), kOwn = st.facce[fa] || 1;
    let quotaOst;
    if (mat.assorbe === null) { const kAlt = (ev.facceAltro && ev.facceAltro[ev.facciaAltro || 'ant']) || PROF_FACCE[ev.facciaAltro || 'ant'] || 1; quotaOst = kOwn / (kOwn + kAlt) }   // il più cedevole assorbe di più (forze uguali al contatto)
    else quotaOst = Ediss > mat.cede ? Math.min(0.85, mat.assorbe + (1 - mat.assorbe) * 0.5 * (1 - mat.cede / Ediss)) : mat.assorbe;
    let Eown = Ediss * (1 - quotaOst), Ealtro = Ediss * quotaOst;
    // registro: stesso contatto ripetuto entro 0,12 s e 1 m → si applica solo l'energia in più (mai due volte la stessa)
    let dup = false; const t = fin(ev.t) ? ev.t : st.t;
    for (let i = st.eventi.length - 1; i >= 0 && t - st.eventi[i].t < 0.12; i--) {
      const q = st.eventi[i]; if (q.kind !== ev.kind) continue; if (ev.id !== undefined && q.id !== undefined && q.id !== ev.id) continue;
      if (Math.hypot(q.lx - ev.lx, q.lz - ev.lz) > 1) continue;
      dup = true; const extra = Math.max(0, Eown - q.Eown); q.Eown = Math.max(q.Eown, Eown); q.ripetuto = (q.ripetuto || 0) + 1; Eown = extra; Ealtro = 0; break;
    }
    const Mt = fin(ev.Mt) && ev.Mt > 0 ? ev.Mt : m1, u = Eown > 0 ? Math.min(40, Math.sqrt(2 * Eown / Mt)) : 0;
    // stima della forza media di schiacciamento e della durata (dalla forza di snervamento della faccia, se nota dal modello della rete)
    const Fsn = fin(ev.Fsnerv) ? ev.Fsnerv : 0, schiacc = Fsn > 0 ? Eown / Fsn : null, durata = schiacc !== null && vn > 0 ? 2 * schiacc / vn : null;
    const out = { t, kind: ev.kind, id: ev.id, lx: +ev.lx || 0, lz: +ev.lz || 0, nx: nx / nl, nz: nz / nl, faccia: fa, vn, m1, m2, mEff, e, J, En, Ediss, Eown, Ealtro, u, quotaOst, duplicato: dup, Mt, Fsnerv: Fsn || null, schiacciamento: schiacc, durata, locale: !!mat.locale };
    if (!dup) { st.eventi.push(out); if (st.eventi.length > 60) st.eventi.splice(0, 20); st.nEventi++; st.energia.cinetica += En; st.energia.dissipata += Ediss; st.energia.propria += Eown; st.energia.ostacoli += Ealtro }
    else { st.nDuplicati++; st.energia.propria += Eown }
    st.ultimo = out; st.t = Math.max(st.t, t); st.dirty = true;
    return out;
  }
  /* esito della simulazione della rete (ritorno di sbCrash): contabilità dell'energia davvero dissipata */
  function esito(st, ev, res) { if (res && fin(res.Wp)) { st.energia.rete += res.Wp; if (ev) { ev.Wp = res.Wp; ev.crush = res.crush } } }

  /* ------------------------------------------------------------------ 2. stato strutturale per zona nominata (dalla rete)
     T = modello (con T.zona da profili_danno.classifica), S = stato della rete (br, L0, free). Costa un ciclo sulle travi (~700). */
  function stato(T, S, ZONE) {
    const Z = T.zona, n = ZONE.length, rotte = new Float64Array(n), sn = new Float64Array(n), tot = new Float64Array(n), out = {};
    for (let b = 0; b < T.NB; b++) { const z = Z[b]; tot[z]++; if (S.br[b]) { rotte[z]++; continue } const s = Math.abs(1 - S.L0[b] / T.Lo[b]); if (s > 0.004) sn[z] += Math.min(1, s / Math.max(0.01, T.EB[b])) }
    for (let z = 0; z < n; z++) { const q = tot[z] || 1, r = rotte[z] / q, p = sn[z] / q; out[ZONE[z].id] = { travi: tot[z], rotte: +r.toFixed(3), snervate: +p.toFixed(3), integrita: +cl(1 - 0.7 * r - 0.6 * p, 0, 1).toFixed(3) } }
    return out;
  }
  /* interfaccia S completa per danni_meccanici.aggiorna (R = sbDerive, D = stato danni del gioco, tyre = TYRE.st) */
  function statoStruttura(st, R, D, tyre, zone) {
    if (!(D && D.on) && !tyre) return null;
    return {
      zones: D && D.on ? D.zones : [0, 0, 0, 0, 0, 0], fC: R ? R.fC : 0, rC: R ? R.rC : 0, sL: R ? R.sL : 0, sR: R ? R.sR : 0, fS: R ? R.fS : 0, hubs: R ? R.hubs : [], engine: D && D.on ? D.engine : 1, wl: D ? D.wl : null,
      lampF: R ? R.lampF : null, lampR: R ? R.lampR : null, tyreF: tyre ? tyre.f : null, tyreShred: tyre ? tyre.shred : null, zone: zone || st.zone || null,
    };
  }
  /* integrità e stato di distacco dei componenti (config da profili_danno.componenti; stato di distacco deciso dal gioco: D.cut, D.gcut, D.wl, crSt.parts) */
  function componenti(st, cfg, zone, D, parts) {
    const C = st.comp;
    for (const k in cfg) {
      const c = cfg[k], q = C[k] || (C[k] = { integrita: 1, staccato: false, massa: c.massa, attacco: c.attacco, nome: c.nome });
      const z = zone && zone[c.attacco]; let integ = z ? z.integrita : 1;
      if (c.resistenza && c.resistenza !== 1) integ = cl(1 - (1 - integ) / c.resistenza, 0, 1);
      let stacc = false;
      if (D) {
        if (c.chiave === 'detach') stacc = !!(D.cut && D.cut[k]);
        else if (c.chiave === 'cut') stacc = !!(D.gcut && D.gcut[k]);
        else if (c.chiave === 'wheel') stacc = !!(D.wl && D.wl[c.indice]);
        else if (c.chiave === 'meccanico') stacc = !!(D.scaricoStaccato);
        const p = parts && parts[k]; if (p) { if (p.st === 'gone') stacc = true; else if (!stacc) integ = Math.min(integ, p.st === 'free' ? 0.35 : 0.7) }   // pezzi incernierati (crash.js): socchiuso, libero, volato via
      }
      q.integrita = stacc ? 0 : +integ.toFixed(3); q.staccato = stacc; q.massa = c.massa;
    }
    return C;
  }

  /* ------------------------------------------------------------------ 3. passo: sospensioni, ruote e pneumatici → effetti
     ctx: { R (sbDerive o null), D (stato danni: wl), tyre ({f,shred} o null), v (velocità m/s), danni (comp di danni_meccanici: sospensioni[4], sterzo) } */
  function passo(st, dt, ctx) {
    st.t += dt > 0 ? dt : 0;
    const R = ctx.R, D = ctx.D, ty = ctx.tyre, v = Math.abs(+ctx.v || 0), E = st.effetti; let vib = 0, stab = 1, tiro = 0, amm = 0, frenMax = 1;
    for (let k = 0; k < 4; k++) {
      const w = st.ruote[k], hb = R && R.hubs && R.hubs[k] || null, persa = !!(hb && hb.lost || D && D.wl && D.wl[k]);
      const dx = hb ? hb.dx : 0, dy = hb ? hb.dy : 0, dz = hb ? hb.dz : 0, camber = hb ? hb.camber : 0, toe = hb ? hb.toe : 0, sp = Math.hypot(dx, dz);
      // componenti (integrità 0..1, solo in calo: deformazione permanente; la riparazione le riporta a 1)
      w.braccio = Math.min(w.braccio, persa ? 0 : cl(1 - sp / 0.22 - Math.abs(camber) / 0.5, 0, 1));                         // braccio piegato: mozzo spostato nel piano o inclinato
      w.ammortizzatore = Math.min(w.ammortizzatore, persa ? 0 : cl(1 - Math.abs(dy) / 0.12 - Math.abs(camber) / 0.7 * 0.5, 0, 1));   // stelo storto: mozzo salito/sceso o inclinato
      w.molla = Math.min(w.molla, persa ? 0 : cl(1 - Math.max(0, -dy) / 0.09, 0, 1));                                         // molla ceduta: mozzo salito verso la scocca (assetto basso)
      w.mozzo = Math.min(w.mozzo, persa ? 0 : cl(1 - Math.abs(camber) / 0.45 - Math.abs(toe) / 0.4, 0, 1));
      w.cerchio = Math.min(w.cerchio, persa ? 0 : (ty && ty.shred && ty.shred[k] ? 0.15 : cl(1 - Math.max(0, sp - 0.04) / 0.12 - Math.max(0, Math.abs(camber) - 0.1) / 0.3, 0, 1)));   // cerchio: si ovalizza quando la ruota è stata spinta
      w.toe = toe; w.camber = camber; w.foro = ty ? cl(ty.f[k], 0, 1) : 0; w.distrutta = !!(ty && ty.shred && ty.shred[k]); w.persa = persa;
      // aderenza per ruota (solo geometria e cerchio: foratura e battistrada li applica già TYRE.apply alla guida; qui li si passa alla fisica)
      const ad = persa ? 0 : (1 - 0.35 * cl(Math.abs(camber) / 0.4, 0, 1)) * (1 - 0.25 * cl(Math.abs(toe) / 0.3, 0, 1)) * (0.8 + 0.2 * w.cerchio) * (1 - 0.45 * w.foro) * (w.distrutta ? 0.3 : 1);
      E.aderenza[k] = +cl(ad, 0, 1).toFixed(3);
      // vibrazione: cerchio ovalizzato o mozzo storto, cresce con la velocità (una volta per giro: ~v/2 m di circonferenza)
      vib += ((1 - w.cerchio) * 0.6 + (1 - w.mozzo) * 0.3 + (w.distrutta ? 0.5 : 0)) * cl(v / 22, 0, 1.4);
      amm += w.ammortizzatore; stab -= (1 - w.braccio) * 0.12 + (1 - w.ammortizzatore) * 0.1 + (persa ? 0.25 : 0);
      frenMax = Math.min(frenMax, persa ? 0 : 1);
      if (k < 2) tiro += (k === 0 ? 1 : -1) * ((1 - w.braccio) * 0.02);   // braccio piegato da un lato: tira (si somma alla convergenza già usata dal gioco)
    }
    E.vibrazione = +cl(vib / 2, 0, 1).toFixed(3); E.stabilita = +cl(stab, 0.2, 1).toFixed(3); E.tiro = +cl(tiro, -0.05, 0.05).toFixed(4); E.ammortizzazione = +(amm / 4).toFixed(3); E.frenataMax = frenMax;
    return E;
  }

  /* applica gli effetti al motore fisico (mod) senza toccare le voci di danni_meccanici */
  function applicaMod(st, mod) { if (!mod) return; const E = st.effetti; mod.muRuota = E.aderenza; mod.vibrazione = E.vibrazione; mod.stabilita = E.stabilita }

  /* riparazione: 'tutto' rimette ruote e componenti; 'emergenza' lascia bracci, cerchi e pezzi al 70% (come la meccanica in danni_meccanici);
     'sospensioni'|'pneumatici'|'freni'|'sensoriRuota' con indice → solo quella ruota (senza indice: tutte); altre voci (radiatore, motore…) non toccano il solver */
  const RUOTA_KEYS = ['braccio', 'ammortizzatore', 'molla', 'mozzo', 'cerchio'];
  function ripara(st, chiave, idx) {
    const tutto = chiave === 'tutto', em = chiave === 'emergenza', lim = em ? 0.7 : 1, ruota = w => { for (const k of RUOTA_KEYS) w[k] = Math.max(w[k], lim); w.persa = false; w.distrutta = false; w.foro = 0; w.toe = 0; w.camber = 0 };
    if (tutto || em) { for (const w of st.ruote) ruota(w); for (const k in st.comp) { st.comp[k].integrita = Math.max(st.comp[k].integrita, lim); st.comp[k].staccato = false } }
    else if (chiave === 'sospensioni' || chiave === 'pneumatici' || chiave === 'freni' || chiave === 'sensoriRuota') { if (idx === undefined) for (const w of st.ruote) ruota(w); else if (st.ruote[idx]) ruota(st.ruote[idx]) }
    else return false;
    st.effetti = { aderenza: [1, 1, 1, 1], vibrazione: 0, stabilita: 1, tiro: 0, ammortizzazione: 1, frenataMax: 1 }; st.zone = null; st.dirty = true; return true;
  }

  /* diagnostica per il pannello / i test: nessun NaN deve comparire */
  function analisi(st) {
    const E = st.energia, kJ = x => +(x / 1000).toFixed(2);
    return {
      nota: 'Bilancio energetico del modello di gioco (stime, non misure di prove d\'urto).', eventi: st.nEventi, duplicatiScartati: st.nDuplicati,
      energiaKJ: { cinetica: kJ(E.cinetica), dissipata: kJ(E.dissipata), propria: kJ(E.propria), ostacoli: kJ(E.ostacoli), rete: kJ(E.rete) },
      ultimo: st.ultimo ? { t: +st.ultimo.t.toFixed(2), contro: st.ultimo.kind, faccia: st.ultimo.faccia, kmh: +(st.ultimo.vn * 3.6).toFixed(0), massaEffKg: Math.round(st.ultimo.mEff), impulsoNs: Math.round(st.ultimo.J), e: +st.ultimo.e.toFixed(2), EpropriaKJ: kJ(st.ultimo.Eown), EostacoloKJ: kJ(st.ultimo.Ealtro), u: +st.ultimo.u.toFixed(2), duplicato: st.ultimo.duplicato } : null,
      ruote: st.ruote.map(w => ({ braccio: w.braccio, ammortizzatore: w.ammortizzatore, molla: w.molla, mozzo: w.mozzo, cerchio: w.cerchio, toe: +w.toe.toFixed(3), camber: +w.camber.toFixed(3), foro: w.foro, distrutta: w.distrutta, persa: w.persa })),
      effetti: st.effetti, componenti: st.comp, zone: st.zone,
    };
  }
  function valido(st) { const bad = []; const walk = (o, p) => { for (const k in o) { const v = o[k]; if (typeof v === 'number') { if (!fin(v) && k !== 'm2') bad.push(p + k) } else if (v && typeof v === 'object' && p.split('.').length < 6) walk(v, p + k + '.') } }; walk({ energia: st.energia, ruote: st.ruote, effetti: st.effetti, comp: st.comp, ultimo: st.ultimo || {} }, ''); return bad }

  function serializza(st) {
    return { v: 1, t: +st.t.toFixed(2), prof: st.prof, nEventi: st.nEventi, nDuplicati: st.nDuplicati, energia: Object.assign({}, st.energia), eventi: st.eventi.slice(-20).map(e => ({ t: e.t, kind: e.kind, lx: e.lx, lz: e.lz, nx: e.nx, nz: e.nz, faccia: e.faccia, vn: e.vn, mEff: e.mEff, e: e.e, J: e.J, En: e.En, Ediss: e.Ediss, Eown: e.Eown, Ealtro: e.Ealtro, u: e.u, Wp: e.Wp })), ruote: st.ruote.map(w => Object.assign({}, w)), comp: st.comp, effetti: st.effetti };
  }
  function ripristina(st, s) {
    if (!s || typeof s !== 'object' || s.v !== 1) return false; const n = (x, fb) => fin(x) ? x : fb;
    st.t = n(s.t, 0); st.prof = s.prof || st.prof; st.nEventi = n(s.nEventi, 0) | 0; st.nDuplicati = n(s.nDuplicati, 0) | 0;
    for (const k in st.energia) st.energia[k] = n(s.energia && s.energia[k], 0);
    st.eventi = Array.isArray(s.eventi) ? s.eventi.filter(e => e && fin(e.t) && fin(e.Eown)).slice(-60) : []; st.ultimo = st.eventi.length ? st.eventi[st.eventi.length - 1] : null;
    if (Array.isArray(s.ruote) && s.ruote.length === 4) st.ruote = s.ruote.map((w, k) => { const q = st.ruote[k]; for (const key of ['braccio', 'ammortizzatore', 'molla', 'mozzo', 'cerchio']) q[key] = cl(n(w[key], 1), 0, 1); q.toe = n(w.toe, 0); q.camber = n(w.camber, 0); q.foro = cl(n(w.foro, 0), 0, 1); q.distrutta = !!w.distrutta; q.persa = !!w.persa; return q });
    if (s.comp && typeof s.comp === 'object') for (const k in s.comp) { const c = s.comp[k]; if (c && typeof c === 'object') st.comp[k] = { integrita: cl(n(c.integrita, 1), 0, 1), staccato: !!c.staccato, massa: n(c.massa, 0), attacco: c.attacco, nome: c.nome } }
    if (s.effetti && Array.isArray(s.effetti.aderenza) && s.effetti.aderenza.length === 4) st.effetti = { aderenza: s.effetti.aderenza.map(x => cl(n(x, 1), 0, 1)), vibrazione: cl(n(s.effetti.vibrazione, 0), 0, 1), stabilita: cl(n(s.effetti.stabilita, 1), 0.2, 1), tiro: cl(n(s.effetti.tiro, 0), -0.05, 0.05), ammortizzazione: cl(n(s.effetti.ammortizzazione, 1), 0, 1), frenataMax: cl(n(s.effetti.frenataMax, 1), 0, 1) };
    st.dirty = true; return true;
  }

  return { versione: '1.0.0', MATERIALI, FACCE, PROF_FACCE, restituzione, faccia, crea, evento, esito, stato, statoStruttura, componenti, passo, applicaMod, ripara, analisi, valido, serializza, ripristina };
});
