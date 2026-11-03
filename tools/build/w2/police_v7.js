/* ===== POLIZIA v7: caselli attraversati in corsia ===== */
/* davanti a un casello o a una barriera la pattuglia sceglie una corsia libera fra le cabine, ci si allinea e la percorre (al massimo ~60 km/h) */
function pdTollLane(u){if(u.utm||u.rev>0||u.piv>0||u.status==='holding'||u.status==='disabled'||(u.assign&&u.assign.kind==='block'&&u.assign.phase==='held'))return;
 const sn=Math.sin(u.h),cn=Math.cos(u.h),sp=Math.max(0,u.fwd);let q=null,dAh=0;
 for(const a of [0,10,20,32,46,64]){if(a>18+sp*1.6)break;const b=pdBestSeg(u.x+sn*a,u.z+cn*a,9,u.h);if(b&&b.s.tp&&b.s.lanes){q=b;dAh=a;break}}
 if(!q){u.tlSeg=undefined;return}
 const s=q.s,L=s.len||1,ux=(s.bx-s.ax)/L,uz=(s.bz-s.az)/L,sg=(ux*sn+uz*cn)>=0?1:-1,dx=ux*sg,dz=uz*sg;
 // corsia: la più vicina alla posizione laterale, scegliendo fra quelle senza auto ferme davanti; tenuta fino all'uscita dal casello
 if(u.tlSeg!==q.id||u.tlLane===undefined){const lat=(u.x-s.ax)*(-dz)+(u.z-s.az)*dx;let best=null,bs=1e9;
  for(const l of s.lanes){let pen=Math.abs(l-lat);for(const c of CARS){const rx=c.x-u.x,rz=c.z-u.z,al=rx*sn+rz*cn;if(al<0||al>dAh+40)continue;const cl=(c.x-s.ax)*(-dz)+(c.z-s.az)*dx;if(Math.abs(cl-l)<2.2)pen+=c.v<3?9:3}
   for(const o of PD.units){if(o===u||o.status==='gone')continue;const rx=o.x-u.x,rz=o.z-u.z,al=rx*sn+rz*cn;if(al<0||al>dAh+30)continue;const ol=(o.x-s.ax)*(-dz)+(o.z-s.az)*dx;if(Math.abs(ol-l)<2.2)pen+=4}
   if(pen<bs){bs=pen;best=l}}u.tlSeg=q.id;u.tlLane=best}
 const la=u.tlLane,t=((u.x-s.ax)*ux+(u.z-s.az)*uz)/L,px=s.ax+(s.bx-s.ax)*pdClamp(t,0,1),pz=s.az+(s.bz-s.az)*pdClamp(t,0,1),ah=pdClamp(5+sp*.5,6,16),tx=px+dx*ah-dz*la,tz=pz+dz*ah+dx*la;
 const err=pdWrap(Math.atan2(tx-u.x,tz-u.z)-u.h),w=dAh===0?1:pdClamp(1.15-dAh/50,.35,1);u.ix=pdClamp(u.ix*(1-w)-err*2.2*w,-1,1);
 const vmax=dAh===0?17:Math.sqrt(17*17+2*9*Math.max(0,dAh-6));if(u.fwd>vmax)u.iy=Math.min(u.iy,pdClamp((vmax-u.fwd)*.45,-1,0));u.blk=false}
/* ===== POLIZIA v7: attacco coordinato ad alto livello (niente trenino) =====
   La centrale assegna a ogni pattuglia vicina una posizione tattica attorno al veicolo (dietro, ai lati, dietro a sinistra/destra,
   davanti, seconda fila) tenendo conto della larghezza della strada e di dove sta il veicolo; ognuna guida verso la propria
   posizione (stessa scia, ma spostata di lato), quindi si aprono a ventaglio invece di accodarsi. Con 4–5 stelle speronano da
   dietro e dai lati; quelle in più tagliano per strade parallele per sbucare davanti. */
const PDWANT=[0,3,6,9,12,15];
function pdWant(c){const st=Math.max(1,Math.min(5,Math.round(c.heat)));return Math.min(PD.cfg.maxChasers,PDWANT[st])}
const PITBASE={vmax:30,cool:14,maxFails:2,straight:36,clear:30,side:5};
function pdPitHeat(st){const P=PD.cfg.pit;if(st>=4){P.vmax=42;P.cool=7;P.maxFails=4;P.straight=24;P.clear=20;P.side=3.6}else Object.assign(P,PITBASE)}
function pdTargetLat(T){const tq=T.seg,s=tq&&tq.s;if(!s)return{W:9,tl:0};const L=s.len||1,ux=(s.bx-s.ax)/L,uz=(s.bz-s.az)/L,sg=(ux*T.dx+uz*T.dz)>=0?1:-1,dx=ux*sg,dz=uz*sg;return{W:s.w,tl:(T.x-s.ax)*(-dz)+(T.z-s.az)*dx}}
function pdSlotsFor(c,T){const st=Math.max(1,Math.min(5,Math.round(c.heat))),g=pdTargetLat(T),hw=g.W/2,roomR=hw-g.tl-1.1,roomL=hw+g.tl-1.1,ram=st>=4,S=[],v=T.sp;
 // distanze che crescono con la velocità (a 130 km/h la seconda fila sta a 25–35 m), lati più larghi dove la strada lo consente
 S.push({k:'R0',gap:ram?Math.max(3.4,v*.12):Math.max(st>=3?6:9,v*.3),lat:0});
 if(roomL>=2.7)S.push({k:'SL',gap:.6,lat:-Math.min(3.4,roomL)});
 if(roomR>=2.7)S.push({k:'SR',gap:.6,lat:Math.min(3.4,roomR)});
 const gR=Math.max(10,v*.45);S.push({k:'RL',gap:gR,lat:-(roomL>=2.5?Math.min(2.9,roomL):1)});S.push({k:'RR',gap:gR,lat:roomR>=2.5?Math.min(2.9,roomR):1});
 if(st>=3)S.push({k:'F0',gap:v<24?-15:-(10+v*.4),lat:0});   // davanti: chi è già davanti al veicolo lo chiude (anche in autostrada)
 const o=(r,x)=>r>=2?x:.6,g2=Math.max(18,v*.8),g3=Math.max(26,v*1.1),dg=Math.max(8,v*.25),sg=T.seg&&T.seg.s;
 if(sg&&sg.mw&&!sg.tp&&!sg.ramp&&g.W>=12){   // autostrada: tre colonne allineate alle corsie (sinistra, quella del veicolo, destra; a destra anche la corsia d'emergenza)
  S.push({k:'R2',gap:g2,lat:-3.7},{k:'R3',gap:g2,lat:3.7},{k:'R4',gap:g3,lat:0},{k:'R5',gap:g3+dg,lat:-3.7},{k:'R6',gap:g3+dg,lat:3.7},{k:'R7',gap:g3+2*dg,lat:0});
  const LN=[-4.8,-1.1,2.6,5.6];for(const q of S){if(!q.lat)continue;const a=g.tl+q.lat;let bi=0;for(let k=1;k<4;k++)if(Math.abs(LN[k]-a)<Math.abs(LN[bi]-a))bi=k;if(bi===3&&q.k!=='SR'&&q.k!=='RR')bi=2;q.lat=LN[bi]-g.tl}
  return S}
 S.push({k:'R2',gap:g2,lat:-o(roomL,1.4)},{k:'R3',gap:g2,lat:o(roomR,1.4)},{k:'R4',gap:g3,lat:0},{k:'R5',gap:g3+dg,lat:-o(roomL,1.4)},{k:'R6',gap:g3+dg,lat:o(roomR,1.4)},{k:'R7',gap:g3+2*dg,lat:0});
 return S}
function pdFormation(c,mem){const T=PD.T;if(!T||PD.t-(c.formT||-9)<.4)return;c.formT=PD.t;const st=Math.max(1,Math.min(5,Math.round(c.heat)));pdPitHeat(st);
 const att=mem.filter(u=>u.lod==='near'&&u.status==='chasing'&&!(u.assign&&u.assign.kind==='block')&&!u.icpt&&Math.hypot(u.x-T.x,u.z-T.z)<170&&(u.sees||PD.t-u.seenT<2));
 for(const u of mem)if(att.indexOf(u)<0&&!u.icpt)u.slot=null;
 const S=pdSlotsFor(c,T),used=new Set();
 // durante un PIT il lato da cui arriva chi lo esegue resta libero: la pattuglia di quel lato si tiene indietro
 {const pu=att.find(u=>u.brain.man&&u.brain.man.type==='pit');if(pu){const sd=pu.brain.man.side;for(const s of S)if((s.k==='SL'||s.k==='SR')&&Math.sign(s.lat)===Math.sign(sd))s.gap=Math.max(s.gap,12)}}
 // chi sta già eseguendo una manovra occupa il posto corrispondente
 for(const u of att){const m=u.brain.man;if(!m)continue;u._al=(u.x-T.x)*T.dx+(u.z-T.z)*T.dz;u._lt=(u.x-T.x)*T.rx+(u.z-T.z)*T.rz;const k=m.type==='pit'?'R0':(u._lt<0?'SL':'SR');used.add(k);u.slot={k,gap:0,lat:0,man:1}}
 const free=att.filter(u=>!u.brain.man);for(const u of free){u._al=(u.x-T.x)*T.dx+(u.z-T.z)*T.dz;u._lt=(u.x-T.x)*T.rx+(u.z-T.z)*T.rz}
 const left=new Set(free),out=[],wl=1.5+Math.min(2,T.sp*.06);for(const u of att)if(u._al===undefined||u.brain.man){u._al=(u.x-T.x)*T.dx+(u.z-T.z)*T.dz;u._lt=(u.x-T.x)*T.rx+(u.z-T.z)*T.rz}
 for(const s of S){if(!left.size)break;if(used.has(s.k))continue;let best=null,bc=1e9;
  for(const u of left){const al=-s.gap;if(s.k==='F0'&&u._al<-8)continue;let cost=Math.abs(u._al-al)+wl*Math.abs(u._lt-s.lat);if(u.slot&&u.slot.k===s.k)cost-=8;if(al>u._al+8)cost+=al>0?30:12;
   // attraversare di lato le corsie dei colleghi vicini è pericoloso (alle alte velocità è così che si tamponavano): costa molto
   const lo=Math.min(u._lt,s.lat)+.8,hi=Math.max(u._lt,s.lat)-.8;if(hi>lo)for(const o of att)if(o!==u&&o._lt>lo&&o._lt<hi&&Math.abs(o._al-u._al)<18)cost+=14;
   if(cost<bc){bc=cost;best=u}}
  if(best){left.delete(best);best.slot={k:s.k,gap:s.gap,lat:s.lat,t:PD.t};used.add(s.k);out.push(best.name+':'+s.k)}}
 // le pattuglie rimaste senza posto: in coda sfalsate, oppure (dalle 2 stelle) tagliano per una strada parallela per sbucare davanti
 let nI=mem.filter(u=>u.icpt).length;
 for(const u of left){u.slot={k:'RX',gap:46+6*(u.id%3),lat:(u.id%2?1:-1)*.9,t:PD.t};
  if(st>=2&&nI<3&&T.sp>8&&u._al<-35&&PD.t-(u.icptTry||-99)>6){u.icptTry=PD.t;if(pdPlanIntercept(u,T)){nI++;u.slot=null}}}
 // il posto davanti diventa contenimento (frena davanti al veicolo) quando la pattuglia ci è arrivata
 for(const u of att){if(u.slot&&u.slot.k==='F0'){if(u._al>5)u.role='front';else if(u.role==='front')u.role='support'}else if(u.role==='front')u.role='support'}
 c.form={t:PD.t,list:out,icpt:mem.filter(u=>u.icpt).map(u=>u.name)}}
/* intercettazione: punto davanti sul percorso previsto, raggiunto per strade diverse da quella del veicolo (se esistono) */
function pdPlanIntercept(u,T){const len=pdClamp(T.sp*14,220,520),pr=pdPredict(T.x,T.z,T.dirA,len);if(!pr.ok||pr.pts.length<2)return false;const p=pr.pts[pr.pts.length-1];
 // corridoio del veicolo: tratti sotto il percorso previsto fino al 70% (l'ultimo tratto resta aperto per arrivarci da una laterale)
 const blk=[];let acc=0,tot=0;for(let i=1;i<pr.pts.length;i++)tot+=Math.hypot(pr.pts[i][0]-pr.pts[i-1][0],pr.pts[i][1]-pr.pts[i-1][1]);
 for(let i=0;i<pr.pts.length-1&&acc<tot*.7;i++){const a=pr.pts[i],b=pr.pts[i+1],l=Math.hypot(b[0]-a[0],b[1]-a[1]);for(let f=0;f<1;f+=.34){const q=pdBestSeg(a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f,6);if(q&&!PD.blocked.has(q.id)&&blk.indexOf(q.id)<0)blk.push(q.id)}acc+=l}
 {const q=pdBestSeg(u.x,u.z,8,u.h);if(q){const i=blk.indexOf(q.id);if(i>=0)blk.splice(i,1)}}
 for(const id of blk)PD.blocked.set(id,PD.t+1e6);let r;try{r=pdRoute(u.x,u.z,p[0],p[1],u.h)}finally{for(const id of blk)PD.blocked.delete(id)}
 // se l'unica strada è quella del veicolo il percorso passa "attraverso i blocchi": allora niente taglio, resta in coda
 if(!r||!r.ok||r.viaBlock)return false;const direct=Math.hypot(p[0]-u.x,p[1]-u.z);if(r.len>direct*2.2+350)return false;
 u.icpt={x:p[0],z:p[1],route:r,t0:PD.t};r.ri=1;r.made=PD.t;EV.emit('intercept',{id:u.id,name:u.name,len:Math.round(r.len),place:pdPlace(p[0],p[1])});plog('decisione',u.name+': taglia per una strada parallela ('+Math.round(r.len)+' m) per sbucare davanti',{});return true}
function pdIntercept7(u,T,dt){const I=u.icpt,dT=Math.hypot(T.x-u.x,T.z-u.z),al=(u.x-T.x)*T.dx+(u.z-T.z)*T.dz,dP=Math.hypot(I.x-u.x,I.z-u.z);
 if(PD.t-I.t0>30||dP<25||(u.sees&&dT<70&&al>-10)||!I.route.ok){u.icpt=null;return false}
 pdFollowRoute(u,I.route,Math.max(40,pdRoadV(u)),0,false);return true}
/* esecuzione: guida verso la propria posizione tattica; ai lati, con 4–5 stelle, dopo un attimo affiancata stringe e sperona */
function pdAttack(u,T,dt,d){const c=PD.case;if(!c||c.phase!=='pursuit')return false;
 if(u.icpt&&pdIntercept7(u,T,dt))return true;
 const s=u.slot;if(!s||s.man||!u.sees||d>170)return false;const st=Math.max(1,Math.min(5,Math.round(c.heat)));let lat=s.lat;
 if((s.k==='SL'||s.k==='SR')&&st>=4){const al=(u.x-T.x)*T.dx+(u.z-T.z)*T.dz,lt=(u.x-T.x)*T.rx+(u.z-T.z)*T.rz;if(Math.abs(al+s.gap)<2.4&&Math.abs(lt-s.lat)<1.1)u.sideT=(u.sideT||0)+dt;else u.sideT=0;
  if(u.sideT>.8&&PD.t>(u.slamCool||0)&&T.sp>6){u.slamT=PD.t+.7;u.slamCool=PD.t+3.5;u.sideT=0;EV.emit('sideRam',{id:u.id,name:u.name})}if(PD.t<(u.slamT||0))lat=Math.sign(s.lat)*1.5}
 // separazione dai colleghi: chi è di fianco nella stessa fascia spinge di lato, chi è appena davanti limita la velocità (niente tamponamenti fra pattuglie)
 let cap=99;for(const o of PD.units){if(o===u||o.lod!=='near'||o.status==='gone')continue;const rx=o.x-u.x,rz=o.z-u.z;if(rx*rx+rz*rz>196)continue;const dAl=rx*T.dx+rz*T.dz,dLt=rx*T.rx+rz*T.rz;
  const clo=Math.max(0,u.fwd-o.fwd);if(Math.abs(dAl)<6+clo*.3&&Math.abs(dLt)<2.8)lat-=Math.sign(dLt||(u.id%2?1:-1))*(2.8-Math.abs(dLt))*.9;
  if(dAl>1.5&&dAl<10+clo*.9&&Math.abs(dLt)<2)cap=Math.min(cap,Math.max(0,o.fwd)+(dAl-5.5)*.8)}
 lat=pdLaneFree(u,T,lat);u._slotLat=u.slotLatD=lat;u._aggr=st;u._capV=cap<99?Math.max(0,cap):undefined;try{pdChase(u,T,s.gap,Math.min(56,T.sp+(st>=3?20:14)),dt)}finally{u._slotLat=undefined;u._aggr=undefined;u._capV=undefined;u._laneAbs=undefined}return true}
/* manovre coordinate: una sola manovra dello stesso tipo per volta; con le posizioni assegnate il PIT spetta a chi sta dietro, l'affiancamento a chi sta ai lati */
function pdManOK(u,mn){const c=PD.case;if(!c)return true;if(mn==='flank'&&c.form&&c.form.list&&c.form.list.length>=2)return false;for(const o of PD.units)if(o!==u&&o.case===c.id&&o.brain&&o.brain.man&&o.brain.man.type===mn)return false;
 const s=u.slot;if(!s||s.man)return true;if(mn==='pit')return s.k==='R0';if(mn==='flank')return false;return true}   // con le posizioni assegnate l'affiancamento lo fanno già le pattuglie ai lati
/* auto del traffico davanti: per la frenata d'emergenza conta solo se ci si avvicina troppo in fretta per adeguare la velocità
   (un'auto che rallenta per far passare la sirena o una ferma in corsia sì, una che viaggia a velocità simile no) */
function pdTrMoving(u,b){const c=b.cr;if(!c)return true;const sn=Math.sin(u.h),cn=Math.cos(u.h),va=c.v*(Math.sin(c.h)*sn+Math.cos(c.h)*cn),clo=Math.max(0,u.fwd)-va,al=(c.x-u.x)*sn+(c.z-u.z)*cn;return clo<3||al>clo*clo/12+12}
/* corsia libera: la pattuglia in formazione che trova davanti, nella corsia della sua posizione, un'auto più lenta o un collega fermo
   passa su una corsia vicina libera e torna al suo posto appena la corsia si libera (prima restava dietro all'auto a 60-70 km/h).
   Si ragiona in corsie della carreggiata (posizione laterale misurata sulla strada sotto la pattuglia, non rispetto al veicolo inseguito,
   che può essere centinaia di metri avanti dopo una curva); il passaggio di corsia si fa solo se le corsie attraversate sono libere
   vicino all'auto (prima una pattuglia lanciata a 170 km/h tagliava la corsia centrale davanti a un'auto più lenta e la tamponava).
   Restituisce la posizione laterale rispetto al veicolo; u._laneAbs è la corsia scelta quando la pattuglia non è al suo posto. */
function pdLaneFree(u,T,lat){u._laneAbs=undefined;const rf=pdRoadFrame(u);if(!rf||Math.abs(rf.ang)>.5){u.lnAbs=undefined;return lat}
 const tq=T.seg&&T.seg.s,same=tq&&rf.s&&(tq===rf.s||(tq.mw&&tq.mw===rf.s.mw&&tq.side===rf.s.side));if(!same){u.lnAbs=undefined;return lat}
 const tl=pdTargetLat(T).tl,slotAbs=tl+lat,sk=u.slot?u.slot.k:'',al=(u.x-T.x)*T.dx+(u.z-T.z)*T.dz;
 if(u.lnSlot!==sk){u.lnSlot=sk;u.lnAbs=undefined}
 const mw=rf.s.mw&&!rf.s.tp&&!rf.s.ramp,LW=mw?3.7:3.3,lim=rf.hw-1.1,me=Math.max(0,u.fwd),vW=Math.max(me,T.sp+3);
 const near=(arr,x)=>{let b=arr[0];for(const a of arr)if(Math.abs(a-x)<Math.abs(b-x))b=a;return b};
 const MW=[-4.8,-1.1,2.6];if(mw&&(sk==='SR'||sk==='RR'))MW.push(5.6);
 const slotL=mw?near(MW,slotAbs):slotAbs,curL=mw?near(MW,rf.lat):rf.lat;
 const fin=x=>{u.lnOff=x-slotL;if(Math.abs(x-slotL)>.3||al<-25)u._laneAbs=x;return Math.abs(x-slotL)<.3?lat:x-tl};
 if(u.lnAbs!==undefined&&PD.t<(u.lnEvT||0))return fin(u.lnAbs);u.lnEvT=PD.t+.2;
 let C=mw?MW.slice():[slotAbs,slotAbs-LW,slotAbs+LW,rf.lat];C=C.filter(x=>Math.abs(x)<=lim+.05);if(!C.length){u.lnAbs=undefined;return lat}
 // ostacoli (auto del traffico e colleghi, anche fermi o danneggiati) nella cornice della strada sotto la pattuglia
 const dx=rf.dx,dz=rf.dz,obs=[],put=(x,z,v)=>{const rx=x-u.x,rz=z-u.z;if(rx*rx+rz*rz>150*150)return;obs.push([(x-rf.px)*(-dz)+(z-rf.pz)*dx,rx*dx+rz*dz,v])};
 for(const c of CARS)put(c.x,c.z,c.v*(Math.sin(c.h)*dx+Math.cos(c.h)*dz));
 for(const o of PD.units){if(o===u||o.lod!=='near'||o.status==='gone')continue;put(o.x,o.z,(o.vx||0)*dx+(o.vz||0)*dz)}
 const score=x=>{const lo=Math.min(rf.lat,x),hi=Math.max(rf.lat,x),move=Math.abs(x-rf.lat)>1.2;let t=99;
  for(const q of obs){const inMine=Math.abs(q[0]-rf.lat)<1.9;
   if(move&&q[0]>lo-1.9&&q[0]<hi+1.9){const clo=me-q[2];if(inMine){if(q[1]>-6&&q[1]<6)return -1}else if(q[1]>-(8+Math.max(0,-clo)*2)&&q[1]<8+Math.max(0,clo)*2.2)return -1}
   if(Math.abs(q[0]-x)>2||q[1]<=0||q[2]>=vW-.5)continue;t=Math.min(t,(q[1]-7)/Math.max(.3,vW-q[2]))}
  return t};
 let best=curL,bs=-9;
 for(const x of C){let s=score(x);if(s<0)continue;s=Math.min(s,8);if(Math.abs(x-slotL)<.3)s+=1.5;if(u.lnAbs!==undefined&&Math.abs(x-u.lnAbs)<.3)s+=1;if(s>bs){bs=s;best=x}}
 if(u.lnAbs===undefined||Math.abs(best-u.lnAbs)>.3&&PD.t-(u.lnT||-9)>1){u.lnAbs=best;u.lnT=PD.t}
 return fin(u.lnAbs)}
