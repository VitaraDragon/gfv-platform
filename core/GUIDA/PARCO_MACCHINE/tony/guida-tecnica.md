# Parco Macchine — guida tecnica Tony

## Modulo

- **Id tenant:** `parcoMacchine` (vedi `AVAILABLE_MODULES` / `core/config`, contesto dashboard).
- **Senza questo id** in `tenants.modules`: nessuna voce **Parco Macchine** in **Moduli** (`dashboard-hub.js`); non documentare flussi macchina come disponibili.

## Tipi macchina e contatore

| Tipo | `tipoMacchina` | Contatore manutenzione | Helper |
|------|----------------|------------------------|--------|
| Agricolo | `trattore`, `attrezzo` | **Ore** (`oreIniziali`, `oreAttuali`, `oreProssimaManutenzione`) + data `prossimaManutenzione` | — |
| Flotta | `furgone`, `automezzo`, `veicolo` | **Km** (`kmIniziali`, `kmAttuali`, `kmProssimaManutenzione`) + date ammin. | `modules/parco-macchine/lib/macchine-tipo-utils.js` → `isTipoFlotta()`, soglie urgenza km |

**Revisione / assicurazione:** `prossimaRevisione`, `prossimaAssicurazione` — trattori e flotta (non attrezzi).

Modello: `modules/parco-macchine/models/Macchina.js` (`isFlotta()`, `isManutenzioneInScadenza` / `isManutenzioneScaduta` con ramo km).

## Pagine principali (standalone)

Percorsi relativi tipici dalla root repo / hosting:

| Pagina | File |
|--------|------|
| Hub Parco Macchine | `modules/macchine/views/macchine-dashboard-standalone.html` |
| Trattori | `modules/macchine/views/trattori-list-standalone.html` |
| Attrezzature | `modules/macchine/views/attrezzi-list-standalone.html` |
| Flotta | `modules/macchine/views/flotta-list-standalone.html` |
| Scadenze | `modules/macchine/views/scadenze-list-standalone.html` |
| Guasti / Officina | `modules/macchine/views/guasti-list-standalone.html` |
| Nuova segnalazione guasto | `core/admin/segnalazione-guasti-standalone.html` (link da elenco guasti) |
| Gestione macchine (anagrafica/manutenzioni) | `core/admin/gestione-macchine-standalone.html` |

**Gestione macchine — form dinamico:** gruppi ore vs km (`gruppo-contatore-ore` / `gruppo-contatore-km`, `gruppo-manutenzione-ore` / `gruppo-manutenzione-km`); tipo **Mezzo aziendale** + sottotipo flotta; logica save in `core/admin/js/gestione-macchine-events.js`.

## `currentTableData` / Tony contesto pagina

Le liste macchina aggiornano `window.currentTableData` e fanno merge su `Tony.setContext('page', …)` + evento `table-data-ready` (pattern canone liste).

| `pageType` | File lista | Campi items rilevanti |
|------------|------------|------------------------|
| `trattori` | `trattori-list-standalone.html` | `ore` |
| `attrezzi` | `attrezzi-list-standalone.html` | — |
| `flotta` | `flotta-list-standalone.html` | `km` (non `ore`) |
| `scadenze` | `scadenze-list-standalone.html` | `tipoScadenza` include **Tagliando (km)**; rinnovo `tipoValore`: `data` \| `ore` \| `km` |
| `guasti` | `guasti-list-standalone.html` | — |

**Nota:** `gestione-macchine-standalone.html` espone tabella admin; Tony legge contesto hub/liste/scadenze più che il form admin completo.

## Scadenze — build lato client

`scadenze-list-standalone.html` → `buildScadenze()`: per flotta (`isTipoFlotta`) riga **Tagliando (km)** se `kmProssimaManutenzione`; per agricoli riga **Manutenzione (ore)** se `oreProssimaManutenzione`; revisione/assicurazione per data.

Widget dashboard **In arrivo:** `core/js/dashboard-deadlines.js` — `calcolaUrgenzaKm` per flotta, `calcolaUrgenzaOre` per agricoli. Briefing: `core/js/dashboard-tony-briefing-text.js`.

## Navigazione Tony (`APRI_PAGINA`)

Target utili già in uso nel sistema istruzioni: **`macchine`**, **`gestione macchine`** (normalizzazione in `tony-service.js` / widget). Per guasti segnalazione: pagina **guasti** / amministrazione se mappata; allineare ai target effettivi del widget se si aggiungono alias.

**Form Tony:** Gestione macchine / tagliando km **non** ancora in `tony-form-mapping.js` — compila manuale o via pagina Scadenze (rinnovo).

## Integrazioni

- **Diario attività** (`core/attivita-standalone.html`): se modulo attivo, campi opzionali `macchinaId` / `attrezzoId` / `oreMacchina` (vedi strategia `STRATEGIA_MODULO_MACCHINE_CORE.md`) — solo trattori/attrezzi.
- **Manodopera:** stesse anagrafiche mezzi; non duplicare dati.
- **Simulatore:** `simulator/lib/seed-parco-macchine-details.js` — flotta seed con km; backfill migra ore legacy → km.

## Guida utente e sintesi Tony

- Testo esteso: `PARCO_MACCHINE/utente/guida.md`
- Riassunto per contesto dopo il primo messaggio: `PARCO_MACCHINE/utente/guida-sintesi.md` → campo `guida_sintesi_parco_macchine` in `tony-service.js`

## Fonti codice

- `modules/macchine/views/*.html`
- `modules/parco-macchine/models/Macchina.js`, `modules/parco-macchine/lib/macchine-tipo-utils.js`
- `core/admin/gestione-macchine-standalone.html`, `core/admin/js/gestione-macchine-*.js`
- `core/admin/segnalazione-guasti-standalone.html`
- `docs-sviluppo/STRATEGIA_MODULO_MACCHINE_CORE.md`
