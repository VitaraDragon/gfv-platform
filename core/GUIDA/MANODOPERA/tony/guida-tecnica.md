# Tony — guida tecnica modulo Manodopera

Modulo in **`dashboard.moduli_attivi`** (chiave tipica `manodopera`). In contesto serializzato può comparire come elenco moduli dell’**azienda** corrente.

## Path standalone (relativi a `core/` e `core/admin/`)

| Area | File |
|------|------|
| Versione mobile campo | `mobile/field-workspace-standalone.html` |
| Segnatura ore (desktop) | `segnatura-ore-standalone.html` |
| Validazione ore | `admin/validazione-ore-standalone.html` |
| I miei lavori (dettaglio / zone) | `admin/lavori-caposquadra-standalone.html` |
| Statistiche manodopera (manager) | `admin/statistiche-manodopera-standalone.html` |
| Gestione squadre | `admin/gestione-squadre-standalone.html` |
| Gestione operai | `admin/gestione-operai-standalone.html` |
| Compensi operai | `admin/compensi-operai-standalone.html` |
| Statistiche lavoratore (embed mobile) | `mobile/statistiche-lavoratore-standalone.html` |

`page.pagePath` è il pathname corrente (es. contiene `field-workspace`, `segnatura-ore`, `validazione-ore`, `gestione-operai`, …).

## Versione mobile (`field-workspace-standalone.html`)

- `window.currentTableData.pageType`: **`field_workspace`**; evento `table-data-ready` come da canone liste dove implementato.
- **Caposquadra:** slide visibili — `Lavoro`, `Comunicazioni` (classe `capo-only`), `Ore`, `Statistiche`; ordine swiper dopo init: Lavoro → Comunicazioni → Ore → Statistiche.
- **Operaio:** nascosta slide `Comunicazioni`; nascoste sezioni inline **La mia squadra** e **Valida ore** sullo slide Lavoro.
- Iframe dettaglio lavoro: `../admin/lavori-caposquadra-standalone.html?ws=classic&focusLavoroId=<id>&embed=mobile`.
- Comunicazioni caposquadra: collection `comunicazioni` con `destinatari`, `lavoroId`, `messaggio`, `data`, `orario`, `source: 'mobile_field_workspace'`.
- Ore inline: subcollection `lavori/{lavoroId}/oreOperai`, stato tipico **`da_validare`** dopo salvataggio operaio.

## Target motore (`core/js/tony/engine.js`)

Alias: **segnatura ore** / **segnare ore**, **validazione ore** / **validare ore**, **lavori caposquadra** / **i miei lavori**, **statistiche manodopera** / **statistiche ore**, **gestione squadre** / **squadre**, **gestione operai** / **operai**, **compensi operai** / **compensi**, **manodopera** (hub → gestione operai in mapping storico).

## pageType / Tony

- **`lavori`** — gestione lavori manager.  
- **`field_workspace`** / **`lavori_caposquadra`** — `_resolveFieldWorkspaceTableDataForEnumerate` in `tony-service.js`.

## Form Tony (avanzato)

- **Segnatura ore:** `ora-modal`, mapping **ora**; su versione mobile form inline `quick-hours-form` / contesto `field-workspace-ore-form` in mapping.
- **Lavori:** `lavoro-form` / checklist (assegnazioni squadra/autonomo).

## Guide utente per ruolo

- `MANODOPERA/utente/guida.md` (indice), `guida-manager.md`, `guida-caposquadra.md`, `guida-operaio.md`.

## Riassunto contesto client

- **`MANODOPERA/utente/guida-sintesi.md`** → **`context.guida_sintesi_manodopera`** (`tony-service.js`, dedup primo turno).
