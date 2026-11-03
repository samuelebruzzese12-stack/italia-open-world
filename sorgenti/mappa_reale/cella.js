/* Italia Open World — mappa reale: costruzione di una cella (tile z14 di OpenStreetMap / OpenMapTiles) in geometria 3D.
   Funzione pura: riceve gli strati già decodificati e una funzione di quota; restituisce array tipizzati pronti per three.js.
   Coordinate locali della cella: x = −est, z = −sud (cioè x verso ovest e z verso nord, come nel resto del gioco), y = quota in metri.
   L'origine è lo spigolo nord-ovest della cella; la cella misura S metri del gioco per lato. */
'use strict';
const CL = {   // classi del suolo (raster della cella)
  NONE: 0, WATER: 1, URBAN: 2, PARK: 3, WOOD: 4, FARM: 5, GRASS: 6, ROCK: 7, SAND: 8, ICE: 9, WET: 10, IND: 11, VINE: 12 };
const CCOL = [ [.44, .52, .30], [.22, .35, .40], [.46, .44, .41], [.36, .52, .26], [.20, .34, .17], [.60, .58, .36], [.42, .56, .28], [.52, .50, .47], [.78, .72, .56], [.92, .94, .97], [.38, .44, .30], [.52, .50, .48], [.46, .50, .26] ];
// larghezza della carreggiata (m) e stile dell'atlante strade (colonna): 0 asfalto senza segni, 1 doppio senso con mezzeria, 2 senso unico a più corsie,
// 3 pietra (zone pedonali), 4 sterrato, 5 massicciata ferroviaria, 6 marciapiede, 7 asfalto chiaro (parcheggi, servizio)
const RW = { motorway: [11.5, 2], trunk: [10, 2], primary: [9, 1], secondary: [8, 1], tertiary: [7, 1], minor: [6, 0], service: [4, 7], track: [3, 4], path: [2, 3], raceway: [9, 0], busway: [6, 0], bus_guideway: [5, 0], rail: [3, 5], transit: [2.2, 9] };
const RANK = { motorway: 9, trunk: 8, primary: 7, secondary: 6, tertiary: 5, minor: 4, service: 3, busway: 3, raceway: 3, track: 2, path: 1, rail: 2, transit: 10 };
const FAC = [0xd8b48a, 0xe2c79a, 0xc98f6a, 0xe8dcc2, 0xd9a183, 0xcfbf9f, 0xf0e6d0, 0xb8806a, 0xe0b878, 0xd6c6b0, 0xc4b8a8, 0xeadfc8];
function hsh(a, b) { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296 }
function hexRGB(s) { const n = parseInt(String(s).replace('#', ''), 16); return isFinite(n) ? [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255] : null }
function rgb(n) { return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255] }
const lin = c => c.map(v => v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4));   // i colori dei vertici vanno in spazio lineare
// costruttore di geometria: posizioni, normali, colori (lineari), uv opzionali, indici
function GB(uv) { this.P = []; this.N = []; this.C = []; this.U = uv ? [] : null; this.I = []; this.n = 0 }
GB.prototype.v = function (x, y, z, nx, ny, nz, c, u, w) { this.P.push(x, y, z); this.N.push(nx, ny, nz); this.C.push(c[0], c[1], c[2]); if (this.U) this.U.push(u || 0, w || 0); return this.n++ };
GB.prototype.quad = function (a, b, c, d) { this.I.push(a, b, c, a, c, d) };
GB.prototype.out = function () { if (!this.n) return null; const r = { P: new Float32Array(this.P), N: new Float32Array(this.N), C: new Float32Array(this.C), I: this.n > 65535 ? new Uint32Array(this.I) : new Uint16Array(this.I) }; if (this.U) r.U = new Float32Array(this.U); if (this.W) r.W = new Float32Array(this.W); return r };
// muro verticale fra (u0,v0) e (u1,v1) (coordinate est/sud) da y0 a y1; la normale punta verso l'esterno dell'anello
function wall(g, u0, v0, u1, v1, y0, y1, c, s0, fl, yb) { yb = yb || 0; const dx = u1 - u0, dz = v1 - v0, L = Math.hypot(dx, dz); if (L < .05 || y1 - y0 < .05) return; const nx = dz / L, nz = -dx / L, s1 = s0 + L;
  // in coordinate del gioco: x = −u, z = −v → la normale (nx,nz) diventa (−nx,−nz)
  const a = g.v(-u0, y0, -v0, -nx, 0, -nz, c, s0 / 3, (y0 - yb) / fl), b = g.v(-u1, y0, -v1, -nx, 0, -nz, c, s1 / 3, (y0 - yb) / fl), d = g.v(-u1, y1, -v1, -nx, 0, -nz, c, s1 / 3, (y1 - yb) / fl), e = g.v(-u0, y1, -v0, -nx, 0, -nz, c, s0 / 3, (y1 - yb) / fl);
  g.quad(a, e, d, b) }
// banda dell'atlante delle facciate (16 bande da 256 px su una testura 256×4096): v di una banda b
const NB = 18, bandV = b => [1 - (b + 1) / NB, 1 - b / NB];
// muro inclinato: in (u0,v0) va da b0 a t0, in (u1,v1) da b1 a t1 (segue la pendenza: niente gradini su guardrail, parapetti, bordi, muretti)
function wallS(g, u0, v0, u1, v1, b0, t0, b1, t1, c, s0, fl) { s0 = s0 || 0; fl = fl || 1; const dx = u1 - u0, dz = v1 - v0, L = Math.hypot(dx, dz); if (L < .05 || (t0 - b0 < .01 && t1 - b1 < .01)) return; const nx = dz / L, nz = -dx / L, s1 = s0 + L;
  const a = g.v(-u0, b0, -v0, -nx, 0, -nz, c, s0 / 3, b0 / fl), b = g.v(-u1, b1, -v1, -nx, 0, -nz, c, s1 / 3, b1 / fl), d = g.v(-u1, t1, -v1, -nx, 0, -nz, c, s1 / 3, t1 / fl), e = g.v(-u0, t0, -v0, -nx, 0, -nz, c, s0 / 3, t0 / fl);
  g.quad(a, e, d, b) }
// muro di un piano fra (u0,v0)-(u1,v1) da y0 a y1 con la banda b; s0 = ascissa curvilinea di partenza (u = s/3)
function wallB(g, u0, v0, u1, v1, y0, y1, c, s0, b, vfrac) { const dx = u1 - u0, dz = v1 - v0, L = Math.hypot(dx, dz); if (L < .05 || y1 - y0 < .05) return; const nx = dz / L, nz = -dx / L, s1 = s0 + L, bv = bandV(b), vlo = bv[0], vhi = vfrac === undefined ? bv[1] : vlo + (bv[1] - vlo) * vfrac;
  const a = g.v(-u0, y0, -v0, -nx, 0, -nz, c, s0 / 3, vlo), bb = g.v(-u1, y0, -v1, -nx, 0, -nz, c, s1 / 3, vlo), d = g.v(-u1, y1, -v1, -nx, 0, -nz, c, s1 / 3, vhi), e = g.v(-u0, y1, -v0, -nx, 0, -nz, c, s0 / 3, vhi);
  g.quad(a, e, d, bb) }
// triangolo orientato con la normale verso l'alto (o verso 'hint'), in coordinate est/sud con y; uv planari dati
function tri3(g, P, c, uv, hint) { const [a, b, d] = P, ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2]; let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
  // coordinate del gioco: x = −u, z = −v → normale (−nx, ny, −nz); la faccia deve guardare verso hint (default: alto)
  const hx = hint ? hint[0] : 0, hy = hint ? hint[1] : 1, hz = hint ? hint[2] : 0; let flip = (-nx) * hx + ny * hy + (-nz) * hz < 0; if (flip) { nx = -nx; ny = -ny; nz = -nz }
  const ids = P.map((p, i) => g.v(-p[0], p[1], -p[2], -nx, ny, -nz, c, uv ? uv[i][0] : 0, uv ? uv[i][1] : 0));
  // v31: (x, y, z) = (−u, y, −v) è una rotazione di 180° attorno all'asse verticale: l'orientamento NON si inverte. Prima qui l'ordine era a, c, b
  // salvo flip, cioè il contrario della normale dichiarata: tetti, falde, cime delle scatole, cupole e campanili guardavano verso il basso
  // (dall'alto gli edifici erano vuoti e i comignoli sospesi) e le facce chieste verso il basso guardavano in alto
  if (flip) g.I.push(ids[0], ids[2], ids[1]); else g.I.push(ids[0], ids[1], ids[2]) }
// rettangolo minimo orientato di un anello (coordinate est/sud): {cu, cv, ex, ez (asse lungo), L, W, area}
function obb(r) { let best = null; const n = r.length / 2;
  for (let q = 0; q < n; q++) { const ax = r[(q * 2 + 2) % r.length] - r[q * 2], az = r[(q * 2 + 3) % r.length] - r[q * 2 + 1], l = Math.hypot(ax, az); if (l < .3) continue; const ex = ax / l, ez = az / l;
    let a0 = 1e18, a1 = -1e18, b0 = 1e18, b1 = -1e18; for (let i = 0; i < r.length; i += 2) { const pa = r[i] * ex + r[i + 1] * ez, pb = -r[i] * ez + r[i + 1] * ex; if (pa < a0) a0 = pa; if (pa > a1) a1 = pa; if (pb < b0) b0 = pb; if (pb > b1) b1 = pb }
    const area = (a1 - a0) * (b1 - b0); if (!best || area < best.area) { const ca = (a0 + a1) / 2, cb = (b0 + b1) / 2; best = { area, L: a1 - a0, W: b1 - b0, ex, ez, cu: ca * ex - cb * ez, cv: ca * ez + cb * ex } } }
  if (best && best.W > best.L) { const t = best.L; best.L = best.W; best.W = t; const ex = -best.ez, ez = best.ex; best.ex = ex; best.ez = ez } return best }
// stili delle facciate: bande [piano terra, piani, ultimo piano], piani da 3,2 m (3,6 lo storico)
const ST = { STORICO: 0, CONDO: 1, UFFICI: 2, IND: 3, CASA: 4, PIETRA: 5 };
const STB = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [9, 10, 10], [11, 12, 12], [13, 14, 14]], SHOPB = 15;
const PAL = [[0xd9a86b, 0xc98a5a, 0xe3b98c, 0xd7b2a0, 0xe8cf9a, 0xcf9c74, 0xb9856a, 0xe6d3b3], [0xd9d4c8, 0xe6e2d8, 0xcfc8b8, 0xd6cfc0, 0xe2ddd0, 0xbdb6a8, 0xd8cab0, 0xe9e4da], [0xffffff, 0xf4f6f8, 0xe9edf2, 0xf7f7f7], [0xdcdcd8, 0xe4e4e0, 0xd0d4d8, 0xcfd6dd, 0xe0dcd4], [0xf1e4c8, 0xf5efe2, 0xe9c9a8, 0xf3d9b0, 0xe6dcc4, 0xf5e7d8], [0xd8c4a6, 0xc9ab86, 0xe0d2b8, 0xbf9d7d]];
function box(g, cu, cv, w, d, y0, y1, c) { const a = cu - w / 2, b = cu + w / 2, e = cv - d / 2, f = cv + d / 2; wall(g, a, e, b, e, y0, y1, c, 0, 1); wall(g, b, e, b, f, y0, y1, c, 0, 1); wall(g, b, f, a, f, y0, y1, c, 0, 1); wall(g, a, f, a, e, y0, y1, c, 0, 1);
  const i0 = g.v(-a, y1, -e, 0, 1, 0, c), i1 = g.v(-b, y1, -e, 0, 1, 0, c), i2 = g.v(-b, y1, -f, 0, 1, 0, c), i3 = g.v(-a, y1, -f, 0, 1, 0, c); g.quad(i0, i3, i2, i1) }
// insegne: categoria OpenMapTiles → [testo, sfondo, colore testo]; il nome vero del negozio, se c'è, va sull'insegna
const SIGN = { pharmacy: ['FARMACIA', '#0b7a3b', '#ffffff'], tobacco: ['TABACCHI', '#1b4fa3', '#ffffff'], cafe: ['BAR', '#5a2a16', '#f6e7c8'], bar: ['BAR', '#2a2a2e', '#f2d16b'], restaurant: ['RISTORANTE', '#7a1d1d', '#f6e7c8'], pizzeria: ['PIZZERIA', '#9a2b1f', '#fff1c9'], fast_food: ['TAVOLA CALDA', '#b8331f', '#ffffff'], ice_cream: ['GELATERIA', '#e86aa0', '#ffffff'], bakery: ['PANIFICIO', '#8a5a2b', '#fff3d6'], butcher: ['MACELLERIA', '#9c1b1b', '#ffffff'], grocery: ['ALIMENTARI', '#2f7d32', '#ffffff'], supermarket: ['SUPERMERCATO', '#d32f2f', '#ffffff'], convenience: ['ALIMENTARI', '#2f7d32', '#ffffff'], greengrocer: ['FRUTTA E VERDURA', '#3d8f2f', '#ffffff'], deli: ['GASTRONOMIA', '#7a4b1d', '#fff3d6'], clothing_store: ['ABBIGLIAMENTO', '#1f1f23', '#f4f4f4'], shoes: ['CALZATURE', '#3b2a1a', '#f4ead8'], jewelry: ['GIOIELLERIA', '#1a1a1a', '#e8c25a'], watches: ['OROLOGERIA', '#1a1a1a', '#e8c25a'], hairdresser: ['PARRUCCHIERE', '#5c2d91', '#ffffff'], beauty: ['ESTETICA', '#a03c7a', '#ffffff'], perfumery: ['PROFUMERIA', '#7b2d6b', '#ffffff'], optician: ['OTTICA', '#0d5c8a', '#ffffff'], bank: ['BANCA', '#0d3b66', '#ffffff'], atm: ['BANCOMAT', '#0d3b66', '#ffffff'], post_office: ['POSTE', '#f2c300', '#1a2a6c'], post: ['POSTE', '#f2c300', '#1a2a6c'], newsagent: ['EDICOLA', '#2a5d2a', '#ffffff'], kiosk: ['EDICOLA', '#2a5d2a', '#ffffff'], books: ['LIBRERIA', '#5a3b1a', '#f4ead8'], library: ['BIBLIOTECA', '#5a3b1a', '#f4ead8'], hardware: ['FERRAMENTA', '#4a4a4a', '#ffd23f'], doityourself: ['FERRAMENTA', '#4a4a4a', '#ffd23f'], electronics: ['ELETTRONICA', '#1b3a7a', '#ffffff'], mobile_phone: ['TELEFONIA', '#1b3a7a', '#ffffff'], furniture: ['ARREDAMENTO', '#5a4a3a', '#f4ead8'], florist: ['FIORI', '#2e7d32', '#ffd6e5'], gift: ['REGALI', '#8e3a7a', '#ffffff'], toys: ['GIOCATTOLI', '#e5542a', '#ffffff'], sports: ['ARTICOLI SPORTIVI', '#1565c0', '#ffffff'], travel_agency: ['AGENZIA VIAGGI', '#0277bd', '#ffffff'], estate_agent: ['AGENZIA IMMOBILIARE', '#1a3c6e', '#ffffff'], laundry: ['LAVANDERIA', '#1e88e5', '#ffffff'], dry_cleaning: ['LAVASECCO', '#1e88e5', '#ffffff'], car_repair: ['AUTOFFICINA', '#263238', '#ffd23f'], car: ['CONCESSIONARIA', '#263238', '#ffffff'], fuel: ['CARBURANTE', '#1b5e20', '#ffffff'], hotel: ['HOTEL', '#1a237e', '#f4e7b2'], lodging: ['HOTEL', '#1a237e', '#f4e7b2'], cinema: ['CINEMA', '#111111', '#ff3b30'], theatre: ['TEATRO', '#4a1030', '#f4e7b2'], dentist: ['STUDIO DENTISTICO', '#0d7a8a', '#ffffff'], doctors: ['STUDIO MEDICO', '#0d7a8a', '#ffffff'], veterinary: ['VETERINARIO', '#2e7d32', '#ffffff'], alcohol: ['ENOTECA', '#5a1a2a', '#f4e7b2'], pub: ['PUB', '#2a2a2e', '#f2d16b'], nightclub: ['CLUB', '#111111', '#e040fb'], confectionery: ['PASTICCERIA', '#b03a6a', '#fff3d6'], pastry: ['PASTICCERIA', '#b03a6a', '#fff3d6'], general: ['NEGOZIO', '#3a3a3a', '#ffffff'], variety_store: ['CASALINGHI', '#3a3a3a', '#ffffff'], mall: ['CENTRO COMMERCIALE', '#1a3c6e', '#ffffff'], department_store: ['GRANDI MAGAZZINI', '#1a3c6e', '#ffffff'], bicycle: ['BICICLETTE', '#2e7d32', '#ffffff'], motorcycle: ['MOTO', '#263238', '#ffffff'], tattoo: ['TATUAGGI', '#111111', '#ffffff'], pet: ['ANIMALI', '#6d4c41', '#ffffff'], bag: ['PELLETTERIA', '#3b2a1a', '#f4ead8'], police: ['POLIZIA', '#1f4e9e', '#ffffff'], fire_station: ['VIGILI DEL FUOCO', '#b71c1c', '#ffffff'], townhall: ['MUNICIPIO', '#5a4a3a', '#f4ead8'], school: ['SCUOLA', '#5a4a3a', '#f4ead8'], kindergarten: ['ASILO', '#5a4a3a', '#f4ead8'], university: ['UNIVERSITÀ', '#5a4a3a', '#f4ead8'], college: ['ISTITUTO', '#5a4a3a', '#f4ead8'], hospital: ['OSPEDALE', '#ffffff', '#c62828'], clinic: ['AMBULATORIO', '#ffffff', '#c62828'], museum: ['MUSEO', '#4a3a2a', '#f4ead8'], gallery: ['GALLERIA', '#4a3a2a', '#f4ead8'], station: ['STAZIONE', '#1a3c6e', '#ffffff'], taxi: ['TAXI', '#f2c300', '#111111'], marketplace: ['MERCATO', '#2f7d32', '#ffffff'], ticket: ['BIGLIETTERIA', '#1a3c6e', '#ffffff'], shop: ['NEGOZIO', '#3a3a3a', '#ffffff'] };
const SIGNCAT = p => SIGN[p.subclass] || SIGN[p.class] || null;
// scatola orientata: centro (cu,cv), asse lungo (du,dv) unitario, lunghezza w, profondità d, da y0 a y1
function obox(g, cu, cv, du, dv, w, d, y0, y1, c) { const px = -dv, pz = du, a = [cu - du * w / 2 - px * d / 2, cv - dv * w / 2 - pz * d / 2], b = [cu + du * w / 2 - px * d / 2, cv + dv * w / 2 - pz * d / 2], e = [cu + du * w / 2 + px * d / 2, cv + dv * w / 2 + pz * d / 2], f = [cu - du * w / 2 + px * d / 2, cv - dv * w / 2 + pz * d / 2];
  wall(g, a[0], a[1], b[0], b[1], y0, y1, c, 0, 1); wall(g, b[0], b[1], e[0], e[1], y0, y1, c, 0, 1); wall(g, e[0], e[1], f[0], f[1], y0, y1, c, 0, 1); wall(g, f[0], f[1], a[0], a[1], y0, y1, c, 0, 1);
  tri3(g, [[a[0], y1, a[1]], [b[0], y1, b[1]], [e[0], y1, e[1]]], c); tri3(g, [[a[0], y1, a[1]], [e[0], y1, e[1]], [f[0], y1, f[1]]], c);
  tri3(g, [[a[0], y0, a[1]], [e[0], y0, e[1]], [b[0], y0, b[1]]], c, null, [0, -1, 0]); tri3(g, [[a[0], y0, a[1]], [f[0], y0, f[1]], [e[0], y0, e[1]]], c, null, [0, -1, 0]) }
// balcone: lastra (sopra, davanti, sotto) e parapetto pieno (davanti, dietro, sopra); centro del bordo facciata (cu,cv), asse (du,dv), normale esterna (nx,nz)
function balc(g, cu, cv, du, dv, nx, nz, w, d, y, slabC, parC) { const a = [cu - du * w / 2, cv - dv * w / 2], b = [cu + du * w / 2, cv + dv * w / 2], e = [b[0] + nx * d, b[1] + nz * d], f = [a[0] + nx * d, a[1] + nz * d];
  tri3(g, [[a[0], y, a[1]], [b[0], y, b[1]], [e[0], y, e[1]]], slabC); tri3(g, [[a[0], y, a[1]], [e[0], y, e[1]], [f[0], y, f[1]]], slabC);
  tri3(g, [[a[0], y - .14, a[1]], [e[0], y - .14, e[1]], [b[0], y - .14, b[1]]], slabC, null, [0, -1, 0]); tri3(g, [[a[0], y - .14, a[1]], [f[0], y - .14, f[1]], [e[0], y - .14, e[1]]], slabC, null, [0, -1, 0]);
  wall(g, e[0], e[1], f[0], f[1], y - .14, y + 1.02, parC, 0, 1); const g0 = [f[0] - nx * .1, f[1] - nz * .1], g1 = [e[0] - nx * .1, e[1] - nz * .1]; wall(g, g0[0], g0[1], g1[0], g1[1], y, y + 1.02, parC, 0, 1);
  tri3(g, [[g0[0], y + 1.02, g0[1]], [g1[0], y + 1.02, g1[1]], [e[0], y + 1.02, e[1]]], parC); tri3(g, [[g0[0], y + 1.02, g0[1]], [e[0], y + 1.02, e[1]], [f[0], y + 1.02, f[1]]], parC) }
// ---- Versione 28: funzioni di supporto (rotatorie, edifici speciali, frecce, distributori)
// cerchio che meglio approssima una polilinea (metodo algebrico di Kåsa): [cu, cv, raggio, scarto quadratico medio]
function circFit(P, m) { let mx = 0, my = 0; for (let q = 0; q < m; q++) { mx += P[q * 2]; my += P[q * 2 + 1] } mx /= m; my /= m;
  let suu = 0, svv = 0, suv = 0, suuu = 0, svvv = 0, suvv = 0, svuu = 0;
  for (let q = 0; q < m; q++) { const u = P[q * 2] - mx, v = P[q * 2 + 1] - my; suu += u * u; svv += v * v; suv += u * v; suuu += u * u * u; svvv += v * v * v; suvv += u * v * v; svuu += v * u * u }
  const a = suu, b = suv, c = svv, d = .5 * (suuu + suvv), e = .5 * (svvv + svuu), det = a * c - b * b; if (Math.abs(det) < 1e-9) return null;
  const uc = (d * c - b * e) / det, vc = (a * e - b * d) / det, r = Math.sqrt(uc * uc + vc * vc + (suu + svv) / m); let res = 0;
  for (let q = 0; q < m; q++) { const dd = Math.hypot(P[q * 2] - mx - uc, P[q * 2 + 1] - my - vc) - r; res += dd * dd } return [uc + mx, vc + my, r, Math.sqrt(res / m)] }
// punto dentro un anello (coordinate della tile, scala k → metri)
function pipRing(r, k, u, v) { let ins = false; const n = r.length / 2; for (let i = 0, j = n - 1; i < n; j = i++) { const xi = r[i * 2] * k, yi = r[i * 2 + 1] * k, xj = r[j * 2] * k, yj = r[j * 2 + 1] * k; if (((yi > v) !== (yj > v)) && (u < (xj - xi) * (v - yi) / (yj - yi + 1e-12) + xi)) ins = !ins } return ins }
// colori dei marchi dei distributori (solo colori, nessun logo): [fascia, totem]
const BRAND = [[/eni|agip/i, '#f7d117', '#1c1c1c'], [/esso/i, '#d71920', '#0b3b8c'], [/q8|kuwait/i, '#0f4c9c', '#f39200'], [/\bip\b|api/i, '#0050a0', '#e30613'], [/tamoil/i, '#f39200', '#ffffff'], [/total/i, '#e30613', '#ffffff'], [/shell/i, '#ffd500', '#dd1d21'], [/repsol/i, '#ff8200', '#ffffff'], [/erg/i, '#00843d', '#ffffff'], [/.*/, '#1b5e20', '#ffffff']];
const brandOf = nm => { for (const b of BRAND) if (b[0].test(nm || '')) return b; return BRAND[BRAND.length - 1] };
function buildCell(L, opt) {
  const { S, mxL, myT, K, dem, lod, earcut, cx, cy } = opt, A = lod === 'A';
  const NG = opt.NG || (A ? 97 : 33), d = S / (NG - 1), CR = opt.CR || (A ? 128 : 32), WM = A ? 256 : 0, RHN = A ? (opt.RHN || 512) : 0, BLO = opt.blo === undefined ? 0 : opt.blo, BHI = opt.bhi === undefined ? 4096 : opt.bhi, BLOu = opt.blou === undefined ? BLO : opt.blou, BLOv = opt.blov === undefined ? BLO : opt.blov, BHIu = opt.bhiu === undefined ? BHI : opt.bhiu, BHIv = opt.bhiv === undefined ? BHI : opt.bhiv;
  const t0 = Date.now(), stat = {};
  const merc = (u, v) => [mxL + u / K, myT - v / K], hAt = (u, v) => { const m = merc(u, v); return dem(m[0], m[1]) };
  // --- quote del terreno sulla griglia
  const H = new Float32Array(NG * NG); for (let j = 0; j < NG; j++) for (let i = 0; i < NG; i++) H[j * NG + i] = hAt(i * d, j * d);
  const gh = (u, v) => { const fx = Math.min(NG - 1.0001, Math.max(0, u / d)), fy = Math.min(NG - 1.0001, Math.max(0, v / d)), i = Math.floor(fx), j = Math.floor(fy), a = fx - i, b = fy - j, p = j * NG + i;
    return H[p] * (1 - a) * (1 - b) + H[p + 1] * a * (1 - b) + H[p + NG] * (1 - a) * b + H[p + NG + 1] * a * b };
  // --- classi del suolo e maschera d'acqua
  const cls = new Uint8Array(CR * CR), widx = new Int16Array(CR * CR).fill(-1), wmask = WM ? new Uint8Array(WM * WM) : null, pri = [0, 9, 6, 5, 4, 3, 2, 3, 3, 4, 2, 6, 3];
  const ext0 = ly => (ly && ly.ext) || 4096;
  const setCls = (rings, ext, c) => fillPoly(rings, ext, CR, i => { if (pri[c] >= pri[cls[i]]) cls[i] = c });
  const LC = { wood: CL.WOOD, forest: CL.WOOD, farmland: CL.FARM, grass: CL.GRASS, rock: CL.ROCK, sand: CL.SAND, ice: CL.ICE, wetland: CL.WET };
  const LU = { residential: CL.URBAN, commercial: CL.URBAN, retail: CL.URBAN, industrial: CL.IND, railway: CL.IND, quarry: CL.ROCK, cemetery: CL.PARK, hospital: CL.URBAN, school: CL.URBAN, university: CL.URBAN, college: CL.URBAN, kindergarten: CL.URBAN, stadium: CL.PARK, pitch: CL.PARK, playground: CL.PARK, theme_park: CL.PARK, zoo: CL.PARK, military: CL.IND, garages: CL.URBAN, neighbourhood: CL.URBAN, suburb: CL.URBAN, quarter: CL.URBAN, dam: CL.IND, bus_station: CL.URBAN, library: CL.URBAN };
  const waters = [];
  for (const [name, map] of [['landcover', LC], ['landuse', LU], ['park', null]]) { const ly = L[name]; if (!ly) continue; const ext = ext0(ly);
    for (let i = 0; i < ly.n; i++) { const f = ly.feat(i); if (f.type !== 3) continue; let c;
      if (name === 'park') c = CL.PARK; else { c = map[f.props.class]; if (name === 'landcover') { const sc = f.props.subclass; if (sc === 'vineyard' || sc === 'orchard') c = CL.VINE; else if (sc === 'park' || sc === 'garden' || sc === 'golf_course' || sc === 'recreation_ground') c = CL.PARK; else if (sc === 'beach') c = CL.SAND; else if (sc === 'scree' || sc === 'bare_rock') c = CL.ROCK } }
      if (!c) continue; for (const p of polygons(f.parts)) setCls(p, ext, c) } }
  { const ly = L.water; if (ly) { const ext = ext0(ly); for (let i = 0; i < ly.n; i++) { const f = ly.feat(i); if (f.type !== 3 || f.props.brunnel === 'tunnel') continue; const cl = f.props.class || 'lake';
      for (const p of polygons(f.parts)) { const rings = p.map(r => clipRing(r, 0, ext)).filter(r => r.length >= 6); if (!rings.length) continue; waters.push({ cl, rings, ext });
        setCls(rings, ext, CL.WATER); { const wi = waters.length - 1; fillPoly(rings, ext, CR, k => { widx[k] = wi }) } if (wmask && cl !== 'swimming_pool') fillPoly(rings, ext, WM, k => { wmask[k] = 1 }) } } } }
  // --- copertura del suolo ESA WorldCover (Copernicus, Sentinel-1/2) dove OpenStreetMap non dice nulla
  // Versione 29: la classe "edificato" non si usa (marca anche le strade: diventava asfalto finto ovunque); neve solo sopra 2200 m e roccia sopra 1300 m
  // (più in basso "suolo nudo o vegetazione rada" diventa prato); i boschi presi da WorldCover sono meno fitti di quelli di OpenStreetMap
  const lcF = new Uint8Array(CR * CR);
  if (opt.lc && opt.lc.d) { const lc = opt.lc, N2 = lc.N / 2; let nlc = 0;
    for (let j = 0; j < CR; j++) for (let i = 0; i < CR; i++) { const p = j * CR + i; if (cls[p] !== CL.NONE) continue; const px = Math.min(lc.N - 1, Math.floor((lc.qx + (i + .5) / CR) * N2)), py = Math.min(lc.N - 1, Math.floor((lc.qy + (j + .5) / CR) * N2)), wc = lc.d[py * lc.N + px]; let w;
      if (wc === 10 || wc === 95) w = CL.WOOD; else if (wc === 20 || wc === 30 || wc === 100) w = CL.GRASS; else if (wc === 40) w = CL.FARM; else if (wc === 90) w = CL.WET;
      else if (wc === 60 || wc === 70) { const hh = hAt((i + .5) / CR * S, (j + .5) / CR * S); w = wc === 70 && hh > 2200 ? CL.ICE : hh > 1300 ? CL.ROCK : CL.GRASS }
      if (w !== undefined) { cls[p] = w; lcF[p] = 1; nlc++ } }
    stat.worldcover = nlc }
  // --- strade, ferrovie, ponti (prima della geometria del terreno: le strade lo spianano)
  // Versione 29: ogni strada si campiona anche per MGN metri oltre il bordo della cella, così le quote al bordo vengono uguali nelle due celle vicine;
  // le gallerie poco profonde diventano strade in superficie; i ponti si alzano sopra le strade che scavalcano; le quote si raccordano agli incroci;
  // il terreno si spiana lungo le strade e si abbassa dove sporgerebbe sopra l'asfalto; infine si tiene solo il tratto dentro la cella.
  const roads = [], bridges = [], mini = [], texts = [], objs = [], signQ = [], walls = [], wallsY = [], wY = (yb, yt) => wallsY.push(yb, yt), GRD = opt.dbg ? [] : null, rails = [];
  // v31: barriera bassa per le collisioni fra (au,av) e (bu,bv): centro, direzione, mezza lunghezza, quota della base e della cima
  const RLD = opt.dbg ? [] : null, rail = (au, av, ya, bu, bv, yb2, top, src) => { const L = Math.hypot(bu - au, bv - av); if (L < .3) return; if (RLD) RLD.push(src || ''); rails.push((au + bu) / 2, (av + bv) / 2, (bu - au) / L, (bv - av) / L, L / 2, Math.min(ya, yb2) - .1, Math.max(ya, yb2) + top) };   // wallsY: quota assoluta (base, cima) di ogni muro di collisione, stesso ordine di walls
  const MGN = A ? 160 : 40, lvl = r => r.bridge ? 1 + Math.max(0, r.lay || 0) : r.tun ? -1 : 0;
  // galleria poco profonda (sottopasso, galleria artificiale): il tetto (strada + 5,2 m) supera il terreno quasi dappertutto e non passa sotto gli edifici.
  // Si decide sulla geometria intera della tile z14 (BLO..BHI), così tutte le celle della tile decidono allo stesso modo.
  let TBM = null; const TBN = 384, tbmAt = (x, y) => { if (!TBM) { TBM = new Uint8Array(TBN * TBN); const ly = L.building; if (ly) { const ext = ext0(ly), span = BHI - BLO;
        for (let i = 0; i < ly.n; i++) { const f = ly.feat(i); if (f.type !== 3) continue; for (const pg of polygons(f.parts)) fillPoly(pg.map(r => r.map(v => v - BLO)), span, TBN, q => { TBM[q] = 1 }) } } }
      const i = Math.floor((x - BLO) / (BHI - BLO) * TBN), j = Math.floor((y - BLO) / (BHI - BLO) * TBN); return i >= 0 && j >= 0 && i < TBN && j < TBN && !!TBM[j * TBN + i] };
  const tunShallow = (pts, k, ha, hb) => { let L2 = 0; for (let i = 0; i + 3 < pts.length; i += 2) L2 += Math.hypot(pts[i + 2] - pts[i], pts[i + 3] - pts[i + 1]) * k; if (L2 < 1) return true;
    let a2 = 0, mx = -1e9, n = 0, nb = 0; const cl2 = q => q, clu = q => Math.min(BHIu * k, Math.max(BLOu * k, q)), clv = q => Math.min(BHIv * k, Math.max(BLOv * k, q));
    for (let i = 0; i + 3 < pts.length; i += 2) { const ax = pts[i] * k, ay = pts[i + 1] * k, bx = pts[i + 2] * k, by = pts[i + 3] * k, l = Math.hypot(bx - ax, by - ay), ns = Math.max(1, Math.ceil(l / 10));
      for (let e = 0; e < ns; e++) { const t = e / ns, u = ax + (bx - ax) * t, v = ay + (by - ay) * t, sp = a2 + l * t, h = hAt(clu(u), clv(v)), clr = Math.min(1, Math.min(sp, L2 - sp) / 15), lp = ha + (hb - ha) * sp / L2, y = Math.min(lp, h - clr * 1.5);
        mx = Math.max(mx, h - (y + 5.2)); n++; if (tbmAt(u / k, v / k)) nb++ } a2 += l }
    return mx < 1.5 && nb <= n * .15 };
  { const ly = L.transportation; if (ly) { const ext = ext0(ly), k = S / ext, mgT = MGN / k;
    for (let i = 0; i < ly.n; i++) { const f = ly.feat(i), p = f.props, c = p.class; if (!RW[c]) continue; const tun = p.brunnel === 'tunnel'; if (tun && (f.type !== 2 || !(c === 'motorway' || c === 'trunk' || c === 'primary' || c === 'secondary' || c === 'tertiary' || c === 'minor'))) { stat.gallerie = (stat.gallerie || 0) + 1; continue }
      if (f.type === 3) { if (c === 'path' || c === 'minor' || c === 'service') for (const pg of polygons(f.parts)) { const rings = pg.map(r => clipRing(r, 0, ext)).filter(r => r.length >= 6); if (rings.length) roads.push({ area: true, rings, k, c }) } continue }
      if (f.type !== 2) continue; if (!A && (RANK[c] || 0) < 3) continue;
      const one = p.oneway === 1 || p.oneway === -1 || c === 'motorway' || p.ramp === 1; let w = RW[c][0], sty = RW[c][1];
      if (p.ramp === 1) { w = 6; sty = 0 } else if (one && (c === 'primary' || c === 'secondary' || c === 'tertiary')) { w *= .75; sty = 2 } else if (one && c === 'minor') { w = 4.5 }
      if (c === 'path') { const sc = p.subclass; w = sc === 'pedestrian' ? 6 : sc === 'steps' ? 2.5 : sc === 'footway' ? 2.2 : 1.8; sty = sc === 'pedestrian' || sc === 'footway' ? 3 : 4 }
      if (c === 'service' && p.service === 'parking_aisle') w = 3.5;
      if (p.surface === 'unpaved' && sty < 3) sty = 4;
      const lay = +p.layer || 0, ramp = p.ramp === 1;
      for (const part of f.parts) { const pts = part; if (p.brunnel === 'bridge' || tun) { // ponte o galleria: quota interpolata fra le due estremità (spalle o portali), prima del ritaglio
          const n = pts.length, clu = q => Math.min(BHIu * k, Math.max(BLOu * k, q * k)), clv = q => Math.min(BHIv * k, Math.max(BLOv * k, q * k)); const ha = hAt(clu(pts[0]), clv(pts[1])), hb = hAt(clu(pts[n - 2]), clv(pts[n - 1]));
          let shallow = false; if (tun) shallow = tunShallow(pts, k, ha, hb);
          if (shallow) { stat.sottopassi = (stat.sottopassi || 0) + 1; for (const cp of clipLine(pts, -mgT, ext + mgT)) roads.push({ pts: cp, k, w, sty, c, rank: RANK[c] || 1, one, ref: p.ref, toll: p.toll, ramp, lay, shallow: 1 }) }
          else for (const cp of clipLine(pts, -mgT, ext + mgT)) roads.push({ pts: cp, k, w, sty, c, rank: RANK[c] || 1, bridge: !tun, tun, ha, hb, full: pts, one, ref: p.ref, lay, ramp }) }
        else for (const cp of clipLine(pts, -mgT, ext + mgT)) roads.push({ pts: cp, k, w, sty, c, rank: RANK[c] || 1, one, ref: p.ref, toll: p.toll, ramp, lay }) } } } }
  // campionamento: punti ogni ≤ passo metri; quote dal terreno lisciate (finestra più lunga per le strade grandi); ponti e gallerie fra le estremità
  // lisciatura: retta dei minimi quadrati pesati nella finestra (non media pesata: alle estremità la media vede solo un lato e su una salita
  // abbassa la quota di pendenza × mezza finestra, cioè metri interi, e le strade arrivavano agli incroci a quote diverse)
  const smoothH = (h, s, m, win) => { const o = new Float32Array(m); for (let q = 0; q < m; q++) { let sw = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
      const acc = e => { const x = s[e] - s[q], wgt = 1 - Math.abs(x) / (win + 1); sw += wgt; sx += wgt * x; sy += wgt * h[e]; sxx += wgt * x * x; sxy += wgt * x * h[e] };
      for (let e = q; e >= 0 && s[q] - s[e] <= win; e--) acc(e); for (let e = q + 1; e < m && s[e] - s[q] <= win; e++) acc(e);
      const den = sw * sxx - sx * sx; o[q] = den > 1e-6 ? (sy * sxx - sx * sxy) / den : sy / sw } return o };
  const winOf = r => r.rank >= 8 && r.rank < 10 ? 55 : r.rank >= 6 ? 32 : r.rank >= 4 ? 16 : 8;
  const PR = [];
  for (const r of roads) { if (r.area) continue; const pts = r.pts, k = r.k, step = A ? (r.rank >= 6 ? 6 : 5) : 12, S2 = [];
    for (let i = 0; i + 3 < pts.length; i += 2) { const ax = pts[i] * k, ay = pts[i + 1] * k, bx = pts[i + 2] * k, by = pts[i + 3] * k, l = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.ceil(l / step));
      for (let q = (i ? 1 : 0); q <= n; q++) S2.push(ax + (bx - ax) * q / n, ay + (by - ay) * q / n) }
    const m = S2.length / 2; if (m < 2) continue; const h = new Float32Array(m), s = new Float32Array(m);
    for (let q = 0; q < m; q++) { h[q] = hAt(S2[q * 2], S2[q * 2 + 1]); if (q) s[q] = s[q - 1] + Math.hypot(S2[q * 2] - S2[q * 2 - 2], S2[q * 2 + 1] - S2[q * 2 - 1]) }
    let hs = h;
    if (r.bridge || r.tun) { // impalcato (ponte) o piano stradale (galleria): interpolazione lineare fra le due estremità
      const fullL = (() => { const f = r.full; let L2 = 0; for (let i = 0; i + 3 < f.length; i += 2) L2 += Math.hypot(f[i + 2] - f[i], f[i + 3] - f[i + 1]); return L2 * k })();
      const f = r.full; const proj = (x, y) => { let best = 1e18, bs = 0, a2 = 0; for (let i = 0; i + 3 < f.length; i += 2) { const ax = f[i] * k, ay = f[i + 1] * k, bx = f[i + 2] * k, by = f[i + 3] * k, dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)), qx = ax + dx * t - x, qy = ay + dy * t - y, dd = qx * qx + qy * qy; if (dd < best) { best = dd; bs = a2 + Math.sqrt(l2) * t } a2 += Math.sqrt(l2) } return bs };
      hs = new Float32Array(m); for (let q = 0; q < m; q++) { const sp = fullL > 0 ? proj(S2[q * 2], S2[q * 2 + 1]) : 0, t = fullL > 0 ? sp / fullL : 0, clr = Math.min(1, Math.min(sp, fullL - sp) / 15), lp = r.ha + (r.hb - r.ha) * t; hs[q] = r.tun ? Math.min(lp, h[q] - clr * 1.5) : Math.max(lp, h[q] + clr) } }
    else hs = smoothH(h, s, m, winOf(r));
    PR.push({ r, S2, h0: h, h: hs, s, m }) }
  // indice dei segmenti (per incroci, scavalcamenti, alberi, muretti, erba)
  const SGC = 24, SGI = new Map();
  PR.forEach((P, pi) => { for (let q = 0; q < P.m - 1; q++) { const ax = P.S2[q * 2], ay = P.S2[q * 2 + 1], bx = P.S2[q * 2 + 2], by = P.S2[q * 2 + 3];
    for (let i = Math.floor(Math.min(ax, bx) / SGC); i <= Math.floor(Math.max(ax, bx) / SGC); i++) for (let j = Math.floor(Math.min(ay, by) / SGC); j <= Math.floor(Math.max(ay, by) / SGC); j++) { const kk = i + ',' + j; let a = SGI.get(kk); if (!a) SGI.set(kk, a = []); a.push(pi, q) } } });
  // visita i segmenti entro rr metri da (u,v): f(P, indice, q, distanza, t lungo il segmento)
  const segNear = (u, v, rr, f) => { const i0 = Math.floor((u - rr) / SGC), i1 = Math.floor((u + rr) / SGC), j0 = Math.floor((v - rr) / SGC), j1 = Math.floor((v + rr) / SGC);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const a = SGI.get(i + ',' + j); if (!a) continue; for (let x = 0; x < a.length; x += 2) { const P = PR[a[x]], q = a[x + 1], ax = P.S2[q * 2], ay = P.S2[q * 2 + 1], dx = P.S2[q * 2 + 2] - ax, dy = P.S2[q * 2 + 3] - ay, l2 = dx * dx + dy * dy || 1e-9, t = Math.max(0, Math.min(1, ((u - ax) * dx + (v - ay) * dy) / l2)), dd = Math.hypot(ax + dx * t - u, ay + dy * t - v); if (dd <= rr) f(P, a[x], q, dd, t) } } };
  const segX = (ax, ay, bx, by, cx, cy, dx, dy) => { const rx = bx - ax, ry = by - ay, sx = dx - cx, sy = dy - cy, den = rx * sy - ry * sx; if (Math.abs(den) < 1e-9) return null; const t = ((cx - ax) * sy - (cy - ay) * sx) / den, w = ((cx - ax) * ry - (cy - ay) * rx) / den; return t >= 0 && t <= 1 && w >= 0 && w <= 1 ? [t, w] : null };
  const crossings = (P, pi, f) => { const seen = new Set(); for (let q = 0; q < P.m - 1; q++) { const ax = P.S2[q * 2], ay = P.S2[q * 2 + 1], bx = P.S2[q * 2 + 2], by = P.S2[q * 2 + 3]; seen.clear();
    for (let i = Math.floor(Math.min(ax, bx) / SGC); i <= Math.floor(Math.max(ax, bx) / SGC); i++) for (let j = Math.floor(Math.min(ay, by) / SGC); j <= Math.floor(Math.max(ay, by) / SGC); j++) { const a = SGI.get(i + ',' + j); if (!a) continue;
      for (let x = 0; x < a.length; x += 2) { const pj = a[x], qj = a[x + 1]; if (pj === pi) continue; const kk = pj * 100003 + qj; if (seen.has(kk)) continue; seen.add(kk); const Q = PR[pj], X = segX(ax, ay, bx, by, Q.S2[qj * 2], Q.S2[qj * 2 + 1], Q.S2[qj * 2 + 2], Q.S2[qj * 2 + 3]); if (X) f(q, Q, pj, qj, X[0], X[1]) } } } };
  const sAt = (P, q, t) => P.s[q] + (P.s[q + 1] - P.s[q]) * t, hAtQ = (P, q, t) => P.h[q] + (P.h[q + 1] - P.h[q]) * t;
  // scavalcamenti: l'impalcato sta almeno 5,8 m sopra la strada (6,6 sui binari); una strada piccola sotto un ponte più importante scende un po'
  // carreggiate gemelle (stessa strada a senso unico, direzioni opposte, meno di 26 m): stessa quota, così lo spartitraffico non diventa un muro
  { const twin = r => r.one && !r.bridge && !r.tun && !r.ramp && r.rank >= 5 && r.rank < 10, TG2 = [];
    for (const P of PR) { if (!twin(P.r)) { TG2.push(null); continue } const t = new Float32Array(P.m).fill(NaN);
      for (let q = 0; q < P.m; q++) { const u = P.S2[q * 2], v = P.S2[q * 2 + 1], qa = Math.max(0, q - 1), qb = Math.min(P.m - 1, q + 1); let tx = P.S2[qb * 2] - P.S2[qa * 2], tz = P.S2[qb * 2 + 1] - P.S2[qa * 2 + 1]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl; let best = 1e9, bh = NaN;
        segNear(u, v, 26, (Q, pj, qj, dd, tt) => { if (Q === P || !twin(Q.r) || Q.r.c !== P.r.c || dd < 3 || dd >= best) return; const dx = Q.S2[qj * 2 + 2] - Q.S2[qj * 2], dz = Q.S2[qj * 2 + 3] - Q.S2[qj * 2 + 1], dl = Math.hypot(dx, dz) || 1; if ((dx * tx + dz * tz) / dl > -.8) return; best = dd; bh = hAtQ(Q, qj, tt) }); t[q] = bh }
      TG2.push(t) }
    // solo se le due carreggiate stanno quasi alla stessa quota (meno di 2–4 m): a Monaco l'altra carreggiata può passare 15 m più in basso (imbocco di galleria)
    PR.forEach((P, pi) => { const t = TG2[pi]; if (!t) return; for (let q = 0; q < P.m; q++) if (t[q] === t[q]) { const w = Math.max(0, Math.min(1, (4 - Math.abs(t[q] - P.h[q])) / 2)); P.h[q] += (t[q] - P.h[q]) / 2 * w } }) }
  const shoulder = r => r.rank >= 8 && r.rank < 10 && !r.ramp ? 3.4 : 0;
  const cityE = Math.max((L.building && L.building.n) ? (() => { let n = 0; for (let i = 0; i < CR * CR; i++) if (cls[i] === CL.URBAN) n++; return n / (CR * CR) })() : 0, (opt.dens === undefined ? 0 : opt.dens) * 1.5) > .25;
  const swOf = r => A && cityE && !r.bridge && !r.tun && (r.c === 'minor' || r.c === 'tertiary' || r.c === 'secondary' || r.c === 'primary') && r.sty !== 4 ? 2.2 : 0;
  const bandOf = r => r.w / 2 + .5 + shoulder(r) + swOf(r);   // fascia della carreggiata: banchina sulle autostrade, marciapiedi in città
  for (const P of PR) P.h0f = Float32Array.from(P.h);
  { const hump = (P, s0, amt, flat, grade, sg) => { if (!P.adj) P.adj = new Float32Array(P.m); for (let q = 0; q < P.m; q++) { const dd = Math.abs(P.s[q] - s0), val = dd <= flat ? amt : amt - (dd - flat) * grade; if (val <= 0) continue; if (sg > 0) { if (val > P.adj[q]) P.adj[q] = val } else if (-val < P.adj[q]) P.adj[q] = -val } };
    PR.forEach((B, bi) => { if (!B.r.bridge) return; const lb = lvl(B.r);
      crossings(B, bi, (q, G, pj, qj, t, w) => { if (G.r.sty === 9 || lvl(G.r) >= lb) return; const sB0 = sAt(B, q, t), sG0 = sAt(G, qj, w); if (sB0 < 2 || sB0 > B.s[B.m - 1] - 2 || sG0 < 2 || sG0 > G.s[G.m - 1] - 2) return;   // strade che si toccano a un'estremità: non è uno scavalcamento
        const hB = hAtQ(B, q, t), hG = hAtQ(G, qj, w), isRail = G.r.c === 'rail', need = hG + (isRail ? 6.6 : G.r.rank <= 2 ? 2.8 : 5.9) + (G.r.bridge ? .8 : 0) - hB; if (need <= .05) return;
        // sentieri e carrarecce passano sotto (si abbassano loro); strade minori si abbassano in parte; strade importanti e binari: si alza l'impalcato
        let dn = 0; if (!G.r.bridge && !G.r.tun && !isRail) { if (G.r.rank <= 2) dn = need; else if (G.r.rank <= 5 && B.r.rank >= G.r.rank) dn = Math.min(need * .6, 4); else if (G.r.rank <= 6 && B.r.rank >= G.r.rank) dn = Math.min(need * .5, 3) }
        if (need - dn > .05) { hump(B, sAt(B, q, t), need - dn, G.r.w / 2 + 6, B.r.rank >= 8 ? .04 : .06, 1); B.raised = 1 } if (dn > 0) hump(G, sAt(G, qj, w), dn, B.r.w / 2 + 6, G.r.rank <= 2 ? .25 : .08, -1); stat.scavalchi = (stat.scavalchi || 0) + 1 }) });
    for (const P of PR) if (P.adj) { for (let q = 0; q < P.m; q++) P.h[q] += P.adj[q]; P.adjA = P.adj; P.adj = null } }
  // rialzo effettivo di un ponte all'ascissa sv (0 se lo scavalcamento è lontano: così due celle vicine decidono allo stesso modo)
  const adjAt = (P, sv) => { if (!P.adjA) return 0; let q = 0; while (q < P.m - 2 && P.s[q + 1] < sv) q++; const t = Math.max(0, Math.min(1, (sv - P.s[q]) / (P.s[q + 1] - P.s[q] || 1e-9))); return P.adjA[q] + (P.adjA[q + 1] - P.adjA[q]) * t };
  // raccordo delle quote: le estremità che toccano un'altra strada (allo stesso livello, o un'altra estremità) e gli incroci a raso
  // prendono una sola quota per nodo; la correzione si spegne lungo la strada (sui ponti si distribuisce su tutto l'impalcato)
  { const tol = 1.6, NOD = [], NI = new Map(), lim = MGN - 1;
    const nodeAt = (u, v) => { const i0 = Math.floor(u / 4), j0 = Math.floor(v / 4); for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) { const a = NI.get((i0 + di) + ',' + (j0 + dj)); if (a) for (const N of a) if (Math.hypot(N.u - u, N.v - v) < tol) return N }
      const N = { u, v, P: new Map() }; NOD.push(N); const kk = i0 + ',' + j0; let a = NI.get(kk); if (!a) NI.set(kk, a = []); a.push(N); return N };
    const join = (N, pi, sv, hv, inter, dd) => { for (const [kk, e] of N.P) if (e[0] === pi && Math.abs(e[1] - sv) < 30) { if (dd < e[4]) { N.P.delete(kk); break } return } N.P.set(pi + ':' + Math.round(sv * 2), [pi, sv, hv, inter, dd]) };
    // pianerottolo: entro (metà larghezza dell'altra strada + 3 m) dal nodo la quota resta quella del nodo, poi la correzione si spegne
    PR.forEach((P, pi) => { if (P.r.sty === 9) return; for (const e of [0, P.m - 1]) { const u = P.S2[e * 2], v = P.S2[e * 2 + 1]; if (u < -lim || v < -lim || u > S + lim || v > S + lim) continue; let N = null;
      // estremità dentro la carreggiata di un'altra strada (+1,2 m: in OpenStreetMap molte vie finiscono vicino alla strada senza toccarla), o a 1,6 m da un'altra estremità
      segNear(u, v, 7, (Q, pj, qj, dd, t) => { if (Q.r.sty === 9) return; const sQ = sAt(Q, qj, t); if (pj === pi && Math.abs(sQ - P.s[e]) < 8) return; const endQ = sQ < .6 || sQ > Q.s[Q.m - 1] - .6, nearEnd = sQ < 4 || sQ > Q.s[Q.m - 1] - 4; if (dd > (endQ ? Math.max(tol, (P.r.w + Q.r.w) / 4 + .8) : Q.r.w / 2 + 1.2)) return;
        const hQ = hAtQ(Q, qj, t), hQ0 = Q.h0f[qj] + (Q.h0f[qj + 1] - Q.h0f[qj]) * t; if (!endQ && !nearEnd && lvl(P.r) !== lvl(Q.r) && dd > .35 && Math.abs(hQ0 - P.h0f[e]) > 2.5) return;   // estremità sotto/sopra un'altra strada (livello diverso): nessun nodo   // estremità sopra o sotto una strada di un altro livello: nessun nodo
        if (!N) { N = nodeAt(u, v); join(N, pi, P.s[e], P.h[e], false, 0) } join(N, pj, sQ, hQ, !endQ, dd) }) } });
    PR.forEach((P, pi) => { if (P.r.sty === 9 || P.r.bridge || P.r.tun) return;
      crossings(P, pi, (q, Q, pj, qj, t, w) => { if (pj < pi || Q.r.sty === 9 || Q.r.bridge || Q.r.tun || (P.r.lay || 0) !== (Q.r.lay || 0)) return; const sP = sAt(P, q, t), sQ = sAt(Q, qj, w); if (sP < .6 || sP > P.s[P.m - 1] - .6 || sQ < .6 || sQ > Q.s[Q.m - 1] - .6) return;
        const N = nodeAt(P.S2[q * 2] + (P.S2[q * 2 + 2] - P.S2[q * 2]) * t, P.S2[q * 2 + 1] + (P.S2[q * 2 + 3] - P.S2[q * 2 + 1]) * t); join(N, pi, sP, hAtQ(P, q, t), true, 0); join(N, pj, sQ, hAtQ(Q, qj, w), true, 0) }) });
    // nodi vicini (meno di 9 m) sono lo stesso incrocio: una sola quota per tutto il gruppo. Ogni nodo si unisce al più al nodo "capo" più vicino
    // (prima i più ricchi di rami), mai a catena: altrimenti nei centri fitti di vie e scale si formava un unico gruppo largo 50 m con una sola quota
    { const NI2 = new Map(), key = (u, v) => Math.floor(u / 9) + ',' + Math.floor(v / 9), ord = NOD.slice().sort((a, b) => b.P.size - a.P.size || a.u - b.u || a.v - b.v);
      for (const N of ord) { if (!N.P.size) continue; let best = null, bd = 9; const i0 = Math.floor(N.u / 9), j0 = Math.floor(N.v / 9);
        for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) { const a = NI2.get((i0 + di) + ',' + (j0 + dj)); if (!a) continue; for (const R0 of a) { const dd = Math.hypot(R0.u - N.u, R0.v - N.v); if (dd < bd) { bd = dd; best = R0 } } }
        if (best) { for (const [kk, v] of N.P) if (!best.P.has(kk)) best.P.set(kk, v); N.P.clear() } else { const kk = key(N.u, N.v); let a = NI2.get(kk); if (!a) NI2.set(kk, a = []); a.push(N) } } }
    const nearNode = (pi, sv) => { for (const N of NOD) for (const [pj, sj] of N.P.values()) if (pj === pi && Math.abs(sj - sv) > .5 && Math.abs(sj - sv) < 25) return true; return false };
    // profili prima del raccordo: le correzioni si calcolano sempre rispetto a questi
    const OWN = PR.map(P => Float32Array.from(P.h)), ownAtOf = pi => { const P = PR[pi], own = OWN[pi], m = P.m; return s => { if (s <= P.s[0]) return own[0]; if (s >= P.s[m - 1]) return own[m - 1]; let k = 0; while (k < m - 2 && P.s[k + 1] < s) k++; const t = (s - P.s[k]) / (P.s[k + 1] - P.s[k] || 1e-9); return own[k] + (own[k + 1] - own[k]) * t } };
    const parOf = P => { const isB = P.r.bridge || P.r.tun, gr = P.r.rank >= 8 || isB ? .035 : .06; return dv => Math.min(130, Math.max(isB ? 60 : 28, Math.abs(dv) / gr)) };
    // quota raccordata della strada pi all'ascissa sv, date le correzioni C (ordinate per ascissa), saltando il nodo "skip" (entrata con K[0] === skip):
    // dentro i pianerottoli, media delle quote dei nodi pesata con la profondità nel pianerottolo (continua ai bordi); fuori, media delle correzioni
    // sfumate pesata con 1/distanza dal bordo del pianerottolo, così al bordo vale esattamente la correzione di quel nodo (nessun gradino)
    const evalAt = (pi, sv, C, ownAt, Lf, skip) => { const P = PR[pi], Lend = P.s[P.m - 1]; let sIn = 0, wIn = 0, sc = 0, sw = 0, endT = null;
      for (const K of C) { if (skip && skip.has(K[0])) continue; const ds = sv - K[0], ad = Math.abs(ds), e = ad - K[2];
        if (e <= 0) { const isEnd = K[0] < .6 || K[0] > Lend - .6; if (isEnd && ad < .6) endT = K[3]; const dw = (K[2] - ad + .05) * (isEnd ? 3 : 1); sIn += K[3] * dw; wIn += dw; continue }
        const c0 = ds < 0 ? K[4] : K[5], f = Math.max(0, 1 - e / Lf(c0)); if (f > 0) { const w = f / Math.max(e, 1e-3); sc += c0 * f * w; sw += w } }
      return endT !== null ? endT : wIn > 0 ? sIn / wIn : ownAt(sv) + (sw > 0 ? sc / sw : 0) };   // l'estremità deve toccare esattamente ciò su cui finisce
    // quote dei nodi: media pesata (rango³, la strada passante pesa 8 volte quella che finisce lì) delle quote dei rami; hvOf dà la quota del ramo
    const nodeCON = hvOf => { const CON = PR.map(() => []);
      for (const N of NOD) { if (N.P.size < 2) continue; let sw = 0, sh = 0; let tight = false; for (const [pi, sv, , inter] of N.P.values()) if (!(PR[pi].r.bridge || PR[pi].r.tun) && nearNode(pi, sv)) tight = true;
        for (const e of N.P.values()) e[2] = hvOf(e[0], e[1], N);
        for (const [pi, sv, hv, inter] of N.P.values()) { const P = PR[pi]; let wgt = Math.pow(P.r.rank + 1, 3) * (inter ? 8 : 1); if (P.r.bridge || P.r.tun) wgt *= adjAt(P, sv) > .3 ? 60 : .05; sw += wgt; sh += hv * wgt }   // ponte alzato per il franco: comanda lui (anche fra nodi fitti: il franco non si rinuncia)
        // pianerottolo: la larghezza delle strade che attraversano il nodo (+3 m); almeno 1,5 m, così anche la strada passante tocca esattamente la quota del nodo
        const tg = sh / sw; for (const [pi, sv, hv, inter] of N.P.values()) { let plat = 1.5; if (PR[pi].r.rank >= 2) for (const [pj, , , interj] of N.P.values()) if (pj !== pi && interj && PR[pj].r.rank >= 2) plat = Math.max(plat, PR[pj].r.w / 2 + shoulder(PR[pj].r) + 3); CON[pi].push([sv, tg - ownAtOf(pi)(sv), plat]) } }
      // dentro il pianerottolo (metà larghezza dell'altra strada + 3 m) la quota è quella del nodo; fuori, la correzione vale (nodo − quota propria al bordo
      // del pianerottolo) e si spegne entro Lf ≤ 130 m (meno del margine di 160 m: le celle vicine vedono gli stessi nodi e ottengono le stesse quote al bordo)
      CON.forEach((C, pi) => { if (!C.length) return; C.sort((a, b) => a[0] - b[0]); const ownAt = ownAtOf(pi); for (const K of C) { K[3] = K[1] + ownAt(K[0]); K[4] = K[3] - ownAt(K[0] - K[2]); K[5] = K[3] - ownAt(K[0] + K[2]) } });   // quota del nodo; correzioni ai due bordi del pianerottolo
      return CON };
    const applyCON = CON => PR.forEach((P, pi) => { const C = CON[pi]; if (!C.length) return; const ownAt = ownAtOf(pi), Lf = parOf(P); for (let q = 0; q < P.m; q++) P.h[q] = evalAt(pi, P.s[q], C, ownAt, Lf, null) });
    // più passate: dalla seconda ogni ramo entra nel nodo con la quota che gli danno gli ALTRI suoi nodi (una via breve fra due strade alte
    // non trascina più l'incrocio in mezzo nel suo avvallamento: ci arriva già sollevata dalle sue estremità); 4 passate in tutto
    let CON = nodeCON((pi, sv) => ownAtOf(pi)(sv)); applyCON(CON);
    // (ponti e gallerie restano rigidi: entrano nel nodo con la loro quota propria, già alzata per il franco; sono le strade a terra ad adattarsi)
    for (let it = 0; it < 3; it++) { CON = nodeCON((pi, sv, N) => { if (PR[pi].r.bridge || PR[pi].r.tun) return ownAtOf(pi)(sv); const skip = new Set(); for (const e of N.P.values()) if (e[0] === pi) skip.add(e[1]); return evalAt(pi, sv, CON[pi], ownAtOf(pi), parOf(PR[pi]), skip) }); applyCON(CON) }
    stat.nodi = NOD.filter(N => N.P.size > 1).length }
  // zone di confluenza: dove una strada corre dentro la carreggiata di una strada più importante (rampe che si staccano, corsie di immissione,
  // vie che costeggiano), prende la sua quota, sfumando sui 2 m del bordo: le due superfici coincidono e nessuna delle due fluttua
  { const BW = bandOf, adj = [];
    for (const P of PR) { if (P.r.bridge || P.r.tun || P.r.sty === 9) { adj.push(null); continue } const a = new Float32Array(P.m).fill(NaN);
      for (let q = 0; q < P.m; q++) { const u = P.S2[q * 2], v = P.S2[q * 2 + 1]; let bw = 0, bh = 0;
        segNear(u, v, 12, (Q, pj, qj, dd, tt) => { if (Q === P || Q.r.bridge || Q.r.tun || Q.r.sty === 9 || Q.r.rank < P.r.rank || (Q.r.rank === P.r.rank && !P.r.ramp)) return; const hwQ = BW(Q.r); if (dd >= hwQ) return; const hq = hAtQ(Q, qj, tt), dh = Math.abs(hq - P.h[q]);
          // a più di 1,5–3 m di dislivello non è una confluenza ma una terrazza (via che corre sotto la strada grande): ognuna tiene la sua quota
          const w = Math.min(1, (hwQ - dd) / 2) * Math.max(0, Math.min(1, (3 - dh) / 1.5)); if (w > bw) { bw = w; bh = hq } });
        // alle estremità (6 m) la confluenza non agisce: lì comanda il nodo (l'estremità tocca esattamente ciò su cui finisce)
        bw *= Math.min(1, P.s[q] / 6, (P.s[P.m - 1] - P.s[q]) / 6); if (bw > 0) a[q] = P.h[q] + (bh - P.h[q]) * bw }
      adj.push(a) }
    PR.forEach((P, pi) => { const a = adj[pi]; if (!a) return; for (let q = 0; q < P.m; q++) if (a[q] === a[q]) P.h[q] = a[q] }) }
  // movimento terra lungo le strade (non sotto i ponti né nelle gallerie), versione 29.3. Per ogni vertice del terreno:
  //  1) spianamento morbido verso la quota della strada più vicina (entro ~11 m);
  //  2) scarpate: fuori dalla fascia della carreggiata il terreno non può stare più in basso del riporto 1:2 né più in alto della trincea 1:1,2
  //     (il riporto si fa solo se il dislivello è sotto FILLMAX metri: oltre, è un viadotto senza etichetta o una parete, e resta il muro);
  //  3) fascia della carreggiata (con banchina e marciapiedi): quota strada − 0,2 esatta, la strada più vicina comanda;
  //  4) i vertici dei triangoli che toccano la carreggiata non sporgono sopra l'asfalto (limite superiore) e non scendono sotto quota strada − 0,9
  //     (limite inferiore, se il riporto è possibile): la strada poggia sempre sul terreno disegnato.
  const gnd = r => !r.bridge && !r.tun && r.sty !== 9, FILLMAX = 6;
  { const FW = new Float32Array(NG * NG), FT = new Float32Array(NG * NG);
    for (const R of PR) { if (!gnd(R.r)) continue; const hw = R.r.w / 2 + 1.5 + shoulder(R.r), rad = hw + d * .75;
      for (let q = 0; q < R.m; q++) { const u = R.S2[q * 2], v = R.S2[q * 2 + 1]; if (u < -rad || v < -rad || u > S + rad || v > S + rad) continue; const i0 = Math.max(0, Math.floor((u - rad) / d)), i1 = Math.min(NG - 1, Math.ceil((u + rad) / d)), j0 = Math.max(0, Math.floor((v - rad) / d)), j1 = Math.min(NG - 1, Math.ceil((v + rad) / d));
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const dd = Math.hypot(i * d - u, j * d - v); if (dd > rad) continue; const wgt = dd <= hw ? 1 : 1 - (dd - hw) / (rad - hw), p = j * NG + i;
          if (wgt > FW[p]) { FW[p] = wgt; FT[p] = R.h[q] - .12 } } } }
    for (let p = 0; p < NG * NG; p++) if (FW[p] > 0) H[p] += (FT[p] - H[p]) * FW[p] }
  { const LO = new Float32Array(NG * NG).fill(-1e9), HI = new Float32Array(NG * NG).fill(1e9), BD = new Float32Array(NG * NG).fill(1e9), BY = new Float32Array(NG * NG), TOP = new Float32Array(NG * NG).fill(1e9), BOT = new Float32Array(NG * NG).fill(-1e9), RF = 2 * FILLMAX + 2;
    // per ogni strada, per ogni vertice entro hwB + max(RF, 30): il segmento più vicino e la quota della strada alla proiezione (yr);
    // poi fascia, triangoli che toccano, scarpate
    const ND = new Float32Array(NG * NG), NY = new Float32Array(NG * NG), NGN = new Int32Array(NG * NG).fill(-1), TM = new Uint8Array(NG * NG), BDR = new Int32Array(NG * NG).fill(-1); let rid = 0;
    for (const R of PR) { if (!gnd(R.r)) continue; const hwB = bandOf(R.r), lift = .06 + R.r.rank * .004, isPath = R.r.rank <= 1, rad = isPath ? hwB + d * 1.2 : hwB + Math.max(RF, 16), TL = []; rid++;
      for (let q = 0; q < R.m - 1; q++) { const ax = R.S2[q * 2], ay = R.S2[q * 2 + 1], bx = R.S2[q * 2 + 2], by = R.S2[q * 2 + 3]; if (Math.max(ax, bx) < -rad || Math.max(ay, by) < -rad || Math.min(ax, bx) > S + rad || Math.min(ay, by) > S + rad) continue;
        const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1e-9, i0 = Math.max(0, Math.floor((Math.min(ax, bx) - rad) / d)), i1 = Math.min(NG - 1, Math.ceil((Math.max(ax, bx) + rad) / d)), j0 = Math.max(0, Math.floor((Math.min(ay, by) - rad) / d)), j1 = Math.min(NG - 1, Math.ceil((Math.max(ay, by) + rad) / d));
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const pu = i * d, pv = j * d; let t = ((pu - ax) * dx + (pv - ay) * dy) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t; const dd = Math.hypot(ax + dx * t - pu, ay + dy * t - pv); if (dd > rad) continue;
          const p = j * NG + i; if (NGN[p] !== rid) { NGN[p] = rid; ND[p] = 1e9; TM[p] = 0; TL.push(p) } if (dd < ND[p]) { ND[p] = dd; NY[p] = R.h[q] + (R.h[q + 1] - R.h[q]) * t + lift - .2 } } }
      // vertici dei triangoli che contengono punti della carreggiata (campioni ogni 2,5 m lungo e ogni ≤1,5 m attraverso)
      if (!isPath) for (let q = 0; q < R.m - 1; q++) { const ax = R.S2[q * 2], ay = R.S2[q * 2 + 1], bx = R.S2[q * 2 + 2], by = R.S2[q * 2 + 3]; if (Math.max(ax, bx) < -hwB || Math.max(ay, by) < -hwB || Math.min(ax, bx) > S + hwB || Math.min(ay, by) > S + hwB) continue;
        const len = Math.hypot(bx - ax, by - ay) || 1e-6, tx = (bx - ax) / len, tz = (by - ay) / len, n = Math.max(1, Math.ceil(len / 2.5)), na = Math.max(2, Math.ceil(hwB / 1.5));
        for (let e = 0; e <= n; e++) { const t = e / n, cu = ax + (bx - ax) * t, cv = ay + (by - ay) * t; for (let a = -na; a <= na; a++) { const f = a / na, u = cu - tz * hwB * f, v = cv + tx * hwB * f; if (u < 0 || v < 0 || u > S || v > S) continue; const fx = Math.min(NG - 1.0001, u / d), fy = Math.min(NG - 1.0001, v / d), i = Math.floor(fx), j = Math.floor(fy), p = j * NG + i;
            if (fx - i + fy - j <= 1) { TM[p] = TM[p + 1] = TM[p + NG] = 1 } else { TM[p + 1] = TM[p + NG] = TM[p + NG + 1] = 1 } } } }
      for (const p of TL) { const dd = ND[p], yr = NY[p], ddp = isPath ? dd + 50 : dd;   // i sentieri contano solo se non c'è una strada vera
        if (dd <= hwB) { if (ddp < BD[p]) { BD[p] = ddp; BY[p] = yr; BDR[p] = rid } }
        if (TM[p]) { if (yr < TOP[p]) TOP[p] = yr; const lb = yr - .7; if (lb > BOT[p] && H[p] > lb - FILLMAX) BOT[p] = lb; continue } if (dd <= hwB) continue;
        const e = dd - hwB, hi = yr + e / 1.2, lo = yr - e / 2; if (hi < HI[p]) HI[p] = hi; if (lo > LO[p] && H[p] > lo - FILLMAX) LO[p] = lo } }
    if (opt.dbgV) { const i = Math.round(opt.dbgV[0] / d), j = Math.round(opt.dbgV[1] / d), p = j * NG + i; stat.dbgV = { i, j, u: i * d, v: j * d, H: H[p], LO: LO[p], HI: HI[p], BD: BD[p], BY: BY[p], TOP: TOP[p], BOT: BOT[p] } }
    let nb = 0, ns = 0, nt = 0; for (let p = 0; p < NG * NG; p++) { let h = H[p];
      if (h > HI[p]) { h = HI[p]; ns++ } if (h < LO[p]) { h = LO[p]; ns++ }
      if (BD[p] < 1e8) { h = BY[p]; nb++ } else if (h < BOT[p]) h = BOT[p];
      if (h > TOP[p]) { h = TOP[p]; nt++ } H[p] = h }
    // sicurezza: nessun punto dell'asfalto sotto il terreno disegnato; si abbassa quanto basta il vertice più influente del triangolo
    let nl = 0, rid2 = 0; for (let it = 0; it < 2; it++) { rid2 = 0; for (const R of PR) { if (!gnd(R.r)) continue; rid2++; const hw = bandOf(R.r) - .3, y0 = .06 + R.r.rank * .004 - .05;
      for (let q = 0; q < R.m - 1; q++) { const ax = R.S2[q * 2], ay = R.S2[q * 2 + 1], bx = R.S2[q * 2 + 2], by = R.S2[q * 2 + 3]; if (Math.max(ax, bx) < -hw || Math.max(ay, by) < -hw || Math.min(ax, bx) > S + hw || Math.min(ay, by) > S + hw) continue;
        const len = Math.hypot(bx - ax, by - ay) || 1e-6, tx = (bx - ax) / len, tz = (by - ay) / len, n = Math.max(1, Math.ceil(len / 2.5)), na = Math.max(2, Math.ceil(hw / 1.5));
        for (let e = 0; e <= n; e++) { const t = e / n, cu = ax + (bx - ax) * t, cv = ay + (by - ay) * t, y = R.h[q] + (R.h[q + 1] - R.h[q]) * t + y0;
          for (let a = -na; a <= na; a++) { const f = a / na, u = cu - tz * hw * f, v = cv + tx * hw * f; if (u < 0 || v < 0 || u > S || v > S) continue; const fx0 = Math.min(NG - 1.0001, u / d), fy0 = Math.min(NG - 1.0001, v / d), i = Math.floor(fx0), j = Math.floor(fy0), fx = fx0 - i, fy = fy0 - j, p = j * NG + i;
            let ids, lam; if (fx + fy <= 1) { ids = [p, p + 1, p + NG]; lam = [1 - fx - fy, fx, fy] } else { ids = [p + NG + 1, p + 1, p + NG]; lam = [fx + fy - 1, 1 - fy, 1 - fx] }
            const th = H[ids[0]] * lam[0] + H[ids[1]] * lam[1] + H[ids[2]] * lam[2]; if (th <= y) continue;
            // si abbassano i vertici che non stanno nella fascia di un'altra strada (se pesano abbastanza), altrimenti tutti e tre: mai un vertice solo di poco peso
            const dz = th - y + .03; let sf = 0; const fr = [false, false, false]; for (let z = 0; z < 3; z++) if (BDR[ids[z]] < 0 || BDR[ids[z]] === rid2) { fr[z] = true; sf += lam[z] }
            if (sf >= .3) { for (let z = 0; z < 3; z++) if (fr[z]) H[ids[z]] -= dz / sf } else for (let z = 0; z < 3; z++) H[ids[z]] -= dz; nl++ } } } } }
    stat.abbassati = nl; stat.fascia = nb; stat.scarpate = ns; stat.terrazze = nt }
  // tratti dentro la cella (le quote calcolate col contesto restano)
  const RD = [];
  for (const P of PR) { let cur = null; const out = [];
    for (let q = 0; q < P.m - 1; q++) { const ax = P.S2[q * 2], ay = P.S2[q * 2 + 1], dx = P.S2[q * 2 + 2] - ax, dy = P.S2[q * 2 + 3] - ay; let t0 = 0, t1 = 1, ok = true;
      for (const [pp, qq] of [[-dx, ax], [dx, S - ax], [-dy, ay], [dy, S - ay]]) { if (pp === 0) { if (qq < 0) { ok = false; break } } else { const rr = qq / pp; if (pp < 0) { if (rr > t1) { ok = false; break } if (rr > t0) t0 = rr } else { if (rr < t0) { ok = false; break } if (rr < t1) t1 = rr } } }
      if (!ok || t1 - t0 < 1e-7) { cur = null; continue }
      const hA = P.h[q] + (P.h[q + 1] - P.h[q]) * t0, hB = P.h[q] + (P.h[q + 1] - P.h[q]) * t1;
      if (!cur || t0 > 0) { cur = { S2: [ax + dx * t0, ay + dy * t0], h: [hA] }; out.push(cur) }
      cur.S2.push(ax + dx * t1, ay + dy * t1); cur.h.push(hB); if (t1 < 1) cur = null }
    for (const o of out) { const m = o.h.length; if (m < 2) continue; const s = new Float32Array(m); for (let q = 1; q < m; q++) s[q] = s[q - 1] + Math.hypot(o.S2[q * 2] - o.S2[q * 2 - 2], o.S2[q * 2 + 1] - o.S2[q * 2 - 1]); if (s[m - 1] < .8) continue;
      RD.push({ r: P.r, S2: o.S2, h: Float32Array.from(o.h), s, m }) } }
  // terreno sotto l'acqua: un metro sotto la superficie
  const wl = waters.map(W => { if (W.cl === 'ocean') return 0; const hv = []; for (const r of W.rings) for (let i = 0; i < r.length; i += 2) hv.push(hAt(r[i] / W.ext * S, r[i + 1] / W.ext * S)); hv.sort((a, b) => a - b); return hv.length ? hv[Math.floor(hv.length * .25)] : 0 });
  for (let j = 0; j < NG; j++) for (let i = 0; i < NG; i++) { const ci = Math.min(CR - 1, Math.floor(j * d / S * CR)) * CR + Math.min(CR - 1, Math.floor(i * d / S * CR)), wi = widx[ci]; if (wi >= 0 && cls[ci] === CL.WATER) H[j * NG + i] = Math.min(H[j * NG + i], wl[wi] - 1.2) }
  // quota esatta della mesh del terreno (stessi triangoli del disegno)
  const ghT = (u, v) => { const fx0 = Math.min(NG - 1.0001, Math.max(0, u / d)), fy0 = Math.min(NG - 1.0001, Math.max(0, v / d)), i = Math.floor(fx0), j = Math.floor(fy0), fx = fx0 - i, fy = fy0 - j, p = j * NG + i, a = H[p], b = H[p + 1], e = H[p + NG], c = H[p + NG + 1];
    return fx + fy <= 1 ? a + (b - a) * fx + (e - a) * fy : c + (e - c) * (1 - fx) + (b - c) * (1 - fy) };
  // --- mesh del terreno (colori per classe del suolo, pendenza e quota)
  const dens0 = opt.dens === undefined ? 0 : opt.dens;
  const TG = new GB(true); TG.W = [];
  const hX = (i, j) => i < 0 || j < 0 || i >= NG || j >= NG ? hAt(i * d, j * d) : H[j * NG + i];
  for (let j = 0; j < NG; j++) for (let i = 0; i < NG; i++) { const p = j * NG + i, h = H[p], hl = hX(i - 1, j), hr = hX(i + 1, j), hu = hX(i, j - 1), hd = hX(i, j + 1);
    const gx = (hr - hl) / (2 * d), gz = (hd - hu) / (2 * d), l = Math.hypot(gx, 1, gz), sl = Math.hypot(gx, gz);
    const u = i * d, v = j * d, cc = cls[Math.min(CR - 1, Math.floor(v / S * CR)) * CR + Math.min(CR - 1, Math.floor(u / S * CR))];
    const nearRd = (cc === CL.URBAN || cc === CL.IND || (cc === CL.NONE && dens0 > .14)) ? (() => { let best = 1e9; segNear(u, v, 16, (P, pi, q, dd) => { if (P.r.tun) return; const e = dd - P.r.w / 2; if (e < best) best = e }); return best })() : 1e9;
    let c = (CCOL[cc] || CCOL[0]).slice(); if (cc === CL.NONE) { if (dens0 > .14) c = CCOL[CL.URBAN].slice(); else if (h > 1900) c = [.48, .47, .44]; else if (h > 1300) c = [.38, .44, .30] }
    if ((cc === CL.URBAN || (cc === CL.NONE && dens0 > .14)) && nearRd >= 7 && !tbmAt(u / S * 4096, v / S * 4096)) c = [.40, .50, .27];
    const rk = Math.min(1, Math.max(0, (sl - .55) / .5)); if (rk > 0 && cc !== CL.URBAN && cc !== CL.WATER) c = c.map((x, q) => x * (1 - rk) + [.50, .48, .45][q] * rk);
    const sn = Math.min(1, Math.max(0, (h - 2500) / 400)) * (1 - Math.min(1, sl * .8)); if (sn > 0) c = c.map(x => x * (1 - sn) + .93 * sn);
    const nz2 = .9 + hsh(cx * 131 + i, cy * 131 + j) * .2; c = lin(c.map(x => Math.min(1, x * nz2)));
    // zone edificate: lastricato solo vicino alle strade e agli edifici, altrove giardini (erba e terra)
    { let wg = 1, wr = 0, wd = 0, wp = 0; if (cc === CL.ROCK) { wg = 0; wr = 1 } else if (cc === CL.URBAN || cc === CL.IND) { if (nearRd < 7 || cc === CL.IND && nearRd < 20 || tbmAt(u / S * 4096, v / S * 4096)) { wg = 0; wp = 1 } else { wg = .6; wd = .4; wp = 0 } } else if (cc === CL.SAND) { wg = 0; wp = .4; wd = .6 } else if (cc === CL.FARM) { wg = .3; wd = .7 } else if (cc === CL.VINE) { wg = .45; wd = .55 } else if (cc === CL.WOOD) { wg = .55; wd = .45 } else if (cc === CL.ICE) { wg = 0; wr = 1 } else if (cc === CL.NONE && dens0 > .14) { if (sl < .22 && nearRd < 7) { wg = 0; wp = 1 } else { wg = .55; wd = .45 } }
      if (cc !== CL.URBAN && cc !== CL.WATER) { const rk2 = Math.min(1, Math.max(0, (sl - .45) / .5)) + (h > 1900 ? .5 : 0); if (rk2 > 0) { const t = Math.min(1, rk2); wg *= 1 - t; wd *= 1 - t; wp *= 1 - t; wr += t } }
      const sw2 = wg + wr + wd + wp || 1; TG.W.push(wg / sw2, wr / sw2, wd / sw2, wp / sw2) }
    // normale in coordinate del gioco: gradiente (gx est, gz sud) → (−(−gx), 1, −(−gz)) / l = (gx, 1, gz)
    TG.v(-u, h, -v, gx / l, 1 / l, gz / l, c, u / 9, v / 9) }
  for (let j = 0; j < NG - 1; j++) for (let i = 0; i < NG - 1; i++) { const a = j * NG + i, b = a + 1, c = a + NG + 1, e = a + NG; TG.I.push(a, e, b, b, e, c) }
  { const SK = opt.skirt || 12, P = TG.P, Cc = TG.C, U = TG.U;   // gonne lungo i quattro bordi (entrambe le facce)
    for (const side of [0, 1, 2, 3]) { let prev = -1, prevS = -1;
      for (let q = 0; q < NG; q++) { const p = side === 0 ? q : side === 1 ? (NG - 1) * NG + q : side === 2 ? q * NG : q * NG + NG - 1;
        const s2 = TG.v(P[p * 3], P[p * 3 + 1] - SK, P[p * 3 + 2], 0, 1, 0, [Cc[p * 3], Cc[p * 3 + 1], Cc[p * 3 + 2]], U[p * 2], U[p * 2 + 1]); TG.W.push(TG.W[p * 4], TG.W[p * 4 + 1], TG.W[p * 4 + 2], TG.W[p * 4 + 3]);
        if (prev >= 0) TG.I.push(prev, p, s2, prev, s2, prevS, prev, s2, p, prev, prevS, s2); prev = p; prevS = s2 } } }
  // --- strade: nastri sull'atlante (u attraverso, v lungo), bordi in terra, marciapiedi in città
  const RG = new GB(true), RSg = new GB(true), RDg = new GB(true), RBg = new GB(true), RWg = new GB(true), MC = new GB(false), MG = new GB(false), MS = new GB(false), rgOf = sty => sty === 3 ? RSg : sty === 4 ? RDg : sty === 5 ? RBg : sty === 6 ? RWg : RG, urban = (L.building && L.building.n) ? (() => { let n = 0; for (let i = 0; i < CR * CR; i++) if (cls[i] === CL.URBAN) n++; return n / (CR * CR) })() : 0, cityish = Math.max(urban, dens0 * 1.5) > .25;
  const COLS = 12, dirt = lin([.42, .36, .28]), conc = lin([.62, .61, .58]), curb = lin([.70, .69, .66]), stoneW = lin([.60, .57, .52]);
  // fondo del bordo verticale sotto il punto (u,v) alla quota y: fino al terreno, ma mai dentro un'altra strada (lì resta corto)
  const deep = (u, v, y, R) => { let other = false; if (ROW) { const i0 = Math.floor(u / rpx), j0 = Math.floor(v / rpx), R2 = Math.max(1, Math.round(3.5 / rpx)); for (let j = j0 - R2; j <= j0 + R2 && !other; j++) for (let i = i0 - R2; i <= i0 + R2; i++) { if (i < 0 || j < 0 || i >= RHN || j >= RHN) continue; const o = ROW[j * RHN + i]; if (o >= 0 && o !== R.idx) { other = true; break } } } else segNear(u, v, 6, (P, pi, q, dd) => { if (!other && P.r !== R.r && !P.r.tun && dd < P.r.w / 2 + .3) other = true });
    return other ? y - 1.2 : Math.max(y - 40, Math.min(y - 1.2, ghT(u, v) - .4)) };
  // v31: un punto di barriera (guardrail, parapetto) della strada r è libero se non sta dentro la carreggiata di un'altra strada alla stessa quota
  // (mg: margine oltre il bordo dell'altra carreggiata; negativo = deve entrarci di almeno -mg metri)
  // (sx, sy): punto dell'asse da cui nasce la barriera; la strada stessa conta solo lontano da lì (l'altro ramo di un tornante)
  // v31: il punto (u,v) a quota y della strada r sta dentro la carreggiata di un'altra strada di pari o maggiore importanza (righe dipinte da togliere)
  const segniSotto = (u, v, y, r) => { let sotto = false; segNear(u, v, 9, (P, pi, q2, dd, t2) => { if (sotto || P.r === r) return; const c2 = P.r.c; if (c2 === 'path' || c2 === 'rail' || c2 === 'transit' || c2 === 'ferry') return;
    if ((P.r.rank || 0) < (r.rank || 0)) return; if (dd < P.r.w / 2 - .5 && Math.abs(hAtQ(P, q2, t2) + liftOf(P.r) - y) < 1.5) sotto = true }); return sotto };
  const barFree = (u, v, y, r, mg, sx, sy) => { let ok = true; segNear(u, v, 9, (P, pi, q2, dd, t2) => { if (!ok) return; if (P.r === r) { if (sx === undefined) return; let bs = 0, bd = 1e18; for (let k = 0; k < P.m - 1; k++) { const ax = P.S2[k * 2], ay = P.S2[k * 2 + 1], dx = P.S2[k * 2 + 2] - ax, dy = P.S2[k * 2 + 3] - ay, l2 = dx * dx + dy * dy || 1e-9, tt = Math.max(0, Math.min(1, ((sx - ax) * dx + (sy - ay) * dy) / l2)), d2 = (ax + dx * tt - sx) ** 2 + (ay + dy * tt - sy) ** 2; if (d2 < bd) { bd = d2; bs = P.s[k] + (P.s[k + 1] - P.s[k]) * tt } } if (Math.abs(P.s[q2] + (P.s[q2 + 1] - P.s[q2]) * t2 - bs) < r.w * 1.5 + 6) return /* stesso tratto (distanza lungo la strada): non conta */ } const c2 = P.r.c; if (c2 === 'path' || c2 === 'rail' || c2 === 'transit' || c2 === 'ferry') return; if (dd < P.r.w / 2 + mg && Math.abs(hAtQ(P, q2, t2) + liftOf(P.r) - y) < 2.5) ok = false }); return ok };
  // v31: un oggetto a terra (fermata, cartello, semaforo) non sta dentro una carreggiata: si sposta sul bordo della strada più vicina, o si scarta
  // se anche lì c'è una strada (null); libero(u,v): il punto non è dentro nessuna carreggiata
  const nonConta = P => P.r.tun || P.r.bridge || P.r.c === 'path' || P.r.c === 'rail' || P.r.c === 'transit' || P.r.c === 'ferry' || P.r.c === 'track';
  const fuoriStrada = (u, v) => { let best = null; segNear(u, v, 9, (P, pi, q2, dd, t2) => { if (nonConta(P)) return; if (dd < P.r.w / 2 + .4 && (!best || dd < best[0])) best = [dd, P, q2, t2] }); if (!best) return [u, v];
    const P = best[1], q2 = best[2], t2 = best[3], ax = P.S2[q2 * 2], ay = P.S2[q2 * 2 + 1], dx = P.S2[q2 * 2 + 2] - ax, dy = P.S2[q2 * 2 + 3] - ay, l = Math.hypot(dx, dy) || 1, px = ax + dx * t2, py = ay + dy * t2; let nx = -dy / l, ny = dx / l; if ((u - px) * nx + (v - py) * ny < 0) { nx = -nx; ny = -ny }
    const nu = px + nx * (P.r.w / 2 + .8), nv = py + ny * (P.r.w / 2 + .8); let ok = true; segNear(nu, nv, 9, (P2, pi2, q3, d3) => { if (!nonConta(P2) && d3 < P2.r.w / 2 + .4) ok = false }); return ok ? [nu, nv] : null };
  const libero = (u, v) => { const f = fuoriStrada(u, v); return !!f && f[0] === u && f[1] === v };
  const liftOf = r => .06 + r.rank * .004 + (r.bridge ? .2 : 0), RH = RHN ? new Float32Array(RHN * RHN).fill(NaN) : null, ROW = RHN ? new Int32Array(RHN * RHN).fill(-1) : null, RH2 = RHN ? new Float32Array(RHN * RHN).fill(NaN) : null, RDD = RHN ? new Float32Array(RHN * RHN).fill(1e9) : null, RDP = RHN ? new Uint8Array(RHN * RHN) : null, rpx = RHN ? S / RHN : 1;
  // pixel del raster a distanza [w0,w1] dal segmento (lato: 0 entrambi, +1 sinistra, −1 destra); free = solo pixel fuori dalle carreggiate.
  // La quota segue la pendenza del segmento anche oltre le sue estremità (niente "tappi" piatti: su una discesa facevano una scala);
  // dove due strade si sovrappongono vince quella di rango più alto (la sua carreggiata resta intera); a pari rango il segmento più vicino, cioè le due
  // superfici si incontrano a metà strada fra gli assi (lì in realtà c'è il muretto o il cordolo). La strada che perde il pixel resta nel secondo strato (RH2):
  // chi guida sceglie lo strato più vicino alla propria quota, così sulle terrazze (vie sovrapposte a quote diverse) ognuno resta sulla sua carreggiata
  // (alle estremità della strada il raster finisce lì, con mezzo metro di margine: niente tappi sopra l'impalcato o la galleria che seguono)
  const rasterSeg = (ax, ay, bx, by, ya, yb, w0, w1, dy0, id, side, free, capA, capB, prio) => { const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1e-6, tE = .5 / Math.sqrt(l2);
    const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - w1) / rpx)), i1 = Math.min(RHN - 1, Math.floor((Math.max(ax, bx) + w1) / rpx)), j0 = Math.max(0, Math.floor((Math.min(ay, by) - w1) / rpx)), j1 = Math.min(RHN - 1, Math.floor((Math.max(ay, by) + w1) / rpx));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const pu = (i + .5) * rpx, pv = (j + .5) * rpx, t0 = ((pu - ax) * dx + (pv - ay) * dy) / l2, t = Math.max(0, Math.min(1, t0)), ex = ax + dx * t - pu, ey = ay + dy * t - pv, dd = Math.sqrt(ex * ex + ey * ey);
      if (dd > w1 || dd < w0 || (!capA && t0 < -tE) || (!capB && t0 > 1 + tE)) continue; if (side && (dx * (pv - ay) - dy * (pu - ax)) * side <= 0) continue; const p = j * RHN + i; if (free && ROW[p] >= 0) continue;
      const y = ya + (yb - ya) * Math.max(-.5, Math.min(1.5, t0)) + dy0, cur = RH[p]; if (cur === cur && (prio < RDP[p] || (prio === RDP[p] && dd >= RDD[p]))) { if (ROW[p] !== id && !(RH2[p] >= y)) RH2[p] = y; continue }
      if (cur === cur && ROW[p] !== id && !(RH2[p] >= cur)) RH2[p] = cur; RH[p] = y; RDD[p] = dd; RDP[p] = prio; if (!free) ROW[p] = id } };
  // raster delle quote stradali: larghezza almeno 0,8 pixel, così anche le strade strette coprono tutti i pixel attraversati dall'asse
  if (RHN) RD.forEach((R, idx) => { R.idx = idx; if (R.r.bridge || R.r.tun) return; const hw = Math.max(R.r.w / 2, rpx * .8), lf = liftOf(R.r); const onB = (u, v) => u < .05 || v < .05 || u > S - .05 || v > S - .05, cA = onB(R.S2[0], R.S2[1]), cB = onB(R.S2[R.m * 2 - 2], R.S2[R.m * 2 - 1]);   // pezzo tagliato sul bordo della cella: la strada continua, il tappo resta
    for (let q = 0; q < R.m - 1; q++) rasterSeg(R.S2[q * 2], R.S2[q * 2 + 1], R.S2[q * 2 + 2], R.S2[q * 2 + 3], R.h[q] + lf, R.h[q + 1] + lf, 0, hw, 0, idx, 0, false, q > 0 || cA, q < R.m - 2 || cB, 2 + R.r.rank) });
  RD.sort((a, b) => a.r.rank - b.r.rank);
  for (const R of RD) { const r = R.r, hw = r.w / 2, m = R.m, S2 = R.S2, lift = liftOf(r), u0 = r.sty / COLS + .004, u1 = (r.sty + 1) / COLS - .004;
    const sideL = [], sideR = [];
    for (let q = 0; q < m; q++) { const qa = Math.max(0, q - 1), qb = Math.min(m - 1, q + 1); let tx = S2[qb * 2] - S2[qa * 2], tz = S2[qb * 2 + 1] - S2[qa * 2 + 1]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
      const nx = -tz, nz = tx, y = R.h[q] + lift, u = S2[q * 2], v = S2[q * 2 + 1];
      sideL.push(u + nx * hw, v + nz * hw, y); sideR.push(u - nx * hw, v - nz * hw, y) }
    // v31: nelle curve strette il bordo interno tornava indietro e il nastro si ripiegava (triangoli capovolti: buchi nell'asfalto);
    // il bordo interno si ferma dove smetterebbe di avanzare
    const noFold = sd => { for (let q = 1; q < m; q++) { const fx = S2[q * 2] - S2[q * 2 - 2], fz = S2[q * 2 + 1] - S2[q * 2 - 1]; if ((sd[q * 3] - sd[q * 3 - 3]) * fx + (sd[q * 3 + 1] - sd[q * 3 - 2]) * fz <= 0) { sd[q * 3] = sd[q * 3 - 3]; sd[q * 3 + 1] = sd[q * 3 - 2] } } };
    noFold(sideL); noFold(sideR);
    const G2 = rgOf(r.sty), base = G2.n; for (let q = 0; q < m; q++) { const vv = R.s[q] / 10; G2.v(-sideL[q * 3], sideL[q * 3 + 2], -sideL[q * 3 + 1], 0, 1, 0, [1, 1, 1], u0, vv); G2.v(-sideR[q * 3], sideR[q * 3 + 2], -sideR[q * 3 + 1], 0, 1, 0, [1, 1, 1], u1, vv) }
    // v31: dove due strade si sovrappongono (rampe che si uniscono, carreggiate doppie, incroci) ogni nastro disegnava le sue righe e le
    // righe si incrociavano a zig-zag. Il tratto che sta dentro la carreggiata di una strada di pari o maggiore importanza è asfalto senza segni (colonna 0)
    const coperto = []; if (r.sty === 1 || r.sty === 2) for (let q = 0; q < m - 1; q++) { const mu = (S2[q * 2] + S2[q * 2 + 2]) / 2, mv = (S2[q * 2 + 1] + S2[q * 2 + 3]) / 2; coperto.push(segniSotto(mu, mv, (R.h[q] + R.h[q + 1]) / 2 + lift, r)) }
    for (let q = 0; q < m - 1; q++) { if (coperto[q]) { const b = G2.n, c0 = .004, c1 = 1 / COLS - .004, va = R.s[q] / 10, vb = R.s[q + 1] / 10;
        G2.v(-sideL[q * 3], sideL[q * 3 + 2], -sideL[q * 3 + 1], 0, 1, 0, [1, 1, 1], c0, va); G2.v(-sideR[q * 3], sideR[q * 3 + 2], -sideR[q * 3 + 1], 0, 1, 0, [1, 1, 1], c1, va);
        G2.v(-sideL[q * 3 + 3], sideL[q * 3 + 5], -sideL[q * 3 + 4], 0, 1, 0, [1, 1, 1], c0, vb); G2.v(-sideR[q * 3 + 3], sideR[q * 3 + 5], -sideR[q * 3 + 4], 0, 1, 0, [1, 1, 1], c1, vb);
        G2.I.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); stat.segniTolti = (stat.segniTolti || 0) + (R.s[q + 1] - R.s[q]); continue }
      const a = base + q * 2; G2.I.push(a, a + 2, a + 1, a + 1, a + 2, a + 3) }
    // bordi verticali (nascondono i dislivelli fra nastro e terreno)
    const skirt = (side, sgn) => { const SG = r.bridge ? MC : MG, c = r.bridge ? conc : dirt; for (let q = 0; q < m - 1; q++) { const ax = side[q * 3], az = side[q * 3 + 1], ay = side[q * 3 + 2], bx = side[q * 3 + 3], bz = side[q * 3 + 4], by = side[q * 3 + 5];
      let ba, bb; if (r.bridge) { ba = ay - 1.1; bb = by - 1.1 } else { ba = deep(ax, az, ay, R); bb = deep(bx, bz, by, R) }
      const tall = !r.bridge && (ay - ba > 1.8 || by - bb > 1.8), G3 = tall ? MS : SG, c3 = tall ? stoneW : c;
      if (sgn > 0) wallS(G3, bx, bz, ax, az, bb, by, ba, ay, c3); else wallS(G3, ax, az, bx, bz, ba, ay, bb, by, c3) } };   /* v31: n = (−tz, tx) è la normale DESTRA in (u est, v sud): le pareti dei lati avevano il verso opposto a quello voluto */
    if (r.sty !== 9 && !r.tun) { skirt(sideL, 1); skirt(sideR, -1) }
    if (r.tun && A) { // galleria: pareti e volta (facce verso l'interno) solo dove il tetto sta sotto il terreno; portali dove la scatola comincia; muri per le collisioni
      const tc = lin([.30, .30, .31]), tcl = lin([.36, .35, .33]), TH = 5.2, ww = hw + .9, cov = q => ghT(S2[q * 2], S2[q * 2 + 1]) - (R.h[q] + lift + TH), on = [];
      for (let q = 0; q < m - 1; q++) on.push(Math.min(cov(q), cov(q + 1)) > -.3);
      // v31: dove due rami di galleria si uniscono o si separano, la parete di un ramo passava in mezzo alla carreggiata dell'altro (muro
      // visibile e ostacolo che fermava l'auto): la parete si toglie dove sta dentro un'altra carreggiata alla stessa quota (come i guardrail)
      const pLib = (q, sg) => { const qb2 = Math.min(m - 1, q + 1), qa2 = Math.max(0, q - 1); let tx3 = S2[qb2 * 2] - S2[qa2 * 2], tz3 = S2[qb2 * 2 + 1] - S2[qa2 * 2 + 1]; const tl3 = Math.hypot(tx3, tz3) || 1; tx3 /= tl3; tz3 /= tl3;
        const u = S2[q * 2], v = S2[q * 2 + 1], u2 = S2[q * 2 + 2], v2 = S2[q * 2 + 3], ya = R.h[q] + lift, yb3 = R.h[q + 1] + lift, ox = -tz3 * ww * sg, oz = tx3 * ww * sg;
        return barFree(u + ox, v + oz, ya, r, -.3, u, v) && barFree(u2 + ox, v2 + oz, yb3, r, -.3, u2, v2) && barFree((u + u2) / 2 + ox, (v + v2) / 2 + oz, (ya + yb3) / 2, r, -.3, (u + u2) / 2, (v + v2) / 2) };
      const libL = [], libR = []; for (let q = 0; q < m - 1; q++) { libL.push(!on[q] || pLib(q, 1)); libR.push(!on[q] || pLib(q, -1)); if (on[q]) for (const ok of [libL[q], libR[q]]) if (!ok) stat.galleriaPareteTolta = (stat.galleriaPareteTolta || 0) + Math.hypot(S2[q * 2 + 2] - S2[q * 2], S2[q * 2 + 3] - S2[q * 2 + 1]) }
      for (let q = 0; q < m - 1; q++) { if (!on[q]) continue; const qa = Math.max(0, q - 1), qb = Math.min(m - 1, q + 1), qc = Math.min(m - 1, q + 2); let tx = S2[qb * 2] - S2[qa * 2], tz = S2[qb * 2 + 1] - S2[qa * 2 + 1]; let tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl; let tx2 = S2[qc * 2] - S2[q * 2], tz2 = S2[qc * 2 + 1] - S2[q * 2 + 1]; tl = Math.hypot(tx2, tz2) || 1; tx2 /= tl; tz2 /= tl;
        const u = S2[q * 2], v = S2[q * 2 + 1], u2 = S2[q * 2 + 2], v2 = S2[q * 2 + 3], y0 = R.h[q] + lift, y1 = R.h[q + 1] + lift, nx = -tz, nz = tx, nx2 = -tz2, nz2 = tx2;
        const L0 = [u + nx * ww, v + nz * ww], L1 = [u2 + nx2 * ww, v2 + nz2 * ww], R0 = [u - nx * ww, v - nz * ww], R1 = [u2 - nx2 * ww, v2 - nz2 * ww];
        if (libL[q]) wallS(MC, L0[0], L0[1], L1[0], L1[1], y0 - .6, y0 + TH, y1 - .6, y1 + TH, tc); if (libR[q]) wallS(MC, R1[0], R1[1], R0[0], R0[1], y1 - .6, y1 + TH, y0 - .6, y0 + TH, tc);   /* v31: n = (−tz, tx) è la normale DESTRA in (u est, v sud): le pareti dei lati avevano il verso opposto a quello voluto */
        tri3(MC, [[L0[0], y0 + TH, L0[1]], [R0[0], y0 + TH, R0[1]], [R1[0], y1 + TH, R1[1]]], tcl, null, [0, -1, 0]); tri3(MC, [[L0[0], y0 + TH, L0[1]], [R1[0], y1 + TH, R1[1]], [L1[0], y1 + TH, L1[1]]], tcl, null, [0, -1, 0]);
        if (q % 2 === 0) { const Lm = Math.hypot(u2 - u, v2 - v), cL = libL[q] && libL[Math.min(m - 2, q + 1)], cR = libR[q] && libR[Math.min(m - 2, q + 1)]; if (cL) { walls.push((u + u2) / 2 + (nx + nx2) / 2 * (ww - .1), (v + v2) / 2 + (nz + nz2) / 2 * (ww - .1), (u2 - u) / (Lm || 1), (v2 - v) / (Lm || 1), Lm, TH); wY(Math.min(y0, y1) - .6, Math.max(y0, y1) + TH - 1.5) } if (cR) { walls.push((u + u2) / 2 - (nx + nx2) / 2 * (ww - .1), (v + v2) / 2 - (nz + nz2) / 2 * (ww - .1), (u2 - u) / (Lm || 1), (v2 - v) / (Lm || 1), Lm, TH); wY(Math.min(y0, y1) - .6, Math.max(y0, y1) + TH - 1.5) } } }   // cima 1,5 m sotto il soffitto: chi passa sopra una galleria poco profonda non tocca le pareti
      // portali: dove la scatola comincia o finisce dentro la cella (non sul bordo), un fronte in cemento sopra l'imbocco, verso il lato aperto
      for (let qe = 0; qe < m; qe++) { const before = qe > 0 && on[qe - 1], after = qe < m - 1 && on[qe]; if (before === after) continue; const sg = after ? 1 : -1, u = S2[qe * 2], v = S2[qe * 2 + 1]; if (u < 1 || v < 1 || u > S - 1 || v > S - 1) continue; const qb = qe + sg; let tx = (S2[qb * 2] - u) * sg, tz = (S2[qb * 2 + 1] - v) * sg; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl; const nx = -tz, nz = tx, y = R.h[qe] + lift, pw = ww + 1.2;
        const a = [u - nx * pw - tx * .3, v - nz * pw - tz * .3], b = [u + nx * pw - tx * .3, v + nz * pw - tz * .3]; wall(MC, b[0], b[1], a[0], a[1], y + TH - .2, y + TH + 3, tcl, 0, 1); wall(MC, a[0], a[1], b[0], b[1], y + TH - .2, y + TH + 3, tcl, 0, 1);
        wall(MC, a[0], a[1], u - nx * ww - tx * .3, v - nz * ww - tz * .3, y - .6, y + TH + 3, tcl, 0, 1); wall(MC, u + nx * ww - tx * .3, v + nz * ww - tz * .3, b[0], b[1], y - .6, y + TH + 3, tcl, 0, 1); wall(MC, u - nx * ww - tx * .3, v - nz * ww - tz * .3, a[0], a[1], y - .6, y + TH + 3, tcl, 0, 1); wall(MC, b[0], b[1], u + nx * ww - tx * .3, v + nz * ww - tz * .3, y - .6, y + TH + 3, tcl, 0, 1) } }
    if (r.tun) bridges.push({ pts: Array.from(S2), h: Array.from(R.h).map(x => x + lift), hw: hw + .9, tun: 1 });
    if (r.bridge) { // parapetti, intradosso e piloni
      // v31: l'impalcato ha la faccia di sotto (prima, visto da sotto o di lato, era trasparente e restavano parapetti e fasce sospesi);
      // i parapetti sono anche ostacoli con la loro quota (prima si attraversavano e si cadeva dal viadotto); i piloni sono orientati
      // secondo la strada, non stanno mai sopra un'altra strada o un binario e sono ostacoli per chi passa sotto
      for (const [side, sgn] of [[sideL, 1], [sideR, -1]]) for (let q = 0; q < m - 1; q++) { const ax = side[q * 3], az = side[q * 3 + 1], ay = side[q * 3 + 2], bx = side[q * 3 + 3], bz = side[q * 3 + 4];
        const by = side[q * 3 + 5]; if (!barFree(ax, az, ay, r, -.3, S2[q * 2], S2[q * 2 + 1]) || !barFree(bx, bz, by, r, -.3, S2[q * 2 + 2], S2[q * 2 + 3]) || !barFree((ax + bx) / 2, (az + bz) / 2, (ay + by) / 2, r, -.3, (S2[q * 2] + S2[q * 2 + 2]) / 2, (S2[q * 2 + 1] + S2[q * 2 + 3]) / 2)) { stat.parapettoTolto = (stat.parapettoTolto || 0) + Math.hypot(bx - ax, bz - az); continue }   // v31: niente parapetto attraverso un'altra carreggiata (incroci sui viadotti, ponti che finiscono dentro un incrocio)
        wallS(MC, ax, az, bx, bz, ay - .05, ay + .9, by - .05, by + .9, conc); wallS(MC, bx, bz, ax, az, by - .05, by + .9, ay - .05, ay + .9, conc); if (r.w >= 3) rail(ax, az, ay, bx, bz, by, .9, 'parapetto ' + r.c + ' ' + R.idx) }
      for (let q = 0; q < m - 1; q++) { const a = [sideL[q * 3], sideL[q * 3 + 2] - 1.1, sideL[q * 3 + 1]], b = [sideR[q * 3], sideR[q * 3 + 2] - 1.1, sideR[q * 3 + 1]], c2 = [sideR[q * 3 + 3], sideR[q * 3 + 5] - 1.1, sideR[q * 3 + 4]], d2 = [sideL[q * 3 + 3], sideL[q * 3 + 5] - 1.1, sideL[q * 3 + 4]];
        tri3(MC, [a, b, c2], conc, null, [0, -1, 0]); tri3(MC, [a, c2, d2], conc, null, [0, -1, 0]); stat.intradosso = (stat.intradosso || 0) + Math.hypot(S2[q * 2 + 2] - S2[q * 2], S2[q * 2 + 3] - S2[q * 2 + 1]) }
      for (let q = 0; q < m; q++) { if (q % 6 !== 3) continue; const u = S2[q * 2], v = S2[q * 2 + 1], top = R.h[q] + lift - 1.1, bot = gh(u, v) - 1; if (top - bot < 3) continue;
        const qa = Math.max(0, q - 1), qb = Math.min(m - 1, q + 1); let tx = S2[qb * 2] - S2[qa * 2], tz = S2[qb * 2 + 1] - S2[qa * 2 + 1]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
        const pn = [-tz, tx], Lp = Math.max(2.4, Math.min(hw * 1.2, 6)); let sopra = false;
        segNear(u, v, Lp / 2 + 8, (P, pi, q2, dd, t2) => { if (sopra || P.r === r || P.r.c === 'path') return; if (dd < P.r.w / 2 + Lp / 2 + .8 && hAtQ(P, q2, t2) < top - 1.5) sopra = true });
        if (sopra) continue;
        obox(MC, u, v, pn[0], pn[1], Lp, 1.6, bot, top, conc); walls.push(u, v, pn[0], pn[1], Lp / 2, top - bot); wY(bot, top - 1) }   // cima registrata 1 m sotto l'intradosso: chi passa sull'impalcato in pendenza non tocca il pilone
      bridges.push({ pts: Array.from(S2), h: Array.from(R.h).map(x => x + lift), hw: hw + .5 }) }
    // marciapiedi: strade cittadine fuori dalle zone pedonali
    if (A && !r.bridge && !r.tun && Math.max(urban, dens0 * 1.5) > .25 && (r.c === 'minor' || r.c === 'tertiary' || r.c === 'secondary' || r.c === 'primary') && r.sty !== 4) {
      const sw = 2.2, us0 = 6 / COLS + .004, us1 = 7 / COLS - .004; R.sw = 1;
      const cuts = []; for (const [side, sgn] of [[sideL, 1], [sideR, -1]]) { const b0 = RWg.n, cut = new Uint8Array(m); cuts.push(cut);
        const outS = []; for (let q = 0; q < m; q++) { const qa = Math.max(0, q - 1), qb = Math.min(m - 1, q + 1); let tx = S2[qb * 2] - S2[qa * 2], tz = S2[qb * 2 + 1] - S2[qa * 2 + 1]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl; outS.push(side[q * 3] - tz * sgn * sw, side[q * 3 + 1] + tx * sgn * sw, 0) }
        noFold(outS);   // v31: anche il bordo esterno del marciapiede (interno alla curva) non si ripiega
        for (let q = 0; q < m; q++) { const qa = Math.max(0, q - 1), qb = Math.min(m - 1, q + 1); let tx = S2[qb * 2] - S2[qa * 2], tz = S2[qb * 2 + 1] - S2[qa * 2 + 1]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
          const nx = -tz * sgn, nz = tx * sgn, ex = side[q * 3], ez = side[q * 3 + 1], y = side[q * 3 + 2] + .14, vv = R.s[q] / 3;
          if (ROW) { const mu = ex + nx * sw * .5, mv = ez + nz * sw * .5, pi = Math.floor(mu / rpx), pj = Math.floor(mv / rpx); if (pi >= 0 && pj >= 0 && pi < RHN && pj < RHN) { const o = ROW[pj * RHN + pi]; if (o >= 0 && o !== R.idx) cut[q] = 1 } }
          RWg.v(-ex, y, -ez, 0, 1, 0, [1, 1, 1], sgn > 0 ? us1 : us0, vv); RWg.v(-outS[q * 3], y, -outS[q * 3 + 1], 0, 1, 0, [1, 1, 1], sgn > 0 ? us0 : us1, vv) }
        for (let q = 0; q < m - 1; q++) { if (cut[q] || cut[q + 1]) continue; const a = b0 + q * 2; if (sgn > 0) RWg.I.push(a + 1, a + 3, a, a, a + 3, a + 2); else RWg.I.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
          if (RHN) rasterSeg(S2[q * 2], S2[q * 2 + 1], S2[q * 2 + 2], S2[q * 2 + 3], R.h[q] + lift, R.h[q + 1] + lift, hw, hw + sw, .14, R.idx, sgn, true, q > 0 || S2[0] < .05 || S2[1] < .05 || S2[0] > S - .05 || S2[1] > S - .05, q < m - 2 || S2[m * 2 - 2] < .05 || S2[m * 2 - 1] < .05 || S2[m * 2 - 2] > S - .05 || S2[m * 2 - 1] > S - .05, 1) }
        for (let q = 0; q < m - 1; q++) { if (cut[q] || cut[q + 1]) continue; const ax = side[q * 3], az = side[q * 3 + 1], ay = side[q * 3 + 2], bx = side[q * 3 + 3], bz = side[q * 3 + 4];
          const by = side[q * 3 + 5]; if (sgn > 0) wallS(MC, ax, az, bx, bz, ay - .02, ay + .14, by - .02, by + .14, curb); else wallS(MC, bx, bz, ax, az, by - .02, by + .14, ay - .02, ay + .14, curb);   /* v31: n = (−tz, tx) è la normale DESTRA in (u est, v sud): le pareti dei lati avevano il verso opposto a quello voluto */
          // bordo esterno del marciapiede fino al terreno (muro di pietra se il dislivello è alto)
          const P0 = RWg.P, i0 = (b0 + q * 2 + 1) * 3, i1 = (b0 + q * 2 + 3) * 3, ou = -P0[i0], ov = -P0[i0 + 2], oy = P0[i0 + 1], pu = -P0[i1], pv = -P0[i1 + 2], py = P0[i1 + 1], ba = deep(ou, ov, oy, R), bb = deep(pu, pv, py, R), tall = oy - ba > 1.8 || py - bb > 1.8;
          if (sgn > 0) wallS(tall ? MS : MG, pu, pv, ou, ov, bb, py, ba, oy, tall ? stoneW : dirt); else wallS(tall ? MS : MG, ou, ov, pu, pv, ba, oy, bb, py, tall ? stoneW : dirt) } }   /* v31: n = (−tz, tx) è la normale DESTRA in (u est, v sud): le pareti dei lati avevano il verso opposto a quello voluto */
      // incroci: strisce pedonali e linee di arresto prima dell'incrocio, semafori sulle strade importanti, segnali di senso unico
      { const cut = cuts[0], cut2 = cuts[1], at = q => { const qa = Math.max(0, q - 1), qb = Math.min(m - 1, q + 1); let tx = S2[qb * 2] - S2[qa * 2], tz = S2[qb * 2 + 1] - S2[qa * 2 + 1]; const tl = Math.hypot(tx, tz) || 1; return [tx / tl, tz / tl] };
        const atS = sv => { let q = 0; while (q < m - 1 && R.s[q + 1] < sv) q++; const l = R.s[q + 1] - R.s[q] || 1e-9, t = Math.max(0, Math.min(1, (sv - R.s[q]) / l)); return [S2[q * 2] + (S2[q * 2 + 2] - S2[q * 2]) * t, S2[q * 2 + 1] + (S2[q * 2 + 3] - S2[q * 2 + 1]) * t, R.h[q] + (R.h[q + 1] - R.h[q]) * t + lift, q] };
        const mark = (sv, cu, cv, uw, dirS) => { // rettangolo di segnaletica centrato in (cu,cv) all'ascissa sv: colonna uw dell'atlante, lunghezza 2.6 m (zebre) o .5 m (arresto)
          const [tx, tz] = at(atS(sv)[3]), nx = -tz, nz = tx, L = uw === 8 ? 2.6 : .5, ww = uw === 8 ? hw * 2 : hw, c0 = uw === 8 ? [cu, cv] : [cu + nx * (hw / 2) * dirS, cv + nz * (hw / 2) * dirS], yA = atS(sv - L / 2)[2] + .015, yB = atS(sv + L / 2)[2] + .015, b0 = RG.n, ua = uw / COLS + .003, ub = (uw + 1) / COLS - .003;
          const pts = [[c0[0] - tx * L / 2 - nx * ww / 2, c0[1] - tz * L / 2 - nz * ww / 2], [c0[0] - tx * L / 2 + nx * ww / 2, c0[1] - tz * L / 2 + nz * ww / 2], [c0[0] + tx * L / 2 + nx * ww / 2, c0[1] + tz * L / 2 + nz * ww / 2], [c0[0] + tx * L / 2 - nx * ww / 2, c0[1] + tz * L / 2 - nz * ww / 2]];
          const uv = [[ua, 0], [ub, 0], [ub, L / 2.6], [ua, L / 2.6]]; for (let q = 0; q < 4; q++) RG.v(-pts[q][0], q < 2 ? yA : yB, -pts[q][1], 0, 1, 0, [1, 1, 1], uv[q][0], uv[q][1]); RG.I.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3) };   // v31: faccia verso l'alto (prima verso il basso: strisce e linee di arresto invisibili)
        const edge = sv => { const p = atS(sv); return p[0] > 1.5 && p[1] > 1.5 && p[0] < S - 1.5 && p[1] < S - 1.5 };
        for (let q = 1; q < m; q++) { const was = cut[q - 1] || cut2[q - 1], now = cut[q] || cut2[q];
          if (!was && now) { // incrocio davanti (per chi viaggia nel verso +): strisce 2,2 m prima, arresto 1,2 m prima delle strisce
            const sz = R.s[q] - 2.2; if (sz > 2 && edge(sz)) { const p = atS(sz); mark(sz, p[0], p[1], 8, 1); if (sz - 2.1 > 1) { const p2 = atS(sz - 2.1); mark(sz - 2.1, p2[0], p2[1], 10, 1) }
              if (r.rank >= 5) { const [tx, tz] = at(p[3]), nx = -tz, nz = tx, su = p[0] + nx * (hw + .5) - tx * .4, sv = p[1] + nz * (hw + .5) - tz * .4; if (libero(su, sv)) objs.push(6, su, p[2] - lift, sv, Math.atan2(tx, tz), 1) } } }
          if (was && !now) { // incrocio alle spalle: vale per chi viaggia nel verso −
            const sz = R.s[q] + 2.2; if (sz < R.s[m - 1] - 2 && edge(sz)) { const p = atS(sz); mark(sz, p[0], p[1], 8, -1); if (sz + 2.1 < R.s[m - 1] - 1 && !r.one) { const p2 = atS(sz + 2.1); mark(sz + 2.1, p2[0], p2[1], 10, -1) }
              if (r.rank >= 5 && !r.one) { const [tx, tz] = at(p[3]), nx = tz, nz = -tx, su = p[0] + nx * (hw + .5) + tx * .4, sv = p[1] + nz * (hw + .5) + tz * .4; if (libero(su, sv)) objs.push(6, su, p[2] - lift, sv, Math.atan2(-tx, -tz), 1) } } } }
        if (r.one && R.s[m - 1] > 14) { // senso unico: segnale all'inizio (verso chi entra), divieto di accesso alla fine
          const s0 = 2.5, s1 = R.s[m - 1] - 2.5; if (edge(s0) && S2[0] > 1.5 && S2[1] > 1.5 && S2[0] < S - 1.5 && S2[1] < S - 1.5) { const p = atS(s0), [tx, tz] = at(p[3]), nx = -tz, nz = tx, pu = p[0] + nx * (hw + .7), pv = p[1] + nz * (hw + .7); signQ.push([pu, pv, p[2] - lift, 'oneway', -tx, -tz]) }
          const e0 = S2[m * 2 - 2], e1 = S2[m * 2 - 1]; if (edge(s1) && e0 > 1.5 && e1 > 1.5 && e0 < S - 1.5 && e1 < S - 1.5) { const p = atS(s1), [tx, tz] = at(p[3]), nx = tz, nz = -tx, pu = p[0] + nx * (hw + .7), pv = p[1] + nz * (hw + .7); signQ.push([pu, pv, p[2] - lift, 'noentry', tx, tz]) } } } }
    // piazzole di sosta (autostrade e superstrade fuori dalle gallerie): ogni ~500 m sul lato destro, 45 m con raccordi; cartello SOS
    R.bays = []; if (A && !r.bridge && !r.tun && (r.c === 'motorway' || r.c === 'trunk') && !r.ramp && R.s[m - 1] > 160) {
      for (let sv = 90 + hsh(Math.round(S2[0]), Math.round(S2[1]) + 3) * 400; sv < R.s[m - 1] - 60; sv += 480 + hsh(Math.round(sv), 9) * 120) { const s0 = sv - 22, s1 = sv + 22; R.bays.push([s0, s1]);
        const bw = s => s < s0 + 9 ? (s - s0) / 9 : s > s1 - 9 ? (s1 - s) / 9 : 1, b0 = RG.n, u00 = .004, u01 = 1 / COLS - .004, outer = []; let nq = 0;
        for (let q = 0; q < m; q++) { if (R.s[q] < s0 || R.s[q] > s1) continue; const qa = Math.max(0, q - 1), qb = Math.min(m - 1, q + 1); let tx = S2[qb * 2] - S2[qa * 2], tz = S2[qb * 2 + 1] - S2[qa * 2 + 1]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
          const nx = -tz, nz = tx, y = R.h[q] + lift + .01, w2 = 3.2 * Math.max(0, Math.min(1, bw(R.s[q]))), u = S2[q * 2], v = S2[q * 2 + 1];
          RG.v(-(u + nx * (hw - .3)), y, -(v + nz * (hw - .3)), 0, 1, 0, [1, 1, 1], u00, R.s[q] / 10); RG.v(-(u + nx * (hw + w2)), y, -(v + nz * (hw + w2)), 0, 1, 0, [1, 1, 1], u01, R.s[q] / 10); outer.push(u + nx * (hw + w2), v + nz * (hw + w2), y); nq++ }
        for (let q = 0; q < nq - 1; q++) { const a = b0 + q * 2; RG.I.push(a, a + 1, a + 2, a + 1, a + 3, a + 2) }   // v31: faccia verso l'alto (prima la piazzola era invisibile dall'alto)
        // bordo esterno della piazzola fino al terreno (niente asfalto sospeso)
        for (let q = 0; q + 1 < outer.length / 3; q++) { const ax = outer[q * 3], az = outer[q * 3 + 1], ay = outer[q * 3 + 2], bx = outer[q * 3 + 3], bz = outer[q * 3 + 4], by = outer[q * 3 + 5]; wallS(MG, bx, bz, ax, az, Math.max(by - 30, Math.min(by - 1, ghT(bx, bz) - .4)), by, Math.max(ay - 30, Math.min(ay - 1, ghT(ax, az) - .4)), ay, dirt) }   /* v31: n = (−tz, tx) è la normale DESTRA in (u est, v sud): le pareti dei lati avevano il verso opposto a quello voluto */
        { let q = 0; while (q < m - 1 && R.s[q + 1] < sv) q++; const qa = Math.max(0, q - 1), qb = Math.min(m - 1, q + 1); let tx = S2[qb * 2] - S2[qa * 2], tz = S2[qb * 2 + 1] - S2[qa * 2 + 1]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
          const pu = S2[q * 2] - tz * (hw + 3.9), pv = S2[q * 2 + 1] + tx * (hw + 3.9); if (pu > 2 && pv > 2 && pu < S - 2 && pv < S - 2) { objs.push(7, pu, R.h[q] + lift, pv, 0, 1); texts.push({ k: 'ins', txt: 'SOS', sub: 'PIAZZOLA', bg: '#1f5fb4', fg: '#ffffff', u: pu, v: pv, nx: -tx, nz: -tz, y: R.h[q] + lift + 2.3, w: .9, h: .62, free: 1 }) } } } }
    const bayW = sv => { for (const b of R.bays) if (sv >= b[0] && sv <= b[1]) return 3.2 * Math.max(0, Math.min(1, sv < b[0] + 9 ? (sv - b[0]) / 9 : sv > b[1] - 9 ? (b[1] - sv) / 9 : 1)); return 0 };
    // guardrail (autostrade e superstrade sempre, strade extraurbane dove il terreno scende); sigla della strada ogni 400 m
    // v31: la barriera si interrompe dove entrerebbe nella carreggiata di un'altra strada alla stessa quota (rampe che si staccano o si
    // immettono, incroci, strade sovrapposte: prima finiva in mezzo alle corsie); i pezzi più corti di 4 m non si disegnano; i paletti
    // entrano nel terreno; ogni pezzo è anche un ostacolo basso con la sua quota (rails): ferma chi viaggia lì, non chi passa sopra o sotto
    if (A && !r.bridge && !r.tun && r.sty !== 9 && r.sty !== 3 && r.sty !== 4 && r.rank >= 4 && m > 2) { const gr = lin([.78, .78, .76]), gp = lin([.45, .46, .48]), always = r.rank >= 8;
      const grFree = (u, v, y, sx, sy) => barFree(u, v, y, r, .25, sx, sy);
      for (const [side, sgn] of [[sideL, 1], [sideR, -1]]) { const run = [];
        const flush = () => { let len = 0; for (const g of run) len += g[9];
          if (len >= 4) for (let k = 0; k < run.length; k++) { const [A0u, A0v, ay, B0u, B0v, by, ux, uz, q] = run[k];
            // nastro a doppia faccia che segue la pendenza (e il raccordo delle piazzole) e paletto ogni due campioni
            wallS(MG, A0u, A0v, B0u, B0v, ay + .52, ay + .82, by + .52, by + .82, gr); wallS(MG, B0u, B0v, A0u, A0v, by + .52, by + .82, ay + .52, ay + .82, gr); if (GRD) GRD.push(A0u, A0v, ay, B0u, B0v, by, R.idx);
            const post = (pu, pv, py) => { wall(MG, pu - ux * .05, pv - uz * .05, pu + ux * .05, pv + uz * .05, py - .5, py + .78, gp, 0, 1); wall(MG, pu + ux * .05, pv + uz * .05, pu - ux * .05, pv - uz * .05, py - .5, py + .78, gp, 0, 1) };
            if (k === 0 || q % 2 === 0) post(A0u, A0v, ay); if (k === run.length - 1) post(B0u, B0v, by);
            rail(A0u, A0v, ay, B0u, B0v, by, .82, 'guardrail ' + r.c + ' ' + R.idx); stat.guardrail = (stat.guardrail || 0) + run[k][9] }
          run.length = 0 };
        for (let q = 0; q < m - 1; q++) { let on = always; if (!on && !cityish) { const qa = Math.max(0, q - 1), qb = Math.min(m - 1, q + 1); let tx = S2[qb * 2] - S2[qa * 2], tz = S2[qb * 2 + 1] - S2[qa * 2 + 1]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl; const nx = -tz * sgn, nz = tx * sgn, ou = S2[q * 2] + nx * (hw + 4.5), ov = S2[q * 2 + 1] + nz * (hw + 4.5); if (ou >= 0 && ov >= 0 && ou <= S && ov <= S && gh(ou, ov) < R.h[q] - 2.4) on = true } if (!on) { flush(); continue }
          const ax = side[q * 3], az = side[q * 3 + 1], ay = side[q * 3 + 2], bx = side[q * 3 + 3], bz = side[q * 3 + 4], by = side[q * 3 + 5], dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz) || 1, nxs = -dz / l * sgn, nzs = dx / l * sgn;
          const goA = .45 + (sgn > 0 ? bayW(R.s[q]) : 0), goB = .45 + (sgn > 0 ? bayW(R.s[q + 1]) : 0), A0u = ax + nxs * goA, A0v = az + nzs * goA, B0u = bx + nxs * goB, B0v = bz + nzs * goB;
          if (!grFree(A0u, A0v, ay, S2[q * 2], S2[q * 2 + 1]) || !grFree(B0u, B0v, by, S2[q * 2 + 2], S2[q * 2 + 3]) || !grFree((A0u + B0u) / 2, (A0v + B0v) / 2, (ay + by) / 2, (S2[q * 2] + S2[q * 2 + 2]) / 2, (S2[q * 2 + 1] + S2[q * 2 + 3]) / 2)) { flush(); stat.guardrailTolto = (stat.guardrailTolto || 0) + Math.hypot(B0u - A0u, B0v - A0v); continue }
          run.push([A0u, A0v, ay, B0u, B0v, by, dx / l, dz / l, q, Math.hypot(B0u - A0u, B0v - A0v)]) }
        flush() } }
    if (A && r.ref && r.rank >= 7 && !r.tun && m > 2) { const refs = String(r.ref).split(';')[0].trim(); if (refs.length <= 7) { const mw = r.c === 'motorway', bg = mw ? '#0b6b33' : '#1b4fa3';
      for (let sv = 120 + hsh(Math.round(S2[0]), 7) * 200; sv < R.s[m - 1] - 20; sv += 420) { let q = 0; while (q < m - 1 && R.s[q + 1] < sv) q++; const qa = Math.max(0, q - 1), qb = Math.min(m - 1, q + 1); let tx = S2[qb * 2] - S2[qa * 2], tz = S2[qb * 2 + 1] - S2[qa * 2 + 1]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl; const nx = -tz, nz = tx, pu = S2[q * 2] + nx * (hw + 1.6), pv = S2[q * 2 + 1] + nz * (hw + 1.6); if (pu < 2 || pv < 2 || pu > S - 2 || pv > S - 2) continue;
        objs.push(7, pu, R.h[q] + lift, pv, 0, 1); texts.push({ k: 'ins', txt: refs, sub: '', bg, fg: '#ffffff', u: pu, v: pv, nx: -tx, nz: -tz, y: R.h[q] + lift + 2.3, w: 1.25, h: .62, free: 1 }) } } }
    // minimappa: polilinea semplificata
    if (A) { const pl = []; for (let q = 0; q < m; q += Math.max(1, Math.floor(m / 60))) pl.push(S2[q * 2], S2[q * 2 + 1]); pl.push(S2[m * 2 - 2], S2[m * 2 - 1]); mini.push({ c: r.c, w: r.w, b: !!r.bridge, tun: !!r.tun, one: !!r.one, sw: !!R.sw, pk: 0, p: pl, R }) } }
  // superfici pedonali e piazze (poligoni dello strato strade)
  for (const r of roads) { if (!r.area) continue; const flat = [], holes = []; let nv = 0; for (const ring of r.rings) { if (nv) holes.push(nv); for (let i = 0; i < ring.length; i += 2) { flat.push(ring[i] * r.k, ring[i + 1] * r.k); nv++ } }
    const tri = earcut(flat, holes); if (!tri.length) continue; const b0 = RSg.n, us = 3 / COLS + .02;
    for (let q = 0; q < nv; q++) { const u = flat[q * 2], v = flat[q * 2 + 1]; RSg.v(-u, gh(u, v) + .1, -v, 0, 1, 0, [1, 1, 1], us + (u % 3) / 3 * (1 / COLS - .04), v / 6) }
    // v31: ogni triangolo con la faccia verso l'alto (l'ordine di earcut segue il verso dell'anello OpenStreetMap: alcune piazze erano capovolte)
    for (let q = 0; q < tri.length; q += 3) { const a = tri[q], b = tri[q + 1], c = tri[q + 2], cr = (flat[b * 2] - flat[a * 2]) * (flat[c * 2 + 1] - flat[a * 2 + 1]) - (flat[b * 2 + 1] - flat[a * 2 + 1]) * (flat[c * 2] - flat[a * 2]); if (cr < 0) RSg.I.push(b0 + a, b0 + b, b0 + c); else RSg.I.push(b0 + a, b0 + c, b0 + b) } }
  // --- acque: superfici piane (mare a quota 0, laghi e fiumi alla quota delle rive), corsi d'acqua lineari
  const WG = new GB(false), wc = lin([.16, .33, .40]);
  waters.forEach((W, wi) => { const flat = [], holes = []; let nv = 0; for (const ring of W.rings) { if (nv) holes.push(nv); for (let i = 0; i < ring.length; i += 2) { flat.push(ring[i] / W.ext * S, ring[i + 1] / W.ext * S); nv++ } }
    const tri = earcut(flat, holes); if (!tri.length) return; const y = W.cl === 'ocean' ? 0 : wl[wi] - .2, b0 = WG.n;
    for (let q = 0; q < nv; q++) WG.v(-flat[q * 2], y, -flat[q * 2 + 1], 0, 1, 0, wc); for (let q = 0; q < tri.length; q += 3) WG.I.push(b0 + tri[q], b0 + tri[q + 2], b0 + tri[q + 1]) });
  { const ly = L.waterway; if (ly && A) { const ext = ext0(ly), k = S / ext; for (let i = 0; i < ly.n; i++) { const f = ly.feat(i), c = f.props.class; if (f.type !== 2 || f.props.brunnel === 'tunnel') continue; const w = c === 'river' ? 12 : c === 'canal' ? 8 : c === 'stream' ? 2.5 : 1.5;
      for (const part of f.parts) for (const cp of clipLine(part, 0, ext)) { const P2 = []; for (let q = 0; q + 3 < cp.length; q += 2) { const ax = cp[q] * k, ay = cp[q + 1] * k, bx = cp[q + 2] * k, by = cp[q + 3] * k, l = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.ceil(l / 8)); for (let e = (q ? 1 : 0); e <= n; e++) P2.push(ax + (bx - ax) * e / n, ay + (by - ay) * e / n) }
        const m = P2.length / 2; if (m < 2) continue; const b0 = WG.n; for (let q = 0; q < m; q++) { const qa = Math.max(0, q - 1), qb = Math.min(m - 1, q + 1); let tx = P2[qb * 2] - P2[qa * 2], tz = P2[qb * 2 + 1] - P2[qa * 2 + 1]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl; const u = P2[q * 2], v = P2[q * 2 + 1], y = gh(u, v) + .05;
          WG.v(-(u - tz * w / 2), y, -(v + tx * w / 2), 0, 1, 0, wc); WG.v(-(u + tz * w / 2), y, -(v - tx * w / 2), 0, 1, 0, wc) }
        for (let q = 0; q < m - 1; q++) { const a = b0 + q * 2; WG.I.push(a, a + 2, a + 1, a + 1, a + 2, a + 3) } } } } }
  // --- edifici: facciate a piani con stili (storico, condominio, uffici, industriale, casa, pietra), negozi al piano terra,
  // tetti a falde (coppi) sulle case e sui palazzi piccoli, tetti piani con parapetto e volumi tecnici sugli altri, muri per le collisioni.
  // Nel dettaglio A gli edifici sono divisi in 4×4 blocchi (mesh separate). Altezza, stile, colore e quota dipendono solo dall'edificio intero.
  const SBN = 4, BWs = [], BRs = [], gbs = (arr, i, uv) => arr[i] || (arr[i] = new GB(uv)), dens = opt.dens === undefined ? urban : opt.dens;
  const sbOf = (u, v) => Math.min(SBN - 1, Math.max(0, Math.floor(v / S * SBN))) * SBN + Math.min(SBN - 1, Math.max(0, Math.floor(u / S * SBN)));
  const tile = lin([.70, .38, .27]), tileB = lin([.62, .36, .30]), memb = lin([.46, .46, .47]), grav = lin([.56, .55, .52]), techC = lin([.72, .72, .70]), chimC = lin([.55, .42, .36]);
  const edges = [], EH = new Map(), eKey = (u, v) => Math.floor(u / 16) + ',' + Math.floor(v / 16);
  const shopPts = []; { const ly = L.poi; if (ly && A) { const k = S / ext0(ly); for (let i = 0; i < ly.n; i++) { const f = ly.feat(i), p = f.props; if (f.type !== 1 || !SIGNCAT(p)) continue; const pt = f.parts[0]; if (!pt) continue; const u = pt[0] * k, v = pt[1] * k; if (u < -20 || v < -20 || u > S + 20 || v > S + 20) continue; shopPts.push(u, v) } } }
  const spPts = []; { const ly = L.poi; if (ly && A) { const k = S / ext0(ly); for (let i = 0; i < ly.n; i++) { const f = ly.feat(i), p = f.props; if (f.type !== 1) continue; const pt = f.parts[0]; if (!pt) continue;
      const kk = p.class === 'place_of_worship' ? (p.subclass === 'christian' || p.subclass === 'place_of_worship' ? 'chiesa' : 'culto') : (p.class === 'railway' && p.subclass === 'station') ? 'stazione' : (p.class === 'hospital' && p.subclass === 'hospital') ? 'ospedale' : p.class === 'school' ? 'scuola' : p.class === 'college' ? 'scuola' : (p.class === 'town_hall' && p.subclass === 'townhall') ? 'municipio' : p.class === 'police' ? 'polizia' : null;
      if (kk) spPts.push({ u: pt[0] * k, v: pt[1] * k, k: kk, name: p['name:it'] || p.name || '' }) } } }
  const SPC = { chiesa: [[.88, .83, .74], [.93, .90, .84], [.84, .76, .64], [.80, .62, .50]], culto: [[.9, .88, .84]], stazione: [[.90, .86, .76], [.85, .82, .78]], ospedale: [[.95, .95, .93], [.93, .92, .88]], scuola: [[.93, .80, .55], [.92, .74, .50], [.95, .87, .66]], municipio: [[.93, .84, .62], [.90, .78, .58]], polizia: [[.92, .88, .80]] };
  const bmask = WM ? new Uint8Array(WM * WM) : null, inB = (u, v) => bmask ? !!bmask[Math.min(WM - 1, Math.max(0, Math.floor(v / S * WM))) * WM + Math.min(WM - 1, Math.max(0, Math.floor(u / S * WM)))] : false;
  const spDeco = [];
  // ---- chiese (punto d'interesse place_of_worship cristiano dentro la pianta): tetto a capanna lungo l'asse lungo, timpani in muratura
  // con rosone, portale, campanile in un angolo posteriore con cella campanaria e cuspide, cupola sul tamburo se la chiesa è grande
  const ringOut = c => { let a = 0; for (let i = 0; i < c.length; i++) { const p = c[i], q = c[(i + 1) % c.length]; a += p[0] * q[1] - q[0] * p[1] } return a < 0 ? c.slice().reverse() : c };
  const chList = [];
  const church = (ob, y1, yb0, col, hr, hr2, GW, GR) => { chList.push(ob.cu, ob.cv, y1);
    const ex = ob.ex, ez = ob.ez, px = -ez, pz = ex, L2 = ob.L / 2, W2 = ob.W / 2, o = .5, rh = Math.min(9, W2 * .6), yr = y1 + rh, tc = lin([.70, .38, .27]), stoneC = col.map(x => x * .96), ironC = lin([.18, .18, .19]);
    const P = (a, b, y) => [ob.cu + ex * a + px * b, y, ob.cv + ez * a + pz * b];
    let fs = 1; { let bd = [1e18, 1e18]; const ends = [P(L2, 0, 0), P(-L2, 0, 0)]; for (let e = 0; e < 2; e++) for (const R of RD) for (let q = 0; q < R.m; q += 2) { const d = (R.S2[q * 2] - ends[e][0]) ** 2 + (R.S2[q * 2 + 1] - ends[e][2]) ** 2; if (d < bd[e]) bd[e] = d } fs = bd[0] <= bd[1] ? 1 : -1 }
    // falde con sporto
    const Lu = L2 + o, c1 = P(-Lu, -W2 - o, y1 - .25), c2 = P(Lu, -W2 - o, y1 - .25), c3 = P(Lu, W2 + o, y1 - .25), c4 = P(-Lu, W2 + o, y1 - .25), r1 = P(-Lu, 0, yr), r2 = P(Lu, 0, yr), sl = Math.hypot(W2 + o, rh + .25);
    tri3(GR, [c1, c2, r2], tc, [[-Lu / 2, 0], [Lu / 2, 0], [Lu / 2, sl / 2]]); tri3(GR, [c1, r2, r1], tc, [[-Lu / 2, 0], [Lu / 2, sl / 2], [-Lu / 2, sl / 2]]);
    tri3(GR, [c3, c4, r1], tc, [[Lu / 2, 0], [-Lu / 2, 0], [-Lu / 2, sl / 2]]); tri3(GR, [c3, r1, r2], tc, [[Lu / 2, 0], [-Lu / 2, sl / 2], [Lu / 2, sl / 2]]);
    // sotto le falde (si vedono dal basso)
    tri3(GR, [c1, c2, r2], tc, [[0, 0], [0, 0], [0, 0]], [0, -1, 0]); tri3(GR, [c3, c4, r1], tc, [[0, 0], [0, 0], [0, 0]], [0, -1, 0]);
    // timpani (parte superiore della banda 16: muro senza finestre)
    const bv = bandV(16), bh = bv[1] - bv[0], vB = bv[1] - bh * 30 / 256, vT = bv[1] - bh * 13 / 256;   // striscia d'intonaco sopra la monofora
    for (const e of [1, -1]) { const a = P(e * L2, -W2, y1 - .3), b = P(e * L2, W2, y1 - .3), t = P(e * L2, 0, yr - .2); tri3(GW, [a, b, t], col, [[0, vB], [ob.W / 3, vB], [ob.W / 6, vT]], [-ex * e, 0, -ez * e]) }
    // rosone e portale sulla facciata
    { const fc = P(fs * (L2 + .06), 0, 0), d = Math.min(W2 * .75, rh * .7, 5); if (d > 1.2) texts.push({ k: 'ros', u: fc[0], v: fc[2], nx: ex * fs, nz: ez * fs, y: y1 + rh * .36, w: d, h: d });
      const pw = Math.min(3.4, Math.max(1.6, ob.W * .22)), ph = pw * 1.65; texts.push({ k: 'portale', u: fc[0], v: fc[2], nx: ex * fs, nz: ez * fs, y: yb0 + .4 + ph / 2, w: pw, h: ph }) }
    // campanile in un angolo posteriore
    const side = Math.max(3.6, Math.min(7.5, ob.W * .42)), Ht = Math.min(72, Math.max(y1 - yb0 + 9, (y1 - yb0) * 1.85 + 3)), sgS = hr2 < .5 ? 1 : -1;
    const tc0 = P(-fs * (L2 - side / 2 - .15), sgS * (W2 - side / 2 - .15), 0), cor = ringOut([[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [tc0[0] + (ex * a + px * b) * side / 2, tc0[2] + (ez * a + pz * b) * side / 2]));
    const yBel = yb0 + Ht - 5.6, yTop = yb0 + Ht;
    { let s0 = 0; for (let q = 0; q < 4; q++) { const [u0, v0] = cor[q], [u1, v1] = cor[(q + 1) % 4], Lq = Math.hypot(u1 - u0, v1 - v0); let y = yb0 - .3; while (y < yBel - .05) { const yn = Math.min(yBel, y + 3.6); wallB(GW, u0, v0, u1, v1, y, yn, stoneC, s0, 13, (yn - y) / 3.6); y = yn }
        wallB(GW, u0, v0, u1, v1, yBel, yTop - .9, stoneC, s0, 17, 1); wallB(GW, u0, v0, u1, v1, yTop - .9, yTop, stoneC, s0, 13, .25);
        walls.push((u0 + u1) / 2, (v0 + v1) / 2, (u1 - u0) / Lq, (v1 - v0) / Lq, Lq / 2, Ht); wY(yb0 - .3, yTop); s0 += Lq } }
    // cuspide (piramide) e croce
    { const ap = [tc0[0], yTop + side * 1.1, tc0[2]]; for (let q = 0; q < 4; q++) { const a = [cor[q][0], yTop, cor[q][1]], b = [cor[(q + 1) % 4][0], yTop, cor[(q + 1) % 4][1]], sl2 = Math.hypot(side / 2, side * 1.1); tri3(GR, [a, b, ap], tc, [[0, 0], [side / 2, 0], [side / 4, sl2 / 2]]) }
      box(MG, ap[0], ap[2], .14, .14, ap[1] - .2, ap[1] + 1.8, ironC); const bx = Math.abs(ex) > Math.abs(ez); box(MG, ap[0], ap[2], bx ? .8 : .14, bx ? .14 : .8, ap[1] + 1.05, ap[1] + 1.2, ironC) }
    // cupola su tamburo ottagonale (chiese grandi)
    if (ob.W > 16 && ob.L > 32) { const rd = Math.min(ob.W * .36, 15), cen = P(-fs * L2 * .3, 0, 0), yd0 = yr - rh * .35, hd = Math.max(3, rd * .55), yd1 = yd0 + hd, n8 = 8;
      const oc = ringOut(Array.from({ length: n8 }, (_, i) => [cen[0] + Math.cos(i / n8 * 2 * Math.PI) * rd, cen[2] + Math.sin(i / n8 * 2 * Math.PI) * rd]));
      { let s0 = 0; for (let q = 0; q < n8; q++) { const [u0, v0] = oc[q], [u1, v1] = oc[(q + 1) % n8]; wallB(GW, u0, v0, u1, v1, yd0, yd1, stoneC, s0, 16, .45); s0 += Math.hypot(u1 - u0, v1 - v0) } }
      const NL = 16, NJ = 6, dc = lin([.66, .36, .26]), pt = (i, j) => { const th = i / NL * 2 * Math.PI, la = j / NJ * Math.PI * .5 * .93, rr = rd * Math.cos(la) * (1 - .06 * Math.sin(la)); return [cen[0] + Math.cos(th) * rr, yd1 + rd * 1.12 * Math.sin(la), cen[2] + Math.sin(th) * rr] };
      for (let i = 0; i < NL; i++) for (let j = 0; j < NJ; j++) { const a = pt(i, j), b = pt(i + 1, j), c = pt(i + 1, j + 1), d = pt(i, j + 1), u0 = i / NL * 2 * Math.PI * rd / 2, u1 = (i + 1) / NL * 2 * Math.PI * rd / 2, w0 = j / NJ * rd * .9, w1 = (j + 1) / NJ * rd * .9, mid = [(a[0] + c[0]) / 2 - cen[0], 0, (a[2] + c[2]) / 2 - cen[2]];
        tri3(GR, [a, b, c], dc, [[u0, w0], [u1, w0], [u1, w1]], [-mid[0], .6, -mid[2]]); tri3(GR, [a, c, d], dc, [[u0, w0], [u1, w1], [u0, w1]], [-mid[0], .6, -mid[2]]) }
      // lanterna
      const top = pt(0, NJ)[1], lr = Math.max(.9, rd * .16), lo = ringOut(Array.from({ length: 8 }, (_, i) => [cen[0] + Math.cos(i / 8 * 2 * Math.PI) * lr, cen[2] + Math.sin(i / 8 * 2 * Math.PI) * lr]));
      { let s0 = 0; for (let q = 0; q < 8; q++) { const [u0, v0] = lo[q], [u1, v1] = lo[(q + 1) % 8]; wallB(GW, u0, v0, u1, v1, top - .3, top + lr * 2.2, stoneC, s0, 17, .6); s0 += Math.hypot(u1 - u0, v1 - v0) } }
      for (let q = 0; q < 8; q++) { const a = [lo[q][0], top + lr * 2.2, lo[q][1]], b = [lo[(q + 1) % 8][0], top + lr * 2.2, lo[(q + 1) % 8][1]]; tri3(GR, [a, b, [cen[0], top + lr * 3.6, cen[2]]], dc, [[0, 0], [lr / 2, 0], [lr / 4, lr]]) } stat.cupole = (stat.cupole || 0) + 1 } };

  // v31: passaggi sotto gli edifici (sottopassi, voltoni, gallerie che attraversano un edificio): una strada che taglia un lato a una quota
  // dentro l'altezza dell'edificio apre un vano nella facciata (la facciata resta solo sopra la volta, il muro di collisione si toglie nel vano);
  // dentro la sagoma si disegnano le pareti e il soffitto del passaggio (anche ostacoli). Restituisce i vani per lato: Map anello → [lato] → [[t0, t1, volta]]
  const passCol = lin([.70, .67, .60]), passCeil = lin([.62, .60, .55]);
  const passaggi = (rings, k, y0, y1) => { const vani = new Map(), tagli = new Map();
    for (const r of rings) { const n = r.length / 2, per = []; vani.set(r, per);
      for (let q = 0; q < n; q++) { const u0 = r[q * 2] * k, v0 = r[q * 2 + 1] * k, u1 = r[((q + 1) % n) * 2] * k, v1 = r[((q + 1) % n) * 2 + 1] * k, L2 = Math.hypot(u1 - u0, v1 - v0), g = []; per.push(g); if (L2 < .5) continue;
        const seen = new Set(); segNear((u0 + u1) / 2, (v0 + v1) / 2, L2 / 2 + 10, (P, pi, q2) => { const c2 = P.r.c; if (c2 === 'rail' || c2 === 'transit' || c2 === 'ferry' || seen.has(pi * 100003 + q2)) return; seen.add(pi * 100003 + q2);
          // galleria sotto l'edificio: la base della facciata (quota più bassa del terreno sotto la sagoma: vicino all'imbocco anche meno di 2 m
          // sopra la strada) entrava nella canna della galleria e la chiudeva (muro visibile e ostacolo dentro la galleria). Vano fino alla volta
          // (5,2 m + spessore) dove il lato sta dentro la larghezza della canna, anche vicino a uno spigolo dove l'asse non taglia il lato;
          // pareti e soffitto del passaggio no: li ha già la galleria
          if (P.r.tun) {
            const ax = P.S2[q2 * 2], ay = P.S2[q2 * 2 + 1], bx = P.S2[q2 * 2 + 2], by = P.S2[q2 * 2 + 3], sx = bx - ax, sy = by - ay, l2 = sx * sx + sy * sy || 1e-9, D = P.r.w / 2 + 1.2, du = (u1 - u0) / L2, dv = (v1 - v0) / L2; let ta = -1, tb = -1, vt = -1e9;
            const chiudi = () => { if (ta >= 0) { g.push([Math.max(0, ta - .3), Math.min(L2, tb + .3), Math.min(y1 - .5, vt)]); stat.galleriaSottoEdificio = (stat.galleriaSottoEdificio || 0) + 1 } ta = tb = -1; vt = -1e9 };
            for (let s = 0; s <= L2 + 1e-6; s += .5) { const su = u0 + du * Math.min(s, L2), sv = v0 + dv * Math.min(s, L2), tt = Math.max(0, Math.min(1, ((su - ax) * sx + (sv - ay) * sy) / l2)), d = Math.hypot(ax + sx * tt - su, ay + sy * tt - sv), hr = hAtQ(P, q2, tt) + liftOf(P.r);
              if (d < D && hr + 5.5 > y0 + .05 && hr + 3.6 <= y1) { if (ta < 0) ta = Math.min(s, L2); tb = Math.min(s, L2); vt = Math.max(vt, hr + 5.5) } else chiudi() } chiudi(); return }
          const X = segX(u0, v0, u1, v1, P.S2[q2 * 2], P.S2[q2 * 2 + 1], P.S2[q2 * 2 + 2], P.S2[q2 * 2 + 3]); if (!X) return; const hr = hAtQ(P, q2, X[1]) + liftOf(P.r);
          if (hr < y0 - 1.5 || hr + 3.6 > y1) return;
          const ex = (u1 - u0) / L2, ez = (v1 - v0) / L2, sx = P.S2[q2 * 2 + 2] - P.S2[q2 * 2], sz = P.S2[q2 * 2 + 3] - P.S2[q2 * 2 + 1], sl = Math.hypot(sx, sz) || 1, sn = Math.abs(ex * sz / sl - ez * sx / sl), hg = Math.min(8, (P.r.w / 2 + .45) / Math.max(.35, sn)), tc = X[0] * L2;
          g.push([Math.max(0, tc - hg), Math.min(L2, tc + hg), Math.min(y1 - .5, hr + 4.6)]); if (r === rings[0]) { let a = tagli.get(P); if (!a) tagli.set(P, a = []); a.push(sAt(P, q2, X[1])) } });
        g.sort((a, b) => a[0] - b[0]); for (let i = 1; i < g.length; i++) if (g[i][0] <= g[i - 1][1]) { g[i - 1][1] = Math.max(g[i - 1][1], g[i][1]); g[i - 1][2] = Math.max(g[i - 1][2], g[i][2]); g.splice(i--, 1) } } }
    // interno dei passaggi: fra due tagli consecutivi (o un taglio e un'estremità della strada dentro l'edificio) col punto medio dentro la sagoma
    const r0 = rings[0], dentro = (u, v) => pipRing(r0, k, u, v) && !rings.slice(1).some(h => pipRing(h, k, u, v)), at = (P, sv) => { let q = 0; while (q < P.m - 2 && P.s[q + 1] < sv) q++; const l = P.s[q + 1] - P.s[q] || 1e-9, tt = Math.max(0, Math.min(1, (sv - P.s[q]) / l)); return [P.S2[q * 2] + (P.S2[q * 2 + 2] - P.S2[q * 2]) * tt, P.S2[q * 2 + 1] + (P.S2[q * 2 + 3] - P.S2[q * 2 + 1]) * tt, hAtQ(P, q, tt) + liftOf(P.r), q] };
    for (const [P, ss] of tagli) { const b = ss.slice(); if (dentro(P.S2[0], P.S2[1])) b.push(0); if (dentro(P.S2[P.m * 2 - 2], P.S2[P.m * 2 - 1])) b.push(P.s[P.m - 1]); b.sort((x, y) => x - y);
      for (let i = 0; i + 1 < b.length; i++) { const sa = b[i], sb = b[i + 1]; if (sb - sa < .5) continue; const mid = at(P, (sa + sb) / 2); if (!dentro(mid[0], mid[1])) continue;
        const pts = [at(P, sa)]; for (let q = 0; q < P.m; q++) if (P.s[q] > sa + .2 && P.s[q] < sb - .2) pts.push([P.S2[q * 2], P.S2[q * 2 + 1], P.h[q] + liftOf(P.r), q]); pts.push(at(P, sb)); const hw = P.r.w / 2 + .35;
        for (let j = 0; j + 1 < pts.length; j++) { const A0 = pts[j], B0 = pts[j + 1], dx = B0[0] - A0[0], dz = B0[1] - A0[1], l = Math.hypot(dx, dz); if (l < .05) continue; const nx = -dz / l, nz = dx / l, va = Math.min(y1 - .5, A0[2] + 4.6), vb = Math.min(y1 - .5, B0[2] + 4.6);
          const Ra = [A0[0] + nx * hw, A0[1] + nz * hw], Rb = [B0[0] + nx * hw, B0[1] + nz * hw], La = [A0[0] - nx * hw, A0[1] - nz * hw], Lb = [B0[0] - nx * hw, B0[1] - nz * hw];
          const lib = (p0, p1) => barFree(p0[0], p0[1], A0[2], P.r, -.3, A0[0], A0[1]) && barFree(p1[0], p1[1], B0[2], P.r, -.3, B0[0], B0[1]) && barFree((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (A0[2] + B0[2]) / 2, P.r, -.3, (A0[0] + B0[0]) / 2, (A0[1] + B0[1]) / 2), libR = lib(Ra, Rb), libL = lib(La, Lb);   // niente parete attraverso un'altra strada (incroci dentro l'edificio)
          if (libR) wallS(MC, Ra[0], Ra[1], Rb[0], Rb[1], A0[2] - .3, va, B0[2] - .3, vb, passCol); if (libL) wallS(MC, Lb[0], Lb[1], La[0], La[1], B0[2] - .3, vb, A0[2] - .3, va, passCol);   // pareti verso la strada (n è la normale destra)
          tri3(MC, [[Ra[0], va, Ra[1]], [La[0], va, La[1]], [Lb[0], vb, Lb[1]]], passCeil, null, [0, -1, 0]); tri3(MC, [[Ra[0], va, Ra[1]], [Lb[0], vb, Lb[1]], [Rb[0], vb, Rb[1]]], passCeil, null, [0, -1, 0]);
          for (const [p0, p1, ok] of [[Ra, Rb, libR], [La, Lb, libL]]) if (ok) { walls.push((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, dx / l, dz / l, l / 2, 4.6); wY(Math.min(A0[2], B0[2]) - .3, Math.max(va, vb)) }
          stat.passaggi = (stat.passaggi || 0) + l } } }
    return vani };
  let nb = 0; stat.falde = 0; { const ly = L.building; if (ly) { const ext = ext0(ly), k = S / ext, cku = q => Math.min(BHIu * k, Math.max(BLOu * k, q * k)), ckv = q => Math.min(BHIv * k, Math.max(BLOv * k, q * k)); stat.edifici_dati = 0;
    for (let i = 0; i < ly.n; i++) { const f = ly.feat(i), p = f.props; if (f.type !== 3 || p.hide_3d) continue;
      for (const pg of polygons(f.parts)) { const rings = pg.map(r => clipRing(r, 0, ext)).filter(r => r.length >= 6); if (!rings.length) continue;
        // v31: sagome di OpenStreetMap che entrano nella carreggiata (vie strette dei centri storici, dove la larghezza della strada è stimata):
        // l'auto entrava nelle facciate o restava ferma. I vertici della sagoma dentro la carreggiata di una strada alla stessa quota si
        // spostano sul bordo della carreggiata, dal lato dove sta l'edificio (non per gallerie, ponti, sentieri, binari)
        { let cu0 = 0, cv0 = 0, cn0 = 0; for (let q = 0; q < rings[0].length; q += 2) { cu0 += rings[0][q]; cv0 += rings[0][q + 1]; cn0++ } cu0 = cu0 / cn0 * k; cv0 = cv0 / cn0 * k;
          for (const rg of rings) for (let q = 0; q < rg.length; q += 2) { let u = rg[q] * k, v = rg[q + 1] * k, mosso = false;
            for (let it = 0; it < 2; it++) segNear(u, v, 9, (P, pi, q2, dd, t2) => { if (nonConta(P)) return; const hw = P.r.w / 2 + .3; if (dd >= hw - .05) return;
              const ax = P.S2[q2 * 2], ay = P.S2[q2 * 2 + 1], sx = P.S2[q2 * 2 + 2] - ax, sy = P.S2[q2 * 2 + 3] - ay, l2 = sx * sx + sy * sy || 1e-9, tt = Math.max(0, Math.min(1, ((u - ax) * sx + (v - ay) * sy) / l2)), px = ax + sx * tt, py = ay + sy * tt, d = Math.hypot(u - px, v - py);
              if (d >= hw - .05 || Math.abs(hAtQ(P, q2, tt) + liftOf(P.r) - ghT(u, v)) > 1.5) return; const ll = Math.sqrt(l2); let nx = -sy / ll, ny = sx / ll; if ((cu0 - px) * nx + (cv0 - py) * ny < 0) { nx = -nx; ny = -ny }
              u = px + nx * hw; v = py + ny * hw; mosso = true });
            if (mosso) { rg[q] = u / k; rg[q + 1] = v / k; stat.sagomeSpostate = (stat.sagomeSpostate || 0) + 1 } } }
        let area = 0; for (const r of rings) area += ringArea(r) * k * k; if (area < 6) continue;
        let fa = 0; for (const r of pg) fa += ringArea(r) * k * k; const whole = rings.length === pg.length && rings.every((r, q) => r.length === pg[q].length);
        let ex = 0, ey = 0, ne = 0; for (let q = 0; q < pg[0].length; q += 2) { ex += pg[0][q]; ey += pg[0][q + 1]; ne++ } ex = ex / ne * k; ey = ey / ne * k;
        let cu = 0, cv = 0, cn = 0; for (let q = 0; q < rings[0].length; q += 2) { cu += rings[0][q]; cv += rings[0][q + 1]; cn++ } cu = cu / cn * k; cv = cv / cn * k;
        const hr = hsh(Math.round((mxL + ex / K) * 7), Math.round((myT - ey / K) * 7)), hr2 = hsh(Math.round((myT - ey / K) * 5) + 17, Math.round((mxL + ex / K) * 5) + 3);
        let top = +p.render_height || 0, low = +p.render_min_height || 0; const known = !(top === 5 && low === 0) && top > 0;
        if (known) stat.edifici_dati++;
        else { // altezza mancante in OpenStreetMap: stima dalla superficie e dalla densità della zona (piani da 3,2 m)
          let fl = fa < 40 ? 1 : fa < 110 ? 2 + Math.floor(hr * 2) : dens > .5 ? 4 + Math.floor(hr * 3) : dens > .25 ? 3 + Math.floor(hr * 3) : 2 + Math.floor(hr * 2);
          if (fa > 3000) fl = Math.min(fl, 3); top = fl * 3.2 + .8 }
        let spc = null; if (A && spPts.length) for (const sp of spPts) { if (Math.abs(sp.u - cu) > 150 || Math.abs(sp.v - cv) > 150) continue; if (pipRing(rings[0], k, sp.u, sp.v)) { spc = sp; break } }
        if (spc && spc.k === 'chiesa' && !known) top = Math.max(top, Math.min(24, 9 + Math.sqrt(fa) * .32));
        if (!A && top < 18) continue;
        if (bmask) fillPoly(rings, ext, WM, q => { bmask[q] = 1 });
        // stile
        const cci = cls[Math.min(CR - 1, Math.floor(cv / S * CR)) * CR + Math.min(CR - 1, Math.floor(cu / S * CR))], indZone = cci === CL.IND;
        let st; if (indZone && top <= 14) st = ST.IND; else if (fa < 190 && top <= 9.5) st = ST.CASA; else if (fa > 1500 && top <= 12 && !known) st = hr < .7 ? ST.IND : ST.CONDO;
        else if (top > 26) st = hr < .55 ? ST.UFFICI : ST.CONDO; else if (known && top > 15) st = hr < .5 ? ST.CONDO : hr < .8 ? ST.UFFICI : ST.STORICO;
        else if (dens > .3 && top <= 22) st = hr < .72 ? ST.STORICO : hr < .9 ? ST.PIETRA : ST.CONDO; else st = hr < .45 ? ST.CONDO : hr < .8 ? ST.STORICO : ST.PIETRA;
        if (spc) { if (spc.k === 'chiesa' || spc.k === 'culto') st = ST.PIETRA; else if (spc.k === 'ospedale') st = ST.CONDO; else st = ST.STORICO }
        const bands = STB[st], fh = st === ST.STORICO || st === ST.PIETRA ? 3.6 : st === ST.IND ? 4.5 : 3.2;
        // negozi al piano terra: dove OpenStreetMap ha un negozio o un locale a meno di 9 m dal perimetro (oppure, nei centri densi, a caso)
        let shop = false; if (st !== ST.IND && st !== ST.UFFICI && top >= 6) { const r0 = rings[0]; outer: for (let q = 0; q < shopPts.length; q += 2) { const pu = shopPts[q], pv = shopPts[q + 1]; if (Math.abs(pu - cu) > 60 || Math.abs(pv - cv) > 60) continue; const n = r0.length / 2; for (let e = 0; e < n; e++) { const ax = r0[e * 2] * k, ay = r0[e * 2 + 1] * k, bx = r0[((e + 1) % n) * 2] * k, by = r0[((e + 1) % n) * 2 + 1] * k, dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1e-9, t = Math.max(0, Math.min(1, ((pu - ax) * dx + (pv - ay) * dy) / l2)); if (Math.hypot(ax + dx * t - pu, ay + dy * t - pv) < 9) { shop = true; break outer } } } if (!shop && (st === ST.STORICO || st === ST.CONDO || st === ST.PIETRA) && dens > .3 && hr2 < .3) shop = true } if (spc) shop = false;
        let hraw = 1e9, hgr = 1e9; for (const r of pg) for (let q = 0; q < r.length; q += 2) { const hh = hAt(cku(r[q]), ckv(r[q + 1])); if (hh < hraw) hraw = hh }
        for (const r of rings) for (let q = 0; q < r.length; q += 2) { const hh = gh(r[q] * k, r[q + 1] * k); if (hh < hgr) hgr = hh }
        const yb0 = hraw - .4 + low, y0 = Math.min(yb0, hgr - .4 + low), y1 = hraw + top;
        const pal = PAL[st]; let col = p.colour ? hexRGB(p.colour) : null; if (!col) col = spc ? SPC[spc.k][Math.floor(hr * SPC[spc.k].length)].slice() : rgb(pal[Math.floor(hr * pal.length)]); col = lin(col.map(x => Math.min(1, x * (.94 + hr2 * .1))));
        const sb = sbOf(cu, cv), GW = A ? gbs(BWs, sb, true) : null;
        // piani: terra (alto gfl), intermedi, ultimo (banda con cornicione)
        const gfl = Math.min(st === ST.IND ? 5.5 : 4.4, Math.max(2.8, (y1 - yb0) > 6 ? fh + .6 : (y1 - yb0) * .55)), floors = [];
        if (low >= 2) { let y = y0; while (y < y1 - .05) { const yn = Math.min(y1, y + fh); floors.push([y, yn, yn >= y1 - .05 ? bands[2] : bands[1], (yn - y) / fh]); y = yn } }
        else { floors.push([y0, yb0 + gfl, shop ? SHOPB : bands[0], 1]); let y = yb0 + gfl; while (y < y1 - .05) { const yn = Math.min(y1, y + fh); floors.push([y, yn, yn >= y1 - .05 ? bands[2] : bands[1], (yn - y) / fh]); y = yn } }
        const isCh = !!(spc && spc.k === 'chiesa' && whole && rings.length === 1 && low < 2); if (isCh) { floors.length = 0; floors.push([y0, y1, 16, 1]) }
        let balcE = null; if (A && st === ST.CONDO && !spc) { const r0 = rings[0], n0 = r0.length / 2, ls = []; for (let q = 0; q < n0; q++) { const b = (q + 1) % n0; ls.push([Math.hypot(r0[b * 2] - r0[q * 2], r0[b * 2 + 1] - r0[q * 2 + 1]) * k, q]) } ls.sort((p, q) => q[0] - p[0]); balcE = new Set(ls.slice(0, 2).filter(p => p[0] >= 3.4).map(p => p[1])) }
        const vani = A && !isCh ? passaggi(rings, k, y0, y1) : null;
        for (const r of rings) { const n = r.length / 2; let s0 = hr2 * 3;
          for (let q = 0; q < n; q++) { const a = q, b = (q + 1) % n, ax = r[a * 2], ay = r[a * 2 + 1], bx = r[b * 2], by = r[b * 2 + 1];
            if ((ax === bx && (ax === 0 || ax === ext)) || (ay === by && (ay === 0 || ay === ext))) { s0 += Math.hypot(bx - ax, by - ay) * k; continue }   // bordo artificiale della cella: niente muro
            const u0 = ax * k, v0 = ay * k, u1 = bx * k, v1 = by * k, L2 = Math.hypot(u1 - u0, v1 - v0);
            const gaps = vani && vani.get(r) ? vani.get(r)[q] : null;
            if (A && gaps && gaps.length) { let ta = 0; const du = (u1 - u0) / L2, dv = (v1 - v0) / L2;
              const piece = (t0, t1, hb) => { if (t1 - t0 < .05) return; const pu0 = u0 + du * t0, pv0 = v0 + dv * t0, pu1 = u0 + du * t1, pv1 = v0 + dv * t1;
                for (const F of floors) { if (F[1] <= hb + .02) continue; const fb = Math.max(F[0], hb); wallB(GW, pu0, pv0, pu1, pv1, fb, F[1], col, s0 + t0, F[2], F[3] * (F[1] - fb) / (F[1] - F[0])) }
                if (hb > y0 + .01) { tri3(MC, [[pu0, hb, pv0], [pu1, hb, pv1], [pu1 - dv * .4, hb, pv1 + du * .4]], passCeil, null, [0, -1, 0]); tri3(MC, [[pu0, hb, pv0], [pu1 - dv * .4, hb, pv1 + du * .4], [pu0 - dv * .4, hb, pv0 + du * .4]], passCeil, null, [0, -1, 0]) }
                else if (t1 - t0 > .3) { walls.push((pu0 + pu1) / 2, (pv0 + pv1) / 2, du, dv, (t1 - t0) / 2, y1 - hraw); wY(y0, y1) } };
              for (const g of gaps) { piece(ta, g[0], y0); piece(g[0], g[1], g[2]); ta = g[1] } piece(ta, L2, y0); s0 += L2; continue }   /* v31: lato con passaggi */
            if (A) { for (const F of floors) wallB(GW, u0, v0, u1, v1, F[0], F[1], col, s0, F[2], F[3]);
              if (balcE && r === rings[0] && balcE.has(q)) { const du = (u1 - u0) / L2, dv = (v1 - v0) / L2, nx = dv, nz = -du, nb2 = Math.floor(L2 / 3), slabC = col.map(x => x * .9), parC = hr2 < .5 ? col.map(x => x * .96) : lin([.42, .43, .45]);
                for (let bq = 0; bq < nb2; bq++) { if (hsh(Math.round(u0 * 3) + bq * 31, Math.round(v0 * 3) + q * 7) > .42) continue; const sc = (bq + .5) * (L2 / nb2), cu2 = u0 + du * sc, cv2 = v0 + dv * sc;
                  for (let fi = 1; fi < floors.length; fi++) { const F = floors[fi]; if (F[1] - F[0] < 2.4) continue; const bw = Math.min(2.5, L2 / nb2 - .4); balc(MG, cu2 + nx * .02, cv2 + nz * .02, du, dv, nx, nz, bw, 1.15, F[0], slabC, parC) } } }
              if (L2 > .3) { walls.push((u0 + u1) / 2, (v0 + v1) / 2, (u1 - u0) / L2, (v1 - v0) / L2, L2 / 2, y1 - hraw); wY(y0, y1) }
              if (r === rings[0] && L2 > 1.2 && low < 2) { const e = { u0, v0, u1, v1, nx: (v1 - v0) / L2, nz: -(u1 - u0) / L2, L: L2, yb: yb0, gfl, shop, used: 0 }; edges.push(e); const kk = eKey((u0 + u1) / 2, (v0 + v1) / 2); let a = EH.get(kk); if (!a) EH.set(kk, a = []); a.push(e) } }
            else wall(MG, u0, v0, u1, v1, y0, y1, col, 0, 1);
            s0 += L2 } }
        // tetto
        const GR = A ? gbs(BRs, sb, true) : null;
        let pitched = false, ob = null;
        if (A && whole && rings.length === 1 && low < 2 && (st === ST.CASA || ((st === ST.STORICO || st === ST.PIETRA || st === ST.CONDO) && fa < 650 && top < 17))) { ob = obb(rings[0].map(v => v * k)); if (ob && ob.W > 3.5 && fa / ob.area > .78) pitched = true }
        if (isCh) { ob = obb(rings[0].map(v => v * k)); pitched = false; if (ob && ob.W > 4 && fa / ob.area > .55) { stat.chiese = (stat.chiese || 0) + 1; church(ob, y1, yb0, col, hr, hr2, GW, GR) } else pitched = !!ob }
        if (pitched) { stat.falde++; const o = .45, L2 = ob.L / 2 + o, W2 = ob.W / 2 + o, rh = Math.min(4.2, ob.W * .3 + .3), R = Math.max(0, ob.L / 2 - ob.W / 2), yr = y1 + rh, ex = ob.ex, ez = ob.ez, px = -ez, pz = ex;
          const P = (a, b, y) => [ob.cu + ex * a + px * b, y, ob.cv + ez * a + pz * b], c1 = P(-L2, -W2, y1), c2 = P(L2, -W2, y1), c3 = P(L2, W2, y1), c4 = P(-L2, W2, y1), r1 = P(-R, 0, yr), r2 = P(R, 0, yr), tc = hr2 < .3 ? tileB : tile;
          const sl = Math.hypot(W2, rh), uvA = [[-L2 / 2, 0], [L2 / 2, 0], [R / 2, sl / 2], [-R / 2, sl / 2]];
          tri3(GR, [c1, c2, r2], tc, [uvA[0], uvA[1], uvA[2]]); tri3(GR, [c1, r2, r1], tc, [uvA[0], uvA[2], uvA[3]]);
          tri3(GR, [c3, c4, r1], tc, [uvA[0], uvA[1], uvA[2]]); tri3(GR, [c3, r1, r2], tc, [uvA[0], uvA[2], uvA[3]]);
          tri3(GR, [c2, c3, r2], tc, [[-W2 / 2, 0], [W2 / 2, 0], [0, sl / 2]]); tri3(GR, [c4, c1, r1], tc, [[-W2 / 2, 0], [W2 / 2, 0], [0, sl / 2]]);
          // sottogronda (fascia sotto il bordo del tetto) e comignolo
          const eave = [c1, c2, c3, c4]; for (let q = 0; q < 4; q++) { const a = eave[q], b = eave[(q + 1) % 4]; wall(MG, a[0], a[2], b[0], b[2], y1 - .25, y1 + .02, col, 0, 1) }
          if (hr > .35) { const cx2 = ob.cu + ex * (R * (hr2 - .5)) + px * (ob.W * .12), cz2 = ob.cv + ez * (R * (hr2 - .5)) + pz * (ob.W * .12), hc = yr - rh * .12 + .9; box(MG, cx2, cz2, .5, .5, y1 + rh * .3, hc, chimC) } }
        else if (!(isCh && ob && ob.W > 4 && fa / ob.area > .55)) { const flat = [], holes = []; let nv = 0; for (const r of rings) { if (nv) holes.push(nv); for (let q = 0; q < r.length; q += 2) { flat.push(r[q] * k, r[q + 1] * k); nv++ } }
          const tri = earcut(flat, holes), b0 = MG.n, rc = st === ST.IND ? grav : top > 26 ? memb : hr2 < .5 ? grav : memb; for (let q = 0; q < nv; q++) MG.v(-flat[q * 2], y1, -flat[q * 2 + 1], 0, 1, 0, rc);
          for (let q = 0; q < tri.length; q += 3) { const a = tri[q], b = tri[q + 1], c = tri[q + 2], cr = (flat[b * 2] - flat[a * 2]) * (flat[c * 2 + 1] - flat[a * 2 + 1]) - (flat[b * 2 + 1] - flat[a * 2 + 1]) * (flat[c * 2] - flat[a * 2]); if (cr < 0) MG.I.push(b0 + a, b0 + b, b0 + c); else MG.I.push(b0 + a, b0 + c, b0 + b) }   // v31: tetto piano sempre verso l'alto
          if (A) { // parapetto e volumi tecnici
            const pc = col.map(x => x * .92); for (const r of rings) { const n = r.length / 2; for (let q = 0; q < n; q++) { const a = q, b = (q + 1) % n, ax = r[a * 2], ay = r[a * 2 + 1], bx = r[b * 2], by = r[b * 2 + 1]; if ((ax === bx && (ax === 0 || ax === ext)) || (ay === by && (ay === 0 || ay === ext))) continue; wall(MG, ax * k, ay * k, bx * k, by * k, y1 - .02, y1 + .5, pc, 0, 1) } }
            if (fa > 260 && whole && st !== ST.IND) { const o2 = obb(rings[0].map(v => v * k)); if (o2 && o2.W > 9) { const tx = o2.cu + o2.ex * (o2.L * .15 * (hr - .5)), tz = o2.cv + o2.ez * (o2.L * .15 * (hr - .5)); box(MG, tx, tz, 3.2, 2.8, y1, y1 + 2.7, techC); if (hr2 > .5) box(MG, tx + o2.ex * 4.5, tz + o2.ez * 4.5, 1.2, 1, y1, y1 + .9, techC) } } } }
        if (spc && A && spc.k !== 'chiesa' && spc.k !== 'culto') spDeco.push({ k: spc.k, cu, cv, name: spc.name, yb: yb0, top: y1 });
        nb++ } } } }
  const outs = arr => { const o = []; arr.forEach((g, i) => { const r = g && g.out(); if (r) { r.sb = i; o.push(r) } }); return o };
  const HG = new GB(false), extraTrees = [];
  // ================= Versione 28: rotatorie, frecce di direzione, distributori e aree di servizio, caselli, muretti e siepi =================
  const LATc = (2 * Math.atan(Math.exp(myT * 2 * Math.PI / ME)) - Math.PI / 2) * 180 / Math.PI, LONc = mxL * 360 / ME;
  const DRVc = { motorway: 1, trunk: 1, primary: 1, secondary: 1, tertiary: 1, minor: 1, service: 1, busway: 1 };
  const rowAt2 = (u, v) => { if (!ROW) return -1; const i = Math.floor(u / rpx), j = Math.floor(v / rpx); return i < 0 || j < 0 || i >= RHN || j >= RHN ? -2 : ROW[j * RHN + i] };
  const wetAt2 = (u, v) => wmask ? !!wmask[Math.min(WM - 1, Math.max(0, Math.floor(v / S * WM))) * WM + Math.min(WM - 1, Math.max(0, Math.floor(u / S * WM)))] : false;
  const nearEdge2 = (u, v, r) => { let best = null, bd = r; const i0 = Math.floor((u - r) / 16), i1 = Math.floor((u + r) / 16), j0 = Math.floor((v - r) / 16), j1 = Math.floor((v + r) / 16);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const a = EH.get(i + ',' + j); if (!a) continue; for (const e of a) { const dx = e.u1 - e.u0, dz = e.v1 - e.v0, l2 = dx * dx + dz * dz || 1e-9, t = Math.max(0, Math.min(1, ((u - e.u0) * dx + (v - e.v0) * dz) / l2)), px = e.u0 + dx * t, pz = e.v0 + dz * t, d = Math.hypot(px - u, pz - v); if (d < bd && e.L > 3) { bd = d; best = { e, t } } } } return best };
  const paintW = 10.5 / COLS;  // colonna "bianco pieno" dell'atlante della segnaletica
  const paint = (pts, y) => { const b0 = RG.n; for (const p of pts) RG.v(-p[0], y, -p[1], 0, 1, 0, [1, 1, 1], paintW, .5); for (let i = 1; i + 1 < pts.length; i++) { const a = pts[0], b = pts[i], c = pts[i + 1], A2 = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); if (A2 < 0) RG.I.push(b0, b0 + i, b0 + i + 1); else RG.I.push(b0, b0 + i + 1, b0 + i) } };
  // quota della superficie della strada R nel punto (u,v): proiezione sul suo asse
  const hOnR = (R, u, v) => { let bd = 1e18, by = R.h[0]; for (let q = 0; q < R.m - 1; q++) { const ax = R.S2[q * 2], ay = R.S2[q * 2 + 1], dx = R.S2[q * 2 + 2] - ax, dy = R.S2[q * 2 + 3] - ay, l2 = dx * dx + dy * dy || 1e-9, t = Math.max(0, Math.min(1, ((u - ax) * dx + (v - ay) * dy) / l2)), dd = (ax + dx * t - u) ** 2 + (ay + dy * t - v) ** 2; if (dd < bd) { bd = dd; by = R.h[q] + (R.h[q + 1] - R.h[q]) * t } } return by + liftOf(R.r) };
  // vernice (frecce, denti di squalo, linee): ogni vertice alla quota della superficie data da hf(u,v)
  const paintF = (pts, hf) => { const b0 = RG.n; for (const p of pts) RG.v(-p[0], hf(p[0], p[1]) + .022, -p[1], 0, 1, 0, [1, 1, 1], paintW, .5);
    for (let i = 1; i + 1 < pts.length; i++) { const a = pts[0], b = pts[i], c = pts[i + 1], A2 = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); if (A2 < 0) RG.I.push(b0, b0 + i, b0 + i + 1); else RG.I.push(b0, b0 + i + 1, b0 + i) } };
  const paintR = (pts, R) => paintF(pts, (u, v) => hOnR(R, u, v));
  const rbList = [];
  if (A) {
    // ---- rotatorie: OpenMapTiles non esporta junction=roundabout, quindi si riconoscono dalla forma: archi di strade a senso unico
    // che stanno su uno stesso cerchio (raggio 6–75 m) e che insieme coprono più di mezzo giro. Al centro: aiuola con cordolo, prato e alberi.
    // rotatorie: anelli chiusi di strade a senso unico (una sola via chiusa, o più vie collegate testa-coda) percorsi in senso antiorario,
    // quasi circolari (raggio 6–60 m); si usano i profili estesi, così l'anello si vede intero anche quando il bordo della cella lo taglia
    const cand = PR.filter(P => { const r = P.r; return r.one && !r.bridge && !r.tun && !r.ramp && P.m >= 3 && P.s[P.m - 1] <= 360 && P.s[P.m - 1] >= 4 && r.rank >= 3 && r.rank <= 7 }), usedC = new Set();
    for (const P0 of cand) { if (usedC.has(P0)) continue; const chain = [P0]; let cur = P0, closed = false;
      for (let it = 0; it < 10 && !closed; it++) { const eu = cur.S2[cur.m * 2 - 2], ev = cur.S2[cur.m * 2 - 1];
        if (Math.hypot(eu - P0.S2[0], ev - P0.S2[1]) < 1.6) { closed = true; break }
        let nx2 = null; for (const Q of cand) if (!usedC.has(Q) && !chain.includes(Q) && Math.hypot(Q.S2[0] - eu, Q.S2[1] - ev) < 1.6) { nx2 = Q; break } if (!nx2) break; chain.push(nx2); cur = nx2 }
      if (!closed) continue; for (const Q of chain) usedC.add(Q);
      const pts = []; for (const Q of chain) for (let q = 0; q < Q.m; q++) pts.push(Q.S2[q * 2], Q.S2[q * 2 + 1]); const fit = circFit(pts, pts.length / 2); if (!fit) continue; const [cu, cv, rr, res] = fit;
      if (rr < 6 || rr > 60 || res > Math.min(1.8, rr * .1) || cu < 0 || cv < 0 || cu >= S || cv >= S) continue;
      let sw = 0, a0 = Math.atan2(pts[1] - cv, pts[0] - cu); for (let q = 1; q <= pts.length / 2; q++) { const k2 = q % (pts.length / 2), a1 = Math.atan2(pts[k2 * 2 + 1] - cv, pts[k2 * 2] - cu); let da = a1 - a0; if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI; sw += da; a0 = a1 }
      if (sw > -5.5) continue;   // in Italia si gira in senso antiorario: in coordinate (est, sud) l'angolo diminuisce
      const g = chain.map(Q => ({ R: Q })), hw = Math.max(...chain.map(Q => Q.r.w / 2)), ri = rr - hw - .3; if (ri < 1.4) continue;
      // nessuna strada (o binario, o ponte) deve attraversare l'aiuola centrale
      const mine = new Set(chain.map(Q => Q.r)); let cross = false; segNear(cu, cv, ri + 6, (P, pi, q, dd) => { if (cross || mine.has(P.r) || P.r.tun) return; if (dd < ri - .3) cross = true }); if (cross) continue;
      const Rs = g.map(a => a.R), yAt = (u, v) => { let bd = 1e18, y = 0; for (const R2 of Rs) { let b2 = 1e18; for (let q = 0; q < R2.m; q++) { const dd = (R2.S2[q * 2] - u) ** 2 + (R2.S2[q * 2 + 1] - v) ** 2; if (dd < b2) b2 = dd } if (b2 < bd) { bd = b2; y = hOnR(R2, u, v) } } return y };
      stat.rotatorie = (stat.rotatorie || 0) + 1; const N = Math.max(16, Math.min(48, Math.round(ri * 3))), curbC = lin([.74, .73, .70]), gC = lin([.27, .40, .16]), ring = [];
      for (let q = 0; q < N; q++) { const a = q / N * 2 * Math.PI; ring.push(yAt(cu + Math.cos(a) * (ri + hw * .6), cv + Math.sin(a) * (ri + hw * .6))) }
      const hc = ring.reduce((x, y) => x + y, 0) / N + .16; rbList.push(cu, cv, ri, hc - .16);
      for (let q = 0; q < N; q++) { const q1 = (q + 1) % N, a0 = q / N * 2 * Math.PI, a1 = (q + 1) / N * 2 * Math.PI, y0 = ring[q], y1 = ring[q1];
        wallS(MC, cu + Math.cos(a0) * ri, cv + Math.sin(a0) * ri, cu + Math.cos(a1) * ri, cv + Math.sin(a1) * ri, y0 - .4, y0 + .16, y1 - .4, y1 + .16, curbC);
        const gi = gC.map(x => x * (.9 + hsh(q, Math.round(cu)) * .2)); tri3(MG, [[cu, hc + .05, cv], [cu + Math.cos(a0) * (ri - .04), y0 + .16, cv + Math.sin(a0) * (ri - .04)], [cu + Math.cos(a1) * (ri - .04), y1 + .16, cv + Math.sin(a1) * (ri - .04)]], gi) }
      // fascia bianca (linea di margine) sul bordo interno della carreggiata
      if (ri > 2.5) for (let q = 0; q < N; q++) { const a0 = q / N * 2 * Math.PI, a1 = (q + 1) / N * 2 * Math.PI, r0 = ri + .25, r1 = ri + .4; paintF([[cu + Math.cos(a0) * r0, cv + Math.sin(a0) * r0], [cu + Math.cos(a1) * r0, cv + Math.sin(a1) * r0], [cu + Math.cos(a1) * r1, cv + Math.sin(a1) * r1], [cu + Math.cos(a0) * r1, cv + Math.sin(a0) * r1]], yAt) }
      // alberi nell'aiuola: un platano (o un pino al centro-sud), corona di cipressi nelle rotatorie grandi
      if (ri > 3.5) extraTrees.push(-cu, hc, -cv, Math.min(1.3, .7 + ri * .04), LATc < 43.8 ? 3 : 2);
      if (ri > 11) for (let q = 0; q < 6; q++) { const a = q / 6 * 2 * Math.PI + .3; extraTrees.push(-(cu + Math.cos(a) * ri * .62), hc, -(cv + Math.sin(a) * ri * .62), .8, 4) }
      // dare precedenza: denti di squalo dove una strada entra nell'anello
      for (const R2 of RD) { if (R2.r.bridge || R2.r.tun || R2.r.rank < 3 || mine.has(R2.r)) continue; const m2 = R2.m; for (const e of [0, m2 - 1]) { const u = R2.S2[e * 2], v = R2.S2[e * 2 + 1], dd = Math.hypot(u - cu, v - cv); if (dd < rr - hw * .6 || dd > rr + hw * 1.6 + 2) continue;
          const q2 = e ? m2 - 2 : 1; let tx = R2.S2[q2 * 2] - u, tz = R2.S2[q2 * 2 + 1] - v; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl; if (Math.abs(tx * (u - cu) / dd + tz * (v - cv) / dd) < .55) continue; // deve allontanarsi dal centro
          if (R2.r.one && e === 0) continue; const hw2 = R2.r.w / 2, rx = tz, rz = -tx, base = rr + hw + .6, bu = cu + (u - cu) / dd * base, bv = cv + (v - cv) / dd * base, s0 = R2.r.one ? -hw2 + .3 : .25, s1 = hw2 - .3, nT = Math.max(2, Math.round((s1 - s0) / .75));
          for (let t = 0; t < nT; t++) { const a1 = s0 + (s1 - s0) * t / nT, a2 = s0 + (s1 - s0) * (t + .7) / nT, am = (a1 + a2) / 2; paintR([[bu + rx * a1, bv + rz * a1], [bu + rx * a2, bv + rz * a2], [bu + rx * am + tx * .6, bv + rz * am + tz * .6]], R2) } } } }
    // ---- frecce di direzione sull'asfalto prima degli incroci: le direzioni possibili si ricavano dalla geometria vera dell'incrocio
    { const NODE = new Map(), nk = (u, v) => Math.round(u / 3) + ',' + Math.round(v / 3), ends = [];
      for (const R of RD) { const r = R.r, m = R.m; if (!DRVc[r.c] || r.bridge || r.tun || m < 2) continue; for (const e of [0, m - 1]) { const u = R.S2[e * 2], v = R.S2[e * 2 + 1]; if (u < 3 || v < 3 || u > S - 3 || v > S - 3) continue; const q2 = e ? m - 2 : 1; let tx = R.S2[q2 * 2] - u, tz = R.S2[q2 * 2 + 1] - v; const tl = Math.hypot(tx, tz) || 1;
          const E = { R, e, u, v, ox: tx / tl, oz: tz / tl }; ends.push(E); const k = nk(u, v); let a = NODE.get(k); if (!a) NODE.set(k, a = []); a.push(E) } }
      for (const E of ends) { const R = E.R, r = R.r, m = R.m; if (r.rank < 4 || r.sty > 2 || R.s[m - 1] < 30 || (r.one && E.e === 0)) continue; const near = []; const k0 = E.u, k1 = E.v;
        for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) { const a = NODE.get((Math.round(k0 / 3) + di) + ',' + (Math.round(k1 / 3) + dj)); if (a) for (const F of a) if (F !== E && F.R !== R && Math.hypot(F.u - E.u, F.v - E.v) < 4.5) near.push(F) }
        if (near.length < 2) continue; const ax = -E.ox, az = -E.oz; let L = 0, Sx = 0, Rt = 0;   // ax,az: verso di marcia verso l'incrocio
        for (const F of near) { if (F.R.r.one && F.e === F.R.m - 1) continue; const cr = ax * F.oz - az * F.ox, dt = ax * F.ox + az * F.oz, ang = Math.atan2(cr, dt); if (Math.abs(ang) < .6) Sx = 1; else if (ang > 0 && ang < 2.6) Rt = 1; else if (ang < 0 && ang > -2.6) L = 1 }
        if (L + Sx + Rt === 0) continue; stat.frecce = (stat.frecce || 0) + 1;
        const hw = r.w / 2, lanes = r.one ? Math.max(1, Math.round(r.w / 3.3)) : 1, y0 = (E.e ? R.h[m - 1] : R.h[0]) + liftOf(r) + .022;
        for (let ln = 0; ln < lanes; ln++) { const off = r.one ? (-hw + r.w * (ln + .5) / lanes) : hw / 2;
          const showL = L && (lanes === 1 || ln === 0), showR = Rt && (lanes === 1 || ln === lanes - 1), showS = Sx || (!showL && !showR);
          // la freccia sta sulla strada vera (ascissa curvilinea dist dall'incrocio), orientata col verso di marcia in quel punto
          for (const dist of [10, 30]) { if (dist + 6 > R.s[m - 1]) continue; const sv = E.e ? R.s[m - 1] - dist : dist; let q = 0; while (q < m - 2 && R.s[q + 1] < sv) q++; const tq = Math.max(0, Math.min(1, (sv - R.s[q]) / (R.s[q + 1] - R.s[q] || 1e-9)));
            let fx = R.S2[q * 2 + 2] - R.S2[q * 2], fz = R.S2[q * 2 + 3] - R.S2[q * 2 + 1]; const fl = Math.hypot(fx, fz) || 1; fx = fx / fl * (E.e ? 1 : -1); fz = fz / fl * (E.e ? 1 : -1);
            const ax2 = fx, az2 = fz, lx = -az2, lz = ax2, pu = R.S2[q * 2] + (R.S2[q * 2 + 2] - R.S2[q * 2]) * tq, pv = R.S2[q * 2 + 1] + (R.S2[q * 2 + 3] - R.S2[q * 2 + 1]) * tq, bu = pu + lx * off, bv = pv + lz * off;
            const at = (x, y) => [bu + lx * x + ax2 * y, bv + lz * x + az2 * y], seg = (x0, y0_, x1, y1, w) => { const dx = x1 - x0, dy = y1 - y0_, l = Math.hypot(dx, dy) || 1, ux = -dy / l * w / 2, uy = dx / l * w / 2; paintR([at(x0 + ux, y0_ + uy), at(x1 + ux, y1 + uy), at(x1 - ux, y1 - uy), at(x0 - ux, y0_ - uy)], R) };
            const head = (x, y, dx, dy, w, l) => { paintR([at(x + dx * l, y + dy * l), at(x - dy * w / 2, y + dx * w / 2), at(x + dy * w / 2, y - dx * w / 2)], R) };
            if (showS) { seg(0, 0, 0, 3.4, .16); head(0, 3.4, 0, 1, .62, 1.5) } else seg(0, 0, 0, 2.3, .16);
            if (showR) { seg(0, 2.2, .75, 3.0, .16); head(.75, 3.0, .707, .707, .55, 1.05) }
            if (showL) { seg(0, 2.2, -.75, 3.0, .16); head(-.75, 3.0, -.707, .707, .55, 1.05) } } } } }
  }
  // ---- distributori di carburante (punto d'interesse fuel), aree di servizio (distributore a meno di 160 m da autostrade e superstrade), caselli (toll_booth)
  const aprons = [];
  if (A) { const ly = L.poi; if (ly) { const k = S / ext0(ly);
    for (let i = 0; i < ly.n; i++) { const f = ly.feat(i), p = f.props; if (f.type !== 1) continue; const pt = f.parts[0]; if (!pt) continue; const u = pt[0] * k, v = pt[1] * k; if (u < 8 || v < 8 || u > S - 8 || v > S - 8) continue;
      const isFuel = p.class === 'fuel' && p.subclass === 'fuel', isToll = p.class === 'toll_booth' || p.subclass === 'toll_booth'; if (!isFuel && !isToll) continue;
      let best = null, bd = 1e18; for (const R of RD) { if (R.r.bridge || R.r.tun || !DRVc[R.r.c]) continue; if (isToll && !(R.r.c === 'motorway' || R.r.c === 'trunk' || R.r.c === 'primary')) continue; for (let q = 0; q < R.m; q++) { const d = (R.S2[q * 2] - u) ** 2 + (R.S2[q * 2 + 1] - v) ** 2; if (d < bd) { bd = d; best = [R, q] } } }
      if (!best || bd > (isToll ? 45 * 45 : 90 * 90)) continue; const [R, q] = best, m = R.m, qa = Math.max(0, q - 1), qb = Math.min(m - 1, q + 1); let tx = R.S2[qb * 2] - R.S2[qa * 2], tz = R.S2[qb * 2 + 1] - R.S2[qa * 2 + 1]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
      const ru = R.S2[q * 2], rv = R.S2[q * 2 + 1], hw = R.r.w / 2, y = R.h[q] + liftOf(R.r), white = lin([.93, .93, .91]), grey = lin([.55, .56, .58]), nm = p['name:it'] || p.name || '';
      if (isToll) { // casello: pensilina sopra la carreggiata, cabine ai bordi (le corsie restano libere), cartelli
        stat.caselli = (stat.caselli || 0) + 1; const W = R.r.w + 9, D = 9, nx = -tz, nz = tx, b = brandOf('');
        obox(MG, ru, rv, nx, nz, W, D, y + 5.6, y + 6.4, white); obox(MG, ru - tx * (D / 2 - .1), rv - tz * (D / 2 - .1), nx, nz, W, .25, y + 5.3, y + 6.6, lin([.05, .42, .2]));
        for (const sd of [-1, 1]) { const cu2 = ru + nx * sd * (hw + 1.6), cv2 = rv + nz * sd * (hw + 1.6); obox(MC, cu2, cv2, tx, tz, 7, 1.6, y - .1, y + .2, lin([.7, .7, .68])); obox(MG, cu2, cv2, tx, tz, 2.2, 1.4, y + .2, y + 2.6, white); obox(MG, cu2, cv2, tx, tz, 2.3, 1.5, y + 2.6, y + 2.8, grey);
          for (const e of [-1, 1]) obox(MG, cu2 + tx * e * 3, cv2 + tz * e * 3, tx, tz, .4, .4, y, y + 5.6, grey); walls.push(cu2, cv2, tx, tz, 3.6, 2.8); wY(y, y + 2.8) }
        texts.push({ k: 'ins', txt: nm ? nm.toUpperCase() : 'STAZIONE AUTOSTRADALE', sub: 'ALT · PEDAGGIO', bg: '#0b6b33', fg: '#ffffff', u: ru - tx * (D / 2 + .05), v: rv - tz * (D / 2 + .05), nx: -tx, nz: -tz, y: y + 5.95, w: Math.min(W - 1, 9), h: .9 }); continue }
      // distributore: si sposta la pensilina fuori dalla carreggiata, dalla parte del punto
      const sd = ((u - ru) * -tz + (v - rv) * tx) >= 0 ? 1 : -1, nx = -tz * sd, nz = tx * sd, serv = R.r.c === 'motorway' || R.r.c === 'trunk', W = serv ? 22 : 13, D = serv ? 10 : 8.5;
      let dist = Math.max(hw + 3 + D / 2, (u - ru) * nx + (v - rv) * nz); const cu = ru + nx * dist, cv = rv + nz * dist;
      if (inB(cu, cv) || inB(cu + tx * W / 2, cv + tz * W / 2) || inB(cu - tx * W / 2, cv - tz * W / 2)) continue; stat.distributori = (stat.distributori || 0) + 1;
      const br = brandOf(nm), fasc = hexRGB(br[1]) || [.1, .4, .2], gy = gh(cu, cv), yb = Math.max(gy, y - .3) + .05;
      // piazzale in asfalto chiaro (colonna 7)
      { const b0 = RG.n, ua = 7 / COLS + .004, ub = 8 / COLS - .004, ext = [[-W / 2 - 4, -D / 2 - 3], [W / 2 + 4, -D / 2 - 3], [W / 2 + 4, D / 2 + 2], [-W / 2 - 4, D / 2 + 2]];
        for (const [a, c] of ext) RG.v(-(cu + tx * a + nx * c), yb + .02, -(cv + tz * a + nz * c), 0, 1, 0, [1, 1, 1], a < 0 ? ua : ub, c / 10); const A2 = (() => { const p0 = ext[0], p1 = ext[1], p2 = ext[2]; const P0 = [cu + tx * p0[0] + nx * p0[1], cv + tz * p0[0] + nz * p0[1]], P1 = [cu + tx * p1[0] + nx * p1[1], cv + tz * p1[0] + nz * p1[1]], P2 = [cu + tx * p2[0] + nx * p2[1], cv + tz * p2[0] + nz * p2[1]]; return (P1[0] - P0[0]) * (P2[1] - P0[1]) - (P1[1] - P0[1]) * (P2[0] - P0[0]) })();
        if (A2 < 0) RG.I.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3); else RG.I.push(b0, b0 + 2, b0 + 1, b0, b0 + 3, b0 + 2);
        const PP = ext.map(([a, c2]) => [cu + tx * a + nx * c2, cv + tz * a + nz * c2]), yy = yb + .02; aprons.push(PP);
        for (let q = 0; q < 4; q++) { const P0 = PP[q], P1 = PP[(q + 1) % 4]; for (const [X0, X1] of [[P0, P1], [P1, P0]]) wallS(MG, X0[0], X0[1], X1[0], X1[1], Math.min(yy - .5, ghT(X0[0], X0[1]) - .4), yy, Math.min(yy - .5, ghT(X1[0], X1[1]) - .4), yy, lin([.45, .44, .42])) } }
      // pensilina, pilastri, isole con le colonnine
      obox(MG, cu, cv, tx, tz, W, D, yb + 4.9, yb + 5.5, white); obox(MG, cu - nx * (D / 2), cv - nz * (D / 2), tx, tz, W + .1, .14, yb + 4.8, yb + 5.6, lin(fasc)); obox(MG, cu + nx * (D / 2), cv + nz * (D / 2), tx, tz, W + .1, .14, yb + 4.8, yb + 5.6, lin(fasc));
      const isl = serv ? [-6.5, 0, 6.5] : [-3, 3]; for (const a of isl) { const iu = cu + tx * a, iv = cv + tz * a; obox(MC, iu, iv, nx, nz, 5, 1.1, yb - .1, yb + .16, lin([.72, .72, .70])); obox(MG, iu, iv, nx, nz, .38, .38, yb + .16, yb + 4.9, grey);
        for (const e of [-1.5, 1.5]) { obox(MG, iu + nx * e, iv + nz * e, nx, nz, .55, .4, yb + .16, yb + 1.85, lin([.85, .85, .83])); obox(MG, iu + nx * e, iv + nz * e, nx, nz, .56, .41, yb + 1.85, yb + 2.1, lin(fasc)) } walls.push(iu, iv, nx, nz, 2.6, 2); wY(yb, yb + 2.1) }
      // totem del marchio a bordo strada (solo nome e colori, niente loghi)
      { const tu = ru + nx * (hw + 2.2) + tx * (W / 2 + 3), tv = rv + nz * (hw + 2.2) + tz * (W / 2 + 3); obox(MG, tu, tv, tx, tz, 1.6, .5, gh(tu, tv) - .2, gh(tu, tv) + 6, lin(hexRGB(br[2]) || [1, 1, 1]));
        texts.push({ k: 'ins', txt: nm ? nm.toUpperCase() : 'CARBURANTE', sub: serv ? 'AREA DI SERVIZIO' : 'CARBURANTE', bg: br[1], fg: br[2], u: tu, v: tv, nx: -nx, nz: -nz, y: gh(tu, tv) + 4.8, w: 1.55, h: 1.6, free: 1 }); walls.push(tu, tv, tx, tz, .8, 6); wY(gh(tu, tv), gh(tu, tv) + 6) }
      if (serv) { // area di servizio: edificio del ristoro con vetrine e insegna
        const bu = cu + nx * (D / 2 + 9), bv = cv + nz * (D / 2 + 9); if (!inB(bu, bv)) { const by = gh(bu, bv), Wb = 18, Db = 11, c0 = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [bu + tx * a * Wb / 2 + nx * b * Db / 2, bv + tz * a * Wb / 2 + nz * b * Db / 2]), cr = ringOut(c0), GWs = gbs(BWs, sbOf(bu, bv), true);
          let s0 = 0; for (let q = 0; q < 4; q++) { const [u0, v0] = cr[q], [u1, v1] = cr[(q + 1) % 4], Lq = Math.hypot(u1 - u0, v1 - v0); wallB(GWs, u0, v0, u1, v1, by - .3, by + 4.6, lin([.92, .91, .88]), s0, 15, 1.2); walls.push((u0 + u1) / 2, (v0 + v1) / 2, (u1 - u0) / Lq, (v1 - v0) / Lq, Lq / 2, 5); wY(by - .3, by + 4.6); s0 += Lq }
          tri3(MG, [[cr[0][0], by + 4.6, cr[0][1]], [cr[1][0], by + 4.6, cr[1][1]], [cr[2][0], by + 4.6, cr[2][1]]], lin([.5, .5, .5])); tri3(MG, [[cr[0][0], by + 4.6, cr[0][1]], [cr[2][0], by + 4.6, cr[2][1]], [cr[3][0], by + 4.6, cr[3][1]]], lin([.5, .5, .5]));
          texts.push({ k: 'ins', txt: 'AREA DI SERVIZIO', sub: 'BAR · RISTORO', bg: '#1a3c6e', fg: '#ffffff', u: bu - nx * (Db / 2 + .08), v: bv - nz * (Db / 2 + .08), nx: -nx, nz: -nz, y: by + 3.9, w: 6, h: .9 }) } } } } }
  // ---- muretti a secco, muri di sostegno e siepi lungo le strade fuori città (non nei centri abitati, non su ponti e gallerie)
  if (A && !cityish) { const south = LATc < 42.6, lig = LATc > 43.7 && LATc < 44.6 && LONc > 7.4 && LONc < 10.1, po = LATc > 44.6 && LATc < 45.9 && LONc > 7 && LONc < 12.6, tos = LATc > 42.5 && LATc < 44.3 && LONc > 9.8 && LONc < 12.6, stoneC = lin([.64, .61, .56]), hedgeC = lin([.17, .30, .12]);
    const pWall = south || lig ? .4 : tos ? .3 : po ? .06 : .16, pHedge = po ? .36 : tos ? .15 : .18;
    // libero: nessuna altra strada (né ponte, né binario) a meno di rr metri dal suo bordo
    const free = (u, v, R, rr) => { let ok = true; segNear(u, v, rr + 9, (P, pi, q, dd) => { if (!ok || P.r.tun) return; if (P.r === R.r) { if (dd < P.r.w / 2 + .4) ok = false; return } if (dd < P.r.w / 2 + rr) ok = false }); return ok };
    for (const R of RD) { const r = R.r, m = R.m; if (r.bridge || r.tun || r.shallow || r.sty === 9 || r.sty === 5 || !(r.c === 'minor' || r.c === 'tertiary' || r.c === 'secondary' || r.c === 'track') || m < 3 || R.s[m - 1] < 40 || Math.hypot(R.S2[0] - R.S2[m * 2 - 2], R.S2[1] - R.S2[m * 2 - 1]) < 2) continue; const hw = r.w / 2, lift = liftOf(r), S2 = R.S2;
      for (const sgn of [1, -1]) { let q = 0;
        while (q < m - 1) { const run = 40 + hsh(Math.round(S2[q * 2]) + sgn * 5, Math.round(S2[q * 2 + 1])) * 90, rnd = hsh(Math.round(S2[q * 2] * 3) + sgn, Math.round(S2[q * 2 + 1] * 3) + 11); let q1 = q; while (q1 < m - 1 && R.s[q1] - R.s[q] < run) q1++;
          const kind = rnd < pWall ? 1 : rnd < pWall + pHedge ? 2 : 0;
          for (let e = q; e < q1; e++) { if (R.s[e] < 6 || R.s[e + 1] > R.s[m - 1] - 6) continue; const qa = Math.max(0, e - 1), qb = Math.min(m - 1, e + 1); let tx = S2[qb * 2] - S2[qa * 2], tz = S2[qb * 2 + 1] - S2[qa * 2 + 1]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl; const nx = -tz * sgn, nz = tx * sgn;
            const off = hw + (kind === 2 ? 1.1 : .75), au = S2[e * 2] + nx * off, av = S2[e * 2 + 1] + nz * off, bu = S2[e * 2 + 2] + nx * off, bv = S2[e * 2 + 3] + nz * off, yA = R.h[e] + lift, yB = R.h[e + 1] + lift;
            if (au < 1 || av < 1 || au > S - 1 || av > S - 1 || bu < 1 || bv < 1 || bu > S - 1 || bv > S - 1 || inB(au, av) || inB(bu, bv) || wetAt2(au, av)) continue;
            if (!free(au, av, R, 3.5) || !free(bu, bv, R, 3.5) || !free((au + bu) / 2, (av + bv) / 2, R, 3.5)) continue;
            const L2 = Math.hypot(bu - au, bv - av); if (L2 < .2) continue;
            // muro di sostegno dal lato a monte, solo dove la scarpata vera (dopo lo scavo della strada) supera 1,2 m e non c'è altro vicino
            const gA = ghT(au + nx * 3.2, av + nz * 3.2), gB = ghT(bu + nx * 3.2, bv + nz * 3.2), up = Math.min(gA - yA, gB - yB);
            if (up > 2 && r.c !== 'track' && free(au + nx * 6, av + nz * 6, R, 4)) { const tA = Math.min(yA + 2.6, gA + .2), tB = Math.min(yB + 2.6, gB + .2); wallS(MS, sgn > 0 ? au : bu, sgn > 0 ? av : bv, sgn > 0 ? bu : au, sgn > 0 ? bv : av, (sgn > 0 ? yA : yB) - .3, sgn > 0 ? tA : tB, (sgn > 0 ? yB : yA) - .3, sgn > 0 ? tB : tA, stoneC); stat.sostegno = (stat.sostegno || 0) + L2; continue }
            if (!kind) continue;
            // v31: siepi e muretti erano messi alla quota della strada senza guardare il terreno dove stanno: sul lato a valle di un rilevato
            // restavano sospesi nel vuoto (muri verdi alti visti da sotto), sul lato a monte affondavano nel pendio. Solo dove il terreno è alla quota della strada
            if (Math.abs(ghT(au, av) - yA) > .5 || Math.abs(ghT(bu, bv) - yB) > .5 || Math.abs(ghT((au + bu) / 2, (av + bv) / 2) - (yA + yB) / 2) > .5) { stat.siepeTolta = (stat.siepeTolta || 0) + L2; continue }
            if (kind === 1) { const ht = .85 + hsh(e, 3) * .25, ou = nx * .5, ov = nz * .5;
              wallS(MS, sgn > 0 ? au : bu, sgn > 0 ? av : bv, sgn > 0 ? bu : au, sgn > 0 ? bv : av, (sgn > 0 ? yA : yB) - .25, (sgn > 0 ? yA : yB) + ht, (sgn > 0 ? yB : yA) - .25, (sgn > 0 ? yB : yA) + ht, stoneC);
              wallS(MS, sgn > 0 ? bu + ou : au + ou, sgn > 0 ? bv + ov : av + ov, sgn > 0 ? au + ou : bu + ou, sgn > 0 ? av + ov : bv + ov, (sgn > 0 ? yB : yA) - .25, (sgn > 0 ? yB : yA) + ht, (sgn > 0 ? yA : yB) - .25, (sgn > 0 ? yA : yB) + ht, stoneC);
              tri3(MS, [[au, yA + ht, av], [bu, yB + ht, bv], [bu + ou, yB + ht, bv + ov]], stoneC); tri3(MS, [[au, yA + ht, av], [bu + ou, yB + ht, bv + ov], [au + ou, yA + ht, av + ov]], stoneC);
              walls.push((au + bu) / 2 + ou / 2, (av + bv) / 2 + ov / 2, (bu - au) / L2, (bv - av) / L2, L2 / 2 + .05, ht + .3); wY(Math.min(yA, yB) - .25, Math.max(yA, yB) + ht); stat.muretti = (stat.muretti || 0) + L2 }
            else { const ht = 1.3 + hsh(e, 5) * .5, ou = nx * .9, ov = nz * .9, hc = hedgeC.map(x => x * (.85 + hsh(e, 7) * .3));
              wallS(HG, sgn > 0 ? au : bu, sgn > 0 ? av : bv, sgn > 0 ? bu : au, sgn > 0 ? bv : av, (sgn > 0 ? yA : yB) - .2, (sgn > 0 ? yA : yB) + ht, (sgn > 0 ? yB : yA) - .2, (sgn > 0 ? yB : yA) + ht, hc);
              wallS(HG, sgn > 0 ? bu + ou : au + ou, sgn > 0 ? bv + ov : av + ov, sgn > 0 ? au + ou : bu + ou, sgn > 0 ? av + ov : bv + ov, (sgn > 0 ? yB : yA) - .2, (sgn > 0 ? yB : yA) + ht, (sgn > 0 ? yA : yB) - .2, (sgn > 0 ? yA : yB) + ht, hc);
              tri3(HG, [[au, yA + ht, av], [bu, yB + ht, bv], [bu + ou, yB + ht, bv + ov]], hc); tri3(HG, [[au, yA + ht, av], [bu + ou, yB + ht, bv + ov], [au + ou, yA + ht, av + ov]], hc);
              walls.push((au + bu) / 2 + ou / 2, (av + bv) / 2 + ov / 2, (bu - au) / L2, (bv - av) / L2, L2 / 2 + .05, ht); wY(Math.min(yA, yB) - .2, Math.max(yA, yB) + ht); stat.siepi = (stat.siepi || 0) + L2 } }
          q = q1 } } } }
  // ---- segni degli edifici speciali: croce rossa sugli ospedali, bandiere su scuole e municipi, orologio sulle stazioni
  for (const d of spDeco) { const ne = nearEdge2(d.cu, d.cv, 60); if (!ne) continue; const e = ne.e, t = .5, pu = e.u0 + (e.u1 - e.u0) * t, pv = e.v0 + (e.v1 - e.v0) * t;
    if (d.k === 'ospedale') texts.push({ k: 'ico', ico: 'croce', u: pu, v: pv, nx: e.nx, nz: e.nz, y: Math.min(d.top - 1.5, e.yb + 7), w: 1.6, h: 1.6 });
    else if (d.k === 'stazione') texts.push({ k: 'ico', ico: 'orologio', u: pu, v: pv, nx: e.nx, nz: e.nz, y: Math.min(d.top - 1.4, e.yb + 7.5), w: 1.5, h: 1.5 });
    else if (d.k === 'scuola' || d.k === 'municipio' || d.k === 'polizia') { const ang = Math.atan2(-e.nx, -e.nz), fy = e.yb + Math.min(e.gfl + 1.2, 5.2); objs.push(9, pu + e.nx * .12, fy, pv + e.nz * .12, ang, 1); if (d.k === 'municipio') objs.push(10, pu + e.nx * .12 + (e.u1 - e.u0) / e.L * 1.4, fy, pv + e.nz * .12 + (e.v1 - e.v0) / e.L * 1.4, ang, 1) } }

  // --- alberi: boschi fitti, parchi radi (istanze: u, quota, v, scala, tipo)
  const LAT = (2 * Math.atan(Math.exp(myT * 2 * Math.PI / ME)) - Math.PI / 2) * 180 / Math.PI, LON = mxL * 360 / ME, PO = LAT > 44.6 && LAT < 45.9 && LON > 7 && LON < 12.6, TOS = LAT > 42.5 && LAT < 44.3 && LON > 9.8 && LON < 12.6;
  // Versione 29: nessun albero sulle strade, sui binari o sui ponti (la chioma resta fuori dalla carreggiata); chiome meno enormi
  const CRAD = [1.9, 1.7, 2.6, 3.4, .85, 2.1, 1.3], treeOK = (u, v, rad) => { let ok = true; segNear(u, v, rad + 8, (P, pi, q, dd) => { if (!ok || P.r.tun) return; if (dd < P.r.w / 2 + rad) ok = false }); return ok };
  const trees = []; if (A) { const st = 11; for (let v = st / 2; v < S; v += st) for (let u = st / 2; u < S; u += st) { const ci = Math.min(CR - 1, Math.floor(v / S * CR)) * CR + Math.min(CR - 1, Math.floor(u / S * CR)), c = cls[ci], r = hsh(Math.round(u) + cx * 7, Math.round(v) + cy * 13);
      const pr = c === CL.WOOD ? (lcF[ci] ? .5 : .82) : c === CL.PARK ? .22 : c === CL.VINE ? .1 : c === CL.GRASS ? .05 : c === CL.NONE ? .03 : 0; if (r >= pr) continue;
      const uu = u + (hsh(Math.round(u * 3), Math.round(v * 5)) - .5) * st * .8, vv = v + (hsh(Math.round(v * 3), Math.round(u * 5)) - .5) * st * .8; if (wmask) { const wi = Math.min(WM - 1, Math.floor(vv / S * WM)) * WM + Math.min(WM - 1, Math.floor(uu / S * WM)); if (wmask[wi]) continue }
      if (inB(uu, vv)) continue; const h = ghT(uu, vv), r2 = hsh(Math.round(vv * 7) + 3, Math.round(uu * 7) + 11); let ty = 0, sc2 = .75 + r * 1.6;
      if (c === CL.WOOD) ty = h > 950 ? 1 : (r2 < (LAT < 44.3 ? .35 : .12) ? 3 : 0); else if (c === CL.VINE) { ty = LAT < 44.4 && r2 < .8 ? 5 : 0; sc2 = .6 + r * .5 } else if (c === CL.FARM) { ty = PO ? 6 : TOS ? 4 : (LAT < 43.5 && r2 < .5 ? 5 : 0); sc2 = .9 + r * .8 } else if (c === CL.PARK) ty = r2 < .35 ? 2 : (r2 < .5 && TOS ? 4 : 0); else if (c === CL.NONE) ty = h > 950 ? 1 : (LAT < 43.8 && r2 < .4 ? 3 : 0);
      if (ty === 3) sc2 = Math.min(sc2, 1.55); else if (ty === 0 || ty === 2) sc2 = Math.min(sc2, 1.9);
      if (!treeOK(uu, vv, Math.max(1.3, CRAD[ty] * sc2 * .8))) continue;
      trees.push(-uu, h, -vv, sc2, ty); if (trees.length >= 5 * 3000) break } }
  for (let i = 0; i < extraTrees.length; i++) trees.push(extraTrees[i]);
  // --- arredo urbano lungo le strade: lampioni, auto parcheggiate, alberi dei viali; rete per il traffico
  const lamps = [], parked = [], nav = [];
  for (const [pu, pv, py, ico, fx, fz] of signQ) { if (inB(pu, pv) || !libero(pu, pv)) continue; /* v31: niente cartelli dentro la strada che incrocia */ objs.push(7, pu, py, pv, 0, 1); texts.push({ k: 'ico', ico, u: pu, v: pv, nx: fx, nz: fz, y: py + 2.35, w: .55, h: .55, free: 1 }) }
  const rowAt = (u, v) => { if (!ROW) return -1; const i = Math.floor(u / rpx), j = Math.floor(v / rpx); return i < 0 || j < 0 || i >= RHN || j >= RHN ? -2 : ROW[j * RHN + i] };
  const wetAt = (u, v) => wmask ? !!wmask[Math.min(WM - 1, Math.max(0, Math.floor(v / S * WM))) * WM + Math.min(WM - 1, Math.max(0, Math.floor(u / S * WM)))] : false;
  const DRV = { motorway: 1, trunk: 1, primary: 1, secondary: 1, tertiary: 1, minor: 1, service: 1, busway: 1 };
  for (const R of RD) { const r = R.r, m = R.m, S2 = R.S2;
    R.pk = 0; if (cityish && A && (r.c === 'minor' || r.c === 'tertiary') && r.sty !== 4 && !r.bridge) { if (r.w >= 11.5) R.pk = 3; else if (r.w >= 7.5 || (r.one && r.w >= 6)) R.pk = hsh(Math.round(S2[0] * 2), Math.round(S2[1] * 2) + 5) < .5 ? 1 : 2 }
    if (DRV[r.c]) { const p = []; for (let q = 0; q < m; q += 2) p.push(S2[q * 2], S2[q * 2 + 1]); if ((m - 1) % 2) p.push(S2[m * 2 - 2], S2[m * 2 - 1]); nav.push({ c: r.c, w: r.w, one: !!r.one, b: !!r.bridge, tun: !!r.tun, sw: !!R.sw, pk: R.pk, p }) }
    if (!A || !cityish || r.bridge || r.tun) continue; const hw = r.w / 2, lift = liftOf(r);
    const at = q => { const qa = Math.max(0, q - 1), qb = Math.min(m - 1, q + 1); let tx = S2[qb * 2] - S2[qa * 2], tz = S2[qb * 2 + 1] - S2[qa * 2 + 1]; const tl = Math.hypot(tx, tz) || 1; return [S2[q * 2], S2[q * 2 + 1], tx / tl, tz / tl] };
    const ok = (u, v) => u > 1 && v > 1 && u < S - 1 && v < S - 1 && !inB(u, v) && !wetAt(u, v);
    if (r.c === 'minor' || r.c === 'tertiary' || r.c === 'secondary' || r.c === 'primary') { // lampioni ogni 30 m, lati alternati
      let next = 14 + hsh(Math.round(S2[0]), Math.round(S2[1])) * 10, side = hsh(Math.round(S2[1]), Math.round(S2[0])) < .5 ? 1 : -1;
      for (let q = 0; q < m; q++) { if (R.s[q] < next) continue; next += 30; const [u, v, tx, tz] = at(q), nx = -tz * side, nz = tx * side, off = hw + (R.sw ? 1.1 : .7), lu = u + nx * off, lv = v + nz * off; side = -side;
        if (!ok(lu, lv) || rowAt(lu, lv) >= 0 || rowAt(lu + nx * 1.2, lv + nz * 1.2) >= 0) continue; lamps.push(-lu, R.h[q] + lift + (R.sw ? .14 : 0), -lv, Math.atan2(nx, nz)) } }
    if (R.pk) { // auto in sosta a lato della carreggiata, nel verso di marcia del proprio lato
      for (const side of [1, -1]) { if (!(R.pk & (side > 0 ? 1 : 2))) continue; let next = 7 + hsh(Math.round(S2[0] * 3) + side, Math.round(S2[1] * 3)) * 7;
        for (let q = 0; q < m; q++) { if (R.s[q] < next) continue; next += 6.3; if (hsh(Math.round(S2[q * 2] * 5) + side * 7, Math.round(S2[q * 2 + 1] * 5)) > .55) continue; if (R.s[q] < 7 || R.s[q] > R.s[m - 1] - 7) continue;
          const [u, v, tx, tz] = at(q), nx = -tz * side, nz = tx * side, off = hw - 1.05, pu = u + nx * off, pv = v + nz * off; if (!ok(pu, pv) || rowAt(pu, pv) !== R.idx || rowAt(u + nx * (hw + 2.5), v + nz * (hw + 2.5)) >= 0) continue;
          const du = tx * side, dv = tz * side; parked.push(-pu, R.h[q] + lift, -pv, Math.atan2(-du, -dv), Math.floor(hsh(Math.round(pv * 3), Math.round(pu * 3)) * 10)) } } }
    if ((r.c === 'primary' || r.c === 'secondary' || r.c === 'tertiary') && dens > .18 && r.w >= 7 && R.s[m - 1] > 60) { // viali alberati
      for (const side of [1, -1]) { let next = 6 + hsh(Math.round(S2[0]) + side, 11) * 6;
        for (let q = 0; q < m; q++) { if (R.s[q] < next) continue; next += 13; const [u, v, tx, tz] = at(q), nx = -tz * side, nz = tx * side, off = hw + 3.1, tu = u + nx * off, tv = v + nz * off; if (!ok(tu, tv) || rowAt(tu, tv) >= 0 || rowAt(tu + nx * 1.5, tv + nz * 1.5) >= 0) continue;
          const scv = 1.1 + hsh(Math.round(tu), Math.round(tv)) * .4; if (!treeOK(tu, tv, Math.max(1.3, 2.6 * scv * .55))) continue; trees.push(-tu, ghT(tu, tv), -tv, scv, 2) } } } }

  // --- luoghi e punti d'interesse (bar e caffè: il gioco permette di ordinare)
  const places = [], pois = [];
  { const ly = L.place; if (ly) { const k = S / ext0(ly); for (let i = 0; i < ly.n; i++) { const f = ly.feat(i), p = f.props; if (f.type !== 1 || !p.name) continue; const pt = f.parts[0]; if (!pt) continue; const u = pt[0] * k, v = pt[1] * k; if (u < 0 || v < 0 || u > S || v > S) continue;
      places.push({ x: -u, z: -v, name: p['name:it'] || p.name, cl: p.class, rank: p.rank || 0 }) } } }
  { const ly = L.poi; if (ly && A) { const k = S / ext0(ly); for (let i = 0; i < ly.n; i++) { const f = ly.feat(i), p = f.props; if (f.type !== 1) continue; if (p.class !== 'cafe' && p.class !== 'bar' && p.subclass !== 'cafe' && p.subclass !== 'bar' && p.subclass !== 'pub' && p.class !== 'fuel' && p.subclass !== 'fuel' && p.subclass !== 'car_repair') continue; const pt = f.parts[0]; const u = pt[0] * k, v = pt[1] * k; if (u < 0 || v < 0 || u > S || v > S) continue;
      pois.push({ x: -u, z: -v, name: p.name || '', cl: (p.class === 'fuel' || p.subclass === 'fuel') ? 'fuel' : p.subclass === 'car_repair' ? 'car_repair' : (p.subclass || p.class) }) } } }
  for (const mn of mini) { mn.pk = mn.R.pk || 0; delete mn.R }
  // --- nomi delle vie, insegne dei negozi veri, numeri civici, fermate dell'autobus, cestini e colonnine (dati OpenStreetMap)
  const names = [], NR = RHN ? new Int16Array(RHN * RHN).fill(-1) : null;
  // spigolo di edificio più vicino a (u,v) entro r metri, con la facciata rivolta verso il punto: {e, t (0..1 lungo lo spigolo)}
  const nearEdge = (u, v, r) => { let best = null, bd = r; const i0 = Math.floor((u - r) / 16), i1 = Math.floor((u + r) / 16), j0 = Math.floor((v - r) / 16), j1 = Math.floor((v + r) / 16);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const a = EH.get(i + ',' + j); if (!a) continue; for (const e of a) { const dx = e.u1 - e.u0, dz = e.v1 - e.v0, l2 = dx * dx + dz * dz || 1e-9, t = Math.max(0, Math.min(1, ((u - e.u0) * dx + (v - e.v0) * dz) / l2)), px = e.u0 + dx * t, pz = e.v0 + dz * t, d = Math.hypot(px - u, pz - v); if (d < bd && (u - px) * e.nx + (v - pz) * e.nz > -0.5) { bd = d; best = { e, t, px, pz, d } } } } return best };
  if (A) {
    { const ly = L.transportation_name; if (ly) { const ext = ext0(ly), k = S / ext, seen = new Set();
      for (let i = 0; i < ly.n; i++) { const f = ly.feat(i), p = f.props, nm = p['name:it'] || p.name; if (f.type !== 2 || !nm || p.class === 'path' || p.class === 'ferry' || p.class === 'service') continue; let ni = names.indexOf(nm); if (ni < 0) { ni = names.length; names.push(nm) }
        for (const part of f.parts) for (const cp of clipLine(part, 0, ext)) { // raster dei nomi (per il nome della via in alto mentre guidi)
          for (let q = 0; q + 3 < cp.length; q += 2) { const ax = cp[q] * k, ay = cp[q + 1] * k, bx = cp[q + 2] * k, by = cp[q + 3] * k, l = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.ceil(l / 2)); for (let e = 0; e <= n; e++) { const u = ax + (bx - ax) * e / n, v = ay + (by - ay) * e / n, pi = Math.floor(u / rpx), pj = Math.floor(v / rpx); for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) { const ii = pi + di, jj = pj + dj; if (ii >= 0 && jj >= 0 && ii < RHN && jj < RHN) NR[jj * RHN + ii] = ni } } }
          // targhe agli estremi (gli incroci) e ogni 160 m, sulla facciata più vicina
          const m = cp.length / 2, spots = [[cp[0] * k, cp[1] * k], [cp[m * 2 - 2] * k, cp[m * 2 - 1] * k]]; let acc = 0; for (let q = 0; q + 3 < cp.length; q += 2) { const l = Math.hypot(cp[q + 2] - cp[q], cp[q + 3] - cp[q + 1]) * k; acc += l; if (acc > 160) { acc = 0; spots.push([cp[q] * k, cp[q + 1] * k]) } }
          for (const [su, sv] of spots) { if (su < 2 || sv < 2 || su > S - 2 || sv > S - 2) continue; const kk = ni + ':' + Math.round(su / 25) + ':' + Math.round(sv / 25); if (seen.has(kk)) continue; const ne = nearEdge(su, sv, 15); if (!ne || ne.e.L < 2.5) continue; seen.add(kk);
            const e = ne.e, t = Math.max(.12, Math.min(.88, ne.t)); texts.push({ k: 'via', txt: nm, u: e.u0 + (e.u1 - e.u0) * t, v: e.v0 + (e.v1 - e.v0) * t, nx: e.nx, nz: e.nz, y: e.yb + 3.0, w: 1.0, h: .3 }) } } } } }
    { const ly = L.transportation_name; if (ly) { const k = S / ext0(ly);
      for (let i = 0; i < ly.n; i++) { const f = ly.feat(i), p = f.props; if (f.type !== 1 || p.class !== 'motorway_junction') continue; const nm = p['name:it'] || p.name || (p.ref ? 'Uscita ' + p.ref : ''); if (!nm) continue; const pt = f.parts[0]; if (!pt) continue; const u = pt[0] * k, v = pt[1] * k;
        let best = null, bd = 30 * 30; for (const R of RD) { if (!(R.r.c === 'motorway' || R.r.c === 'trunk' || R.r.c === 'primary') || R.r.tun) continue; for (let q = 0; q < R.m; q += 2) { const d = (R.S2[q * 2] - u) ** 2 + (R.S2[q * 2 + 1] - v) ** 2; if (d < bd) { bd = d; best = [R, q] } } }
        if (!best) continue; const [R, q0] = best, S2 = R.S2, sv = Math.max(8, R.s[q0] - 70); let q = 0; while (q < R.m - 1 && R.s[q + 1] < sv) q++; const qa = Math.max(0, q - 1), qb = Math.min(R.m - 1, q + 1); let tx = S2[qb * 2] - S2[qa * 2], tz = S2[qb * 2 + 1] - S2[qa * 2 + 1]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl; const nx = -tz, nz = tx, hw = R.r.w / 2, pu = S2[q * 2] + nx * (hw + 2.8), pv = S2[q * 2 + 1] + nz * (hw + 2.8); if (pu < 3 || pv < 3 || pu > S - 3 || pv > S - 3) continue;
        const w = Math.min(7, Math.max(3.5, nm.length * .4 + 1.6)), y = R.h[q] + liftOf(R.r); objs.push(8, pu, y, pv, Math.atan2(-tx, -tz), (w - 1) / 4.4); texts.push({ k: 'ins', txt: nm.toUpperCase(), sub: 'USCITA', bg: '#0b6b33', fg: '#ffffff', u: pu, v: pv, nx: -tx, nz: -tz, y: y + 4.3, w, h: 1.5, free: 1 }) } } }
    { const ly = L.poi; if (ly) { const k = S / ext0(ly);
      for (let i = 0; i < ly.n; i++) { const f = ly.feat(i), p = f.props; if (f.type !== 1) continue; const pt = f.parts[0]; if (!pt) continue; const u = pt[0] * k, v = pt[1] * k; if (u < 1 || v < 1 || u > S - 1 || v > S - 1) continue; const nm = p['name:it'] || p.name || '';
        if (p.class === 'bus' && p.subclass === 'bus_stop') { let bt = 1e9, tx = 1, tz = 0; for (const R of RD) { const S2 = R.S2; for (let q = 0; q < R.m; q += 3) { const d = (S2[q * 2] - u) ** 2 + (S2[q * 2 + 1] - v) ** 2; if (d < bt) { bt = d; const qa = Math.max(0, q - 1), qb = Math.min(R.m - 1, q + 1), l = Math.hypot(S2[qb * 2] - S2[qa * 2], S2[qb * 2 + 1] - S2[qa * 2 + 1]) || 1; tx = (S2[qb * 2] - S2[qa * 2]) / l; tz = (S2[qb * 2 + 1] - S2[qa * 2 + 1]) / l } } }
          const fs2 = fuoriStrada(u, v); if (!fs2) continue; const bu = fs2[0], bv = fs2[1];   // v31: il palo della fermata sul bordo, non in mezzo alla strada (in OpenStreetMap la fermata è spesso un nodo della carreggiata)
          objs.push(1, bu, gh(bu, bv), bv, 0, 1); if (nm) texts.push({ k: 'bus', txt: nm, u: bu, v: bv, nx: -tz, nz: tx, y: gh(bu, bv) + 2.55, w: .5, h: .5, free: 1 }); continue }
        // cestini, cassette, telefoni: mai dentro una carreggiata (la posizione OpenStreetMap è spesso imprecisa di qualche metro); i dissuasori sì, sono barriere vere
        const onRoad = (() => { const o = rowAt2(u, v); return o >= 0 && RD[o] && RD[o].r.rank >= 2 })();
        if (p.class === 'waste_basket' || p.class === 'recycling') { if (!inB(u, v) && !onRoad) objs.push(2, u, gh(u, v), v, 0, 1); continue }
        if (p.class === 'post' && p.subclass === 'post_box') { if (!inB(u, v) && !onRoad) objs.push(3, u, gh(u, v), v, 0, 1); continue }
        if (p.class === 'bollard') { if (!inB(u, v)) objs.push(4, u, gh(u, v), v, 0, 1); continue }
        if (p.class === 'telephone') { if (!inB(u, v) && !onRoad) objs.push(5, u, gh(u, v), v, 0, 1); continue }
        const cat = SIGNCAT(p); if (!cat) continue; const ne = nearEdge(u, v, 14); if (!ne || ne.e.L < 2.2) continue; const e = ne.e; if (e.used >= 3) continue; e.used++;
        const txt = nm ? nm.toUpperCase() : cat[0], w = Math.min(e.L * .86, Math.max(2.2, txt.length * .36 + .9)), tt = Math.max(w / 2 / e.L + .03, Math.min(1 - w / 2 / e.L - .03, ne.t));
        texts.push({ k: 'ins', txt, sub: nm ? cat[0] : '', bg: cat[1], fg: cat[2], u: e.u0 + (e.u1 - e.u0) * tt, v: e.v0 + (e.v1 - e.v0) * tt, nx: e.nx, nz: e.nz, y: e.yb + Math.min(e.gfl - .35, 3.55), w, h: .62 }) } } }
    { const ly = L.housenumber; if (ly) { const k = S / ext0(ly), seen = new Set();
      for (let i = 0; i < ly.n; i++) { const f = ly.feat(i), p = f.props, hn = String(p.housenumber || ''); if (f.type !== 1 || !hn || hn.length > 5) continue; const pt = f.parts[0]; if (!pt) continue; const u = pt[0] * k, v = pt[1] * k; if (u < 1 || v < 1 || u > S - 1 || v > S - 1) continue; const ne = nearEdge(u, v, 8); if (!ne) continue; const e = ne.e, kk = hn + ':' + Math.round(u / 6) + ':' + Math.round(v / 6); if (seen.has(kk)) continue; seen.add(kk);
        const t = Math.max(.08, Math.min(.92, ne.t)); texts.push({ k: 'civ', txt: hn, u: e.u0 + (e.u1 - e.u0) * t, v: e.v0 + (e.v1 - e.v0) * t, nx: e.nx, nz: e.nz, y: e.yb + 2.45, w: .32, h: .24 }) } } }
  }
  // maschera dell'erba fitta (512×512, ~1,8 m): niente ciuffi su strade e banchine (con margine), marciapiedi, piazze, edifici, piazzali, sotto i ponti bassi
  const GMN = A ? 512 : 0, GM = GMN ? new Uint8Array(GMN * GMN) : null;
  if (GM) { const gp = S / GMN, mk = (ax, ay, bx, by, w) => { const e = w + gp * .75, i0 = Math.max(0, Math.floor((Math.min(ax, bx) - e) / gp)), i1 = Math.min(GMN - 1, Math.floor((Math.max(ax, bx) + e) / gp)), j0 = Math.max(0, Math.floor((Math.min(ay, by) - e) / gp)), j1 = Math.min(GMN - 1, Math.floor((Math.max(ay, by) + e) / gp)); if (i0 > i1 || j0 > j1) return;
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1e-9, e2 = e * e; for (let j = j0; j <= j1; j++) { const pv = (j + .5) * gp, row = j * GMN; for (let i = i0; i <= i1; i++) { if (GM[row + i]) continue; const pu = (i + .5) * gp; let t = ((pu - ax) * dx + (pv - ay) * dy) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t; const ex = ax + dx * t - pu, ey = ay + dy * t - pv; if (ex * ex + ey * ey <= e2) GM[row + i] = 1 } } };
    for (const P of PR) { const r = P.r; if (r.tun) continue; const w = r.w / 2 + .45 + (r.bridge ? 0 : shoulder(r) + (cityish && r.rank >= 4 && r.rank <= 7 ? 2.4 : 0));
      for (let q = 0; q < P.m - 1; q++) { const ax = P.S2[q * 2], ay = P.S2[q * 2 + 1], bx = P.S2[q * 2 + 2], by = P.S2[q * 2 + 3]; if (Math.max(ax, bx) < -w || Math.max(ay, by) < -w || Math.min(ax, bx) > S + w || Math.min(ay, by) > S + w) continue;
        if (r.bridge && P.h[q] - ghT(Math.min(S, Math.max(0, ax)), Math.min(S, Math.max(0, ay))) > 2.5) continue; mk(ax, ay, bx, by, w) } }
    for (const r of roads) { if (!r.area) continue; fillPoly(r.rings, S / r.k, GMN, q => { GM[q] = 1 }) }
    if (bmask && GMN === WM * 2) for (let j = 0; j < WM; j++) for (let i = 0; i < WM; i++) if (bmask[j * WM + i]) { const p = j * 2 * GMN + i * 2; GM[p] = GM[p + 1] = GM[p + GMN] = GM[p + GMN + 1] = 1 }
    for (const PP of aprons) { for (let q = 0; q < 4; q++) mk(PP[q][0], PP[q][1], PP[(q + 1) % 4][0], PP[(q + 1) % 4][1], 2); fillPoly([PP.flat().concat(PP[0])].map(r => r.map(x => x)), S, GMN, q => { GM[q] = 1 }) } }
  stat.edifici = nb; stat.strade = RD.length; stat.alberi = trees.length / 5; stat.ms = Date.now() - t0;
  stat.testi = texts.length; stat.oggetti = objs.length / 6;
  if (opt.dbg) stat._dbg = { RD: RD.map(R => ({ idx: R.idx, S2: R.S2, h: R.h, m: R.m, w: R.r.w, c: R.r.c, bridge: !!R.r.bridge, tun: !!R.r.tun, rank: R.r.rank, one: !!R.r.one, ramp: !!R.r.ramp, lift: liftOf(R.r), cov: R.r.tun ? Array.from({ length: R.m }, (_, q) => ghT(R.S2[q * 2], R.S2[q * 2 + 1]) - (R.h[q] + liftOf(R.r) + 5.2)) : null })), d, MSo: MS.n, HGo: HG.n, GR: GRD, RLD };
  // raster delle quote stradali: due strati a 16 bit (0 = niente strada, altrimenti 1 + (quota − base) / 0,04 m): un quarto della memoria dei float
  let RHQ = null, RH2Q = null, RHB = 0; if (RHN) { let mn = 1e9; for (let p = 0; p < RHN * RHN; p++) { const h = RH[p]; if (h === h && h < mn) mn = h } RHB = mn < 1e9 ? mn - 1 : 0; RHQ = new Uint16Array(RHN * RHN); RH2Q = new Uint16Array(RHN * RHN);
    for (let p = 0; p < RHN * RHN; p++) { const h = RH[p], h2 = RH2[p]; if (h === h) RHQ[p] = Math.min(65535, 1 + Math.round((h - RHB) * 25)); if (h2 === h2) RH2Q[p] = Math.min(65535, 1 + Math.round((h2 - RHB) * 25)) } }
  return { S, NG, H, cls, CR, wmask, WM, RH: RHQ, RH2: RH2Q, RHB, RHN, NR, names, GM, GMN, T: TG.out(), R: RG.out(), Rst: RSg.out(), Rdi: RDg.out(), Rba: RBg.out(), Rsw: RWg.out(), Mc: MC.out(), MS: MS.out(), HG: HG.out(), chiese: chList, rotatorie: rbList, dens: dens0, M: MG.out(), W: WG.out(), BW: outs(BWs), BR: outs(BRs), walls: new Float32Array(walls), wallsY: new Float32Array(wallsY), rails: new Float32Array(rails), trees: new Float32Array(trees), lamps: new Float32Array(lamps), parked: new Float32Array(parked), objs: new Float32Array(objs), texts, nav, bridges, mini, places, pois, stat } }
// cella lontana: solo terreno (colori per quota e pendenza; il mare è un gruppo di triangoli a parte, a 1 m sotto lo zero).
// Il terreno lontano sta un po' sotto la quota vera (di più sui pendii ripidi) così non sporge dalle celle vicine più dettagliate.
// Le pendenze usano anche un campione oltre il bordo: due celle lontane vicine hanno vertici identici sul bordo comune.
function buildFar(opt) { const { S, mxL, myT, K, dem, N } = opt, q = opt.q || [0, 0], d = S / (N - 1), M = N + 2, HM = new Float32Array(M * M), H = new Float32Array(N * N), G = new GB(true), IS = [];
  for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) HM[j * M + i] = dem(mxL + (i - 1) * d / K, myT - (j - 1) * d / K);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) H[j * N + i] = HM[(j + 1) * M + i + 1];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const q = (j + 1) * M + i + 1, h = HM[q], gx = (HM[q + 1] - HM[q - 1]) / (2 * d), gz = (HM[q + M] - HM[q - M]) / (2 * d), l = Math.hypot(gx, 1, gz), sl = Math.hypot(gx, gz), sea = h <= .5;
    let c = sea ? [.16, .30, .38] : h > 2600 ? [.92, .93, .95] : h > 1800 ? [.48, .47, .44] : h > 1100 ? [.30, .38, .24] : [.40, .50, .28]; const rk = Math.min(1, Math.max(0, (sl - .5) / .5)); if (!sea) c = c.map((x, k) => x * (1 - rk) + [.5, .48, .45][k] * rk);
    const off = 2.5 + Math.min(9, sl * d * .15);
    const tu = (q[0] + i / (N - 1)) / 2, tv = 1 - (q[1] + j / (N - 1)) / 2; if (sea) G.v(-i * d, -1, -j * d, 0, 1, 0, lin(c), tu, tv); else G.v(-i * d, h - off, -j * d, gx / l, 1 / l, gz / l, lin(c), tu, tv) }
  for (let j = 0; j < N - 1; j++) for (let i = 0; i < N - 1; i++) { const a = j * N + i, b = a + 1, c = a + N + 1, e = a + N;
    if (H[a] <= .5 && H[b] <= .5 && H[c] <= .5 && H[e] <= .5) IS.push(a, e, b, b, e, c); else G.I.push(a, e, b, b, e, c) }
  const nL = G.I.length; for (const v of IS) G.I.push(v);
  return { S, N, H, T: G.out(), nL, nS: IS.length } }
if (typeof module !== 'undefined') module.exports = { buildCell, buildFar, CL };
