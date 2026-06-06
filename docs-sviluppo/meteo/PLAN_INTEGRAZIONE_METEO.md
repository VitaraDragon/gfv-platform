# Piano integrazione Meteo — GFV Platform

**Data creazione**: 2026-05-19  
**Ultimo aggiornamento**: 2026-05-22  
**Stato**: **Meteo base (fasi 0–3) in produzione** — **modulo Meteo pay-per-use (fasi 4–5) implementato** — **fase 6 Tony in corso** (chat operativa 2026-05-21; praticabilità morfologia + **`lavoroCampo`** + **asciugatura** + **doppia alternativa** 2026-05-22)  
**Provider**: [OpenWeatherMap](https://openweathermap.org) — **One Call API 3.0**

**Obiettivo del documento**: traccia unica delle decisioni di prodotto e tecniche per il meteo GFV, per continuare lo sviluppo (anche con altri agenti) senza perdere contesto.

---

## 1. Visione prodotto

Integrare il meteo in GFV come supporto operativo agricolo (pianificazione lavori, trattamenti, sospensioni per pioggia/vento), con **due livelli commerciali**:

| Livello | Piano / modulo | Meteo | Punto geografico |
|---------|----------------|-------|------------------|
| **Assente** | Free (freemium) | Nessun widget, nessuna API | — |
| **Meteo base** ✅ | Base (app a pagamento) | Widget compatto in dashboard | **Sede aziendale** (pin in Impostazioni) |
| **Modulo Meteo** ✅ | Base + modulo opzionale (~**€1/mese**) | Widget espanso + pagina dedicata | Sede + **terreni/poderi** |

**Regola UI**: il meteo compare in **dashboard** quando disponibile; il modulo a pagamento **espanderà** lo stesso widget (non previsto cambiare posizione).

**Escluso da MVP base**: prodotti OpenWeather **For Business / Agro API / AgroMonitoring** (satellite, NDVI). Valutabile in futuro a parte.

---

## 2. Decisioni di prodotto (chiuse)

### 2.1 Gating piani

- **Free / freemium**: meteo assente (widget nascosto; CF `permission-denied`).
- **Base+**: meteo base incluso.
- **Modulo `meteo`** (futuro): funzioni avanzate con `moduli_attivi.includes('meteo')`.

Pattern allineato a Tony: `plan === 'free'`, evento `gfv-subscription-plan` in dashboard.

### 2.2 Sede aziendale ✅ implementato

- **Impostazioni → Informazioni Azienda**: mappa Google (satellite), pin trascinabile, click sulla mappa.
- **Barra ricerca indirizzo** dedicata (`#sede-map-search`) + pulsante Cerca + Invio; opzione **Da anagrafica** (campi indirizzo/CAP/città).
- Campo Firestore sul tenant:

```javascript
sedeCoordinate: { lat: number, lng: number }  // opzionale
```

- Se assente: widget con messaggio + link a Impostazioni; CF restituisce `{ ok: false, code: 'SEDE_NOT_SET' }` senza chiamare OpenWeather.

### 2.3 Modulo Meteo a pagamento ✅ implementato

- Voce **`meteo`** in `subscription-plans.js` (€1/mese, utility).
- Pagina **`modules/meteo/views/meteo-dashboard-standalone.html`**, callable `getMeteoSedeAvanzato` e `getMeteoTerreni`.
- Gating: `tenant.modules` / `moduli_attivi` include `meteo`.

### 2.4 Contenuti per livello

**Meteo base ✅ (in produzione):**

| Elemento | Implementato |
|----------|--------------|
| Temperatura attuale + descrizione (IT) | ✅ |
| Icona condizione OpenWeather | ✅ |
| Vento (km/h) + umidità | ✅ |
| Min/max oggi + sintesi domani | ✅ |
| Un punto: sede | ✅ |
| Cache server 15 min | ✅ |
| Attribuzione OpenWeather in UI | ✅ |

**Modulo Meteo ✅:** meteo per terreno (centroide poligono/coordinate), alert One Call, previsioni orarie ~48h e giornaliere ~8 giorni, pagina modulo, widget dashboard espanso. **Fase 6 Tony:** chat operativa, pianificazione trattamento/lavorazione, praticabilità × morfologia (§11.6–§11.7).

---

## 3. Provider e account OpenWeather

### 3.1 API

**One Call API 3.0** — in produzione la CF usa:

```
GET https://api.openweathermap.org/data/3.0/onecall
  ?lat={lat}&lon={lon}&appid={SECRET}&units=metric&lang=it
  &exclude=minutely,hourly,alerts
```

(`exclude` riduce payload per il meteo base; il modulo futuro potrà includere hourly/alerts.)

### 3.2 Account

1. Registrazione [home.openweathermap.org](https://home.openweathermap.org)
2. API key dedicata app (non in repo / non in frontend)
3. Sottoscrizione **One Call by Call** (1.000 call/giorno gratis)
4. Secret Firebase: `firebase functions:secrets:set OPENWEATHER_API_KEY`

### 3.3 Costi

Cache 15 min + un punto per tenant → consumo OW contenuto per molti tenant su tier gratuito.

---

## 4. Architettura tecnica (meteo base — implementata)

### 4.1 Componenti

| Componente | Path |
|------------|------|
| Logica server | `functions/meteo-service.js` (callable + **Tony quick reply operativo**) |
| Regole Tony meteo | `functions/tony-meteo-rules.js` (+ mirror `core/config/tony-meteo-rules.js`) |
| Callable export | `functions/index.js` → `getMeteoSede`, `getMeteoSedeAvanzato`, `getMeteoTerreni` |
| Client callable | `core/services/meteo-service.js` |
| Widget UI | `core/js/dashboard-meteo.js`, `createDashboardMeteoSection`, `createMeteoCard` |
| Pagina modulo | `modules/meteo/views/meteo-dashboard-standalone.html` |
| Abbonamento | `core/config/subscription-plans.js` → modulo `meteo` |
| Pin sede | `core/admin/impostazioni-standalone.html` |
| Stili | `core/styles/dashboard.css`, `modules/meteo/css/meteo-dashboard.css` |
| Regole Firestore | `firestore.rules` → `meteoCache/{document=**}` deny client |

### 4.2 Flusso

```
Dashboard (piano Base+)
  → fetchMeteoSede(tenantId)
  → getMeteoSede (CF, europe-west1)
      → verifica auth + membership tenant
      → verifica piano ≠ free
      → legge sedeCoordinate
      → cache meteoCache/sede (15 min)?
      → One Call 3.0 → normalizza → salva cache → JSON
  → render widget (#dashboard-meteo-widget)
```

### 4.3 Cache Firestore

```
tenants/{tenantId}/meteoCache/sede
  lat, lng, normalized, fetchedAt
```

Solo Admin SDK (Cloud Functions). Client **non** legge la cache.

### 4.4 Payload normalizzato (risposta CF)

```javascript
{
  ok: true,
  cached: boolean,
  meteo: {
    location: { lat, lng, label },
    current: { temp, feelsLike, description, icon, windSpeedKmh, windDeg, humidity },
    today: { tempMin, tempMax, pop, description },
    tomorrow: { tempMin, tempMax, pop, description },
    updatedAt: ISO8601,
    attribution: 'OpenWeather'
  }
}
```

Codici errore business (non throw): `SEDE_NOT_SET`. Piano Free: `HttpsError permission-denied`.

---

## 5. Deploy e operatività

### Secret

```powershell
firebase functions:secrets:set OPENWEATHER_API_KEY
```

### Deploy (prima pubblicazione function nuova)

```powershell
firebase deploy --only "functions,firestore:rules"
```

**Nota PowerShell:** mettere i filtri tra virgolette. Per una **nuova** callable, `--only functions:getMeteoSede` può fallire con *No function matches given --only filters* finché la function non esiste già in cloud — usare `functions` intero al primo deploy.

### Verifica

1. Tenant piano **Base** (non Free)
2. `sedeCoordinate` salvata in Impostazioni
3. Dashboard → card **Meteo sede** con temperatura e previsioni brevi
4. Console: nessun errore su callable `getMeteoSede`

---

## 6. Roadmap implementazione

| Fase | Deliverable | Stato |
|------|-------------|-------|
| **0** | Secret `OPENWEATHER_API_KEY` | ✅ |
| **1** | Pin sede + barra ricerca + `sedeCoordinate` | ✅ |
| **2** | CF `getMeteoSede` + cache + gating Base | ✅ |
| **3** | Widget dashboard meteo base | ✅ verificato produzione |
| **4** | Modulo in abbonamento + gating `moduli_attivi` | ✅ |
| **5** | Meteo per terreno, alert, pagina dedicata | ✅ |
| **6** | Lavori / trattamenti / Tony | ⏳ **In corso** — Sprint 1–6 (chat 8 gg, pianificazione trattamento/**lavorazione terreno**, praticabilità × morfologia, asciugatura post-pioggia, doppia alternativa prima/dopo); resto: FILTER_TABLE meteo, proattività cross-modulo, UI soglie tenant |

**Decisione 2026-05-19:** la **versione base resta così** fino a lavorazione esplicita del modulo a pagamento.

---

## 7. Checklist agente

**Meteo base (fatto):**

- [x] Piano documentato in questo file
- [x] Free = no meteo
- [x] `sedeCoordinate` + Impostazioni
- [x] Key solo server (secret)
- [x] One Call 3.0 (non Agro API)
- [x] Cache Firestore
- [x] Attribuzione UI
- [x] Deploy produzione verificato

**Modulo Meteo:**

- [x] Voce in `subscription-plans.js`
- [x] CF `getMeteoSedeAvanzato`, `getMeteoTerreni` + cache terreni
- [x] Pagina modulo + widget dashboard espanso
- [ ] GUIDA utente (checklist guida separata)

---

## 8. Esclusioni esplicite

- Meteo su piano Free
- API key nel browser
- Agro API nel MVP base
- Meteo multi-punto senza modulo a pagamento

---

## 9. Documentazione correlata

| Documento | Uso |
|-----------|------|
| `docs-sviluppo/COSA_ABBIAMO_FATTO.md` | Voce riepilogo meteo base + Tony operativo |
| `docs-sviluppo/TONY_DECISIONI_E_REQUISITI.md` | **§19** — praticabilità, tre assi, asciugatura, doppia alternativa (canone prodotto) |
| `docs-sviluppo/tony/STATO_ATTUALE.md` | Stato fase 6 meteo/Tony verificato sul codice |
| `functions/README.md` | Sezione callable `getMeteoSede` |
| `docs-sviluppo/STRATEGIA_FREEMIUM_MODULARE.md` | Piani Free vs Base |
| `core/config/subscription-plans.js` | Futuro modulo `meteo` |

---

## 10. Storico

| Data | Evento |
|------|--------|
| 2026-05-19 | Piano prodotto: OpenWeather One Call 3.0, base vs modulo ~€1 |
| 2026-05-19 | Fase 1: pin sede Impostazioni |
| 2026-05-19 | Barra ricerca indirizzo sede |
| 2026-05-19 | Fasi 2–3: `getMeteoSede` + widget dashboard |
| 2026-05-19 | Deploy produzione OK — widget meteo visibile in dashboard |
| 2026-05-19 | **Chiusura scope meteo base** — modulo a pagamento posticipato |
| 2026-05-19 | **Fasi 4–5:** modulo `meteo` in abbonamento, CF avanzate, pagina terreni, widget espanso |
| 2026-05-19 | **Fase 6 — decisioni Tony:** matrice Free (no Tony) / Guida / Avanzato / meteo (§11) |
| 2026-05-19 | **Fase 6 — implementazione Tony (Sprint 1–4):** Context Builder meteo, consigli, pagina `meteo_dashboard`, APRI_PAGINA meteo |
| 2026-05-21 | **Fase 6 — chat meteo 8 gg, quick reply, pianificazione trattamento** (implementato) |
| 2026-05-21 | **Decisioni praticabilità terreno × morfologia** (soglie mm, form terreno, config tenant) — v. §11.6 e TONY_DECISIONI §19 |
| 2026-05-22 | **Lavorazione terreno (`lavoroCampo`)** — stessa pipeline trattamenti, solo pioggia (no vento), praticabilità anche senza terreno citato |
| 2026-05-22 | **Asse B bis asciugatura** — N giornate asciutte dopo pioggia significativa (2 collina/montagna, 1 pianura) |
| 2026-05-22 | **Doppia alternativa** — dopo rifiuto praticabilità o «cerca un'altra data»: prima data utile **prima** + **dopo** il giorno scartato |
| 2026-05-22 | Fix filo chat (Pinot/erpicatura): «sì» non attiva briefing dashboard; pivot giorno da messaggio Tony |

---

## 11. Fase 6 — Tony + meteo (decisioni prodotto chiuse)

**Data decisione:** 2026-05-19 (conferma utente).

### 11.1 Matrice gating Tony ↔ meteo

| Piano / moduli | Widget meteo UI | Tony | Domanda meteo in chat |
|----------------|-----------------|------|------------------------|
| **Free (freemium)** | Assente | **Assente** | **Non applicabile** — nessuna chat Tony, nessun meteo in app. |
| **Base** (senza modulo **Tony Avanzato**) | **Meteo base sede** (widget dashboard) | **Solo Tony Guida** (manuale / navigazione spiegata) | **Non risponde** su meteo/previsioni: rimanda al **widget Meteo** in dashboard o invita ad attivare **Tony Avanzato** per domande sui dati. |
| **Base + Tony Avanzato** | Meteo base sede | Tony operativo | **Riporta** meteo sede (fatti: temp, oggi/domani, vento, umidità). **Niente consigli** su lavori/trattamenti/pianificazione. |
| **Base + Tony Avanzato + modulo `meteo`** | Widget espanso + pagina modulo | Tony operativo | **Consigli, analisi, proattività** su lavori, trattamenti, pianificazione (`consigli` + regole config). |

**Regole:**
- Meteo in **UI** (widget): Base+ incluso nel core; Free no.
- Meteo in **chat Tony**: solo con **Tony Avanzato** attivo; consigli operativi solo anche con **modulo `meteo`** attivo.
- **Tony Guida** (Base senza modulo `tony`): stesso gating già in produzione per JSON/comandi — estendere al meteo (solo guida testuale, niente lettura previsioni).

### 11.2 Context Builder (decisioni tecniche)

1. **Sempre-on con cache** (solo se utente può usare meteo via Tony): `buildContextMeteo` legge/aggiorna `meteoCache/*` (TTL 15 min) quando piano **Base+** e modulo **Tony Avanzato** attivo; niente fetch OW per ogni messaggio se cache valida.
2. **Terreni in contesto:** fino a **30** appezzamenti **solo se** modulo **`meteo`** attivo; con solo Tony Avanzato → solo blocco `sede`.
3. **Soglie operative** (vento, pioggia, pop trattamenti): default in **`core/config/tony-meteo-rules.js`** (+ mirror server); override tenant in fase successiva. Usate **solo** se modulo `meteo` + Tony Avanzato.
4. **Tony Guida / Free:** non includere `azienda.meteo` nel contesto CF (o includere flag `meteoChatDisponibile: false`) per evitare risposte inventate.

### 11.3 Comportamento Tony per livello

**Free (freemium):**
- Tony **non presente**; widget meteo **assente**. Nessun flusso chat meteo.

**Base + Tony Guida** (senza modulo `tony` / Tony Avanzato) + domanda meteo:
- **Non** leggere previsioni né `azienda.meteo`.
- Risposta guida: indica il **widget Meteo** in dashboard (se sede impostata) o Impostazioni per la sede; per domande vocali/testuali sui dati suggerisce **Tony Avanzato** in Abbonamento.
- `command: null` (nessun `APRI_PAGINA` meteo operativo — coerente con gating Guida).

**Base + Tony Avanzato + domanda meteo:**
- Usare `ctx.azienda.meteo.sede` e `summaryMeteo` (Context Builder).
- Consentire `APRI_PAGINA` target `meteo` se utile.
- **Vietato** nel prompt: consigli su trattamenti/lavori, analisi per terreno, congetture oltre i dati sede.

**Tony Avanzato + modulo `meteo`:**
- Contesto: sede estesa + `terreni[]` compatto + `consigli[]` da `tony-meteo-rules`.
- Proattività: alert, pioggia imminente su terreni con **lavori** programmati, date **trattamento** a rischio.
- `condizioniMeteo` su form trattamento: suggerimento opzionale, conferma utente prima del salvataggio.

### 11.4 Deliverable fase 6 (roadmap)

| Sprint | Contenuto |
|--------|-----------|
| 1 | `buildContextMeteo` + prompt gating Free/Base/Modulo in `functions/index.js` |
| 2 | `currentTableData` pagina modulo meteo (`pageType: meteo_dashboard`) |
| 3 | `APRI_PAGINA` target `meteo` + deep link terreno |
| 4 | `tony-meteo-rules` + `consigli` (solo modulo meteo + Tony) |
| 5 | Proattività lavori/trattamenti + `condizioniMeteo` |
| 6 | **Praticabilità terreno** per morfologia + **`lavoroCampo`** + asciugatura + doppia alternativa — v. §11.6–§11.7 |

### 11.5 Esclusioni fase 6

- Agro API / NDVI
- Risposte meteo via Tony su **Free** (Tony assente) o **Tony Guida** (Base senza modulo `tony`)
- Consigli meteo-operativi senza **modulo `meteo`** attivo
- Inventare previsioni se cache/CF non disponibili
- **Storico pluviometrico** (mm realmente caduti ieri/settimana) con sola One Call 3.0 — v. decisione 2026-05-21 in `TONY_DECISIONI_E_REQUISITI.md` §19.1

### 11.6 Praticabilità terreno per morfologia (implementato 2026-05-22)

**Traccia decisioni:** `docs-sviluppo/TONY_DECISIONI_E_REQUISITI.md` §19 (canone prodotto).

| Tema | Decisione |
|------|-----------|
| Dati pioggia | Solo **mm previsti** OW (~8 gg); lookback su giorni precedenti al giorno candidato; **no** storico mm realmente caduti |
| Morfologia | `tipoCampo` per **terreno** (pianura/collina/montagna) nel form; se manca Tony chiede e salva (`tipoCampoOverride` nel filo chat) |
| Logica | **Tre assi:** A meteo giorno (pop/mm; vento solo trattamenti) + B praticabilità (somma mm lookback × morfologia) + **B bis asciugatura** (solo `lavoroCampo`) |
| Soglie default mm | Pianura 0–20 ok, 20–50 chiedi, >50 no · Collina 0–3 attenzione, 3–10 chiedi, **≥10 no** · Montagna 0 ok, 2–5 chiedi, >5 no |
| Fascia «chiedi» | Tony chiede se il campo resta praticabile (lavorazione terreno / passaggio trattore) |
| Doppia alternativa | Dopo rifiuto o «cerca un'altra data»: **prima** data utile prima del giorno scartato + **prima dopo** (con asciugatura se lavorazione) |
| Config | Soglie **default** hardcoded; override **tenant** in Impostazioni — UI passo successivo |

**File:** `functions/tony-meteo-rules.js`, `functions/meteo-service.js`, mirror `core/config/tony-meteo-rules.js`, form `terreno-tipo-campo`, Context Builder `tipoCampo`.

**Test:** `tests/meteo-tony-quick-reply.test.js` (55), `tests/tony-meteo-rules.test.js` (15).

### 11.7 Chat operativa Tony — pianificazione trattamento e lavorazione (2026-05-22)

Quick reply deterministica in **`tryMeteoOperativoQuickReply`** (`functions/meteo-service.js`), prioritaria in `tonyAsk` prima di Gemini.

| Tipo attività | `activityKind` | Asse A | Asse B | Asse B bis |
|---------------|----------------|--------|--------|------------|
| Trattamento fitosanitario | `trattamento` | pop, mm, vento ≤ 15 km/h | lookback mm × morfologia | — |
| Lavorazione terreno (erpicare, aratura, …) | `lavoroCampo` | pop, mm (**no vento**) | lookback mm × morfologia | gg asciutti dopo pioggia |

**Flusso tipico:**

1. «Posso erpicare/trattare giovedì?» → valutazione completa del giorno.
2. Fascia intermedia (es. 9,9 mm collina) → «riesci a lavorare il terreno / passare con il trattore?»
3. «No» o «cerca un'altra data» → **`buildDualAlternativaOperativaReply`**: due proposte (anticipare + posticipare) se entrambe esistono nel forecast ~8 gg.
4. Giorni esclusi in chat («il 25 non posso») restano esclusi anche nelle proposte.
5. Richiesta esplicita «data **dopo il** N» → solo scansione posticipata (singola), non doppia alternativa.

**Esempio asciugatura (collina, giovedì 10 mm):** venerdì/sabato scartati (0–1 gg asciutti); **domenica** prima data «dopo» proponibile (2 gg asciutti). L'Asse B sul candidato domenica valuta solo lookback ven+dom; l'Asse B bis copre il tempo dopo l'ultimo giorno bagnato.

**Client:** `core/js/tony/main.js` — `tonyIsPendingMeteoInterviewReply` evita che «sì» al filo meteo attivi il briefing dashboard.

**Backlog UX:** riconoscere scelta utente tra le due date proposte («facciamo martedì») e collegare alla pianificazione lavoro.

---

**Prossimo passo:** UI Impostazioni soglie praticabilità tenant; FILTER_TABLE `meteo_dashboard` (opzionale); follow-up scelta tra le due date proposte.
