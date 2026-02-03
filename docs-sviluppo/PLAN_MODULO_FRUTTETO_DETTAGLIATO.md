# 🍎 Piano Dettagliato: Modulo Frutteto

**Data creazione**: 2026-01-27  
**Ultimo aggiornamento**: 2026-02-03 (Trattamenti: alert dosaggio con conferma salvataggio, colonna Avvisi con bollino verde/⚠️, pulsante Modifica visibile; costi prodotti trattamenti inclusi in statistiche dashboard) | 2026-01-31 (Zone lavorate; lista condivisa Calcolo materiali; pali per forma; Gestione lavori Impianto Frutteto; **Pagine e card Potatura e Trattamenti frutteto**)
**Stato**: ✅ IMPLEMENTATO (Fase Base + Dashboard + Allineamento) - Anagrafica Frutteti + Raccolta Frutta + Dashboard + Statistiche + Integrazione Lavori + Attività da Diario + Dettaglio spese cambio anno + Tracciamento poligono + Dropdown terreni/frutteti con nome e podere + Sync zona da lavoro, superficie 2 decimali, colonna Lavoro, Dashboard e pulsanti + Calcolo materiali: lista forma allevamento condivisa; distanza/altezza pali per forma; Gestione lavori Impianto Nuovo Frutteto: form Dati Frutteto e creazione anagrafica (creaFruttetoDaLavoro) + **Pagine standalone Potatura e Trattamenti + card in dashboard; evoluzione “da lavori/attività” in PIANO_POTATURA_TRATTAMENTI_DA_LAVORI.md**
**Priorità**: Alta  
**Riferimento**: `PLAN_MODULI_COLTURA_SPECIALIZZATI.md`, `GUIDA_SVILUPPO_MODULI_FRUTTETO_OLIVETO.md`

---

## 🎯 Obiettivo del Modulo

Il Modulo Frutteto estende il sistema base con funzionalità specializzate per la gestione completa di frutteti, dalla pianificazione dell'impianto alla raccolta frutta, dalla potatura ai trattamenti, fino al tracciamento di rese, costi e qualità della frutta.

**Valore Aggiunto**:
- Gestione completa ciclo frutticolo annuale
- Tracciamento qualità frutta (calibro, grado maturazione, colore)
- Calcolo automatico compensi raccolta
- Pianificazione e ottimizzazione impianti
- Report produzione e costi dettagliati per specie

---

## 🏗️ Architettura e Integrazione

### Principi Fondamentali

1. **Modulo Opzionale Pay-Per-Use**
   - Attivabile/disattivabile per tenant
   - Pricing: €12-15/mese (da confermare)
   - Nessun impatto su funzionalità esistenti quando disattivato

2. **Integrazione Non Invasiva**
   - Non modifica modelli core esistenti
   - Usa sub-collections separate: `tenants/{tenantId}/frutteti/`
   - Riferimento a terreno: `terrenoId` (collegamento, non duplicazione)

3. **Compatibilità Retroattiva**
   - Terreni esistenti con coltura frutteto continuano a funzionare
   - Attivazione modulo non richiede migrazione dati
   - Creazione anagrafica frutteto opzionale e guidata

4. **Ereditarietà da BaseColtura**
   - Estende `shared/models/BaseColtura.js` (classe base comune)
   - Riutilizza logica comune con Vigneto e Oliveto
   - Aggiunge solo campi specifici frutticoltura

### Struttura Dati

```
tenants/{tenantId}/
├── frutteti/{fruttetoId}                    # Anagrafica frutteto
│   ├── raccolte/{raccoltaId}                # Sub-collection raccolte frutta
│   ├── potature/{potaturaId}                # Sub-collection potature ✅ (pagine standalone + card 2026-01-31)
│   ├── diradamenti/{diradamentoId}         # Sub-collection diradamenti (futuro)
│   └── trattamenti/{trattamentoId}          # Sub-collection trattamenti ✅ (pagine standalone + card 2026-01-31)
└── pianificazioni-impianti/{pianificazioneId}  # Pianificazioni nuovi impianti (futuro)
```

**Riferimenti**:
- `frutteto.terrenoId` → `terreni/{terrenoId}` (collegamento, non duplicazione)
- `raccolta.fruttetoId` → `frutteti/{fruttetoId}`
- `raccolta.operai[]` → `users/{userId}` (riferimenti operai)
- `raccolta.macchine[]` → `macchine/{macchinaId}` (riferimenti macchine)

---

## 📋 Funzionalità Dettagliate

### 1. Anagrafica Frutteti ✅ **IMPLEMENTATO**

#### 1.1. Dati Base (Campi Comuni da BaseColtura)

| Campo | Tipo | Obbligatorio | Descrizione | Esempio |
|-------|------|--------------|-------------|---------|
| `terrenoId` | string | ✅ Sì | Riferimento terreno | "terreno-123" |
| `varieta` | string | ✅ Sì | Varietà frutta | "Gala", "Fuji", "Abate Fetel" |
| `annataImpianto` | number | ✅ Sì | Anno impianto | 2015 |
| `portainnesto` | string | ⚠️ Opzionale | Tipo portainnesto | "M9", "MM106", "selvatico" |
| `densita` | number | ✅ Sì | Densità piante/ha | 2000 |
| `formaAllevamento` | string | ✅ Sì | Sistema allevamento | "Vaso", "Palmetta", "Spalliera" |
| `tipoImpianto` | string | ⚠️ Opzionale | Tipo impianto | "tradizionale", "intensivo", "superintensivo" |
| `distanzaFile` | number | ✅ Sì | Distanza tra file (metri) | 4.0 |
| `distanzaUnita` | number | ✅ Sì | Distanza tra piante (metri) | 1.5 |
| `orientamentoFilari` | string | ⚠️ Opzionale | Orientamento filari | "N-S", "E-O" |
| `superficieEttari` | number | ✅ Sì | Superficie dedicata (ha) | 2.5 |
| `note` | string | ❌ No | Note generali | "..." |

#### 1.2. Campi Specifici Frutteto

| Campo | Tipo | Obbligatorio | Descrizione | Esempio |
|-------|------|--------------|-------------|---------|
| `specie` | string | ✅ Sì | Specie fruttifera | "Melo", "Pesco", "Pero", "Albicocco", "Ciliegio", "Susino", "Kiwi", "Fico", "Kaki", ecc. |
| `pianteTotali` | number | ⚠️ Opzionale | Numero totale piante (calcolabile) | 5000 |
| `calibroMedio` | string | ⚠️ Opzionale | Calibro medio frutta | "70-80mm", "80-90mm" |
| `gradoMaturazione` | string | ⚠️ Opzionale | Grado maturazione tipico | "precoce", "media", "tardiva" |

**Alias Terminologia Frutticola**:
- `densitaPiante` → alias di `densita` (densità piante/ha)
- `distanzaPiante` → alias di `distanzaUnita` (distanza tra piante)
- `sistemaAllevamento` → alias di `formaAllevamento`

**Note**:
- `pianteTotali` può essere calcolato automaticamente: `pianteTotali = superficieEttari × densita`
- `specie` viene popolato da servizio centralizzato `colture-service.js` (categoria "frutteto")
- `varieta` viene popolato da servizio centralizzato `varieta-frutteto-service.js` (per specie)

#### 1.3. Campi Rese e Produzione (Aggiornati Automaticamente)

| Campo | Tipo | Descrizione | Calcolo |
|-------|------|-------------|---------|
| `resaMediaKgHa` | number | Resa media storica (kg/ettaro) | Media ultimi 3-5 anni |
| `resaAnnoPrecedente` | number | Resa anno precedente (kg/ettaro) | Dato storico |
| `produzioneTotaleAnno` | number | Produzione totale anno corrente (kg, 2 decimali) | Somma raccolte anno |
| `produzioneTotaleAnnoPrecedente` | number | Produzione totale anno precedente (kg, 2 decimali) | Dato storico |
| `resaPerVarieta` | object | Resa per varietà `{varieta: resaKgHa}` | Calcolato da raccolte |
| `trendRese` | array | Trend rese ultimi 5 anni `[{anno, resa}]` | Storico calcolato (resa in kg/ha) |

**Note**:
- Le rese sono espresse in **chilogrammi per ettaro** (kg/ha)
- La produzione totale è espressa in **chilogrammi** (kg) con 2 decimali di precisione (es. 5000.75 kg)
- Conversione automatica: `resaKgHa = quantitaKg / quantitaEttari`

#### 1.4. Campi Spese e Costi (Aggiornati Automaticamente)

| Campo | Tipo | Descrizione | Fonte Dati |
|-------|------|-------------|------------|
| `speseManodoperaAnno` | number | Spese manodopera totali anno (€) | Somma compensi operai |
| `speseTrattamentiAnno` | number | Spese prodotti fitosanitari anno (€) | Somma costi trattamenti |
| `spesePotaturaAnno` | number | Spese potatura anno (€) | Somma costi potature |
| `speseRaccoltaAnno` | number | Spese raccolta anno (€) | Somma costi raccolte |
| `speseMacchineAnno` | number | Spese macchine anno (€) | Calcolo ore macchine × costo/ora |
| `speseAltroAnno` | number | Altre spese anno (€) | Inserimento manuale |
| `costoTotaleAnno` | number | Costo totale anno (€) | **Calcolato**: somma tutte le spese |
| `costoPerEttaro` | number | Costo per ettaro (€/ha) | **Calcolato**: costoTotaleAnno / superficieEttari |
| `ricavoAnno` | number | Ricavo totale anno (€) | Inserimento manuale o calcolato |
| `margineAnno` | number | Margine anno (€) | **Calcolato**: ricavoAnno - costoTotaleAnno |
| `marginePerEttaro` | number | Margine per ettaro (€/ha) | **Calcolato**: margineAnno / superficieEttari |
| `roiAnno` | number | ROI anno (%) | **Calcolato**: (margineAnno / costoTotaleAnno) × 100 |

#### 1.5. Campi Tracciamento (Aggiornati Automaticamente)

| Campo | Tipo | Descrizione | Aggiornato da |
|-------|------|-------------|---------------|
| `dataUltimaPotatura` | Date | Data ultima potatura | Ultima potatura inserita |
| `dataUltimoTrattamento` | Date | Data ultimo trattamento | Ultimo trattamento inserita |
| `dataUltimaRaccolta` | Date | Data ultima raccolta | Ultima raccolta inserita |
| `statoImpianto` | string | Stato impianto | "attivo", "in_riposo", "da_rimuovere" |

---

### 2. Gestione Raccolta Frutta ✅ **IMPLEMENTATO**

#### 2.1. Pianificazione Raccolta

**Obiettivo**: Pianificare la raccolta per ottimizzare tempi, risorse e qualità.

**Funzionalità** (futuro):
- **Calendario Raccolta**: Visualizzazione raccolte pianificate per periodo
- **Priorità Raccolta**: Ordine raccolta per specie/varietà (basato su maturazione)
- **Stima Quantità**: Quantità prevista (kg/ettaro) per varietà
- **Assegnazione Risorse**: Operai e macchine necessarie
- **Alert Maturazione**: Notifiche quando frutta raggiunge maturazione ottimale

#### 2.2. Registrazione Raccolta

**Obiettivo**: Registrare ogni operazione di raccolta con dati completi.

**Campi Raccolta**:

| Campo | Tipo | Obbligatorio | Descrizione | Esempio |
|-------|------|--------------|-------------|---------|
| `fruttetoId` | string | ✅ Sì | Riferimento frutteto | "frutteto-123" |
| `data` | Timestamp | ✅ Sì | Data raccolta | 2025-09-15 |
| `specie` | string | ✅ Sì | Specie frutta raccolta | "Melo" |
| `varieta` | string | ✅ Sì | Varietà raccolta | "Gala" |
| `quantitaKg` | number | ✅ Sì | Quantità raccolta (kg, 2 decimali) | 5000.75 |
| `quantitaEttari` | number | ✅ Sì | Superficie raccolta (ha) | 2.5 |
| `resaKgHa` | number | ✅ Sì | Resa (kg/ettaro) - calcolato | 2000.30 |
| `calibro` | string | ⚠️ Opzionale | Calibro frutta | "70-80mm", "80-90mm" |
| `gradoMaturazione` | string | ⚠️ Opzionale | Grado maturazione | "precoce", "media", "tardiva" |
| `colore` | string | ⚠️ Opzionale | Colore frutta | "rosso", "giallo", "verde" |
| `operai` | array | ✅ Sì | Array ID operai coinvolti | ["user-1", "user-2"] |
| `macchine` | array | ⚠️ Opzionale | Array ID macchine utilizzate | ["macchina-1"] |
| `oreImpiegate` | number | ⚠️ Opzionale | Ore totali impiegate | 40.0 |
| `costoManodopera` | number | ⚠️ Opzionale | Costo manodopera (€) - calcolato | 800.0 |
| `costoMacchine` | number | ⚠️ Opzionale | Costo macchine (€) - calcolato | 200.0 |
| `costoTotale` | number | ⚠️ Opzionale | Costo totale (€) - calcolato | 1000.0 |
| `prezzoVendita` | number | ⚠️ Opzionale | Prezzo vendita €/kg | 1.50 |
| `ricavo` | number | ⚠️ Opzionale | Ricavo totale (€) - calcolato | 7500.0 |
| `note` | string | ❌ No | Note | "Raccolta manuale, qualità ottima" |

**Calcoli Automatici**:
- `resaKgHa` = `quantitaKg` / `quantitaEttari` (resa in kg/ettaro, 2 decimali)
- `costoManodopera` = somma compensi operai (da tariffe raccolta)
- `costoMacchine` = ore macchine × costo/ora
- `costoTotale` = `costoManodopera` + `costoMacchine`
- `ricavo` = `prezzoVendita` × `quantitaKg`

**Note**:
- La quantità raccolta è espressa in **chilogrammi** (kg) con **2 decimali di precisione** (es. 5000.75 kg)
- La resa è espressa in **chilogrammi per ettaro** (kg/ha) con 2 decimali (es. 2000.30 kg/ha)

#### 2.3. Calcolo Compensi Raccolta

**Stato**: ⚠️ **DA IMPLEMENTARE** (logica simile a vendemmia)

**Obiettivo**: Calcolare automaticamente i compensi degli operai per la raccolta.

**Metodi di Calcolo** (futuro):

1. **Tariffa per chilogrammo raccolto**:
   - Tariffa configurabile per specie/varietà (es. €0.15/kg per Mele, €0.20/kg per Pesche)
   - Calcolo: `compenso = quantitaKg × tariffaPerKg`
   - Distribuzione: compenso diviso tra operai coinvolti

2. **Tariffa per ora**:
   - Tariffa oraria standard (es. €20/ora)
   - Calcolo: `compenso = oreImpiegate × tariffaOraria × numeroOperai`
   - Distribuzione: compenso diviso tra operai coinvolti

3. **Tariffa mista** (futuro):
   - Combinazione tariffa/kg + tariffa/ora
   - Utile per incentivare produttività

**Integrazione con Sistema Manodopera**:
- I compensi raccolta verranno registrati automaticamente come attività nel diario
- Collegamento con sistema ore e compensi esistente
- Report raccolta include dettaglio compensi per operaio

#### 2.4. Tracciamento poligono area raccolta ✅ **IMPLEMENTATO 2026-01-30**

**Obiettivo**: Tracciare l’area di raccolta sulla mappa (come in Vendemmia), con cursore crosshair, snap al confine/vertici, validazione punto dentro il terreno, doppio clic per terminare.

**Funzionalità implementate**:
- ✅ Cursore crosshair durante il tracciamento (classe `drawing-mode` su `.modal-mappa-body` + impostazione cursore su container e div/canvas Google Maps)
- ✅ Snap ai vertici del terreno (8 m) e al confine (5 m); disabilitabile con **Shift**
- ✅ Doppio clic (300 ms) per terminare il tracciamento senza chiudere il poligono; chiusura cliccando vicino al primo punto (20 m)
- ✅ Validazione: il punto deve essere dentro i confini del terreno (tolleranza 3 m); se agganciato al confine ma fuori, spostamento verso l’interno
- ✅ Feedback visivo quando si applica lo snap (marker verde per ~1 s)
- ✅ Toggle "Pausa tracciamento"; listener `remove_at` sul path per aggiornare superficie/punti quando si elimina un vertice

**File**: `modules/frutteto/views/raccolta-frutta-standalone.html`

#### 2.5. Dropdown terreni e frutteti (nome e podere) ✅ **IMPLEMENTATO 2026-01-30**

**Obiettivo**: Nei dropdown e in tabella mostrare **nome del terreno e podere** invece dell’id.

**Funzionalità implementate**:
- ✅ **Pagina Frutteti** (`frutteti-standalone.html`): `getTerrenoLabel(t)` restituisce "Nome – Podere" (o solo nome/podere); dropdown "Terreno" e filtro "Tutti i terreni" usano questa label; colonna terreno in tabella idem.
- ✅ **Gestione Raccolta** (`raccolta-frutta-standalone.html`): caricamento terreni con `getAllTerreni()` in `loadFrutteti()`; `getFruttetoOptionLabel(f)` mostra "Specie Varietà – Nome terreno – Podere"; dropdown "Frutteto" (filtro e modal) e colonna Frutteto in tabella usano questa label.

#### 2.6. Zone lavorate, superficie, colonna Lavoro, Dashboard e pulsanti ✅ **IMPLEMENTATO 2026-01-31**

**Obiettivo**: Allineare Gestione Raccolta Frutta a Vendemmia per zona da lavoro, formattazione superficie, colonna Lavoro e navigazione/ordine pulsanti.

**Funzionalità implementate**:
- ✅ **Sync zona da lavoro**: `loadPoligonoFromZoneLavorate(lavoroId)` legge la prima zona chiusa da `lavori/{lavoroId}/zoneLavorate`; in `openEditRaccolta()` se la raccolta ha `lavoroId` e non ha poligono proprio, la zona viene pre-popolata nella mappa e salvata al primo salvataggio
- ✅ **Formattazione superficie (ha)**: valore con due decimali (`.toFixed(2)`) nel modal creazione/modifica e in tabella
- ✅ **Colonna Lavoro**: in tabella raccolte colonna con link "🔗 Vedi Lavoro" (apre gestione lavori con `?lavoroId=...`) quando la raccolta è collegata a un lavoro
- ✅ **Pulsante Dashboard**: link "← Dashboard" con `href="frutteto-dashboard-standalone.html"` e listener con `resolvePath`; ordine pulsanti come Vendemmia: **Nuova raccolta** → **← Frutteti** → **← Dashboard**

**File**: `modules/frutteto/views/raccolta-frutta-standalone.html`

---

### 3. Gestione Potatura

**Nota Architetturale**: I modelli e servizi `PotaturaFrutteto.js` e `potatura-frutteto-service.js` sono implementati. **Pagine standalone e card dashboard** (2026-01-31): `potatura-standalone.html` – filtro frutteto/anno, tabella potature, modal CRUD; card “Potatura” nella dashboard frutteto. Evoluzione **“Potatura da lavori/attività”** (dati base da Gestione lavori/Diario, dati aggiuntivi compilabili, base in sola lettura) pianificata in `PIANO_POTATURA_TRATTAMENTI_DA_LAVORI.md`.

#### 3.1. Tipi Potatura

**Tipi supportati** (futuro):

1. **Potatura Invernale** (dicembre-marzo)
   - Potatura principale per formazione struttura
   - Rimozione rami vecchi
   - Formazione branche principali

2. **Potatura Verde** (estiva, maggio-luglio)
   - Spollonatura (rimozione germogli inutili)
   - Cimatura (taglio apici vegetativi)
   - Diradamento foglie (per aereazione)

3. **Potatura di Rinnovo**
   - Sostituzione branche invecchiate
   - Rinnovo struttura impianto

4. **Spollonatura**
   - Rimozione germogli basali
   - Pulizia pianta

---

### 4. Integrazione con Terreni ✅ **IMPLEMENTATO**

#### 4.1. Icona Frutteto nella Lista Terreni

**File**: `core/js/terreni-controller.js`, `core/terreni-standalone.html`

**Funzionalità**:
- ✅ Visualizzazione icona "🍎" nella lista terreni per terreni con coltura frutteto
- ✅ Pulsante "Gestisci Frutteto" che reindirizza a `frutteti-standalone.html?terrenoId={id}`
- ✅ Logica `isColturaFrutteto()` per identificare colture frutteto
- ✅ Controllo modulo attivo (`hasFruttetoModule`)

#### 4.2. Pre-compilazione Campi da Terreno

**File**: `modules/frutteto/views/frutteti-standalone.html`

**Funzionalità**:
- ✅ Pre-selezione terreno da URL parameter `terrenoId`
- ✅ Pre-compilazione superficie da terreno
- ✅ Pre-compilazione specie se terreno ha coltura frutteto corrispondente
- ✅ Popolamento automatico dropdown varietà in base alla specie

**Logica**:
```javascript
// Se terrenoId presente in URL, pre-compila:
- terrenoId (select terreno)
- superficieEttari (da terreno.superficieEttari)
- specie (se terreno.coltura corrisponde a specie frutteto)
- varieta (dropdown popolato automaticamente per specie)
```

---

### 5. Servizi Centralizzati ✅ **IMPLEMENTATO**

#### 5.1. Servizio Varietà Frutteto

**File**: `core/services/varieta-frutteto-service.js`

**Funzionalità**:
- ✅ Gestione centralizzata varietà per specie frutteto
- ✅ Liste predefinite per tutte le specie principali (Melo, Pesco, Pero, Albicocco, Ciliegio, Susino, Kiwi, Fico, Kaki, ecc.)
- ✅ Supporto varietà personalizzate (localStorage temporaneo)
- ✅ Normalizzazione nomi specie (gestione alias plurali/singolari)
- ✅ Funzione `populateVarietaDropdown()` per popolamento dropdown UI

**Alias Specie Gestiti**:
- `Prugne` → `Susino`
- `Albicocche` → `Albicocco`
- `Ciliege` → `Ciliegio`
- `Mele` → `Melo`
- `Pere` → `Pero`
- `Pesche` → `Pesco`
- `Fichi` → `Fico`
- `Fico d'India` varianti → `Fico d'India`

**Funzioni Principali**:
- `getVarietaPerSpecie(specie)` - Ottiene varietà per una specie
- `populateVarietaDropdown(selectId, specie)` - Popola dropdown UI
- `addVarietaPersonalizzata(specie, varieta)` - Aggiunge varietà personalizzata
- `normalizzaSpecie(specie)` - Normalizza nome specie gestendo alias

#### 5.2. Integrazione con Colture Service

**File**: `core/services/colture-service.js`

**Funzionalità**:
- ✅ Popolamento dropdown specie da collezione `colture` (categoria "frutteto")
- ✅ Filtro client-side per evitare composite index Firestore
- ✅ Ordinamento alfabetico specie

---

### 6. Dashboard e Navigazione ✅ **IMPLEMENTATO**

#### 6.1. Card Modulo Frutteto

**File**: `core/js/dashboard-sections.js`, `core/js/dashboard-controller.js`

**Funzionalità**:
- ✅ Card "Frutteto" nella dashboard quando modulo attivo
- ✅ Icona "🍎" e link a `frutteti-standalone.html`
- ✅ Integrazione con sistema abbonamento (attivazione/disattivazione modulo)

#### 6.2. Pagina Abbonamento

**File**: `core/admin/abbonamento-standalone.html`

**Funzionalità**:
- ✅ Modulo "frutteto" già presente in configurazione
- ✅ Attivazione/disattivazione modulo funzionante
- ✅ Card appare automaticamente in dashboard dopo attivazione

---

### 7. Firestore Security Rules ✅ **IMPLEMENTATO**

**File**: `firestore.rules`

**Regole Implementate**:
```javascript
// Collection frutteti
match /tenants/{tenantId}/frutteti/{fruttetoId} {
  allow read, create, update, delete: if isAuthenticated() 
    && belongsToTenant(tenantId) 
    && hasRole(['manager', 'amministratore']);
  
  // Sub-collection raccolte
  match /raccolte/{raccoltaId} {
    allow read, create, update, delete: if isAuthenticated() 
      && belongsToTenant(tenantId) 
      && hasRole(['manager', 'amministratore']);
  }
}
```

---

## 📁 Struttura File Implementata

```
modules/frutteto/
├── models/
│   ├── Frutteto.js                    ✅ Estende BaseColtura
│   └── RaccoltaFrutta.js              ✅ Modello raccolta
├── services/
│   ├── frutteti-service.js             ✅ CRUD anagrafica frutteti
│   └── raccolta-frutta-service.js      ✅ CRUD raccolte frutta
└── views/
    └── frutteti-standalone.html        ✅ UI completa anagrafica + raccolte

core/services/
└── varieta-frutteto-service.js         ✅ Servizio centralizzato varietà

core/js/
├── terreni-controller.js               ✅ Modificato (icona frutteto)
└── dashboard-sections.js               ✅ Modificato (card frutteto)

core/
├── terreni-standalone.html             ✅ Modificato (link frutteto)
└── admin/abbonamento-standalone.html  ✅ Modulo già presente

firestore.rules                          ✅ Regole frutteti + raccolte
```

---

## ✅ Funzionalità Completate (2026-01-29)

### Fase Base - Anagrafica e Raccolta

1. ✅ **Modello Frutteto**
   - Estende `BaseColtura` con campi specifici (specie, calibroMedio, gradoMaturazione)
   - Validazione completa
   - Alias terminologia frutticola

2. ✅ **Modello RaccoltaFrutta**
   - Campi quantità, qualità (calibro, grado maturazione, colore)
   - Calcolo automatico rese e costi
   - Integrazione operai/macchine

3. ✅ **Servizi CRUD**
   - `frutteti-service.js` - Gestione anagrafica completa
   - `raccolta-frutta-service.js` - Gestione raccolte

4. ✅ **UI Anagrafica**
   - `frutteti-standalone.html` - Lista, filtri, form creazione/modifica
   - Dropdown specie da servizio centralizzato
   - Dropdown varietà dinamico per specie
   - Modal aggiunta varietà personalizzate
   - Pre-compilazione da terreno

5. ✅ **Servizio Varietà Centralizzato**
   - Liste predefinite per tutte le specie principali
   - Normalizzazione nomi (alias plurali/singolari)
   - Supporto varietà personalizzate (localStorage)

6. ✅ **Integrazione Terreni**
   - Icona frutteto nella lista terreni
   - Pre-compilazione campi da terreno
   - Link navigazione terreno → frutteto

7. ✅ **Dashboard**
   - Card modulo frutteto
   - Integrazione abbonamento

8. ✅ **Firestore Rules**
   - Regole sicurezza per `frutteti` e `raccolte`
   - Regole per collection `raccolteFrutta` (standalone) - **AGGIUNTO 2026-01-29**

9. ✅ **Dashboard Standalone Dedicata** - **COMPLETATO 2026-01-29**
   - Dashboard clonata da vigneto con tema arancione
   - Statistiche principali: produzione totale (kg), resa media (kg/ha), spese totali (€), numero frutteti, numero raccolte
   - Sezione "Raccolte Recenti" con tabella dati
   - Sezione "Lavori Frutteto" con tabella lavori completati
   - Filtri per frutteto e anno
   - Link dalla dashboard principale alla dashboard frutteto dedicata
   - Link dall'anagrafica alla dashboard frutteto (non più dashboard principale)

10. ✅ **Servizio Statistiche Frutteto** - **COMPLETATO 2026-01-29**
    - `getStatisticheFrutteto(fruttetoId, anno)`: statistiche aggregate per frutteto o tutti i frutteti
    - Calcolo produzione totale, resa media, spese totali, spese raccolta
    - Statistiche per mese (produzione e spese)
    - Resa per specie
    - `getRaccolteRecenti(fruttetoId, anno, limit)`: raccolte recenti con ordinamento
    - `getLavoriFrutteto(fruttetoId, anno, stato, limit)`: lavori completati con dati frutteto

11. ✅ **Integrazione Sistema Lavori/Diario** - **COMPLETATO 2026-01-29**
    - `getLavoriPerTerreno(terrenoId, options)`: recupera lavori per terreno con filtri anno/stato
    - `calcolaCostiLavoro(lavoroId, lavoro)`: calcolo costi manodopera, macchine e prodotti
      - Carica ore validate da `lavori/{lavoroId}/oreOperai`
      - Calcola costi manodopera usando `getTariffaOperaio` (modulo Manodopera)
      - Fallback su attività Diario se modulo Manodopera non attivo
      - Calcola costi macchine usando servizio parco macchine se disponibile
      - Include costi prodotti dal lavoro
    - `aggregaSpeseFruttetoAnno(fruttetoId, anno)`: aggrega spese annuali per categoria
    - `ricalcolaSpeseFruttetoAnno(fruttetoId, anno)`: ricalcola e salva spese nel documento frutteto
    - Pulsante ricalcolo manuale nella UI frutteti con indicatore progresso
    - Logica migliorata caricamento spese: se `speseProdottiAnno` presente ma `speseAltroAnno` no, viene copiato
    - `aggiornaCostiCalcolati()` chiamato solo se `costoTotaleAnno` non presente o è 0 (evita sovrascrittura valori già calcolati)

12. ✅ **Allineamento con Modulo Vigneto** - **COMPLETATO 2026-01-29**
    - Totale spese in dashboard: sempre da `aggregaSpeseFruttetoAnno` (lavori + attività dirette diario)
    - Elenco lavori in dashboard: `getLavoriFrutteto` unisce lavori e attività dirette del diario; badge "Da diario" per attività senza lavoro
    - Servizio `getAttivitaDirettePerTerreno(terrenoId, anno, lavori)` in `lavori-frutteto-service.js`
    - Dettaglio spese (modal anagrafica): listener `change` sul select anno; al cambio anno i dettagli si ricaricano senza cliccare "Aggiorna"
    - Icona card "Gestione Raccolta Frutta": 📦 (casse di frutta); stessa icona per stato vuoto raccolte
    - Riferimento: `PIANIFICA_IMPIANTO_CALCOLO_MATERIALI_CONDIVISI.md` per modulo condiviso Pianifica impianto / Calcolo materiali

---

## ⚠️ Funzionalità Future

### Fase 2 - Potatura e Diradamento

1. ✅ **Gestione Potatura** (2026-01-31)
   - Modello `PotaturaFrutteto.js` e servizio `potatura-frutteto-service.js` implementati
   - Vista `potatura-standalone.html` e card “Potatura” in dashboard frutteto
   - Evoluzione “da lavori/attività” in `PIANO_POTATURA_TRATTAMENTI_DA_LAVORI.md`

2. ⚠️ **Gestione Diradamento**
   - Modello `Diradamento.js` (da creare)
   - Servizio `diradamento-service.js` (da creare)
   - Vista `diradamento-standalone.html` (opzionale)

### Fase 3 - Trattamenti

1. ✅ **Gestione Trattamenti** (2026-01-31; miglioramenti 2026-02-03)
   - Modello `TrattamentoFrutteto.js` e servizio `trattamenti-frutteto-service.js` implementati
   - Vista `trattamenti-standalone.html` e card "Trattamenti" in dashboard frutteto
   - **2026-02-03**: Alert dosaggio (conferma "Salvare comunque?" se fuori range); colonna Avvisi in lista (bollino verde se ok, ⚠️ con tooltip se dosaggio fuori range); pulsante Modifica visibile (btn-secondary); costi prodotti trattamenti inclusi in `aggregaSpeseFruttetoAnno` → Spese totali dashboard “Trattamenti” in dashboard frutteto
   - Evoluzione “da lavori/attività” in `PIANO_POTATURA_TRATTAMENTI_DA_LAVORI.md`

### Fase 4 - Pianificazione Impianti

1. ⚠️ **Pianificazione Nuovi Impianti**
   - Calcolo materiali necessari
   - Stima costi impianto
   - Integrazione con sistema Lavori

### Fase 5 - Report e Statistiche

1. ⚠️ **Report Specifici Frutteto**
   - Report produzione per specie/varietà
   - Report rese e costi
   - Report qualità frutta
   - Integrazione con `core/statistiche-standalone.html`

### Fase 6 - Calcolo Compensi Raccolta

1. ⚠️ **Calcolo Automatico Compensi**
   - Tariffa per kg raccolto
   - Tariffa per ora
   - Integrazione con sistema manodopera

---

## 🔧 Note Tecniche

### Normalizzazione Specie

Il servizio `varieta-frutteto-service.js` gestisce automaticamente la normalizzazione dei nomi specie per gestire varianti comuni (plurale/singolare, alias). Questo garantisce che il dropdown varietà si popoli correttamente indipendentemente da come viene salvata la specie nel terreno o nel frutteto.

### Filtro Client-Side per Specie

Per evitare la necessità di creare un composite index Firestore, il codice filtra le colture client-side dopo aver recuperato tutte le colture ordinate per nome. Questo approccio è più semplice e funziona bene per un numero limitato di colture.

### Varietà Personalizzate

Le varietà personalizzate vengono attualmente salvate in `localStorage` come soluzione temporanea. In futuro, queste potranno essere migrate a Firestore per supporto multi-tenant completo.

---

## 📝 Riferimenti

- **Architettura Generale**: `PLAN_MODULI_COLTURA_SPECIALIZZATI.md`
- **Guida Sviluppo**: `GUIDA_SVILUPPO_MODULI_FRUTTETO_OLIVETO.md`
- **Modulo Vigneto**: `PLAN_MODULO_VIGNETO_DETTAGLIATO.md` (riferimento per pattern)
- **Classe Base**: `shared/models/BaseColtura.js`

---

**Data completamento Fase Base**: 2026-01-29  
**Data completamento Dashboard e Integrazione**: 2026-01-29  
**Stato**: ✅ COMPLETATO (Anagrafica + Raccolta + Integrazioni Base + Dashboard + Statistiche + Integrazione Lavori)  
**Prossimo Passo**: Statistiche Avanzate (grafici come vigneto) o Fase 2 - Potatura e Diradamento (opzionale)
