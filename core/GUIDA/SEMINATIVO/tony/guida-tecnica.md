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
- **Valori d'etichetta (#424/#426/#428):** `shared/js/registro-trattamenti-etichetta.js` (nuovo) legge, per numero di registrazione, `shared/data/fitofarmaci-etichette/per-registrazione/<numero a 6 cifre>.json` (`numeroFileEtichetta` r. 432, `percorsoValoriEtichetta` r. 443, `caricaSchedaEtichetta` r. 458, cache per numero; vocabolario `colture-vocabolario.json` con `caricaVocabolarioColture` r. 485; indice `indice.json`, origine in `README-origine.md`, dati v3 del 17/11/2026, 58 etichette). `preparaEtichetta` (r. 392) restituisce `stato` `mancante` / `da-ricontrollare` (`etichettaDaRicontrollare` r. 350, confronto con `dataRevisioneOpenData`) / `senza-coltura` / `non-estratta` / `coltura-assente` / `pronto` con i messaggi `MSG_ETICHETTA_*` (r. 10-14); `righePerColtura` (r. 94) e `candidatiColtura` (r. 47: plurali, sinonimi, coltura «padre»). Non sceglie l'avversità se è più di una e non scrive un numero se la dose è un intervallo o ha condizioni diverse (`campi.<k>.scrivi` vuoto, `voci[]`). In `shared/js/registro-trattamenti-form.js`: `campiConEtichetta` (r. 398: campi `.registro-coltura`, `.registro-avversita-scelta` con «Scegli…»/«Altra…», `.registro-dose-ha`, `.registro-dose-hl`, `.registro-carenza`, `.registro-massimo`, `.registro-intervallo`), `htmlVociEtichetta` (r. 323, «Scegli la riga che vale per il tuo caso», pulsanti `.registro-voce-etichetta`), `htmlFonteEtichetta` (r. 307, «da etichetta, pag. N» + `data-mostra-frase`), `htmlDicituraEtichetta` (r. 387), `FRASE_CONFERMA_CONTROLLATA` accanto a `data-conferma-manuale`. Il clic su una voce (`applicaVoceEtichetta` r. 752, `segnaVoceScelta` r. 707, `copiaAttributiVoce` r. 652) scrive il valore nel campo e ne copia gli attributi `data-*`; il cambio di `.registro-coltura` o dell'avversità ridisegna (`disegna(..., { ignoraValoriConferma: true })`, r. ~895-910). Salvataggio: `origineDaInput` (r. 585) / `leggiCampiAzienda` (r. 610) → `origineValori` per campo (`origine` `etichetta`|`azienda`, `pagina`, `idRiga`, `unita`, `condizione`, `epoca`, `periodo`, `nonNecessario`) normalizzato da `normalizzaOrigineValori` (`shared/js/registro-trattamenti.js` r. 51) insieme a `carenzaNonNecessaria`; `numeroSingoloTesto` (r. 41) rifiuta intervalli («4-8»). Un valore ritoccato a mano diventa `azienda`. Test: `tests/registro-trattamenti-etichetta.test.js`. **Copertura:** valori solo per i 58 prodotti con file in `per-registrazione/`; per gli altri l'app mostra «Valori d'etichetta non ancora disponibili in GFV per questo prodotto: vedi etichetta» (`MSG_ETICHETTA_MANCANTE`, r. 10). File citati nel `README-origine.md` e assenti nel repo (buco tecnico, non una decisione): elenco in `GUIDA/VIGNETO/tony/guida-tecnica.md`, «Valori d'etichetta».
- **«Leggi scheda» e numero (#418/#422):** `richiestaLetturaScheda` (form r. 74) manda `numero`/`numeroRegistrazione` se l'anagrafica prodotto ha il numero, altrimenti il nome ripulito da `nomeProdottoPerRicercaScheda` (r. 62: toglie prefissi tipo «Inse.», «Fung.», «Conc.» e confezioni «da 1 lt.»); se la ricerca non trova nulla `htmlPannelloOpenData` (r. 465) mostra `.registro-numero-manuale` + `[data-riprova-numero]` «Cerca per numero» (listener r. ~927). #418: ricerca per numero anche per i revocati e niente `NaN` nei campi numerici del form (`valoreInputNumerico`, `numeroFinito`).
- **Operatore da elenco (#422):** `shared/js/registro-operatore.js` (nuovo): `caricaOperatoriAzienda` (users del tenant con ruolo `operaio` o `caposquadra`, `stato == 'attivo'`, come `loadOperai`/`loadCaposquadra` di Gestione lavori), `unisciOperatori`, `riconosciOperatore`, `preparaValoreOperatore`, `riempiTendinaOperatore` (r. 111, `#trattamento-operatore` diventa `<select>` con «— Seleziona —», persone e `OPERATORE_ALTRO` «Altro» che mostra `#trattamento-operatore-altro`), `leggiOperatoreDalForm` (r. 146, salva il **nome visibile**, non l'id), `mostraOperatoreNelForm` (r. 201), `operatoreDaLavoro` (caposquadra, altrimenti operaio). Usato da `shared/js/trattamenti-coltura-page.js` (vigneto e frutteto: Trattamenti e Concimazioni), `modules/orticole/js/trattamenti-page.js` e `modules/seminativo/js/trattamenti-page.js` (stesso script per Trattamenti e Concimazioni); `modules/vigneto/js/concimazioni-page.js` e `modules/frutteto/js/concimazioni-page.js` usano `mostraOperatoreNelForm(t.operatore, { risolviNome: getDisplayNameForUserId })`. Le viste `*-standalone.html` hanno ora `<select id="trattamento-operatore">` + `#trattamento-operatore-altro`. **Visibilità (voluto, Pier 18/11):** in `modules/seminativo/js/trattamenti-page.js` (stesso script per Trattamenti e Concimazioni) `#trattamento-operatore-group` si vede solo con Manodopera attiva (`hasManodopera`, r. 528-531); senza compare `#trattamento-proprietario-message` «Lavoro svolto dal proprietario (modulo Manodopera non attivo).»; il salvataggio legge `leggiOperatoreDalForm()` (r. 655), che con il gruppo nascosto dà `''`. **Elenco operatori, stato attuale:** solo utenti del tenant con ruolo `operaio` o `caposquadra` e `stato == 'attivo'`; titolare e manager non sono nell'elenco e si indicano con «Altro» (testo libero); si salva il nome visibile, non l'id. **Modifica decisa da Pier il 18/11 (titolare e manager nell'elenco), in attesa di PR di codice:** finché non è mergiata la guida descrive il comportamento attuale. **Regola (Pier 18/11): con Manodopera attiva l'operatore è obbligatorio in Trattamenti e Concimazioni; senza Manodopera il campo è nascosto.** La guida utente dice «obbligatorio» in quel caso. **Difetto noto, in attesa di PR di codice (PR separata):** oggi il codice non lo richiede: `modules/seminativo/views/trattamenti-standalone.html` r. 122-123 e `concimazioni-standalone.html` r. 113-114 hanno `<select id="trattamento-operatore">` senza `required`, e il salvataggio (`modules/seminativo/js/trattamenti-page.js` r. 655, `operatore: leggiOperatoreDalForm()`) non controlla, quindi si può salvare senza operatore. Da aggiornare quando la PR è mergiata.
- **Completa da miscela e stato vuoto (#422):** `modules/seminativo/js/trattamenti-page.js` usa `prodottiSchedaDaMiscelaLavoro`, `testoStatoVuotoRegistro` (`aggiornaTestoStatoVuoto`) e l'operatore dal lavoro con Manodopera come in Orticole (vedi `GUIDA/ORTICOLE/tony/guida-tecnica.md`, «Trattamenti: registro privato»); `loadRighe` con try/catch e `[data-load-error]` «Non riesco a caricare i dati. Ricarica la pagina.». Il gruppo `#trattamento-operatore-group` resta nascosto senza Manodopera.
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
