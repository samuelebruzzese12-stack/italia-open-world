/* ITALIA OPEN WORLD — Profili di danno per veicolo
   =================================================
   La carrozzeria deformabile del gioco è una rete di 88 nodi e ~700 travi (sbTemplate in index.html), uguale
   per tutte le auto. Questo modulo NON crea una seconda rete: classifica le travi esistenti in ZONE STRUTTURALI
   nominate (paraurti, cofano, muso, longheroni, vano motore, abitacolo, montanti, tetto, porte, bagagliaio,
   pianale, vetri, bracci delle sospensioni) e permette di configurare, per ogni veicolo:
     - massa (ripartita sui nodi della rete in proporzione alle masse del modello base),
     - tipo di struttura (informativo: scocca portante, telaio a longheroni…),
     - resistenza di ogni zona (moltiplicatore della forza di snervamento e della rigidezza delle sue travi),
     - soglia di rottura di ogni zona (moltiplicatore dell'allungamento di rottura),
     - rigidezza relativa delle facce (per ripartire l'energia fra due veicoli che si urtano),
     - componenti distaccabili (massa, resistenza, soglia, punto di attacco),
     - componenti meccanici presenti (quali voci di danni_meccanici.js valgono per il veicolo).
   Il risultato di `template(T, profilo)` è una COPIA del modello della rete con le stesse geometria e topologia
   (stessi nodi, stesse travi: nessun nodo in più) e i soli parametri meccanici scalati; le funzioni esistenti
   (sbCrash, sbBeams, sbDerive, sbNodeCrumple, sbSkin) la usano senza modifiche.

   ATTENZIONE: i moltiplicatori dei profili sono PARAMETRI DI GIOCO. Nessuno dei valori qui sotto deriva da prove
   d'urto reali o da dati del costruttore: il profilo «alfa_159_19_jtdm_150» eredita la massa dal database dei
   veicoli (motore/veicoli_db.js) e lascia la struttura della rete base; «alfa_romeo_75» è l'ESEMPIO fornito dal
   progetto (massa 1200 kg, paraurti anteriore cedevole, zona di assorbimento anteriore robusta) e non è un profilo
   fisico certificato. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.IOW_PROFILI = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const cl = (v, a, b) => v < a ? a : v > b ? b : v;

  /* ------------------------------------------------------------------ zone strutturali (indice = valore nel vettore di classificazione) */
  const ZONE = [
    { id: 'paraurti_ant', nome: 'Paraurti anteriore', tipo: 'assorbimento', nota: 'travi di attacco (tipo 11) alla stazione 0: cedono e il paraurti si stacca' },
    { id: 'muso', nome: 'Muso', tipo: 'assorbimento', nota: 'traversi, montanti e diagonali delle stazioni 0-1' },
    { id: 'cofano', nome: 'Cofano e parafanghi', tipo: 'pannello', nota: 'correnti della linea di cintura nel muso (tipo 0, strato alto)' },
    { id: 'longheroni_ant', nome: 'Longheroni anteriori', tipo: 'assorbimento', nota: 'correnti del pavimento nel muso (tipo 0, strato basso): assorbono l\'energia frontale' },
    { id: 'vano_motore', nome: 'Vano motore', tipo: 'assorbimento', nota: 'traversi, montanti e diagonali della stazione 2 (assale anteriore) fino alla paratia' },
    { id: 'abitacolo', nome: 'Abitacolo', tipo: 'rigida', nota: 'paratia, cintura, traversi e montanti interni delle stazioni 3-6 (tipo 2 strato alto)' },
    { id: 'montanti', nome: 'Montanti A/B/C', tipo: 'rigida', nota: 'tipo 7: montanti, cornici e anelli laterali; montanti inferiori esterni dell\'abitacolo' },
    { id: 'tetto', nome: 'Tetto', tipo: 'rigida', nota: 'tipo 8: correnti, archi e diagonali del tetto' },
    { id: 'porte', nome: 'Porte e fiancate', tipo: 'pannello', nota: 'traversi deboli delle stazioni 4-5 ai lati e diagonali esterne dell\'abitacolo: rientrano negli urti laterali' },
    { id: 'longheroni_post', nome: 'Longheroni posteriori', tipo: 'assorbimento', nota: 'correnti del pavimento nella coda (tipo 3, strato basso)' },
    { id: 'bagagliaio', nome: 'Bagagliaio', tipo: 'assorbimento', nota: 'cintura della coda (tipo 3 strato alto), traversi, montanti e diagonali delle stazioni 7-8' },
    { id: 'pianale', nome: 'Pianale', tipo: 'rigida', nota: 'correnti del pavimento nell\'abitacolo (tipo 2 strato basso), traversi e diagonali del pavimento' },
    { id: 'paraurti_post', nome: 'Paraurti posteriore', tipo: 'assorbimento', nota: 'travi di attacco (tipo 11) alla stazione 8' },
    { id: 'vetri', nome: 'Vetri', tipo: 'vetro', nota: 'tipo 9: parabrezza, lunotto, finestrini (si rompono con piccoli allungamenti)' },
    { id: 'bracci', nome: 'Bracci delle sospensioni', tipo: 'sospensione', nota: 'tipo 10: bracci che legano i mozzi alla scocca (si piegano, si strappano)' },
    { id: 'contatto_ruota', nome: 'Contatto ruota-scocca', tipo: 'interno', nota: 'tipo 12: travi di solo contatto (non configurabili)' },
  ];
  const ZID = {}; ZONE.forEach((z, i) => { ZID[z.id] = i });

  /* classifica ogni trave della rete base in una zona. T = modello della rete (sbTemplate): A, B (nodi), TY (tipo), N, NB.
     Nodi 0..71: corpo (stazione i = n>>3, colonna j = (n>>1)&3, strato l = n&1); 72..83: tetto; 84..87: mozzi. */
  function classifica(T) {
    const Z = new Uint8Array(T.NB), st = n => n < 72 ? n >> 3 : n < 84 ? -1 : -2, col = n => (n >> 1) & 3, lay = n => n & 1;
    for (let b = 0; b < T.NB; b++) {
      const a = T.A[b], c = T.B[b], ty = T.TY[b];
      if (ty === 9) { Z[b] = ZID.vetri; continue }
      if (ty === 10) { Z[b] = ZID.bracci; continue }
      if (ty === 12) { Z[b] = ZID.contatto_ruota; continue }
      if (ty === 8) { Z[b] = ZID.tetto; continue }
      if (ty === 7) { Z[b] = ZID.montanti; continue }
      const ia = st(a), ic = st(c), i0 = Math.min(ia, ic), i1 = Math.max(ia, ic), l = lay(a), ja = col(a), jc = col(c), outer = (ja === 0 || ja === 3) && (jc === 0 || jc === 3);
      if (ty === 11) { Z[b] = i0 === 0 ? ZID.paraurti_ant : ZID.paraurti_post; continue }
      if (ty === 0) { Z[b] = l ? ZID.cofano : ZID.longheroni_ant; continue }
      if (ty === 2) { Z[b] = l ? ZID.abitacolo : ZID.pianale; continue }
      if (ty === 3) { Z[b] = l ? ZID.bagagliaio : ZID.longheroni_post; continue }
      // traversi (4), montanti verticali (5), diagonali (6): per stazione (0-1 muso, 2 vano motore, 3-6 abitacolo, 7-8 coda)
      if (i1 <= 1) { Z[b] = ZID.muso; continue }
      if (i0 === 2) { Z[b] = ZID.vano_motore; continue }
      if (i1 >= 7) { Z[b] = ZID.bagagliaio; continue }
      const centro = (ja === 1 && jc === 2) || (ja === 2 && jc === 1), stessoStrato = lay(a) === lay(c), pavimento = stessoStrato && l === 0;
      if (ty === 4) { Z[b] = (i0 === 4 || i0 === 5) && !centro ? ZID.porte : (pavimento ? ZID.pianale : ZID.abitacolo); continue }
      if (ty === 5) { Z[b] = outer ? ZID.montanti : ZID.abitacolo; continue }
      // diagonali dell'abitacolo: pannelli laterali (coppie di colonne esterne o stessa colonna esterna) → porte; piano del pavimento → pianale; altrove → abitacolo
      if (stessoStrato && i0 !== i1 && !centro) { Z[b] = ZID.porte; continue }   // diagonali dei piani ai lati (le «deboli» del modello: le porte rientrano)
      if (!stessoStrato && ja === jc && outer) { Z[b] = ZID.porte; continue }       // diagonali delle fiancate fra pavimento e cintura
      Z[b] = pavimento ? ZID.pianale : ZID.abitacolo;
    }
    return Z;
  }

  /* ------------------------------------------------------------------ componenti distaccabili (chiavi del gioco: dmgDetach / dmgWheel / crPartGone / dmgCut) */
  // massa in kg (ordini di grandezza plausibili, non pesati su ricambi reali); resistenza = moltiplicatore della soglia del gioco;
  // soglia = energia specifica oltre la quale il pezzo si stacca di netto (impulso d'urto in m/s sulla faccia); attacco = zona della rete che lo porta
  const COMPONENTI = {
    fb: { nome: 'Paraurti anteriore', tipo: 'paraurti', massa: 12, resistenza: 1, soglia: 14, attacco: 'paraurti_ant', chiave: 'detach' },
    rb: { nome: 'Paraurti posteriore', tipo: 'paraurti', massa: 11, resistenza: 1, soglia: 14, attacco: 'paraurti_post', chiave: 'detach' },
    hood: { nome: 'Cofano', tipo: 'cofano', massa: 16, resistenza: 1, soglia: 22, attacco: 'cofano', chiave: 'detach', cerniera: { apre: 0.28, libera: 0.5 } },
    trunk: { nome: 'Portellone', tipo: 'portellone', massa: 12, resistenza: 1, soglia: 22, attacco: 'bagagliaio', chiave: 'cerniera', cerniera: { apre: 0.22 } },
    dFL: { nome: 'Porta anteriore sinistra', tipo: 'porta', massa: 24, resistenza: 1, soglia: 0.32, attacco: 'porte', chiave: 'cerniera', cerniera: { apre: 0.09, libera: 0.32 } },
    dFR: { nome: 'Porta anteriore destra', tipo: 'porta', massa: 24, resistenza: 1, soglia: 0.32, attacco: 'porte', chiave: 'cerniera', cerniera: { apre: 0.09, libera: 0.32 } },
    dRL: { nome: 'Porta posteriore sinistra', tipo: 'porta', massa: 20, resistenza: 1, soglia: 0.32, attacco: 'porte', chiave: 'cerniera', cerniera: { apre: 0.09, libera: 0.32 } },
    dRR: { nome: 'Porta posteriore destra', tipo: 'porta', massa: 20, resistenza: 1, soglia: 0.32, attacco: 'porte', chiave: 'cerniera', cerniera: { apre: 0.09, libera: 0.32 } },
    mL: { nome: 'Specchietto sinistro', tipo: 'specchietto', massa: 1.2, resistenza: 1, soglia: 0.1, attacco: 'porte', chiave: 'detach' },
    mR: { nome: 'Specchietto destro', tipo: 'specchietto', massa: 1.2, resistenza: 1, soglia: 0.1, attacco: 'porte', chiave: 'detach' },
    ws: { nome: 'Parabrezza', tipo: 'vetro', massa: 12, resistenza: 1, soglia: 0.8, attacco: 'vetri', chiave: 'cut' },
    rw: { nome: 'Lunotto', tipo: 'vetro', massa: 8, resistenza: 1, soglia: 0.8, attacco: 'vetri', chiave: 'cut' },
    sl: { nome: 'Finestrini sinistri', tipo: 'vetro', massa: 3, resistenza: 1, soglia: 1, attacco: 'vetri', chiave: 'cut' },
    sr: { nome: 'Finestrini destri', tipo: 'vetro', massa: 3, resistenza: 1, soglia: 1, attacco: 'vetri', chiave: 'cut' },
    w0: { nome: 'Ruota anteriore sinistra', tipo: 'ruota', massa: 18, resistenza: 1, soglia: 1, attacco: 'bracci', chiave: 'wheel', indice: 0 },
    w1: { nome: 'Ruota anteriore destra', tipo: 'ruota', massa: 18, resistenza: 1, soglia: 1, attacco: 'bracci', chiave: 'wheel', indice: 1 },
    w2: { nome: 'Ruota posteriore sinistra', tipo: 'ruota', massa: 18, resistenza: 1, soglia: 1, attacco: 'bracci', chiave: 'wheel', indice: 2 },
    w3: { nome: 'Ruota posteriore destra', tipo: 'ruota', massa: 18, resistenza: 1, soglia: 1, attacco: 'bracci', chiave: 'wheel', indice: 3 },
    scarico: { nome: 'Terminale di scarico', tipo: 'scarico', massa: 6, resistenza: 1, soglia: 0.45, attacco: 'longheroni_post', chiave: 'meccanico', nota: 'il modello 3D non ha un terminale separato: lo stato è meccanico (danni_meccanici) e sonoro' },
  };
  const COMPONENTI_MECCANICI = ['radiatore', 'motore', 'cambio', 'frizione', 'differenziale', 'sterzo', 'sospensioni', 'freni', 'batteria', 'scarico', 'serbatoio', 'elettrico', 'sensoriRuota', 'fari', 'fanali', 'pneumatici', 'struttura'];

  /* ------------------------------------------------------------------ profili */
  const zoneBase = () => { const o = {}; for (const z of ZONE) o[z.id] = { resistenza: 1, rottura: 1 }; return o };
  const PROFILI = {
    predefinito: {
      id: 'predefinito', nome: 'Rete base del gioco', struttura: 'scocca portante', massa: null,   // massa null → masse dei nodi del modello base
      nota: 'identico alla rete già calibrata nel gioco (nessun moltiplicatore)', certificato: false,
      zone: zoneBase(), facce: { ant: 1, post: 0.8, lato: 0.6, tetto: 0.7 }, componenti: {}, meccanici: COMPONENTI_MECCANICI.slice(),
      deformazione: { plasticita: 1, rimbalzo: 1 },
    },
    alfa_159_19_jtdm_150: {
      id: 'alfa_159_19_jtdm_150', nome: 'Alfa Romeo 159 1.9 JTDm (profilo di gioco)', struttura: 'scocca portante in acciaio', massa: 1610,   // massa in ordine di marcia + conducente, come in veicoli_db (1535 + 75)
      nota: 'struttura della rete base; la massa viene dal database dei veicoli; i moltiplicatori non derivano da prove d\'urto', certificato: false,
      zone: zoneBase(), facce: { ant: 1, post: 0.8, lato: 0.6, tetto: 0.7 }, componenti: {}, meccanici: COMPONENTI_MECCANICI.slice(),
      deformazione: { plasticita: 1, rimbalzo: 1 },
    },
  };
  // esempio del progetto: alfa_romeo_75 (NON certificato) — importato dal formato JSON fornito
  const MAPPA_JSON = {
    front_bumper: ['paraurti_ant'], rear_bumper: ['paraurti_post'], hood: ['cofano'], front_crumple_zone: ['muso', 'longheroni_ant'], engine_bay: ['vano_motore'],
    cabin: ['abitacolo'], pillars: ['montanti'], roof: ['tetto'], doors: ['porte'], rear_crumple_zone: ['longheroni_post', 'bagagliaio'], trunk: ['bagagliaio'], floor: ['pianale'], glass: ['vetri'],
    front_left_suspension: ['bracci'], front_right_suspension: ['bracci'], rear_left_suspension: ['bracci'], rear_right_suspension: ['bracci'],
  };
  const MAPPA_MECC = { engine: 'motore', radiator: 'radiatore', gearbox: 'cambio', transmission: 'cambio', clutch: 'frizione', differential: 'differenziale', steering: 'sterzo', brakes: 'freni', battery: 'batteria', exhaust: 'scarico', fuel_tank: 'serbatoio', fuel_system: 'serbatoio', electrics: 'elettrico', wheel_sensors: 'sensoriRuota', headlights: 'fari', taillights: 'fanali', tyres: 'pneumatici', tires: 'pneumatici', structure: 'struttura', front_left_suspension: 'sospensioni', front_right_suspension: 'sospensioni', rear_left_suspension: 'sospensioni', rear_right_suspension: 'sospensioni' };
  const MAPPA_DISTACCO = { front_bumper: 'fb', rear_bumper: 'rb', hood: 'hood', trunk: 'trunk', left_mirror: 'mL', right_mirror: 'mR', windshield: 'ws', rear_window: 'rw', front_left_door: 'dFL', front_right_door: 'dFR', rear_left_door: 'dRL', rear_right_door: 'dRR', front_left_wheel: 'w0', front_right_wheel: 'w1', rear_left_wheel: 'w2', rear_right_wheel: 'w3', exhaust: 'scarico' };

  /* importa un profilo nel formato JSON del progetto:
     { vehicleId, damageProfile:{massKg, structure, …}, components:[{id, type, deformationResistance, breakThreshold, damageEnabled, massKg, detachable}] }
     Convenzione (dichiarata, non fisica): deformationResistance 0.5 = rete base → resistenza = 2·r; breakThreshold 0.5 = rete base → rottura = 2·b.
     Nulla in questo formato è certificato: il profilo risultante è marcato certificato:false e conserva il JSON d'origine. */
  function importa(json) {
    if (!json || typeof json !== 'object') throw new Error('profilo JSON mancante');
    const dp = json.damageProfile || {}, p = {
      id: String(json.vehicleId || 'importato'), nome: String(json.name || json.vehicleId || 'importato'), struttura: String(dp.structure || 'sconosciuta'), massa: Number.isFinite(dp.massKg) ? cl(dp.massKg, 400, 40000) : null,
      nota: 'importato da JSON: valori di esempio, non certificati', certificato: false, origine: json,
      zone: zoneBase(), facce: { ant: 1, post: 0.8, lato: 0.6, tetto: 0.7 }, componenti: {}, meccanici: [], deformazione: { plasticita: 1, rimbalzo: 1 },
      opzioni: { deformazione: dp.deformationEnabled !== false, permanente: dp.permanentDeformation !== false, distacco: dp.detachableComponents !== false },
    };
    for (const c of (json.components || [])) {
      if (!c || !c.id) continue;
      const zone = MAPPA_JSON[c.id]; const r = Number.isFinite(c.deformationResistance) ? cl(2 * c.deformationResistance, 0.25, 4) : 1, b = Number.isFinite(c.breakThreshold) ? cl(2 * c.breakThreshold, 0.25, 4) : 1;
      if (zone) for (const z of zone) p.zone[z] = { resistenza: r, rottura: b };
      const m = MAPPA_MECC[c.id]; if (m && c.damageEnabled !== false && !p.meccanici.includes(m)) p.meccanici.push(m);
      const d = MAPPA_DISTACCO[c.id]; if (d && (c.detachable || c.type === 'body_panel' || c.type === 'glass' || c.type === 'wheel')) p.componenti[d] = Object.assign({}, c.massKg ? { massa: cl(c.massKg, 0.1, 500) } : {}, Number.isFinite(c.breakThreshold) ? { resistenza: cl(2 * c.breakThreshold, 0.25, 4) } : {});
    }
    if (!p.meccanici.length) p.meccanici = COMPONENTI_MECCANICI.slice();
    return p;
  }
  PROFILI.alfa_romeo_75 = importa({
    vehicleId: 'alfa_romeo_75', damageProfile: { massKg: 1200, structure: 'unibody', damageModel: 'soft_body_hybrid', deformationEnabled: true, permanentDeformation: true, detachableComponents: true },
    components: [
      { id: 'front_bumper', type: 'body_panel', deformationResistance: 0.25, breakThreshold: 0.45 },
      { id: 'front_crumple_zone', type: 'structural', deformationResistance: 0.8, breakThreshold: 1.0 },
      { id: 'engine', type: 'powertrain', damageEnabled: true },
      { id: 'front_left_suspension', type: 'suspension', damageEnabled: true },
    ],
  });
  PROFILI.alfa_romeo_75.nome = 'Alfa Romeo 75 (ESEMPIO del progetto, non certificato)';

  function profilo(id) { return PROFILI[id] || PROFILI.predefinito }

  /* ------------------------------------------------------------------ applicazione alla rete: copia del modello con parametri scalati */
  function template(T, prof) {
    prof = typeof prof === 'string' ? profilo(prof) : (prof || PROFILI.predefinito);
    const Z = T.zona || classifica(T), FY = new Float64Array(T.FY), k = new Float64Array(T.k), cd = new Float64Array(T.cd), EB = new Float64Array(T.EB), M = new Float64Array(T.M), invm = new Float64Array(T.invm);
    const rap = new Float64Array(ZONE.length), rot = new Float64Array(ZONE.length);
    for (let z = 0; z < ZONE.length; z++) { const q = prof.zone && prof.zone[ZONE[z].id]; rap[z] = q && Number.isFinite(q.resistenza) ? cl(q.resistenza, 0.05, 20) : 1; rot[z] = q && Number.isFinite(q.rottura) ? cl(q.rottura, 0.1, 10) : 1 }
    for (let b = 0; b < T.NB; b++) { const z = Z[b], f = rap[z]; if (f !== 1) { FY[b] *= f; k[b] *= f; cd[b] *= Math.sqrt(f) } if (rot[z] !== 1 && ZONE[z].id !== 'contatto_ruota') EB[b] *= rot[z] }
    let Mt = 0; for (let i = 0; i < T.N; i++) Mt += M[i];
    if (Number.isFinite(prof.massa) && prof.massa > 0) { const s = prof.massa / Mt; for (let i = 0; i < T.N; i++) { M[i] *= s; invm[i] = 1 / M[i] } Mt = prof.massa }
    const out = Object.assign({}, T, { FY, k, cd, EB, M, invm, zona: Z, profilo: prof.id, Mt });
    return out;
  }
  /* massa totale della rete (nodi non liberi) */
  function massa(T, S) { let m = 0; for (let i = 0; i < T.N; i++) if (!S || !S.free[i]) m += T.M[i]; return m }

  /* riepilogo: quante travi per zona, forza media di snervamento (kN) e allungamento di rottura — per il pannello e per i test */
  function riepilogo(T) {
    const Z = T.zona || classifica(T), out = ZONE.map(z => ({ id: z.id, nome: z.nome, tipo: z.tipo, travi: 0, FYkN: 0, EB: 0 }));
    for (let b = 0; b < T.NB; b++) { const o = out[Z[b]]; o.travi++; o.FYkN += T.FY[b] / 1000; o.EB += T.EB[b] }
    for (const o of out) { if (o.travi) { o.FYkN = +(o.FYkN / o.travi).toFixed(1); o.EB = +(o.EB / o.travi).toFixed(3) } }
    return out;
  }
  /* configurazione completa dei componenti distaccabili per un profilo (base + modifiche del profilo) */
  function componenti(prof) {
    prof = typeof prof === 'string' ? profilo(prof) : (prof || PROFILI.predefinito); const out = {};
    for (const k in COMPONENTI) out[k] = Object.assign({}, COMPONENTI[k], prof.componenti && prof.componenti[k] || {});
    return out;
  }

  return { versione: '1.0.0', ZONE, ZID, COMPONENTI, COMPONENTI_MECCANICI, PROFILI, MAPPA_JSON, MAPPA_MECC, MAPPA_DISTACCO, classifica, importa, profilo, template, massa, riepilogo, componenti };
});
