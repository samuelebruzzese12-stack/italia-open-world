# 62) VERSIONE 23 — telefono in orizzontale e scorrimento col dito
# (eseguito da build.py dopo build_armi.py: usa rep() e la pagina h)
#  - disposizione compatta dell'interfaccia quando il telefono è in orizzontale (altezza fino a 520 px): pulsanti e minimappa più
#    piccoli, colpi in alto al centro, mira/ricarica/spara lontani dalla minimappa, freno a mano e Ripara sotto la scritta della zona,
#    sottotitoli in basso al centro, mappa alta quanto lo schermo, menu del bar, pannello della polizia e ruota della radio che entrano;
#  - armeria in orizzontale: schede su una sola riga che scorre di lato (più spazio per l'elenco);
#  - pulsante schermo intero (con blocco in orizzontale dove il browser lo permette) nella colonna di sinistra;
#  - campo visivo: in orizzontale l'angolo orizzontale resta entro 100° (prima arrivava a ~110° e deformava i lati).
ORIZZ_CSS = '''#colpi{bottom:calc(216px + var(--sb))}
#bfull{position:absolute;left:calc(10px + var(--sl));top:calc(178px + var(--st));width:46px;height:46px;min-width:0;border-radius:50%;padding:0;display:flex;align-items:center;justify-content:center}
#bfull svg{display:block}#bfull .i2{display:none}#bfull.on .i1{display:none}#bfull.on .i2{display:block}#bfull[hidden]{display:none}
@media (orientation:landscape) and (max-height:520px){
 #top{top:calc(6px + var(--st))}#top .b{height:42px;min-width:42px;padding:0 10px;font-size:12px}#top .chip{padding:6px 10px;font-size:13px}
 #mm{top:calc(56px + var(--st));width:86px;height:86px}
 #zn{top:calc(146px + var(--st));max-width:120px;font-size:10px;padding:3px 8px}
 #pbtn{top:calc(56px + var(--st));width:42px;height:42px;font-size:20px}
 #barmi{top:calc(104px + var(--st));width:42px;height:42px;font-size:10px}
 #bfull{top:calc(152px + var(--st));width:42px;height:42px}
 #heat{left:calc(60px + var(--sl));top:calc(62px + var(--st))}
 #dmg{left:calc(60px + var(--sl));top:calc(110px + var(--st));bottom:auto}
 #sub{left:50%;top:auto;bottom:calc(24px + var(--sb));transform:translateX(-50%);max-width:min(56%,520px);text-align:center}
 #base{left:calc(26px + var(--sl));bottom:calc(22px + var(--sb));width:104px;height:104px}#knob{width:50px;height:50px;margin:-25px}
 #act{right:calc(14px + var(--sr));bottom:calc(14px + var(--sb));height:50px;min-width:104px;font-size:14px}
 #hb{right:calc(14px + var(--sr));bottom:calc(74px + var(--sb));height:44px;min-width:90px;font-size:11px}
 #rep{right:calc(116px + var(--sr));bottom:calc(74px + var(--sb));height:44px;min-width:110px;font-size:13px}
 #bspara{right:calc(16px + var(--sr));bottom:calc(76px + var(--sb));width:70px;height:70px;font-size:11px}
 #bmira{right:calc(98px + var(--sr));bottom:calc(126px + var(--sb));width:50px;height:50px;font-size:10px}
 #bricarica{right:calc(98px + var(--sr));bottom:calc(72px + var(--sb));width:50px;height:50px;font-size:8.5px}
 #colpi{left:50%;right:auto;top:calc(10px + var(--st));bottom:auto;transform:translateX(-50%);max-width:34%;font-size:12px;padding:5px 10px}
 #toast,#rnow{top:calc(54px + var(--st))}
 #cr{font-size:9px}
 #map{flex-direction:row;gap:0}
 #mc{width:auto;height:calc(100% - 16px);max-width:calc(100% - 230px)}
 #mt{position:absolute;left:calc(14px + var(--sl));top:calc(16px + var(--st));max-width:calc(50% - 50vh - 12px);text-align:left;line-height:1.3}
 #mx{position:absolute;right:calc(14px + var(--sr));bottom:calc(14px + var(--sb))}
 #menu{max-height:calc(100% - 16px);width:min(92vw,560px);padding:10px;gap:6px}
 #items{max-height:none;flex:1 1 auto;min-height:0}
 #pp{top:calc(56px + var(--st));max-height:calc(100% - 66px)}
 #rw{gap:6px}#rwc{transform:scale(.74);margin:-36px 0}
 #armTop{padding-top:calc(6px + var(--st));padding-bottom:6px}#armTop .b{height:36px}
 #armCat{top:calc(50px + var(--st));flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;padding-bottom:2px}#armCat::-webkit-scrollbar{display:none}
 #armView{top:calc(48px + var(--st))}
 #armInfo{bottom:calc(60px + var(--sb));max-height:40%;padding:6px 10px;font-size:11.5px}#armInfo h3{font-size:14px}
 #armBtns{bottom:calc(8px + var(--sb))}#armBtns .b{height:42px}
 #armCred{bottom:calc(10px + var(--sb))}
}
@media (orientation:landscape) and (max-height:520px) and (max-width:860px){#armCred{display:none}}
'''
rep('</style>', ORIZZ_CSS + '</style>')
FULL_BTN = ('<button class="b" id="bfull" title="Schermo intero">'
  '<svg class="i1" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/></svg>'
  '<svg class="i2" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5"/></svg></button>')
rep('<button class="b" id="barmi" title="Armeria">ARMI</button>', '<button class="b" id="barmi" title="Armeria">ARMI</button>' + FULL_BTN)
# campo visivo: in orizzontale l'angolo orizzontale resta entro 100° (in verticale nulla cambia)
rep("const fov=65+Math.min(14,sp*.45);", "const fov=(65+Math.min(14,sp*.45))*fovK();")
ORIZZ_JS = r'''
/* ===== Versione 23: telefono in orizzontale, schermo intero ===== */
function fovK(){const a=cam.aspect||1;if(a<=1.45)return 1;const v=2*Math.atan(Math.tan(50*Math.PI/180)/a)*180/Math.PI;return Math.min(1,v/65)}
function fsOn(){return !!(document.fullscreenElement||document.webkitFullscreenElement)}
function fsCan(){const d=document;return !!((d.documentElement.requestFullscreen||d.documentElement.webkitRequestFullscreen)&&d.fullscreenEnabled!==false&&!(d.fullscreenEnabled===undefined&&d.webkitFullscreenEnabled===false))}
function fsIcon(){const b=$('#bfull');if(!b)return;b.classList.toggle('on',fsOn());b.title=fsOn()?'Esci dallo schermo intero':'Schermo intero'}
function fsToggle(){const d=document,el=d.documentElement;
 if(fsOn()){try{if(screen.orientation&&screen.orientation.unlock)screen.orientation.unlock()}catch(e){}const ex=d.exitFullscreen||d.webkitExitFullscreen;try{const p=ex&&ex.call(d);if(p&&p.catch)p.catch(()=>{})}catch(e){}return}
 const no=()=>toast(innerWidth<innerHeight?'Qui lo schermo intero non è permesso: gira il telefono in orizzontale':'Qui lo schermo intero non è permesso');
 const rq=el.requestFullscreen||el.webkitRequestFullscreen;if(!rq){no();return}
 let p;try{p=rq.call(el,{navigationUI:'hide'})}catch(e){no();return}
 Promise.resolve(p).then(()=>setTimeout(()=>{if(!fsOn()){no();return}const o=screen.orientation;if(o&&o.lock)o.lock('landscape').catch(()=>{if(innerWidth<innerHeight)toast('Gira il telefono in orizzontale')})},60)).catch(no)}
{const b=$('#bfull');if(b){b.hidden=!fsCan();b.onclick=fsToggle;let st=null;setInterval(()=>{const on=fsOn();if(on!==st){st=on;fsIcon();setTimeout(fit,60)}},700)}}
for(const ev of ['fullscreenchange','webkitfullscreenchange'])document.addEventListener(ev,()=>{fsIcon();setTimeout(fit,80);setTimeout(()=>{try{if(ARM.open)armLayout()}catch(e){}},140)});
setTimeout(()=>{if(innerWidth<innerHeight&&!fsOn())toast('Gira il telefono in orizzontale')},7000);
'''
rep("$('#close').onclick=()=>{menu=false;$('#menu').hidden=true};", "$('#close').onclick=()=>{menu=false;$('#menu').hidden=true};" + ORIZZ_JS)
