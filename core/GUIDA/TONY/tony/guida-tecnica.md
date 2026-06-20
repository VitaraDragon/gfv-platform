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
| Istruzioni cloud + Context Builder | `functions/index.js` (`tonyAsk`, `SYSTEM_INSTRUCTION_BASE` / `ADVANCED`, `buildContextAzienda`, `getTonyAudio`) |
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

- CF `getTonyAudio`: voce default Chirp 3 HD; `speakingRate` default ~1.05 (env `TONY_TTS_SPEAKING_RATE`).
- Client: chunking frasi su risposte complete; cache/dedup prefetch↔speak in `voice.js`.

## Intervista lavoro / ore (client)

- `main.js`: `__tonyLavoroCreationFlow`, intercept «crea lavoro», segna ore senza orari; 0 CF sui turni intervista dove implementato.
- Conferme salvataggio form prima di nuova intervista.

## Contesto page / tabelle

Canone: `window.currentTableData`, evento `table-data-ready`, merge `setContext('page', …)`.

## Navigazione Manodopera

`engine.js`: `manodopera` / `home manodopera` → `modules/manodopera/views/manodopera-home-standalone.html` (allineato guida MANODOPERA).
