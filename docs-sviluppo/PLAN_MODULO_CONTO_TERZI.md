# 📋 Piano Sviluppo: Modulo Conto Terzi

**Data creazione**: 2025-01-24  
**Ultimo aggiornamento**: 2025-12-18  
**Stato**: ✅ FASE 1 MVP COMPLETATA - ✅ FASE 2 COMPLETATA  
**Priorità**: Alta

---

## 🎯 Obiettivo Modulo

Il **Modulo Conto Terzi** permette di gestire lavori agricoli svolti per conto di clienti esterni, con supporto completo per:
- Anagrafica clienti
- Gestione terreni dei clienti
- Preventivi e offerte
- Pianificazione e tracciamento lavori
- Calcolo costi e ore (anche senza modulo Manodopera)
- Integrazione con moduli esistenti (Manodopera, Parco Macchine)

**Target**: Aziende agricole che svolgono lavori conto terzi oltre alla gestione dei propri terreni.

---

## 🏗️ Architettura Generale

### Principio Fondamentale

**Separazione visiva, unificazione logica**:
- Sezione dedicata "Conto Terzi" con colore distintivo (blu)
- Riutilizzo completo della logica esistente (modelli, servizi)
- Filtri automatici per distinguere lavori interni da conto terzi

### Struttura Modulo

```
modules/conto-terzi/
├── models/
│   ├── Cliente.js              # Anagrafica clienti
│   └── Preventivo.js           # Preventivi/offerte
│
├── services/
│   ├── clienti-service.js      # CRUD clienti
│   ├── preventivi-service.js   # CRUD preventivi
│   └── lavori-conto-terzi-service.js  # Gestione lavori conto terzi
│
└── views/
    ├── conto-terzi-home.html          # Pagina principale sezione
    ├── clienti.html                    # Anagrafica clienti
    ├── terreni-clienti.html            # Terreni dei clienti
    ├── preventivi.html                 # Gestione preventivi
    ├── lavori-da-pianificare.html      # Lavori da pianificare
    ├── lavori-in-corso.html            # Lavori in corso
    ├── lavori-completati.html           # Lavori completati
    └── diario-attivita-conto-terzi.html # Diario (se Manodopera non attivo)
```

---

## 📊 Modifiche ai Modelli Esistenti

### 1. Modello Lavoro (`core/models/Lavoro.js`)

**Campi da aggiungere**:
```javascript
{
  // Campi esistenti...
  
  // Campi Conto Terzi (opzionali)
  clienteId: string | null,        // Se presente → lavoro conto terzi
  preventivoId: string | null,      // Se creato da preventivo accettato
}
```

**Stati lavoro estesi**:
- `"da_pianificare"` - Lavoro creato da preventivo, da completare
- `"assegnato"` - Lavoro pianificato e assegnato
- `"in_corso"` - Lavoro in esecuzione
- `"completato"` - Lavoro completato
- `"annullato"` - Lavoro annullato

**Validazione**:
- Se `clienteId` presente → lavoro conto terzi
- Se `clienteId` null → lavoro interno (comportamento attuale)

### 2. Modello Terreno (`core/models/Terreno.js`)

**Campi da aggiungere**:
```javascript
{
  // Campi esistenti...
  
  // Campo Conto Terzi (opzionale)
  clienteId: string | null,        // Se presente → terreno cliente
}
```

**Validazione**:
- Se `clienteId` presente → terreno del cliente
- Se `clienteId` null → terreno azienda (comportamento attuale)

### 3. Modello Attività (`core/models/Attivita.js`)

**Campi da aggiungere**:
```javascript
{
  // Campi esistenti...
  
  // Campi Conto Terzi (opzionali)
  clienteId: string | null,        // Se presente → attività conto terzi
  lavoroId: string | null,          // Se collegata a un lavoro
}
```

**Validazione**:
- Se `clienteId` presente → attività conto terzi
- Se `clienteId` null → attività interna (comportamento attuale)

### 4. Nuovo Modello: Cliente (`modules/conto-terzi/models/Cliente.js`)

```javascript
{
  id: string,
  ragioneSociale: string,          // OBBLIGATORIO
  partitaIva: string,              // Opzionale
  codiceFiscale: string,           // Opzionale
  indirizzo: string,                // Opzionale
  citta: string,                    // Opzionale
  cap: string,                      // Opzionale
  provincia: string,                // Opzionale
  telefono: string,                 // Opzionale
  email: string,                    // Opzionale
  note: string,                     // Note cliente
  
  // Stato
  stato: "attivo" | "sospeso" | "archiviato",  // Default: "attivo"
  
  // Statistiche (calcolate automaticamente)
  dataPrimoLavoro: Date | null,
  dataUltimoLavoro: Date | null,
  totaleLavori: number,            // Default: 0
  
  // Timestamps
  creatoIl: Date,
  aggiornatoIl: Date
}
```

### 5. Nuovo Modello: Preventivo (`modules/conto-terzi/models/Preventivo.js`)

```javascript
{
  id: string,
  numero: string,                  // Numero progressivo (es. "PREV-2025-001")
  clienteId: string,                // OBBLIGATORIO
  
  // Date
  data: Date,                       // Data creazione
  validitaGiorni: number,           // Giorni validità (default: 30)
  scadeIl: Date,                    // Calcolato automaticamente
  
  // Stato
  stato: "bozza" | "inviato" | "accettato" | "rifiutato" | "scaduto",
  
  // Dettagli lavori proposti
  lavori: Array<{
    tipoLavoro: string,             // Tipo lavoro (es. "Potatura")
    terrenoId: string,               // ID terreno cliente
    superficie: number,              // Superficie in ettari
    tariffa: number,                 // Tariffa unitaria (€/ha o €/ora)
    totale: number                   // Calcolato: superficie * tariffa
  }>,
  
  totale: number,                    // Somma totale tutti i lavori
  
  // Se accettato
  accettatoIl: Date | null,
  lavoroId: string | null,           // ID lavoro creato quando accettato
  
  note: string,                     // Note opzionali
  
  // Timestamps
  creatoIl: Date,
  aggiornatoIl: Date
}
```

---

## 🎨 Design e UX

### Colore Sezione Conto Terzi

**Sfondo gradiente blu**:
- Colore chiaro: `#E3F2FD` (blu chiaro)
- Colore scuro: `#1976D2` (blu medio)
- **Motivazione**: Distingue visivamente dal verde del Core Base, professionale e coerente

### Card Dashboard

**Card "Conto Terzi" nella dashboard principale**:
- **Posizionamento**: Sezione principale dashboard (Core Base e Manager)
- **Visibilità**: Solo se modulo Conto Terzi attivo
- **Design**:
  - Icona: Handshake o documenti
  - Titolo: "Conto Terzi"
  - Sottotesto: "Gestione clienti e lavori esterni"
  - Colore sfondo: Blu chiaro (`#E3F2FD`)
  - Bordo: Blu scuro (`#1976D2`)
  - Badge opzionale: Numero lavori in corso

### Header Sezione Conto Terzi

**Tutte le pagine della sezione**:
- **Sfondo header**: Blu scuro (`#1976D2`)
- **Testo**: Bianco, grande e bold
- **Titolo**: "CONTO TERZI" ben visibile
- **Sottotitolo**: "Gestione clienti e lavori esterni"
- **Badge**: Indicatore "Sezione Conto Terzi" sempre visibile
- **Pulsante**: "Torna alla Dashboard" sempre visibile (colore verde)

### Indicatori Visivi

**Per rendere chiaro che si è nella sezione Conto Terzi**:
1. **Cambio colore sfondo**: Tutta la pagina ha sfondo blu (non più verde)
2. **Header evidenziato**: Titolo "CONTO TERZI" grande e visibile
3. **Badge sezione**: Piccolo badge in alto a destra "CONTO TERZI"
4. **Breadcrumb**: "Dashboard > Conto Terzi" sempre visibile
5. **Menu interno**: Menu navigazione interno con voci evidenziate

---

## 🔄 Flussi Operativi

### Flusso 1: Creazione Preventivo

1. **Manager crea preventivo**:
   - Seleziona cliente
   - Aggiunge lavori proposti (tipo, terreno, superficie, tariffa)
   - Sistema calcola totale automaticamente
   - Salva come "bozza"

2. **Manager invia preventivo**:
   - Stato diventa "inviato"
   - Data invio registrata
   - Scadenza calcolata (data + validità giorni)

3. **Cliente accetta preventivo**:
   - Manager marca preventivo come "accettato"
   - Sistema crea automaticamente "Lavoro da Pianificare"
   - Stato lavoro: "da_pianificare"
   - Dati precompilati: cliente, terreno, tipo lavoro, superficie, tariffa

### Flusso 2: Pianificazione Lavoro

1. **Manager apre "Lavori da Pianificare"**:
   - Vede lista lavori con stato "da_pianificare"
   - Ogni lavoro mostra: cliente, terreno, tipo lavoro, superficie

2. **Manager completa pianificazione**:
   - Apre form completamento lavoro
   - Compila:
     - Data inizio
     - Durata prevista
     - Assegnazione (se Manodopera attivo: caposquadra/operaio)
     - Macchine (se Parco Macchine attivo: trattore/attrezzo)
     - Note aggiuntive
   - Salva

3. **Lavoro diventa "assegnato"**:
   - Stato cambia automaticamente a "assegnato"
   - Lavoro appare in "Lavori in Corso"

### Flusso 3: Esecuzione Lavoro

**Scenario A: Con Modulo Manodopera attivo**

1. **Operai segnano ore**:
   - Operai vedono lavoro nella loro dashboard
   - Segnano ore normalmente (stesso sistema esistente)
   - Ore tracciate con `clienteId` e `lavoroId`

2. **Caposquadra traccia zone**:
   - Caposquadra traccia zone lavorate (stesso sistema esistente)
   - Zone salvate con `clienteId` e `lavoroId`

3. **Manager valida ore**:
   - Manager valida ore normalmente (stesso sistema esistente)
   - Ore validate contengono `clienteId` e `lavoroId`

4. **Lavoro completato**:
   - Quando lavoro raggiunge 100% → stato "completato"
   - Lavoro appare in "Lavori Completati"

**Scenario B: Senza Modulo Manodopera (solo proprietario)**

1. **Proprietario traccia nel Diario Attività Conto Terzi**:
   - Apre "Diario Attività Conto Terzi"
   - Seleziona lavoro dalla lista
   - Compila: data, orario inizio/fine, pause, note
   - Sistema calcola ore automaticamente
   - Salva attività con `clienteId` e `lavoroId`

2. **Sistema aggiorna progresso lavoro**:
   - Calcola ore totali lavorate
   - Aggiorna percentuale completamento
   - Se raggiunge 100% → stato "completato"

3. **Lavoro completato**:
   - Lavoro appare in "Lavori Completati"

### Flusso 4: Calcolo Costi

**Per ogni lavoro conto terzi, sistema calcola**:

1. **Costi manodopera** (se Manodopera attivo):
   - Ore validate × Tariffa operaio
   - Somma per tutti gli operai

2. **Costi macchine** (se Parco Macchine attivo):
   - Ore macchina × Costo orario macchina
   - Somma per tutte le macchine

3. **Costi proprietario** (se Manodopera non attivo):
   - Ore diario attività × Tariffa proprietario (configurabile)

4. **Totale costi**:
   - Somma tutti i costi
   - Disponibile per calcolo margine (futuro)

---

## 🔗 Integrazione con Moduli Esistenti

### Integrazione Modulo Manodopera

**Se Manodopera attivo**:
- ✅ Lavori conto terzi assegnabili a caposquadra/operaio
- ✅ Operai segnano ore per lavori conto terzi (stesso sistema)
- ✅ Caposquadra traccia zone per lavori conto terzi (stesso sistema)
- ✅ Manager valida ore per lavori conto terzi (stesso sistema)
- ✅ Calcolo costi manodopera automatico

**Modifiche necessarie**:
- Filtro automatico: nelle query lavori, aggiungere `clienteId != null` per conto terzi
- Nessuna modifica logica, solo filtri

### Integrazione Modulo Parco Macchine

**Se Parco Macchine attivo**:
- ✅ Macchine assegnabili a lavori conto terzi (stesso sistema)
- ✅ Tracciamento ore macchina per lavori conto terzi (stesso sistema)
- ✅ Gestione guasti per lavori conto terzi (stesso sistema)
- ✅ Calcolo costi macchine automatico

**Modifiche necessarie**:
- Filtro automatico: nelle query lavori, aggiungere `clienteId != null` per conto terzi
- Nessuna modifica logica, solo filtri

### Integrazione Core Base

**Diario Attività**:
- Se Manodopera **non attivo**: Diario dedicato "Diario Attività Conto Terzi"
  - Stessa logica del diario core
  - Filtro automatico: solo attività con `clienteId != null`
  - Calcolo ore automatico (orario inizio/fine - pause)
  
- Se Manodopera **attivo**: Diario non necessario
  - Ore tracciate da operai (sistema Manodopera)

**Terreni**:
- Terreni clienti gestiti separatamente
- Stessa logica terreni core
- Filtro automatico: solo terreni con `clienteId != null`

---

## 📱 Struttura Pagine

### 1. Pagina Principale: "Conto Terzi Home"

**Path**: `modules/conto-terzi/views/conto-terzi-home.html`

**Contenuto**:
- **Header**: "CONTO TERZI" con sfondo blu
- **Card statistiche**:
  - Clienti attivi
  - Lavori in corso
  - Preventivi aperti
  - Fatturato mese (futuro)
- **Quick actions**:
  - "Nuovo Cliente"
  - "Nuovo Preventivo"
  - "Nuovo Lavoro" (creazione diretta, senza preventivo)
- **Menu navigazione interno**:
  - Clienti
  - Terreni Clienti
  - Preventivi
  - Lavori da Pianificare
  - Lavori in Corso
  - Lavori Completati
  - Diario Attività (solo se Manodopera non attivo)

### 2. Anagrafica Clienti

**Path**: `modules/conto-terzi/views/clienti.html`

**Funzionalità**:
- Lista clienti con filtri (nome, P.IVA, stato)
- Form creazione/modifica cliente
- Vista dettaglio cliente (statistiche, lavori, preventivi)
- Eliminazione cliente (solo se nessun lavoro associato)

### 3. Terreni Clienti

**Path**: `modules/conto-terzi/views/terreni-clienti.html`

**Funzionalità**:
- Lista terreni per cliente
- Form creazione/modifica terreno cliente
- Mappa terreni cliente (riuso logica terreni core)
- Geolocalizzazione e tracciamento confini

### 4. Preventivi

**Path**: `modules/conto-terzi/views/preventivi.html`

**Funzionalità**:
- Lista preventivi con filtri (cliente, stato, periodo)
- Form creazione preventivo
- Vista dettaglio preventivo
- Azioni: invia, accetta, rifiuta
- Quando accettato → crea automaticamente "Lavoro da Pianificare"

### 5. Lavori da Pianificare

**Path**: `modules/conto-terzi/views/lavori-da-pianificare.html`

**Funzionalità**:
- Lista lavori con stato "da_pianificare"
- Card per ogni lavoro: cliente, terreno, tipo lavoro, superficie
- Azione "Pianifica" → apre form completamento
- Dopo pianificazione → stato diventa "assegnato"

### 6. Lavori in Corso

**Path**: `modules/conto-terzi/views/lavori-in-corso.html`

**Funzionalità**:
- Lista lavori con stato "assegnato" o "in_corso"
- Visualizzazione progresso (se Manodopera attivo)
- Dettagli: ore lavorate, superficie lavorata, percentuale
- Azioni: completa, annulla, modifica

### 7. Lavori Completati

**Path**: `modules/conto-terzi/views/lavori-completati.html`

**Funzionalità**:
- Lista lavori con stato "completato"
- Filtri: cliente, periodo, tipo lavoro
- Dettagli completi: costi, ore, superficie
- Azioni: genera fattura (futuro), rivedi dettagli

### 8. Diario Attività Conto Terzi

**Path**: `modules/conto-terzi/views/diario-attivita-conto-terzi.html`

**Visibilità**: Solo se Manodopera **non attivo**

**Funzionalità**:
- Stessa logica del diario attività core
- Filtro automatico: solo attività con `clienteId != null`
- Calcolo ore automatico (orario inizio/fine - pause)
- Collegamento a lavori conto terzi

---

## 🎯 Priorità Implementazione

### Fase 1: MVP (Minimo Funzionante)

**Obiettivo**: Funzionalità base per gestire lavori conto terzi

1. ✅ **Modifiche modelli esistenti**:
   - Aggiungere `clienteId` a Lavoro, Terreno, Attività
   - Validazione e logica filtri

2. ✅ **Modello Cliente**:
   - Creare modello Cliente
   - Service CRUD clienti

3. ✅ **Anagrafica Clienti**:
   - Pagina gestione clienti
   - CRUD completo

4. ✅ **Anagrafica Terreni Clienti**:
   - Pagina gestione terreni clienti
   - Riuso logica terreni core

5. ✅ **Card Dashboard**:
   - Aggiungere card "Conto Terzi" nella dashboard
   - Link a sezione Conto Terzi

6. ✅ **Design sezione**:
   - Cambio colore sfondo (blu)
   - Header con "CONTO TERZI"
   - Indicatori visivi

**Tempo stimato**: 8-10 ore

### Fase 2: Preventivi e Pianificazione

**Obiettivo**: Sistema preventivi e pianificazione lavori

1. ✅ **Modello Preventivo**:
   - Creare modello Preventivo
   - Service CRUD preventivi

2. ✅ **Gestione Preventivi**:
   - Pagina preventivi
   - Creazione, invio, accettazione

3. ✅ **Lavori da Pianificare**:
   - Pagina lavori da pianificare
   - Form completamento pianificazione

4. ✅ **Lavori in Corso/Completati**:
   - Pagine lavori in corso e completati
   - Visualizzazione progresso

**Tempo stimato**: 6-8 ore

### Fase 3: Integrazione e Diario

**Obiettivo**: Integrazione completa con moduli esistenti

1. ✅ **Integrazione Manodopera**:
   - Filtri per lavori conto terzi
   - Tracciamento ore per clienti

2. ✅ **Integrazione Parco Macchine**:
   - Filtri per lavori conto terzi
   - Tracciamento macchine per clienti

3. ✅ **Diario Attività Conto Terzi**:
   - Pagina diario (se Manodopera non attivo)
   - Calcolo ore automatico

4. ✅ **Calcolo Costi**:
   - Calcolo costi per lavoro
   - Report costi per cliente

**Tempo stimato**: 4-6 ore

### Fase 4: Fatturazione (Futuro)

**Obiettivo**: Sistema fatturazione completo

1. ⏳ **Modello Fattura**
2. ⏳ **Generazione Fatture**
3. ⏳ **Export PDF**
4. ⏳ **Gestione Pagamenti**

**Tempo stimato**: 8-10 ore (da fare in futuro)

---

## 🔧 Considerazioni Tecniche

### Filtri Automatici

**Tutte le query devono filtrare per `clienteId`**:

- **Lavori interni**: `clienteId == null`
- **Lavori conto terzi**: `clienteId != null`

**Esempio query lavori**:
```javascript
// Lavori interni
where('clienteId', '==', null)

// Lavori conto terzi
where('clienteId', '!=', null)

// Lavori per cliente specifico
where('clienteId', '==', clienteId)
```

### Compatibilità Retroattiva

**Importante**: I lavori esistenti hanno `clienteId == null` (lavori interni)
- ✅ Nessuna modifica necessaria ai dati esistenti
- ✅ Sistema funziona correttamente con dati vecchi
- ✅ Nuovi lavori possono avere `clienteId` opzionale

### Performance

**Query ottimizzate**:
- Indici Firestore per `clienteId`
- Denormalizzazione: `clienteNome` nei lavori (per performance)
- Cache locale per clienti frequenti

### Sicurezza

**Firestore Rules**:
- Solo Manager/Amministratore può creare/modificare clienti
- Solo Manager/Amministratore può creare/modificare preventivi
- Solo Manager/Amministratore può pianificare lavori
- Operai possono solo vedere lavori assegnati (stesso sistema esistente)

---

## 📊 Struttura Dati Firestore

### Collection: `clienti`

```
tenants/{tenantId}/clienti/{clienteId}
{
  ragioneSociale: string,
  partitaIva: string | null,
  codiceFiscale: string | null,
  indirizzo: string | null,
  citta: string | null,
  cap: string | null,
  provincia: string | null,
  telefono: string | null,
  email: string | null,
  note: string | null,
  stato: "attivo" | "sospeso" | "archiviato",
  dataPrimoLavoro: Timestamp | null,
  dataUltimoLavoro: Timestamp | null,
  totaleLavori: number,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### Collection: `preventivi`

```
tenants/{tenantId}/preventivi/{preventivoId}
{
  numero: string,
  clienteId: string,
  data: Timestamp,
  validitaGiorni: number,
  scadeIl: Timestamp,
  stato: "bozza" | "inviato" | "accettato" | "rifiutato" | "scaduto",
  lavori: Array<{
    tipoLavoro: string,
    terrenoId: string,
    superficie: number,
    tariffa: number,
    totale: number
  }>,
  totale: number,
  accettatoIl: Timestamp | null,
  lavoroId: string | null,
  note: string | null,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### Modifiche Collection Esistenti

**Collection: `lavori`**
- Aggiungere campo `clienteId: string | null`
- Aggiungere campo `preventivoId: string | null`
- Stato esteso: `"da_pianificare"` aggiunto

**Collection: `terreni`**
- Aggiungere campo `clienteId: string | null`

**Collection: `attivita`**
- Aggiungere campo `clienteId: string | null`
- Aggiungere campo `lavoroId: string | null`

---

## ✅ Checklist Implementazione

### Fase 1: MVP ✅ COMPLETATA (2025-12-07)
- [x] Modifiche modelli Lavoro, Terreno, Attività
- [x] Modello Cliente
- [x] Service clienti
- [x] Pagina anagrafica clienti
- [x] Pagina terreni clienti
- [x] Card dashboard "Conto Terzi"
- [x] Design sezione (colore blu, header)
- [x] Pagina principale sezione Conto Terzi
- [x] Integrazione abbonamento (modulo attivabile)
- [x] Fix CORS e percorsi (compatibile file://)
- [x] Sistema navigazione gerarchico

### Fase 2: Preventivi e Pianificazione ✅ COMPLETATA (2025-12-10)
- [x] Modello Preventivo
- [x] Service preventivi
- [x] Pagina gestione preventivi
- [x] Logica creazione lavoro da preventivo
- [x] Pagina lavori da pianificare (integrazione in Gestione Lavori)
- [x] Form completamento pianificazione (modalità semplificata senza Manodopera)
- [x] Pagine lavori in corso/completati (integrazione in Gestione Lavori)
- [x] Pianificazione lavori conto terzi senza Manodopera
- [x] Supporto Parco Macchine per lavori conto terzi
- [x] Generazione automatica voce diario quando lavoro completato

### Fase 3: Integrazione
- [ ] Filtri Manodopera per conto terzi
- [ ] Filtri Parco Macchine per conto terzi
- [ ] Diario Attività Conto Terzi (se Manodopera non attivo)
- [ ] Calcolo costi per lavoro
- [ ] Report costi per cliente

### Fase 4: Fatturazione (Futuro)
- [ ] Modello Fattura
- [ ] Service fatture
- [ ] Generazione fatture
- [ ] Export PDF
- [ ] Gestione pagamenti

---

## 🎨 Schema Colori

### Core Base (Verde)
- **Sfondo gradiente**: `#B0E0E6` → `#228B22`
- **Card**: Verde chiaro
- **Accenti**: Verde scuro

### Conto Terzi (Blu)
- **Sfondo gradiente**: `#E3F2FD` → `#1976D2`
- **Card**: Blu chiaro (`#E3F2FD`)
- **Bordo**: Blu scuro (`#1976D2`)
- **Header**: Blu scuro (`#1976D2`) con testo bianco

---

## 📝 Note Finali

### Compatibilità
- ✅ Funziona con solo Core Base
- ✅ Funziona con Core Base + Manodopera
- ✅ Funziona con Core Base + Parco Macchine
- ✅ Funziona con tutti i moduli attivi

### Scalabilità
- ✅ Facile aggiungere fatturazione in futuro
- ✅ Facile aggiungere report avanzati
- ✅ Facile aggiungere export dati

### Manutenibilità
- ✅ Codice riutilizzato (stessa logica moduli esistenti)
- ✅ Modelli estesi (non duplicati)
- ✅ Filtri automatici (separazione logica, non fisica)

---

**Stato**: ✅ FASE 1 MVP COMPLETATA (2025-12-07)  
**Prossimo passo**: Fase 2 - Preventivi e Pianificazione Lavori

