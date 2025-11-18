# 🏗️ Architettura Dati e Permessi - GFV Platform

**Data creazione**: 2025-01-13  
**Versione**: 1.0  
**Stato**: Definizione architetturale

---

## 🎯 Problema da Risolvere

**Sfida**: Gestire dati condivisi tra ruoli diversi con permessi granulari e accesso simultaneo.

**Esempi concreti**:
- **Terreno**: 
  - Manager può aggiungere/modificare/eliminare terreni
  - Caposquadra può tracciare zone lavorate sulla mappa (ma NON modificare il terreno stesso)
  - Operaio può solo vedere terreni dei suoi lavori (sola lettura)
  
- **Lavori**:
  - Manager crea/assegna lavori
  - Caposquadra vede lavori assegnati e traccia progressi
  - Operaio vede solo suoi lavori di oggi

**Requisiti**:
- Dati condivisi tra ruoli
- Permessi diversi per gli stessi dati
- Accesso simultaneo sicuro
- Modifiche limitate per ruolo

---

## 🏛️ Architettura Proposta: Separazione Logica dei Dati

### Principio Fondamentale

**Separare i dati in base alla loro "natura" e "proprietà"**:

1. **Dati Base** (Master Data): Dati strutturali, modificati solo da ruoli specifici
2. **Dati Operativi** (Transactional Data): Dati generati durante le operazioni, modificabili da più ruoli con permessi diversi
3. **Dati Derivati** (Computed Data): Dati calcolati automaticamente, non modificabili direttamente

### Struttura Firestore Proposta

```
tenants/{tenantId}/
├── terreni/                    # DATI BASE - Solo Manager può modificare
│   └── {terrenoId}/
│       ├── nome
│       ├── superficie
│       ├── coordinate
│       ├── polygonCoords       # Confini terreno (solo Manager modifica)
│       ├── coltura
│       └── note
│
├── lavori/                     # DATI OPERATIVI - Manager crea, Caposquadra aggiorna progressi
│   └── {lavoroId}/
│       ├── nome
│       ├── terrenoId           # Riferimento a terreno (sola lettura)
│       ├── caposquadraId
│       ├── dataInizio
│       ├── durataPrevista
│       ├── stato
│       └── zoneLavorate/       # SUB-COLLECTION - Caposquadra può aggiungere
│           └── {zonaId}/
│               ├── data
│               ├── caposquadraId
│               ├── coordinate  # Poligono zona lavorata
│               ├── superficieHa
│               └── note
│
├── ore/                        # DATI OPERATIVI - Operaio crea, Caposquadra valida
│   └── {oraId}/
│       ├── operaioId
│       ├── lavoroId
│       ├── terrenoId           # Riferimento (sola lettura)
│       ├── data
│       ├── orarioInizio
│       ├── orarioFine
│       ├── pauseMinuti
│       ├── oreNette            # Calcolato automaticamente
│       └── stato               # "da_validare" | "validate" | "rifiutate"
│
└── squadre/                    # DATI BASE - Manager crea, Caposquadra vede
    └── {squadraId}/
        ├── nome
        ├── caposquadraId
        └── operai/             # Array di user IDs
```

---

## 🔐 Sistema Permessi a Due Livelli

### Livello 1: Firestore Security Rules (Sicurezza Base)

**Obiettivo**: Impedire accessi non autorizzati a livello database.

**Regole Base**:
- Tutti gli utenti autenticati del tenant possono **leggere** dati del tenant
- Solo ruoli specifici possono **scrivere** in collezioni specifiche
- Filtri automatici per tenant (isolamento multi-tenant)

**Esempio Firestore Rules**:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper: verifica che utente appartenga al tenant
    function belongsToTenant(tenantId) {
      return request.auth != null && 
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.tenantId == tenantId;
    }
    
    // Helper: verifica ruolo utente
    function hasRole(role) {
      return request.auth != null &&
             role in get(/databases/$(database)/documents/users/$(request.auth.uid)).data.ruoli;
    }
    
    // TERRENI: Solo Manager/Admin può modificare
    match /tenants/{tenantId}/terreni/{terrenoId} {
      allow read: if belongsToTenant(tenantId);
      allow create, update, delete: if belongsToTenant(tenantId) && 
                                      (hasRole('manager') || hasRole('amministratore'));
    }
    
    // LAVORI: Manager crea, Caposquadra aggiorna solo progressi
    match /tenants/{tenantId}/lavori/{lavoroId} {
      allow read: if belongsToTenant(tenantId);
      allow create: if belongsToTenant(tenantId) && 
                     (hasRole('manager') || hasRole('amministratore'));
      allow update: if belongsToTenant(tenantId) && 
                     (hasRole('manager') || hasRole('amministratore') || 
                      (hasRole('caposquadra') && resource.data.caposquadraId == request.auth.uid));
      
      // Zone lavorate: Caposquadra può aggiungere
      match /zoneLavorate/{zonaId} {
        allow read: if belongsToTenant(tenantId);
        allow create: if belongsToTenant(tenantId) && 
                       hasRole('caposquadra') && 
                       get(/databases/$(database)/documents/tenants/$(tenantId)/lavori/$(lavoroId)).data.caposquadraId == request.auth.uid;
      }
    }
    
    // ORE: Operaio crea, Caposquadra valida
    match /tenants/{tenantId}/ore/{oraId} {
      allow read: if belongsToTenant(tenantId);
      allow create: if belongsToTenant(tenantId) && 
                     request.auth.uid == resource.data.operaioId;
      allow update: if belongsToTenant(tenantId) && 
                     (hasRole('caposquadra') || hasRole('manager') || hasRole('amministratore'));
    }
  }
}
```

### Livello 2: Controlli Permessi nei Servizi (Logica Applicativa)

**Obiettivo**: Controlli granulari e validazioni business logic.

**Approccio**: Ogni servizio verifica permessi PRIMA di ogni operazione.

**Esempio: Terreni Service**:

```javascript
// ✅ CORRETTO: Verifica permessi prima di modificare
export async function updateTerreno(terrenoId, updates) {
  // 1. Verifica permessi
  const user = getCurrentUserData();
  if (!canManageTerreni(user)) {
    throw new Error('Non hai i permessi per modificare terreni');
  }
  
  // 2. Carica terreno esistente
  const terreno = await getTerreno(terrenoId);
  
  // 3. Aggiorna e salva
  await updateDocument('terreni', terrenoId, updates);
}

// ✅ CORRETTO: Caposquadra può solo leggere terreno
export async function getTerreno(terrenoId) {
  // Nessun controllo permessi per lettura (tutti possono leggere)
  return await getDocumentData('terreni', terrenoId);
}
```

**Esempio: Lavori Service**:

```javascript
// ✅ CORRETTO: Caposquadra può aggiungere zone lavorate ma non modificare lavoro base
export async function aggiungiZonaLavorata(lavoroId, zonaData) {
  const user = getCurrentUserData();
  
  // 1. Verifica che sia caposquadra
  if (!hasRole(user, 'caposquadra')) {
    throw new Error('Solo caposquadra può tracciare zone lavorate');
  }
  
  // 2. Verifica che lavoro sia assegnato a lui
  const lavoro = await getLavoro(lavoroId);
  if (lavoro.caposquadraId !== user.id) {
    throw new Error('Lavoro non assegnato a te');
  }
  
  // 3. Aggiungi zona (sub-collection)
  await createDocument(`lavori/${lavoroId}/zoneLavorate`, zonaData);
  
  // 4. Aggiorna calcoli automatici (solo campi derivati)
  await aggiornaProgressiLavoro(lavoroId);
}

// ✅ CORRETTO: Caposquadra NON può modificare dati base lavoro
export async function updateLavoro(lavoroId, updates) {
  const user = getCurrentUserData();
  
  // Verifica permessi
  if (hasRole(user, 'caposquadra')) {
    // Caposquadra può modificare SOLO certi campi
    const allowedFields = ['note', 'stato']; // Solo questi campi
    const updatesFiltered = Object.keys(updates)
      .filter(key => allowedFields.includes(key))
      .reduce((obj, key) => {
        obj[key] = updates[key];
        return obj;
      }, {});
    
    if (Object.keys(updatesFiltered).length === 0) {
      throw new Error('Non hai i permessi per modificare questi campi');
    }
    
    updates = updatesFiltered;
  }
  
  await updateDocument('lavori', lavoroId, updates);
}
```

---

## 📊 Separazione Dati: Esempio Pratico Terreno

### Dati Base Terreno (Solo Manager Modifica)

**Collection**: `tenants/{tenantId}/terreni/{terrenoId}`

**Campi modificabili solo da Manager**:
- `nome`
- `superficie`
- `coordinate` (punto centrale)
- `polygonCoords` (confini terreno)
- `coltura`
- `note`

**Permessi**:
- **Manager**: ✅ Crea, Modifica, Elimina
- **Caposquadra**: ❌ NON può modificare (sola lettura)
- **Operaio**: ❌ NON può modificare (sola lettura)

### Dati Operativi Lavoro (Caposquadra Modifica Progressi)

**Collection**: `tenants/{tenantId}/lavori/{lavoroId}`

**Campi base (solo Manager modifica)**:
- `nome`
- `terrenoId` (riferimento a terreno)
- `caposquadraId`
- `dataInizio`
- `durataPrevista`

**Sub-collection Zone Lavorate (Caposquadra può aggiungere)**:
- `tenants/{tenantId}/lavori/{lavoroId}/zoneLavorate/{zonaId}`
  - `data`
  - `coordinate` (poligono zona lavorata)
  - `superficieHa`
  - `note`

**Permessi**:
- **Manager**: ✅ Crea lavoro, Modifica tutto
- **Caposquadra**: ✅ Aggiunge zone lavorate, ❌ NON modifica dati base lavoro
- **Operaio**: ❌ NON può modificare (sola lettura lavori assegnati)

### Dati Derivati (Calcolati Automaticamente)

**Campi calcolati automaticamente** (non modificabili direttamente):
- `superficieTotaleLavorata` (somma zone lavorate)
- `superficieRimanente` (totale terreno - totale lavorata)
- `percentualeCompletamento` (totale lavorata / totale terreno * 100)
- `giorniEffettivi` (giorni passati dall'inizio)
- `statoProgresso` ("in_anticipo" | "in_tempo" | "in_ritardo")

**Chi calcola**: Funzione automatica quando caposquadra aggiunge zona lavorata

---

## 🔄 Flusso Completo: Esempio Pratico

### Scenario: "Potatura Campo A"

**1. Manager crea terreno** (Dati Base):
```
tenants/tenant-123/terreni/terreno-456
{
  nome: "Campo A",
  superficie: 5.0,
  polygonCoords: [...],  // Confini terreno
  coltura: "Vite"
}
```
**Permessi**: Solo Manager può creare/modificare questo documento

**2. Manager crea lavoro** (Dati Operativi):
```
tenants/tenant-123/lavori/lavoro-789
{
  nome: "Potatura Campo A",
  terrenoId: "terreno-456",  // Riferimento (sola lettura)
  caposquadraId: "user-caposquadra-001",
  dataInizio: "2025-01-13",
  durataPrevista: 3
}
```
**Permessi**: Solo Manager può creare questo documento

**3. Caposquadra traccia zona lavorata** (Dati Operativi - Sub-collection):
```
tenants/tenant-123/lavori/lavoro-789/zoneLavorate/zona-001
{
  data: "2025-01-13",
  caposquadraId: "user-caposquadra-001",
  coordinate: [...],  // Poligono zona lavorata
  superficieHa: 1.5,
  note: "Zona nord-est"
}
```
**Permessi**: Caposquadra può aggiungere, NON può modificare terreno base

**4. Sistema calcola automaticamente** (Dati Derivati):
```
tenants/tenant-123/lavori/lavoro-789
{
  ... (dati esistenti)
  superficieTotaleLavorata: 1.5,  // Calcolato automaticamente
  superficieRimanente: 3.5,        // Calcolato automaticamente
  percentualeCompletamento: 30,    // Calcolato automaticamente
  giorniEffettivi: 1,              // Calcolato automaticamente
  statoProgresso: "in_tempo"      // Calcolato automaticamente
}
```
**Permessi**: Nessuno può modificare direttamente (calcolati automaticamente)

**5. Manager vede progressi** (Sola Lettura):
- Manager legge `lavoro-789` e vede tutti i dati (base + derivati)
- Manager legge `terreno-456` e vede dati base terreno
- Manager NON può modificare zone lavorate (sono del caposquadra)

---

## 🛡️ Controlli Permessi nei Servizi

### Pattern da Seguire

**1. Verifica permessi PRIMA di ogni operazione**:

```javascript
// ✅ CORRETTO
export async function updateTerreno(terrenoId, updates) {
  // Verifica permessi PRIMA
  if (!canManageTerreni(getCurrentUserData())) {
    throw new Error('Permessi insufficienti');
  }
  
  // Poi esegui operazione
  await updateDocument('terreni', terrenoId, updates);
}
```

**2. Filtra campi modificabili in base al ruolo**:

```javascript
// ✅ CORRETTO: Caposquadra può modificare solo certi campi
export async function updateLavoro(lavoroId, updates) {
  const user = getCurrentUserData();
  
  if (hasRole(user, 'caposquadra')) {
    // Filtra solo campi permessi
    const allowedFields = ['note', 'stato'];
    updates = filterFields(updates, allowedFields);
  }
  
  await updateDocument('lavori', lavoroId, updates);
}
```

**3. Verifica proprietà prima di modificare**:

```javascript
// ✅ CORRETTO: Caposquadra può modificare solo suoi lavori
export async function aggiungiZonaLavorata(lavoroId, zonaData) {
  const user = getCurrentUserData();
  
  // Verifica ruolo
  if (!hasRole(user, 'caposquadra')) {
    throw new Error('Solo caposquadra può tracciare zone');
  }
  
  // Verifica proprietà lavoro
  const lavoro = await getLavoro(lavoroId);
  if (lavoro.caposquadraId !== user.id) {
    throw new Error('Lavoro non assegnato a te');
  }
  
  // Poi aggiungi zona
  await createDocument(`lavori/${lavoroId}/zoneLavorate`, zonaData);
}
```

---

## 🔒 Gestione Accesso Simultaneo

### Problema: Modifiche Concorrenti

**Scenario**: Manager modifica terreno mentre Caposquadra traccia zona lavorata.

### Soluzione: Separazione Dati

**Approccio**: Separare completamente i dati modificabili:

1. **Terreno base**: Solo Manager modifica
2. **Zone lavorate**: Solo Caposquadra aggiunge (sub-collection separata)
3. **Calcoli derivati**: Nessuno modifica direttamente (calcolati automaticamente)

**Vantaggi**:
- Nessun conflitto: modificano documenti diversi
- Firestore gestisce automaticamente concorrenza per documento
- Sub-collections sono isolate

### Esempio Pratico

**Manager modifica terreno**:
- Modifica: `tenants/tenant-123/terreni/terreno-456`
- Nessun conflitto con zone lavorate (documenti diversi)

**Caposquadra traccia zona**:
- Aggiunge: `tenants/tenant-123/lavori/lavoro-789/zoneLavorate/zona-001`
- Nessun conflitto con terreno base (documenti diversi)

**Sistema calcola progressi**:
- Aggiorna: `tenants/tenant-123/lavori/lavoro-789` (campi derivati)
- Nessun conflitto: calcola automaticamente quando caposquadra aggiunge zona

---

## 📋 Matrice Permessi Completa

### Terreni

| Operazione | Manager | Caposquadra | Operaio |
|------------|---------|-------------|---------|
| **Leggere terreno** | ✅ | ✅ | ✅ (solo suoi lavori) |
| **Creare terreno** | ✅ | ❌ | ❌ |
| **Modificare terreno** | ✅ | ❌ | ❌ |
| **Eliminare terreno** | ✅ | ❌ | ❌ |
| **Modificare confini terreno** | ✅ | ❌ | ❌ |

### Lavori

| Operazione | Manager | Caposquadra | Operaio |
|------------|---------|-------------|---------|
| **Leggere tutti i lavori** | ✅ | ❌ | ❌ |
| **Leggere lavori assegnati** | ✅ | ✅ (solo suoi) | ❌ |
| **Leggere lavori di oggi** | ✅ | ✅ | ✅ (solo suoi) |
| **Creare lavoro** | ✅ | ❌ | ❌ |
| **Assegnare lavoro** | ✅ | ❌ | ❌ |
| **Modificare dati base lavoro** | ✅ | ❌ | ❌ |
| **Aggiungere zona lavorata** | ✅ | ✅ (solo suoi lavori) | ❌ |
| **Vedere progressi lavoro** | ✅ | ✅ (solo suoi lavori) | ❌ |

### Zone Lavorate

| Operazione | Manager | Caposquadra | Operaio |
|------------|---------|-------------|---------|
| **Leggere zone lavorate** | ✅ | ✅ (solo suoi lavori) | ❌ |
| **Aggiungere zona lavorata** | ✅ | ✅ (solo suoi lavori) | ❌ |
| **Modificare zona lavorata** | ✅ | ✅ (solo sue zone) | ❌ |
| **Eliminare zona lavorata** | ✅ | ✅ (solo sue zone) | ❌ |

### Ore

| Operazione | Manager | Caposquadra | Operaio |
|------------|---------|-------------|---------|
| **Leggere tutte le ore** | ✅ | ❌ | ❌ |
| **Leggere ore squadra** | ✅ | ✅ (sua squadra) | ❌ |
| **Leggere proprie ore** | ✅ | ✅ | ✅ |
| **Segnare ore** | ✅ | ✅ | ✅ (solo proprie) |
| **Validare ore** | ✅ | ✅ (sua squadra) | ❌ |
| **Rifiutare ore** | ✅ | ✅ (sua squadra) | ❌ |

---

## 🎯 Principi Architetturali

### 1. Separazione Responsabilità

**Dati Base** (Master Data):
- Modificati solo da ruoli specifici
- Struttura stabile
- Esempi: Terreni, Clienti, Squadre

**Dati Operativi** (Transactional Data):
- Modificati durante operazioni
- Permessi granulari per ruolo
- Esempi: Lavori, Ore, Zone Lavorate

**Dati Derivati** (Computed Data):
- Calcolati automaticamente
- Non modificabili direttamente
- Esempi: Progressi, Statistiche, Percentuali

### 2. Controlli a Due Livelli

**Livello 1 - Firestore Rules**:
- Sicurezza base
- Impedisce accessi non autorizzati
- Filtri tenant automatici

**Livello 2 - Servizi Applicativi**:
- Controlli granulari
- Validazioni business logic
- Filtri campi modificabili

### 3. Isolamento per Proprietà

**Sub-collections per dati operativi**:
- Zone lavorate: `lavori/{lavoroId}/zoneLavorate/`
- Evita conflitti con dati base
- Permessi specifici per sub-collection

### 4. Calcoli Automatici

**Funzioni di aggiornamento automatico**:
- Trigger quando dati operativi cambiano
- Aggiornano dati derivati
- Nessun intervento manuale necessario

---

## ✅ Vantaggi Approccio

1. **Sicurezza**: Doppio livello di controllo (Rules + Servizi)
2. **Chiarezza**: Separazione logica dati base/operativi/derivati
3. **Scalabilità**: Facile aggiungere nuovi ruoli/permessi
4. **Manutenibilità**: Codice organizzato e comprensibile
5. **Performance**: Query ottimizzate per ruolo
6. **Concorrenza**: Nessun conflitto tra modifiche simultanee

---

## 🚀 Prossimi Passi

1. **Implementare Firestore Rules** con permessi granulari
2. **Aggiornare servizi** con controlli permessi
3. **Creare funzioni calcolo automatico** per dati derivati
4. **Testare permessi** per ogni ruolo e operazione
5. **Documentare** permessi per sviluppatori

---

---

## 👥 Gestione Multiple Squadre Contemporanee

### Scenario: Azienda con Più Squadre

**Esempio pratico**:
- **Azienda Grande**: 3 squadre, 3 caposquadra, 20 operai totali
- **Squadra A**: Caposquadra Paolo, 8 operai
- **Squadra B**: Caposquadra Marco, 7 operai  
- **Squadra C**: Caposquadra Luca, 5 operai

**Domanda**: Può essere un problema gestire più squadre contemporanee?

**Risposta**: **NO, non è un problema**. L'architettura è già progettata per supportare multiple squadre.

---

## 🏗️ Come Funziona con Multiple Squadre

### Struttura Dati Supporta Multiple Squadre

**Collection Squadre**:
```
tenants/{tenantId}/squadre/
├── squadra-001/          # Squadra A
│   ├── nome: "Squadra Nord"
│   ├── caposquadraId: "user-paolo-001"
│   └── operai: ["user-operaio-1", "user-operaio-2", ...]
│
├── squadra-002/          # Squadra B
│   ├── nome: "Squadra Sud"
│   ├── caposquadraId: "user-marco-002"
│   └── operai: ["user-operaio-9", "user-operaio-10", ...]
│
└── squadra-003/          # Squadra C
    ├── nome: "Squadra Est"
    ├── caposquadraId: "user-luca-003"
    └── operai: ["user-operaio-16", "user-operaio-17", ...]
```

**Ogni squadra è isolata**:
- Documento separato per ogni squadra
- Nessun conflitto tra squadre
- Scalabile a qualsiasi numero di squadre

### Isolamento Dati per Caposquadra

**Filtri Automatici**:

**Caposquadra Paolo** vede solo:
- Squadra A (dove è caposquadra)
- Lavori assegnati a lui (`caposquadraId == "user-paolo-001"`)
- Ore degli operai della sua squadra
- Zone lavorate dei suoi lavori

**Caposquadra Marco** vede solo:
- Squadra B (dove è caposquadra)
- Lavori assegnati a lui (`caposquadraId == "user-marco-002"`)
- Ore degli operai della sua squadra
- Zone lavorate dei suoi lavori

**Nessun conflitto**: Ogni caposquadra vede solo i suoi dati, filtrati automaticamente.

### Lavori Assegnati a Squadre Diverse

**Esempio**: Manager assegna 3 lavori contemporanei

```
tenants/{tenantId}/lavori/
├── lavoro-001/
│   ├── nome: "Potatura Campo Nord"
│   ├── caposquadraId: "user-paolo-001"  # Squadra A
│   └── zoneLavorate/...
│
├── lavoro-002/
│   ├── nome: "Potatura Campo Sud"
│   ├── caposquadraId: "user-marco-002"  # Squadra B
│   └── zoneLavorate/...
│
└── lavoro-003/
    ├── nome: "Potatura Campo Est"
    ├── caposquadraId: "user-luca-003"   # Squadra C
    └── zoneLavorate/...
```

**Isolamento**:
- Ogni lavoro ha un `caposquadraId` diverso
- Caposquadra vede solo lavori con il suo ID
- Nessun conflitto: lavori separati, zone lavorate separate

### Ore degli Operai

**Filtri per Squadra**:

**Caposquadra Paolo** vede solo:
- Ore degli operai della Squadra A
- Query: `ore` dove `operaioId IN squadra-001.operai`

**Caposquadra Marco** vede solo:
- Ore degli operai della Squadra B
- Query: `ore` dove `operaioId IN squadra-002.operai`

**Nessun conflitto**: Ogni caposquadra valida solo ore della sua squadra.

---

## 🔒 Permessi e Isolamento

### Caposquadra: Vede Solo Sua Squadra

**Controlli Permessi**:

1. **Vedere Squadra**:
   - Query: `squadre` dove `caposquadraId == currentUserId`
   - Risultato: Solo la sua squadra

2. **Vedere Lavori**:
   - Query: `lavori` dove `caposquadraId == currentUserId`
   - Risultato: Solo lavori assegnati a lui

3. **Vedere Operai**:
   - Query: `users` dove `id IN squadra.operai`
   - Risultato: Solo operai della sua squadra

4. **Validare Ore**:
   - Query: `ore` dove `operaioId IN squadra.operai`
   - Risultato: Solo ore degli operai della sua squadra

5. **Tracciare Zone**:
   - Query: `lavori` dove `caposquadraId == currentUserId`
   - Risultato: Solo può tracciare zone per suoi lavori

**Isolamento Garantito**: Ogni caposquadra vede solo i suoi dati.

### Manager: Vede Tutte le Squadre

**Controlli Permessi**:

1. **Vedere Tutte le Squadre**:
   - Query: `squadre` (tutte)
   - Risultato: Tutte le squadre dell'azienda

2. **Vedere Tutti i Lavori**:
   - Query: `lavori` (tutti)
   - Risultato: Tutti i lavori di tutte le squadre

3. **Assegnare Lavori**:
   - Può assegnare a qualsiasi caposquadra
   - Vede tutte le squadre disponibili

4. **Monitorare Progressi**:
   - Vede progressi di tutti i lavori
   - Vede zone lavorate di tutte le squadre
   - Vede statistiche aggregate

**Visione Completa**: Manager ha accesso a tutto per coordinare.

---

## 📊 Esempio Pratico: 3 Squadre Lavorano Contemporaneamente

### Scenario

**Azienda**: 3 squadre, lavori simultanei su terreni diversi

**Squadra A (Paolo)**:
- Lavoro: "Potatura Campo Nord"
- Terreno: Campo Nord (5 ha)
- Operai: 8 operai
- Traccia zone lavorate ogni giorno

**Squadra B (Marco)**:
- Lavoro: "Potatura Campo Sud"
- Terreno: Campo Sud (4 ha)
- Operai: 7 operai
- Traccia zone lavorate ogni giorno

**Squadra C (Luca)**:
- Lavoro: "Potatura Campo Est"
- Terreno: Campo Est (3 ha)
- Operai: 5 operai
- Traccia zone lavorate ogni giorno

### Dati in Firestore

**Squadre** (3 documenti separati):
```
squadre/squadra-001 → Caposquadra Paolo
squadre/squadra-002 → Caposquadra Marco
squadre/squadra-003 → Caposquadra Luca
```

**Lavori** (3 documenti separati):
```
lavori/lavoro-001 → caposquadraId: "user-paolo-001"
lavori/lavoro-002 → caposquadraId: "user-marco-002"
lavori/lavoro-003 → caposquadraId: "user-luca-003"
```

**Zone Lavorate** (sub-collections separate):
```
lavori/lavoro-001/zoneLavorate/ → Solo Paolo può aggiungere
lavori/lavoro-002/zoneLavorate/ → Solo Marco può aggiungere
lavori/lavoro-003/zoneLavorate/ → Solo Luca può aggiungere
```

**Ore** (filtrate per squadra):
```
ore/ → Filtrate per operaioId IN squadra.operai
```

### Nessun Conflitto Perché:

1. **Documenti Separati**: Ogni squadra/lavoro è un documento diverso
2. **Sub-collections Isolate**: Zone lavorate in sub-collections separate
3. **Filtri Automatici**: Query filtrate per `caposquadraId` o `squadraId`
4. **Permessi Granulari**: Ogni caposquadra può modificare solo suoi dati

---

## 🎯 Scalabilità: Aziende Grandi

### Supporto per Aziende di Qualsiasi Dimensione

**Piccola Azienda** (1 squadra):
- 1 caposquadra, 5 operai
- Funziona perfettamente

**Media Azienda** (3-5 squadre):
- 3-5 caposquadra, 20-30 operai
- Funziona perfettamente

**Grande Azienda** (10+ squadre):
- 10+ caposquadra, 50+ operai
- Funziona perfettamente (stessa architettura)

**Vantaggi Architettura**:
- **Scalabile**: Nessun limite teorico al numero di squadre
- **Performante**: Query filtrate per squadra (non carica tutto)
- **Isolato**: Ogni squadra è indipendente
- **Flessibile**: Facile aggiungere/rimuovere squadre

---

## ⚠️ Considerazioni Importanti

### 1. Un Operaio può Appartenere a Una Squadra Alla Volta?

**Domanda**: Un operaio può essere in più squadre contemporaneamente?

**Risposta**: Dipende dalla logica business.

**Opzione A - Una Squadra Alla Volta** (Consigliato):
- Operaio appartiene a una sola squadra
- Più semplice da gestire
- Evita confusione
- Struttura: `squadre/{squadraId}/operai: [array di user IDs]`

**Opzione B - Più Squadre Contemporaneamente**:
- Operaio può essere in più squadre
- Più flessibile ma più complesso
- Richiede logica aggiuntiva per determinare quale squadra per quale lavoro
- Struttura: `users/{userId}/squadre: [array di squadra IDs]`

**Raccomandazione**: Opzione A (una squadra alla volta) per semplicità.

### 2. Caposquadra può Essere in Più Squadre?

**Domanda**: Un caposquadra può gestire più squadre?

**Risposta**: Tecnicamente sì, ma sconsigliato.

**Se Caposquadra gestisce più squadre**:
- Può vedere lavori di tutte le sue squadre
- Query: `lavori` dove `caposquadraId == currentUserId` (funziona comunque)
- Nessun problema tecnico

**Ma**:
- Più complesso da gestire
- Confusione per caposquadra
- Meglio avere un caposquadra per squadra

**Raccomandazione**: Un caposquadra = una squadra (più chiaro).

### 3. Manager Assegna Lavori a Squadre Diverse

**Domanda**: Come fa il Manager a scegliere quale squadra assegnare?

**Risposta**: Manager vede tutte le squadre disponibili.

**Flusso**:
1. Manager crea lavoro
2. Manager vede lista squadre disponibili
3. Manager seleziona caposquadra (che identifica la squadra)
4. Sistema assegna lavoro a quella squadra
5. Caposquadra vede lavoro nella sua lista

**Nessun problema**: Manager ha visione completa, può assegnare a qualsiasi squadra.

### 4. Operai Possono Essere Spostati tra Squadre?

**Domanda**: Cosa succede se un operaio viene spostato da una squadra all'altra?

**Risposta**: Gestibile facilmente.

**Flusso**:
1. Manager modifica squadra: rimuove operaio da Squadra A, aggiunge a Squadra B
2. Operaio vede nuovi lavori della Squadra B
3. Ore vecchie rimangono associate alla Squadra A (storico)
4. Ore nuove associate alla Squadra B

**Nessun problema**: Dati storici preservati, nuovi dati associati alla nuova squadra.

---

## ✅ Conclusione: Multiple Squadre NON Sono un Problema

### Perché Funziona:

1. **Architettura Scalabile**: 
   - Ogni squadra è un documento separato
   - Nessun limite al numero di squadre

2. **Isolamento Dati**:
   - Ogni caposquadra vede solo sua squadra
   - Filtri automatici per `caposquadraId` e `squadraId`

3. **Nessun Conflitto**:
   - Documenti separati per ogni squadra/lavoro
   - Sub-collections isolate per zone lavorate
   - Modifiche simultanee su documenti diversi

4. **Permessi Granulari**:
   - Caposquadra: vede solo sua squadra
   - Manager: vede tutte le squadre
   - Operaio: vede solo suoi lavori

5. **Performance**:
   - Query filtrate (non carica tutto)
   - Indici Firestore per query efficienti
   - Scalabile a centinaia di squadre

### Raccomandazioni:

1. **Una squadra = un caposquadra** (più chiaro)
2. **Un operaio = una squadra alla volta** (più semplice)
3. **Manager gestisce assegnazioni** (visione completa)
4. **Dati storici preservati** (quando operai cambiano squadra)

---

**Ultimo aggiornamento**: 2025-01-13  
**Stato**: Architettura definita, pronta per implementazione, supporta multiple squadre senza problemi

