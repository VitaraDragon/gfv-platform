# Checklist — aggiornamento guide GFV (`GUIDA/`)

Usare **tutti i punti applicabili** a ogni richiesta di allineamento guide (dopo cambi funzionalità o UX). Spuntare mentalmente o in commento PR.

**Riferimenti:** `.cursor/rules/tony-pagina-lista-e-form.mdc` (liste/form Tony); `docs-sviluppo/LINEA_GUIDA_RESPONSIVE_STANDALONE.md` (standalone); `docs-sviluppo/GUIDA/README.md` (struttura cartelle).

---

## 0. Perimetro (consigliato)

- [ ] **`npm run guida:impact`** (o **`npm run guida:suggest`**) sui ref giusti (`--base` / `--head`) per elenco moduli e file guida tipici + diff.
- [ ] Estendere **`scripts/guida-code-map.json`** se il codice tocca aree nuove non ancora mappate.

---

## 1. Per ogni modulo `GUIDA/<MODULO>/` impattato

### 1.1 Fonte `docs-sviluppo/GUIDA/`

- [ ] **`utente/guida.md`** — stesso schema usato in repo: percorso consigliato, indice con anchor (es. «Impara qui»), mini-guide; linguaggio utente; **nessun nome file `.html`** nel testo rivolto all’utente finale.
- [ ] **`utente/guida-sintesi.md`** — breve, per contesto Tony / token; allineata al comportamento reale dopo il cambiamento.
- [ ] **`tony/guida-tecnica.md`** — path, form/modal, comandi, `tony-service` / cloud dove serve; tono tecnico, non prosa lunga da guida utente.

**MANODOPERA:** se il cambiamento riguarda ruoli diversi, aggiornare i file pertinenti tra  
`utente/guida.md` (indice), `guida-manager.md`, `guida-caposquadra.md`, `guida-operaio.md` + sintesi + `tony/guida-tecnica.md`.

**INTERSEZIONI:** se il flusso attraversa moduli, valutare **`INTERSEZIONI/tony/intersezioni.md`**.

**CORE:** includere `CORE/utente/guida.md` / sintesi / `CORE/tony/guida-tecnica.md` se il cambiamento è trasversale all’app base.

### 1.2 Mirror `core/GUIDA/`

- [ ] **Stessi path** sotto `core/GUIDA/<MODULO>/…` allineati a `docs-sviluppo/GUIDA/` (copia speculare o patch equivalente).

---

## 2. Nuove o pagine lista/form toccate dal codice

- [ ] Se introduci o modifichi **lista + Tony** o **form + mapping**: canone **`.cursor/rules/tony-pagina-lista-e-form.mdc`** (`currentTableData`, merge `setContext` su `page`, evento `table-data-ready`, `tony-form-mapping.js` / injector / `functions/index.js` dove serve); la guida utente deve descrivere il comportamento senza nomi file pagina nel testo utente.

---

## 3. Runtime Tony (solo se in questa sessione hai modificato quel codice)

- [ ] **`core/services/tony-service.js`** — se cambiano `GUIDA_LOAD_ENTRIES`, `guida_sintesi_*`, regole guida nel prompt: documentare in **`GUIDA/TONY/tony/guida-tecnica.md`** e/o **`GUIDA/CORE/tony/guida-tecnica.md`** come da impatto.
- [ ] **`functions/index.js`** — nuovi/ritoccati `SUBAGENT_*` o intent: riflesso in guida tecnica **TONY** o modulo interessato.

---

## 4. Anteprima HTML (se esiste per il modulo)

- [ ] **`documentazione-utente/guida-*-utente.html`** — verificare che punti ancora ai `.md` corretti (pattern fetch docs-sviluppo → core).

---

## 5. Vietato salvo richiesta esplicita del maintainer

Non modificare (vedi anche **`.cursor/rules/tony-agent-onboarding.mdc`**):

- [ ] (Non fare) `docs-sviluppo/COSA_ABBIAMO_FATTO.md`, `docs-sviluppo/tony/STATO_ATTUALE.md`, `docs-sviluppo/tony/MASTER_PLAN.md`, `docs-sviluppo/TONY_DECISIONI_E_REQUISITI.md` e altri file elencati come «NON aggiornare» nell’onboarding — **solo se** il maintainer chiede esplicitamente quel aggiornamento.

---

## 6. Chiusura qualità

- [ ] Coerenza lessicale con le guide esistenti del modulo (es. **azienda**, ruoli, «Tony Avanzato» / piano).
- [ ] Nessuna contraddizione tra **sintesi** e **guida lunga** sullo stesso comportamento.

---

_Checklist usata da `.cursor/rules/guida-aggiornamento-checklist.mdc` e da `npm run guida:suggest`._
