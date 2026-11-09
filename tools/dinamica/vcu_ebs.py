# -*- coding: utf-8 -*-
"""ITALIA OPEN WORLD — VCU-EBS: centralina del veicolo (ESP, TCS, ABS) e blackout elettronico, su un modello bicicletta a 60 Hz.

Modulo autonomo in Python 3 (solo libreria standard), più semplice di dinamica_7dof.py (un asse = una ruota). Parametri generici di una
berlina da 1610 kg; non sono dati di un costruttore né il motore fisico del gioco (motore/fisica_veicolo.js).

Modello: vx, vy, r del corpo; una ruota anteriore (motrice e frenante) e una posteriore (frenante) con dinamica di rotazione; forze laterali
dalla rigidezza di deriva Cα con saturazione sul cerchio d'aderenza μ·Fz (le forze longitudinali consumano aderenza); trasferimento di carico
longitudinale; temperatura degli pneumatici che sale con la potenza dissipata nello strisciamento (scoppio oltre la soglia).
Controllo a 60 Hz (dt = 0,016 s); integrazione RK4 con 8 sotto-passi (le equazioni delle ruote sono rigide).
La centralina comprende anche l'EBD (ripartizione elettronica della frenata), che nei veicoli reali accompagna l'ABS.
"""
import math

G = 9.81


class VehicleControlUnit:
    """Centralina: scorrimento λ, imbardata di riferimento r_des, azione correttiva di coppia e frenata. Stato VCU_STATUS."""

    def __init__(self, L=2.70, Ku=0.0025, lam_target=0.15, soglia_g=15.0):
        self.L, self.Ku, self.lam_target, self.soglia_g = L, Ku, lam_target, soglia_g
        self.VCU_STATUS = 'OPERATIONAL'
        self.pid_tcs = [0.0, 0.0]                    # integrale, errore precedente
        self.abs_g = [1.0, 1.0]
        self.log = []
        self.ultimo = {}

    @staticmethod
    def slip_ratio(omega, Re, vx):
        """λ = (ω·Re − Vx) / max(Vx, ω·Re)."""
        den = max(abs(vx), abs(omega * Re), 0.5)
        return (omega * Re - vx) / den

    def r_desiderata(self, vx, delta):
        """r_des = Vx / (L + Vx²·Ku/g) · δ."""
        return vx / (self.L + vx * vx * self.Ku / G) * delta

    def applica_impatto_soft_body(self, g_force, nodo='Centralina_Avantreno', t=None):
        if g_force >= self.soglia_g and self.VCU_STATUS == 'OPERATIONAL':
            self.VCU_STATUS = 'HARDWARE_FAILURE'
            self.log.append((t, '[CENTRALINA KO] %s: urto di %.1f g — ABS/ESP Disattivati - Controllo puramente meccanico' % (nodo, g_force)))
        elif self.VCU_STATUS == 'OPERATIONAL':
            self.log.append((t, '[CENTRALINA OK] %s: urto di %.1f g sotto la soglia di %.1f g' % (nodo, g_force, self.soglia_g)))

    def calcola(self, dt, veicolo, delta, Tm_cmd, freno_cmd, Re):
        """Restituisce (coppia motrice anteriore, freno anteriore, freno posteriore, freno differenziale ESP come momento d'imbardata)."""
        vx, r = veicolo.vx, veicolo.r
        lam_f = self.slip_ratio(veicolo.wf, Re, vx)
        lam_r = self.slip_ratio(veicolo.wr, Re, vx)
        Tbf, Tbr, Tm, Mz = freno_cmd * 2800.0, freno_cmd * 1400.0, Tm_cmd, 0.0
        info = {'lam_f': lam_f, 'lam_r': lam_r, 'r_des': self.r_desiderata(vx, delta), 'esp': False, 'tcs': False, 'abs': False}
        if self.VCU_STATUS != 'OPERATIONAL':
            self.ultimo = info
            return Tm, Tbf, Tbr, Mz                    # potenza e frenata grezze, nessun controllo
        # TCS: PID sullo scorrimento in trazione della ruota motrice; taglio di coppia
        e = lam_f - self.lam_target
        if e > 0 and Tm > 0:
            self.pid_tcs[0] += e * dt
            taglio = 3000 * e + 15000 * self.pid_tcs[0] + 30 * (e - self.pid_tcs[1]) / dt
            Tm = max(0.0, Tm - taglio)
            info['tcs'] = True
        else:
            self.pid_tcs[0] = max(0.0, self.pid_tcs[0] - dt)
        self.pid_tcs[1] = e
        # ESP: errore d'imbardata oltre 0,08 rad/s → momento correttivo con frenata asimmetrica (applicato dal modello come momento)
        er = info['r_des'] - r
        if abs(er) > 0.08:
            Mz = max(-9000.0, min(9000.0, 8000.0 * er))
            Tm = min(Tm, 50.0)
            info['esp'] = True
        # EBD (ripartizione elettronica della frenata): la coppia frenante posteriore non supera ciò che il carico posteriore, ridotto dal
        # trasferimento in frenata, può trasmettere (altrimenti il posteriore perde aderenza laterale e l'auto si gira). Elettronica: in blackout no
        Fzr = (veicolo.a * veicolo.m * G + veicolo.h * veicolo.m * veicolo.ax) / (veicolo.a + veicolo.b)
        Tbr = min(Tbr, max(0.0, 0.75 * veicolo.mu * Fzr * Re))
        # ABS: sotto −λ_target la frenata di quella ruota si azzera, poi torna con una rampa
        for k, lam in enumerate((lam_f, lam_r)):
            if freno_cmd > 0 and lam < -self.lam_target:
                self.abs_g[k] = 0.0
                info['abs'] = True
            else:
                self.abs_g[k] = min(1.0, self.abs_g[k] + dt * 10)
        Tbf *= self.abs_g[0]
        Tbr *= self.abs_g[1]
        self.ultimo = info
        return Tm, Tbf, Tbr, Mz


class ModelloBicicletta:
    m, Iz, a, b, h = 1610.0, 2450.0, 1.20, 1.50, 0.55
    Re, Iw = 0.317, 2.4                  # una ruota per asse (inerzia di due ruote)
    Caf, Car = 110000.0, 125000.0        # rigidezza di deriva per asse [N/rad]
    Cx = 160000.0                        # rigidezza longitudinale [N per unità di scorrimento]
    mu = 1.0

    def __init__(self, v0=50.0):
        self.vx, self.vy, self.r = v0, 0.0, 0.0
        self.wf = self.wr = v0 / self.Re
        self.psi = self.X = self.Y = 0.0
        self.ax = 0.0
        self.Tgomma = [40.0, 40.0]       # temperatura degli pneumatici [°C]
        self.scoppiata = [False, False]
        self.bloccata = [False, False]

    def _forze_asse(self, vxw, vyw, omega, Fz, k):
        lam = max(-1.0, min(1.0, (omega * self.Re - vxw) / max(abs(vxw), abs(omega * self.Re), 0.5)))
        alpha = math.atan2(vyw, max(abs(vxw), 0.5))
        C = self.Caf if k == 0 else self.Car
        mu = self.mu * (0.25 if self.scoppiata[k] else 1.0)
        fx, fy = self.Cx * lam, -C * alpha
        n = math.hypot(fx, fy)
        lim = mu * Fz
        if n > lim:                               # cerchio d'aderenza: in strisciamento la forza è μ·Fz nella direzione dello scorrimento
            fx, fy = fx / n * lim, fy / n * lim
        vslip = math.hypot(omega * self.Re - vxw, vyw)
        return fx, fy, lam, alpha, abs(fx) * abs(omega * self.Re - vxw) + abs(fy) * abs(vyw), vslip

    def derivate(self, st, delta, Tm, Tbf, Tbr, Fext, Mext, Mesp):
        vx, vy, r, wf, wr = st
        L = self.a + self.b
        Fzf = self.b * self.m * G / L - self.h * self.m * self.ax / L
        Fzr = self.a * self.m * G / L + self.h * self.m * self.ax / L
        # velocità del centro ruota nel riferimento della ruota
        ufx, ufy = vx, vy + self.a * r
        vxwf = ufx * math.cos(delta) + ufy * math.sin(delta)
        vywf = -ufx * math.sin(delta) + ufy * math.cos(delta)
        Fxf, Fyf, lf, af, Pf, _ = self._forze_asse(vxwf, vywf, wf, Fzf, 0)
        Fxr, Fyr, lr, ar, Pr, _ = self._forze_asse(vx, vy - self.b * r, wr, Fzr, 1)
        aero = 0.41 * vx * abs(vx) + 190 * (1 if vx > 0 else -1 if vx < 0 else 0)
        dvx = r * vy + (Fxf * math.cos(delta) - Fyf * math.sin(delta) + Fxr - aero) / self.m
        dvy = -r * vx + (Fxf * math.sin(delta) + Fyf * math.cos(delta) + Fyr + Fext) / self.m
        dr = (self.a * (Fxf * math.sin(delta) + Fyf * math.cos(delta)) - self.b * Fyr + Mext + Mesp) / self.Iz   # Iz ṙ = a·Fyf − b·Fyr (+ momenti)
        dwf = 0.0 if self.bloccata[0] else (Tm - Tbf * math.tanh(wf / 0.3) - self.Re * Fxf) / self.Iw
        dwr = 0.0 if self.bloccata[1] else (-Tbr * math.tanh(wr / 0.3) - self.Re * Fxr) / self.Iw
        return [dvx, dvy, dr, dwf, dwr], (Fxf, Fyf, Fxr, Fyr, lf, lr, Pf, Pr)

    def passo(self, dt, delta, Tm, Tbf, Tbr, Fext=0.0, Mext=0.0, Mesp=0.0, sotto=8):
        h = dt / sotto
        for _ in range(sotto):
            s0 = [self.vx, self.vy, self.r, self.wf, self.wr]
            f = lambda s: self.derivate(s, delta, Tm, Tbf, Tbr, Fext, Mext, Mesp)
            k1, info = f(s0)
            k2, _ = f([s0[i] + h / 2 * k1[i] for i in range(5)])
            k3, _ = f([s0[i] + h / 2 * k2[i] for i in range(5)])
            k4, _ = f([s0[i] + h * k3[i] for i in range(5)])
            sn = [s0[i] + h / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]) for i in range(5)]
            Fx = (info[0], info[2])
            for k, (T, idx) in enumerate(((Tbf, 3), (Tbr, 4))):
                Tdrive = Tm if k == 0 else 0.0
                if self.bloccata[k]:
                    sn[idx] = 0.0
                    if T < abs(Tdrive - self.Re * Fx[k]) * 0.9:
                        self.bloccata[k] = False
                elif T > 0 and (s0[idx] > 0 >= sn[idx] or abs(sn[idx]) < 0.5) and T >= abs(Tdrive - self.Re * Fx[k]):
                    sn[idx] = 0.0
                    self.bloccata[k] = True
            self.vx, self.vy, self.r, self.wf, self.wr = sn
            self.ax = k1[0] - self.r * self.vy
            self.psi += self.r * h
            self.X += (self.vx * math.cos(self.psi) - self.vy * math.sin(self.psi)) * h
            self.Y += (self.vx * math.sin(self.psi) + self.vy * math.cos(self.psi)) * h
            # temperatura: potenza di strisciamento → calore (capacità termica 9 kJ/K per gomma), raffreddamento verso 40 °C
            for k, P in enumerate((info[6], info[7])):
                self.Tgomma[k] += h * (0.35 * P / 9000.0 - (self.Tgomma[k] - 40.0) / 60.0)
                if self.Tgomma[k] > 260.0 and not self.scoppiata[k]:
                    self.scoppiata[k] = True
            self.forze = info


def simula_confronto(durata=7.0, dt=0.016, v0=50.0, F_pit=3000.0, t_pit=(1.0, 1.5), t_frenata=3.0):
    """Due veicoli a 180 km/h subiscono la stessa manovra PIT. Il primo: centralina operativa (urto letto a 6 g), l'ESP controlla la sbandata.
    Il secondo: urto da 16 g sulla centralina (blackout). Dal secondo t_frenata il guidatore frena a fondo (frenata d'emergenza)."""
    out = []
    for nome, g in (('VEICOLO SANO', 6.0), ('CENTRALINA DISTRUTTA', 16.0)):
        v, vcu = ModelloBicicletta(v0), VehicleControlUnit()
        righe, colpito, beta_max = [], False, 0.0
        n = int(durata / dt)
        for k in range(n + 1):
            t = k * dt
            pit = t_pit[0] <= t < t_pit[1]
            if pit and not colpito:
                vcu.applica_impatto_soft_body(g, t=t)
                colpito = True
            freno = 1.0 if t >= t_frenata else 0.0
            Tm_cmd = (0.41 * v.vx * v.vx + 190) * v.Re if t < t_pit[0] else 0.0
            Tm, Tbf, Tbr, Mz = vcu.calcola(dt, v, 0.0, Tm_cmd, freno, v.Re)
            F = F_pit if pit else 0.0
            if math.hypot(v.vx, v.vy) > 0.3:
                v.passo(dt, 0.0, Tm, Tbf, Tbr, Fext=F, Mext=F * -(v.b + 0.9), Mesp=Mz)
            beta = math.atan2(v.vy, max(abs(v.vx), 0.1))
            beta_max = max(beta_max, abs(beta))
            if k % int(round(0.25 / dt)) == 0:
                i = vcu.ultimo
                righe.append('t=%4.2f s v=%5.1f km/h λf=%+5.2f λr=%+5.2f r=%+6.3f r_des=%+6.3f β=%+6.1f° ψ=%+7.1f° gomme %3.0f/%3.0f °C%s%s %s%s%s'
                             % (t, math.hypot(v.vx, v.vy) * 3.6, i.get('lam_f', 0), i.get('lam_r', 0), v.r, i.get('r_des', 0), math.degrees(beta),
                                math.degrees(v.psi), v.Tgomma[0], v.Tgomma[1], ' ESP' if i.get('esp') else '', ' ABS' if i.get('abs') else '',
                                vcu.VCU_STATUS, ' RUOTE BLOCCATE' if any(v.bloccata) else '',
                                ' [Una gomma è scoppiata per il calore]' if any(v.scoppiata) else ''))
        out.append({'caso': nome, 'stato': vcu.VCU_STATUS, 'beta_max_gradi': round(math.degrees(beta_max), 1), 'rotazione_gradi': round(math.degrees(v.psi), 1),
                    'gomme_scoppiate': sum(v.scoppiata), 'temperatura_max_gomme': round(max(v.Tgomma)), 'velocita_finale_kmh': round(math.hypot(v.vx, v.vy) * 3.6, 1),
                    'log': vcu.log, 'righe': righe})
    return out


if __name__ == '__main__':
    for r in simula_confronto():
        print('\n=== %s ===' % r['caso'])
        for t, msg in r['log']:
            print('[t=%.2f s] %s' % (t, msg))
        for x in r['righe']:
            print(x)
        print({k: v for k, v in r.items() if k not in ('log', 'righe')})
