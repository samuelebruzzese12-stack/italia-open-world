# ECU virtuali e rete di bordo simulata (`motore/ecu.js`)

**Tutto ciò che è descritto qui è una simulazione software.** Nessuna centralina fisica è collegata o collegabile: il modulo non parla con hardware, non implementa driver CAN/LIN/Ethernet e non è conforme a norme (ISO 14229 UDS, AUTOSAR, ISO 11898). I modelli sono generici: nessun software o specifica proprietaria di un costruttore è stata usata.

## Centraline modellate

| ECU | Cosa fa nella simulazione | Codici di guasto (SAE J2012, codici generici pubblici) |
|---|---|---|
| **EMS** (motore) | legge giri, temperatura refrigerante e olio, pedale, pressione turbo, velocità (dal messaggio dell'ABS), tensione, carburante; impone limitatore, **modalità ridotta** (sensore temperatura guasto → valore sostitutivo 90 °C e potenza 60 %; refrigerante > 108 °C → 45 %; > 118 °C → 20 %; pedale implausibile → 30 %), spegne l'iniezione senza segnale giri o con tensione < 8 V | P0115/P0117/P0118, P0196-P0198, P0122/P0123, P0335, P0500, P0562/P0563, P0217, P0087, P0300, P0299, P0234, U0121 |
| **TCU** (cambio) | la logica del cambio automatico vive nel motore fisico; la TCU limita le marce con cambio danneggiato (< 60 % → max 3ª, < 35 % → max 2ª, < 12 % → bloccato) | P0700, P0730, P0711, P0702, U0100 |
| **ABS/ASR** | quattro sensori ruota con la velocità vera di ogni ruota (ω·Re dalla dinamica a 7 gradi di libertà); un sensore guasto o implausibile → ABS, ASR ed ESC **disattivati** con spie (come nei veicoli reali). I regolatori veri e propri (PID sullo scorrimento di picco della Magic Formula, EBD) sono in `motore/controllo_dinamica.js`: questa centralina ne decide l'abilitazione. **Blackout**: dopo un urto oltre 15 g il modulo ABS/ESP è offline (codice C1100, spie ABS ed ESC) fino alla riparazione delle centraline in officina | C0035, C0040, C0045, C0050, C0110, U0100, C1100 |
| **ESC** | ESP fisico in `motore/controllo_dinamica.js` (imbardata di riferimento r* = vx·δ/(L + Ku·vx²/g), momento correttivo PD applicato frenando una ruota, riduzione di coppia); qui stato, interventi e, come supervisione, taglio di coppia con deriva laterale > 6,5 m/s; richiede ABS e sensore di imbardata | C0196 |
| **BCM** (carrozzeria) | luci, portiere, livello carburante, **spie** (riserva, batteria, temperatura, ABS, ESC, avaria motore, MIL, portiera, freni), lampade dai fari rotti nella carrozzeria deformabile | B2425/B2426/B2430/B2431, B2450, B1000 |
| **BMS** (batteria 12 V) | tensione a vuoto e resistenza interna in funzione dello stato di carica, alternatore a motore acceso, consumo con luci e avviamento, batteria danneggiata → perdite e tensione bassa | B1900 |
| **GW** (gateway) | presenza (heartbeat) di ogni centralina sul bus; perdite di comunicazione; bus-off | U0001, U0100, U0101, U0121, U0140, U0111 |

Ogni centralina ha: identificativo, nome, tipo, versione HW/SW, stato (ok/degradato/guasto/offline), modo, sensori, uscite, parametri, codici (con stato attivo/memorizzato, conteggio, primo/ultimo rilevamento e **freeze frame**: giri, km/h, temperatura, carico, marcia, tensione, chilometraggio).

## Bus CAN simulato
Messaggi con identificativo, nome, mittente, periodo (10–1000 ms) e segnali: `0x0C0` stato motore, `0x0D0` cambio, `0x1A0` velocità ruote, `0x1A4` stabilità, `0x3B0` carrozzeria, `0x5A0` batteria, `0x7E0` gateway. Contatore messaggi ed errori, stato ok/errori/bus-off (impianto elettrico danneggiato o guasto iniettato). Il pannello mostra gli ultimi messaggi. **Non** è una codifica a bit conforme a un DBC: i segnali sono oggetti JavaScript.

## Diagnosi «tipo UDS»
Servizi ridotti sui modelli virtuali: lettura codici (0x19), cancellazione (0x14: **i codici attivi restano**, come con un tester vero, finché la causa non è rimossa), dati in tempo reale (0x22). Non conforme a ISO 14229, non funziona con hardware.

## Laboratorio guasti (solo virtuale)
Iniezione nei modelli: perdita o deriva di un sensore, valore implausibile, timeout di una centralina, interruzione del bus, tensione batteria imposta, anche a tempo. Ogni iniezione finisce nel registro eventi. Non esiste alcun percorso che mandi comandi a veicoli o centraline reali.

## Hardware (HIL): dichiarato NON disponibile
`IOW_ECU.hardware` espone stato `non collegato`, `disponibile: false`, elenco delle interfacce previste (CAN, CAN FD, LIN, Automotive Ethernet, UDS, XCP) e `collega()` che restituisce il motivo. Nessun adattatore (Vector, dSPACE, NI o altro) è implementato: la funzione esiste solo per dire la verità nell'interfaccia e per avere un punto di estensione futuro.

## Evidenze
`IOW_ECU.rapporto(rete)` produce un JSON con: natura (simulazione software), seme casuale (il rumore dei sensori è deterministico), tempo simulato, centraline con versioni/stati/sensori/uscite/codici, messaggi del bus definiti e inviati, batteria, guasti iniettati, statistiche (interventi ESC/ABS/ASR, modalità ridotte), registro eventi (ultimi 200) e limiti dichiarati. Dal pannello 🚗 → Rapporto si scarica il rapporto completo del veicolo (telemetria + ECU + danni + calibrazione).

## Verifica
`node test/run.js` copre: veicolo sano senza codici; perdita sensore temperatura (P0115, potenza limitata, codice memorizzato e cancellabile); codice attivo non cancellabile; surriscaldamento (P0217, modalità ridotta, spia); sensore ruota guasto (C0035, ABS/ASR/ESC spenti, poi riattivati); intervento ESC; perdita giri (motore spento e riavvio); timeout ABS (U0121 nel gateway e nel motore); bus-off e rientro; batteria scarica (tensione bassa, avviamento impedito, B1900); determinismo con lo stesso seme; rapporto esportabile.
