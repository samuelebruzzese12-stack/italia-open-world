// V32 nel gioco vero (Chromium): blackout della centralina con un urto da oltre 15 g e informatore con covo, notifica e irruzione.
// Uso: SCENES=test/browser_v32.js PAGE='http://127.0.0.1:8771/index.html?vt=…&dem=…&pos=43.731818,7.415354' THREE_JS=… node test/scene_chromium.js
module.exports = { init: () => ({ ok: !!(window.__iow && window.__v32) }), scenes: [{ name: 'v0', wait: +(process.env.ATTESA || 30000), eval: () => 'attendo', skip: 1 },
  { name: 'v1_ferma', wait: 1500, skip: 1, eval: () => { window.requestAnimationFrame = cb => 0; return 'ciclo fermo' } },
  { name: 'v2_centralina', wait: 300, skip: 1, eval: () => { const g = window.__iow, X = window.__v32, out = {};
    if (!g.inCar) { g.P.x = g.C.x + 2; g.P.z = g.C.z; const a = g.near(); if (a && a.t === 'Sali in auto') a.a() } out.inCar = g.inCar;
    for (let i = 0; i < 20; i++) g.step(1 / 60); const E = () => X.ecu ? { ABS: X.ecu.ecu.ABS.stato, ESC: X.ecu.ecu.ESC.stato } : null; out.prima = E();
    const sn = Math.sin(g.C.h), cn = Math.cos(g.C.h), car = { x: g.C.x, z: g.C.z, h: g.C.h, y: g.V.y };
    g.carHit(g.carA, car, g.C.x + sn * 2.3, g.C.z + cn * 2.3, sn, cn, 6, 'wall'); for (let i = 0; i < 10; i++) g.step(1 / 60); out.urto6 = { g: +X.VCU.g.toFixed(1), ko: X.VCU.ko, ecu: E() };
    g.carHit(g.carA, car, g.C.x + sn * 2.3, g.C.z + cn * 2.3, sn, cn, 22, 'wall'); for (let i = 0; i < 10; i++) g.step(1 / 60); out.urto22 = { g: +X.VCU.g.toFixed(1), ko: X.VCU.ko, ecu: E(), messaggio: document.getElementById('toast').textContent };
    out.absFisica = X.veh && X.veh.elettronica ? X.veh.elettronica.abs : null; return out } },
  { name: 'v3_informatore', wait: 300, skip: 1, eval: () => { const g = window.__iow, X = window.__v32, out = {}, $ = s => document.querySelector(s), down = el => el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    down($('#ibtn')); out.pannello = !$('#ip').hidden; $('#i_covo').click(); const st = X.infStato(); out.covo = st.covo && st.covo.nome;
    X.PL.offence('speronamento di una pattuglia', 1, 3); out.reati = Object.assign({}, st.reati);
    $('#i_txt').value = 'di cosa sono accusato?'; $('#i_send').click(); out.rispostaAccuse = st.chat[st.chat.length - 1].testo;
    $('#i_txt').value = 'asdf qwerty'; $('#i_send').click(); out.rispostaIncomprensibile = st.chat[st.chat.length - 1].testo;
    st.piano.attivo = true; st.piano.avanzamento = 74.9; for (let i = 0; i < 40; i++) g.step(1 / 60); out.notifica = document.getElementById('toast').textContent; out.badgeRosso = $('#ibtn').classList.contains('nuovo') || !$('#ip').hidden;
    const n0 = X.PL.units.filter(u => u.status !== 'gone').length; st.piano.avanzamento = 99.99; for (let i = 0; i < 40; i++) g.step(1 / 60);
    out.irruzione = { radio: (document.getElementById('sub') || {}).textContent || '', stelle: X.PL.heat, pattuglie: X.PL.units.filter(u => u.status !== 'gone').length - n0, toast: document.getElementById('toast').textContent, ultimoEvento: st.eventi.length ? st.eventi[st.eventi.length - 1].tipo : null };
    out.salvato = (() => { try { return !!JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => /iow|open/i.test(k) && !/_bak$/.test(k)) || 'x')).inf } catch (e) { return 'non leggibile' } })();
    return out } },
  { name: 'v4_ripara', wait: 300, skip: 1, eval: () => { const X = window.__v32; return { prima: X.VCU.ko, nota: 'riparazione: vcuRipara() è chiamata da «Ripara l\'auto" (prova: patch_v32.py)' } } }] };
