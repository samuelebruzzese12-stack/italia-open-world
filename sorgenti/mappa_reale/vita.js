/* ===== VITA (Versione 25): traffico, passanti e polizia sulle strade vere.
   Il traffico e i passanti seguono la rete stradale delle celle caricate (REAL): auto generiche con colori diversi, persone sui marciapiedi.
   La polizia è una versione nuova e compatta scritta per la mappa reale: pattuglie in giro per la città, livello di ricercato (stelle),
   inseguimento lungo le strade e in linea d'aria quando ti vedono, fermo con multa, rinforzi, sirene, lampeggianti, radio con sottotitoli
   e voce. I pulsanti del pannello 🚔 comandano questo sistema. ===== */
const VITA=(()=>{
const SPD={motorway:30,trunk:24,primary:15,secondary:13,tertiary:11,minor:8.5,service:5,busway:10};
const G={ways:[],hash:new Map(),ver:'',cars:[],peds:[],t:0,fr:0};
const HB=50,hk=(x,z)=>Math.floor(x/HB)+','+Math.floor(z/HB);
/* ---------- rete stradale dalle celle caricate ---------- */
function rebuild(){const keys=[];for(const [k,c] of REAL.CELLS)keys.push(k+c.lod);const ver=keys.sort().join('|')+'#'+REAL.GEN;if(ver===G.ver)return;G.ver=ver;
 const ways=[],hash=new Map();let id=0;
 for(const c of REAL.CELLS.values()){for(const n of c.nav||[]){const p=n.p,m=p.length/2;if(m<2)continue;const pts=new Float64Array(m*2),s=new Float64Array(m);for(let i=0;i<m;i++){pts[i*2]=c.X-p[i*2];pts[i*2+1]=c.Z-p[i*2+1];if(i)s[i]=s[i-1]+Math.hypot(pts[i*2]-pts[i*2-2],pts[i*2+1]-pts[i*2-1])}
   const w={id:id++,c:n.c,w:n.w,one:n.one,b:n.b,sw:n.sw&&c.lod==='A',pk:n.pk||0,pts,s,len:s[m-1],m,spd:SPD[n.c]||8,cell:c};ways.push(w);
   for(let i=0;i<m;i++){const k=hk(pts[i*2],pts[i*2+1]);let a=hash.get(k);if(!a)hash.set(k,a=[]);a.push(w,i)}}}
 G.ways=ways;G.hash=hash;
 // agenti su strade sparite: via
 for(const a of G.cars)if(!ways.includes(a.way)){a.way=findWayNear(a.x,a.z,6,a.way);if(!a.way)a.dead=true;else{const q=nearestOn(a.way,a.x,a.z);a.s=q.s}}
 for(const a of G.peds)if(!ways.includes(a.way)){a.way=findWayNear(a.x,a.z,8,null,true);if(!a.way)a.dead=true;else{const q=nearestOn(a.way,a.x,a.z);a.s=q.s}}
 for(const u of PL.units)if(u.way&&!ways.includes(u.way)){u.way=null}}
function near(x,z,r){const out=[],i0=Math.floor((x-r)/HB),i1=Math.floor((x+r)/HB),j0=Math.floor((z-r)/HB),j1=Math.floor((z+r)/HB);for(let i=i0;i<=i1;i++)for(let j=j0;j<=j1;j++){const a=G.hash.get(i+','+j);if(a)for(let q=0;q<a.length;q+=2){const w=a[q],k=a[q+1];if(Math.hypot(w.pts[k*2]-x,w.pts[k*2+1]-z)<=r)out.push(w,k)}}return out}
function findWayNear(x,z,r,exclude,sw){const a=near(x,z,r);let best=null,bd=1e9;for(let q=0;q<a.length;q+=2){const w=a[q];if(w===exclude||(sw&&!w.sw))continue;const k=a[q+1],d=Math.hypot(w.pts[k*2]-x,w.pts[k*2+1]-z);if(d<bd){bd=d;best=w}}return best}
function nearestOn(w,x,z){let best=1e18,bs=0;for(let i=0;i+1<w.m;i++){const ax=w.pts[i*2],az=w.pts[i*2+1],bx=w.pts[i*2+2],bz=w.pts[i*2+3],dx=bx-ax,dz=bz-az,l2=dx*dx+dz*dz||1e-9,t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/l2)),qx=ax+dx*t-x,qz=az+dz*t-z,d2=qx*qx+qz*qz;if(d2<best){best=d2;bs=w.s[i]+Math.sqrt(l2)*t}}return{s:bs,d:Math.sqrt(best)}}
// punto e direzione alla ascissa s (dir ±1)
function at(w,s,dir,out){const S=w.s;let i=0,j=w.m-1;while(j-i>1){const m=(i+j)>>1;if(S[m]<=s)i=m;else j=m}const l=S[i+1]-S[i]||1e-9,t=Math.max(0,Math.min(1,(s-S[i])/l)),ax=w.pts[i*2],az=w.pts[i*2+1],dx=(w.pts[i*2+2]-ax)/l,dz=(w.pts[i*2+3]-az)/l;out.x=ax+dx*l*t;out.z=az+dz*l*t;out.dx=dx*dir;out.dz=dz*dir;out.i=i;return out}
// prossima strada alla fine (o a un incrocio): candidati a ≤ 6 m dal punto, verso ammesso, preferenza a chi prosegue dritto
function nextWay(w,x,z,dx,dz,sw,toward){const a=near(x,z,6),cand=[];for(let q=0;q<a.length;q+=2){const n=a[q],k=a[q+1];if(n===w||(sw&&!n.sw))continue;const endA=k===0,endB=k===n.m-1;let dir=0;
  if(endA)dir=1;else if(endB)dir=-1;else dir=0; // in mezzo a una strada: si può andare in entrambi i versi
  for(const d of (dir?[dir]:[1,-1])){if(!sw&&n.one&&d<0)continue;const p={x:0,z:0};at(n,n.s[k]+d*Math.min(8,n.len*.5)*(d>0?1:1),d,p);const vx=p.x-x,vz=p.z-z,l=Math.hypot(vx,vz)||1,dot=(vx*dx+vz*dz)/l;let sc=dot+.2+Math.random()*.6;if(toward){const d0=Math.hypot(toward[0]-x,toward[1]-z),d1=Math.hypot(toward[0]-p.x,toward[1]-p.z);sc+=(d0-d1)*.3}cand.push({n,k,d,sc})}}
 if(!cand.length)return null;cand.sort((p,q)=>q.sc-p.sc);const c=cand[0];return{w:c.n,s:c.n.s[c.k],dir:c.d}}
function inView(x,z){const dx=x-cam.position.x,dz=z-cam.position.z,d=Math.hypot(dx,dz);if(d>260)return false;const a=Math.atan2(dx,dz),w=Math.abs(Math.atan2(Math.sin(a-yaw),Math.cos(a-yaw)));return w<1.3}
/* ---------- traffico ---------- */
const P2={x:0,z:0,dx:0,dz:0,i:0};
let imCar=null;const NCAR=18,SOL=[];
function carInit(){imCar=new T.InstancedMesh(REAL.CARG.clone(),REAL.MTR.car,NCAR);imCar.count=0;imCar.frustumCulled=false;imCar.castShadow=true;sc.add(imCar);for(let i=0;i<NCAR;i++){const s={x:0,z:0,c:1,s:0,hx:2.15,hz:.9,on:0,nc:1,amb:1,traffic:1};SOL.push(s);solids.push(s)}}
function spawnCar(px,pz){if(!G.ways.length)return;let w=null;for(let k=0;k<12&&!w;k++){const c=G.ways[Math.floor(Math.random()*G.ways.length)];if(!SPD[c.c]||c.len<30)continue;const p={x:0,z:0};const s=Math.random()*c.len;at(c,s,1,p);const d=Math.hypot(p.x-px,p.z-pz);if(d<90||d>330||inView(p.x,p.z)||REAL.wet(p.x,p.z))continue;w=c;const dir=(c.one||Math.random()<.5)?1:-1,off=REAL.laneOff(c.w,c.one,c.pk,dir);
   const a={way:c,s,dir,off,v:0,vmax:c.spd*(.85+Math.random()*.25),x:p.x,z:p.z,h:0,col:Math.floor(Math.random()*REAL.CARCOLS.length),idle:0,hit:0,sol:SOL.find(q=>!q.on)};if(!a.sol)return;a.sol.on=1;G.cars.push(a);CARS.push(a)}}
function carStep(a,dt,px,pz){const w=a.way;if(!w||a.dead){a.dead=true;return}
 // velocità: segue il mezzo davanti, frena per il giocatore e per gli ostacoli, si ferma dopo un urto
 let tv=a.vmax;if(a.hit>0){a.hit-=dt;tv=0}
 at(w,a.s,a.dir,P2);const fx=P2.dx,fz=P2.dz;
 for(const o of G.cars){if(o===a||o.way!==w||o.dir!==a.dir)continue;const g=(o.s-a.s)*a.dir;if(g>0&&g<16){tv=Math.min(tv,g<6?0:o.v*Math.min(1,(g-5)/8))}}
 {const dx=C.x-a.x,dz=C.z-a.z,d=Math.hypot(dx,dz);if(d<18&&d>.1){const ah=(dx*fx+dz*fz)/d;if(ah>.75){tv=Math.min(tv,d<6?0:Math.max(0,Math.hypot(V.vx,V.vz))*Math.min(1,(d-5)/10))}}}
 for(const u of PL.units){const dx=u.x-a.x,dz=u.z-a.z,d=Math.hypot(dx,dz);if(d<16&&d>.1&&(dx*fx+dz*fz)/d>.75&&u.v<a.v+1)tv=Math.min(tv,d<6?0:u.v)}
 if(!a.hit&&a.v>2){const dd=clipDist(a.x,a.z,fx,fz,12,1);if(dd<11)tv=Math.min(tv,dd<5?0:a.v*.5)}
 a.v+=(tv-a.v)*Math.min(1,dt*(tv<a.v?3.2:1.1));
 a.s+=a.v*dt*a.dir;
 if(a.s<0||a.s>w.len){const n=nextWay(w,P2.x,P2.z,fx,fz,false);if(!n){a.dead=true;return}a.way=n.w;a.dir=n.dir;a.s=n.s+n.dir*Math.min(2,n.w.len*.1);a.off=REAL.laneOff(n.w.w,n.w.one,n.w.pk,n.dir);a.vmax=n.w.spd*(.85+Math.random()*.25);at(a.way,a.s,a.dir,P2)}
 else if(a.v>1&&Math.random()<dt*.06){const n=nextWay(w,P2.x,P2.z,fx,fz,false);if(n&&Math.random()<.4&&Math.abs(n.s-(n.w.s[0]))>=0){a.way=n.w;a.dir=n.dir;a.s=n.s+n.dir*1;a.off=REAL.laneOff(n.w.w,n.w.one,n.w.pk,n.dir);a.vmax=n.w.spd*(.85+Math.random()*.25);at(a.way,a.s,a.dir,P2)}}
 const rx=-P2.dz,rz=P2.dx;a.x=P2.x+rx*a.off;a.z=P2.z+rz*a.off;a.h=Math.atan2(P2.dx,P2.dz);
 const s=a.sol;s.x=a.x;s.z=a.z;s.c=Math.sin(a.h);s.s=Math.cos(a.h)}
function carsUpdate(dt,px,pz){for(const a of G.cars){carStep(a,dt,px,pz);const d=Math.hypot(a.x-px,a.z-pz);if(d>420||a.dead){a.dead=true}}
 if(G.cars.some(a=>a.dead)){for(const a of G.cars)if(a.dead){a.sol.on=0;const i=CARS.indexOf(a);if(i>=0)CARS.splice(i,1)}G.cars=G.cars.filter(a=>!a.dead)}
 const want=Math.min(NCAR,Math.round(G.ways.length>40?NCAR:G.ways.length/3));if(G.cars.length<want&&G.fr%4===0)spawnCar(px,pz);
 let n=0;for(const a of G.cars){const y=REAL.ground(a.x,a.z,a.y);_v.set(a.x,y,a.z);_q.setFromAxisAngle(_y,a.h);_s.set(1,1,1);_m4.compose(_v,_q,_s);imCar.setMatrixAt(n,_m4);imCar.setColorAt(n,REAL.CARCOLS[a.col]);a.y=y;n++}
 imCar.count=n;imCar.instanceMatrix.needsUpdate=true;if(imCar.instanceColor)imCar.instanceColor.needsUpdate=true}
// urto del giocatore con un'auto del traffico (chiamato dalla fisica dell'auto)
function carHitBy(sol,imp){if(sol&&sol.traffic){const a=G.cars.find(c=>c.sol===sol);if(a&&a.hit<=0){a.hit=5;if(imp>2)PL.offence('urto con un veicolo',.6,3)}}else if(sol&&sol.police&&imp>2.5)PL.offence('speronamento di una pattuglia',1,3);else if(sol&&sol.parked&&imp>3)PL.offence('urto con un\u2019auto in sosta',.5,2)}
/* ---------- passanti ---------- */
const NPED=26;let imSh,imHd,imLL,imLR;
function pedInit(){const mat=new T.MeshStandardMaterial({vertexColors:true,roughness:.7,metalness:.05}),W1=new T.Color(1,1,1);
 imSh=new T.InstancedMesh(boxGeo([[0,1.08,0,.42,.62,.24,[1,1,1]],[.27,1.05,0,.11,.56,.13,[1,1,1]],[-.27,1.05,0,.11,.56,.13,[1,1,1]]]),mat,NPED);
 imHd=new T.InstancedMesh(boxGeo([[0,1.56,0,.22,.25,.22,[1,1,1]],[0,1.68,-.01,.24,.1,.24,[lin(.12),lin(.1),lin(.08)]]]),mat,NPED);
 const leg=boxGeo([[0,-.39,0,.17,.78,.17,[1,1,1]]]);imLL=new T.InstancedMesh(leg,mat,NPED);imLR=new T.InstancedMesh(leg,mat,NPED);
 for(const m of [imSh,imHd,imLL,imLR]){m.setColorAt(0,W1);m.instanceColor.needsUpdate=true;m.frustumCulled=false;m.castShadow=true;m.count=0;sc.add(m)}}
function spawnPed(px,pz){const sws=G.ways.filter(w=>w.sw&&w.len>25);if(!sws.length)return;for(let k=0;k<10;k++){const w=sws[Math.floor(Math.random()*sws.length)],s=Math.random()*w.len,p={x:0,z:0};at(w,s,1,p);const d=Math.hypot(p.x-px,p.z-pz);if(d<40||d>170||inView(p.x,p.z))continue;
  const a={way:w,s,dir:Math.random()<.5?1:-1,side:Math.random()<.5?1:-1,v:1.05+Math.random()*.6,v0:0,pan:0,x:p.x,z:p.z,h:0,ph:Math.random()*6,sk:SKIN[Math.floor(Math.random()*SKIN.length)],sh:SHIRT[Math.floor(Math.random()*SHIRT.length)],pa:PANTS[Math.floor(Math.random()*PANTS.length)],down:0,stop:0};G.peds.push(a);PEDS.push(a);return}}
function pedStep(a,dt){const w=a.way;if(!w||a.dead){a.dead=true;return}if(a.down>0){a.down-=dt;if(a.down<=0)a.dead=true;return}
 // si ferma se l'auto del giocatore arriva addosso
 const dx=C.x-a.x,dz=C.z-a.z,d=Math.hypot(dx,dz),sp=Math.hypot(V.vx,V.vz);let v=a.v;if(d<7&&sp>2&&(dx*V.vx+dz*V.vz)<0)v=0;if(a.pan)v=Math.max(v,3.2);
 a.s+=v*dt*a.dir;
 if(a.s<0||a.s>w.len){at(w,Math.max(0,Math.min(w.len,a.s)),a.dir,P2);const n=nextWay(w,P2.x,P2.z,P2.dx,P2.dz,true);if(n&&Math.random()<.8){a.way=n.w;a.dir=n.dir;a.s=n.s+n.dir*.5}else{a.dir=-a.dir;a.s=Math.max(0,Math.min(w.len,a.s))}}
 at(a.way,a.s,a.dir,P2);const rx=-P2.dz,rz=P2.dx,off=(a.way.w/2+1.1)*a.side;a.x=P2.x+rx*off;a.z=P2.z+rz*off;a.h=Math.atan2(P2.dx,P2.dz);a.ph+=dt*(a.pan?11:7)*(v>0?1:0);a.mv=v}
function pedsUpdate(dt,px,pz){for(const a of G.peds){pedStep(a,dt);const d=Math.hypot(a.x-px,a.z-pz);if(d>230)a.dead=true;
  // investito: l'auto del giocatore lo tocca a velocità
  if(!a.down&&inCar){const dx=a.x-C.x,dz=a.z-C.z,c=Math.cos(C.h),s=Math.sin(C.h),lx=dx*c-dz*s,lz=dx*s+dz*c;if(Math.abs(lx)<1.05&&Math.abs(lz)<2.35&&Math.hypot(V.vx,V.vz)>2.5){a.down=9;a.downH=C.h;PL.offence('investito un passante',1.5,4);toast('Hai investito un passante!');V.vx*=.85;V.vz*=.85}}}
 if(G.peds.some(a=>a.dead)){for(const a of G.peds)if(a.dead){const i=PEDS.indexOf(a);if(i>=0)PEDS.splice(i,1)}G.peds=G.peds.filter(a=>!a.dead)}
 const want=Math.min(NPED,Math.round(G.ways.filter(w=>w.sw).length*1.2));if(G.peds.length<want&&G.fr%3===1)spawnPed(px,pz);
 let n=0;for(const a of G.peds){const y=REAL.ground(a.x,a.z)+.08,sw=Math.sin(a.ph)*.55*(a.mv>0?1:0),bob=Math.abs(Math.cos(a.ph))*.03;
  if(a.down>0){_v.set(a.x,y+.25,a.z);_q.setFromAxisAngle(_y,a.downH||a.h);const q2=new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),PI/2);_q.multiply(q2);_s.set(1,1,1);_m4.compose(_v,_q,_s);imSh.setMatrixAt(n,_m4);imHd.setMatrixAt(n,_m4);imLL.setMatrixAt(n,_m4);imLR.setMatrixAt(n,_m4)}
  else{_v.set(a.x,y+bob,a.z);_q.setFromAxisAngle(_y,a.h);_s.set(1,1,1);_m4.compose(_v,_q,_s);imSh.setMatrixAt(n,_m4);imHd.setMatrixAt(n,_m4);
   for(const [im,sg] of [[imLL,1],[imLR,-1]]){_v.set(a.x+Math.cos(a.h)*.1*sg,y+.78,a.z-Math.sin(a.h)*.1*sg);const q1=new T.Quaternion().setFromAxisAngle(_y,a.h),q2=new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),sw*sg);q1.multiply(q2);_s.set(1,1,1);_m4.compose(_v,q1,_s);im.setMatrixAt(n,_m4)}}
  _c.setHex(a.sh).convertSRGBToLinear();imSh.setColorAt(n,_c);_c.setHex(a.sk).convertSRGBToLinear();imHd.setColorAt(n,_c);_c.setHex(a.pa).convertSRGBToLinear();imLL.setColorAt(n,_c);imLR.setColorAt(n,_c);n++}
 for(const m of [imSh,imHd,imLL,imLR]){m.count=n;m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true}}
/* ---------- polizia ---------- */
const PL={units:[],heat:0,seenT:-99,log:[],stopT:0,msgT:0,nextId:1,lastOff:{},siren:0,t:0,case:null,arrestT:0,calls:0};
function plog2(msg){PL.log.push('['+PL.t.toFixed(0)+' s] '+msg);if(PL.log.length>60)PL.log.shift();const p=$('#p_log');if(p&&!$('#pp').hidden)p.textContent=PL.log.slice(-30).join('\n')}
function say(text,prio){if(PD.cfg.subtitles){pdSubShow(text,6);clearTimeout(PL.subT);PL.subT=setTimeout(()=>pdSubShow(''),6000)}
 if(PD.cfg.voice&&typeof speechSynthesis!=='undefined'){try{if(prio>=3||!speechSynthesis.speaking){if(prio>=3)speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang='it-IT';u.rate=1.05;u.pitch=.9;speechSynthesis.speak(u)}}catch(e){}}
 try{pdAudio.chirp('start')}catch(e){}plog2('radio: '+text)}
function mkUnit(x,z,h,force){const mdl=pdMakeModel(force||(Math.random()<.5?'PS':'CC'));mdl.g.visible=true;sc.add(mdl.g);const u={id:PL.nextId++,name:(force==='CC'?'Alfa ':'Volante ')+(PL.nextId-1),x,z,h,v:0,y:0,mdl,state:'patrol',way:null,s:0,dir:1,off:2.2,see:false,lastSee:-99,sol:{x,z,c:Math.sin(h),s:Math.cos(h),hx:2.3,hz:.95,on:1,nc:1,amb:1,police:1},stuck:0,stT:0,force};solids.push(u.sol);PL.units.push(u);return u}
function dropUnit(u){sc.remove(u.mdl.g);const i=solids.indexOf(u.sol);if(i>=0)solids.splice(i,1);PL.units=PL.units.filter(q=>q!==u)}
function spawnPatrol(px,pz,behind,force){if(!G.ways.length)return null;const dr=G.ways.filter(w=>SPD[w.c]&&w.c!=='service'&&w.len>25);if(!dr.length)return null;
 for(let k=0;k<16;k++){const w=dr[Math.floor(Math.random()*dr.length)],s=Math.random()*w.len,p={x:0,z:0,dx:0,dz:0};at(w,s,1,p);const d=Math.hypot(p.x-px,p.z-pz);if(behind?(d<70||d>200):(d<120||d>320))continue;if(!behind&&inView(p.x,p.z))continue;
  const dir=(w.one||Math.random()<.5)?1:-1;at(w,s,dir,p);const rx=-p.dz,rz=p.dx,off=REAL.laneOff(w.w,w.one,w.pk,dir),u=mkUnit(p.x+rx*off,p.z+rz*off,Math.atan2(p.dx,p.dz),force);u.way=w;u.s=s;u.dir=dir;u.off=off;u.v=w.spd*.9;return u}return null}
function losTo(u,x,z){const dx=x-u.x,dz=z-u.z,d=Math.hypot(dx,dz);if(d<4)return true;if(d>170)return false;return pdLosDist(u.x,u.z,dx/d,dz/d,d)>=d-1}
PL.offence=function(kind,sev,prio){if(!PD.cfg.enabled)return;const now=PL.t;if(PL.lastOff[kind]&&now-PL.lastOff[kind]<4)return;PL.lastOff[kind]=now;
 // una pattuglia che vede o un passante che chiama il 112
 const T=inCar?C:P;let seen=null;for(const u of PL.units)if(losTo(u,T.x,T.z)&&Math.hypot(u.x-T.x,u.z-T.z)<150)seen=u;
 const civ=G.peds.filter(p=>Math.hypot(p.x-T.x,p.z-T.z)<40).length+G.cars.filter(c=>Math.hypot(c.x-T.x,c.z-T.z)<35).length;
 if(!seen&&civ<1&&sev<1.4)return;
 const was=PL.heat;PL.heat=Math.min(5,PL.heat+sev);PL.seenT=now;
 if(was<=0){PL.case={t0:now,kind};PL.calls=0;say(seen?seen.name+' a centrale: '+kind+', avvio inseguimento, veicolo rosso in '+(REAL.placeName(T.x,T.z)||'zona'):'Centrale a tutte le unità: segnalazione di '+kind+' in '+(REAL.placeName(T.x,T.z)||'zona')+'. Unità in zona intervenire.',3);
  if(!seen){const u=spawnPatrol(T.x,T.z,true);if(u){u.state='chase'}}}
 else plog2('reato: '+kind+' (livello '+PL.heat.toFixed(1)+')');
 for(const u of PL.units)if(u.state==='patrol'&&(seen===u||Math.hypot(u.x-T.x,u.z-T.z)<220))u.state='chase'};
function unitDrive(u,dt,target,vmax){// guida cinematica: sterza verso il bersaglio, accelera, frena davanti agli ostacoli
 const dx=target.x-u.x,dz=target.z-u.z,d=Math.hypot(dx,dz)||1e-6,want=Math.atan2(dx,dz);let da=want-u.h;da=Math.atan2(Math.sin(da),Math.cos(da));
 const turn=Math.min(1,.5+u.v/6)*2.4;u.h+=Math.max(-turn*dt,Math.min(turn*dt,da));
 let tv=vmax*(1-Math.min(.6,Math.abs(da)*.8));const fx=Math.sin(u.h),fz=Math.cos(u.h),dd=clipDist(u.x,u.z,fx,fz,14,1);if(dd<13)tv=Math.min(tv,dd<4?0:u.v*(dd/13));
 for(const a of G.cars){const ex=a.x-u.x,ez=a.z-u.z,e=Math.hypot(ex,ez);if(e<14&&(ex*fx+ez*fz)/e>.8)tv=Math.min(tv,e<5?0:a.v+1)}
 u.v+=(tv-u.v)*Math.min(1,dt*(tv<u.v?3.5:1.3));
 const nx=u.x+fx*u.v*dt,nz=u.z+fz*u.v*dt;u.sol.on=0;const q=push(nx,nz,1.1);u.sol.on=1;
 if(q[2]){const ux=q[0]-nx,uz=q[1]-nz,l=Math.hypot(ux,uz);if(l>1e-4){u.v*=.4;u.stuck+=dt}u.x=q[0];u.z=q[1]}else{u.x=nx;u.z=nz;u.stuck=Math.max(0,u.stuck-dt*.5)}
 if(REAL.wet(u.x,u.z)){u.x-=fx*u.v*dt;u.z-=fz*u.v*dt;u.v=0}
 return d}
function unitStep(u,dt,px,pz){const T=inCar?C:P;u.see=losTo(u,T.x,T.z)&&Math.hypot(u.x-T.x,u.z-T.z)<(inCar?150:90);if(u.see)u.lastSee=PL.t;
 if(u.state==='patrol'){// cruising lungo le strade come il traffico
  if(!u.way){u.way=findWayNear(u.x,u.z,40,null);if(u.way){const q=nearestOn(u.way,u.x,u.z);u.s=q.s;u.dir=1}else{u.v=0;return}}
  const w=u.way;at(w,u.s,u.dir,P2);const rx=-P2.dz,rz=P2.dx,tx=P2.x+rx*u.off+P2.dx*6,tz=P2.z+rz*u.off+P2.dz*6;unitDrive(u,dt,{x:tx,z:tz},Math.min(w.spd,13));
  const q=nearestOn(w,u.x,u.z);u.s=q.s+u.dir*Math.max(1.5,u.v*dt*2);if(u.s<0||u.s>w.len){const n=nextWay(w,P2.x,P2.z,P2.dx,P2.dz,false);if(n){u.way=n.w;u.dir=n.dir;u.s=n.s+n.dir;u.off=REAL.laneOff(n.w.w,n.w.one,n.w.pk,n.dir)}else{u.dir=-u.dir;u.s=Math.max(0,Math.min(w.len,u.s))}}
  if(PL.heat>0&&u.see){u.state='chase';say(u.name+': contatto visivo con il veicolo ricercato in '+(REAL.placeName(u.x,u.z)||'zona'),2)}}
 else if(u.state==='chase'){const d=Math.hypot(T.x-u.x,T.z-u.z);
  if(u.see&&d<70){unitDrive(u,dt,{x:T.x+(inCar?V.vx*.6:0),z:T.z+(inCar?V.vz*.6:0)},inCar?38:14);u.way=null}
  else{// per strada verso il giocatore, scegliendo agli incroci la via che avvicina
   if(!u.way){u.way=findWayNear(u.x,u.z,60,null);if(u.way){const q=nearestOn(u.way,u.x,u.z);u.s=q.s;at(u.way,u.s,1,P2);const fw={x:P2.x+P2.dx*20,z:P2.z+P2.dz*20},bw={x:P2.x-P2.dx*20,z:P2.z-P2.dz*20};u.dir=Math.hypot(fw.x-T.x,fw.z-T.z)<=Math.hypot(bw.x-T.x,bw.z-T.z)?1:-1}}
   if(u.way){const w=u.way;at(w,u.s,u.dir,P2);const rx=-P2.dz,rz=P2.dx;unitDrive(u,dt,{x:P2.x+rx*u.off+P2.dx*8,z:P2.z+rz*u.off+P2.dz*8},Math.min(w.spd*1.6+6,34));const q=nearestOn(w,u.x,u.z);u.s=q.s+u.dir*Math.max(2,u.v*dt*2);
    if(u.s<0||u.s>w.len||(u.v>1&&Math.random()<dt*.5)){const n=nextWay(w,P2.x,P2.z,P2.dx,P2.dz,false,[T.x,T.z]);if(n&&(u.s<0||u.s>w.len||Math.random()<.6)){u.way=n.w;u.dir=n.dir;u.s=n.s+n.dir;u.off=REAL.laneOff(n.w.w,n.w.one,n.w.pk,n.dir)}else if(u.s<0||u.s>w.len){u.dir=-u.dir;u.s=Math.max(0,Math.min(w.len,u.s))}}}
   else unitDrive(u,dt,{x:T.x,z:T.z},16)}
  if(u.stuck>2.5){u.v=-4;u.h+=dt*1.5;if(u.stuck>4)u.stuck=0}
  // speronamento: contatto con l'auto del giocatore
  if(inCar&&d<5.2&&u.v>6){const sp=Math.hypot(V.vx,V.vz),ux=Math.sin(u.h),uz=Math.cos(u.h);if(PL.t-(u.ramT||-9)>1.5){u.ramT=PL.t;const imp=Math.max(3.5,u.v-sp*.5);try{carHit(carA,{x:C.x,z:C.z,h:C.h,y:V.y,vx:V.vx,vz:V.vz,player:true},u.x+ux*2.3,u.z+uz*2.3,ux,uz,imp,'car')}catch(e){}V.vx+=ux*imp*.25;V.vz+=uz*imp*.25;V.ywW=cl(V.ywW+(Math.random()-.5)*1.2,-2.4,2.4);u.v*=.5}}
  if(PL.heat<=0)u.state='leave'}
 else if(u.state==='leave'){unitDrive(u,dt,{x:u.x+Math.sin(u.h)*30,z:u.z+Math.cos(u.h)*30},12);if(Math.hypot(u.x-px,u.z-pz)>260)u.gone=true}
 else if(u.state==='hold'){u.v=Math.max(0,u.v-dt*8);const fx=Math.sin(u.h),fz=Math.cos(u.h);u.x+=fx*u.v*dt;u.z+=fz*u.v*dt}
 u.y=REAL.ground(u.x,u.z,u.y);u.sol.x=u.x;u.sol.z=u.z;u.sol.c=Math.sin(u.h);u.sol.s=Math.cos(u.h);
 const g=u.mdl.g;g.position.set(u.x,u.y,u.z);g.rotation.set(0,u.h,0);const fl=u.state==='chase'||u.state==='hold';u.mdl.bl.forEach((m,i)=>{m.emissiveIntensity=fl?(((PL.t*7)|0)%2===i?2.6:.15):.15})}
function hud(){const h=$('#heat');if(!h)return;if(PL.heat<=0||!PD.cfg.enabled){h.style.display='none';return}const n=PL.units.filter(u=>u.state==='chase').length;h.style.display='block';h.textContent='🚔 '+(PL.seenNow?'INSEGUIMENTO':'RICERCA')+' · '+'★'.repeat(Math.max(1,Math.round(PL.heat)))+'☆'.repeat(Math.max(0,5-Math.max(1,Math.round(PL.heat))))+' · '+n+' pattuglie';h.className='chip heat'+(PL.seenNow?'':' srch')}
function pdUpdate(dt,px,pz){PL.t+=dt;PD.t=PL.t;const T=inCar?C:P;
 if(!PD.cfg.enabled){for(const u of PL.units.slice())dropUnit(u);PL.heat=0;hud();try{pdAudio.siren(0)}catch(e){}return}
 for(const u of PL.units)unitStep(u,dt,px,pz);for(const u of PL.units.slice())if(u.gone||Math.hypot(u.x-px,u.z-pz)>520)dropUnit(u);
 PL.seenNow=PL.units.some(u=>u.see&&u.state==='chase');if(PL.seenNow)PL.seenT=PL.t;
 // pattuglia di zona in città
 const city=G.ways.filter(w=>w.sw).length>12;const patrols=PL.units.filter(u=>u.state==='patrol').length;if(city&&patrols<1&&PL.units.length<1&&G.fr%90===5)spawnPatrol(px,pz,false);
 if(PL.heat>0){// eccesso di velocità visto da una pattuglia
  if(inCar&&Math.hypot(V.vx,V.vz)>22&&PL.seenNow)PL.offence('velocità pericolosa',.4,1);
  // rinforzi secondo il livello
  const want=Math.min(1+Math.floor(PL.heat),4),chasing=PL.units.filter(u=>u.state==='chase').length;if(chasing<want&&PL.t-PL.msgT>9){PL.msgT=PL.t;const u=spawnPatrol(px,pz,true);if(u){u.state='chase';PL.calls++;say('Centrale: '+u.name+' in rinforzo, direzione '+(REAL.placeName(px,pz)||'zona'),1)}}
  // fermo: giocatore fermo con una pattuglia vicina
  const sp=inCar?Math.hypot(V.vx,V.vz):P.sp,nearU=PL.units.find(u=>u.state==='chase'&&Math.hypot(u.x-T.x,u.z-T.z)<(inCar?9:5));
  if(nearU&&sp<1){PL.arrestT+=dt;if(PL.arrestT>2.2){const fine=Math.min(Math.round(S.cents*.6),Math.round(PL.heat*4000+2500));S.cents=Math.max(0,S.cents-fine);S.log.push({t:Date.now(),w:'Multa della Polizia',c:-fine});if(S.log.length>30)S.log.shift();save();hud2();toast('Fermato dalla Polizia: multa '+eur(fine));say(nearU.name+' a centrale: soggetto fermato e identificato, sanzione elevata. Rientriamo.',3);PL.heat=0;PL.arrestT=0;for(const u of PL.units){u.state='hold';setTimeout(()=>{if(u.state==='hold')u.state='leave'},6000)}}}
  else PL.arrestT=Math.max(0,PL.arrestT-dt);
  // fuga riuscita
  if(!PL.seenNow&&PL.t-PL.seenT>22){PL.heat=Math.max(0,PL.heat-dt*.35);if(PL.heat<=0){say('Centrale a tutte le unità: perso il contatto con il veicolo. Sospendere la ricerca.',2);toast('Hai seminato la polizia');for(const u of PL.units)u.state='leave'}}
  else if(!PL.seenNow)PL.heat=Math.max(0,PL.heat-dt*.02)}
 // sirena: la pattuglia in inseguimento più vicina
 let lev=0;for(const u of PL.units)if(u.state==='chase'){const d=Math.hypot(u.x-px,u.z-pz);lev=Math.max(lev,Math.max(0,1-d/220))}
 try{pdAudio.siren(PD.cfg.siren?lev:0)}catch(e){}
 hud()}
function hud2(){try{$('#w').textContent=eur(S.cents)}catch(e){}}
/* ---------- pannello 🚔 ---------- */
function panelInit(){const el=id=>$('#'+id),b=el('pbtn'),p=el('pp');if(!b||!p)return;b.hidden=false;b.style.display='';b.addEventListener('pointerdown',e=>{e.stopPropagation();p.hidden=!p.hidden;if(!p.hidden){const L=$('#p_log');if(L)L.textContent=PL.log.slice(-30).join('\n')||'Nessun evento. Tocca «Prova inseguimento» o guida male: urti, passanti, spari, velocità.'}});
 const bind=(id,fn)=>{const x=el(id);if(x)x.addEventListener('pointerdown',e=>{e.stopPropagation();fn(x)})},chk=(id,key)=>{const x=el(id);if(x){x.checked=!!PD.cfg[key];x.addEventListener('change',()=>{PD.cfg[key]=x.checked;if(key==='subtitles'&&!x.checked)pdSubShow('')})}};
 chk('p_on','enabled');chk('p_voice','voice');chk('p_sub','subtitles');chk('p_siren','siren');chk('p_cine','cine');
 bind('p_test',()=>{if(!PD.cfg.enabled){toast('Attiva il sistema');return}const T=inCar?C:P;const u=spawnPatrol(T.x,T.z,true);if(!u){toast('Nessuna strada vicina per la pattuglia: aspetta che la zona si carichi');return}u.state='chase';PL.heat=Math.max(PL.heat,2);PL.seenT=PL.t;PL.case={t0:PL.t,kind:'prova'};say(u.name+' a centrale: veicolo rosso in fuga, avvio inseguimento. Richiedo rinforzi.',3);toast('Inseguimento di prova: scappa!')});
 bind('p_back',()=>{if(PL.heat<=0){toast('Nessun inseguimento in corso');return}let n=0;for(let i=0;i<2;i++){const u=spawnPatrol(C.x,C.z,true);if(u){u.state='chase';n++}}PL.heat=Math.min(5,PL.heat+.5);say('Centrale: inviati rinforzi, '+n+' unità in arrivo',2)});
 bind('p_block',()=>toast('Posti di blocco: in arrivo nelle prossime versioni sulla mappa reale'));bind('p_spk',()=>toast('Strisce chiodate: in arrivo nelle prossime versioni'));bind('p_box',()=>toast('Scatola: in arrivo nelle prossime versioni'));bind('p_pin',()=>toast('Tenaglia: in arrivo nelle prossime versioni'));
 bind('p_end',()=>{PL.heat=0;for(const u of PL.units)u.state='leave';say('Centrale: inseguimento annullato, tutte le unità rientrano.',3);toast('Inseguimento terminato')});
 addEventListener('pointerdown',()=>{try{pdAudio.ensure()}catch(e){}},{passive:true})}
/* ---------- aggiornamento ---------- */
const _v=new T.Vector3(),_s=new T.Vector3(),_q=new T.Quaternion(),_y=new T.Vector3(0,1,0),_m4=new T.Matrix4(),_c=new T.Color();
let ready=false,rebT=0;
function init(){carInit();pedInit();panelInit();ready=true}
function update(dt,px,pz){if(!ready||REAL.busy())return;G.t+=dt;G.fr++;rebT-=dt;if(rebT<=0){rebT=1;rebuild()}
 carsUpdate(dt,px,pz);pedsUpdate(dt,px,pz);pdUpdate(dt,px,pz)}
function shot(x,z){const fx=Math.sin(yaw),fz=Math.cos(yaw);let cop=false;for(const u of PL.units){const dx=u.x-x,dz=u.z-z,d=Math.hypot(dx,dz);if(d<30&&(dx*fx+dz*fz)/d>.8)cop=true}if(cop)PL.offence('spari contro la polizia',2,4);else PL.offence('spari in pubblico',1.2,3)}
function shotAtPolice(){PL.offence('spari contro la polizia',2,4)}
function travelReset(){for(const a of G.cars){a.sol.on=0}G.cars=[];CARS.length=0;G.peds=[];PEDS.length=0;for(const u of PL.units.slice())dropUnit(u);G.ver=''}
return{init,update,shot,shotAtPolice,travelReset,carHitBy,G,PL,rebuild,get ways(){return G.ways}}})();
