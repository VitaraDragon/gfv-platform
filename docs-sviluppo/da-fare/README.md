# Documentazione da fare

**Aggiornato:** 2026-09-22

Specifiche e proposte **non ancora implementate** (o solo in parte) ma **ancora compatibili** con la direzione del progetto (`tony/MASTER_PLAN.md`, `ARCHITETTURA_MODULI_E_INTERAZIONI.md`).

## Backlog unificato

Vedi anche **`DOBBIAMO_ANCORA_FARE.md`** (root `docs-sviluppo/`) per sicurezza, snellimento codice, currentTableData residui, test.

## Contenuto

| Cartella / file | Descrizione |
|-----------------|-------------|
| `demo/` | Tenant **AZIENDA DEMO GFV** in produzione (seed, switcher, reset) — `PIANO_TENANT_DEMO_PRODUZIONE.md` |
| `magazzino/` | Tony Occhi – acquisizione documenti (Gemini/fotocamera) |
| `lavori/` | Scalabilità lista lavori (`PLAN_SCALABILITA_LISTA_LAVORI.md`) — **non** tracking GPS trail (scartato → `obsoleto/strategie-superate/ROADMAP_TRACKING_GPS_AREA_LAVORATA.md`) |
| `tony/` | Sostituzione manodopera / equipaggio su lavori (design; **vista impegni giornalieri ✅ 2026-07-24** — restano roster completo, Context Builder shortlist, …). **Agenti erranti / auto-correzione** (design 2026-09-14): `PIANO_AGENTI_ERRANTI_AUTO_CORREZIONE_TONY.md` |
| `manodopera/` | **Campo mobile unico + lingue operaio/caposquadra** (deciso, non implementato — 2026-09-19): `PIANO_CAMPO_MOBILE_MULTILINGUA.md`. Registro Tony §24 |
| `dashboard/` | **Telefono manager** (bozza aperta — 2026-09-19): `PIANO_MOBILE_MANAGER.md`. Non mescolare col piano campo. Registro Tony §25 |
| `ui/` | **Pelle Proposta su tutta l’app** (2026-09-22): `PIANO_PELLE_PROPOSTA_SU_APP.md`. Flag Prova/Pubblicata, rollback obbligatorio. Registro Tony §26. Non mescolare col piano campo né col piano telefono manager |
| `offline/` | **Campo senza segnale** (perimetro chiuso, codice no — 2026-09-14): `PIANO_OFFLINE_CAMPO.md` |
| `lancio/` | **Lancio legale e produzione** (2026-09-08): `PIANO_LANCIO_LEGALE_E_PRODUZIONE.md` — Iubenda, Stripe live, checkbox privacy |
| `notifiche/` | Push ciclo lavoro (spec 2026-08-25) + linea guida assenze/WhatsApp (2026-07-29). Catalogo: `core/config/notification-catalog.js` |
| `snellimento/` | Bootstrap unico, utils condivise, CSS liste. **Lazy load Tony ✅ 2026-09-05**. **Standalone produzione + wrapper path + CSS liste + log debug `__TONY_DEBUG` ✅ 2026-09-19** (pagine di prova ancora aperte) |
| `frutteto/` | Parametri e scarto statistiche frutteto |
| `guida-app/` | Assistente knowledge base guida-app |
| `vigneto/` | Potatura/trattamenti da lavori; reti antigrandine |

## Non compatibile → obsoleto

Se una voce qui viene scartata dal team, spostarla in `obsoleto/` con nota nel README.

- **Proposta confine da tap** (ex `terreni/`) — no-go SAM/macchie 2026-09-05 → `obsoleto/strategie-superate/PIANO_PROPOSTA_CONFINE_TAP.md`. **1b fatta** (disegno a mano più veloce, Terreni + terreni clienti CT). Harness SAM: `core/dev/obsoleto/proposta-confine/`.
