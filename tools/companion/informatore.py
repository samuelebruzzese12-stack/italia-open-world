# -*- coding: utf-8 -*-
"""ITALIA OPEN WORLD — backend dell'app companion (GDD, sezione 4): chat a testo libero con l'Informatore della Questura e evento
«Assalto al Rifugio».

Modulo autonomo in Python 3 (solo libreria standard). Contenuti di finzione del gioco: reati e articoli inventati, nessun dato reale.
NON è collegato al gioco né a un telefono: non esiste ancora un server dell'app companion né un servizio di notifiche. Le notifiche push
qui sono solo messaggi messi in una coda (`Notifiche`) che un server vero dovrebbe inviare.

Architettura dei dati
- StatoIndagine: ciò che la polizia sa del giocatore. Livello di ricercato (0–7), accuse (articoli inventati con anni di pena), prove
  raccolte dalla scientifica, ultima posizione nota, rifugio individuato (sì/no) e piano operativo in corso.
- PianoOperativo: fasi dell'operazione sul rifugio (sorveglianza → contenimento → accerchiamento → irruzione) con un avanzamento 0–100 %
  che cresce col tempo di gioco (anche a gioco spento, se il server simula il tempo) e più in fretta con il livello di ricercato.
- ClassificatoreIntenti: capisce le frasi libere scritte dal giocatore. Normalizza il testo (minuscole, niente accenti, niente
  punteggiatura), confronta le parole con un lessico per intento tollerando gli errori di battitura (somiglianza di difflib ≥ 0,8) e
  restituisce l'intento con la fiducia. Sotto la soglia l'informatore chiede di ripetere. È un classificatore a regole, non un modello
  linguistico: al suo posto si può mettere un LLM locale che restituisca lo stesso intento.
- Informatore: risponde usando lo StatoIndagine (rivela solo ciò che la polizia sa davvero nel gioco) e, quando il piano arriva in fondo,
  avvia l'AssaltoRifugio.
- AssaltoRifugio: le tre fasi del GDD con i messaggi radio, compresa «Siamo in posizione, andiamo», e l'esito per il gioco.
"""
import difflib
import json
import re
import unicodedata

# ---------------------------------------------------------------- dati di finzione
ARTICOLI = {
    'danneggiamento': ('Art. 7-bis Codice di Gioco — danneggiamento aggravato con veicolo (fisica dei corpi morbidi)', 2),
    'resistenza': ('Art. 12 Codice di Gioco — resistenza pluriaggravata a pubblico ufficiale', 4),
    'fuga': ('Art. 15 Codice di Gioco — fuga a un posto di controllo', 1),
    'velocita': ('Art. 3 Codice di Gioco — velocità pericolosa in centro abitato', 1),
    'armi': ('Art. 21 Codice di Gioco — porto d\'armi illegale in luogo pubblico', 5),
}
PROVE = {
    'impronte': 'impronte digitali sul volante dell\'auto abbandonata',
    'video': 'video di un passante pubblicato sui social del gioco',
    'targa': 'targa letta da una telecamera del Tutor',
    'testimone': 'un testimone che ti ha visto scendere dall\'auto',
}
FASI = [('sorveglianza', 0), ('contenimento', 40), ('accerchiamento', 75), ('irruzione', 100)]


class StatoIndagine:
    def __init__(self):
        self.stelle = 0
        self.accuse = []                 # chiavi di ARTICOLI
        self.prove = []                  # chiavi di PROVE
        self.ultima_posizione = None     # (nome del luogo, lat, lon)
        self.rifugio_individuato = False
        self.piano = PianoOperativo()

    def anni_di_pena(self):
        return sum(ARTICOLI[a][1] for a in self.accuse)

    def a_json(self):
        return json.dumps({'stelle': self.stelle, 'accuse': self.accuse, 'prove': self.prove, 'ultima_posizione': self.ultima_posizione,
                           'rifugio_individuato': self.rifugio_individuato, 'piano': self.piano.avanzamento}, ensure_ascii=False)


class PianoOperativo:
    def __init__(self):
        self.avanzamento = 0.0           # 0–100 %
        self.attivo = False

    @property
    def fase(self):
        f = FASI[0][0]
        for nome, soglia in FASI:
            if self.avanzamento >= soglia:
                f = nome
        return f

    def avanza(self, minuti, stelle):
        """Il piano avanza col tempo di gioco: 1 % al minuto con 1 stella, fino a 7 % al minuto con 7 stelle."""
        if self.attivo:
            self.avanzamento = min(100.0, self.avanzamento + minuti * max(1, stelle))


# ---------------------------------------------------------------- comprensione del testo libero
def normalizza(testo):
    t = unicodedata.normalize('NFD', testo.lower())
    t = ''.join(c for c in t if unicodedata.category(c) != 'Mn')
    return re.findall(r'[a-z0-9]+', t)


class ClassificatoreIntenti:
    LESSICO = {
        'indagini': ['indagini', 'indagine', 'scoperto', 'sanno', 'scientifica', 'prove', 'impronte', 'tracce', 'video', 'testimoni', 'sospetti'],
        'accuse': ['accusa', 'accuse', 'accusato', 'reati', 'reato', 'imputato', 'condanna', 'anni', 'carcere', 'pena', 'fedina'],
        'piani': ['piano', 'piani', 'faranno', 'prossima', 'mossa', 'arrivano', 'assalto', 'irruzione', 'covo', 'rifugio', 'blitz', 'quando', 'operazione'],
        'posizione': ['dove', 'posizione', 'zona', 'cercano', 'posto', 'checkpoint', 'blocchi', 'posti'],
        'saluto': ['ciao', 'ehi', 'salve', 'buongiorno', 'buonasera', 'pronto', 'ci', 'sei'],
    }

    def __init__(self, soglia=1.0):
        self.soglia = soglia
        self.voci = [(intento, p) for intento, parole in self.LESSICO.items() for p in parole]

    def classifica(self, testo):
        parole = normalizza(testo)
        punti = {k: 0.0 for k in self.LESSICO}
        for w in parole:
            if len(w) < 2:
                continue
            for intento, p in self.voci:
                if w == p:
                    punti[intento] += 1.0
                elif len(w) >= 4 and difflib.SequenceMatcher(None, w, p).ratio() >= 0.8:   # errore di battitura
                    punti[intento] += 0.8
        punti['saluto'] *= 0.5               # un saluto conta meno di una domanda vera
        intento = max(punti, key=punti.get)
        return (intento, punti[intento]) if punti[intento] >= self.soglia else ('incomprensibile', punti[intento])


# ---------------------------------------------------------------- informatore e assalto
class Notifiche:
    """Coda dei messaggi da inviare al telefono (qui solo una lista: il servizio di notifiche push non esiste ancora)."""
    def __init__(self):
        self.coda = []

    def push(self, testo):
        self.coda.append(testo)


class AssaltoRifugio:
    def __init__(self, stato, log):
        self.stato, self.log = stato, log

    def esegui(self, giocatore_presente):
        s = self.stato
        luogo = s.ultima_posizione[0] if s.ultima_posizione else 'zona sconosciuta'
        self.log('[CENTRALE] Fase 1 — contenimento: isolata un\'area di 2 km attorno al rifugio (%s). 20 auto in borghese sulle uscite.' % luogo)
        self.log('[CENTRALE] Fase 2 — accerchiamento: 4 auto civetta a fari spenti; 2 squadre tattiche coprono porte e finestre.')
        self.log('[RADIO] Siamo in posizione, andiamo')
        self.log('[CENTRALE] Fase 3 — irruzione: porta abbattuta con l\'ariete, flashbang e fumogeni nella stanza.')
        if giocatore_presente:
            esito = 'irruzione con il giocatore nel rifugio: inizia la fuga a piedi (secondi contati)'
        else:
            esito = 'rifugio vuoto: sequestrati veicoli e oggetti nel covo; il covo è bruciato'
        self.log('[ESITO] ' + esito)
        s.piano.attivo = False
        s.piano.avanzamento = 0.0
        return esito


class Informatore:
    NON_CAPITO = ['Non ho capito, ripeti.', 'Cosa hai scritto? Sii chiaro!']

    def __init__(self, stato, notifiche=None):
        self.stato = stato
        self.cls = ClassificatoreIntenti()
        self.notifiche = notifiche or Notifiche()
        self.registro = []
        self._nc = 0
        self.assalto_fatto = False

    def log(self, riga):
        self.registro.append(riga)
        print(riga)

    def rispondi(self, testo):
        intento, fiducia = self.cls.classifica(testo)
        s = self.stato
        if intento == 'incomprensibile':
            r = self.NON_CAPITO[self._nc % 2]
            self._nc += 1
        elif intento == 'saluto':
            r = 'Sono io. Fai presto, qui in Questura non posso parlare a lungo.'
        elif intento == 'indagini':
            if not s.prove:
                r = 'Per ora la scientifica non ha niente in mano.'
            else:
                r = 'La scientifica ha: ' + '; '.join(PROVE[p] for p in s.prove) + '.'
        elif intento == 'accuse':
            if not s.accuse:
                r = 'Non c\'è ancora nessuna accusa formale contro di te.'
            else:
                r = 'Ti contestano: ' + '; '.join(ARTICOLI[a][0] for a in s.accuse) + '. Se ti prendono, sono circa %d anni.' % s.anni_di_pena()
        elif intento == 'piani':
            p = s.piano
            if not p.attivo:
                r = 'Nessuna operazione sul tuo covo, per ora. Ti cercano con le pattuglie.'
            else:
                r = 'Hanno un\'operazione sul tuo rifugio: fase di %s, sono al %d %% della preparazione.' % (p.fase, p.avanzamento)
                if p.avanzamento >= 75:
                    r += ' Sta per succedere: se sei lì, vattene subito.'
        else:  # posizione
            if s.ultima_posizione:
                r = 'L\'ultima posizione che hanno è %s. Lì ci sono posti di blocco con %d stelle di allerta.' % (s.ultima_posizione[0], s.stelle)
            else:
                r = 'Non sanno dove sei.'
        self.log('[GIOCATORE] %s\n[INFORMATORE] (%s, fiducia %.1f) %s' % (testo, intento, fiducia, r))
        return intento, r

    def tempo(self, minuti, giocatore_nel_rifugio):
        """Avanza il tempo di gioco (anche a gioco spento, se il server lo simula). A fine piano parte l'assalto."""
        s = self.stato
        prima = s.piano.fase
        s.piano.avanza(minuti, s.stelle)
        if s.piano.attivo and s.piano.fase != prima:
            self.log('[INFORMATORE] Attento: l\'operazione sul tuo rifugio è passata alla fase di %s.' % s.piano.fase)
            if s.piano.fase == 'accerchiamento':
                self.notifiche.push('Attenzione: Movimenti sospetti attorno al covo. Rientra subito!')
        if s.piano.attivo and s.piano.avanzamento >= 100 and not self.assalto_fatto:
            self.assalto_fatto = True
            self.log('[INFORMATORE] È finita la preparazione: stanno entrando.')
            return AssaltoRifugio(s, self.log).esegui(giocatore_nel_rifugio)
        return None


def dimostrazione():
    s = StatoIndagine()
    s.stelle = 4
    s.accuse = ['danneggiamento', 'resistenza', 'fuga']
    s.prove = ['impronte', 'targa']
    s.ultima_posizione = ('Pont Canavese, Via Quattro Maggio', 45.4207, 7.6006)
    s.rifugio_individuato = True
    s.piano.attivo = True
    inf = Informatore(s)
    for frase in ['ehi ci sei?', 'cosa hanno scoperto quelli della scientifica?', 'di cosa sono accusato', 'qual è il loro piamo per il mio rifugio',
                  'asdf qwerty', 'dove mi cercano?']:
        inf.rispondi(frase)
    for _ in range(8):
        esito = inf.tempo(minuti=5, giocatore_nel_rifugio=True)
        inf.rispondi('quando arrivano al covo?')
        if esito:
            break
    print('\nNotifiche in coda per il telefono:', inf.notifiche.coda)
    print('Stato salvato:', s.a_json())
    return inf


if __name__ == '__main__':
    dimostrazione()
