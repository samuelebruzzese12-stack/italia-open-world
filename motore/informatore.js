/* ITALIA OPEN WORLD — Informatore della Questura e assalto al covo (versione 32). Contenuti di finzione del gioco: articoli, carceri e accuse
   sono inventati per il gioco. Modulo autonomo (nessuna dipendenza): la pagina gli passa lo stato del gioco a ogni passo.

   Stato (crea):
   - reati: reati registrati dalla polizia del gioco (PL.offence), con conteggio e articolo inventato
   - prove: ciò che la polizia sa (visto da una pattuglia, targa letta, segnalazione al 112, covo individuato)
   - ultimaPosizione: dove ti hanno visto l'ultima volta (nome del luogo dalla mappa)
   - covo: il rifugio scelto dal giocatore (coordinate di gioco e nome del luogo)
   - piano: operazione della polizia sul covo, 0–100 %, con le fasi sorveglianza (0), contenimento (40), accerchiamento (75), irruzione (100)

   Il piano parte quando la polizia collega il veicolo ricercato al covo: con almeno 2 stelle una pattuglia ti vede a meno di 300 m dal covo.
   Avanza col tempo di gioco: (2 + 2 × stelle) % al minuto (con 0 stelle 1 % al minuto). All'accerchiamento arriva la notifica; al 100 % parte
   l'irruzione: se sei al covo (entro 80 m) la radio dice «Siamo in posizione, andiamo» e arrivano le squadre; se non ci sei, il covo è perso.

   Chat (rispondi): classificatore a regole delle frasi libere, tollerante agli errori di battitura (somiglianza ≥ 0,8 fra parole). Non è un
   modello linguistico. Sotto la soglia risponde «Non ho capito, ripeti». */
(function (glob) {
  'use strict';
  const ARTICOLI = {
    'velocità pericolosa': ['Art. 3 Codice di Gioco — velocità pericolosa in centro abitato', 1],
    'urto con un’auto in sosta': ['Art. 7 Codice di Gioco — danneggiamento di veicolo in sosta', 1],
    'urto con un veicolo': ['Art. 7-bis Codice di Gioco — danneggiamento aggravato con veicolo', 2],
    'speronamento di una pattuglia': ['Art. 412 Codice di Gioco — danneggiamento aggravato a vetture delle forze dell’ordine', 4],
    'investito un passante': ['Art. 31 Codice di Gioco — investimento di un pedone', 5],
    'spari in pubblico': ['Art. 21 Codice di Gioco — uso di armi in luogo pubblico', 5],
    'spari contro la polizia': ['Art. 902 Codice di Gioco — resistenza armata alle forze dell’ordine', 7],
    'fuga': ['Art. 15 Codice di Gioco — fuga a un posto di controllo', 1],
  };
  const CARCERI = [[0, 'San Vittore (Milano)'], [8, 'Poggioreale (Napoli)'], [20, 'Asinara (supercarcere di finzione del gioco)']];
  const PROVE = { vista: 'una pattuglia ti ha visto da vicino', targa: 'la targa della tua auto è stata letta', chiamata: 'un passante ha chiamato il 112',
    covo: 'hanno collegato la tua auto al covo', drone: 'un drone termico ha sorvolato il covo' };
  const FASI = [['sorveglianza', 0], ['contenimento', 40], ['accerchiamento', 75], ['irruzione', 100]];
  const NOTIFICA = 'Attenzione: Movimenti sospetti attorno al covo. Rientra subito!', RADIO = 'Siamo in posizione, andiamo';

  // ---------------------------------------------------------------- comprensione del testo
  const LESSICO = {
    indagini: ['indagini', 'indagine', 'scoperto', 'sanno', 'scientifica', 'prove', 'impronte', 'tracce', 'video', 'testimoni', 'sospetti', 'targa'],
    accuse: ['accusa', 'accuse', 'accusato', 'reati', 'reato', 'imputato', 'condanna', 'anni', 'carcere', 'pena', 'fedina', 'articoli', 'prigione'],
    piani: ['piano', 'piani', 'faranno', 'prossima', 'mossa', 'arrivano', 'assalto', 'irruzione', 'covo', 'rifugio', 'blitz', 'quando', 'operazione'],
    posizione: ['dove', 'posizione', 'zona', 'cercano', 'posto', 'checkpoint', 'blocchi', 'posti', 'pattuglie'],
    saluto: ['ciao', 'ehi', 'salve', 'buongiorno', 'buonasera', 'pronto', 'ci', 'sei'],
  };
  const normalizza = t => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').match(/[a-z0-9]+/g) || [];
  // somiglianza come difflib.SequenceMatcher.ratio (2·M / (|a|+|b|), M = caratteri della sottosequenza comune più lunga, qui per programmazione dinamica)
  function somiglianza(a, b) { const n = a.length, m = b.length; if (!n || !m) return 0; let prev = new Array(m + 1).fill(0);
    for (let i = 1; i <= n; i++) { const cur = new Array(m + 1).fill(0); for (let j = 1; j <= m; j++) cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]); prev = cur }
    return 2 * prev[m] / (n + m) }
  function classifica(testo, soglia) { soglia = soglia === undefined ? 1 : soglia; const punti = {}; for (const k in LESSICO) punti[k] = 0;
    for (const w of normalizza(testo)) { if (w.length < 2) continue; for (const k in LESSICO) for (const p of LESSICO[k]) { if (w === p) punti[k] += 1; else if (w.length >= 4 && somiglianza(w, p) >= .8) punti[k] += .8 } }
    punti.saluto *= .5; let best = 'indagini'; for (const k in punti) if (punti[k] > punti[best]) best = k;
    return punti[best] >= soglia ? { intento: best, fiducia: punti[best] } : { intento: 'incomprensibile', fiducia: punti[best] } }

  // ---------------------------------------------------------------- stato
  function crea() { return { v: 1, reati: {}, prove: [], ultimaPosizione: null, covo: null, piano: { attivo: false, avanzamento: 0, notificato: false, fatto: false }, chat: [], eventi: [], nc: 0 } }
  const fase = st => { let f = FASI[0][0]; for (const [n, s] of FASI) if (st.piano.avanzamento >= s) f = n; return f };
  const anni = st => Object.entries(st.reati).reduce((a, [k, n]) => a + (ARTICOLI[k] ? ARTICOLI[k][1] : 1) * n, 0);
  const carcere = a => { let c = CARCERI[0][1]; for (const [s, n] of CARCERI) if (a >= s) c = n; return c };
  const prova = (st, k) => { if (!st.prove.includes(k)) st.prove.push(k) };
  function reato(st, kind) { st.reati[kind] = (st.reati[kind] || 0) + 1 }
  function fissaCovo(st, x, z, nome) { st.covo = { x, z, nome: nome || 'zona sconosciuta' }; st.piano = { attivo: false, avanzamento: 0, notificato: false, fatto: false }; st.prove = st.prove.filter(p => p !== 'covo' && p !== 'drone') }

  /* ctx: { t (s), stelle (0–5), visto (bool: una pattuglia ti vede ora), x, z (posizione del giocatore), luogo (nome del luogo) }
     restituisce gli eventi del passo: { tipo: 'notifica' | 'irruzione' | 'covoPerso' | 'avvio' | 'fase', testo, ... } */
  function passo(st, dt, ctx) { const out = [], p = st.piano;
    if (ctx.visto) { prova(st, 'vista'); st.ultimaPosizione = ctx.luogo || st.ultimaPosizione; if (ctx.stelle >= 3) prova(st, 'targa') }
    if (st.covo && !p.attivo && !p.fatto && ctx.visto && ctx.stelle >= 2 && Math.hypot(ctx.x - st.covo.x, ctx.z - st.covo.z) < 300) { p.attivo = true; prova(st, 'covo'); out.push({ tipo: 'avvio', testo: 'La polizia ha collegato la tua auto al covo di ' + st.covo.nome }) }
    if (st.covo && p.attivo && !p.fatto) { const prima = fase(st), vel = ctx.stelle > 0 ? 2 + 2 * ctx.stelle : 1; p.avanzamento = Math.min(100, p.avanzamento + vel * dt / 60);
      const dopo = fase(st); if (dopo !== prima && dopo !== 'irruzione') out.push({ tipo: 'fase', testo: 'L’operazione sul tuo covo è passata alla fase di ' + dopo });
      if (p.avanzamento >= 75 && !p.notificato) { p.notificato = true; prova(st, 'drone'); out.push({ tipo: 'notifica', testo: NOTIFICA }) }
      if (p.avanzamento >= 100) { p.fatto = true; p.attivo = false; const dentro = Math.hypot(ctx.x - st.covo.x, ctx.z - st.covo.z) < 80;
        if (dentro) out.push({ tipo: 'irruzione', testo: RADIO, x: st.covo.x, z: st.covo.z, covo: st.covo.nome });
        else { out.push({ tipo: 'covoPerso', testo: 'Irruzione nel covo di ' + st.covo.nome + ': era vuoto. Il covo è bruciato, scegline un altro.' }); st.covo = null } } }
    for (const e of out) { e.t = ctx.t; st.eventi.push(Object.assign({}, e)) } if (st.eventi.length > 40) st.eventi.splice(0, st.eventi.length - 40);
    return out }

  function rispondi(st, testo, ctx) { ctx = ctx || {}; const { intento, fiducia } = classifica(testo); let r;
    if (intento === 'incomprensibile') { r = ['Non ho capito, ripeti', 'Cosa hai scritto? Sii chiaro!'][st.nc++ % 2] }
    else if (intento === 'saluto') r = 'Sono io. Fai presto, qui in Questura non posso parlare a lungo.';
    else if (intento === 'indagini') r = st.prove.length ? 'Hanno: ' + st.prove.map(k => PROVE[k]).join('; ') + '.' : 'Per ora non hanno niente in mano.';
    else if (intento === 'accuse') { const L = Object.entries(st.reati); if (!L.length) r = 'Non c’è nessuna accusa contro di te.';
      else { const a = anni(st); r = 'Ti contestano: ' + L.map(([k, n]) => (ARTICOLI[k] ? ARTICOLI[k][0] : k) + (n > 1 ? ' (×' + n + ')' : '')).join('; ') + '. Se ti prendono sono circa ' + a + ' anni: ' + carcere(a) + '.' } }
    else if (intento === 'piani') { const p = st.piano; if (!st.covo) r = 'Non hai un covo: prima scegline uno.'; else if (!p.attivo) r = p.fatto ? 'L’operazione è finita.' : 'Nessuna operazione sul covo di ' + st.covo.nome + ', per ora.';
      else { r = 'C’è un’operazione sul covo di ' + st.covo.nome + ': fase di ' + fase(st) + ', preparazione al ' + Math.floor(p.avanzamento) + ' %.'; if (p.avanzamento >= 75) r += ' Sta per succedere: se sei lì, vattene o preparati.' } }
    else r = st.ultimaPosizione ? 'L’ultima posizione che hanno è ' + st.ultimaPosizione + '. Ci sono ' + (ctx.stelle || 0) + ' stelle di allerta.' : 'Non sanno dove sei.';
    st.chat.push({ da: 'io', testo: String(testo) }, { da: 'informatore', testo: r }); if (st.chat.length > 60) st.chat.splice(0, st.chat.length - 60);
    return { intento, fiducia, risposta: r } }

  function valido(o) { return !!(o && o.v === 1 && typeof o.reati === 'object' && Array.isArray(o.prove) && o.piano && Number.isFinite(o.piano.avanzamento) && Array.isArray(o.chat)) }
  const API = { versione: '1.0.0', ARTICOLI, CARCERI, PROVE, FASI, NOTIFICA, RADIO, normalizza, somiglianza, classifica, crea, fase, anni, carcere, reato, fissaCovo, passo, rispondi, valido };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else glob.IOW_INFORMATORE = API;
})(typeof window !== 'undefined' ? window : globalThis);
