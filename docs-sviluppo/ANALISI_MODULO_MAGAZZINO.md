# 📦 Analisi e Proposta: Modulo Prodotti e Magazzino

**Data**: 2026-02-03 (aggiornamento: uso dosaggio min/max nei Trattamenti Vigneto/Frutteto per alert e colonna Avvisi) | 2026-02-02  
**Obiettivo**: Capire cosa potrebbe servire per il modulo **Prodotti e Magazzino** e come svilupparlo in coerenza con GFV Platform.  
**Nota**: Documento di analisi e piano, senza codice.

---

## 0. Decisioni di progetto (confermate)

| # | Aspetto | Decisione |
|---|--------|------------|
| 1 | **Permessi** | Solo Manager e Amministratore possono usare il modulo. |
| 2 | **Prezzo e abbonamento** | Il modulo costa **3 €** (separato) e **non fa parte di nessun piano**; il sistema abbonamento è stato cambiato (pagina abbonamento aggiornata). |
| 3 | **Eliminazione prodotti** | I prodotti non si eliminano: si **disattivano** per mantenere lo storico (movimenti e report restano coerenti). |
| 4 | **Scarico oltre giacenza** | Lo scarico è **permesso** anche se la quantità supera la giacenza; in quel caso si mostra un **alert** (es. giacenza negativa o “scarico superiore alla disponibilità”). |
| 5 | **Prezzo prodotto** | Ogni prodotto ha il suo prezzo; in caso di **acquisti ripetuti** dello stesso prodotto, le **variazioni di prezzo** sono registrate normalmente (ogni movimento di entrata può avere il prezzo dell’acquisto). |
| 6 | **Riferimento a lavori/attività** | Si sviluppa **da subito** il collegamento movimenti ↔ lavori/attività. In seguito si deciderà come invogliare l’utente a comprare anche i moduli specializzati (Vigneto/Frutteto) per avere il plus (es. trattamento con prodotto da anagrafica e scarico automatico). |
| 7 | **Alert scorta minima** | L’alert “sotto scorta minima” va mostrato **anche nella dashboard Manager** (oltre che nella home del modulo). |
| 8 | **Nome modulo in interfaccia** | Il modulo si chiama **“Prodotti e Magazzino”** (menu, dashboard, documentazione). |

---

## 1. Contesto attuale in piattaforma

### Cosa c’è già (e dove “tocca” il magazzino)

- **Trattamenti vigneto e frutteto**  
  Nei trattamenti si inserisce un campo **prodotto** (testo libero), dosaggio, costo prodotto, giorni di carenza. Non esiste un’anagrafica prodotti né tracciamento delle scorte: il prodotto è solo un nome e il costo si inserisce a mano per ogni trattamento.

- **Calcolo materiali (vigneto)**  
  Il servizio calcola le quantità necessarie per l’impianto (pali, fili, tutori, ancore, reti antigrandine, ecc.) a partire da pianificazione e configurazione. Non gestisce giacenze né “consumo” da magazzino.

- **Lavori e attività**  
  Lavori e attività sono il punto in cui si “fa” qualcosa sul campo (trattamenti, impianti, ecc.). Sono il naturale punto di collegamento per “consumo” di prodotti/materiali.

Quindi oggi:
- non c’è anagrafica prodotti unica;
- non c’è tracciamento quantità in magazzino;
- non c’è collegamento automatico tra “uso” (trattamento, lavoro) e “scarico” da magazzino.

Il modulo **Prodotti e Magazzino** introduce anagrafica prodotti, scorte e movimenti, e (opzionalmente) li collega a trattamenti e altri usi.

---

## 2. Cosa potrebbe servire (funzionalità)

### 2.1 Anagrafica prodotti / materiali

- **Prodotto (o Articolo)** con almeno:
  - Codice (interno) e nome
  - Categoria/tipo: fitofarmaci, fertilizzanti, materiale impianto (pali, fili, ecc.), ricambi, sementi, altro
  - Unità di misura: kg, L, pezzi, m, m², confezione, ecc.
  - Scorta minima (soglia per alert “in esaurimento”)
  - Opzionale: unità di misura di acquisto vs uso (es. acquisto in kg, uso in L dopo diluizione)
- Per **fitofarmaci / prodotti con scadenza** (opzionale in una prima fase):
  - Lotto e data di scadenza (se si vuole tracciare per lotto)
  - Giorni di carenza (anche solo a livello prodotto, come riferimento)
- **Prezzo**: ogni prodotto ha il suo prezzo; in caso di acquisti ripetuti, le variazioni di prezzo sono registrate normalmente (ogni entrata può avere il prezzo dell’acquisto). Utile per report “valore magazzino” e costo trattamenti.

L’anagrafica è la base: senza un “prodotto” non si possono fare movimenti né collegare i trattamenti a uno scarico reale.

### 2.2 Scorte e giacenze

- **Giacenza corrente** per prodotto: quantità disponibile “in magazzino”.
- La giacenza può essere:
  - **Calcolata**: somma di tutti i movimenti (entrate − uscite) a partire da un’origine (primo carico o rettifica iniziale); oppure
  - **Memorizzata** sul prodotto e aggiornata a ogni movimento (più semplice da interrogare per liste e dashboard).
- Opzionale (fase successiva): più **ubicazioni** (magazzino centrale, deposito campo A/B) con giacenza per prodotto e ubicazione.

### 2.3 Movimenti di magazzino

- **Tipi di movimento** utili in agricoltura:
  - **Entrata**: acquisto, reso, dono, rettifica in più
  - **Uscita / Scarico**: consumo (trattamento, impianto, altro uso), rettifica in meno
  - **Trasferimento** (solo se si introducono più ubicazioni)
- Per ogni movimento:
  - Data, prodotto, quantità (+ unità di misura)
  - Tipo (entrata/uscite/trasferimento)
  - **Riferimento opzionale**: lavoro, attività, trattamento vigneto/frutteto (collegamento sviluppato da subito; il plus con moduli specializzati si valorizzerà in seguito per invogliare l'acquisto).
  - Note, operatore, eventuale lotto se si gestiscono i lotti
- **Scarico oltre giacenza**: permesso; in quel caso si mostra un alert (es. giacenza negativa).
- Lo **scarico** può essere:
  - Manuale (solo “ho usato X kg di prodotto Y”)
  - Oppure **collegato** a un trattamento: “questo trattamento ha usato prodotto Y → crea movimento di scarico”

### 2.4 Integrazioni con il resto della piattaforma

- **Trattamenti (vigneto e frutteto)**  
  - In fase di creazione/modifica trattamento: scelta del **prodotto da anagrafica magazzino** (dropdown/search) invece di testo libero.
  - Opzionale: alla conferma del trattamento, creazione automatica di un **movimento di scarico** (quantità usata = funzione di dosaggio × superficie trattata, o valore inserito a mano).
  - Il trattamento può continuare a memorizzare nome prodotto, dosaggio, costo: il costo può venire dall’ultimo prezzo di acquisto del prodotto in magazzino o essere sovrascrivibile.

- **Calcolo materiali (impianto vigneto)**  
  - Dopo il calcolo “materiali necessari” si potrebbe (fase avanzata):
    - Confrontare con le giacenze (per ogni voce: “quantità necessaria” vs “quantità in magazzino”);
    - Mostrare “da acquistare” = max(0, necessaria − giacenza);
    - Opzionale: creare una “lista prelievo” o ordine basato su questo.

- **Lavori / Attività**  
  - Un lavoro “Trattamento” o “Impianto” può essere il riferimento del movimento (lavoroId / attivitaId). Non è obbligatorio partire dai trattamenti vigneto/frutteto: si può anche solo registrare “scarico per lavoro X” senza form trattamento dedicato.

### 2.5 Alert e report

- **Alert**:
  - Giacenza sotto scorta minima (“prodotto in esaurimento”): mostrato **nella home del modulo** e **anche nella dashboard Manager**.
  - Prodotti in scadenza (se si gestiscono lotto/scadenza)
- **Report / statistiche**:
  - Movimenti per periodo (entrate/uscite)
  - Consumi per tipo (es. per categoria prodotto, per campagna)
  - Valore magazzino (somma quantità × prezzo per prodotto)
  - Storico per prodotto (andamento giacenza nel tempo)

---

## 3. Come svilupparlo (struttura e fasi)

### 3.1 Allineamento agli altri moduli

La piattaforma ha moduli in `modules/` con struttura ricorrente:

- **models/** – Modelli dati (estendono Base, con validazione)
- **services/** – Logica CRUD e regole di business (Firestore, multi-tenant)
- **views/** – Pagine standalone (HTML + script)
- **config/** – (opzionale) Costanti, liste (es. categorie prodotto)

Il modulo Prodotti e Magazzino può seguire lo stesso schema:  
`modules/magazzino/` (o `modules/prodotti-magazzino/`) con `models/`, `services/`, `views/`, eventuale `config/`. In interfaccia il nome è **“Prodotti e Magazzino”**.

### 3.2 Modelli dati suggeriti

- **Prodotto (o Articolo)**  
  Anagrafica: id, tenantId, codice, nome, categoria, unitàDiMisura, scortaMinima, prezzo (per prodotto; le variazioni negli acquisti si registrano nei movimenti di entrata), note, **attivo** (true/false). I prodotti non si eliminano: si **disattivano** per mantenere lo storico.  
  Se si gestiscono i lotti in seguito: si può aggiungere una collezione “Lotti” (prodottoId, lotto, scadenza, quantità) oppure gestire il lotto solo sul movimento.

- **MovimentoMagazzino**  
  id, tenantId, prodottoId, data, tipo (entrata/uscite/trasferimento), quantità, unitàDiMisura, riferimento (lavoroId, attivitaId, trattamentoVignetoId, trattamentoFruttetoId, ecc.), note, userId (operatore), eventuale lotto.

- **Ubicazione** (solo se si vogliono più magazzini)  
  id, tenantId, nome, descrizione. Poi in Prodotto o in un “Giacenza” si ha prodottoId + ubicazioneId + quantità.

Per un MVP è sufficiente **Prodotto** + **MovimentoMagazzino** con giacenza calcolata o aggiornata sul prodotto (un solo “magazzino virtuale”).

### 3.3 Servizi suggeriti

- **prodotti-service**  
  CRUD anagrafica prodotti, list per tenant, filtri (categoria, attivo). Stesso pattern di `clienti-service` o `vigneti-service`.

- **movimenti-service**  
  CRUD movimenti; alla creazione di un movimento di entrata/uscite aggiornare la giacenza (sul prodotto o in una collezione dedicata). Calcolo giacenza corrente per prodotto (se non memorizzata).

- **magazzino-statistiche-service** (opzionale)  
  Report movimenti, consumi, valore magazzino, alert scorta minima e scadenze.

### 3.4 Viste (pagine) suggerite

- **magazzino-home-standalone.html** (o prodotti-magazzino-home)  
  Pagina principale modulo “Prodotti e Magazzino”: riepilogo giacenze, alert (sotto soglia, in scadenza), link alle altre viste.

- **prodotti-standalone.html**  
  Lista prodotti, filtri, creazione/modifica/eliminazione anagrafica.

- **movimenti-standalone.html**  
  Lista movimenti (filtri per data, prodotto, tipo), form entrata/scarico/rettifica.

- **magazzino-dashboard-standalone.html** (opzionale)  
  Dashboard con grafici consumi, valore magazzino, top prodotti per consumo.

Stile e pattern delle pagine: come in `conto-terzi` o `vigneto` (standalone, stessi pattern di navigazione e permessi).

### 3.5 Firestore e sicurezza

- **Collezioni** (sotto tenant): ad es. `tenants/{tenantId}/prodotti`, `tenants/{tenantId}/movimentiMagazzino`.  
  Naming da allineare alle convenzioni già usate (es. come in `vigneti`, `lavori`).

- **firestore.rules**  
  Regole per `prodotti` e `movimentiMagazzino`: lettura/scrittura solo per utenti che appartengono al tenant (belongsToTenant); **solo Manager e Amministratore** possono accedere al modulo (coerente con la decisione permessi).

### 3.6 Dashboard e abbonamento

- **Dashboard principale (Manager)**  
  Se il modulo “Prodotti e Magazzino” è attivo, mostrare una sezione **“Prodotti e Magazzino”** con card verso la home del modulo (e verso prodotti/movimenti). L’**alert scorta minima** deve comparire **anche in dashboard Manager** (es. card o badge con numero prodotti sotto soglia).

- **Abbonamento**  
  Il modulo costa **3 €** ed è **separato** (non incluso in nessun piano); il sistema è quello della nuova pagina abbonamento. Nella configurazione tenant/moduli si aggiunge il modulo (es. `prodottiMagazzino` o `magazzino`) così che la dashboard e i controlli permessi lo abilitino solo per Manager/Amministratore.

### 3.7 Integrazione trattamenti (dettaglio)

- **Trattamenti vigneto/frutteto**  
  - Nella vista trattamento: sostituire (o affiancare) il campo testo “prodotto” con un select/autocomplete che carica i prodotti dall’anagrafica magazzino (filtrando eventualmente per categoria “fitofarmaci” / “fertilizzanti”).
  - Salvataggio trattamento: oltre a salvare prodottoId e nome prodotto, chiamare il servizio movimenti per creare uno scarico (quantità da calcolare o da campo “quantità usata”).  
  - Gestione “modulo magazzino non attivo”: lasciare il comportamento attuale (solo testo “prodotto” e costo a mano).

- **Permessi**  
  Solo **Manager e Amministratore** usano il modulo (anagrafica, movimenti, report). Coerente con la decisione sui permessi.

### 3.8 Fasi di sviluppo consigliate

1. **Fase 1 – Base**  
   Modello Prodotto + prodotti-service + pagina anagrafica prodotti. Nessun movimento ancora: solo CRUD prodotti.

2. **Fase 2 – Movimenti e giacenza**  
   Modello MovimentoMagazzino + movimenti-service, aggiornamento giacenza a ogni movimento. Pagina movimenti (lista + form entrata/scarico/rettifica). Home magazzino con lista giacenze e alert scorta minima.

3. **Fase 3 – Integrazione trattamenti**  
   In trattamenti vigneto/frutteto: scelta prodotto da anagrafica; opzionale creazione scarico automatico alla conferma trattamento.

4. **Fase 4 – Report e ottimizzazioni**  
   Report consumi, valore magazzino, storico; eventuale confronto con “calcolo materiali” e lista “da acquistare”.

5. **Fase 5 (opzionale)**  
   Lotti e scadenze, più ubicazioni, trasferimenti.

---

## 4. Riepilogo

| Aspetto | Proposta |
|--------|----------|
| **Nome in UI** | **Prodotti e Magazzino** |
| **Permessi** | Solo Manager e Amministratore |
| **Prezzo** | 3 €, modulo separato, non incluso in nessun piano (sistema abbonamento aggiornato) |
| **Cosa serve** | Anagrafica prodotti (disattivazione, non eliminazione), scorte/giacenze, movimenti (entrata/uscite; scarico oltre giacenza permesso con alert), prezzo per prodotto con variazioni registrate negli acquisti, alert scorta minima anche in dashboard Manager. |
| **Dove vive** | Nuovo modulo `modules/magazzino/` (o `prodotti-magazzino/`) con models, services, views, eventuale config. |
| **Modelli** | Prodotto (con attivo), MovimentoMagazzino; in seguito eventuale Ubicazione/Lotto. |
| **Integrazioni** | Collegamento a lavori/attività sviluppato da subito; integrazione con trattamenti vigneto/frutteto (e invito a comprare moduli specializzati) da valorizzare in seguito. |
| **Unità / Confezioni / Uso parziale** | Un prodotto = un’unità base (L o kg); stock e movimenti sempre in quella unità; confezioni come nota sul movimento; uso parziale (es. 0,3 L da trattamento) supportato; stesso prodotto non duplicato per formati confezione diversi. Vedi sezione 5. |
| **Come svilupparlo** | Stesso pattern di Conto Terzi / Vigneto: modelli Base, servizi Firestore multi-tenant, viste standalone, modulo attivabile dalla nuova pagina abbonamento e visibile in dashboard (con alert in dashboard Manager). |
| **Ordine consigliato** | Prima anagrafica e movimenti + giacenza; poi collegamento lavori/attività e integrazione trattamenti; infine report e funzionalità avanzate (lotti, ubicazioni). |

---

## 5. Unità di misura, confezioni e uso parziale (design)

Questo capitolo fissa le scelte di design su **unità di misura**, **confezioni** e **quantità frazionarie** (es. dosi da trattamento), per evitare ambiguità in anagrafica e movimenti e per supportare bene l’integrazione con i trattamenti.

### 5.1 Problema: quantità inferiore a un’unità (es. trattamento)

Durante un **trattamento** la dose può essere **inferiore all’unità** con cui il prodotto è venduto o stoccato.  
Esempio: dose **0,3 L per ettaro**; la bottiglia resta in magazzino, ma il **prodotto impiegato** è 0,3 L (o 0,3 × ettari). Quindi:

- Non si può ragionare solo a “bottiglie intere”: servono **quantità in unità “continue”** (L, kg).
- La giacenza deve poter scendere di 0,3 L, 0,7 L, ecc., non solo di “1 unità” alla volta.

Se l’unità di magazzino fosse “confezione” o “bottiglia” senza un’equivalenza in L/kg, non si potrebbe registrare correttamente l’uso parziale.

### 5.2 Problema: stesso prodotto, più formati di confezione

Lo **stesso prodotto** (es. stesso principio attivo) può essere acquistato in **confezioni diverse**: 1 kg, 5 kg, 10 kg, 25 kg (o 1 L, 5 L, 25 L, ecc.).

- Creare **un’anagrafica prodotto per ogni formato** (es. “Kerathane 1 L”, “Kerathane 5 L”, “Kerathane 25 L”):
  - duplica lo stesso prodotto più volte;
  - aumenta il rischio di errore nei movimenti (es. scegliere “confezione 10 L” invece di “1 L”);
  - non risolve il problema delle dosi frazionarie (0,3 L).
- Non è quindi desiderabile moltiplicare i prodotti in anagrafica per ogni tipo di confezione.

### 5.3 Scelta di design: un’unità “base” per prodotto (L o kg)

**Regola unica:**  
Per ogni prodotto si definisce **una sola unità di misura “base”** (tipicamente **L** o **kg**).  
Tutte le quantità in magazzino (giacenza, entrate, uscite) sono **sempre** espresse in quella unità.

- **Anagrafica:** un prodotto = un record, con unità = L oppure kg (o, dove ha senso, pezzi/m ecc. per materiali non liquidi/solidi).
- **Movimenti:** la “quantità” è sempre nella stessa unità del prodotto (es. 25 L, 0,3 L, 10 kg).
- **Uso parziale:** uscita “0,3 L” (o 0,3 × ettari) è una quantità normale; la giacenza si aggiorna in L (o kg) senza dover gestire “mezze bottiglie” come entità separate.
- **Stesso prodotto, più confezioni:** non si creano più prodotti. Si ha un solo “Kerathane (L)”.  
  - Acquisto “1 bidone da 25 L” → entrata **25 L** (eventualmente con nota “1×25 L”).  
  - Acquisto “1 bottiglia da 1 L” → entrata **1 L** (eventualmente con nota “1×1 L”).  
  - La giacenza è il **totale L** (o kg), indipendentemente da come è stato acquistato.

In questo modo:

- Le quantità usate nei **trattamenti** possono essere **inferiori a un’unità** (0,3 L, 0,7 L, ecc.) perché l’unità di conto è L (o kg), non “bottiglia”.
- Lo **stesso prodotto** non viene duplicato per 1 kg / 5 kg / 10 kg / 25 kg.
- Si evita l’errore “ho scelto confezione da 10 L invece che da 1 L” perché in magazzino si sceglie il prodotto e si inserisce la **quantità in L (o kg)**; la confezione è solo informazione contestuale.

### 5.4 Confezione come informazione contestuale (opzionale)

La **confezione** (es. “1×25 L”, “2×5 kg”) non è l’unità di stock, ma può essere tracciata come **informazione sul movimento**:

- Sul **movimento di entrata** (e, se utile, su quello di uscita): campo opzionale “confezione” o “note” (es. “1 bidone 25 L”, “2 sacchi 5 kg”) per ricordare **come** è stato acquistato o usato.
- In **anagrafica** si può prevedere, in fase successiva, un campo opzionale “equivalente per unità” (es. “1 confezione = 25 L”) solo a scopo informativo o per etichette; la giacenza resta comunque in L o kg.

Non è obbligatorio introdurre subito “confezione” come entità separata: può bastare un campo note/descrizione sul movimento.

### 5.5 Dose per ettaro (0,3 L/ha) e integrazione trattamenti

- La **dose per ettaro** (es. 0,3 L/ha) è un dato del **trattamento** (e, se utile, “dose consigliata” sul prodotto, solo informativa).
- Il **calcolo** “dose × ettari” (es. 0,3 × 2 = 0,6 L) appartiene al modulo **trattamenti** (o al flusso che crea il movimento).
- Il **magazzino** riceve solo l’informazione: “uscita **X L**” (X = quantità effettivamente usata). Non deve conoscere ettari né dose per ettaro; deve solo aggiornare la giacenza in L (o kg).

In sintesi: **un prodotto = un’unità base (L o kg); stock e movimenti sempre in quella unità; confezioni come nota; uso parziale e più formati di confezione gestiti senza duplicare prodotti.**

---

## 6. Stato sviluppo e implementazione (aggiornato)

Questo paragrafo descrive **cosa è stato effettivamente sviluppato** e dove si trova nel codice.

### 6.1 Struttura modulo

- **Percorso**: `modules/magazzino/` con sottocartelle `config/`, `models/`, `services/`, `views/`.
- **Config**: `categorie-prodotto.js` (categorie prodotto, unità di misura, tipi movimento).
- **Modelli**:
  - **Prodotto**: codice, nome, categoria, unitaMisura, scortaMinima, prezzoUnitario, giacenza, note, attivo (disattivazione invece di eliminazione).
  - **MovimentoMagazzino**: prodottoId, data, tipo (entrata/uscita), quantita, prezzoUnitario (per entrata), lavoroId (opzionale), attivitaId (opzionale), note, userId, confezione (opzionale, es. "1 bidone 5 L").
- **Servizi**:
  - **prodotti-service**: CRUD prodotti, disattivaProdotto, riattivaProdotto, aggiornaGiacenzaProdotto.
  - **movimenti-service**: CRUD movimenti, aggiornamento automatico giacenza a creazione/eliminazione, getProdottiSottoScortaMinima.
- **Viste (standalone)**:
  - **magazzino-home-standalone.html**: home modulo (statistiche, prodotti sotto scorta, ultimi movimenti, link a prodotti e movimenti).
  - **prodotti-standalone.html**: lista prodotti (filtri stato, categoria, ricerca), modal crea/modifica prodotto, disattiva/riattiva; suggerimento "Per dosi frazionarie (es. trattamenti) usa L o kg" sotto unità di misura.
  - **movimenti-standalone.html**: lista movimenti (filtri tipo, prodotto), form nuovo movimento e **modifica** movimento; campi: prodotto, data, tipo, quantità (label dinamica L/kg in base al prodotto), confezione (opzionale), prezzo unitario (per entrata), note; colonne tabella: Data, Prodotto, Tipo, Quantità (con unità), Confezione, Prezzo unit. (€), **Prezzo tot. (€)** (calcolato = prezzo unitario × quantità), Note, Azioni (Modifica, Elimina); alert giacenza negativa in caso di scarico oltre disponibilità.
- **Firestore**: regole per `tenants/{tenantId}/prodotti` e `tenants/{tenantId}/movimentiMagazzino` (lettura per membri tenant; create/update/delete solo Manager/Amministratore).
- **Dashboard**: card "Prodotti e Magazzino" in dashboard Manager con conteggio prodotti sotto scorta minima; caricamento dati `loadMagazzinoSottoScortaCount`.
- **Abbonamento**: modulo "Prodotti e Magazzino" in `subscription-plans.js` a 3 €.

### 6.2 Collegamento a lavori e attività (stato attuale)

- **Modello e servizio**: i campi `lavoroId` e `attivitaId` esistono in **MovimentoMagazzino** e vengono accettati e salvati dal servizio movimenti.
- **Interfaccia**: nella pagina movimenti sono presenti **due select opzionali** (“Lavoro” e “Attività”) che caricano rispettivamente le collezioni core `tenants/{tenantId}/lavori` e `tenants/{tenantId}/attivita` (ordine: lavori per dataInizio desc, attività per data desc). L’utente può collegare un movimento a un lavoro o a un’attività; la tabella movimenti mostra le colonne **Lavoro** e **Attività** con l’etichetta del lavoro/attività collegato (o “-” se assente).
- **Quando ha senso**: lavori e attività vivono in **core** (Gestione Lavori e attività giornaliere), quindi le liste sono in genere popolate anche senza moduli specializzati (Vigneto/Frutteto). Se non ci sono lavori/attività, i dropdown mostrano solo “Nessuno”/“Nessuna”.
- **Casi d’uso**: il collegamento movimento ↔ lavoro/attività vale non solo per gli scarichi legati ai trattamenti (Vigneto/Frutteto), ma anche per **materiali per impianto** (fili, pali, tutori, ancore, reti, ecc.) consumati in un lavoro di impianto o manutenzione: si registra l’uscita in Magazzino e si associa al lavoro corrispondente.

### 6.3 Scarico automatico e valore del modulo

- **Scarico automatico**: è previsto **solo nei moduli specializzati** (es. Trattamenti Vigneto/Frutteto): alla registrazione di un trattamento, l’utente può confermare “Registra anche lo scarico in magazzino” e il modulo crea il movimento di uscita in Magazzino collegato al trattamento. In **Magazzino** tutte le entrate e uscite sono **manuali**.
- **Valore del modulo da solo** (senza moduli specializzati): anagrafica prodotti unica, giacenze aggiornate, movimenti manuali (entrate/uscite) per acquisti, vendite, usi non tracciati da trattamenti, rettifiche; alert scorta minima (anche in dashboard Manager); prezzo unitario e prezzo totale per movimento; storico movimenti. Il modulo resta utile per chi vuole tenere sotto controllo prodotti, scorte e costi anche senza Vigneto/Frutteto.
- **Workflow con lavori/attività senza scarico automatico**: l’utente può annotare nelle **note** di un’attività o di un lavoro i quantitativi usati (es. “Usati 10 L di prodotto X, 5 kg di prodotto Y”) e in seguito andare in Magazzino a registrare manualmente le uscite, usando le note come promemoria. Il collegamento movimento ↔ lavoro/attività (quando esposto in UI) servirà per tracciabilità e report.

### 6.4 Cosa aggiungere nei moduli specializzati (per “usare al meglio” i trattamenti)

Per rendere il modulo Magazzino **caldamente consigliato** con i trattamenti:

- Nel form trattamento: scelta prodotto dall’anagrafica Magazzino (se modulo attivo), visualizzazione giacenza attuale e quantità suggerita (dose × superficie); avvisi “sotto scorta minima” o “quantità insufficiente”; opzione **“Registra scarico in magazzino”** che crea il movimento di uscita collegato al trattamento.
- Tracciabilità bidirezionale: dal trattamento vedere “prodotto scaricato: X, quantità”; da Magazzino vedere “per trattamento/attività Y”.
- Il calcolo agronomico (dose per ettaro, superficie, quantità totale) resta nel modulo specializzato; Magazzino riceve solo la quantità in unità base (L/kg) e il riferimento al trattamento.

---

Se vuoi, il passo successivo può essere un **piano di sviluppo dettagliato** (stile `PLAN_MODULO_CONTO_TERZI.md`) con elenco file da creare, campi dei modelli e passi per integrare la dashboard e le regole Firestore.
