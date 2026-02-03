# 🧪 Guida Pratica Test Manuali - GFV Platform

**Data**: 2026-01-11  
**Stato**: ✅ Pronto per iniziare  
**Tempo Stimato**: 1-2 ore

---

## 📋 Cosa Dobbiamo Testare

I test manuali servono a verificare che:
1. ✅ Gli utenti di un tenant **NON possano vedere** i dati di altri tenant
2. ✅ Il sistema multi-tenant funzioni correttamente
3. ✅ Le Security Rules di Firebase blocchino accessi non autorizzati
4. ✅ Il selettore tenant funzioni quando un utente ha più aziende

---

## 🎯 Test da Eseguire

### Test 1: Isolamento Terreni ⭐ PRIORITÀ ALTA
### Test 2: Isolamento Attività ⭐ PRIORITÀ ALTA
### Test 3: Isolamento Clienti (Modulo Conto Terzi)
### Test 4: Isolamento Lavori (Modulo Manodopera)
### Test 5: Isolamento Macchine (Modulo Parco Macchine)
### Test 6: Security Rules - Accesso Diretto
### Test 7: Isolamento Statistiche

---

## 🚀 Setup Iniziale (15 minuti)

### Passo 1: Verifica File Standalone

I file standalone sono già pronti:
- ✅ `core/auth/login-standalone.html` - Login
- ✅ `core/dashboard-standalone.html` - Dashboard
- ✅ `core/terreni-standalone.html` - Gestione Terreni
- ✅ `core/attivita-standalone.html` - Diario Attività
- ✅ Altri moduli standalone...

### Passo 2: Crea Utenti di Test in Firebase

**Apri Firebase Console**: https://console.firebase.google.com/

#### Crea 2 Tenant di Test

1. Vai su **Firestore Database** → **Data**
2. Crea collection `tenants` se non esiste
3. Crea 2 documenti:

**Tenant A** (`tenants/tenant-test-a`):
```json
{
  "nome": "Azienda Test A",
  "createdAt": [timestamp attuale]
}
```

**Tenant B** (`tenants/tenant-test-b`):
```json
{
  "nome": "Azienda Test B",
  "createdAt": [timestamp attuale]
}
```

#### Crea 4 Utenti di Test

1. Vai su **Authentication** → **Users** → **Add user**

**Utente A - Manager Tenant A**:
- Email: `manager-a@test.com`
- Password: `Test123!`
- **Dopo creazione, copia l'UID**

Poi crea documento in Firestore (`users/{UID-UTENTE-A}`):
```json
{
  "email": "manager-a@test.com",
  "nome": "Manager",
  "cognome": "A",
  "tenantMemberships": {
    "tenant-test-a": {
      "ruoli": ["manager"],
      "stato": "attivo",
      "tenantIdPredefinito": true
    }
  },
  "stato": "attivo"
}
```

**Utente B - Manager Tenant B**:
- Email: `manager-b@test.com`
- Password: `Test123!`
- **Copia UID**

Documento Firestore (`users/{UID-UTENTE-B}`):
```json
{
  "email": "manager-b@test.com",
  "nome": "Manager",
  "cognome": "B",
  "tenantMemberships": {
    "tenant-test-b": {
      "ruoli": ["manager"],
      "stato": "attivo",
      "tenantIdPredefinito": true
    }
  },
  "stato": "attivo"
}
```

**Utente C - Caposquadra Tenant A**:
- Email: `caposquadra-a@test.com`
- Password: `Test123!`
- **Copia UID**

Documento Firestore (`users/{UID-UTENTE-C}`):
```json
{
  "email": "caposquadra-a@test.com",
  "nome": "Caposquadra",
  "cognome": "A",
  "tenantMemberships": {
    "tenant-test-a": {
      "ruoli": ["caposquadra"],
      "stato": "attivo",
      "tenantIdPredefinito": true
    }
  },
  "stato": "attivo"
}
```

**Utente D - Operaio Tenant A**:
- Email: `operaio-a@test.com`
- Password: `Test123!`
- **Copia UID**

Documento Firestore (`users/{UID-UTENTE-D}`):
```json
{
  "email": "operaio-a@test.com",
  "nome": "Operaio",
  "cognome": "A",
  "tenantMemberships": {
    "tenant-test-a": {
      "ruoli": ["operaio"],
      "stato": "attivo",
      "tenantIdPredefinito": true
    }
  },
  "stato": "attivo"
}
```

### Passo 3: Crea Dati di Test

#### Dati per Tenant A

1. **Terreni** (`tenants/tenant-test-a/terreni/`):
   - Crea 2 terreni: "Campo A1", "Campo A2"

2. **Attività** (`tenants/tenant-test-a/attivita/`):
   - Crea 2 attività collegate ai terreni

3. **Clienti** (`tenants/tenant-test-a/clienti/`):
   - Crea 2 clienti: "Cliente A1", "Cliente A2"

4. **Lavori** (`tenants/tenant-test-a/lavori/`):
   - Crea 2 lavori

5. **Macchine** (`tenants/tenant-test-a/macchine/`):
   - Crea 2 macchine: "Macchina A1", "Macchina A2"

#### Dati per Tenant B

1. **Terreni** (`tenants/tenant-test-b/terreni/`):
   - Crea 2 terreni: "Campo B1", "Campo B2"

2. **Attività** (`tenants/tenant-test-b/attivita/`):
   - Crea 2 attività collegate ai terreni

3. **Clienti** (`tenants/tenant-test-b/clienti/`):
   - Crea 2 clienti: "Cliente B1", "Cliente B2"

4. **Lavori** (`tenants/tenant-test-b/lavori/`):
   - Crea 2 lavori

5. **Macchine** (`tenants/tenant-test-b/macchine/`):
   - Crea 2 macchine: "Macchina B1", "Macchina B2"

---

## 🧪 Esecuzione Test

### Come Eseguire i Test

1. **Apri file standalone**:
   - Doppio click su `core/auth/login-standalone.html`
   - Oppure apri con browser: `file:///C:/Users/Pier/Desktop/GFV/gfv-platform/core/auth/login-standalone.html`

2. **Usa finestre anonime del browser** per testare utenti diversi:
   - Chrome: `Ctrl+Shift+N` (finestra anonima)
   - Firefox: `Ctrl+Shift+P` (finestra privata)
   - Edge: `Ctrl+Shift+N` (finestra InPrivate)

3. **Per ogni test**:
   - Login con utente A
   - Verifica che veda SOLO dati Tenant A
   - Logout
   - Login con utente B
   - Verifica che veda SOLO dati Tenant B

---

## 📊 Checklist Test Dettagliata

### Test 1: Isolamento Terreni ✅

**Setup**: Assicurati di avere:
- Tenant A: "Campo A1", "Campo A2"
- Tenant B: "Campo B1", "Campo B2"

**Esecuzione**:
1. [ ] Login come `manager-a@test.com` (Tenant A)
2. [ ] Vai su **Gestione Terreni**
3. [ ] **Verifica**: Vedi SOLO "Campo A1" e "Campo A2"
4. [ ] **Verifica**: NON vedi "Campo B1" o "Campo B2"
5. [ ] Logout
6. [ ] Login come `manager-b@test.com` (Tenant B)
7. [ ] Vai su **Gestione Terreni**
8. [ ] **Verifica**: Vedi SOLO "Campo B1" e "Campo B2"
9. [ ] **Verifica**: NON vedi "Campo A1" o "Campo A2"

**Risultato**: ✅ PASS se ogni tenant vede solo i propri terreni

---

### Test 2: Isolamento Attività ✅

**Esecuzione**:
1. [ ] Login come `manager-a@test.com`
2. [ ] Vai su **Diario Attività**
3. [ ] **Verifica**: Vedi SOLO attività Tenant A
4. [ ] **Verifica**: NON vedi attività Tenant B
5. [ ] Logout
6. [ ] Login come `manager-b@test.com`
7. [ ] Vai su **Diario Attività**
8. [ ] **Verifica**: Vedi SOLO attività Tenant B
9. [ ] **Verifica**: NON vedi attività Tenant A

**Risultato**: ✅ PASS se ogni tenant vede solo le proprie attività

---

### Test 3: Isolamento Clienti ✅

**Esecuzione**:
1. [ ] Login come `manager-a@test.com`
2. [ ] Vai su **Clienti** (Modulo Conto Terzi)
3. [ ] **Verifica**: Vedi SOLO "Cliente A1" e "Cliente A2"
4. [ ] **Verifica**: NON vedi clienti Tenant B
5. [ ] Logout
6. [ ] Login come `manager-b@test.com`
7. [ ] Vai su **Clienti**
8. [ ] **Verifica**: Vedi SOLO "Cliente B1" e "Cliente B2"
9. [ ] **Verifica**: NON vedi clienti Tenant A

**Risultato**: ✅ PASS se ogni tenant vede solo i propri clienti

---

### Test 4: Isolamento Lavori ✅

**Esecuzione**:
1. [ ] Login come `manager-a@test.com`
2. [ ] Vai su **Gestione Lavori**
3. [ ] **Verifica**: Vedi SOLO lavori Tenant A
4. [ ] **Verifica**: NON vedi lavori Tenant B
5. [ ] Logout
6. [ ] Login come `manager-b@test.com`
7. [ ] Vai su **Gestione Lavori**
8. [ ] **Verifica**: Vedi SOLO lavori Tenant B
9. [ ] **Verifica**: NON vedi lavori Tenant A

**Risultato**: ✅ PASS se ogni tenant vede solo i propri lavori

---

### Test 5: Isolamento Macchine ✅

**Esecuzione**:
1. [ ] Login come `manager-a@test.com`
2. [ ] Vai su **Gestione Macchine**
3. [ ] **Verifica**: Vedi SOLO "Macchina A1" e "Macchina A2"
4. [ ] **Verifica**: NON vedi macchine Tenant B
5. [ ] Logout
6. [ ] Login come `manager-b@test.com`
7. [ ] Vai su **Gestione Macchine**
8. [ ] **Verifica**: Vedi SOLO "Macchina B1" e "Macchina B2"
9. [ ] **Verifica**: NON vedi macchine Tenant A

**Risultato**: ✅ PASS se ogni tenant vede solo le proprie macchine

---

### Test 6: Security Rules - Accesso Diretto 🔒

**Obiettivo**: Verificare che le Security Rules blocchino accessi non autorizzati

**Esecuzione**:
1. [ ] Login come `manager-a@test.com` (Tenant A)
2. [ ] Apri **Console Browser** (F12 → tab Console)
3. [ ] Esegui questo codice:

```javascript
// Prova a leggere terreni Tenant B (dovrebbe FALLIRE)
import { getFirestore, collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const db = getFirestore();
const tenantBCollection = collection(db, 'tenants/tenant-test-b/terreni');
const snapshot = await getDocs(tenantBCollection);
console.log('Terreni Tenant B:', snapshot.size);
```

4. [ ] **Verifica**: Dovresti vedere errore "Missing or insufficient permissions"
5. [ ] **Verifica**: `snapshot.size` dovrebbe essere 0 o errore

**Risultato**: ✅ PASS se Security Rules bloccano l'accesso

---

### Test 7: Isolamento Statistiche ✅

**Esecuzione**:
1. [ ] Login come `manager-a@test.com`
2. [ ] Vai su **Statistiche**
3. [ ] **Verifica**: Le statistiche mostrano solo dati Tenant A
4. [ ] **Verifica**: Non ci sono dati di Tenant B
5. [ ] Logout
6. [ ] Login come `manager-b@test.com`
7. [ ] Vai su **Statistiche**
8. [ ] **Verifica**: Le statistiche mostrano solo dati Tenant B
9. [ ] **Verifica**: Non ci sono dati di Tenant A

**Risultato**: ✅ PASS se ogni tenant vede solo le proprie statistiche

---

## 🐛 Se un Test Fallisce

### Cosa Fare

1. **Documenta il problema**:
   - Quale test è fallito
   - Quali dati sono stati visti (screenshot)
   - Errori in console browser (F12)

2. **Verifica Security Rules**:
   - Vai su Firebase Console → Firestore → Regole
   - Verifica che le regole siano deployate

3. **Verifica Servizi**:
   - Controlla che `getCurrentTenantId()` restituisca il tenant corretto
   - Verifica che i servizi usino sempre `tenantId` nelle query

4. **Verifica UI**:
   - Controlla che l'UI non mostri dati di altri tenant
   - Verifica filtri e query

---

## ✅ Risultato Finale

**Data Test**: _______________  
**Eseguito da**: _______________

**Risultati**:
- [ ] ✅ Tutti i test PASS
- [ ] ❌ Alcuni test FAIL (specificare quali)

**Note**: 
_________________________________________________
_________________________________________________
_________________________________________________

---

## 📝 File di Riferimento

- **Guida Completa**: `tests/security/test-isolamento-multi-tenant.md`
- **Test Security Rules**: `tests/security/test-manual-security-rules.md`
- **Guida Multi-tenant**: `GUIDA_TEST_MULTI_TENANT.md`

---

**Pronto per iniziare!** 🚀

Inizia con il **Test 1: Isolamento Terreni** che è il più importante.
