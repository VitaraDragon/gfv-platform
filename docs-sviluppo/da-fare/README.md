# Documentazione da fare

**Aggiornato:** 2026-09-05

Specifiche e proposte **non ancora implementate** (o solo in parte) ma **ancora compatibili** con la direzione del progetto (`tony/MASTER_PLAN.md`, `ARCHITETTURA_MODULI_E_INTERAZIONI.md`).

## Backlog unificato

Vedi anche **`DOBBIAMO_ANCORA_FARE.md`** (root `docs-sviluppo/`) per sicurezza, snellimento codice, currentTableData residui, test.

## Contenuto

| Cartella / file | Descrizione |
|-----------------|-------------|
| `demo/` | Tenant **AZIENDA DEMO GFV** in produzione (seed, switcher, reset) — `PIANO_TENANT_DEMO_PRODUZIONE.md` |
| `magazzino/` | Tony Occhi – acquisizione documenti (Gemini/fotocamera) |
| `lavori/` | Scalabilità lista lavori (`PLAN_SCALABILITA_LISTA_LAVORI.md`) — **non** tracking GPS trail (scartato → `obsoleto/strategie-superate/ROADMAP_TRACKING_GPS_AREA_LAVORATA.md`) |
| `tony/` | Sostituzione manodopera / equipaggio su lavori (design; **vista impegni giornalieri ✅ 2026-07-24** — restano roster completo, Context Builder shortlist, …) |
| `notifiche/` | Push ciclo lavoro (spec 2026-08-25) + linea guida assenze/WhatsApp (2026-07-29). Catalogo: `core/config/notification-catalog.js` |
| `snellimento/` | Bootstrap unico, utils condivise, CSS liste. **Lazy load Tony ✅ 2026-09-05** (resto della proposta ancora aperto) |
| `frutteto/` | Parametri e scarto statistiche frutteto |
| `guida-app/` | Assistente knowledge base guida-app |
| `vigneto/` | Potatura/trattamenti da lavori; reti antigrandine |
| `terreni/` | Proposta confine da tap in mappa (`PIANO_PROPOSTA_CONFINE_TAP.md`) — design 2026-08-28, **non implementato**; Fase 0 pilota prima del codice |

## Non compatibile → obsoleto

Se una voce qui viene scartata dal team, spostarla in `obsoleto/` con nota nel README.
