/* ITALIA OPEN WORLD — ECU virtuali e rete di bordo simulata
   =========================================================
   SIMULAZIONE SOFTWARE. Nessuna centralina fisica è collegata né collegabile da questo modulo: i modelli sono
   generici (nessun software o specifica proprietaria di un costruttore) e servono al gioco e ai test.
   L'interfaccia `hardware` esiste solo per dichiarare in modo esplicito che il collegamento fisico (HIL) NON è
   disponibile: non simula una connessione che non esiste.

   Centraline modellate (ognuna con identificativo, versione, parametri, sensori, uscite, stati, codici di guasto):
     EMS  Engine Management System (centralina motore): limitatore, protezione termica (modalità ridotta),
          plausibilità dei sensori, taglio dell'iniezione a batteria scarica, codici P0xxx generici SAE J2012.
     TCU  Transmission Control Unit: logica del cambio automatico (in motore/fisica_veicolo.js), limiti con cambio danneggiato.
     ABS  con sensori ruota: perdita di un sensore → ABS/ASR/ESC disattivati (come nei veicoli reali).
     ESC  controllo di stabilità: con deriva laterale alta taglia la coppia (segnale al motore).
     BCM  Body Control Module: luci, portiere, livello carburante, spie.
     BMS  qui: gestione della batteria 12 V (tensione, carica, alternatore). Non è un BMS di trazione.
     GW   Gateway: controlla la presenza (heartbeat) delle centraline e segnala le perdite di comunicazione (U0xxx).
   Rete: bus CAN simulato (messaggi con identificativo, periodo, segnali; contatore errori; stato bus-off).
   Protocollo diagnostico: servizi "tipo UDS" ridotti (lettura codici 0x19, cancellazione 0x14, dati 0x22) sul modello
   virtuale: NON è un'implementazione conforme a ISO 14229 e non parla con hardware.
   Laboratorio guasti: iniezione di guasti solo sui modelli virtuali (perdita segnale, valore implausibile,
   timeout, tensione, temperatura, interruzione del bus). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.IOW_ECU = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const cl = (v, a, b) => v < a ? a : v > b ? b : v;
  /* generatore pseudo-casuale deterministico (mulberry32): il rumore dei sensori è riproducibile dato il seme */
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }

  /* codici di guasto generici (SAE J2012 / ISO 15031-6: standard pubblici) e descrizioni in italiano */
  const DTC = {
    P0115: 'Circuito sensore temperatura refrigerante', P0117: 'Sensore temperatura refrigerante: segnale basso', P0118: 'Sensore temperatura refrigerante: segnale alto',
    P0217: 'Surriscaldamento motore', P0122: 'Sensore pedale acceleratore: segnale basso', P0123: 'Sensore pedale acceleratore: segnale alto',
    P0335: 'Sensore giri albero motore: nessun segnale', P0234: 'Sovralimentazione eccessiva', P0299: 'Sovralimentazione insufficiente',
    P0500: 'Sensore velocità veicolo', P0562: 'Tensione di sistema bassa', P0563: 'Tensione di sistema alta', P0087: 'Pressione carburante bassa (serbatoio vuoto o perdita)',
    P0300: 'Combustione irregolare (danno meccanico al motore)', P0196: 'Sensore temperatura olio', P0197: 'Sensore temperatura olio: segnale basso', P0198: 'Sensore temperatura olio: segnale alto',
    P0700: 'Sistema di controllo del cambio', P0730: 'Rapporto del cambio non corretto', P0711: 'Sensore temperatura olio cambio: plausibilità', P0702: 'Impianto elettrico del cambio',
    C0035: 'Sensore ruota anteriore sinistra', C0040: 'Sensore ruota anteriore destra', C0045: 'Sensore ruota posteriore sinistra', C0050: 'Sensore ruota posteriore destra',
    C0110: 'Pompa ABS', C0121: 'Valvola ABS', C0131: 'Sensore pressione freni', C0196: 'Sensore imbardata/accelerazione laterale (ESC)',
    B1000: 'Centralina carrozzeria: errore interno', B2425: 'Faro anteriore sinistro: circuito aperto', B2426: 'Faro anteriore destro: circuito aperto', B2430: 'Fanale posteriore sinistro: circuito aperto', B2431: 'Fanale posteriore destro: circuito aperto',
    B2450: 'Sensore livello carburante: plausibilità', B1400: 'Interruttore portiera: plausibilità', B1900: 'Batteria: scarica eccessiva',
    U0001: 'Bus CAN ad alta velocità', U0100: 'Perdita comunicazione con centralina motore', U0101: 'Perdita comunicazione con centralina cambio', U0121: 'Perdita comunicazione con ABS',
    U0140: 'Perdita comunicazione con centralina carrozzeria', U0141: 'Perdita comunicazione con gateway', U0111: 'Perdita comunicazione con gestione batteria',
  };

  function mkEcu(id, nome, tipo, hw, sw) {
    return { id, nome, tipo, versioneHW: hw, versioneSW: sw, stato: 'ok', alimentato: true, online: true, dtc: {}, sensori: {}, uscite: {}, modo: 'normale', ultimoMsg: 0, parametri: {}, note: [] };
  }

  function crea(veh, opt) {
    opt = opt || {};
    const r = {
      t: 0, veh, seed: opt.seed === undefined ? 1 : opt.seed, rumore: opt.rumore !== false, rnd: rng(opt.seed === undefined ? 1 : opt.seed),
      ecu: {
        EMS: mkEcu('EMS', 'Centralina motore (EMS)', 'engine', 'virt-1.0', 'iow-ems 1.0.0'),
        TCU: mkEcu('TCU', 'Centralina cambio (TCU)', 'transmission', 'virt-1.0', 'iow-tcu 1.0.0'),
        ABS: mkEcu('ABS', 'ABS / ASR', 'abs', 'virt-1.0', 'iow-abs 1.0.0'),
        ESC: mkEcu('ESC', 'Controllo di stabilità (ESC)', 'esc', 'virt-1.0', 'iow-esc 1.0.0'),
        BCM: mkEcu('BCM', 'Centralina carrozzeria (BCM)', 'body', 'virt-1.0', 'iow-bcm 1.0.0'),
        BMS: mkEcu('BMS', 'Gestione batteria 12 V', 'battery', 'virt-1.0', 'iow-bms 1.0.0'),
        GW: mkEcu('GW', 'Gateway', 'gateway', 'virt-1.0', 'iow-gw 1.0.0'),
      },
      bus: { nome: 'CAN-C 500 kbit/s (simulato)', stato: 'ok', errori: 0, messaggi: 0, frames: {}, log: [], busOff: false, caricoPct: 0 },
      batteria: { V: 12.6, soc: 0.9, capacitaAh: 60, correnteA: 0, alternatore: true },
      guasti: [],                  // guasti iniettati (laboratorio): { id, ecu, sensore, tipo, valore, fino }
      registro: [],                // registro eventi (prove): { t, ecu, tipo, codice, dati }
      limiti: {},                  // ultimi limiti imposti alla fisica
      stat: { interventiESC: 0, interventiABS: 0, interventiASR: 0, limp: 0 },
      ctx: { scivolamentoLaterale: 0, sterzo: 0, luci: false, notte: false, portaAperta: false, danni: null },
    };
    r.ecu.EMS.parametri = { limitatoreGiri: veh.par.limitatore, TlimpC: 108, TgraveC: 118, VminAvviamento: 9.2, VminMarcia: 8.0 };
    r.ecu.TCU.parametri = { marce: veh.cambio.nMarce, modo: veh.cambio.modo };
    r.ecu.ABS.parametri = { sogliaBloccaggio: 0.2 };
    r.ecu.ESC.parametri = { sogliaDerivaMs: 6.5, taglioMax: 0.6 };
    r.ecu.BMS.parametri = { Vnom: 12.6, Valt: 14.2, capacitaAh: 60 };
    return r;
  }

  /* --------------------------------------------------------------- registro e codici di guasto */
  function nota(r, ecu, tipo, codice, dati) { const e = { t: +r.t.toFixed(2), ecu, tipo, codice: codice || '', dati: dati || {} }; r.registro.push(e); if (r.registro.length > 600) r.registro.splice(0, 150); return e }
  function setDTC(r, ecuId, codice, attivo, freeze) {
    const e = r.ecu[ecuId]; if (!e) return; let d = e.dtc[codice];
    if (attivo) {
      if (!d) { d = e.dtc[codice] = { codice, descrizione: DTC[codice] || 'Codice non in elenco', stato: 'attivo', conteggio: 1, primo: r.t, ultimo: r.t, freeze: freeze || null }; nota(r, ecuId, 'dtc_attivo', codice, freeze || {}) }
      else { if (d.stato !== 'attivo') { d.stato = 'attivo'; d.conteggio++; nota(r, ecuId, 'dtc_riattivato', codice, freeze || {}) } d.ultimo = r.t }
    } else if (d && d.stato === 'attivo') { d.stato = 'memorizzato'; nota(r, ecuId, 'dtc_memorizzato', codice) }
  }
  function leggiDTC(r, ecuId) { const out = []; for (const k in r.ecu) { if (ecuId && k !== ecuId) continue; for (const c in r.ecu[k].dtc) out.push(Object.assign({ ecu: k }, r.ecu[k].dtc[c])) } return out }
  function cancellaDTC(r, ecuId) { let n = 0; for (const k in r.ecu) { if (ecuId && k !== ecuId) continue; for (const c in r.ecu[k].dtc) { if (r.ecu[k].dtc[c].stato !== 'attivo') { delete r.ecu[k].dtc[c]; n++ } } } nota(r, ecuId || 'TUTTE', 'diagnosi_cancella', '', { cancellati: n }); return n }   // i codici ancora attivi restano (come un vero tester: la causa va rimossa)
  function freeze(r) { const v = r.veh, m = v.motore; return { rpm: Math.round(m.rpm), kmh: +(v.v * 3.6).toFixed(1), Tacqua: +m.Tacqua.toFixed(1), carico: +m.carico.toFixed(2), marcia: v.cambio.marcia, V: +r.batteria.V.toFixed(2), odoKm: +(v.odometro / 1000).toFixed(2) } }

  /* --------------------------------------------------------------- bus CAN simulato: ogni messaggio ha identificativo, periodo e segnali */
  function tx(r, mittente, id, nome, periodoMs, segnali) {
    const e = r.ecu[mittente]; if (!e || !e.online || !e.alimentato || r.bus.busOff) { r.bus.errori += r.bus.busOff ? 1 : 0; return false }
    let f = r.bus.frames[id]; if (!f) f = r.bus.frames[id] = { id, nome, mittente, periodoMs, n: 0, ultimo: -1, segnali: {} };
    if (f.ultimo >= 0 && (r.t - f.ultimo) * 1000 < periodoMs * 0.9) return true;   // non ancora scaduto il periodo
    f.ultimo = r.t; f.n++; f.segnali = segnali; r.bus.messaggi++; e.ultimoMsg = r.t;
    r.bus.log.push({ t: +r.t.toFixed(3), id, nome, mittente, segnali }); if (r.bus.log.length > 120) r.bus.log.splice(0, 40);
    return true;
  }

  /* --------------------------------------------------------------- guasti iniettati (solo modelli virtuali) */
  let gid = 0;
  function iniettaGuasto(r, g) {
    const G = { id: ++gid, ecu: g.ecu, sensore: g.sensore || '', tipo: g.tipo, valore: g.valore, fino: g.durata ? r.t + g.durata : Infinity, descr: g.descr || '' };
    r.guasti.push(G); nota(r, g.ecu || 'RETE', 'guasto_iniettato', '', { tipo: g.tipo, sensore: g.sensore, valore: g.valore, durata: g.durata || null });
    return G.id;
  }
  function rimuoviGuasti(r, id) { const n = r.guasti.length; r.guasti = id ? r.guasti.filter(g => g.id !== id) : []; if (n !== r.guasti.length) nota(r, 'RETE', 'guasti_rimossi', '', { n: n - r.guasti.length }); return n - r.guasti.length }
  const guasto = (r, ecu, sensore, tipo) => r.guasti.find(g => g.fino > r.t && g.ecu === ecu && (!sensore || g.sensore === sensore) && (!tipo || g.tipo === tipo));
  /* lettura di un sensore con rumore e guasti: 'perdita' → null, 'implausibile' → valore imposto, 'deriva' → offset */
  function leggi(r, ecu, sensore, vero, rum) {
    const g = guasto(r, ecu, sensore);
    if (g) { if (g.tipo === 'perdita' || g.tipo === 'timeout') return null; if (g.tipo === 'implausibile') return g.valore; if (g.tipo === 'deriva') return vero + (g.valore || 0) }
    if (r.rumore && rum) return vero + (r.rnd() - 0.5) * 2 * rum;
    return vero;
  }

  /* --------------------------------------------------------------- un passo della rete: legge la fisica, aggiorna le centraline, impone i limiti */
  function passo(r, dt, ctx) {
    if (!(dt > 0)) return r; r.t += dt; if (ctx) Object.assign(r.ctx, ctx);
    const v = r.veh, m = v.motore, E = v.ecu, B = r.batteria, D = r.ctx.danni || {}, X = r.ctx;
    // scadenza dei guasti a tempo
    r.guasti = r.guasti.filter(g => g.fino > r.t);
    /* --- alimentazione e bus: con l'impianto elettrico danneggiato o un'interruzione iniettata il bus va in bus-off --- */
    const gBus = guasto(r, 'RETE', '', 'bus');
    r.bus.busOff = !!gBus || (D.elettrico !== undefined && D.elettrico < 0.15);
    r.bus.stato = r.bus.busOff ? 'bus-off' : (D.elettrico !== undefined && D.elettrico < 0.6 ? 'errori' : 'ok');
    if (r.bus.busOff) r.bus.errori += dt * 100;
    for (const k in r.ecu) { const e = r.ecu[k]; e.alimentato = B.V > 6.5; const gt = guasto(r, k, '', 'timeout'); e.online = e.alimentato && !gt && !(D.elettrico !== undefined && D.elettrico < 0.3 && k !== 'EMS' && k !== 'GW') && !(D.centraline !== undefined && D.centraline < 0.2 && k !== 'EMS' && k !== 'GW') }   // centraline: scatola delle ECU schiacciata (danni_meccanici.comp.centraline)

    /* --- BMS / batteria 12 V: alternatore a motore acceso, consumo con luci e avviamento, danni --- */
    {
      const alt = m.acceso && v.mod.alternatore > 0.2 && !guasto(r, 'BMS', 'alternatore');
      B.alternatore = alt;
      const carico = 3 + (X.luci || X.notte ? 9 : 0) + (m.avviamentoT > 0 ? 180 : 0) + (D.batteria !== undefined ? (1 - D.batteria) * 15 : 0);   // A: perdite interne con batteria danneggiata
      const ricarica = alt ? Math.min(60, 35 * v.mod.alternatore * Math.min(1, m.rpm / 1500)) : 0;
      B.correnteA = ricarica - carico;
      B.soc = cl(B.soc + B.correnteA / 3600 / B.capacitaAh * dt, 0, 1);
      const Vriposo = 10.5 + 2.2 * Math.sqrt(B.soc), Ri = 0.01 + 0.05 * (1 - B.soc) * (1 - B.soc) + (D.batteria !== undefined ? (1 - D.batteria) * 0.08 : 0);   // tensione a vuoto e resistenza interna (cresce con batteria scarica o danneggiata)
      const gV = guasto(r, 'BMS', 'tensione');
      const Vt = gV ? (gV.tipo === 'implausibile' ? gV.valore : Vriposo) : alt ? Math.max(Vriposo, 14.2 - (D.batteria !== undefined ? (1 - D.batteria) * 1.5 : 0) - Math.max(0, 0.6 - m.rpm / 2500)) : Vriposo - carico * Ri;
      B.V += (Vt - B.V) * Math.min(1, dt / 0.4);
      const bms = r.ecu.BMS; bms.sensori = { V: +B.V.toFixed(2), I: +B.correnteA.toFixed(1), soc: +B.soc.toFixed(3), alternatore: alt };
      setDTC(r, 'BMS', 'B1900', B.soc < 0.15, freeze(r));
      tx(r, 'BMS', '0x5A0', 'Batteria', 500, bms.sensori);
    }

    /* --- ABS / ESC: sensori ruota, bloccaggio, stabilità --- */
    {
      const abs = r.ecu.ABS, esc = r.ecu.ESC, R = v.ruote, sens = [], codici = ['C0035', 'C0040', 'C0045', 'C0050'], nomi = ['AS', 'AD', 'PS', 'PD'];
      let guasti = 0;
      for (let k = 0; k < 4; k++) {
        const rotta = D.sensoriRuota ? D.sensoriRuota[k] : false;
        const wv = R.bloccate && k < 2 ? 0 : R.bloccatePost && k >= 2 ? 0 : R.slitta && k < 2 ? Math.abs(v.v) * 1.5 : Math.abs(v.v);
        const val = rotta ? null : leggi(r, 'ABS', 'ruota' + nomi[k], wv, 0.05);
        sens.push(val === null ? null : +Math.max(0, val).toFixed(2));
        const ko = val === null || (Math.abs(v.v) > 3 && Math.abs(val - Math.abs(v.v)) > Math.max(2, Math.abs(v.v) * 0.6) && !R.bloccate && !R.bloccatePost && !R.slitta);
        setDTC(r, 'ABS', codici[k], ko, ko ? freeze(r) : null); if (ko) guasti++;
      }
      const pompa = D.absPompa !== undefined && D.absPompa < 0.3; setDTC(r, 'ABS', 'C0110', pompa, pompa ? freeze(r) : null);
      abs.sensori = { ruote: sens, V: +B.V.toFixed(1) }; abs.online = abs.online && !pompa;
      const absOK = abs.online && guasti === 0 && !pompa && v.par.abs;
      abs.stato = !abs.online ? 'offline' : guasti || pompa ? 'guasto' : 'ok'; abs.modo = absOK ? 'normale' : 'disattivato (spia accesa)';
      // ESC: usa i sensori ruota dell'ABS e il sensore di imbardata; con deriva alta taglia la coppia
      const gImb = guasto(r, 'ESC', 'imbardata'); setDTC(r, 'ESC', 'C0196', !!gImb || (D.sensoreImbardata !== undefined && D.sensoreImbardata < 0.3), freeze(r));
      const escOK = absOK && esc.online && !gImb && !(D.sensoreImbardata !== undefined && D.sensoreImbardata < 0.3) && v.par.esc && X.escAttivo !== false;
      const deriva = Math.abs(X.scivolamentoLaterale || 0);
      let taglio = 0;
      if (escOK && deriva > esc.parametri.sogliaDerivaMs && Math.abs(v.v) > 4) { taglio = cl((deriva - esc.parametri.sogliaDerivaMs) / 6, 0.15, esc.parametri.taglioMax); if (!esc.uscite.intervento) { r.stat.interventiESC++; nota(r, 'ESC', 'intervento', '', { deriva: +deriva.toFixed(1), kmh: +(v.v * 3.6).toFixed(0) }) } }
      esc.uscite = { intervento: taglio > 0, taglioCoppia: +taglio.toFixed(2), attivo: escOK }; esc.stato = !esc.online ? 'offline' : escOK ? 'ok' : 'disattivato'; esc.modo = escOK ? 'normale' : 'spia ESC accesa';
      if (v.freni.abs && absOK) { if (!abs.uscite.regolazione) { r.stat.interventiABS++ } }
      abs.uscite = { regolazione: v.freni.abs && absOK, asr: absOK && v.ruote.slip > 0.11 };
      E.abs = absOK; E.asr = escOK || absOK;      // ASR funziona con il solo ABS; ESC richiede anche l'imbardata
      r.limiti.tagliaCoppiaESC = taglio;
      tx(r, 'ABS', '0x1A0', 'Velocità ruote', 20, { ruote: sens, abs: abs.uscite.regolazione, asr: abs.uscite.asr });
      tx(r, 'ESC', '0x1A4', 'Stabilità', 20, esc.uscite);
    }

    /* --- EMS: centralina motore --- */
    {
      const e = r.ecu.EMS, p = e.parametri;
      const Tacqua = leggi(r, 'EMS', 'Tacqua', m.Tacqua, 0.3), Tolio = leggi(r, 'EMS', 'Tolio', m.Tolio, 0.4), rpm = leggi(r, 'EMS', 'giri', m.rpm, 4), ped = leggi(r, 'EMS', 'pedale', m.acc, 0.004), boost = leggi(r, 'EMS', 'boost', m.boost, 0.01);
      const absF = r.bus.frames['0x1A0'], vel = r.ecu.ABS.online && absF && absF.ultimo >= 0 && r.t - absF.ultimo < 0.3 && !r.bus.busOff ? Math.abs(v.v) : null;
      e.sensori = { Tacqua: Tacqua === null ? null : +Tacqua.toFixed(1), Tolio: Tolio === null ? null : +Tolio.toFixed(1), giri: rpm === null ? null : Math.round(rpm), pedale: ped === null ? null : +ped.toFixed(2), boost: boost === null ? null : +boost.toFixed(2), velocita: vel === null ? null : +(vel * 3.6).toFixed(0), V: +B.V.toFixed(1), carburanteL: +v.carburante.litri.toFixed(1) };
      const fz = freeze(r);
      // plausibilità sensori
      setDTC(r, 'EMS', 'P0115', Tacqua === null, fz); setDTC(r, 'EMS', 'P0117', Tacqua !== null && Tacqua < -45, fz); setDTC(r, 'EMS', 'P0118', Tacqua !== null && Tacqua > 160, fz);
      setDTC(r, 'EMS', 'P0196', Tolio === null, fz); setDTC(r, 'EMS', 'P0197', Tolio !== null && Tolio < -45, fz); setDTC(r, 'EMS', 'P0198', Tolio !== null && Tolio > 190, fz);
      setDTC(r, 'EMS', 'P0122', ped !== null && ped < -0.05, fz); setDTC(r, 'EMS', 'P0123', ped !== null && ped > 1.05, fz);
      const giriKO = rpm === null; setDTC(r, 'EMS', 'P0335', giriKO && m.acceso, fz);
      setDTC(r, 'EMS', 'P0500', vel === null && m.acceso && Math.abs(v.v) > 2, fz);
      setDTC(r, 'EMS', 'P0562', B.V < 10.5 && m.acceso, fz); setDTC(r, 'EMS', 'P0563', B.V > 15.8, fz);
      setDTC(r, 'EMS', 'P0087', (v.carburante.vuoto && m.acc > 0.1) || (v.mod.perditaCarburante > 0.002), fz);
      setDTC(r, 'EMS', 'P0300', v.mod.potenza < 0.6, fz);
      setDTC(r, 'EMS', 'P0299', v.par.turbo && m.acceso && m.carico > 0.7 && m.rpm > 2200 && boost !== null && boost < v.par.boostMax * 0.3 && v.mod.potenza < 0.85, fz);
      setDTC(r, 'EMS', 'P0234', boost !== null && boost > v.par.boostMax * 1.25, fz);
      // temperatura usata dalla centralina: con sensore guasto valore sostitutivo 90 °C e potenza ridotta
      const Tuso = Tacqua === null || Tacqua < -45 || Tacqua > 160 ? 90 : Tacqua;
      const sostitutivo = Tacqua === null || Tacqua < -45 || Tacqua > 160;
      setDTC(r, 'EMS', 'P0217', Tuso > p.TlimpC, fz);
      let accMax = 1, modo = 'normale', spegni = false;
      if (sostitutivo) { accMax = Math.min(accMax, 0.6); modo = 'valore sostitutivo temperatura: potenza limitata' }
      if (Tuso > p.TgraveC) { accMax = Math.min(accMax, 0.2); modo = 'protezione motore: surriscaldamento grave' } else if (Tuso > p.TlimpC) { accMax = Math.min(accMax, 0.45); modo = 'protezione termica (potenza ridotta)' }
      if (ped === null || ped < -0.05 || ped > 1.05) { accMax = Math.min(accMax, 0.3); modo = 'pedale implausibile: regime di sicurezza' }   // «pedale implausibile» → risposta ridotta
      if (giriKO) { spegni = true; modo = 'nessun segnale giri: motore spento' }
      if (B.V < p.VminMarcia) { spegni = true; modo = 'tensione insufficiente: iniezione disabilitata' }
      if (v.mod.potenza < 0.6) { accMax = Math.min(accMax, 0.35 + v.mod.potenza * 0.5); if (modo === 'normale') modo = 'danno motore: potenza ridotta' }
      // taglio coppia da ESC
      E.tagliaCoppia = r.limiti.tagliaCoppiaESC || 0;
      E.accMax = accMax; E.spegni = spegni; E.limitatore = p.limitatoreGiri;
      v.mod.avviamento = B.V < p.VminAvviamento ? 0 : (v.mod.avviamento === 0 ? 1 : v.mod.avviamento);
      if (modo !== 'normale' && e.modo === 'normale') { r.stat.limp++; nota(r, 'EMS', 'modo_ridotto', '', { modo, Tacqua: fz.Tacqua, V: fz.V }) }
      e.modo = modo; e.stato = !e.online ? 'offline' : modo === 'normale' ? 'ok' : 'degradato';
      e.uscite = { accMax: +accMax.toFixed(2), tagliaCoppia: +E.tagliaCoppia.toFixed(2), limitatore: m.limitatore, spegni, iniezione: m.acceso && !spegni, boostRichiesto: +(m.accEff * v.par.boostMax).toFixed(2) };
      tx(r, 'EMS', '0x0C0', 'Stato motore', 10, { giri: e.sensori.giri, coppiaNm: Math.round(m.coppia), pedale: e.sensori.pedale, Tacqua: e.sensori.Tacqua, accMax: e.uscite.accMax, modo: e.modo });
    }

    /* --- TCU --- */
    {
      const e = r.ecu.TCU, c = v.cambio, dC = D.cambio === undefined ? 1 : D.cambio;
      const Tolc = leggi(r, 'TCU', 'Tolio', m.Tolio - 5, 0.5);
      e.sensori = { marcia: c.marcia, giriIngresso: Math.round(m.rpm), giriUscita: Math.round(c.rpmRuote), Tolio: Tolc === null ? null : +Tolc.toFixed(1), modo: c.modo };
      setDTC(r, 'TCU', 'P0711', Tolc === null, freeze(r));
      setDTC(r, 'TCU', 'P0700', dC < 0.6, freeze(r)); setDTC(r, 'TCU', 'P0730', dC < 0.35, freeze(r)); setDTC(r, 'TCU', 'P0702', !e.online, null);
      E.marciaMaxTCU = dC < 0.35 ? 2 : dC < 0.6 ? 3 : c.nMarce; E.cambioBloccato = dC < 0.12 || !e.online;
      e.modo = E.cambioBloccato ? 'cambio bloccato (emergenza)' : E.marciaMaxTCU < c.nMarce ? 'marce limitate a ' + E.marciaMaxTCU : 'normale'; e.stato = !e.online ? 'offline' : e.modo === 'normale' ? 'ok' : 'degradato';
      e.uscite = { marciaMax: E.marciaMaxTCU, bloccato: E.cambioBloccato, cambiataInCorso: c.cambiataT > 0 };
      tx(r, 'TCU', '0x0D0', 'Stato cambio', 20, { marcia: c.marcia, modo: c.modo, bloccato: E.cambioBloccato });
    }

    /* --- BCM --- */
    {
      const e = r.ecu.BCM, lf = D.lampF || [false, false], lr = D.lampR || [false, false];
      const liv = leggi(r, 'BCM', 'carburante', v.carburante.litri, 0.2);
      e.sensori = { carburanteL: liv === null ? null : +liv.toFixed(1), riserva: v.carburante.riserva, portaAperta: !!X.portaAperta, luci: !!(X.luci || X.notte), V: +B.V.toFixed(1) };
      setDTC(r, 'BCM', 'B2425', !!lf[0], null); setDTC(r, 'BCM', 'B2426', !!lf[1], null); setDTC(r, 'BCM', 'B2430', !!lr[0], null); setDTC(r, 'BCM', 'B2431', !!lr[1], null);
      setDTC(r, 'BCM', 'B2450', liv === null || liv < -1 || liv > v.carburante.serbatoio + 2, null);
      const spie = [];
      if (v.carburante.riserva) spie.push('riserva'); if (B.V < 11.8 && m.acceso) spie.push('batteria'); if (m.Tacqua > 105) spie.push('temperatura'); if (!E.abs && v.par.abs) spie.push('ABS'); if (!E.asr && v.par.esc) spie.push('ESC'); if (r.ecu.EMS.modo !== 'normale') spie.push('avaria motore');
      if (Object.values(r.ecu.EMS.dtc).some(d => d.stato === 'attivo')) spie.push('MIL'); if (X.portaAperta) spie.push('portiera'); if (v.mod.freni && (v.mod.freni[0] + v.mod.freni[1] + v.mod.freni[2] + v.mod.freni[3]) / 4 < 0.6) spie.push('freni');
      e.uscite = { spie, lampadeOK: [!lf[0], !lf[1], !lr[0], !lr[1]] }; e.stato = e.online ? 'ok' : 'offline';
      tx(r, 'BCM', '0x3B0', 'Carrozzeria', 100, { spie, carburanteL: e.sensori.carburanteL, porta: !!X.portaAperta, luci: e.sensori.luci });
    }

    /* --- Gateway: presenza delle centraline --- */
    {
      const gw = r.ecu.GW, att = {}, mappa = { EMS: ['U0100', '0x0C0'], TCU: ['U0101', '0x0D0'], ABS: ['U0121', '0x1A0'], BCM: ['U0140', '0x3B0'], BMS: ['U0111', '0x5A0'] };
      for (const k in mappa) { const f = r.bus.frames[mappa[k][1]], ok = !r.bus.busOff && f && f.ultimo >= 0 && (r.t - f.ultimo) < Math.max(0.5, f.periodoMs / 1000 * 5); att[k] = !!ok; setDTC(r, 'GW', mappa[k][0], !ok && r.t > 1, null) }
      setDTC(r, 'GW', 'U0001', r.bus.busOff, null);
      gw.sensori = { presenti: att, busErrori: Math.round(r.bus.errori), messaggi: r.bus.messaggi }; gw.stato = r.bus.busOff ? 'guasto' : Object.values(att).every(Boolean) || r.t < 1 ? 'ok' : 'degradato';
      // nelle altre centraline: perdita di comunicazione con il motore/ABS
      setDTC(r, 'TCU', 'U0100', !att.EMS && r.t > 1, null); setDTC(r, 'EMS', 'U0121', !att.ABS && r.t > 1, null); setDTC(r, 'ABS', 'U0100', !att.EMS && r.t > 1, null);
      r.bus.caricoPct = Math.min(100, Math.round((r.bus.messaggi / Math.max(1, r.t)) * 100 / 4000 * 100) / 100 * 100) / 100;
      tx(r, 'GW', '0x7E0', 'Gateway', 1000, gw.sensori);
    }
    return r;
  }

  /* --------------------------------------------------------------- diagnosi «tipo UDS» (solo sui modelli virtuali) */
  const diagnosi = {
    servizi: { '0x19': 'ReadDTCInformation (lettura codici)', '0x14': 'ClearDiagnosticInformation (cancellazione)', '0x22': 'ReadDataByIdentifier (dati in tempo reale)', '0x10': 'DiagnosticSessionControl (sessione: solo default)' },
    leggiCodici: (r, ecu) => leggiDTC(r, ecu), cancella: (r, ecu) => cancellaDTC(r, ecu),
    dati: (r, ecu) => { const e = r.ecu[ecu]; return e ? { sensori: e.sensori, uscite: e.uscite, modo: e.modo, stato: e.stato, versioneSW: e.versioneSW, versioneHW: e.versioneHW } : null },
    nota: 'Implementazione ridotta e NON conforme a ISO 14229: funziona solo sulle centraline virtuali del gioco.',
  };

  /* --------------------------------------------------------------- hardware fisico: dichiarato NON disponibile */
  const hardware = {
    stato: 'non collegato', disponibile: false, interfacce: ['CAN', 'CAN FD', 'LIN', 'Automotive Ethernet', 'UDS', 'XCP'],
    adattatori: [],   // nessun driver implementato: Vector, dSPACE, NI sono soltanto fornitori previsti dall'architettura
    soloLettura: true, autorizzato: false,
    collega() { return { ok: false, motivo: 'Nessun adattatore hardware implementato: il collegamento a centraline fisiche (HIL) non è disponibile in questa versione. Il gioco usa solo centraline virtuali.' } },
  };

  /* --------------------------------------------------------------- rapporto riproducibile (evidenze) */
  function rapporto(r, extra) {
    const v = r.veh, out = {
      generato: new Date().toISOString(), tipo: 'rapporto ECU — SIMULAZIONE SOFTWARE (nessuna centralina fisica)', versioneModulo: '1.0.0', seme: r.seed, tempoSimulato: +r.t.toFixed(2),
      veicolo: { id: v.par.id, nome: v.par.nome, parametriProvvisori: v.par.provvisori.length, stato: v.par.stato },
      centraline: Object.values(r.ecu).map(e => ({ id: e.id, nome: e.nome, tipo: e.tipo, versioneHW: e.versioneHW, versioneSW: e.versioneSW, stato: e.stato, modo: e.modo, online: e.online, natura: 'virtuale', sensori: e.sensori, uscite: e.uscite, codici: Object.values(e.dtc) })),
      bus: { nome: r.bus.nome, stato: r.bus.stato, errori: Math.round(r.bus.errori), messaggi: r.bus.messaggi, messaggiDefiniti: Object.values(r.bus.frames).map(f => ({ id: f.id, nome: f.nome, mittente: f.mittente, periodoMs: f.periodoMs, inviati: f.n })) },
      batteria: r.batteria, guastiIniettati: r.guasti, statistiche: r.stat, registro: r.registro.slice(-200), hardware: { stato: hardware.stato, disponibile: hardware.disponibile },
      limiti: { nota: 'Modelli generici, non conformi a norme (ISO 14229, AUTOSAR); nessuna validazione su veicolo o banco reale.' },
    };
    if (extra) Object.assign(out, extra);
    return out;
  }

  return { versione: '1.0.0', DTC, crea, passo, setDTC, leggiDTC, cancellaDTC, iniettaGuasto, rimuoviGuasti, diagnosi, hardware, rapporto, nota };
});
