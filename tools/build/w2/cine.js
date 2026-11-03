/* ===== MOMENTI SPETTACOLARI (Versione 20) =====
   Sugli eventi più forti vicino al giocatore (strisce chiodate prese, scatola che si chiude o lo ferma, pattuglia che sbuca
   all'incrocio, urti violenti, ribaltamenti) il gioco rallenta per un attimo e la telecamera passa a un'inquadratura bassa
   di lato all'azione, poi torna normale. Si può spegnere nel pannello della polizia ("Momenti spettacolari").
   Tempo reale (non quello del gioco) per la durata, così il rallentatore non si allunga da solo. */
const CINE={k:1,kT:1,t0:0,t1:0,cool:0,cam:null,n:0,last:'',log:[],
 PRI:{flip:3,boxWin:3,spike:2,pincer:2,box:1,crash:2,pit:2},
 ev(kind,x,z,o){o=o||{};CINE.log.push({kind,t:PD.t});if(CINE.log.length>40)CINE.log.shift();CINE.last=kind;
  if(PD.cfg.cine===false||typeof inCar==='undefined'||!inCar)return false;const px=C.x,pz=C.z;if(Math.hypot(x-px,z-pz)>(o.r||65))return false;
  const now=performance.now(),pr=CINE.PRI[kind]||1;if(now<CINE.t1){if(pr<=(CINE.curP||0))return false}else if(now<CINE.cool&&pr<3)return false;
  const dur=o.dur||(kind==='flip'?2.2:kind==='boxWin'?1.8:1.4),slow=o.slow||(kind==='box'?.5:.3);
  // inquadratura: di lato e un po' avanti all'evento, bassa; se c'è un muro si prova l'altro lato
  const h=o.h!==undefined?o.h:C.h,fx=Math.sin(h),fz=Math.cos(h),rx=-fz,rz=fx;let best=null;
  for(const s of [1,-1]){const dx=rx*s*.82+fx*.57,dz=rz*s*.82+fz*.57,d=clipDist(x,z,dx,dz,9,1);if(!best||d>best.d)best={d,dx,dz}}
  const dd=Math.max(3.2,best.d-.6);CINE.cam={x:x+best.dx*dd,z:z+best.dz*dd,y:GY(x+best.dx*dd,z+best.dz*dd)+1.05,lx:x,lz:z,ly:GY(x,z)+.75,follow:o.follow!==false};
  CINE.kT=slow;CINE.t0=now;CINE.t1=now+dur*1000;CINE.cool=CINE.t1+10000;CINE.curP=pr;CINE.kind=kind;CINE.n++;return true},
 // fattore del tempo di gioco per questo fotogramma (entrata e uscita dolci)
 step(rdt){const now=performance.now();if(now>=CINE.t1){CINE.kT=1;CINE.cam=null;CINE.curP=0}CINE.k+=(CINE.kT-CINE.k)*Math.min(1,rdt*9);if(Math.abs(CINE.k-1)<.01)CINE.k=1;return CINE.k},
 // la telecamera segue l'evento (il punto guardato si sposta con l'auto del giocatore se l'evento è suo)
 apply(){const q=CINE.cam;if(!q||!inCar||view===3)return;let lx=q.lx,lz=q.lz;if(q.follow){lx=(lx+C.x)/2;lz=(lz+C.z)/2}cam.position.set(q.x,q.y,q.z);cam.lookAt(lx,q.ly,lz)}};
