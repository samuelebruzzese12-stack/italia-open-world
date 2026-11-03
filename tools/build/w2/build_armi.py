# 61) VERSIONE 21: armi (kit di modellazione, modelli procedurali con nomi di fantasia, arma in mano, sparo, rinculo, suoni, armeria)
# Eseguito da build.py prima di scrivere la pagina (usa h e rep di build.py).
import json as _json, os as _os
_A = D + 'w2/'
# catalogo per il gioco: solo nomi di fantasia e dati tecnici (niente campi interni)
_cat = _json.load(open(D + 'armi/catalogo_gioco.json', encoding='utf-8'))
_keep = ['id', 'nome', 'produttore', 'paese', 'anno', 'categoria', 'calibro', 'funzionamento', 'colpi', 'cadenza', 'lunghezza', 'peso', 'finitura']
_cat = [{k: c.get(k) for k in _keep} for c in _cat]
# file dei modelli: kit, componenti, famiglie (quelli presenti); in prova anche gli esempi del laboratorio
_fam = ['armi2_pistole.js', 'armi2_revolver_pompa.js', 'armi2_mitra.js', 'armi2_fucili_a.js', 'armi2_fucili_b.js', 'armi2_precisione.js', 'armi2_mitragliatrici.js']
_files = [D + 'dl_three/three.js/examples/js/loaders/GLTFLoader.js', _A + 'armi2_kit.js', _A + 'armi2_comp.js']  # caricatore GLB di three.js r128 (licenza MIT)
if _os.environ.get('ARMI_TEST'): _files += [D + 'lab2/test_rax.js', D + 'lab2/test_ak.js']
if not _os.environ.get('ARMI_TEST'): _files += [_A + f for f in _fam if _os.path.exists(_A + f)]
def _src(f):
    t = open(f, encoding='utf-8').read()
    if f.endswith('GLTFLoader.js'):  # trame con elementi <img> (blob:) invece di fetch + ImageBitmap: più sicuro nella pagina pubblicata
        k = "if ( typeof createImageBitmap !== 'undefined' && /Firefox/.test( navigator.userAgent ) === false ) {"
        assert t.count(k) == 1; t = t.replace(k, 'if ( false ) {')
    return t.replace('</script>', '<\\/script>')
_scripts = ''.join('<script>\n' + _src(f) + '\n</script>\n' for f in _files)
ARMI_FILES = [_os.path.basename(f) for f in _files]
rep('<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>',
    '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>\n' + _scripts)
# stile: mirino, pulsanti dell'arma, armeria
rep('</style>', '''#mirino{position:absolute;left:50%;top:50%;width:0;height:0;pointer-events:none;display:none;--g:8px}
#mirino i{position:absolute;background:#fff;box-shadow:0 0 2px #000,0 0 1px #000}
#mirino .a{width:2px;height:8px;left:-1px;top:calc(-8px - var(--g))}#mirino .bb{width:2px;height:8px;left:-1px;top:var(--g)}
#mirino .c{width:8px;height:2px;top:-1px;left:calc(-8px - var(--g))}#mirino .d{width:8px;height:2px;top:-1px;left:var(--g)}
#mirino .p{width:3px;height:3px;left:-1.5px;top:-1.5px;border-radius:50%}
#bspara{position:absolute;right:calc(18px + var(--sr));bottom:calc(104px + var(--sb));width:80px;height:80px;border-radius:50%;padding:0;font-size:12px;background:rgba(190,30,30,.55);border-color:rgba(255,190,190,.8);display:none;align-items:center;justify-content:center;touch-action:none}
#bmira{position:absolute;right:calc(108px + var(--sr));bottom:calc(150px + var(--sb));width:58px;height:58px;border-radius:50%;padding:0;font-size:11px;display:none;align-items:center;justify-content:center}
#bmira.on{background:rgba(60,140,220,.75)}
#bricarica{position:absolute;right:calc(108px + var(--sr));bottom:calc(86px + var(--sb));width:58px;height:58px;border-radius:50%;padding:0;font-size:9.5px;display:none;align-items:center;justify-content:center}
#barmi{position:absolute;left:calc(10px + var(--sl));top:calc(124px + var(--st));width:46px;height:46px;border-radius:50%;padding:0;font-size:11px;display:flex;align-items:center;justify-content:center}
#colpi{position:absolute;right:calc(14px + var(--sr));bottom:calc(194px + var(--sb));font:700 12px system-ui,sans-serif;padding:6px 10px;display:none;max-width:46%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#arm{position:absolute;inset:0;z-index:20;pointer-events:none}#arm>*{pointer-events:auto}
#armTop{position:absolute;left:0;right:0;top:0;padding:calc(8px + var(--st)) calc(10px + var(--sr)) 8px calc(10px + var(--sl));display:flex;gap:8px;align-items:center;background:linear-gradient(#000a,#0000);color:#fff;font:700 15px system-ui,sans-serif}
#armTop{z-index:3}#armTop b{flex:1}#armTop .b{height:38px}
#armCat{position:absolute;left:calc(8px + var(--sl));top:calc(56px + var(--st));width:41%;display:flex;flex-wrap:wrap;gap:5px;touch-action:pan-x;z-index:2}
#armCat .b{height:30px;min-width:0;font-size:11px;padding:0 9px;border-radius:15px;flex:none}#armCat small{font-size:10px;opacity:.7}#armCat .b.on{background:rgba(224,176,64,.9);color:#111;text-shadow:none}
#armList{position:absolute;left:calc(8px + var(--sl));top:calc(134px + var(--st));bottom:calc(10px + var(--sb));width:41%;overflow-y:auto;display:flex;flex-direction:column;gap:5px;padding-right:4px;touch-action:pan-y;overscroll-behavior:contain;z-index:2}
#armList .it{display:flex;flex-direction:column;align-items:flex-start;text-align:left;background:rgba(20,22,26,.8);color:#fff;border:1px solid rgba(255,255,255,.18);border-radius:10px;padding:7px 10px;font:600 13px system-ui,sans-serif;flex:none}
#armList .it span{font-weight:400;font-size:11px;opacity:.75}#armList .it.on{border-color:#e0b040;background:rgba(84,62,18,.9)}
#armView{position:absolute;left:44%;right:0;top:52px;bottom:42%;touch-action:none;z-index:1}
#armHint{position:absolute;left:0;right:0;bottom:calc(14px + var(--sb));text-align:center;color:#fff;opacity:.75;font:12px system-ui,sans-serif;display:none;pointer-events:none;z-index:2;text-shadow:0 1px 2px #000}
#arm.full #armCat,#arm.full #armList,#arm.full #armInfo,#arm.full #armBtns,#arm.full #armCred{display:none!important}#arm.full #armView{left:0;right:0;top:calc(52px + var(--st));bottom:calc(8px + var(--sb))}#arm.full #armHint{display:block}
#hud.armA>:not(#arm){visibility:hidden!important}
#ottica{position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at 50% 50%,rgba(0,0,0,0) 0,rgba(0,0,0,0) 40vmin,rgba(0,0,0,.55) 41vmin,#000 42.5vmin)}
#ottica i{position:absolute;background:#000;border:0;padding:0;border-radius:0}#ottica .oh{left:0;right:0;top:50%;height:1px;margin-top:-.5px}#ottica .ov{top:0;bottom:0;left:50%;width:1px;margin-left:-.5px}
#ottica .ol,#ottica .or{top:50%;height:4px;margin-top:-2px;width:calc(50% - 16vmin)}#ottica .ol{left:0}#ottica .or{right:0}#ottica .ob{left:50%;width:4px;margin-left:-2px;bottom:0;height:calc(50% - 16vmin)}
#ottica .op{left:50%;top:50%;width:4px;height:4px;margin:-2px 0 0 -2px;border-radius:50%;background:#c22}
#armInfo{position:absolute;right:calc(10px + var(--sr));bottom:calc(68px + var(--sb));width:min(54%,430px);background:rgba(15,17,20,.75);color:#e8e8e8;border-radius:12px;padding:8px 12px;font:12px system-ui,sans-serif;max-height:36%;overflow-y:auto;touch-action:pan-y;z-index:2}
#armInfo h3{margin:0 0 4px;font-size:15px;color:#fff}#armInfo div{display:flex;gap:8px}#armInfo i{font-style:normal;opacity:.65;min-width:96px}#armInfo .nota{display:block;margin-top:5px;opacity:.78;font-size:11px}
#armBtns{position:absolute;right:calc(10px + var(--sr));bottom:calc(10px + var(--sb));display:flex;gap:8px;z-index:2}#armBtns .b{height:48px}#armProva{background:rgba(190,30,30,.62)}
#armLic{position:absolute;left:calc(10px + var(--sl));right:calc(10px + var(--sr));top:calc(54px + var(--st));bottom:calc(10px + var(--sb));background:rgba(12,14,17,.95);color:#e4e4e4;border-radius:12px;padding:10px 14px;overflow-y:auto;font:12px/1.45 system-ui,sans-serif;z-index:3;touch-action:pan-y}
#armLic h3{margin:0 0 6px;font-size:16px;color:#fff}#armLic h4{margin:10px 0 3px;font-size:13px;color:#e0b040}#armLic p{margin:3px 0}#armLic ul{margin:3px 0;padding-left:18px}#armLic li{margin:3px 0}#armLic pre{white-space:pre-wrap;font:10.5px/1.35 ui-monospace,monospace;opacity:.8;margin:6px 0}#armLicX{position:sticky;top:0;float:right;height:34px}#armLic a{color:#8fc3ff;text-decoration:underline}
#armList *,#armInfo *,#armLic *,#pp,#pp *{touch-action:pan-y}#armCat *{touch-action:pan-x}
#armCred{position:absolute;left:44%;right:calc(330px + var(--sr));bottom:calc(14px + var(--sb));color:#fff;opacity:.6;font:10px system-ui,sans-serif;pointer-events:none}
@media (orientation:portrait){#armCat{left:0;right:0;width:auto;flex-wrap:nowrap;overflow-x:auto;padding:0 calc(8px + var(--sr)) 2px calc(8px + var(--sl));scrollbar-width:none}#armCat::-webkit-scrollbar{display:none}#armCat .b{height:32px;font-size:12px}#armList{top:auto;height:31%;width:auto;right:8px}#armView{left:0;top:100px;bottom:52%}#armInfo{left:8px;right:8px;width:auto;bottom:calc(31% + 70px);max-height:17%}#armBtns{bottom:calc(31% + 14px)}#armCred{display:none}}
</style>''')
rep('<div id="sub"></div>', '''<div id="sub"></div>
<div id="mirino"><i class="a"></i><i class="bb"></i><i class="c"></i><i class="d"></i><i class="p"></i></div>
<button class="b" id="bspara">SPARA</button><button class="b" id="bmira">MIRA</button><button class="b" id="bricarica">RICARICA</button>
<div class="chip" id="colpi"></div><button class="b" id="barmi" title="Armeria">ARMI</button>
<div id="arm" hidden><div id="armTop"><b>Armeria</b><button class="b s" id="armZoom">Dettagli</button><button class="b s" id="armCrediti">Crediti</button><button class="b s" id="armChiudi">Chiudi</button></div><div id="armCat"></div><div id="armList"></div><div id="armView"></div><div id="armHint">Un dito: gira · due dita: ingrandisci e sposta · doppio tocco: zoom</div><div id="armInfo"></div><div id="armBtns"><button class="b" id="armProva">Prova sparo</button><button class="b" id="armRiponi">Riponi</button><button class="b" id="armPrendi">Prendi</button></div><div id="armCred">Armi, produttori e scritte sono di fantasia. Fonti dei modelli e dei suoni: «Crediti».</div><div id="armLic" hidden><button class="b s" id="armLicX">Chiudi</button><div></div></div></div>''')
rep('<div id="hud">', '<div id="hud"><div id="ottica" hidden><i class="oh"></i><i class="ov"></i><i class="ol"></i><i class="or"></i><i class="ob"></i><i class="op"></i></div>')
# modulo delle armi (catalogo incluso) prima del ciclo di gioco
import base64 as _b64, glob as _glob
_snd = {_os.path.basename(f)[:-4]: _b64.b64encode(open(f, 'rb').read()).decode('ascii') for f in sorted(_glob.glob(D + 'pub/armi/suoni2/*.mp3'))}
_mod = open(_A + 'armi_gioco.js', encoding='utf-8').read().replace('/*@ARMCAT@*/[]', _json.dumps(_cat, ensure_ascii=False, separators=(',', ':'))).replace('/*@ARMSND@*/{}', _json.dumps(_snd, separators=(',', ':')))
print('armi: suoni nella pagina', len(_snd), 'byte', sum(len(v) for v in _snd.values()))
rep('/* Ciclo di gioco */', _mod + '\n/* Ciclo di gioco */')
# passo: dopo la telecamera
rep(' placeCam(dt);\n', ' placeCam(dt);armStep(dt);\n')
# telecamera a piedi: più vicina e spostata a destra con l'arma; campo più stretto mirando; piano vicino ridotto in prima persona armata
rep('d=clipDist(P.x,P.z,-dx,-dz,4.5);cam.position.set(P.x-dx*d,P.y+1.5-dy*d,P.z-dz*d)', 'const aK=armCamK();d=clipDist(P.x,P.z,-dx,-dz,aK.d);cam.position.set(P.x-dx*d+aK.sx,P.y+aK.h-dy*d,P.z-dz*d+aK.sz)')
rep('if(Math.abs(cam.fov-65)>.05){cam.fov+=(65-cam.fov)*Math.min(1,dt*6);cam.updateProjectionMatrix()}', '{const fv=armFov();if(Math.abs(cam.fov-fv)>.05){cam.fov+=(fv-cam.fov)*Math.min(1,dt*6);cam.updateProjectionMatrix()}}')
rep('const nr=inCar&&view&&view!==3?.1:.35;', 'const nr=inCar&&view&&view!==3?.1:(!inCar&&fp&&ARM.cur?.04:.35);')
# ciclo dei fotogrammi: con l'armeria aperta il mondo si ferma e si disegna la vetrina
rep('step(dt*CINE.step(dt));R.render(sc,cam)}', 'if(ARM.open){armView(dt)}else{step(dt*CINE.step(dt));R.render(sc,cam)}}')
# avvio
rep('ambInit();pdInit();', 'ambInit();pdInit();armInit();')
# esportazione per i collaudi
rep('window.__iow={R,AMBCFG,', 'window.__iow={ARM,ARMCAT,ARMGLB,GLBC,ARMV,AFX,ASND,armEquip,armUnequip,armShoot,armRay,armReload,armOpen,armClose,armSelect,armStep,armView,armBuild,armPose,armIK,armSnd,armBallistic,get yaw(){return yaw},set yaw(v){yaw=v},get pitch(){return pitch},set pitch(v){pitch=v},get fp(){return fp},set fp(v){fp=v},get inCar(){return inCar},R,AMBCFG,')

# radio della polizia: se il sospetto è a piedi (con un'arma) non parla di "veicolo berlina rossa"
rep("ctx.desc=ctx.desc||'berlina rossa';", "ctx.desc=ctx.desc||(PD.T&&PD.T.car===false?'a piedi, armato':'berlina rossa');")
rep("const itFix=t=>t.replace(/\\b([Aa]) (A[a-z])/g,'$1d $2')", "const itFix=t=>t.replace(/(veicolo|vettura) a piedi, armato/g,'sospetto a piedi, armato').replace(/\\b([Aa]) (A[a-z])/g,'$1d $2')")
print('armi: file dei modelli', ARMI_FILES)
