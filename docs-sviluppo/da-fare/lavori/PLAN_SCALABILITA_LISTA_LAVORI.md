# Piano scalabilità — Lista lavori (Gestione Lavori)

**Data creazione**: 2026-05-30  
**Stato**: 📋 **Da implementare** (decisione prodotto condivisa; nessun codice ancora)  
**Priorità**: Alta per vendita multi-tenant — il problema emerge già con **centinaia–migliaia** di lavori/anno, non solo con “aziende enormi”.

**Obiettivo del documento**: traccia unica per rendere Gestione Lavori e Tony **sostenibili nel tempo** quando la collection `lavori` cresce (anni di storico), senza caricare tutto a ogni apertura pagina.

**Riferimenti**:
- `docs-sviluppo/INTEGRAZIONE_GESTIONE_LAVORI.md` — moduli pagina
- `docs-sviluppo/in-sviluppo/tony/PLAN_OTTIMIZZAZIONE_PERFORMANCE.md` — §1.3, §3b.3 (tabella lavori in context CF)
- `.cursor/rules/tony-pagina-lista-e-form.mdc` — canone `currentTableData` + `table-data-ready`
- `docs-sviluppo/RIEPILOGO_CURRENTTABLEDATA_PER_MODULO_LISTE.md` — pattern FILTER_TABLE
- Codice: `core/admin/js/gestione-lavori-controller.js` (`loadLavori`, `renderLavori`), `gestione-lavori-events.js` (`applyFilters`)

---

## 1. Problema

### 1.1 Crescita realistica (ordine di grandezza)

Scenario di riferimento concordato (non peggiore caso):

| Voce | Stima |
|------|--------|
| Operai attivi | 10 |
| Lavori per operaio | ~1/giorno lavorativo |
| Giorni lavorativi/anno | ~300 |
| **Lavori/anno (tenant)** | 10 × 300 = **~3.000** |
| **Dopo 10 anni** | **~30.000** documenti in `tenants/{id}/lavori` |

Varianti più basse (5 operai, meno lavori/giorno) ritardano il problema ma **non lo eliminano**: lo storico cresce monotonicamente.

### 1.2 Comportamento attuale (2026-05-30)

| Step | Cosa fa oggi | Con 30k lavori |
|------|----------------|----------------|
| `loadLavori` | `getDocs` su **tutta** la collection, ordine `dataInizio` desc | ~30k read Firestore + JSON enorme in RAM |
| `applyFilters` | Filtra **in memoria** (stato, terreno, operaio…) — **nessun filtro anno/mese** | Scarica tutto, mostra subset solo se l’utente filtra |
| `renderLavori` | Per **ogni** riga filtrata: `loadProgressiLavoro` → almeno 1 `getDoc` (+ possibile subcollection zone) | Fino a **30k+ read** per un solo render se filtro vuoto |
| `currentTableData` | `items` = **tutte** le righe filtrate → Tony + CF | Prompt/context gonfiati (MB), latenza CF |

**Conclusione**: un filtro UI “mostra solo ultimo mese” **senza** query Firestore per periodo **non risolve** il problema — scaricherebbe comunque 30k documenti.

### 1.3 Cosa resta OK oggi (non è il collo di bottiglia)

- **10 operai / decine di terreni** — liste anagrafiche leggere
- **Intervista Tony client-side** (macchine, tipo, save) — usa `lavoriState`, non la tabella intera
- **Bootstrap form** (`lavori-form-data-ready`) — terreni, tipi, operai (indipendente dal conteggio lavori storici)

Il rischio principale è **lista + render + context tabella**, non la creazione lavoro dopo il 1° turno CF.

---

## 2. Direzione prodotto (decisione)

### 2.1 Principio

> **Vista operativa leggera di default; storico on demand.**

L’utente in Gestione Lavori lavora quasi sempre su **periodo recente**. Gli anni precedenti devono essere **richiamabili**, non **precaricati**.

### 2.2 UX target

| Elemento | Comportamento |
|----------|----------------|
| **Default all’apertura** | Solo **ultimo mese** (rolling: da oggi −30 giorni, oppure mese di calendario corrente — da definire in implementazione) |
| **Selettore periodo** | Mese + anno; preset opzionali: «ultimi 3 mesi», «anno corrente», «anno 2024»… |
| **Filtri esistenti** | Stato, terreno, caposquadra, operaio, tipo lavoro — applicati **dentro** il periodo già caricato |
| **Storico** | Cambio mese/anno → **nuova query** Firestore (non scroll infinito su 30k in memoria) |
| **Indicatore UI** | Testo chiaro: «Mostrando 247 lavori — maggio 2026» (evita confusione vs totale storico) |

**Da non fare subito (fase opzionale):** archivio collection separata / flag `archiviato` — utile dopo che filtro periodo è stabile.

### 2.3 Ordine di grandezza atteso con default ultimo mese

Con ~3.000 lavori/anno → **~250 lavori/mese** in media (picchi stagionali più alti).  
Target operativo: **&lt; 500 righe** per query default → pagina e Tony restano nel range già testato (canary ~68–300 righe).

---

## 3. Architettura tecnica target

### 3.1 Query Firestore (obbligatoria)

Sostituire il caricamento “tutto” con query parametrica:

```
tenants/{tenantId}/lavori
  where dataInizio >= periodStart
  where dataInizio <  periodEnd   // esclusivo fine mese
  orderBy dataInizio desc
  limit pageSize                  // es. 100; paginazione se serve
```

**Campo indice:** `dataInizio` (Timestamp) — verificare/creare indice composito se si aggiungono filtri server-side (es. `stato` + `dataInizio`).

**Fallback:** lavori senza `dataInizio` — policy esplicita (esclusi dal default periodo, o bucket «da pianificare» con query separata).

### 3.2 Stato pagina

```javascript
lavoriState = {
  // invariato per form Tony
  terreniList, operaiList, tipiLavoroList, trattoriList, ...

  // nuovo / esplicito
  periodFilter: { mode: 'last_month' | 'month' | 'year' | 'custom', start, end, label },
  lavoriList: [],           // SOLO periodo corrente
  filteredLavoriList: [],
  totalInPeriod: number,    // opz. count aggregato
  hasMorePages: boolean
}
```

**Non** mantenere `lavoriList` come cache di tutti gli anni in RAM.

### 3.3 Render e progressi

| Oggi | Target |
|------|--------|
| `loadProgressiLavoro` per ogni riga a ogni render | Progressi **lazy**: solo righe visibili, o campo denormalizzato `superficieTotaleLavorata` già sul doc lavoro (preferire read doc già in memoria) |
| Render HTML di tutte le righe | Paginazione UI (50–100 righe) o virtual scroll — **fase 2** se il mese singolo supera ~300 righe |

### 3.4 Tony — `currentTableData` (canone liste)

Allineamento a `tony-pagina-lista-e-form.mdc`:

- `summary`: include **periodo** + conteggio («247 lavori, maggio 2026, 18 in corso…»)
- `items`: **solo righe del periodo caricato** (max cap difensivo es. 100 se paginato — documentare in mapping)
- Aggregati opzionali in `currentTableData` (conteggi per stato nel periodo) per domande «quanti in ritardo questo mese?» senza elencare 250 righe in prompt

**FILTER_TABLE / intent Tony:** estendere params periodo (`mese`, `anno`, `ultimo_mese`) per cambiare filtro pagina + **ricaricare query**, non filtrare client-side su storico non caricato.

**Crea lavoro (binario C):** mantenere `slimContextForLavoroFormFollowUp` e pattern intervista client-side; con lista slim il problema «68 → 30k righe in CF» si riduce strutturalmente.

---

## 4. Fuori scope (per questo piano)

- Storico multi-anno aggregato per consigli Tony (track trasversale app — v. `PLAN_OTTIMIZZAZIONE_PERFORMANCE.md` §8)
- Migrazione dati / ricalcolo `dataInizio` su lavori legacy
- Paginazione cross-module (attività, validazione ore) — stesso pattern riusabile, non incluso qui
- Rewrite lista in component framework

---

## 5. Roadmap implementazione (quando si decide di fare)

### Fase A — Minimo vendibile (consigliata per prima)

1. UI selettore **mese/anno** + default **ultimo mese**
2. `loadLavori(tenantId, { periodStart, periodEnd })` — query Firestore a range
3. `applyFilters` solo su `lavoriList` del periodo
4. `currentTableData` + evento `table-data-ready` coerenti con periodo visibile
5. Indice Firestore + test manuale con tenant seed (300+ lavori su un mese)

**Done quando:** aprire Gestione Lavori con 10k+ lavori in DB totale ma solo ~250 nel mese → **&lt; 5 s** percepiti, **&lt; 500** read Firestore iniziali.

### Fase B — Tony periodo

1. `FILTER_TABLE` lavori: params `periodo` / `mese` / `anno`
2. Istruzioni in `functions/index.js` per domande «lavori di marzo», «quanti a febbraio»
3. Canary: «mostrami i lavori in corso» resta sul periodo visibile; «passa a marzo 2025» cambia query

### Fase C — Affinamento performance

1. Progressi: evitare N× `getDoc` — usare campo su documento lavoro o batch
2. Paginazione interna al mese se &gt; 100 righe
3. Persistenza filtro in `sessionStorage` o URL (`?m=2026-05`)

### Fase D — Opzionale long-term

1. Flag `archiviato` / collection archivio per completati &gt; N mesi
2. Callable o summary Cloud per «totale lavori 2023» senza scaricare items
3. Allineamento dashboard KPI lavori al periodo

---

## 6. File previsti (implementazione futura)

| Area | File |
|------|------|
| Query periodo | `core/admin/js/gestione-lavori-controller.js` — `loadLavori`, eventuale `loadLavoriForPeriod` |
| Filtri UI | `core/admin/gestione-lavori-standalone.html`, `gestione-lavori-events.js` |
| Tony lista | `renderLavori` → `currentTableData`; `functions/index.js` — FILTER_TABLE lavori + periodo |
| Indici | `firestore.indexes.json` (se necessario) |
| Test | fixture Vitest date range (opz.); test manuale checklist §7 |

---

## 7. Checklist accettazione (post-implementazione)

- [ ] Tenant con **≥ 5.000** lavori totali in Firestore: apertura default **non** scarica tutta la collection (verificare Network / log read)
- [ ] Default = ultimo mese: conteggio UI coerente con query
- [ ] Cambio mese/anno ricarica lista (nuova query)
- [ ] Filtri stato/terreno/operaio funzionano **nel periodo** selezionato
- [ ] `window.currentTableData.items.length` ≤ righe periodo (mai storico completo)
- [ ] Tony «crea lavoro» + intervista client-side: **nessuna regressione** (canary 3b-C1…C8)
- [ ] Tony «filtra lavori marzo» / «vai a maggio 2025»: cambia periodo visibile
- [ ] Caposquadra / operaio con 10 operai: invariato

---

## 8. Rischi e mitigazioni

| Rischio | Mitigazione |
|---------|-------------|
| Lavori senza `dataInizio` spariscono dal default | Query parallela «da pianificare» o inclusione esplicita |
| Utente si aspetta «tutti i lavori» in un colpo | Copy UI + preset «anno intero» |
| Indice Firestore mancante | Deploy indice prima del rollout; fallback query senza orderBy + sort client (solo emergenza) |
| Tony chiede totali storici | Fase D summary; intanto risposta onesta + suggerimento cambio periodo |
| Mese con &gt; 500 lavori (picco vendemmia) | Paginazione Fase C; preset «ultime 2 settimane» |

---

## 9. Decisioni aperte (da chiudere in implementazione)

1. **Default «ultimo mese»**: rolling 30 giorni vs mese di calendario (es. 1–31 maggio)?
2. **Include lavori futuri** pianificati oltre fine mese nel default?
3. **URL condivisibile** del periodo (`?period=2026-05`) — sì/no in Fase A?
4. **Cap `items` Tony** — 50, 100, o tutte le righe del periodo se ≤ 300?

---

## 10. Collegamento piano performance Tony

Con questo piano:

- Il collo di bottiglia «tabella 68 lavori in context» **non scala** a 30k — resta ~250/mese
- Fase 3b.3 «ridurre re-invio tabella su follow-up CF» diventa gestibile strutturalmente
- L’intervista client-side (§3b.8) **non dipende** da questa lista — resta valida

**Quando implementato:** aggiornare `docs-sviluppo/COSA_ABBIAMO_FATTO.md`, `tony/STATO_ATTUALE.md` (riga Gestione Lavori / currentTableData), e una riga in `PLAN_OTTIMIZZAZIONE_PERFORMANCE.md` §9 come Fase 3c o track parallelo.

---

*Documento di design — nessuna modifica codice fino a prioritizzazione esplicita.*
