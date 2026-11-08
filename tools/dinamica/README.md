# Dinamica del veicolo e centraline (moduli Python di studio)

Moduli autonomi (Python 3, solo libreria standard). Parametri generici di una berlina da 1610 kg a trazione anteriore: **non** sono dati
di un costruttore e il modello **non** è validato su prove reali. Non sostituiscono il motore fisico del gioco (`motore/fisica_veicolo.js`,
`motore/ecu.js`): servono a studiare il comportamento con e senza controlli elettronici.

- `dinamica_7dof.py` — 7 gradi di libertà (vx, vy, r e le quattro ruote), trasferimento di carico, Magic Formula a scorrimento combinato,
  centralina a 200 Hz con ESP (frenata differenziale), ABS, TCS (PID) ed EBD, blackout sopra i 15 g. RK4 con 4 sotto-passi.
  `python3 dinamica_7dof.py` → uscita in `docs/test/dinamica_7dof_uscita.txt`.
- `vcu_ebs.py` — modello bicicletta a 60 Hz con scorrimento λ, imbardata di riferimento, ESP, TCS, ABS, EBD, temperatura degli pneumatici,
  blackout con il messaggio `[CENTRALINA KO] ABS/ESP Disattivati - Controllo puramente meccanico`. Uscita in `docs/test/vcu_ebs_uscita.txt`.

Risultati (manovra PIT sul paraurti posteriore a 180 km/h, sterzo dritto), come escono dal calcolo:

| Scenario | Centralina operativa | Centralina in blackout (16 g) |
|---|---|---|
| 7-DoF, 3 kN, senza frenata | recupera: deriva max 21°, rotazione 41°, prosegue a 134 km/h | testacoda: 175° |
| 7-DoF, 3 kN, frenata a fondo subito dopo l'urto | si gira lo stesso (167°) | si gira (162°), 3 ruote bloccate |
| 7-DoF, 6 kN, frenata a fondo | si gira (402°) | si gira (533°), 4 ruote bloccate |
| Bicicletta, 3 kN, frenata a fondo da 3 s (dopo il recupero) | controllata: deriva max 7,8°, rotazione 18° | testacoda: deriva 90°, rotazione 103° |

Nel modello la frenata a fondo **mentre** l'auto sta già ruotando fa girare anche quella con la centralina sana; frenando dopo il recupero
dell'ESP l'auto resta controllata. Le gomme non scoppiano in questi scenari (al massimo 79 °C, soglia 260 °C).

Test: `python3 tools/test_moduli_python.py` (9 test).
