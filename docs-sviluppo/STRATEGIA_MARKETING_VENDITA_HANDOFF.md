# Strategia marketing e vendita — Handoff per agenti

**Data:** 2026-06-19  
**Scopo:** documento unico per implementare (prodotto, copy, GTM, checkout) **senza perdere il filo** rispetto a quanto già deciso e già in codice.  
**Audience:** agenti Cursor, sviluppo, futuro marketing operativo.

**Non sostituisce:** `STRATEGIA_FREEMIUM_MODULARE.md`, `ANALISI_STRATEGIA_LANCIO_NUOVO_PLAYER.md`, `CONFRONTO_PREZZI_COMPETITOR_COMPLETO.md` — li riassume e indica **cosa è obsoleto** vs **cosa è canonico oggi**.

---

## 1. Executive summary (30 secondi)

GFV Platform è un **ERP agricolo modulare italiano** per PMI (viticoltura, frutteto, conto terzi, manodopera, ecc.) con **Tony** come assistente AI integrato.

**Modello commerciale canonico (2026):**

| Livello | Prezzo | Ruolo commerciale |
|---------|--------|-------------------|
| **Free** | €0 | Acquisizione: prova limitata, **senza Tony chat** |
| **Base** | €5/mese | Sblocca app completa + **Tony Guida** (spiegazioni + **consigliere moduli**) |
| **Moduli** | pay-per-use (€1–6 cad.) | Valore verticale (Vigneto, Manodopera, …) |
| **Tony Avanzato** | €5/mese (modulo `tony`) | **Solo automazione** (form, navigazione, comandi) — **non** i consigli moduli |

**Posizionamento:** non “siamo più economici di xFarm”, ma **ERP modulare + assistente sui dati reali dell’azienda — paghi solo ciò che usi**.

**Gap principale oggi:** avete una **strategia di pricing** e parte del **motore consigli moduli**; mancano **enforcement Free**, **pagamenti reali**, **canale di acquisizione** e **messaggio commerciale semplificato** (pacchetti oltre al menu à la carte).

---

## 2. Decisioni chiuse — non contraddire

Queste decisioni sono state prese esplicitamente con il product owner (giugno 2026). Un agente futuro **non deve** riaprirle senza nuova richiesta.

| # | Decisione | Motivo |
|---|-----------|--------|
| D1 | **Tony consigliere moduli = solo piano Base** (Tony Guida), **mai Free** | Sul Free i moduli sono bloccati; consigliare moduli crea frustrazione o funnel a due passi confuso |
| D2 | **Tony Operativo (modulo `tony` a pagamento) resta separato** | Monetizza automazione; non confondere con la guida |
| D3 | **Il consigliere non promuove Tony Avanzato** | Upsell moduli verticali, non il modulo Tony |
| D4 | **Non catalogare “tipi di azienda”** (viticoltore, misto, …) | Le aziende sono troppo eterogenee; usare **segnali operativi** (terreni, clienti, attività, moduli attivi) |
| D5 | **Consigli anche con moduli già attivi** | Proporre **complementi** (es. Vigneto → Magazzino), non solo “da zero” |
| D6 | **Tono non invasivo** | Max 1–2 suggerimenti per turno; **no** upsell su “cosa c’è in tabella”; tono da collega, non venditore |
| D7 | **Freemium senza pubblicità** | B2B agricolo: ads rovinano credibilità |
| D8 | **Prezzo basso = leva ingresso** finché brand = zero | Non è il posizionamento definitivo a 5 anni |

---

## 3. Verità prodotto — cosa c’è nel codice (2026-06-19)

### 3.1 Piani e prezzi (fonte: `core/config/subscription-plans.js`)

**Piani attivi in codice:** solo `free` e `base` (Starter/Pro/Enterprise nei vecchi doc **non** sono il modello operativo).

| Piano | Prezzo | Limiti config | Tony |
|-------|--------|---------------|------|
| Free | €0 | max 5 terreni, max 30 attività/mese | **Assente** (widget bloccato, CF rifiutano) |
| Base | €5/mese | Terreni/attività illimitati | **Tony Guida** |

**Moduli (prezzi mensili in config):**

| ID | Nome | €/mese | Note |
|----|------|--------|------|
| manodopera | Manodopera | 6 | |
| contoTerzi | Conto Terzi | 6 | |
| parcoMacchine | Parco Macchine | 3 | |
| vigneto | Vigneto | 3 | |
| frutteto | Frutteto | 3 | |
| magazzino | Prodotti e Magazzino | 3 | |
| meteo | Meteo | 1 | |
| report | Report/Bilancio | 5 | |
| tony | Tony Avanzato | 5 | Operativo |
| oliveto | Oliveto | 3 | `available: false` (prossimamente) |

**Bundle:** `BUNDLES` in stesso file (es. Operativo Vigneto €10, Business Completo €9, …). Usati da pagina Abbonamento (`getSuggestedBundles()`).

### 3.2 Tony consigliere moduli — **implementato**

| Componente | Path |
|------------|------|
| Config segnali → moduli | `functions/config/tony-module-recommendations.json` (+ mirror `core/config/`) |
| Motore hint + quick reply | `functions/tony-module-recommendations.js` |
| Integrazione tonyAsk | `functions/index.js` — `azienda.consigliModuli`, `segnaliAziendaModuli`, `TONY_MODULE_RECOMMENDATION_RULES` |
| Gating piano | Solo se `subscriptionPlanId !== 'free'` |
| Test | `tests/tony-module-recommendations.test.js` |

**Comportamento chiave:**

- **Trigger “scoperta”:** segnali da terreni (share coltura), clienti, macchine, trattamenti, ecc.
- **Complementi:** dopo modulo attivo, suggerisce moduli collegati (grafo in config).
- **Gating dati legacy:** se Conto Terzi **disattivo**, clienti/preventivi **non** contano per “scoperta” (evita falsi positivi); hint **`reactivate`** se dati archivio esistono.
- **Quick reply deterministica** su domande esplicite (“quali moduli mi servono?”) prima di Gemini.
- **`skipModuleIds`:** include `tony` — non suggerire Tony Avanzato come modulo da attivare via consigliere.

**Decisione registrata:** `docs-sviluppo/TONY_DECISIONI_E_REQUISITI.md` §1.7 (stato: implementato).

### 3.3 Cosa NON è ancora implementato (critico per marketing)

| Area | Stato | Impatto commerciale |
|------|--------|---------------------|
| **Limiti Free enforced** | Solo in config (`maxTerreni`, `maxAttivitaMese`) — **non applicati** in CRUD operativo | Free de facto illimitato → nessuna spinta a Base |
| **Allineamento utenti Free** | Config dice “Utenti illimitati”; strategia doc dice “1 admin” | Trigger upgrade debole |
| **Pagamenti reali (Stripe)** | Abbonamenti **simulati** (`COME_FAR_PROVARE_APP.md`) | Strategia non validata |
| **Go-to-market** | Nessun sito/canale sistematico | Freemium senza funnel |
| **Card statica Free su Abbonamento** | Opzionale discussa, **non fatta** | Free→Base senza hint visivi da segnali |
| **Chip dashboard “Tony suggerisce…”** | Opzionale discussa, **non fatta** | Consigli solo in chat Tony |
| **Deep link Abbonamento da Tony** | Parziale / da verificare in UX | Conversione moduli |
| **Pacchetti “chiavi in mano” in landing** | Solo bundle in app | Complessità per utente medio |
| **Preference tenant** (`interessatoVigneto`, …) | Fase 2 discussa, **non fatta** | Fallback per aziende ambigue |

---

## 4. Architettura commerciale — funnel a tre livelli

```
┌─────────────┐     limiti + Abbonamento      ┌─────────────┐     consigli moduli      ┌──────────────┐
│    FREE     │  ─────────────────────────►  │    BASE     │  ───────────────────►  │   MODULI     │
│  prova core │     €5/mese, Tony Guida      │  app piena  │   pay-per-use          │  valore      │
└─────────────┘                              └─────────────┘                        └──────────────┘
       │                                            │                                        │
       │  (opz.: card statica hint, no LLM)         │  Tony consigliere (LLM + segnali)        │  Tony Avanzato
       │                                            │  tono collega, max 1-2 suggerimenti      │  (automazione €5)
       └────────────────────────────────────────────┴────────────────────────────────────────┘
```

**Messaggio per livello:**

- **Free:** “Prova il diario e i terreni — quando ti serve di più, passa a Base.”
- **Base:** “Tony ti guida nell’app e ti aiuta a scegliere i moduli giusti per la tua azienda.”
- **Moduli:** “Attiva solo Vigneto, Manodopera, … — Tony spiega i flussi tra moduli.”
- **Tony Avanzato:** “Tony compila i form e naviga per te — modulo separato per chi vuole automazione.”

---

## 5. Tony consigliere — regole prodotto (per copy e implementazione)

### 5.1 Quando suggerire (SÌ)

- Utente chiede esplicitamente: “quali moduli”, “cosa mi serve”, “non ho X”
- Spieghi un **flusso incompleto** perché manca un modulo (es. trattamento senza scarico magazzino)
- Onboarding / pochi dati: **una** domanda mirata (“Hai squadre? Clienti esterni?”), non questionario
- Dopo attivazione modulo: **un** complemento correlato

### 5.2 Quando NON suggerire (NO)

- Domande contenuto tabella / “cosa c’è in lista”
- Ogni messaggio o chiusura conversazione
- Piano **Free**
- Promozione **Tony Avanzato** come “modulo da attivare per consigli”

### 5.3 Tono (esempi)

**Buono:**  
“Vedo diversi appezzamenti a vite — per vendemmia e registri coltura c’è il modulo Vigneto. Lo attivi da Abbonamento quando vuoi.”

**Cattivo:**  
“Acquista subito Vigneto! Offerta limitata!”

### 5.4 Segnali (no tassonomia)

Usare pesi da config, non etichette “tipo azienda”. Riferimento grafo flussi: `core/guida-app/intersezioni-moduli.md`.

Esempi segnale → modulo:

| Segnale | Modulo suggerito |
|---------|------------------|
| Share coltura Vite alta | Vigneto |
| Terreni clienti / clienti attivi (modulo CT attivo o dati legacy → reactivate) | Conto Terzi |
| Hint meccanico / macchine | Parco Macchine |
| Trattamenti/concimazioni | Magazzino |
| Molti terreni + lavori clienti | Manodopera |
| Domande meteo operative | Meteo |

---

## 6. Posizionamento e messaggio esterno

### 6.1 Wedge (differenziazione)

1. **Modularità reale** — paghi moduli, non piano monolitico
2. **Tony sui dati dell’azienda** — non chat generica
3. **Specializzazione colture italiane** — vigneto, frutteto, conto terzi, manodopera
4. **Prezzo ingresso basso** — compensazione brand zero (temporaneo)

### 6.2 Cosa evitare in comunicazione

- “ERP agricolo generico”
- Guerra prezzi pura vs xFarm / Farmable / Agricolus
- Presentare **solo** il configuratore moduli (troppo complesso per cold traffic)
- Promettere Tony Operativo nel Free o nel messaggio Base senza distinguere Guida vs Avanzato

### 6.3 One-liner proposto

> *ERP modulare per viticoltori e aziende miste italiane, con assistente AI che lavora sui tuoi dati — paghi solo i moduli che usi.*

---

## 7. Offerta commerciale semplificata (da implementare in marketing)

Oltre al modulare à la carte (resta per power user), vendere **2–3 pacchetti** in landing / sales:

| Pacchetto | Contenuto indicativo | Prezzo target | Target |
|-----------|----------------------|---------------|--------|
| **Viticoltore** | Base + Vigneto + Manodopera (+ opz. Meteo) | ~€12–15/mese | Cantine, viticoltori |
| **Servizi / Conto terzi** | Base + Conto Terzi + Report | ~€14–16/mese | Imprese servizi |
| **Operativo campo** | Base + Manodopera + Parco Macchine | ~€12–14/mese | Squadre + mezzi |

**Nota:** i bundle esistono già in `BUNDLES`; il lavoro marketing è **packaging e copy**, non ricalcolo prezzi da zero.

---

## 8. Roadmap implementazione (priorità per agente)

### Fase 0 — Validare (prima di scalare marketing)

1. **5–10 pilot** reali (viticoltori, conto terzi, squadre) — feedback + prezzo accettato
2. **Enforcement limiti Free** (5 terreni, 30 attività/mese) + messaggi chiari al limite
3. **Allineare Free tier utenti** (1 admin vs illimitati — decidere e implementare)
4. **Stripe (o equivalente)** — abbonamenti non simulati
5. Metriche: registrazioni, attivazione Base, moduli per tenant, churn

### Fase 1 — Conversione in-app (prodotto)

1. **Card statica Abbonamento (Free)** — stesse regole di `tony-module-recommendations.json`, **zero LLM**
2. **Chip/banner dashboard (Base)** — “Per i tuoi terreni a vite: modulo Vigneto” — dismissible, da `consigliModuli`
3. **Deep link** Tony → pagina Abbonamento con modulo pre-selezionato
4. **Messaggi al limite Free** che spiegano Base + Tony Guida (non solo “upgrade”)

### Fase 2 — Canale acquisizione (scegliere 1–2, non 5)

Opzioni discusse, non ancora scelte ufficialmente:

- **Consulenti / enologi / agronomi** — rev share o trial esteso
- **Cantine sociali / cooperative** — multi-tenant, contratto unico
- **SEO / content** — problemi concreti (“gestione vendemmia”, “compensi operai”)
- **Tony come hook** — video demo 60s: diario free vs assistente Base

### Fase 3 — Consigliere moduli v2 (opzionale)

- `tenants.preferences` da risposte sì/no utente
- Più trigger (attività diario, tipi lavoro usati)
- A/B tono e frequenza suggerimenti
- Analytics: suggerimento → click Abbonamento → attivazione modulo

---

## 9. Metriche realistiche

**Non pianificare** su “1000 utenti, 50% paganti”. Per freemium B2B tipico: **2–10%** free→paid.

Pianificare scenari:

| Scenario | Utenti registrati | Paganti | Nota |
|----------|-------------------|---------|------|
| Pilota | 10–50 | 3–15 | Validazione |
| Anno 1 conservativo | 200 | 10–30 | Con 1 canale GTM |
| Anno 1 ottimistico | 500 | 50–100 | Con partner + product-market fit |

---

## 10. Documentazione legacy — cosa ignorare

| Documento | Problema |
|-----------|----------|
| `STRATEGIA_FREEMIUM_MODULARE.md` | Contiene ancora Starter €9 / Pro €29 / Enterprise €49 e prezzi moduli **non allineati** al codice attuale |
| `STRATEGIA_FREEMIUM_PUBBLICITA.md` | Modello con ads — **abbandonato** (D7) |
| Vecchi piani a scaffale | Sostituiti da Free + Base €5 + moduli |

**Fonte prezzi canonica:** `core/config/subscription-plans.js`  
**Fonte decisioni Tony:** `docs-sviluppo/TONY_DECISIONI_E_REQUISITI.md`  
**Stato Tony tecnico:** `docs-sviluppo/tony/STATO_ATTUALE.md`, `docs-sviluppo/tony/MASTER_PLAN.md`

---

## 11. File codice — mappa rapida per agente

| Obiettivo | File |
|-----------|------|
| Prezzi, moduli, bundle | `core/config/subscription-plans.js` |
| Pagina Abbonamento UI | `modules/abbonamento/` (standalone) |
| Consigliere moduli config | `functions/config/tony-module-recommendations.json` |
| Motore consigli | `functions/tony-module-recommendations.js` |
| Gate piano Free / moduli | `functions/index.js`, `functions/tony-module-gate.js` |
| Flussi cross-modulo (copy) | `core/guida-app/intersezioni-moduli.md` |
| Tony widget / Guida vs Avanzato | `core/js/tony/main.js`, `functions/index.js` (SYSTEM_INSTRUCTION_BASE/ADVANCED) |
| Regole agente nuove pagine Tony | `.cursor/rules/tony-pagina-lista-e-form.mdc` |

---

## 12. Checklist agente — “sono allineato?”

Prima di implementare marketing o upsell, verificare:

- [ ] Non metto Tony consigliere sul **Free**
- [ ] Non confondo **Tony Guida** (Base) con **Tony Avanzato** (modulo `tony`)
- [ ] Non promuovo Tony Avanzato nel flusso consigli moduli
- [ ] Uso **segnali**, non “tipi di azienda” rigidi
- [ ] Rispetto **gating moduli** su dati legacy (Conto Terzi disattivo → no falso “hai clienti”)
- [ ] Prezzi da `subscription-plans.js`, non da doc vecchi
- [ ] Tono **non invasivo** (max 1–2 moduli, no spam)
- [ ] So cosa è **già fatto** (§3.2) vs **backlog** (§3.3, §8)

---

## 13. Domande aperte (product owner — non decise)

1. **Target primario 12 mesi:** viticoltore, generico, o conto terzi?
2. **Obiettivo clienti paganti:** 10, 100, 1000? (cambia GTM)
3. **Free utenti:** 1 admin fisso o illimitati come in config oggi?
4. **Card statica Free:** priorità vs Stripe?
5. **Canale GTM #1:** consulenti, cooperative, SEO, altro?

Finché non risposte, agente marketing deve **non inventare** — implementare Fase 0 e packaging pacchetti con copy neutro.

---

## 14. Changelog documento

| Data | Autore | Nota |
|------|--------|------|
| 2026-06-19 | Sessione strategia + implementazione Tony consigliere | Creazione handoff post-allineamento Free/Base/consigliere; stato codice verificato |
| 2026-06-19 | Allineamento documentazione obbligatoria | COSA_ABBIAMO_FATTO, STATO_ATTUALE, MASTER_PLAN, TONY_DECISIONI; HANDOFF_TTS, README Tony, banner STRATEGIA_FREEMIUM |

---

*Per aggiornamenti tecnici Tony consigliere: `docs-sviluppo/COSA_ABBIAMO_FATTO.md` (voci 2026-06-19). Questo file va aggiornato quando cambiano decisioni commerciali chiuse (§2) o il modello piani in `subscription-plans.js`.*
