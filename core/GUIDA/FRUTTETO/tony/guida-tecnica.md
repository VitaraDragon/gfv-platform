# Tony — guida tecnica modulo Frutteto

Modulo tenant: tipicamente `frutteto` (minuscolo; verificare `tenant.modules`).

## Path standalone (relativi a `modules/frutteto/views/`)

| Pagina | File |
|--------|------|
| Dashboard frutteto | `frutteto-dashboard-standalone.html` |
| Anagrafica frutteti | `frutteti-standalone.html` |
| Raccolta frutta | `raccolta-frutta-standalone.html` |
| Potatura | `potatura-standalone.html` |
| Trattamenti | `trattamenti-standalone.html` |
| Concimazioni | `concimazioni-standalone.html` |
| Statistiche | `frutteto-statistiche-standalone.html` |



## Page JS (dopo extract in modulo)

Logica pagina e wiring Tony (`currentTableData` / form) vivono in `modules/frutteto/js/` (non più in shared monolitico per queste viste):

- `frutteti-page.js` (anagrafica frutteti)
- `frutteto-dashboard-page.js` (dashboard frutteto)
- `frutteto-statistiche-page.js` (statistiche)
- `raccolta-page.js` (raccolta frutta)
- `trattamenti-page.js`
- `concimazioni-page.js`
- `potatura-page.js`

Le view in `modules/frutteto/views/` restano struttura HTML (dove serve, Google Maps resta nell'HTML) e caricano il JS con `<script type="module" src="../js/<pagina>-page.js">`.

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

## Pianificazione e calcolo materiali (condivisi con Vigneto)

Il JS sta nel modulo vigneto; la view frutteto lo carica con `?coltura=frutteto`:

- `../../vigneto/views/pianifica-impianto-standalone.html?coltura=frutteto` — `modules/vigneto/js/pianifica-impianto-page.js`
- `../../vigneto/views/calcolo-materiali-standalone.html?coltura=frutteto` — `modules/vigneto/js/calcolo-materiali-page.js`

## pageType / liste Tony

- **`concimazioni_frutteto`** — `modules/frutteto/js/concimazioni-page.js` (caricato da `concimazioni-standalone.html`, che imposta solo il placeholder) aggiorna `window.currentTableData` ed emette `table-data-ready`.

Anagrafica, dashboard, statistiche e raccolta non espongono ancora `currentTableData` per Tony.

## Terreni (core) → modulo

- `core/terreni-standalone.html`: `gestisciFrutteto(terrenoId)` → `modules/frutteto/views/frutteti-standalone.html?terrenoId=…` (anagrafica).

## Navigazione intent

Target utili: `frutteto`, `frutteti`, `statistiche frutteto`, `raccolta frutta`, `potatura frutteto`, `trattamenti frutteto`, `calcolo materiali frutteto`, `pianificazione impianto frutteto` — allineare a `functions/index.js` / mappa `core/js/tony/engine.js` (procedura utente: **Dashboard Frutteto**, non dashboard vigneto).

## Riassunto Tony

- **`FRUTTETO/utente/guida-sintesi.md`** → campo `guida_sintesi_frutteto` in `tony-service.js` (dedup primo turno come Core / Parco / Vigneto).

## Permessi

`frutteto-statistiche-standalone.html` può restringere a Manager/Amministratore; la dashboard frutteto in campione non replica lo stesso blocco del vigneto: verificare su altre viste.
