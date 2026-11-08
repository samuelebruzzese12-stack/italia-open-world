# Cronologia delle versioni

## Moduli Python di studio — 2026-11-08
`tools/dinamica/` (7-DoF con Magic Formula combinata, ESP/ABS/TCS/EBD a 200 Hz e blackout; centralina VCU-EBS su modello bicicletta a 60 Hz)
e `tools/companion/` (chat con l'informatore e assalto al rifugio). Autonomi, non collegati al gioco; risultati e limiti nei rispettivi README.
Test: `python3 tools/test_moduli_python.py` (9 superati).

## Versione 31.3 e 31.4 — 2026-11-08 — polizia sulle strade, auto che non affonda, profili e fondamenta
- Polizia (`vita.js`, prova `test/browser_polizia.js`): nascita sistematica sulle strade nell'anello 70–200 m (Andorra: prima pattuglia in
  inseguimento 61,6 → 7,6 s, nate in 90 s 1 → 4); quota presa dalla strada (Monaco: errore 46 → 0 m); senso unico rispettato; inseguimento
  diretto solo se la linea sta sulla strada; senza strada torna alla strada; 210 km/h, 4,5 m/s² e 9 m/s² al massimo.
- Auto che affonda (prova `test/browser_affondamento.js`, via al 49 % di Monaco a 25 m/s): sotto l'asfalto oltre 5 cm per il 44,5 → 4,2 %
  del percorso, al massimo 1,1 → 0,12 m.
- Profilo delle strade lisciato fuori dagli incroci (cambi di pendenza >10 % ai vertici: Monaco 8,7 → 8,2 %, Andorra 6,0 → 4,3 %).
- Fondamenta degli edifici campionate lungo i lati, non solo agli spigoli (facciate sospese 15 cm–1 m a Monaco: 34 → 16 colonne).
- Pareti sotto un'altra carreggiata di nuovo di terra e scarpate che si fermano un pixel prima delle altre strade (correzione della 31.2).

## Versione 31.2 — 2026-11-04 — scarpate al bordo delle strade
Sotto il bordo delle strade (e dei marciapiedi) costruite su un pendio c'era una parete verticale fra l'asfalto e il terreno: fascia
marrone sospesa fino a 1,8 m, muro di pietra oltre (foto di Pont Canavese). Ora dal bordo scende una scarpata 1:1,5 fino al terreno; si
ferma prima di un'altra strada o di un edificio e il dislivello che resta è un muro di sostegno in pietra, mai una fascia di terra.
Pareti verticali in vista lungo le strade: terra −33 % a Monaco e −67 % ad Andorra. Test: 69 superati, 0 falliti.

## Versione 31.1 — 2026-11-03 — difetti delle foto dal telefono (Pont Canavese, Frassinetto, SP460, Genova)
Correzioni del generatore delle celle, valide per tutta l'Italia: sagome di OpenStreetMap che entrano nella carreggiata (vie strette dei
centri storici: l'auto entrava nelle facciate) spostate sul bordo della strada; siepi e muretti solo dove il terreno è alla quota della
strada (prima sospesi sul lato a valle o affondati a monte); righe dipinte tolte dove due strade si sovrappongono (prima si incrociavano a
zig-zag). Punti delle strade dove l'auto resta ferma: Monaco 236 → 69, Andorra 29 → 5. Strumento `tools/collaudo/` per misurare ogni
cella d'Italia (108 943 tile, 435 772 celle): pronto, ma da qui non può scaricare le tile (domini bloccati). Test: 68 superati, 0 falliti.

## Versione 31 — 2026-11-03 — audit e correzione strutturale della mappa
Audit del generatore delle celle e del nucleo del gioco con misure su dati veri (Monaco, Andorra) e celle sintetiche (svincolo,
periferia); rapporto completo in `docs/AUDIT_V31.md`. Corretti: verso dei triangoli di `tri3` (tetti, cime, cupole, balconi: dall'alto
gli edifici erano vuoti), strisce pedonali, linee di arresto e piazzole invisibili, tetti piani e piazze capovolti, verso delle pareti
lungo le strade (gonne e fasce invisibili da fuori: strade «sospese»; pareti delle gallerie aperte da dentro e «blocchi scuri» da fuori),
pieghe dell'asfalto nelle curve strette, guardrail e parapetti dentro altre carreggiate (svincoli, incroci sui viadotti, tornanti),
viadotti senza intradosso, piloni sopra le strade, collisioni solo in pianta (muri invisibili in galleria e sui viadotti; guardrail
attraversabili), fermate, cartelli e semafori in mezzo alla strada, strade che attraversano gli edifici (passaggi con volta, pareti e
soffitto), facciate dei palazzi che attraversavano le gallerie sotto di loro, pareti di galleria in mezzo all'altra carreggiata dove
due rami si uniscono, contatti fra auto a quote diverse e auto invisibile del traffico nel punto di partenza, chiome degli alberi a
strisce. Catena di costruzione portata nel repository (`tools/build/`, pagina identica byte per byte). Test: 66 superati, 0 falliti;
i 10 nuovi falliscono con la versione 30.

## Versione 30 — 2026-11-02 — Vehicle Damage Solver
Risolutore unificato dei danni (`motore/danni_solver.js`) e profili di danno per veicolo (`motore/profili_danno.js`) collegati al gioco (`VDS` in `index.html`) senza riscrivere né duplicare la rete deformabile, `dmgCrash`, `dmgDeform`, `dmgDetach`, `dmgWheel` o `danni_meccanici.js`: energia d'urto da massa effettiva, velocità normale, restituzione dipendente dalla velocità, materiale dell'ostacolo (muro, guardrail, palo, albero distinto dal palo, terreno) e rigidezza relativa delle facce fra due veicoli; la rete riceve la velocità equivalente `u = √(2·E_propria/M)`; registro degli eventi che impedisce di applicare due volte la stessa energia (rimosso il doppio conteggio dello storico); 15 zone strutturali nominate sulle travi esistenti (nessun nodo in più) con resistenza e rottura configurabili per profilo (predefinito, Alfa 159 con massa dal database, esempio Alfa 75 importato dal JSON, tutti dichiarati non certificati); interfaccia S esplicita rete → `danni_meccanici.js`; nuovi componenti frizione, differenziale, centraline con effetti reali in `fisica_veicolo.js` e `ecu.js`; modello delle ruote (braccio, ammortizzatore, molla, mozzo, cerchio, convergenza, campanatura, foratura, battistrada) → aderenza per ruota nel motore fisico, vibrazione, stabilità, tiro, rollio/beccheggio molli; componenti distaccabili configurati (massa, resistenza, soglia, attacco, integrità, stato) con serrature deterministiche; suoni di ferraglia e scarico rotto; salvataggio e riparazioni estesi; 18 nuovi test automatici sulla rete reale estratta da `index.html` (56 in tutto, 0 falliti) e prova in Chromium con urto guidando contro un muro. Dettagli e misure: `docs/DANNI.md`.

## Versione 29.3.1 — 2026-11-02 — ripristino dell'integrazione del motore fisico
La pagina della 29.3 era stata costruita senza il collegamento al motore fisico, alle centraline e ai danni meccanici della versione 29 (il collegamento viveva solo in `index.html`, non nei sorgenti della mappa da cui la pagina viene ricostruita): per circa un'ora il gioco pubblicato usava il vecchio modello di guida di riserva. Il collegamento è ora una patch applicata dalla costruzione della pagina, che si ferma se non si applica; i benzinai/officine nei POI e `surf`/`nearFuel` sono nei sorgenti `cella.js` e `real_main.js`. Verificato: moduli caricati senza errori in Chromium, 38 test del motore superati.

## Versione 29.3 — 2026-11-02 — correzione sistematica della mappa
Generatore delle celle provato su classi di situazioni (Monaco: città densa, gallerie, ponti; Andorra: tornanti, ponti, paesi su rilievo sintetico al massimo 40 %; svincolo autostradale e periferia inventati) con misure automatiche e guida virtuale (tutte le strade metro per metro con la funzione di quota dell'auto, in Node e nel gioco vero). Correzioni in `sorgenti/mappa_reale/`: raccordo degli incroci continuo al bordo del pianerottolo e ripetuto in quattro passate, strada passante dominante, nodi raggruppati senza catene, ponti alzati per il franco che comandano i nodi; lisciatura delle quote con retta dei minimi quadrati; carreggiate gemelle e confluenze solo a quote simili; raster delle quote stradali senza tappi piatti, pixel 1,76 m, due strati a 16 bit (terrazze); impalcati e gallerie interpolati sul segmento più vicino (niente scala sui viadotti), galleria solo sotto terra, passerelle solo a piedi, asfalto che comanda alla comparsa; oggetti OSM mai sulla carreggiata; franco 5,9 m. Pulsante 📦 Dati zona nella mappa e `importa_zona.py` per riprodurre i difetti di una zona vera. Risultati (stessi dati, stesso test): Monaco incroci con gradino 50 → 13 (massimo 0,82 m), bordo dell'asfalto sospeso 80 % → 30 %, salti nella guida virtuale 113 → 27; Andorra salti 83 (massimo 12 m) → 37 (2,4 m); svincolo 12 → 1. Test del motore: 38 superati.

## Versione 29.2 — 2026-11-02 — correzione dei difetti della mappa
Corretti i difetti visti sull'A3 e in tutta la mappa (codice in `sorgenti/mappa_reale/cella.js` e `real_main.js`, dentro `index.html`): alberi, muretti, siepi ed erba fitta mai sulla carreggiata; terreno abbassato sotto l'asfalto; quote delle strade raccordate agli incroci e uguali al bordo fra due celle (niente asfalto sospeso né gradini); guardrail, parapetti, cordoli, pareti e muretti che seguono la pendenza (niente denti di sega); sottopassi in superficie e scatola delle gallerie solo sotto terra (niente blocchi scuri sulla strada); cavalcavia almeno 5,8 m sopra le strade; frecce e denti di squalo sull'asfalto; rotatorie solo su anelli chiusi veri; dati WorldCover usati con prudenza (niente finto lastricato, neve solo in quota); l'auto resta sull'asfalto anche dove la strada è più alta del terreno. Misure prima/dopo, svincolo sintetico di prova e immagini: docs/IMPLEMENTATION_REPORT.md, sezione 0. Le modifiche della versione 29 e 29.1 (motore fisico, centraline, danni) sono rimaste intatte.

(La versione 28 — texture fotografiche, ciclo giorno/notte, chiese, rotatorie, aree di servizio, dati Copernicus — è descritta in docs/IMPLEMENTATION_REPORT.md.)

## Versione 29 — 2026-11-02 — motore fisico reale, centraline virtuali, danni meccanici
Implementato (codice in `motore/`, integrazione in `index.html`, test in `test/`):
- Database veicoli con fonte, unità, attendibilità e stato di verifica (Alfa Romeo 159 1.9 JTDm 150 CV; generici dimostrativi).
- Motore fisico: curva di coppia/potenza, carico parziale, attrito, minimo, limitatore, turbo, cambio 6 marce (automatico con TCU o manuale), frizione, trazione ant./post./integrale, resistenze aerodinamica/rotolamento/pendenza, trasferimento di carico, pneumatici parametrici (pressione, temperatura, usura, superfici, aquaplaning), ASR, freni con EBD e ABS, freno a mano, termica refrigerante/olio, consumo da BSFC, serbatoio e riserva, motore che si spegne senza carburante, hill holder, integrazione stabile a sottopassi.
- Centraline virtuali EMS/TCU/ABS/ESC/BCM/BMS/Gateway con sensori (rumore deterministico), codici di guasto SAE generici con freeze frame, modalità ridotte, spie, bus CAN simulato, diagnosi tipo UDS ridotta, laboratorio guasti solo virtuale, rapporto esportabile; interfaccia hardware dichiarata non disponibile.
- Danni meccanici per componente derivati dalla carrozzeria deformabile; perdita di refrigerante e carburante; danno termico; storico urti con energia stimata; preventivo e officina a pagamento; riparazione d'emergenza (gratuita, meccanica al 70 %); persistenza di danni, carrozzeria deformata, gomme, carburante, codici.
- Gioco: quadro strumenti (marcia, giri, carburante, temperatura, spie), pannello 🚗 a sei schede, benzinai e officine di OpenStreetMap sulla minimappa e per rifornimento/riparazioni, superficie reale sotto l'auto (strada, erba, ghiaia, neve...), pendenza dal rilievo reale.
- Calibrazione riproducibile (`node motore/calibrazione.js`): errore medio 5,5 % rispetto ai dati dichiarati; 38 test automatici (`node test/run.js`); prova in Chromium headless con three.js sostituito da uno stub (nessun errore di pagina; guida, urto, salvataggio/ricarica, riparazione, rifornimento verificati).
Non implementato o semplificato (dichiarato): modello Pacejka, motori ibridi/elettrici, pioggia e acqua sulla strada (il gioco non ha meteo), dinamica laterale completa, temperatura freni, HIL e hardware reale, validazione con misure su veicolo, danni meccanici del traffico e delle pattuglie.
Funzionalità precedenti preservate: se i moduli non si caricano il gioco usa il vecchio modello di guida.
