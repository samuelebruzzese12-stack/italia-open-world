/* Italia Open World — mappa reale: quote del terreno dalle tile Terrarium (512 px, quota = R·256 + G + B/256 − 32768).
   Campionamento bilineare sui centri dei pixel, anche a cavallo di due o quattro tile (bordi delle celle senza scalini). */
'use strict';
const ME = 40075016.68557849, MH = ME / 2;
// tile del rilievo che servono per campionare il rettangolo Mercatore [mx0,mx1]×[my0,my1] alla zoom zd (con un pixel di margine)
function demTilesFor(zd, mx0, my0, mx1, my1) { const n = 1 << zd, ts = ME / n, px = ts / 512, out = [];
  const tx0 = Math.floor((mx0 - px + MH) / ts), tx1 = Math.floor((mx1 + px + MH) / ts), ty0 = Math.floor((MH - my1 - px) / ts), ty1 = Math.floor((MH - my0 + px) / ts);
  for (let ty = Math.max(0, ty0); ty <= Math.min(n - 1, ty1); ty++) for (let tx = tx0; tx <= tx1; tx++) out.push([((tx % n) + n) % n, ty]); return out }
// funzione di quota: get(tx,ty) → Float32Array(512·512) oppure null (tile mancante: si usa la tile vicina disponibile o 0)
function makeDem(zd, get) { const n = 1 << zd, ts = ME / n, G = 512 * n, last = new Map();
  const tile = (tx, ty) => { const k = tx * 65536 + ty; if (last.has(k)) return last.get(k); const t = get(((tx % n) + n) % n, Math.max(0, Math.min(n - 1, ty))); last.set(k, t); return t };
  const px = (gx, gy) => { gy = Math.max(0, Math.min(G - 1, gy)); const tx = Math.floor(gx / 512), ty = Math.floor(gy / 512), t = tile(tx, ty);
    return t ? t[(gy - ty * 512) * 512 + (gx - tx * 512)] : NaN };
  return (mx, my) => { const fx = (mx + MH) / ts * 512 - .5, fy = (MH - my) / ts * 512 - .5, ix = Math.floor(fx), iy = Math.floor(fy), a = fx - ix, b = fy - iy;
    const v = [px(ix, iy), px(ix + 1, iy), px(ix, iy + 1), px(ix + 1, iy + 1)], w = [(1 - a) * (1 - b), a * (1 - b), (1 - a) * b, a * b]; let s = 0, sw = 0;
    for (let i = 0; i < 4; i++) if (v[i] === v[i]) { s += v[i] * w[i]; sw += w[i] }   // pixel di una tile mancante: media dei disponibili
    return sw > 0 ? s / sw : 0 } }
// decodifica di un'immagine Terrarium già letta in RGBA
function terrarium(rgba) { const out = new Float32Array(512 * 512); for (let i = 0, j = 0; i < out.length; i++, j += 4) out[i] = rgba[j] * 256 + rgba[j + 1] + rgba[j + 2] / 256 - 32768; return out }
if (typeof module !== 'undefined') module.exports = { demTilesFor, makeDem, terrarium, ME, MH };
