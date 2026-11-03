/* ===== POLIZIA v6: carreggiata giusta in autostrada, uscite seguite, chi vede il veicolo si unisce, rinforzi da dietro e dagli ingressi,
   chiusura di caselli e barriere, segnalazioni dei cittadini, elicottero del Reparto Volo ===== */
Object.assign(PDL,{
 ackSee:['{u2}: ricevuto, centrale. Lo vedo già, {place}: mi unisco.','{u2}: ricevuto, ce l\'ho davanti {place}. Lo seguo.','{u2}: copiato, veicolo già in vista {place}.'],
 oppSide:['{u}: lo vedo passare sulla carreggiata opposta, {place}, va verso {card}.','{u} a centrale: veicolo in senso contrario al mio, {place}. Qui non posso invertire, segnalo.','{u}: incrociato sulla carreggiata opposta, {place}, direzione {card}.'],
 joinSight:['{u}: lo vedo, {place}. Mi unisco all\'inseguimento.','{u}: veicolo ricercato in vista {place}, direzione {card}. Mi accodo.','{u} a centrale: ho il veicolo davanti, {place}, lo seguo.','{u}: eccolo, è passato davanti a me {place}. Lo inseguo.'],
 exitTaken:['{u}: il veicolo esce allo svincolo di {ic}!','{u}: ha preso l\'uscita {ic}, lo seguo sulla rampa.','{u}: attenzione, esce a {ic}.'],
 tollBlock:['Centrale: chiudete il casello di {ic}, posto di blocco con {list}.','Centrale a tutte le unità: blocco al casello di {ic}, {list} in posizione tra {eta} secondi.'],
 barBlock:['Centrale: blocco alla barriera di {ic} con {list}, in posizione tra {eta} secondi.','Centrale: la Stradale chiude la barriera di {ic}. In posizione {list}.'],
 witness:['Centrale: un cittadino segnala il veicolo {place}, direzione {card}.','Centrale: segnalazione al 112, veicolo visto {place}.','Centrale a tutte le unità: testimone lo ha visto {place}, va verso {card}.'],
 heliReq:['Centrale: richiesto l\'elicottero del Reparto Volo, in zona tra {eta} secondi.','Centrale a tutte le unità: Volo 1 in decollo, sarà sopra di voi tra {eta} secondi.'],
 heliSees:['{u}: siamo sopra al veicolo, {place}, direzione {card}. Lo seguiamo dall\'alto.','{u}: abbiamo il veicolo in vista {place}, procede verso {card} a circa {kmh} chilometri orari.','{u}: contatto dall\'alto, {place}. Vi guidiamo noi.'],
 heliUpd:['{u}: il veicolo prosegue verso {card}, {place}, circa {kmh} chilometri orari.','{u}: lo teniamo, {place}. Direzione {card}.','{u}: ancora in vista, {place}, velocità circa {kmh}.'],
 heliLost:['{u}: perso di vista {cover}. Allargo il giro.','{u}: non lo vedo più, si è infilato {cover}.','{u}: contatto perso {cover}, cerchiamo in zona.'],
 heliLeave:['{u}: carburante al limite, rientriamo alla base.','{u}: lasciamo la zona, rientro alla base.']});
/* contesto del bersaglio: tratto stradale (con la direzione di marcia) e terreno aperto (vista più lunga) */
function pdTargetCtx(T){T.seg=pdBestSeg(T.x,T.z,10,T.dirA);T.exiting=false;pdExitIntent(T);if(!T.zt||PD.t-T.zt>.5||T.zt>PD.t){T.zt=PD.t;const z=WORLD.zone(T.x,T.z);T.open=z===14||z===15||z===5||z===7}}
function pdSegOf(T){if(T.seg===undefined){const a=T.dirA!==undefined?T.dirA:Math.atan2(T.dx||0,T.dz||1);T.seg=pdBestSeg(T.x,T.z,12,a)}return T.seg}
/* velocità di marcia delle unità in emergenza secondo la strada percorsa */
function pdRoadV(u){const b=pdBestSeg(u.x,u.z,14,u.h),s=b&&b.s;if(!s)return 28;if(s.mw&&!s.tp)return 50;if(s.ramp)return 21;if(s.k===4)return 40;if(s.k===7||s.ss)return 34;if(s.k===0||s.k===9)return 30;if(s.k===2)return 15;return 26}
/* chi vede il veicolo ricercato si unisce subito (pattuglie di zona, unità in rientro o dirette altrove) */
function pdSightJoin(u,T){const c=PD.case;if(!c||c.phase==='ended'||u.case===c.id||u.status==='disabled'||u.status==='holding'||u.status==='gone')return;
 if(u.assign&&u.assign.kind==='block')return;const d=Math.hypot(u.x-T.x,u.z-T.z);if(d>220)return;
 // sulla carreggiata opposta dell'autostrada non può raggiungerlo: segnala dove passa (aggiorna il caso) e resta al suo posto
 {const us=pdBestSeg(u.x,u.z,10,u.h),ts=T.seg;if(us&&ts&&us.s.mw&&!us.s.tp&&ts.s.mw&&!ts.s.tp&&us.s.mw===ts.s.mw&&us.s.side!==ts.s.side){if(PD.t-(u.oppT||-99)>4){u.oppT=PD.t;const o={x:T.x,z:T.z,vx:T.vx,vz:T.vz,h:T.h,t:PD.t,src:'visual',by:u.id};c.last=o;c.visT=PD.t;PD.intelQ.push({at:PD.t+.8,o,from:u.id});if(c.phase==='search'){c.phase='pursuit';c.lostAnn=false;EV.emit('contactRegained',{id:c.id,by:u.name})}
   if(PD.t-(c.oppSay||-99)>12){c.oppSay=PD.t;pdSay('oppSide',u,{place:pdPlace(T.x,T.z),card:pdCard(T.dx,T.dz)},2,{force:true})}EV.emit('oppSight',{id:u.id,name:u.name})}return}}
 const ack=!!(u.assign&&u.ackA===u.assign);u.ackA=null;if(u.assign){DSP.ledger.delete(u.id);u.assign=null}pdJoin(u,'support');u.vcruise=11;pdObserve(u,T);
 EV.emit('sightJoin',{id:u.id,name:u.name,place:pdPlace(T.x,T.z),card:pdCard(T.dx,T.dz),ack});plog('decisione',u.name+': vede il veicolo ricercato a '+Math.round(d)+' m e si unisce',{});
 if(c.phase==='search'){c.phase='pursuit';c.lostAnn=false;c.visT=PD.t;EV.emit('contactRegained',{id:c.id,by:u.name})}}
/* inseguimento: se l'unità è in autostrada ma il bersaglio è su un'altra carreggiata o ha preso l'uscita, segue la rete (rampa, varco) invece di puntare dritto */
function pdChase(u,T,gap,vmax,dt){const dT=Math.hypot(T.x-u.x,T.z-u.z);if(u.utm)return pdChase0(u,T,gap,vmax,dt);
 const rf=pdRoadFrame(u),us=rf&&rf.s,tq=pdSegOf(T),ts=tq&&tq.s,uMw=!!(us&&us.mw&&!us.tp),tMw=!!(ts&&ts.mw&&!ts.tp),same=uMw&&tMw&&ts.mw===us.mw&&ts.side===us.side;
 if(uMw&&!same&&dT>16){const key=ts?(ts.mw?'m'+ts.mw+':'+ts.side:'r'+(ts.icn||ts.nm||ts.k)):'x',gh=T.dirA!==undefined?T.dirA:Math.atan2(T.dx,T.dz);let r=u.chaseRoute;
  if(!r||!r.ok||!r.v6||PD.t-r.made>1.6||(r.tkey!==key&&PD.t-r.made>.4)||Math.hypot(r.goal.x-T.x,r.goal.z-T.z)>45){r=pdRoute(u.x,u.z,T.x,T.z,u.h,false,gh);r.goal={x:T.x,z:T.z};r.made=PD.t;r.ri=1;r.tkey=key;r.v6=1;u.chaseRoute=r}
  if(r.ok){pdFollowRoute(u,r,Math.max(vmax,pdRoadV(u)),0,T.sp>3);return}}
 return pdChase0(u,T,gap,vmax,dt)}
/* rinforzi di zona: in autostrada arrivano da dietro sulla stessa carreggiata o entrano dallo svincolo successivo; in città mai su autostrade, rampe o varchi */
function dspAreaSpots(dest,n){const e=pdCaseEst()||Object.assign({dirA:0,dx:0,dz:1},dest),out=[];const es=pdBestSeg(e.x,e.z,14,e.dirA);
 if(es&&es.s.mw&&!es.s.tp){const M=WORLD.MWS[es.s.mw-1],q0=M&&M.proj(e.x,e.z,80),q=q0&&{s:q0.s,d:q0.d};if(q){const tv=M.tan(q.s),dir=(Math.sin(e.dirA)*tv[0]+Math.cos(e.dirA)*tv[1])>=0?1:-1,side=es.s.side,f=()=>pdRnd()<.5?'CC':'PS';
   for(const back of [950,1300,1700,2100]){if(out.length>=n)break;const s=q.s-dir*back;if(s<80||s>M.L-80)continue;const p=M.p(s,side*8.75);if(!pdHidden(p[0],p[1]))continue;out.push({name:'pattuglia della Stradale',force:'PS',x:p[0],z:p[1],area:true,mw:1})}
   for(const ic of M.ic){if(out.length>=n)break;const ds=(ic.s-q.s)*dir;if(ds<550||ds>5000)continue;const J=dir>0?ic.jN:ic.jS,mg=M.nodes[dir>0?1:-1][ic.s+dir*650];if(!J||!mg)continue;if(!pdHidden(J[0],J[1]))continue;out.push({name:'pattuglia all\'ingresso di '+ic.name,force:f(),x:J[0],z:J[1],area:true,aheadDest:{x:mg[0],z:mg[1]}})}}
  return out}
 const cx=Math.floor((dest.x+WORLD.WS)/WORLD.CSZ),cz=Math.floor((dest.z+WORLD.WS)/WORLD.CSZ),cand=[];
 for(let dz=-3;dz<=3;dz++)for(let dx=-3;dx<=3;dx++){const a=WORLD.SCH.get((cx+dx)+','+(cz+dz));if(a)for(const id of a){const s=RSL[id];if(s.len<14||s.pv||s.pol||s.tp||s.mw||s.ramp||s.br)continue;const mx=(s.ax+s.bx)/2,mz=(s.az+s.bz)/2,d=Math.hypot(mx-dest.x,mz-dest.z);if(d<150||d>430)continue;cand.push(s)}}
 let tries=0;while(out.length<n&&tries++<40&&cand.length){const s=cand[Math.floor(pdRnd()*cand.length)],a=.2+pdRnd()*.6,x=s.ax+(s.bx-s.ax)*a,z=s.az+(s.bz-s.az)*a;if(!pdHidden(x,z)||WORLD.wet(x,z)||Math.hypot(x-e.x,z-e.z)<160)continue;if(out.some(o=>Math.hypot(o.x-x,o.z-z)<70))continue;out.push({name:'pattuglia di zona',force:pdRnd()<.5?'CC':'PS',x,z,area:true})}
 return out}
function dspQueueSpawn(q){if(q.st&&q.st.aheadDest&&q.kind==='respond')q.dest=q.st.aheadDest;return dspQueueSpawn0(q)}
/* posto di blocco in un punto scelto (casello, barriera): unità che arrivano prima del veicolo, auto di traverso */
DSP.blockAt=function(c,pick,ev){const e=pdCaseEst();if(!e)return false;const vT=Math.max(9,pick.vcap?Math.min(e.sp,pick.vcap):e.sp),tReach=pick.dist/vT;const n=pick.n||(pick.w>=15?4:3);
 const cand=dspCandidates({x:pick.x,z:pick.z},null,true),ok=cand.filter(k=>k.eta<tReach*.95).slice(0,n);if(ok.length<(pick.min||2)){plog('centrale','blocco a '+pick.label+' non possibile: unità troppo lontane ('+(cand[0]?Math.round(cand[0].eta)+' s':'-')+' contro '+Math.round(tReach)+' s)',{});return false}
 const nx=-pick.dz,nz=pick.dx,names=[],sp=Math.min(5,(pick.w+3)/Math.max(1,ok.length-1));ok.forEach((k,i)=>{const off=(i-(ok.length-1)/2)*sp,sx=pick.x+nx*off,sz=pick.z+nz*off,ex={eta:k.eta,spot:{x:sx,z:sz},dir:{x:pick.dx,z:pick.dz},phase:'route'};
  if(k.u){ex.segId=pick.id;dspAssign(k.u,'block',{x:pick.x,z:pick.z},ex);names.push(k.u.name)}else{dspQueueSpawn({st:k.st,t0:PD.t,dest:{x:pick.x,z:pick.z},eta:k.eta,kind:'block',spot:ex.spot,dir:ex.dir,segId:pick.id});names.push(k.st.force==='CC'?'una pattuglia dei Carabinieri':'una Volante')}});
 if(pick.id!==undefined)PD.blocked.set(pick.id,PD.t+150);c.rbDone=true;const eta=Math.round(Math.min(...ok.map(k=>k.eta)));
 pdSay(ev,'C',{ic:pick.label,list:pdNames(names),eta:Math.max(1,eta)},3,{force:true});EV.emit('roadblock',{names,eta,place:pdPlace(pick.x,pick.z),w:pick.w,n:ok.length,dest:{x:pick.x,z:pick.z},dist:Math.round(pick.dist),partial:ok.length<n,silent:true});plog('centrale','posto di blocco a '+pick.label+' con '+ok.length+' unità',{});return true};
function pdSegAt(x,z,pred){let best=null,bd=1e9;const cx=Math.floor((x+WORLD.WS)/WORLD.CSZ),cz=Math.floor((z+WORLD.WS)/WORLD.CSZ);for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){const a=WORLD.SCH.get((cx+i)+','+(cz+j));if(a)for(const id of a){const s=RSL[id];if(pred&&!pred(s))continue;const d=pdSegDist(x,z,[s.ax,s.az],[s.bx,s.bz]);if(d<bd){bd=d;best={id,s,d}}}}return best}
/* strategie del direttore: uscite, caselli e barriere, segnalazioni, elicottero */
function pdStrategy(c,dt){const T=PD.T,tq=T.seg,ts=tq&&tq.s,lead=PD.units.find(u=>u.id===c.lead&&u.case===c.id)||PD.units.find(u=>u.case===c.id);c.st6=c.st6||{exits:{},bar:{},witT:PD.t};const S6=c.st6;
 // il veicolo esce allo svincolo: annuncio e chiusura del casello
 if(ts&&ts.ramp&&ts.icn&&/^uscita/.test(ts.nm||'')&&!S6.exits[ts.icn]){S6.exits[ts.icn]=PD.t;if(lead)pdSay('exitTaken',lead,{ic:ts.icn},3,{force:true});EV.emit('exitTaken',{ic:ts.icn});
  let M=null,ic=null;for(const m of WORLD.MWS)for(const q of m.ic)if(q.name===ts.icn){M=m;ic=q}
  if(ic&&c.phase!=='ended'){const ty=ic.tside||1,u=ic.tv,v=ic.nv,p=[ic.cx+v[0]*270*ty,ic.cz+v[1]*270*ty],sg=pdSegAt(p[0],p[1],s=>!s.mw&&!s.ramp&&!s.tp),r=pdRoute(T.x,T.z,p[0],p[1],T.dirA);
   if(sg&&r.ok){const dx=v[0]*ty,dz=v[1]*ty;DSP.blockAt(c,{x:p[0],z:p[1],dx,dz,w:13,n:3,id:sg.id,dist:r.len,label:ic.name,vcap:24,min:1},'tollBlock')}}}
 // in autostrada verso una barriera: la Stradale la chiude (una volta per barriera)
 if(ts&&ts.mw&&!ts.tp&&c.phase==='pursuit'&&c.heat>=2.4&&PD.t-c.pursuitT0>8){const M=WORLD.MWS[ts.mw-1],q0=M&&M.proj(T.x,T.z,60),q=q0&&{s:q0.s,d:q0.d};if(q){const tv=M.tan(q.s),dir=(T.dx*tv[0]+T.dz*tv[1])>=0?1:-1;for(const b of M.bar){const ds=(b.s-q.s)*dir;if(ds<900||ds>6500||S6.bar[b.name])continue;S6.bar[b.name]=PD.t;const s0=b.s-dir*130,side=dir>0?1:-1,p=M.p(s0,side*8.75),t2=M.tan(s0),sg=pdSegAt(p[0],p[1],s=>s.mw&&s.side===side);if(sg)DSP.blockAt(c,{x:p[0],z:p[1],dx:t2[0]*dir,dz:t2[1]*dir,w:13.5,n:3,id:sg.id,dist:ds-130,label:b.name},'barBlock');break}}}
 // segnalazioni dei cittadini durante la ricerca
 if(c.phase==='search'&&PD.t-S6.witT>9){S6.witT=PD.t;const n=pdCivil(T);if(n>=2&&pdRnd()<.55){const o={x:T.x+(pdRnd()-.5)*40,z:T.z+(pdRnd()-.5)*40,vx:T.vx,vz:T.vz,h:T.h,t:PD.t,src:'witness',by:0};c.last=o;for(const u of PD.units)if(u.case===c.id)u.kn=Object.assign({},o);c.searchAssigned=0;pdSay('witness','C',{place:pdPlace(o.x,o.z),card:pdCard(T.dx,T.dz)},2,{force:true});EV.emit('witness',{place:pdPlace(o.x,o.z)})}}
 // elicottero: inseguimento grave che dura
 if(!PD.heli&&c.heat>=3.2&&PD.t-(c.pursuitT0||c.t0)>16&&PD.t>(PD.heliCool||0))pdHeliRequest(c)}
/* ===== elicottero del Reparto Volo ===== */
const HELI_BASES=()=>{const b=[{name:'base del Reparto Volo della città',x:1850,z:-250}];for(const M of WORLD.MWS||[])for(const a of M.sa){const q=M.p(a.s,side0(a)*160);b.push({name:'elibase dell\'area di servizio '+a.name,x:q[0],z:q[1]})}if(WORLD.MILAN)b.push({name:'base del Reparto Volo di Milano',x:WORLD.MILAN.x-2600,z:WORLD.MILAN.z-2100});for(const c of WORLD.CITIES||[])b.push({name:'elibase di '+c.name,x:c.x+1100,z:c.z+900});return b};
function pdHeliRequest(c){const e=pdCaseEst()||PD.T;let b=null,bd=1e9;for(const q of HELI_BASES()){const d=Math.hypot(q.x-e.x,q.z-e.z);if(d<bd){bd=d;b=q}}const eta=Math.round(12+bd/72);
 PD.heli={id:-7,name:'Volo 1',force:'PS',vi:2,comm:{last:-99},status:'ok',x:b.x,z:b.z,y:GY(b.x,b.z),alt:0,h:0,vx:0,vz:0,state:'takeoff',tReady:PD.t+12,fuel:230,sees:false,seenT:-99,pc:0,upT:PD.t,base:b,case:c.id,t0:PD.t,rot:0,orb:pdRnd()*6};
 pdSay('heliReq','C',{eta},3,{force:true});EV.emit('heliReq',{eta,base:b.name});plog('centrale','richiesto l\'elicottero dalla '+b.name+' (ETA '+eta+' s)',{})}
/* copertura dall'alto: sotto un cavalcavia, un ponte o un viadotto, sotto l'area di servizio a ponte, nei vicoli stretti dei centri storici */
function pdCovered(T){const ty=(typeof inCar!=='undefined'&&inCar)?V.y:P.y;
 for(const b of WORLD.BR){const dx=b.bx-b.ax,dz=b.bz-b.az,l2=dx*dx+dz*dz;if(l2<1)continue;const t=((T.x-b.ax)*dx+(T.z-b.az)*dz)/l2;if(t<0||t>1)continue;const d=Math.hypot(b.ax+dx*t-T.x,b.az+dz*t-T.z);if(d<b.w/2+1.5&&WORLD.deckAt(b,t)>ty+3)return b.over?'sotto il cavalcavia':'sotto il ponte'}
 for(const s of WORLD.SPEC){if(s.t!=='sa'||!s.bridge)continue;const c=Math.cos(s.a),sn=Math.sin(s.a),dx=T.x-s.x,dz=T.z-s.z,lx=dx*c+dz*sn,lz=(-dx*sn+dz*c)*s.side;if(Math.abs(lx)<14&&lz<-16&&lz>-86)return 'sotto l\'area di servizio'}
 const tq=T.seg;if(tq&&tq.s.k===2){const z=WORLD.zone(T.x,T.z);if((z===0||z===9||z===16||z===18||z===10)&&Math.floor(PD.t/2.5)%3!==0)return 'nei vicoli'}
 return null}
function pdHeliObserve(h,c,T){const o={x:T.x,z:T.z,vx:T.vx,vz:T.vz,h:T.h,t:PD.t,src:'visual',by:-7};c.last=o;c.visT=PD.t;
 if(c.phase==='search'){c.phase='pursuit';c.lostAnn=false;EV.emit('contactRegained',{id:c.id,by:h.name})}
 if(PD.t-(h.intelT||0)>1.2){h.intelT=PD.t;PD.intelQ.push({at:PD.t+.8,o,from:-7})}}
function pdHeliStep(dt){const h=PD.heli;if(!h)return;const c=PD.case,T=PD.T;h.rot+=dt;
 if(h.state==='takeoff'){h.alt=Math.min(8,h.alt+dt*.6);pdHeliRender(h,dt);if(PD.t<h.tReady)return;h.state='inbound';pdSay('heliUpd',h,{place:'in volo verso '+pdPlace(T.x,T.z),card:pdCard(T.dx,T.dz),kmh:Math.round(T.sp*3.6)},1)}
 const active=c&&c.phase!=='ended'&&c.id===h.case;if(!active&&h.state!=='leave'){h.state='leave';h.sees=false;pdSay('heliLeave',h,{},2,{force:true});EV.emit('heliLeave',{why:'fine'})}
 if(h.state!=='leave'){h.fuel-=dt;if(h.fuel<=0){h.state='leave';h.sees=false;PD.heliCool=PD.t+90;pdSay('heliLeave',h,{},3,{force:true});EV.emit('heliLeave',{why:'carburante'})}}
 // perception a 2 Hz
 h.pc+=dt;if(h.pc>=.5&&h.state!=='leave'){h.pc=0;const dd=Math.hypot(T.x-h.x,T.z-h.z),cov=pdCovered(T),can=dd<560&&!cov&&h.alt>30;h.cov=cov;
  if(can){if(!h.sees){h.sees=true;h.state='track';pdSay('heliSees',h,{place:pdPlace(T.x,T.z),card:pdCard(T.dx,T.dz),kmh:Math.round(T.sp*3.6)},3,{force:true});EV.emit('heliSees',{})}h.seenT=PD.t;pdHeliObserve(h,c,T);if(PD.t-h.upT>16){h.upT=PD.t;pdSay('heliUpd',h,{place:pdPlace(T.x,T.z),card:pdCard(T.dx,T.dz),kmh:Math.round(T.sp*3.6)},1)}}
  else if(h.sees&&PD.t-h.seenT>1.6){h.sees=false;h.state='search';pdSay('heliLost',h,{cover:cov||'fra gli edifici'},3,{force:true});EV.emit('heliLost',{cover:cov})}}
 // rotta: dietro al veicolo quando lo vede, in cerchio sull'ultima posizione quando lo cerca, verso la base al rientro
 let tx,tz,vmax=72;if(h.state==='leave'){tx=h.base.x;tz=h.base.z;vmax=55}else if(h.sees){tx=T.x-T.dx*45+T.rx*25;tz=T.z-T.dz*45+T.rz*25}else{const e=pdCaseEst()||{x:T.x,z:T.z},R=h.state==='search'?170:0,a=h.orb+PD.t*.32;tx=e.x+Math.cos(a)*R;tz=e.z+Math.sin(a)*R}
 const dx=tx-h.x,dz=tz-h.z,d=Math.hypot(dx,dz)||1,want=Math.min(vmax,h.sees?Math.max(T.sp+8,d*.9):d*.7+8),k=Math.min(1,dt*.9);h.vx+=(dx/d*want-h.vx)*k;h.vz+=(dz/d*want-h.vz)*k;h.x+=h.vx*dt;h.z+=h.vz*dt;
 const sp=Math.hypot(h.vx,h.vz);if(sp>2){const ha=Math.atan2(h.vx,h.vz);h.h+=pdWrap(ha-h.h)*Math.min(1,dt*1.5)}h.alt+=((h.state==='leave'&&Math.hypot(h.x-h.base.x,h.z-h.base.z)<60?0:(h.sees?58:75))-h.alt)*Math.min(1,dt*.6);h.y=GY(h.x,h.z)+h.alt;h.sp=sp;
 const dP=Math.hypot(h.x-T.x,h.z-T.z);if(pdAudio.rotor)pdAudio.rotor(PD.cfg.siren?Math.max(0,1-dP/900):0);
 if(h.state==='leave'&&(dP>2200||Math.hypot(h.x-h.base.x,h.z-h.base.z)<40&&h.alt<3)){pdHeliDrop();PD.heli=null;if(pdAudio.rotor)pdAudio.rotor(0);return}
 pdHeliRender(h,dt)}
function pdHeliDrop(){const m=PD.heliMdl;if(m){m.g.visible=false;sc.remove(m.g);PD.heliMdl=null}}
function pdHeliModel(){const g=new T.Group(),blue=new T.MeshStandardMaterial({color:lc(0x1f4e9e),roughness:.45,metalness:.3}),white=new T.MeshStandardMaterial({color:lc(0xf2f2f2),roughness:.5}),dark=new T.MeshStandardMaterial({color:lc(0x16181c),roughness:.6}),glass=new T.MeshStandardMaterial({color:lc(0x0e1a22),roughness:.05,metalness:.2,transparent:true,opacity:.75});
 const bx=(w,h2,d,x,y,z,m,p)=>{const o=new T.Mesh(new T.BoxGeometry(w,h2,d),m);o.position.set(x,y,z);(p||g).add(o);return o};
 bx(1.75,1.6,4.2,0,0,0,blue);bx(1.78,.38,4.24,0,-.2,0,white);bx(1.55,1.15,1.3,0,.1,2.45,glass);bx(1.4,.9,.8,0,-.35,2.9,blue);bx(.36,.38,5.2,0,.38,-4.5,blue);bx(.1,1.5,.9,0,1.05,-6.9,blue);bx(1.9,.08,.55,0,.45,-6.4,white);bx(.9,.5,1.4,0,1.0,-.4,dark);
 for(const sd of [1,-1]){bx(.1,.1,3.6,sd*.85,-1.25,.2,dark);bx(.08,.5,.08,sd*.8,-1.0,1.1,dark);bx(.08,.5,.08,sd*.8,-1.0,-.8,dark)}
 const rotor=new T.Group();rotor.position.set(0,1.35,-.2);g.add(rotor);bx(10.8,.05,.32,0,0,0,dark,rotor);bx(.32,.05,10.8,0,0,0,dark,rotor);bx(.3,.3,.3,0,0,0,dark,rotor);
 const tr=new T.Group();tr.position.set(.12,1.05,-6.95);g.add(tr);bx(.04,1.5,.14,0,0,0,dark,tr);bx(.04,.14,1.5,0,0,0,dark,tr);
 {const cv=document.createElement('canvas');cv.width=256;cv.height=64;const x=cv.getContext('2d');if(x&&x.fillRect){x.fillStyle='#1f4e9e';x.fillRect(0,0,256,64);x.fillStyle='#ffffff';x.font='bold 40px system-ui,Arial,sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText('POLIZIA',128,34)}const tx=new T.CanvasTexture(cv);const mt=new T.MeshStandardMaterial({map:tx,roughness:.5});
  for(const sd of [1,-1]){const pl=new T.Mesh(new T.PlaneGeometry(2.4,.6),mt);pl.position.set(sd*.885,.25,-.2);pl.rotation.y=sd*Math.PI/2;g.add(pl)}}
 g.rotation.order='YXZ';sc.add(g);return{g,rotor,tr}}
function pdHeliRender(h,dt){if(!PD.cfg.enabled)return;let m=PD.heliMdl;if(!m)m=PD.heliMdl=pdHeliModel();const g=m.g;g.visible=true;g.position.set(h.x,h.y+1.5,h.z);g.rotation.set(Math.min(.22,(h.sp||0)*.004),h.h,0);m.rotor.rotation.y+=dt*(h.alt>1?29:12);m.tr.rotation.x+=dt*45}
/* rumore del rotore: rumore filtrato modulato alla frequenza delle pale */
pdAudio.rotor=function(level){const c=this.ctx;if(!c)return;try{if(!this.rn){const len=c.sampleRate*2,buf=c.createBuffer(1,len,c.sampleRate),d=buf.getChannelData(0);for(let i=0;i<len;i++)d[i]=Math.random()*2-1;const src=c.createBufferSource();src.buffer=buf;src.loop=true;const f=c.createBiquadFilter();f.type='lowpass';f.frequency.value=320;const am=c.createGain(),g=c.createGain(),lfo=c.createOscillator(),lg=c.createGain();lfo.frequency.value=17;lg.gain.value=.5;lfo.connect(lg);lg.connect(am.gain);am.gain.value=.5;src.connect(f);f.connect(am);am.connect(g);g.connect(c.destination);g.gain.value=0;src.start();lfo.start();this.rn={g}}this.rn.g.gain.value=Math.min(.22,level*.22)}catch(e){}};
/* corsie in autostrada: la pattuglia sceglie la corsia libera (preferisce quella di sorpasso) invece di frenare dietro a chi la precede */
const MWLN=[-4.8,-1.1,2.6];
function pdMwLane(u,rf){if(!rf)return MWLN[0];if(u.mwLn===undefined)u.mwLn=0;if(PD.t-(u.mwLnT||-9)<1.3)return MWLN[u.mwLn];
 const dx=rf.dx,dz=rf.dz,ua=(u.x-rf.px)*dx+(u.z-rf.pz)*dz,ahead=[1e9,1e9,1e9],side=[false,false,false],me=Math.max(0,u.fwd);
 const see=(ox,oz,ov)=>{const rx=ox-rf.px,rz=oz-rf.pz,al=rx*dx+rz*dz-ua,lat=rx*(-dz)+rz*dx;for(let k=0;k<3;k++){if(Math.abs(lat-MWLN[k])>1.9)continue;if(al>-9&&al<4)side[k]=true;else if(al>=4&&al<55&&ov<me-1.5)ahead[k]=Math.min(ahead[k],al)}};
 for(const c of CARS)see(c.x,c.z,c.v*(Math.sin(c.h)*dx+Math.cos(c.h)*dz));for(const o of PD.units){if(o===u||o.lod!=='near'||o.status==='gone')continue;see(o.x,o.z,o.fwd*(Math.sin(o.h)*dx+Math.cos(o.h)*dz))}
 const good=k=>ahead[k]>=55&&!side[k],cur=u.mwLn;let pick=cur;if(!good(cur)||(cur>0&&good(cur-1))){for(const k of [cur-1,cur+1,cur-2,cur+2]){if(k<0||k>2)continue;if(good(k)&&!side[Math.min(k,cur)+(k>cur?1:0)]){pick=k;break}}}
 if(pick!==cur){u.mwLn=pick;u.mwLnT=PD.t}return MWLN[u.mwLn]}
function pdFollowV(u,ca){return Math.max(0,(u.caV||0)+(ca-8)*.9)}
/* il bersaglio si sposta sulla rampa d'uscita: lo si considera già fuori dall'autostrada (le pattuglie dietro prendono la stessa uscita) */
function pdExitIntent(T){const q=T.seg;if(!q||!q.s.mw||q.s.tp||T.sp<4)return;const s=q.s,L=s.len||1,ux=(s.bx-s.ax)/L,uz=(s.bz-s.az)/L,latR=(T.x-s.ax)*(-uz)+(T.z-s.az)*ux,vlat=T.vx*(-uz)+T.vz*ux;if(latR<2.1||(latR<3.3&&vlat<.7))return;
 const r=pdSegAt(T.x,T.z,x=>x.ramp&&x.ow);if(!r||r.d>(latR<3.3?4.5:2.6))return;const w=r.s,wl=w.len||1,wx=(w.bx-w.ax)/wl,wz=(w.bz-w.az)/wl;if(wx*T.dx+wz*T.dz<.85)return;
 const t=pdClamp(((T.x-w.ax)*wx+(T.z-w.az)*wz)/wl,0,1);T.seg={id:r.id,s:w,t,d:r.d,a:t*wl};T.exiting=true}

const side0=a=>(a.sides&&a.sides[0])||1;
function pdNames(L){const named=L.filter(n=>!/^una /.test(n)),anon=L.length-named.length,num=['','una','due','tre','quattro','cinque','sei'];if(!anon)return named.join(' e ');const tail=anon===1?(named.length?'un\'altra pattuglia':'una pattuglia'):(named.length?'altre ':'')+(num[anon]||anon)+' pattuglie';return named.length?named.join(', ')+' e '+tail:tail}
