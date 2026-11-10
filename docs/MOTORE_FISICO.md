# Motore fisico del veicolo (`motore/fisica_veicolo.js`)

Modulo puro, senza dipendenze dal gioco: gira nel browser (`window.IOW_FISICA`) e in Node (`require`). È usato da `index.html` per l'auto del giocatore e dai test (`node test/run.js`) e dalla calibrazione (`node motore/calibrazione.js`).

## Stato: cosa è implementato, cosa è semplificato, cosa manca

| Area | Stato | Dettagli |
|---|---|---|
| Curva di coppia e potenza | **implementato** | interpolazione lineare fra punti [giri, N·m]; per l'Alfa 159 passano per i due punti dichiarati (320 N·m a 2000, 110 kW a 4000), gli altri punti sono interpolati (marcati «derivato») |
| Carico parziale, attrito interno, minimo, limitatore | **implementato** | coppia = gas·coppia piena − (1−gas)·attrito(giri); regolatore del minimo; taglio del gas sopra il limitatore (anche quello imposto dall'ECU) |
| Turbo | **semplificato** | pressione che insegue il gas con ritardo del primo ordine (0,55 s in salita, 0,25 s in discesa) e poca spinta sotto i 1900 giri; nessuna mappa compressore |
| Inerzia rotante | **implementato** | ogni ruota ha la sua dinamica (1,2 kg·m²); con la frizione chiusa le ruote motrici trascinano l'inerzia del motore (Ie·τ² nella matrice delle masse) |
| Cambio | **implementato** | rapporti reali per marcia + finale, retromarcia, rendimento, taglio di coppia e regime adattato durante la cambiata; **automatico** (logica TCU: salita di marcia a regime crescente con il gas, scalata, kick-down con isteresi) o **manuale** (Z/X o pulsanti) |
| Frizione | **semplificato** | in partenza slitta: il motore sta a 0,95–2,5× il minimo secondo il gas e trasmette la sua coppia; nessun modello di temperatura della frizione |
| Trazione anteriore / posteriore / integrale | **implementato** | differenziale aperto: coppia uguale sulle ruote motrici, una ruota che pattina «si porta via» la spinta (il TCS la frena) |
| Resistenza aerodinamica | **implementato** | ½·ρ·Cx·A·v², densità dell'aria da quota e temperatura, vento frontale |
| Rotolamento | **implementato** | Crr 0,011 × fattore superficie × √(p nominale / p gomme) |
| Pendenza | **implementato** | m·g·sin(α) dalla quota del terreno davanti/dietro all'auto (nel gioco: rilievo reale Mapterhorn) |
| Trasferimento di carico | **implementato** | longitudinale e laterale per ruota, dalle accelerazioni filtrate (70 ms: beccheggio e rollio non istantanei), 55 % del laterale sull'asse anteriore |
| Aderenza e TCS (ASR) | **implementato** | forze della Magic Formula combinata per ruota; TCS con PID sullo scorrimento di picco in trazione (taglio di coppia + frenata della ruota che pattina) — `motore/controllo_dinamica.js` |
| Freni, ripartizione, EBD, ABS | **implementato** | coppia frenante per ruota (capacità 1,25 × m·decelerazione massima, 68/32), impianto con ritardo di 12 ms; ABS con PID per ruota sullo scorrimento di picco della formula; EBD; senza ABS (o in blackout) le ruote si bloccano: ω = 0, λ = −1, forza di strisciamento opposta al moto e sterzo inefficace per fisica |
| Freno a mano | **implementato** | coppia meccanica sulle posteriori (fuori dall'ABS): le blocca e la deriva nasce dalle gomme posteriori senza forza laterale |
| Pneumatici | **implementato (Magic Formula 5.2 combinata)** | `motore/pneumatici_mf.js`: Fx(κ, α), Fy(α, κ), Mz, sensibilità al carico, rilassamento laterale; il μ di `muRuota` (superficie × pressione × temperatura × usura × aquaplaning × danni) è il fattore di scala λμ della formula. Coefficienti di un pneumatico generico, non del 215/55 R16: vedi [PNEUMATICI_DINAMICA.md](PNEUMATICI_DINAMICA.md) |
| Aquaplaning | **semplificato e documentato** | velocità critica dalla formula di Horne (NASA): v ≈ 10,35·√p(psi) mph; perdita di aderenza fino all'85 % con almeno 4 mm d'acqua. Il gioco oggi non ha pioggia: `acqua` è sempre 0 |
| Superfici | **implementato** | asfalto, cemento, bagnato, lastricato, ghiaia, terra, erba, neve, ghiaccio (coefficienti di letteratura, ordine di grandezza); nel gioco la superficie arriva dalla classe del suolo di OpenStreetMap sotto l'auto (strada → asfalto) |
| Termica | **semplificato** | refrigerante: calore ≈ 28 % dell'energia del carburante, scambio al radiatore con termostato (84–93 °C) e ventola; olio che segue il refrigerante; limite 140 °C (oltre il liquido bolle: fase vapore non modellata) |
| Consumo | **implementato** | consumo specifico (BSFC) minimo dichiarato come provvisorio (205 g/kWh), peggiora a carico parziale e lontano dal regime di coppia; cut-off in rilascio; serbatoio, riserva, motore che si spegne a serbatoio vuoto |
| Motori benzina, ibridi, elettrici | **parziale** | benzina: stessa struttura (densità carburante e curva diverse); **ibrido ed elettrico non implementati** (manca il modello di batteria di trazione e di motore elettrico) |
| Dinamica laterale e imbardata | **implementato (dalla versione 2.0.0)** | 7 gradi di libertà (vx, vy, r, 4 ruote) a 200 Hz; il gioco riceve vx, vy e l'imbardata. ESP sull'imbardata di riferimento. Sospensioni a più gradi di libertà: **non implementate** (rollio e beccheggio visivi sono quelli del gioco) |
| Integrazione numerica | **implementato** | passo fisso di 5 ms (200 Hz) con accumulo del tempo del fotogramma; vx e ω con Eulero all'indietro linearizzato, vy e r semi-impliciti; arresto netto a velocità nulla, «hill holder» (fermo senza gas) |
| Centralina e blackout | **implementato** | `motore/controllo_dinamica.js`: ABS, TCS, ESP, EBD a 200 Hz; un urto oltre 15 g (accelerazione di picco stimata dal Vehicle Damage Solver) la spegne fino alla riparazione in officina |

## Prestazioni simulate vs dichiarate (Alfa Romeo 159 1.9 JTDm 150 CV)

Eseguire `node motore/calibrazione.js` (o il pulsante «Esegui prove» nel pannello 🚗 del gioco). Risultato del 2026-11-02:

| Prova | Simulato | Dichiarato | Errore |
|---|---|---|---|
| 0-100 km/h | 10,2 s | 9,2–9,6 s | +9 % (+6,7 % verso l'intervallo) |
| Velocità massima | 211,6 km/h in 6ª a 4000 giri | 207–212 km/h | +1 % |
| 100-0 km/h | 42,3 m (dinamica 7DoF e ABS a PID, 2026-11-10; prima 41,4 m) | non dichiarato (stampa: 36-42 m per la classe) | — |
| 90 km/h costanti | 4,8 L/100 km | 4,8 (extraurbano NEDC) | −0,5 % (confronto indicativo) |
| Ciclo urbano semplificato | 6,8 L/100 km | 8,1 (urbano NEDC) | −17 % (ciclo diverso) |
| Misto stimato | 5,9 L/100 km | 5,7–6,0 | 0 % |

Errore medio assoluto sulle prove confrontabili: **5,6 %** (5,5 % prima della dinamica a 7 gradi di libertà). Giudizio: **non validato** — il confronto è con i dati dichiarati di stampa, non con misure strumentali fatte da noi. Nessuna delle prove usa valori casuali: due esecuzioni danno lo stesso risultato (test «determinismo»).

## Come il gioco lo usa (`index.html`, blocco «VEICOLO REALE»)

- `drive()` chiama `VEHX.drive(dt, vf, vl, iy, hb, sterzo)`: il modulo integra a 200 Hz velocità longitudinale, velocità laterale, imbardata e ruote (Magic Formula combinata) e `drive()` ne riceve vx, vy e imbardata. Gli urti che ruotano l'auto diventano un impulso d'imbardata; ribaltamenti e collisioni restano quelli del gioco. Ogni urto porta la sua accelerazione di picco alla centralina (blackout oltre 15 g). Dalla versione 32 (`sorgenti/patch_pneumatici_v32.py`).
- Il motore è **spento** quando si sale in auto: si avvia tenendo il gas (0,6 s). Senza carburante o con batteria scarica non parte (messaggio a schermo).
- Quadro (chip in alto): marcia, giri, carburante, temperatura, spie.
- Pannello 🚗: telemetria completa, cambio automatico/manuale, avvio/spegnimento, rifornimento ai benzinai di OpenStreetMap (gasolio € 1,699/L, prezzo di gioco).
- Salvataggio: carburante, odometro, temperature, usura e pressione gomme, modo del cambio (`S.veicolo.fisica`).
- Se i moduli non si caricano (`VEHOK=false`) il gioco usa il vecchio modello arcade: nessuna funzionalità precedente è stata rimossa.

## API in breve

```js
const P = IOW_VEICOLI.parametri('alfa_159_19_jtdm_150');
const v = IOW_FISICA.crea(P, { carburante: 40, modo: 'auto' });
IOW_FISICA.passo(v, dt, { iy: 1, frenoMano: false, sterzo: 0.05 /* rad, + a sinistra */, forzaEsterna: null }, { pendenza: 0.05, superficie: 'asfalto', acqua: 0, tempAria: 20 });
IOW_FISICA.ruote(v);           // per ruota: ω, λ, α, Fz, Fx, Fy, Mz, μ, bloccata, coppie, ABS
IOW_FISICA.urto(v, gPicco);    // centralina: blackout oltre 15 g; IOW_FISICA.riavviaCentralina(v) in officina
IOW_FISICA.telemetria(v);      // oggetto con velocità, marcia, giri, coppia, temperature, consumi, forze...
IOW_FISICA.serializza(v); IOW_FISICA.ripristina(v, dati);
```
`v.mod` (danni: potenza, radiatore, refrigerante, freni[4], cambio, trasmissione, **frizione** (coppia trasmissibile), **differenziale** (coppia alle ruote), **muRuota[4]** (aderenza per ruota, dal Vehicle Damage Solver), attrito extra, perdita carburante, alternatore, avviamento; versione 1.1.0) e `v.ecu` (limiti imposti dalle centraline: accMax, limitatore, abs, asr, tagliaCoppia, marciaMaxTCU, cambioBloccato, spegni) sono i due punti di ingresso degli altri moduli.
