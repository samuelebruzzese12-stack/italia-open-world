# Motore fisico del veicolo (`motore/fisica_veicolo.js`)

Modulo puro, senza dipendenze dal gioco: gira nel browser (`window.IOW_FISICA`) e in Node (`require`). È usato da `index.html` per l'auto del giocatore e dai test (`node test/run.js`) e dalla calibrazione (`node motore/calibrazione.js`).

## Stato: cosa è implementato, cosa è semplificato, cosa manca

| Area | Stato | Dettagli |
|---|---|---|
| Curva di coppia e potenza | **implementato** | interpolazione lineare fra punti [giri, N·m]; per l'Alfa 159 passano per i due punti dichiarati (320 N·m a 2000, 110 kW a 4000), gli altri punti sono interpolati (marcati «derivato») |
| Carico parziale, attrito interno, minimo, limitatore | **implementato** | coppia = gas·coppia piena − (1−gas)·attrito(giri); regolatore del minimo; taglio del gas sopra il limitatore (anche quello imposto dall'ECU) |
| Turbo | **semplificato** | pressione che insegue il gas con ritardo del primo ordine (0,55 s in salita, 0,25 s in discesa) e poca spinta sotto i 1900 giri; nessuna mappa compressore |
| Inerzia rotante | **implementato** | volano/albero riportati alle ruote (masse rotanti equivalenti), ruote 4×1,2 kg·m² |
| Cambio | **implementato** | rapporti reali per marcia + finale, retromarcia, rendimento, taglio di coppia e regime adattato durante la cambiata; **automatico** (logica TCU: salita di marcia a regime crescente con il gas, scalata, kick-down con isteresi) o **manuale** (Z/X o pulsanti) |
| Frizione | **semplificato** | in partenza slitta: il motore sta a 0,95–2,5× il minimo secondo il gas e trasmette la sua coppia; nessun modello di temperatura della frizione |
| Trazione anteriore / posteriore / integrale | **implementato** | il limite di aderenza usa il carico dell'asse motore (integrale: entrambi) |
| Resistenza aerodinamica | **implementato** | ½·ρ·Cx·A·v², densità dell'aria da quota e temperatura, vento frontale |
| Rotolamento | **implementato** | Crr 0,011 × fattore superficie × √(p nominale / p gomme) |
| Pendenza | **implementato** | m·g·sin(α) dalla quota del terreno davanti/dietro all'auto (nel gioco: rilievo reale Mapterhorn) |
| Trasferimento di carico | **implementato** | longitudinale, dall'accelerazione del passo precedente (stabile) |
| Aderenza e ASR | **implementato** | forza motrice limitata a μ·N dell'asse motore; con ASR si tiene al 97 % del limite, senza ASR le ruote pattinano (μ di scivolamento 80 %) |
| Freni, ripartizione, EBD, ABS | **implementato** | richiesta = freno·m·decelerazione massima, ripartizione 68/32 con EBD (l'eccesso posteriore passa all'anteriore), ABS virtuale al 96 % del limite; senza ABS ruote bloccate al 72 % e sterzo inefficace (gestito dal gioco) |
| Freno a mano | **implementato** | sul retrotreno, blocca le posteriori sopra 1,5 m/s (il gioco produce la deriva) |
| Pneumatici | **semplificato (parametrico)** | μ = picco × superficie × pressione × temperatura × usura × aquaplaning; temperatura e usura evolvono nel tempo; **NON** è Pacejka: la funzione `muRuota` è il punto in cui inserire un modello professionale quando ci saranno i parametri |
| Aquaplaning | **semplificato e documentato** | velocità critica dalla formula di Horne (NASA): v ≈ 10,35·√p(psi) mph; perdita di aderenza fino all'85 % con almeno 4 mm d'acqua. Il gioco oggi non ha pioggia: `acqua` è sempre 0 |
| Superfici | **implementato** | asfalto, cemento, bagnato, lastricato, ghiaia, terra, erba, neve, ghiaccio (coefficienti di letteratura, ordine di grandezza); nel gioco la superficie arriva dalla classe del suolo di OpenStreetMap sotto l'auto (strada → asfalto) |
| Termica | **semplificato** | refrigerante: calore ≈ 28 % dell'energia del carburante, scambio al radiatore con termostato (84–93 °C) e ventola; olio che segue il refrigerante; limite 140 °C (oltre il liquido bolle: fase vapore non modellata) |
| Consumo | **implementato** | consumo specifico (BSFC) minimo dichiarato come provvisorio (205 g/kWh), peggiora a carico parziale e lontano dal regime di coppia; cut-off in rilascio; serbatoio, riserva, motore che si spegne a serbatoio vuoto |
| Motori benzina, ibridi, elettrici | **parziale** | benzina: stessa struttura (densità carburante e curva diverse); **ibrido ed elettrico non implementati** (manca il modello di batteria di trazione e di motore elettrico) |
| Dinamica laterale, sospensioni a più gradi di libertà, rollio e beccheggio | **non in questo modulo** | il gioco conserva il suo modello di deriva, al quale il modulo fornisce il coefficiente di aderenza; il rollio/beccheggio visivi sono quelli già presenti nel gioco |
| Integrazione numerica | **implementato** | Eulero semi-implicito con sottopassi da 1/120 s, arresto netto a velocità nulla, «hill holder» (fermo senza gas) |

## Prestazioni simulate vs dichiarate (Alfa Romeo 159 1.9 JTDm 150 CV)

Eseguire `node motore/calibrazione.js` (o il pulsante «Esegui prove» nel pannello 🚗 del gioco). Risultato del 2026-11-02:

| Prova | Simulato | Dichiarato | Errore |
|---|---|---|---|
| 0-100 km/h | 10,2 s | 9,2–9,6 s | +9 % (+6,7 % verso l'intervallo) |
| Velocità massima | 211,6 km/h in 6ª a 4000 giri | 207–212 km/h | +1 % |
| 100-0 km/h | 41,4 m (3,1 s) | non dichiarato (stampa: 36-42 m per la classe) | — |
| 90 km/h costanti | 4,8 L/100 km | 4,8 (extraurbano NEDC) | −0,5 % (confronto indicativo) |
| Ciclo urbano semplificato | 6,8 L/100 km | 8,1 (urbano NEDC) | −17 % (ciclo diverso) |
| Misto stimato | 5,9 L/100 km | 5,7–6,0 | 0 % |

Errore medio assoluto sulle prove confrontabili: **5,5 %**. Giudizio: **non validato** — il confronto è con i dati dichiarati di stampa, non con misure strumentali fatte da noi. Nessuna delle prove usa valori casuali: due esecuzioni danno lo stesso risultato (test «determinismo»).

## Come il gioco lo usa (`index.html`, blocco «VEICOLO REALE»)

- `drive()` chiama `VEHX.drive(dt, vf, vl, iy, hb)`: la velocità longitudinale è calcolata dal modulo (motore, cambio, freni, pendenza, superficie); sterzo, deriva, urti e ribaltamenti restano quelli del gioco, con l'aderenza del modulo che riduce la tenuta laterale su ghiaccio/erba e con le ruote bloccate che rendono lo sterzo inefficace.
- Il motore è **spento** quando si sale in auto: si avvia tenendo il gas (0,6 s). Senza carburante o con batteria scarica non parte (messaggio a schermo).
- Quadro (chip in alto): marcia, giri, carburante, temperatura, spie.
- Pannello 🚗: telemetria completa, cambio automatico/manuale, avvio/spegnimento, rifornimento ai benzinai di OpenStreetMap (gasolio € 1,699/L, prezzo di gioco).
- Salvataggio: carburante, odometro, temperature, usura e pressione gomme, modo del cambio (`S.veicolo.fisica`).
- Se i moduli non si caricano (`VEHOK=false`) il gioco usa il vecchio modello arcade: nessuna funzionalità precedente è stata rimossa.

## API in breve

```js
const P = IOW_VEICOLI.parametri('alfa_159_19_jtdm_150');
const v = IOW_FISICA.crea(P, { carburante: 40, modo: 'auto' });
IOW_FISICA.passo(v, dt, { iy: 1, frenoMano: false }, { pendenza: 0.05, superficie: 'asfalto', acqua: 0, tempAria: 20 });
IOW_FISICA.telemetria(v);      // oggetto con velocità, marcia, giri, coppia, temperature, consumi, forze...
IOW_FISICA.serializza(v); IOW_FISICA.ripristina(v, dati);
```
`v.mod` (danni: potenza, radiatore, refrigerante, freni[4], cambio, attrito extra, perdita carburante, alternatore, avviamento) e `v.ecu` (limiti imposti dalle centraline: accMax, limitatore, abs, asr, tagliaCoppia, marciaMaxTCU, cambioBloccato, spegni) sono i due punti di ingresso degli altri moduli.
