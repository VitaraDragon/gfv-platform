# Tony — guida tecnica modulo Magazzino

Modulo tenant: tipicamente `magazzino` (minuscolo; verificare `tenant.modules`).

## Path standalone (relativi a `modules/magazzino/views/`)

| Pagina | File |
|--------|------|
| Home magazzino | `magazzino-home-standalone.html` |
| Anagrafica prodotti | `prodotti-standalone.html` |
| Movimenti | `movimenti-standalone.html` |
| Tracciabilità consumi | `tracciabilita-consumi-standalone.html` |

## pageType / liste Tony

- **`prodotti`** — `prodotti-standalone.html`: `window.currentTableData`, evento `table-data-ready` con `detail.currentTableData`.
- **`movimenti`** — `movimenti-standalone.html`: stesso canone.
- **`tracciabilita_consumi`** — `tracciabilita-consumi-standalone.html`: items + opz. `consumiAggregates`; filtri **categoria**, **terreno**, **vista**, **reset**; vedi istruzioni **FILTER_TABLE** in `functions/index.js` (Tony avanzato).

## Navigazione intent

Target utili: `magazzino` (home), `prodotti`, `movimenti`, alias **tracciabilità consumi** / **tracciabilita consumi** / **consumi magazzino** → `tracciabilita-consumi-standalone.html`. Allineare a `functions/index.js` / `core/js/tony/engine.js`.

## Form Tony (Tony avanzato)

- **`prodotto-form`** / **`movimento-form`**: mapping in `core/config/tony-form-mapping.js`, injector in `core/js/tony-form-injector.js`; comandi **INJECT_FORM_DATA**, **OPEN_MODAL** `prodotto-modal` / `movimento-modal`; regole magazzino in `functions/index.js` (SAVE solo su conferma esplicita).

## Riassunto Tony

- **`MAGAZZINO/utente/guida-sintesi.md`** → campo `guida_sintesi_magazzino` in `tony-service.js` (dedup primo turno come Core / Parco / Vigneto / Frutteto).

## Permessi

Di solito Manager/Amministratore per modifiche sensibili; verificare su installazioni con ruoli custom.
