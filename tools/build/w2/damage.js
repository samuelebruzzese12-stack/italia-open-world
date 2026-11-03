/* ===== DANNI DELLE AUTO: carrozzeria che si deforma nel punto d'urto (vertici del modello), parti che si staccano (paraurti, cofano,
   specchietti, ruote), vetri e fari che si rompono, fumo e fiamme dal motore, effetti sulla guida (motore, sterzo, ruote) ===== */
/* --- nucleo numerico (array puri, verificabile anche fuori dal browser) --- */
const DMGK={maxDisp:.72};
/* sposta i vertici entro il raggio R dal punto P (coordinate dell'auto) lungo la direzione d'urto D, con caduta morbida e leggera
   increspatura; limita lo spostamento totale rispetto alla forma originale; segna i vertici toccati */
function dmgDeform(pos,orig,touched,P,D,depth,R,seed){let n=0;const R2=R*R,px=P[0],py=P[1],pz=P[2],dx=D[0],dy=D[1],dz=D[2],N=pos.length/3,mx=DMGK.maxDisp;
 for(let i=0;i<N;i++){const o=i*3,vx=pos[o],vy=pos[o+1],vz=pos[o+2],ex=vx-px,ey=(vy-py)*1.25,ez=vz-pz,d2=ex*ex+ey*ey+ez*ez;if(d2>=R2)continue;
  const d=Math.sqrt(d2),k=1-d/R,w=k*k*(3-2*k),h=Math.sin(i*12.9898+seed*78.233)*43758.5453,r=h-Math.floor(h)-.5,amp=depth*w,cr=amp*.22*r;
  let nx=vx+dx*amp+cr*(dz),ny=vy+dy*amp*.6-Math.abs(cr)*.35,nz=vz+dz*amp-cr*(dx);
  const qx=nx-orig[o],qy=ny-orig[o+1],qz=nz-orig[o+2],q=Math.hypot(qx,qy,qz);if(q>mx){const s=mx/q;nx=orig[o]+qx*s;ny=orig[o+1]+qy*s;nz=orig[o+2]+qz*s}
  pos[o]=nx;pos[o+1]=ny;pos[o+2]=nz;touched[i]=1;n++}return n}
/* normali ricalcolate solo dove la lamiera si è mossa */
function dmgNormals(pos,nrm,idx,touched){const T=idx.length/3,acc=new Float32Array(pos.length);let any=false;
 for(let t=0;t<T;t++){const a=idx[t*3],b=idx[t*3+1],c=idx[t*3+2];if(!touched[a]&&!touched[b]&&!touched[c])continue;if(a===b||b===c)continue;any=true;
  const ax=pos[a*3],ay=pos[a*3+1],az=pos[a*3+2],ux=pos[b*3]-ax,uy=pos[b*3+1]-ay,uz=pos[b*3+2]-az,vx=pos[c*3]-ax,vy=pos[c*3+1]-ay,vz=pos[c*3+2]-az,fx=uy*vz-uz*vy,fy=uz*vx-ux*vz,fz=ux*vy-uy*vx;
  for(const v of [a,b,c]){if(!touched[v])continue;acc[v*3]+=fx;acc[v*3+1]+=fy;acc[v*3+2]+=fz}}
 if(!any)return 0;let n=0;for(let i=0;i<touched.length;i++){if(!touched[i])continue;const x=acc[i*3],y=acc[i*3+1],z=acc[i*3+2],l=Math.hypot(x,y,z);if(l<1e-12)continue;nrm[i*3]=x/l;nrm[i*3+1]=y/l;nrm[i*3+2]=z/l;n++}return n}
/* parte che si stacca: triangoli con i tre vertici nella regione → nuova geometria (per il pezzo che vola via) e triangoli tolti dall'auto */
function dmgCut(pos,nrm,idx,pred){const T=idx.length/3,P=[],Nn=[];let cnt=0;
 for(let t=0;t<T;t++){const a=idx[t*3],b=idx[t*3+1],c=idx[t*3+2];if(a===b&&b===c)continue;if(!pred(pos[a*3],pos[a*3+1],pos[a*3+2])||!pred(pos[b*3],pos[b*3+1],pos[b*3+2])||!pred(pos[c*3],pos[c*3+1],pos[c*3+2]))continue;
  for(const v of [a,b,c]){P.push(pos[v*3],pos[v*3+1],pos[v*3+2]);Nn.push(nrm[v*3],nrm[v*3+1],nrm[v*3+2])}idx[t*3+1]=a;idx[t*3+2]=a;cnt++}
 return{tris:cnt,pos:new Float32Array(P),nrm:new Float32Array(Nn)}}
/* --- scatola dell'auto (dalla carrozzeria a basso dettaglio) --- */
const DMGBOX=(()=>{try{const p=GEO.body.attributes.position.array;if(!(p instanceof Float32Array))return null;let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9,z0=1e9,z1=-1e9;for(let i=0;i<p.length;i+=3){y0=Math.min(y0,p[i+1]);y1=Math.max(y1,p[i+1]);z0=Math.min(z0,p[i+2]);z1=Math.max(z1,p[i+2])}const ym=y0+(y1-y0)*.5;for(let i=0;i<p.length;i+=3){if(p[i+1]>ym)continue;x0=Math.min(x0,p[i]);x1=Math.max(x1,p[i])}return{x0,x1,y0,y1,z0,z1}}catch(e){return null}})()||{x0:-.92,x1:.92,y0:.12,y1:1.45,z0:-2.35,z1:2.35};
/* --- preparazione di un'auto: geometrie proprie (copie) per le parti deformabili --- */
function dmgPrep(a,lods){if(a.dmg)return a.dmg;const D={on:false,zones:new Float32Array(6),meshes:[],cut:{},wl:[false,false,false,false],glass:0,last:-9,total:0,engine:1,fire:0,smoke:0,lods};a.dmg=D;
 const skip=new Set();for(const w of a.wh)w.traverse(o=>skip.add(o));
 for(const L of lods){const G=a[L];if(!G)continue;G.traverse(m=>{if(!m.isMesh||skip.has(m)||m.parent!==G)return;const g=m.geometry;if(!g||!g.index||!g.attributes||!g.attributes.position)return;const pa=g.attributes.position.array;if(!(pa instanceof Float32Array))return;
  const ng=new T.BufferGeometry(),pos=new Float32Array(pa),nrm=new Float32Array(g.attributes.normal.array),idx=g.index.array.slice();ng.setAttribute('position',new T.BufferAttribute(pos,3));ng.setAttribute('normal',new T.BufferAttribute(nrm,3));if(g.attributes.uv)ng.setAttribute('uv',g.attributes.uv);ng.setIndex(new T.BufferAttribute(idx,1));ng.boundingSphere=g.boundingSphere?g.boundingSphere.clone():null;if(!ng.boundingSphere)ng.computeBoundingSphere();
  let bx0=1e9,bx1=-1e9,by0=1e9,by1=-1e9,bz0=1e9,bz1=-1e9;for(let i=0;i<pa.length;i+=3){const x=pa[i],y=pa[i+1],z=pa[i+2];if(x<bx0)bx0=x;if(x>bx1)bx1=x;if(y<by0)by0=y;if(y>by1)by1=y;if(z<bz0)bz0=z;if(z>bz1)bz1=z}
  m.geometry=ng;D.meshes.push({bb:[bx0,bx1,by0,by1,bz0,bz1],m,pos,orig:pa,dpos:new Float32Array(pa),chg:new Uint8Array(pa.length/3),nrm,nrmO:g.attributes.normal.array,idx,idxO:g.index.array,g0:g,lod:L,glass:m.material===CM.glass,lamp:m.material===CM.lampf||m.material===CM.lampr,lampF:m.material===CM.lampf,body:m.material&&m.material.type==='MeshPhysicalMaterial'})})}
 return D}
/* --- urto: punto e direzione nel mondo → deformazione, zone, parti che si staccano, vetri, rumore --- */
/* tipo di ostacolo dal solido che ha fermato l'auto: palo (piccolo), guardrail (basso), auto, muro/edificio */
function dmgKind(s){if(!s)return'wall';if(s.amb||s.nc)return'car';if(s.lo)return'rail';const l=s.c===undefined?Math.max(s.x1-s.x0,s.z1-s.z0)/2:Math.max(s.hx,s.hz);return l<.45?'pole':'wall'}
function carHit(a,car,wx,wz,dirx,dirz,imp,kind){if(!a||imp<3.2)return;kind=kind||(PO.hit&&PO.s?dmgKind(PO.s):'wall');const c=Math.cos(car.h),s=Math.sin(car.h),dx=wx-car.x,dz=wz-car.z,lx=dx*c-dz*s,lz=dx*s+dz*c,Dx=dirx*c-dirz*s,Dz=dirx*s+dirz*c;
 dmgApply(a,car,lx,lz,Dx,Dz,imp,false,kind)}
/* --- carrozzeria a nodi e travi (stessa rete per tutte le Alfa) + ammaccature locali della lamiera --- */
const SBT=sbTemplate(DMGBOX),SBBIND=new Map();
// ostacoli: semilarghezza dell'impronta, altezze toccate, raggio (palo); per le ammaccature: altezza del centro e raggio
const SBIMP={wall:{hw:3,ylo:-1,yhi:3,R:0,dy:.42,dr:.7},rail:{hw:3,ylo:.25,yhi:.95,R:0,dy:.3,dr:.55},pole:{hw:0,ylo:-1,yhi:3,R:.3,dy:.42,dr:.3},car:{hw:.75,ylo:.18,yhi:1.08,R:0,dy:.34,dr:.5}};
function sbState(o){return o.sb||(o.sb=sbNew(SBT))}
/* punto della superficie colpito (faccia dell'auto secondo la direzione dell'urto) */
function dmgFace(lx,lz,Dx,Dz){const B=DMGBOX;if(Math.abs(Dz)>=Math.abs(Dx))return[Math.max(B.x0+.15,Math.min(B.x1-.15,lx)),Dz<0?B.z1:B.z0];return[Dx<0?B.x1:B.x0,Math.max(B.z0+.2,Math.min(B.z1-.2,lz))]}
/* urto sulla rete: la simulazione dinamica dei nodi e delle travi (anche per le pattuglie senza modello vicino) */
function dmgCrash(own,lx,lz,Dx,Dz,imp,kind){const S=sbState(own),dl=Math.hypot(Dx,Dz)||1,nx=Dx/dl,nz=Dz/dl,f=dmgFace(lx,lz,nx,nz),k=SBIMP[kind]?kind:'wall',u=k==='car'?imp*.5:imp*.92;
 const t0=performance.now(),r=sbCrash(SBT,S,{n:[nx,nz],c:f,u,hw:SBIMP[k].hw,ylo:SBIMP[k].ylo,yhi:SBIMP[k].yhi,R:SBIMP[k].R}),ms=performance.now()-t0;SBST.n++;SBST.ms+=ms;SBF.ms+=ms;return r}
const SBST={n:0,ms:0};
// tetto di calcolo per fotogramma: negli incidenti a catena fra pattuglie le simulazioni in eccesso passano ai fotogrammi successivi
const SBF={ms:0},SBQ=[];
function sbQueueStep(){SBF.ms=0;while(SBQ.length&&SBF.ms<6){const e=SBQ.shift();if(e[0]==='u')dmgUnitCrash(e[1],e[2],e[3],e[4],e[5],e[6],e[7],true);else dmgApply(e[1],e[2],e[3],e[4],e[5],e[6],e[7],false,e[8],true)}}
// la prima simulazione compila il codice: la si fa subito dopo il caricamento su una rete di prova (niente scatto al primo urto vero)
setTimeout(()=>{try{const S=sbNew(SBT);sbCrash(SBT,S,{n:[0,-1],c:[0,DMGBOX.z1],u:6,hw:3,ylo:-1,yhi:3,R:0})}catch(e){}},2500);
function dmgApply(a,car,lx,lz,Dx,Dz,imp,replay,kind,queued){if(!car.player&&!replay&&!queued&&SBF.ms>6){if(SBQ.length<40)SBQ.push(['a',a,car,lx,lz,Dx,Dz,imp,kind]);return}const now=performance.now()/1000;const lods=car.player?['l0','l1']:['l1'];const D=dmgPrep(a,lods);   /* il giocatore: anche il modello lontano (vista da oltre 32 m) mostra i danni */
 if(!replay&&now-D.last<.12&&imp<(D.lastImp||0)*1.4)return;D.last=now;D.lastImp=imp;const B=DMGBOX,own=car.u||a;
 const k=SBIMP[kind]?kind:'wall',dl=Math.hypot(Dx,Dz)||1,f=dmgFace(lx,lz,Dx/dl,Dz/dl),px=f[0],pz=f[1],py=B.y0+SBIMP[k].dy*(B.y1-B.y0)/1.18;
 D.on=true;dmgCrash(own,lx,lz,Dx,Dz,imp,k);
 // ammaccatura locale della lamiera (anche negli urti leggeri, che la struttura assorbe senza piegarsi)
 const dep=Math.min(k==='pole'?.1:.075,Math.max(0,imp-2.5)*(k==='pole'?.0065:.0045)),R=SBIMP[k].dr,Dv=[Dx/dl,0,Dz/dl];
 if(dep>.003){const seed=Math.floor(lx*97+lz*31+imp*7)%1000;for(const q of D.meshes){const b=q.bb,mg=R+.8;if(px<b[0]-mg||px>b[1]+mg||py<b[2]-mg||py>b[3]+mg||pz<b[4]-mg||pz>b[5]+mg)continue;dmgDeform(q.dpos,q.orig,q.chg,[px,py,pz],Dv,dep,R,seed)}D.dent=(D.dent||0)+dep}
 sbModel(a,own,car,replay);
 if(!replay){dmgSound(imp,D.glass>0&&imp>8.5);if(car.player)dmgHud(true)}}
/* il modello segue la rete: vertici legati alle celle, normali ricalcolate dove la lamiera si è mossa, poi gli effetti */
// auto del giocatore (modello ad alto dettaglio, 260 mila vertici): i pezzi si deformano qualche alla volta nei fotogrammi seguenti,
// così l'urto non blocca il gioco e la lamiera si vede accartocciarsi in pochi istanti
const SKQ=[];
function sbSkinMesh(q,S,cr){if(!q.bind){let b=SBBIND.get(q.g0);if(!b){b=sbBind(SBT,q.orig);SBBIND.set(q.g0,b)}q.bind=b}
 sbSkin(SBT,S,q.bind,q.dpos,q.nrmO,q.pos,q.chg,!q.glass&&!q.lamp,cr);let any=false;for(let i=0;i<q.chg.length;i++)if(q.chg[i]){any=true;break}
 if(any){dmgNormals(q.pos,q.nrm,q.idx,q.chg);q.chg.fill(0);q.m.geometry.attributes.position.needsUpdate=true;q.m.geometry.attributes.normal.needsUpdate=true}}
function sbSkinStep(){let budget=60000;while(SKQ.length&&budget>0){const e=SKQ.shift();sbSkinMesh(e.q,e.S,e.D.cr);budget-=e.q.pos.length/3}}
function sbModel(a,own,car,replay){const D=a.dmg,S=own.sb;if(!D||!S)return;D.cr=sbNodeCrumple(SBT,S);D.on=true;
 if(car.player&&!replay){for(const q of D.meshes)if(!SKQ.some(e=>e.q===q))SKQ.push({q,S,D})}else{const t0=performance.now();for(const q of D.meshes)sbSkinMesh(q,S,D.cr);SBF.ms+=performance.now()-t0}
 sbEffects(a,own,car,replay)}
/* effetti dalla rete: motore, zone, vetri, fari, paraurti, cofano, ruote (piegate o staccate) */
function sbEffects(a,own,car,replay){const D=a.dmg,S=own.sb,R=sbDerive(SBT,S),B=DMGBOX,H=B.y1-B.y0;D.R=R;
 D.engine=Math.min(D.engine,R.engine);for(let z=0;z<6;z++)D.zones[z]=Math.max(D.zones[z],Math.min(1,R.zones[z]*2.2));D.total=Math.min(1,Math.max(D.total,R.total+(D.dent||0)*1.2));
 const gc=D.gcut||(D.gcut={}),cut=(key,pred,glass,col)=>{if(gc[key])return;gc[key]=true;let n=0,cx=0,cy=0,cz=0,cn=0;for(const q of D.meshes){if(glass?!q.glass:!q.lamp)continue;const res=dmgCut(q.pos,q.nrm,q.idx,pred);if(res.tris){q.m.geometry.index.needsUpdate=true;n+=res.tris;for(let i=0;i<Math.min(30,res.pos.length/3);i++){cx+=res.pos[i*3];cy+=res.pos[i*3+1];cz+=res.pos[i*3+2];cn++}}}if(glass)D.glass+=n;if(n&&!replay&&cn){dmgShards(a,car,cx/cn,cy/cn,cz/cn,Math.min(36,6+Math.round(n/40)),glass?[.62,.78,.8]:col)}};   /* centro dei frammenti: media dei vertici davvero sommati (con più pezzi di vetro la media era moltiplicata e i frammenti nascevano in cielo) */
 if(R.ws||R.fC>.8)cut('ws',(x,y,z)=>z>.15&&y>B.y0+H*.6,true);
 if(R.rw||R.rC>.8)cut('rw',(x,y,z)=>z<-1.2&&y>B.y0+H*.6,true);
 if(R.sideGlass[0])cut('sl',(x,y,z)=>x>.55&&z>-1.3&&z<1.1&&y>B.y0+H*.6,true);if(R.sideGlass[1])cut('sr',(x,y,z)=>x<-.55&&z>-1.3&&z<1.1&&y>B.y0+H*.6,true);
 if(R.lampF[0])cut('lfl',(x,y,z)=>z>1.6&&x>0,false,[.9,.92,.95]);if(R.lampF[1])cut('lfr',(x,y,z)=>z>1.6&&x<=0,false,[.9,.92,.95]);
 if(R.lampR[0])cut('lrl',(x,y,z)=>z<-1.6&&x>0,false,[.7,.08,.08]);if(R.lampR[1])cut('lrr',(x,y,z)=>z<-1.6&&x<=0,false,[.7,.08,.08]);
 const Dv=[0,0,1];
 if(R.fb&&!D.cut.fb)dmgDetach(a,car,'fb',(x,y,z)=>z>B.z1-.34&&y<B.y0+H*.42,[0,0,-1],14,replay);
 if(R.rb&&!D.cut.rb)dmgDetach(a,car,'rb',(x,y,z)=>z<B.z0+.34&&y<B.y0+H*.44,[0,0,1],14,replay);
 if(R.hood&&!D.cut.hood)dmgDetach(a,car,'hood',(x,y,z)=>z>B.z1-1.45&&z<B.z1-.25&&y>B.y0+H*.46&&Math.abs(x)<B.x1-.12,[0,.9,-.3],22,replay);
 for(const [sd,key,sv] of [[1,'mL',R.sL],[-1,'mR',R.sR]])if(!D.cut[key]&&sv>.1)dmgDetach(a,car,key,(x,y,z)=>(sd>0?x>B.x1-.06:x<B.x0+.06)&&y>B.y0+H*.55&&y<B.y0+H*.78&&z>.25&&z<1.05,[-sd,0,0],16,replay);
 // ruote: mozzo spostato (campanatura e convergenza storte) o strappato
 const HW=[0,2,1,3];for(let h=0;h<4;h++){const hb=R.hubs[h],k=HW[h];if(hb.lost&&!D.wl[k]){dmgWheel(a,car,k,[0,0,0],replay);continue}
  for(const L of [0,1]){const w=a.wh[k+L*4],st=w&&w.parent;if(!st)continue;if(!st.userData.p0)st.userData.p0=st.position.clone();const p0=st.userData.p0;st.position.set(p0.x+hb.dx,p0.y+hb.dy,p0.z+hb.dz);st.rotation.z=hb.camber;st.userData.toe=hb.toe;if(h>=2)st.rotation.y=hb.toe}}}
/* pattuglia senza modello vicino: l'urto agisce solo sulla rete; il modello verrà deformato quando comparirà */
function dmgUnitCrash(u,lx,lz,Dx,Dz,imp,kind,queued){if(!queued&&SBF.ms>6){if(SBQ.length<40)SBQ.push(['u',u,lx,lz,Dx,Dz,imp,kind]);return}const now=PD.t;if(!queued&&now-(u.sbLast||-9)<.12&&imp<(u.sbImp||0)*1.4)return;u.sbLast=now;u.sbImp=imp;dmgCrash(u,lx,lz,Dx,Dz,imp,kind);u.sbDirty=true}
/* nuovo modello per una pattuglia già danneggiata: si allinea alla sua rete */
function sbSync(a,u){if(!u.sb)return;const D=dmgPrep(a,['l1']);D.on=true;sbModel(a,u,{x:u.x,z:u.z,h:u.h,y:u.y,vx:0,vz:0,u},true)}
function pdRndD(){return Math.random()}
/* --- parti staccate e frammenti: fisica semplice (gravità, rimbalzo sul terreno, attrito, rotazione) --- */
const DEB=[];
function dmgDetach(a,car,key,pred,Dv,imp,replay){const D=a.dmg;D.cut[key]=true;let made=null;
 for(const q of D.meshes){const res=dmgCut(q.pos,q.nrm,q.idx,pred);if(!res.tris)continue;q.m.geometry.index.needsUpdate=true;
  if(!replay&&(q.lod===(car.player?'l0':'l1')&&res.tris>20&&!made||(made&&q.lod===made.lod))){const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(res.pos,3));g.setAttribute('normal',new T.BufferAttribute(res.nrm,3));const m=new T.Mesh(g,q.m.material);if(!made){made={g:new T.Group(),lod:q.lod};made.g.add(m)}else made.g.add(m)}}
 if(!made)return;const grp=made.g,c=Math.cos(car.h),s=Math.sin(car.h);grp.position.set(car.x,car.y,car.z);grp.rotation.set(0,car.h,0);sc.add(grp);
 const out=[-Dv[0],0,-Dv[2]],vw=[out[0]*c+out[2]*s,0,-out[0]*s+out[2]*c];
 DEB.push({o:grp,vx:car.vx*.55+vw[0]*imp*.18+(Math.random()-.5)*2,vy:2+imp*.12,vz:car.vz*.55+vw[2]*imp*.18+(Math.random()-.5)*2,wx:(Math.random()-.5)*6,wy:(Math.random()-.5)*5,wz:(Math.random()-.5)*6,t:0,life:90,r:.4,big:true});
 if(car.player)toast({fb:'Paraurti anteriore staccato',rb:'Paraurti posteriore staccato',hood:'Il cofano è volato via',mL:'Specchietto staccato',mR:'Specchietto staccato'}[key]||'Parte staccata');while(DEB.length>70)dmgDrop(DEB.shift())}
function dmgWheel(a,car,k,Dv,replay){const D=a.dmg;D.wl[k]=true;let src=null;for(const L of [0,1]){const w=a.wh[k+L*4];if(!w)continue;if(w.parent&&w.parent.parent===a[car.player?'l0':'l1'])src=w;w.visible=false}
 if(src&&!replay){const cl=src.clone(),wp=new T.Vector3();src.getWorldPosition(wp);const grp=new T.Group();grp.add(cl);grp.position.copy(wp);grp.rotation.set(0,car.h,0);sc.add(grp);
  DEB.push({o:grp,vx:car.vx*.8-Dv[0]*4,vy:2.5,vz:car.vz*.8-Dv[2]*4,wx:(Math.random()-.5)*8,wy:(Math.random()-.5)*3,wz:(Math.random()-.5)*8,t:0,life:120,r:.34,big:true})}
 if(car.player&&!replay)toast('Hai perso una ruota!')}
const DMGM={};function dmgShardMat(col){const k=col.join(',');if(!DMGM[k])DMGM[k]=new T.MeshStandardMaterial({color:new T.Color(col[0],col[1],col[2]),roughness:.15,metalness:.2,transparent:true,opacity:.55});return DMGM[k]}
let DMGSG=null;
function dmgShards(a,car,px,py,pz,n,col){if(!DMGSG)DMGSG=new T.BoxGeometry(.045,.006,.035);const c=Math.cos(car.h),s=Math.sin(car.h),wx=car.x+px*c+pz*s,wz=car.z-px*s+pz*c,mt=dmgShardMat(col);
 for(let i=0;i<n;i++){const m=new T.Mesh(DMGSG,mt);m.position.set(wx+(Math.random()-.5)*.6,car.y+py,wz+(Math.random()-.5)*.6);sc.add(m);DEB.push({o:m,vx:car.vx*.4+(Math.random()-.5)*5,vy:1+Math.random()*3,vz:car.vz*.4+(Math.random()-.5)*5,wx:(Math.random()-.5)*20,wy:(Math.random()-.5)*20,wz:(Math.random()-.5)*20,t:0,life:25,r:.01})}
 while(DEB.length>140)dmgDrop(DEB.shift())}
function dmgDrop(d){if(d&&d.o){sc.remove(d.o)}}
function dmgStep(dt){sbQueueStep();sbSkinStep();for(let i=DEB.length-1;i>=0;i--){const d=DEB[i];d.t+=dt;if(d.t>d.life){dmgDrop(d);DEB.splice(i,1);continue}const o=d.o;if(d.rest){continue}
  d.vy-=9.8*dt;o.position.x+=d.vx*dt;o.position.y+=d.vy*dt;o.position.z+=d.vz*dt;o.rotation.x+=d.wx*dt;o.rotation.y+=d.wy*dt;o.rotation.z+=d.wz*dt;
  const gy=GY(o.position.x,o.position.z)+d.r;if(o.position.y<gy){o.position.y=gy;if(Math.abs(d.vy)<1.2&&Math.hypot(d.vx,d.vz)<.5){d.rest=true;if(d.big){o.rotation.x=Math.round(o.rotation.x/Math.PI)*Math.PI;o.rotation.z=Math.round(o.rotation.z/Math.PI)*Math.PI}continue}d.vy=-d.vy*.28;const f=Math.exp(-6*dt);d.vx*=f;d.vz*=f;d.wx*=.6;d.wy*=.6;d.wz*=.6}}
 dmgSmokeStep(dt)}
/* --- fumo e fiamme dal vano motore --- */
let DMGTX=null;const SMK=[];
function dmgSmokeTex(){if(DMGTX)return DMGTX;const cv=document.createElement('canvas');cv.width=cv.height=64;const x=cv.getContext('2d');if(x&&x.createRadialGradient){const g=x.createRadialGradient(32,32,2,32,32,31);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,64,64)}DMGTX=new T.CanvasTexture(cv);return DMGTX}
function dmgEmit(car,fire){const tx=dmgSmokeTex(),B=DMGBOX,c=Math.cos(car.h),s=Math.sin(car.h),lz=B.z1-.7,wx=car.x+lz*s,wz=car.z+lz*c;
 const m=new T.Sprite(new T.SpriteMaterial({map:fire&&typeof crFlameTex==='function'?crFlameTex():tx,color:fire?0xffffff:(car.dmgE<.25?0x2a2a2a:0x8a8a8a),transparent:true,opacity:fire?.55:.55,depthWrite:false,blending:fire?T.AdditiveBlending:T.NormalBlending}));
 m.position.set(wx+(Math.random()-.5)*.5,car.y+(fire?1.2:1.1),wz+(Math.random()-.5)*.5);if(fire)m.scale.set(.5,1,1);else m.scale.setScalar(.7);sc.add(m);SMK.push({m,t:0,life:fire?.7:2.4,vy:fire?2.2:1.3,grow:fire?.6:1.6,fire});while(SMK.length>60){const q=SMK.shift();sc.remove(q.m)}}
function dmgSmokeStep(dt){for(let i=SMK.length-1;i>=0;i--){const q=SMK[i];q.t+=dt;if(q.t>q.life){sc.remove(q.m);if(q.m.material)q.m.material.dispose();SMK.splice(i,1);continue}q.m.position.y+=q.vy*dt;q.m.scale.multiplyScalar(1+q.grow*dt);q.m.material.opacity*=Math.exp(-(q.fire?2.5:.9)*dt)}}
// fumo dal motore rotto (grigio, poi nero quando il motore è quasi distrutto); quando l'auto brucia fiamme e fumo li fa l'incendio
function dmgSmokeFor(a,car,dt){const D=a&&a.dmg;if(!D||!D.on)return;car.dmgE=D.engine;if(D.engine>.55)return;if(a.cr&&a.cr.fire)return;if(typeof fpSpawn!=='function'){D.em=(D.em||0)+dt;const iv=D.engine<.12?.05:D.engine<.3?.09:.16;let n=0;while(D.em>iv&&n++<4){D.em-=iv;dmgEmit(car,false)}if(D.em>iv)D.em=0;return}
 D.em=(D.em||0)+dt;const dk=D.engine<.25,iv=D.engine<.12?.11:dk?.16:.26;let n=0;while(D.em>iv&&n++<3){D.em-=iv;const B=DMGBOX,c=Math.cos(car.h),s=Math.sin(car.h),lz=B.z1-.65,lx=(Math.random()-.5)*.7,wx=car.x+lx*c+lz*s,wz=car.z-lx*s+lz*c,v=dk?.11+Math.random()*.06:.42+Math.random()*.12;
  fpSpawn('sm',wx,car.y+1.02,wz,{life:dk?3.2:2.3,vy:1.25,s:.42,s1:dk?2:1.45,op:dk?.55:.36,c0:[v,v,v],c1:[v+.14,v+.14,v+.14],vx:(car.vx||0)*.35,vz:(car.vz||0)*.35})}if(D.em>iv)D.em=0}
/* --- suono dell'urto e dei vetri (rumore filtrato) --- */
function dmgSound(imp,glass){const c=pdAudio&&pdAudio.ctx;if(!c)return;try{const t=c.currentTime,len=Math.floor(c.sampleRate*.35),b=c.createBuffer(1,len,c.sampleRate),d=b.getChannelData(0);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.exp(-i/(len*.18));
  const src=c.createBufferSource();src.buffer=b;const f=c.createBiquadFilter();f.type='lowpass';f.frequency.value=380+imp*25;const g=c.createGain();g.gain.value=Math.min(.9,imp/30);src.connect(f);f.connect(g);g.connect(c.destination);src.start(t);
  if(glass){const s2=c.createBufferSource();s2.buffer=b;const f2=c.createBiquadFilter();f2.type='highpass';f2.frequency.value=3500;const g2=c.createGain();g2.gain.value=.35;s2.connect(f2);f2.connect(g2);g2.connect(c.destination);s2.start(t+.03)}}catch(e){}}
/* --- effetti sulla guida del giocatore --- */
const CARDMG={ef:1,pull:0,lk:1,drag:0,vmax:56,tp:0,tr:0};
function dmgDrive(){const D=carA.dmg;if(!D||!D.on){CARDMG.ef=1;CARDMG.pull=0;CARDMG.lk=1;CARDMG.drag=0;CARDMG.vmax=56;CARDMG.tp=0;CARDMG.tr=0;return}let tp=0,tr=0;for(let k=0;k<4;k++){if(!D.wl[k])continue;const w=carA.wh[k],p=w&&w.parent?w.parent.position:{x:0,z:0};tp+=p.z>0?.05:-.05;tr+=p.x>0?-.07:.07}CARDMG.tp=tp;CARDMG.tr=tr;
 const z=D.zones,lost=D.wl.filter(Boolean).length,R=D.R;CARDMG.ef=D.engine<.06?0:.3+.7*D.engine;CARDMG.pull=Math.max(-.05,Math.min(.05,(z[1]-z[0])*.03+(R?(R.hubs[0].toe+R.hubs[1].toe)*.5:0)));   /* tira da un lato soprattutto se la rete ha davvero storto i mozzi (convergenza); prima bastava il muso ammaccato per sterzare di 0,08 rad */for(let k=0;k<4;k++){if(!D.wl[k])continue;const w=carA.wh[k],p=w&&w.parent?w.parent.position:{x:0,z:0};CARDMG.pull+=(p.x>0?-1:1)*(p.z>0?.16:.07)}CARDMG.lk=1-Math.min(.45,(z[0]+z[1])*.22);CARDMG.drag=lost*1.8+(R?R.hubs.reduce((s,q)=>s+Math.abs(q.toe)+Math.abs(q.camber)*.5,0)*2.5:0);CARDMG.vmax=lost?14:56-Math.round((1-D.engine)*16)}
function dmgHud(force){const el=$('#dmg');if(!el)return;const D=carA.dmg,ty=carA.tyre,nf=ty?ty.f.filter(v=>v>.3).length:0,ns=ty?ty.shred.filter(Boolean).length:0;if((!D||!D.on)&&!nf){el.style.display='none';return}el.style.display='block';const p=D&&D.on?Math.round(Math.min(1,D.total)*100):0;el.textContent='🔧 '+p+'%'+(D&&D.on&&D.engine<.06?' · motore KO':D&&D.on&&D.engine<.5?' · motore':'')+(D&&D.on&&D.wl.some(Boolean)?' · ruota':'')+(ns?' · cerchi a terra '+ns:nf?' · gomme a terra '+nf:'');el.style.background=p>70||ns?'rgba(170,30,30,.85)':p>35||nf?'rgba(190,120,20,.85)':'rgba(20,24,30,.78)'}
/* --- riparazione: officina dell'area di servizio o del paese (auto ferma vicino al distributore, al centro commerciale o al municipio) --- */
function dmgRepair(a){const D=a&&a.dmg;if(a){a.sb=null;if(a.tyre)TYRE.reset(a)}if(!D)return;for(let i=SKQ.length-1;i>=0;i--)if(SKQ[i].D===D)SKQ.splice(i,1);for(const q of D.meshes){q.pos.set(q.orig);q.dpos.set(q.orig);q.chg.fill(0);q.nrm.set(q.nrmO);q.idx.set(q.idxO);q.m.geometry.attributes.position.needsUpdate=true;q.m.geometry.attributes.normal.needsUpdate=true;q.m.geometry.index.needsUpdate=true}
 for(const w of a.wh){w.visible=true;const st=w.parent;if(st&&st.userData.p0){st.position.copy(st.userData.p0);st.rotation.z=0;st.userData.toe=0}}D.on=false;D.zones.fill(0);D.cut={};D.gcut={};D.wl=[false,false,false,false];D.glass=0;D.total=0;D.engine=1;D.dent=0;D.R=null}
function dmgRepairSpot(){if(!inCar||Math.hypot(V.vx,V.vz)>1)return null;for(const s of WORLD.SPEC){if(s.t!=='sa'&&s.t!=='mall'&&s.t!=='hall')continue;if(Math.hypot(s.x-C.x,s.z-C.z)<(s.t==='sa'?120:70))return s}return null}
/* pulsante Ripara sempre disponibile quando l'auto è danneggiata: si ripara da fermi (2,5 s; durante un inseguimento 6 s, e la polizia può arrivare) */
let DMGREP=null;
function dmgRepairStart(){if(!inCar)return;const D=carA.dmg,fl=!!(carA.tyre&&carA.tyre.f.some(v=>v>0))||!!V.flip;if(((!D||!D.on)&&!fl)||DMGREP)return;if(Math.hypot(V.vx,V.vz)>1){toast('Fermati per riparare l\'auto');return}const chase=!!(PD.case&&PD.case.phase!=='ended');DMGREP={t:0,dur:chase?6:2.5};toast(chase?'Riparazione d\'emergenza: resta fermo 6 secondi':'Riparazione in corso…')}
function dmgRepairStep(dt){if(!DMGREP)return;const b=$('#rep');if(!inCar||Math.hypot(V.vx,V.vz)>1.5){DMGREP=null;toast('Riparazione interrotta');if(b)b.textContent='🔧 Ripara l\'auto';return}DMGREP.t+=dt;const p=Math.min(1,DMGREP.t/DMGREP.dur);if(b)b.textContent='🔧 '+Math.round(p*100)+'%';if(p>=1){DMGREP=null;dmgRepair(carA);dmgDrive();dmgHud();if(b)b.textContent='🔧 Ripara l\'auto';toast('Auto riparata')}}
let DMGRT=0;function dmgUi(dt){dmgRepairStep(dt);const b=$('#rep');if(!b)return;DMGRT+=dt;if(DMGRT<.25)return;DMGRT=0;const D=carA.dmg,show=!!(inCar&&((D&&D.on)||(carA.tyre&&carA.tyre.f.some(v=>v>0))||V.flip))||!!DMGREP;b.style.display=show?'block':'none'}
/* urto fra due auto (giocatore o pattuglia) da pdCollide: punto di contatto, direzione verso l'interno dell'auto, velocità d'urto */
function dmgPair(b,px,pz,nx,nz,imp){if(imp*.8<3.2)return;if(b.p){carHit(carA,{x:C.x,z:C.z,h:C.h,y:V.y,vx:V.vx,vz:V.vz,player:true},px,pz,nx,nz,imp,'car')}else if(b.u){const u=b.u;if(u.mdl)carHit(u.mdl,{x:u.x,z:u.z,h:u.h,y:u.y,vx:u.vx,vz:u.vz,u},px,pz,nx,nz,imp,'car');else{const c=Math.cos(u.h),s=Math.sin(u.h),dx=px-u.x,dz=pz-u.z;dmgUnitCrash(u,dx*c-dz*s,dx*s+dz*c,nx*c-nz*s,nx*s+nz*c,imp,'car')}}}
