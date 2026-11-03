# Costruzione della pagina del gioco (`index.html`)

La pagina pubblicata su GitHub Pages è un unico file `index.html` costruito da questa cartella. Fino alla versione 30 gli script di
costruzione esistevano solo nella cartella di lavoro di chi sviluppava: dalla versione 31 stanno qui, e la costruzione dal repository
produce la stessa pagina byte per byte.

```
python3 tools/build/build.py            # scrive index.html nella radice del repository
OUTP=/tmp/prova.html python3 tools/build/build.py   # oppure in un altro file
```
Serve Python 3 e il comando `patch` (per la patch del motore V29).

## Che cosa legge
- `w2/base.html`: la pagina di partenza (versione 10, con il modello dell'Alfa 159 — «Alfa Romeo 159 Sedan And Wagon» di Nieve5677,
  sketchfab.com, CC BY 4.0).
- `w2/*.js`, `w2/build_*.py`: i moduli aggiunti nelle versioni 11–28 (mondo, polizia, danni, rete deformabile, armi, mappa reale…) e le
  sostituzioni che li collegano (passi 1–63 di `build.py`).
- `../../sorgenti/mappa_reale/*.js`: generatore delle celle, caricatore, gioco sulla mappa reale, traffico (una sola copia, nel repository).
- `w2/patch_motore_v29.diff`, `../../sorgenti/patch_solver_v30.py`, `../../sorgenti/patch_mappa_v31.py`: passi 64–66 (motore fisico,
  centraline e danni meccanici; Vehicle Damage Solver; collisioni con la quota). Ogni patch si ferma se un'ancora manca: l'integrazione
  non può sparire in silenzio.
- `armi/catalogo_gioco.json`, `pub/armi/suoni2/*.mp3` (suoni delle armi, incorporati nella pagina), `dl_three/…/GLTFLoader.js`
  (three.js r128, licenza MIT). Autori e licenze di modelli e suoni delle armi: «Crediti» nell'armeria del gioco e `docs/RESOURCE_LICENSES.md`.

Scrive anche `h/page_script*.js` (copia dello script della pagina, per le prove): la cartella `h/` è esclusa da git.
