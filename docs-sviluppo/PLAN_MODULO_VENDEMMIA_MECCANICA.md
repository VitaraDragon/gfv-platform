# Piano implementazione: Modulo Vendemmia Meccanica

**Data creazione**: 2026-07-03  
**Ultimo aggiornamento**: 2026-07-03  
**Stato**: 📋 Pianificato — non ancora implementato  
**Priorità**: Alta (refactoring/evoluzione da `vecchia app/`)  
**Dipendenza obbligatoria**: Modulo **Conto Terzi** (`contoTerzi`)  
**Dipendenze opzionali**: Report (`report`), Preventivi/Lavori CT (già in CT), Parco Macchine, Vigneto (solo collegamenti espliciti)

---

## Indice

1. [Obiettivo e posizionamento](#1-obiettivo-e-posizionamento)
2. [Decisioni prese](#2-decisioni-prese)
3. [Da decidere o verificare](#3-da-decidere-o-verificare)
4. [Architettura modulo](#4-architettura-modulo)
5. [Modello dati](#5-modello-dati)
6. [Tariffe e calcolo compenso](#6-tariffe-e-calcolo-compenso)
7. [Zone non vendemmiate](#7-zone-non-vendemmiate)
8. [Pagine e UX (hub senza duplicati)](#8-pagine-e-ux-hub-senza-duplicati)
9. [Integrazioni con altri moduli](#9-integrazioni-con-altri-moduli)
10. [Tony (linee guida)](#10-tony-linee-guida)
11. [Migrazione da vecchia app](#11-migrazione-da-vecchia-app)
12. [Riferimenti codice esistente](#12-riferimenti-codice-esistente)
13. [Checklist sviluppo](#13-checklist-sviluppo)

---

## 1. Obiettivo e posizionamento

### Problema che risolve

Gestione **commerciale e operativa** del servizio di **vendemmia meccanizzata a conto terzi** per imprese che lavorano sui vigneti dei clienti:

- Pianificazione stagionale (terreni in piano, avanzamento vendemmia)
- Superficie **effettiva** da fatturare (ettari netti dopo zone escluse)
- Calcolo compenso cliente (vendemmia €/ha + trasporto €/qli)
- Storico calcoli, PDF, bilancio del servizio (ricavi − spese)

### Cosa NON è

| Modulo Vigneto (esistente) | Modulo Vendemmia Meccanica (questo piano) |
|---|---|
| Vigneto **proprio** dell’azienda | Vigneti/terreni **del cliente** (CT) |
| Resa, qualità uva, costi **interni** | **Ricavo** da fatturare al cliente |
| Vendemmia da lavori/diario aziendale | Calcolo compenso + PDF + bilancio servizio |

**Non richiedere** il modulo Vigneto per attivare Vendemmia Meccanica: il target storico (`vecchia app/`) spesso non gestisce vigneti propri.

### Prodotto commerciale

- Modulo separato pay-per-use (es. `vendemmiaMeccanica` in `core/config/subscription-plans.js` — **da definire prezzo e bundle**, v. §3)
- Integrato con Conto Terzi come **fonte dati** (clienti, terreni, morfologia)
- Hub dedicato **snello**: schede verticali VM + **lookup/link** a CT, **senza** duplicare anagrafiche

---

## 2. Decisioni prese

| # | Decisione | Dettaglio |
|---|---|---|
| D1 | **Modulo separato** | Cartella `modules/vendemmia-meccanica/`, licenza dedicata, non “feature nascosta” CT+Vigneto |
| D2 | **Dipendenza hard su Conto Terzi** | Clienti e terreni clienti restano in CT; VM legge/estende, non duplica |
| D3 | **No schede Clienti/Terreni complete nell’hub VM** | Solo link a CT + vista operativa “Piano stagione” + lookup nel calcolatore |
| D4 | **Morfologia su terreno cliente CT** | Campo `tipoCampo` già presente — riusato così com’è |
| D5 | **Tipo palo obbligatorio (VM)** | Da aggiungere su terreno cliente CT; necessario per tariffa vendemmia |
| D6 | **Sesto di impianto obbligatorio (VM)** | Da aggiungere su terreno cliente CT; necessario per tariffe/coefficienti |
| D7 | **Zone non vendemmiate = feature core** | Poligoni su mappa → riducono superficie → calcolo usa `ettariVendemmiati[anno]` |
| D8 | **Tariffe VM dedicate** | Griglia vendemmia (morfologia × tipo palo ± sesto) + tariffe trasporto €/qli per destinazione |
| D9 | **Output ricavi** | Calcoli → Bilancio VM (modulo) → aggregazione Modulo Report (se attivo) |
| D10 | **Integrazione preventivi/lavori CT** | Collegamento bidirezionale opzionale ma previsto in design |
| D11 | **Riferimento implementativo** | Logica e UX da `vecchia app/calcolatore.html`, `anagrafica_clienti.html`, `bilancio.html` |

---

## 3. Da decidere o verificare

> Aggiornare questa sezione man mano che le decisioni vengono chiuse (spostare in §2).

### 3.1 Commerciale e licenze

| ID | Domanda | Opzioni | Stato |
|---|---|---|---|
| O1 | `moduleId` e prezzo mensile | es. `vendemmiaMeccanica` €3–6/mese; bundle `conto-terzi-operativo` + VM | ⬜ Da definire |
| O2 | Trial / incluso in piano Enterprise | Sì/No | ⬜ Da definire |
| O3 | Nome prodotto in UI | “Vendemmia Meccanica”, “Vendemmia Meccanizzata CT”, … | ⬜ Da definire |

### 3.2 Tariffe e sesto

| ID | Domanda | Opzioni | Stato |
|---|---|---|---|
| O4 | Modello tariffa con sesto | **A)** griglia 3D morf×palo×sesto **B)** morf×palo + coefficiente sesto (consigliato) **C)** mix | ⬜ Da decidere |
| O5 | Formato `sestoImpianto` | Distanza fila + ceppo (numeri) vs preset (“standard”, “stretto”, …) vs allineamento a vigneto (`distanzaFile`/`distanzaUnita`) | ⬜ Da decidere |
| O6 | Valori tipo palo | ferro / legno / cemento / personalizzata (vecchia app) — allineare a `modules/vigneto` o lista VM dedicata? | ⬜ Da verificare |
| O7 | Destinazioni trasporto | Lista fissa cantine (sociale, intesa, colli, …) vs configurabile per tenant | ⬜ Da decidere |

### 3.3 Dati e persistenza

| ID | Domanda | Opzioni | Stato |
|---|---|---|---|
| O8 | Dove salvare stato stagione VM | Campo `vendemmiaMeccanica` sul documento terreno (`tenants/.../terreni`) vs sub-doc `.../vendemmia-meccanica-stagione/{anno}` | ⬜ Da decidere |
| O9 | Collection calcoli | `tenants/{t}/calcoli-vendemmia-meccanica` vs sotto `clienti/{id}/calcoli` | ⬜ Da decidere |
| O10 | Collection spese bilancio VM | Dedicata VM vs riuso spese core/CT | ⬜ Da decidere |
| O11 | Terreni clienti: collection effettiva | Verificare path Firestore usato da `loadTerreniViaService` con `clienteId` (core terreni) | ⬜ Da verificare in codice |

### 3.4 UX e mappe

| ID | Domanda | Opzioni | Stato |
|---|---|---|---|
| O12 | Calcolo area zone escluse | Sottrazione poligoni (Google Maps Geometry) vs ettari manuali vs entrambi | ⬜ Da decidere |
| O13 | Poligono appezzamento principale | Obbligatorio per zone escluse o opzionale (solo disegno esclusioni)? | ⬜ Da decidere |
| O14 | Sezione palo/sesto in terreni CT | Sempre visibile se modulo VM attivo vs solo se coltura vite/viticola | ⬜ Da decidere |

### 3.5 Integrazioni

| ID | Domanda | Opzioni | Stato |
|---|---|---|---|
| O15 | Flusso preventivo → calcolo | Calcolo standalone vs obbligo preventivo accettato prima | ⬜ Da decidere |
| O16 | Lavoro CT “Vendemmia meccanica” | Tipo lavoro pre-creato in categorie? Auto-creazione da calcolo? | ⬜ Da verificare con `gestione-lavori` |
| O17 | Collegamento terreno cliente ↔ vigneto aziendale | Solo link esplicito opzionale (edge case) — regole? | ⬜ Da decidere se serve v1 |
| O18 | Export Report | Quali KPI esatti (ricavi, ettari serviti, margine, per cliente/variety)? | ⬜ Da definire con modulo Report |

### 3.6 Migrazione

| ID | Domanda | Stato |
|---|---|---|
| O19 | Migrare dati Firebase `vendemmia-meccanizzata` → tenant GFV | ⬜ Da pianificare (script + mapping) |
| O20 | Utenti solo vecchia app senza CT | Onboarding: attivare CT + VM insieme? | ⬜ Da definire |

---

## 4. Architettura modulo

### 4.1 Struttura cartelle (target)

```
modules/vendemmia-meccanica/
├── models/
│   ├── CalcoloVendemmiaMeccanica.js    # Calcolo salvato / breakdown
│   ├── TariffaVm.js                    # (se non in config tenant)
│   └── SpesaVm.js                      # Spese bilancio servizio (se dedicata)
├── services/
│   ├── calcolo-compenso-vm-service.js  # Business logic calcolo (da vecchia app)
│   ├── piano-stagione-service.js       # Read/write stato stagione su terreni CT
│   ├── zone-escluse-service.js         # Poligoni, ettari netti
│   ├── calcoli-vm-service.js           # CRUD calcoli + PDF payload
│   ├── tariffe-vm-service.js           # Tariffe vendemmia + trasporto
│   ├── bilancio-vm-service.js          # Ricavi − spese
│   └── integrazione-ct-service.js      # Bridge preventivi/lavori CT
├── views/
│   ├── vm-home-standalone.html         # Hub sottile
│   ├── piano-stagione-standalone.html
│   ├── calcolatore-standalone.html
│   ├── calcoli-salvati-standalone.html
│   ├── tariffe-vm-standalone.html
│   └── bilancio-vm-standalone.html
└── config/
    └── vm-constants.js                 # Destinazioni trasporto, tipi palo, preset sesto
```

### 4.2 Gate modulo

```javascript
// requiresModules: ['contoTerzi']
// optionalModules: ['report', 'parcoMacchine', 'vigneto']
```

- Entry point: tile dashboard principale + card opzionale su hub CT (“Vendemmia Meccanica →”)
- `functions/tony-module-gate.js` e `core/config/subscription-plans.js`: aggiungere voce modulo (**checklist §13**)

### 4.3 Principi (allineati Master Plan Tony)

- **No duplicazione anagrafica**: clienti/terreni solo in CT
- **Configurazione > codice**: tariffe e mapping in config/servizi, non `if (pagina)` nel core Tony
- **Estensione terreni CT**: campi VM sul terreno cliente, non seconda entità terreno
- **Pagine standalone**: seguire `docs-sviluppo/LINEA_GUIDA_RESPONSIVE_STANDALONE.md` e canone `currentTableData` / `table-data-ready` per nuove liste

---

## 5. Modello dati

### 5.1 Terreno cliente (Conto Terzi) — estensioni

Terreni clienti: oggi via core terreni con `clienteId` (pagina `terreni-clienti-standalone.html`, morfologia = `tipoCampo`).

**Campi anagrafici VM (permanenti sul terreno):**

| Campo | Tipo | Obbl. VM | Note |
|---|---|---|---|
| `tipoCampo` | string | ✅ (già CT) | `pianura` \| `collina` \| `montagna` |
| `tipoPalo` | string | ✅ | es. `ferro`, `legno`, `cemento`, `personalizzata` — **da aggiungere** |
| `sestoImpianto` | object | ✅ | **da aggiungere** — struttura da O5 |
| `polygonCoords` | array | ⚠️ | Poligono appezzamento (se già presente in CT/mappa) |

**Stato stagione (per anno — struttura proposta, path da O8):**

```javascript
vendemmiaMeccanica: {
  "2026": {
    inPiano: true,
    vendemmiato: true,
    ettariVendemmiati: 1.85,      // superficie netta fatturabile
    ettariTotaliSnapshot: 2.10,   // opzionale, per audit
    zoneEscluse: [                 // poligoni NON vendemmiati
      { coordinates: [{ lat, lng }, ...] }
    ],
    dataVendemmia: "2026-09-18",  // opzionale, per terreno
    note: ""
  }
}
```

### 5.2 Tariffe tenant

Documento consigliato: `tenants/{tenantId}/impostazioni/tariffe-vendemmia-meccanica`

```javascript
{
  tariffeVendemmia: {
    "montagna-ferro": 120,
    "collina-legno": 90
    // chiave: `${morfologia}-${tipoPalo}` o estesa con sesto (O4)
  },
  coefficientiSesto: {           // se modello O4-B
    "standard": 1.0,
    "stretto": 1.1
  },
  tariffeTrasporto: {
    "sociale": 0.15,
    "intesa": 0.20
  },
  updatedAt: timestamp
}
```

### 5.3 Calcolo salvato

Collection proposta: `tenants/{tenantId}/calcoli-vendemmia-meccanica/{calcoloId}`

```javascript
{
  clienteId: string,
  clienteNome: string,              // denormalizzato per PDF/storico
  dataVendemmia: date,
  anno: number,
  destinazioneTrasporto: string,
  quintali: number,
  scontoMaggiorazione: number,      // può essere negativo (sconto)
  terreni: [{
    terrenoId: string,
    nome: string,
    ettariEffettivi: number,
    ettariTotali: number,
    morfologia: string,
    tipoPalo: string,
    sestoImpianto: object,
    tariffaPerEttaro: number,
    importoVendemmia: number,
    zoneEsclusePresenti: boolean
  }],
  totaleVendemmia: number,
  totaleTrasporto: number,
  totaleFinale: number,
  note: string,
  preventivoId: string | null,
  lavoroId: string | null,
  createdAt, updatedAt
}
```

### 5.4 Spese bilancio VM

Collection proposta: `tenants/{tenantId}/spese-vendemmia-meccanica/{spesaId}` (o riuso — O10)

```javascript
{ data, descrizione, importo, anno }
```

---

## 6. Tariffe e calcolo compenso

### 6.1 Formula (allineata vecchia app v2.3)

Per ogni terreno selezionato:

```
ettariEffettivi = vendemmiaMeccanica[anno].ettariVendemmiati
                ?? terreno.ettari   // fallback solo se nessuna zone esclusa definita — da validare

tariffaEttaro = tariffeVendemmia[`${morfologia}-${tipoPalo}`]
              × coefficienteSesto(sestoImpianto)   // se O4-B

importoTerreno = ettariEffettivi × tariffaEttaro
totaleVendemmia = Σ importoTerreno
totaleTrasporto = quintali × tariffeTrasporto[destinazione]
totaleFinale = totaleVendemmia + totaleTrasporto + scontoMaggiorazione
```

### 6.2 Validazioni pre-calcolo

- Cliente selezionato
- Almeno un terreno selezionato
- Ogni terreno: `tipoCampo`, `tipoPalo`, `sestoImpianto` compilati
- `quintali` ≥ 0; `destinazione` selezionata
- Warning se terreno ha `zoneEscluse` ma `ettariVendemmiati` non aggiornati

### 6.3 PDF

- Riutilizzare pattern jsPDF da `vecchia app/calcolatore.html` e `modules/vigneto/views/calcolo-materiali-standalone.html`
- Contenuto minimo: cliente, date, terreni con ha effettivi/totali, breakdown, trasporto, totale

---

## 7. Zone non vendemmiate

### 7.1 Comportamento atteso

1. Utente include terreno nel **piano stagione** (`inPiano[anno] = true`)
2. Al mark **vendemmiato** (o azione dedicata “Gestisci zone escluse”) → modal mappa
3. Disegno poligoni aree **non** vendemmiate (sottrazione dalla superficie fatturabile)
4. Calcolo `ettariVendemmiati[anno]` (automatico da geometry o manuale — O12)
5. **Calcolatore** e **PDF** usano sempre ettari effettivi

### 7.2 Dove vive l’UI

| Schermata | Funzione |
|---|---|
| **Piano stagione VM** | Primary: lista terreni, stati, apertura mappa zone |
| **Terreni clienti CT** | Badge “zone escluse 2026”, link → stesso modal VM |
| **Calcolatore VM** | Mostra ha effettivi; avviso se dati incompleti |

### 7.3 Riferimento implementativo

`vecchia app/anagrafica_clienti.html` — funzioni `openZoneEscluseModal`, `initMapZoneEscluse`, strutture `zoneEscluse`, `ettariVendemmiati`, `vendemmiati`.

---

## 8. Pagine e UX (hub senza duplicati)

### 8.1 Hub VM (`vm-home-standalone.html`)

**Schede interne (solo verticali VM):**

| Scheda | Descrizione |
|---|---|
| Dashboard stagione | KPI: clienti in piano, % completata, ettari residui, incassi stagione |
| Piano stagione | Vista operativa terreni CT + stati VM + zone escluse |
| Calcolatore | Lookup cliente/terreni, compenso, salva, PDF |
| Calcoli salvati | Storico, filtri, elimina, riedit |
| Tariffe VM + Trasporto | Griglia morf×palo (+ sesto se O4), cantine |
| Bilancio servizio | Ricavi calcoli − spese, export |

**Link esterni (lookup, non duplicati):**

- Anagrafica clienti → `modules/conto-terzi/views/clienti-standalone.html`
- Terreni clienti → `modules/conto-terzi/views/terreni-clienti-standalone.html`
- Preventivi CT → `preventivi-standalone.html`
- Lavori CT → `core/attivita-standalone.html?contoTerzi=true`

### 8.2 Calcolatore — lookup inline

Come vecchia app: select cliente → lista terreni con checkbox → pre-selezione terreni `vendemmiati[anno]`.

### 8.3 Estensioni UI Conto Terzi (con licenza VM)

Su `terreni-clienti-standalone.html` (se modulo VM attivo):

- Campi **tipo palo** e **sesto impianto** nel form terreno
- Badge stato vendemmia / zone escluse per anno corrente
- Link “Apri in Piano stagione VM”

**Non** duplicare la griglia completa terreni nell’hub VM.

---

## 9. Integrazioni con altri moduli

### 9.1 Conto Terzi (obbligatorio)

| Direzione | Cosa |
|---|---|
| VM ← CT | `clienti`, terreni (`clienteId`), `tipoCampo`, coltura, mappa |
| VM → CT | Aggiornamento campi VM su terreno; eventuale aggiornamento preventivo |

### 9.2 Preventivi CT

Flusso target:

```
Preventivo (tipo lavoro "Vendemmia meccanica")
  → accettazione / lavoro
  → piano stagione + vendemmia effettiva
  → calcolo VM (importo finale)
  → opzionale: chiudi preventivo / genera documento con importo calcolato
```

Campi collegamento: `calcolo.preventivoId`, `preventivo.calcoloVmId` (da confermare O15).

### 9.3 Lavori / Attività CT

- Tipo lavoro dedicato **“Vendemmia meccanica”** (categoria RACCOLTA — verificare allineamento con vigneto lavori)
- `calcolo.lavoroId` per tracciabilità
- Completamento lavoro → shortcut “Apri calcolatore precompilato”

### 9.4 Modulo Report

- Se `report` attivo: sezione **Vendemmia Meccanica CT** con ricavi annui, ettari serviti, margine, breakdown per cliente
- Fonte dati: `calcoli-vendemmia-meccanica` + spese VM

### 9.5 Modulo Vigneto (opzionale)

- **Solo** con link esplicito `terrenoClienteId` ↔ `vignetoId` (O17)
- Non usare Vigneto come prerequisito commerciale o tecnico

### 9.6 Parco Macchine / Manodopera (opzionale)

- Costi interni macchina/operaio **non** entrano nel compenso cliente
- Possibile evoluzione: confronto margine (ricavo calcolo − costi lavoro) — **post v1**

---

## 10. Tony (linee guida)

Implementazione Tony **dopo** MVP pagine (o in parallelo fase 4):

| Elemento | Valore proposto |
|---|---|
| `pageType` hub | `vendemmia-meccanica-hub` |
| `pageType` calcolatore | `calcolo-vendemmia-meccanica` |
| `pageType` piano stagione | `piano-stagione-vm` |
| Form mapping | Tariffe VM, nuovo calcolo (se form modale) in `tony-form-mapping.js` |
| Comandi | Navigazione hub, filtri calcoli, “apri piano stagione cliente X” — estendere `functions/index.js` FILTER_TABLE |

Canone liste: placeholder `currentTableData`, merge `setContext('page', …)`, evento `table-data-ready` — v. `.cursor/rules/tony-pagina-lista-e-form.mdc`.

---

## 11. Migrazione da vecchia app

**Sorgente:** `gfv-platform/vecchia app/` (Firebase project `vendemmia-meccanizzata`)

| Vecchia collection | Destinazione GFV |
|---|---|
| `clients` + `terreni[]` embedded | `tenants/{t}/clienti` + terreni con `clienteId` |
| `tariffe/current` | `impostazioni/tariffe-vendemmia-meccanica` |
| `calcoli` | `calcoli-vendemmia-meccanica` |
| `spese` | `spese-vendemmia-meccanica` (o equivalente) |
| `preferenze/annoSelezionato` | preferenze tenant o locale dashboard VM |

Script migrazione: **da pianificare** (O19). Mapping `vendemmiati`, `zoneEscluse`, `ettariVendemmiati` per anno.

---

## 12. Riferimenti codice esistente

| Scopo | Path |
|---|---|
| Vecchia app — calcolo e PDF | `vecchia app/calcolatore.html` |
| Vecchia app — clienti, piano, zone escluse | `vecchia app/anagrafica_clienti.html` |
| Vecchia app — bilancio, spese, calcoli | `vecchia app/bilancio.html` |
| Vecchia app — dashboard anno | `vecchia app/home.html` |
| CT — clienti | `modules/conto-terzi/views/clienti-standalone.html` |
| CT — terreni + morfologia | `modules/conto-terzi/views/terreni-clienti-standalone.html` |
| CT — tariffe (pattern) | `modules/conto-terzi/services/tariffe-service.js` |
| CT — preventivi | `modules/conto-terzi/services/preventivi-service.js` |
| Vigneto — tipo palo (valori) | `modules/vigneto/views/vigneti-standalone.html` |
| PDF jsPDF (pattern) | `modules/vigneto/views/calcolo-materiali-standalone.html` |
| Piani modulo (stile doc) | `docs-sviluppo/PLAN_MODULO_CONTO_TERZI.md` |
| Separazione vecchia app | `docs-sviluppo/STRUTTURA_PROGETTI.md` |
| Responsive standalone | `docs-sviluppo/LINEA_GUIDA_RESPONSIVE_STANDALONE.md` |
| Abbonamenti | `core/config/subscription-plans.js` |

---

## 13. Checklist sviluppo

Legenda: ⬜ Da fare · 🔄 In corso · ✅ Completato · ⏸️ In attesa decisione (vedi §3)

### Fase 0 — Decisioni e setup

| # | Task | Stato | Note / rimando |
|---|---|---|---|
| 0.1 | Chiudere O1–O3 (licenza, prezzo, nome UI) | ⬜ | §3.1 |
| 0.2 | Chiudere O4–O7 (tariffe, sesto, palo, trasporto) | ⬜ | §3.2 |
| 0.3 | Chiudere O8–O11 (persistenza Firestore) | ⬜ | §3.3 |
| 0.4 | Chiudere O12–O14 (mappe, UX terreni) | ⬜ | §3.4 |
| 0.5 | Chiudere O15–O18 (preventivi, lavori, report) | ⬜ | §3.5 |
| 0.6 | Approvazione formale di questo piano | ⬜ | |
| 0.7 | Aggiungere `vendemmiaMeccanica` in `subscription-plans.js` | ⬜ | Dipende da O1 |
| 0.8 | Gate modulo (dashboard, tony-module-gate, routes) | ⬜ | |

### Fase 1 — Estensione dati Conto Terzi

| # | Task | Stato | Note |
|---|---|---|---|
| 1.1 | Verificare path/modello terreni cliente in Firestore | ⬜ | O11 |
| 1.2 | Aggiungere `tipoPalo` su terreno cliente (model + form CT) | ⬜ | Visibilità O14 |
| 1.3 | Aggiungere `sestoImpianto` su terreno cliente | ⬜ | Formato O5 |
| 1.4 | Aggiungere struttura `vendemmiaMeccanica/{anno}` su terreno | ⬜ | Path O8 |
| 1.5 | Validazione: blocco calcolo se palo/sesto/morfologia mancanti | ⬜ | |
| 1.6 | Badge/link VM su `terreni-clienti-standalone.html` | ⬜ | Solo se licenza VM |
| 1.7 | Regole Firestore tenant per nuovi campi/collection | ⬜ | |

### Fase 2 — Servizi core VM

| # | Task | Stato | Note |
|---|---|---|---|
| 2.1 | `tariffe-vm-service.js` — CRUD tariffe vendemmia + trasporto | ⬜ | |
| 2.2 | `zone-escluse-service.js` — poligoni, calcolo ettari netti | ⬜ | O12, O13 |
| 2.3 | `piano-stagione-service.js` — inPiano, vendemmiato, lettura terreni CT | ⬜ | |
| 2.4 | `calcolo-compenso-vm-service.js` — formula §6.1 | ⬜ | Port da calcolatore.html |
| 2.5 | `calcoli-vm-service.js` — CRUD calcoli salvati | ⬜ | |
| 2.6 | `bilancio-vm-service.js` — ricavi + spese | ⬜ | O10 |
| 2.7 | Test unitari servizi calcolo e ettari netti | ⬜ | |

### Fase 3 — UI modulo VM

| # | Task | Stato | Note |
|---|---|---|---|
| 3.1 | `vm-home-standalone.html` — hub + link CT | ⬜ | §8.1 |
| 3.2 | `piano-stagione-standalone.html` — lista, stati, % avanzamento | ⬜ | currentTableData |
| 3.3 | Modal mappa zone escluse (da vecchia app) | ⬜ | §7 |
| 3.4 | `calcolatore-standalone.html` — lookup + risultati + salva | ⬜ | |
| 3.5 | Generazione PDF calcolo | ⬜ | |
| 3.6 | `calcoli-salvati-standalone.html` — storico, filtri, delete | ⬜ | |
| 3.7 | `tariffe-vm-standalone.html` — griglia + trasporto | ⬜ | |
| 3.8 | `bilancio-vm-standalone.html` — KPI, spese, export | ⬜ | |
| 3.9 | Entry card su hub CT + dashboard principale | ⬜ | |
| 3.10 | Responsive / standalone CSS allineato linea guida | ⬜ | |

### Fase 4 — Integrazioni

| # | Task | Stato | Note |
|---|---|---|---|
| 4.1 | Collegamento calcolo ↔ preventivo CT | ⬜ | O15 |
| 4.2 | Tipo lavoro “Vendemmia meccanica” + link calcolo ↔ lavoro | ⬜ | O16 |
| 4.3 | Export KPI verso modulo Report | ⬜ | O18 |
| 4.4 | (Opzionale) Link terreno cliente ↔ vigneto | ⏸️ | O17 — post v1? |

### Fase 5 — Tony

| # | Task | Stato | Note |
|---|---|---|---|
| 5.1 | `pageType` + `currentTableData` su liste VM | ⬜ | §10 |
| 5.2 | Voci `tony-form-mapping.js` (tariffe, calcolo se applicabile) | ⬜ | |
| 5.3 | Comandi navigazione / FILTER_TABLE in `functions/index.js` | ⬜ | |
| 5.4 | Aggiornare guide Tony tecniche (solo file consentiti post-MVP) | ⬜ | tony-agent-onboarding |

### Fase 6 — Migrazione e chiusura

| # | Task | Stato | Note |
|---|---|---|---|
| 6.1 | Script migrazione `vendemmia-meccanizzata` → tenant | ⬜ | O19 |
| 6.2 | Test E2E flusso: piano → zone → calcolo → PDF → bilancio | ⬜ | |
| 6.3 | Documentazione utente / GUIDA modulo VM | ⬜ | Solo su richiesta o fase GTM |
| 6.4 | Aggiornare `COSA_ABBIAMO_FATTO.md` + `STATO_ATTUALE.md` a rilascio | ⬜ | Regola agenti |
| 6.5 | Decisioni O* chiuse spostate in §2; piano aggiornato | ⬜ | |

---

### Riepilogo avanzamento (aggiornare manualmente)

| Fase | Completati | Totale | % |
|---|---|---|---|
| Fase 0 — Decisioni | 0 | 8 | 0% |
| Fase 1 — Dati CT | 0 | 7 | 0% |
| Fase 2 — Servizi | 0 | 7 | 0% |
| Fase 3 — UI | 0 | 10 | 0% |
| Fase 4 — Integrazioni | 0 | 4 | 0% |
| Fase 5 — Tony | 0 | 4 | 0% |
| Fase 6 — Migrazione | 0 | 5 | 0% |
| **Totale** | **0** | **45** | **0%** |

---

## Cronologia documento

| Data | Autore | Modifica |
|---|---|---|
| 2026-07-03 | Piano iniziale | Creazione da analisi `vecchia app/` e decisioni di design hub/CT/zone escluse/tariffe |
