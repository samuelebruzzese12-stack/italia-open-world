// Scene in Chromium (Playwright): carica PAGE, esegue le scene di SCENES e salva le immagini catturate dal canvas in OUTDIR.
// Uso: SCENES=test/browser_mappa_v31_sintetica.js PAGE=http://127.0.0.1:8765/index.html OUTDIR=prove node test/scene_chromium.js
// più inquadrature nella stessa sessione del gioco vero (Chromium senza schermo, WebGL software): ogni scena prepara lo stato con
// codice nella pagina (window.__iow), aspetta qualche fotogramma e fotografa. uso: SCENES=file.js node scene.js
const { chromium } = require('playwright'); const fs = require('fs');
const PAGE = process.env.PAGE, THREE = process.env.THREE_JS || '', SC = require(require('path').resolve(process.env.SCENES));   // THREE_JS: copia locale di three.min.js r128 se la rete non arriva a cdnjs
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: +(process.env.W || 960), height: +(process.env.H || 540) }, deviceScaleFactor: 1 });
  const logs = []; page.on('console', m => logs.push(m.type() + ': ' + m.text())); page.on('pageerror', e => logs.push('ERRORE: ' + e.message + ' @@ ' + String(e.stack).split('\n').slice(0, 6).join(' | ')));
  if (THREE) await page.route('**/three.min.js', r => r.fulfill({ body: fs.readFileSync(THREE), contentType: 'application/javascript' }));
  if (process.env.SOLO_LOCALE) await page.route('https://**', r => r.abort());
  console.log('carico', Date.now() % 100000); await page.goto(PAGE.startsWith('http') ? PAGE : 'file://' + PAGE); console.log('caricata', Date.now() % 100000); await page.waitForTimeout(+(process.env.WAIT || 9000));
  if (SC.init) { const r = await page.evaluate(SC.init); console.log('init:', JSON.stringify(r)); await page.waitForTimeout(1500); }
  for (const s of SC.scenes) { if (process.env.ONLY && !process.env.ONLY.split(',').includes(s.name)) continue;
    try { let r = await page.evaluate(s.eval); if (r && r.img && String(r.img).startsWith('data:image/')) { fs.writeFileSync((process.env.OUTDIR || '.') + '/' + s.name + '.' + (r.img.startsWith('data:image/png') ? 'png' : 'jpg'), Buffer.from(r.img.split(',')[1], 'base64')); r = Object.assign({}, r, { img: 'scritta' }); s.skip = 1 } console.log(s.name + ':', JSON.stringify(r).slice(0, +(process.env.LOGN || 600))); } catch (e) { console.log(s.name + ' ERRORE', e.message); }
    await page.waitForTimeout(s.wait || 2500); if (s.skip) { if (s.after) await page.evaluate(s.after); if (s.dump) { const txt = await page.evaluate(new Function('return window[' + JSON.stringify(s.dump) + ']')); require('fs').writeFileSync((process.env.OUTDIR || '.') + '/' + s.dump + '.json', txt); console.log('scritto', s.dump, txt.length) } continue } const t0 = Date.now(); await page.screenshot({ path: (process.env.OUTDIR || '.') + '/' + s.name + '.png', timeout: 240000 }); console.log('  foto ' + s.name + ' in ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s');
    if (s.after) await page.evaluate(s.after); }
  const errs = logs.filter(l => /ERRORE|error/i.test(l)); console.log('errori nella pagina:', errs.length, errs.slice(0, 8).join(' | '));
  await browser.close(); })();
