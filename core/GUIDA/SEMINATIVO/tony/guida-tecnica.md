# Tony — guida tecnica modulo Seminativo

Modulo tenant: **`seminativo`** in `tenants.modules` / catalogo `AVAILABLE_MODULES` (su **main**; verificare presenza codice su develop).

## Path (relativi a `modules/seminativo/views/`)

| Pagina | File | pageType / note |
|--------|------|-----------------|
| Hub / dashboard | `seminativo-dashboard-standalone.html` | hub cards da `config/seminativo-hub.js` |
| Anagrafica | `seminativi-standalone.html` | `seminativi` |
| Piano colturale | `piano-colturale-standalone.html` | `piano_colturale_seminativo` |
| Semina | `semina-standalone.html` | `semina_seminativo` |
| Lavorazioni | `lavorazioni-standalone.html` | `lavorazioni_seminativo` |
| Trattamenti | `trattamenti-standalone.html` | `trattamenti_seminativo` |
| Concimazioni | `concimazioni-standalone.html` | `concimazioni_seminativo` |
| Raccolta | `raccolta-standalone.html` | `raccolta_seminativo` |
| Statistiche | `seminativo-statistiche-standalone.html` | `statistiche_seminativo` |

Config hub + target Tony: `modules/seminativo/config/seminativo-hub.js` (`SEMINATIVO_HUB_CARDS`, `tonyTarget`). Context liste: `js/seminativo-page-context.js` (`publishSeminativoTableData`).

## Collezioni (tenant)

`seminativi`, `semineSeminativo`, `trattamentiSeminativo`, `raccolteSeminativo` (vedi costanti in hub config).

## Navigazione

Target da hub: `seminativi`, `piano colturale`, `semina seminativo`, `lavorazioni/trattamenti/concimazioni/raccolta/statistiche seminativo`. Esclusi dal parallelo vigneto: potatura, pianifica impianto, calcolo materiali (`SEMINATIVO_EXCLUDED_FROM_VIGNETO`).

## Guide utente / sintesi

- `SEMINATIVO/utente/guida.md`, `guida-sintesi.md`
- **Wire Tony runtime:** aggiungere path a `GUIDA_LOAD_ENTRIES` + fetch `guida_sintesi_seminativo` in `tony-service.js` quando il modulo è sul branch di deploy (oggi le sintesi Seminativo esistono in GUIDA ma possono non essere ancora nel loader).
