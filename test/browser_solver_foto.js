// Verifica visiva del Vehicle Damage Solver nel gioco vero (Chromium senza GPU, mappa non caricata): foto dell'auto prima/dopo urto frontale a 50 km/h e palo sulla ruota, pannello «Danni e officina». Foto in docs/img/v30_*.jpg. Stesso runner di test/browser_solver.js.
// V30 — verifica visiva: foto dell'auto prima/dopo gli urti del solver (frontale, palo sulla ruota, fianco) e pannello «Danni e officina»
const shot = (name, wait, fn) => ({ name, wait: wait || 800, eval: fn });
const look = (dx, dz, hy) => new Function(`const g=window.__iow,T=window.THREE,C=g.C,V=g.V,h=C.h,sn=Math.sin(h),cn=Math.cos(h);const cam=new T.PerspectiveCamera(48,innerWidth/innerHeight,.2,500);const px=C.x+cn*(${dx})+sn*(${dz}),pz=C.z-sn*(${dx})+cn*(${dz});cam.position.set(px,V.y+${hy},pz);cam.lookAt(new T.Vector3(C.x,V.y+.6,C.z));cam.updateMatrixWorld(true);g.R.render(g.sc,cam);return 'foto'`);
module.exports = { init: () => ({ ok: !!window.__iow.REAL }), scenes: [
  { name: 'd0', wait: 20000, eval: () => 'attendo', skip: 1 },
  { name: 'd1_sali', wait: 800, skip: 1, eval: () => { const g = window.__iow; g.P.x = g.C.x + 2; g.P.z = g.C.z; const a = g.near(); if (a && a.t === 'Sali in auto') a.a(); g.WORLD.inside = () => true; g.WORLD.wet = () => false; window.requestAnimationFrame = () => 0; const ld = document.querySelector('#rld'); if (ld) ld.style.display = 'none';   /* senza rete la mappa non si carica: si nasconde la schermata di caricamento per fotografare l'auto */ for (let i = 0; i < 5; i++) g.step(1 / 60); return { inCar: g.inCar } } },
  shot('d2_prima', 1500, look(3.2, 5.2, 1.5)),
  { name: 'd3_frontale', wait: 500, skip: 1, eval: () => { const g = window.__iow, C = g.C, h = C.h, sn = Math.sin(h), cn = Math.cos(h); g.carHit(g.carA, { x: C.x, z: C.z, h, y: g.V.y, vx: 0, vz: 0, player: true }, C.x + sn * 2.4, C.z + cn * 2.4, -sn, -cn, 50 / 3.6, 'wall'); for (let i = 0; i < 12; i++) g.step(1 / 60); const D = g.carA.dmg; return { fC: D.R && +D.R.fC.toFixed(3), hood: D.cut.hood, fb: D.cut.fb, glass: D.glass, ws: D.gcut && D.gcut.ws } } },
  shot('d4_dopo_frontale', 1500, look(3.2, 5.2, 1.5)),
  shot('d5_dopo_frontale_fronte', 1500, look(0, 5.5, 1.1)),
  { name: 'd6_palo_ruota', wait: 500, skip: 1, eval: () => { const g = window.__iow, C = g.C, h = C.h, sn = Math.sin(h), cn = Math.cos(h); const px = C.x + cn * .95 + sn * 1.3, pz = C.z - sn * .95 + cn * 1.3; g.carHit(g.carA, { x: C.x, z: C.z, h, y: g.V.y, vx: 0, vz: 0, player: true }, px, pz, -cn, sn, 40 / 3.6, 'pole'); for (let i = 0; i < 12; i++) g.step(1 / 60); const R = g.carA.dmg.R; return { hub0: R && R.hubs[0], sL: R && +R.sL.toFixed(3), ruota0: g.VDS.st.ruote[0], effetti: g.VDS.st.effetti } } },
  shot('d7_dopo_palo', 1500, look(4.5, 2.2, 1.2)),
  { name: 'd8_pannello', wait: 800, skip: 1, eval: () => { const g = window.__iow; g.VEHX.tab = 'danni'; g.VEHX.apri(true); const t = document.querySelector('#vp').innerText; const i = t.indexOf('Risolutore dei danni'); return { trovato: i >= 0, estratto: t.slice(i, i + 900) } } },
  shot('d9_pannello', 1500, look(3.2, 5.2, 1.5)),
] };
