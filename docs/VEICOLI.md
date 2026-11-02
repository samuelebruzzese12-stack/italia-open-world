# Database dei veicoli (`motore/veicoli_db.js`)

Ogni dato è registrato come `{ v, u, fonte, att, ver, nota }`: valore (numero, intervallo o testo), unità, fonte (`stampa` = schede tecniche pubbliche, `derivato` = calcolato da dati dichiarati, `provvisorio` = valore tipico di categoria), attendibilità (`alta`/`media`/`bassa`/`provvisoria`), stato di verifica (`verificato`/`da verificare`/`stima`). **Nessun dato è inventato**: dove la scheda non lo riporta, il valore è un provvisorio di categoria contrassegnato come tale, e `IOW_VEICOLI.parametri(id).provvisori` ne restituisce l'elenco (25 voci per l'Alfa 159, mostrate anche nel pannello 🚗 → Scheda).

## Alfa Romeo 159 Berlina 1.9 JTDm 16V 150 CV (2005-2010) — auto del giocatore
Dati dichiarati dal costruttore come riportati dai cataloghi pubblici consultati il 2026-11-02 (dati tecnici: fatti non protetti; nessun testo è stato copiato):

| Dato | Valore usato | Fonti concordi | Note |
|---|---|---|---|
| Potenza | 110 kW (150 CV) a 4000 giri | alVolante, automoto, auto-data, ultimatespecs, autodata1, carsopedia | |
| Coppia | 320 N·m a 2000 giri | automoto, auto-data, carsopedia, zeperfs | |
| Cilindrata | 1910 cm³, 4 cilindri, 16 valvole, turbo VGT, common rail | tutte | codice motore 939 A2.000 |
| Massa a vuoto | intervallo 1495–1565 kg, usato 1535 (+75 kg conducente) | auto-data 1535, automoto 1555, ultimatespecs 1510, encycarpedia 1565, auto-data Q-Tronic 1495 | i cataloghi divergono |
| Massa complessiva | 2055 kg | auto-data, autodata1 (2045-2060) | |
| Dimensioni | 4660 × 1828 × 1417 mm, passo 2700 mm | tutte (altezza 1452 su ultimatespecs) | |
| Cx | 0,33 | ultimatespecs (altre fonti 0,32) | attendibilità bassa |
| Area frontale | 2,20 m² | derivata (0,85 × L × H) | stima |
| Pneumatici | 215/55 R16 (raggio 0,3215 m) | topgear, auto-data (cerchi 7J×16) | a listino anche 225/50 R17, 235/45 R18 |
| Freni | anteriori autoventilanti 305 mm, posteriori a disco, ABS, VDC/ASR di serie | ultimatespecs, autodata1 | |
| Sospensioni | anteriore a quadrilatero alto, posteriore multilink | carsopedia, carsart | |
| Serbatoio | 70 L | alVolante, automoto | |
| Velocità massima | 207–212 km/h (usato 210) | auto-data 210, alVolante 212, automoto 209, cars-data 207 | |
| 0-100 km/h | 9,2–9,6 s (usato 9,4) | auto-data 9,4, alVolante 9,2, automoto Q-Tronic 9,4, cars-data 9,6 | |
| Consumi NEDC | 6,0 misto (8,1 urbano, 4,8 extraurbano); 5,7 versione 2009 | autodata1, auto-data, alVolante | |
| Rapporti del cambio, finale | **provvisori** (3,82 / 2,16 / 1,48 / 1,07 / 0,88 / 0,74; finale 3,10) | — | non dichiarati nelle schede: valori tipici di un 6 marce per turbodiesel, scelti perché a 210 km/h in 6ª il motore sia vicino a 4000 giri. Da sostituire con il manuale d'officina |
| Minimo, limitatore, inerzia, attrito, boost, BSFC, baricentro, distribuzione pesi, molle, ammortizzatori | **provvisori** | — | valori tipici di categoria |

Fonti: alvolante.it (scheda 1.9 JTDm 16V Progression 2009), automoto.it (catalogo 159), auto-data.net, ultimatespecs.com, cars-data.com, autodata1.com, topgear.com (scheda), carsopedia.com, carsart.net, zeperfs.com, encycarpedia.com. Nessun dato di Google. Il modello 3D è «Alfa Romeo 159 Sedan And Wagon» di Nieve5677 (Sketchfab, CC BY 4.0), già nel gioco.

## Veicoli generici (dimostrativi)
`generico_auto`, `generico_pattuglia`, `generico_camion`: tutti i dati sono provvisori di categoria e lo stato dichiara «MODELLO DIMOSTRATIVO DI CATEGORIA — nessun veicolo reale». Servono ai test e come base per il traffico e le pattuglie (che oggi usano ancora la loro fisica semplice).

## Importazione di dati reali
Struttura pronta per aggiungere veicoli come oggetti JavaScript con lo stesso formato (JSON equivalente). Non c'è ancora un importatore CSV/Parquet né dati OBD/CAN: quando ci saranno registrazioni autorizzate, il punto d'ingresso è `motore/calibrazione.js` (confronto simulato/misurato) e `IOW_VEICOLI.VEICOLI` (nuove schede).
