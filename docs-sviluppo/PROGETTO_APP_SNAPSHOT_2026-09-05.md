# GFV Platform (Global Farm View) - Specifiche Tecniche e Funzionali Complete

> **Snapshot locale 2026-09-05**, spostato da `progetto_app.md`. Non è la fonte di verità: per decisioni e stato usare `tony/MASTER_PLAN.md`, `tony/STATO_ATTUALE.md`, `TONY_DECISIONI_E_REQUISITI.md`.

**Versione documento:** 2026-07-10  
**Progetto Firebase:** `gfv-platform`  
**Versione package:** `1.0.0` (stato: sviluppo attivo, non release stabile)

---

## 1. Visione d'Insieme e Obiettivi

### Scopo dell'Applicazione

GFV Platform è un **ERP agricolo SaaS multi-tenant** progettato per aziende viticole, frutticole e operatori di servizi agricoli a conto terzi. Risolve il problema della **frammentazione gestionale** tipica delle aziende agricole: terreni, lavori, manodopera, macchine, magazzino fitosanitario, preventivi clienti e colture specializzate vivono oggi in fogli Excel, quaderni di campo e software non integrati.

Il target di riferimento comprende:

- **Proprietari e manager** di aziende agricole (decisioni, report, abbonamenti, configurazione)
- **Capisquadra** (pianificazione lavori, validazione ore, tracciamento zone su mappa)
- **Operai** (segnatura ore, workspace mobile semplificato)
- **Prestatori di servizi a conto terzi** (clienti, preventivi, vendemmia meccanica, tariffe)

L'elemento differenziante è **Tony**, l'assistente IA integrato: non è una chat laterale, ma l'interfaccia intelligente che legge dati strutturati dell'ERP, naviga tra le pagine, compila form e risponde a domande operative/analitiche in linguaggio naturale (testo e voce).

### Obiettivi di Business/Produttività

**Breve termine (operativo):**

- Ridurre il tempo di inserimento dati in campo (ore, attività, lavori) tramite Tony e interfacce mobile semplificate
- Offrire un modello **pay-per-module** con piano Free per acquisizione e piano Base (€5/mese di riferimento, fatturato annualmente) per sbloccare limiti e moduli
- Monetizzare moduli verticali (Vigneto, Frutteto, Conto Terzi, Manodopera, Magazzino, Meteo, Report, Tony) con bundle strategici e prove gratuite 30 giorni
- Garantire isolamento dati per tenant e conformità ai ruoli (amministratore, manager, caposquadra, operaio)

**Lungo termine (strategico):**

- Convergere verso un **agente universale** (Tony) capace di operare da qualsiasi pagina: occhi su liste (`window.currentTableData`), mani su form (`tony-form-mapping.js` + `tony-form-injector.js`)
- Arricchire il **Context Builder** cloud (`ctx.azienda`) per analisi cross-modulo, proattività ("Ho notato X…") e confronti storici anno su anno
- Estendere moduli coltura (Oliveto pianificato), acquisizione documenti magazzino via OCR/Gemini (roadmap, non implementato)
- Scalare l'architettura serverless Firebase mantenendo **configurazione > codice** (niente patch per singola pagina nel core Tony)

---

## 2. Stack Tecnico e Architettura

### Linguaggi e Framework

| Layer | Tecnologia | Versione / Dettaglio |
|-------|-----------|----------------------|
| **Frontend ERP** | HTML5, CSS3, JavaScript ES6+ (moduli ES) | Nessun bundler; pagine standalone multi-page |
| **Firebase JS SDK (client)** | CDN `gstatic.com` | **11.0.0** (`core/services/firebase-service.js`) |
| **Landing marketing** | Vue 3 + Vue Router + TypeScript + Vite | Vue `^3.5.13` (lock `3.5.32`), Vite `^6.0.3` (lock `6.4.2`), TS `~5.7.2` |
| **Backend** | Firebase Cloud Functions | Node.js **20** (`functions/package.json` engines) |
| **firebase-functions** | npm | `^7.0.5` (lock `7.0.5`) |
| **firebase-admin** | npm | root `^13.6.0`, functions `^13.6.1` |
| **Test unitari** | Vitest | `^1.0.0` (lock `1.6.1`) |
| **Test E2E** | Playwright | `^1.49.1` (lock `1.49.1`) |
| **Dev server ERP** | http-server | `^14.1.1`, porta **8000**, cache disabilitata (`-c-1`) |
| **Firebase CLI** | firebase-tools | `^15.19.1` |
| **Grafici** | Chart.js | Usato in statistiche Vigneto/Frutteto (CDN nelle pagine) |
| **Mappe** | Google Maps JavaScript API | Chiave in `core/config/google-maps-config.js` |
| **Geometria poligoni** | polygon-clipping | `^0.15.7` (root dependency) |

### Architettura del Software

L'applicazione segue un'architettura **multi-page SPA-like** (73+ pagine `*-standalone.html`) con **backend serverless** e **multi-tenancy logica** su Firestore. Non è un monolite né microservizi classici: è un **modular monolith frontend** + **Cloud Functions come BFF/API layer**.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  BROWSER — ERP (vanilla JS, ES modules, PWA manifest)                  │
│  Entry: core/dashboard-standalone.html (start_url manifest.json)       │
│  Init: core/init.js → firebase-service.js → auth/tenant services        │
│  Tony: gfv-tony-loader.js → tony-widget-standalone.js → tony/main.js   │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ Firebase SDK 11 (Auth, Firestore, Storage)
                                │ HTTPS Callable + SSE (tonyAskStream)
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  FIREBASE (progetto gfv-platform, regione functions europe-west1)      │
│  • Firestore (dati tenant-scoped)                                        │
│  • Auth (email/password)                                                 │
│  • Storage (logo tenant)                                                 │
│  • Cloud Functions (index.js hub + moduli helper)                         │
│  • Hosting (solo landing Vue → landing/dist)                             │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
   Gemini REST API      Google Cloud TTS         OpenWeather 3.0
   (tonyAsk)            (getTonyAudio)           (meteo callables)
        │                       │                       │
        ▼                       ▼                       ▼
     Resend Email            Stripe API              Sentry (CF only)
```

**Pattern architetturali chiave:**

1. **Multi-tenant data isolation:** tutti i dati business sotto `tenants/{tenantId}/…`; collezioni globali limitate a `users`, `inviti`, `_gfv_sim_health`
2. **Modular pay-per-use:** accesso moduli risolto da `core/utils/module-access-resolver.js` + `subscription-plans.js` + stato Firestore `tenants.modules[]` e `moduleTrials`
3. **Tony Context-Driven:** ogni risposta IA passa da `buildContextAzienda()` (tier T1–T4) con cache Firestore `tonyContextCache`
4. **Config over code (Tony):** form mappati in `core/config/tony-form-mapping.js`; rotte in `core/config/tony-routes.json`; niente `if (formId === 'terreno')` nel core
5. **0-CF local intercepts:** molti flussi operativi (intervista lavoro, segna ore, save locale magazzino/preventivo/lavoro) evitano Cloud Functions per latenza e costo
6. **Standalone responsive:** ogni pagina è HTML autonomo con CSS/JS centralizzati (`core/styles/`, `shared/`)

**Comunicazione client ↔ server:**

- **Firestore real-time:** CRUD diretto dal client con security rules
- **Callable Functions:** `httpsCallable` per Tony, meteo, Stripe, email
- **SSE streaming:** `tonyAskStream` via `fetch` + `parseTonySseStream` (`core/services/tony-sse-parse.js`)
- **HTTP webhook:** `stripeWebhook` (no auth Firebase, verifica firma Stripe)
- **Public callables:** `getPreventivoPubblico`, `aggiornaStatoPreventivoPubblico` (accettazione preventivo senza login)

### Database e Storage

| Componente | Tecnologia | Dettaglio |
|-----------|-----------|-----------|
| **Database primario** | Cloud Firestore | NoSQL document-oriented; subcollezioni per entità annidate |
| **ORM/ODM** | Nessuno | Modelli JS custom in `core/models/` e `modules/*/models/` con metodi `toFirestore()` / `fromFirestore()` ereditati da `Base` |
| **Autenticazione** | Firebase Auth | Email/password; sessione gestita da SDK |
| **File storage** | Firebase Storage | Solo logo azienda: `tenants/{tenantId}/logo_*` (max 2 MB, `image/*`) |
| **Cache server** | Firestore (Admin SDK) | `meteoCache`, `tonyContextCache` — accesso client negato in rules |
| **Sessione client** | sessionStorage | `gfv_current_tenant_id`, `gfv_tony_pending_intent`, ruoli Tony, config cached |

**Logica di persistenza:**

- Path collection: `getCollection(name)` in `firebase-service.js` → `tenants/${tenantId}/${name}`
- Timestamp: conversione via `dateToTimestamp` / `timestampToDate` in `firebase-service.js`
- Subcollezioni: `lavori/{id}/oreOperai`, `lavori/{id}/zoneLavorate`, `macchine/{id}/manutenzioni`, `vigneti/{id}/vendemmie|potature|trattamenti`
- Indici compositi: `firestore.indexes.json` (tariffe, oreOperai, preventivi)

---

## 3. Servizi Terzi, API e Integrazioni

### Fornitori Cloud / Hosting

| Provider | Uso |
|---------|-----|
| **Google Firebase** | Firestore, Auth, Storage, Cloud Functions, Hosting (landing), Emulator Suite |
| **Google Cloud Platform** | Runtime Cloud Functions (Node 20), Text-to-Speech API |
| **GitHub** | Repository, Actions CI (`simulator-ci.yml`, `guida-impact-pr.yml`) |

**Deploy:**

- ERP: attualmente servito in dev con `npm start` (http-server :8000); PWA `manifest.json` punta a `core/dashboard-standalone.html`
- Landing: `npm run deploy:landing` → build Vite → `firebase deploy --only hosting` (public: `landing/dist`)
- Functions: `npm run deploy:functions` → `firebase deploy --only functions`
- Rules: `npm run deploy:rules` → Firestore rules + indexes

### Servizi di Autenticazione

- **Firebase Authentication** con email/password
- Flussi: login (`core/auth/login-standalone.html`), registrazione azienda (`registrazione-standalone.html`), reset password, registrazione invito (`registrazione-invito-standalone.html`)
- **Multi-tenancy:** `users/{uid}.tenantMemberships[tenantId]` con `ruoli[]` e `stato`; legacy `tenantId` + `ruoli` ancora supportati in rules
- **Ruoli:** `amministratore`, `manager`, `caposquadra`, `operaio`
- **Inviti:** collezione `inviti` con token pubblico; email via Resend

### Gateway di Pagamento

- **Stripe** (`stripe` npm `^18.5.0`)
- Price IDs: `functions/config/stripe-prices.json` (ambiente test/live via `STRIPE_ENV`)
- Flussi: `createStripeCheckoutSession`, `fulfillStripeCheckout`, `syncStripeSubscription`, `cancelStripeAddon`, `reactivateStripeAddon`, `stripeWebhook`
- Fatturazione: **annuale anticipata** (prezzi UI = riferimento mensile × 12); configurato in `core/config/subscription-plans.js` → `BILLING.chargeInterval: 'year'`
- Prove moduli: `startModuleTrial`, `syncModuleTrials` (30 giorni, 1 modulo in prova contemporaneo, anche su piano Free)

### Altri Servizi Esterni

| Servizio | Scopo | File / Secret |
|---------|-------|---------------|
| **Google Gemini REST** | LLM Tony (`gemini-2.5-flash`) | `GEMINI_API_KEY`, `GEMINI_MODEL`; `functions/tony-gemini-api.js` |
| **Google Cloud TTS** | Voce Tony Chirp 3 HD | `getTonyAudio`; voce `it-IT-Chirp3-HD-Charon`; `TONY_TTS_VOICE`, `TONY_TTS_SPEAKING_RATE` (default 1.05) |
| **Browser Web Speech API** | STT lato client | `core/js/tony/voice.js` — nessun cloud STT |
| **OpenWeather One Call 3.0** | Meteo sede/terreni | `OPENWEATHER_API_KEY`; `functions/meteo-service.js` |
| **Resend** | Email transazionali | `RESEND_API_KEY`; mittente `no-reply@globalfarmview.net`; `functions/email-resend.js` |
| **Google Maps JS API** | Mappe terreni, zone lavori, meteo | `window.GOOGLE_MAPS_API_KEY` da `google-maps-config.js` |
| **Sentry** | Monitoraggio errori CF | `SENTRY_DSN`; `functions/instrument.js`; `@sentry/node ^8.55.1` |
| **EmailJS** | Template email preventivi (client legacy CT) | `modules/conto-terzi/template-email-preventivo.html` |

**Non presenti:** SendGrid, Auth0, Supabase, PayPal, Vertex AI SDK (Tony usa REST Gemini, non Vertex).

**Secrets (Firebase Secret Manager via `defineSecret`):**

`GEMINI_API_KEY`, `OPENWEATHER_API_KEY`, `RESEND_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SENTRY_DSN`

Template locale: `functions/.secret.local.example` (non committare `.secret.local`)

---

## 4. Mappatura Funzionale (Features Attuali)

### 4.1 Core Platform (sempre incluso nel piano Free/Base)

#### Autenticazione e Onboarding

- **Flusso:** registrazione crea tenant (`tenants/{tenantId}` con `piano: 'free'`) + utente amministratore
- **File:** `core/services/auth-service.js`, `core/services/tenant-service.js`, `core/auth/*.html`
- **Inviti utenti:** `core/services/invito-service-standalone.js`, `core/admin/gestisci-utenti-standalone.html`, CF `sendTransactionalEmail`
- **Selezione tenant:** `core/services/tenant-selection-service.js` (modal se multi-tenant)

#### Dashboard Manager

- **Pagina:** `core/dashboard-standalone.html`
- **Flusso:** hub moduli, KPI snapshot, scadenze affitti, briefing meteo, barra "I miei accessi" (5 slot), sezione "Per te oggi"
- **File:** `core/js/dashboard-controller.js`, `dashboard-data.js`, `dashboard-counts-snapshot.js`, `dashboard-meteo-briefing.js`, `dashboard-hub.js`, `dashboard-quick-bar.js`
- **Performance:** prefetch login (`dashboard-login-prefetch.js`), conteggi defer (`dashboard-perf.js`)

#### Gestione Terreni

- **Pagina:** `core/terreni-standalone.html`
- **Flusso:** CRUD terreni aziendali con poligono Google Maps, podere, coltura, affitto, morfologia; link moduli Vigneto/Frutteto; Tony `currentTableData` pageType `terreni`, `FILTER_TABLE`, form `terreno-form`
- **File:** `core/models/Terreno.js`, servizi terreni in `core/services/`
- **Limiti Free:** max 5 terreni (`SUBSCRIPTION_PLANS.free.maxTerreni`)

#### Diario Attività

- **Pagina:** `core/attivita-standalone.html`
- **Flusso:** registrazione attività giornaliere (tipo lavoro, terreno, ore, note); gerarchia categoria → sottocategoria → tipo; integrazione macchine se modulo attivo; Tony `attivita-form`
- **File:** `core/models/Attivita.js`, `Attivita` collection `attivita`
- **Limiti Free:** max 30 attività/mese

#### Mappa Aziendale

- **Pagina:** `core/mappa-aziendale-standalone.html`
- **Flusso:** visualizzazione poligoni terreni su mappa aggregata

#### Statistiche Core

- **Pagina:** `core/statistiche-standalone.html`
- **Flusso:** statistiche base terreni/attività (piano Free)

#### Amministrazione

| Pagina | Funzione |
|--------|----------|
| `core/admin/impostazioni-standalone.html` | Impostazioni azienda, upload logo Storage, sede meteo |
| `core/admin/gestisci-utenti-standalone.html` | CRUD utenti, inviti, ruoli |
| `core/admin/abbonamento-standalone.html` | Piano, moduli, bundle Stripe, prove 30gg, disattivazione/riattivazione |
| `core/admin/amministrazione-standalone.html` | Hub amministrazione |

#### Configurazione Anagrafiche

- Liste personalizzate: colture, categorie, tipi lavoro (`core/models/Coltura.js`, `Categoria.js`, `TipoLavoro.js`)
- Collezioni Firestore: `colture`, `categorie`, `tipiLavoro`, `poderi`, `liste`

---

### 4.2 Modulo Manodopera (`manodopera` — €6/mese)

**Hub:** `modules/manodopera/views/manodopera-home-standalone.html` (KPI + card navigazione, 2026-06-13)

| Feature | Pagine / File | Flusso |
|---------|---------------|--------|
| **Gestione Lavori** | `core/admin/gestione-lavori-standalone.html`, `core/models/Lavoro.js` | CRUD lavori con assegnazione caposquadra XOR operaio; stati `assegnato/in_corso/completato`; zone lavorate su mappa; subcollezioni `oreOperai`, `zoneLavorate`; integrazione CT/VM/Vigneto |
| **Squadre** | `core/admin/gestione-squadre-standalone.html`, `core/models/Squadra.js` | Composizione squadre, caposquadra, membri |
| **Operai** | `core/admin/gestione-operai-standalone.html` | Anagrafica operai, contratti, scadenze, profili `profiliManodopera` |
| **Validazione ore** | `core/admin/validazione-ore-standalone.html` | Workflow operaio → caposquadra → manager; scope in `manodopera-ore-validazione-scope.js` |
| **Compensi** | `core/admin/compensi-operai-standalone.html` | Calcolo compensi, export Excel |
| **Statistiche manodopera** | `core/admin/statistiche-manodopera-standalone.html` | KPI ore, costi |
| **Segna ore (manager)** | `core/segnatura-ore-standalone.html` | Segnatura ore su lavori; Tony `ora-form`, `FILTER_TABLE segnatura_ore` |
| **Lavori caposquadra** | `core/admin/lavori-caposquadra-standalone.html` | Vista campo per caposquadra |
| **Field Workspace mobile** | `core/mobile/field-workspace-standalone.html` | UI slide per operaio/caposquadra: lavori, segna ore inline, valida ore (capo), comunicazioni squadra |
| **Tony** | `tony-form-mapping.js` → `lavoro-form`, `ora-form`, `field-workspace-ore-form` | Intervista lavoro 0 CF, disambiguazione macchine, save locale, E2E T-FLOW-013/021 |

---

### 4.3 Modulo Parco Macchine (`parcoMacchine` — €3/mese)

**UI:** `modules/macchine/views/` + form `core/admin/gestione-macchine-standalone.html`  
**Logica:** `modules/parco-macchine/models/Macchina.js`, `services/macchine-service.js`

| Feature | Pagina | Dettaglio |
|---------|--------|-----------|
| Dashboard macchine | `macchine-dashboard-standalone.html` | KPI flotta, guasti, scadenze |
| Trattori | `trattori-list-standalone.html` | Anagrafica trattori, CV, ore |
| Attrezzi | `attrezzi-list-standalone.html` | Attrezzi con compatibilità CV |
| Flotta veicoli | `flotta-list-standalone.html` | Veicoli stradali, km |
| Scadenze | `scadenze-list-standalone.html` | Revisioni, assicurazioni, manutenzioni programmate |
| Guasti | `guasti-list-standalone.html`, `core/admin/segnalazione-guasti-standalone.html` | Workflow guasto aperto/chiuso; collezione `guasti` |
| Utilizzo macchine | `macchine-utilizzo-service.js` | Tracciamento uso da Diario/Lavori |
| Tony | Context `guastiAperti`, `summaryScadenze`; `currentTableData` per tutte le liste | Form `macchina-form` e `segnala-guasto-form` **non ancora mappati** |

---

### 4.4 Modulo Conto Terzi (`contoTerzi` — €6/mese)

**Hub:** `modules/conto-terzi/views/conto-terzi-home-standalone.html`

| Feature | Pagina / Service | Flusso |
|---------|------------------|--------|
| Clienti | `clienti-standalone.html`, `Cliente.js` | CRUD clienti CT |
| Terreni clienti | `terreni-clienti-standalone.html` | Terreni con `clienteId`, campi VM (tipoPalo, sestoImpianto) |
| Mappa clienti | `mappa-clienti-standalone.html` | Visualizzazione geografica |
| Preventivi | `preventivi-standalone.html`, `Preventivo.js` | Lifecycle: bozza → inviato → accettato → pianificato → lavoro |
| Nuovo preventivo | `nuovo-preventivo-standalone.html` | Form con tariffe, calcolo totale, Tony `preventivo-form` |
| Tariffe | `tariffe-standalone.html`, `Tariffa.js` | Tariffe per tipo lavoro × coltura × morfologia |
| Accettazione pubblica | `accetta-preventivo-standalone.html` | Link pubblico; CF `getPreventivoPubblico`, `aggiornaStatoPreventivoPubblico` |
| Email preventivi | `preventivi-service.js` + Resend/EmailJS | Invio preventivo al cliente |
| Tony | `FILTER_TABLE` preventivi/tariffe/clienti/terreniClienti; `PREVENTIVO_LIST_ACTION` | E2E T-FLOW-014 |

---

### 4.5 Modulo Vendemmia Meccanica (`vendemmiaMeccanica` — €2/mese, richiede CT)

| Feature | Pagina | Dettaglio |
|---------|--------|-----------|
| Hub VM | `vm-home-standalone.html` | Accesso sotto-moduli |
| Piano stagione | `piano-stagione-standalone.html` | Stato inPiano/vendemmiato per cliente/terreno/anno; sync bidirezionale con lavori/preventivi |
| Calcolatore compenso | `calcolatore-standalone.html` | `calcolo-compenso-vm-service.js` |
| Calcoli salvati | `calcoli-salvati-standalone.html` | Collezione `calcoli-vendemmia-meccanica` |
| Tariffe VM | `tariffe-vm-standalone.html` | `tariffe-vendemmia-meccanica` |
| Bilancio VM | `bilancio-vm-standalone.html` | Spese `spese-vendemmia-meccanica` |
| Zone escluse mappa | `vm-zone-mappa.js` | Poligoni zone vendemmia |
| Tony | `FILTER_TABLE piano-stagione-vm`, `pianoAggregates.ettariResidui` | Parziale su liste residue |

---

### 4.6 Modulo Vigneto (`vigneto` — €3/mese) — ~85-90% completo

| Feature | Pagina / Model | Dettaglio |
|---------|----------------|-----------|
| Dashboard | `vigneto-dashboard-standalone.html` | KPI vigneto |
| Anagrafica vigneti | `vigneti-standalone.html`, `Vigneto.js` | Varietà, portinnesti, forma allevamento, densità auto |
| Vendemmia | `vendemmia-standalone.html`, `Vendemmia.js` | Tracciamento poligoni, quintali, compensi; sync da lavori |
| Potatura | `potatura-standalone.html`, `PotaturaVigneto.js` | Registro potature |
| Trattamenti | `trattamenti-standalone.html`, `TrattamentoVigneto.js` | Fitosanitari; scarico magazzino automatico |
| Concimazioni | `concimazioni-standalone.html` | Da lavori + campi editabili; Tony `form-trattamento` |
| Pianifica impianto | `pianifica-impianto-standalone.html`, `PianificazioneImpianto.js` | Griglia carraie, 17 forme allevamento |
| Calcolo materiali | `calcolo-materiali-standalone.html` | Materiali per impianto |
| Statistiche | `vigneto-statistiche-standalone.html` | 9 grafici Chart.js; aggregazione costi da lavori |
| Tony | `concimazioni_vigneto`, vendemmia aggregates, trattamenti | E2E concimazione/diario |

**Gap:** diradamento, alert notifiche, tariffa per quintale, evoluzione potatura/trattamenti "da lavori"

---

### 4.7 Modulo Frutteto (`frutteto` — €3/mese) — ~55-60% completo

| Feature | Pagina / Model | Dettaglio |
|---------|----------------|-----------|
| Dashboard | `frutteto-dashboard-standalone.html` | KPI frutteto |
| Anagrafica | `frutteti-standalone.html`, `Frutteto.js` | Estende `BaseColtura` |
| Raccolta | `raccolta-frutta-standalone.html`, `RaccoltaFrutta.js` | Poligoni, resa, sync lavori |
| Potatura / Trattamenti / Concimazioni | Pagine dedicate | Pattern allineato a Vigneto |
| Statistiche | `frutteto-statistiche-standalone.html` | Aggregati costi |
| Pianifica impianto | Condiviso da Vigneto `?coltura=frutteto` | Riuso componenti |
| Tony | `concimazioni_frutteto`, trattamenti | Buona copertura |

**Gap:** diradamento, export avanzato, compensi per kg, feature avanzate

---

### 4.8 Modulo Magazzino (`magazzino` — €3/mese)

| Feature | Pagina / Model | Flusso |
|---------|----------------|--------|
| Hub | `magazzino-home-standalone.html` | Accesso sotto-sezioni |
| Prodotti | `prodotti-standalone.html`, `Prodotto.js` | Categorie: fitofarmaci, fertilizzanti, ricambi, sementi; giacenza, scorta minima, giorni carenza, dosaggio |
| Movimenti | `movimenti-standalone.html`, `MovimentoMagazzino.js` | Entrate/uscite; prezzo da catalogo su entrata |
| Tracciabilità | `tracciabilita-consumi-standalone.html` | Catena consumi per terreno/prodotto |
| Scarico automatico | `trattamento-scarico-magazzino-service.js` | Da trattamenti Vigneto/Frutteto |
| Tony | `prodotto-form`, `movimento-form`, save locale 0 CF, `FILTER_TABLE` | E2E T-FLOW-015/017/018/019; Context `movimentiRecenti` |

**Roadmap (non implementato):** OCR/Gemini per DDT/fatture (`docs-sviluppo/da-fare/magazzino/ROADMAP_ACQUISIZIONE_DOCUMENTI_GEMINI.md`)

---

### 4.9 Modulo Report (`report` — €5/mese) — MVP ~40-50%

| Feature | Pagina | Stato |
|---------|--------|-------|
| Hub report | `report-dashboard-standalone.html` | Card per area, gated da moduli attivi |
| Report Vigneto | `report-standalone.html` | Export Excel 3 fogli (produzione, costi, lavori) via `vigneto-adapter.js` |
| Report Terreni | `report-terreni-standalone.html` | Dati reali: trattamenti kg, vendemmia qli, ore attività |
| Adapter Frutteto/CT/Core | — | **Placeholder, non implementati** |

---

### 4.10 Modulo Meteo (`meteo` — €1/mese) — Completo

| Feature | File | Dettaglio |
|---------|------|-----------|
| Dashboard meteo | `meteo-dashboard-standalone.html`, `meteo-dashboard-controller.js` | Mappa terreni + previsioni per campo |
| CF meteo | `getMeteoSede`, `getMeteoSedeAvanzato`, `getMeteoTerreni` | OpenWeather + cache `meteoCache` |
| MeteoAlarm | Integrato in servizio | Alert meteo italiani |
| Tony meteo operativo | `meteo-service.js`, quick reply | Praticabilità terreno, date trattamento, doppia alternativa; 47+ test |
| Dashboard briefing | `dashboard-meteo-briefing.js` | Meteo base anche senza modulo; avanzato con modulo |

---

### 4.11 Tony — Assistente IA (`tony` — €5/mese)

**Architettura a tre anime (+ due future):**

1. **Operativo:** compila form, segna ore, crea lavori (priorità operai/capisquadra)
2. **Analista:** Q&A cross-modulo su costi, scorte, scadenze, preventivi
3. **Navigatore:** `APRI_PAGINA`, `FILTER_TABLE`, `OPEN_MODAL`, `RIASSUNTO`
4. **Proattività (parziale):** briefing dashboard, meteo, consigli moduli
5. **Memoria storica (pianificata):** confronti anno su anno

**Modalità per piano:**

| Piano | Comportamento Tony |
|-------|-------------------|
| Free | Assente (loader non carica script; CF rifiuta) |
| Base senza modulo tony | Tony Guida: solo spiegazioni + consigli moduli (`SYSTEM_INSTRUCTION_BASE`) |
| Base + modulo tony | Tony Operativo: comandi completi (`SYSTEM_INSTRUCTION_ADVANCED`) |
| Operaio/caposquadra | Profilo campo ristretto (`SYSTEM_INSTRUCTION_TONY_FIELD`) |

**Pipeline Cloud Function `handleTonyAskRequest`:**

1. Auth + gate piano/ruolo
2. Intent router (`tony-intent-router.js`) → tier T0–T4
3. Early exit: parser terreno, rifiuto profilo campo per query business
4. `buildContextAziendaTier` (cache `tony-context-cache.js`)
5. Quick reply deterministici (nav, filter, multi-blocco, preventivo list) — ~31% richieste senza Gemini in produzione
6. Gemini 2.5 Flash → JSON `{ text, command }`
7. Sanitizzazione comandi + module gate

**10 form mappati in `TONY_FORM_MAPPING`:**

`attivita-form`, `lavoro-form`, `preventivo-form`, `prodotto-form`, `movimento-form`, `form-trattamento`, `terreno-form`, `zona-form`, `ora-form`, `field-workspace-ore-form`

**Comandi implementati:** `APRI_PAGINA`, `OPEN_MODAL`, `SET_FIELD`, `INJECT_FORM_DATA`, `SAVE_ACTIVITY`, `CLICK_BUTTON`, `FILTER_TABLE`, `SUM_COLUMN`, `PREVENTIVO_LIST_ACTION`, `RIASSUNTO`, `QUICK_SAVE`/`SET_VALUE`

**Comando non implementato:** `MOSTRA_GRAFICO`

**Voce:** TTS Google Chirp 3 HD; STT Web Speech API; modalità continua multi-turn (build `2026-06-20r`)

**File principali:** `core/js/tony/main.js` (~9000 righe), `core/services/tony-service.js`, `functions/index.js`, `core/config/tony-form-mapping.js`, `core/js/tony-form-injector.js`

---

### 4.12 Simulator e Test Infrastructure

| Componente | Scopo |
|-----------|-------|
| `simulator/` | Seed tenant emulator, orchestrator, CI runner |
| `tests/e2e/` | Playwright E2E sim + Tony (tier 2 mock, tier 3 live) |
| `tests/*.test.js` | Vitest unit (Tony parser, Stripe, meteo, module gate) |
| CI `simulator-ci.yml` | Push/PR + cron notturno; Node 22; job Tony live solo scheduled |

**Stato E2E Tony (2026-07-08):** tier 2 mock 16/16; tier 3 live 4/4 + gate p95

---

## 5. Struttura dei Dati e Modelli (Data Model)

### Schema logico multi-tenant

```
users/{userId}
  ├── email, nome, cognome, stato
  ├── tenantId (legacy)
  └── tenantMemberships: {
        [tenantId]: { ruoli: [], stato: 'attivo', tenantIdPredefinito? }
      }

tenants/{tenantId}
  ├── nome, piano ('free'|'base'), modules[], activeBundles[]
  ├── moduleTrials.{moduleId}: { status, endsAt }
  ├── stripeCustomerId, stripeSubscriptionId, stripeAddons
  ├── sede (coordinate meteo), logoUrl
  │
  ├── terreni/{id}          → Terreno (poligono, coltura, affitto, clienteId?)
  ├── poderi/{id}
  ├── colture/{id}          → Coltura
  ├── categorie/{id}        → Categoria
  ├── tipiLavoro/{id}       → TipoLavoro
  ├── attivita/{id}         → Attivita
  │
  ├── lavori/{id}           → Lavoro
  │     ├── oreOperai/{id}    → ore, validazione, operaioId
  │     └── zoneLavorate/{id} → poligono, superficie
  │
  ├── squadre/{id}          → Squadra
  ├── profiliManodopera/{id}
  ├── assenzeOperai/{id}
  │
  ├── macchine/{id}         → Macchina
  │     └── manutenzioni/{id}
  ├── guasti/{id}
  │
  ├── clienti/{id}          → Cliente (CT)
  ├── poderi-clienti/{id}   → PodereCliente
  ├── preventivi/{id}       → Preventivo
  ├── tariffe/{id}          → Tariffa
  │
  ├── prodotti/{id}         → Prodotto
  ├── movimentiMagazzino/{id} → MovimentoMagazzino
  │
  ├── vigneti/{id}          → Vigneto
  │     ├── vendemmie/{id}
  │     ├── potature/{id}
  │     └── trattamenti/{id}
  ├── statistiche_vigneto/{id}
  ├── pianificazioni-impianti/{id}
  │
  ├── frutteti/{id}         → Frutteto
  │     ├── raccolte/{id}
  │     ├── potature/{id}
  │     └── trattamenti/{id}
  ├── raccolteFrutta/{id}
  ├── statistiche_frutteto/{id}
  │
  ├── calcoli-vendemmia-meccanica/{id}
  ├── spese-vendemmia-meccanica/{id}
  │
  ├── meteoCache/{doc}      (solo Admin SDK)
  └── tonyContextCache/{doc} (solo Admin SDK)

inviti/{invitoId}           → token, tenantId, email, ruoli, stato
```

### Relazioni chiave

| Entità A | Relazione | Entità B | Note |
|----------|-----------|----------|------|
| Terreno | N:1 | Cliente | Se `clienteId` presente → terreno CT |
| Lavoro | N:1 | Terreno | Obbligatorio |
| Lavoro | N:1 | Caposquadra XOR Operaio | Assegnazione mutuamente esclusiva |
| Lavoro | N:1 | Preventivo | Se creato da preventivo accettato |
| Lavoro | N:1 | Cliente | Lavoro conto terzi |
| Preventivo | N:1 | Cliente, Terreno | Tariffa derivata da `tariffe` |
| Vigneto/Frutteto | 1:1 | Terreno | Estensione coltura specializzata |
| Vendemmia/Raccolta | N:1 | Vigneto/Frutteto | Con poligono raccolta |
| MovimentoMagazzino | N:1 | Prodotto | Aggiorna giacenza |
| Trattamento Vigneto/Frutteto | N:1 | Prodotto | Scarico automatico magazzino |
| Macchina | N:N | Lavoro/Attivita | Trattore + attrezzi compatibili per CV |
| OreOperai | N:1 | Lavoro, Operaio | Validazione gerarchica |

### Modelli JS (classi export)

**Core (`core/models/`):** `Base`, `User`, `Terreno`, `Attivita`, `Lavoro`, `Squadra`, `Coltura`, `Categoria`, `TipoLavoro`, `CategoriaLavoro`, `ListePersonalizzate`

**Moduli:**
- CT: `Cliente`, `Preventivo`, `Tariffa`, `PodereCliente`
- Magazzino: `Prodotto`, `MovimentoMagazzino`
- Parco: `Macchina`, `CategoriaAttrezzo`
- Vigneto: `Vigneto`, `Vendemmia`, `PotaturaVigneto`, `TrattamentoVigneto`, `PianificazioneImpianto`
- Frutteto: `Frutteto`, `RaccoltaFrutta`, `PotaturaFrutteto`, `TrattamentoFrutteto`

---

## 6. Stato dello Sviluppo e Debito Tecnico

### Cosa è completato al 100%

| Area | Evidenza |
|------|----------|
| **Autenticazione Firebase** | Login, registrazione, inviti, multi-tenant |
| **Core terreni + attività + dashboard** | Operativo con limiti Free |
| **Manodopera** | Lavori, squadre, operai, validazione ore, compensi, field workspace |
| **Parco Macchine** | Flotta completa, guasti, scadenze, manutenzioni |
| **Conto Terzi** | Clienti, preventivi, tariffe, accettazione pubblica, email |
| **Meteo** | Dashboard + Tony operativo + briefing |
| **Stripe billing** | Checkout, webhook, addon cancel/reactivate, trial 30gg |
| **Tony Fase 2 (nav cross-page)** | APRI_PAGINA da qualsiasi pagina, pending intent |
| **Tony performance Fase 0-4** | Cache tier, quick reply, invalidazione trigger |
| **Tony E2E CI** | Tier 2 16/16; tier 3 live 4/4 (2026-07-08) |
| **Piano Stagione VM** | Chiuso operativamente (2026-07-06) |

### Cosa è in fase di sviluppo / WIP

| Area | Stato | Dettaglio |
|------|-------|-----------|
| **Tony Fase 1** | Parziale | Entity parser terreno ✅; canary E2E browser da consolidare |
| **Tony Fase 3 Context Builder** | In corso | `movimentiRecenti`, `summarySottoScorta` ✅; estensioni continue |
| **Tony Fase 4 iniezione** | In corso | 10 form mappati; mancano `macchina-form`, `segnala-guasto-form` |
| **Tony Fase 5 grafici** | Parziale | `MOSTRA_GRAFICO` non implementato |
| **Tony Fase 6 proattività** | Parziale | Briefing/meteo ✅; "Ho notato X cross-modulo" e memoria storica aperti |
| **Vigneto** | ~85-90% | Diradamento, alert, evoluzioni potatura/trattamenti |
| **Frutteto** | ~55-60% | Feature avanzate, export |
| **Report** | MVP ~45% | Solo Vigneto Excel + Terreni reali |
| **Vendemmia Meccanica** | MVP+ | Tony su liste residue |
| **Hub Manodopera Fase 2** | Opzionale | Quick bar su home hub, tour |
| **Oliveto** | 0% | In catalogo come "Prossimamente", nessuna cartella modulo |
| **Deploy produzione ERP** | WIP | Hosting Firebase serve solo landing; ERP su localhost/http-server |
| **App mobile nativa** | Non iniziata | README roadmap menziona Flutter — non presente in codebase |

### Debito Tecnico e Limitazioni Attuali

| Voce | Impatto | Dettaglio tecnico |
|------|---------|-------------------|
| **README obsoleto** | Basso | Prezzi moduli e roadmap non aggiornati vs `subscription-plans.js` |
| **Legacy tenant model** | Medio | Coesistenza `tenantId`/`ruoli` e `tenantMemberships`; rules e storage.rules non allineati ovunque |
| **storage.rules** | Medio | Controllo tenant usa solo legacy `users.tenantId`, non `tenantMemberships` |
| **Pagine standalone senza bundler** | Medio | 73 HTML separati; rischio drift CSS/JS; nessun tree-shaking |
| **Tony nav binario B gap** | Medio | ~3 frasi navigazione ancora su Gemini; gap `manodopera`, `oliveto` in `NAV_TARGET_RULES` |
| **Deploy CF terreno parser** | Medio | Parser server-side merge locale 2026-06-14 — verificare deploy allineato |
| **Metriche client 0-CF** | Basso | `tony_local_intercept` non tracciato sistematicamente |
| **Auth ibrido E2E prod** | Alto per CI | `sim:tony:e2e:live:prod` fallisce con "sessione scaduta" |
| **Sezioni storiche Tony** | Basso | Formato evento `table-data-ready` legacy accettato in alcune pagine mature |
| **OCR magazzino** | N/A (roadmap) | Documentato ma esplicitamente non implementato per policy Master Plan |
| **Obiettivi performance formali** | Aperto | −40% latenza / p50 < 1,5s non ancora raggiunti formalmente |
| **MOSTRA_GRAFICO** | Funzionale | Comando Tony pianificato Fase 5, assente |
| **README.md versione** | Cosmetico | Indica `1.0.0-alpha` e checklist roadmap non spuntata nonostante feature implementate |

---

## 7. Struttura del Progetto (Albero delle Cartelle commentato)

```
gfv-platform/
├── .cursor/                    # Regole agenti Cursor (Tony, guida, project guardian)
├── .githooks/                  # Hook Git (pre-commit)
├── .github/workflows/          # CI: simulator-ci.yml, guida-impact-pr.yml
│
├── core/                       # ERP core — sempre presente, indipendente dai moduli pay-per-use
│   ├── admin/                  # Pagine admin: lavori, operai, squadre, utenti, abbonamento, guasti
│   ├── auth/                   # Login, registrazione, reset password, invito
│   ├── config/                 # firebase-config, stripe-config, subscription-plans, tony-form-mapping, tony-routes
│   ├── dev/                    # Strumenti sviluppo (simulator dev page)
│   ├── GUIDA/                  # Mirror guide utente in-app
│   ├── guida-app/              # Contenuti guida markdown
│   ├── images/                 # Asset immagini core
│   ├── js/                     # Controller dashboard, Tony widget, form injector, engine, voice
│   │   └── tony/               # Submodule Tony: main.js, ui.js, voice.js, engine.js, field-role-guard
│   ├── mobile/                 # Pagine mobile: field-workspace, statistiche-lavoratore
│   ├── models/                 # Modelli dati core (Terreno, Lavoro, Attivita, User, Squadra…)
│   ├── services/               # firebase-service, auth-service, tenant-service, tony-service, lavori-service
│   ├── styles/                 # CSS centralizzato: dashboard, responsive, tour, tony-widget
│   └── utils/                  # module-access-resolver, helper condivisi
│
├── modules/                    # Moduli business pay-per-use (10 cartelle)
│   ├── conto-terzi/            # Clienti, preventivi, tariffe CT — models, services, views
│   ├── frutteto/               # Gestione frutteti — ~60% feature complete
│   ├── macchine/               # UI liste macchine (trattori, attrezzi, guasti, scadenze)
│   ├── magazzino/              # Prodotti, movimenti, tracciabilità consumi
│   ├── manodopera/             # Hub modulo (pagine effettive in core/admin)
│   ├── meteo/                  # Dashboard meteo con mappa terreni
│   ├── parco-macchine/         # Models e services macchine (logica, no views)
│   ├── report/                 # Dashboard report, adapter Vigneto, export Excel
│   ├── vendemmia-meccanica/    # Piano stagione VM, calcolatore, bilancio CT
│   └── vigneto/                # Vigneti, vendemmia, trattamenti, statistiche — ~90%
│
├── functions/                  # Firebase Cloud Functions (Node 20, europe-west1)
│   ├── index.js                # Hub: tonyAsk, meteo, Stripe, email, cache invalidation
│   ├── tony-*.js               # Intent router, context cache, quick replies, parsers
│   ├── meteo-service.js        # OpenWeather integration
│   ├── stripe-billing.js       # Checkout e sync subscription
│   ├── stripe-webhooks.js      # Webhook handler
│   ├── email-resend.js         # Resend transactional email
│   ├── instrument.js           # Sentry init (primo import)
│   └── config/                 # stripe-prices.json, tony-module-recommendations.json, bundles
│
├── landing/                    # Sito marketing Vue 3 + Vite (Firebase Hosting target)
│   ├── src/                    # main.ts, router, componenti coming-soon
│   └── dist/                   # Build output deployata su Hosting
│
├── shared/                     # Utility e componenti cross-modulo
├── simulator/                  # Farm simulator: seed tenant, orchestrator, CI, emulator config
├── scripts/                    # Deploy, sync secrets, Tony canaries, guida-impact, E2E runners
├── tests/                      # Vitest unit + Playwright E2E (sim/, e2e/tony/)
├── docs-sviluppo/              # Documentazione sviluppo (Master Plan Tony, CONTEXT_BUILDER, guide)
├── documentazione-utente/      # Guide HTML utente finale
├── icons/                      # Icone PWA
│
├── firebase.json               # Config Firebase: firestore, storage, functions, hosting, emulators
├── .firebaserc                 # Progetto default: gfv-platform
├── firestore.rules             # Security rules multi-tenant con ruoli
├── firestore.indexes.json      # Indici compositi Firestore
├── storage.rules               # Regole Storage (logo tenant)
├── manifest.json               # PWA manifest (start_url → dashboard)
├── package.json                # Root: http-server, vitest, playwright, firebase-tools
├── vitest.config.js            # Config test unitari
├── playwright.config.js        # Config E2E
├── index.html                  # Placeholder "coming soon" root
└── README.md                   # Panoramica progetto (parzialmente obsoleto)
```

### Conteggi rilevanti

| Metrica | Valore |
|---------|--------|
| Pagine standalone HTML | **73** |
| Moduli business (`modules/`) | **10** cartelle |
| Form Tony mappati | **10** (+ 26 alias in `TONY_FORM_MAPPING`) |
| Cloud Functions esportate | **22** |
| Collezioni Firestore tenant | **~35** (+ subcollezioni) |
| Modelli JS `export class` | **~25** |
| Test Vitest (file `tests/*.test.js`) | **50+** |
| Scenari E2E Tony tier 2 | **16** |

---

## Appendice — Riferimenti critici per onboarding IA

### File da leggere obbligatoriamente prima di modificare Tony

1. `docs-sviluppo/tony/README.md`
2. `docs-sviluppo/tony/MASTER_PLAN.md`
3. `docs-sviluppo/tony/STATO_ATTUALE.md`
4. `docs-sviluppo/CONTEXT_BUILDER_SPECIFICHE_SVILUPPO.md`

### Canone nuove pagine (liste + form Tony)

- Placeholder `window.currentTableData` con `pageType` univoco
- Merge `setContext('page', …)` — mai sostituzione totale
- Evento `table-data-ready` con `detail.currentTableData`
- Nuovo form → voce in `tony-form-mapping.js`, non `if` nel core

### Comandi npm principali

```bash
npm start                    # ERP su http://localhost:8000
npm test                     # Vitest watch
npm run test:run             # Vitest CI
npm run sim:emulators:live   # Emulatori Auth+Firestore+Functions
npm run sim:tony:e2e         # Tony E2E tier 2 (mock)
npm run sim:tony:e2e:live    # Tony E2E tier 3 (emulator + Gemini)
npm run deploy:functions     # Deploy Cloud Functions
npm run deploy:landing       # Build + deploy landing Vue
npm run tony:canary          # Connectivity canary Tony
```

### Variabili ambiente critiche (Functions)

`GEMINI_API_KEY`, `OPENWEATHER_API_KEY`, `RESEND_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SENTRY_DSN`, `GEMINI_MODEL`, `STRIPE_ENV`, `TONY_TTS_VOICE`, `TONY_TTS_SPEAKING_RATE`

### Config client (non env, file JS gitignored)

`core/config/firebase-config.js`, `core/config/google-maps-config.js`, `core/config/stripe-config.js`

---

*Documento generato dall'analisi del codice sorgente e della documentazione in `docs-sviluppo/` al 2026-07-10. Per aggiornamenti sullo stato Tony, consultare sempre `docs-sviluppo/tony/STATO_ATTUALE.md` come fonte di verità post-modifica.*
