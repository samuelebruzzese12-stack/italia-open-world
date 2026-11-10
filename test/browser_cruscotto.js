/* ITALIA OPEN WORLD — prove grafiche e d'integrazione del quadro strumenti (versione 33) in Chromium senza schermo.
   Uso: node test/browser_cruscotto.js        → esito a schermo, registro in docs/test/v33_cruscotto_chromium.txt, immagini in docs/img/v33_*.png
   A) test/cruscotto_prova.html: il disegno vero (motore/cruscotto.js) controllato sui PIXEL: ogni spia accesa ha il suo colore e spenta è
      buia; lampeggi accesi/spenti; lancette sull'angolo giusto; display retroilluminato.
   B) banco d'integrazione costruito da index.html: CSS, HUD e codice del quadro (CRU) VERI della pagina, moduli veri del motore fisico,
      centralina, rete ECU e danni; tocchi veri (eventi pointer) su pedali e frecce. Il resto del gioco (three.js, mappa) è sostituito da
      oggetti minimi, perché three.js non si scarica nel contenitore delle prove. */
'use strict';
const { chromium } = require('playwright'), fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..'), REG = [], esiti = []; let pass = 0, fail = 0;
const ok = (c, m) => { if (!c) throw new Error(m || 'condizione falsa') };
async function prova(nome, fn) { try { const r = await fn(); pass++; esiti.push('  ok   ' + nome + (r ? '  — ' + r : '')) } catch (e) { fail++; esiti.push('  FAIL ' + nome + '\n         ' + (e && e.message || e)) } }
const rosso = c => c[0] > 170 && c[1] < 130 && c[2] < 120, luce = c => c[0] + c[1] + c[2];
const COLORI = { rosso: c => c[0] > 180 && c[1] < 140 && c[2] < 130, arancione: c => c[0] > 200 && c[1] > 60 && c[1] < 190 && c[2] < 110, ambra: c => c[0] > 200 && c[1] > 120 && c[2] < 120, giallo: c => c[0] > 200 && c[1] > 160 && c[2] < 140, verde: c => c[1] > 170 && c[0] < 150 && c[2] < 200, blu: c => c[2] > 200 && c[0] < 140, bianco: c => c[0] > 200 && c[1] > 200 && c[2] > 200 };

/* banco d'integrazione: pezzi veri della pagina costruita */
function banco() {
  const html = fs.readFileSync(path.join(R, 'index.html'), 'utf8');
  const css = (html.match(/<style>([\s\S]*?)<\/style>/g) || []).join('\n');
  const i = html.indexOf('<div id="hud">'); let d = 0, fine = -1; const re = /<div\b|<\/div>/g; re.lastIndex = i; let m;
  while ((m = re.exec(html))) { d += m[0] === '<div' ? 1 : -1; if (d === 0) { fine = re.lastIndex; break } }
  const hud = html.slice(i, fine), g0 = html.indexOf('var CRU={'), g1 = html.indexOf('function step(dt){', g0);
  const glue = html.slice(html.lastIndexOf('/* ====', g0), g1);
  const stub = `
  const $=s=>document.querySelector(s);window.TOASTS=[];const toast=t=>TOASTS.push(t);const cl=(v,a,b)=>v<a?a:v>b?b:v;
  var inCar=true,VEHOK=true;const K={},V={vx:0,vz:0,y:0,pt:0},C={x:0,z:0,h:0},P={x:0,z:0,y:0,r:.4},cs={v:0},UNI={uNight:{value:0}};
  window.TERRENO_SOPRA=0;const REAL={terrainH:(x,z)=>V.y+TERRENO_SOPRA};const push=(x,z)=>[x,z,0],GY=()=>0;
  window.CHIAMATE=[];function crBang(){CHIAMATE.push('crBang')}function crGlassCrack(){CHIAMATE.push('crGlassCrack')}function crGlassBreak(a,c,k){CHIAMATE.push('crGlassBreak:'+k)}
  const VEH=IOW_FISICA.crea(IOW_VEICOLI.parametri('alfa_159_19_jtdm_150'),{Tambiente:18,carburante:42});VEH.motore.Tacqua=88;
  const ECUN=IOW_ECU.crea(VEH,{seed:12}),DANS=IOW_DANNI.crea(),VDS={st:{zone:null}},carA={};
  var exitCar=function(){if(Math.hypot(V.vx,V.vz)>3)return;inCar=false;CHIAMATE.push('exitCar')};
  window.passo=function(dt,inp){const ctx=IOW_DANNI.aggiorna(DANS,dt,null,VEH);const o=inCar?CRU.comandi(dt):null;IOW_FISICA.passo(VEH,dt,Object.assign({iy:o?o.iy:0,sterzo:o?-o.ix*.3:0},inp||{}));IOW_ECU.passo(ECUN,dt,{danni:ctx});C.h+=VEH.r*dt;C.x+=VEH.v*Math.sin(C.h)*dt;C.z+=VEH.v*Math.cos(C.h)*dt;V.vx=VEH.v*Math.sin(C.h);V.vz=VEH.v*Math.cos(C.h);CRU.step(dt);return o};`;
  const page = `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${css}<style>html,body{margin:0;height:100%;overflow:hidden;background:linear-gradient(180deg,#7fa6c9 0%,#c9d7e2 45%,#5d6266 46%,#3d4043 100%)!important}#rld{display:none!important}</style></head><body>
${hud}
<script src="../motore/cruscotto.js"></script><script src="../motore/veicoli_db.js"></script><script src="../motore/pneumatici_mf.js"></script><script src="../motore/controllo_dinamica.js"></script><script src="../motore/fisica_veicolo.js"></script><script src="../motore/ecu.js"></script><script src="../motore/danni_meccanici.js"></script>
<script>${stub}\n${glue}\nwindow.CRU=CRU;</script></body></html>`;
  const f = path.join(__dirname, '_banco_cruscotto.html'); fs.writeFileSync(f, page); return f;
}

(async () => {
  const browser = await chromium.launch(); const errori = [];
  /* ======================== A) disegno controllato sui pixel ======================== */
  const pg = await browser.newPage({ viewport: { width: 1200, height: 880 } });
  pg.on('pageerror', e => errori.push('A: ' + e.message)); pg.on('console', m => { if (m.type() === 'error') errori.push('A: ' + m.text()) });
  await pg.goto('file://' + path.join(__dirname, 'cruscotto_prova.html'));
  const L = await pg.evaluate(() => IOW_CRUSCOTTO.LAYOUT);
  await prova('A1 quadro spento (fuori dall\'auto): nessuna spia accesa, display spento, anelli rossi accesi', async () => {
    await pg.evaluate(() => scenario('spento', 1, { quadro: false }));
    for (const id in L.spie) { const c = await pg.evaluate(([x, y]) => massimo(x, y, 24), [L.spie[id].x, L.spie[id].y]); ok(luce(c) < 200, id + ' non è buia: ' + c) }
    const lcd = await pg.evaluate(([x, y]) => colore(x, y, 8), [L.lcd.x + L.lcd.w / 2, L.lcd.y + L.lcd.h / 2]); ok(luce(lcd) < 120, 'display spento ' + lcd);
    const anello = await pg.evaluate(([x, y]) => massimo(x, y, 4), [L.vel.cx + L.vel.r + 8, L.vel.cy]); ok(rosso(anello), 'anello ' + anello);
    await pg.screenshot({ path: path.join(R, 'docs/img/v33_cruscotto_spento.png') }); return 'display ' + lcd;
  });
  await prova('A2 ogni spia accesa ha il colore della sua funzione (21 spie, controllo dei pixel)', async () => {
    const tutte = { quadro: true, motoreAcceso: false, rpm: 0, frenoMano: true, porteBloccate: true, riserva: true, fariGuasti: true, Tacqua: 116, fari: 'abbaglianti', retronebbia: true, marcia: -1, centralina: { stato: 'BLACKOUT' } };
    await pg.evaluate(t => scenario('tutte', 3, t), tutte); const rep = [];
    for (const id in L.spie) { if (['lunotto', 'lavavetri', 'frecciaSx', 'frecciaDx', 'cintura'].includes(id)) continue; const c = await pg.evaluate(([x, y]) => massimo(x, y, 24), [L.spie[id].x, L.spie[id].y]); ok(COLORI[L.spie[id].c](c), id + ' (' + L.spie[id].c + '): ' + c); rep.push(id + ' ' + L.spie[id].c) }
    // frecce: emergenza in fase accesa; lunotto, lavavetri, cintura: in autotest
    await pg.evaluate(() => scenario('frecce', 1, { quadro: true, emergenza: true }, 0.1)); for (const id of ['frecciaSx', 'frecciaDx']) { const c = await pg.evaluate(([x, y]) => massimo(x, y, 22), [L.spie[id].x, L.spie[id].y]); ok(COLORI.verde(c), id + ' ' + c) }
    await pg.evaluate(() => scenario('autotest', 0.5, { quadro: true })); for (const id of ['lunotto', 'lavavetri', 'cintura']) { const c = await pg.evaluate(([x, y]) => massimo(x, y, 24), [L.spie[id].x, L.spie[id].y]); ok(COLORI[L.spie[id].c](c), id + ' in autotest ' + c) }
    await pg.evaluate(t => scenario('tutte', 3, t), tutte); await pg.screenshot({ path: path.join(R, 'docs/img/v33_cruscotto_blackout_tutte.png') });
    return rep.length + 5 + ' spie verificate';
  });
  await prova('A3 lampeggi: ABS ed ESP in regolazione accese a t=0,10 s e spente a t=0,35 s; in BLACKOUT accese fisse in entrambi gli istanti', async () => {
    const I = { quadro: true, rpm: 2000, vx: 20, centralina: { stato: 'OPERATIVA', abs: true, tcs: true } }, leggi = async () => Promise.all(['abs', 'esp'].map(id => pg.evaluate(([x, y]) => massimo(x, y, 24), [L.spie[id].x, L.spie[id].y])));
    await pg.evaluate(i => scenario('lamp', 3, i, 3.10), I); const on = await leggi(); await pg.evaluate(i => scenario('lamp', 3, i, 3.35), I); const off = await leggi();
    ok(COLORI.arancione(on[0]) && COLORI.ambra(on[1]), 'accese ' + on); ok(luce(off[0]) < 200 && luce(off[1]) < 200, 'spente ' + off);
    const B = { quadro: true, rpm: 2000, vx: 20, centralina: { stato: 'BLACKOUT' } };
    await pg.evaluate(i => scenario('bo', 3, i, 3.10), B); const b1 = await leggi(); await pg.evaluate(i => scenario('bo', 3, i, 3.35), B); const b2 = await leggi();
    ok(COLORI.arancione(b1[0]) && COLORI.arancione(b2[0]) && COLORI.ambra(b1[1]) && COLORI.ambra(b2[1]), 'fisse ' + b1 + ' / ' + b2); return 'regolazione: ' + on[0] + ' → ' + off[0] + '; blackout: ' + b1[0] + ' → ' + b2[0];
  });
  await prova('A4 lancette sull\'angolo giusto: 100 km/h, 2400 giri, metà serbatoio (pixel rossi sulla punta attesa, buio su un angolo sbagliato)', async () => {
    await pg.evaluate(() => scenario('lancette', 6, { quadro: true, rpm: 2400, vx: 100 / 3.6, consumoLh: 5, carbL: 35, serbatoioL: 70, Tacqua: 92, marcia: 5 }));
    const punta = async (Q, f, rientro) => { const a = Q.a0 + (Q.a1 - Q.a0) * f, r = Q.r - rientro; return pg.evaluate(([x, y]) => massimo(x, y, 3), [Q.cx + r * Math.cos(a * Math.PI / 180), Q.cy + r * Math.sin(a * Math.PI / 180)]) };
    const v100 = await punta(L.vel, 100 / 280, 85), v160 = await punta(L.vel, 160 / 280, 85), g24 = await punta(L.giri, 2.4 / 8, 85), g60 = await punta(L.giri, 6 / 8, 85), c50 = await punta(L.carb, 0.5, 40);
    const ago = c => c[0] > 200 && c[0] - c[1] > 60 && c[0] - c[2] > 60;   // corpo della lancetta: rosso-arancio luminoso
    ok(ago(v100), 'tachimetro a 100: ' + v100); ok(!ago(v160), 'a 160 non c\'è: ' + v160); ok(ago(g24), 'contagiri a 2400: ' + g24); ok(!ago(g60), 'a 6000 non c\'è: ' + g60); ok(ago(c50), 'carburante a metà: ' + c50);
    await pg.screenshot({ path: path.join(R, 'docs/img/v33_cruscotto_100kmh.png') }); return '100 km/h ' + v100 + ', 2400 giri ' + g24;
  });
  await prova('A5 display retroilluminato blu con chilometri totali e parziali', async () => {
    const r = await pg.evaluate(() => scenario('lcd', 1, { quadro: true })); const c = await pg.evaluate(([x, y]) => colore(x, y, 4), [L.lcd.x + 12, L.lcd.y + 14]);
    ok(c[2] > 120 && c[2] > c[0] * 2, 'fondo blu ' + c); ok(r.lcd.totale.trim() === '157256' && r.lcd.parziale === '0.0', JSON.stringify(r.lcd)); return 'totale ' + r.lcd.totale + ', parziale ' + r.lcd.parziale;
  });

  /* ======================== B) banco d'integrazione con la pagina vera ======================== */
  const f = banco();
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const p = await ctx.newPage(); p.on('pageerror', e => errori.push('B: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errori.push('B: ' + m.text()) });
  await p.goto('file://' + f); await p.waitForTimeout(300);
  const box = async s => p.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, vis: getComputedStyle(document.querySelector(s)).display !== 'none' && r.width > 0 } }, s);
  const giri = async (n, inp) => p.evaluate(([n, inp]) => { let o; for (let i = 0; i < n; i++) o = passo(1 / 60, inp); return { o, v: VEH.v, ix: o && o.ix, crq: !document.querySelector('#crq').hidden } }, [n, inp || null]);
  const tocco = async (s, rel, azione) => { const b = await box(s), x = b.x + b.w / 2, y = b.y + b.h * rel; await p.evaluate(([s, x, y, a]) => { const el = document.querySelector(s); el.dispatchEvent(new PointerEvent(a, { bubbles: true, cancelable: true, pointerId: s === '#pacc' ? 11 : s === '#pfreno' ? 12 : 13, pointerType: 'touch', clientX: x, clientY: y, isPrimary: false })) }, [s, x, y, azione]) };
  await prova('B1 in auto la levetta non c\'è più: #joy nascosta, frecce, pedali e quadro visibili e senza sovrapposizioni (schermo 844×390)', async () => {
    await giri(30); const j = await box('#joy'), sx = await box('#gsx'), dx = await box('#gdx'), pa = await box('#pacc'), pf = await box('#pfreno'), q = await box('#crq'), act = await box('#act');
    ok(!j.vis, 'levetta visibile'); ok(sx.vis && dx.vis && pa.vis && pf.vis && q.vis, 'comandi o quadro non visibili');
    const sov = (a, b) => !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
    const cr = await box('#cr'), top = await p.evaluate(() => [...document.querySelectorAll('#top .b')].map(b => { const r = b.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height } })); const el = { sx, dx, pa, pf, q, act, cr }; top.forEach((t, i) => { el['top' + i] = t }); for (const a in el) for (const b in el) if (a < b && !(a.startsWith('top') && b.startsWith('top'))) ok(!sov(el[a], el[b]), a + ' si sovrappone a ' + b);
    await p.screenshot({ path: path.join(R, 'docs/img/v33_comandi_telefono.png') }); return 'quadro ' + Math.round(q.w) + '×' + Math.round(q.h) + ' px, pedali ' + Math.round(pf.w) + '×' + Math.round(pf.h) + ' e ' + Math.round(pa.w) + '×' + Math.round(pa.h);
  });
  await prova('B2 pedale dell\'acceleratore toccato in alto → 100 % e l\'auto accelera; toccato in basso → 25 %; rilasciato → 0', async () => {
    await tocco('#pacc', 0.05, 'pointerdown'); let r = await giri(240); ok(r.o.acc > 0.95, 'acc ' + r.o.acc); ok(r.v > 10, 'velocità ' + r.v.toFixed(1));
    await tocco('#pacc', 0.97, 'pointermove'); r = await giri(30); ok(Math.abs(r.o.acc - 0.27) < 0.04, 'in basso ' + r.o.acc.toFixed(2));
    const tras = await p.evaluate(() => getComputedStyle(document.querySelector('#pacc')).transform); ok(tras && tras !== 'none', 'il pedale si inclina: ' + tras);
    await tocco('#pacc', 0.97, 'pointerup'); r = await giri(30); ok(r.o.acc === 0, 'rilasciato ' + r.o.acc); return 'velocità dopo 4 s: ' + (r.v * 3.6).toFixed(0) + ' km/h';
  });
  await prova('B3 frecce: destra → sterzo +1 (e l\'auto gira a destra), sinistra → −1, rilascio → 0', async () => {
    const h0 = await p.evaluate(() => C.h); await tocco('#gdx', 0.5, 'pointerdown'); let r = await giri(40, { acc: 0.3, iy: 0.3 }); ok(r.ix === 1, 'ix ' + r.ix); const h1 = await p.evaluate(() => C.h); ok(h1 < h0 - 0.05, 'rotta ' + (h1 - h0).toFixed(3));
    const on = await p.evaluate(() => document.querySelector('#gdx').classList.contains('on')); ok(on, 'freccia illuminata'); await tocco('#gdx', 0.5, 'pointerup');
    await tocco('#gsx', 0.5, 'pointerdown'); r = await giri(30); ok(r.ix === -1, 'ix ' + r.ix); await tocco('#gsx', 0.5, 'pointerup'); r = await giri(15); ok(r.ix === 0); return 'rotta cambiata di ' + (h1 - h0).toFixed(2) + ' rad';
  });
  await prova('B4 freno a pedale con due dita insieme al gas (multitocco) e frenata a fondo: ABS in regolazione e spia ABS che lampeggia sul quadro', async () => {
    await tocco('#pacc', 0.05, 'pointerdown'); await giri(300); await tocco('#pacc', 0.05, 'pointerup');
    await tocco('#pfreno', 0.02, 'pointerdown'); const s = await p.evaluate(() => { let lamp = 0, abs = 0; for (let i = 0; i < 120; i++) { passo(1 / 60); if (CRU.ultimo.spie.abs.stato === 'lampeggio') lamp++; if (VEH.freni.abs) abs++ } return { lamp, abs, v: VEH.v } });
    await tocco('#pfreno', 0.02, 'pointerup'); ok(s.abs > 10 && s.lamp > 10, JSON.stringify(s)); return 'fotogrammi con ABS ' + s.abs + ', spia lampeggiante ' + s.lamp;
  });
  await prova('B5 urto da 20 g (blackout): ABS ed ESP fisse sul quadro disegnato, luci di emergenza accese da sole', async () => {
    const s = await p.evaluate(() => { IOW_FISICA.urto(VEH, 20); for (let i = 0; i < 10; i++) passo(1 / 60); return { abs: CRU.ultimo.spie.abs.stato, esp: CRU.ultimo.spie.esp.stato, em: CRU.fari.emergenza, frecce: CRU.ultimo.spie.frecciaSx.stato } });
    ok(s.abs === 'accesa' && s.esp === 'accesa' && s.em && s.frecce === 'freccia', JSON.stringify(s)); await p.evaluate(() => { CRU.dim = 1; document.querySelector('#crq').classList.add('grande'); for (let i = 0; i < 8; i++) passo(1 / 60) });
    await p.screenshot({ path: path.join(R, 'docs/img/v33_blackout_telefono.png') }); await p.evaluate(() => { CRU.dim = 0; document.querySelector('#crq').classList.remove('grande') }); return JSON.stringify(s);
  });
  await prova('B6 fari e polizia: in galleria (8 m di montagna sopra) a fari spenti la polizia vede solo entro 35 m, con le posizioni 70 m, con i fari normale', async () => {
    const r = await p.evaluate(() => { TERRENO_SOPRA = 8; const out = {}; for (const m of ['spenti', 'posizione', 'anabbaglianti', 'auto']) { CRU.fari.modo = m; passo(1 / 60); out[m] = [CRU.galleria, CRU.fariEffettivi(), CRU.visibilitaMax()] } TERRENO_SOPRA = 0; CRU.fari.modo = 'spenti'; passo(1 / 60); out.fuori = [CRU.galleria, CRU.visibilitaMax()]; CRU.fari.modo = 'auto'; return out });
    ok(r.spenti[0] && r.spenti[2] === 35 && r.posizione[2] === 70 && r.anabbaglianti[2] > 1e6 && r.auto[1] === 'anabbaglianti', JSON.stringify(r)); ok(!r.fuori[0] && r.fuori[1] > 1e6, 'di giorno fuori dalla galleria si vede: ' + r.fuori);
    const b = await p.evaluate(() => { document.querySelector('#lfari').click(); return document.querySelector('#lfari').textContent }); ok(/SPENTI/.test(b), 'pulsante fari: ' + b); await p.evaluate(() => { CRU.fari.modo = 'auto'; CRU.etichette() }); return JSON.stringify(r);
  });
  await prova('B7 auto accartocciata: portiere bloccate, spie P e portiere accese, 10 calci (crepa al 4°, parabrezza sfondato al 10°), poi a piedi la levetta torna', async () => {
    const r = await p.evaluate(() => { for (let i = 0; i < 400 && Math.abs(VEH.v) > 0.05; i++) passo(1 / 60, { freno: 1, iy: -0.01 }); V.vx = V.vz = 0; VDS.st.zone = { porte: { integrita: 0.42 }, montanti: { integrita: 0.7 }, abitacolo: { integrita: 0.85 } }; passo(1 / 60); passo(1 / 60);
      const prima = { bloccate: CRU.porteBloccate(), P: CRU.ultimo.spie.frenoMano.stato, porte: CRU.ultimo.spie.porte.stato }; const calci = [];
      for (let k = 0; k < 10; k++) { exitCar(); calci.push(CRU.porte.calci); passo(1 / 60) } return { prima, calci, chiamate: CHIAMATE.slice(), inCar, dopo: { P: CRU.ultimo.spie.frenoMano.stato } } });
    ok(r.prima.bloccate && r.prima.P === 'accesa' && r.prima.porte === 'accesa', JSON.stringify(r.prima)); ok(r.calci.join() === '1,2,3,4,5,6,7,8,9,10', 'calci ' + r.calci);
    ok(r.chiamate.includes('crGlassCrack') && r.chiamate.includes('crGlassBreak:ws') && r.chiamate.includes('exitCar') && !r.inCar, JSON.stringify(r.chiamate.filter(c => c !== 'crBang')));
    const j = await box('#joy'), pa = await box('#pacc'), q = await box('#crq'); ok(j.vis && !pa.vis && !q.vis, 'a piedi: levetta ' + j.vis + ', pedali ' + pa.vis + ', quadro ' + q.vis);
    await p.screenshot({ path: path.join(R, 'docs/img/v33_a_piedi_telefono.png') }); return 'calci ' + r.calci.length + ', ' + r.chiamate.filter(c => c !== 'crBang').join(' → ');
  });
  await prova('B8 nessun errore JavaScript nelle due pagine', async () => { ok(errori.length === 0, errori.join(' | ')); return '0 errori' });
  await browser.close(); try { fs.unlinkSync(f) } catch (e) { }
  const testo = 'ITALIA OPEN WORLD — quadro strumenti V33, prove in Chromium senza schermo (' + new Date().toISOString().slice(0, 10) + ')\n' + esiti.join('\n') + '\n\n' + pass + ' prove superate, ' + fail + ' fallite\n';
  fs.writeFileSync(path.join(R, 'docs/test/v33_cruscotto_chromium.txt'), testo); console.log(testo); process.exit(fail ? 1 : 0);
})();
