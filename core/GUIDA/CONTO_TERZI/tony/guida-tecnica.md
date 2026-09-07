# Tony — modulo Conto Terzi (note tecniche)

## Caricamento guida

- Utente: `CONTO_TERZI/utente/guida.md`
- Sintesi contesto: `CONTO_TERZI/utente/guida-sintesi.md` → `context.guida_sintesi_conto_terzi`

## Pagine principali (modulo)

- `modules/conto-terzi/views/conto-terzi-home-standalone.html` — home, panoramica, azioni rapide (accesso tipico manager/amministratore)
- `modules/conto-terzi/views/clienti-standalone.html` — anagrafica clienti
- `modules/conto-terzi/views/terreni-clienti-standalone.html` — terreni per cliente; disegno confini = `core/js/terreni-maps.js` (stesso 1b di Terreni aziendali)
- `modules/conto-terzi/views/mappa-clienti-standalone.html` — mappa
- `modules/conto-terzi/views/tariffe-standalone.html` — tariffe
- `modules/conto-terzi/views/preventivi-standalone.html` — lista preventivi e stati
- `modules/conto-terzi/views/nuovo-preventivo-standalone.html` — creazione preventivo
- `modules/conto-terzi/views/accetta-preventivo-standalone.html` — accettazione cliente (link)

## Navigazione Tony

Target utili: `conto terzi`, `clienti`, `preventivi`, `tariffe`, `terreni clienti`, `mappa clienti`, `lavori`, `attivita` / `diario` per flussi operativi collegati.

## Dati tabella

Dove esposto `window.currentTableData` / `table-data-ready`, usare solo summary e items per risposte su liste visibili.

## Terreni clienti — disegno confini (Fase 1b)

Stesso motore dei Terreni aziendali: `core/js/terreni-maps.js` + `terreni-draw-helpers.js`. Vicini = terreni **già salvati del cliente** selezionato (non i campi aziendali). Tony non disegna; spiega gli stessi gesti (chiusura sul primo punto / doppio tap / Togli ultimo / aggancio). `pageType` lista: `terreniClienti`.
