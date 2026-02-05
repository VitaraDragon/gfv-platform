# Tony – Funzionalità attuali e soluzioni tecniche (per review / miglioramenti)

Documento di sintesi su come funziona Tony, quali funzioni ha oggi e quali scelte tecniche abbiamo adottato. Pensato per incollare il contenuto in un assistente (es. Gemini) e chiedere suggerimenti di miglioramento.

---

## 1. Cos’è Tony e che ruolo ha

- **Tony** è l’assistente IA integrato nella **GFV Platform**, un’app web multi-tenant per la gestione aziendale agricola (terreni, attività, lavori, moduli Vigneto/Frutteto/Magazzino/Conto Terzi, manodopera, ecc.).
- Ruolo: **“Capocantiere digitale”** – risponde a domande sull’app e sui dati dell’azienda, spiega come fare le operazioni, può proporre di aprire una pagina e, su conferma utente, eseguire la navigazione.
- **Solo testo** per ora: niente voce (STT/TTS), niente foto/vision. Input e output sono stringhe; l’UI è una chat con FAB (pulsante) che apre il pannello.
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
- **Richiesta esplicita** (“Portami ai terreni”, “Apri gestione lavori”, “Voglio andare al magazzino”): Tony risponde confermando e include nella risposta un blocco JSON `{ "action": "APRI_PAGINA", "params": { "target": "terreni" } }` (o altro target tra: terreni, attivita, lavori, statistiche, magazzino, vigneto, vigneti, frutteto, frutteti, conto terzi, report, amministrazione, guasti, abbonamento, impostazioni, diario).
- Il **client** (loader widget):
  - Intercetta l’azione tramite `Tony.onAction(callback)`.
  - Mostra sempre un **dialog di conferma** custom (non `confirm()` del browser): “Aprire la pagina «Terreni»?” con pulsanti **Annulla** / **Apri**.
  - Se l’utente clicca **Apri**, naviga con `window.location.href` all’URL corretto (calcolato in base al pathname della pagina corrente e a una mappa target → path da root).

### 2.4 Altre azioni (definite in system instruction, non ancora gestite in UI)
- La system instruction menziona altre azioni (segnare ore, segnalare guasti, ecc.) con formato `{ "action": "NOME_AZIONE", "params": { ... } }`. Il **parsing** lato client estrae qualsiasi blocco JSON di questo tipo e chiama `triggerAction(actionName, params)`; oggi **solo** `APRI_PAGINA` (e alias `apri_modulo`) è gestita nel widget (navigazione + conferma). Le altre azioni vengono emesse ma nessun modulo è ancora iscritto per eseguirle.

### 2.5 Cosa Tony non fa (ancora)
- **Voce**: nessun STT (Speech-to-Text) né TTS (Text-to-Speech); nessun pulsante “tieni premuto per parlare”.
- **Esecuzione azioni diverse da APRI_PAGINA**: nessun handler per SEGNA_ATTIVITA, REPORT_GUASTO, AGGIORNA_MAGAZZINO, MOSTRA_GRAFICO, ecc.
- **Storia conversazione**: ogni `ask()` è stateless (contesto sì, ma non c’è invio dello storico messaggi a Gemini).
- **Pagina corrente**: Tony non sa esplicitamente “sei sulla pagina X”; potrebbe inferirlo solo dal contesto se qualcuno lo inietta.

---

## 3. Flusso tecnico (dalla domanda alla risposta/azione)

1. **Utente** scrive un messaggio nel campo della chat e invia (o Enter).
2. **Widget** chiama `Tony.ask(testo)` (dopo aver verificato `Tony.isReady()`).
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

### 4.2 Backend (Cloud Function)
- **Funzione**: `tonyAsk` (Firebase Functions v2, `onCall`), **regione europe-west1**.
- **Autenticazione**: `request.auth` obbligatorio (solo utenti loggati).
- **Input**: `{ message: string, context?: object }`. Il `context` è quello che il client ha in `Tony.context` (guida_app, dashboard, vigneto, ecc.).
- **Chiave Gemini**: `process.env.GEMINI_API_KEY` (impostata come variabile d’ambiente nella revisione Cloud Run del servizio che ospita la function).
- **Chiamata a Gemini**: API REST `generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent` con body: `contents` (user prompt), `systemInstruction` (testo con `{CONTESTO_PLACEHOLDER}` sostituito dal JSON del contesto), `generationConfig` (temperature 0.7, maxOutputTokens 1024).
- **Output**: `{ text: string }`. Il parsing delle azioni JSON avviene **solo lato client** (tony-service.js); la function restituisce il testo grezzo.

### 4.3 Client – Tony Service (`core/services/tony-service.js`)
- **Init**: `Tony.init(app)` con `app` da `getAppInstance()` (firebase-service).  
  - Prova prima a usare **Firebase AI** (Vertex AI / getAI): `import('https://esm.sh/firebase@11/ai')`, `getAI(app, { backend: new GoogleAIBackend() })`, `getGenerativeModel(this.ai, { model: 'gemini-2.5-flash', systemInstruction })`.  
  - Se fallisce (es. “Service AI is not available”), **fallback** a **callable** `tonyAsk`: `getFunctions(app, 'europe-west1')`, `httpsCallable(functions, 'tonyAsk')`.
- **Guida app**: all’init, `loadGuidaAppFull()` prova a caricare i file .md da `core/guida-app/` o `docs-sviluppo/guida-app/`; se riesce, `context.guida_app = fullGuida`, altrimenti `context.guida_app = GUIDA_APP_PER_TONY` (stringa condensata da `tony-guida-app.js`).
- **Contesto**: `this.context` è un oggetto; chiavi tipiche: `guida_app`, `dashboard`, `vigneto`. `setContext(moduleName, data)` aggiorna `this.context[moduleName] = data` e, se il modello SDK è in uso, ricostruisce il modello con `_buildModel()` (system instruction aggiornata con il nuovo JSON).
- **ask(userPrompt)**: a seconda di callable vs SDK, invia messaggio + contesto e ottiene il testo; poi `_parseAndTriggerActions(text)` per estrarre azioni e ripulire il testo; restituisce il testo ripulito.
- **Parsing azioni**: regex per trovare `{ "action": "NOME", "params": ... }`; parsing a graffe bilanciate per estrarre JSON; per ogni blocco valido `triggerAction(parsed.action, parsed.params)`; il testo restituito è senza questi blocchi.

### 4.4 System instruction (regole per il modello)
- **Ruolo**: Tony, Capocantiere Digitale; cordiale, pratico, preciso su numeri e date; risposte brevi.
- **Regola 0 (esperienza app)**: per domande “come fare” → spiegare prima con guida_app, proporre in testo di aprire la pagina, **non** includere `APRI_PAGINA` nella stessa risposta; includere `APRI_PAGINA` solo quando l’utente conferma in un messaggio successivo. Per richieste esplicite di “apri/portami” → includere subito `APRI_PAGINA`.
- **Regola 1**: usare solo i dati in `[CONTESTO_AZIENDALE]`; non inventare.
- **Regola 2**: per produzione/resa vigneto, usare dati contesto se presenti; altrimenti suggerire modulo e “dimmi sì/apri per portarti lì” **senza** emettere APRI_PAGINA in quella risposta.
- **Regola 3**: per richieste esplicite di navigazione → sempre `APRI_PAGINA` con `target` in un set fisso (terreni, attivita, lavori, …).
- **Regola 4**: altre azioni (segnare ore, guasti, ecc.) → risposta + JSON `{ "action": "NOME", "params": {...} }`.
- **Regola 5**: per dati non in contesto → suggerire il modulo dove trovarli, non “non ho queste informazioni” generico.
- **Regola 6**: risposte brevi.
- Il blocco `[CONTESTO_AZIENDALE]` è sostituito a runtime con `JSON.stringify(this.context, null, 2)` (o equivalente lato callable).

### 4.5 Widget globale (loader su tutte le pagine)
- **File**: `core/js/tony-widget-standalone.js` (script type="module"). Ogni pagina che vuole Tony include anche il CSS: `core/styles/tony-widget.css` (path relativo a core: `styles/` da core, `../styles/` da admin, `../../../core/styles/` da modules).
- **Caricamento CSS**: lo script usa `import.meta.url` per la base e aggiunge dinamicamente `<link href=".../styles/tony-widget.css">` in `document.head`.
- **Iniezione DOM**: alla prima esecuzione crea e appende al `body`: (1) FAB (pulsante 🤖), (2) pannello chat (header “Tony – Assistente”, area messaggi, input + pulsante Invia), (3) overlay del dialog di conferma (titolo, messaggio, Annulla, Apri). Nessun HTML Tony nelle pagine; tutto generato dallo script.
- **Chat UI**: event listener su FAB (apri/chiudi pannello, primo messaggio di benvenuto), su Invia e su Enter (chiamata a `Tony.ask()`, append messaggio utente, “Sto pensando…”, poi risposta o errore). `window.Tony` usato per `ask` e `isReady()`.
- **Inizializzazione di Tony**: lo script **non** conosce l’ordine di caricamento rispetto a Firebase. Fa **polling** (ogni 250 ms, max 40 tentativi ≈ 10 s): import dinamico di `firebase-service.js` e `tony-service.js`, chiamata a `getAppInstance()`; quando restituisce un’istanza valida, chiama `Tony.init(app)`, poi registra `Tony.onAction(...)` per gestire `APRI_PAGINA` / `apri_modulo`.
- **Gestione APRI_PAGINA**: callback riceve `target` (e eventuale alias); una mappa fissa associa target (es. `terreni`, `lavori`, `vigneto`) a **path da root** (es. `core/terreni-standalone.html`, `core/admin/gestione-lavori-standalone.html`, `modules/vigneto/views/vigneto-dashboard-standalone.html`). Da `window.location.pathname` si ricava la “profondità” della pagina corrente (numero di segmenti nel path); si costruisce il path relativo come `../`.repeat(depth) + pathFromRoot. Si mostra `showTonyConfirmDialog('Aprire la pagina «Label»?')`; se l’utente conferma, `window.location.href = url`.
- **Dialog conferma**: non si usa `confirm()`; overlay + box con stili in `tony-widget.css` (`.tony-confirm-overlay`, `.tony-confirm-box`, `.tony-confirm-btn`). Una Promise risolta con true/false a seconda di Apri/Annulla (o click su overlay); la navigazione avviene solo se true.

### 4.6 Dove è presente Tony
- **Incluso**: dashboard, terreni, attivita, statistiche, segnatura-ore (core); tutte le pagine standalone in core/admin (gestione-lavori, amministrazione, gestione-guasti, segnalazione-guasti, gestisci-utenti, gestione-operai, gestione-squadre, compensi-operai, gestione-macchine, statistiche-manodopera, validazione-ore, abbonamento, impostazioni, lavori-caposquadra, report); tutte le view standalone dei moduli vigneto, frutteto, magazzino, conto-terzi, report.
- **Escluso**: login, registrazione, reset-password, registrazione-invito, fix-utente-mancante (e opzionalmente accetta-preventivo, che è pagina pubblica).

### 4.7 Stack e dipendenze
- **Firebase**: SDK 11; tutta l’app usa `core/services/firebase-service.js` per `getAppInstance()`, `getAuthInstance()`, `getDb()`. Tony riceve `app` da lì.
- **Modello**: in SDK si usa `gemini-2.5-flash`; in callable si usa `gemini-2.0-flash` (API REST). Stessa system instruction concettualmente; la callable non ricollega la conversazione (stateless).
- **Nessuna storia messaggi**: ogni richiesta è indipendente; solo il contesto (guida_app, dashboard, vigneto, ecc.) viene inviato insieme al singolo messaggio.

---

## 5. Riepilogo punti critici / possibili miglioramenti

- **Stateless**: nessuno storico di messaggi inviato a Gemini; il modello non “ricorda” il turno precedente.
- **Contesto limitato**: solo dashboard (e opzionale vigneto) invia dati; altre pagine non chiamano `setContext`, quindi Tony non ha dati “della pagina corrente” né di altri moduli se non caricati in dashboard.
- **Una sola azione gestita in UI**: APRI_PAGINA; le altre azioni sono emesse ma non hanno handler.
- **Nessuna voce**: tutto testo; in campo sarebbe utile STT/TTS e conferma prima di azioni critiche.
- **Doppio canale (SDK vs callable)**: comportamento equivalente ma due path (getAI + modello locale vs callable + API REST); la callable è quella usata in produzione se getAI non è disponibile nel build.
- **Path resolution**: la mappa URL è “path da root”; se l’app è servita sotto una base path (es. `/app/`), il calcolo relativo potrebbe richiedere adattamenti.

---

*Documento generato per condividere lo stato attuale di Tony con un assistente esterno e raccogliere idee di miglioramento. Riferimenti: `core/services/tony-service.js`, `core/js/tony-widget-standalone.js`, `functions/index.js`, `docs-sviluppo/GUIDA_SVILUPPO_TONY.md`, `docs-sviluppo/COSA_ABBIAMO_FATTO.md`.*
