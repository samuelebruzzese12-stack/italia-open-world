import os
# Versione 24: mappa reale dell'Italia (OpenStreetMap / OpenMapTiles via OpenFreeMap + rilievo Mapterhorn) al posto del mondo inventato.
# Eseguito da build.py dopo build_orizz.py; lavora sulla variabile globale h (la pagina) con rep().
RD=os.environ.get('IOW_MAPPA', REPO+'sorgenti/mappa_reale/')   # v31: sorgenti della mappa letti dal repository (una sola copia)
rd=lambda f:open(RD+f,encoding='utf-8').read()
# ---- 1) via il modulo WORLD, CHK, testure/materiali del vecchio mondo, mare, terreno lontano, blocchi, minimappa e mappa vecchie
i=h.find('const WORLD=(()=>{'); j=h.find('/* ===== Traffico e pedoni')
assert 0<i<j
_rm=rd('real_main.js');assert _rm.count('/*@@PBR@@*/')==1 and _rm.count('/*@@CIELO@@*/')==1
_rm=_rm.replace('/*@@PBR@@*/',rd('pbr_in.js')).replace('/*@@CIELO@@*/',rd('cielo_in.js'))
h=h[:i]+_rm+'\n'+h[j:]
# ---- 2) scena statica del vecchio bar: niente mesh, insegne, luci, porta, personaggi, auto del traffico, passanti
rep("m.castShadow=m.receiveShadow=true;sc.add(m)}\n\n/* Strada e palazzi */","m.castShadow=m.receiveShadow=true;/* V24: il vecchio bar non è più nella scena */}\n\n/* Strada e palazzi */")
rep("const m=lab(c,3.2,.6);m.position.set(6.38,3.95,5);m.rotation.y=-PI/2;sc.add(m)","const m=lab(c,3.2,.6);m.position.set(6.38,3.95,5);m.rotation.y=-PI/2")
rep("const m=lab(c,3.6,1.7);m.position.set(10.5,2.3,-.7);sc.add(m)","const m=lab(c,3.6,1.7);m.position.set(10.5,2.3,-.7)")
rep("l.position.set(p[0],p[1],p[2]);sc.add(l)","l.position.set(p[0],p[1],p[2])")
rep("const door=new T.Group();door.position.set(6.625,0,5.65);sc.add(door);","const door=new T.Group();door.position.set(6.625,0,5.65);")
rep("const NP=[[5.25,-30,1,0xd9534f,0x333355,0x3b2a1a],[-5.25,15,-1,0xf0ad4e,0x2b2b2b,0x111111]].map(","const NP=[].map(")
rep("const TR=[[-2,-50,1,0x2f5fa8],[2,40,-1,0xe8e8e8]].map(","const TR=[].map(")
rep("const item=new T.Group(),IM={};item.position.set(15.15,1.6,5.2);sc.add(item);" if False else "const item=new T.Group(),IM={};item.position.set(15.15,1.16,5.2);sc.add(item);","const item=new T.Group(),IM={};item.position.set(15.15,1.16,5.2);")
rep("const CUPS=[3.7,6.3].map(z=>{const m=new T.Mesh(CUPG,mat(0xffffff));m.position.set(15.15,1.16,z);m.visible=false;sc.add(m);return m});","const CUPS=[3.7,6.3].map(z=>{const m=new T.Mesh(CUPG,mat(0xffffff));m.position.set(15.15,1.16,z);m.visible=false;return m});")
# i personaggi seduti e il personale del bar vengono creati (il codice dei danni e della polizia usa person()) ma tolti dalla scena
rep("const bar=person({sh:0xf4f4f4,pa:0x1a1a1a,ha:0x1a1a1a,sk:0xe0b088,sl:1});","for(const g of INB)sc.remove(g);const bar=person({sh:0xf4f4f4,pa:0x1a1a1a,ha:0x1a1a1a,sk:0xe0b088,sl:1});sc.remove(bar);")
rep("const wait=person({sh:0x222222,pa:0x111111,ha:0x3b2a1a,sl:1});INB.push(wait);","const wait=person({sh:0x222222,pa:0x111111,ha:0x3b2a1a,sl:1});INB.push(wait);sc.remove(wait);sc.remove(cassa);")
# ---- 3) ciclo di gioco: via pedaggi, pattuglia del bar, traffico, passanti, animazioni del bar; zona = nome del luogo vero
rep("tollStep();dmgDrive()","dmgDrive()")
rep("far=Math.hypot(px-12.5,pz-5)>26","far=true")
rep("ccStep(dt,ts);","")
rep("ambUpdate(dt,px,pz);PD.update(dt,px,pz);","PD.update(dt,px,pz);")
rep("const zz=WORLD.zone(px,pz);if(zz!==znLast){znLast=zz;$('#zn').textContent=ZN[zz]}","const zz=REAL.hudText(px,pz);if(zz!==znLast){znLast=zz;$('#zn').textContent=zz;$('#zn').style.display=zz?'block':'none'}")
# ---- 4) avvio: niente traffico né polizia (non ancora portati sulla rete stradale vera); si parte dalla mappa reale
rep("ambInit();pdInit();armInit();worldUpdate(P.x,P.z,25);drawMini();{const ld=$('#ld');if(ld&&ld.remove)ld.remove()}setTimeout(()=>toast('Tocca la minimappa per aprire la mappa'),2500);",
    "armInit();solids.length=0;{const pb=$('#pbtn');if(pb)pb.hidden=true}REAL.start();worldUpdate(P.x,P.z,25);{const ld=$('#ld');if(ld&&ld.remove)ld.remove()}setTimeout(()=>toast('Tocca la minimappa per aprire la mappa d\\u2019Italia'),9000);")
# ---- 5) interazioni: auto, e bar/caffè veri di OpenStreetMap
rep(""" else{L3.push({x:6.6,z:5,r:2.4,t:S.door?'Chiudi la porta':'Apri la porta',a:()=>{S.door=!S.door;doorS.on=S.door?0:1;save()}},
  {x:14.3,z:5,r:3.3,t:'Ordina al bancone',a:()=>{menu=true;$('#menu').hidden=false;renderMenu()}},
  {x:C.x,z:C.z,r:3,t:'Sali in auto',a:()=>{inCar=true;S.inCar=true;cs.v=0;camYaw=C.h;view=0;lookYaw=lookPitch=0;save();radioApply(RADIO.cur>0)}});""",
""" else{L3.push({x:C.x,z:C.z,r:4.6,t:'Sali in auto',a:()=>{inCar=true;S.inCar=true;cs.v=0;camYaw=C.h;view=0;lookYaw=lookPitch=0;save();radioApply(RADIO.cur>0)}});
  const bb=REAL.nearBar(px,pz);if(bb)L3.push({x:bb.x,z:bb.z,r:16,t:'Ordina'+(bb.name?' da '+bb.name:' al bar'),a:()=>{menu=true;$('#menu').hidden=false;$('#menu b').textContent=(bb.name||'Bar')+' · Menu';renderMenu()}});""")
# ---- 6) mappa: apertura, zoom, trascinamento, tocco per viaggiare, pizzico
rep("const openMap=o=>{mapOpen=o;$('#map').hidden=!o;if(o){MAPV.ox=MAPV.oz=0;drawMap()}};","const openMap=o=>{mapOpen=o;$('#map').hidden=!o;if(o)REAL.mapOpen();else REAL.mapClose()};")
rep("$('#mzo').addEventListener('pointerdown',e=>{e.stopPropagation();MAPV.zoom=Math.min(MAPV.levels.length-1,MAPV.zoom+1);drawMap()});$('#mzi').addEventListener('pointerdown',e=>{e.stopPropagation();MAPV.zoom=Math.max(0,MAPV.zoom-1);drawMap()});$('#mzc').addEventListener('pointerdown',e=>{e.stopPropagation();MAPV.ox=MAPV.oz=0;drawMap()});",
    "$('#mzo').addEventListener('pointerdown',e=>{e.stopPropagation();REAL.mapZoom(-1)});$('#mzi').addEventListener('pointerdown',e=>{e.stopPropagation();REAL.mapZoom(1)});$('#mzc').addEventListener('pointerdown',e=>{e.stopPropagation();REAL.mapCenter()});")
rep("{const mc=$('#mc');let pid=null,lx=0,ly=0;mc.addEventListener('pointerdown',e=>{if(pid!==null)return;pid=e.pointerId;lx=e.clientX;ly=e.clientY;try{mc.setPointerCapture(pid)}catch(_){}e.stopPropagation()});mc.addEventListener('pointermove',e=>{if(e.pointerId!==pid)return;const r=mc.getBoundingClientRect(),k=MAPV.levels[MAPV.zoom]/r.width;MAPV.ox+=(e.clientX-lx)*k;MAPV.oz+=(e.clientY-ly)*k;lx=e.clientX;ly=e.clientY;drawMap()});const end=e=>{if(e.pointerId!==pid)return;pid=null};mc.addEventListener('pointerup',end);mc.addEventListener('pointercancel',end)}",
"""{const mc=$('#mc'),PT=new Map();let moved=0,pd0=0,z0=0;const dist=()=>{const a=Array.from(PT.values());return Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1])};
 mc.addEventListener('pointerdown',e=>{PT.set(e.pointerId,[e.clientX,e.clientY]);try{mc.setPointerCapture(e.pointerId)}catch(_){}e.stopPropagation();if(PT.size===1)moved=0;if(PT.size===2){pd0=dist();z0=REAL.MAPV.z}});
 mc.addEventListener('pointermove',e=>{const p=PT.get(e.pointerId);if(!p)return;const r=mc.getBoundingClientRect(),k=mc.width/r.width,dx=e.clientX-p[0],dy=e.clientY-p[1];p[0]=e.clientX;p[1]=e.clientY;moved+=Math.abs(dx)+Math.abs(dy);
  if(PT.size===1)REAL.mapPan(dx*k,dy*k);else if(PT.size===2&&pd0>0){REAL.mapZoomTo(z0+Math.log2(dist()/pd0))}});
 const end=e=>{const p=PT.get(e.pointerId);if(!p)return;PT.delete(e.pointerId);if(PT.size===0&&moved<8&&e.type==='pointerup'){const r=mc.getBoundingClientRect(),k=mc.width/r.width;REAL.mapTap((e.clientX-r.left)*k,(e.clientY-r.top)*k)}if(PT.size===1)moved=99};mc.addEventListener('pointerup',end);mc.addEventListener('pointercancel',end)}""")
# ---- 7) posizione salvata anche in latitudine e longitudine; nebbia e distanza di vista per un territorio vero
rep("function savePos(){S.x=P.x;S.z=P.z;S.yaw=yaw}","function savePos(){S.x=P.x;S.z=P.z;S.yaw=yaw;REAL.saveGeo()}")
rep("sc.fog=new T.Fog(lc(0xdce8f5),120,700);","sc.fog=new T.Fog(lc(0xdce8f5),900,7000);")
rep("const cam=new T.PerspectiveCamera(65,1,.35,1400)","const cam=new T.PerspectiveCamera(65,1,.35,12000)")
# ---- 8) pagina: codice del lavoratore, schermata di caricamento, viaggio dalla mappa, fonti
WORKER=re.sub(r"if \(typeof module !== 'undefined'\) module\.exports[^\n]*\n",'',''.join(rd(f) for f in ['mvt.js','earcut.js','dem.js','cella.js','worker_main.js']))
assert '</script' not in WORKER.lower()
rep('<div id="ld">Caricamento del mondo…</div>','<div id="ld">Caricamento del mondo…</div>\n<script id="realw" type="text/plain">\n'+WORKER+'\n</script>')
rep('<div id="map" hidden><div id="mt">Mappa</div><canvas id="mc" width="900" height="900"></canvas>',
    '<div id="map" hidden><div id="mt">Mappa</div><canvas id="mc" width="900" height="900"></canvas><button class="b" id="mgo" hidden>Vai qui</button><div id="mcity"></div>')
rep('<button class="b" id="mx" style="color:var(--ink);background:rgba(255,255,255,.88);text-shadow:none">Chiudi</button></div>\n</div>',
    '<button class="b" id="mx" style="color:var(--ink);background:rgba(255,255,255,.88);text-shadow:none">Chiudi</button><button class="b s" id="mcred">Fonti</button>'
    '<div id="rcred" hidden><button class="b s" id="rcredx">Chiudi</button><div><b>Fonti della mappa reale</b><p>Dati geografici: © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors, licenza ODbL; schema e tile vettoriali <a href="https://openmaptiles.org/" target="_blank" rel="noopener noreferrer">OpenMapTiles</a> (licenza BSD/CC BY), serviti da <a href="https://openfreemap.org/" target="_blank" rel="noopener noreferrer">OpenFreeMap</a>.</p>'
    '<p>Rilievo del terreno: tile <a href="https://mapterhorn.com/" target="_blank" rel="noopener noreferrer">Mapterhorn</a> (elenco completo delle fonti su mapterhorn.com/attribution). Per l’Italia comprendono: TINITALY 10 m, Istituto Nazionale di Geofisica e Vulcanologia (INGV), CC BY 4.0 · DTM Regione Autonoma Valle d’Aosta 2 m, CC BY 4.0 · DGM Provincia Autonoma di Bolzano 2,5 m, CC0 · DTM Regione Lombardia 5 m, CC BY 4.0 · DTM Regione Piemonte 5 m, CC BY 4.0 · DTM Regione Autonoma della Sardegna 1 m, CC BY 4.0 · MDT Regione Siciliana 2 m, CC BY 4.0 · LiDAR Provincia Autonoma di Trento 5 m, CC BY 2.5 · Copernicus GLO-30 (© DLR e.V. 2010-2014 e Airbus Defence and Space GmbH 2014-2018, fornito nell’ambito di COPERNICUS dall’Unione Europea e dall’ESA).</p>'
    '<p>Gli edifici sono ricostruiti dalle sagome di OpenStreetMap: dove l’altezza non è registrata viene stimata. Le gallerie stradali sono percorribili.</p><p>Software: three.js (MIT, © 2010-2021 three.js authors); earcut (ISC, © 2016 Mapbox): «Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies. THE SOFTWARE IS PROVIDED “AS IS” AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS.» Catalogo completo delle fonti: docs/RESOURCE_CATALOG.md nel repository del gioco.</p></div></div></div>\n'
    '<div id="rld"><div id="rlt">Caricamento della mappa reale…</div><div id="rlp"></div><div id="rle"></div><button class="b" id="rlr" hidden>Riprova</button><div id="rla">Mappa © OpenStreetMap contributors · OpenMapTiles · OpenFreeMap · Rilievo Mapterhorn (INGV TINITALY e fonti regionali)</div></div>\n</div>')
rep('<div id="cr">Auto: «Alfa Romeo 159 Sedan And Wagon» di Nieve5677 (sketchfab.com) · licenza CC BY 4.0</div>',
    '<div id="cr">Mappa © OpenStreetMap contributors · OpenMapTiles · OpenFreeMap · Rilievo Mapterhorn (INGV TINITALY e fonti regionali) · Auto: «Alfa Romeo 159 Sedan And Wagon» di Nieve5677 (sketchfab.com), CC BY 4.0</div>')
REAL_CSS=("#rld{position:fixed;inset:0;z-index:12;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:20px;background:#1d2733;color:#fff;font:600 15px system-ui,sans-serif;text-align:center}#rld[hidden]{display:none}"
 "#rlt{font-size:20px;font-weight:800}#rlp{opacity:.8;font-size:13px}#rle{color:#ffb4a8;font-size:13px;max-width:520px}#rla{position:absolute;bottom:calc(10px + var(--sb));left:10px;right:10px;font-size:10px;opacity:.6}"
 "#mgo{background:var(--go);opacity:1;height:48px;font-size:14px}#mcity{display:flex;gap:6px;flex-wrap:nowrap;overflow-x:auto;max-width:96vw;padding:2px 4px;touch-action:pan-x}#mcity *{touch-action:pan-x}#mcity .b{height:40px;min-width:0;white-space:nowrap;font-size:12px;padding:0 10px;flex:0 0 auto}"
 "#mc{width:min(96vw,calc(100vh - 230px))}#mcred{position:absolute;left:calc(14px + var(--sl));bottom:calc(14px + var(--sb));height:40px}"
 "#rcred{position:absolute;inset:0;z-index:3;background:rgba(8,16,26,.97);color:#fff;padding:calc(14px + var(--st)) 16px calc(14px + var(--sb));overflow-y:auto;touch-action:pan-y;font:500 13px/1.45 system-ui,sans-serif}#rcred[hidden]{display:none}#rcred *{touch-action:pan-y}#rcred a{color:#8fc3ff}#rcred>button{float:right}"
 "#zn{display:none;white-space:pre-line;line-height:1.25;max-width:180px}"
 "@media (orientation:landscape) and (max-height:520px){#mc{width:auto;height:calc(100% - 16px)}#mcity{flex-direction:column;flex-wrap:nowrap;overflow-x:hidden;overflow-y:auto;max-height:calc(100% - 210px);width:190px;touch-action:pan-y;align-self:flex-start;margin-top:calc(124px + var(--st))}#mcity *{touch-action:pan-y}#mcity .b{height:34px}#mgo{position:absolute;right:calc(14px + var(--sr));top:calc(70px + var(--st));height:40px}#mcred{left:auto;right:calc(120px + var(--sr))}}")
rep('</style>','\n'+REAL_CSS+'\n</style>')
rep('CSOL,ADJ,WORLD,CHK,CHS,CSO,','CSOL,ADJ,WORLD,REAL,VITA,CHK,CHS,CSO,')
print('build_real ok')
# ---- Versione 25: traffico, passanti e polizia sulle strade vere (modulo VITA)
rep("/* ===== POLIZIA: eventi, registro, luoghi, navigazione sulla rete stradale ===== */", rd('vita.js')+"\n/* ===== POLIZIA: eventi, registro, luoghi, navigazione sulla rete stradale ===== */")
rep("REAL.start();worldUpdate(P.x,P.z,25);","REAL.start();VITA.init();pdOffence=function(kind,sev){VITA.PL.offence(kind,Math.min(2,(sev||1)*.5),3)};pdReport=function(kind,sev){VITA.PL.offence(kind,Math.min(2,(sev||1)*.5),3)};worldUpdate(P.x,P.z,25);")
rep("worldUpdate(px,pz,0);PD.update(dt,px,pz);","worldUpdate(px,pz,0);VITA.update(dt,px,pz);")
rep("if(q[2]&&(ux||uz)){const l=Math.hypot(ux,uz),mx=ux/l,mz=uz/l,vn=V.vx*mx+V.vz*mz;","if(q[2]&&(ux||uz)){const l=Math.hypot(ux,uz),mx=ux/l,mz=uz/l,vn=V.vx*mx+V.vz*mz;try{VITA.carHitBy(PO.s,-vn)}catch(e){}")
rep("function armReact(x,z){","function armReact(x,z){try{VITA.shot(x,z)}catch(e){}")
# il pulsante della polizia torna visibile (lo gestisce VITA)
rep("armInit();solids.length=0;{const pb=$('#pbtn');if(pb)pb.hidden=true}","armInit();solids.length=0;")
rep('<div class="ph">Polizia · intelligenza artificiale</div>','<div class="ph">Polizia · pattuglie sulle strade vere</div>')
# ---- Versione 26: luce un po' più morbida e calda
rep("sc.add(new T.HemisphereLight(lc(0xcfe4ff),lc(0x6a7050),.4));","sc.add(new T.HemisphereLight(lc(0xd6e6ff),lc(0x8a8577),.52));")
rep("const sun=new T.DirectionalLight(lc(0xfff1d6),1.5);","const sun=new T.DirectionalLight(lc(0xffeccc),1.38);")
# ---- Versione 27: gallerie percorribili (quota del terreno scelta vicino alla quota attuale anche a piedi)
# (Versione 29.3: a piedi anche le passerelle pedonali, quarto argomento "pedone")
rep("if(WORLD.wet(nx,nz)||!WORLD.inside(nx,nz,40)||(ds>1e-4&&(GY(nx,nz)-GY(P.x,P.z))/ds>1.5)){nx=P.x;nz=P.z}","if(WORLD.wet(nx,nz)||!WORLD.inside(nx,nz,40)||(ds>1e-4&&(GY(nx,nz,P.y,true)-GY(P.x,P.z,P.y,true))/ds>1.5)){nx=P.x;nz=P.z}")
rep(" P.y+=(GY(P.x,P.z)-P.y)*Math.min(1,dt*14)}"," P.y+=(GY(P.x,P.z,P.y,true)-P.y)*Math.min(1,dt*14)}")
rep("const q=push(C.x+Math.cos(C.h)*2.3,C.z-Math.sin(C.h)*2.3,P.r);P.x=q[0];P.z=q[1];P.y=GY(P.x,P.z);inCar=false;","const q=push(C.x+Math.cos(C.h)*2.3,C.z-Math.sin(C.h)*2.3,P.r);P.x=q[0];P.z=q[1];P.y=GY(P.x,P.z,V.y,true);inCar=false;")
rep("const gy=GY(cam.position.x,cam.position.z)+.45;","const gy=GY(cam.position.x,cam.position.z,cam.position.y)+.45;")
print('build_real v27 ok')
# ---- Versione 28: sole vero (posizione astronomica) e ciclo giorno/notte; pulsante per l'ora del giorno
rep("sun.target.position.set(px,py,pz);sun.position.set(px-35,py+55,pz+25);","sun.target.position.set(px,py,pz);REAL.sunPos(px,py,pz);")
rep('<button class="b" id="rbtn" title="Radio">📻</button>','<button class="b" id="tbtn" title="Ora del giorno">🌓</button><button class="b" id="rbtn" title="Radio">📻</button>')
rep("REAL.start();VITA.init();","REAL.start();{const tb=$('#tbtn');if(tb)tb.onclick=()=>toast('Luce: '+REAL.CIELO.next())}VITA.init();")
print('build_real v28 ok')
rep('CSOL,ADJ,WORLD,REAL,VITA,CHK,','CSOL,ADJ,WORLD,REAL,VITA,sc,CHK,')
# ---- Versione 28: fonti nuove (texture CC0, Copernicus), pulsante dei dati Copernicus nella mappa
rep('<button class="b s" id="mcred">Fonti</button>','<button class="b s" id="mcred">Fonti</button><button class="b s" id="msat">🛰 Copernicus</button>')
rep('Catalogo completo delle fonti: docs/RESOURCE_CATALOG.md nel repository del gioco.</p>',
    'Catalogo completo delle fonti: docs/RESOURCE_CATALOG.md nel repository del gioco.</p>'
    '<p>Texture fotografiche dei materiali (strade, marciapiedi, porfido, intonaci, mattoni, pietra, tegole, erba, roccia, terra, calcestruzzo, ciuffi d’erba, panorami dei riflessi): <a href="https://polyhaven.com/" target="_blank" rel="noopener noreferrer">Poly Haven</a> e <a href="https://ambientcg.com/" target="_blank" rel="noopener noreferrer">ambientCG</a>, licenza CC0 (pubblico dominio); elenco preciso con autori e impronte in tex/manifest.json.</p>'
    '<p>Copertura del suolo e immagine del terreno lontano: © ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium, licenza CC BY 4.0; tile servite da Terrascope (VITO). Si possono spegnere con il pulsante «🛰 Copernicus» della mappa.</p>'
    '<p>Posizione del Sole: calcolata dalla data, dall’ora e dal punto in cui ti trovi (formule astronomiche semplificate).</p>')
rep('<div id="cr">Mappa © OpenStreetMap contributors · OpenMapTiles · OpenFreeMap · Rilievo Mapterhorn (INGV TINITALY e fonti regionali) · Auto: «Alfa Romeo 159 Sedan And Wagon» di Nieve5677 (sketchfab.com), CC BY 4.0</div>',
    '<div id="cr">Mappa © OpenStreetMap contributors · OpenMapTiles · OpenFreeMap · Rilievo Mapterhorn (INGV TINITALY e fonti regionali) · © ESA WorldCover 2021, dati Copernicus Sentinel (CC BY 4.0) · Texture Poly Haven e ambientCG (CC0) · Auto: «Alfa Romeo 159 Sedan And Wagon» di Nieve5677 (sketchfab.com), CC BY 4.0</div>')
rep('\n'+REAL_CSS+'\n</style>','\n'+REAL_CSS+'\n#msat{position:absolute;left:calc(92px + var(--sl));bottom:calc(14px + var(--sb));height:40px}\n#mdati{position:absolute;left:calc(92px + var(--sl));bottom:calc(62px + var(--sb));height:40px}\n</style>')
print('build_real v28b ok')
# ---- Versione 29.3: pulsante «Dati zona» nella mappa (salva i dati del posto per riprodurre i difetti)
rep('<button class="b s" id="msat">🛰 Copernicus</button>','<button class="b s" id="msat">🛰 Copernicus</button><button class="b s" id="mdati" title="Salva i dati della zona in cui ti trovi">📦 Dati zona</button>')
print('build_real v29.3 ok')
