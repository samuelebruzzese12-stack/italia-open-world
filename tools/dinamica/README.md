# Dinamica del veicolo e centraline (moduli Python di studio)

Moduli autonomi (Python 3, solo libreria standard). Parametri generici di una berlina da 1610 kg a trazione anteriore: **non** sono dati
di un costruttore e il modello **non** è validato su prove reali. Non sostituiscono il motore fisico del gioco (`motore/fisica_veicolo.js`,
`motore/ecu.js`): servono a studiare il comportamento con e senza controlli elettronici.

- `dinamica_7dof.py` — 7 gradi di libertà (vx, vy, r e le quattro ruote), trasferimento di carico, Magic Formula a scorrimento combinato,
  centralina a 200 Hz con ESP (frenata differenziale), ABS, TCS (PID) ed EBD, blackout sopra i 15 g. RK4 con 4 sotto-passi.
  Configurazione predefinita: passo fisso dt = 0,005 s (200 Hz, costante `DT`), 1610 kg, Iz = 2450 kg·m², partenza a 50 m/s (`V0`, 180 km/h).
  Ogni risultato ha la `telemetria` completa: un campione per passo (t, vx, β, r, ψ, λ delle 4 ruote, Mz dell'ESP, coppia tolta dal TCS, stato).
  `python3 dinamica_7dof.py` → uscita in `docs/test/dinamica_7dof_uscita.txt`.
- `vcu_ebs.py` — modello bicicletta a 60 Hz con scorrimento λ, imbardata di riferimento, ESP, TCS, ABS, EBD, temperatura degli pneumatici,
  blackout con il messaggio `[CENTRALINA KO] ABS/ESP Disattivati - Controllo puramente meccanico`. Uscita in `docs/test/vcu_ebs_uscita.txt`.

Risultati (manovra PIT sul paraurti posteriore a 180 km/h, sterzo dritto), come escono dal calcolo con Iz = 2450 kg·m² (dal 2026-11-09;
prima 2700):

| Scenario | Centralina operativa | Centralina in blackout (16 g) |
|---|---|---|
| 7-DoF, 3 kN, senza frenata | recupera: deriva max 24,3°, rotazione 46°, prosegue a 128 km/h | testacoda: 177° |
| 7-DoF, 3 kN, frenata a fondo subito dopo l'urto | si gira lo stesso (170°) | si gira (245°), 4 ruote bloccate |
| 7-DoF, 6 kN, frenata a fondo | si gira (434°) | si gira (568°), 3 ruote bloccate a fine prova |
| Bicicletta, 3 kN, frenata a fondo da 3 s (dopo il recupero) | controllata: deriva max 8,4°, rotazione 18,5° | testacoda: deriva 90°, rotazione 104° |

Nel modello la frenata a fondo **mentre** l'auto sta già ruotando fa girare anche quella con la centralina sana; frenando dopo il recupero
dell'ESP l'auto resta controllata. Le gomme non scoppiano in questi scenari (al massimo 79 °C, soglia 260 °C).

Test: `python3 tools/test_moduli_python.py` (13 test; 4 controllano la configurazione a 200 Hz e la telemetria campione per campione: un
campione ogni 5 ms, dopo l'urto a 16 g Mz dell'ESP e taglio del TCS a zero in ogni campione, λ = −1 su tutte le ruote per oltre 0,5 s, testacoda
oltre 150°; con la centralina sana nessuna ruota sotto λ = −0,5).
