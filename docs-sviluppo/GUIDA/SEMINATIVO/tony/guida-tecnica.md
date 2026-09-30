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
- Runtime: path in `GUIDA_LOAD_ENTRIES` + `guida_sintesi_seminativo` in `tony-service.js`.

## Page-map / tony-nav (allineamento)

| Target APRI_PAGINA | Path | Note |
|--------------------|------|------|
| `seminativo` | `modules/seminativo/views/seminativo-dashboard-standalone.html` | hub; quick-reply «portami al seminativo» |
| `seminativi` | `…/seminativi-standalone.html` | anagrafica |
| `piano colturale` | `…/piano-colturale-standalone.html` | |
| `semina seminativo` | `…/semina-standalone.html` | |
| `lavorazioni seminativo` | `…/lavorazioni-standalone.html` | |
| `trattamenti seminativo` | `…/trattamenti-standalone.html` | |
| `concimazioni seminativo` / `concimazione seminativo` | `…/concimazioni-standalone.html` | |
| `raccolta seminativo` | `…/raccolta-standalone.html` | |
| `statistiche seminativo` / `seminativo statistiche` | `…/seminativo-statistiche-standalone.html` | |

Registrati in: `core/config/tony-routes.json`, `core/js/tony/engine.js` (`TONY_PAGE_MAP`), `functions/tony-module-gate.js` + `core/config/tony-module-gate.js` (gate `seminativo`), `functions/tony-nav-quick-reply.js`. Sintesi runtime: `guida_sintesi_seminativo` in `tony-service.js`.

**Branch:** i path puntano a codice presente su **main**; su develop tip la cartella `modules/seminativo/` può mancare — Tony non deve inventare pagine se il modulo non è attivo o i file non sono nel deploy.

