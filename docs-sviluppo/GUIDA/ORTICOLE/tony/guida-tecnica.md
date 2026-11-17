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

- Testata: nota «Registro privato… GFV non invia nulla al SIAN né al fascicolo.»; `#btn-export-registro-csv` / `-xml` → `esportaRegistroOrticole` (`righeExportRegistro`, `registroToCsv|Xml`, dati azienda da `aziendaDaTenant`, file `registro-trattamenti.csv|xml`, alert «Export del registro privato scaricato. GFV non lo invia al SIAN.»). Solo `registro.categoria === 'trattamenti'`: Concimazioni non ha export, scheda prodotto, acqua né avvisi registro.
- Riga prodotto con `htmlMetaRegistro` e `attaccaLetturaScheda` (stesso flusso condiviso di vigneto/frutteto/seminativo: `GUIDA/VIGNETO/tony/guida-tecnica.md`, «Registro privato trattamenti»), `leggiScheda: leggiSchedaRegistroTrattamento`; specie da `colturaSchedaRegistro({ modulo: 'orticole' })` → `MAPPA_COLTURA_ORTICOLE`; `salvaSuProdotto: salvaConfermaProdottoOrticole`.
- Salvataggio: `avvisoDosaggioProdotti` (⚠️ in colonna **Avvisi**, `confirm «Salvare comunque?»`), `messaggiAvvisoForm` con `passaggiOrticole` (numero massimo impieghi, intervallo, diluizione), almeno una riga prodotto con nome; superficie da anagrafe terreno con casella `trattamento-superficie-anagrafe`.
- Cancellazione: `valutaCancellazioneRegistro` (solo Trattamenti) → conferma «Confermo di avere già esportato il registro.» (`exportConfermato`); i movimenti di magazzino restano.
- Scarico magazzino: gruppo `trattamento-scarico-magazzino-group` visibile con Magazzino; casella `trattamento-registra-scarico-magazzino`.

## Spese e statistiche

`models/OrticolaSpese.js` `dettaglioSpeseCampagna` (lavori `completato` con `costoManodopera`/`costoMacchine` + attività dirette, per terreno e annata; modale «Dettaglio Spese» in anagrafica; servizio `orticole-spese-service.js`). `models/OrticolaStatistiche.js` `riepilogoCampagne` / `totaliStatistiche`: resa effettiva = quintali / superficie campagna; resa prevista media pesata sugli ettari. Hub: `OrticoleHub.js` `panoramicaHubOrticole`, `raccolteRecentiHub` (limite 10), `lavoriRecentiHub`; esclude campagne su terreni archiviati.

## Tony e gate

Rotte, gate modulo, consigliere e `pageType`: `GUIDA/TONY/tony/guida-tecnica.md`, «Modulo Orticole: rotte, gate e consigliere». Nessun mapping form Tony per il modulo.

## Problemi noti (da chiarire con Pier)

- `modules/orticole/js/trattamenti-page.js` importa `chiediRiletturaScheda` e `leggiRigheSchedaProdotto` da `shared/js/registro-trattamenti-scheda-client.js`, che dopo #415 esporta solo `leggiSchedaRegistroTrattamento`: in un modulo ES l'import di un nome inesistente fa fallire il caricamento, quindi Trattamenti **e** Concimazioni (stesso script) potrebbero non inizializzarsi. Non verificato sul browser; l'opzione `leggiRighe` / `chiediRilettura` passata ad `attaccaLetturaScheda` non è più usata.
- `gfv-completo` non include `orticole` (congelato ai 11 moduli); `STRIPE_PRICE_IDS` non ha `orticole`.
- Con due cicli nella stessa annata sullo stesso terreno la riga di registro si aggancia sempre alla prima campagna trovata.

## Test

`tests/orticole-anagrafica.test.js`, `orticole-impianto.test.js`, `orticole-irrigazione.test.js`, `orticole-concimazioni.test.js`, `orticole-trattamenti.test.js`, `orticole-raccolta.test.js`, `orticole-varieta.test.js`, `orticole-module-skeleton.test.js`.
