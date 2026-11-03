/* ===== CARROZZERIA A NODI E TRAVI (Versione 19): il principio di BeamNG.drive in piccolo =====
   L'auto è una rete di 88 nodi (masse) uniti da circa 450 travi elastiche: ogni trave ha una lunghezza a riposo, una rigidezza,
   una forza di snervamento oltre la quale si deforma per sempre (plasticità, con incrudimento) e un allungamento oltre il quale
   si strappa. In un urto l'ostacolo (muro, palo, guardrail, altra auto) entra nella rete alla velocità d'urto: i nodi vengono
   spinti, le travi trasmettono le forze, si piegano e si rompono; l'auto rallenta finché l'energia non è assorbita.
   La simulazione è dinamica (passo 0,4 ms) e si svolge nel sistema dell'auto; alla fine si toglie il moto rigido e restano solo
   le deformazioni permanenti. La carrozzeria visibile segue i nodi (ogni vertice è legato alla sua cella della rete), con le
   pieghe della lamiera dove il metallo è stato schiacciato.
   Zone: muso e coda cedono (zone di assorbimento), l'abitacolo è molto più rigido; montanti, tetto, vetri, paraurti, ruote. */
const SBK={dt:.0004,tmax:.3,kc:2.2e6,cc:6e3,hard:1.6,damp:1,eyD:.03,ebD:.22,zeta:.05};
/* --- modello della rete: nodi, masse, travi (con le proprietà per zona), celle per legare la carrozzeria --- */
function sbTemplate(B){
 const z1=B.z1,z0=B.z0,ST=[z1,z1-.38,z1-.88,z1-1.38,.25,-.45,-1.15,z0+.58,z0],XO=Math.min(.92,B.x1-.02),CX=[-XO,-XO/3,XO/3,XO],YF=B.y0+.11,YB=B.y0+.62,YR=B.y1-.06,RX=[-.6,-.2,.2,.6],RS=[4,5,6];
 const P=[],M=[],nb=(i,j,l)=>(i*4+j)*2+l,nr=(r,j)=>72+r*4+j;
 for(let i=0;i<9;i++)for(let j=0;j<4;j++)for(let l=0;l<2;l++){P.push(CX[j],l?YB:YF,ST[i]);M.push(l?9:14)}
 for(let r=0;r<3;r++)for(let j=0;j<4;j++){P.push(RX[j],YR,ST[RS[r]]);M.push(5)}
 const HUB=[[.773,.332,1.323],[-.773,.332,1.323],[.773,.332,-1.387],[-.773,.332,-1.387]];for(const h of HUB){P.push(h[0],h[1],h[2]);M.push(25)}
 for(const j of [1,2]){M[nb(2,j,0)]+=90;M[nb(3,j,0)]+=70}for(const i of [6,7])for(const j of [1,2])M[nb(i,j,0)]+=20;   // motore sopra l'assale anteriore, cambio contro la paratia, serbatoio dietro
 const A=[],Bn=[],FY=[],EY=[],EB=[],TY=[],add=(a,b,fy,ty,ey,eb)=>{A.push(a);Bn.push(b);FY.push(fy*1000);TY.push(ty);EY.push(ey||SBK.eyD);EB.push(eb||SBK.ebD)};
 // travi longitudinali (pavimento e linea di cintura): muso, vano motore, abitacolo, coda — kN
 const LF=[24,36,55,160,160,160,46,22],LB=[10,15,24,110,110,110,17,9];
 for(let i=0;i<8;i++)for(let j=0;j<4;j++)for(let l=0;l<2;l++){const cab=i>=3&&i<=5,att=i===0||i===7;add(nb(i,j,l),nb(i+1,j,l),l?LB[i]:LF[i],att?11:cab?2:i<3?0:3,cab?.08:.03,att?.14:.22)}
 // traversi (larghezza) per stazione
 const TF=[25,30,30,90,70,70,80,30,22],TB=[12,18,18,70,40,40,50,16,10];
 for(let i=0;i<9;i++)for(let j=0;j<3;j++)for(let l=0;l<2;l++){const door=(i===4||i===5)&&j!==1;add(nb(i,j,l),nb(i,j+1,l),door?(l?15:30):(l?TB[i]:TF[i]),4,door?.03:i>=3&&i<=6?.06:.03)}
 // montanti verticali (pavimento-cintura): deboli nel muso e nella coda (il cofano si accartoccia), forti nell'abitacolo
 const VO=[10,12,12,60,50,50,50,15,10],VI=[7,8,8,60,30,30,40,10,7];
 for(let i=0;i<9;i++)for(let j=0;j<4;j++)add(nb(i,j,0),nb(i,j,1),j===0||j===3?VO[i]:VI[i],5,i>=3&&i<=6?.06:.03);
 // pannelli a taglio: diagonali nei piani del pavimento e della cintura, nelle fiancate e nelle sezioni trasversali
 // (nel muso le diagonali sono deboli: il muso si accorcia; vano motore e coda rigidi a taglio, così l'auto non si piega a banana negli urti laterali;
 //  ai lati dell'abitacolo le diagonali esterne sono cedevoli: le porte rientrano)
 for(let i=0;i<8;i++)for(let j=0;j<3;j++)for(let l=0;l<2;l++){const cab=i>=3&&i<=5,f=(cab&&j!==1?(l?.12:.15):i===0?.45:i===1?.7:.9)*(l?LB[i]:LF[i]);add(nb(i,j,l),nb(i+1,j+1,l),f,6);add(nb(i,j+1,l),nb(i+1,j,l),f,6)}
 for(let i=0;i<8;i++)for(let j=0;j<4;j++){const f=.4*LB[i]*(j===0||j===3?1:.6);add(nb(i,j,0),nb(i+1,j,1),f,6);add(nb(i,j,1),nb(i+1,j,0),f,6)}
 for(let i=0;i<9;i++)for(let j=0;j<3;j++){const f=.5*TB[i];add(nb(i,j,0),nb(i,j+1,1),f,6);add(nb(i,j,1),nb(i,j+1,0),f,6)}
 // tetto: correnti, archi e diagonali
 for(let r=0;r<3;r++)for(let j=0;j<3;j++)add(nr(r,j),nr(r,j+1),35,8);
 for(let r=0;r<2;r++)for(let j=0;j<4;j++)add(nr(r,j),nr(r+1,j),j===0||j===3?45:35,8);
 for(let r=0;r<2;r++)for(let j=0;j<3;j++){add(nr(r,j),nr(r+1,j+1),18,8);add(nr(r,j+1),nr(r+1,j),18,8)}
 // montanti A, B, C e cornici dei finestrini; il tetto è legato alla cintura sopra le porte
 for(const [j,q] of [[0,0],[3,3]]){add(nb(3,j,1),nr(0,q),60,7);add(nb(5,j,1),nr(1,q),70,7);add(nr(2,q),nb(7,j,1),50,7);add(nb(4,j,1),nr(0,q),30,7);add(nb(6,j,1),nr(2,q),35,7);add(nb(3,j,1),nr(0,j?2:1),20,7);add(nr(2,j?2:1),nb(7,j,1),18,7)}
 // rigidezza laterale dell'abitacolo (anelli dei montanti: senza, il tetto ondeggerebbe di lato)
 for(const [i,r,f] of [[4,0,30],[5,1,20],[6,2,30]]){add(nb(i,0,1),nr(r,2),f,7,.03);add(nb(i,3,1),nr(r,1),f,7,.03);add(nb(i,0,1),nr(r,1),f*.75,7,.03);add(nb(i,3,1),nr(r,2),f*.75,7,.03)}
 // vetri: parabrezza, lunotto e finestrini (si rompono con piccole deformazioni)
 const G=[];const gl=(a,b,f)=>{G.push(A.length);add(a,b,.5,9,1,.02)};
 for(const j of [1,2]){gl(nb(3,j,1),nr(0,j),4);gl(nr(2,j),nb(7,j,1),4)}gl(nb(3,1,1),nr(0,2),3);gl(nb(3,2,1),nr(0,1),3);gl(nr(2,1),nb(7,2,1),3);gl(nr(2,2),nb(7,1,1),3);
 for(const j of [0,3]){gl(nb(4,j,1),nr(1,j),2);gl(nb(5,j,1),nr(0,j),2);gl(nb(5,j,1),nr(2,j),2);gl(nb(6,j,1),nr(1,j),2)}
 // ruote: mozzi legati alla scocca dai bracci delle sospensioni (si piegano e, in un urto violento, si strappano)
 const HB=[[[2,3,0],[3,3,0],[2,2,0],[2,3,1],[3,3,1]],[[2,0,0],[3,0,0],[2,1,0],[2,0,1],[3,0,1]],[[6,3,0],[7,3,0],[6,2,0],[6,3,1],[7,3,1]],[[6,0,0],[7,0,0],[6,1,0],[6,0,1],[7,0,1]]],HBI=[];
 for(let h=0;h<4;h++){const L=[];for(const q of HB[h]){L.push(A.length);add(84+h,nb(q[0],q[1],q[2]),45,10,.04,.2)}HBI.push(L)}
 // contatto con la ruota: quando il muso (o la coda) schiacciato arriva alla gomma, spinge indietro la ruota (solo compressione)
 const CW=[];for(let h=0;h<4;h++){const i=h<2?1:7,j=h%2?0:3;for(const l of [0,1]){CW.push(A.length);add(84+h,nb(i,j,l),60,12,.03,9)}}
 const N=P.length/3,NB=A.length,P0=new Float64Array(P),invm=new Float64Array(N),Lo=new Float64Array(NB),k=new Float64Array(NB),cd=new Float64Array(NB),U0=new Float64Array(NB*3);
 for(let i=0;i<N;i++)invm[i]=1/M[i];
 for(let b=0;b<NB;b++){const a=A[b],c=Bn[b],L=Math.hypot(P0[c*3]-P0[a*3],P0[c*3+1]-P0[a*3+1],P0[c*3+2]-P0[a*3+2]);Lo[b]=L;for(let q=0;q<3;q++)U0[b*3+q]=(P0[c*3+q]-P0[a*3+q])/L;k[b]=FY[b]/(EY[b]*L);const mr=1/(invm[a]+invm[c]);cd[b]=SBK.zeta*2*Math.sqrt(k[b]*mr)}
 // gruppi per gli effetti: attacchi dei paraurti, nodi dell'abitacolo (riferimento rigido), vetri, mozzi
 const CT=new Float64Array(NB);for(const b of CW)CT[b]=Math.min(.95,.38/Lo[b]);
 const att=[[],[]];for(let b=0;b<NB;b++)if(TY[b]===11)att[P0[A[b]*3+2]>0?0:1].push(b);
 const core=[];for(let i=3;i<=6;i++)for(const j of [1,2])core.push(nb(i,j,0));   // riferimento rigido: il tunnel centrale del pavimento (non si deforma negli urti laterali)
 return{N,NB,P0,M:new Float64Array(M),invm,A:new Int32Array(A),B:new Int32Array(Bn),FY:new Float64Array(FY),EB:new Float64Array(EB),TY:new Uint8Array(TY),Lo,k,cd,U0,CT,ST,CX,YF,YB,YR,RX,RS,nb,nr,HUB,HBI,att,core,G,glass:{ws:G.slice(0,6),rw:G.slice(6,12)}}}
function sbNew(T){return{P:new Float64Array(T.P0),V:new Float64Array(T.N*3),L0:new Float64Array(T.Lo),ep:new Float64Array(T.NB),br:new Uint8Array(T.NB),cm:new Uint8Array(T.NB),free:new Uint8Array(T.N),W:0,hits:0,ver:0}}
/* --- moto rigido: miglior rototraslazione (piccoli angoli, iterata) che porta i nodi dell'abitacolo da Q alla posizione attuale; la si toglie a tutta la rete --- */
function sbRigid(T,S,Q){const P=S.P,C=T.core;for(let it=0;it<3;it++){let m=0,cx=0,cy=0,cz=0,qx=0,qy=0,qz=0;for(const i of C){const w=T.M[i];m+=w;cx+=P[i*3]*w;cy+=P[i*3+1]*w;cz+=P[i*3+2]*w;qx+=Q[i*3]*w;qy+=Q[i*3+1]*w;qz+=Q[i*3+2]*w}cx/=m;cy/=m;cz/=m;qx/=m;qy/=m;qz/=m;
  let a11=0,a12=0,a13=0,a22=0,a23=0,a33=0,b1=0,b2=0,b3=0;for(const i of C){const w=T.M[i],rx=Q[i*3]-qx,ry=Q[i*3+1]-qy,rz=Q[i*3+2]-qz,dx=P[i*3]-cx-rx,dy=P[i*3+1]-cy-ry,dz=P[i*3+2]-cz-rz;a11+=w*(ry*ry+rz*rz);a22+=w*(rx*rx+rz*rz);a33+=w*(rx*rx+ry*ry);a12-=w*rx*ry;a13-=w*rx*rz;a23-=w*ry*rz;b1+=w*(ry*dz-rz*dy);b2+=w*(rz*dx-rx*dz);b3+=w*(rx*dy-ry*dx)}
  const d=a11*(a22*a33-a23*a23)-a12*(a12*a33-a23*a13)+a13*(a12*a23-a22*a13);let tx=0,ty=0,tz=0;if(Math.abs(d)>1e-12){tx=(b1*(a22*a33-a23*a23)-a12*(b2*a33-a23*b3)+a13*(b2*a23-a22*b3))/d;ty=(a11*(b2*a33-a23*b3)-b1*(a12*a33-a23*a13)+a13*(a12*b3-b2*a13))/d;tz=(a11*(a22*b3-b2*a23)-a12*(a12*b3-b2*a13)+b1*(a12*a23-a22*a13))/d}
  // rotazione inversa (Rodrigues) attorno al baricentro attuale, poi traslazione sul baricentro di riferimento
  const th=Math.hypot(tx,ty,tz),ux=th>1e-12?-tx/th:0,uy=th>1e-12?-ty/th:0,uz=th>1e-12?-tz/th:0,cs=Math.cos(th),sn=Math.sin(th);
  for(let i=0;i<T.N;i++){const px=P[i*3]-cx,py=P[i*3+1]-cy,pz=P[i*3+2]-cz,dt=ux*px+uy*py+uz*pz,crx=uy*pz-uz*py,cry=uz*px-ux*pz,crz=ux*py-uy*px;P[i*3]=qx+px*cs+crx*sn+ux*dt*(1-cs);P[i*3+1]=qy+py*cs+cry*sn+uy*dt*(1-cs);P[i*3+2]=qz+pz*cs+crz*sn+uz*dt*(1-cs)}}}
/* --- un passo della dinamica: forze delle travi (elastiche, plastiche, rottura, compattazione, smorzamento) --- */
function sbBeams(T,S,F){const P=S.P,V=S.V,A=T.A,B=T.B,L0=S.L0,k=T.k,Lo=T.Lo,FY=T.FY,EB=T.EB,cd=T.cd,ep=S.ep,br=S.br,TY=T.TY,U0=T.U0,cm=S.cm,CT=T.CT;let W=0;
 for(let b=0;b<T.NB;b++){if(br[b])continue;const a=A[b]*3,c=B[b]*3,dx=P[c]-P[a],dy=P[c+1]-P[a+1],dz=P[c+2]-P[a+2],L=Math.sqrt(dx*dx+dy*dy+dz*dz)||1e-9,ux=dx/L,uy=dy/L,uz=dz/L,lo=Lo[b];
  if(L>lo*(1+EB[b])&&TY[b]!==9){br[b]=1;continue}
  const sp=dx*U0[b*3]+dy*U0[b*3+1]+dz*U0[b*3+2],cth=TY[b]===12?CT[b]:.18;if(TY[b]===12&&sp>=lo*cth)continue;if(sp<lo*cth){const fc=k[b]*4*(lo*cth-sp)+Math.max(0,-cd[b]*((V[c]-V[a])*U0[b*3]+(V[c+1]-V[a+1])*U0[b*3+1]+(V[c+2]-V[a+2])*U0[b*3+2]));F[a]-=fc*U0[b*3];F[a+1]-=fc*U0[b*3+1];F[a+2]-=fc*U0[b*3+2];F[c]+=fc*U0[b*3];F[c+1]+=fc*U0[b*3+1];F[c+2]+=fc*U0[b*3+2];if(TY[b]!==12)cm[b]=1;continue}
  if(cm[b]){cm[b]=0;if(L0[b]>L)L0[b]=L}   // metallo compattato che si riapre: riparte dalla forma schiacciata
  let f=k[b]*(L-L0[b]);const fy=FY[b]*(1+Math.min(2,SBK.hard*ep[b]));
  if(f>fy){const d=(f-fy)/k[b];L0[b]+=d;ep[b]+=d/lo;W+=fy*d;f=fy}else if(f<-fy){const d=(-f-fy)/k[b];L0[b]-=d;ep[b]+=d/lo;W+=fy*d;f=-fy}
  f+=cd[b]*((V[c]-V[a])*ux+(V[c+1]-V[a+1])*uy+(V[c+2]-V[a+2])*uz);
  F[a]+=f*ux;F[a+1]+=f*uy;F[a+2]+=f*uz;F[c]-=f*ux;F[c+1]-=f*uy;F[c+2]-=f*uz}
 return W}
/* --- urto: I={n:[nx,nz] verso l'interno dell'auto, c:[x,z] punto di contatto, u velocità (m/s), hw semilarghezza, ylo/yhi altezze, R raggio (palo)} --- */
/* urto con un piano qualsiasi (ribaltamento: tetto o fiancata che battono sull'asfalto): I={n3:[nx,ny,nz] verso l'interno, c3:[x,y,z] sul piano, u, reach (m)} */
// i montanti e il tetto, caricati di traverso, cedono per flessione e instabilità molto prima del limite di compressione delle travi:
// negli urti dall'alto la loro resistenza è ridotta (ky; la norma sul tetto chiede circa 3 volte il peso dell'auto con meno di 13 cm di schiacciamento)
function sbCrash3(T,S,I){const ky=I.ky||1,sav=[];if(ky!==1)for(let b=0;b<T.NB;b++)if(T.TY[b]===7||T.TY[b]===8){sav.push(b,T.FY[b],T.k[b]);T.FY[b]*=ky;T.k[b]*=ky}
 try{return sbCrash3_(T,S,I)}finally{for(let q=0;q<sav.length;q+=3){T.FY[sav[q]]=sav[q+1];T.k[sav[q]]=sav[q+2]}}}
function sbCrash3_(T,S,I){const N=T.N,P=S.P,V=S.V,inv=T.invm,nx=I.n3[0],ny=I.n3[1],nz=I.n3[2],cx=I.c3[0],cy=I.c3[1],cz=I.c3[2],F=new Float64Array(N*3),fp=[],reach=I.reach||.7;
 const Q=new Float64Array(P);let s=1e9;
 for(let i=0;i<N;i++){if(S.free[i])continue;const d=(P[i*3]-cx)*nx+(P[i*3+1]-cy)*ny+(P[i*3+2]-cz)*nz;if(d<s)s=d}
 for(let i=0;i<N;i++){if(S.free[i])continue;const d=(P[i*3]-cx)*nx+(P[i*3+1]-cy)*ny+(P[i*3+2]-cz)*nz;if(d<s+reach)fp.push(i)}
 if(!fp.length||!(I.u>.3))return null;
 s-=.003;V.fill(0);const dt=SBK.dt,u=I.u;let t=0,steps=0,hit=false,Wp=0,maxPen=0,lastC=0,bad=false;const M=T.M;let Mt=0;for(let i=0;i<N;i++)Mt+=S.free[i]?0:M[i];
 while(t<SBK.tmax){F.fill(0);Wp+=sbBeams(T,S,F);s+=u*dt;
  for(const i of fp){const d=(P[i*3]-cx)*nx+(P[i*3+1]-cy)*ny+(P[i*3+2]-cz)*nz,p=s-d;if(p<=0)continue;const vn=V[i*3]*nx+V[i*3+1]*ny+V[i*3+2]*nz,fc=Math.max(0,SBK.kc*p+SBK.cc*(u-vn));F[i*3]+=fc*nx;F[i*3+1]+=fc*ny;F[i*3+2]+=fc*nz;if(p>maxPen)maxPen=p;hit=true;lastC=t}
  let mv=0;for(let i=0;i<N;i++){const o=i*3,w=inv[i];V[o]=(V[o]+F[o]*w*dt)*SBK.damp;V[o+1]=(V[o+1]+F[o+1]*w*dt)*SBK.damp;V[o+2]=(V[o+2]+F[o+2]*w*dt)*SBK.damp;P[o]+=V[o]*dt;P[o+1]+=V[o+1]*dt;P[o+2]+=V[o+2]*dt;if(!S.free[i])mv+=M[i]*(V[o]*nx+V[o+1]*ny+V[o+2]*nz)}
  t+=dt;steps++;if(!(Math.abs(P[0])<50)){bad=true;break}
  if(hit&&(mv/Mt>u-.04||t-lastC>.015)&&t>.01)break}
 if(bad){P.set(Q);V.fill(0);return{bad:true}}
 sbRigid(T,S,Q);V.fill(0);
 for(let it=0;it<240;it++){F.fill(0);Wp+=sbBeams(T,S,F);for(let i=0;i<N;i++){const o=i*3,w=inv[i];V[o]=(V[o]+F[o]*w*dt)*.96;V[o+1]=(V[o+1]+F[o+1]*w*dt)*.96;V[o+2]=(V[o+2]+F[o+2]*w*dt)*.96;P[o]+=V[o]*dt;P[o+1]+=V[o+1]*dt;P[o+2]+=V[o+2]*dt}}
 sbRigid(T,S,Q);V.fill(0);
 for(let i=0;i<N;i++){const o=i*3;if(Math.abs(P[o]-Q[o])+Math.abs(P[o+1]-Q[o+1])+Math.abs(P[o+2]-Q[o+2])<.002){P[o]=Q[o];P[o+1]=Q[o+1];P[o+2]=Q[o+2]}}
 sbFree(T,S);S.W+=Wp;S.hits++;S.ver++;
 let crush=0;for(const i of fp){const d=(P[i*3]-Q[i*3])*nx+(P[i*3+1]-Q[i*3+1])*ny+(P[i*3+2]-Q[i*3+2])*nz;if(d>crush)crush=d}
 return{steps,t,Wp,crush,maxPen,fp:fp.length}}
function sbCrash(T,S,I){const N=T.N,P=S.P,V=S.V,inv=T.invm,nx=I.n[0],nz=I.n[1],tx=-nz,tz=nx,F=new Float64Array(N*3),fp=[],R=I.R||0;
 const Q=new Float64Array(P);let s=1e9;
 for(let i=0;i<N;i++){if(S.free[i])continue;const y=P[i*3+1];if(y<I.ylo||y>I.yhi)continue;const t=(P[i*3]-I.c[0])*tx+(P[i*3+2]-I.c[1])*tz;if(Math.abs(t)>(R?R:I.hw))continue;fp.push(i);const d=(P[i*3]-I.c[0])*nx+(P[i*3+2]-I.c[1])*nz+(R?R-Math.sqrt(Math.max(0,R*R-t*t)):0);if(d<s)s=d}
 if(!fp.length||!(I.u>.3))return null;
 s-=.003;V.fill(0);const dt=SBK.dt,u=I.u;let t=0,steps=0,hit=false,Wp=0,Wc=0,maxPen=0,lastC=0,bad=false;const M=T.M;let Mt=0;for(let i=0;i<N;i++)Mt+=S.free[i]?0:M[i];
 while(t<SBK.tmax){F.fill(0);Wp+=sbBeams(T,S,F);s+=u*dt;let Fc=0;
  for(const i of fp){const t2=(P[i*3]-I.c[0])*tx+(P[i*3+2]-I.c[1])*tz,d=(P[i*3]-I.c[0])*nx+(P[i*3+2]-I.c[1])*nz+(R?R-Math.sqrt(Math.max(0,R*R-t2*t2)):0),p=s-d;if(p<=0)continue;
   const vn=V[i*3]*nx+V[i*3+2]*nz,fc=Math.max(0,SBK.kc*p+SBK.cc*(u-vn));F[i*3]+=fc*nx;F[i*3+2]+=fc*nz;Fc+=fc;if(p>maxPen)maxPen=p;hit=true;lastC=t}
  Wc+=Fc*u*dt;let mv=0;
  for(let i=0;i<N;i++){const o=i*3,w=inv[i];V[o]=(V[o]+F[o]*w*dt)*SBK.damp;V[o+1]=(V[o+1]+F[o+1]*w*dt)*SBK.damp;V[o+2]=(V[o+2]+F[o+2]*w*dt)*SBK.damp;P[o]+=V[o]*dt;P[o+1]+=V[o+1]*dt;P[o+2]+=V[o+2]*dt;if(!S.free[i])mv+=M[i]*(V[o]*nx+V[o+2]*nz)}
  t+=dt;steps++;if(!(Math.abs(P[0])<50)){bad=true;break}
  if(hit&&(mv/Mt>u-.04||t-lastC>.015)&&t>.01)break}
 if(bad){P.set(Q);V.fill(0);return{bad:true}}
 // moto rigido tolto (riferimento: pavimento dell'abitacolo), poi ritorno elastico con forte smorzamento: restano le deformazioni plastiche
 sbRigid(T,S,Q);V.fill(0);
 for(let it=0;it<240;it++){F.fill(0);Wp+=sbBeams(T,S,F);for(let i=0;i<N;i++){const o=i*3,w=inv[i];V[o]=(V[o]+F[o]*w*dt)*.96;V[o+1]=(V[o+1]+F[o+1]*w*dt)*.96;V[o+2]=(V[o+2]+F[o+2]*w*dt)*.96;P[o]+=V[o]*dt;P[o+1]+=V[o+1]*dt;P[o+2]+=V[o+2]*dt}}
 sbRigid(T,S,Q);V.fill(0);
 // residui minimi (rumore numerico dell'equilibrio elastico): i nodi spostati di meno di 2 mm restano dov'erano (niente ricalcolo di tutta la carrozzeria)
 for(let i=0;i<N;i++){const o=i*3;if(Math.abs(P[o]-Q[o])+Math.abs(P[o+1]-Q[o+1])+Math.abs(P[o+2]-Q[o+2])<.002){P[o]=Q[o];P[o+1]=Q[o+1];P[o+2]=Q[o+2]}}
 // parti staccate: i nodi rimasti senza travi seguono il vicino (niente stiramenti della carrozzeria)
 sbFree(T,S);S.W+=Wp;S.hits++;S.ver++;
 let crush=0;for(const i of fp){const d=(P[i*3]-Q[i*3])*nx+(P[i*3+2]-Q[i*3+2])*nz;if(d>crush)crush=d}
 return{steps,t,Wp,Wc,E:.5*Mt*u*u,crush,maxPen,fp:fp.length}}
/* nodi liberi (tutte le loro travi rotte): tornano alla forma del nodo vicino più spostato rispetto all'originale */
function sbFree(T,S){const cnt=new Int32Array(T.N);for(let b=0;b<T.NB;b++){if(S.br[b])continue;cnt[T.A[b]]++;cnt[T.B[b]]++}
 for(let i=0;i<T.N;i++){if(cnt[i]>0||S.free[i])continue;S.free[i]=1}
 for(let i=0;i<T.N;i++){if(!S.free[i])continue;let best=-1,bd=1e9;for(let j=0;j<T.N;j++){if(S.free[j])continue;const d=Math.hypot(T.P0[j*3]-T.P0[i*3],T.P0[j*3+1]-T.P0[i*3+1],T.P0[j*3+2]-T.P0[i*3+2]);if(d<bd){bd=d;best=j}}
  if(best>=0)for(let q=0;q<3;q++)S.P[i*3+q]=T.P0[i*3+q]+S.P[best*3+q]-T.P0[best*3+q]}}
/* --- grandezze per gli effetti: schiacciamento di muso e coda, intrusione laterale, zone, motore, mozzi, vetri, paraurti --- */
function sbDerive(T,S){const P=S.P,P0=T.P0,nb=T.nb,d=(i,q)=>P[i*3+q]-P0[i*3+q];
 let fC=0,rC=0,f2=0,f3=0;for(let j=0;j<4;j++)for(let l=0;l<2;l++){fC=Math.max(fC,-d(nb(0,j,l),2));rC=Math.max(rC,d(nb(8,j,l),2));f2=Math.max(f2,-d(nb(2,j,0),2));f3=Math.max(f3,-d(nb(3,j,l),2))}
 let sL=0,sR=0;for(let i=3;i<=6;i++)for(let l=0;l<2;l++){sL=Math.max(sL,-d(nb(i,3,l),0));sR=Math.max(sR,d(nb(i,0,l),0))}
 const reg=(i0,i1,j0,j1)=>{let m=0;for(let i=i0;i<=i1;i++)for(let j=j0;j<=j1;j++)for(let l=0;l<2;l++){const k=nb(i,j,l);m=Math.max(m,Math.hypot(d(k,0),d(k,1),d(k,2)))}return m};
 const zones=[reg(0,2,2,3),reg(0,2,0,1),reg(3,5,2,3),reg(3,5,0,1),reg(6,8,2,3),reg(6,8,0,1)];
 const hubs=[];for(let h=0;h<4;h++){const i=84+h,brk=T.HBI[h].filter(b=>S.br[b]).length,top=nb(h<2?2:6,h%2?0:3,1),fr=nb(h<2?2:6,h%2?0:3,0),rr=nb(h<2?3:7,h%2?0:3,0);
  hubs.push({dx:d(i,0),dy:d(i,1),dz:d(i,2),camber:Math.max(-.4,Math.min(.4,((d(i,0)-d(top,0))/.5)*(h%2?-1:1))),toe:Math.max(-.35,Math.min(.35,(d(fr,0)-d(rr,0))/.6)),lost:brk>=3||S.free[i]===1})}
 const brk=L=>L.filter(b=>{if(S.br[b])return true;const a=T.A[b]*3,c=T.B[b]*3;return Math.hypot(P[c]-P[a],P[c+1]-P[a+1],P[c+2]-P[a+2])<T.Lo[b]*.4}).length/Math.max(1,L.length);
 const gl=L=>L.some(b=>{const a=T.A[b]*3,c=T.B[b]*3,l=Math.hypot(P[c]-P[a],P[c+1]-P[a+1],P[c+2]-P[a+2]);return Math.abs(l-T.Lo[b])/T.Lo[b]>.015});
 let side=[0,0];for(const [j,sd] of [[3,0],[0,1]])for(let i=3;i<=6;i++){const k=nb(i,j,1);side[sd]=Math.max(side[sd],Math.abs(d(k,0)))}
 let lampF=[0,0],lampR=[0,0];for(const [j,sd] of [[3,0],[2,0],[0,1],[1,1]]){lampF[sd]=Math.max(lampF[sd],Math.hypot(d(nb(0,j,1),0),d(nb(0,j,1),2)),Math.hypot(d(nb(1,j,1),0),d(nb(1,j,1),2)));lampR[sd]=Math.max(lampR[sd],Math.hypot(d(nb(8,j,1),0),d(nb(8,j,1),2)),Math.hypot(d(nb(7,j,1),0),d(nb(7,j,1),2)))}
 let fS=0;for(const i of [1,2])for(const [j,ji] of [[0,1],[3,2]])for(let l=0;l<2;l++)fS=Math.max(fS,Math.abs(d(nb(i,j,l),0)-d(nb(i,ji,l),0)));   // il fianco del muso schiacciato verso l'interno (non la piega dell'intera auto)
 const hubBack=Math.max(0,-d(84,2),-d(85,2));
 const engine=Math.max(0,Math.min(1,1-Math.max(0,hubBack-.05)*1.5-Math.max(0,fC-.08)*.75-Math.max(0,fC-.45)*.3-Math.max(0,f2-.025)*5-Math.max(0,f3-.01)*3-Math.max(0,fS-.05)*2));
 return{fC,rC,f2,f3,fS,sL,sR,zones,hubs,engine,total:Math.min(1,S.W/3.2e5),fb:brk(T.att[0])>.5,rb:brk(T.att[1])>.5,ws:gl(T.glass.ws),rw:gl(T.glass.rw),sideGlass:[side[0]>.07,side[1]>.07],lampF:[lampF[0]>.08,lampF[1]>.08],lampR:[lampR[0]>.08,lampR[1]>.08],hood:fC>.95}}
/* --- legame carrozzeria-rete: per ogni vertice la cella (stazioni × colonne × strato) e le coordinate locali --- */
function sbCellOf(T,x,y,z){const ST=T.ST,CX=T.CX;let i=0;while(i<7&&z<ST[i+1])i++;const w=Math.max(0,Math.min(1,(ST[i]-z)/(ST[i]-ST[i+1])));
 let j=0;while(j<2&&x>CX[j+1])j++;const u=Math.max(0,Math.min(1,(x-CX[j])/(CX[j+1]-CX[j])));
 // sopra la cintura, fra il montante A e il lunotto: cella superiore verso il tetto (parabrezza e lunotto inclinati)
 if(y>T.YB+.04&&i>=3&&i<=6){return{c:24+(i-3)*3+j,u,v:-1,w}}
 const v=Math.max(0,Math.min(1,(y-T.YF)/(T.YB-T.YF)));return{c:i*3+j,u,v,w}}
function sbCellNodes(T,c){const nb=T.nb,nr=T.nr;if(c<24){const i=Math.floor(c/3),j=c%3;return[nb(i,j,0),nb(i,j+1,0),nb(i,j,1),nb(i,j+1,1),nb(i+1,j,0),nb(i+1,j+1,0),nb(i+1,j,1),nb(i+1,j+1,1)]}
 const q=c-24,i=3+Math.floor(q/3),j=q%3,top=(st,jj)=>st===3?nb(3,jj,1):st===7?nb(7,jj,1):nr(st-4,jj);
 return[nb(i,j,1),nb(i,j+1,1),top(i,j),top(i,j+1),nb(i+1,j,1),nb(i+1,j+1,1),top(i+1,j),top(i+1,j+1)]}
function sbBind(T,pos){const n=pos.length/3,cell=new Uint8Array(n),uvw=new Float32Array(n*3),P0=T.P0;
 for(let k=0;k<n;k++){const x=pos[k*3],y=pos[k*3+1],z=pos[k*3+2],r=sbCellOf(T,x,y,z);let v=r.v;
  if(v<0){const N=sbCellNodes(T,r.c),bl=(a,b)=>P0[N[a]*3+1]*(1-r.u)+P0[N[b]*3+1]*r.u,y0=bl(0,1)*(1-r.w)+bl(4,5)*r.w,y1=bl(2,3)*(1-r.w)+bl(6,7)*r.w;v=Math.max(0,Math.min(1.15,(y-y0)/Math.max(.05,y1-y0)))}
  cell[k]=r.c;uvw[k*3]=r.u;uvw[k*3+1]=v;uvw[k*3+2]=r.w}
 return{cell,uvw}}
/* --- carrozzeria deformata: spostamento interpolato dai nodi + pieghe della lamiera dove il metallo è schiacciato --- */
function sbNodeCrumple(T,S){const c=new Float32Array(T.N);for(let b=0;b<T.NB;b++){const sh=Math.max(0,1-S.L0[b]/T.Lo[b])+(S.br[b]?.15:0);if(sh>c[T.A[b]])c[T.A[b]]=sh;if(sh>c[T.B[b]])c[T.B[b]]=sh}return c}
function sbSkin(T,S,bind,base,nrm0,out,chg,wr,cr){const P=S.P,P0=T.P0,n=base.length/3,NC=33,D=new Float32Array(NC*24),act=new Uint8Array(NC),CR=new Float32Array(NC*8);let moved=0;
 for(let c=0;c<NC;c++){const N=sbCellNodes(T,c);let a=0;for(let q=0;q<8;q++){const i=N[q];for(let e=0;e<3;e++){const v=P[i*3+e]-P0[i*3+e];D[c*24+q*3+e]=v;if(Math.abs(v)>.003)a=1}CR[c*8+q]=cr?cr[i]:0}act[c]=a}
 for(let k=0;k<n;k++){const c=bind.cell[k],o3=k*3;let nx,ny,nz;
  if(!act[c]){nx=base[o3];ny=base[o3+1];nz=base[o3+2]}
  else{const u=bind.uvw[o3],v=Math.min(1,bind.uvw[o3+1]),w=bind.uvw[o3+2],o=c*24,W0=(1-u)*(1-v)*(1-w),W1=u*(1-v)*(1-w),W2=(1-u)*v*(1-w),W3=u*v*(1-w),W4=(1-u)*(1-v)*w,W5=u*(1-v)*w,W6=(1-u)*v*w,W7=u*v*w;
   const dx=W0*D[o]+W1*D[o+3]+W2*D[o+6]+W3*D[o+9]+W4*D[o+12]+W5*D[o+15]+W6*D[o+18]+W7*D[o+21],dy=W0*D[o+1]+W1*D[o+4]+W2*D[o+7]+W3*D[o+10]+W4*D[o+13]+W5*D[o+16]+W6*D[o+19]+W7*D[o+22],dz=W0*D[o+2]+W1*D[o+5]+W2*D[o+8]+W3*D[o+11]+W4*D[o+14]+W5*D[o+17]+W6*D[o+20]+W7*D[o+23];
   nx=base[o3]+dx;ny=base[o3+1]+dy;nz=base[o3+2]+dz;
   if(wr&&nrm0){const cc=c*8,cm=W0*CR[cc]+W1*CR[cc+1]+W2*CR[cc+2]+W3*CR[cc+3]+W4*CR[cc+4]+W5*CR[cc+5]+W6*CR[cc+6]+W7*CR[cc+7];
    // pieghe della lamiera: onde larghe (25-35 cm) trasversali allo schiacciamento, irregolari, più marcate dove il metallo è più compresso;
    // sulle superfici rivolte in alto (cofano, baule) la piega tende a sollevarsi come una lamiera che si imbarca
    // la direzione delle pieghe segue la spinta: muso o coda schiacciati in lunghezza → pieghe a fisarmonica trasversali;
    // fiancata spinta verso l'interno (porte, parafanghi) → pieghe quasi orizzontali lungo le traverse di rinforzo, ondulate e irregolari;
    // il passaggio fra i due disegni è graduale (peso w sulla direzione dello spostamento), così non si aprono gradini nella lamiera
    if(cm>.03){const x=base[o3],y=base[o3+1],z=base[o3+2],q=Math.abs(dx)/(Math.abs(dx)+Math.abs(dz)+.005),w=q<.4?0:q>.7?1:(q-.4)/.3,
      fA=w<1?Math.sin(z*19+y*11+2.6*Math.sin(x*5.3+y*3.1))*(.6+.4*Math.sin(x*13.7+y*9.1+z*3.3))+.4*Math.sin(y*23-z*8.3+x*6.1):0,
      fB=w>0?Math.sin(y*22+1.7*Math.sin(z*6.1+x*2.3)+.8*Math.sin(z*14.3))*(.55+.45*Math.sin(z*8.9+y*4.7))+.25*Math.sin(z*12.7-y*6.9):0,
      f=fA*(1-w)+fB*w,a=Math.min(.065,(cm-.03)*.13)*(f+(nrm0[o3+1]>.6?.55:0));nx+=nrm0[o3]*a;ny+=nrm0[o3+1]*a;nz+=nrm0[o3+2]*a}}}
  if(Math.abs(nx-out[o3])>3e-4||Math.abs(ny-out[o3+1])>3e-4||Math.abs(nz-out[o3+2])>3e-4){out[o3]=nx;out[o3+1]=ny;out[o3+2]=nz;chg[k]=1;moved++}}
 return moved}
