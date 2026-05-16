# Tony — guida tecnica modulo Frutteto

Modulo tenant: tipicamente `frutteto` (minuscolo; verificare `tenant.modules`).

## Path standalone (relativi a `modules/frutteto/views/`)

| Pagina | File |
|--------|------|
| Dashboard frutteto | `frutteto-dashboard-standalone.html` |
| Anagrafica frutteti | `frutteti-standalone.html` |
| Raccolta frutta | `raccolta-frutta-standalone.html` |
| Potatura | `potatura-standalone.html` |
| Trattamenti | `trattamenti-standalone.html` |
| Concimazioni | `concimazioni-standalone.html` |
| Statistiche | `frutteto-statistiche-standalone.html` |

## Pianificazione e calcolo materiali (condivisi con Vigneto)

- `../../vigneto/views/pianifica-impianto-standalone.html?coltura=frutteto`
- `../../vigneto/views/calcolo-materiali-standalone.html?coltura=frutteto`

## pageType / liste Tony

- **`concimazioni_frutteto`** — `concimazioni-standalone.html` aggiorna `window.currentTableData` ed emette `table-data-ready`.

Altre pagine frutteto possono non esporre ancora `currentTableData` per Tony.

## Terreni (core) → modulo

- `core/terreni-standalone.html`: `gestisciFrutteto(terrenoId)` → `modules/frutteto/views/frutteti-standalone.html?terrenoId=…` (anagrafica).

## Navigazione intent

Target utili: `frutteto`, `frutteti`, `statistiche frutteto`, `raccolta frutta`, `potatura frutteto`, `trattamenti frutteto`, `calcolo materiali frutteto`, `pianificazione impianto frutteto` — allineare a `functions/index.js` / mappa `core/js/tony/engine.js` (procedura utente: **Dashboard Frutteto**, non dashboard vigneto).

## Riassunto Tony

- **`FRUTTETO/utente/guida-sintesi.md`** → campo `guida_sintesi_frutteto` in `tony-service.js` (dedup primo turno come Core / Parco / Vigneto).

## Permessi

`frutteto-statistiche-standalone.html` può restringere a Manager/Amministratore; la dashboard frutteto in campione non replica lo stesso blocco del vigneto: verificare su altre viste.
