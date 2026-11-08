# -*- coding: utf-8 -*-
"""ITALIA OPEN WORLD — 7DoF-NVE-MFS: dinamica del veicolo a 7 gradi di libertà, pneumatici a scorrimento combinato (Magic Formula),
centralina con ESP, ABS, TCS ed EBD a 200 Hz e blackout elettronico dopo un urto.

Modulo autonomo in Python 3 (solo libreria standard). È un modello di simulazione per il gioco e per lo studio: parametri generici di una
berlina a trazione anteriore da 1610 kg (ordine di grandezza di un'Alfa Romeo 159 2.0 JTDm), non dati di un costruttore e non validato su
prove reali. Non è il motore fisico del gioco (quello è motore/fisica_veicolo.js, in JavaScript): qui si studia il comportamento con e senza
controlli elettronici.

Stato dinamico (7 equazioni accoppiate): vx, vy, r, ω_fl, ω_fr, ω_rl, ω_rr. Per tracciare la traiettoria si integrano anche ψ, X, Y.
Integrazione: Runge-Kutta 4 su ogni passo di controllo dt = 0,005 s (200 Hz), diviso in 4 sotto-passi perché le equazioni delle ruote sono
rigide (costante di tempo dello scorrimento = Iw·v/(Re²·Cλ), sotto i 10 m/s più corta del passo di controllo).

Scelte dichiarate rispetto alla specifica:
- la coppia correttiva dell'ESP agisce attraverso i freni (coppia frenante su una ruota, ΔFx = Mz / (w/2)): non viene sommata anche
  direttamente nell'equazione dell'imbardata, che la conterebbe due volte. Nell'equazione dell'imbardata entra solo il momento esterno (urto);
- il trasferimento di carico usa le accelerazioni del corpo ax = v̇x − r·vy, ay = v̇y + r·vx (non le sole derivate), calcolate al passo
  precedente (anello algebrico risolto con un passo di ritardo, come nei simulatori in tempo reale);
- ruota bloccata: quando la coppia frenante supera quella che la ruota può trasmettere e la ruota è quasi ferma, ω resta a 0 (attrito statico
  del freno), così lo scorrimento è −1 e la forza laterale va a zero come nella realtà.
"""
import math

G = 9.81


class Parametri:
    """Berlina a trazione anteriore (valori generici, ordine di grandezza)."""
    m = 1610.0            # massa [kg]
    Iz = 2700.0           # inerzia d'imbardata [kg m²]
    a = 1.20              # baricentro → asse anteriore [m]
    b = 1.50              # baricentro → asse posteriore [m]
    wf = 1.55             # carreggiata anteriore [m]
    wr = 1.55             # carreggiata posteriore [m]
    h_cg = 0.55           # altezza del baricentro [m]
    Re = 0.317            # raggio efficace [m]
    Iw = 1.2              # inerzia della ruota [kg m²]
    CdA = 0.68            # coefficiente di resistenza × area frontale [m²]
    rho = 1.2             # densità dell'aria [kg/m³]
    f_roll = 0.012        # resistenza al rotolamento
    # Magic Formula (asfalto asciutto) e sensibilità al carico
    B, C, E = 10.0, 1.9, 0.97
    mu0 = 1.0
    k_load = 0.10
    # freni: coppia massima per ruota [N m]
    Tb_max = (2600.0, 2600.0, 1300.0, 1300.0)

    @property
    def L(self):
        return self.a + self.b


class SevenDoFVehicleDynamics:
    """Integra le 7 equazioni del moto con RK4. Ruote nell'ordine fl, fr, rl, rr; y del veicolo verso sinistra, imbardata positiva a sinistra."""
    RUOTE = ('fl', 'fr', 'rl', 'rr')

    def __init__(self, p=None, v0=50.0):
        self.p = p or Parametri()
        P = self.p
        self.s = [v0, 0.0, 0.0] + [v0 / P.Re] * 4          # vx, vy, r, ω×4
        self.psi, self.X, self.Y = 0.0, 0.0, 0.0
        self.ax, self.ay = 0.0, 0.0                         # accelerazioni del corpo del passo precedente
        self.bloccata = [False] * 4
        self.ultimo = {}                                    # forze e scorrimenti dell'ultimo calcolo (telemetria)
        self._lrel = [0.0] * 4

    # ---------------- carichi verticali con trasferimento longitudinale e laterale
    def carichi(self):
        P, m = self.p, self.p.m
        L = P.L
        Fzf = P.b * m * G / (2 * L) - P.h_cg * m * self.ax / (2 * L)
        Fzr = P.a * m * G / (2 * L) + P.h_cg * m * self.ax / (2 * L)
        dF = P.h_cg * m * self.ay / (P.wf * L) * P.b       # ay > 0 (verso sinistra) scarica le ruote di sinistra
        dR = P.h_cg * m * self.ay / (P.wr * L) * P.a
        return [max(50.0, Fzf - dF), max(50.0, Fzf + dF), max(50.0, Fzr - dR), max(50.0, Fzr + dR)]

    def mu(self, Fz):
        P = self.p
        Fz0 = P.m * G / 4
        return P.mu0 * max(.5, 1 - P.k_load * (Fz - Fz0) / Fz0)

    # ---------------- forze degli pneumatici (Magic Formula a scorrimento combinato)
    def forze_ruote(self, s, delta, Fz):
        P = self.p
        vx, vy, r = s[0], s[1], s[2]
        pos = ((P.a, P.wf / 2), (P.a, -P.wf / 2), (-P.b, P.wr / 2), (-P.b, -P.wr / 2))
        Fx, Fy, lam, alf = [0.0] * 4, [0.0] * 4, [0.0] * 4, [0.0] * 4
        for i, (xi, yi) in enumerate(pos):
            # velocità del centro ruota nel riferimento del veicolo
            ux, uy = vx - r * yi, vy + r * xi
            d = delta if i < 2 else 0.0
            # nel riferimento della ruota (le anteriori sterzano di δ)
            uxw = ux * math.cos(d) + uy * math.sin(d)
            uyw = -ux * math.sin(d) + uy * math.cos(d)
            alpha = -math.atan2(uyw, max(abs(uxw), 0.5))     # angolo di deriva: δ − atan((vy ± a r)/(vx ∓ w/2 r)) per le anteriori
            wR = s[3 + i] * P.Re
            den = max(abs(uxw), abs(wR), 0.5)
            lm = max(-1.0, min(1.0, (wR - uxw) / den))       # scorrimento longitudinale λ
            sig = math.sqrt(lm * lm + math.tan(alpha) ** 2)
            if sig < 1e-9:
                fx = fy = 0.0
            else:
                Bs = P.B * sig
                F0 = Fz[i] * math.sin(P.C * math.atan(Bs - P.E * (Bs - math.atan(Bs))))   # D = Fz
                mu = self.mu(Fz[i])
                fx = lm / sig * F0 * mu
                fy = math.tan(alpha) / sig * F0 * mu
            Fx[i], Fy[i], lam[i], alf[i] = fx, fy, lm, alpha
            self._lrel[i] = lm * (1 if uxw >= 0 else -1)      # scorrimento rispetto al verso del moto (anche in retromarcia dopo un testacoda)
        return Fx, Fy, lam, alf

    # ---------------- derivate dello stato (7 dinamiche + 3 cinematiche)
    def derivate(self, s, psi, delta, Tm, Tb, F_ext, M_ext, Fz):
        P = self.p
        vx, vy, r = s[0], s[1], s[2]
        Fx, Fy, lam, alf = self.forze_ruote(s, delta, Fz)
        cd, sd = math.cos(delta), math.sin(delta)
        Faero = 0.5 * P.rho * P.CdA * vx * abs(vx) + P.f_roll * P.m * G * (1 if vx > 0 else -1 if vx < 0 else 0)
        dvx = r * vy + ((Fx[0] + Fx[1]) * cd - (Fy[0] + Fy[1]) * sd + Fx[2] + Fx[3] - Faero) / P.m
        dvy = -r * vx + ((Fx[0] + Fx[1]) * sd + (Fy[0] + Fy[1]) * cd + Fy[2] + Fy[3] + F_ext) / P.m
        dr = (P.a * ((Fx[0] + Fx[1]) * sd + (Fy[0] + Fy[1]) * cd) - P.b * (Fy[2] + Fy[3])
              + P.wf / 2 * ((Fx[1] - Fx[0]) * cd + (Fy[0] - Fy[1]) * sd) + P.wr / 2 * (Fx[3] - Fx[2]) + M_ext) / P.Iz
        dw = []
        for i in range(4):
            w = s[3 + i]
            if self.bloccata[i]:
                dw.append(0.0)
                continue
            freno = Tb[i] * math.tanh(w / 0.3)                 # la coppia frenante si oppone alla rotazione (segno addolcito vicino a 0)
            dw.append((Tm[i] - freno - P.Re * Fx[i]) / P.Iw)  # Iw ω̇ = Tm − Tb − Re Fx
        dpsi = r
        dX = vx * math.cos(psi) - vy * math.sin(psi)
        dY = vx * math.sin(psi) + vy * math.cos(psi)
        return [dvx, dvy, dr] + dw, dpsi, dX, dY, (Fx, Fy, lam, alf)

    def passo(self, dt, delta, Tm, Tb, F_ext=0.0, M_ext=0.0, sotto=4):
        """Un passo di controllo dt: RK4 su `sotto` sotto-passi. Tm, Tb: coppie per ruota [N m]."""
        h = dt / sotto
        for _ in range(sotto):
            Fz = self.carichi()
            s0, p0, X0, Y0 = self.s, self.psi, self.X, self.Y

            def f(s, psi):
                return self.derivate(s, psi, delta, Tm, Tb, F_ext, M_ext, Fz)

            k1, q1, x1, y1, info = f(s0, p0)
            s2 = [s0[j] + h / 2 * k1[j] for j in range(7)]
            k2, q2, x2, y2, _ = f(s2, p0 + h / 2 * q1)
            s3 = [s0[j] + h / 2 * k2[j] for j in range(7)]
            k3, q3, x3, y3, _ = f(s3, p0 + h / 2 * q2)
            s4 = [s0[j] + h * k3[j] for j in range(7)]
            k4, q4, x4, y4, _ = f(s4, p0 + h * q3)
            sn = [s0[j] + h / 6 * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]) for j in range(7)]
            # ruote: non cambiano verso per effetto del freno; bloccaggio quando il freno supera la coppia trasmissibile
            for i in range(4):
                w0, w1 = s0[3 + i], sn[3 + i]
                if self.bloccata[i]:
                    sn[3 + i] = 0.0
                    if Tb[i] < abs(Tm[i] - self.p.Re * info[0][i]) * 0.9:   # il freno non trattiene più: la ruota riparte
                        self.bloccata[i] = False
                elif Tb[i] > 0 and (w0 > 0 >= w1 or abs(w1) < 0.5) and Tb[i] >= abs(Tm[i] - self.p.Re * info[0][i]):
                    sn[3 + i] = 0.0
                    self.bloccata[i] = True
            self.s = sn
            self.psi = p0 + h / 6 * (q1 + 2 * q2 + 2 * q3 + q4)
            self.X = X0 + h / 6 * (x1 + 2 * x2 + 2 * x3 + x4)
            self.Y = Y0 + h / 6 * (y1 + 2 * y2 + 2 * y3 + y4)
            # accelerazioni del corpo per il trasferimento di carico del prossimo sotto-passo
            d = k1
            self.ax = d[0] - sn[2] * sn[1]
            self.ay = d[1] + sn[2] * sn[0]
            Fx, Fy, lam, alf = info
            self.ultimo = {'Fx': Fx, 'Fy': Fy, 'lambda': lam, 'alpha': alf, 'Fz': Fz, 'lambda_rel': list(self._lrel)}

    @property
    def beta(self):
        vx, vy = self.s[0], self.s[1]
        return math.atan2(vy, max(abs(vx), 0.1))


class MechatronicVehicleControlUnit:
    """Centralina a 200 Hz: ESP (imbardata di riferimento, coppia correttiva tramite freno di una ruota), ABS e TCS per ruota."""

    def __init__(self, veicolo, Ku=0.0025, soglia_g=15.0):
        self.v = veicolo
        self.Ku = Ku                       # gradiente di sottosterzo [rad/(m/s²)]
        self.soglia_g = soglia_g
        self.SYSTEM_INTEGRITY_COMPROMISED = False
        self.Kp_esp, self.Kd_esp = 9000.0, 300.0
        self.er_prec = 0.0
        self.abs_g = [1.0] * 4              # frazione della frenata concessa dall'ABS per ruota
        self.tcs_i = [0.0] * 2              # integrale del PID del TCS (ruote motrici anteriori)
        self.tcs_e = [0.0] * 2
        self.Mz = 0.0
        self.log = []

    def inject_soft_body_crash_event(self, g_force, t=None):
        """Urto letto dalla fisica dei corpi morbidi sui nodi ECU_Processor_Core / CAN_Bus_High_Line."""
        if g_force > self.soglia_g and not self.SYSTEM_INTEGRITY_COMPROMISED:
            self.SYSTEM_INTEGRITY_COMPROMISED = True
            self.log.append((t, '[CENTRALINA KO] urto di %.1f g oltre %.1f g: ESP, ABS e TCS disattivati — dinamica puramente meccanica'
                             % (g_force, self.soglia_g)))
        elif not self.SYSTEM_INTEGRITY_COMPROMISED:
            self.log.append((t, '[CENTRALINA OK] urto di %.1f g sotto la soglia di %.1f g' % (g_force, self.soglia_g)))

    def r_desiderata(self, delta, mu=1.0):
        P = self.v.p
        vx = max(self.v.s[0], 1.0)
        rd = vx / (P.L + vx * vx * self.Ku / G) * delta
        rlim = 0.85 * mu * G / vx
        return max(-rlim, min(rlim, rd))

    def calcola(self, dt, delta, Tm_cmd, freno_cmd):
        """Coppie motrici e frenanti per ruota a partire dai comandi del guidatore (freno_cmd 0..1)."""
        v, P = self.v, self.v.p
        lam = v.ultimo.get('lambda_rel', [0.0] * 4)
        Tb = [freno_cmd * P.Tb_max[i] for i in range(4)]
        Tm = [Tm_cmd / 2, Tm_cmd / 2, 0.0, 0.0]          # trazione anteriore, differenziale aperto
        self.Mz = 0.0
        if self.SYSTEM_INTEGRITY_COMPROMISED:
            return Tm, Tb                                 # blackout: nessun calcolo, freni e coppia grezzi
        # TCS: PID discreto sullo scorrimento delle ruote motrici
        for i in range(2):
            e = lam[i] - 0.15
            if e > 0:
                self.tcs_i[i] += e * dt
                taglio = 4000 * e + 20000 * self.tcs_i[i] + 50 * (e - self.tcs_e[i]) / dt
                Tm[i] = max(0.0, Tm[i] - taglio)
            else:
                self.tcs_i[i] = max(0.0, self.tcs_i[i] - dt * .5)
            self.tcs_e[i] = e
        # ESP: errore d'imbardata e coppia correttiva tramite il freno di una ruota anteriore
        er = self.r_desiderata(delta) - v.s[2]
        der = (er - self.er_prec) / dt
        self.er_prec = er
        if abs(er) > 0.04:
            self.Mz = self.Kp_esp * er + self.Kd_esp * der
            dFx = abs(self.Mz) / (P.wf / 2)
            i = 0 if self.Mz > 0 else 1                   # Mz > 0 (serve imbardata a sinistra): freno a sinistra; altrimenti a destra
            j = 1 - i                                     # ruota anteriore dell'altro lato: in frenata le si toglie pressione
            Tb[i] = min(P.Tb_max[i], Tb[i] + dFx * P.Re)
            Tb[j] = max(0.0, Tb[j] - dFx * P.Re / 2)
            Tb[j + 2] = max(0.0, Tb[j + 2] - dFx * P.Re / 4)  # e un po' anche alla posteriore dello stesso lato
            Tm[0] = Tm[1] = min(Tm[0], Tm[1], 50.0)       # riduzione di coppia durante l'intervento
        # EBD (ripartizione elettronica della frenata): la coppia frenante di ogni ruota posteriore non supera ciò che il suo carico, ridotto dal
        # trasferimento in frenata, può trasmettere (altrimenti il posteriore perde aderenza laterale). È elettronica: in blackout non c'è
        Fz = v.carichi()
        for i in (2, 3):
            Tb[i] = min(Tb[i], 0.75 * v.mu(Fz[i]) * Fz[i] * P.Re)
        # ABS sulla coppia frenante finale di ogni ruota (guidatore + ESP): sotto −0,15 si azzera, poi torna con una rampa
        for i in range(4):
            if Tb[i] > 0 and lam[i] < -0.15:
                self.abs_g[i] = 0.0
            else:
                self.abs_g[i] = min(1.0, self.abs_g[i] + dt * 12)
            Tb[i] *= self.abs_g[i]
        return Tm, Tb


def execute_high_fidelity_simulation(durata=6.0, dt=0.005, v0=50.0, F_pit=6000.0, t_pit=(1.0, 1.5), t_freno=1.5, stampa=True):
    """Due veicoli uguali a 180 km/h. Manovra PIT: forza laterale costante sul paraurti posteriore per 0,5 s. Il primo resta con la centralina
    operativa (urto letto a 6 g), il secondo subisce un urto letto a 16 g sulla centralina (blackout). Dopo l'urto il guidatore frena a fondo
    con lo sterzo dritto. Restituisce i risultati numerici e (se stampa) scrive la telemetria."""
    P = Parametri()
    casi = []
    for nome, g_urto in (('SANO (centralina operativa)', 6.0), ('BLACKOUT (urto da 16 g)', 16.0)):
        v = SevenDoFVehicleDynamics(P, v0)
        ecu = MechatronicVehicleControlUnit(v)
        casi.append({'nome': nome, 'v': v, 'ecu': ecu, 'g': g_urto, 'righe': [], 'max_beta': 0.0, 'max_r': 0.0, 'colpito': False})
    braccio = -(P.b + 0.9)                                 # punto d'urto: paraurti posteriore
    n = int(durata / dt)
    for k in range(n + 1):
        t = k * dt
        for c in casi:
            v, ecu = c['v'], c['ecu']
            vx = v.s[0]
            pit = t_pit[0] <= t < t_pit[1]
            if pit and not c['colpito']:
                ecu.inject_soft_body_crash_event(c['g'], t)
                c['colpito'] = True
            freno = 1.0 if t >= t_freno else 0.0
            # prima dell'urto il guidatore mantiene la velocità (coppia pari alle resistenze); poi molla l'acceleratore
            res = 0.5 * P.rho * P.CdA * vx * vx + P.f_roll * P.m * G
            Tm_cmd = res * P.Re if t < t_pit[0] else 0.0
            delta = 0.0
            Tm, Tb = ecu.calcola(dt, delta, Tm_cmd, freno)
            F = F_pit if pit else 0.0
            if math.hypot(v.s[0], v.s[1]) > 0.3:
                v.passo(dt, delta, Tm, Tb, F_ext=F, M_ext=F * braccio)
            c['max_beta'] = max(c['max_beta'], abs(v.beta))
            c['max_r'] = max(c['max_r'], abs(v.s[2]))
            ogni = 0.1 if t < 2.5 else 0.5
            if abs(t / ogni - round(t / ogni)) < 1e-6:
                u = v.ultimo
                c['righe'].append('t=%4.2f s  v=%5.1f km/h  ruote[km/h] %s  λ %s  r=%+6.3f rad/s  β=%+6.1f°  ψ=%+7.1f°  ΣFy=%+7.0f N  ESP Mz=%+6.0f N m  %s'
                                  % (t, v.s[0] * 3.6, ' '.join('%5.1f' % (w * P.Re * 3.6) for w in v.s[3:]),
                                     ' '.join('%+5.2f' % l for l in u.get('lambda', [0] * 4)), v.s[2], math.degrees(v.beta),
                                     math.degrees(v.psi), sum(u.get('Fy', [0] * 4)), ecu.Mz,
                                     'ECU KO' if ecu.SYSTEM_INTEGRITY_COMPROMISED else 'ECU OK'))
    risultati = []
    for c in casi:
        v = c['v']
        risultati.append({'caso': c['nome'], 'beta_max_gradi': round(math.degrees(c['max_beta']), 1), 'imbardata_max_rad_s': round(c['max_r'], 3),
                          'rotazione_totale_gradi': round(math.degrees(v.psi), 1), 'scostamento_laterale_m': round(v.Y, 1),
                          'velocita_finale_kmh': round(v.s[0] * 3.6, 1), 'spazio_m': round(v.X, 1), 'ruote_bloccate': sum(v.bloccata)})
        if stampa:
            print('\n=== ' + c['nome'] + ' ===')
            for t, msg in c['ecu'].log:
                print('[t=%.2f s] %s' % (t, msg))
            for r in c['righe']:
                print(r)
    if stampa:
        print('\n=== RIEPILOGO ===')
        for r in risultati:
            print(r)
    return risultati


if __name__ == '__main__':
    import sys
    scenari = [(3000.0, 99.0, 'senza frenata, sterzo dritto'), (3000.0, 1.5, 'frenata a fondo da 1,5 s, sterzo dritto'), (6000.0, 1.5, 'frenata a fondo da 1,5 s, sterzo dritto')]
    for F, tf, desc in scenari:
        print('\n################ MANOVRA PIT: %.0f N per 0,5 s sul paraurti posteriore — %s ################' % (F, desc))
        execute_high_fidelity_simulation(F_pit=F, t_freno=tf)
