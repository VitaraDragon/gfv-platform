# Tony — guida tecnica (modulo e runtime)

## Caricamento guida utente

- `TONY/utente/guida.md` — manuale modulo Tony (widget, Guida vs Avanzato, consigliere moduli, briefing, intervista vocale, ruoli).
- Sintesi contesto: `TONY/utente/guida-sintesi.md` → `context.guida_sintesi_tony`.

## File principali

| Area | Path |
|------|------|
| Widget UI, comandi client, gating piano/modulo | `core/js/tony/main.js` (`isTonyAdvancedActive`, `applyTonyFreemiumGate`, `processTonyCommand`, intervista lavoro/ore, briefing intercept) |
| Motore navigazione / alias pagine | `core/js/tony/engine.js` |
| Modello Gemini / guida concatenata / sintesi | `core/services/tony-service.js` (`GUIDA_LOAD_ENTRIES`, `init`, `_getContextForPrompt`) |
| Voce / TTS client | `core/js/tony/voice.js`, `core/js/tony/stream-tts-chunk.js` (`speakTextInSentenceChunks`) |
| Istruzioni cloud + Context Builder / TTS | `functions/index.js` (`tonyAsk`, `SYSTEM_INSTRUCTION_BASE` / `ADVANCED`, `buildContextAzienda`, `getTonyAudio`); helper TTS `functions/tony-tts-provider.js` |
| Consigliere moduli | `functions/tony-module-recommendations.js`, `functions/config/tony-module-recommendations.json` (+ mirror `core/config/`) — `azienda.consigliModuli`, `tryTonyModuleAdvisorQuickReply`, `TONY_MODULE_RECOMMENDATION_RULES` |
| Mapping form | `core/config/tony-form-mapping.js`, `core/js/tony-form-injector.js` |
| Briefing dashboard | `core/dashboard-standalone.html` (`checkGlobalStatus`, `tonyDashboardBriefingVoiceAllowed`, `tonyDashboardDeliverBriefing`); `core/js/dashboard-tony-briefing-text.js`; `core/js/tony/meteo-dashboard-quick-reply-utils.js` |
| Piani / moduli abbonamento | `core/config/subscription-plans.js` |

## Modulo tenant

`tenants.modules` include **`tony`** → Tony Avanzato: navigazione, form injection, filtri, briefing proattivo voce (desktop), interviste vocali client-side.

## Piani

- **free** (`applyTonyFreemiumGate`): nasconde FAB e pannello; nessun widget.
- **base** senza `tony`: **Tony Guida** — `tonyAsk` con istruzioni base + **consigliere moduli** (`subscriptionPlanId !== 'free'`); no `isTonyAdvancedActive`.
- **base + tony**: automazioni complete + briefing voce desktop.

Consigliere: `skipModuleIds` include `tony`; segnali gated se modulo disattivato (es. Conto terzi legacy).

## TTS

- CF `getTonyAudio` (`functions/index.js` + `functions/tony-tts-provider.js`): stesso contratto client (MP3 base64; può includere `provider`).
- Default: **ElevenLabs** Flash (voce `5zD2eYSLIo8c2zkowMfP`) se c’è secret `ELEVENLABS_API_KEY`.
- Fallback / rollback: senza chiave, `TONY_TTS_PROVIDER=google` (o `chirp`), o errore ElevenLabs → Google Chirp 3 `it-IT-Chirp3-HD-Charon`.
- Env utili: `TONY_TTS_PROVIDER`, `TONY_TTS_ELEVEN_VOICE`, `TONY_TTS_VOICE`, `TONY_TTS_SPEAKING_RATE`, `TONY_TTS_ELEVEN_MODEL`.
- Client: chunking frasi su risposte complete; cache/dedup prefetch↔speak in `voice.js`.

## Intervista lavoro / ore (client)

- `main.js`: `__tonyLavoroCreationFlow`, intercept «crea lavoro», segna ore senza orari; 0 CF sui turni intervista dove implementato.
- Conferme salvataggio form prima di nuova intervista.
- Domanda informativa caposquadra (`chi sono` / `quali sono` / `disponibili`): su Gestione lavori `localCaposquadraRosterReply` usa `lavoriState.caposquadraList`. Sulla Dashboard e sulle altre pagine, se quella lista non c’è, `answerCaposquadraRosterOffPage` legge `users` con la stessa query già usata da Gestione lavori (`tenantId` corrente, `ruoli` array-contains `caposquadra`, `stato` attivo). In chat restano solo nome e cognome. Niente CF, niente scheda, niente navigazione, niente operai né altri tenant. Durante l’intervista sulla scheda aggiunge la domanda in corso.
- Nome durante l’intervista: «il nome del lavoro è …», «cambia il nome in …», «rinomina …», «chiamalo …» aggiornano solo `lavoro-nome` e riprendono il dato mancante. La frase iniziale «chiamato …» resta il primo inserimento.
- Persona assente: il messaggio cita il token nome (`nomeCitatoPerAssenza`), non la frase grezza. Elenco vuoto: «elenco non è ancora pronto», senza chiedere di nuovo l’assegnazione.
- Match univoco in memoria con select senza option: fino a 3 tentativi brevi, poi «tendina non è ancora pronta». I campi già scritti restano.
- `stopLavoroCreationFlow`: chiusura modal (`closeLavoroModal` / chiusura dopo salvataggio) e pannello chat. Solo il flag. Non tocca `chatHistory` né `tony_session_state`.
- Bozza non salvata: la X memorizza i campi in `window.__tonyLavoroBozzaNonSalvata` (niente Firestore, niente `sessionStorage`; si perde al ricaricamento). Lo stato da solo non conta come bozza. La riapertura dal pulsante li rimette. **Annulla** (`annullaBozzaLavoro`) scarta senza rifotografare il form. `__tonyNuovaCreazioneLavoro` (nuovo «crea un lavoro» di Tony) apre una scheda vuota. Il salvataggio azzera la bozza.
- Residuo fuori da questo intervento: il parser Cloud Function cross-page (`extractAssigneeToken`) tiene solo la prima parola di «assegna a / per».

## Acquisizione documenti (foto / PDF)

Promessa: 📷 in chat → revisione → cascata magazzino. **Non** insegnare XML al posto dello scatto.

| Pezzo | Path |
|-------|------|
| Picker + sessione pagine | `core/js/tony/ui.js`, `document-capture.js` |
| Form revisione | `core/js/tony/document-review-form.js` |
| Registrazione movimenti | `core/js/tony/document-register.js` |
| CF estrazione | `functions/tony-extract-document.js` — due passate Gemini (`buildGeminiTranscribeParts` + `responseSchema`); Level B invariato |
| Extra silenzioso | `functions/config/tony-fatturapa.js` se il file è già XML SDI; UI resta «bolla o fattura» |
| Archivio | `document-archive.js`, lista Magazzino `documenti-acquisiti-standalone.html` |

Gate: modulo `magazzino` + `tony` + manager/admin; piano non Free. Callable `tonyExtractDocument` (timeout 180 s). Decisioni §20.34–20.36.

### HEIC / HEIF (foto iPhone da galleria)

- `document-capture.js`: helper `isHeicLikeDocumentFile` / `convertRasterFileToJpeg` — tenta decodifica HEIC via `<img>` browser, canvas→JPEG 2048 px. Su Safari/iOS spesso funziona; **Chrome desktop** può non supportare HEIC nativo → decode fail.
- Errore decodifica: mostra stringa «Non riesco a leggere questa foto (formato HEIC). Scatta una nuova foto oppure salvala come JPEG e riprova.»
- Scatto in-app: sempre JPEG/PNG dal file picker nativo; problema raro. **Galleria** iPhone può caricare HEIC originale.

## Contesto page / tabelle

Canone: `window.currentTableData`, evento `table-data-ready`, merge `setContext('page', …)`.

## Navigazione Manodopera

`engine.js`: `manodopera` / `home manodopera` → `modules/manodopera/views/manodopera-home-standalone.html` (allineato guida MANODOPERA).

## Notifiche push vs Tony in-app

Push FCM / catalogo / Impostazioni: vedi **`GUIDA/CORE/tony/guida-tecnica.md`** (§ Notifiche push). Proattivo Tony dashboard = altro canale (`tony-proactive-signals.js`, briefing). Non mischiare nei consigli all’utente.

## Navigazione APRI_PAGINA / quick-reply

- Config: `functions/tony-nav-quick-reply.js` (+ gate moduli). Verbi anche `riportami` / `torna`.
- **Dashboard** = solo home ERP `core/dashboard-standalone.html` (`pageType` `dashboard`): le `*-dashboard-standalone` di modulo (meteo, vigneto, …) **non** contano come già sulla dashboard.
- Target **meteo**: `meteo_dashboard` / `meteo-dashboard-standalone` — «apri meteo» naviga al modulo; domanda previsioni in dashboard resta quick-reply meteo senza aprire pagine sbagliate (`meteo-dashboard-quick-reply-utils.js`, `isTonyMainDashboardPath` in `engine.js`).

