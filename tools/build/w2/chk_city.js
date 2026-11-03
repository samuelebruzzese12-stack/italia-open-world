/* ===== Città nuove: porto commerciale (banchina, moli, navi, gru, diga foranea con faro) ===== */
function specPorto(sp,RF,TR,SO){const cq=W.coastX,Z0=sp.z,CONC=hx(0x9a968c),RED=hx(0xc0392b),yq=SEA+1.6;
 // banchina lungo la riva (lastra di cemento dalla spiaggia a 32 m sul mare)
 for(let k=-5;k<=5;k++){const Zq=Z0+k*40,X=cq(Zq)+8;ob(RF,X,SEA-2,Zq,80,3.6,40.6,0,CONC)}
 for(let k=-10;k<=10;k++){const Zq=Z0+k*20,X=cq(Zq)-30;ob(RF,X,yq,Zq,.5,.9,.5,0,hx(0x2a2c30))}   // bitte
 // moli perpendicolari alla riva
 for(const dz of [-140,0,140]){const Zq=Z0+dz,pe=cq(Zq)+30;for(let k=0;k<3;k++){const X=pe-40-k*80;ob(RF,X,SEA-3,Zq,80.5,4.6,16,0,CONC);SO.push({x:X,z:Zq,hx:40,hz:8,c:1,s:0})}
  for(let k=0;k<6;k++){const X=pe-20-k*40;ob(RF,X,yq,Zq+9,.3,.3,3,0,hx(0x8d8f93));ob(RF,X,yq+3,Zq+9,1.2,.3,.3,0,hx(0xf5efc0))}}
 // navi ormeggiate ai moli
 ship(RF,SO,cq(Z0-70)-150,Z0-70,96,0x34495e);ship(RF,SO,cq(Z0+70)-120,Z0+70,74,0x7b2d26);ship(RF,SO,cq(Z0-210)-110,Z0-210,64,0x2f6f8f);ship(RF,SO,cq(Z0+210)-130,Z0+210,80,0x5a6b3a);
 // gru a portale sulla banchina
 for(let k=0;k<5;k++){const Zc=Z0-120+k*60,X=cq(Zc)+16;ob(RF,X,yq,Zc,3,26,3,0,RED);ob(RF,X,yq,Zc+8,3,26,3,0,RED);ob(RF,X-14,yq+26,Zc+4,34,2,4,0,hx(0xe9e3d5));ob(RF,X+3,yq+24,Zc+4,6,3.4,5,0,hx(0x3a3d42));SO.push({x:X,z:Zc+4,hx:2,hz:6,c:1,s:0})}
 // container impilati sulla parte a mare della banchina
 for(let r=0;r<2;r++)for(let q=0;q<9;q++){const Zc=Z0-150+q*24+(r?12:0),X=cq(Zc)-8-r*8;const hh2=1+Math.floor(hsh(r+3,q)*3),cc=hx([0xc0392b,0x2e6da4,0x2f8f5a,0xd9a21b,0x8a8f98,0x7a3f8f][Math.floor(hsh(q,r+9)*6)]);for(let l=0;l<hh2;l++)ob(RF,X,yq+l*2.6,Zc,2.6,2.6,12,0,cc);SO.push({x:X,z:Zc,hx:1.4,hz:6.2,c:1,s:0})}
 // diga foranea parallela alla riva con faro all'estremità nord; capitaneria sulla banchina
 {const Xd=cq(Z0)-340;ob(RF,Xd,SEA-3,Z0,14,4.6,560,0,CONC);SO.push({x:Xd,z:Z0,hx:7,hz:280,c:1,s:0});
  const Zf=Z0+282;prism(RF,Xd,yq,Zf,4.2,12,10,hx(0xf2f2ee));prism(RF,Xd,yq+6,Zf,4.3,3,10,RED);prism(RF,Xd,yq+12,Zf,2.6,3,10,hx(0xe8d56a));cone(RF,Xd,yq+15,Zf,3.2,3,10,hx(0x4a4a4e));SO.push({x:Xd,z:Zf,hx:4.5,hz:4.5,c:1,s:0});
  for(let k=0;k<6;k++)ob(RF,Xd,yq,Z0-250+k*100,.3,4,.3,0,hx(0x8d8f93))}
 {const Zc=Z0+120,X=cq(Zc)+18,y=yq;ob(RF,X,y,Zc,18,7.5,30,0,hx(0xf2efe6),hx(0xb5573a));ob(RF,X,y+7.5,Zc,4,9,4,0,hx(0xe9e3d5));ob(RF,X,y+16.5,Zc,.3,4,.3,0,hx(0x8d8f93));SO.push({x:X,z:Zc,hx:9,hz:15,c:1,s:0})}}
