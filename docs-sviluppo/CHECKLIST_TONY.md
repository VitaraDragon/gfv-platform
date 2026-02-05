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
| 4.7 | **Tony su tutte le pagine**: loader `tony-widget-standalone.js` inietta FAB + chat + dialog; URL risolti da pathname; snippet su core, core/admin, modules | COSA_ABBIAMO_FATTO, GUIDA_SVILUPPO_TONY §3 | [x] fatto |
| 4.8 | (Opz.) Lavori: onAction per SEGNA_ATTIVITA, UPDATE_JOB, ecc. | §9, §8 Azioni V1 | [ ] da fare |
| 4.9 | (Opz.) Magazzino: onAction per AGGIORNA_MAGAZZINO, MOSTRA_SCORTE | §9, §8 | [ ] da fare |

---

## 5. Azioni V1 (cassetta degli attrezzi)

| # | Azione | Parametri | In system instruction / risposta | Gestita in app (onAction) | Stato |
|---|--------|-----------|----------------------------------|----------------------------|--------|
| 5.1 | APRI_PAGINA / apri_modulo | target / modulo | §8 | Dashboard navigazione | [x] fatto |
| 5.2 | MOSTRA_GRAFICO | tipo, periodo | §8 | [ ] da fare | [ ] da fare |
| 5.3 | SEGNA_ATTIVITA | descrizione, campo_id | §8 | [ ] da fare | [ ] da fare |
| 5.4 | REPORT_GUASTO | mezzo, gravita | §8 | [ ] da fare | [ ] da fare |
| 5.5 | CONTROLLA_SCADENZA | categoria | §8 | [ ] da fare | [ ] da fare |
| 5.6 | AGGIORNA_MAGAZZINO | item, qty, operazione | §8 | [ ] da fare | [ ] da fare |
| 5.7 | CHIAMA_CONTATTO | nome | §8 | [ ] da fare | [ ] da fare |

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
| 7.1 | **Web Speech API**: STT (SpeechRecognition) → testo → Tony.ask(testo) | §7 Voce | [ ] da fare |
| 7.2 | **Web Speech API**: TTS (SpeechSynthesis) per leggere la risposta di Tony | §7 | [ ] da fare |
| 7.3 | **Push-to-Talk**: pulsante "tieni premuto per parlare" | §7 UX voce | [ ] da fare |
| 7.4 | **Card di conferma** dopo comando vocale prima di eseguire azione | §7 | [ ] da fare |

---

## 8. Multi-tenant e sicurezza

| # | Voce | Riferimento guida | Stato |
|---|------|-------------------|--------|
| 8.1 | Contesto iniettato **solo per tenant corrente** (nessun dato di altri tenant) | §5 Multi-tenant | [x] fatto (auth + context dal client) |
| 8.2 | System instruction / setContext ricevono solo dati del tenant dell’utente loggato | §5 | [~] da rafforzare quando setContext viene da dashboard |
| 8.3 | (Opz.) Remote Config per nome modello (es. gemini-1.5-flash) | §4 Remote Config | [ ] da fare |

---

## 9. Estensioni (futuro)

| # | Voce | Riferimento guida | Stato |
|---|------|-------------------|--------|
| 9.1 | Smart Search anagrafiche | §10 Fase 7 | [ ] da fare |
| 9.2 | Analisi grafici | §10 Fase 7 | [ ] da fare |
| 9.3 | Data entry da foto (Gemini Vision: bolle, guasti, piante) | §1 Riepilogo, §10 Fase 7 | [ ] da fare |

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
| 6 | Strato voce (STT, TTS, Push-to-Talk, conferma) | 7.1–7.4 | Da fare |
| 7 | Estensioni (vision, grafici, search) | 9.1–9.3 | Da fare |

---

*Checklist creata in base a `GUIDA_SVILUPPO_TONY.md`. Aggiornare gli stati qui quando si completa un punto.*
