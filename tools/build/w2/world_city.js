/* ===== Città medie (Como sul lago, Genova sul mare): due cerchie, radiali, reticolo di isolati, centro storico con piazza/duomo/municipio, passeggiata lungo l'acqua, porto o lungolago, stadio ===== */
function planCity(c){const XC=c.x,ZC=c.z,R1=c.R[0],R2=c.R[1],mp=(a,r)=>[XC+Math.cos(a)*r,ZC+Math.sin(a)*r],rr=c.rr;
 const land=(x,z)=>H(x,z)>SEA+1.4&&!(riverQ(x,z)&&RQ.d<RQ.hw+8);
 const resX=(x,z)=>{for(const r of RESX){if(r.r!==undefined){if(Math.hypot(x-r.x,z-r.z)<r.r)return true}else if(r.a!==undefined){const R=(r.w+r.d)/2;if(Math.abs(x-r.x)>R||Math.abs(z-r.z)>R)continue;const cc=Math.cos(r.a),sn=Math.sin(r.a),dx=x-r.x,dz=z-r.z;if(Math.abs(dx*cc+dz*sn)<r.w/2&&Math.abs(-dx*sn+dz*cc)<r.d/2)return true}else if(x>r.x0&&x<r.x1&&z>r.z0&&z<r.z1)return true}return false};   // riserve dei luoghi (non il corridoio autostradale, che arriva fin sul vertice dell'anello)
 RGN.push({x0:XC-R2-120,x1:XC+R2+120,z0:ZC-R2-120,z1:ZC+R2+120});
 /* centro: piazza, duomo e municipio (riserve prima di ogni strada) */
 const A=c.aC||0,ca=Math.cos(A),sa=Math.sin(A),P=(u,v)=>[XC+ca*u-sa*v,ZC+sa*u+ca*v];
 c.spec=[];const sp=(t,p,w,d,e)=>{c.spec.push(Object.assign({t,x:p[0],z:p[1],a:A,w,d,town:c.name},e||{}))};
 {const q=P(0,0);sp('plaza',q,70,46);RESX.push({x:q[0],z:q[1],a:A,w:70+34+10,d:46+10})}
 {const q=P(0,70);sp('church',q,34,54,{name:'Duomo di '+c.name});RESX.push({x:q[0],z:q[1],a:A,w:46,d:66})}
 {const q=P(90,0);sp('hall',q,36,30,{name:'Palazzo comunale di '+c.name});RESX.push({x:q[0],z:q[1],a:A,w:48,d:42})}
 /* stadio e altri luoghi fuori dal centro (riserve) */
 if(c.stadio!==undefined){const q=mp(c.stadio,R2-420);c.spec.push({t:'mstadio',x:q[0],z:q[1],a:c.stadio,w:300,d:260,name:'Stadio di '+c.name});RESX.push({x:q[0],z:q[1],a:c.stadio,w:340,d:280})}
 /* passeggiata lungo l'acqua: polilinea della riva (lago o mare) spostata verso terra (100 m sul lago dalle sponde dolci, 60 m sul mare) */
 const shore=[];
 if(c.water==='lago'){for(let th=Math.PI-1.4;th<=Math.PI+1.4;th+=.006){let lo=.3,hi=1.6;for(let it=0;it<18;it++){const m=(lo+hi)/2,x=LAKE.x+Math.cos(th)*m*LAKE.rx,z=LAKE.z+Math.sin(th)*m*LAKE.rz;if(lakeR(x,z)<1)lo=m;else hi=m}
   const x=LAKE.x+Math.cos(th)*hi*LAKE.rx,z=LAKE.z+Math.sin(th)*hi*LAKE.rz;if(Math.hypot(x-XC,z-ZC)<R2+160)shore.push([x,z])}}
 else{for(let z=ZC-R2-160;z<=ZC+R2+160;z+=24){const x=coastX(z);if(Math.abs(z-ZC)<R2+160)shore.push([x,z])}}   // sul mare la passeggiata segue la costa a 60 m (scarto in x, come il lungomare della città)
 c.shore=shore;
 if(shore.length>3){const q=[];for(let i=0;i<shore.length;i++){const a=shore[Math.max(0,i-1)],b=shore[Math.min(shore.length-1,i+1)],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1,nx=-dz/l,nz=dx/l;   // normale: verso terra se il centro città è da quel lato
    const sgn=((XC-shore[i][0])*nx+(ZC-shore[i][1])*nz)>0?1:-1,off=c.water==='lago'?100:60;if(c.water==='mare')q.push([shore[i][0]+60,shore[i][1]]);else q.push([shore[i][0]+nx*sgn*off,shore[i][1]+nz*sgn*off])}
  const q2=q.filter((p,i)=>i%2===0&&land(p[0],p[1])&&!RES(p[0],p[1]));c.prom=q2;if(q2.length>2){gradePath(q2,.08,8,12);addPath(q2,13,0,{nm:c.water==='lago'?'Lungolago':'Lungomare di '+c.name,av:1});TERM.push({x:q2[0][0],z:q2[0][1],r:40},{x:q2[q2.length-1][0],z:q2[q2.length-1][1],r:40})}}   // la passeggiata può finire a fondo chiuso alle due estremità
 /* cerchie: interna (viali) ed esterna (tangenziale); i tratti sull'acqua sono omessi e gli estremi a riva si collegano alla passeggiata */
 const RINGS=[{R:R1,n:c.n[0],wob:c.wob[0],k:7,nm:'Viali di '+c.name,av:1},{R:R2,n:c.n[1],wob:c.wob[1],k:4,nm:'Tangenziale di '+c.name}];
 for(const rg of RINGS){rg.pts=[];rg.ok=[];for(let i=0;i<rg.n;i++){const a=i/rg.n*2*Math.PI,p=mp(a,rr(a,rg.R,rg.wob));rg.pts.push(p);rg.ok.push(land(p[0],p[1])&&!resX(p[0],p[1])&&(c.water!=='mare'||p[0]-coastX(p[1])>230))}   // sul mare la tangenziale si ferma prima della fascia costiera (passeggiata e porto)
  let start=rg.ok.indexOf(false);if(start<0){const pts=rg.pts.concat([rg.pts[0]]);rg.ids=addPath(pts,KD[rg.k].w,rg.k,{nm:rg.nm,av:rg.av,ring:1});continue}
  rg.ids=[];let run=[];const flush=()=>{if(run.length>1){rg.ids=rg.ids.concat(addPath(run,KD[rg.k].w,rg.k,{nm:rg.nm,av:rg.av,ring:1}));for(const e of [run[0],run[run.length-1]]){const nr=nearRoad(e[0],e[1],300,-9,-9,-9,-9);if(nr&&nr.d>3&&!RES((e[0]+nr.x)/2,(e[1]+nr.z)/2)&&land((e[0]+nr.x)/2,(e[1]+nr.z)/2)){if(nr.t>.02&&nr.t<.98)splitAt(nr.id,nr.x,nr.z);addPath([e,[nr.x,nr.z]],KD[rg.k].w,rg.k,{nm:rg.nm})}}}run=[]};
  for(let k=1;k<=rg.n;k++){const i=(start+k)%rg.n;if(rg.ok[i])run.push(rg.pts[i]);else flush()}flush()}
 c.rings=RINGS;
 const ringPt=(rg,a)=>{const i=Math.round(((a%(2*Math.PI))+2*Math.PI)%(2*Math.PI)/(2*Math.PI)*rg.n)%rg.n;return rg.pts[i]};
 /* radiali: 8 viali dalla cerchia interna alla tangenziale (interrotti all'acqua) */
 c.radials=[];for(let i=0;i<8;i++){const a=i*Math.PI/4,pts=[ringPt(RINGS[0],a)];let cut=false;for(let r=R1+150;r<R2-120;r+=150){const p=mp(a,r);if(!land(p[0],p[1])||RES(p[0],p[1])){cut=true;break}pts.push(p)}if(!cut){const e=ringPt(RINGS[1],a);if(land(e[0],e[1]))pts.push(e)}
  if(pts.length>1){addPath(pts,13,0,{nm:(c.rnames&&c.rnames[i])||'Viale',av:1,radial:i});c.radials.push({i,a,pts})}}
 /* reticolo di isolati per settore fra le due cerchie (vie 10 m): nodi espliciti, estremi agganciati a cerchie, radiali e passeggiata */
 function gridSector(i,rIn,rOut,sp_,sq,w,k,wIn,wOut){const a0=i*Math.PI/4,a1=a0+Math.PI/4,am=(a0+a1)/2,px=Math.cos(am),pz=Math.sin(am),qx=-Math.sin(am),qz=Math.cos(am);
  const inW=(x,z)=>{const dx=x-XC,dz=z-ZC,r=Math.hypot(dx,dz),aa=Math.atan2(dz,dx);let a=((aa-a0)%(2*Math.PI)+2*Math.PI)%(2*Math.PI);return a<Math.PI/4&&r>rr(aa,rIn,wIn)+22&&r<rr(aa,rOut,wOut)-22&&!RES(x,z)&&land(x,z)};
  const half=rOut*Math.tan(Math.PI/8)+40,NJ=Math.ceil((rOut-rIn)/sp_)+1,NK=Math.ceil(2*half/sq)+1,Pj=[],Qv=[];
  for(let j=0;j<NJ;j++)Pj.push(rIn+sp_*(j+.5)+(hsh(i*7+j,3)-.5)*10);for(let kk=0;kk<NK;kk++)Qv.push(-half+sq*kk+(hsh(kk,i*5+1)-.5)*10);
  const W2=(j,kk)=>[XC+px*Pj[j]+qx*Qv[kk],ZC+pz*Pj[j]+qz*Qv[kk]];
  const edge=(a,b)=>{let lo=0,hi=1;for(let it=0;it<14;it++){const m=(lo+hi)/2,x=a[0]+(b[0]-a[0])*m,z=a[1]+(b[1]-a[1])*m;if(inW(x,z))lo=m;else hi=m}
   const x=a[0]+(b[0]-a[0])*hi,z=a[1]+(b[1]-a[1])*hi,n=nearRoad(x,z,30,-9,-9,-9,-9);if(!n)return null;if(RES(n.x,n.z))return null;return[n.x,n.z]};
  for(let j=0;j<NJ;j++)for(let kk=0;kk<NK;kk++){const a=W2(j,kk);if(!inW(a[0],a[1]))continue;
   for(const [dj,dk] of [[1,0],[0,1],[-1,0],[0,-1]]){const j2=j+dj,k2=kk+dk;if(j2<0||j2>=NJ||k2<0||k2>=NK){const b=[a[0]+(dj*px+dk*qx)*sp_,a[1]+(dj*pz+dk*qz)*sp_];const e=edge(a,b);if(e&&Math.hypot(e[0]-a[0],e[1]-a[1])>12)addPath([a,e],w,k,{nm:'Via'});continue}
    const b=W2(j2,k2);if(inW(b[0],b[1])){if((dj>0||dk>0)&&!RES((a[0]+b[0])/2,(a[1]+b[1])/2)&&land((a[0]+b[0])/2,(a[1]+b[1])/2))addPath([a,b],w,k,{nm:'Via'})}else{const e=edge(a,b);if(e&&Math.hypot(e[0]-a[0],e[1]-a[1])>12&&!RES((a[0]+e[0])/2,(a[1]+e[1])/2))addPath([a,e],w,k,{nm:'Via'})}}}}
 for(let i=0;i<8;i++)gridSector(i,R1,R2,118,128,10,9,c.wob[0],c.wob[1]);
 /* centro storico: vie dalla piazza alle porte della cerchia interna e vicoli organici */
 for(let i=0;i<8;i++){const a=i*Math.PI/4+A,g=ringPt(RINGS[0],a),sx=XC+Math.cos(a)*150,sz=ZC+Math.sin(a)*150;if(RES(sx,sz)||!land(sx,sz)||!land(g[0],g[1]))continue;addPath([[sx,sz],[(sx+g[0])/2+(hsh(i,3)-.5)*40,(sz+g[1])/2+(hsh(i,5)-.5)*40],g],10,9,{nm:(c.cnames&&c.cnames[i])||'Via'})}
 {const q=[P(-60,-32),P(-60,32),P(60,32),P(60,-32)];addPath([q[0],q[1]],8.5,9,{nm:'Via'});addPath([q[1],q[2]],8.5,9,{nm:'Via'});addPath([q[2],q[3]],8.5,9,{nm:'Via'});addPath([q[3],q[0]],8.5,9,{nm:'Via'})}
 for(let i=0;i<28;i++){const a=i/28*Math.PI*2+rnd()*.25,r=150+rnd()*160,x=XC+Math.cos(a)*r,z=ZC+Math.sin(a)*r;if(!land(x,z)||RES(x,z))continue;Q.push(walker(x,z,Math.PI/2-a+(rnd()-.5)*.8+(i%2?Math.PI:0),200+rnd()*320,2,null,-9,-9,0))}
 while(Q.length&&RS.length<MAXS)grow(Q.shift());
 /* porto (Genova): moli, navi e gru davanti alla passeggiata */
 if(c.water==='mare'&&c.prom&&c.prom.length>6){const m=c.prom[Math.floor(c.prom.length*.5)],m2=c.prom[Math.floor(c.prom.length*.5)+2],ang=Math.atan2(m2[1]-m[1],m2[0]-m[0]);c.spec.push({t:'porto',x:coastX(m[1])-60,z:m[1],a:ang,w:420,d:600,name:'Porto di '+c.name});c.porto={x:coastX(m[1])-60,z:m[1]}}
 c.ready=true}
for(const c of CITIES)planCity(c);
