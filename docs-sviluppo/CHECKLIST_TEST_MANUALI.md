# ✅ Checklist Test Manuali - Quick Reference

**Data**: _______________  
**Eseguito da**: _______________

---

## 🚀 Setup (15 min)

- [ ] Creati 2 tenant: `tenant-test-a`, `tenant-test-b`
- [ ] Creati 4 utenti di test:
  - [ ] `manager-a@test.com` (Tenant A)
  - [ ] `manager-b@test.com` (Tenant B)
  - [ ] `caposquadra-a@test.com` (Tenant A)
  - [ ] `operaio-a@test.com` (Tenant A)
- [ ] Creati dati di test per entrambi i tenant (terreni, attività, clienti, lavori, macchine)

---

## 🧪 Test Isolamento

### Test 1: Terreni
- [ ] Manager A vede SOLO terreni Tenant A
- [ ] Manager A NON vede terreni Tenant B
- [ ] Manager B vede SOLO terreni Tenant B
- [ ] Manager B NON vede terreni Tenant A
- **Risultato**: [ ] ✅ PASS [ ] ❌ FAIL

### Test 2: Attività
- [ ] Manager A vede SOLO attività Tenant A
- [ ] Manager A NON vede attività Tenant B
- [ ] Manager B vede SOLO attività Tenant B
- [ ] Manager B NON vede attività Tenant A
- **Risultato**: [ ] ✅ PASS [ ] ❌ FAIL

### Test 3: Clienti
- [ ] Manager A vede SOLO clienti Tenant A
- [ ] Manager A NON vede clienti Tenant B
- [ ] Manager B vede SOLO clienti Tenant B
- [ ] Manager B NON vede clienti Tenant A
- **Risultato**: [ ] ✅ PASS [ ] ❌ FAIL

### Test 4: Lavori
- [ ] Manager A vede SOLO lavori Tenant A
- [ ] Manager A NON vede lavori Tenant B
- [ ] Manager B vede SOLO lavori Tenant B
- [ ] Manager B NON vede lavori Tenant A
- **Risultato**: [ ] ✅ PASS [ ] ❌ FAIL

### Test 5: Macchine
- [ ] Manager A vede SOLO macchine Tenant A
- [ ] Manager A NON vede macchine Tenant B
- [ ] Manager B vede SOLO macchine Tenant B
- [ ] Manager B NON vede macchine Tenant A
- **Risultato**: [ ] ✅ PASS [ ] ❌ FAIL

### Test 6: Security Rules
- [ ] Manager A NON può leggere dati Tenant B (errore permessi)
- [ ] Manager B NON può leggere dati Tenant A (errore permessi)
- **Risultato**: [ ] ✅ PASS [ ] ❌ FAIL

### Test 7: Statistiche
- [ ] Manager A vede SOLO statistiche Tenant A
- [ ] Manager A NON vede statistiche Tenant B
- [ ] Manager B vede SOLO statistiche Tenant B
- [ ] Manager B NON vede statistiche Tenant A
- **Risultato**: [ ] ✅ PASS [ ] ❌ FAIL

---

## 📊 Risultato Finale

**Test Passati**: ___ / 7

**Test Falliti**: 
- [ ] Nessuno
- [ ] Test 1: Terreni
- [ ] Test 2: Attività
- [ ] Test 3: Clienti
- [ ] Test 4: Lavori
- [ ] Test 5: Macchine
- [ ] Test 6: Security Rules
- [ ] Test 7: Statistiche

**Note**: 
_________________________________________________
_________________________________________________

---

## 🎯 Prossimi Passi

- [ ] Se tutti i test PASS → ✅ Pronto per produzione
- [ ] Se alcuni test FAIL → Documentare problemi e correggere

---

**Vedi guida completa**: `GUIDA_TEST_MANUALI_PRATICA.md`
