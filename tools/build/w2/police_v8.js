/* ===== POLIZIA v8 (Versione 20): regia tattica — strisce chiodate, scatola, tenaglia agli incroci =====
   La centrale non si limita più a mandare rinforzi: sceglie la tattica adatta alla strada, alla velocità e alle stelle.
   - Strisce chiodate: una pattuglia raggiunge un rettilineo davanti al veicolo, si ferma sul bordo e, quando il veicolo arriva,
     getta la striscia di traverso sulle corsie; appena è passato la ritira (chi insegue frena per non bucare a sua volta).
     Le gomme forate si sgonfiano in un paio di secondi: l'auto tira dal lato bucato, perde aderenza e velocità; guidando a lungo
     su una gomma a terra il battistrada si stacca e il cerchio struscia sull'asfalto facendo scintille.
   - Scatola: quattro pattuglie (davanti, ai due lati, dietro) circondano il veicolo su un rettilineo largo e poi frenano insieme.
   - Tenaglia: due pattuglie aspettano nelle laterali di un incrocio sul percorso previsto e sbucano quando il veicolo arriva.
   Tutto è annunciato alla radio. */
const TAC={spkCool:-99,boxCool:-99,pinCool:-99,stat:{spkSet:0,spkHit:0,spkMiss:0,boxForm:0,boxWin:0,boxFail:0,pin:0,pinHit:0}};
PD.spikes=[];
// ruote nel riferimento dell'auto: x verso sinistra, z in avanti (anteriore sinistra, anteriore destra, posteriore sinistra, posteriore destra)
const WHL=[[.773,1.323],[-.773,1.323],[.773,-1.387],[-.773,-1.387]];
function pdWheelsW(x,z,h,out){const s=Math.sin(h),c=Math.cos(h);for(let k=0;k<4;k++){const a=WHL[k][0],b=WHL[k][1];out[k*2]=x+c*a+s*b;out[k*2+1]=z-s*a+c*b}return out}
function pdJunctionNear(x,z,r){navBuild();const gx=Math.floor(x/100),gz=Math.floor(z/100);for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){const a=NAVG.grid.get((gx+dx)+','+(gz+dz));if(a)for(const i of a){if(NAVG.adj[i].length<3)continue;const n=NAVG.nodes[i];if((n[0]-x)*(n[0]-x)+(n[1]-z)*(n[1]-z)<r*r)return true}}return false}
Object.assign(PDL,{
 spkPlan:['Centrale a tutte le unità: strisce chiodate {place}, le porta {u2}. Tenetevi a distanza dietro di lui.','Centrale: {u2}, vai a stendere le strisce {place}, arrivo del veicolo tra {eta} secondi.','Centrale: preparo le strisce chiodate {place}. {u2} va in posizione, gli altri non lo spingano sopra.'],
 spkReady:['{u}: strisce pronte {place}, lo aspetto.','{u}: sono in posizione con i chiodi, fatemelo arrivare.','{u}: striscia chiodata pronta sul bordo.'],
 spkOut:['{u}: chiodi a terra!','{u}: getto la striscia!','{u}: strisce stese, frenate voi dietro!'],
 spkHit:['{u}: preso! Ha le gomme a terra!','{u}: ci è passato sopra, ha bucato {n}!','{u}: colpito, il veicolo perde aderenza, gomme forate!'],
 spkMiss:['{u}: le ha evitate, ritiro la striscia.','{u}: niente da fare, ha schivato i chiodi.','{u}: mancato, è passato di lato.'],
 spkOwn:['{u}: ho preso le nostre strisce, ho bucato! Proseguo piano.','{u}: forato sulle strisce, mi fermo.'],
 boxPlan:['Centrale a tutte le unità: formiamo la scatola! {f} davanti, {l} a sinistra, {r} a destra, {b} dietro.','Centrale: scatola sul rettilineo. {f} lo superi e si metta davanti, {l} e {r} ai lati, {b} chiude dietro.'],
 boxClose:['{u}: scatola chiusa, frenate insieme!','{u}: è circondato, rallentiamo adesso!','{u}: tutti in posizione, stringiamo!'],
 boxWin:['{u}: fermato! È bloccato nella scatola.','{u}: veicolo immobilizzato, scendiamo!','{u}: è in trappola, non può più muoversi.'],
 boxFail:['{u}: ha forzato la scatola, riprendiamo l\'inseguimento.','{u}: è uscito dalla scatola, ricomponiamo.','{u}: ci è sfuggito di lato!'],
 pinPlan:['Centrale: tenaglia sull\'incrocio {place}. {a} e {b} aspettano nelle laterali.','Centrale a {a} e {b}: chiudete l\'incrocio {place} quando arriva, uno per lato.'],
 rolled:['{u}: ci siamo ribaltati! Siamo fuori servizio.','{u}: cappottati, non possiamo proseguire.','{u}: siamo sul tetto, mandate un\'altra unità!'],
 pinPlan1:['Centrale: agguato all\'incrocio {place}. {a} aspetta nella laterale e lo taglia quando arriva.','Centrale a {a}: si apposti nella laterale {place} e gli chiuda l\'incrocio.'],
 pinGo:['{u}: esco adesso!','{u}: lo taglio all\'incrocio!','{u}: sbuco dalla laterale!'],
 pinMiss:['{u}: ha cambiato strada prima dell\'incrocio.','{u}: troppo tardi, è già passato.']});
Object.assign(PDCD,{spkReady:6,spkOut:4,pinGo:2});
const pdName=id=>{const u=PD.units.find(q=>q.id===id);return u?u.name:'una pattuglia'};

/* ---------- strisce chiodate ---------- */
DSP.requestSpikes=function(c){const T=pdCaseEst();if(!T||T.age>3||T.sp<8)return false;
 const pr=pdPredict(T.x,T.z,T.dirA,980);if(!pr.ok||pr.pts.length<3)return false;
 let acc=0;const legs=[];
 for(let i=1;i<pr.pts.length;i++){const a=pr.pts[i-1],b=pr.pts[i],l=Math.hypot(b[0]-a[0],b[1]-a[1]);if(l<1)continue;const dx=(b[0]-a[0])/l,dz=(b[1]-a[1])/l;
  for(let f=.2;f<.85;f+=.2){const d=acc+l*f;if(d<230||d>950)continue;const x=a[0]+dx*l*f,z=a[1]+dz*l*f,ns=pdNearSeg(x,z,5);if(!ns)continue;const s=ns.s;
   if(s.tp||s.ramp||s.br||s.pv||s.len<14||s.w<5.5)continue;if(pdJunctionNear(x,z,13))continue;
   // il tratto deve essere diritto per 40 m prima e 25 m dopo (la striscia di traverso si vede e l'auto ci arriva dritta)
   const sx=(s.bx-s.ax)/s.len,sz=(s.bz-s.az)/s.len;if(Math.abs(sx*dx+sz*dz)<.97)continue;legs.push({x,z,dx,dz,dist:d,s,id:ns.id})}
  acc+=l}
 if(!legs.length){plog('centrale','strisce chiodate impossibili: nessun rettilineo adatto davanti al veicolo',{});return false}
 // il primo rettilineo raggiungibile in tempo (le stime della centrale contano 8 s per mettere l'auto di traverso: qui ne bastano 3)
 legs.sort((p,q)=>p.dist-q.dist);const vT=Math.max(9,T.sp);let tried=0,lastD=-1e9;
 for(const L of legs){if(tried>=12)break;if(L.dist-lastD<55)continue;lastD=L.dist;const tReach=L.dist/vT;tried++;const cand=dspCandidates({x:L.x,z:L.z},null,true),k=cand.find(q=>q.eta-5<tReach*.8-3);if(!k)continue;
  // parcheggio sul bordo destro (nel verso del veicolo); la striscia va dal bordo verso sinistra quasi fino al bordo opposto
  // in autostrada la pattuglia sta sulla corsia d'emergenza; in città sale sul bordo del marciapiede (la carreggiata resta libera)
  const s=L.s,rx=-L.dz,rz=L.dx,ow=!!s.ow,hw=s.w/2,qPark=ow?Math.min(hw-1.15,5.6):hw+.6,qStart=ow?qPark-1.25:hw-.15,qEnd=ow?-(hw-.5):-(hw-1.6),len=Math.max(3,qStart-qEnd);
  const spot={x:L.x+rx*qPark-L.dx*7,z:L.z+rz*qPark-L.dz*7},spk={x:L.x,z:L.z,dx:L.dx,dz:L.dz,qs:qStart,full:len};
  const ex={eta:k.eta,spot,dir:{x:L.dx,z:L.dz},phase:'route',segId:L.id,spike:spk};let nm;
  if(k.u){dspAssign(k.u,'block',{x:L.x,z:L.z},ex);nm=k.u.name}else{dspQueueSpawn({st:k.st,t0:PD.t,dest:{x:L.x,z:L.z},eta:k.eta,kind:'block',spot,dir:ex.dir,segId:L.id,spike:spk});nm=k.st.force==='CC'?'una pattuglia dei Carabinieri':'una Volante'}
  TAC.stat.spkSet++;c.spkT=PD.t;pdSay('spkPlan','C',{place:pdPlace(L.x,L.z),u2:nm,eta:Math.max(3,Math.round(tReach))},3,{force:true});EV.emit('spikePlan',{unit:nm,dist:Math.round(L.dist),place:pdPlace(L.x,L.z)});plog('centrale','strisce chiodate a '+Math.round(L.dist)+' m davanti al veicolo ('+pdPlace(L.x,L.z)+'), le porta '+nm,{});return true}
 plog('centrale','strisce chiodate rinunciate: nessuna unità arriva in tempo',{});return false};
// guida della pattuglia con le strisce: arriva, accosta sul bordo, si ferma; poi la striscia fa il resto (pdSpikeStep)
function pdSpikeDrive(u,dt){const a=u.assign,sp=a.spot,S=a.spike;
 if(a.phase==='route'){const dd=Math.hypot(u.x-S.x,u.z-S.z);if(u.route&&u.route.ok){const rem=pdFollow(u,dd<140?16:30,0);if(dd<70||rem<45)a.phase='park'}else{pdSteerTo(u,sp.x,sp.z);pdSpeedTo(u,Math.min(14,Math.max(3,dd*.3)));pdAvoid(u);if(dd<70)a.phase='park'}return}
 if(a.phase==='park'){const d=Math.hypot(u.x-sp.x,u.z-sp.z);a.pkT=(a.pkT||0)+dt;
  if(d<2.2||a.pkT>18){a.phase='held';a.arrived=true;u.vcruise=10;pdSpikeMake(u,a);return}
  pdSteerTo(u,sp.x,sp.z,2);pdSpeedTo(u,pdClamp(Math.sqrt(2*3*Math.max(0,d-1)),1.5,10));pdAvoid(u);return}
 u.ix=0;u.iy=-1;u.hb=true;if(!a.spk)pdSpikeMake(u,a);   // arrivata mentre era lontana dal giocatore (movimento semplificato): la striscia si prepara ora
 // striscia ritirata: la pattuglia torna all'inseguimento
 const st=a.spk;if(st&&st.state==='done'){const c=PD.case;u.assign=null;DSP.ledger.delete(u.id);if(c&&c.phase!=='ended'){pdJoin(u,'support');u.vcruise=11}else{u.status='returning';u.offT=PD.t;u.lights=false}}}
function pdSpikeMake(u,a){const S=a.spike,st={id:'s'+u.id,uid:u.id,x:S.x,z:S.z,dx:S.dx,dz:S.dz,qs:S.qs,full:S.full,len:0,state:'wait',t0:PD.t,prev:[9,9,9,9],hit:0,pp:new Map()};PD.spikes.push(st);a.spk=st;
 EV.emit('inPosition',{id:u.id,name:u.name,place:pdPlace(u.x,u.z),spike:true});pdSay('spkReady',u,{place:pdPlace(S.x,S.z)},2);plog('unità',u.name+': strisce chiodate pronte',{})}
// la striscia: attesa → stesa (si allunga di traverso) → ritirata
function pdSpikeStep(dt){const T=PD.T,c=PD.case;for(let i=PD.spikes.length-1;i>=0;i--){const st=PD.spikes[i],u=PD.units.find(q=>q.id===st.uid);
  if(!u||u.status==='gone'||u.status==='disabled'||!u.assign||u.assign.spk!==st){if(st.len>0)st.state='in';else{st.state='done';pdSpikeMesh(st,true);PD.spikes.splice(i,1);continue}}
  const sAl=(T.x-st.x)*st.dx+(T.z-st.z)*st.dz,eta=-sAl/Math.max(1,T.sp),lat=(T.x-st.x)*(-st.dz)+(T.z-st.z)*st.dx;
  if(st.state==='wait'){if(!c||c.phase==='ended'||PD.t-st.t0>70){st.state='done'}
   else if(sAl>-150&&sAl<-6&&eta<2.4&&T.car&&Math.abs(lat)<18){st.state='out';st.tOut=PD.t;pdSay('spkOut',u,{},3,{force:true});EV.emit('spikeOut',{id:u.id,name:u.name})}
   else if(sAl>8&&Math.abs(lat)<25){st.state='done';TAC.stat.spkMiss++;plog('unità',u.name+': il veicolo è passato prima che stendessi le strisce',{})}}
  if(st.state==='out'){st.len=Math.min(st.full,st.len+10*dt);pdSpikeHits(st,u);
   // il veicolo è passato (tutte le ruote oltre la striscia) o si è fermato prima: si ritira
   if(sAl>4.5||PD.t-st.tOut>14){st.state='in';if(!st.hit&&sAl>4.5){TAC.stat.spkMiss++;pdSay('spkMiss',u,{},3,{force:true});EV.emit('spikeMiss',{id:u.id})}}}
  else if(st.state==='in'){pdSpikeHits(st,u);st.len=Math.max(0,st.len-14*dt);if(st.len<=0)st.state='done'}
  pdSpikeMesh(st,st.state==='done');if(st.state==='done'&&!(u&&u.assign&&u.assign.spk===st&&u.assign.phase==='held')){PD.spikes.splice(i,1)}}}
// ruote sopra la striscia (giocatore e pattuglie): una ruota che attraversa la parte stesa si fora
function pdSpikeHits(st,u){if(st.len<=0)return;const W=pdSpikeHits.w||(pdSpikeHits.w=new Float64Array(8)),Lx=st.dz,Lz=-st.dx;
 const test=(x,z,h,prev,onHit)=>{pdWheelsW(x,z,h,W);let n=0;for(let k=0;k<4;k++){const ox=W[k*2]-st.x,oz=W[k*2+1]-st.z,s=ox*st.dx+oz*st.dz,q=ox*(-st.dz)+oz*st.dx,qq=st.qs-q;
   if(qq>=0&&qq<=st.len&&((prev[k]<0&&s>=-.05)||Math.abs(s)<.12)&&prev[k]!==99){onHit(k);n++;prev[k]=99}else if(prev[k]!==99)prev[k]=s}return n};
 if(PD.T.car){const n=test(C.x,C.z,C.h,st.prev,k=>TYRE.puncture(carA,k,1));if(n){st.hit+=n;if(st.hit===n){TAC.stat.spkHit++;pdSay('spkHit',u,{n:n>=3?'tutte le gomme':n===2?'due gomme':'una gomma'},3,{force:true});EV.emit('spikeHit',{n,id:u.id});CINE.ev('spike',C.x,C.z,{h:C.h})}}}
 for(const o of PD.units){if(o===u||o.lod!=='near'||o.status==='gone')continue;if(Math.abs((o.x-st.x)*st.dx+(o.z-st.z)*st.dz)>6)continue;let pv=st.pp.get(o.id);if(!pv){pv=[9,9,9,9];st.pp.set(o.id,pv)}
  const n=test(o.x,o.z,o.h,pv,k=>{o.flat=(o.flat||0)+1;if(o.mdl)TYRE.puncture(o.mdl,k,1)});if(n&&!o.flatSaid){o.flatSaid=1;o.vmaxT=13;pdSay('spkOwn',o,{},3,{force:true});EV.emit('spikeOwn',{id:o.id,name:o.name});plog('unità',o.name+': forata sulle strisce dei colleghi',{})}}}
// chi insegue e vede la striscia stesa davanti frena e la aspetta ritirata (solo dove la striscia copre ancora la sua posizione laterale)
function pdSpikeBrake(u){if(!PD.spikes.length||u.status==='disabled')return;const sn=Math.sin(u.h),cn=Math.cos(u.h);
 for(const st of PD.spikes){if(st.state!=='out'&&st.state!=='in')continue;if(u.assign&&u.assign.spk===st)continue;const ox=u.x-st.x,oz=u.z-st.z,s=ox*st.dx+oz*st.dz,head=sn*st.dx+cn*st.dz;
  const ahead=head>0?-s:s;if(ahead<-1||ahead>70)continue;const q=ox*(-st.dz)+oz*st.dx,qq=st.qs-q;if(qq<-1.4||qq>st.len+1.4)continue;
  const vmax=Math.sqrt(2*7.5*Math.max(0,ahead-5.5)),vf=Math.max(0,u.fwd);if(vf>vmax){u.iy=Math.min(u.iy,pdClamp((vmax-vf)*.5,-1,0));u.hb=false}}}
// grafica della striscia: nastro giallo e nero a fisarmonica con le punte metalliche
function pdSpikeMesh(st,remove){if(remove){if(st.m){sc.remove(st.m);st.m=null}return}
 if(!st.m){const g=new T.Group(),tex=pdSpikeMesh.tex||(pdSpikeMesh.tex=(()=>{const cv=document.createElement('canvas');cv.width=64;cv.height=8;const x=cv.getContext('2d');for(let i=0;i<8;i++){x.fillStyle=i%2?'#1a1a1a':'#e8b400';x.fillRect(i*8,0,8,8)}const t=new T.CanvasTexture(cv);t.wrapS=T.RepeatWrapping;return t})());
  const base=new T.Mesh(new T.BoxGeometry(1,.035,.32),new T.MeshStandardMaterial({map:tex,roughness:.7}));base.position.set(.5,.02,0);g.add(base);
  const sg=new T.ConeGeometry(.022,.075,5),sm=new T.MeshStandardMaterial({color:0xc8ccd0,metalness:.9,roughness:.3}),N=Math.round(st.full/.14)*2,im=new T.InstancedMesh(sg,sm,N),M=new T.Matrix4();
  for(let i=0;i<N;i++){M.makeTranslation(((i>>1)+.5)/(N/2),.072,i%2?.08:-.08);im.setMatrixAt(i,M)}g.add(im);st.m=g;st.base=base;sc.add(g);
  const q0x=st.x+(-st.dz)*st.qs,q0z=st.z+st.dx*st.qs;g.position.set(q0x,GY(q0x,q0z)+.01,q0z);g.rotation.y=Math.atan2(-(-st.dx),st.dz)}
 const L=Math.max(.01,st.len);st.m.scale.set(L,1,1);st.m.visible=st.len>.05||st.state==='wait';if(st.base&&st.base.material.map)st.base.material.map.repeat.set(Math.max(1,L*3),1)}

/* ---------- gomme forate (giocatore e pattuglie) ---------- */
const TYRE={
 // f: quanto è sgonfia (0–1), shred: battistrada staccato (cerchio a terra), d: strada percorsa a terra
 st:a=>a.tyre||(a.tyre={f:[0,0,0,0],tgt:[0,0,0,0],rate:[0,0,0,0],shred:[0,0,0,0],d:[0,0,0,0],map:null}),
 puncture(a,k,sev){const s=TYRE.st(a);if(s.tgt[k]>=1)return;s.tgt[k]=1;s.rate[k]=sev>=1?.42:.2;if(a===carA){EV.emit('tyre',{k});dmgHud()}},
 // ordine delle ruote del modello (a.wh: 4 per dettaglio) → ruota fisica (0 ant. sin., 1 ant. des., 2 post. sin., 3 post. des.)
 map(a){const s=TYRE.st(a);if(s.map)return s.map;s.map=a.wh.map(w=>{const p=w.parent?w.parent.position:{x:0,z:0};return (p.z>0?0:2)+(p.x>0?0:1)});return s.map},
 step(a,dt,v){const s=a.tyre;if(!s)return;let any=0;if(a===carA&&(TYRE.hT=(TYRE.hT||0)+dt)>.5){TYRE.hT=0;dmgHud()}for(let k=0;k<4;k++){if(s.f[k]<s.tgt[k])s.f[k]=Math.min(s.tgt[k],s.f[k]+s.rate[k]*dt);if(s.f[k]>.9&&!s.shred[k]){s.d[k]+=Math.abs(v)*dt;if(s.d[k]>420+80*k){s.shred[k]=1;if(a===carA)EV.emit('tyreShred',{k})}}any+=s.f[k]}
  // aspetto: gomma schiacciata in basso (non gira più con il cerchio), cerchio più vicino all'asfalto; a battistrada staccato resta il cerchio
  const map=TYRE.map(a);a.wh.forEach((w,i)=>{const k=map[i],f=s.f[k];if(f<=0)return;const tire=w.children[0],st=w.parent;if(!st.userData.y0)st.userData.y0=st.position.y;
   st.position.y=st.userData.y0+.045*f+(s.shred[k]?.05:0);if(tire){tire.visible=!s.shred[k];tire.rotation.x=-w.rotation.x;tire.scale.set(1+.07*f,1-.2*f,1-.04*f)}});
  // scintille dal cerchio che striscia
  if(v>6){for(let k=0;k<4;k++){if(!s.shred[k]&&s.f[k]<.98)continue;if(Math.random()>dt*(s.shred[k]?26:9)*Math.min(1,v/25))continue;const g=a.g,sn=Math.sin(g.rotation.y),cn=Math.cos(g.rotation.y),wx=WHL[k][0],wz=WHL[k][1];
    FX.sparks(g.position.x+cn*wx+sn*wz,g.position.y+.04,g.position.z-sn*wx+cn*wz,-sn*v*.35,-cn*v*.35,s.shred[k]?5:2,4)}}},
 reset(a){const s=a.tyre;if(!s)return;const map=TYRE.map(a);a.wh.forEach((w,i)=>{const st=w.parent,tire=w.children[0];if(st.userData.y0!==undefined)st.position.y=st.userData.y0;if(tire){tire.visible=true;tire.rotation.x=0;tire.scale.set(1,1,1)}});a.tyre=null},
 // effetti sulla guida del giocatore (applicati dopo i danni della carrozzeria)
 apply(){const s=carA.tyre;CARDMG.grip=1;if(!s)return;const f=s.f,sh=s.shred,sum=f[0]+f[1]+f[2]+f[3],shs=sh[0]+sh[1]+sh[2]+sh[3],L=f[0]+f[2],R=f[1]+f[3],Fr=f[0]+f[1],Re=f[2]+f[3];if(sum<=0)return;
  CARDMG.drag+=sum*.75+shs*.9;CARDMG.vmax=Math.min(CARDMG.vmax,56-sum*7.5-shs*4);CARDMG.pull=pdClamp(CARDMG.pull+(R-L)*.028+(sh[1]+sh[3]-sh[0]-sh[2])*.02,-.08,.08);CARDMG.lk*=1-Fr*.09;CARDMG.grip=Math.max(.45,1-sum*.08-shs*.07);
  CARDMG.tr+=(R-L)*.022;CARDMG.tp+=(Fr-Re)*.014}};
/* ---------- scintille ---------- */
// scintille: teste luminose (punti) con la scia (segmenti lungo la velocità), colore da bianco-giallo ad arancio scuro, rimbalzo sull'asfalto
const FX={max:700,i:0,pts:null,lns:null,pos:null,vel:null,life:null,col:null,lp:null,lc:null,live:0,
 init(){if(FX.pts)return;const g=new T.BufferGeometry(),N=FX.max;FX.pos=new Float32Array(N*3).fill(-999);FX.vel=new Float32Array(N*3);FX.life=new Float32Array(N);FX.col=new Float32Array(N*3);FX.lp=new Float32Array(N*6).fill(-999);FX.lc=new Float32Array(N*6);
  g.setAttribute('position',new T.BufferAttribute(FX.pos,3));g.setAttribute('color',new T.BufferAttribute(FX.col,3));const cv=document.createElement('canvas');cv.width=cv.height=32;const cx=cv.getContext('2d');if(cx&&cx.createRadialGradient){const gr=cx.createRadialGradient(16,16,0,16,16,16);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.35,'rgba(255,255,255,.55)');gr.addColorStop(1,'rgba(255,255,255,0)');cx.fillStyle=gr;cx.fillRect(0,0,32,32)}
  FX.pts=new T.Points(g,new T.PointsMaterial({size:.055,map:new T.CanvasTexture(cv),vertexColors:true,transparent:true,depthWrite:false,blending:T.AdditiveBlending}));FX.pts.frustumCulled=false;sc.add(FX.pts);
  const g2=new T.BufferGeometry();g2.setAttribute('position',new T.BufferAttribute(FX.lp,3));g2.setAttribute('color',new T.BufferAttribute(FX.lc,3));FX.lns=new T.LineSegments(g2,new T.LineBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,blending:T.AdditiveBlending}));FX.lns.frustumCulled=false;sc.add(FX.lns)},
 sparks(x,y,z,vx,vz,n,spd){FX.init();for(let j=0;j<n;j++){const i=FX.i=(FX.i+1)%FX.max,a=Math.random()*6.283,r=Math.random()*spd;FX.pos[i*3]=x;FX.pos[i*3+1]=y;FX.pos[i*3+2]=z;FX.vel[i*3]=vx*(.6+Math.random()*.5)+Math.cos(a)*r;FX.vel[i*3+1]=.6+Math.random()*spd*.7;FX.vel[i*3+2]=vz*(.6+Math.random()*.5)+Math.sin(a)*r;FX.life[i]=.25+Math.random()*.5}FX.live=.9},
 step(dt){if(!FX.pts||FX.live<=0)return;FX.live-=dt;let any=0;for(let i=0;i<FX.max;i++){const o=i*3,o6=i*6;if(FX.life[i]<=0){if(FX.lp[o6+1]!==-999){FX.lp[o6+1]=FX.lp[o6+4]=-999}continue}any=1;FX.life[i]-=dt;if(FX.life[i]<=0){FX.pos[o+1]=-999;FX.lp[o6+1]=FX.lp[o6+4]=-999;continue}
  FX.vel[o+1]-=9.8*dt;FX.pos[o]+=FX.vel[o]*dt;FX.pos[o+1]+=FX.vel[o+1]*dt;FX.pos[o+2]+=FX.vel[o+2]*dt;const gy=GY(FX.pos[o],FX.pos[o+2])+.01;if(FX.pos[o+1]<gy){FX.pos[o+1]=gy;FX.vel[o+1]*=-.3;FX.vel[o]*=.7;FX.vel[o+2]*=.7}
  const t=Math.min(1,FX.life[i]/.45),r=1,gC=.28+.5*t,b=.04+.3*t*t;FX.col[o]=r;FX.col[o+1]=gC;FX.col[o+2]=b;
  // scia: dalla testa all'indietro lungo la velocità (circa 3 centesimi di secondo), che sfuma
  const k=.045;FX.lp[o6]=FX.pos[o];FX.lp[o6+1]=FX.pos[o+1];FX.lp[o6+2]=FX.pos[o+2];FX.lp[o6+3]=FX.pos[o]-FX.vel[o]*k;FX.lp[o6+4]=FX.pos[o+1]-FX.vel[o+1]*k;FX.lp[o6+5]=FX.pos[o+2]-FX.vel[o+2]*k;
  FX.lc[o6]=r;FX.lc[o6+1]=gC;FX.lc[o6+2]=b;FX.lc[o6+3]=r*.35;FX.lc[o6+4]=gC*.2;FX.lc[o6+5]=0}
  if(any)FX.live=Math.max(FX.live,.1);FX.pts.geometry.attributes.position.needsUpdate=true;FX.pts.geometry.attributes.color.needsUpdate=true;FX.lns.geometry.attributes.position.needsUpdate=true;FX.lns.geometry.attributes.color.needsUpdate=true}};

/* ---------- regia: quando usare le strisce (la scatola è nella formazione, la tenaglia più sotto) ---------- */
function pdTactics(dt){const c=PD.case;pdSpikeStep(dt);if(!c||c.phase==='ended'){for(const u of PD.units)if(u.boxRole)u.boxRole=undefined;if(c&&c.box)c.box=null}if(!c||c.phase!=='pursuit')return;const st=Math.max(1,Math.min(5,Math.round(c.heat))),T=PD.T;
 TAC.tm=(TAC.tm||0)+dt;if(TAC.tm<1)return;TAC.tm=0;
 // strisce: da 3 stelle, veicolo lanciato, nessuna già in corso, non subito dopo un'altra
 if(st>=3&&T.car&&T.sp>11&&PD.t-(c.pursuitT0||0)>12&&PD.t>TAC.spkCool&&!PD.spikes.length&&!PD.units.some(u=>u.assign&&u.assign.spike&&u.status!=='gone')){TAC.spkCool=PD.t+(DSP.requestSpikes(c)?40:15)}
 // tenaglia: da 3 stelle in città
 if(st>=3&&T.sp>7&&PD.t>TAC.pinCool&&!c.pin)pdPincerPlan(c,T,st)}

/* ---------- scatola: quattro pattuglie attorno al veicolo che poi frenano insieme ----------
   Fasi: formazione (una pattuglia supera il veicolo nella corsia libera e gli rientra davanti, due si affiancano, una chiude dietro),
   stretta (quella davanti frena in modo progressivo, le altre si stringono a pochi centimetri: il veicolo non ha più spazio),
   presa (veicolo fermo e chiuso: restano attorno finché non scende o forza). Ogni pattuglia della scatola è guidata da un controllo
   dedicato che segue il veicolo nel sistema di riferimento della strada (non la scia generica dell'inseguimento). */
// riferimento della scatola: la direzione della strada sotto al veicolo (più stabile della sua traiettoria quando sterza)
function pdBoxFr(T){const B=PD.case&&PD.case.box;if(B&&B.frT===PD.t&&B.fr)return B.fr;const h=T.dirA!==undefined?T.dirA:Math.atan2(T.dx,T.dz),q=pdBestSeg(T.x,T.z,12,h);let dx=T.dx,dz=T.dz;
 if(q&&q.s){const s=q.s,L=s.len||1,ux=(s.bx-s.ax)/L,uz=(s.bz-s.az)/L,d=ux*T.dx+uz*T.dz;if(Math.abs(d)>.8){const sg=d>=0?1:-1;dx=ux*sg;dz=uz*sg}}
 const fr={dx,dz,rx:-dz,rz:dx,vT:Math.max(0,T.vx*dx+T.vz*dz)};if(B){B.fr=fr;B.frT=PD.t}return fr}
// rettilineo davanti lungo il percorso previsto (pdRoadGeom guarda solo un centinaio di metri): finché la direzione resta entro ~14°
function pdStraightLen(T,max){const pr=pdPredict(T.x,T.z,T.dirA,max);if(!pr.ok||pr.pts.length<2)return 0;let acc=0;for(let i=1;i<pr.pts.length;i++){const a=pr.pts[i-1],b=pr.pts[i],l=Math.hypot(b[0]-a[0],b[1]-a[1]);if(l<.01)continue;if(((b[0]-a[0])*T.dx+(b[1]-a[1])*T.dz)/l<.97)break;acc+=l}return acc}
// scelta dei ruoli: tutte le combinazioni (fino a 6 pattuglie vicine), costo minimo; attraversare la corsia del veicolo vicino a lui costa molto
function pdBoxRoles(pool,T,fr,Ll,Rl){const P=pool.slice(0,6),n=P.length,rl=P.map(u=>[(u.x-T.x)*fr.dx+(u.z-T.z)*fr.dz,(u.x-T.x)*fr.rx+(u.z-T.z)*fr.rz]);let best=null,bc=1e9;
 for(let f=0;f<n;f++)for(let l=0;l<n;l++){if(l===f)continue;for(let r=0;r<n;r++){if(r===f||r===l)continue;for(let b=0;b<n;b++){if(b===f||b===l||b===r)continue;const F=rl[f],L=rl[l],R=rl[r],K=rl[b];
  let cost=Math.max(0,10-F[0])*1.3+Math.abs(F[1])*.2;
  cost+=Math.abs(L[0]+2)*.5+Math.abs(L[1]-Ll)*1.1+(L[1]>1.2&&L[0]>-15?22:0);
  cost+=Math.abs(R[0]+2)*.5+Math.abs(R[1]-Rl)*1.1+(R[1]<-1.2&&R[0]>-15?22:0);
  cost+=Math.abs(K[0]+8)*.5+Math.abs(K[1])*.9+(Math.abs(K[1])>1.5&&K[0]>-6?10:0);
  const ps=Math.abs(F[1])>1.2?Math.sign(F[1]):(-Ll>=Rl?-1:1),S=ps<0?L:R;if(F[0]<7&&S[0]>F[0]-4&&Math.abs(S[1]-F[1])<2.2)cost+=15;   // la pattuglia del lato di sorpasso non deve stare davanti a chi supera
  if(cost<bc){bc=cost;best={F:P[f],L:P[l],R:P[r],B:P[b],ps}}}}}
 return best}
// chiamata dalla formazione (ogni 0,4 s): decide se formarla, controlla le fasi; restituisce i membri (che non ricevono altri posti)
function pdBoxPre(c,att,T,st,used){let B=c.box;const g=pdRoadGeom(T),tg=pdTargetLat(T),hw=tg.W/2,roomL=hw+tg.tl-1.1,roomR=hw-tg.tl-1.1;
 if(!B){if(st<3||!T.car||T.sp<9||T.sp>42||PD.t<TAC.boxCool||PD.t-(c.pursuitT0||0)<8)return null;
  const need=Math.max(150,T.sp*6);if(g.off||g.w<12||roomL<3||roomR<3||pdStraightLen(T,need+20)<need)return null;
  const fr=pdBoxFr(T);
  // niente traffico davanti nelle corsie del veicolo: la scatola che frena non deve finire addosso a un'auto
  for(const q of CARS){const rx=q.x-T.x,rz=q.z-T.z,al=rx*fr.dx+rz*fr.dz,lt=rx*fr.rx+rz*fr.rz;if(al>-6&&al<110&&Math.abs(lt)<hw+2&&(Math.sin(q.h)*fr.dx+Math.cos(q.h)*fr.dz)>.3)return null}
  const pool=att.filter(u=>!u.icpt&&!u.pincer&&!u.flat&&!(u.hp<.4)&&Math.hypot(u.x-T.x,u.z-T.z)<70).sort((a,b)=>Math.hypot(a.x-T.x,a.z-T.z)-Math.hypot(b.x-T.x,b.z-T.z));if(pool.length<4)return null;
  const Ll=-Math.min(3.6,roomL-.3),Rl=Math.min(3.6,roomR-.3),R=pdBoxRoles(pool,T,fr,Ll,Rl);if(!R)return null;
  B=c.box={ph:'form',t0:PD.t,who:{F:R.F.id,L:R.L.id,R:R.R.id,B:R.B.id},Ll,Rl,ps:R.ps,okT:0,badT:0,qT:0,v0:0,stopT:0,merged:false};
  for(const k of ['F','L','R','B']){const u=R[k];u.boxRole=k;u.brain.man=null;u.brain.act='follow';u.slot=null;u.chaseRoute=null;u.utm=null}TAC.stat.boxForm++;
  pdSay('boxPlan','C',{f:R.F.name,l:R.L.name,r:R.R.name,b:R.B.name},3,{force:true});EV.emit('boxPlan',{f:R.F.name,l:R.L.name,r:R.R.name,b:R.B.name});plog('decisione','scatola: '+R.F.name+' davanti (supera a '+(R.ps<0?'sinistra':'destra')+'), '+R.L.name+' a sinistra, '+R.R.name+' a destra, '+R.B.name+' dietro',{})}
 const m={};for(const k of ['F','L','R','B']){const u=PD.units.find(q=>q.id===B.who[k]);if(!u||u.status!=='chasing'||u.lod!=='near'||u.flat||Math.hypot(u.x-T.x,u.z-T.z)>120){pdBoxEnd(c,'una pattuglia non è più in posizione',false);return null}m[k]=u}
 if(B.ph!=='hold'&&(g.off||g.w<9||(g.straight<35&&T.sp>12)||T.sp>46)){pdBoxEnd(c,g.straight<35?'curva o incrocio davanti':'strada non adatta',false);return null}
 const fr=pdBoxFr(T);for(const k in m){const u=m[k];u._al=(u.x-T.x)*fr.dx+(u.z-T.z)*fr.dz;u._lt=(u.x-T.x)*fr.rx+(u.z-T.z)*fr.rz}
 const F=m.F,L=m.L,R=m.R,Bk=m.B;
 if(B.ph==='form'){if(PD.t-B.t0>20){pdBoxEnd(c,'non si chiude in tempo',false);return null}
  const ok=F._al>5&&F._al<14&&Math.abs(F._lt)<1.4&&Math.abs(L._al+.3)<3&&Math.abs(L._lt-B.Ll)<1.1&&Math.abs(R._al+.3)<3&&Math.abs(R._lt-B.Rl)<1.1&&Bk._al<-4.5&&Bk._al>-12&&Math.abs(Bk._lt)<1.5;
  B.okT=ok?B.okT+.4:0;if(B.okT>=.8){B.ph='squeeze';B.qT=PD.t;B.v0=Math.max(0,F.fwd);B.stopT=0;B.badT=0;pdSay('boxClose',F,{},3,{force:true});EV.emit('boxClose',{kmh:Math.round(T.sp*3.6)});plog('decisione','scatola chiusa: frenano insieme da '+Math.round(T.sp*3.6)+' km/h',{});CINE.ev('box',T.x,T.z,{h:T.dirA})}}
 else if(B.ph==='squeeze'){const t=PD.t-B.qT;if(t>16){pdBoxEnd(c,'scatola aperta troppo a lungo',false);return null}
  const bad=(F._al<1.8||F._al>16||Math.abs(F._lt)>2.4)||(Math.abs(L._al)>6.5||Math.abs(L._lt-B.Ll)>2.8)||(Math.abs(R._al)>6.5||Math.abs(R._lt-B.Rl)>2.8)||(Bk._al>-2||Bk._al<-18);
  B.badT=bad?B.badT+.4:0;if(B.badT>=1.6){pdBoxEnd(c,'il veicolo ha forzato la scatola',false);return null}
  B.stopT=T.sp<1.8?B.stopT+.4:0;if(B.stopT>=.8){B.ph='hold';B.hT=PD.t;B.escT=0;TAC.stat.boxWin++;pdSay('boxWin',F,{},3,{force:true});EV.emit('boxWin',{t:+(PD.t-B.qT).toFixed(1)});plog('decisione','scatola: veicolo fermato e chiuso fra le pattuglie',{});CINE.ev('boxWin',T.x,T.z,{h:T.dirA})}}
 else if(B.ph==='hold'){B.escT=T.sp>3?B.escT+.4:0;if(B.escT>=1.2){pdBoxEnd(c,'il veicolo è uscito dalla scatola',false);return null}if(PD.t-B.hT>14){pdBoxEnd(c,'veicolo fermato',true);return null}}
 for(const k of ['SL','SR','R0','F0'])used.add(k);return [F,L,R,Bk]}
// guida di una pattuglia della scatola (ogni fotogramma): posto da raggiungere nel riferimento della strada, spostamenti laterali solo se liberi
function pdBoxDrive(u,T,dt){const c=PD.case,B=c&&c.box,k=u.boxRole;if(!B||!B.who||B.who[k]!==u.id){u.boxRole=undefined;return false}
 if(c.phase!=='pursuit'){pdBoxEnd(c,'contatto perso',false);return false}
 const fr=pdBoxFr(T),vT=fr.vT,mem=[];for(const q of ['F','L','R','B']){const o=PD.units.find(v=>v.id===B.who[q]);if(o)mem.push(o)}
 const rl=o=>[(o.x-T.x)*fr.dx+(o.z-T.z)*fr.dz,(o.x-T.x)*fr.rx+(o.z-T.z)*fr.rz,o.vx*fr.dx+o.vz*fr.dz],me=rl(u),al=me[0],lt=me[1];
 const Fu=mem.find(o=>o.boxRole==='F'),fq=Fu?rl(Fu):[0,0,0],fDone=fq[0]>6.2&&Math.abs(fq[1])<1.6;
 let A,L,cap=99,stop=false;
 if(B.ph==='hold'){stop=true;A=al;L=lt}
 else if(B.ph==='form'){
  if(k==='F'){if(B.merged||al>7.2){B.merged=true;A=9.5;L=0}else{A=13;L=B.ps<0?B.Ll:B.Rl}}   // supera nella corsia libera, poi rientra davanti
  else if(k==='L'||k==='R'){const sd=k==='L'?B.Ll:B.Rl;A=(!fDone&&Math.sign(sd)===B.ps)?-14:-.3;L=sd;   // il lato del sorpasso resta libero finché non è passato
   if(Math.sign(lt)!==Math.sign(sd)&&Math.abs(lt)>1.2){const bq=mem.find(o=>o.boxRole==='B'),ba=bq?rl(bq)[0]:-8;A=Math.min(ba,-6)-9;if(al>A+3)L=lt}}   // dal lato sbagliato: si lascia sfilare dietro alla coda e attraversa lì
  else{A=fDone?-6.6:-8.5;L=0}}
 else{const t=PD.t-B.qT;if(k==='F'){A=4.95;L=0;cap=Math.max(0,Math.min(vT-.5,B.v0-3*t));if(al<5.05&&vT>u.fwd-.3)cap=Math.max(0,Math.min(cap,vT-2.5))}else if(k==='L'){A=-.2;L=-2.3}else if(k==='R'){A=-.2;L=2.3}else{A=-5;L=0}}
 const obs=[[0,0,vT]].concat(mem.filter(o=>o!==u).map(rl));
 if(!stop&&Math.abs(L-lt)>.9){const lo=Math.min(lt,L),hi=Math.max(lt,L);for(const q of obs){if(Math.abs(q[1]-lt)<1.3)continue;if(q[1]>lo-1.95&&q[1]<hi+1.95&&Math.abs(q[0]-al)<4.7){L=lt+Math.sign(L-lt)*Math.max(0,Math.abs(q[1]-lt)-2.3);if(q[0]>al)A=Math.min(A,q[0]-6.5);break}}}
 let v=stop?0:vT+pdClamp((A-al)*.9,-10,15);
 if(!stop)for(const q of obs){const dA=q[0]-al;if(dA>0&&dA<14&&Math.abs(q[1]-lt)<2.1)v=Math.min(v,q[2]+(dA-5.3)*1.1)}
 v=Math.max(0,Math.min(v,cap,52));
 if(B.ph!=='form')u.yw*=Math.exp(-5*dt);   // nella stretta l'autista tiene l'auto dritta contro le spinte (controsterzo)
 if(stop){u.ix=0;u.iy=-1;u.hb=u.fwd<1.5;u.vt=0;return true}
 const Lk=pdClamp(Math.max(0,u.fwd)*.55,6,16);pdSteerTo(u,T.x+fr.dx*(al+Lk)+fr.rx*L,T.z+fr.dz*(al+Lk)+fr.rz*L,1.7);
 u.vt=v;u.iy=pdClamp((v-u.fwd)*.7,-1,1);u.hb=v<.3&&u.fwd<1;return true}
function pdBoxEnd(c,why,win){const B=c.box;if(!B)return;const by=PD.units.find(q=>q.id===B.who.F)||PD.units.find(q=>q.id===B.who.B);for(const k in B.who){const u=PD.units.find(q=>q.id===B.who[k]);if(u){u.boxRole=undefined;if(u.slot&&u.slot.box)u.slot=null}}
 c.box=null;TAC.boxCool=PD.t+(win?30:18);if(!win&&(B.ph!=='form'||PD.t-B.t0>4)){TAC.stat.boxFail++;if(by)pdSay('boxFail',by,{},3,{force:true});EV.emit('boxFail',{why,ph:B.ph})}
 plog('decisione','scatola finita: '+why,{})}

/* ---------- tenaglia: due pattuglie nelle laterali di un incrocio sul percorso previsto ---------- */
// laterali utili di un incrocio: quasi perpendicolari al percorso, una per lato; punto di attesa vicino all'incrocio e partenza nascosta
function pdPincerBranches(n,pv,jn,pdir,jd,T,rej){const c0=NAVG.nodes[n],br=[],eta=jd/Math.max(6,T.sp),reach=pdClamp((eta-4)*13,60,230);
 for(const e of NAVG.adj[n]){const m=e[1];if(m===pv||m===jn||m===n)continue;const q=NAVG.nodes[m],l=Math.hypot(q[0]-c0[0],q[1]-c0[1]);if(l<3)continue;const bx=(q[0]-c0[0])/l,bz=(q[1]-c0[1])/l;if(Math.abs(bx*pdir[0]+bz*pdir[1])>.75){rej.push('obliqua');continue}
  const side=Math.sign(pdir[0]*bz-pdir[1]*bx)||1;if(br.some(o=>o.side===side))continue;
  // percorre la laterale tenendo la continuazione più dritta (anche oltre altri incroci)
  let cur=m,prev=n,d=l,pts=[[c0[0],c0[1]],[q[0],q[1]]],guard=0,dvx=bx,dvz=bz;while(d<240&&guard++<14){let nx=-1,bl=0,bs=.6;const cn=NAVG.nodes[cur];for(const e2 of NAVG.adj[cur]){if(e2[1]===prev||e2[1]===cur)continue;const q2=NAVG.nodes[e2[1]],l2=Math.hypot(q2[0]-cn[0],q2[1]-cn[1]);if(l2<.3)continue;const dd=((q2[0]-cn[0])*dvx+(q2[1]-cn[1])*dvz)/l2;if(dd>bs){bs=dd;nx=e2[1];bl=l2}}if(nx<0)break;const q2=NAVG.nodes[nx];dvx=(q2[0]-cn[0])/bl;dvz=(q2[1]-cn[1])/bl;prev=cur;cur=nx;d+=bl;pts.push(q2.slice())}
  if(d<14){rej.push('laterale cieca '+Math.round(d)+' m');continue}
  const at=dist=>{let a2=0;for(let k=1;k<pts.length;k++){const p=pts[k-1],q2=pts[k],l2=Math.hypot(q2[0]-p[0],q2[1]-p[1]);if(a2+l2>=dist){const f=(dist-a2)/(l2||1);return [p[0]+(q2[0]-p[0])*f,p[1]+(q2[1]-p[1])*f]}a2+=l2}return null};
  const hd=Math.min(28,d*.55),H=at(hd);if(!H||WORLD.wet(H[0],H[1])){rej.push('attesa in acqua');continue}
  // partenza: sulla laterale stessa se è abbastanza lunga, altrimenti una strada vicina nascosta da cui si arriva in tempo
  let S=null,route=null;const sd=Math.min(reach,d-4);if(sd>=hd+35){const S0=at(sd);if(S0&&pdHidden(S0[0],S0[1])&&!WORLD.wet(S0[0],S0[1])){S=S0;const rp=[S0];let a2=0;const mid=[];for(let k=1;k<pts.length;k++){a2+=Math.hypot(pts[k][0]-pts[k-1][0],pts[k][1]-pts[k-1][1]);if(a2>hd+1&&a2<sd-1)mid.push(pts[k])}for(let k=mid.length-1;k>=0;k--)rp.push(mid[k].slice());rp.push(H);route={ok:true,pts:rp,len:sd-hd,v6:1}}}
  if(!S){const cx=Math.floor((H[0]+WORLD.WS)/WORLD.CSZ),cz=Math.floor((H[1]+WORLD.WS)/WORLD.CSZ),cand=[];for(let dz=-3;dz<=3;dz++)for(let dx=-3;dx<=3;dx++){const a=WORLD.SCH.get((cx+dx)+','+(cz+dz));if(a)for(const id of a){const g=RSL[id];if(!g||g.len<10||g.pv||g.pol||g.tp||g.mw||g.ramp||g.br)continue;const mx=(g.ax+g.bx)/2,mz=(g.az+g.bz)/2,dd=Math.hypot(mx-H[0],mz-H[1]),dJ=Math.hypot(mx-c0[0],mz-c0[1]);if(dd<45||dd>reach*.85||dJ<40)continue;cand.push([dd,mx,mz])}}
   cand.sort((a,b)=>b[0]-a[0]);let tries=0;for(const k of cand){if(tries>=6)break;if(!pdHidden(k[1],k[2])||WORLD.wet(k[1],k[2]))continue;tries++;const r=pdRoute(k[1],k[2],H[0],H[1]);if(!r.ok||r.len>reach*1.25||r.pts.length<2)continue;
    // l'ultimo tratto deve arrivare dalla laterale (non attraverso l'incrocio sotto gli occhi del veicolo)
    const pa=r.pts[r.pts.length-2],pb=r.pts[r.pts.length-1],la=Math.hypot(pb[0]-pa[0],pb[1]-pa[1])||1;if(((pb[0]-pa[0])*-bx+(pb[1]-pa[1])*-bz)/la<.7)continue;let viaJ=false;for(const p2 of r.pts)if(Math.hypot(p2[0]-c0[0],p2[1]-c0[1])<12){viaJ=true;break}if(viaJ)continue;S=[k[1],k[2]];route=r;break}}
  if(!S){rej.push('nessuna partenza nascosta in tempo');continue}
  br.push({side,H,S,route,dirIn:[-bx,-bz]})}
 return br}
function pdPincerPlan(c,T,st,dry){const ts=T.seg&&T.seg.s,W=w=>{TAC.pinWhy=w};if(!ts||ts.mw||ts.tp||ts.ramp||T.sp<7||T.sp>30)return W('strada o velocità non adatte');TAC.pinCool=PD.t+6;
 const pr=pdPredict(T.x,T.z,T.dirA,480);if(!pr.ok||pr.pts.length<3)return W('percorso previsto troppo corto');let acc=0,best=null,nJ=0;const rej=[];
 // tutti gli incroci fra 150 e 430 m: il primo con una laterale per lato (tenaglia), altrimenti il primo con una sola (agguato)
 for(let i=1;i<pr.pts.length;i++){const a=pr.pts[i-1],b=pr.pts[i],l=Math.hypot(b[0]-a[0],b[1]-a[1]);acc+=l;if(acc<150)continue;if(acc>430)break;const n=navNear(b[0],b[1],3);if(n<0||NAVG.adj[n].length<3)continue;nJ++;
  const nb=pr.pts[i+1],jn=nb?navNear(nb[0],nb[1],3):-1,pv=navNear(a[0],a[1],3),pdir=[(b[0]-a[0])/(l||1),(b[1]-a[1])/(l||1)],br=pdPincerBranches(n,pv,jn,pdir,acc,T,rej);
  if(br.length>=2){best={n,jd:acc,pdir,br:br.slice(0,2),path:pr.pts.slice(0,i+1)};break}if(br.length===1&&!best)best={n,jd:acc,pdir,br,path:pr.pts.slice(0,i+1)}}
 if(dry)return best;if(!best)return W(nJ?nJ+' incroci senza laterali utili ('+[...new Set(rej)].join(', ')+')':'nessun incrocio fra 150 e 430 m');
 const nb2=best.br.length;if(PD.units.filter(u=>u.status!=='gone').length+nb2>PD.cfg.maxUnits)dspMakeRoom(nb2);if(PD.units.filter(u=>u.status!=='gone').length+nb2>PD.cfg.maxUnits)return W('limite di unità');
 const c0=NAVG.nodes[best.n],ids=[];for(const b of best.br){const r=b.route||pdRoute(b.S[0],b.S[1],b.H[0],b.H[1]),h=r.ok&&r.pts.length>1?Math.atan2(r.pts[1][0]-b.S[0],r.pts[1][1]-b.S[1]):Math.atan2(b.dirIn[0],b.dirIn[1]),u=pdNewUnit(pdRnd()<.5?'CC':'PS',b.S[0],b.S[1],h,{});u.case=c.id;u.status='chasing';u.lights=true;u.brain.act='follow';u.role='support';
  r.ri=1;r.made=PD.t;const off=nb2>=2?2.4:0;u.pincer={J:{x:c0[0],z:c0[1]},Jt:{x:c0[0]-b.dirIn[0]*off,z:c0[1]-b.dirIn[1]*off},H:{x:b.H[0],z:b.H[1]},dirIn:b.dirIn,ph:'go',t0:PD.t,route:r,pd:best.pdir,side:b.side,path:best.path};u.vx=Math.sin(h)*8;u.vz=Math.cos(h)*8;u.fwd=u.sp=8;ids.push(u.id)}
 c.pin={J:{x:c0[0],z:c0[1]},ids,t0:PD.t,pd:best.pdir,two:nb2>=2};TAC.stat.pin++;TAC.pinCool=PD.t+30;const n0=pdName(ids[0]),n1=nb2>=2?pdName(ids[1]):null;W('');
 if(nb2>=2){pdSay('pinPlan','C',{place:pdPlace(c0[0],c0[1]),a:n0,b:n1},3,{force:true});plog('decisione','tenaglia all\'incrocio a '+Math.round(best.jd)+' m: '+n0+' e '+n1+' dalle laterali',{})}
 else{pdSay('pinPlan1','C',{place:pdPlace(c0[0],c0[1]),a:n0},3,{force:true});plog('decisione','agguato all\'incrocio a '+Math.round(best.jd)+' m: '+n0+' dalla laterale',{})}
 EV.emit('pincer',{a:n0,b:n1,two:nb2>=2,place:pdPlace(c0[0],c0[1]),dist:Math.round(best.jd)})}
// posizione del veicolo rispetto al percorso previsto fino all'incrocio: distanza dal percorso e metri che mancano all'incrocio
// distanza di un punto da una polilinea e metri che restano fino alla sua fine (dalla proiezione del punto)
function pdPolyRem(p,x,z){if(!p||p.length<2)return{off:0,rem:p&&p.length?Math.hypot(p[0][0]-x,p[0][1]-z):0};let bd=1e9,bi=1,bt=0;for(let k=1;k<p.length;k++){const a=p[k-1],b=p[k],dx=b[0]-a[0],dz=b[1]-a[1],L2=dx*dx+dz*dz||1;let t=((x-a[0])*dx+(z-a[1])*dz)/L2;t=t<0?0:t>1?1:t;const d=Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);if(d<bd){bd=d;bi=k;bt=t}}
 let rem=0;for(let k=bi;k<p.length;k++){const l=Math.hypot(p[k][0]-p[k-1][0],p[k][1]-p[k-1][1]);rem+=k===bi?l*(1-bt):l}return{off:bd,rem,k:bi}}
function pdRouteRem(u,r){return pdPolyRem(r.pts,u.x,u.z).rem}
// posizione del veicolo rispetto al percorso previsto fino all'incrocio
function pdPinPath(P,x,z){return P.path&&P.path.length>1?pdPolyRem(P.path,x,z):{off:0,rem:Math.hypot(P.J.x-x,P.J.z-z)}}
function pdPincerDrive(u,T,dt){const P=u.pincer,c=PD.case,J=P.J;if(!c||c.phase!=='pursuit'){u.pincer=null;return false}
 const Jt=P.Jt||J,pj=pdPinPath(P,T.x,T.z),tJ=(J.x-T.x)*P.pd[0]+(J.z-T.z)*P.pd[1],dTJ=Math.hypot(J.x-T.x,J.z-T.z),dUJ=Math.hypot(Jt.x-u.x,Jt.z-u.z);
 const release=(why,said)=>{u.pincer=null;if(said)pdSay('pinMiss',u,{},2);plog('unità',u.name+': tenaglia finita ('+why+')',{});if(c.pin&&c.pin.ids.every(id=>{const o=PD.units.find(q=>q.id===id);return !o||!o.pincer}))c.pin=null;return false};
 if(PD.t-P.t0>45)return release('tempo',false);
 const passed=dTJ<45&&tJ<-8;
 if(P.ph==='go'||P.ph==='hold'){if(passed)return release('il veicolo è già passato',true);P.offT=pj.off>18&&T.sp>2?(P.offT||0)+dt:0;if(P.offT>1)return release('il veicolo ha cambiato strada',true)}
 const eT=passed?99:pj.rem/Math.max(3,T.sp),eU=Math.sqrt(2*dUJ/4.2)+.35;
 const strike=()=>{P.ph='strike';P.sT=PD.t;pdSay('pinGo',u,{},3,{force:true});EV.emit('pincerGo',{id:u.id,name:u.name})};
 // inquadratura spettacolare quando il veicolo arriva all'incrocio già chiuso (una volta per tenaglia)
 if((P.ph==='strike'||P.ph==='block')&&c.pin&&!c.pin.cine&&dTJ<42&&tJ>0){c.pin.cine=true;CINE.ev('pincer',J.x,J.z,{h:T.dirA})}
 if(P.ph==='go'){const dH=Math.hypot(u.x-P.H.x,u.z-P.H.z),rr=P.route&&P.route.ok?pdRouteRem(u,P.route):dH;if(dH<7){P.ph='hold';P.hT=PD.t;P.atH=true}else if(eT<(rr+Math.hypot(P.H.x-J.x,P.H.z-J.z))/14+.5){strike()}else{pdFollowRoute(u,P.route,Math.max(18,pdRoadV(u)),0,true);const vS=Math.sqrt(12*Math.max(0,rr-5))+3;u.iy=Math.min(u.iy,pdClamp((vS-u.fwd)*.45,-1,1));return true}}
 if(P.ph==='hold'){if(eT<=eU+1.1||PD.t-P.hT>25)strike();
  else{const err=pdSteerTo(u,Jt.x,Jt.z,1.5);if(Math.abs(err)>.4&&u.sp<3){pdSpeedTo(u,2)}else{u.iy=-1;u.hb=u.sp<1}return true}}
 if(P.ph==='strike'){if(dUJ<1.2||(dUJ<2.5&&u.fwd<.8)||PD.t-P.sT>9||((u.x-Jt.x)*P.dirIn[0]+(u.z-Jt.z)*P.dirIn[1])>1){P.ph='block';P.bT=PD.t;TAC.stat.pinHit++;EV.emit('pincerBlock',{id:u.id,name:u.name,d:+Math.hypot(u.x-T.x,u.z-T.z).toFixed(1)})}
  else{const dH=Math.hypot(u.x-P.H.x,u.z-P.H.z);if(dH<9)P.atH=true;if(!P.atH&&P.route&&P.route.ok&&P.route.ri<P.route.pts.length-1){pdFollowRoute(u,P.route,30,0,false)}else{pdSteerTo(u,Jt.x,Jt.z,1.8);const vb=Math.sqrt(14*Math.max(0,dUJ-.5))+.6;pdSpeedTo(u,Math.min(30,vb));if(u.fwd>vb+1)u.iy=-1}u.hb=false;return true}}
 if(P.ph==='block'){if(PD.t-P.bT>3.5||(passed&&dTJ>25))return release('incrocio chiuso',false);u.ix=0;u.iy=-1;u.hb=true;return true}
 return false}
