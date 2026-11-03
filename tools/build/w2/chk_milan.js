/* ===== Milano: monumenti (Duomo, piazza, Galleria, Scala, Torre Velasca, Castello, Parco con Arco della Pace, Stazione Centrale, stadio, torre a guglia) ===== */
const MARB=hx(0xe9e5dc),MARB2=hx(0xdcd6c9),BRK=hx(0x8c4b3a),BRK2=hx(0x7a4030),CREAM=hx(0xeadfc8),GOLD=hx(0xe6c24a),CONC=hx(0xb5b7b9),GLS2=hx(0x4f7fa8),LAWN2=hx(0x4a8a3a),PAVE=hx(0xb9b2a6);
function specMilan(sp,F,RF,TR,SO){const c=Math.cos(sp.a),s=Math.sin(sp.a),L=(lx,lz)=>[sp.x+lx*c-lz*s,sp.z+lx*s+lz*c],y0=H(sp.x,sp.z),A=sp.a;
 const box=(lx,lz,bw,bd,h,col,top,dy)=>{const p=L(lx,lz);ob(RF,p[0],y0+(dy||0),p[1],bw,h,bd,A,col,top)},solid=(lx,lz,hx_,hz_)=>{const p=L(lx,lz);SO.push({x:p[0],z:p[1],hx:hx_,hz:hz_,c:c,s:s})};
 const flat=(lx,lz,bw,bd,col,dy)=>{const a=L(lx-bw/2,lz-bd/2),b=L(lx+bw/2,lz-bd/2),e=L(lx+bw/2,lz+bd/2),f=L(lx-bw/2,lz+bd/2),yy=y0+dy;face(RF,[[a[0],yy,a[1]],[b[0],yy,b[1]],[e[0],yy,e[1]],[f[0],yy,f[1]]],col,[0,1,0])};
 const pr=(lx,lz,r,h,n,col,dy)=>{const p=L(lx,lz);prism(RF,p[0],y0+(dy||0),p[1],r,h,n,col)},cn=(lx,lz,r,h,n,col,dy)=>{const p=L(lx,lz);cone(RF,p[0],y0+(dy||0),p[1],r,h,n,col)},dm=(lx,lz,r,col,dy)=>{const p=L(lx,lz);dome(RF,p[0],y0+(dy||0),p[1],r,col)};
 const tr=(lx,lz,r,hh)=>{const p=L(lx,lz);tree(TR,p[0],H(p[0],p[1])-.1,p[1],r,hh,hx([0x3f7f34,0x4a8a3a,0x356f30,0x5a8f3a][Math.floor(hsh(Math.floor(p[0]),Math.floor(p[1]+3))*4)]),false)};
 const gab=(lx,lz,w,d,y,rh,col)=>{const p=L(lx,lz);gable(RF,p[0],p[1],A,w,d,y0+y,rh,col,col)};
 if(sp.t==='mduomo'){const W2=158,D2=92;flat(0,0,W2+16,D2+16,PAVE,.08);
  box(0,0,W2,D2,40,MARB,MARB2);box(0,0,W2,36,50,MARB,MARB2);box(16,0,46,D2,50,MARB,MARB2);
  box(W2/2-2,0,5,D2,54,MARB,MARB2);gab(W2/2-2,0,6,D2,54,9,MARB2);   // facciata verso la piazza (a ovest = +x)
  for(let i=0;i<19;i++){const lx=-W2/2+6+i*8;for(const sd of [1,-1]){box(lx,sd*(D2/2-.6),1.4,3,40,MARB2);cn(lx,sd*(D2/2-.6),1.3,13,6,MARB,40)}}
  for(let i=0;i<9;i++){const lz=-D2/2+6+i*10;box(-W2/2+.8,lz,2,1.6,40,MARB2);cn(-W2/2+.8,lz,1.3,13,6,MARB,40)}
  for(let i=0;i<6;i++){const lx=-W2/2+18+i*24;for(const sd of [1,-1])cn(lx,sd*17,1.6,17,6,MARB,50)}
  pr(16,0,5.5,22,8,MARB,50);cn(16,0,5.5,36,8,MARB,72);box(16,0,1.6,1.6,4,GOLD,null,108);
  for(const q of [[-W2/2+2,D2/2-4],[-W2/2+2,-D2/2+4],[W2/2-6,D2/2-4],[W2/2-6,-D2/2+4]])cn(q[0],q[1],2.2,20,6,MARB,54);
  solid(0,0,W2/2+1,D2/2+1)}
 else if(sp.t==='mpiazza'){flat(0,0,sp.w,sp.d,hx(0xc7c0b2),.09);for(let i=-4;i<=4;i++)box(i*20,0,.3,sp.d-6,.01,hx(0xaaa397),null,.1);
  box(-20,0,9,4.5,3,hx(0x9a8f7f));box(-20,0,2.2,5.5,3.2,hx(0x5a5a4a),null,3);box(-20,0,1.2,1.2,2.4,hx(0x4a4a3a),null,6.2);solid(-20,0,4.5,2.3);
  for(const sd of [1,-1]){box(60,sd*55,.3,.3,14,CONC);box(-60,sd*55,.3,.3,14,CONC);solid(60,sd*55,.2,.2);solid(-60,sd*55,.2,.2)}
  for(let i=0;i<14;i++)for(const sd of [1,-1]){box(-sp.w/2+8+i*13,sd*(sp.d/2-3),.2,.2,7,POLE);box(-sp.w/2+8+i*13,sd*(sp.d/2-3),1.2,.3,.3,POLE,hx(0xf5efc0),7)}}
 else if(sp.t==='galleria'){const wW=30;flat(0,0,116,112,PAVE,.08);
  box(0,0,105,wW,24,CREAM,hx(0xd9cfb8));box(0,0,wW,100,24,CREAM,hx(0xd9cfb8));
  gab(0,0,105,wW-2,24,7,GLS2);gab(0,0,wW-2,100,24,7,GLS2);
  pr(0,0,17,4,8,CREAM,24);dm(0,0,17,GLS2,28);pr(0,0,3,6,8,CREAM,43);
  box(0,-54,30,6,30,CREAM,hx(0xd9cfb8));box(0,-56,22,3,3,hx(0x6a5a4a),null,30);for(const sd of [1,-1])box(sd*11,-55,3,4,26,hx(0xdcd2bb));
  for(let i=0;i<8;i++)for(const sd of [1,-1]){box(-45+i*13,sd*(wW/2-.5),1.4,1,24,hx(0xdcd2bb))}
  solid(0,0,52,wW/2);solid(0,0,wW/2,50)}
 else if(sp.t==='scala'){flat(0,0,96,60,PAVE,.08);box(0,6,80,42,22,CREAM,hx(0xcfc5ae));box(0,22,30,24,32,hx(0xe0d6bf),hx(0xcfc5ae));box(0,-17,54,6,14,CREAM,hx(0xd9cfb8),4);
  for(let i=0;i<6;i++)box(-20+i*8,-19,1.2,1.2,10,hx(0xf0e9d6),null,4);box(0,-21,56,7,.4,hx(0xd9cfb8),null,3.6);solid(0,6,40,21)}
 else if(sp.t==='velasca'){box(0,0,28,28,58,hx(0x9c6c5c),hx(0x8a5c4c));box(0,0,36,36,40,hx(0xa87868),hx(0x8a5c4c),58);for(let i=0;i<8;i++){const a=i/8*6.2832;box(Math.cos(a)*16,Math.sin(a)*16,1.2,1.2,14,hx(0x8a5c4c),null,48)}box(0,0,8,8,6,hx(0x8a5c4c),null,98);solid(0,0,18,18)}
 else if(sp.t==='mcastello'){const W2=200;flat(0,0,W2+30,W2+30,LAWN2,.06);
  for(const q of [[0,-W2/2,W2,5],[0,W2/2,W2,5],[-W2/2,0,5,W2],[W2/2,0,5,W2]]){box(q[0],q[1],q[2],q[3],11,BRK,BRK2);solid(q[0],q[1],q[2]/2,q[3]/2);
   const n=Math.floor(Math.max(q[2],q[3])/8);for(let i=0;i<n;i++){const lx=q[0]+(q[2]>q[3]?-q[2]/2+4+i*8:0),lz=q[1]+(q[3]>q[2]?-q[3]/2+4+i*8:0);box(lx,lz,q[2]>q[3]?3.2:q[2]+1,q[3]>q[2]?3.2:q[3]+1,2,BRK2,null,11)}}
  for(const q of [[-W2/2,-W2/2],[W2/2,-W2/2]]){pr(q[0],q[1],13,24,12,BRK2);cn(q[0],q[1],14,9,12,hx(0x5a3a30),24);solid(q[0],q[1],12,12)}
  for(const q of [[-W2/2,W2/2],[W2/2,W2/2]]){box(q[0],q[1],24,24,26,BRK,BRK2);cn(q[0],q[1],15,8,4,hx(0x5a3a30),26);solid(q[0],q[1],12,12)}
  box(0,-W2/2,16,16,42,BRK,BRK2);box(0,-W2/2,10,10,8,hx(0xd9cfb8),null,42);cn(0,-W2/2,7,10,4,hx(0x5a3a30),50);solid(0,-W2/2,8,8);box(0,-W2/2-3,7,.5,9,hx(0x3a2a20),null,0);
  box(0,40,120,20,10,BRK,BRK2);solid(0,40,60,10);box(0,-10,40,60,12,BRK,BRK2);solid(0,-10,20,30);flat(0,15,150,10,PAVE,.08)}
 else if(sp.t==='parco'){flat(0,0,sp.w,sp.d,LAWN2,.05);flat(0,0,10,sp.d,PAVE,.07);flat(0,0,sp.w,10,PAVE,.07);flat(60,-60,46,34,hx(0x3f7f99),.06);
  for(let i=0;i<70;i++){const lx=(hsh(i,91)-.5)*sp.w*.92,lz=(hsh(i,37)-.5)*sp.d*.92;if(Math.abs(lx)<7||Math.abs(lz)<7||(Math.abs(lx-60)<28&&Math.abs(lz+60)<22))continue;tr(lx,lz,2+hsh(i,5)*1.5,7+hsh(i,9)*5)}
  for(let i=0;i<10;i++){const a=i/10*6.2832;box(Math.cos(a)*52-90,Math.sin(a)*40+70,10,2,4,CONC);}solid(-90,70,48,38)}
 else if(sp.t==='arco'){flat(0,0,70,40,PAVE,.08);for(const sd of [1,-1]){box(sd*9,0,7,7,20,MARB,MARB2);solid(sd*9,0,3.5,3.5)}box(0,0,30,8,7,MARB,MARB2,20);box(0,0,10,5,5,hx(0x6a7a5a),null,27);for(const sd of [1,-1])box(sd*11,0,3,2,3.5,hx(0x6a7a5a),null,27);for(const sd of [1,-1])box(sd*28,0,.35,.35,9,CONC)}
 else if(sp.t==='stazione'){flat(0,-45,240,100,PAVE,.08);box(0,-10,230,22,34,hx(0xd8d2c4),hx(0xc9c3b4));box(0,-13,232,5,8,hx(0xc9c3b4),null,34);for(let i=0;i<5;i++){box(-80+i*40,-21,16,1.5,20,hx(0x3a3a40),null,2)}
  for(let i=0;i<3;i++){const lx=-70+i*70;box(lx,65,66,130,10,hx(0xc5bfb2),hx(0xb8b2a4));gab(lx,65,66,130,10,16,hx(0x8f9aa6))}
  for(let i=0;i<4;i++)box(-105+i*70,0,2,2,30,hx(0xc9c3b4),null,0);solid(0,-10,116,12);solid(0,65,105,65);
  for(let i=0;i<6;i++){box(-100+i*40,-70,.3,.3,9,POLE);box(-100+i*40,-70,1.4,.4,.4,POLE,hx(0xf5efc0),9)}}
 else if(sp.t==='mstadio'){flat(0,0,300,260,ASF,.08);pr(0,0,122,36,36,CONC);pr(0,0,112,1,36,hx(0xd8d8d8),36);flat(0,0,100,66,LAWN2,36.6);pr(0,0,128,3,36,hx(0xc0392b),38);
  for(const q of [[-125,-100],[125,-100],[-125,100],[125,100]]){pr(q[0],q[1],15,50,16,CONC);cn(q[0],q[1],16,3,16,hx(0xc0392b),50);solid(q[0],q[1],14,14)}solid(0,0,112,112);
  for(let i=0;i<10;i++){box(-135+i*30,135,.3,.3,12,POLE);box(-135+i*30,135,2,.5,.5,POLE,hx(0xf5efc0),12)}}
 else if(sp.t==='spire'){box(0,0,46,30,138,GLS2,hx(0x7aa0c4));box(14,0,18,30,36,GLS2,hx(0x7aa0c4),138);pr(14,0,9,12,8,hx(0x9ab9d6),174);cn(14,0,7,45,8,hx(0xdce6ee),186);box(0,-24,60,14,40,GLS2,hx(0x7aa0c4));solid(0,0,24,16);solid(0,-24,30,7)}
}
