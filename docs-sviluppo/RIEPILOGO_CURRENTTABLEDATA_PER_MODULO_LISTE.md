# Riepilogo: `window.currentTableData` per pagine lista (Tony)

**Ultimo aggiornamento: 2026-03-08.** *(Riferimenti file: sendMessage in core/js/tony/main.js.)*

Questo documento descrive il pattern usato per esporre i dati della tabella a Tony. **Pagine con currentTableData già attivo**: terreni, attivita (diario), **gestione lavori**, Macchine (trattori, attrezzi, flotta, scadenze, guasti), Magazzino (prodotti, movimenti). **Pagine ancora da dotare**: vigneti, clienti, ecc.

---

## 1. Placeholder in testa alla pagina

I dati vengono letti dal widget **al momento dell’invio**; se l’utente scrive prima che la tabella sia renderizzata, `window.currentTableData` sarebbe `undefined`. Per evitare risposte "Non ho le competenze" si inizializza subito un placeholder.

### 1.1 Script sincrono subito dopo la config base

Inserire **subito dopo** lo script che imposta `window.GFV_CONFIG_BASE` (e prima di `config-loader.js` o degli import del modulo) uno script che imposta il placeholder:

```html
<script>window.GFV_CONFIG_BASE = '../../../core';</script>
<script>window.currentTableData = window.currentTableData || { pageType: 'prodotti', summary: 'Caricamento dati in corso...', items: [] };</script>
<script src="../../../core/js/config-loader.js"></script>
```

- **`pageType`**: identificativo della pagina (es. `'prodotti'`, `'movimenti'`, `'trattori'`).
- **`summary`**: messaggio iniziale; Tony userà "Sto ancora leggendo i dati della lista..." se vede "Caricamento dati in corso...".
- **`items`**: array vuoto fino al primo render.

Se la pagina non usa `GFV_CONFIG_BASE` nello stesso modo, lo script del placeholder va comunque **prima** del modulo che fa il fetch dei dati (così `window.currentTableData` esiste già al primo caricamento).

### 1.2 Fallback all’inizio del modulo (IIFE)

All’inizio della funzione asincrona del modulo (subito dopo `(async function() {`), rassicurarsi che il placeholder ci sia:

```javascript
(async function() {
    if (!window.currentTableData || !window.currentTableData.summary || window.currentTableData.summary === '') {
        window.currentTableData = { pageType: 'prodotti', summary: 'Caricamento dati in corso...', items: [] };
    }
    const waitForConfig = () => window.GFVConfigLoader.waitForConfig();
    // ... resto init Firebase, loadTonyAfterFirebase, ecc.
```

Così anche se lo script in testa non è stato eseguito (o è in un altro contesto), al primo run del modulo `window.currentTableData` ha almeno il placeholder.

---

## 2. Definizione di `window.currentTableData` in renderTable / renderProdotti

Ogni volta che la tabella viene ridisegnata (dati caricati, filtri cambiati), aggiornare `window.currentTableData` e notificare Tony.

### 2.1 Struttura dell’oggetto

```javascript
window.currentTableData = {
    pageType: 'prodotti',           // identifica la pagina (prodotti, movimenti, trattori, …)
    summary: '...',                 // una frase che riassume i dati (per Tony e per il log)
    items: [                        // array di oggetti, uno per riga visibile (dopo filtri)
        { codice: '...', nome: '...', categoria: '...', giacenza: 0, sottoScorta: true, … },
        // ...
    ]
};
```

- **`summary`**: testo breve che Tony può leggere per rispondere senza dover interpretare tutti gli `items` (es. "Ci sono 12 prodotti in elenco, 2 sotto scorta.").
- **`items`**: dettaglio per ogni riga; i campi dipendono dalla lista (prodotti: codice, nome, categoria, giacenza, scortaMinima, sottoScorta, …).

### 2.2 Codice da inserire in `renderProdotti()` (o nella tua funzione di render della tabella)

Mettere questo blocco **all’inizio** della funzione di render, **prima** del `if (filtered.length === 0)` che mostra "Nessun prodotto trovato", così anche con lista vuota Tony ha un summary coerente.

**Esempio per Prodotti (Magazzino):**

```javascript
function renderProdotti() {
    const filtered = filterProdotti();
    document.getElementById('prodotti-count').textContent = filtered.length + ' prodotti';
    const container = document.getElementById('prodotti-container');

    // --- Inizio: window.currentTableData per Tony ---
    const sottoScortaCount = filtered.filter(p => p.scortaMinima != null && p.scortaMinima > 0 && (p.giacenza == null || p.giacenza < p.scortaMinima)).length;
    const summaryParts = [];
    if (filtered.length === 0) summaryParts.push('Nessun prodotto in elenco.');
    else {
        summaryParts.push('Ci sono ' + filtered.length + ' prodotti in elenco.');
        if (sottoScortaCount) summaryParts.push(sottoScortaCount + ' sotto scorta.');
    }
    window.currentTableData = {
        pageType: 'prodotti',
        summary: summaryParts.join(' ') + (summaryParts.length ? '.' : ''),
        items: filtered.map(p => ({
            codice: p.codice || '-',
            nome: p.nome || '-',
            categoria: p.categoria || '-',
            giacenza: p.giacenza != null ? p.giacenza : '-',
            scortaMinima: p.scortaMinima != null ? p.scortaMinima : '-',
            sottoScorta: (p.scortaMinima != null && p.scortaMinima > 0 && (p.giacenza == null || p.giacenza < p.scortaMinima)),
            attivo: p.attivo !== false
        }))
    };
    if (window.Tony && typeof window.Tony.setContext === 'function') {
        window.Tony.setContext('page', Object.assign({}, window.Tony.context && window.Tony.context.page || {}, {
            tableDataSummary: window.currentTableData.summary,
            currentTableData: window.currentTableData
        }));
    }
    try {
        window.dispatchEvent(new CustomEvent('table-data-ready', { detail: { currentTableData: window.currentTableData } }));
    } catch (e) {}
    // --- Fine: window.currentTableData per Tony ---

    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state">Nessun prodotto trovato</div>';
        return;
    }
    const html = `
        <table class="prodotti-table">
        ...
    `;
    container.innerHTML = html;
}
```

- **Prodotti**: `filtered` è l’array già filtrato (es. `filterProdotti()`); puoi calcolare `sottoScortaCount` come sopra e costruire `summary` e `items` di conseguenza.
- **Altre liste** (es. movimenti): stessa logica, con `pageType` e campi di `items` adatti alla tabella (es. `data`, `tipo`, `prodotto`, `quantita`, …).

---

## 3. Riferimento completo: modulo Macchine (trattori-list)

Qui sotto il codice **reale** dalla lista trattori del modulo Macchine, come riferimento completo.

### 3.1 Placeholder in testa (trattori-list-standalone.html)

```html
<script>window.GFV_CONFIG_BASE = '../../../core';</script>
<script>window.currentTableData = window.currentTableData || { pageType: 'trattori', summary: 'Caricamento dati in corso...', items: [] };</script>
<script src="../../../core/js/config-loader.js"></script>
<script>window.GFVConfigLoader.loadConfigAndMaps().catch(function(e){ console.error('Config load error', e); });</script>
<script type="module">
    (async function() {
        if (!window.currentTableData || !window.currentTableData.summary || window.currentTableData.summary === '') {
            window.currentTableData = { pageType: 'trattori', summary: 'Caricamento dati in corso...', items: [] };
        }
        const waitForConfig = () => window.GFVConfigLoader.waitForConfig();
        // ...
```

### 3.2 In renderTable (trattori-list-standalone.html)

```javascript
function renderTable() {
    const filtered = filterList();
    document.getElementById('count-label').textContent = filtered.length + ' trattori';
    const container = document.getElementById('table-container');

    window.currentTableData = {
        pageType: 'trattori',
        summary: filtered.length === 0 ? 'Nessun trattore in elenco.' : 'Ci sono ' + filtered.length + ' trattori in elenco.',
        items: filtered.map(m => ({
            nome: m.nome || '-',
            marcaModello: [m.marca, m.modello].filter(Boolean).join(' ') || '-',
            ore: m.oreAttuali != null ? m.oreAttuali : m.oreIniziali,
            stato: m.stato || '-'
        }))
    };
    if (window.Tony && typeof window.Tony.setContext === 'function') {
        window.Tony.setContext('page', Object.assign({}, window.Tony.context && window.Tony.context.page || {}, {
            tableDataSummary: window.currentTableData.summary,
            currentTableData: window.currentTableData
        }));
    }
    try {
        window.dispatchEvent(new CustomEvent('table-data-ready', { detail: { currentTableData: window.currentTableData } }));
    } catch (e) {}

    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state">Nessun trattore trovato</div>';
        return;
    }
    container.innerHTML = '<table class="mezzi-table">...</table>';
}
```

---

## 4. Cosa fa il widget Tony con questi dati

- In **sendMessage** (in `core/js/tony/main.js`) il widget legge `window.currentTableData` (o dal frame, se la lista è in iframe) e imposta sempre:
  - `pageCtx.tableDataSummary` (stringa, o `"Dati non disponibili"` se manca)
  - `pageCtx.currentTableData` (oggetto o `null`)
- Il **tony-service** invia questo `page` nel context alla Cloud Function; le system instruction (regola 8) dicono a Tony di usare **solo** `page.tableDataSummary` e `page.currentTableData` per rispondere alle domande sui dati in tabella e di non inventare dati.
- L’evento **`table-data-ready`** permette al widget di aggiornare il context non appena la tabella è renderizzata, senza aspettare il primo messaggio dell’utente.

---

## 5. Checklist per applicare al modulo Magazzino (prodotti-standalone.html)

1. Aggiungere lo script placeholder subito dopo la config (o prima del `<script type="module">`), con `pageType: 'prodotti'`.
2. All’inizio dell’IIFE del modulo, aggiungere il fallback che imposta `window.currentTableData` se `summary` è vuoto.
3. In **renderProdotti()**, all’inizio (prima del `if (filtered.length === 0)`):
   - costruire `summary` (es. "N prodotti in elenco, X sotto scorta.");
   - assegnare `window.currentTableData = { pageType: 'prodotti', summary, items }` con `items` derivati da `filtered`;
   - chiamare `window.Tony.setContext('page', ...)` se Tony è disponibile;
   - lanciare `window.dispatchEvent(new CustomEvent('table-data-ready', { detail: { currentTableData: window.currentTableData } }));`

Stesso schema si può usare per **movimenti-standalone.html** (pageType `'movimenti'`, summary e items in base a tipo movimento, data, prodotto, quantità, ecc.).

---

## 6. Differenze implementative (verificato 2026-03-08)

| Aspetto | Attività | Terreni | Lavori |
|---------|----------|---------|--------|
| Fallback IIFE | Sì, all'inizio del modulo | No; il callback di load fa `if (!window.currentTableData) ...` | Sì, all'inizio del modulo |
| Aggiornamento | Mutazione diretta | Stesso | Stesso |
| Notifica Tony | Diretta: setContext + table-data-ready | **Debounce**: `debouncedNotifyTonyTableData()` (50ms) | Diretta: setContext + table-data-ready |
| Dove si aggiorna | attivita-controller.js (funzione render) | loadTerreni callback + renderTerreniWrapper | gestione-lavori-controller.js (renderLavori) |
| Moduli JS | attivita-controller, attivita-events, attivita-utils | — | controller, events, utils, maps, tour |

**Raccomandazione**: usare il fallback IIFE (come attivita e lavori) per maggiore robustezza. Per pagine con molti filtri, considerare il debounce come terreni.

---

## 7. FILTER_TABLE – keyToId e limitazione attuale

### 7.1 Mappatura verificata (main.js)

| pageType | keyToId (param → id DOM) |
|----------|--------------------------|
| **attivita** | terreno→filter-terreno, tipoLavoro→filter-tipo-lavoro, coltura→filter-coltura, origine→filter-origine, dataDa→filter-data-da, dataA→filter-data-a, data→filter-data-da, ricerca→filter-ricerca |
| **terreni** | podere→filter-podere, possesso→filter-tipo-possesso, alert→filter-alert, coltura→filter-coltura, categoria→filter-categoria |
| **lavori** | stato→filter-stato, progresso→filter-progresso, caposquadra→filter-caposquadra, terreno→filter-terreno, tipo→filter-tipo, tipoLavoro→filter-tipo-lavoro, operaio→filter-operaio. Match tipo lavoro: case-insensitive, nomi parziali, risoluzione tipoLavoroId da tipiLavoroList. |

### 7.2 Logica pageType (aggiornata 2026-03-08)

`main.js` usa `window.currentTableData?.pageType` oppure il path per decidere quale keyToId usare:

```javascript
var pageType = (window.currentTableData && window.currentTableData.pageType) ||
    (pathStr.indexOf('attivita') !== -1 ? 'attivita' : (pathStr.indexOf('gestione-lavori') !== -1 || pathStr.indexOf('lavori') !== -1) ? 'lavori' : 'terreni');
var keyToId = FILTER_KEY_MAP[pageType] || FILTER_KEY_MAP.terreni;
```

**Conseguenza**: gestione lavori, attivita e terreni hanno ciascuno il proprio keyToId corretto.

### 7.3 Per estendere FILTER_TABLE a nuove pagine

1. In **main.js**: sostituire la logica binaria con una mappa `pageType → keyToId` e usare `window.currentTableData?.pageType` (o path) per scegliere.
2. Nella **pagina HTML**: assicurarsi che i filtri abbiano ID coerenti con il keyToId (es. `filter-stato`, `filter-tipo`, ecc.).
3. In **functions/index.js**: aggiungere le istruzioni FILTER_TABLE per il nuovo pageType con il formato params.

---

## 8. Procedura per dotare una nuova pagina

### Step 1 – currentTableData (lettura)

1. Placeholder HTML con `pageType` corretto.
2. Fallback all'inizio IIFE (consigliato).
3. Nel render: summary, items, setContext, table-data-ready (o debouncedNotifyTony se molti filtri).

### Step 2 – FILTER_TABLE (se la pagina ha filtri)

1. Aggiungere il pageType e keyToId in **main.js** (vedi §7.3).
2. Verificare che gli ID dei filtri HTML corrispondano al keyToId.
3. Aggiungere istruzioni CF in **functions/index.js** per il nuovo pageType.
