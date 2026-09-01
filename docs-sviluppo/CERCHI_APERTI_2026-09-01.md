# Cerchi aperti — inventario verificato sul codice

**Data:** 2026-09-01  
**Fonte:** lettura del codice in repo (form mapping, injector, Stripe, Tony Occhi, VM, Report, nav, push, liste). Non è un elenco copiato dai piani.  
**Scopo:** avere una foto chiara di cosa è **a metà**, cosa è **fatto ma i doc dicevano di no**, e cosa è **solo disegnato**.  
**Non copre:** se Functions/secret Stripe/Meta sono live in Firebase (dal repo non si vede).

Inventario Master Plan: Fasi 1, 5 e 6 restano parziali; Fase 2 è chiusa; Fasi 3–4 in corso. Questo file non cambia le fasi: elenca i cerchi aperti **nel prodotto**.

---

## Come leggere gli stati

| Stato | Significato |
|-------|-------------|
| **Fatto nel codice** | C’è, usabile. Eventuale deploy/secret a parte. |
| **In sviluppo** | Iniziato, cerchio non chiuso. |
| **Da fare** | Piano o requisito, codice assente o quasi. |
| **Obsoleto** | Piano superato dal codice o scartato. |

---

## Cosa chiudere (ordine suggerito)

1. **Ops notifiche S5** — codice c’è; serve deploy Functions + indici + secret WhatsApp se si vuole WA.
2. **Billing v2 Fase 2–3** — coterm + «passa al bundle»; oggi ogni modulo è una subscription Stripe nuova.
3. **Tony Occhi M1 / M3 / M5** — flusso foto→registra c’è; mancano duplicati, unità, audit estratto vs confermato.
4. **Vendemmia Meccanica Tony + nav** — modulo UI/servizi c’è; Tony vede solo piano stagione e calcoli salvati.
5. **Report oltre Terreni/Vigneto + `MOSTRA_GRAFICO`** — comando Tony inesistente; card dashboard ancora “In sviluppo”.
6. **Guasti/macchine in mapping Tony** — il prompt CF chiede un inject che il client non mappa (`SAVE_FAULT` assente).

---

## 1. In sviluppo (cerchio aperto)

### 1.1 Tony Occhi — acquisizione documenti

**Codice:** CF `tonyExtractDocument`, form revisione, bolla/fattura/scontrino, `prezzoInAttesa`, archivio Magazzino, stub prodotto, giacenza all’entrata.

| Pezzo | Stato codice |
|-------|----------------|
| Flusso 📷 → revisione → Registra | Fatto |
| M2 totali vs imponibile | Fatto (`assessDocumentExtractionSafety`) |
| M4 confidence &lt; 0,7 + evidenza righe | Fatto |
| M6 `documentoAcquisitoId` sui movimenti | Fatto |
| Giacenza alla bolla | Fatto in pratica (`aggiornaGiacenzaProdotto` sull’entrata); **niente flag di policy** |
| M1 duplicati (fornitore + n. + data) | **Assente** |
| M3 normalizzazione unità | **Assente** (`unita` testo libero) |
| M5 audit estratto Gemini vs confermato | **Parziale** (solo `righeConfermate`) |
| P7 retention Storage | **Assente** |
| Bolle merce prodotta (§20.32) | Da fare (design) |

Piano: `da-fare/magazzino/ROADMAP_ACQUISIZIONE_DOCUMENTI_GEMINI.md` (restare lì; la feature è in sviluppo, non “da avviare”).

### 1.2 Billing Stripe v2

**Codice:** `createStripeCheckoutSession` = una Checkout Session per acquisto, `mode: subscription`, un price. `cancelStripeAddon` / `reactivateStripeAddon` / webhook Fase 1 **ci sono**.

**Assente:** `renewalAnchor`, proration, «passa al bundle», Customer Portal.

Handoff: `in-sviluppo/abbonamento/BILLING_V2_HANDOFF.md` (Fasi 2–4 ancora valide).

### 1.3 Vendemmia Meccanica

**Codice:** 22 file in `modules/vendemmia-meccanica/` (hub, piano, calcolatore, PDF, tariffe, bilancio, sync lavori). Gate + prezzo Stripe `vendemmiaMeccanica`.

**Tony:** `currentTableData` su piano stagione (con aggregati) **e** calcoli salvati. Zero su tariffe VM e bilancio. Zero in `tony-form-mapping.js`. Zero in `NAV_TARGET_RULES`.

Piano checklist: `in-sviluppo/vendemmia-meccanica/PLAN_MODULO_VENDEMMIA_MECCANICA.md` (UI/servizi molto più avanti della “Fase 1 parziale” scritta nel README in-sviluppo).

### 1.4 Modulo Report + grafici Tony

**Codice:**
- Terreni: `report-terreni-standalone.html` + `report-terreni-service.js` (affitti, trattamenti, vendemmie, ore) — **reale**
- Vigneto: `report-standalone.html` (export Excel) — **reale**
- Frutteto / Magazzino / Manodopera / Conto terzi / Sintesi / Economici: card `soon: true`, `href: '#'`

**`MOSTRA_GRAFICO`:** zero occorrenze nel repo.

### 1.5 Push ciclo + WhatsApp S5

**Codice:** catalogo 7 eventi, scheduler, `sendWhatsAppMessage`, preferenze Impostazioni, indici `notificationEvents`, `vapidKey` in `firebase-config.js`.

**Non chiuso:** deploy Functions / indici in produzione; WA resta spento senza `WHATSAPP_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID`.

### 1.6 Tony — buchi nel core

| Voce | Codice |
|------|--------|
| Form mapping | attività, lavoro, terreno, preventivo, prodotto, movimento, trattamento, zona, ore. **Niente** guasto/macchina |
| Prompt CF guasti | chiede `INJECT_FORM_DATA` su `segnala-guasto-form` o `SAVE_FAULT` — **`SAVE_FAULT` non esiste nel client** |
| Nav binaria | Hub manodopera **c’è**. Mancano oliveto, VM, report, tracciabilità; ~3 frasi da log produzione (da riestrarre) |
| `summaryStats` / memoria storica | **Assenti** |
| Metriche `tony_local_intercept` | solo flag E2E, nessun contatore produzione |
| Parser terreno CF | **cablato** in `functions/index.js` (`tryTonyTerrenoEntityParse`) |

### 1.7 Liste senza `currentTableData`

**C’è:** terreni, attività, lavori, macchine (5 liste), magazzino (prodotti/movimenti/tracciabilità/documenti), CT (clienti/preventivi/tariffe/terreni clienti), concimazioni V/F, vendemmia, impegni, segna ore, workspace, meteo, piano VM, calcoli VM.

**Non c’è:** vigneti, frutteti, potatura, trattamenti, raccolta, validazione ore, squadre, operai, compensi, statistiche, tariffe VM, bilancio VM, report.

### 1.8 Sostituzioni manodopera — residui

Shortlist, roster A1+A2, semaforo, pin mappa, Context Builder `manodoperaGiorno`: **fatti**.

**Aperti:** pool riserve; tap pin → shortlist filtrata (oggi InfoWindow + link Gestione lavori); DnD equipaggio (opzionale).

### 1.9 Hub Manodopera Fase 2 (opzionale)

Fase 1 fatta. Manca: quick bar sulla home hub, tour, smoke, verifica CF «apri manodopera» in produzione.

### 1.10 E2E Tony simulatore

M-T4 / M-T5 fatti. **M-T6** (matrice ≥50) aperto. Gate Playwright Windows ancora appeso.

---

## 2. Fatto nel codice (i doc erano indietro)

| Voce | Dove nel codice | Doc da allineare |
|------|-----------------|------------------|
| Hub `manodopera` in nav binaria B | `functions/tony-nav-quick-reply.js` `NAV_TARGET_RULES` | Handoff nav citava ancora manodopera come gap |
| `vapidKey` Web Push | `core/config/firebase-config.js` | Spec S3 diceva “manca vapidKey” |
| Tony Occhi M2 + M4 | `document-register.js`, `document-review-form.js` | Decisioni §20.19 diceva solo M4/M6 |
| Parser terreno early-exit CF | `functions/index.js` + `tony-terreno-entity-parser.js` | STATO_ATTUALE “deploy da fare” come se non fosse cablato |
| `currentTableData` calcoli VM | `calcoli-salvati-standalone.html` + `publishTonyTableData` | Piano VM / README in-sviluppo |
| Meteo Tony fase 6 (praticabilità, asciugatura, doppia alternativa) | `meteo-service.js` + test 47 | Piano meteo restava “fase 6 in corso” |
| Push S0–S5 in repo | `functions/notification-dispatch.js`, Impostazioni | Linea guida assenze diceva “non ancora implementata” |
| Screenshot come immagine Occhi | picker `image/*` | §20.11 “pianificato” |

---

## 3. Da fare (disegnato, codice zero o quasi)

Non sono cerchi aperti: non sono partiti.

| Voce | Piano |
|------|--------|
| Confine terreno da tap in mappa | `da-fare/terreni/PIANO_PROPOSTA_CONFINE_TAP.md` |
| Modulo Oliveto | voce in `subscription-plans.js`; **nessuna** cartella `modules/oliveto/` |
| Scalabilità lista lavori (non caricare tutta la collection) | `da-fare/lavori/PLAN_SCALABILITA_LISTA_LAVORI.md` |
| Potatura/trattamenti derivati da lavori | `da-fare/vigneto/PIANO_POTATURA_TRATTAMENTI_DA_LAVORI.md` |
| Reti antigrandine nel calcolo materiali | `da-fare/vigneto/SPECIFICA_SEZIONE_RETI_ANTIGRANDINE.md` |
| Parametri qualità/scarto statistiche Frutteto | `da-fare/frutteto/PROPOSTA_PARAMETRI_E_SCARTO_STATISTICHE_FRUTTETO.md` |
| Calcolo materiali condiviso V/F/Oliveto | oggi solo `modules/vigneto/views/calcolo-materiali-standalone.html` |
| Campioni GPS / mappa multipunto | `TONY_DECISIONI` §18 |
| Feature flag tenant / secondo ambiente | `PUBBLICAZIONE_BRANCH_E_RELEASE.md` §7 |
| Branch protection `main` + tag release | stesso doc, azioni GitHub |
| Produzione spot social | copione chiuso 2026-08-30; take/prompt da fare |

`DOBBIAMO_ANCORA_FARE.md` (febbraio 2026) è **stale** su currentTableData (CT/macchine/magazzino/lavori già coperti). Non usarlo come backlog Tony. Non aggiornato in questo giro: resta storico; questo file lo sostituisce per i cerchi aperti.

---

## 4. Obsoleto / classificazione spostata (questo commit)

| Documento | Prima | Ora |
|-----------|-------|-----|
| `in-sviluppo/abbonamento-ui/PIANO_SVILUPPO_PAGINA_ABBONAMENTO.md` (gen 2026: prezzi hardcoded, no Stripe) | in sviluppo | **obsoleto** — sostituito da pagina Stripe vera + `BILLING_V2_HANDOFF.md` |
| Linea guida notifiche assenze | “non ancora implementata” | **implementata in codice** (S5); restano deploy/secret |
| Piano meteo fase 6 | “in corso” | **implementata** (raffinamenti a parte) |
| Tony Occhi | elenco “da-fare” come se non esistesse | **in sviluppo** (Fase 0–3 + archivio fatti) |
| Sostituzioni manodopera | “restano roster e CB shortlist” | roster + CB **fatti**; restano pool/tap/DnD |
| Tracking GPS → area lavorata | già scartato 2026-07-31 | resta in `obsoleto/strategie-superate/` |

---

## 5. Ops / produzione (non verificabile solo dal repo)

- Deploy Functions per S5 assenze/WA e (se non già live) parser terreno / typo meteo
- Secret Meta WhatsApp
- Protezione branch `main` su GitHub
- Tag sulle release
- `develop` non ha un indirizzo pubblico; Firebase è unico (dati = produzione)

---

## File toccati in questo allineamento doc

Canonici Tony: `STATO_ATTUALE.md`, `MASTER_PLAN.md` (puntatore), `TONY_DECISIONI_E_REQUISITI.md`, `COSA_ABBIAMO_FATTO.md`.  
Classificazione: `in-sviluppo/README.md`, `da-fare/README.md`, `obsoleto/README.md`, `INDICE_DOCUMENTAZIONE.md`.  
Handoff/piani stale: nav performance, meteo, linea guida notifiche, spec push S3 vapidKey.
