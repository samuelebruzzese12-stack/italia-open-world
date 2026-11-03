/* Mappa v2: il mondo è lungo 47 km, quindi minimappa e mappa si disegnano a finestra intorno al giocatore (rilievo campionato, strade dalla rete, luoghi) */
const MAPC=document.createElement('canvas');MAPC.width=MAPC.height=256;
const MAPV={zoom:1,levels:[1600,4500,12000,50000],ox:0,oz:0,drag:null};
function terrCol(h,sh){let r,g,b;if(h<WORLD.SEA){const t=Math.min(1,(WORLD.SEA-h)/30);r=70-t*45;g=140-t*65;b=180-t*55}else if(h<WORLD.SEA+1.2){r=218;g=204;b=152}else{const t=Math.min(1,h/450);r=(112+t*70)*sh;g=(150-t*40)*sh;b=(82+t*60)*sh;if(h>330){r=156*sh;g=146*sh;b=136*sh}}return 'rgb('+(r|0)+','+(g|0)+','+(b|0)+')'}
/* rilievo a celle: cx,cz centro della finestra, wm larghezza in metri, N celle per lato */
function drawTerrain(c,W,cxm,czm,wm,N){const S=wm/N,h=new Float32Array((N+2)*(N+2));for(let j=0;j<N+2;j++)for(let i=0;i<N+2;i++){const x=cxm+wm/2-(i-.5)*S,z=czm+wm/2-(j-.5)*S;h[j*(N+2)+i]=WORLD.H(x,z)}
 const px=W/N;for(let j=0;j<N;j++)for(let i=0;i<N;i++){const k=(j+1)*(N+2)+i+1,hv=h[k],sh=Math.max(.55,Math.min(1.35,1+(h[k+1]-h[k-1]+h[k+N+2]-h[k-N-2])*.012*Math.min(1,16/S)));c.fillStyle=terrCol(hv,sh);c.fillRect(i*px,j*px,px+1,px+1)}}
/* strade dalla rete: solo quelle nella finestra; ai livelli larghi solo le principali */
function drawRoads(c,W,cxm,czm,wm,major){const k=W/wm,X=x=>(cxm+wm/2-x)*k,Z=z=>(czm+wm/2-z)*k,x0=cxm-wm/2-80,x1=cxm+wm/2+80,z0=czm-wm/2-80,z1=czm+wm/2+80;c.lineCap='round';c.lineJoin='round';
 const segs=[];if(wm<=5000){const c0=Math.floor((x0+WORLD.WS)/WORLD.CSZ),c1=Math.floor((x1+WORLD.WS)/WORLD.CSZ),d0=Math.floor((z0+WORLD.WS)/WORLD.CSZ),d1=Math.floor((z1+WORLD.WS)/WORLD.CSZ);for(let i=c0;i<=c1;i++)for(let j=d0;j<=d1;j++){const a=WORLD.SCH.get(i+','+j);if(a)for(const id of a)segs.push(WORLD.RS[id])}}else for(const s of WORLD.RS){if(s.ax<x0&&s.bx<x0||s.ax>x1&&s.bx>x1||s.az<z0&&s.bz<z0||s.az>z1&&s.bz>z1)continue;segs.push(s)}
 for(const pass of [0,1,2])for(const s of segs){const mw=s.mw||s.k===4,mj=s.k===0||s.k===7||s.ss;if(major&&!mw&&!mj)continue;const p=mw?2:mj?1:0;if(p!==pass)continue;
  c.strokeStyle=s.br&&!s.mw?'#ffd23f':mw?(s.mw?'#64b86c':'#ffe4a8'):s.ramp||s.k===8?'#9ad3a0':mj?'#fff1c9':s.k===2?'#d8d4cc':'#f2efe6';const lw=Math.max(major?1.2:1,(s.mw?14:s.w)*k*(mw?1.6:mj?1.9:1.5));c.lineWidth=lw;c.beginPath();c.moveTo(X(s.ax),Z(s.az));c.lineTo(X(s.bx),Z(s.bz));c.stroke()}
 if(wm<=5000){c.fillStyle='rgba(168,120,96,.85)';const sz=Math.max(1.2,8*k);for(const [key,arr] of WORLD.BCH){const q=key.split(',');const bx=(+q[0]+.5)*WORLD.CSZ-WORLD.WS,bz=(+q[1]+.5)*WORLD.CSZ-WORLD.WS;if(bx<x0-80||bx>x1+80||bz<z0-80||bz>z1+80)continue;for(const b of arr)c.fillRect(X(b.x)-sz/2,Z(b.z)-sz/2,sz,sz)}}
 c.strokeStyle='#4aa3bd';for(let i=0;i<WORLD.RV.length-1;i++){const a=WORLD.RV[i],b=WORLD.RV[i+1];if(a.x<x0||a.x>x1||a.z<z0||a.z>z1)continue;c.lineWidth=Math.max(1.5,a.hw*2*k);c.beginPath();c.moveTo(X(a.x),Z(a.z));c.lineTo(X(b.x),Z(b.z));c.stroke()}}
const ZN=['Centro storico','Porto','Lungomare','Zona industriale','Quartieri moderni','Colline residenziali','Periferia','Montagna','Paese – case','Paese – centro','Milano – centro','Milano – semicentro','Milano – periferia','Milano – grattacieli','Campagna','Autostrada','Como – centro storico','Como – quartieri','Genova – centro storico','Genova – quartieri'];
const LMK=[['Duomo',-30,282,1],['Castello',-180,720,1],['Faro',-1890,1500,1],['Porto',-500,100,1],['Stadio',900,500,1],['Carcere',-1700,-1250,1],['Bar da Gino',12,5,0],['Vulcano',2150,-1950,2],['Zona industriale',915,-590,1],['Lungomare',WORLD.coastX(-700)+90,-700,1],['Rivarolo',WORLD.TOWN.cx,WORLD.TOWN.cz,2]];
for(const M of WORLD.MWS||[]){for(const s of M.sa){const q=M.p(s.s,60);LMK.push(['Area di servizio '+s.name,q[0],q[1],1])}for(const c of M.ic){const q=M.p(c.s,370*c.tside);LMK.push(['Casello '+c.name,q[0],q[1],1])}for(const b of M.bar){const q=M.p(b.s,40);LMK.push(['Barriera '+b.name,q[0],q[1],1])}{const q=M.p(2000,-120);LMK.push([M.name+' verso '+M.dest1,q[0],q[1],2])}}
for(const t of WORLD.TOWNS)if(t.name!=='Rivarolo')LMK.push([t.name,t.x,t.z,2]);
{const MI=WORLD.MILAN;if(MI&&MI.spec){LMK.push(['Milano',MI.x,MI.z+600,2]);for(const sp of MI.spec)LMK.push([sp.name,sp.x,sp.z,sp.t==='mduomo'||sp.t==='mcastello'||sp.t==='stazione'||sp.t==='mstadio'?1:0])}}
for(const c of WORLD.CITIES||[]){LMK.push([c.name,c.x,c.z+520,2]);if(c.spec)for(const sp of c.spec)if(sp.t==='porto'||sp.t==='mstadio'||sp.t==='church')LMK.push([sp.name,sp.x,sp.z,sp.t==='church'?0:1])}
if(WORLD.LAKE)LMK.push(['Lago',WORLD.LAKE.x,WORLD.LAKE.z,2]);
let mmT=0,znT=0,znLast=-1,mmFrame=0;
function arrow(c,x,y,a,s){c.save();c.translate(x,y);c.rotate(a);c.fillStyle='#ff3b30';c.strokeStyle='#fff';c.lineWidth=2;c.beginPath();c.moveTo(0,-s);c.lineTo(s*.7,s*.85);c.lineTo(0,s*.45);c.lineTo(-s*.7,s*.85);c.closePath();c.fill();c.stroke();c.restore()}
function drawMini(){const mm=$('#mm'),c=mm.getContext('2d'),px=inCar?C.x:P.x,pz=inCar?C.z:P.z,wm=760;mmFrame++;
 if(mmFrame%6===1){const b=MAPC.getContext('2d');drawTerrain(b,256,px,pz,wm,32);drawRoads(b,256,px,pz,wm,false);MAPC.cx=px;MAPC.cz=pz}
 c.save();c.clearRect(0,0,240,240);c.beginPath();c.arc(120,120,118,0,6.2832);c.clip();const kb=256/wm,bxp=(MAPC.cx+wm/2-px)*kb,bzp=(MAPC.cz+wm/2-pz)*kb;c.drawImage(MAPC,120-bxp*(240/256),120-bzp*(240/256),240,240);c.restore();arrow(c,120,120,-(inCar?C.h:yaw),13)}
function drawMap(){const mc=$('#mc'),c=mc.getContext('2d'),W=mc.width,px=inCar?C.x:P.x,pz=inCar?C.z:P.z,wm=MAPV.levels[MAPV.zoom],cxm=px+MAPV.ox,czm=pz+MAPV.oz,k=W/wm,X=x=>(cxm+wm/2-x)*k,Z=z=>(czm+wm/2-z)*k;
 c.fillStyle='#12202c';c.fillRect(0,0,W,W);drawTerrain(c,W,cxm,czm,wm,wm>20000?72:96);drawRoads(c,W,cxm,czm,wm,wm>20000);
 c.font='bold '+(wm>20000?18:22)+'px system-ui,sans-serif';c.textAlign='center';c.lineWidth=5;c.strokeStyle='rgba(0,0,0,.65)';
 for(const q of LMK){if(wm>20000&&q[3]<1)continue;if(wm>5000&&q[3]<1)continue;const x=X(q[1]),y=Z(q[2]);if(x<-40||x>W+40||y<-20||y>W+20)continue;c.fillStyle='#ffd23f';c.beginPath();c.arc(x,y,5,0,6.2832);c.fill();c.fillStyle='#fff';c.strokeText(q[0],x,y-12);c.fillText(q[0],x,y-12)}
 arrow(c,X(px),Z(pz),-(inCar?C.h:yaw),16);
 // scala
 const sc=wm>20000?10000:wm>5000?2000:wm>3000?1000:500,sw=sc*k;c.fillStyle='rgba(0,0,0,.55)';c.fillRect(14,W-34,sw+12,24);c.fillStyle='#fff';c.fillRect(20,W-16,sw,3);c.font='bold 13px system-ui,sans-serif';c.textAlign='left';c.fillText((sc>=1000?(sc/1000)+' km':sc+' m'),20,W-20);
 const mt=$('#mt');if(mt)mt.textContent='Mappa · finestra '+(wm/1000).toFixed(wm<5000?1:0)+' km · trascina per spostare, −/+ per lo zoom'}
