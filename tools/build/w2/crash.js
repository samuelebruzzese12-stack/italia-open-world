/* ===== DISTRUZIONE REALISTICA (Versione 20) =====
   Si aggiunge alla carrozzeria a nodi e travi della Versione 19:
   - scintille e stridio metallico quando la lamiera striscia contro muri, guardrail o un'altra auto, quando il cerchio senza ruota
     tocca l'asfalto o il tetto scivola dopo un ribaltamento;
   - ribaltamento: la sezione dell'auto rotola sul terreno come un poligono (ruote, sottoporta, spalle, tetto) con gravità e urti;
     scatta quando l'auto scivola di traverso e qualcosa la fa inciampare (cerchio che morde l'asfalto, gomme a terra, scarpata,
     guardrail preso di lato); ogni volta che tetto o fiancata battono a terra la rete si schiaccia dall'alto;
   - parti incernierate: cofano (si sgancia, si alza e con il vento sbatte contro il parabrezza), baule (si apre sugli ammortizzatori
     a gas), porte (si sganciano negli urti laterali medi e oscillano con frenate e curve; troppo schiacciate restano bloccate);
     a una battuta violenta la cerniera cede e il pezzo vola via;
   - paraurti che resta appeso da un lato e striscia a terra con le scintille finché non si stacca;
   - vapore dal radiatore rotto, macchie d'olio sotto il motore, incendio che cresce (vetri che scoppiano col calore, gomme che
     esplodono, vernice che brucia fino a lasciare la carcassa annerita);
   - parabrezza stratificato che si incrina a ragnatela invece di cadere (cade solo se l'urto è molto forte);
   - gomma che scoppia quando la ruota prende un colpo violento. */
const CR={snd:{},rol:{n:0,flip:0},stat:{sparks:0,hinge:0,detach:0,hang:0,steam:0,fire:0,crack:0,burst:0,roll:0}};
/* ---------- suoni procedurali ---------- */
function crCtx(){try{return (typeof pdAudio!=='undefined'&&pdAudio&&pdAudio.ctx)||null}catch(e){return null}}
function crNoise(c){if(CR.nb&&CR.nb.sampleRate===c.sampleRate)return CR.nb;const n=c.sampleRate,b=c.createBuffer(1,n,c.sampleRate),d=b.getChannelData(0);for(let i=0;i<n;i++)d[i]=Math.random()*2-1;CR.nb=b;return b}
// suoni continui (strisciata, sibilo del vapore, fuoco): un generatore per tipo, il volume richiesto in ogni fotogramma
function crLoop(kind,vol,freq){if(!(vol>.005))return;const c=crCtx();if(!c)return;let L=CR.snd[kind];
 if(!L){try{const s=c.createBufferSource();s.buffer=crNoise(c);s.loop=true;const f=c.createBiquadFilter();f.type=kind==='hiss'?'highpass':kind==='fire'?'lowpass':'bandpass';f.frequency.value=freq||1500;f.Q.value=kind==='scrape'?1.6:.6;const g=c.createGain();g.gain.value=0;s.connect(f);f.connect(g);g.connect(c.destination);s.start();L=CR.snd[kind]={s,f,g,v:0,want:0}}catch(e){return}}
 L.want=Math.max(L.want,vol);if(freq)L.fq=freq}
function crLoopStep(dt){const c=crCtx();if(!c)return;for(const k in CR.snd){const L=CR.snd[k],w=Math.min(.6,L.want);L.v+=(w-L.v)*Math.min(1,dt*(w>L.v?20:5));try{L.g.gain.setTargetAtTime(L.v,c.currentTime,.03);if(L.fq)L.f.frequency.setTargetAtTime(L.fq,c.currentTime,.05)}catch(e){}L.want=0}}
// colpo secco (gomma che scoppia, vetro, botto del fuoco): rumore con decadimento rapido
function crBang(vol,lp,len){const c=crCtx();if(!c||!(vol>.01))return;try{const t=c.currentTime,n=Math.floor(c.sampleRate*(len||.3)),b=c.createBuffer(1,n,c.sampleRate),d=b.getChannelData(0);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*Math.exp(-i/(n*.08));
  const s=c.createBufferSource();s.buffer=b;const f=c.createBiquadFilter();f.type='lowpass';f.frequency.value=lp||1400;const g=c.createGain();g.gain.value=Math.min(1,vol);s.connect(f);f.connect(g);g.connect(c.destination);s.start(t)}catch(e){}}
// attenuazione con la distanza dalla telecamera (o dal giocatore)
function crVol(x,z){const px=typeof inCar!=='undefined'&&inCar?C.x:P.x,pz=typeof inCar!=='undefined'&&inCar?C.z:P.z,d=Math.hypot(x-px,z-pz);return Math.max(0,1-d/90)}

/* ---------- scintille dalla lamiera che striscia ---------- */
// punto di contatto (mondo), direzione tangente, velocità di strisciamento (m/s), pressione (m/s di velocità normale)
// quantità per secondo (non per fotogramma): con il telefono lento ogni fotogramma ne lancia di più
function crScrape(x,y,z,tx,tz,vt,pres){const a=Math.abs(vt);if(a<3.2)return;const vol=crVol(x,z);if(vol<=0)return;CR.acc=(CR.acc||0)+(70+a*13+pres*25)*(CR.dt||.016);const n=Math.min(16,Math.floor(CR.acc));CR.acc-=n;if(n<=0)return;
 FX.sparks(x,y,z,tx*vt*.42,tz*vt*.42,n,2.4+a*.07);CR.stat.sparks+=n;crLoop('scrape',vol*Math.min(.5,.07+a/50+pres*.05),1500+a*40)}

/* ---------- ribaltamento ----------
   La sezione trasversale dell'auto è un corpo rigido (poligono: ruote, sottoporta, spalle, bordi del tetto) che cade, rimbalza, rotola
   e striscia sull'asfalto: gravità, urti con perdita di energia (lamiera che si accartoccia), attrito della lamiera sull'asfalto.
   L'inciampo toglie di colpo parte della velocità laterale al punto basso (cordolo, cerchio che morde l'asfalto): il baricentro,
   più alto, continua e l'auto gira. Ad alta velocità l'auto si stacca da terra fra un urto e l'altro (ribaltamenti a botte). */
// vertici (metri dal baricentro; x verso la destra dell'auto, y in alto)
const RPOLY=[[.78,-.55],[.93,-.3],[.88,.3],[.6,.9],[-.6,.9],[-.88,.3],[-.93,-.3],[-.78,-.55]],RK2=.42,RCGY=.55;
function rlRot(k,phi){const c=Math.cos(phi),s=Math.sin(phi),x=RPOLY[k][0],y=RPOLY[k][1];return[x*c-y*s,x*s+y*c]}
// inizio: o = stato del veicolo, vl velocità laterale (+ verso destra), hTrip altezza dell'inciampo, f quota di velocità tolta al punto d'inciampo,
// dig: attrito del cerchio che morde l'asfalto (sul lato verso cui scivola) per i primi istanti
function rlStart(o,vl,hTrip,why,f,dig){if(o.rol)return false;const side=vl>=0?1:-1,r={x:0,y:RCGY,vx:vl,vy:0,phi:0,w:0,t:0,n:0,why,ev:null,dig:dig||0,side,maxY:RCGY,turns:0,sl:0};
 if(f>0){const rx=.85*side,ry=Math.max(-.55,(hTrip||0)-RCGY),vtx=r.vx-r.w*ry,J=-f*vtx/(1+ry*ry/RK2);r.vx+=J;r.w+=-ry*J/RK2}
 o.rol=r;CR.stat.roll++;CR.rol.n++;return true}
// passo: restituisce lo spostamento laterale del baricentro (m); r.y altezza del baricentro; r.ev urto più forte del passo; r.slide strisciamento della lamiera
function rlStep(o,dt){const r=o.rol,g=9.8,st=Math.max(1,Math.ceil(dt/.0025)),h=dt/st;let ds=0;r.ev=null;r.slide=null;r.t+=dt;
 for(let q=0;q<st;q++){r.vy-=g*h;r.x+=r.vx*h;ds+=r.vx*h;r.y+=r.vy*h;const ph0=r.phi;r.phi+=r.w*h;
  // contatti con l'asfalto (dal più profondo)
  let deep=0;const ks=[];for(let k=0;k<8;k++){const p=rlRot(k,r.phi),Y=r.y+p[1];if(Y<0){ks.push([Y,k,p]);if(-Y>deep)deep=-Y}}
  ks.sort((a,b)=>a[0]-b[0]);
  for(const [Y,k,p] of ks){const vpx=r.vx-r.w*p[1],vpy=r.vy+r.w*p[0];if(vpy>=0)continue;
   const e=vpy<-2.5?.18:0,Jn=-(1+e)*vpy/(1+p[0]*p[0]/RK2);r.vy+=Jn;r.w+=p[0]*Jn/RK2;
   const wheel=(k===0||k===7)&&Math.abs(Math.cos(r.phi))>.6&&Math.cos(r.phi)>0,mu=wheel?(r.dig>0&&Math.sign(p[0])===r.side?1.25:.35):.55,vt=r.vx-r.w*p[1],Jt=pdClamp(-vt/(1+p[1]*p[1]/RK2),-mu*Jn,mu*Jn);r.vx+=Jt;r.w+=-p[1]*Jt/RK2;
   if(-vpy>2.2&&(!r.ev||-vpy>r.ev.v))r.ev={v:-vpy,k};if(!wheel&&Math.abs(vt)>2&&(!r.slide||Math.abs(vt)>Math.abs(r.slide.v)))r.slide={k,v:vt}}
  if(deep>0)r.y+=deep;r.dig=Math.max(0,r.dig-h);if(r.y>r.maxY)r.maxY=r.y;
  r.turns+=Math.abs(r.phi-ph0)/(Math.PI*2)}
 // fermo: poca velocità, appoggiato su due vertici
 const v=Math.hypot(r.vx,r.vy)+Math.abs(r.w)*.9;let low=0;for(let k=0;k<8;k++)if(r.y+rlRot(k,r.phi)[1]<.015)low++;
 r.rest=v<.35&&low>=2?(r.rest||0)+dt:0;
 if(r.rest>.25||r.t>14){r.done=true;const c=Math.cos(r.phi);r.up=c>.7;r.roof=c<-.7;r.sideRest=!r.up&&!r.roof}
 return ds}
// urto del ribaltamento sulla rete: il suolo spinge verso l'alto del mondo, cioè (sin φ, cos φ) nella sezione dell'auto;
// nel modello la x è verso la sinistra (si inverte) e l'altezza parte da terra (baricentro a 0,55 m)
function rlCrash(own,r){const e=r.ev;if(!e||e.v<2.2)return null;const n3=[-Math.sin(r.phi),Math.cos(r.phi),0],pv=RPOLY[e.k],c3=[-pv[0],pv[1]+RCGY,0];
 const S=sbState(own),t0=performance.now(),res=sbCrash3(SBT,S,{n3,c3,u:Math.min(11,e.v*1.6),ky:.12,reach:.65}),ms=performance.now()-t0;SBST.n++;SBST.ms+=ms;SBF.ms+=ms;return res}
// posa del modello durante il ribaltamento: rotazione attorno al baricentro (il modello ha l'origine a terra, al centro del pianale)
function crRollPose(g,x,z,h,gy,r){const s=Math.sin(r.phi),c=Math.cos(r.phi),ch=Math.cos(h),sh=Math.sin(h),cgy=gy+r.y;g.rotation.order='YXZ';g.rotation.set(0,h,-r.phi);g.position.set(x-ch*RCGY*s,cgy-RCGY*c,z+sh*RCGY*s)}
// lato di un cerchio a terra (ruota persa, gomma a terra o battistrada staccato) sul lato verso cui l'auto scivola
function crRimSide(a,right){if(!a||!a.wh)return false;const D=a.dmg,ty=a.tyre,map=ty?TYRE.map(a):null;for(let k=0;k<4;k++){const w=a.wh[k],st=w&&w.parent;if(!st)continue;const isR=(st.userData.p0?st.userData.p0.x:st.position.x)<0;if(isR!==right)continue;if(D&&D.wl[k])return true;if(ty){const i=map[k];if(ty.f[i]>.9||ty.shred[i])return true}}return false}
// inciampo dal cerchio che morde l'asfalto mentre l'auto scivola di traverso
function crTrip(o,a,vl,sp,dt,flat){if(o.rol||Math.abs(vl)<6.5||sp<9)return false;const rim=crRimSide(a,vl>0)||!!flat;if(!rim)return false;if(Math.random()<(Math.abs(vl)-6.5)*.6*dt)return rlStart(o,vl,.05,'cerchio',.45,.6);return false}
// urto del ribaltamento: rete schiacciata dall'alto o di fianco, modello deformato, scintille, suono, rallentatore
function crRollHit(a,own,car,r){const e=r.ev;if(!e)return;const vol=crVol(car.x,car.z);crBang(vol*Math.min(1,e.v/7),500+e.v*90,.45);
 const now=performance.now()/1000;if(e.v>2.2&&(!own.sbRollT||now-own.sbRollT>.08)){own.sbRollT=now;rlCrash(own,r);if(a){const D=dmgPrep(a,car.player?['l0','l1']:['l1']);D.on=true;sbModel(a,own,car,false);dmgSound(e.v*2.2,D.glass>0);
  // fiancata che batte forte: le serrature possono saltare (lato a terra: x della sezione verso destra → porte di destra)
  const sd=Math.sin(r.phi);if(Math.abs(sd)>.7&&e.v>3.2){const keys=sd<0?['dFR','dRR']:['dFL','dRL'];for(const k of keys)if(!(a.cr&&a.cr.parts[k])&&Math.random()<.14)crUnlatch(a,car,k,'free',.06,0)}}}
 const p=rlRot(e.k,r.phi),ch=Math.cos(car.h),sh=Math.sin(car.h),wx=car.x-ch*p[0],wz=car.z+sh*p[0];FX.sparks(wx,car.y+.05,wz,car.vx*.3,car.vz*.3,Math.min(14,4+Math.round(e.v*1.5)),3+e.v*.4)}
// guida del giocatore durante il ribaltamento (la guida normale è sospesa): avanti con attrito, di lato con la sezione che rotola
function crRollDrive(dt){const r=V.rol,sn=Math.sin(C.h),cn=Math.cos(C.h);let vf=V.rlF||0;const up=Math.cos(r.phi)>.8&&r.y<RCGY+.06;vf-=Math.sign(vf)*Math.min(Math.abs(vf),(up?1.1:5.4)*dt);V.rlF=vf;
 const ds=rlStep(V,dt);let nx=C.x+sn*vf*dt-cn*ds,nz=C.z+cn*vf*dt+sn*ds;
 // contro un muro: l'auto si ferma (la sezione perde la velocità laterale verso il muro)
 for(const o of [1.3,-1.3]){const fx=nx+sn*o,fz=nz+cn*o,q=push(fx,fz,1);if(q[2]){crTrafficHit();const ux=q[0]-fx,uz=q[1]-fz,l=Math.hypot(ux,uz)||1,mx=ux/l,mz=uz/l;nx+=ux;nz+=uz;const vlat=-cn*mx+sn*mz;if(Math.abs(vlat)>.5&&r.vx*vlat<0){r.vx*=-.15}if((sn*mx+cn*mz)*vf<0)vf=V.rlF=vf*.3}}
 if(WORLD.wet(nx,nz)||!WORLD.inside(nx,nz,40)){nx=C.x;nz=C.z;r.vx=0;vf=V.rlF=0}
 C.x=nx;C.z=nz;P.x=nx;P.z=nz;V.y=GY(C.x,C.z,V.y);P.y=V.y;V.vx=sn*vf-cn*r.vx;V.vz=cn*vf+sn*r.vx;cs.v=vf;V.yw=0;V.ywW=0;V.pt=0;V.rol=r;
 const car={x:C.x,z:C.z,h:C.h,y:V.y,vx:V.vx,vz:V.vz,player:true};if(r.ev)crRollHit(carA,carA,car,r);
 if(r.slide){const p=rlRot(r.slide.k,r.phi);crScrape(C.x-cn*p[0],V.y+.05,C.z+sn*p[0],sn,cn,r.slide.v+vf,2)}else if(!up&&Math.abs(vf)>3){const p=rlRot(rlLowK(r),r.phi);crScrape(C.x-cn*p[0],V.y+.05,C.z+sn*p[0],sn,cn,vf,1.5)}
 if(r.t<.05&&!r.cine){r.cine=1;CINE.ev('flip',C.x,C.z,{h:C.h,dur:2.4})}
 if(r.done){V.rol=null;if(r.up){V.vx=sn*vf-cn*r.vx*.5;V.vz=cn*vf+sn*r.vx*.5;toast('Ti sei ribaltato e sei tornato sulle ruote!')}else{V.flip={roof:r.roof,phi:r.roof?Math.PI*Math.sign(r.phi||1):Math.sign(r.phi||1)*Math.PI/2,y:r.y};V.vx=V.vz=0;cs.v=0;toast(r.roof?'Auto ribaltata sul tetto: scendi (E) o premi Ripara':'Auto sul fianco: scendi (E) o premi Ripara')}EV.emit('rollEnd',{who:'giocatore',up:r.up,roof:r.roof,turns:+r.turns.toFixed(2)})}}
// un'auto del traffico che tocca un'auto che si sta ribaltando si ferma (urta il rottame invece di spingerlo avanti)
function crTrafficHit(){const s=PO.s;if(s&&s.amb&&s.cr&&s.cr.v>0){s.cr.v=0;s.cr.idle=Math.max(s.cr.idle||0,0);CR.stat.traffic=(CR.stat.traffic||0)+1}}
function rlLowK(r){let m=1e9,k=0;for(let i=0;i<8;i++){const y=rlRot(i,r.phi)[1];if(y<m){m=y;k=i}}return k}
// pattuglia: stessa sezione che rotola; finito sul fianco o sul tetto la pattuglia è fuori servizio
function crRollUnit(u,dt){const r=u.rol,sn=Math.sin(u.h),cn=Math.cos(u.h);let vf=u.rlF||0;const up=Math.cos(r.phi)>.8&&r.y<RCGY+.06;vf-=Math.sign(vf)*Math.min(Math.abs(vf),(up?1.1:5.4)*dt);u.rlF=vf;
 const ds=rlStep(u,dt);let nx=u.x+sn*vf*dt-cn*ds,nz=u.z+cn*vf*dt+sn*ds;
 for(const o of [1.3,-1.3]){const fx=nx+sn*o,fz=nz+cn*o,q=push(fx,fz,1);if(q[2]){crTrafficHit();const ux=q[0]-fx,uz=q[1]-fz,l=Math.hypot(ux,uz)||1,mx=ux/l,mz=uz/l;nx+=ux;nz+=uz;const vlat=-cn*mx+sn*mz;if(Math.abs(vlat)>.5&&r.vx*vlat<0)r.vx*=-.15;if((sn*mx+cn*mz)*vf<0)vf=u.rlF=vf*.3}}
 if(WORLD.wet(nx,nz)||!WORLD.inside(nx,nz,40)){nx=u.x;nz=u.z;r.vx=0;vf=u.rlF=0}
 u.x=nx;u.z=nz;u.y=GY(u.x,u.z,u.y);u.vx=sn*vf-cn*r.vx;u.vz=cn*vf+sn*r.vx;u.fwd=vf;u.sp=Math.hypot(u.vx,u.vz);u.yw=0;u.ix=0;u.iy=0;
 const car={x:u.x,z:u.z,h:u.h,y:u.y,vx:u.vx,vz:u.vz,u};if(r.ev){if(u.mdl)crRollHit(u.mdl,u,car,r);else if(r.ev.v>2.2){rlCrash(u,r);u.sbDirty=true}}
 if(r.slide&&u.mdl){const p=rlRot(r.slide.k,r.phi);crScrape(u.x-cn*p[0],u.y+.05,u.z+sn*p[0],sn,cn,r.slide.v+vf,2)}
 if(r.t<.05&&!r.cine){r.cine=1;CINE.ev('flip',u.x,u.z,{h:u.h,dur:2.2})}
 if(r.done){u.rol=null;EV.emit('rollEnd',{who:u.name,id:u.id,up:r.up,roof:r.roof,turns:+r.turns.toFixed(2)});if(!r.up){u.flip={roof:r.roof,phi:r.roof?Math.PI*Math.sign(r.phi||1):Math.sign(r.phi||1)*Math.PI/2,y:r.y};u.vx=u.vz=0;u.fwd=u.sp=0;if(u.status!=='disabled'){u.status='disabled';u.disabledT=PD.t;u.lights=true;u.assign=null;u.brain.man=null;u.case=0;u.boxRole=undefined;u.pincer=null;EV.emit('disabled',{id:u.id,name:u.name,why:'ribaltata'});plog('unità',u.name+' ribaltata, fuori servizio',{});pdSay('rolled',u,{},3,{force:true})}}}}

/* ---------- parti incernierate: cofano, baule, porte ---------- */
// regioni della carrozzeria (coordinate dell'auto: x a sinistra, y da terra, z avanti), cerniera, asse, verso di apertura, leva, massa, apertura massima
const CRP={
 hood:{pred:(x,y,z)=>z>1.03&&z<2.27&&y>.78&&Math.abs(x)<.74,hinge:[0,.97,1.03],axis:'x',sgn:-1,L:1.2,m:16,tmax:1.22,kind:'hood'},
 trunk:{pred:(x,y,z)=>z<-1.79&&z>-2.27&&y>.86&&Math.abs(x)<.72,hinge:[0,1,-1.79],axis:'x',sgn:1,L:.5,m:12,tmax:1.12,kind:'trunk'},
 dFL:{pred:(x,y,z)=>x>.42&&z>-.24&&z<.8&&y>.29&&y<1.37&&!(y>.95&&z>.72-(y-.95)*1.28),hinge:[.86,.7,.8],axis:'y',sgn:-1,L:1.04,m:24,tmax:1.15,kind:'door',side:1},
 dRL:{pred:(x,y,z)=>x>.42&&z>-1.08&&z<-.24&&y>.29&&y<1.36&&!(z<-.92&&y<.52),hinge:[.88,.7,-.24],axis:'y',sgn:-1,L:.84,m:20,tmax:1.1,kind:'door',side:1},
 dFR:{pred:(x,y,z)=>x<-.42&&z>-.24&&z<.8&&y>.29&&y<1.37&&!(y>.95&&z>.72-(y-.95)*1.28),hinge:[-.86,.7,.8],axis:'y',sgn:1,L:1.04,m:24,tmax:1.15,kind:'door',side:-1},
 dRR:{pred:(x,y,z)=>x<-.42&&z>-1.08&&z<-.24&&y>.29&&y<1.36&&!(z<-.92&&y<.52),hinge:[-.88,.7,-.24],axis:'y',sgn:1,L:.84,m:20,tmax:1.1,kind:'door',side:-1}};
const CRDS=new Map();function crDS(m){let d=CRDS.get(m);if(!d){d=m.clone();d.side=T.DoubleSide;CRDS.set(m,d)}return d}
function crMatOK(q,kind){const mt=q.m.material;if(q.lamp)return false;if(q.glass)return kind==='door';if(mt===CM.trim||mt===CM.chrome)return kind!=='hood';if(mt===CM.stripe)return true;return !!q.body&&!q.glass}
function crSt(a){return a.cr||(a.cr={parts:{},hang:null,steam:0,leak:0,oilD:0,pv:null,fire:null,crack:{}})}
// sgancia una parte: la geometria della regione diventa un pezzo che ruota sulla sua cerniera (per ogni dettaglio del modello)
function crUnlatch(a,car,key,st,tmin,catchMax){const C0=crSt(a);if(C0.parts[key])return C0.parts[key];const d=CRP[key],D=a.dmg;if(!D)return null;const grp={};let tris=0;
 for(const q of D.meshes){if(!crMatOK(q,d.kind))continue;const res=dmgCut(q.pos,q.nrm,q.idx,d.pred);if(!res.tris)continue;q.m.geometry.index.needsUpdate=true;tris+=res.tris;
  const P=res.pos;for(let i=0;i<P.length;i+=3){P[i]-=d.hinge[0];P[i+1]-=d.hinge[1];P[i+2]-=d.hinge[2]}const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(P,3));g.setAttribute('normal',new T.BufferAttribute(res.nrm,3));
  let pg=grp[q.lod];if(!pg){pg=grp[q.lod]=new T.Group();pg.position.set(d.hinge[0],d.hinge[1],d.hinge[2]);a[q.lod].add(pg)}const m=new T.Mesh(g,q.glass?q.m.material:crDS(q.m.material));m.castShadow=!q.glass;pg.add(m)}
 if(!tris)return null;const p={key,st,th:tmin||0,w:0,tmin:tmin||0,tmax:st==='ajar'?(catchMax||.12):d.tmax,g:grp,hits:0,tris};C0.parts[key]=p;CR.stat.hinge++;if(car.player&&d.kind!=='door')toast(key==='hood'?'Il cofano si è sganciato':'Il baule si è aperto');return p}
// la cerniera cede: il pezzo vola via come le altre parti staccate
function crPartGone(a,car,key,why){const C0=crSt(a),p=C0.parts[key];if(!p||p.st==='gone')return;p.st='gone';const vis=car.player?(a.l0.visible?'l0':'l1'):'l1';let flew=false;
 for(const L in p.g){const pg=p.g[L];if(L===vis&&!flew&&pg.children.length){flew=true;const wp=new T.Vector3(),wq=new T.Quaternion();pg.updateMatrixWorld&&pg.updateMatrixWorld(true);pg.getWorldPosition(wp);pg.getWorldQuaternion(wq);pg.parent.remove(pg);pg.position.copy(wp);pg.quaternion.copy(wq);sc.add(pg);
   const d=CRP[key],ch=Math.cos(car.h),sh=Math.sin(car.h),out=d.kind==='door'?d.side:0,up=d.kind==='hood'?4.5:2;DEB.push({o:pg,vx:car.vx*.75+ch*out*3+(Math.random()-.5)*2,vy:up+Math.random()*2,vz:car.vz*.75-sh*out*3+(Math.random()-.5)*2,wx:(Math.random()-.5)*7,wy:(Math.random()-.5)*5,wz:(Math.random()-.5)*7,t:0,life:120,r:.35,big:true})}
  else if(pg.parent)pg.parent.remove(pg)}
 CR.stat.detach++;if(car.player)toast({hood:'Il cofano è volato via!',trunk:'Il baule si è staccato',dFL:'La portiera si è staccata!',dRL:'La portiera si è staccata!',dFR:'La portiera si è staccata!',dRR:'La portiera si è staccata!'}[key]);crBang(crVol(car.x,car.z)*.7,900,.35);EV.emit('partOff',{key,why,player:!!car.player})}
// dinamica delle cerniere: accelerazioni dell'auto (forze apparenti), gravità, vento, ammortizzatori del baule, battute
function crParts(a,car,dt,acc,v){const C0=a.cr;for(const key in C0.parts){const p=C0.parts[key];if(p.st==='gone')continue;const d=CRP[key],lc=d.L/2,I=d.m*d.L*d.L/3,s=Math.sin(p.th),c=Math.cos(p.th);let tq=0;
  if(d.kind==='door')tq=d.m*lc*(-acc.f*s-d.side*acc.l*c)-.3*v*v*s;
  else if(d.kind==='hood'){tq=-d.m*9.8*lc*c+d.m*lc*acc.f*s*-1;if(p.st==='free')tq+=.7*v*v*(Math.max(0,Math.sin(p.th+.13))+.12)*(p.th<1?1:.3);else tq+=.16*v*v*Math.max(0,Math.sin(p.th+.05))}
  else tq=d.m*9.8*lc*(1.25-.2*p.th/d.tmax)-d.m*9.8*lc*c-d.m*acc.f*lc*s;
  tq+=(acc.j||0)*d.m*lc*(Math.random()-.5);p.w+=tq/I*dt;p.w*=Math.exp(-1.4*dt);p.th+=p.w*dt;
  if(d.kind==='hood'&&p.st==='free'&&p.th>p.tmax-.08&&Math.abs(v)>29){p.str=(p.str||0)+(Math.abs(v)-29)*dt;if(p.str>9){crPartGone(a,car,key,'vento');continue}}
  if(p.th>p.tmax){const hit=Math.abs(p.w);p.th=p.tmax;if(p.st==='free'&&hit>(d.kind==='hood'?7.5:5.5)){crPartGone(a,car,key,'battuta');continue}
   if(d.kind==='hood'&&p.st==='free'&&hit>2.2){p.hits++;crBang(crVol(car.x,car.z)*Math.min(.8,hit/8),1100,.3);crGlassCrack(a,car,0,'cofano');if(v>31&&p.hits>2){crPartGone(a,car,key,'vento');continue}}
   p.w=-p.w*(d.kind==='trunk'?.35:.25)}
  if(p.th<p.tmin){p.th=p.tmin;if(Math.abs(p.w)>3&&d.kind==='door')crBang(crVol(car.x,car.z)*.35,1500,.2);p.w=-p.w*.2}
  for(const L in p.g){const g=p.g[L];if(d.axis==='x')g.rotation.x=d.sgn*p.th;else g.rotation.y=d.sgn*p.th}}}

/* ---------- paraurti appeso che striscia ---------- */
function crHang(a,car,key,side){const C0=crSt(a);if(C0.hang&&C0.hang[key])return true;const D=a.dmg,B=DMGBOX,H=B.y1-B.y0,front=key==='fb',pred=front?(x,y,z)=>z>B.z1-.34&&y<B.y0+H*.42:(x,y,z)=>z<B.z0+.34&&y<B.y0+H*.44,zc=front?B.z1-.17:B.z0+.17,px=side*.8,pv=[px,B.y0+H*.3,zc];const grp={};let tris=0;
 for(const q of D.meshes){if(q.glass)continue;const res=dmgCut(q.pos,q.nrm,q.idx,pred);if(!res.tris)continue;q.m.geometry.index.needsUpdate=true;tris+=res.tris;const P=res.pos;for(let i=0;i<P.length;i+=3){P[i]-=pv[0];P[i+1]-=pv[1];P[i+2]-=pv[2]}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(P,3));g.setAttribute('normal',new T.BufferAttribute(res.nrm,3));let pg=grp[q.lod];if(!pg){pg=grp[q.lod]=new T.Group();pg.position.set(pv[0],pv[1],pv[2]);a[q.lod].add(pg)}pg.add(new T.Mesh(g,crDS(q.m.material)))}
 if(!tris)return false;D.cut[key]=true;const drop=Math.asin(Math.min(.9,pv[1]/1.6));if(!C0.hang)C0.hang={};C0.hang[key]={g:grp,side,front,drop,yaw:0,yw:0,dist:0,lim:120+Math.random()*260,pv,roll:0,t0:performance.now()};CR.stat.hang++;if(car.player)toast(front?'Il paraurti anteriore è rimasto appeso e striscia a terra':'Il paraurti posteriore striscia a terra');return true}
function crHangStep(a,car,dt,v,acc){const C0=a.cr;if(!C0||!C0.hang)return;for(const key in C0.hang){const h=C0.hang[key];if(!h)continue;
  // il capo libero cade fino a terra e, con la velocità, viene trascinato indietro (sobbalzando); ruota attorno al capo ancora attaccato
  h.roll+=(h.drop-h.roll)*Math.min(1,dt*6);const tgt=-Math.min(.75,Math.abs(v)*.03)*(v>=0?1:-1);h.yw+=((tgt-h.yaw)*30-h.yw*5+(Math.random()-.5)*Math.min(30,Math.abs(v)*2))*dt;h.yaw+=h.yw*dt;h.dist+=Math.abs(v)*dt;
  for(const L in h.g){const g=h.g[L];g.rotation.order='YZX';g.rotation.y=h.side*h.yaw;g.rotation.z=h.side*h.roll}
  // scintille dal capo libero sull'asfalto (posizione nel sistema dell'auto, poi nel mondo)
  if(Math.abs(v)>3){const cr=Math.cos(h.roll),lx=h.pv[0]-h.side*1.6*cr*Math.cos(h.yaw),lz=h.pv[2]+1.6*cr*Math.sin(h.yaw),ch=Math.cos(car.h),sh=Math.sin(car.h),wx=car.x+ch*lx+sh*lz,wz=car.z-sh*lx+ch*lz;crScrape(wx,car.y+.03,wz,sh,ch,v,1.2);h.spk=(h.spk||0)+1}
  if(h.dist>h.lim||Math.abs(v)>32||(acc&&acc.hit>7&&(C0.hitT||0)>h.t0+50)){const vis=car.player?(a.l0.visible?'l0':'l1'):'l1';
   for(const L in h.g){const g=h.g[L];if(L===vis&&g.children.length){const wp=new T.Vector3();if(g.updateMatrixWorld)g.updateMatrixWorld(true);g.getWorldPosition(wp);const ng=new T.Group();for(const m of g.children.slice())ng.add(m);ng.position.copy(wp);ng.rotation.set(0,car.h,0);sc.add(ng);DEB.push({o:ng,vx:car.vx*.6,vy:1.2,vz:car.vz*.6,wx:(Math.random()-.5)*4,wy:(Math.random()-.5)*6,wz:(Math.random()-.5)*4,t:0,life:90,r:.3,big:true})}if(g.parent)g.parent.remove(g)}
   C0.hang[key]=null;CR.stat.detach++;if(car.player)toast('Il paraurti si è staccato');crBang(crVol(car.x,car.z)*.5,900,.3);EV.emit('partOff',{key,why:'trascinato',player:!!car.player})}}}

/* ---------- vetri: parabrezza stratificato che si incrina, vetri temperati che scoppiano (anche col calore) ---------- */
let CRTX=null;
function crCrackTex(){if(CRTX)return CRTX;const cv=document.createElement('canvas');cv.width=cv.height=512;const x=cv.getContext('2d');
 if(x&&x.beginPath){const cx=256,cy=256;x.lineCap='round';x.strokeStyle='rgba(236,242,247,.92)';
  for(let i=0;i<24;i++){let a=i/24*6.283+Math.random()*.2,px=cx,py=cy,len=70+Math.random()*200,d=0;x.lineWidth=1.8;x.beginPath();x.moveTo(px,py);while(d<len){const st=8+Math.random()*14;a+=(Math.random()-.5)*.38;px+=Math.cos(a)*st;py+=Math.sin(a)*st;d+=st;x.lineTo(px,py);if(Math.random()<.08){x.stroke();x.lineWidth=Math.max(.7,x.lineWidth*.8);x.beginPath();x.moveTo(px,py)}}x.stroke()}
  for(let r=16;r<210;r+=14+Math.random()*24){x.lineWidth=1.1;const n=9+Math.floor(r/7);for(let k=0;k<n;k++){if(Math.random()<.32)continue;const a0=k/n*6.283,a1=a0+6.283/n*(.55+Math.random()*.45),r0=r*(1+(Math.random()-.5)*.14),r1=r*(1+(Math.random()-.5)*.14);x.beginPath();x.moveTo(cx+Math.cos(a0)*r0,cy+Math.sin(a0)*r0);x.lineTo(cx+Math.cos(a1)*r1,cy+Math.sin(a1)*r1);x.stroke()}}
  const gr=x.createRadialGradient(cx,cy,0,cx,cy,30);gr.addColorStop(0,'rgba(255,255,255,.9)');gr.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=gr;x.fillRect(cx-32,cy-32,64,64)}
 CRTX=new T.CanvasTexture(cv);return CRTX}
// ragnatela sul parabrezza: copia dei triangoli del parabrezza con la trama delle crepe, centrata sul punto d'urto (x dell'auto)
function crGlassCrack(a,car,ix,why){const C0=crSt(a),D=a.dmg;if(!D||C0.crack.ws||(D.gcut&&D.gcut.ws))return;const B=DMGBOX,H=B.y1-B.y0,pred=(x,y,z)=>z>.22&&y>B.y0+H*.6&&Math.abs(x)<.7,iz=.62+(Math.random()-.5)*.2;ix=Math.max(-.45,Math.min(.45,ix||0));const list=[];
 const mat=C0.crackM||(C0.crackM=new T.MeshBasicMaterial({map:crCrackTex(),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,side:T.DoubleSide}));
 for(const q of D.meshes){if(!q.glass)continue;const p=q.pos,ix2=q.idx,P=[],UV=[];for(let t=0;t<ix2.length;t+=3){const A=ix2[t],Bq=ix2[t+1],Cq=ix2[t+2];if(A===Bq&&Bq===Cq)continue;let ok=true;for(const v of [A,Bq,Cq])if(!pred(p[v*3],p[v*3+1],p[v*3+2])){ok=false;break}if(!ok)continue;
   for(const v of [A,Bq,Cq]){P.push(p[v*3],p[v*3+1],p[v*3+2]);UV.push((p[v*3]-ix)/1.5+.5,(p[v*3+2]-iz)/1.1+.5)}}
  if(!P.length)continue;const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(P),3));g.setAttribute('uv',new T.BufferAttribute(new Float32Array(UV),2));const m=new T.Mesh(g,mat);a[q.lod].add(m);list.push(m)}
 if(!list.length)return;C0.crack.ws=list;CR.stat.crack++;crBang(crVol(car.x,car.z)*.25,4500,.12);if(car.player)toast('Il parabrezza si è incrinato')}
function crCrackOff(a){const C0=a.cr;if(!C0||!C0.crack.ws)return;for(const m of C0.crack.ws)if(m.parent)m.parent.remove(m);C0.crack.ws=null}
// vetro che scoppia (calore o deformazione): toglie i triangoli e lancia i frammenti
const CRGL={ws:(B,H)=>(x,y,z)=>z>.15&&y>B.y0+H*.6,rw:(B,H)=>(x,y,z)=>z<-1.2&&y>B.y0+H*.6,sl:(B,H)=>(x,y,z)=>x>.55&&z>-1.3&&z<1.1&&y>B.y0+H*.6,sr:(B,H)=>(x,y,z)=>x<-.55&&z>-1.3&&z<1.1&&y>B.y0+H*.6};
function crGlassBreak(a,car,key){const D=a.dmg;if(!D)return;const gc=D.gcut||(D.gcut={});if(gc[key])return;gc[key]=true;if(key==='ws')crCrackOff(a);const B=DMGBOX,H=B.y1-B.y0,pred=CRGL[key](B,H);let n=0,cx=0,cy=0,cz=0,cn=0;
 for(const q of D.meshes){if(!q.glass)continue;const res=dmgCut(q.pos,q.nrm,q.idx,pred);if(res.tris){q.m.geometry.index.needsUpdate=true;n+=res.tris;for(let i=0;i<Math.min(30,res.pos.length/3);i++){cx+=res.pos[i*3];cy+=res.pos[i*3+1];cz+=res.pos[i*3+2];cn++}}}
 D.glass+=n;if(n&&cn){dmgShards(a,car,cx/cn,cy/cn,cz/cn,Math.min(36,8+Math.round(n/40)),[.62,.78,.8]);crBang(crVol(car.x,car.z)*.45,6000,.18)}}

/* ---------- gomma che scoppia ---------- */
function crBurst(a,car,k,why){const s=TYRE.st(a);if(s.tgt[k]>=1)return;TYRE.puncture(a,k,1);s.rate[k]=2.5;CR.stat.burst++;crBang(crVol(car.x,car.z)*.9,700,.4);if(car.u)car.u.flat=true;if(car.player)toast(why==='fuoco'?'Una gomma è scoppiata per il calore':'Una gomma è scoppiata nell\'urto');EV.emit('tyreBurst',{k,why,player:!!car.player})}

/* ---------- vapore, olio, fuoco ---------- */
// trama della fiamma: goccia allungata, nucleo giallo-bianco, bordo arancio-rosso che sfuma (non un cerchio bianco)
let CRFT=null;
function crFlameTex(){if(CRFT)return CRFT;const cv=document.createElement('canvas');cv.width=64;cv.height=128;const x=cv.getContext('2d');
 if(x&&typeof x.createRadialGradient==='function'&&typeof x.scale==='function'&&typeof x.translate==='function'&&typeof x.save==='function')try{for(const [r,c0,c1,yy] of [[30,'rgba(255,120,30,.55)','rgba(200,40,10,0)',78],[20,'rgba(255,190,70,.8)','rgba(255,110,20,0)',86],[11,'rgba(255,245,200,.95)','rgba(255,200,90,0)',92]]){const g=x.createRadialGradient(32,yy,0,32,yy,r);g.addColorStop(0,c0);g.addColorStop(1,c1);x.save();x.translate(32,yy);x.scale(1,2.1);x.translate(-32,-yy);x.fillStyle=g;x.fillRect(0,0,64,128);x.restore()}}catch(e){}
 CRFT=new T.CanvasTexture(cv);return CRFT}
/* ---------- fuoco, fumo e vapore: particelle riutilizzate ----------
   Prima ogni sbuffo creava e distruggeva un materiale, e la lista (in comune con il fumo del motore) era tagliata a 60 elementi:
   la colonna di fumo si interrompeva subito e le fiamme, sommate in luce con il colore bianco, diventavano una macchia chiara.
   Ora due serbatoi fissi di sprite (fiamme e fumo) che si riusano; ogni particella cambia colore con l'età:
   fiamma giallo chiaro → arancio → rosso cupo che si spegne, allungata e ondeggiante; fumo che sale rallentando, si allarga e
   va col vento (nero denso dall'incendio, grigio dal motore rotto, bianco dal radiatore) */
const FP={fl:{list:[],free:[],max:110},fc:{list:[],free:[],max:50},sm:{list:[],free:[],max:130},tx:{},wind:[.55,.2]};
function fpTex(k){if(FP.tx[k])return FP.tx[k];const cv=document.createElement('canvas');cv.width=cv.height=64;const x=cv.getContext('2d');
 try{if(x&&typeof x.createRadialGradient==='function'){const blob=(px,py,r,a0,a1)=>{const g=x.createRadialGradient(px,py,0,px,py,r);g.addColorStop(0,'rgba(255,255,255,'+a0.toFixed(2)+')');g.addColorStop(.55,'rgba(255,255,255,'+a1.toFixed(2)+')');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,64,64)};
  if(k==='fl'){for(let i=0;i<8;i++){const t=i/7;blob(32+(Math.random()-.5)*(18-t*10),46-t*30+(Math.random()-.5)*4,15-t*7+Math.random()*3,.75-t*.25,.35-t*.12)}}
  else if(k==='fc')blob(32,34,28,1,.4);
  else for(let i=0;i<9;i++){const a=i/9*6.283+Math.random()*.5,d=i?7+Math.random()*9:0;blob(32+Math.cos(a)*d,32+Math.sin(a)*d,13+Math.random()*9,.42+Math.random()*.2,.18)}}}catch(e){}
 FP.tx[k]=new T.CanvasTexture(cv);return FP.tx[k]}
function fpSpawn(k,x,y,z,o){const P=FP[k];let p=P.free.pop();
 if(!p){if(P.list.length>=P.max)return null;const m=new T.Sprite(new T.SpriteMaterial({map:fpTex(k),transparent:true,depthWrite:false,opacity:0,toneMapped:k==='sm',blending:k==='fc'?T.AdditiveBlending:T.NormalBlending}));m.renderOrder=k==='sm'?2:k==='fl'?3:4;sc.add(m);p={m}}
 p.t=0;p.life=o.life;p.vy=o.vy;p.vx=o.vx||0;p.vz=o.vz||0;p.s0=o.s;p.s1=o.s1||o.s;p.op=o.op;p.c0=o.c0||[1,1,1];p.c1=o.c1||p.c0;p.seed=Math.random()*6.283;p.m.position.set(x,y,z);p.m.visible=true;p.m.material.rotation=k==='sm'?Math.random()*6.283:0;p.m.material.opacity=0;P.list.push(p);return p}
function fpStep(dt){const wx=FP.wind[0],wz=FP.wind[1];
 for(let i=FP.fl.list.length-1;i>=0;i--){const p=FP.fl.list[i];p.t+=dt;const k=p.t/p.life;if(k>=1){p.m.visible=false;FP.fl.list.splice(i,1);FP.fl.free.push(p);continue}const m=p.m,mt=m.material;
  m.position.x+=(p.vx+wx*.5+Math.sin(p.seed+p.t*7)*.4)*dt;m.position.z+=(p.vz+wz*.5+Math.cos(p.seed*1.7+p.t*6)*.4)*dt;m.position.y+=p.vy*dt*(1-.3*k);
  const sz=p.s0*(1+.55*k)*(1-.35*k*k);m.scale.set(sz*.9,sz*(1.1+.35*k),1);mt.rotation=Math.sin(p.seed+p.t*3)*.25;
  // giallo chiaro → arancio → rosso → bruno che diventa fumo
  let r,g,b;if(k<.12){r=1;g=.86;b=.45}else if(k<.45){const q=(k-.12)/.33;r=1;g=.86-.42*q;b=.45-.4*q}else if(k<.8){const q=(k-.45)/.35;r=1-.3*q;g=.44-.28*q;b=.05}else{const q=(k-.8)/.2;r=.7-.52*q;g=.16-.07*q;b=.05+.02*q}
  mt.color.setRGB(r,g,b);mt.opacity=p.op*(k<.08?k/.08:1)*Math.pow(1-k,.7)}
 for(let i=FP.fc.list.length-1;i>=0;i--){const p=FP.fc.list[i];p.t+=dt;const k=p.t/p.life;if(k>=1){p.m.visible=false;FP.fc.list.splice(i,1);FP.fc.free.push(p);continue}const m=p.m,mt=m.material;
  m.position.y+=p.vy*dt;m.position.x+=p.vx*dt;m.position.z+=p.vz*dt;const sz=p.s0*(1+.5*k);m.scale.set(sz,sz*1.15,1);mt.color.setRGB(1,.78,.42);mt.opacity=p.op*(k<.15?k/.15:1)*(1-k)}
 for(let i=FP.sm.list.length-1;i>=0;i--){const p=FP.sm.list[i];p.t+=dt;const k=p.t/p.life;if(k>=1){p.m.visible=false;FP.sm.list.splice(i,1);FP.sm.free.push(p);continue}const m=p.m,mt=m.material,sl=1/(1+p.t*.55);
  m.position.x+=(p.vx*sl+wx*Math.min(1,p.t))*dt;m.position.z+=(p.vz*sl+wz*Math.min(1,p.t))*dt;m.position.y+=p.vy*sl*dt;
  const sz=p.s0+(p.s1-p.s0)*Math.sqrt(k);m.scale.set(sz,sz,1);mt.rotation+=(p.seed>3.14?.22:-.22)*dt;
  mt.color.setRGB(p.c0[0]+(p.c1[0]-p.c0[0])*k,p.c0[1]+(p.c1[1]-p.c0[1])*k,p.c0[2]+(p.c1[2]-p.c0[2])*k);mt.opacity=p.op*(k<.08?k/.08:1)*(1-k)}}
// coordinate del mondo di un punto dell'auto (x a sinistra, z avanti)
function crW(car,lx,lz){const c=Math.cos(car.h),s=Math.sin(car.h);return[car.x+lx*c+lz*s,car.z-lx*s+lz*c]}
// sbuffo nel sistema dell'auto (vapore, fumo): stessa firma di prima
function crPuff(car,lx,ly,lz,col,op,life,vy,grow,scale,fire){const w=crW(car,lx,lz);if(fire)return fpSpawn('fl',w[0]+(Math.random()-.5)*.3,car.y+ly,w[1]+(Math.random()-.5)*.3,{life,vy,s:scale,op});
 const c=new T.Color(col);return fpSpawn('sm',w[0]+(Math.random()-.5)*.3,car.y+ly,w[1]+(Math.random()-.5)*.3,{life,vy,s:scale,s1:scale*(1+grow*life),op,c0:[c.r,c.g,c.b],c1:[Math.min(1,c.r+.1),Math.min(1,c.g+.1),Math.min(1,c.b+.1)],vx:car.vx*.4,vz:car.vz*.4})}
const OIL=[];let OILM=null,OILG=null;
function crOilMat(){if(OILM)return OILM;const cv=document.createElement('canvas');cv.width=cv.height=128;const x=cv.getContext('2d');if(x&&x.createRadialGradient){for(let i=0;i<7;i++){const px=64+(Math.random()-.5)*40,py=64+(Math.random()-.5)*40,r=18+Math.random()*30,g=x.createRadialGradient(px,py,0,px,py,r);g.addColorStop(0,'rgba(16,12,8,.85)');g.addColorStop(.7,'rgba(22,16,10,.6)');g.addColorStop(1,'rgba(22,16,10,0)');x.fillStyle=g;x.fillRect(0,0,128,128)}}
 OILM=new T.MeshStandardMaterial({map:new T.CanvasTexture(cv),transparent:true,depthWrite:false,roughness:.08,metalness:.3,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3});OILG=new T.PlaneGeometry(1,1);return OILM}
function crOilDrop(car,size){const mt=crOilMat(),lz=DMGBOX.z1-1.05,c=Math.cos(car.h),s=Math.sin(car.h),wx=car.x+lz*s+(Math.random()-.5)*.3,wz=car.z+lz*c+(Math.random()-.5)*.3,m=new T.Mesh(OILG,mt);m.rotation.set(-Math.PI/2,0,Math.random()*6.28);m.position.set(wx,GY(wx,wz)+.05,wz);m.scale.set(size,size,1);sc.add(m);const o={m,t:PD.t};OIL.push(o);CR.stat.oil=(CR.stat.oil||0)+1;while(OIL.length>140){const q=OIL.shift();sc.remove(q.m)}return o}
function crOilStep(a,car,dt,v){const C0=a.cr,still=Math.abs(v)<.5;C0.oilD+=Math.abs(v)*dt;
 if(still){if(!C0.oilP)C0.oilP=crOilDrop(car,.3);else{const m=C0.oilP.m,s=Math.min(1.6,m.scale.x+dt*.025);m.scale.set(s,s,1)}}
 else{C0.oilP=null;if(C0.oilD>2.2){C0.oilD=0;crOilDrop(car,.14+Math.random()*.16)}}}
// luci del fuoco: una sola, creata all'avvio e poi soltanto spostata, accesa e spenta. Aggiungere o togliere una luce durante il
// gioco costringe three.js a ricompilare tutti i materiali (scatti lunghi sul telefono); in autostrada, con il traffico, la
// ricompilazione dava al materiale condiviso delle auto e dei pedoni un programma con il colore per istanza e il disegno del
// fotogramma si interrompeva: carrozzerie delle pattuglie, vetri, fuoco, fumo e parti incernierate non comparivano (Versione 20)
const CRL=[];{const l=new T.PointLight(0xff7a2a,0,14);l.userData.free=true;sc.add(l);CRL.push(l)}
function crLightGet(F){for(const l of CRL)if(l.userData.free){l.userData.free=false;l.userData.owner=F;l.userData.seen=PD.t;return l}return null}
function crLightFree(l){if(!l)return;l.intensity=0;l.userData.free=true;l.userData.owner=null}
// una luce assegnata a un'auto che non viene più aggiornata (troppo lontana, modello tolto) torna libera
function crLightStep(){for(const l of CRL)if(!l.userData.free&&PD.t-(l.userData.seen||0)>.6)crLightFree(l)}
function crChar(a,f){const D=a.dmg;if(!D)return;const q=D.meshes.find(q=>q.body&&!q.glass&&!q.lamp);if(!q)return;const mt=q.m.material;if(!mt.userData.c0){mt.userData.c0=mt.color.clone();mt.userData.r0=mt.roughness;mt.userData.m0=mt.metalness;mt.userData.cc0=mt.clearcoat||0}
 const c0=mt.userData.c0;mt.color.setRGB(c0.r+(.05-c0.r)*f,c0.g+(.045-c0.g)*f,c0.b+(.04-c0.b)*f);mt.roughness=mt.userData.r0+(.96-mt.userData.r0)*f;mt.metalness=mt.userData.m0*(1-f*.8);if(mt.clearcoat!==undefined)mt.clearcoat=mt.userData.cc0*(1-f);a.charred=f}
function crCharOff(a){const D=a.dmg;if(!D)return;for(const q of D.meshes){const mt=q.m.material;if(mt&&mt.userData&&mt.userData.c0){mt.color.copy(mt.userData.c0);mt.roughness=mt.userData.r0;mt.metalness=mt.userData.m0;if(mt.clearcoat!==undefined)mt.clearcoat=mt.userData.cc0}}a.charred=0}
function crFireStep(a,car,dt,D,C0){const F=C0.fire||(C0.fire={t:0,stage:0,em:0});if(!F.t){CR.stat.fire++;EV.emit('carFire',{player:!!car.player});if(car.player)toast('L\'auto ha preso fuoco! Scendi (E)')}F.t+=dt;const t=F.t,B=DMGBOX;
 const I=t<20?.35+t/20*.65:t<75?1:Math.max(0,1-(t-75)/40);F.I=I;const near=crVol(car.x,car.z);
 // fiamme e fumo: dal vano motore, dopo 20 s anche lungo l'abitacolo fino al baule
 if(near>0){const reach=t<20?0:Math.min(1,(t-20)/25);
  // fiamme: dal vano motore (sotto il cofano, dalla griglia e dai passaruota), con il tempo anche dall'abitacolo fino al baule
  if(I>.05){F.ef=(F.ef||0)+dt*(10+22*I);let n=0;while(F.ef>1&&n++<8){F.ef-=1;const r=Math.random(),grill=r<.15,arch=r>=.15&&r<.25,lz=grill?B.z1-.15:arch?B.z1-.75:B.z1-.45-Math.random()*(.95+reach*2.9),lx=arch?(Math.random()<.5?-.82:.82):(Math.random()-.5)*1.3,ly=grill?.55+Math.random()*.25:arch?.4:.98+Math.random()*.18+(lz<B.z1-1.6?.4:0),w=crW(car,lx,lz);
    fpSpawn('fl',w[0],car.y+ly,w[1],{life:.5+Math.random()*.38,vy:1.1+Math.random()*1.2*(.6+I),s:.36+.3*I+.24*Math.random(),op:.78+.17*I,vx:car.vx*.25,vz:car.vz*.25})}if(F.ef>1)F.ef=0;
   // nuclei luminosi alla base delle fiamme
   F.ec=(F.ec||0)+dt*(6+10*I);n=0;while(F.ec>1&&n++<4){F.ec-=1;const w=crW(car,(Math.random()-.5)*1.1,B.z1-.5-Math.random()*(.8+reach*2.4));fpSpawn('fc',w[0],car.y+1+Math.random()*.15,w[1],{life:.25+Math.random()*.18,vy:.8,s:.32+.18*I,op:.42+.2*I,vx:car.vx*.2,vz:car.vz*.2})}if(F.ec>1)F.ec=0}
  // fumo nero denso che sale e si allarga
  F.es=(F.es||0)+dt*(3.5+7.5*I);let m=0;while(F.es>1&&m++<4){F.es-=1;const lz=B.z1-.5-Math.random()*(1.1+reach*2.4),lx=(Math.random()-.5)*.9,w=crW(car,lx,lz),d=.04+.1*Math.random();
   fpSpawn('sm',w[0],car.y+1.25+Math.random()*.45,w[1],{life:3.4+Math.random()*2.2,vy:1.8+Math.random()*1.3,s:.65+Math.random()*.45,s1:2.4+Math.random()*1.6+1.2*I,op:.6+.22*I,c0:[d,d,d],c1:[d+.16,d+.16,d+.16],vx:car.vx*.3,vz:car.vz*.3})}if(F.es>1)F.es=0;
  // braci che salgono
  if(Math.random()<dt*5*I){const w=crW(car,(Math.random()-.5)*1.1,B.z1-.6-Math.random()*(1+reach*2));FX.sparks(w[0],car.y+1.1,w[1],0,0,2,.7)}}
 const stage=(n,at,f)=>{if(F.stage<n&&t>=at){F.stage=n;f()}};
 stage(1,9,()=>crGlassBreak(a,car,'ws'));stage(2,13,()=>crBurst(a,car,0,'fuoco'));stage(3,15.5,()=>crBurst(a,car,1,'fuoco'));stage(4,24,()=>{crGlassBreak(a,car,'sl');crGlassBreak(a,car,'sr')});
 stage(5,31,()=>crGlassBreak(a,car,'rw'));stage(6,37,()=>crBurst(a,car,2,'fuoco'));stage(7,40,()=>crBurst(a,car,3,'fuoco'));
 if(t>20)crChar(a,Math.min(1,(t-20)/40));if(t>20)D.engine=0;
 // luce del fuoco (una sola, per l'auto in fiamme più vicina che la prende per prima)
 if(F.light&&F.light.userData.owner!==F)F.light=null;
 if(I>.1&&near>.3){if(!F.light)F.light=crLightGet(F);if(F.light){F.light.userData.seen=PD.t;const c=Math.cos(car.h),s=Math.sin(car.h),lz=B.z1-.8-(t>20?Math.min(1.6,(t-20)/15):0);F.light.position.set(car.x+lz*s,car.y+1.3,car.z+lz*c);F.light.intensity=2.2*I*(.75+.5*Math.random())}}
 else if(F.light){crLightFree(F.light);F.light=null}
 crLoop('fire',near*.3*I,650);if(near>0&&Math.random()<dt*1.5*I)crBang(near*.15,2500,.08)}

/* ---------- dopo ogni urto (da sbEffects): cerniere, paraurti, vapore, olio, gomme, parabrezza ---------- */
function crAfterCrash(a,own,car,R,replay){if(replay)return;const C0=crSt(a),D=a.dmg;
 if(!D.cut.hood){const p=C0.parts.hood;if(!p&&R.fC>.28){const free=R.fC>.5;crUnlatch(a,car,'hood',free?'free':'ajar',Math.min(.16,.04+(R.fC-.28)*.3),free?0:.2)}else if(p&&p.st==='ajar'&&(R.fC>.5||R.fC>(p.fC0||0)+.1)){p.st='free';p.tmax=CRP.hood.tmax}if(C0.parts.hood&&C0.parts.hood.fC0===undefined)C0.parts.hood.fC0=R.fC}
 if(!C0.parts.trunk&&R.rC>.22)crUnlatch(a,car,'trunk','free',.02,0);
 const S=own.sb;if(S){const P=S.P,P0=SBT.P0,nb=SBT.nb,intr=(st,j)=>{let m=0;for(const i of st)for(const l of [0,1]){const k=nb(i,j,l);m=Math.max(m,Math.abs(P[k*3]-P0[k*3]))}return m};
  for(const [key,st,j] of [['dFL',[3,4],3],['dRL',[5,6],3],['dFR',[3,4],0],['dRR',[5,6],0]]){if(C0.parts[key])continue;const m=intr(st,j);if(m>.09&&m<.32&&Math.random()<Math.min(.4,.12+(m-.09)*1.6))crUnlatch(a,car,key,'free',Math.min(.18,.03+(m-.05)*.4),0)}}
 if(R.fC>.12&&!C0.steam0){C0.steam0=1;C0.steam=25+35*Math.min(1,R.fC);CR.stat.steam++}
 if(D.engine<.8||R.fC>.3)C0.leak=1;
 for(let h=0;h<4;h++){const hb=R.hubs[h];if(hb.lost)continue;if(Math.hypot(hb.dx,hb.dz)>.06||Math.abs(hb.camber)>.12)crBurst(a,car,h,'urto')}
 if((R.ws||R.fC>.3)&&!(D.gcut&&D.gcut.ws))crGlassCrack(a,car,0,'urto')}
// paraurti: se uno dei due attacchi tiene ancora, resta appeso da quel lato
function crHangTry(a,car,key,own,replay){if(replay)return false;const S=own.sb;if(!S)return false;const L=SBT.att[key==='fb'?0:1];let bl=0,br=0,nl=0,nr=0;for(const b of L){const x=SBT.P0[SBT.A[b]*3];if(x>0){nl++;if(S.br[b])bl++}else{nr++;if(S.br[b])br++}}
 const fl=bl/Math.max(1,nl),fr=br/Math.max(1,nr);if(fl>.85&&fr>.85)return false;if(Math.min(fl,fr)>.6)return false;return crHang(a,car,key,fl<fr?1:-1)}

/* ---------- ogni fotogramma ---------- */
function crCarStep(a,car,dt){const C0=a.cr,D=a.dmg,sn=Math.sin(car.h),cn=Math.cos(car.h),v=car.vx*sn+car.vz*cn;
 if(C0){const acc={f:0,l:0,j:0,hit:C0.hit||0};C0.hit=0;if(C0.pv&&dt>0){const ax=(car.vx-C0.pv[0])/dt,az=(car.vz-C0.pv[1])/dt;acc.f=pdClamp(ax*sn+az*cn,-40,40);acc.l=pdClamp(ax*cn-az*sn,-40,40)}C0.pv=[car.vx,car.vz];acc.j=Math.min(30,Math.abs(acc.f)*.3+Math.abs(acc.l)*.3);
  crParts(a,car,dt,acc,v);crHangStep(a,car,dt,v,acc);
  if(C0.steam>0){C0.steam-=dt;C0.se=(C0.se||0)+dt*(3+7*Math.min(1,C0.steam/20));let n=0;while(C0.se>1&&n++<4){C0.se-=1;crPuff(car,(Math.random()-.5)*.9,.72,DMGBOX.z1-.32,0xeef1f4,.5,1.1,1.7,2.2,.45,false)}if(C0.se>1)C0.se=0;crLoop('hiss',crVol(car.x,car.z)*.1*Math.min(1,C0.steam/15),5200)}
  if(C0.leak)crOilStep(a,car,dt,v)}
 if(D&&D.on){if(D.engine<.08||(C0&&C0.fire))crFireStep(a,car,dt,D,crSt(a));
  // mozzo senza ruota sull'asfalto
  if(Math.abs(v)>3)for(let k=0;k<4;k++){if(!D.wl[k])continue;const st=a.wh[k]&&a.wh[k].parent;if(!st||Math.random()>dt*20)continue;const p=st.userData.p0||st.position,wx=car.x+cn*p.x+sn*p.z,wz=car.z-sn*p.x+cn*p.z;crScrape(wx,car.y+.04,wz,sn,cn,v,1.5)}}}
// i programmi grafici delle parti a doppia faccia, delle crepe, dell'olio, di fuoco/fumo, delle scintille, dei frammenti e delle
// strisce chiodate vengono preparati subito dopo il caricamento: sul telefono la prima compilazione durante un urto blocca il gioco
function crWarm(){try{const tmp=[],geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(new Float32Array([0,0,0,.1,0,0,0,.1,0]),3));geo.setAttribute('normal',new T.BufferAttribute(new Float32Array([0,0,1,0,0,1,0,0,1]),3));
 const add=o=>{o.position.set(C.x,(V.y||0)-60,C.z);o.frustumCulled=false;sc.add(o);tmp.push(o)},mats=new Set();carA.l1.traverse(m=>{if(m.isMesh&&m.material&&!m.material.transparent)mats.add(m.material)});
 for(const mt of mats)add(new T.Mesh(geo,crDS(mt)));add(new T.Mesh(geo,crOilMat()));add(new T.Mesh(geo,new T.MeshBasicMaterial({map:crCrackTex(),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,side:T.DoubleSide})));
 if(typeof dmgShardMat==='function')add(new T.Mesh(geo,dmgShardMat([.62,.78,.8])));add(new T.InstancedMesh(geo,new T.MeshStandardMaterial({color:0xc8ccd0,metalness:.9,roughness:.3}),1));
 for(const k of ['fl','fc','sm']){const p=fpSpawn(k,C.x,(V.y||0)-60,C.z,{life:.05,vy:0,s:.1,op:0});if(p)p.m.frustumCulled=false}if(FX&&FX.init)FX.init();
 if(R&&R.compile)R.compile(sc,cam);for(const o of tmp)sc.remove(o)}catch(e){}}
setTimeout(crWarm,2600);
function crStep(dt){CR.dt=dt;FX.step(dt);fpStep(dt);crLoopStep(dt);crLightStep();if(carA.cr||(carA.dmg&&carA.dmg.on))crCarStep(carA,{x:C.x,z:C.z,h:C.h,y:V.y,vx:V.vx,vz:V.vz,player:true},dt)}
// riparazione: via le parti incernierate, i paraurti appesi, le crepe, la vernice bruciata e il ribaltamento
function crRepair(a){const C0=a.cr;if(C0){for(const k in C0.parts){const p=C0.parts[k];for(const L in p.g){const g=p.g[L];if(g.parent&&g.parent!==sc)g.parent.remove(g)}}if(C0.hang)for(const k in C0.hang){const h=C0.hang[k];if(h)for(const L in h.g){const g=h.g[L];if(g.parent)g.parent.remove(g)}}crCrackOff(a);if(C0.fire&&C0.fire.light&&C0.fire.light.userData.owner===C0.fire)crLightFree(C0.fire.light)}
 crCharOff(a);a.cr=null;if(a===carA){V.rol=null;V.flip=null}}
