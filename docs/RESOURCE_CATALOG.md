# Catalogo delle risorse effettivamente usate da ITALIA OPEN WORLD

Questo file elenca soltanto le risorse realmente integrate nel gioco e verificate (licenza letta, dati provati).
Le risorse soltanto valutate e scartate sono nella sezione finale, con il motivo.

| Nome | URL | Tipo | Licenza | Modalità d'uso nel gioco | File generati | Limiti | Costi |
|---|---|---|---|---|---|---|---|
| OpenStreetMap | https://www.openstreetmap.org/copyright | Dati geografici (strade, edifici, acque, uso del suolo, nomi, negozi, civici, fermate) | ODbL 1.0 (dati) | Letti a runtime come tile vettoriali OpenMapTiles (vedi OpenFreeMap); nessun download massivo dai server OSM | nessuno (streaming) | copertura variabile per altezze edifici e negozi | nessuno |
| OpenMapTiles (schema e tile) | https://openmaptiles.org/ · https://github.com/openmaptiles/openmaptiles | Schema delle tile vettoriali (strati `transportation`, `building`, `water`, `landcover`, `landuse`, `park`, `place`, `poi`, `housenumber`, `transportation_name`) | Schema: CC BY 4.0 · software: BSD 3-Clause · dati: ODbL | Decodifica MVT scritta nel gioco (`index.html`, lavoratore in sottofondo) | nessuno | zoom massimo 14 (le celle z15 sono quarti di tile) | nessuno |
| OpenFreeMap | https://openfreemap.org/ · https://github.com/hyperknot/openfreemap | Servizio pubblico di tile vettoriali del pianeta (`https://tiles.openfreemap.org/planet/latest/{z}/{x}/{y}.pbf`) | Software MIT; dati ODbL; uso commerciale consentito, nessuna chiave | Sorgente delle tile a runtime (CORS aperto, gzip) | nessuno | aggiornamento settimanale del pianeta; nessuna garanzia di servizio | nessuno (progetto sostenuto da donazioni) |
| Mapterhorn | https://mapterhorn.com/ · https://github.com/mapterhorn/mapterhorn | Tile del rilievo (Terrarium, WebP 512 px, `https://tiles.mapterhorn.com/{z}/{x}/{y}.webp`) | Software BSD 3-Clause; dati: licenze delle singole fonti (sotto) | Quote del terreno a runtime (zoom 11–12) | nessuno | termini: «public terrain tiles for interactive web map visualizations» | nessuno |
| TINITALY 1.1 (INGV) | https://tinitaly.pi.ingv.it/ | Modello digitale del terreno dell'Italia, 10 m | CC BY 4.0 | Tramite Mapterhorn | — | — | nessuno |
| DTM Regione Autonoma Valle d'Aosta 2 m | https://geoportale.regione.vda.it/download/dtm/ | DTM | CC BY 4.0 | Tramite Mapterhorn | — | — | nessuno |
| DGM Provincia Autonoma di Bolzano 2,5 m | https://natur-raum.provinz.bz.it/de/digitale-hohenmodelle | DTM | CC0 | Tramite Mapterhorn | — | — | nessuno |
| DTM Regione Lombardia 5 m (ed. 2015) | https://geodati.gov.it/ | DTM | CC BY 4.0 | Tramite Mapterhorn | — | — | nessuno |
| DTM Regione Piemonte 5 m (ICE 2009-2011) | https://www.geoportale.piemonte.it/ | DTM | CC BY 4.0 | Tramite Mapterhorn | — | — | nessuno |
| DTM Regione Sardegna 1 m (costiera 2008, centri urbani 2013) | https://webgis2.regione.sardegna.it/ | DTM | CC BY 4.0 | Tramite Mapterhorn | — | — | nessuno |
| MDT Regione Siciliana 2 m (volo ATA 2012-2013) | https://www.sitr.regione.sicilia.it/ | DTM | CC BY 4.0 | Tramite Mapterhorn | — | — | nessuno |
| LiDAR Provincia Autonoma di Trento 5 m | http://www.territorio.provincia.tn.it/ | DTM | CC BY 2.5 | Tramite Mapterhorn | — | — | nessuno |
| Copernicus GLO-30 | https://dataspace.copernicus.eu/ | DEM 30 m (riempimento dove manca il dato regionale) | Licenza Copernicus (libera e aperta) | Tramite Mapterhorn | — | DSM, non DTM | nessuno |
| three.js r128 | https://threejs.org/ | Motore 3D | MIT | Caricato da cdnjs | — | — | nessuno |
| earcut (Mapbox) | https://github.com/mapbox/earcut | Triangolazione dei poligoni | ISC | Codice incluso nel lavoratore della mappa | — | — | nessuno |
| «Alfa Romeo 159 Sedan And Wagon» di Nieve5677 | https://sketchfab.com/ | Modello 3D dell'auto | CC BY 4.0 | Incluso nel gioco (già dalle versioni precedenti) | — | — | nessuno |
| Modelli delle armi (vari autori) | vedi «Crediti» nell'armeria | Modelli 3D | CC BY 4.0 / CC0 (per modello) | File `armi/modelli/*.json` | — | — | nessuno |

## Risorse valutate e NON usate (con il motivo)

- Google Maps / Google Earth / Map Tiles API / Photorealistic 3D Tiles: consultati soltanto come riferimento visivo. I termini di Google vietano l'estrazione dei dati e la ricostruzione di mappe o modelli dalle immagini; le 3D Tiles fotorealistiche richiedono chiave API, fatturazione e non consentono di salvare o modificare i dati. Nessun dato Google è nel gioco.
- Google Street View: solo riferimento visivo (foto inviate dall'autore del progetto). Nessuna immagine usata.
- Geofabrik (estratti OSM) e Overpass: non necessari a runtime (le tile OpenFreeMap derivano dagli stessi dati); utili solo per una futura generazione di tile propria.
- Texture PBR fotografiche (Poly Haven CC0, ambientCG CC0, textures.com): licenze compatibili, ma l'ambiente di sviluppo usato non può scaricarle (rete limitata) e un telefono non può caricare set PBR da decine di MB per ogni materiale. Tutte le texture del gioco sono procedurali (disegnate dal codice all'avvio): intonaci, mattoni, pietra, vetro, coppi, asfalto, segnaletica, erba, roccia, terra, lastricato, con mappa delle normali per le facciate.
- Modelli 3D di edifici (Sketchfab, BlenderKit, CGTrader, TurboSquid, Fab, 3D Warehouse): non usati; gli edifici sono ricostruiti dalle impronte reali di OpenStreetMap con un sistema procedurale, perché un modello generico non coincide mai con la pianta vera del palazzo.
- Immagini satellitari (Copernicus/Sentinel, NASA, USGS, Planet): non usate nel gioco; l'uso del suolo arriva da OpenStreetMap.
- QGIS, Blender, BlenderGIS, Cesium/3D Tiles: strumenti validi per una pipeline offline; il gioco gira in una sola pagina web e costruisce la geometria a runtime, quindi non servono.
- Strumenti AI di generazione (Meshy, Tripo, Luma, Hugging Face): non usati; le loro licenze e i costi vanno valutati caso per caso e i modelli generati non rispetterebbero le impronte reali.
