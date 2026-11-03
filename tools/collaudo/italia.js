// Copertura dell'Italia in tile z14 (le stesse che scarica il gioco): contorno approssimato del territorio (penisola, Sicilia, Sardegna e
// isole maggiori) allargato di circa 5 km, per non perdere le coste. Qualche tile di confine dei paesi vicini entra lo stesso: costa solo tempo.
// Uso: node italia.js            → numero di tile e di celle
//      node italia.js lista      → una tile per riga "x y" (ordinate da nord a sud, da ovest a est)
const CONTORNI = {
  penisola: [[43.79, 7.53], [44.15, 7.62], [44.42, 6.88], [44.67, 7.0], [45.12, 6.62], [45.2, 6.9], [45.45, 7.1], [45.83, 6.82], [45.87, 7.17], [45.93, 7.87], [46.15, 8.1], [46.25, 8.03], [46.45, 8.45], [46.1, 8.72], [45.95, 8.68], [45.83, 9.03], [46.02, 9.08], [46.3, 9.27], [46.5, 9.33], [46.33, 9.67], [46.4, 10.05], [46.62, 10.1], [46.53, 10.45], [46.84, 10.47], [46.9, 11.0], [47.0, 11.5], [47.09, 12.2], [46.65, 12.73], [46.6, 13.4], [46.5, 13.72], [46.2, 13.65], [45.95, 13.62], [45.6, 13.9], [45.58, 13.72], [45.67, 13.38], [45.43, 12.4], [44.95, 12.55], [44.42, 12.3], [44.06, 12.6], [43.62, 13.52], [42.47, 14.22], [42.0, 15.0], [41.92, 16.18], [41.13, 16.87], [40.64, 17.95], [40.14, 18.52], [39.79, 18.36], [40.25, 17.85], [40.47, 17.2], [39.75, 16.5], [39.4, 17.15], [39.08, 17.13], [38.43, 16.58], [37.92, 16.06], [38.1, 15.64], [38.73, 16.15], [39.81, 15.79], [40.05, 15.4], [40.65, 14.75], [40.55, 14.25], [40.83, 14.25], [41.2, 13.57], [41.45, 12.62], [42.1, 11.79], [42.44, 11.21], [42.95, 10.5], [43.55, 10.3], [44.1, 9.82], [44.4, 8.93], [44.3, 8.48], [43.88, 8.03], [43.79, 7.53]],
  sicilia: [[38.27, 15.65], [37.85, 15.29], [37.5, 15.1], [37.07, 15.29], [36.69, 15.13], [36.75, 14.65], [37.06, 14.25], [37.28, 13.58], [37.65, 12.59], [38.02, 12.5], [38.13, 13.36], [38.04, 14.02], [38.22, 15.24], [38.27, 15.65]],
  sardegna: [[41.24, 9.19], [41.1, 9.55], [40.92, 9.5], [40.38, 9.7], [39.94, 9.7], [39.14, 9.52], [39.21, 9.11], [38.87, 8.64], [39.0, 8.4], [39.4, 8.4], [39.9, 8.5], [40.3, 8.47], [40.56, 8.31], [41.07, 8.25], [40.91, 8.71], [41.24, 9.19]],
};
// isole minori: centro e raggio (km)
const ISOLE = [[42.78, 10.27, 15], [40.55, 14.24, 4], [40.73, 13.9, 5], [38.53, 14.95, 22], [37.98, 12.2, 12], [35.51, 12.6, 7], [36.79, 11.99, 9], [42.43, 10.92, 5], [43.06, 9.85, 3], [42.13, 15.5, 5], [41.75, 15.98, 3], [41.2, 9.4, 8], [39.12, 8.3, 9]];
const BUF = 5;   // km
const km = (a, b, c, d) => { const R = 6371, p = Math.PI / 180, x = (d - b) * p * Math.cos((a + c) / 2 * p), y = (c - a) * p; return R * Math.hypot(x, y) };
const dentro = (lat, lon, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [ya, xa] = P[i], [yb, xb] = P[j]; if ((ya > lat) !== (yb > lat) && lon < (xb - xa) * (lat - ya) / (yb - ya) + xa) c = !c } return c };
const distLato = (lat, lon, P) => { let best = 1e9; for (let i = 0; i + 1 < P.length; i++) { const [a, b] = P[i], [c, d] = P[i + 1]; for (let k = 0; k <= 10; k++) { const t = k / 10; best = Math.min(best, km(lat, lon, a + (c - a) * t, b + (d - b) * t)) } } return best };
const inItalia = (lat, lon) => { for (const P of Object.values(CONTORNI)) if (dentro(lat, lon, P) || distLato(lat, lon, P) < BUF) return true; for (const [a, b, r] of ISOLE) if (km(lat, lon, a, b) < r + BUF) return true; return false };
const lon2x = (lon, z) => Math.floor((lon + 180) / 360 * 2 ** z), lat2y = (lat, z) => Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * 2 ** z);
const x2lon = (x, z) => x / 2 ** z * 360 - 180, y2lat = (y, z) => { const n = Math.PI - 2 * Math.PI * y / 2 ** z; return 180 / Math.PI * Math.atan(Math.sinh(n)) };
// tutte le tile z14 il cui centro (o uno spigolo) sta nel territorio allargato
function tileItalia() { const z = 14, out = [], x0 = lon2x(6.5, z), x1 = lon2x(18.7, z), y0 = lat2y(47.2, z), y1 = lat2y(35.3, z);
  for (let y = y0; y <= y1; y++) { const la = y2lat(y + .5, z), laN = y2lat(y, z), laS = y2lat(y + 1, z);
    for (let x = x0; x <= x1; x++) { const lo = x2lon(x + .5, z), loW = x2lon(x, z), loE = x2lon(x + 1, z);
      if (inItalia(la, lo) || inItalia(laN, loW) || inItalia(laN, loE) || inItalia(laS, loW) || inItalia(laS, loE)) out.push([x, y]) } }
  return out }
module.exports = { tileItalia, inItalia, lon2x, lat2y, x2lon, y2lat };
if (require.main === module) { const T = tileItalia(); if (process.argv[2] === 'lista') console.log(T.map(t => t.join(' ')).join('\n')); else console.log('tile z14:', T.length, '· celle z15:', T.length * 4) }
