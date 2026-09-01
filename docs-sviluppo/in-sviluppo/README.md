# Documentazione in sviluppo

**Aggiornato:** 2026-09-01 (verifica codice — `docs-sviluppo/CERCHI_APERTI_2026-09-01.md`)

Piani e handoff per funzionalità **parzialmente implementate** o **lavoro attivo**. Allineati a `tony/MASTER_PLAN.md` e `STATO_PROGETTO_COMPLETO.md`.

## Contenuto

| Cartella / file | Stato nel codice (2026-09-01) |
|-----------------|------------------|
| `tony/` | Performance Fase 0–4 in codice; nav manodopera in B ✅; restano frasi da log, oliveto/VM/report, metriche intercept |
| `abbonamento/` | Stripe Fase 1 ✅ (cancel/reactivate/webhook); Fasi 2–4 billing v2 (coterm, bundle, portal) **da fare** |
| `abbonamento-ui/` | Piano gen-2026 **obsoleto** (spostato). Puntatore a Billing v2 |
| `meteo/` | Fasi 0–5 ✅; **fase 6 Tony implementata** (praticabilità, asciugatura, doppia alternativa) |
| `simulator/` | M-T4/M-T5 ✅; **M-T6** aperto |
| `vendemmia-meccanica/` | UI + servizi core ✅; Tony parziale (piano + calcoli); tariffe/bilancio/nav/form mapping aperti |
| `colture-specializzate/` | Vigneto/Frutteto ✅; Oliveto **da avviare** (nessuna cartella `modules/oliveto/`) |
| `report/` | Terreni + export Vigneto reali; altre card “In sviluppo”; `MOSTRA_GRAFICO` assente |
| `calcolo-materiali/` | Solo Vigneto in codice; condiviso V/F/Oliveto ancora aperto |
| `subagent-master-plan/` | Census azioni Master Plan |

Tony Occhi (Fase 0–3 + archivio) vive in `da-fare/magazzino/` come roadmap residua, ma **non è da avviare**: è in sviluppo.

## Prima di modificare il codice

1. Leggere il piano in questa cartella
2. Verificare `tony/STATO_ATTUALE.md` e `CERCHI_APERTI_2026-09-01.md`
3. Aggiornare `COSA_ABBIAMO_FATTO.md` a lavoro concluso
