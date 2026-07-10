# Tony – Documentazione consolidata

**Cartella**: `docs-sviluppo/tony/`  
**Ultimo aggiornamento**: 2026-07-10

Tony è l'assistente IA centrale di GFV Platform. Questa cartella contiene i **documenti canonici** (stato e piano). Piani attivi e backlog sono in `in-sviluppo/` e `da-fare/`.

---

## Documenti in questa cartella (canonici)

| File | Contenuto |
|------|-----------|
| **MASTER_PLAN.md** | Visione, architettura, roadmap, principi di scalabilità. Ogni modifica Tony deve allinearsi a questo piano. |
| **STATO_ATTUALE.md** | Stato verificato sul codice: cosa funziona, cosa manca, prossimi passi. |
| **HANDOFF_TTS_CHIRP3.md** | Handoff voce Tony: Chirp 3 HD Charon, `speakingRate`, latenza pipeline, canary TTS. |
| **PIANO_AUDIO_PIPELINE_BARGEIN.md** | Fase 1 barge-in implementata; riferimento pipeline audio. |
| **README.md** | Questo file – panoramica e link. |

## Documenti spostati (2026-07-10)

| Argomento | Nuovo path |
|-----------|------------|
| Performance Tony (Fase 0–4) | `docs-sviluppo/in-sviluppo/tony/PLAN_OTTIMIZZAZIONE_PERFORMANCE.md` |
| Handoff nav / quick reply | `docs-sviluppo/in-sviluppo/tony/HANDOFF_CONTINUITA_PERFORMANCE_NAV.md` |
| Sostituzioni manodopera (design) | `docs-sviluppo/da-fare/tony/PIANO_SOSTITUZIONE_MANODOPERA_SQUADRE.md` |
| Tony E2E simulatore | `docs-sviluppo/in-sviluppo/simulator/TONY_E2E_GUIDA_SVILUPPO.md` |
| Tony Occhi / documenti Gemini | `docs-sviluppo/da-fare/magazzino/ROADMAP_ACQUISIZIONE_DOCUMENTI_GEMINI.md` |
| Doc obsoleti Tony | `docs-sviluppo/obsoleto/archivio-tony/` |

**Indice generale:** `docs-sviluppo/INDICE_DOCUMENTAZIONE.md`

---

## Dove trovare cosa

| Argomento | Dove |
|-----------|------|
| **Decisioni e requisiti** | `docs-sviluppo/TONY_DECISIONI_E_REQUISITI.md` |
| **Guida sviluppo** | `docs-sviluppo/GUIDA_SVILUPPO_TONY.md` |
| **Context Builder** | `docs-sviluppo/CONTEXT_BUILDER_SPECIFICHE_SVILUPPO.md` |
| **currentTableData + FILTER_TABLE** | `docs-sviluppo/RIEPILOGO_CURRENTTABLEDATA_PER_MODULO_LISTE.md` |
| **Changelog** | `docs-sviluppo/COSA_ABBIAMO_FATTO.md` |
| **Backlog attivo** | `docs-sviluppo/DOBBIAMO_ANCORA_FARE.md` |
| **Strategia marketing / vendita** | `docs-sviluppo/STRATEGIA_MARKETING_VENDITA_HANDOFF.md` |
| **Billing Stripe v2 (in corso)** | `docs-sviluppo/in-sviluppo/abbonamento/BILLING_V2_HANDOFF.md` |
| **Canary TTS** | `npm run tony:tts-canary`; browser `__tonyTtsCanary()` |

---

## File chiave nel codice

| Ruolo | Path |
|-------|------|
| Widget + comandi | `core/js/tony/main.js` |
| Cloud Function | `functions/index.js` (tonyAsk, buildContextAzienda, getTonyAudio) |
| Consigliere moduli | `functions/tony-module-recommendations.js` |
| Form mapping | `core/config/tony-form-mapping.js` |
| Form injector | `core/js/tony-form-injector.js` |
| Service | `core/services/tony-service.js` |

---

## Regola d'oro

Ogni modifica a Tony deve:
1. Allinearsi al **MASTER_PLAN.md**
2. Favorire scalabilità (configurazione > codice)
3. Non introdurre logica specifica per un solo modulo senza ragione documentata
