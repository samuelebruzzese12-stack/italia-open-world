# ITALIA OPEN WORLD — Rapporto di implementazione (mappa reale, Versione 29.3)

## 0. Versione 29.3 — correzione sistematica di tutta la mappa (2 novembre 2026)

Dopo la 29.2 le foto (Diano Gorleri sull'A10, A3, e una strada degli Stati Uniti) mostravano ancora fasce di muro marrone, guardrail sospesi, strade su un argine di pietra, alberi dappertutto. Non si può controllare la mappa un angolo alla volta: in questa versione il generatore delle celle è stato messo alla prova su **classi di situazioni** con controlli automatici, e corretto finché i controlli non sono passati. Le classi: città densa con strade sovrapposte, gallerie e ponti (Monaco, dati OpenStreetMap veri e rilievo vero); strade di montagna vere con tornanti, ponti, gallerie e paesi (Andorra, dati OpenStreetMap veri; il rilievo non è scaricabile da qui ed è sintetico, con pendenze al massimo del 40 %); uno svincolo autostradale in collina inventato (sottopasso, cavalcavia con rampe e anello, viadotto, superstrada con tornante a due carreggiate, rotatoria, strade di campagna); una periferia residenziale su terreno "rumoroso". I controlli: misure numeriche su ogni cella (`metriche.js`), una **guida virtuale** che percorre tutte le strade metro per metro con la stessa funzione di quota dell'auto, sia in Node (`prova_guida.js`) sia nel gioco vero in Chromium, e fogli di immagini.

**Limite importante (invariato):** le tile dell'A3, dell'A10 e di qualsiasi zona italiana non sono scaricabili dall'ambiente di sviluppo (`tiles.openfreemap.org` e il rilievo rispondono 403). Le zone delle foto non sono quindi state provate direttamente. Per questo nella mappa del gioco c'è ora il pulsante **📦 Dati zona**: salva in un file le tile vere del posto in cui ti trovi (3×3 tile vettoriali z14, rilievo z12, copertura del suolo se accesa); mandandolo in chat il difetto si può riprodurre e correggere con gli stessi strumenti (`importa_zona.py` lo trasforma nella cartella di prova che i test leggono).

### Misure prima e dopo

| Misura (stessi dati, stesso programma di misura) | Monaco 29.2 | Monaco 29.3 | Andorra 29.2 | Andorra 29.3 |
|---|---|---|---|---|
| Incroci con gradino oltre 30 cm (oltre 1 m) — massimo | 50 (15) — 4,13 m | **13 (0) — 0,82 m** | 45 (16) — 3,66 m | **5 (0) — 0,42 m** |
| Gradini fra celle vicine oltre 30 cm (oltre 1 m) — massimo | 2 (2) — 1,38 m | **2 (0) — 0,56 m** | 7 (6) — 17,3 m | **1 (0) — 0,99 m** |
| Bordo dell'asfalto sospeso sopra il terreno oltre 60 cm | 79,9 % (scarto medio 1,56 m) | **29,8 % (0,74 m)** | 90,5 % (2,09 m) | **20,8 % (0,54 m)** |
| Bordo sospeso oltre 1,8 m (muro di pietra) | 29,4 % | **9,9 %** | 53,6 % | **4,8 %** |
| Alberi, ciuffi d'erba sulla carreggiata | 0 | 0 | 0 | 0 |
| Guida virtuale nel gioco vero (Chromium, pagina 29.2 e 29.3 sugli stessi dati): salti di quota oltre 0,45 m + 25 %/m (massimo) | 113 (3,2 m) su 31 km | **27 (2,6 m)** | 83 (12,2 m) su 27 km | **37 (2,4 m)** |
| Svincolo sintetico, salti nel gioco | 12 (2,2 m) | **1 (0,8 m)** | | |
| Guida virtuale in Node sulle celle (salti non spiegati dalla pendenza della strada) | — | 26 su 51 km (massimo 4,1 m, una rampa a spirale) | — | 7 su 36 km (massimo 0,9 m) |

(I 27 salti di Monaco sono quasi tutti fra 0,8 e 1,3 m dove due vie corrono una sopra l'altra a quote diverse, più una rampa a spirale che OpenStreetMap disegna come anello piatto; i 37 di Andorra stanno su pendenze sintetiche del 40 %. All'inizio del lavoro, col rilievo sintetico senza limite di pendenza, Andorra dava 2389 salti con un massimo di 17,7 m: la maggior parte era colpa del rilievo di prova, rifatto con pendenze al massimo del 40 %; il confronto in tabella è sul rilievo nuovo per entrambe le versioni.)

### Cause trovate e corrette (`sorgenti/mappa_reale/cella.js`, `real_main.js`, `worker_main.js`, `mvt.js`, dentro `index.html`)

1. **Raccordo agli incroci.** Le correzioni dei nodi vicini si sommavano: al bordo del pianerottolo di un incrocio la quota saltava (ad Andorra 8 m in 5 m). Ora la correzione è una media continua che al bordo del pianerottolo vale esattamente quella del nodo. Il raccordo si ripete in quattro passate: una via breve fra due strade alte non trascina più l'incrocio in mezzo nel suo avvallamento (ci arriva già sollevata dalle estremità). La strada passante pesa otto volte quella che finisce sull'incrocio. Una sola voce per strada e per nodo (prima tre segmenti vicini davano tre pianerottoli consecutivi). Il pianerottolo piatto resta solo per la larghezza delle strade che attraversano il nodo (almeno 1,5 m). I nodi si raggruppano senza catene: nel centro di Monaco, fra scale e vicoli, si formava un gruppo di 22 rami largo 50 m con una sola quota (412 gradini). I ponti alzati per il franco comandano i loro nodi anche fra incroci fitti: prima il franco veniva annullato e il cavalcavia tornava sulla strada che scavalca.
2. **Lisciatura delle quote.** Alle estremità la media vedeva un solo lato: in salita la strada arrivava all'incrocio più bassa di pendenza × mezza finestra (metri interi, e strade diverse arrivavano a quote diverse). Ora è una retta dei minimi quadrati pesati.
3. **Carreggiate gemelle e confluenze.** Niente media fra carreggiate a senso unico quando il dislivello supera 2–4 m (a Monaco l'altra carreggiata passa 15 m più in basso, all'imbocco di una galleria: la strada si abbassava di 10 m per un campione). Una via che corre dentro la fascia di una strada più grande ma 1,5–3 m più in basso è una terrazza, non una confluenza: tiene la sua quota. Le confluenze non toccano i 6 m finali delle strade (lì comanda il nodo).
4. **Raster delle quote stradali (ciò su cui poggia l'auto).** I segmenti avevano "tappi" piatti alle giunzioni e vinceva la quota più alta: su ogni discesa la strada diventava una scala con gradini di 2 m ogni 6 m. Ora la quota segue la pendenza del segmento, fra segmenti della stessa strada vince il più vicino, fra strade diverse vince il rango e poi la vicinanza (le superfici si incontrano a metà fra gli assi). Pixel da 3,5 m portati a 1,76 m. Il raster ha **due strati** a 16 bit (4 cm): dove due vie si sovrappongono a quote diverse l'auto sceglie lo strato più vicino alla sua quota e resta sulla sua carreggiata. Niente tappi oltre le estremità (finivano sopra l'impalcato o la galleria che seguono); i pezzi tagliati sul bordo della cella conservano il tappo (la strada continua di là).
5. **Impalcati e gallerie nel gioco (`bridgeH`).** Stesso difetto dei tappi: su ogni ponte e galleria in pendenza l'auto saliva a gradini (quasi certamente l'"asfalto che vola" sui viadotti). Ora vince il segmento più vicino. Il piano di una galleria vale solo dove il suolo sta più di 2,5 m sopra (all'imbocco comanda il suolo: una via che passa sopra l'imbocco non "cade" nella galleria). Un impalcato a meno di 2 m dal suolo (dati incoerenti) non cattura chi passa sotto. Le passerelle pedonali valgono solo a piedi. Senza quota di riferimento (comparsa, pedoni) comanda sempre l'asfalto: prima si poteva comparire sul terreno sotto una strada sopraelevata e guidare "sotto" la strada.
6. **Bordi di pietra.** La ricerca di strade vicine per i bordi scendeva con il pixel del raster: adeguata al nuovo passo (i bordi non invadono più le vie accanto).
7. **Oggetti di OpenStreetMap** (cestini, cassette postali, telefoni) mai dentro una carreggiata; i dissuasori restano, sono barriere vere.
8. Franco sotto i cavalcavia portato a 5,9 m (un decimetro di margine sulle 5,8 m dopo il raccordo).

### Banco di prova (cartella `sorgenti/mappa_reale/`)

- `prova_guida.js svincolo | periferia`, oppure `DATI=<cartella> SET=<set> node prova_guida.js x15 y15 …`: guida virtuale in Node su una cella; con `TRACE=u,v,metri` stampa metro per metro terreno, raster, quota propria e quota scelta; con `PROBE=u,v` i due strati del raster e i pezzi di strada attorno; con `PONTE=u,v` l'impalcato interpolato come nel gioco.
- `metriche.js` (con `SET`, `NT`, `ESEMPI`): le misure della tabella; `prova_bordi.js`, `prova_svincolo.js`, `prova_cella.js`, `prova_sintetica.js` come prima.
- `dbg17.js` (raster e nodi attorno a un punto), `dbg18.js` (profilo di una strada in ogni fase: rilievo, lisciato, scavalchi, raccordo, confluenze), `dbg19.js` (limiti del movimento terra su un vertice), `mkdbg.py` (prepara `cella_dbg.js` con le sonde).
- `importa_zona.py file.json cartella`: trasforma un file «Dati zona» nella cartella `next/<set>` letta dai test. `andorra/dem_sintetico.py`: il rilievo sintetico di Andorra (paesi, corsi d'acqua e cime di OpenStreetMap, lisciato, pendenza massima 40 %, calcolato su un'unica griglia così le tile coincidono ai bordi).
- Le tile di prova (Monaco, Andorra) non sono nella repository: pesano centinaia di MB. Si ottengono dal gioco col pulsante 📦.

**Immagini:** [`img/v293_svincolo_periferia.jpg`](img/v293_svincolo_periferia.jpg), [`img/v293_monaco.jpg`](img/v293_monaco.jpg), [`img/v293_andorra.jpg`](img/v293_andorra.jpg).

**Costo:** costruzione di una cella nel Web Worker di Chromium: media 188 ms, massimo 1,7 s (29.2: 369 / 2,8 s; 28: 93 / 0,7 s). Memoria in più per cella vicina: circa 1 MB per il raster a due strati (prima 0,25 MB). Il telefono vero non è stato misurato.

**Che cosa resta (onestamente):**
- Fra due vie sovrapposte a quote diverse (terrazze di Monaco, lungomare e strada alta) il terreno a maglia di 9,4 m non può seguire entrambe: la via alta mostra un muro di pietra fino a quella bassa. È una scelta: l'alternativa (terreno che buca l'asfalto della via bassa) è peggiore.
- Strade che OpenStreetMap disegna sovrapposte a sé stesse (rampe a spirale) o incoerenti col rilievo (cavalcavia con 7 m di dislivello in 25 m, strade al 78 % su una scogliera a 30 m di risoluzione) restano con qualche salto.
- Le zone delle tue foto (A10 Diano Gorleri, A3, Stati Uniti) vanno provate da te: col pulsante 📦 Dati zona i loro dati arrivano qui e si correggono con questo banco.

---

## 0.1 Versione 29.2 — correzione dei difetti della mappa visti sul telefono (2 novembre 2026)

(Il motore fisico, le centraline virtuali e i danni meccanici della versione 29 sono descritti in `docs/CHANGELOG.md`, `docs/MOTORE_FISICO.md`, `docs/ECU.md` e `docs/DANNI.md`; queste correzioni non li toccano.)

Le foto dall'A3 (Nocera Superiore, Cava de' Tirreni) mostravano alberi e muri in mezzo alla strada, erba sull'asfalto, pezzi di asfalto sospesi, barriere a dente di sega e blocchi scuri sulla carreggiata, in tutta la mappa. Le cause erano nel codice che costruisce le celle (alcune vecchie, alcune introdotte dalla versione 28). Tutte le misure qui sotto sono fatte sulle **tile vere di Monaco** (24 celle) con lo script `sorgenti/mappa_reale/metriche.js`, prima e dopo.

**Limite importante:** le tile dell'A3 non sono scaricabili dall'ambiente di sviluppo (il proxy blocca `tiles.openfreemap.org`, verificato oggi), quindi l'A3 vera non è stata provata. Al suo posto c'è uno **svincolo sintetico in collina** costruito apposta come quello delle foto (`sorgenti/mappa_reale/svincolo.js`): autostrada a due carreggiate in salita, sottopasso, cavalcavia con rampe anche ad anello, viadotto, strada di servizio, tornante di superstrada, rotatoria, strade di campagna, copertura WorldCover finta.

| Difetto | Causa trovata | Prima (v28) | Dopo |
|---|---|---|---|
| Alberi sulla strada | gli alberi non controllavano le strade; con WorldCover i "boschi" a 10 m coprivano anche le carreggiate | 8,9 % degli alberi sulla carreggiata (7,7 % con WorldCover) | 0 su 2091 (0 su 9146 con WorldCover) |
| Erba sull'asfalto | il terreno (griglia di 9,4 m) sporgeva sopra l'asfalto ai bordi; i ciuffi usavano una maschera di 3,6 m con buchi | terreno sopra l'asfalto nel 15,3 % dei punti; 1857 ciuffi sulla carreggiata | 0 % e 0 ciuffi |
| Gradini agli incroci | ogni strada aveva quote lisciate per conto suo | 1420 incroci su 2617 oltre 30 cm, massimo 5,8 m | 51 su 2691 (oltre 1 m: 15, tutti sentieri pedonali) |
| Gradini fra due pezzi di mappa | ogni cella calcolava le quote solo con il proprio tratto di strada | 95 bordi su 189 oltre 30 cm, massimo 3,5 m | 3 su 181 (massimo 1,4 m, un sentiero) |
| Barriere a dente di sega | guardrail, parapetti, bordi, cordoli, muretti e siepi erano rettangoli orizzontali ogni 6 m: su ogni pendenza diventavano scalini | su tutte le strade in pendenza | seguono la pendenza |
| Blocchi scuri e "portoni" in mezzo alla strada | sottopassi e gallerie artificiali avevano la scatola della galleria (5,2 m) fuori dal terreno | tetto fuori terra nel 72 % dei tratti di galleria | 0 su 434 tratti disegnati |
| Frecce staccate dall'asfalto | frecce e denti di squalo alla quota dell'incrocio anche 30 m prima | 84 % staccate | 1 su 3757 |
| Muretti e siepi dentro altre strade | controllo su un raster di 3,6 m | 1049 vertici | 0 (misura fatta prima di aggiungere i bordi in pietra, vedi sotto) |
| Colline bianche e chiazze grigie | WorldCover "edificato" diventava lastricato dappertutto; "neve" e "suolo nudo" diventavano neve e roccia anche a 100 m di quota | — | "edificato" non si usa più; neve solo sopra 2200 m, roccia sopra 1300 m |
| Ponti a terra | il cavalcavia stava a 1 m dal suolo e la strada sotto lo attraversava (l'auto poteva anche "saltarci sopra") | franco di circa 1 m | almeno 5,8 m (6,6 sui binari), con rampe |
| Rotatorie finte | riconosciute da qualsiasi curva a senso unico, anche i tornanti a due carreggiate | 6 a Monaco | solo anelli chiusi percorsi in senso antiorario e senza strade dentro l'aiuola: 2 a Monaco |

**Correzioni (file `sorgenti/mappa_reale/cella.js`, stesse parti dentro `index.html`):**
1. Le strade si calcolano anche per 160 m oltre il bordo della cella, poi si ritaglia il tratto interno: le due celle vicine trovano la stessa quota al bordo.
2. Raccordo agli incroci: le estremità che toccano un'altra strada allo stesso livello, e gli incroci a raso, hanno una sola quota. La strada principale comanda, la correzione si spegne entro 130 m.
3. Gallerie poco profonde (il tetto supera il terreno quasi ovunque e non passano sotto gli edifici) diventano strade in superficie. Le altre gallerie hanno pareti e volta solo dove stanno sotto terra e i portali dove la scatola comincia.
4. Ponti sopra strade e binari: impalcato almeno 5,8 m sopra (6,6 sui binari). Una strada piccola sotto un ponte più importante scende un po', come nei sottopassi veri.
5. Il terreno si abbassa sotto tutta la carreggiata, la banchina dell'autostrada e i marciapiedi. I bordi della strada scendono fino al terreno: muro in pietra se il dislivello supera 1,8 m, mai dentro un'altra strada.
6. Guardrail (che girano anche intorno alle piazzole SOS), parapetti, cordoli, pareti di galleria, muretti, muri di sostegno e siepi sono quadrilateri inclinati che seguono la pendenza.
7. Alberi, viali alberati, muretti, siepi ed erba fitta controllano la distanza vera da ogni strada, binario e ponte: la chioma resta fuori dalla carreggiata. L'erba usa una maschera nuova di 1,8 m che esclude anche marciapiedi, piazze, edifici e piazzali. Le chiome giganti sono ridotte (pini fino a 1,55, latifoglie fino a 1,9 volte).
8. Muretti e siepi solo lungo strade di campagna vere (non lungo le strade di servizio, gli anelli o i tratti sotto i 40 m), mai a meno di 3,5 m da un'altra strada. Muri di sostegno al massimo di 2,6 m.
9. Frecce, linee e denti di squalo prendono la quota dell'asfalto vertice per vertice. Le frecce seguono la curva della strada.
10. Nel gioco (`real_main.js`) la quota del suolo è calcolata sugli stessi triangoli disegnati. L'auto resta sull'asfalto anche dove la strada è più alta del terreno. Sulle strade strette e ripide niente gradini, perché la quota dell'asfalto è una media dei soli pixel di strada.

**Prove visive:** [`img/v29_confronto_svincolo_1.jpg`](img/v29_confronto_svincolo_1.jpg), [`img/v29_confronto_svincolo_2.jpg`](img/v29_confronto_svincolo_2.jpg) (svincolo sintetico, stessa inquadratura prima e dopo), [`img/v29_confronto_monaco.jpg`](img/v29_confronto_monaco.jpg) (Monaco vero).

**Guida virtuale** (si percorrono tutte le strade a passi di 1 m con la stessa funzione di quota dell'auto):
- **Monaco:** ostacoli con collisione sulla carreggiata: 1, contro 1 della versione 28. È la parete lunga di un edificio di OpenStreetMap che tocca la strada, non un albero né un muretto, ed era già così. Alberi sulla strada: 0. Salti di quota oltre 0,7 m al metro: 194 su 32 500 m, contro 198, sulle vie più ripide.
- **Svincolo sintetico:** salti di quota 15 contro 72; nessun ostacolo.

**Costo:** la costruzione di una cella nel Web Worker richiede circa il 45 % di tempo in più (Monaco: 917 → circa 1300 ms per 24 celle in Node). I triangoli disegnati sono gli stessi (circa 950 000 nella vista di partenza) e le chiamate di disegno passano da 176 a 187. La maschera dell'erba occupa 256 KB per cella vicina.

**Che cosa resta:**
- A Monaco, in alcuni incroci ripidissimi, il bordo della strada più alta sporge di più di 25 cm sopra la strada più bassa che si sovrappone. Sono 441 vertici su 76 000, quasi tutti da 2 a 4 m di altezza, cioè sopra le auto.
- I viadotti che attraversano il confine fra due tile z14 possono avere ancora un piccolo scalino: la tile vicina non è disponibile.
- Telefono vero e A3 vera non provati: vanno verificati da te.

---

## Versione 28

Questo documento dice che cosa è stato fatto davvero nella seconda fase di sviluppo, con quali risorse e strumenti, che cosa è stato verificato e che cosa no. Dove qualcosa non è stato possibile, è scritto il motivo.

Immagini delle prove: cartella [`docs/img/`](img/) (fotografie dal gioco vero, eseguito in Chromium senza schermo con i dati reali di OpenStreetMap del Principato di Monaco, più una cella sintetica per le cose che a Monaco non ci sono: autostrada, casello, area di servizio, strada di campagna).

---

## 1. Risorse realmente scaricate e integrate

### 1.1 Texture PBR fotografiche (Poly Haven e ambientCG, licenza CC0)

**Come sono state ottenute.** L'ambiente di sviluppo di Claude passa da un proxy che consente solo alcuni domini: `polyhaven.com`, `api.polyhaven.com`, `dl.polyhaven.org` e `ambientcg.com` rispondono «403 / connessione rifiutata» (verificato). La licenza CC0 permette a chiunque di ridistribuire i file, e molti progetti open source su GitHub contengono le texture originali: le copie sono state prese da lì (GitHub è raggiungibile), con `git clone --filter=blob:none` + `sparse-checkout` (si scaricano solo i file necessari). Non è stato usato nessun trucco per raggiungere i domini bloccati.

**Verifica dell'autenticità.**
- Il repository `sayantanmandal1/AsterCoast` (licenza MIT) ha un file `tools/asset-lock.json` che registra per ogni file l'indirizzo originale su `dl.polyhaven.org` e l'impronta SHA-256: **18 file su 18 coincidono** (asphalt_02, aerial_grass_rock, coast_sand_01, forest_floor, rock_boulder_dry, grass_medium_01).
- `asphalt_02_diff_1k.jpg` di AsterCoast è **identico byte per byte** a `asphalt_02_diffuse_1k.jpg` del repository indipendente `stepupgaming/infinite-backlot`.
- La licenza CC0 di Poly Haven è stata letta sulla pagina ufficiale (https://polyhaven.com/a/asphalt_02: CC0, autore Rob Tuytel) e quella di ambientCG su https://docs.ambientcg.com/license («All ambientCG assets are provided under the Creative Commons CC0 1.0 Universal License»). I termini dell'API di Poly Haven (repository GitHub `Poly-Haven/Public-API`, file `ToS.md`) confermano che i file scaricati restano CC0 senza obbligo di attribuzione.
- Un repository con licenza «tutti i diritti riservati» (`kkellerman/bastion-front`) conteneva anch'esso texture Poly Haven: è stato **scartato** per prudenza, anche se i file in sé sono CC0.
- Un repository con le immagini in Git LFS su un server esterno (`kennyhassmusic/sky-city`) è stato scartato (i file non sono scaricabili da qui).

**Elenco completo** (sorgente, percorso, impronta SHA-256): [`tools/texture/sorgenti.json`](../tools/texture/sorgenti.json) e, dopo la lavorazione, [`tex/manifest.json`](../tex/manifest.json).

| Asset | Sito | Usato per | Mappe usate |
|---|---|---|---|
| Asphalt 02 (Rob Tuytel) | Poly Haven | carreggiate in asfalto | colore, normale, rugosità, AO |
| Concrete Pavement | Poly Haven | marciapiedi in lastre, piazze, terreno urbano | colore, normale, rugosità |
| PavingStones050 | ambientCG | centri storici e zone pedonali (porfido a coda di pavone) | colore (normale e rugosità ricavate dalla luminosità) |
| Coast Sand 01 | Poly Haven | strade sterrate e strade bianche | colore, normale, AO/rugosità |
| Gravel Concrete 03 | Poly Haven | massicciata dei binari, calcestruzzo di ponti e gallerie, riquadro «calcestruzzo» delle facciate | colore, spostamento → normale, rugosità |
| Aerial Grass Rock | Poly Haven | prati e incolti | colore, normale, AO/rugosità |
| Rock Boulder Dry | Poly Haven | roccia, pendii ripidi, montagne; conci di pietra delle facciate; muretti a secco | colore, normale, AO/rugosità |
| Forest Floor | Poly Haven | sottobosco, campi, terra | colore, normale, AO/rugosità |
| Roof 09 | Poly Haven | tetti a falde in tegole | colore, normale, rugosità |
| Plaster001 | ambientCG | intonaco delle facciate (preso il colore di ogni palazzo) | colore, normale, rugosità |
| Red Brick | Poly Haven | facciate in mattoni, campanili | colore, AO, normale, rugosità |
| Grass Medium 01 (modello 3D) | Poly Haven | ciuffi d'erba fitta vicino al giocatore | atlante del colore (trasparenza ricavata dallo sfondo) |
| Wide Street 01 (HDRI) | Poly Haven | riflessi in città (carrozzerie, vetri, acqua) | panorama |
| Citrus Orchard Road Pure Sky (HDRI) | Poly Haven | riflessi fuori città | panorama |

Peso totale delle texture del gioco dopo la lavorazione: **circa 2,3 MB** (28 file in `tex/`).

### 1.2 Dati Copernicus (ESA WorldCover 2021 e il suo mosaico Sentinel-2)

- **ESA WorldCover 2021** (copertura del suolo a 10 m, prodotta dall'ESA con dati Copernicus Sentinel-1 e Sentinel-2; licenza CC BY 4.0, verificata sul repository ufficiale `ESA-WorldCover/esa-worldcover-datasets`): integrata **a runtime** attraverso le tile pubbliche di Terrascope (VITO, `mapproxy.terrascope.be`, strato `esa-worldcover-map-10m-2021-v2_map`, nessuna autenticazione per gli strati pubblici). Il caricatore legge i colori della legenda e li trasforma in classi del suolo (bosco, arbusti, prato, campi, edificato, roccia nuda, neve, zone umide) **dove OpenStreetMap non ha dati**: così boschi, campi e roccia stanno dove stanno davvero, e gli alberi nascono nei boschi veri.
- **Mosaico Sentinel-2 a colori veri 2021** dello stesso prodotto WorldCover (`esa-worldcover-s2rgbnir-10m-2021-v2_tcc`): usato come immagine del **terreno lontano** (blocchi oltre ~1,5 km), con tile z13 condivise da 4 blocchi.
- Attribuzione mostrata nel gioco: «© ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium».
- Pulsante **«🛰 Copernicus»** nella mappa grande per spegnerli; con 4 errori di fila il gioco smette di chiederli e resta su OpenStreetMap.
- **Cosa NON è verificato:** il dominio `mapproxy.terrascope.be` non è raggiungibile dall'ambiente di sviluppo, quindi il servizio vero non è stato provato da qui. È stato provato tutto il resto della catena (scaricamento, decodifica dei colori, classi del suolo, immagine sul terreno lontano) con **tile finte servite in locale**: 25 tile satellitari applicate su 81 blocchi lontani, classi del suolo cambiate nelle celle, nessun errore. Se il server non consente l'uso da un'altra pagina (CORS) o è lento, il gioco ricade da solo su OpenStreetMap. Va verificato sul telefono.
- Il DEM **Copernicus GLO-30** era già usato (dentro Mapterhorn) dove manca un modello regionale.

### 1.3 Che cosa non è stato scaricato
- Nessun modello 3D di edificio: gli edifici restano ricostruiti dalle sagome vere di OpenStreetMap (un modello generico non coincide con la pianta del palazzo vero).
- Nessun dato Google (né Maps, né Earth, né Street View, né 3D Tiles).

---

## 2. Strumenti realmente usati

| Strumento | Per che cosa |
|---|---|
| **git** (clone parziale e sparse-checkout da GitHub) | scaricare solo le texture CC0 necessarie dai repository che le ridistribuiscono |
| **API di ricerca del codice di GitHub** | trovare dove sono ridistribuiti i file originali (per nome esatto, es. `asphalt_02_diff_1k.jpg`) |
| **Python 3 + Pillow + NumPy + OpenCV** | lavorare le texture: riduzione ripetibile, AO nel colore, normali + rugosità impacchettate, normali da altezza, atlante delle facciate 2×2, conci di pietra e muretti a secco composti dalla roccia vera, ritaglio dei ciuffi d'erba, conversione degli HDR in panorami per i riflessi, controllo delle impronte SHA-256. Script: [`tools/texture/prepara_texture.py`](../tools/texture/prepara_texture.py) |
| **Node.js** | provare il costruttore delle celle con le tile vere di Monaco (`prova_cella.js`) e con una cella sintetica (`prova_sintetica.js`) |
| **Playwright + Chromium (WebGL software SwiftShader)** | eseguire il gioco vero senza schermo e fotografarlo (giorno, tramonto, notte, chiese, rotatorie, casello, area di servizio, campagna, prova senza texture) |

**Strumenti NON usati (e perché):**
- **QGIS**: non installabile nell'ambiente (niente accesso ai pacchetti). Il lavoro GIS necessario è fatto dal codice del gioco e dagli script: conversione di coordinate Web Mercator ↔ metri, ritaglio e rasterizzazione dei poligoni, campionamento del DEM, classificazione del suolo, verifica della distribuzione di strade ed edifici (statistiche per cella nei test). Non è stato usato QGIS e non viene dichiarato.
- **Blender / BlenderGIS**: non installabili qui (download.blender.org non raggiungibile, nessun gestore di pacchetti). Le geometrie nuove (campanili, cupole, timpani, rotatorie, pensiline) sono generate dal codice a partire dai dati veri; le texture composte (conci, muretti) sono fatte con Python. Non è stato usato Blender e non viene dichiarato.
- **Cesium / CesiumJS / 3D Tiles**: valutato e **non integrato**. CesiumJS è un motore a sé (globo, telecamera, scena propri) e sostituirebbe il motore del gioco con guida, collisioni e polizia; le 3D Tiles in three.js richiedono una versione di three.js molto più recente della r128 usata dal gioco (aggiornarlo vorrebbe dire riscrivere armi, auto e shader). I dati 3D pronti (Cesium ion, Google Photorealistic 3D Tiles) richiedono account, chiave e — per uso commerciale o volumi alti — pagamento. Alternativa adottata: lo streaming a celle del gioco (OpenStreetMap + rilievo + Copernicus), che già gestisce l'Italia intera.
- **Strumenti AI** (Meshy, Tripo, RunPod, modelli su Hugging Face): non usati. Vedi sezione 7.

---

## 3. File modificati o aggiunti nella repository

| File | Che cosa |
|---|---|
| `index.html` | il gioco (Versione 29.2) |
| `tex/*.jpg`, `tex/ciuffi.png`, `tex/manifest.json` | texture del gioco e manifesto con fonti, licenze, lavorazione |
| `tools/texture/prepara_texture.py`, `tools/texture/sorgenti.json` | script di preparazione e elenco delle sorgenti con impronte |
| `sorgenti/mappa_reale/*.js` | codice della mappa reale (costruttore delle celle, caricatore, materiali, cielo, traffico) e i due script di prova |
| `docs/IMPLEMENTATION_REPORT.md` | questo documento |
| `docs/RESOURCE_CATALOG.md`, `docs/RESOURCE_LICENSES.md`, `README.md` | aggiornati con le risorse nuove |
| `docs/img/v28_*.jpg` | fotografie delle prove |

Nel codice (dentro `index.html`; le stesse parti sono in `sorgenti/mappa_reale/`):
- `cella.js` (costruttore delle celle): superfici stradali separate per materiale (asfalto, porfido, sterrato, massicciata, marciapiedi), calcestruzzo separato, classi del suolo da WorldCover, rotatorie, frecce di direzione, piazzole di sosta, distributori e aree di servizio, caselli, chiese con campanile/cupola/rosone/portale, stile di stazioni/ospedali/scuole/municipi, bandiere, croce rossa, orologio, muretti a secco, muri di sostegno, siepi, coordinate per l'immagine satellitare del terreno lontano.
- `worker_main.js` (caricatore in sottofondo): tile WorldCover, coordinate dei blocchi lontani.
- `pbr_in.js` (nuovo): caricamento delle texture vere e shader PBR di terreno, strade, facciate, tetti, calcestruzzo, muretti, acqua; lampioni, fari e fanali accesi di notte; siepi e chiome con fogliame; erba fitta.
- `cielo_in.js` (nuovo): posizione astronomica del Sole, cielo con nuvole, stelle e luna, nebbia e luci per l'ora, riflessi dai panorami veri, pozze di luce dei lampioni, fasci dei fari.
- `real_main.js`: atlante delle facciate a 18 bande con canale «muro vero / rugosità», nuove insegne (rosone, portale, croce, orologio), terreno lontano dal satellite, pulsante Copernicus, caricamento che aspetta le texture (massimo 15 s).

---

## 4. Materiali integrati (dove si vedono)

- **Strade**: asfalto vero (crepe, rattoppi) in coordinate del mondo, due campionature ruotate e mescolate per non far vedere la ripetizione, segnaletica sopra come strato trasparente (linee, zebre, tram, solchi delle ruote, usura ai bordi). Asfalto chiaro dei parcheggi più luminoso.
- **Marciapiedi**: lastre vere allineate alla strada. **Centri storici e zone pedonali**: porfido a coda di pavone. **Sterrati**: strada bianca. **Ferrovie**: massicciata con traversine e rotaie.
- **Facciate**: le finestre, le persiane, i portoni, le cornici e le vetrine restano disegnati (atlante), ma il **muro** è la texture vera: intonaco tinto con il colore del palazzo, mattoni, conci di pietra o calcestruzzo secondo lo stile. Vetri lisci e riflettenti (rugosità bassa), muri ruvidi; normali combinate (rilievo dell'atlante + rilievo del muro vero).
- **Tetti**: tegole vere. **Terreno**: erba, roccia, terra e lastricato veri mescolati per vertice, con normali, variazione a grande scala e neve in quota. **Ponti, gallerie, cordoli, rotatorie**: calcestruzzo vero. **Muretti**: pietre vere. **Siepi e chiome degli alberi**: fogliame (disegnato nel codice). **Acqua**: onde animate e riflessi del cielo.
- **Riflessi**: panorama HDR vero di una strada (in città) o di un cielo sereno (fuori città), rischiarato secondo la luce del giorno; li usano carrozzerie, vetri delle finestre, acqua e asfalto.

## 5. Sistemi migliorati

1. **Ciclo giorno/notte**: il Sole è dove sta davvero (data, ora e luogo del giocatore); modalità nel pulsante 🌓: ora reale, sempre giorno, tramonto, notte, giorno e notte veloci (24 minuti). Cielo con gradiente, disco solare, nuvole che scorrono, stelle e luna; nebbia e luce ambiente che cambiano colore; di notte: lampioni accesi con la pozza di luce sulla strada, finestre accese a caso (calde e fredde), vetrine illuminate, fari e fanali delle auto, fasci dei fari dell'auto del giocatore, luce lunare.
2. **Rotatorie disegnate come tali**: riconosciute dalla forma (archi di strade a senso unico su uno stesso cerchio, almeno ~190° di anello) perché OpenMapTiles non esporta `junction=roundabout`; aiuola con cordolo, prato, alberi, linea di margine e «denti di squalo» di dare precedenza dove entrano le strade.
3. **Frecce di direzione** prima degli incroci: le direzioni possibili (sinistra, dritto, destra) sono calcolate dalla geometria vera dell'incrocio e dai sensi unici.
4. **Piazzole di sosta** su autostrade e superstrade (ogni ~500 m, con cartello SOS e guardrail che gira intorno). *Le posizioni sono stimate*: le tile non contengono le piazzole vere.
5. **Distributori** dove OpenStreetMap ha un distributore: pensilina con i colori del marchio (solo colori, nessun logo), isole con le colonnine, totem con il nome. **Aree di servizio** dove il distributore è vicino a un'autostrada o superstrada: pensilina grande, edificio del ristoro, insegna.
6. **Caselli** dove OpenStreetMap ha `barrier=toll_booth` (le tile OpenMapTiles lo esportano come punto d'interesse): pensilina sopra la carreggiata con il nome della stazione, cabine ai bordi (le corsie restano percorribili).
7. **Edifici speciali** riconosciuti dal punto d'interesse dentro la pianta: **chiese** con tetto a capanna, timpani, rosone, portale, pareti con monofore, **campanile** con cella campanaria e cuspide, **cupola** su tamburo per le chiese grandi; stazioni (stile storico + orologio), ospedali (bianchi + croce rossa), scuole e municipi (colori e bandiera italiana; il municipio anche quella europea).
8. **Campagna**: muretti a secco e siepi lungo le strade fuori città (più muretti in Liguria, Toscana e al Sud, più siepi in Pianura Padana), muri di sostegno in pietra dal lato a monte; **erba fitta** a ciuffi vicino al giocatore, mossa dal vento.
9. **Occlusione ambientale**: le mappe AO delle texture vere sono moltiplicate nel colore; vicino al giocatore ci sono le ombre in tempo reale del sole (già presenti, ora con il sole nella posizione vera). L'SSAO (occlusione calcolata sullo schermo) **non è attivata**: su un telefono costerebbe troppo.

## 6. Verifiche fatte

- Costruttore delle celle con le tile vere di Monaco e dintorni (6 tile z14, 24 celle): tutte valide, nessun valore non valido (`prova_cella.js`: «TUTTO OK»). Trovati: 13 chiese (3 con cupola), 6 rotatorie, circa 140 frecce di direzione, 1 distributore; nelle celle fuori città circa 2,1 km di muretti e 0,85 km di siepi.
- Cella sintetica (`prova_sintetica.js`): casello, area di servizio, 3 piazzole SOS, rotatoria, frecce, pieve con campanile, scuola con bandiera, ~1 km di muretti, ~650 m di siepi, nessun valore non valido.
- Gioco vero in Chromium: nessun errore nella pagina, 27/27 texture caricate (circa 2 s in locale), fotografie di giorno, al tramonto e di notte; prova **senza texture** (ricade sulle texture disegnate dal codice, nessun errore); prova Copernicus con tile finte (vedi 1.2).
- Prestazioni misurate nella stessa inquadratura di Monaco: Versione 27 = 184 chiamate di disegno, ~966 000 triangoli; Versione 28 = 195 chiamate, ~966 000 triangoli (più 3 000 ciuffi d'erba fuori città). La memoria grafica delle texture nuove (con le mipmap e i riflessi) è di circa 55–60 MB.

## 7. Problemi che restano (onestamente)

- **Telefono vero non provato**: le prove sono in un Chromium senza schermo con WebGL software. Le prestazioni su Android vanno verificate da te. Gli shader nuovi usano più letture di texture (terreno: 8, facciate: 5); se il telefono soffre, si possono ridurre.
- **Copernicus a runtime non provato sul server vero** (vedi 1.2).
- La ripetizione delle texture si vede ancora un po' su grandi superfici d'erba e di asfalto viste dall'alto.
- Rotatorie: riconosciute dalla forma (dalla versione 29 solo anelli chiusi in senso antiorario), quindi può sfuggirne qualcuna con l'anello disegnato in modo irregolare.
- Chiese: servono il punto d'interesse dentro la pianta e una pianta abbastanza rettangolare; le chiese a croce complessa usano il rettangolo che le contiene. Campanile e cupola sono in posizioni plausibili, non misurate.
- Piazzole SOS stimate; frecce e corsie calcolate dalla geometria (le tile non hanno `turn:lanes`); le corsie di svolta vere (allargamenti) non sono disegnate.
- Gli alberi sono ancora geometrie semplici (con fogliame in texture): i modelli 3D veri di alberi sono troppo pesanti per migliaia di istanze su telefono.
- WebGL 1 (telefoni molto vecchi): l'atlante dei muri usa una lettura semplificata con piccole giunte visibili.

## 8. Risorse che richiedono account, chiavi o pagamenti (non usate)

| Risorsa | Che cosa serve |
|---|---|
| Download diretto da polyhaven.com / ambientcg.com dall'ambiente di sviluppo | abilitare i domini nelle impostazioni di Claude (claude.ai → Settings → Capabilities, piani a pagamento) |
| Copernicus Data Space Ecosystem (dati Sentinel originali, Browser) | account gratuito |
| Sentinel Hub (servizi WMS/WMTS su misura) | account; oltre la prova gratuita è a pagamento |
| EOX Sentinel-2 cloudless 2018–2025 | licenza non commerciale (CC BY-NC-SA); per uso commerciale si compra da EOX. L'anno 2016 è CC BY 4.0 |
| Cesium ion (terreno mondiale, OSM Buildings 3D) | account e token; uso commerciale con piano a pagamento |
| Google Photorealistic 3D Tiles / Map Tiles API | chiave API e fatturazione; i termini vietano estrazione e ricostruzione |
| Meshy, Tripo (generazione di modelli 3D con AI) | account e crediti; uso commerciale con piani a pagamento; chiave API da tenere segreta (mai nel codice pubblico) |
| RunPod (GPU per modelli AI aperti come TRELLIS) | account e pagamento a consumo |
| Hugging Face | account per i modelli con accesso controllato; alcuni modelli (es. Hunyuan3D-2) hanno licenze che escludono l'Unione Europea |
| textures.com | abbonamento a pagamento |
