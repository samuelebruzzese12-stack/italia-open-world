/* ===== Milano: cerchie concentriche, radiali, reticolo di isolati, centro storico, monumenti (Duomo, Galleria, Scala, Castello e parco, Stazione Centrale, grattacieli, stadio), Navigli ===== */
const MI=MILAN,XM=MI.x,ZM=MI.z,R1=MI.R[0],R2=MI.R[1],R3=MI.R[2],R4=MI.R[3];
PADS.push({x:XM,z:ZM,r0:4100,r1:4800,h:MI.h});
RGN.push({x0:XM-R1-80,x1:XM+R1+80,z0:ZM-R1-80,z1:ZM+R1+80});
const mp=(a,r)=>[XM+Math.cos(a)*r,ZM+Math.sin(a)*r];
/* luoghi notevoli definiti prima di tutto: le loro riserve guidano cerchie, reticolo e vicoli */
MI.duomo={x:XM+30,z:ZM};MI.piazza={x:XM+210,z:ZM};MI.galleria={x:XM+175,z:ZM+135};MI.scala={x:XM+140,z:ZM+255};MI.velasca={x:XM-230,z:ZM-210};
RESX.push({x:MI.duomo.x,z:MI.duomo.z,a:0,w:200,d:130},{x:MI.piazza.x,z:MI.piazza.z,a:0,w:190,d:150},{x:MI.galleria.x,z:MI.galleria.z,a:0,w:135,d:125},{x:MI.scala.x,z:MI.scala.z,a:0,w:100,d:70},{x:MI.velasca.x,z:MI.velasca.z,a:0,w:70,d:70});
{const a=Math.PI/4,c=mp(a,775),p=mp(a,1060),arc=mp(a,1245);MI.castello={x:c[0],z:c[1],a:a};MI.parco={x:p[0],z:p[1],a:a,w:400,d:330};MI.arco={x:arc[0],z:arc[1],a};RESX.push({x:c[0],z:c[1],a,w:250,d:250},{x:p[0],z:p[1],a,w:420,d:350},{x:arc[0],z:arc[1],a,w:90,d:60})}
{const a=Math.PI/2+.12,c=mp(a,1650);MI.towers={x:c[0],z:c[1],a:0,w:620,d:460};RESX.push({x:c[0],z:c[1],a:0,w:76,d:76})}
{const a=3*Math.PI/8,c=mp(a,1900);MI.stazione={x:c[0],z:c[1],a:a+Math.PI/2,ang:a};RESX.push({x:c[0],z:c[1],a:a+Math.PI/2,w:240,d:160});const f=mp(a,1775);RESX.push({x:f[0],z:f[1],a:a+Math.PI/2,w:240,d:100});MI.piazzaStaz={x:f[0],z:f[1],a:a+Math.PI/2}}
{const a=.13,c=mp(a,3250);MI.stadio={x:c[0],z:c[1],a:a};RESX.push({x:c[0],z:c[1],a:a,w:340,d:280})}
/* raggio delle cerchie con lieve irregolarità e rigonfiamento intorno al Castello (asse a 45°) */
const rr=MI.rr;
const RINGS=[{R:R1,n:24,wob:MI.wob[0],k:7,nm:'Cerchia dei Navigli',av:1},{R:R2,n:32,wob:MI.wob[1],k:7,nm:'Viali dei Bastioni',av:1},{R:R3,n:48,wob:MI.wob[2],k:7,nm:'Circonvallazione',av:1},{R:R4,n:48,wob:MI.wob[3],k:4,nm:'Tangenziale'}];
for(const rg of RINGS){rg.pts=[];for(let i=0;i<=rg.n;i++){const a=i/rg.n*2*Math.PI;rg.pts.push(mp(a,rr(a,rg.R,rg.wob)))}rg.pts[rg.n]=rg.pts[0];rg.ids=addPath(rg.pts,KD[rg.k].w,rg.k,{nm:rg.nm,av:rg.av,ring:1})}
MI.rings=RINGS;
const ringPt=(rg,a)=>{const i=Math.round(((a%(2*Math.PI))+2*Math.PI)%(2*Math.PI)/(2*Math.PI)*rg.n)%rg.n;return rg.pts[i]};
/* radiali: 8 viali dalla Cerchia dei Navigli alla tangenziale; 8 intermedi dai Bastioni alla tangenziale; via d'ingresso dall'autostrada = radiale est */
MI.radials=[];
for(let i=0;i<8;i++){const a=i*Math.PI/4,pts=[];
 if(i===1){pts.push(ringPt(RINGS[0],a));MI.castleGate=pts[0]}   // il viale a 45° si ferma al Castello e riparte oltre il parco (Corso Sempione)
 else pts.push(ringPt(RINGS[0],a));
 for(let r=R1+150;r<R2-60;r+=150)if(!(i===1&&r<R2-60))pts.push(mp(a,r));
 pts.push(ringPt(RINGS[1],a));for(let r=R2+200;r<R3-120;r+=200)pts.push(mp(a,r));pts.push(ringPt(RINGS[2],a));for(let r=R3+200;r<R4-120;r+=200)pts.push(mp(a,r));pts.push(ringPt(RINGS[3],a));
 const name=['Corso Vercelli','Corso Sempione','Viale Zara','Viale Monza','Corso Buenos Aires','Corso Lodi','Via Ripamonti','Corso Genova'][i];
 if(i===1){addPath(pts.slice(0,1).concat([]),20,7,{});const q=[mp(a,R2-20)].concat(pts.slice(2));addPath(q,20,7,{nm:name,av:1,radial:i})}
 else addPath(pts,20,7,{nm:name,av:1,radial:i});MI.radials.push({i,a,pts,name})}
for(let i=0;i<8;i++){const a=i*Math.PI/4+Math.PI/8,pts=[ringPt(RINGS[1],a)];for(let r=R2+200;r<R3-120;r+=200)pts.push(mp(a,r));pts.push(ringPt(RINGS[2],a));for(let r=R3+200;r<R4-120;r+=200)pts.push(mp(a,r));pts.push(ringPt(RINGS[3],a));
 if(i===1){const A=pts.filter(q=>Math.hypot(q[0]-XM,q[1]-ZM)<1690),B=pts.filter(q=>Math.hypot(q[0]-XM,q[1]-ZM)>2030);A.push(mp(a,1718));B.unshift(mp(a,2010));addPath(A,13,0,{nm:'Via Vittor Pisani',radial:i+.5});addPath(B,13,0,{nm:'Viale Zara',radial:i+.5});const n=[-Math.sin(a),Math.cos(a)];for(const sd of [1,-1])addPath([mp(a,1718),[mp(a,1718)[0]+n[0]*sd*140,mp(a,1718)[1]+n[1]*sd*140],[mp(a,2010)[0]+n[0]*sd*140,mp(a,2010)[1]+n[1]*sd*140],mp(a,2010)],13,0,{nm:sd>0?'Via Sammartini':'Via Pirelli'})}
 else addPath(pts,13,0,{nm:'Viale',radial:i+.5})}
/* reticolo di isolati per settore fra Navigli e Circonvallazione (vie 10 m), più rado fra Circonvallazione e Tangenziale (vie 8,5 m): reticolo esplicito di nodi, estremi agganciati a cerchie e radiali */
function gridSector(i,rIn,rOut,sp,sq,w,k,wIn,wOut){const a0=i*Math.PI/4,a1=a0+Math.PI/4,am=(a0+a1)/2,px=Math.cos(am),pz=Math.sin(am),qx=-Math.sin(am),qz=Math.cos(am);
 const inW=(x,z)=>{const dx=x-XM,dz=z-ZM,r=Math.hypot(dx,dz),aa=Math.atan2(dz,dx);let a=((aa-a0)%(2*Math.PI)+2*Math.PI)%(2*Math.PI);return a<Math.PI/4&&r>rr(aa,rIn,wIn)+22&&r<rr(aa,rOut,wOut)-22&&!RES(x,z)};
 const half=rOut*Math.tan(Math.PI/8)+40,NJ=Math.ceil((rOut-rIn)/sp)+1,NK=Math.ceil(2*half/sq)+1,P=[],Qv=[];
 for(let j=0;j<NJ;j++)P.push(rIn+sp*(j+.5)+(hsh(i*7+j,3)-.5)*10);for(let kk=0;kk<NK;kk++)Qv.push(-half+sq*kk+(hsh(kk,i*5+1)-.5)*10);
 const W2=(j,kk)=>[XM+px*P[j]+qx*Qv[kk],ZM+pz*P[j]+qz*Qv[kk]];
 const edge=(a,b)=>{   // da a (dentro) verso b (fuori): ultimo punto dentro, poi aggancio alla strada vicina (cerchia/radiale)
  let lo=0,hi=1;for(let it=0;it<14;it++){const m=(lo+hi)/2,x=a[0]+(b[0]-a[0])*m,z=a[1]+(b[1]-a[1])*m;if(inW(x,z))lo=m;else hi=m}
  const x=a[0]+(b[0]-a[0])*hi,z=a[1]+(b[1]-a[1])*hi,n=nearRoad(x,z,26,-9,-9,-9,-9);if(!n)return null;if(RES(n.x,n.z))return null;return[n.x,n.z]};
 for(let j=0;j<NJ;j++)for(let kk=0;kk<NK;kk++){const a=W2(j,kk);if(!inW(a[0],a[1]))continue;
  for(const [dj,dk] of [[1,0],[0,1],[-1,0],[0,-1]]){const j2=j+dj,k2=kk+dk;if(j2<0||j2>=NJ||k2<0||k2>=NK){const b=[a[0]+(dj*px+dk*qx)*sp,a[1]+(dj*pz+dk*qz)*sp];const e=edge(a,b);if(e&&Math.hypot(e[0]-a[0],e[1]-a[1])>12)addPath([a,e],w,k,{nm:'Via'});continue}
   const b=W2(j2,k2);if(inW(b[0],b[1])){if((dj>0||dk>0)&&!RES((a[0]+b[0])/2,(a[1]+b[1])/2)&&!RES(a[0]*.75+b[0]*.25,a[1]*.75+b[1]*.25)&&!RES(a[0]*.25+b[0]*.75,a[1]*.25+b[1]*.75))addPath([a,b],w,k,{nm:'Via'})}else{const e=edge(a,b);if(e&&Math.hypot(e[0]-a[0],e[1]-a[1])>12&&!RES((a[0]+e[0])/2,(a[1]+e[1])/2))addPath([a,e],w,k,{nm:'Via'})}}}}
for(let i=0;i<8;i++){gridSector(i,R1,R3,112,122,10,9,MI.wob[0],MI.wob[2]);gridSector(i,R3,R4,215,235,8.5,1,MI.wob[2],MI.wob[3])}
/* centro storico: strade dalla piazza del Duomo verso le porte della cerchia e vicoli organici */
for(let i=0;i<8;i++){const a=i*Math.PI/4,g=ringPt(RINGS[0],a),sx=XM+Math.cos(a)*300,sz=ZM+Math.sin(a)*300;if(RES(sx,sz))continue;addPath([[sx,sz],[(sx+g[0])/2+(hsh(i,3)-.5)*40,(sz+g[1])/2+(hsh(i,5)-.5)*40],g],10,9,{nm:['Via Torino','Via Dante','Via Brera','Corso Garibaldi','Corso Venezia','Corso di Porta Romana','Corso Italia','Via Mazzini'][i]})}
{const pz=MI.piazza;addPath([[pz.x+95,pz.z-75],[pz.x+95,pz.z+75]],10,9,{nm:'Via dei Mercanti'});addPath([[pz.x-95,pz.z-75],[pz.x-95,pz.z+75]],8.5,9,{nm:'Via Mazzini'});addPath([[pz.x-95,pz.z+75],[pz.x+95,pz.z+75]],8.5,9,{nm:'Via Orefici'});addPath([[pz.x-95,pz.z-75],[pz.x+95,pz.z-75]],8.5,9,{nm:'Via Rastrelli'})}
for(let i=0;i<22;i++){const a=i/22*Math.PI*2+rnd()*.25,r=330+rnd()*120;Q.push(walker(XM+Math.cos(a)*r,ZM+Math.sin(a)*r,Math.PI/2-a+(rnd()-.5)*.6,180+rnd()*260,2,null,-9,-9,0))}
while(Q.length&&RS.length<MAXS)grow(Q.shift());
/* Castello Sforzesco e Parco Sempione sull'asse a 45°, Arco della Pace in fondo al parco */
{const a=Math.PI/4,c=[MI.castello.x,MI.castello.z],p=[MI.parco.x,MI.parco.z];
 // strade che costeggiano castello e parco (collegano la cerchia dei Navigli ai Bastioni)
 const n=[-Math.sin(a),Math.cos(a)],ax=[Math.cos(a),Math.sin(a)];for(const sd of [1,-1]){const q=[mp(a-sd*.3,R1),[c[0]-ax[0]*165+n[0]*sd*152,c[1]-ax[1]*165+n[1]*sd*152],[c[0]+n[0]*sd*152,c[1]+n[1]*sd*152],[p[0]+n[0]*sd*215,p[1]+n[1]*sd*215],mp(a+sd*.17,R2)];addPath(q,13,0,{nm:sd>0?'Via Lanza':'Via Legnano',av:1})}}
/* grattacieli di Porta Nuova (a nord), Stazione Centrale (nord-est), stadio (ovest), Navigli (sud-ovest) */
/* Navigli: canale dalla Darsena (sud-ovest della cerchia) verso sud-ovest fino alla circonvallazione, con alzaie su entrambe le rive */
{const a=Math.PI*1.3,pts=[];for(let r=R1+40;r<=R3-80;r+=60){const q=mp(a+Math.sin(r/400)*.05,r);pts.push({x:q[0],z:q[1],hw:10,y:MI.h-1.6})}MI.naviglio=pts;
 let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;for(const p of pts){x0=Math.min(x0,p.x);x1=Math.max(x1,p.x);z0=Math.min(z0,p.z);z1=Math.max(z1,p.z)}RIV.push({pts,x0:x0-40,x1:x1+40,z0:z0-40,z1:z1+40,m:3});
 const n=[-Math.sin(a),Math.cos(a)];for(const sd of [1,-1]){const q=pts.map(p=>[p.x+n[0]*sd*21,p.z+n[1]*sd*21]);addPath(q,8.5,1,{nm:sd>0?'Alzaia Naviglio Grande':'Ripa di Porta Ticinese'})}
 RESF.push((x,z)=>{if(x<x0-20||x>x1+20||z<z0-20||z>z1+20)return false;for(let i=0;i<pts.length-1;i++){const a2=pts[i],b=pts[i+1],dx=b.x-a2.x,dz=b.z-a2.z,l2=dx*dx+dz*dz,t=Math.max(0,Math.min(1,((x-a2.x)*dx+(z-a2.z)*dz)/l2));if(Math.hypot(x-(a2.x+dx*t),z-(a2.z+dz*t))<15)return true}return false})}
/* luoghi speciali di Milano (resi da CHK) */
MI.spec=[{t:'mduomo',x:MI.duomo.x,z:MI.duomo.z,a:0,w:158,d:92,name:'Duomo di Milano'},{t:'mpiazza',x:MI.piazza.x,z:MI.piazza.z,a:0,w:170,d:130,name:'Piazza del Duomo'},{t:'galleria',x:MI.galleria.x,z:MI.galleria.z,a:0,w:116,d:112,name:'Galleria'},{t:'scala',x:MI.scala.x,z:MI.scala.z,a:0,w:96,d:60,name:'Teatro alla Scala'},{t:'velasca',x:MI.velasca.x,z:MI.velasca.z,a:0,w:36,d:36,name:'Torre Velasca'},
 {t:'mcastello',x:MI.castello.x,z:MI.castello.z,a:MI.castello.a-Math.PI/2,w:230,d:230,name:'Castello Sforzesco'},{t:'parco',x:MI.parco.x,z:MI.parco.z,a:MI.parco.a-Math.PI/2,w:330,d:400,name:'Parco Sempione'},{t:'arco',x:MI.arco.x,z:MI.arco.z,a:MI.arco.a-Math.PI/2,w:70,d:40,name:'Arco della Pace'},
 {t:'stazione',x:MI.stazione.x,z:MI.stazione.z,a:MI.stazione.a,w:240,d:200,name:'Stazione Centrale'},{t:'mstadio',x:MI.stadio.x,z:MI.stadio.z,a:MI.stadio.a,w:300,d:260,name:'Stadio'},{t:'spire',x:MI.towers.x,z:MI.towers.z,a:0,w:60,d:60,name:'Torre di Porta Nuova'}];
MILAN.ready=true;
