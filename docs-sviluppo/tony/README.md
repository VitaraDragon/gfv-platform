# Tony – Documentazione consolidata

**Cartella**: `docs-sviluppo/tony/`  
**Ultimo aggiornamento**: 2026-06-10

Tony è l'assistente IA centrale di GFV Platform. Questa cartella contiene la documentazione consolidata per riferimento rapido e sviluppo.

---

## Documenti in questa cartella

| File | Contenuto |
|------|-----------|
| **MASTER_PLAN.md** | Visione, architettura, roadmap, principi di scalabilità. Ogni modifica Tony deve allinearsi a questo piano. |
| **STATO_ATTUALE.md** | Stato verificato sul codice: cosa funziona, cosa manca, prossimi passi. |
| **PIANO_SOSTITUZIONE_MANODOPERA_SQUADRE.md** | Design (non ancora implementato): sostituzioni operai, equipaggio minimo, shortlist, policy tenant, Tony. Da leggere prima di lavorare su manodopera/squadre/lavori. |
| **PLAN_OTTIMIZZAZIONE_PERFORMANCE.md** | Piano performance Tony (rev. 3, 2026-05-24): Fase 0–2b implementate; tier enforcement + meteo preventivo-data; validazione produzione pending; Fase 3 streaming/form. |
| **HANDOFF_CONTINUITA_PERFORMANCE_NAV.md** | **Handoff agenti** (2026-06-10): dove eravamo / siamo / arriviamo — nav quick reply, metriche client, perf review, fix meteo; prompt e backlog prioritizzato. |
| **HANDOFF_TTS_CHIRP3.md** | **Handoff voce Tony** (2026-06-10): migrazione Wavenet-D → **Chirp 3 HD** — scelta voce, costi, implementazione `getTonyAudio`, cache client, test, rollback. |
| **PIANO_AUDIO_PIPELINE_BARGEIN.md** | 📋 Piano Fase 1: `clearTonyAudioPipeline` + generation token (prerequisito chunking TTS); specifica per agenti. |
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
| **Manodopera – sostituzioni / equipaggio / shortlist** (design) | `docs-sviluppo/tony/PIANO_SOSTITUZIONE_MANODOPERA_SQUADRE.md` |
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
