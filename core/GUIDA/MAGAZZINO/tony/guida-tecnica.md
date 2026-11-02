# Tony — guida tecnica modulo Magazzino

Modulo tenant: tipicamente `magazzino` (minuscolo; verificare `tenant.modules`).

## Path standalone (relativi a `modules/magazzino/views/`)

| Pagina | File |
|--------|------|
| Home magazzino | `magazzino-home-standalone.html` |
| Hub carburante | `carburante-home-standalone.html` |
| Anagrafica prodotti | `prodotti-standalone.html` |
| Movimenti | `movimenti-standalone.html` |
| Tracciabilità consumi | `tracciabilita-consumi-standalone.html` |
| Archivio documenti | `documenti-acquisiti-standalone.html` |

## pageType / liste Tony

- **`prodotti`** — `prodotti-standalone.html`: `window.currentTableData`, evento `table-data-ready` con `detail.currentTableData`.
- **`movimenti`** — `movimenti-standalone.html`: stesso canone.
- **`carburante_hub`** — `carburante-home-standalone.html`: lista scorte per prodotto (gasolio, benzina, AdBlue), con `sottoScorta` per ogni prodotto; evento `table-data-ready`.
- **`tracciabilita_consumi`** — `tracciabilita-consumi-standalone.html`: items + opz. `consumiAggregates`; filtri **categoria**, **terreno**, **vista**, **reset**; vedi istruzioni **FILTER_TABLE** in `functions/index.js` (Tony avanzato).

## Navigazione intent

Target utili: `magazzino` (home), `carburante` (hub carburante), `prodotti`, `movimenti`, alias **tracciabilità consumi** / **tracciabilita consumi** / **consumi magazzino** → `tracciabilita-consumi-standalone.html`. Allineare a `functions/index.js` / `core/js/tony/engine.js`.

## Form Tony (Tony avanzato)

- **`prodotto-form`** / **`movimento-form`**: mapping in `core/config/tony-form-mapping.js`, injector in `core/js/tony-form-injector.js`; comandi **INJECT_FORM_DATA**, **OPEN_MODAL** `prodotto-modal` / `movimento-modal`; regole magazzino in `functions/index.js` (SAVE solo su conferma esplicita).
- **Carburante (movimenti)**: categoria `carburante`, origine `carico_cisterna` (entrata) o `pieno` (uscita + `macchinaId`). Validazione: `modules/magazzino/lib/carburante-movimento.js` (`validateMovimentoCarburante`, `parseCarburanteMovimentoQuery`). Query da hub: `?categoria=carburante&tipo=entrata` (carico) o `?categoria=carburante&tipo=uscita&pieno=1` (pieno).
- **Pieno in campo (versione mobile)**: `core/mobile/js/pieno-campo-ui.js` (scheda in field-workspace solo se `lavoroRichiedeRifornimento(lavoro)` — mezzo presente, non solo attrezzo). Cloud Function `registraPienoCampo` (`functions/registra-pieno-campo.js` + core in `functions/lib/registra-pieno-campo-core.js`): tenant, lavoroId, prodotto carburante, quantità, data → crea movimento uscita con origine `pieno` + `macchinaId` dal lavoro.

## Acquisizione documenti (foto → magazzino)

Ingresso 📷 chat (`document-capture.js`), non la lista archivio. CF `tonyExtractDocument`: due passate Gemini sui numeri; XML FatturaPA solo extra se il file è già quello. Save: `document-register.js` (bolla / fattura / scontrino). Originali: Storage + `documentiAcquisiti`. Vedi `GUIDA/TONY/tony/guida-tecnica.md` (stesso flusso, incluso HEIC/HEIF handling foto galleria iPhone).

## Riassunto Tony

- **`MAGAZZINO/utente/guida-sintesi.md`** → campo `guida_sintesi_magazzino` in `tony-service.js` (dedup primo turno come Core / Parco / Vigneto / Frutteto).

## Giacenza e accessi

- Aggiornamento giacenza movimenti: atomico con `FieldValue.increment` (`modules/magazzino/services/giacenza-utils.js` / `movimenti-service.js`) — evita race su carichi/scarichi concorrenti.
- Accesso modulo = pagato **o** trial attivo (`hasModuleAccessFromTenant` / `module-access-resolver.js`). Scarico da trattamenti/concimazioni (Vigneto/Frutteto) usa lo stesso gate: funziona anche con Magazzino **in prova**, non solo se già in abbonamento pagato (`trattamento-scarico-magazzino-service.js`).

## Permessi

Di solito Manager/Amministratore per modifiche sensibili; verificare su installazioni con ruoli custom.
