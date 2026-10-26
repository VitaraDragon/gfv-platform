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



## Page JS (dopo extract in modulo)

Logica pagina e wiring Tony (`currentTableData` / form) vivono in `modules/vigneto/js/` (non più in shared monolitico per queste viste):

- `vigneti-page.js` (anagrafica vigneti)
- `vendemmia-page.js`
- `trattamenti-page.js`
- `concimazioni-page.js`
- `potatura-page.js`
- `vigneto-dashboard-page.js` (dashboard vigneto)
- `vigneto-statistiche-page.js` (statistiche)
- `calcolo-materiali-page.js` (calcolo materiali; stesso file per il frutteto con `?coltura=frutteto`)
- `pianifica-impianto-page.js` (pianificazione impianto; stesso file per il frutteto con `?coltura=frutteto`)

Le view in `modules/vigneto/views/` restano struttura HTML (dove serve, Google Maps resta nell'HTML) e caricano il JS con `<script type="module" src="../js/<pagina>-page.js">`.

Trattamenti vigneto/frutteto condividono meccanica in `shared/js/trattamenti-coltura-page.js`.

## Registro privato trattamenti (#208/#210)

Meccanica condivisa vigneto / frutteto / seminativo in `shared/js/trattamenti-coltura-page.js` + `shared/js/registro-trattamenti*.js` (pagine `trattamenti-page.js` del modulo).

- **Testata:** frase `NOTA_REGISTRO_PRIVATO` («Registro privato di compilazione… GFV non invia il file al SIAN né al fascicolo.»), pulsanti `#btn-export-registro-csv` / `#btn-export-registro-xml` (`esportaRegistro`: righe con trattamento di `listRows` + dati azienda dal tenant → `registro-trattamenti.csv|xml`, toast «Export del registro privato scaricato. GFV non lo invia al SIAN.»).
- **Riga prodotto:** `htmlMetaRegistro` («Scheda non confermata» / «Confermato: avversità», pulsante `.btn-leggi-scheda` «Leggi scheda», JSON riga in `.registro-json`). Esito in `#registro-scheda-esito`. `attaccaMenuScheda`: con fitofarmaco in anagrafica a `letturaSchedaStato: 'pronta'` → `vociMenuScheda` per la specie (righe impieghi lette dal server, `leggiRigheSchedaProdotto`) con pulsanti **Conferma**; scheda oltre sei mesi → `chiediRiletturaScheda` (scrive `letturaSchedaRichiestaAt`) e niente dose; non letta → nessun controllo massimo/intervallo. `attaccaLetturaScheda` (Leggi scheda) → callable `leggiSchedaRegistroTrattamento` (`functions/registro-trattamenti-scheda.js`): righe «avversità — carenza N giorni», eventuale «Conferma già data per…», o «Solo anagrafica: … n. …». Conferma → `unisciConfermaSpecie` salvata anche sul prodotto (`confermeSpecie`). Mai valori inventati: specie non mappata, scheda illeggibile o prodotto assente → solo messaggio.
- **Specie:** `core/config/registro-trattamenti-specie.js` — vigneto da `destinazioneUva` (`vino` → vite da vino, `vendita_uva` → vite da tavola, `misto` → null), frutteto da specie (`Kiwi` → actinidia, `Altro` → null), seminativo da coltura campagna (`Grano` → frumento); alias in `ALIAS_COLTURA_SCHEDA`.
- **Campi form:** `trattamento-giorni-carenza` (placeholder «Dalla riga confermata, altrimenti dall'anagrafica»), `#registro-nota`, `trattamento-acqua-hl-ha` / `trattamento-acqua-hl-tot` (`bindAcquaCampi`, l’uno dall’altro con la superficie). Mapping Tony: acqua in `tony-form-mapping.js`; numero di registrazione, principio attivo, avversità e carenza **non** si chiedono a voce e non si inventano (li conferma l’azienda dalla lettura pubblica). `tony-form-injector.js` conserva i campi registro della riga (`principioAttivo`, `avversita`, `specieUsata`, `impieghiMassimiAnno`, `giorniMinimiTraPassaggi`, …).
- **Salvataggio:** dopo `validaDosaggiProdotti`, `messaggiAvvisoForm` / `avvisoImpieghiEIntervallo` (non bloccanti: scheda non confermata, numero massimo impieghi nell’anno, intervallo minimo tra passaggi, diluizione) → `confirm(… «Salvare comunque?»)`. Modelli `TrattamentoVigneto` / `TrattamentoFrutteto` / `SeminativoTrattamento` con acqua e righe registro.
- **Cancellazione:** `valutaCancellazioneRegistro` — confermato con meno di tre anni (`ANNI_CONSERVAZIONE_REGISTRO`) richiede la conferma «Confermo di avere già esportato il registro.» (`exportConfermato`); i movimenti di magazzino restano; la riga torna «da completare».
- **Miscela del lavoro:** `lavoro.miscelaPrevista` da Gestione lavori (vedi `GUIDA/MANODOPERA/tony/guida-tecnica.md`, Form Tony → Miscela prevista).
- **Deploy:** callable `leggiSchedaRegistroTrattamento`, trigger `onProdottoSchedaScritto` e schedulato `leggiSchedeRegistroInCoda` sono nel repo; al merge su develop non risultavano pubblicati su Firebase (PR #208/#210): finché non partono, Leggi scheda e la lettura in coda non leggono il Ministero.

## pageType / Tony liste

- **`vendemmia`** — `modules/vigneto/js/vendemmia-page.js` (caricato da `vendemmia-standalone.html`) aggiorna `window.currentTableData` ed emette `table-data-ready`.
- **`concimazioni_vigneto`** — `modules/vigneto/js/concimazioni-page.js` imposta il placeholder e poi aggiorna `window.currentTableData` (canone liste).

Dashboard, statistiche, calcolo materiali e pianificazione impianto non espongono ancora `currentTableData`: non presumere items tabella su quelle viste, né su trattamenti/potatura.

## Contesto dashboard principale

Ingresso utente: pulsante moduli (graffetta in alto a sinistra) → **Vigneto** (`vigneto` in `MODULE_CATALOG` / `core/js/dashboard-hub.js`). Riquadro modulo in fondo pagina solo senza Manodopera (`core/js/dashboard-sections.js`).

Con modulo attivo, `core/dashboard-standalone.html` può arricchire il contesto Tony con riepilogo produzione/vigneti (`setContext('vigneto', …)` via `vigneto-statistiche-service`).

## Terreni (core) → modulo

- `core/terreni-standalone.html`: `gestisciVigneto(terrenoId)` → `modules/vigneto/views/vigneti-standalone.html?terrenoId=…`; `gestisciFrutteto` → `frutteti-standalone.html?terrenoId=…` (anagrafica, non dashboard).

## Navigazione intent

Target utili (mappa comandi cloud): `vigneto`, `vigneti`, `statistiche vigneto`, `vendemmia`, `potatura vigneto`, `trattamenti vigneto` — allineare alla mappa `functions/index.js` / istruzioni sistema se si aggiungono sinonimi.

## Riassunto Tony

- **`VIGNETO/utente/guida-sintesi.md`** → campo `guida_sintesi_vigneto` in `tony-service.js` (stessa dedup del primo turno rispetto a `guida_app`).

## Permessi

`vigneto-dashboard-standalone.html` restringe l’accesso a ruoli che includono Manager o Amministratore; altre viste possono avere regole diverse.
