# Tony — guida tecnica (modulo e runtime)

## Caricamento guida utente

- `TONY/utente/guida.md` — manuale modulo Tony (widget, Guida vs Avanzato, piano, ruoli, esempi).
- Sintesi contesto: `TONY/utente/guida-sintesi.md` → `context.guida_sintesi_tony`.

## File principali

| Area | Path |
|------|------|
| Widget UI, comandi client, gating modulo / piano | `core/js/tony/main.js` (`isTonyAdvancedActive`, `applyTonyFreemiumGate`, `processTonyCommand`, `tonyNotifyFieldProfileBlocked`, …) |
| Modello Gemini / guida concatenata / sintesi | `core/services/tony-service.js` (`GUIDA_LOAD_ENTRIES`, `init`, `_getContextForPrompt`) |
| Voce / TTS | `core/js/tony/voice.js` |
| Istruzioni cloud + Context Builder | `functions/index.js` (`tonyAsk`, `SYSTEM_INSTRUCTION_BASE` / `ADVANCED`, `buildContextAzienda`) |
| Mapping form | `core/config/tony-form-mapping.js`, `core/js/tony-form-injector.js` |
| Briefing dashboard (dati + voce) | `core/dashboard-standalone.html` (`checkGlobalStatus`, `tonyDashboardBriefingVoiceAllowed`) |

## Modulo tenant

`tenants.modules` include la stringa **`tony`** (solitamente minuscolo in confronti) → Tony Avanzato attivo: navigazione e comandi strutturati abilitati lato client e istruzioni estese lato Cloud Function quando previsto.

## Piani

- **free** (`applyTonyFreemiumGate`): nasconde FAB e pannello; nessun uso pratico del widget.
- **Base + tony**: automazioni; **Base senza tony**: guida testuale senza comandi operativi strutturati (messaggi lato widget se si chiede navigazione).

## Contesto page / tabelle

Allineamento canone: `window.currentTableData`, evento `table-data-ready`, merge `setContext('page', …)` dove implementato nelle pagine.
