# Master Plan – Tony Assistente Universale

**Versione**: 1.5  
**Data**: 2026-06-20  
**Stato**: Documento di riferimento – tutte le modifiche a Tony devono allinearsi a questo piano.

*Consolidato da `docs-sviluppo/MASTER_PLAN_TONY_UNIVERSAL.md`*

---

## Stato dello sviluppo (a colpo d'occhio)

| Fase | Nome | Stato | Criterio done |
|------|------|-------|---------------|
| **1** | Consolidamento fondamenti | ⏳ Parziale | Tony aggiunge terreno senza guidare passo-passo — **injectTerrenoForm + save/proattivo locale** ✅ (2026-06-08); **entity parser terreno client/CF** ✅ (2026-06-14 merge locale) |
| **2** | Navigazione cross-page | ✅ **Completata** | "Ho trinciato 6 ore" → attivita-modal; "Crea lavoro erpicatura nel Sangiovese" → lavoro-modal (2026-03-08); **hub Manodopera manager** (2026-06-13); **nav slide workspace campo** comunicazioni/ore/lavoro/statistiche (build `2026-07-17f`, ✅ verificato utente) |
| **3** | Context Builder e dati aziendali | ✅ **In corso** | summaryScadenze ok; movimenti recenti in ctx (max 50); **summarySottoScorta** + prodottiSottoScorta (2026-04-11); **`consigliModuli` / `consigliBundle` / segnali moduli** per Tony Guida Base (2026-06-19, **bundle 2026-06-20**); **gating freemium Tony** loader + CF (2026-06-22d, E2E verificato) |
| **4** | Iniezione universale | ✅ **In corso** | Attività, Lavori (entry point da ovunque 2026-03-08), Terreno (OPEN_MODAL+fields + **entity parser** 2026-06-14), **Nuovo Preventivo** (preventivo-form, 2026-03-24; **filari + meteo data + disambiguazione terreno** verificati 2026-05-24); **Magazzino** prodotto/movimento + **save locale** + creazione client-side + **cross-page** (3b-C15…**C19** E2E 2026-06-02), dosaggio/carenza obbligatori fitofarmaci, prezzo entrata da catalogo; **intervista lavoro client-side** — ack tipo dopo stem vago E2E ✅ (2026-06-03); **intervista lavoro vocale E2E** ✅ multi-PC (2026-06-14); **Segna ore workspace campo** intervista + save locale 0 CF + validazione manager E2E ✅ (**3b-C21**, 2026-06-04); **Segna ore desktop segnatura-ore** stesso motore unificato + one-shot E2E ✅ (**3b-C22** / **T-FLOW-022**, 2026-07-11) |
| **5** | Grafici e report | ⏳ Parziale | APRI_PAGINA statistiche; MOSTRA_GRAFICO da fare |
| **6** | Proattività e memoria | ⏳ Parziale | Dashboard + Guasti ok; briefing meteo + voce dashboard (2026-06-09g; PWA + RIASSUNTO nomi — 2026-06-15); **Chirp 3 HD** + **TTS chunking/latency** build `2026-06-19a`; **Tony consigliere moduli** (upsell soft moduli verticali, solo Base — 2026-06-19); latenza auto-mode `2026-06-14a`; meteo operativo §19; boot dashboard ~861 ms; "Ho notato X" cross-modulo oltre meteo da fare |

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

### 5.4 Backend Gemini (API REST)
- **Modello in produzione (2026-06-03):** **`gemini-2.5-flash`** — sostituisce `gemini-2.0-flash` (deprecato da Google, risposta 404 su `tonyAsk` / `tonyAskStream`).
- **Config:** costante `TONY_GEMINI_MODEL` in `functions/index.js`; stesso identificatore in `core/services/tony-service.js` per fallback SDK locale.
- **Override senza redeploy codice:** variabile env **`GEMINI_MODEL`** su Cloud Run (`tonyask`, `tonyaskstream`). Chiave API: **`GEMINI_API_KEY`** (obbligatoria su entrambi i servizi).
- **Manutenzione:** se in console compare `Errore chiamata Gemini: 404`, verificare modelli disponibili (`GET …/v1beta/models`) e aggiornare `TONY_GEMINI_MODEL` / env.

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
- **2026-05-25 (form Lavoro):** risposta breve a disambiguazione **trattore** gestita **client-side** (inject + verifica DOM + «Vuoi che salvi?» locale, senza CF). Estensioni concordate: attrezzo multiplo, operaio/terreno ambigui — **non** sottocategoria/tipo lavoro (derivati da coltura terreno). Vedi `TONY_DECISIONI_E_REQUISITI.md` §14.4–§14.7.

---

## 8. Grafici e tabelle

Tony non "compila" grafici. Può:
1. **Descrivere** i dati sottostanti (se nel contesto) – "Le ore questo mese sono 120, in calo del 10%"
2. **Navigare** alla pagina – "Ti porto ai grafici delle vendemmie" → APRI_PAGINA vigneto-statistiche
3. **Riportare** dati da tabelle – usa currentTableData, FILTER_TABLE, SUM_COLUMN

---

## 9. Roadmap di sviluppo

### Fase 1 – Consolidamento fondamenti ⏳ Parziale
- Terreno: OPEN_MODAL terreno-modal + **INJECT_FORM_DATA terreno-form** via `injectTerrenoForm` (2026-06-08); save/proattivo locale come magazzino
- Divieto ID Firestore, uso nomi nelle SELECT
- **Criterio done**: Tony aggiunge terreno da pagina terreni senza essere guidato passo-passo

### Fase 2 – Navigazione cross-page ✅ Completata
- Entry point da ovunque: "ho trinciato 6 ore" da Dashboard funziona
- Fallback APRI_PAGINA + OPEN_MODAL quando modal assente
- System prompt: routing intent (attività vs lavoro vs terreni vs domanda)
- **Hub modulo Manodopera (2026-06-13):** home manager `manodopera-home-standalone.html`; Tony target `manodopera` → hub; card Moduli + quick bar `manodoperaHome` — allineamento pattern Magazzino/Vigneto (piano `docs-sviluppo/manodopera/PLAN_HUB_MODULO_MANODOPERA.md` Fase 1 ✅)
- **Workspace mobile profilo campo (2026-07-17):** nav vocale tra slide (comunicazioni, ore, lavoro, statistiche, valida ore) via intercept locale + `tryTonyFieldNavQuickReply`; un solo FAB Tony (no widget negli iframe `embed=mobile`) — ✅ verificato utente, build `2026-07-17e`–`f`
- **Criterio done**: Operaio può dire "Ho fatto 8 ore di potatura" da qualsiasi pagina e Tony completa il flusso

### Fase 3 – Context Builder e dati aziendali ✅ In corso
- **buildContextAzienda** in CF: terreni (coltura_categoria), macchine, tipi lavoro, colture, summaryScadenze, guastiAperti, **ultimi movimenti magazzino** (`movimentiMagazzino` → `movimentiRecenti` + testo riassuntivo)
- **summarySottoScorta** + **prodottiSottoScorta** in CF (2026-04-11); lettura prodotti con **scortaMinima** (campo reale in Firestore)
- **Criterio done**: Tony risponde a "Quali scadenze ho?", "Come stanno i prodotti?" e domande su **ultimi carichi/scarichi** con dati reali anche fuori dalla pagina Movimenti (lista completa e filtri restano sulla pagina)

### Fase 4 – Iniezione universale ✅ In corso
- Injector generico che legge da TONY_FORM_MAPPING
- Form Attività e Lavori: INJECT_FORM_DATA, deriveCategoriaFromTipo, override Generale→Tra le File
- **Lavoro — gerarchia lavorazione:** sottocategoria/tipo derivati da **coltura terreno** (policy injector + mapping); disambiguazione chat solo per **macchine** (trattore/attrezzo) e campi realmente ambigui, non per Tra le File vs Interfilare se terreno noto
- **Lavoro — disamb. trattore (2026-05-25):** risposta utente client-side, canary E2E OK
- Terreno: OPEN_MODAL + fields
- Nuovo Preventivo (preventivo-form), Magazzino (prodotto-form / movimento-form): mapping + injector + comandi standard
- **Criterio done**: Nuovo form/modulo richiede soprattutto mapping e istruzioni CF, non patch per pagina

### Fase 5 – Grafici e report ⏳ Parziale
- Tony descrive dati statistici dal contesto
- Comando APRI_PAGINA per pagine statistiche/report
- Comando MOSTRA_GRAFICO: da fare
- **Criterio done**: "Mostrami le statistiche vigneto" → Tony apre la pagina e/o riassume i dati

### Fase 6 – Proattività e memoria ⏳ Parziale
- Parziale: briefing/dashboard (scorte, scadenze, guasti), **briefing meteo operativo** con modulo `meteo` + Tony Avanzato (2026-05-21), **chat meteo ~8 giorni** e **pianificazione trattamento/lavoro** (quick reply CF + soglie vento/pioggia), **suggerimento `condizioniMeteo`** su form trattamento campo (conferma utente prima del salvataggio)
- **Implementato (2026-06-09, build client `2026-06-09g`):** flusso **voce dashboard** — saluto proattivo anche senza criticità ops; domanda meteo → cache client (0 CF); «fammi un riassunto» / «sì» dopo offerta → `buildDashboardRiassuntoText`; addio vocale locale; TTS senza troncamento (mic off durante parlato, no eco `barge_in_speech`); temperature TTS «da X a Y gradi»
- **Implementato (2026-06-15):** **PWA/mobile** — saluto in chat con apertura pannello Tony (no TTS autoplay); turno proattivo in `chatHistory` per conferma «sì»; **RIASSUNTO** con **nomi** prodotti sotto scorta, guasti e scadenze mezzi (`dashboard-tony-briefing-text.js` + summary nello snapshot dashboard)
- **Implementato (2026-06-19):** **Tony consigliere moduli** — Tony Guida (solo Base) suggerisce moduli e complementi da segnali azienda; gating legacy; vedi `STRATEGIA_MARKETING_VENDITA_HANDOFF.md`
- **Implementato (2026-06-20):** **Tony consigliere bundle** — suggerimenti pacchetto, confronto singoli vs bundle, domande «conviene aggiungere bundle X?» con **costo marginale**; no pacchetti gemelli se bundle attivo; expand filtrato; routing meteo vs intent abbonamento
- **Implementato (2026-06-19):** **TTS latenza** — chunking frasi risposte complete; `speakingRate` 1.05; pipeline voice cached/dedup; build `2026-06-19a`; canary `npm run tony:tts-canary`
- **Implementato (2026-06-20, build client `2026-06-20r`, verificato utente):** **modalità vocale continua** — mic reopen affidabile post-TTS (`completeTtsClip`); whitelist spegnimento auto-mode; reconcile TTS stream su clip lette (testo voce = testo chat); segnale acustico turno; **STT** con `?` su domande (`applyItalianVoiceQuestionPunctuation`); distinzione saluto/congedo vocale
- **Implementato (2026-05-22):** praticabilità terreno per **morfologia** (pianura/collina/montagna), soglie mm lookback, **asciugatura post-pioggia** per lavorazioni terreno, **doppia alternativa** (prima/dopo giorno scartato), select `tipoCampo`, quick reply Tony (morfologia + praticabilità + due date) — v. `TONY_DECISIONI_E_REQUISITI.md` §19.8–§19.9; **UI Impostazioni** override soglie tenant ancora da fare (default hardcoded)
- Da fare: frasi tipo "Ho notato X, vuoi che...?" cross-modulo oltre meteo; **card/chip Abbonamento** da `consigliModuli` (backlog marketing §8 handoff)
- Backlog operativo concordato: flusso "campioni" con mappa punti georeferenziati (raccolta/profilazione maturazione), su pattern GPS opzionale riusabile e non bloccante
- **Criterio done (obiettivo)**: Tony segnala proattivamente scadenze e sotto scorta in modo uniforme sui moduli + memoria/confronti ove previsto

---

## 10. Limitazioni esplicite

- **Mappe**: Tony non traccia poligoni. Può aprire le pagine con mappe; il tracciamento resta manuale.
- **Grafici**: Tony non genera grafici. Descrive dati o naviga alla pagina che li mostra.
- **Eliminazioni bulk**: Tony non le esegue. Guida l'utente a farle manualmente.
- **Impostazioni sensibili**: Cambio password, revoca utenti – Tony può spiegare come fare, non eseguire senza conferma esplicita.
- **Moduli futuri**: Ogni nuovo modulo deve essere integrato via configurazione, non con patch ad hoc.
- **Tony Occhi (documenti)**: **parzialmente implementato** (Fase 0–3; hardening fattura / `riferimentoBolla` 2026-07-17; **prezzo medio anagrafica** media ponderata ✅ verificato 2026-07-19 — §20.28). Piano evolutivo **§17** in `docs-sviluppo/da-fare/magazzino/ROADMAP_ACQUISIZIONE_DOCUMENTI_GEMINI.md`; v. `TONY_DECISIONI_E_REQUISITI.md` §20.

---

## 11. Riferimenti

- **Stato attuale**: `docs-sviluppo/tony/STATO_ATTUALE.md`
- **Handoff agenti — performance / nav quick reply** (backlog nav binario B, metriche client 0 CF, `tony:perf-review`, fix meteo 2026-06-10): `docs-sviluppo/in-sviluppo/tony/HANDOFF_CONTINUITA_PERFORMANCE_NAV.md`
- **Handoff agenti — voce TTS Chirp 3 HD** (migrazione, latenza 2026-06-19, `speakingRate` 1.05): `docs-sviluppo/tony/HANDOFF_TTS_CHIRP3.md`
- **Strategia marketing / vendita / Tony consigliere moduli** (funnel Free→Base→moduli, backlog GTM): `docs-sviluppo/STRATEGIA_MARKETING_VENDITA_HANDOFF.md`
- **Billing v2 Abbonamento / Stripe** (Fase 1 ✅ deploy+verifica 2026-06-21 — D5: accesso off alla disattivazione, riattivazione fino a scadenza; Fasi 2–4 coterm/converti bundle): `docs-sviluppo/in-sviluppo/abbonamento/BILLING_V2_HANDOFF.md`
- **Piano audio barge-in + chunking TTS** (Fase 1 ✅): `docs-sviluppo/tony/PIANO_AUDIO_PIPELINE_BARGEIN.md`
- **Piano ottimizzazione performance Tony** (Fase 0–**4** ✅ deploy 2026-06-03; **Segna ore workspace 3b-C21** ✅ 2026-06-04; **Segna ore desktop 3b-C22** ✅ 2026-07-11; 4.4 offline deferred; canary §1.4, magazzino §1.7, field workspace §1.9, binario B §9 Fase 4): `docs-sviluppo/in-sviluppo/tony/PLAN_OTTIMIZZAZIONE_PERFORMANCE.md`
- **Piano performance dashboard panoramica** (Fase 0–**5** ✅ 2026-06-06; canary **`dashboard pronta` ~861 ms**; smoke `npm run dashboard:perf-smoke`): `docs-sviluppo/dashboard/PLAN_PERFORMANCE_DASHBOARD.md`
- **PWA / deploy client**: hook **`pre-commit`** / script **`bump:pwa-cache`** aggiornano **`SW_CACHE_BUILD_ID`** in `service-worker.js` (vedi **`docs-sviluppo/GUIDA_PWA.md`** e **TONY_DECISIONI_E_REQUISITI.md** §3.8) — riduce cache stale su app installata
- **Magazzino – Tony Occhi (acquisizione documenti)**: `docs-sviluppo/da-fare/magazzino/ROADMAP_ACQUISIZIONE_DOCUMENTI_GEMINI.md` — Fase 0–3 in codice; **§17** scontrino/fattura/match; **§20.28** prezzo medio anagrafica ✅ 2026-07-19
- **Tony E2E simulatore (M-T0…M-T6)**: `docs-sviluppo/in-sviluppo/simulator/TONY_E2E_GUIDA_SVILUPPO.md` — M-T4 ✅ mock **17/17** (gate-fast CI ~4–6 min, 2026-07-11); M-T5 ✅ live tier 3 + gate p95
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
