/* ===== ARMI (Versione 21): armeria, arma in mano, mira, sparo, rinculo, parti mobili, bossoli, lampo, suoni, impatti =====
   Modelli: costruttori procedurali (window.FAM2 / window.MAP2, kit WK2 e componenti WC) con nomi di fantasia.
   Suoni: Free Firearm Sound Library (CC0), file in armi/suoni/.
   L'arma non è figlia della mano: è messa nello spazio (davanti al petto o con il calcio sulla spalla, puntata dove guarda il
   mirino) e le braccia la raggiungono con una cinematica inversa a due ossa (spalla, gomito). Così rinculo e parti mobili si
   vedono sia in terza persona sia in prima persona. */
const ARMCAT=/*@ARMCAT@*/[];
const ARM={open:false,cur:null,aim:false,fire:false,cd:0,man:null,rel:null,rec:{t:0,r:0,vt:0,vr:0},bloom:0,camK:0,shots:0,repT:-99,copT:-99,last:null,stat:{shots:0,hits:{},tracer:0,built:0,err:0},
 CATS:[['pistola','Pistole'],['revolver','Revolver'],['mitra','Mitra'],['assalto','Fucili d\'assalto'],['battaglia','Fucili da battaglia'],['precisione','Precisione'],['fucile_caccia','Fucili a pompa'],['mitragliatrice_leggera','Mitragliatrici leggere'],['mitragliatrice_pesante','Mitragliatrici pesanti']],
 tab:'pistola',sel:null,view:null};
const armV=new T.Vector3(),armV2=new T.Vector3(),armV3=new T.Vector3(),armQ=new T.Quaternion(),armM=new T.Matrix4(),armE=new T.Euler();

/* ---------- suoni ---------- */
const ASND={buf:{},load:{},base:'armi/suoni/',b64:/*@ARMSND@*/{}};// suoni dentro la pagina (base64): funzionano anche senza rete e da file locale
function armCtx(){try{return pdAudio.ensure()}catch(e){return null}}
function sndLoad(n){if(ASND.buf[n]!==undefined||ASND.load[n])return;const c=armCtx();if(!c)return;const e=ASND.b64[n];if(!e&&typeof fetch!=='function')return;
 ASND.load[n]=(e?Promise.resolve().then(()=>{const t=atob(e),u=new Uint8Array(t.length);for(let i=0;i<t.length;i++)u[i]=t.charCodeAt(i);return u.buffer}):fetch(ASND.base+n+'.mp3').then(r=>{if(!r.ok)throw new Error(r.status);return r.arrayBuffer()})).then(b=>new Promise((ok,ko)=>c.decodeAudioData(b,ok,ko))).then(b=>{ASND.buf[n]=b}).catch(()=>{ASND.buf[n]=null})}
// eco della strada per gli spari (riverbero generato: riflessioni dei palazzi a 60–190 ms e coda di ~1,6 s); i suoni sono già
// compressi nei file, quindi niente compressore qui (quello del browser li abbasserebbe di quasi 10 dB)
function armBus(c){if(ASND.bus&&ASND.bus.c===c)return ASND.bus;const B={c};try{
 const cp=c.destination;
 const L=Math.floor(c.sampleRate*1.7),ir=c.createBuffer(2,L,c.sampleRate);for(let ch=0;ch<2;ch++){const d=ir.getChannelData(ch);
  for(let i=0;i<L;i++){const t=i/c.sampleRate;d[i]=(Math.random()*2-1)*Math.pow(1-t/1.7,2.2)*Math.exp(-t*2.4)*.55}
  for(const [t,a] of [[.062+ch*.009,.5],[.11-ch*.007,.38],[.19+ch*.011,.26],[.27,.15]]){const i0=Math.floor(t*c.sampleRate);for(let k=0;k<90;k++)d[i0+k]+=(Math.random()*2-1)*a*Math.exp(-k/22)}}
 const cv=c.createConvolver();cv.buffer=ir;const wet=c.createGain();wet.gain.value=.5;cv.connect(wet);wet.connect(cp);B.cp=cp;B.cv=cv;B.wet=wet}catch(e){B.cp=null}ASND.bus=B;return B}
function snd(n,o){o=o||{};const c=armCtx();if(!c)return;const b=ASND.buf[n];if(!b){sndLoad(n);return}
 try{const B=armBus(c),out=B.cp||c.destination,s=c.createBufferSource();s.buffer=b;s.playbackRate.value=o.rate||1;const g=c.createGain();g.gain.value=Math.min(1.4,o.vol===undefined?1:o.vol);
  let h=g;if(o.pan&&c.createStereoPanner){const p=c.createStereoPanner();p.pan.value=o.pan;g.connect(p);h=p}
  if(o.lp){const f=c.createBiquadFilter();f.type='lowpass';f.frequency.value=o.lp;s.connect(f);f.connect(g)}else s.connect(g);h.connect(out);
  if(o.eco&&B.cv){const e=c.createGain();e.gain.value=o.eco;h.connect(e);e.connect(B.cv)}
  const t0=c.currentTime+(o.dly||0);s.start(t0);
  // raffica: la coda del colpo precedente si spegne poco dopo il nuovo colpo (le code non si sommano in un rombo confuso)
  if(o.choke){const L=ASND.last;if(L&&t0-L.t<.4){try{L.g.gain.setTargetAtTime(0,t0+.012,.035)}catch(e){}}ASND.last={g,t:t0}}
  return g}catch(e){}}
// tintinnio del bossolo sull'asfalto (sintetico, breve)
function armTink(vol){const c=crCtx();if(!c||!(vol>.02))return;try{const t=c.currentTime;for(const f of [3600+Math.random()*1500,6100+Math.random()*1800]){const o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.value=f;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.06*vol,t+.004);g.gain.exponentialRampToValueAtTime(.0001,t+.09+Math.random()*.05);o.connect(g);g.connect(c.destination);o.start(t);o.stop(t+.16)}}catch(e){}}
// gruppo di suoni per arma: colpo (varianti), tono, meccanica di ricarica
function armSnd(sp){const c=sp.calibro||'',k=sp.categoria;const r=(n,v)=>({shot:n,rate:1,vol:v||1});let s;
 if(k==='pistola')s=c.includes('.45')?r(['p45_1','p45_2']):/9×17|7,65|9×18/.test(c)?r(['pk_1','pk_2']):r(['p9_1','p9_2','p9_3']);
 else if(k==='revolver')s=c.includes('.500')||c.includes('12,7')?r(['rv500_1','rv500_2']):c.includes('.357')?r(['rv357_1','rv357_2']):r(['rv38_1','rv38_2']);
 else if(k==='mitra')s=c.includes('7,62×25')?r(['mt_1','mt_2']):c.includes('7,65')||c.includes('9×17')?r(['pk_1','pk_2'],.9):c.includes('.45')?r(['p45_1','p45_2']):r(['m9_1','m9_2','m9_3']);
 else if(k==='fucile_caccia')s=r(['sg_1','sg_2','sg_3','sg_4']);
 else if(/12,7|10,4/.test(c))s=r(['f50_1','f50_2']);
 else if(c.includes('8,6'))s=r(['f338_1','f338_2']);
 else if(c.includes('7,62×54'))s=r(['f762l_1','f762l_2']);
 else if(c.includes('7,62×39'))s=r(['f762r_1','f762r_2','f762r_3']);
 else if(/7,62×51|6,8×51|7,62×63/.test(c))s=r(['f308_1','f308_2','f308_3']);
 else if(/7,5×5/.test(c))s=r(['f3006_1','f3006_2']);
 else if(c.includes('5,45'))s=r(['f545_1','f545_2']);
 else s=r(['f556_1','f556_2','f556_3']);
 const ak=c.includes('7,62×39');s.mOut=k==='pistola'?'car_fuori_p':ak?'car_fuori_ak':'car_fuori_f';s.mIn=k==='pistola'?'car_dentro_p':ak?'car_dentro_ak':'car_dentro_f';
 s.rack=k==='pistola'?'carr_rila':k==='mitra'?'mitra_arma':ak?'manetta_ak':'manetta_f';s.dry=k==='pistola'||k==='revolver'?'vuoto_p':'vuoto_f';return s}
function armSndPreload(a){const s=a.snd;for(const n of s.shot)sndLoad(n);for(const n of [s.mOut,s.mIn,s.rack,s.dry,'pompa','cartuccia_in','otturatore_ciclo','tamb_apri','tamb_chiudi','tamb_espelli','tamb_carica'])sndLoad(n)}

/* ---------- dati di tiro per arma ---------- */
const ARM_E={'9×19':500,'11,43':550,'9×17':270,'7,65':220,'9×18':300,'7,62×25':700,'5,7×28':400,'4,6×30':500,'.38':300,'.357':800,'.500':3500,'5,56':1750,'5,45':1400,'5,8':1800,'7,62×39':2000,'7,62×51':3300,'6,8':3800,'7,5×55':3300,'7,5×54':3100,'7,62×54':3600,'7,62×63':3800,'8,6':6500,'10,4':9000,'12,7×99':17000,'12,7×108':17500,'calibro 12':3500};
function armBallistic(sp){let E=1500;for(const k in ARM_E)if((sp.calibro||'').includes(k)){E=ARM_E[k];break}
 const w=Math.max(.35,sp.peso||(sp.categoria==='pistola'?.8:sp.categoria==='revolver'?1.1:sp.categoria.startsWith('mitragl')?10:4)),hand=sp.categoria==='pistola'||sp.categoria==='revolver',k=Math.sqrt(E)/Math.pow(w,.6);
 const cat=sp.categoria,spread={pistola:.007,revolver:.006,mitra:.011,assalto:.0045,battaglia:.004,precisione:.0011,fucile_caccia:.04,mitragliatrice_leggera:.008,mitragliatrice_pesante:.007}[cat]||.006;
 return {E,kr:hand?k*.0048:k*.0017,kt:hand?.012+k*.0003:.008+k*.00028,cam:hand?k*.0016:k*.0011,spread,pellets:cat==='fucile_caccia'?9:1,range:cat==='fucile_caccia'?60:cat==='pistola'||cat==='revolver'?160:cat==='mitra'?220:420,hand}}

/* ---------- modelli: costruzione e smaltimento ---------- */
/* ---------- modelli realistici di terzi (licenze verificate): caricati come file GLB, normalizzati (X avanti, Y su, Z destra, lunghezza reale),
   parti mobili dai nodi o da zone della maglia, punti di riferimento misurati (mm) ---------- */
const ARMGLB={
 2:{url:'armi/modelli/pistola_servizio.json',r:[0,-Math.PI/2,0],len:216,split:{carrello:{x:[10,151],y:[33.5,99]},caricatore:{y:[-99,-58.5]}},pivot:{carrello:[80,45,0],caricatore:[40,-60,0]},
  an:{bocca:[216,46,0],espulsione:[112,54,-6,[0,.6,-1]],impugnatura:[48,-15,0],grilletto:[97,3,0],appoggio:[50,-30,-18],mira_post:[48,62,0],mira_ant:[207,63,0]},
  info:{azione:'semi',bossolo:'pistola',ciclo:{carrello:{dx:-.03}},ricarica:{caricatore:{dx:-.012,dy:-.07}}},credit:'Modello di Mateusz Sadek (Poly Haven), CC0'},
 66:{url:'armi/modelli/fucile_ak.json',r:[0,-Math.PI/2,0],len:880,split:{otturatore:{x:[436,484],y:[74,106],z:[15.5,45]},caricatore:{x:[368,535],y:[-140,44]},grilletto:{x:[313,336],y:[14,44],z:[-6,6]}},pivot:{otturatore:[457,90,18],caricatore:[428,44,0],grilletto:[326,44,0]},
  an:{bocca:[880,77,0],espulsione:[420,90,16,[.1,.5,1]],impugnatura:[262,-10,0],grilletto:[322,30,0],appoggio:[590,52,-18],mira_post:[500,121,0],mira_ant:[832,122,0],calcio:[2,30,0]},
  info:{azione:'auto',bossolo:'fucile',ciclo:{otturatore:{dx:-.11},grilletto:{rz:-.12}},ricarica:{caricatore:{dy:-.06,rz:.4}}},credit:'Modello di LonesomeDucky (OpenGameArt.org), CC0'},
 74:{url:'armi/modelli/carabina_m.json',r:[0,-Math.PI/2,0],len:838,hide:['Foregrip','OpticMount','Suppressor','SpareMagazine'],nodes:{Corpo_02_Ejector_2:'otturatore',ChargingHandle:'manetta',Corpo_07_Trigger:'grilletto',Magazine:'caricatore'},pivot:{otturatore:[356,70,0],manetta:[212,85,0],grilletto:[297,12,0],caricatore:[443,-10,0]},
  an:{bocca:[838,64,0],espulsione:[356,70,14,[.1,.35,1]],impugnatura:[222,-42,0],grilletto:[294,-5,0],appoggio:[520,30,-15],mira_post:[247,118,0],mira_ant:[650,120,0],calcio:[12,22,0]},
  info:{azione:'auto',bossolo:'fucile',ciclo:{otturatore:{dx:-.075},grilletto:{rz:-.12}},ricarica:{caricatore:{dy:-.12},manetta:{dx:-.06}}},credit:'Modello di nisu (OpenGameArt.org) con parti di Quaternius, CC0'},
 60:{url:'armi/modelli/mitra_45.json',r:[0,0,0],len:690,hide:['ChamberedRoundGeometry'],nodes:{BoltGeometry:'otturatore',ChargingHandleGeometry:'manetta',TriggerGeometry:'grilletto',MagazineGeometry:'caricatore'},pivot:{otturatore:[440,90,0],manetta:[540,120,0],grilletto:[369,35,0],caricatore:[480,40,0]},
  an:{bocca:[690,88,0],espulsione:[440,92,20,[0,.3,1]],impugnatura:[303,-12,0],grilletto:[366,22,0],appoggio:[589,10,0],mira_post:[286,146,0],mira_ant:[634,150,0],calcio:[4,60,0]},
  info:{azione:'auto',bossolo:'pistola',ciclo:{otturatore:{dx:-.035},grilletto:{rz:-.12}},ricarica:{caricatore:{dy:-.13,dx:-.01},manetta:{dx:-.05}}},credit:'«fps animated smg» di DJMaesen, CC BY 4.0, modificato'},
 8:{url:'armi/modelli/pistola_45.json',r:[0,Math.PI/2,0],len:216,split:{carrello:{x:[22,217],y:[40.5,80]},canna:{x:[169,217],y:[25,40.5]},caricatore:{x:[32,60],y:[-70,-62.8],z:[-11.5,11.5]}},pivot:{carrello:[118,52,0],canna:[192,33,0],caricatore:[46,-64,0]},
  an:{bocca:[216,54,.5],espulsione:[103,56,11,[-.1,.6,1]],impugnatura:[42,-15,0],grilletto:[86,15,0],appoggio:[44,-30,-18],mira_post:[42,65,.5],mira_ant:[203,65,.5]},
  info:{azione:'semi',bossolo:'pistola',ciclo:{carrello:{dx:-.03},canna:{dx:-.03}},ricarica:{caricatore:{dx:-.022,dy:-.07}}},credit:'Modello di MaX3Dd, CC BY 4.0, modificato'},
 31:{url:'armi/modelli/revolver_sa.json',r:[0,0,0],len:285,split:{tamburo:{x:[102,141.1],y:[12.5,54.2],z:[-23.7,19.7]},cane:{x:[55.6,90.6],y:[39.9,64.4],z:[-5.6,1.7]},grilletto:{x:[86.9,100.3],y:[-24.2,.6],z:[-4.8,1]}},pivot:{tamburo:[119.7,33.6,-1.9],cane:[79.2,42.7,-1.9],grilletto:[94,1.4,-1.9]},
  an:{bocca:[285,47.5,-1.9],espulsione:[92.6,42.7,21.4,[-.2,-.6,1]],impugnatura:[40.2,-24.2,-1.9],grilletto:[94,-11.4,-1.9],appoggio:[42.2,-32.8,-23.1],mira_post:[85.5,59.3,-1.9],mira_ant:[272.5,61.8,-1.9]},
  info:{azione:'singola',bossolo:null,ciclo:{cane:{rz:.78},grilletto:{rz:-.1}},manuale:[{cane:{rz:.78}}],ricarica:{tamburo:{rx:Math.PI/3}},tamburo:{parte:'tamburo',colpi:6}},credit:'«Revolver» di re1monsen, CC BY 4.0, modificato'},
 125:{url:'armi/modelli/fucile_pompa_legno.json',r:[0,0,0],len:980,nodes:{recoile_02:'pompa'},split:{otturatore:{x:[428,506],y:[64,90],z:[11.5,15.5]}},pivot:{pompa:[683,53,0],otturatore:[466,77,12]},
  an:{bocca:[980,76.2,0],espulsione:[466,77,14,[.25,.45,1]],impugnatura:[293,20,0],grilletto:[372,25,0],appoggio:[683,38,-8],mira_post:[400,89.5,0],mira_ant:[963,95,0],calcio:[10,-24.5,0]},
  info:{azione:'pompa',bossolo:'cal12',manuale:[{pompa:{dx:-.068},otturatore:{dx:-.068}}],ricarica:{}},credit:'«Free animated Pump Shotgun» di Mostafa Ebrahim, CC BY 4.0, modificato'},
 124:{url:'armi/modelli/precisione_telaio.json',r:[0,0,0],len:1200,nodes:{Base3_low_Base_0:'telaio',Scope1_low_Zoom_0:'telaio',Butt7_low_Butt_0:'telaio',Handle_low_Handle_Spusk_0:'telaio',Cartridge4_low_Cartridge_0:'caricatore'},split:{leva:{x:[290,485],y:[0,66],z:[-32,56]}},pivot:{leva:[330,26.3,-10.1],caricatore:[430,-40,-10.3]},
  an:{bocca:[1200,25.8,-10.3],espulsione:[390,30,10,[.1,.5,1]],impugnatura:[262,-78,-10.3],grilletto:[328,-40,-10.3],appoggio:[680,-12,-20],ottica:[290,91.9,-10.3],mira_post:[290,91.9,-10.3],mira_ant:[669,94.4,-10.3],calcio:[6,-38,-10.3]},
  info:{azione:'otturatore',bossolo:'fucile',ciclo:{},manuale:[{leva:{rx:-1}},{leva:{rx:-1,dx:-.09}}],ricarica:{caricatore:{dy:-.08}},armamento:{leva:{rx:-1,dx:-.09}}},credit:'Modello di awakov_dawid, CC BY 4.0, modificato'},
 82:{url:'armi/modelli/fucile_modulare.json',r:[0,-Math.PI/2,0],len:889,nodes:{ChargingHandleGeometry:'manetta',MagazineGeometry:'caricatore'},pivot:{manetta:[520,59,2.6],caricatore:[450,0,2.6]},
  an:{bocca:[889,45.3,2.6],espulsione:[403,55,30,[.15,.4,1]],impugnatura:[315,-45,2.6],grilletto:[368,-22,2.6],appoggio:[570,15,-12],mira_post:[331,126,2.6],mira_ant:[697,126,2.6],calcio:[5,-5,2.6]},
  info:{azione:'auto',bossolo:'fucile',ciclo:{manetta:{dx:-.07}},ricarica:{caricatore:{dx:-.01,dy:-.12}},armamento:{manetta:{dx:-.07}}},credit:'Modello di Hitansh 3D, CC BY 4.0, modificato'},
 146:{url:'armi/modelli/mitragliatrice_m.json',r:[0,Math.PI,0],len:1105,split:{coperchio:{x:[255,441],y:[50.5,75],z:[12,63]},manetta:{x:[410,427],y:[-10,3],z:[55,98]},caricatore:{x:[318,442],y:[-112,31],z:[-98,-16]}},pivot:{coperchio:[440,52,37.2],manetta:[418,-4,76],caricatore:[380,-40,-57]},
  an:{bocca:[1105,26,37.2],espulsione:[400,25,60,[.1,-.3,1]],impugnatura:[295,-75,41],grilletto:[300,-48,41],appoggio:[600,-58,33],mira_post:[452,112,37.2],mira_ant:[970,112,37.2],calcio:[4,-9,42]},
  info:{azione:'auto',bossolo:'fucile',ciclo:{},ricarica:{coperchio:{rz:-1.15},caricatore:{dy:-.08,dz:-.05}},armamento:{manetta:{dx:-.1}}},credit:'Modello di Pieter Ferreira, CC BY 4.0, modificato'}};
const GLBC={};
function glbLoad(url){if(!GLBC[url])GLBC[url]=new Promise((ok,ko)=>{if(!T.GLTFLoader){ko('caricatore GLB assente');return}
 try{if(/\.json$/.test(url)){if(typeof fetch!=='function'){ko('rete assente');return}fetch(url).then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.json()}).then(j=>{const t=atob(j.glb),u=new Uint8Array(t.length);for(let i=0;i<t.length;i++)u[i]=t.charCodeAt(i);new T.GLTFLoader().parse(u.buffer,'',ok,e=>ko(e&&e.message||String(e)))}).catch(e=>ko(e&&e.message||String(e)))}
  else new T.GLTFLoader().load(url,ok,undefined,e=>ko(e&&e.message||String(e)))}catch(e){ko(String(e))}});return GLBC[url]}
function armBuildGLB(id,d,sp){const g=new T.Group();g.name='terzi'+id;const an={};let esp=null;for(const k in d.an){const a=d.an[k];an[k]=new T.Vector3(a[0]/1000,a[1]/1000,a[2]/1000);if(k==='espulsione'&&a[3])esp=a[3]}
 const m={id,sp,r:{g,tris:0,anchors:{}},g,info:d.info,an,parts:{},snd:armSnd(sp),bal:armBallistic(sp),dirs:{esp},glb:d,ready:false};
 glbLoad(d.url).then(gl=>{if(!m.dead)armGLBFill(m,gl,d)}).catch(e=>{m.err=String(e);console.error('modello',id,e);const b=armBuilder(id);if(b&&!m.dead){try{const r=b[0](sp,b[1]);m.r=r;for(const c of r.g.children.slice())g.add(c);m.parts=r.parts||{};m.info=r.info||{};for(const k in (r.anchors||{}))m.an[k]=r.anchors[k].position.clone();m.ready=true}catch(_){}}});
 return m}
function armGLBFill(m,gl,d){const sc0=gl.scene;sc0.updateMatrixWorld(true);const hid=n=>{let q=n;while(q){if(d.hide&&d.hide.includes(q.name))return true;q=q.parent}return false};
 const partOf=n=>{let q=n;while(q){if(d.nodes&&d.nodes[q.name])return d.nodes[q.name];q=q.parent}if(d.mats&&n.material&&d.mats[n.material.name])return d.mats[n.material.name];return 'corpo'};
 const Rm=new T.Matrix4().makeRotationFromEuler(new T.Euler(d.r[0],d.r[1],d.r[2])),bb=new T.Box3(),tb=new T.Box3(),ms=[];
 sc0.traverse(n=>{if(!n.isMesh||hid(n))return;if(!n.geometry.boundingBox)n.geometry.computeBoundingBox();tb.copy(n.geometry.boundingBox).applyMatrix4(new T.Matrix4().multiplyMatrices(Rm,n.matrixWorld));bb.union(tb);ms.push(n)});
 const k=d.len/1000/(bb.max.x-bb.min.x),N=new T.Matrix4().makeTranslation(-bb.min.x*k,-(bb.min.y+bb.max.y)/2*k,-(bb.min.z+bb.max.z)/2*k).multiply(new T.Matrix4().makeScale(k,k,k)).multiply(Rm);
 const geo={};const add=(p,gm,mt)=>{(geo[p]||(geo[p]=[])).push([gm,mt])};let tris=0;
 for(const n of ms){const mt=n.material;if(mt){mt.userData.cached=true;if(mt.map)mt.map.anisotropy=4}let gm=n.geometry.clone();gm.applyMatrix4(new T.Matrix4().multiplyMatrices(N,n.matrixWorld));tris+=(gm.index?gm.index.count:gm.attributes.position.count)/3;
  const p=partOf(n);if(p==='corpo'&&d.split){const gs=armSplit(gm,d.split);for(const q in gs)add(q,gs[q],mt)}else add(p,gm,mt)}
 for(const p in geo){const pv=d.pivot&&d.pivot[p]?d.pivot[p].map(v=>v/1000):[0,0,0],G=new T.Group();G.name=p;G.position.set(pv[0],pv[1],pv[2]);
  for(const [gm,mt] of geo[p]){gm.translate(-pv[0],-pv[1],-pv[2]);gm.computeBoundingSphere();const me=new T.Mesh(gm,mt);me.castShadow=true;me.frustumCulled=false;G.add(me)}
  G.userData.rest={p:G.position.clone(),r:G.rotation.clone()};m.g.add(G);m.parts[p]=G}
 m.r.tris=Math.round(tris);m.ready=true}
// divide una maglia per zone (mm): ogni triangolo va alla prima zona che contiene il suo baricentro, il resto resta "corpo"
function armSplit(gm,zones){const src=gm.index?gm.toNonIndexed():gm,P=src.attributes.position.array,n=P.length/9,keys=Object.keys(zones),sel=new Int8Array(n).fill(-1);
 for(let t=0;t<n;t++){const i=t*9,cx=(P[i]+P[i+3]+P[i+6])/3*1000,cy=(P[i+1]+P[i+4]+P[i+7])/3*1000,cz=(P[i+2]+P[i+5]+P[i+8])/3*1000;
  for(let k=0;k<keys.length;k++){const z=zones[keys[k]];if(z.x&&(cx<z.x[0]||cx>z.x[1]))continue;if(z.y&&(cy<z.y[0]||cy>z.y[1]))continue;if(z.z&&(cz<z.z[0]||cz>z.z[1]))continue;sel[t]=k;break}}
 const out={};const names=['corpo'].concat(keys);
 for(let k=-1;k<keys.length;k++){let c=0;for(let t=0;t<n;t++)if(sel[t]===k)c++;if(!c)continue;const g=new T.BufferGeometry();
  for(const an of Object.keys(src.attributes)){const A=src.attributes[an],sz=A.itemSize,arr=new A.array.constructor(c*3*sz);let o=0;for(let t=0;t<n;t++){if(sel[t]!==k)continue;arr.set(A.array.subarray(t*3*sz,(t+1)*3*sz),o);o+=3*sz}g.setAttribute(an,new T.BufferAttribute(arr,sz,A.normalized))}
  out[names[k+1]]=g}
 return out}
function armBuilder(id){const M=window.MAP2||{},F=window.FAM2||{},e=M[id];if(e&&typeof F[e.f]==='function')return [F[e.f],e.o||{}];return null}
function armBuild(id){const sp=ARMCAT[id];if(!sp)return null;if(ARMGLB[id]&&T.GLTFLoader&&!ARM.noGLB){ARM.stat.built++;return armBuildGLB(id,ARMGLB[id],sp)}const b=armBuilder(id);if(!b)return null;let r=null;
 try{r=b[0](sp,b[1])}catch(e){ARM.stat.err++;console.error('arma',id,e);return null}
 if(!r||!r.g)return null;ARM.stat.built++;
 const info=r.info||{},an={};for(const k in (r.anchors||{}))an[k]=r.anchors[k].position.clone();
 r.g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=false;o.frustumCulled=false}});
 return {id,sp,r,g:r.g,info,an,parts:r.parts||{},snd:armSnd(sp),bal:armBallistic(sp),dirs:{esp:(r.anchors&&r.anchors.espulsione&&r.anchors.espulsione.userData&&r.anchors.espulsione.userData.dir)||null}}}
function armDispose(m){if(!m)return;m.dead=true;if(AFX.flash&&AFX.flash.parent===m.g){m.g.remove(AFX.flash);AFX.flash.visible=false}if(m.g.parent)m.g.parent.remove(m.g);m.g.traverse(o=>{if(!o.isMesh)return;o.geometry.dispose();const ms=Array.isArray(o.material)?o.material:[o.material];for(const mt of ms){if(!mt||mt.userData.cached)continue;for(const k of ['map','normalMap','roughnessMap','metalnessMap'])if(mt[k]&&!(mt[k].userData&&mt[k].userData.shared))mt[k].dispose();mt.dispose()}})}

/* ---------- effetti: lampo, luce, fumo, bossoli, fori ---------- */
const AFX={light:null,flashT:0,flash:null,shells:[],decals:[],di:0,tex:{}};
function armTex(k){if(AFX.tex[k])return AFX.tex[k];const cv=document.createElement('canvas');cv.width=cv.height=128;const x=cv.getContext('2d');
 try{if(k==='stella'){const g=x.createRadialGradient(64,64,0,64,64,60);g.addColorStop(0,'rgba(255,255,240,1)');g.addColorStop(.18,'rgba(255,230,150,.95)');g.addColorStop(.45,'rgba(255,150,40,.45)');g.addColorStop(1,'rgba(255,90,0,0)');x.fillStyle=g;x.fillRect(0,0,128,128);
   x.globalCompositeOperation='lighter';for(let i=0;i<7;i++){const a=i/7*6.283+Math.random()*.4;x.save();x.translate(64,64);x.rotate(a);const g2=x.createLinearGradient(0,0,58,0);g2.addColorStop(0,'rgba(255,240,200,.9)');g2.addColorStop(1,'rgba(255,120,20,0)');x.fillStyle=g2;x.beginPath();x.moveTo(0,-5);x.lineTo(56+Math.random()*6,0);x.lineTo(0,5);x.fill();x.restore()}}
  else if(k==='fiamma'){const g=x.createLinearGradient(0,64,128,64);g.addColorStop(0,'rgba(255,250,220,1)');g.addColorStop(.25,'rgba(255,210,110,.9)');g.addColorStop(.7,'rgba(255,120,30,.35)');g.addColorStop(1,'rgba(255,80,0,0)');x.fillStyle=g;x.beginPath();x.moveTo(0,52);x.quadraticCurveTo(70,40,128,64);x.quadraticCurveTo(70,88,0,76);x.fill()}
  else if(k==='foro'){const g=x.createRadialGradient(64,64,0,64,64,62);g.addColorStop(0,'rgba(8,8,8,1)');g.addColorStop(.16,'rgba(15,14,12,.95)');g.addColorStop(.3,'rgba(40,36,30,.6)');g.addColorStop(1,'rgba(60,55,50,0)');x.fillStyle=g;x.fillRect(0,0,128,128);x.strokeStyle='rgba(20,18,15,.55)';x.lineWidth=1.5;for(let i=0;i<6;i++){const a=Math.random()*6.283;x.beginPath();x.moveTo(64+Math.cos(a)*10,64+Math.sin(a)*10);x.lineTo(64+Math.cos(a)*(28+Math.random()*24),64+Math.sin(a)*(28+Math.random()*24));x.stroke()}}}catch(e){}
 const t=new T.CanvasTexture(cv);return AFX.tex[k]=t}
function armFxInit(){if(AFX.flash)return;
 const g=new T.Group(),sm=new T.SpriteMaterial({map:armTex('stella'),transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}),sp=new T.Sprite(sm);g.add(sp);
 const pm=new T.MeshBasicMaterial({map:armTex('fiamma'),transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,toneMapped:false});
 for(const r of [0,Math.PI/2]){const p=new T.Mesh(new T.PlaneGeometry(1,1),pm);p.geometry.translate(.5,0,0);p.rotation.x=r;g.add(p)}
 g.visible=false;g.renderOrder=6;AFX.flash=g;AFX.flashSp=sp}
// fori di proiettile: piccoli quadrati scuri sul muro o sull'asfalto, che svaniscono
function armLight(){let L=AFX.light;if(L&&L.userData.owner===AFX&&!L.userData.free){L.userData.seen=PD.t;return L}AFX.light=null;if(typeof crLightGet!=='function')return null;L=crLightGet(AFX);if(!L)return null;
 L.userData.a0={c:L.color.clone(),d:L.distance,k:L.decay};L.color.set(lc(0xffb060));L.distance=7;L.decay=2;AFX.light=L;return L}
function armLightFree(){const L=AFX.light;AFX.light=null;if(!L||L.userData.owner!==AFX)return;const a=L.userData.a0;if(a){L.color.copy(a.c);L.distance=a.d;L.decay=a.k}if(typeof crLightFree==='function')crLightFree(L)}
function armDecal(x,y,z,nx,ny,nz){const D=AFX.decals;let d=D[AFX.di%40];AFX.di++;
 if(!d){const m=new T.Mesh(new T.PlaneGeometry(1,1),new T.MeshBasicMaterial({map:armTex('foro'),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3}));m.renderOrder=1;sc.add(m);d={m,t:0};D.push(d)}
 const s=.07+Math.random()*.04;d.m.scale.set(s,s,s);d.m.position.set(x+nx*.004,y+ny*.004,z+nz*.004);armV.set(x+nx,y+ny,z+nz);d.m.lookAt(armV);d.m.rotateZ(Math.random()*6.283);d.t=0;d.m.material.opacity=1;d.m.visible=true}
// bossoli: pochi oggetti riusati con una fisica semplice (gravità, rimbalzo sull'asfalto, rotazione)
function armShell(kind,p,v){if(!kind||!window.WC)return;const S=AFX.shells;let s=S.find(q=>!q.on&&q.kind===kind);
 if(!s){if(S.length>=36){s=S.reduce((a,b)=>a.t>b.t?a:b);if(s.kind!==kind){sc.remove(s.g);S.splice(S.indexOf(s),1);s=null}}
  if(!s){const g=new T.Group();for(const [geo,mt] of WC.shell(kind)){const m=new T.Mesh(geo,mt);m.castShadow=false;g.add(m)}sc.add(g);s={g,kind};S.push(s)}}
 s.on=true;s.t=0;s.b=0;s.g.visible=true;s.g.position.copy(p);s.v=v.clone();s.w=new T.Vector3((Math.random()-.5)*30,(Math.random()-.5)*30,(Math.random()-.5)*30);s.g.rotation.set(Math.random()*6,Math.random()*6,Math.random()*6)}
function armFxStep(dt){
 if(AFX.flashT>0){AFX.flashT-=dt;if(AFX.flashT<=0){AFX.flash.visible=false;armLightFree()}}
 for(const s of AFX.shells){if(!s.on)continue;s.t+=dt;const g=s.g;s.v.y-=9.8*dt;g.position.addScaledVector(s.v,dt);g.rotation.x+=s.w.x*dt;g.rotation.y+=s.w.y*dt;g.rotation.z+=s.w.z*dt;
  const gy=GY(g.position.x,g.position.z)+.006;if(g.position.y<gy){g.position.y=gy;if(s.v.y<-.6){s.b++;if(s.b<=2)armTink(crVol(g.position.x,g.position.z)*(s.b===1?1:.5))}s.v.y*=-.32;s.v.x*=.55;s.v.z*=.55;s.w.multiplyScalar(.6)}
  if(s.t>3.2){s.on=false;g.visible=false}}
 for(const d of AFX.decals){if(!d.m.visible)continue;d.t+=dt;if(d.t>22){const k=Math.max(0,1-(d.t-22)/4);d.m.material.opacity=k;if(k<=0)d.m.visible=false}}}

/* ---------- prova di collisione del colpo con il mondo ---------- */
const ARMSOL=new Set();
function armSlab2(ox,oz,dx,dz,x0,x1,z0,z1,best){let t0=0,t1=best,ax=-1;for(let q=0;q<2;q++){const o=q?oz:ox,d=q?dz:dx,a=q?z0:x0,b=q?z1:x1;if(Math.abs(d)<1e-9){if(o<a||o>b)return null}else{let u=(a-o)/d,w=(b-o)/d,s=-1;if(u>w){const e=u;u=w;w=e;s=1}if(u>t0){t0=u;ax=q*2+(s>0?1:0)}t1=Math.min(t1,w)}}return t1>=t0&&t0>0&&t0<best?{t:t0,ax}:null}
function armOBB(o,d,c,ax,ay,az,hx,hy,hz,best){// raggio contro scatola orientata: ax,az assi orizzontali (unitari), ay = (0,1,0)
 const px=o.x-c.x,py=o.y-c.y,pz=o.z-c.z;let t0=0,t1=best,n=null;
 for(const [A,h] of [[ax,hx],[ay,hy],[az,hz]]){const e=A.x*px+A.y*py+A.z*pz,f=A.x*d.x+A.y*d.y+A.z*d.z;if(Math.abs(f)<1e-9){if(e<-h||e>h)return null;continue}let u=(-h-e)/f,w=(h-e)/f,sg=-1;if(u>w){const q=u;u=w;w=q;sg=1}if(u>t0){t0=u;n=[A.x*sg,A.y*sg,A.z*sg]}t1=Math.min(t1,w);if(t0>t1)return null}
 return t0>0&&t0<best?{t:t0,n}:null}
function armRay(o,d,max){let best=max,hit=null;const hd=Math.hypot(d.x,d.z);
 // solidi (sagome a terra): edifici alti, oggetti bassi, auto del traffico e pattuglie come scatole
 if(hd>1e-4){const ux=d.x/hd,uz=d.z/hd,max2=Math.min(max,260)*hd,keys=new Set();
  for(let s=0;s<=max2;s+=60){const x=o.x+ux*s,z=o.z+uz*s,cx=Math.floor((x+WORLD.WS)/WORLD.CSZ),cz=Math.floor((z+WORLD.WS)/WORLD.CSZ);for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)keys.add((cx+i)+','+(cz+j))}
  const test=s=>{if(s.on===0||s.blk!==undefined||ARMSOL.has(s))return;let r;
   if(s.c===undefined)r=armSlab2(o.x,o.z,ux,uz,s.x0,s.x1,s.z0,s.z1,best*hd);
   else{const ox=o.x-s.x,oz=o.z-s.z;r=armSlab2(ox*s.c+oz*s.s,-ox*s.s+oz*s.c,ux*s.c+uz*s.s,-ux*s.s+uz*s.c,-s.hx,s.hx,-s.hz,s.hz,best*hd);if(r)r.rot=s}
   if(!r)return;const t=r.t/hd,y=o.y+d.y*t,wx=s.c===undefined?s.x1-s.x0:2*s.hx,wz=s.c===undefined?s.z1-s.z0:2*s.hz,top=(Math.max(wx,wz)>2.5||wx*wz>6)?28:1.15,gy=GY(o.x+d.x*t,o.z+d.z*t);
   if(y<gy-.05||y>gy+top)return;let nx=[-1,1,0,0][r.ax]||0,nz=[0,0,-1,1][r.ax]||0;if(r.rot){const q=r.rot,lx=nx,lz=nz;nx=lx*q.c-lz*q.s;nz=lx*q.s+lz*q.c}
   best=t;hit={kind:top<2?'oggetto':'muro',t,n:[nx,0,nz]}};
  for(const s of solids)test(s);for(const k of keys){const a=CSO.get(k);if(a)for(const s of a)test(s)}}
 // veicoli: pattuglie, auto del giocatore (a piedi), traffico
 const AX=armV.set(0,0,0),AY=new T.Vector3(0,1,0);
 const veh=(cx,cy,cz,h,hx,hy,hz,kind,ref)=>{if(Math.hypot(cx-o.x,cz-o.z)>best+6)return;const ax=new T.Vector3(Math.cos(h),0,-Math.sin(h)),az=new T.Vector3(Math.sin(h),0,Math.cos(h));const r=armOBB(o,d,{x:cx,y:cy,z:cz},ax,AY,az,hx,hy,hz,best);if(r){best=r.t;hit={kind,t:r.t,n:r.n,ref}}};
 for(const u of PD.units){if(u.status==='gone')continue;veh(u.x,(u.y||GY(u.x,u.z))+.72,u.z,u.h,.93,.72,2.32,'pattuglia',u)}
 if(!inCar)veh(C.x,V.y+.72,C.z,C.h,.93,.72,2.32,'auto',null);
 for(const c of CARS)veh(c.x,GY(c.x,c.z)+.7,c.z,c.h,.9,.7,2.2,'traffico',c);
 // terreno: passi lungo il raggio, poi bisezione
 {let tp=0;const step=1.2;for(let t=step;t<best+step;t+=step){const tt=Math.min(t,best),x=o.x+d.x*tt,y=o.y+d.y*tt,z=o.z+d.z*tt;if(y<GY(x,z)){let a=tp,b=tt;for(let i=0;i<10;i++){const m=(a+b)/2;if(o.y+d.y*m<GY(o.x+d.x*m,o.z+d.z*m))b=m;else a=m}best=b;hit={kind:'terreno',t:b,n:[0,1,0]};break}tp=tt;if(tt>=best)break}}
 if(!hit)return null;hit.x=o.x+d.x*hit.t;hit.y=o.y+d.y*hit.t;hit.z=o.z+d.z*hit.t;return hit}

/* ---------- effetto del colpo dove arriva ---------- */
function armImpact(h,dir,bal){ARM.stat.hits[h.kind]=(ARM.stat.hits[h.kind]||0)+1;const vol=crVol(h.x,h.z);
 const n=h.n||[0,1,0],dust=h.kind==='terreno'?[.45,.4,.33]:[.66,.64,.6];
 if(h.kind==='muro'||h.kind==='terreno'||h.kind==='oggetto'){FX.sparks(h.x,h.y,h.z,n[0]*2.2,n[2]*2.2,bal.E>3000?7:3,2.2);fpSpawn('sm',h.x+n[0]*.05,h.y+n[1]*.05,h.z+n[2]*.05,{life:.9+Math.random()*.5,vy:.5,vx:n[0]*.6,vz:n[2]*.6,s:.12,s1:bal.E>3000?.9:.5,op:.5,c0:dust,c1:dust});armDecal(h.x,h.y,h.z,n[0],n[1],n[2]);if(Math.random()<.3)armTink(vol*.5);return}
 // veicoli: scintille sulla lamiera, vetri, gomme
 FX.sparks(h.x,h.y,h.z,n[0]*2.5,n[2]*2.5,6,2.6);armTink(vol);
 if(h.kind==='traffico'){const c=h.ref;if(c){c.v=Math.max(0,c.v*.3);c.idle=Math.max(c.idle||0,0)}return}
 const u=h.kind==='pattuglia'?h.ref:null,a=u?u.mdl:carA;if(!a)return;
 const car=u?{x:u.x,z:u.z,h:u.h,y:u.y,vx:u.vx,vz:u.vz,u}:{x:C.x,z:C.z,h:C.h,y:V.y,vx:V.vx,vz:V.vz,player:true};
 const ch=Math.cos(car.h),sh=Math.sin(car.h),wx=h.x-car.x,wz=h.z-car.z,lx=wx*ch-wz*sh,lz=wx*sh+wz*ch,ly=h.y-(car.y||GY(car.x,car.z));
 try{if(ly>.92){const st=a.armGl||(a.armGl={});if(lz>.2&&Math.abs(lx)<.72){st.ws=(st.ws||0)+1;if(st.ws===1)crGlassCrack(a,car,lx,'colpo');else if(st.ws>=3)crGlassBreak(a,car,'ws')}else if(lz<-1.1)crGlassBreak(a,car,'rw');else if(lx>.55)crGlassBreak(a,car,'sl');else if(lx<-.55)crGlassBreak(a,car,'sr')}
  else if(ly<.62){let bk=-1,bd=.5;for(let k=0;k<4;k++){const d2=Math.hypot(lx-WHL[k][0],lz-WHL[k][1]);if(d2<bd){bd=d2;bk=k}}if(bk>=0){if(u)crBurst(a,car,bk,'colpo');else{TYRE.puncture(carA,bk,1);crBang(crVol(car.x,car.z)*.9,700,.4);toast('Hai bucato una gomma della tua auto')}}}}catch(e){}
 if(u&&PD.t>(ARM.copT||-99)){ARM.copT=PD.t+5;try{pdOffence('spari contro la polizia',4,u,'colpi sulla '+u.name)}catch(e){}}}

/* ---------- reazioni: polizia e passanti ---------- */
function armReact(x,z){
 for(const p of PEDS){const d=Math.hypot(p.x-x,p.z-z);if(d>48)continue;if(!p.pan){p.v0=p.v;p.v=3.6+Math.random()*1.4;const s=RSL[p.s];if(s){const L=s.len||1,tx=(s.bx-s.ax)/L*p.d,tz=(s.bz-s.az)/L*p.d;if(tx*(p.x-x)+tz*(p.z-z)<0)p.d=-p.d}}p.pan=7+Math.random()*4}
 if(!PD.cfg||!PD.cfg.enabled||PD.t<ARM.repT)return;ARM.repT=PD.t+6;
 try{PD.T=pdTarget();const w=pdWitness();if(w&&Math.hypot(w.x-x,w.z-z)<160){pdOffence('spari in pubblico',3,w,'colpi d\'arma da fuoco vicino alla pattuglia');return}
  const n=pdCivil(PD.T);if(n>=1)pdReport('spari in pubblico',2,'colpi d\'arma da fuoco in strada',n)}catch(e){}}
function armPedStep(dt){for(const p of PEDS){if(!p.pan)continue;p.pan-=dt;if(p.pan<=0){p.pan=0;if(p.v0)p.v=p.v0}}}

/* ---------- impugnare, posare, mirare ---------- */
// arma portata a mano: treppiede tolto, bipiede ripiegato (posa "piega" data dal modello)
function armCarry(m){const P0=m.parts||{},inf=m.info||{};if(P0.treppiede)P0.treppiede.visible=false;
 // bipiede: "piega" (mitragliatrici) o "bipiede" con rotazione positiva = chiusura di un bipiede aperto a riposo (precisione)
 const bp=inf.bipiede&&inf.bipiede.bipiede,pg=inf.piega||(bp&&((bp.rz||0)>0||(bp.rx||0)>0)?inf.bipiede:null);if(!pg)return;
 for(const p in pg){const G=P0[p],o=pg[p];if(!G||!G.userData.rest)continue;const r=G.userData.rest;G.userData.rest={p:r.p.clone().add(new T.Vector3(o.dx||0,o.dy||0,o.dz||0)),r:new T.Euler(r.r.x+(o.rx||0),r.r.y+(o.ry||0),r.r.z+(o.rz||0))};G.position.copy(G.userData.rest.p);G.rotation.copy(G.userData.rest.r)}}
function armEquip(id,quiet){const m=armBuild(id);if(!m){if(!quiet)toast('Modello non disponibile');return false}
 armUnequip(true);armFxInit();armCarry(m);ARM.cur=m;m.mag=m.sp.colpi||10;m.cyc={};m.rot=0;sc.add(m.g);armSndPreload(m);S.arma=id;save();
 if(!quiet)toast('In mano: '+m.sp.produttore+' '+m.sp.nome);armHud();return true}
function armUnequip(quiet){const m=ARM.cur;if(!m)return;{const oe=$('#ottica');if(oe&&!oe.hidden){oe.hidden=true;const mi=$('#mirino');if(mi)mi.style.visibility=''}}armDispose(m);if(AFP.g)AFP.g.visible=false;ARM.cur=null;ARM.man=null;ARM.rel=null;ARM.aim=false;ARM.fire=false;delete S.arma;save();
 const J=P.m.userData;for(const i of [0,1]){J.sh[i].rotation.set(0,0,0);J.el[i].rotation.set(0,0,0)}J.hd.rotation.set(0,0,0);if(!quiet)toast('Arma riposta');armHud()}
// posa: dove sta l'arma (riferimento e orientamento) rispetto al personaggio
function armPose(m){const a=m.an,sp=m.sp;if(sp.categoria==='pistola'||sp.categoria==='revolver')return 'pistola';if(sp.categoria==='mitragliatrice_pesante'&&((sp.peso||0)>22||!a.calcio))return 'anca';return a.calcio?'spalla':'anca'}
// punto della mano d'appoggio nel mondo: sull'astina (parte "pompa") se c'è, così la mano la segue
function armSupport(m){const A=m.an.appoggio||m.an.impugnatura||new T.Vector3(),pp=m.parts&&m.parts.pompa;if(pp&&pp.userData.rest){return pp.localToWorld(A.clone().sub(pp.userData.rest.p))}return m.g.localToWorld(A.clone())}
// cinematica inversa a due ossa: spalla (gruppo J.sh) e gomito (J.el, piega attorno a x); bersaglio e polo nel sistema del personaggio
const ARMIK={a:.31,b:.30};
function armIK(J,i,tg,pole){const sh=J.sh[i],el=J.el[i],S0=sh.position,d=armV2.subVectors(tg,S0);let L=d.length();const a=ARMIK.a,b=ARMIK.b;if(L<1e-4)return;
 const dn=d.clone().divideScalar(L);L=Math.min(L,a+b-.002);L=Math.max(L,Math.abs(a-b)+.01);
 const al=Math.acos(cl((a*a+L*L-b*b)/(2*a*L),-1,1));let pl=pole.clone().addScaledVector(dn,-pole.dot(dn));if(pl.lengthSq()<1e-6)pl.set(0,-1,0);pl.normalize();
 const u=dn.clone().multiplyScalar(Math.cos(al)).addScaledVector(pl,Math.sin(al)),E=S0.clone().addScaledVector(u,a),f=tg.clone().sub(E).normalize();
 let w=f.clone().addScaledVector(u,-f.dot(u));if(w.lengthSq()<1e-8)w=pl.clone();w.normalize();const h=new T.Vector3().crossVectors(w,u);
 armM.makeBasis(h,u.clone().negate(),w);sh.quaternion.setFromRotationMatrix(armM);el.rotation.set(-Math.acos(cl(f.dot(u),-1,1)),0,0)}
const ARMPOLE=[new T.Vector3(-.55,-1,-.25),new T.Vector3(.55,-1,-.15)];
// punto mirato: dal centro della telecamera, a 40 m (per l'orientamento dell'arma); il colpo vero usa armRay
function armAimPoint(out){const cp=Math.cos(pitch);out.set(Math.sin(yaw)*cp,Math.sin(pitch),Math.cos(yaw)*cp);return cam.position.clone().addScaledVector(out,40)}
// orientamento dell'arma: X avanti verso il bersaglio, Y su
function armOrient(F,q){const up=Math.abs(F.y)>.98?new T.Vector3(1,0,0):new T.Vector3(0,1,0),Rr=new T.Vector3().crossVectors(F,up).normalize(),U=new T.Vector3().crossVectors(Rr,F);armM.makeBasis(F,U,Rr);q.setFromRotationMatrix(armM);return q}
function armPlace(dt){const m=ARM.cur,g=m.g,J=P.m.userData,fpv=fp&&!inCar,rec=ARM.rec,pose=armPose(m),a=m.an;
 const dir=new T.Vector3(),aimP=armAimPoint(dir),q=new T.Quaternion();
 // corpo: rivolto dove si mira (di tre quarti con le armi lunghe), testa dritta sul bersaglio
 const bl=pose==='spalla'?-.55:pose==='anca'?-.35:0;P.m.rotation.y=yaw+bl;J.hd.rotation.set(-pitch*.6,-bl,0);P.m.updateMatrixWorld(true);
 const low=!ARM.aim&&!ARM.fire&&ARM.cd<=0&&!ARM.man&&(ARM.lowT=(ARM.lowT||0)+dt)>1.2;if(!low)ARM.lowT=ARM.aim||ARM.fire?0:ARM.lowT;
 let ref,refL;
 if(fpv){// prima persona: arma davanti alla telecamera (al fianco, o con le mire sull'occhio quando si mira)
  const cq=cam.quaternion,R0=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),Math.PI/2);q.copy(cq).multiply(R0);
  const ads=ARM.aim&&(a.ottica||a.mira_post),eye=a.ottica||a.mira_post;refL=ads?eye:(a.impugnatura||new T.Vector3());
  ref=new T.Vector3().copy(ads?new T.Vector3(0,0,-(a.ottica?((m.info&&m.info.occhio)||.09):.16)):new T.Vector3(.15,-.17,-.32)).applyQuaternion(cq).add(cam.position);
 }else{
  // punto di appoggio sul corpo (sistema del personaggio): spalla destra, petto o anca
  const loc=pose==='pistola'?new T.Vector3(-.12,1.40,.56):pose==='spalla'?new T.Vector3(-.17,1.41,.1):new T.Vector3(-.16,1.02,.24),pW=P.m.localToWorld(loc.clone());
  const F=aimP.clone().sub(pW).normalize();if(low)F.y-=.55;F.normalize();armOrient(F,q);
  refL=pose==='spalla'?a.calcio:(a.impugnatura||new T.Vector3());ref=pW;
  if(pose==='pistola'){// la pistola si alza e si abbassa con la mira restando a un braccio di distanza
   const sw=new T.Vector3(-.09,1.40,0);P.m.localToWorld(sw);ref=sw.addScaledVector(F,.56).addScaledVector(new T.Vector3(-Math.cos(yaw),0,Math.sin(yaw)),.03)}}
 // rinculo: indietro lungo l'arma e bocca in alto attorno al punto di riferimento
 // il punto di riferimento dell'arma (impugnatura o calcio) va su ref; il rinculo ruota l'arma attorno a quel punto e la sposta indietro:
 // posizione = ref + q·(−rq·piv + off), orientamento = q·rq
 const off=new T.Vector3(-rec.t,0,0),rq=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),rec.r),piv=refL?refL.clone():new T.Vector3();
 g.quaternion.copy(q).multiply(rq);g.position.copy(ref).add(piv.clone().negate().applyQuaternion(rq).add(off).applyQuaternion(q));
 const scp=armScoped();g.visible=!inCar&&!ARM.open&&!scp;g.updateMatrixWorld(true);armFPArms(m,fpv&&g.visible);const oe=$('#ottica');if(oe&&oe.hidden===scp){oe.hidden=!scp;const mi=$('#mirino');if(mi)mi.style.visibility=scp?'hidden':''}
 // braccia sui punti dell'arma (terza persona)
 if(!fpv&&P.m.visible!==false){const inv=new T.Matrix4().copy(P.m.matrixWorld).invert(),tgR=g.localToWorld((a.impugnatura||new T.Vector3()).clone()).applyMatrix4(inv),tgL=armSupport(m).applyMatrix4(inv);
  if(pose==='pistola'){tgL.x+=.02}armIK(J,0,tgR,ARMPOLE[0]);armIK(J,1,tgL,ARMPOLE[1])}}

// braccia in prima persona: avambracci e mani verso l'impugnatura e l'appoggio dell'arma, gomiti sotto lo schermo
const AFP={g:null,seg:[]};
function armFPArms(m,on){if(!AFP.g){const g=new T.Group(),ms=new T.MeshStandardMaterial({color:lc(0x2f6fbd),roughness:.85}),mk=new T.MeshStandardMaterial({color:lc(0xf0c8a0),roughness:.7}),cyl=new T.CylinderGeometry(1,1,1,12,1);cyl.translate(0,.5,0);
  for(let i=0;i<2;i++){const up=new T.Mesh(cyl,ms),fo=new T.Mesh(cyl,ms),cu=new T.Mesh(new T.CylinderGeometry(1,1,1,12),mk),h=new T.Mesh(new T.SphereGeometry(1,14,10),mk);for(const o of [up,fo,cu,h]){o.frustumCulled=false;g.add(o)}AFP.seg.push({up,fo,cu,h})}sc.add(g);AFP.g=g}
 AFP.g.visible=!!on;if(!on||!m)return;const cq=cam.quaternion,F=new T.Vector3(0,0,-1).applyQuaternion(cq),U=new T.Vector3(0,1,0).applyQuaternion(cq),Rt=new T.Vector3(1,0,0).applyQuaternion(cq);
 const put=(o,a,b,r)=>{const d=b.clone().sub(a),L=d.length();o.position.copy(a);o.scale.set(r,L,r);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize())};
 [['impugnatura',1],['appoggio',-1]].forEach(([k,sd],i)=>{const A=m.an[k]||m.an.impugnatura;if(!A)return;const hand=k==='appoggio'?armSupport(m):m.g.localToWorld(A.clone()),S=AFP.seg[i];
  const sh=cam.position.clone().addScaledVector(U,-.36).addScaledVector(Rt,sd*.24).addScaledVector(F,-.12),el=hand.clone().addScaledVector(F,-.24).addScaledVector(U,-.16).addScaledVector(Rt,sd*.07);
  put(S.up,sh,el,.05);put(S.fo,el,hand.clone().addScaledVector(F,-.07),.042);put(S.cu,hand.clone().addScaledVector(F,-.09),hand.clone().addScaledVector(F,-.05),.036);S.h.position.copy(hand);S.h.scale.set(.045,.05,.03)})}
/* ---------- sparo, ciclo delle parti mobili, ricarica ---------- */
function armCycleT(m){const rpm=m.sp.cadenza||0;return rpm?Math.min(.11,.8*60/rpm):m.sp.categoria==='pistola'?.075:.09}
function armCanFire(m){return !ARM.man&&!ARM.rel&&ARM.cd<=0}
function armShoot(){const m=ARM.cur;if(!m||inCar||!armCanFire(m))return false;
 if(m.mag<=0){snd(m.snd.dry,{vol:.8});ARM.cd=.3;armReload();return false}
 const bal=m.bal,inf=m.info||{},az=inf.azione||'semi';m.mag--;ARM.stat.shots++;ARM.shots++;
 // suono del colpo (presa a caso, tono leggermente variato)
 const s=m.snd;snd(s.shot[(ARM.shotI=((ARM.shotI||0)+1+Math.floor(Math.random()*(s.shot.length-1||1)))%s.shot.length)],{rate:.985+Math.random()*.03,vol:s.vol*.95,eco:inCar?0:1,pan:(Math.random()-.5)*.12,choke:(m.sp.cadenza||0)>0});
 // direzione: centro della telecamera con dispersione; il colpo parte idealmente dalla bocca
 const dir=new T.Vector3(),cp=Math.cos(pitch);dir.set(Math.sin(yaw)*cp,Math.sin(pitch),Math.cos(yaw)*cp);
 const mz=m.an.bocca?m.g.localToWorld(m.an.bocca.clone()):m.g.position.clone(),camO=cam.position.clone(),dP=Math.hypot(camO.x-P.x,camO.z-P.z);
 const spread=bal.spread*(ARM.aim?.55:1)*(1+ARM.bloom*1.6)*(P.sp>.5?1.6:1);
 for(let i=0;i<bal.pellets;i++){const d=dir.clone();if(spread>0){const a=Math.random()*6.283,r=Math.sqrt(Math.random())*spread;const R0=new T.Vector3(Math.cos(yaw),0,-Math.sin(yaw)),U0=new T.Vector3().crossVectors(R0,d).normalize();d.addScaledVector(R0,Math.cos(a)*r).addScaledVector(U0,Math.sin(a)*r).normalize()}
  const o=camO.clone().addScaledVector(d,fp?0:dP+.3),h=armRay(o,d,bal.range);if(h)armImpact(h,d,bal);ARM.last=h?{x:h.x,y:h.y,z:h.z,kind:h.kind}:null}
 // lampo, luce e fumo alla bocca
 const F=AFX.flash;if(F){if(!F.parent||F.parent!==m.g){m.g.add(F)}F.position.copy(m.an.bocca||new T.Vector3());const big=bal.E>2500?1.5:bal.E>1200?1.15:.8,sc1=big*(.8+Math.random()*.45);
  AFX.flashSp.scale.set(.16*sc1,.16*sc1,1);AFX.flashSp.material.rotation=Math.random()*6.283;F.children[1].scale.set(.26*sc1,.11*sc1,1);F.children[2].scale.set(.26*sc1,.11*sc1,1);F.rotation.x=Math.random()*6.283;F.visible=true;AFX.flashT=.045;
  const LL=armLight();if(LL){LL.position.copy(mz);LL.intensity=2.4*big}fpSpawn('sm',mz.x,mz.y,mz.z,{life:.8,vy:.35,s:.06,s1:.35*big,op:.25,c0:[.8,.8,.8],c1:[.85,.85,.85]})}
 // rinculo e mirino che si apre
 ARM.rec.vt+=bal.kt*40;ARM.rec.vr+=bal.kr*(42+Math.random()*8);ARM.bloom=Math.min(1.5,ARM.bloom+.35);ARM.camK+=bal.cam;
 // parti mobili e bossolo
 m.cycT=0;m.cycD=armCycleT(m);if(inf.tamburo&&m.parts[inf.tamburo.parte||'tamburo'])m.rot+=2*Math.PI/(inf.tamburo.colpi||6);
 if(az!=='pompa'&&az!=='otturatore'&&az!=='revolver'&&az!=='singola')armEject(m);
 if(az==='pompa'||az==='otturatore'){ARM.man={t:0,d:az==='pompa'?.55:.95,ph:inf.manuale||[],kind:az};ARM.cd=.12}
 else{const rpm=m.sp.cadenza||0;ARM.cd=rpm?60/rpm:(m.sp.categoria==='pistola'?.16:m.sp.categoria==='revolver'?.28:m.sp.categoria==='precisione'?.45:.18)}
 armReact(P.x,P.z);armHud();return true}
function armEject(m){if(!m.info.bossolo)return;const e=m.an.espulsione;if(!e)return;const p=m.g.localToWorld(e.clone()),dl=(m.r.anchors.espulsione&&m.r.anchors.espulsione.userData&&m.r.anchors.espulsione.userData.dir)||(m.dirs&&m.dirs.esp);
 const dv=new T.Vector3(.1,.45,1);if(Array.isArray(dl))dv.set(dl[0],dl[1],dl[2]);dv.normalize().applyQuaternion(m.g.quaternion);armShell(m.info.bossolo,p,dv.multiplyScalar(2.4+Math.random()*1.2).add(new T.Vector3(0,1.2,0)))}
function armReload(){const m=ARM.cur;if(!m||ARM.rel||ARM.man)return;const cap=m.sp.colpi||10;if(m.mag>=cap)return;const cat=m.sp.categoria,az=(m.info||{}).azione;
 const inner=(m.info||{}).serbatoio==='interno',shellByShell=(cat==='fucile_caccia'&&!(m.parts&&m.parts.caricatore))||inner,rev=cat==='revolver';
 const d=rev?2.4:shellByShell?Math.min(4,.5*(cap-m.mag)+.6):cat==='pistola'?1.5:cat.startsWith('mitragl')?3.6:cat==='precisione'?2.4:2.1;
 ARM.rel={t:0,d,rev,sh:shellByShell,inner,n:cap-m.mag,k:0};const s=m.snd;
 if(rev){snd('tamb_apri');snd('tamb_espelli',{dly:.45});snd('tamb_carica',{dly:1.1});snd('tamb_chiudi',{dly:d-.25})}
 else if(shellByShell){for(let i=0;i<ARM.rel.n;i++)snd('cartuccia_in',{dly:.35+i*.5});snd(az==='pompa'?'pompa':'otturatore_ciclo',{dly:d-.4,vol:.9})}
 else{snd(s.mOut,{dly:.05});snd(s.mIn,{dly:d*.55});snd(s.rack,{dly:d-.35})}armHud()}
// posizione delle parti mobili: ciclo dello sparo, azione manuale, ricarica
function armParts(dt){const m=ARM.cur;if(!m)return;const inf=m.info||{},P0=m.parts;
 const set=(p,k,o)=>{const g=P0[p];if(!g)return;const r=g.userData.rest;if(!r)return;g.position.set(r.p.x+(o.dx||0)*k,r.p.y+(o.dy||0)*k,r.p.z+(o.dz||0)*k);g.rotation.set(r.r.x+(o.rx||0)*k,r.r.y+(o.ry||0)*k,r.r.z+(o.rz||0)*k)};
 const rest=new Set(Object.keys(P0));
 // ciclo automatico (carrello, otturatore, cane, grilletto)
 if(m.cycD){m.cycT+=dt;const u=m.cycT/m.cycD;let k=0;if(u<1)k=u<.3?Math.sin(u/.3*Math.PI/2):Math.cos((u-.3)/.7*Math.PI/2);else m.cycD=0;
  for(const p in (inf.ciclo||{})){set(p,k,inf.ciclo[p]);rest.delete(p)}}
 // tamburo del revolver: gira verso la camera successiva
 if(inf.tamburo){const p=inf.tamburo.parte||'tamburo',g=P0[p];if(g&&g.userData.rest){m.rotV=(m.rotV||0)+(m.rot-(m.rotV||0))*Math.min(1,dt*18);g.rotation.x=g.userData.rest.r.x+m.rotV;rest.delete(p)}}
 // azione manuale dopo il colpo: fasi in andata e ritorno
 const M=ARM.man;if(M){M.t+=dt;const ph=M.ph,u=Math.min(1,M.t/M.d);if(ph.length){const n=ph.length,seq=[];for(let i=0;i<n;i++)seq.push(i);for(let i=n-2;i>=0;i--)seq.push(i);seq.push(-1);const f=u*(seq.length),i0=Math.min(seq.length-1,Math.floor(f)),fr=f-i0,from=i0?seq[i0-1]:-1,to=seq[i0];
   const pose=(i,p)=>i<0?{}:(ph[i][p]||{});const parts=new Set();for(const q of ph)for(const p in q)parts.add(p);
   for(const p of parts){const A=pose(from,p),B=pose(to,p),o={};for(const k of ['dx','dy','dz','rx','ry','rz'])o[k]=(A[k]||0)+((B[k]||0)-(A[k]||0))*(fr<.5?2*fr*fr:1-2*(1-fr)*(1-fr));set(p,1,o);rest.delete(p)}}
  if(!M.snd&&M.t>.08){M.snd=1;snd(M.kind==='pompa'?'pompa':'otturatore_ciclo',{vol:.9})}
  if(!M.ej&&M.t>M.d*.4){M.ej=1;armEject(m)}
  if(u>=1)ARM.man=null}
 // ricarica: il caricatore esce e rientra (o il tamburo si apre)
 const R=ARM.rel;if(R){R.t+=dt;const u=R.t/R.d,rk=inf.ricarica||{};let k;if(R.sh&&R.inner){k=u<.12?u/.12:u<.88?1:Math.max(0,(1-u)/.12)}else if(R.sh){const v=(R.t-(R.d-.45))/.45;k=v<=0||v>=1?0:v<.5?v*2:(1-v)*2}else k=u<.3?u/.3:u<.55?1:u<.85?1-(u-.55)/.3:0;k=k*k*(3-2*k);
  for(const p in rk){set(p,k,rk[p]);rest.delete(p)}
  // armamento alla fine della ricarica (leva d'armamento tirata e rilasciata), se il modello lo descrive
  const am=inf.armamento;if(am&&!R.sh){const v=(u-.8)/.17,k2=v<=0||v>=1?0:v<.4?v/.4:1-(v-.4)/.6;for(const p in am){if(rk[p])continue;set(p,k2,am[p]);rest.delete(p)}}
  if(R.sh){const nn=Math.min(R.n,Math.floor((R.t-.35)/.5)+1);if(nn>R.k){m.mag=Math.min(m.sp.colpi||8,m.mag+(nn-R.k));R.k=nn;armHud()}}
  if(u>=1){ARM.rel=null;if(!R.sh)m.mag=m.sp.colpi||10;m.cycT=0;m.cycD=.18;armHud()}}
 for(const p of rest){const g=P0[p],r=g.userData.rest;if(r&&(p!=='corpo')){g.position.copy(r.p);g.rotation.copy(r.r)}}}

/* ---------- passo per fotogramma ---------- */
function armStep(dt){if(ARM.freeze)return;armPedStep(dt);armFxStep(dt);const m=ARM.cur;armHudVis();if(!m)return;
 if(ARM.cd>0)ARM.cd-=dt;ARM.bloom=Math.max(0,ARM.bloom-dt*(ARM.fire?.9:2.2));
 // molla del rinculo (critica): torna in posizione
 const R=ARM.rec,kk=320,cc=2*Math.sqrt(kk);R.vt+=(-kk*R.t-cc*R.vt)*dt;R.t+=R.vt*dt;R.vr+=(-kk*R.r-cc*R.vr)*dt;R.r+=R.vr*dt;
 if(ARM.camK>0){const k=Math.min(ARM.camK,dt*6);pitch=cl(pitch+k*.9,-1.2,1);ARM.camK-=k*1.15}
 if(inCar){m.g.visible=false;if(AFP.g)AFP.g.visible=false;return}
 const fireIn=ARM.fire||!!K.f;if(fireIn&&!menu&&!mapOpen){const auto=(m.sp.cadenza||0)>0;if(auto||!ARM.semiHeld||ARM.cd<=0)armShoot();ARM.semiHeld=true}else ARM.semiHeld=false;
 armParts(dt);armPlace(dt);
 const ch=$('#mirino');if(ch){const s=8+ARM.bloom*16+(P.sp>.5?6:0);ch.style.setProperty('--g',s.toFixed(1)+'px')}}
// telecamera a piedi con l'arma: più vicina, spostata a destra, campo più stretto quando si mira
function armCamK(){const m=ARM.cur,on=m&&!inCar;const k=ARM.camT=(ARM.camT||0)+(((on?(ARM.aim?2:1):0))-(ARM.camT||0))*.12;const d=4.5-Math.min(1,k)*2.1-Math.max(0,k-1)*1.15,tv=Math.tan(armFov()*Math.PI/360)*(cam.aspect||1.6),side=Math.min(1,k)*Math.min(.8,d*tv*.7),// spostamento laterale secondo il campo visivo orizzontale: in verticale il personaggio resta nell'inquadratura
 h=1.5+Math.min(1,k)*.12;return {d,sx:-Math.cos(yaw)*side,sz:Math.sin(yaw)*side,h}}
function armScoped(){const m=ARM.cur;return !!(m&&!inCar&&fp&&ARM.aim&&!ARM.open&&m.an&&m.an.ottica&&!(m.info&&m.info.occhio))}
function armFov(){if(armScoped())return ARM.cur.sp.categoria==='precisione'?9:22;return (ARM.cur&&!inCar&&ARM.aim?(ARM.cur.sp.categoria==='precisione'?32:50):65)*fovK()}

/* ---------- interfaccia: pulsanti, mirino, colpi ---------- */
function armHud(){const m=ARM.cur,e=$('#colpi');if(!e)return;if(!m){e.style.display='none';return}e.textContent=(ARM.rel?'ricarica… ':'')+m.mag+' / '+(m.sp.colpi||'')+' · '+m.sp.nome}
function armHudVis(){const on=!!ARM.cur&&!inCar&&!menu&&!mapOpen&&!ARM.open,st=(on?1:0)+(ARM.aim?2:0);if(st===ARM.hudSt)return;ARM.hudSt=st;for(const id of ['#bspara','#bmira','#bricarica','#colpi','#mirino'])if($(id))$(id).style.display=id==='#mirino'?(on?'block':'none'):(on?(id==='#colpi'?'block':'flex'):'none');
 const b=$('#bmira');if(b)b.classList.toggle('on',!!ARM.aim)}
function armHudInit(){const F=$('#bspara');if(!F)return;
 F.addEventListener('pointerdown',e=>{e.preventDefault();armCtx();ARM.fire=true});for(const ev of ['pointerup','pointercancel','pointerleave'])F.addEventListener(ev,()=>{ARM.fire=false});
 $('#bmira').onclick=()=>{ARM.aim=!ARM.aim};$('#bricarica').onclick=()=>armReload();$('#barmi').onclick=()=>{armCtx();armOpen()};
 addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(k==='r')armReload();else if(k==='q')ARM.aim=!ARM.aim;else if(k==='g'){if(ARM.cur)armUnequip();else if(S.armaUlt!==undefined)armEquip(S.armaUlt)}else if(k==='b'){if(ARM.open)armClose();else armOpen()}})}

/* ---------- armeria: elenco per categoria, modello 3D da girare, prova di sparo ---------- */
const ARMV={sc:null,cam:null,m:null,yaw:-.5,pit:.18,zoom:1,auto:true,last:0,env:null,tg:null,full:false,lt:0};
function armViewInit(){if(ARMV.sc)return;const s=new T.Scene();ARMV.sc=s;
 // sfondo da studio: grigio antracite sfumato con vignettatura
 {const cv=document.createElement('canvas');cv.width=cv.height=256;const x=cv.getContext('2d');if(x&&x.createRadialGradient){const g=x.createRadialGradient(128,110,10,128,128,190);g.addColorStop(0,'#4a4f57');g.addColorStop(.55,'#2a2d33');g.addColorStop(1,'#111214');x.fillStyle=g;x.fillRect(0,0,256,256)}
  const bt=new T.CanvasTexture(cv);bt.encoding=T.sRGBEncoding;s.background=bt}
 // riflessi da studio fotografico: sfera scura con grandi bank luminosi (sopra, strisce ai lati, luce di contorno dietro, rimbalzo dal piano)
 const es=new T.Scene(),cv=document.createElement('canvas');cv.width=4;cv.height=256;const x=cv.getContext('2d');if(x&&x.createLinearGradient){const g=x.createLinearGradient(0,0,0,256);g.addColorStop(0,'#2a2d33');g.addColorStop(.5,'#3c4048');g.addColorStop(1,'#0d0e10');x.fillStyle=g;x.fillRect(0,0,4,256)}
 const tx=new T.CanvasTexture(cv);tx.encoding=T.sRGBEncoding;es.add(new T.Mesh(new T.SphereGeometry(50,24,12),new T.MeshBasicMaterial({map:tx,side:T.BackSide})));
 const panel=(w,h,px,py,pz,k,c)=>{const mm=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({color:new T.Color(c||0xffffff).multiplyScalar(k),side:T.DoubleSide}));mm.position.set(px,py,pz);mm.lookAt(0,0,0);es.add(mm)};
 panel(40,14,0,44,2,6.5);panel(7,40,-38,6,18,9,0xfff4e6);panel(7,40,38,6,-16,7.5,0xe6efff);panel(60,4,0,-6,44,1.4);panel(30,6,-6,18,-44,4,0xe0ecff);panel(10,26,30,10,30,3,0xfff2e0);
 try{ARMV.env=new T.PMREMGenerator(R).fromScene(es).texture}catch(e){}s.environment=ARMV.env;
 s.add(new T.HemisphereLight(lc(0xcfe4ff),lc(0x3a3c40),.25));
 // luce principale con ombre proprie (le parti fanno ombra l'una sull'altra) e piano d'appoggio con ombra morbida
 const k=new T.DirectionalLight(lc(0xfff1d6),2.2);k.position.set(-.9,2.6,1.4);k.castShadow=true;k.shadow.mapSize.set(1024,1024);k.shadow.bias=-.0004;k.shadow.normalBias=.002;
 const sc0=k.shadow.camera;sc0.left=-.8;sc0.right=.8;sc0.top=.8;sc0.bottom=-.8;sc0.near=.1;sc0.far=8;s.add(k);ARMV.key=k;
 const f=new T.DirectionalLight(lc(0xdfe8ff),.55);f.position.set(1.5,.6,-1.4);s.add(f);const rim=new T.DirectionalLight(lc(0xffffff),.7);rim.position.set(.2,1.2,-2.2);s.add(rim);
 const fl=new T.Mesh(new T.PlaneGeometry(8,8),new T.ShadowMaterial({opacity:.38}));fl.rotation.x=-Math.PI/2;fl.receiveShadow=true;s.add(fl);ARMV.floor=fl;
 ARMV.cam=new T.PerspectiveCamera(28,1,.02,40);ARMV.tg=new T.Vector3()}
function armOpen(){if(inCar){toast('Scendi dall\'auto per usare l\'armeria');return}armViewInit();ARM.open=true;$('#arm').hidden=false;$('#hud').classList.add('armA');ARM.fire=false;armTabs();const id0=ARM.sel!==null?ARM.sel:(ARM.cur?ARM.cur.id:ARMCAT.findIndex(c=>c.categoria===ARM.tab));
 // la prima volta il kit prepara le trame condivise (un paio di secondi sui telefoni lenti): prima si mostra l'armeria con un avviso
 if(!ARM.warm){ARM.warm=1;$('#armInfo').innerHTML='<h3>Preparazione dei materiali…</h3>';const n0=ARM.selN||0;setTimeout(()=>{if(ARM.open&&(ARM.selN||0)===n0)armSelect(id0)},60)}else armSelect(id0)}
function armClose(){ARM.open=false;$('#arm').hidden=true;if(ARMV.full)armFull(false);armLic(false);$('#hud').classList.remove('armA');ARM.vFire=false;if(ARMV.m){armDispose(ARMV.m);ARMV.m=null}}
function armTabs(){const t=$('#armCat');t.innerHTML=ARM.CATS.map(c=>'<button class="b s'+(c[0]===ARM.tab?' on':'')+'" data-k="'+c[0]+'">'+c[1]+' <small>'+ARMCAT.filter(q=>q.categoria===c[0]).length+'</small></button>').join('');
 const on=t.querySelector('.on');if(on&&on.scrollIntoView)try{on.scrollIntoView({block:'nearest',inline:'center'})}catch(e){}
 const L=$('#armList');requestAnimationFrame(armLayout);L.innerHTML=ARMCAT.filter(c=>c.categoria===ARM.tab).map(c=>'<button class="it'+(c.id===ARM.sel?' on':'')+'" data-i="'+c.id+'"><b>'+c.nome+'</b><span>'+c.produttore+'</span></button>').join('')}
function armSelect(id){if(id<0||!ARMCAT[id])return;if(!ARMV.sc)armViewInit();ARM.sel=id;ARM.selN=(ARM.selN||0)+1;ARM.tab=ARMCAT[id].categoria;armTabs();if(ARMV.m){armDispose(ARMV.m);ARMV.m=null}
 const m=armBuild(id),sp=ARMCAT[id];if(m){ARMV.m=m;m.mag=sp.colpi||10;m.cyc={};m.rot=0;ARMV.sc.add(m.g);armSndPreload(m);if(!m.glb)armViewFrame(m);ARMV.yaw=-.5;ARMV.pit=.18;ARMV.zoom=ARMV.full?1.6:1;if(ARMV.tg)ARMV.tg.set(0,0,0)}
 armSelectInfo(id,m)}
function armSelectInfo(id,m){const sp=ARMCAT[id];
 const f=(k,v)=>v===null||v===undefined||v===''?'':'<div><i>'+k+'</i>'+v+'</div>';
 $('#armInfo').innerHTML='<h3>'+sp.produttore+' '+sp.nome+'</h3>'+f('Categoria',(ARM.CATS.find(c=>c[0]===sp.categoria)||[0,''])[1])+f('Paese',sp.paese)+f('Anno',sp.anno)+f('Calibro',sp.calibro)+f('Funzionamento',sp.funzionamento)+f('Colpi',sp.colpi)+f('Cadenza',sp.cadenza?sp.cadenza+' colpi/min':'')+f('Lunghezza',sp.lunghezza?sp.lunghezza+' mm':'')+f('Peso',sp.peso?String(sp.peso).replace('.',',')+' kg':'')+
  '<div class="nota">'+(!m?'Modello non disponibile.':m.glb&&!m.err?(m.ready?'Modello 3D realistico di terzi ('+m.r.tris.toLocaleString('it-IT')+' triangoli), parti mobili: '+Object.keys(m.parts).filter(p=>p!=='corpo'&&p!=='telaio').join(', ')+'. '+m.glb.credit+'.':'Caricamento del modello…'):'Modello 3D costruito dal gioco ('+m.r.tris.toLocaleString('it-IT')+' triangoli), parti mobili: '+Object.keys(m.parts).filter(p=>p!=='corpo').join(', ')+'.'+(m.err?' Il modello realistico di terzi non si è caricato ('+String(m.err).slice(0,60)+'): al suo posto c\'è quello del gioco.':''))+'</div>';
 $('#armPrendi').textContent=ARM.cur&&ARM.cur.id===id?'In mano':'Prendi'}
function armViewShot(){const m=ARMV.m;if(!m||m.vcd>0)return;armCtx();const s=m.snd;snd(s.shot[Math.floor(Math.random()*s.shot.length)],{rate:.985+Math.random()*.03,vol:s.vol*.9,eco:.7,choke:(m.sp.cadenza||0)>0});m.vcd=(m.sp.cadenza?60/m.sp.cadenza:.25);
 m.vrec=(m.vrec||0)+m.bal.kr*12;m.cycT=0;m.cycD=armCycleT(m);if(m.info.tamburo)m.rot+=2*Math.PI/(m.info.tamburo.colpi||6);
 armFxInit();const F=AFX.flash;m.g.add(F);F.position.copy(m.an.bocca||new T.Vector3());const big=m.bal.E>2500?1.5:m.bal.E>1200?1.15:.8;AFX.flashSp.scale.set(.16*big,.16*big,1);F.children[1].scale.set(.26*big,.11*big,1);F.children[2].scale.set(.26*big,.11*big,1);F.visible=true;AFX.flashT=.05;
 const az=m.info.azione;if(az==='pompa'||az==='otturatore'){m.vman={t:0,d:az==='pompa'?.55:.95,ph:m.info.manuale||[],kind:az}}}
function armLayout(){const A=$('#arm'),V=$('#armView'),C=$('#armCat'),L=$('#armList'),I=$('#armInfo');if(!A||A.hidden||!V)return;const port=innerWidth<innerHeight;
 if(ARMV.full){V.style.top=V.style.bottom='';return}
 const cb=C.getBoundingClientRect().bottom;if(port){const it=I.getBoundingClientRect().top;V.style.top=Math.round(cb+4)+'px';V.style.bottom=Math.max(0,Math.round(innerHeight-it+4))+'px';L.style.top=''}
 else{V.style.top=V.style.bottom='';L.style.top=Math.round(cb+6)+'px'}}
function armFull(on){ARMV.full=on===undefined?!ARMV.full:on;const A=$('#arm');A.classList.toggle('full',ARMV.full);$('#armZoom').textContent=ARMV.full?'Indietro':'Dettagli';
 if(ARMV.full){ARMV.zoom=Math.max(ARMV.zoom,1.6);ARMV.auto=false}else{ARMV.zoom=1;if(ARMV.tg)ARMV.tg.set(0,0,0)}armLayout()}
function armViewFrame(m){const bb=new T.Box3().setFromObject(m.g),c=bb.getCenter(new T.Vector3());if(!isFinite(c.x))return;m.g.position.sub(c);m.size=bb.getSize(new T.Vector3());m.framed=true;
 m.g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});if(ARMV.floor)ARMV.floor.position.y=-m.size.y/2-.004;if(ARMV.key){const L=Math.max(m.size.x,m.size.y,.2)*.75,c2=ARMV.key.shadow.camera;c2.left=c2.bottom=-L;c2.right=c2.top=L;c2.updateProjectionMatrix()}}
function armView(dt){ARMV.lt-=dt;if(ARMV.lt<=0){ARMV.lt=.5;armLayout()}const m0=ARMV.m;if(m0&&m0.glb&&m0.ready&&!m0.framed){m0.g.position.set(0,0,0);armViewFrame(m0);armSelectInfo(m0.id,m0)}const m=ARMV.m&&(!ARMV.m.glb||ARMV.m.ready)?ARMV.m:null,c=ARMV.cam,w=R.domElement.clientWidth||innerWidth,h=R.domElement.clientHeight||innerHeight;c.aspect=w/h;
 // zona del modello: a destra (orizzontale) o in alto (verticale)
 const land=w>=h,vr=$('#armView').getBoundingClientRect(),cr=R.domElement.getBoundingClientRect(),vx=(vr.left+vr.width/2-cr.left)/w,vy=(vr.top+vr.height/2-cr.top)/h,fx=vr.width>20?vr.width/w:(land?.56:1),fy=vr.height>20?vr.height/h:(land?.45:.33);
 c.setViewOffset(w,h,(.5-vx)*w,(.5-vy)*h,w,h);c.updateProjectionMatrix();
 if(m){if(ARMV.auto)ARMV.yaw+=dt*.25;const tv=Math.tan(c.fov*Math.PI/360),Lm=Math.max(m.size.x,m.size.z,.15),Hm=Math.max(m.size.y,.08),d=Math.max(Lm*1.08/(2*tv*c.aspect*fx*.9),Hm*1.15/(2*tv*fy*.9))/ARMV.zoom;ARMV.d=d;
  const tg=ARMV.tg;if(ARMV.zoom<1.03)tg.multiplyScalar(Math.exp(-dt*6));tg.x=cl(tg.x,-m.size.x*.55,m.size.x*.55);tg.y=cl(tg.y,-m.size.y*.6,m.size.y*.6);tg.z=cl(tg.z,-m.size.z,m.size.z);
  c.position.set(tg.x+Math.sin(ARMV.yaw)*Math.cos(ARMV.pit)*d,tg.y+Math.sin(ARMV.pit)*d,tg.z+Math.cos(ARMV.yaw)*Math.cos(ARMV.pit)*d);c.lookAt(tg);const nr=Math.max(.003,d*.04);if(Math.abs(c.near-nr)>nr*.2){c.near=nr;c.updateProjectionMatrix()}
  // prova di sparo: rinculo del modello, parti mobili, lampo
  if(m.vcd>0)m.vcd-=dt;m.vrec=(m.vrec||0)*Math.exp(-dt*14);m.g.rotation.z=m.vrec;
  const save={cur:ARM.cur,man:ARM.man,rel:ARM.rel};ARM.cur=m;ARM.man=m.vman||null;ARM.rel=null;armParts(dt);m.vman=ARM.man;ARM.cur=save.cur;ARM.man=save.man;ARM.rel=save.rel;
  if(ARM.vFire&&(m.sp.cadenza||0)>0)armViewShot()}
 if(AFX.flashT>0){AFX.flashT-=dt;if(AFX.flashT<=0&&AFX.flash)AFX.flash.visible=false}
 R.render(ARMV.sc,c)}
function armViewInput(){const v=$('#armView');if(!v)return;const P=new Map();let d0=0,z0=1,mx=0,my=0,tap=0;
 const two=()=>{const a=[...P.values()];return {d:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y),x:(a[0].x+a[1].x)/2,y:(a[0].y+a[1].y)/2}};
 const pan=(dx,dy)=>{const c=ARMV.cam;if(!c||!ARMV.tg)return;const k=(ARMV.d||.5)*2*Math.tan(c.fov*Math.PI/360)/(innerHeight||800),Rv=new T.Vector3().setFromMatrixColumn(c.matrixWorld,0),Uv=new T.Vector3().setFromMatrixColumn(c.matrixWorld,1);ARMV.tg.addScaledVector(Rv,-dx*k).addScaledVector(Uv,dy*k)};
 v.addEventListener('pointerdown',e=>{P.set(e.pointerId,{x:e.clientX,y:e.clientY});ARMV.auto=false;try{v.setPointerCapture(e.pointerId)}catch(_){}
  if(P.size===2){const t=two();d0=t.d;z0=ARMV.zoom;mx=t.x;my=t.y}
  else if(P.size===1){const now=performance.now();if(now-tap<300){ARMV.zoom=ARMV.zoom>1.6?1:3;if(ARMV.zoom===1&&ARMV.tg)ARMV.tg.set(0,0,0)}tap=now}});
 v.addEventListener('pointermove',e=>{const q=P.get(e.pointerId);if(!q)return;const dx=e.clientX-q.x,dy=e.clientY-q.y;q.x=e.clientX;q.y=e.clientY;
  if(P.size===1){ARMV.yaw-=dx*.008;ARMV.pit=cl(ARMV.pit+dy*.006,-1.2,1.2)}
  else if(P.size===2){const t=two();if(d0>10)ARMV.zoom=cl(z0*t.d/d0,.7,10);pan(t.x-mx,t.y-my);mx=t.x;my=t.y}});
 for(const ev of ['pointerup','pointercancel','pointerleave'])v.addEventListener(ev,e=>{P.delete(e.pointerId);if(P.size===2){const t=two();d0=t.d;z0=ARMV.zoom;mx=t.x;my=t.y}});
 v.addEventListener('wheel',e=>{ARMV.auto=false;ARMV.zoom=cl(ARMV.zoom*(e.deltaY<0?1.15:.87),.7,10)},{passive:true});
 addEventListener('resize',()=>{if(ARM.open)setTimeout(armLayout,60)});
 $('#armCat').onclick=e=>{const b=e.target.closest('button');if(!b)return;ARM.tab=b.dataset.k;const first=ARMCAT.find(c=>c.categoria===ARM.tab);armSelect(first?first.id:-1)};
 $('#armList').onclick=e=>{const b=e.target.closest('button');if(b)armSelect(+b.dataset.i)};
 $('#armChiudi').onclick=armClose;$('#armCrediti').onclick=()=>armLic();$('#armLicX').onclick=()=>armLic(false);
 const P1=$('#armProva');P1.addEventListener('pointerdown',()=>{ARM.vFire=true;armViewShot()});for(const ev of ['pointerup','pointercancel','pointerleave'])P1.addEventListener(ev,()=>{ARM.vFire=false});
 $('#armPrendi').onclick=()=>{if(ARM.sel===null)return;S.armaUlt=ARM.sel;if(armEquip(ARM.sel)){armClose()}};
 $('#armRiponi').onclick=()=>{armUnequip();armSelect(ARM.sel)};
 $('#armZoom').onclick=()=>armFull()}
const ARMMIT='Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.';
function armLicHTML(){const nm=id=>{const c=ARMCAT[id];return c?'<b>'+c.produttore+' '+c.nome+'</b>':''},a=(u,t)=>'<a href="https://'+u+'" target="_blank" rel="noopener noreferrer">'+t+'</a>',cc=' licenza '+a('creativecommons.org/licenses/by/4.0/','CC BY 4.0');
 return '<h3>Crediti e licenze</h3><p>Le armi, i produttori, i nomi e le scritte del gioco sono di fantasia e non indicano prodotti o marchi reali.</p>'+
 '<h4>Modelli 3D realistici di terzi</h4><p>Usati per alcune armi; tutte le altre sono modellate dal gioco.</p><ul>'+
 '<li>'+nm(2)+': modello di Mateusz Sadek, Poly Haven (polyhaven.com) — CC0 1.0 (pubblico dominio). Conversione del progetto mini-cry. Modifiche: scala, assi, parti mobili separate.</li>'+
 '<li>'+nm(66)+': modello di LonesomeDucky, OpenGameArt.org — CC0 1.0. Conversione del progetto mini-cry. Modifiche: scala, assi, parti mobili separate.</li>'+
 '<li>'+nm(74)+': modello di nisu, OpenGameArt.org — CC0 1.0, con componenti di Quaternius («Ultimate Guns Pack», CC0 1.0), composti dal progetto Operation Steel Tide di AetherRadar. Modifiche: accessori nascosti, trame ridotte, nomi interni cambiati, parti mobili separate.</li>'+
 '<li>'+nm(8)+': modello di '+a('sketchfab.com/MaX3Dd','MaX3Dd')+', '+a('sketchfab.com/3d-models/m1911-pistol-6fd5b49b34fe4af796e930401cff15f6','pagina originale')+','+cc+'. <i>Modificato</i>: geometria decompressa, nomi interni generici, carrello, canna e caricatore separati, punti di riferimento aggiunti.</li>'+
 '<li>'+nm(31)+': «Revolver» di '+a('sketchfab.com/re1monsen','re1monsen')+', '+a('sketchfab.com/3d-models/revolver-740998352a1d4894b3c220413d98e2bd','pagina originale')+','+cc+'. <i>Modificato</i>: geometria decompressa, orientata e raddrizzata, tamburo, cane e grilletto separati, punti di riferimento aggiunti.</li>'+
 '<li>'+nm(125)+': «Free animated Pump Shotgun» di '+a('sketchfab.com/mostafaebrahiem1998','Mostafa Ebrahim')+', '+a('sketchfab.com/3d-models/free-animated-pump-shotgun-fc9b14f3caf641c3a2a84b02f14b5c0f','pagina originale')+','+cc+'. <i>Modificato</i>: geometria decompressa, animazione originale tolta, otturatore separato, punti di riferimento aggiunti.</li>'+
 '<li>'+nm(124)+': «Sniper Rifle» di '+a('sketchfab.com/awakov_dawid','awakov_dawid')+', '+a('sketchfab.com/3d-models/sniper-rifle-e5930a4ddbec4cae9909706e29c8d55a','pagina originale')+','+cc+'. <i>Modificato</i>: geometria decompressa, orientata e messa in bolla, marchi del telaio e dell\'ottica cancellati dalle trame, otturatore separato, punti di riferimento aggiunti.</li>'+
 '<li>'+nm(82)+': modello di '+a('sketchfab.com/Hitansh_3DArtist','Hitansh 3D')+', '+a('sketchfab.com/3d-models/fn-scar-l-assault-rifle-ea1823de59684fd596d9f6726382f948','pagina originale')+','+cc+'. <i>Modificato</i>: braccia, scheletro e animazione tolti, geometria con le trasformazioni applicate, nomi interni generici, scritte di produttore, paese, modello e calibro cancellate dalle trame, punti di riferimento aggiunti.</li>'+
 '<li>'+nm(146)+': modello di '+a('sketchfab.com/Badboy17Aiden','Pieter Ferreira')+', '+a('sketchfab.com/3d-models/m60-light-machine-gun-cbf408387dc94a30abe11afb3698ac13','pagina originale')+','+cc+'. <i>Modificato</i>: geometria decompressa, trasformazioni applicate e vertici inutilizzati tolti, nome nel titolo reso generico, marcatura sul fianco cancellata dalla trama, coperchio, manetta d\'armamento e cassetta separati, punti di riferimento aggiunti.</li>'+
 '<li>Copie di partenza: i modelli di '+nm(8)+', '+nm(31)+', '+nm(125)+', '+nm(124)+' e '+nm(146)+' sono stati presi da una conversione pubblicata su GitHub da '+a('github.com/mrgulper','mrgulper')+' (modifiche precedenti: rotazione e scala, parti tolte, trame ridotte, compressione); quello di '+nm(82)+' dalla versione in prima persona del progetto di '+a('github.com/Hungden2k13','Hungden2k13')+' su GitHub (modifiche precedenti: messa in posa con braccia e scheletro, ombreggiatura cotta nelle trame, compressione).</li>'+
 '<li>'+nm(60)+': «fps animated smg» di '+a('sketchfab.com/bumstrum','DJMaesen')+', '+a('sketchfab.com/3d-models/fps-animated-smg-ea3dad7478624495a5a46f40127b0579','pagina originale')+', sotto licenza Creative Commons Attribuzione 4.0 Internazionale ('+a('creativecommons.org/licenses/by/4.0/','CC BY 4.0')+'). <i>Modificato</i>: arma separata dalle braccia (progetto Operation Steel Tide di AetherRadar); nel gioco trame ridotte, scala, assi e nomi adattati, parti mobili separate, una cartuccia nascosta. Fornito «così com\'è», senza garanzie.</li></ul>'+
 '<p>I modelli con licenza CC BY 4.0 sono forniti dai loro autori «così come sono», senza garanzie; le modifiche elencate sono state fatte per questo gioco. I collegamenti «pagina originale» portano alle pagine degli autori, dove il titolo originale può contenere nomi reali.</p><h4>Suoni delle armi</h4><p>«The Free Firearm Sound Library» di Ben Jaszczak, Brian Nelson, Kevin Heras e Matthew Nanney (github.com/buddingmonkey/FreeFirearmsSFXLibrary) — CC0 1.0. Modifiche: tagli, sovrapposizione della presa vicina e di quella a media distanza della stessa arma, livello e saturazione morbida, conversione in MP3; l\'eco della strada è generata dal gioco.</p>'+
 '<h4>Programmi</h4><p>three.js r128 e il suo caricatore GLTF — Copyright © 2010-2021 three.js authors, licenza MIT. Il progetto Operation Steel Tide è distribuito con licenza MIT, Copyright (c) 2026 AetherRadar. I modelli compressi sono stati decompressi con meshoptimizer, Copyright (c) 2016-2026 Arseny Kapoulkine, licenza MIT.</p><pre>MIT License\n\n'+ARMMIT+'</pre>'}
function armLic(on){const L=$('#armLic');if(!L)return;if(on===undefined)on=L.hidden;if(on&&!L.dataset.ok){L.querySelector('div').innerHTML=armLicHTML();L.dataset.ok=1}L.hidden=!on}
function armInit(){armHudInit();armViewInput();try{armFxInit();if(AFX.flash&&!AFX.flash.parent)sc.add(AFX.flash)}catch(e){}// lampo nella scena (nascosto) prima della compilazione dei materiali all'avvio
 for(const s of CSOL)ARMSOL.add(s);if(S.arma!==undefined&&ARMCAT[S.arma])setTimeout(()=>armEquip(S.arma,true),1500)}
