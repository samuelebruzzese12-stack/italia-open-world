# Danni: carrozzeria deformabile (già nel gioco) + danni meccanici per componente (`motore/danni_meccanici.js`)

## Cosa c'era già (versioni precedenti, in `index.html`)
- Carrozzeria a nodi e travi deformabili (rete «soft body», stessa rete per tutte le Alfa): deformazione permanente, rottura dei collegamenti, zone rigide (abitacolo) e deformabili, propagazione, ammaccature locali della lamiera con normali ricalcolate, vetri crepati e frantumati con frammenti, fari rotti, paraurti appesi, cofano e portiere incernierate e staccate, ruote piegate o perse, gomme a terra (foratura, battistrada staccato, cerchio che striscia con scintille), fumo, incendio, ribaltamento, detriti e collisioni secondarie, LOD vicino/lontano, coda di lavoro con budget per fotogramma.
- Urti rilevati con velocità normale d'impatto, direzione, punto di contatto, tipo di ostacolo (muro, guardrail, palo, auto), fra auto del giocatore, traffico, pattuglie e mondo.
- Riparazione con il pulsante «Ripara l'auto».
Nulla di questo è stato rimosso.

## Cosa è stato aggiunto
### Componenti meccanici (integrità 0–1), derivati dalla rete deformata
| Componente | Governato da | Effetto reale |
|---|---|---|
| Radiatore | schiacciamento frontale (fC), fianco del muso | scambio termico ridotto (`mod.radiatore`), **perdita di refrigerante** nel tempo → temperatura che sale → modalità ridotta EMS → **danno termico** al motore |
| Motore | `engine` della rete (mozzi arretrati, muso schiacciato) + danno termico | potenza ridotta (`mod.potenza`: 0,3+0,7·integrità; sotto 6 % motore fuori uso), P0300 |
| Cambio e trasmissione | schiacciamento frontale forte, zona anteriore sinistra | cambiate più lente, TCU limita le marce o blocca il cambio, rendimento ridotto |
| Sterzo | convergenza dei mozzi anteriori, ruota persa | corsa dello sterzo ridotta e tiraggio laterale |
| Sospensioni ×4 | campanatura/convergenza e perdita di ciascun mozzo | attrito di avanzamento (220 N per sospensione piegata); l'inclinazione visiva la fa già il gioco |
| Freni ×4 | spostamento del mozzo, ruota persa | forza frenante per ruota ridotta nella ripartizione reale |
| Batteria | muso schiacciato, zona anteriore sinistra | tensione bassa, avviamento difficile, perdite |
| Impianto elettrico | muso schiacciato, zone anteriori | alternatore ridotto, bus CAN con errori, sotto il 15 % bus-off, centraline offline |
| Scarico | coda schiacciata, fianchi | segnalato (nessun effetto di potenza oltre lo stato: rumore non modellato) |
| Serbatoio | coda e fianchi schiacciati | **perdita di carburante** proporzionale (fino a ~110 L/h) e P0087 |
| Sensori ruota ×4 | mozzo storto o perso | ABS/ASR/ESC disattivati con spie |
| Fari e fanali | rete (lampF/lampR) | codici BCM |
| Pneumatici ×4 | stato gomme del gioco | come prima (aderenza, rotolamento) + pressione/usura nel motore fisico |
| Struttura ×6 zone | zone della rete | costo di carrozzeria |

Tutte le soglie sono in `IOW_DANNI.SOGLIE`, i costi in `IOW_DANNI.COSTI` (centesimi, **prezzi indicativi di gioco**, non listini reali). Il danno è **monotono**: non migliora da solo, solo con le riparazioni.

### Storico degli urti ed energia
Ogni urto del giocatore registra faccia colpita, velocità normale, tipo di ostacolo e **energia stimata** ½·m·v_n² (etichettata come stima del modello). Il pannello «Danni» distingue esplicitamente le stime del modello dai dati verificati (non ce ne sono: nessun crash test reale).

### Riparazioni
- **Emergenza** (pulsante «Ripara l'auto», gratuito come prima): carrozzeria, vetri, gomme e ribaltamento come prima; i componenti meccanici risalgono **solo fino al 70 %**; niente rabbocco del refrigerante né cancellazione dei codici.
- **Officina** (pannello 🚗 → Danni e officina): da fermo in un'officina (`shop=car_repair` di OpenStreetMap) o da un benzinaio; preventivo per componente con costo proporzionale al danno; «Ripara tutto» rimette a nuovo carrozzeria, meccanica, refrigerante e cancella i codici memorizzati. Paga in euro dal portafoglio del gioco.

### Persistenza
Nel salvataggio (`S.veicolo`): componenti, refrigerante, danno termico, storico urti; **la rete deformata** (posizioni dei nodi, travi rotte, nodi liberi, energia) e lo stato delle gomme. Al caricamento la carrozzeria viene ridisegnata deformata e i codici di guasto memorizzati tornano in diagnosi. **Non** vengono salvati: parti già staccate e volate via, frammenti di vetro a terra, incendio in corso, fumo (si ricostruiscono dalla rete: le parti incernierate ricompaiono attaccate).

### Prestazioni
Nessun nuovo costo per fotogramma rilevante: i componenti si ricalcolano con poche decine di operazioni; il modello dettagliato resta quello già presente (rete + LOD + coda con budget).

## Limiti dichiarati
- Nessuna calibrazione con dati di crash test: deformazioni, energie e soglie sono del modello di gioco.
- Non modellati: temperatura dei freni, rumore dello scarico, perdita d'olio, airbag, danni all'abitacolo, usura meccanica a lungo termine.
- I danni delle auto del traffico e delle pattuglie restano quelli già presenti (carrozzeria), senza il livello meccanico.

## Verifica
`node test/run.js`: componenti integri senza deformazione; urto frontale (radiatore, batteria, cambio, elettrico, mozzo, sensore ruota, sterzo, freno del lato colpito), posteriore (scarico, serbatoio, perdita), laterale; monotonia; perdita di refrigerante e danno termico nel tempo; energia d'urto; preventivo e riparazione per componente, totale ed emergenza; serializzazione. Prova nel browser (Chromium headless, 2026-11-02): urto a 60 km/h → fC 0,56 m, radiatore 0 %, motore 60 %, potenza 72 %, spie ABS/ESC/MIL; salvataggio 4,2 kB; dopo la ricarica deformazione e componenti identici; emergenza → meccanica 70 %; officina → 100 % con addebito.
