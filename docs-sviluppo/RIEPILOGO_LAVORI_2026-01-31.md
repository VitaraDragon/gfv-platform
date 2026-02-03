# 📋 Riepilogo Lavori - 2026-01-31

## 🎯 Obiettivo: Sistemazione completa pagina Gestione Raccolta Frutta

Sistemare la pagina Raccolta Frutta: zona da lavoro (zone lavorate), formattazione superficie, colonna Lavoro con link "Vedi Lavoro", pulsante Dashboard e ordine pulsanti come in Gestione Vendemmia.

---

## 1. ✅ Sincronizzazione zona da lavoro (zone lavorate)

### Contesto
La zona tracciata dagli operai/capisquadra nel documento lavoro (`zoneLavorate`) non era visibile nelle mappe di Gestione Raccolta Frutta quando si modificava una raccolta collegata a quel lavoro.

### Funzionalità implementate

#### File modificato: `modules/frutteto/views/raccolta-frutta-standalone.html`
- ✅ Funzione `loadPoligonoFromZoneLavorate(lavoroId)`: legge la sottocollezione `zoneLavorate` del lavoro e restituisce la prima zona chiusa (array di coordinate) per disegnarla sulla mappa.
- ✅ In `openEditRaccolta()`: se la raccolta ha `lavoroId` e non ha ancora un poligono proprio (`poligonoCoords` vuoto), viene chiamata `loadPoligonoFromZoneLavorate(raccolta.lavoroId)` e, se presente una zona valida (≥ 3 punti), `poligonoCoords` viene pre-popolato e la mappa aggiornata. Al primo salvataggio la zona viene salvata sul documento di raccolta.

---

## 2. ✅ Formattazione superficie raccolta (ha)

### Contesto
Il campo "Superficie raccolta (ha)" nel modal di creazione/modifica poteva mostrare valori non formattati (es. molti decimali). Richiesta visualizzazione con due decimali.

### Funzionalità implementate

#### File modificato: `modules/frutteto/views/raccolta-frutta-standalone.html`
- ✅ Quando si apre il modal in modifica (o si precompila la superficie da lavoro/da poligono), il valore in ha viene formattato con `.toFixed(2)` prima di essere scritto in `quantitaEttari`.
- ✅ In tabella lista raccolte la colonna superficie usa già `Number(r.quantitaEttari).toFixed(2)`.

---

## 3. ✅ Colonna "Lavoro" e link "🔗 Vedi Lavoro"

### Contesto
Nella tabella lista vendemmie è presente una colonna con link "🔗 Vedi Lavoro" per le righe collegate a un lavoro; nella tabella raccolte mancava.

### Funzionalità implementate

#### File modificato: `modules/frutteto/views/raccolta-frutta-standalone.html`
- ✅ Aggiunta la colonna **Lavoro** nella tabella delle raccolte.
- ✅ Se la raccolta ha `lavoroId`, nella cella viene mostrato il link "🔗 Vedi Lavoro" (classe `link-lavoro`, stile a tema Frutteto) che apre la pagina gestione lavori con `?lavoroId=...` in nuova scheda.
- ✅ Comportamento allineato alla Gestione Vendemmia.

---

## 4. ✅ Pulsante "← Dashboard" funzionante

### Contesto
Nella pagina Gestione Raccolta Frutta era presente un pulsante "← Dashboard" con `href="#"`, quindi non portava alla dashboard del modulo Frutteto.

### Funzionalità implementate

#### File modificato: `modules/frutteto/views/raccolta-frutta-standalone.html`
- ✅ Impostato `href="frutteto-dashboard-standalone.html"` sul link con `id="back-dashboard-btn"`.
- ✅ Aggiunto listener sul click di `back-dashboard-btn` che chiama `preventDefault()` e naviga con `resolvePath('./frutteto-dashboard-standalone.html')`.

---

## 5. ✅ Ordine pulsanti come in Gestione Vendemmia

### Contesto
Nella Gestione Vendemmia l’ordine dei pulsanti nell’header è: **Nuova Vendemmia** → **← Vigneti** → **← Dashboard**. In Raccolta Frutta l’ordine era diverso (Dashboard, Frutteti, Nuova raccolta).

### Funzionalità implementate

#### File modificato: `modules/frutteto/views/raccolta-frutta-standalone.html`
- ✅ Riordinati i pulsanti nell’header: **Nuova raccolta** → **← Frutteti** → **← Dashboard** (stesso ordine di Vendemmia).
- ✅ Icona del pulsante Frutteti uniformata da ⬅ a ←.

---

## 6. ✅ Lista condivisa forma di allevamento in Calcolo materiali

### Contesto
Il dropdown "Tipo impianto / Forma di allevamento" nella pagina Calcolo materiali usava liste diverse da quelle di Pianificazione nuovo impianto, creando discrepanze per l’utente. Inoltre la precompilazione dalla pianificazione doveva funzionare allo stesso modo per vigneto e frutteto.

### Funzionalità implementate
- **Vigneto**: il dropdown Tipo impianto è popolato con `getFormeAllevamentoList()` (stessa lista di Pianificazione, con varianti tipo "Guyot semplice"). Valore nel select = nome visualizzato; in invio al service si passa la chiave tramite `getChiaveTecnica()`.
- **Frutteto**: il dropdown è popolato con `FORME_ALLEVAMENTO_FRUTTETO` + valori custom da `localStorage` (`frutteto_forma_allevamento_custom`), come in Pianificazione. Precompilazione da `pianificazione.formaAllevamento`; in invio si usa `normalizeFormaAllevamentoToKey()`.
- **Precompilazione**: alla selezione di una pianificazione, il campo forma/tipo impianto viene impostato con il valore salvato nella pianificazione; se il valore non è in lista (es. custom) viene aggiunta un’opzione.
- **File**: `modules/vigneto/views/calcolo-materiali-standalone.html` (import `getFormeAllevamentoList`, `getConfigurazioneImpianto`; `populateTipoImpiantoSelect` async con liste vigneto/frutteto/oliveto; precompilazione da `formaAllevamento`; `setupEventListeners` e placeholder che risolvono la config da label; passaggio chiave al service in fase di calcolo).

---

## 7. ✅ Forma di allevamento in Pianificazione nuovo impianto (frutteto)

### Contesto
Nel modal di Pianificazione nuovo impianto il campo "Forma di allevamento" era visibile e precompilato solo per vigneto; per frutteto il gruppo era nascosto.

### Funzionalità implementate
- Visibilità del gruppo "Forma di allevamento" gestita dalla config della coltura: `getConfigColtura(pianificazione.tipoColtura).showFormaAllevamento` (vigneto, frutteto e oliveto hanno già `showFormaAllevamento: true` in `shared/config/pianificazione-impianto-colture.js`).
- Precompilazione: per vigneto si converte la chiave in nome visualizzato; per frutteto/oliveto si imposta direttamente il valore salvato.
- Salvataggio: per vigneto si salva la chiave tecnica; per frutteto/oliveto si salva il valore selezionato (nome visualizzato).
- **File**: `modules/vigneto/views/pianifica-impianto-standalone.html` (mostra/nascondi gruppo in modifica, precompilazione e lettura forma allevamento per tutte le colture).

---

## 8. ✅ Calcolo materiali frutteto – Distanza e altezza pali per forma

### Contesto
La distanza tra i pali nei frutteti dipende dalla forma di allevamento (letteratura: spalliera/palmetta 3–5 m, fusetto 6–8 m, pergola/kiwi ~5 m, vaso più ampio). I default nel modal Calcolo materiali andavano adattati.

### Funzionalità implementate
- In `TIPI_IMPIANTO_FRUTTETO` aggiunti `distanzaPali` e `altezzaPali` (metri) per ogni forma: fusetto/leader 7 m / 3,2 m; palmetta/spalliera/cordone 4 m / 3,2 m; pergola 5 m / 3,5 m; vaso/vaso_globoso 6 m / 3 m; altro 5 m / 3 m. Descrizioni aggiornate con cenno alla distanza pali.
- Nel modal Calcolo materiali, per **frutteto** e **oliveto**, al cambio "Tipo impianto / Forma di allevamento" vengono precompilati anche "Distanza tra Pali (m)" e "Altezza Pali (m)" dalla config della forma.
- **File**: `modules/vigneto/services/calcolo-materiali-service.js` (distanzaPali, altezzaPali in ogni voce `TIPI_IMPIANTO_FRUTTETO`); `modules/vigneto/views/calcolo-materiali-standalone.html` (precompilazione distanza/altezza pali nel listener change tipo impianto per frutteto/oliveto).

---

## 9. ✅ Gestione lavori – Impianto Nuovo Frutteto (stesso comportamento del vigneto)

### Contesto
Alla conferma di un impianto frutteto non c’era lo stesso flusso del vigneto: mancavano il form "Dati Frutteto" e la creazione dell’anagrafica frutteto dal lavoro.

### Funzionalità implementate
- **Dropdown Pianificazione**: per tipo lavoro "Impianto Nuovo Frutteto" vengono caricate solo pianificazioni confermate con `tipoColtura === 'frutteto'`.
- **Form Dati Frutteto**: quando si seleziona una pianificazione frutteto appare il blocco "🍎 Dati Frutteto" (stessa posizione del form vigneto) con: Specie *, Varietà *, Anno Impianto *, Forma Allevamento * (lista da `specie-fruttifere.js` + custom), Distanza File/Unità, Superficie, Densità (readonly dalla pianificazione), Note. Pulsanti ➕ per aggiungere specie/varietà/forma (salvataggio in localStorage).
- **Precompilazione**: `precompilaFormFruttetoDaPianificazione(pianificazione)` popola dropdown e campi dalla pianificazione; varietà dipendente dalla specie (listener su cambio specie). Funzione unica `precompilaFormImpiantoDaPianificazione(pianificazione)` mostra il form vigneto o frutteto in base a `pianificazione.tipoColtura`.
- **Creazione frutteto alla conferma**: in `handleSalvaLavoro`, se tipo lavoro è "Impianto Nuovo Frutteto" e c’è `pianificazioneId`, viene chiamata `creaFruttetoDaLavoro()` che legge il form frutteto e la pianificazione e chiama `createFrutteto()` del modulo frutteto.
- **Required**: `setFruttetoFormRequired(true/false)` per non bloccare il submit quando il form frutteto è nascosto; chiamata a init e al cambio tipo lavoro/pianificazione.
- **File**: `core/admin/gestione-lavori-standalone.html` (blocco `#frutteto-form-group`, modali specie/varietà/forma frutteto, `setFruttetoFormRequired`, `precompilaFormImpiantoDaPianificazione`, `precompilaFormFruttetoDaPianificazione`, handler open/add per modali frutteto); `core/admin/js/gestione-lavori-events.js` (`creaFruttetoDaLavoro`, chiamata in `handleSalvaLavoro` per Impianto Nuovo Frutteto).

---

## 10. ✅ Pagine e card Potatura e Trattamenti – Modulo Vigneto

### Contesto
Il modulo Vigneto aveva già servizi e modelli per Potatura e Trattamenti (`potatura-vigneto-service.js`, `trattamenti-vigneto-service.js`, modelli `PotaturaVigneto`, `TrattamentoVigneto`) ma non aveva pagine standalone né card in dashboard; il modulo Frutteto le aveva già.

### Funzionalità implementate
- **Potatura vigneto:** creata `modules/vigneto/views/potatura-standalone.html` – filtro vigneto/anno, tabella potature (data, tipo invernale/verde/rinnovo/spollonatura, parcella, ceppi potati, ore, costo), modal Nuova/Modifica con campi del modello vigneto. Integrazione con `potatura-vigneto-service.js`.
- **Trattamenti vigneto:** creata `modules/vigneto/views/trattamenti-standalone.html` – stessa struttura, tema vigneto, modal con prodotto, dosaggio, tipo, operatore, superficie, costi, giorni di carenza. Integrazione con `trattamenti-vigneto-service.js`.
- **Dashboard vigneto:** aggiunte due card nelle Azioni rapide: **Potatura** (→ `potatura-standalone.html`) e **Trattamenti** (→ `trattamenti-standalone.html`), posizionate dopo “Gestione Vendemmia” e prima di “Statistiche e Grafici”.

### File toccati
- Creati: `modules/vigneto/views/potatura-standalone.html`, `modules/vigneto/views/trattamenti-standalone.html`
- Modificato: `modules/vigneto/views/vigneto-dashboard-standalone.html` (card Potatura e Trattamenti)

---

## 11. ✅ Piano “Potatura e Trattamenti da lavori e attività”

### Contesto
Le pagine Potatura e Trattamenti oggi sono registri a inserimento manuale. Si è concordato di pianificare l’evoluzione: dati base che provengono da lavori e attività (Gestione lavori + Diario), pagine dedicate per consultazione e compilazione dei soli dati aggiuntivi (stesso procedimento di Vendemmia e Raccolta), dati base in sola lettura.

### Funzionalità implementate
- Creato il documento **`PIANO_POTATURA_TRATTAMENTI_DA_LAVORI.md`** con: obiettivo; scelte concordate (origine da lavori e attività; riconoscimento per categoria Potatura/Trattamenti; collegamento vigneto/frutteto tramite terreno 1:1; allineamento a Vendemmia/Raccolta; creazione solo da lavoro/attività; dati base in sola lettura); flusso utente; implicazioni da definire in fase di analisi; cosa non è in scope; riepilogo. Nessun codice, solo pianificazione.

### File toccati
- Creato: `PIANO_POTATURA_TRATTAMENTI_DA_LAVORI.md`

---

## 📁 File toccati

| Azione   | Path |
|----------|------|
| Modificato | `modules/frutteto/views/raccolta-frutta-standalone.html` (loadPoligonoFromZoneLavorate, sync in openEditRaccolta, superficie .toFixed(2), colonna Lavoro e link Vedi Lavoro, href Dashboard, listener resolvePath, ordine e icona pulsanti header) |
| Modificato | `modules/vigneto/views/calcolo-materiali-standalone.html` (lista condivisa tipo impianto vigneto/frutteto, precompilazione da pianificazione, distanza/altezza pali per frutteto/oliveto) |
| Modificato | `modules/vigneto/services/calcolo-materiali-service.js` (distanzaPali, altezzaPali in TIPI_IMPIANTO_FRUTTETO) |
| Modificato | `modules/vigneto/views/pianifica-impianto-standalone.html` (forma allevamento visibile e salvata per frutteto/oliveto) |
| Modificato | `core/admin/gestione-lavori-standalone.html` (form frutteto impianto, modali, precompilazione, setFruttetoFormRequired) |
| Modificato | `core/admin/js/gestione-lavori-events.js` (creaFruttetoDaLavoro, chiamata in handleSalvaLavoro) |
| Creato | `modules/vigneto/views/potatura-standalone.html` |
| Creato | `modules/vigneto/views/trattamenti-standalone.html` |
| Modificato | `modules/vigneto/views/vigneto-dashboard-standalone.html` (card Potatura e Trattamenti) |
| Creato | `PIANO_POTATURA_TRATTAMENTI_DA_LAVORI.md` |

---

## Riferimenti

- `COSA_ABBIAMO_FATTO.md` – sezione 2026-01-31 (Raccolta Frutta + lista condivisa calcolo materiali, forma allevamento pianificazione, pali frutteto, gestione lavori impianto frutteto; Potatura/Trattamenti vigneto/frutteto + piano da lavori)
- Riferimento tabella e pulsanti: `modules/vigneto/views/vendemmia-standalone.html` (colonna Lavoro, ordine Nuova Vendemmia, ← Vigneti, ← Dashboard)
- Piano evoluzione: `PIANO_POTATURA_TRATTAMENTI_DA_LAVORI.md`
