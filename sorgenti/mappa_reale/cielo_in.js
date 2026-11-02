/* ---------- Versione 28: cielo vero e ciclo giorno/notte ----------
   Il sole sta dove sta davvero: posizione astronomica calcolata dalla data, dall'ora e dal punto (latitudine/longitudine)
   in cui si trova il giocatore. Modalità: ora reale (predefinita), giorno, tramonto, notte, giorno e notte veloci (24 minuti).
   Di notte si accendono lampioni (con la pozza di luce sulla strada), finestre, vetrine, fari e fanali delle auto. */
const CIELO=(()=>{
 const MODES=['reale','giorno','tramonto','notte','veloce'],NAMES={reale:'Ora reale (il sole vero di adesso)',giorno:'Sempre giorno',tramonto:'Tramonto',notte:'Notte',veloce:'Giorno e notte veloci (un giorno in 24 minuti)'};
 let mode='reale';try{const m=localStorage.getItem('iow_ora');if(MODES.includes(m))mode=m}catch(e){}
 {const q=Q.get('ora');if(q&&MODES.includes(q))mode=q}
 const QH=Q.get('ore')!==null&&isFinite(+Q.get('ore'))?+Q.get('ore'):null;let fast0=Date.now();
 // posizione del Sole (formule semplificate dell'almanacco nautico, errore inferiore a 1°): [altezza, azimut da nord verso est] in radianti
 function sunAt(date,lat,lon){const d=date.getTime()/86400000-10957.5,g=(357.529+.98560028*d)*PI/180,q=280.459+.98564736*d,L=(q+1.915*Math.sin(g)+.02*Math.sin(2*g))*PI/180,e=(23.439-3.6e-7*d)*PI/180;
  const ra=Math.atan2(Math.cos(e)*Math.sin(L),Math.cos(L)),dec=Math.asin(Math.sin(e)*Math.sin(L)),gm=((18.697374558+24.06570982441908*d)%24+24)%24,ha=(gm*15+lon)*PI/180-ra,la=lat*PI/180;
  const alt=Math.asin(Math.sin(la)*Math.sin(dec)+Math.cos(la)*Math.cos(dec)*Math.cos(ha)),az=Math.atan2(-Math.sin(ha),Math.tan(dec)*Math.cos(la)-Math.sin(la)*Math.cos(ha));return[alt,az]}
 const atHour=h=>{const d=new Date();d.setHours(Math.floor(h),Math.round((h%1)*60),0,0);return d};
 let tramH=null;
 function when(lat,lon){if(QH!==null)return atHour(QH);
  if(mode==='giorno')return atHour(13.5);if(mode==='notte')return atHour(23.2);
  if(mode==='tramonto'){if(tramH===null){let best=19,bd=9;for(let h=15;h<22;h+=1/12){const a=sunAt(atHour(h),lat,lon)[0]*180/PI;if(Math.abs(a-3.5)<bd){bd=Math.abs(a-3.5);best=h}}tramH=best}return atHour(tramH)}
  if(mode==='veloce')return new Date(fast0+(Date.now()-fast0)*60);return new Date()}
 // colori del cielo per altezza del sole (gradi): zenit, orizzonte, sole (lineari)
 const KF=[[-18,[.0015,.002,.006],[.004,.005,.011],[.3,.35,.5]],[-9,[.004,.006,.02],[.02,.022,.04],[.5,.3,.25]],[-4,[.012,.02,.065],[.19,.10,.085],[1,.35,.15]],[0,[.03,.06,.2],[.82,.4,.2],[1,.45,.2]],[5,[.03,.1,.38],[.92,.64,.42],[1,.65,.4]],[15,[.025,.13,.52],[.72,.8,.9],[1,.88,.72]],[90,[.02,.11,.5],[.66,.78,.92],[1,.95,.88]]];
 const lerp3=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
 function pal(deg){if(deg<=KF[0][0])return KF[0].slice(1);for(let i=1;i<KF.length;i++)if(deg<=KF[i][0]){const t=(deg-KF[i-1][0])/(KF[i][0]-KF[i-1][0]);return[lerp3(KF[i-1][1],KF[i][1],t),lerp3(KF[i-1][2],KF[i][2],t),lerp3(KF[i-1][3],KF[i][3],t)]}return KF[KF.length-1].slice(1)}
 // nuvole: rumore ripetibile
 const CLTX=(()=>{const N=256,c=document.createElement('canvas');c.width=c.height=N;const x=c.getContext('2d'),im=x.createImageData(N,N),d=im.data;for(let j=0;j<N;j++)for(let i=0;i<N;i++){const v=NZ(i,j,5,128)*.65+NZ(i+71,j+13,4,32)*.35,p=(j*N+i)*4;d[p]=d[p+1]=d[p+2]=Math.max(0,Math.min(255,v*255));d[p+3]=255}x.putImageData(im,0,0);const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;return t})();
 const U={uSun:{value:new T.Vector3(0,1,0)},uMoon:{value:new T.Vector3(0,1,0)},uZen:{value:new T.Color()},uHor:{value:new T.Color()},uSunC:{value:new T.Color()},uNight:UNI.uNight,uTime:UNI.uTime,uCov:{value:.85},tCl:{value:CLTX}};
 if(SKY.material.map)SKY.material.map.dispose();SKY.material.dispose();
 SKY.material=new T.ShaderMaterial({uniforms:U,side:T.BackSide,depthWrite:false,fog:false,
  vertexShader:'varying vec3 vD;void main(){vD=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);gl_Position.z=gl_Position.w*.99999;}',
  fragmentShader:`uniform vec3 uSun,uMoon,uZen,uHor,uSunC;uniform float uNight,uTime,uCov;uniform sampler2D tCl;varying vec3 vD;
float hs(vec3 p){p=fract(p*.3183099+.1);p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
void main(){vec3 d=normalize(vD);float h=d.y;vec3 col=mix(uHor,uZen,pow(clamp(h,0.,1.),.5));col=mix(col,uHor*.5,smoothstep(0.,-.2,h));
 float cs=max(dot(d,uSun),0.),sv=smoothstep(-.12,.02,uSun.y);col+=uSunC*(pow(cs,1400.)*45.+pow(cs,60.)*.35+pow(cs,6.)*.10)*sv;
 float cm=max(dot(d,uMoon),0.);col+=vec3(.75,.8,.9)*(step(.99985,cm)*2.2+pow(cm,300.)*.12)*uNight;
 if(uNight>0.01&&h>0.){vec3 g=floor(d*380.);float s=hs(g);col+=vec3(.8,.85,1.)*step(.9972,s)*(.4+1.6*fract(s*91.7))*smoothstep(0.,.25,h)*uNight;}
 if(h>0.){vec2 uv=d.xz/(h+.1)*.075+vec2(uTime*.0011,uTime*.0006);float c=texture2D(tCl,uv).r*.65+texture2D(tCl,uv*2.7+.3).r*.35;c=smoothstep(.48,.78,c)*smoothstep(0.,.15,h)*uCov;
  vec3 lit=mix(vec3(.95,.96,.98),uSunC,.45*(1.-smoothstep(.0,.25,uSun.y)))*(max(uSun.y,0.)*.9+.12)*(1.-uNight*.85)+uHor*.25;col=mix(col,lit*(.8+.35*pow(cs,3.)),c*.9);}
 gl_FragColor=vec4(col,1.0);
 #include <tonemapping_fragment>
 #include <encodings_fragment>
}`});
 SKY.renderOrder=-10;
 const HEMI=sc.children.find(o=>o.isHemisphereLight),hemiSky=HEMI?HEMI.color.clone():null,hemiGr=HEMI?HEMI.groundColor.clone():null,SUNC=sun.color.clone();
 const dirS=new T.Vector3(-.5,.7,.4).normalize(),dirM=new T.Vector3(.4,.6,-.3).normalize();let lightDir=dirS.clone(),dayK=1,lastT=0,info={alt:0,az:0,date:null,mode};
 // pozze di luce dei lampioni, fasci dei fari dell'auto del giocatore
 const POOLM=new T.MeshBasicMaterial({map:POOLTX,color:new T.Color(1,.62,.3),transparent:true,opacity:0,blending:T.AdditiveBlending,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-6,polygonOffsetUnits:-6,toneMapped:false});
 const POOLG=(()=>{const g=new T.PlaneGeometry(1,1);g.rotateX(-PI/2);return g})(),POOLS=new Set();
 const HEADM=new T.MeshBasicMaterial({map:(()=>{const c=cv(64,128,(x)=>{const g=x.createLinearGradient(0,128,0,0);g.addColorStop(0,'rgba(255,255,255,.95)');g.addColorStop(.5,'rgba(255,255,255,.45)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.beginPath();x.moveTo(26,128);x.lineTo(38,128);x.lineTo(64,0);x.lineTo(0,0);x.closePath();x.fill()});return new T.CanvasTexture(c)})(),color:new T.Color(1,.93,.78),transparent:true,opacity:0,blending:T.AdditiveBlending,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-7,polygonOffsetUnits:-7,toneMapped:false});
 let HEAD=null;function headInit(){if(HEAD||typeof carG==='undefined')return;const g=new T.PlaneGeometry(9,26);g.rotateX(-PI/2);g.translate(0,.12,15.2);HEAD=new T.Mesh(g,HEADM);HEAD.visible=false;HEAD.frustumCulled=false;HEAD.renderOrder=3;carG.add(HEAD)}
 // riflessi: panorama vero (città o campagna) rischiarato secondo la luce del giorno
 const PM=new T.PMREMGenerator(R),ES=new T.Scene(),EM=new T.MeshBasicMaterial({side:T.BackSide,toneMapped:false}),EMesh=new T.Mesh(new T.SphereGeometry(10,48,24),EM);ES.add(EMesh);
 let envK='',envL=-1,envRT=null,envT=0;
 function env(kind,lev,tint){const tx=PBR.TX.env&&PBR.TX.env[kind];if(!tx)return;if(kind===envK&&Math.abs(lev-envL)<.05)return;EM.map=tx;EM.color.setRGB(lev*tint[0],lev*tint[1],lev*tint[2]);EM.needsUpdate=true;
  try{const rt=PM.fromScene(ES,0,.1,100);if(envRT)envRT.dispose();envRT=rt;sc.environment=rt.texture;envK=kind;envL=lev}catch(e){console.warn(e)}}
 function urbanNear(px,pz){const c=cellAt(px,pz);return c&&c.urb!==undefined?c.urb:.3}
 function update(px,pz){const now=performance.now(),dt=Math.min(.1,(now-(lastT||now))/1000);lastT=now;UNI.uTime.value+=dt;headInit();
  const ll=geoOf(px,pz),dte=when(ll[0],ll[1]),[alt,az]=sunAt(dte,ll[0],ll[1]);info.alt=alt;info.az=az;info.date=dte;info.mode=mode;
  const ca=Math.cos(alt);dirS.set(-Math.sin(az)*ca,Math.sin(alt),Math.cos(az)*ca);
  dirM.set(-dirS.x*.8+.2,Math.max(.35,-dirS.y),-dirS.z*.8).normalize();
  const deg=alt*180/PI,[zen,hor,sc0]=pal(deg),s=Math.sin(alt);
  const night=1-THREE_SS(-.12,.04,s);UNI.uNight.value=night;dayK=THREE_SS(-.1,.25,s);
  U.uSun.value.copy(dirS);U.uMoon.value.copy(dirM);U.uZen.value.setRGB(...zen);U.uHor.value.setRGB(...hor);U.uSunC.value.setRGB(...sc0);
  // luce diretta: il sole quando è alto, la luna (fredda e debole) di notte
  const sunI=1.38*THREE_SS(-.03,.2,s),moonI=.13*night;
  if(sunI>=moonI){lightDir.copy(dirS);sun.intensity=sunI;sun.color.setRGB(sc0[0],sc0[1]*.98,sc0[2]*.96).multiplyScalar(1)}else{lightDir.copy(dirM);sun.intensity=moonI;sun.color.setRGB(.55,.65,.95)}
  if(lightDir.y<.12)lightDir.y=.12;lightDir.normalize();
  if(HEMI){const k=.07+.93*dayK,warm=(1-THREE_SS(4,14,deg))*THREE_SS(-7,0,deg);HEMI.intensity=.52*k+.09*night;HEMI.color.copy(hemiSky).lerp(new T.Color(1,.62,.42),warm*.55).lerp(new T.Color(.18,.24,.45),night*.85);HEMI.groundColor.copy(hemiGr).multiplyScalar(.25+.75*dayK)}
  if(sc.fog){sc.fog.color.setRGB(hor[0]*.92+zen[0]*.08,hor[1]*.92+zen[1]*.08,hor[2]*.92+zen[2]*.08);if(sc.background&&sc.background.isColor)sc.background.copy(sc.fog.color);else sc.background=sc.fog.color.clone()}
  R.toneMappingExposure=1.12+night*.25;
  // lampioni, fari
  const po=Math.min(1,night*1.25);POOLM.opacity=po*.42;const vis=po>.02;for(const m of POOLS)if(m.visible!==vis)m.visible=vis;
  if(HEAD){const on=night>.25&&typeof inCar!=='undefined'&&inCar;HEAD.visible=on;HEADM.opacity=on?Math.min(1,night*1.4)*.55:0}
  if(now>envT&&PBR.ok.v){envT=now+1500;const urb=urbanNear(px,pz);env(urb>.18?'citta':'campagna',.05+.95*dayK,deg<8&&deg>-6?[1,.82,.7]:[1,1,1])}}
 function sunPos(px,py,pz){sun.position.set(px+lightDir.x*80,py+lightDir.y*80,pz+lightDir.z*80)}
 function next(){const i=MODES.indexOf(mode);mode=MODES[(i+1)%MODES.length];tramH=null;fast0=Date.now();try{localStorage.setItem('iow_ora',mode)}catch(e){}return NAMES[mode]}
 function poolsFor(c,la,X,Z){if(!la||!la.length)return;const n=la.length/4,im=new T.InstancedMesh(POOLG,POOLM,n);for(let i=0;i<n;i++){const a=la[i*4+3];_v.set(la[i*4]+Math.sin(a)*1.6,la[i*4+1]+.08,la[i*4+2]+Math.cos(a)*1.6);_q.identity();_s.set(13,1,13);_m4.compose(_v,_q,_s);im.setMatrixAt(i,_m4)}
  im.instanceMatrix.needsUpdate=true;im.frustumCulled=false;im.matrixAutoUpdate=false;im.renderOrder=3;im.visible=POOLM.opacity>.01;c.g.add(im);POOLS.add(im);c.pools=im}
 return{update,sunPos,next,get mode(){return mode},get name(){return NAMES[mode]},info,poolsFor,POOLS,sunAt}})();
function THREE_SS(a,b,x){const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)}
