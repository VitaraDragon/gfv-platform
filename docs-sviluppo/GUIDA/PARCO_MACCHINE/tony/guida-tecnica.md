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

## Capacità botte (#208)

Attrezzi: campo facoltativo `capacitaBotteQuintali` (`Macchina.js`, validazione > 0, messaggio «La capacità della botte, se indicata, è in quintali e deve essere maggiore di zero»). Form: `#capacitaBotteQuintali` in `modules/macchine/views/attrezzi-list-standalone.html` (creazione rapida) e `#macchina-capacita-botte` (gruppo `#campo-capacita-botte-group`, visibile solo per `attrezzo`) in `core/admin/gestione-macchine-standalone.html`; dettaglio «Botte (q)». Usata da `componiMiscelaDalForm` in Gestione lavori per `miscelaPrevista` (botti piene, dose a botte piena, ultima botte).

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
| Nuova segnalazione guasto | `core/admin/segnalazione-guasti-standalone.html` (rules #217: il segnalatore aggiorna solo con stato `in-attesa`; delete solo manager; #221: «Risolto da me» / «Annulla segnalazione» con ripristino mezzi; #225: dopo la chiusura `aggiornaOpzioniDaGuasti` in `core/js/macchina-selezionabile.js` rende di nuovo selezionabile il mezzo senza ricaricare; #235: lavoro predefinito `scegliLavoroPredefinitoGuasto` (`?lavoroId=` dal campo, poi in corso, già iniziato più recente, futuro più vicino, sospeso) e mezzi `mezziDaLavoroGuasto` anche al cambio lavoro; Grave sospende il lavoro solo per manager, caposquadra del lavoro di squadra o operaio (ruolo `operaio`) sul proprio lavoro autonomo; un caposquadra sul proprio lavoro autonomo non sospende; altrimenti banner «Il lavoro lo sospende il caposquadra o il manager.»; vedi `MANODOPERA/tony/guida-tecnica.md` § Slide Guasto) (link da elenco guasti; dal campo incorporata nella slide «⚠️ Segnala un problema» con `?from=field&embed=1`, generica anche senza questo modulo) |
| Gestione macchine (anagrafica/manutenzioni) | `core/admin/gestione-macchine-standalone.html` |

**Gestione macchine — form dinamico:** gruppi ore vs km (`gruppo-contatore-ore` / `gruppo-contatore-km`, `gruppo-manutenzione-ore` / `gruppo-manutenzione-km`); tipo **Mezzo aziendale** + sottotipo flotta; logica save in `core/admin/js/gestione-macchine-events.js`.

**Stati guasto (#221):** `core/services/guasto-stati.js` — `STATI_GUASTO_CHIUSI = ['risolto','annullato','riparato','chiuso']`, `normalizzaStatoGuasto` (vuoto → `in-attesa`), `isGuastoNonDeciso`, `isGuastoChiuso` / `isGuastoAttivo` (stato sconosciuto = attivo), `chiaveBadgeStatoGuasto` (`riparato`/`chiuso` → badge risolto, sconosciuto → valore grezzo). Usati da `guasti-list-standalone.html` (badge Annullato / Continuazione approvata, filtro Solo aperti, «Segna risolto» se `isGuastoAttivo`, «Riprendi lavoro» con `mostraRiprendiLavoro` = guasto chiuso, anche annullato), `macchine-dashboard-standalone.html` (conteggio guasti aperti), `core/admin/gestione-guasti-standalone.html` (filtro e badge `annullato`, statistiche solo attivi, nessuna azione sugli annullati, «Riapri Guasto» solo sui risolti), `core/admin/js/gestione-macchine-events.js` (`loadStoricoGuasti`, badge 🚫 Annullato), `core/js/dashboard-data.js` (`loadGuastiApertiCount`), `core/js/dashboard-tony-briefing-text.js`, `core/services/lavoro-ripresa-guasto.js`. «Segna risolto» di `guasti-list-standalone.html` ora in `runTransaction` (se già chiuso: «Questo guasto è già stato chiuso.»), voce storico `chiuso_manager`, ripristino mezzi con `mezziDaRipristinare` / `statoRipristinoMezzo` / `altroGuastoAttivoSulMezzo` (`core/services/guasto-ripristino.js`, scrive solo `stato` + `updatedAt`, `in_uso` mai `in-uso`); errore mezzo → avviso «Guasto risolto, ma non ho potuto aggiornare lo stato del mezzo: controllalo in Parco macchine.». Il «Risolvi Guasto» di `gestione-guasti-standalone.html` usa ancora la logica vecchia (solo `macchinaId`, `in-uso`, lavoro → `attivo`).

**Nessun avviso sui guasti:** alla creazione di un guasto (anche `grave`) non parte nessuna notifica né push né messaggio a caposquadra o manager (nessun trigger su `guasti` in `functions/`). Il manager lo vede solo come contatore: `loadGuastiApertiCount` (`core/js/dashboard-data.js`) → riga «N guasto/i aperti sul parco macchine.» in **Richiede attenzione** (`dashboard-hub.js`), badge `guastiAperti` della scorciatoia «Guasti» (`dashboard-quick-bar.js`), briefing Tony in dashboard, panoramica hub e `guasti-list-standalone.html` (che fa anche dire a Tony «Ti ricordo che ci sono N guasti aperti…»). Il contatore non distingue i gravi. **Attenzione:** il prompt del sub-agente Meccanico in `functions/index.js` (sezione GRAVITÀ DEL GUASTO) dice ancora «Il manager riceve notifica prioritaria» e parla di «notifica corretta» nel pannello: non è vero oggi. Tony non deve promettere notifiche o avvisi per i guasti.

**Pagina legacy `core/admin/gestione-guasti-standalone.html` («Gestione Guasti»):** non è nei menu; si raggiunge solo dal target Tony `gestione guasti admin` (`core/config/tony-routes.json`). Ha logica vecchia («Risolvi Guasto», «Riapri Guasto», approva continuazione / sospendi). Tony **non** deve indirizzarci gli utenti per chiudere un guasto: il manager chiude con «Segna risolto» in **Officina & Guasti** (`guasti-list-standalone.html`; i target `guasti`, `gestione guasti`, `elenco guasti` di `core/js/tony/engine.js` aprono già questa). Nelle guide utente la pagina legacy non si descrive. Guasto annullato: non si riapre, serve una nuova segnalazione. In **Officina & Guasti** il manager vede il badge Annullato, non il motivo dell’annullo; «Risolto da me» chiude subito il guasto, senza passaggi del manager.

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

Target utili già in uso nel sistema istruzioni: **`macchine`**, **`gestione macchine`** (normalizzazione in `tony-service.js` / widget). Per guasti: target **`guasti`** (o `gestione guasti` / `elenco guasti`) → **Officina & Guasti**; non usare `gestione guasti admin` (pagina legacy, vedi sopra) per far chiudere un guasto. Allineare ai target effettivi del widget se si aggiungono alias.

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
