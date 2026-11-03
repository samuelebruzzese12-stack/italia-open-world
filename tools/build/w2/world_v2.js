const WORLD=(()=>{
/* ===== Mondo v2: rettangolo esteso verso ovest, terreno, fiume, zone, strade (crescita + tracciati espliciti + correzione dei fondi ciechi), lotti ed edifici ===== */
const WS=3000,CSZ=150,SEA=-2;
const TIMES={},tmark=(k,t0)=>{TIMES[k]=(TIMES[k]||0)+(Date.now()-t0)};
const X0=-3000,X1=51500,Z0=-27000,Z1=31000;       // rettangolo del mondo (x cresce verso ovest): città costiera, autostrade, paesi, Milano a ovest, Como a nord, Genova a sud
const RGN=[{x0:-2950,x1:2950,z0:-2950,z1:2950}];   // regioni dove possono crescere le strade organiche (città costiera, paesi)
const walkOK=(x,z)=>{for(const r of RGN)if(x>r.x0&&x<r.x1&&z>r.z0&&z<r.z1)return true;return false};
const inside=(x,z,m)=>{m=m||0;return x>X0+m&&x<X1-m&&z>Z0+m&&z<Z1-m};
const CX0=Math.floor((X0+WS)/CSZ),CX1=Math.floor((X1+WS)/CSZ),CZ0=Math.floor((Z0+WS)/CSZ),CZ1=Math.floor((Z1+WS)/CSZ);
const chunkOK=(cx,cz)=>cx>=CX0&&cx<CX1&&cz>=CZ0&&cz<CZ1;
const NCH=CX1-CX0;
let _s=20261013;const rnd=()=>{_s=(_s+0x6D2B79F5)|0;let t=Math.imul(_s^(_s>>>15),1|_s);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296};
const hsh=(x,y)=>{let h=(Math.imul(x|0,374761393)+Math.imul(y|0,668265263))|0;h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967296};
const vnz=(x,z)=>{const i=Math.floor(x),j=Math.floor(z),u=x-i,v=z-j,a=u*u*(3-2*u),b=v*v*(3-2*v);return hsh(i,j)*(1-a)*(1-b)+hsh(i+1,j)*a*(1-b)+hsh(i,j+1)*(1-a)*b+hsh(i+1,j+1)*a*b};
const fbm=(x,z,o)=>{let s=0,a=.5,f=1;for(let i=0;i<o;i++){s+=a*vnz(x*f+i*17.3,z*f-i*9.1);f*=2;a*=.5}return s};
const sq=x=>x*x;
const sm=(a,b,x)=>{x=Math.min(1,Math.max(0,(x-a)/(b-a)));return x*x*(3-2*x)};
const gs=(x,z,cx,cz,r,h)=>h*Math.exp(-((x-cx)*(x-cx)+(z-cz)*(z-cz))/(2*r*r));
/* costa a golfo, rilievi, vulcano, isola; verso ovest le colline scendono nella pianura */
const coastX=z=>-1450+1000*Math.exp(-(z*z)/722500)-420*Math.exp(-sq((z-1500)/300))+330*Math.exp(-sq((z+1550)/360))+120*Math.sin(z/400+.7)+55*Math.sin(z/110+2)+430*Math.exp(-sq((z+22000)/1100));
function Hcoast(x,z){const d=x-coastX(z);let h=d<0?-2.6+d*.03:-2.6+3.2*sm(0,70,d)+68*sm(0,2400,d);
 const k=sm(500,2800,d);h+=k*(fbm(x/1800+11,z/1800+3,3)-.45)*150+k*fbm(x/500,z/500,2)*14;
 h+=gs(x,z,-180,720,150,80)+gs(x,z,-1880,1480,170,50)+gs(x,z,-1700,-1250,230,52);
 const dv=Math.hypot(x-2150,z+1950);if(dv<1300)h+=560*Math.pow(1-dv/1300,1.8);if(dv<150)h-=90*Math.pow(1-dv/150,2);return h}
function Hplain(x,z){return 22+(fbm(x/900+3,z/900+9,3)-.5)*18+(fbm(x/140+1,z/140+5,2)-.5)*1.6}
/* nord: pianura costiera che sale verso il lago e le montagne (a ovest e a nord del lago); sud: riviera con i monti alle spalle e il golfo di Genova */
const LAKE={x:7000,z:25000,a:.3,rx:2300,rz:4000};
function lakeR(x,z){const c=Math.cos(LAKE.a),s=Math.sin(LAKE.a),dx=x-LAKE.x,dz=z-LAKE.z,u=(dx*c+dz*s)/LAKE.rx,v=(-dx*s+dz*c)/LAKE.rz;return Math.hypot(u,v)+(fbm(x/1100+5,z/1100+2,3)-.5)*.4}
function Hnorth(x,z){const d=x-coastX(z);let h=d<0?-2.6+d*.03:-2.6+3.2*sm(0,70,d)+22*sm(0,1500,d)+sm(0,400,d)*((fbm(x/700+21,z/700+8,3)-.5)*10+sm(1500,3000,d)*((fbm(x/450+4,z/450+9,2)-.5)*30+6));   // pianura a 20-30 m: mai sotto il livello del mare
 const r=lakeR(x,z);if(r<1.45)h+=(4-h)*(1-sm(1,1.45,r))*(h>4?1:0);   // conca pianeggiante intorno al lago (spiagge e lungolago bassi)
 if(r<1.08){const hl=-3-32*sm(1,.55,r);h+=(hl-h)*(1-sm(1,1.08,r))}
 const dx=x-LAKE.x,dz=z-LAKE.z,dd=Math.hypot(dx,dz)||1,mt=sm(1.1,1.7,r)*(1-sm(2.6,3.6,r))*(sm(-.35,.45,dx/dd)+.7*sm(.2,.9,dz/dd));
 h+=Math.min(1,mt)*(140+420*fbm(x/1500+3,z/1500+7,4));
 h+=sm(27500,31000,z)*(120+300*fbm(x/1300+9,z/1300+1,3));return h}
function Hsouth(x,z){const d=x-coastX(z);let h=d<0?-2.6+d*.03:-2.6+3.2*sm(0,70,d)+22*sm(0,1200,d)+sm(0,400,d)*((fbm(x/600+13,z/600+4,3)-.5)*8+sm(1900,4000,d)*((fbm(x/420+8,z/420+2,2)-.5)*44+12));
 h+=sm(1900,5200,d)*(90+330*fbm(x/1600+5,z/1600+11,4));h+=sm(-24500,-27000,z)*(100+250*fbm(x/1200+2,z/1200+6,3));return h}
function Hraw(x,z){const tw=sm(2600,7000,x);let h=tw<=0?Hcoast(x,z):tw>=1?Hplain(x,z):Hcoast(x,z)*(1-tw)+Hplain(x,z)*tw;
 const tn=sm(5500,9500,z);if(tn>0)h=h*(1-tn)+Hnorth(x,z)*tn;const ts=sm(-5500,-9500,z);if(ts>0)h=h*(1-ts)+Hsouth(x,z)*ts;return h}
/* fiume */
const RVC=[[1250,-1120],[1120,-1010],[1040,-860],[900,-800],[800,-690],[690,-600],[600,-480],[450,-470],[330,-390],[210,-410],[100,-330],[-20,-340],[-130,-270],[-250,-280],[-340,-230],[-420,-205]];
const RV=[];
{for(let i=0;i<RVC.length-1;i++){const p0=RVC[Math.max(0,i-1)],p1=RVC[i],p2=RVC[i+1],p3=RVC[Math.min(RVC.length-1,i+2)],n=Math.ceil(Math.hypot(p2[0]-p1[0],p2[1]-p1[1])/30);
  for(let t=0;t<n;t++){const u=t/n,u2=u*u,u3=u2*u,f=(a,b,c,d)=>.5*(2*b+(-a+c)*u+(2*a-5*b+4*c-d)*u2+(-a+3*b-3*c+d)*u3);RV.push({x:f(p0[0],p1[0],p2[0],p3[0]),z:f(p0[1],p1[1],p2[1],p3[1])})}}
 RV.push({x:RVC[RVC.length-1][0],z:RVC[RVC.length-1][1]});
 let y=1e9;RV.forEach((p,i)=>{p.hw=11+10*Math.pow(i/RV.length,1.3);y=Math.min(y,Hraw(p.x,p.z)-1);p.y=Math.max(SEA+.35,y)})}
const RQ={d:0,hw:0,y:0};
const RIV=[{pts:RV,x0:-560,x1:1380,z0:-1260,z1:-120,m:70}];   // corsi d'acqua: fiume della città e, più avanti, i Navigli di Milano
function riverQ(x,z){let bd=1e18,ba=null,bb=null,bt=0,bm=70;
 for(const rv of RIV){if(x<rv.x0||x>rv.x1||z<rv.z0||z>rv.z1)continue;const P=rv.pts;for(let i=0;i<P.length-1;i++){const a=P[i],b=P[i+1],dx=b.x-a.x,dz=b.z-a.z,l2=dx*dx+dz*dz,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/l2)),px=a.x+dx*t-x,pz=a.z+dz*t-z,d2=px*px+pz*pz;if(d2<bd){bd=d2;ba=a;bb=b;bt=t;bm=rv.m}}}
 if(!ba)return false;RQ.d=Math.sqrt(bd);RQ.hw=ba.hw+(bb.hw-ba.hw)*bt;RQ.y=ba.y+(bb.y-ba.y)*bt;RQ.m=bm;return RQ.d<RQ.hw+bm}
const H0=Hraw(0,0);
/* paesi: Rivarolo (esistente) e, nei passi successivi, i paesi lungo l'autostrada */
const TOWNS=[{x:235,z:2150,R:700,name:'Rivarolo',zc:9,zh:8}];
let MWR=null,MILAN=null;   // autostrada e Milano (valorizzate dai generatori)
const TOWN=TOWNS[0];
const PADS=[{x:-1700,z:-1250,r0:100,r1:170},{x:-180,z:720,r0:72,r1:135},{x:900,z:500,r0:122,r1:170},{x:-1890,z:1500,r0:14,r1:38},{x:235,z:2150,r0:600,r1:900}];
function Hnr(x,z){let h=Hraw(x,z);const r=Math.hypot(x,z);h-=H0*(1-sm(250,950,r))*sm(60,230,x-coastX(z));h*=sm(110,330,r);return h}
function carve(x,z,h){if(riverQ(x,z)){const hb=RQ.y+.15,bed=RQ.y-2.4;if(RQ.d<RQ.hw)h=bed+(hb-bed)*Math.pow(RQ.d/RQ.hw,2);else{const w2=1-sm(RQ.hw,RQ.hw+RQ.m,RQ.d);h+=(Math.max(h,hb)-h)*w2}}return h}
function Hu(x,z){return carve(x,z,Hnr(x,z))}
for(const p of PADS)p.h=Hu(p.x,p.z);
const CORR=[];   // corridoi stradali spianati (autostrada): {ax:'x'|'z', f:u=>v, e:u=>quota, w:u=>peso, a0,a1, hw, sl}
const SPAD=[],SPH=new Map(),spk=(i,j)=>i+','+j;   // rilevati e trincee lungo singoli tratti (rampe, cavalcavia, piazzali): {ax,az,bx,bz,ya,yb,hw,sl}
function addPad(ax,az,bx,bz,ya,yb,hw,sl){const p={ax,az,bx,bz,ya,yb,hw,sl,len:Math.hypot(bx-ax,bz-az)};SPAD.push(p);const r=hw+sl,x0=Math.floor((Math.min(ax,bx)-r)/128),x1=Math.floor((Math.max(ax,bx)+r)/128),z0=Math.floor((Math.min(az,bz)-r)/128),z1=Math.floor((Math.max(az,bz)+r)/128);for(let i=x0;i<=x1;i++)for(let j=z0;j<=z1;j++){const k=spk(i,j);let a=SPH.get(k);if(!a)SPH.set(k,a=[]);a.push(p)}return p}
function Hbase(x,z){let h=Hnr(x,z);for(const p of PADS){const d=Math.hypot(x-p.x,z-p.z);if(d<p.r1){let w=1-sm(p.r0,p.r1,d);if(p.wm)w*=p.wm(x,z);h+=(p.h-h)*w}}return carve(x,z,h)}
function H(x,z){let h=Hbase(x,z);
 for(const c of CORR){if(c.curve){const B=c.curve.bb;if(x<B[0]||x>B[1]||z<B[2]||z>B[3])continue;const q=c.curve.proj(x,z,c.hw+c.sl);if(!q)continue;const d=Math.abs(q.d);if(d<c.hw+c.sl){const w=(1-sm(c.hw,c.hw+c.sl,d))*c.curve.w(q.s);h+=(c.curve.e(q.s)-h)*w}continue}const u=c.ax==='x'?x:z,v=c.ax==='x'?z:x;if(u<c.a0||u>c.a1)continue;const d=Math.abs(v-c.f(u));if(d<c.hw+c.sl){const w=(1-sm(c.hw,c.hw+c.sl,d))*(c.w?c.w(u):1);h+=(c.e(u)-h)*w}}
 const a=SPH.get(spk(Math.floor(x/128),Math.floor(z/128)));if(a)for(const p of a){const dx=p.bx-p.ax,dz=p.bz-p.az,l2=dx*dx+dz*dz||1;let t=((x-p.ax)*dx+(z-p.az)*dz)/l2;t=Math.max(0,Math.min(1,t));const d=Math.hypot(x-(p.ax+dx*t),z-(p.az+dz*t));if(d<p.hw+p.sl){const w=1-sm(p.hw,p.hw+p.sl,d);h+=(p.ya+(p.yb-p.ya)*t-h)*w}}
 return h}
const BR=[];
function deckProf(b){if(!b.dk){const N=Math.max(1,Math.ceil(b.len/4));b.dk=[];for(let i=0;i<=N;i++){const t=i/N,x=b.ax+(b.bx-b.ax)*t,z=b.az+(b.bz-b.az)*t,h=H(x,z),w=wy(x,z),e=.1+.35*Math.min(1,Math.min(t*b.len,(1-t)*b.len)/10);let y=Math.max(b.ya+(b.yb-b.ya)*t,h+e);if(h<w-.2)y=Math.max(y,w+.9);b.dk.push(y)}}return b.dk}
function deckAt(b,t){const d=deckProf(b),N=d.length-1,u=Math.max(0,Math.min(1,t))*N,i=Math.min(N-1,Math.floor(u)),f=u-i;return d[i]+(d[i+1]-d[i])*f}
/* quota di un impalcato nel punto (x,z): se è nota la quota attuale (yh) si sceglie l'impalcato solo quando è vicino a quella quota (cavalcavia sopra altre strade) */
function bridgeAt(x,z,yh){for(const b of BR){const dx=b.bx-b.ax,dz=b.bz-b.az,l2=dx*dx+dz*dz,t=((x-b.ax)*dx+(z-b.az)*dz)/l2;if(t<0||t>1)continue;const px=b.ax+dx*t-x,pz=b.az+dz*t-z;if(px*px+pz*pz<(b.w/2+.8)**2){const y=deckAt(b,t)+.06;if(b.over){if(yh!==undefined&&yh!==null){if(Math.abs(yh-y)>2.6)continue}else{const n=nearRoad(x,z,9,-9,-9,-9,-9);if(n&&!RS[n.id].br&&n.d<RS[n.id].w/2+.5)continue}}return y}}return null}
const wy=(x,z)=>riverQ(x,z)&&RQ.d<RQ.hw+1?RQ.y:SEA;
const wet=(x,z)=>H(x,z)<wy(x,z)-.2&&bridgeAt(x,z)===null;
const ground=(x,z,yh)=>{const b=bridgeAt(x,z,yh);return b!==null?b:H(x,z)+.06};
/* zone urbane: 0 centro storico, 1 porto, 2 lungomare, 3 industriale, 4 quartieri moderni, 5 colline, 6 periferia, 7 montagna, 8 paese-case, 9 paese-centro, 10-13 Milano, 14 campagna, 15 autostrada, 16-17 Como, 18-19 Genova */
const PZ=[-30,215];
function townAt(x,z){for(const t of TOWNS){const dt=Math.hypot(x-t.x,z-t.z);if(dt<t.R)return t}return null}
function zone(x,z){const t=townAt(x,z);if(t){const dt=Math.hypot(x-t.x,z-t.z);return dt+(fbm(x/150+7,z/150+3,2)-.5)*140<t.R*.3?t.zc:t.zh}
 if(MILAN&&MILAN.ready){const dx=x-MILAN.x,dz=z-MILAN.z,r=Math.hypot(dx,dz);if(r<MILAN.R[3]+60){const tw=MILAN.towers;if(tw&&Math.abs(x-tw.x)<tw.w/2&&Math.abs(z-tw.z)<tw.d/2)return 13;if(r<MILAN.R[1])return 10;if(r<MILAN.R[2])return 11;return 12}}
 for(const c of CITIES){if(!c.ready)continue;if(c.porto&&Math.hypot(x-c.porto.x,z-c.porto.z)<420)return 1;const r=Math.hypot(x-c.x,z-c.z);if(r<c.R[1]+60){if(c.water==='mare'&&x<coastX(z)+150)return c.porto&&Math.abs(z-c.porto.z)<330?1:2;if(r+(fbm(x/150+7,z/150+3,2)-.5)*140<c.R[0]+30)return c.zc;return c.zm}}
 if(MWS.length){const q=mwAt(x,z);if(q&&Math.abs(q.d)<70)return 15}
 if(x>2600||Math.abs(z)>5000){if(Math.abs(z)<=5000&&(x>3600||z>-500))return 14;const d=x-coastX(z);if(d<170&&d>-20&&Math.abs(z)>5000)return 2;const h=H(x,z);if(h>170)return 7;if(h>75&&Math.abs(z)>5000)return 5;return 14}
 const d=x-coastX(z),h=H(x,z),j=(fbm(x/260,z/260,2)-.5)*200;
 if(d<250&&d>-20&&z>-170&&z<430)return 1;if(d<170)return 2;if(Math.hypot(x-PZ[0],z-PZ[1])+j<430)return 0;
 if(x>430&&x<1400&&z>-950&&z<-230)return 3;if(h>170)return 7;if(h>75)return 5;if(Math.hypot(x-150,z-120)+j<1250)return 4;return 6}
/* riserve: dove le strade non passano (monumenti, piazze, luoghi speciali) e dove gli edifici non si costruiscono */
const RESX=[],RESF=[];   // rettangoli {x0,x1,z0,z1}, cerchi {x,z,r}, rettangoli ruotati {x,z,a,w,d} e funzioni (RESF) aggiunti dai generatori
const RES=(x,z)=>{if((x>-31&&x<33&&z>-70&&z<70)||Math.hypot(x-900,z-500)<115||Math.hypot(x+180,z-720)<72||Math.hypot(x+1700,z+1250)<105||Math.hypot(x+1890,z-1500)<16)return true;
 if(x>-62&&x<16&&z>248&&z<304)return true;            // Duomo e campanile
 if(Math.hypot(x-PZ[0],z-PZ[1])<12)return true;       // fontana della piazza
 for(const r of RESX){if(r.r!==undefined){if(Math.abs(x-r.x)<r.r&&Math.abs(z-r.z)<r.r&&Math.hypot(x-r.x,z-r.z)<r.r)return true}else if(r.a!==undefined){const R=(r.w+r.d)/2;if(Math.abs(x-r.x)>R||Math.abs(z-r.z)>R)continue;const c=Math.cos(r.a),sn=Math.sin(r.a),dx=x-r.x,dz=z-r.z;if(Math.abs(dx*c+dz*sn)<r.w/2&&Math.abs(-dx*sn+dz*c)<r.d/2)return true}else if(x>r.x0&&x<r.x1&&z>r.z0&&z<r.z1)return true}for(const f of RESF)if(f(x,z))return true;return false};
const RESBL=(cx,cz,bw,bd,c,s)=>{if(RESB(cx,cz))return true;for(const q of [[-1,-1],[1,-1],[1,1],[-1,1],[0,-1],[0,1],[-1,0],[1,0]])if(RESB(cx+q[0]*bw/2*c-q[1]*bd/2*s,cz+q[0]*bw/2*s+q[1]*bd/2*c))return true;return false};
const RESB=(x,z)=>(x>-27&&x<29&&z>-77&&z<77)||Math.hypot(x-PZ[0],z-PZ[1])<58||Math.hypot(x-900,z-500)<140||Math.hypot(x+180,z-720)<75||(x<-150&&x>-330&&z>-120&&z<330&&x<coastX(z)+330&&x>coastX(z)+8)||Math.hypot(x+1890,z-1500)<60||Math.hypot(x+1700,z+1250)<210||(x>-66&&x<20&&z>244&&z<308)||RES(x,z);
/* strade: crescita organica con griglia spaziale */
const RS=[],RC=new Map(),MAXS=60000;let NR=null;
const ck=(i,j)=>(i+200)*4000+j+200;
function reg(id){const s=RS[id],n=Math.max(1,Math.ceil(s.len/32)),seen=new Set();for(let t=0;t<=n;t++){const k=ck(Math.floor((s.ax+(s.bx-s.ax)*t/n)/64),Math.floor((s.az+(s.bz-s.az)*t/n)/64));if(!seen.has(k)){seen.add(k);let a=RC.get(k);if(!a)RC.set(k,a=[]);a.push(id)}}}
function addSeg(ax,az,bx,bz,w,k,br,ya,yb){if(Math.hypot(bx-ax,bz-az)<2)return RS.length-1;const id=RS.length;RS.push({ax,az,bx,bz,w,k,br:br?1:0,ya,yb,len:Math.hypot(bx-ax,bz-az)});reg(id);return id}
function nearRoad(x,z,r,e0,e1,f0,f1){let best=null,bd=r;const cx=Math.floor(x/64),cz=Math.floor(z/64),k=Math.ceil(r/64);
 for(let i=-k;i<=k;i++)for(let j=-k;j<=k;j++){const a=RC.get(ck(cx+i,cz+j));if(a)for(const id of a){if((id>=e0&&id<=e1)||(id>=f0&&id<=f1))continue;const s=RS[id];if(s.del)continue;const dx=s.bx-s.ax,dz=s.bz-s.az,l2=dx*dx+dz*dz,t=Math.max(0,Math.min(1,((x-s.ax)*dx+(z-s.az)*dz)/l2)),px=s.ax+dx*t,pz=s.az+dz*t,d=Math.hypot(x-px,z-pz);if(d<bd){bd=d;best={id,d,x:px,z:pz,t}}}}return best}
/* tipi di strada: 0 viale 13 m, 1 via 8,5 m, 2 vicolo 6 m, 3 strada rurale 5,5 m, 4 superstrada 15 m, 5 carreggiata autostradale 13,5 m (senso unico), 6 rampa 6 m (senso unico), 7 viale urbano 20 m, 8 varco di servizio 5 m, 9 via cittadina 10 m */
const KD=[{w:13,ds:36,turn:.05,gap:48,sl:.17,br:0,sp:.5,bridge:1},{w:8.5,ds:30,turn:.12,gap:34,sl:.17,br:.14,sp:0,bridge:0},{w:6,ds:22,turn:.3,gap:25,sl:.2,br:.16,sp:0,bridge:0},{w:5.5,ds:26,turn:.2,gap:27,sl:.17,br:.07,sp:0,bridge:0},{w:15,ds:44,turn:.03,gap:80,sl:.12,br:0,sp:0,bridge:1},
 {w:13.5,ds:60,turn:.01,gap:60,sl:.06,br:0,sp:0,bridge:1},{w:6,ds:20,turn:.2,gap:20,sl:.1,br:0,sp:0,bridge:0},{w:20,ds:50,turn:.03,gap:60,sl:.1,br:0,sp:.3,bridge:1},{w:5,ds:20,turn:0,gap:10,sl:.1,br:0,sp:0,bridge:0},{w:10,ds:34,turn:.06,gap:40,sl:.14,br:.1,sp:0,bridge:0}];
const Q=[];
function walker(x,z,a,len,k,wp,ex0,ex1,gen){const p=KD[k];return{x,z,a,len,k,wp,ex0:ex0===undefined?-9:ex0,ex1:ex1===undefined?-9:ex1,gen:gen||0,ds:p.ds,turn:p.turn,gap:p.gap,sl:p.sl,wd:p.w,h:H(x,z),last:-9}}
function chk(w,x,z,e0,e1){if(!inside(x,z,100)||!walkOK(x,z))return 0;const h=H(x,z);if(h<SEA+1.3)return 0;if(riverQ(x,z)&&RQ.d<RQ.hw+10)return 3;if(Math.abs(h-w.h)>w.ds*w.sl)return 0;if(RES(x,z)||RES((w.x+x)/2,(w.z+z)/2))return 0;
 const n=nearRoad(x,z,w.gap,e0,e1,w.ex0,w.ex1);if(n){NR=n;return 2}return 1}
function tryBridge(w,aa){const sx=Math.sin(aa),sz=Math.cos(aa);for(let t=w.ds;t<=210;t+=10){const x=w.x+sx*t,z=w.z+sz*t;if(!(riverQ(x,z)&&RQ.d<RQ.hw+12)){if(H(x,z)>SEA+1.3&&!RES(x,z)&&!nearRoad(x,z,20,-9,-9,-9,-9)&&Math.abs(H(x,z)-w.h)<7&&BR.every(b=>Math.hypot((b.ax+b.bx)/2-(w.x+x)/2,(b.az+b.bz)/2-(w.z+z)/2)>18)){const id=addSeg(w.x,w.z,x,z,w.wd,w.k,1,H(w.x,w.z)+.1,H(x,z)+.1);BR.push(RS[id]);w.x=x;w.z=z;w.a=aa;w.h=H(x,z);w.len-=t;w.last=id;return true}return false}}return false}
const zk=(x,z)=>{const q=zone(x,z);return q===0||q===1||q===9?2:q===5||q===7?3:1};
function branch(w,id){const p=KD[w.k];
 if(p.sp&&rnd()<p.sp)for(const sd of [1,-1])if(rnd()<.8){const k=zk(w.x,w.z),a=w.a+sd*(1.45+rnd()*.3);Q.push(walker(w.x,w.z,a,k===2?110+rnd()*220:k===3?150+rnd()*260:200+rnd()*520,k,null,id-2,id+1,1))}
 if(p.br&&w.gen<3&&rnd()<p.br)for(const sd of [1,-1])if(rnd()<.55){const a=w.a+sd*(1.35+rnd()*.4);Q.push(walker(w.x,w.z,a,w.len*(.3+rnd()*.4)+60,w.k,null,id-2,id+1,w.gen+1))}}
function grow(w){while(w.len>0&&RS.length<MAXS){let a=w.a;
  if(w.wp&&w.wp.length){const t=w.wp[0],dx=t[0]-w.x,dz=t[1]-w.z;if(dx*dx+dz*dz<(w.ds*1.7)**2){w.wp.shift();continue}let da=Math.atan2(dx,dz)-a;da=Math.atan2(Math.sin(da),Math.cos(da));a+=Math.max(-.45,Math.min(.45,da))}else a+=(rnd()-.5)*2*w.turn;
  let done=false;
  for(let tr=0;tr<9&&!done;tr++){const aa=a+(tr?((tr&1)?1:-1)*((tr+1)>>1)*.28:0),nx=w.x+Math.sin(aa)*w.ds,nz=w.z+Math.cos(aa)*w.ds,c=chk(w,nx,nz,w.last-3,w.last);
   if(c===1){const id=addSeg(w.x,w.z,nx,nz,w.wd,w.k);w.last=id;w.x=nx;w.z=nz;w.a=aa;w.h=H(nx,nz);w.len-=w.ds;done=true;branch(w,id)}
   else if(c===2&&(w.k===0||w.k===4)&&Math.abs(Math.sin(aa-Math.atan2(RS[NR.id].bx-RS[NR.id].ax,RS[NR.id].bz-RS[NR.id].az)))>.55){const id=addSeg(w.x,w.z,nx,nz,w.wd,w.k);w.last=id;w.x=nx;w.z=nz;w.a=aa;w.h=H(nx,nz);w.len-=w.ds;done=true;branch(w,id)}
   else if(c===2&&w.k!==0&&w.k!==4&&NR.d>w.gap*.3){const q=NR;if(Math.hypot(q.x-w.x,q.z-w.z)<w.ds*1.6&&Math.abs(H(q.x,q.z)-w.h)<w.ds*w.sl){addSeg(w.x,w.z,q.x,q.z,w.wd,w.k);w.len=0;done=true}}
   else if(c===3&&KD[w.k].bridge&&tryBridge(w,aa))done=true}
  if(!done)break}}
function fromRoad(x,z,a,len,k,wp){const n=nearRoad(x,z,120,-9,-9,-9,-9);if(!n)return;const w=walker(n.x,n.z,a,len,k,wp,n.id-3,n.id+3,0);grow(w)}
/* generatore di paese: anello, corso alberato e raggi (usato per Rivarolo e per i paesi lungo l'autostrada) */
function planTown(t){const TX=t.x,TZ=t.z,R=t.R,rr=R*.6;
 // l'anello parte dal punto in cui la strada d'arrivo (casello, arteria) taglia il cerchio: cerco l'angolo con una strada vicina (da sud, se c'è)
 let th0=0;if(!nearRoad(TX,TZ-rr,120,-9,-9,-9,-9)){let bd=1e9;for(let k=0;k<36;k++){const th=k*Math.PI/18,n=nearRoad(TX+rr*Math.sin(th),TZ-rr*Math.cos(th),120,-9,-9,-9,-9);if(n&&n.d<bd){bd=n.d;th0=th}}}
 for(const sd of [1,-1]){const wp=[];for(let f=0;f<=172;f+=14){const a=f*Math.PI/180,r=rr+30*Math.sin(f*.08+(sd>0?0:2)),aa=sd*a+th0;wp.push([TX+r*Math.sin(aa),TZ-r*Math.cos(aa)])}fromRoad(wp[0][0],wp[0][1],Math.PI/2-th0+(sd>0?0:Math.PI),2800,1,wp.slice(1))}
 const n0=RS.length;for(const sd of [1,-1])fromRoad(TX,TZ+4,sd*Math.PI/2,900,1,[[TX+sd*rr*.52,TZ+10],[TX+sd*(rr+50),TZ-4]]);for(let i=n0;i<RS.length;i++)RS[i].av=1;
 for(const f of [35,80,125,-35,-80,-125]){const fr=f*Math.PI/180,ex=TX+(rr+10)*Math.sin(fr),ez=TZ+(rr+10)*Math.cos(fr);fromRoad(ex,ez,Math.atan2(TX-ex,TZ-ez),900,1,[[TX+(ex-TX)*.55,TZ+(ez-TZ)*.55],[TX+(ex-TX)*.18,TZ+(ez-TZ)*.18]])}}
function plan(){
 const run=(k,x,z,a,len,wp)=>grow(walker(x,z,a,len,k,wp));
 // arteria nord e sud a partire dalla vecchia via
 run(0,0,66,0,3600,[[-20,200],[60,430],[-40,780],[40,1150],[240,1600],[200,2100],[320,2650]]);
 run(0,0,-66,Math.PI,3600,[[0,-250],[10,-370],[-60,-700],[-110,-1100],[150,-1700],[380,-2300],[330,-2800]]);
 // lungomare
 {const wp=[];for(let z=-1250;z<=1350;z+=130)wp.push([coastX(z)+95,z]);run(0,wp[0][0],wp[0][1],0,9000,wp.slice(1))}
 // circonvallazione intorno al centro
 {const wp=[];for(let f=105;f>=-105;f-=9){const r=950+110*Math.sin(2*f*Math.PI/180+.5)+70*Math.sin(5*f*Math.PI/180);wp.push([150+r*Math.cos(f*Math.PI/180),120+r*Math.sin(f*Math.PI/180)])}run(0,wp[0][0],wp[0][1],-1.2,9000,wp.slice(1))}
 // raggi dal centro verso l'anello
 for(const f of [30,62,-25,-62,100]){const fr=f*Math.PI/180,ex=150+940*Math.cos(fr),ez=120+940*Math.sin(fr),a=Math.atan2(PZ[0]-ex,PZ[1]-ez);fromRoad(ex,ez,a,1500,0,[[PZ[0]+(ex-PZ[0])*.45+50*Math.sin(f),PZ[1]+(ez-PZ[1])*.45],[PZ[0]+(ex-PZ[0])*.12,PZ[1]+(ez-PZ[1])*.12]])}
 // superstrada a est e raccordo
 run(4,1500,2850,Math.PI,6500,[[1380,2200],[1620,1500],[1560,700],[1650,0],[1560,-700]]);
 fromRoad(1560,700,-Math.PI/2,1000,0,[[1100,520],[900,560]]);
 // strade lungo le sponde del fiume
 for(const sd of [1,-1]){const wp=[];for(let i=RV.length-2;i>=0;i-=3){const a=RV[i],b=RV[i+1],dx=b.x-a.x,dz=b.z-a.z,l=Math.hypot(dx,dz),o=(a.hw+34)*sd;wp.push([a.x-dz/l*o,a.z+dx/l*o])}run(0,wp[0][0],wp[0][1],Math.PI,4000,wp.slice(1))}
 // strada del faro e strada del vulcano
 {const wp=[];for(let z=1350;z<=1480;z+=40)wp.push([coastX(z)+80,z]);wp.push([-1800,1480]);run(3,coastX(1330)+90,1330,-1.6,1800,wp)}
 run(3,1180,-690,.9,2200,[[1430,-960],[1480,-1230],[1700,-1440]]);
 // Rivarolo: circonvallazione, corso alberato e raggi
 planTown(TOWN);
 // vicoli del centro storico
 for(let i=0;i<18;i++){const a=i/18*Math.PI*2+rnd()*.3;Q.push(walker(PZ[0]+Math.sin(a)*64,PZ[1]+Math.cos(a)*64,a,300+rnd()*300,2,null,-9,-9,0))}
 while(Q.length&&RS.length<MAXS)grow(Q.shift());
 // infittimento: nuove strade laterali dove la città è più fitta
 for(const p of [.11,.08,.06]){const n=RS.length;for(let id=0;id<n&&RS.length<MAXS;id++){const s=RS[id];if(s.br||s.k>1||rnd()>p)continue;const mx=(s.ax+s.bx)/2,mz=(s.az+s.bz)/2,zn=zone(mx,mz);if((zn===6||zn===7||zn===3)&&rnd()>.3)continue;
   const k=zk(mx,mz),a=Math.atan2(s.bx-s.ax,s.bz-s.az)+(rnd()<.5?1:-1)*(1.45+rnd()*.3);Q.push(walker(mx,mz,a,k===2?100+rnd()*220:220+rnd()*600,k,null,id-3,id+3,1))}
  while(Q.length&&RS.length<MAXS)grow(Q.shift())}}
/* ---- correzione della rete: incroci con nodo, fondi ciechi collegati o potati ---- */
const TERM=[];   // punti dove una strada può finire (destinazioni): {x,z,r}
const nk=(x,z)=>Math.round(x*4)+','+Math.round(z*4);
function segInter(a,b){const d1x=a.bx-a.ax,d1z=a.bz-a.az,d2x=b.bx-b.ax,d2z=b.bz-b.az,den=d1x*d2z-d1z*d2x;if(Math.abs(den)<1e-9)return null;const ex=b.ax-a.ax,ez=b.az-a.az,t=(ex*d2z-ez*d2x)/den,u=(ex*d1z-ez*d1x)/den;if(t<=0||t>=1||u<=0||u>=1)return null;return{t,u,x:a.ax+d1x*t,z:a.az+d1z*t}}
/* le strade che si incrociano senza un nodo comune vengono spezzate nel punto di incrocio (altrimenti l'incrocio non è percorribile) */
function splitCrossings(){let n=0;for(let pass=0;pass<3;pass++){let did=0;const N=RS.length;
 for(let i=0;i<N;i++){const a=RS[i];if(a.del||a.br)continue;const cx0=Math.floor(Math.min(a.ax,a.bx)/64),cx1=Math.floor(Math.max(a.ax,a.bx)/64),cz0=Math.floor(Math.min(a.az,a.bz)/64),cz1=Math.floor(Math.max(a.az,a.bz)/64);const seen=new Set();
  for(let gx=cx0;gx<=cx1;gx++)for(let gz=cz0;gz<=cz1;gz++){const arr=RC.get(ck(gx,gz));if(!arr)continue;for(const j of arr){if(j<=i||seen.has(j))continue;seen.add(j);const b=RS[j];if(b.del||b.br)continue;
   const q=segInter(a,b);if(!q)continue;const dot=Math.abs((a.bx-a.ax)*(b.bx-b.ax)+(a.bz-a.az)*(b.bz-b.az))/(a.len*b.len);
   let ta=q.t*a.len,tb=q.u*b.len,x=q.x,z=q.z;
   const ea=ta<.6||a.len-ta<.6,eb=tb<.6||b.len-tb<.6;if(ea||eb&&dot>.94)continue;   // nodo già condiviso o innesto a T (errore di arrotondamento)
   if(dot>.94&&!(dot<.985&&a.nm&&b.nm&&!a.mw&&!b.mw)){const rk=q=>(q.ring||q.radial!==undefined||q.mw||q.ss||q.ramp||q.ap?3:q.k===0||q.k===7||q.k===4?2:1);const ra=rk(a),rb=rk(b);(ra!==rb?(ra<rb?a:b):(a.len<=b.len?a:b)).del=1;did++;continue}   // quasi paralleli: doppione cancellato; ma due strade esplicite con nome che si incrociano sotto i 20° (passeggiata e tangenziale) ricevono un nodo
   if(ea){ta=-1}else if(ta<3||a.len-ta<3){const ex=ta<3?a.ax:a.bx,ez=ta<3?a.az:a.bz;moveNode(ex,ez,x,z);ta=-1}
   if(eb){tb=-1}else if(tb<3||b.len-tb<3){const ex=tb<3?b.ax:b.bx,ez=tb<3?b.az:b.bz;moveNode(ex,ez,x,z);tb=-1}
   if(ta>=3)splitAt(i,x,z);if(tb>=3)splitAt(j,x,z);did++}}}
 n+=did;if(!did)break}return n}
/* sposta un nodo (tutti gli estremi di strada che vi coincidono) in un nuovo punto */
function moveNode(x0,z0,x1,z1){const cx=Math.floor(x0/64),cz=Math.floor(z0/64),seen=new Set();for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){const arr=RC.get(ck(cx+i,cz+j));if(!arr)continue;for(const id of arr){if(seen.has(id))continue;seen.add(id);const s=RS[id];if(s.del)continue;let ch=false;if(Math.hypot(s.ax-x0,s.az-z0)<.3){s.ax=x1;s.az=z1;ch=true}if(Math.hypot(s.bx-x0,s.bz-z0)<.3){s.bx=x1;s.bz=z1;ch=true}if(ch){s.len=Math.hypot(s.bx-s.ax,s.bz-s.az);reg(id)}}}}
const SEGF=['av','arc','ow','mw','nm','ramp','pol','ss','sa','side','tp','lanes','ap','ring','radial','via','tn','over','ca','cb','icn'];
function splitAt(id,x,z){const s=RS[id],k=s.k;const n1=addSeg(x,z,s.bx,s.bz,s.w,k);const n=RS[n1];for(const f of SEGF)if(s[f]!==undefined)n[f]=s[f];if(s.gapB!==undefined){n.gapB=s.gapB;delete s.gapB}if(s.vgB!==undefined){n.vgB=s.vgB;delete s.vgB}s.bx=x;s.bz=z;s.len=Math.hypot(s.bx-s.ax,s.bz-s.az);reg(id)}
function degMap(){const deg=new Map();for(const s of RS){if(s.del)continue;for(const e of [[s.ax,s.az],[s.bx,s.bz]]){const k=nk(e[0],e[1]);deg.set(k,(deg.get(k)||0)+1)}}return deg}
function isTerm(x,z){if(!inside(x,z,140))return true;for(const t of TERM)if(Math.hypot(x-t.x,z-t.z)<t.r)return true;return false}
/* estremi liberi: prolungamento fino alla strada più vicina (anche con lieve deviazione) oppure potatura del tratto */
/* estremo di un'altra strada appoggiato all'interno del tratto id (innesto a T senza nodo): restituisce il punto più lontano dall'estremo libero */
function tJoinOn(id,side){const s=RS[id],cx0=Math.floor(Math.min(s.ax,s.bx)/64)-1,cx1=Math.floor(Math.max(s.ax,s.bx)/64)+1,cz0=Math.floor(Math.min(s.az,s.bz)/64)-1,cz1=Math.floor(Math.max(s.az,s.bz)/64)+1,dx=s.bx-s.ax,dz=s.bz-s.az,l2=dx*dx+dz*dz||1,seen=new Set();let best=null;
 for(let gx=cx0;gx<=cx1;gx++)for(let gz=cz0;gz<=cz1;gz++){const arr=RC.get(ck(gx,gz));if(!arr)continue;for(const j of arr){if(j===id||seen.has(j))continue;seen.add(j);const q=RS[j];if(q.del)continue;for(const e of [[q.ax,q.az],[q.bx,q.bz]]){const t=((e[0]-s.ax)*dx+(e[1]-s.az)*dz)/l2;if(t<=.02||t>=.98)continue;const px=s.ax+dx*t,pz=s.az+dz*t;if(Math.hypot(px-e[0],pz-e[1])>2.5)continue;if(!best||(side?t>best.t:t<best.t))best={x:e[0],z:e[1],t}}}}return best}
function fixDeadEnds(){let joined=0,pruned=0,snapped=0;const okK=new Set(),deg=degMap();
 for(let pass=0;pass<40;pass++){let did=0;
  for(let id=0;id<RS.length;id++){const s=RS[id];if(s.del||s.br||s.ow)continue;
   for(const side of [0,1]){const px=side?s.bx:s.ax,pz=side?s.bz:s.az,kk=nk(px,pz);if(okK.has(kk))continue;if(deg.get(kk)>1){okK.add(kk);continue}
    if(isTerm(px,pz)){okK.add(kk);continue}
    const near=nearRoad(px,pz,2.5,id,id,-9,-9);if(near&&near.t>.016&&near.t<.984){okK.add(kk);continue}   // innesto a T già esistente (riconosciuto dalla navigazione)
    const ox=side?s.ax:s.bx,oz=side?s.az:s.bz,L=Math.hypot(px-ox,pz-oz),ux=(px-ox)/L,uz=(pz-oz)/L,a0=Math.atan2(ux,uz),hp=H(px,pz);let done=false,hit=null;
    // estremo quasi coincidente con un altro nodo o tracciato: lo aggancio spostando l'estremo
    {const n=nearRoad(px,pz,3.5,id,id,-9,-9);if(n&&!RS[n.id].ow&&!RS[n.id].mw&&!RS[n.id].pol){const q=RS[n.id];hit=n.t<.04?{x:q.ax,z:q.az,snap:1}:n.t>.96?{x:q.bx,z:q.bz,snap:1}:{x:n.x,z:n.z,snap:1}}}
    if(!hit)for(const da of [0,.35,-.35,.7,-.7,1.05,-1.05]){const a=a0+da,sx=Math.sin(a),sz=Math.cos(a);
     for(let t=6;t<=230&&!hit;t+=5){const x=px+sx*t,z=pz+sz*t;if(!inside(x,z,100)||RES(x,z))break;if((t/5)%3===0){const hx=H(x,z);if(hx<SEA+1.3||(riverQ(x,z)&&RQ.d<RQ.hw+10)||Math.abs(hx-hp)>Math.max(1.5,t*.12))break}const n=nearRoad(x,z,s.w/2+3,id,id,-9,-9);if(n){const q=RS[n.id];if(q.ow||q.mw||q.pol||q.br)break;if(n.t<.04||n.t>.96){const ex=n.t<.5?q.ax:q.bx,ez=n.t<.5?q.az:q.bz;hit={x:ex,z:ez,t}}else hit={x:n.x,z:n.z,t}}}
     if(hit)break}
    if(hit){const dd=Math.hypot(hit.x-px,hit.z-pz);
     if(dd<2.5||hit.snap){if(side){s.bx=hit.x;s.bz=hit.z}else{s.ax=hit.x;s.az=hit.z}s.len=Math.hypot(s.bx-s.ax,s.bz-s.az);reg(id);snapped++;did++;done=true;deg.set(nk(px,pz),(deg.get(nk(px,pz))||0)-1);deg.set(nk(hit.x,hit.z),(deg.get(nk(hit.x,hit.z))||0)+1)}
     else{addSeg(px,pz,hit.x,hit.z,s.w,s.k);joined++;did++;done=true;deg.set(nk(px,pz),(deg.get(nk(px,pz))||0)+1);deg.set(nk(hit.x,hit.z),(deg.get(nk(hit.x,hit.z))||0)+1)}}
    if(!done){const tj=tJoinOn(id,side);if(tj){if(side){s.bx=tj.x;s.bz=tj.z}else{s.ax=tj.x;s.az=tj.z}s.len=Math.hypot(s.bx-s.ax,s.bz-s.az);reg(id);deg.set(nk(px,pz),(deg.get(nk(px,pz))||0)-1);deg.set(nk(tj.x,tj.z),(deg.get(nk(tj.x,tj.z))||0)+1);okK.add(nk(tj.x,tj.z));snapped++;did++;break}
     s.del=1;pruned++;did++;deg.set(nk(px,pz),(deg.get(nk(px,pz))||0)-1);deg.set(nk(ox,oz),(deg.get(nk(ox,oz))||0)-1);okK.delete(nk(ox,oz));break}}}
  if(!did)break}
 return{joined,pruned,snapped}}
function compact(){const keep=RS.filter(s=>!s.del&&s.len>=2);RS.length=0;for(const s of keep)RS.push(s);RC.clear();for(let i=0;i<RS.length;i++)reg(i);BR.length=0;for(const s of RS)if(s.br)BR.push(s)}
/*@MWALIGN@*/
{const t0=Date.now();plan();tmark('plan',t0)}
{const t0=Date.now();
/*@MOTORWAY@*/
tmark('mw',t0)}
{const t0=Date.now();
/*@MILAN@*/
tmark('milan',t0)}
{const t0=Date.now();
/*@CITIES@*/
tmark('cities',t0)}
TERM.push({x:-1890,z:1500,r:70},{x:-1700,z:-1250,r:230},{x:900,z:500,r:150},{x:1700,z:-1440,r:60},{x:-500,z:100,r:160});
const NETFIX={cross:0,joined:0,pruned:0,snapped:0,rounds:0};
/* tratti lunghi spezzati in pezzi ≤ 90 m: le tabelle per blocco (SCH) e le ricerche di prossimità assumono tratti corti */
function splitLong(){const N=RS.length;for(let i=0;i<N;i++){const s=RS[i];if(s.del||s.len<=90)continue;const n=Math.ceil(s.len/90),pts=[];for(let k=0;k<=n;k++)pts.push([s.ax+(s.bx-s.ax)*k/n,s.az+(s.bz-s.az)*k/n]);const keep={};for(const f of ['av','arc','ow','mw','nm','ramp','pol','ss','sa','side','tp','lanes','ap','ring','radial','gapA','gapB','vgA','vgB','via','tn','over','ca','cb','icn'])if(s[f]!==undefined)keep[f]=s[f];
 for(let k=1;k<n;k++){const id=addSeg(pts[k][0],pts[k][1],pts[k+1][0],pts[k+1][1],s.w,s.k,s.br,s.ya!==undefined?s.ya+(s.yb-s.ya)*k/n:undefined,s.yb!==undefined?s.ya+(s.yb-s.ya)*(k+1)/n:undefined);const q=RS[id];Object.assign(q,keep);if(k>0)delete q.gapA,delete q.vgA;if(k<n-1)delete q.gapB,delete q.vgB;if(s.br)BR.push(q);if(s.mw&&MWR){const arr=MWR.segs[s.side];if(arr)arr.push(q)}}
 s.bx=pts[1][0];s.bz=pts[1][1];s.len=Math.hypot(s.bx-s.ax,s.bz-s.az);if(s.yb!==undefined)s.yb=s.ya+(s.yb-s.ya)/n;delete s.gapB;delete s.vgB;reg(i)}}
function netfix(){for(let r=0;r<5;r++){let t0=Date.now();const c=splitCrossings();tmark('cross',t0);t0=Date.now();const f=fixDeadEnds();tmark('fix',t0);NETFIX.cross+=c;NETFIX.joined+=f.joined;NETFIX.pruned+=f.pruned;NETFIX.snapped+=f.snapped;NETFIX.rounds++;NETFIX.log=(NETFIX.log||[]).concat([[c,f.joined,f.pruned,f.snapped]]);if(!c&&!f.joined&&!f.pruned&&!f.snapped)break}compact();splitLong();compact()}
splitLong();netfix();
/* occupazione del terreno (tasselli a 2 m, allocati solo dove servono) e lotti edificabili */
const OS=2,OT=64,OGT=new Map();let ogK=-1,ogA=null;   // tasselli 64×64 celle (128 m), chiave numerica, ultimo tassello in cache
const ogTile=(tx,tz,make)=>{const k=(tx+200)*16384+(tz+200);if(k===ogK)return ogA;let t=OGT.get(k);if(!t&&make)OGT.set(k,t=new Uint8Array(OT*OT));if(t){ogK=k;ogA=t}return t||null};
const ogi=(ix,iz)=>{const t=ogTile(ix>>6,iz>>6,false);return t?t[(iz&63)*OT+(ix&63)]:0};
const og=(x,z)=>ogi(Math.floor((x+WS)/OS),Math.floor((z+WS)/OS));
const ogSet=(x,z,v)=>{const ix=Math.floor((x+WS)/OS),iz=Math.floor((z+WS)/OS);ogTile(ix>>6,iz>>6,true)[(iz&63)*OT+(ix&63)]=v};
const ogSetI=(ix,iz,v)=>{ogTile(ix>>6,iz>>6,true)[(iz&63)*OT+(ix&63)]=v};
function markRoads(only){for(const s of RS){if(only&&!only(s))continue;const r=s.w/2+1.1,r2=r*r,x0=Math.floor((Math.min(s.ax,s.bx)-r+WS)/OS),x1=Math.floor((Math.max(s.ax,s.bx)+r+WS)/OS),z0=Math.floor((Math.min(s.az,s.bz)-r+WS)/OS),z1=Math.floor((Math.max(s.az,s.bz)+r+WS)/OS),dx=s.bx-s.ax,dz=s.bz-s.az,l2=dx*dx+dz*dz||1;
 for(let iz=z0;iz<=z1;iz++){const z=(iz+.5)*OS-WS;for(let ix=x0;ix<=x1;ix++){const x=(ix+.5)*OS-WS;let t=((x-s.ax)*dx+(z-s.az)*dz)/l2;t=t<0?0:t>1?1:t;const px=s.ax+dx*t-x,pz=s.az+dz*t-z;if(px*px+pz*pz<=r2)ogSetI(ix,iz,1)}}}}
{const t0=Date.now();markRoads(s=>{const mx=(s.ax+s.bx)/2,mz=(s.az+s.bz)/2;for(const t of TOWNS)if(Math.hypot(mx-t.x,mz-t.z)<t.R+120)return true;return false});tmark('og',t0)}
const ZP=[{w0:8,w1:15,d0:8,d1:13,sw:3,gap:0,fl0:3,fl1:6,inf:.25,roof:[.2,.9,.9,1],pal:0},{w0:24,d0:18,w1:60,d1:30,sw:7,gap:5,fl0:1,fl1:2,inf:2,roof:[.2,.2,.2,1],pal:2},{w0:18,w1:32,d0:20,d1:28,sw:6,gap:5,fl0:5,fl1:8,inf:2,roof:[.8,.8,.8,.8],pal:1},{w0:30,w1:80,d0:24,d1:50,sw:9,gap:8,fl0:1,fl1:2,inf:2.5,roof:[.4,.4,.4,1],pal:2},{w0:16,w1:30,d0:14,d1:24,sw:7,gap:8,fl0:4,fl1:8,inf:2,roof:[.7,.7,.7,.85],pal:1},{w0:9,w1:15,d0:9,d1:14,sw:9,gap:14,fl0:1,fl1:2,inf:2,roof:[0,.35,1,1],pal:0},{w0:10,w1:22,d0:8,d1:14,sw:22,gap:90,fl0:1,fl1:2,inf:3,roof:[0,.1,1,1],pal:0},{w0:8,w1:12,d0:8,d1:11,sw:20,gap:120,fl0:1,fl1:2,inf:3,roof:[0,.05,1,1],pal:0},{w0:8,w1:12,d0:8,d1:11.5,sw:3.4,gap:1.4,fl0:1,fl1:3,inf:1.1,roof:[0,.8,.95,1],pal:3},{w0:7,w1:13,d0:10,d1:15,sw:3.7,gap:0,fl0:2,fl1:4,inf:.25,roof:[.04,.8,.92,1],pal:0}];
ZP[14]={w0:10,w1:22,d0:8,d1:16,sw:20,gap:160,fl0:1,fl1:2,inf:3,roof:[0,.1,1,1],pal:0};
ZP[10]={w0:16,w1:34,d0:14,d1:24,sw:3.6,gap:0,fl0:5,fl1:8,inf:.25,roof:[.55,.9,.9,1],pal:4};
ZP[11]={w0:14,w1:30,d0:13,d1:22,sw:4,gap:1,fl0:4,fl1:7,inf:.6,roof:[.5,.9,.95,1],pal:4};
ZP[12]={w0:12,w1:30,d0:11,d1:20,sw:5,gap:6,fl0:2,fl1:5,inf:1.5,roof:[.5,.8,.95,1],pal:1};
ZP[13]={w0:28,w1:46,d0:28,d1:46,sw:9,gap:16,fl0:14,fl1:44,inf:4,roof:[1,1,1,1],pal:2};
ZP[16]={w0:9,w1:16,d0:9,d1:14,sw:3,gap:0,fl0:3,fl1:5,inf:.25,roof:[.15,.9,.9,1],pal:3};
ZP[17]={w0:15,w1:30,d0:13,d1:24,sw:6,gap:7,fl0:3,fl1:6,inf:2,roof:[.55,.8,.8,.9],pal:1};
ZP[18]={w0:8,w1:14,d0:9,d1:14,sw:3,gap:0,fl0:5,fl1:8,inf:.25,roof:[.3,.95,.95,1],pal:5};
ZP[19]={w0:15,w1:28,d0:13,d1:22,sw:6,gap:6,fl0:4,fl1:8,inf:2,roof:[.65,.85,.85,.9],pal:5};
const PAL=[[0xe8c87a,0xd9a27a,0xe9d9b5,0xd98c7a,0xc9a46a,0xb8c8a0,0xe0b79a,0xd6c28a],[0xf0ece2,0xe6dcc8,0xd9d4c8,0xc9d6dc,0xe8e0d0,0xdad0be,0xcfd8d4,0xf2e8d8],[0x8b97a3,0xa8a29a,0x9a6a58,0x7d8c7a,0x8a8f98,0xb0a090,0x6f7f8f,0x9c8878],[0xf0d9a8,0xe8c4a0,0xf3e6c8,0xe9b8a0,0xd9c9a0,0xf1e0b8,0xc9d6b0,0xf4efe2,0xe3c07a,0xd8a8a0,0xe6c9b8,0xf0e4d0],[0xd9c7a3,0xc9b899,0xe3d4b4,0xb8a88a,0xd6ccb8,0xa89f8d,0xcfbfa5,0xe8dcc6,0xc98f6a,0xd8b48a],[0xe8b86a,0xd98c6a,0xe9d2a5,0xd97a6a,0xc9a46a,0xe0b79a,0xf0c8a0,0xd6b08a,0xe3a070,0xc9856a]];
const B_=[];
function wetLot(cx,cz,w,d,c,s){for(const q of [[-1,-1],[1,-1],[1,1],[-1,1],[0,0],[0,-1],[0,1],[-1,0],[1,0]]){const x=cx+q[0]*w/2*c-q[1]*d/2*s,z=cz+q[0]*w/2*s+q[1]*d/2*c;if(H(x,z)<wy(x,z)+1||(riverQ(x,z)&&RQ.d<RQ.hw+3))return true}return false}
function lotFree(cx,cz,w,d,c,s,inf){const nx=Math.max(1,Math.ceil((w+inf*2)/OS)),nz=Math.max(1,Math.ceil((d+inf*2)/OS));for(let i=0;i<=nx;i++)for(let j=0;j<=nz;j++){const lx=-w/2-inf+(w+inf*2)*i/nx,lz=-d/2-inf+(d+inf*2)*j/nz,x=cx+lx*c-lz*s,z=cz+lx*s+lz*c;if(!inside(x,z,60))return false;if(og(x,z))return false}return true}
function markLot(cx,cz,w,d,c,s,inf){const nx=Math.max(1,Math.ceil((w+inf*2)/2)),nz=Math.max(1,Math.ceil((d+inf*2)/2));for(let i=0;i<=nx;i++)for(let j=0;j<=nz;j++){const lx=-w/2-inf+(w+inf*2)*i/nx,lz=-d/2-inf+(d+inf*2)*j/nz;ogSet(cx+lx*c-lz*s,cz+lx*s+lz*c,2)}}
function fillTown(t){const P=ZP[8];for(let gz=-t.R;gz<=t.R;gz+=11)for(let gx=-t.R;gx<=t.R;gx+=11){const x=t.x+gx+(hsh(gx,gz)-.5)*6,z=t.z+gz+(hsh(gz+5,gx)-.5)*6;if(Math.hypot(x-t.x,z-t.z)>t.R-40)continue;const zn=zone(x,z);if(zn!==8&&zn!==9)continue;if(hsh(gx+3,gz+7)>.92)continue;
  const nr=nearRoad(x,z,60,-9,-9,-9,-9);if(!nr)continue;const sg=RS[nr.id],ang=Math.atan2(sg.bz-sg.az,sg.bx-sg.ax)+(hsh(gx,gz+9)-.5)*.3,bw=7.5+hsh(gx+1,gz+2)*4,bd=7.5+hsh(gx+4,gz+1)*3,c=Math.cos(ang),s=Math.sin(ang);
  if(!lotFree(x,z,bw,bd,c,s,1)||RESBL(x,z,bw,bd,c,s)||wetLot(x,z,bw,bd,c,s))continue;markLot(x,z,bw,bd,c,s,1);const fl=1+(hsh(gx+8,gz+8)<.35?1:0),pal=PAL[P.pal];
  B_.push({x,z,a:ang,w:bw,d:bd,h:fl*3.2+.6,fl,roof:hsh(gx+2,gz+8)<.85?1:2,col:pal[Math.floor(hsh(gx+6,gz+3)*pal.length)],zn:8,st:hsh(gx+9,gz+1)<.2?4:0,seed:hsh(gx+7,gz+7)})}}
/* paese: via Maestra porticata e luoghi speciali (piazza, chiesa, municipio, castello, supermercato, scuole) */
const SPEC=[];for(const M of MWS)for(const sp of M.toll.concat(M.saSpec))SPEC.push(sp);if(MILAN&&MILAN.spec)for(const sp of MILAN.spec)SPEC.push(sp);for(const c of CITIES)if(c.spec)for(const sp of c.spec)SPEC.push(sp);
/* corso del paese: il viale (k0) più vicino al centro, in qualunque orientamento (strada del casello, arteria urbana); i portici seguono la sua direzione */
function townCorso(t){if(t.corso)return t.corso;let as=null,bd=1e9;for(const s of RS){if(s.k!==0||s.br||s.del||s.ss||s.ow)continue;const d=Math.hypot((s.ax+s.bx)/2-t.x,(s.az+s.bz)/2-t.z);if(d<bd){bd=d;as=s}}t.corso=as;return as}
function flagArcade(t){const as=townCorso(t);if(!as)return;const ux=(as.bx-as.ax)/as.len,uz=(as.bz-as.az)/as.len;for(const s of RS){if(s.k!==0||s.br||s.ss||s.ow)continue;const vx=(s.bx-s.ax)/s.len,vz=(s.bz-s.az)/s.len;if(Math.abs(vx*ux+vz*uz)<.9)continue;const mx=(s.ax+s.bx)/2-t.x,mz=(s.az+s.bz)/2-t.z;if(Math.abs(mx*ux+mz*uz)<230&&Math.abs(-mx*uz+mz*ux)<90)s.arc=1}}
function placeSpecials(t){const as=townCorso(t);
 if(!as){t.cx=t.x;t.cz=t.z;t.a=0;return}const ux=(as.bx-as.ax)/as.len,uz=(as.bz-as.az)/as.len,nx=-uz,nz=ux,TX=(as.ax+as.bx)/2,TZ=(as.az+as.bz)/2,A=Math.atan2(uz,ux);t.cx=TX;t.cz=TZ;t.a=A;
 const P=(u,v)=>[TX+ux*u+nx*v,TZ+uz*u+nz*v];
 const cells=(x,z,a,w,d,fn,st)=>{const c=Math.cos(a),s=Math.sin(a),n1=Math.max(1,Math.ceil(w/(st||3))),n2=Math.max(1,Math.ceil(d/(st||3)));for(let i=0;i<=n1;i++)for(let j=0;j<=n2;j++){const lx=-w/2+w*i/n1,lz=-d/2+d*j/n2;fn(x+lx*c-lz*s,z+lx*s+lz*c)}};
 function carve(x,z,a,w,d,mg){const c=Math.cos(a),s=Math.sin(a);for(let i=B_.length-1;i>=0;i--){const b=B_[i],dx=b.x-x,dz=b.z-z,lx=dx*c+dz*s,lz=-dx*s+dz*c,r=Math.min(b.w,b.d)/2;if(Math.abs(lx)<w/2+mg+r&&Math.abs(lz)<d/2+mg+r)B_.splice(i,1)}
  {const R=(w+d)/2+mg+40,cx0=Math.floor((x-R)/64),cx1=Math.floor((x+R)/64),cz0=Math.floor((z-R)/64),cz1=Math.floor((z+R)/64),seen=new Set();for(let gx=cx0;gx<=cx1;gx++)for(let gz=cz0;gz<=cz1;gz++){const arr=RC.get(ck(gx,gz));if(!arr)continue;for(const id of arr){if(seen.has(id))continue;seen.add(id);const sg=RS[id];if(sg.br||sg.arc||sg.del||sg.ss||sg.mw||sg.ramp||sg.tp||sg.pol||sg.ow)continue;const n=Math.max(1,Math.ceil(sg.len/2));for(let q=0;q<=n;q++){const px=sg.ax+(sg.bx-sg.ax)*q/n-x,pz=sg.az+(sg.bz-sg.az)*q/n-z,ex=Math.max(0,Math.abs(px*c+pz*s)-(w/2+mg)),ez=Math.max(0,Math.abs(-px*s+pz*c)-(d/2+mg));if(Math.hypot(ex,ez)<sg.w/2+.3){sg.del=1;break}}}}}
  RESX.push({x,z,a,w:w+2*mg+14,d:d+2*mg+14});cells(x,z,a,w+4,d+4,(px,pz)=>{ogSet(px,pz,2)})}
 function spot(cx0,cz0,w,d,rad){let best=null,bc=1e18;for(const ang of [A,A+Math.PI/2]){for(let du=-rad;du<=rad;du+=20)for(let dv=-rad;dv<=rad;dv+=20){const cx=cx0+du,cz=cz0+dv;if(Math.hypot(cx-TX,cz-TZ)>t.R-110)continue;let cost=0;cells(cx,cz,ang,w,d,(px,pz)=>{const o=og(px,pz);cost+=o===1?7:o===2?1:0},6);cost+=Math.hypot(du,dv)*.04;if(cost<bc){bc=cost;best={x:cx,z:cz,a:ang}}}}return best}
 const add=(tp,x,z,a,w,d,e)=>{SPEC.push(Object.assign({t:tp,x,z,a,w,d,town:t.name},e||{}))};
 {const q=P(70,31);carve(q[0],q[1],A,64+34,40,2);add('plaza',q[0],q[1],A,64,40)}
 {const q=P(70,70);carve(q[0],q[1],A,22,36,2);add('church',q[0],q[1],A,22,36)}
 {const q=P(121,31);carve(q[0],q[1],A,32,26,2);add('hall',q[0],q[1],A,32,26)}
 if(t.castle!==false){const q=P(130,-235);carve(q[0],q[1],A,92,92,2);add('castle',q[0],q[1],A,84,84)}
 const road2=(x,z)=>{const n=nearRoad(x,z,400,-9,-9,-9,-9);return n?[n.x,n.z]:null};
 const place=(tp,u,v,w,d,pd,rad)=>{const q=P(u,v),sp=spot(q[0],q[1],w,d+pd,rad);if(!sp)return;const rd=road2(sp.x,sp.z),zx=-Math.sin(sp.a),zz=Math.cos(sp.a),fs=rd&&((rd[0]-sp.x)*zx+(rd[1]-sp.z)*zz)<0?-1:1;carve(sp.x,sp.z,sp.a,w,d+pd,2);add(tp,sp.x,sp.z,sp.a,w,d,{pd,fs})};
 for(const [u,v] of [[-330,150],[210,-300],[-40,330]])place('mall',u,v,96,48,38,120);
 for(const [u,v] of [[-150,-240],[-230,60],[200,230],[-60,-120],[300,-120]])place('school',u,v,62,16,34,120)}
function genBuildings(){for(const row of [0,1])for(let id=0;id<RS.length;id++){const sg=RS[id];if(sg.br||sg.ow||sg.mw)continue;const L=sg.len,ux=(sg.bx-sg.ax)/L,uz=(sg.bz-sg.az)/L,nxv=-uz,nzv=ux,ang=Math.atan2(uz,ux);
  for(const side of [1,-1]){let t=6;while(t<L-6){const px=sg.ax+ux*t,pz=sg.az+uz*t,zn=zone(px,pz),P=ZP[zn];if(!P){t+=40;continue}
    if(zn===7&&rnd()<.85){t+=40;continue}if(row&&zn!==0&&zn!==2&&zn!==4&&zn!==8&&zn!==16&&zn!==18){t+=60;continue}
    const bw=P.w0+rnd()*(P.w1-P.w0),bd=P.d0+rnd()*(P.d1-P.d0),sb=sg.arc?3.7:P.sw*(.7+rnd()*.6),off=sg.w/2+sb+bd/2+row*(P.d1+2.5),tm=t+bw/2;
    if(tm>L-3){t+=6;continue}
    const cx=sg.ax+ux*tm+nxv*side*off,cz=sg.az+uz*tm+nzv*side*off,c=Math.cos(ang),s=Math.sin(ang);
    if(!lotFree(cx,cz,bw,bd,c,s,P.inf)||RESBL(cx,cz,bw,bd,c,s)){t+=5;continue}
    const hs=[];for(const q of [[-1,-1],[1,-1],[1,1],[-1,1]])hs.push(H(cx+q[0]*bw/2*c-q[1]*bd/2*s,cz+q[0]*bw/2*s+q[1]*bd/2*c));
    const hmn=Math.min(...hs),hmx=Math.max(...hs);if(hmx-hmn>Math.max(2.5,bw*.18)||hmn<SEA+1||((hmn<SEA+4||riverQ(cx,cz))&&wetLot(cx,cz,bw,bd,c,s))){t+=6;continue}
    markLot(cx,cz,bw,bd,c,s,P.inf);
    const fl=Math.round(P.fl0+rnd()*(P.fl1-P.fl0)),rr=rnd(),R=P.roof;let roof=rr<R[0]?0:rr<R[1]?1:rr<R[2]?2:3;if(zn===3||zn===1)roof=rnd()<.5?3:0;
    const pal=PAL[P.pal],col=pal[Math.floor(rnd()*pal.length)],hh=zn===3||zn===1?8+rnd()*6:fl*3.2+.6;
    B_.push({x:cx,z:cz,a:ang,w:bw,d:bd,h:zn===13?fl*3.4+1:hh,fl,roof,col,zn,st:zn===13?3:zn===12?(rnd()<.5?1:2):zn===10||zn===11?(rnd()<.15?1:0):zn===3||zn===1?2:zn===2||zn===4||zn===17||zn===19?(rnd()<.35?3:1):zn===8||zn===9?(rnd()<.2?4:0):((zn===0||zn===16||zn===18)&&rnd()<.1?1:0),seed:rnd()});
    t+=bw+P.gap*(.4+rnd()*1.2)}}}}
for(const t of TOWNS)flagArcade(t);
{const t0=Date.now();for(const t of TOWNS)placeSpecials(t);tmark('spec',t0)}
{netfix();
 const t1=Date.now();OGT.clear();markRoads();for(const r of RESX)if(r.a!==undefined){const c=Math.cos(r.a),sn=Math.sin(r.a),n1=Math.ceil(r.w/2),n2=Math.ceil(r.d/2);for(let i=0;i<=n1;i++)for(let j=0;j<=n2;j++){const lx=-r.w/2+r.w*i/n1,lz=-r.d/2+r.d*j/n2;ogSet(r.x+lx*c-lz*sn,r.z+lx*sn+lz*c,2)}}tmark('og2',t1)}
{const t0=Date.now();genBuildings();for(const t of TOWNS)fillTown(t);tmark('bld',t0)}
const BCH=new Map();for(const b of B_){const k=Math.floor((b.x+WS)/CSZ)+','+Math.floor((b.z+WS)/CSZ);let a=BCH.get(k);if(!a)BCH.set(k,a=[]);a.push(b)}
const SCH=new Map();RS.forEach((s,i)=>{const k=Math.floor(((s.ax+s.bx)/2+WS)/CSZ)+','+Math.floor(((s.az+s.bz)/2+WS)/CSZ);let a=SCH.get(k);if(!a)SCH.set(k,a=[]);a.push(i)});
const SPCH=new Map();for(const s of SPEC){const k=Math.floor((s.x+WS)/CSZ)+','+Math.floor((s.z+WS)/CSZ);let a=SPCH.get(k);if(!a)SPCH.set(k,a=[]);a.push(s)}
const SGH=new Map();for(const M of MWS)for(const g of M.signs){const lat=g.kind==='gantry'?8.75:g.kind==='panel'?8.75+9.5:8.75+7.6,p=M.p(g.s,g.side*lat);g.px=p[0];g.pz=p[1];const nr=M.n(g.s);g.nx=nr[0];g.nz=nr[1];const tv=M.tan(g.s);g.fx=-g.side*tv[0];g.fz=-g.side*tv[1];g.h=Math.atan2(-g.side*nr[1],-g.side*nr[0])+(g.side>0?Math.PI:0);g.y=H(p[0],p[1]);const k=Math.floor((p[0]+WS)/CSZ)+','+Math.floor((p[1]+WS)/CSZ);let a=SGH.get(k);if(!a)SGH.set(k,a=[]);a.push(g)}
const RCH=new Map();RIV.forEach((rv,li)=>{const P=rv.pts;for(let i=0;i<P.length-1;i++){const k=Math.floor(((P[i].x+P[i+1].x)/2+WS)/CSZ)+','+Math.floor(((P[i].z+P[i+1].z)/2+WS)/CSZ);let a=RCH.get(k);if(!a)RCH.set(k,a=[]);a.push([li,i])}});
let _deg=null;function nodeDeg(x,z){if(!_deg){_deg=new Map();for(const s of RS)for(const e of [[s.ax,s.az],[s.bx,s.bz]]){const k=Math.round(e[0]*4)+','+Math.round(e[1]*4);_deg.set(k,(_deg.get(k)||0)+1)}}return _deg.get(Math.round(x*4)+','+Math.round(z*4))||0}
return{TIMES,TOWN,TOWNS,townAt,SPEC,SPCH,MW:MWR,MWS,mwAt,CITIES,LAKE,lakeR,SGTXT:TXT,MILAN,SGH,nodeDeg,PADS,OS,WS,CSZ,NCH,SEA,X0,X1,Z0,Z1,inside,chunkOK,CX0,CX1,CZ0,CZ1,H,Hraw,ground,wet,wy,zone,coastX,RS,BR,RV,RIV,B_,BCH,SCH,RCH,fbm,sm,rnd,hsh,og,ogi,PZ,KD,riverQ,RQ,bridgeAt,deckAt,NETFIX,RES,TERM}
})();