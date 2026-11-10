/* ITALIA OPEN WORLD — Database dei veicoli reali (dati tecnici con fonte, unità, attendibilità)
   -------------------------------------------------------------------------------------------
   Ogni dato è un oggetto { v, u, fonte, att, ver, nota }:
     v      valore (numero, intervallo [min,max] o testo)
     u      unità di misura (SI dove possibile: kg, m, N·m, kW, s, m/s, L, L/100km)
     fonte  da dove viene il dato ('stampa'  = schede tecniche pubblicate su riviste e cataloghi online,
                                   'derivato' = calcolato da altri dati dichiarati,
                                   'provvisorio' = valore tipico della categoria, NON del veicolo specifico)
     att    attendibilità: 'alta' (scheda ufficiale del costruttore), 'media' (più cataloghi concordi),
                            'bassa' (un solo catalogo o valore derivato), 'provvisoria' (da sostituire)
     ver    stato di verifica: 'verificato' (letto su più fonti concordi nella sessione del 2026-11-02),
                               'da verificare', 'stima'
   Regola: nessun dato inventato. Dove manca il dato specifico si usa un valore provvisorio della categoria,
   contrassegnato come tale, oppure un intervallo dichiarato. Le fonti sono elencate in docs/VEICOLI.md.
   Il modulo gira sia nel browser (window.IOW_VEICOLI) sia in Node (module.exports). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.IOW_VEICOLI = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const D = (v, u, fonte, att, ver, nota) => ({ v, u, fonte, att, ver, nota: nota || '' });

  /* ------------------------------------------------------------------ Alfa Romeo 159 1.9 JTDm 16V 150 CV (2005-2010)
     È l'auto del giocatore (il modello 3D «Alfa Romeo 159 Sedan» di Nieve5677, CC BY 4.0, già nel gioco).
     Fonti consultate il 2026-11-02 (tutte schede tecniche pubbliche, dati dichiarati dal costruttore e ripresi
     dai cataloghi): alVolante.it, automoto.it, auto-data.net, ultimatespecs.com, cars-data.com, autodata1.com,
     topgear.com (scheda), carsopedia.com. I cataloghi non concordano su tutto: dove divergono si riporta l'intervallo. */
  const ALFA_159_19_JTDM_150 = {
    id: 'alfa_159_19_jtdm_150',
    marca: 'Alfa Romeo', modello: '159', generazione: 'Tipo 939 (2005-2011)', versione: 'Berlina 1.9 JTDm 16V 150 CV',
    anni: D([2005, 2010], 'anno', 'stampa', 'alta', 'verificato'),
    carrozzeria: 'berlina, 4 porte, 5 posti',
    motore: {
      tipo: 'diesel, 4 cilindri in linea, 16 valvole, turbo a geometria variabile, iniezione diretta common rail (Multijet)',
      codice: D('939 A2.000', '', 'stampa', 'media', 'verificato'),
      cilindrata: D(1910, 'cm3', 'stampa', 'alta', 'verificato'),
      potenzaMax: D(110, 'kW', 'stampa', 'alta', 'verificato', '150 CV a 4000 giri/min'),
      regimePotenzaMax: D(4000, 'giri/min', 'stampa', 'alta', 'verificato'),
      coppiaMax: D(320, 'N·m', 'stampa', 'alta', 'verificato', 'a 2000 giri/min'),
      regimeCoppiaMax: D(2000, 'giri/min', 'stampa', 'alta', 'verificato'),
      regimeMinimo: D(800, 'giri/min', 'provvisorio', 'provvisoria', 'stima', 'valore tipico dei diesel 1.9 Multijet; non dichiarato nelle schede'),
      regimeMassimo: D(4600, 'giri/min', 'provvisorio', 'provvisoria', 'stima', 'intervento del limitatore: non dichiarato, valore tipico per questo motore'),
      /* Curva di coppia a pieno carico: i soli punti dichiarati sono 320 N·m a 2000 giri e 110 kW a 4000 giri
         (= 262,6 N·m). Gli altri punti sono un'interpolazione plausibile per un turbodiesel con plateau 2000-2750:
         sono DERIVATI, non misurati. */
      curvaCoppia: D([[800, 150], [1250, 215], [1600, 290], [2000, 320], [2750, 320], [3000, 305], [3500, 283], [4000, 262.6], [4300, 238], [4600, 200]],
        '[giri/min, N·m]', 'derivato', 'bassa', 'stima', 'passa per i due punti dichiarati; il resto è interpolato'),
      inerziaRotante: D(0.18, 'kg·m2', 'provvisorio', 'provvisoria', 'stima', 'albero motore + volano + frizione, valore tipico'),
      attritoInterno: D([12, 0.0045], '[N·m, N·m/(giri/min)]', 'provvisorio', 'provvisoria', 'stima', 'coppia di attrito = a + b·giri'),
      sovralimentazione: D(true, '', 'stampa', 'alta', 'verificato', 'turbo a geometria variabile; pressione massima non dichiarata'),
      pressioneBoostMax: D(1.3, 'bar rel.', 'provvisorio', 'provvisoria', 'stima'),
      bsfcMin: D(205, 'g/kWh', 'provvisorio', 'provvisoria', 'stima', 'consumo specifico minimo tipico di un turbodiesel di questa classe'),
      consumoMinimo: D(0.4, 'L/h', 'provvisorio', 'provvisoria', 'stima', 'consumo al minimo a motore caldo'),
      temperaturaEsercizio: D(90, '°C', 'provvisorio', 'provvisoria', 'stima', 'apertura termostato ~88 °C'),
    },
    trasmissione: {
      trazione: D('anteriore', '', 'stampa', 'alta', 'verificato'),
      cambio: D('manuale, 6 marce', '', 'stampa', 'alta', 'verificato', 'disponibile anche Q-Tronic automatico a 6 rapporti'),
      /* Rapporti: NON dichiarati nelle schede consultate. Si usano valori provvisori tipici di un cambio
         a 6 marce per turbodiesel 1.9 di questa classe. Da sostituire con i dati del manuale d'officina. */
      rapporti: D([3.82, 2.16, 1.48, 1.07, 0.88, 0.74], 'adimensionale', 'provvisorio', 'provvisoria', 'stima', 'rapporti tipici: da verificare'),
      retromarcia: D(3.55, 'adimensionale', 'provvisorio', 'provvisoria', 'stima'),
      rapportoFinale: D(3.10, 'adimensionale', 'provvisorio', 'provvisoria', 'stima', 'scelto perché a 210 km/h in 6ª il motore stia vicino ai 4000 giri (regime di potenza massima)'),
      rendimento: D(0.90, 'adimensionale', 'provvisorio', 'provvisoria', 'stima', 'rendimento complessivo cambio+differenziale'),
      differenziale: D('aperto', '', 'provvisorio', 'provvisoria', 'stima', 'il controllo di trazione è elettronico (ASR/VDC di serie)'),
    },
    masse: {
      massaVuoto: D([1495, 1565], 'kg', 'stampa', 'media', 'verificato', 'i cataloghi divergono (1495 auto-data Q-Tronic, 1510 ultimatespecs, 1535 auto-data/autodata1, 1555 automoto, 1565 encycarpedia); si usa 1535'),
      massaUsata: D(1535, 'kg', 'derivato', 'media', 'verificato', 'mediana delle fonti; + 75 kg di conducente nella simulazione'),
      massaComplessiva: D(2055, 'kg', 'stampa', 'media', 'verificato', '2045-2060 secondo la fonte'),
      distribuzionePesi: D([0.60, 0.40], 'quota ant./post.', 'provvisorio', 'provvisoria', 'stima', 'tipica di una berlina a trazione anteriore con motore trasversale; non dichiarata'),
      altezzaBaricentro: D(0.54, 'm', 'provvisorio', 'provvisoria', 'stima'),
      inerziaImbardata: D(2450, 'kg·m2', 'provvisorio', 'provvisoria', 'stima', 'ordine di grandezza per una berlina di 1,6 t e 4,66 m (≈ 0,95·m·(L²+B²)/12 dà 2700); stesso valore del modello di studio tools/dinamica/dinamica_7dof.py'),
      inerziaRuota: D(1.2, 'kg·m2', 'provvisorio', 'provvisoria', 'stima', 'ruota 215/55 R16 con cerchio in lega, disco e mozzo'),
    },
    dimensioni: {
      lunghezza: D(4.660, 'm', 'stampa', 'alta', 'verificato'),
      larghezza: D(1.828, 'm', 'stampa', 'alta', 'verificato'),
      altezza: D([1.417, 1.452], 'm', 'stampa', 'media', 'verificato', '1417 mm nella maggior parte delle schede; 1452 su ultimatespecs'),
      passo: D(2.700, 'm', 'stampa', 'alta', 'verificato'),
      carreggiate: D([1.584, 1.579], 'm', 'provvisorio', 'provvisoria', 'da verificare', 'ant./post.: valori di stampa non confermati nella sessione'),
    },
    aerodinamica: {
      cx: D(0.33, 'adimensionale', 'stampa', 'bassa', 'da verificare', 'ultimatespecs.com; altre fonti riportano 0.32'),
      areaFrontale: D(2.20, 'm2', 'derivato', 'bassa', 'stima', '≈ 0,85 × larghezza × altezza'),
    },
    pneumatici: {
      misura: D('215/55 R16', '', 'stampa', 'media', 'verificato', 'misura di serie (topgear.com, auto-data: cerchi 7J x 16); altre misure a listino 225/50 R17, 235/45 R18'),
      raggioRotolamento: D(0.3215, 'm', 'derivato', 'media', 'verificato', 'da 215/55 R16: 16·25,4/2 + 215·0,55 mm, senza schiacciamento'),
      pressioneConsigliata: D(2.3, 'bar', 'provvisorio', 'provvisoria', 'stima', 'valore tipico; il dato esatto è sulla targhetta della portiera'),
      attritoMax: D(1.0, 'adimensionale', 'provvisorio', 'provvisoria', 'stima', 'coefficiente di picco su asfalto asciutto per pneumatico stradale'),
      modello: D('Magic Formula 5.2 combinata, set generico', '', 'provvisorio', 'provvisoria', 'stima', 'coefficienti in motore/pneumatici_mf.js (MF52_GENERICO): non sono i dati del 215/55 R16; il D della formula è attritoMax'),
    },
    sterzo: {
      ackermann: D(0.5, 'quota della geometria di Ackermann', 'provvisorio', 'provvisoria', 'stima', '0 = ruote parallele, 1 = Ackermann pieno'),
      ripartizioneRollioAnt: D(0.55, 'quota del trasferimento laterale sull\'asse anteriore', 'provvisorio', 'provvisoria', 'stima', 'barre stabilizzatrici: tipico di una trazione anteriore'),
    },
    sospensioni: {
      anteriore: D('quadrilatero alto (doppio braccio oscillante), molle elicoidali, barra stabilizzatrice', '', 'stampa', 'media', 'verificato'),
      posteriore: D('multilink, molle elicoidali, barra stabilizzatrice', '', 'stampa', 'media', 'verificato'),
      rigidezzaMolla: D([32000, 28000], 'N/m per ruota', 'provvisorio', 'provvisoria', 'stima'),
      smorzamento: D([2600, 2400], 'N·s/m per ruota', 'provvisorio', 'provvisoria', 'stima'),
    },
    freni: {
      anteriori: D('dischi autoventilanti 305 mm', '', 'stampa', 'media', 'verificato'),
      posteriori: D('dischi', '', 'stampa', 'media', 'verificato', 'diametro non confermato'),
      decelerazioneMax: D(10.0, 'm/s2', 'provvisorio', 'provvisoria', 'stima', 'frenata limitata dall\'aderenza, non dall\'impianto; ABS di serie'),
      coppiaFrenoMano: D(1600, 'N·m per ruota posteriore', 'provvisorio', 'provvisoria', 'stima', 'freno a mano meccanico: basta a bloccare le ruote posteriori'),
      abs: D(true, '', 'stampa', 'media', 'verificato'),
      esc: D(true, '', 'stampa', 'media', 'verificato', 'VDC (controllo di stabilità) e ASR di serie sulla 159'),
    },
    serbatoio: D(70, 'L', 'stampa', 'alta', 'verificato'),
    prestazioniDichiarate: {
      velocitaMax: D([207, 212], 'km/h', 'stampa', 'media', 'verificato', '210 nella maggior parte delle fonti; 212 alVolante/auto-data SW; 207 cars-data'),
      acc0_100: D([9.2, 9.6], 's', 'stampa', 'media', 'verificato', '9.4 s nella maggior parte delle fonti'),
      consumoMisto: D([5.7, 6.0], 'L/100km', 'stampa', 'media', 'verificato', 'ciclo NEDC: 6,0 combinato (8,1 urbano, 4,8 extraurbano); 5,7 versione 2009'),
      consumoExtraurbano: D(4.8, 'L/100km', 'stampa', 'media', 'verificato', 'ciclo NEDC extraurbano'),
      consumoUrbano: D(8.1, 'L/100km', 'stampa', 'media', 'verificato', 'ciclo NEDC urbano'),
      co2: D([150, 159], 'g/km', 'stampa', 'media', 'verificato'),
      acc0_1000m: D(30.8, 's', 'stampa', 'bassa', 'da verificare', 'ultimatespecs.com'),
    },
    stato: 'MODELLO SEMPLIFICATO CON DATI DICHIARATI — non validato con misure strumentali reali',
  };

  /* ------------------------------------------------------------------ veicoli generici (DIMOSTRATIVI)
     Servono alle auto del traffico, alle pattuglie e ai test. Non rappresentano nessun veicolo reale:
     tutti i dati sono 'provvisori' di categoria. */
  const gen = (id, nome, m, kW, Nm, rpmP, rpmT, cx, A, r, rap, fin, tank, vmax, a100, cons) => ({
    id, marca: 'Generico', modello: nome, generazione: '-', versione: 'modello dimostrativo di categoria', anni: D([2010, 2020], 'anno', 'provvisorio', 'provvisoria', 'stima'),
    carrozzeria: nome,
    motore: {
      tipo: 'generico', codice: D('-', '', 'provvisorio', 'provvisoria', 'stima'), cilindrata: D(0, 'cm3', 'provvisorio', 'provvisoria', 'stima'),
      potenzaMax: D(kW, 'kW', 'provvisorio', 'provvisoria', 'stima'), regimePotenzaMax: D(rpmP, 'giri/min', 'provvisorio', 'provvisoria', 'stima'),
      coppiaMax: D(Nm, 'N·m', 'provvisorio', 'provvisoria', 'stima'), regimeCoppiaMax: D(rpmT, 'giri/min', 'provvisorio', 'provvisoria', 'stima'),
      regimeMinimo: D(750, 'giri/min', 'provvisorio', 'provvisoria', 'stima'), regimeMassimo: D(Math.round(rpmP * 1.15), 'giri/min', 'provvisorio', 'provvisoria', 'stima'),
      curvaCoppia: D([[750, Nm * .55], [rpmT * .75, Nm * .9], [rpmT, Nm], [rpmT * 1.4, Nm * .97], [rpmP, kW * 1000 / (rpmP * 2 * Math.PI / 60)], [rpmP * 1.15, kW * 1000 / (rpmP * 2 * Math.PI / 60) * .8]], '[giri/min, N·m]', 'derivato', 'provvisoria', 'stima'),
      inerziaRotante: D(0.25, 'kg·m2', 'provvisorio', 'provvisoria', 'stima'), attritoInterno: D([10, 0.004], '[N·m, N·m/(giri/min)]', 'provvisorio', 'provvisoria', 'stima'),
      sovralimentazione: D(true, '', 'provvisorio', 'provvisoria', 'stima'), pressioneBoostMax: D(1.0, 'bar rel.', 'provvisorio', 'provvisoria', 'stima'),
      bsfcMin: D(230, 'g/kWh', 'provvisorio', 'provvisoria', 'stima'), consumoMinimo: D(0.5, 'L/h', 'provvisorio', 'provvisoria', 'stima'), temperaturaEsercizio: D(90, '°C', 'provvisorio', 'provvisoria', 'stima'),
    },
    trasmissione: { trazione: D('anteriore', '', 'provvisorio', 'provvisoria', 'stima'), cambio: D('automatico', '', 'provvisorio', 'provvisoria', 'stima'), rapporti: D(rap, 'adimensionale', 'provvisorio', 'provvisoria', 'stima'), retromarcia: D(3.5, 'adimensionale', 'provvisorio', 'provvisoria', 'stima'), rapportoFinale: D(fin, 'adimensionale', 'provvisorio', 'provvisoria', 'stima'), rendimento: D(0.9, 'adimensionale', 'provvisorio', 'provvisoria', 'stima'), differenziale: D('aperto', '', 'provvisorio', 'provvisoria', 'stima') },
    masse: { massaVuoto: D(m, 'kg', 'provvisorio', 'provvisoria', 'stima'), massaUsata: D(m, 'kg', 'provvisorio', 'provvisoria', 'stima'), massaComplessiva: D(Math.round(m * 1.35), 'kg', 'provvisorio', 'provvisoria', 'stima'), distribuzionePesi: D([0.58, 0.42], 'quota ant./post.', 'provvisorio', 'provvisoria', 'stima'), altezzaBaricentro: D(m > 5000 ? 1.1 : 0.55, 'm', 'provvisorio', 'provvisoria', 'stima') },
    dimensioni: { lunghezza: D(m > 5000 ? 8 : 4.4, 'm', 'provvisorio', 'provvisoria', 'stima'), larghezza: D(m > 5000 ? 2.5 : 1.8, 'm', 'provvisorio', 'provvisoria', 'stima'), altezza: D(m > 5000 ? 3.5 : 1.45, 'm', 'provvisorio', 'provvisoria', 'stima'), passo: D(m > 5000 ? 4.5 : 2.65, 'm', 'provvisorio', 'provvisoria', 'stima'), carreggiate: D([1.55, 1.55], 'm', 'provvisorio', 'provvisoria', 'stima') },
    aerodinamica: { cx: D(cx, 'adimensionale', 'provvisorio', 'provvisoria', 'stima'), areaFrontale: D(A, 'm2', 'provvisorio', 'provvisoria', 'stima') },
    pneumatici: { misura: D('-', '', 'provvisorio', 'provvisoria', 'stima'), raggioRotolamento: D(r, 'm', 'provvisorio', 'provvisoria', 'stima'), pressioneConsigliata: D(m > 5000 ? 8 : 2.3, 'bar', 'provvisorio', 'provvisoria', 'stima'), attritoMax: D(m > 5000 ? 0.85 : 1.0, 'adimensionale', 'provvisorio', 'provvisoria', 'stima') },
    sospensioni: { anteriore: D('-', '', 'provvisorio', 'provvisoria', 'stima'), posteriore: D('-', '', 'provvisorio', 'provvisoria', 'stima'), rigidezzaMolla: D([30000, 28000], 'N/m per ruota', 'provvisorio', 'provvisoria', 'stima'), smorzamento: D([2500, 2400], 'N·s/m per ruota', 'provvisorio', 'provvisoria', 'stima') },
    freni: { anteriori: D('-', '', 'provvisorio', 'provvisoria', 'stima'), posteriori: D('-', '', 'provvisorio', 'provvisoria', 'stima'), decelerazioneMax: D(m > 5000 ? 6.5 : 9.5, 'm/s2', 'provvisorio', 'provvisoria', 'stima'), abs: D(true, '', 'provvisorio', 'provvisoria', 'stima'), esc: D(true, '', 'provvisorio', 'provvisoria', 'stima') },
    serbatoio: D(tank, 'L', 'provvisorio', 'provvisoria', 'stima'),
    prestazioniDichiarate: { velocitaMax: D(vmax, 'km/h', 'provvisorio', 'provvisoria', 'stima'), acc0_100: D(a100, 's', 'provvisorio', 'provvisoria', 'stima'), consumoMisto: D(cons, 'L/100km', 'provvisorio', 'provvisoria', 'stima') },
    stato: 'MODELLO DIMOSTRATIVO DI CATEGORIA — nessun veicolo reale',
  });

  const VEICOLI = {
    alfa_159_19_jtdm_150: ALFA_159_19_JTDM_150,
    generico_auto: gen('generico_auto', 'auto media', 1350, 85, 200, 5500, 3500, 0.31, 2.15, 0.31, [3.7, 2.05, 1.35, 0.98, 0.8, 0.68], 3.6, 50, 185, 11.5, 6.5),
    generico_pattuglia: gen('generico_pattuglia', 'auto di servizio', 1600, 120, 350, 4000, 2000, 0.33, 2.3, 0.33, [3.8, 2.1, 1.4, 1.0, 0.8, 0.68], 3.4, 60, 205, 9.5, 6.8),
    generico_camion: gen('generico_camion', 'camion pesante', 12000, 320, 2100, 1800, 1100, 0.65, 9.5, 0.52, [11.7, 9.0, 7.0, 5.4, 4.2, 3.3, 2.6, 2.0, 1.56, 1.2, 1.0, 0.78], 3.1, 400, 90, 60, 32),
  };

  /* valore numerico utilizzabile dalla simulazione: intervallo → punto medio; mancante → fallback */
  function num(d, fb) {
    if (!d) return fb;
    const v = d.v;
    if (Array.isArray(v) && v.length === 2 && typeof v[0] === 'number' && typeof v[1] === 'number' && !Array.isArray(v[0])) return (v[0] + v[1]) / 2;
    return typeof v === 'number' ? v : fb;
  }

  /* Parametri "piatti" per il motore fisico: solo numeri, con l'elenco di quali sono provvisori */
  function parametri(id) {
    const s = VEICOLI[id] || VEICOLI.alfa_159_19_jtdm_150, m = s.motore, t = s.trasmissione, prov = [];
    const walk = (o, p) => { for (const k in o) { const d = o[k]; if (d && typeof d === 'object' && 'att' in d) { if (d.att === 'provvisoria' || d.att === 'bassa') prov.push(p + k) } else if (d && typeof d === 'object') walk(d, p + k + '.') } };
    walk(s, '');
    return {
      id: s.id, nome: s.marca + ' ' + s.modello + ' ' + s.versione,
      massa: num(s.masse.massaUsata, 1500) + 75, massaComplessiva: num(s.masse.massaComplessiva, 2000),
      quotaAnt: (s.masse.distribuzionePesi.v || [0.6, 0.4])[0], hCg: num(s.masse.altezzaBaricentro, 0.55), passo: num(s.dimensioni.passo, 2.7),
      cx: num(s.aerodinamica.cx, 0.33), area: num(s.aerodinamica.areaFrontale, 2.2),
      raggioRuota: num(s.pneumatici.raggioRotolamento, 0.32), muMax: num(s.pneumatici.attritoMax, 1.0), pressioneNom: num(s.pneumatici.pressioneConsigliata, 2.3),
      curvaCoppia: m.curvaCoppia.v, minimo: num(m.regimeMinimo, 800), limitatore: num(m.regimeMassimo, 4600), inerzia: num(m.inerziaRotante, 0.25),
      attrito: m.attritoInterno.v, boostMax: num(m.pressioneBoostMax, 1.0), turbo: !!m.sovralimentazione.v, bsfcMin: num(m.bsfcMin, 210), consumoMinimo: num(m.consumoMinimo, 0.4),
      potenzaMax: num(m.potenzaMax, 100), regimePotenzaMax: num(m.regimePotenzaMax, 4000), coppiaMax: num(m.coppiaMax, 300), regimeCoppiaMax: num(m.regimeCoppiaMax, 2000),
      rapporti: t.rapporti.v.slice(), retro: num(t.retromarcia, 3.5), finale: num(t.rapportoFinale, 3.5), rendimento: num(t.rendimento, 0.9), trazione: t.trazione.v,
      decelMax: num(s.freni.decelerazioneMax, 9.5), abs: !!s.freni.abs.v, esc: !!s.freni.esc.v,
      carreggiate: s.dimensioni.carreggiate && Array.isArray(s.dimensioni.carreggiate.v) ? s.dimensioni.carreggiate.v.slice() : [1.55, 1.55],
      Iz: num(s.masse.inerziaImbardata, null) || (num(s.masse.massaUsata, 1500) + 75) * (Math.pow(num(s.dimensioni.passo, 2.7) + 1.9, 2) + Math.pow(num(s.dimensioni.larghezza, 1.8), 2)) / 12 * 0.95,
      inerziaRuota: num(s.masse.inerziaRuota, 1.2), frenoManoCoppia: num(s.freni.coppiaFrenoMano, 1600),
      ackermann: s.sterzo ? num(s.sterzo.ackermann, 0.5) : 0.5, rollioAnt: s.sterzo ? num(s.sterzo.ripartizioneRollioAnt, 0.55) : 0.55,
      serbatoio: num(s.serbatoio, 50), diesel: /diesel/i.test(m.tipo),
      dichiarato: { vmax: num(s.prestazioniDichiarate.velocitaMax, 0), acc0_100: num(s.prestazioniDichiarate.acc0_100, 0), consumoMisto: num(s.prestazioniDichiarate.consumoMisto, 0), consumoExtraurbano: num(s.prestazioniDichiarate.consumoExtraurbano, 0), consumoUrbano: num(s.prestazioniDichiarate.consumoUrbano, 0) },
      provvisori: prov, stato: s.stato,
    };
  }

  return { VEICOLI, parametri, num, versione: '1.0.0' };
});
