# -*- coding: utf-8 -*-
"""ITALIA OPEN WORLD — V30: collegamento del Vehicle Damage Solver (motore/danni_solver.js + motore/profili_danno.js) al gioco.
Sostituzioni su stringhe UNICHE della pagina costruita (dopo la patch motore V29): se un'ancora manca o non è unica la costruzione si ferma."""
import sys

def applica(h):
    n = [0]
    def rep(a, b, cnt=1):
        c = h.count(a)
        if c != cnt: raise SystemExit('patch solver V30: ancora non trovata/non unica (%d): %s' % (c, a[:90]))
        n[0] += 1
        return h.replace(a, b)

    # 1. moduli
    h = rep('<script src="motore/calibrazione.js"></script>',
            '<script src="motore/calibrazione.js"></script><script src="motore/profili_danno.js"></script><script src="motore/danni_solver.js"></script>')

    # 2. ostacolo «albero» distinto dal palo (materiale diverso nel solver; impronta locale sulla rete)
    h = rep("function dmgKind(s){if(!s)return'wall';if(s.amb||s.nc)return'car';if(s.lo)return'rail';",
            "function dmgKind(s){if(!s)return'wall';if(s.amb||s.nc)return'car';if(s.lo)return'rail';if(s.tree)return'tree';")
    h = rep("pole:{hw:0,ylo:-1,yhi:3,R:.3,dy:.42,dr:.3},car:{hw:.75,ylo:.18,yhi:1.08,R:0,dy:.34,dr:.5}};",
            "pole:{hw:0,ylo:-1,yhi:3,R:.3,dy:.42,dr:.3},tree:{hw:0,ylo:-1,yhi:3,R:.26,dy:.42,dr:.32},car:{hw:.75,ylo:.18,yhi:1.08,R:0,dy:.34,dr:.5}};")

    # 3. ponte VDS: profili, solver, stato del giocatore, energia, ruote, componenti, effetti
    h = rep("const SBT=sbTemplate(DMGBOX),SBBIND=new Map();",
r"""const SBT=sbTemplate(DMGBOX),SBBIND=new Map();
/* --- Vehicle Damage Solver (motore/danni_solver.js + motore/profili_danno.js): un solo punto per energia d'urto, profilo del veicolo, ruote, componenti, effetti.
   Non sostituisce nulla: dmgCrash/sbCrash deformano la rete, sbDerive misura, danni_meccanici.js decide la meccanica, sbEffects/crash.js gli effetti. --- */
const VDS={ok:!!(window.IOW_SOLVER&&window.IOW_PROFILI),st:null,T:null,cfg:null,prof:null,
 ready(){if(!VDS.ok)return null;if(VDS.st)return VDS.st;const P=IOW_PROFILI;SBT.zona=P.classifica(SBT);const id=(typeof VEH!=='undefined'&&VEH&&VEH.par&&VEH.par.id)||'predefinito';VDS.prof=P.profilo(id);
  if(VDS.prof.id!=='predefinito'&&typeof VEH!=='undefined'&&VEH&&VEH.par&&Number.isFinite(VEH.par.massa))VDS.prof=Object.assign({},VDS.prof,{massa:VEH.par.massa});   /* la massa viene dal database dei veicoli (motore/veicoli_db.js) */
  VDS.T=P.template(SBT,VDS.prof);VDS.cfg=P.componenti(VDS.prof);VDS.st=IOW_SOLVER.crea({profilo:VDS.prof.id,facce:VDS.prof.facce});carA.sbT=VDS.T;VDS.fsn={};for(const f of ['ant','post','lato'])VDS.fsn[f]=VDS.forzaFaccia(VDS.T,f);return VDS.st},
 /* forza di snervamento di una faccia: somma delle travi longitudinali della prima stazione (o dei traversi delle porte di un lato) — dal modello della rete, non da dati reali */
 forzaFaccia(T,f){let s=0;const st=i=>i<72?i>>3:-1;for(let b=0;b<T.NB;b++){const ty=T.TY[b],i0=Math.min(st(T.A[b]),st(T.B[b])),i1=Math.max(st(T.A[b]),st(T.B[b]));if(f==='ant'&&ty===0&&i0===1)s+=T.FY[b];else if(f==='post'&&ty===3&&i1===7)s+=T.FY[b];else if(f==='lato'&&ty===4&&(i0===4||i0===5)&&T.zona[b]===IOW_PROFILI.ZID.porte)s+=T.FY[b]*.5}return s},
 tpl(own){return own&&own.sbT||SBT},
 stDi(own){if(own===carA)return VDS.ready();return own.vds||(own.vds=IOW_SOLVER.crea({profilo:'predefinito'}))},   /* pattuglie e traffico: solo il registro degli eventi (niente modello ruote) */
 massaDi(car){const m=VDS.T?VDS.T.Mt:1500;return car&&car.player?m:(car&&car.u&&Number.isFinite(car.u.mass)?car.u.mass*m:m)},   /* le altre auto hanno lo stesso modello; u.mass è relativa al giocatore */
 facciaDi(b,px,pz,nx,nz){const h=b.p?C.h:b.u.h,c=Math.cos(h),s=Math.sin(h),Dx=nx*c-nz*s,Dz=nx*s+nz*c;return IOW_SOLVER.faccia(Dx,Dz)},
 idCoppia(a,b){const k=o=>o.p?'P':(o.u&&o.u.name||'u');return k(a)<k(b)?k(a)+'|'+k(b):k(b)+'|'+k(a)},
 /* evento d'urto: dai dati del contatto all'energia propria e alla velocità equivalente u per la rete */
 evento(a,car,lx,lz,Dx,Dz,imp,kind,xtra){if(!VDS.ok||!VDS.ready())return null;const own=car.u||a,T=VDS.tpl(own),Mt=IOW_PROFILI.massa(T,own.sb),m1=VDS.massaDi(car),m2=kind==='car'?(xtra&&Number.isFinite(xtra.m2)?xtra.m2:m1):Infinity;
  const fa=IOW_SOLVER.faccia(Dx,Dz),st=VDS.stDi(own),ev=IOW_SOLVER.evento(st,{t:performance.now()/1000,lx,lz,nx:Dx,nz:Dz,vn:imp,m1,m2,kind,faccia:fa,facciaAltro:xtra&&xtra.facciaAltro,id:xtra&&xtra.id,Mt,Fsnerv:VDS.fsn?VDS.fsn[fa]:0});
  if(own===carA&&typeof VEHOK!=='undefined'&&VEHOK&&imp>=3.2)IOW_DANNI.urto(DANS,{lx,lz,imp,kind,massa:m1,t:VEHX.t,energia:ev.Eown,duplicato:ev.duplicato});   /* storico ed energia nel modulo meccanico (una sola volta per evento) */
  return ev},
 /* ribaltamento: evento registrato (energia dalla velocità di caduta); la rete la schiaccia rlCrash con la sua taratura */
 eventoRib(own,r){if(!VDS.ok||!VDS.ready()||!r.ev)return null;const e=r.ev,m1=own===carA?VDS.T.Mt:VDS.massaDi({u:own}),pv=RPOLY[e.k],st=VDS.stDi(own);const ev=IOW_SOLVER.evento(st,{t:performance.now()/1000,lx:-pv[0],lz:0,nx:-Math.sin(r.phi),nz:0,vn:e.v,m1,m2:Infinity,kind:'ground',faccia:Math.cos(r.phi)<-.7?'tetto':'lato',Mt:IOW_PROFILI.massa(VDS.tpl(own),own.sb)});
  if(own===carA&&typeof VEHOK!=='undefined'&&VEHOK)IOW_DANNI.urto(DANS,{lx:-pv[0],lz:0,imp:e.v,kind:'ground',massa:m1,t:VEHX.t,energia:ev.Eown,duplicato:ev.duplicato});return ev},
 esito(own,ev,r){if(ev&&VDS.ok)IOW_SOLVER.esito(VDS.stDi(own),ev,r)},
 /* soglie configurabili dei componenti (profili_danno.COMPONENTI, modificate dal profilo) */
 soglia(key,campo,fb){const c=VDS.cfg&&VDS.cfg[key];if(!c)return fb;const r=c.resistenza||1;if(campo==='soglia')return (Number.isFinite(c.soglia)?c.soglia:fb)*r;const v=c.cerniera&&c.cerniera[campo];return (Number.isFinite(v)?v:fb)*r},
 cedeCerniera(key,m){return m>VDS.soglia(key,'apre',.12)},
 /* ogni fotogramma (dal passo del veicolo): stato per zona, componenti, modello ruote → interfaccia S per danni_meccanici */
 step(dt){const st=VDS.ready();if(!st)return null;const D=carA.dmg,R=D&&D.R,ty=carA.tyre,S=carA.sb;
  if(S&&st.dirty){st.zone=IOW_SOLVER.stato(VDS.T,S,IOW_PROFILI.ZONE);st.dirty=false;IOW_SOLVER.componenti(st,VDS.cfg,st.zone,D,carA.cr&&carA.cr.parts)}
  IOW_SOLVER.passo(st,dt,{R,D,tyre:ty,v:cs.v});return IOW_SOLVER.statoStruttura(st,R,D,ty,st.zone)},
 /* effetti sulla guida del gioco (dopo dmgDrive0 e TYRE.apply: nessuna voce calcolata due volte) */
 guida(){CARDMG.vib=0;CARDMG.soft=1;if(!VDS.st)return;const E=VDS.st.effetti;CARDMG.vib=E.vibrazione;CARDMG.soft=1+(1-E.ammortizzazione)*1.6;CARDMG.pull=pdClamp(CARDMG.pull+E.tiro,-.1,.1);CARDMG.grip=(CARDMG.grip||1)*(.6+.4*E.stabilita);
  if(typeof inCar!=='undefined'&&inCar){if(E.vibrazione>.02)crLoop('rattle',Math.min(.5,E.vibrazione*.6),70+Math.abs(cs.v)*5);if(typeof VEHOK!=='undefined'&&VEHOK&&DANS.comp.scarico<.5&&VEH.motore.acceso)crLoop('scarico',(1-DANS.comp.scarico)*.3,70+VEH.motore.rpm/30)}},
 ripara(chiave,idx){if(VDS.st)IOW_SOLVER.ripara(VDS.st,chiave,idx)},
 serializza(){return VDS.st?IOW_SOLVER.serializza(VDS.st):null},ripristina(s){if(s&&VDS.ready())IOW_SOLVER.ripristina(VDS.st,s)},
 analisi(){return VDS.st?IOW_SOLVER.analisi(VDS.st):null}};""")

    # 4. dmgCrash: modello del profilo, velocità equivalente dal solver, contabilità dell'energia dissipata
    h = rep("function dmgCrash(own,lx,lz,Dx,Dz,imp,kind){const S=sbState(own),dl=Math.hypot(Dx,Dz)||1,nx=Dx/dl,nz=Dz/dl,f=dmgFace(lx,lz,nx,nz),k=SBIMP[kind]?kind:'wall',u=k==='car'?imp*.5:imp*.92;\n const t0=performance.now(),r=sbCrash(SBT,S,{n:[nx,nz],c:f,u,hw:SBIMP[k].hw,ylo:SBIMP[k].ylo,yhi:SBIMP[k].yhi,R:SBIMP[k].R}),ms=performance.now()-t0;SBST.n++;SBST.ms+=ms;SBF.ms+=ms;return r}",
            "function dmgCrash(own,lx,lz,Dx,Dz,imp,kind,ev){const S=sbState(own),dl=Math.hypot(Dx,Dz)||1,nx=Dx/dl,nz=Dz/dl,f=dmgFace(lx,lz,nx,nz),k=SBIMP[kind]?kind:'wall',u=ev&&Number.isFinite(ev.u)?ev.u:(k==='car'?imp*.5:imp*.92);   /* u: dal solver (energia propria ripartita) oppure i fattori storici se il solver manca */\n if(!(u>.3))return null;const T=VDS.tpl(own),t0=performance.now(),r=sbCrash(T,S,{n:[nx,nz],c:f,u,hw:SBIMP[k].hw,ylo:SBIMP[k].ylo,yhi:SBIMP[k].yhi,R:SBIMP[k].R}),ms=performance.now()-t0;SBST.n++;SBST.ms+=ms;SBF.ms+=ms;VDS.esito(own,ev,r);return r}")

    # 5. coda degli urti: porta anche l'evento
    h = rep("if(e[0]==='u')dmgUnitCrash(e[1],e[2],e[3],e[4],e[5],e[6],e[7],true);else dmgApply(e[1],e[2],e[3],e[4],e[5],e[6],e[7],false,e[8],true)}}",
            "if(e[0]==='u')dmgUnitCrash(e[1],e[2],e[3],e[4],e[5],e[6],e[7],true,e[8]);else dmgApply(e[1],e[2],e[3],e[4],e[5],e[6],e[7],false,e[8],true,e[9])}}")
    h = rep("function dmgApply(a,car,lx,lz,Dx,Dz,imp,replay,kind,queued){if(!car.player&&!replay&&!queued&&SBF.ms>6){if(SBQ.length<40)SBQ.push(['a',a,car,lx,lz,Dx,Dz,imp,kind]);return}",
            "function dmgApply(a,car,lx,lz,Dx,Dz,imp,replay,kind,queued,ev){if(!car.player&&!replay&&!queued&&SBF.ms>6){if(SBQ.length<40)SBQ.push(['a',a,car,lx,lz,Dx,Dz,imp,kind,ev]);return}")
    h = rep(" if(!replay&&now-D.last<.12&&imp<(D.lastImp||0)*1.4)return;D.last=now;D.lastImp=imp;const B=DMGBOX,own=car.u||a;",
            " if(!replay&&!ev&&now-D.last<.12&&imp<(D.lastImp||0)*1.4)return;if(ev&&ev.duplicato&&!(ev.u>.3))return;D.last=now;D.lastImp=imp;const B=DMGBOX,own=car.u||a;   /* con il solver decide il registro degli eventi (stessa energia mai due volte) */")
    h = rep("cs0.hitT=performance.now()}dmgCrash(own,lx,lz,Dx,Dz,imp,k);", "cs0.hitT=performance.now()}dmgCrash(own,lx,lz,Dx,Dz,imp,k,ev);")
    h = rep(" const dep=Math.min(k==='pole'?.1:.075,Math.max(0,imp-2.5)*(k==='pole'?.0065:.0045)),R=SBIMP[k].dr,Dv=[Dx/dl,0,Dz/dl];",
            " const loc=k==='pole'||k==='tree',dep=Math.min(loc?.1:.075,Math.max(0,imp-2.5)*(loc?.0065:.0045)),R=SBIMP[k].dr,Dv=[Dx/dl,0,Dz/dl];")

    # 6. carHit: evento del solver (masse, materiale, direzione, punto) prima della rete
    h = rep("function carHit(a,car,wx,wz,dirx,dirz,imp,kind){if(!a||imp<3.2)return;kind=kind||(PO.hit&&PO.s?dmgKind(PO.s):'wall');const c=Math.cos(car.h),s=Math.sin(car.h),dx=wx-car.x,dz=wz-car.z,lx=dx*c-dz*s,lz=dx*s+dz*c,Dx=dirx*c-dirz*s,Dz=dirx*s+dirz*c;\n dmgApply(a,car,lx,lz,Dx,Dz,imp,false,kind)}",
            "function carHit(a,car,wx,wz,dirx,dirz,imp,kind,xtra){if(!a||imp<3.2)return;kind=kind||(PO.hit&&PO.s?dmgKind(PO.s):'wall');const c=Math.cos(car.h),s=Math.sin(car.h),dx=wx-car.x,dz=wz-car.z,lx=dx*c-dz*s,lz=dx*s+dz*c,Dx=dirx*c-dirz*s,Dz=dirx*s+dirz*c;\n const ev=VDS.evento(a,car,lx,lz,Dx,Dz,imp,kind,xtra);dmgApply(a,car,lx,lz,Dx,Dz,imp,false,kind,false,ev)}")

    # 7. pattuglie senza modello: evento e coda
    h = rep("function dmgUnitCrash(u,lx,lz,Dx,Dz,imp,kind,queued){if(!queued&&SBF.ms>6){if(SBQ.length<40)SBQ.push(['u',u,lx,lz,Dx,Dz,imp,kind]);return}const now=PD.t;if(!queued&&now-(u.sbLast||-9)<.12&&imp<(u.sbImp||0)*1.4)return;u.sbLast=now;u.sbImp=imp;dmgCrash(u,lx,lz,Dx,Dz,imp,kind);u.sbDirty=true}",
            "function dmgUnitCrash(u,lx,lz,Dx,Dz,imp,kind,queued,ev){if(!queued&&SBF.ms>6){if(SBQ.length<40)SBQ.push(['u',u,lx,lz,Dx,Dz,imp,kind,ev]);return}const now=PD.t;if(!queued&&!ev&&now-(u.sbLast||-9)<.12&&imp<(u.sbImp||0)*1.4)return;if(ev&&ev.duplicato&&!(ev.u>.3))return;u.sbLast=now;u.sbImp=imp;if(dmgCrash(u,lx,lz,Dx,Dz,imp,kind,ev))u.sbDirty=true}")

    # 8. coppia di veicoli: masse e facce di entrambi, identificatore della coppia (energia ripartita, mai contata due volte)
    h = rep("function dmgPair(b,px,pz,nx,nz,imp){if(imp*.8<3.2)return;if(b.p){carHit(carA,{x:C.x,z:C.z,h:C.h,y:V.y,vx:V.vx,vz:V.vz,player:true},px,pz,nx,nz,imp,'car')}else if(b.u){const u=b.u;if(u.mdl)carHit(u.mdl,{x:u.x,z:u.z,h:u.h,y:u.y,vx:u.vx,vz:u.vz,u},px,pz,nx,nz,imp,'car');else{const c=Math.cos(u.h),s=Math.sin(u.h),dx=px-u.x,dz=pz-u.z;dmgUnitCrash(u,dx*c-dz*s,dx*s+dz*c,nx*c-nz*s,nx*s+nz*c,imp,'car')}}}",
            "function dmgPair(b,px,pz,nx,nz,imp,other){if(imp*.8<3.2)return;const xtra=other&&VDS.ok?{m2:VDS.massaDi(other.p?{player:true}:{u:other.u}),facciaAltro:VDS.facciaDi(other,px,pz,-nx,-nz),id:VDS.idCoppia(b,other)}:null;\n if(b.p){carHit(carA,{x:C.x,z:C.z,h:C.h,y:V.y,vx:V.vx,vz:V.vz,player:true},px,pz,nx,nz,imp,'car',xtra)}else if(b.u){const u=b.u;if(u.mdl)carHit(u.mdl,{x:u.x,z:u.z,h:u.h,y:u.y,vx:u.vx,vz:u.vz,u},px,pz,nx,nz,imp,'car',xtra);else{const c=Math.cos(u.h),s=Math.sin(u.h),dx=px-u.x,dz=pz-u.z,lx=dx*c-dz*s,lz=dx*s+dz*c,Dx=nx*c-nz*s,Dz=nx*s+nz*c,ev=VDS.evento(null,{u},lx,lz,Dx,Dz,imp,'car',xtra);dmgUnitCrash(u,lx,lz,Dx,Dz,imp,'car',false,ev)}}}")
    h = rep("dmgPair(A,o[3],o[4],o[5],o[6],imp);dmgPair(B,o[3],o[4],-o[5],-o[6],imp);", "dmgPair(A,o[3],o[4],o[5],o[6],imp,B);dmgPair(B,o[3],o[4],-o[5],-o[6],imp,A);")

    # 9. ribaltamento: evento registrato ed energia della rete contabilizzata
    h = rep(" const S=sbState(own),t0=performance.now(),res=sbCrash3(SBT,S,{n3,c3,u:Math.min(11,e.v*1.6),ky:.12,reach:.65}),ms=performance.now()-t0;SBST.n++;SBST.ms+=ms;SBF.ms+=ms;return res}",
            " const S=sbState(own),ev=VDS.eventoRib(own,r),t0=performance.now(),res=sbCrash3(VDS.tpl(own),S,{n3,c3,u:Math.min(11,e.v*1.6),ky:.12,reach:.65}),ms=performance.now()-t0;SBST.n++;SBST.ms+=ms;SBF.ms+=ms;VDS.esito(own,ev,res);return res}")

    # 10. cerniere e specchietti: soglie dal profilo (deterministiche: nessuna probabilità casuale)
    h = rep("if(!D.cut.hood){const p=C0.parts.hood;if(!p&&R.fC>.28){const free=R.fC>.5;crUnlatch(a,car,'hood',free?'free':'ajar',Math.min(.16,.04+(R.fC-.28)*.3),free?0:.2)}else if(p&&p.st==='ajar'&&(R.fC>.5||R.fC>(p.fC0||0)+.1)){",
            "if(!D.cut.hood){const p=C0.parts.hood,hA=VDS.soglia('hood','apre',.28),hL=VDS.soglia('hood','libera',.5);if(!p&&R.fC>hA){const free=R.fC>hL;crUnlatch(a,car,'hood',free?'free':'ajar',Math.min(.16,.04+(R.fC-hA)*.3),free?0:.2)}else if(p&&p.st==='ajar'&&(R.fC>hL||R.fC>(p.fC0||0)+.1)){")
    h = rep(" if(!C0.parts.trunk&&R.rC>.22)crUnlatch(a,car,'trunk','free',.02,0);", " if(!C0.parts.trunk&&R.rC>VDS.soglia('trunk','apre',.22))crUnlatch(a,car,'trunk','free',.02,0);")
    h = rep("const m=intr(st,j);if(m>.09&&m<.32&&Math.random()<Math.min(.4,.12+(m-.09)*1.6))crUnlatch(a,car,key,'free',Math.min(.18,.03+(m-.05)*.4),0)}}",
            "const m=intr(st,j);if(m<VDS.soglia(key,'libera',.32)&&VDS.cedeCerniera(key,m))crUnlatch(a,car,key,'free',Math.min(.18,.03+(m-.05)*.4),0)}}   /* serratura che salta: intrusione oltre la soglia del profilo (prima: probabilità casuale) */")
    h = rep("const keys=sd<0?['dFR','dRR']:['dFL','dRL'];for(const k of keys)if(!(a.cr&&a.cr.parts[k])&&Math.random()<.14)crUnlatch(a,car,k,'free',.06,0)}}}",
            "const keys=sd<0?['dFR','dRR']:['dFL','dRL'];for(const k of keys)if(!(a.cr&&a.cr.parts[k])&&e.v>VDS.soglia(k,'soglia',.32)*15)crUnlatch(a,car,k,'free',.06,0)}}}   /* fiancata a terra oltre ~4,8 m/s: la serratura salta (soglia del profilo, non casuale) */")
    h = rep("for(const [sd,key,sv] of [[1,'mL',R.sL],[-1,'mR',R.sR]])if(!D.cut[key]&&sv>.1)dmgDetach(",
            "for(const [sd,key,sv] of [[1,'mL',R.sL],[-1,'mR',R.sR]])if(!D.cut[key]&&sv>VDS.soglia(key,'soglia',.1))dmgDetach(")

    # 11. guida: effetti del solver dopo quelli esistenti; vibrazione e morbidezza nel modello e nella posa
    h = rep("function dmgDrive(){dmgDrive0();TYRE.apply()}", "function dmgDrive(){dmgDrive0();TYRE.apply();VDS.guida()}")
    h = rep("const CARDMG={ef:1,pull:0,lk:1,drag:0,vmax:56,tp:0,tr:0};", "const CARDMG={ef:1,pull:0,lk:1,drag:0,vmax:56,tp:0,tr:0,vib:0,soft:1};")
    h = rep(" V.af=(vf-f0)/Math.max(dt,1e-3);V.al=w*vf;const k=Math.min(1,dt*6);V.pt+=(cl(-V.af*.005,-.06,.06)-V.pt)*k;V.rl+=(cl(-V.al*.01,-.07,.07)-V.rl)*k}",
            " V.af=(vf-f0)/Math.max(dt,1e-3);V.al=w*vf;const sf=CARDMG.soft||1,k=Math.min(1,dt*6/sf);V.pt+=(cl(-V.af*.005*sf,-.09,.09)-V.pt)*k;V.rl+=(cl(-V.al*.01*sf,-.1,.1)-V.rl)*k}   /* ammortizzatori danneggiati (solver): beccheggio e rollio più ampi e lenti */")
    h = rep("carG.rotation.set(V.pt+V.tp+CARDMG.tp,C.h,V.rl+V.tr+CARDMG.tr);if(V.rol)",
            "{const vb=CARDMG.vib>.01&&!V.rol&&!V.flip?CARDMG.vib*.011:0,ph=vb?performance.now()*.001*Math.max(2,Math.abs(cs.v)/2.02)*6.283:0;carG.rotation.set(V.pt+V.tp+CARDMG.tp+(vb?Math.sin(ph)*vb:0),C.h,V.rl+V.tr+CARDMG.tr+(vb?Math.cos(ph*1.3)*vb*.7:0))}if(V.rol)")

    # 12. passo del veicolo: interfaccia S dal solver, modello ruote → fisica; registro urti nel solver (non più nel wrapper di carHit)
    h = rep(" step(dt){if(!VEHOK)return;VEHX.t+=dt;const D=carA.dmg,R=D&&D.R,ty=carA.tyre;\n  const S=(D&&D.on)||ty?{zones:D&&D.on?D.zones:[0,0,0,0,0,0],fC:R?R.fC:0,rC:R?R.rC:0,sL:R?R.sL:0,sR:R?R.sR:0,fS:R?R.fS:0,hubs:R?R.hubs:[],engine:D&&D.on?D.engine:1,wl:D?D.wl:null,lampF:R?R.lampF:null,lampR:R?R.lampR:null,tyreF:ty?ty.f:null,tyreShred:ty?ty.shred:null}:null;\n  const ctx=IOW_DANNI.aggiorna(DANS,dt,S,VEH);VEHX.attritoDAN=VEH.mod.attritoExtra;",
            " step(dt){if(!VEHOK)return;VEHX.t+=dt;const D=carA.dmg,R=D&&D.R,ty=carA.tyre;\n  const S=VDS.ok?VDS.step(dt):((D&&D.on)||ty?{zones:D&&D.on?D.zones:[0,0,0,0,0,0],fC:R?R.fC:0,rC:R?R.rC:0,sL:R?R.sL:0,sR:R?R.sR:0,fS:R?R.fS:0,hubs:R?R.hubs:[],engine:D&&D.on?D.engine:1,wl:D?D.wl:null,lampF:R?R.lampF:null,lampR:R?R.lampR:null,tyreF:ty?ty.f:null,tyreShred:ty?ty.shred:null}:null);   /* interfaccia rete → meccanica costruita dal solver (zone nominate comprese) */\n  const ctx=IOW_DANNI.aggiorna(DANS,dt,S,VEH);if(VDS.st)IOW_SOLVER.applicaMod(VDS.st,VEH.mod);VEHX.attritoDAN=VEH.mod.attritoExtra;")
    h = rep(" {const carHit0=carHit;carHit=function(a,car,wx,wz,dirx,dirz,imp,kind){carHit0(a,car,wx,wz,dirx,dirz,imp,kind);if(a===carA&&imp>=3.2){const c=Math.cos(car.h),s=Math.sin(car.h),dx=wx-car.x,dz=wz-car.z;IOW_DANNI.urto(DANS,{lx:dx*c-dz*s,lz:dx*s+dz*c,imp,kind:kind||'wall',massa:VEH.par.massa,t:VEHX.t})}}}",
            " /* (V30) lo storico degli urti lo scrive il solver dentro carHit → VDS.evento (energia propria ripartita, mai contata due volte) */\n if(!VDS.ok){const carHit0=carHit;carHit=function(a,car,wx,wz,dirx,dirz,imp,kind,xtra){carHit0(a,car,wx,wz,dirx,dirz,imp,kind,xtra);if(a===carA&&imp>=3.2){const c=Math.cos(car.h),s=Math.sin(car.h),dx=wx-car.x,dz=wz-car.z;IOW_DANNI.urto(DANS,{lx:dx*c-dz*s,lz:dx*s+dz*c,imp,kind:kind||'wall',massa:VEH.par.massa,t:VEHX.t})}}}else VDS.ready();")
    h = rep(" {const dmgRepair0=dmgRepair;dmgRepair=function(a){dmgRepair0(a);if(a===carA&&!VEHX.inOfficina){IOW_DANNI.ripara(DANS,'emergenza',undefined,VEH);if(VEHX.open)VEHX.render()}}}",
            " {const dmgRepair0=dmgRepair;dmgRepair=function(a){dmgRepair0(a);if(a===carA&&!VEHX.inOfficina){IOW_DANNI.ripara(DANS,'emergenza',undefined,VEH);VDS.ripara('emergenza');if(VEHX.open)VEHX.render()}}}")
    h = rep("  VEHX.inOfficina=true;try{const costo=IOW_DANNI.ripara(DANS,chiave,idx,VEH);", "  VEHX.inOfficina=true;try{const costo=IOW_DANNI.ripara(DANS,chiave,idx,VEH);VDS.ripara(chiave,idx);")
    h = rep("batteria:+ECUN.batteria.soc.toFixed(3),modo:VEH.cambio.modo,", "batteria:+ECUN.batteria.soc.toFixed(3),modo:VEH.cambio.modo,solver:VDS.serializza(),")
    h = rep("   IOW_DANNI.aggiorna(DANS,0,null,VEH)}catch(e){console.error('ripristino veicolo',e)}},", "   if(s.solver)VDS.ripristina(s.solver);IOW_DANNI.aggiorna(DANS,0,null,VEH)}catch(e){console.error('ripristino veicolo',e)}},")
    h = rep("ecu:IOW_ECU.rapporto(ECUN),danni:IOW_DANNI.analisi(DANS),", "ecu:IOW_ECU.rapporto(ECUN),danni:IOW_DANNI.analisi(DANS),solverDanni:VDS.analisi(),profiloDanno:VDS.prof?{id:VDS.prof.id,nome:VDS.prof.nome,certificato:VDS.prof.certificato,nota:VDS.prof.nota}:null,")
    h = rep("window.__iow={ARM,", "window.__iow={VDS,SBT,sbNew,sbCrash,sbDerive,dmgCrash,carHit,dmgPair,CARDMG,")
    return h, n[0]

if __name__ == '__main__':
    src, dst = sys.argv[1], sys.argv[2]
    h, n = applica(open(src, encoding='utf-8').read())
    open(dst, 'w', encoding='utf-8').write(h); print('patch solver V30 applicata:', n, 'sostituzioni')
