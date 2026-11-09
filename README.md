# ITALIA OPEN WORLD

Gioco open world 3D per telefono (una sola pagina web, three.js) ambientato sulla mappa reale dell'Italia: città con i nomi veri delle vie, le insegne dei negozi veri, i numeri civici e le fermate dell'autobus di OpenStreetMap; facciate con balconi e finestre incassate, tetti a falde, strisce pedonali, semafori, binari del tram, gallerie stradali percorribili, guardrail, cartelli delle uscite autostradali, terreno con erba/roccia/terra, specie di alberi per zona (pini, cipressi, ulivi, pioppi), cielo con nuvole, lampioni, auto in sosta, traffico, passanti e polizia sulle strade vere.

**Versione 31:** **audit e correzione strutturale della mappa** (rapporto con cause, misure prima/dopo e limiti in [`docs/AUDIT_V31.md`](docs/AUDIT_V31.md)): edifici con i tetti anche visti dall'alto (prima i tetti erano rivolti verso il basso), strisce pedonali e linee di arresto visibili, strade in rilevato con i fianchi visibili (prima sembravano sospese), gallerie con pareti e soffitto visti da dentro, viadotti con l'intradosso e piloni mai sopra una strada, guardrail e parapetti interrotti agli svincoli e agli incroci (prima attraversavano le corsie) e diventati veri ostacoli, collisioni con la quota (niente muri invisibili in galleria o sui viadotti, niente facciate dentro le gallerie, auto contro auto solo alla stessa quota), fermate e cartelli fuori dalla carreggiata, passaggi sotto gli edifici, alberi senza strisce. La pagina si ricostruisce dal repository con `python3 tools/build/build.py`.

**Versione 30:** **Vehicle Damage Solver** — un solo risolutore coordina urti, deformazione, meccanica, sospensioni, ruote, pezzi staccati, grafica, audio e guida, usando i sistemi che c'erano già (rete deformabile, `danni_meccanici.js`, motore fisico, centraline) senza riscriverli: energia d'urto da massa effettiva, velocità normale, restituzione e materiale dell'ostacolo (muro, guardrail, palo, albero, altra auto, terreno), ripartita fra i due veicoli; mai la stessa energia due volte; 15 zone strutturali nominate (paraurti, cofano, muso, longheroni, vano motore, abitacolo, montanti, tetto, porte, bagagliaio, pianale, vetri, bracci) configurabili per veicolo (profili non certificati); frizione, differenziale e centraline danneggiabili con effetti reali; ruote con braccio, ammortizzatore, molla, mozzo e cerchio che cambiano aderenza, vibrazione, stabilità e tiro; pezzi staccabili con massa, resistenza, soglia e attacco; 56 test automatici sulla rete vera del gioco (`docs/DANNI.md`).

**Versione 29.3:** correzione sistematica della mappa provata su classi di situazioni (città densa con strade sovrapposte, montagna con tornanti e gallerie, svincolo autostradale, periferia) con guida virtuale automatica: raccordo degli incroci continuo e iterato, lisciatura senza errore alle estremità, raster delle quote stradali a due strati senza gradini sulle discese, impalcati e gallerie senza scala, pulsante **📦 Dati zona** nella mappa per salvare i dati del posto in cui si vede un difetto (vedi `docs/IMPLEMENTATION_REPORT.md`, sezione 0).

**Versione 29.2:** corretti i difetti della mappa visti sul telefono: niente più alberi, muri o erba sulla strada, niente asfalto sospeso né gradini agli incroci e fra un pezzo di mappa e l'altro, guardrail e parapetti che seguono la pendenza, sottopassi senza blocchi scuri, cavalcavia alti sopra le strade, rotatorie solo dove ci sono davvero (dettagli e misure prima/dopo nel rapporto).

**Versione 29:** l'auto del giocatore ha un **motore fisico reale** (Alfa Romeo 159 1.9 JTDm 150 CV con dati dichiarati e fonti: curva di coppia, cambio a 6 marce automatico o manuale, frizione, turbo, resistenze, pendenza reale, aderenza per superficie, ABS/ASR/ESC, temperature, consumo e serbatoio), **centraline virtuali** (motore, cambio, ABS, ESC, carrozzeria, batteria, gateway, bus CAN simulato, codici di guasto, diagnosi, laboratorio guasti) e **danni meccanici per componente** derivati dalla carrozzeria deformabile (radiatore, motore, cambio, sterzo, sospensioni, freni, batteria, serbatoio...), con officina a pagamento, rifornimento ai benzinai di OpenStreetMap e salvataggio dei danni. Pannello 🚗 nel gioco. Documentazione: [docs/MOTORE_FISICO.md](docs/MOTORE_FISICO.md), [docs/ECU.md](docs/ECU.md), [docs/DANNI.md](docs/DANNI.md), [docs/VEICOLI.md](docs/VEICOLI.md), [docs/CHANGELOG.md](docs/CHANGELOG.md). È una **simulazione software**: nessuna centralina fisica, nessuna validazione su veicolo reale (errore medio 5,5 % rispetto ai dati dichiarati, vedi `node motore/calibrazione.js`).

**Versione 28:** texture fotografiche vere (Poly Haven e ambientCG, CC0) su strade, marciapiedi, porfido, facciate, tetti, terreno, roccia, ponti e muretti; sole nella posizione astronomica vera e ciclo giorno/notte (pulsante 🌓) con lampioni, finestre, fari e stelle; chiese con campanile, rosone e cupola; rotatorie, frecce di direzione, piazzole SOS, distributori, aree di servizio e caselli dove ci sono nei dati; muretti a secco, siepi ed erba fitta in campagna; copertura del suolo e terreno lontano da dati Copernicus (ESA WorldCover / Sentinel-2, pulsante «🛰 Copernicus» nella mappa). Che cosa è stato fatto e verificato: [docs/IMPLEMENTATION_REPORT.md](docs/IMPLEMENTATION_REPORT.md).

Catalogo delle fonti e licenze: [docs/RESOURCE_CATALOG.md](docs/RESOURCE_CATALOG.md) e [docs/RESOURCE_LICENSES.md](docs/RESOURCE_LICENSES.md).

**Gioca:** apri `https://samuelebruzzese12-stack.github.io/italia-open-world/` dal telefono (serve la connessione a internet: la mappa si scarica mentre giochi).

## Fonti della mappa

- Dati geografici: © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors (ODbL); schema e tile vettoriali [OpenMapTiles](https://openmaptiles.org/), serviti da [OpenFreeMap](https://openfreemap.org/).
- Rilievo del terreno: tile [Mapterhorn](https://mapterhorn.com/) — per l'Italia: TINITALY 10 m (INGV, CC BY 4.0), DTM Valle d'Aosta 2 m (CC BY 4.0), DGM Provincia di Bolzano 2,5 m (CC0), DTM Lombardia 5 m (CC BY 4.0), DTM Piemonte 5 m (CC BY 4.0), DTM Sardegna 1 m (CC BY 4.0), MDT Sicilia 2 m (CC BY 4.0), LiDAR Trento 5 m (CC BY 2.5), Copernicus GLO-30. Elenco completo: https://mapterhorn.com/attribution
- Auto: «Alfa Romeo 159 Sedan And Wagon» di Nieve5677 (sketchfab.com), CC BY 4.0. Modelli delle armi e suoni: vedi «Crediti» nell'armeria del gioco.
- Texture: Poly Haven e ambientCG, CC0 (elenco in `tex/manifest.json`).
- Copertura del suolo e immagine satellitare del terreno lontano: © ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium, CC BY 4.0 (tile Terrascope, VITO).
- Motore 3D: three.js r128 (MIT).

## File

- `index.html` — il gioco (tutto il codice, compreso il caricatore della mappa che gira in un Web Worker)
- `motore/veicoli_db.js` — database dei veicoli (dati con fonte, unità, attendibilità)
- `motore/fisica_veicolo.js` — motore fisico (motore, cambio, pneumatici, freni, termica, consumo)
- `motore/ecu.js` — centraline virtuali, bus CAN simulato, diagnosi, laboratorio guasti
- `motore/danni_meccanici.js` — danni meccanici per componente, officina, persistenza
- `motore/danni_solver.js` — Vehicle Damage Solver: energia d'urto, registro degli eventi, stato per zona, ruote e sospensioni, componenti distaccabili
- `motore/profili_danno.js` — zone strutturali nominate sulla rete deformabile e profili di danno per veicolo (importazione del JSON del progetto)
- `motore/calibrazione.js` — prove riproducibili e confronto con i dati dichiarati (`node motore/calibrazione.js`)
- `test/run.js` — test automatici dei moduli, del solver e della mappa (cause dei difetti della v31: verso dei triangoli, guardrail, viadotti, pareti, collisioni con la quota, gallerie, siepi, sagome degli edifici) (`node test/run.js`: 70 test)
- `test/scene_chromium.js`, `test/browser_mappa_v31_*.js` — prove nel gioco vero in Chromium (immagini prima/dopo, guida contro un guardrail, su un cavalcavia e nelle gallerie di Monaco); risultati in `docs/test/v31_chromium.txt`
- `armi/modelli/*.json` — modelli 3D delle armi
- `radio/` — brano della radio di bordo
- `tex/` — texture del gioco (e `tex/manifest.json` con fonti e licenze)
- `tools/texture/` — script che prepara le texture dalle sorgenti CC0
- `sorgenti/mappa_reale/` — codice della mappa reale (lo stesso che sta dentro `index.html`) e script di prova (`prova_cella.js`, `prova_sintetica.js`, `metriche.js` con le misure dei difetti, `prova_svincolo.js` con lo svincolo sintetico di `svincolo.js`)
- `sorgenti/mappa_reale/difetti.js` — misure dei difetti della v31 (guardrail, muri invisibili e ostacoli sulla strada, triangoli capovolti, pareti alte, viadotti); `sorgenti/patch_mappa_v31.py` — collisioni con la quota nel nucleo del gioco
- `tools/build/` — catena di costruzione di `index.html` (`python3 tools/build/build.py`)
- `docs/` — rapporto di implementazione, audit della v31 (`docs/AUDIT_V31.md`), catalogo delle risorse, licenze, immagini delle prove

## Comandi in auto
- Gas/freno e sterzo come prima (levetta o W/A/S/D); il motore si avvia tenendo il gas. Spazio: freno a mano.
- Cambio manuale: N per passare da automatico a manuale, Z scala, X sale (oppure i pulsanti − / + a destra).
- 🚗: pannello del veicolo (quadro, diagnosi, danni e officina, laboratorio guasti, scheda tecnica, rapporto).
- Rifornimento e riparazioni a pagamento: fermati a un benzinaio o in un'officina (⛽ / 🔧 sulla minimappa) e apri il pannello 🚗. «Ripara l'auto» resta la riparazione d'emergenza gratuita (meccanica solo al 70 %).
