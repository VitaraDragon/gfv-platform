# GFV Farm Simulator

Generatore locale di aziende agricole di test su **Firebase Emulator** (Auth + Firestore).

Guida completa: [`docs-sviluppo/simulator/GFV_FARM_SIMULATOR.md`](../docs-sviluppo/simulator/GFV_FARM_SIMULATOR.md)

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

# Run completo v1 (setup + populate + 4 settimane attività)
npm run sim:run

# Solo creazione tenant/utente
npm run sim:setup

# Log dettagliati
npm run sim:run:verbose

# Ispeziona terreni ultima azienda in manifest
npm run sim:inspect

# Ispeziona tenant specifico
npm run sim:inspect -- sim_az_agr_ricci_146413

# Aggiorna terreni vecchi (manifest senza seedVersion 2)
npm run sim:migrate-terreni
```

## Verifica UI in browser

**Terminale 3** — server statico (lasciare aperto):

```bash
npm start
```

Pagina dev aziende simulate:

**http://127.0.0.1:8000/core/dev/simulator-dev-standalone.html?emulator=1**

- Password: **`SimGFV2026!`**
- Usare aziende con badge **Seed completo** (in cima alla lista)
- Se vedi **Seed vecchio**: `npm run sim:migrate-terreni` oppure `npm run sim:run`

## Credenziali emulator

Password fissa per tutti gli utenti simulati: **`SimGFV2026!`**

Email e tenant ID sono nel report a fine run e in `simulator/manifest.json` (campo `seedVersion: 2` = terreni completi).

## Seed terreni (v2)

Ogni nuova azienda include:

- Catalogo colture + categorie + podere (nome azienda)
- Terreni con `coltura: "Vite da Vino"`, `podere`, `tipoCampo`, `polygonCoords`

Le aziende create **prima** del seed v2 restano nell’emulator finché non si esegue `sim:migrate-terreni` o un nuovo `sim:run`.

## Sicurezza

Il simulatore **refusa di girare** senza `FIRESTORE_EMULATOR_HOST` e `FIREBASE_AUTH_EMULATOR_HOST` su host locale (`127.0.0.1` / `localhost`). Non puntare mai a produzione.

## Emulator UI

Dopo `sim:emulators`, apri la Firebase Emulator UI (di solito `http://127.0.0.1:4000`) per ispezionare Auth e Firestore.
