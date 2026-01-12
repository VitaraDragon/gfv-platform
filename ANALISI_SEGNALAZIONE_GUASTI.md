# 🔧 Analisi Dettagliata: Sistema Segnalazione Guasti

## 📋 Indice
1. [Panoramica Generale](#panoramica-generale)
2. [Architettura e Componenti](#architettura-e-componenti)
3. [Flusso Operativo Completo](#flusso-operativo-completo)
4. [Intersezioni con Altri Moduli](#intersezioni-con-altri-moduli)
5. [Stati e Transizioni](#stati-e-transizioni)
6. [Permessi e Sicurezza](#permessi-e-sicurezza)
7. [Integrazione Dashboard](#integrazione-dashboard)
8. [Dettagli Implementativi](#dettagli-implementativi)

---

## 🎯 Panoramica Generale

Il sistema di **Segnalazione Guasti** è un modulo integrato nel **Parco Macchine** che permette agli operai di segnalare malfunzionamenti di trattori e attrezzi, e ai manager di gestire la risoluzione e le conseguenze sui lavori.

### Caratteristiche Principali
- ✅ **Distinzione Componenti**: Supporta guasti di trattore, attrezzo, o entrambi
- ✅ **Gravità**: Classificazione "grave" vs "non grave"
- ✅ **Impatto Automatico**: Aggiornamento automatico stato macchine e lavori
- ✅ **Workflow Manager**: Approvazione continuazione, sospensione, risoluzione
- ✅ **Storico Completo**: Tracciamento completo con note e costi
- ✅ **Real-time**: Aggiornamenti in tempo reale nella dashboard

---

## 🏗️ Architettura e Componenti

### File Principali

#### 1. **Segnalazione Guasti (Operai)**
**File**: `core/admin/segnalazione-guasti-standalone.html`
- **Ruolo**: Pagina per operai/capisquadra per segnalare nuovi guasti
- **Accesso**: Solo utenti con ruolo `operaio` o `caposquadra`
- **Requisito**: Modulo Parco Macchine attivo

#### 2. **Gestione Guasti (Manager)**
**File**: `core/admin/gestione-guasti-standalone.html`
- **Ruolo**: Pagina per manager per gestire tutti i guasti
- **Accesso**: Solo utenti con ruolo `manager` o `amministratore`
- **Funzionalità**: Visualizzazione, filtri, azioni manager

#### 3. **Gestione Macchine**
**File**: `core/admin/gestione-macchine-standalone.html`
- **Integrazione**: Mostra storico guasti per ogni macchina
- **Query**: Filtra guasti in base a `componenteGuasto`

#### 4. **Dashboard**
**File**: `core/dashboard-standalone.html`
- **Sezione**: "Guasti Segnalati" (solo per manager con Parco Macchine)
- **Real-time**: Listener `onSnapshot` per aggiornamenti live

### Struttura Dati Firestore

**Collection**: `tenants/{tenantId}/guasti/{guastoId}`

```javascript
{
  // Identificazione
  macchinaId: string | null,        // ID trattore (può essere null se solo attrezzo)
  attrezzoId: string | null,         // ID attrezzo separato
  componenteGuasto: 'trattore' | 'attrezzo' | 'entrambi',  // ⭐ Campo chiave
  
  // Classificazione
  gravita: 'grave' | 'non-grave',
  dettagli: string,                  // Descrizione problema
  
  // Collegamento lavoro
  lavoroId: string | null,           // Lavoro associato (opzionale)
  
  // Segnalazione
  segnalatoDa: string,               // UID operaio
  segnalatoIl: Timestamp,
  stato: 'in-attesa' | 'approvato-continuazione' | 'sospeso' | 'risolto',
  risolto: boolean,
  
  // Risoluzione (se risolto)
  risoltoDa: string | null,          // UID manager/operaio
  risoltoIl: Timestamp | null,
  noteRisoluzione: string | null,
  costoRiparazione: number | null,
  
  // Azioni manager
  approvatoDa: string | null,
  approvatoIl: Timestamp | null,
  sospesoDa: string | null,
  sospesoIl: Timestamp | null,
  
  // Riapertura (se riaperto)
  riapertoDa: string | null,
  riapertoIl: Timestamp | null,
  motivoRiapertura: string | null
}
```

---

## 🔄 Flusso Operativo Completo

### 1. Segnalazione Guasto (Operaio)

#### Pre-compilazione Automatica
Quando un operaio accede alla pagina di segnalazione:
1. **Carica lavori attivi** dell'operaio (autonomi o di squadra)
2. **Identifica lavoro più recente** (per data creazione/aggiornamento)
3. **Pre-seleziona**:
   - Trattore dal lavoro (`macchinaId`)
   - Attrezzo dal lavoro (`attrezzoId`)
   - Lavoro associato (`lavoroId`)
4. **Aggiorna dropdown componente** in base a trattore/attrezzo selezionati

#### Form Segnalazione
**Campi obbligatori**:
- Trattore (se componente = trattore o entrambi)
- Attrezzo (se componente = attrezzo o entrambi)
- **Componente con guasto** (dropdown: trattore/attrezzo/entrambi)
- **Gravità** (radio: grave/non grave)
- **Dettagli** (textarea)

**Validazione**:
```javascript
// Verifica coerenza componente vs selezione
if (componenteGuasto === 'trattore' && !macchinaId) → ERRORE
if (componenteGuasto === 'attrezzo' && !attrezzoId) → ERRORE
if (componenteGuasto === 'entrambi' && (!macchinaId || !attrezzoId)) → ERRORE
```

#### Salvataggio e Impatto Automatico

**1. Crea documento guasto**:
```javascript
await addDoc(collection(db, `tenants/${tenantId}/guasti`), {
  macchinaId, attrezzoId, componenteGuasto,
  gravita, dettagli, lavoroId,
  segnalatoDa: currentUser.uid,
  segnalatoIl: serverTimestamp(),
  stato: 'in-attesa',
  risolto: false
});
```

**2. Aggiorna stato trattore** (solo se componente = 'trattore' o 'entrambi'):
```javascript
if (macchinaId && (componenteGuasto === 'trattore' || componenteGuasto === 'entrambi')) {
  let nuovoStato = 'guasto';
  if (gravita === 'non-grave') {
    nuovoStato = 'guasto-lavoro-in-corso';  // ⭐ Permette continuazione
  }
  await updateDoc(macchinaRef, { stato: nuovoStato });
}
```

**3. Aggiorna stato attrezzo** (solo se componente = 'attrezzo' o 'entrambi'):
```javascript
if (attrezzoId && (componenteGuasto === 'attrezzo' || componenteGuasto === 'entrambi')) {
  let nuovoStato = 'guasto';
  if (gravita === 'non-grave') {
    nuovoStato = 'guasto-lavoro-in-corso';
  }
  await updateDoc(attrezzoRef, { stato: nuovoStato });
}
```

**4. Sospende lavoro** (solo se guasto grave + lavoro associato):
```javascript
if (gravita === 'grave' && lavoroId) {
  await updateDoc(lavoroRef, {
    stato: 'sospeso',
    motivoSospensione: 'Guasto macchina grave'
  });
}
```

### 2. Gestione Guasto (Manager)

#### Visualizzazione
- **Statistiche**: Guasti gravi, non gravi, risolti, totali
- **Filtri**: Per stato, gravità, macchina
- **Lista**: Tutti i guasti con dettagli completi

#### Azioni Disponibili

##### A. Approva Continuazione (solo guasti non gravi in attesa)
```javascript
await updateDoc(guastoRef, {
  stato: 'approvato-continuazione',
  approvatoDa: currentUser.uid,
  approvatoIl: serverTimestamp()
});
```
**Effetto**: Operaio può continuare a lavorare nonostante il guasto

##### B. Sospendi Lavoro
```javascript
// Aggiorna guasto
await updateDoc(guastoRef, {
  stato: 'sospeso',
  sospesoDa: currentUser.uid,
  sospesoIl: serverTimestamp()
});

// Aggiorna macchina (forza stato guasto)
await updateDoc(macchinaRef, { stato: 'guasto' });

// Sospendi lavoro se presente
if (lavoroId) {
  await updateDoc(lavoroRef, {
    stato: 'sospeso',
    motivoSospensione: 'Guasto macchina - Sospeso dal Manager'
  });
}
```

##### C. Risolvi Guasto
```javascript
// Aggiorna guasto
await updateDoc(guastoRef, {
  stato: 'risolto',
  risolto: true,
  risoltoDa: currentUser.uid,
  risoltoIl: serverTimestamp(),
  noteRisoluzione,
  costoRiparazione  // opzionale
});

// Ripristina stato macchina
let nuovoStato = 'disponibile';
if (macchinaData.stato === 'guasto-lavoro-in-corso') {
  nuovoStato = 'in-uso';  // Era in uso prima
}
await updateDoc(macchinaRef, { stato: nuovoStato });

// Riattiva lavoro se sospeso
if (lavoroId && lavoroData.stato === 'sospeso' && 
    lavoroData.motivoSospensione?.includes('Guasto')) {
  await updateDoc(lavoroRef, {
    stato: 'attivo',
    motivoSospensione: null
  });
}
```

##### D. Riapri Guasto (solo guasti risolti)
```javascript
await updateDoc(guastoRef, {
  stato: 'in-attesa',
  risolto: false,
  riapertoDa: currentUser.uid,
  riapertoIl: serverTimestamp(),
  motivoRisoluzione,
  noteRisoluzione: null,
  risoltoDa: null,
  risoltoIl: null
});

// Ripristina stato macchina
await updateDoc(macchinaRef, {
  stato: guastoData.gravita === 'grave' ? 'guasto' : 'guasto-lavoro-in-corso'
});
```

### 3. Risoluzione Guasto (Operaio)

Gli operai possono risolvere i propri guasti direttamente:
- **Modal**: Form con note risoluzione e costo (opzionale)
- **Ripristino stato**: Automatico per componente interessato
- **Lavoro sospeso**: Non riattivato automaticamente (manager deve confermare)

---

## 🔗 Intersezioni con Altri Moduli

### 1. Parco Macchine

#### Stati Macchine
Il sistema gestisce stati specifici per guasti:
- `guasto`: Guasto grave, macchina non utilizzabile
- `guasto-lavoro-in-corso`: Guasto non grave, può continuare lavoro

**Transizioni**:
```
disponibile → guasto (grave) / guasto-lavoro-in-corso (non grave)
in-uso → guasto (grave) / guasto-lavoro-in-corso (non grave)
guasto → disponibile / in-uso (risolto)
guasto-lavoro-in-corso → disponibile / in-uso (risolto)
```

#### Storico Guasti per Macchina
**File**: `core/admin/gestione-macchine-standalone.html`

**Query per Trattori**:
```javascript
// Cerca guasti dove macchinaId corrisponde E componenteGuasto è 'trattore' o 'entrambi'
where('macchinaId', '==', macchinaId)
// Filtro lato client: componenteGuasto === 'trattore' || componenteGuasto === 'entrambi'
```

**Query per Attrezzi**:
```javascript
// Cerca guasti dove attrezzoId corrisponde E componenteGuasto è 'attrezzo' o 'entrambi'
where('attrezzoId', '==', attrezzoId)
// Filtro lato client: componenteGuasto === 'attrezzo' || componenteGuasto === 'entrambi'
```

**Visualizzazione**:
- Badge componente (🚜 Trattore / ⚙️ Attrezzo / 🚜⚙️ Entrambi)
- Badge gravità (🔴 Grave / 🟡 Non grave)
- Badge stato (✅ Risolto / ⏳ In attesa / ✅ Continuazione approvata / ⛔ Sospeso)
- Dettagli completi con date, operai, note, costi

### 2. Manodopera (Lavori)

#### Sospensione Automatica Lavori
Quando viene segnalato un **guasto grave** con lavoro associato:
```javascript
if (gravita === 'grave' && lavoroId) {
  await updateDoc(lavoroRef, {
    stato: 'sospeso',
    motivoSospensione: 'Guasto macchina grave'
  });
}
```

#### Riattivazione Lavori
Quando un guasto viene risolto:
- **Operaio risolve**: Lavoro rimane sospeso, `motivoSospensione` aggiornato a "Guasto risolto - In attesa riattivazione Manager"
- **Manager risolve**: Lavoro riattivato automaticamente se sospeso per guasto

#### Pre-selezione Lavoro
Nel form segnalazione:
- Mostra lavori attivi dell'operaio (autonomi e di squadra)
- Pre-seleziona lavoro più recente
- Pre-compila trattore/attrezzo dal lavoro

### 3. Dashboard Manager

#### Sezione "Guasti Segnalati"
**File**: `core/dashboard-standalone.html` (linee 2892-3152)

**Condizioni visualizzazione**:
- Solo per utenti con ruolo `manager` o `amministratore`
- Solo se modulo Parco Macchine attivo
- Sezione visibile solo se ci sono guasti

**Listener Real-time**:
```javascript
const guastiRef = collection(db, `tenants/${tenantId}/guasti`);
onSnapshot(guastiRef, (snapshot) => {
  // Filtra guasti aperti e risolti
  // Ordina per data segnalazione
  // Aggiorna UI
});
```

**Visualizzazione**:
- **Guasti Aperti**: Lista completa con badge gravità/stato, link a gestione
- **Guasti Risolti**: Ultimi 5 risolti con data e costo
- **Link rapidi**: "Vai a Gestione Macchine" / "Gestisci Guasto"

### 4. Gestione Lavori

#### Filtro Macchine Disponibili
**File**: `core/admin/gestione-lavori-standalone.html`

Quando si assegna una macchina a un lavoro:
```javascript
// Disabilita macchine in guasto
option.disabled = trattore.stato === 'in_uso' || 
                  trattore.stato === 'in_manutenzione' || 
                  trattore.stato === 'guasto';
```

**Nota**: `guasto-lavoro-in-corso` non è disabilitato (può essere assegnato)

### 5. Attività

#### Visualizzazione Stato Macchina
**File**: `core/attivita-standalone.html`

Mostra icona ❌ se macchina è in stato `guasto`:
```javascript
macchina.stato === 'guasto' ? '❌' : '';
```

---

## 📊 Stati e Transizioni

### Stati Guasto

| Stato | Descrizione | Chi può vedere | Azioni disponibili |
|-------|-------------|----------------|-------------------|
| `in-attesa` | Guasto segnalato, in attesa gestione | Tutti | Manager: Approva/Sospendi/Risolve<br>Operaio: Risolve |
| `approvato-continuazione` | Continuazione lavoro approvata | Tutti | Manager: Sospendi/Risolve |
| `sospeso` | Lavoro sospeso dal manager | Tutti | Manager: Risolve |
| `risolto` | Guasto risolto | Tutti | Manager: Riapri |

### Stati Macchina (relativi a guasti)

| Stato | Significato | Utilizzabilità |
|-------|------------|----------------|
| `guasto` | Guasto grave | ❌ Non utilizzabile |
| `guasto-lavoro-in-corso` | Guasto non grave | ✅ Può continuare lavoro corrente |

### Transizioni Stato Macchina

```
SEGNALAZIONE:
  disponibile → guasto (grave) / guasto-lavoro-in-corso (non grave)
  in-uso → guasto (grave) / guasto-lavoro-in-corso (non grave)

RISOLUZIONE:
  guasto → disponibile (era disponibile) / in-uso (era in uso)
  guasto-lavoro-in-corso → disponibile (era disponibile) / in-uso (era in uso)

SOSPENSIONE MANAGER:
  qualsiasi → guasto (forza stato guasto)

RIAPERTURA:
  disponibile/in-uso → guasto (grave) / guasto-lavoro-in-corso (non grave)
```

---

## 🔐 Permessi e Sicurezza

### Firestore Rules

**File**: `firestore.rules` (linee 274-281)

```javascript
match /tenants/{tenantId}/guasti/{guastoId} {
  // Lettura: tutti gli utenti autenticati del tenant
  allow read: if isAuthenticated() && 
                 get(/databases/$(database)/documents/users/$(request.auth.uid)).data.tenantId == tenantId;
  
  // Scrittura: tutti gli utenti autenticati del tenant
  allow create, update, delete: if isAuthenticated() && 
                                   get(/databases/$(database)/documents/users/$(request.auth.uid)).data.tenantId == tenantId;
}
```

**Nota**: Le regole sono permissive (tutti gli utenti del tenant possono creare/modificare). La sicurezza è gestita lato client con:
- Verifica ruolo per accesso pagine
- Verifica modulo attivo
- Validazione azioni in base a ruolo

### Controlli Lato Client

#### Pagina Segnalazione Guasti
```javascript
// Verifica ruolo operaio
if (!ruoli.includes('operaio')) {
  window.location.href = '../dashboard-standalone.html';
}

// Verifica modulo Parco Macchine
if (!hasParcoMacchine) {
  window.location.href = '../dashboard-standalone.html';
}
```

#### Pagina Gestione Guasti
```javascript
// Verifica ruolo manager
const isManager = ruoli.some(r => {
  const roleLower = r.toLowerCase();
  return roleLower.includes('manager') || roleLower.includes('amministratore');
});

if (!isManager) {
  window.location.href = '../dashboard-standalone.html';
}
```

---

## 📱 Integrazione Dashboard

### Sezione Guasti Segnalati (Manager)

**Posizione**: Dashboard Manager → Sezione "Parco Macchine" → Card "Guasti Segnalati"

**Caricamento**:
1. Verifica modulo Parco Macchine attivo
2. Setup listener real-time su collection `guasti`
3. Carica macchine e utenti per nomi
4. Filtra e ordina guasti

**Visualizzazione**:
- **Guasti Aperti**: Lista completa con:
  - Icona tipo macchina (🚜/⚙️)
  - Nome macchina/attrezzo
  - Badge gravità (🔴/🟡)
  - Badge stato
  - Operaio e data segnalazione
  - Dettagli guasto
  - Link rapidi
  
- **Guasti Risolti**: Ultimi 5 con:
  - Nome macchina
  - Risolto da e data
  - Costo riparazione (se presente)

**Aggiornamento Real-time**:
- Listener `onSnapshot` aggiorna automaticamente
- Nuovi guasti appaiono immediatamente
- Risoluzioni aggiornate in tempo reale

---

## 🔍 Dettagli Implementativi

### Distinzione Componente Guasto

**Problema risolto** (2025-01-26):
Prima, quando veniva segnalato un guasto per "Trattore + Attrezzo", il sistema non distingueva quale componente aveva il guasto.

**Soluzione**:
- Campo `componenteGuasto`: `'trattore' | 'attrezzo' | 'entrambi'`
- Aggiornamento stato solo per componente interessato
- Query storico migliorata per trattori e attrezzi separati

**Implementazione**:
```javascript
// Aggiorna stato trattore SOLO se componenteGuasto è 'trattore' o 'entrambi'
if (macchinaId && (componenteGuasto === 'trattore' || componenteGuasto === 'entrambi')) {
  // Aggiorna stato trattore
}

// Aggiorna stato attrezzo SOLO se componenteGuasto è 'attrezzo' o 'entrambi'
if (attrezzoId && (componenteGuasto === 'attrezzo' || componenteGuasto === 'entrambi')) {
  // Aggiorna stato attrezzo
}
```

### Pre-compilazione Form

**Logica**:
1. Carica lavori attivi dell'operaio
2. Identifica lavoro più recente (per `createdAt` / `updatedAt` / `dataInizio`)
3. Pre-seleziona:
   - Lavoro nel dropdown
   - Trattore se `lavoro.macchinaId` esiste
   - Attrezzo se `lavoro.attrezzoId` esiste
4. Aggiorna dropdown componente automaticamente

**Gestione Squadre**:
- Operaio: Mostra lavori autonomi + lavori di squadra (tramite caposquadra)
- Caposquadra: Mostra lavori di squadra assegnati direttamente

### Query Storico Guasti

**Per Trattori**:
```javascript
// Query base: tutti i guasti
const guastiRef = collection(db, `tenants/${tenantId}/guasti`);

// Filtro lato client:
guasti.filter(g => 
  g.macchinaId === trattoreId && 
  (g.componenteGuasto === 'trattore' || g.componenteGuasto === 'entrambi')
);
```

**Per Attrezzi**:
```javascript
// Filtro lato client:
guasti.filter(g => 
  g.attrezzoId === attrezzoId && 
  (g.componenteGuasto === 'attrezzo' || g.componenteGuasto === 'entrambi')
);
```

**Nota**: Non si usa `where` su `componenteGuasto` per evitare problemi con indici Firestore. Il filtro è lato client.

### Gestione Lavori Sospesi

**Sospensione Automatica**:
- Solo per guasti **gravi** con lavoro associato
- Stato lavoro: `sospeso`
- Motivo: `'Guasto macchina grave'`

**Riattivazione**:
- **Operaio risolve**: Lavoro rimane sospeso, motivo aggiornato
- **Manager risolve**: Lavoro riattivato automaticamente se sospeso per guasto

**Verifica**:
```javascript
if (lavoroData.stato === 'sospeso' && 
    lavoroData.motivoSospensione?.includes('Guasto')) {
  // Riattiva lavoro
}
```

### Retrocompatibilità

**Campo `componenteGuasto`**:
- Default: `'trattore'` se non presente (dati legacy)
- Query storico: Gestisce entrambi i casi

**Campo `tipoMacchina` vs `tipo`**:
- Supporta entrambi i nomi per retrocompatibilità
- Preferenza: `tipoMacchina` > `tipo`

---

## 📝 Note Finali

### Punti di Forza
✅ **Distinzione precisa** tra trattore/attrezzo/entrambi  
✅ **Impatto automatico** su macchine e lavori  
✅ **Workflow completo** con approvazioni e sospensioni  
✅ **Storico dettagliato** con costi e note  
✅ **Real-time** nella dashboard  
✅ **Pre-compilazione intelligente** del form  

### Aree di Miglioramento Potenziali
- ⚠️ **Query lato client**: Storico guasti filtrato in memoria (potrebbe essere lento con molti guasti)
- ⚠️ **Riattivazione lavoro**: Operaio risolve → lavoro rimane sospeso (manager deve riattivare manualmente)
- ⚠️ **Notifiche**: Nessuna notifica push quando viene segnalato un guasto grave

### Dipendenze
- **Modulo Parco Macchine**: Obbligatorio
- **Modulo Manodopera**: Opzionale (per collegamento lavori)
- **Firebase Firestore**: Database
- **Firebase Auth**: Autenticazione

---

**Data Analisi**: 2025-01-27  
**Versione Sistema**: Completo e funzionante  
**Stato**: ✅ Produzione



