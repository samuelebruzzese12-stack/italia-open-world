# ITALIA OPEN WORLD — Rapporto di implementazione (Versione 28)

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
| `index.html` | il gioco (Versione 28) |
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
- Rotatorie: riconosciute dalla forma, quindi può sfuggirne qualcuna (anelli molto irregolari o divisi fra due celle) o essere scambiata una curva circolare a senso unico; le rampe autostradali sono escluse.
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
