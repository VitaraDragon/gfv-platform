> **ARCHIVIATO 2026-03-08** – Sostituito da `docs-sviluppo/tony/MASTER_PLAN.md`  
> Per **sicurezza flussi pubblici** (preventivo via link) e aggiornamenti post-2026-03-08 usare il Master Plan attivo (`tony/MASTER_PLAN.md`, §6.3) e `docs-sviluppo/SICUREZZA_FLUSSI.md`.

---

# Master Plan – Tony Assistente Universale

**Versione**: 1.1  
**Data**: 2026-03-02  
**Stato**: Documento di riferimento – tutte le modifiche a Tony devono allinearsi a questo piano.

---

## Stato dello sviluppo (a colpo d'occhio)

| Fase | Nome | Stato | Criterio done |
|------|------|-------|---------------|
| **1** | Consolidamento fondamenti | ⏳ Parziale | Tony aggiunge terreno senza guidare passo-passo |
| **2** | Navigazione cross-page | ✅ **Completata** | "Ho trinciato 6 ore" da Dashboard → Tony apre modal, compila, chiede campi mancanti |
| **3** | Context Builder e dati aziendali | ✅ **In corso** | buildContextAzienda in CF; terreni, macchine, tipi lavoro, colture, summaryScadenze. Tony risponde "Quali scadenze?" / "Come stanno i prodotti?" |
| **4** | Iniezione universale | ✅ **In corso** | Injector + TONY_FORM_MAPPING; form Attività e Lavori; override sottocategoria (Generale→Tra le File su frutteti). Fix 2026-03-02 |
| **5** | Grafici e report | ⏳ Parziale | APRI_PAGINA statistiche; descrizione dati dal contesto |
| **6** | Proattività e memoria | ❌ Da fare | Tony segnala scadenze/sotto scorta proattivamente |

**Ultimo aggiornamento significativo (2026-03-02)**: Fix regressioni form Attività: fallback SAVE_ACTIVITY (no su domande), sottocategoria "Tra le File" su Frutteto (injector + CF), terreniList con coltura_categoria. → `COSA_ABBIAMO_FATTO.md`, `TONY_SVILUPPO_2026-03_VIGNETO_E_COMPILAZIONE.md`.

---

## 1. Visione

Tony è **l'interfaccia intelligente** tra l'utente e GFV Platform. Non è una chat aggiunta all'app, ma **l'interlocutore principale** che:

- Conosce **per filo e per segno** tutti i dati dell'azienda
- Può **inserire** dati (compilare form, creare record) al posto dell'utente
- Può **recuperare** dati e rispondere a domande su qualsiasi aspetto dell'azienda
- È sempre **aggiornato** sui dati contenuti nell'app
- È **esperto** sia dell'azienda (business) che del funzionamento dell'app (tecnico)
- È il **braccio destro** di manager e proprietario, ma anche lo strumento quotidiano di operai e capisquadra

L'obiettivo: l'utente non deve sapere a memoria form, pagine o flussi. Dice a Tony cosa vuole fare e Tony si occupa del resto.

---

## 2. Le tre anime di Tony

### 2.1 Operativo
Compila ore, attività, lavori per operai e capisquadra. Semplifica l'inserimento dati con linguaggio naturale.
- *Esempio*: "Ho fatto 8 ore di potatura" → Tony apre il form, compila tipo lavoro e ore, chiede terreno e data.
- **Priorità alta**: le interfacce operai/capisquadra sono semplificate e con accesso limitato – meno complessità, massimo impatto.

### 2.2 Analista / Consulente
Incrocia dati finanziari, produttivi e operativi per dare consigli e rispondere a domande complesse.
- *Esempio*: "Come stanno andando le vendemmie rispetto allo scorso anno?"
- *Esempio*: "Quali sono i principali costi questo mese?"

### 2.3 Navigatore
Si muove nell'app per mostrare grafici, tabelle e sezioni. Porta l'utente dove serve.
- *Esempio*: "Mostrami i grafici delle ore" → Tony apre la pagina Statistiche o la sezione corretta.
- *Esempio*: "Quali prodotti sono sotto scorta?" → Tony filtra/riporta i dati o apre la pagina Magazzino.

### 2.4 Proattività (da sviluppare)
Tony non si limita a rispondere: propone azioni quando rileva anomalie.
- *Esempio*: "Ho notato 2 affitti in scadenza questo mese. Vuoi che ti elenchi i terreni?"
- *Esempio*: "C'è un prodotto sotto scorta. Vuoi che aggiunga un movimento di acquisto?"

### 2.5 Memoria storica (da sviluppare)
Confronta periodi e fornisce analisi temporali.
- *Esempio*: "Quest'anno stiamo spendendo il 15% in più di concime rispetto al 2025 nello stesso periodo."
- Richiede dati storici aggregati nel contesto.

---

## 3. Utenze e priorità

| Utente | Interfaccia | Complessità | Priorità Tony |
|--------|-------------|-------------|---------------|
| **Operaio** | Segnatura ore, pochi form | Bassa | **Alta** – massimo impatto, minor attrito |
| **Caposquadra** | Lavori, zone, ore squadra | Media | **Alta** |
| **Manager** | Quasi tutte le funzioni | Alta | Media – già più avvezzo all'app |
| **Proprietario** | Tutto + report, statistiche | Alta | Media |
| **Amministratore** | Impostazioni, utenti, abbonamento | Specifica | Bassa |

**Principio**: Tony deve funzionare bene per operai e capisquadra prima di tutto – interfacce semplici, pochi form, alto valore.

---

## 4. Principio di scalabilità

L'app non è conclusa. Verranno aggiunti nuovi moduli. **Ogni sviluppo deve essere scalabile.**

### 4.1 Cosa evitare
- Patch dedicate per ogni modulo (`if (modulo === 'terreni') { ... }`)
- Logica hardcoded per singole pagine
- Riavvio da zero quando si aggiunge un modulo

### 4.2 Cosa fare
- **Configurazione** invece di codice: nuovo modulo → aggiungere mapping, rotte, definizione dati
- **Architettura unica**: Context Builder, injector generico, comandi standard (APRI_PAGINA, OPEN_MODAL, SET_FIELD)
- **Estensibilità**: nuovo form = voce in TONY_FORM_MAPPING; nuova tabella = pageType in currentTableData; nuova fonte dati = adapter nel Context Builder

### 4.3 Criterio
Quando si aggiunge un modulo, il lavoro deve essere:
- Aggiungere configurazione (mapping, rotte)
- Eventualmente un adapter dati se la struttura è nuova
- **NON** scrivere nuove funzioni `if/else` nel core di Tony

---

## 5. Architettura – Il Nucleo di Conoscenza Centrale

Tony non legge solo la "tabella della pagina corrente". Attinge a un **Context Builder** che aggrega dati da più fonti.

### 5.1 Componenti

```
                    ┌─────────────────────────────────────┐
                    │         Context Builder              │
                    │  (aggrega prima di ogni richiesta)   │
                    └─────────────────┬───────────────────┘
                                      │
        ┌─────────────────────────────┼─────────────────────────────┐
        │                             │                               │
        ▼                             ▼                               ▼
┌───────────────┐           ┌─────────────────┐           ┌─────────────────┐
│ page.current  │           │ summaryScadenze  │           │ summaryStats    │
│ TableData     │           │ summaryAlert    │           │ summaryProdotti │
│ (tabella      │           │ (affitti, mezzi, │           │ (ore, rese,     │
│  corrente)    │           │  guasti)        │           │  costi)         │
└───────────────┘           └─────────────────┘           └─────────────────┘
        │                             │                               │
        └─────────────────────────────┼─────────────────────────────┘
                                      │
                                      ▼
                    ┌─────────────────────────────────────┐
                    │   tonyAsk (Cloud Function)           │
                    │   context = tutto il sopra           │
                    └─────────────────────────────────────┘
```

### 5.2 Contenuto del contesto (target)
- **page**: path, currentTableData (se su pagina lista), availableRoutes
- **form**: stato form corrente (se modal aperto) – getCurrentFormContext
- **dashboard**: moduli_attivi, info azienda
- **summaryScadenze**: "3 mezzi in scadenza, 2 affitti scaduti" (da costruire)
- **summaryAlert**: "2 prodotti sotto scorta, 1 guasto aperto" (da costruire)
- **summaryStats**: aggregati ore, superfici, rese (da costruire)
- **terreni.poderi, terreni.colture**: quando rilevante (già parzialmente fatto)

### 5.3 Estensibilità
Nuovo modulo → nuovo adapter che produce un blocco di contesto. Il Context Builder li assembla. Nessuna modifica alla logica centrale.

---

## 6. Accesso Read / Write

### 6.1 Read (Lettura)
Tony può leggere tutti i dati necessari per rispondere. I dati arrivano dal Context Builder. Nessuna restrizione concettuale – la limitazione è tecnica (quanto carichiamo nel contesto).

### 6.2 Write (Scrittura)

| Azione | Regola |
|--------|--------|
| **Creare** (nuova attività, nuovo terreno, nuovo prodotto) | ✅ Tony può emettere i comandi. Richiesta esplicita dell'utente o conferma contestuale. |
| **Modificare** (aggiornare record esistente) | ✅ Con conferma esplicita. Tony propone, utente conferma. |
| **Eliminare** | ⚠️ Solo su richiesta esplicita e conferma. Mai azione automatica. |
| **Azioni irreversibili** (es. eliminazione bulk) | ❌ Tony non le esegue. Propone all'utente di farlo manualmente. |

---

## 7. Entry point da ovunque

L'utente non deve navigare alla sezione giusta prima di parlare con Tony.

**Scenario target**: utente in Dashboard dice "Ho trinciato 6 ore nel vigneto Sangiovese"
1. Tony riconosce intento → form Attività
2. Tony: APRI_PAGINA `attivita` (se modal non esiste)
3. Tony: OPEN_MODAL `attivita-modal`
4. Tony: SET_FIELD tipo lavoro = Trinciatura, SET_FIELD ore ≈ 6, SET_FIELD terreno = Sangiovese
5. Tony chiede data se manca
6. Utente: "Oggi" → Tony compila e salva

**Requisiti**:
- System prompt con routing intent ("ho fatto X" → attività)
- Fallback nel client: OPEN_MODAL su pagina dove modal non esiste → APRI_PAGINA prima, poi riprova

**Domanda di conferma (trattore/attrezzo)**:
- Se in azienda c'è un solo trattore o un solo attrezzo idoneo al tipo lavoro → Tony compila direttamente.
- Se ce ne sono più (es. 3 erpici, 2 trinciatrici, 2 trattori) → Tony chiede: "Quale trattore/attrezzo hai usato? [elenco opzioni: Agrifull, Nuovo T5]" e aspetta la risposta prima di compilare.

---

## 8. Grafici e tabelle

Tony non "compila" grafici. Può:
1. **Descrivere** i dati sottostanti (se nel contesto) – "Le ore questo mese sono 120, in calo del 10%"
2. **Navigare** alla pagina – "Ti porto ai grafici delle vendemmie" → APRI_PAGINA vigneto-statistiche
3. **Riportare** dati da tabelle – usa currentTableData, FILTER_TABLE, SUM_COLUMN

---

## 9. Roadmap di sviluppo

### Fase 1 – Consolidamento fondamenti ⏳ Parziale
- Completare supporto terreno (injector, auto-save, proattività)
- Fix INJECT_FORM_DATA per terreno-form
- Divieto ID Firestore, uso nomi nelle SELECT
- **Criterio done**: Tony aggiunge terreno da pagina terreni senza essere guidato passo-passo

### Fase 2 – Navigazione cross-page ✅ Completata
- Entry point da ovunque: "ho trinciato 6 ore" da Dashboard funziona
- Fallback APRI_PAGINA + OPEN_MODAL quando modal assente
- System prompt: routing intent (attività vs lavoro vs terreni vs domanda informativa)
- **Criterio done**: Operaio può dire "Ho fatto 8 ore di potatura" da qualsiasi pagina e Tony completa il flusso

### Fase 3 – Context Builder e dati aziendali ✅ In corso
- Servizio che aggrega: scadenze, alert (sotto scorta, guasti), statistiche
- **buildContextAzienda** in CF: terreni (coltura_categoria), macchine (cavalli, cavalliMinimiRichiesti), tipi lavoro, colture, summaryScadenze, guastiAperti
- Summary testuali nel contesto inviato a tonyAsk
- Estensione currentTableData a tutte le pagine lista (~17 da dotare)
- **Criterio done**: Tony risponde a "Quali scadenze ho?" e "Come stanno i prodotti?" con dati reali

### Fase 4 – Iniezione universale ✅ In corso
- Injector generico che legge da TONY_FORM_MAPPING
- Form Attività e Lavori: INJECT_FORM_DATA, deriveCategoriaFromTipo, override Generale→Tra le File su terreni con filari (2026-03-02)
- Hook opzionali per form con logica specifica (attività, lavoro)
- **Criterio done**: Aggiungere prodotto, cliente, movimento richiede solo aggiornare il mapping

### Fase 5 – Grafici e report ⏳ Parziale
- Tony descrive dati statistici dal contesto
- Comando APRI_PAGINA per pagine statistiche/report
- **Criterio done**: "Mostrami le statistiche vigneto" → Tony apre la pagina e/o riassume i dati

### Fase 6 – Proattività e memoria ❌ Da fare
- Alert automatici nel contesto ("2 affitti in scadenza")
- Tony propone: "Ho notato X, vuoi che...?"
- Confronti temporali (anno corrente vs precedente) dove i dati sono disponibili
- **Criterio done**: Tony segnala proattivamente almeno scadenze e sotto scorta

---

## 10. Limitazioni esplicite

- **Mappe**: Tony non traccia poligoni. Può aprire le pagine con mappe; il tracciamento resta manuale.
- **Grafici**: Tony non genera grafici. Descrive dati o naviga alla pagina che li mostra.
- **Eliminazioni bulk**: Tony non le esegue. Guida l'utente a farle manualmente.
- **Impostazioni sensibili**: Cambio password, revoca utenti – Tony può spiegare come fare, non eseguire senza conferma esplicita.
- **Moduli futuri**: Ogni nuovo modulo deve essere integrato via configurazione, non con patch ad hoc.

---

## 11. Riferimenti

Per capire **a che punto siamo** e cosa è stato fatto:
- **Stato attuale (2026-03-08)**: `docs-sviluppo/STATO_TONY_2026-03-08.md` – documento aggiornato con checklist
- **Questo documento** (§Stato dello sviluppo, §9 Roadmap)
- **Changelog**: `docs-sviluppo/COSA_ABBIAMO_FATTO.md` – elenco dettagliato modifiche con date

Per dettagli tecnici e sviluppo Tony:
- **Inventario**: `docs-sviluppo/INVENTARIO_APP_FORM_TABELLE_SEZIONI_GRAFICI.md`
- **Rotte Tony**: `core/config/tony-routes.json` (56 target)
- **Form mapping**: `core/config/tony-form-mapping.js`
- **currentTableData**: `docs-sviluppo/RIEPILOGO_CURRENTTABLEDATA_PER_MODULO_LISTE.md`
- **Guida Tony**: `docs-sviluppo/GUIDA_SVILUPPO_TONY.md`
- **Sviluppo Marzo 2026** (vigneto, compilazione, salvataggio, fix regressioni): `docs-sviluppo/TONY_SVILUPPO_2026-03_VIGNETO_E_COMPILAZIONE.md`

---

## 12. Regola d'oro

**Ogni modifica a Tony** (system prompt, main.js, injector, servizi) deve:
1. Allinearsi a questo Master Plan
2. Favorire scalabilità (configurazione > codice)
3. Non introdurre logica specifica per un solo modulo senza ragione documentata

Se una modifica contraddice il piano, va discussa e aggiornato il piano prima di procedere.
