# Piano (design): Carburante in Magazzino

**Stato:** design concordato; **Fase 0–2 in codice** (2026-10-02). Fase 3 da fare.  
**Tipo:** guida di sviluppo per agenti e sviluppatori.  
**Per chi:** chi implementa categoria, hub, carico cisterna, pieni per mezzo, apprendimento consumi coppia.  
**Path canonico:** `docs-sviluppo/da-fare/magazzino/PIANO_CARBURANTE.md`  
**Decisioni:** `docs-sviluppo/TONY_DECISIONI_E_REQUISITI.md` §28  

**Ultimo aggiornamento design:** 2026-10-02 (conversazione prodotto: modulo, card Carburante, due verità, apprendimento da giornate pulite).

Analisi Coerenza Master Plan: Fase 3 (Context Builder) e Fase 6 (proattività scorte). La modifica è scalabile perché il carburante è una **categoria di prodotto** e un **ingresso UX** sullo stesso registro `movimentiMagazzino`, non un modulo o un secondo magazzino. Tony si estende con rotte, sinonimi e mapping, senza `if (formId === 'carburante')` nel core.

---

## 0. Come usare questo documento

1. Leggere §1 (decisioni bloccate) prima di scrivere codice. In caso di contrasto con idee sparse, **prevalgono le tabelle di questo file** e `TONY_DECISIONI_E_REQUISITI.md` §28.
2. Implementare **una fase alla volta** (§5). Non saltare alla ripartizione consumi prima di categoria + hub + carico/pieno.
3. Dopo ogni fase: test della fase, aggiornare la tabella stato in cima a questo file, poi solo i 4 file canonici (`COSA_ABBIAMO_FATTO.md`, `tony/STATO_ATTUALE.md`, `tony/MASTER_PLAN.md` se cambia una fase Tony, `TONY_DECISIONI_E_REQUISITI.md` se una voce §28 passa a implementato).
4. Non creare altri file di documentazione. Guide utente `GUIDA/` solo quando la UI è in codice, con la checklist `guida-aggiornamento-checklist`.
5. Branch dedicato + PR su `develop`. Mai push su `main`. Se si tocca codice servito al browser: `npm run bump:pwa-cache && git add service-worker.js` prima del commit (gli hook agente non girano).

Riferimenti obbligatori prima del codice:

- `docs-sviluppo/tony/MASTER_PLAN.md` (§4 config > codice, §5 Context Builder)
- `docs-sviluppo/ANALISI_MODULO_MAGAZZINO.md` (scorta minima, un registro, collegamento lavori)
- `docs-sviluppo/MAGAZZINO_APPENDICE_TRACCIABILITA_DASHBOARD_E_SCARICO.md` (viste tematiche, non secondi magazzini)
- Canone liste/form: `.cursor/rules/tony-pagina-lista-e-form.mdc`

---

## 1. Decisioni di prodotto (bloccate)

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D1 | Vive in **Prodotti e Magazzino**. Niente modulo Carburante. Niente giacenza nel Parco Macchine. | Stesso mestiere di concimi e fitofarmaci: scorta, soglia, movimenti, reminder. |
| D2 | Categoria prodotto **`carburante`**. Non usare `altro`. | Gasolio, benzina, AdBlue sono una famiglia, non un residuo. |
| D3 | Card home Magazzino **Carburante** (non «Gasolio»). Apre un **mini-hub**, non un form. | In azienda ci sono più tipi; «Gasolio» esclude benzina/AdBlue. |
| D4 | Hub interno: **Scorta**, **Carico** (cisterna), **Pieni / consumi**, **Prodotti** (solo categoria carburante). | Poche porte. Stesso schema home Magazzino / hub Manodopera. |
| D5 | **Un solo registro** `movimentiMagazzino`. Niente tipo `entrata_carburante`, niente seconda collection per i litri di cisterna. | Giacenza atomica, Tony, sotto scorta e Occhi leggono lì. |
| D6 | Carico cisterna = movimento **entrata** su prodotto `carburante`. Pieno mezzo = movimento **uscita** con `macchinaId`. | Due gesti diversi, stesso documento movimento. |
| D7 | Le quote litri **per lavoro non sono movimenti**. Non scaricano di nuovo la giacenza. | Altrimenti il pieno e la ripartizione doppiano i litri. |
| D8 | Due verità. **Cisterna = misurata** (carichi e pieni). **Consumo per operazione = allocato** (mai misurato a ogni cambio attrezzo). | L’operaio non legge l’asticella a ogni lavoro. |
| D9 | Unità di apprendimento = **coppia** `(macchinaId, attrezzoId)`. Non L/h sull’attrezzo. Non chiave `terrenoId`. | Stesso attrezzo su 80 CV e 150 CV non beve uguale. Il singolo campo quasi non ha finestre pulite. |
| D10 | Manager: L/h di massima **solo sul trattore** (opzionale). Sull’attrezzo nessun consumo. Override opzionale **sulla coppia** già vista. | Niente matrice 5×15. |
| D11 | **Giornata pulita** (un mezzo, un attrezzo, un pieno → pieno successivo): il sistema **impara** il L/h della coppia. | Un’equazione, un’incognita. Quasi reale. |
| D12 | **Giornata mista** (stesso pieno, più attrezzi): **non impara**. Se le coppie hanno già un tasso, **ripartisce**. Se no, nessuna quota litri sui lavori. | Un numero, due incognite: non inventare. |
| D13 | All’inizio dell’uso: i pieni e la cisterna si contano subito. Le operazioni miste **non** ricevono litri finché non esiste almeno un tasso imparato (o override) per quelle coppie. La prima giornata pulita insegna. | Partenza vuota sulle coppie, non un buco sui pieni. |
| D14 | Report «litri sul terreno X» = quota del lavoro che ha già `terrenoId`. Non si impara per appezzamento. Eventuale raffinamento futuro: `tipoCampo` pianura/collina/montagna (già in anagrafica, meteo, tariffe). **Fuori v1.** | Pendenza conta, ma spezzare per campo blocca l’apprendimento. |
| D15 | Categoria `carburante`: **niente** dosaggio min/max né giorni di carenza. Unità tipica **`L`**. | Non è un fitofarmaco. |
| D16 | Reminder sotto scorta = quelli già esistenti (`scortaMinima`, `summarySottoScorta`, hub Magazzino). Nessun canale push nuovo in v1. | Fase 6 già copre le scorte. |
| D17 | Gate: modulo **`magazzino`**. Pieni e apprendimento richiedono anche **Parco Macchine**. Senza mezzi: solo cisterna + anagrafica prodotti carburante. | Moduli indipendenti, integrazioni opzionali. |
| D18 | Tony: config (rotte, gate, sinonimi, FILTER_TABLE). Vietato `if` su pagina/form carburante nel core. | Master Plan §4. |

### Cosa è esplicitamente fuori scope (non implementare)

- Telemetria / CAN bus / GPS litri.
- Litri digitati dall’operaio a ogni cambio attrezzo.
- Scarico automatico alla chiusura lavoro con solo ore × L/h, **senza** pieno (la cisterna diverge).
- Secondo magazzino «serbatoio trattore» come giacenza parallela. Il serbatoio è la finestra tra due pieni, non un prodotto.
- Card separate Benzina / AdBlue / Gasolio.
- Apprendimento per `terrenoId` o per tipo lavoro in v1.
- Formula inventata L/h da CV.

---

## 2. Cosa c’è già (non reinventare)

| Pezzo | Dove | Usare così |
|-------|------|------------|
| Categorie prodotto | `modules/magazzino/config/categorie-prodotto.js` | Aggiungere `{ id: 'carburante', nome: 'Carburante', icona: '⛽' }` |
| Obblighi dosaggio/carenza | `core/js/prodotto-form-required.js` | Non aggiungere `carburante` alle liste |
| Form prodotto / movimenti | `prodotti-standalone.html`, `movimenti-standalone.html` | Stessi form; filtro categoria / query string |
| Giacenza atomica | `prodotti-service.aggiornaGiacenzaProdotto` + `FieldValue.increment` | Ogni carico/pieno passa da qui |
| Collegamento lavoro/attività | `MovimentoMagazzino.lavoroId` / `attivitaId` | Resta; per il **pieno** serve anche `macchinaId` (nuovo, opzionale) |
| Sotto scorta + Tony | `buildContextAzienda` → `summarySottoScorta`; segnale `sottoScorta` | Un prodotto Gasolio con soglia basta |
| Tracciabilità consumi | `tracciabilita-consumi-standalone.html` | Filtro `?categoria=carburante` |
| Tony Occhi | `core/js/tony/document-product-match.js` | Keywords gasolio/diesel/benzina/adblue → `carburante` |
| Mezzi su lavoro / diario | `Lavoro.macchinaId` + `attrezzoId`; `Attivita.macchinaId` + `attrezzoId` + `oreMacchina` | Chiave coppia e ore della finestra |
| Ore macchina servizio | `modules/parco-macchine/services/macchine-utilizzo-service.js` | Non duplicare il contatore ore |
| Morfologia terreno | `tipoCampo` pianura \| collina \| montagna | Solo se si apre il raffinamento D14, non in v1 |
| Home Magazzino a card | `magazzino-home-standalone.html` | Nuova card → hub |
| Rotte Tony magazzino | `core/config/tony-routes.json`, `tony-module-gate.js` | Nuovo target `carburante` |
| Canone lista | `currentTableData` + merge `setContext('page')` + `table-data-ready` | Hub e liste nuove |

Pagine golden da copiare (struttura, non contenuto): `magazzino-home-standalone.html`, `manodopera-home-standalone.html`, `prodotti-standalone.html`.

---

## 3. Due verità e algoritmo (vincolante)

### 3.1 Cisterna (misurata)

- **Carico:** entrata su prodotto categoria `carburante` → `giacenza += q`.
- **Pieno:** uscita sullo stesso prodotto, con `macchinaId` → `giacenza -= q`.
- Reminder e «quanto carburante è rimasto?» leggono solo questo.

### 3.2 Finestra di un mezzo

Tra il pieno *N−1* e il pieno *N* dello **stesso** `macchinaId`:

1. Raccogliere lavori e attività in quella fascia con lo stesso `macchinaId` e ore macchina > 0.
2. Raggruppare per coppia `(macchinaId, attrezzoId)` (`attrezzoId` assente = coppia «solo trattore»).
3. Classificare:
   - **Pulita:** una sola coppia. `litroOra = litriPieno / oreCoppia`. Aggiornare il documento coppia (media ponderata sulle finestre successive). Scrivere le quote sul/i lavoro/i di quella coppia (se più lavori stesso attrezzo: spezzare in proporzione alle ore).
   - **Mista:** due o più coppie. **Non** aggiornare alcun L/h. Se **tutte** le coppie hanno `litroOra` (imparato o override), ripartire: `quota_i = litriPieno × (ore_i × litroOra_i) / Σ(ore × litroOra)`. Se manca anche un solo tasso, **nessuna quota** sui lavori (standby apprendimento). Il pieno resta contabilizzato in cisterna.
4. Prima del pieno *N* non chiudere la finestra: si può mostrare una **stima** (ore × L/h noti) etichettata come stima, mai come fatto.

### 3.3 Ore da usare

Ordine (non inventare fallback oltre questo elenco):

1. `Attivita.oreMacchina` se l’attività è nel diario e ha il mezzo.
2. Per un lavoro Manodopera: somma ore macchina registrate nel periodo (segnatura ore / utilizzo macchina collegato al lavoro). Se esiste solo ora operaio e non ora macchina, **non** usare le ore persona come se fossero macchina: la finestra resta incompleta per quella riga (escluderla dalla classificazione, non fingere).
3. Se dopo il filtro non resta nessuna ora macchina, la finestra non è classificabile: pieno ok, niente apprendimento né quote.

Dettaglio di *quale* collection ore usare ( `oreOperai` vs documenti utilizzo) va verificato sul codice al momento dell’implementazione Fase 3 e scritto nel changelog della fase. Non introdurre un terzo contatore.

### 3.4 Formule

Finestra pulita:

```
litroOraCoppia = litriPieno / oreCoppia
```

Aggiornamento media (n = numero finestre pulite già assorbite):

```
nuovo = (vecchio × n + litroOraCoppia) / (n + 1)
```

Override manager sulla coppia: vince sull’imparato finché non viene rimosso. Le finestre pulite successive **non** sovrascrivono l’override (aggiornano al massimo un campo `ultimoOsservato` per confronto).

Finestra mista con tassi noti:

```
peso_i = ore_i × litroOra_i
quota_i = litriPieno × peso_i / Σ pesi
```

Stesso trattore, solo L/h trattore, senza tassi coppia: i L/h del trattore **si elidono**. Non usarli per spartire una mista: sarebbe uno split per ore, vietato come «consumo vero». Split per ore solo se si etichetta esplicitamente «grezzo, tassi assenti» — **non in v1** (D12: nessuna quota).

---

## 4. Modello dati (proposta di implementazione)

Niente secondo magazzino. Estendere il movimento; aggiungere due collection leggere.

### 4.1 Categoria

`CATEGORIE_PRODOTTO` + option HTML + stem Tony + keywords Occhi. Id stabile: `carburante`.

Sinonimi da normalizzare (client + CF FILTER_TABLE): carburante, carburanti, gasolio, diesel, benzina, adblue, ad blue, urea.

### 4.2 `MovimentoMagazzino` — campi nuovi opzionali

| Campo | Tipo | Uso |
|-------|------|-----|
| `macchinaId` | string \| null | Pieno (uscita) o eventuale carico attribuito a un mezzo. Assente sui movimenti non carburante. |
| `origineCarburante` | `'carico_cisterna' \| 'pieno' \| null` | Distingue i due gesti UX senza un nuovo `tipo` movimento. |

`tipo` resta solo `entrata` \| `uscita`. Validazione: se `origineCarburante === 'pieno'` allora `tipo === 'uscita'` e `macchinaId` obbligatorio.

### 4.3 Collection `consumiCoppiaMacchina`

Path: `tenants/{tenantId}/consumiCoppiaMacchina/{macchinaId}_{attrezzoKey}`  
`attrezzoKey` = `attrezzoId` oppure `nessuno`.

| Campo | Note |
|-------|------|
| `macchinaId`, `attrezzoId` | `attrezzoId` null se solo trattore |
| `litroOra` | Valore usato per ripartire (override se presente, senno imparato) |
| `litroOraImparato` | Media finestre pulite |
| `nFinestrePulite` | Intero ≥ 0 |
| `ultimoOsservato` | Ultima finestra pulita (anche con override) |
| `overrideManager` | number \| null |
| `aggiornatoIl` | Timestamp |

Il manager non crea righe a mano in una griglia: la riga nasce alla prima finestra pulita, oppure se salva un override.

### 4.4 Collection `consumiCarburanteLavoro` (quote, non giacenza)

Path: `tenants/{tenantId}/consumiCarburanteLavoro/{id}`

| Campo | Note |
|-------|------|
| `movimentoPienoId` | Uscita cisterna che chiude la finestra |
| `lavoroId` / `attivitaId` | Uno dei due |
| `macchinaId`, `attrezzoId` | Coppia |
| `terrenoId` | Copia dal lavoro/attività, solo report |
| `prodottoId` | Quale carburante |
| `quantitaL` | Quota allocata |
| `stato` | `'imparato' \| 'ripartito'` (mai `'grezzo'` in v1) |
| `finestraDa`, `finestraA` | Timestamp dei due pieni |

Eliminazione/modifica di un pieno: ricalcolare o cancellare le quote di quella finestra (stesso spirito dello sync scarico trattamenti: non lasciare orfani).

### 4.5 Parco Macchine

Su `Macchina` (solo `tipoMacchina === 'trattore'`): campo opzionale `consumoMedioLitroOra` (number \| null). Solo stima «di massima» e confronto mezzi. **Non** entra nella ripartizione mista v1.

Sull’attrezzo: **nessun** campo consumo.

### 4.6 Regole Firestore

Estendere `firestore.rules` per le due collection nuove: stesso perimetro tenant + ruoli manager/admin in scrittura; lettura tenant. I pieni restano `movimentiMagazzino` (regole già esistenti). Deploy rules separato dal codice client, come da pratica repo.

---

## 5. Fasi di consegna

### Fase 0 — Categoria `carburante` (fondazione)

**Done:** si crea un prodotto «Gasolio agricolo», categoria Carburante, unità L, scorta minima; compare in filtri; Tony e Occhi la riconoscono; nessun dosaggio obbligatorio.

File tipici (elenco da verificare, non copiare alla cieca):

- `modules/magazzino/config/categorie-prodotto.js`
- option in `prodotti-standalone.html`, `prodotti-test-bootstrap.html`, `tracciabilita-consumi-standalone.html`
- `core/config/tony-form-mapping.js` (description select)
- `core/js/tony-prodotto-create-local.js` (`CATEGORIA_STEMS`)
- `core/js/tony/main.js` (sinonimi FILTER_TABLE prodotti)
- `functions/index.js` (testo FILTER_TABLE + regex prodotti)
- `core/js/tony/document-product-match.js` (`CATEGORIA_KEYWORDS`)
- commento `Prodotto.js`
- test: `tests/prodotto-form-required.test.js` (carburante **non** richiede dosaggio/carenza); eventuale test stem/match categoria

**Non fare in Fase 0:** hub, `macchinaId` sul movimento, apprendimento.

### Fase 1 — Hub Carburante

**Done:** dalla home Magazzino la card **Carburante** apre `carburante-home-standalone.html` (nome da confermare, stesso folder `modules/magazzino/views/`). KPI: litri prodotti categoria carburante, sotto scorta, movimenti 30 gg filtrati. Card interne: Scorta (prodotti `?categoria=carburante`), Carico (movimenti preimpostati, v. Fase 2), Consumi/tracciabilità `?categoria=carburante`, Prodotti filtrati.

Canone: placeholder `pageType: 'carburante_hub'`, merge `setContext('page')`, evento `table-data-ready`.

Tony: target `carburante` / «portami al carburante» / «hub carburante» in `tony-routes.json`, `TONY_PAGE_MAP`, `tony-module-gate.js` (stesso modulo `magazzino`). Non confermare un reminder Magazzino generico quando l’utente chiede il carburante (stesso guard 2026-09-21 destinazione diversa).

**Non fare in Fase 1:** logica pieni/apprendimento. Carico può puntare a movimenti con query; il prefill stretto è Fase 2.

### Fase 2 — Carico cisterna e pieno mezzo

**Done:**

- Card **Carico** apre il `movimento-form` con `tipo=entrata`, dropdown prodotti solo `carburante`, `origineCarburante=carico_cisterna`.
- Card / azione **Pieno** apre lo stesso form con `tipo=uscita`, prodotti `carburante`, `macchinaId` obbligatorio, `origineCarburante=pieno`.
- Giacenza aggiornata solo da questi movimenti (increment esistente).
- Lista movimenti resta il registro completo; filtri capiscono categoria e, se utile, `origineCarburante`.
- Senza Parco Macchine: Pieno nascosto o disabilitato con messaggio; Carico resta.

Campi form: riusare `movimento-form` + query (`?categoria=carburante&tipo=entrata` / `tipo=uscita&pieno=1`). Evitare un secondo form clonato. Se il DOM del pieno richiede `macchinaId`, estendere mapping `MOVIMENTO_FORM_MAP` in `tony-form-mapping.js` (campo nuovo), non un formId dedicato se evitabile.

Tony: «è arrivato il gasolio, 800 litri» → OPEN_MODAL/inject movimento entrata filtrato; «ho fatto il pieno al T5, 80 litri» → uscita + macchina (disamb. mezzi già esistente sul lavoro, riusare pattern nomi trattore).

Test: unit su validazione pieno; canary emulator giacenza (carico + pieno, niente doppio scarico). Allineare a `tests/services/giacenza-increment.test.js`.

### Fase 3 — Apprendimento e ripartizione

**Done:** servizio puro (testabile senza UI) che, al save/delete di un pieno, chiude la finestra, classifica, aggiorna `consumiCoppiaMacchina`, scrive/cancella `consumiCarburanteLavoro`. UI hub: elenco coppie con L/h imparato; su un lavoro, litri se presenti. Giornate miste senza tassi: nessun numero sui lavori.

File nuovi previsti (nomi indicativi):

- `modules/magazzino/lib/carburante-finestra.js` — classificazione e formule (zero I/O)
- `modules/magazzino/services/carburante-consumi-service.js` — lettura lavori/attività/ore + write
- `tests/carburante-finestra.test.js` — pulita, mista con tassi, mista senza tassi, delete pieno, override

Campo `consumoMedioLitroOra` sul trattore: in questa fase, solo anagrafica + eventuale stima in UI. Non usarlo per spartire miste.

### Fase 4 — Tony e reminder (dopo che i dati esistono)

**Done:** «quanto gasolio è rimasto?» usa prodotti `carburante` + `summarySottoScorta` (eventuale `summaryCarburante` in Context Builder se il testo generico è povero — solo se i test lo richiedono, non a priori). «quanto ha bevuto il T5 con l’erpice?» legge `consumiCoppiaMacchina`, non ricalcola in chat. Nav all’hub. Occhi: scontrino distributore → categoria carburante.

Invalidazione cache Tony: se si scrive `consumiCoppiaMacchina`, aggiungere il path a `invalidateTonyContextCache` come per `movimentiMagazzino`.

---

## 6. Tony — elenco config da toccare (Fase 0–1–4)

| Punto | File |
|-------|------|
| Rotta hub | `core/config/tony-routes.json` |
| Gate + sinonimi | `core/config/tony-module-gate.js`, `functions/tony-module-gate.js` |
| PAGE_MAP / nav quick reply | `core/js/tony/engine.js`, `functions/tony-nav-quick-reply.js` |
| FILTER_TABLE categoria | `core/js/tony/main.js` `FILTER_KEY_MAP` / `normalizeTonyProdottiCategoriaValue` |
| Form mapping | `core/config/tony-form-mapping.js` |
| Creazione prodotto locale | `core/js/tony-prodotto-create-local.js` |
| Occhi match | `core/js/tony/document-product-match.js` |
| Istruzioni CF | `functions/index.js` (elenco value categoria) |
| Test nav/filter | `tests/tony-nav-quick-reply.test.js`, `tests/tony-filter-table-quick-reply.test.js` se si aggiungono regole |

Niente prompt lungo hardcoded «se l’utente parla di gasolio fai X» se si può risolvere con target + categoria.

---

## 7. UX hub (Fase 1) — copy

- Titolo: **Carburante**
- Sottotitolo: scorta cisterna, carichi e pieni
- Card **Scorta**: giacenza e soglie dei prodotti carburante
- Card **Carico**: registrare arrivo in cisterna
- Card **Pieni e consumi**: rifornimenti dei mezzi; in Fase 3 anche L/h coppie
- Card **Prodotti**: anagrafica solo categoria carburante
- Link indietro dell’hub: home Magazzino, non dashboard ERP (stesso pattern hub Manodopera)
- Link indietro delle sottopagine (Scorta, Carico, Pieno, Prodotti, elenco consumi): **← Dashboard carburante**, verso l’hub. Così si torna alle card senza ripassare dalla home Magazzino. Se si toglie il filtro categoria, il pulsante torna alla home Magazzino.

KPI in testa: litri totali (somma giacenze prodotti `carburante` in L), n. sotto scorta, ultimo carico.

---

## 8. Test minimi per fase

| Fase | Test |
|------|------|
| 0 | `prodottoCategoriaRichiedeDosaggio('carburante') === false`; stem «gasolio» → `carburante`; suggest Occhi su «GASOLIO AGRICOLO» |
| 1 | Hub nel gate magazzino; `pageType` `carburante_hub`; card visibile solo con modulo magazzino |
| 2 | Carico +100 L → giacenza +100; due pieni paralleli non corrompono (increment); pieno senza `macchinaId` rifiutato |
| 3 | Fixture: 80 L, trincia 4 h @14, trattamento 5 h @9 → quote ~50.9 e ~29.1; stessa fixture senza tassi → 0 quote, coppie invariate; finestra pulita 72 L / 6 h → 12 L/h; secondo pulito 60 L / 6 h → media 11; delete secondo pieno ripristina quote/media |
| 4 | Nav «portami al carburante»; filtro prodotti categoria |

Canary emulator: solo quando la fase tocca Firestore (2 e 3). Pattern: `npm run magazzino:giacenza-canary`.

---

## 9. Dopo il lavoro (agenti)

Aggiornare **solo**:

1. Questo file (tabella stato / fase done)
2. `docs-sviluppo/COSA_ABBIAMO_FATTO.md`
3. `docs-sviluppo/tony/STATO_ATTUALE.md` se cambiano comandi, `currentTableData`, reminder
4. `docs-sviluppo/tony/MASTER_PLAN.md` solo se cambia lo stato di una fase Tony in tabella
5. `docs-sviluppo/TONY_DECISIONI_E_REQUISITI.md` §28 da «da fare» a «implementato»

Non aggiornare `DOBBIAMO_ANCORA_FARE.md`, `RIEPILOGO_CURRENTTABLEDATA_PER_MODULO_LISTE.md`, guide utente finché non c’è UI.

---

## 10. Stato implementazione

| Area | Stato | Note |
|------|-------|------|
| Categoria `carburante` | ✅ | Fase 0 (2026-10-02) |
| Hub card Carburante | ✅ | Fase 1 (2026-10-02) |
| Carico cisterna UX | ✅ | Fase 2 (2026-10-02): `?categoria=carburante&tipo=entrata`, origine `carico_cisterna` |
| Pieno con `macchinaId` | ✅ | Fase 2 (2026-10-02): `?tipo=uscita&pieno=1`, mezzo obbligatorio, gate Parco Macchine |
| `consumoMedioLitroOra` trattore | ❌ | Fase 3 (anagrafica) |
| Apprendimento coppia | ❌ | Fase 3 |
| Ripartizione giornate miste | ❌ | Fase 3 |
| Quote per lavoro / report terreno | ❌ | Fase 3 (terreno solo denormalizzato) |
| Tony nav + Occhi keywords | ⏳ | Nav + keywords + stem ✅ (2026-10-02). Domande «quanto è rimasto» = Fase 4 |
| Raffinamento `tipoCampo` | ❌ fuori v1 | D14 |

---

## 11. Changelog del piano

| Data | Nota |
|------|------|
| 2026-10-02 | Prima stesura. Modulo Magazzino, card Carburante, categoria `carburante`, due verità, apprendimento solo da finestre pulite, no L/h attrezzo, no chiave terreno. |
| 2026-10-02 | Fase 0–1 implementate: categoria, hub, rotte/gate/nav Tony, match Occhi. |
| 2026-10-02 | Fase 2: carico cisterna e pieno mezzo sullo stesso movimento-form. Giacenza solo da increment. |
| 2026-10-02 | Sottopagine carburante: pulsante «← Dashboard carburante» verso l’hub, non verso la home Magazzino. |
| 2026-10-02 | Handoff agente §12: branch, cosa è in codice, prossimo passo Fase 2, come vedere in locale. |

---

## 12. Handoff per l’agente successivo (2026-10-02)

**Branch:** `cursor/carburante-piano-898d` (PR verso `develop`, non `main`).  
**Head:** `8dae312` *feat(magazzino): categoria e hub Carburante (Fase 0–1)*; prima `6c34774` *docs: piano Carburante*.  
**Vedere in locale:** checkout di quel branch. `main` / GitHub Pages **non** hanno questo lavoro. `develop` non è pubblicato.

**Fatto:** Fase 0 (categoria), Fase 1 (hub e nav), Fase 2 (carico cisterna e pieno mezzo sullo stesso `movimento-form`, `macchinaId` obbligatorio sul pieno, giacenza solo da increment).  
**Prossimo:** Fase 3 — servizio puro `carburante-finestra.js` + `carburante-consumi-service.js` (giornata pulita impara, mista ripartisce o standby). **Non** saltare alle domande Tony della Fase 4.

**Prompt completo da incollare:** vedi messaggio utente / conversazione 2026-10-02 «prompt handoff agente carburante». Decisioni bloccate: §1 di questo file e `TONY_DECISIONI_E_REQUISITI.md` §28.
