# Tony — guida tecnica modulo Seminativo

Modulo tenant: tipicamente `seminativo` (minuscolo; verificare `tenant.modules`).

## Path standalone (relativi a `modules/seminativo/views/`)

| Pagina | File |
|--------|------|
| Dashboard seminativo | `seminativo-dashboard-standalone.html` |
| Anagrafica appezzamenti (campagne) | `seminativi-standalone.html` |
| Piano colturale | `piano-colturale-standalone.html` |
| Semina | `semina-standalone.html` |
| Lavorazioni terreno | `lavorazioni-standalone.html` |
| Trattamenti | `trattamenti-standalone.html` |
| Concimazioni | `concimazioni-standalone.html` |
| Raccolta / mietitura | `raccolta-standalone.html` |
| Statistiche | `seminativo-statistiche-standalone.html` |

## Collezioni Firestore

- `tenants/{tenantId}/seminativi` — anagrafica campagne (terreno + coltura + varietà + anno)
- `tenants/{tenantId}/semineSeminativo` — eventi di semina
- `tenants/{tenantId}/trattamentiSeminativo` — dati prodotto su lavoro o diario (trattamenti)
- `tenants/{tenantId}/raccolteSeminativo` — quintali su lavoro o diario (raccolte/mietitura)

## pageType / liste Tony

Dove esposto `window.currentTableData` ed emesso `table-data-ready`, Tony può leggere liste come utente (verificare pagina per pagina se presente). Esempi di `pageType` dove probabilmente mappati:

- `seminativi` — anagrafica appezzamenti/campagne
- `piano_colturale_seminativo` — piano colturale
- `semina_seminativo` — semine
- `lavorazioni_seminativo` — lavorazioni terreno
- `trattamenti_seminativo` — trattamenti
- `concimazioni_seminativo` — concimazioni
- `raccolta_seminativo` — raccolte/mietitura
- `statistiche_seminativo` — statistiche

Verificare in `core/config/tony-form-mapping.js` e `functions/index.js` se presenti mapping per form e comandi `FILTER_TABLE`.

## Terreni (core) → modulo

- `core/terreni-standalone.html`: icona **grano** (🌾) → `modules/seminativo/views/seminativi-standalone.html?terrenoId=…` (anagrafica campagne per quel terreno).

## Navigazione intent

Target utili: `seminativo`, `seminativi`, `anagrafica appezzamenti`, `piano colturale`, `semina seminativo`, `lavorazioni seminativo`, `trattamenti seminativo`, `concimazioni seminativo`, `raccolta seminativo`, `statistiche seminativo` — allineare a `functions/index.js` / mappa `core/js/tony/engine.js` (procedura utente: **Dashboard Seminativo**, non dashboard vigneto/frutteto).

## Riassunto Tony

- **`SEMINATIVO/utente/guida-sintesi.md`** → campo `guida_sintesi_seminativo` in `tony-service.js` (dedup primo turno come Core / Parco / Vigneto / Frutteto / Magazzino / Manodopera / Conto Terzi / Meteo).

## Hub e configurazione

- `modules/seminativo/config/seminativo-hub.js`: `SEMINATIVO_HUB_CARDS` definisce le card della dashboard (id, title, description, icon, href, tonyTarget, pageType).
- Colori modulo: `SEMINATIVO_ACCENT = '#C9A227'`, `SEMINATIVO_ACCENT_DARK = '#8D6E00'` (giallo).

## Differenza da vigneto/frutteto

- **Campagna annuale**: ogni record anagrafica = terreno + coltura + varietà + anno (no impianto permanente pluriennale).
- **Rotazione**: piano colturale propone la coltura successiva per lo stesso terreno nell'anno futuro.
- **Registri**: stessa logica di trattamenti/concimazioni (lavoro → completamento nel modulo), ma riferiti a campagna annuale, non a impianto permanente.
- **CTA Diario vs lavoro:** `applyDiarioVsLavoroCta` in `lavorazioni-page.js`, `trattamenti-page.js` (anche **Concimazioni** via `initConcimazioniPage`) e `raccolta-page.js` — con Manodopera mostra **Nuovo lavoro**, senza **Registra nel diario**.
- **Resa**: resa prevista in anagrafica (qli/ha stimati); resa effettiva calcolata dalle raccolte registrate (statistiche).

## Permessi

Verificare su singole pagine (`seminativo-statistiche-standalone.html` può restringere a Manager/Amministratore; anagrafica e registri probabilmente più permissivi).
