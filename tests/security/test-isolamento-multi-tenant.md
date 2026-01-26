# 🔒 Test Isolamento Multi-tenant - Guida Manuale

**Data Creazione**: 2026-01-11  
**Priorità**: 🔴 CRITICO  
**Tempo Stimato**: 1-2 ore

---

## 🎯 Obiettivo

Verificare che gli utenti di un tenant **NON possano accedere ai dati di altri tenant**. Questo è un test critico per la sicurezza dell'applicazione.

---

## 📋 Prerequisiti

1. **2 Account Utente** con tenant diversi:
   - Account A: `user-a@test.com` → Tenant A (`tenant-a`)
   - Account B: `user-b@test.com` → Tenant B (`tenant-b`)

2. **Dati di Test**:
   - Tenant A: almeno 2-3 terreni, 2-3 attività
   - Tenant B: almeno 2-3 terreni, 2-3 attività

3. **Browser** con possibilità di aprire finestre anonime o account separati

---

## 🧪 Test da Eseguire

### Test 1: Isolamento Terreni

#### Setup
1. **Tenant A**: Crea 2 terreni:
   - "Campo A1"
   - "Campo A2"

2. **Tenant B**: Crea 2 terreni:
   - "Campo B1"
   - "Campo B2"

#### Test
1. **Login come User A** (Tenant A)
2. Vai su **Gestione Terreni**
3. **Verifica**: Dovresti vedere SOLO "Campo A1" e "Campo A2"
4. **Verifica**: NON dovresti vedere "Campo B1" o "Campo B2"

5. **Login come User B** (Tenant B)
6. Vai su **Gestione Terreni**
7. **Verifica**: Dovresti vedere SOLO "Campo B1" e "Campo B2"
8. **Verifica**: NON dovresti vedere "Campo A1" o "Campo A2"

#### Risultato Atteso
✅ **PASS**: Ogni tenant vede solo i propri terreni  
❌ **FAIL**: Se un tenant vede terreni di altri tenant

---

### Test 2: Isolamento Attività

#### Setup
1. **Tenant A**: Crea 2 attività:
   - Attività A1 (collegata a "Campo A1")
   - Attività A2 (collegata a "Campo A2")

2. **Tenant B**: Crea 2 attività:
   - Attività B1 (collegata a "Campo B1")
   - Attività B2 (collegata a "Campo B2")

#### Test
1. **Login come User A** (Tenant A)
2. Vai su **Diario Attività**
3. **Verifica**: Dovresti vedere SOLO Attività A1 e A2
4. **Verifica**: NON dovresti vedere Attività B1 o B2

5. **Login come User B** (Tenant B)
6. Vai su **Diario Attività**
7. **Verifica**: Dovresti vedere SOLO Attività B1 e B2
8. **Verifica**: NON dovresti vedere Attività A1 o A2

#### Risultato Atteso
✅ **PASS**: Ogni tenant vede solo le proprie attività  
❌ **FAIL**: Se un tenant vede attività di altri tenant

---

### Test 3: Isolamento Clienti (Modulo Conto Terzi)

#### Setup
1. **Tenant A**: Crea 2 clienti:
   - Cliente A1
   - Cliente A2

2. **Tenant B**: Crea 2 clienti:
   - Cliente B1
   - Cliente B2

#### Test
1. **Login come User A** (Tenant A)
2. Vai su **Clienti** (Modulo Conto Terzi)
3. **Verifica**: Dovresti vedere SOLO Cliente A1 e A2
4. **Verifica**: NON dovresti vedere Cliente B1 o B2

5. **Login come User B** (Tenant B)
6. Vai su **Clienti** (Modulo Conto Terzi)
7. **Verifica**: Dovresti vedere SOLO Cliente B1 e B2
8. **Verifica**: NON dovresti vedere Cliente A1 o A2

#### Risultato Atteso
✅ **PASS**: Ogni tenant vede solo i propri clienti  
❌ **FAIL**: Se un tenant vede clienti di altri tenant

---

### Test 4: Isolamento Lavori (Modulo Manodopera)

#### Setup
1. **Tenant A**: Crea 2 lavori:
   - Lavoro A1
   - Lavoro A2

2. **Tenant B**: Crea 2 lavori:
   - Lavoro B1
   - Lavoro B2

#### Test
1. **Login come User A** (Tenant A)
2. Vai su **Gestione Lavori**
3. **Verifica**: Dovresti vedere SOLO Lavoro A1 e A2
4. **Verifica**: NON dovresti vedere Lavoro B1 o B2

5. **Login come User B** (Tenant B)
6. Vai su **Gestione Lavori**
7. **Verifica**: Dovresti vedere SOLO Lavoro B1 e B2
8. **Verifica**: NON dovresti vedere Lavoro A1 o A2

#### Risultato Atteso
✅ **PASS**: Ogni tenant vede solo i propri lavori  
❌ **FAIL**: Se un tenant vede lavori di altri tenant

---

### Test 5: Isolamento Macchine (Modulo Parco Macchine)

#### Setup
1. **Tenant A**: Crea 2 macchine:
   - Macchina A1
   - Macchina A2

2. **Tenant B**: Crea 2 macchine:
   - Macchina B1
   - Macchina B2

#### Test
1. **Login come User A** (Tenant A)
2. Vai su **Gestione Macchine**
3. **Verifica**: Dovresti vedere SOLO Macchina A1 e A2
4. **Verifica**: NON dovresti vedere Macchina B1 o B2

5. **Login come User B** (Tenant B)
6. Vai su **Gestione Macchine**
7. **Verifica**: Dovresti vedere SOLO Macchina B1 e B2
8. **Verifica**: NON dovresti vedere Macchina A1 o A2

#### Risultato Atteso
✅ **PASS**: Ogni tenant vede solo le proprie macchine  
❌ **FAIL**: Se un tenant vede macchine di altri tenant

---

### Test 6: Tentativo Accesso Diretto (Security Rules)

#### Test
1. **Login come User A** (Tenant A)
2. Apri **Console Browser** (F12)
3. Prova a leggere dati Tenant B usando Firebase SDK:

```javascript
// Questo DOVREBBE FALLIRE con errore "Missing or insufficient permissions"
import { getFirestore, collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const db = getFirestore();
const tenantBCollection = collection(db, 'tenants/tenant-b/terreni');
const snapshot = await getDocs(tenantBCollection);
console.log('Dati Tenant B:', snapshot.docs.map(d => d.data()));
```

#### Risultato Atteso
✅ **PASS**: Errore "Missing or insufficient permissions"  
❌ **FAIL**: Se riesce a leggere dati Tenant B

---

### Test 7: Isolamento Statistiche

#### Test
1. **Login come User A** (Tenant A)
2. Vai su **Statistiche**
3. **Verifica**: Le statistiche mostrano solo dati Tenant A
4. **Verifica**: Non ci sono dati di Tenant B

5. **Login come User B** (Tenant B)
6. Vai su **Statistiche**
7. **Verifica**: Le statistiche mostrano solo dati Tenant B
8. **Verifica**: Non ci sono dati di Tenant A

#### Risultato Atteso
✅ **PASS**: Ogni tenant vede solo le proprie statistiche  
❌ **FAIL**: Se un tenant vede statistiche di altri tenant

---

## 📊 Checklist Test

- [ ] Test 1: Isolamento Terreni
- [ ] Test 2: Isolamento Attività
- [ ] Test 3: Isolamento Clienti
- [ ] Test 4: Isolamento Lavori
- [ ] Test 5: Isolamento Macchine
- [ ] Test 6: Tentativo Accesso Diretto (Security Rules)
- [ ] Test 7: Isolamento Statistiche

---

## 🐛 Se un Test Fallisce

### Cosa Fare

1. **Documenta il problema**:
   - Quale test è fallito
   - Quali dati sono stati visti
   - Screenshot o log errori

2. **Verifica Security Rules**:
   - Vai su Firebase Console → Firestore → Regole
   - Verifica che le regole siano deployate correttamente
   - Controlla che `belongsToTenant()` funzioni correttamente

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

## 📝 Note

- Questi test devono essere eseguiti **prima del deploy in produzione**
- Se un test fallisce, **NON procedere** con il deploy fino a quando il problema non è risolto
- Esegui questi test ogni volta che modifichi Security Rules o servizi multi-tenant

---

**Ultimo aggiornamento**: 2026-01-11
