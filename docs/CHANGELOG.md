# Cronologia delle versioni

## 34 — pannello della polizia chiudibile, bonus 1.000 €
- Pannello 🚔: intestazione fissa con il tasto «✕ Chiudi» (resta visibile anche scorrendo; in verticale l'altezza non copre più i comandi); Esc lo chiude.
- Portafoglio: +1.000 € una sola volta (movimento «Bonus 1.000 € (versione 34)»).
- Motore fisico: `cambiaParametri(v, P)` per cambiare i parametri del veicolo senza ricrearlo.
- `motore/carro_attrezzi.js`: modulo del carro attrezzi a pianale (dinamica a 200 Hz, aggancio, traino, fattura); non ancora collegato al gioco.

## Versione 33.1 — 2026-11-10 — quadro rifatto e comandi che non coprono più il gioco
- Quadro ridisegnato da zero con un aspetto proprio (plancia bassa, strumenti a cannocchiale con cornice cromata, display monocromatico,
  spie in una fila): la 33 riprendeva troppo l'immagine d'esempio ed era troppo grande (1200 × 880 → 1200 × 470; 258 × 101 px su 760 × 296).
- Frecce, pedali e pulsanti più piccoli e spostati fuori dalla colonna di sinistra, dalla minimappa e dal nome della via; «Scendi»,
  «Freno a mano», «Ripara» e cambio manuale riposizionati. Nuovo test: nessuna sovrapposizione fra tutti gli elementi su 5 schermi.

## Versione 33 — 2026-11-10 — quadro strumenti analogico-digitale, frecce e pedali, fari e portiere bloccate
Documentazione: `docs/CRUSCOTTO.md`. Prove: `docs/test/v33_cruscotto_chromium.txt`, immagini `docs/img/v33_*.png`.
- `motore/cruscotto.js` (nuovo): tachimetro 0–280 km/h con consumo istantaneo km/l, contagiri 0–8 con zona rossa dal limitatore, display a
  7 segmenti (totali da 157 256 km salvati, parziali della sessione misurati sulla mappa), temperatura C–H tamponata, carburante E–F
  smorzato; lancette con dinamica del secondo ordine e giro di prova; 21 spie con logica, lampeggi e autotest; disegno vettoriale.
- Spie collegate a centralina a 200 Hz, rete ECU, danni e gioco: ABS ed ESP lampeggiano in regolazione e restano fisse in blackout.
- In auto la levetta è eliminata: frecce con sterzo a rampa e pedali analogici (acceleratore lineare sulla coppia, freno idraulico).
- Fari (auto, spenti, posizione, anabbaglianti, abbaglianti), emergenza automatica dopo l'urto, retronebbia; fascio anche in galleria;
  a fari spenti di notte o in galleria la polizia vede l'auto solo entro 35 m.
- Portiere bloccate dal telaio deformato: 10 calci sul parabrezza (crepa al 4°, sfondato al 10°) per uscire.
- Test: 111 in Node (14 nuovi) + 13 prove in Chromium con controllo dei pixel.

## Versione 32 — 2026-11-10 — Magic Formula combinata, dinamica a 200 Hz, ABS/TCS/ESP con PID, blackout oltre 15 g
Documentazione: `docs/PNEUMATICI_DINAMICA.md`. Misure: `docs/test/pneumatici_dinamica_misure.txt` (`node tools/dinamica/misure_js.js`).
- `motore/pneumatici_mf.js` (nuovo): Magic Formula a scorrimento combinato con la struttura MF 5.2 (Fx, Fy, Mz, sensibilità al carico,
  fattori di scala λ, rilassamento laterale, scorrimento di picco della formula combinata). Coefficienti di un pneumatico generico
  (dichiarati provvisori, non del 215/55 R16).
- `motore/fisica_veicolo.js` 2.0.0: dinamica a 7 gradi di libertà (vx, vy, imbardata, 4 ruote) a passo fisso di 5 ms; integrazione
  implicita di vx e delle ruote con l'inerzia del motore e il differenziale aperto; trasferimento di carico per ruota; bloccaggio
  geometrico (ω = 0, λ = −1); attrito isotropo a pieno strisciamento; temperatura e usura delle gomme dalla potenza di strisciamento.
  Sostituisce il limite d'aderenza per asse e l'ABS/ASR «al 96 %» della versione 29.
- `motore/controllo_dinamica.js` (nuovo): ABS per ruota e TCS (con frenata della ruota che pattina) con PID sullo scorrimento di picco,
  ESP sull'imbardata di riferimento, EBD; blackout oltre 15 g di accelerazione di picco (stimata da impulso e schiacciamento del solver).
- `motore/ecu.js`: sensori ruota con la velocità vera delle ruote; blackout → ABS ed ESC offline, C1100, spie; ESP fisico riportato.
- `motore/veicoli_db.js`: inerzia d'imbardata e delle ruote, carreggiate, Ackermann, ripartizione del rollio, freno a mano (provvisori).
- Pagina (`sorgenti/patch_pneumatici_v32.py`, passo 67 della costruzione): `drive()` riceve vx, vy e imbardata dal motore fisico; urti →
  impulso d'imbardata e accelerazione di picco → centralina; officina che ripara la centralina; righe nuove nel quadro.
- Test: 96 (23 nuovi in `test/pneumatici_dinamica.js`, fra cui il codice vero di `drive()` estratto dalla pagina). Calibrazione invariata
  (errore medio 5,6 %; 100-0 km/h 42,3 m).
Non verificato in questa sessione: la pagina intera in Chromium (three.js non raggiungibile dalla rete del contenitore).

## Versione 31.7b — 2026-11-09 — confini fra celle, sentieri sotto le strade, report calcolato
Report: `docs/test/v31_7_misure_finali.txt`, scritto da `tools/collaudo/report_finale.js` (esegue le prove, ricalcola il «prima» dal commit
dba1fbe con lo stesso codice di misura, confronta con soglie scritte nello script; PASSED solo se tutti i criteri sono rispettati).
- Gradini sui confini fra celle (presenti dalla versione 30): Monaco 2 oltre 30 cm → 0 (massimo 55,6 → 2,4 cm). Causa: i marciapiedi si
  decidono per cella intera («città» o no), quindi la stessa strada aveva fasce diverse nelle due celle (7,2 e 5 m) e i sentieri accanto
  prendevano quote diverse nelle confluenze. Ora per le QUOTE la fascia non dipende dalla cella (`bandH`); il blocco della lisciatura usa la
  sola carreggiata. Pieghe dei profili > 10 %: Monaco 6,77 → 6,13 %, Andorra 3,43 → 3,07 %.
- Sentieri e marciapiedi che passano sotto il bordo di una strada più alta: l'asfalto si ferma prima della carreggiata più alta (le quote
  non cambiano). Muri di pietra dentro l'asfalto disegnato di un'altra via: Monaco 391 → 307, Andorra 362 → 354 (sulla larghezza nominale
  354 e 359). Il resto sta su strade per auto, che non sono state ristrette.
- Confluenze: a parità di peso decide il rango, poi la distanza (prima la prima trovata, che dipende dall'ordine di visita).
- Test: 73 (nuovo: due celle sintetiche vicine, una «città» e una no; con la 31.7 gradino di 43 cm sul confine).
- Esito del report: NOT PASSED, 8 criteri su 10 — restano 1 facciata (parte con min_height nei dati, Monaco) e 1 gradino fra due ponti
  (Andorra, 34 cm).

## Versione 31.7 — 2026-11-09 — protezione del pianale
Misure in `docs/test/v31_7_misure_finali.txt`.
- `groundCar` (sorgenti/patch_mappa_v31.py, passo 8): 4 sonde sotto il fondo (altezza 0,23 m misurata sul modello del gioco, con beccheggio
  e rollio); se il fondo entra nei 5 cm sopra l'asfalto, forza elastica smorzata (K 2500 s⁻², C 70 s⁻¹) integrata a 200 Hz. Monaco, via ripida
  al ritorno: fondo–asfalto minimo −0,008 m senza la forza, +0,010 m con la forza. I 12 cm fra suolo al centro e piano delle ruote sono la
  geometria della gobba (fondo 0,11 m sopra l'asfalto), non una compenetrazione: non modificati.
- `test/browser_affondamento.js`: prima di misurare appoggia l'auto sul pendio (prima restavano beccheggio e rollio del punto precedente).
- `cella.js`: il raccordo delle estremità ignora le estremità create dal ritaglio al margine della cella (nessun effetto misurabile su questi
  dati). Muri di pietra fra strade sovrapposte invariati (391, 362): prova sul pianerottolo dei marciapiedi scartata (gradino nuovo fra celle).
- Test: 72.

## Versione 31.6 — 2026-11-09 — raccordo delle estremità agli incroci
Misure complete in `docs/test/v31_6_misure.txt`.
- Gradini oltre 30 cm fra l'estremità di una via e la strada su cui finisce: Monaco 13 → 0 (massimo 0,82 → 0,20 m), Andorra 6 → 1 (due ponti
  che si toccano, 0,34 m: i ponti restano rigidi). Causa: il nodo raggruppa gli incroci a meno di 9 m con una sola quota, e l'estremità di
  un marciapiede a qualche metro dal centro del gruppo non coincideva con la strada nel punto di contatto. Ora l'estremità prende la quota
  del punto di contatto e lo scarto si richiude lungo la via con la cubica di Bernstein 3t² − 2t³ (tangente nulla ai due capi: profilo C¹).
  Se l'estremità è di un ponte, è la via toccata a raccordarsi da entrambi i lati.
- Invariati: bordi fra celle (Monaco 2 gradini oltre 30 cm, come prima), segnaletica, facciate (1 e 0), pieghe dei profili (6,77 % e 3,43 %).
- Muri di pietra dentro un'altra carreggiata: 393 → 391 a Monaco, 364 → 362 ad Andorra. Non sono siepi né vertici spostati dalla
  lisciatura: sono i muri di sostegno al bordo di una strada che si sovrappone in pianta a un'altra più bassa. Tre correzioni provate e
  scartate perché creavano gradini nuovi (elenco nelle misure).
- Auto sulla via ripida di Monaco: 12 cm sotto il suolo per 6 passi su 900, fuori dall'asse della via (rialzo di 24 cm); non dipende dal
  profilo, non modificato.
- Test: 71 (nuova cella sintetica «incrocio»).

## Versione 31.5 — 2026-11-09 — facciate sul terreno, profili delle strade, dinamica a 200 Hz
Misure complete in `docs/test/v31_5_misure.txt` (strumento `tools/collaudo/facciate_profili.js`).
- Facciate sospese di 15 cm – 1 m: Monaco 15 → 1, Andorra 6 → 0. L'ultima è una parte di edificio con `min_height` = 3 m nei dati.
  Cause e correzioni in `cella.js`:
  - la base degli edifici si calcolava con l'interpolazione bilineare della griglia; ora usa il minimo esatto della mesh disegnata lungo ogni
    lato (estremi e attraversamenti delle linee della griglia e delle diagonali, `minLato`);
  - il campanile delle chiese partiva dalla quota agli spigoli dell'edificio: ora dal terreno sotto i suoi lati;
  - i vani dei passaggi stradali sotto gli edifici si restringono dove sotto il soffitto restano meno di 2,2 m;
  - i vani delle gallerie sotto gli edifici finiscono sul soffitto della galleria (5,2 m, prima 5,5), sono larghi quanto la scatola
    (carreggiata/2 + 1 m, prima + 1,5 m) e divisi in tratti da 0,5 m con la volta locale (prima un'unica quota, la più alta).
- Pieghe dei profili stradali (cambi di pendenza > 10 % ai vertici): Monaco 8,22 → 6,78 %, Andorra 4,34 → 3,42 % (> 20 %: 2,69 → 2,38 %,
  1,64 → 1,42 %). La lisciatura ora blocca solo i vertici dentro un'altra carreggiata e i due vertici del tratto toccato dall'estremità di
  un'altra strada, con 8 passate invece di 4. Gradini agli incroci (13 oltre 30 cm), bordi fra celle (2) e segnaletica staccata (1)
  sono invariati. Due metriche peggiorano di poco: vertici di muretti/siepi dentro un'altra carreggiata 374 → 393 (su ~81 000) e bordi
  coperti fino al terreno 7975 → 8074 su 130 588 campioni. Il resto delle pieghe sta nei nodi degli incroci, dove la quota della strada
  che incrocia impone lo spigolo; non è stato eliminato.
- Test: 70 (`test/run.js`, nuova cella sintetica «pendio» con terreno irregolare e galleria in salita sotto due palazzi; il test delle
  facciate fallisce col generatore della 31.4: 6 colonne sospese). Chromium: galleria di 72 m percorsa per tutti i 56 m senza urti; auto
  sulla via più ripida (39 %) sotto l'asfalto oltre 5 cm per lo 0–0,7 % del percorso, al massimo 12 cm.
- Dinamica 7-DoF (`tools/dinamica/`): configurazione predefinita a passo fisso 200 Hz (`DT`), 1610 kg, Iz 2450 kg·m² (prima 2700),
  partenza a 50 m/s (`V0`); telemetria completa per campione nei risultati. Test Python: 13.

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
