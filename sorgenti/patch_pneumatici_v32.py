# -*- coding: utf-8 -*-
"""ITALIA OPEN WORLD — V32: Magic Formula combinata, dinamica a 7 gradi di libertà a 200 Hz e centralina ABS/TCS/ESP con blackout oltre 15 g.

Collega al gioco i moduli motore/pneumatici_mf.js, motore/controllo_dinamica.js e la nuova dinamica di motore/fisica_veicolo.js.
Prima la funzione drive() della pagina calcolava l'imbardata in modo cinematico (r = v·tan δ / 2,7) e smorzava la velocità laterale con
un esponenziale; il motore fisico calcolava solo la dinamica longitudinale. Ora, quando i moduli sono caricati (VEHOK):
- drive() passa al motore fisico velocità longitudinale, velocità laterale e angolo di sterzo; il motore fisico integra a passo fisso di
  5 ms vx, vy, imbardata e le quattro ruote con le forze della Magic Formula combinata, e drive() ne riceve velocità e imbardata;
- gli urti che il gioco trasforma in rotazione (spinte della polizia, colpi contro gli ostacoli) diventano un impulso d'imbardata della
  dinamica, che le gomme poi contrastano o no (con la centralina sana l'ESP aiuta a riprendere l'auto);
- ogni urto registrato dal Vehicle Damage Solver porta l'accelerazione di picco (impulso e durata dello schiacciamento) alla centralina:
  oltre 15 g va in blackout (ABS, TCS, ESP ed EBD spenti, frenando le ruote si bloccano: λ = −1), la scatola delle centraline risulta
  danneggiata e l'officina la ripara (riparazione completa, voce «Centraline elettroniche» o riparazione d'emergenza);
- il quadro mostra scorrimento λ, deriva α, carico e forze di ogni ruota e lo stato della centralina.
Senza i moduli (VEHOK falso) la guida resta quella di prima, invariata.
Sostituzioni su stringhe UNICHE della pagina costruita (dopo la patch V31): se un'ancora manca o non è unica la costruzione si ferma."""
import sys


def applica(h):
    n = [0]

    def rep(a, b, cnt=1):
        nonlocal h
        c = h.count(a)
        if c != cnt:
            raise SystemExit('patch pneumatici V32: ancora non trovata/non unica (%d): %s' % (c, a[:110]))
        n[0] += 1
        h = h.replace(a, b)

    # 1. moduli: formula degli pneumatici e centralina prima del motore fisico
    rep('<script src="motore/veicoli_db.js"></script><script src="motore/fisica_veicolo.js"></script>',
        '<script src="motore/veicoli_db.js"></script><script src="motore/pneumatici_mf.js"></script><script src="motore/controllo_dinamica.js"></script><script src="motore/fisica_veicolo.js"></script>')

    # 2. drive(): imbardata cinematica solo nel modello di riserva; con il motore fisico l'imbardata viene dalla dinamica
    rep(" let w=vf/2.7*Math.tan(V.st)*(hb?1.35:1)*(VEHOK&&VEH.ruote.bloccate?.35:1);if(sp<.4)w*=sp/.4;",
        " let w=VEHOK?0:vf/2.7*Math.tan(V.st)*(hb?1.35:1);if(!VEHOK&&sp<.4)w*=sp/.4;")
    rep(" C.h-=w*dt;C.h+=(V.yw+V.ywW)*dt;V.yw*=Math.exp(-1.1*dt);V.ywW*=Math.exp(-4*dt);sn=Math.sin(C.h);cn=Math.cos(C.h);vf=V.vx*sn+V.vz*cn;vl=V.vz*sn-V.vx*cn;",
        " if(VEHOK){VEHX.imbardataUrto(V.yw+V.ywW);V.yw=0;V.ywW=0}   /* spinte e colpi che ruotano l'auto: impulso d'imbardata della dinamica (le gomme lo contrastano) */\n"
        " else{C.h-=w*dt;C.h+=(V.yw+V.ywW)*dt;V.yw*=Math.exp(-1.1*dt);V.ywW*=Math.exp(-4*dt);sn=Math.sin(C.h);cn=Math.cos(C.h);vf=V.vx*sn+V.vz*cn;vl=V.vz*sn-V.vx*cn}")
    rep(" if(VEHOK){vf=VEHX.drive(dt,vf,vl,iy,hb);if(CARDMG.vmax<56)vf=cl(vf,-12,CARDMG.vmax)}",
        " if(VEHOK){vf=VEHX.drive(dt,vf,vl,iy,hb,-V.st);vl=-VEH.vy;C.h+=VEH.r*dt;sn=Math.sin(C.h);cn=Math.cos(C.h);if(CARDMG.vmax<56)vf=cl(vf,-12,CARDMG.vmax)}   /* dinamica a 7 gradi di libertà a 200 Hz con la Magic Formula combinata: vx, vy e imbardata (motore/fisica_veicolo.js) */")
    rep(" vl*=Math.exp(-((hb||(typeof PD!=='undefined'&&V.slipT>PD.t))?1.4:",
        " if(!VEHOK)vl*=Math.exp(-((hb||(typeof PD!=='undefined'&&V.slipT>PD.t))?1.4:")
    rep("V.af=(vf-f0)/Math.max(dt,1e-3);V.al=w*vf;",
        "V.af=(vf-f0)/Math.max(dt,1e-3);V.al=VEHOK?-VEH.dyn.ayF:w*vf;")

    # 2b. ribaltamento: la dinamica riparte senza imbardata residua quando l'auto torna sulle ruote
    rep("function drive(dt,ix,iy){const hb=!!(K[' ']||K.hb);if(V.rol){crRollDrive(dt);return}",
        "function drive(dt,ix,iy){const hb=!!(K[' ']||K.hb);if(V.rol){if(VEHOK)VEH.r=0;crRollDrive(dt);return}")
    rep("if(crTrip(V,carA,vl,Math.hypot(vf,vl),dt)){V.rlF=vf;crRollDrive(dt);return}",
        "if(crTrip(V,carA,vl,Math.hypot(vf,vl),dt)){V.rlF=vf;if(VEHOK)VEH.r=0;crRollDrive(dt);return}")
    # 2c. contatti con le pattuglie (corpo rigido): l'auto entra con la sua imbardata vera e ne esce con quella dopo l'urto
    rep("if(inCar)bs.push({p:1,x:C.x,z:C.z,y:V.y,h:C.h,vx:V.vx,vz:V.vz,w:V.yw,m:1,I:1.9});",
        "if(inCar)bs.push({p:1,x:C.x,z:C.z,y:V.y,h:C.h,vx:V.vx,vz:V.vz,w:(typeof VEHOK!=='undefined'&&VEHOK)?VEH.r:V.yw,m:1,I:1.9});")
    rep("V.vx=b.vx;V.vz=b.vz;V.yw=pdClamp(b.w,-2.6,2.6);if(Math.abs(V.yw)>1.1&&Math.hypot(V.vx,V.vz)>7)V.slipT=PD.t+1.3}",
        "V.vx=b.vx;V.vz=b.vz;if(typeof VEHOK!=='undefined'&&VEHOK){VEH.r=pdClamp(b.w,-6,6);V.yw=0}else{V.yw=pdClamp(b.w,-2.6,2.6);if(Math.abs(V.yw)>1.1&&Math.hypot(V.vx,V.vz)>7)V.slipT=PD.t+1.3}}")
    # 3. VEHX.drive: velocità laterale e sterzo al motore fisico; impulso d'imbardata; urti → centralina
    rep(" drive(dt,vf,vl,iy,hb){if(!VEHOK)return vf;VEH.v=vf;VEHX.vl=Math.abs(vl);",
        " drive(dt,vf,vl,iy,hb,st){if(!VEHOK)return vf;VEH.v=vf;VEH.vy=-vl;VEHX.vl=Math.abs(vl);")
    rep("const inp={iy,frenoMano:hb,scivolamentoLaterale:Math.abs(vl),marciaCmd:VEH.cambio.modo==='man'?VEHX.cmd:null,avvia};",
        "const inp={iy,frenoMano:hb,scivolamentoLaterale:Math.abs(vl),marciaCmd:VEH.cambio.modo==='man'?VEHX.cmd:null,avvia,sterzo:Number.isFinite(st)?st:0,muGioco:VDS.ok?1:(CARDMG.grip||1)};")
    rep(" /* chiamata da drive(): restituisce la nuova velocità longitudinale */",
        " /* impulso d'imbardata [rad/s] dagli urti del gioco (prima era una rotazione imposta che si smorzava da sola) */\n"
        " imbardataUrto(k){if(!VEHOK||!(Math.abs(k)>1e-4))return;VEH.r=cl((VEH.r||0)+k,-4,4)},\n"
        " /* urto con accelerazione di picco g: oltre 15 g la centralina ABS/ESP va in blackout (motore/controllo_dinamica.js) */\n"
        " urtoG(g,dove){if(!VEHOK||!(g>0))return;VEHX.ultimoG=g;if(IOW_FISICA.urto(VEH,g,{dove})){DANS.comp.centraline=Math.min(DANS.comp.centraline,.25);try{IOW_ECU.nota(ECUN,'ABS','blackout','',{g:+g.toFixed(1)})}catch(e){}toast('[CENTRALINA KO] urto di '+g.toFixed(0)+' g: ABS, ESP e controllo di trazione disattivati — controllo puramente meccanico');if(VEHX.open)VEHX.render()}},\n"
        " /* chiamata da drive(): restituisce la nuova velocità longitudinale */")
    # 4. fuori dall'auto: dinamica laterale ferma; centralina riparata in officina
    rep("  if(!inCar){VEH.v=0;IOW_FISICA.passo(VEH,dt,{acc:0,freno:1,iy:0},{pendenza:0,superficie:'asfalto',acqua:0,tempAria:VEHX.tempAria,quota:0,vento:0});VEH.v=0}",
        "  if(!inCar){VEH.v=0;VEH.vy=0;VEH.r=0;IOW_FISICA.passo(VEH,dt,{acc:0,freno:1,iy:0},{pendenza:0,superficie:'asfalto',acqua:0,tempAria:VEHX.tempAria,quota:0,vento:0});VEH.v=0;VEH.vy=0;VEH.r=0}\n"
        "  if(VEH.centralina.stato==='BLACKOUT'&&DANS.comp.centraline>=.6){IOW_FISICA.riavviaCentralina(VEH);toast('Centralina ABS/ESP sostituita: controlli elettronici di nuovo attivi')}")
    # 5. accelerazione di picco degli urti dal Vehicle Damage Solver (impulso sull'auto e durata dello schiacciamento)
    rep("  if(own===carA&&typeof VEHOK!=='undefined'&&VEHOK&&imp>=3.2)IOW_DANNI.urto(DANS,{lx,lz,imp,kind,massa:m1,t:VEHX.t,energia:ev.Eown,duplicato:ev.duplicato});",
        "  if(own===carA&&typeof VEHOK!=='undefined'&&VEHOK&&imp>=3.2)IOW_DANNI.urto(DANS,{lx,lz,imp,kind,massa:m1,t:VEHX.t,energia:ev.Eown,duplicato:ev.duplicato});\n"
        "  if(own===carA&&typeof VEHOK!=='undefined'&&VEHOK&&!ev.duplicato)VEHX.urtoG(IOW_FISICA.piccoG({J:ev.J,massa:m1,vn:imp,durata:ev.durata,schiacciamento:ev.schiacciamento,Eown:ev.Eown}),fa+' contro '+kind);   /* accelerazione di picco → centralina (blackout oltre 15 g) */")
    rep("  if(own===carA&&typeof VEHOK!=='undefined'&&VEHOK)IOW_DANNI.urto(DANS,{lx:-pv[0],lz:0,imp:e.v,kind:'ground',massa:m1,t:VEHX.t,energia:ev.Eown,duplicato:ev.duplicato});return ev},",
        "  if(own===carA&&typeof VEHOK!=='undefined'&&VEHOK)IOW_DANNI.urto(DANS,{lx:-pv[0],lz:0,imp:e.v,kind:'ground',massa:m1,t:VEHX.t,energia:ev.Eown,duplicato:ev.duplicato});\n"
        "  if(own===carA&&typeof VEHOK!=='undefined'&&VEHOK&&!ev.duplicato)VEHX.urtoG(IOW_FISICA.piccoG({J:ev.J,massa:m1,vn:e.v,durata:ev.durata,schiacciamento:ev.schiacciamento,Eown:ev.Eown}),'ribaltamento');return ev},")
    rep("IOW_DANNI.urto(DANS,{lx:dx*c-dz*s,lz:dx*s+dz*c,imp,kind:kind||'wall',massa:VEH.par.massa,t:VEHX.t})}}}",
        "IOW_DANNI.urto(DANS,{lx:dx*c-dz*s,lz:dx*s+dz*c,imp,kind:kind||'wall',massa:VEH.par.massa,t:VEHX.t});VEHX.urtoG(IOW_FISICA.piccoG({vn:imp,massa:VEH.par.massa}),kind||'urto')}}}")
    # 6. quadro: pneumatici (Magic Formula) e centralina
    rep("   +'<div class=\"vrow\">ABS '+",
        "   +(()=>{const RU=IOW_FISICA.ruote(VEH),nm=['AS','AD','PS','PD'],cen=VEH.centralina;return '<div class=\"vrow\">Pneumatici (Magic Formula combinata, 200 Hz): '+RU.map((u,i)=>nm[i]+' λ '+u.lambda.toFixed(2)+' α '+(u.alfa*57.3).toFixed(1)+'° Fz '+(u.Fz/1000).toFixed(1)+' kN Fx '+(u.Fx/1000).toFixed(1)+' Fy '+(u.Fy/1000).toFixed(1)+(u.bloccata?' <b>BLOCCATA</b>':u.abs?' <b>ABS</b>':'')).join(' · ')+'</div>'"
        "+'<div class=\"vrow\">Dinamica: deriva '+tel.derivaGradi+'° · imbardata '+tel.imbardataRadS+' rad/s · acc. laterale '+tel.accLatG+' g · longitudinale '+tel.accLongG+' g · sterzo '+tel.sterzoGradi+'° · centralina <b>'+(cen.stato==='BLACKOUT'?'BLACKOUT (urto di '+cen.ultimoUrtoG.toFixed(0)+' g): ABS, TCS, ESP spenti':'operativa')+'</b>'+(cen.tcs.attivo?' · <b>TCS</b>':'')+(cen.esp.attivo?' · <b>ESP</b> '+Math.round(cen.esp.Mz)+' N·m':'')+' · urto massimo '+cen.urtoMaxG.toFixed(0)+' g</div>'})()\n"
        "   +'<div class=\"vrow\">ABS '+")
    return h, n[0]


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit('uso: python3 patch_pneumatici_v32.py pagina_in.html pagina_out.html')
    h = open(sys.argv[1], encoding='utf-8').read(); h, k = applica(h); open(sys.argv[2], 'w', encoding='utf-8').write(h); print('sostituzioni:', k)
