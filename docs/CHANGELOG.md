# Cronologia delle versioni

(La versione 28 — texture fotografiche, ciclo giorno/notte, chiese, rotatorie, aree di servizio, dati Copernicus — è descritta in docs/IMPLEMENTATION_REPORT.md.)

## Versione 29 — 2026-11-02 — motore fisico reale, centraline virtuali, danni meccanici
Implementato (codice in `motore/`, integrazione in `index.html`, test in `test/`):
- Database veicoli con fonte, unità, attendibilità e stato di verifica (Alfa Romeo 159 1.9 JTDm 150 CV; generici dimostrativi).
- Motore fisico: curva di coppia/potenza, carico parziale, attrito, minimo, limitatore, turbo, cambio 6 marce (automatico con TCU o manuale), frizione, trazione ant./post./integrale, resistenze aerodinamica/rotolamento/pendenza, trasferimento di carico, pneumatici parametrici (pressione, temperatura, usura, superfici, aquaplaning), ASR, freni con EBD e ABS, freno a mano, termica refrigerante/olio, consumo da BSFC, serbatoio e riserva, motore che si spegne senza carburante, hill holder, integrazione stabile a sottopassi.
- Centraline virtuali EMS/TCU/ABS/ESC/BCM/BMS/Gateway con sensori (rumore deterministico), codici di guasto SAE generici con freeze frame, modalità ridotte, spie, bus CAN simulato, diagnosi tipo UDS ridotta, laboratorio guasti solo virtuale, rapporto esportabile; interfaccia hardware dichiarata non disponibile.
- Danni meccanici per componente derivati dalla carrozzeria deformabile; perdita di refrigerante e carburante; danno termico; storico urti con energia stimata; preventivo e officina a pagamento; riparazione d'emergenza (gratuita, meccanica al 70 %); persistenza di danni, carrozzeria deformata, gomme, carburante, codici.
- Gioco: quadro strumenti (marcia, giri, carburante, temperatura, spie), pannello 🚗 a sei schede, benzinai e officine di OpenStreetMap sulla minimappa e per rifornimento/riparazioni, superficie reale sotto l'auto (strada, erba, ghiaia, neve...), pendenza dal rilievo reale.
- Calibrazione riproducibile (`node motore/calibrazione.js`): errore medio 5,5 % rispetto ai dati dichiarati; 38 test automatici (`node test/run.js`); prova in Chromium headless con three.js sostituito da uno stub (nessun errore di pagina; guida, urto, salvataggio/ricarica, riparazione, rifornimento verificati).
Non implementato o semplificato (dichiarato): modello Pacejka, motori ibridi/elettrici, pioggia e acqua sulla strada (il gioco non ha meteo), dinamica laterale completa, temperatura freni, HIL e hardware reale, validazione con misure su veicolo, danni meccanici del traffico e delle pattuglie.
Funzionalità precedenti preservate: se i moduli non si caricano il gioco usa il vecchio modello di guida.
