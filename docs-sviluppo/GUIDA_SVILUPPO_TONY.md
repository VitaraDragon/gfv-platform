# Guida allo sviluppo del modulo Tony

Documento di riferimento per lo sviluppo dell'assistente Tony (IA integrata) nella GFV Platform. Aggiornato in base alle decisioni di architettura e alle conversazioni con Gemini.

---

## Riepilogo

Tony è un **assistente** che può essere usato sia **a voce** che **in chat scritta**. Può:

- **Eseguire operazioni** nell'app (segnare ore, lavori, aggiornare magazzino, segnalare guasti, ecc.)
- **Mostrare dati e grafici** (statistiche, costi, resa, scadenze)
- **Incrociare dati tra moduli** (es. lavori + terreni + magazzino)
- **Guidare l'utente** meno avvezzo alla tecnologia con tono **amichevole e informale** (ma preciso su numeri e azioni)
- **Interagire con microfono** (comandi vocali) e **fotocamera** (foto di bolle, guasti, piante → analisi tramite Gemini Vision)

---

## 1. Visione e obiettivi

### Cos'è Tony
- **Tony** è un assistente virtuale ("capocantiere digitale") con cui l'utente interagisce invece di navigare manualmente tra menu e schermate.
- Obiettivo: **Interfaccia invisibile** — ridurre la barriera digitale per utenti meno esperti; in campo (mobile) l'uso principale sarà a **comandi vocali**.
- Tony **immagazzina dati** nella piattaforma esistente, **risponde con dati reali** sull'azienda e può **recuperare grafici/file** quando serve.

### Cosa non è Tony
- Non è un chatbot generico: è contestualizzato all'azienda (tenant) e ai dati già presenti nell'app.
- Non sostituisce la "visualizzazione esperti": l'utente deve poter sempre verificare e correggere ciò che Tony ha fatto (accesso alla struttura completa dell'app).

---

## 2. Architettura

### Modulo dedicato (Black Box)
- **Gemini vive solo dentro il modulo Tony.** Il resto dell'app non chiama mai Gemini direttamente; integra solo Tony.
- Tony è un **modulo dedicato** che si integra con tutte le parti dell'app (attuali e future).

### Pattern: Service Singleton + Event Bus (Pub/Sub)
- **Singleton**: una sola istanza di Tony; inizializzazione centralizzata (es. dopo Firebase).
- **setContext(moduleName, data)**: gli altri moduli "nutrono" Tony con dati (dashboard, magazzino, lavori, ecc.). Tony non sa come sono stati recuperati; riceve solo il contesto.
- **onAction(callback)** / **triggerAction(actionName, params)**: quando Tony (Gemini) decide un'azione, il service emette un evento; i moduli interessati si registrano e reagiscono (es. modulo Lavori aggiorna Firestore, modulo Magazzino apre una pagina).
- **Vantaggi**: disaccoppiamento, centralizzazione (cambio modello = un solo file), reattività.

### Interfaccia di Tony (testo)
- **Input**: sempre **testo** (stringa).
- **Output**: **testo** (risposta) e/o **azioni strutturate** (Function Calling → JSON → triggerAction).
- La **voce** (microfono, altoparlante) è un **livello UI sopra Tony**: STT → testo → Tony.ask(testo) → risposta testo → TTS (Cloud Function getTonyAudio, voce it-IT-Wavenet-D). Il modulo Tony non gestisce audio; solo testo in / testo out.

### Dove vive il codice
- **Service**: `core/services/tony-service.js` (allineato a `firebase-service.js`, `auth-service.js`).
- **Backend**: `functions/index.js` — callable **tonyAsk** (regione **europe-west1**), chiama API Gemini con system instruction, richiede utente autenticato.
- **UI** (chat, pulsante microfono, eventuale widget): da definire (es. componente in dashboard o modulo dedicato `modules/tony/` in futuro).

---

## 3. Implementazione attuale (febbraio 2026)

### Cloud Function tonyAsk
- **File**: `functions/index.js`. Callable `tonyAsk` con `onCall` da `firebase-functions/v2/https`, **region: "europe-west1"**.
- **Input**: `request.data`: `{ message: string, context?: object }`. Richiede **request.auth** (utente loggato).
- **Chiave Gemini**: letta da **process.env.GEMINI_API_KEY**. Va impostata come variabile d’ambiente nella revisione Cloud Run (Google Cloud Console → Cloud Run → servizio **tonyask** → Modifica nuova revisione → Container → Variabili e secret → Nome `GEMINI_API_KEY`, Valore = API key da [Google AI Studio](https://aistudio.google.com/apikey)) → Distribuisci.
- **Output**: `{ text: string }` (risposta Gemini).

### Cloud Function getTonyAudio (TTS)
- **File**: `functions/index.js`. Callable `getTonyAudio` con `onCall`, **region: "europe-west1"**.
- **Input**: `{ text: string }`. Richiede **request.auth**.
- **TTS**: Google Cloud Text-to-Speech (`@google-cloud/text-to-speech`), voce **it-IT-Wavenet-D** (maschile, profonda), `pitch: -3.0`, `speakingRate: 0.95`, encoding MP3.
- **Output**: `{ audioContent: string (base64), voice: string }`.
- **Prerequisito**: abilitare "Cloud Text-to-Speech API" in Google Cloud Console.

### Client: regione obbligatoria
- Il client deve usare la **stessa regione** della function. In `tony-service.js` si usa **`getFunctions(app, 'europe-west1')`**. Se si usa `getFunctions(app)` senza regione, il default è `us-central1` e le chiamate falliscono con CORS/404 perché la function non è lì.

### Come provare Tony
1. Aprire la dashboard (o qualsiasi pagina dell’app con Tony) con utente loggato.
2. Cliccare il FAB 🤖 o in console: **`await Tony.ask("Ciao")`** / **`await Tony.ask("Apri il modulo attività")`**.
3. Tony risponde con testo; se riconosce un’azione, include JSON tipo `{ "action": "APRI_PAGINA", "params": { "target": "attivita" } }`. L’esecuzione reale (navigazione) avviene dopo **conferma utente** tramite dialog “Aprire la pagina «X»?” (Annulla / Apri).

### Comportamento risposta e conferma apertura pagina
- **Richieste “come fare”** (es. “Come si crea un terreno?”): Tony **prima spiega** i passi (guida app) e **non** emette `APRI_PAGINA` nella stessa risposta; propone in testo: “Se vuoi andare alla pagina Terreni, dimmi ‘apri’ o ‘sì’.” Solo quando l’utente conferma nel messaggio successivo Tony emette l’azione e il client mostra il dialog di conferma.
- **Richieste esplicite di navigazione** (“Portami ai terreni”, “Apri gestione lavori”): Tony include subito `APRI_PAGINA`; il client mostra il dialog di conferma e, se l’utente clicca Apri, naviga.
- **Dialog conferma**: sostituisce il `confirm()` nativo; overlay + box in stile Tony (tony-widget.css), pulsanti Annulla / Apri; navigazione solo su Apri.

### Tony su tutte le pagine (widget globale)
- Un unico **loader** **`core/js/tony-widget-standalone.js`** inietta FAB, pannello chat e dialog conferma; carica il CSS da `../styles/tony-widget.css`; fa polling per `getAppInstance()` e inizializza Tony; gestisce `APRI_PAGINA` con percorsi assoluti e `resolveTarget` (mappa target → path assoluto) e `showTonyConfirmDialog`.
- Ogni pagina che deve mostrare Tony include (path relativo a `core/`):
  - **Core** (stesso livello dashboard): `styles/tony-widget.css`, `js/tony-widget-standalone.js`
  - **Core/admin**: `../styles/tony-widget.css`, `../js/tony-widget-standalone.js`
  - **Modules (views)**: `../../../core/styles/tony-widget.css`, `../../../core/js/tony-widget-standalone.js`
- Pagine **senza** Tony: login, registrazione, reset-password, registrazione-invito, fix-utente-mancante. Vedi `COSA_ABBIAMO_FATTO.md` per l’elenco completo delle pagine aggiornate.

### Fallback callable
- Se `getAI(app)` non è disponibile (build Firebase da CDN senza AI provider), Tony usa automaticamente la callable **tonyAsk**. In console compare: `[Tony] Uso Cloud Function tonyAsk (getAI non disponibile in questo build).`

---

## 4. Stack tecnico

### API e SDK
- **In produzione**: la PWA usa la **Cloud Function callable tonyAsk** (Gemini API sul server). La chiave non è nel frontend; l’auth è Firebase (solo utenti loggati).
- **Alternativa (se disponibile)**: Vertex AI for Firebase / `firebase/ai` — `getAI(app)`, `getGenerativeModel`. Se il build Firebase non espone l’AI provider, Tony fa fallback alla callable (vedi sezione 3).
- **SDK**: Firebase JS **11.x** da CDN; `firebase-functions` (client) per `getFunctions(app, 'europe-west1')` e `httpsCallable`. **Tutta l’app** (dashboard, moduli, servizi) è stata migrata a Firebase 11 e usa **`core/services/firebase-service.js`** per inizializzazione, `getDb()`, `getAuthInstance()`, e funzioni Firestore/Auth; Tony si integra con lo stesso stack (nessun uso di SDK 10.x). Vedi anche `docs-sviluppo/COSA_ABBIAMO_FATTO.md` — sezione "Migrazione Firebase 11 e firebase-service".

### Configurazione Firebase
- **Piano**: Vertex AI richiede piano **Blaze** (pay-as-you-go). Verificare in Console Firebase.
- **Console**: Build → AI Logic (o Vertex AI) → abilitare le API Gemini per il progetto.
- **App Check**: attivare per limitare le chiamate alla propria app (anti-abuso).
- **Remote Config** (opzionale): memorizzare il nome del modello (es. `gemini-1.5-flash`) per aggiornarlo senza ripubblicare la PWA.

### Modello
- In uso: **gemini-2.0-flash** (veloce, stabile, latenza ridotta per streaming).
- Free tier disponibile con limiti RPM (Request Per Minute).

---

## 5. Multi-tenant

- **Nessun isolamento automatico** da parte di Gemini: il contesto va iniettato esplicitamente.
- **Strategia**: a ogni sessione/chat, il controller recupera dal tenant dell'utente loggato i dati rilevanti (nome azienda, statistiche, scadenze, guasti, ecc.) e li passa a Tony tramite **system instruction** o **setContext**.
- Esempio di prompt contestuale: *"Tu sei Tony. Stai parlando con un utente dell'azienda [NomeAzienda]. Ecco i dati attuali: [JSON]. Rispondi solo basandoti su questi."*
- **tenantId** e dati sensibili non devono mai essere mescolati tra tenant; il codice che chiama Tony deve passare solo dati del tenant corrente.

---

## 6. Azioni e Function Calling

- Per far eseguire a Tony **azioni reali** (aprire pagine, aggiornare lavori, mostrare grafici), usare il **Function Calling** di Gemini.
- **Flusso**: utente chiede → Gemini riconosce l'intento → restituisce una chiamata funzione strutturata (es. `{ "action": "UPDATE_JOB", "params": { "id": 5, "status": "done" } }`) → Tony Service chiama `triggerAction('UPDATE_JOB', params)` → i moduli iscritti con `onAction()` eseguono l'operazione (es. aggiornare Firestore).
- **Vantaggio**: niente parsing di testo libero; azioni definite e sicure.
- **Response MIME Type**: usare `application/json` (disponibile in Gemini 1.5) per forzare Tony a rispondere sempre in formato JSON leggibile dal codice; il TonyService può così estrarre le azioni dal testo e attivarle nella PWA.

---

## 7. Voce (comandi vocali) ✅ Implementato (aggiornato 2026-02-07)

### Scelta: Web Speech API (STT) + Cloud TTS (getTonyAudio)
- **Speech-to-Text (STT)**: API native del browser (SpeechRecognition).
- **Text-to-Speech (TTS)**: Cloud Function `getTonyAudio` – Google Cloud Text-to-Speech, voce **it-IT-Wavenet-D** (maschile, profonda). Nessun fallback Web Speech.
- **Vantaggi**: voce professionale, cache per testo identico (risparmio costi).

### UX voce (implementata)
- **Modalità continua (hands-free)**: un click sul microfono attiva/disattiva; dopo che Tony risponde, il microfono si riattiva da solo.
- **Push-to-Talk classico**: quando non in modalità continua, card "Hai detto: «...»" con [Annulla] [Invia].
- **TTS**: Tony parla per ogni risposta (digitata o vocale).
- **Timeout inattività (20 s)**: se non parli dopo che Tony ha finito, il microfono si spegne automaticamente.
- **Congedo vocale**: frasi come "Grazie Tony, a posto così" disattivano la modalità continua.
- **Barge-in**: clic sul microfono mentre Tony parla lo interrompe e attiva l'ascolto.

### TTS – dettagli implementativi (2026-02-07)
- **Pulizia testo** (`pulisciTestoPerVoce`): rimuove emoji, markdown, JSON, virgolette prima di getTonyAudio.
- **Cache audio**: se il testo è identico all'ultimo, si riusa l'audio senza chiamare la Cloud Function.
- **Timer "Tony-centrico"**: il timeout (20 s) non parte mentre Tony parla; si annulla in `onplay`, parte solo quando Tony finisce.

### Persistenza sessione (2026-02-07)
- **sessionStorage**: salvataggio di chatHistory, isAutoMode, lastPath a ogni messaggio e su `beforeunload`.
- **Ripristino**: se la sessione ha meno di 10 minuti, cronologia e microfono vengono ripristinati.
- **Saluto contestuale**: su cambio pagina (es. "Portami ai terreni"), Tony accoglie con *"Eccoci qui nella sezione [Titolo]. Come posso aiutarti ora?"*.

### Streaming risposta
- **askStream**: quando disponibile (SDK Firebase AI), il widget usa `Tony.askStream(text, { onChunk })` per mostrare la risposta in tempo reale.
- Con Cloud Function callable: fallback su `ask()` (nessuno streaming).

---

## 8. System instruction e azioni V1

### 8.1 System instruction attuale (ottimizzata per voce, 2026-02-06)

La system instruction è **compressa** e ottimizzata per:
- **Time to First Token** ridotto (istruzioni sintetiche)
- **Output vocale**: testo puro senza markdown, punteggiatura per pause naturali, tono informale

Struttura attuale (in `tony-service.js` e `functions/index.js`):
- **TONO E VOCABOLARIO**: verbi attivi e colloquiali ("Dagli un'occhiata", "Ecco fatto!"), interiezioni ("Bene, allora..."), rivolgersi all'utente come un collega
- **FORMATO OUTPUT VOCALE**: vietato grassetto/corsivo/elenchi puntati; evita virgolette doppie; "più" invece di +, "percento" invece di %
- **PAUSE E PUNTEGGIATURA**: virgola (pausa breve), punto (pausa media), punti di sospensione (pausa lunga prima di azioni), punto interrogativo/esclamativo per intonazione
- **MEMORIA VOCALE**: se l'utente risponde "Sì", "Vai", "Ok apri", guardare l'ultimo messaggio per capire il contesto
- **Regole operative**: 1–6 come sotto; blocco `[CONTESTO_AZIENDALE]` con `{CONTESTO_PLACEHOLDER}`

### 8.2 System instruction (versione estesa, riferimento storico)

```
Sei Tony, il Capocantiere Digitale della GFV Platform. Il tuo ruolo è assistere l'agricoltore e gli operai nella gestione quotidiana dell'azienda.

**PERSONALITÀ E TONO:**
- Sei cordiale, pratico e rassicurante. Usi un linguaggio colloquiale (es. "Ciao!", "Tutto pronto", "Dagli un'occhiata") ma sei rigoroso e preciso sui numeri e sulle date.
- Non sei un'intelligenza artificiale fredda; sei un collaboratore che conosce bene la fatica del campo e l'importanza della precisione.

**REGOLE DI RISPOSTA:**
1. RISPONDI SOLO SULLA BASE DEI DATI AZIENDALI FORNITI nel blocco [CONTESTO_AZIENDALE]. Non inventare dati che non esistono.
2. Se l'utente chiede qualcosa non presente nei dati, rispondi: "Al momento non ho queste informazioni, vuoi che provi a cercarle in un altro modulo?".
3. Se l'utente ti chiede di fare un'azione (es. segnare ore, aprire pagine), rispondi confermando l'intento e includi sempre il comando tecnico tra parentesi graffe, esempio: { "action": "NOME_AZIONE", "params": { ... } }.
4. Sii breve nelle risposte vocali: l'utente è spesso in movimento.

**[CONTESTO_AZIENDALE]**
{ 
  "info_azienda": "Placeholder: Inserire JSON con Nome Azienda, Località, Colture principali",
  "utente_corrente": "Placeholder: Inserire Nome e Ruolo utente (es. Marco, Amministratore)",
  "dati_recenti": "Placeholder: Inserire ultimi 5 lavori, scadenze imminenti o allarmi magazzino"
}
**[/CONTESTO_AZIENDALE]**

Il tuo obiettivo è semplificare la vita all'utente: se vedi un problema (es. scorta bassa), segnalalo proattivamente.
```

### 8.3 Azioni V1 (cassetta degli attrezzi)

Quando Gemini riconosce uno di questi intenti, restituisce il relativo JSON; il TonyService usa `triggerAction(actionName, params)` per notificare i moduli iscritti.

| Nome azione | Parametri | Significato | Esempio vocale utente |
|-------------|-----------|-------------|------------------------|
| `APRI_PAGINA` | `target` (string) | Apre un modulo specifico (es. 'magazzino', 'lavori', 'statistiche vigneto', 'pianifica impianto') | "Tony, portami alla gestione dei terreni" |
| `MOSTRA_GRAFICO` | `tipo` (string), `periodo` (string) | Visualizza un grafico a tutto schermo (es. 'costi', 'resa') | "Fammi vedere quanto abbiamo speso questo mese" |
| `SEGNA_ATTIVITA` | `descrizione` (string), `campo_id` (int) | Crea una nuova nota o attività nel diario di bordo | "Tony, segna che oggi abbiamo iniziato la potatura nel campo 4" |
| `REPORT_GUASTO` | `mezzo` (string), `gravita` (string) | Apre il form di segnalazione guasti pre-compilato | "Tony, il trattore New Holland perde olio, segnalalo come urgente" |
| `CONTROLLA_SCADENZA` | `categoria` (string) | Filtra l'elenco scadenze (es. 'affitti', 'manutenzioni') | "Ci sono bollette o affitti in scadenza questa settimana?" |
| `AGGIORNA_MAGAZZINO` | `item` (string), `qty` (number), `operazione` (string) | Aggiunge o toglie quantità (operazione: 'carico' o 'scarico') | "Abbiamo appena scaricato 20 sacchi di concime" |
| `CHIAMA_CONTATTO` | `nome` (string) | Avvia una chiamata telefonica verso un fornitore o dipendente | "Tony, chiama subito il meccanico" |

---

## 9. Integrazione con il resto dell'app

### Moduli che nutrono Tony (setContext)
- **Dashboard**: statistiche amministrazione, lavori recenti, scadenze, guasti, moduli attivi, utente loggato.
- **Magazzino**: scorte, allerte, ultimi movimenti (se utile).
- **Lavori / Attività**: lavori attivi, ore, squadre (se utile).
- **Altri moduli** (attuali e futuri): stesso pattern — quando hanno dati rilevanti per l'utente, chiamano `Tony.setContext('nomeModulo', data)`.
- **Pagine standalone (dashboard di modulo, terreni, ecc.)**: dopo il caricamento dei dati tenant, chiamare **`window.syncTonyModules(modules)`** (definita in `tony-widget-standalone.js`) con l'array dei moduli attivi (es. `tenant.modules`). L'helper sincronizza il context con Tony e emette l'evento `tony-module-updated`; se il widget non è ancora pronto, riprova automaticamente. Vedi COSA_ABBIAMO_FATTO 2026-02-23 e TONY_FUNZIONI_E_SOLUZIONI_TECNICHE §2.3b.

### Moduli che reagiscono a Tony (onAction)
- **Lavori**: es. UPDATE_JOB, SEGNA_ORE, APRI_LAVORI.
- **Magazzino**: es. APRI_ORDINE, MOSTRA_SCORTE.
- **Dashboard / Navigazione**: es. APRI_PAGINA, MOSTRA_GRAFICO.
- Ogni modulo che deve "fare qualcosa" quando Tony lo chiede si registra con `Tony.onAction(callback)` e filtra per `actionName`.

### Punto di ingresso
- Tony va inizializzato **dopo** Firebase (dopo `initializeFirebase`). Chi usa Tony per primo (es. dashboard) può chiamare `Tony.init(app)` una volta, o l'inizializzazione può avvenire in un punto unico (es. dopo login).

---

## 10. Roadmap sintetica

| Fase | Contenuto | Stato |
|------|-----------|--------|
| **0** | Verificare Firebase 10.12+; abilitare AI Logic / piano Blaze; attivare App Check. | Parziale: usiamo callable + Gemini API sul server. |
| **1** | Creare `core/services/tony-service.js`: init(app), setContext(), ask(), onAction(), triggerAction(). Nessuna UI. | ✅ Fatto. |
| **2** | Implementare system instruction e azioni V1 (contenuto in sezione 8). Callable **tonyAsk** in europe-west1, GEMINI_API_KEY in Cloud Run. | ✅ Fatto. |
| **3** | Integrare Tony nella dashboard: setContext con dati già caricati; primo test da console (Tony.ask). | ✅ Base fatto (test da console). |
| **4** | Collegare Tony.onAction: Gemini restituisce azioni → triggerAction → modulo reagisce; conferma utente prima di aprire pagina; dialog custom. | ✅ Fatto: APRI_PAGINA + conferma (system instruction + dialog) + navigazione. |
| **5** | UI minimale: area chat o pulsante "Chiedi a Tony"; Tony su tutte le pagine (loader standalone). | ✅ Fatto: FAB + chat + dialog conferma; loader su core, admin, modules. |
| **6** | Strato voce: Web Speech API (STT + TTS), Push-to-Talk, card di conferma per azioni da mobile. | ✅ Fatto (2026-02-06): microfono, conferma, TTS con pulizia testo, voce maschile, streaming. |
| **7** | Estensioni: Smart Search anagrafiche, analisi grafici, data entry da foto (vision), ecc. | Da fare. |

---

## 11. Riferimenti e file chiave

### Documentazione esterna
- Firebase AI Logic / Vertex AI for Firebase (documentazione ufficiale).
- Web Speech API: SpeechRecognition, SpeechSynthesis (MDN).

### File progetto (per implementazione)
- `core/services/firebase-service.js` — inizializzazione Firebase (SDK 11), getApp, getDb, getAuthInstance; usato da tutta l’app e da Tony.
- `core/services/tony-service.js` — modulo Tony: init(app), ask(), setContext(), onAction(); system instruction con regola “spiega prima, chiedi conferma per aprire”; usa getFunctions(app, 'europe-west1') e callable tonyAsk.
- **Compilazione form attività**: `core/js/tony-form-injector.js`, `core/config/tony-form-mapping.js`; flusso completo e estensione in `docs-sviluppo/TONY_COMPILAZIONE_ATTIVITA_IMPLEMENTAZIONE.md`.
- **Compilazione form Lavori**: contesto con `coltura_categoria`, `colture_con_filari`; regole sottocategoria, disambiguazione erpicatura/trinciatura, macchine, stato default, messaggio; documentazione in `docs-sviluppo/TONY_COMPILAZIONE_LAVORI_2026-02.md`.
- `core/js/tony-widget-standalone.js` — **loader widget globale**: inietta FAB, pannello chat, dialog conferma; carica tony-widget.css; risolve URL da pathname; polling getAppInstance e init Tony; onAction APRI_PAGINA con showTonyConfirmDialog. Incluso in tutte le pagine standalone (core, admin, modules) con path relativo a core/.
- `core/styles/tony-widget.css` — stili FAB, pannello chat, dialog conferma (tony-confirm-overlay, tony-confirm-box, tony-confirm-btn).
- `functions/index.js` — Cloud Function tonyAsk (europe-west1), system instruction allineata a tony-service, chiamata Gemini API.
- `core/js/dashboard-data.js` — dati già caricati da passare a Tony (statistiche, lavori, scadenze).
- `core/dashboard-standalone.html` — include solo link + script al loader Tony (nessun HTML/script Tony inline).
- `core/js/dashboard-controller.js` — dove potrebbe essere chiamato Tony.setContext dopo il caricamento dati.

### Questa guida
- Basata su: conversazioni con Gemini (brainstorming, architettura, voce, API vs Vertex, system instruction, azioni V1), e su confronto con la struttura reale del progetto GFV Platform.
- System instruction e azioni V1: definiti in sezione 8. Implementazione attuale (callable, regione, GEMINI_API_KEY, come provare): sezione 3.
- **Checklist operativa**: `docs-sviluppo/CHECKLIST_TONY.md` — voci spuntabili per setup, service, backend, integrazione (inclusi conferma apertura, dialog, widget globale), azioni V1, UI, voce, multi-tenant, estensioni.
- **Miglioramenti post-Gemini (2026-02-06)**: `docs-sviluppo/TONY_DA_IMPLEMENTARE_POST_GEMINI.md` — elenco implementazioni completate (TTS, streaming, system instruction, voce maschile, formato output vocale).
- **Migrazione Firebase 11**: tutta l’app usa Firebase 11 e `firebase-service.js`; vedi `COSA_ABBIAMO_FATTO.md` — "Migrazione Firebase 11 e firebase-service (2026-02-05)".
- **Tony globale e conferma**: comportamento risposta/conferma, dialog custom, loader `tony-widget-standalone.js` su tutte le pagine; vedi `COSA_ABBIAMO_FATTO.md` — "Tony: comportamento risposta/conferma, dialog custom, widget su tutte le pagine (2026-02-05)".

---

*Ultimo aggiornamento: febbraio 2026. Aggiornamenti 2026-02-07: modalità continua, persistenza sessione, navigazione migliorata (vedi TONY_FUNZIONI_E_SOLUZIONI_TECNICHE.md §8). Aggiornamenti 2026-02-16: compilazione form Lavori con sottocategoria corretta, disambiguazione erpicatura/trinciatura, macchine, stato default, messaggio (vedi TONY_COMPILAZIONE_LAVORI_2026-02.md).*
