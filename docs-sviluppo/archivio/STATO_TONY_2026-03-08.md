> **ARCHIVIATO 2026-03-08** – Sostituito da `docs-sviluppo/tony/STATO_ATTUALE.md`

---

# Stato Sviluppo Tony – Documento di Riferimento

**Data**: 8 marzo 2026  
**Versione**: 1.0  
**Riferimento**: `MASTER_PLAN_TONY_UNIVERSAL.md`, `CHECKLIST_TONY.md`, `GUIDA_SVILUPPO_TONY.md`

---

## 1. Riepilogo esecutivo

Tony è l'assistente IA centrale di GFV Platform. Questo documento descrive lo **stato attuale** dello sviluppo, verificato sul codice e sulla documentazione in data 8 marzo 2026.

| Fase | Nome | Stato | Criterio done |
|------|------|-------|---------------|
| **1** | Consolidamento fondamenti | ⏳ Parziale | Tony aggiunge terreno senza guidare passo-passo |
| **2** | Navigazione cross-page | ✅ Completata | "Ho trinciato 6 ore" da Dashboard → Tony apre modal, compila, chiede campi mancanti |
| **3** | Context Builder e dati aziendali | ✅ In corso | buildContextAzienda attivo; Tony risponde a "Quali scadenze?" / "Come stanno i prodotti?" |
| **4** | Iniezione universale | ✅ In corso | Form Attività e Lavori; terreno-form: mapping presente, injector mancante |
| **5** | Grafici e report | ⏳ Parziale | APRI_PAGINA statistiche; descrizione dati dal contesto |
| **6** | Proattività e memoria | ⏳ Parziale | Proattività: Dashboard + Guasti; Memoria: da fare |

---

## 2. Architettura verificata

### 2.1 Componenti principali

| Componente | File | Stato |
|------------|------|-------|
| **Tony Service** | `core/services/tony-service.js` | ✅ Singleton, init, ask, askStream, setContext, onAction, triggerAction |
| **Cloud Function tonyAsk** | `functions/index.js` | ✅ europe-west1, GEMINI_API_KEY, request.auth |
| **Context Builder** | `functions/index.js` (buildContextAzienda) | ✅ Attivo in tonyAsk prima di Gemini |
| **Widget Tony** | `core/js/tony/main.js`, ui.js, engine.js, voice.js | ✅ FAB, chat, dialog conferma, coda comandi |
| **Form Mapping** | `core/config/tony-form-mapping.js` | ✅ ATTIVITA, LAVORO, TERRENO; TERRENO_SOTTOCATEGORIA_PREFERENCE |
| **Form Injector** | `core/js/tony-form-injector.js` | ✅ injectAttivitaForm, injectLavoroForm; **injectTerrenoForm mancante** |
| **Smart Form Filler** | `core/js/tony-smart-filler.js` | ✅ Dipendenze gerarchiche, getSottocategoriaPreferenceFromColtura |
| **Rotte** | `core/config/tony-routes.json` | ✅ 56 target, `npm run generate:tony-routes` |

### 2.2 Context Builder – Dati in ctx.azienda

Verificato in `functions/index.js` (righe 77-145):

| Dato | Fonte Firestore | Stato |
|------|-----------------|-------|
| terreni | tenants/{id}/terreni | ✅ Con coltura_categoria |
| terreniClienti | (filtrati da terreni) | ✅ |
| clienti | tenants/{id}/clienti | ✅ |
| poderi | tenants/{id}/poderi | ✅ |
| colture | tenants/{id}/colture | ✅ |
| categorie | tenants/{id}/categorie | ✅ |
| tipiLavoro | tenants/{id}/tipiLavoro | ✅ |
| macchine | tenants/{id}/macchine | ✅ |
| trattori | (filtrati da macchine) | ✅ Con cavalli |
| attrezzi | (filtrati da macchine) | ✅ Con cavalliMinimiRichiesti |
| prodotti | tenants/{id}/prodotti | ✅ Con sogliaMinima, giacenza |
| guastiAperti | getGuastiAperti() | ✅ Solo guasti non risolti |
| summaryScadenze | buildSummaryScadenze() | ✅ Affitti + mezzi |
| summarySottoScorta | — | ❌ Non implementato (opzionale) |

### 2.3 Comandi gestiti (processTonyCommand)

| Comando | Stato | Note |
|---------|-------|------|
| APRI_PAGINA / apri_modulo | ✅ | Navigazione con conferma dialog |
| OPEN_MODAL | ✅ | attivita-modal, lavoro-modal, terreno-modal |
| INJECT_FORM_DATA | ✅ | attivita-form, lavoro-form; **terreno-form non gestito** |
| SET_FIELD | ✅ | SmartFormFiller per dipendenze |
| CLICK_BUTTON / SAVE_ACTIVITY | ✅ | Fallback non su domande (fix 2026-03-02) |
| FILTER_TABLE | ✅ | Terreni, Attività (terreno, tipoLavoro, coltura, origine, data) |
| SUM_COLUMN | ✅ | Terreni |
| RIASSUNTO | ✅ | Usa tonyGlobalBriefing |
| MOSTRA_GRAFICO | ❌ | Da fare |
| SEGNA_ATTIVITA, REPORT_GUASTO, ecc. | ❌ | Da fare |

---

## 3. Dettaglio per fase

### Fase 1 – Consolidamento fondamenti ⏳ Parziale

| Voce | Stato | Dettaglio |
|------|-------|-----------|
| TERRENO_FORM_MAP in tony-form-mapping.js | ✅ | Configurazione completa |
| INJECT_FORM_DATA per terreno-form | ❌ | main.js: solo attivita-form e lavoro-form; terreno-form → "formId non supportato" |
| injectTerrenoForm in TonyFormInjector | ❌ | Non esiste |
| Divieto ID Firestore, uso nomi | ✅ | Resolver by_name nei form |
| **Criterio done** | ❌ | Tony non può ancora aggiungere terreno da pagina terreni senza guida |

### Fase 2 – Navigazione cross-page ✅ Completata

| Voce | Stato | Dettaglio |
|------|-------|-----------|
| Entry point da ovunque | ✅ | "ho trinciato 6 ore" da Dashboard funziona |
| Fallback APRI_PAGINA + OPEN_MODAL | ✅ | Se modal assente, naviga poi riprova |
| Routing intent | ✅ | Attività vs lavoro vs terreni vs domanda |
| tony_pending_intent | ✅ | checkTonyPendingAfterNav |
| **Criterio done** | ✅ | Operaio può dire "Ho fatto 8 ore di potatura" da qualsiasi pagina |

### Fase 3 – Context Builder e dati aziendali ✅ In corso

| Voce | Stato | Dettaglio |
|------|-------|-----------|
| buildContextAzienda in CF | ✅ | Promise.allSettled, gestione errori |
| tenantId dal client | ✅ | tony-service.js righe 337-346 |
| ctx.attivita.terreni, colture_con_filari | ✅ | Per regole sottocategoria |
| Tony risponde "Quali scadenze?" | ✅ | summaryScadenze in ctx.azienda |
| Tony risponde "Come stanno i prodotti?" | ✅ | prodotti, guastiAperti in ctx.azienda |
| currentTableData | ⏳ | Terreni, Macchine, Magazzino (prodotti, trattori, guasti); altre pagine da dotare |
| **Criterio done** | ✅ | Tony risponde con dati reali |

### Fase 4 – Iniezione universale ✅ In corso

| Voce | Stato | Dettaglio |
|------|-------|-----------|
| injectAttivitaForm | ✅ | deriveCategoriaFromTipo, override Generale→Tra le File |
| injectLavoroForm | ✅ | deriveParentsFromTipoLavoro, applyAssignmentIntelligence |
| TERRENO_SOTTOCATEGORIA_PREFERENCE | ✅ | Config centralizzata in mapping |
| Hook applyBusinessRules (lavoro-form) | ✅ | autonomo + operatore vuoto → usa operaio |
| injectTerrenoForm | ❌ | Da implementare |
| Altri form (magazzino, guasti) | ❌ | Da fare |
| **Criterio done** | ⏳ | Aggiungere prodotto/cliente richiede ancora lavoro |

### Fase 5 – Grafici e report ⏳ Parziale

| Voce | Stato | Dettaglio |
|------|-------|-----------|
| APRI_PAGINA statistiche | ✅ | Target in TONY_PAGE_MAP |
| Descrizione dati dal contesto | ⏳ | Se dati in ctx |
| MOSTRA_GRAFICO | ❌ | Non implementato |
| **Criterio done** | ⏳ | Parziale |

### Fase 6 – Proattività e memoria ⏳ Parziale

| Voce | Stato | Dettaglio |
|------|-------|-----------|
| **Proattività Dashboard** | ✅ | checkGlobalStatus: dopo 3s Tony.speak se criticità ("Ho controllato la situazione: ci sono alcune cose... Vuoi che ti faccia un riassunto?") |
| **Proattività Guasti** | ✅ | guasti-list: Tony.speak "Ti ricordo che ci sono X guasti aperti..." (dopo 4s) |
| **Comando RIASSUNTO** | ✅ | "riassunto" → formatFriendlyBriefing(sottoScorta, scadenzeUrgenti, guastiAperti) |
| **tonyGlobalBriefing** | ✅ | Dashboard popola sottoScorta, scadenzeUrgenti, guastiAperti |
| **Proattività scadenze/sotto scorta** | ⏳ | Dati in ctx.azienda (reattivo); messaggio proattivo solo via Dashboard briefing |
| **Memoria storica** | ❌ | Confronti anno/anno non implementati |
| **Criterio done** | ⏳ | Proattività parziale; memoria da fare |

---

## 4. Checklist operativa

**Legenda**: `[x]` fatto | `[~]` in corso | `[ ]` da fare

### 4.1 Infrastruttura

| # | Voce | Stato |
|---|------|--------|
| 1 | Firebase 11, firebase-service | [x] |
| 2 | Cloud Function tonyAsk (europe-west1) | [x] |
| 3 | GEMINI_API_KEY configurata | [x] |
| 4 | Client getFunctions(app, 'europe-west1') | [x] |
| 5 | App Check (opzionale) | [ ] |
| 6 | Remote Config per modello (opzionale) | [ ] |

### 4.2 Service e backend

| # | Voce | Stato |
|---|------|--------|
| 7 | Tony Singleton, init, ask, askStream | [x] |
| 8 | setContext, onAction, triggerAction | [x] |
| 9 | buildContextAzienda in tonyAsk | [x] |
| 10 | tenantId passato dal client | [x] |
| 11 | SmartFormValidator (skill CF) | [x] |
| 12 | Sub-agenti (Vignaiolo, Logistico, Meccanico) | [x] |
| 13 | SYSTEM_INSTRUCTION_BASE / ADVANCED | [x] |

### 4.3 Integrazione e UI

| # | Voce | Stato |
|---|------|--------|
| 14 | Tony su tutte le pagine (loader) | [x] |
| 15 | FAB + chat + dialog conferma | [x] |
| 16 | syncTonyModules, auto-discovery moduli | [x] |
| 17 | tony-routes.json, availableRoutes | [x] |
| 18 | Voce: STT, TTS cloud, Push-to-Talk | [x] |
| 19 | Modalità continua, barge-in, congedo | [x] |
| 20 | Cache audio, persistenza sessione | [x] |

### 4.4 Comandi e form

| # | Voce | Stato |
|---|------|--------|
| 21 | APRI_PAGINA, OPEN_MODAL | [x] |
| 22 | INJECT_FORM_DATA attivita-form | [x] |
| 23 | INJECT_FORM_DATA lavoro-form | [x] |
| 24 | INJECT_FORM_DATA terreno-form | [ ] |
| 25 | SET_FIELD, SmartFormFiller | [x] |
| 26 | SAVE_ACTIVITY, CLICK_BUTTON | [x] |
| 27 | FILTER_TABLE, SUM_COLUMN | [x] |
| 28 | RIASSUNTO (comando) | [x] |
| 29 | Override Generale→Tra le File (vigneto/frutteto) | [x] |

### 4.5 Proattività e memoria

| # | Voce | Stato |
|---|------|--------|
| 30 | Briefing proattivo Dashboard (checkGlobalStatus) | [x] |
| 31 | Alert proattivo pagina Guasti | [x] |
| 32 | summaryScadenze in ctx.azienda | [x] |
| 33 | summarySottoScorta in ctx.azienda | [ ] |
| 34 | Memoria: confronti anno/anno | [ ] |
| 35 | "Ho notato X, vuoi che...?" generico | [~] |

### 4.6 Estensioni e miglioramenti

| # | Voce | Stato |
|---|------|--------|
| 36 | injectTerrenoForm + gestione INJECT_FORM_DATA | [ ] |
| 37 | currentTableData su altre pagine lista | [~] |
| 38 | Form magazzino, guasti (INJECT_FORM_DATA) | [ ] |
| 39 | MOSTRA_GRAFICO | [ ] |
| 40 | Leggere injectionOrder da TONY_FORM_MAPPING (injector) | [ ] |

---

## 5. In programma (backlog)

### Priorità alta

1. **injectTerrenoForm**: Implementare in TonyFormInjector e gestire terreno-form in main.js INJECT_FORM_DATA → completa Fase 1.
2. **summarySottoScorta**: Aggiungere in buildContextAzienda (prodotti con giacenza < sogliaMinima).

### Priorità media

3. **currentTableData**: Dotare le pagine lista mancanti (diario attività, gestione lavori, vigneti, clienti, ecc.).
4. **Proattività generica**: Estendere il messaggio proattivo all'avvio anche quando l'utente non è in Dashboard (es. da qualsiasi pagina con moduli attivi).
5. **Refactor injector**: Leggere injectionOrder da TONY_FORM_MAPPING invece di duplicare le costanti.

### Priorità bassa

6. **Memoria storica**: Confronti anno corrente vs precedente (ore, costi, rese) quando i dati sono disponibili.
7. **Form magazzino/guasti**: Estendere INJECT_FORM_DATA.
8. **MOSTRA_GRAFICO**: Comando per descrivere/navigare grafici.
9. **App Check**: Limitare abusi.
10. **Smart Search anagrafiche, Vision (foto bolle/guasti)**: Estensioni future.

---

## 6. File chiave

| Ruolo | File |
|-------|------|
| Master Plan | `docs-sviluppo/MASTER_PLAN_TONY_UNIVERSAL.md` |
| Context Builder spec | `docs-sviluppo/CONTEXT_BUILDER_SPECIFICHE_SVILUPPO.md` |
| Guida sviluppo | `docs-sviluppo/GUIDA_SVILUPPO_TONY.md` |
| Changelog | `docs-sviluppo/COSA_ABBIAMO_FATTO.md` |
| Checklist (dettagliata) | `docs-sviluppo/CHECKLIST_TONY.md` |
| Service | `core/services/tony-service.js` |
| Cloud Function | `functions/index.js` |
| Widget main | `core/js/tony/main.js` |
| Form mapping | `core/config/tony-form-mapping.js` |
| Form injector | `core/js/tony-form-injector.js` |
| Smart filler | `core/js/tony-smart-filler.js` |
| Rotte | `core/config/tony-routes.json` |
| currentTableData | `docs-sviluppo/RIEPILOGO_CURRENTTABLEDATA_PER_MODULO_LISTE.md` |

---

## 7. Regola d'oro

Ogni modifica a Tony deve:
1. Allinearsi al Master Plan
2. Favorire scalabilità (configurazione > codice)
3. Non introdurre patch per singolo modulo senza ragione documentata

---

*Documento creato il 8 marzo 2026. Verificato su codice e documentazione esistenti.*
