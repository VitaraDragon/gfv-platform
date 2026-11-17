# Tony — guida tecnica modulo Seminativo

Modulo tenant: tipicamente `seminativo` (minuscolo; verificare `tenant.modules`).

La superficie del terreno, se cambia, si copia su `superficieEttari` delle campagne correnti e future (`seminativi`), non sulle passate e non sui registri già salvati (`superficieTrattata`). Niente terreni archiviati in tendina.

## Path standalone (relativi a `modules/seminativo/views/`)

| Pagina | File |
|--------|------|
| Dashboard seminativo | `seminativo-dashboard-standalone.html` |
| Anagrafica appezzamenti (campagne) | `seminativi-standalone.html` |
| Piano colturale | `piano-colturale-standalone.html` |
| Semina | `semina-standalone.html` |
| Lavorazioni terreno | `lavorazioni-standalone.html` |
| Trattamenti | `trattamenti-standalone.html` |
| Concimazioni | `concimazioni-standalone.html` |
| Raccolta / mietitura | `raccolta-standalone.html` |
| Statistiche | `seminativo-statistiche-standalone.html` |

## Collezioni Firestore

- `tenants/{tenantId}/seminativi` — anagrafica campagne (terreno + coltura + varietà + anno)
- `tenants/{tenantId}/semineSeminativo` — eventi di semina
- `tenants/{tenantId}/trattamentiSeminativo` — dati prodotto su lavoro o diario (trattamenti)
- `tenants/{tenantId}/raccolteSeminativo` — quintali su lavoro o diario (raccolte/mietitura)

## pageType / liste Tony

Dove esposto `window.currentTableData` ed emesso `table-data-ready`, Tony può leggere liste come utente (verificare pagina per pagina se presente). Esempi di `pageType` dove probabilmente mappati:

- `seminativi` — anagrafica appezzamenti/campagne
- `piano_colturale_seminativo` — piano colturale
- `semina_seminativo` — semine
- `lavorazioni_seminativo` — lavorazioni terreno
- `trattamenti_seminativo` — trattamenti
- `concimazioni_seminativo` — concimazioni
- `raccolta_seminativo` — raccolte/mietitura
- `statistiche_seminativo` — statistiche

Verificare in `core/config/tony-form-mapping.js` e `functions/index.js` se presenti mapping per form e comandi `FILTER_TABLE`.

## Terreni (core) → modulo

- `core/terreni-standalone.html`: icona **grano** (🌾) → `modules/seminativo/views/seminativi-standalone.html?terrenoId=…` (anagrafica campagne per quel terreno).

## Navigazione intent

Target utili: `seminativo`, `seminativi`, `anagrafica appezzamenti`, `piano colturale`, `semina seminativo`, `lavorazioni seminativo`, `trattamenti seminativo`, `concimazioni seminativo`, `raccolta seminativo`, `statistiche seminativo` — allineare a `functions/index.js` / mappa `core/js/tony/engine.js` (procedura utente: **Dashboard Seminativo**, non dashboard vigneto/frutteto).

## Riassunto Tony

- **`SEMINATIVO/utente/guida-sintesi.md`** → campo `guida_sintesi_seminativo` in `tony-service.js` (dedup primo turno come Core / Parco / Vigneto / Frutteto / Magazzino / Manodopera / Conto Terzi / Meteo).

## Hub e configurazione

- `modules/seminativo/config/seminativo-hub.js`: `SEMINATIVO_HUB_CARDS` definisce le card della dashboard (id, title, description, icon, href, tonyTarget, pageType).
- Colori modulo: `SEMINATIVO_ACCENT = '#C9A227'`, `SEMINATIVO_ACCENT_DARK = '#8D6E00'` (giallo).

## Registro privato trattamenti (#208/#210)

Meccanica condivisa vigneto / frutteto / seminativo in `shared/js/trattamenti-coltura-page.js` + `shared/js/registro-trattamenti*.js` (pagine `trattamenti-page.js` del modulo).

**Mostra archiviati e schede (#349):** `modules/seminativo/js/trattamenti-page.js` riempie `#filter-terreno` con `terreniPerFiltro(terreni, mostraArchiviatiSelezionato())` (`shared/js/filtri-storico.js`; `#filter-mostra-archiviati` spento all’inizio, al change `populateFilters` + `applyFilters`); clic lista con `bindAzioniLista` su `.table-container` (Modifica/Completa/Elimina anche sulle schede da telefono), apertura con `apriConAvviso` → alert «Non riesco ad aprire il trattamento.» o il motivo. Test `tests/trattamenti-schede-archiviati.test.js`.

- **Testata:** frase `NOTA_REGISTRO_PRIVATO` («Registro privato di compilazione… GFV non invia il file al SIAN né al fascicolo.»), pulsanti `#btn-export-registro-csv` / `#btn-export-registro-xml` (`esportaRegistro`: righe con trattamento di `listRows` + dati azienda dal tenant → `registro-trattamenti.csv|xml`, toast «Export del registro privato scaricato. GFV non lo invia al SIAN.»).
- **Riga prodotto:** `htmlMetaRegistro` («Scheda non confermata» / «Confermato: avversità», pulsante `.btn-leggi-scheda` «Leggi scheda», JSON riga in `.registro-json`). Esito in `#registro-scheda-esito`. `attaccaLetturaScheda` (`shared/js/registro-trattamenti-form.js`) → callable `leggiSchedaRegistroTrattamento` (`functions/registro-trattamenti-scheda.js`, client `shared/js/registro-trattamenti-scheda-client.js`): legge **solo** il CSV open data del Ministero della Salute (pagina dataset dati.salute.gov.it, cache in memoria istanza 6 ore, niente Firestore, **nessuna lettura SIAN** dal #415). Se il campo prodotto contiene solo cifre (`numeroDalCampoProdotto`) il form manda anche `numero`/`numeroRegistrazione`: `chiaveRicercaScheda` accetta nome o numero, `normalizzaNumeroRegistrazione` toglie gli zeri iniziali (`002513` = `2513`, `0` resta `0`), `trovaRegistrazioneUnica` per numero trova anche i revocati (#418). Risposta: `prodotti[]`, `proposto` (se l’unico nome esatto è revocato e c’è un prodotto ancora in commercio con lo stesso nome base), `dataLettura`, `fonte`; `htmlPannelloOpenData` mostra avviso «l’etichetta fa fede» (`AVVISO_ETICHETTA_FA_FEDE`), attribuzione IODL (`htmlAttribuzioneOpenData`), elenco **Scegli** se più prodotti, `classificaStatoAmministrativo` (autorizzato / revocato / scaduto / sospeso / non_verificato) con banner rosso e `data-conferma-bloccata` per i non in commercio, altrimenti `campiManuali` (coltura, avversità, dose ha/hl, carenza, numero massimo, intervallo: **scritti dall’azienda**, `registroConfermaManuale`). Non trovato → link `URL_BANCA_FITOSANITARI`; errore → «Gli open data non si leggono…». Righe di impiego del server **non** si usano più (nessun menu impieghi, nessuna rilettura a sei mesi). Conferma → `unisciConfermaSpecie` + `salvaSuProdotto` (`confermeSpecie`, `titolare`, `statoAmministrativoScheda`). Mai valori inventati.
- **Specie (coltura precompilata, non più «coltura della scheda SIAN»):** `core/config/registro-trattamenti-specie.js` — vigneto da `destinazioneUva` (`vino` → vite da vino, `vendita_uva` → vite da tavola, `misto` → null), frutteto da specie (`Kiwi` → actinidia, `Altro` → null), seminativo da coltura campagna (`Grano` → frumento), orticole da `MAPPA_COLTURA_ORTICOLE` (`colturaSchedaOrticole`); alias in `ALIAS_COLTURA_SCHEDA`.
- **Campi form:** `trattamento-giorni-carenza` (placeholder «Dalla riga confermata, altrimenti dall'anagrafica»), `#registro-nota`, `trattamento-acqua-hl-ha` / `trattamento-acqua-hl-tot` (`bindAcquaCampi`, l’uno dall’altro con la superficie). Mapping Tony: acqua in `tony-form-mapping.js`; numero di registrazione, principio attivo, avversità e carenza **non** si chiedono a voce e non si inventano (li conferma l’azienda dalla lettura pubblica). `tony-form-injector.js` conserva i campi registro della riga (`principioAttivo`, `avversita`, `specieUsata`, `impieghiMassimiAnno`, `giorniMinimiTraPassaggi`, …).
- **Salvataggio:** dopo `validaDosaggiProdotti`, `messaggiAvvisoForm` / `avvisoImpieghiEIntervallo` (non bloccanti: scheda non confermata, numero massimo impieghi nell’anno, intervallo minimo tra passaggi, diluizione) → `confirm(… «Salvare comunque?»)`. Modelli `TrattamentoVigneto` / `TrattamentoFrutteto` / `SeminativoTrattamento` con acqua e righe registro.
- **Cancellazione:** `valutaCancellazioneRegistro` — confermato con meno di tre anni (`ANNI_CONSERVAZIONE_REGISTRO`) richiede la conferma «Confermo di avere già esportato il registro.» (`exportConfermato`); i movimenti di magazzino restano; la riga torna «da completare».
- **Miscela del lavoro:** `lavoro.miscelaPrevista` da Gestione lavori (vedi `GUIDA/MANODOPERA/tony/guida-tecnica.md`, Form Tony → Miscela prevista).
- **Deploy:** resta la sola callable `leggiSchedaRegistroTrattamento`; trigger `onProdottoSchedaScritto` e schedulato `leggiSchedeRegistroInCoda` sono stati **tolti** (#415, `functions/registro-trattamenti-lettura.js` eliminato). `functions/scripts/sync-notification-modules.cjs` copia `shared/js/registro-trattamenti-fonte.js` in `functions/lib/registro-trattamenti-fonte.mjs` (testi fonte/licenza). Test: `tests/registro-trattamenti-csv.test.js` (ricerca sul CSV, per numero, esito nel form, semaforo, `valoreInputNumerico`), `tests/nessun-sian-in-produzione.test.js`.

## Differenza da vigneto/frutteto

- **Campagna annuale**: ogni record anagrafica = terreno + coltura + varietà + anno (no impianto permanente pluriennale).
- **Rotazione**: piano colturale propone la coltura successiva per lo stesso terreno nell'anno futuro.
- **Registri**: stessa logica di trattamenti/concimazioni (lavoro → completamento nel modulo), ma riferiti a campagna annuale, non a impianto permanente.
- **CTA Diario vs lavoro:** `applyDiarioVsLavoroCta` in `lavorazioni-page.js`, `trattamenti-page.js` (anche **Concimazioni** via `initConcimazioniPage`) e `raccolta-page.js` — con Manodopera mostra **Nuovo lavoro**, senza **Registra nel diario**.
- **Resa**: resa prevista in anagrafica (qli/ha stimati); resa effettiva calcolata dalle raccolte registrate (statistiche).

## Permessi

Verificare su singole pagine (`seminativo-statistiche-standalone.html` può restringere a Manager/Amministratore; anagrafica e registri probabilmente più permissivi).
