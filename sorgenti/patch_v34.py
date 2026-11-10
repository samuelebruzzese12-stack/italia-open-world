# -*- coding: utf-8 -*-
"""ITALIA OPEN WORLD — V34: pannello della polizia con il tasto «✕ Chiudi» (anche in verticale) e bonus una tantum di 1.000 € nel portafoglio, pieno di gasolio regalato una volta."""
import sys
CSS = r"""
#pp .ph{position:sticky;top:-10px;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:8px;margin:-10px -10px 6px;padding:8px 10px;background:rgba(16,24,34,.98);border-radius:12px 12px 0 0}
#pp .ph span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#p_x{flex:0 0 auto;height:34px;padding:0 12px;font-size:13px;font-weight:800;background:rgba(255,255,255,.92);color:#0b1520;border-radius:10px}
@media (orientation:portrait){#pp{max-height:calc(100% - 140px - var(--st) - var(--sb))}}
"""
def applica(h):
    n=[0]
    def rep(a,b):
        nonlocal h
        c=h.count(a)
        if c!=1: raise SystemExit('patch V34: ancora non trovata/non unica (%d): %s'%(c,a[:100]))
        n[0]+=1; h=h.replace(a,b)
    rep('#pp[hidden]{display:none}','#pp[hidden]{display:none}'+CSS)
    rep('<div id="pp" hidden><div class="ph">Polizia · pattuglie sulle strade vere</div>',
        '<div id="pp" hidden><div class="ph"><span>Polizia · pattuglie sulle strade vere</span><button class="b s" id="p_x" aria-label="Chiudi il pannello della polizia">✕ Chiudi</button></div>')
    rep("function panelInit(){const el=id=>$('#'+id),b=el('pbtn'),p=el('pp');if(!b||!p)return;",
        "function panelInit(){const el=id=>$('#'+id),b=el('pbtn'),p=el('pp');if(!b||!p)return;"
        "{const x=el('p_x');if(x)x.addEventListener('pointerdown',e=>{e.stopPropagation();e.preventDefault();p.hidden=true});addEventListener('keydown',e=>{if(e.key==='Escape')p.hidden=true})}")
    rep("let S=load();",
        "let S=load();\nif(!S.bonusV34){S.bonusV34=1;S.cents+=100000;S.log.push({t:Date.now(),w:'Bonus 1.000 € (versione 34)',c:100000});if(S.log.length>30)S.log.shift()}   /* V34: +1.000 € una volta sola */")
    # pieno di gasolio regalato una volta (richiesto: «aggiungi un po' di benzina perché l'ho finita»)
    rep("VEHX.ripristina(S.veicolo);",
        "VEHX.ripristina(S.veicolo);if(VEHOK&&!S.pienoV34){S.pienoV34=1;const L=VEH.par.serbatoio-VEH.carburante.litri;if(L>0)IOW_FISICA.rifornisci(VEH,L);save();setTimeout(()=>toast('Serbatoio pieno: '+Math.round(VEH.carburante.litri)+' L di gasolio regalati'),1500)}")
    return h,n[0]
