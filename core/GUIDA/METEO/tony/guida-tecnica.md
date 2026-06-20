# Tony — guida tecnica modulo Meteo

Modulo tenant: `meteo` in `tenants.modules` (legacy `moduli_attivi` supportato).

## Piani e accesso

| Livello | Condizione | UI |
|---------|------------|-----|
| Nessuno | `planId === 'free'` | `initDashboardMeteo` nasconde riga; pagina modulo gate |
| Meteo sede | Base, modulo **non** attivo | `#dashboard-meteo-widget` titolo **Meteo sede**; `fetchMeteoSedeWithLocalCache(tenantId, { advanced: false })` |
| Modulo Meteo | Base + `meteo` in modules | Widget espanso (`dashboard-meteo-widget--expanded`); link `METEO_MODULE_HREF`; pagina standalone |

Gate pagina: `modules/meteo/views/meteo-dashboard-standalone.html` — `hasMeteoModuleAccess()` da `meteo-module-service.js`.

Sede: indirizzo tenant / Impostazioni; codice errore `SEDE_NOT_SET` in `dashboard-meteo.js`.

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
- Consigli operativi Tony: `core/config/tony-meteo-rules.js` (mirror `functions/tony-meteo-rules.js`); briefing proattivo `PROACTIVE_METEO_*` in `dashboard-meteo-briefing.js`, quick reply `core/js/tony/meteo-dashboard-quick-reply*.js`.

## Navigazione intent

Target engine: `meteo`, `modulo meteo`, `previsioni meteo` → `modules/meteo/views/meteo-dashboard-standalone.html` (`core/js/tony/engine.js`).

## Riassunto Tony

- **`METEO/utente/guida-sintesi.md`** → `guida_sintesi_meteo` in `tony-service.js`.
- **`GUIDA_LOAD_ENTRIES`**: `METEO/utente/guida.md`, `METEO/tony/guida-tecnica.md`.

## Mappa terreni

- `loadMappaAziendale` con `mode: 'meteo'`, `containerId: 'meteo-mappa-container'`, callback `onTerrenoSelect`.
- Terreno senza coords: riga `NO_COORDS`, link Terreni in pannello dettaglio.
