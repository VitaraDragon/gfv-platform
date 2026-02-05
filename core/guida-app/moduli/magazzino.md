# Modulo Prodotti e Magazzino

Blocco della guida dedicato al **modulo Prodotti e Magazzino**: anagrafica prodotti, categorie, unità di misura, movimenti (entrate/uscite), giacenze e alert sotto scorta. Relazioni con Trattamenti (Vigneto/Frutteto), Lavori e Attività.

---

## 1. Titolo

**Modulo Prodotti e Magazzino** – Anagrafica prodotti, categorie, movimenti e giacenze.

---

## 2. Scopo

Permettere di **gestire l’anagrafica prodotti** (nome, codice, categoria, unità di misura, scorta minima, prezzo, dosaggi e giorni di carenza per i fitofarmaci), di **registrare movimenti** di magazzino (entrate e uscite) con aggiornamento automatico della **giacenza**, e di **visualizzare alert** per prodotti sotto scorta minima. I prodotti possono essere referenziati nei **trattamenti** Vigneto e Frutteto (prodottoId) per tracciare consumo e costi; i movimenti possono essere collegati a un **lavoro** o a un’**attività**. Il modulo è a **pagamento** (piano Base, moduli pay-per-use).

---

## 3. Dove si trova

- **Dashboard principale:** card **Prodotti e Magazzino** (📦) → link a **Prodotti e Magazzino** (`modules/magazzino/views/magazzino-home-standalone.html`).
- **Home Magazzino:** punto di ingresso del modulo; statistiche (prodotti sotto scorta minima, prodotti attivi, movimenti ultimi 30 giorni); card per:
  - **Anagrafica Prodotti** → `prodotti-standalone.html`
  - **Movimenti** → `movimenti-standalone.html`
- Nella Dashboard principale può essere mostrato un **alert** (es. numero prodotti sotto scorta minima) con link alla anagrafica prodotti. Accesso tipicamente riservato a **Manager** e **Amministratore**.

---

## 4. Funzionalità principali

- **Anagrafica prodotti:** ogni **prodotto** è un documento (collection `prodotti`) con: **nome** (obbligatorio), **codice** interno (opzionale), **categoria** (fitofarmaci, fertilizzanti, materiale impianto, ricambi, sementi, altro), **unità di misura** (kg, L, pezzi, m, m², confezione, sacchi, altro), **scorta minima** (per alert sotto scorta), **prezzo unitario** di riferimento (€/unità), **giacenza** corrente (aggiornata dai movimenti). Per prodotti fitosanitari: **dosaggio minimo/massimo** per ha (es. L/ha, kg/ha), **giorni di carenza** pre-raccolta. Note e flag **attivo** (i prodotti si **disattivano** per mantenere lo storico, non si eliminano). Creazione, modifica, disattivazione prodotti; filtri per categoria e solo attivi.
- **Categorie prodotto:** le categorie sono predefinite (config `categorie-prodotto.js`): Fitofarmaci, Fertilizzanti, Materiale impianto, Ricambi, Sementi, Altro. Usate per filtrare e raggruppare i prodotti.
- **Unità di misura:** predefinite: kg, L, pezzi, m, m², confezione, sacchi, altro. Ogni prodotto ha un’unità di misura; i movimenti e i dosaggi nei trattamenti usano la stessa unità.
- **Movimenti:** collection `movimentiMagazzino`. Ogni movimento ha: **prodotto**, **data**, **tipo** (entrata o uscita), **quantità** (> 0), **prezzo unitario** (opzionale, tipico per entrate), **lavoroId** e **attivitaId** (opzionali, per collegare l’uscita a un lavoro o a un’attività), note, userId, confezione. Alla creazione di un movimento la **giacenza** del prodotto viene aggiornata: **entrata** → giacenza + quantità; **uscita** → giacenza − quantità. Lo **scarico oltre giacenza** è consentito (la giacenza può diventare negativa); l’interfaccia può mostrare un alert in quel caso.
- **Giacenza:** campo **giacenza** nel documento prodotto; non si modifica manualmente ma solo tramite **movimenti**. La dashboard e l’anagrafica mostrano la giacenza corrente; i prodotti con giacenza < scorta minima (se scorta minima > 0) sono considerati **sotto scorta** e possono essere evidenziati (alert, conteggio “prodotti sotto scorta minima”).
- **Alert sotto scorta:** nella Home Magazzino e nella Dashboard principale (se integrato) viene mostrato il numero di **prodotti sotto scorta minima** (giacenza < scorta minima); link rapido all’anagrafica prodotti per correggere ordini o registrare entrate.
- **Validazioni:** prodotto: nome obbligatorio, scorta minima e prezzo non negativi, dosaggio max ≥ dosaggio min, giorni carenza non negativi. Movimento: prodotto, data e tipo obbligatori; quantità > 0; per entrata prezzo unitario non negativo se valorizzato.

---

## 5. Termini specifici

| Termine | Definizione breve |
|--------|--------------------|
| **Prodotto** | Anagrafica di un articolo in magazzino: nome, categoria, unità di misura, scorta minima, prezzo, giacenza, eventuali dosaggi e giorni di carenza. |
| **Categoria** | Classificazione del prodotto: Fitofarmaci, Fertilizzanti, Materiale impianto, Ricambi, Sementi, Altro. |
| **Giacenza** | Quantità corrente in magazzino del prodotto; aggiornata automaticamente dai movimenti (entrate/uscite). |
| **Scorta minima** | Soglia sotto la quale il prodotto è considerato “sotto scorta”; usata per alert e avvisi. |
| **Movimento** | Registrazione di un’entrata o un’uscita di magazzino: prodotto, data, tipo (entrata/uscita), quantità; opzionalmente lavoro/attività collegati. |
| **Entrata** | Movimento che aumenta la giacenza (acquisto, reso, ecc.). |
| **Uscita** | Movimento che diminuisce la giacenza (utilizzo, trattamento, lavoro, ecc.). |
| **Sotto scorta** | Prodotto con giacenza inferiore alla scorta minima (se impostata). |
| **Prodotto attivo** | Prodotto con flag attivo = true; i prodotti disattivati restano in archivio per lo storico ma non compaiono nelle liste operative (es. scelta in trattamento). |

---

## 6. Limitazioni e regole

- **Modulo a pagamento:** il modulo Prodotti e Magazzino è attivabile solo con **piano Base** (€5/mese) e ha costo aggiuntivo (pay-per-use, es. €3/mese). Con piano Free il modulo non è disponibile.
- **Permessi:** l’accesso al modulo (Home Magazzino, Anagrafica prodotti, Movimenti) è tipicamente riservato a **Manager** e **Amministratore**. Altri ruoli non vedono la card o ricevono un messaggio di errore.
- **Prodotti:** non si eliminano fisicamente; si **disattivano** (attivo = false) per mantenere lo storico movimenti e riferimenti nei trattamenti. I prodotti disattivati possono essere esclusi dalle liste (filtro “solo attivi”).
- **Movimenti:** ogni movimento modifica la **giacenza** del prodotto. Lo **scarico oltre giacenza** è consentito (giacenza può andare in negativo); l’UI può mostrare un avviso. I movimenti possono essere collegati a **lavoroId** e **attivitaId** per tracciare l’uso (es. uscita per un trattamento collegato a un lavoro).
- **Relazione con trattamenti:** nei moduli Vigneto e Frutteto i trattamenti possono referenziare un prodotto tramite **prodottoId**; in quel caso nome, dosaggio, costo e eventuale scarico (uscita movimento) sono coerenti con l’anagrafica Magazzino. Senza modulo Magazzino i trattamenti usano solo nome e costo liberi.

---

## 7. Relazioni con altri moduli

- **Vigneto / Frutteto (Trattamenti):** nei **trattamenti** vigneto e frutteto i prodotti possono essere scelti dall’anagrafica Magazzino (**prodottoId**). Si tracciano nome, dosaggio, quantità e costo; opzionalmente si può registrare un’**uscita** di magazzino (movimento) collegata al trattamento/lavoro, aggiornando la giacenza. I campi **dosaggio** e **giorni di carenza** del prodotto (se presenti) possono essere usati nei form trattamento.
- **Lavori e attività:** i **movimenti** di tipo uscita possono essere collegati a un **lavoro** (`lavoroId`) o a un’**attività** (`attivitaId`) per indicare che il prodotto è stato usato in quel contesto (es. trattamento su un lavoro di potatura).
- **Core (Dashboard):** la Dashboard principale può mostrare la card **Prodotti e Magazzino** e un **alert** “prodotti sotto scorta minima” (conteggio e link) se il modulo è attivo; il caricamento del conteggio sotto scorta avviene lato client (es. dashboard-data).
- **Permessi:** solo Manager e Amministratore accedono al modulo; i trattamenti Vigneto/Frutteto possono comunque referenziare prodotti (prodottoId) anche se la gestione magazzino è limitata ai ruoli sopra.

Dettagli sui flussi che coinvolgono più moduli (es. trattamento → scelta prodotto Magazzino → uscita movimento → aggiornamento giacenza) in **Intersezioni tra moduli** (`intersezioni-moduli.md`).
