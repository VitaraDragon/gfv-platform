# Tony — guida tecnica modulo Frutteto

Modulo tenant: tipicamente `frutteto` (minuscolo; verificare `tenant.modules`).

Tendina terreno: solo terreni attivi la cui coltura è da frutto (`isTerrenoFrutteto`). In modifica resta il terreno già collegato. Non proporre frutteti `chiuso` né terreni archiviati. Il poligono del terreno non è obbligatorio.

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

**Schede e Mostra archiviati (#349):** `shared/js/filtri-storico.js` — `bindAzioniLista(container, { onEdit, onCompleta, onDelete, onError })` delega i clic `[data-edit-row]` / `[data-completa-row]` / `[data-delete-row]` sul contenitore della lista (`.table-container`), così rispondono anche le schede della pelle Proposta sul telefono; `apriConAvviso` mostra `messaggioAperturaTrattamento(err)` (default `MESSAGGIO_APERTURA_TRATTAMENTO` «Non riesco ad aprire il trattamento.») se l’apertura del modulo fallisce. Checkbox `#filter-mostra-archiviati` (spenta all’inizio, `mostraArchiviatiSelezionato`): `impiantiPerFiltro` / `terreniPerFiltro` includono impianti chiusi / terreni archiviati solo nel filtro; `impiantiPerInserimento` tiene le tendine di inserimento sugli aperti. Righe con terreno archiviato: « (archiviato)» e `isRegistroSolaLettura({ registro, terreno: { stato: row.terrenoStato }, impianto })` → solo consultazione (`terrenoStato` aggiunto dai servizi `trattamenti-vigneto-service.js` / `trattamenti-frutteto-service.js`). Test `tests/trattamenti-schede-archiviati.test.js`.

## Registro privato trattamenti (#208/#210)

Meccanica condivisa vigneto / frutteto / seminativo in `shared/js/trattamenti-coltura-page.js` + `shared/js/registro-trattamenti*.js` (pagine `trattamenti-page.js` del modulo).

- **Testata:** frase `NOTA_REGISTRO_PRIVATO` («Registro privato di compilazione… GFV non invia il file al SIAN né al fascicolo.»), pulsanti `#btn-export-registro-csv` / `#btn-export-registro-xml` (`esportaRegistro`: righe con trattamento di `listRows` + dati azienda dal tenant → `registro-trattamenti.csv|xml`, toast «Export del registro privato scaricato. GFV non lo invia al SIAN.»).
- **Riga prodotto:** `htmlMetaRegistro` («Scheda non confermata» / «Confermato: avversità», pulsante `.btn-leggi-scheda` «Leggi scheda», JSON riga in `.registro-json`). Esito in `#registro-scheda-esito`. `attaccaLetturaScheda` (`shared/js/registro-trattamenti-form.js`) → callable `leggiSchedaRegistroTrattamento` (`functions/registro-trattamenti-scheda.js`, client `shared/js/registro-trattamenti-scheda-client.js`): legge **solo** il CSV open data del Ministero della Salute (pagina dataset dati.salute.gov.it, cache in memoria istanza 6 ore, niente Firestore, **nessuna lettura SIAN** dal #415). Se il campo prodotto contiene solo cifre (`numeroDalCampoProdotto`) il form manda anche `numero`/`numeroRegistrazione`: `chiaveRicercaScheda` accetta nome o numero, `normalizzaNumeroRegistrazione` toglie gli zeri iniziali (`002513` = `2513`, `0` resta `0`), `trovaRegistrazioneUnica` per numero trova anche i revocati (#418). Risposta: `prodotti[]`, `proposto` (se l’unico nome esatto è revocato e c’è un prodotto ancora in commercio con lo stesso nome base), `dataLettura`, `fonte`; `htmlPannelloOpenData` mostra avviso «l’etichetta fa fede» (`AVVISO_ETICHETTA_FA_FEDE`), attribuzione IODL (`htmlAttribuzioneOpenData`), elenco **Scegli** se più prodotti, `classificaStatoAmministrativo` (autorizzato / revocato / scaduto / sospeso / non_verificato) con banner rosso e `data-conferma-bloccata` per i non in commercio, altrimenti `campiManuali` (coltura, avversità, dose ha/hl, carenza, numero massimo, intervallo: **scritti dall’azienda**, `registroConfermaManuale`). Non trovato → link `URL_BANCA_FITOSANITARI`; errore → «Gli open data non si leggono…». Righe di impiego del server **non** si usano più (nessun menu impieghi, nessuna rilettura a sei mesi). Conferma → `unisciConfermaSpecie` + `salvaSuProdotto` (`confermeSpecie`, `titolare`, `statoAmministrativoScheda`). Mai valori inventati.
- **Valori d'etichetta (#424/#426/#428):** `shared/js/registro-trattamenti-etichetta.js` (nuovo) legge, per numero di registrazione, `shared/data/fitofarmaci-etichette/per-registrazione/<numero a 6 cifre>.json` (`numeroFileEtichetta` r. 432, `percorsoValoriEtichetta` r. 443, `caricaSchedaEtichetta` r. 458, cache per numero; vocabolario `colture-vocabolario.json` con `caricaVocabolarioColture` r. 485; indice `indice.json`, origine in `README-origine.md`, dati v3 del 17/11/2026, 58 etichette). `preparaEtichetta` (r. 392) restituisce `stato` `mancante` / `da-ricontrollare` (`etichettaDaRicontrollare` r. 350, confronto con `dataRevisioneOpenData`) / `senza-coltura` / `non-estratta` / `coltura-assente` / `pronto` con i messaggi `MSG_ETICHETTA_*` (r. 10-14); `righePerColtura` (r. 94) e `candidatiColtura` (r. 47: plurali, sinonimi, coltura «padre»). Non sceglie l'avversità se è più di una e non scrive un numero se la dose è un intervallo o ha condizioni diverse (`campi.<k>.scrivi` vuoto, `voci[]`). In `shared/js/registro-trattamenti-form.js`: `campiConEtichetta` (r. 398: campi `.registro-coltura`, `.registro-avversita-scelta` con «Scegli…»/«Altra…», `.registro-dose-ha`, `.registro-dose-hl`, `.registro-carenza`, `.registro-massimo`, `.registro-intervallo`), `htmlVociEtichetta` (r. 323, «Scegli la riga che vale per il tuo caso», pulsanti `.registro-voce-etichetta`), `htmlFonteEtichetta` (r. 307, «da etichetta, pag. N» + `data-mostra-frase`), `htmlDicituraEtichetta` (r. 387), `FRASE_CONFERMA_CONTROLLATA` accanto a `data-conferma-manuale`. Il clic su una voce (`applicaVoceEtichetta` r. 752, `segnaVoceScelta` r. 707, `copiaAttributiVoce` r. 652) scrive il valore nel campo e ne copia gli attributi `data-*`; il cambio di `.registro-coltura` o dell'avversità ridisegna (`disegna(..., { ignoraValoriConferma: true })`, r. ~895-910). Salvataggio: `origineDaInput` (r. 585) / `leggiCampiAzienda` (r. 610) → `origineValori` per campo (`origine` `etichetta`|`azienda`, `pagina`, `idRiga`, `unita`, `condizione`, `epoca`, `periodo`, `nonNecessario`) normalizzato da `normalizzaOrigineValori` (`shared/js/registro-trattamenti.js` r. 51) insieme a `carenzaNonNecessaria`; `numeroSingoloTesto` (r. 41) rifiuta intervalli («4-8»). Un valore ritoccato a mano diventa `azienda`. Test: `tests/registro-trattamenti-etichetta.test.js`.
- **«Leggi scheda» e numero (#418/#422):** `richiestaLetturaScheda` (form r. 74) manda `numero`/`numeroRegistrazione` se l'anagrafica prodotto ha il numero, altrimenti il nome ripulito da `nomeProdottoPerRicercaScheda` (r. 62: toglie prefissi tipo «Inse.», «Fung.», «Conc.» e confezioni «da 1 lt.»); se la ricerca non trova nulla `htmlPannelloOpenData` (r. 465) mostra `.registro-numero-manuale` + `[data-riprova-numero]` «Cerca per numero» (listener r. ~927). #418: ricerca per numero anche per i revocati e niente `NaN` nei campi numerici del form (`valoreInputNumerico`, `numeroFinito`).
- **Operatore da elenco (#422):** `shared/js/registro-operatore.js` (nuovo): `caricaOperatoriAzienda` (users del tenant con ruolo `operaio` o `caposquadra`, `stato == 'attivo'`, come `loadOperai`/`loadCaposquadra` di Gestione lavori), `unisciOperatori`, `riconosciOperatore`, `preparaValoreOperatore`, `riempiTendinaOperatore` (r. 111, `#trattamento-operatore` diventa `<select>` con «— Seleziona —», persone e `OPERATORE_ALTRO` «Altro» che mostra `#trattamento-operatore-altro`), `leggiOperatoreDalForm` (r. 146, salva il **nome visibile**, non l'id), `mostraOperatoreNelForm` (r. 201), `operatoreDaLavoro` (caposquadra, altrimenti operaio). Usato da `shared/js/trattamenti-coltura-page.js` (vigneto e frutteto: Trattamenti e Concimazioni), `modules/orticole/js/trattamenti-page.js` e `modules/seminativo/js/trattamenti-page.js` (stesso script per Trattamenti e Concimazioni); `modules/vigneto/js/concimazioni-page.js` e `modules/frutteto/js/concimazioni-page.js` usano `mostraOperatoreNelForm(t.operatore, { risolviNome: getDisplayNameForUserId })`. Le viste `*-standalone.html` hanno ora `<select id="trattamento-operatore">` + `#trattamento-operatore-altro`.
- **Specie (coltura precompilata, non più «coltura della scheda SIAN»):** `core/config/registro-trattamenti-specie.js` — vigneto da `destinazioneUva` (`vino` → vite da vino, `vendita_uva` → vite da tavola, `misto` → null), frutteto da specie (`Kiwi` → actinidia, `Altro` → null), seminativo da coltura campagna (`Grano` → frumento), orticole da `MAPPA_COLTURA_ORTICOLE` (`colturaSchedaOrticole`); alias in `ALIAS_COLTURA_SCHEDA`.
- **Campi form:** `trattamento-giorni-carenza` (placeholder «Dalla riga confermata, altrimenti dall'anagrafica»), `#registro-nota`, `trattamento-acqua-hl-ha` / `trattamento-acqua-hl-tot` (`bindAcquaCampi`, l’uno dall’altro con la superficie). Mapping Tony: acqua in `tony-form-mapping.js`; numero di registrazione, principio attivo, avversità e carenza **non** si chiedono a voce e non si inventano (li conferma l’azienda dalla lettura pubblica). `tony-form-injector.js` conserva i campi registro della riga (`principioAttivo`, `avversita`, `specieUsata`, `impieghiMassimiAnno`, `giorniMinimiTraPassaggi`, …).
- **Salvataggio:** dopo `validaDosaggiProdotti`, `messaggiAvvisoForm` / `avvisoImpieghiEIntervallo` (non bloccanti: scheda non confermata, numero massimo impieghi nell’anno, intervallo minimo tra passaggi, diluizione) → `confirm(… «Salvare comunque?»)`. Modelli `TrattamentoVigneto` / `TrattamentoFrutteto` / `SeminativoTrattamento` con acqua e righe registro.
- **Cancellazione:** `valutaCancellazioneRegistro` — confermato con meno di tre anni (`ANNI_CONSERVAZIONE_REGISTRO`) richiede la conferma «Confermo di avere già esportato il registro.» (`exportConfermato`); i movimenti di magazzino restano; la riga torna «da completare».
- **Miscela del lavoro:** `lavoro.miscelaPrevista` da Gestione lavori (vedi `GUIDA/MANODOPERA/tony/guida-tecnica.md`, Form Tony → Miscela prevista).
- **Deploy:** resta la sola callable `leggiSchedaRegistroTrattamento`; trigger `onProdottoSchedaScritto` e schedulato `leggiSchedeRegistroInCoda` sono stati **tolti** (#415, `functions/registro-trattamenti-lettura.js` eliminato). `functions/scripts/sync-notification-modules.cjs` copia `shared/js/registro-trattamenti-fonte.js` in `functions/lib/registro-trattamenti-fonte.mjs` (testi fonte/licenza). Test: `tests/registro-trattamenti-csv.test.js` (ricerca sul CSV, per numero, esito nel form, semaforo, `valoreInputNumerico`), `tests/nessun-sian-in-produzione.test.js`.

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
