/* ITALIA OPEN WORLD — banco d'integrazione del quadro (versione 33): costruisce una pagina con CSS, HUD e codice del quadro VERI estratti
   da index.html, i moduli veri del motore e oggetti minimi al posto di three.js e della mappa. Usato da test/browser_cruscotto.js. */
'use strict';
const fs = require('fs'), path = require('path'), R = path.join(__dirname, '..');
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


/* stato «in auto» degli elementi che nel gioco compaiono solo con la mappa caricata (soldi, minimappa, nome della via, freno a mano, azione) */
const IN_AUTO = `document.querySelector('#hb').hidden=false;const w=document.querySelector('#w');if(w)w.textContent='€ 0,00';const zn=document.querySelector('#zn');if(zn){zn.textContent='Autostrada Serenissima\\nSettimo Torinese';zn.style.display='block'}const a=document.querySelector('#act');a.textContent='Scendi dall\u2019auto';a.classList.add('on');`;
module.exports = { banco, IN_AUTO };
