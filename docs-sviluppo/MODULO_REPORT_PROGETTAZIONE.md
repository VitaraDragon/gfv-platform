# Modulo Report — progettazione e specifica evolutiva

**Stato:** bozza viva — aggiornare questo file man mano che il brainstorming e l’implementazione procedono.  
**Ultimo aggiornamento contenuti:** 2026-04-11 (sezione Report Terreni — visione card e alert)  
**Riferimento prodotto generale:** `docs-sviluppo/tony/MASTER_PLAN.md` (Fase 5 — Grafici e report).

---

## 1. Scopo del documento

Raccogliere in un unico posto:

- principi e vincoli concordati per il **modulo Report**;
- il disegno della **dashboard** e delle **card**;
- il collegamento con **Tony** (Context Builder) e con il **gating** per moduli acquistati;
- lo **stato del codice** già presente nel repo;
- **decisioni aperte** e sezioni da compilare nelle iterazioni successive.

---

## 2. Perché esiste questo modulo (principi)

### 2.1 Fonte “ufficiale” di numeri sintetici

- I **report aggregati** sono la fonte privilegiata per **totali, confronti di periodo, KPI** definiti dal prodotto.
- **Non** si chiede al modello Tony di **incrociare** dati grezzi sparsi tra più moduli nel prompt: rischio di errori, costi token alti, manutenzione ingestibile.

### 2.2 Un motore, due consumatori

- **Stessa logica di calcolo / stessi snapshot** alimentano:
  - l’**interfaccia** utente (dashboard report, drill-down dove previsto);
  - il **contesto Tony** (es. struttura dedicata nel Context Builder o equivalente), così i numeri ripetuti in chat/voce coincidono con quelli in schermata.

### 2.3 Domande “capillari” vs “di sintesi”

- **Sintesi / totali / confronti** → modulo Report (e Tony che legge quei dati).
- **Dettaglio riga per riga, movimento singolo, filtro operativo fine** → **sezione operativa** del modulo interessato (con possibile `APRI_PAGINA` / navigazione).

### 2.4 Qualità > quantità

- Preferire **pochi report ben definiti** con **definizione chiara** di ogni metrica (formula, filtri temporali, unità, ambito).
- Ogni output esposto a Tony dovrebbe includere metadati utili (es. **aggiornato al…**, **ambito: …**) per ridurre fraintendimenti in voce.

---

## 3. Sostenibilità (costi, affidabilità, manutenzione)

### 3.1 Costi Gemini / token

- Contesti **compatti** basati su **riassunti e KPI** costano meno che inviare grandi tabelle o più collezioni grezze per ogni messaggio.
- La logica pesante resta **nel backend** (o nei job di materializzazione), non nel prompt.

### 3.2 Affidabilità

- Il modello **ripete e contestualizza** numeri già calcolati; non deve ricostruire join complessi tra moduli.

### 3.3 Manutenzione

- **Una definizione** per KPI nel modulo Report riduce il rischio che **UI**, **report** e **Tony** mostrino versioni diverse della “verità”.
- Vincolo: i calcoli devono restare **allineati** ai dati operativi (stessi filtri di stato, stesse entità).

### 3.4 Ruolo del team

- Team ridotto (sviluppatore + agenti): il costo marginale “organizzativo” è basso; il vincolo reale è **priorità e tempo**, non headcount. Vale la pena investire in **specifiche chiare** per non moltiplicare implementazioni parallele.

---

## 4. Visibilità: modulo `report` sul tenant

- La **dashboard Report** descritta sotto è parte del **modulo `report`** (licenza / flag moduli sul tenant).
- **Senza** modulo `report` attivo, l’utente **non** accede a questa esperienza (nessuna dashboard dedicata report di questo tipo).
- **Con** modulo `report` attivo si costruiscono card, navigazione e permessi come da sezioni seguenti.

**Implementazione attuale (verifica codice):** `hasReportModuleAccess()` in `modules/report/services/report-service.js` controlla la presenza del modulo `report` nell’array `modules` del tenant.

---

## 5. Dashboard del modulo Report

### 5.1 Modello generale

- Stessa **logica delle altre dashboard di modulo**: ingresso principale con **card** che indirizzano verso aree di report.
- **Prima divisione dei dati per indirizzo**: ogni card corrisponde a un **ambito** coerente con i **nomi dei moduli** già usati in app (coerenza lessicale e navigazione).

### 5.2 Card per modulo / area (gating)

- Esempi di indirizzi (lista evolutiva): **Vigneto**, **Frutteto**, **Terreni**, **Magazzino**, **Manodopera**, **Conto terzi**, ecc.
- Mostrare una card **solo** se il tenant ha **attivato** il modulo corrispondente (oltre al modulo `report` dove richiesto dalla policy prodotto).
- Nomi e icone **allineati** alle dashboard principali dei singoli moduli, per continuità UX.

### 5.3 Card Terreni (regole fisse)

- All’interno della **dashboard del modulo Report**, la card **Terreni** è:
  - **sempre la prima** (in cima alla lista delle card);
  - **sempre presente** (indipendentemente dall’ordine degli altri moduli).
- Motivazione: base **trasversale** (superfici, affitti, anagrafica campi, filtri per campo) per molte analisi e per Sintesi/Economici.

### 5.4 Ordine delle altre card

- Le card successive (Vigneto, Magazzino, …) seguono l’**ordine di attivazione** dei moduli da parte dell’utente/tenant (es. se prima si attiva Vigneto e poi Magazzino, quell’ordine si riflette nell’UI).
- **Implementazione da definire:** persistenza dell’ordine (es. array `modulesOrder` sul documento tenant, oppure ordine derivato da **timestamp di attivazione** per modulo). I **nuovi** moduli attivati successivamente si comportano come **in coda**, salvo regole prodotto diverse.

### 5.5 Card cross-modulo: Sintesi ed Economici

- Oltre alle card “per singolo modulo”, sono previste aree che **attraversano** dati di moduli diversi:
  - **Sintesi** (visione d’insieme aggregata);
  - **Economici** (indicatori economici che possono combinare reparti).
- La **v1** può includere **placeholder**, **pochi KPI**, o rinvio testuale finché le definizioni numeriche e le fonti non sono stabilizzate.

### 5.6 Report Terreni — contenuto dopo click sulla card (direzione concordata)

**Non è una replica** della sezione Gestione terreni. Obiettivo: **estrapolare dati utili** per capire **come stanno andando le cose** (stato di salute del patrimonio fondiario), non ripetere form e liste operative.

**Selettore temporale (UI)**

- L’utente può scegliere: **annata agraria** | **annata solare** | **intervallo di date personalizzato** (oltre alla distinzione agraria/solare dove serve per confronti coerenti).
- **Annata agraria (default concordato):** dal **11 novembre** al **10 novembre** dell’anno successivo (chiusura inclusiva). Configurabile per tenant in futuro se servono altre convenzioni.

**Riferimenti per confronti e alert (“baseline”)**

- **Primo anno con dati:** periodo di **riferimento iniziale** — **nessun confronto** automatico (non si può dire “sopra il solito” senza storia); UI e Tony possono indicare “primo anno di riferimento” o “dati insufficienti per il confronto”.
- **Dalla seconda annata in poi**, confronti possibili usando (in base a cosa si seleziona nel report o nel grafico):
  - dati dell’**annata precedente** (stesso tipo di periodo: agraria o solare);
  - **media** storica (ambito da definire in implementazione: es. media delle ultime N annate chiuse, o media mobile — va reso esplicito in UI);
  - **totale dall’inizio** (cumulativo da prima registrazione utile sul terreno / in azienda), utile per serie temporali e grafici di andamento complessivo.
- Questa ricchezza di riferimenti supporta **più tipi di grafici** (vs anno precedente, vs media, cumulativo, ecc.) senza contraddire la logica alert.

**Nota tecnica (prestazioni e costi letture)**

- Per **media storica** e **totale dall’inizio** senza ricalcolare ogni volta tutta la storia grezza, conviene prevedere **aggregati per periodo** (es. **chiusura a fine annata agraria** per terreno/azienda: totali ore, kg per macro-categoria, ecc.) e/o **serie mensili** materializzate, aggiornate a **fine periodo** o con job incrementale. Il **load** della schermata legge principalmente **documenti di sintesi** + il periodo corrente, non necessariamente tutti i movimenti storici ogni volta.
- In assenza di tali aggregati in v1, si può partire con query su sorgenti esistenti, con **limite** consapevole: al crescere degli anni di dati si introduce **materializzazione** o snapshot **prima** che tempi e letture diventino pesanti.

**A colpo d’occhio — alert (direzione v1)**

- **Affitti:** scadenze / situazioni da monitorare (come già previsto).
- **Ore:** ore lavorate **sopra il “solito”** rispetto a baseline (media storica, stesso periodo anno precedente, o regola definita in implementazione).
- **Quantità:** utilizzo di **prodotti / concimi** **più elevato del solito** (stesso tipo di confronto vs baseline).
- **Idea generale:** segnalare **andamenti** che implicano **maggiore impegno** (ore o input) rispetto al consueto — **senza € in questa vista**; il messaggio è “stai usando di più / lavorando di più rispetto al riferimento”, utile anche come proxy di **maggior costo implicito**, lasciando i **conti letterali** ai report finanziari.

**A colpo d’occhio — presentazione**

- Evidenziare se **c’è qualcosa che non va**: badge, colore, icona quando una condizione è critica o da monitorare.
- Confronti con **periodi precedenti** coerenti con il selettore (es. stessa annata agraria anno precedente).

**Vista principale: card per terreno**

- Griglia (o lista) di **card**, una per **terreno** (o per unità di report concordata — es. appezzamento se diverso dall’anagrafica).
- Ogni card mostra solo **ciò che serve a leggere lo stato**: identificazione (nome, podere, coltura di sintesi), **ha**, e **indicatori** sintetici (stato generale, numero di alert attivi, eventuale delta vs anno precedente se calcolabile).
- **Click sulla card** → si apre il **dettaglio report di quel terreno** (sotto-pagina o pannello): trend/indicatori, elenco motivi di allerta, confronti temporali **non** clone della scheda anagrafica completa.
- Dal dettaglio: link chiaro **“Apri in gestione terreni”** (o equivalente) per modifiche anagrafiche e dati operativi.

**Cosa NON mettere qui**

- Form di creazione/modifica, duplicazione della tabella completa dei terreni, tutte le colonne dell’anagrafica. Restano nel modulo Terreni.

**Dettaglio terreno — Concimazioni / Trattamenti / input (pattern UI concordato)**

- **Sintesi in evidenza:** totali **sull’annata** (o periodo selezionato) **aggregati su tutti i prodotti** — quantità coerenti (kg, ha trattati, numero interventi, ecc.); **totale ore lavorate** sul terreno nello stesso periodo (aggregato manodopera/lavori, coerente con fonte dati unica); eventuale confronto con annata precedente dove i dati lo permettono.
- **Espandibile sotto la sintesi:** **totale per prodotto** utilizzato su quel terreno nello stesso periodo (tabella o elenco compatto: prodotto → quantità totale). **Spesa in €:** non in questo report — da **report finanziari / sezione Economici** (o modulo dedicato), per non mescolare sintesi agronomica e conti.
- Il **dettaglio operativo** riga-per-riga (date, lotti, note) resta nel **modulo** di registro, con link dal report se utile.

**Implementazione**

- **Aggregazioni al load** della schermata (periodo selezionato): scelta concordata; costi Firestore **sostenibili** con query progettate bene, **cache in sessione** dopo il primo caricamento, niente N+1 per ogni click su espandibili. Complementare alla **nota tecnica** sopra (aggregati storici materializzati quando il volume lo richiede). Eventuale ottimizzazione ulteriore (snapshot dedicati) se il volume dati cresce ancora.
- L’adapter/report service deve calcolare **aggregati e flag** riusabili anche da Tony (stesso modello dati “report terreni” esposto al Context Builder quando previsto). **Baseline “il solito”** per ore e quantità: da implementare (media mobile, anno precedente, soglia percentuale — da fissare nel codice e documentare).

---

## 6. Permessi e ruoli

- Allineamento con la documentazione utente esistente (`documentazione-utente/04-FUNZIONALITA/STATISTICHE_REPORT.md`): ruoli tipo Manager, Amministratore, Caposquadra, Operaio con ambiti diversi.
- **Report Terreni (e in generale viste “andamento azienda” con grafici / sintesi strategiche):** visibili solo a **Manager** e **Proprietario** (e/o **Amministratore** se equiparato al proprietario in policy prodotto) — **non** a caposquadra né operai (non devono vedere grafici sull’andamento complessivo dell’azienda; restano le statistiche/aree già previste per ruolo altrove, es. ore personali operaio).
- **Da dettagliare** in implementazione: controllo accesso su route e su payload Tony (stesso gating).

---

## 7. Tony (assistente) e modulo Report

### 7.1 Comportamento atteso

- Per domande su **totali, sintesi, confronti** coperti dai report: Tony usa i **dati aggregati esposti** (stesso motore del modulo Report), con **gating** coerente (nessun dato di modulo non acquistato).
- Per domande **oltre** ciò che il report espone: Tony **rimanda** alla sezione operativa o esegue navigazione (`APRI_PAGINA`) verso il modulo indicato.

### 7.2 Stato attuale (non obbligatoriamente implementato)

- Il collegamento **Context Builder ↔ snapshot report** va progettato/implementato in `functions/index.js` (o servizio dedicato) quando i primi aggregati saranno stabili.
- Fino ad allora, le regole già presenti per `page.currentTableData` e `buildContextAzienda` restano valide per altri scenari.

---

## 8. Implementazione tecnica — stato nel repository

| Elemento | Path / nota |
|----------|-------------|
| Orchestratore MVP, accesso modulo | `modules/report/services/report-service.js` — `hasReportModuleAccess()`, `getActiveModules()` |
| Adapter per modulo | Esempio: `modules/report/adapters/vigneto-adapter.js` (pattern adattatori) |
| Ingresso modulo (dashboard card) | `modules/report/views/report-dashboard-standalone.html` — card Terreni, moduli attivi, Sintesi/Economici (placeholder) |
| Report Terreni (v1 shell) | `modules/report/views/report-terreni-standalone.html` — selettore periodo, lista card terreni |
| Report export vigneto (MVP esistente) | `modules/report/views/report-standalone.html` — anche `core/admin/report-standalone.html` per admin |
| Helper | `modules/report/js/report-access.js`, `modules/report/js/report-time-range.js` |
| Documentazione utente (statistiche/report) | `documentazione-utente/04-FUNZIONALITA/STATISTICHE_REPORT.md` |

**Direzione tecnica concordata:** un servizio coordina **adapter per modulo**; i calcoli non sono duplicati “a mano” in N pagine senza passare da definizioni comuni.

---

## 9. KPI e definizioni (sezione da espandere)

Per ogni report/KPI in v1, compilare (quando si definisce l’implementazione):

| ID | Nome | Modulo | Formula / fonte | Filtri tempo | Unità | Aggiornamento (live / batch / notte) |
|----|------|--------|-------------------|--------------|-------|--------------------------------------|
| *(da riempire)* | | | | | | |

---

## 10. Decisioni aperte

- Persistenza **esatta** dell’ordine card (campo tenant vs derivazione da timestamp).
- Contenuto minimo **v1** per card **Sintesi** e **Economici** (KPI iniziali vs solo navigazione).
- **Report Terreni — snapshot vs load:** per Terreni scelta **aggregazione al load** (con buone query + cache sessione); rivalutare snapshot solo se il volume cresce.
- **Media storica:** su quante annate, media semplice o pesata, etichetta in UI (“media ultimi 3 anni”).
- **Baseline alert** (ore e quantità “sopra il solito”): soglia % o deviazione vs annata precedente vs media — formula e copy utente.
- Allineamento con **MASTER_PLAN** Fase 5: comandi `MOSTRA_GRAFICO`, integrazione grafici nella stessa area o sottopagine.

---

## 11. Changelog interno (brainstorming / implementazione)

| Data | Autore / nota | Modifica |
|------|----------------|----------|
| 2026-04-11 | Brainstorming con agente | Creazione documento: principi, dashboard a card, Terreni sempre prima, ordine per attivazione, Sintesi/Economici, Tony, gating, riferimenti codice. |
| 2026-04-11 | Brainstorming con agente | §5.6 Report Terreni: non replica gestione terreni; dati utili, alert a colpo d’occhio, confronti con anni precedenti; vista a card per terreno + dettaglio report + link a gestione. |
| 2026-04-11 | Brainstorming con agente | Dettaglio terreno concimazioni/trattamenti: totali annata aggregati + sezione **espandibile** con totale **per prodotto**; dettaglio riga → modulo. |
| 2026-04-11 | Brainstorming con agente | Report Terreni: aggiunto **totale ore lavorate** (periodo); **spesa €** fuori — report finanziari/Economici; visibilità **solo Manager/Proprietario** (non caposquadra/operaio) per andamento azienda. |
| 2026-04-11 | Brainstorming con agente | Selettore: **annata agraria** \| **annata solare** \| **intervallo**; alert: affitti, ore sopra baseline, quantità prodotti/concimi sopra baseline (implicito “più costoso” senza €); **aggregazione al load** + cache sessione. |
| 2026-04-11 | Brainstorming con agente | Annata agraria **11 nov → 10 nov** anno dopo; **primo anno** senza confronti; riferimenti: **annata precedente**, **media**, **totale dall’inizio**; supporto a più grafici. |
| 2026-04-11 | Brainstorming con agente | Nota tecnica: **aggregati per periodo** / serie materializzate per media e cumulativo (evitare full scan storico a ogni load); v1 possibile su query dirette con limite di scala. |

---

## 12. Riferimento rapido per altri agenti

> Modulo **Report**: dashboard con **card** per area (nomi = moduli), **Terreni** sempre prima e sempre visibile **nella dashboard report**; altre card solo se modulo attivato; ordine = **attivazione**; card **Sintesi** e **Economici** cross-modulo; stessi aggregati per **UI e Tony**; senza modulo `report` → niente questa dashboard; dettaglio operativo fuori dai report. Codice: `modules/report/`. Documento pieno: questo file.
