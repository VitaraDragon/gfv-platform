# Tony – Funzionalità attuali e soluzioni tecniche (per review / miglioramenti)

Documento di sintesi su come funziona Tony, quali funzioni ha oggi e quali scelte tecniche abbiamo adottato. Pensato per incollare il contenuto in un assistente (es. Gemini) e chiedere suggerimenti di miglioramento.

---

## 1. Cos’è Tony e che ruolo ha

- **Tony** è l’assistente IA integrato nella **GFV Platform**, un’app web multi-tenant per la gestione aziendale agricola (terreni, attività, lavori, moduli Vigneto/Frutteto/Magazzino/Conto Terzi, manodopera, ecc.).
- Ruolo: **“Capocantiere digitale”** – risponde a domande sull’app e sui dati dell’azienda, spiega come fare le operazioni, può proporre di aprire una pagina e, su conferma utente, eseguire la navigazione.
- **Testo e voce**: input da chat o microfono (STT); output in chat e TTS cloud. Niente foto/vision. Input e output sono stringhe; l’UI è una chat con FAB (pulsante) che apre il pannello.
- L’utente può usare Tony da **qualsiasi pagina** dell’app (dashboard, terreni, gestione lavori, moduli, ecc.): un unico widget (FAB + pannello + dialog di conferma) è presente su tutte le pagine standalone (eccetto login/registrazione/reset-password).

---

## 2. Funzionalità attuali (cosa fa oggi)

### 2.1 Rispondere a domande sull’app (“come funziona”, “dove trovo”, “come si fa”)
- Tony ha una **guida dell’app** nel contesto (testo markdown: struttura, percorsi, termini, passi per creare lavori/terreni, moduli). La guida è caricata da file `.md` in `core/guida-app/` (o fallback `docs-sviluppo/guida-app/`) oppure, se non disponibili, usa una versione **condensata** hardcoded in `tony-guida-app.js`.
- Per domande tipo *“Come si crea un terreno?”*, *“Come faccio a creare un lavoro?”*: Tony **prima spiega i passi** (usando la guida) e **non** apre subito la pagina; in testo propone: *“Se vuoi andare alla pagina [Terreni/Lavori/…] per farlo, dimmi ‘apri’ o ‘sì’.”* Solo se l’utente in un messaggio successivo conferma (“sì”, “apri”, “portami lì”), Tony emette l’azione di apertura e il client mostra il dialog di conferma.

### 2.2 Rispondere usando i dati aziendali (contesto)
- Il **contesto** viene iniettato nel system instruction come blocco `[CONTESTO_AZIENDALE]` (JSON). Oggi la **dashboard** chiama `Tony.setContext('dashboard', { info_azienda: { moduli_attivi }, utente_corrente: { nome, ruoli }, moduli_attivi })` dopo il render; opzionalmente viene caricato contesto **vigneto** (es. produzione/statistiche) se il modulo è attivo.
- Tony deve usare **solo** questi dati per numeri/dati; non deve inventare. Per produzione/resa uva: se nel contesto ci sono `produzione_per_anno` o `riepilogo_produzione` (vigneto), risponde con quelli; altrimenti suggerisce di aprire Vigneto → Statistiche/Vendemmia e può proporre “Se vuoi ti porto lì, dimmi ‘sì’ o ‘apri’” **senza** emettere subito l’azione (stessa logica “spiega/suggerisci prima, apri dopo conferma”).

### 2.3 Navigazione (aprire una pagina)
- **Richiesta esplicita** (“Portami ai terreni”, “Apri gestione lavori”, “Voglio andare al magazzino”): Tony risponde confermando e include nella risposta un blocco JSON `{ "action": "APRI_PAGINA", "params": { "target": "terreni" } }` (o altro target tra: dashboard, terreni, attivita, lavori, segnatura ore, validazione ore, lavori caposquadra, statistiche, statistiche manodopera, utenti, squadre, operai, compensi, macchine, magazzino, prodotti, movimenti, vigneto, vigneti, statistiche vigneto, vendemmia, potatura vigneto, trattamenti vigneto, calcolo materiali, pianificazione impianto, frutteto, frutteti, statistiche frutteto, raccolta frutta, potatura frutteto, trattamenti frutteto, conto terzi, clienti, preventivi, tariffe, report, amministrazione, guasti, abbonamento, impostazioni, diario).
- Il **client** (loader widget):
  - Intercetta l’azione tramite `Tony.onAction(callback)`.
  - Mostra sempre un **dialog di conferma** custom (non `confirm()` del browser): “Aprire la pagina «Terreni»?” con pulsanti **Annulla** / **Apri**.
  - Se l’utente clicca **Apri**, naviga con `window.location.href` all’URL corretto (calcolato in base al pathname della pagina corrente e a una mappa target → path da root).

### 2.3b Context moduli e navigazione da tutte le pagine (2026-02-23)
- **Helper `syncTonyModules(modules)`**: funzione globale in `tony-widget-standalone.js`, richiamabile da qualsiasi pagina standalone dopo il caricamento tenant. Sincronizza `moduli_attivi` con Tony (setTonyContext / Tony.setContext + evento `tony-module-updated`); se il widget non è pronto riprova ogni 400 ms fino a **25 tentativi** (~10 s). Se l'array è vuoto e il contesto esistente ha già moduli, non si sovrascrive. Log: `[Tony Sync] Ricevuti moduli: ...`.
- **Bypass navigazione**: `APRI_PAGINA` e `apri_modulo` ignorano `isTonyAdvancedActive` in onAction, onComplete e processTonyCommand; la navigazione viene sempre eseguita.
- **Dashboard di modulo**: Frutteto/Vigneto chiamano `syncTonyModules(modules)`; in Frutteto si forzano `frutteto` e `tony` se mancanti.
- **Cloud Function**: lettura da `request.data.context.dashboard.moduli_attivi`; se contiene `tony` si usa SYSTEM_INSTRUCTION_ADVANCED; inizio prompt con "STATO UTENTE: Tony Avanzato ATTIVO. Moduli disponibili: [...]"; fallback per richieste di navigazione con moduli vuoti; regole DEFAULT/ECCEZIONE NAVIGAZIONE.
- **Normalizzazione command da CF**: la CF può restituire `command: { action: 'APRI_PAGINA', params: { target } }` senza `type`; il widget normalizza impostando `type = action` e copiando `params` sull'oggetto, così `processTonyCommand` e `enqueueTonyCommand` ricevono un comando valido e dialog + redirect funzionano.
- **Base path per deploy in sottocartella**: in `getUrlForTarget` se `location.pathname` contiene `/gfv-platform/` si usa il prefisso `/gfv-platform` negli URL (es. `/gfv-platform/core/terreni-standalone.html`) per evitare 404 quando l'app è aperta da smartphone/online (es. GitHub Pages).

### 2.3d Auto-discovery moduli e persistenza (2026-02-23)
- Su pagine che non chiamano `syncTonyModules` (es. prodotti-standalone, sottopagine moduli), il widget **recupera i moduli** con **getModuliFromDiscovery()**: (1) **sessionStorage** chiave `tony_moduli_attivi`, (2) `window.userModules`, (3) `window.tenantConfig.modules` / `window.tenant.modules`. Se trova un array non vuoto, lo applica al context con `Tony.setContext('dashboard', { moduli_attivi: discovered })` e **saveModuliToStorage(arr)**.
- **Persistenza**: ogni volta che Tony riceve `moduli_attivi` (setTonyContext, syncTonyModules, evento tony-module-updated, saveTonyState), l'array viene salvato in sessionStorage così dopo navigazione (es. Dashboard → Magazzino → Prodotti) il widget legge i moduli e mantiene "Modulo avanzato: ATTIVO".
- **Blocco preventivo**: in **sendRequestWithContext**, prima di inviare alla Cloud Function: se il context non ha moduli, il widget chiama getModuliFromDiscovery(); se trova moduli, aggiorna il context, salva in sessionStorage, chiama `window.__tonyCheckModuleStatus(true)` e **attende 150 ms** prima di eseguire l'invio reale (doActualSend), così la CF riceve sempre i moduli corretti e non risponde "Attiva il modulo Tony Avanzato".
- **Rotte e context.page**: main.js carica **core/config/tony-routes.json** all'init e invia alla CF **context.page** con `pagePath`, `availableTargets`, `availableRoutes`, `currentTableData` (se `window.currentTableData` è impostato dalla pagina – vedi RIEPILOGO_CURRENTTABLEDATA_PER_MODULO_LISTE.md), `tableDataSummary`. La CF usa pagePath per sub-agenti e `currentTableData` per rispondere a domande sui dati visibili in tabella.

### 2.4 Altre azioni (definite in system instruction, non ancora gestite in UI)
- La system instruction menziona altre azioni (segnare ore, segnalare guasti, ecc.) con formato `{ "action": "NOME_AZIONE", "params": { ... } }`. Il **parsing** lato client estrae qualsiasi blocco JSON di questo tipo e chiama `triggerAction(actionName, params)`; oggi **solo** `APRI_PAGINA` (e alias `apri_modulo`) è gestita nel widget (navigazione + conferma). Le altre azioni vengono emesse ma nessun modulo è ancora iscritto per eseguirle.

### 2.5 Voce (STT + TTS) – implementata 2026-02-07, potenziata 2026-02-07
- **STT**: Push-to-Talk con card di conferma; **modalità continua** (toggle microfono) per dialogo hands-free.
- **TTS**: Cloud Function `getTonyAudio` – Google Cloud Text-to-Speech con voce **it-IT-Wavenet-D** (maschile, profonda). Nessun fallback su Web Speech API. Cache per testo identico nella stessa sessione.
- **Pulizia testo**: `pulisciTestoPerVoce()` rimuove emoji, markdown, JSON prima di inviare a TTS.
- Tony parla per ogni risposta (digitata o vocale).
- **Timeout inattività** (20 s): spegnimento automatico se nessuno parla dopo che Tony ha finito.
- **Congedo vocale**: frasi come "Grazie Tony, a posto così" disattivano la modalità continua.
- **Barge-in**: clic sul microfono interrompe Tony mentre parla.

### 2.5b Persistenza sessione (2026-02-07)
- **sessionStorage**: chatHistory, isAutoMode, lastPath, timestamp salvati a ogni messaggio e su `beforeunload`.
- **Ripristino**: se la sessione ha meno di 10 minuti, cronologia e microfono vengono ripristinati.
- **Saluto contestuale**: su cambio pagina, Tony accoglie con *"Eccoci qui nella sezione [Titolo]. Come posso aiutarti ora?"*.

### 2.5c Navigazione (migliorata 2026-02-07)
- **Percorsi assoluti**: URL sempre da root (es. `/core/terreni-standalone.html`).
- **resolveTarget**: alias e fuzzy matching per varianti restituite da Gemini (es. "statistiche del vigneto" → "statistiche vigneto").

### 2.6 Compilazione form attività (INJECT_FORM_DATA – Treasure Map, 2026-02)
- **Form attività** (`attivita-form`, modal `attivita-modal`): quando il modal è aperto e l’utente invia un messaggio, Tony (Gemini) usa una system instruction dedicata che richiede risposte strutturate con blocco \`\`\`json contenente `formData`.
- **Flusso**: utente dice "Ho trinciato nel Sangiovese" → Gemini restituisce `{ action: "fill_form", formData: { "attivita-terreno": "Sangiovese", "attivita-tipo-lavoro-gerarchico": "Trinciatura", ... } }` → Cloud Function emette `INJECT_FORM_DATA` → widget chiama `TonyFormInjector.injectAttivitaForm()`.
- **Derivazione categoria/sottocategoria**: se Gemini invia solo il tipo lavoro, `TonyFormInjector.deriveCategoriaFromTipo()` deduce categoria e sottocategoria da `tipi_lavoro` (categoriaId, sottocategoriaId).
- **Ordine iniezione**: Categoria → Sottocategoria → Tipo Lavoro (con delay per cascata dropdown); Macchina → Attrezzo (350 ms dopo macchina per popolare attrezzi).
- **Dettagli**: vedi `docs-sviluppo/TONY_COMPILAZIONE_ATTIVITA_IMPLEMENTAZIONE.md`.

### 2.6b Compilazione form Lavori (2026-02-16)
- **Form Lavori** (`lavoro-form`, modal `lavoro-modal`): Tony compila il form Crea Nuovo Lavoro con regole specifiche.
- **Contesto**: `lavori.terreni` con `coltura_categoria` (Vite, Frutteto, Olivo, Seminativo) e `colture_con_filari: ['Vite','Frutteto','Olivo']`.
- **Sottocategoria**: terreni con filari → solo "Tra le File" o "Sulla Fila", mai "Generale".
- **Disambiguazione**: Erpicatura ≠ Trinciatura; se utente dice "erpicatura" → "Erpicatura Tra le File".
- **Macchine**: se utente dice "completo di macchine" → includi subito trattore e attrezzo.
- **Stato default**: "assegnato" se caposquadra/operaio compilato.
- **Messaggio form completo**: "Vuoi che salvi il lavoro?" (non il messaggio Impianti su varietà/distanze).
- **Parametro URL**: `?openModal=crea` apre il modal Crea Lavoro all'avvio.
- **Dettagli**: vedi `docs-sviluppo/TONY_COMPILAZIONE_LAVORI_2026-02.md`.

### 2.7 Comandi implementati nel widget (main.js)
- **APRI_PAGINA** / **apri_modulo**: navigazione con conferma.
- **OPEN_MODAL**: apre attivita-modal, ora-modal, lavoro-modal.
- **SET_FIELD**: imposta campi form (SmartFormFiller per attivita-tipo-lavoro-gerarchico).
- **CLICK_BUTTON**: click su pulsante (es. Salva).
- **SAVE_ACTIVITY**: salva attività dopo conferma.
- **INJECT_FORM_DATA**: compilazione batch (form Attività, Lavori).
- **FILTER_TABLE**, **SUM_COLUMN**: per pagina terreni (filtri e somme) – CF emette, widget esegue (main.js processTonyCommand). Tony può anche rispondere a domande informative (conteggio, nomi, superficie singolo terreno) usando `page.tableDataSummary` e `page.currentTableData.items` nel contesto – vedi §10.
- **FILTER_TABLE attivita** (2026-03-08): stessa logica per pagina Attività; params: terreno, tipoLavoro, coltura, **origine** (azienda | contoTerzi), data, dataDa, dataA, ricerca. Filtro origine distingue lavorazioni interne da conto terzi.

### 2.8 Cosa Tony non fa (ancora)
- **Esecuzione azioni**: nessun handler per SEGNA_ATTIVITA (nota), REPORT_GUASTO, AGGIORNA_MAGAZZINO, MOSTRA_GRAFICO, ecc. (azioni emesse dalla CF ma non gestite in UI).
- **Storia conversazione**: ogni `ask()` è stateless (contesto sì, ma non c’è invio dello storico messaggi a Gemini).
- **Pagina corrente**: il widget invia **context.page** (pagePath, availableTargets, availableRoutes) a ogni richiesta; la CF usa pagePath per sub-agenti (Vignaiolo/Logistico) e per la mappa target estesa.

---

## 3. Flusso tecnico (dalla domanda alla risposta/azione)

1. **Utente** scrive un messaggio nel campo della chat e invia (o Enter).
2. **Widget** chiama `Tony.askStream(testo, { onChunk })` se disponibile, altrimenti `Tony.ask(testo)` (dopo aver verificato `Tony.isReady()`). Con askStream il testo appare in tempo reale.
3. **tony-service.js**:
   - Se usa **callable**: `this._tonyAskCallable({ message, context: this.context })` → Cloud Function `tonyAsk`.
   - Se usa **getAI (SDK)**: costruisce il prompt con `Contesto attuale: ${contextJson}\n\nDomanda utente: ${userPrompt}` e chiama `this.model.generateContent(fullPrompt)`; il modello ha già la system instruction con `[CONTESTO_AZIENDALE]` sostituito dal JSON del contesto.
4. **Backend (solo callable)**: Cloud Function in **europe-west1** riceve `message` e `context`, sostituisce `{CONTESTO_PLACEHOLDER}` nella system instruction con il JSON del contesto, chiama l’API REST Gemini (`gemini-2.0-flash`), restituisce `{ text }`.
5. **tony-service.js** riceve il testo, chiama `_parseAndTriggerActions(text)`:
   - Cerca nel testo blocchi `{ "action": "NOME", "params": { ... } }` (regex + parsing a graffe bilanciate).
   - Per ogni blocco valido chiama `triggerAction(actionName, params)` (tutti i callback registrati con `onAction`).
   - Restituisce il testo **ripulito** (senza i blocchi JSON) alla UI.
6. **Widget** mostra la risposta ripulita nella chat.
7. Se è stata emessa **APRI_PAGINA**, il **callback** registrato dal loader:
   - Risolve l’URL dalla mappa (target → path da root) e dal `pathname` della pagina corrente (path relativo).
   - Mostra il dialog “Aprire la pagina «Label»?”; se l’utente clicca **Apri**, imposta `window.location.href = url`.

---

## 4. Soluzioni tecniche adottate

### 4.1 Architettura generale
- **Modulo dedicato (black box)**: solo **tony-service.js** parla con Gemini (o con la callable che parla con Gemini). Il resto dell’app non chiama mai direttamente l’API Gemini.
- **Singleton**: una sola istanza `Tony` (export da `tony-service.js`); inizializzazione centralizzata (dopo Firebase).
- **Event bus (pub/sub)**: i moduli/pagine si registrano con `Tony.onAction(callback)`. Quando Tony (Gemini) restituisce un’azione, il service chiama `triggerAction(actionName, params)` e tutti i callback registrati vengono invocati. Così navigazione e altre reazioni sono disaccoppiate dal service.

### 4.2 Backend (Cloud Functions)
- **tonyAsk** (Firebase Functions v2, `onCall`), **regione europe-west1**.
- **Autenticazione**: `request.auth` obbligatorio (solo utenti loggati).
- **Input**: `{ message: string, context?: object }`. Il `context` è quello che il client ha in `Tony.context` (guida_app, dashboard, vigneto, ecc.).
- **Chiave Gemini**: `process.env.GEMINI_API_KEY` (impostata come variabile d’ambiente nella revisione Cloud Run del servizio che ospita la function).
- **Chiamata a Gemini**: API REST `generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent` con body: `contents` (user prompt), `systemInstruction` (testo con `{CONTESTO_PLACEHOLDER}` sostituito dal JSON del contesto), `generationConfig` (temperature 0.7, maxOutputTokens 1024).
- **Output**: `{ text: string }`. Il parsing delle azioni JSON avviene **solo lato client** (tony-service.js); la function restituisce il testo grezzo.
- **Modalità avanzata (2026-02-23)**: se `context.dashboard.moduli_attivi` (o altri path) contiene `'tony'`, la CF usa SYSTEM_INSTRUCTION_ADVANCED e inietta: (1) **SmartFormValidator** (skill prioritaria: prima di emettere comandi che registrano dati controlla [CONTESTO].form e campi required; se manca un dato essenziale chiede esplicitamente e non invia il JSON); (2) **Sub-agente Vignaiolo** se `context.page.pagePath` contiene `/vigneto/` (esperto viticoltura, target vendemmia, potatura vigneto, trattamenti vigneto, statistiche vigneto, calcolo materiali, pianificazione impianto); (3) **Sub-agente Logistico** se `context.page.pagePath` contiene `/magazzino/` (esperto scorte, target prodotti, movimenti); (4) **TONY_TARGETS_EXTENDED** (mappa target completa con sottopagine); se il client invia `context.page.availableRoutes` (da tony-routes.json), la CF considera validi anche quei target per la navigazione.
- **Rotte evolutive**: `core/config/tony-routes.json` è generato da **scripts/generate-tony-routes.cjs** (`npm run generate:tony-routes`); lo script scandisce `core/` e `modules/` per `*-standalone.html` e scrive target, path, label, module. Per nuove pagine o moduli rieseguire lo script e aggiornare il JSON.

- **getTonyAudio** (Firebase Functions v2, `onCall`), **regione europe-west1**.
- **Input**: `{ text: string }`. Richiede `request.auth`.
- **TTS**: `@google-cloud/text-to-speech`, voce **it-IT-Wavenet-D** (maschile, profonda), `pitch: -3.0`, `speakingRate: 0.95`, encoding MP3.
- **Output**: `{ audioContent: string (base64), voice: string }`.
- **Prerequisito**: abilitare "Cloud Text-to-Speech API" in Google Cloud Console.

### 4.3 Client – Tony Service (`core/services/tony-service.js`)
- **Init**: `Tony.init(app)` con `app` da `getAppInstance()` (firebase-service).  
  - Prova prima a usare **Firebase AI** (Vertex AI / getAI): `import('https://esm.sh/firebase@11/ai')`, `getAI(app, { backend: new GoogleAIBackend() })`, `getGenerativeModel(this.ai, { model: 'gemini-2.0-flash', systemInstruction })`.  
  - Se fallisce (es. “Service AI is not available”), **fallback** a **callable** `tonyAsk`: `getFunctions(app, 'europe-west1')`, `httpsCallable(functions, 'tonyAsk')`.
- **Guida app**: all’init, `loadGuidaAppFull()` prova a caricare i file .md da `core/guida-app/` o `docs-sviluppo/guida-app/`; se riesce, `context.guida_app = fullGuida`, altrimenti `context.guida_app = GUIDA_APP_PER_TONY` (stringa condensata da `tony-guida-app.js`).
- **Contesto**: `this.context` è un oggetto; chiavi tipiche: `guida_app`, `dashboard`, `vigneto`. `setContext(moduleName, data)` aggiorna `this.context[moduleName] = data` e, se il modello SDK è in uso, ricostruisce il modello con `_buildModel()` (system instruction aggiornata con il nuovo JSON).
- **ask(userPrompt)**: a seconda di callable vs SDK, invia messaggio + contesto e ottiene il testo; poi `_parseAndTriggerActions(text)` per estrarre azioni e ripulire il testo; restituisce il testo ripulito.
- **askStream(userPrompt, { onChunk })**: (solo SDK) usa `generateContentStream`; emette chunk via `onChunk`; restituisce il testo completo ripulito. Con callable fa fallback su `ask()`.
- **Parsing azioni**: regex per trovare `{ "action": "NOME", "params": ... }`; parsing a graffe bilanciate per estrarre JSON; per ogni blocco valido `triggerAction(parsed.action, parsed.params)`; il testo restituito è senza questi blocchi.

### 4.4 System instruction (regole per il modello, aggiornata 2026-02-06)
- **Ruolo**: Tony, Capocantiere; tono da collega, non da software.
- **TONO E VOCABOLARIO**: verbi attivi ("Dagli un'occhiata", "Ecco fatto!"), interiezioni ("Bene, allora..."), rivolgersi all'utente in modo diretto.
- **FORMATO OUTPUT VOCALE**: testo puro, vietato markdown/virgolette; "più" invece di +, "percento" invece di %; punteggiatura per pause naturali (virgola, punto, punti di sospensione).
- **MEMORIA VOCALE**: se l'utente risponde "Sì", "Vai", "Ok apri", guardare l'ultimo messaggio per capire il contesto.
- **Regola 0 (esperienza app)**: per domande “come fare” → spiegare prima con guida_app, proporre in testo di aprire la pagina, **non** includere `APRI_PAGINA` nella stessa risposta; includere `APRI_PAGINA` solo quando l’utente conferma in un messaggio successivo. Per richieste esplicite di “apri/portami” → includere subito `APRI_PAGINA`.
- **Regola 1**: usare solo i dati in `[CONTESTO_AZIENDALE]`; non inventare.
- **Regola 2**: per produzione/resa vigneto, usare dati contesto se presenti; altrimenti suggerire modulo e “dimmi sì/apri per portarti lì” **senza** emettere APRI_PAGINA in quella risposta.
- **Regola 3**: per richieste esplicite di navigazione → sempre `APRI_PAGINA` con `target` in un set fisso (terreni, attivita, lavori, …).
- **Regola 4**: altre azioni (segnare ore, guasti, ecc.) → risposta + JSON `{ "action": "NOME", "params": {...} }`.
- **Regola 5**: per dati non in contesto → suggerire il modulo dove trovarli, non “non ho queste informazioni” generico.
- **Regola 6**: risposte brevi.
- Il blocco `[CONTESTO_AZIENDALE]` è sostituito a runtime con `JSON.stringify(this.context, null, 2)` (o equivalente lato callable).

### 4.5 Widget globale (loader e moduli su tutte le pagine)
- **Loader**: `core/js/tony-widget-standalone.js` imposta `__tonyScriptBase`, carica CSS e script form, importa `core/js/tony/main.js`. La logica è in `core/js/tony/`: main.js (orchestratore), ui.js (FAB/chat/dialog), engine.js (mappe, resolveTarget), voice.js (TTS).
- **Caricamento CSS**: lo script usa `import.meta.url` per la base e aggiunge dinamicamente `<link href=".../styles/tony-widget.css">` in `document.head`.
- **Iniezione DOM**: alla prima esecuzione crea e appende al `body`: (1) FAB (pulsante 🤖), (2) pannello chat (header “Tony – Assistente”, area messaggi, input + pulsante Invia), (3) overlay del dialog di conferma (titolo, messaggio, Annulla, Apri). Nessun HTML Tony nelle pagine; tutto generato dallo script.
- **Chat UI**: event listener su FAB (apri/chiudi pannello, primo messaggio di benvenuto), su Invia e su Enter (chiamata a `Tony.ask()`, append messaggio utente, “Sto pensando…”, poi risposta o errore). `window.Tony` usato per `ask` e `isReady()`.
- **Inizializzazione di Tony**: lo script **non** conosce l’ordine di caricamento rispetto a Firebase. Fa **polling** (ogni 250 ms, max 40 tentativi ≈ 10 s): import dinamico di `firebase-service.js` e `tony-service.js`, chiamata a `getAppInstance()`; quando restituisce un’istanza valida, chiama `Tony.init(app)`, poi registra `Tony.onAction(...)` per gestire `APRI_PAGINA` / `apri_modulo`.
- **Gestione APRI_PAGINA**: callback riceve `target` (e eventuale alias); una mappa fissa associa target (es. `terreni`, `lavori`, `vigneto`, `statistiche vigneto`, `pianifica impianto`) a **path da root** (es. `core/terreni-standalone.html`, `core/admin/gestione-lavori-standalone.html`, `modules/vigneto/views/vigneto-dashboard-standalone.html`). Da `window.location.pathname` si ricava la “profondità” della pagina corrente (numero di segmenti nel path); si costruisce il path relativo come `../`.repeat(depth) + pathFromRoot. Si mostra `showTonyConfirmDialog('Aprire la pagina «Label»?')`; se l’utente conferma, `window.location.href = url`.
- **Dialog conferma**: non si usa `confirm()`; overlay + box con stili in `tony-widget.css` (`.tony-confirm-overlay`, `.tony-confirm-box`, `.tony-confirm-btn`). Una Promise risolta con true/false a seconda di Apri/Annulla (o click su overlay); la navigazione avviene solo se true.

### 4.6 Coda comandi e deduplicazione (2026-03-02)
- **enqueueTonyCommand**: accoda comandi (OPEN_MODAL, SET_FIELD, INJECT_FORM_DATA, SAVE_ACTIVITY, ecc.) con priorità e delay; `drainTonyCommandQueue` processa in sequenza.
- **Deduplicazione consecutiva**: se l'ultimo elemento in coda è identico (JSON.stringify) al nuovo comando, non si accoda. Non sufficiente quando il primo comando è già stato rimosso (shift) prima che arrivi il secondo.
- **Fix doppio enqueue (2026-03-02)**: tony-service chiama `triggerAction()` prima di restituire `{ text, command }`; l'onAction callback accoda. Poi onComplete riceve la stessa risposta e accodava di nuovo. Fix: in onComplete, se `rawData` è oggetto con `command` (risposta dal service), si salta l'enqueue.
- **Fix jQuery (2026-03-02)**: `checkTonyPendingAfterNav` (openAndInject) su pagine senza jQuery (attivita-standalone) usava `$` → ReferenceError. Sostituito con `(typeof window.$ === 'function' && window.$.fn && window.$.fn.modal) ? window.$ : null` e fallback `el.classList.add('active')`.
- **Fix fallback SAVE_ACTIVITY (2026-03-02)**: il regex includeva "fatto" → "Quali orari hai fatto?" attivava erroneamente SAVE_ACTIVITY. Ora: esclusione domande (testo con `?` o che inizia con "quali", "quante", "come", ecc.); regex ristretta: `salvat[ao](?:\s|!|\.|$)|confermato!|ok salvo|perfetto salvo|attività salvata` (rimosso "fatto").

### 4.7 Dove è presente Tony
- **Incluso**: dashboard, terreni, attivita, statistiche, segnatura-ore (core); tutte le pagine standalone in core/admin (gestione-lavori, amministrazione, gestione-guasti, segnalazione-guasti, gestisci-utenti, gestione-operai, gestione-squadre, compensi-operai, gestione-macchine, statistiche-manodopera, validazione-ore, abbonamento, impostazioni, lavori-caposquadra, report); tutte le view standalone dei moduli vigneto, frutteto, magazzino, conto-terzi, report.
- **Escluso**: login, registrazione, reset-password, registrazione-invito, fix-utente-mancante (e opzionalmente accetta-preventivo, che è pagina pubblica).

### 4.8 Stack e dipendenze
- **Firebase**: SDK 11; tutta l’app usa `core/services/firebase-service.js` per `getAppInstance()`, `getAuthInstance()`, `getDb()`. Tony riceve `app` da lì.
- **Modello**: sia in SDK che in callable si usa **`gemini-2.0-flash`** (tony-service.js e API REST). Stessa system instruction concettualmente; la callable non ricollega la conversazione (stateless).
- **Storia messaggi**: chatHistory (max 8 elementi) inviata a Gemini insieme al prompt; il modello ricorda i turni precedenti.

---

## 5. Riepilogo punti critici / possibili miglioramenti

- **Stateless**: nessuno storico di messaggi inviato a Gemini; il modello non “ricorda” il turno precedente.
- **Contesto limitato**: solo dashboard (e opzionale vigneto) invia dati; altre pagine non chiamano `setContext`, quindi Tony non ha dati “della pagina corrente” né di altri moduli se non caricati in dashboard.
- **Una sola azione gestita in UI**: APRI_PAGINA; le altre azioni sono emesse ma non hanno handler.
- **Voce**: implementata (2026-02-07) con STT, TTS cloud (getTonyAudio + it-IT-Wavenet-D), Push-to-Talk, conferma, pulizia testo, nessun fallback Web Speech.
- **Doppio canale (SDK vs callable)**: comportamento equivalente ma due path (getAI + modello locale vs callable + API REST); la callable è quella usata in produzione se getAI non è disponibile nel build.
- **Path resolution**: ora usa percorsi assoluti e `resolveTarget` per varianti; la mappa URL è “path da root”; se l’app è servita sotto una base path (es. `/app/`), potrebbe richiedere adattamenti.

---

### 4.9 Compilazione form attività (Treasure Map)
- **Attivazione**: la Cloud Function usa `SYSTEM_INSTRUCTION_ATTIVITA_STRUCTURED` quando `context.form.formId === 'attivita-form'` oppure `context.form.modalId === 'attivita-modal'`, e modulo Tony attivo.
- **Contesto form**: il widget deve chiamare `Tony.setContext('form', formCtx)` **prima** di `ask()`. `formCtx` viene da `getCurrentFormContext()` (modal attivo, campi estratti dal DOM).
- **File**: `tony-form-injector.js` (INJECTION_ORDER, deriveCategoriaFromTipo, resolver), `tony-form-mapping.js` (configurazione), `functions/index.js` (SYSTEM_INSTRUCTION_ATTIVITA_STRUCTURED).
- **Override Generale su terreni con filari (2026-03-02)**: se Tony invia `attivita-sottocategoria = "Generale"` e il terreno ha `coltura_categoria` in [Vite, Frutteto, Olivo, Arboreo, Alberi], l'injector **sovrascrive** con "Tra le File". Usa `attivitaState.terreniList` e `terreno.coltura_categoria`. Evita errore su terreni Frutteto (es. Kaki). `attivita-standalone.html`: il listener change su attivita-terreno preserva `coltura_categoria` in terreniList (fix bug sovrascrittura).
- **Estensione**: per nuovi form seguire la checklist in `docs-sviluppo/TONY_COMPILAZIONE_ATTIVITA_IMPLEMENTAZIONE.md` §5.

---

*Riferimenti: `core/services/tony-service.js`, `core/js/tony-widget-standalone.js`, `core/js/tony/` (main, ui, engine, voice), `functions/index.js`, `docs-sviluppo/GUIDA_SVILUPPO_TONY.md`, `TONY_SVILUPPO_2026-03_VIGNETO_E_COMPILAZIONE.md`. Ultimo aggiornamento (verifica codice/doc): 2026-03-02. §10 Terreni 2026-02-25. Fix regressioni 2026-03-02: fallback SAVE_ACTIVITY, injector Generale→Tra le File, terreniList coltura_categoria.*

---

## 6. Aggiornamenti 2026-02-07 (TTS Cloud – voce maschile)

**getTonyAudio**: Cloud Function in europe-west1 che usa Google Cloud Text-to-Speech.
- **Voce**: it-IT-Wavenet-D (maschile, profonda). Alternative testate: it-IT-Wavenet-B (suona più neutra), it-IT-Standard-B.
- **Parametri**: pitch -3.0, speakingRate 0.95, encoding MP3.
- **Widget**: `speakWithTTS()` chiama getTonyAudio; nessun fallback su speechSynthesis; Tony parla per ogni risposta.
- **Log**: la risposta include `voice` per debug; log dettagliati in Cloud Logging.

---

## 7. Aggiornamenti 2026-02-06 (miglioramenti post-Gemini)

**Voce implementata**: STT (Push-to-Talk), TTS cloud (sostituito Web Speech), card di conferma.

**Streaming**: `askStream()` con `generateContentStream` quando SDK disponibile; testo in tempo reale nel widget; JSON nascosto durante streaming (`nascondiJsonDaStreaming`).

**Modello**: `gemini-2.0-flash` (latenza ridotta).

**Contesto ottimizzato**: `_getContextForPrompt()` – guida_app inviata solo al primo messaggio; messaggi successivi usano contesto ridotto (meno token, risposta più veloce).

**System instruction**: compressa e ottimizzata per output vocale (tono informale, formato testo puro, pause e punteggiatura, memoria per risposte brevi "Sì"/"Vai").

**Pulizia testo**: `pulisciTestoPerVoce` estesa con regex per JSON multilinea, markdown residuo, trattini ("it-IT" → "it IT").

**Dettagli completi**: vedi `docs-sviluppo/TONY_DA_IMPLEMENTARE_POST_GEMINI.md` sezione "Implementato", "Aggiornamenti 2026-02-06" e "TTS Cloud 2026-02-07".

---

## 8. Aggiornamenti 2026-02-07 (modalità continua, persistenza, navigazione)

### 8.1 Modalità dialogo continuo (hands-free)
- **Toggle microfono**: un click attiva/disattiva la modalità continua (stile Pixel).
- **Flusso**: utente parla → riconoscimento fine → invio automatico → Tony risponde con TTS → microfono si riattiva da solo.
- **Classi UI**: `is-auto-mode` sul pannello; pulsante microfono con `tony-mic-active` quando in ascolto.

### 8.2 Timeout inattività (20 secondi)
- **AUTO_MODE_SILENCE_MS = 20000**.
- Il timer **non parte** mentre Tony parla: viene annullato in `onplay` dell’audio.
- Il timer parte solo quando Tony ha finito di parlare e il microfono si riapre.
- Reset del timer su: `onsoundstart`, `onresult`, `onspeechend`, `onend`, `reopenMicIfAutoMode`, `startListening`.

### 8.3 Congedo vocale (chiusura elastica)
- **checkFarewellIntent(text)**: riconosce frasi brevi (< 8 parole) con parole chiave: grazie, posto così, a posto, apposto, ciao tony, basta, chiudi, termina, fine, ottimo così, va bene così, ci sentiamo, a dopo, buon lavoro, saluti.
- Se rilevato: Tony risponde un’ultima volta, poi `toggleAutoMode(false)` (spegne il microfono).

### 8.4 Barge-in (interruzione)
- Se l’utente clicca il microfono mentre Tony sta parlando: l’audio si ferma subito, il microfono si attiva in ascolto, il timer si resetta.

### 8.5 Persistenza sessione (sessionStorage)
- **saveTonyState()**: salva `chatHistory`, `isAutoMode`, `lastPath`, `timestamp` in `sessionStorage` a ogni messaggio inviato/ricevuto e su `beforeunload`.
- **restoreTonyState()**: all’avvio, se la sessione ha meno di 10 minuti, ripristina la cronologia e lo stato del microfono.
- Se `isAutoMode` era attivo e la pagina è diversa da quella precedente: saluto vocale contestuale dopo 1,5 s: *"Eccoci qui nella sezione [Titolo]. Come posso aiutarti ora?"*.
- Chiamata dopo `Tony.init()` tramite `window.__tonyRestoreSession`.

### 8.6 Ottimizzazione audio (cache)
- Se il testo da pronunciare è **identico** all’ultimo generato nella stessa sessione, si riusa l’audio in cache senza chiamare la Cloud Function `getTonyAudio`.
- Variabile `lastTTSCache = { text, audioBase64 }`.

### 8.7 Navigazione migliorata
- **Percorsi assoluti**: `getUrlForTarget` usa sempre URL assoluti (es. `/core/terreni-standalone.html`), non più relativi.
- **resolveTarget(raw)**: risolve il target anche quando Gemini restituisce varianti:
  - **Alias**: "statistiche del vigneto" → "statistiche vigneto", "anagrafica vigneti" → "vigneti", "diario attività" → "attivita", ecc.
  - **Normalizzazione**: rimozione di "del", "della", "pagina", "modulo", "sezione", "anagrafica"; normalizzazione accenti.
  - **Fuzzy matching**: se il target contiene una chiave della mappa (≥ 4 caratteri), viene usata quella.
- **Nuovi target**: statistiche del vigneto/frutteto, segnala guasto, segnalazione guasto.

---

## 9. Aggiornamenti 2026-02-08 (Correzioni e Miglioramenti)

**Contesto**: Le seguenti correzioni sono state necessarie per garantire il corretto funzionamento della separazione Tony Guida/Operativo (vedi `TONY_MODULO_SEPARATO.md`). Il sistema di rilevamento dei moduli attivi (`moduli_attivi.includes('tony')`) è fondamentale per determinare se Tony opera in modalità Guida (solo spiegazioni) o Operativo (azioni operative).

### 9.1 Risoluzione Errori Sintassi `getDb` Duplicato

**Problema**: Errori `SyntaxError: Identifier 'getDb' has already been declared` in pagine standalone.

**File corretti**:
- `modules/vigneto/views/potatura-standalone.html`: Rimosse dichiarazioni duplicate alle righe 526-529 e 667-668.
- `modules/frutteto/views/potatura-standalone.html`: Modificato import per evitare conflitti (import modulo completo + destrutturazione).

**Soluzione tecnica**: 
- Evitare destrutturazione diretta multipla nello stesso scope.
- Preferire import del modulo completo seguito da destrutturazione quando ci sono potenziali conflitti.

### 9.2 Miglioramento Inizializzazione Context Tony

**Problema**: Widget Tony non rilevava moduli attivi nella dashboard frutteto a causa di problemi di timing. Questo impediva il corretto funzionamento della separazione Guida/Operativo, poiché Tony non poteva determinare se il modulo `'tony'` era attivo nel tenant, risultando sempre in modalità Guida anche quando il modulo operativo era attivo.

**File modificato**: `modules/frutteto/views/frutteto-dashboard-standalone.html`

**Miglioramenti applicati**:
1. **Retry aumentato**: Da 10 a 20 tentativi (500ms ciascuno = 10 secondi totali).
2. **Evento sempre emesso**: `tony-module-updated` viene emesso anche se Tony non è disponibile dopo 20 tentativi.
3. **Ultimo tentativo**: Aggiunto tentativo finale dopo 2 secondi per gestire caricamenti tardivi.
4. **Funzione centralizzata**: `emitModuleUpdate()` per garantire emissione consistente dell'evento.

**Pattern implementato**:
```javascript
var emitModuleUpdate = function() {
    window.dispatchEvent(new CustomEvent('tony-module-updated', { 
        detail: { modules: modules } 
    }));
};

if (window.Tony && window.Tony.initContextWithModules) {
    await window.Tony.initContextWithModules(modules);
    emitModuleUpdate();
} else {
    // Fallback con retry (20 tentativi) + emissione evento finale
}
```

**Risultato**: Widget riceve correttamente l'evento e aggiorna lo stato dei moduli anche in caso di timing sfavorevole.

### 9.3 Best Practices Inizializzazione Context

**Raccomandazioni per nuove pagine**:
1. Usare sempre `await` quando si chiama `initContextWithModules`.
2. Emettere sempre l'evento `tony-module-updated` dopo aver impostato il context.
3. Usare 20 tentativi invece di 10 per pagine con timing più lento.
4. Aggiungere fallback che emette l'evento anche se Tony non è disponibile.

**Helper disponibile**: `Tony.initContextWithModules(modules, maxRetries = 10)` in `core/services/tony-service.js` gestisce automaticamente il retry e l'inizializzazione del context.

---

## 10. Aggiornamenti 2026-02-25 (Tony Terreni – contesto, domande informative, superficie)

### 10.1 Problema iniziale
Tony sulla pagina terreni eseguiva correttamente FILTER_TABLE e SUM_COLUMN ma **non vedeva** quanti terreni ci fossero in totale né i nomi dei terreni. Rispondeva "non posso mostrare i dettagli" o "non posso calcolare la superficie" per singoli appezzamenti.

### 10.2 Lettura robusta di currentTableData (main.js)
- **Su pagina terreni** (`pathStr.indexOf('terreni') >= 0`): prova in ordine `window.currentTableData`, `window.top.currentTableData`, `window.__tonyTableDataBuffer`. Usa il primo che ha `items` non vuoti, altrimenti il primo disponibile.
- **Fallback**: `__tonyTableDataBuffer` (popolato da `table-data-ready`) garantisce dati anche se il buffer è stato emesso prima dell’attivazione del listener.

### 10.3 Sanificazione contesto terreni (tony-service.js)
- **_sanitizeContextForAI**: gli items di `page.currentTableData` inviati a Gemini includono ora `superficie` (arrotondata a 2 decimali). Campi: `id`, `nome`, `podere`, `coltura`, `tipoPossesso`, `scadenza`, `superficie`.
- **Fallback nome**: `item.nome || item.name || 'Senza nome'` per compatibilità con varianti di struttura dati.

### 10.4 Istruzioni Cloud Function (functions/index.js)
- **DOMANDE INFORMATIVE SUI TERRENI**: `page.tableDataSummary` per conteggio ("quanti terreni ho?"); `page.currentTableData.items[].nome` per elenco nomi; `items[].superficie` per "quanti ettari ha il Pinot?", "superficie del Cumbarazza".
- **Divieto**: Tony NON deve dire "non posso mostrare i dettagli" o "non posso calcolare la superficie" quando i dati sono nel contesto.
- **Formato risposta**: risposta informativa → `{"text": "...", "command": null}`; risposta con azione → `{"text": "...", "command": {...}}`. Vietato rispondere con solo testo senza JSON.
- **Comandi vuoti**: se `command` è vuoto o senza `type`, la CF lo rimuove prima di restituire (evita "ESEGUO COMANDO: {}" nel client).

### 10.5 Esecuzione comandi (main.js)
- **Condizione**: `commandToExecute.type` obbligatorio; comandi senza `type` (es. `{}`) non vengono eseguiti.

### 10.6 File modificati
- `core/js/tony/main.js` (lettura currentTableData, condizione commandToExecute.type)
- `core/services/tony-service.js` (superficie, fallback nome, arrotondamento)
- `functions/index.js` (istruzioni DOMANDE INFORMATIVE, formato risposta, rimozione command vuoto)
