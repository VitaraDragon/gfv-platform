# GFV Farm Simulator

Generatore locale di aziende agricole di test su **Firebase Emulator** (Auth + Firestore).

Guida completa: [`docs-sviluppo/simulator/GFV_FARM_SIMULATOR.md`](../docs-sviluppo/simulator/GFV_FARM_SIMULATOR.md)

**v2 manodopera:** spec §14 — multi-account, `runAsPersona`, template `viticola-manodopera` ✅  
**v2.2 conto terzi:** template `viticola-conto-terzi` / `viticola-conto-terzi-manodopera` ✅ — guida §15 in `GFV_FARM_SIMULATOR.md`  
**v3 cascata:** semafori affitti/macchine + Vitest + smoke Node ✅ — guida §11.1  
**v4 Playwright:** scenari 1–3 dashboard + scadenze-list + terreni affitti ✅ — guida §11.2

## Prerequisiti

- Node.js 18+
- **Java (JRE/JDK)** su PATH — richiesto dal Firestore Emulator (`java -version` deve funzionare)
- `npm install` dalla root del repo

## Avvio rapido (CLI)

**Terminale 1** — emulator (lasciare aperto):

```bash
npm run sim:emulators
```

**Terminale 2** — simulatore:

```bash
# Smoke test infrastruttura (Fase 0)
npm run sim:smoke

# Run completo v1 — una azienda (setup + populate + attività + magazzino)
npm run sim:run

# Conto Terzi (solo viticola + clienti/tariffe/preventivi)
npm run sim:run -- --template=viticola-conto-terzi --verbose

# Stack completo: conto terzi + manodopera + diario/magazzino/vigneto
npm run sim:run -- --template=viticola-conto-terzi-manodopera --verbose

# Run batch — N aziende in sequenza (default 10)
npm run sim:run:batch
npm run sim:run:batch -- --count=5
npm run sim:run:batch -- --count=10 --verbose

# Demo regime max — 2 aziende (manodopera 2 capi/10 op + solo titolare), 30 giorni
npm run sim:run:demo-max

# Solo creazione tenant/utente
npm run sim:setup

# Log dettagliati (singolo run)
npm run sim:run:verbose

# Aggiorna aziende già nel manifest (prodotti, flotta/scadenze, affitti terreni, movimenti mancanti, spese vigneto, date)
npm run sim:backfill

# Smoke v3 — cascata + semafori dashboard su emulator (ultimo tenant manifest)
node scripts/cascade-v3-live-smoke.js

# Verifica spese vigneto vs aggregaSpese app
npm run sim:verify-spese -- --tenant=sim_cascina_colombo_671742

# Ispeziona terreni ultima azienda in manifest
npm run sim:inspect

# Ispeziona tenant specifico
npm run sim:inspect -- sim_cascina_colombo_671742

# Audit integrità manifest vs emulator (tutte le entry)
npm run sim:audit

# Aggiorna terreni vecchi (manifest senza seedVersion 2)
npm run sim:migrate-terreni

# Pulizia tenant simulati
npm run sim:cleanup              # rimuove tutte le entry del manifest
npm run sim:cleanup -- --keep 10 # mantiene le ultime 10 aziende
npm run sim:cleanup -- --dry-run

# Test integrazione (emulator attivo)
npm run sim:test
npm run sim:test:vitest

# Come in CI — avvia emulator, esegue entrambi i test, termina
npm run sim:test:ci

# Ricalcola date attività (e movimenti collegati) fino a oggi
npm run sim:refresh-dates
npm run sim:refresh-dates -- --all
npm run sim:refresh-dates -- sim_azienda_vitivinicola_gallo_745575
```

## Verifica UI in browser

**Terminale 3** — server statico (lasciare aperto):

```bash
npm start
```

Pagina dev aziende simulate:

**http://127.0.0.1:8000/core/dev/simulator-dev-standalone.html?emulator=1**

- Password: **`SimGFV2026!`**
- **Entra (dashboard)** — auto-login emulator (non redirect al login)
- Link rapidi: **Terreni**, **Attività**, **Movimenti**, **Macchine**, **Trattori**, **Flotta**, **Scadenze**, **Vigneto**, **Vigneti**, **Trattamenti**, **Potatura**
- **Conto Terzi** (dopo **Entra** su azienda template `viticola-conto-terzi*`): clienti / tariffe / preventivi — path sotto `modules/conto-terzi/views/*-standalone.html?emulator=1` (dettaglio in guida §13.2)
- **Manodopera mobile:** pulsanti Capo / Operaio sulla card azienda (template manodopera)
- Preferire aziende con badge **Seed completo** (`seedVersion: 2` nel manifest)
- Se vedi **Seed vecchio**: `npm run sim:migrate-terreni`, `npm run sim:backfill`, oppure `npm run sim:run`

## E2E Playwright (v4)

**Prerequisiti:** emulator + `npm start` + tenant **Seed completo** in manifest (`sim:run --template=solo-titolare-viticola` consigliato).

**Catena pre-E2E (riusa verifica v3):**

```bash
npm run sim:inspect
node scripts/cascade-v3-live-smoke.js
npm run sim:audit                    # legacy nel manifest → sim:cleanup --keep 1
npm run test:run -- tests/dashboard-deadlines.test.js tests/cascade-colture-lavori.test.js tests/cascade-attrezzi-cv.test.js
```

**E2E browser:**

```bash
npm run sim:e2e              # headless — runner Node + Chrome di sistema (consigliato in dev)
npm run sim:e2e:pw           # suite Playwright nativa (Node 22 / CI)
npm run sim:e2e:ui           # debug Playwright UI
npm run sim:e2e:install      # CI / sim:e2e:pw — scarica Chromium Playwright
```

**Scenario 1 (✅):** pagina dev → **Entra come manager** → dashboard widget **Scadenze amministrazione** (affitti con semaforo) + **In arrivo** (km/ore/manutenzioni).

**Scenario 2 (✅):** stesso login → `modules/macchine/views/scadenze-list-standalone.html?emulator=1` — tabella scadenze con semafori **black/red/yellow** e righe scadute visibili.

**Scenario 3 (✅):** stesso login → `core/terreni-standalone.html?emulator=1` — colonna **Possesso** con badge Affitto e semafori **grey/red/yellow/green**.

Assert su DOM visibile — dati seed già validati da v3.

**Node:** su Node 24 la CLI `playwright test` può restare bloccata; usare `npm run sim:e2e`. In CI (Node 22): `sim:e2e:install` + `sim:e2e:pw`.

**Esito attuale (2026-06-28):** `npm run sim:e2e` → **3/3** scenari OK (emulator + `npm start` + manifest non vuoto, preferire **Seed completo**).

| # | Scenario | Spec | URL target |
| - | -------- | ---- | ---------- |
| 1 | Dashboard scadenze | `dashboard-deadlines.spec.js` | dashboard dopo login dev |
| 2 | Parco scadenze | `scadenze-list.spec.js` | `modules/macchine/views/scadenze-list-standalone.html?emulator=1` |
| 3 | Terreni affitti | `terreni-affitti.spec.js` | `core/terreni-standalone.html?emulator=1` |

**File:** `scripts/sim-e2e-run.mjs`, `tests/e2e/sim/` — dettaglio assert e piano incrementi: **`GFV_FARM_SIMULATOR.md` §11.2**.

## Manifest e audit

- In git: `simulator/manifest.json` è **vuoto** (`[]`); dopo `sim:run` o batch si popola **solo in locale**.
- Struttura di esempio: `simulator/manifest.example.json`.
- Verifica coerenza: `npm run sim:audit` (richiede emulator + entry manifest). Su tenant **appena creati** con `sim:run`: attesi **8 macchine**, **4 affitti**, bucket semafori. Manifest con molte entry **legacy** pre-v3: fallimenti fino a `sim:backfill` o `sim:cleanup --keep N`.

## Routine periodica (refresh, audit, perf)

Guida completa: **`GFV_FARM_SIMULATOR.md` §13.4**.

| Comando | Scopo |
| ------- | ----- |
| `sim:refresh-dates` | Ricalcola date attività + movimenti collegati (dati «recenti» in app) |
| `sim:audit` | Controlli automatici seed vs emulator |
| Verifica UI Movimenti / field workspace | Coerenza manuale come pre-simulatore (movimento in app ↔ Firestore) |
| `?dashboardPerf=1` | Tempi caricamento dashboard ( **perf** = velocità, non audit dati) |

**Demo pulita consigliata:** `npm run sim:cleanup -- --keep 2` → `npm run sim:run:demo-max` → `sim:refresh-dates -- --all` → `sim:audit`.

## Credenziali emulator

Password fissa per tutti gli utenti simulati: **`SimGFV2026!`**

Email e tenant ID sono nel report a fine run e in `simulator/manifest.json` (locale, dopo run). Campo `seedVersion: 2` = terreni completi. Vedi `simulator/manifest.example.json` per la struttura.

## Cosa crea ogni azienda (template `solo-titolare-viticola`)

| Risorsa | Quantità |
|---------|----------|
| Terreni | 4 (tutti in **affitto** demo con scadenze semaforo) |
| Trattori + attrezzi | 1 + 3 |
| Flotta aziendale (furgone/pickup/automezzo) | 4 |
| **Macchine totali** | **8** |
| Vigneti | 4 |
| Prodotti magazzino | 5 |
| Attività (4 settimane) | 20 |
| Movimenti magazzino (uscite) | 12 |
| Potature vigneto (da attività Potatura) | 4 |
| Trattamenti vigneto (Trattamento/Concimazione/Controllo fitosanitario) | 12 |

Ogni macchina seed v1.6+ include scadenze demo (`prossimaManutenzione`, revisione/assicurazione su trattori/flotta, tagliando **km** su flotta, **ore** su trattori/attrezzi). Almeno un mezzo in `in_manutenzione`. **v3:** 4 terreni azienda in affitto con bucket grey/red/yellow/green (widget dashboard Scadenze).

Aziende create prima di v1.6 o pre-v3 affitti: `npm run sim:backfill` (affitti + `forceSemaforoProfiles` parco macchine).

**Smoke v3 (emulator + manifest non vuoto):**
```bash
node scripts/cascade-v3-live-smoke.js    # ultimo tenant manifest
node scripts/cascade-v3-live-smoke.js sim_tenant_id
```

## Seed terreni (v2)

Ogni nuova azienda include:

- Catalogo colture + categorie + podere (nome azienda)
- Terreni con `coltura: "Vite da Vino"`, `podere`, `tipoCampo`, `polygonCoords`

Le aziende create **prima** del seed v2 restano nell’emulator finché non si esegue `sim:migrate-terreni`, `sim:backfill` o un nuovo `sim:run`.

## CI (GitHub Actions)

Workflow **GFV Farm Simulator CI** (`.github/workflows/simulator-ci.yml`):

- **Trigger:** push su `main` e pull request che toccano `simulator/`, `tests/simulator/`, `firebase.json`, dipendenze root; anche **Run workflow** manuale.
- **Ambiente:** Ubuntu, Node 22, Java 21 (Firestore Emulator).
- **Comando:** `npm run sim:test:ci` → `firebase emulators:exec --only auth,firestore` + `sim:test` + `sim:test:vitest`.

In locale, stesso comando della CI (Java obbligatorio): `npm run sim:test:ci`.

## Sicurezza

Il simulatore **refusa di girare** senza `FIRESTORE_EMULATOR_HOST` e `FIREBASE_AUTH_EMULATOR_HOST` su host locale (`127.0.0.1` / `localhost`). Non puntare mai a produzione.

## Emulator UI

Dopo `sim:emulators`, apri la Firebase Emulator UI (di solito `http://127.0.0.1:4000`) per ispezionare Auth e Firestore.
