# Stato attuale Tony – Verificato sul codice

**Data**: 2026-04-11  
**Fonte**: codice + `TONY_DECISIONI_E_REQUISITI.md` (ultima verifica incrociata codice-doc: stessa data)  
**Sicurezza (link pubblici, Firestore, callable)**: `docs-sviluppo/SICUREZZA_FLUSSI.md`

---

## 1. Riepilogo esecutivo

| Fase | Nome | Stato | Criterio done |
|------|------|-------|---------------|
| **1** | Consolidamento fondamenti | ⏳ Parziale | Tony aggiunge terreno senza guidare passo-passo |
| **2** | Navigazione cross-page | ✅ Completata | "Ho trinciato 6 ore" → attivita-modal; "Crea lavoro erpicatura nel Sangiovese" → lavoro-modal (2026-03-08) |
| **3** | Context Builder e dati aziendali | ✅ In corso | summaryScadenze ok; **movimentiRecenti** (ultimi 50) + summary in ctx da qualsiasi pagina; summarySottoScorta opzionale |
| **4** | Iniezione universale | ✅ In corso | Attività, Lavori (entry point da ovunque 2026-03-08), Terreno (OPEN_MODAL+fields), **Nuovo Preventivo** (preventivo-form, 2026-03-24); magazzino prodotto/movimento (mapping+injector); **form-trattamento** concimazioni/trattamenti campo (righe prodotto+dosaggio, **checkbox** scarico/anagrafe/prosegue; **anagrafe** da messaggio utente + sync ha dopo inject — 2026-04-11; modal aperto — 2026-04-09) |
| **5** | Grafici e report | ⏳ Parziale | APRI_PAGINA statistiche; MOSTRA_GRAFICO da fare |
| **6** | Proattività e memoria | ⏳ Parziale | Dashboard + Guasti ok; magazzino liste/form con proattività parziale (timer, interview, conferma salvataggio); "Ho notato X" da fare |

---

## 2. Componenti verificati

| Componente | File | Stato |
|------------|------|-------|
| Tony Service | `core/services/tony-service.js` | ✅ **`historyUserMessage`** su ask/askStream: testo utente in `chatHistory` / `tony_last_user_message` separato dal `message` inviato al modello (augment client Gestione Lavori — 2026-04-08); ask salva `tony_last_user_message` in sessionStorage all’inizio del turno utente (2026-03-27, cross-page preventivo); ask, askStream, setContext; blocco ```json → INJECT_FORM_DATA; routing preventivo anche senza `cliente-id` nel payload se pagina/contesto preventivo e chiavi campo coerenti; alias data `attivita-data` / `dataPrevista` / `data_prevista` → `data-prevista` su Nuovo Preventivo (2026-03-24); **`skipUserHistory`** su ask/askStream (turno utente omesso in `chatHistory` per messaggi proattivi); flag **`proactive`** su ask/askStream: non eseguire `SAVE_ACTIVITY` se il prompt è solo la verifica «Form completo, confermi salvataggio?» (2026-04-02); guard magazzino: `SAVE_ACTIVITY` solo se messaggio utente = conferma esplicita salvataggio (2026-04-02); return dopo INJECT callable |
| Cloud Function **sendTransactionalEmail** | `functions/index.js` + `functions/email-resend.js` | ✅ Invio **inviti** e **preventivi** via **Resend** (mittente `no-reply@globalfarmview.net`), auth + ruolo manager/admin sul tenant; segreto `RESEND_API_KEY`; client `preventivi-standalone` / `gestisci-utenti-standalone` (2026-04-10). **Link registrazione negli inviti**: `APP_BASE_URL` in `gestisci-utenti-standalone` → GitHub Pages finché l’ERP non è su `globalfarmview.net` (solo landing lì). |
| Cloud Function tonyAsk | `functions/index.js` | ✅ buildContextAzienda (preventivi con **tipoLavoro, coltura** per lista); **PREVENTIVO_LIST_ACTION** invio email / accetta manager + risoluzione deterministica; SYSTEM_INSTRUCTION_BASE/ADVANCED; **ENTRY POINT NUOVO PREVENTIVO** da qualsiasi pagina parallelo a crea lavoro; distinzione esplicita preventivo vs diario vs lavori; **diario vs form-trattamento** (2026-04-09): eccezione regola DIARIO se modal concimazioni/trattamenti in campo; Treasure Map trattamento anche senza `form.formId` se path registro + messaggio prodotti/quantità (esclusi filtri lista); **canone dosaggio kg/ha** come trattamenti, enrich da ql/kg→dosaggio se mancante; **`sanitizeTrattamentoCampoSensitiveFlags`** (2026-04-11): anagrafe/scarico magazzino solo su esplicito o conferma dopo domanda Tony; **`resolveTrattamentoFlagsFromFollowUp`** (2026-04-11): «ok salva» / «sì salva» / «conferma salvataggio» → non contano come solo conferma flag, così `action: save` non viene bloccato e il client riceve **SAVE_ACTIVITY**; Treasure Map: intent preventivo esteso, **priorità istruzione Preventivo > Lavori > Attività**; fallback APRI_PAGINA nuovo preventivo se retry senza fields (2026-03-27); prompt Lavori: form già aperto → no open_modal/no re-inject (ask con formData vuoto); no "Quale attrezzo?" se in formSummary ✓ o unico; trattore+attrezzo unico in un colpo (2026-03-14); **Treasure Map Nuovo Preventivo** + routing fill_form → preventivo-form (cliente-id + campi preventivo); **apri_pagina** / **APRI_PAGINA** + formData → client con pending preventivo (2026-03-24); **SYSTEM_INSTRUCTION_PREVENTIVO: terreno-id quando terreno noto** (2026-03-24); **save** non emesso se messaggio = promemoria proattivo «Form completo, confermi salvataggio?» (2026-03-24); **retry Gemini 429/5xx con backoff**, guardrail su `terreno-id` non verificabile nel contesto cliente, fallback sintetico `INJECT_FORM_DATA preventivo-form` quando Treasure Map non produce comando, arricchimento automatico `formData` preventivo per campi mancanti (cliente/tipo/terreno) con match fuzzy e token parziali/radice lessicale (es. albicocchi→albicocche) + hint testuale in caso ambiguo, **arricchimento preventivo esteso anche ai campi di `OPEN_MODAL` / `APRI_PAGINA` (pending-after-nav)** per evitare inject parziale cross-page senza `terreno-id`; policy anti-selezione errata su ambiguità multi-terreno: fallback automatico solo quando il cliente ha un terreno univoco (nessuna scelta forzata su 2+ candidati); **guardrail `enrichPreventivoCommandFormData` (2026-03-27)**: se il cliente ha **2+ terreni** e il messaggio **non contiene il nome normalizzato** del terreno scelto dal modello, `terreno-id` viene rimosso; **`buildPreventivoOpenModalFields`** (2026-03-27) evita il merge `{ ...inferred, ...enriched }` che reintroduceva `terreno-id` dopo il guardrail; **path legacy** `OPEN_MODAL` preventivo: stesso enrich/guardrail prima del return; testo risposta neutro se il terreno è stato rimosso per ambiguità; guardrail `data-prevista` solo con data esplicitata dall’utente (2026-03-26); **PREVENTIVO_STRUCTURED: non chiedere superficie nello stesso turno di terreno-id** (2026-03-27); **FILTRO TABELLA PRODOTTI / MOVIMENTI** + eccezioni navigazione + `filterReminder` pagine magazzino (2026-04-02); **regola 5d** form magazzino già aperti (summary/requiredEmpty, SAVE su conferma — 2026-04-02); **regola 0b** prompt proattivo verifica modulo ≠ conferma SAVE (2026-04-02) |
| Form Mapping | `core/config/tony-form-mapping.js` | ✅ ATTIVITA, LAVORO, TERRENO, **PREVENTIVO** (preventivo-form / system instruction structured), **PRODOTTO / MOVIMENTO** magazzino (`prodotto-form`, `movimento-form`, 2026-04-02); **`tonyInterviewFieldIds`** per domande oltre i required HTML (2026-04-02); **prodotto**: `prodottoCategoriaRichiedeGiorniCarenza` (allowlist fitofarmaci) per `interviewEmpty` carenza (2026-04-02); **policy `LAVORAZIONI_DEFAULTS_TONY`** per default meccanico/campi macchina/copertura da terreno (2026-04-08) |
| Nuovo Preventivo (tariffe) | `modules/conto-terzi/views/nuovo-preventivo-standalone.html` | ✅ `calcolaTotale`: match tipo lavoro tollerante (strip **meccanico**, prefisso + tipo tariffa più lungo) oltre a coltura/tipo campo/categoria generica (2026-03-27) |
| Form Injector | `core/js/tony-form-injector.js` | ✅ attivita-form, lavoro-form, **preventivo-form** (`waitForPreventivoPageDataReady`, `awaitPreventivoTerreniFetchDone`, pre-sync cliente+terreno, ordine inject aggiornato **cliente → terreno → lavorazione**, **terreno-id**: hint coltura/nome → id + **`coercePreventivoTerrenoSelectToDomOption`** (parità Gestione Lavori: match su campi terreno/coltura e coercion al value option reale) e resolver preventivo con match elastico token/fuzzy su alias campi coltura; se match parziale univoco auto-seleziona, se ambiguo richiede disambiguazione utente con elenco candidati; fallback su option DOM (unico terreno auto, multipli disambiguazione) + log diagnostici `value::text`; regola filari estesa alle colture frutteto/arboree (es. Albicocche => **Tra le File**); `colturePerCategoriaPreventivo`, wait value solo se id documento, `selectedIndex` fallback; **tipo-lavoro** fuzzy con `n.length >= 3` per `search.indexOf(n)`; 2026-03-26); **preventivo `lavoro-sottocategoria`**: dopo `waitForSelectOptions(2)`, se payload è id Firestore → `waitForSelectOptionValue` fino a 12s (race popolamento dopo categoria — 2026-03-27); lavoro-form: ordine terreno→cat→sottocat→tipo (2026-03-08); **policy lavorazioni 2026-04-08**: default meccanico su intenti tipici, copertura forzata da terreno (seminativo=Generale, filari=Tra le File/Sulla Fila), auto-selezione trattore/attrezzo solo con candidato univoco; **disambiguazione macchine 2026-04-08**: più trattori o più attrezzi compatibili → evento `tony-macchine-disambiguation` (chat + TTS da `main.js`), niente prima opzione arbitraria sul diario attività; se **`lavoro-attrezzo` / `attivita-attrezzo`** è risolto senza ambiguità, la scelta trattore usa **`cavalli` ≥ `cavalliMinimiRichiesti`** (lista filtrata; 0 candidati → messaggio dedicato); **magazzino** `injectProdottoForm` / `injectMovimentoForm` + `resolveValueMagazzino` (2026-04-02); **`form-trattamento`**: `setInputValue` per **checkbox** (`checked` + eventi — 2026-04-09); post-inject **`syncSuperficieAnagrafeAfterTonyInject`** se `trattamento-superficie-anagrafe` (2026-04-11); standalone: `TONY_FORM_MAPPING` via **`tony-widget-standalone.js`** → `tony-form-mapping.js` prima di injector (2026-04-02) |
| Smart Form Filler | `core/js/tony-smart-filler.js` | ✅ deriveCategoriaFromTipo, sottocategoria; **`validateBeforeSave`**: risoluzione submit preferendo `button[type="submit"]` nel form (evita `.btn-primary` tipo «Traccia» prima del Salva su form-trattamento — 2026-04-11) |
| Voice / TTS | `core/js/tony/voice.js` | ✅ `expandSpokenUnitsForItalianTTS` in `pulisciTestoPerVoce`: quintali, litri, **ettari** (pattern «numero ha»), kg, g, hl, mq/m²/m2, m3/mc, ml — vale per **tutto** il testo Tony inviato a TTS, non per singola pagina (2026-04-11) |
| Widget | `core/js/tony/main.js` | ✅ **SAVE_ACTIVITY** + `modal-trattamento`: solo `tonyCheckFormCompletenessSafe` + submit `#form-trattamento` (2026-04-11); processTonyCommand, OPEN_MODAL, SET_FIELD, INJECT_FORM_DATA (normalizza `fields` / `fieldValues` → `formData` — 2026-04-02); **`window.__tonyGetCurrentFormContext`** per timer proattivi da `processTonyCommand` (scope); OPEN_MODAL magazzino senza `fields` → timer come post-inject (2026-04-02); **OPEN_MODAL `attivita-modal` / `lavoro-modal` assenti dal DOM + `fields` preventivo** → `APRI_PAGINA` Nuovo Preventivo (non Diario / non Gestione Lavori — 2026-03-27); **OPEN_MODAL `attivita-modal` ignorato se `#modal-trattamento` attivo** (2026-04-09); helper distingue `lavoro-categoria-principale`/`lavoro-sottocategoria` (preventivo) da altri `lavoro-*` (modal lavori); **onAction INJECT preventivo**: coda con `delayMs: 0` se `#preventivo-form` già nel DOM (2026-03-24); coerce INJECT attivita→preventivo se opportuno; **coerce INJECT attivita→preventivo anche cross-page (prima del controllo DOM)** per avviare APRI_PAGINA + pending intent quando il form non è presente (2026-03-26); alias data → `data-prevista` su `#preventivo-form`; **SAVE_ACTIVITY** su `#preventivo-form`: validazione `checkFormCompleteness` + submit (non SmartFormFiller/modal); **pending dopo nav** preventivo (path tolleranti + polling); **APRI_PAGINA**: inferenza `preventivo-form` da target **anche senza** `fields` / `_tonyPendingModal` (cross-page CF solo navigazione — 2026-03-27); stesso salvataggio in `processTonyCommand` APRI_PAGINA; **onComplete** passa `_tonyPendingModal` / `_tonyPendingFields` se presenti; **APRI_PAGINA** + `fields` → inferenza `_tonyPendingModal` nuovo preventivo; OPEN_MODAL alias `preventivo`; **skipUserHistory** su ask proattivo (2026-03-24); **timer proattivo preventivo**: messaggio mirato se manca `data-prevista` (2026-03-24); **dopo inject preventivo senza `terreno-id`**: messaggio disambiguazione **breve** («Dobbiamo lavorare su A o B?» fino a 5 terreni) + **TTS** via `Tony.speak`; elenco **filtrato** da hint (ultimo messaggio utente + campi testuali formData; fallback elenco completo se nessun match); ramo `__tonyPreventivoTerrenoDisambiguation` allineato (2026-03-27); **`tonyStripConflictingPreventivoLavorazione`** + **`tonyIsPreventivoTipoLavoroUnset`**: strip solo se `#tipo-lavoro` ha value reale (non placeholder `-- Seleziona…`); post-nav enrich usa anche `tonyGetUserPromptForPendingNav()` se intent/sessionStorage senza prompt (2026-03-27); getCurrentFormContext; fallback contesto da `#modal-trattamento` / `#form-trattamento` (2026-04-09); `buildTonyFormContext` campi id `trattamento-*` in rilevanza (2026-04-09); `__tonyBuildTonyFormContext`; muto timer durante INJECT; pending nav preventivo (2026-03-24); **FILTER_TABLE** prodotti/movimenti + path `pageType`; dispatch `change` su `#filter-categoria` per prodotti (non escluso come per terreni — 2026-04-02); **OPEN_MODAL / INJECT / pending** `prodotto-modal` · `movimento-modal` / `prodotto-form` · `movimento-form` (2026-04-02); **post-inject proattivo** `prodotto-form` / `movimento-form` (merge contesto come attività, `POST_INJECT_CHECK_DELAY_MS` + `IDLE_REMINDER_MS`, conferma salvataggio o campi mancanti); **post-inject `form-trattamento`**: timer proattivo disattivato (2026-04-11, evitare secondo round CF durante domanda anagrafe/scarico); **post-SET_FIELD** debounce proattivo magazzino (`prodotto-` / `mov-`) + messaggio salvataggio coerente (path prodotti/movimenti, `onComplete` — 2026-04-02); **fallback onComplete → SAVE_ACTIVITY** anche per magazzino se testo «salvato» e required ok (2026-04-02); **listener `tony-macchine-disambiguation`** (2026-04-08): elenco trattori/attrezzi → messaggio chat + TTS; **Gestione Lavori (2026-04-08)**: `tonyUserMentionedLavoroAssignee`, `tonySanitizeLavoroOperaioQuestionInReply`, timer proattivo lavoro con skip se assegnatario o macchine già nel messaggio utente |

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

---

## 4. Comandi gestiti

| Comando | Stato |
|---------|-------|
| APRI_PAGINA | ✅ |
| OPEN_MODAL (attivita-modal, lavoro-modal, terreno-modal, **prodotto-modal**, **movimento-modal**, **preventivo-form** → pagina / inject) | ✅ |
| SET_FIELD | ✅ (SmartFormFiller, fallback navigazione se modal assente; prefissi **prodotto-** / **mov-** → modal magazzino – 2026-04-02) |
| INJECT_FORM_DATA | ✅ attivita-form, lavoro-form, **preventivo-form**, **prodotto-form**, **movimento-form** (2026-04-02), **form-trattamento** (checkbox opzionali — 2026-04-09) |
| SAVE_ACTIVITY | ✅ (saveGuard, fallback) |
| CLICK_BUTTON | ✅ |
| FILTER_TABLE | ✅ terreni, attivita, lavori (stato, progresso, caposquadra, terreno, tipo, tipoLavoro, operaio), **clienti** (stato, ricerca testuale, reset), **preventivi** (stato, cliente, categoriaLavoro, tipoLavoro, categoriaColtura, ricerca, reset), **terreniClienti** (cliente, reset – 2026-03-23), **tariffe** (tipoLavoro, coltura, tipoCampo, attiva, reset – 2026-03-18), **prodotti** (attivo, categoria con normalizzazione sinonimi es. concime→fertilizzanti, ricerca, reset – 2026-04-02), **movimenti** (tipo, prodotto, reset – 2026-04-02), **concimazioni_vigneto** / **concimazioni_frutteto** (vigneto o frutteto, anno, reset – 2026-04-07), **tracciabilita_consumi** (categoria, **terreno**, vista, reset – 2026-04-07) |
| **PREVENTIVO_LIST_ACTION** | ✅ **invia** (email da lista) / **accetta_manager** — `preventivi-standalone.html` + CF risoluzione + disambiguazione tipo lavoro / numero (2026-04-02) |
| SUM_COLUMN | ✅ terreni |
| RIASSUNTO (tonyGlobalBriefing) | ✅ |
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
| summarySottoScorta in ctx.azienda | — | Implementato (2026-04-11); deploy `functions` necessario |
| Tony assente in freemium | Bassa | Se si vuole nascondere widget in plan free |
| segnala-guasto-form, macchina-form INJECT | Bassa | Subagent Meccanico |
| MOSTRA_GRAFICO | Bassa | |
| Proattività "Ho notato X, vuoi che...?" | Media | Fase 6 |
| Memoria storica (confronti anno/anno) | Bassa | |

---

## 8. Regole operative

- Ogni modifica Tony deve allinearsi al **MASTER_PLAN.md**
- Non toccare Tony Guida durante lavori su Operativo
- Non introdurre logica hardcoded per singolo modal
- Nuovo form = voce in TONY_FORM_MAPPING, non if/else

---

## 9. Riferimento incrociato (moduli non Tony)

Lo stato delle **fasi e dei componenti Tony** in questo file non è cambiato rispetto alla verifica precedente. Per modifiche di codice su **trattamenti Vigneto/Frutteto** (ottimizzazione caricamento liste, flag **superficie da anagrafe terreno**, documentazione utente/sviluppo aggiornata) vedi **`docs-sviluppo/COSA_ABBIAMO_FATTO.md`** (voce **2026-04-05**).

