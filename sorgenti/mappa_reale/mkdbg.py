import os
# copia cella.js in cella_dbg.js aggiungendo le sonde di debug (dbgV: vertice del terreno; dbgN: nodi e profili vicini a un punto)
B=os.path.dirname(os.path.abspath(__file__))+'/'
s=open(B+'cella.js').read()
def rep(old,new):
    global s
    assert s.count(old)==1, old[:80]; s=s.replace(old,new)
rep("""TM = new Uint8Array(NG * NG), BDR = new Int32Array(NG * NG).fill(-1); let rid = 0;""","""TM = new Uint8Array(NG * NG), BDR = new Int32Array(NG * NG).fill(-1), TOPBY = new Array(NG * NG); let rid = 0;""")
rep("""        if (TM[p]) { if (yr < TOP[p]) TOP[p] = yr;""","""        if (TM[p]) { if (yr < TOP[p]) { TOP[p] = yr; TOPBY[p] = R.r.c + '@' + R.S2[0].toFixed(0) + ',' + R.S2[1].toFixed(0) + ' dd' + dd.toFixed(1) }""")
rep("""    let nb = 0, ns = 0, nt = 0; for (let p = 0; p < NG * NG; p++) { let h = H[p];""","""    if (opt.dbgV) { const i = Math.round(opt.dbgV[0] / d), j = Math.round(opt.dbgV[1] / d), p = j * NG + i; stat.dbgV = { i, j, u: i * d, v: j * d, H: H[p], LO: LO[p], HI: HI[p], BD: BD[p], BY: BY[p], TOP: TOP[p], BOT: BOT[p], TOPby: TOPBY[p] } }
    let nb = 0, ns = 0, nt = 0; for (let p = 0; p < NG * NG; p++) { let h = H[p];""")
rep("""    stat.abbassati = nl; stat.fascia = nb; stat.scarpate = ns; stat.terrazze = nt }""","""    if (opt.dbgV) { const D = stat.dbgV; D.finale = H[D.j * NG + D.i]; D.safety = D.finale - Math.min(D.BD < 1e8 ? D.BY : 1e9, D.TOP) }
    stat.abbassati = nl; stat.fascia = nb; stat.scarpate = ns; stat.terrazze = nt }""")
rep("""    stat.nodi = NOD.filter(N => N.P.size > 1).length }""","""    if (opt.dbgN) { const [du, dv] = opt.dbgN; stat.dbgN = NOD.filter(N => N.P.size > 0 && Math.hypot(N.u - du, N.v - dv) < (opt.dbgR || 12)).map(N => ({ u: +N.u.toFixed(1), v: +N.v.toFixed(1), m: Array.from(N.P.values()).map(([pi, sv, hv, inter]) => ({ pi, c: PR[pi].r.c + (PR[pi].r.bridge ? '/ponte' : '') + (PR[pi].r.tun ? '/gall' : '') + (PR[pi].r.shallow ? '/sottop' : ''), rank: PR[pi].r.rank, sv: +sv.toFixed(1), L: +PR[pi].s[PR[pi].m - 1].toFixed(0), hv: +hv.toFixed(2), inter, adj: +adjAt(PR[pi], sv).toFixed(2), CON: CON[pi].map(x => x.slice(0, 3).map(v => +v.toFixed(2))) })) }));
      stat.dbgP = []; PR.forEach((P, pi) => { let bd = 1e9, bq = 0; for (let q = 0; q < P.m; q++) { const dd = Math.hypot(P.S2[q * 2] - du, P.S2[q * 2 + 1] - dv); if (dd < bd) { bd = dd; bq = q } } if (bd < 6) stat.dbgP.push({ pi, c: P.r.c + (P.r.bridge ? '/ponte' : '') + (P.r.tun ? '/gall' : ''), m: P.m, L: +P.s[P.m - 1].toFixed(0), s: +P.s[bq].toFixed(1), d: +bd.toFixed(1), h: +P.h[bq].toFixed(2), h0f: +P.h0f[bq].toFixed(2), e0: [+P.S2[0].toFixed(1), +P.S2[1].toFixed(1)], e1: [+P.S2[P.m * 2 - 2].toFixed(1), +P.S2[P.m * 2 - 1].toFixed(1)] }) }) }
    stat.nodi = NOD.filter(N => N.P.size > 1).length }""")
open(B+'cella_dbg.js','w').write(s); print('cella_dbg.js aggiornato')
