# Tony — modulo Conto Terzi (note tecniche)

## Caricamento guida

- Utente: `CONTO_TERZI/utente/guida.md`
- Sintesi contesto: `CONTO_TERZI/utente/guida-sintesi.md` → `context.guida_sintesi_conto_terzi`

## Pagine principali (modulo)

- `modules/conto-terzi/views/conto-terzi-home-standalone.html` — home, panoramica, azioni rapide (accesso tipico manager/amministratore)
- `modules/conto-terzi/views/clienti-standalone.html` — anagrafica clienti
- `modules/conto-terzi/views/terreni-clienti-standalone.html` — terreni per cliente
- `modules/conto-terzi/views/mappa-clienti-standalone.html` — mappa
- `modules/conto-terzi/views/tariffe-standalone.html` — tariffe
- `modules/conto-terzi/views/preventivi-standalone.html` — lista preventivi e stati
- `modules/conto-terzi/views/nuovo-preventivo-standalone.html` — creazione preventivo
- `modules/conto-terzi/views/accetta-preventivo-standalone.html` — accettazione cliente (link)

## Navigazione Tony

Target utili: `conto terzi`, `clienti`, `preventivi`, `tariffe`, `terreni clienti`, `mappa clienti`, `lavori`, `attivita` / `diario` per flussi operativi collegati.

## Dati tabella

Dove esposto `window.currentTableData` / `table-data-ready`, usare solo summary e items per risposte su liste visibili.
