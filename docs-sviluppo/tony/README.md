# Tony – Documentazione consolidata

**Cartella**: `docs-sviluppo/tony/`  
**Ultimo aggiornamento**: 2026-04-05

Tony è l'assistente IA centrale di GFV Platform. Questa cartella contiene la documentazione consolidata per riferimento rapido e sviluppo.

---

## Documenti in questa cartella

| File | Contenuto |
|------|-----------|
| **MASTER_PLAN.md** | Visione, architettura, roadmap, principi di scalabilità. Ogni modifica Tony deve allinearsi a questo piano. |
| **STATO_ATTUALE.md** | Stato verificato sul codice: cosa funziona, cosa manca, prossimi passi. |
| **README.md** | Questo file – panoramica e link. |

---

## Dove trovare cosa

| Argomento | Dove |
|-----------|------|
| **Decisioni e requisiti** | `docs-sviluppo/TONY_DECISIONI_E_REQUISITI.md` – inventario completo con fonte e stato |
| **Guida sviluppo** | `docs-sviluppo/GUIDA_SVILUPPO_TONY.md` – flussi tecnici, file coinvolti |
| **Context Builder** | `docs-sviluppo/CONTEXT_BUILDER_SPECIFICHE_SVILUPPO.md` – struttura ctx.azienda |
| **currentTableData + FILTER_TABLE** | `docs-sviluppo/RIEPILOGO_CURRENTTABLEDATA_PER_MODULO_LISTE.md` – pattern per tabelle, keyToId, estensione |
| **Changelog** | `docs-sviluppo/COSA_ABBIAMO_FATTO.md` – modifiche con date |
| **Trattamenti Vigneto/Frutteto** (performance lista, superficie da anagrafe terreno; non Tony) | `COSA_ABBIAMO_FATTO.md` §2026-04-05; guide `docs-sviluppo/guida-app/moduli/vigneto.md` e `frutteto.md` |
| **Magazzino – roadmap ipotesi (Gemini/fotocamera, DDT/fattura)** | `docs-sviluppo/magazzino/ROADMAP_ACQUISIZIONE_DOCUMENTI_GEMINI.md` |
| **Archivio** | `docs-sviluppo/archivio/` – doc obsoleti (MASTER_PLAN_TONY_UNIVERSAL, STATO_TONY) |

---

## File chiave nel codice

| Ruolo | Path |
|-------|------|
| Widget + comandi | `core/js/tony/main.js` |
| Cloud Function | `functions/index.js` (tonyAsk, buildContextAzienda) |
| Form mapping | `core/config/tony-form-mapping.js` |
| Form injector | `core/js/tony-form-injector.js` |
| Service | `core/services/tony-service.js` |

---

## Regole Cursor (.cursor/rules)

- **project-guardian-tony.mdc** – PROJECT GUARDIAN con riferimento a `tony/MASTER_PLAN.md`
- **tony-agent-onboarding.mdc** – istruzioni lettura doc e aggiornamento post-lavoro
- **tony-context-builder.mdc** – riferimento Context Builder

Se hai PROJECT GUARDIAN nelle regole utente di Cursor, aggiorna il path a `docs-sviluppo/tony/MASTER_PLAN.md`.

---

## Regola d'oro

Ogni modifica a Tony deve:
1. Allinearsi al **MASTER_PLAN.md**
2. Favorire scalabilità (configurazione > codice)
3. Non introdurre logica specifica per un solo modulo senza ragione documentata
