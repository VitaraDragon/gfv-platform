# Intersezioni tra moduli

Questa sezione ti aiuta a vedere l'app come un sistema unico, non come blocchi separati.

Se ti chiedi "da dove nasce questo dato?" oppure "cosa succede dopo questo passaggio?", qui trovi la risposta.

---

## 1. Mappa connessioni principali

- **Core <-> tutti i moduli:** ruoli, tenant, abbonamento e navigazione governano tutto.
- **Terreni <-> Lavori/Attivita:** ogni lavoro nasce su un terreno; ore e attivita ereditano quel contesto.
- **Terreni <-> Vigneto/Frutteto:** anagrafiche coltura legate al terreno con confini condivisi.
- **Lavori/Attivita <-> Vigneto/Frutteto:** interventi tecnici collegati a lavoro o attivita.
- **Vigneto/Frutteto <-> Magazzino:** prodotti, dosaggi, scarichi e tracciabilita consumi.
- **Conto terzi <-> Lavori:** preventivo accettato diventa lavoro pianificato, poi ore e diario.
- **Core/Abbonamento <-> Moduli:** i flussi esistono solo se i moduli necessari sono attivi.
- **Report <-> tutti i moduli:** aggrega dati operativi e indicatori.

---

## 2. Flussi end-to-end

## 2.1 Preventivo conto terzi -> lavoro -> ore -> diario

1. Creazione preventivo (cliente, terreno cliente, tipo lavoro, tariffe).
2. Invio al cliente e accettazione.
3. Pianificazione lavoro da preventivo.
4. Segnatura ore e validazione.
5. Tracciamento nel diario/statistiche.

Ruoli coinvolti: manager/amministratore per preventivi e pianificazione; caposquadra/operaio per esecuzione.

## 2.2 Trattamento/concimazione -> scarico magazzino -> tracciabilita

1. Registrazione intervento in Vigneto o Frutteto.
2. Scelta prodotti e dosaggi.
3. Opzione scarico magazzino.
4. Creazione movimenti di uscita.
5. Consultazione in tracciabilita consumi (vista raggruppata o dettaglio).

Ruoli coinvolti: principalmente manager/amministratore.

## 2.3 Lavoro agricolo con aree lavorate

1. Lavoro assegnato su terreno.
2. Esecuzione da caposquadra/operaio.
3. Aggiornamento stato, note, eventuale sospensione/ripresa.
4. Tracciamento area lavorata nei moduli specialistici.
5. Chiusura lavoro e consolidamento ore/attivita.

---

## 3. Ruoli nelle intersezioni

- **Manager/Amministratore:** controllo completo su configurazione, pianificazione e moduli.
- **Caposquadra:** coordinamento operativo su lavori assegnati e gestione ore della squadra.
- **Operaio:** esecuzione attivita e registrazione ore in dashboard semplificata.

Punto chiave: la stessa funzione puo comportarsi in modo diverso in base al ruolo, anche nella stessa pagina.

---

## 4. Piani e disponibilita flussi

- Un flusso cross-modulo funziona solo se tutti i moduli coinvolti sono attivi.
- Esempio: scarico da trattamento richiede modulo coltura + modulo magazzino.
- Se manca un modulo, il flusso resta parziale (ad esempio registro intervento senza scarico).

---

## 5. Tony e intersezioni

- Tony Guida deve spiegare con chiarezza i passaggi tra moduli.
- Tony Avanzato puo accompagnare anche l'esecuzione operativa quando attivo.
- In freemium senza Tony, la guida documentale copre gli stessi percorsi in modo manuale.

---

## 6. Manutenzione

Quando cambia un modulo, aggiorna subito:

1. file del modulo;
2. questa pagina intersezioni;
3. eventuali riferimenti in `core.md`.
