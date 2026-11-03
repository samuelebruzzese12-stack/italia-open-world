# Assembla la pagina: sostituisce il modulo WORLD con world_v2.js e applica le modifiche collegate (CHK, caricamento, limiti del mondo).
import re,sys,os
D=os.environ.get('IOW_BUILD_DIR',os.path.dirname(os.path.abspath(__file__))+'/')   # cartella di questa costruzione (tools/build del repository)
REPO=os.path.abspath(os.path.join(D,'..','..'))+'/'                                   # radice del repository
SRC=D+'w2/base.html'            # pagina di partenza (Versione 10)
import os
OUT=os.environ.get('OUTP',REPO+'index.html')   # pagina pubblicata (GitHub Pages serve index.html dalla radice)
PSJ='h/page_script.js' if not os.environ.get('OUTP') else 'h/page_script_next.js'
h=open(SRC,encoding='utf-8').read()
def rep(old,new,n=1):
    global h
    c=h.count(old)
    assert c==n,(old[:80],c)
    h=h.replace(old,new)
# 1) modulo WORLD
i=h.find('const WORLD=(()=>{'); j=h.find('})();',i)+5
assert i>0 and j>i
w2=open(D+'w2/world_v2.js',encoding='utf-8').read().replace('/*@MWALIGN@*/',open(D+'w2/world_mw_gen.js',encoding='utf-8').read()).replace('/*@MOTORWAY@*/',open(D+'w2/world_mw_feat.js',encoding='utf-8').read()).replace('/*@MILAN@*/',open(D+'w2/world_milan.js',encoding='utf-8').read()).replace('/*@CITIES@*/',open(D+'w2/world_city.js',encoding='utf-8').read())
h=h[:i]+w2+h[j:]
# 2) CHK: occupazione del terreno tramite ogi
rep("const ix=Math.floor((x+WS)/W.OS),iz=Math.floor((z+WS)/W.OS),OG=W.OG,OW=W.OW,o=ix>5&&iz>5&&ix<OW-6&&iz<OW-6&&(OG[iz*OW+ix]||OG[iz*OW+ix+4]||OG[iz*OW+ix-4]||OG[(iz+4)*OW+ix]||OG[(iz-4)*OW+ix]);",
    "const ix=Math.floor((x+WS)/W.OS),iz=Math.floor((z+WS)/W.OS),o=(W.ogi(ix,iz)||W.ogi(ix+4,iz)||W.ogi(ix-4,iz)||W.ogi(ix,iz+4)||W.ogi(ix,iz-4));")
rep("function trees(cx,cz,TR){const x0=-WS+cx*CSZ,z0=-WS+cz*CSZ,S=13,OG=W.OG,OW=W.OW;",
    "function trees(cx,cz,TR){const x0=-WS+cx*CSZ,z0=-WS+cz*CSZ,S=13;")
rep("ix=Math.floor((x+WS)/W.OS),iz=Math.floor((z+WS)/W.OS);if(ix<6||iz<6||ix>=OW-6||iz>=OW-6||OG[iz*OW+ix])continue;",
    "ix=Math.floor((x+WS)/W.OS),iz=Math.floor((z+WS)/W.OS);if(W.ogi(ix,iz))continue;")
rep("u=OG[iz*OW+ix+5]||OG[iz*OW+ix-5]||OG[(iz+5)*OW+ix]||OG[(iz-5)*OW+ix];",
    "u=W.ogi(ix+5,iz)||W.ogi(ix-5,iz)||W.ogi(ix,iz+5)||W.ogi(ix,iz-5);")
# 3) caricamento dei blocchi: rettangolo del mondo
rep("if(a<0||b<0||a>=WORLD.NCH||b>=WORLD.NCH||dx*dx+dz*dz>RADC*RADC+2)continue;",
    "if(!WORLD.chunkOK(a,b)||dx*dx+dz*dz>RADC*RADC+2)continue;")
# 4) mare e terreno lontano estesi al rettangolo
rep("{const sea=new T.Mesh(new T.PlaneGeometry(9000,9000),new T.MeshStandardMaterial({color:lc(0x1d6a86),roughness:.05,metalness:.2,transparent:true,opacity:.8,envMapIntensity:1.8,depthWrite:false}));sea.rotation.x=-PI/2;sea.position.y=WORLD.SEA;sc.add(sea)}",
    "{const sea=new T.Mesh(new T.PlaneGeometry(WORLD.X1-WORLD.X0+6000,WORLD.Z1-WORLD.Z0+6000),new T.MeshStandardMaterial({color:lc(0x1d6a86),roughness:.05,metalness:.2,transparent:true,opacity:.8,envMapIntensity:1.8,depthWrite:false}));sea.rotation.x=-PI/2;sea.position.set((WORLD.X0+WORLD.X1)/2,WORLD.SEA,(WORLD.Z0+WORLD.Z1)/2);sc.add(sea)}")
rep("{const N=60,S=100,m=new CHK.MB(0),hh=[];for(let j=-1;j<=N+1;j++)for(let i=-1;i<=N+1;i++)hh.push(WORLD.H(-3000+i*S,-3000+j*S));const g=(i,j)=>hh[(j+1)*(N+3)+i+1];\n for(let j=0;j<=N;j++)for(let i=0;i<=N;i++){const x=-3000+i*S,z=-3000+j*S,y=g(i,j),dx=(g(i-1,j)-g(i+1,j))/(2*S),dz=(g(i,j-1)-g(i,j+1))/(2*S),l=Math.hypot(dx,1,dz);m.v(x,y-2.2,z,dx/l,1/l,dz/l,CHK.tcol(x,y,z,Math.hypot(dx,dz)))}\n for(let j=0;j<N;j++)for(let i=0;i<N;i++){const a=j*(N+1)+i,b=a+1,d=a+N+1,c=d+1;m.I.push(a,d,b,b,d,c)}",
    "{const S=200,NX=Math.ceil((WORLD.X1-WORLD.X0)/S),NZ=Math.ceil((WORLD.Z1-WORLD.Z0)/S),m=new CHK.MB(0),hh=[];for(let j=-1;j<=NZ+1;j++)for(let i=-1;i<=NX+1;i++)hh.push(WORLD.H(WORLD.X0+i*S,WORLD.Z0+j*S));const g=(i,j)=>hh[(j+1)*(NX+3)+i+1];\n for(let j=0;j<=NZ;j++)for(let i=0;i<=NX;i++){const x=WORLD.X0+i*S,z=WORLD.Z0+j*S,y=g(i,j),dx=(g(i-1,j)-g(i+1,j))/(2*S),dz=(g(i,j-1)-g(i,j+1))/(2*S),l=Math.hypot(dx,1,dz);m.v(x,y-2.2,z,dx/l,1/l,dz/l,CHK.tcol(x,y,z,Math.hypot(dx,dz)))}\n for(let j=0;j<NZ;j++)for(let i=0;i<NX;i++){const a=j*(NX+1)+i,b=a+1,d=a+NX+1,c=d+1;m.I.push(a,d,b,b,d,c)}")
# 5) limiti del mondo per auto, pattuglie e controlli di spazio libero
rep("if(WORLD.wet(nx,nz)||Math.abs(nx)>2960||Math.abs(nz)>2960){nx=u.x;nz=u.z;u.vx*=-.3;u.vz*=-.3}",
    "if(WORLD.wet(nx,nz)||!WORLD.inside(nx,nz,40)){nx=u.x;nz=u.z;u.vx*=-.3;u.vz*=-.3}")
rep("if(WORLD.wet(px,pz)||Math.abs(px)>2950||Math.abs(pz)>2950){d=Math.max(0,s2-4);break}",
    "if(WORLD.wet(px,pz)||!WORLD.inside(px,pz,50)){d=Math.max(0,s2-4);break}")
rep("if(WORLD.wet(nx,nz)||Math.abs(nx)>2960||Math.abs(nz)>2960){nx=C.x;nz=C.z;V.vx*=-.3;V.vz*=-.3}",
    "if(WORLD.wet(nx,nz)||!WORLD.inside(nx,nz,40)){nx=C.x;nz=C.z;V.vx*=-.3;V.vz*=-.3}")
h=h.replace("WORLD.wet(nx,nz)||Math.abs(nx)>2960||Math.abs(nz)>2960||(ds>1e-4","WORLD.wet(nx,nz)||!WORLD.inside(nx,nz,40)||(ds>1e-4")

# 6) resa delle strade: attraversamenti pedonali agli incroci urbani, banchine sterrate fuori città
rep("if(sw){const cnt=s.arc?0:Math.floor(L/38);",
    "if(sw&&s.k<=1&&L>=16){for(const e of [[s.ax,s.az,1],[s.bx,s.bz,-1]]){if(W.nodeDeg(e[0],e[1])<3)continue;const cx=e[0]+ux*e[2]*7.5,cz=e[1]+uz*e[2]*7.5,nst=Math.floor((hw*2-1)/1);for(let i=0;i<nst;i+=2){const off=-hw+1+i;const px=cx+nx*off,pz=cz+nz*off,q=[[px-ux*1.4-nx*.25,pz-uz*1.4-nz*.25],[px+ux*1.4-nx*.25,pz+uz*1.4-nz*.25],[px+ux*1.4+nx*.25,pz+uz*1.4+nz*.25],[px-ux*1.4+nx*.25,pz-uz*1.4+nz*.25]];face(RP,q.map(v=>[v[0],H(v[0],v[1])+oy+.012,v[1]]),[.92,.92,.9],[0,1,0])}}}"
    "if(!sw&&!s.br&&s.k!==2&&s.k!==6){const gc=hx(0x9b8f74);for(const side of [1,-1]){let q0=null;for(let i=0;i<=n;i++){const t=i/n,x=s.ax+ux*L*t,z=s.az+uz*L*t,x1=x+nx*side*hw,z1=z+nz*side*hw,x2=x+nx*side*(hw+1.1),z2=z+nz*side*(hw+1.1),a=RP.v(x1,H(x1,z1)+oy-.003,z1,0,1,0,gc),b=RP.v(x2,H(x2,z2)+oy-.003,z2,0,1,0,gc);if(q0)RP.fq(q0[0],q0[1],b,a,0,1,0);q0=[a,b]}}}"
    "if(sw){const cnt=s.arc?0:Math.floor(L/38);")

# 7) vista 360° con pulsante dedicato e zoom a pizzico; radio di bordo con ruota delle stazioni (stile GTA)
rep('<button class="b" id="vw">VISTA</button></div>','<button class="b" id="rbtn" title="Radio">📻</button><button class="b" id="v360">360°</button><button class="b" id="vw">VISTA</button></div>')
rep('<div id="menu" hidden>','<div id="rw" hidden><div id="rwc"><div id="rwring"></div><div id="rwname"></div></div><div id="rwhint">Trascina sulla ruota e rilascia · tocca fuori per chiudere</div><button class="b" id="rwx" style="color:var(--ink);background:rgba(255,255,255,.88);text-shadow:none">Chiudi</button></div><div id="rnow" hidden><div class="rn1">📻 <span id="rn_st"></span></div><div class="rn2" id="rn_song"></div></div>\n<div id="menu" hidden>')
rep('#ld{position:fixed;inset:0;z-index:9;',
    '#rw{position:absolute;inset:0;background:radial-gradient(circle at 50% 50%,rgba(0,0,0,.35) 0,rgba(0,0,0,.72) 70%);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:14px}#rw[hidden]{display:none}'
    '#rwc{position:relative;width:280px;height:280px;border-radius:50%;border:3px solid rgba(255,255,255,.35);background:rgba(255,255,255,.06);box-shadow:0 0 0 18px rgba(255,255,255,.05)}'
    '.rwi{position:absolute;width:78px;height:78px;margin:-39px;border-radius:50%;background:rgba(20,22,28,.92);border:3px solid rgba(255,255,255,.5);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;font:700 10px system-ui,sans-serif;text-align:center;line-height:1.1;transition:transform .12s,box-shadow .12s}'
    '.rwi span{font-size:26px;line-height:1}.rwi b{max-width:70px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rwi.on{transform:scale(1.22);box-shadow:0 0 0 4px #fff,0 0 22px #fff8;background:rgba(40,44,54,.98)}'
    '#rwname{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:120px;text-align:center;color:#fff;font:800 14px system-ui,sans-serif;text-shadow:0 1px 3px #000;pointer-events:none}'
    '#rwhint{color:#fff;opacity:.8;font:600 12px system-ui,sans-serif;text-shadow:0 1px 2px #000}'
    '#rnow{position:absolute;left:50%;top:calc(76px + var(--st));transform:translateX(-50%);background:rgba(10,12,18,.86);color:#fff;border-radius:12px;padding:8px 14px;text-align:center;pointer-events:none;box-shadow:0 4px 16px #0008;min-width:200px}#rnow[hidden]{display:none}.rn1{font:800 15px system-ui,sans-serif;letter-spacing:.5px}.rn2{font:600 12px system-ui,sans-serif;opacity:.85;margin-top:2px}'
    '#ld{position:fixed;inset:0;z-index:9;')
rep("$('#vw').onclick=toggleView;",
    "$('#vw').onclick=toggleView;\n"
    "$('#v360').onclick=()=>{if(!inCar){toast('Sali in auto per la vista 360°');return}if(view===3){view=0;toast('Vista: dietro')}else{view=3;orbYaw=0;orbPitch=.35;orbDist=8.5;toast('Vista 360°: trascina a destra per girare, pizzica per avvicinare')}};\n"
    "let pinchD=0,orbDist=8.5;$('#look').addEventListener('touchstart',e=>{const t=e.targetTouches;if(t.length===2)pinchD=Math.hypot(t[0].clientX-t[1].clientX,t[0].clientY-t[1].clientY);else pinchD=0},{passive:true});\n"
    "$('#look').addEventListener('touchmove',e=>{const t=e.targetTouches;if(t.length===2&&view===3&&inCar){const d=Math.hypot(t[0].clientX-t[1].clientX,t[0].clientY-t[1].clientY);if(pinchD>0&&d>0)orbDist=cl(orbDist*pinchD/d,4.5,16);pinchD=d}else pinchD=0},{passive:true});$('#look').addEventListener('touchend',e=>{pinchD=0},{passive:true});\n"
    "/* ===== Radio di bordo: ruota delle stazioni (stile GTA), una stazione per ora ===== */\n"
    "const RADIO={st:[{name:'Radio Gemelli',song:'Totò & Gemelli — ’U capu stanza',src:'radio/u-capu-stanza.mp3',ico:'🎶',col:'#e0432f'}],cur:0,el:null,vol:.75,sel:0,open:false};\n"
    "RADIO.cur=Math.max(0,Math.min(RADIO.st.length,S.radio|0));\n"
    "function radioEnsure(){const s=RADIO.st[RADIO.cur-1];if(!s)return null;if(!RADIO.el||RADIO.el.dataset.src!==s.src){if(RADIO.el)RADIO.el.pause();const a=new Audio(s.src);a.loop=true;a.preload='auto';a.volume=RADIO.vol;a.dataset.src=s.src;RADIO.el=a}return RADIO.el}\n"
    "function radioNow(st,song){const e=$('#rnow');$('#rn_st').textContent=st;$('#rn_song').textContent=song;e.hidden=false;clearTimeout(RADIO.nt);RADIO.nt=setTimeout(()=>{e.hidden=true},4200)}\n"
    "function radioApply(announce){if(RADIO.cur===0){if(RADIO.el)RADIO.el.pause();if(announce)radioNow('Radio spenta','');return}const a=radioEnsure(),s=RADIO.st[RADIO.cur-1];if(inCar){const p=a.play();if(p&&p.catch)p.catch(()=>{})}else a.pause();if(announce)radioNow(s.name,s.song)}\n"
    "function rwBuild(){const ring=$('#rwring');ring.innerHTML='';const N=RADIO.st.length+1;for(let i=0;i<N;i++){const a=-Math.PI/2+i/N*2*Math.PI,R=108,el=document.createElement('div');el.className='rwi'+(i===RADIO.sel?' on':'');el.style.left=(140+Math.cos(a)*R)+'px';el.style.top=(140+Math.sin(a)*R)+'px';el.innerHTML=i===0?'<span>⏻</span><b>SPENTA</b>':'<span>'+RADIO.st[i-1].ico+'</span><b>'+RADIO.st[i-1].name+'</b>';if(i)el.style.borderColor=RADIO.st[i-1].col;ring.appendChild(el)}$('#rwname').textContent=RADIO.sel===0?'Radio spenta':RADIO.st[RADIO.sel-1].name}\n"
    "function rwOpen(o){RADIO.open=o;$('#rw').hidden=!o;if(o){RADIO.sel=RADIO.cur;rwBuild()}}\n"
    "{const rw=$('#rw'),rc=$('#rwc');let pid=null,pt0=0;\n"
    " const setSel=i=>{RADIO.sel=i;rw.querySelectorAll('.rwi').forEach((el,k)=>el.classList.toggle('on',k===i));$('#rwname').textContent=i===0?'Radio spenta':RADIO.st[i-1].name};\n"
    " const selAt=(x,y)=>{const r=rc.getBoundingClientRect(),dx=x-(r.left+r.width/2),dy=y-(r.top+r.height/2),d=Math.hypot(dx,dy);if(d<30||d>200)return d;const N=RADIO.st.length+1;let a=Math.atan2(dy,dx)+Math.PI/2;a=(a%(2*Math.PI)+2*Math.PI)%(2*Math.PI);const i=Math.round(a/(2*Math.PI)*N)%N;if(i!==RADIO.sel)setSel(i);return d};\n"
    " rw.addEventListener('pointerdown',e=>{if(e.target&&e.target.id==='rwx')return;if(pid!==null&&performance.now()-pt0<2500)return;pid=e.pointerId;pt0=performance.now();try{rw.setPointerCapture(pid)}catch(_){}const d=selAt(e.clientX,e.clientY);if(d>200){pid=null;try{rw.releasePointerCapture(e.pointerId)}catch(_){}rwOpen(false)}});\n"
    " rw.addEventListener('pointermove',e=>{if(e.pointerId!==pid)return;selAt(e.clientX,e.clientY)});\n"
    " const end=e=>{if(e.pointerId!==pid)return;pid=null;try{rw.releasePointerCapture(e.pointerId)}catch(_){}RADIO.cur=RADIO.sel;S.radio=RADIO.cur;save();rwOpen(false);try{radioApply(true)}catch(err){toast('Radio: '+err.message)}};\n"
    " rw.addEventListener('pointerup',end);rw.addEventListener('pointercancel',end);$('#rwx').onclick=()=>{pid=null;rwOpen(false)}}\n"
    "$('#rbtn').onclick=()=>{if(!inCar){toast('La radio si ascolta in auto');return}rwOpen(!RADIO.open)};\n"
    "addEventListener('keydown',e=>{if(e.key==='r'||e.key==='R'){if(inCar)rwOpen(!RADIO.open)}});")
rep("{x:C.x,z:C.z,r:3,t:'Sali in auto',a:()=>{inCar=true;S.inCar=true;cs.v=0;camYaw=C.h;view=0;lookYaw=lookPitch=0;save()}});",
    "{x:C.x,z:C.z,r:3,t:'Sali in auto',a:()=>{inCar=true;S.inCar=true;cs.v=0;camYaw=C.h;view=0;lookYaw=lookPitch=0;save();radioApply(RADIO.cur>0)}});")
rep("P.y=GY(P.x,P.z);inCar=false;S.inCar=false;cs.v=0;V.vx=V.vz=0;yaw=camYaw;pitch=-.2;save()}",
    "P.y=GY(P.x,P.z);inCar=false;S.inCar=false;cs.v=0;V.vx=V.vz=0;yaw=camYaw;pitch=-.2;save();if(RADIO.el)RADIO.el.pause();rwOpen(false)}")
rep("else if(view===3){yaw=C.h+orbYaw;pitch=-orbPitch;const cp=Math.cos(pitch),dx=Math.sin(yaw)*cp,dz=Math.cos(yaw)*cp,dy=Math.sin(pitch);d=clipDist(C.x,C.z,-dx,-dz,8.5);cam.position.set(C.x-dx*d,V.y+1.3-dy*d,C.z-dz*d)}",
    "else if(view===3){yaw=C.h+orbYaw;pitch=-orbPitch;const cp=Math.cos(pitch),dx=Math.sin(yaw)*cp,dz=Math.cos(yaw)*cp,dy=Math.sin(pitch);d=clipDist(C.x,C.z,-dx,-dz,orbDist);cam.position.set(C.x-dx*d,V.y+1.3+(orbDist-8.5)*.12-dy*d,C.z-dz*d)}")
# abbassamento della musica quando parla la radio della polizia; ripresa all'avvio se la radio era accesa
rep("function step(dt){const ts=performance.now()/1000;",
    "function step(dt){const ts=performance.now()/1000;if(RADIO.el&&!RADIO.el.paused){const tv=(VOICE.cur?.22:1)*RADIO.vol*(inCar?1:0);RADIO.el.volume+=(tv-RADIO.el.volume)*Math.min(1,dt*4)}")
rep("$('#mm').addEventListener('pointerdown',e=>{e.stopPropagation();openMap(true)});",
    "$('#mm').addEventListener('pointerdown',e=>{e.stopPropagation();openMap(true)});\nif(inCar&&RADIO.cur>0){const once=()=>{radioApply(false);removeEventListener('pointerdown',once)};addEventListener('pointerdown',once)}")

# 8) CHK: autostrada (materiali, guardrail, segnali, caselli, aree di servizio)
rep("const ASF=hx(0x44464b),SWK=hx(0x9a9890),STN=hx(0xb4aea2),WHT=[1,1,1],POLE=hx(0x26282c),ROADY=[.07,.062,.05,.056,.07],sm=W.sm;",
    "const ASF=hx(0x44464b),SWK=hx(0x9a9890),STN=hx(0xb4aea2),WHT=[1,1,1],POLE=hx(0x26282c),ROADY=[.07,.062,.05,.056,.07,.075,.064,.07,.05,.064],sm=W.sm;let CUR=null;")
rep("if(s.br)return deck(s,RP);","if(s.br)return deck(s,RP,segs);")
rep("n=Math.max(1,Math.ceil(L/5)),m=s.k===2?RC:RM,oy=ROADY[s.k]+(Math.floor(Math.abs(s.ax*7+s.az*13))%7)*.0007,vs=s.k===2?4:8,",
    "n=Math.max(1,Math.ceil(L/5)),m=s.k===2?RC:s.k===5?CUR.RW:(s.k===6||s.k===8)?CUR.RL:RM,oy=ROADY[s.k]+(Math.floor(Math.abs(s.ax*7+s.az*13))%7)*.0007,vs=s.k===2?4:s.k===5?12:8,")
rep("  if(p0){m.fq(p0.a,p0.c,c,a,0,1,0);m.fq(p0.c,p0.b,b,c,0,1,0)}p0={a,b,c}}",
    "  if(p0){m.fq(p0.a,p0.c,c,a,0,1,0);m.fq(p0.c,p0.b,b,c,0,1,0)}p0={a,b,c}}\n if(s.k===5)mwRail(s,RP,SO,segs);")
rep("if(!sw&&!s.br&&s.k!==2&&s.k!==6){const gc=hx(0x9b8f74);","if(!sw&&!s.br&&s.k!==2&&s.k!==6&&s.k!==5&&s.k!==8){const gc=hx(0x9b8f74);")
rep("function deck(s,m){const L=s.len,","function deck(s,m,segs){const L=s.len,")
rep("top=W.deckAt(s,t)-1.4+.07,y0=H(cx,cz)-.7;if(top-y0>2.4)ob(m,cx,y0,cz,2*hw-1.2,top-y0,1.6,Math.atan2(nz,nx),st)}}",
    "top=W.deckAt(s,t)-1.4+.07,y0=H(cx,cz)-.7;if(top-y0>2.4&&!(s.over&&segs&&roadEdge(segs,cx,cz,s)<1.2))ob(m,cx,y0,cz,2*hw-1.2,top-y0,1.6,Math.atan2(nz,nx),st)}}")
rep("function spec(sp,F,RF,TR,SO){const c=Math.cos(sp.a),s=Math.sin(sp.a),","function spec(sp,F,RF,TR,SO){if(sp.t==='toll')return specToll(sp,RF,SO);if(sp.t==='sa')return specSA(sp,F,RF,TR,SO);if(sp.t==='porto')return specPorto(sp,RF,TR,SO);const c=Math.cos(sp.a),s=Math.sin(sp.a),")
rep("function chunk(cx,cz,GS,NQ){const key=cx+','+cz,segs=nearSegs(cx,cz),T=terrain(cx,cz,GS||6,NQ||25,segs),RM=new MB(1),RC=new MB(1),RP=new MB(0),F=[new MB(1),new MB(1),new MB(1),new MB(1),new MB(1)],RF=new MB(0),TR=new MB(0),WT=new MB(0),SO=[];",
    "function chunk(cx,cz,GS,NQ){const key=cx+','+cz,segs=nearSegs(cx,cz),T=terrain(cx,cz,GS||6,NQ||25,segs),RM=new MB(1),RC=new MB(1),RP=new MB(0),F=[new MB(1),new MB(1),new MB(1),new MB(1),new MB(1)],RF=new MB(0),TR=new MB(0),WT=new MB(0),SO=[],RW=new MB(1),RL=new MB(1),SG=new MB(1);CUR={RW,RL,SG};")
rep(" trees(cx,cz,TR);landmarks(cx,cz,RF,SO,segs);for(const sp of W.SPCH.get(key)||[])spec(sp,F,RF,TR,SO);",
    " trees(cx,cz,TR);landmarks(cx,cz,RF,SO,segs);for(const sp of W.SPCH.get(key)||[])spec(sp,F,RF,TR,SO);signs(cx,cz,RP,SG,SO);")
rep(" return{T,RM,RC,RP,F,RF,TR,WT,SO}}\nreturn{chunk,terrain,MB,hx,tcol}"," return{T,RM,RC,RP,F,RF,TR,WT,SO,RW,RL,SG}}\nreturn{chunk,terrain,MB,hx,tcol}")
# funzioni nuove di CHK prima di "/* chunk completo */"
rep("/* chunk completo */",open(D+'w2/chk_mw.js',encoding='utf-8').read()+"\n"+open(D+'w2/chk_city.js',encoding='utf-8').read()+"\n/* chunk completo */")
# 9) sezione mondo: texture delle corsie autostradali e delle rampe, atlante dei segnali, materiali, caricamento
rep("const CTX=mkTex(64,64,(x,w,h)=>{",
    "const MTX=mkTex(128,256,(x,w,h)=>{x.fillStyle='#45474c';x.fillRect(0,0,w,h);for(let i=0;i<900;i++){const v=62+Math.random()*14|0;x.fillStyle='rgb('+v+','+(v+2)+','+(v+6)+')';x.fillRect(Math.random()*w,Math.random()*h,2,2)}x.fillStyle='#e4e4dc';x.fillRect(27,0,3,h);x.fillRect(125,0,3,h);x.fillStyle='#dcdcd4';x.fillRect(60,0,3,96);x.fillRect(94,0,3,96);x.fillStyle='#55575c';x.fillRect(0,0,26,h)});\n"
    "const RLX=mkTex(128,256,(x,w,h)=>{x.fillStyle='#44464b';x.fillRect(0,0,w,h);for(let i=0;i<700;i++){const v=62+Math.random()*14|0;x.fillStyle='rgb('+v+','+(v+2)+','+(v+6)+')';x.fillRect(Math.random()*w,Math.random()*h,2,2)}x.fillStyle='#dcdcd4';x.fillRect(5,0,3,h);x.fillRect(120,0,3,h)});\n"
    "const SGT=(()=>{const c=document.createElement('canvas');c.width=2048;c.height=4096;const x=c.getContext('2d');const L=WORLD.SGTXT||[];for(let i=0;i<L.length&&i<128;i++){const col=i%4,row=Math.floor(i/4),X=col*512,Y=row*128,t=L[i];x.fillStyle=t.s==='b'?'#1b4f9e':'#1f7a3d';x.fillRect(X,Y,512,128);x.strokeStyle='#f4f4f0';x.lineWidth=5;x.strokeRect(X+4,Y+4,504,120);x.fillStyle='#f8f8f4';x.font='bold 46px system-ui,Arial,sans-serif';x.textBaseline='middle';let txt=t.t;let fs=46;while(x.measureText(txt).width>(t.arr?400:470)&&fs>24){fs-=2;x.font='bold '+fs+'px system-ui,Arial,sans-serif'}x.fillText(txt,X+22,Y+64);if(t.arr){x.beginPath();x.moveTo(X+440,Y+92);x.lineTo(X+440,Y+36);x.lineTo(X+494,Y+36);x.lineTo(X+494,Y+54);x.lineTo(X+466,Y+54);x.lineTo(X+466,Y+92);x.closePath();x.fill()}}const t=new T.CanvasTexture(c);t.encoding=T.sRGBEncoding;t.anisotropy=8;return t})();\n"
    "WORLD.SGC=i=>{const col=i%4,row=Math.floor(i/4);return[col/4+.002,1-row/32-.001,(col+1)/4-.002,1-(row+1)/32+.001]};\n"
    "const CTX=mkTex(64,64,(x,w,h)=>{")
rep("const MT={ter:sv({map:DTX,roughness:.96}),pl:sv({}),","const MT={ter:sv({map:DTX,roughness:.96}),pl:sv({}),mw:sv({map:MTX,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}),rl:sv({map:RLX,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}),sg:sv({map:SGT,roughness:.6}),")
rep("add(d.T,MT.ter,0);add(d.RM,MT.rm);add(d.RC,MT.rc);add(d.RP,MT.pl);","add(d.T,MT.ter,0);add(d.RM,MT.rm);add(d.RC,MT.rc);add(d.RW,MT.mw);add(d.RL,MT.rl);add(d.RP,MT.pl);add(d.SG,MT.sg,1);")

# 10) sistemi: traffico a senso unico e corsie autostradali, navigazione orientata, polizia (limiti, rampe, niente inversioni in autostrada), quote sotto i cavalcavia, nomi dei luoghi, sedi della Polizia Stradale
rep("for(let i=0;i<RSL.length;i++){const s=RSL[i];if(s.pv||OLDR(s.ax,s.az)||OLDR(s.bx,s.bz))continue;for(const e of [[s.ax,s.az,1],[s.bx,s.bz,-1]]){",
    "for(let i=0;i<RSL.length;i++){const s=RSL[i];if(s.pv||s.pol||OLDR(s.ax,s.az)||OLDR(s.bx,s.bz))continue;for(const e of [[s.ax,s.az,1],[s.bx,s.bz,-1]]){if(s.ow&&e[2]<0)continue;")
rep("const s=RSL[id];if(s.len<14||s.pv||OLDR(s.ax,s.az)||OLDR(s.bx,s.bz))continue;","const s=RSL[id];if(s.len<14||s.pv||s.pol||s.tp||OLDR(s.ax,s.az)||OLDR(s.bx,s.bz))continue;")
rep("function spawnCar(id){const s=RSL[id],L=s.len,d=Math.random()<.5?1:-1,a=L*(.15+Math.random()*.7),ux=(s.bx-s.ax)/L,uz=(s.bz-s.az)/L,tx=ux*d,tz=uz*d,off=laneOff(s),x=s.ax+ux*a-tz*off,z=s.az+uz*a+tx*off,vm=[12,9.5,5.5,11,17][s.k]*(.8+Math.random()*.3);",
    "const KVM=[12,9.5,5.5,11,17,31,10,14,0,11];\nfunction spawnCar(id){const s=RSL[id],L=s.len,d=s.ow?1:(Math.random()<.5?1:-1),a=L*(.15+Math.random()*.7),ux=(s.bx-s.ax)/L,uz=(s.bz-s.az)/L,tx=ux*d,tz=uz*d,ln=s.k===5?(Math.random()<.7?0:1):0,off=laneOff(s,{ln}),x=s.ax+ux*a-tz*off,z=s.az+uz*a+tx*off,vm=(KVM[s.k]||10)*(.8+Math.random()*.3)*(ln?1.12:1);")
rep("CARS.push({s:id,d,x,z,h:Math.atan2(tx,tz),v:vm*.6,vm,col:Math.floor(Math.random()*CARCOL.length),idle:0});ambDirty=true}",
    "CARS.push({s:id,d,x,z,h:Math.atan2(tx,tz),v:vm*.6,vm,ln,col:Math.floor(Math.random()*CARCOL.length),idle:0});ambDirty=true}")
rep("const laneOff=s=>Math.max(1.15,Math.min(3.25,s.w/2-3.4));","const laneOff=(s,c)=>s.k===5?(c&&c.ln?-1.5:2):s.k===6?0:Math.max(1.15,Math.min(3.25,s.w/2-3.4));")
rep("if(!opts.length){c.d=-c.d;return}","if(!opts.length){if(s.ow){c.idle=99;return}c.d=-c.d;return}")
rep("const q=RSL[o[0]],ox=o[1]*(q.bx-q.ax)/q.len,oz=o[1]*(q.bz-q.az)/q.len,w=Math.max(.05,ox*tx+oz*tz+1.1)*Math.random();if(w>bw){bw=w;best=o}}",
    "const q=RSL[o[0]],ox=o[1]*(q.bx-q.ax)/q.len,oz=o[1]*(q.bz-q.az)/q.len,w=Math.max(.05,ox*tx+oz*tz+1.1)*Math.random()*(q.k===6?.3:1)*(ped&&q.k>=5?0:1);if(w>bw){bw=w;best=o}}")
rep("const tx=ux*c.d,tz=uz*c.d,off=c.yld?Math.min(s.w/2-1.1,laneOff(s)+2.2):laneOff(s),at=Math.max(0,Math.min(L,a+c.d*Math.max(6,c.v*.9))),gx=s.ax+ux*at-tz*off,gz=s.az+uz*at+tx*off;",
    "const tx=ux*c.d,tz=uz*c.d;let off=laneOff(s,c);if(s.lanes){const lat=(c.x-s.ax)*(-tz)+(c.z-s.az)*tx;let bl=s.lanes[0];for(const l of s.lanes)if(Math.abs(l-lat)<Math.abs(bl-lat))bl=l;off=bl}if(c.yld)off=Math.min(s.w/2-1.1,off+2.2);const at=Math.max(0,Math.min(L,a+c.d*Math.max(6,c.v*.9))),gx=s.ax+ux*at-tz*off,gz=s.az+uz*at+tx*off;")
rep("let vt=c.vm*(1-Math.min(.65,Math.abs(dh)*.9));if(c.yld)vt=Math.max(2.2,vt*.3);","let vt=c.vm*(1-Math.min(.65,Math.abs(dh)*.9));if(s.tp)vt=Math.min(vt,7);if(s.k===6)vt=Math.min(vt,14);if(c.yld)vt=Math.max(2.2,vt*.3);")
rep("V3.set(c.x,GY(c.x,c.z),c.z);Q1.setFromAxisAngle(AYY,c.h);","c.y=GY(c.x,c.z,c.y);V3.set(c.x,c.y,c.z);Q1.setFromAxisAngle(AYY,c.h);")
rep("NAVG.adj[a].push([id,b,c]);NAVG.adj[b].push([id,a,c])}});","NAVG.adj[a].push([id,b,c]);if(!s.ow)NAVG.adj[b].push([id,a,c])}});")
rep("cf=s.k===2?1.5:s.k===4?.8:1;","cf=s.k===2?1.5:s.k===4?.8:s.k===5?.7:s.k===6?1.1:s.k===8?1.4:s.k===7?.9:1;")
rep("for(const dir of [1,-1]){const q=navAhead(ns,dir);if(!q)continue;const n=NAVG.nodes[q.n],ang=","for(const dir of (s.ow?[1]:[1,-1])){const q=navAhead(ns,dir);if(!q)continue;const n=NAVG.nodes[q.n],ang=")
rep("if(rf&&Math.abs(rf.ang)<1){if(rf.hw<3.5)v=Math.min(v,9);else if(rf.hw<4.5)v=Math.min(v,14)}","if(rf&&Math.abs(rf.ang)<1){if(rf.s&&rf.s.ramp)v=Math.min(v,17);else if(rf.hw<3.5)v=Math.min(v,9);else if(rf.hw<4.5)v=Math.min(v,14)}")
rep("function pdUTurnStart(u,hT,why){\n if(u.utm||PD.t<(u.utmCool||0)||u.rev>0||u.piv>0)return false;\n const rf=pdRoadFrame(u);let side=-1;",
    "function pdUTurnStart(u,hT,why){\n if(u.utm||PD.t<(u.utmCool||0)||u.rev>0||u.piv>0)return false;\n const rf=pdRoadFrame(u);if(rf&&rf.s&&rf.s.ow){u.utmCool=PD.t+6;return false}let side=-1;")
rep("const zi=WORLD.zone(T.x,T.z),urban=[0,1,2,4,8,9].indexOf(zi)>=0,lim=urban?PD.cfg.speedUrban:PD.cfg.speedOpen;",
    "const zi=WORLD.zone(T.x,T.z),urban=[0,1,2,4,8,9,10,11,12,13,16,17,18,19].indexOf(zi)>=0,bsg=pdBestSeg(T.x,T.z,10,T.dirA),onMw=bsg&&bsg.s.mw&&!bsg.s.tp,onRamp=bsg&&bsg.s.ramp,lim=onMw?36.2:onRamp?16.7:urban?PD.cfg.speedUrban:PD.cfg.speedOpen;")
rep("const GY=(x,z)=>WORLD.ground(x,z),CHS=new Map(),CSO=new Map(),RADC=3;","const GY=(x,z,yh,ped)=>WORLD.ground(x,z,yh,ped),CHS=new Map(),CSO=new Map(),RADC=3;")
rep("u.y+=(GY(u.x,u.z)-u.y)*Math.min(1,dt*12);","u.y+=(GY(u.x,u.z,u.y)-u.y)*Math.min(1,dt*12);")
rep("function groundCar(dt){const sn=Math.sin(C.h),cn=Math.cos(C.h),yf=GY(C.x+sn*1.5,C.z+cn*1.5),yb=GY(C.x-sn*1.5,C.z-cn*1.5),yl=GY(C.x+cn*.9,C.z-sn*.9),yr=GY(C.x-cn*.9,C.z+sn*.9),k=Math.min(1,dt*12);",
    "function groundCar(dt){const sn=Math.sin(C.h),cn=Math.cos(C.h),yh=V.y,yf=GY(C.x+sn*1.5,C.z+cn*1.5,yh),yb=GY(C.x-sn*1.5,C.z-cn*1.5,yh),yl=GY(C.x+cn*.9,C.z-sn*.9,yh),yr=GY(C.x-cn*.9,C.z+sn*.9,yh),k=Math.min(1,dt*12);")
rep("const ZN=['Centro storico','Porto','Lungomare','Zona industriale','Quartieri moderni','Colline residenziali','Periferia','Montagna','Rivarolo – case','Rivarolo – centro'];",
    "const ZN=['Centro storico','Porto','Lungomare','Zona industriale','Quartieri moderni','Colline residenziali','Periferia','Montagna','Paese – case','Paese – centro','Milano – centro','Milano – semicentro','Milano – periferia','Milano – grattacieli','Campagna','Autostrada','Como – centro storico','Como – quartieri','Genova – centro storico','Genova – quartieri'];")
rep("mk('Stazione Carabinieri dei Quartieri moderni','CC',150,700);if(sp)mk('Stazione Carabinieri di Rivarolo','CC',sp.x,sp.z)}",
    "mk('Stazione Carabinieri dei Quartieri moderni','CC',150,700);if(sp)mk('Stazione Carabinieri di Rivarolo','CC',sp.x,sp.z);for(const MWx of WORLD.MWS||[]){for(const s of MWx.sa.slice(0,1)){const q=MWx.p(s.s,49);mk('Polizia Stradale – area di servizio '+s.name,'PS',q[0],q[1])}for(const c of MWx.ic)mk('Stazione Carabinieri di '+c.town.name,'CC',c.town.x,c.town.z);if(MWx.bar.length>1){const b=MWx.bar[MWx.bar.length-1],q=MWx.p(b.s-300,40);mk('Polizia Stradale – barriera '+b.name,'PS',q[0],q[1])}}for(const c of WORLD.CITIES||[]){mk('Questura di '+c.name,'PS',c.x-260,c.z+200);mk('Comando Carabinieri di '+c.name,'CC',c.x+900,c.z-700)}{const MI=WORLD.MILAN;if(MI&&MI.ready){mk('Questura di Milano','PS',MI.x-520,MI.z+380);mk('Comando Carabinieri Milano – Porta Nuova','CC',MI.x+200,MI.z+1400);mk('Stazione Carabinieri Milano – Navigli','CC',MI.x-1400,MI.z-1500);mk('Commissariato Milano – Sempione','PS',MI.x+1700,MI.z+1700);mk('Polizia Stradale Milano – Tangenziale','PS',MI.x-3650,MI.z+300)}}}")
rep("for(const s of WORLD.SPEC){const n={plaza:'la piazza di Rivarolo',church:'la chiesa di Rivarolo',hall:'il municipio di Rivarolo',castle:'il castello di Rivarolo',mall:'il centro commerciale',school:'la scuola'}[s.t];_poi.push(A(n,s.x,s.z,s.t==='castle'?90:s.t==='mall'?85:s.t==='school'?60:55))}return _poi}",
    "for(const s of WORLD.SPEC){const tw=s.town||'Rivarolo';const n={plaza:'la piazza di '+tw,church:'la chiesa di '+tw,hall:'il municipio di '+tw,castle:'il castello di '+tw,mall:'il centro commerciale di '+tw,school:'la scuola di '+tw,toll:s.name?s.name.replace(/^Casello /,'il casello di ').replace(/^Barriera /,'la barriera di '):'il casello',sa:'l\\'area di servizio '+(s.name||'')}[s.t];if(n)_poi.push(A(n,s.x,s.z,s.t==='castle'?90:s.t==='mall'?85:s.t==='school'?60:s.t==='sa'?220:s.t==='toll'?90:55))}if(WORLD.MW)for(const t of WORLD.TOWNS)if(t.name!=='Rivarolo')_poi.push(A('il centro di '+t.name,t.x,t.z,260));return _poi}")
rep("function pdPlace(x,z){const zi=WORLD.zone(x,z),zn=ZN[zi]||'periferia';","function pdPlace(x,z){const zi=WORLD.zone(x,z);let zn=ZN[zi]||'periferia';if((zi===8||zi===9)&&WORLD.townAt){const tw=WORLD.townAt(x,z);if(tw)zn=tw.name+(zi===9?' – centro':' – case')}")
rep("const on=WORLD.bridgeAt(x,z)!==null?'sul ponte, ':'';if(!best)return on+'in zona '+zn;",
    "const on=WORLD.bridgeAt(x,z)!==null?'sul ponte, ':'';if(zi===15){const q=WORLD.mwAt(x,z);if(q){const km=q.mw.km(q.s),bs=pdBestSeg(x,z,12);const dir=bs&&bs.s.side<0?'direzione '+q.mw.dest0:'direzione '+q.mw.dest1;return 'in '+q.mw.name+' al chilometro '+Math.round(km)+', '+dir}}if(!best)return on+'in zona '+zn;")

# 11) mappa a finestra (minimappa e mappa grande con zoom e trascinamento)
i=h.find("/* Mappa della città, disegnata una volta sola"); j=h.find("arrow(c,MX(px),MZ(pz),-(inCar?C.h:yaw),16)}",i)+len("arrow(c,MX(px),MZ(pz),-(inCar?C.h:yaw),16)}")
assert i>0 and j>i
h=h[:i]+open(D+'w2/map_v2.js',encoding='utf-8').read()+h[j:]
rep('<div id="map" hidden><div id="mt">Mappa · 6 × 6 km</div><canvas id="mc" width="900" height="900"></canvas>',
    '<div id="map" hidden><div id="mt">Mappa</div><canvas id="mc" width="900" height="900"></canvas><div id="mz"><button class="b" id="mzo">−</button><button class="b" id="mzc">◎</button><button class="b" id="mzi">+</button></div>')
rep('#mt{color:#fff;font:700 14px system-ui,sans-serif;opacity:.9}','#mt{color:#fff;font:700 13px system-ui,sans-serif;opacity:.9;text-align:center}#mz{position:absolute;right:calc(14px + var(--sr));top:calc(14px + var(--st));display:flex;gap:8px}#mz .b{min-width:48px;height:48px;font-size:20px}')
rep("const openMap=o=>{mapOpen=o;$('#map').hidden=!o;if(o)drawMap()};",
    "const openMap=o=>{mapOpen=o;$('#map').hidden=!o;if(o){MAPV.ox=MAPV.oz=0;drawMap()}};\n"
    "$('#mzo').addEventListener('pointerdown',e=>{e.stopPropagation();MAPV.zoom=Math.min(MAPV.levels.length-1,MAPV.zoom+1);drawMap()});$('#mzi').addEventListener('pointerdown',e=>{e.stopPropagation();MAPV.zoom=Math.max(0,MAPV.zoom-1);drawMap()});$('#mzc').addEventListener('pointerdown',e=>{e.stopPropagation();MAPV.ox=MAPV.oz=0;drawMap()});\n"
    "{const mc=$('#mc');let pid=null,lx=0,ly=0;mc.addEventListener('pointerdown',e=>{if(pid!==null)return;pid=e.pointerId;lx=e.clientX;ly=e.clientY;try{mc.setPointerCapture(pid)}catch(_){}e.stopPropagation()});mc.addEventListener('pointermove',e=>{if(e.pointerId!==pid)return;const r=mc.getBoundingClientRect(),k=MAPV.levels[MAPV.zoom]/r.width;MAPV.ox+=(e.clientX-lx)*k;MAPV.oz+=(e.clientY-ly)*k;lx=e.clientX;ly=e.clientY;drawMap()});const end=e=>{if(e.pointerId!==pid)return;pid=null};mc.addEventListener('pointerup',end);mc.addEventListener('pointercancel',end)}")

# 12) pedaggio ai caselli e alle barriere (addebito al passaggio, con ricevuta nel registro acquisti)
rep("function step(dt){const ts=performance.now()/1000;",
    "const TOLL={last:-99,inside:false,list:null};\n"
    "function tollStep(){if(!inCar)return;if(!TOLL.list)TOLL.list=WORLD.SPEC.filter(q=>q.t==='toll');let inA=false;for(const q of TOLL.list){const dx=C.x-q.x,dz=C.z-q.z;if(Math.abs(dx)>60||Math.abs(dz)>60)continue;const c=Math.cos(q.a),s=Math.sin(q.a),lx=dx*c+dz*s,lz=-dx*s+dz*c;if(Math.abs(lx)<q.w/2&&Math.abs(lz)<q.d/2){inA=true;if(!TOLL.inside&&PD.t-TOLL.last>20){TOLL.last=PD.t;const cost=q.main?220:380;S.cents=Math.max(0,S.cents-cost);S.log.push({t:Date.now(),w:'Pedaggio '+(q.name||'casello'),c:-cost});if(S.log.length>30)S.log.shift();save();hud();toast('Pedaggio '+(q.name||'')+': −'+eur(cost))}}}TOLL.inside=inA}\n"
    "function step(dt){const ts=performance.now()/1000;tollStep();")

# 13) autostrada: velocità massime realistiche (Alfa 159 ≈ 190 km/h, pattuglie ≈ 195), corsia di sorpasso per la polizia, traffico che accosta senza fermarsi
rep("if(iy>.05)vf+=(vf>=-.3?9.5*(1-Math.pow(Math.max(0,vf)/48,1.6)):14)*iy*dt;","if(iy>.05)vf+=(vf>=-.3?9.5*(1-Math.pow(Math.max(0,vf)/66,1.6)):14)*iy*dt;")
rep("if(iy>.05)vf+=(vf>=-.3?9.5*k*(1-Math.pow(Math.max(0,vf)/48,1.6)):14)*iy*dt;","if(iy>.05)vf+=(vf>=-.3?9.5*k*(1-Math.pow(Math.max(0,vf)/68,1.6)):14)*iy*dt;")
rep("vf-=Math.sign(vf)*Math.min(Math.abs(vf),(.5+.0024*vf*vf+(Math.abs(iy)<.05?1.2:0))*dt);","vf-=Math.sign(vf)*Math.min(Math.abs(vf),(.35+.001*vf*vf+(Math.abs(iy)<.05?1.2:0))*dt);",2)
rep("vf=cl(vf,-12,50);","vf=cl(vf,-12,56);")
rep("vf=pdClamp(vf,-12,50);","vf=pdClamp(vf,-12,56);")
rep(" let ln=lane||0;if(PD.t<(u.ovtT||0))ln-=2.6;"," let ln=lane||0;{const rf0=pdRoadFrame(u);if(rf0&&rf0.s&&rf0.s.mw&&!rf0.s.tp)ln=-4.8;else if(PD.t<(u.ovtT||0))ln-=2.6}")
rep("if(PD.t<(u.ovtT||0)){if(pdClearAhead(u,.2,30)<12)u.ovtT=0;else{tx+=Math.cos(u.h)*2.6;tz-=Math.sin(u.h)*2.6}}",
    "if(PD.t<(u.ovtT||0)){if(pdClearAhead(u,.2,30)<12)u.ovtT=0;else{tx+=Math.cos(u.h)*2.6;tz-=Math.sin(u.h)*2.6}}{const rfm=pdRoadFrame(u);if(rfm&&rfm.s&&rfm.s.mw&&!rfm.s.tp&&dT>28){tx=rfm.px+rfm.dx*45+rfm.dz*4.8;tz=rfm.pz+rfm.dz*45-rfm.dx*4.8}}")
rep("if(onc>0&&okR&&rf&&rf.lat<rf.hw-3.4)okL=false;else if(onc<0&&okL&&rf&&rf.lat>-(rf.hw-3.4)&&(f>8||onc===-2))okR=false}",
    "if(onc>0&&okR&&rf&&rf.lat<rf.hw-3.4)okL=false;else if(onc<0&&okL&&rf&&rf.lat>-(rf.hw-3.4)&&(f>8||onc===-2))okR=false;if(rf&&rf.s&&rf.s.mw&&okL)okR=false}")
rep("if(c.yld)vt=Math.max(2.2,vt*.3);","if(c.yld)vt=Math.max(2.2,vt*(s.mw?.6:.3));")
rep("function pdCarAhead(u,range,lat){const sn=Math.sin(u.h),cn=Math.cos(u.h);let best=range;","function pdCarAhead(u,range,lat){const sn=Math.sin(u.h),cn=Math.cos(u.h),_rfm=pdRoadFrame(u),onMw=!!(_rfm&&_rfm.s&&_rfm.s.mw);if(!lat)lat=onMw?1.9:2.4;let best=range;")
rep("vmax=Math.min(48,Math.max(T.sp+10,22));","vmax=Math.min(54,Math.max(T.sp+10,22));")

# 14) corsi d'acqua multipli (fiume e Navigli) nei blocchi e nella mappa
rep("const wc=[.18,.42,.5];for(const i of W.RCH.get(key)||[]){const a=W.RV[i],b=W.RV[i+1],dx=b.x-a.x,dz=b.z-a.z,l=Math.hypot(dx,dz),nx=-dz/l,nz=dx/l;",
    "const wc=[.18,.42,.5];for(const q of W.RCH.get(key)||[]){const P=W.RIV[q[0]].pts,a=P[q[1]],b=P[q[1]+1],dx=b.x-a.x,dz=b.z-a.z,l=Math.hypot(dx,dz),nx=-dz/l,nz=dx/l;")
rep(" c.strokeStyle='#4aa3bd';for(let i=0;i<WORLD.RV.length-1;i++){const a=WORLD.RV[i],b=WORLD.RV[i+1];if(a.x<x0||a.x>x1||a.z<z0||a.z>z1)continue;c.lineWidth=Math.max(1.5,a.hw*2*k);c.beginPath();c.moveTo(X(a.x),Z(a.z));c.lineTo(X(b.x),Z(b.z));c.stroke()}}",
    " c.strokeStyle='#4aa3bd';for(const rv of WORLD.RIV){const P=rv.pts;for(let i=0;i<P.length-1;i++){const a=P[i],b=P[i+1];if(a.x<x0||a.x>x1||a.z<z0||a.z>z1)continue;c.lineWidth=Math.max(1.5,a.hw*2*k);c.beginPath();c.moveTo(X(a.x),Z(a.z));c.lineTo(X(b.x),Z(b.z));c.stroke()}}}")

# 15) Milano: resa dei monumenti, marciapiedi e lampioni nelle zone cittadine, luoghi e sedi di polizia, mappa
rep("function spec(sp,F,RF,TR,SO){if(sp.t==='toll')return specToll(sp,RF,SO);if(sp.t==='sa')return specSA(sp,F,RF,TR,SO);",
    "function spec(sp,F,RF,TR,SO){if(sp.t==='toll')return specToll(sp,RF,SO);if(sp.t==='sa')return specSA(sp,F,RF,TR,SO);if(/^(mduomo|mpiazza|galleria|scala|velasca|mcastello|parco|arco|stazione|mstadio|spire)$/.test(sp.t))return specMilan(sp,F,RF,TR,SO);")
rep("/* chunk completo */",open(D+'w2/chk_milan.js',encoding='utf-8').read()+"\n/* chunk completo */")
rep("sw=!s.pv&&s.k<=1&&(zn===0||zn===1||zn===2||zn===4||zn===8||zn===9);let p0=null;","sw=!s.pv&&(s.k<=1||s.k===7||s.k===9)&&(zn===0||zn===1||zn===2||zn===4||zn===8||zn===9||zn>=10&&zn<=13||zn>=16&&zn<=19);let p0=null;")
rep("sw=!s.pv&&s.k<=1&&(zn===0||zn===1||zn===2||zn===4||zn===8||zn===9),ang=Math.atan2(uz,ux),mx=(s.ax+s.bx)/2,mz=(s.az+s.bz)/2;","sw=!s.pv&&(s.k<=1||s.k===7||s.k===9)&&(zn===0||zn===1||zn===2||zn===4||zn===8||zn===9||zn>=10&&zn<=13||zn>=16&&zn<=19),ang=Math.atan2(uz,ux),mx=(s.ax+s.bx)/2,mz=(s.az+s.bz)/2;")
rep("const RSL=WORLD.RS,ADJ=new Map(),OLDR=(x,z)=>Math.abs(x)<34&&Math.abs(z)<74,AMBC=14,AMBP=34,CARS=[],PEDS=[],CSOL=[],SWZ=[0,1,2,4,8,9];","const RSL=WORLD.RS,ADJ=new Map(),OLDR=(x,z)=>Math.abs(x)<34&&Math.abs(z)<74,AMBC=14,AMBP=34,CARS=[],PEDS=[],CSOL=[],SWZ=[0,1,2,4,8,9,10,11,12,13,16,17,18,19];")
rep("const hasSW=s=>s.k<=1&&!s.br&&SWZ.indexOf(WORLD.zone((s.ax+s.bx)/2,(s.az+s.bz)/2))>=0;","const hasSW=s=>(s.k<=1||s.k===7||s.k===9)&&!s.br&&SWZ.indexOf(WORLD.zone((s.ax+s.bx)/2,(s.az+s.bz)/2))>=0;")
rep("if(WORLD.MW)for(const t of WORLD.TOWNS)if(t.name!=='Rivarolo')_poi.push(A('il centro di '+t.name,t.x,t.z,260));return _poi}",
    "if(WORLD.MW)for(const t of WORLD.TOWNS)if(t.name!=='Rivarolo')_poi.push(A('il centro di '+t.name,t.x,t.z,260));for(const c of WORLD.CITIES||[]){_poi.push(A('il centro di '+c.name,c.x,c.z,420));if(c.spec)for(const sp of c.spec)if(sp.t==='porto'||sp.t==='mstadio')_poi.push(A(sp.name.replace(/^Porto/,'il porto').replace(/^Stadio/,'lo stadio'),sp.x,sp.z,Math.max(sp.w,sp.d)/2+40))}if(WORLD.MILAN&&WORLD.MILAN.spec)for(const sp of WORLD.MILAN.spec){const nm={mduomo:'il Duomo di Milano',mpiazza:'piazza del Duomo',galleria:'la Galleria',scala:'la Scala',velasca:'la Torre Velasca',mcastello:'il Castello Sforzesco',parco:'il Parco Sempione',arco:'l\\'Arco della Pace',stazione:'la Stazione Centrale',mstadio:'lo stadio di Milano',spire:'i grattacieli di Porta Nuova'}[sp.t];if(nm)_poi.push(A(nm,sp.x,sp.z,Math.max(sp.w,sp.d)/2+60))}return _poi}")
# (sedi di polizia di Milano: già nel passo 10)
# (luoghi di Milano sulla mappa: già in map_v2.js)

# 23) POLIZIA v6: carreggiata giusta, uscite seguite, unione a vista, rinforzi da dietro e dagli ingressi, caselli e barriere chiusi, testimoni, elicottero
rep("pdExecManeuver,pdContact};","pdExecManeuver,pdContact};Object.assign(PD.fn,{pdChase0,pdSightJoin,pdStrategy,pdHeliRequest,pdHeliStep,pdCovered,pdRoadV,pdTargetCtx,pdSegAt});")
rep("function pdRadioInit(){","function pdRadioInit(){pdRadioInit6();")
rep("EV.on('roadblock',d=>{pdSay(","EV.on('roadblock',d=>{if(d.silent)return;pdSay(")
# arrivo sulla carreggiata giusta: obiettivo con la direzione di marcia
rep("const goals=new Map(),gs=pdBestSeg(gx,gz,15);if(gs&&NAVG.segNodes[gs.id]){const A=navAhead(gs,1),B=navAhead(gs,-1);if(A)goals.set(A.n,A.d);if(B)goals.set(B.n,B.d)}",
    "const goals=new Map(),hasGh=gh!==undefined&&gh!==null,gs=pdBestSeg(gx,gz,15,hasGh?gh:undefined);if(gs&&NAVG.segNodes[gs.id]){let A=navAhead(gs,1),B=navAhead(gs,-1);if(hasGh){const s=gs.s,fw=((s.bx-s.ax)*Math.sin(gh)+(s.bz-s.az)*Math.cos(gh))>=0;if(fw&&B)A=null;else if(!fw&&A)B=null}if(A)goals.set(A.n,A.d);if(B)goals.set(B.n,B.d)}")
rep("function pdSetRoute(u,gx,gz,why){const r=pdRoute(u.x,u.z,gx,gz,u.h);","function pdSetRoute(u,gx,gz,why,gh){const r=pdRoute(u.x,u.z,gx,gz,u.h,false,gh);")
rep("const p=pr.pts[pr.pts.length-1];return{x:p[0],z:p[1]}}","const p=pr.pts[pr.pts.length-1],q=pr.pts[Math.max(0,pr.pts.length-2)];return{x:p[0],z:p[1],h:Math.hypot(p[0]-q[0],p[1]-q[1])>.5?Math.atan2(p[0]-q[0],p[1]-q[1]):e.dirA}}")
rep("pdSetRoute(u,dest.x,dest.z,pdPlace(dest.x,dest.z));","pdSetRoute(u,dest.x,dest.z,pdPlace(dest.x,dest.z),kind==='block'?undefined:dest.h);")
rep("if(nd&&Math.hypot(nd.x-a.dest.x,nd.z-a.dest.z)>120){a.dest=nd;a.lastRoute=PD.t;pdSetRoute(u,nd.x,nd.z)}","if(nd&&Math.hypot(nd.x-a.dest.x,nd.z-a.dest.z)>120&&!a.ahead){a.dest=nd;a.lastRoute=PD.t;pdSetRoute(u,nd.x,nd.z,undefined,nd.h)}")
rep("const nr=pdSetRoute(u,a.dest.x,a.dest.z);","const nr=pdSetRoute(u,a.dest.x,a.dest.z,undefined,a.kind==='block'?undefined:a.dest.h);")
# contesto del bersaglio; inseguimento con la v6 davanti
rep("T.w=car?V.yw:0;return T}","T.w=car?V.yw:0;pdTargetCtx(T);return T}")
rep("function pdChase(u,T,gap,vmax,dt){","function pdChase0(u,T,gap,vmax,dt){")
rep("if(rfm&&rfm.s&&rfm.s.mw&&!rfm.s.tp&&dT>28){","if(rfm&&rfm.s&&rfm.s.mw&&!rfm.s.tp&&dT>28&&!onTrail&&T.seg&&T.seg.s.mw===rfm.s.mw&&T.seg.s.side===rfm.s.side){")
rep("const nr=pdRoute(u.x,u.z,T.x,T.z,u.h);nr.goal={x:T.x,z:T.z};","const nr=pdRoute(u.x,u.z,T.x,T.z,u.h,false,T.dirA!==undefined?T.dirA:Math.atan2(T.dx,T.dz));nr.goal={x:T.x,z:T.z};")
rep("function dspAreaSpots(dest,n){","function dspAreaSpots0(dest,n){")
rep("function dspQueueSpawn(q){","function dspQueueSpawn0(q){")
rep("for(const sp of dspAreaSpots(dest,Math.min(areaLeft,3))){const r=pdRoute(sp.x,sp.z,dest.x,dest.z);","for(const sp of dspAreaSpots(dest,Math.min(areaLeft,3))){const dd=sp.aheadDest||dest,r=pdRoute(sp.x,sp.z,dd.x,dd.z);")
# percezione: chi vede il veicolo si unisce; vista più lunga in campagna e in autostrada
rep("if(s){u.seenT=PD.t;if(u.case&&PD.case&&PD.case.id===u.case)pdObserve(u,T)}","if(s){u.seenT=PD.t;if(u.case&&PD.case&&PD.case.id===u.case)pdObserve(u,T);else pdSightJoin(u,T)}")
rep("if(d>PD.cfg.vis)return false;","if(d>(PD.T&&PD.T.open?PD.cfg.visOpen:PD.cfg.vis))return false;")
# più unità, contatto conservato più a lungo, ricerca più lunga
rep("maxUnits:12,ambient:3,maxChasers:5,areaMax:3,areaBlock:4,vis:230,visBack:100,loseTime:5,searchTime:90,nearR:300","maxUnits:16,ambient:3,maxChasers:8,areaMax:5,areaBlock:5,vis:260,visBack:140,visOpen:380,loseTime:8,searchTime:150,nearR:340")
# prestazioni: con frame lenti le unità scendono a gradini (16 → 10 → 6), poi risalgono quando il telefono regge
rep("if(avg>.045&&PD.cfg.maxUnits>4){PD.cfg.maxUnits=4;PD.cfg.ambient=1;plog('prestazioni','frame lento ('+(avg*1000).toFixed(0)+' ms): riduco le unità a 4',{})}else if(avg<.024&&PD.cfg.maxUnits<12&&PD.fgLow){tm.gf+=3;if(tm.gf>=12){PD.cfg.maxUnits=12;PD.cfg.ambient=3;tm.gf=0}}",
    "if(avg>.045&&PD.cfg.maxUnits>6){const n=PD.cfg.maxUnits>10?10:6;PD.cfg.maxUnits=n;PD.cfg.ambient=n>6?2:1;plog('prestazioni','frame lento ('+(avg*1000).toFixed(0)+' ms): riduco le unità a '+n,{})}else if(avg<.024&&PD.cfg.maxUnits<16&&PD.fgLow){tm.gf+=3;if(tm.gf>=12){PD.cfg.maxUnits=PD.cfg.maxUnits<10?10:16;PD.cfg.ambient=PD.cfg.maxUnits>10?3:2;tm.gf=0}}")
rep("if((PD.modelsN||0)>=14)continue;","if((PD.modelsN||0)>=18)continue;")
rep("const need=Math.min(cfg.maxChasers,1+Math.round(c.heat));","const need=Math.min(cfg.maxChasers,1+Math.round(c.heat*1.4));")
rep("const need2=Math.min(cfg.maxChasers,1+Math.round(c.heat));","const need2=Math.min(cfg.maxChasers,1+Math.round(c.heat*1.2));")
rep("c.heat=Math.min(5,c.heat+dt/45);","c.heat=Math.min(5,c.heat+dt/45);pdStrategy(c,dt);")
rep("const el=PD.t-c.searchT0;","pdStrategy(c,dt);const el=PD.t-c.searchT0;")
rep("VOICE.update(dt);pdRender(dt);","VOICE.update(dt);pdHeliStep(dt);pdRender(dt);")
rep("DSP.requestRoadblock=function(c){const T=pdCaseEst();","DSP.requestRoadblock=function(c){if(PD.T&&PD.T.seg&&PD.T.seg.s.mw&&!PD.T.seg.s.tp){c.rbT=PD.t;return}const T=pdCaseEst();")
# velocità: unità lontane e in emergenza secondo la strada; curve più decise con i lampeggianti
rep("const pts=u.route.pts,v=emer?40:u.vcruise*1.2;","const pts=u.route.pts,v=emer?Math.max(30,pdRoadV(u)*1.05):u.vcruise*1.2;")
rep("else if(u.route&&u.route.ok)pdFollow(u,u.lights?Math.max(u.vcruise,30):u.vcruise,0);","else if(u.route&&u.route.ok)pdFollow(u,u.lights?Math.max(u.vcruise,pdRoadV(u)):u.vcruise,0);")
rep("const rem=pdFollow(u,36,0,moving);","const rem=pdFollow(u,Math.max(36,pdRoadV(u)),0,moving);")
rep("const vc=cornerA>2.4?3.5:cornerA>1.9?5:cornerA>1.2?10:cornerA>.75?14:18;","const vc=(cornerA>2.4?3.5:cornerA>1.9?5:cornerA>1.2?10:cornerA>.75?14:18)*(u.lights?1.2:1);")
# scia del bersaglio più lunga alle alte velocità (le unità seguono le uscite)
rep("if(!l||Math.hypot(T.x-l.x,T.z-l.z)>=1.5){","if(!l||Math.hypot(T.x-l.x,T.z-l.z)>=Math.max(1.5,T.sp*.1)){")
h=h.replace("while(tr.length&&PD.t-tr[0].t>14)tr.shift()","while(tr.length&&PD.t-tr[0].t>20)tr.shift()")
rep("if(tr.length>80)tr.splice(0,tr.length-80)","if(tr.length>220)tr.splice(0,tr.length-220)")
rep("h.textContent='🚔 '+ph+' · '+'★'.repeat(Math.max(1,Math.round(c.heat)))+' · '+n+' unità';","h.textContent='🚔 '+ph+' · '+'★'.repeat(Math.max(1,Math.round(c.heat)))+' · '+n+' unità'+(PD.heli&&PD.heli.state!=='leave'&&PD.heli.state!=='takeoff'?' · 🚁':'');")
rep("PD.fn={pdUTurn,",open(D+'w2/police_v6.js',encoding='utf-8').read()+"\nfunction pdRadioInit6(){EV.on('sightJoin',d=>{const u=PD.units.find(x=>x.id===d.id);if(u)pdSay('joinSight',u,{place:d.place,card:d.card},3,{force:true})})}\nPD.fn={pdUTurn,")
# 24) percorso: l'ultimo tratto verso il bersaglio (che si muove ed è in corsia) non è una curva da affrontare piano
rep("for(let k=i;k<pts.length-1&&dd<75;k++){const dx=pts[k+1][0]-pts[k][0],dz=pts[k+1][1]-pts[k][1],l=Math.hypot(dx,dz);if(l<1e-6)continue;","for(let k=i;k<pts.length-1&&dd<75;k++){const dx=pts[k+1][0]-pts[k][0],dz=pts[k+1][1]-pts[k][1],l=Math.hypot(dx,dz);if(l<1e-6||(k===pts.length-2&&l<30&&noEnd))continue;")
# 25) guida veloce in autostrada: sguardo più lungo alle alte velocità, si adegua alla velocità di chi precede, cambia corsia invece di frenare
rep("const chk=(ox,oz,lw)=>{const rx=ox-u.x,rz=oz-u.z,al=rx*sn+rz*cn,la=Math.abs(rx*cn-rz*sn);if(al>1&&al<best&&la<lw)best=al};","u.caV=0;const chk=(ox,oz,lw,vv)=>{const rx=ox-u.x,rz=oz-u.z,al=rx*sn+rz*cn,la=Math.abs(rx*cn-rz*sn);if(al>1&&al<best&&la<lw){best=al;u.caV=vv||0}};")
rep(" for(const c of CARS){if((Math.sin(c.h)*sn+Math.cos(c.h)*cn)<-.2&&c.v>.5)continue;chk(c.x,c.z,lat||2.4)}"," for(const c of CARS){if((Math.sin(c.h)*sn+Math.cos(c.h)*cn)<-.2&&c.v>.5)continue;chk(c.x,c.z,lat||2.4,c.v*(Math.sin(c.h)*sn+Math.cos(c.h)*cn))}")
rep("if(al2>1&&al2<12&&la2<2.6&&u.id<o.id)continue}chk(o.x,o.z,lat||2.1)}","if(al2>1&&al2<12&&la2<2.6&&u.id<o.id)continue}chk(o.x,o.z,lat||2.1,o.fwd*(Math.sin(o.h)*sn+Math.cos(o.h)*cn))}")
rep(" if(inCar&&!u.chaseTarget)chk(C.x,C.z,lat||2.5);return best}"," if(inCar&&!u.chaseTarget)chk(C.x,C.z,lat||2.5,V.vx*sn+V.vz*cn);return best}")
rep("const latU=(u.x-T.x)*T.rx+(u.z-T.z)*T.rz,Lk=pdClamp(u.sp*.7,6,20);","const latU=(u.x-T.x)*T.rx+(u.z-T.z)*T.rz,Lk=u.sp>20?pdClamp(u.sp*1.1,20,42):pdClamp(u.sp*.7,6,20);")
rep("v=Math.min(v,vmax)*(1-Math.min(.5,ae*.8));if(ae>.35)v=Math.min(v,ae>1?6:ae>.6?11:17);if(ca<26&&ca<dT-6&&PD.t>=(u.ovtT||0))v=Math.min(v,Math.max(0,(ca-7)*.9));","{const hs=u.sp>18;v=Math.min(v,vmax)*(1-Math.min(.5,ae*(hs?.45:.8)));if(ae>(hs?.55:.35))v=Math.min(v,ae>1?6:ae>.75?11:hs?24:17)}if(ca<26&&ca<dT-6&&PD.t>=(u.ovtT||0))v=Math.min(v,pdFollowV(u,ca));")
rep("if(PD.t>=(u.ovtT||0))v=Math.min(v,Math.max(0,(ca-7)*.9))}","if(PD.t>=(u.ovtT||0))v=Math.min(v,pdFollowV(u,ca))}")
rep("let ln=lane||0;{const rf0=pdRoadFrame(u);if(rf0&&rf0.s&&rf0.s.mw&&!rf0.s.tp)ln=-4.8;else if(PD.t<(u.ovtT||0))ln-=2.6}","let ln=lane||0;{const rf0=pdRoadFrame(u);if(rf0&&rf0.s&&rf0.s.mw&&!rf0.s.tp)ln=u.lights?pdMwLane(u,rf0):-4.8;else if(PD.t<(u.ovtT||0))ln-=2.6}")
rep("tx=rfm.px+rfm.dx*45+rfm.dz*4.8;tz=rfm.pz+rfm.dz*45-rfm.dx*4.8","const lnm=pdMwLane(u,rfm);tx=rfm.px+rfm.dx*45-rfm.dz*lnm;tz=rfm.pz+rfm.dz*45+rfm.dx*lnm")
# 26) partenza del percorso anche da una rampa vicina e allineata (la pattuglia può ancora imboccare l'uscita)
rep("if(d>s.w/2+2.5)continue;const ns={id,s,t,d,a:t*s.len};","if(d>s.w/2+(s.ramp?7:2.5))continue;const ns={id,s,t,d,a:t*s.len};")
# 27) radio: elenchi di unità riassunti, posizione in autostrada senza doppia "direzione"; posti della Stradale ai caselli e alle barriere
rep("EV.on('roadblock',d=>{if(d.silent)return;pdSay('roadblock','C',{place:d.place,list:d.names.join(' e '),","EV.on('roadblock',d=>{if(d.silent)return;pdSay('roadblock','C',{place:d.place,list:pdNames(d.names),")
rep("EV.on('backupPlan',d=>{const l=lead();pdLater(1.1,()=>{pdSay('centralAck','C',{u:l?l.name:'unità',list:d.names.join(' e ')","EV.on('backupPlan',d=>{const l=lead();pdLater(1.1,()=>{pdSay('centralAck','C',{u:l?l.name:'unità',list:pdNames(d.names)")
rep("return 'in '+q.mw.name+' al chilometro '+Math.round(km)+', '+dir}","return 'in '+q.mw.name+' al chilometro '+Math.round(km)+', carreggiata '+dir.replace('direzione ','verso ')}")
rep("{const MI=WORLD.MILAN;if(MI&&MI.ready){mk('Questura di Milano'","for(const MWx of WORLD.MWS||[]){for(const c of MWx.ic){const q=[c.cx+c.nv[0]*370*(c.tside||1)+c.tv[0]*45,c.cz+c.nv[1]*370*(c.tside||1)+c.tv[1]*45];mk('Polizia Stradale – casello di '+c.name,'PS',q[0],q[1]);mk('Carabinieri – casello di '+c.name,'CC',q[0]-c.tv[0]*90,q[1]-c.tv[1]*90)}for(const b of MWx.bar){const q=MWx.p(b.s+60,-30);mk('Polizia Stradale – barriera di '+b.name,'PS',q[0],q[1])}}{const MI=WORLD.MILAN;if(MI&&MI.ready){mk('Questura di Milano'")
# 28) DANNI DELLE AUTO: deformazione della carrozzeria, parti staccate, vetri, fumo, effetti sulla guida, riparazione
rep("/* Pattuglia dei Carabinieri: ogni tanto arriva",open(D+'w2/damage.js',encoding='utf-8').read()+"\n/* Pattuglia dei Carabinieri: ogni tanto arriva")
rep("const l=Math.hypot(ux,uz),mx=ux/l,mz=uz/l,vn=V.vx*mx+V.vz*mz;nx+=ux;nz+=uz;if(vn<0){V.vx=(V.vx-1.25*vn*mx)*.97;V.vz=(V.vz-1.25*vn*mz)*.97}}}",
    "const l=Math.hypot(ux,uz),mx=ux/l,mz=uz/l,vn=V.vx*mx+V.vz*mz;nx+=ux;nz+=uz;if(vn<0){if(vn<-3.2)carHit(carA,{x:C.x,z:C.z,h:C.h,y:V.y,vx:V.vx,vz:V.vz,player:true},fx-mx,fz-mz,mx,mz,-vn);const e=vn<-8?1.05:vn<-4?1.15:1.25,ox=V.vx,oz=V.vz;V.vx=(V.vx-e*vn*mx)*.97;V.vz=(V.vz-e*vn*mz)*.97;if(vn<-2){const rx=fx-mx-C.x,rz=fz-mz-C.z;V.ywW=cl(V.ywW+(rz*(V.vx-ox)-rx*(V.vz-oz))*.16,-2.4,2.4)}}}}")
# rotazione dovuta all'urto contro un muro: componente separata che le gomme smorzano in fretta (uno strisciamento devia l'auto di pochi gradi, un urto di sbieco la fa girare); la rotazione da urto fra auto (PIT) resta quella lenta
rep("V={vx:0,vz:0,st:0,rl:0,pt:0,af:0,al:0,y:0,tp:0,tr:0,yw:0}","V={vx:0,vz:0,st:0,rl:0,pt:0,af:0,al:0,y:0,tp:0,tr:0,yw:0,ywW:0}")
rep("C.h-=w*dt;C.h+=V.yw*dt;V.yw*=Math.exp(-1.1*dt);","C.h-=w*dt;C.h+=(V.yw+V.ywW)*dt;V.yw*=Math.exp(-1.1*dt);V.ywW*=Math.exp(-4*dt);")
rep("if(iy>.05)vf+=(vf>=-.3?9.5*(1-Math.pow(Math.max(0,vf)/66,1.6)):14)*iy*dt;","if(iy>.05)vf+=(vf>=-.3?9.5*CARDMG.ef*(1-Math.pow(Math.max(0,vf)/66,1.6)):14*Math.max(.3,CARDMG.ef))*iy*dt;")
rep("const sp=Math.abs(vf),lock=.6/(1+sp*sp/220);V.st+=(ix*lock-V.st)*Math.min(1,dt*9);","const sp=Math.abs(vf),lock=.6/(1+sp*sp/220);V.st+=(ix*lock*CARDMG.lk+CARDMG.pull*Math.min(1,sp/6)-V.st)*Math.min(1,dt*9);")
rep("vf=cl(vf,-12,56);","vf-=Math.sign(vf)*Math.min(Math.abs(vf),CARDMG.drag*dt);vf=cl(vf,-12,CARDMG.vmax);")
rep("carG.rotation.set(V.pt+V.tp,C.h,V.rl+V.tr);","carG.rotation.set(V.pt+V.tp+CARDMG.tp,C.h,V.rl+V.tr+CARDMG.tr);")
rep("let hit=0,imp=0;","let hit=0,imp=0,cpx=0,cpz=0,cnx=0,cnz=0;")
rep("if(d<1.9&&d>1e-4){const i2=pdContact(A,B,(ax+bx)/2,(az+bz)/2,dx/d,dz/d,1.9-d);if(i2>imp)imp=i2;hit++}","if(d<1.9&&d>1e-4){const i2=pdContact(A,B,(ax+bx)/2,(az+bz)/2,dx/d,dz/d,1.9-d);if(i2>imp){imp=i2;cpx=(ax+bx)/2;cpz=(az+bz)/2;cnx=dx/d;cnz=dz/d}hit++}")
rep("if(hit){out.push([A,B,imp])}","if(hit){out.push([A,B,imp,cpx,cpz,cnx,cnz])}")
rep("for(const o of out){const A=o[0],B=o[1],imp=o[2];if(imp<2)continue;","for(const o of out){const A=o[0],B=o[1],imp=o[2];if(imp<2)continue;dmgPair(A,o[3],o[4],o[5],o[6],imp);dmgPair(B,o[3],o[4],-o[5],-o[6],imp);")
rep("if(vn<0){if(-vn>5)pdDamage(u,-vn,'ostacolo');","if(vn<0){if(-vn>5)pdDamage(u,-vn,'ostacolo');if(-vn>3.2&&u.mdl)carHit(u.mdl,{x:u.x,z:u.z,h:u.h,y:u.y,vx:u.vx,vz:u.vz,u},fx-mx,fz-mz,mx,mz,-vn);")
rep("const hi=u===nearest&&d<28;","const hi=u===nearest&&d<28&&!(a.dmg&&a.dmg.on);if(a.dmg&&a.dmg.on&&d<160)dmgSmokeFor(a,{x:u.x,z:u.z,h:u.h,y:u.y},dt);")
rep("if(!u.mdl){if((PD.modelsN||0)>=18)continue;u.mdl=pdMakeModel(u.force);PD.modelsN=(PD.modelsN||0)+1}","if(!u.mdl){if((PD.modelsN||0)>=18)continue;u.mdl=pdMakeModel(u.force);PD.modelsN=(PD.modelsN||0)+1;if(u.dmgEv)for(const e of u.dmgEv)dmgApply(u.mdl,{x:u.x,z:u.z,h:u.h,y:u.y,vx:0,vz:0,u},e[0],e[1],e[2],e[3],e[4],true)}")
rep("$('#act').onclick=()=>{","$('#rep').onclick=()=>{dmgRepair(carA);dmgHud();toast('Auto riparata')};\n$('#act').onclick=()=>{")
rep("function step(dt){const ts=performance.now()/1000;tollStep();","function step(dt){const ts=performance.now()/1000;tollStep();dmgDrive();dmgStep(dt);if(inCar)dmgSmokeFor(carA,{x:C.x,z:C.z,h:C.h,y:V.y},dt);dmgUi(dt);")
rep('<div class="chip" id="heat" style="display:none"></div>','<div class="chip" id="heat" style="display:none"></div><div class="chip" id="dmg" style="display:none"></div><button class="b" id="rep" style="display:none">🔧 Ripara l\'auto</button>')
rep("#heat.srch{background:rgba(160,110,10,.9)}","#heat.srch{background:rgba(160,110,10,.9)}\n#dmg{position:absolute;left:calc(16px + var(--sl));bottom:calc(215px + var(--sb));font-size:12px;padding:5px 10px;border-radius:10px;pointer-events:none;color:#fff;font-weight:700}\n#rep{position:absolute;right:calc(20px + var(--sr));bottom:calc(172px + var(--sb));height:48px;min-width:120px;font-size:14px;background:rgba(40,110,60,.92);color:#fff}")
# 29) collaudi: funzioni dei danni accessibili
rep("getView:()=>view,setView:v=>{view=v},look:()=>[lookYaw,lookPitch,lookT],lookBy};","getView:()=>view,setView:v=>{view=v},look:()=>[lookYaw,lookPitch,lookT],lookBy,CARDMG,carHit,dmgApply,dmgRepair,dmgDrive,dmgPrep,DMGBOX,DEB};")
# 30) radio: un'unità che riceve l'ordine e vede subito il veicolo conferma comunque ("ricevuto, lo vedo già"); varianti da un altro elenco
rep("const pool=PDL[kind];if(!pool)return null;const idx=pdVariant(kind,pool.length);","const pk=opt.pool||kind,pool=PDL[pk];if(!pool)return null;const idx=pdVariant(pk,pool.length);")
rep("pdSay('order','C',{u2:u.name,place:d.place,card:e?pdCard(e.vx,e.vz):'ignota'},2,{force:true});pdLater(1.4,()=>{if(u.assign!==a0||a0.arrived)return;pdSay('ack',u,{u2:u.name},1,{force:true})})",
    "pdSay('order','C',{u2:u.name,place:d.place,card:e?pdCard(e.vx,e.vz):'ignota'},2,{force:true});u.ackA=a0;pdLater(1.4,()=>{if(u.ackA!==a0)return;u.ackA=null;if(u.assign!==a0||a0.arrived)return;pdSay('ack',u,{u2:u.name},1,{force:true})})")
rep("function pdRadioInit6(){EV.on('sightJoin',d=>{const u=PD.units.find(x=>x.id===d.id);if(u)pdSay('joinSight',u,{place:d.place,card:d.card},3,{force:true})})}",
    "function pdRadioInit6(){EV.on('sightJoin',d=>{const u=PD.units.find(x=>x.id===d.id);if(!u)return;if(d.ack)pdSay('ack',u,{u2:u.name,place:d.place,card:d.card},3,{force:true,pool:'ackSee'});else pdSay('joinSight',u,{place:d.place,card:d.card},3,{force:true})})}")
rep("EV.on('rerouted',d=>{const u=U(d.id);if(u)pdSay('rerouted',u,{},2)});","EV.on('rerouted',d=>{const u=U(d.id);if(u)pdSay('rerouted',u,{},2,{force:d.why==='percorso bloccato'&&PD.t-(RAD.lastKind.rerouted||-99)>6})});")
# 31) inversione rapida in emergenza: frenata decisa, poi testacoda controllato col freno a mano (dove la strada lo permette), uscita in accelerazione
rep("u.utm={side,phase:'brake',t:0,pt:0,hT,n:0,wide:!rf||rf.hw>=4.8};","u.utm={side,phase:'brake',t:0,pt:0,hT,n:0,wide:!rf||rf.hw>=4.8,hbOk:!!u.lights&&(!rf||rf.hw>=3.7)};")
rep("u.ix=sp>12?0:-m.side*.35;u.iy=sp>7.5?-1:.2;","const vIn=m.hbOk?10.5:7.5;u.ix=sp>12?0:-m.side*.35;u.iy=sp>vIn?-1:.2;")
rep("if(sp<=7.5){m.phase='arc';m.pt=0}","if(sp<=vIn){m.phase='arc';m.pt=0;if(m.hbOk&&pdClearAhead(u,0,12)<9)m.hbOk=false}")
rep("u.ix=m.side;const want=m.wide?5.5:4;","u.ix=m.side;const want=m.wide?5.5:4;if(m.hbOk&&m.n===0&&!m.slid2&&Math.abs(err)>1.05&&sp>2.2){u.hb=true;u.iy=0;u.yw+=(-m.side*2.3-u.yw)*Math.min(1,dt*5);m.slid=1;return true}if(m.slid&&!m.slid2){m.slid2=1;u.yw*=.35}if(m.slid2){m.st2=(m.st2||0)+dt;const rf2=pdRoadFrame(u);if(u.fwd>.6&&rf2&&Math.abs(err)<1.1){const la=-Math.max(0,rf2.hw*.5),ax=rf2.px+rf2.dx*12-rf2.dz*la,az=rf2.pz+rf2.dz*12+rf2.dx*la;pdSteerTo(u,ax,az,2)}else u.ix=u.fwd>.6?pdClamp(-err*2.2,-1,1):0;u.iy=.85;if(m.st2>.6&&Math.abs(err)<.5){u.utm=null;u.utmCool=PD.t+1.5;u.pgT=undefined;return false}if(pdClearAhead(u,0,6)<1.6&&Math.abs(err)>.5){m.phase='rev';m.pt=0;m.n++;m.rs=0}return true}")
# 33) vista della polizia: le auto parcheggiate non nascondono la strada (si vede sopra e attorno); la pattuglia girata si rimette in corsia
rep("SO.push({x:x,z:z,hx:.89,hz:2.15,c:Math.cos(ang),s:Math.sin(ang)})","SO.push({x:x,z:z,hx:.89,hz:2.15,c:Math.cos(ang),s:Math.sin(ang),pk:1})")
# 34) incrocio col veicolo che arriva di fronte: la pattuglia tiene la destra finché non è passato e gira subito dopo; niente affiancamento se non è allineata
rep("if(alongU>4&&alongU<110&&dirDot<-.5&&T.sp>4&&!(u.rev>0)&&!(u.piv>0)){","if(alongU>-3&&alongU<110&&dirDot<-.5&&T.sp>4&&!(u.rev>0)&&!(u.piv>0)){")
rep("if(alongU<-6&&dT<140&&(dirDot<-.3||(T.sp<2.5&&alongU<-25))&&","if((alongU<-6||(alongU<-3&&dirDot<-.5))&&dT<140&&(dirDot<-.3||(T.sp<2.5&&alongU<-25))&&")
rep("if(type==='pit'&&d<14&&Math.abs(pdWrap(u.h-T.dirA))>P.yawMax)r.push('orientamento non allineato');","if(type==='pit'&&d<14&&Math.abs(pdWrap(u.h-T.dirA))>P.yawMax)r.push('orientamento non allineato');if(type==='flank'&&Math.abs(pdWrap(u.h-T.dirA))>.6)r.push('orientamento non allineato');")
# 35) inversione in tre tempi sulle strade strette: più tentativi prima di rinunciare
rep("if(m.t>13||m.n>4){","if(m.t>13||m.n>(m.wide?4:6)){")
rep("if((free<2.3||outward||stall)&&Math.abs(err)>.5){m.phase='rev'","if((free<2.3||(outward&&u.fwd>0)||stall)&&Math.abs(err)>.5){m.phase='rev'")   # il residuo di retromarcia verso il bordo non fa ripartire la retromarcia
# 36) centrale: le unità libere a più di 7 km di strada non vengono mandate (arriverebbero a cose fatte); meglio una sede vicina
#     e niente giri viziosi: chi per arrivare dovrebbe fare un lungo giro (carreggiata opposta fino allo svincolo, lago) non viene scelto
rep("const r=pdRoute(u.x,u.z,dest.x,dest.z,u.h);if(r.ok)out.push({u,eta:r.len/19+1+(forBlock?8:0),len:r.len,route:r})","const r=pdRoute(u.x,u.z,dest.x,dest.z,u.h);if(r.ok&&r.len<7000&&r.len<Math.hypot(u.x-dest.x,u.z-dest.z)*2.4+700)out.push({u,eta:r.len/19+1+(forBlock?8:0),len:r.len,route:r})")
rep("const dd=sp.aheadDest||dest,r=pdRoute(sp.x,sp.z,dd.x,dd.z);if(r.ok){","const dd=sp.aheadDest||dest,r=pdRoute(sp.x,sp.z,dd.x,dd.z);if(r.ok&&r.len<Math.hypot(sp.x-dd.x,sp.z-dd.z)*2.4+700){")
# 37) pattuglie di zona: su una carreggiata a senso unico (autostrada, rampe, sensi unici) nascono nel verso di marcia, mai contromano
rep("uz=(s.bz-s.az)/s.len,d=pdRnd()<.5?1:-1,off=laneOff(s)","uz=(s.bz-s.az)/s.len,d=s.ow?1:(pdRnd()<.5?1:-1),off=laneOff(s)")
# 38) ricerca in autostrada: se il veicolo (posizione stimata lungo la carreggiata) è rimasto indietro, la pattuglia non fa chilometri
#     fino allo svincolo per tornare: rallenta sulla corsia di destra e lo aspetta (lo vedrà passare)
rep("const tgt=pdSearchPoint(u,u.kn)||[kn.x,kn.z];","{const rfw=pdRoadFrame(u),c=PD.case,k=c&&c.last;if(rfw&&rfw.s.mw&&!rfw.s.tp&&k){const M=WORLD.MWS[rfw.s.mw-1],ks=pdBestSeg(k.x,k.z,14,k.h);if(M&&ks&&ks.s.mw===rfw.s.mw&&ks.s.side===rfw.s.side){const qk=M.proj(k.x,k.z,80),sk=qk?qk.s:null,qu=M.proj(u.x,u.z,80);if(sk!==null&&qu){const tv=M.tan(qu.s),dir=(Math.sin(u.h)*tv[0]+Math.cos(u.h)*tv[1])>=0?1:-1,age=PD.t-k.t,sp=Math.hypot(k.vx,k.vz),ahead=((sk+dir*sp*Math.min(age,25))-qu.s)*dir;if(ahead<-25&&ahead>-3000){pdSteerTo(u,rfw.px+rfw.dx*30-rfw.dz*2.6,rfw.pz+rfw.dz*30+rfw.dx*2.6,1.6);pdSpeedTo(u,15);pdAvoid(u);u.route=null;u.mwWait=PD.t;return}}}}}const tgt=pdSearchPoint(u,u.kn)||[kn.x,kn.z];")
# 39) POLIZIA v7 (Versione 19): caselli attraversati in corsia
rep("PD.fn={pdUTurn,",open(D+'w2/police_v7.js',encoding='utf-8').read()+"\nPD.fn={pdUTurn,")
rep("pdControl(u,T,dt);if(u.utm&&u.utm.frame!==PD.t)pdUTurn(u,dt);pdKeepRoad(u);pdStuck(u,dt);pdPhys(u,dt)","pdControl(u,T,dt);if(u.utm&&u.utm.frame!==PD.t)pdUTurn(u,dt);pdKeepRoad(u);pdTollLane(u);pdStuck(u,dt);pdPhys(u,dt)")
# 40) attacco coordinato: tante pattuglie per stella, posizioni tattiche attorno al veicolo (niente trenino), speronamenti a 4–5 stelle, tagli per strade parallele
rep("maxUnits:16,ambient:3,maxChasers:8,areaMax:5,areaBlock:5,","maxUnits:24,ambient:3,maxChasers:15,areaMax:8,areaBlock:6,")
rep("if(avg>.045&&PD.cfg.maxUnits>6){const n=PD.cfg.maxUnits>10?10:6;PD.cfg.maxUnits=n;PD.cfg.ambient=n>6?2:1;","if(avg>.045&&PD.cfg.maxUnits>7){const n=PD.cfg.maxUnits>12?12:7;PD.cfg.maxUnits=n;PD.cfg.maxChasers=Math.min(15,n-1);PD.cfg.ambient=n>7?2:1;")
rep("else if(avg<.024&&PD.cfg.maxUnits<16&&PD.fgLow){tm.gf+=3;if(tm.gf>=12){PD.cfg.maxUnits=PD.cfg.maxUnits<10?10:16;PD.cfg.ambient=PD.cfg.maxUnits>10?3:2;tm.gf=0}}","else if(avg<.024&&PD.cfg.maxUnits<24&&PD.fgLow){tm.gf+=3;if(tm.gf>=12){PD.cfg.maxUnits=PD.cfg.maxUnits<12?12:24;PD.cfg.maxChasers=Math.min(15,PD.cfg.maxUnits-1);PD.cfg.ambient=PD.cfg.maxUnits>12?3:2;tm.gf=0}}")
rep("if((PD.modelsN||0)>=18)continue;","if((PD.modelsN||0)>=24)continue;")
rep("const need=Math.min(cfg.maxChasers,1+Math.round(c.heat*1.4));if(mem.length+DSP.pending<need&&PD.t-c.reqT>9){c.reqT=PD.t;DSP.requestBackup(c,need-mem.length-DSP.pending)}",
    "const need=pdWant(c);if(mem.length+DSP.pending<need&&PD.t-c.reqT>(c.heat>=3?5:8)){c.reqT=PD.t;DSP.requestBackup(c,Math.min(4,need-mem.length-DSP.pending))}")
rep("if(sorted.length&&c.lead!==sorted[0].id){c.lead=sorted[0].id}","if(sorted.length&&c.lead!==sorted[0].id){c.lead=sorted[0].id}pdFormation(c,mem);")
rep("const need2=Math.min(cfg.maxChasers,1+Math.round(c.heat*1.2));if(mem.length+DSP.pending<need2&&PD.t-c.reqT>12){c.reqT=PD.t;DSP.requestBackup(c,need2-mem.length-DSP.pending)}",
    "const need2=Math.max(2,Math.round(pdWant(c)*.8));if(mem.length+DSP.pending<need2&&PD.t-c.reqT>10){c.reqT=PD.t;DSP.requestBackup(c,Math.min(4,need2-mem.length-DSP.pending))}")
rep("if(b.act==='follow'||b.act==='closeIn'){const gap=","if(b.act==='follow'||b.act==='closeIn'){if(pdAttack(u,T,dt,d))return;const gap=")
rep("if(acc>=Lk){ax=tr[j].x;az=tr[j].z}else{const ext=Math.max(0,Lk-acc-toT);ax=T.x+T.dx*ext;az=T.z+T.dz*ext}onTrail=true;",
    "if(acc>=Lk){ax=tr[j].x;az=tr[j].z}else{const ext=Math.max(0,Lk-acc-toT);ax=T.x+T.dx*ext;az=T.z+T.dz*ext}onTrail=true;if(u._slotLat){let tx=T.dx,tz=T.dz;if(acc>=Lk){const a2=tr[Math.max(0,j-1)],b2=tr[Math.min(tr.length-1,j+1)],l2=Math.hypot(b2.x-a2.x,b2.z-a2.z);if(l2>.5){tx=(b2.x-a2.x)/l2;tz=(b2.z-a2.z)/l2}}ax+=-tz*u._slotLat;az+=tx*u._slotLat}")
rep("if(!onTrail){const aAlong=Math.max(along,-gap)+Lk,aLat=along>-gap+4?Math.sign(latU||1)*Math.max(2.6,Math.min(Math.abs(latU),4)):0;",
    "if(!onTrail){const aAlong=Math.max(along,-gap)+Lk,aLat=u._slotLat!==undefined?u._slotLat:(along>-gap+4?Math.sign(latU||1)*Math.max(2.6,Math.min(Math.abs(latU),4)):0);")
rep("let v=T.sp+(along<-gap?Math.min(16,(-along-gap)*.55):-(gap+along)*(along>-gap+3?1.3:.7));",
    "let v=T.sp+(along<-gap?Math.min(u._aggr?24:16,(-along-gap)*(u._aggr>=3?.9:.55)):-(gap+along)*(along>-gap+3?1.3:.7));")
rep("for(const mn of ['flank','pit']){const chk=pdManeuverCheck(mn,u,T),","for(const mn of ['flank','pit']){if(!pdManOK(u,mn)){add(mn,0,'coordinamento: manovra riservata ad altra pattuglia');continue}const chk=pdManeuverCheck(mn,u,T),")
rep("if(ca<26&&ca<dT-6&&PD.t>=(u.ovtT||0))v=Math.min(v,pdFollowV(u,ca));pdSpeedTo(u,Math.max(0,v));pdAvoid(u);return}","if(ca<26&&ca<dT-6&&PD.t>=(u.ovtT||0))v=Math.min(v,pdFollowV(u,ca));if(u._capV!==undefined)v=Math.min(v,u._capV);pdSpeedTo(u,Math.max(0,v));pdAvoid(u);return}")
# 41) traffico in movimento: la frenata d'emergenza (pdAvoid) guarda solo gli ostacoli fermi; le auto in marcia si gestiscono con
#     l'adeguamento di velocità e il sorpasso, con uno sguardo più lungo alle alte velocità (prima l'intero gruppo frenava a 50 m
#     dietro a un'auto lenta, come se fosse un muro, e rimaneva incolonnato)
rep("for(let i=0;i<AMBC;i++){const s={x0:0,x1:0,z0:0,z1:0,on:0,nc:1};solids.push(s);CSOL.push(s)}","for(let i=0;i<AMBC;i++){const s={x0:0,x1:0,z0:0,z1:0,on:0,nc:1,amb:1};solids.push(s);CSOL.push(s)}")
rep("function pdClearAhead(u,ang,look,mg){","function pdClearAhead(u,ang,look,mg,noTr){")
rep("for(const b of solids){if(!b.nc||b.on===0)continue;const t=rayBox(x0,z0,sn,cn,b.x0-M,b.x1+M,b.z0-M,b.z1+M,q);if(t<q)q=Math.max(0,t-.5)}","for(const b of solids){if(!b.nc||b.on===0||(noTr&&b.amb))continue;const t=rayBox(x0,z0,sn,cn,b.x0-M,b.x1+M,b.z0-M,b.z1+M,q);if(t<q)q=Math.max(0,t-.5)}")
rep("function pdAvoid(u){const sp=Math.max(0,u.fwd),look=pdClamp(12+sp*1.5,12,80),f=pdClearAhead(u,0,look);","function pdAvoid(u){const sp=Math.max(0,u.fwd),look=pdClamp(12+sp*1.5,12,80),f=pdClearAhead(u,0,look,undefined,u.lights&&sp>6);")
rep("if(clear&&dT<75&&aimErr<1.1){u.chaseRoute=null;let tx=ax,tz=az;const ca=pdCarAhead(u,26);","if(clear&&dT<75&&aimErr<1.1){u.chaseRoute=null;let tx=ax,tz=az;const caR=Math.max(26,u.fwd*1.3),ca=pdCarAhead(u,caR);")
rep("if(ca<26&&ca<dT-6&&PD.t>=(u.ovtT||0)&&PD.t-(u.ovtLast||-9)>1.5){const rf=pdRoadFrame(u),slow=u.fwd<5&&ca<12,L=pdClearAhead(u,slow?.35:.2,60);","if(ca<caR&&ca<dT-6&&PD.t>=(u.ovtT||0)&&PD.t-(u.ovtLast||-9)>1.5){const rf=pdRoadFrame(u),slow=u.fwd<5&&ca<12,L=pdClearAhead(u,slow?.35:.2,60);")
rep("if(ca<26&&ca<dT-6&&PD.t>=(u.ovtT||0))v=Math.min(v,pdFollowV(u,ca));if(u._capV!==undefined)","if(ca<caR&&ca<dT-6&&PD.t>=(u.ovtT||0))v=Math.min(v,pdFollowV(u,ca));if(u._capV!==undefined)")
rep("const ca=pdCarAhead(u,26);if(ca<26){if(u.lights&&PD.t>=(u.ovtT||0)","const caR=u.lights?Math.max(26,sp*1.3):26,ca=pdCarAhead(u,caR);if(ca<caR){if(u.lights&&PD.t>=(u.ovtT||0)")
# 42) traffico e polizia ad alta velocità: le auto civili seguono chi le precede alla sua velocità (prima frenavano fino a fermarsi
#     se il giocatore rientrava davanti a loro, con decelerazioni impossibili, e diventavano muri in corsia); accelerazione e frenata
#     fisiche; le pattuglie in sirena guardano lontano quanto serve per frenare, usano una legge di inseguimento fisica, la frenata
#     d'emergenza considera le auto che si avvicinano troppo in fretta, e chi sta in formazione vede il traffico nella propria corsia
rep("for(let i=0;i<AMBC;i++){const s=CSOL[i],c=CARS[i];if(c){s.on=1;s.x0=c.x-1.25;s.x1=c.x+1.25;s.z0=c.z-1.25;s.z1=c.z+1.25}else s.on=0}",
    "for(let i=0;i<AMBC;i++){const s=CSOL[i],c=CARS[i];if(c){s.on=1;s.cr=c;s.x0=c.x-1.25;s.x1=c.x+1.25;s.z0=c.z-1.25;s.z1=c.z+1.25}else{s.on=0;s.cr=null}}")
rep("const ob=(ox,oz,lw)=>{const rx=ox-c.x,rz=oz-c.z,al=rx*sh+rz*ch,lat=Math.abs(rx*ch-rz*sh);if(al>0&&al<18&&lat<lw)vt=Math.min(vt,Math.max(0,(al-6.5)*.9))};",
    "const ob=(ox,oz,lw,ov)=>{const rx=ox-c.x,rz=oz-c.z,al=rx*sh+rz*ch,lat=Math.abs(rx*ch-rz*sh);if(al>0&&al<Math.max(18,c.v*1.6)&&lat<lw){const g=al-6.5;vt=Math.min(vt,Math.max(0,Math.max(0,ov||0)+(g>0?Math.min(g*.9,Math.sqrt(9*g)):g)))}};")
rep("for(const o of CARS)if(o!==c)ob(o.x,o.z,2.3);ob(inCar?C.x:P.x,inCar?C.z:P.z,inCar?2.5:1.8);if(typeof PD!=='undefined'&&PD.units)for(const u of PD.units)if(u.lod==='near'&&u.status!=='gone')ob(u.x,u.z,2.3);",
    "for(const o of CARS)if(o!==c)ob(o.x,o.z,2.3,o.v*(Math.sin(o.h)*sh+Math.cos(o.h)*ch));ob(inCar?C.x:P.x,inCar?C.z:P.z,inCar?2.5:1.8,inCar?V.vx*sh+V.vz*ch:0);if(typeof PD!=='undefined'&&PD.units)for(const u of PD.units)if(u.lod==='near'&&u.status!=='gone')ob(u.x,u.z,2.3,(u.vx||0)*sh+(u.vz||0)*ch);")
rep("c.v+=(vt-c.v)*Math.min(1,dt*(vt<c.v?3.5:1.2));","{const dv=(vt-c.v)*Math.min(1,dt*(vt<c.v?3.5:1.2));c.v+=Math.max(-8*dt,Math.min(3.5*dt,dv))}")
rep("for(const b of solids){if(!b.nc||b.on===0||(noTr&&b.amb))continue;","for(const b of solids){if(!b.nc||b.on===0||(noTr&&b.amb&&pdTrMoving(u,b)))continue;")
rep("function pdFollowV(u,ca){return Math.max(0,(u.caV||0)+(ca-8)*.9)}","function pdFollowV(u,ca){const g=ca-8;return Math.max(0,(u.caV||0)+(u.lights?Math.min(g*1.2+2,Math.sqrt(Math.max(0,11*g))):g*.9))}")
rep("if(clear&&dT<75&&aimErr<1.1){u.chaseRoute=null;let tx=ax,tz=az;const caR=Math.max(26,u.fwd*1.3),ca=pdCarAhead(u,caR);",
    "if(clear&&dT<75&&aimErr<1.1){u.chaseRoute=null;let tx=ax,tz=az;const caR=u.lights?Math.max(26,u.fwd*1.3,u.fwd*u.fwd/12+12):Math.max(26,u.fwd*1.3),ca=pdCarAhead(u,caR),caClo=Math.max(0,u.fwd-(u.caV||0)),caRel=ca<caR&&(ca<dT-6||u.lights&&ca<Math.max(26,caClo*caClo/10+caClo*1.5+15));")
rep("if(ca<caR&&ca<dT-6&&PD.t>=(u.ovtT||0)&&PD.t-(u.ovtLast||-9)>1.5){const rf=pdRoadFrame(u),slow=u.fwd<5&&ca<12,L=pdClearAhead(u,slow?.35:.2,60);",
    "if(caRel&&(caClo>1.5||(u.caV||0)<T.sp-1)&&PD.t>=(u.ovtT||0)&&PD.t-(u.ovtLast||-9)>1.5){const rf=pdRoadFrame(u),slow=u.fwd<5&&ca<12,L=pdClearAhead(u,slow?.35:.2,60);")
rep("if(ca<caR&&ca<dT-6&&PD.t>=(u.ovtT||0))v=Math.min(v,pdFollowV(u,ca));if(u._capV!==undefined)",
    "if(ca<caR&&(ca<dT-6||u.lights)&&PD.t>=(u.ovtT||0))v=Math.min(v,pdFollowV(u,ca));if(u._capV!==undefined)")
rep("const caR=u.lights?Math.max(26,sp*1.3):26,ca=pdCarAhead(u,caR);if(ca<caR){if(u.lights&&PD.t>=(u.ovtT||0)",
    "const caR=u.lights?Math.max(26,sp*1.3,sp*sp/12+12):26,ca=pdCarAhead(u,caR);if(ca<caR){if(u.lights&&PD.t>=(u.ovtT||0)")
# 43) autostrada: chi lascia passare la sirena resta nella sua corsia spostandosi un poco a destra e rallenta di poco (prima finiva a cavallo
#     di due corsie a 65 km/h e chiudeva la strada a tutto il gruppo); le pattuglie in formazione scelgono da sole la corsia libera
rep("if(c.yld)off=Math.min(s.w/2-1.1,off+2.2);","if(c.yld)off=s.k===5?off+.9:Math.min(s.w/2-1.1,off+2.2);")
rep("if(c.yld)vt=Math.max(2.2,vt*(s.mw?.6:.3));","if(c.yld)vt=Math.max(2.2,vt*(s.mw?.85:.3));")
rep("if(caRel&&(caClo>1.5||(u.caV||0)<T.sp-1)&&PD.t>=(u.ovtT||0)","if(u._slotLat===undefined&&caRel&&(caClo>1.5||(u.caV||0)<T.sp-1)&&PD.t>=(u.ovtT||0)")
rep("{const rfm=pdRoadFrame(u);if(rfm&&rfm.s&&rfm.s.mw&&!rfm.s.tp&&dT>28&&!onTrail&&","{const rfm=pdRoadFrame(u);if(u._slotLat===undefined&&rfm&&rfm.s&&rfm.s.mw&&!rfm.s.tp&&dT>28&&!onTrail&&")
# 44) manovre (PIT e affiancamento): il lato da cui si arriva deve avere spazio per un'auto (prima, con il veicolo nella corsia di sorpasso,
#     la pattuglia lo affiancava dal lato dello spartitraffico e finiva sul guardrail); si sceglie il lato libero
rep("const side=sideSel||(Math.abs(lat)>.3?Math.sign(lat):1);m.side=side;",
    "let side=sideSel||(Math.abs(lat)>.3?Math.sign(lat):1);if(!sideSel){const rA=clipDist(T.x,T.z,side*T.rx,side*T.rz,4.5);if(rA<2.9){const rB=clipDist(T.x,T.z,-side*T.rx,-side*T.rz,4.5);if(rB>rA)side=-side}}m.side=side;")
rep("if(sd<need)r.push('poco spazio laterale ('+sd.toFixed(1)+' m)');",
    "if(sd<need)r.push('poco spazio laterale ('+sd.toFixed(1)+' m)');{const sr=clipDist(T.x,T.z,side*T.rx,side*T.rz,4.5);if(sr<2.9)r.push('poco spazio per affiancarsi ('+sr.toFixed(1)+' m)')}")
# 45) scelta della corsia in autostrada rispetto alla velocità che si vuole tenere (non a quella a cui si è già scesi dietro a un'auto lenta:
#     così la pattuglia restava incollata dietro all'auto a 87 km/h); margine più ampio nella legge di inseguimento; schivate dolci alle alte velocità
rep("const dx=rf.dx,dz=rf.dz,ua=(u.x-rf.px)*dx+(u.z-rf.pz)*dz,ahead=[1e9,1e9,1e9],side=[false,false,false],me=Math.max(0,u.fwd);",
    "const dx=rf.dx,dz=rf.dz,ua=(u.x-rf.px)*dx+(u.z-rf.pz)*dz,ahead=[1e9,1e9,1e9],side=[false,false,false],me=Math.max(0,u.fwd,u.case&&PD.T?PD.T.sp+4:0);")
rep("function pdFollowV(u,ca){const g=ca-8;return Math.max(0,(u.caV||0)+(u.lights?Math.min(g*1.2+2,Math.sqrt(Math.max(0,11*g))):g*.9))}",
    "function pdFollowV(u,ca){if(!u.lights)return Math.max(0,(u.caV||0)+(ca-8)*.9);const g=ca-9;return Math.max(0,(u.caV||0)+Math.min(g+1,Math.sqrt(Math.max(0,8*g))))}")
rep("const k=pdClamp(1-f/look,.2,1);if(dir!==0)u.ix=pdClamp(u.ix*.35+dir*k,-1,1);","const k=pdClamp(1-f/look,.2,1)*(sp>14?14/sp:1);if(dir!==0)u.ix=pdClamp(u.ix*.35+dir*k,-1,1);")
# 46) la pattuglia che passa su un'altra corsia (o che rincorre da lontano) mira alla corsia scelta misurata sulla strada nel punto della scia
#     in cui guarda, non con uno scostamento rispetto al veicolo (dopo una curva lo scostamento la portava fuori dalla carreggiata)
rep("onTrail=true;if(u._slotLat){let tx=T.dx,tz=T.dz;if(acc>=Lk){const a2=tr[Math.max(0,j-1)],b2=tr[Math.min(tr.length-1,j+1)],l2=Math.hypot(b2.x-a2.x,b2.z-a2.z);if(l2>.5){tx=(b2.x-a2.x)/l2;tz=(b2.z-a2.z)/l2}}ax+=-tz*u._slotLat;az+=tx*u._slotLat}",
    "onTrail=true;if(u._slotLat||u._laneAbs!==undefined){let tx=T.dx,tz=T.dz;if(acc>=Lk){const a2=tr[Math.max(0,j-1)],b2=tr[Math.min(tr.length-1,j+1)],l2=Math.hypot(b2.x-a2.x,b2.z-a2.z);if(l2>.5){tx=(b2.x-a2.x)/l2;tz=(b2.z-a2.z)/l2}}let off=u._slotLat||0;if(u._laneAbs!==undefined){const fr=pdRoadFrame({x:ax,z:az,h:Math.atan2(tx,tz)}),rf0=pdRoadFrame(u);if(fr&&rf0&&fr.s&&rf0.s&&(fr.s===rf0.s||fr.s.mw&&fr.s.mw===rf0.s.mw&&fr.s.side===rf0.s.side))off=u._laneAbs-fr.lat}ax+=-tz*off;az+=tx*off}")
rep("{const rfm=pdRoadFrame(u);if(u._slotLat===undefined&&rfm&&rfm.s&&rfm.s.mw&&!rfm.s.tp&&dT>28&&!onTrail&&",
    "{const rfm=pdRoadFrame(u);if(u._laneAbs!==undefined&&!onTrail&&rfm&&Math.abs(rfm.ang)<.6){const L2=pdClamp(u.fwd*1.1,18,45);tx=rfm.px+rfm.dx*L2-rfm.dz*u._laneAbs;tz=rfm.pz+rfm.dz*L2+rfm.dx*u._laneAbs}else if(u._slotLat===undefined&&rfm&&rfm.s&&rfm.s.mw&&!rfm.s.tp&&dT>28&&!onTrail&&")
# 47) traffico: le auto non compaiono a ridosso delle pattuglie (nascevano a 5-8 m davanti a chi rincorreva a 140 km/h);
#     in autostrada nascono già quasi alla loro velocità di crociera
rep(" for(const o of CARS)if(Math.hypot(o.x-x,o.z-z)<9)return;if(WORLD.wet(x,z))return;CARS.push({s:id,d,x,z,h:Math.atan2(tx,tz),v:vm*.6,",
    " for(const o of CARS)if(Math.hypot(o.x-x,o.z-z)<9)return;if(WORLD.wet(x,z))return;if(typeof PD!=='undefined'&&PD.units)for(const u of PD.units)if(u.lod==='near'&&u.status!=='gone'&&Math.hypot(u.x-x,u.z-z)<50)return;CARS.push({s:id,d,x,z,h:Math.atan2(tx,tz),v:vm*(s.k===5?.92:.6),")
# 48) inversioni: si gira dal lato più corto (prima, per una svolta di 135° la pattuglia vicino al bordo sinistro girava di 225° dall'altra parte),
#     e dopo la sbandata controllata non si accelera finché non si è quasi allineati (prima, a tutto gas con lo sterzo che si apriva con la
#     velocità, l'arco si allargava fino a finire contro un edificio); la manovra in tre tempi scatta prima se l'ostacolo si avvicina in fretta
rep(" if(rf&&rf.lat<-(rf.hw-3.6))side=1;"," if(rf&&rf.lat<-(rf.hw-3.6))side=1;{const e0=pdWrap(hT-u.h);if(Math.abs(e0)<2.75)side=e0>0?-1:1}")
rep("else u.ix=u.fwd>.6?pdClamp(-err*2.2,-1,1):0;u.iy=.85;if(m.st2>.6&&Math.abs(err)<.5){u.utm=null;u.utmCool=PD.t+1.5;u.pgT=undefined;return false}if(pdClearAhead(u,0,6)<1.6&&Math.abs(err)>.5){m.phase='rev';",
    "else u.ix=u.fwd>.6?pdClamp(-err*2.2,-1,1):0;u.iy=Math.abs(err)<1.1?.85:pdClamp((5-u.fwd)*.5,-1,.85);if(m.st2>.6&&Math.abs(err)<.5){u.utm=null;u.utmCool=PD.t+1.5;u.pgT=undefined;return false}if(pdClearAhead(u,0,8)<1.6+Math.max(0,u.fwd)*.45&&Math.abs(err)>.5){m.phase='rev';")
# 49) le pattuglie vedono i colleghi fermi o di traverso (prima solo il traffico e gli ostacoli fissi entravano nella frenata d'emergenza:
#     una pattuglia lanciata a 150 km/h tamponava un collega girato di traverso dopo un urto); il sorpasso non toglie la frenata se davanti
#     c'è un'auto quasi ferma; un'auto di traverso occupa più spazio laterale
rep("for(const off of [0,.95,-.95]){const x0=fx+cn*off,z0=fz-sn*off;let q=clipDist(x0,z0,sn,cn,look);for(const b of solids){if(!b.nc||b.on===0||(noTr&&b.amb&&pdTrMoving(u,b)))continue;const t=rayBox(x0,z0,sn,cn,b.x0-M,b.x1+M,b.z0-M,b.z1+M,q);if(t<q)q=Math.max(0,t-.5)}if(q<d)d=q}",
    "const sn0=Math.sin(u.h),cn0=Math.cos(u.h);for(const off of [0,.95,-.95]){const x0=fx+cn*off,z0=fz-sn*off;let q=clipDist(x0,z0,sn,cn,look);for(const b of solids){if(!b.nc||b.on===0||(noTr&&b.amb&&pdTrMoving(u,b)))continue;const t=rayBox(x0,z0,sn,cn,b.x0-M,b.x1+M,b.z0-M,b.z1+M,q);if(t<q)q=Math.max(0,t-.5)}"
    "for(const o of PD.units){if(o===u||o.lod!=='near'||o.status==='gone')continue;const ox=x0-o.x,oz=z0-o.z;if(ox*ox+oz*oz>(q+5)*(q+5))continue;if(noTr){const va=(o.vx||0)*sn0+(o.vz||0)*cn0,clo=Math.max(0,u.fwd)-va,al=(o.x-u.x)*sn0+(o.z-u.z)*cn0;if(clo<3||al>clo*clo/12+12)continue}const ch=Math.cos(o.h),sh=-Math.sin(o.h),t=rayBox(ox*ch+oz*sh,-ox*sh+oz*ch,sn*ch+cn*sh,-sn*sh+cn*ch,-.95-M,.95+M,-2.35-M,2.35+M,q);if(t<q)q=Math.max(0,t-.5)}if(q<d)d=q}")
rep("chk(o.x,o.z,lat||2.1,o.fwd*(Math.sin(o.h)*sn+Math.cos(o.h)*cn))","chk(o.x,o.z,(lat||2.1)+Math.abs(Math.sin(o.h-u.h))*1.5,o.fwd*(Math.sin(o.h)*sn+Math.cos(o.h)*cn))")
rep("if(PD.t>=(u.ovtT||0))v=Math.min(v,pdFollowV(u,ca))}","if(PD.t>=(u.ovtT||0)||(u.caV||0)<Math.max(0,sp)*.5)v=Math.min(v,pdFollowV(u,ca))}")
rep("if(ca<caR&&(ca<dT-6||u.lights)&&PD.t>=(u.ovtT||0))v=Math.min(v,pdFollowV(u,ca));","if(ca<caR&&(ca<dT-6||u.lights)&&(PD.t>=(u.ovtT||0)||(u.caV||0)<Math.max(0,u.fwd)*.5))v=Math.min(v,pdFollowV(u,ca));")
# 50) polizia aggressiva: l'attesa dei rinforzi prima di un PIT resta solo sotto le 3 stelle, nei primi 15 s e per una pattuglia sola
#     (con le richieste continue di rinforzi delle tante pattuglie per stella l'attesa non finiva mai)
rep("else if(bkLeft>0&&bkLeft<25&&c.heat<3.5&&mn==='pit')why=","else if(bkLeft>0&&bkLeft<25&&c.heat<3&&mn==='pit'&&PD.t-(c.pursuitT0||0)<15&&PD.units.filter(o=>o!==u&&o.case===c.id&&Math.hypot(o.x-T.x,o.z-T.z)<80).length<2)why=")
# 51) DISTRUZIONE A NODI E TRAVI (Versione 19): rete dinamica con plasticità e rotture (softbody.js) al posto della sola spinta dei vertici;
#     ammaccature locali; tipo di ostacolo (palo, guardrail, muro, auto); pattuglie lontane danneggiate anche senza modello; ruote piegate
rep("/* ===== DANNI DELLE AUTO",open(D+'w2/softbody.js',encoding='utf-8').read()+"\n/* ===== DANNI DELLE AUTO")
rep("if(d2<r*r){PO.hit=1;if(d2>1e-8){const d=Math.sqrt(d2);PO.x=cx+dx/d*r;PO.z=cz+dz/d*r}","if(d2<r*r){PO.hit=1;PO.s=s;if(d2>1e-8){const d=Math.sqrt(d2);PO.x=cx+dx/d*r;PO.z=cz+dz/d*r}")
rep("if(d2<r*r){PO.hit=1;let nx,nz;","if(d2<r*r){PO.hit=1;PO.s=s;let nx,nz;")
rep("a.wh.forEach(w=>{w.rotation.x+=u.fwd*dt/.332});a.st.forEach(w=>{w.rotation.y=-u.st});","a.wh.forEach(w=>{w.rotation.x+=u.fwd*dt/.332});a.st.forEach(w=>{w.rotation.y=-u.st+(w.userData.toe||0)});")
rep("carA.st.forEach(w=>{w.rotation.y=-V.st});","carA.st.forEach(w=>{w.rotation.y=-V.st+(w.userData.toe||0)});")
rep("if(vn<0){if(-vn>5)pdDamage(u,-vn,'ostacolo');if(-vn>3.2&&u.mdl)carHit(u.mdl,{x:u.x,z:u.z,h:u.h,y:u.y,vx:u.vx,vz:u.vz,u},fx-mx,fz-mz,mx,mz,-vn);",
    "if(vn<0){if(-vn>5)pdDamage(u,-vn,'ostacolo');if(-vn>3.2){if(u.mdl)carHit(u.mdl,{x:u.x,z:u.z,h:u.h,y:u.y,vx:u.vx,vz:u.vz,u},fx-mx,fz-mz,mx,mz,-vn);else if(-vn>5){const c=Math.cos(u.h),s=Math.sin(u.h),dx=fx-mx-u.x,dz=fz-mz-u.z;dmgUnitCrash(u,dx*c-dz*s,dx*s+dz*c,mx*c-mz*s,mx*s+mz*c,-vn,PO.hit&&PO.s?dmgKind(PO.s):'wall')}}")
rep("PD.modelsN=(PD.modelsN||0)+1;if(u.dmgEv)for(const e of u.dmgEv)dmgApply(u.mdl,{x:u.x,z:u.z,h:u.h,y:u.y,vx:0,vz:0,u},e[0],e[1],e[2],e[3],e[4],true)}","PD.modelsN=(PD.modelsN||0)+1;if(u.sb)sbSync(u.mdl,u)}")
rep("lookBy,CARDMG,carHit,dmgApply,dmgRepair,dmgDrive,dmgPrep,DMGBOX,DEB};","lookBy,CARDMG,carHit,dmgApply,dmgRepair,dmgDrive,dmgPrep,DMGBOX,DEB,SBT,SBST,sbCrash,sbDerive,sbNew,sbBind,sbSkin,dmgKind,sbSync,dmgCrash,SBQ,SBF,sbQueueStep,dmgUnitCrash,get PO(){return PO}};")
# 52) pulsante Ripara sempre disponibile (auto danneggiata, da fermi; tempo più lungo durante un inseguimento)
rep("$('#rep').onclick=()=>{dmgRepair(carA);dmgHud();toast('Auto riparata')};","$('#rep').onclick=()=>dmgRepairStart();")
rep("lookBy,CARDMG,carHit,dmgApply,dmgRepair,dmgDrive,dmgPrep,DMGBOX,DEB,SBT,","lookBy,CARDMG,carHit,dmgApply,dmgRepair,dmgDrive,dmgPrep,DMGBOX,DEB,dmgRepairStart,get DMGREP(){return DMGREP},SBT,")
# 53) scritte della Polizia (fianchi, cofano, targa): fanno parte della carrozzeria deformabile (prima, dopo un urto laterale, la scritta
#     restava sospesa fuori dalla porta rientrata); copia anche sul modello ad alto dettaglio
rep("const dcl=(map,w,h,pos,rot)=>{const m=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshStandardMaterial({map,transparent:true,roughness:.5,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4}));m.position.set(pos[0],pos[1],pos[2]);m.rotation.set(rot[0],rot[1],rot[2]);g.add(m)};",
    "const dcl=(map,w,h,pos,rot)=>{const ge=new T.PlaneGeometry(w,h,Math.max(1,Math.ceil(w/.22)),Math.max(1,Math.ceil(h/.22))),mt=new T.MeshStandardMaterial({map,transparent:true,roughness:.5,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4}),m=new T.Mesh(ge,mt);m.position.set(pos[0],pos[1],pos[2]);m.rotation.set(rot[0],rot[1],rot[2]);m.updateMatrix();ge.applyMatrix4(m.matrix);m.position.set(0,0,0);m.rotation.set(0,0,0);a.l1.add(m);a.l0.add(new T.Mesh(ge,mt))};")
# 54) più pressione a 4-5 stelle: le pattuglie di zona (che compaiono nascoste a 120-400 m dal punto d'intercettazione) non si fermano
#     a 8 per inseguimento: 11 a 4 stelle, 14 a 5 stelle (prima i rinforzi oltre l'ottavo partivano solo dalle sedi, lontane, e non arrivavano mai)
rep("PD.cfg.areaMax-(c.areaSpawns||0)","PD.cfg.areaMax+(c.heat>=4.5?6:c.heat>=3.5?3:0)-(c.areaSpawns||0)")
# 55) autostrada: (a) la pattuglia passata davanti al veicolo, che arriva alle sue spalle nello stesso verso, resta sulla sua strada e rallenta
#     finché non la raggiunge (prima l'itinerario verso il veicolo, alle spalle, passava dal varco dello spartitraffico: la pattuglia girava
#     sulla carreggiata opposta, faceva manovra e rientrava dietro, 8 s persi); (b) il rinforzo che vede il veicolo dalla carreggiata opposta
#     non si considera arrivato: prosegue il suo itinerario fino all'inversione invece di unirsi all'inseguimento dall'altra parte
rep("function pdChase0(u,T,gap,vmax,dt){",
    "function pdOppCw(u){const T=PD.T;if(!T||!T.seg)return false;const us=pdBestSeg(u.x,u.z,10,u.h),ts=T.seg;return !!(us&&us.s.mw&&!us.s.tp&&ts.s.mw&&!ts.s.tp&&us.s.mw===ts.s.mw&&us.s.side!==ts.s.side)}\nfunction pdChase0(u,T,gap,vmax,dt){")
rep("pdSteerTo(u,tx,tz,1.5);pdSpeedTo(u,Math.max(2,T.sp*.45));pdAvoid(u);return}",
    "pdSteerTo(u,tx,tz,1.5);pdSpeedTo(u,Math.max(2,T.sp*.45));pdAvoid(u);return}\n if(sameDir&&along>Math.max(8,-gap+8)&&dT<450&&Math.abs(latU)<16&&!(u.rev>0)){const rf=pdRoadFrame(u);if(rf&&Math.abs(rf.ang)<.9){u.chaseRoute=null;const tl=pdClamp(rf.lat,-(rf.hw-2.2),rf.hw-2.2);pdSteerTo(u,rf.px+rf.dx*14-rf.dz*tl,rf.pz+rf.dz*14+rf.dx*tl,1.5);pdSpeedTo(u,Math.min(vmax,Math.max(4,T.sp*(along>120?.55:.7))));pdAvoid(u);return}}")
rep("if(a.kind!=='block'&&(d<35||(u.sees&&Math.hypot(u.x-PD.T.x,u.z-PD.T.z)<130&&(a.kind==='respond'))||(a.kind==='call'&&u.sees))){",
    "if(a.kind!=='block'&&((d<35&&!pdOppCw(u))||(u.sees&&Math.hypot(u.x-PD.T.x,u.z-PD.T.z)<130&&(a.kind==='respond')&&!pdOppCw(u))||(a.kind==='call'&&u.sees))){")
# 56) uscite dall'autostrada: sul percorso verso la rampa la pattuglia non tiene più la sua corsia dell'autostrada fino all'ultimo
#     (lo scarto di corsia veniva applicato anche ai punti della rampa: la pattuglia puntava 4-5 m a sinistra della rampa e finiva
#     contro il guardrail della cuspide, bloccando chi la seguiva). Ora: uscita entro 220 m → corsia di destra; punto di mira già
#     fuori dalla carreggiata → si segue esattamente la linea del percorso
rep("function pdPathCore(u,pts,i,vt,lane,noEnd){",
    "function pdPathExit(pts,s){if(pts._exS===s)return pts._ex;let ex=-1,acc=0;for(let q=1;q<pts.length&&acc<700;q++){acc+=Math.hypot(pts[q][0]-pts[q-1][0],pts[q][1]-pts[q-1][1]);const b=pdBestSeg(pts[q][0],pts[q][1],9,Math.atan2(pts[q][0]-pts[q-1][0],pts[q][1]-pts[q-1][1]));if(!b||!b.s.mw||b.s.tp||b.s.mw!==s.mw||b.s.side!==s.side){ex=q;break}}pts._exS=s;pts._ex=ex;return ex}\nfunction pdPathCore(u,pts,i,vt,lane,noEnd){")
rep("let ln=lane||0;{const rf0=pdRoadFrame(u);if(rf0&&rf0.s&&rf0.s.mw&&!rf0.s.tp)ln=u.lights?pdMwLane(u,rf0):-4.8;else if(PD.t<(u.ovtT||0))ln-=2.6}",
    "let ln=lane||0;{const rf0=pdRoadFrame(u);if(rf0&&rf0.s&&rf0.s.mw&&!rf0.s.tp){const ex=pdPathExit(pts,rf0.s);let dEx=1e9;if(ex>=0){dEx=ex>i?Math.hypot(pts[i][0]-u.x,pts[i][1]-u.z):0;for(let q=i;q<ex;q++)dEx+=Math.hypot(pts[q+1][0]-pts[q][0],pts[q+1][1]-pts[q][1])}if(ex>=0&&ex<=k)ln=0;else if(dEx<220)ln=2.6;else ln=u.lights?pdMwLane(u,rf0):-4.8}else if(PD.t<(u.ovtT||0))ln-=2.6}")
#     (b) chi è a meno di 90 m dal veicolo che esce e passa vicino alla sua scia la segue (stessa traiettoria sulla rampa) invece di
#     usare l'itinerario della rete, che finiva nel punto dov'era il veicolo un secondo prima, di fianco alla pattuglia: questa
#     sterzava di 70° e si fermava sulla carreggiata
rep(" if(uMw&&!same&&dT>16){const key=ts?(ts.mw?'m'+ts.mw+':'+ts.side:'r'+(ts.icn||ts.nm||ts.k)):'x'",
    " if(uMw&&!same&&dT>16&&!(dT<90&&pdTrailNear(u,22))){const key=ts?(ts.mw?'m'+ts.mw+':'+ts.side:'r'+(ts.icn||ts.nm||ts.k)):'x'")
rep("function pdPathExit(pts,s){",
    "function pdTrailNear(u,r){const tr=PD.trail;if(!tr||tr.length<3)return false;for(let j=tr.length-1;j>=0&&j>tr.length-70;j--){const q=tr[j];if((q.x-u.x)*(q.x-u.x)+(q.z-u.z)*(q.z-u.z)<r*r)return true}return false}\nfunction pdPathExit(pts,s){")
# 57) pattuglia girata al contrario su una carreggiata a senso unico (dopo un testacoda o un urto in autostrada): può fare
#     l'inversione per rimettersi nel verso giusto (prima l'inversione era sempre vietata sui sensi unici e la pattuglia restava
#     contromano o procedeva in retromarcia); resta vietata l'inversione che la metterebbe contromano
rep("const rf=pdRoadFrame(u);if(rf&&rf.s&&rf.s.ow){u.utmCool=PD.t+6;return false}",
    "const rf=pdRoadFrame(u);if(rf&&rf.s&&rf.s.ow){const L=rf.s.len||1,ox=(rf.s.bx-rf.s.ax)/L,oz=(rf.s.bz-rf.s.az)/L;if(Math.sin(hT)*ox+Math.cos(hT)*oz<.5){u.utmCool=PD.t+6;return false}}")
#     e se si trova contromano su un senso unico non guida in avanti contro il traffico: frena e riprova l'inversione ogni 3 s
rep("(u.assign&&u.assign.kind==='block'))return false;if(u.utm){u.pgT=undefined;return true}",
    "(u.assign&&u.assign.kind==='block'))return false;if(u.utm){u.pgT=undefined;return true}\n if(!(u.rev>0)&&!(u.piv>0)){const rw=pdRoadFrame(u);if(rw&&rw.s&&rw.s.ow&&Math.abs(rw.lat)<rw.hw+1){const L=rw.s.len||1,ox=(rw.s.bx-rw.s.ax)/L,oz=(rw.s.bz-rw.s.az)/L;if(Math.sin(u.h)*ox+Math.cos(u.h)*oz<-.5){if(PD.t-(u.wwT||-9)>3){u.wwT=PD.t;u.utmCool=0;if(pdUTurnStart(u,Math.atan2(ox,oz),'contromano')){pdUTurn(u,PD.dt);return true}}if(u.fwd>.5){u.iy=-1;u.ix=0}}}}")
#     e nelle inversioni in tre tempi: in avanti lo sterzo segue il verso in cui l'auto si muove davvero (all'inizio della fase in avanti
#     l'auto scorre ancora all'indietro: con lo sterzo già girato ruotava al contrario), in retromarcia al massimo ~10 km/h (prima
#     arrivava a 20 km/h e la manovra sbatteva contro il guardrail)
rep("if(m.phase==='arc'){\n  u.ix=m.side;const want=m.wide?5.5:4;","if(m.phase==='arc'){\n  u.ix=u.fwd<-.3?-m.side:m.side;const want=m.wide?5.5:4;")
rep("if(m.phase==='rev'){\n  u.ix=-m.side;u.iy=-.85;","if(m.phase==='rev'){\n  u.ix=-m.side;u.iy=u.fwd<-2.8?0:-.85;")
# 58) VERSIONE 20 — regia tattica della polizia (police_v8.js): strisce chiodate con gomme che si forano, scatola, tenaglia agli incroci;
#     momenti spettacolari (cine.js: rallentatore e inquadratura sugli eventi forti, disattivabili); scintille
rep("PD.fn={pdUTurn,",open(D+'w2/police_v8.js',encoding='utf-8').read()+"\n"+open(D+'w2/cine.js',encoding='utf-8').read()+"\nPD.v8={TAC,TYRE,CINE,FX,pdBoxPre,pdBoxEnd,pdBoxDrive,pdBoxFr,dbgPin:u=>{const P=u.pincer,T=PD.T,pj=pdPinPath(P,T.x,T.z);return (pj.rem/Math.max(3,T.sp)).toFixed(1)+' rem'+pj.rem.toFixed(0)+' off'+pj.off.toFixed(0)+' rr'+(P.route&&P.route.ok?pdRouteRem(u,P.route).toFixed(0):'-')},pdPincerPlan,pdSpikeStep,pdTactics,pdWheelsW};\nPD.fn={pdUTurn,")
rep("{eta:q.eta,spot:q.spot,dir:q.dir,phase:'route',call:q.call,segId:q.segId}","{eta:q.eta,spot:q.spot,dir:q.dir,phase:'route',call:q.call,segId:q.segId,spike:q.spike}")
rep("function pdBlockDrive(u,dt){const a=u.assign;if(!a||a.kind!=='block'){u.iy=0;return}const sp=a.spot;","function pdBlockDrive(u,dt){const a=u.assign;if(!a||a.kind!=='block'){u.iy=0;return}const sp=a.spot;if(a.spike){pdSpikeDrive(u,dt);return}")
rep("pdStuck(u,dt);pdPhys(u,dt)","pdStuck(u,dt);pdSpikeBrake(u);pdPhys(u,dt)")
# strisce chiodate: la pattuglia che arriva mentre è lontana dal giocatore si ferma parallela al bordo (non di traverso) e prepara la striscia
rep("u.h=Math.atan2(ab.dir.x,ab.dir.z)+Math.PI/2;u.sp=u.fwd=0;u.vx=u.vz=0;u.st=0;u.yw=0;ab.phase='held';ab.arrived=true;u.vcruise=10;EV.emit('inPosition',{id:u.id,name:u.name,place:pdPlace(u.x,u.z)});plog('centrale',u.name+' in posizione per il blocco (di traverso)',{})}",
    "u.h=Math.atan2(ab.dir.x,ab.dir.z)+(ab.spike?0:Math.PI/2);u.sp=u.fwd=0;u.vx=u.vz=0;u.st=0;u.yw=0;ab.phase='held';ab.arrived=true;u.vcruise=10;if(ab.spike){if(!ab.spk)pdSpikeMake(u,ab)}else{EV.emit('inPosition',{id:u.id,name:u.name,place:pdPlace(u.x,u.z)});plog('centrale',u.name+' in posizione per il blocco (di traverso)',{})}}")
# nella stretta della scatola le pattuglie frenano a fondo e controsterzano: oppongono più resistenza alle spinte del veicolo
# tenaglia: la pattuglia lontana dal giocatore (movimento semplificato) segue il suo itinerario verso il punto di attesa, non la ricerca
rep("if(u.case&&PD.case&&PD.case.phase!=='ended'&&u.kn&&(!u.route||PD.t-(u.route.made||0)>3)){const p=pdSearchPoint(u,u.kn)||[u.kn.x,u.kn.z];pdSetRoute(u,p[0],p[1],'ultima posizione nota')}pdFarStep(u,tm.far)}}","if(u.pincer&&u.pincer.route&&u.pincer.route.ok){const r=u.pincer.route;u.route=r;u.ri=Math.max(1,r.ri||1);pdFarStep(u,tm.far);r.ri=u.ri}else{if(u.case&&PD.case&&PD.case.phase!=='ended'&&u.kn&&(!u.route||PD.t-(u.route.made||0)>3)){const p=pdSearchPoint(u,u.kn)||[u.kn.x,u.kn.z];pdSetRoute(u,p[0],p[1],'ultima posizione nota')}pdFarStep(u,tm.far)}}}")
rep("I:u.mass*1.9});","I:u.mass*1.9*(u.boxRole&&PD.case&&PD.case.box&&PD.case.box.ph!=='form'?2:1)});")
rep("(u.hb&&u.sp<1?1.8:1)),","(u.hb&&u.sp<1?1.8:1))*(u.boxRole&&PD.case&&PD.case.box&&PD.case.box.ph!=='form'?2:1),")
rep("tm.dsp+=dt;if(tm.dsp>=.5){DSP.update(tm.dsp);tm.dsp=0}","tm.dsp+=dt;if(tm.dsp>=.5){DSP.update(tm.dsp);tm.dsp=0}pdTactics(dt);")
rep("function pdExecAct(u,T,dt){const b=u.brain,vis=u.sees,kn=pdKnow(u),d=vis?Math.hypot(T.x-u.x,T.z-u.z):9e3;","function pdExecAct(u,T,dt){const b=u.brain,vis=u.sees,kn=pdKnow(u),d=vis?Math.hypot(T.x-u.x,T.z-u.z):9e3;if(u.pincer&&pdPincerDrive(u,T,dt))return;if(u.boxRole&&pdBoxDrive(u,T,dt))return;")
rep("const att=mem.filter(u=>u.lod==='near'&&u.status==='chasing'&&!(u.assign&&u.assign.kind==='block')&&!u.icpt&&","const att=mem.filter(u=>u.lod==='near'&&u.status==='chasing'&&!(u.assign&&u.assign.kind==='block')&&!u.icpt&&!u.pincer&&")
rep("const S=pdSlotsFor(c,T),used=new Set();","const S=pdSlotsFor(c,T),used=new Set();pdBoxPre(c,att,T,st,used);")
rep("const free=att.filter(u=>!u.brain.man);","const free=att.filter(u=>!u.brain.man&&!u.boxRole);")
rep("function pdManOK(u,mn){const c=PD.case;if(!c)return true;","function pdManOK(u,mn){if(u.boxRole||u.pincer)return false;const c=PD.case;if(!c)return true;")
rep("if((s.k==='SL'||s.k==='SR')&&st>=4){","if((s.k==='SL'||s.k==='SR')&&st>=4&&!s.box){")
rep("lat=pdLaneFree(u,T,lat);u._slotLat=u.slotLatD=lat;u._aggr=st;u._capV=cap<99?Math.max(0,cap):undefined;","if(!s.box)lat=pdLaneFree(u,T,lat);if(s.capV!==undefined)cap=Math.min(cap,s.capV);u._slotLat=u.slotLatD=lat;u._aggr=st;u._capV=cap<99?Math.max(0,cap):undefined;")
rep("function dmgDrive(){const D=carA.dmg;","function dmgDrive(){dmgDrive0();TYRE.apply()}\nfunction dmgDrive0(){const D=carA.dmg;")
rep("vl*=Math.exp(-((hb||(typeof PD!=='undefined'&&V.slipT>PD.t))?1.4:Math.abs(vl)>7?3.5:8.5)*dt);","vl*=Math.exp(-((hb||(typeof PD!=='undefined'&&V.slipT>PD.t))?1.4:(Math.abs(vl)>7?3.5:8.5)*(CARDMG.grip||1))*dt);")
rep("carA.wh.forEach(w=>{w.rotation.x+=cs.v*dt/.332});","carA.wh.forEach(w=>{w.rotation.x+=cs.v*dt/.332});if(carA.tyre)TYRE.step(carA,dt,cs.v);")
rep("a.wh.forEach(w=>{w.rotation.x+=u.fwd*dt/.332});","a.wh.forEach(w=>{w.rotation.x+=u.fwd*dt/.332});if(a.tyre)TYRE.step(a,dt,u.fwd);")
rep("function frame(now){requestAnimationFrame(frame);const dt=Math.min(.05,(now-last)/1000);last=now;step(dt);R.render(sc,cam)}","function frame(now){requestAnimationFrame(frame);const dt=Math.min(.05,(now-last)/1000);last=now;step(dt*CINE.step(dt));R.render(sc,cam)}")
rep("cam.rotation.set(pitch,yaw+PI,0)}","cam.rotation.set(pitch,yaw+PI,0);CINE.apply()}")
rep("cfg:{enabled:true,","cfg:{cine:true,enabled:true,")
rep("chk('p_on','enabled');chk('p_voice','voice');chk('p_sub','subtitles');chk('p_siren','siren');",
    "chk('p_on','enabled');chk('p_voice','voice');chk('p_sub','subtitles');chk('p_siren','siren');chk('p_cine','cine');"
    "const heat3=()=>{const c=PD.case;if(!c||c.phase!=='pursuit'){toast('Serve un inseguimento in corso');return null}c.heat=Math.max(c.heat,3.6);return c};"
    "bind('p_spk',()=>{const c=heat3();if(c&&!DSP.requestSpikes(c))toast('Strisce: nessun rettilineo adatto o nessuna pattuglia in tempo')});"
    "bind('p_box',()=>{const c=heat3();if(c){TAC.boxCool=0;c.pursuitT0=Math.min(c.pursuitT0||PD.t,PD.t-9);toast('Scatola: serve un rettilineo largo e quattro pattuglie vicine')}});"
    "bind('p_pin',()=>{const c=heat3();if(c){TAC.pinCool=0;c.pin=null;pdPincerPlan(c,PD.T,4);if(!c.pin)toast('Tenaglia: nessun incrocio adatto davanti')}});")
h=h.replace('<label><input type="checkbox" id="p_siren"> Sirene</label>','<label><input type="checkbox" id="p_siren"> Sirene</label><label><input type="checkbox" id="p_cine"> Momenti spettacolari (rallentatore)</label>',1)
h=h.replace('<button class="b s" id="p_end">Termina</button>','<button class="b s" id="p_spk">Strisce chiodate</button><button class="b s" id="p_box">Scatola</button><button class="b s" id="p_pin">Tenaglia</button><button class="b s" id="p_end">Termina</button>',1)
# 59) VERSIONE 20 — distruzione realistica (crash.js): scintille e stridio della lamiera, ribaltamenti (sezione rigida che rotola,
#     tetto schiacciato a ogni battuta), cofano/baule/porte incernierati che si sganciano e volano via, paraurti appeso che striscia,
#     vapore, olio, incendio che cresce, parabrezza incrinato, gomme che scoppiano
rep("PD.v8={TAC,TYRE,CINE,FX,","\n"+open(D+'w2/crash.js',encoding='utf-8').read()+"\nPD.v9={CR,RPOLY,CRP,OIL,CRL,FP,fpSpawn,fpStep,crW,get SMK(){return SMK},get DEB(){return DEB},get SBT(){return SBT},rlStart,rlStep,rlRot,crRollPose,crTrip,crUnlatch,crParts,crPartGone,crHang,crHangStep,crHangTry,crGlassCrack,crGlassBreak,crBurst,crFireStep,crCarStep,crAfterCrash,crRepair,crScrape,crSt,crChar,crRollDrive,crRollUnit};\nPD.v8={TAC,TYRE,CINE,FX,")
# guida del giocatore: ribaltamento in corso, auto rovesciata, inciampo sul cerchio
rep("function drive(dt,ix,iy){const hb=!!(K[' ']||K.hb);\n let sn=Math.sin(C.h),cn=Math.cos(C.h),vf=V.vx*sn+V.vz*cn,vl=V.vz*sn-V.vx*cn;",
    "function drive(dt,ix,iy){const hb=!!(K[' ']||K.hb);if(V.rol){crRollDrive(dt);return}if(V.flip){V.vx*=Math.exp(-6*dt);V.vz*=Math.exp(-6*dt);cs.v=0;return}\n let sn=Math.sin(C.h),cn=Math.cos(C.h),vf=V.vx*sn+V.vz*cn,vl=V.vz*sn-V.vx*cn;if(crTrip(V,carA,vl,Math.hypot(vf,vl),dt)){V.rlF=vf;crRollDrive(dt);return}")
# contatto con muri e guardrail: scintille di strisciata; guardrail preso di traverso ad alta velocità: inciampo
rep("if(q[2]&&(ux||uz)){const l=Math.hypot(ux,uz),mx=ux/l,mz=uz/l,vn=V.vx*mx+V.vz*mz;nx+=ux;nz+=uz;",
    "if(q[2]&&(ux||uz)){const l=Math.hypot(ux,uz),mx=ux/l,mz=uz/l,vn=V.vx*mx+V.vz*mz;nx+=ux;nz+=uz;{const so=PO.s,lo=!!(so&&so.lo),vt=V.vx*-mz+V.vz*mx;crScrape(fx-mx,V.y+(lo?.48:.38),fz-mz,-mz,mx,vt,Math.max(0,-vn));const lat=-cn*mx+sn*mz,vl0=V.vz*sn-V.vx*cn;if(lo&&Math.abs(lat)>.75&&vl0*lat<-10&&!V.rol){V.rlF=V.vx*sn+V.vz*cn;rlStart(V,vl0,.3,'guardrail',.6,0)}}")
# pattuglie: ribaltamento, auto rovesciata, inciampo; scintille contro muri e guardrail
rep("function pdPhys(u,dt){const hb=u.hb;let sn=Math.sin(u.h),cn=Math.cos(u.h),vf=u.vx*sn+u.vz*cn,vl=u.vz*sn-u.vx*cn;",
    "function pdPhys(u,dt){if(u.rol){crRollUnit(u,dt);return}if(u.flip){u.vx=u.vz=0;u.fwd=u.sp=0;return}const hb=u.hb;let sn=Math.sin(u.h),cn=Math.cos(u.h),vf=u.vx*sn+u.vz*cn,vl=u.vz*sn-u.vx*cn;if(crTrip(u,u.mdl,vl,Math.hypot(vf,vl),dt,u.flat)){u.rlF=vf;crRollUnit(u,dt);return}")
# una pattuglia che si sta ribaltando non è più guidata (niente sterzo, inversioni o rientri in corsia) e rotola anche se lontana
rep("if(u.lod==='near'){pdControl(u,T,dt);","if(u.rol){pdPhys(u,dt)}else if(u.lod==='near'){pdControl(u,T,dt);")
rep("if(q[2]&&(ux||uz)){const l=Math.hypot(ux,uz),mx=ux/l,mz=uz/l,vn=u.vx*mx+u.vz*mz;nx+=ux;nz+=uz;",
    "if(q[2]&&(ux||uz)){const l=Math.hypot(ux,uz),mx=ux/l,mz=uz/l,vn=u.vx*mx+u.vz*mz;nx+=ux;nz+=uz;if(u.mdl&&u.lod==='near')crScrape(fx-mx,u.y+.4,fz-mz,-mz,mx,u.vx*-mz+u.vz*mx,Math.max(0,-vn));")
# auto contro auto: scintille dove le fiancate strisciano
rep("if(hit){out.push([A,B,imp,cpx,cpz,cnx,cnz])}}","if(hit){out.push([A,B,imp,cpx,cpz,cnx,cnz]);if(imp>0)crScrape(cpx,(A.p?V.y:A.u.y)+.45,cpz,-cnz,cnx,(A.vx-B.vx)*-cnz+(A.vz-B.vz)*cnx,imp)}}")
# effetti dell'urto: parabrezza che si incrina, paraurti appeso, cofano incernierato; poi porte, baule, vapore, olio, gomme
rep("if(R.ws||R.fC>.8)cut('ws',(x,y,z)=>z>.15&&y>B.y0+H*.6,true);","if(R.fC>.8||(R.ws&&R.fC>.5)){cut('ws',(x,y,z)=>z>.15&&y>B.y0+H*.6,true);crCrackOff(a)}")
rep("if(R.fb&&!D.cut.fb)dmgDetach(","if(R.fb&&!D.cut.fb&&!crHangTry(a,car,'fb',own,replay))dmgDetach(")
rep("if(R.rb&&!D.cut.rb)dmgDetach(","if(R.rb&&!D.cut.rb&&!crHangTry(a,car,'rb',own,replay))dmgDetach(")
rep("if(R.hood&&!D.cut.hood)dmgDetach(","if(R.hood&&!D.cut.hood&&a.cr&&a.cr.parts.hood){D.cut.hood=true;crPartGone(a,car,'hood','urto')}else if(R.hood&&!D.cut.hood)dmgDetach(")
rep("if(h>=2)st.rotation.y=hb.toe}}}\n","if(h>=2)st.rotation.y=hb.toe}}crAfterCrash(a,own,car,R,replay)}\n")
rep("D.on=true;dmgCrash(own,lx,lz,Dx,Dz,imp,k);","D.on=true;{const cs0=crSt(a);cs0.hit=Math.max(cs0.hit||0,imp);cs0.hitT=performance.now()}dmgCrash(own,lx,lz,Dx,Dz,imp,k);")
rep("function dmgRepair(a){const D=a&&a.dmg;if(a){a.sb=null;","function dmgRepair(a){const D=a&&a.dmg;if(a){crRepair(a);a.sb=null;")
rep("tollStep();dmgDrive();dmgStep(dt);","tollStep();dmgDrive();dmgStep(dt);crStep(dt);")
# pose dei modelli durante il ribaltamento o rovesciati
rep("carG.rotation.set(V.pt+V.tp+CARDMG.tp,C.h,V.rl+V.tr+CARDMG.tr);","carG.rotation.set(V.pt+V.tp+CARDMG.tp,C.h,V.rl+V.tr+CARDMG.tr);if(V.rol)crRollPose(carG,C.x,C.z,C.h,V.y,V.rol);else if(V.flip)crRollPose(carG,C.x,C.z,C.h,V.y,V.flip);")
rep("g.rotation.set(-Math.atan2(yf-yb,3)+u.ptc,u.h,Math.atan2(yl-yr,1.8));","g.rotation.set(-Math.atan2(yf-yb,3)+u.ptc,u.h,Math.atan2(yl-yr,1.8));if(u.rol)crRollPose(g,u.x,u.z,u.h,u.y,u.rol);else if(u.flip)crRollPose(g,u.x,u.z,u.h,u.y,u.flip);")
rep("if(a.dmg&&a.dmg.on&&d<160)dmgSmokeFor(a,{x:u.x,z:u.z,h:u.h,y:u.y},dt);","if(a.dmg&&a.dmg.on&&d<160)dmgSmokeFor(a,{x:u.x,z:u.z,h:u.h,y:u.y},dt);if((a.cr||(a.dmg&&a.dmg.on))&&d<160)crCarStep(a,{x:u.x,z:u.z,h:u.h,y:u.y,vx:u.vx,vz:u.vz,u},dt);")
# 60) VERSIONE 20.1 — correzioni dopo la prova sul telefono
#   traffico e pedoni istanziati: ogni mesh ha il colore per istanza fin dall'inizio e i pedoni hanno un materiale proprio.
#   Prima auto e pedoni condividevano un materiale e solo le auto avevano il colore per istanza: in autostrada (nessun pedone),
#   appena i materiali venivano ricompilati (per esempio quando si accendeva la luce del fuoco) il programma con il colore per
#   istanza veniva usato anche per i pedoni senza colore e three.js si fermava a metà del disegno di ogni fotogramma.
rep("for(const m of [imCar,imSh,imHd,imLL,imLR]){m.frustumCulled=false;m.castShadow=true;m.count=0;sc.add(m)}",
    "{const matP=mat.clone(),W1=new T.Color(1,1,1);for(const m of [imSh,imHd,imLL,imLR])m.material=matP;for(const m of [imCar,imSh,imHd,imLL,imLR]){m.setColorAt(0,W1);m.instanceColor.needsUpdate=true}}for(const m of [imCar,imSh,imHd,imLL,imLR]){m.frustumCulled=false;m.castShadow=true;m.count=0;sc.add(m)}")
#   per le prove nel browser: il disegno di un fotogramma si può chiedere dall'esterno (window.__iow.R)
rep("window.__iow={AMBCFG,","window.__iow={R,AMBCFG,")
# 32) minimappa: durante un inseguimento le pattuglie lampeggiano (rosso/blu), le altre sono punti blu; l'elicottero è un'icona bianca
rep("c.drawImage(MAPC,120-bxp*(240/256),120-bzp*(240/256),240,240);c.restore();arrow(c,120,120,-(inCar?C.h:yaw),13)}",
    "c.drawImage(MAPC,120-bxp*(240/256),120-bzp*(240/256),240,240);c.restore();miniPD(c,px,pz,wm);arrow(c,120,120,-(inCar?C.h:yaw),13)}\nfunction miniPD(c,px,pz,wm){const cs=PD.case;if(!cs||cs.phase==='ended')return;const k=240/wm,fl=Math.floor(PD.t*4)%2;c.save();c.beginPath();c.arc(120,120,118,0,6.2832);c.clip();c.lineWidth=1.5;c.strokeStyle='rgba(255,255,255,.85)';\n for(const u of PD.units){if(u.status==='gone'||u.status==='disabled')continue;const x=120+(px-u.x)*k,y=120+(pz-u.z)*k;if((x-120)*(x-120)+(y-120)*(y-120)>116*116)continue;const hot=u.case===cs.id;c.fillStyle=hot?((fl+u.id)%2?'#ff3030':'#2f6bff'):'rgba(70,120,255,.75)';c.beginPath();c.arc(x,y,hot?4.5:3.2,0,6.2832);c.fill();if(hot)c.stroke()}\n const h=PD.heli;if(h&&h.state!=='takeoff'){const x=120+(px-h.x)*k,y=120+(pz-h.z)*k;if((x-120)*(x-120)+(y-120)*(y-120)<116*116){c.strokeStyle='#fff';c.lineWidth=2;c.beginPath();c.arc(x,y,6,0,6.2832);c.stroke();c.beginPath();c.moveTo(x-8,y);c.lineTo(x+8,y);c.moveTo(x,y-8);c.lineTo(x,y+8);c.stroke()}}\n c.restore()}")
# 22) solidi bassi (guardrail e spartitraffico): fermano le auto ma non la vista della polizia né la telecamera
rep("if(s.hx<.65&&s.hz<.65)continue;","if((s.hx<.65&&s.hz<.65)||s.lo||s.pk)continue;")
rep("function clipDist(x,z,dx,dz,d){let best=d;for(const s of solids){if(s.on===0||s.nc)continue;best=rayBox(x,z,dx,dz,s.x0,s.x1,s.z0,s.z1,best)}","function clipDist(x,z,dx,dz,d,skipLo){let best=d;for(const s of solids){if(s.on===0||s.nc)continue;best=rayBox(x,z,dx,dz,s.x0,s.x1,s.z0,s.z1,best)}")
rep("for(const s of a){const ox=x-s.x,oz=z-s.z;best=rayBox(ox*s.c+oz*s.s,-ox*s.s+oz*s.c,dx*s.c+dz*s.s,-dx*s.s+dz*s.c,-s.hx,s.hx,-s.hz,s.hz,best)}}","for(const s of a){if(s.lo){if(skipLo)continue;if(Math.abs(dx*s.c+dz*s.s)>.9){const ox=x-s.x,oz=z-s.z,t=rayBox(ox*s.c+oz*s.s,-ox*s.s+oz*s.c,dx*s.c+dz*s.s,-dx*s.s+dz*s.c,-s.hx,s.hx,-s.hz,s.hz,best);if(t<Math.min(best,9))best=t;continue}}const ox=x-s.x,oz=z-s.z;best=rayBox(ox*s.c+oz*s.s,-ox*s.s+oz*s.c,dx*s.c+dz*s.s,-dx*s.s+dz*s.c,-s.hx,s.hx,-s.hz,s.hz,best)}}")   # guardrail colpito di striscio: conta solo se vicinissimo
rep("d=clipDist(C.x,C.z,-dx,-dz,7.5)","d=clipDist(C.x,C.z,-dx,-dz,7.5,1)")
h=h.replace("d=clipDist(C.x,C.z,-dx,-dz,orbDist)","d=clipDist(C.x,C.z,-dx,-dz,orbDist,1)")
# 19) centrale: itinerari calcolati solo dalle sedi vicine all'intervento (entro 7 km, almeno le 4 più vicine), non da tutte le sedi del mondo
rep("for(const st of DSP.stations){if(DSP.spawnQ.some(q=>q.st===st))continue;const r=pdRoute(st.x,st.z,dest.x,dest.z);if(r.ok)out.push({st,eta:r.len/19+5+(forBlock?8:0),len:r.len})}",
    "{const cand=DSP.stations.filter(st=>!DSP.spawnQ.some(q=>q.st===st)).map(st=>({st,d:Math.hypot(st.x-dest.x,st.z-dest.z)})).sort((a,b)=>a.d-b.d),lim=cand.filter(q=>q.d<7000),pick=lim.length>=4?lim:cand.slice(0,4);for(const {st,d} of pick){const r=pdRoute(st.x,st.z,dest.x,dest.z);if(r.ok&&r.len<d*2.4+700)out.push({st,eta:r.len/19+5+(forBlock?8:0),len:r.len})}}")
# 18) luoghi noti esposti ai collaudi
rep("PD.fn={pdUTurn,","PD.fn={pdPoi,pdUTurn,")
# 17) vetrine anche nei centri di Milano, Como e Genova
rep("shop=b.st<=1&&b.fl>=2&&(b.zn===0||b.zn===2||b.zn===4||b.zn===9)","shop=b.st<=1&&b.fl>=2&&(b.zn===0||b.zn===2||b.zn===4||b.zn===9||b.zn===10||b.zn===11||b.zn===16||b.zn===17||b.zn===18||b.zn===19)")
# 16) navigazione a lunga distanza: distanze in doppia precisione (con Float32 oltre ~16 km gli arrotondamenti facevano scartare nodi validi)
rep("function pdRoute(sx,sz,gx,gz,h){navBuild();const N=NAVG.nodes.length,dist=new Float32Array(N).fill(1e9),","function pdRoute(sx,sz,gx,gz,h){navBuild();const N=NAVG.nodes.length,dist=new Float64Array(N).fill(1e9),")
rep("while(open.length){const q=hpop(open),i=q[1];if(q[0]>dist[i]+hh(i)+1e-3)continue;if(gBest>=0&&q[0]>=gCost)break;","while(open.length){const q=hpop(open),i=q[1];if(q[0]>dist[i]+hh(i)+.05)continue;if(gBest>=0&&q[0]>=gCost)break;")

# 21) la stazione dei Carabinieri di Rivarolo sta al municipio di Rivarolo (non al primo municipio dell'elenco, che ora è quello di Como)
rep("function pdInitStations(){navBuild();const sp=WORLD.SPEC.find(s=>s.t==='hall'),mk=","function pdInitStations(){navBuild();const sp=WORLD.SPEC.find(s=>s.t==='hall'&&(s.town||'Rivarolo')==='Rivarolo'),mk=")
# 20) itinerari: se un posto di blocco chiude l'unica via (carreggiata a senso unico) la pattuglia lo attraversa (secondo tentativo senza blocchi)
rep("function pdRoute(sx,sz,gx,gz,h){navBuild();","function pdRoute(sx,sz,gx,gz,h,noBlk,gh){navBuild();")
rep("for(const e of NAVG.adj[i]){if(pdBlockedSeg(e[0]))continue;","for(const e of NAVG.adj[i]){if(!noBlk&&pdBlockedSeg(e[0]))continue;")
rep("if(gBest<0)return{ok:false,pts:[],len:0,why:'nessun percorso praticabile'}","if(gBest<0){if(!noBlk&&PD.blocked&&PD.blocked.size){const r2=pdRoute(sx,sz,gx,gz,h,true,gh);if(r2.ok){r2.viaBlock=true;return r2}}return{ok:false,pts:[],len:0,why:'nessun percorso praticabile'}}")
# 61) armi (Versione 21)
exec(open(D+'w2/build_armi.py',encoding='utf-8').read())
# 62) telefono in orizzontale e schermo intero (Versione 23)
exec(open(D+'w2/build_orizz.py',encoding='utf-8').read())
# 63) mappa reale dell'Italia (Versione 24)
exec(open(D+'w2/build_real.py',encoding='utf-8').read())
# 64) motore fisico reale, centraline e danni meccanici (Versione 29, altra sessione: moduli motore/*.js della repository + collegamento al gioco).
#     Il collegamento al gioco è una patch (w2/patch_motore_v29.diff) applicata alla pagina costruita: se un pezzo non si applica la costruzione si ferma,
#     così l'integrazione non può sparire in silenzio (è successo nella 29.3 del 2 novembre, ripristinata subito dopo).
import subprocess, tempfile
_tmp=tempfile.NamedTemporaryFile('w',suffix='.html',delete=False,encoding='utf-8'); _tmp.write(h); _tmp.close()
_r=subprocess.run(['patch','-p1','--no-backup-if-mismatch','-F','2',_tmp.name,D+'w2/patch_motore_v29.diff'],capture_output=True,text=True)
if _r.returncode!=0: raise SystemExit('patch motore V29 NON applicata:\n'+_r.stdout+_r.stderr)
h=open(_tmp.name,encoding='utf-8').read(); os.unlink(_tmp.name)
assert h.count('IOW_FISICA')>=10 and h.count('IOW_DANNI')>=10 and 'motore/fisica_veicolo.js' in h, 'integrazione del motore mancante'
print('patch motore V29 applicata:',_r.stdout.count('succeeded'),'parti')
# 65) Vehicle Damage Solver (Versione 30): motore/danni_solver.js + motore/profili_danno.js collegati al gioco con sostituzioni su ancore uniche
#     (w2/patch_solver_v30.py): un'ancora mancante ferma la costruzione.
import importlib.util as _ilu
_sp=_ilu.spec_from_file_location('patch_solver_v30',REPO+'sorgenti/patch_solver_v30.py'); _pm=_ilu.module_from_spec(_sp); _sp.loader.exec_module(_pm)
h,_n=_pm.applica(h); assert 'motore/danni_solver.js' in h and h.count('VDS.')>=20, 'integrazione del solver mancante'
print('patch solver V30 applicata:',_n,'sostituzioni')
# 66) Versione 31: collisioni con la quota (muri, guardrail, parapetti) nel nucleo del gioco (sorgenti/patch_mappa_v31.py del repository)
_sp=_ilu.spec_from_file_location('patch_mappa_v31',REPO+'sorgenti/patch_mappa_v31.py'); _pm=_ilu.module_from_spec(_sp); _sp.loader.exec_module(_pm)
h,_n=_pm.applica(h); assert h.count('PO.y')>=4 and 'r.rails' in h, 'integrazione delle collisioni con la quota mancante'
print('patch mappa V31 applicata:',_n,'sostituzioni')
open(OUT,'w',encoding='utf-8').write(h)
js=re.findall(r'<script>([\s\S]*?)</script>',h)[-1]
os.makedirs(D+'h',exist_ok=True); open(D+PSJ,'w',encoding='utf-8').write(js)
if not os.environ.get('OUTP'):open(D+'h/flat.js','w',encoding='utf-8').write(re.sub(r'([;{}])',r'\1\n',js))
print('pagina scritta',len(h))
