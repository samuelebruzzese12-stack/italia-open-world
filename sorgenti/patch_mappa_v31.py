# -*- coding: utf-8 -*-
"""ITALIA OPEN WORLD — V31: collisioni con la quota (muri, guardrail, parapetti) nel nucleo del gioco.
Prima le collisioni con gli ostacoli della mappa reale erano solo in pianta (x, z): un muro di un edificio sopra una galleria fermava
l'auto dentro la galleria, la parete di una galleria fermava chi passava sopra in superficie, e per questo guardrail e parapetti non
potevano essere ostacoli (avrebbero fermato chi passava sul viadotto sopra). Ora un ostacolo che porta la quota della base e della
cima (yb, yt: muri degli edifici, pareti delle gallerie, muretti, guardrail, parapetti, piloni) non ferma chi sta più di 2,2 m sotto
la base (1,6 m per le barriere basse) o più di 35 cm sopra la cima. Chi non passa la quota (y) si comporta come prima.
Lo stesso vale per le auto: le sagome del traffico e delle pattuglie portano la loro quota, e i contatti fra auto (pdCollide,
speronamento) avvengono solo fra auto a meno di 2,5 m di quota l'una dall'altra.
Sostituzioni su stringhe UNICHE della pagina costruita (dopo la patch del solver V30): se un'ancora manca o non è unica la costruzione si ferma."""
import sys

def applica(h):
    n = [0]
    def rep(a, b, cnt=1):
        c = h.count(a)
        if c != cnt: raise SystemExit('patch mappa V31: ancora non trovata/non unica (%d): %s' % (c, a[:100]))
        n[0] += 1
        return h.replace(a, b)

    # 1. spinta fuori dagli ostacoli: quota di chi si muove (PO.y) e controllo della quota dell'ostacolo
    h = rep("function pushS(s,r){if(s.on===0)return;",
            "function pushS(s,r){if(s.on===0)return;if(s.yb!==undefined&&PO.y===PO.y&&(PO.y>s.yt+.35||PO.y<s.yb-(s.lo?1.6:2.2)))return;")
    h = rep("function push(x,z,r){PO.x=x;PO.z=z;PO.hit=0;",
            "function push(x,z,r,y){PO.x=x;PO.z=z;PO.hit=0;PO.y=y===undefined?NaN:y;")
    # 2. raggio contro gli ostacoli (telecamera, traffico, pattuglie): quota facoltativa
    h = rep("function clipDist(x,z,dx,dz,d,skipLo){let best=d;",
            "function clipDist(x,z,dx,dz,d,skipLo,y){if(y===undefined)y=NaN;let best=d;")
    h = rep("const a=CSO.get((cx+i)+','+(cz+j));if(a)for(const s of a){if(s.lo){if(skipLo)continue;",
            "const a=CSO.get((cx+i)+','+(cz+j));if(a)for(const s of a){if(s.yb!==undefined&&y===y&&(y>s.yt+.35||y<s.yb-(s.lo?1.6:2.2)))continue;if(s.lo){if(skipLo)continue;")
    # 3. colpi: un ostacolo con la quota si colpisce solo fra la sua base e la sua cima
    h = rep("if(y<gy-.05||y>gy+top)return;let nx=",
            "if(s.yb!==undefined?(y<s.yb-.05||y>s.yt+.05):(y<gy-.05||y>gy+top))return;let nx=")
    # 4. chi si muove passa la propria quota
    h = rep("q=push(fx,fz,1),ux=q[0]-fx,uz=q[1]-fz;if(q[2]&&(ux||uz)){const l=Math.hypot(ux,uz),mx=ux/l,mz=uz/l,vn=V.vx*mx+V.vz*mz;try{VITA.carHitBy",
            "q=push(fx,fz,1,V.y),ux=q[0]-fx,uz=q[1]-fz;if(q[2]&&(ux||uz)){const l=Math.hypot(ux,uz),mx=ux/l,mz=uz/l,vn=V.vx*mx+V.vz*mz;try{VITA.carHitBy")
    h = rep("q=push(fx,fz,1),ux=q[0]-fx,uz=q[1]-fz;if(q[2]&&(ux||uz)){const l=Math.hypot(ux,uz),mx=ux/l,mz=uz/l,vn=u.vx*mx+u.vz*mz;",
            "q=push(fx,fz,1,u.y),ux=q[0]-fx,uz=q[1]-fz;if(q[2]&&(ux||uz)){const l=Math.hypot(ux,uz),mx=ux/l,mz=uz/l,vn=u.vx*mx+u.vz*mz;")
    h = rep("q=push(fx,fz,1);if(q[2]){crTrafficHit();const ux=q[0]-fx,uz=q[1]-fz,l=Math.hypot(ux,uz)||1,mx=ux/l,mz=uz/l;nx+=ux;nz+=uz;const vlat=-cn*mx+sn*mz;if(Math.abs(vlat)>.5&&r.vx*vlat<0){r.vx*=-.15}",
            "q=push(fx,fz,1,V.y);if(q[2]){crTrafficHit();const ux=q[0]-fx,uz=q[1]-fz,l=Math.hypot(ux,uz)||1,mx=ux/l,mz=uz/l;nx+=ux;nz+=uz;const vlat=-cn*mx+sn*mz;if(Math.abs(vlat)>.5&&r.vx*vlat<0){r.vx*=-.15}")
    h = rep("q=push(fx,fz,1);if(q[2]){crTrafficHit();const ux=q[0]-fx,uz=q[1]-fz,l=Math.hypot(ux,uz)||1,mx=ux/l,mz=uz/l;nx+=ux;nz+=uz;const vlat=-cn*mx+sn*mz;if(Math.abs(vlat)>.5&&r.vx*vlat<0)r.vx*=-.15;if((sn*mx+cn*mz)*vf<0)vf=u.rlF",
            "q=push(fx,fz,1,u.y);if(q[2]){crTrafficHit();const ux=q[0]-fx,uz=q[1]-fz,l=Math.hypot(ux,uz)||1,mx=ux/l,mz=uz/l;nx+=ux;nz+=uz;const vlat=-cn*mx+sn*mz;if(Math.abs(vlat)>.5&&r.vx*vlat<0)r.vx*=-.15;if((sn*mx+cn*mz)*vf<0)vf=u.rlF")
    h = rep("const q=push(P.x+vx*dt,P.z+vz*dt,P.r);", "const q=push(P.x+vx*dt,P.z+vz*dt,P.r,P.y);")
    h = rep("const q=push(C.x+V.vx*dt,C.z+V.vz*dt,1.2);", "const q=push(C.x+V.vx*dt,C.z+V.vz*dt,1.2,V.y);")
    h = rep("const q=push(C.x+Math.cos(C.h)*2.3,C.z-Math.sin(C.h)*2.3,P.r);", "const q=push(C.x+Math.cos(C.h)*2.3,C.z-Math.sin(C.h)*2.3,P.r,V.y);")
    # 5. telecamera: non si avvicina per un muro che sta a un'altra quota (edificio sopra la galleria in cui si guida)
    h = rep("d=clipDist(C.x,C.z,-dx,-dz,7.5,1);", "d=clipDist(C.x,C.z,-dx,-dz,7.5,1,V.y);")
    h = rep("d=clipDist(C.x,C.z,-dx,-dz,orbDist,1);", "d=clipDist(C.x,C.z,-dx,-dz,orbDist,1,V.y);")
    h = rep("d=clipDist(P.x,P.z,-dx,-dz,aK.d);", "d=clipDist(P.x,P.z,-dx,-dz,aK.d,0,P.y);")
    # 6. veicoli contro veicoli: anche qui la quota (un'auto del traffico o una pattuglia sulla via sopra la galleria non tocca
    #    l'auto del giocatore nella galleria). Prova: nella galleria di Monaco la v31 registrava ancora un urto «car» a 32 km/h.
    #    6a. sagome delle auto del traffico di contorno (scatole in `solids`): quota dell'auto (quella del fotogramma prima)
    h = rep("s.on=1;s.cr=c;s.x0=c.x-1.25;s.x1=c.x+1.25;s.z0=c.z-1.25;s.z1=c.z+1.25}",
            "s.on=1;s.cr=c;s.x0=c.x-1.25;s.x1=c.x+1.25;s.z0=c.z-1.25;s.z1=c.z+1.25;if(c.y===undefined)c.y=GY(c.x,c.z);s.yb=c.y-.3;s.yt=c.y+1.6}")
    #    (le pattuglie e il traffico di VITA prendono la quota in sorgenti/mappa_reale/vita.js)
    #    6b. contatti fra auto (pdCollide): solo se le due auto sono alla stessa quota (entro 2,5 m)
    h = rep("bs.push({p:1,x:C.x,z:C.z,h:C.h,", "bs.push({p:1,x:C.x,z:C.z,y:V.y,h:C.h,")
    h = rep("bs.push({p:0,u,x:u.x,z:u.z,h:u.h,", "bs.push({p:0,u,x:u.x,z:u.z,y:u.y,h:u.h,")
    h = rep("if(Math.hypot(A.x-B.x,A.z-B.z)>7.5)continue;", "if(Math.hypot(A.x-B.x,A.z-B.z)>7.5||Math.abs(A.y-B.y)>2.5)continue;")
    # 7. (31.4) auto che affonda nell'asfalto: la quota dell'auto si avvicinava al suolo con un ritardo (k = 12/s), in salita restava sotto la
    #    superficie (Monaco, via al 49 %: sotto oltre 5 cm per il 44-57 % del percorso, fino a 1,1 m). Ora può scendere con calma (sospensione)
    #    ma non stare sotto la superficie fra le ruote, né sotto il suolo al centro oltre l'altezza da terra (12 cm)
    h = rep("V.y+=((yf+yb)/2-V.y)*k;", "V.y+=((yf+yb)/2-V.y)*k;V.y=Math.max(V.y,(yf+yb)/2-.03,GY(C.x,C.z,yh)-.12);")
    return h, n[0]

if __name__ == '__main__':
    if len(sys.argv) != 3: raise SystemExit('uso: python3 patch_mappa_v31.py pagina_in.html pagina_out.html')
    h = open(sys.argv[1], encoding='utf-8').read(); h, k = applica(h); open(sys.argv[2], 'w', encoding='utf-8').write(h); print('sostituzioni:', k)
