/* ===== MAPPA REALE (Versione 24): l'Italia vera, da OpenStreetMap (tile OpenMapTiles servite da OpenFreeMap) e dal rilievo
   Mapterhorn (fra le fonti: TINITALY dell'INGV e i modelli del terreno regionali). Il mondo inventato delle versioni precedenti
   è stato tolto. Il territorio si carica a celle attorno al giocatore: celle z15 (circa 0,9 km) in dettaglio A (edifici, strade,
   marciapiedi, alberi, collisioni) e B (terreno, strade principali, edifici alti), più il terreno lontano a blocchi z14.
   Coordinate del gioco: x verso ovest, z verso nord, metri; origine nel punto di partenza o di arrivo dell'ultimo viaggio. ===== */
const REAL=(()=>{
const Q=new URLSearchParams(location.search),ME=40075016.68557849,MH=ME/2,S15=ME/32768,S14=ME/16384,FR=4;
const CFG={vt:Q.get('vt')||'https://tiles.openfreemap.org/planet/latest/{z}/{x}/{y}.pbf',dem:Q.get('dem')||'https://tiles.mapterhorn.com/{z}/{x}/{y}.webp',demType:Q.get('demtype')||'image/webp',demMax:12,
 lc:Q.get('lc')||'https://mapproxy.terrascope.be/mapproxy/wmts/esa-worldcover-map-10m-2021-v2_map/webmercator/{zz}/{x}/{y}.png',sat:Q.get('sat')||'https://mapproxy.terrascope.be/mapproxy/wmts/esa-worldcover-s2rgbnir-10m-2021-v2_tcc/webmercator/{zz}/{x}/{y}.png'};
// dati Copernicus (ESA WorldCover 2021 e il suo mosaico Sentinel-2 a colori veri, tramite Terrascope di VITO): attivi salvo scelta contraria
const COP={on:(()=>{if(Q.get('cop')==='0')return false;try{return localStorage.getItem('iow_cop')!=='0'}catch(e){return true}})(),cache:new Map(),fail:0,ok:0};
const START={lat:45.0711,lon:7.6857,name:'Torino'};   // piazza Castello
const CITIES=[['Torino',45.0711,7.6857],['Milano',45.4642,9.19],['Genova',44.4072,8.9339],['Venezia',45.438,12.3184],['Bologna',44.4938,11.3426],['Firenze',43.7731,11.256],['Roma',41.8902,12.4922],['Napoli',40.8359,14.2488],['Bari',41.1253,16.8667],['Reggio Calabria',38.1113,15.6473],['Palermo',38.1157,13.3615],['Catania',37.5025,15.0873],['Cagliari',39.217,9.11],['Aosta',45.737,7.3201],['Trento',46.0679,11.1211],['Trieste',45.6503,13.7678]];
const ll2m=(lat,lon)=>[lon*ME/360,Math.log(Math.tan(PI/4+lat*PI/360))*ME/(2*PI)],m2ll=(mx,my)=>[(2*Math.atan(Math.exp(my*2*PI/ME))-PI/2)*180/PI,mx*360/ME];
let OX=0,OY=0,K=1,GEN=0,LASTH=0;
const g2m=(x,z)=>[OX-x/K,OY+z/K],m2g=(mx,my)=>[-(mx-OX)*K,(my-OY)*K],geoOf=(x,z)=>{const m=g2m(x,z);return m2ll(m[0],m[1])};
const key2=(x,y)=>x*65536+y;
/* ---------- materiali e testure (disegnate qui: nessun file esterno) ---------- */
const cv=(w,h,fn)=>{const c=document.createElement('canvas');c.width=w;c.height=h;fn(c.getContext('2d'),w,h);return c};
const tex=(c,rs,rt)=>{const t=new T.CanvasTexture(c);t.encoding=T.sRGBEncoding;t.wrapS=rs?T.RepeatWrapping:T.ClampToEdgeWrapping;t.wrapT=rt?T.RepeatWrapping:T.ClampToEdgeWrapping;t.anisotropy=Math.min(8,R.capabilities.getMaxAnisotropy());return t};
const rnd=(()=>{let s=20261029;return()=>{s=(s+0x6D2B79F5)|0;let t=Math.imul(s^(s>>>15),1|s);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296}})();
const speck=(x,X,Y,W,H,n,a,b,al)=>{for(let i=0;i<n;i++){const v=a+rnd()*b|0;x.fillStyle='rgba('+v+','+v+','+(v+3)+','+al+')';x.fillRect(X+rnd()*W,Y+rnd()*H,2,2)}};
// atlante delle strade: 8 colonne da 128 px, 512 px = 10 m lungo la strada
const ROADTX=tex(cv(1536,512,(x)=>{
 const asph=(c,base)=>{x.fillStyle=base;x.fillRect(c*128,0,128,512);speck(x,c*128,0,128,512,2600,52,40,.55);x.fillStyle='rgba(0,0,0,.16)';x.fillRect(c*128,0,7,512);x.fillRect(c*128+121,0,7,512)};
 const line=(c,u,w,from,len)=>{x.fillStyle='#e9e8e0';for(let y=from;y<512;y+=512)x.fillRect(c*128+u,y,w,len)};
 asph(0,'#4b4d51');
 asph(1,'#4a4c50');line(1,8,4,0,512);line(1,116,4,0,512);line(1,62,4,0,230);
 asph(2,'#47494d');line(2,6,5,0,512);line(2,117,5,0,512);line(2,45,3,0,230);line(2,80,3,0,230);
 {const X=384;x.fillStyle='#8f897f';x.fillRect(X,0,128,512);for(let r=0;r<22;r++)for(let q=0;q<5;q++){const g=128+rnd()*40|0;x.fillStyle='rgb('+g+','+(g-5)+','+(g-12)+')';x.fillRect(X+q*26+(r&1)*13-13+1,r*24+1,24,22)}}
 {const X=512;x.fillStyle='#836f53';x.fillRect(X,0,128,512);speck(x,X,0,128,512,3000,90,60,.5);x.fillStyle='rgba(60,45,30,.35)';x.fillRect(X+22,0,18,512);x.fillRect(X+88,0,18,512)}
 {const X=640;x.fillStyle='#6f6a62';x.fillRect(X,0,128,512);speck(x,X,0,128,512,3500,70,70,.6);for(let y=0;y<512;y+=31){x.fillStyle='#5b5046';x.fillRect(X+14,y,100,12)}x.fillStyle='#9a9ea3';x.fillRect(X+36,0,6,512);x.fillRect(X+86,0,6,512)}
 {const X=768;x.fillStyle='#b8b4ab';x.fillRect(X,0,128,512);speck(x,X,0,128,512,1600,150,40,.45);x.fillStyle='rgba(90,85,78,.45)';for(let y=0;y<512;y+=85)x.fillRect(X,y,128,3);x.fillRect(X+63,0,2,512)}
 asph(7,'#56585c');
 // 8 strisce pedonali (bande bianche lungo la strada), 9 binari del tram nell'asfalto, 10 bianco pieno (linee di arresto)
 asph(8,'#4b4d51');x.fillStyle='#e6e5dd';for(let i=0;i<128;i+=32)x.fillRect(8*128+i+2,0,16,512);
 asph(9,'#4a4c50');x.fillStyle='#b9bcc0';x.fillRect(9*128+22,0,8,512);x.fillRect(9*128+98,0,8,512);x.fillStyle='#8a8c90';x.fillRect(9*128+30,0,3,512);x.fillRect(9*128+95,0,3,512);
 x.fillStyle='#e6e5dd';x.fillRect(10*128,0,128,512);
}),false,true);
// atlante delle facciate: 16 bande da 256×256 px (una campata di 3 m per un piano), disegnate qui con stili italiani.
// Le bande sono quasi bianche dove l'intonaco prende il colore dei vertici (ogni edificio ha il suo).
const NB=18;
// Atlante delle facciate: 16 bande (una campata di 3 m per un piano) disegnate qui in stili italiani, con una mappa di profondità
// (finestre incassate, balconi e cornici sporgenti) da cui si ricava la mappa delle normali. Le bande sono quasi bianche dove
// l'intonaco prende il colore dei vertici. Risoluzione: 512 px per campata se il telefono regge testure da 8192, altrimenti 256.
const FAC_PAINT=(()=>{
 const W=256,H=256;let x=null,xd=null,xa=null;const RA=v=>'rgb('+v+','+v+','+v+')';const KS=Math.max(.5,Math.min(2,R.capabilities.maxTextureSize/(NB*256)));
 const rect=(c,a,b,w,h,dep,ra)=>{x.fillStyle=c;x.fillRect(a,b,w,h);if(dep!==undefined){xd.fillStyle=dep;xd.fillRect(a,b,w,h)}xa.fillStyle=RA(ra===undefined?150:ra);xa.fillRect(a,b,w,h)};
 const arcA=(cx,cy,r,ra)=>{xa.fillStyle=RA(ra);xa.beginPath();xa.arc(cx,cy,r,Math.PI,0);xa.fill()};
 const DEP=v=>'rgb('+Math.round(v*255)+','+Math.round(v*255)+','+Math.round(v*255)+')',D0=DEP(.5),Din=DEP(.3),Din2=DEP(.22),Dout=DEP(.7),Dout2=DEP(.85),Dfr=DEP(.56);
 const stains=(n)=>{for(let i=0;i<n;i++){const a=rnd()*W,b=rnd()*H,w=10+rnd()*40,h=6+rnd()*60;x.fillStyle='rgba(60,50,40,'+(0.03+rnd()*.06)+')';x.fillRect(a,b,w,h)}};
 const plaster=(base,n)=>{rect(base,0,0,W,H,D0,255);speck(x,0,0,W,H,n||900,205,50,.28);const g=x.createLinearGradient(0,0,0,H);g.addColorStop(0,'rgba(0,0,0,.06)');g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,0,W,H);stains(5)};
 const glass=(a,b,w,h,tone)=>{const g=x.createLinearGradient(0,b,0,b+h);g.addColorStop(0,tone?'#8aa3b8':'#6d8296');g.addColorStop(.45,tone?'#4e6478':'#2f3f4d');g.addColorStop(1,'#1c252d');x.fillStyle=g;x.fillRect(a,b,w,h);x.fillStyle='rgba(255,255,255,.18)';x.fillRect(a+w*.08,b+h*.06,w*.18,h*.7);x.fillStyle='rgba(255,255,255,.08)';x.fillRect(a+w*.3,b+h*.06,w*.08,h*.5);xd.fillStyle=Din;xd.fillRect(a,b,w,h);xa.fillStyle=RA(16);xa.fillRect(a,b,w,h)};
 const shutter=(a,b,w,h,c)=>{rect(c,a,b,w,h,Dfr);x.fillStyle='rgba(0,0,0,.28)';for(let y=b+4;y<b+h-3;y+=7)x.fillRect(a+2,y,w-4,2);x.fillStyle='rgba(255,255,255,.08)';x.fillRect(a,b,2,h)};
 const win=(a,b,w,h,o)=>{o=o||{};const fr=o.frame||'#eeeae2';rect(fr,a-6,b-6,w+12,h+12,Dfr,110);if(o.arch){x.fillStyle=fr;x.beginPath();x.arc(a+w/2,b,w/2+6,Math.PI,0);x.fill();xd.fillStyle=Dfr;xd.beginPath();xd.arc(a+w/2,b,w/2+6,Math.PI,0);xd.fill();arcA(a+w/2,b,w/2+6,110)}
  glass(a,b,w,h,o.tone);if(o.arch){const g=x.createLinearGradient(0,b-w/2,0,b);g.addColorStop(0,'#6d8296');g.addColorStop(1,'#4e6478');x.fillStyle=g;x.beginPath();x.arc(a+w/2,b,w/2,Math.PI,0);x.fill();xd.fillStyle=Din;xd.beginPath();xd.arc(a+w/2,b,w/2,Math.PI,0);xd.fill();arcA(a+w/2,b,w/2,16)}
  rect(fr,a+w/2-2,b,4,h,Dfr,110);if(!o.noT)rect(fr,a,b+h*.42,w,3,Dfr);if(o.sill!==false)rect(o.sillC||'#ddd6c8',a-9,b+h,w+18,7,Dout,200);if(o.lintel)rect(o.lintel,a-10,b-14,w+20,9,Dout,200);
  // sporco sotto il davanzale
  x.fillStyle='rgba(50,40,30,.10)';x.fillRect(a-4,b+h+7,w+8,18);
  if(o.sh){shutter(a-6-o.sh,b-3,o.sh,h+6,o.shC||'#3f5a3b');shutter(a+w+6,b-3,o.sh,h+6,o.shC||'#3f5a3b')}
  if(o.blind){rect('#cfc8bb',a-8,b-16,w+16,14,Dout);x.fillStyle='rgba(0,0,0,.18)';for(let y=b-14;y<b-3;y+=4)x.fillRect(a-8,y,w+16,1)}};
 const railing=(a,b,w,h)=>{rect('#4a4d52',a,b,w,3,Dout2,110);rect('#4a4d52',a,b+h-3,w,3,Dout2,110);x.fillStyle='#55585e';xd.fillStyle=Dout2;xa.fillStyle=RA(110);for(let i=a+4;i<a+w;i+=9){x.fillRect(i,b,2,h);xd.fillRect(i,b,2,h);xa.fillRect(i,b,2,h)}};
 const balcony=(a,b,w)=>{rect('#d8d2c6',a,b,w,10,Dout2,200);x.fillStyle='rgba(0,0,0,.28)';x.fillRect(a,b+10,w,10);railing(a+2,b-52,w-4,52)};
 const door=(a,b,w,h,c,arch)=>{rect('#d6d0c4',a-7,b-7,w+14,h+7,Dfr,180);if(arch){x.fillStyle='#d6d0c4';x.beginPath();x.arc(a+w/2,b,w/2+7,Math.PI,0);x.fill();xd.fillStyle=Dfr;xd.beginPath();xd.arc(a+w/2,b,w/2+7,Math.PI,0);xd.fill();arcA(a+w/2,b,w/2+7,180)}rect(c,a,b,w,h,Din2,140);if(arch){x.fillStyle=c;x.beginPath();x.arc(a+w/2,b,w/2,Math.PI,0);x.fill();xd.fillStyle=Din2;xd.beginPath();xd.arc(a+w/2,b,w/2,Math.PI,0);xd.fill();arcA(a+w/2,b,w/2,140)}
  x.fillStyle='rgba(0,0,0,.25)';x.fillRect(a+w*.12,b+h*.12,w*.3,h*.35);x.fillRect(a+w*.58,b+h*.12,w*.3,h*.35);x.fillRect(a+w*.12,b+h*.55,w*.3,h*.35);x.fillRect(a+w*.58,b+h*.55,w*.3,h*.35);rect('#c9b27a',a+w*.5-3,b+h*.52,6,6)};
 const cornice=(y,h,c)=>{rect(c||'#e9e4da',0,y,W,h,Dout2,215);x.fillStyle='rgba(0,0,0,.22)';x.fillRect(0,y+h-3,W,3);x.fillStyle='rgba(255,255,255,.35)';x.fillRect(0,y,W,2);for(let i=0;i<W;i+=16)x.fillRect(i+4,y+h-9,8,4);x.fillStyle='rgba(0,0,0,.12)';x.fillRect(0,y+h,W,10)};
 const base=(y,c)=>{rect(c||'#aaa298',0,y,W,H-y,Dout,200);x.fillStyle='rgba(0,0,0,.18)';x.fillRect(0,y,W,3);for(let i=0;i<W;i+=64)x.fillRect(i+31,y+4,2,H-y);x.fillStyle='rgba(40,35,30,.12)';x.fillRect(0,H-14,W,14)};
 const stone=(c1,c2,bh,bw)=>{rect(c2,0,0,W,H,DEP(.42),255);for(let r=0;r<H/bh+1;r++)for(let q=-1;q<W/bw+1;q++){const g=rnd()*22|0;x.fillStyle='rgb('+(c1[0]+g)+','+(c1[1]+g)+','+(c1[2]+g)+')';x.fillRect(q*bw+(r&1)*bw/2+2,r*bh+2,bw-4,bh-4);xd.fillStyle=D0;xd.fillRect(q*bw+(r&1)*bw/2+2,r*bh+2,bw-4,bh-4)}stains(4)};
 const brick=()=>{rect('#cbb6a4',0,0,W,H,DEP(.45),255);for(let r=0;r<H/9+1;r++)for(let q=-1;q<W/26+1;q++){const t=rnd();x.fillStyle=t<.5?'#c0684b':t<.8?'#b45f43':'#d07a58';x.fillRect(q*26+(r&1)*13+1,r*9+1,24,7);xd.fillStyle=D0;xd.fillRect(q*26+(r&1)*13+1,r*9+1,24,7)}stains(4)};
 const corrug=(c)=>{rect(c,0,0,W,H,D0,120);for(let i=0;i<W;i+=12){x.fillStyle='rgba(0,0,0,.14)';x.fillRect(i,0,4,H);x.fillStyle='rgba(255,255,255,.14)';x.fillRect(i+6,0,3,H);xd.fillStyle=DEP(.42);xd.fillRect(i,0,4,H);xd.fillStyle=DEP(.58);xd.fillRect(i+6,0,3,H)}};
 const spandrel=(y,h)=>{const g=x.createLinearGradient(0,y,0,y+h);g.addColorStop(0,'#5d6670');g.addColorStop(1,'#3a4149');x.fillStyle=g;x.fillRect(0,y,W,h);x.fillStyle='rgba(255,255,255,.12)';x.fillRect(0,y,W,2);xd.fillStyle=Dout;xd.fillRect(0,y,W,h);xa.fillStyle=RA(70);xa.fillRect(0,y,W,h)};
 const mullions=(y0,y1,n)=>{x.fillStyle='#2d3238';xd.fillStyle=Dout;xa.fillStyle=RA(60);for(let i=0;i<=n;i++){x.fillRect(Math.round(i*W/n)-2,y0,4,y1-y0);xd.fillRect(Math.round(i*W/n)-2,y0,4,y1-y0);xa.fillRect(Math.round(i*W/n)-2,y0,4,y1-y0)}};
 const bands=[
  ()=>{plaster('#efebe3');rect('#e3ddd1',0,0,24,H,Dout);rect('#e3ddd1',W-24,0,24,H,Dout);base(222,'#a69d90');door(84,70,88,152,'#5a3a24',true);cornice(0,22)},          // 0 storico: portone ad arco
  ()=>{plaster('#efebe3');win(104,62,52,128,{sh:28,shC:'#3e5839',lintel:'#e6e0d4',sillC:'#e2dccf'});rect('#e4ded2',0,236,W,8,Dout)},                      // 1 storico: finestra con persiane
  ()=>{plaster('#efebe3');win(104,70,52,122,{sh:28,shC:'#3e5839',lintel:'#e6e0d4'});cornice(0,34,'#ebe6dc')},                                             // 2 storico: ultimo piano con cornicione
  ()=>{plaster('#f1eee8',600);base(132,'#8f8a84');for(let i=0;i<W;i+=64)rect('#7f7a74',i,132,2,124,DEP(.4));door(96,96,64,160,'#3b4a5a');rect('#c9ccd1',88,88,80,8,Dout);rect('#20262c',180,150,36,52,Din);x.fillStyle='#8a9096';for(let yy=154;yy<200;yy+=8)x.fillRect(182,yy,32,3)}, // 3 condominio: ingresso e zoccolo
  ()=>{plaster('#f1eee8',600);win(70,74,116,118,{blind:1,noT:1,frame:'#e9e6df'});rect('#e2ddd3',0,236,W,6,Dout)},                                           // 4 condominio: finestra larga (i balconi sono geometria)
  ()=>{plaster('#f1eee8',600);win(70,80,116,112,{blind:1,noT:1,frame:'#e9e6df'});rect('#6a6560',0,0,W,14,Dout2);rect('#8a847c',0,14,W,4,Dout)},   // 5 condominio: ultimo piano con gronda
  ()=>{spandrel(0,28);glass(0,28,W,228,1);mullions(28,256,2);rect('#2d3238',0,250,W,6,Dout)},                                                                        // 6 uffici: vetrata a tutta altezza
  ()=>{spandrel(0,72);glass(0,72,W,160,1);mullions(72,232,2);spandrel(232,24)},                                                                                  // 7 uffici: facciata continua
  ()=>{spandrel(0,80);glass(0,80,W,152,1);mullions(80,232,2);spandrel(232,24);rect('#cfd4d9',0,0,W,12,Dout2)},                                                        // 8 uffici: coronamento
  ()=>{rect('#d8d6d1',0,0,W,H,D0,255);speck(x,0,0,W,H,500,200,40,.3);x.fillStyle='rgba(0,0,0,.12)';x.fillRect(0,128,W,3);rect('#9a9ea2',40,40,176,216,Din);x.fillStyle='rgba(0,0,0,.18)';for(let yy=46;yy<256;yy+=14)x.fillRect(40,yy,176,4);rect('#6f7478',32,32,192,10,Dout);stains(3)},   // 9 industriale: pannelli e portone
  ()=>{corrug('#d9dad6');glass(16,70,224,50,1);rect('#8d9196',10,64,236,4,Dout);rect('#8d9196',10,120,236,4,Dout)},                                                       // 10 industriale: lamiera con finestra a nastro
  ()=>{plaster('#f3eee4');base(226,'#b5aca0');door(28,96,56,130,'#6b4a2c');win(136,80,64,96,{sh:22,shC:'#6d4a2a'})},                                           // 11 casa: porta e finestra con persiane
  ()=>{plaster('#f3eee4');win(96,78,64,100,{sh:22,shC:'#6d4a2a'})},                                                                                               // 12 casa: finestra con persiane
  ()=>{stone([178,160,135],'#9c8e78',40,86);door(92,74,72,182,'#4e3521',true);rect('#c8b99f',0,246,W,10,Dout)},                                                      // 13 pietra: bugnato e portale
  ()=>{brick();win(100,66,56,118,{frame:'#d9cdb6',sill:true,sillC:'#d9cdb6',lintel:'#d9cdb6'})},                                                                 // 14 mattoni: finestra con cornice in pietra
  ()=>{plaster('#efebe3');rect('#2b2f35',0,20,W,36,Dout);rect('#3a3f46',8,26,W-16,24,Dout);for(let i=0;i<W;i+=32){rect(i%64?'#c63b2f':'#eeeae0',i,56,32,22,Dout2)}x.fillStyle='rgba(0,0,0,.2)';x.fillRect(0,76,W,4);rect('#2b2f35',14,80,W-28,176,Dfr);glass(22,88,W-44,160);rect('#2b2f35',W/2-3,88,6,160,Dfr);rect('#9a948a',0,244,W,12,Dout)} ,// 15 negozio: insegna, tenda, vetrina
  ()=>{plaster('#efe9dc',500);stains(6);rect('#e6dfd0',0,0,18,H,Dout,215);rect('#e6dfd0',W-18,0,18,H,Dout,215);const a=104,w=48,b=64,h=146;rect('#d9d0bf',a-8,b,w+16,h+8,Dfr,200);x.fillStyle='#d9d0bf';x.beginPath();x.arc(a+w/2,b,w/2+8,Math.PI,0);x.fill();xd.fillStyle=Dfr;xd.beginPath();xd.arc(a+w/2,b,w/2+8,Math.PI,0);xd.fill();arcA(a+w/2,b,w/2+8,200);
   const g=x.createLinearGradient(0,b-w/2,0,b+h);g.addColorStop(0,'#5d6b7a');g.addColorStop(1,'#2a3038');x.fillStyle=g;x.fillRect(a,b,w,h);x.beginPath();x.arc(a+w/2,b,w/2,Math.PI,0);x.fill();xd.fillStyle=Din;xd.fillRect(a,b,w,h);xd.beginPath();xd.arc(a+w/2,b,w/2,Math.PI,0);xd.fill();xa.fillStyle=RA(16);xa.fillRect(a,b,w,h);arcA(a+w/2,b,w/2,16);
   x.fillStyle='rgba(20,20,20,.5)';for(let yy=b+18;yy<b+h;yy+=22)x.fillRect(a,yy,w,2);x.fillRect(a+w/2-1,b-w/2,2,h+w/2);cornice(0,10,'#e2dbcc');rect('#d6cebe',0,H-14,W,14,Dout,200)},   // 16 chiesa: parete con monofora (vetrata)
  ()=>{brick();const a=40,b=72,h=146;rect('#d8cdb8',a-10,b-6,196,h+16,Dfr,200);for(const ax of [a,a+92]){const aw=84;x.fillStyle='#1a1614';x.fillRect(ax,b,aw,h);x.beginPath();x.arc(ax+aw/2,b,aw/2,Math.PI,0);x.fill();xd.fillStyle=Din2;xd.fillRect(ax,b,aw,h);xd.beginPath();xd.arc(ax+aw/2,b,aw/2,Math.PI,0);xd.fill();xa.fillStyle=RA(150);xa.fillRect(ax,b,aw,h);arcA(ax+aw/2,b,aw/2,150)}
   x.fillStyle='#6b5530';x.beginPath();x.moveTo(a+26,b+72);x.quadraticCurveTo(a+42,b+14,a+58,b+72);x.closePath();x.fill();rect('#cdbfa6',a+84,b-10,8,h+10,Dout,200);rect('#d8cdb8',a-14,b+h,212,10,Dout2,200);cornice(0,12,'#d8cdb8')}   // 17 campanile: cella campanaria (bifora)
 ];
 const c=document.createElement('canvas');c.width=Math.round(W*KS);c.height=Math.round(H*NB*KS);x=c.getContext('2d');const cd=document.createElement('canvas');cd.width=c.width;cd.height=c.height;xd=cd.getContext('2d');const ca=document.createElement('canvas');ca.width=c.width;ca.height=c.height;xa=ca.getContext('2d');
 for(let i=0;i<NB;i++){for(const ctx of [x,xd,xa]){ctx.save();ctx.scale(KS,KS);ctx.translate(0,i*H);ctx.beginPath();ctx.rect(0,0,W,H);ctx.clip()}bands[i]();x.restore();xd.restore();xa.restore()}
 // mappa delle normali dalla profondità (differenze centrali)
 const w=c.width,h=c.height,dd=xd.getImageData(0,0,w,h).data,nm=x.createImageData(w,h),nd=nm.data,k=3.2;
 for(let j=0;j<h;j++)for(let i=0;i<w;i++){const p=j*w+i,l=dd[(j*w+(i>0?i-1:i))*4],r=dd[(j*w+(i<w-1?i+1:i))*4],u=dd[((j>0?j-1:j)*w+i)*4],d=dd[((j<h-1?j+1:j)*w+i)*4];let nx=(l-r)/255*k,ny=(d-u)/255*k,nz=1;const L=Math.hypot(nx,ny,nz);nd[p*4]=Math.round((nx/L*.5+.5)*255);nd[p*4+1]=Math.round((ny/L*.5+.5)*255);nd[p*4+2]=Math.round((nz/L*.5+.5)*255);nd[p*4+3]=255}
 const cn=document.createElement('canvas');cn.width=w;cn.height=h;cn.getContext('2d').putImageData(nm,0,0);
 return{col:c,nor:cn,alpha:ca}})();
const FACTX=(()=>{const c=FAC_PAINT.col,w=c.width,h=c.height,cd=c.getContext('2d').getImageData(0,0,w,h).data,ad=FAC_PAINT.alpha.getContext('2d').getImageData(0,0,w,h).data,o=new Uint8Array(w*h*4);
 for(let j=0;j<h;j++){const sj=(h-1-j)*w*4,dj=j*w*4;for(let i=0;i<w*4;i+=4){o[dj+i]=cd[sj+i];o[dj+i+1]=cd[sj+i+1];o[dj+i+2]=cd[sj+i+2];o[dj+i+3]=ad[sj+i]}}
 const t=new T.DataTexture(o,w,h,T.RGBAFormat);t.encoding=T.sRGBEncoding;t.wrapS=T.RepeatWrapping;t.wrapT=T.ClampToEdgeWrapping;t.generateMipmaps=true;t.minFilter=T.LinearMipmapLinearFilter;t.magFilter=T.LinearFilter;t.anisotropy=Math.min(8,R.capabilities.getMaxAnisotropy());t.needsUpdate=true;return t})(),FACNM=(()=>{const t=new T.CanvasTexture(FAC_PAINT.nor);t.wrapS=T.RepeatWrapping;t.wrapT=T.ClampToEdgeWrapping;t.anisotropy=Math.min(8,R.capabilities.getMaxAnisotropy());return t})();
// coppi: file di tegole curve con ombre, 256 px = 2,5 m
const ROOFTX=tex(cv(256,256,(x)=>{x.fillStyle='#b4583a';x.fillRect(0,0,256,256);for(let r=0;r<10;r++)for(let q=0;q<9;q++){const t=rnd();x.fillStyle=t<.4?'#c0623f':t<.7?'#ad5236':'#cd7550';x.fillRect(q*30+(r&1)*15-15,r*26,28,24);x.fillStyle='rgba(0,0,0,.28)';x.fillRect(q*30+(r&1)*15-15,r*26+18,28,6);x.fillStyle='rgba(255,255,255,.12)';x.fillRect(q*30+(r&1)*15-15+6,r*26+2,10,10)}speck(x,0,0,256,256,900,120,60,.25)}),true,true);
// rumore ripetibile (valore interpolato, periodo 256) a più ottave
const NZ=(()=>{const T2=new Float32Array(256*256);for(let i=0;i<T2.length;i++)T2[i]=rnd();const g=(x,y)=>T2[((y&255)<<8)|(x&255)];const sm=t=>t*t*(3-2*t);
 const one=(x,y)=>{const ix=Math.floor(x),iy=Math.floor(y),fx=sm(x-ix),fy=sm(y-iy),a=g(ix,iy),b=g(ix+1,iy),c=g(ix,iy+1),d=g(ix+1,iy+1);return a+(b-a)*fx+(c-a)*fy+(a-b-c+d)*fx*fy};
 return(x,y,oct,per)=>{let v=0,amp=1,sum=0,f=256/per;for(let o=0;o<oct;o++){v+=one(x*f/256*(1<<o)%256,y*f/256*(1<<o)%256)*amp;sum+=amp;amp*=.5}return v/sum}})();
function groundTex(kind){const N=256,c=document.createElement('canvas');c.width=c.height=N;const x=c.getContext('2d'),im=x.createImageData(N,N),d=im.data;
 for(let j=0;j<N;j++)for(let i=0;i<N;i++){const p=(j*N+i)*4;let r,g,b;const n1=NZ(i,j,4,64),n2=NZ(i+77,j+31,3,16),n3=NZ(i*3,j*3,2,8);
  if(kind==='grass'){const t=n1*.5+n2*.3+n3*.2,v=.72+t*.5,k=.85+NZ(i,j,2,5)*.3;r=255*.84*v*k/1.15;g=255*.90*v/1.15;b=255*.70*v*k/1.15}
  else if(kind==='rock'){const t=n1*.6+n2*.4,cr=Math.abs(NZ(i,j,3,40)-.5)<.012?.55:1,v=(.62+t*.45)*cr;r=255*v*.98;g=255*v*.96;b=255*v*.92}
  else if(kind==='dirt'){const f=.9+.1*Math.sin(j*.9+n2*4),t=n1*.6+n3*.4,v=(.6+t*.5)*f;r=255*v*.98;g=255*v*.84;b=255*v*.66}
  else{const bx=(i&31)<2||(j&31)<2?.72:1,t=n1*.4+n3*.6,v=(.72+t*.35)*bx;r=255*v*.96;g=255*v*.96;b=255*v*.95}
  d[p]=Math.max(0,Math.min(255,r));d[p+1]=Math.max(0,Math.min(255,g));d[p+2]=Math.max(0,Math.min(255,b));d[p+3]=255}
 x.putImageData(im,0,0);return tex(c,true,true)}
const TGRASS=groundTex('grass'),TROCK=groundTex('rock'),TDIRT=groundTex('dirt'),TPAVE=groundTex('pave');
const DTX2=TGRASS;
const MTR={ter:(()=>{const m=new T.MeshStandardMaterial({vertexColors:true,map:TGRASS,roughness:.96,metalness:0});
 m.onBeforeCompile=sh=>{sh.uniforms.tRock={value:TROCK};sh.uniforms.tDirt={value:TDIRT};sh.uniforms.tPave={value:TPAVE};
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute vec4 tw;varying vec4 vTw;').replace('#include <uv_vertex>','#include <uv_vertex>\nvTw=tw;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D tRock;uniform sampler2D tDirt;uniform sampler2D tPave;varying vec4 vTw;')
   .replace('#include <map_fragment>','vec4 tg=texture2D(map,vUv);vec4 tr=texture2D(tRock,vUv*1.9);vec4 td=texture2D(tDirt,vUv*1.4);vec4 tp=texture2D(tPave,vUv*2.3);vec4 texelColor=tg*vTw.x+tr*vTw.y+td*vTw.z+tp*vTw.w;texelColor=mapTexelToLinear(texelColor);diffuseColor*=texelColor;')};
 return m})(),
 road:new T.MeshStandardMaterial({map:ROADTX,roughness:.88,metalness:0,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}),
 misc:new T.MeshStandardMaterial({vertexColors:true,roughness:.9,metalness:0}),
 wat:new T.MeshStandardMaterial({color:lc(0x2a6f86),roughness:.06,metalness:.15,transparent:true,opacity:.88,envMapIntensity:1.6,depthWrite:false}),
 fac:new T.MeshStandardMaterial({vertexColors:true,map:FACTX,normalMap:FACNM,normalScale:new T.Vector2(.9,.9),roughness:.8,metalness:0,envMapIntensity:.45}),
 roof:new T.MeshStandardMaterial({vertexColors:true,map:ROOFTX,roughness:.9,metalness:0}),
 lamp:new T.MeshStandardMaterial({vertexColors:true,roughness:.6,metalness:.5}),
 car:new T.MeshStandardMaterial({vertexColors:true,roughness:.42,metalness:.18,envMapIntensity:.5}),
 farL:new T.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0}),
 farS:new T.MeshStandardMaterial({color:lc(0x2a5f74),roughness:.2,metalness:.1,envMapIntensity:1.2}),
 tree:new T.MeshStandardMaterial({vertexColors:true,roughness:.9,metalness:0})};
// alberi: latifoglia (chioma a icosaedro) e conifera (cono), geometria unica con colori dei vertici
// v31: le chiome a icosaedro hanno normali morbide (di ellissoide) invece di quelle delle facce: meno aspetto a «gemma», stessi triangoli
const TREEG=(()=>{const mk=(parts)=>{const P=[],N=[],Cc=[];for(const [g,col,ty,sx,sy] of parts){const ge=g.index?g.toNonIndexed():g,p=ge.attributes.position.array,n=ge.attributes.normal.array,sm=g.type==='IcosahedronGeometry'||g.type==='IcosahedronBufferGeometry';for(let i=0;i<p.length;i+=3){P.push(p[i]*sx,p[i+1]*sy+ty,p[i+2]*sx);if(sm){const a=p[i]/sx,b=p[i+1]/sy,c=p[i+2]/sx,l=Math.hypot(a,b,c)||1;N.push(a/l,b/l,c/l)}else N.push(n[i],n[i+1],n[i+2]);Cc.push(col[0],col[1],col[2])}}
  const b=new T.BufferGeometry();b.setAttribute('position',new T.Float32BufferAttribute(P,3));b.setAttribute('normal',new T.Float32BufferAttribute(N,3));b.setAttribute('color',new T.Float32BufferAttribute(Cc,3));return b};
 const L=c=>c.map(v=>Math.pow(v,2.2)),trunk=new T.CylinderGeometry(.13,.2,2.6,5,1);
 const trunk2=new T.CylinderGeometry(.2,.28,4.8,6,1);
 const trunkP=new T.CylinderGeometry(.16,.26,7,6,1),trunkO=new T.CylinderGeometry(.22,.36,1.9,6,1),trunkPo=new T.CylinderGeometry(.14,.2,8,5,1);
 return[mk([[trunk,L([.36,.27,.19]),1.3,1,1],[new T.IcosahedronGeometry(1.9,0),L([.30,.45,.20]),3.9,1,.9]]),mk([[trunk,L([.33,.24,.17]),1.3,1,1],[new T.ConeGeometry(1.7,5.2,7),L([.17,.32,.18]),4.4,1,1]]),mk([[trunk2,L([.44,.40,.34]),2.4,1,1],[new T.IcosahedronGeometry(2.6,1),L([.36,.50,.24]),6.3,1,.8],[new T.IcosahedronGeometry(1.5,0),L([.32,.47,.22]),5.4,1.4,.9]]),
  mk([[trunkP,L([.38,.28,.2]),3.5,1,1],[new T.IcosahedronGeometry(1,1),L([.16,.33,.17]),7.6,3.4,1.5]]),mk([[new T.CylinderGeometry(.1,.14,1,5,1),L([.3,.22,.16]),.5,1,1],[new T.ConeGeometry(.85,8.5,7),L([.12,.24,.13]),4.9,1,1]]),mk([[trunkO,L([.3,.26,.22]),.95,1,1],[new T.IcosahedronGeometry(1,1),L([.5,.56,.4]),2.9,2.1,1.2]]),mk([[trunkPo,L([.42,.4,.36]),4,1,1],[new T.IcosahedronGeometry(1,1),L([.36,.52,.24]),9,1.3,5.2]])]})();
// geometria con colori dei vertici da scatole: parts = [x,y,z,w,h,d,[r,g,b]] (y = centro)
function boxesGeo(parts){const P=[],N=[],Cc=[],I=[];let n=0;for(const q of parts){const cx=q[0],cy=q[1],cz=q[2],hx=q[3]/2,hy=q[4]/2,hz=q[5]/2,col=q[6];
 const F=[[[1,0,0],[[hx,-hy,-hz],[hx,hy,-hz],[hx,hy,hz],[hx,-hy,hz]]],[[-1,0,0],[[-hx,-hy,hz],[-hx,hy,hz],[-hx,hy,-hz],[-hx,-hy,-hz]]],[[0,1,0],[[-hx,hy,-hz],[-hx,hy,hz],[hx,hy,hz],[hx,hy,-hz]]],[[0,-1,0],[[-hx,-hy,hz],[-hx,-hy,-hz],[hx,-hy,-hz],[hx,-hy,hz]]],[[0,0,1],[[hx,-hy,hz],[hx,hy,hz],[-hx,hy,hz],[-hx,-hy,hz]]],[[0,0,-1],[[-hx,-hy,-hz],[-hx,hy,-hz],[hx,hy,-hz],[hx,-hy,-hz]]]];
 for(const f of F){for(const v of f[1]){P.push(cx+v[0],cy+v[1],cz+v[2]);N.push(f[0][0],f[0][1],f[0][2]);Cc.push(col[0],col[1],col[2])}I.push(n,n+1,n+2,n,n+2,n+3);n+=4}}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(P,3));g.setAttribute('normal',new T.Float32BufferAttribute(N,3));g.setAttribute('color',new T.Float32BufferAttribute(Cc,3));g.setIndex(I);return g}
const LAMPG=(()=>{const d=[.18,.18,.19].map(v=>Math.pow(v,2.2)),l=[.85,.85,.8].map(v=>Math.pow(v,2.2));return boxesGeo([[0,3.6,0,.16,7.2,.16,d],[0,7.25,.75,.1,.1,1.5,d],[0,7.1,1.45,.4,.18,.7,d],[0,6.98,1.45,.3,.06,.55,l],[0,.12,0,.42,.24,.42,d]])})();
// auto generica (parcheggiate e traffico): bianca dove prende il colore dell'istanza, vetri e gomme scuri; il muso è verso +z.
// Carrozzeria a due volumi: scocca bassa, cofano, abitacolo a tronco di piramide con parabrezza e lunotto inclinati.
function quadGeo(parts,quads){const P=[],N=[],Cc=[],I=[];let n=0;const push=(a,b,c,d,col)=>{const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=d[0]-a[0],vy=d[1]-a[1],vz=d[2]-a[2];let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;const l=Math.hypot(nx,ny,nz)||1;nx/=l;ny/=l;nz/=l;for(const p of [a,b,c,d]){P.push(p[0],p[1],p[2]);N.push(nx,ny,nz);Cc.push(col[0],col[1],col[2])}I.push(n,n+1,n+2,n,n+2,n+3);n+=4};
 for(const q of quads)push(q[0],q[1],q[2],q[3],q[4]);
 const g=boxesGeo(parts),p0=g.attributes.position.array,n0=g.attributes.normal.array,c0=g.attributes.color.array,i0=g.index.array,base=P.length/3;for(let i=0;i<p0.length;i++){P.push(p0[i]);N.push(n0[i]);Cc.push(c0[i])}for(let i=0;i<i0.length;i++)I.push(i0[i]+base);
 const out=new T.BufferGeometry();out.setAttribute('position',new T.Float32BufferAttribute(P,3));out.setAttribute('normal',new T.Float32BufferAttribute(N,3));out.setAttribute('color',new T.Float32BufferAttribute(Cc,3));out.setIndex(I);return out}
const CARG=(()=>{const W=[1,1,1],G=[.05,.07,.09],K=[.03,.03,.035],Lh=[1,1,.85],Lt=[.9,.08,.06],hw=.86,yb=.86,yt=1.42,zb0=-1.95,zb1=1.05,zt0=-1.2,zt1=.35,wt=.78;
 // abitacolo: base (zb0..zb1, ±hw) a yb, tetto (zt0..zt1, ±wt) a yt; facce vetrate e tetto in tinta
 const q=[[[-hw,yb,zb1],[hw,yb,zb1],[wt,yt,zt1],[-wt,yt,zt1],G],   // parabrezza
  [[hw,yb,zb0],[-hw,yb,zb0],[-wt,yt,zt0],[wt,yt,zt0],G],              // lunotto
  [[hw,yb,zb1],[hw,yb,zb0],[wt,yt,zt0],[wt,yt,zt1],G],                // fiancata destra (vetri)
  [[-hw,yb,zb0],[-hw,yb,zb1],[-wt,yt,zt1],[-wt,yt,zt0],G],            // fiancata sinistra
  [[-wt,yt,zt1],[wt,yt,zt1],[wt,yt,zt0],[-wt,yt,zt0],W]];             // tetto
 const g=quadGeo([[0,.62,0,1.78,.5,4.3,W],[0,.9,1.55,1.74,.1,1.4,W],[0,.88,-1.95,1.74,.08,.5,W],[.72,1.1,-.35,.04,.1,2.2,W],[-.72,1.1,-.35,.04,.1,2.2,W],[.55,.64,2.16,.4,.16,.06,Lh],[-.55,.64,2.16,.4,.16,.06,Lh],[.55,.68,-2.16,.46,.14,.06,Lt],[-.55,.68,-2.16,.46,.14,.06,Lt],[0,.36,2.14,1.7,.26,.12,K],[0,.36,-2.14,1.7,.26,.12,K],[.78,.95,.6,.1,.06,.2,K],[-.78,.95,.6,.1,.06,.2,K]],q);
 const parts=[g];for(const [sx,sz] of [[.84,1.38],[-.84,1.38],[.84,-1.38],[-.84,-1.38]]){const w=new T.CylinderGeometry(.33,.33,.22,8);w.rotateZ(Math.PI/2);w.translate(sx,.33,sz);const n=w.attributes.position.count,c=new Float32Array(n*3);for(let i=0;i<n;i++){c[i*3]=K[0];c[i*3+1]=K[1];c[i*3+2]=K[2]}w.setAttribute('color',new T.BufferAttribute(c,3));parts.push(w)}
 const P=[],N=[],Cc=[],I=[];let base=0;for(const q2 of parts){const pos=q2.attributes.position.array,nor=q2.attributes.normal.array,col=q2.attributes.color.array;for(let i=0;i<pos.length;i++){P.push(pos[i]);N.push(nor[i]);Cc.push(col[i])}const idx=q2.index.array;for(let i=0;i<idx.length;i++)I.push(idx[i]+base);base+=q2.attributes.position.count}
 const out=new T.BufferGeometry();out.setAttribute('position',new T.Float32BufferAttribute(P,3));out.setAttribute('normal',new T.Float32BufferAttribute(N,3));out.setAttribute('color',new T.Float32BufferAttribute(Cc,3));out.setIndex(I);return out})();
// oggetti minori da OpenStreetMap: 1 palo della fermata, 2 cestino, 3 cassetta delle lettere, 4 paletto, 5 cabina telefonica
const OBJG=(()=>{const L=c=>c.map(v=>Math.pow(v,2.2)),grey=L([.35,.36,.38]),dark=L([.18,.2,.2]),red=L([.72,.08,.07]),green=L([.16,.33,.2]),glass=L([.5,.6,.68]);
 const cyl=(r,h,y,col,seg)=>{const g=new T.CylinderGeometry(r,r,h,seg||8);g.translate(0,y+h/2,0);const n=g.attributes.position.count,c=new Float32Array(n*3);for(let i=0;i<n;i++){c[i*3]=col[0];c[i*3+1]=col[1];c[i*3+2]=col[2]}g.setAttribute('color',new T.BufferAttribute(c,3));return g};
 const merge=(gs)=>{const P=[],N=[],Cc=[],I=[];let base=0;for(const q of gs){const pos=q.attributes.position.array,nor=q.attributes.normal.array,col=q.attributes.color.array;for(let i=0;i<pos.length;i++){P.push(pos[i]);N.push(nor[i]);Cc.push(col[i])}const idx=q.index.array;for(let i=0;i<idx.length;i++)I.push(idx[i]+base);base+=q.attributes.position.count}const out=new T.BufferGeometry();out.setAttribute('position',new T.Float32BufferAttribute(P,3));out.setAttribute('normal',new T.Float32BufferAttribute(N,3));out.setAttribute('color',new T.Float32BufferAttribute(Cc,3));out.setIndex(I);return out};
 const yel=L([.95,.7,.1]),redL=L([1,.15,.1]),grn=L([.15,.7,.25]),rd=L([.25,.05,.04]),gd=L([.05,.18,.08]),yd=L([.3,.22,.04]);
 const pole2=(()=>{const a=cyl(.06,5.2,0,grey,6),b=cyl(.06,5.2,0,grey,6);a.translate(-2.2,0,0);b.translate(2.2,0,0);return merge([a,b])})();
 const flag=(c1,c2,c3)=>boxesGeo([[0,.12,.85,.05,.05,1.7,grey],[0,-.22,.62,.025,.62,.34,c1],[0,-.22,.96,.025,.62,.34,c2],[0,-.22,1.3,.025,.62,.34,c3]]);
 return{9:flag(L([0,.57,.29]),L([.96,.96,.95]),L([.81,.06,.12])),10:boxesGeo([[0,.12,.85,.05,.05,1.7,grey],[0,-.22,.96,.025,.62,1.02,L([.0,.2,.6])],[0,-.22,.96,.03,.34,.34,L([1,.8,.0])]]),8:pole2,6:merge([cyl(.06,3.5,0,dark,8),boxesGeo([[0,3.4,0,.32,.95,.28,dark],[0,3.68,.15,.2,.2,.04,redL],[0,3.4,.15,.2,.2,.04,yd],[0,3.12,.15,.2,.2,.04,gd],[0,3.85,.1,.36,.06,.3,dark]])]),7:merge([cyl(.03,2.65,0,grey,6)]),1:merge([cyl(.035,2.6,0,grey,6),cyl(.12,.06,0,dark,8)]),2:merge([cyl(.2,.7,.1,green,8),cyl(.04,.1,0,dark,6),cyl(.22,.05,.78,dark,8)]),3:merge([cyl(.035,1,0,dark,6),boxesGeo([[0,1.3,0,.42,.6,.3,red],[0,1.62,0,.46,.05,.34,dark]])]),4:merge([cyl(.08,.95,0,dark,8),cyl(.1,.05,.95,dark,8)]),5:merge([boxesGeo([[0,1.1,0,.9,2.2,.9,glass],[0,2.26,0,.98,.12,.98,dark]])])}})();
const OBJS=new Set([1,2,3,4,5,6,7,8,9,10]);
const CARCOLS=[0xb0b0ac,0x1e2024,0x6f7378,0x9c0d14,0x10285e,0xe6e6e2,0x3f4e5c,0x245a33,0xc8921a,0x5a1e3c,0x8a8d92,0xd1d1cc].map(c=>new T.Color(c).convertSRGBToLinear());
/*@@PBR@@*/
/* ---------- testi veri sulle facciate: insegne dei negozi, targhe delle vie, numeri civici, cartelli delle fermate ---------- */
const PXM=104;   // pixel per metro nell'atlante dei testi
function fitFont(x,txt,maxW,px,weight,fam){let f=px;x.font=weight+' '+f+'px '+fam;while(x.measureText(txt).width>maxW&&f>8){f-=1;x.font=weight+' '+f+'px '+fam}return f}
function mkTexts(items,c){if(!items||!items.length)return null;const W=1024;let rows=[],cur=null;const hpx=it=>Math.round(it.h*PXM);
 const ord=items.slice().sort((a,b)=>hpx(b)-hpx(a));const slots=[];let y=0;
 for(const it of ord){const w=Math.min(W,Math.round(it.w*PXM)+6),h=hpx(it)+4;if(!cur||cur.h!==h||cur.x+w>W){if(cur)y+=cur.h;cur={h,x:0,y};rows.push(cur)}if(y+h>2048)break;slots.push({it,x:cur.x,y:cur.y,w,h});cur.x+=w}
 if(!slots.length)return null;const H=Math.min(2048,1<<Math.ceil(Math.log2(y+(cur?cur.h:0)))),cv2=document.createElement('canvas');cv2.width=W;cv2.height=H;const x=cv2.getContext('2d');x.fillStyle='#777';x.fillRect(0,0,W,H);x.textBaseline='middle';x.textAlign='center';
 for(const s of slots){const it=s.it,X=s.x+3,Y=s.y+2,w=s.w-6,h=s.h-4;
  if(it.k==='ins'){const g=x.createLinearGradient(0,Y,0,Y+h);g.addColorStop(0,it.bg);g.addColorStop(1,'#000');x.fillStyle=it.bg;x.fillRect(X,Y,w,h);x.fillStyle='rgba(0,0,0,.25)';x.fillRect(X,Y+h-6,w,6);x.fillStyle='rgba(255,255,255,.18)';x.fillRect(X,Y,w,3);
   const sub=it.sub&&it.sub!==it.txt?it.sub:'';x.fillStyle=it.fg;const f=fitFont(x,it.txt,w-16,sub?h*.55:h*.72,'700','system-ui,Arial,sans-serif');x.fillText(it.txt,X+w/2,Y+(sub?h*.38:h*.5));if(sub){fitFont(x,sub,w-16,h*.26,'500','system-ui,Arial,sans-serif');x.fillStyle=it.fg;x.globalAlpha=.85;x.fillText(sub,X+w/2,Y+h*.8);x.globalAlpha=1}}
  else if(it.k==='via'){x.fillStyle='#f3f1ea';x.fillRect(X,Y,w,h);x.strokeStyle='#15151a';x.lineWidth=2;x.strokeRect(X+2,Y+2,w-4,h-4);x.fillStyle='#15151a';fitFont(x,it.txt.toUpperCase(),w-12,h*.62,'700','Georgia,"Times New Roman",serif');x.fillText(it.txt.toUpperCase(),X+w/2,Y+h/2+1)}
  else if(it.k==='civ'){x.fillStyle='#f6f4ee';x.fillRect(X,Y,w,h);x.strokeStyle='#1c2b6b';x.lineWidth=2;x.strokeRect(X+1,Y+1,w-2,h-2);x.fillStyle='#1c2b6b';fitFont(x,it.txt,w-6,h*.78,'700','system-ui,Arial,sans-serif');x.fillText(it.txt,X+w/2,Y+h/2+1)}
  else if(it.k==='ico'){if(it.ico==='oneway'){x.fillStyle='#1f5fb4';x.fillRect(X,Y,w,h);x.fillStyle='#fff';x.beginPath();x.moveTo(X+w/2,Y+h*.12);x.lineTo(X+w*.82,Y+h*.45);x.lineTo(X+w*.62,Y+h*.45);x.lineTo(X+w*.62,Y+h*.88);x.lineTo(X+w*.38,Y+h*.88);x.lineTo(X+w*.38,Y+h*.45);x.lineTo(X+w*.18,Y+h*.45);x.closePath();x.fill()}else{x.fillStyle='#777';x.fillRect(X,Y,w,h);x.fillStyle='#c8102e';x.beginPath();x.arc(X+w/2,Y+h/2,Math.min(w,h)*.48,0,6.3);x.fill();x.fillStyle='#fff';x.fillRect(X+w*.2,Y+h*.42,w*.6,h*.16)}}
  else if(it.k==='ros'){x.clearRect(X-3,Y-2,w+6,h+4);const cx=X+w/2,cy=Y+h/2,r=Math.min(w,h)/2-2;x.fillStyle='#d9d0bf';x.beginPath();x.arc(cx,cy,r,0,6.2832);x.fill();x.fillStyle='#26304a';x.beginPath();x.arc(cx,cy,r*.82,0,6.2832);x.fill();const cs=['#8a2433','#244a8a','#b8902e','#2f6f3e','#6a2f7a'];for(let i=0;i<16;i++){const a0=i/16*6.2832,a1=(i+1)/16*6.2832;x.fillStyle=cs[i%5];x.beginPath();x.moveTo(cx,cy);x.arc(cx,cy,r*.78,a0+.04,a1-.04);x.closePath();x.fill()}
   x.strokeStyle='#d9d0bf';x.lineWidth=Math.max(2,r*.07);for(let i=0;i<16;i++){const a=i/16*6.2832;x.beginPath();x.moveTo(cx+Math.cos(a)*r*.22,cy+Math.sin(a)*r*.22);x.lineTo(cx+Math.cos(a)*r*.8,cy+Math.sin(a)*r*.8);x.stroke()}x.beginPath();x.arc(cx,cy,r*.5,0,6.2832);x.stroke();x.fillStyle='#d9d0bf';x.beginPath();x.arc(cx,cy,r*.22,0,6.2832);x.fill()}
  else if(it.k==='portale'){x.clearRect(X-3,Y-2,w+6,h+4);const aw=w,ar=aw/2;x.fillStyle='#cfc4ae';x.beginPath();x.moveTo(X,Y+h);x.lineTo(X,Y+ar);x.arc(X+ar,Y+ar,ar,Math.PI,0);x.lineTo(X+w,Y+h);x.closePath();x.fill();const ix=X+aw*.14,iw=aw*.72,ir=iw/2,iy=Y+aw*.14;x.fillStyle='#4a2f1c';x.beginPath();x.moveTo(ix,Y+h);x.lineTo(ix,iy+ir);x.arc(ix+ir,iy+ir,ir,Math.PI,0);x.lineTo(ix+iw,Y+h);x.closePath();x.fill();
   x.fillStyle='rgba(0,0,0,.28)';for(let k=1;k<4;k++)x.fillRect(ix+iw*k/4-1,iy+ir,2,h-ir-(iy-Y));for(let k=1;k<5;k++)x.fillRect(ix,iy+ir+(h-ir-(iy-Y))*k/5,iw,2);x.fillStyle='#2a1a10';x.fillRect(ix+iw/2-1.5,iy+ir*.6,3,h);x.fillStyle='#b59a5a';x.fillRect(ix+iw/2-6,Y+h*.6,4,4);x.fillRect(ix+iw/2+2,Y+h*.6,4,4)}
  else if(it.k==='ico'&&it.ico==='croce'){x.fillStyle='#ffffff';x.fillRect(X,Y,w,h);x.fillStyle='#d32f2f';x.fillRect(X+w*.38,Y+h*.12,w*.24,h*.76);x.fillRect(X+w*.12,Y+h*.38,w*.76,h*.24)}
  else if(it.k==='ico'&&it.ico==='orologio'){x.clearRect(X-3,Y-2,w+6,h+4);const cx=X+w/2,cy=Y+h/2,r=Math.min(w,h)/2-2;x.fillStyle='#2a2a2e';x.beginPath();x.arc(cx,cy,r,0,6.2832);x.fill();x.fillStyle='#f4f1e8';x.beginPath();x.arc(cx,cy,r*.88,0,6.2832);x.fill();x.fillStyle='#222';for(let i=0;i<12;i++){const a=i/12*6.2832;x.save();x.translate(cx+Math.cos(a)*r*.74,cy+Math.sin(a)*r*.74);x.rotate(a);x.fillRect(-r*.08,-r*.02,r*.16,r*.04);x.restore()}
   const now=new Date(),hh=(now.getHours()%12+now.getMinutes()/60)/12*6.2832-1.5708,mm=now.getMinutes()/60*6.2832-1.5708;x.strokeStyle='#111';x.lineCap='round';x.lineWidth=r*.09;x.beginPath();x.moveTo(cx,cy);x.lineTo(cx+Math.cos(hh)*r*.45,cy+Math.sin(hh)*r*.45);x.stroke();x.lineWidth=r*.06;x.beginPath();x.moveTo(cx,cy);x.lineTo(cx+Math.cos(mm)*r*.7,cy+Math.sin(mm)*r*.7);x.stroke()}
  else if(it.k==='bus'){x.fillStyle='#f5a300';x.fillRect(X,Y,w,h);x.fillStyle='#1a1a1a';x.fillRect(X+w*.2,Y+h*.14,w*.6,h*.34);x.fillStyle='#f5a300';x.fillRect(X+w*.26,Y+h*.19,w*.2,h*.14);x.fillRect(X+w*.54,Y+h*.19,w*.2,h*.14);x.fillStyle='#1a1a1a';x.beginPath();x.arc(X+w*.3,Y+h*.5,w*.05,0,6.3);x.arc(X+w*.7,Y+h*.5,w*.05,0,6.3);x.fill();fitFont(x,it.txt,w-6,h*.22,'700','system-ui,Arial,sans-serif');x.fillStyle='#1a1a1a';x.fillText(it.txt,X+w/2,Y+h*.76)}}
 const t=new T.CanvasTexture(cv2);t.encoding=T.sRGBEncoding;t.anisotropy=Math.min(8,R.capabilities.getMaxAnisotropy());t.generateMipmaps=true;t.minFilter=T.LinearMipmapLinearFilter;
 const P=[],N=[],U=[],I=[];let n=0;
 for(const s of slots){const it=s.it,u0=(s.x+3)/W,u1=(s.x+s.w-3)/W,v1=1-(s.y+2)/H,v0=1-(s.y+s.h-2)/H;
  let nx=-it.nx,nz=-it.nz;if(!nx&&!nz){nx=0;nz=1}const cx=-it.u+nx*.06,cz=-it.v+nz*.06,rx=nz,rz=-nx,hw=it.w/2,hh=it.h/2;   // normale e "destra" in coordinate del gioco
  const add=(sgn)=>{const a=[cx-rx*hw*sgn,it.y-hh,cz-rz*hw*sgn],b=[cx+rx*hw*sgn,it.y-hh,cz+rz*hw*sgn],c2=[cx+rx*hw*sgn,it.y+hh,cz+rz*hw*sgn],d=[cx-rx*hw*sgn,it.y+hh,cz-rz*hw*sgn];for(const p of [a,b,c2,d]){P.push(p[0],p[1],p[2]);N.push(nx*sgn,0,nz*sgn)}U.push(u0,v0,u1,v0,u1,v1,u0,v1);I.push(n,n+1,n+2,n,n+2,n+3);n+=4};
  add(1);if(it.free)add(-1)}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(P,3));g.setAttribute('normal',new T.Float32BufferAttribute(N,3));g.setAttribute('uv',new T.Float32BufferAttribute(U,2));g.setIndex(I);g.computeBoundingSphere();
 const m=new T.Mesh(g,new T.MeshStandardMaterial({map:t,roughness:.55,metalness:0,alphaTest:.5,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3}));m.matrixAutoUpdate=false;m.castShadow=false;m.receiveShadow=false;m.userData.tex=t;return m}
/* ---------- cielo: cupola con gradiente, sole e nuvole (rumore), fissa attorno alla telecamera ---------- */
const SKY=(()=>{const W=1024,H=512,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');const g=x.createLinearGradient(0,0,0,H);g.addColorStop(0,'#2a66c4');g.addColorStop(.35,'#6fa3e6');g.addColorStop(.55,'#b9d4f2');g.addColorStop(.62,'#e3edf7');g.addColorStop(1,'#dfe9f4');x.fillStyle=g;x.fillRect(0,0,W,H);
 const su=.0986*W,sv=.21*H;const rg=x.createRadialGradient(su,sv,0,su,sv,140);rg.addColorStop(0,'rgba(255,252,235,1)');rg.addColorStop(.08,'rgba(255,248,220,.95)');rg.addColorStop(.3,'rgba(255,240,200,.35)');rg.addColorStop(1,'rgba(255,240,200,0)');x.fillStyle=rg;x.fillRect(su-140,sv-140,280,280);
 const im=x.getImageData(0,0,W,H),d=im.data;for(let j=0;j<H*.6;j++)for(let i=0;i<W;i++){const t=j/H,n=NZ(i*.5,j*.9,5,120)*.6+NZ(i*.5+300,j*.9+100,3,30)*.4,cov=Math.max(0,(n-.52)/.22)*Math.min(1,(t-.08)/.2)*Math.min(1,(.6-t)/.1);if(cov<=0)continue;const a=Math.min(1,cov),sh=.82+.18*Math.min(1,(n-.5)*4),p=(j*W+i)*4;d[p]=d[p]*(1-a)+255*sh*a;d[p+1]=d[p+1]*(1-a)+252*sh*a;d[p+2]=d[p+2]*(1-a)+250*sh*a}
 x.putImageData(im,0,0);const t=new T.CanvasTexture(c);t.encoding=T.sRGBEncoding;const m=new T.Mesh(new T.SphereGeometry(9000,48,24),new T.MeshBasicMaterial({map:t,side:T.BackSide,fog:false,depthWrite:false}));m.renderOrder=-10;m.frustumCulled=false;sc.add(m);return m})();
/*@@CIELO@@*/
/* ---------- lavoratori in sottofondo ---------- */
const WK=[],JOBS=new Map(),QUEUE=[],INF=new Map(),RES=[];let jid=1,NW=0;
const ERR={n:0,msg:'',t:0,net:0};
function mkWorkers(){const el=document.getElementById('realw');if(!el){ERR.msg='codice del caricatore mancante';return}
 const url=URL.createObjectURL(new Blob([el.textContent],{type:'text/javascript'}));NW=Math.max(1,Math.min(2,(navigator.hardwareConcurrency||2)-1));
 for(let i=0;i<NW;i++){const w=new Worker(url);w.n=0;w.onmessage=e=>done(e.data);w.onerror=e=>{ERR.msg='errore interno del caricatore: '+(e.message||'');ERR.n++};WK.push(w)}}
function cfgAll(){for(const w of WK)w.postMessage({t:'cfg',cfg:{vt:CFG.vt,dem:CFG.dem,demType:CFG.demType,demMax:CFG.demMax,K,lc:COP.on?CFG.lc:''}})}
function pump(){if(!WK.length)return;QUEUE.sort((a,b)=>a.pri-b.pri);
 while(QUEUE.length){const j=QUEUE[0];let wi=j.t==='mappa'?(j.x*7+j.y*13)%NW:((j.x>>1)*7+(j.y>>1)*13)%NW;if(WK[wi].n>=3){let b=-1,bn=99;for(let i=0;i<NW;i++)if(WK[i].n<bn){bn=WK[i].n;b=i}if(bn>=3)break;wi=b}
  QUEUE.shift();j.id=jid++;j.gen=GEN;j.wi=wi;JOBS.set(j.id,j);INF.set(j.ik,j.id);WK[wi].n++;if(j.t==='mappa'){const e=MT2.get(j.key);if(e)e.sent=1}WK[wi].postMessage({t:j.t,id:j.id,z:j.z,x:j.x,y:j.y,lod:j.lod,N:j.N,zd:j.zd,px:j.px})}}
function done(r){const j=JOBS.get(r.id);if(!j)return;JOBS.delete(r.id);WK[j.wi].n--;if(INF.get(j.ik)===j.id)INF.delete(j.ik);
 if(!r.ok){ERR.n++;ERR.msg=r.err;ERR.t=performance.now();if(r.net)ERR.net++;if(j.t==='mappa'){const e=MT2.get(j.key);if(e){e.pending=0;e.sent=0;e.fail=performance.now()}}else if(j.gen===GEN){j.tries=(j.tries||0)+1;j.retryAt=performance.now()+Math.min(15000,1500*j.tries);RETRY.push(j)}return}
 ERR.net=0;if(j.t==='mappa'){mapTileDone(j,r.res);return}if(j.gen!==GEN)return;RES.push([j,r.res])}
const RETRY=[];
/* ---------- celle vicine e blocchi lontani ---------- */
const CELLS=new Map(),FARS=new Map();let PC=[1e9,1e9];const STATS={cells:0,tri:0,last:0,ms:[],net:null};
function cellAtM(mx,my){return CELLS.get(key2(Math.floor((mx+MH)/S15),Math.floor((MH-my)/S15)))}
function cellAt(x,z){return cellAtM(OX-x/K,OY+z/K)}
let PLP=[1e9,1e9];
function plan(px,pz){const m=g2m(px,pz),cx=Math.floor((m[0]+MH)/S15),cy=Math.floor((MH-m[1])/S15);if(cx===PC[0]&&cy===PC[1]&&!plan.force&&Math.hypot(px-PLP[0],pz-PLP[1])<150)return;plan.force=false;PC=[cx,cy];PLP=[px,pz];const bx=cx>>1,by=cy>>1;
 for(const [k,c] of CELLS)if(Math.max(Math.abs(c.x-cx),Math.abs(c.y-cy))>5)dropCell(k);
 for(const [k,f] of FARS)if(Math.max(Math.abs(f.x-bx),Math.abs(f.y-by))>FR+1)dropFar(k);
 QUEUE.length=0;const want=new Set();
 const dist=(x,y)=>{const x0=-MH+x*S15,x1=x0+S15,y1=MH-y*S15,y0=y1-S15,dx=Math.max(x0-m[0],0,m[0]-x1),dy=Math.max(y0-m[1],0,m[1]-y1);return Math.hypot(dx,dy)*K};
 for(let y=2*(by-1);y<=2*(by+1)+1;y++)for(let x=2*(bx-1);x<=2*(bx+1)+1;x++){const d=Math.max(Math.abs(x-cx),Math.abs(y-cy)),dm=dist(x,y),lod=dm<520?'A':'B',k=key2(x,y),c=CELLS.get(k);want.add(k);
  if(c&&(c.lod===lod||(c.lod==='A'&&dm<760)))continue;const ik='c'+k+lod;if(INF.has(ik))continue;QUEUE.push({t:'cella',ik,key:k,z:15,x,y,lod,pri:(lod==='A'?0:20)+dm/300})}
 for(let y=by-FR;y<=by+FR;y++)for(let x=bx-FR;x<=bx+FR;x++){const k=key2(x,y),d=Math.max(Math.abs(x-bx),Math.abs(y-by)),ik='f'+k;if(FARS.has(k)||INF.has(ik))continue;QUEUE.push({t:'lontano',ik,key:k,z:14,x,y,N:17,zd:11,pri:d<=1?6+d:25+d})}
 {const now=performance.now(),keep=[];for(const j of RETRY.splice(0)){if(j.gen!==GEN)continue;if(j.retryAt>now){keep.push(j);continue}if(!INF.has(j.ik)&&!QUEUE.some(q=>q.ik===j.ik))QUEUE.push({t:j.t,ik:j.ik,key:j.key,z:j.z,x:j.x,y:j.y,lod:j.lod,N:j.N,zd:j.zd,pri:j.pri+3,tries:j.tries})}RETRY.push(...keep)}
 for(const e of MT2.values())if(e.pending&&!e.sent)QUEUE.push(e.job);
 pump()}
function geom(o,uv){const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(o.P,3));g.setAttribute('normal',new T.BufferAttribute(o.N,3));g.setAttribute('color',new T.BufferAttribute(o.C,3));if(uv&&o.U)g.setAttribute('uv',new T.BufferAttribute(o.U,2));if(o.W)g.setAttribute('tw',new T.BufferAttribute(o.W,4));g.setIndex(new T.BufferAttribute(o.I,1));g.computeBoundingSphere();return g}
const _m4=new T.Matrix4(),_v=new T.Vector3(),_s=new T.Vector3(),_q=new T.Quaternion(),_y=new T.Vector3(0,1,0),_c=new T.Color();
function mkCell(j,r){const mxL=-MH+j.x*S15,myT=MH-j.y*S15,g0=m2g(mxL,myT),X=g0[0],Z=g0[1],g=new T.Group();g.position.set(X,0,Z);g.updateMatrix();g.matrixAutoUpdate=false;
 const c={x:j.x,y:j.y,key:j.key,lod:j.lod,g,X,Z,S:r.S,NG:r.NG,d:r.S/(r.NG-1),H:r.H,cls:r.cls,CR:r.CR,wm:r.wmask,WM:r.WM,RH:r.RH,RH2:r.RH2,RHB:r.RHB||0,RHN:r.RHN,GM:r.GM,GMN:r.GMN,keys:new Set(),bk:new Set(),places:[],pois:[],mini:r.mini,tri:0};
 const add=(o,mt,cast,uv)=>{if(!o||!o.I||!o.I.length)return null;const me=new T.Mesh(geom(o,uv),mt);me.castShadow=!!cast;me.receiveShadow=true;me.matrixAutoUpdate=false;g.add(me);c.tri+=o.I.length/3;return me};
 add(r.T,MTR.ter,0,1);add(r.R,MTR.road,0,1);for(const k of ['Rst','Rdi','Rba','Rsw'])add(r[k],PBR.RMAT[k],0,1);add(r.Mc,MTR.conc,1,0);add(r.MS,MTR.mur,1,1);add(r.HG,MTR.siepe,1,0);add(r.M,MTR.misc,0,0);
 {let u=0,w=0;const cl=r.cls;if(cl){for(let i=0;i<cl.length;i++){if(cl[i]===2||cl[i]===11)u++;else if(cl[i]===1)w++}c.urb=Math.max(u/Math.max(1,cl.length-w),(r.dens||0)*1.5)}c.dens=r.dens||0;c.chiese=[];const ch=r.chiese||[];for(let i=0;i+2<ch.length;i+=3)c.chiese.push({x:X-ch[i],z:Z-ch[i+1],y:ch[i+2]})}
 {c.rot=[];const rb=r.rotatorie||[];for(let i=0;i+3<rb.length;i+=4)c.rot.push({x:X-rb[i],z:Z-rb[i+1],r:rb[i+2],y:rb[i+3]})}{const w=add(r.W,MTR.wat,0,0);if(w){w.receiveShadow=false;w.renderOrder=2}}
 for(const o of r.BW||[])add(o,MTR.fac,1,1);for(const o of r.BR||[])add(o,MTR.roof,1,1);c.nav=r.nav||[];c.NR=r.NR;c.names=r.names||[];
 {const tm=mkTexts(r.texts,c);if(tm){g.add(tm);c.tri+=tm.geometry.index.count/3}}
 {const ob=r.objs;if(ob&&ob.length){const by={};for(let i=0;i<ob.length;i+=6){const k=ob[i];(by[k]||(by[k]=[])).push(i)}for(const k in by){const ge=OBJG[k];if(!ge)continue;const idx=by[k],im=new T.InstancedMesh(ge.clone(),MTR.lamp,idx.length);idx.forEach((i,q)=>{_v.set(-ob[i+1],ob[i+2],-ob[i+3]);_q.setFromAxisAngle(_y,ob[i+4]);_s.set(ob[i+5]||1,1,1);_m4.compose(_v,_q,_s);im.setMatrixAt(q,_m4);if(k==1||k==3||k==4||k==5||k==6||k==7)csoAdd(c,{x:X-ob[i+1],z:Z-ob[i+3],c:1,s:0,hx:k==5?.45:.12,hz:k==5?.45:.12,top:k==5?2.3:k==6?3.8:1.2,yb:ob[i+2]-.3,yt:ob[i+2]+(k==5?2.3:k==6?3.8:1.2),cell:c})});im.instanceMatrix.needsUpdate=true;im.castShadow=false;im.matrixAutoUpdate=false;im.frustumCulled=false;g.add(im);c.tri+=idx.length*ge.index.count/3}}}
 // lampioni e auto in sosta (istanze); le auto in sosta sono anche ostacoli
 // v31: lampioni, auto in sosta, alberi e oggetti portano la loro quota (yb, yt): non fermano chi passa in galleria sotto la via o sul viadotto sopra
 {const la=r.lamps;if(la&&la.length){const n=la.length/4,im=new T.InstancedMesh(LAMPG.clone(),MTR.lamp,n);for(let i=0;i<n;i++){_v.set(la[i*4],la[i*4+1],la[i*4+2]);_q.setFromAxisAngle(_y,la[i*4+3]);_s.set(1,1,1);_m4.compose(_v,_q,_s);im.setMatrixAt(i,_m4);csoAdd(c,{x:X+la[i*4],z:Z+la[i*4+2],c:1,s:0,hx:.12,hz:.12,top:7,yb:la[i*4+1]-.3,yt:la[i*4+1]+7,cell:c})}im.instanceMatrix.needsUpdate=true;im.castShadow=false;im.matrixAutoUpdate=false;im.frustumCulled=false;g.add(im);c.tri+=n*LAMPG.index.count/3;CIELO.poolsFor(c,la,X,Z)}}
 {const pa=r.parked;if(pa&&pa.length){const n=pa.length/5,im=new T.InstancedMesh(CARG.clone(),MTR.car,n);for(let i=0;i<n;i++){const h=pa[i*5+3];_v.set(pa[i*5],pa[i*5+1],pa[i*5+2]);_q.setFromAxisAngle(_y,h);_s.set(1,1,1);_m4.compose(_v,_q,_s);im.setMatrixAt(i,_m4);im.setColorAt(i,CARCOLS[pa[i*5+4]%CARCOLS.length]);csoAdd(c,{x:X+pa[i*5],z:Z+pa[i*5+2],c:Math.sin(h),s:Math.cos(h),hx:2.2,hz:.92,top:1.5,yb:pa[i*5+1]-.3,yt:pa[i*5+1]+1.5,amb:1,pk:1,cell:c,parked:1})}im.instanceMatrix.needsUpdate=true;if(im.instanceColor)im.instanceColor.needsUpdate=true;im.castShadow=true;im.matrixAutoUpdate=false;im.frustumCulled=false;g.add(im);c.tri+=n*CARG.index.count/3}}
 // alberi: istanze per tipo, con una sfera di ingombro che copre tutte le istanze della cella
 const tr=r.trees;if(tr&&tr.length){for(const ty of [0,1,2,3,4,5,6]){let n=0;for(let i=4;i<tr.length;i+=5)if(tr[i]===ty)n++;if(!n)continue;const ge=TREEG[ty].clone(),im=new T.InstancedMesh(ge,MTR.tree,n);let q=0,mx=0,mz=0,my=0;
   for(let i=0;i<tr.length;i+=5){if(tr[i+4]!==ty)continue;const s=tr[i+3],a=(i*0.618)%6.283;_v.set(tr[i],tr[i+1]-.2,tr[i+2]);_q.setFromAxisAngle(_y,a);_s.set(s,s*(.85+((i*7)%10)*.04),s);_m4.compose(_v,_q,_s);im.setMatrixAt(q,_m4);
    const f=.82+((i*13)%17)/17*.36;_c.setRGB(f,f*(.95+((i*3)%5)*.02),f);im.setColorAt(q,_c);q++;mx+=tr[i];my+=tr[i+1];mz+=tr[i+2];
    csoAdd(c,{x:X+tr[i],z:Z+tr[i+2],c:1,s:0,hx:.22*s,hz:.22*s,top:6*s,yb:tr[i+1]-.5,yt:tr[i+1]+6*s,cell:c,tree:1})}
   mx/=n;my/=n;mz/=n;let rr=0;for(let i=0;i<tr.length;i+=5){if(tr[i+4]!==ty)continue;rr=Math.max(rr,Math.hypot(tr[i]-mx,tr[i+1]-my,tr[i+2]-mz))}
   ge.boundingSphere=new T.Sphere(new T.Vector3(mx,my,mz),rr+12);im.instanceMatrix.needsUpdate=true;if(im.instanceColor)im.instanceColor.needsUpdate=true;im.castShadow=false;im.receiveShadow=true;im.matrixAutoUpdate=false;g.add(im);c.tri+=n*ge.attributes.position.count/3}}
 // muri degli edifici come scatole orientate per le collisioni (auto, persone, telecamera, colpi)
 // v31: ogni muro porta la quota assoluta della base e della cima (yb, yt): le collisioni non fermano chi passa sopra o sotto (galleria sotto un
 // edificio, strada sopra una galleria, viadotto sopra un muretto)
 const W=r.walls,WY=r.wallsY;if(W)for(let i=0,w=0;i+5<W.length;i+=6,w++){const b={x:X-W[i],z:Z-W[i+1],c:-W[i+2],s:-W[i+3],hx:W[i+4]+.05,hz:.25,top:W[i+5]+1,cell:c};if(WY&&WY.length>w*2+1){b.yb=WY[w*2];b.yt=WY[w*2+1]}csoAdd(c,b)}
 // v31: guardrail e parapetti dei ponti sono ostacoli bassi con la loro quota (prima si attraversavano); telecamera e vista della polizia li ignorano
 const RL=r.rails;if(RL)for(let i=0;i+6<RL.length;i+=7)csoAdd(c,{x:X-RL[i],z:Z-RL[i+1],c:-RL[i+2],s:-RL[i+3],hx:RL[i+4]+.06,hz:.14,top:1,lo:1,rail:1,yb:RL[i+5],yt:RL[i+6],cell:c});
 for(const b of r.bridges||[]){const p=b.pts,h=b.h;for(let q=0;q+3<p.length;q+=2)brAdd(c,{ax:X-p[q],az:Z-p[q+1],bx:X-p[q+2],bz:Z-p[q+3],ha:h[q/2],hb:h[q/2+1],hw:b.hw,tun:!!b.tun})}
 for(const p of r.places||[]){c.places.push({x:X+p.x,z:Z+p.z,name:p.name,cl:p.cl});const mm=g2m(X+p.x,Z+p.z);addPlace(mm[0],mm[1],p.name,p.cl)}
 for(const p of r.pois||[])c.pois.push({x:X+p.x,z:Z+p.z,name:p.name,cl:p.cl});
 return c}
const CSO2=new Map(),BRG=new Map();
function csoAdd(c,b){const r=Math.max(b.hx,b.hz)+1.2,x0=Math.floor((b.x-r)/32),x1=Math.floor((b.x+r)/32),z0=Math.floor((b.z-r)/32),z1=Math.floor((b.z+r)/32);
 for(let i=x0;i<=x1;i++)for(let j=z0;j<=z1;j++){const k=i+','+j;let a=CSO2.get(k);if(!a)CSO2.set(k,a=[]);a.push(b);c.keys.add(k)}}
function brAdd(c,s){const r=s.hw+1,x0=Math.floor((Math.min(s.ax,s.bx)-r)/64),x1=Math.floor((Math.max(s.ax,s.bx)+r)/64),z0=Math.floor((Math.min(s.az,s.bz)-r)/64),z1=Math.floor((Math.max(s.az,s.bz)+r)/64);s.cell=c;
 for(let i=x0;i<=x1;i++)for(let j=z0;j<=z1;j++){const k=i+','+j;let a=BRG.get(k);if(!a)BRG.set(k,a=[]);a.push(s);c.bk.add(k)}}
function dropCell(k){const c=CELLS.get(k);if(!c)return;sc.remove(c.g);if(c.pools)CIELO.POOLS.delete(c.pools);c.g.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.userData&&o.userData.tex){o.userData.tex.dispose();o.material.dispose()}});
 for(const q of c.keys){const a=CSO2.get(q);if(!a)continue;const b=a.filter(s=>s.cell!==c);if(b.length)CSO2.set(q,b);else CSO2.delete(q)}
 for(const q of c.bk){const a=BRG.get(q);if(!a)continue;const b=a.filter(s=>s.cell!==c);if(b.length)BRG.set(q,b);else BRG.delete(q)}
 CELLS.delete(k);farVisDirty=true}
function dropFar(k){const f=FARS.get(k);if(!f)return;sc.remove(f.me);f.me.geometry.dispose();satRelease(f);FARS.delete(k)}
function dropAll(){for(const k of Array.from(CELLS.keys()))dropCell(k);for(const k of Array.from(FARS.keys()))dropFar(k);QUEUE.length=0;RES.length=0;RETRY.length=0;INF.clear();PC=[1e9,1e9]}
// terreno lontano con l'immagine Sentinel-2 (mosaico a colori veri 2021 di ESA WorldCover, tile z13 condivise da 4 blocchi)
const tplZ=(t,z,x,y)=>t.replace('{zz}',String(z).padStart(2,'0')).replace('{z}',z).replace('{x}',x).replace('{y}',y);
function satFor(f){if(!COP.on||COP.fail>3)return;const k=(f.x>>1)+'/'+(f.y>>1);let e=COP.cache.get(k);
 if(!e){e={n:0,mat:null,tex:null,wait:[]};COP.cache.set(k,e);const L=new T.TextureLoader();L.setCrossOrigin('anonymous');
  L.load(tplZ(CFG.sat,13,f.x>>1,f.y>>1),t=>{t.encoding=T.sRGBEncoding;t.anisotropy=4;e.tex=t;e.mat=new T.MeshStandardMaterial({map:t,roughness:1,metalness:0,color:new T.Color(1.12,1.12,1.12)});COP.ok++;COP.fail=0;for(const g of e.wait)if(g.me&&FARS.get(g.key)===g)g.me.material=[e.mat,MTR.farS];e.wait.length=0},undefined,()=>{COP.fail++;e.dead=1})}
 e.n++;f.sat=k;if(e.mat)f.me.material=[e.mat,MTR.farS];else if(!e.dead)e.wait.push(f)}
function satRelease(f){if(!f.sat)return;const k=f.sat,e=COP.cache.get(k);f.sat=null;if(!e)return;if(--e.n<=0){if(e.tex)e.tex.dispose();if(e.mat)e.mat.dispose();COP.cache.delete(k)}}
// «Dati zona»: salva in un file i dati pubblici che il gioco ha già scaricato per il posto in cui ti trovi (tile vettoriali OpenMapTiles z14 3×3,
// rilievo Mapterhorn z12, copertura WorldCover se attiva) con la posizione: serve a riprodurre esattamente un difetto visto nel gioco.
async function esportaZona(opt){opt=opt||{};const m=g2m(UPP[0],UPP[1]),x14=Math.floor((m[0]+MH)/S14),y14=Math.floor((MH-m[1])/S14),ll=m2ll(m[0],m[1]),out={versione:'29.3',quando:new Date().toISOString(),pos:{lat:ll[0],lon:ll[1],x:UPP[0],z:UPP[1]},x14,y14,vt:{},dem:{},lc:{},errori:[]};
 const b64=b=>{const u=new Uint8Array(b);let s='';for(let i=0;i<u.length;i+=8192)s+=String.fromCharCode.apply(null,u.subarray(i,i+8192));return btoa(s)};
 const get=async(url)=>{const r=await fetch(url,{mode:'cors',credentials:'omit'});if(!r.ok)throw new Error(r.status+' '+url);return b64(await r.arrayBuffer())};
 const tp=(t,z,x,y)=>t.replace('{zz}',String(z).padStart(2,'0')).replace('{z}',z).replace('{x}',x).replace('{y}',y);
 const jobs=[];for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const x=x14+dx,y=y14+dy;jobs.push(get(tp(CFG.vt,14,x,y)).then(d=>{out.vt['14/'+x+'/'+y]=d}).catch(e=>out.errori.push(String(e))));if(COP.on&&CFG.lc)jobs.push(get(tp(CFG.lc,14,x,y)).then(d=>{out.lc['14/'+x+'/'+y]=d}).catch(()=>{}))}
 const seen=new Set();for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const x=(x14+dx)>>2,y=(y14+dy)>>2,k='12/'+x+'/'+y;if(seen.has(k))continue;seen.add(k);jobs.push(get(tp(CFG.dem,12,x,y)).then(d=>{out.dem[k]=d}).catch(e=>out.errori.push(String(e))))}
 await Promise.all(jobs);const name='italia-open-world-zona-'+ll[0].toFixed(4)+'_'+ll[1].toFixed(4)+'.json';if(opt.testo)return JSON.stringify(out);const blob=new Blob([JSON.stringify(out)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},4000);
 return{name,kb:Math.round(blob.size/1024),vt:Object.keys(out.vt).length,dem:Object.keys(out.dem).length,errori:out.errori.length}}
function copToggle(){COP.on=!COP.on;try{localStorage.setItem('iow_cop',COP.on?'1':'0')}catch(e){}cfgAll();for(const f of FARS.values()){if(COP.on)satFor(f);else{f.me.material=[MTR.farL,MTR.farS];satRelease(f)}}return COP.on}
function applyFar(j,r){const mxL=-MH+j.x*S14,myT=MH-j.y*S14,g0=m2g(mxL,myT),ge=geom(r.T,1);ge.addGroup(0,r.nL,0);if(r.nS)ge.addGroup(r.nL,r.nS,1);
 const me=new T.Mesh(ge,[MTR.farL,MTR.farS]);me.position.set(g0[0],0,g0[1]);me.updateMatrix();me.matrixAutoUpdate=false;me.receiveShadow=false;sc.add(me);
 const old=FARS.get(j.key);if(old)dropFar(j.key);const fo={key:j.key,x:j.x,y:j.y,me,H:r.H,N:r.N,S:r.S,X:g0[0],Z:g0[1]};FARS.set(j.key,fo);satFor(fo);farVisDirty=true}
let farVisDirty=true;
function farVis(){farVisDirty=false;for(const f of FARS.values()){let all=true;for(let q=0;q<4&&all;q++)if(!CELLS.has(key2(f.x*2+(q&1),f.y*2+(q>>1))))all=false;f.me.visible=!all}}
function applyOne(){const t0=performance.now();while(RES.length){const [j,r]=RES.shift();if(j.gen!==GEN)continue;
  if(j.t==='cella'){const d=Math.max(Math.abs(j.x-PC[0]),Math.abs(j.y-PC[1]));if(d>5)continue;const old=CELLS.get(j.key);if(old&&old.lod==='A'&&j.lod==='B'&&d<=1)continue;
   const c=mkCell(j,r);if(old)dropCell(j.key);CELLS.set(j.key,c);sc.add(c.g);farVisDirty=true;STATS.ms.push(r.ms);if(STATS.ms.length>40)STATS.ms.shift();STATS.net=r.net}
  else if(j.t==='lontano')applyFar(j,r);
  if(performance.now()-t0>7)break}}
/* ---------- quote, acqua, ponti ---------- */
// quota del terreno con gli stessi triangoli della mesh disegnata (auto, persone ed erba poggiano esattamente sul terreno visibile)
function hCell(c,u,v){const d=c.d,NG=c.NG,fx=Math.min(NG-1.0001,Math.max(0,u/d)),fy=Math.min(NG-1.0001,Math.max(0,v/d)),i=fx|0,j=fy|0,a=fx-i,b=fy-j,p=j*NG+i,H=c.H;return a+b<=1?H[p]+(H[p+1]-H[p])*a+(H[p+NG]-H[p])*b:H[p+NG+1]+(H[p+NG]-H[p+NG+1])*(1-a)+(H[p+1]-H[p+NG+1])*(1-b)}
// quota dell'asfalto dal raster delle strade (pixel di ~3,6 m): media bilineare dei soli pixel di strada vicini (niente gradini sulle strade strette e ripide)
// quota dell'asfalto dal raster delle strade (pixel di ~3,6 m): media bilineare dei soli pixel di strada vicini che stanno sulla stessa superficie
// del pixel più vicino (entro 1,5 m): così due strade sovrapposte o un tornante non si mescolano
// quota dell'asfalto in (u,v) dal raster a due strati (16 bit, 4 cm). Si sceglie prima la superficie: il valore (fra i due strati dei 4 pixel attorno)
// più vicino alla quota di riferimento yh (senza yh: il primo strato del pixel più vicino); poi media bilineare dei pixel che appartengono alla stessa
// superficie (entro 2,6 m), ciascuno con lo strato più vicino: chi sta sulla via bassa di una terrazza resta lì, e nessun pixel "salta" di strato da solo
function rhCell(c,u,v,yh){const n=c.RHN,px=c.S/n,fx=u/px-.5,fy=v/px-.5,i=Math.floor(fx),j=Math.floor(fy),a=fx-i,b=fy-j,R=c.RH,R2=c.RH2,B=c.RHB,hy=yh!==undefined&&yh!==null;
 const W=[(1-a)*(1-b),a*(1-b),(1-a)*b,a*b],H1=[NaN,NaN,NaN,NaN],H2=[NaN,NaN,NaN,NaN];
 for(let k=0;k<4;k++){const ii=i+(k&1),jj=j+(k>>1);if(ii<0||jj<0||ii>=n||jj>=n)continue;const p=jj*n+ii,q=R[p];if(!q)continue;H1[k]=B+(q-1)*.04;if(R2){const q2=R2[p];if(q2)H2[k]=B+(q2-1)*.04}}
 let hn=NaN;if(hy){let be=1e9;for(let k=0;k<4;k++){const h=H1[k],h2=H2[k];if(h===h&&Math.abs(h-yh)<be){be=Math.abs(h-yh);hn=h}if(h2===h2&&Math.abs(h2-yh)<be){be=Math.abs(h2-yh);hn=h2}}}
 else{let wn=-1;for(let k=0;k<4;k++)if(H1[k]===H1[k]&&W[k]>wn){wn=W[k];hn=H1[k]}}
 if(!(hn===hn))return hn;let sw=0,sh=0;for(let k=0;k<4;k++){let h=H1[k];const h2=H2[k];if(h2===h2&&(!(h===h)||Math.abs(h2-hn)<Math.abs(h-hn)))h=h2;if(h===h&&W[k]>0&&Math.abs(h-hn)<2.6){sw+=W[k];sh+=h*W[k]}}return sw>.12?sh/sw:hn}
function farAt(x,z){const m=g2m(x,z);return FARS.get(key2(Math.floor((m[0]+MH)/S14),Math.floor((MH-m[1])/S14)))}
// quota del suolo: terreno, o asfalto (raster delle quote stradali) se è vicino al terreno o alla quota attuale di chi si muove (yh): così l'auto resta sulla strada anche dove la strada è alta sul terreno
// quota del suolo: dentro una carreggiata vale l'asfalto (raster), salvo che la quota di riferimento yh (veicolo) sia più vicina al terreno di oltre 1,5 m
// (strada sopraelevata o terrazza accanto: chi sta sotto resta sotto); senza yh (comparsa, pedoni) l'asfalto comanda sempre
function terrainH(x,z,yh){const c=cellAt(x,z);if(c){const u=c.X-x,v=c.Z-z;let h=hCell(c,u,v);if(c.RH){const r=rhCell(c,u,v,yh);if(r===r){const useR=(yh!==undefined&&yh!==null)?Math.abs(r-yh)<=Math.abs(h-yh)+1.5:true;if(useR)h=Math.max(r,h-.05)}}return LASTH=h}
 const f=farAt(x,z);if(f){const u=f.X-x,v=f.Z-z,d=f.S/(f.N-1),N=f.N,fx=Math.min(N-1.0001,Math.max(0,u/d)),fy=Math.min(N-1.0001,Math.max(0,v/d)),i=fx|0,j=fy|0,a=fx-i,b=fy-j,p=j*N+i,H=f.H;return Math.max(0,H[p]*(1-a)*(1-b)+H[p+1]*a*(1-b)+H[p+N]*(1-a)*b+H[p+N+1]*a*b)}
 return LASTH}
// quota dell'impalcato (o del piano di una galleria) sotto (x,z): vince il segmento più vicino, così i "tappi" dei segmenti contigui (proiezione
// bloccata all'estremo, quota dell'estremo) non fanno una scala su un ponte in salita; a parità di distanza (impalcati sovrapposti) quello
// più vicino alla quota attuale yh (o il più alto, senza yh). Con yh si considerano solo impalcati entro 2,6 m (gallerie: 1,2 m, chi sta su una via
// che passa 2–3 m sopra una galleria poco profonda non deve "caderci" dentro): altrimenti si è sotto o sopra
let LASTBT=false;
function bridgeH(x,z,yh,ped){const a=BRG.get(Math.floor(x/64)+','+Math.floor(z/64));if(!a)return null;let best=null,bd=1e9,be=1e9,bt=false;
 for(const s of a){if(!ped&&s.hw<2.5)continue;const dx=s.bx-s.ax,dz=s.bz-s.az,l2=dx*dx+dz*dz;if(l2<1e-4)continue;const t=Math.max(0,Math.min(1,((x-s.ax)*dx+(z-s.az)*dz)/l2)),px=s.ax+dx*t-x,pz=s.az+dz*t-z,d2=px*px+pz*pz;if(d2>s.hw*s.hw)continue;
  const y=s.ha+(s.hb-s.ha)*t,d=Math.sqrt(d2);if(yh!==undefined&&yh!==null){const e=Math.abs(yh-y);if(e>(s.tun?1.2:2.6))continue;if(d<bd-1||(d<bd+1&&e<be)){bd=Math.min(bd,d);be=e;best=y;bt=!!s.tun}}
  else if(!s.tun){if(d<bd-1||(d<bd+1&&(best===null||y>best))){bd=Math.min(bd,d);best=y}}}
 LASTBT=bt;return best}
// suolo per chi si muove: superficie (terreno o asfalto) oppure impalcato di un ponte / piano di una galleria, quello più vicino alla quota attuale (a parità, la superficie)
// (a parità, entro 30 cm, vince l'impalcato: chi scende su un ponte in pendenza non deve restare agganciato all'asfalto della rampa accanto)
// Gallerie: il piano della galleria vale solo dove il suolo sta chiaramente sopra (più di 2,5 m: si è dentro la montagna); all'imbocco, dove suolo e piano
// coincidono, comanda il suolo, così una via che passa sopra l'imbocco non "cade" nella galleria. Ponti: un impalcato a meno di 2 m dal suolo
// (dati incoerenti: ponte che non ha potuto alzarsi) non cattura chi passa sotto, lo prende solo chi ci è già sopra (entro 50 cm)
function ground(x,z,yh,ped){const s=terrainH(x,z,yh),b=bridgeH(x,z,yh,ped);if(b===null)return s;if(yh===undefined||yh===null)return Math.max(s,b);if(LASTBT)return s-b>2.5&&Math.abs(b-yh)<=1?b:s;if(b-s<2&&Math.abs(b-yh)>=.5)return s;return Math.abs(b-yh)<Math.abs(s-yh)+.3?b:s}
function wet(x,z){const c=cellAt(x,z);if(!c)return false;const u=c.X-x,v=c.Z-z;let w=false;
 if(c.wm){const n=c.WM,i=Math.min(n-1,Math.max(0,Math.floor(u/c.S*n))),j=Math.min(n-1,Math.max(0,Math.floor(v/c.S*n)));w=!!c.wm[j*n+i]}
 else if(c.cls){const n=c.CR,i=Math.min(n-1,Math.max(0,Math.floor(u/c.S*n))),j=Math.min(n-1,Math.max(0,Math.floor(v/c.S*n)));w=c.cls[j*n+i]===1}
 return w&&bridgeH(x,z)===null}
/* ---------- nome della via (raster dei nomi di OpenStreetMap nella cella) ---------- */
function roadName(x,z){const c=cellAt(x,z);if(!c||!c.NR)return '';const n=c.RHN,px=c.S/n,i=Math.floor((c.X-x)/px),j=Math.floor((c.Z-z)/px);if(i<0||j<0||i>=n||j>=n)return '';const k=c.NR[j*n+i];return k>=0?(c.names[k]||''):''}
function hudText(x,z){const rn=roadName(x,z),pn=placeName(x,z);return rn?(pn?rn+'\n'+pn:rn):pn}
/* ---------- nomi dei luoghi (zona attuale) ---------- */
const PLACES=new Map();
function addPlace(mx,my,name,cl){if(!name)return;const k=name+'|'+cl;if(!PLACES.has(k))PLACES.set(k,{mx,my,name,cl})}
function placeName(x,z){const m=g2m(x,z);let best=null,bs=1e18,sub=null,ss=1e18;
 for(const p of PLACES.values()){const d=Math.hypot(p.mx-m[0],p.my-m[1])*K,cl=p.cl;
  if(cl==='city'||cl==='town'||cl==='village'){const lim=cl==='city'?14000:cl==='town'?5000:2200;if(d>lim)continue;const s=d/(cl==='city'?3:cl==='town'?1.6:1);if(s<bs){bs=s;best=p}}
  else if(cl==='suburb'||cl==='quarter'||cl==='neighbourhood'){if(d<1500&&d<ss){ss=d;sub=p}}
  else if(cl==='hamlet'||cl==='isolated_dwelling'||cl==='locality'){if(d<600&&d*1.6<ss){ss=d*1.6;sub=p}}}
 return best?(sub&&sub.name!==best.name?best.name+' · '+sub.name:best.name):(sub?sub.name:'')}
/* ---------- tile 2D per minimappa e mappa ---------- */
const MT2=new Map();let mapDirty=false;
function mapTileGet(z,x,y,px,pri){const n=1<<z;if(y<0||y>=n)return null;x=((x%n)+n)%n;const k=z+'/'+x+'/'+y+'/'+px;let e=MT2.get(k);if(e&&e.fail&&performance.now()-e.fail>8000){MT2.delete(k);e=null}if(e){e.t=performance.now();if(e.pending&&pri<e.job.pri&&!e.sent)e.job.pri=pri;return e.img?e:null}
 e={pending:1,t:performance.now(),job:{t:'mappa',ik:'m'+k,key:k,z,x,y,px,pri}};MT2.set(k,e);QUEUE.push(e.job);pump();
 if(MT2.size>230){const a=Array.from(MT2.entries()).filter(q=>!q[1].pending).sort((p,q)=>p[1].t-q[1].t);for(let i=0;i<a.length&&MT2.size>200;i++){if(a[i][1].img&&a[i][1].img.close)a[i][1].img.close();MT2.delete(a[i][0])}}
 return null}
function mapTileDone(j,r){const e=MT2.get(j.key);if(!e){if(r.img&&r.img.close)r.img.close();return}e.pending=0;e.img=r.img;e.labels=r.labels;const n=1<<j.z,ts=ME/n;
 for(const l of r.labels)addPlace(-MH+(j.x+l.x/j.px)*ts,MH-(j.y+l.y/j.px)*ts,l.n,l.c);mapDirty=true}
/* ---------- minimappa ---------- */
function arrow(c,x,y,a,s){c.save();c.translate(x,y);c.rotate(a);c.fillStyle='#ff3b30';c.strokeStyle='#fff';c.lineWidth=2;c.beginPath();c.moveTo(0,-s);c.lineTo(s*.7,s*.85);c.lineTo(0,s*.45);c.lineTo(-s*.7,s*.85);c.closePath();c.fill();c.stroke();c.restore()}
function carIcon(c,x,y,a){c.save();c.translate(x,y);c.rotate(a);c.fillStyle='#9e1a22';c.strokeStyle='#fff';c.lineWidth=1.5;c.fillRect(-4,-7,8,14);c.strokeRect(-4,-7,8,14);c.restore()}
function drawMini(){const mm=$('#mm'),c=mm.getContext('2d'),px=inCar?C.x:P.x,pz=inCar?C.z:P.z,wm=760,k=240/wm;
 c.save();c.clearRect(0,0,240,240);c.beginPath();c.arc(120,120,118,0,6.2832);c.clip();c.fillStyle='#ece6d8';c.fillRect(0,0,240,240);
 const m=g2m(px,pz),hw=wm/2/K,tx0=Math.floor((m[0]-hw+MH)/S14),tx1=Math.floor((m[0]+hw+MH)/S14),ty0=Math.floor((MH-(m[1]+hw))/S14),ty1=Math.floor((MH-(m[1]-hw))/S14);
 for(let ty=ty0;ty<=ty1;ty++)for(let tx=tx0;tx<=tx1;tx++){const e=mapTileGet(14,tx,ty,512,2);if(!e)continue;const g0=m2g(-MH+tx*S14,MH-ty*S14),S=S14*K*k;c.drawImage(e.img,120+(px-g0[0])*k,120+(pz-g0[1])*k,S+.5,S+.5)}
 c.restore();for(const ce of CELLS.values()){if(ce.lod!=='A')continue;for(const p of ce.pois){if(p.cl!=='fuel'&&p.cl!=='car_repair')continue;const x=120+(px-p.x)*k,y=120+(pz-p.z)*k;if((x-120)**2+(y-120)**2>104*104)continue;c.font='bold 11px system-ui,sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillStyle='#fff';c.beginPath();c.arc(x,y,7,0,6.2832);c.fill();c.fillStyle='#1b3a66';c.fillText(p.cl==='fuel'?'⛽':'🔧',x,y+1)}}   /* benzinai e officine (OpenStreetMap) per il rifornimento e le riparazioni */
 if(!inCar){const x=120+(px-C.x)*k,y=120+(pz-C.z)*k;if((x-120)**2+(y-120)**2<110*110)carIcon(c,x,y,-C.h)}arrow(c,120,120,-(inCar?C.h:yaw),13)}
/* ---------- mappa grande: tile OpenMapTiles disegnate qui, zoom e spostamento, viaggio verso un punto ---------- */
const MAPV={z:13,cx:0,cy:0,mark:null,markName:''};
function mapOpen(){const m=g2m(inCar?C.x:P.x,inCar?C.z:P.z);MAPV.cx=m[0];MAPV.cy=m[1];if(MAPV.z<5)MAPV.z=13;MAPV.mark=null;$('#mgo').hidden=true;drawMap()}
function mapZoomTo(z){MAPV.z=Math.max(5,Math.min(17,z));drawMap()}
function mapZoom(d){mapZoomTo(Math.round(MAPV.z)+d)}
function mapCenter(){const m=g2m(inCar?C.x:P.x,inCar?C.z:P.z);MAPV.cx=m[0];MAPV.cy=m[1];drawMap()}
function mapScale(){return 256*Math.pow(2,MAPV.z)/ME}   // pixel della tela per metro di Mercatore
function mapPan(dx,dy){const s=mapScale();MAPV.cx-=dx/s;MAPV.cy+=dy/s;MAPV.cy=Math.max(-MH*.98,Math.min(MH*.98,MAPV.cy));drawMap()}
function mapTap(x,y){const W=$('#mc').width,s=mapScale(),mx=MAPV.cx+(x-W/2)/s,my=MAPV.cy-(y-W/2)/s,ll=m2ll(mx,my);MAPV.mark=[mx,my];MAPV.markName='';
 const b=$('#mgo');b.hidden=false;b.textContent='Vai qui ('+ll[0].toFixed(4)+', '+ll[1].toFixed(4)+')';drawMap()}
function mapCity(i){const q=CITIES[i],m=ll2m(q[1],q[2]);MAPV.cx=m[0];MAPV.cy=m[1];MAPV.z=Math.max(MAPV.z,12);MAPV.mark=m;MAPV.markName=q[0];const b=$('#mgo');b.hidden=false;b.textContent='Vai a '+q[0];drawMap()}
let mapRaf=0;
function drawMap(){if(mapRaf)return;mapRaf=requestAnimationFrame(()=>{mapRaf=0;drawMapNow()})}
function drawMapNow(){const mc=$('#mc'),c=mc.getContext('2d'),W=mc.width,zi=Math.max(5,Math.min(14,Math.round(MAPV.z))),n=1<<zi,ts=ME/n,s=mapScale(),tp=ts*s;
 c.fillStyle='#d9e5ec';c.fillRect(0,0,W,W);c.imageSmoothingEnabled=true;
 const X=mx=>W/2+(mx-MAPV.cx)*s,Y=my=>W/2-(my-MAPV.cy)*s;
 const tx0=Math.floor((MAPV.cx-W/2/s+MH)/ts),tx1=Math.floor((MAPV.cx+W/2/s+MH)/ts),ty0=Math.max(0,Math.floor((MH-(MAPV.cy+W/2/s))/ts)),ty1=Math.min(n-1,Math.floor((MH-(MAPV.cy-W/2/s))/ts));
 const labs=[];
 for(let ty=ty0;ty<=ty1;ty++)for(let tx=tx0;tx<=tx1;tx++){const sx=X(-MH+tx*ts),sy=Y(MH-ty*ts),d=Math.hypot(sx+tp/2-W/2,sy+tp/2-W/2);let e=mapTileGet(zi,tx,ty,256,mapOpen_?-20+d/1000:5);
  if(e){c.drawImage(e.img,sx,sy,tp+.6,tp+.6);for(const l of e.labels)labs.push([sx+l.x/256*tp,sy+l.y/256*tp,l])}
  else{for(let up=1;up<=4&&zi-up>=5;up++){const z2=zi-up,f=1<<up,e2=MT2.get(z2+'/'+(((tx>>up)%(1<<z2))+(1<<z2))%(1<<z2)+'/'+(ty>>up)+'/256');if(e2&&e2.img){const ox=(tx-(tx>>up)*f)*256/f,oy=(ty-(ty>>up)*f)*256/f;c.drawImage(e2.img,ox,oy,256/f,256/f,sx,sy,tp+.6,tp+.6);break}}}}
 // nomi: città prima, niente sovrapposizioni
 const RK={city:0,town:1,village:2,suburb:3,quarter:4,hamlet:5,neighbourhood:6,isolated_dwelling:7,locality:7};labs.sort((a,b)=>(RK[a[2].c]??8)-(RK[b[2].c]??8)||a[2].r-b[2].r);const boxes=[];
 c.textAlign='center';c.textBaseline='middle';c.lineJoin='round';
 for(const [x,y,l] of labs){if(x<-40||y<-20||x>W+40||y>W+20)continue;const big=l.c==='city'?1:l.c==='town'?.82:.68;if(zi<9&&l.c!=='city'&&l.c!=='town')continue;if(zi<11&&big<.7)continue;
  const fs=Math.round((zi<8?17:22)*big+4);c.font='700 '+fs+'px system-ui,sans-serif';const w=c.measureText(l.n).width,bx=[x-w/2-4,y-fs/2-3,x+w/2+4,y+fs/2+3];if(boxes.some(b=>!(bx[2]<b[0]||bx[0]>b[2]||bx[3]<b[1]||bx[1]>b[3])))continue;boxes.push(bx);
  c.lineWidth=4;c.strokeStyle='rgba(255,255,255,.92)';c.strokeText(l.n,x,y);c.fillStyle=l.c==='city'?'#1c1c22':'#33333a';c.fillText(l.n,x,y)}
 // segnaposto, auto, giocatore
 if(MAPV.mark){const x=X(MAPV.mark[0]),y=Y(MAPV.mark[1]);c.fillStyle='#e8392b';c.strokeStyle='#fff';c.lineWidth=3;c.beginPath();c.arc(x,y-18,11,0,6.2832);c.moveTo(x-8,y-11);c.lineTo(x,y);c.lineTo(x+8,y-11);c.fill();c.stroke();c.fillStyle='#fff';c.beginPath();c.arc(x,y-18,4,0,6.2832);c.fill()}
 {const mc2=g2m(C.x,C.z);if(!inCar)carIcon(c,X(mc2[0]),Y(mc2[1]),-C.h);const mp=g2m(inCar?C.x:P.x,inCar?C.z:P.z);arrow(c,X(mp[0]),Y(mp[1]),-(inCar?C.h:yaw),16)}
 // scala (metri veri alla latitudine del centro)
 {const lat=m2ll(MAPV.cx,MAPV.cy)[0],mpp=1/s*Math.cos(lat*PI/180),cand=[50,100,200,500,1000,2000,5000,10000,20000,50000,100000,200000,500000];let sc=cand[0];for(const q of cand)if(q/mpp<W*.28)sc=q;const sw=sc/mpp;
  c.fillStyle='rgba(0,0,0,.55)';c.fillRect(14,W-38,sw+14,28);c.fillStyle='#fff';c.fillRect(21,W-18,sw,3);c.font='bold 14px system-ui,sans-serif';c.textAlign='left';c.textBaseline='alphabetic';c.fillText(sc>=1000?(sc/1000)+' km':sc+' m',21,W-23)}
 const mt=$('#mt');if(mt)mt.textContent='Mappa d’Italia · trascina per spostare, −/+ o due dita per lo zoom · tocca un punto per viaggiare'}
let mapOpen_=false;
function mapTick(){if(mapOpen_&&mapDirty){mapDirty=false;drawMap()}}
/* ---------- partenza, viaggio, caricamento ---------- */
const LOAD={on:false,t0:0,place:null,label:''};
function setOrigin(lat,lon){const m=ll2m(lat,lon);OX=m[0];OY=m[1];K=Math.cos(lat*PI/180);GEN++;cfgAll()}
const DRIVE={motorway:1,trunk:1,primary:1,secondary:1,tertiary:1,minor:1,service:1.6,busway:3,raceway:3};
function nearRoad(x,z,maxd){let best=null,bd=maxd*maxd;
 for(const c of CELLS.values()){if(!c.mini)continue;const cxm=c.X-c.S/2,czm=c.Z-c.S/2;if(Math.abs(cxm-x)>c.S/2+maxd||Math.abs(czm-z)>c.S/2+maxd)continue;
  for(const r of c.mini){const pen=DRIVE[r.c];if(!pen||r.b)continue;const p=r.p;for(let i=0;i+3<p.length;i+=2){const ax=c.X-p[i],az=c.Z-p[i+1],bx=c.X-p[i+2],bz=c.Z-p[i+3],dx=bx-ax,dz=bz-az,l2=dx*dx+dz*dz;if(l2<.01)continue;const t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/l2)),qx=ax+dx*t,qz=az+dz*t,d2=((qx-x)**2+(qz-z)**2)*pen*pen;
   if(d2<bd){bd=d2;const l=Math.sqrt(l2);best={x:qx,z:qz,dx:dx/l,dz:dz/l,w:r.w,c:r.c,one:r.one,pk:r.pk||0}}}}}
 return best}
// corsia di marcia (distanza dal centro verso destra) secondo larghezza, senso unico e sosta a lato (pk: 1 destra del verso +, 2 sinistra)
function laneOff(w,one,pk,dir){const hw=w/2,pr=dir>0?(pk&1):(pk&2);if(pr)return Math.max(-hw+1.2,hw-4.1);return one?Math.min(.6,hw-1.4):Math.max(.9,Math.min(3.1,hw-1.4))}
function placeAt(tx,tz,keep){// auto sulla strada percorribile più vicina (corsia di destra), giocatore accanto o a bordo
 const r=nearRoad(tx,tz,450);let h=keep?keep.h:0;
 if(keep&&keep.car){C.x=keep.car[0];C.z=keep.car[1];C.h=keep.ch}
 else if(r){h=Math.atan2(r.dx,r.dz);const off=laneOff(r.w,r.one,r.pk,1);C.x=r.x-Math.cos(h)*off;C.z=r.z+Math.sin(h)*off;C.h=h}
 else{C.x=tx-3;C.z=tz;C.h=h}
 if(keep&&keep.pl){P.x=keep.pl[0];P.z=keep.pl[1]}else if(inCar){P.x=C.x;P.z=C.z}else{const side=r?(r.w/2+1.4):2.4;const q=push(C.x-Math.cos(C.h)*side,C.z+Math.sin(C.h)*side,P.r);P.x=q[0];P.z=q[1]}
 V.vx=V.vz=0;cs.v=0;V.y=ground(C.x,C.z);P.y=inCar?V.y:ground(P.x,P.z,V.y+1);if(!keep){yaw=C.h;camYaw=C.h;pitch=-.2}save()}
function travel(lat,lon,name,keep){if(typeof VITA!=='undefined')VITA.travelReset();dropAll();setOrigin(lat,lon);LOAD.on=true;LOAD.t0=performance.now();LOAD.label=name||'';
 if(keep){P.x=keep.pl?keep.pl[0]:0;P.z=keep.pl?keep.pl[1]:0}else{P.x=P.z=0}C.x=P.x;C.z=P.z;
 LOAD.place=()=>placeAt(0,0,keep);overlay(true);plan.force=true;update(P.x,P.z)}
function checkLoad(){if(!LOAD.on)return;let a=0,need=0;{const m=g2m(P.x,P.z);for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const x=PC[0]+dx,y=PC[1]+dy,x0=-MH+x*S15,x1=x0+S15,y1=MH-y*S15,y0=y1-S15,ddx=Math.max(x0-m[0],0,m[0]-x1),ddy=Math.max(y0-m[1],0,m[1]-y1);if(Math.hypot(ddx,ddy)*K<520){need++;const c=CELLS.get(key2(x,y));if(c&&c.lod==='A')a++}}}let f=0;for(const q of FARS.values())f++;
 const texOk=PBR.st.state!=='carico'||performance.now()-LOAD.t0>15000,ok=need>0&&a>=need&&texOk;const p=$('#rlp');if(p)p.textContent='Zona attorno al punto di arrivo: '+a+' celle su '+need+' · terreno lontano: '+f+' blocchi'+(STATS.net?' · scaricati '+STATS.net.kb+' kB':'')+(PBR.st.tot?' · texture vere: '+PBR.st.n+'/'+PBR.st.tot:'');
 const e=$('#rle'),rb=$('#rlr');if(e){const slow=performance.now()-LOAD.t0>25000;e.textContent=ERR.net?'Non riesco a scaricare la mappa: '+ERR.msg+'. Serve una connessione a internet; la pagina deve essere aperta dal sito del gioco (non dall’anteprima, che blocca la rete).':(slow?'Il caricamento è lento: la rete risponde piano.':'');if(rb)rb.hidden=!(ERR.net||slow)}
 if(ok){LOAD.on=false;try{LOAD.place&&LOAD.place()}catch(err){console.error(err)}LOAD.place=null;overlay(false);ERR.net=0;if(LOAD.label)toast('Sei a '+LOAD.label)}}
function overlay(on){const o=$('#rld');if(!o)return;o.hidden=!on;if(on){$('#rlt').textContent=LOAD.label?'Viaggio verso '+LOAD.label+'…':'Caricamento della mappa reale…';$('#rle').textContent='';$('#rlr').hidden=true}}
function retry(){ERR.net=0;ERR.msg='';LOAD.t0=performance.now();plan.force=true;$('#rlr').hidden=true}
/* ---------- aggiornamento per fotogramma ---------- */
let kT=0,labT=0,lastLab='';
let UPP=[0,0];
function update(px,pz,all){UPP[0]=px;UPP[1]=pz;SKY.position.copy(cam.position);try{CIELO.update(px,pz);ERBA.update(px,pz)}catch(e){if(!update.e){update.e=1;console.error(e)}}if(!WK.length)return;const now=performance.now();if(RETRY.length&&RETRY.some(j=>j.retryAt<=now))plan.force=true;plan(px,pz);pump();applyOne();if(farVisDirty)farVis();checkLoad();mapTick();
 if(!LOAD.on){if(now>kT){kT=now+2000;const ll=geoOf(px,pz),dr=Math.abs(Math.cos(ll[0]*PI/180)/K-1);if(dr>.02){const sp=Math.hypot(V.vx,V.vz);if(sp<25||dr>.04){const pg=geoOf(P.x,P.z),cg=geoOf(C.x,C.z);rescale(ll,pg,cg)}}}
  if(now>labT){labT=now+3000;const m=g2m(px,pz);for(const z of [11,9]){const n=1<<z,ts=ME/n,tx=Math.floor((m[0]+MH)/ts),ty=Math.floor((MH-m[1])/ts);mapTileGet(z,tx,ty,256,8)}}}}
// cambio di scala: l'origine si sposta qui (oltre ~150 km a nord o a sud dal punto di partenza la scala di Mercatore cambierebbe del 2%)
function rescale(ll,pg,cg){const h=C.h,yw=yaw;if(typeof VITA!=='undefined')VITA.travelReset();dropAll();setOrigin(ll[0],ll[1]);const p=m2g(...ll2m(pg[0],pg[1])),c=m2g(...ll2m(cg[0],cg[1]));
 LOAD.on=true;LOAD.t0=performance.now();LOAD.label='';P.x=p[0];P.z=p[1];C.x=c[0];C.z=c[1];LOAD.place=()=>{placeAt(0,0,{pl:[p[0],p[1]],car:[c[0],c[1]],ch:h,h:yw});yaw=yw};overlay(true);$('#rlt').textContent='Aggiornamento della scala della mappa…';plan.force=true}
/* ---------- bar e caffè veri: si può ordinare al banco ---------- */
function nearBar(x,z){let b=null,bd=16;for(const c of CELLS.values()){if(c.lod!=='A')continue;for(const p of c.pois){if(p.cl==='fuel'||p.cl==='car_repair')continue;const d=Math.hypot(p.x-x,p.z-z);if(d<bd){bd=d;b=p}}}return b}
function nearFuel(x,z){let b=null,bd=34;for(const c of CELLS.values()){if(c.lod!=='A')continue;for(const p of c.pois){if(p.cl!=='fuel'&&p.cl!=='car_repair')continue;const d=Math.hypot(p.x-x,p.z-z);if(d<bd){bd=d;b=p}}}return b}
/* superficie sotto il veicolo per il motore fisico: strada (asfalto o sterrato) oppure classe del suolo della cella */
const SURF_CL=['asfalto','asfalto','lastricato','erba','terra','terra','erba','ghiaia','terra','neve','erba','lastricato','terra'];
function surf(x,z){const c=cellAt(x,z);if(!c)return 'asfalto';const u=c.X-x,v=c.Z-z;if(c.RH){const r=rhCell(c,u,v);if(r===r)return 'asfalto'}if(bridgeH(x,z)!==null)return 'asfalto';if(c.cls){const n=c.CR,i=Math.min(n-1,Math.max(0,Math.floor(u/c.S*n))),j=Math.min(n-1,Math.max(0,Math.floor(v/c.S*n)));return SURF_CL[c.cls[j*n+i]]||'asfalto'}return 'asfalto'}
/* ---------- salvataggio della posizione geografica ---------- */
function saveGeo(){if(LOAD.on||!WK.length)return;S.geo=geoOf(P.x,P.z);S.cgeo=geoOf(C.x,C.z);S.ch=C.h}
function start(){PBR.load();mkWorkers();if(!WK.length){overlay(true);$('#rle').textContent='Il caricatore della mappa non è disponibile in questo browser.';return}
 let lat=START.lat,lon=START.lon,name='';const pq=(Q.get('pos')||'').split(',').map(Number);
 if(pq.length===2&&isFinite(pq[0])&&isFinite(pq[1])){lat=pq[0];lon=pq[1]}else if(Array.isArray(S.geo)&&isFinite(S.geo[0])&&isFinite(S.geo[1])){lat=S.geo[0];lon=S.geo[1]}else name='Torino';
 setOrigin(lat,lon);P.x=P.z=0;let keep=null;
 if(Array.isArray(S.cgeo)&&isFinite(S.cgeo[0])){const c=m2g(...ll2m(S.cgeo[0],S.cgeo[1]));if(Math.hypot(c[0],c[1])<1500)keep={pl:[0,0],car:c,ch:isFinite(S.ch)?S.ch:0,h:yaw}}
 C.x=keep?keep.car[0]:0;C.z=keep?keep.car[1]:0;LOAD.on=true;LOAD.t0=performance.now();LOAD.label=name;LOAD.place=()=>placeAt(0,0,keep);overlay(true);plan.force=true;
 const mc=$('#mcity');if(mc){mc.innerHTML=CITIES.map((q,i)=>'<button class="b s" data-i="'+i+'">'+q[0]+'</button>').join('');mc.addEventListener('click',e=>{const b=e.target.closest('button');if(b)mapCity(+b.dataset.i)})}
 const go=$('#mgo');if(go)go.onclick=()=>{if(!MAPV.mark)return;const ll=m2ll(MAPV.mark[0],MAPV.mark[1]);const nm=MAPV.markName||'';MAPV.mark=null;go.hidden=true;openMap(false);if(inCar&&Math.hypot(V.vx,V.vz)>3){V.vx=V.vz=0}travel(ll[0],ll[1],nm||'il punto scelto')};
 const rb=$('#rlr');if(rb)rb.onclick=retry;
 const cb=$('#mcred');if(cb)cb.onclick=()=>{const p=$('#rcred');p.hidden=!p.hidden};{const eb=$('#mdati');if(eb)eb.onclick=async()=>{eb.disabled=true;eb.textContent='📦 scarico…';try{const r=await esportaZona();toast('Salvato '+r.name+' ('+r.kb+' KB): mandalo in chat per far riprodurre il difetto');eb.textContent='📦 Dati zona'}catch(e){toast('Dati zona: errore '+e.message);eb.textContent='📦 Dati zona'}eb.disabled=false}}{const sb=$('#msat');if(sb){const lab=()=>{sb.textContent=COP.on?'🛰 Copernicus: sì':'🛰 Copernicus: no'};lab();sb.onclick=()=>{copToggle();lab();toast(COP.on?'Dati Copernicus attivi: boschi, campi e roccia da ESA WorldCover; terreno lontano dalle immagini Sentinel-2':'Dati Copernicus disattivati: solo OpenStreetMap')}}}const cx=$('#rcredx');if(cx)cx.onclick=()=>{$('#rcred').hidden=true}}
return{start,update,ground,terrainH,bridgeH,wet,surf,nearFuel,inside:(x,z)=>!LOAD.on&&!!cellAt(x,z),placeName,roadName,hudText,nearBar,saveGeo,travel,drawMini,drawMap,mapOpen:()=>{mapOpen_=true;mapOpen()},mapClose:()=>{mapOpen_=false},mapZoom,mapZoomTo,mapCenter,mapPan,mapTap,mapCity,
 sunPos:CIELO.sunPos,CIELO,PBR,UNI,ERBA,COP,copToggle,esportaZona,_mkCell:mkCell,busy:()=>LOAD.on,CSO:CSO2,CARG,MTR,CARCOLS,laneOff,MAPV,CELLS,FARS,STATS,ERR,CFG,geoOf,ll2m,m2g,g2m,get K(){return K},get GEN(){return GEN},nearRoad,cellAt,bridgeH,PLACES,MT2,QUEUE,JOBS}})();
const WORLD={CSZ:32,WS:0,SEA:0,X0:-1e9,X1:1e9,Z0:-1e9,Z1:1e9,NCH:0,H:(x,z)=>REAL.terrainH(x,z),ground:(x,z,yh,ped)=>REAL.ground(x,z,yh,ped),wet:(x,z)=>REAL.wet(x,z),inside:(x,z)=>REAL.inside(x,z),chunkOK:()=>false,zone:()=>0,coastX:()=>0,
 RS:[],SCH:new Map(),BCH:new Map(),RIV:[],BR:[],SPEC:[],MWS:[],CITIES:[],TOWNS:[],TOWN:{cx:0,cz:0,name:''},townAt:()=>null,LAKE:null,MILAN:null,MW:null,mwAt:()=>null,bridgeAt:(x,z)=>REAL.bridgeH(x,z),deckAt:()=>0,SGTXT:[]};
const GY=(x,z,yh)=>REAL.ground(x,z,yh),CHS=new Map(),CSO=REAL.CSO,CHK=null,MAPC=null,MAPV=REAL.MAPV,ZN=['—'];
let mmT=0,znT=0,znLast='';
function worldUpdate(px,pz,all){REAL.update(px,pz,all)}
function drawMini(){REAL.drawMini()}
function drawMap(){REAL.drawMap()}
