# Stato attuale Tony – Verificato sul codice

**Data**: 2026-03-18  
**Fonte**: codice + `TONY_DECISIONI_E_REQUISITI.md`

---

## 1. Riepilogo esecutivo

| Fase | Nome | Stato | Criterio done |
|------|------|-------|---------------|
| **1** | Consolidamento fondamenti | ⏳ Parziale | Tony aggiunge terreno senza guidare passo-passo |
| **2** | Navigazione cross-page | ✅ Completata | "Ho trinciato 6 ore" → attivita-modal; "Crea lavoro erpicatura nel Sangiovese" → lavoro-modal (2026-03-08) |
| **3** | Context Builder e dati aziendali | ✅ In corso | summaryScadenze ok; summarySottoScorta opzionale |
| **4** | Iniezione universale | ✅ In corso | Attività, Lavori (entry point da ovunque 2026-03-08), Terreno (OPEN_MODAL+fields) |
| **5** | Grafici e report | ⏳ Parziale | APRI_PAGINA statistiche; MOSTRA_GRAFICO da fare |
| **6** | Proattività e memoria | ⏳ Parziale | Dashboard + Guasti ok; "Ho notato X" da fare |

---

## 2. Componenti verificati

| Componente | File | Stato |
|------------|------|-------|
| Tony Service | `core/services/tony-service.js` | ✅ ask, askStream, setContext |
| Cloud Function tonyAsk | `functions/index.js` | ✅ buildContextAzienda, SYSTEM_INSTRUCTION_BASE/ADVANCED; prompt Lavori: form già aperto → no open_modal/no re-inject (ask con formData vuoto); no "Quale attrezzo?" se in formSummary ✓ o unico; trattore+attrezzo unico in un colpo (2026-03-14) |
| Form Mapping | `core/config/tony-form-mapping.js` | ✅ ATTIVITA, LAVORO, TERRENO |
| Form Injector | `core/js/tony-form-injector.js` | ✅ attivita-form, lavoro-form; lavoro-form: ordine terreno→cat→sottocat→tipo, waitForSelectOptions, match terreno per nome, deriveParentsFromTipoLavoro con terreno (2026-03-08) |
| Smart Form Filler | `core/js/tony-smart-filler.js` | ✅ deriveCategoriaFromTipo, sottocategoria |
| Widget | `core/js/tony/main.js` | ✅ processTonyCommand, OPEN_MODAL, SET_FIELD, INJECT_FORM_DATA; getCurrentFormContext con requiredEmpty; generateFormSummary senza ✓ su placeholder; muto timer proattivo durante INJECT (__tonyInjectionInProgress) (2026-03-14) |

---

## 3. Context Builder (ctx.azienda)

| Dato | Stato |
|------|-------|
| terreni, terreniClienti, clienti, preventivi, **tariffe** (id, tipoLavoro, coltura, categoriaColturaId, tipoCampo, tariffaBase, coefficiente, attiva – "quante tariffe?", "quanto costa X nel Y in Z?"; fallback coltura non in lista → tariffa generica categoria – 2026-03-18), poderi, colture (nome, categoriaId), categorie, tipiLavoro | ✅ |
| macchine, trattori, attrezzi (cavalli, cavalliMinimiRichiesti) | ✅ |
| prodotti (giacenza, sogliaMinima) | ✅ |
| guastiAperti | ✅ |
| summaryScadenze | ✅ |
| summarySottoScorta | ❌ Pianificato (prodotti raw già presenti) |

---

## 4. Comandi gestiti

| Comando | Stato |
|---------|-------|
| APRI_PAGINA | ✅ |
| OPEN_MODAL (attivita-modal, lavoro-modal, terreno-modal) | ✅ |
| SET_FIELD | ✅ (SmartFormFiller, fallback navigazione se modal assente) |
| INJECT_FORM_DATA | ✅ attivita-form, lavoro-form |
| SAVE_ACTIVITY | ✅ (saveGuard, fallback) |
| CLICK_BUTTON | ✅ |
| FILTER_TABLE | ✅ terreni, attivita, lavori (stato, progresso, caposquadra, terreno, tipo, tipoLavoro, operaio), **clienti** (stato, ricerca testuale, reset), **preventivi** (stato, cliente, categoriaLavoro, tipoLavoro, categoriaColtura, ricerca, reset), **tariffe** (tipoLavoro, coltura, tipoCampo, attiva, reset – 2026-03-18) |
| SUM_COLUMN | ✅ terreni |
| RIASSUNTO (tonyGlobalBriefing) | ✅ |
| MOSTRA_GRAFICO | ❌ Da fare |

---

## 5. currentTableData

| Pagina | pageType | Stato |
|--------|----------|-------|
| terreni | terreni | ✅ |
| attivita | attivita | ✅ (attivita-controller.js 1345-1356) |
| gestione lavori | lavori | ✅ (gestione-lavori-controller.js renderLavori; items: tipoLavoro, operaio) |
| macchine | macchine | ✅ |
| prodotti | prodotti | ✅ |
| movimenti | movimenti | ✅ |
| trattori, attrezzi, flotta, scadenze, guasti | trattori, attrezzi, flotta, scadenze, guasti | ✅ |
| **clienti** (Conto terzi) | **clienti** | ✅ (clienti-standalone.html renderClienti; 2026-03-18) |
| **preventivi** (Conto terzi) | **preventivi** | ✅ (preventivi-standalone.html renderPreventivi; 2026-03-18; verificato in uso) |
| **tariffe** (Conto terzi) | **tariffe** | ✅ (tariffe-standalone.html renderTariffe; 2026-03-18) |

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
| summarySottoScorta in ctx.azienda | Media | Opzionale, prodotti raw già presenti |
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
