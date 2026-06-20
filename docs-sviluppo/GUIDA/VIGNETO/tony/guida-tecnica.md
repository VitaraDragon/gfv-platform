# Tony — guida tecnica modulo Vigneto

Modulo tenant: tipicamente `vigneto` (minuscolo; verificare `tenant.modules`).

## Path standalone (relativi a `modules/vigneto/views/`)

| Pagina | File |
|--------|------|
| Dashboard vigneto | `vigneto-dashboard-standalone.html` |
| Anagrafica vigneti | `vigneti-standalone.html` |
| Vendemmia | `vendemmia-standalone.html` |
| Potatura | `potatura-standalone.html` |
| Trattamenti | `trattamenti-standalone.html` |
| Concimazioni | `concimazioni-standalone.html` |
| Statistiche | `vigneto-statistiche-standalone.html` |
| Pianifica impianto | `pianifica-impianto-standalone.html` (query `coltura=vigneto` dai link dashboard) |
| Calcolo materiali | `calcolo-materiali-standalone.html` |

## pageType / Tony liste

- **`vendemmia`** — `vendemmia-standalone.html` aggiorna `window.currentTableData` ed emette `table-data-ready`.
- **`concimazioni_vigneto`** — `concimazioni-standalone.html` (placeholder coerente canone liste).

Altre pagine vigneto possono non esporre ancora `currentTableData`: non presumere items tabella su trattamenti/potatura/statistiche salvo implementazione futura.

## Contesto dashboard principale

Ingresso utente: menu **Moduli** → **Vigneto** (`vigneto` in `MODULE_CATALOG` / `core/js/dashboard-hub.js`). Riquadro modulo in fondo pagina solo senza Manodopera (`core/js/dashboard-sections.js`).

Con modulo attivo, `core/dashboard-standalone.html` può arricchire il contesto Tony con riepilogo produzione/vigneti (`setContext('vigneto', …)` via `vigneto-statistiche-service`).

## Terreni (core) → modulo

- `core/terreni-standalone.html`: `gestisciVigneto(terrenoId)` → `modules/vigneto/views/vigneti-standalone.html?terrenoId=…`; `gestisciFrutteto` → `frutteti-standalone.html?terrenoId=…` (anagrafica, non dashboard).

## Navigazione intent

Target utili (mappa comandi cloud): `vigneto`, `vigneti`, `statistiche vigneto`, `vendemmia`, `potatura vigneto`, `trattamenti vigneto` — allineare alla mappa `functions/index.js` / istruzioni sistema se si aggiungono sinonimi.

## Riassunto Tony

- **`VIGNETO/utente/guida-sintesi.md`** → campo `guida_sintesi_vigneto` in `tony-service.js` (stessa dedup del primo turno rispetto a `guida_app`).

## Permessi

`vigneto-dashboard-standalone.html` restringe l’accesso a ruoli che includono Manager o Amministratore; altre viste possono avere regole diverse.
