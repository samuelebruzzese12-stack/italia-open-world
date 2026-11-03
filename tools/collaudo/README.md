# Collaudo di tutta l'Italia

Misura i difetti della mappa su **ogni cella** dell'Italia (108 943 tile z14, 435 772 celle z15) con il generatore vero del gioco
(`sorgenti/mappa_reale/cella.js`) e lo stesso misuratore di `sorgenti/mappa_reale/difetti.js`.

- `node italia.js` — copertura: contorno approssimato di penisola, Sicilia, Sardegna e isole maggiori, allargato di 5 km.
- `node misura.js <cartella dati> <uscita.jsonl> x,y x,y …` — una riga JSON per cella: guardrail dentro altre carreggiate, punti
  dell'asse dove l'auto resta ferma (con il tipo di ostacolo), triangoli capovolti, pareti alte sotto la strada, viadotti senza
  intradosso, nome del luogo più vicino, coordinate.

**Stato:** la misura funziona (provata sui dati salvati). Lo scaricamento non si può fare da questo ambiente: `tiles.openfreemap.org`,
`tiles.mapterhorn.com` e `mapproxy.terrascope.be` sono rifiutati dal proxy. Il passo di scaricamento non è stato scritto per aggirare il
blocco: si aggiunge quando quei domini sono raggiungibili.
