# Backend dell'app companion — Informatore e Assalto al Rifugio

`informatore.py` (Python 3, solo libreria standard): chat a testo libero con l'informatore della Questura (classificazione delle frasi con
tolleranza agli errori di battitura), stato delle indagini (accuse con articoli inventati, prove, posizione, piano operativo) ed evento
«Assalto al Rifugio» con le tre fasi del GDD e il messaggio radio «Siamo in posizione, andiamo». Architettura dei dati nell'intestazione del file.

**Non collegato** al gioco né a un telefono: non esistono ancora il server dell'app companion né il servizio di notifiche push (le notifiche
sono messe in una coda). Il classificatore è a regole; al suo posto si può usare un modello linguistico locale che restituisca lo stesso intento.

`python3 informatore.py` → dimostrazione (uscita in `docs/test/informatore_uscita.txt`). Test: `python3 tools/test_moduli_python.py`.
