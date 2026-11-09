# -*- coding: utf-8 -*-
"""ITALIA OPEN WORLD — versione 32: blackout della centralina negli urti forti e informatore con assalto al covo, DENTRO il gioco.

Sostituzioni su ancore uniche della pagina costruita (come patch_solver_v30.py e patch_mappa_v31.py): un'ancora mancante ferma la costruzione.

1. Blackout della centralina (VCU): a ogni urto dell'auto del giocatore il risolutore dei danni (motore/danni_solver.js) dà l'impulso J, la
   massa e una stima della durata del contatto. Accelerazione media dell'auto = (J / m) / durata (durata limitata a 0,04–0,25 s; 0,1 s se il
   risolutore non la stima). Oltre 15 g le centraline ABS ed ESC vanno fuori linea (guasto «timeout» nel modulo motore/ecu.js, lo stesso
   meccanismo dei guasti virtuali del pannello del veicolo): senza ABS le ruote si bloccano in frenata, senza ESC e ASR nessuna correzione.
   Messaggio a schermo; si ripristinano con «Ripara l'auto».
2. Informatore (motore/informatore.js): pulsante 📱, chat a testo libero, covo, fedina. Lo stato si salva con la partita (S.inf). I reati
   sono quelli che la polizia del gioco registra (PL.offence); «visto» = una pattuglia ha il contatto visivo; stelle = PL.heat.
   All'irruzione con il giocatore al covo: radio «Siamo in posizione, andiamo» (voce e sottotitoli della polizia), 5 stelle, 4 pattuglie che
   nascono attorno al covo e inseguono.
"""
import sys

GLUE = r"""/* ---- v32: blackout della centralina negli urti forti (sorgenti/patch_v32.py) ---- */
const VCU={ko:false,g:0,gMax:0,soglia:15,ids:[],n:0};
function vcuUrto(ev,m){if(!ev||ev.duplicato||typeof VEHOK==='undefined'||!VEHOK||!ECUN)return;const dv=Math.abs(ev.J||0)/Math.max(1,m||1),dur=Math.min(.25,Math.max(.04,Number.isFinite(ev.durata)&&ev.durata>0?ev.durata:.1)),g=dv/dur/9.81;
 VCU.g=g;VCU.gMax=Math.max(VCU.gMax,g);VCU.n++;if(g<=VCU.soglia||VCU.ko)return;VCU.ko=true;
 for(const e of ['ABS','ESC'])VCU.ids.push(IOW_ECU.iniettaGuasto(ECUN,{ecu:e,tipo:'timeout',descr:'blackout da urto di '+g.toFixed(1)+' g'}));
 toast('[CENTRALINA KO] Urto di '+g.toFixed(1)+' g: ABS, ESP e ASR disattivati — controllo puramente meccanico')}
function vcuRipara(){if(!VCU.ko||!ECUN)return;for(const id of VCU.ids)IOW_ECU.rimuoviGuasti(ECUN,id);VCU.ids=[];VCU.ko=false;VCU.gMax=0}
/* ---- v32: informatore e assalto al covo (motore/informatore.js) ---- */
const INF={ok:false,acc:0,ui:false,badge:false};
function infStato(){if(!window.IOW_INFORMATORE)return null;if(!S.inf||!IOW_INFORMATORE.valido(S.inf))S.inf=IOW_INFORMATORE.crea();return S.inf}
function infAggancia(){if(INF.ok||!window.IOW_INFORMATORE||typeof PL==='undefined'||!PL.offence)return;const o=PL.offence;
 PL.offence=function(kind){const prima=PL.lastOff[kind],r=o.apply(this,arguments);try{if(PL.lastOff[kind]!==prima){const st=infStato();if(st){IOW_INFORMATORE.reato(st,kind);save()}}}catch(e){}return r};INF.ok=true}
function infDove(){const T=inCar?C:P;let n='';try{n=REAL.placeName(T.x,T.z)||''}catch(e){}return{x:T.x,z:T.z,luogo:n}}
function infUi(){if(INF.ui)return;INF.ui=true;const b=$('#ibtn'),p=$('#ip');if(!b||!p)return;const stop=e=>e.stopPropagation();
 b.addEventListener('pointerdown',e=>{e.stopPropagation();p.hidden=!p.hidden;INF.badge=false;b.classList.remove('nuovo');infRender()});
 for(const ev of ['pointerdown','touchstart','keydown','keyup'])p.addEventListener(ev,stop);
 $('#i_send').addEventListener('click',()=>{const i=$('#i_txt'),t=i.value.trim();if(!t)return;const st=infStato();if(!st)return;IOW_INFORMATORE.rispondi(st,t,{stelle:Math.round(PL.heat||0)});i.value='';save();infRender()});
 $('#i_txt').addEventListener('keydown',e=>{if(e.key==='Enter')$('#i_send').click()});
 $('#i_covo').addEventListener('click',()=>{const st=infStato();if(!st)return;const d=infDove();IOW_INFORMATORE.fissaCovo(st,d.x,d.z,d.luogo||'zona senza nome');save();toast('Covo fissato: '+(d.luogo||'qui'));infRender()});
 $('#i_x').addEventListener('click',()=>{p.hidden=true})}
function infRender(){const p=$('#ip');if(!p||p.hidden)return;const st=infStato();if(!st)return;const I=IOW_INFORMATORE,a=I.anni(st),pi=st.piano;
 $('#i_stato').textContent=(st.covo?'Covo: '+st.covo.nome+(pi.attivo?' — operazione in corso: '+I.fase(st)+' '+Math.floor(pi.avanzamento)+' %':pi.fatto?' — operazione finita':' — nessuna operazione'):'Nessun covo: tocca «Covo qui»')+' · Fedina: '+(a?a+' anni ('+I.carcere(a)+')':'pulita');
 const L=$('#i_chat');L.innerHTML='';for(const m of st.chat.slice(-14)){const d=document.createElement('div');d.className=m.da==='io'?'io':'inf';d.textContent=(m.da==='io'?'Tu: ':'Informatore: ')+m.testo;L.appendChild(d)}L.scrollTop=L.scrollHeight}
function infStep(dt){if(!window.IOW_INFORMATORE)return;infAggancia();infUi();INF.acc+=dt;if(INF.acc<.25)return;const st=infStato();if(!st){INF.acc=0;return}
 const d=infDove(),visto=typeof PL!=='undefined'&&PL.units.some(u=>u.see&&u.status!=='gone'),ev=IOW_INFORMATORE.passo(st,INF.acc,{t:PL.t,stelle:Math.round(PL.heat||0),visto,x:d.x,z:d.z,luogo:d.luogo});INF.acc=0;
 for(const e of ev){if(e.tipo==='irruzione'){try{say(e.testo,4)}catch(x){}PL.heat=5;PL.seenT=PL.t;for(let k=0;k<4;k++){const u=spawnPatrol(e.x,e.z,true,true);if(u)u.state='chase'}toast('Irruzione al covo di '+e.covo+'! Scappa')}
  else{toast((e.tipo==='notifica'?'📱 ':'📱 Informatore: ')+e.testo);if(e.tipo==='notifica')try{navigator.vibrate&&navigator.vibrate([200,100,200])}catch(x){}}
  st.chat.push({da:'informatore',testo:e.testo});INF.badge=true;const b=$('#ibtn');if(b&&$('#ip').hidden)b.classList.add('nuovo')}
 if(ev.length)save();infRender()}
/* per le prove automatiche (come window.__iow) */
window.__v32={VCU,INF,infStato,infStep,get ecu(){return typeof ECUN!=='undefined'?ECUN:null},get PL(){return typeof PL!=='undefined'?PL:null},get veh(){return typeof VEH!=='undefined'?VEH:null}};
"""

HTML_BTN = '<button class="b" id="ibtn" title="Telefono: informatore">📱</button><div id="ip" hidden><div class="ph">📱 Informatore della Questura</div><div id="i_stato"></div><div id="i_chat"></div><div class="pr"><input id="i_txt" type="text" maxlength="140" placeholder="Scrivi all\'informatore…" autocomplete="off"><button class="b s" id="i_send">Invia</button></div><div class="pr"><button class="b s" id="i_covo">📍 Covo qui</button><button class="b s" id="i_x">Chiudi</button></div><div class="nota">Personaggi, articoli e carceri sono di finzione. L\'informatore capisce frasi su indagini, accuse, piani e posizione.</div></div>'

CSS = ("#ibtn{position:absolute;left:calc(10px + var(--sl));top:calc(248px + var(--st));width:42px;height:42px;border-radius:50%;padding:0;font-size:20px;display:flex;align-items:center;justify-content:center}"
       "#ibtn.nuovo{box-shadow:0 0 0 3px #e53935}"
       "#ip{position:absolute;left:calc(60px + var(--sl));top:calc(56px + var(--st));width:min(88vw,380px);max-height:calc(100% - 66px);overflow:auto;background:rgba(16,24,34,.95);color:#fff;border-radius:12px;padding:10px;font-size:13px;z-index:30}"
       "#ip[hidden]{display:none}#ip .ph{font-weight:800;margin-bottom:6px}#ip .pr{display:flex;gap:6px;margin:8px 0}#ip .s{height:38px;padding:0 10px;font-size:13px}"
       "#i_stato{opacity:.85;margin-bottom:6px}#i_chat{max-height:34vh;overflow:auto;background:rgba(255,255,255,.06);border-radius:8px;padding:6px}#i_chat div{padding:3px 0}#i_chat .io{color:#9ecbff}"
       "#i_txt{flex:1;min-width:0;height:38px;border-radius:8px;border:0;padding:0 8px;font-size:15px}#ip .nota{font-size:11px;opacity:.6}#ip,#ip *{touch-action:pan-y}")


def applica(h):
    n = [0]

    def rep(a, b):
        nonlocal h
        c = h.count(a)
        if c != 1:
            raise SystemExit('patch v32: ancora trovata %d volte: %r' % (c, a[:80]))
        h = h.replace(a, b)
        n[0] += 1

    rep('<script src="motore/danni_solver.js"></script>', '<script src="motore/danni_solver.js"></script><script src="motore/informatore.js"></script>')
    rep('#pp,#pp *{touch-action:pan-y}', '#pp,#pp *{touch-action:pan-y}' + CSS)
    rep('<button class="b" id="vbtn" title="Veicolo">🚗</button>', '<button class="b" id="vbtn" title="Veicolo">🚗</button>' + HTML_BTN)
    # 1. urto → centralina (solo l'auto del giocatore; una volta per evento, come lo storico dei danni)
    rep("IOW_DANNI.urto(DANS,{lx,lz,imp,kind,massa:m1,t:VEHX.t,energia:ev.Eown,duplicato:ev.duplicato});",
        "IOW_DANNI.urto(DANS,{lx,lz,imp,kind,massa:m1,t:VEHX.t,energia:ev.Eown,duplicato:ev.duplicato});if(own===carA&&imp>=3.2)vcuUrto(ev,m1);")
    rep("DMGREP=null;dmgRepair(carA);dmgDrive();dmgHud();", "DMGREP=null;dmgRepair(carA);vcuRipara();dmgDrive();dmgHud();")
    # 2. passo di gioco: informatore
    rep("function step(dt){const ts=performance.now()/1000;", GLUE + "function step(dt){const ts=performance.now()/1000;try{infStep(dt)}catch(e){}")
    return h, n[0]


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit('uso: python3 patch_v32.py pagina_in.html pagina_out.html')
    h = open(sys.argv[1], encoding='utf-8').read(); h, k = applica(h); open(sys.argv[2], 'w', encoding='utf-8').write(h); print('sostituzioni:', k)
