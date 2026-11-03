/* ===== caratteristiche lungo l'asse di ogni autostrada (ascissa s): stazioni, carreggiate, varchi, svincoli, aree di servizio, barriere, raccordi, statale, segnali ===== */
function addPath(pts,w,k,flags){const ids=[];for(let i=0;i<pts.length-1;i++){const id=addSeg(pts[i][0],pts[i][1],pts[i+1][0],pts[i+1][1],w,k);if(id>=0&&RS[id]&&Math.hypot(RS[id].bx-pts[i+1][0],RS[id].bz-pts[i+1][1])<.01&&Math.hypot(RS[id].ax-pts[i][0],RS[id].az-pts[i][1])<.01){Object.assign(RS[id],flags||{});ids.push(id)}}return ids}
/* rilevato lungo una polilinea: quote lineari fra le estremità */
function padPath(pts,ya,yb,hw,sl){let L=0;for(let i=0;i<pts.length-1;i++)L+=Math.hypot(pts[i+1][0]-pts[i][0],pts[i+1][1]-pts[i][1]);let acc=0;for(let i=0;i<pts.length-1;i++){const l=Math.hypot(pts[i+1][0]-pts[i][0],pts[i+1][1]-pts[i][1]);addPad(pts[i][0],pts[i][1],pts[i+1][0],pts[i+1][1],ya+(yb-ya)*acc/L,ya+(yb-ya)*(acc+l)/L,hw,sl);acc+=l}}
/* strada ordinaria su terreno mosso: profilo addolcito (media mobile, pendenza massima) e rilevato/trincea per ogni tratto */
function gradePath(pts,maxG,hw,sl){const n=pts.length,h=new Float64Array(n),e=new Float64Array(n);for(let i=0;i<n;i++)h[i]=H(pts[i][0],pts[i][1]);
 for(let i=0;i<n;i++){let s=0,c=0;for(let k=-2;k<=2;k++){const j=Math.min(n-1,Math.max(0,i+k));s+=h[j];c++}e[i]=s/c}e[0]=h[0];e[n-1]=h[n-1];
 for(let i=1;i<n;i++){const l=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1])*maxG;e[i]=Math.min(e[i-1]+l,Math.max(e[i-1]-l,e[i]))}
 for(let i=n-2;i>=0;i--){const l=Math.hypot(pts[i][0]-pts[i+1][0],pts[i][1]-pts[i+1][1])*maxG;e[i]=Math.min(e[i+1]+l,Math.max(e[i+1]-l,e[i]))}
 for(let i=0;i<n-1;i++)if(Math.abs(e[i]-h[i])>.25||Math.abs(e[i+1]-h[i+1])>.25)addPad(pts[i][0],pts[i][1],pts[i+1][0],pts[i+1][1],e[i],e[i+1],hw,sl);return e}
const ssm=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t)};
function mwFeatures(M,D){const L=M.L,ST={1:new Map(),'-1':new Map()},st=(side,s,tag)=>{const m=ST[side];if(!m.has(s))m.set(s,tag||'')};
 mwProfile(M,[].concat(D.bar.map(b=>({s:b.s,half:150})),D.sa.map(a=>({s:a.s,half:420})),D.ic.map(c=>({s:c.s,half:720}))));
 for(const b of D.bar)M.bar.push({s:b.s,name:b.name});for(const a of D.sa)M.sa.push({s:a.s,name:a.name,sides:a.sides||[1,-1],bridge:!!a.bridge});for(const c of D.ic)M.ic.push({s:c.s,name:c.name,town:c.town||c.name,tside:c.tside||1});
 for(let sv=2800;sv<L-800;sv+=2000){let ok=true;for(const f of [].concat(M.bar,M.sa,M.ic))if(Math.abs(f.s-sv)<800)ok=false;if(ok)M.varchi.push({s:sv})}
 for(const f of [].concat(M.bar,M.sa,M.ic,M.varchi)){const p=M.pt(f.s);f.x=p[0];f.z=p[1]}
 /* stazioni (nodi obbligati) per ciascuna carreggiata */
 for(const side of [1,-1]){st(side,0,'start');st(side,L,'end');
  for(const b of M.bar){st(side,b.s-45,'barA');st(side,b.s+45,'barB')}
  for(const v of M.varchi)st(side,v.s,'varco');
  for(const s of M.sa)for(const sd of s.sides){if(sd!==side)continue;st(side,s.s-side*300,'saOut');st(side,s.s+side*440,'saIn')}
  for(const c of M.ic){st(side,c.s-side*650,'icOut');st(side,c.s+side*650,'icIn')}}
 /* carreggiate: segmenti a senso unico (s crescente per il lato 1, decrescente per il lato -1), viadotti e gallerie secondo il profilo */
 const build=side=>{const xs=Array.from(ST[side].keys()).sort((a,b)=>a-b),pts=[];
  for(let i=0;i<xs.length;i++){pts.push(xs[i]);if(i<xs.length-1){const d=xs[i+1]-xs[i],n=Math.max(1,Math.round(d/60));for(let k=1;k<n;k++)pts.push(xs[i]+d*k/n)}}
  const off=side*8.75,nodes=M.nodes[side];let prev=null,ps=0;
  for(const s of pts){const p=M.p(s,off);nodes[s]=p;
   if(prev){const a=side>0?prev:p,b=side>0?p:prev,sm_=(s+ps)/2,mode=M.mode(sm_),id=addSeg(a[0],a[1],b[0],b[1],13.5,5),g=RS[id];g.ow=1;g.mw=MWS.indexOf(M)+1;g.side=side;g.nm=M.name;g.ca=side>0?ps:s;g.cb=side>0?s:ps;
    const tA=ST[side].get(g.ca)||'',tB=ST[side].get(g.cb)||'';if(/ic|sa/.test(tA))g.gapA=1;if(/ic|sa/.test(tB))g.gapB=1;if(tA==='varco')g.vgA=1;if(tB==='varco')g.vgB=1;
    if(M.viaduct(g.ca,g.cb)){g.br=1;g.ya=M.e(g.ca)+.3;g.yb=M.e(g.cb)+.3;g.via=1}
    M.segs[side].push(g)}
   prev=p;ps=s}};
 build(1);build(-1);
 const N1=side=>M.nodes[side];
 /* varchi di servizio fra le due carreggiate (solo per la polizia) */
 for(const v of M.varchi){const a=N1(1)[v.s],b=N1(-1)[v.s];const id=addSeg(a[0],a[1],b[0],b[1],5,8);RS[id].pol=1;RS[id].nm='varco'}
 /* rampa lungo l'asse: dal nodo di carreggiata (scarto 8,75·lato) fino al nodo di svincolo J (scarto vJ·lato), con correzione finale verso J */
 const rampPts=(s0,s1,side,vJ,J)=>{const pts=[],n=Math.max(6,Math.round(Math.abs(s1-s0)/16)),pe=M.p(s1,side*vJ),cx=J[0]-pe[0],cz=J[1]-pe[1];for(let i=0;i<=n;i++){const t=i/n,s=s0+(s1-s0)*t,k=ssm(t),off=8.75+(vJ-8.75)*k,p=M.p(s,side*off);if(i===n)pts.push([J[0],J[1]]);else pts.push([p[0]+cx*k,p[1]+cz*k])}return pts};
 const latOff=p=>{const q=M.proj(p[0],p[1],200);return q?Math.abs(q.d):999};
 /* ---- svincoli: strada del casello perpendicolare all'asse, cavalcavia, quattro rampe, casello, paese a 1500 m dal lato scelto ---- */
 for(const c of M.ic){const si=c.s,ts=c.tside,E=M.e(si),ctr=M.pt(si),tv=M.tan(si),nv=M.n(si),P2=(u,v)=>[ctr[0]+tv[0]*u+nv[0]*v,ctr[1]+tv[1]*u+nv[1]*v];c.cx=ctr[0];c.cz=ctr[1];c.nv=nv;c.tv=tv;
  const yC=E+6.6,pN=P2(0,96),pS=P2(0,-96),jN=P2(0,205),jS=P2(0,-205),jT=ts>0?jN:jS,pz0=P2(0,330*ts),pz1=P2(0,410*ts),pt=P2(0,520*ts);
  const toTown=[P2(0,1500*ts),P2(0,1150*ts),P2(0,800*ts),pt,pz1];gradePath(toTown,.1,8,16);addPath(toTown,13,0,{nm:'Via del Casello',icn:c.name});
  addPath([pz1,pz0],20,0,{nm:'Casello '+c.name,tp:1,lanes:[-7.5,-2.5,2.5,7.5],icn:c.name});
  addPath([pz0,jT],13,0,{nm:'Via del Casello',icn:c.name});
  addPath([jN,pN],13,0,{nm:'Via del Casello',ap:1,icn:c.name});addPath([pS,jS],13,0,{nm:'Via del Casello',ap:1,icn:c.name});
  const br=addPath([pN,pS],13,0,{nm:'Cavalcavia '+c.name,icn:c.name});for(const id of br){const s=RS[id];s.br=1;s.ya=yC;s.yb=yC;s.over=1}
  addPad(P2(0,-250)[0],P2(0,-250)[1],P2(0,250)[0],P2(0,250)[1],E,E,150,110);   // piazzale dello svincolo in piano alla quota dell'autostrada
  const hN=E,hS=E;addPad(jN[0],jN[1],pN[0],pN[1],hN,yC,8,14);addPad(jS[0],jS[1],pS[0],pS[1],hS,yC,8,14);
  const nW=N1(1),nE=N1(-1);
  const rampWout=rampPts(si-650,si,1,205,jN),rampWin=rampPts(si+650,si,1,205,jN).reverse();
  const rampEout=rampPts(si+650,si,-1,205,jS),rampEin=rampPts(si-650,si,-1,205,jS).reverse();
  rampWout[0]=nW[si-650];rampWin[rampWin.length-1]=nW[si+650];rampEout[0]=nE[si+650];rampEin[rampEin.length-1]=nE[si-650];
  for(const [pts,tag] of [[rampWout,'uscita'],[rampWin,'ingresso'],[rampEout,'uscita'],[rampEin,'ingresso']]){addPath(pts,6,6,{ow:1,ramp:1,nm:tag+' '+c.name,icn:c.name});for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1],qa=M.proj(a[0],a[1],300),ea=qa?M.e(qa.s):E,qb=M.proj(b[0],b[1],300),eb=qb?M.e(qb.s):E;addPad(a[0],a[1],b[0],b[1],ea,eb,4,7)}}
  // casello (pensilina, cabine, barriere) e sua riserva; piazzale spianato
  const tc=P2(0,370*ts),aT=Math.atan2(nv[1],nv[0])+Math.PI/2;M.toll.push({t:'toll',x:tc[0],z:tc[1],a:aT,w:80,d:34,name:'Casello '+c.name,ic:c});
  addPad(pz1[0],pz1[1],pz0[0],pz0[1],H(pz1[0],pz1[1]),H(pz0[0],pz0[1]),18,16);RESX.push({x:tc[0],z:tc[1],a:aT,w:100,d:60});
  // il paese: centro a 1500 m
  const tcn=P2(0,1500*ts),t={x:tcn[0],z:tcn[1],R:600,name:c.town,zc:9,zh:8,castle:false};TOWNS.push(t);
  const pad={x:tcn[0],z:tcn[1],r0:520,r1:820};pad.h=Hu(tcn[0],tcn[1]);PADS.push(pad);RGN.push({x0:tcn[0]-800,x1:tcn[0]+800,z0:tcn[1]-800,z1:tcn[1]+800});
  c.jN=jN;c.jS=jS;c.jT=jT;c.town=t;c.pN=pN;c.pS=pS;
  for(const side of [1,-1]){const d0=side>0?-1:1;
   M.signs.push({s:si+d0*1650,side,txt:SIGN('USCITA  '+c.name+'   1000 m','g'),kind:'gantry'});
   M.signs.push({s:si+d0*1150,side,txt:SIGN('USCITA  '+c.name+'   500 m','g'),kind:'gantry'});
   M.signs.push({s:si+d0*650,side,txt:SIGN('USCITA  '+c.name,'g',true),kind:'gantry'});
   M.signs.push({s:si-d0*900,side,txt:SIGN((side>0?M.dest1:M.dest0)+'   '+Math.round(Math.abs((side>0?L:0)-si)/1000)+' km','g'),kind:'panel'})}}
 /* ---- aree di servizio: corsie di uscita/rientro, piazzale, distributore, ristoro (eventualmente a ponte sopra l'autostrada) ---- */
 for(const s of M.sa){const ss=s.s,E=M.e(ss),ctr=M.pt(ss),tv=M.tan(ss),nrm=M.n(ss),P=(u,v)=>[ctr[0]+tv[0]*u+nrm[0]*v,ctr[1]+tv[1]*u+nrm[1]*v];s.P=P;s.cx=ctr[0];s.cz=ctr[1];s.nv=nrm;
  for(const side of s.sides){const n=N1(side),out=n[ss-side*300],inn=n[ss+side*440],v=side*(8.75+6.75+34);
   const loop=curvePts([out,P(-side*215,side*22),P(-side*135,side*38),P(-side*120,v-side*6),P(-side*40,v-side*6),P(side*60,v-side*6),P(side*150,v-side*6),P(side*200,side*38),P(side*316,side*22),inn],18);
   addPath(loop,6,6,{ow:1,ramp:1,sa:1,nm:'Area di servizio '+s.name});{const fl=loop.filter(p=>Math.abs(latOff(p)-8.75)>13);for(let i=0;i<fl.length-1;i++){const qa=M.proj(fl[i][0],fl[i][1],200),ea=qa?M.e(qa.s):E,qb=M.proj(fl[i+1][0],fl[i+1][1],200),eb=qb?M.e(qb.s):E;addPad(fl[i][0],fl[i][1],fl[i+1][0],fl[i+1][1],ea,eb,4,7)}}
   for(let u=-180;u<200;u+=40){const q0=P(side*u,v),q1=P(side*Math.min(200,u+40),v);addPad(q0[0],q0[1],q1[0],q1[1],M.e(ss+side*u),M.e(ss+side*Math.min(200,u+40)),30,14)}
   const cc=P(side*10,v),a=Math.atan2(tv[1],tv[0]);
   M.saSpec.push({t:'sa',x:cc[0],z:cc[1],a,w:330,d:52,side,name:s.name,bridge:!!s.bridge&&side>0,E,zc:ctr[1]});
   RESX.push({x:cc[0],z:cc[1],a,w:360,d:80});
   const d0=side>0?-1:1;
   M.signs.push({s:ss+d0*1300,side,txt:SIGN('AREA DI SERVIZIO  '+s.name+'   1000 m','b'),kind:'gantry'});
   M.signs.push({s:ss+d0*600,side,txt:SIGN('AREA DI SERVIZIO  '+s.name,'b',true),kind:'gantry'})}}
 /* ---- barriere sulla linea principale: tratto allargato a 20 m con cabine ---- */
 for(const b of M.bar){const sb=b.s,ctr=M.pt(sb),nrm=M.n(sb);
  for(const side of [1,-1]){const n=N1(side),pa=n[sb-45],pb=n[sb+45];for(const g of M.segs[side]){if(Math.abs((g.ca+g.cb)/2-sb)<46){g.w=20;g.tp=1;g.lanes=[-7.5,-2.5,2.5,7.5]}}
   M.toll.push({t:'toll',x:(pa[0]+pb[0])/2,z:(pa[1]+pb[1])/2,a:Math.atan2(nrm[1],nrm[0]),w:90,d:24,name:'Barriera '+b.name,side,main:1});
   const d0=side>0?-1:1;M.signs.push({s:sb+d0*800,side,txt:SIGN('BARRIERA  '+b.name+'   800 m','g'),kind:'gantry'});M.signs.push({s:sb+d0*250,side,txt:SIGN('STAZIONE  '+b.name+'  rallentare','g'),kind:'gantry'})}
  RESX.push({x:ctr[0],z:ctr[1],a:Math.atan2(nrm[1],nrm[0]),w:100,d:70})}
 /* ---- inizio: raccordo con la superstrada della città; fine: viale d'ingresso nella città di destinazione (vertice esatto dell'anello) ---- */
 {const n=N1(1),e=N1(-1),sW=n[0],sE=e[0];
  const Ns=M.p(-120,0);let jA=null;
  if(D.start&&D.start.near){let sup=null,bd=1e9;const nr=D.start.near,wz=D.start.wz||1;for(let i=0;i<RS.length;i++){const g=RS[i];if(g.k!==4||g.mw||g.del||g.ramp)continue;const mx=(g.ax+g.bx)/2,mz=(g.az+g.bz)/2;const d=Math.hypot(mx-nr[0],(mz-nr[1])*wz);if(d<bd){bd=d;sup=i}}
   if(sup!==null){const g=RS[sup];jA=[(g.ax+g.bx)/2,(g.az+g.bz)/2];const rp=[jA,[(jA[0]+Ns[0])/2,(jA[1]+Ns[1])/2],Ns];gradePath(rp,.09,8,16);addPath(rp,13,0,{nm:'Raccordo '+M.name});M.startJ={lo:jA,hi:jA,sup,Ns}}}
  addPath([Ns,M.p(-60,5),sW],13,0,{nm:'Raccordo '+M.name});addPath([sE,M.p(-60,-5),Ns],13,0,{nm:'Raccordo '+M.name});
  M.signs.push({s:150,side:1,txt:SIGN(M.name+'  '+M.dest1+'   '+Math.round(L/1000)+' km','g'),kind:'panel'});
  M.signs.push({s:L-200,side:-1,txt:SIGN(M.name+'  '+M.dest0+'   '+Math.round(L/1000)+' km','g'),kind:'panel'});
  M.signs.push({s:L-900,side:1,txt:SIGN(M.dest1.toUpperCase()+'  tangenziale  900 m','g'),kind:'gantry'});M.signs.push({s:L-2200,side:1,txt:SIGN(M.dest1.toUpperCase()+' centro  ·  Tangenziale','g'),kind:'gantry'});
  M.signs.push({s:900,side:-1,txt:SIGN('FINE AUTOSTRADA  900 m','g'),kind:'gantry'});
  const eW=n[L],eE=e[L],endN=D.end.pt,t1=M.tan(L),n1=M.n(L),q1=M.p(L+150,7),q2=M.p(L+150,-7),e1=[endN[0]-t1[0]*60+n1[0]*4,endN[1]-t1[1]*60+n1[1]*4],e2=[endN[0]-t1[0]*60-n1[0]*4,endN[1]-t1[1]*60-n1[1]*4];
  addPath([eW,q1,e1,endN],20,7,{nm:D.end.name,av:1});addPath([endN,e2,q2,eE],20,7,{nm:D.end.name,av:1});
  M.endN=endN}
 /* ---- strada statale parallela (scarto laterale fisso, lieve ondulazione): dalla superstrada della città fino a un vertice dell'anello della città di arrivo ---- */
 if(D.ss){const off=D.ss.off,ssf=s=>off+Math.sign(off)*(90*Math.sin(s/700+1)+60*Math.sin(s/260));M.ssf=ssf;
  const pts=[];let sup=null,bd=1e9;const p0=M.p(-60,ssf(-60)),nr=D.ss.near||p0;for(let i=0;i<RS.length;i++){const g=RS[i];if(g.k!==4||g.mw||g.ramp||g.del)continue;const mx=(g.ax+g.bx)/2,mz=(g.az+g.bz)/2;const d=Math.hypot(mx-nr[0],mz-nr[1]);if(d<bd){bd=d;sup=i}}
  if(sup!==null){const g=RS[sup];pts.push([(g.ax+g.bx)/2,(g.az+g.bz)/2])}
  const sEnd=D.ss.sEnd!==undefined?D.ss.sEnd:L+400;for(let s=-60;s<=sEnd;s+=70)pts.push(M.p(s,ssf(s)));
  const v=D.ss.end;{const pl=pts[pts.length-1];pts.push([(pl[0]*.4+v[0]*.6),(pl[1]*.4+v[1]*.6)],v)}
  gradePath(pts,.11,8,16);addPath(pts,13,0,{nm:D.ss.name,ss:1});M.ssEnd=v}
 /* segnali fuori tracciato o sopra un varco/barriera: spostati o eliminati */
 for(let i=M.signs.length-1;i>=0;i--){const g=M.signs[i];if(g.s<140||g.s>L-140){M.signs.splice(i,1);continue}for(const v of M.varchi){if(Math.abs(g.s-v.s)<34){g.s=v.s+(g.s<=v.s?-40:40)}}for(const b of M.bar){if(Math.abs(g.s-b.s)<75&&g.kind!=='km')g.s=b.s+(g.s<=b.s?-80:80)}}
 /* cippi chilometrici ogni 1000 m */
 for(let s=1000;s<L;s+=1000){let okk=true;for(const a of M.sa)if(Math.abs(s-a.s)<540)okk=false;for(const c of M.ic)if(Math.abs(s-c.s)<720)okk=false;if(!okk)continue;M.signs.push({s,side:1,kind:'km',km:Math.round(M.km(s))});M.signs.push({s,side:-1,kind:'km',km:Math.round(M.km(s))})}   // non dove corrono rampe e corsie di servizio
 for(const g of M.signs)g.mw=M;
 return M}
/* ---- definizioni ---- */
{const at=(M,x)=>{const q=M.proj(x,fA1(x),300);return Math.round(q.s)};
 mwFeatures(A1,{bar:[{s:at(A1,2400),name:'Città'},{s:at(A1,39800),name:'Milano'}],sa:[{s:at(A1,7300),name:'Colline'},{s:at(A1,23000),name:'Padana',bridge:true},{s:at(A1,35500),name:'Pianura'}],ic:[{s:at(A1,12800),name:'Borgo San Martino'},{s:at(A1,30000),name:'Pievetta'}],
  start:{near:[1600,fA1(1600)],wz:.7},end:{pt:MILAN.vert(3,Math.PI),name:'Viale Forlanini'},ss:{off:820,name:'Strada Statale Padana',near:[1500,fA1(1700)+820],end:MILAN.vert(3,Math.PI-Math.PI/8)}})}
{const sAt=(M,i)=>Math.round(M.proj(M.def.cp[i][0],M.def.cp[i][1],300).s);
 mwFeatures(A4,{bar:[{s:sAt(A4,1)+250,name:'Città'},{s:sAt(A4,16)+300,name:'Como'}],sa:[{s:sAt(A4,6)+400,name:'Brianza'}],ic:[{s:sAt(A4,10)+500,name:'Cantù',tside:-1}],
  start:{near:[1420,2420]},end:{pt:COMO.vert(1,-Math.PI/2),name:'Viale Innocenzo XI'},ss:{off:-700,name:'Strada Statale dei Laghi',near:[1400,2200],sEnd:A4.L-1400,end:COMO.vert(1,-Math.PI/2+Math.PI/8)}});
 mwFeatures(A3,{bar:[{s:sAt(A3,1)+250,name:'Città'},{s:sAt(A3,16)+250,name:'Genova'}],sa:[{s:sAt(A3,6)+400,name:'Riviera'}],ic:[{s:sAt(A3,10)+500,name:'Rapallo',tside:-1}],
  start:{near:[950,-2500]},end:{pt:GENOVA.vert(1,Math.PI/2),name:'Via Bobbio'},ss:{off:-650,name:'Strada Statale Aurelia',near:[330,-2930],sEnd:A3.L-1500,end:GENOVA.vert(1,Math.PI/2+Math.PI/8)}})}
/* ---- paesi lungo le autostrade: pianificazione organica (anello, corso, raggi) e infittimento ---- */
for(const t of TOWNS){if(t.name==='Rivarolo'||t.planned)continue;t.planned=1;planTown(t);while(Q.length&&RS.length<MAXS)grow(Q.shift());
 for(const p of [.1,.07]){const n0=RS.length;for(let id=0;id<n0&&RS.length<MAXS;id++){const s=RS[id];if(s.br||s.k>1||s.mw||s.ow||rnd()>p)continue;const mx=(s.ax+s.bx)/2,mz=(s.az+s.bz)/2;if(Math.hypot(mx-t.x,mz-t.z)>t.R*.95)continue;const k=zk(mx,mz),a=Math.atan2(s.bx-s.ax,s.bz-s.az)+(rnd()<.5?1:-1)*(1.45+rnd()*.3);Q.push(walker(mx,mz,a,k===2?100+rnd()*200:200+rnd()*500,k,null,id-3,id+3,1))}while(Q.length&&RS.length<MAXS)grow(Q.shift())}}
