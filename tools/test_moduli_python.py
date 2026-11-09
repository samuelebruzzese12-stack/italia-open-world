# -*- coding: utf-8 -*-
"""Test dei moduli Python (dinamica 7-DoF, VCU-EBS, informatore). Uso: python3 tools/test_moduli_python.py"""
import math
import os
import sys
import unittest

QUI = os.path.dirname(os.path.abspath(__file__))
sys.path[:0] = [os.path.join(QUI, 'dinamica'), os.path.join(QUI, 'companion')]
import dinamica_7dof as D7      # noqa: E402
import vcu_ebs as VE            # noqa: E402
import informatore as INF       # noqa: E402


class Dinamica7DoF(unittest.TestCase):
    def test_frenata_dritta_senza_urto_non_gira(self):
        r = D7.execute_high_fidelity_simulation(durata=3.0, F_pit=0.0, t_freno=1.0, stampa=False)
        for c in r:
            self.assertLess(abs(c['rotazione_totale_gradi']), 0.5, c)

    def test_blackout_blocca_le_ruote_e_abs_no(self):
        r = D7.execute_high_fidelity_simulation(durata=3.0, F_pit=0.0, t_freno=1.0, stampa=False)
        self.assertEqual(r[0]['ruote_bloccate'], 0)       # ABS attivo
        self.assertEqual(r[1]['ruote_bloccate'], 4)       # blackout: ruote bloccate

    def test_esp_recupera_la_pit_moderata_senza_frenata(self):
        r = D7.execute_high_fidelity_simulation(durata=5.0, F_pit=3000.0, t_freno=99.0, stampa=False)
        self.assertLess(r[0]['beta_max_gradi'], 30)                      # sano: deriva contenuta
        self.assertGreater(r[1]['beta_max_gradi'], 80)                   # blackout: testacoda

    def test_magic_formula_simmetrica(self):
        v = D7.SevenDoFVehicleDynamics(v0=30.0)
        s = list(v.s)
        s[1] = 1.0
        Fx, Fy, _, _ = v.forze_ruote(s, 0.0, v.carichi())
        s[1] = -1.0
        Fx2, Fy2, _, _ = v.forze_ruote(s, 0.0, v.carichi())
        for a, b in zip(Fy, Fy2):
            self.assertAlmostEqual(a, -b, places=6)


class Dinamica200Hz(unittest.TestCase):
    """Configurazione predefinita (200 Hz, 1610 kg, Iz 2450, 50 m/s) e telemetria campionata a ogni passo dopo l'urto a 16 g."""

    @classmethod
    def setUpClass(cls):
        cls.r = D7.execute_high_fidelity_simulation(durata=4.0, F_pit=3000.0, t_freno=1.5, stampa=False)
        cls.sano, cls.ko = cls.r[0]['telemetria'], cls.r[1]['telemetria']

    def test_parametri_predefiniti(self):
        P = D7.Parametri()
        self.assertEqual((D7.DT, P.m, P.Iz, D7.V0), (0.005, 1610.0, 2450.0, 50.0))
        self.assertEqual(D7.SevenDoFVehicleDynamics().s[0], 50.0)

    def test_un_campione_ogni_5_ms(self):
        for T in (self.sano, self.ko):
            self.assertEqual(len(T), 801)                                  # 4 s a 200 Hz, estremi compresi
            for a, b in zip(T, T[1:]):
                self.assertAlmostEqual(b[0] - a[0], 0.005, places=9)

    def test_blackout_azzera_esp_e_tcs_a_ogni_campione(self):
        self.assertFalse(any(x[8] for x in self.ko if x[0] < 1.0))       # prima dell'urto la centralina funziona
        dopo = [x for x in self.ko if x[0] >= 1.0]
        self.assertTrue(all(x[8] for x in dopo))
        self.assertTrue(all(x[6] == 0.0 and x[7] == 0.0 for x in dopo))   # Mz dell'ESP e taglio di coppia del TCS a zero
        self.assertFalse(any(x[8] for x in self.sano))
        self.assertGreater(max(abs(x[6]) for x in self.sano), 1000.0)      # l'auto sana riceve la correzione dell'ESP

    def test_ruote_bloccate_e_testacoda(self):
        bloccati = [x for x in self.ko if x[0] >= 1.5 and max(x[5]) <= -0.99]
        self.assertGreater(len(bloccati), 100)                             # λ = −1 su tutte e quattro per oltre 0,5 s
        self.assertGreater(min(min(x[5]) for x in self.sano), -0.5)        # con l'ABS nessuna ruota si blocca
        self.assertGreater(abs(self.r[1]['rotazione_totale_gradi']), 150)
        self.assertGreater(max(abs(x[2]) for x in self.ko), math.radians(80))


class VcuEbs(unittest.TestCase):
    def test_blackout_e_log(self):
        u = VE.VehicleControlUnit()
        u.applica_impatto_soft_body(16.0, t=0.0)
        self.assertEqual(u.VCU_STATUS, 'HARDWARE_FAILURE')
        self.assertIn('ABS/ESP Disattivati - Controllo puramente meccanico', u.log[0][1])

    def test_confronto(self):
        r = VE.simula_confronto()
        self.assertLess(r[0]['beta_max_gradi'], 15)
        self.assertGreater(r[1]['beta_max_gradi'], 80)

    def test_slip_ratio(self):
        self.assertAlmostEqual(VE.VehicleControlUnit.slip_ratio(100.0, 0.3, 30.0), 0.0, places=6)
        self.assertAlmostEqual(VE.VehicleControlUnit.slip_ratio(0.0, 0.3, 30.0), -1.0, places=6)


class Informatore(unittest.TestCase):
    def test_intenti_anche_con_errori(self):
        c = INF.ClassificatoreIntenti()
        self.assertEqual(c.classifica('di cosa sono accusato?')[0], 'accuse')
        self.assertEqual(c.classifica('cosa ha scopertto la scientifca')[0], 'indagini')
        self.assertEqual(c.classifica('qual è il piamo per il rifugio')[0], 'piani')
        self.assertEqual(c.classifica('asdf qwerty')[0], 'incomprensibile')

    def test_assalto_a_fine_piano(self):
        s = INF.StatoIndagine()
        s.stelle, s.piano.attivo, s.ultima_posizione = 5, True, ('Genova', 44.4, 8.9)
        inf = INF.Informatore(s)
        inf.log = lambda riga: inf.registro.append(riga)
        esito = None
        for _ in range(30):
            esito = inf.tempo(5, giocatore_nel_rifugio=False) or esito
        self.assertTrue(any('Siamo in posizione, andiamo' in r for r in inf.registro))
        self.assertIn('rifugio vuoto', esito)
        self.assertIn('Movimenti sospetti attorno al covo', inf.notifiche.coda[0])


if __name__ == '__main__':
    unittest.main(verbosity=2)
