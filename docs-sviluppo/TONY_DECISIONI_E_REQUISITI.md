# Tony – Inventario decisioni e requisiti

**Data estrazione**: 2026-03-08  
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

---

## 4. Form e compilazione

| # | Decisione | Fonte | Stato | Note |
|---|-----------|-------|-------|------|
| 4.1 | Form Attività: INJECT_FORM_DATA, deriveCategoriaFromTipo, override Generale→Tra le File su vigneto/frutteto | TONY_COMPILAZIONE, TONY_SVILUPPO_2026-03 | implementato | |
| 4.2 | Form Lavori: INJECT_FORM_DATA, sottocategoria Tra le File, disambiguazione erpicatura/trinciatura | TONY_COMPILAZIONE_LAVORI | implementato | |
| 4.3 | **Terreno-form**: OPEN_MODAL terreno-modal + fields, NON injectTerrenoForm | ANALISI_SUBAGENT §3.2 | implementato | main.js supporta terreno-modal |
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

---

## 7. Comandi e azioni

| # | Decisione | Fonte | Stato | Note |
|---|-----------|-------|-------|------|
| 7.1 | APRI_PAGINA, OPEN_MODAL, SET_FIELD, INJECT_FORM_DATA, SAVE_ACTIVITY, CLICK_BUTTON | Vari | implementato | |
| 7.2 | FILTER_TABLE: terreni (podere, categoria, coltura, possesso, alert) | functions, main.js | implementato | |
| 7.3 | FILTER_TABLE attivita: terreno, tipoLavoro, coltura, origine, data, dataDa, dataA, ricerca | functions, main.js | implementato | 2026-03-08 |
| 7.3a | FILTER_TABLE lavori: stato, progresso, caposquadra, terreno, tipo, tipoLavoro, operaio. Match tipo lavoro: case-insensitive, nomi parziali, risoluzione tipoLavoroId (applyFilters riceve tipiLavoroList) | functions, main.js, gestione-lavori-events | implementato | 2026-03-08 |
| 7.4 | SUM_COLUMN per terreni | functions, main.js | implementato | |
| 7.5 | RIASSUNTO (tonyGlobalBriefing) | main.js | implementato | |
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
| 10.1 | TTS cloud (getTonyAudio), voce it-IT-Wavenet-D | TONY_DA_IMPLEMENTARE, functions | implementato | |
| 10.2 | askStream per streaming risposta | TONY_DA_IMPLEMENTARE | implementato | |
| 10.3 | Pulizia testo per TTS (no markdown, emoji, JSON) | TONY_DA_IMPLEMENTARE | implementato | |
| 10.4 | Modalità continua, barge-in, congedo vocale | TONY_FUNZIONI | implementato | |

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

*Inventario creato per la Fase 1 del consolidamento documentazione Tony. Da revisionare prima di procedere con il consolidamento.*
