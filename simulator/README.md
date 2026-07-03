# GFV Farm Simulator

Generatore locale di aziende agricole di test su **Firebase Emulator** (Auth + Firestore).

Guida completa: [`docs-sviluppo/simulator/GFV_FARM_SIMULATOR.md`](../docs-sviluppo/simulator/GFV_FARM_SIMULATOR.md)

**v2 manodopera:** spec §14 — multi-account, `runAsPersona`, template `viticola-manodopera` ✅  
**v2.2 conto terzi:** template `viticola-conto-terzi` / `viticola-conto-terzi-manodopera` ✅ — guida §15 in `GFV_FARM_SIMULATOR.md`  
**v3 cascata:** semafori affitti/macchine + Vitest + smoke Node ✅ — guida §11.1  
**v4 Playwright:** scenari 1–19 ✅ — guida §11.2 (18 read)  
**v5 roadmap:** **70 spec** E2E (target post Fase 2 write), M2 + M3 + P2 + **write P2 + Fase 2 write** ✅ — guida §11.3  
**Tony E2E (post-v5):** [`docs-sviluppo/simulator/TONY_E2E_GUIDA_SVILUPPO.md`](../docs-sviluppo/simulator/TONY_E2E_GUIDA_SVILUPPO.md)

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

# Come in CI E2E — emulator + seed + Playwright (bash + Java; replica job simulator-e2e)
npm run sim:e2e:install
npm run sim:e2e:ci

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
- Link rapidi raggruppati per modulo (dopo **Entra** su ogni card):
  - **Core:** Terreni, Attività
  - **Magazzino:** home, Prodotti, Movimenti, Tracciabilità
  - **Parco macchine:** dashboard, Scadenze, Trattori, Attrezzi, Flotta, Guasti
  - **Vigneto:** dashboard, Vigneti, Potatura, Trattamenti, Concimazioni
  - **Conto terzi** (solo template `*conto-terzi*`): home, Clienti, Tariffe, Preventivi, Terreni clienti, Mappa clienti
  - **Manodopera** (template `*manodopera*` o personas): home, Gestione lavori, Validazione ore, Operai, Squadre, Statistiche, Lavori capo
- **Manodopera mobile:** pulsanti Capo / Operaio sulla card azienda (template manodopera)
- Preferire aziende con badge **Seed completo** (`seedVersion: 2` nel manifest)
- Se vedi **Seed vecchio**: `npm run sim:migrate-terreni`, `npm run sim:backfill`, oppure `npm run sim:run`

## E2E Playwright (v4)

**Prerequisiti:** emulator + `npm start` + tenant **Seed completo** in manifest.

**Suite 8/8 (consigliata):** `npm run sim:run -- --template=viticola-conto-terzi-manodopera` — stack completo (scenari 1–8). Suite 7/8: `viticola-conto-terzi` (scenario 8 richiede personas). Solo scenari 1–6: `--template=solo-titolare-viticola`.

**Catena pre-E2E (riusa verifica v3):**

```bash
npm run sim:inspect
node scripts/cascade-v3-live-smoke.js
npm run sim:audit                    # legacy nel manifest → sim:cleanup --keep 1
npm run test:run -- tests/dashboard-deadlines.test.js tests/cascade-colture-lavori.test.js tests/cascade-attrezzi-cv.test.js
npm run test:run -- tests/simulator/viticola-manodopera.test.js   # emulator attivo
npm run sim:e2e                      # 18/18 attesi su tenant viticola-conto-terzi-manodopera
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

**Scenario 4 (✅):** stesso login → `core/attivita-standalone.html?emulator=1` — diario con **≥15 righe** (seed 20), colonne Data/Terreno/Tipo Lavoro/Coltura, tipi lavoro seed visibili.

**Scenario 5 (✅):** stesso login → `modules/magazzino/views/movimenti-standalone.html?emulator=1` — **≥10 uscite** (seed 12), badge Uscita, colonna Attività con tracciabilità e note scarico visibili.

**Scenario 6 (✅):** stesso login → potatura + trattamenti + concimazioni vigneto — **≥3 potature** (seed 4), **≥6 trattamenti fitosanitari** (seed 8), **≥3 concimazioni** (seed 4); link **Vedi Attività** su ogni lista.

**Scenario 7 (✅):** login dev su tenant `viticola-conto-terzi*` → clienti (≥3, attivi/sospesi) + tariffe (≥8) + preventivi (≥5, stati misti) + terreni clienti (≥1 card con Vite).

**Scenario 8 (✅):** login dev su tenant `*manodopera*` con personas → **Operaio (mobile)** e **Capo (mobile)** → `core/mobile/field-workspace-standalone.html?emulator=1` — workspace caricato, lavori assegnati, toolbar utente, form ore; capo: sezioni validazione ore, squadra, comunicazioni.

Assert su DOM visibile — dati seed già validati da v3/v2.2/v2.1 manodopera.

**Node:** su Node 24 la CLI `playwright test` può restare bloccata; usare `npm run sim:e2e`. In CI (Node 22): `sim:e2e:install` + `sim:e2e:pw`.

**Esito attuale (2026-07-03):** `npm run sim:e2e` / CI `sim:e2e:ci` → **67/67** spec (66 passed + 1 flaky `trattamento-frutteto-completa-write` al retry; CI ~3,6 min). CI: [28645514543](https://github.com/VitaraDragon/gfv-platform/actions/runs/28645514543). Dual seed: viticola + frutteto M4.

| # | Scenario | Spec | URL target |
| - | -------- | ---- | ---------- |
| 1 | Dashboard scadenze | `dashboard-deadlines.spec.js` | dashboard dopo login dev |
| 2 | Parco scadenze | `scadenze-list.spec.js` | `modules/macchine/views/scadenze-list-standalone.html?emulator=1` |
| 3 | Terreni affitti | `terreni-affitti.spec.js` | `core/terreni-standalone.html?emulator=1` |
| 4 | Diario attività | `attivita-list.spec.js` | `core/attivita-standalone.html?emulator=1` |
| 5 | Movimenti magazzino | `movimenti.spec.js` | `modules/magazzino/views/movimenti-standalone.html?emulator=1` |
| 6 | Vigneto potature/trattamenti | `vigneto.spec.js` | `potatura` + `trattamenti` + `concimazioni` standalone |
| 7 | Conto terzi | `conto-terzi.spec.js` | clienti + tariffe + preventivi + terreni clienti standalone |
| 8 | Manodopera mobile | `field-workspace.spec.js` | `core/mobile/field-workspace-standalone.html?emulator=1` |
| 9 | CI leggera | §13.5 | ✅ job `simulator-e2e` |
| 10 | Parco macchine | `parco-macchine.spec.js` | trattori + attrezzi + flotta |
| 11 | Prodotti magazzino | `prodotti.spec.js` | `prodotti-standalone.html?emulator=1` |
| 12 | Anagrafica vigneti | `vigneti.spec.js` | `vigneti-standalone.html?emulator=1` |
| 13 | Manodopera admin | `manodopera-admin.spec.js` | gestione lavori + validazione ore |
| 14 | Hub parco macchine | `macchine-hub.spec.js` | dashboard macchine + guasti |
| 15 | Hub magazzino | `magazzino-hub.spec.js` | home + tracciabilità consumi |
| 16 | Hub vigneto | `vigneto-hub.spec.js` | dashboard vigneto |
| 17 | Hub conto terzi | `conto-terzi-hub.spec.js` | home + mappa clienti |
| 18 | Team manodopera | `manodopera-team.spec.js` | home + operai + squadre + statistiche |
| 19 | Capo lavori desktop | `capo-lavori.spec.js` | lavori-caposquadra |

**File:** `scripts/sim-e2e-run.mjs`, `simulator/ci-e2e-run.js`, `scripts/sim-ci-e2e-inner.sh`, `tests/e2e/sim/` — dettaglio assert: **`GFV_FARM_SIMULATOR.md` §11.2**.

## Roadmap v5 — copertura app completa

**Obiettivo:** estendere sim + E2E fino a coprire (per gradi) pagine, form e moduli dell’app reale — **stesso codice**, dati seed, test read poi write.

| Stato oggi (2026-07-03) | Target residuo |
| ----------------------- | -------------- |
| **67/67** spec E2E ✅ CI ([28645514543](https://github.com/VitaraDragon/gfv-platform/actions/runs/28645514543)) | Report + statistiche **fuori scope** (redesign UI) |
| **Fase 1 write P2** ✅ scen. 65–67 (scadenze, operai, squadre) | Fase 2 write residui (~6 form) |
| **M4 frutteto** ✅ template `frutteto-solo-titolare` + 6 spec E2E | Template frutteto+manodopera/CT (se richiesto) |
| Read smoke ~45/45 URL ✅ | Report + statistiche **fuori scope** (redesign UI) |
| Read profondi batch A–C ✅ | §11.3.13 — hub magazzino, vigneto, CT, manodopera |
| Write catene A/B + concimazione diario ✅ | Tracciabilità: solo catena auto (no write E2E) |
| Tony E2E gate v5 ✅ | Kick-off §7.2–7.3 `TONY_E2E_GUIDA_SVILUPPO.md` |

**Milestone:** M1 ✅ → M2 ✅ → M3 ✅ → P2 ✅ → batch 45–54 ✅ → **read profondi §11.3.13** ✅ → **CI 67/67** ✅ → **M4 frutteto** ✅ → **Fase 1 write P2** ✅ → M5 → M-T* Tony.

**Prossimo incremento consigliato:** stabilizzare flaky frutteto write; Fase 2 write residui; oppure track **Tony E2E**.

**CI E2E (v4 #9 ✅):** `npm run sim:e2e:install && npm run sim:e2e:ci` — replica locale del job GitHub Actions (richiede bash + Java).

## Tony E2E (post v5 app) — guida sviluppo

Dopo **M2 + M3 v5** (read/write app completi), il track successivo integra **Tony** con seed sim + Playwright: tempi risposta, typo recovery, errori concetto, azioni non consentite.

**Guida operativa (checklist milestone M-T0…M-T6, matrice scenari, CI a strati):**

[`docs-sviluppo/simulator/TONY_E2E_GUIDA_SVILUPPO.md`](../docs-sviluppo/simulator/TONY_E2E_GUIDA_SVILUPPO.md)

**Stato:** 📋 pianificato — comandi `sim:tony:e2e*` da implementare (§12 guida).

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

## Cosa aggiunge il template `viticola-conto-terzi`

Estende `solo-titolare-viticola` (stessi dati base per scenari E2E 1–6) + modulo Conto Terzi:

| Risorsa | Quantità |
|---------|----------|
| Clienti | 3 (2 attivi + 1 sospeso) |
| Poderi clienti | 3 |
| Terreni clienti | 6 |
| Tariffe | 8 (7 attive + 1 disattivata) |
| Preventivi | 5 (stati misti: bozza, inviato, accettato, rifiutato) |
| **Terreni totali in Firestore** | **10** (4 azienda + 6 clienti) |

**E2E v4:** tenant `viticola-conto-terzi-manodopera` copre la suite **8/8** (`npm run sim:e2e`). Solo conto terzi: `viticola-conto-terzi` → **7/8** (manca scenario 8 manodopera). Scenario 7: `loginAsManagerContoTerzi`; scenario 8: `loginAsCapoFromDevPage` / `loginAsOperaioFromDevPage`.

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

- **Trigger:** push su `main` e pull request che toccano `simulator/`, `tests/simulator/`, `tests/e2e/sim/**`, `scripts/sim-e2e-run.mjs`, `scripts/sim-ci-e2e-inner.sh`, `playwright.config.js`, `firebase.json`, dipendenze root; anche **Run workflow** manuale.
- **Job `simulator-emulator`:** Ubuntu, Node 22, Java 21 → `npm run sim:test:ci` (`emulators:exec` + `sim:test` + `sim:test:vitest`). Timeout 15 min.
- **Job `simulator-e2e`:** stesso ambiente → `npm run sim:e2e:install` + `npm run sim:e2e:ci` (seed `viticola-conto-terzi-manodopera` + **43 spec** Playwright headless, ~1–2 min E2E). Timeout 25 min. Job in parallelo con il precedente.
- **Locale Node (CI):** `npm run sim:test:ci` — richiede Java su PATH.
- **Locale E2E (CI):** `npm run sim:e2e:install && npm run sim:e2e:ci` — richiede bash + Java (Git Bash/WSL su Windows).

## Sicurezza

Il simulatore **refusa di girare** senza `FIRESTORE_EMULATOR_HOST` e `FIREBASE_AUTH_EMULATOR_HOST` su host locale (`127.0.0.1` / `localhost`). Non puntare mai a produzione.

## Emulator UI

Dopo `sim:emulators`, apri la Firebase Emulator UI (di solito `http://127.0.0.1:4000`) per ispezionare Auth e Firestore.
