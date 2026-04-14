# Intersezioni tra moduli

Questa sezione ti aiuta a vedere l'app come un sistema unico, non come blocchi separati.

Se ti chiedi "da dove nasce questo dato?" oppure "cosa succede dopo questo passaggio?", qui trovi la risposta.

---

## 1. Mappa connessioni principali

- **Core <-> tutti i moduli:** ruoli, azienda selezionata, abbonamento e navigazione governano tutto.
- **Terreni <-> Lavori/Attivita:** ogni lavoro nasce su un terreno; ore e attivita ereditano quel contesto.
- **Terreni <-> Vigneto/Frutteto:** anagrafiche coltura legate al terreno con confini condivisi.
- **Lavori/Attivita <-> Vigneto/Frutteto:** interventi tecnici collegati a lavoro o attivita.
- **Vigneto/Frutteto <-> Magazzino:** prodotti, dosaggi, scarichi e tracciabilita consumi.
- **Conto terzi <-> Lavori:** preventivo accettato diventa lavoro pianificato, poi ore e diario.
- **Core/Abbonamento <-> Moduli:** i flussi esistono solo se i moduli necessari sono attivi.
- **Report <-> tutti i moduli:** aggrega dati operativi e indicatori.

---

## 2. Flussi completi tra moduli

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

## 2.4 Flusso ore tra ruoli (da campo a controllo)

1. Operaio esegue il lavoro e registra ore.
2. Caposquadra controlla avanzamento squadra.
3. Manager verifica andamento complessivo e priorita.
4. I dati confluiscono in riepiloghi e controllo operativo.

### Procedura guidata: da preventivo a lavoro chiuso

**Quando usarla**  
Quando un cliente conto terzi accetta un preventivo e vuoi arrivare a chiusura lavoro senza passaggi persi.

**Percorso schermata**  
`Conto terzi` -> `Preventivi` -> `Lavori e attivita` -> `Validazione ore`.

**Dove cliccare**
- in `Preventivi`: riga preventivo, azione `Pianifica lavoro` (colonna azioni a destra);
- in `Lavori`: pulsante stato nella scheda lavoro;
- in `Validazione ore`: pulsante `Approva`/`Rifiuta` sulla singola riga ore.

**Passi operativi**
1. Apri il preventivo accettato e pianifica il lavoro.
2. Assegna caposquadra/operaio.
3. Fai registrare le ore giornaliere.
4. Valida le ore.
5. Chiudi il lavoro.

**Controllo finale riuscita**
- lavoro presente nello storico;
- ore validate;
- attività visibile nei riepiloghi.

### Procedura guidata: intervento coltura con scarico magazzino

**Percorso schermata**  
`Vigneto` o `Frutteto` -> `Trattamenti`/`Concimazioni` -> `Magazzino`.

**Dove cliccare**
- pulsante `Nuovo trattamento` o `Nuova concimazione` in alto;
- campo prodotti nella parte centrale del form;
- opzione scarico magazzino vicino a conferma intervento;
- in `Magazzino`, scheda `Tracciabilita consumi` (filtro in alto).

**Passi operativi**
1. Inserisci intervento con terreno e data.
2. Aggiungi prodotti e quantita.
3. Conferma scarico magazzino.
4. Apri tracciabilita e filtra per prodotto o terreno.

**Controllo finale riuscita**
- movimento di uscita visibile in magazzino;
- intervento visibile nel registro coltura.

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

### Esempi pratici con Tony

- "Portami dal preventivo accettato al lavoro operativo": Tony guida ti elenca il percorso completo; Tony operativo puo aprire i passaggi consentiti.
- "Ho registrato trattamento, controlla se ha scaricato magazzino": Tony guida ti indica dove verificare tracciabilita e filtri.

