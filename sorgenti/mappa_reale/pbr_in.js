/* ---------- Versione 28: materiali PBR con texture fotografiche vere (Poly Haven e ambientCG, licenza CC0) ----------
   Le texture stanno nella cartella tex/ del sito (preparate da tools/texture/prepara_texture.py; fonti in tex/manifest.json).
   Ogni materiale ha due versioni: quella con le texture vere (PBR) e quella disegnata nel codice (se le texture non arrivano).
   Strade, terreno e calcestruzzo usano coordinate del mondo (la trama non si stira e non ha giunte fra le celle). */
const UNI={uNight:{value:0},uWet:{value:0},uTime:{value:0}};
// segnaletica orizzontale come strato trasparente sopra l'asfalto vero (stesse colonne dell'atlante ROADTX)
const ROADOV=(()=>{const c=cv(1536,512,(x)=>{x.clearRect(0,0,1536,512);
  const edge=c=>{const g=x.createLinearGradient(c*128,0,c*128+10,0);g.addColorStop(0,'rgba(20,20,20,.38)');g.addColorStop(1,'rgba(20,20,20,0)');x.fillStyle=g;x.fillRect(c*128,0,10,512);const g2=x.createLinearGradient(c*128+128,0,c*128+118,0);g2.addColorStop(0,'rgba(20,20,20,.38)');g2.addColorStop(1,'rgba(20,20,20,0)');x.fillStyle=g2;x.fillRect(c*128+118,0,10,512)};
  const wear=(c,us)=>{for(const u of us){const g=x.createLinearGradient(c*128+u-9,0,c*128+u+9,0);g.addColorStop(0,'rgba(15,15,16,0)');g.addColorStop(.5,'rgba(15,15,16,.16)');g.addColorStop(1,'rgba(15,15,16,0)');x.fillStyle=g;x.fillRect(c*128+u-9,0,18,512)}};
  const paint=(c,u,w,from,len)=>{x.fillStyle='rgba(236,235,226,.93)';for(let y=from;y<512;y+=512)x.fillRect(c*128+u,y,w,len);x.fillStyle='rgba(0,0,0,.06)';for(let i=0;i<60;i++){x.fillRect(c*128+u+Math.random()*w,from+Math.random()*Math.min(len,512),1.5,2)}};
  for(const c of [0,1,2,7,8,9])edge(c);
  wear(0,[30,52,76,98]);wear(1,[22,44,84,106]);wear(2,[20,38,58,72,92,110]);
  paint(1,8,4,0,512);paint(1,116,4,0,512);paint(1,62,4,0,230);
  paint(2,6,5,0,512);paint(2,117,5,0,512);paint(2,45,3,0,230);paint(2,80,3,0,230);
  // 4 sterrato: solchi delle ruote; 5 massicciata: traversine e rotaie; 8 strisce pedonali; 9 binari del tram; 10 bianco pieno
  {const X=512;x.fillStyle='rgba(55,42,28,.30)';x.fillRect(X+22,0,18,512);x.fillRect(X+88,0,18,512)}
  {const X=640;for(let y=0;y<512;y+=31){x.fillStyle='rgba(84,70,56,.96)';x.fillRect(X+14,y,100,12);x.fillStyle='rgba(0,0,0,.25)';x.fillRect(X+14,y+10,100,2)}x.fillStyle='rgba(150,154,160,1)';x.fillRect(X+36,0,6,512);x.fillRect(X+86,0,6,512);x.fillStyle='rgba(215,218,222,1)';x.fillRect(X+37,0,2,512);x.fillRect(X+87,0,2,512)}
  x.fillStyle='rgba(234,233,224,.95)';for(let i=0;i<128;i+=32)x.fillRect(8*128+i+2,0,16,512);
  x.fillStyle='rgba(175,178,182,1)';x.fillRect(9*128+22,0,8,512);x.fillRect(9*128+98,0,8,512);x.fillStyle='rgba(60,60,62,1)';x.fillRect(9*128+30,0,3,512);x.fillRect(9*128+95,0,3,512);
  x.fillStyle='rgba(234,233,224,.97)';x.fillRect(10*128,0,128,512)});
 return tex(c,false,true)})();
// piscina di luce sotto i lampioni (di notte), alone dei fari
const POOLTX=(()=>{const c=cv(128,128,(x)=>{const g=x.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.35,'rgba(255,255,255,.55)');g.addColorStop(.7,'rgba(255,255,255,.14)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,128,128)});const t=new T.CanvasTexture(c);return t})();
// normali delle onde dell'acqua (rumore ripetibile → altezza → normale)
const WAVETX=(()=>{const N=256,c=document.createElement('canvas');c.width=c.height=N;const x=c.getContext('2d'),im=x.createImageData(N,N),d=im.data,h=new Float32Array(N*N);
 for(let j=0;j<N;j++)for(let i=0;i<N;i++)h[j*N+i]=NZ(i,j,4,64)*.6+NZ(i+40,j+90,3,16)*.4;
 for(let j=0;j<N;j++)for(let i=0;i<N;i++){const l=h[j*N+((i+N-1)%N)],r=h[j*N+((i+1)%N)],u=h[((j+N-1)%N)*N+i],w=h[((j+1)%N)*N+i];let nx=(l-r)*6,ny=(w-u)*6;const L=Math.hypot(nx,ny,1);const p=(j*N+i)*4;d[p]=(nx/L*.5+.5)*255;d[p+1]=(ny/L*.5+.5)*255;d[p+2]=(1/L*.5+.5)*255;d[p+3]=255}
 x.putImageData(im,0,0);const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;return t})();
const PBR=(()=>{
 const base=Q.get('tex')||'tex/',TX={},st={n:0,tot:0,err:0,state:'attesa',ms:0},ok={v:false},GL2=!!R.capabilities.isWebGL2,ANI=Math.min(8,R.capabilities.getMaxAnisotropy());
 const FILES=[['asfalto','c'],['asfalto','n'],['porfido','c'],['porfido','n'],['lastre','c'],['lastre','n'],['sterrato','c'],['sterrato','n'],['ghiaia','c'],['ghiaia','n'],['erba','c'],['erba','n'],['roccia','c'],['roccia','n'],['terra','c'],['terra','n'],['tetto','c'],['tetto','n'],['muri','c'],['muri','n'],['cemento','c'],['cemento','n'],['muretto','c'],['muretto','n']];
 // funzioni GLSL comuni: normale impacchettata (xy + rugosità in b), perturbazione con coordinate qualsiasi
 const GLF=`
uniform float uNight;uniform float uWet;uniform float uTime;varying vec3 vWP;
vec3 pbrN(vec4 t){vec2 xy=t.xy*2.0-1.0;return vec3(xy,sqrt(max(0.0,1.0-dot(xy,xy))));}
vec3 pbrPert(vec3 eye_pos,vec3 surf_norm,vec3 mapN,vec2 uv){vec3 q0=dFdx(eye_pos),q1=dFdy(eye_pos);vec2 st0=dFdx(uv),st1=dFdy(uv);float sc=sign(st1.t*st0.s-st0.t*st1.s);sc=sc==0.0?1.0:sc;vec3 S=(q0*st1.t-q1*st0.t)*sc,Tt=(-q0*st1.s+q1*st0.s)*sc;vec3 N=normalize(surf_norm);if(dot(S,S)<1e-12||dot(Tt,Tt)<1e-12)return N;S=normalize(S);Tt=normalize(Tt);mapN.xy*=(float(gl_FrontFacing)*2.0-1.0);return normalize(mat3(S,Tt,N)*mapN);}
`;
 const VWP=sh=>{sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWP;varying vec3 vWN;').replace('#include <begin_vertex>','#include <begin_vertex>\nvWP=(modelMatrix*vec4(transformed,1.0)).xyz;vWN=normalize(mat3(modelMatrix)*objectNormal);')};
 const UN=sh=>{sh.uniforms.uNight=UNI.uNight;sh.uniforms.uWet=UNI.uWet;sh.uniforms.uTime=UNI.uTime};
 const MATS=[];
 // aggancia a un materiale una versione PBR (usata quando le texture sono arrivate) conservando quella disegnata
 function patch(m,key,pbr,setup){const old=m.onBeforeCompile;m.onBeforeCompile=(sh,r)=>{if(ok.v){UN(sh);pbr(sh)}else if(old)old.call(m,sh,r)};m.customProgramCacheKey=()=>key+(ok.v?'#P':'#F');MATS.push({m,setup})}
 // ---- terreno: erba, roccia, terra, lastricato (pesi per vertice), tinta relativa dai colori dei vertici, neve dai colori chiari
 patch(MTR.ter,'ter',sh=>{Object.assign(sh.uniforms,{tR:{value:TX.roccia.c},tRn:{value:TX.roccia.n},tD:{value:TX.terra.c},tDn:{value:TX.terra.n},tP:{value:TX.lastre.c}});
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute vec4 tw;varying vec4 vTw;varying vec3 vWP;').replace('#include <begin_vertex>','#include <begin_vertex>\nvTw=tw;vWP=(modelMatrix*vec4(transformed,1.0)).xyz;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D tR;uniform sampler2D tRn;uniform sampler2D tD;uniform sampler2D tDn;uniform sampler2D tP;varying vec4 vTw;'+GLF)
   .replace('#include <map_fragment>',`vec2 wp=vWP.xz;vec4 g1=texture2D(map,wp*.1667),g2=texture2D(map,wp*.043+vec2(.31,.17));
    vec3 cg=mix(mapTexelToLinear(g1).rgb,mapTexelToLinear(g2).rgb,.4),cr=mapTexelToLinear(texture2D(tR,wp*.25)).rgb,cd=mapTexelToLinear(texture2D(tD,wp*.333)).rgb,cp=mapTexelToLinear(texture2D(tP,wp*.333)).rgb;
    vec3 tint=clamp(vColor/vec3(.163,.234,.073),vec3(.25),vec3(2.4));float sn=smoothstep(.42,.7,min(vColor.r,min(vColor.g,vColor.b)));float mac=.8+.4*texture2D(map,wp*.0087+vec2(.5,.2)).g;
    vec3 alb=(cg*mix(vec3(1.),tint,.8)*vTw.x+cr*vTw.y+cd*mix(vec3(1.),tint,.3)*vTw.z+cp*vTw.w)*mac;alb=mix(alb,vec3(.86,.88,.91),sn);diffuseColor.rgb*=alb;
    vec4 n1=texture2D(normalMap,wp*.1667),n2=texture2D(tRn,wp*.25),n3=texture2D(tDn,wp*.333);float wg=vTw.x+vTw.w;
    vec3 pbrNrm=normalize(pbrN(n1)*wg+pbrN(n2)*vTw.y+pbrN(n3)*vTw.z+vec3(0.,0.,.001));pbrNrm=normalize(mix(pbrNrm,vec3(0.,0.,1.),sn*.7));float pbrRough=clamp(n1.b*wg+n2.b*vTw.y+n3.b*vTw.z,.35,1.);`)
   .replace('#include <color_fragment>','').replace('#include <roughnessmap_fragment>','float roughnessFactor=pbrRough;')
   .replace('#include <normal_fragment_maps>','normal=pbrPert(-vViewPosition,normal,pbrNrm,wp);')},
  m=>{m.map=TX.erba.c;m.normalMap=TX.erba.n;m.roughness=1;m.metalness=0});
 // ---- strade: base vera in coordinate del mondo (o allineata alla strada per i marciapiedi) + segnaletica dall'atlante trasparente
 function roadMat(key,b,scale,tint,aligned,polyF){const m=new T.MeshStandardMaterial({map:ROADTX,roughness:.9,metalness:0,polygonOffset:true,polygonOffsetFactor:polyF||-2,polygonOffsetUnits:polyF||-2,envMapIntensity:.6});
  patch(m,'rd_'+key,sh=>{sh.uniforms.tB={value:TX[b].c};VWP(sh);
   sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D tB;'+GLF)
    .replace('#include <map_fragment>',`vec2 wp=${aligned?'vec2((vUv.x*12.0-6.0)*.733,vUv.y)':'vWP.xz*'+(1/scale).toFixed(5)};vec4 ov=texture2D(map,vUv),bt=texture2D(tB,wp),bn=texture2D(normalMap,wp);
     vec3 bc=mapTexelToLinear(bt).rgb*${tint};${b==='asfalto'?'bc*=abs(floor(vUv.x*12.0)-7.0)<.5?1.28:1.0;':''}
     float wet=uWet*(.5+.5*smoothstep(.35,.65,texture2D(tB,wp*.11).g));bc*=1.0-.4*wet;
     diffuseColor.rgb*=mix(bc,mapTexelToLinear(ov).rgb,ov.a);vec3 pbrNrm=pbrN(bn);pbrNrm.xy*=(1.0-ov.a*.8)*(1.0-wet*.7);float pbrRough=mix(bn.b,.55,ov.a)*(1.0-.8*wet);`)
    .replace('#include <roughnessmap_fragment>','float roughnessFactor=max(pbrRough,.04);')
    .replace('#include <normal_fragment_maps>','normal=pbrPert(-vViewPosition,normal,pbrNrm,wp);')},
   m2=>{m2.map=ROADOV;m2.normalMap=TX[b].n;m2.roughness=1});
  return m}
 const RMAT={R:MTR.road,Rst:roadMat('st','porfido',2,'1.0',false),Rdi:roadMat('di','sterrato',2.2,'vec3(1.0,.97,.92)',false),Rba:roadMat('ba','ghiaia',2,'.85',false),Rsw:roadMat('sw','lastre',3,'1.02',true,-3)};
 // la carreggiata in asfalto usa il materiale già esistente (così le celle già costruite cambiano insieme)
 {const m=MTR.road;patch(m,'rd_asf',sh=>{sh.uniforms.tB={value:TX.asfalto.c};VWP(sh);
   sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D tB;'+GLF)
    .replace('#include <map_fragment>',`vec2 wp=vWP.xz*.2222,wq=mat2(.8253,.5646,-.5646,.8253)*vWP.xz*.1371+vec2(.37,.61);float mk=smoothstep(.3,.7,texture2D(tB,vWP.xz*.0123).r);
     vec4 ov=texture2D(map,vUv),bt=mix(texture2D(tB,wp),texture2D(tB,wq),mk),bn=mix(texture2D(normalMap,wp),texture2D(normalMap,wq),mk);
     vec3 bc=mapTexelToLinear(bt).rgb*(abs(floor(vUv.x*12.0)-7.0)<.5?1.28:1.0)*(.9+.2*texture2D(tB,vWP.xz*.0071).g);
     float wet=uWet*(.5+.5*smoothstep(.35,.65,texture2D(tB,wp*.11).g));bc*=1.0-.4*wet;
     diffuseColor.rgb*=mix(bc,mapTexelToLinear(ov).rgb,ov.a);vec3 pbrNrm=pbrN(bn);pbrNrm.xy*=(1.0-ov.a*.8)*(1.0-wet*.7);float pbrRough=mix(bn.b,.55,ov.a)*(1.0-.8*wet);`)
    .replace('#include <roughnessmap_fragment>','float roughnessFactor=max(pbrRough,.04);')
    .replace('#include <normal_fragment_maps>','normal=pbrPert(-vViewPosition,normal,pbrNrm,wp);')},
   m2=>{m2.map=ROADOV;m2.normalMap=TX.asfalto.n;m2.roughness=1})}
 // ---- facciate: atlante delle bande (finestre, portoni, cornici: colore + alfa = muro/rugosità) e atlante 2×2 dei muri veri
 patch(MTR.fac,'fac',sh=>{Object.assign(sh.uniforms,{tW:{value:TX.muri.c},tWn:{value:TX.muri.n}});VWP(sh);
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D tW;uniform sampler2D tWn;varying vec3 vWN;'+GLF+
   `vec4 wallT(sampler2D t,vec2 w,vec2 off){vec2 a=fract(w)*.49+off+.005;${GL2?'return textureGrad(t,a,dFdx(w*.49),dFdy(w*.49));':'return texture2D(t,a);'}}`)
   .replace('#include <map_fragment>',`vec4 at=texture2D(map,vUv);float bnd=floor((1.0-vUv.y)*18.0-.001);
    float wm=(bnd>12.5&&bnd<13.5)?2.0:((bnd>13.5&&bnd<14.5)||(bnd>16.5)?1.0:((bnd>5.5&&bnd<10.5)?3.0:0.0));
    vec2 off=wm<.5?vec2(0.,.5):(wm<1.5?vec2(.5,.5):(wm<2.5?vec2(0.,0.):vec2(.5,0.)));vec2 ww=vec2(vUv.x*1.5,vWP.y*.5);
    vec4 wc=wallT(tW,ww,off),wn=wallT(tWn,ww,off);float wallness=smoothstep(.88,.97,at.a);
    vec3 tW2=wm<.5?vColor*1.3:(wm<1.5?mix(vec3(1.),vColor*1.5,.2):(wm<2.5?mix(vec3(1.),vColor*1.45,.4):vColor*1.3));
    diffuseColor.rgb*=mix(mapTexelToLinear(at).rgb*vColor,mapTexelToLinear(wc).rgb*tW2,wallness);
    float fr=clamp(at.a/.86,0.,1.),glass=(1.0-smoothstep(.1,.22,fr))*(1.0-wallness);float pbrRough=mix(max(fr,.06),wn.b,wallness);vec3 wN=pbrN(wn);`)
   .replace('#include <color_fragment>','')
   .replace('#include <roughnessmap_fragment>','float roughnessFactor=pbrRough;')
   .replace('#include <metalnessmap_fragment>','float metalnessFactor=metalness+glass*.15;')
   .replace('#include <normal_fragment_maps>','vec3 nA=texture2D(normalMap,vUv).xyz*2.0-1.0;nA.xy*=normalScale;vec3 nC=normalize(vec3(nA.xy+wN.xy*wallness,nA.z));normal=pbrPert(-vViewPosition,normal,nC,vUv);')
   .replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
    {float bay=floor(vUv.x),fl=floor(vWP.y/3.2);float hh=fract(sin(dot(vec2(bay,fl)+floor(vWP.xz*.021)*7.0,vec2(12.9898,78.233)))*43758.5453);float shop=step(14.5,bnd)*step(bnd,15.5);
     float on=max(step(hh,.36),shop*step(hh,.8));float h2=fract(hh*7.13);vec3 wcol=mix(vec3(1.,.66,.36),vec3(.75,.82,1.),step(.85,h2));totalEmissiveRadiance+=wcol*glass*on*uNight*(.22+.38*fract(hh*13.7))*(1.0+shop*1.6);}`)},
  m=>{m.envMapIntensity=.9});
 // ---- tetti a falde: tegole vere
 patch(MTR.roof,'roof',sh=>{sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\n'+GLF)
   .replace('#include <color_fragment>','diffuseColor.rgb*=clamp(vColor/vec3(.448,.12,.059),vec3(.6),vec3(1.4));')
   .replace('#include <roughnessmap_fragment>','vec4 rn=texture2D(normalMap,vUv);float roughnessFactor=max(rn.b,.3);')
   .replace('#include <normal_fragment_maps>','vec3 mapN=pbrN(rn);mapN.xy*=normalScale;normal=pbrPert(-vViewPosition,normal,mapN,vUv);');
   sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWP;').replace('#include <begin_vertex>','#include <begin_vertex>\nvWP=(modelMatrix*vec4(transformed,1.0)).xyz;')},
  m=>{m.map=TX.tetto.c;m.normalMap=TX.tetto.n;m.roughness=1});
 // ---- calcestruzzo (ponti, gallerie, cordoli) e muretti a secco: proiezione dal mondo secondo la normale
 function triMat(key,b,scale,ref){const m=new T.MeshStandardMaterial({vertexColors:true,roughness:.9,metalness:0});
  patch(m,'tri_'+key,sh=>{VWP(sh);sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vWN;'+GLF)
    .replace('#include <map_fragment>',`vec3 an=abs(vWN);vec2 dr=normalize(vec2(-vWN.z,vWN.x)+vec2(1e-4,0.));vec2 wp=(an.y>.7?vWP.xz:vec2(dot(vWP.xz,dr),vWP.y))*${(1/scale).toFixed(4)};
     vec4 cc=texture2D(map,wp),cn=texture2D(normalMap,wp);diffuseColor.rgb*=mapTexelToLinear(cc).rgb*clamp(vColor/vec3(${ref}),vec3(.15),vec3(2.2));vec3 pbrNrm=pbrN(cn);float pbrRough=cn.b;`)
    .replace('#include <color_fragment>','').replace('#include <roughnessmap_fragment>','float roughnessFactor=pbrRough;')
    .replace('#include <normal_fragment_maps>','normal=pbrPert(-vViewPosition,normal,pbrNrm,wp);')},
   m2=>{m2.map=TX[b].c;m2.normalMap=TX[b].n;m2.roughness=1});
  return m}
 MTR.conc=triMat('conc','cemento',2,'.343,.330,.296');MTR.mur=triMat('mur','muretto',1.6,'.33,.31,.27');
 // ---- acqua, lampioni e auto: indipendenti dalle texture scaricate (sempre attivi)
 const always=(m,key,fn)=>{m.onBeforeCompile=sh=>{UN(sh);fn(sh)};m.customProgramCacheKey=()=>key};
 MTR.wat.normalMap=WAVETX;MTR.wat.roughness=.05;MTR.wat.envMapIntensity=1.8;
 always(MTR.wat,'wat2',sh=>{VWP(sh);sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vWN;'+GLF)
   .replace('#include <normal_fragment_maps>',`{vec2 wp=vWP.xz;vec3 a=texture2D(normalMap,wp*.031+vec2(uTime*.011,uTime*.007)).xyz*2.0-1.0,b=texture2D(normalMap,wp*.057-vec2(uTime*.009,-uTime*.013)).xyz*2.0-1.0;vec3 mn=normalize(vec3((a.xy+b.xy)*.55,1.0));normal=pbrPert(-vViewPosition,normal,mn,wp);}`)});
 // la lampada dei lampioni si accende di notte (le parti chiarissime della geometria)
 always(MTR.lamp,'lamp2',sh=>{sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform float uNight;').replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=vec3(1.,.82,.55)*step(.6,vColor.g)*uNight*4.0;')});
 // auto (parcheggiate e traffico): fari e fanali accesi di notte (attributo lgt: 1 fari, 2 fanali)
 always(MTR.car,'car2',sh=>{sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute float lgt;varying float vLgt;').replace('#include <begin_vertex>','#include <begin_vertex>\nvLgt=lgt;');
   sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform float uNight;varying float vLgt;')
    .replace('#include <color_fragment>','#include <color_fragment>\nif(vLgt>.5)diffuseColor.rgb=vLgt<1.5?vec3(.9,.9,.82):vec3(.55,.03,.02);')
    .replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\nif(vLgt>.5)totalEmissiveRadiance+=(vLgt<1.5?vec3(1.,.95,.8)*3.5:vec3(1.,.05,.03)*2.2)*uNight;')});
 const all=()=>{for(const q of MATS){q.setup(q.m);q.m.needsUpdate=true}};
 function load(){st.state='carico';st.t0=performance.now();const L=new T.TextureLoader();L.setCrossOrigin('anonymous');
  const list=FILES.map(([k,s])=>[k,s,base+k+'_'+s+'.jpg']).concat([['ciuffi','a',base+'ciuffi.png'],['env','citta',base+'ambiente_citta.jpg'],['env','campagna',base+'ambiente_campagna.jpg']]);st.tot=list.length;
  return new Promise(res=>{let left=list.length;const fin=()=>{if(--left)return;st.ms=Math.round(performance.now()-st.t0);
    const need=FILES.every(([k,s])=>TX[k]&&TX[k][s]);if(need){ok.v=true;st.state='pronte';all()}else st.state='mancanti';res(ok.v)};
   for(const [k,s,u] of list)L.load(u,t=>{const col=s==='c'||s==='a'||k==='env';t.encoding=col?T.sRGBEncoding:T.LinearEncoding;t.anisotropy=k==='env'?1:ANI;
     if(k==='muri'||k==='ciuffi'){t.wrapS=t.wrapT=T.ClampToEdgeWrapping}else if(k!=='env'){t.wrapS=t.wrapT=T.RepeatWrapping}
     if(k==='env'){t.mapping=T.EquirectangularReflectionMapping}(TX[k]||(TX[k]={}))[s]=t;st.n++;fin()},undefined,()=>{st.err++;fin()})})}
 return{st,ok,TX,load,RMAT,GL2,GLF,patch}})();
// fogliame (disegnato qui, ripetibile): siepi e dettaglio delle chiome
const LEAFTX=(()=>{const N=256,c=document.createElement('canvas');c.width=c.height=N;const x=c.getContext('2d');x.fillStyle='#2f4a22';x.fillRect(0,0,N,N);
 for(let i=0;i<2600;i++){const px=rnd()*N,py=rnd()*N,r=2+rnd()*5,a=rnd()*6.28,g=60+rnd()*90|0,cl='rgb('+(g*.45|0)+','+g+','+(g*.32|0)+')';for(const ox of [-N,0,N])for(const oy of [-N,0,N]){if(px+ox<-12||px+ox>N+12||py+oy<-12||py+oy>N+12)continue;x.save();x.translate(px+ox,py+oy);x.rotate(a);x.fillStyle='rgba(0,0,0,.35)';x.beginPath();x.ellipse(1,1.5,r,r*.55,0,0,6.283);x.fill();x.fillStyle=cl;x.beginPath();x.ellipse(0,0,r,r*.55,0,0,6.283);x.fill();x.restore()}}
 const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;t.encoding=T.sRGBEncoding;t.anisotropy=4;return t})();
MTR.siepe=new T.MeshStandardMaterial({vertexColors:true,map:LEAFTX,roughness:.88,metalness:0});
MTR.siepe.onBeforeCompile=sh=>{sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWP2;varying vec3 vWN2;').replace('#include <begin_vertex>','#include <begin_vertex>\nvWP2=(modelMatrix*vec4(transformed,1.0)).xyz;vWN2=normalize(mat3(modelMatrix)*objectNormal);');
 sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vWP2;varying vec3 vWN2;').replace('#include <map_fragment>','vec3 an=abs(vWN2);vec2 dr=normalize(vec2(-vWN2.z,vWN2.x)+vec2(1e-4,0.));vec2 lw=(an.y>.7?vWP2.xz:vec2(dot(vWP2.xz,dr),vWP2.y))*.9;vec3 lf=mapTexelToLinear(texture2D(map,lw)).rgb;diffuseColor.rgb*=lf/vec3(.03,.075,.018);')};
MTR.siepe.customProgramCacheKey=()=>'siepe';
MTR.tree.map=LEAFTX;MTR.tree.onBeforeCompile=sh=>{sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vOP;varying vec3 vON;').replace('#include <begin_vertex>','#include <begin_vertex>\nvOP=transformed;vON=objectNormal;');
 sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vOP;varying vec3 vON;').replace('#include <map_fragment>','vec3 an=abs(normalize(vON));vec2 lw=(an.y>.6?vOP.xz:vec2(vOP.x+vOP.z,vOP.y))*1.3;float lu=dot(mapTexelToLinear(texture2D(map,lw)).rgb,vec3(.3,.59,.11));diffuseColor.rgb*=clamp(lu/.06,.35,1.8);')};
MTR.tree.customProgramCacheKey=()=>'albero';
// ---- erba fitta: ciuffi vicino al giocatore (carte incrociate con trasparenza; texture dal modello CC0 grass_medium_01 di Poly Haven)
const ERBA=(()=>{const MAXN=5200;let im=null,last=[1e9,1e9],gen=-1,cnt=0;
 const geo=(()=>{const P=[],U=[],Nn=[],I=[];const q=(ax,az)=>{const b=P.length/3;P.push(-ax*.6,0,-az*.6,ax*.6,0,az*.6,ax*.6,.66,az*.6,-ax*.6,.66,-az*.6);U.push(.005,0,.245,0,.245,1,.005,1);for(let i=0;i<4;i++)Nn.push(0,1,0);I.push(b,b+1,b+2,b,b+2,b+3)};q(1,0);q(-.5,.866);q(-.5,-.866);
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(P,3));g.setAttribute('uv',new T.Float32BufferAttribute(U,2));g.setAttribute('normal',new T.Float32BufferAttribute(Nn,3));g.setIndex(I);return g})();
 const vari=new T.InstancedBufferAttribute(new Float32Array(MAXN),1);geo.setAttribute('vari',vari);
 const mat=new T.MeshStandardMaterial({alphaTest:.45,side:T.DoubleSide,roughness:.95,metalness:0,color:new T.Color(.92,.95,.85)});
 mat.onBeforeCompile=sh=>{sh.uniforms.uTime=UNI.uTime;sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute float vari;uniform float uTime;')
   .replace('#include <uv_vertex>','#include <uv_vertex>\nvUv.x+=vari*.25;')
   .replace('#include <begin_vertex>','#include <begin_vertex>\nvec4 ip=modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.);float wd=sin(uTime*1.7+ip.x*.31+ip.z*.23)*.09*position.y;transformed.x+=wd;transformed.z+=wd*.6;transformed*=1.0-smoothstep(46.,64.,distance(cameraPosition,ip.xyz));')};
 mat.customProgramCacheKey=()=>'erba';
 const ALLOW={6:1,3:1,0:.65,5:.3,12:.5,4:.35,10:.6};
 function update(px,pz){if(!PBR.ok.v||!PBR.TX.ciuffi)return;if(!im){mat.map=PBR.TX.ciuffi.a;im=new T.InstancedMesh(geo,mat,MAXN);im.frustumCulled=false;im.count=0;im.castShadow=false;im.receiveShadow=true;sc.add(im)}
  if(gen===GEN&&Math.hypot(px-last[0],pz-last[1])<18)return;gen=GEN;last=[px,pz];let n=0;const st=1.55,R2=66,x0=Math.floor((px-R2)/st),x1=Math.floor((px+R2)/st),z0=Math.floor((pz-R2)/st),z1=Math.floor((pz+R2)/st);
  for(let gz=z0;gz<=z1;gz++)for(let gx=x0;gx<=x1;gx++){const h1=Math.sin(gx*127.1+gz*311.7)*43758.5453,f1=h1-Math.floor(h1),h2=Math.sin(gx*269.5+gz*183.3)*43758.5453,f2=h2-Math.floor(h2),x=(gx+f1)*st,z=(gz+f2)*st;if((x-px)**2+(z-pz)**2>R2*R2)continue;
   const c=cellAt(x,z);if(!c||c.lod!=='A'||!c.cls)continue;const u=c.X-x,v=c.Z-z;if(u<0||v<0||u>=c.S||v>=c.S)continue;const cl=c.cls[Math.min(c.CR-1,Math.floor(v/c.S*c.CR))*c.CR+Math.min(c.CR-1,Math.floor(u/c.S*c.CR))];let pr=ALLOW[cl];if(!pr)continue;if(cl===0&&((c.urb||0)>.15||(c.dens||0)>.12))continue;
   const h3=Math.sin(gx*41.3+gz*97.1)*9137.31,f3=h3-Math.floor(h3);if(f3>pr)continue;if(c.GM){const gi=Math.min(c.GMN-1,Math.floor(v/c.S*c.GMN))*c.GMN+Math.min(c.GMN-1,Math.floor(u/c.S*c.GMN));if(c.GM[gi])continue}else if(c.RH){const ri=Math.min(c.RHN-1,Math.floor(v/c.S*c.RHN))*c.RHN+Math.min(c.RHN-1,Math.floor(u/c.S*c.RHN));if(c.RH[ri]===c.RH[ri])continue}
   if(c.wm){const wi=Math.min(c.WM-1,Math.floor(v/c.S*c.WM))*c.WM+Math.min(c.WM-1,Math.floor(u/c.S*c.WM));if(c.wm[wi])continue}
   const y=terrainH(x,z);if(!(y===y))continue;const s=.55+f1*.4;_v.set(x,y-.03,z);_q.setFromAxisAngle(_y,f2*6.283);_s.set(s,s*(.7+f3*.4),s);_m4.compose(_v,_q,_s);im.setMatrixAt(n,_m4);vari.array[n]=Math.floor(f3*4)%4;if(++n>=MAXN)break}
  im.count=n;cnt=n;im.instanceMatrix.needsUpdate=true;vari.needsUpdate=true}
 return{update,get n(){return cnt}}})();
// geometria delle auto: marca i vertici dei fari (1) e dei fanali (2) per accenderli di notte
{const c=CARG.attributes.color.array,n=c.length/3,a=new Float32Array(n);for(let i=0;i<n;i++){const r=c[i*3],g=c[i*3+1],b=c[i*3+2];if(r>.99&&g>.99&&Math.abs(b-.85)<.01)a[i]=1;else if(Math.abs(r-.9)<.01&&g<.1&&b<.1)a[i]=2}CARG.setAttribute('lgt',new T.BufferAttribute(a,1))}
