# 🧪 Test Multi-Tenant Membership

**Data**: 2026-01-04  
**Versione**: 1.0  
**Stato**: In esecuzione

---

## 📋 Checklist Test

### ✅ Test 1: Verifica Sintassi e Import
- [x] Nessun errore di linting
- [x] Tutti gli import corretti
- [x] Funzioni esportate correttamente

### 🔄 Test 2: Retrocompatibilità - Login Utente Singolo Tenant

**Scenario**: Utente esistente con solo `tenantId` (senza `tenantMemberships`)

**Dati Test**:
```javascript
// users/{userId}
{
  email: "test@example.com",
  tenantId: "tenant-a",  // Solo questo, nessun tenantMemberships
  ruoli: ["amministratore"],
  stato: "attivo"
}
```

**Flusso Atteso**:
1. Login con email/password
2. `auth-service.js` carica `userData`
3. `tenant-service.js` rileva che non c'è `tenantMemberships`
4. Usa `tenantId` deprecato per retrocompatibilità
5. Imposta `currentTenantId = "tenant-a"`
6. Redirect a dashboard senza selettore tenant

**Verifiche**:
- [ ] Login funziona
- [ ] `getCurrentTenantId()` restituisce `"tenant-a"`
- [ ] Dashboard carica dati corretti
- [ ] Nessun errore in console

---

### 🔄 Test 3: Multi-Tenant - Login Utente con Più Tenant

**Scenario**: Utente con `tenantMemberships` multipli

**Dati Test**:
```javascript
// users/{userId}
{
  email: "multi@example.com",
  tenantMemberships: {
    "tenant-a": {
      ruoli: ["amministratore"],
      stato: "attivo",
      tenantIdPredefinito: true
    },
    "tenant-b": {
      ruoli: ["caposquadra"],
      stato: "attivo",
      tenantIdPredefinito: false
    }
  },
  // Retrocompatibilità
  tenantId: "tenant-a",
  ruoli: ["amministratore"]
}
```

**Flusso Atteso**:
1. Login con email/password
2. `getUserTenants()` restituisce array con 2 tenant
3. `showTenantSelector()` mostra modal con 2 opzioni
4. Utente seleziona tenant
5. `setCurrentTenantId()` salva in `sessionStorage`
6. Redirect a dashboard con tenant selezionato

**Verifiche**:
- [ ] Login funziona
- [ ] Selettore tenant viene mostrato
- [ ] Selezione tenant funziona
- [ ] `getCurrentTenantId()` restituisce tenant selezionato
- [ ] Dashboard carica dati del tenant selezionato
- [ ] Switch tenant dalla dashboard funziona

---

### 🔄 Test 4: Invito Utente Esistente a Nuovo Tenant

**Scenario**: Invitare un utente già registrato (email esistente) a un nuovo tenant

**Setup**:
1. Utente A esiste con `tenantId: "tenant-a"`
2. Admin di `tenant-b` invita email di Utente A

**Flusso Atteso**:
1. Admin crea invito con `createInvito()`
2. `createInvito()` verifica che email esiste → `isExistingUser: true`
3. Email inviata con link registrazione
4. Utente A clicca link
5. `acceptInvito()` rileva `isExistingUser: true`
6. Chiede password esistente
7. Fa `signInWithEmailAndPassword()`
8. Aggiunge `tenantMemberships["tenant-b"]` al documento utente
9. Utente A ora ha 2 tenant

**Verifiche**:
- [ ] Invito creato correttamente con `isExistingUser: true`
- [ ] Email inviata correttamente
- [ ] Pagina registrazione mostra messaggio "Utente esistente"
- [ ] Login con password esistente funziona
- [ ] `tenantMemberships` aggiornato correttamente
- [ ] Utente può vedere entrambi i tenant al prossimo login

---

### 🔄 Test 5: Switch Tenant dalla Dashboard

**Scenario**: Utente multi-tenant cambia tenant attivo

**Setup**: Utente già loggato con 2 tenant

**Flusso Atteso**:
1. Dashboard mostra pulsante "Cambia Azienda"
2. Click su pulsante
3. `showTenantSelector()` mostra modal
4. Utente seleziona nuovo tenant
5. `switchTenant()` aggiorna `sessionStorage`
6. Pagina ricaricata
7. Dashboard mostra dati del nuovo tenant

**Verifiche**:
- [ ] Pulsante "Cambia Azienda" visibile se `tenants.length > 1`
- [ ] Click mostra selettore
- [ ] Selezione aggiorna tenant corrente
- [ ] Dati dashboard aggiornati correttamente
- [ ] `getCurrentTenantId()` restituisce nuovo tenant

---

### 🔄 Test 6: Security Rules - Isolamento Dati

**Scenario**: Verificare che utente di Tenant A non possa accedere a dati di Tenant B

**Setup**:
- Utente A: `tenantMemberships: { "tenant-a": {...} }`
- Utente B: `tenantMemberships: { "tenant-b": {...} }`

**Test**:
1. Utente A loggato con `currentTenantId = "tenant-a"`
2. Prova a leggere `tenants/tenant-b/terreni/{id}`
3. Security rules devono bloccare

**Verifiche**:
- [ ] `belongsToTenant("tenant-b")` restituisce `false` per Utente A
- [ ] Query a `tenants/tenant-b/...` viene bloccata
- [ ] Nessun dato di Tenant B visibile a Utente A

---

## 🐛 Problemi Riscontrati

### Nessun problema finora

---

## ✅ Risultati Test

| Test | Stato | Note |
|------|-------|------|
| Test 1: Sintassi | ✅ PASS | Nessun errore |
| Test 2: Retrocompatibilità | ⏳ PENDING | Da eseguire manualmente |
| Test 3: Multi-Tenant Login | ⏳ PENDING | Da eseguire manualmente |
| Test 4: Invito Esistente | ⏳ PENDING | Da eseguire manualmente |
| Test 5: Switch Tenant | ⏳ PENDING | Da eseguire manualmente |
| Test 6: Security Rules | ⏳ PENDING | Da eseguire manualmente |

---

## 📝 Note

- I test 2-6 richiedono esecuzione manuale su browser
- Verificare console per errori JavaScript
- Verificare Network tab per errori Firestore
- Verificare Firebase Console per errori Security Rules

---

## 🔄 Prossimi Passi

1. Eseguire test manuali 2-6
2. Documentare eventuali problemi
3. Correggere problemi trovati
4. Eseguire migrazione dati con `--dry-run`
5. Eseguire migrazione dati reale
