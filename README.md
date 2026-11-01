# ITALIA OPEN WORLD

Gioco open world 3D per telefono (una sola pagina web, three.js) ambientato sulla mappa reale dell'Italia: città con facciate, tetti, negozi, lampioni, auto in sosta, traffico, passanti e polizia sulle strade vere di OpenStreetMap.

**Gioca:** apri `https://samuelebruzzese12-stack.github.io/italia-open-world/` dal telefono (serve la connessione a internet: la mappa si scarica mentre giochi).

## Fonti della mappa

- Dati geografici: © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors (ODbL); schema e tile vettoriali [OpenMapTiles](https://openmaptiles.org/), serviti da [OpenFreeMap](https://openfreemap.org/).
- Rilievo del terreno: tile [Mapterhorn](https://mapterhorn.com/) — per l'Italia: TINITALY 10 m (INGV, CC BY 4.0), DTM Valle d'Aosta 2 m (CC BY 4.0), DGM Provincia di Bolzano 2,5 m (CC0), DTM Lombardia 5 m (CC BY 4.0), DTM Piemonte 5 m (CC BY 4.0), DTM Sardegna 1 m (CC BY 4.0), MDT Sicilia 2 m (CC BY 4.0), LiDAR Trento 5 m (CC BY 2.5), Copernicus GLO-30. Elenco completo: https://mapterhorn.com/attribution
- Auto: «Alfa Romeo 159 Sedan And Wagon» di Nieve5677 (sketchfab.com), CC BY 4.0. Modelli delle armi e suoni: vedi «Crediti» nell'armeria del gioco.
- Motore 3D: three.js r128 (MIT).

## File

- `index.html` — il gioco (tutto il codice, compreso il caricatore della mappa che gira in un Web Worker)
- `armi/modelli/*.json` — modelli 3D delle armi
- `radio/` — brano della radio di bordo
