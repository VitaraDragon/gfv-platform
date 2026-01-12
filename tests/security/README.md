# 🔒 Test Sicurezza - GFV Platform

**Cartella**: `tests/security/`  
**Tipo**: Test isolamento multi-tenant e permessi

---

## 📋 Test Disponibili

### 1. Test Automatizzati (Vitest)

#### `multi-tenant.test.js`
Test automatizzati per verificare isolamento multi-tenant:
- Verifica che i servizi usino il tenantId corretto
- Verifica che i dati siano filtrati per tenant
- Verifica che non ci sia accesso cross-tenant

**Esecuzione**:
```bash
npm test tests/security/multi-tenant.test.js
```

#### `permissions.test.js`
Test automatizzati per verificare permessi per ruolo:
- Verifica permessi Manager/Amministratore
- Verifica permessi Caposquadra
- Verifica permessi Operaio
- Verifica utenti multi-ruolo

**Esecuzione**:
```bash
npm test tests/security/permissions.test.js
```

### 2. Test Manuali

#### `test-manual-security-rules.md`
Guida completa per test manuali delle Security Rules Firebase:
- Setup tenant e utenti di test
- Test isolamento multi-tenant
- Test permessi per ruolo
- Test sub-collections
- Checklist completa

**Esecuzione**: Manuale (seguire la guida)

---

## 🚀 Esecuzione Test

### Tutti i Test di Sicurezza
```bash
npm test tests/security/
```

### Singolo Test
```bash
npm test tests/security/multi-tenant.test.js
npm test tests/security/permissions.test.js
```

### Con Coverage
```bash
npm run test:coverage tests/security/
```

---

## ⚠️ Limitazioni

### Test Automatizzati
- ✅ Testano la logica dei servizi
- ✅ Usano mock Firebase
- ❌ NON testano le Security Rules reali di Firebase
- ❌ NON testano l'isolamento a livello database

### Test Manuali
- ✅ Testano le Security Rules reali
- ✅ Testano isolamento a livello database
- ❌ Richiedono setup manuale
- ❌ Richiedono accesso Firebase Console

---

## 📊 Coverage Atteso

### Test Automatizzati
- **Isolamento Multi-tenant**: ~80% (logica servizi)
- **Permessi Ruolo**: ~90% (logica permission-service)

### Test Manuali
- **Security Rules**: 100% (tutti i casi critici)

---

## 🔧 Setup Test Manuali

Vedi `test-manual-security-rules.md` per istruzioni complete.

**Prerequisiti**:
1. Accesso Firebase Console
2. Creazione tenant di test
3. Creazione utenti di test
4. Esecuzione test manuali o con script

---

## 📝 Note

- I test automatizzati usano mock e NON testano le Security Rules reali
- Per testare le Security Rules reali, usa i test manuali
- Esegui i test manuali prima del deploy in produzione
- Documenta eventuali problemi trovati

---

**Ultimo aggiornamento**: 2026-01-03
