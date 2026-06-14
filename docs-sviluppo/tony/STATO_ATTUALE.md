# Stato attuale Tony – Verificato sul codice

**Data**: 2026-06-14 (… **Latenza auto-mode ↓** build `2026-06-14a`; **Terreno** entity parser client + inject coltura/categoria; **tony-service** HTTP callable + SSE abort; **Voce dashboard** build `2026-06-09g`; **Dashboard boot ~861 ms** …)  
**Fonte**: codice + `TONY_DECISIONI_E_REQUISITI.md` (ultima verifica incrociata codice-doc guida: 2026-05-11 per §10 **`TONY/`** in `GUIDA_LOAD_ENTRIES`, **`guida_sintesi_tony`**, regola guida **9** e **`SUBAGENT_TONY_MODULO`**; stessa data per `CONTO_TERZI` / `guida_sintesi_conto_terzi`; briefing dashboard vocalmente solo con modulo `tony` — 2026-05-10; **manodopera validazione ore capo→manager + field workspace slide Valida ore** — 2026-05-19)  
**Sicurezza (link pubblici, Firestore, callable)**: `docs-sviluppo/SICUREZZA_FLUSSI.md`

---

## 1. Riepilogo esecutivo

| Fase | Nome | Stato | Criterio done |
|------|------|-------|---------------|
| **1** | Consolidamento fondamenti | ⏳ Parziale | Tony aggiunge terreno senza guidare passo-passo — **inject atomico + proattivo/save locale** ✅ codice (2026-06-08); canary E2E browser da fare |
| **2** | Navigazione cross-page | ✅ Completata | "Ho trinciato 6 ore" → attivita-modal; "Crea lavoro erpicatura nel Sangiovese" → lavoro-modal (2026-03-08) |
| **3** | Context Builder e dati aziendali | ✅ In corso | summaryScadenze ok; **movimentiRecenti** (ultimi 50) + summary in ctx da qualsiasi pagina; summarySottoScorta opzionale |
| **4** | Iniezione universale | ✅ In corso | Attività, Lavori (entry point da ovunque 2026-03-08), Terreno (OPEN_MODAL+fields), **Nuovo Preventivo** (preventivo-form, 2026-03-24); **Magazzino** prodotto/movimento + save locale + creazione client-side (entrata/uscita/prodotto) + cross-page dashboard (3b-C15…C19, 2026-06-02), prezzo entrata catalogo; **intervista lavoro** ack tipo stem-only E2E ✅ (2026-06-03); **form-trattamento** concimazioni/trattamenti campo (…); … |
| **5** | Grafici e report | ⏳ Parziale | APRI_PAGINA statistiche; MOSTRA_GRAFICO da fare |
| **6** | Proattività e memoria | ⏳ Parziale | Dashboard scorte/scadenze/guasti + briefing meteo + **saluto dashboard anche senza criticità** (2026-06-09g); **RIASSUNTO client** ops+meteo; **meteo vocale dashboard** cache client (0 CF); **latenza auto-mode ↓** costanti mic/TTS build `2026-06-14a`; chat 8 gg + pianificazione trattamento/**lavorazione terreno** + praticabilità morfologia + **doppia alternativa prima/dopo** (2026-05-22, §19); `condizioniMeteo`; pagina `meteo_dashboard`; **boot dashboard ~861 ms** (snapshot + Tony deferred — 2026-06-06); UI soglie tenant praticabilità da fare |

**Performance Tony (track parallelo):** Fase 0–**4** ✅ (rev. 14) — vedi `PLAN_OTTIMIZZAZIONE_PERFORMANCE.md` §9 Fase 4. **4.2** nav/APRI_PAGINA, FILTER_TABLE, RIASSUNTO deterministico CF ✅ deploy + canary browser 2026-06-03. **4.1** invalidazione cache su write (5 trigger Firestore) ✅ deploy. **4.3** multi-blocco meteo+scorte+scadenze ✅ (traffico produzione da crescere). **4.4** offline ore mobile deferred. Produzione (`tony:perf-review`, ~7 gg, 2026-06): **~31%** `usedGemini=false` su stream; ~10 richieste B con quick Fase 4; **~3 navigazioni B** ancora su Gemini (mappa incompleta). **Backlog e handoff:** `HANDOFF_CONTINUITA_PERFORMANCE_NAV.md`. Obiettivi formali −40% / p50 &lt; 1,5 s: pending.

---

## 2. Componenti verificati

| Componente | File | Stato |
|------------|------|-------|
| Tony Service | `core/services/tony-service.js` | ✅ **Modello Gemini (2026-06-03):** `TONY_GEMINI_MODEL` = **`gemini-2.5-flash`** (sostituisce `gemini-2.0-flash` deprecato → 404). ✅ **Fase 3 streaming (2026-05-25):** `askStream` → CF SSE `tonyAskStream` (chunk + done); parsing via `tony-sse-parse.js` + `response.text()`; fallback `ask()` se stream fallisce; `_finalizeCallableResponse` allineato al contratto `{ text, command }`. ✅ **`historyUserMessage`** su ask/askStream: testo utente in `chatHistory` / `tony_last_user_message` separato dal `message` inviato al modello (augment client Gestione Lavori — 2026-04-08); ask salva `tony_last_user_message` in sessionStorage all’inizio del turno utente (2026-03-27, cross-page preventivo); ask, askStream, setContext; blocco ```json → INJECT_FORM_DATA; routing preventivo anche senza `cliente-id` nel payload se pagina/contesto preventivo e chiavi campo coerenti; alias data `attivita-data` / `dataPrevista` / `data_prevista` → `data-prevista` su Nuovo Preventivo (2026-03-24); **`skipUserHistory`** su ask/askStream (turno utente omesso in `chatHistory` per messaggi proattivi); flag **`proactive`** su ask/askStream: non eseguire `SAVE_ACTIVITY` se il prompt è solo la verifica «Form completo, confermi salvataggio?» (2026-04-02); guard magazzino: `SAVE_ACTIVITY` solo se messaggio utente = conferma esplicita salvataggio (2026-04-02); return dopo INJECT callable |
| Cloud Function **sendTransactionalEmail** | `functions/index.js` + `functions/email-resend.js` | ✅ Invio **inviti** e **preventivi** via **Resend** (mittente `no-reply@globalfarmview.net`), auth + ruolo manager/admin sul tenant; segreto `RESEND_API_KEY`; client `preventivi-standalone` / `gestisci-utenti-standalone` (2026-04-10). **Link registrazione negli inviti**: `APP_BASE_URL` in `gestisci-utenti-standalone` → GitHub Pages finché l’ERP non è su `globalfarmview.net` (solo landing lì). |
| Cloud Function tonyAsk | `functions/index.js` | ✅ **Modello Gemini (2026-06-03):** `gemini-2.5-flash`. ✅ **Fase 4 (2026-06-03):** `tryTonyNavQuickReply`, `tryTonyFilterTableQuickReply`, `tryTonyMultiBlockQuickReply` prima di pattern attività/Gemini; log `quickReplyHit` nav/filter_table/riassunto_*/multi_block. ✅ **Fase 3 streaming (2026-05-25):** `handleTonyAskRequest` + `tonyAskStream`; pattern attività; Treasure Map. ✅ Preventivo / tier 2b / meteo / module gate. ✅ **Performance Fase 0–1:** cache Firestore + quick reply A + `PREVENTIVO_LIST_ACTION`. Pipeline: router → build tier → quick A → **nav → filter → multi-blocco** → pattern attività → lavoro entity → meteo → Gemini |
| Cloud Function tonyAskStream | `functions/tony-ask-stream.js` | ✅ **Fase 3 (2026-05-25):** SSE `POST` + Bearer token; delega a `handleTonyAskRequest` con `stream: true`. ✅ **Fix modello + env (2026-06-03):** `gemini-2.5-flash` — risolve 404 su navigazione/chat; **`GEMINI_API_KEY`** e opz. **`GEMINI_MODEL`** su revisione Cloud Run **`tonyaskstream`**. Canary crea lavoro — `streamUsed=true`, ttfc ~5 s, form lavoro iniettato. |
| Parser SSE client | `core/services/tony-sse-parse.js` | ✅ **2026-05-25:** `parseTonySseStream` — eventi `chunk`/`done`/`error`; usato da `tony-service._callTonyAskStream` con `response.text()`. |
| Intent router + tier (Fase 2a→2b) | `functions/tony-intent-router.js`, `functions/tony-context-tier.js` | ✅ Classifica A/B/C + `tierCalculated`/`tierUsed`; fetch tier-aware; meteo operativo → binario A; conservativo T4 su crea lavoro/ambiguo. **Produzione (2026-05-24):** 62/80 log `[Tony Perf]` con `routerTierUsed` ≠ `T4_full`. Test: `tests/tony-intent-router.test.js`, `tests/tony-context-tier.test.js` |
| Context cache tier-aware | `functions/tony-context-cache.js` | ✅ Hit T4 Firestore → `sliceContextAziendaToTier`; write solo build T4. ✅ **Fase 4.1 (2026-06-03):** `invalidateTonyContextCache`; trigger write su prodotti/movimentiMagazzino/preventivi/tariffe/guasti. **Produzione:** cacheHit ~48–50% (post-invalidazione più `cache=false` attesi) |
| **Nav / filter quick reply (Fase 4)** | `functions/tony-nav-quick-reply.js`, `functions/tony-filter-table-quick-reply.js` | ✅ Binario B: APRI_PAGINA, RIASSUNTO, FILTER_TABLE ovvio, SUM_COLUMN aggregati; gate moduli; fallback Gemini se ambiguo. **~19 target** in `NAV_TARGET_RULES`; gap noti: manodopera, oliveto, ~3 frasi B da log. **Estensione:** `HANDOFF_CONTINUITA_PERFORMANCE_NAV.md` §Priorità 1. Test: `tests/tony-nav-quick-reply.test.js` (5), `tests/tony-filter-table-quick-reply.test.js` (4) |
| **Multi-blocco quick reply (Fase 4)** | `functions/tony-multi-block-quick-reply.js` | ✅ Meteo + scorte + scadenze concatenati se tutti i blocchi ok. Test: `tests/tony-multi-block-quick-reply.test.js` (2) |
| Review performance Tony | `scripts/tony-perf-log-review.mjs` | ✅ Smoke 8 scenari router + **3 scenari binario B quick** + log produzione. **`npm run tony:perf-review`** |
| **Crea lavoro — entity-first (Fase 3b)** | `functions/tony-lavoro-entity-parser.js`, hook `functions/index.js`, patch `core/js/tony-form-injector.js`, gating `core/js/tony/main.js` | ✅ **2026-05-25:** canary browser **3b-C1 PASS** (13 campi, durata=1, luca autonomo, data mercoledì, SSE ~1,8 s); **disambiguazione trattore E2E PASS** (`agrifull`, `t5`) — intercept client-side, alias corti, conferma salvataggio locale, no CF su risposta macchine. Sottocategoria **Tra le File** da coltura terreno (no domanda Tony). Parser `durata 1` breve; inject patchOnly + retry mezzi. **Perf inject client:** `lavori-form-data-ready` + `loadLavori` differito → inject ~**6,8 s** (da ~10–15 s); gate post-nav 350 ms. Test: `tests/tony-lavoro-entity-parser.test.js` (12), `tests/tony-lavoro-trattore-disamb.test.js` (3). |
| Module gate Tony | `functions/tony-module-gate.js`, `core/config/tony-module-gate.js` | ✅ Filtro `ctx.azienda`; gate quick reply; sanitizzazione `APRI_PAGINA` CF + client; briefing dashboard condizionale. Test: `tests/tony-module-gate.test.js` |
| Quick reply Tony (binario A) | `functions/tony-quick-replies.js` | ✅ `QUICK_REPLY_MAP`; `isTonyOperationalCreationIntent` / `shouldSkipQuickReply` (skip crea lavoro/preventivo → Gemini; typo **preventio**, «dobbiamo trinciare» — 2026-05-24); `isTonyPreventivoFormFieldCorrection`. Test: `tests/tony-quick-reply.test.js` (13) |
| Form Mapping | `core/config/tony-form-mapping.js` | ✅ ATTIVITA, LAVORO, TERRENO, **PREVENTIVO** (preventivo-form / system instruction structured), **PRODOTTO / MOVIMENTO** magazzino (`prodotto-form`, `movimento-form`, 2026-04-02); **`zona-form`** traccia segmento (`ZONA_SEGMENTO_FORM_MAP`, 2026-04-18); **`ora-form`** segna ore (`SEGNA_ORE_FORM_MAP`) + **`field-workspace-ore-form`** inline mobile (2026-04-18); **`tonyInterviewFieldIds`** per domande oltre i required HTML (2026-04-02); **prodotto**: `prodottoCategoriaRichiedeGiorniCarenza` + `prodottoCategoriaRichiedeDosaggio`; HTML required `prodotto-form-required.js` (2026-06-02); **policy `LAVORAZIONI_DEFAULTS_TONY`** per default meccanico/campi macchina/copertura da terreno (2026-04-08) |
| Nuovo Preventivo (tariffe) | `modules/conto-terzi/views/nuovo-preventivo-standalone.html` | ✅ `calcolaTotale`: match tipo lavoro tollerante (strip **meccanico**, prefisso + tipo tariffa più lungo) oltre a coltura/tipo campo/categoria generica (2026-03-27) |
| Form Injector | `core/js/tony-form-injector.js` | ✅ attivita-form, lavoro-form, **preventivo-form** (`waitForPreventivoPageDataReady`, ordine **cliente → terreno → lavorazione**, disambiguazione terreno con candidati, filari da coltura — 2026-05-24); lavoro-form: ordine terreno→cat→sottocat→tipo; **policy lavorazioni 2026-04-08**: default meccanico, **copertura forzata da coltura terreno** (seminativo=Generale, filari=Tra le File/Sulla Fila — **no disambiguazione chat** su sottocategoria/tipo se terreno valorizzato); auto-selezione trattore/attrezzo solo candidato univoco; **disambiguazione macchine 2026-04-08**: evento `tony-macchine-disambiguation`, filtro CV; **2026-05-25 — risposta utente client-side (trattore):** `applyLavoroMacchineFromUserReply`, `findTrattoreInUserText` (alias `t5`), candidati in `__tonyMacchineDisambTrattoriCandidati`, guard `shouldSkipMacchineDisambiguationReask`, select `in_uso` abilitata temporaneamente; **2026-05-26 — attrezzo multiplo:** `findAttrezzoInUserText`, `buildAttrezzoDisambiguationPayload`, `__tonyMacchineDisambAttrezziCandidati`, `resolveAttrezzoAfterTrattoreKnown`, **`attrezziCompatibiliConTrattoreCv`**; **ordine disamb.:** attrezzo da tipo solo dopo trattore (salvo attrezzo già nel messaggio); `shouldAskAttrezzoDisambigFromTipo`; **2026-05-26 — intervista lavoro client-side:** `buildLavoroInterviewPatch`, `applyLavoroInterviewFromUserReply`, `promptLavoroInterviewMissing`; **2026-05-30 — turn unificato:** `applyLavoroCreationTurn`, `autoFillLavoroNomeIfMissing`, priorità macchine in creation flow, reset sessione all'apertura modal; **disamb. tipo lavoro intervista:** elenco candidati stile macchine (`offerTipoLavoroDisambIfNeeded`, stem-only no auto-pick, follow-up `produzione`/`manuale`); **2 livelli manuale/meccanica** (`parseTipoModoFromText`, `LAVORAZIONI_DEFAULTS_TONY.manualMechChoiceStems` / `manualMechSkipStems`); **squadra:** caposquadra solo su `caposquadraList` + disamb. omonimi; **hint messaggio iniziale:** `stripLavoroCreationIntentPrefix` («crea lavoro per gaia»), `waitForLavoriManodoperaReady`; **2026-05-31 — operaio ambiguo + assign autonomo + gate macchine:** `__tonyLavoroConfirmedAssignMode`, `getConfirmedLavoroInterviewAssignMode`, disamb. persona (`lavoroInterviewPersonDisambPending`, priorità su `__tonyLavoroPendingTipoHint` via `lavoroInterviewCanApplyPendingTipoHint`); cross-page `sanitizeAmbiguousLavoroInterviewFields` + `tony_pending_lavoro_local_intent`; `inferRequiresMachineFromTipo` ← `classifyTipoLavoroModo` + `__tonyLavoroTipoModo`; M/M solo se `lavoroTipoStemNeedsManualMechChoice` (`hasMan && hasMech`); **2026-06-03 — ack stem-only:** `buildLavoroTipoStemOnlyAckMessage`, `prependLavoroTipoStemOnlyAck`; test `tony-lavoro-interview-client.test.js` (**37**); canary **3b-C13** PASS; ack E2E browser PASS (Larghetta → trinciare → save); **magazzino** `injectProdottoForm` / `injectMovimentoForm`; **`injectZonaSegmentoForm`**, **`injectSegnaOraForm`**, **`form-trattamento`** (checkbox — 2026-04-09) |
| Smart Form Filler | `core/js/tony-smart-filler.js` | ✅ deriveCategoriaFromTipo, sottocategoria; **`validateBeforeSave`**: risoluzione submit preferendo `button[type="submit"]` nel form (evita `.btn-primary` tipo «Traccia» prima del Salva su form-trattamento — 2026-04-11) |
| Voice / TTS | `core/js/tony/voice.js`, `functions/index.js` → **`getTonyAudio`** | ✅ `expandSpokenUnitsForItalianTTS`; **`normalizeTemperaturesForItalianTTS`** (fix «1929 gradi» en-dash — 2026-06-09f); **`prefetchTonyTTS`** warm cache MP3; **`clearTonyAudioPipeline`** + **`__tonyGeneration`** (Fase 1 barge-in — 2026-06-07); **mic off durante TTS** + no barge-in eco auto-mode (2026-06-09e); **`stream-tts-chunk.js`** + hook `main.js` Fase 2 SSE (2026-06-09); **`main.js`** riapertura mic `scheduleReopenMicIfIdle`, addio/chiusura locale (2026-06-09g); test `tony-stream-tts-chunk.test.js`, `tony-voice-pipeline-canary.test.js` |
| **Meteo dashboard quick reply (voce)** | `core/js/tony/meteo-dashboard-quick-reply.js`, `meteo-dashboard-quick-reply-utils.js` | ✅ Domande meteo su **dashboard** → risposta da **cache client** (`fetchMeteoTerreniCached`), 0 CF; **`tonyWantsDashboardRiassunto`**, **`buildDashboardRiassuntoText`** (ops + meteo); test `tony-meteo-dashboard-quick-reply.test.js` (7) — 2026-06-09 |
| **Briefing meteo dashboard** | `core/js/dashboard-meteo-briefing.js`, `dashboard-standalone.html` (`checkGlobalStatus`) | ✅ Consigli pioggia + **`weatherSummary`** (oggi/domani sede) in `tonyGlobalBriefing`; saluto proattivo anche se `total===0` criticità ops; voce solo Tony Avanzato + manager/admin — 2026-06-09g |
| Profilo campo (operaio / caposquadra) | `core/js/tony/field-role-guard.js`, `functions/index.js` (tonyAsk `tonyFieldProfile`), `core/mobile/field-workspace-standalone.html` + `field-workspace-controller.js`, `Tony.initContextWithModules(..., { utente_corrente })` su pagine manodopera | ✅ Cloud: senza `buildContextAzienda` se ruoli solo campo; prompt `SYSTEM_INSTRUCTION_TONY_FIELD` (**segna ore «ieri/oggi» / turno** esplicitamente in ambito — 2026-05-06; comandi canone **INJECT_FORM_DATA** / **QUICK_SAVE**, vietato INJECT/SUBMIT — 2026-06-04). Client: whitelist `APRI_PAGINA` / blocco `OPEN_MODAL` ERP; ruoli obbligatori nel contesto (o sessionStorage `gfv_tony_utente_ruoli`) così guard e CF riconoscono il profilo — 2026-04-17. **Workspace capo (2026-05-19):** slide **Valida ore** (tutti i lavori squadra, approva/rifiuta); comunicazioni squadra operaio/capo; ore proprie capo → manager (non in lista validazione capo). **Segna ore inline (2026-06-04):** intervista locale 0 CF (orari elastici, pausa, «ok»/«sì»/«salva»); submit reale `#quick-hours-form` → Firestore → validazione manager (E2E **3b-C21** ✅); display ore nette `formatOreNette` |
| **Validazione ore Manodopera** | `manodopera-ore-validazione-scope.js`, `validazione-ore-standalone.html`, `dashboard-data.js` (`countOreDaValidareManager`, `countOreDaValidareFromLavoriDocs`), `comunicazioni-squadra-utils.js` (nomi) | ✅ Manager: lavori autonomi + ore caposquadra su squadra; capo: solo operai; nomi capo in tabella Validazione ore (preload caposquadra + fallback `users`) — 2026-05-19; **dashboard:** conteggio ore parallel + defer path critico (2026-06-06) |
| **Dashboard panoramica** (manager/admin) | sidebar, hub, **barra I miei accessi** (5 slot `dashboard-quick-bar`), scadenze, **`dashboard-counts-snapshot.js`**, **`dashboard-perf.js`**, **`dashboard-login-prefetch.js`** | ✅ … **Performance boot (2026-06-06):** … Tony deferred … **Fase 5 (2026-06-06):** quick bar shell sync; meteo SWR localStorage; prefetch login → sessionStorage; perf off prod; invalidazione cache su `switchTenant`; smoke `npm run dashboard:perf-smoke`. Piano: `docs-sviluppo/dashboard/PLAN_PERFORMANCE_DASHBOARD.md` **Fasi 0–5 ✅** |
| Widget | `core/js/tony/main.js` + **`core/js/tony-form-save-local.js`** + **`core/js/tony-movimento-create-local.js`** + **`core/js/movimento-prezzo-catalogo.js`** | ✅ **Save locale form (2026-05-31–06-02):** modulo config `TONY_FORM_SAVE_LOCAL_CONFIG` — lavoro + **preventivo** + **magazzino** (`prodotto-form`, `movimento-form`); **`tryInterceptMagazzinoSaveBeforeCf`** + **`magazzinoProactiveReadyForSave`** (movimento: solo required HTML); **`tryInterceptMovimentoCreateBeforeCf`** (creazione movimento senza CF falso «Movimento registrato!»); **prezzo entrata da catalogo** (`applyMovPrezzoCatalogoToDom`, suggest DOM su `movimenti-standalone.html`); timer post-inject magazzino **800 ms**; canary **3b-C14/C15/C16** ✅ E2E browser (C16: creazione locale + prezzo anagrafica + save locale **2026-06-02**). ✅ **Gestione Lavori — intervista + macchine client-side (2026-05-26, fix 2026-05-30):** intercept risposte brevi intervista (`larghetta`, `gaia`, `mercoledì`, `erpicatura`) e macchine (`agrifull`, `t5`, `erpice 200`) **prima di `tonyAsk`**; creation flow usa **`applyLavoroCreationTurn`** (un solo handler); `tonyEnsureLavoroModalForInterview` **attende** `openCreaModal()` async + `waitForLavoriManodoperaReady` sul primo turno; domanda proattiva locale `promptLavoroInterviewMissing` al posto del round CF quando possibile; **`__tonyPromptLavoroSaveLocal`** + conferma «sì/salva» → `SAVE_ACTIVITY` locale (**intercept salva prima** del turno intervista); guard proattivo 120 s post-disamb solo in fase macchine; fallback messaggio locale field-aware se risposta non riconosciuta (no CF). ✅ **Gestione Lavori — disamb. trattore/attrezzo (2026-05-25–26):** (vedi sopra). ✅ **Preventivo Conto Terzi (2026-05-24):** `tonyStripConflictingPreventivoLavorazione` blocca downgrade sottocategoria Generale vs Tra le File; `PREVENTIVO_TERRENO_HINT_STOP` + `userMessageIsPreventivoScheduleHint` — messaggi data/scheduling («mercoledì», «ok allora facciamo martedì») non trattati come hint terreno; skip disambiguazione se terreno già selezionato o inject date-only; post-nav enrich skip se form già compilato. ✅ **Domande duplicate post-inject (2026-05-23):** skip timer proattivo missing-fields se la risposta CF chiede già all’utente. ✅ **Moduli tenant (2026-05-23):** `tony-module-gate.js` — `APRI_PAGINA` bloccato se target appartiene a modulo non in `moduli_attivi`; briefing RIASSUNTO rispetta magazzino/parco macchine. Piano **free**: `applyTonyFreemiumGate` / `__tonyFreemiumBlocked`; comandi operativi e **APRI_PAGINA** solo con modulo **`tony`** (nessun bypass navigazione); pending dopo nav senza modulo annullato. **`checkTonyModuleStatus`**: se `dashboard.moduli_attivi` è già un array (anche vuoto), niente ripetuta discovery/setContext (evita spam console — 2026-05-10). **`QUICK_FORM_FILL`** → inject quick-hours; submit bloccato se pausa 0 senza cenno in chat (2026-04-18); comandi CF **`QUICK_SAVE`** / **`SET_VALUE`** + recovery **solo pausa** + **`cleanTextFromJsonResidue`** senza leak `"commands"`; ✅ **Segna ore workspace (2026-06-04):** `normalizeTonyCommand` alias **INJECT/SUBMIT** → **INJECT_FORM_DATA/QUICK_SAVE**; post-process CF `tony-field-workspace-command.js`; **intervista 100% locale 0 CF** (`tryInterceptSegnaOreIntentBeforeCf`, singolo orario, fascia, pausa); **`tryInterceptQuickHoursSaveBeforeCf`** («ok»/«sì»/«salva»); **`tonySalvaQuickHoursWorkspace`** submit reale + ack pausa da turni chat / `__tonyQuickHoursPauseAckAt`; **`quickHoursDomReadyForTonySave`**; display ore nette `formatOreNette` in `field-workspace-controller.js`; canary **3b-C21** E2E + validazione manager ✅; **SAVE_ACTIVITY** + `modal-trattamento`: solo `tonyCheckFormCompletenessSafe` + submit `#form-trattamento` (2026-04-11); processTonyCommand, OPEN_MODAL, SET_FIELD, INJECT_FORM_DATA (normalizza `fields` / `fieldValues` → `formData` — 2026-04-02); **`window.__tonyGetCurrentFormContext`** per timer proattivi da `processTonyCommand` (scope); contesto **`field-workspace-ore-form`** da `#quick-hours-form` + `#selected-work` (finestra parent se iframe — 2026-04-18); **`__tonyScheduleQuickHoursProactiveAfterInject`** post-inject segna ore workspace; OPEN_MODAL magazzino senza `fields` → timer come post-inject (2026-04-02); **OPEN_MODAL `attivita-modal` assente + profilo campo + manodopera** → `APRI_PAGINA` **segnatura ore** + pending **ora-modal** + mapping campi (2026-04-18); **pending dopo nav** **ora-modal**: `openSegnaOraModal` + INJECT **ora-form** (2026-04-18); **OPEN_MODAL `attivita-modal` / `lavoro-modal` assenti dal DOM + `fields` preventivo** → `APRI_PAGINA` Nuovo Preventivo (non Diario / non Gestione Lavori — 2026-03-27); **OPEN_MODAL `attivita-modal` ignorato se `#modal-trattamento` attivo** (2026-04-09); helper distingue `lavoro-categoria-principale`/`lavoro-sottocategoria` (preventivo) da altri `lavoro-*` (modal lavori); **onAction INJECT preventivo**: coda con `delayMs: 0` se `#preventivo-form` già nel DOM (2026-03-24); coerce INJECT attivita→preventivo se opportuno; **coerce INJECT attivita→preventivo anche cross-page (prima del controllo DOM)** per avviare APRI_PAGINA + pending intent quando il form non è presente (2026-03-26); alias data → `data-prevista` su `#preventivo-form`; **SAVE_ACTIVITY** su `#preventivo-form`: validazione `checkFormCompleteness` + submit (non SmartFormFiller/modal); **pending dopo nav** preventivo (path tolleranti + polling); **APRI_PAGINA**: inferenza `preventivo-form` da target **anche senza** `fields` / `_tonyPendingModal` (cross-page CF solo navigazione — 2026-03-27); stesso salvataggio in `processTonyCommand` APRI_PAGINA; **onComplete** passa `_tonyPendingModal` / `_tonyPendingFields` se presenti; **APRI_PAGINA** + `fields` → inferenza `_tonyPendingModal` nuovo preventivo; OPEN_MODAL alias `preventivo`; **skipUserHistory** su ask proattivo (2026-03-24); **timer proattivo preventivo**: messaggio mirato se manca `data-prevista` (2026-03-24); **dopo inject preventivo senza `terreno-id`**: messaggio disambiguazione **breve** («Dobbiamo lavorare su A o B?» fino a 5 terreni) + **TTS** via `Tony.speak`; elenco **filtrato** da hint (ultimo messaggio utente + campi testuali formData; fallback elenco completo se nessun match); ramo `__tonyPreventivoTerrenoDisambiguation` allineato (2026-03-27); **`tonyStripConflictingPreventivoLavorazione`** + **`tonyIsPreventivoTipoLavoroUnset`**: strip solo se `#tipo-lavoro` ha value reale (non placeholder `-- Seleziona…`); post-nav enrich usa anche `tonyGetUserPromptForPendingNav()` se intent/sessionStorage senza prompt (2026-03-27); getCurrentFormContext; fallback contesto da `#modal-trattamento` / `#form-trattamento` (2026-04-09); `buildTonyFormContext` campi id `trattamento-*` in rilevanza (2026-04-09); `__tonyBuildTonyFormContext`; muto timer durante INJECT; pending nav preventivo (2026-03-24); **FILTER_TABLE** prodotti/movimenti + path `pageType`; dispatch `change` su `#filter-categoria` per prodotti (non escluso come per terreni — 2026-04-02); **OPEN_MODAL / INJECT / pending** `prodotto-modal` · `movimento-modal` / `prodotto-form` · `movimento-form` (2026-04-02); **post-inject proattivo** `prodotto-form` / `movimento-form` (merge contesto come attività, `POST_INJECT_CHECK_DELAY_MS` + `IDLE_REMINDER_MS`, conferma salvataggio o campi mancanti); **post-inject `form-trattamento`**: timer proattivo disattivato (2026-04-11, evitare secondo round CF durante domanda anagrafe/scarico); **post-SET_FIELD** debounce proattivo magazzino (`prodotto-` / `mov-`) + messaggio salvataggio coerente (path prodotti/movimenti, `onComplete` — 2026-04-02); **fallback onComplete → SAVE_ACTIVITY** anche per magazzino se testo «salvato» e required ok (2026-04-02); **listener `tony-macchine-disambiguation`** (2026-04-08): elenco trattori/attrezzi → messaggio chat + TTS; **Gestione Lavori (2026-04-08)**: `tonyUserMentionedLavoroAssignee`, `tonySanitizeLavoroOperaioQuestionInReply`, timer proattivo lavoro con skip se assegnatario o macchine già nel messaggio utente |

---

## 3. Context Builder (ctx.azienda)

| Dato | Stato |
|------|-------|
| terreni, terreniClienti, clienti, preventivi, **tariffe** (id, tipoLavoro, coltura, categoriaColturaId, tipoCampo, tariffaBase, coefficiente, attiva – "quante tariffe?", "quanto costa X nel Y in Z?"; fallback coltura non in lista → tariffa generica categoria – 2026-03-18), poderi, colture (nome, categoriaId), categorie, tipiLavoro | ✅ |
| macchine, trattori, attrezzi (cavalli, cavalliMinimiRichiesti) | ✅ |
| prodotti (giacenza, sogliaMinima) | ✅ |
| **movimentiRecenti**, **summaryMovimentiRecenti** (collection `movimentiMagazzino`, max 50 per `data` desc; nomi prodotto da anagrafica) | ✅ 2026-04-02 |
| guastiAperti | ✅ |
| summaryScadenze | ✅ Testo con date in italiano (affitti + dettaglio revisione/assicurazione mezzi — 2026-04-11) |
| summarySottoScorta | ✅ Calcolato in `buildContextAzienda` + `prodottiSottoScorta` (2026-04-11); lettura prodotti con campo Firestore **scortaMinima** (prima era richiesto solo `sogliaMinima`, mai popolato) |
| **meteo** | ✅ Chat operativa: quick reply trattamento + **lavorazione terreno** (`trinciare`, `erpicare`, …). ✅ **`resolveMeteoModuleActive`**: modulo riconosciuto da Firestore **o** `moduli_attivi` contesto client. ✅ Praticabilità × morfologia + asciugatura + doppia alternativa (§19). ✅ **Priorità intent:** crea lavoro/preventivo **non** intercettato da meteo (`isTonyOperationalCreationIntent`). ✅ **Typo giorno (2026-06-10):** `mercoldì` ecc. riconosciuti anche in `isTonyMeteoOperationalQuestion` (`fixWeekdayTyposInMsg`). ✅ **Data su preventivo-form (2026-05-24):** `tryMeteoPreventivoDateQuickReply` — messaggio solo data con `tipo-lavoro` compilato → valutazione meteo (morfologia terreno da archivio se assente nel form); se sconsigliato → alternative senza inject data; «ok/allora facciamo martedì» → Gemini imposta data. Meteo operativo generico richiede giorno/data nel messaggio. Test: `tests/meteo-tony-quick-reply.test.js` (47, ancorati `2026-05-21` con fake timers) |

---

## 4. Comandi gestiti

| Comando | Stato |
|---------|-------|
| APRI_PAGINA | ✅ |
| OPEN_MODAL (attivita-modal, lavoro-modal, terreno-modal, **ora-modal** (segna ore — init `openSegnaOraModal` + inject da fields — 2026-04-18), **prodotto-modal**, **movimento-modal**, **preventivo-form** → pagina / inject) | ✅ |
| SET_FIELD | ✅ (SmartFormFiller, fallback navigazione se modal assente; prefissi **prodotto-** / **mov-** → modal magazzino – 2026-04-02) |
| INJECT_FORM_DATA | ✅ attivita-form, lavoro-form, **preventivo-form**, **terreno-form** (`injectTerrenoForm`, gerarchia coltura, affitto — 2026-06-08), **prodotto-form**, **movimento-form** (2026-04-02), **form-trattamento** (checkbox opzionali — 2026-04-09), **zona-form** (traccia segmento, modal aperto — 2026-04-18), **ora-form** (segna ore, modal aperto — 2026-04-18) |
| SAVE_ACTIVITY | ✅ (saveGuard, fallback) |
| CLICK_BUTTON | ✅ |
| FILTER_TABLE | ✅ terreni, attivita, lavori (stato, progresso, caposquadra, terreno, tipo, tipoLavoro, operaio), **`lavori_caposquadra`** (lista campo operaio/caposquadra: stato, terreno, tipoLavoro, progresso, ricerca, reset — handler pagina — 2026-04-18), **`segnatura_ore`** (statoValidazione, statoLavoro, lavoro, ricerca, reset — 2026-04-18), **field_workspace** (log se senza handler; contesto da items — 2026-04-18), **clienti** (stato, ricerca testuale, reset), **preventivi** (stato, cliente, categoriaLavoro, tipoLavoro, categoriaColtura, ricerca, reset), **terreniClienti** (cliente, reset – 2026-03-23), **tariffe** (tipoLavoro, coltura, tipoCampo, attiva, reset – 2026-03-18), **prodotti** (attivo, categoria con normalizzazione sinonimi es. concime→fertilizzanti, ricerca, reset – 2026-04-02), **movimenti** (tipo, prodotto, reset – 2026-04-02), **concimazioni_vigneto** / **concimazioni_frutteto** (vigneto o frutteto, anno, reset – 2026-04-07), **tracciabilita_consumi** (categoria, **terreno**, vista, reset – 2026-04-07) |
| **PREVENTIVO_LIST_ACTION** | ✅ **invia** (email da lista) / **accetta_manager** — `preventivi-standalone.html` + CF risoluzione + disambiguazione tipo lavoro / numero (2026-04-02) |
| SUM_COLUMN | ✅ terreni |
| RIASSUNTO (tonyGlobalBriefing) | ✅ Client `main.js`: **`buildDashboardRiassuntoText`** (scorte/scadenze/guasti + meteo oggi/domani + alert); CF binario B invariato; «sì/ok» solo dopo offerta briefing proattivo — 2026-06-09g |
| MOSTRA_GRAFICO | ❌ Da fare |

---

## 5. currentTableData

| Pagina | pageType | Stato |
|--------|----------|-------|
| terreni | terreni | ✅ |
| attivita | attivita | ✅ `data` + **`dataItaliana`**; sanitizer Tony usa testo leggibile (2026-04-11) |
| gestione lavori | lavori | ✅ **`dataInizio` / `dataInizioItaliana`**; sanitizer dedicato `pageType` lavori (2026-04-11) |
| macchine | macchine | ✅ |
| prodotti | prodotti | ✅ (items con **id**, unitaMisura in contesto; canone merge + evento — 2026-04-02) |
| movimenti | movimenti | ✅ (merge `setContext('page')` come canone — 2026-04-02) |
| trattori, attrezzi, flotta, scadenze, guasti | trattori, attrezzi, flotta, scadenze, guasti | ✅ |
| **clienti** (Conto terzi) | **clienti** | ✅ (clienti-standalone.html renderClienti; 2026-03-18) |
| **preventivi** (Conto terzi) | **preventivi** | ✅ (preventivi-standalone.html renderPreventivi; items con **id, tipoLavoro, coltura**; 2026-04-02) |
| **tariffe** (Conto terzi) | **tariffe** | ✅ (tariffe-standalone.html renderTariffe; 2026-03-18) |
| **terreni clienti** (Conto terzi) | **terreniClienti** | ✅ (terreni-clienti-standalone.html renderTerreni; 2026-03-23) |
| **concimazioni vigneto** | **concimazioni_vigneto** | ✅ (concimazioni-standalone.html vigneto; summary + items dopo loadTrattamenti; merge setContext + table-data-ready; log init Tony `[Concimazioni vigneto]` — 2026-04-11) |
| **concimazioni frutteto** | **concimazioni_frutteto** | ✅ (concimazioni-standalone.html frutteto; stesso canone; log init Tony `[Concimazioni frutteto]` — 2026-04-11) |
| **tracciabilità consumi** | **tracciabilita_consumi** | ✅ (filtro terreno + items; **consumiAggregates** pre-sommati fertilizzanti/fitofarmaci per terreno+prodotto; CF: text con cifre obbligatorio su domande quantità, anche con FILTER_TABLE stesso turno; 2026-04-07) |
| **gestione vendemmia** | **vendemmia** | ✅ (`syncTonyTableDataVendemmia`: **vendemmiaAggregates** totale q.li per varietà + summary; sanitizer dedicato in `tony-service.js`; FILTER_TABLE in main.js; CF somma q.li — 2026-04-11) |
| **I miei lavori** (operaio / caposquadra) | **lavori_caposquadra** | ✅ (`lavori-caposquadra-standalone.html`: items sintetici + `fieldRole`; `FILTER_TABLE` client; merge + `table-data-ready` — 2026-04-18) |
| **Segna ore** | **segnatura_ore** | ✅ (`segnatura-ore-standalone.html`: `items` = ore, `lavoriItems` = lavori; filtri; merge + evento; modal **ora-form** / inject Tony — 2026-04-18) |
| **Workspace mobile campo** | **field_workspace** | ✅ (liste + «quali lavori» locale; **segna ore Tony** intervista + save locale 0 CF — **E2E operaio e caposquadra** ✅ 2026-06-04; **`ora-lavoro`** da nome; blob **ultimi 6 turni**; display `formatOreNette`; slide **Valida ore** capo + `?openSlide=valida-ore` — 2026-05-19) |
| **Modulo Meteo** | **meteo_dashboard** | ✅ (`meteo-dashboard-controller.js`: items campi + **`sede.previsioniGiornaliere`**; **`previsioniGiornaliere`** per terreno (pop/vento/temp); merge + `table-data-ready`; Tony chat legge stesso payload via Context Builder — 2026-05-21) |

---

## 6. Modello abbonamento

| Piano | Tony | Stato |
|-------|------|-------|
| Free | Completamente assente (desiderato) | ❌ Non implementato – widget sempre caricato |
| Base (senza modulo tony) | Tony Guida – solo spiegazioni | ✅ SYSTEM_INSTRUCTION_BASE |
| Modulo Tony attivo | Tony Operativo – tutte le funzioni | ✅ SYSTEM_INSTRUCTION_ADVANCED |

---

## 7. Da fare (priorità)

| Voce | Priorità | Note |
|------|----------|------|
| **Handoff — estensione nav binario B** | Media | ~3 messaggi da log + gap mappa (`manodopera`, `oliveto`, sinonimi). Guida: **`HANDOFF_CONTINUITA_PERFORMANCE_NAV.md`** §Priorità 1. `npm run tony:perf-review` |
| **Handoff — metriche client `tony_local_intercept`** | Media | Contare intercept 0 CF (ore, lavori, save). Guida: **`HANDOFF_CONTINUITA_PERFORMANCE_NAV.md`** §Priorità 2 |
| **Handoff — voce Chirp 3 HD** | Bassa (opz.) | `getTonyAudio` + env `TONY_TTS_VOICE`; candidato `it-IT-Chirp3-HD-Charon`. Guida: **`HANDOFF_TTS_CHIRP3.md`** |
| **Deploy CF meteo typo `mercoldì`** | Media | Fix in `meteo-service.js` (2026-06-10) — deploy functions se non in prod |
| **Pattern disamb. client-side — estensioni lavoro** | — | **Completato (2026-06-03):** trattore + attrezzo + intervista campi + tipo 2 livelli + operaio + terreno ambiguo + assign autonomo + **ack tipo stem-only** + save locale; canary **3b-C13** E2E PASS; ack E2E **PASS** (Larghetta → «dobbiamo trinciare» → Luca/fabbri → save, 0 CF follow-up). **Escluso:** sottocategoria/tipo lavoro — deterministica da coltura terreno. Vedi §14.4–§14.7 `TONY_DECISIONI_E_REQUISITI.md` |
| summarySottoScorta in ctx.azienda | — | Implementato (2026-04-11); deploy `functions` necessario |
| Tony assente in freemium | Bassa | Se si vuole nascondere widget in plan free |
| segnala-guasto-form, macchina-form INJECT | Bassa | Subagent Meccanico |
| MOSTRA_GRAFICO | Bassa | |
| Proattività "Ho notato X, vuoi che...?" | Media | Fase 6 |
| Memoria storica (confronti anno/anno) | Bassa | |
| Flusso campioni GPS (mappa multipunto raccolta/profilazione) | Media | Mini-spec definita in `TONY_DECISIONI_E_REQUISITI.md` §18; implementazione rimandata a fase 2 dedicata |

---

## 8. Handoff per agenti (continuità sviluppo)

Documenti creati per riprendere il lavoro **senza perdere contesto** (prompt, backlog, file, comandi):

| Documento | Quando usarlo |
|-----------|----------------|
| **`HANDOFF_CONTINUITA_PERFORMANCE_NAV.md`** | Performance Tony, nav quick reply, metriche client, `tony:perf-review`, fix meteo test |
| **`HANDOFF_TTS_CHIRP3.md`** | Cambio voce Wavenet → Chirp 3 HD (o Neural2), `getTonyAudio`, cache `voice.js` |
| `PIANO_AUDIO_PIPELINE_BARGEIN.md` | Barge-in, generation token, chunking TTS Fase 2 |
| `PLAN_OTTIMIZZAZIONE_PERFORMANCE.md` | Piano formale Fase 0–4, obiettivi −40% / p50 |

Indice: `docs-sviluppo/tony/README.md`.

---

## 9. Regole operative

- Ogni modifica Tony deve allinearsi al **MASTER_PLAN.md**
- Non toccare Tony Guida durante lavori su Operativo
- Non introdurre logica hardcoded per singolo modal
- Nuovo form = voce in TONY_FORM_MAPPING, non if/else
- **Deploy PWA (produzione)**: con hook Git attivo (`npm run setup:hooks`), ogni **commit** rigenera **`SW_CACHE_BUILD_ID`** in `service-worker.js` (nome cache `gfv-platform-{id}`); altrimenti `npm run bump:pwa-cache` prima del deploy. Dettaglio in **`docs-sviluppo/GUIDA_PWA.md`** e **TONY_DECISIONI_E_REQUISITI.md** §3.8
- **Deploy Cloud Functions Tony**: dopo cambio modello Gemini, ridistribuire **`tonyAsk`** e **`tonyAskStream`**; verificare **`GEMINI_API_KEY`** (e opz. **`GEMINI_MODEL`**) su entrambe le revisioni Cloud Run — v. **MASTER_PLAN.md** §5.4 e **TONY_DECISIONI_E_REQUISITI.md** §3.9

---

## 10. Riferimento incrociato (moduli non Tony)

Lo stato delle **fasi e dei componenti Tony** in questo file non è cambiato rispetto alla verifica precedente. Per modifiche di codice su **trattamenti Vigneto/Frutteto** (ottimizzazione caricamento liste, flag **superficie da anagrafe terreno**, documentazione utente/sviluppo aggiornata) vedi **`docs-sviluppo/COSA_ABBIAMO_FATTO.md`** (voce **2026-04-05**).

---

## 11. Piano operativo aggiornamento guida app (Tony Guida + guide utente)

### 11.1 Contesto e obiettivo

- La guida app e la base conoscenza Tony sono state create mesi fa; il codice ha introdotto nuove sezioni, modalita operative e opzioni UI.
- Obiettivo: riallineare in modo accurato la guida utente e la conoscenza Tony, riducendo al minimo omissioni e incoerenze.
- Vincolo: evitare aggiornamenti a memoria; ogni modifica guida deve essere tracciata su differenze reali tra documentazione esistente e codice attuale.

### 10.2 Decisione architetturale del processo

Approccio ibrido obbligatorio:

1. Analisi in parallelo per modulo (subagent dedicati per trovare differenze guida vs codice).
2. Consolidamento editoriale unico (un solo agente/step centrale che unifica stile, lessico e coerenza cross-modulo).
3. Verifica finale rapida umana su punti critici UI/UX prima del completamento.

Motivazione:

- Solo subagent per modulo in scrittura diretta rischiano duplicazioni, contraddizioni tra file e stili diversi.
- Solo revisione manuale globale senza analisi parallela rischia di non coprire tutto in tempi accettabili.

### 10.3 Fonti da aggiornare

#### A) Fonte principale guida modulare (in migrazione verso GUIDA)

- **`docs-sviluppo/GUIDA/README.md`** — nuova radice; per ambito: `CORE/utente/`, `CORE/tony/`, **`TONY/utente/`**, **`TONY/tony/`**, `INTERSEZIONI/tony/`, …
- **`docs-sviluppo/guida-app/moduli/*.md`** — ancora caricati da Tony finche non migrati sotto `GUIDA/<MODULO>/` (stub **`conto-terzi.md`**: solo rimando in repo; guida lunga da **`GUIDA/CONTO_TERZI`** via `GUIDA_LOAD_ENTRIES`).
- Legacy ancora in repo per consultazione: `docs-sviluppo/guida-app/README.md`, `core.md`, `intersezioni-moduli.md` (contenuto intersezioni copiato in `GUIDA/INTERSEZIONI/tony/intersezioni.md`).

#### B) Caricamento runtime Tony (guida estesa)

- **`core/services/tony-service.js`** — `GUIDA_LOAD_ENTRIES`: fetch da `core/GUIDA/` e `docs-sviluppo/GUIDA/` in ordine **`CORE/utente/guida.md`** → **`CORE/tony/guida-tecnica.md`** → **`TONY/utente/guida.md`** → **`TONY/tony/guida-tecnica.md`** → **`INTERSEZIONI/tony/intersezioni.md`** → **`PARCO_MACCHINE/utente/guida.md`** → **`PARCO_MACCHINE/tony/guida-tecnica.md`** → **`VIGNETO/utente/guida.md`** → **`VIGNETO/tony/guida-tecnica.md`** → **`FRUTTETO/utente/guida.md`** → **`FRUTTETO/tony/guida-tecnica.md`** → **`MAGAZZINO/utente/guida.md`** → **`MAGAZZINO/tony/guida-tecnica.md`** → **`MANODOPERA/utente/guida.md`** → **`MANODOPERA/utente/guida-manager.md`** → **`MANODOPERA/utente/guida-caposquadra.md`** → **`MANODOPERA/utente/guida-operaio.md`** → **`MANODOPERA/tony/guida-tecnica.md`** → **`CONTO_TERZI/utente/guida.md`** → **`CONTO_TERZI/tony/guida-tecnica.md`**, poi moduli legacy da `core/guida-app/` / `docs-sviluppo/guida-app/` (stub **`guida-app/moduli/vigneto.md`**, **`guida-app/moduli/frutteto.md`**, **`guida-app/moduli/magazzino.md`**, **`guida-app/moduli/manodopera.md`**: contenuto o rimando in **`GUIDA/VIGNETO`**, **`GUIDA/FRUTTETO`**, **`GUIDA/MAGAZZINO`**, **`GUIDA/MANODOPERA`**; **`guida-app/moduli/conto-terzi.md`** resta in repo come rimando a **`GUIDA/CONTO_TERZI`** ma **non** è più concatenato in `GUIDA_LOAD_ENTRIES`).
- **Report impatto guide (post-diff)**: `npm run guida:impact` — `scripts/guida-impact.mjs` + `scripts/guida-impact-lib.mjs` + `scripts/guida-code-map.json`; **bozza prompt per agente** (diff troncato + checklist): `npm run guida:suggest` (`scripts/guida-suggest-prompt.mjs`, output default in `scripts/guida-suggest-output/`, gitignored); su GitHub Actions **`.github/workflows/guida-impact-pr.yml`** aggiorna un commento sulla PR (marker `<!-- gfv-guida-impact-bot -->`); vedi `scripts/README-guida-impact.md`.
- **`CORE/utente/guida-sintesi.md`** — caricato separatamente in **`context.guida_sintesi`**: resta nel prompt dopo il primo messaggio; la guida lunga **`guida_app`** resta nel contesto completo soprattutto al primo messaggio (se il testo è abbastanza lungo, il primo turno evita di duplicare la sintesi).
- **`PARCO_MACCHINE/utente/guida-sintesi.md`** — in **`context.guida_sintesi_parco_macchine`**, stessa logica di dedup del primo turno rispetto a **`guida_app`**.
- **`VIGNETO/utente/guida-sintesi.md`** — in **`context.guida_sintesi_vigneto`**, stessa logica di dedup del primo turno rispetto a **`guida_app`**.
- **`FRUTTETO/utente/guida-sintesi.md`** — in **`context.guida_sintesi_frutteto`**, stessa logica di dedup del primo turno rispetto a **`guida_app`**.
- **`MAGAZZINO/utente/guida-sintesi.md`** — in **`context.guida_sintesi_magazzino`**, stessa logica di dedup del primo turno rispetto a **`guida_app`**.
- **`MANODOPERA/utente/guida-sintesi.md`** — in **`context.guida_sintesi_manodopera`**, stessa logica di dedup del primo turno rispetto a **`guida_app`**.
- **`CONTO_TERZI/utente/guida-sintesi.md`** — in **`context.guida_sintesi_conto_terzi`**, stessa logica di dedup del primo turno rispetto a **`guida_app`**.
- **`TONY/utente/guida-sintesi.md`** — in **`context.guida_sintesi_tony`**, stessa logica di dedup del primo turno rispetto a **`guida_app`**.

#### C) Fonte conoscenza Tony (fallback se fetch fallisce)

- `core/services/tony-guida-app.js` (`GUIDA_APP_PER_TONY`)

Nota operativa:

- Se si aggiorna solo la guida `.md` ma non il fallback condensato, Tony puo rispondere con informazioni non allineate in scenari dove il caricamento completo guida non e disponibile.

### 10.4 Pipeline standard (riusabile)

#### Fase 1 - Scope

- Definire cosa e cambiato (moduli/pagine/flussi) usando:
  - differenze recenti nel codice;
  - nuove pagine standalone/modal/form;
  - nuove opzioni filtro, nuovi stati, nuove regole ruolo/abbonamento.
- Output: elenco moduli da revisionare con priorita (Alta/Media/Bassa).

#### Fase 2 - Audit parallelo per modulo (subagent)

Per ogni modulo:

- leggere guida attuale del modulo;
- leggere pagine JS/HTML/service/config del modulo;
- produrre report differenze con formato fisso:
  - `Nuovo` (feature presenti nel codice ma assenti in guida),
  - `Modificato` (comportamento cambiato),
  - `Rimosso` (testo guida non piu valido),
  - `Da verificare in UI` (non conclusivo dal solo codice).

Output obbligatorio del report modulo:

- elenco file guida da toccare;
- motivazione tecnica sintetica per ogni cambio;
- livello confidenza (`alto`, `medio`, `basso`);
- rischi se non aggiornato.

#### Fase 3 - Consolidamento centrale guida

- Unificare tutti i report modulo in una sola bozza coerente.
- Aggiornare prima i contenuti trasversali (`core.md`, intersezioni), poi i moduli.
- Applicare lessico e struttura uniformi (schema guida esistente).
- Evitare doppioni: i flussi cross-modulo restano in `intersezioni-moduli.md`, non copiati integralmente in ogni modulo.

#### Fase 4 - Allineamento Tony fallback

- Aggiornare `GUIDA_APP_PER_TONY` con i cambiamenti realmente rilevanti per domande utente.
- Mantenere testo condensato pratico (non copia integrale della guida modulare), ma semanticamente coerente con le regole correnti dell'app.

#### Fase 5 - Gate qualita finale

Checklist minima:

- percorsi di navigazione corretti;
- nomi sezioni/pulsanti coerenti con UI reale;
- ruoli e limiti piano coerenti;
- intersezioni aggiornate;
- nessuna contraddizione tra guida modulare e fallback Tony.

### 10.5 Ruoli nel team (2 persone)

- Utente: validazione rapida dei passaggi UI critici e delle scelte di wording lato operatore.
- Agente: analisi codice completa, redazione e consolidamento guida, gestione coerenza globale.

### 10.6 Regole anti-omissione

- Nessuna sezione guida viene marcata aggiornata senza evidenza da codice.
- I punti incerti non si inventano: vanno in `Da verificare in UI`.
- Dopo aggiornamenti modulo, passaggio obbligatorio su `intersezioni-moduli.md`.
- Ogni run deve lasciare traccia di:
  - cosa e stato analizzato,
  - cosa e stato aggiornato,
  - cosa resta da verificare.

### 10.7 Strategia di esecuzione consigliata per backlog ampio

Ordine suggerito:

1. Core + navigazione globale + ruoli
2. Lavori/Attivita
3. Terreni
4. Vigneto
5. Frutteto
6. Magazzino
7. Conto terzi
8. Intersezioni finali
9. Allineamento fallback `tony-guida-app.js`

Ragione:

- si stabilizza prima il vocabolario comune e i flussi base;
- poi si consolidano i moduli specialistici;
- infine si chiude coerenza cross-modulo e fallback Tony.

### 10.8 Modalita automatico con controllo

- Automazione raccomandata: analisi differenze + bozza aggiornamenti.
- Controllo umano indispensabile: pubblicazione finale delle guide utente (soprattutto microcopy e sequenza operativa UI).
- Principio: "90 percento automatico, 10 percento verifica mirata" per massimizzare velocita senza perdere accuratezza.
