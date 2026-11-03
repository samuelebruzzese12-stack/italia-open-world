/* ===== Autostrada: guardrail, spartitraffico, segnaletica (portali, pannelli, cippi), caselli, aree di servizio ===== */
const GRY2=hx(0xb9bcc0),GRC=hx(0xa3a6aa),NJC=hx(0xc9c6bd),SGPOST=hx(0x6d7378),SGBACK=hx(0x4a4f55),WHITE=hx(0xf4f4f0),YEL=hx(0xf2c81e),BLUE=hx(0x1d4fa0),REDB=hx(0xc0392b),GLASS=hx(0x2b4a66);
/* nastro verticale lungo una linea di punti [x,z] con quota campionata sul terreno: faccia esterna e interna */
function ribbon(m,pts,y0,h,col,ny){for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1],ya=H(a[0],a[1])+y0,yb=H(b[0],b[1])+y0,dx=b[0]-a[0],dz=b[1]-a[1];face(m,[[a[0],ya,a[1]],[b[0],yb,b[1]],[b[0],yb+h,b[1]],[a[0],ya+h,a[1]]],col,[-dz*ny,0,dx*ny]);face(m,[[a[0],ya,a[1]],[b[0],yb,b[1]],[b[0],yb+h,b[1]],[a[0],ya+h,a[1]]],col,[dz*ny,0,-dx*ny])}}
function linePts(s,off,t0,t1,step){const L=s.len,ux=(s.bx-s.ax)/L,uz=(s.bz-s.az)/L,nx=-uz,nz=ux,a0=t0*L,a1=t1*L,n=Math.max(1,Math.ceil((a1-a0)/step)),out=[];for(let i=0;i<=n;i++){const a=a0+(a1-a0)*i/n;out.push([s.ax+ux*a+nx*off,s.az+uz*a+nz*off])}return out}
/* guardrail esterno: interrotto ovunque un'altra strada (rampa, corsia dell'area di servizio, raccordo, strada del casello) occupa il bordo della carreggiata;
   spartitraffico in cemento lungo l'asse (interrotto ai varchi). Entrambi sono solidi bassi (fermano le auto, non la vista né la telecamera). */
function mwRail(s,RP,SO,segs){if(s.tp)return;const L=s.len,ux=(s.bx-s.ax)/L,uz=(s.bz-s.az)/L,nx=-uz,nz=ux,hw=s.w/2,ang=Math.atan2(uz,ux);
 const other=(segs||[]).filter(q=>q!==s&&(!q.mw||q.tp)&&!q.pol&&!q.br);   // anche i tratti allargati delle barriere
 const free=(x,z)=>{for(const q of other)if(segDist(q,x,z)-q.w/2<(q.ramp?6.5:1.3))return false;return true};   // davanti alle rampe un varco ampio (corsia di uscita e di immissione)
 const yAt=(x,z)=>s.br?W.deckAt(s,Math.max(0,Math.min(1,((x-s.ax)*ux+(z-s.az)*uz)/L))):H(x,z);
 const solidRun=(a,b,off)=>{const mx=(a[0]+b[0])/2,mz=(a[1]+b[1])/2,l=Math.hypot(b[0]-a[0],b[1]-a[1]);if(l<.5)return;SO.push({x:mx,z:mz,hx:l/2,hz:.28,c:(b[0]-a[0])/l,s:(b[1]-a[1])/l,lo:1})};
 {const pts=linePts(s,hw+.45,0,1,3);let run=[];const flush=()=>{if(run.length>1){for(let i=0;i<run.length-1;i++){const a=run[i],b=run[i+1],ya=yAt(a[0],a[1])+.55,yb=yAt(b[0],b[1])+.55,dx=b[0]-a[0],dz=b[1]-a[1];face(RP,[[a[0],ya,a[1]],[b[0],yb,b[1]],[b[0],yb+.32,b[1]],[a[0],ya+.32,a[1]]],GRY2,[-dz,0,dx]);face(RP,[[a[0],ya,a[1]],[b[0],yb,b[1]],[b[0],yb+.32,b[1]],[a[0],ya+.32,a[1]]],GRY2,[dz,0,-dx])}
   for(let i=0;i<run.length;i+=2){const p=run[i];ob(RP,p[0],yAt(p[0],p[1]),p[1],.12,.62,.12,ang,SGPOST)}solidRun(run[0],run[run.length-1])}run=[]};
  for(const p of pts){if(free(p[0],p[1]))run.push(p);else flush()}flush()}
 if(s.side>0&&!s.tn){const va=s.vgA?Math.min(.5,14/L):0,vb=s.vgB?Math.min(.5,14/L):0;if(1-va-vb>.05){const pts=linePts(s,-8.75,va,1-vb,4).filter(p=>free(p[0],p[1]));if(pts.length>1)for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1];if(Math.hypot(b[0]-a[0],b[1]-a[1])>4.5)continue;const ya=yAt(a[0],a[1])+.02,yb=yAt(b[0],b[1])+.02;
   for(const sd of [1,-1]){face(RP,[[a[0]+nx*sd*.33,ya,a[1]+nz*sd*.33],[b[0]+nx*sd*.33,yb,b[1]+nz*sd*.33],[b[0]+nx*sd*.14,yb+.85,b[1]+nz*sd*.14],[a[0]+nx*sd*.14,ya+.85,a[1]+nz*sd*.14]],NJC,[nx*sd,.2,nz*sd])}
   face(RP,[[a[0]+nx*.14,ya+.85,a[1]+nz*.14],[b[0]+nx*.14,yb+.85,b[1]+nz*.14],[b[0]-nx*.14,yb+.85,b[1]-nz*.14],[a[0]-nx*.14,ya+.85,a[1]-nz*.14]],NJC,[0,1,0])}
  if(pts.length>1){let r0=0;for(let i=1;i<=pts.length;i++){if(i===pts.length||Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1])>4.5){if(i-1>r0)solidRun(pts[r0],pts[i-1]);r0=i}}}}}}
/* segnali: portale verde sopra la carreggiata, pannello a lato, cippo chilometrico */
function signQuad(SG,cx,y0,cz,w,h,fx,fz,cell,back){const nx=fz,nz=-fx,hw=w/2,U=cell;   // faccia rivolta verso (fx,fz); (nx,nz) = asse orizzontale del pannello
 const P=[[cx-nx*hw,y0,cz-nz*hw],[cx+nx*hw,y0,cz+nz*hw],[cx+nx*hw,y0+h,cz+nz*hw],[cx-nx*hw,y0+h,cz-nz*hw]];
 face(SG,P,WHITE,[fx,0,fz],[[U[0],U[3]],[U[2],U[3]],[U[2],U[1]],[U[0],U[1]]]);
 if(back)face(back,[[cx-nx*hw,y0,cz-nz*hw],[cx+nx*hw,y0,cz+nz*hw],[cx+nx*hw,y0+h,cz+nz*hw],[cx-nx*hw,y0+h,cz-nz*hw]],SGBACK,[-fx,0,-fz])}
function signs(cx,cz,RP,SG,SO){const list=W.SGH.get(cx+','+cz);if(!list)return;
 for(const g of list){const n=[g.nx,g.nz],fx=g.fx,fz=g.fz,cell=g.txt!==undefined?W.SGC(g.txt):null;   // il pannello guarda chi arriva (normale e verso calcolati dal mondo)
  if(g.kind==='gantry'){const p1=[g.px+n[0]*7.6,g.pz+n[1]*7.6],p2=[g.px-n[0]*7.6,g.pz-n[1]*7.6],y1=H(p1[0],p1[1]),y2=H(p2[0],p2[1]),yt=Math.max(y1,y2)+6.6;
   ob(RP,p1[0],y1,p1[1],.45,yt-y1+.9,.45,0,SGPOST);ob(RP,p2[0],y2,p2[1],.45,yt-y2+.9,.45,0,SGPOST);SO.push({x:p1[0],z:p1[1],hx:.3,hz:.3,c:1,s:0},{x:p2[0],z:p2[1],hx:.3,hz:.3,c:1,s:0});
   ob(RP,g.px,yt,g.pz,.5,.7,15.6,Math.atan2(n[1],n[0])+Math.PI/2,SGPOST);
   if(cell)signQuad(SG,g.px,yt+.75,g.pz,7.2,1.8,fx,fz,cell,RP)}
  else if(g.kind==='panel'){const y=H(g.px,g.pz);ob(RP,g.px,y,g.pz,.2,3.9,.2,0,SGPOST);SO.push({x:g.px,z:g.pz,hx:.2,hz:.2,c:1,s:0});if(cell)signQuad(SG,g.px,y+2.5,g.pz,4.4,1.1,fx,fz,cell,RP)}
  else if(g.kind==='km'){const y=H(g.px,g.pz);ob(RP,g.px,y,g.pz,.26,1.1,.26,0,WHITE);ob(RP,g.px,y+.78,g.pz,.28,.32,.28,0,hx(0x2a7d3c));SO.push({x:g.px,z:g.pz,hx:.15,hz:.15,c:1,s:0})}}}
/* casello: piazzale, pensilina, cabine, barriere alzate, segnali gialli e blu */
function specToll(sp,RF,SO){const c=Math.cos(sp.a),s=Math.sin(sp.a),L=(lx,lz)=>[sp.x+lx*c-lz*s,sp.z+lx*s+lz*c],y0=H(sp.x,sp.z),A=sp.a;
 const box=(lx,lz,bw,bd,h,col,top,dy)=>{const p=L(lx,lz);ob(RF,p[0],y0+(dy||0),p[1],bw,h,bd,A,col,top)},solid=(lx,lz,hx_,hz_)=>{const p=L(lx,lz);SO.push({x:p[0],z:p[1],hx:hx_,hz:hz_,c:c,s:s})};
 const flat=(lx,lz,bw,bd,col,dy)=>{const a=L(lx-bw/2,lz-bd/2),b=L(lx+bw/2,lz-bd/2),e=L(lx+bw/2,lz+bd/2),f=L(lx-bw/2,lz+bd/2),yy=y0+dy;face(RF,[[a[0],yy,a[1]],[b[0],yy,b[1]],[e[0],yy,e[1]],[f[0],yy,f[1]]],col,[0,1,0])};
 // quattro corsie larghe 5 m (spazio libero fra le isole 4,1 m: si passa anche in velocità), isole delle cabine strette
 const main=sp.main,lanes=[-7.5,-2.5,2.5,7.5],W2=24,D2=16;
 flat(0,0,W2+6,D2+22,ASF,.11);
 box(0,0,W2+4,D2,.7,hx(0xd7d9dc),hx(0xd0d3d6),6.3);box(0,0,W2+4,.5,.9,REDB,REDB,5.6);
 for(const q of [[-W2/2-.5,-D2/2+1],[W2/2+.5,-D2/2+1],[-W2/2-.5,D2/2-1],[W2/2+.5,D2/2-1]]){box(q[0],q[1],.55,.55,6.3,GRC);solid(q[0],q[1],.35,.35)}   // pilastri sulla linea delle isole esterne (alla barriera coincidono con le isole della carreggiata accanto)
 const div=[];for(let i=0;i<lanes.length-1;i++)div.push((lanes[i]+lanes[i+1])/2);div.push(lanes[0]-(lanes[1]-lanes[0]),lanes[lanes.length-1]+(lanes[1]-lanes[0]));
 for(const d of div){box(d,0,.95,3.6,2.75,WHITE,hx(0x7d8288));box(d,0,1.0,2.2,.9,GLASS,null,1.1);solid(d,0,.45,1.9);box(d,-D2/2-2,.4,.4,1,hx(0x8d8f93))}
 for(let i=0;i<lanes.length;i++){const l=lanes[i],tele=main?i===2:(i===2||i===3);box(l+.9,2.8,.14,.14,2.3,hx(0xe8e8e8));box(l+.9,2.8,.14,.14,.6,REDB,null,1.7);box(l,0,1.9,.6,.7,tele?YEL:BLUE,null,5.8)}
 for(const sd of [1,-1])box(sd*(W2/2+5),-D2/2-8,.25,.25,5,SGPOST),box(sd*(W2/2+5),-D2/2-8,4,.4,1.1,hx(0x2a7d3c),null,4)}
/* area di servizio: piazzale, corsie di sosta, distributore con pensilina, ristoro, alberi; variante a ponte sopra l'autostrada */
function specSA(sp,F,RF,TR,SO){const c=Math.cos(sp.a),s=Math.sin(sp.a),sg=sp.side,L=(lx,lz)=>[sp.x+lx*c-(lz*sg)*s,sp.z+lx*s+(lz*sg)*c],y0=H(sp.x,sp.z),A=sp.a;
 const box=(lx,lz,bw,bd,h,col,top,dy)=>{const p=L(lx,lz);ob(RF,p[0],H(p[0],p[1])+(dy||0),p[1],bw,h,bd,A,col,top)},solid=(lx,lz,hx_,hz_)=>{const p=L(lx,lz);SO.push({x:p[0],z:p[1],hx:hx_,hz:hz_,c:c,s:s})};
 const flat=(lx,lz,bw,bd,col,dy)=>{const a=L(lx-bw/2,lz-bd/2),b=L(lx+bw/2,lz-bd/2),e=L(lx+bw/2,lz+bd/2),f=L(lx-bw/2,lz+bd/2);face(RF,[[a[0],H(a[0],a[1])+dy,a[1]],[b[0],H(b[0],b[1])+dy,b[1]],[e[0],H(e[0],e[1])+dy,e[1]],[f[0],H(f[0],f[1])+dy,f[1]]],col,[0,1,0])};
 const tr=(lx,lz,r,hh)=>{const p=L(lx,lz);tree(TR,p[0],H(p[0],p[1])-.1,p[1],r,hh,hx([0x3f7f34,0x4a8a3a,0x356f30][Math.floor(hsh(Math.floor(p[0]),Math.floor(p[1]))*3)]),false)};
 flat(0,2,300,46,ASF,.11);
 // corsie di sosta (strisce bianche) a nord della strada interna (lz>0)
 for(let i=-11;i<=11;i++){const lx=i*12;box(lx,14,.15,10,.02,hx(0xe8e8e8),null,.13);if(hsh(Math.floor(sp.x)+i*3,7)<.5){const p=L(lx+6,14);pcar(RF,SO,p[0],H(p[0],p[1])+.1,p[1],Math.atan2(-s,c)+Math.PI/2*sg,Math.floor(hsh(i,Math.floor(sp.z))*8))}}
 // distributore: pensilina su 4 pilastri, 6 pompe, insegna
 box(-70,8,26,13,.6,hx(0xf3f3f0),hx(0xe4e4e0),5.2);box(-70,8,26,.5,.9,REDB,REDB,4.6);
 for(const q of [[-81,3],[-59,3],[-81,13],[-59,13]]){box(q[0],q[1],.5,.5,5.2,GRC);solid(q[0],q[1],.3,.3)}
 for(const q of [[-76,8],[-70,8],[-64,8]]){box(q[0],q[1],2.6,.9,.3,hx(0xd0d0cc));box(q[0],q[1]-.0,.7,.6,1.6,hx(0xf0f0ec),hx(0x2a2c30),.3);solid(q[0],q[1],1.3,.5)}
 box(-92,14,.4,.4,8,SGPOST);box(-92,14,3.4,.5,2.2,REDB,null,8);box(-92,14,3,.3,1.2,hx(0xf7f4ea),null,8.5);solid(-92,14,.3,.3);
 // ristoro: edificio bianco con fascia rossa e vetrata, insegna sul tetto
 box(50,17,44,15,5,hx(0xf2f0ea),hx(0xd9d6cf));box(50,9.7,44.2,.6,2.2,GLASS,null,1);box(50,17,44.4,15.4,.6,REDB,REDB,5);box(50,17,18,2.2,2.6,REDB,null,5.6);box(50,17,17,1.6,1.9,hx(0xfdfbf3),null,5.9);solid(50,17,22,7.5);
 for(const q of [[-20,20],[20,20],[85,20],[110,10],[-110,10],[-130,22],[130,22]])tr(q[0],q[1],2.2,7);
 for(const q of [[-150,0],[150,0]]){box(q[0],q[1],.3,.3,4,SGPOST);box(q[0],q[1],2.8,.3,.8,BLUE,null,3.2)}
 // area ristoro a ponte sopra l'autostrada (solo sul lato nord): corpo vetrato su pilastri, scale alle estremità
 if(sp.bridge){const E=sp.E,yb=E+6.6;const bx=(lz0,lz1,col,h,dy)=>{const a=L(-12,lz0),b=L(12,lz0),e=L(12,lz1),f=L(-12,lz1);const yy=yb+(dy||0);face(RF,[[a[0],yy,a[1]],[b[0],yy,b[1]],[e[0],yy,e[1]],[f[0],yy,f[1]]],col,[0,-1,0]);face(RF,[[a[0],yy+h,a[1]],[b[0],yy+h,b[1]],[e[0],yy+h,e[1]],[f[0],yy+h,f[1]]],col,[0,1,0]);
   for(const [p,q,hint] of [[a,b,[0,0,-1]],[b,e,[1,0,0]],[e,f,[0,0,1]],[f,a,[-1,0,0]]]){face(RF,[[p[0],yy,p[1]],[q[0],yy,q[1]],[q[0],yy+h,q[1]],[p[0],yy+h,p[1]]],col,[(p[0]+q[0])/2-sp.x,0,(p[1]+q[1])/2-sp.z])}};
  bx(-20,-82,hx(0xe9e6df),.8,0);bx(-20,-82,GLASS,3.2,.8);bx(-20,-82,hx(0xe9e6df),.9,4);bx(-20,-82,REDB,.4,4.9);
  for(const lz of [-20,-51,-82]){for(const lx of [-9,9]){const p=L(lx,lz);const y=H(p[0],p[1]);ob(RF,p[0],y,p[1],1.2,yb-y,1.2,A,GRC);SO.push({x:p[0],z:p[1],hx:.7,hz:.7,c:c,s:s})}}
  for(const lz of [-18,-84]){box(0,lz,8,5,.4,hx(0xd0cfc8),null,0);const p=L(0,lz);ob(RF,p[0],H(p[0],p[1]),p[1],8,yb-H(p[0],p[1])+.5,5,A,hx(0xdedcd4));SO.push({x:p[0],z:p[1],hx:4,hz:2.5,c:c,s:s})}
  {const p=L(0,-51);ob(RF,p[0],yb+5.3,p[1],24,1.6,1.2,A,REDB)}}}
