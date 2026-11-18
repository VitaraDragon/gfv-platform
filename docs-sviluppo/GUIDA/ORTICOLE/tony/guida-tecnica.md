# Tony — guida tecnica modulo Orticole

Modulo tenant: `orticole` (minuscolo; `tenant.modules`). Fase 1: pieno campo, niente piano colturale/rotazione (`ORTICOLE_EXCLUDED_FROM_VIGNETO` in `modules/orticole/config/orticole-hub.js`). Non c'è nessun flag di disponibilità che lo nasconda: `subscription-plans.js` → `available: true` (vedi `GUIDA/CORE/tony/guida-tecnica.md`, «Modulo Orticole nel catalogo»).

## Path standalone (relativi a `modules/orticole/views/`)

| Pagina | File | Script | `pageType` |
|--------|------|--------|-----------|
| Dashboard | `orticole-dashboard-standalone.html` | `js/orticole-hub-page.js` | `orticole_hub` |
| Anagrafica campagne | `orticole-anagrafica-standalone.html` | `js/orticole-anagrafica-page.js` | `orticole` |
| Semina e trapianto | `impianto-standalone.html` | `js/impianti-page.js` | `impianto_orticole` |
| Lavorazioni | `lavorazioni-standalone.html` | `js/lavorazioni-page.js` | `lavorazioni_orticole` |
| Irrigazione | `irrigazione-standalone.html` | `js/irrigazione-page.js` | `irrigazione_orticole` |
| Trattamenti | `trattamenti-standalone.html` | `js/trattamenti-page.js` (`initTrattamentiPage`) | `trattamenti_orticole` |
| Concimazioni | `concimazioni-standalone.html` | stesso `trattamenti-page.js`, `registro.categoria = 'concimazione'` | `concimazioni_orticole` |
| Raccolta | `raccolta-standalone.html` | `js/raccolta-page.js` | `raccolta_orticole` |
| Statistiche | `orticole-statistiche-standalone.html` | `js/statistiche-page.js` | `statistiche_orticole` |

Catalogo card/rotte Tony: `config/orticole-hub.js` (`ORTICOLE_HUB_CARDS`, `tonyTarget`, `pageType`). `js/orticole-placeholder-page.js` non è più usato da nessuna vista (tutte le pagine sono reali). Stile `orticole-standalone.css`, accento `#E65100` / `#BF360C`.

## Collezioni Firestore (`firestore.rules`, lettura a tutti i membri del tenant; scrittura solo manager/admin)

- `tenants/{tenantId}/orticole` — campagna (`OrticolaCampagna`): chiave logica `terrenoId + settoreId(null) + campagna + ciclo`; max 2 cicli per terreno+annata (`assertUniqueTerrenoCampagnaCiclo` in `orticole-service.js`, messaggi «Esiste già una campagna … ciclo …» / «Sono ammessi al massimo due cicli…»). Stati `pianificato|seminato|trapiantato|in_ciclo|raccolto|chiuso`. `defaultCampagnaLabel`: da settembre `anno/anno+1`. `intervalloCampagna('2026/2027')` = 1/9/2026–31/8/2027.
- `semineOrticole` — impianto (`OrticolaImpianto`; `impianti-service.js`): obbligatori campagna e data; dose e densità > 0; unità `kg/ha|kg`; `statoDopoImpianto` / `statoDopoRimozioneImpianto` aggiornano lo stato campagna.
- `trattamentiOrticole` — dati prodotto su lavoro/attività (`OrticolaTrattamento`, `trattamenti-service.js`: `saveTrattamentoOrticole`, `deleteTrattamentoOrticole`, `listRigheTrattamento`; scarico via `syncScarichiMagazzinoTrattamento` con `modulo: 'orticole'`). Usata sia da Trattamenti sia da Concimazioni.
- `raccolteOrticole` (`OrticolaRaccolta`; obbligatori campagna, lavoro o attività, data, quintali > 0, superficie > 0, destinazione `industria|mercato|stoccaggio|uso_aziendale`; `statoDopoRaccolta` → `raccolto`).
- `irrigazioniOrticole` (`OrticolaIrrigazione`; volume > 0 in `m3`, metodo `a_goccia|aspersione|scorrimento`; tipi di lavoro con «irrigazione» nel nome, senza «manutenzione»; seed `IRRIGAZIONE_TIPI_SEED`).
- **Lavorazioni:** nessuna collezione, solo lettura di `attivita` e `lavori` (`lavorazioni-service.js`, `selezionaLavorazioniCollegate`; tipi sottocategoria `lavorazione_terreno_generale`, esclusi «tra le file»/«sulla fila»).
- **Varietà:** `varieta-orticole-service.js`: elenchi predefiniti per 25 colture (`VARIETA_PREDEFINITE_PER_COLTURA`, alias `ALIAS_COLTURA`) + varietà dell'utente in **localStorage** `orticole_varieta_<coltura>` (non su Firestore, non condivise).

## Come nascono le righe dei registri

`selezionaRigheTrattamento` (`models/OrticolaTrattamento.js`, riusata da Irrigazione, Raccolta, Lavorazioni): lavori (se Manodopera, stato ≠ annullato) e attività Diario (senza `lavoroId` né `clienteId`) sul terreno ortivo (`listTerreniOrticole`: categoria `ortive`, id categorie alias, nomi colture del catalogo), con tipo tra i nomi della categoria (`nomiSeedCategoriaCampo`), data dentro l'annata di una campagna del terreno (`campagnaPer`: **prima** campagna trovata, nessuna distinzione tra ciclo 1 e 2) → una riga con `trattamento`/`irrigazione`/`raccolta` o `null` («da completare»). Un'attività con stessa data+tipo di un lavoro non si ripete. Pulsanti: **Completa** (apre il modulo), **Modifica**/**Elimina**, link **Vedi Lavoro** (`gestione-lavori-standalone.html?lavoroId=`) / **Vedi Attività** (`attivita-standalone.html?attivitaId=`); `link-nuovo-lavoro` visibile solo con Manodopera.

## Trattamenti: registro privato

- **Stato vuoto (#420/#422):** `testoStatoVuotoRegistro({ coltura: 'ortive', categoria, hasManodopera })` (`shared/js/registro-trattamenti.js` r. 435) scritto da `aggiornaTestoStatoVuoto` (`modules/orticole/js/trattamenti-page.js` r. 217) nel `<p>` di `#empty-state`; senza Manodopera cita solo il Diario, con Manodopera anche «Nuovo lavoro in Gestione Lavori». `loadRighe` (r. 693) ora ha try/catch: su errore mostra `[data-load-error]` «Non riesco a caricare i dati. Ricarica la pagina.» al posto del caricamento infinito. Stesse modifiche in `modules/seminativo/js/trattamenti-page.js`.
- **Completa da miscela (#422):** `compilaModuloTrattamento` (r. 511) legge il lavoro (`getLavoro(row.lavoroId)` da `core/services/lavori-service.js`) e chiama `prodottiSchedaDaMiscelaLavoro(lavoro, trattamento, superficie, anagrafica)` (`shared/js/registro-trattamenti.js` r. 396: se la scheda è vuota o ha solo la riga vuota prende prodotti, dose, quantità, acqua (`acquaEttolitriPerEttaro`/`acquaEttolitriTotali`) da `lavoro.miscelaPrevista` con costi dall'anagrafica; una scheda già compilata non si tocca; senza prodotti in miscela non inventa righe). Operatore: `trattamento.operatore` se c'è, altrimenti con Manodopera `operatoreDaLavoro(lavoro)` (`shared/js/registro-operatore.js`), mostrato da `mostraOperatoreNelForm`; il gruppo `#trattamento-operatore-group` resta nascosto senza Manodopera (compare `#trattamento-proprietario-message`). Al salvataggio `leggiOperatoreDalForm`. Dettagli del form operatore, «Leggi scheda» per numero e valori d'etichetta: `GUIDA/VIGNETO/tony/guida-tecnica.md`, «Registro privato trattamenti» (`shared/js/registro-trattamenti-etichetta.js`, `shared/data/fitofarmaci-etichette/`). Il campo operatore nascosto senza Manodopera è voluto (Pier 18/11). Elenco operatori: stato attuale e modifica decisa da Pier il 18/11 (titolare e manager nell'elenco, in attesa di PR di codice) come in `GUIDA/VIGNETO/tony/guida-tecnica.md`, «Operatore da elenco».

- Testata: nota «Registro privato… GFV non invia nulla al SIAN né al fascicolo.»; `#btn-export-registro-csv` / `-xml` → `esportaRegistroOrticole` (`righeExportRegistro`, `registroToCsv|Xml`, dati azienda da `aziendaDaTenant`, file `registro-trattamenti.csv|xml`, alert «Export del registro privato scaricato. GFV non lo invia al SIAN.»). Solo `registro.categoria === 'trattamenti'`: Concimazioni non ha export, scheda prodotto, acqua né avvisi registro.
- Riga prodotto con `htmlMetaRegistro` e `attaccaLetturaScheda` (stesso flusso condiviso di vigneto/frutteto/seminativo: `GUIDA/VIGNETO/tony/guida-tecnica.md`, «Registro privato trattamenti»), `leggiScheda: leggiSchedaRegistroTrattamento`; specie da `colturaSchedaRegistro({ modulo: 'orticole' })` → `MAPPA_COLTURA_ORTICOLE`; `salvaSuProdotto: salvaConfermaProdottoOrticole`.
- Salvataggio: `avvisoDosaggioProdotti` (⚠️ in colonna **Avvisi**, `confirm «Salvare comunque?»`), `messaggiAvvisoForm` con `passaggiOrticole` (numero massimo impieghi, intervallo, diluizione), almeno una riga prodotto con nome; superficie da anagrafe terreno con casella `trattamento-superficie-anagrafe`.
- Cancellazione: `valutaCancellazioneRegistro` (solo Trattamenti) → conferma «Confermo di avere già esportato il registro.» (`exportConfermato`); i movimenti di magazzino restano.
- Scarico magazzino: gruppo `trattamento-scarico-magazzino-group` visibile con Magazzino; casella `trattamento-registra-scarico-magazzino`.

## Anagrafica: avviso senza terreni ortivi (#422)

`modules/orticole/js/avviso-terreni-ortive.js`: `mancaTerrenoOrtivoOperativo(terreni)` (vero se `terreniPerTendina` di `shared/js/coltura-terreno.js` è vuoto: nessun terreno o solo archiviati), `htmlAvvisoNessunTerrenoOrtivo`, `applicaAvvisoTerreniOrtive(terreni)` che riempie `#avviso-terreni-ortive` e `#avviso-terreni-ortive-modal` (`orticole-anagrafica-standalone.html`) con il testo `TESTO_AVVISO_NESSUN_TERRENO_ORTIVO` e il link `HREF_TERRENI_DA_ORTICOLE` verso Terreni; chiamato 3 volte da `orticole-anagrafica-page.js`. Il filtro della tendina non cambia. Test `tests/orticole-anagrafica.test.js`.

## Spese e statistiche

`models/OrticolaSpese.js` `dettaglioSpeseCampagna` (lavori `completato` con `costoManodopera`/`costoMacchine` + attività dirette, per terreno e annata; modale «Dettaglio Spese» in anagrafica; servizio `orticole-spese-service.js`). `models/OrticolaStatistiche.js` `riepilogoCampagne` / `totaliStatistiche`: resa effettiva = quintali / superficie campagna; resa prevista media pesata sugli ettari. Dal #420 `riepilogoCampagne` accetta anche `irrigazioni` (volumi `volumeM3` per `campagnaId`, **senza** costi) e calcola `acquaM3` e `acquaM3Ha`; `totaliStatistiche` somma `acquaM3`; `caricaStatisticheOrticole` (`services/statistiche-service.js`) carica `getAllIrrigazioniOrticole`; pagina `statistiche-page.js`: KPI `#kpi-acqua` «Acqua (m³)» e colonna «Acqua (m³)» in tabella (`orticole-statistiche-standalone.html`). Test `tests/orticole-statistiche.test.js`. Hub: `OrticoleHub.js` `panoramicaHubOrticole`, `raccolteRecentiHub` (limite 10), `lavoriRecentiHub`; esclude campagne su terreni archiviati.

## Tony e gate

Rotte, gate modulo, consigliere e `pageType`: `GUIDA/TONY/tony/guida-tecnica.md`, «Modulo Orticole: rotte, gate e consigliere». Nessun mapping form Tony per il modulo.

## Problemi noti (da chiarire con Pier)

- **Import rotto (#420):** `trattamenti-page.js` importava `chiediRiletturaScheda` e `leggiRigheSchedaProdotto` che dopo #415 non esistono più in `shared/js/registro-trattamenti-scheda-client.js`; il #420 li ha tolti (import ora solo `leggiSchedaRegistroTrattamento`, r. 43) e ha aggiunto `tests/named-imports-exist.test.js`. Verificato solo dai test, **non sul browser**: da chiarire con Pier se Trattamenti e Concimazioni si aprono davvero (memoria 17/11: la correzione era affidata a Pier).
- `gfv-completo` non include `orticole` (congelato ai 11 moduli); `STRIPE_PRICE_IDS` non ha `orticole`.
- Con due cicli nella stessa annata sullo stesso terreno la riga di registro si aggancia sempre alla prima campagna trovata.

## Test

`tests/orticole-anagrafica.test.js`, `orticole-impianto.test.js`, `orticole-irrigazione.test.js`, `orticole-concimazioni.test.js`, `orticole-trattamenti.test.js`, `orticole-raccolta.test.js`, `orticole-varieta.test.js`, `orticole-module-skeleton.test.js`.
