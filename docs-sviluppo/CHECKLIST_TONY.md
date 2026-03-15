# Checklist Tony – Rispetto alla guida

Checklist operativa per lo sviluppo del modulo Tony (assistente IA). Riferimento: **`docs-sviluppo/GUIDA_SVILUPPO_TONY.md`**.

**Stati:** `[ ] da fare` | `[~] in corso` | `[x] fatto`

---

## 0. Dipendenze app (Firebase 11)

| # | Voce | Riferimento | Stato |
|---|------|-------------|--------|
| 0.1 | **Tutta l’app** usa Firebase **11** e **`core/services/firebase-service.js`** (nessun SDK 10.7.1) | `COSA_ABBIAMO_FATTO.md` — Migrazione Firebase 11 | [x] fatto |
| 0.2 | Tony e dashboard usano lo stesso `app` / `getDb()` / `getAuthInstance()` da firebase-service | §4 Stack tecnico, `GUIDA_SVILUPPO_TONY.md` | [x] fatto |

---

## 1. Setup e deploy

| # | Voce | Riferimento guida | Stato |
|---|------|-------------------|--------|
| 1.1 | Progetto Firebase su piano **Blaze** | §4 Configurazione Firebase | [x] fatto |
| 1.2 | Cloud Function **tonyAsk** deployata in **europe-west1** (Node 20, v2) | §3 Implementazione attuale, §10 Roadmap Fase 2 | [x] fatto |
| 1.3 | **GEMINI_API_KEY** impostata (Cloud Run → servizio tonyask → Variabili e secret) | §3, `functions/README.md` | [x] fatto |
| 1.4 | Client usa **getFunctions(app, 'europe-west1')** (nessun CORS/404 da us-central1) | §3 Client: regione obbligatoria | [x] fatto |
| 1.5 | Test da console: `await Tony.ask("Ciao")` e `await Tony.ask("Apri il modulo attività")` funzionano | §3 Come provare Tony | [x] fatto |
| 1.6 | (Opz.) App Check attivato per limitare abusi | §4 Configurazione Firebase | [ ] da fare |
| 1.7 | (Opz.) AI Logic / Vertex AI abilitato in Console (se in futuro si userà getAI in frontend) | §4, Roadmap Fase 0 | [ ] da fare |

---

## 2. Service e architettura (tony-service.js)

| # | Voce | Riferimento guida | Stato |
|---|------|-------------------|--------|
| 2.1 | **Tony** = Singleton; init centralizzato dopo Firebase | §2 Pattern Service Singleton | [x] fatto |
| 2.2 | **init(app)** – prova getAI, fallback a callable tonyAsk | §3 Fallback callable | [x] fatto |
| 2.3 | **ask(userPrompt)** – ritorna Promise\<string\> (testo risposta) | §2 Interfaccia testo | [x] fatto |
| 2.3b | **askStream(userPrompt, { onChunk })** – streaming quando SDK disponibile | TONY_DA_IMPLEMENTARE_POST_GEMINI | [x] fatto |
| 2.4 | **setContext(moduleName, data)** – altri moduli nutrono il contesto | §2, §9 Moduli che nutrono Tony | [x] fatto |
| 2.5 | **onAction(callback)** – registrazione callback per azioni | §2 Event Bus | [x] fatto |
| 2.6 | **triggerAction(actionName, params)** – emissione azioni verso moduli iscritti | §2, §6 Azioni e Function Calling | [x] fatto |
| 2.7 | **isReady()** – indica se init è completato | §11 File progetto | [x] fatto |

---

## 3. Backend (functions/index.js)

| # | Voce | Riferimento guida | Stato |
|---|------|-------------------|--------|
| 3.1 | Callable **tonyAsk** con **onCall** (v2), **region: "europe-west1"** | §3 Cloud Function tonyAsk | [x] fatto |
| 3.2 | Verifica **request.auth** (solo utenti loggati) | §3 Input | [x] fatto |
| 3.3 | Input: **message** (string), **context** (object opzionale) | §3 Input | [x] fatto |
| 3.4 | **System instruction** come in guida (§8) con [CONTESTO_AZIENDALE] sostituito a runtime | §8 System instruction e azioni V1 | [x] fatto |
| 3.5 | Chiamata a Gemini (API REST o SDK); output **{ text }** | §3 Output | [x] fatto |
| 3.6 | (Opz.) Parsing risposta per estrarre JSON azione e restituire anche action/params (per triggerAction lato client) | §6 Flusso | [x] fatto (parsing in tony-service.js, triggerAction dopo ask) |
| 3.7 | **Lettura moduli da context**: `request.data.context.dashboard.moduli_attivi`; se contiene `tony` → SYSTEM_INSTRUCTION_ADVANCED; iniezione "STATO UTENTE: Tony Avanzato ATTIVO" nel prompt; fallback navigazione se moduli vuoti | COSA_ABBIAMO_FATTO 2026-02-23 | [x] fatto (2026-02-23) |
| 3.8 | **Skill SmartFormValidator**: in modalità avanzata, prima di comandi che registrano dati controllare [CONTESTO].form e campi required; se manca dato essenziale chiedere e non inviare JSON | GUIDA_SVILUPPO_TONY §8.4 | [x] fatto (2026-02-23) |
| 3.9 | **Sub-agenti e mappa estesa**: se pagePath contiene `/vigneto/` → Sub-agente Vignaiolo; se `/magazzino/` → Sub-agente Logistico; TONY_TARGETS_EXTENDED; uso di context.page.availableRoutes per navigazione | GUIDA_SVILUPPO_TONY §8.4, TONY_FUNZIONI §4.2 | [x] fatto (2026-02-23) |

---

## 4. Integrazione dashboard e moduli

| # | Voce | Riferimento guida | Stato |
|---|------|-------------------|--------|
| 4.1 | Tony **inizializzato dopo Firebase** (es. in dashboard-standalone.html dopo auth) | §9 Punto di ingresso | [x] fatto |
| 4.2 | **window.Tony** esposto per test da console | §3 Come provare Tony | [x] fatto |
| 4.3 | Dashboard chiama **Tony.setContext** con dati caricati (lavori recenti, scadenze, statistiche, utente) | §9 Moduli che nutrono Tony | [x] fatto (setContext con utente, moduli_attivi dopo render) |
| 4.4 | **Tony.onAction(callback)** registrato; callback gestisce almeno **APRI_PAGINA** / apri_modulo (navigazione) | §9 Moduli che reagiscono, §10 Fase 4 | [x] fatto |
| 4.5 | **Conferma prima di aprire pagina**: per richieste "come fare" Tony non emette APRI_PAGINA; propone in testo; apre solo dopo conferma utente ("sì"/"apri") | System instruction, COSA_ABBIAMO_FATTO | [x] fatto |
| 4.6 | **Dialog conferma** custom (no confirm nativo): overlay + box "Aprire la pagina «X»?" con Annulla/Apri; stile in tony-widget.css | COSA_ABBIAMO_FATTO | [x] fatto |
| 4.7 | **Tony su tutte le pagine**: loader `tony-widget-standalone.js` importa `core/js/tony/main.js`; logica in `tony/` (main, ui, engine, voice); FAB + chat + dialog; URL assoluti + resolveTarget | GUIDA_SVILUPPO_TONY §3 | [x] fatto |
| 4.8 | **Compilazione form Lavori** (INJECT_FORM_DATA): Tony compila form Crea Nuovo Lavoro con sottocategoria, tipo, macchine, stato; contesto coltura_categoria, colture_con_filari | TONY_COMPILAZIONE_LAVORI_2026-02 | [x] fatto (2026-02-16) |
| 4.9 | (Opz.) Lavori: onAction per SEGNA_ATTIVITA, UPDATE_JOB, ecc. | §9, §8 Azioni V1 | [ ] da fare |
| 4.10 | (Opz.) Magazzino: onAction per AGGIORNA_MAGAZZINO, MOSTRA_SCORTE | §9, §8 | [ ] da fare |
| 4.11 | **Context moduli su tutte le pagine**: helper `syncTonyModules(modules)` in widget; dashboard di modulo (Frutteto, Vigneto) lo chiamano dopo caricamento tenant; bypass navigazione (APRI_PAGINA/apri_modulo ignorano isTonyAdvancedActive) | COSA_ABBIAMO_FATTO 2026-02-23, TONY_FUNZIONI 2.3b | [x] fatto (2026-02-23) |
| 4.12 | **Navigazione**: normalizzazione command da CF (action→type) in onComplete; base path `/gfv-platform` in getUrlForTarget quando pathname contiene `/gfv-platform/` (evita 404 da smartphone/online) | COSA_ABBIAMO_FATTO 2026-02-23 §6–7, TONY_FUNZIONI 2.3b | [x] fatto (2026-02-23) |
| 4.13 | **Auto-discovery moduli**: getModuliFromDiscovery() da sessionStorage (`tony_moduli_attivi`), window.userModules, window.tenantConfig; saveModuliToStorage(); restoreTonyState carica moduli da sessionStorage; checkTonyModuleStatus usa auto-discovery se context vuoto | COSA_ABBIAMO_FATTO 2026-02-23, TONY_FUNZIONI §2.3d | [x] fatto (2026-02-23) |
| 4.14 | **Blocco preventivo invio**: in sendRequestWithContext, se moduli_attivi assenti tenta getModuliFromDiscovery(), aggiorna context, attende 150 ms (doActualSend) prima di inviare alla CF così la risposta non è "Attiva il modulo" | COSA_ABBIAMO_FATTO 2026-02-23, GUIDA_SVILUPPO_TONY §3 | [x] fatto (2026-02-23) |
| 4.15 | **Rotte evolutive**: caricamento `core/config/tony-routes.json` all'init; context.page (pagePath, availableTargets, availableRoutes) inviato alla CF; script `npm run generate:tony-routes` (generate-tony-routes.cjs) per aggiornare la mappa | GUIDA_SVILUPPO_TONY §3, §11 | [x] fatto (2026-02-23) |

---

## 5. Azioni V1 (cassetta degli attrezzi)

| # | Azione | Parametri | In system instruction / risposta | Gestita in app (onAction) | Stato |
|---|--------|-----------|----------------------------------|----------------------------|--------|
| 5.1 | APRI_PAGINA / apri_modulo | target / modulo | §8 | Dashboard navigazione | [x] fatto |
| 5.2 | INJECT_FORM_DATA (form Attività) | formId, formData | SYSTEM_INSTRUCTION_ATTIVITA | TonyFormInjector.injectAttivitaForm | [x] fatto |
| 5.3 | INJECT_FORM_DATA (form Lavori) | formId, formData | SYSTEM_INSTRUCTION_LAVORO | TonyFormInjector.injectLavoroForm | [x] fatto (2026-02-16) |
| 5.3b | OPEN_MODAL | id (attivita-modal, ora-modal, lavoro-modal) | CF avanzata | main.js processTonyCommand | [x] fatto |
| 5.3c | SET_FIELD | field, value | CF avanzata | main.js + SmartFormFiller | [x] fatto |
| 5.3d | SAVE_ACTIVITY | — | CF avanzata | main.js CLICK_BUTTON | [x] fatto |
| 5.3e | FILTER_TABLE | params (podere, categoria, coltura, possesso, alert) | CF avanzata terreni | main.js processTonyCommand | [x] fatto (2026-02-25) |
| 5.3f | SUM_COLUMN | params, messageTemplate | CF avanzata terreni | main.js processTonyCommand | [x] fatto (2026-02-25) |
| 5.3g | FILTER_TABLE attivita | params (terreno, tipoLavoro, coltura, origine, data, dataDa, dataA, ricerca) | CF avanzata attivita | main.js processTonyCommand | [x] fatto (2026-03-08) |
| 5.3h | FILTER_TABLE lavori | params (stato, progresso, caposquadra, terreno, tipo, tipoLavoro, operaio) | CF avanzata lavori | main.js processTonyCommand | [x] fatto (2026-03-08) |
| 5.4 | MOSTRA_GRAFICO | tipo, periodo | §8 | [ ] da fare | [ ] da fare |
| 5.5 | SEGNA_ATTIVITA | descrizione, campo_id | §8 | [ ] da fare | [ ] da fare |
| 5.6 | REPORT_GUASTO | mezzo, gravita | §8 | [ ] da fare | [ ] da fare |
| 5.7 | CONTROLLA_SCADENZA | categoria | §8 | [ ] da fare | [ ] da fare |
| 5.8 | AGGIORNA_MAGAZZINO | item, qty, operazione | §8 | [ ] da fare | [ ] da fare |
| 5.9 | CHIAMA_CONTATTO | nome | §8 | [ ] da fare | [ ] da fare |

---

## 6. UI

| # | Voce | Riferimento guida | Stato |
|---|------|-------------------|--------|
| 6.1 | UI minimale: **area chat** o pulsante **"Chiedi a Tony"** (desktop) | §10 Fase 5 | [x] fatto |
| 6.2 | Utente può scrivere messaggio e vedere risposta di Tony senza usare la console | §10 Fase 5 | [x] fatto |
| 6.3 | **Tony widget su tutte le pagine** (FAB + pannello + dialog conferma) via loader standalone | COSA_ABBIAMO_FATTO, §3 GUIDA_SVILUPPO_TONY | [x] fatto |

---

## 7. Voce (comandi vocali)

| # | Voce | Riferimento guida | Stato |
|---|------|-------------------|--------|
| 7.1 | **Web Speech API**: STT (SpeechRecognition) → testo → Tony.ask(testo) | §7 Voce | [x] fatto |
| 7.2 | **TTS cloud**: getTonyAudio (it-IT-Wavenet-D maschile), nessun fallback Web Speech | §7 | [x] fatto (2026-02-07) |
| 7.3 | **Push-to-Talk**: pulsante "tieni premuto per parlare" | §7 UX voce | [x] fatto |
| 7.4 | **Card di conferma** dopo comando vocale prima di eseguire azione | §7 | [x] fatto |
| 7.5 | **Modalità continua (hands-free)**: toggle microfono, invio automatico, riattivazione dopo risposta | TONY_FUNZIONI §8.1 | [x] fatto (2026-02-07) |
| 7.6 | **Timeout inattività (20 s)**: spegnimento automatico; timer non parte durante Tony parla | TONY_FUNZIONI §8.2 | [x] fatto (2026-02-07) |
| 7.7 | **Congedo vocale**: checkFarewellIntent ("grazie", "a posto così", ecc.) → toggleAutoMode(false) | TONY_FUNZIONI §8.3 | [x] fatto (2026-02-07) |
| 7.8 | **Barge-in**: clic microfono mentre Tony parla → interrompe e attiva ascolto | TONY_FUNZIONI §8.4 | [x] fatto (2026-02-07) |
| 7.9 | **Persistenza sessione**: saveTonyState/restoreTonyState, sessionStorage, saluto contestuale | TONY_FUNZIONI §8.5 | [x] fatto (2026-02-07) |
| 7.10 | **Cache audio**: riuso audio se testo identico (risparmio costi getTonyAudio) | TONY_FUNZIONI §8.6 | [x] fatto (2026-02-07) |

---

## 8. Multi-tenant e sicurezza

| # | Voce | Riferimento guida | Stato |
|---|------|-------------------|--------|
| 8.1 | Contesto iniettato **solo per tenant corrente** (nessun dato di altri tenant) | §5 Multi-tenant | [x] fatto (auth + context dal client) |
| 8.2 | System instruction / setContext ricevono solo dati del tenant dell’utente loggato | §5 | [~] da rafforzare quando setContext viene da dashboard |
| 8.3 | (Opz.) Remote Config per nome modello (es. gemini-2.0-flash) | §4 Remote Config | [ ] da fare |

---

## 9. Compilazione form (INJECT_FORM_DATA)

| # | Voce | Riferimento | Stato |
|---|------|-------------|--------|
| 9.1 | **Form Attività** (attivita-form): Tony compila con tipo lavoro, terreno, orari, macchina, attrezzo; derivazione categoria/sottocategoria; override Generale→Tra le File su terreni con filari; fallback SAVE_ACTIVITY non su domande | TONY_COMPILAZIONE_ATTIVITA_IMPLEMENTAZIONE, COSA_ABBIAMO_FATTO 2026-03-02 | [x] fatto |
| 9.2 | **Form Lavori** (lavoro-form): Tony compila con sottocategoria "Tra le File" per vigneti/frutteti, disambiguazione erpicatura/trinciatura, macchine, stato "assegnato", messaggio conferma salvataggio | TONY_COMPILAZIONE_LAVORI_2026-02 | [x] fatto (2026-02-16) |
| 9.3 | (Opz.) Altri form (magazzino, guasti, ecc.) | GUIDA_TONY_OPERATIVO | [ ] da fare |

---

## 10. Estensioni (futuro)

| # | Voce | Riferimento guida | Stato |
|---|------|-------------------|--------|
| 10.1 | Smart Search anagrafiche | §10 Fase 7 | [ ] da fare |
| 10.2 | Analisi grafici | §10 Fase 7 | [ ] da fare |
| 10.3 | Data entry da foto (Gemini Vision: bolle, guasti, piante) | §1 Riepilogo, §10 Fase 7 | [ ] da fare |

---

## Riepilogo stato (allineato alla Roadmap guida §10)

| Fase guida | Contenuto | Checklist (numeri sopra) | Stato |
|------------|-----------|---------------------------|--------|
| 0 dipendenze | Firebase 11 + firebase-service (tutta l’app) | 0.1, 0.2 | Fatto |
| 0 | Firebase / Blaze / AI Logic / App Check | 1.1, 1.6, 1.7 | Parziale |
| 1 | tony-service.js: init, setContext, ask, onAction, triggerAction | 2.1–2.7 | Fatto |
| 2 | System instruction, tonyAsk, GEMINI_API_KEY, regione | 1.2–1.5, 3.1–3.5 | Fatto |
| 3 | Integrazione dashboard, test da console | 4.1–4.2, 1.5 | Fatto |
| 4 | onAction collegato: navigazione / azioni reali; conferma apertura pagina; dialog custom | 4.4–4.7, 5.1–5.7 | Parziale (APRI_PAGINA + conferma + dialog fatto) |
| 5 | UI chat / pulsante "Chiedi a Tony"; Tony su tutte le pagine (loader) | 6.1–6.3 | Fatto |
| 6 | Strato voce (STT, TTS, Push-to-Talk, conferma) | 7.1–7.4 | Fatto (2026-02-06) |
| 7 | Estensioni (vision, grafici, search) | 10.1–10.3 | Da fare |
| — | **Compilazione form Lavori** (2026-02-16) | 9.2, 4.8 | Fatto |

---

*Checklist creata in base a `GUIDA_SVILUPPO_TONY.md`. Ultimo aggiornamento (verifica codice/doc): 2026-03-08. FILTER_TABLE attivita (origine) e FILTER_TABLE lavori (stato, progresso, caposquadra, terreno, tipo, tipoLavoro, operaio) 2026-03-08.*
