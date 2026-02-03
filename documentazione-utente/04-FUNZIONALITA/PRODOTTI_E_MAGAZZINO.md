# 📦 Guida Funzionalità – Prodotti e Magazzino

Gestisci l’anagrafica prodotti, le giacenze e i movimenti (entrate/uscite) in un unico posto. Il modulo è acquistabile separatamente (3 €/mese) e può essere usato da solo o insieme ai moduli specializzati (Vigneto, Frutteto) per collegare i trattamenti allo scarico in magazzino.

---

## 🎯 Obiettivi

- Tenere un **catalogo prodotti** unico (nome, categoria, unità di misura, scorta minima, prezzo)
- Registrare **entrate** (acquisti, resi, rettifiche) e **uscite** (consumi, vendite, rettifiche)
- Vedere la **giacenza** aggiornata per ogni prodotto e gli **alert** sotto scorta minima
- Consultare lo **storico movimenti** con prezzo unitario e prezzo totale

---

## 👥 Ruoli richiesti

- **Manager** (pieno accesso)
- **Amministratore** (pieno accesso)

Solo Manager e Amministratore possono accedere al modulo Prodotti e Magazzino.

---

## 🧭 Percorso

1. Dashboard → sezione **Prodotti e Magazzino**
2. Dalla home del modulo puoi andare a **Anagrafica Prodotti** o **Movimenti Magazzino**

---

## 📋 Anagrafica Prodotti

- **Lista prodotti**: filtri per stato (attivi/disattivati), categoria, ricerca per nome o codice
- **Nuovo prodotto**: codice, nome, categoria, **unità di misura** (kg, L, pezzi, m, m², ecc.), scorta minima, prezzo unitario (opzionale), note. Per i prodotti usati nei **trattamenti** (Vigneto/Frutteto) puoi impostare anche **Dosaggio min (per ha)** e **Dosaggio max (per ha)** (intervallo di dose consigliata per ettaro) e **Giorni di carenza** (intervallo in giorni tra ultimo trattamento e raccolta consentita); questi campi vengono usati nel modal Trattamenti per calcoli e avvisi
- Le categorie includono **fitofarmaci**, **fertilizzanti**, **materiale impianto** (pali, fili, tutori, ancore, reti, ecc.), ricambi, sementi, altro: il magazzino serve sia per i prodotti usati nei trattamenti sia per i materiali consumati in lavori di impianto o manutenzione
- **Suggerimento**: per dosi frazionarie (es. trattamenti) usa **L** o **kg** come unità di misura. Se compili dosaggio min/max, il dosaggio max deve essere ≥ dosaggio min
- **Modifica**: modifica nome, categoria, scorta, prezzo, note, e (se applicabile) dosaggio min/max e giorni di carenza
- **Disattivazione**: i prodotti non si eliminano; si **disattivano** per mantenere lo storico nei movimenti e nei report. I prodotti disattivati non compaiono nei filtri “solo attivi” e non sono selezionabili nei nuovi movimenti

---

## 📥📤 Movimenti Magazzino

### Nuovo movimento

1. Dalla pagina **Movimenti Magazzino** clicca **Nuovo Movimento**
2. Compila:
   - **Prodotto** (obbligatorio)
   - **Data** (obbligatorio)
   - **Tipo**: Entrata o Uscita
   - **Quantità** (obbligatoria, in unità del prodotto: es. L o kg). La label diventa “Quantità (L)” o “Quantità (kg)” in base al prodotto selezionato
   - **Confezione** (opzionale): es. “1 bidone 5 L”, “2 sacchi 25 kg” — solo informativo, non cambia la giacenza
   - **Prezzo unitario** (opzionale, per le entrate): utile per storico costi e prezzo totale
   - **Note** (opzionale)
   - **Lavoro** (opzionale): collega il movimento a un lavoro (Gestione Lavori) per tracciabilità
   - **Attività** (opzionale): collega il movimento a un’attività per tracciabilità
3. In caso di **uscita** superiore alla giacenza disponibile viene mostrato un avviso: lo scarico è comunque **permesso** (la giacenza può andare in negativo)
4. Salva: la **giacenza** del prodotto viene aggiornata automaticamente

### Modifica movimento

- In elenco movimenti clicca **Modifica** sul movimento da correggere
- Modifica i campi (prodotto, data, tipo, quantità, confezione, prezzo, note) e salva
- La giacenza viene ricalcolata: prima si “annulla” il vecchio movimento sul prodotto, poi si applica il nuovo

### Elimina movimento

- Clicca **Elimina** sul movimento: la giacenza del prodotto viene **ripristinata** (il movimento viene rimosso dallo storico)

### Colonne in elenco movimenti

- Data, Prodotto, Tipo (Entrata/Uscita), Quantità (con unità), Confezione, Prezzo unit. (€), **Prezzo tot. (€)** (calcolato = prezzo unitario × quantità), **Lavoro**, **Attività**, Note, Azioni (Modifica, Elimina)

---

## ⚠️ Alert scorta minima

- I prodotti con **giacenza sotto la scorta minima** compaiono nella **home del modulo** e nella **dashboard Manager** (card Prodotti e Magazzino con numero prodotti sotto scorta)
- Serve a ricordare di riordinare prima che finisca il prodotto

---

## 🔗 Collegamento a lavori e attività

### Se non hai moduli specializzati (Vigneto/Frutteto) attivi

- Tutti gli scarichi si fanno **manualmente** dalla pagina Movimenti Magazzino
- Puoi usare le **note** di un’**attività** o di un **lavoro** (Gestione Lavori) per annotare i quantitativi usati (es. “Usati 10 L di prodotto X, 5 kg di prodotto Y”) e in seguito andare in Magazzino a registrare le uscite, usando le note come promemoria
- Nel form di nuovo/modifica movimento puoi **collegare** il movimento a un **Lavoro** o a un’**Attività** (dropdown opzionali): così l’uscita risulta associata a quel lavoro/attività per tracciabilità e report

### Se hai moduli specializzati attivi (es. Trattamenti Vigneto/Frutteto)

- Nei **Trattamenti** (Vigneto e Frutteto) puoi scegliere uno o più prodotti dall’anagrafica Magazzino: per ogni riga si indicano prodotto, dosaggio per ha e (opzionale) costo; **quantità** e **costo** vengono calcolati in base a superficie trattata e prezzo/dosaggio. I campi dosaggio min/max e giorni di carenza dell’anagrafica prodotti vengono usati per calcoli e avvisi nel modal Trattamenti (alert in salvataggio se fuori range, colonna Avvisi in lista con bollino verde/⚠️). Vedi la guida [Trattamenti Vigneto e Frutteto](TRATTAMENTI_VIGNETO_FRUTTETO.md)
- Lo **scarico automatico** in magazzino dal trattamento (un clic per creare l’uscita collegata) è previsto in una fase successiva; in Magazzino le entrate e uscite restano comunque registrabili anche a mano

---

## ✅ Riepilogo valore del modulo

| Situazione | Cosa ti serve |
| --- | --- |
| **Solo Prodotti e Magazzino** | Catalogo prodotti, giacenze, entrate/uscite manuali, alert sotto scorta, storico costi (prezzo unitario e totale). Utile per chi vuole tenere sotto controllo magazzino e costi anche senza Vigneto/Frutteto. |
| **Prodotti e Magazzino + Vigneto/Frutteto** | Oltre a quanto sopra: collegamento trattamenti → scarico in magazzino (un clic per aggiornare le giacenze dopo un trattamento) e tracciabilità trattamento ↔ movimento. |

---

Hai bisogno di approfondire? Consulta la [FAQ](../02-FAQ.md), le guide per [Gestione Lavori](GESTIONE_LAVORI.md) e per [Trattamenti Vigneto e Frutteto](TRATTAMENTI_VIGNETO_FRUTTETO.md).
