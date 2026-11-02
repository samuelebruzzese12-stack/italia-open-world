# Danni: carrozzeria deformabile (già nel gioco) + danni meccanici per componente (`motore/danni_meccanici.js`) + Vehicle Damage Solver (`motore/danni_solver.js`, `motore/profili_danno.js`)

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
- Non modellati: temperatura dei freni, perdita d'olio, airbag, danni all'abitacolo, usura meccanica a lungo termine.
- I danni delle auto del traffico e delle pattuglie restano quelli già presenti (carrozzeria), senza il livello meccanico; dalla versione 30 anche loro passano dal solver per l'energia d'urto (registro per veicolo), ma senza il modello delle ruote.

## Verifica
`node test/run.js`: componenti integri senza deformazione; urto frontale (radiatore, batteria, cambio, elettrico, mozzo, sensore ruota, sterzo, freno del lato colpito), posteriore (scarico, serbatoio, perdita), laterale; monotonia; perdita di refrigerante e danno termico nel tempo; energia d'urto; preventivo e riparazione per componente, totale ed emergenza; serializzazione. Prova nel browser (Chromium headless, 2026-11-02): urto a 60 km/h → fC 0,56 m, radiatore 0 %, motore 60 %, potenza 72 %, spie ABS/ESC/MIL; salvataggio 4,2 kB; dopo la ricarica deformazione e componenti identici; emergenza → meccanica 70 %; officina → 100 % con addebito.


---

# Vehicle Damage Solver (Versione 30) — `motore/danni_solver.js` + `motore/profili_danno.js`

Un solo punto di coordinamento fra i sistemi che il gioco aveva già. **Nessuna funzione esistente è stata riscritta o duplicata**: `dmgCrash`/`sbCrash` deformano la rete, `sbDerive` la misura, `sbEffects`/`crash.js` fanno gli effetti (vetri, pezzi, ruote, fumo, perdite, suoni), `danni_meccanici.js` decide la meccanica, `fisica_veicolo.js` e `ecu.js` la applicano. Il solver sta in mezzo e fa tre cose.

## 1. Architettura e flusso di un urto

```
rilevamento (push()/pdCollide, già nel gioco: velocità normale, punto, direzione, ostacolo)
   → carHit / dmgPair / dmgUnitCrash
   → VDS.evento  →  IOW_SOLVER.evento        massa effettiva, impulso, energia, restituzione, ripartizione, registro
   → dmgApply → dmgCrash(…, ev)  →  sbCrash(T, S, {u: ev.u})     T = modello della rete del profilo del veicolo
   → VDS.esito (lavoro plastico contabilizzato)  →  sbModel → sbEffects / crAfterCrash (vetri, pezzi, ruote, cerniere con soglie del profilo)
ogni fotogramma: VEHX.step → VDS.step → IOW_SOLVER.stato (zone) + componenti + passo (ruote)
   → interfaccia S → IOW_DANNI.aggiorna → VEH.mod (+ IOW_SOLVER.applicaMod: muRuota, vibrazione, stabilità) → IOW_ECU
   → dmgDrive → VDS.guida → CARDMG (vibrazione, morbidezza, tiro, tenuta) → posa del modello e suoni (crLoop)
```

Il ponte di gioco è l'oggetto `VDS` in `index.html` (subito dopo `SBT`). Senza i due moduli (`VDS.ok=false`) tutto funziona come nella versione 29: fattori storici di `dmgCrash` (0,92·v e 0,5·v), vecchio wrapper di `carHit` per lo storico, nessuna vibrazione.

## 2. Evento d'urto (`IOW_SOLVER.evento`)
Ingresso: velocità normale relativa di avvicinamento `vn` (è già quella che il gioco calcolava: `-vn` nel muro, `pdContact` fra auto), masse `m1`/`m2` (∞ per muro, palo, albero, terreno; per le altre auto la massa del modello × `u.mass` relativa), direzione e punto in coordinate auto, tipo di ostacolo, faccia colpita, faccia dell'altro veicolo, identificatore della coppia.
- massa effettiva `mEff = m1·m2/(m1+m2)`; energia normale `En = ½·mEff·vn²`; restituzione `e(vn) = e0 + (0,45−e0)·exp(−vn/4)` (urti lenti quasi elastici, veloci quasi plastici); impulso `J = (1+e)·mEff·vn`; energia dissipata `Ediss = En·(1−e²)`.
- ripartizione: contro un ostacolo la quota che l'ostacolo si tiene è del materiale (`MATERIALI`: muro 0, albero 0,08, palo 0,30, guardrail 0,45, terreno 0,15; pali e guardrail cedono di più oltre `cede` J); fra due veicoli il più cedevole assorbe di più: `E_propria = Ediss · F_altro/(F_propria+F_altro)` con le rigidezze relative delle facce del profilo (`facce`: ant 1, post 0,8, lato 0,6, tetto 0,7).
- `u = √(2·E_propria/M_rete)`: la rete viene schiacciata da una parete a velocità `u` e così dissipa esattamente l'energia che le spetta (prima: 0,92·v contro tutto, 0,5·v fra auto; i nuovi valori coincidono con i vecchi nei casi che erano tarati — muro, frontale fra uguali — e cambiano dove la fisica lo richiede: masse diverse, fianco contro muso, guardrail, albero).
- registro: lo stesso contatto ripetuto entro 0,12 s ed entro 1 m (stesso tipo, stessa coppia) non conta due volte: si fonde nel primo evento e alla rete arriva solo l'energia in più. `IOW_DANNI.urto` riceve l'energia propria (non più ½·m·v² grezza) una sola volta per evento; il vecchio wrapper di `carHit` che la contava di nuovo è stato rimosso.
- stima della forza media di schiacciamento dalla forza di snervamento della faccia (somma delle travi della rete, `VDS.forzaFaccia`: ant 204 kN, post 252 kN, lato 90 kN) → schiacciamento atteso e durata (solo informativi).
- gli ostacoli «albero» ora sono distinti dai pali (`dmgKind` → `tree`, impronta locale `SBIMP.tree`).

## 3. Zone strutturali nominate e profili per veicolo (`profili_danno.js`)
`classifica(T)` assegna ogni trave della rete esistente (467 travi, 88 nodi: **nessun nodo in più**) a una zona per tipo e stazione dei nodi:

| zona | tipo | travi | F_snerv media | come |
|---|---|---|---|---|
| paraurti_ant / paraurti_post | assorbimento | 8 / 8 | 17 / 15,5 kN | travi di attacco (tipo 11) alle stazioni 0 e 8 |
| muso | assorbimento | 52 | 10,3 kN | traversi, montanti e diagonali delle stazioni 0-1 |
| cofano | pannello | 8 | 19,5 kN | correnti della cintura nel muso (tipo 0, strato alto) |
| longheroni_ant | assorbimento | 8 | 45,5 kN | correnti del pavimento nel muso (tipo 0, strato basso) |
| vano_motore | assorbimento | 36 | 20,2 kN | stazione 2 (assale anteriore) fino alla paratia |
| abitacolo | rigida | 76 | 47,7 kN | paratia, cintura, traversi e montanti interni (stazioni 3-6) |
| montanti | rigida | 34 | 37,2 kN | montanti A/B/C, cornici, anelli (tipo 7) e montanti esterni inferiori |
| tetto | rigida | 29 | 29,3 kN | tipo 8 |
| porte | pannello | 56 | 23,6 kN | traversi deboli delle stazioni 4-5 e diagonali esterne dell'abitacolo |
| longheroni_post / bagagliaio | assorbimento | 4 / 76 | 46 / 13,7 kN | correnti e stazioni 7-8 |
| pianale | rigida | 28 | 124,4 kN | correnti del pavimento nell'abitacolo, traversi e diagonali del pavimento |
| vetri | vetro | 16 | 0,5 kN | tipo 9 |
| bracci | sospensione | 20 | 45 kN | tipo 10 (mozzi) |

Un **profilo** configura massa, tipo di struttura, `resistenza` e `rottura` per zona (moltiplicatori della forza di snervamento/rigidezza e dell'allungamento di rottura), rigidezze relative delle facce, componenti distaccabili (massa, resistenza, soglia, attacco) e componenti meccanici presenti. `template(T, profilo)` restituisce una **copia** del modello della rete con gli stessi nodi e le stesse travi e i soli parametri scalati (masse ripartite sui nodi): le funzioni esistenti la usano senza modifiche (`dmgCrash` e `rlCrash` prendono `own.sbT || SBT`). Profili inclusi: `predefinito` (= rete del gioco, moltiplicatori 1), `alfa_159_19_jtdm_150` (massa dal database, 1610 kg), `alfa_romeo_75` **importato dal JSON di esempio del progetto** con la convenzione dichiarata `resistenza = 2·deformationResistance`, `rottura = 2·breakThreshold`. **Nessun profilo è certificato** (`certificato:false`): i moltiplicatori sono parametri di gioco, non dati di prove d'urto.

## 4. Interfaccia soft-body → `danni_meccanici.js`
`IOW_SOLVER.statoStruttura(st, R, D, tyre, zone)` costruisce l'oggetto `S` di `IOW_DANNI.aggiorna` (prima lo assemblava il gioco a mano): `zones[6], fC, rC, sL, sR, fS, hubs[4]{dx,dy,dz,camber,toe,lost}, engine, wl[4], lampF, lampR, tyreF, tyreShred` e, nuovo, `zone` = `{id: {travi, rotte, snervate, integrita}}` per zona nominata (`IOW_SOLVER.stato(T,S,ZONE)`: ciclo sulle travi, 0,03 ms). `danni_meccanici.js` non legge mai la rete direttamente.

## 5. Meccanica (aggiunte a `danni_meccanici.js` 1.1.0, `fisica_veicolo.js` 1.1.0, `ecu.js`)
- nuovi componenti **frizione**, **differenziale** (nel cambio a trazione anteriore, nel ponte a trazione posteriore: usa `veh.par.trazione`) e **centraline** (scatola delle ECU nel vano motore), con soglie, costi, preventivo, riparazione e salvataggio;
- effetti reali: `mod.frizione` limita la coppia trasmissibile (`Twheel·frizione` quando il motore spinge), `mod.differenziale` la coppia che arriva alle ruote (0 = nessuna trazione), `centraline < 0,2` manda fuori linea le ECU non essenziali (`ecu.js`), `mod.muRuota[4]` aderenza per ruota (dal solver), `mod.vibrazione`/`mod.stabilita` informativi;
- le integrità sono sempre limitate a 0..1 (prima le somme di più contributi potevano scendere sotto zero).
- `urto()` accetta `energia` (energia propria dal solver) e `duplicato` (si somma senza creare un nuovo evento).

## 6. Sospensioni, ruote e pneumatici (`IOW_SOLVER.passo`)
Dai mozzi della rete (spostamento, campanatura, convergenza, perdita) e da `TYRE` (foratura, battistrada): per ruota **braccio**, **ammortizzatore**, **molla**, **mozzo**, **cerchio** (integrità in calo, permanente fino alla riparazione) → **aderenza per ruota** (campanatura, convergenza, cerchio ovalizzato, foratura, battistrada), **vibrazione** (cresce con la velocità: una volta per giro), **stabilità**, **ammortizzazione**, **tiro**. Ripartizione dichiarata per non calcolare nulla due volte: freni, corsa dello sterzo e attrito delle sospensioni piegate restano a `danni_meccanici.js`; gomme a terra alla guida restano a `TYRE.apply`; il solver aggiunge solo `muRuota` (fisica), `CARDMG.vib`, `CARDMG.soft` (beccheggio e rollio più ampi e lenti con ammortizzatori danneggiati), `CARDMG.pull += tiro`, `CARDMG.grip × (0,6+0,4·stabilità)`.

## 7. Componenti distaccabili (`profili_danno.COMPONENTI`)
Paraurti (12/11 kg), cofano (16), portellone (12), porte (24/20), specchietti (1,2), parabrezza/lunotto/finestrini (12/8/3), ruote (18), terminale di scarico (6): ognuno con massa, resistenza, soglia, punto di attacco (zona della rete), integrità (dalla zona di attacco, dallo stato della cerniera in `crash.js`) e stato di distacco (deciso dal gioco: `dmgDetach`, `dmgCut`, `dmgWheel`, `crPartGone`). Le soglie di cofano, portellone, porte e specchietti sono ora lette dal profilo (`VDS.soglia`) e **deterministiche**: la serratura salta quando l'intrusione supera la soglia (prima c'era una probabilità casuale). I pezzi volati via usano la fisica dei detriti già presente (`DEB`, limite 70/140 oggetti): nessun nuovo corpo fisico.
Il terminale di scarico non ha una mesh separata nel modello 3D: il suo stato è meccanico (`comp.scarico`) e sonoro (rumore basso modulato dai giri quando è sotto il 50 %).

## 8. Grafica e audio
Nessun nuovo sistema grafico: mesh deformate e normali (`sbSkin`/`dmgNormals`), ammaccature (`dmgDeform`), vetri (`dmgCut`/`dmgShards`), fumo, vapore, perdite, scintille, detriti e suoni d'urto restano quelli del gioco e rappresentano la rete reale. Il solver aggiunge solo ciò che mancava: vibrazione della scocca nella posa del modello (ampiezza dalla ruota danneggiata, frequenza dalla velocità), rollio/beccheggio «molli», rumore di ferraglia (`crLoop('rattle')`) e scarico rotto (`crLoop('scarico')`). La fisica resta separata dalla rappresentazione: il solver non tocca mai le mesh.

## 9. Prestazioni (misurate)
- Node (`test/run.js`, questa macchina): `passo` 0,005 ms, `stato` per zona 0,03 ms, `evento` 0,002 ms; una simulazione della rete a 50 km/h 6,6 ms (156 passi) — la rete era e resta il costo dominante, invariato.
- Chromium senza GPU: `VDS.step` 0,007-0,013 ms/fotogramma; `carHit` frontale a 50 km/h 104-137 ms compreso il primo legame del modello ad alto dettaglio (costo che c'era già: la rete gira nella coda con budget di 6 ms e la pelle in 60 000 vertici per fotogramma).
- Nessun nodo aggiunto alla rete, nessuna allocazione per fotogramma nel solver (stati riusati), tutto il lavoro pesante resta nelle code esistenti.

## 10. Persistenza
`S.veicolo.solver` (eventi recenti, energie, ruote, componenti, effetti) via `VEHX.serializza/ripristina`; le riparazioni dell'officina passano anche al solver (`VDS.ripara`: tutto, emergenza, singola ruota).

## 11. Test eseguiti (`node test/run.js`: 56 test, 0 falliti; risultati stampati alla fine del run)
Profili (classificazione completa, copia del modello, importazione JSON); muro (massa effettiva, impulso, restituzione, `u`); due veicoli (ripartizione, somma = dissipata, masse diverse); materiali; registro dei duplicati; **rete reale estratta da `index.html`**: frontale a 30/50 km/h (muso arretrato 0,225 → 0,665 m, permanente, progressiva, abitacolo/tetto/pianale > 0,9, coda e fianchi intatti), laterale a 40 km/h (intrusione 0,034 m, porte più colpite del pianale, muso intatto), due veicoli a 60 km/h relativi (49 kJ ciascuno, 33,6 kJ di lavoro plastico ciascuno, il contatto ripetuto non deforma di nuovo), bilancio energetico su 4 urti (lavoro plastico/energia propria = 0,64), palo sul fianco all'altezza della ruota (mozzo −5 cm, convergenza −0,15 rad → braccio 0,56, mozzo 0,44, cerchio 0,84, aderenza 0,79 sulla ruota colpita, vibrazione 0,15 a 25 m/s, μ per ruota applicato dal motore fisico), frontale a 70 km/h → motore 0,47, radiatore 0, frizione 0,01, differenziale 0,06, centraline 0 con accelerazione ridotta in `fisica_veicolo`, componenti distaccabili, riparazioni, salvataggio/ripristino, ribaltamento (tetto 0,89, montanti 0,80), prestazioni, compatibilità della pagina. In Chromium (pagina costruita, scena `test/browser_solver.js`, registro in `docs/test/v30_chromium.txt`): moduli caricati, profilo `alfa_159_19_jtdm_150` (1610 kg), frontale a 50 km/h (153 kJ propri, u 13,8, 138 kJ di lavoro plastico, muso 0,54 m, motore 0,63, zone e componenti aggiornati), 3 urti ripetuti → 1 evento + 2 duplicati, albero e auto sul fianco, passo per fotogramma, salvataggio/ripristino, riparazione, **urto guidando contro un muro con la catena reale** (passi di gioco sincroni: drive → push → carHit → solver → rete; 15 passi, 154,9 kJ propri, u 13,87, 137,8 kJ plastici, muso 0,535 m, storico meccanico aggiornato), funzionamento con il solver disattivato, 0 errori nella console.

## 12. Limiti dichiarati (cosa NON è stato possibile fare e perché)
- Nessun valore è calibrato su prove d'urto reali: energie, materiali, soglie e moltiplicatori sono del modello di gioco. Il JSON `alfa_romeo_75` è un esempio importato, non un profilo fisico.
- Una sola geometria della rete per tutte le auto (il gioco ha un solo modello 3D di auto): i profili cambiano massa e parametri, non la forma.
- Il terminale di scarico non esiste come pezzo separato nel modello 3D: niente distacco visivo.
- Le auto del traffico e delle pattuglie hanno il registro degli eventi del solver ma non il modello delle ruote né la meccanica (budget mobile).
- La rilevazione dei contatti resta quella del gioco (impronte in pianta, velocità normale): niente contatti 3D per punto di contatto in quota.
- In Chromium senza rete la mappa non si carica: la prova di guida contro il muro usa un muro sintetico e il ciclo di gioco senza disegno.
