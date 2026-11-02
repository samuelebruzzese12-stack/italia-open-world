#!/usr/bin/env python3
"""Prepara le texture del gioco (cartella tex/) a partire dalle texture PBR originali CC0 di Poly Haven e ambientCG.

Le immagini sorgente NON sono in questa repository (sono grandi): lo script le legge da una cartella --ext che contiene
le copie scaricate (vedi tools/texture/sorgenti.json: per ogni file c'è il sito d'origine, la licenza, il repository
GitHub da cui è stata presa la copia e l'impronta SHA-256). Uscita: JPEG/PNG compatti per il telefono e tex/manifest.json.

Formati prodotti (letti da w2/real/real_main.js):
  *_c.jpg  colore (sRGB), con l'occlusione ambientale (AO) già moltiplicata dove la sorgente la fornisce
  *_n.jpg  R,G = normale (convenzione OpenGL, x e y in [-1,1] → [0,255]); B = rugosità (roughness) 0..255.
           La z della normale si ricostruisce nello shader: z = sqrt(1 - x² - y²).
  muri_*   atlante 2×2 di riquadri da 512 px: intonaco | mattoni / pietra (conci) | calcestruzzo
  ciuffi.png  atlante RGBA di 4 ciuffi d'erba (alfa ricavata dallo sfondo nero dell'atlante di Poly Haven)
  ambiente_*.jpg  panorami equirettangolari 1024×512 (HDR → LDR) per i riflessi (envMap)
Uso:  python3 tools/texture/prepara_texture.py --ext <cartella copie> --out tex
"""
import argparse, json, hashlib, os, math
import numpy as np
from PIL import Image
import cv2

A = argparse.ArgumentParser()
A.add_argument('--ext', required=True)
A.add_argument('--out', default='tex')
A.add_argument('--src', default=os.path.join(os.path.dirname(__file__), 'sorgenti.json'))
args = A.parse_args()
EXT, OUT = args.ext, args.out
os.makedirs(OUT, exist_ok=True)
SRC = json.load(open(args.src))
FILES = {f['id']: f for f in SRC['file']}
used = {}

def path(fid):
    f = FILES[fid]; p = os.path.join(EXT, f['copia'])
    h = hashlib.sha256(open(p, 'rb').read()).hexdigest()
    if f.get('sha256') and f['sha256'] != h:
        raise SystemExit('impronta diversa per ' + fid + ': ' + h)
    f['sha256'] = h; used[fid] = f
    return p

def rgb(fid):
    return np.asarray(Image.open(path(fid)).convert('RGB'), dtype=np.float32) / 255.

def gray(fid, ch=None):
    im = Image.open(path(fid))
    if ch is not None:
        return np.asarray(im.convert('RGB'), dtype=np.float32)[..., ch] / 255.
    return np.asarray(im.convert('L'), dtype=np.float32) / 255.

def down(a, n):
    """riduzione per fattori interi (media di blocchi): conserva la ripetibilità della texture"""
    h = a.shape[0]
    if h == n: return a
    if h % n == 0:
        return cv2.resize(a, (n, n), interpolation=cv2.INTER_AREA)
    # fattore non intero: si ripete la texture 3×3, si ridimensiona e si ritaglia il centro
    t = np.concatenate([a] * 3, 1); t = np.concatenate([t] * 3, 0)
    r = cv2.resize(t, (n * 3, n * 3), interpolation=cv2.INTER_AREA)
    return r[n:2 * n, n:2 * n]

def nrm_tex(fid):
    a = rgb(fid) * 2 - 1
    return a

def nrm_from_h(h, s):
    """normale (convenzione OpenGL) da una mappa di altezza ripetibile"""
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * .5
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * .5
    n = np.dstack([-dx * s, dy * s, np.ones_like(h)])
    return n / np.linalg.norm(n, axis=2, keepdims=True)

def renorm(n):
    n = n.copy(); n[..., 2] = np.maximum(n[..., 2], .05)
    return n / np.linalg.norm(n, axis=2, keepdims=True)

def u8(a): return np.clip(np.round(a * 255), 0, 255).astype(np.uint8)

def save(name, a, q=84):
    p = os.path.join(OUT, name)
    if name.endswith('.png'): Image.fromarray(u8(a)).save(p, optimize=True)
    else: Image.fromarray(u8(a)).save(p, quality=q, optimize=True, progressive=True)
    return name

def pack(n, r):
    n = renorm(n)
    return np.dstack([n[..., 0] * .5 + .5, n[..., 1] * .5 + .5, np.clip(r, 0, 1)])

def adjust(c, sat=1., gain=1., tint=(1, 1, 1), gamma=1.):
    l = (c * [.299, .587, .114]).sum(2, keepdims=True)
    c = l + (c - l) * sat
    c = np.clip(c * gain * np.array(tint, dtype=np.float32), 0, 1)
    return c ** gamma

MAN = {'descrizione': 'Texture del gioco preparate da tools/texture/prepara_texture.py a partire da texture CC0', 'texture': {}}
def reg(key, files, uso, metri, sorgenti, lavorazione):
    MAN['texture'][key] = {'file': files, 'uso': uso, 'lato_m': metri, 'sorgenti': sorgenti, 'lavorazione': lavorazione}

# ---------------------------------------------------------------- strade e marciapiedi
def simple(key, cid, nid, rid, aoid, n, metri, uso, adj=None, aoamt=.7, nflipG=False, rough_from=None, rgh_gain=1.):
    c = down(rgb(cid), n)
    if aoid:
        ao = down(gray(aoid, 0) if FILES[aoid].get('canale_ao') == 'R' else gray(aoid), n)
        c = c * (1 - aoamt + aoamt * ao[..., None])
    if adj: c = adj(c)
    nn = down(nrm_tex(nid), n)
    if nflipG: nn[..., 1] *= -1
    if rid:
        r = down(gray(rid, 1) if FILES[rid].get('canale_r') == 'G' else gray(rid), n)
    else: r = np.full(c.shape[:2], .85, np.float32)
    r = np.clip(r * rgh_gain, 0, 1)
    f = [save(key + '_c.jpg', c), save(key + '_n.jpg', pack(nn, r), 88)]
    reg(key, f, uso, metri, [x for x in (cid, nid, rid, aoid) if x], 'riduzione a %d px; AO moltiplicata nel colore; normale+rugosità impacchettate' % n)
    return c, nn, r

simple('asfalto', 'asphalt_02_diff', 'asphalt_02_nor', 'asphalt_02_rough', 'asphalt_02_arm', 512, 3.0,
       'carreggiate in asfalto (colore + normali + rugosità, coordinate del mondo)', adj=lambda c: adjust(c, .9, 1.02))
simple('lastre', 'concrete_pavement_diff', 'concrete_pavement_nor', 'concrete_pavement_rough', None, 512, 3.0,
       'marciapiedi in lastre e piazze', adj=lambda c: adjust(c, .85, 1.08))
simple('sterrato', 'coast_sand_01_diff', 'coast_sand_01_nor', 'coast_sand_01_arm', 'coast_sand_01_arm', 512, 2.0,
       'strade sterrate e strade bianche', adj=lambda c: adjust(c, .8, 1.12, (1.02, 1., .95)))
# porfido (sampietrini a coda di pavone): solo il colore è disponibile → altezza dalla luminosità
c = down(rgb('paving_stones_050_color'), 512)
l = cv2.GaussianBlur((c * [.3, .59, .11]).sum(2), (0, 0), 1.2)
hm = np.clip((l - .18) / .32, 0, 1) ** .8
# fughe: dove la luminosità è bassa (bitume e sabbia scura fra i cubetti)
n_ = nrm_from_h(hm, 5.0)
r_ = .62 + .3 * (1 - hm)
save('porfido_c.jpg', adjust(c, .95, 1.05)); save('porfido_n.jpg', pack(n_, r_), 88)
reg('porfido', ['porfido_c.jpg', 'porfido_n.jpg'], 'centri storici e zone pedonali (cubetti di porfido a coda di pavone)', 2.0,
    ['paving_stones_050_color'], 'normale e rugosità ricavate dalla luminosità (la sorgente è solo colore)')
# ghiaia / massicciata: calcestruzzo con ghiaia, normale dalla mappa di spostamento
c = down(rgb('gravel_concrete_03_diff'), 512); dh = down(gray('gravel_concrete_03_disp'), 512); rr = down(gray('gravel_concrete_03_rough'), 512)
save('ghiaia_c.jpg', adjust(c, .7, 1.1)); save('ghiaia_n.jpg', pack(nrm_from_h(dh, 7.0), rr), 88)
reg('ghiaia', ['ghiaia_c.jpg', 'ghiaia_n.jpg'], 'massicciata dei binari, piazzali, tetti piani in ghiaia', 2.0,
    ['gravel_concrete_03_diff', 'gravel_concrete_03_disp', 'gravel_concrete_03_rough'], 'normale ricavata dalla mappa di spostamento')

# ---------------------------------------------------------------- terreno
def terr(key, base, n, nn_, metri, uso, adj):
    c = down(rgb(base + '_diff'), n)
    arm = down(rgb(base + '_arm'), n)
    c = c * (.35 + .65 * arm[..., 0:1])
    c = adj(c)
    nn = down(nrm_tex(base + '_nor'), nn_)
    r = down(arm[..., 1], nn_) if nn_ != n else arm[..., 1]
    save(key + '_c.jpg', c, 82); save(key + '_n.jpg', pack(nn, r), 86)
    reg(key, [key + '_c.jpg', key + '_n.jpg'], uso, metri, [base + '_diff', base + '_nor', base + '_arm'],
        'colore %d px con AO, normali %d px; correzione colore per i paesaggi italiani' % (n, nn_))
terr('erba', 'aerial_grass_rock', 1024, 512, 6.0, 'prati e incolti (strato erba del terreno)',
     lambda c: adjust(c, 1.25, 1.05, (.86, 1.0, .72), 1.0))
terr('roccia', 'rock_boulder_dry', 1024, 512, 4.0, 'pareti rocciose, pendii ripidi, montagne', lambda c: adjust(c, .75, 1.05))
terr('terra', 'forest_floor', 512, 512, 3.0, 'sottobosco, campi arati, terra battuta', lambda c: adjust(c, .55, .95, (1.0, .94, .86)))

# ---------------------------------------------------------------- tetti
simple('tetto', 'roof_09_diff', 'roof_09_nor', 'roof_09_rough', None, 512, 2.2,
       'tetti a falde in tegole di laterizio', adj=lambda c: adjust(c, 1.05, 1.06))

# ---------------------------------------------------------------- facciate: atlante 2×2
T = 512
pl_c = down(rgb('plaster001_color'), T); pl_n = down(nrm_tex('plaster001_nor'), T); pl_r = down(gray('plaster001_rough'), T)
pl_c = adjust(pl_c, .3, 1.0)
# l'intonaco prende il colore dell'edificio: si porta la media a 0.82 (il colore viene moltiplicato nello shader)
pl_c = np.clip(pl_c / pl_c.mean() * .82, 0, 1)
br_c = down(rgb('red_brick_diff'), T); br_ao = down(gray('red_brick_ao'), T); br_c = br_c * (.4 + .6 * br_ao[..., None])
br_n = down(nrm_tex('red_brick_nor'), T); br_r = down(gray('red_brick_rough'), T)
co_c = down(rgb('gravel_concrete_03_diff'), T); co_c = adjust(co_c, .5, 1.25); co_n = nrm_from_h(down(gray('gravel_concrete_03_disp'), T), 5.0); co_r = down(gray('gravel_concrete_03_rough'), T)
# pietra: conci squadrati (filari da 0,4 m su 2 m di lato) riempiti con la roccia rock_boulder_dry schiarita (pietra calcarea)
rk = down(rgb('rock_boulder_dry_diff'), 1024); rk = adjust(rk, .35, 1.25, (1.03, 1.0, .93)); rkn = down(nrm_tex('rock_boulder_dry_nor'), 1024)
rng = np.random.default_rng(7)
st_c = np.zeros((T, T, 3), np.float32); st_h = np.zeros((T, T), np.float32); st_n = np.zeros((T, T, 3), np.float32)
rows = 5; rh = T // rows; mort = 3
for r in range(rows):
    x = int(rng.integers(0, T)); total = 0; lens = []
    while total < T:
        L = int(rng.integers(int(T * .28), int(T * .48)))
        if T - total - L < int(T * .2): L = T - total
        lens.append(L); total += L
    for L in lens:
        ox, oy = int(rng.integers(0, 1024 - L)), int(rng.integers(0, 1024 - rh)); tone = .9 + rng.random() * .18
        for j in range(rh):
            yy = r * rh + j
            for i0 in range(L):
                xx = (x + i0) % T
                ed = min(i0, L - 1 - i0, j, rh - 1 - j)
                if ed < mort:
                    st_c[yy, xx] = (.55, .52, .47); st_h[yy, xx] = 0; st_n[yy, xx] = (0, 0, 1)
                else:
                    b = min(1, (ed - mort + 1) / 5.)
                    st_c[yy, xx] = rk[oy + j, ox + i0] * tone * (.82 + .18 * b)
                    st_h[yy, xx] = .6 + .4 * b
                    st_n[yy, xx] = rkn[oy + j, ox + i0]
        x = (x + L) % T
nb = nrm_from_h(cv2.GaussianBlur(st_h, (0, 0), 1.0), 9.0)
st_nn = renorm(np.dstack([nb[..., 0] + st_n[..., 0] * .6, nb[..., 1] + st_n[..., 1] * .6, nb[..., 2]]))
st_r = np.where(st_h > 0, .78, .92).astype(np.float32)
AC = np.zeros((2 * T, 2 * T, 3), np.float32); AN = np.zeros((2 * T, 2 * T, 3), np.float32)
for (ty, tx), (c_, n_, r_) in {(0, 0): (pl_c, pl_n, pl_r), (0, 1): (br_c, br_n, br_r), (1, 0): (st_c, st_nn, st_r), (1, 1): (co_c, co_n, co_r)}.items():
    AC[ty * T:(ty + 1) * T, tx * T:(tx + 1) * T] = c_; AN[ty * T:(ty + 1) * T, tx * T:(tx + 1) * T] = pack(n_, r_)
save('muri_c.jpg', AC, 86); save('muri_n.jpg', AN, 88)
reg('muri', ['muri_c.jpg', 'muri_n.jpg'], 'pareti degli edifici (atlante 2×2: intonaco, mattoni, conci di pietra, calcestruzzo)',
    [2.0, 2.0, 2.0, 2.0], ['plaster001_color', 'plaster001_nor', 'plaster001_rough', 'red_brick_diff', 'red_brick_ao', 'red_brick_nor', 'red_brick_rough',
                          'rock_boulder_dry_diff', 'rock_boulder_dry_nor', 'gravel_concrete_03_diff', 'gravel_concrete_03_disp', 'gravel_concrete_03_rough'],
    'intonaco desaturato (prende il colore dell\'edificio); conci di pietra composti a filari con la roccia rock_boulder_dry')

# ---------------------------------------------------------------- calcestruzzo (ponti, gallerie, muri) e muretti a secco
save('cemento_c.jpg', np.clip(co_c / co_c.mean() * .62, 0, 1), 84); save('cemento_n.jpg', pack(co_n, co_r), 88)
reg('cemento', ['cemento_c.jpg', 'cemento_n.jpg'], 'calcestruzzo di ponti, gallerie, muri di sostegno, spartitraffico', 2.0,
    ['gravel_concrete_03_diff', 'gravel_concrete_03_disp', 'gravel_concrete_03_rough'], 'luminosità normalizzata (il colore viene dai vertici)')
# muretto a secco: pietre irregolari (Voronoi su toro) riempite con la roccia
M = 512; pts = rng.random((46, 2)) * M
yy, xx = np.mgrid[0:M, 0:M].astype(np.float32)
d1 = np.full((M, M), 1e9, np.float32); d2 = np.full((M, M), 1e9, np.float32); idx = np.zeros((M, M), np.int32)
for k, (px, py) in enumerate(pts):
    for ox in (-M, 0, M):
        for oy in (-M, 0, M):
            sx, sy = (px + ox) * 1.0, (py + oy) * 1.0
            d = np.sqrt(((xx - sx) * .8) ** 2 + (yy - sy) ** 2)
            m1 = d < d1; d2 = np.where(m1, d1, np.minimum(d2, d)); idx = np.where(m1, k, idx); d1 = np.where(m1, d, d1)
edge = d2 - d1
hmw = np.clip(edge / 9., 0, 1) ** .6
mw_c = np.zeros((M, M, 3), np.float32)
offs = rng.integers(0, 1024 - M, (len(pts), 2)); tones = .78 + rng.random(len(pts)) * .3
rkd = adjust(down(rgb('rock_boulder_dry_diff'), 1024), .5, 1.1)
for k in range(len(pts)):
    mk = idx == k
    oy, ox = offs[k]
    mw_c[mk] = rkd[oy:oy + M, ox:ox + M][mk] * tones[k]
mw_c = mw_c * (.25 + .75 * hmw[..., None])
mw_n = nrm_from_h(cv2.GaussianBlur(hmw, (0, 0), 1.2), 12.0)
save('muretto_c.jpg', mw_c, 84); save('muretto_n.jpg', pack(mw_n, .9 - .1 * hmw), 88)
reg('muretto', ['muretto_c.jpg', 'muretto_n.jpg'], 'muretti a secco lungo le strade di campagna', 1.6, ['rock_boulder_dry_diff'],
    'pietre irregolari (diagramma di Voronoi ripetibile) riempite con la roccia; fughe scure')

# ---------------------------------------------------------------- ciuffi d'erba (carte con trasparenza)
g = np.asarray(Image.open(path('grass_medium_01_diff_png')).convert('RGB'), dtype=np.float32) / 255.
# i ciuffi già disegnati in fondo all'atlante (coordinate nell'atlante 1024×1024; esclusa la fascia di pixel stirati alla base)
boxes = [(205, 762, 300, 150), (600, 772, 235, 115), (245, 907, 265, 90), (590, 882, 215, 115)]
atl = np.zeros((256, 1024, 4), np.float32)
for i, (x0, y0, w0, h0) in enumerate(boxes):
    crop = g[y0:y0 + h0, x0:x0 + w0]
    al = np.clip((crop.max(2) - .05) / .1, 0, 1)
    # colore dei pixel trasparenti = colore dei fili vicini (niente aloni scuri)
    cu = u8(crop); inv = (al < .5).astype(np.uint8)
    cu = cv2.inpaint(cu, inv, 5, cv2.INPAINT_TELEA).astype(np.float32) / 255.
    s = min(250 / w0, 250 / h0); W2, H2 = int(w0 * s), int(h0 * s)
    cc = cv2.resize(np.dstack([cu, al]), (W2, H2), interpolation=cv2.INTER_AREA)
    X = i * 256 + (256 - W2) // 2; Y = 256 - H2
    atl[Y:Y + H2, X:X + W2] = cc
atl[..., :3] = adjust(atl[..., :3], 1.1, 1.15)
Image.fromarray(u8(atl), 'RGBA').resize((512, 128), Image.LANCZOS).save(os.path.join(OUT, 'ciuffi.png'), optimize=True)
reg('ciuffi', ['ciuffi.png'], 'ciuffi d\'erba fitta vicino al giocatore (carte incrociate con trasparenza)', 0.6, ['grass_medium_01_diff_png'],
    'ritagliati i 4 ciuffi già disegnati in fondo all\'atlante del modello grass_medium_01; trasparenza dallo sfondo nero')

# ---------------------------------------------------------------- panorami per i riflessi
def env(key, fid, exp, uso):
    im = cv2.imread(path(fid), cv2.IMREAD_ANYDEPTH | cv2.IMREAD_COLOR)[..., ::-1].astype(np.float32)
    im = cv2.resize(im, (1024, 512), interpolation=cv2.INTER_AREA)
    x = im * exp; t = x * (1 + x / 36.) / (1 + x)
    save(key + '.jpg', np.clip(t, 0, 1) ** (1 / 2.2), 86)
    reg(key, [key + '.jpg'], uso, None, [fid], 'HDR ridotto a 1024×512 e convertito in LDR (Reinhard, esposizione %.2f)' % exp)
env('ambiente_citta', 'wide_street_01_hdr', 1.1, 'riflessi in città (carrozzerie, vetri, asfalto bagnato)')
env('ambiente_campagna', 'citrus_orchard_road_puresky_hdr', .55, 'riflessi fuori città (cielo sereno)')

MAN['sorgenti'] = [{k: v for k, v in f.items() if k != 'copia'} | {'copia_in': f['copia']} for f in used.values()]
json.dump(MAN, open(os.path.join(OUT, 'manifest.json'), 'w'), ensure_ascii=False, indent=1)
tot = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
print('fatto:', len(os.listdir(OUT)), 'file,', round(tot / 1024), 'KB')
