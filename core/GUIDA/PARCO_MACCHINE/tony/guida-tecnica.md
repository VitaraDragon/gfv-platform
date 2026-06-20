# Parco Macchine — guida tecnica Tony

## Modulo

- **Id tenant:** `parcoMacchine` (vedi `AVAILABLE_MODULES` / `core/config`, contesto dashboard).
- **Senza questo id** in `tenants.modules`: nessuna voce **Parco Macchine** in **Moduli** (`dashboard-hub.js`); non documentare flussi macchina come disponibili.

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

## `currentTableData` / Tony contesto pagina

Le liste macchina aggiornano `window.currentTableData` e fanno merge su `Tony.setContext('page', …)` + evento `table-data-ready` (pattern canone liste).

| `pageType` | File lista |
|------------|------------|
| `trattori` | `trattori-list-standalone.html` |
| `attrezzi` | `attrezzi-list-standalone.html` |
| `flotta` | `flotta-list-standalone.html` |
| `scadenze` | `scadenze-list-standalone.html` |
| `guasti` | `guasti-list-standalone.html` |

**Nota:** `gestione-macchine-standalone.html` può non esporre lo stesso pattern tabella; verificare su codice se serve estendere.

## Navigazione Tony (`APRI_PAGINA`)

Target utili già in uso nel sistema istruzioni: **`macchine`**, **`gestione macchine`** (normalizzazione in `tony-service.js` / widget). Per guasti segnalazione: pagina **guasti** / amministrazione se mappata; allineare ai target effettivi del widget se si aggiungono alias.

## Integrazioni

- **Diario attività** (`core/attivita-standalone.html`): se modulo attivo, campi opzionali `macchinaId` / `attrezzoId` / `oreMacchina` (vedi strategia `STRATEGIA_MODULO_MACCHINE_CORE.md`).
- **Manodopera:** stesse anagrafiche mezzi; non duplicare dati.

## Guida utente e sintesi Tony

- Testo esteso: `PARCO_MACCHINE/utente/guida.md`
- Riassunto per contesto dopo il primo messaggio: `PARCO_MACCHINE/utente/guida-sintesi.md` → campo `guida_sintesi_parco_macchine` in `tony-service.js`

## Fonti codice

- `modules/macchine/views/*.html`
- `core/admin/gestione-macchine-standalone.html`
- `core/admin/segnalazione-guasti-standalone.html`
- `docs-sviluppo/STRATEGIA_MODULO_MACCHINE_CORE.md`
