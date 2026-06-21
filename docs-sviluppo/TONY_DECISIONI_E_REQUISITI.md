# Tony – Inventario decisioni e requisiti

**Data estrazione**: 2026-03-08  
**Ultimo aggiornamento**: 2026-06-21 (policy D5: accesso off subito + riattivazione fino a scadenza — verifica OK)
**Obiettivo**: Raccogliere in un unico documento ogni decisione di prodotto, requisito e vincolo trovato nei documenti Tony, per evitare perdite durante il consolidamento.

**Stati**: `implementato` | `in corso` | `parziale` | `pianificato` | `non implementato` | `abbandonato` | `da verificare`

---

## 1. Modello abbonamento / Gating piani

| # | Decisione | Fonte | Stato | Note |
|---|-----------|-------|-------|------|
| 1.1 | **Freemium (free)**: Tony completamente assente – né widget, né endpoint, né guida | TONY_MODULO_SEPARATO, GUIDA_OPERATIVO | non implementato | Bootstrap inietta sempre Tony; nessun check plan |
| 1.2 | **Base a pagamento**: Tony Guida presente – solo spiegazioni, nessuna azione operativa | TONY_MODULO_SEPARATO, GUIDA_OPERATIVO | implementato | SYSTEM_INSTRUCTION_BASE, moduli_attivi |
| 1.3 | **Modulo Tony attivo** (`moduli_attivi.includes('tony')`): Tony Operativo – tutte le funzioni | TONY_MODULO_SEPARATO, GUIDA_OPERATIVO | implementato | SYSTEM_INSTRUCTION_ADVANCED |
| 1.4 | Tony Guida e Tony Operativo sono due esperienze diverse; Guida non deve essere impattata da refactor Operativo | GUIDA_OPERATIVO | implementato | |
| 1.5 | In piano free Tony deve essere totalmente escluso: niente widget, niente endpoint, niente fallback guida | GUIDA_OPERATIVO §7 | non implementato | Widget sempre caricato; CF sempre callable |
| 1.6 | Modulo Tony: €5/mese, attivazione da pagina Abbonamento | TONY_MODULO_SEPARATO | implementato | subscription-plans.js |
| 1.7 | **Tony consigliere moduli**: solo piano Base (Tony Guida); segnali azienda + complementi; non Free; non promuove Tony Avanzato | prodotto 2026-06-19 | implementato | `tony-module-recommendations.js`, `azienda.consigliModuli` in tonyAsk; gating legacy + `reactivate` |
| 1.8 | **Tony consigliere — tono non invasivo**: max 1–2 moduli per turno; no upsell su domande tabella; una frase + «da Abbonamento» | prodotto 2026-06-19 | implementato | `TONY_MODULE_RECOMMENDATION_RULES` in `functions/index.js` |
| 1.9 | **TTS `speakingRate` default 1.05** (override env); latenza: callable cached, payload minimale, dedup prefetch/speak, warm typing | prodotto 2026-06-19 | implementato | `functions/index.js` `getTonyAudio`; `core/js/tony/voice.js`; build client `2026-06-19a` |
| 1.10 | **Handoff strategia marketing** unificato (Free/Base/moduli, GTM backlog) | prodotto 2026-06-19 | implementato (doc) | `docs-sviluppo/STRATEGIA_MARKETING_VENDITA_HANDOFF.md` |
| 1.11 | **Card statica Abbonamento (Free)** con hint moduli da segnali, senza LLM | STRATEGIA_MARKETING §8 | pianificato | Stesse regole di `tony-module-recommendations.json` |
| 1.12 | **Chip/banner dashboard** «Tony suggerisce…» dismissible | STRATEGIA_MARKETING §8 | pianificato | Da `consigliModuli` lato client |
| 1.13 | **Tony consigliere bundle**: suggerimenti pacchetto + `consigliBundle`; quick reply bundle/singoli/`module_add`/`stacked_bundle`; prezzi «X euro al mese» | prodotto 2026-06-20 | implementato | `tony-bundles-catalog.json`, `buildBundleRecommendationHints`, `tryTonyModuleAdvisorQuickReply` |
| 1.14 | **Bundle già attivo — no pacchetti gemelli** (es. Operativo ↔ Campo): messaggio «risparmio bundle ce l'hai già» | prodotto 2026-06-20 | implementato | `BUNDLE_ALTERNATIVES`, `formatSingoliVsBundleReply` |
| 1.15 | **Secondo bundle — confronto margine**: proporre singoli se moduli mancanti costano meno del prezzo pacchetto aggiuntivo | prodotto 2026-06-20 | implementato | `formatStackedBundleAdvisorReply`; filtro expand in `buildBundleRecommendationHints` |
| 1.16 | **Domande abbonamento con «meteo»** non devono usare guida dashboard meteo | prodotto 2026-06-20 | implementato | `isModuleAdvisorQuestion` in `index.js` prima di meteo quick reply |
| 1.17 | **Stripe Checkout** moduli e bundle (annuale) | prodotto 2026-06-20 | implementato | `createStripeCheckoutSession`, `fulfillStripeCheckout`, `abbonamento-standalone.html` |
| 1.18 | **Disattivazione addon (D5)**: `cancel_at_period_end` su Stripe; **accesso app revocato subito** (`modules[]` / `activeBundles[]`); riattivazione **gratuita** fino a scadenza pagata (`reactivateStripeAddon`); no rimborso; sync webhook | prodotto 2026-06-20, revisione 2026-06-21 | **implementato** | `markAddonPendingDeactivation` / `clearAddonPendingDeactivation` + `computeAccessAfterRevokeAddon` / `RestoreAddon`; UI sezione «Disattivati (riattivabili)»; verifica utente OK |
| 1.19 | **Billing v2 — coterm e converti bundle** (Fasi 2–3 handoff): rinnovo unico Base, proration mid-cycle, «Passa al bundle», migrazione doppie subscription | prodotto 2026-06-20 | **pianificato** | `docs-sviluppo/abbonamento/BILLING_V2_HANDOFF.md` §6 Fasi 2–4 |

---

## 2. Visione e ruolo Tony

| # | Decisione | Fonte | Stato | Note |
|---|-----------|-------|-------|------|
| 2.1 | Tony è l'interfaccia intelligente, non una chat aggiunta | MASTER_PLAN | — | Principio |
| 2.2 | Conosce dati azienda, può inserire/recuperare dati, è esperto app e business | MASTER_PLAN | — | |
| 2.3 | Obiettivo: utente non deve sapere form/pagine a memoria | MASTER_PLAN | — | |
| 2.4 | Priorità: operai e capisquadra prima di tutto | MASTER_PLAN | — | |
| 2.5 | Tony Operativo deve fornire vantaggio reale di tempo, non solo chat | GUIDA_OPERATIVO | — | Criterio prodotto |

---

## 3. Architettura tecnica

| # | Decisione | Fonte | Stato | Note |
|---|-----------|-------|-------|------|
| 3.1 | **Niente patch per modulo**: no `if (modulo === 'terreni')` | MASTER_PLAN | — | Principio scalabilità |
| 3.2 | **Configurazione > codice**: nuovo form = mapping, non if/else | MASTER_PLAN | implementato | tony-form-mapping.js |
| 3.3 | Context Builder in CF (buildContextAzienda), non servizio separato | CONTEXT_BUILDER, MASTER_PLAN | implementato | functions/index.js |
| 3.4 | Nuovo form = voce in TONY_FORM_MAPPING; nuova tabella = pageType in currentTableData | MASTER_PLAN | implementato | |
| 3.5 | **Struttura `modules/tony/`** (tony-dashboard, tony-advanced-service) | TONY_MODULO_SEPARATO | abbandonato | Tony resta in core/ |
| 3.6 | Separazione NLU / Form Engine / UI Layer – Tony non pilota DOM opportunisticamente | GUIDA_OPERATIVO | implementato | tony-form-schemas, injector |
| 3.7 | Form Schema: modalId, submitSelector, fields (visibleWhen, dependsOn, resolver), saveGuard | GUIDA_OPERATIVO | implementato | tony-form-schemas.js |
| 3.8 | **PWA / Service Worker**: ogni **commit** (con hook `.githooks`) o **`npm run bump:pwa-cache`** aggiorna **`SW_CACHE_BUILD_ID`** in `service-worker.js` (`CACHE_NAME` = `gfv-platform-` + id); le cache con nome diverso vengono eliminate in `activate` | GUIDA_PWA, COSA_ABBIAMO_FATTO | implementato | Evita client con HTML/JS obsoleti in Cache Storage; setup `npm run setup:hooks` in `docs-sviluppo/GUIDA_PWA.md` |
| 3.9 | **Modello Gemini REST**: **`gemini-2.5-flash`** (default `TONY_GEMINI_MODEL`); override env **`GEMINI_MODEL`** su Cloud Run; **`GEMINI_API_KEY`** obbligatoria su `tonyask` e `tonyaskstream` | COSA_ABBIAMO_FATTO 2026-06-03 | implementato | `gemini-2.0-flash` deprecato → 404; verificato in produzione dopo deploy |

---

## 4. Form e compilazione

| # | Decisione | Fonte | Stato | Note |
|---|-----------|-------|-------|------|
| 4.1 | Form Attività: INJECT_FORM_DATA, deriveCategoriaFromTipo, override Generale→Tra le File su vigneto/frutteto | TONY_COMPILAZIONE, TONY_SVILUPPO_2026-03 | implementato | |
| 4.2 | Form Lavori: INJECT_FORM_DATA, sottocategoria Tra le File, disambiguazione erpicatura/trinciatura | TONY_COMPILAZIONE_LAVORI | implementato | |
| 4.3 | **Terreno-form**: `injectTerrenoForm` atomico + save/proattivo locale; entity parser client/CF «aggiungi terreno»; categoria coltura prima di `terreno-coltura` | merge 2026-06-08 / 2026-06-14 | implementato | `tony-form-injector.js`, `tony-terreno-entity-parser.js`, `tony-form-save-local.js` |
| 4.4 | Flusso bottom-up: tipo lavoro → deduce categoria/sottocategoria (deriveCategoriaFromTipo) | TONY_FLUSSO_INVERSO | implementato | |
| 4.5 | Sottocategoria da terreno: Vite/Frutteto/Olivo → solo "Tra le File" o "Sulla Fila", mai "Generale" | TONY_COMPILAZIONE, TONY_SVILUPPO_2026-03 | implementato | TERRENO_SOTTOCATEGORIA_PREFERENCE |
| 4.6 | Divieto ID Firestore, uso nomi nelle SELECT (resolve by_name) | MASTER_PLAN Fase 1 | implementato | |
| 4.7 | SAVE_ACTIVITY solo se required completi; non fidarsi di "ho salvato" dell'LLM | GUIDA_OPERATIVO | implementato | saveGuard, fallback |
| 4.8 | segnala-guasto-form, macchina-form: INJECT_FORM_DATA non supportato | ANALISI_SUBAGENT | da fare | Subagent Meccanico li cita |

---

## 5. Entry point e navigazione

| # | Decisione | Fonte | Stato | Note |
|---|-----------|-------|-------|------|
| 5.1 | Entry point da ovunque: "ho trinciato 6 ore" da Dashboard funziona | MASTER_PLAN Fase 2 | implementato | |
| 5.1a | Entry point crea lavoro: "crea un lavoro di erpicatura nel Sangiovese" da Dashboard → OPEN_MODAL lavoro-modal + fields, text "Ti porto a gestione lavori" | functions/index.js | implementato | 2026-03-08 |
| 5.2 | Fallback: OPEN_MODAL su pagina senza modal → APRI_PAGINA prima, poi riprova | MASTER_PLAN | implementato | checkTonyPendingAfterNav |
| 5.3 | tony_pending_intent in sessionStorage per persistenza cross-page | ANALISI_SUBAGENT | implementato | |
| 5.4 | OPEN_MODAL con fields → INJECT_FORM_DATA atomico (non N SET_FIELD) | TONY_SVILUPPO_2026-03 | implementato | |

---

## 6. Context Builder e contesto

| # | Decisione | Fonte | Stato | Note |
|---|-----------|-------|-------|------|
| 6.1 | ctx.azienda: terreni, terreniClienti, clienti, poderi, colture, categorie, tipiLavoro, macchine, trattori, attrezzi, prodotti, guastiAperti, summaryScadenze | CONTEXT_BUILDER, functions | implementato | |
| 6.2 | ctx.attivita: terreni (coltura_categoria), colture_con_filari | CONTEXT_BUILDER | implementato | |
| 6.3 | summarySottoScorta in ctx.azienda | CONTEXT_BUILDER | implementato | `summarySottoScorta` + `prodottiSottoScorta`; prodotti con `scortaMinima`/`giacenza` (2026-04-11) |
| 6.4 | tenantId dal client obbligatorio per Context Builder | CONTEXT_BUILDER | implementato | |
| 6.5 | Prodotti con giacenza, scortaMinima/sogliaMinima per sotto scorta | CONTEXT_BUILDER | implementato | prodotti in ctx + summarySottoScorta / prodottiSottoScorta |
| 6.6 | **consigliModuli**, **consigliBundle**, **segnaliAziendaModuli** in ctx.azienda (Tony Guida Base) | tony-module-recommendations 2026-06-19, **bundle 2026-06-20** | implementato | Solo piano Base in tonyAsk; trigger gated; quick reply advisor; merge moduli client+tenant |

---

## 7. Comandi e azioni

| # | Decisione | Fonte | Stato | Note |
|---|-----------|-------|-------|------|
| 7.1 | APRI_PAGINA, OPEN_MODAL, SET_FIELD, INJECT_FORM_DATA, SAVE_ACTIVITY, CLICK_BUTTON | Vari | implementato | |
| 7.2 | FILTER_TABLE: terreni (podere, categoria, coltura, possesso, alert) | functions, main.js | implementato | |
| 7.3 | FILTER_TABLE attivita: terreno, tipoLavoro, coltura, origine, data, dataDa, dataA, ricerca | functions, main.js | implementato | 2026-03-08 |
| 7.3a | FILTER_TABLE lavori: stato, progresso, caposquadra, terreno, tipo, tipoLavoro, operaio. Match tipo lavoro: case-insensitive, nomi parziali, risoluzione tipoLavoroId (applyFilters riceve tipiLavoroList) | functions, main.js, gestione-lavori-events | implementato | 2026-03-08 |
| 7.4 | SUM_COLUMN per terreni | functions, main.js | implementato | |
| 7.5 | RIASSUNTO (tonyGlobalBriefing) | main.js | implementato | Client 0 CF: `buildDashboardRiassuntoText` + summary ops con **nomi** (2026-06-15); CF binario B invariato |
| 7.6 | MOSTRA_GRAFICO | MASTER_PLAN | da fare | |
| 7.7 | Creare: con conferma; Modificare: conferma esplicita; Eliminare: solo su richiesta; Bulk: mai | MASTER_PLAN §6 | — | Regole |

---

## 8. Grafici e tabelle

| # | Decisione | Fonte | Stato | Note |
|---|-----------|-------|-------|------|
| 8.1 | Tony non genera grafici; descrive dati o naviga alla pagina | MASTER_PLAN | — | |
| 8.2 | currentTableData: pageType, summary, items – pattern per domande informative | RIEPILOGO_CURRENTTABLEDATA | implementato | Vedi §8.3 per elenco pagine (allineato a `tony/STATO_ATTUALE.md`) |
| 8.3 | Pagine con currentTableData (pageType) | STATO_ATTUALE | implementato | terreni, attivita, lavori, macchine, prodotti, movimenti, trattori, attrezzi, flotta, scadenze, guasti, clienti, preventivi, tariffe, terreniClienti, concimazioni_vigneto, concimazioni_frutteto, tracciabilita_consumi — altre liste admin/moduli da estendere con lo stesso canone |

---

## 9. Subagent e FORM PRONTO

| # | Decisione | Fonte | Stato | Note |
|---|-----------|-------|-------|------|
| 9.1 | Subagent Vignaiolo, Logistico, Meccanico attivi per pagePath | ANALISI_SUBAGENT, functions | implementato | |
| 9.2 | Regola "FORM PRONTO": non SET_FIELD se form non aperto | ANALISI_SUBAGENT §6.2 | implementato | CF: regola 0 + "SET_FIELD solo se form.formId === attivita-form" |
| 9.3 | Guard form pronto prima di eseguire SET_FIELD (client) | ANALISI_SUBAGENT §6.2 | parziale | Fallback: modal assente → naviga a attivita con campi pendenti |
| 9.4 | Subagent Operativo per attività/lavori (opzionale) | ANALISI_SUBAGENT | da fare | |

---

## 10. Voce e TTS

| # | Decisione | Fonte | Stato | Note |
|---|-----------|-------|-------|------|
| 10.1 | TTS cloud (getTonyAudio), voce **it-IT-Chirp3-HD-Charon** (Chirp 3 HD; rollback env `it-IT-Wavenet-D`) | HANDOFF_TTS_CHIRP3, functions | implementato | 2026-06-13 |
| 10.2 | askStream per streaming risposta | TONY_DA_IMPLEMENTARE | implementato | |
| 10.3 | Pulizia testo per TTS (no markdown, emoji, JSON) | TONY_DA_IMPLEMENTARE | implementato | |
| 10.4 | Modalità continua, barge-in, congedo vocale | TONY_FUNZIONI | implementato | |
| 10.5 | Cancel logico TTS (`clearTonyAudioPipeline` + `__tonyGeneration`) | PIANO_AUDIO_PIPELINE_BARGEIN | implementato | 2026-06-07 |
| 10.6 | Chunking TTS per frase durante SSE (`stream-tts-chunk.js`) | PIANO_AUDIO_PIPELINE_BARGEIN §7 | implementato | 2026-06-09; remainder in doDisplay |
| 10.7 | Mic spento durante TTS; no barge-in su `onspeechstart` (eco auto-mode); riapertura mic solo a pipeline idle | fix voce dashboard 2026-06-09 | implementato | build `2026-06-09e`; `scheduleReopenMicIfIdle` |
| 10.8 | Normalizzazione temperature TTS prima strip Unicode (en-dash `19–29°C` → «da 19 a 29 gradi», non «1929 gradi») | fix voce dashboard 2026-06-09 | implementato | `normalizeTemperaturesForItalianTTS` in `voice.js` — build `2026-06-09f` |
| 10.9 | Meteo vocale su dashboard da cache client (`tryDashboardMeteoQuickReply`), senza CF | fix voce dashboard 2026-06-09 | implementato | `meteo-dashboard-quick-reply.js` |
| 10.10 | RIASSUNTO dashboard client: ops + meteo; «sì/ok» solo dopo offerta briefing; addio «grazie» locale senza CF | fix voce dashboard 2026-06-09 | implementato | `buildDashboardRiassuntoText`, `tonyWantsDashboardRiassunto` — build `2026-06-09g`; **2026-06-15:** ops con nomi (`formatDashboardOpsBriefingText`, `dashboard-tony-briefing-text.js`) |
| 10.11 | Latenza dialogo auto-mode: costanti mic/TTS accorciate (`2026-06-14a`: final 220 ms, speechend 450 ms, restart 350 ms, reopen 100 ms) | tuning UX vocale 2026-06-14 | implementato | Baseline stabile post E2E multi-PC; ulteriore riduzione non raccomandata senza test mirati |
| 10.12 | Riapertura microfono auto-mode: scheduler unico `scheduleMicReopenInAutoMode` (debounce onend + TTS + speechend vuoto) | fix loop mic mobile/PWA 2026-06-14 | implementato | build `2026-06-14b`; soppressione speechend vuoto entro 700 ms post-invio |
| 10.13 | Spegnimento auto-mode solo con motivo esplicito (`user-mic`, `panel-close`, `inactivity`, `voice-farewell`) | fix loop auto-mode 2026-06-20 | implementato | build `2026-06-20o`; `AUTO_MODE_OFF_REASONS` |
| 10.14 | `onPlayEnd` TTS solo a pipeline completamente idle (`completeTtsClip`) | fix mic bloccato post-risposta 2026-06-20 | implementato | build `2026-06-20p`; `core/js/tony/voice.js` |
| 10.15 | Reconcile TTS fine stream: confronto testo finale con clip lette (`spokenTtsTexts`), non solo conteggio frasi | fix frase saltata a voce 2026-06-20 | implementato | build `2026-06-20q`; `reconcileUnspokenVoiceSegments` |
| 10.16 | Saluto vocale ≠ congedo («Ciao Tony tutto bene» non chiude sessione; «Ok grazie» sì) | fix false positive farewell 2026-06-20 | implementato | `checkFarewellIntent` + `greetingHints` — build `2026-06-20q` |
| 10.17 | Trascrizione STT: `?` automatico su domande (euristica italiano, Web Speech senza punteggiatura) | UX voce 2026-06-20 | implementato | `applyItalianVoiceQuestionPunctuation` in `engine.js` — build `2026-06-20r`; test `tony-voice-transcript-punctuation.test.js` |

---

## 11. Limitazioni esplicite

| # | Decisione | Fonte | Stato | Note |
|---|-----------|-------|-------|------|
| 11.1 | Mappe: Tony non traccia poligoni | MASTER_PLAN | — | |
| 11.2 | Eliminazioni bulk: Tony non le esegue | MASTER_PLAN | — | |
| 11.3 | Impostazioni sensibili: Tony spiega, non esegue senza conferma | MASTER_PLAN | — | |
| 11.4 | LLM non decide ordine click, quando campo figlio pronto, né dichiara salvataggio riuscito | GUIDA_OPERATIVO | — | |

---

## 12. Roadmap e criteri done (Master Plan)

| Fase | Criterio done | Stato |
|------|---------------|-------|
| 1 | Tony aggiunge terreno senza guidare passo-passo | parziale | Terreno usa OPEN_MODAL+fields |
| 2 | "Ho trinciato 6 ore" da Dashboard → Tony apre modal, compila | completata | |
| 3 | Tony risponde "Quali scadenze?" / "Come stanno i prodotti?" / sotto scorta | in corso | summaryScadenze ok; summarySottoScorta ok (2026-04-11) |
| 4 | Aggiungere prodotto/cliente richiede solo aggiornare mapping | in corso | Attività e Lavori ok |
| 5 | "Mostrami statistiche vigneto" → apre e/o riassume | parziale | |
| 6 | Tony segnala proattivamente scadenze e sotto scorta | da fare | |

---

## 13. Regole operative (agenti/sviluppatori)

| # | Regola | Fonte |
|---|--------|-------|
| 13.1 | Ogni modifica Tony deve allinearsi al Master Plan | MASTER_PLAN |
| 13.2 | Non toccare Tony Guida durante lavori su Operativo | GUIDA_OPERATIVO |
| 13.3 | Non introdurre logica hardcoded per singolo modal | GUIDA_OPERATIVO |
| 13.4 | Non considerare riuscito comando se form non mostra campo valorizzato | GUIDA_OPERATIVO |
| 13.5 | Ogni nuovo modal supportato deve avere schema + test | GUIDA_OPERATIVO |

---

## 14. Domanda trattore/attrezzo

| # | Decisione | Fonte | Stato | Note |
|---|-----------|-------|-------|------|
| 14.1 | Se 1 solo trattore (o compatibile con attrezzo) → compila; se più → chiedi con elenco | CONTEXT_BUILDER, MASTER_PLAN | implementato | |
| 14.2 | Domande trattore/attrezzo SOLO quando form già aperto | functions, TONY_SVILUPPO | implementato | OPEN_MODAL con fields, domande al turno successivo |
| 14.3 | Trattori compatibili: cavalli >= cavalliMinimiRichiesti attrezzo | CONTEXT_BUILDER | implementato | |
| 14.4 | Risposta breve a disambiguazione **trattore** (form lavoro aperto): intercept **client-side**, inject DOM, conferma salvataggio locale — **no round-trip CF** | tony-form-injector, tony/main.js | implementato | Alias corti (`t5`→Nuovo T5); candidati in sessione; guard anti doppia domanda 120 s; E2E verificato 2026-05-25 |
| 14.5 | **Sottocategoria / tipo lavoro** su form Lavoro: scelta **deterministica da coltura terreno** (filari → Tra le File, seminativo → Generale/Meccanico) — **non** chiedere in chat se terreno valorizzato | tony-form-mapping `LAVORAZIONI_DEFAULTS_TONY`, tony-form-injector `applyLavorazioneDefaultsLavoro` | implementato | Disambiguazione chat solo se anagrafica terreno incompleta o terreno ambiguo (≠ scelta tra tipi lavoro) |
| 14.6 | Estensione pattern §14.4: **attrezzo** multiplo (form lavoro) — intercept client-side, inject DOM, conferma salvataggio locale | tony-form-injector, tony/main.js | implementato | Alias `erpice 200`, `200`, `denti`; candidati in `__tonyMacchineDisambAttrezziCandidati`; test `tony-lavoro-attrezzo-disamb.test.js` — 2026-05-26 |
| 14.6c | **Ordine disamb. macchine (lavoro):** attrezzo inferito da tipo solo **dopo** trattore noto (DOM o formData), salvo attrezzo già nel messaggio utente | tony-form-injector | implementato | `shouldAskAttrezzoDisambigFromTipo` — 2026-05-26 |
| 14.6d | **Filtro CV attrezzo←trattore (lavoro):** dopo scelta trattore, attrezzi candidati filtrati per `cavalli >= cavalliMinimiRichiesti`; unico compatibile → auto-inject senza domanda | tony-form-injector | implementato | `attrezziCompatibiliConTrattoreCv` — 2026-05-26 |
| 14.6e | **OPEN_MODAL crea lavoro:** testo navigazione senza domande trattore/attrezzo (macchine al form aperto) | tony-lavoro-entity-parser.js | implementato | deploy CF — 2026-05-26 |
| 14.6f | **Intervista lavoro client-side:** risposte brevi terreno/operaio/data/durata/tipo → patch DOM senza CF; domanda proattiva locale | tony-form-injector, tony/main.js | implementato | `applyLavoroInterviewFromUserReply`, `promptLavoroInterviewMissing`; durata «un giorno» (2026-06-14); test `tony-lavoro-interview-client.test.js` (**42**) — 2026-05-26 / 2026-06-14 |
| 14.6n | **Intervista lavoro vocale — terreno:** scoring multi-token (`scoreTerrenoInterviewMatch`); disamb. Sangiovese/Pannelli; **vietato** auto-pick terreno da token cognome operaio nel messaggio «per X»; correzione esplicita «il terreno è …» con `forceFields` inject (sovrascrive `patchOnly`) | tony-form-injector | implementato | E2E vocale 2026-06-14; `isLavoroTerrenoCorrectionText`, `extractTerrenoQueryFromInterviewText` — 2026-06-14 |
| 14.6b | Estensione futura pattern §14.4: **operaio** nome ambiguo, **terreno** nome ambiguo, conferma salvataggio su altri form, **ack tipo stem-only** | tony-form-injector, tony/main.js, **`tony-form-save-local.js`**, **`tony-movimento-create-local.js`**, **`movimento-prezzo-catalogo.js`** | **Implementato e validato E2E browser** (2026-06-03): operaio + terreno ambiguo + save preventivo + save magazzino + creazione movimento/prodotto locale + prezzo catalogo + ack «Ok, [Tipo] su [Terreno]» dopo auto-pick stem vago. **E2E vocale lavoro 2026-06-14:** intervista completa → save locale, **0 CF** follow-up | — |
| 14.6g | **Domanda manuale/meccanica (intervista lavoro):** solo stem in `manualMechChoiceStems` (potatura, vendemmia) **e** catalogo terreno con **entrambe** le varianti; stem in `manualMechSkipStems` (erpicatura, trinciatura, …) salta livello 1 | `LAVORAZIONI_DEFAULTS_TONY`, `lavoroTipoStemNeedsManualMechChoice` | implementato | 2026-05-31 — confermato canary vendemmia squadra |
| 14.6h | **Gate macchine post-intervista:** tipo meccanico (nome o scelta M/M) → obbligo trattore+attrezzo prima del save; tipo manuale → no macchine, azzera trattore/attrezzo in patch | `inferRequiresMachineFromTipo`, `classifyTipoLavoroModo` | implementato | Fix «Potatura verde» senza «meccanic» nel nome — 2026-05-31 |
| 14.6i | **Assign mode intervista lavoro:** nome operaio (es. «luca» / «a Luca») → autonomo + disamb. operai, **non** caposquadra; lavoro squadra solo se intent esplicito o nome caposquadra; modalità in sessione (`__tonyLavoroConfirmedAssignMode`), non default DOM; **priorità disamb. persona** su hint tipo pending (`lavoroInterviewCanApplyPendingTipoHint`); inject autonomo prima di select operaio | tony-form-injector | implementato | Canary **3b-C13** PASS 2026-05-31 |
| 14.6j | **Creazione movimento magazzino client-side:** intent «crea entrata/uscita …» / «scarico …» → parse locale, `OPEN_MODAL` + inject **prima di tonyAsk**; recovery fake CF; regola CF **0** creazione; **cross-page** (abbonamento, conto terzi, dashboard) | **`tony-movimento-create-local.js`**, tony/main.js, functions/index.js | implementato | **3b-C16/C17/C19** E2E (2026-06-02) |
| 14.6l | **Creazione prodotto magazzino client-side:** intent «crea prodotto …» → parse locale, `OPEN_MODAL` + inject **prima di tonyAsk**; recovery fake CF; **cross-page**; dosaggio min/max + carenza obbligatori per categoria (`prodotto-form-required.js`) | **`tony-prodotto-create-local.js`**, **`prodotto-form-required.js`**, tony/main.js | implementato | **3b-C18/C19** E2E (2026-06-02) |
| 14.6m | **Segna ore workspace campo client-side:** intervista orari/pausa/save su `#quick-hours-form` (`field-workspace-ore-form`) — intent «segniamo le ore», turni singoli orario, pausa (`0`/`nessuna`/minuti), conferma «ok»/«sì»/«salva» → inject + submit reale Firestore **0 CF** su follow-up; alias CF INJECT/SUBMIT normalizzati; display ore nette `formatOreNette` | **`tony-form-save-local.js`**, **`tony/engine.js`**, tony/main.js, **`field-workspace-controller.js`**, `tony-field-workspace-command.js` | **implementato** | Canary **3b-C21** E2E browser + validazione manager (lavoro autonomo) — 2026-06-04 |
| 14.7 | Trattore non dichiarato nel messaggio iniziale con 2+ compatibili: **non** auto-inventare — rimuovere da formData e chiedere disambiguazione | tony-form-injector `sanitizeUndeclaredLavoroMacchine`, CF parser | implementato | 2026-05-25 |

---

## 15. Proattività

| # | Decisione | Fonte | Stato | Note |
|---|-----------|-------|-------|------|
| 15.1 | Proattività Dashboard (checkGlobalStatus, tonyGlobalBriefing) | STATO_TONY | implementato | |
| 15.2 | Proattività pagina Guasti | STATO_TONY | implementato | |
| 15.3 | "Ho notato X, vuoi che...?" generico | MASTER_PLAN Fase 6 | da fare | |
| 15.4 | Memoria storica: confronti anno/anno | MASTER_PLAN | da fare | |

---

## 16. Verificati sul codice (2026-03-08)

| # | Voce | Fonte | Azione |
|---|------|-------|--------|
| 16.1 | Tony completamente assente in freemium (widget + endpoint) | TONY_MODULO_SEPARATO, GUIDA_OPERATIVO | ✅ Verificato: non implementato (widget sempre caricato) |
| 16.2 | Regola FORM PRONTO nel system prompt | ANALISI_SUBAGENT | ✅ Implementato in CF |
| 16.3 | Guard form pronto in processTonyCommand | ANALISI_SUBAGENT | Parziale: fallback navigazione |
| 16.4 | currentTableData attivita: DOBBIAMO dice "da dotare" | DOBBIAMO_ANCORA_FARE | ✅ attivita-controller.js popola; DOBBIAMO obsoleto |

---

## 17. Riferimenti documenti analizzati

- MASTER_PLAN_TONY_UNIVERSAL.md (archiviato → tony/MASTER_PLAN.md)
- TONY_MODULO_SEPARATO.md
- GUIDA_TONY_OPERATIVO_ARCHITETTURA_GLOBALE.md
- CONTEXT_BUILDER_SPECIFICHE_SVILUPPO.md
- ANALISI_SUBAGENT_MASTER_PLAN.md
- TONY_COMPILAZIONE_ATTIVITA_IMPLEMENTAZIONE.md
- TONY_COMPILAZIONE_LAVORI_2026-02.md
- TONY_FLUSSO_COMPILAZIONE_ATTIVITA_INVERSO.md
- TONY_SVILUPPO_2026-03_VIGNETO_E_COMPILAZIONE.md
- TONY_DA_IMPLEMENTARE_POST_GEMINI.md
- DOBBIAMO_ANCORA_FARE.md
- STATO_TONY_2026-03-08.md (archiviato → tony/STATO_ATTUALE.md)

---

## 18. Evoluzione GPS campioni (futuro)

| # | Decisione/Requisito | Fonte | Stato | Note |
|---|----------------------|-------|-------|------|
| 18.1 | Non esiste ancora un flusso dedicato "campioni" (raccolta/profilazione maturazione) | richiesta utente 2026-04-14 | confermato | Nessuna pagina specifica da estendere ora |
| 18.2 | In seconda fase introdurre mappa per registrare punti campione georeferenziati | richiesta utente 2026-04-14 | da fare | Riutilizzare pattern GPS opzionale già adottato (`posizioneRilevamento` + accuratezza ±m + link mappa) |
| 18.3 | Implementazione da mantenere opzionale e non bloccante | continuità UX flussi GPS esistenti | da fare | Checkbox esplicita e fallback senza posizione |

### Mini-spec tecnica (fase 2 futura)

| # | Ambito | Requisito tecnico | Stato |
|---|--------|-------------------|-------|
| 18.4 | **Modello dati** | Ogni punto campione deve usare struttura `posizioneRilevamento: { lat, lng, accuracyMeters, source, rilevataIl? }` con compatibilità al pattern già in `core/js/geo-capture.js` | da fare |
| 18.5 | **UI form** | Aggiungere blocco opzionale uniforme: checkbox "Includi posizione approssimativa", bottone acquisizione GPS, testo stato posizione, nota accuratezza | da fare |
| 18.6 | **Mappa campioni** | Mappa con inserimento multipunto (marker numerati), metadati per punto (`tipoCampione`, `nota`, `timestamp`) e possibilità di rimozione punto | da fare |
| 18.7 | **Persistenza** | Salvataggio non bloccante: se GPS non disponibile, consentire conferma senza posizione; se disponibile, salvare coordinate + accuratezza | da fare |
| 18.8 | **Lista/Dettaglio** | Visualizzare per ogni campione: link Maps, coordinate arrotondate, accuratezza ±m, badge sorgente (`GPS`/`MAPPA`) | da fare |
| 18.9 | **Tony/contesto** | Quando esisterà la tabella campioni: esporre `currentTableData` (`pageType` dedicato) e supportare `FILTER_TABLE` coerente | da fare |
| 18.10 | **Rollout** | Prima implementazione su vendemmia/profilazione maturazione; estensione successiva ai flussi raccolta affini senza duplicare logica | da fare |

### Checklist implementazione (pronta sprint)

| Step | Obiettivo | Output atteso | Verifica |
|------|-----------|---------------|----------|
| 1 | Definizione schema Firestore campioni | Struttura documento con `puntiCampione[]`, `posizioneRilevamento`, metadati campione (`tipo`, `nota`, `rilevataIl`) | Salvataggio/lettura manuale su tenant test |
| 2 | Model + service modulo campioni | Model JS + service CRUD coerenti con pattern moduli esistenti | Create/Get/Update/Delete da console senza errori |
| 3 | UI base form campione | Modal/form con campi campione + blocco GPS opzionale | Apertura form, compilazione e reset corretti |
| 4 | Acquisizione GPS riusabile | Riutilizzo `getCurrentPositionGeo` + stato UI + gestione errori | Test permessi negati/timeout + test acquisizione riuscita |
| 5 | Mappa multipunto campioni | Inserimento marker numerati, rimozione marker, editing metadati punto | Coerenza numero punti e ordine marker in UI |
| 6 | Persistenza punti mappa | Salvataggio `puntiCampione[]` con coordinate + accuratezza/sorgente | Reload pagina: punti ricostruiti correttamente |
| 7 | Tabella/lista campioni | Colonne posizione (link Maps, ±m, badge), tipo campione, timestamp | Rendering corretto su record con/senza GPS |
| 8 | currentTableData + FILTER_TABLE | `pageType` dedicato campioni + summary/items aggiornati a ogni render | Tony legge lista campioni e filtro funziona |
| 9 | Compatibilità cross-flussi | Collegamento opzionale da vendemmia/profilazione maturazione | Creazione campione da entrambi i flussi target |
| 10 | QA manuale finale | Smoke test mobile/desktop + fallback senza posizione | Checklist QA firmata prima del rilascio |

---

## 19. Meteo operativo — praticabilità terreno per morfologia (2026-05-21)

Decisioni di prodotto discusse e chiuse; **implementate** (2026-05-22 — Sprint 6 fase 6 meteo: `tony-meteo-rules`, `meteo-service`, form terreno, Context Builder `tipoCampo`, **`lavoroCampo` + asciugatura**, **doppia alternativa** §19.8–§19.9).

### 19.1 Dati pioggia disponibili (OpenWeather One Call 3.0)

| # | Decisione | Stato | Note |
|---|-----------|-------|------|
| 19.1.1 | L’API attuale fornisce **mm previsti** (daily/hourly/minutely), non archivio pluviometrico | pianificato | Pianificazione «venerdì pioverà X mm → sabato in collina?» ok con previsioni |
| 19.1.2 | **Non** abbiamo mm **realmente caduti** ieri/settimana scorsa con la sola One Call | pianificato | Per «ieri ha piovuto» servirebbe Timemachine/Historical OW o input utente — fuori scope MVP |
| 19.1.3 | Valutazione praticabilità basata su **previsioni** nella finestra ~8 giorni (giorno candidato + lookback + asciugatura) | implementato | Asse A + B (+ B bis lavorazioni); v. §19.8 |

### 19.2 Tre assi di valutazione (Tony)

| # | Decisione | Stato | Note |
|---|-----------|-------|------|
| 19.2.1 | **Asse A — Meteo del giorno candidato**: pop, vento (solo trattamenti), mm previsti **quel giorno** | implementato | `evaluateMeteoOperativoGiorno`; `lavoroCampo` ignora vento |
| 19.2.2 | **Asse B — Praticabilità terreno**: morfologia + **somma mm previsti** in lookback (D + D−1; montagna + D−2) vs tabella §19.4 | implementato | `computeLookbackRainMm`, `evaluatePraticabilitaTerreno` |
| 19.2.2b | **Asse B bis — Asciugatura** (solo `lavoroCampo`): dopo **ultimo** giorno piovoso significativo (> okMax morfologia; montagna > 0 mm), servono **2** giornate asciutte consecutive (collina/montagna) o **1** (pianura) | implementato | `evaluateAsciugaturaLavoroCampo`, `computeDryDaysBeforeTarget` |
| 19.2.3 | Risposta Tony deve **motivare** impraticabilità («in collina, dopo X mm previsti…») | implementato | Messaggi deterministici quick reply |
| 19.2.4 | Fascia intermedia → **domanda esplicita** («riesci a lavorare il terreno / passare con il trattore?») | implementato | `esito: chiedi_trattore` + follow-up sì/no |
| 19.2.5 | **`lavoroCampo`**: stessa tabella praticabilità; morfologia richiesta anche senza terreno citato in chat | implementato | `activityKind: lavoroCampo` |

### 19.3 Morfologia terreno (`tipoCampo`)

| # | Decisione | Stato | Note |
|---|-----------|-------|------|
| 19.3.1 | Morfologia **per ogni terreno**: `pianura` \| `collina` \| `montagna` | implementato | `Terreno.tipoCampo` + Context Builder / meteo terreni |
| 19.3.2 | Aggiungere **select morfologia nel form terreno** standard (3 opzioni) | implementato | `core/terreni-standalone.html`, `terreno-tipo-campo` in mapping Tony |
| 19.3.3 | Se morfologia **manca**: Tony **chiede** (pianura/collina/montagna) e usa la risposta per le soglie; **salvare** sul terreno | implementato | `persistTipoCampoTerreno` in `meteo-service.js` |
| 19.3.4 | Override per singolo terreno oltre default azienda: **backlog**, non MVP | pianificato | Morfologia + default tenant sufficienti |

### 19.4 Soglie mm previsti — praticabilità (default di sistema)

Valori **default**; applicati al **peggior caso / finestra pioggia recente** sul giorno valutato (dettaglio finestra in implementazione).

| Morfologia | Automatico ok | Chiedi all’utente | Impraticabile (Tony) |
|------------|---------------|-------------------|----------------------|
| **Pianura** | 0–20 mm | 20–50 mm | > 50 mm |
| **Collina** | 0–3 mm (**attenzione**, procedi con cautela) | 3–10 mm | ≥ 10 mm |
| **Montagna** | nessuna pioggia prevista | 2–5 mm | > 5 mm |

| # | Decisione | Stato | Note |
|---|-----------|-------|------|
| 19.4.1 | Tabella sopra = default ufficiale prodotto | implementato | `DEFAULT_PRATICABILITA_MM` |
| 19.4.2 | Fascia «chiedi»: Tony chiede se il campo resta **praticabile con trattore**; risposta sì/no guida ok/attenzione vs posticipa | implementato | |
| 19.4.3 | Fascia impraticabile o rifiuto utente: Tony propone **due date** quando possibile — prima utile **prima** della pioggia + prima utile **dopo** (con asciugatura per lavorazioni); l'utente sceglie | implementato | `findDualAlternativeDays`, `buildDualAlternativaOperativaReply` |
| 19.4.4 | **Pianura**: comportamento attuale (alternativa giorno dopo se piove) resta valido; collina/montagna aggiungono vincolo praticabilità | implementato | |

### 19.5 Configurabilità soglie (tenant)

| # | Decisione | Stato | Note |
|---|-----------|-------|------|
| 19.5.1 | Soglie **configurabili a livello azienda** (Impostazioni), con **default** = tabella §19.4 | pianificato | Stesso pattern coefficienti morfologia Conto terzi + `DEFAULT_TONY_METEO_RULES` |
| 19.5.2 | UI semplice: per morfologia due soglie («chiedi da» / «impraticabile da») o tre campi numerici + **Ripristina default** | pianificato | Evitare matrice complessa vento×pop×mm×giorni in UI |
| 19.5.3 | MVP implementazione: **solo default hardcoded** ammesso; override tenant in **passo successivo** senza cambiare logica Tony | implementato | `mergeTonyMeteoRules` + hook `praticabilitaTerreno` |
| 19.5.4 | Override **per singolo terreno**: non previsto in prima release | pianificato | |

### 19.6 Esclusioni e limiti

| # | Decisione | Stato | Note |
|---|-----------|-------|------|
| 19.6.1 | Non modellare tipo suolo, pendenza %, drenaggio in v1 | implementato | Soglie mm × morfologia = euristica spiegabile |
| 19.6.2 | Praticabilità orientata a **lavorazioni/trattamenti con trattore** / passaggio mezzi | implementato | Trattamenti manuali leggeri: valutare in seguito |
| 19.6.3 | Agro API / storico pluviometrico OW: **escluso** salvo requisito esplicito | implementato | v. PLAN_INTEGRAZIONE_METEO §11.5 |
| 19.6.4 | Intent **crea lavoro / attività / preventivo** ha **priorità** su quick reply meteo (stessa frase con data/terreno) | implementato | `isTonyOperationalCreationIntent` in `tony-quick-replies.js`; guard in `meteo-service.js` + `tonyAsk` |
| 19.6.5 | Domande operative **trinciatura** (`trinciare`, `trinciatura`) classificate come meteo/lavoroCampo come erpicatura | implementato | Pattern in `isTonyMeteoOperationalQuestion` / `isTonyMeteoQuestion` (2026-05-23) |
| 19.6.6 | Modulo meteo attivo: Firestore tenant **e** `moduli_attivi` inviati dal client (Tony context) | implementato | `resolveMeteoModuleActive` in `meteo-service.js` |
| 19.6.7 | Su **preventivo-form** con `tipo-lavoro` compilato, messaggio **solo data** (es. «mercoledì») → valutazione meteo operativa con morfologia terreno; se sconsigliato → alternative **senza** inject `data-prevista`; conferma data («ok allora facciamo martedì») → Gemini imposta data | implementato | `tryMeteoPreventivoDateQuickReply`, `isTonyPreventivoDateMeteoEval` in `meteo-service.js`; hook in `tonyAsk` prima del meteo operativo generico (2026-05-24) |
| 19.6.8 | Messaggi **scheduling** preventivo (giorni settimana, «ok/allora/facciamo») **non** sono hint terreno; «va bene» dopo disambiguazione conferma scelta | implementato | `messageIsPreventivoScheduleTurn`, `resolvePreventivoTerrenoFromDisambiguationConfirm` in `functions/index.js`; `userMessageIsPreventivoScheduleHint` in `main.js` (2026-05-24) |
| 19.6.9 | Preventivo su colture a **filari** (vite, trebbiano, …): tipo lavoro **Tra le file** + sottocategoria coerente; vietato downgrade a Generale/Trinciatura generica dopo inject o meteo | implementato | `upgradePreventivoLavorazioneFilari` (injector), `upgradePreventivoTipoForFilariCloud` (CF), `tonyStripConflictingPreventivoLavorazione` (widget — 2026-05-24) |
| 19.6.10 | **Crea lavoro — entity-first (Fase 3b performance):** se il messaggio iniziale contiene operaio, trattore, attrezzo, terreno, data e durata **risolvibili** su elenchi tenant → primo `INJECT_FORM_DATA` **completo**; chiedere in chat **solo** ambiguità reale (match multipli/zero). Vietato chiedere «A chi lo assegno?» se operaio già detto e match univoco; vietato elencare trattori se nome utente matcha **un solo** mezzo. Follow-up: patch campi mancanti, non re-inject totale. Baseline campo: `PLAN_OTTIMIZZAZIONE_PERFORMANCE.md` §1.3 (2026-05-25) | **implementato** | CF: `tony-lavoro-entity-parser.js` + patchOnly + gating proattivo. **Client follow-up trattore (2026-05-25):** disamb. + risposta breve senza CF — §14.4. Sottocategoria da coltura terreno — §14.5 |
| 19.6.11 | **Binario B deterministico (Fase 4 performance):** navigazione (`APRI_PAGINA`), `FILTER_TABLE` / `SUM_COLUMN` su richieste ovvie con `page.currentTableData.pageType` noto, `RIASSUNTO` da summary tabella o briefing — **senza Gemini**; moduli dedicati CF (`tony-nav-quick-reply.js`, `tony-filter-table-quick-reply.js`) + gate `tony-module-gate`; in dubbio → Gemini. Invalidazione `tonyContextCache` su write magazzino/conto terzi/guasti (trigger Firestore). Multi-blocco: meteo+scorte+scadenze se tutti i blocchi colpiscono (`tony-multi-block-quick-reply.js`). Offline coda ore: **deferred** | **implementato** | Deploy produzione 2026-06-03; canary E2E + `npm run tony:perf-review`. Vedi `PLAN_OTTIMIZZAZIONE_PERFORMANCE.md` §9 Fase 4 |
| 19.6.12 | **Estensione nav binario B residua:** ~3 frasi da log produzione ancora su Gemini; gap `NAV_TARGET_RULES` (manodopera, oliveto, sinonimi verbi). Incrementale, non refactor | HANDOFF_CONTINUITA_PERFORMANCE_NAV §Priorità 1 | **da fare** | `npm run tony:perf-review`; test `tony-nav-quick-reply.test.js` |
| 19.6.13 | **Metriche client intercept 0 CF** (`tony_local_intercept`): ore, lavori, save locale non visibili in log `[Tony Perf]` | HANDOFF_CONTINUITA_PERFORMANCE_NAV §Priorità 2 | **da fare** | Contatore leggero in `core/js/tony/main.js` |
| 19.6.14 | **Meteo typo giorno** (`mercoldì` → operativo) + test ancorati `2026-05-21` | meteo-service 2026-06-10 | **implementato** | `tests/meteo-tony-quick-reply.test.js` 47/47; deploy CF se non in prod |

### 19.8 Flusso valutazione data «dopo la pioggia» (riferimento prodotto)

Per ogni **giorno candidato posticipato** (scansione cronologica dopo il giorno scartato), Tony esegue `evaluateGiornoOperativoCompleto` fino al primo giorno accettabile.

| Asse | Cosa valuta | Trattamento | Lavorazione terreno (`lavoroCampo`) |
|------|-------------|-------------|-------------------------------------|
| **A** | Meteo **del giorno candidato** | pop, mm, vento ≤ 15 km/h | pop, mm (**no vento**) |
| **B** | **Somma mm previsti** in lookback sul candidato | D + D−1 (montagna + D−2) vs tabella §19.4 | Idem |
| **B bis** | **Giorni asciutti** dopo ultimo episodio piovoso significativo | Non applicato | 2 gg (collina/montagna), 1 gg (pianura) |

**Esempio collina — giovedì 10 mm, poi venerdì/sabato/domenica asciutti:**

| Candidato | Asse A | Asse B (lookback ven+dom) | Asse B bis (gg asciutti) | Esito |
|-----------|--------|---------------------------|--------------------------|-------|
| Venerdì | ok | ok | 0 (< 2) | ❌ |
| Sabato | ok | ok | 1 (< 2) | ❌ |
| Domenica | ok | ok | 2 | ✅ prima data «dopo» proponibile |

**Nota:** l'Asse B **non** somma la pioggia di giovedì quando valuta domenica (lookback = solo ven+dom). L'Asse B bis copre il tempo di asciugatura dopo l'ultimo giorno bagnato.

Richiesta esplicita «data **dopo il** N» → solo scansione posticipata (singola), non doppia alternativa.

### 19.9 Doppia alternativa (UX — 2026-05-22)

| # | Decisione | Stato | Note |
|---|-----------|-------|------|
| 19.9.1 | Dopo «no» a praticabilità o «cerca un'altra data», Tony propone **sempre due opzioni** se entrambe esistono nel forecast | implementato | Evita che Tony scelga arbitrariamente anticipare vs posticipare |
| 19.9.2 | **Prima:** prima data utile **subito prima** del giorno scartato (più vicina possibile) | implementato | `findFirstGiornoOperativoOkNear(..., 'before')` |
| 19.9.3 | **Dopo:** prima data utile **subito dopo** che supera A + B (+ B bis se lavorazione) | implementato | `findFirstGiornoOperativoOkNear(..., 'after')` |
| 19.9.4 | Se una sola opzione esiste, Tony la propone da sola e lo indica nel testo | implementato | |
| 19.9.5 | Giorni esclusi in chat («il 25 non posso») restano esclusi anche nelle due proposte | implementato | `collectExcludedDtsFromHistory` in `buildDualAlternativaOperativaReply` |
| 19.9.6 | «Sì» a «Vuoi che cerchi un'altra data?» **non** deve attivare briefing dashboard | implementato | `tonyIsPendingMeteoInterviewReply` in `core/js/tony/main.js` |
| 19.9.7 | «Sì» / «ok» attivano RIASSUNTO **solo** se l'ultimo messaggio Tony offre il riassunto («vuoi che ti faccia un riassunto») | implementato | `tonyLastTonyMessageOfferedRiassunto` + `tonyWantsDashboardRiassunto` — 2026-06-09g |
| 19.9.8 | «Ok grazie» / «perfetto grazie» **non** devono attivare RIASSUNTO né CF — chiusura locale | implementato | `checkFarewellIntent` + `tonyDeliverDashboardRiassunto` — 2026-06-09g |

### 19.10 Dashboard — voce e briefing (2026-06-09)

| # | Decisione | Stato | Note |
|---|-----------|-------|------|
| 19.10.1 | Saluto proattivo dashboard anche se scorte/scadenze/guasti = 0 (meteo + invito riassunto) | implementato | `checkGlobalStatus` ramo `total===0` — build `2026-06-09g` |
| 19.10.2 | RIASSUNTO vocale/chat = criticità ops (**nomi** prodotti sotto scorta, guasti, scadenze mezzi) + `weatherSummary` + alert pioggia | implementato | `dashboard-tony-briefing-text.js`, snapshot `summary*`; `buildDashboardRiassuntoText`; `loadTonyMeteoBriefingData` — **2026-06-15** nomi client |
| 19.10.3 | Domanda meteo su dashboard (es. «Com'è il meteo domani») → risposta locale cache, distinta dal RIASSUNTO | implementato | Log client `[Tony] Meteo dashboard: risposta locale` |
| 19.10.4 | Briefing iniziale ~3 s dopo `checkGlobalStatus`; interazione mic prima del saluto può saltarlo (`barge_in_mic`) | implementato | Comportamento atteso, non bug |
| 19.10.5 | Mobile/PWA: saluto proattivo dashboard in **chat** (TTS autoplay disattivato); pannello Tony si apre automaticamente | implementato | `tonyDashboardPreferChatBriefing`, `__tonyOpenChatPanel`, `openPanel` su `__tonyDisplayProactive` — 2026-06-15 |
| 19.10.6 | Messaggio proattivo `_displayOnly` in `chatHistory` così «sì» al riassunto funziona dopo il saluto | implementato | `sendMessage` proactive path — 2026-06-15 |

### 19.7 Implementazione (riferimento — 2026-05-22)

| Componente | Stato |
|------------|--------|
| `functions/tony-meteo-rules.js` | ✅ Asse A/B/B bis, lookback, asciugatura, `evaluateGiornoOperativoCompleto`, `lavoroCampo` |
| `functions/meteo-service.js` | ✅ quick reply, morfologia, doppia alternativa, **`resolveMeteoModuleActive`**, pattern **trinciare**, guard crea-lavoro, **`tryMeteoPreventivoDateQuickReply`** (data su preventivo-form — 2026-05-24) |
| `functions/tony-quick-replies.js` | ✅ `isTonyOperationalCreationIntent`, skip quick reply su write/crea lavoro/preventivo (typo preventio — 2026-05-24) |
| `functions/tony-intent-router.js` | ✅ Router Fase 2b (binario/tier, tier enforcement) |
| `functions/tony-nav-quick-reply.js` | ✅ Fase 4 — APRI_PAGINA, RIASSUNTO |
| `functions/tony-filter-table-quick-reply.js` | ✅ Fase 4 — FILTER_TABLE, SUM_COLUMN |
| `functions/tony-multi-block-quick-reply.js` | ✅ Fase 4 — multi-blocco meteo/scorte/scadenze |
| `functions/tony-context-cache.js` | ✅ Cache T4 + **`invalidateTonyContextCache`** (Fase 4.1) |
| `functions/tony-module-gate.js` | ✅ Gate moduli tenant (quick reply, APRI_PAGINA, ctx.azienda) |
| `functions/tony-module-recommendations.js` | ✅ **Consigliere moduli+bundle Tony Guida (Base)** — segnali, complementi, bundle hints, stacking, gemelli (2026-06-19, **2026-06-20**) |
| `core/js/tony/voice.js` | ✅ TTS pipeline — Chirp 3, **speakingRate 1.05**, callable cached, dedup, warm typing, **`__tonyTtsCanary()`** (2026-06-19) |
| `core/js/tony/stream-tts-chunk.js` | ✅ **`speakTextInSentenceChunks`** — TTS a frasi su risposte complete (2026-06-19) |
| `core/js/tony/main.js` | ✅ «sì» nel filo meteo non rubato al briefing; **voce dashboard 2026-06-09g:** RIASSUNTO client, meteo locale, addio locale, mic/TTS; **2026-06-15:** pannello chat mobile su proattivo, `chatHistory` su `_displayOnly`; skip proattivo se CF già chiede; **preventivo:** strip downgrade filari, hint terreno vs scheduling (2026-05-24) |
| `core/js/tony/meteo-dashboard-quick-reply*.js` | ✅ Meteo + RIASSUNTO dashboard client-side; **`formatDashboardOpsBriefingText`**; test Vitest (**8**) — 2026-06-09 / **2026-06-15** |
| `core/js/dashboard-tony-briefing-text.js` | ✅ Summary testuali prodotti sotto scorta, guasti aperti, scadenze mezzi urgenti — 2026-06-15 |
| `core/js/dashboard-counts-snapshot.js` | ✅ Calcolo `summarySottoScorta` / `summaryGuasti` / `summaryScadenze` al load; **`awaitDashboardCountsSnapshot`** per Tony — 2026-06-15 |
| `core/js/dashboard-meteo-briefing.js` | ✅ `weatherSummary` in briefing; saluto senza criticità ops — 2026-06-09g |
| Form terreno | ✅ `terreno-tipo-campo` |
| Context Builder | ✅ `tipoCampo` su `azienda.terreni` e `meteo.terreni[]` |
| Tony | ✅ Domanda morfologia; praticabilità; **due date prima/dopo** |
| Test | ✅ … **`tests/tony-module-recommendations.test.js` (9)**, **`tests/tony-tts-latency-canary.test.js` (5)**, **`tests/tony-voice-transcript-punctuation.test.js` (4)**, `tests/tony-stream-tts-chunk.test.js`, `tests/tony-voice-pipeline-canary.test.js` |
| Review log produzione | ✅ `scripts/tony-perf-log-review.mjs` — smoke 8 scenari router + **3 binario B quick**. Produzione 2026-06-03: ~25% `usedGemini=false`, hit nav/filter/riassunto |

---

*Inventario creato per la Fase 1 del consolidamento documentazione Tony. Da revisionare prima di procedere con il consolidamento.*
