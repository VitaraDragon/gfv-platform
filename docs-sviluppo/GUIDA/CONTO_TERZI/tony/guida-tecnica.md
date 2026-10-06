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

## Preventivi — numero e accettazione

- Numero: `PREV-{anno}-{seq}` padded (`preventivo-lock-utils.js`); allocazione seq atomica sul tenant (`preventivoSeqByYear`) + create preventivo.
- Accettazione cliente / manager: in **transazione** (stato ammissibile bozza/inviato, non scaduto) — evita doppie accettazioni concorrenti (`modules/conto-terzi/services/preventivi-service.js`, CF correlate in `functions/index.js` se esposte).

## Preventivi — disambiguazione terreno con coltura (T-FLOW-014)

Form Tony `tony-form-injector.js`: quando compila un preventivo con **cliente** + **coltura** ma senza `terreno-id` esplicito, pre-inietta il cliente, attende il caricamento terreni (`awaitPreventivoTerreniFetchDone`), poi tenta risoluzione terreno usando la coltura come hint (`resolveTerrenoIdForPreventivo`).

- **Univoco**: se esiste un solo terreno del cliente con quella coltura → auto-compila `terreno-id`.
- **Ambiguo**: più terreni con la stessa coltura → disambiguazione (`__tonyIsTerrenoAmbiguous = true`), Tony chiede all'utente quale terreno intende.
- Comportamento analogo a disambiguazione terreno/macchina già presente per altri form (Gestione lavori, ecc.); esteso ai preventivi dopo fix T-FLOW-014.

## Terreni clienti — disegno confini (Fase 1b)

Stesso motore dei Terreni aziendali: `core/js/terreni-maps.js` + `terreni-draw-helpers.js`. Vicini = terreni **già salvati del cliente** selezionato (non i campi aziendali). Tony non disegna; spiega gli stessi gesti (chiusura sul primo punto / doppio tap / Togli ultimo / aggancio). `pageType` lista: `terreniClienti`.

## Link registro lavori (gate Manodopera)

- Home Conto Terzi: card/azioni con `data-gfv-registro` (`in_corso`, `completato`, `da_pianificare`) riscritte da `applyRegistroLavoriLinks` (`core/config/manodopera-diario-gate.js`). Con Manodopera → `core/admin/gestione-lavori-standalone.html?contoTerzi=true&stato=…` (filtro tipo `conto_terzi`); senza → `core/attivita-standalone.html?contoTerzi=true&stato=…`; `da_pianificare` nascosto senza Manodopera. `body[data-gfv-registro]` = `lavori` | `diario`.
