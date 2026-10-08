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
- Cifra **1** parlata (`normalizeItalianCardinalOneForTTS` in `voice.js`, #147/#148): letta **un / uno / una / un’** secondo la parola che segue (genere, s impura/gn/z/ps, maschili in -a tipo «problema», femminili non in -a tipo «macchine»); resta «uno» davanti a preposizioni/numeri («da 1 a 5», «1 su 3») e su decimali, ore «1:30», frazioni, intervalli; davanti a un mese → «primo» («1 ottobre»); «alle/dalle/le 1» → «all’una / dall’una / l’una»; unità al singolare («1 ettaro», «1 litro»). Ultimo passo di `pulisciTestoPerVoce` (dopo espansione unità e contrazioni). Test `tests/tony-voice-italian-tts.test.js`. Contatori UI senza desinenza attaccata («1 squadra» / «2 squadre», «1 riga … evidenziata»).

## Intervista lavoro / ore (client)

- `main.js`: `__tonyLavoroCreationFlow`, intercept «crea lavoro», segna ore senza orari; 0 CF sui turni intervista dove implementato.
- Conferme salvataggio form prima di nuova intervista.
- **Lavoro fatto in campo** (regola prodotto): ogni frase «ho fatto / ho finito / ore di lavoro» → **senza Manodopera** Diario, **con Manodopera** Gestione lavori (o flusso ore/lavoro del ruolo), **mai** Diario in creazione. Helper `core/js/tony/tony-lavoro-fatto-nav.js`: `isLavoroFattoInCampo` riconosce oggi la **frase intera** vigna («ho/o' fatto la vigna», «ho finito in vigna», «fatto il lavoro in vigna»); escluse carburante/pieno/carico, preventivo, «nuovo lavoro». `resolveLavoroFattoNav` → senza Manodopera `attivita` + `attivita-modal` («Ti porto al diario.»), con Manodopera `gestione lavori` + `lavoro-modal`. Altre frasi «ore/lavoro fatto» (es. «ho trinciato otto ore…») seguono la stessa destinazione via navigazione/intervista. In `main.js` intercept prima della CF, non su profilo campo (`getTonyFieldProfileFromContext`) né con `attivita-modal`/`lavoro-modal` già aperti; `mapDiarioFieldsToLavoro` copia solo campi già presenti (attivita-* → lavoro-*); `alignLavoroFattoSpeech` riscrive «ti porto al diario» in Gestione lavori con Manodopera. Gate moduli in `core/config/tony-module-gate.js`.
- **Slot turno** (`engine.js`: `analyzeTonyJobSlots`, `dropStaleJobCarryover`): un lavoro nuovo non eredita terreno e ore del turno precedente se l’utente non li ripete (scenario T-TURN-SLOT-001).

## Testo visibile in chat

`engine.js`: `sanitizeTonyVisibleChatText`, `resolveTonyUserVisibleText`, `stripLeakedTonyCommandJsonFromText`, `cleanTextFromJsonResidue` — la bolla mostra solo la frase; il JSON comandi (`OPEN_MODAL`, `INJECT_FORM_DATA`, …) resta interno anche se la risposta arriva troncata.

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

