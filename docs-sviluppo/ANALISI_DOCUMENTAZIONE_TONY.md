# Analisi documentazione Tony – Lettura completa e raccomandazioni

**Data analisi**: 2026-03-08  
**Obiettivo**: Capire cosa tenere, cosa consolidare, cosa archiviare per evitare confusione e perdita di rotta.

---

## 1. Inventario documenti Tony

| Documento | Righe | Data | Scopo | Riferimenti incrociati |
|-----------|-------|------|-------|------------------------|
| **MASTER_PLAN_TONY_UNIVERSAL.md** | ~270 | 2026-03-02 | Visione, principi, roadmap, fasi | Riferimento da regola PROJECT GUARDIAN |
| **STATO_TONY_2026-03-08.md** | ~220 | 2026-03-08 | Stato attuale, checklist, backlog | Riferisce MASTER_PLAN, CHECKLIST, GUIDA |
| **CHECKLIST_TONY.md** | ~185 | 2026-03-08 | Checklist operativa dettagliata | Riferisce GUIDA_SVILUPPO_TONY |
| **GUIDA_SVILUPPO_TONY.md** | ~315 | 2026-03-02 | Guida sviluppo, architettura, implementazione | Riferita da CHECKLIST |
| **TONY_FUNZIONI_E_SOLUZIONI_TECNICHE.md** | ~372 | — | Sintesi per review/miglioramenti | Pensato per incollare in Gemini |
| **TONY_COMPILAZIONE_ATTIVITA_IMPLEMENTAZIONE.md** | ~259 | Marzo 2026 | Flusso tecnico form attività | Riferimento per estensione form |
| **TONY_COMPILAZIONE_LAVORI_2026-02.md** | — | 2026-02-16 | Flusso form Lavori | Riferimento |
| **TONY_SVILUPPO_2026-03_VIGNETO_E_COMPILAZIONE.md** | ~175 | 2026-03-02 | Fix sessione marzo (sottocategoria, salvataggio) | Storico fix |
| **TONY_FLUSSO_COMPILAZIONE_ATTIVITA_INVERSO.md** | ~556 | — | Design flusso bottom-up (tipo → categoria) | Design decision |
| **TONY_DA_IMPLEMENTARE_POST_GEMINI.md** | ~240 | 2026-02-06 | Backlog post-Gemini | Molte voci già implementate |
| **ANALISI_SUBAGENT_MASTER_PLAN.md** | ~220 | 2026-02-28 | Censimento subagent, proposta integrazione | Priorità azioni |
| **CONTEXT_BUILDER_SPECIFICHE_SVILUPPO.md** | ~302 | 2026-03-02 | Specifiche Context Builder | Riferito da .cursor/rules |
| **TONY_MODULO_SEPARATO.md** | ~443 | — | Proposta Guida/Operativo, Freemium | Proposta architetturale |
| **GUIDA_TONY_OPERATIVO_ARCHITETTURA_GLOBALE.md** | ~256 | — | Principi architettura form Tony Operativo | Vincoli architetturali |
| **COSA_ABBIAMO_FATTO.md** | ~3100+ | 2026-03-08 | Changelog generale (sezioni Tony) | Storico |
| **DOBBIAMO_ANCORA_FARE.md** | ~85 | 2026-02-27 | Backlog app (sezione Tony) | Parzialmente obsoleto |
| **RIEPILOGO_CURRENTTABLEDATA_PER_MODULO_LISTE.md** | ~206 | 2026-02-27 | Pattern currentTableData per Tony | Riferimento tecnico |
| **INVENTARIO_APP_FORM_TABELLE_SEZIONI_GRAFICI.md** | — | — | Inventario (menziona Tony) | Riferimento app |

---

## 2. Sovrapposizioni e conflitti

### 2.1 Stato / Checklist (triplo overlap)
- **STATO_TONY**, **CHECKLIST_TONY**, **MASTER_PLAN** (tabella fasi) descrivono lo stesso stato con livelli diversi.
- **STATO_TONY** dice "injectTerrenoForm mancante" ma **ANALISI_SUBAGENT** dice che terreno usa OPEN_MODAL+fields (non injector) → **conflitto**.
- **DOBBIAMO_ANCORA_FARE** dice "attivita da dotare" per currentTableData ma **attivita-controller.js** già popola currentTableData → **obsoleto**.

### 2.2 Architettura (documenti multipli)
- **GUIDA_SVILUPPO_TONY**: architettura, pattern, dove vive il codice.
- **TONY_FUNZIONI_E_SOLUZIONI_TECNICHE**: stessa cosa, formato "per review".
- **GUIDA_TONY_OPERATIVO_ARCHITETTURA_GLOBALE**: principi form, vincoli.
- **TONY_MODULO_SEPARATO**: proposta Guida/Operativo/Freemium.
- Contenuti sovrapposti, nessuno è la fonte unica.

### 2.3 Compilazione form (3 documenti)
- **TONY_COMPILAZIONE_ATTIVITA_IMPLEMENTAZIONE**: flusso end-to-end attività.
- **TONY_COMPILAZIONE_LAVORI_2026-02**: stesso per lavori.
- **TONY_FLUSSO_COMPILAZIONE_ATTIVITA_INVERSO**: design bottom-up.
- Sono complementari, ma il terzo potrebbe essere integrato nel primo.

### 2.4 Backlog (3 fonti)
- **TONY_DA_IMPLEMENTARE_POST_GEMINI**: molte voci già fatte (askStream, TTS, compilazione Lavori).
- **ANALISI_SUBAGENT_MASTER_PLAN** §7: priorità diverse (FORM PRONTO, guard, INJECT segnala-guasto).
- **STATO_TONY** / **DOBBIAMO_ANCORA_FARE**: altre voci.
- Nessuna lista unica e aggiornata.

---

## 3. Documenti obsoleti o fuorvianti

| Documento | Problema |
|-----------|----------|
| **DOBBIAMO_ANCORA_FARE** (sez. Tony) | Dice "attivita da dotare" per currentTableData → **già implementato** in attivita-controller.js |
| **STATO_TONY** | "injectTerrenoForm mancante" → terreno usa OPEN_MODAL+fields, non INJECT_FORM_DATA |
| **TONY_DA_IMPLEMENTARE_POST_GEMINI** | askStream, TTS, compilazione Lavori, ecc. già implementati → **parzialmente obsoleto** |
| **RIEPILOGO_CURRENTTABLEDATA** | Dice "attivita da dotare" → **obsoleto** |

---

## 4. Documenti ancora validi e utili

| Documento | Perché tenerlo |
|-----------|----------------|
| **MASTER_PLAN_TONY_UNIVERSAL** | Fonte unica visione/principi, usato nelle regole |
| **CONTEXT_BUILDER_SPECIFICHE** | Specifiche tecniche, usato da .cursor/rules |
| **TONY_COMPILAZIONE_ATTIVITA_IMPLEMENTAZIONE** | Riferimento tecnico per form attività |
| **TONY_COMPILAZIONE_LAVORI_2026-02** | Riferimento per form lavori |
| **ANALISI_SUBAGENT_MASTER_PLAN** | Priorità azioni, proposta FORM PRONTO |
| **RIEPILOGO_CURRENTTABLEDATA** | Pattern tecnico (da aggiornare su attivita) |

---

## 5. Raccomandazione: struttura `tony/`

### 5.1 I 3 documenti principali (sempre aggiornati)

| File | Contenuto | Deriva da |
|------|-----------|-----------|
| **tony/README.md** | Punto ingresso, ordine lettura, link | Nuovo |
| **tony/MASTER_PLAN.md** | Visione, principi, roadmap | MASTER_PLAN_TONY_UNIVERSAL (sposta) |
| **tony/STATO_ATTUALE.md** | Stato unico, checklist essenziale, backlog | Unione STATO_TONY + CHECKLIST + backlog, **verificato sul codice** |

### 5.2 Sottocartella `tony/specifiche/` (riferimento tecnico)

| File | Contenuto |
|------|-----------|
| **CONTEXT_BUILDER_SPECIFICHE.md** | Sposta da docs-sviluppo (aggiorna path in .cursor/rules) |
| **COMPILAZIONE_ATTIVITA.md** | TONY_COMPILAZIONE_ATTIVITA_IMPLEMENTAZIONE |
| **COMPILAZIONE_LAVORI.md** | TONY_COMPILAZIONE_LAVORI_2026-02 |
| **PATTERN_CURRENTTABLEDATA.md** | RIEPILOGO_CURRENTTABLEDATA (aggiornato: attivita già dotata) |

### 5.3 Sottocartella `tony/storico/` (archivio, non aggiornare)

| File | Nota |
|------|------|
| COSA_ABBIAMO_FATTO_TONY.md | Estratto sezioni Tony da COSA_ABBIAMO_FATTO |
| TONY_SVILUPPO_2026-03_VIGNETO_E_COMPILAZIONE.md | Fix sessione marzo |
| TONY_DA_IMPLEMENTARE_POST_GEMINI.md | Storico backlog (molte voci fatte) |
| TONY_FLUSSO_COMPILAZIONE_ATTIVITA_INVERSO.md | Design decision |
| TONY_MODULO_SEPARATO.md | Proposta architetturale |
| GUIDA_TONY_OPERATIVO_ARCHITETTURA_GLOBALE.md | Principi form |

### 5.4 Da valutare (consolidare o archiviare)

| Documento | Azione proposta |
|-----------|-----------------|
| **GUIDA_SVILUPPO_TONY** | Consolidare parti utili in README + STATO_ATTUALE; resto in storico |
| **TONY_FUNZIONI_E_SOLUZIONI_TECNICHE** | Storico (sintesi per review) |
| **ANALISI_SUBAGENT_MASTER_PLAN** | specifiche/ (priorità azioni) o integrare in STATO_ATTUALE backlog |
| **CHECKLIST_TONY** | Unire in STATO_ATTUALE, poi eliminare |

---

## 6. Regola operativa post-consolidamento

> **Quando modifichi Tony**: aggiorna **solo** `tony/STATO_ATTUALE.md` (sezione rilevante + data ultimo aggiornamento).

- MASTER_PLAN: solo quando cambiano visione/principi/roadmap.
- specifiche/: solo quando cambiano le specifiche tecniche.
- storico/: non aggiornare.

---

## 7. Correzioni da applicare a STATO_ATTUALE (verifica codice)

Prima di consolidare, correggere:

1. **terreno-form**: Non "injectTerrenoForm mancante". Terreno usa OPEN_MODAL terreno-modal + fields. Vedi ANALISI_SUBAGENT §3.2.
2. **currentTableData attivita**: Già implementato in attivita-controller.js (righe 1345-1356). Non "da dotare".
3. **FILTER_TABLE attivita**: Include origine (2026-03-08). CHECKLIST già aggiornato.
4. **summarySottoScorta**: Opzionale in Context Builder. Prodotti raw già in ctx.azienda.

---

## 8. Strade abbandonate vs utile allo sviluppo

### 8.1 File con strade abbandonate (da non tenere come riferimento)

| Documento | Strada abbandonata | Perché |
|-----------|--------------------|--------|
| **TONY_MODULO_SEPARATO.md** | `modules/tony/` (tony-dashboard, tony-advanced-service) | Tony resta in `core/`, non c’è `modules/tony/`. La parte Guida/Operativo è implementata, ma la struttura modulo proposta no. |
| **TONY_DA_IMPLEMENTARE_POST_GEMINI.md** | Backlog come riferimento | Molte voci già fatte; mescola fatto/non fatto. Confonde. |
| **DOBBIAMO_ANCORA_FARE** (sez. Tony) | "attivita da dotare" currentTableData | Già implementato. Info sbagliata. |
| **RIEPILOGO_CURRENTTABLEDATA** | "attivita da dotare" | Stesso errore. |

### 8.2 File utili allo sviluppo (tenere)

| Documento | Perché è utile |
|-----------|----------------|
| **MASTER_PLAN_TONY_UNIVERSAL** | Visione, principi, roadmap. Riferimento regole. |
| **CONTEXT_BUILDER_SPECIFICHE** | Specifiche tecniche Context Builder. Usato da .cursor. |
| **TONY_COMPILAZIONE_ATTIVITA_IMPLEMENTAZIONE** | Flusso form attività, file coinvolti, come estendere. |
| **TONY_COMPILAZIONE_LAVORI_2026-02** | Stesso per form Lavori. |
| **GUIDA_TONY_OPERATIVO_ARCHITETTURA_GLOBALE** | Principi form (visibleWhen, dependsOn, saveGuard) → usati in tony-form-schemas.js. |
| **ANALISI_SUBAGENT_MASTER_PLAN** | Censimento subagent, priorità (FORM PRONTO, guard). |
| **TONY_SVILUPPO_2026-03_VIGNETO_E_COMPILAZIONE** | Fix marzo: problemi risolti, modifiche. Utile per capire decisioni. |
| **TONY_FLUSSO_COMPILAZIONE_ATTIVITA_INVERSO** | Design bottom-up (tipo → categoria). Spiega deriveCategoriaFromTipo. |

### 8.3 Da valutare

| Documento | Nota |
|-----------|------|
| **GUIDA_SVILUPPO_TONY** | Alcuni riferimenti obsoleti (es. "modules/tony/ in futuro"). Parti ancora valide. Consolidare o depurare. |
| **TONY_FUNZIONI_E_SOLUZIONI_TECNICHE** | Sintesi tecnica. Alcune parti datate. Utile per review, non come guida quotidiana. |
| **CHECKLIST_TONY** | Contenuto utile, ma va unito a STATO_ATTUALE. |
| **STATO_TONY** | Contenuto utile, ma con errori (injectTerrenoForm). Correggere e unire. |

---

## 9. Prossimo passo

1. Creare `docs-sviluppo/tony/` con README, MASTER_PLAN, STATO_ATTUALE.
2. Scrivere STATO_ATTUALE unificando STATO_TONY + CHECKLIST + backlog, **con le correzioni sopra**.
3. Spostare in `tony/specifiche/` solo i file **utili**: CONTEXT_BUILDER, COMPILAZIONE_ATTIVITA, COMPILAZIONE_LAVORI, ARCHITETTURA_GLOBALE (o parti), PATTERN_CURRENTTABLEDATA (corretto).
4. Spostare in `tony/storico/` (o eliminare): TONY_MODULO_SEPARATO, TONY_DA_IMPLEMENTARE.
5. Aggiornare RIEPILOGO_CURRENTTABLEDATA: attivita già dotata.
6. Aggiornare .cursor/rules e PROJECT GUARDIAN con i nuovi path.
