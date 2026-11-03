# ITALIA OPEN WORLD — Audit tecnico e correzioni della versione 31 (3 novembre 2026)

Questo documento risponde al prompt «Audit e correzione strutturale della mappa e della simulazione automobilistica». Prima l'audit
(come sono fatte le cose e dove nascono i difetti, con file e funzioni), poi le correzioni con le misure prima/dopo, i test, i limiti.

**Dati usati per le prove.** Le zone delle foto (A3 fra Nocera e Cava de' Tirreni, A10 a Diano Gorleri) non sono scaricabili da questo
ambiente: il proxy blocca `tiles.openfreemap.org` e `tiles.mapterhorn.com` (risposta 403, verificata anche oggi). Le prove usano quindi
dati OpenStreetMap veri già salvati (Monaco con rilievo vero, 24 celle; Andorra con rilievo sintetico, 72 celle) e due celle sintetiche
(svincolo autostradale in collina, periferia). Le foto delle zone vere vanno rifatte da te sul telefono; il pulsante 📦 «Dati zona»
della mappa salva i dati del posto, che qui si importano con `sorgenti/mappa_reale/importa_zona.py`.

---

## 1. Audit: come vengono generati e caricati gli elementi della mappa

Tutto il mondo è generato nel browser, cella per cella (quarti di tile z14 di OpenStreetMap, circa 900 × 900 m in Italia).

| Elemento | Dove nasce | Come viene caricato e disegnato |
|---|---|---|
| **Terreno** | `cella.js` → `buildCell`: griglia di quote dal rilievo (`dem.js`, tile Mapterhorn z12 in formato terrarium), classi del suolo da OpenStreetMap e WorldCover, movimento terra lungo le strade (riporti 1:2, trincee 1:1,2), mesh `TG` con colori e pesi di quattro texture | `worker_main.js` → `cell()` scarica le tile (3×3 vettoriali z14 unite per avere il contesto oltre il bordo), costruisce la cella nel Web Worker; `real_main.js` → `mkCell` crea le mesh (`MTR.ter`). Dettaglio A sotto 520 m, B oltre, blocchi lontani `buildFar` (griglia 17×17, abbassata di 2,5–11,5 m per non sovrapporsi alle celle vicine) |
| **Strade** | `buildCell`: profili `PR` (campionamento, lisciatura, scavalcamenti, raccordo agli incroci, confluenze), tratti `RD` dentro la cella, nastri per stile (`RG`, `RSg`, `RDg`, `RBg`, `RWg`), bordi verticali («gonne»), segnaletica (`mark`, `paint`), raster delle quote a due strati (`RH`, `RH2`) | `mkCell` (materiali `MTR.road` e `PBR.RMAT`); quota dell'auto da `terrainH` → `rhCell`, `bridgeH`, `ground` |
| **Edifici** | `buildCell`, sezione edifici: facciate a piani `wallB` sull'atlante (`GW`), tetti a falde `tri3` (`GR`), tetti piani triangolati con `earcut` (`MG`), balconi `balc`, chiese, muri di collisione `walls` | `mkCell` (`MTR.fac`, `MTR.roof`, `MTR.misc`); nel dettaglio B muri semplici senza tetti a falde |
| **Marciapiedi** | ciclo delle strade: nastro `RWg`, cordolo (`MC`), bordo esterno fino al terreno (`MG`/`MS`) | come le strade |
| **Ponti e viadotti** | `r.bridge`: impalcato (nastro), parapetti, fascia (gonna di cemento), piloni; franco minimo 5,8 m sopra le strade | `bridges` → `brAdd` → `bridgeH` per la quota dell'auto |
| **Gallerie** | `r.tun`: pareti e soffitto solo dove il tetto sta sotto il terreno, portali; gallerie poco profonde diventano strade in superficie | `bridges` con `tun:1` → `bridgeH` |
| **Vegetazione** | alberi (`trees`, 7 tipi), siepi (`HG`), muretti; erba fitta `ERBA` in `pbr_in.js` | istanze `InstancedMesh` con `TREEG` e `MTR.tree` |
| **Veicoli** | Alfa 159 (modello GLB nella pagina base), rete deformabile 88 nodi / 467 travi (`sbTemplate`), pelle `sbSkin`/`sbBind`, risolutore `motore/danni_solver.js` | `index.html` (base + patch della build) |
| **Collisioni** | `mkCell` → `csoAdd`: muri, oggetti, lampioni, auto in sosta, alberi (secchi da 32 m `CSO2`); impalcati `brAdd` (`BRG`) | `pushS`/`push` (auto, pattuglie, pedoni), `clipDist` (telecamera, traffico), `armRay` (colpi), `pdLosDist` (vista della polizia) |

Conversione delle coordinate: Web Mercator (`ll2m`, `m2g`) con scala `K = cos(lat)`; le celle vicine condividono i vertici del bordo
(prova: scarto 0,0000 m fra celle lontane vicine, `prova_cella.js` «TUTTO OK»). Nessun valore non valido nelle mesh. Texture: le 27
texture fotografiche si caricano tutte (stato «27/27» nelle prove in Chromium).

**Difetto di architettura:** la pagina pubblicata si costruisce da `base.html` (versione 10) più 66 passi di modifica, ma gli script di
costruzione esistevano solo nella cartella di lavoro dell'assistente, fuori dal repository. Se quella cartella spariva, il gioco non si
poteva più ricostruire. Corretto: ora sta tutto in `tools/build/` (vedi § 6).

## 2. Audit: le cause concrete dei difetti delle foto

Ogni causa è stata trovata leggendo il codice e confermata con una misura o con un'immagine prima/dopo nel gioco vero.

| # | Difetto visto | Causa (file, funzione) |
|---|---|---|
| 1 | **Barriere in mezzo alle corsie** agli svincoli (Cava de' Tirreni, Nocera) | `cella.js`, guardrail: disegnato su entrambi i lati di ogni autostrada e superstrada senza controllare se la sua linea entra nella carreggiata di un'altra strada. Le rampe sono vie separate e sovrapposte: la barriera le attraversava. Lo stesso per i **parapetti** dei ponti negli incroci sui viadotti e per il guardrail interno dei tornanti (stessa via) |
| 2 | **Guardrail «sospesi» nel cielo** (Diano Gorleri) | `cella.js`, ramo `r.bridge`: l'impalcato è un nastro con la sola faccia superiore, **senza intradosso**; e la fascia laterale guardava verso l'interno (causa 5). Visto da sotto o di lato restavano due linee di parapetto sospese |
| 3 | **Edifici vuoti dall'alto, comignoli sospesi, falde «galleggianti»** | `cella.js` → `tri3`: l'ordine dei vertici era il contrario della normale dichiarata (la trasformazione u,v → x,z è una rotazione, non una riflessione). Tetti a falde, cime delle scatole, cupole, campanili e lastre dei balconi guardavano verso il basso: il **99,5 %** delle facce dei tetti a Monaco. I tetti piani (`earcut`) erano capovolti a seconda del verso dell'anello |
| 4 | **Strisce pedonali, linee di arresto e piazzole di sosta invisibili** | `cella.js` → `mark()` e piazzole: triangoli con la faccia verso il basso (il **100 %** di strisce e arresti) |
| 5 | **Strade che sembrano sospese, blocchi scuri, gallerie trasparenti** | `cella.js`: il vettore `n = (−tz, tx)` usato per i lati della strada è la normale **destra** nel sistema (u est, v sud), ma il codice lo trattava come sinistra. Gonne sotto il bordo dell'asfalto, fasce dei viadotti, bordi dei marciapiedi e delle piazzole guardavano **dentro** (invisibili da fuori); cordoli e **pareti delle gallerie** guardavano **fuori** (le gallerie da dentro erano aperte sul cielo, da fuori le pareti erano i «blocchi scuri») |
| 6 | Soffitti delle gallerie, fondo dei balconi e delle scatole | `cella.js`: sei chiamate passavano la direzione `[0,-1,0]` a `tri3` al posto delle coordinate di texture |
| 7 | **Buchi nell'asfalto nelle curve strette** | nastro della strada: il bordo interno tornava indietro nelle curve strette e il nastro si ripiegava (triangoli capovolti) |
| 8 | **Muri invisibili**: auto ferma in galleria, auto che passa attraverso un guardrail | `index.html` → `pushS`, `clipDist`: collisioni solo in pianta. I muri degli edifici sopra una galleria, le auto in sosta e gli alberi della via sopra fermavano l'auto in galleria; le pareti di una galleria fermavano chi passava sopra. Per lo stesso motivo guardrail e parapetti non potevano essere ostacoli e si attraversavano |
| 9 | **Piloni in mezzo alla strada** sotto i cavalcavia | `cella.js`, piloni: scatole allineate agli assi cartesiani ogni sei campioni, senza controllare le strade sotto |
| 10 | **Pali e cartelli in mezzo alla strada** | `cella.js`: la fermata dell'autobus prende la posizione OpenStreetMap, spesso un nodo della carreggiata; cartelli e semafori messi accanto a una strada cadevano dentro quella che incrocia |
| 11 | **Edifici attraversati da una strada** (gallerie dentro un edificio a Monaco, sottopassi) | facciata intera e muro di collisione attraverso la strada |
| 12 | **Chiome a strisce, alberi «a gemma»** | `pbr_in.js`, shader di `MTR.tree`: proiezione `x+z` costante sulle facce diagonali; `real_main.js` → `TREEG`: normali delle facce |
| 13 | **Facciata di un palazzo dentro la galleria** (Monaco: auto ferma dopo 2 m in una galleria larga 14 m) | `cella.js`, edifici: la base della facciata è la quota più bassa del terreno sotto la sagoma. Vicino all'imbocco di una galleria che passa sotto il palazzo scende fino a 1,8 m sopra la strada della galleria: la facciata attraversava la canna (muro visibile da dentro e ostacolo alla quota dell'auto). I passaggi sotto gli edifici escludevano le gallerie |
| 14 | **Parete di galleria in mezzo alla carreggiata** dove due rami di galleria si uniscono o si separano | `cella.js`, gallerie: le pareti si disegnavano su entrambi i lati di ogni ramo senza controllare l'altro ramo (stesso difetto dei guardrail, causa 1) |
| 15 | **Urti con auto che stanno a un'altra quota** e un'auto invisibile nel punto di partenza | `index.html` → `pdCollide` e speronamento: contatti fra auto solo in pianta; sagome del traffico e delle pattuglie senza quota. `vita.js` → `spawnCar`: l'ostacolo di un'auto del traffico appena nata si accendeva prima di avere la posizione, cioè nell'origine del mondo (0, 0), che è il punto di partenza del giocatore |

Cause escluse dopo verifica: coordinate e conversioni (bordo comune esatto), terreno capovolto (0 triangoli su 1,9 milioni), valori non
validi, texture mancanti, errori di caricamento (0 errori nella console oltre alle risorse esterne bloccate da questo ambiente).

## 3. Correzioni e misure prima/dopo

Stesso misuratore (`sorgenti/mappa_reale/difetti.js`) e stessi dati, generatore della versione 30 contro quello della 31.

| Misura | Monaco | Andorra | Svincolo | Periferia |
|---|---|---|---|---|
| Guardrail dentro un'altra carreggiata alla stessa quota | 19,1 % → **0 %** | 10,2 % → **0,02 %** | 6,0 % → **0,04 %** | — |
| Punti dell'asse delle strade dove un'auto resta ferma (ogni 2 m, regola del gioco) | 763 → **69** (31.1; 236 nella 31) | 129 → **5** (31.1; 29 nella 31) | 0 → 0 | 0 → 0 |
| … di cui dentro le gallerie, fermati da un muro | 319 → **22** | 2 → **0** | 0 → 0 | — |
| Triangoli d'asfalto con la faccia verso il basso | 4,83 % → **0,07 %** | 2,02 % → **0,05 %** | 3,02 % → **0 %** | 5,13 % → **0 %** |
| Facce dei tetti verso il basso | 99,5 % → **0,5 %** ¹ | 99,1 % → **0,95 %** ¹ | — | 100 % → **0 %** |
| Viadotti con intradosso | 0 → **1753 m su 1753** | 0 → **4179 su 4179** | 0 → **406 su 406** | — |
| Pareti sotto il bordo dell'asfalto rivolte verso l'esterno ² | 63 → **3910** su ~3970 | — | 12 → **4534** su 4546 | 19 → **6927** su 6946 |
| Pareti delle gallerie rivolte verso l'interno ² | 1 → **946** su 947 | — | — | — |
| Cordoli rivolti verso la strada | — | — | — | 0 → **4711** su 4711 |

¹ Le facce rimaste sono i sottotetti delle chiese, che devono guardare verso il basso.
² Per Monaco su una sola cella (17058/11948, quella con la galleria lunga), misura fatta con lo stesso programma.

**Versione 31.1** (difetti delle foto dal telefono a Pont Canavese, Frassinetto, sulla SP460 e a Genova; correzioni in `cella.js`):
sagome degli edifici che entrano nella carreggiata spostate sul bordo della strada (607 vertici su 24 celle a Monaco, 78 su 72 ad Andorra;
passaggi sotto gli edifici conservati: 1,79 → 1,88 km); siepi e muretti solo dove il terreno è alla quota della strada (tolti 1,1 km a
Monaco e 40,6 km sul rilievo ripido di Andorra, dove restavano sospesi o affondati); righe dipinte tolte dove una strada sta dentro la
carreggiata di un'altra di pari o maggiore importanza (3,7 km a Monaco, 4,3 km ad Andorra). Tre test nuovi, falliscono col generatore
precedente. Immagine: [`img/v31_1_sagome.jpg`](img/v31_1_sagome.jpg) (Monaco dall'alto e di lato: nessuna sagoma rotta).
Resta aperta la **fascia marrone** sotto il bordo delle strade costruite a sbalzo su un pendio ripido (foto di Pont Canavese delle 14:18 e
ultima riga dell'immagine): è la parete verticale di terra che chiude il vuoto fra il bordo della strada e il terreno più in basso.
Serve una scarpata inclinata al posto della parete, non ancora fatta.

I «punti dove un'auto resta ferma» contano anche gli ostacoli nuovi (guardrail, parapetti, piloni, pareti dei passaggi). Dei 236 rimasti
a Monaco, 199 sono edifici di OpenStreetMap che coprono la carreggiata **per il lungo** (portici, sagome sovrapposte alla strada: vedi
§ 7), 22 sono muri nelle gallerie (vedi § 7), gli altri lampioni, alberi e oggetti vicino agli imbocchi e sui ponti.

**Correzioni, file per file:**
- `sorgenti/mappa_reale/cella.js`:
  1. `tri3`: ordine dei vertici concorde con la normale. Sei chiamate con la direzione al posto giusto.
  2. Strisce, linee di arresto, piazzole, piazze e tetti piani: faccia verso l'alto, controllata triangolo per triangolo.
  3. Pareti dei lati della strada (gonne, fasce, bordi di marciapiedi e piazzole verso l'esterno; cordoli e gallerie verso l'interno).
  4. Nastri senza pieghe nelle curve strette, anche per il bordo esterno dei marciapiedi.
  5. Guardrail e parapetti si interrompono dove entrerebbero in un'altra carreggiata alla stessa quota, anche lo stesso tratto di strada
     nei tornanti (distanza misurata lungo la strada); niente tratti sotto i 4 m; i paletti entrano nel terreno.
  6. Viadotti: intradosso su tutta la lunghezza, piloni orientati secondo la strada e mai sopra un'altra strada.
  7. Collisioni: ogni muro ha la quota della base e della cima (`wallsY`); guardrail e parapetti sono ostacoli bassi con la loro quota
     (`rails`); piloni e pareti dei passaggi sono ostacoli. Le pareti delle gallerie registrano la cima 1,5 m sotto il soffitto e i
     piloni 1 m sotto l'intradosso: chi passa sopra non li tocca, nemmeno su un impalcato in pendenza.
  8. Fermate dell'autobus spostate sul bordo della strada; cartelli e semafori scartati se cadono in un'altra carreggiata.
  9. Passaggi sotto gli edifici: dove una strada taglia un lato di un edificio a una quota compresa nella sua altezza, la facciata resta
     solo sopra la volta (4,6 m sopra la strada), il muro di collisione si toglie nel vano e dentro la sagoma ci sono pareti e soffitto del
     passaggio, che sono anche ostacoli. 1,9 km di passaggi su 10 celle di Monaco.
  10. Gallerie sotto gli edifici: dove un lato della sagoma sta dentro la larghezza della canna (anche vicino a uno spigolo, dove l'asse
      della galleria non taglia il lato) e la volta della galleria supera la base della facciata, la facciata parte sopra la volta
      (5,5 m sopra la strada) e lì non c'è muro di collisione. Pareti e soffitto li ha già la galleria.
  11. Gallerie che si uniscono o si separano: la parete di un ramo si toglie (disegno e collisione) dove starebbe dentro la carreggiata
      dell'altro ramo alla stessa quota, con lo stesso controllo dei guardrail.
- `sorgenti/mappa_reale/real_main.js`: muri, alberi, lampioni, auto in sosta e oggetti con quota (`yb`, `yt`); guardrail e parapetti
  come ostacoli bassi (`lo`); chiome a icosaedro con normali morbide.
- `sorgenti/mappa_reale/pbr_in.js`: alberi con proiezione triplanare (niente strisce).
- `sorgenti/mappa_reale/vita.js`: traffico e pattuglie passano la propria quota alle collisioni; le sagome delle auto del traffico e delle
  pattuglie portano la quota dell'auto disegnata; l'ostacolo di un'auto del traffico appena nata prende posizione e quota prima di
  accendersi (prima, per un passo, c'era un'auto invisibile nel punto di partenza); speronamento solo alla stessa quota.
- `sorgenti/mappa_reale/worker_main.js`: trasferimento dei nuovi dati dal Web Worker.
- `sorgenti/patch_mappa_v31.py` (nuovo, passo 66 della build): nel nucleo del gioco `pushS`, `push`, `clipDist` e `armRay` usano la
  quota quando l'ostacolo la porta: non ferma chi sta più di 35 cm sopra la cima o più di 2,2 m sotto la base (1,6 m per le barriere
  basse). Auto, pattuglie, traffico, ribaltamenti, pedoni e telecamera passano la propria quota. Chi non la passa si comporta come prima.
  I contatti fra auto (`pdCollide`) avvengono solo fra auto a meno di 2,5 m di quota; le sagome del traffico di contorno portano la quota.

**Guida nel gioco vero** (Chromium, passi di gioco sincroni, pagina definitiva; registro completo in `docs/test/v31_chromium.txt`):

| Prova | v30 | v31 |
|---|---|---|
| Svincolo: auto a 60 km/h verso il guardrail dell'autostrada (angolo 20°) | attraversa il guardrail, finisce a 18,9 m dall'asse e si ferma contro un albero (urto 166 kJ) | urta il guardrail (evento «guardrail» nel risolutore, 14 km/h di componente normale, 5,9 kJ), resta in carreggiata e prosegue a 44 km/h; 0 attraversamenti delle barriere |
| Svincolo: auto a 50 km/h sul cavalcavia sopra i guardrail dell'autostrada | 25,6 m, nessun urto | 25,9 m, nessun urto (nessun muro invisibile) |
| Monaco, galleria di 72 m (larga 14 m, sotto un palazzo), 40 km/h lungo la linea media | ferma dopo 2,3 m: urto «muro» a 35 km/h contro la facciata del palazzo che attraversa la canna | percorre tutti i 56 m previsti, nessun urto (velocità minima 32 km/h) |
| Monaco, galleria di 36 m, 40 km/h | ferma dopo 3,2 m: urto «albero» a 28 km/h (un albero della via sopra) | 20,1 m su 20, nessun urto |
| Monaco, galleria di 44 m in salita (28 %), 40 km/h senza acceleratore | 23,4 m, poi l'auto si ferma per la pendenza; nessun urto | uguale: 23,4 m, nessun urto |
| Monaco, partenza nel punto di origine (galleria sotto il punto di partenza) | urto «muro» a 39 km/h (palazzo della via sopra) | prima delle ultime correzioni: urto «auto» a 32 km/h contro l'auto invisibile del traffico nell'origine (causa 15); pagina definitiva: nessun urto in due prove |

Le gallerie sono trovate dal gioco stesso (impalcati sotto il terreno, `bridgeH`); la direzione dell'auto è tenuta sulla linea media
della galleria: è una prova delle collisioni, non della guida.

## 4. Fase 3 — danni: confronto tecnico con BeamNG.drive

**Non è la stessa qualità di BeamNG.drive, e non lo dichiaro.** Differenze reali:

| | BeamNG.drive | Italia Open World (v31) |
|---|---|---|
| Struttura | rete di nodi e travi per ogni veicolo, centinaia o migliaia di nodi, costruita per quel modello | un'unica rete di 88 nodi e 467 travi per tutte le auto (una sola geometria 3D), 15 zone nominate |
| Simulazione | continua, a circa 2000 passi al secondo per tutto il veicolo (telaio, sospensioni, trasmissione, gomme) | a eventi: la rete si simula per qualche centinaio di passi quando c'è un urto (`sbCrash`), la guida usa un modello separato (`fisica_veicolo.js`) |
| Deformazione visiva | la mesh segue i nodi a ogni fotogramma | la mesh si aggiorna dopo l'urto, a code con un budget di 60 000 vertici per fotogramma (`sbSkinStep`), legata a 33 gruppi |
| Contatti | ogni nodo contro i triangoli dell'ambiente e degli altri veicoli | sagome in pianta (cerchi e scatole) con quota, impronta dell'ostacolo sulla rete |
| Danni meccanici | emergono dalla simulazione | componente per componente (`danni_meccanici.js`): motore, radiatore, cambio, frizione, differenziale, sterzo, sospensioni, freni, centraline… |

Che cosa c'è già e funziona (verificato oggi in Chromium con le prove della versione 30: stessi numeri, 0 errori): deformazione
progressiva della rete con plasticità e rotture; energia dell'urto da massa effettiva, velocità normale e restituzione del materiale;
zone differenziate (paraurti, muso, cofano, porte, tetto, bagagliaio); sospensioni, mozzi, bracci, cerchi e pneumatici per ruota, con
campanatura e convergenza che fanno tirare l'auto; sterzo (corsa ridotta e tiraggio, usati davvero in `drive()`); pezzi che si staccano
alla soglia della cerniera; meccanica distinta dall'estetica; riparazione d'emergenza a bordo strada (meccanica al 70 %) e riparazione
completa in officina.

Cosa cambia per i danni nella v31:
- i guardrail e i parapetti della mappa vera sono ostacoli: un urto contro di loro arriva al risolutore come materiale «guardrail»
  (prima della v31 non poteva avvenire);
- niente più danni falsi da ostacoli che stanno a un'altra quota. Nelle gallerie di Monaco la v30 registrava urti «muro» a 35 e 39 km/h
  (palazzi della via sopra o la loro facciata dentro la canna) e un urto «albero» a 28 km/h (albero della via sopra); la v31 nessuno
  (§ 3, guida nel gioco vero). Anche i contatti fra auto avvengono solo alla stessa quota.

Non fatto, e perché: simulazione continua della rete e reti diverse per veicolo. Servirebbero un modello 3D con nodi per ogni auto e
un budget di calcolo che sul telefono non c'è (misurare prima su un telefono vero).

## 5. Fase 4 — prestazioni

- Celle (Node, stessi dati, seconda costruzione, generatore definitivo): Monaco 154 → 161 ms in media (massimo 696 → 742 ms), Andorra
  62 → 60 ms (massimo 138 → 129 ms). Le misure ripetute oscillano di circa il 10 % (una misura precedente dava 164 → 169 e 65 → 76 ms).
  Triangoli per cella −0,06 % a Monaco (pareti di galleria tolte dove i rami si uniscono) e +0,1 % ad Andorra. Ostacoli per cella
  711 → 817 e 395 → 427. Nessun materiale nuovo, quindi le chiamate di disegno restano quelle di prima.
- Già presenti e verificati nel codice: dettaglio A/B delle celle per distanza, blocchi lontani, scaricamento delle celle oltre 5 di
  distanza (`dropCell` libera geometrie e ostacoli), aggiornamento dei vertici delle auto solo dopo un urto e con un budget per
  fotogramma, pattuglie lontane con fisica ridotta (`u.lod`).
- **Non verificato:** il telefono vero (Samsung Galaxy S24). Le prove sono in Chromium senza GPU; nessuna misura su Android, PC o console.

## 6. Fase 5 — verifica

- `node test/run.js`: **66 test superati, 0 falliti** con la pagina e il generatore definitivi. I 10 test nuovi (sezione «mappa»,
  «collisioni con la quota», «auto contro auto con la quota») **falliscono tutti** con il generatore e la pagina della versione 30. Il
  test delle gallerie (cella sintetica con palazzo sopra l'imbocco e due canne che si separano) fallisce anche col generatore v31 senza
  le due correzioni delle gallerie (62 punti dell'asse fermati da un muro): protegge davvero dal ritorno dei difetti.
- Misure della 29.3 (`metriche.js`) uguali a quelle del generatore v30 (incroci, bordi fra celle, alberi ed erba sulla strada,
  segnaletica, gallerie), tranne i vertici di muretti e siepi dentro un'altra carreggiata: 111 → 110. `prova_cella.js` «TUTTO OK».
- Prove in Chromium sulla pagina definitiva (identica a `index.html`), registro completo in `docs/test/v31_chromium.txt`: guida contro
  il guardrail e sul cavalcavia, guida nelle tre gallerie di Monaco, partenza nella galleria sotto il punto di partenza, scene dei danni
  della versione 30. Danni: frontale a 50 km/h, meccanica, urto duplicato, albero e auto, passo del risolutore e salvataggio con gli
  stessi numeri della prova precedente; riparazione e urto guidando contro il muro variano un poco da una prova all'altra (stessa
  pagina: integrità del paraurti dopo la riparazione 0,7 o 1; energia dell'urto contro il muro 154,4–154,9 kJ).
- Console: 0 errori della pagina; le uniche righe d'errore sono 4 risorse esterne rifiutate da questo ambiente
  (`ERR_TUNNEL_CONNECTION_FAILED`).
- Moduli collegati alla pagina pubblicata: `index.html` contiene gli script `motore/*.js` (fisica, centraline, danni meccanici, profili,
  solver) e le patch V29, V30 e V31 (controllato dai test).
- Costruzione riproducibile: `python3 tools/build/build.py` dal repository produce una pagina **identica byte per byte** a quella
  della cartella di lavoro.
- Immagini prima/dopo: `docs/img/v31_*.jpg` (§ 8).

## 7. Problemi ancora presenti (onestamente)

- **Zone delle foto non provate**: A3 e A10 non sono scaricabili da qui. Le correzioni sono generali (ogni svincolo, ponte, galleria,
  tetto), ma vanno guardate da te sul telefono. Se qualcosa resta, il file del pulsante 📦 «Dati zona» permette di riprodurlo qui.
- **Edifici sovrapposti alla strada per il lungo** (portici, sagome OpenStreetMap che coprono la carreggiata): circa 400 m di asse
  stradale su 24 celle a Monaco e 50 m su 72 celle ad Andorra restano bloccati da una facciata. Aprire il piano terra senza costruire
  l'interno lascerebbe vedere l'edificio vuoto: serve un modello di portico.
- **Gallerie**: a Monaco restano 22 punti dell'asse (44 m su 24 celle) fermati da un muro dentro una galleria. Quasi tutti sono palazzi
  che partono più in basso della galleria (in riva al mare) e la cui altezza, stimata perché OpenStreetMap non la dà, finisce appena
  1–3 m sopra la strada della galleria: la canna uscirebbe dal tetto. Il vano non si apre (resterebbe una striscia di facciata
  sospesa); serve un'altezza vera dell'edificio o un modello della galleria dentro l'edificio. Un nodo d'incrocio fra gallerie **dentro** la montagna prende
  la quota della superficie, quindi la galleria sale fino in cima (visto con una cella sintetica; nei dati di Monaco gli incroci delle
  gallerie stanno agli imbocchi). Da correggere nel calcolo delle quote dei nodi, non fatto in questa versione.
- Due impalcati che OpenStreetMap mette a meno di 2 m uno sopra l'altro (3 punti ad Andorra): dati incoerenti.
- Cavalcavia molto ripidi sullo svincolo sintetico (7 m in 25 m), già segnalati nella 29.3: il raccordo dei ponti alza l'impalcato in
  poco spazio.
- Uscita da una galleria a Monaco: la quota scelta per l'auto torna alla superficie appena l'asse si allontana di qualche metro dal
  tracciato della galleria. Comportamento uguale nella v30, non legato a queste correzioni.
- Sulla A3 e A10 alcuni bordi molto alti (pareti di 6–12 m sotto la strada: 0,7 % del bordo a Monaco) restano muri di pietra: sono
  viadotti non segnati come ponti o differenze del rilievo.
- Telefono, PC e console: nessuna verifica eseguita su quelle piattaforme.

## 8. Immagini (stesse inquadrature, pagina v30 a sinistra e v31 a destra)

- [`img/v31_svincolo.jpg`](img/v31_svincolo.jpg): cavalcavia di lato e da sotto, rampa che si stacca, svincolo dall'alto.
- [`img/v31_rilevati_viadotti.jpg`](img/v31_rilevati_viadotti.jpg): strade in rilevato, rampe e viadotti visti da fuori.
- [`img/v31_edifici.jpg`](img/v31_edifici.jpg): case dall'alto e dalla strada.
- [`img/v31_alberi_strisce.jpg`](img/v31_alberi_strisce.jpg): alberi, strisce pedonali, tetti della periferia.
- [`img/v31_gallerie.jpg`](img/v31_gallerie.jpg): dentro le gallerie di Monaco (dati veri). Nella v30 la facciata del palazzo sopra
  l'imbocco attraversa la canna (è il muro che fermava l'auto) e le pareti, girate al contrario, lasciano vedere il cielo.
- [`img/v31_monaco.jpg`](img/v31_monaco.jpg): gallerie da dentro, quartiere dall'alto, palazzo dalla strada (dati veri).
- [`img/v31_andorra.jpg`](img/v31_andorra.jpg): guardrail all'incrocio, strada in salita, edifici (dati veri).

I quattro fogli delle celle sintetiche e quello delle gallerie hanno a destra la pagina definitiva. I fogli di Monaco e Andorra sono
stati fatti con la pagina v31 di prima delle due ultime correzioni delle gallerie (facciate sopra le gallerie e pareti dove due rami si
uniscono): le stesse inquadrature non si possono rifare uguali (le posizioni delle telecamere non sono state salvate), e per le gallerie
vale il foglio `v31_gallerie.jpg`.

## 9. Come ripetere le prove

```
node test/run.js                                                    # test automatici (66)
DATI=<cartella con next/real_test…> node sorgenti/mappa_reale/difetti.js tutti     # misure dei difetti
DATI=<…> node sorgenti/mappa_reale/metriche.js                      # misure della 29.3
python3 tools/build/build.py                                        # ricostruisce index.html dal repository
```
Le scene di Chromium sono in `test/browser_mappa_v31*.js`.
