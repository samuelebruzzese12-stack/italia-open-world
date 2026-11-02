# Importa un file «Dati zona» salvato dal gioco (pulsante 📦 nella mappa) in una cartella di prova:
#   python3 importa_zona.py italia-open-world-zona-44.0_8.0.json cartella_di_uscita
# Scrive vt/14/x/y.pbf (tile vettoriali), dem/12/x/y.webp e .f32 (quote Terrarium decodificate), lc/14/x/y.png (WorldCover, se c'era) e zona.json.
import sys, json, base64, os, io
import numpy as np
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
z = json.load(open(src))
os.makedirs(out, exist_ok=True)
n = 0
for k, b in z.get('vt', {}).items():
    p = os.path.join(out, 'vt', k + '.pbf'); os.makedirs(os.path.dirname(p), exist_ok=True); open(p, 'wb').write(base64.b64decode(b)); n += 1
m = 0
for k, b in z.get('dem', {}).items():
    raw = base64.b64decode(b); p = os.path.join(out, 'dem', k + '.webp'); os.makedirs(os.path.dirname(p), exist_ok=True); open(p, 'wb').write(raw)
    im = np.asarray(Image.open(io.BytesIO(raw)).convert('RGB')).astype(np.float32)
    h = im[:, :, 0] * 256 + im[:, :, 1] + im[:, :, 2] / 256 - 32768   # codifica Terrarium (Mapterhorn)
    h.astype('<f4').tofile(os.path.join(out, 'dem', k + '.f32')); m += 1
for k, b in z.get('lc', {}).items():
    p = os.path.join(out, 'lc', k + '.png'); os.makedirs(os.path.dirname(p), exist_ok=True); open(p, 'wb').write(base64.b64decode(b))
json.dump({'pos': z['pos'], 'x14': z['x14'], 'y14': z['y14'], 'versione': z.get('versione'), 'quando': z.get('quando'), 'errori': z.get('errori', [])}, open(os.path.join(out, 'zona.json'), 'w'))
print('tile vettoriali', n, 'tile del rilievo', m, 'posizione', z['pos'], 'errori nel file', len(z.get('errori', [])))
