# Handoff continuità — Tony performance, nav quick reply, metriche

**Creato:** 2026-06-10  
**Contesto:** conversazione su costi AI, ottimizzazioni già implementate, `tony:perf-review`, fix test meteo, estensione nav binario B.  
**Scopo:** permettere a un **nuovo agente Cursor** (o sviluppatore) di riprendere il lavoro **senza perdere il filo**: passato → presente → obiettivi → come verificare.

---

## Come usare questo documento (prompt per nuovo agente)

Incolla all’inizio della chat:

```
Sto continuando il lavoro Tony su GFV Platform.
Leggi OBBLIGATORIAMENTE, in ordine:
1. docs-sviluppo/tony/README.md
2. docs-sviluppo/tony/MASTER_PLAN.md
3. docs-sviluppo/tony/STATO_ATTUALE.md
4. docs-sviluppo/tony/HANDOFF_CONTINUITA_PERFORMANCE_NAV.md (questo file)

Regole: .cursor/rules/tony-agent-onboarding.mdc, tony-pagina-lista-e-form.mdc, project-guardian-tony.mdc.
Non introdurre logica hardcoded per singola pagina: usare config (tony-form-mapping, NAV_TARGET_RULES, ecc.).
Dopo il lavoro aggiorna SOLO: COSA_ABBIAMO_FATTO.md, STATO_ATTUALE.md, MASTER_PLAN.md (se cambia fase), TONY_DECISIONI_E_REQUISITI.md (se decisione implementata).
```

---

## 1. Dove eravamo (discussione / decisioni)

### Domande affrontate

| Tema | Conclusione |
|------|-------------|
| **Gemma / AI locale vs Gemini** | Restare su **Gemini 2.5 Flash** in CF. Ampliare **binario senza LLM** (client + quick reply CF), non self-host Gemma. |
| **Costi a scala** (100 tenant, ~1000 operai) | Con ottimizzazioni già in codice: ordine **~€120–230/mese** AI totale (non €260–380). Tony Avanzato €5/modulo copre grosso modo il costo per tenant attivo. Prezzi da `core/config/subscription-plans.js`. |
| **Voce Tony (TTS)** | Oggi `it-IT-Wavenet-D` in `getTonyAudio`. Upgrade opzionale: **Neural2** (stesso $/M), **Chirp 3 HD** (~2× costo TTS, impatto marginale su MRR). |
| **Quanto è già ottimizzato** | Molto: intercept client 0 CF + pipeline CF quick reply prima di Gemini. I log CF **sottostimano** il risparmio (ore/lavori locali non compaiono in `[Tony Perf]`). |

### Analisi produzione eseguita (`npm run tony:perf-review`, ~7 gg, 2026-06)

Campione `tonyaskstream`: **75 richieste** (0 su `tonyask` classico).

| Metrica | Valore |
|---------|--------|
| `usedGemini: false` | **~31%** |
| Router binario | A: 12 · B: 13 · **C: 50** |
| Cache contesto hit | ~29% |
| Gemini mediano (quando usato) | ~2,9 s |
| `quickReplyHit` top | nessuno 52 · **nav 7** · **meteo 7** · query_tariffa 3 · riassunto 2 · lavoro_entity 2 · filter_table 1 |

**Binario B Fase 4:** ~10 richieste servite da nav/filter/riassunto senza Gemini; **~3 navigazioni B** ancora su Gemini (frasi non in mappa).

### Fix completato in questa sessione

**Meteo test + typo produzione** (2026-06-10):

- `tests/meteo-tony-quick-reply.test.js`: fake timers ancorati `2026-05-21` (fixture maggio 2026).
- `functions/meteo-service.js`: `fixWeekdayTyposInMsg` anche in `isTonyMeteoOperationalQuestion` (es. «mercoldì»).
- **47/47** test verdi.
- **Deploy CF consigliato** se il fix typo non è ancora in produzione.

---

## 2. Dove siamo (stato codice)

### Architettura performance — 3 livelli

```
Utente
  → [1] Client intercept (0 CF)     main.js, tony-form-save-local.js, tony-service.js
  → [2] CF quick reply (no Gemini)  meteo, nav, filter, multi-blocco, tariffe, lavoro entity, …
  → [3] Gemini 2.5 Flash            binario C, ambigui, form complessi
```

**Livello 1 — non compare nei log `[Tony Perf]`:**

- Segna ore workspace (intervista + save locale)
- Creazione lavoro + intervista client
- Disambiguazione macchine/attrezzi
- Save locale magazzino, terreno, ecc.

**Livello 2 — pipeline CF** (`functions/index.js` → `handleTonyAskRequest`):

Ordine approssimativo: router → tier contesto → quick A → **nav** → **filter_table** → **multi_block** → pattern attività → lavoro entity → meteo → Gemini.

### Nav quick reply — già implementato (non partire da zero)

| Elemento | File | Note |
|----------|------|------|
| Mappa destinazioni | `functions/tony-nav-quick-reply.js` → `NAV_TARGET_RULES` | **~19 target** (tariffe, lavori, terreni, magazzino, …) |
| Verbi navigazione | `NAV_VERB_RE` | apri, portami, vai a/al/ai, mandami, … |
| RIASSUNTO | stesso file | `riassunto_tabella`, `riassunto_briefing` |
| Gate moduli | `functions/tony-module-gate.js` | `TARGET_REQUIRES_MODULE` più ricco della mappa nav |
| Test | `tests/tony-nav-quick-reply.test.js` | 5 test |
| Smoke review | `scripts/tony-perf-log-review.mjs` | 3 scenari binario B |

**Gap noti mappa nav vs prompt Gemini / module gate** (candidati estensione, non bloccanti):

- `manodopera` (esplicito), `oliveto`, tracciabilità consumi
- Sinonimi: «voglio andare…», «mostrami i terreni» (senza «la pagina»), «torna alla home»
- I **3 messaggi reali** da log che ancora usano Gemini (da estrarre — vedi task 1 sotto)

### Obiettivi formali piano performance (non ancora misurati su traffico ampio)

Da `PLAN_OTTIMIZZAZIONE_PERFORMANCE.md` §9 Fase 4:

- **−40%** chiamate Gemini vs baseline
- **p50 < 1,5 s** end-to-end

Stato: Fase 0–4 implementate; validazione numerica **pending** su campione più grande.

---

## 3. Dove vogliamo arrivare (backlog prioritizzato)

### Priorità 1 — Nav binario B: chiudere i buchi (~mezza giornata max)

**Obiettivo:** le richieste classificate **router binario B** con intento navigazione/riassunto non devono passare da Gemini se esiste un target `APRI_PAGINA` / `RIASSUNTO` deterministico.

**Passi concreti:**

1. **Estrarre messaggi mancanti dai log**
   ```bash
   npm run tony:perf-review
   ```
   Cercare: `navigazioni (B) passano ancora da Gemini`. Annotare testo utente esatto (se il script non li stampa, estendere `tony-perf-log-review.mjs` per dumpare `message` + `routerBinario=B` + `usedGemini=true`).

2. **Per ogni messaggio:** aggiungere riga in `NAV_TARGET_RULES` e/o espandere `NAV_VERB_RE` in `tony-nav-quick-reply.js`.

3. **Allineare** `NAV_TEXT_BY_TARGET` e, se nuovo target, `TARGET_REQUIRES_MODULE` in `tony-module-gate.js` (già presente per molti alias).

4. **Test:** un `it()` per messaggio reale in `tests/tony-nav-quick-reply.test.js`.

5. **Verifica:** smoke `tony:perf-review` + deploy functions.

**Criteri di accettazione:**

- I messaggi noti da log → `tryTonyNavQuickReply` ritorna `id: nav` (o `riassunto_*`) con `command` corretto.
- Nessuna regressione: `crea un lavoro…` resta `null` (non nav).
- Test nav ≥ 8–10 casi (oggi 5).

**Non è un refactor lungo:** pattern ripetuto, file ~250 righe, diff tipico **3–15 righe per frase**.

---

### Priorità 2 — Metriche client `tony_local_intercept` (~2–4 ore)

**Obiettivo:** misurare interazioni **livello 1** (0 CF) oggi invisibili ai log Cloud Function.

**Proposta minima:**

- In `core/js/tony/main.js`, prima del return degli intercept (`tryInterceptSegnaOre…`, lavoro locale, save locale, …): contatore in `sessionStorage` o evento custom `tony-local-intercept` con `{ kind: 'segna_ore' | 'lavoro_create' | … }`.
- Opzionale: invio batch leggero a analytics / log dev-only.

**Criteri di accettazione:**

- Documentato in `STATO_ATTUALE.md` quali `kind` esistono.
- Nessun impatto UX (no await rete obbligatorio).
- In dev, `window.__tonyLocalInterceptStats` o equivalente ispezionabile.

---

### Priorità 3 — Voce TTS (opzionale)

**Neural2** (~30 min, stesso costo Wavenet) o **Chirp 3 HD** (qualità superiore, ~2× costo TTS — impatto basso su MRR).

→ **Guida completa Chirp 3:** `docs-sviluppo/tony/HANDOFF_TTS_CHIRP3.md` (scelta voce, implementazione, test, rollback).

- File: `functions/index.js` → `getTonyAudio`
- Env consigliato: `TONY_TTS_VOICE`, `TONY_TTS_SPEAKING_RATE`
- Cache client: includere `voice` in `lastTTSCache` (`voice.js`)

---

### Priorità 4 — Monitoraggio performance periodico

- Rieseguire `npm run tony:perf-review` dopo deploy nav / ogni 2–4 settimane con traffico reale.
- Aggiornare tabella obiettivi in `PLAN_OTTIMIZZAZIONE_PERFORMANCE.md` §9 solo se cambiano numeri verificati.

---

### Esplicitamente OUT OF SCOPE (non iniziare senza richiesta)

| Voce | Motivo |
|------|--------|
| Gemma / LLM self-hosted | Decisione: no per ora |
| Coda offline ore mobile | Fase 4.4 **deferred** (`PLAN_OTTIMIZZAZIONE_PERFORMANCE.md`) |
| Refactor totale navigazione Gemini prompt | Solo estensione incrementale `NAV_TARGET_RULES` |
| Visione / upload immagini Tony | Master Plan — non senza requisito esplicito |

---

## 4. File chiave (mappa rapida)

| Area | Path |
|------|------|
| Pipeline CF Tony | `functions/index.js` (`handleTonyAskRequest`) |
| Nav quick reply | `functions/tony-nav-quick-reply.js` |
| Filter table quick reply | `functions/tony-filter-table-quick-reply.js` |
| Multi-blocco | `functions/tony-multi-block-quick-reply.js` |
| Meteo operativo | `functions/meteo-service.js`, `functions/tony-meteo-rules.js` |
| Gate moduli / target APRI_PAGINA | `functions/tony-module-gate.js` |
| Router / tier | `functions/tony-intent-router.js`, `functions/tony-context-tier.js` |
| Intercept client | `core/js/tony/main.js`, `core/js/tony-form-save-local.js` |
| TTS | `functions/index.js` (`getTonyAudio`), `core/js/tony/voice.js` |
| Prezzi abbonamento | `core/config/subscription-plans.js` |
| Review CLI | `scripts/tony-perf-log-review.mjs` → `npm run tony:perf-review` |
| Test performance/nav | `tests/tony-nav-quick-reply.test.js`, `tests/meteo-tony-quick-reply.test.js` (47) |

---

## 5. Comandi verifica (checklist agente)

```bash
# Test nav
npx vitest run tests/tony-nav-quick-reply.test.js

# Test meteo (ancorati 2026-05-21)
npx vitest run tests/meteo-tony-quick-reply.test.js

# Suite quick reply correlate
npx vitest run tests/tony-quick-reply.test.js tests/tony-filter-table-quick-reply.test.js tests/tony-multi-block-quick-reply.test.js

# Smoke router + binario B + log produzione (richiede gcloud se --days>0)
npm run tony:perf-review
```

Dopo modifiche CF: deploy functions e smoke manuale «portami alle tariffe» da widget Tony.

---

## 6. Principi architetturali (non negoziabili)

1. **Config > codice:** nuove destinazioni nav = riga in `NAV_TARGET_RULES`, non `if` in `index.js`.
2. **Global mobility:** azione non sulla pagina corrente → `APRI_PAGINA` + eventuale `OPEN_MODAL` (Gemini o nav quick reply).
3. **Context-driven:** risposte da Context Builder; se dato manca, proporre mapping fonte.
4. **Nuove pagine liste/form:** canone `.cursor/rules/tony-pagina-lista-e-form.mdc` (`currentTableData`, merge `setContext`, `table-data-ready`).

---

## 7. Stato deploy / attenzioni

| Modifica | Deploy necessario |
|----------|-------------------|
| Fix typo `mercoldì` in `meteo-service.js` | **Sì** — `firebase deploy --only functions` |
| Solo test meteo | No |
| Estensione `tony-nav-quick-reply.js` | **Sì** — functions |
| Metriche client `main.js` | **Sì** — hosting / asset client |
| TTS voice | **Sì** — functions |

---

## 8. Cronologia handoff (aggiornare a fine task)

| Data | Agente / nota | Fatto | Prossimo |
|------|---------------|-------|----------|
| 2026-06-10 | Sessione costi/perf/meteo | Fix test meteo 47/47; typo mercoldì in CF; `tony:perf-review` analizzato; chiarito scope nav | Task Priorità 1: estrarre 3 messaggi B da log e estendere `NAV_TARGET_RULES` |
| | | | Task Priorità 2: metriche `tony_local_intercept` |
| | | | Deploy CF meteo se non fatto |

---

## 9. Link documentazione correlata

- `docs-sviluppo/tony/PLAN_OTTIMIZZAZIONE_PERFORMANCE.md` — Fase 0–4, obiettivi −40% / p50
- `docs-sviluppo/tony/STATO_ATTUALE.md` — stato componenti verificato
- `docs-sviluppo/tony/MASTER_PLAN.md` — visione e fasi roadmap
- `docs-sviluppo/TONY_DECISIONI_E_REQUISITI.md` — decisioni formali
- `docs-sviluppo/COSA_ABBIAMO_FATTO.md` — changelog (voce 2026-06-10 meteo)
