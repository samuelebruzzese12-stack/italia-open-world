# -*- coding: utf-8 -*-
"""ITALIA OPEN WORLD — V33: quadro strumenti analogico-digitale, comandi di guida a frecce e pedali, fari, portiere bloccate.

Collega al gioco motore/cruscotto.js (logica e disegno del quadro, comandi a schermo):
- quadro strumenti in basso al centro quando si è in auto (tocco: piccolo → grande → nascosto; tocco lungo sul display: azzera i parziali),
  aggiornato ogni fotogramma con le variabili del motore fisico, della centralina a 200 Hz, della rete ECU e dei danni; disegnato a 30 fps;
  chilometri totali (salvati) e parziali della sessione misurati sulla mappa;
- in auto la levetta analogica NON esiste più (nascosta e ignorata dalla logica): due frecce per lo sterzo e due pedali analogici
  (acceleratore e freno, pressione dal punto toccato). A piedi la levetta resta, perché serve a camminare;
- fari: AUTO (accesi di notte e in galleria), spenti, posizione, anabbaglianti, abbaglianti; luci di emergenza (si accendono da sole dopo
  un urto da blackout) e retronebbia. Il fascio dei fari si vede anche in galleria e si allunga con gli abbaglianti. A fari spenti, di
  notte o in galleria, la polizia vede l'auto solo entro 35 m (con le sole luci di posizione 70 m): si può seminare l'inseguimento;
- portiere bloccate dal telaio deformato (zone «porte», «montanti», «abitacolo» del Vehicle Damage Solver): per uscire servono 10 calci
  sul parabrezza (al 4° si crepa, al 10° si sfonda e si esce dal davanti); le spie P e portiere restano accese fino all'uscita;
- motore KO (integrità sotto 0,30): spie guasto motore e pressione olio.
Sostituzioni su stringhe UNICHE della pagina costruita (dopo la patch V32): se un'ancora manca o non è unica la costruzione si ferma."""
import sys

CSS = r"""
/* ===== V33: quadro strumenti, frecce e pedali ===== */
#crq{position:absolute;left:50%;bottom:calc(4px + var(--sb));transform:translateX(-50%);width:min(31vw,380px);aspect-ratio:1200/880;filter:drop-shadow(0 6px 16px rgba(0,0,0,.65));touch-action:none;cursor:pointer}
#crq[hidden]{display:none}#crq.grande{width:min(47vw,600px)}#crq canvas{width:100%;height:100%;display:block}
#crq.nascosto{width:auto;aspect-ratio:auto;height:30px;padding:0 12px;border-radius:15px;background:rgba(10,10,12,.78);color:#ff4a36;font:700 12px system-ui,sans-serif;display:flex;align-items:center;letter-spacing:.06em}
#crq.nascosto canvas{display:none}#crq:not(.nascosto) .crl{display:none}
#cguida[hidden]{display:none}
.cfr{position:absolute;bottom:calc(14px + var(--sb));width:86px;height:86px;border-radius:20px;background:linear-gradient(180deg,rgba(40,44,52,.72),rgba(14,15,18,.82));border:2px solid rgba(255,255,255,.28);box-shadow:inset 0 2px 0 rgba(255,255,255,.12),0 6px 14px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;touch-action:none;padding:0}
.cfr svg{width:46px;height:46px;fill:#e9e9ec;filter:drop-shadow(0 1px 1px #000)}.cfr.on{background:linear-gradient(180deg,rgba(24,190,110,.85),rgba(8,110,60,.9));border-color:rgba(160,255,200,.9)}.cfr.on svg{fill:#fff}
#gsx{left:calc(14px + var(--sl))}#gdx{left:calc(110px + var(--sl))}
#cluci{position:absolute;left:calc(14px + var(--sl));bottom:calc(112px + var(--sb));display:flex;gap:6px}
#cluci .b{height:40px;min-width:40px;padding:0 10px;font-size:12px;font-weight:700}#cluci .b.on{background:rgba(30,150,255,.85);color:#fff}#lemer.on{background:rgba(230,40,30,.9)!important}#lnebbia.on{background:rgba(255,160,0,.9)!important}
#cpedali{position:absolute;right:calc(12px + var(--sr));bottom:calc(10px + var(--sb));display:flex;gap:14px;align-items:flex-end;perspective:420px}
.ped{position:relative;width:84px;height:108px;touch-action:none;transform-origin:50% 100%;transform:rotateX(calc(var(--p,0) * 24deg)) translateY(calc(var(--p,0) * 4px));transition:transform .04s linear}
.ped.acc{width:62px;height:142px}
.ped .pz{position:absolute;inset:0;border-radius:12px 12px 16px 16px;background:repeating-linear-gradient(180deg,#2b2d31 0 7px,#141518 7px 12px),#1b1c20;border:3px solid #8c9097;box-shadow:inset 0 0 0 2px #2f3237,inset 0 10px 14px rgba(255,255,255,.08),0 8px 16px rgba(0,0,0,.55)}
.ped.acc .pz{border-radius:10px 10px 14px 14px;background:repeating-linear-gradient(180deg,#2d2f33 0 6px,#121316 6px 10px),#1b1c20}
.ped b{position:absolute;left:0;right:0;bottom:8px;text-align:center;font:800 11px system-ui,sans-serif;letter-spacing:.08em;color:#d7d9de;text-shadow:0 1px 2px #000;pointer-events:none}
.ped s{position:absolute;left:6px;right:6px;bottom:26px;height:calc(var(--p,0) * (100% - 34px));border-radius:5px;background:linear-gradient(0deg,rgba(255,60,40,.55),rgba(255,120,60,.15));pointer-events:none}
.ped.acc s{background:linear-gradient(0deg,rgba(40,220,120,.55),rgba(120,255,170,.12))}
#hud.inauto #joy{display:none!important}#hud.inauto #sp,#hud.inauto #qd{display:none!important}
#hud.inauto #act{right:calc(12px + var(--sr));bottom:calc(166px + var(--sb));height:48px;min-width:100px;font-size:13px}
#hud.inauto #hb{right:calc(112px + var(--sr));bottom:calc(132px + var(--sb));height:40px;min-width:84px;font-size:11px}
#hud.inauto #gbx{right:calc(182px + var(--sr));bottom:calc(14px + var(--sb));flex-direction:column}
#hud.inauto #rep{right:calc(12px + var(--sr));bottom:calc(222px + var(--sb))}
#hud.inauto #sub{bottom:calc(min(31vw,380px) * .733 + 14px + var(--sb))}
#hud.inauto #cr{bottom:auto;top:calc(2px + var(--st));left:9%;right:31%;font-size:7.5px;line-height:1.15;opacity:.55}   /* crediti della mappa (obbligatori): in auto sopra, fuori da quadro e pedali */
"""

HTML = r"""<div id="crq" hidden title="Quadro strumenti: tocca per cambiare dimensione, tieni premuto sul display per azzerare i parziali"><canvas id="crcv"></canvas><span class="crl">⏲ QUADRO</span></div>
<div id="cguida" hidden>
 <button class="cfr" id="gsx" aria-label="Sterza a sinistra"><svg viewBox="0 0 24 24"><path d="M15.5 3.5 6 12l9.5 8.5V15h3V9h-3z"/></svg></button>
 <button class="cfr" id="gdx" aria-label="Sterza a destra"><svg viewBox="0 0 24 24"><path d="M8.5 3.5 18 12l-9.5 8.5V15h-3V9h3z"/></svg></button>
 <div id="cluci"><button class="b" id="lfari" title="Fari (L)">💡 AUTO</button><button class="b" id="lemer" title="Luci di emergenza (H)">⚠</button><button class="b" id="lnebbia" title="Retronebbia">❄D</button></div>
 <div id="cpedali"><div class="ped" id="pfreno" aria-label="Pedale del freno"><i class="pz"></i><s></s><b>FRENO</b></div><div class="ped acc" id="pacc" aria-label="Pedale dell'acceleratore"><i class="pz"></i><s></s><b>GAS</b></div></div>
</div>
"""

GLUE = r"""
/* ===================================================================================================================
   V33 — QUADRO STRUMENTI, COMANDI A FRECCE E PEDALI, FARI, PORTIERE BLOCCATE (motore/cruscotto.js; sorgenti/patch_cruscotto_v33.py)
   =================================================================================================================== */
var CRU={ok:!!(window.IOW_CRUSCOTTO&&typeof VEHOK!=='undefined'&&VEHOK),st:null,cmd:null,fari:{modo:'auto',emergenza:false,retronebbia:false},galleria:false,
 porte:{bloccate:false,calci:0,sfondato:false},dim:0,drawT:0,saveT:0,cv:null,g:null,ultimo:null,boPrec:false,koPrec:false,tLungo:null,
 MODI:['auto','spenti','posizione','anabbaglianti','abbaglianti'],NOMI:{auto:'AUTO',spenti:'SPENTI',posizione:'POSIZ.',anabbaglianti:'ANABB.',abbaglianti:'ABBAGL.'},
 init(){if(!CRU.ok)return;let odo;try{const s=JSON.parse(localStorage.getItem('iow_cruscotto_v1')||'null');if(s&&Number.isFinite(s.odoKm))odo=s.odoKm;if(s&&s.fari&&CRU.MODI.includes(s.fari))CRU.fari.modo=s.fari}catch(e){}
  CRU.st=IOW_CRUSCOTTO.crea({odoKm:odo,redline:VEH.par.limitatore});CRU.cmd=IOW_CRUSCOTTO.creaComandi();CRU.cv=$('#crcv');CRU.g=CRU.cv?CRU.cv.getContext('2d'):null;
  const tasto=(id,k)=>{const el=$(id);if(!el)return;const giu=e=>{e.preventDefault();e.stopPropagation();try{el.setPointerCapture(e.pointerId)}catch(_){}IOW_CRUSCOTTO.premi(CRU.cmd,k);el.classList.add('on')},su=e=>{IOW_CRUSCOTTO.rilascia(CRU.cmd,k);el.classList.remove('on')};
   el.addEventListener('pointerdown',giu);el.addEventListener('pointerup',su);el.addEventListener('pointercancel',su);el.addEventListener('lostpointercapture',su)};
  tasto('#gsx','sx');tasto('#gdx','dx');
  const pedale=(id,k)=>{const el=$(id);if(!el)return;let pid=null;const rel=e=>{const r=el.getBoundingClientRect();return (e.clientY-r.top)/Math.max(1,r.height)};
   el.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();pid=e.pointerId;try{el.setPointerCapture(pid)}catch(_){}IOW_CRUSCOTTO.premi(CRU.cmd,k,rel(e))});
   el.addEventListener('pointermove',e=>{if(e.pointerId===pid)IOW_CRUSCOTTO.premi(CRU.cmd,k,rel(e))});
   const su=e=>{if(e.pointerId!==pid)return;pid=null;IOW_CRUSCOTTO.rilascia(CRU.cmd,k)};el.addEventListener('pointerup',su);el.addEventListener('pointercancel',su);el.addEventListener('lostpointercapture',su)};
  pedale('#pacc','acc');pedale('#pfreno','freno');
  const bf=$('#lfari');if(bf)bf.addEventListener('click',e=>{e.stopPropagation();CRU.cambiaFari()});
  const be=$('#lemer');if(be)be.addEventListener('click',e=>{e.stopPropagation();CRU.fari.emergenza=!CRU.fari.emergenza;CRU.etichette()});
  const bn=$('#lnebbia');if(bn)bn.addEventListener('click',e=>{e.stopPropagation();CRU.fari.retronebbia=!CRU.fari.retronebbia;CRU.etichette()});
  const q=$('#crq');if(q){q.addEventListener('pointerdown',e=>{e.stopPropagation();const r=q.getBoundingClientRect(),L=IOW_CRUSCOTTO.LAYOUT.lcd,p0=IOW_CRUSCOTTO.aPixel(r.width,r.height,L.x,L.y),p1=IOW_CRUSCOTTO.aPixel(r.width,r.height,L.x+L.w,L.y+L.h),x=e.clientX-r.left,y=e.clientY-r.top;
    CRU.tLungo=(x>=p0[0]&&x<=p1[0]&&y>=p0[1]&&y<=p1[1]&&CRU.dim!==2)?setTimeout(()=>{CRU.tLungo='fatto';CRU.st.odo.parzialeKm=0;toast('Chilometri parziali azzerati')},650):null});
   q.addEventListener('pointerup',e=>{e.stopPropagation();if(CRU.tLungo==='fatto'){CRU.tLungo=null;return}if(CRU.tLungo)clearTimeout(CRU.tLungo);CRU.tLungo=null;CRU.dim=(CRU.dim+1)%3;q.classList.toggle('grande',CRU.dim===1);q.classList.toggle('nascosto',CRU.dim===2);CRU.drawT=9})}
  addEventListener('keydown',e=>{if(!inCar)return;const k=e.key.toLowerCase();if(k==='l')CRU.cambiaFari();else if(k==='h'){CRU.fari.emergenza=!CRU.fari.emergenza;CRU.etichette()}});
  CRU.etichette()},
 cambiaFari(){const i=CRU.MODI.indexOf(CRU.fari.modo);CRU.fari.modo=CRU.MODI[(i+1)%CRU.MODI.length];CRU.etichette();toast('Fari: '+({auto:'automatici (accesi di notte e in galleria)',spenti:'spenti',posizione:'luci di posizione',anabbaglianti:'anabbaglianti',abbaglianti:'abbaglianti'})[CRU.fari.modo]);CRU.salva()},
 etichette(){const b=$('#lfari');if(b){b.textContent='💡 '+CRU.NOMI[CRU.fari.modo];b.classList.toggle('on',CRU.fari.modo!=='spenti')}const e=$('#lemer');if(e)e.classList.toggle('on',CRU.fari.emergenza);const n=$('#lnebbia');if(n)n.classList.toggle('on',CRU.fari.retronebbia)},
 notte(){try{return UNI.uNight.value}catch(e){return 0}},
 buio(){return CRU.notte()>.25||CRU.galleria},
 /* fari effettivamente accesi: in AUTO anabbaglianti di notte e in galleria (sensore crepuscolare), altrimenti spenti */
 fariEffettivi(){const m=CRU.fari.modo;if(m==='auto')return CRU.buio()?'anabbaglianti':'spenti';return m},
 /* distanza massima a cui la polizia vede l'auto: di notte o in galleria a fari spenti 35 m, con le sole luci di posizione 70 m */
 visibilitaMax(){if(!CRU.ok||!inCar||!CRU.buio())return 1e9;const f=CRU.fariEffettivi();return f==='spenti'?35:f==='posizione'?70:1e9},
 porteBloccate(){return CRU.porte.bloccate&&!CRU.porte.sfondato},
 /* telaio deformato → portiere bloccate (zone nominate del Vehicle Damage Solver; senza solver: zone centrali della rete) */
 controllaPorte(){const P_=CRU.porte,z=VDS.st&&VDS.st.zone,g=k=>z&&z[k]?z[k].integrita:1,s=DANS.comp.struttura||[1,1,1,1,1,1];
  const rotto=z?(g('porte')<.6||g('montanti')<.65||g('abitacolo')<.8):Math.min(s[2],s[3])<.55,sano=z?(g('porte')>=.85&&g('montanti')>=.85&&g('abitacolo')>=.9):Math.min(s[2],s[3])>=.9;
  if(!P_.bloccate&&rotto&&inCar){P_.bloccate=true;P_.calci=0;P_.sfondato=false;toast('Telaio deformato: le portiere sono bloccate. Per uscire sfonda il parabrezza (10 calci)')}
  else if(P_.bloccate&&sano){P_.bloccate=false;P_.calci=0;P_.sfondato=false}},
 calcio(){const P_=CRU.porte;if(Math.hypot(V.vx,V.vz)>1){toast('Fermati prima di calciare il parabrezza');return}
  P_.calci++;const car={x:C.x,z:C.z,h:C.h,y:V.y,vx:0,vz:0,player:true};V.pt=-.06;
  try{if(typeof crBang==='function')crBang(.5+P_.calci*.05,650+P_.calci*70,.16)}catch(e){}
  if(P_.calci===4)try{crGlassCrack(carA,car,0,'calci')}catch(e){}
  if(P_.calci>=10){P_.sfondato=true;try{crGlassBreak(carA,car,'ws')}catch(e){}toast('Parabrezza sfondato: esci dal davanti');const sn=Math.sin(C.h),cn=Math.cos(C.h);exitCarV33();const q=push(C.x+sn*3.4,C.z+cn*3.4,P.r,V.y);P.x=q[0];P.z=q[1];P.y=GY(P.x,P.z,V.y,true)}
  else toast('Calcio sul parabrezza: '+P_.calci+'/10'+(P_.calci>=4?' (si crepa)':''))},
 comandi(dt){if(!CRU.ok)return null;const o=IOW_CRUSCOTTO.passoComandi(CRU.cmd,dt),pa=$('#pacc'),pf=$('#pfreno');if(pa)pa.style.setProperty('--p',o.acc.toFixed(3));if(pf)pf.style.setProperty('--p',o.freno.toFixed(3));return o},
 ingressi(){const v=VEH,m=v.motore,cen=v.centralina,mf=v.mod.freni||[1,1,1,1],Cm=DANS.comp,parti=(carA.cr&&carA.cr.parts)||{};
  let mil=false;try{mil=Object.values(ECUN.ecu.EMS.dtc).some(d=>d.stato==='attivo')}catch(e){}
  const servizio=['radiatore','motore','cambio','frizione','differenziale','centraline','sterzo','batteria','elettrico'].some(k=>Cm[k]<.7)||DANS.termico<.7;
  return{quadro:inCar,motoreAcceso:m.acceso,rpm:m.rpm,vx:VEHOK?v.v:cs.v,consumoLh:m.consumoLh,Tacqua:m.Tacqua,carbL:v.carburante.litri,serbatoioL:v.par.serbatoio,riserva:v.carburante.riserva,marcia:v.cambio.marcia,
   frenoMano:!!(K[' ']||K.hb),freniIntegrita:(mf[0]+mf[1]+mf[2]+mf[3])/4,centralina:{stato:cen.stato,abs:cen.abs.attivo.some(Boolean),tcs:cen.tcs.attivo,esp:cen.esp.attivo},absOK:!!v.ecu.abs,espOK:v.ecu.esp!==false,
   batteriaV:ECUN.batteria.V,alternatore:v.mod.alternatore,milDTC:mil,motoreIntegrita:Math.min(Cm.motore,DANS.termico),fari:CRU.fariEffettivi(),fariGuasti:(Cm.fari&&Math.min(...Cm.fari)<.5)||(Cm.fanali&&Math.min(...Cm.fanali)<.5),
   retronebbia:CRU.fari.retronebbia,emergenza:CRU.fari.emergenza,porteBloccate:CRU.porteBloccate(),portaAperta:['dFL','dRL','dFR','dRR'].some(k=>parti[k]&&parti[k].st!=='closed'),posizione:{x:C.x,z:C.z},assistenza:servizio}},
 step(dt){if(!CRU.ok)return;const hud=$('#hud');if(hud&&hud.classList.contains('inauto')!==inCar)hud.classList.toggle('inauto',inCar);
  const q=$('#crq'),cg=$('#cguida');if(q&&q.hidden===inCar)q.hidden=!inCar;if(cg&&cg.hidden===inCar)cg.hidden=!inCar;
  if(!inCar){IOW_CRUSCOTTO.rilascia(CRU.cmd,'sx');IOW_CRUSCOTTO.rilascia(CRU.cmd,'dx');IOW_CRUSCOTTO.rilascia(CRU.cmd,'acc');IOW_CRUSCOTTO.rilascia(CRU.cmd,'freno')}
  try{CRU.galleria=inCar&&REAL.terrainH(C.x,C.z)-V.y>2.5}catch(e){CRU.galleria=false}   /* sotto la montagna: più di 2,5 m di terreno sopra l'auto */
  CRU.controllaPorte();
  const bo=VEH.centralina.stato==='BLACKOUT';if(bo&&!CRU.boPrec&&inCar){CRU.fari.emergenza=true;CRU.etichette()}CRU.boPrec=bo;   /* dopo l'urto si accendono da sole le luci di emergenza */
  const ko=Math.min(DANS.comp.motore,DANS.termico)<.3;if(ko&&!CRU.koPrec)toast('Motore KO: spie guasto motore e pressione olio accese');CRU.koPrec=ko;
  CRU.ultimo=IOW_CRUSCOTTO.aggiorna(CRU.st,dt,CRU.ingressi());
  CRU.drawT+=dt;if(inCar&&CRU.dim!==2&&CRU.g&&CRU.drawT>=1/30){CRU.drawT=0;const c=CRU.cv,r=Math.min(2,devicePixelRatio||1),w=Math.round(c.clientWidth*r),h=Math.round(c.clientHeight*r);if(w>10&&h>10){if(c.width!==w||c.height!==h){c.width=w;c.height=h}IOW_CRUSCOTTO.disegna(CRU.g,CRU.ultimo)}}
  CRU.saveT+=dt;if(CRU.saveT>5){CRU.saveT=0;CRU.salva()}},
 salva(){if(!CRU.st)return;try{localStorage.setItem('iow_cruscotto_v1',JSON.stringify({odoKm:+CRU.st.odo.totaleKm.toFixed(3),fari:CRU.fari.modo}))}catch(e){}}};
const exitCarV33=exitCar;exitCar=function(){if(CRU.ok&&CRU.porteBloccate()){CRU.calcio();return}exitCarV33()};
CRU.init();
"""


def applica(h):
    n = [0]

    def rep(a, b, cnt=1):
        nonlocal h
        c = h.count(a)
        if c != cnt:
            raise SystemExit('patch cruscotto V33: ancora non trovata/non unica (%d): %s' % (c, a[:110]))
        n[0] += 1
        h = h.replace(a, b)

    # 1. modulo
    rep('<script src="motore/veicoli_db.js"></script><script src="motore/pneumatici_mf.js"></script>',
        '<script src="motore/cruscotto.js"></script><script src="motore/veicoli_db.js"></script><script src="motore/pneumatici_mf.js"></script>')
    # 2. stile e elementi del quadro e dei comandi
    rep('#gbx{position:absolute;right:calc(20px + var(--sr));bottom:calc(236px + var(--sb));display:none;gap:6px}',
        '#gbx{position:absolute;right:calc(20px + var(--sr));bottom:calc(236px + var(--sb));display:none;gap:6px}' + CSS)
    rep('<div id="joy"><div id="base"><div id="knob"></div></div></div>',
        '<div id="joy"><div id="base"><div id="knob"></div></div></div>\n' + HTML)
    # 3. ciclo: in auto la levetta non conta più; sterzo e pedali dai comandi a schermo (più la tastiera)
    rep("const ix=cl(joy.x+(K.d||K.arrowright?1:0)-(K.a||K.arrowleft?1:0),-1,1),iy=cl(joy.y+(K.w||K.arrowup?1:0)-(K.s||K.arrowdown?1:0),-1,1);",
        "const kx=(K.d||K.arrowright?1:0)-(K.a||K.arrowleft?1:0),ky=(K.w||K.arrowup?1:0)-(K.s||K.arrowdown?1:0),cmd=inCar&&typeof CRU!=='undefined'?CRU.comandi(dt):null;   /* V33: in auto niente levetta, frecce e pedali */\n"
        " const ix=cmd?cl(cmd.ix+kx,-1,1):cl(joy.x+kx,-1,1),iy=cmd?cl(cmd.iy+ky,-1,1):cl(joy.y+ky,-1,1);")
    rep("function step(dt){const ts=performance.now()/1000;dmgDrive();dmgStep(dt);VEHX.step(dt);",
        GLUE + "function step(dt){const ts=performance.now()/1000;dmgDrive();dmgStep(dt);VEHX.step(dt);if(typeof CRU!=='undefined')CRU.step(dt);")
    # 4. «Scendi» diventa «Calcia il parabrezza (n/10)» con le portiere bloccate
    rep(" if(inCar)L3.push({x:px,z:pz,r:99,t:'Scendi dall\\u2019auto',a:exitCar});",
        " if(inCar)L3.push({x:px,z:pz,r:99,t:typeof CRU!=='undefined'&&CRU.ok&&CRU.porteBloccate()?'Calcia il parabrezza ('+CRU.porte.calci+'/10)':'Scendi dall\\u2019auto',a:exitCar});")
    # 5. fascio dei fari: modo scelto, anche in galleria, più lungo con gli abbaglianti
    rep("if(HEAD){const on=night>.25&&typeof inCar!=='undefined'&&inCar;HEAD.visible=on;HEADM.opacity=on?Math.min(1,night*1.4)*.55:0}",
        "if(HEAD){const fz=typeof CRU!=='undefined'&&CRU.ok?CRU.fariEffettivi():'anabbaglianti',lv=fz==='abbaglianti'?2:fz==='anabbaglianti'?1:0,buio=Math.max(night,typeof CRU!=='undefined'&&CRU.galleria?.85:0),on=lv>0&&buio>.25&&typeof inCar!=='undefined'&&inCar;HEAD.visible=on;HEADM.opacity=on?Math.min(1,buio*1.4)*(lv===2?.78:.55):0;HEAD.scale.set(lv===2?1.2:1,1,lv===2?1.65:1)}")
    # 6. polizia: a fari spenti, di notte o in galleria, l'auto si vede solo da vicino
    rep("function pdCanSee(u,tx,tz){const dx=tx-u.x,dz=tz-u.z,d=Math.hypot(dx,dz);",
        "function pdCanSee(u,tx,tz){const dx=tx-u.x,dz=tz-u.z,d=Math.hypot(dx,dz);if(typeof CRU!=='undefined'&&d>CRU.visibilitaMax())return false;")
    return h, n[0]


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit('uso: python3 patch_cruscotto_v33.py pagina_in.html pagina_out.html')
    h = open(sys.argv[1], encoding='utf-8').read(); h, k = applica(h); open(sys.argv[2], 'w', encoding='utf-8').write(h); print('sostituzioni:', k)
