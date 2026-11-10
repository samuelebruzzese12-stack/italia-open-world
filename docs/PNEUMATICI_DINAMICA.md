# Pneumatici, dinamica a 200 Hz e centralina (versione 32)

Moduli: `motore/pneumatici_mf.js` (Magic Formula combinata), `motore/controllo_dinamica.js` (ABS, TCS, ESP, EBD, blackout),
`motore/fisica_veicolo.js` 2.0.0 (dinamica a 7 gradi di libertà). Collegamento alla pagina: `sorgenti/patch_pneumatici_v32.py`
(passo 67 di `tools/build/build.py`). Test: `test/pneumatici_dinamica.js` (23 test, dentro `node test/run.js`).
Misure: `node tools/dinamica/misure_js.js` → [`docs/test/pneumatici_dinamica_misure.txt`](test/pneumatici_dinamica_misure.txt).

**Stato: modello di simulazione per il gioco, non validato su prove reali.** I coefficienti del pneumatico sono di un pneumatico
stradale generico (vedi sotto), non del 215/55 R16 dell'Alfa 159.

## 1. Magic Formula combinata (struttura MF 5.2)

Per ogni ruota, con carico Fz, scorrimento longitudinale κ e deriva α (si usa tan α), dfz = (Fz − Fz0)/Fz0:

| Grandezza | Formula |
|---|---|
| Longitudinale pura | Fx0 = Dx·sin(Cx·atan(Bx·κ − Ex·(Bx·κ − atan(Bx·κ)))), Dx = (PDX1 + PDX2·dfz)·λμx·Fz, Bx = Kxκ/(Cx·Dx), Kxκ = Fz·(PKX1 + PKX2·dfz)·e^(PKX3·dfz) |
| Laterale pura | Fy0 = Dy·sin(Cy·atan(By·α − Ey·(By·α − atan(By·α)))), Dy = (PDY1 + PDY2·dfz)·λμy·Fz, Kyα = PKY1·Fz0·sin(2·atan(Fz/(PKY2·Fz0))) |
| Combinato | Fx = Gxα·Fx0, Gxα = cos(Cxα·atan(Bxα·α))/cos(Cxα·atan(Bxα·SHxα)), Bxα = RBX1·cos(atan(RBX2·κ)); Fy = Gyκ·Fy0 + SVyκ, Byκ = RBY1·cos(atan(RBY2·α)) |
| Autoallineante | Mz = −t·Fy' + Mzr + s·Fx, scia t = Dt·cos(Ct·atan(Bt·αeq − Et·(Bt·αeq − atan(Bt·αeq)))), αeq = √(α² + (Kxκ/Kyα)²·κ²) |
| Rilassamento | σα·d(tan α')/dt + \|Vx\|·tan α' = −Vy, σα = Kyα / C carcassa (1,6·10⁵ N/m); a bassa velocità tan α' resta entro il picco |
| Picco per i regolatori | κ* = argmax \|Fx(κ, α, Fz)\| della formula **combinata**, ricerca a sezione aurea (15–22 valutazioni, partendo dal κ* del ciclo prima) |

Il coefficiente d'attrito di ogni ruota (superficie × pressione × temperatura × usura × aquaplaning × danni, funzione `muRuota`) entra
come fattore di scala λμ della formula: così su bagnato, neve o ghiaccio cambiano picco, scorrimento di picco e forma della curva.

**Coefficienti** (`MF52_GENERICO`, dichiarati provvisori): struttura e ordine di grandezza del pneumatico d'esempio MF 5.2 della
letteratura (205/60 R15, 4000 N), scritti a memoria e non ricontrollati sul testo, simmetrizzati (conicità, sterzo da tele e campanatura
azzerati). Ritoccati per un pneumatico stradale: PEX1 0,60, PCY1 1,50, PEY1 −0,60, PKY1 21 (picco laterale a ~8° invece di ~15°),
RBX1 15 e RBY1 8 (la forza combinata usciva del 7 % dall'ellisse d'aderenza, ora ≤ 0,3 %), QEZ4 0. Risultato a 4740 N (carico statico
anteriore): κ* = −0,140, picco laterale a 8,0°, rigidezza di deriva 1246 N/grado, ruota bloccata al 73 % del picco.

**Strisciamento pieno.** Con |κ| oltre 0,25 la forza passa con continuità (fino a |κ| = 0,8) alla direzione opposta alla velocità di
strisciamento del contatto (attrito isotropo), con la stessa intensità della formula. Motivo: a κ = −1 le funzioni peso della MF 5.2
lasciano la forza lungo l'asse della ruota, e un'auto con le ruote anteriori sterzate e bloccate girava dalla parte opposta allo sterzo.
Con la correzione un'auto con le ruote bloccate non risponde allo sterzo (imbardata 0,02° contro 12,8° con l'ABS: misura 6).

## 2. Dinamica a 7 gradi di libertà a 200 Hz

Stato: vx, vy, r (imbardata) e ω delle quattro ruote. Passo fisso di 5 ms: il tempo di ogni fotogramma si accumula e si integra a passi
interi (60 fps → 3 o 4 passi, 37 fps → 5 o 6; un secondo è sempre 200 passi).

```
m·(v̇x − r·vy) = Σ(Fx,i·cos δi − Fy,i·sin δi) − F_aria − F_rotolamento − m·g·sin(pendenza) + F_esterna,x
m·(v̇y + r·vx) = Σ(Fx,i·sin δi + Fy,i·cos δi) + F_esterna,y
Iz·ṙ          = Σ(xi·Fy,i' − yi·Fx,i' + Mz,i) + M_esterno
Iw·ω̇i         = T_motrice,i − T_freno,i·sgn ωi − Re·Fx,i
```
- **Integrazione:** vx e le ω libere con Eulero all'indietro linearizzato, (M − h·J)·Δq = h·Q, dove J contiene dFx/dκ di ogni ruota
  (differenza finita sulla formula combinata) e M, con la frizione chiusa, l'inerzia del motore riportata alle ruote motrici
  (Ie·τ²·η/n² fra ogni coppia di ruote motrici: è il differenziale aperto con il motore). vy e r con Eulero semi-implicito.
- **Scorrimento:** κ = (ω·Re − Vx,ruota)/max(|Vx,ruota|, |ω·Re|, 1 m/s); con la ruota ferma e il veicolo oltre 1 m/s **κ = −1 esatto**.
- **Bloccaggio geometrico:** se il freno porta ω a zero (cambio di segno o |ω| < 0,05 rad/s) e la sua coppia trattiene quella che strada e
  motore applicano alla ruota, ω resta esattamente 0; si sblocca quando il freno non la trattiene più.
- **Carichi:** statico (ripartizione 60/40) + trasferimento longitudinale h·m·ax/L e laterale h·m·ay/carreggiata (55 % sull'anteriore),
  con accelerazioni filtrate a 70 ms. **Sterzo:** Ackermann al 50 %. **Freni:** capacità 1,25 × m·decelerazione massima (68/32),
  impianto con ritardo di 12 ms; freno a mano meccanico 1600 N·m per ruota posteriore, fuori dall'ABS.
- **Frizione:** in frenata decisa (pedale > 30 %) o con il freno a mano si apre (convertitore/conducente): le ruote motrici possono
  bloccarsi senza spegnere il motore.
- **Bassa velocità:** smorzamento laterale della carcassa sotto 4 m/s e logica di arresto: l'auto ferma resta ferma con zeri esatti
  (anche in pendenza al 15 %, con lo sterzo a fondo).

Parametri del veicolo (`motore/veicoli_db.js`, tutti con fonte e attendibilità): Iz 2450 kg·m², inerzia ruota 1,2 kg·m², carreggiate
1,584/1,579 m, Ackermann, ripartizione del rollio, coppia del freno a mano — provvisori.

## 3. Centralina: ABS, TCS, ESP, EBD (`motore/controllo_dinamica.js`)

| Regolatore | Legge | Guadagni |
|---|---|---|
| ABS (per ruota) | Tb = Tff + Kp·e + Ki·∫e + Kd·ė, e = κ − κ*, Tff = Re·\|Fx,picco\|, 0 ≤ Tb ≤ richiesta del pedale; entra oltre il picco, esce quando il pedale chiede meno del limite; ogni ruota con la propria velocità; spento sotto 1,5 m/s | Kp 9000, Ki 90 000, Kd 40 N·m, derivata filtrata a 8 ms |
| TCS (ruote motrici) | limite di coppia = n·Re·\|Fx,picco\| (ruota con meno aderenza) − PID(κ − κ*); BTCS: frena la ruota motrice che pattina più dell'altra | Kp 2500, Ki 40 000, Kd 15; BTCS Kp 5000, Ki 30 000 |
| ESP | r* = vx·δ/(L + Ku·vx²/g), \|r*\| ≤ 0,85·μ·g/vx; Mz = Kp·(r* − r) + Kd·ė (+ termine di deriva oltre 7°), zona morta 0,04 rad/s; frenata della ruota anteriore (70 %) e posteriore (30 %) del lato giusto, ΔTb = \|Mz\|/(carreggiata/2)·Re; riduzione di coppia | Kp 9000, Kd 300 (come `dinamica_7dof.py`) |
| EBD | Tb posteriore ≤ 0,75·μ·Fz·Re (parte del modulo ABS: senza ABS manca anche l'EBD) | — |

Ordine nel ciclo: TCS → ESP → EBD → ABS (l'ABS lavora sulla coppia finale, anche su quella dell'ESP). Anti-windup a integrazione
condizionata. Limite dichiarato: la velocità di riferimento è quella vera (nelle centraline reali è stimata).

### Blackout oltre 15 g
Ogni urto registrato dal Vehicle Damage Solver porta alla centralina l'accelerazione di picco: impulso a semi-seno,
a = (π/2)·Δv/durata, con Δv = impulso/massa e durata = 2·schiacciamento/velocità d'urto (dal solver; senza dati, schiacciamento
√(E/k) con k ≈ 1 MN/m). Ordini di grandezza: muro a 10 km/h ≈ 9 g, a 20 km/h ≈ 17 g, a 50 km/h 31–43 g (misura 7).
Sopra 15 g la centralina va in **BLACKOUT**: ABS, TCS, ESP ed EBD spenti, nessun regolatore calcola più nulla, le coppie frenanti del
pedale arrivano alle ruote così come sono: frenando le quattro ruote si bloccano (ω = 0, λ = −1 esatto: 3,5 s su 3,9 s di frenata da
100 km/h) e l'auto non sterza più. Nel gioco: messaggio «[CENTRALINA KO]», moduli ABS ed ESC offline nella rete di bordo (codice
C1100, spie ABS ed ESC), «Centraline elettroniche» danneggiate nel preventivo dell'officina; la riparazione (completa, della voce o
d'emergenza) riaccende la centralina. Il blackout resta nel salvataggio.

## 4. Nel gioco (`drive()`)
Prima: imbardata cinematica r = v·tan δ/2,7 e velocità laterale smorzata con un esponenziale; il motore fisico calcolava solo la dinamica
longitudinale. Ora `drive()` passa al motore fisico vx, vy e l'angolo di sterzo e ne riceve vx, vy e l'imbardata; le spinte della polizia e
i colpi contro gli ostacoli diventano un impulso d'imbardata che le gomme contrastano (o no, in blackout). Il quadro del pannello 🚗
mostra per ruota λ, α, Fz, Fx, Fy, ruota bloccata o in ABS, e deriva, imbardata, accelerazioni, sterzo e stato della centralina.
Senza i moduli la guida di riserva resta quella di prima. Prova dell'integrazione: `test/pneumatici_dinamica.js` esegue il codice vero di
`drive()` e di `VEHX` estratto da `index.html` (la pagina intera non si è potuta avviare in Chromium in questa sessione: three.js non era
raggiungibile).

## 5. Risultati principali (misure, 2026-11-10)
- Frenata 100-0 su asfalto: 43,6 m con ABS (errore medio |κ − κ*| 0,0007 con l'ABS attivo), 54,0 m a ruote bloccate o in blackout;
  bagnato 60,5 / 77,2 m; neve 132,9 / 178,9 m.
- Accelerazione 0-100: 10,27 s con TCS (κ medio 0,132 contro κ* 0,138), 11,47 s senza; neve: 22,7 s con TCS, senza non arriva a 100
  in 25 s. Su ghiaccio il TCS tiene meno bene (κ medio 0,094 contro κ* 0,027) per la definizione dello scorrimento a pochi km/h, ma
  l'auto arriva a 40 km/h contro 25.
- Curva: raggio a passo d'uomo 26,1 m (cinematico 25,7), sottosterzo (α anteriore > posteriore), aderenza laterale massima 0,84 g.
- Manovra PIT a 180 km/h, 3 kN per 0,5 s: centralina sana 20° di rotazione e riprende l'auto, in blackout testacoda (202°); come nel
  modello di studio Python (46° contro 177°). Con frenata a fondo durante la rotazione l'auto gira anche con la centralina sana (68°).
- Costo: 25–120 µs per fotogramma su un processore da server (circa 1 % di un fotogramma a 60 fps; su telefono qualche volta di più).

## 6. Non implementato (dichiarato)
Sospensioni a più gradi di libertà (beccheggio e rollio sono filtri del trasferimento di carico), campanatura e convergenza, effetto della
temperatura sulla forma della curva (solo sul μ), dinamica longitudinale della carcassa (rilassamento solo laterale), stima della
velocità di riferimento nell'ABS, coefficienti misurati del pneumatico reale.
