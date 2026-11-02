# Rilievo SINTETICO ma verosimile per Andorra (solo per le prove: non esiste un modello di quota scaricabile da qui).
# Fondovalle = quota dei paesi (valori approssimati dalla geografia nota), versanti al 45 % allontanandosi dai corsi d'acqua di OpenStreetMap,
# cime al massimo a 2900 m. Serve a mettere alla prova il programma delle celle con strade di montagna vere (tornanti, ponti, gallerie, paesi).
import sys, os, math, json, numpy as np
from PIL import Image
from scipy.spatial import cKDTree
B = (os.environ.get('DATI') or os.path.dirname(os.path.abspath(__file__)) + '/..') + '/'
OUT = B + 'next/real_test_andorra/'
VILL = {'Sant Julià de Lòria': 908, 'Andorra la Vella': 1023, 'les Escaldes': 1050, 'Engordany': 1060, 'Santa Coloma': 970, 'La Margineda': 950, 'Aixovall': 930, 'Bixessarri': 1080, 'Fontaneda': 1220, 'Aubinyà': 1140, 'Juberri': 1250, 'Nagol': 1200, 'Certers': 1180, 'Aixirivall': 1120, 'Llumeneres': 1120, 'La Massana': 1230, 'Sispony': 1300, 'Anyós': 1300, 'Erts': 1350, 'Pal': 1550, 'Arinsal': 1470, 'Xixerella': 1480, 'Ordino': 1300, 'Sornás': 1360, 'Ansalonga': 1340, 'la Cortinada': 1330, 'Arans': 1370, 'Llorts': 1420, 'el Serrat': 1540, 'Segudet': 1300, 'Encamp': 1240, 'les Bons': 1270, 'Vila': 1300, 'Canillo': 1526, 'Prats': 1560, 'Meritxell': 1530, 'l’Aldosa de Canillo': 1550, 'Ransol': 1650, 'el Tarter': 1700, 'Soldeu': 1800, 'Sant Pere': 1700, 'Grau Roig': 2100, 'Engolasters': 1600, 'els Vilars': 1230, 'les Salines': 1050, 'Mas de Ribafeta': 1500, 'Puiol del Piu': 1600, 'Escàs': 1300, 'el Pui': 1330, 'el Vilar': 1420, "Mas d'en Soler": 1450, 'el Bosquet': 1300, 'el Cortalet': 1300, 'el Forn': 1600, 'els Plans': 1620, 'Sant Joan de Caselles': 1540, 'Super Pal': 1900, 'Aixàs': 1200}
src = json.load(open(os.path.dirname(os.path.abspath(__file__)) + '/geo.json'))   # {places:[[lon,lat,name]], water:[[lon,lat],...] (punti ogni ~15 m), peaks:[[lon,lat,ele]]}
R = 6378137.0
def merc(lon, lat): return np.array([lon * math.pi / 180 * R, np.log(np.tan(math.pi / 4 + np.radians(lat) / 2)) * R])
P = []; PH = []
for lon, lat, name in src['places']:
    if name in VILL: m = merc(lon, lat); P.append(m); PH.append(VILL[name])
P = np.array(P); PH = np.array(PH, np.float64)
W = np.array([merc(lo, la) for lo, la in src['water']]); kd = cKDTree(W)
PK = np.array([merc(lo, la) for lo, la, e in src['peaks']]); PKH = np.array([e for lo, la, e in src['peaks']], np.float64); kdp = cKDTree(PK)
def elev(lat, lon):
    x = lon * math.pi / 180 * R; y = np.log(np.tan(np.pi / 4 + np.radians(lat) / 2)) * R
    X = np.stack([x.ravel(), y.ravel()], 1)
    # fondovalle: media pesata (1/d²) delle quote dei paesi
    d2 = ((X[:, None, 0] - P[None, :, 0]) ** 2 + (X[:, None, 1] - P[None, :, 1]) ** 2) + 400.0
    w = 1.0 / d2; base = (w * PH[None, :]).sum(1) / w.sum(1)
    dw, _ = kd.query(X); h = base + .45 * dw
    dp, ip = kdp.query(X); cap = PKH[ip] + .3 * dp   # mai sopra la cima più vicina (più un margine lontano da essa)
    h = np.minimum(h, cap); h = np.minimum(h, 2900.0)
    return h.reshape(lat.shape)
def lon2x(lon, z): return (lon + 180) / 360 * (1 << z)
def lat2y(lat, z): r = math.radians(lat); return (1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * (1 << z)
from scipy.ndimage import gaussian_filter
# Il rilievo si calcola su un'unica griglia che copre tutte le tile (lisciatura e limite di pendenza sono operazioni "globali": tile calcolate
# una per una non coinciderebbero ai bordi), poi si ritaglia in tile z12 da 512 pixel.
def build(z, x0, x1, y0, y1):
    nx, ny = (x1 - x0 + 1) * 512, (y1 - y0 + 1) * 512
    i = (np.arange(nx) + .5) / 512; j = (np.arange(ny) + .5) / 512
    e = np.zeros((ny, nx))
    for r0 in range(0, ny, 64):   # a blocchi di righe (la media pesata sui paesi è pesante in memoria)
        X, Y = np.meshgrid(x0 + i, y0 + j[r0:r0 + 64]); lon = X / (1 << z) * 360 - 180
        lat = np.degrees(np.arctan(np.sinh(np.pi * (1 - 2 * Y / (1 << z))))); e[r0:r0 + 64] = elev(lat, lon)
    latm = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * ((y0 + y1 + 1) / 2) / (1 << z)))))
    # pendii verosimili: lisciatura (sigma 2,5 pixel ~ 35 m) e pendenza massima del 40 % (il rilievo vero a 14 m/pixel non ha pareti sotto le strade)
    e = gaussian_filter(e, 2.5)
    px = 2 * math.pi * R / (1 << z) / 512 * math.cos(math.radians(latm)); dmax = .40 * px
    def sh(a, dy, dx):
        P = np.pad(a, 1, mode='edge'); return P[1 + dy:1 + dy + a.shape[0], 1 + dx:1 + dx + a.shape[1]]
    for it in range(600):
        m = e.copy()
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)): m = np.minimum(m, sh(e, dy, dx) + dmax)
        for dy, dx in ((1, 1), (1, -1), (-1, 1), (-1, -1)): m = np.minimum(m, sh(e, dy, dx) + dmax * 1.4142)
        ch = np.abs(m - e).max(); e = m
        if ch < .01: break
    print('limite di pendenza: iterazioni', it + 1, 'passo massimo', round(float(max(np.abs(np.diff(e, axis=0)).max(), np.abs(np.diff(e, axis=1)).max())), 2), 'm/pixel')
    n = 0
    for x in range(x0, x1 + 1):
        for y in range(y0, y1 + 1):
            t = e[(y - y0) * 512:(y - y0 + 1) * 512, (x - x0) * 512:(x - x0 + 1) * 512]; d = t + 32768.0
            rgb = np.zeros((512, 512, 3), np.uint8); rgb[..., 0] = (d // 256); rgb[..., 1] = np.floor(d % 256); rgb[..., 2] = np.floor((d - np.floor(d)) * 256)
            p = OUT + 'dem/%d/%d/%d.webp' % (z, x, y); os.makedirs(os.path.dirname(p), exist_ok=True)
            Image.fromarray(rgb, 'RGB').save(p, 'WEBP', lossless=True); t.astype('<f4').tofile(OUT + 'dem/%d/%d/%d.f32' % (z, x, y)); n += 1
    return n
z = 12; n = build(z, int(lon2x(1.35, z)), int(lon2x(1.85, z)), int(lat2y(42.72, z)), int(lat2y(42.38, z)))
print('tile del rilievo', n, 'paesi usati', len(P), 'punti d\'acqua', len(W), 'cime', len(PK))
