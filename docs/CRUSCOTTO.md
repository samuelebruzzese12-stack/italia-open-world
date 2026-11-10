# Quadro strumenti, spie e comandi a frecce e pedali (versione 33)

Modulo: `motore/cruscotto.js` (logica + disegno vettoriale su Canvas, nessuna immagine esterna). Collegamento alla pagina:
`sorgenti/patch_cruscotto_v33.py` (passo 68 di `tools/build/build.py`). Test: `test/cruscotto.js` (14, dentro `node test/run.js`) e
`node test/browser_cruscotto.js` (13 prove in Chromium con controllo dei pixel; registro in
[`docs/test/v33_cruscotto_chromium.txt`](test/v33_cruscotto_chromium.txt)). Immagini: `docs/img/v33_*.png`.

La disposizione segue il riferimento fornito (contagiri a sinistra, tachimetro a destra con il consumo istantaneo, display blu al centro,
temperatura e carburante ai lati, spie sopra e sotto). La grafica è disegnata da zero: i simboli seguono le forme dei pittogrammi
normalizzati (ISO 2575), non sono copiati da nessuna immagine.

## Strumenti
| Strumento | Legato a | Dettagli |
|---|---|---|
| Tachimetro 0–280 km/h (220°) | \|vx\| della dinamica a 200 Hz (`VEH.v`) | tacche ogni 2 km/h, numeri ogni 20; lancetta rossa con dinamica del secondo ordine (16 rad/s, smorzamento 0,72) come i motori passo-passo dei quadri veri; tolleranza di lettura configurabile (0 %) |
| Consumo istantaneo km/l (0–30) | velocità / consumo del motore (`motore.consumoLh`) | filtrato 0,6 s; in rilascio con l'iniezione tagliata va a fondo scala, da fermo a zero |
| Contagiri 0–8 ×1000 giri/min (190°) | `motore.rpm` | zona rossa dal limitatore del veicolo (Alfa 159 1.9 JTDm: 4600 giri), arancione 500 giri prima |
| Display (cifre a 7 segmenti) | spostamento dell'auto **sulla mappa** | totali (6 cifre, partono da 157 256 km e si salvano) e parziali della sessione a 0,1 km; salti oltre 80 m/s esclusi (teletrasporti); marcia; chiave quando un componente meccanico è sotto il 70 %; tocco lungo sul display: azzera i parziali |
| Temperatura C–H | `motore.Tacqua` | strumento «tamponato» come nelle auto vere: fermo a metà fra 80 e 105 °C; zona rossa in alto |
| Carburante E–F | litri nel serbatoio / capacità | galleggiante smorzato 6 s (non oscilla in curva), risalita rapida all'accensione; zona rossa in basso |

All'accensione (salendo in auto): **giro di prova** delle lancette (1,4 s) e **autotest** delle spie (2 s).

## Spie (21) e da dove prendono lo stato
| Spia | Colore | Accesa quando |
|---|---|---|
| ABS | arancione | **lampeggia** (2 Hz) mentre l'ABS regola (PID della centralina a 200 Hz, almeno 0,5 s dopo ogni intervento); **fissa** in BLACKOUT (urto oltre 15 g) o con l'ABS disattivato dalla rete (sensore ruota guasto) |
| ESP / controllo di trazione (auto che sbanda) | ambra | **lampeggia** mentre TCS o ESP intervengono; **fissa** in BLACKOUT o con l'ESC disattivato |
| Guasto motore | gialla | motore KO (integrità del motore o danno termico sotto 0,30), codice di guasto del motore attivo, oppure quadro acceso a motore spento |
| Pressione olio | rossa | motore KO, oppure motore spento con il quadro acceso |
| Freno di stazionamento (P) | rossa | freno a mano tirato, **oppure portiere bloccate** dal telaio deformato fino all'uscita con i 10 calci |
| Portiere | rossa | portiere bloccate (fino ai 10 calci) o una portiera aperta/sganciata dall'urto |
| Impianto frenante (!) | rossa | freno a mano, freni danneggiati, oppure BLACKOUT (la ripartizione elettronica EBD è persa) |
| Abbaglianti / anabbaglianti / posizione | blu / verde / verde | fari scelti (o in AUTO accesi di notte e in galleria) |
| Frecce | verdi | luci di emergenza (1,5 Hz; si accendono da sole dopo un urto da blackout) |
| Sensori di parcheggio | bianca | retromarcia inserita |
| Batteria | rossa | motore spento, tensione sotto 11,8 V o alternatore danneggiato |
| Luci esterne guaste | arancione | fari o fanali rotti dalla carrozzeria deformabile |
| Temperatura | rossa | oltre 112 °C (lampeggia oltre 120) |
| Riserva | ambra | riserva del serbatoio (10 %) |
| Cintura | rossa | nei primi 2,5 s dopo essere saliti (lampeggia se si parte oltre 20 km/h) |
| Retronebbia | ambra | pulsante retronebbia |
| Lunotto termico, liquido lavavetri | ambra | **non collegate**: il gioco non ha questi impianti; si vedono solo nell'autotest |

## Comandi in auto (la levetta è eliminata)
In auto la levetta analogica è nascosta e **ignorata dalla logica** (`ix`, `iy` arrivano solo da frecce, pedali e tastiera). A piedi resta,
perché serve a camminare.
- **Frecce ◀ ▶**: sterzo a rampa (pieno in 0,22 s, ritorno al centro in 0,15 s), poi la riduzione dello sterzo con la velocità del gioco.
- **Pedale dell'acceleratore**: analogico, la pressione dipende dal punto toccato (in alto 100 %, in basso 25 %, trascinando il dito
  cambia); il pedale segue il piede con 60 ms di ritardo e si inclina sullo schermo. La coppia del motore è lineare con il pedale
  (25 / 62,5 / 100 % provati sulla coppia vera).
- **Pedale del freno**: analogico, comanda l'impianto idraulico (con l'ABS se la centralina è viva). Da fermo, tenendolo premuto, si
  inserisce la retromarcia (come il tasto «indietro» di prima).
- Funzionano insieme con più dita (gas e freno, sterzo e pedali). Tastiera: frecce/WASD come prima, **L** fari, **H** emergenza.
- Pulsanti sopra le frecce: **fari** (AUTO → spenti → posizione → anabbaglianti → abbaglianti), **emergenza**, **retronebbia**.

## Fari e polizia in galleria
Il fascio dei fari si vede di notte **e in galleria** (riconosciuta quando sopra l'auto ci sono più di 2,5 m di terreno) e con gli
abbaglianti è più lungo e luminoso. A **fari spenti**, di notte o in galleria, le pattuglie vedono l'auto solo entro **35 m** (con le sole
luci di posizione 70 m) invece di 260–380 m: senza contatto visivo per 8 s l'inseguimento passa alla ricerca (logica della polizia già
esistente). Limite dichiarato: la galleria è riconosciuta dal terreno, non da un dato «galleria» di OpenStreetMap.

## Portiere bloccate e 10 calci
Quando la deformazione supera le soglie (Vehicle Damage Solver: zona «porte» sotto 0,60 o «montanti» sotto 0,65 o «abitacolo» sotto
0,80; senza solver: zone centrali della rete sotto 0,55) le portiere si bloccano. «Scendi dall'auto» diventa **«Calcia il parabrezza
(n/10)»**: a auto ferma ogni tocco è un calcio (suono e scossone); al 4° il parabrezza si crepa, al 10° si sfonda (`crGlassBreak`) e si
esce dal davanti. Le spie P e portiere restano accese fino a quel momento. La riparazione della carrozzeria in officina sblocca le portiere.

## Quadro sullo schermo
In basso al centro, tra frecce e pedali; tocco: piccolo → grande → nascosto («⏲ QUADRO»). Disegnato a 30 fotogrammi al secondo con
la densità di pixel dello schermo (massimo 2×); il fondo (quadranti, scale, numeri) è disegnato una volta sola. In auto i crediti della
mappa (obbligatori) passano in alto, piccoli.

## Prove
- `node test/run.js`: 111 test, di cui 14 sul quadro guidato dal motore fisico vero (lancette sulla velocità e sui giri durante
  un'accelerazione, km/l in crociera e in rilascio, chilometri sulla mappa con le curve, carburante che scende con il consumo calcolato,
  ABS che lampeggia in una frenata vera, ESP che lampeggia sulla neve, blackout con spie fisse, guasto di un sensore, motore KO dai danni,
  autotest, portiere, emergenza a 1,5 Hz, sensori in retromarcia, cintura, pedali lineari sulla coppia e freno con ABS).
- `node test/browser_cruscotto.js`: 13 prove in Chromium — disegno controllato sui pixel (21 spie col loro colore, spie spente buie,
  lampeggio acceso/spento e fisso in blackout, lancette sull'angolo giusto, display blu) e banco d'integrazione con CSS, HUD e codice
  del quadro **veri della pagina** (levetta assente in auto e presente a piedi, nessuna sovrapposizione su 844×390, tocchi veri su pedali e
  frecce, multitocco, ABS in frenata con il pedale, blackout, fari e visibilità della polizia in galleria, 10 calci con crepa e
  parabrezza sfondato, 0 errori JavaScript). Il gioco intero non si è potuto avviare in Chromium perché three.js non si scarica dal
  contenitore delle prove.
