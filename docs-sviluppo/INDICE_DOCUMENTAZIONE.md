# Indice documentazione sviluppo

**Aggiornato:** 2026-09-21

## Onboarding (leggere per primi)

| Documento | Scopo |
|-----------|--------|
| [LEGGIMI_PRIMA.md](LEGGIMI_PRIMA.md) | Quick start nuove conversazioni |
| [STATO_PROGETTO_COMPLETO.md](STATO_PROGETTO_COMPLETO.md) | Stato generale app e moduli |
| [ARCHITETTURA_MODULI_E_INTERAZIONI.md](ARCHITETTURA_MODULI_E_INTERAZIONI.md) | Moduli, servizi, interazioni |
| [DOBBIAMO_ANCORA_FARE.md](DOBBIAMO_ANCORA_FARE.md) | Backlog unificato attivo |
| [COSA_ABBIAMO_FATTO.md](COSA_ABBIAMO_FATTO.md) | Changelog cronologico |

## Tony (assistente IA)

| Documento | Scopo |
|-----------|--------|
| [tony/README.md](tony/README.md) | Hub Tony |
| [tony/MASTER_PLAN.md](tony/MASTER_PLAN.md) | Visione e roadmap |
| [tony/STATO_ATTUALE.md](tony/STATO_ATTUALE.md) | Stato verificato sul codice |
| [TONY_DECISIONI_E_REQUISITI.md](TONY_DECISIONI_E_REQUISITI.md) | Registro decisioni |
| [GUIDA_SVILUPPO_TONY.md](GUIDA_SVILUPPO_TONY.md) | Guida sviluppo |
| [CONTEXT_BUILDER_SPECIFICHE_SVILUPPO.md](CONTEXT_BUILDER_SPECIFICHE_SVILUPPO.md) | Context Builder cloud |
| [RIEPILOGO_CURRENTTABLEDATA_PER_MODULO_LISTE.md](RIEPILOGO_CURRENTTABLEDATA_PER_MODULO_LISTE.md) | Pattern liste Tony |

## Tre cartelle di classificazione

| Cartella | Contenuto |
|----------|-----------|
| **[obsoleto/](obsoleto/README.md)** | Doc sostituiti, log sessione, analisi superate — **non usare per decisioni** |
| **[in-sviluppo/](in-sviluppo/README.md)** | Lavoro parziale attivo (Tony perf, billing v2, vendemmia meccanica, E2E…) |
| **[da-fare/](da-fare/README.md)** | Piani validi non ancora implementati (campo mobile, offline, lancio, demo tenant, Tony Occhi, snellimento…). Lazy Tony ✅ 2026-09-05 |

## Operativo

| Documento | Scopo |
|-----------|--------|
| [DEPLOY_RUNBOOK.md](DEPLOY_RUNBOOK.md) | Deploy Firebase/hosting/functions |
| [SICUREZZA_FLUSSI.md](SICUREZZA_FLUSSI.md) | Perimetro sicurezza |
| [GUIDA_CONFIGURAZIONE_FIREBASE.md](GUIDA_CONFIGURAZIONE_FIREBASE.md) | Setup Firebase |
| [LINEA_GUIDA_RESPONSIVE_STANDALONE.md](LINEA_GUIDA_RESPONSIVE_STANDALONE.md) | Pagine standalone |
| [simulator/GFV_FARM_SIMULATOR.md](simulator/GFV_FARM_SIMULATOR.md) | Simulatore farm + CI |

## Moduli implementati (riferimento)

Piani completati — codice in `modules/` e `core/`:

- `PLAN_CORE_BASE.md`, `PLAN_MODULO_VIGNETO_DETTAGLIATO.md`, `PLAN_MODULO_FRUTTETO_DETTAGLIATO.md`
- `PLAN_MODULO_CONTO_TERZI.md`, `PLAN_MODULI_INTERCONNESSI.md`
- `manodopera/PLAN_HUB_MODULO_MANODOPERA.md`, `dashboard/PLAN_PERFORMANCE_DASHBOARD.md`

## Snapshot e inventario (foto, non stato operativo)

| Documento | Scopo |
|-----------|--------|
| [VALUTAZIONE_APP_2026-09-12.md](VALUTAZIONE_APP_2026-09-12.md) | Valutazione prodotto/sicurezza al 12 settembre 2026 |
| [CERCHI_APERTI_2026-09-01.md](CERCHI_APERTI_2026-09-01.md) | Inventario cerchi aperti al 1 settembre 2026 (poi chiusi in parte: inviti, magazzino, delete lavori) |
| [PROGETTO_APP_SNAPSHOT_2026-09-05.md](PROGETTO_APP_SNAPSHOT_2026-09-05.md) | Specifica tecnica dump 5 settembre — non è la fonte di verità |

## Spot / Higgsfield (progetto aperto)

| Documento | Scopo |
|-----------|--------|
| [COPIONE_PRIMO_SPOT_SOCIAL.md](COPIONE_PRIMO_SPOT_SOCIAL.md) | Linea A — spot brand (laptop + retino) |
| [COPIONE_SPOT_FLUSSI_APP.md](COPIONE_SPOT_FLUSSI_APP.md) | Linea B — serie feature (guasto, zona lavorata) |
| [PIANO_VIDEO_PRESENTAZIONE_PROF_E_RIUSO_COMMERCIALE.md](PIANO_VIDEO_PRESENTAZIONE_PROF_E_RIUSO_COMMERCIALE.md) | Direzione video e riuso commerciale |
| [VIDEO_STORYBOARD_SCRIPT_E_CLIP.md](VIDEO_STORYBOARD_SCRIPT_E_CLIP.md) | Storyboard, script, lista clip |
| [VIDEO_BRIEF_GEMINI_PERSONAGGI.md](VIDEO_BRIEF_GEMINI_PERSONAGGI.md) | Brief personaggi Linea A (non usare per Linea B) |
| [`workspace/README.md`](../workspace/README.md) | Output Higgsfield in locale (gitignored) |

## Guide utente (mirror)

- Sviluppo: [GUIDA/](GUIDA/README.md)
- Mirror deploy: `core/GUIDA/`
- Utenti finali: `documentazione-utente/`
