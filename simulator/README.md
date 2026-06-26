# GFV Farm Simulator

Generatore locale di aziende agricole di test su **Firebase Emulator** (Auth + Firestore).

Guida completa: [`docs-sviluppo/simulator/GFV_FARM_SIMULATOR.md`](../docs-sviluppo/simulator/GFV_FARM_SIMULATOR.md)

**v2 manodopera (in sviluppo):** spec §14 + **decisioni bloccate §14.0** — multi-account, `runAsPersona`, no inviti, numeri configurabili (`caposquadra`/`operai`), v3 errori posticipato.

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

# Aggiorna aziende già nel manifest (prodotti, flotta/scadenze, movimenti mancanti, spese vigneto, date)
npm run sim:backfill

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
- Preferire aziende con badge **Seed completo** (`seedVersion: 2` nel manifest)
- Se vedi **Seed vecchio**: `npm run sim:migrate-terreni`, `npm run sim:backfill`, oppure `npm run sim:run`

## Manifest e audit

- In git: `simulator/manifest.json` è **vuoto** (`[]`); dopo `sim:run` o batch si popola **solo in locale**.
- Struttura di esempio: `simulator/manifest.example.json`.
- Verifica coerenza: `npm run sim:audit` (richiede emulator + entry manifest presenti sull'emulator).

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
| Terreni | 4 |
| Trattori + attrezzi | 1 + 3 |
| Flotta aziendale (furgone/pickup) | 2 |
| **Macchine totali** | **6** |
| Vigneti | 4 |
| Prodotti magazzino | 5 |
| Attività (4 settimane) | 20 |
| Movimenti magazzino (uscite) | 12 |
| Potature vigneto (da attività Potatura) | 4 |
| Trattamenti vigneto (Trattamento/Concimazione/Controllo fitosanitario) | 12 |

Ogni macchina seed v1.6+ include scadenze demo (`prossimaManutenzione`, e per trattori/flotta anche revisione/assicurazione); almeno 2 mezzi in stato `in_manutenzione`. Aziende create prima di v1.6: `npm run sim:backfill`.

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
