# Tony — guida tecnica modulo Meteo

Modulo tenant: `meteo` in `tenants.modules` (legacy `moduli_attivi` supportato).

`terreniPerAvvisiMeteo` esclude `stato: archiviato` e i terreni cliente prima del taglio `MAX_TERRENI_METEO`. `fetchTerrenoMeteo` su un archiviato risponde `ARCHIVIATO` e non chiama il meteo. Le regole Tony saltano quelle righe. Dopo il merge vanno pubblicate le function meteo.

## Piani e accesso

| Livello | Condizione | UI |
|---------|------------|-----|
| Nessuno | `planId === 'free'` | `initDashboardMeteo` mostra la riga con `meteoFreeUpsell({ planId })` («Meteo sede disponibile con il piano Base» + **Vai ad Abbonamento →**, #327), nessun fetch; pagina modulo gate |
| Meteo sede | Base, modulo **non** attivo | `#dashboard-meteo-widget` titolo **Meteo sede**; `fetchMeteoSedeWithLocalCache(tenantId, { advanced: false })` |
| Modulo Meteo | Base + `meteo` in modules | Widget espanso (`dashboard-meteo-widget--expanded`); link `METEO_MODULE_HREF`; pagina standalone |

Gate pagina: `modules/meteo/views/meteo-dashboard-standalone.html` — `hasMeteoModuleAccess()` da `meteo-module-service.js`.

Sede: indirizzo tenant / Impostazioni; codice errore `SEDE_NOT_SET` in `dashboard-meteo.js`.

**Secondo giro anteprima (#323, su develop da 8f2e3368).** `core/js/meteo-ui-helpers.js`: `messaggioMeteoDashboard({ code, timedOut, fallback })` → `SEDE_NOT_SET` = `MSG_SEDE_PIN_MANCANTE` «Imposta il pin della sede in Impostazioni per vedere il meteo.», timeout = `MSG_METEO_TIMEOUT` «Meteo non disponibile al momento. Riprova più tardi.». `dashboard-meteo.js` mette in gara `fetchMeteoSedeWithLocalCache` con un timeout di `METEO_FETCH_TIMEOUT_MS` = 15000 ms. `deveProporrePinSedeDaIndirizzo({ indirizzo, citta, sedeCoordinate })`: in `admin/impostazioni-standalone.html` `maybeProposeSedePinFromAddress()` all’apertura della mappa sede, se ci sono via/comune e niente coordinate, riempie `#sede-map-search` e chiama `geocodeSedeQuery(query, { messaggioOk: 'Controlla il pin e salva' })`; il pin si registra solo con **Salva Impostazioni Azienda**.

**Correzioni 2 novembre (#327).** `meteoFreeUpsell` / `MSG_METEO_PIANO_BASE` / `ABBONAMENTO_HREF_DASHBOARD` in `core/js/meteo-ui-helpers.js`; `.dashboard-meteo-row[hidden] { display: none; }` in `core/styles/dashboard.css`. Pin automatico al primo accesso in dashboard (`core/js/sede-auto-pin.js` + `core/js/sede-geocode-match.js`, solo se il Geocoder trova un risultato nello stesso comune): dettaglio in `GUIDA/CORE/tony/guida-tecnica.md` § Correzioni app del 2 novembre. Guard #326: le frasi «segna le ore» non entrano più in `isTonyMeteoQuestion` / `isTonyMeteoOperationalQuestion`. **Difetto noto, in coda:** dopo il pin automatico o il salvataggio manuale da Impostazioni, il widget meteo della dashboard non si ricarica automaticamente nella stessa visita; l'utente deve ricaricare la pagina.

## Path

| Pagina | File |
|--------|------|
| Dashboard meteo modulo | `modules/meteo/views/meteo-dashboard-standalone.html` |
| Widget dashboard | `#dashboard-meteo-widget`, `#dashboard-meteo-side` — `core/js/dashboard-meteo.js` |
| Hub catalog | `meteo` in `MODULE_CATALOG` — `core/js/dashboard-hub.js` |

Query opzionale: `?terrenoId=` preseleziona campo sulla mappa.

## pageType / Tony liste

- **`meteo_dashboard`** — `publishMeteoTonyContext` in `meteo-dashboard-controller.js`: `window.currentTableData` + merge `Tony.setContext('page', …)` + `table-data-ready`.
- Items: terrenoId, nome, podere, ok, temp, popOggi, popDomani, hasRainSoon, alertsCount, previsioniGiornaliere (slim).
- Sede: `table.sede` con label e previsioniGiornaliere (troncate in prompt Tony a 8 giorni — `tony-service.js`).

## Servizi e regole

- Client: `core/services/meteo-service.js` (`fetchMeteoSedeWithLocalCache`, `fetchMeteoTerreni`).
- Cloud: `functions/meteo-service.js`.
- UI helper: `core/js/meteo-ui-helpers.js` (alert banner, POP, minutely strip).
- Consigli operativi Tony: `core/config/tony-meteo-rules.js` (mirror `functions/tony-meteo-rules.js`); briefing proattivo `PROACTIVE_METEO_*` in `dashboard-meteo-briefing.js` (attesa massima 4 s via `attendiConLimite` in `core/js/dashboard-briefing-helpers.js`, 5c5defc; meteo tardivo solo nel contesto Tony), quick reply `core/js/tony/meteo-dashboard-quick-reply*.js`.

## Navigazione intent

Target engine: `meteo`, `modulo meteo`, `previsioni meteo` → `modules/meteo/views/meteo-dashboard-standalone.html` (`core/js/tony/engine.js`).

## Riassunto Tony

- **`METEO/utente/guida-sintesi.md`** → `guida_sintesi_meteo` in `tony-service.js`.
- **`GUIDA_LOAD_ENTRIES`**: `METEO/utente/guida.md`, `METEO/tony/guida-tecnica.md`.

## Mappa terreni

- `loadMappaAziendale` con `mode: 'meteo'`, `containerId: 'meteo-mappa-container'`, callback `onTerrenoSelect`.
- Terreno senza coords: riga `NO_COORDS`, link Terreni in pannello dettaglio.
