/* ===== Autostrade: generatore indipendente dalla direzione. L'asse è una polilinea per ascissa curvilinea s (metri dall'inizio); ogni autostrada ha profilo altimetrico, corridoio spianato, carreggiate a senso unico, varchi, svincoli con casello e paese, aree di servizio, barriere, statale parallela, segnaletica ===== */
const MWS=[],TXT=[];
const SIGN=(t,s,arr)=>{let i=TXT.findIndex(q=>q.t===t&&q.s===s&&!!q.arr===!!arr);if(i<0){i=TXT.length;TXT.push({t,s,arr:!!arr})}return i};
/* curve: polilinea morbida fra punti di controllo (Catmull-Rom), passo ~18 m */
function curvePts(cp,step){const out=[];for(let i=0;i<cp.length-1;i++){const p0=cp[Math.max(0,i-1)],p1=cp[i],p2=cp[i+1],p3=cp[Math.min(cp.length-1,i+2)],L=Math.hypot(p2[0]-p1[0],p2[1]-p1[1]),n=Math.max(1,Math.ceil(L/(step||18)));
 for(let t=0;t<n;t++){const u=t/n,u2=u*u,u3=u2*u,f=(a,b,c,d)=>.5*(2*b+(-a+c)*u+(2*a-5*b+4*c-d)*u2+(-a+3*b-3*c+d)*u3);out.push([f(p0[0],p1[0],p2[0],p3[0]),f(p0[1],p1[1],p2[1],p3[1])])}}out.push(cp[cp.length-1]);return out}
/* Catmull-Rom centripeta (Barry-Goldman): punti di controllo a passo disuguale senza cappi né cuspidi; passo ~6 m */
function curvePtsC(cp,step){const out=[],tj=(ti,a,b)=>ti+Math.sqrt(Math.hypot(b[0]-a[0],b[1]-a[1]));
 for(let i=0;i<cp.length-1;i++){const p0=cp[Math.max(0,i-1)],p1=cp[i],p2=cp[i+1],p3=cp[Math.min(cp.length-1,i+2)];let t0=0,t1=tj(t0,p0,p1),t2=tj(t1,p1,p2),t3=tj(t2,p2,p3);if(t1===t0)t1=t0+1e-6;if(t2===t1)t2=t1+1e-6;if(t3===t2)t3=t2+1e-6;
  const L=Math.hypot(p2[0]-p1[0],p2[1]-p1[1]),n=Math.max(1,Math.ceil(L/(step||6)));
  for(let k=0;k<n;k++){const t=t1+(t2-t1)*k/n;const A1=[(t1-t)/(t1-t0)*p0[0]+(t-t0)/(t1-t0)*p1[0],(t1-t)/(t1-t0)*p0[1]+(t-t0)/(t1-t0)*p1[1]],A2=[(t2-t)/(t2-t1)*p1[0]+(t-t1)/(t2-t1)*p2[0],(t2-t)/(t2-t1)*p1[1]+(t-t1)/(t2-t1)*p2[1]],A3=[(t3-t)/(t3-t2)*p2[0]+(t-t2)/(t3-t2)*p3[0],(t3-t)/(t3-t2)*p2[1]+(t-t2)/(t3-t2)*p3[1]];
   const B1=[(t2-t)/(t2-t0)*A1[0]+(t-t0)/(t2-t0)*A2[0],(t2-t)/(t2-t0)*A1[1]+(t-t0)/(t2-t0)*A2[1]],B2=[(t3-t)/(t3-t1)*A2[0]+(t-t1)/(t3-t1)*A3[0],(t3-t)/(t3-t1)*A2[1]+(t-t1)/(t3-t1)*A3[1]];
   out.push([(t2-t)/(t2-t1)*B1[0]+(t-t1)/(t2-t1)*B2[0],(t2-t)/(t2-t1)*B1[1]+(t-t1)/(t2-t1)*B2[1]])}}
 out.push(cp[cp.length-1]);return out}
/* tracciato: ricampionato ogni 10 m per ascissa curvilinea, prolungato di 500 m in linea retta alle due estremità (s<0 e s>L) per raccordi e corridoio */
const MWDS=10,MWEXT=500;
function mwAlign(def){const M={name:def.name,dest0:def.dest0,dest1:def.dest1,km0:def.km0||0,bar:[],sa:[],ic:[],varchi:[],signs:[],nodes:{1:{},'-1':{}},toll:[],saSpec:[],segs:{1:[],'-1':[]},def};
 const raw=curvePtsC(def.cp,6);
 // ricampionamento uniforme
 const rs=[0];for(let i=1;i<raw.length;i++)rs.push(rs[i-1]+Math.hypot(raw[i][0]-raw[i-1][0],raw[i][1]-raw[i-1][1]));const L=rs[rs.length-1];M.L=L;M.s0=0;M.s1=L;
 const N=Math.floor((L+2*MWEXT)/MWDS)+1,X=new Float64Array(N),Z=new Float64Array(N),TX=new Float64Array(N),TZ=new Float64Array(N);
 const t0=[raw[1][0]-raw[0][0],raw[1][1]-raw[0][1]],l0=Math.hypot(t0[0],t0[1]),tl=[raw[raw.length-1][0]-raw[raw.length-2][0],raw[raw.length-1][1]-raw[raw.length-2][1]],ll=Math.hypot(tl[0],tl[1]);
 let j=0;for(let i=0;i<N;i++){const s=i*MWDS-MWEXT;
  if(s<=0){X[i]=raw[0][0]+t0[0]/l0*s;Z[i]=raw[0][1]+t0[1]/l0*s}else if(s>=L){X[i]=raw[raw.length-1][0]+tl[0]/ll*(s-L);Z[i]=raw[raw.length-1][1]+tl[1]/ll*(s-L)}
  else{while(j<rs.length-2&&rs[j+1]<s)j++;const f=(s-rs[j])/Math.max(1e-9,rs[j+1]-rs[j]);X[i]=raw[j][0]+(raw[j+1][0]-raw[j][0])*f;Z[i]=raw[j][1]+(raw[j+1][1]-raw[j][1])*f}}
 for(let i=0;i<N;i++){const a=Math.max(0,i-1),b=Math.min(N-1,i+1),dx=X[b]-X[a],dz=Z[b]-Z[a],l=Math.hypot(dx,dz)||1;TX[i]=dx/l;TZ[i]=dz/l}
 M.N=N;M.X=X;M.Z=Z;{let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;for(let i=0;i<N;i++){x0=Math.min(x0,X[i]);x1=Math.max(x1,X[i]);z0=Math.min(z0,Z[i]);z1=Math.max(z1,Z[i])}M.bb=[x0-150,x1+150,z0-150,z1+150]}
 const idx=s=>{const u=(s+MWEXT)/MWDS,i=Math.max(0,Math.min(N-2,Math.floor(u)));return[i,Math.max(0,Math.min(1,u-i))]};
 M.pt=s=>{const[i,f]=idx(s);return[X[i]+(X[i+1]-X[i])*f,Z[i]+(Z[i+1]-Z[i])*f]};
 M.tan=s=>{const[i,f]=idx(s),tx=TX[i]+(TX[i+1]-TX[i])*f,tz=TZ[i]+(TZ[i+1]-TZ[i])*f,l=Math.hypot(tx,tz)||1;return[tx/l,tz/l]};
 M.n=s=>{const t=M.tan(s);return[-t[1],t[0]]};                           // normale a destra di chi percorre s crescente
 M.p=(s,off)=>{const p=M.pt(s),n=M.n(s);return[p[0]+n[0]*off,p[1]+n[1]*off]};
 M.km=s=>Math.max(0,(s+M.km0)/1000);
 // proiezione (x,z) → {s,d}: tabella spaziale dei tratti della polilinea (celle di 256 m, fascia di 140 m)
 const HC=256,HB=140,HM=new Map(),hk=(i,j)=>(i+400)*8192+(j+400);
 for(let i=0;i<N-1;i++){const x0=Math.floor((Math.min(X[i],X[i+1])-HB)/HC),x1=Math.floor((Math.max(X[i],X[i+1])+HB)/HC),z0=Math.floor((Math.min(Z[i],Z[i+1])-HB)/HC),z1=Math.floor((Math.max(Z[i],Z[i+1])+HB)/HC);for(let a=x0;a<=x1;a++)for(let b=z0;b<=z1;b++){const k=hk(a,b);let arr=HM.get(k);if(!arr)HM.set(k,arr=[]);arr.push(i)}}
 const PR={s:0,d:0,i:0};
 M.proj=(x,z,maxd)=>{const arr=HM.get(hk(Math.floor(x/HC),Math.floor(z/HC)));if(!arr)return null;let bd=(maxd||HB)**2,bi=-1,bt=0,bsg=1;
  for(const i of arr){const dx=X[i+1]-X[i],dz=Z[i+1]-Z[i],l2=dx*dx+dz*dz||1;let t=((x-X[i])*dx+(z-Z[i])*dz)/l2;t=t<0?0:t>1?1:t;const px=X[i]+dx*t-x,pz=Z[i]+dz*t-z,d2=px*px+pz*pz;if(d2<bd){bd=d2;bi=i;bt=t;bsg=(-dz*(-px)+dx*(-pz))<0?-1:1}}
  if(bi<0)return null;const dx=X[bi+1]-X[bi],dz=Z[bi+1]-Z[bi],l=Math.hypot(dx,dz)||1;PR.s=bi*MWDS-MWEXT+bt*l;PR.d=((x-X[bi])*(-dz)+(z-Z[bi])*dx)/l;PR.i=bi;return PR};
 mwProfile(M,[]);
 CORR.push({curve:M,hw:34,sl:55});
 RESF.push((x,z)=>{const q=M.proj(x,z,62);return!!q&&q.s>-80&&q.s<L+400});
 MWS.push(M);return M}
/* profilo altimetrico: media mobile del terreno lungo l'asse, pendenza massima 4,5 %; in piano nelle finestre delle opere (svincoli, aree di servizio, barriere); molto sopra il terreno = viadotto, molto sotto = galleria */
function mwProfile(M,flats){const L=M.L,S=50,sa=-MWEXT,sb=L+MWEXT,NP=Math.ceil((sb-sa)/S)+1,hb=new Float32Array(NP),e=new Float32Array(NP),md=new Uint8Array(NP),w=new Float32Array(NP),fx=new Uint8Array(NP);
 for(let i=0;i<NP;i++){const p=M.pt(sa+i*S);hb[i]=Hbase(p[0],p[1])}
 for(let i=0;i<NP;i++){let s=0,n=0;for(let k=-9;k<=9;k++){const j=Math.min(NP-1,Math.max(0,i+k));s+=hb[j];n++}e[i]=s/n}
 for(const f of flats){const i0=Math.max(0,Math.round((f.s-f.half-sa)/S)),i1=Math.min(NP-1,Math.round((f.s+f.half-sa)/S));let s=0,n=0;for(let i=i0;i<=i1;i++){s+=e[i];n++}const m=s/n;for(let i=i0;i<=i1;i++){e[i]=m;fx[i]=1}}
 const G=.045*S;for(let pass=0;pass<2;pass++){for(let i=1;i<NP;i++)if(!fx[i])e[i]=Math.min(e[i-1]+G,Math.max(e[i-1]-G,e[i]));for(let i=NP-2;i>=0;i--)if(!fx[i])e[i]=Math.min(e[i+1]+G,Math.max(e[i+1]-G,e[i]))}
 for(let i=0;i<NP;i++){const d=e[i]-hb[i];md[i]=d>9&&!fx[i]?1:0}   // sotto il terreno: trincea spianata dal corridoio (le gallerie non sono ancora rese); nelle finestre delle opere sempre in rilevato
 for(let pass=0;pass<3;pass++)for(let i=0;i<NP;i++){let j=i;while(j<NP&&md[j]===md[i])j++;if((j-i)*S<160&&md[i]!==0){for(let k=i;k<j;k++)md[k]=0}i=j-1}
 for(let i=0;i<NP;i++)w[i]=md[i]===0?1:((i>0&&md[i-1]===0)||(i<NP-1&&md[i+1]===0))?.5:0;   // corridoio pieno fuori dai viadotti (la rampa d'accesso resta in quota)
 const lerp=(arr,s)=>{const u=(s-sa)/S,i=Math.max(0,Math.min(NP-2,Math.floor(u))),f=Math.max(0,Math.min(1,u-i));return arr[i]+(arr[i+1]-arr[i])*f};
 M.e=s=>lerp(e,s);M.w=s=>lerp(w,s);M.mode=s=>md[Math.max(0,Math.min(NP-1,Math.round((s-sa)/S)))];M.viaduct=(s0,s1)=>{const i0=Math.max(0,Math.floor((Math.min(s0,s1)-sa)/S)),i1=Math.min(NP-1,Math.ceil((Math.max(s0,s1)-sa)/S));for(let i=i0;i<=i1;i++)if(md[i]===1)return true;return false};M.hb=s=>lerp(hb,s);M.prof={sa,S,NP,e,hb,md}}
/* autostrada più vicina a un punto (entro 140 m dall'asse) */
function mwAt(x,z){let best=null;for(const M of MWS){const B=M.bb;if(x<B[0]||x>B[1]||z<B[2]||z>B[3])continue;const q=M.proj(x,z);if(q&&q.s>-60&&q.s<M.L+60&&(!best||Math.abs(q.d)<Math.abs(best.d)))best={mw:M,s:q.s,d:q.d}}return best}
/* ---- città: costanti note fin dall'inizio (cerchie, vertici) così autostrade e statali possono terminare su un vertice esatto dell'anello ---- */
const CITIES=[];
function cityDef(o){o.rr=(a,R,wob)=>R*(1+wob*Math.sin(a*3+1)+wob*.6*Math.sin(a*5+2));
 o.vert=(ri,a)=>{const n=o.n[ri],i=Math.round(((a%(2*Math.PI))+2*Math.PI)%(2*Math.PI)/(2*Math.PI)*n)%n,aa=i/n*2*Math.PI,r=o.rr(aa,o.R[ri],o.wob[ri]);return[o.x+Math.cos(aa)*r,o.z+Math.sin(aa)*r]};
 o.rings=[];CITIES.push(o);return o}
/* ---- A1 «del Ponente» verso ovest: tracciato sinusoidale come nella versione precedente ---- */
const fA1=x=>1200+350*Math.sin((x-1700)/2600)+220*Math.sin((x-1700)/1100+1.3);
const dfA1=x=>350/2600*Math.cos((x-1700)/2600)+220/1100*Math.cos((x-1700)/1100+1.3),A1F=[2400,7300,12800,23000,30000,35500,39800];
const cpA1=[];for(let x=1760;x<42400;x+=300){let p=[x,fA1(x)];for(const xf of A1F){const dx=Math.abs(x-xf);if(dx<1400){const k=1-sm(650,1400,dx),zt=fA1(xf)+dfA1(xf)*(x-xf);p=[x,fA1(x)*(1-k)+zt*k]}}cpA1.push(p)}cpA1.push([42400,fA1(42400)]);
MILAN={x:42400+300+3800,z:fA1(42400),R:[650,1300,2600,3800],wob:[.04,.035,.025,.015],h:22,name:'Milano'};MILAN.rr=(a,R,wob)=>R*(1+wob*Math.sin(a*3+1)+wob*.6*Math.sin(a*5+2));MILAN.vert=(ri,a)=>{const n=[24,32,48,48][ri],i=Math.round(((a%(2*Math.PI))+2*Math.PI)%(2*Math.PI)/(2*Math.PI)*n)%n,aa=i/n*2*Math.PI,r=MILAN.rr(aa,MILAN.R[ri],MILAN.wob[ri]);return[MILAN.x+Math.cos(aa)*r,MILAN.z+Math.sin(aa)*r]};
/* ---- città nuove: Como sul lago (nord) e Genova sul mare (sud); spianamento parziale che rispetta l'acqua ---- */
COMO=cityDef({name:'Como',x:3250,z:24000,R:[560,1500],n:[24,40],wob:[.03,.02],zc:16,zm:17,water:'lago',aC:.35,stadio:Math.PI/2+.4});
GENOVA=cityDef({name:'Genova',x:650,z:-22000,R:[480,1500],n:[24,40],wob:[.035,.02],zc:18,zm:19,water:'mare',aC:-.6,stadio:Math.PI/2-.55});
for(const c of CITIES){c.h=Math.max(Hu(c.x,c.z),c.water==='lago'?5:0);PADS.push({x:c.x,z:c.z,r0:c.R[1]-150,r1:c.R[1]+500,h:c.h,wm:c.water==='lago'?(x,z)=>sm(1,1.1,lakeR(x,z)):(x,z)=>sm(0,400,x-coastX(z))})}
/* ---- allineamenti ---- */
const A1=mwAlign({name:'A1',dest0:'Città',dest1:'Milano',cp:cpA1});A1.milan=MILAN;
const A4=mwAlign({name:'A4',dest0:'Città',dest1:'Como',cp:(()=>{const v=COMO.vert(1,-Math.PI/2);return[[1480,3200],[1480,3700],[1480,4200],[1480,4700],[1750,6400],[2500,8600],[2600,9400],[2700,10200],[2800,11000],[2400,12500],[2250,13500],[2100,14500],[1950,15500],[2500,17000],[3000,19300],[v[0],v[1]-2100],[v[0],v[1]-1440],[v[0],v[1]-740],[v[0],v[1]-260]]})()});   // quadruple di punti allineati dove servono tratti rettilinei (barriere, area di servizio, svincolo, arrivo)
const A3=mwAlign({name:'A3',dest0:'Città',dest1:'Genova',cp:(()=>{const v=GENOVA.vert(1,Math.PI/2);return[[1000,-3300],[1000,-3800],[1000,-4300],[1000,-4800],[1300,-6500],[1500,-8200],[1500,-9000],[1500,-9800],[1500,-10600],[1100,-12000],[900,-13000],[700,-14000],[500,-15000],[900,-16800],[v[0]+120,v[1]+2900],[v[0],v[1]+1900],[v[0],v[1]+1300],[v[0],v[1]+800],[v[0],v[1]+260]]})()});
MWR=A1;
