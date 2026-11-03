// V31 — prima/dopo con dati veri (tile OpenStreetMap e rilievo salvati, serviti in locale) caricati dal gioco stesso:
// la pagina parte con ?vt=…&dem=…&pos=lat,lon (origine del mondo nel punto scelto); le telecamere sono date rispetto all'origine.
// CAMS (JSON): [[nome, x, z, dy, tx, tz, tdy, fov, yh]] — quote relative al suolo in (x,z) (ground con quota di riferimento yh, se data)
const CAMS = JSON.parse(process.env.CAMS || '[]'), ATTESA = +(process.env.ATTESA || 45000);
const cam = c => new Function(`const [nome, x, z, dy, tx, tz, tdy, fov, yh] = ${JSON.stringify(c)}; const g = window.__iow, R = g.REAL, T = window.THREE;
  for (const id of ['rld', 'ld']) { const e = document.getElementById(id); if (e) e.style.display = 'none' }
  const gy = (a, b) => typeof yh === 'string' ? +yh.slice(1) : R.ground(a, b, yh === undefined || yh === null ? undefined : yh), y0 = gy(x, z), y1 = gy(tx, tz);   // yh = 'a<quota>': quota assoluta
  const k = new T.PerspectiveCamera(fov || 62, innerWidth / innerHeight, .3, 12000); k.position.set(x, y0 + dy, z); k.lookAt(new T.Vector3(tx, y1 + tdy, tz)); k.updateMatrixWorld();
  try { R.ERBA.update(x, z) } catch (e) {} try { R.CIELO.update(x, z) } catch (e) {}
  g.R.render(g.sc, k); return { img: g.R.domElement.toDataURL('image/jpeg', .9), y0: +y0.toFixed(1), y1: +y1.toFixed(1), celle: R.CELLS.size }`);
module.exports = { init: () => ({ ok: !!window.__iow.REAL }), scenes: [{ name: 'c0_carico', wait: ATTESA, eval: () => 'attendo il caricamento delle celle', skip: 1 },
  { name: 'c1_stato', wait: 500, skip: 1, eval: () => { const R = window.__iow.REAL; let a = 0, b = 0; for (const c of R.CELLS.values()) c.lod === 'A' ? a++ : b++; return { celleA: a, celleB: b, lontane: R.FARS ? R.FARS.size : '?' } } }]
  .concat(CAMS.map(c => ({ name: c[0], wait: 600, eval: cam(c) }))) };
