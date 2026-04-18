# Master Plan – Tony Assistente Universale

**Versione**: 1.4  
**Data**: 2026-04-04  
**Stato**: Documento di riferimento – tutte le modifiche a Tony devono allinearsi a questo piano.

*Consolidato da `docs-sviluppo/MASTER_PLAN_TONY_UNIVERSAL.md`*

---

## Stato dello sviluppo (a colpo d'occhio)

| Fase | Nome | Stato | Criterio done |
|------|------|-------|---------------|
| **1** | Consolidamento fondamenti | ⏳ Parziale | Tony aggiunge terreno senza guidare passo-passo |
| **2** | Navigazione cross-page | ✅ **Completata** | "Ho trinciato 6 ore" → attivita-modal; "Crea lavoro erpicatura nel Sangiovese" → lavoro-modal (2026-03-08) |
| **3** | Context Builder e dati aziendali | ✅ **In corso** | summaryScadenze ok; movimenti recenti in ctx (max 50); **summarySottoScorta** + prodottiSottoScorta (2026-04-11) |
| **4** | Iniezione universale | ✅ **In corso** | Attività, Lavori (entry point da ovunque 2026-03-08), Terreno (OPEN_MODAL+fields), **Nuovo Preventivo** (preventivo-form, 2026-03-24); magazzino prodotto/movimento via mapping+injector |
| **5** | Grafici e report | ⏳ Parziale | APRI_PAGINA statistiche; MOSTRA_GRAFICO da fare |
| **6** | Proattività e memoria | ⏳ Parziale | Dashboard + Guasti ok; liste/form magazzino con proattività parziale (timer, interview, conferma salvataggio); "Ho notato X" da fare |

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
- **summaryScadenze**: "3 mezzi in scadenza, 2 affitti scaduti" ✅ implementato
- **summaryAlert**: "2 prodotti sotto scorta, 1 guasto aperto" (summarySottoScorta in ctx.azienda da buildContextAzienda)
- **summaryStats**: aggregati ore, superfici, rese (da costruire)
- **terreni.poderi, terreni.colture**: quando rilevante ✅ implementato

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

### 6.3 Sicurezza: accettazione preventivo da link email (cliente esterno)

Flusso **fuori** dal login GFV: pagina `accetta-preventivo-standalone.html` con token in querystring. Non è una funzione Tony (nessun contesto `moduli_attivi` / tenant); eventuali warning del widget sulla pagina pubblica sono attesi.

**Perimetro tecnico** (obbligatorio per non esporre Firestore al pubblico):

- Lettura e aggiornamento **solo** tramite callable **`getPreventivoPubblico`** e **`aggiornaStatoPreventivoPubblico`** (`europe-west1`, `invoker: "public"`, Admin SDK). La pagina **non** usa il client Firestore per `tenants` / `clienti` / `preventivi`.
- **Firestore rules**: dati aziendali solo utenti autenticati nel tenant; il cliente anonimo non legge le collection.
- **Indici**: `firebase.json` deve dichiarare `firestore.indexes.json`; per `collectionGroup('preventivi')` su `tokenAccettazione` serve il **field override** (non un falso “composito” a un campo). Deploy indici insieme alle rules quando si tocca la query.
- **Segreti**: non associare `SENTRY_DSN` come secret obbligatorio a queste callable (rischio 500 se il secret non è legato). Dettagli in `functions/README.md` e `docs-sviluppo/SICUREZZA_FLUSSI.md`.

**Scalabilità**: nuove azioni pubbliche sullo stesso modello → nuova callable centralizzata, mai patch “solo questa pagina” con letture client anonime.

---

## 7. Entry point da ovunque

L'utente non deve navigare alla sezione giusta prima di parlare con Tony.

**Scenario target**: utente in Dashboard dice "Ho trinciato 6 ore nel vigneto Sangiovese"
1. Tony riconosce intento → form Attività
2. Tony: APRI_PAGINA `attivita` (se modal non esiste)
3. Tony: OPEN_MODAL `attivita-modal` con fields
4. Tony chiede campi mancanti (trattore, attrezzo, ecc.) quando form aperto
5. Utente: "Oggi" → Tony compila e salva

**Requisiti**:
- System prompt con routing intent ("ho fatto X" → attività)
- Fallback nel client: OPEN_MODAL su pagina dove modal non esiste → APRI_PAGINA prima, poi riprova

**Domanda di conferma (trattore/attrezzo)**:
- Se in azienda c'è un solo trattore o un solo attrezzo idoneo al tipo lavoro → Tony compila direttamente.
- Se ce ne sono più → Tony chiede: "Quale trattore/attrezzo hai usato? [elenco opzioni]" e aspetta la risposta prima di compilare.

---

## 8. Grafici e tabelle

Tony non "compila" grafici. Può:
1. **Descrivere** i dati sottostanti (se nel contesto) – "Le ore questo mese sono 120, in calo del 10%"
2. **Navigare** alla pagina – "Ti porto ai grafici delle vendemmie" → APRI_PAGINA vigneto-statistiche
3. **Riportare** dati da tabelle – usa currentTableData, FILTER_TABLE, SUM_COLUMN

---

## 9. Roadmap di sviluppo

### Fase 1 – Consolidamento fondamenti ⏳ Parziale
- Terreno: OPEN_MODAL terreno-modal + fields (non injectTerrenoForm)
- Divieto ID Firestore, uso nomi nelle SELECT
- **Criterio done**: Tony aggiunge terreno da pagina terreni senza essere guidato passo-passo

### Fase 2 – Navigazione cross-page ✅ Completata
- Entry point da ovunque: "ho trinciato 6 ore" da Dashboard funziona
- Fallback APRI_PAGINA + OPEN_MODAL quando modal assente
- System prompt: routing intent (attività vs lavoro vs terreni vs domanda)
- **Criterio done**: Operaio può dire "Ho fatto 8 ore di potatura" da qualsiasi pagina e Tony completa il flusso

### Fase 3 – Context Builder e dati aziendali ✅ In corso
- **buildContextAzienda** in CF: terreni (coltura_categoria), macchine, tipi lavoro, colture, summaryScadenze, guastiAperti, **ultimi movimenti magazzino** (`movimentiMagazzino` → `movimentiRecenti` + testo riassuntivo)
- **summarySottoScorta** + **prodottiSottoScorta** in CF (2026-04-11); lettura prodotti con **scortaMinima** (campo reale in Firestore)
- **Criterio done**: Tony risponde a "Quali scadenze ho?", "Come stanno i prodotti?" e domande su **ultimi carichi/scarichi** con dati reali anche fuori dalla pagina Movimenti (lista completa e filtri restano sulla pagina)

### Fase 4 – Iniezione universale ✅ In corso
- Injector generico che legge da TONY_FORM_MAPPING
- Form Attività e Lavori: INJECT_FORM_DATA, deriveCategoriaFromTipo, override Generale→Tra le File
- Terreno: OPEN_MODAL + fields
- Nuovo Preventivo (preventivo-form), Magazzino (prodotto-form / movimento-form): mapping + injector + comandi standard
- **Criterio done**: Nuovo form/modulo richiede soprattutto mapping e istruzioni CF, non patch per pagina

### Fase 5 – Grafici e report ⏳ Parziale
- Tony descrive dati statistici dal contesto
- Comando APRI_PAGINA per pagine statistiche/report
- Comando MOSTRA_GRAFICO: da fare
- **Criterio done**: "Mostrami le statistiche vigneto" → Tony apre la pagina e/o riassume i dati

### Fase 6 – Proattività e memoria ⏳ Parziale
- Parziale: briefing/dashboard, modulo Guasti, avvisi sotto scorta in pagina prodotti (TTS), form magazzino con domande/intervista e promemoria conferma salvataggio (senza salvataggio automatico da solo testo modello)
- Da fare: frasi tipo "Ho notato X, vuoi che...?" cross-modulo; confronti temporali strutturati dove i dati sono disponibili
- Backlog operativo concordato: flusso "campioni" con mappa punti georeferenziati (raccolta/profilazione maturazione), su pattern GPS opzionale riusabile e non bloccante
- **Criterio done (obiettivo)**: Tony segnala proattivamente scadenze e sotto scorta in modo uniforme sui moduli + memoria/confronti ove previsto

---

## 10. Limitazioni esplicite

- **Mappe**: Tony non traccia poligoni. Può aprire le pagine con mappe; il tracciamento resta manuale.
- **Grafici**: Tony non genera grafici. Descrive dati o naviga alla pagina che li mostra.
- **Eliminazioni bulk**: Tony non le esegue. Guida l'utente a farle manualmente.
- **Impostazioni sensibili**: Cambio password, revoca utenti – Tony può spiegare come fare, non eseguire senza conferma esplicita.
- **Moduli futuri**: Ogni nuovo modulo deve essere integrato via configurazione, non con patch ad hoc.

---

## 11. Riferimenti

- **Stato attuale**: `docs-sviluppo/tony/STATO_ATTUALE.md`
- **PWA / deploy client**: hook **`pre-commit`** / script **`bump:pwa-cache`** aggiornano **`SW_CACHE_BUILD_ID`** in `service-worker.js` (vedi **`docs-sviluppo/GUIDA_PWA.md`** e **TONY_DECISIONI_E_REQUISITI.md** §3.8) — riduce cache stale su app installata
- **Magazzino – ipotesi future (OCR/Gemini, bolla/fattura, prezzi in attesa)**: `docs-sviluppo/magazzino/ROADMAP_ACQUISIZIONE_DOCUMENTI_GEMINI.md` — da considerare quando si lavora su acquisizione documenti e movimenti d’acquisto
- **Inventario decisioni**: `docs-sviluppo/TONY_DECISIONI_E_REQUISITI.md`
- **Changelog**: `docs-sviluppo/COSA_ABBIAMO_FATTO.md`
- **Sicurezza (Firestore, link pubblici, callable)**: `docs-sviluppo/SICUREZZA_FLUSSI.md`
- **Guida sviluppo**: `docs-sviluppo/GUIDA_SVILUPPO_TONY.md`
- **Form mapping**: `core/config/tony-form-mapping.js`
- **Rotte**: `core/config/tony-routes.json`
- **Cloud Functions (incl. preventivo pubblico)**: `functions/README.md`

---

## 12. Regola d'oro

**Ogni modifica a Tony** (system prompt, main.js, injector, servizi) deve:
1. Allinearsi a questo Master Plan
2. Favorire scalabilità (configurazione > codice)
3. Non introdurre logica specifica per un solo modulo senza ragione documentata

Se una modifica contraddice il piano, va discussa e aggiornato il piano prima di procedere.
