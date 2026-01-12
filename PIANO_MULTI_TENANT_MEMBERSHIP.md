# 🏢 Piano Implementazione Multi-Tenant Membership

**Data creazione**: 2026-01-04  
**Versione**: 1.0  
**Stato**: Piano di implementazione  
**Obiettivo**: Permettere a un utente di appartenere a più tenant con ruoli diversi

---

## 📋 Indice

1. [Problema da Risolvere](#problema-da-risolvere)
2. [Soluzione Proposta](#soluzione-proposta)
3. [Architettura Dati](#architettura-dati)
4. [Piano di Implementazione](#piano-di-implementazione)
5. [Dettaglio Modifiche](#dettaglio-modifiche)
6. [Rischi e Mitigazioni](#rischi-e-mitigazioni)
7. [Testing](#testing)
8. [Migrazione Dati](#migrazione-dati)
9. [Checklist Implementazione](#checklist-implementazione)

---

## 🎯 Problema da Risolvere

### Scenario
Un utente (es. Mario Rossi) può essere:
- **Amministratore** della sua azienda (tenant A)
- **Caposquadra** in un'altra azienda che usa l'app (tenant B)

### Limite Attuale
- Firebase Authentication: **un solo account per email** (limite di Firebase)
- Modello dati: ogni utente ha **un solo `tenantId`** nel documento `users/{userId}`
- Al login: il sistema carica **un solo tenant** da `userData.tenantId`

### Conseguenza
**Non è possibile** invitare un utente esistente a un nuovo tenant perché:
1. L'email è già registrata in Firebase Auth
2. Il sistema non supporta membership multiple

---

## 💡 Soluzione Proposta

### Concetto Chiave
**Separare autenticazione da membership tenant**: un utente si autentica una volta, ma può essere membro di più tenant con ruoli diversi per ciascuno.

### Struttura Dati Proposta

#### Documento `users/{userId}` - PRIMA
```javascript
{
  id: "user123",
  email: "mario.rossi@example.com",
  nome: "Mario",
  cognome: "Rossi",
  tenantId: "tenant-a",  // ❌ Solo uno
  ruoli: ["amministratore"],
  stato: "attivo"
}
```

#### Documento `users/{userId}` - DOPO
```javascript
{
  id: "user123",
  email: "mario.rossi@example.com",
  nome: "Mario",
  cognome: "Rossi",
  
  // ✅ NUOVO: Membership multiple
  tenantMemberships: {
    "tenant-a": {
      ruoli: ["amministratore"],
      stato: "attivo",
      dataInizio: Timestamp,
      creatoDa: "user123",
      tenantIdPredefinito: true  // Tenant principale
    },
    "tenant-b": {
      ruoli: ["caposquadra"],
      stato: "attivo",
      dataInizio: Timestamp,
      creatoDa: "manager-tenant-b"
    }
  },
  
  // ⚠️ MANTENUTO per retrocompatibilità (deprecato)
  tenantId: "tenant-a",  // Tenant predefinito
  
  // ⚠️ MANTENUTO per retrocompatibilità (deprecato)
  ruoli: ["amministratore"],  // Ruoli del tenant predefinito
  
  stato: "attivo"
}
```

### Flusso Utente

1. **Login**: 
   - Utente si autentica con email/password
   - Sistema carica `userData.tenantMemberships`
   - Se **un solo tenant**: login diretto
   - Se **più tenant**: mostra selettore tenant

2. **Selezione Tenant**:
   - Utente seleziona tenant dalla lista
   - Sistema salva `currentTenantId` in `sessionStorage`
   - Redirect a dashboard

3. **Durante Sessione**:
   - Tutti i servizi usano `getCurrentTenantId()` da `sessionStorage`
   - I dati vengono filtrati per il tenant selezionato

4. **Switch Tenant**:
   - Utente può cambiare tenant dalla dashboard
   - Sistema aggiorna `sessionStorage`
   - Ricarica dati per nuovo tenant

---

## 🏗️ Architettura Dati

### Struttura Firestore

```
users/{userId}
├── email
├── nome
├── cognome
├── tenantMemberships (NUOVO)
│   ├── {tenantId1}
│   │   ├── ruoli: ["amministratore"]
│   │   ├── stato: "attivo"
│   │   ├── dataInizio: Timestamp
│   │   ├── creatoDa: userId
│   │   └── tenantIdPredefinito: true
│   └── {tenantId2}
│       ├── ruoli: ["caposquadra"]
│       ├── stato: "attivo"
│       ├── dataInizio: Timestamp
│       └── creatoDa: userId
├── tenantId (DEPRECATO - retrocompatibilità)
├── ruoli (DEPRECATO - retrocompatibilità)
└── stato
```

### Helper Functions Necessarie

```javascript
// Ottieni tutti i tenant di un utente
function getUserTenants(userId) {
  // Restituisce array di { tenantId, ruoli, stato, ... }
}

// Ottieni ruoli utente per un tenant specifico
function getUserRolesForTenant(userId, tenantId) {
  // Restituisce array di ruoli per quel tenant
}

// Verifica se utente appartiene a un tenant
function userBelongsToTenant(userId, tenantId) {
  // Restituisce boolean
}

// Ottieni tenant predefinito
function getDefaultTenant(userId) {
  // Restituisce tenantId del tenant predefinito
}
```

---

## 📅 Piano di Implementazione

### Fase 1: Preparazione (2-3 giorni) - ⚠️ BASSO RISCHIO

**Obiettivo**: Preparare l'infrastruttura senza rompere nulla

#### 1.1 Modificare Modello User
- **File**: `core/models/User.js`
- **Modifiche**:
  - Aggiungere campo `tenantMemberships` (oggetto)
  - Mantenere `tenantId` e `ruoli` per retrocompatibilità
  - Aggiungere metodi helper:
    - `getTenantMemberships()`
    - `getRolesForTenant(tenantId)`
    - `belongsToTenant(tenantId)`
    - `getDefaultTenant()`
    - `addTenantMembership(tenantId, membershipData)`
    - `removeTenantMembership(tenantId)`

#### 1.2 Creare Script Migrazione Dati
- **File**: `scripts/migrate-user-tenant-memberships.js`
- **Funzione**: Convertire `tenantId` esistente in `tenantMemberships`
- **Logica**:
  ```javascript
  // Per ogni utente con tenantId ma senza tenantMemberships:
  // 1. Crea tenantMemberships[tenantId] con dati da tenantId e ruoli
  // 2. Imposta tenantIdPredefinito: true
  // 3. Mantieni tenantId e ruoli per retrocompatibilità
  ```

#### 1.3 Aggiornare Type Definitions (se presenti)
- Documentare nuova struttura in commenti JSDoc

---

### Fase 2: Core Services (2-3 giorni) - ⚠️ MEDIO RISCHIO

**Obiettivo**: Aggiornare servizi core per supportare multi-tenant

#### 2.1 Aggiornare Tenant Service
- **File**: `core/services/tenant-service.js`
- **Modifiche**:
  - Modificare `initializeTenantService()`:
    - Caricare `tenantMemberships` invece di `tenantId`
    - Se un solo tenant: impostare automaticamente
    - Se più tenant: richiedere selezione
  - Aggiungere funzioni:
    - `getUserTenants(userId)` - Ottieni tutti i tenant
    - `setCurrentTenant(tenantId)` - Imposta tenant corrente in sessionStorage
    - `getCurrentTenant()` - Leggi da sessionStorage
    - `switchTenant(tenantId)` - Cambia tenant durante sessione
    - `getUserRolesForTenant(userId, tenantId)` - Ruoli per tenant

#### 2.2 Aggiornare Auth Service
- **File**: `core/services/auth-service.js`
- **Modifiche**:
  - Modificare `initializeAuthService()`:
    - Caricare `tenantMemberships` invece di `tenantId`
    - Gestire caso multi-tenant
  - Modificare `signIn()`:
    - Dopo login, verificare numero di tenant
    - Se più di uno, non impostare automaticamente `currentTenantId`
  - Aggiungere funzione:
    - `getUserTenants()` - Lista tenant disponibili

#### 2.3 Creare Tenant Selection Service
- **File**: `core/services/tenant-selection-service.js` (NUOVO)
- **Funzioni**:
  - `showTenantSelector(tenants)` - Mostra modal selettore
  - `handleTenantSelection(tenantId)` - Gestisce selezione
  - `validateTenantAccess(userId, tenantId)` - Verifica accesso

---

### Fase 3: UI/UX (2-3 giorni) - ⚠️ BASSO RISCHIO

**Obiettivo**: Aggiungere interfaccia per selezione e switch tenant

#### 3.1 Selettore Tenant al Login
- **File**: `core/auth/login-standalone.html`
- **Modifiche**:
  - Dopo login riuscito, verificare numero di tenant
  - Se più di uno, mostrare modal con lista tenant
  - Ogni tenant mostra: nome azienda, ruoli utente
  - Al click, salva in sessionStorage e redirect

#### 3.2 Switch Tenant nella Dashboard
- **File**: `core/dashboard-standalone.html`
- **Modifiche**:
  - Aggiungere dropdown/button in header
  - Mostra tenant corrente
  - Al click, mostra lista tenant disponibili
  - Al cambio, aggiorna sessionStorage e ricarica dati

#### 3.3 Aggiornare Tutti i File Standalone
- **File**: Tutti i `*-standalone.html` (~20 file)
- **Modifiche**:
  - Verificare che usino `getCurrentTenantId()` invece di `userData.tenantId`
  - Aggiungere gestione caso `currentTenantId === null` (redirect a login)

---

### Fase 4: Security Rules (1-2 giorni) - ⚠️ ALTO RISCHIO

**Obiettivo**: Aggiornare regole Firestore per supportare multi-tenant

#### 4.1 Aggiornare Firestore Rules
- **File**: `firestore.rules`
- **Modifiche**:
  - Sostituire `belongsToTenant()`:
    ```javascript
    // PRIMA
    function belongsToTenant(tenantId) {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.tenantId == tenantId;
    }
    
    // DOPO
    function belongsToTenant(tenantId) {
      let userData = get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
      // Verifica retrocompatibilità
      if (userData.tenantId == tenantId) return true;
      // Verifica nuova struttura
      if (userData.tenantMemberships != null && 
          tenantId in userData.tenantMemberships &&
          userData.tenantMemberships[tenantId].stato == 'attivo') {
        return true;
      }
      return false;
    }
    ```
  
  - Aggiornare `hasRole()`:
    ```javascript
    // PRIMA
    function hasRole(role) {
      return role in get(/databases/$(database)/documents/users/$(request.auth.uid)).data.ruoli;
    }
    
    // DOPO
    function hasRole(role, tenantId) {
      let userData = get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
      // Usa tenantId dal path se non specificato
      if (tenantId == null) {
        tenantId = request.resource.data.tenantId; // o dal path
      }
      // Verifica retrocompatibilità
      if (userData.tenantId == tenantId && role in userData.ruoli) return true;
      // Verifica nuova struttura
      if (userData.tenantMemberships != null && 
          tenantId in userData.tenantMemberships) {
        return role in userData.tenantMemberships[tenantId].ruoli;
      }
      return false;
    }
    ```

#### 4.2 Test Security Rules
- Creare test per verificare:
  - Utente può accedere solo ai suoi tenant
  - Utente ha ruoli corretti per ogni tenant
  - Isolamento dati tra tenant

---

### Fase 5: Invito Cross-Tenant (1-2 giorni) - ⚠️ MEDIO RISCHIO

**Obiettivo**: Permettere invito utenti esistenti a nuovi tenant

#### 5.1 Aggiornare Invito Service
- **File**: `core/services/invito-service-standalone.js`
- **Modifiche**:
  - Modificare `createInvite()`:
    - Verificare se email esiste già in Firebase Auth
    - Se esiste: creare invito per aggiungere tenant membership
    - Se non esiste: creare invito normale (nuovo account)
  
  - Modificare `acceptInvite()`:
    - Se utente esiste già:
      - Non creare nuovo account Firebase Auth
      - Aggiungere `tenantMemberships[tenantId]` al documento esistente
    - Se utente non esiste:
      - Creare account normalmente

#### 5.2 Aggiornare Registrazione Invito
- **File**: `core/auth/registrazione-invito-standalone.html`
- **Modifiche**:
  - Verificare se utente esiste già
  - Se esiste: aggiungere membership invece di creare account
  - Mostrare messaggio appropriato

#### 5.3 Aggiornare Gestione Utenti
- **File**: `core/admin/gestisci-utenti-standalone.html`
- **Modifiche**:
  - Quando si invita utente, verificare esistenza
  - Se esiste, mostrare messaggio: "Utente esistente, verrà aggiunto al tenant"
  - Se non esiste, procedere normalmente

---

### Fase 6: Testing Completo (2-3 giorni) - ⚠️ CRITICO

**Obiettivo**: Verificare che tutto funzioni correttamente

#### 6.1 Test Scenari
1. **Utente con un solo tenant** (retrocompatibilità)
   - Login deve funzionare normalmente
   - Nessun selettore deve apparire

2. **Utente con più tenant**
   - Login mostra selettore
   - Selezione tenant funziona
   - Switch tenant funziona
   - Dati filtrati correttamente

3. **Invito utente esistente**
   - Invito viene creato
   - Utente accetta invito
   - Membership viene aggiunta
   - Utente può accedere a nuovo tenant

4. **Security Rules**
   - Utente non può accedere a tenant non suoi
   - Ruoli corretti per ogni tenant
   - Isolamento dati garantito

5. **Migrazione Dati**
   - Script migra utenti esistenti
   - Retrocompatibilità mantenuta
   - Nessun dato perso

#### 6.2 Test Moduli
Testare ogni modulo principale:
- ✅ Dashboard
- ✅ Terreni
- ✅ Attività
- ✅ Lavori
- ✅ Statistiche
- ✅ Segnatura Ore
- ✅ Gestione Operai
- ✅ Gestione Macchine
- ✅ Impostazioni
- ✅ Gestione Utenti

---

## 🔧 Dettaglio Modifiche

### File da Modificare

#### Core Models
- [ ] `core/models/User.js` - Aggiungere `tenantMemberships`

#### Core Services
- [ ] `core/services/tenant-service.js` - Gestione multi-tenant
- [ ] `core/services/auth-service.js` - Login multi-tenant
- [ ] `core/services/invito-service-standalone.js` - Invito cross-tenant
- [ ] `core/services/tenant-selection-service.js` - NUOVO: Selettore tenant

#### Core Auth
- [ ] `core/auth/login-standalone.html` - Selettore tenant al login
- [ ] `core/auth/registrazione-invito-standalone.html` - Gestione utente esistente

#### Core UI
- [ ] `core/dashboard-standalone.html` - Switch tenant
- [ ] `core/dashboard-standalone.html` - Verifica `currentTenantId`

#### Admin
- [ ] `core/admin/gestisci-utenti-standalone.html` - Invito cross-tenant
- [ ] Tutti i `*-standalone.html` - Verifica uso `getCurrentTenantId()`

#### Security
- [ ] `firestore.rules` - Aggiornare `belongsToTenant()` e `hasRole()`

#### Scripts
- [ ] `scripts/migrate-user-tenant-memberships.js` - NUOVO: Script migrazione

---

## ⚠️ Rischi e Mitigazioni

### 🔴 Rischi ALTI

#### 1. Security Rules Non Aggiornate
**Problema**: Se le security rules non vengono aggiornate, gli utenti non potranno accedere ai dati.

**Mitigazione**:
- Testare security rules PRIMA di deployare codice
- Usare Firebase Emulator per test
- Deployare security rules e codice insieme
- Verificare manualmente accesso dopo deploy

**Checklist**:
- [ ] Test security rules in emulator
- [ ] Verifica accesso utente multi-tenant
- [ ] Verifica isolamento dati tra tenant
- [ ] Test retrocompatibilità utenti esistenti

#### 2. Migrazione Dati Fallita
**Problema**: Se la migrazione fallisce, utenti esistenti potrebbero non funzionare.

**Mitigazione**:
- Creare backup Firestore PRIMA di migrazione
- Testare script su database di test
- Eseguire migrazione in modalità "dry-run" prima
- Avere rollback plan

**Checklist**:
- [ ] Backup Firestore completo
- [ ] Test script su database test
- [ ] Dry-run migrazione
- [ ] Verifica dati dopo migrazione
- [ ] Plan rollback se necessario

### 🟡 Rischi MEDI

#### 3. SessionStorage Perso
**Problema**: Se sessionStorage viene perso, utente deve selezionare tenant di nuovo.

**Mitigazione**:
- Usare anche localStorage come fallback
- Salvare tenant predefinito in localStorage
- Gestire gracefully: se perso, mostrare selettore

**Checklist**:
- [ ] Implementare fallback localStorage
- [ ] Salvare tenant predefinito
- [ ] Gestire caso sessionStorage vuoto

#### 4. Retrocompatibilità Rotta
**Problema**: Codice che legge ancora `userData.tenantId` direttamente.

**Mitigazione**:
- Mantenere `tenantId` e `ruoli` per retrocompatibilità
- Aggiornare tutti i punti che leggono direttamente
- Usare `getCurrentTenantId()` ovunque

**Checklist**:
- [ ] Cercare tutti i riferimenti a `userData.tenantId`
- [ ] Sostituire con `getCurrentTenantId()`
- [ ] Verificare retrocompatibilità

### 🟢 Rischi BASSI

#### 5. Performance Query
**Problema**: Query aggiuntive per membership potrebbero rallentare login.

**Mitigazione**:
- Cache membership in memoria
- Query solo al login
- Usare indici Firestore se necessario

**Checklist**:
- [ ] Misurare tempo login
- [ ] Cache membership
- [ ] Verificare indici Firestore

---

## 🧪 Testing

### Test Manuali

#### Test 1: Utente Singolo Tenant (Retrocompatibilità)
1. Login con utente esistente (un solo tenant)
2. ✅ Verifica: Login diretto, nessun selettore
3. ✅ Verifica: Dashboard carica correttamente
4. ✅ Verifica: Tutti i moduli funzionano

#### Test 2: Utente Multi-Tenant
1. Creare utente con 2 tenant
2. Login
3. ✅ Verifica: Selettore tenant appare
4. Selezionare tenant A
5. ✅ Verifica: Dashboard mostra dati tenant A
6. Switch a tenant B
7. ✅ Verifica: Dashboard mostra dati tenant B
8. ✅ Verifica: Dati isolati correttamente

#### Test 3: Invito Cross-Tenant
1. Utente A (tenant-1) invita email esistente (tenant-2)
2. ✅ Verifica: Invito creato correttamente
3. Utente esistente accetta invito
4. ✅ Verifica: Membership aggiunta (non nuovo account)
5. Login utente esistente
6. ✅ Verifica: Selettore mostra entrambi i tenant

#### Test 4: Security Rules
1. Utente A (tenant-1) tenta accesso tenant-2 (non suo)
2. ✅ Verifica: Accesso negato
3. Utente A accede tenant-1 (suo)
4. ✅ Verifica: Accesso permesso
5. ✅ Verifica: Ruoli corretti per ogni tenant

#### Test 5: Migrazione Dati
1. Eseguire script migrazione
2. ✅ Verifica: Utenti esistenti hanno `tenantMemberships`
3. ✅ Verifica: `tenantId` e `ruoli` mantenuti
4. ✅ Verifica: Login funziona normalmente

### Test Automatici (se presenti)

```javascript
// Test: Utente multi-tenant
describe('Multi-Tenant Membership', () => {
  it('should allow user to belong to multiple tenants', async () => {
    // Test implementation
  });
  
  it('should filter data by selected tenant', async () => {
    // Test implementation
  });
  
  it('should prevent access to non-member tenants', async () => {
    // Test implementation
  });
});
```

---

## 📦 Migrazione Dati

### Script Migrazione

**File**: `scripts/migrate-user-tenant-memberships.js`

```javascript
/**
 * Script Migrazione: Converti tenantId in tenantMemberships
 * 
 * Esegue:
 * 1. Per ogni utente con tenantId ma senza tenantMemberships
 * 2. Crea tenantMemberships[tenantId] con dati esistenti
 * 3. Imposta tenantIdPredefinito: true
 * 4. Mantiene tenantId e ruoli per retrocompatibilità
 * 
 * Uso:
 * node scripts/migrate-user-tenant-memberships.js [--dry-run]
 */

// Pseudo-codice:
// 1. Connessione Firestore
// 2. Query: users dove tenantId esiste E tenantMemberships non esiste
// 3. Per ogni utente:
//    - Crea tenantMemberships[tenantId] = {
//        ruoli: user.ruoli,
//        stato: user.stato,
//        dataInizio: user.creatoIl || now(),
//        creatoDa: user.creatoDa || user.id,
//        tenantIdPredefinito: true
//      }
//    - Aggiorna documento
// 4. Log risultati
// 5. Verifica migrazione
```

### Esecuzione Migrazione

**PRIMA di eseguire**:
1. ✅ Backup completo Firestore
2. ✅ Test su database di sviluppo
3. ✅ Dry-run per vedere cosa verrà modificato

**Esecuzione**:
```bash
# Dry-run (non modifica nulla)
node scripts/migrate-user-tenant-memberships.js --dry-run

# Esecuzione reale
node scripts/migrate-user-tenant-memberships.js
```

**DOPO migrazione**:
1. ✅ Verificare alcuni utenti manualmente
2. ✅ Verificare che login funzioni
3. ✅ Verificare che dati siano corretti

---

## ✅ Checklist Implementazione

### Fase 1: Preparazione
- [ ] Modificare `core/models/User.js`
  - [ ] Aggiungere campo `tenantMemberships`
  - [ ] Aggiungere metodi helper
  - [ ] Mantenere retrocompatibilità
- [ ] Creare script migrazione dati
- [ ] Test script su database test

### Fase 2: Core Services
- [ ] Aggiornare `core/services/tenant-service.js`
  - [ ] Gestione multi-tenant
  - [ ] SessionStorage management
  - [ ] Helper functions
- [ ] Aggiornare `core/services/auth-service.js`
  - [ ] Login multi-tenant
  - [ ] Caricamento membership
- [ ] Creare `core/services/tenant-selection-service.js`
  - [ ] Modal selettore
  - [ ] Gestione selezione

### Fase 3: UI/UX
- [ ] Aggiornare `core/auth/login-standalone.html`
  - [ ] Selettore tenant al login
- [ ] Aggiornare `core/dashboard-standalone.html`
  - [ ] Switch tenant in header
- [ ] Verificare tutti i `*-standalone.html`
  - [ ] Usano `getCurrentTenantId()`
  - [ ] Gestiscono `currentTenantId === null`

### Fase 4: Security Rules
- [ ] Aggiornare `firestore.rules`
  - [ ] `belongsToTenant()` supporta multi-tenant
  - [ ] `hasRole()` supporta multi-tenant
- [ ] Test security rules in emulator
- [ ] Verifica isolamento dati

### Fase 5: Invito Cross-Tenant
- [ ] Aggiornare `core/services/invito-service-standalone.js`
  - [ ] Verifica utente esistente
  - [ ] Aggiunta membership
- [ ] Aggiornare `core/auth/registrazione-invito-standalone.html`
  - [ ] Gestione utente esistente
- [ ] Aggiornare `core/admin/gestisci-utenti-standalone.html`
  - [ ] Messaggi appropriati

### Fase 6: Testing
- [ ] Test utente singolo tenant (retrocompatibilità)
- [ ] Test utente multi-tenant
- [ ] Test invito cross-tenant
- [ ] Test security rules
- [ ] Test migrazione dati
- [ ] Test tutti i moduli principali

### Fase 7: Deploy
- [ ] Backup Firestore
- [ ] Deploy security rules
- [ ] Eseguire migrazione dati
- [ ] Deploy codice
- [ ] Verifica post-deploy
- [ ] Monitoraggio errori

---

## 📝 Note Implementative

### SessionStorage vs LocalStorage

**SessionStorage**:
- Si cancella alla chiusura browser
- Più sicuro (non persistente)
- Utente deve selezionare tenant ogni sessione

**LocalStorage**:
- Persiste tra sessioni
- Meno sicuro
- Utente non deve selezionare ogni volta

**Raccomandazione**: Usare **SessionStorage** per sicurezza, con fallback a **LocalStorage** per tenant predefinito.

### Gestione Tenant Predefinito

Quando un utente ha più tenant, uno deve essere "predefinito":
- Primo tenant creato (per utenti esistenti)
- Tenant selezionato dall'utente
- Salvare in localStorage come fallback

### Performance

- Cache `tenantMemberships` in memoria dopo login
- Query solo al login, non ad ogni richiesta
- Usare indici Firestore se necessario per query membership

### Retrocompatibilità

Mantenere `tenantId` e `ruoli` per:
- Codice legacy che li legge ancora
- Security rules durante transizione
- Fallback se `tenantMemberships` non disponibile

**Piano rimozione** (futuro):
- Dopo 6 mesi, rimuovere supporto `tenantId` legacy
- Aggiornare tutto il codice
- Rimuovere da security rules

---

## 🔄 Rollback Plan

Se qualcosa va storto:

1. **Ripristina Security Rules**:
   ```bash
   firebase deploy --only firestore:rules --project <project-id>
   # Usa versione precedente
   ```

2. **Ripristina Codice**:
   ```bash
   git revert <commit-hash>
   # Deploy versione precedente
   ```

3. **Ripristina Dati** (se migrazione fallita):
   - Usa backup Firestore
   - Ripristina da backup

4. **Disabilita Feature**:
   - Flag feature: `ENABLE_MULTI_TENANT = false`
   - Sistema usa solo `tenantId` legacy

---

## 📚 Riferimenti

### Documentazione Firebase
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Firebase Auth](https://firebase.google.com/docs/auth)

### Architettura Corrente
- `ARCHITETTURA_DATI_PERMESSI.md` - Architettura dati
- `firestore.rules` - Security rules attuali
- `core/services/tenant-service.js` - Servizio tenant attuale

### File Correlati
- `core/models/User.js` - Modello utente
- `core/services/auth-service.js` - Servizio autenticazione
- `core/services/invito-service-standalone.js` - Servizio inviti

---

## 🎯 Conclusione

Questo piano fornisce una guida completa per implementare multi-tenant membership. 

**Tempo stimato totale**: 7-11 giorni lavorativi

**Priorità**: 
1. Fase 1-2 (Core) - Critico
2. Fase 4 (Security) - Critico
3. Fase 3 (UI) - Importante
4. Fase 5 (Invito) - Importante
5. Fase 6 (Testing) - Essenziale

**Raccomandazione**: Implementare in fasi, testando dopo ogni fase prima di procedere.

---

**Ultimo aggiornamento**: 2026-01-04  
**Versione documento**: 1.0  
**Autore**: AI Assistant (Claude Sonnet 4.5)
