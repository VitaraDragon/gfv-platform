# 🧪 Test Manuali Security Rules

**Data Creazione**: 2026-01-03  
**Tipo**: Test Manuali per Security Rules Firebase

---

## ⚠️ Importante

Questi test richiedono:
- Accesso a Firebase Console
- Creazione di utenti di test
- Esecuzione manuale o con script

---

## 📋 Setup Test

### 1. Creare Tenant di Test

**Firebase Console** → **Firestore Database** → **Data**

Crea 2 tenant:
```
tenants/tenant-test-a
  - nome: "Tenant Test A"
  - createdAt: [timestamp]

tenants/tenant-test-b
  - nome: "Tenant Test B"
  - createdAt: [timestamp]
```

### 2. Creare Utenti di Test

**Firebase Console** → **Authentication** → **Users**

Crea 4 utenti:

**Utente A (Manager Tenant A)**:
- Email: `manager-a@test.com`
- Password: `Test123!`
- Documento `users/user-a-id`:
  ```json
  {
    "email": "manager-a@test.com",
    "tenantId": "tenant-test-a",
    "ruoli": ["manager"]
  }
  ```

**Utente B (Manager Tenant B)**:
- Email: `manager-b@test.com`
- Password: `Test123!`
- Documento `users/user-b-id`:
  ```json
  {
    "email": "manager-b@test.com",
    "tenantId": "tenant-test-b",
    "ruoli": ["manager"]
  }
  ```

**Utente C (Caposquadra Tenant A)**:
- Email: `caposquadra-a@test.com`
- Password: `Test123!`
- Documento `users/user-c-id`:
  ```json
  {
    "email": "caposquadra-a@test.com",
    "tenantId": "tenant-test-a",
    "ruoli": ["caposquadra"]
  }
  ```

**Utente D (Operaio Tenant A)**:
- Email: `operaio-a@test.com`
- Password: `Test123!`
- Documento `users/user-d-id`:
  ```json
  {
    "email": "operaio-a@test.com",
    "tenantId": "tenant-test-a",
    "ruoli": ["operaio"]
  }
  ```

---

## 🧪 Test 1: Isolamento Multi-tenant

### Obiettivo
Verificare che un utente NON possa accedere ai dati di un altro tenant.

### Test Case 1.1: Lettura Terreni Altro Tenant

**Utente**: Manager A (tenant-test-a)  
**Azione**: Tentare di leggere terreni di tenant-test-b

**Passi**:
1. Login come `manager-a@test.com`
2. Tentare di leggere `tenants/tenant-test-b/terreni/terreno-test-b1`

**Risultato Atteso**: ❌ **Errore "Missing or insufficient permissions"**

**Verifica**:
```javascript
// Nella console browser (dopo login)
const db = getFirestore();
const terrenoRef = doc(db, 'tenants/tenant-test-b/terreni/terreno-test-b1');
const terrenoDoc = await getDoc(terrenoRef);
// Dovrebbe fallire con errore permessi
```

### Test Case 1.2: Creazione Terreno Altro Tenant

**Utente**: Manager A (tenant-test-a)  
**Azione**: Tentare di creare terreno in tenant-test-b

**Passi**:
1. Login come `manager-a@test.com`
2. Tentare di creare terreno in `tenants/tenant-test-b/terreni`

**Risultato Atteso**: ❌ **Errore "Missing or insufficient permissions"**

### Test Case 1.3: Lettura Propri Tenant

**Utente**: Manager A (tenant-test-a)  
**Azione**: Leggere terreni del proprio tenant

**Passi**:
1. Login come `manager-a@test.com`
2. Leggere `tenants/tenant-test-a/terreni`

**Risultato Atteso**: ✅ **Successo** - Dati del tenant A restituiti

---

## 🧪 Test 2: Permessi per Ruolo

### Test Case 2.1: Manager può Creare Terreno

**Utente**: Manager A  
**Azione**: Creare terreno nel proprio tenant

**Passi**:
1. Login come `manager-a@test.com`
2. Creare terreno in `tenants/tenant-test-a/terreni`

**Risultato Atteso**: ✅ **Successo** - Terreno creato

### Test Case 2.2: Caposquadra NON può Creare Terreno

**Utente**: Caposquadra A  
**Azione**: Tentare di creare terreno

**Passi**:
1. Login come `caposquadra-a@test.com`
2. Tentare di creare terreno in `tenants/tenant-test-a/terreni`

**Risultato Atteso**: ❌ **Errore "Missing or insufficient permissions"**

### Test Case 2.3: Operaio NON può Creare Terreno

**Utente**: Operaio A  
**Azione**: Tentare di creare terreno

**Passi**:
1. Login come `operaio-a@test.com`
2. Tentare di creare terreno in `tenants/tenant-test-a/terreni`

**Risultato Atteso**: ❌ **Errore "Missing or insufficient permissions"**

### Test Case 2.4: Caposquadra può Tracciare Zone Lavorate

**Utente**: Caposquadra A  
**Azione**: Aggiungere zona lavorata a lavoro assegnato

**Passi**:
1. Login come `manager-a@test.com`
2. Creare lavoro assegnato a `caposquadra-a@test.com`
3. Login come `caposquadra-a@test.com`
4. Aggiungere zona lavorata in `tenants/tenant-test-a/lavori/{lavoroId}/zoneLavorate`

**Risultato Atteso**: ✅ **Successo** - Zona lavorata aggiunta

### Test Case 2.5: Operaio può Segnare Ore

**Utente**: Operaio A  
**Azione**: Segnare ore proprie

**Passi**:
1. Login come `operaio-a@test.com`
2. Creare documento in `tenants/tenant-test-a/ore` con `operaioId: "user-d-id"`

**Risultato Atteso**: ✅ **Successo** - Ore segnate

---

## 🧪 Test 3: Sub-collections

### Test Case 3.1: Caposquadra può Aggiungere Zone Lavorate

**Utente**: Caposquadra A  
**Azione**: Aggiungere zona lavorata a lavoro assegnato

**Passi**:
1. Assicurati che esista un lavoro con `caposquadraId: "user-c-id"`
2. Login come `caposquadra-a@test.com`
3. Aggiungere documento in `tenants/tenant-test-a/lavori/{lavoroId}/zoneLavorate`

**Risultato Atteso**: ✅ **Successo**

### Test Case 3.2: Caposquadra NON può Aggiungere Zone a Lavoro Non Assegnato

**Utente**: Caposquadra A  
**Azione**: Tentare di aggiungere zona a lavoro assegnato ad altro caposquadra

**Passi**:
1. Creare lavoro con `caposquadraId: "altro-caposquadra-id"`
2. Login come `caposquadra-a@test.com`
3. Tentare di aggiungere zona lavorata

**Risultato Atteso**: ❌ **Errore "Missing or insufficient permissions"**

---

## 📊 Checklist Test

### Isolamento Multi-tenant
- [ ] Manager A NON può leggere terreni Tenant B
- [ ] Manager A NON può creare terreni Tenant B
- [ ] Manager A può leggere terreni Tenant A
- [ ] Manager A può creare terreni Tenant A

### Permessi Ruolo
- [ ] Manager può creare terreno
- [ ] Manager può modificare terreno
- [ ] Manager può eliminare terreno
- [ ] Caposquadra NON può creare terreno
- [ ] Caposquadra NON può modificare terreno
- [ ] Caposquadra può tracciare zone lavorate (solo suoi lavori)
- [ ] Operaio NON può creare terreno
- [ ] Operaio NON può modificare terreno
- [ ] Operaio può segnare ore (solo proprie)

### Sub-collections
- [ ] Caposquadra può aggiungere zone lavorate (solo suoi lavori)
- [ ] Caposquadra NON può aggiungere zone a lavori non assegnati

---

## 🔧 Script di Test (Opzionale)

Puoi creare uno script Node.js per automatizzare alcuni test:

```javascript
// test-security-rules.js
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, collection, addDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import firebaseConfig from './core/config/firebase-config.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function testIsolamentoMultiTenant() {
  // Login come Manager A
  await signInWithEmailAndPassword(auth, 'manager-a@test.com', 'Test123!');
  
  // Tentare di leggere terreno Tenant B
  try {
    const terrenoRef = doc(db, 'tenants/tenant-test-b/terreni/terreno-test-b1');
    const terrenoDoc = await getDoc(terrenoRef);
    
    if (terrenoDoc.exists()) {
      console.error('❌ TEST FALLITO: Manager A può leggere terreno Tenant B');
    } else {
      console.log('✅ TEST PASSATO: Manager A NON può leggere terreno Tenant B');
    }
  } catch (error) {
    if (error.code === 'permission-denied') {
      console.log('✅ TEST PASSATO: Errore permessi come atteso');
    } else {
      console.error('❌ TEST FALLITO: Errore inatteso:', error);
    }
  }
}

// Esegui test
testIsolamentoMultiTenant();
```

---

## 📝 Note

- Esegui questi test in un ambiente di sviluppo/test
- Non usare dati di produzione
- Pulisci i dati di test dopo i test
- Documenta eventuali problemi trovati

---

**Ultimo aggiornamento**: 2026-01-03
