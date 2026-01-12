# 🧪 Guida Test Multi-Tenant Membership

**Data**: 2026-01-11  
**Stato**: Pronto per test

---

## ✅ Prerequisiti Completati

- [x] Migrazione dati completata (13 utenti migrati)
- [x] Backup Firestore salvato (`backups/backup-2026-01-11`)
- [x] Codice multi-tenant implementato
- [x] Security rules aggiornate

---

## 📋 Test da Eseguire

### Test 1: Retrocompatibilità - Login Utente Singolo Tenant

**Obiettivo**: Verificare che utenti migrati possano ancora fare login normalmente

**Passi**:
1. Apri browser e vai a `core/auth/login-standalone.html`
2. Fai login con un utente migrato (es. qualsiasi utente esistente)
3. Verifica:
   - [ ] Login funziona senza errori
   - [ ] Nessun selettore tenant viene mostrato (utente ha un solo tenant)
   - [ ] Dashboard carica correttamente
   - [ ] `getCurrentTenantId()` restituisce il tenant corretto
   - [ ] Nessun errore in console browser

**Utenti di test disponibili**:
- Qualsiasi utente esistente (tutti hanno un solo tenant dopo migrazione)

**Risultato atteso**: ✅ Login funziona normalmente, nessun cambiamento visibile per utente

---

### Test 2: Multi-Tenant - Login Utente con Più Tenant

**Obiettivo**: Verificare che un utente con più tenant possa selezionare il tenant al login

**Setup necessario**:
1. Crea un invito per un utente esistente a un nuovo tenant (vedi Test 3)
2. Oppure modifica manualmente un utente in Firestore per aggiungere un secondo tenant

**Passi**:
1. Apri browser e vai a `core/auth/login-standalone.html`
2. Fai login con un utente che ha 2+ tenant
3. Verifica:
   - [ ] Dopo login, viene mostrato selettore tenant (modal)
   - [ ] Selettore mostra tutti i tenant disponibili
   - [ ] Ogni tenant mostra nome e ruoli
   - [ ] Selezione tenant funziona
   - [ ] Dopo selezione, redirect a dashboard
   - [ ] Dashboard mostra dati del tenant selezionato

**Risultato atteso**: ✅ Selettore tenant funziona correttamente

---

### Test 3: Invito Utente Esistente a Nuovo Tenant

**Obiettivo**: Verificare che un utente esistente possa essere invitato a un nuovo tenant

**Setup**:
- Utente A: già registrato con tenant "Sabbie Gialle"
- Admin di tenant "rosso": invita email di Utente A

**Passi**:
1. **Come Admin di "rosso"**:
   - Vai a `core/admin/gestisci-utenti-standalone.html`
   - Clicca "Invita Utente"
   - Inserisci email di un utente esistente (es. utente di "Sabbie Gialle")
   - Seleziona ruoli (es. "caposquadra")
   - Invia invito
   - Verifica:
     - [ ] Messaggio informativo: "Utente esistente: verrà aggiunto a questa azienda"
     - [ ] Invito creato con `isExistingUser: true`
     - [ ] Email inviata correttamente

2. **Come Utente invitato**:
   - Apri link invito dalla email
   - Vai a pagina registrazione
   - Verifica:
     - [ ] Messaggio: "Utente esistente: inserisci la tua password"
     - [ ] Campo password richiesto
   - Inserisci password esistente
   - Completa registrazione
   - Verifica:
     - [ ] Messaggio successo: "Aggiunto a nuova azienda con successo!"
     - [ ] Login automatico funziona
     - [ ] Utente ora ha 2 tenant

3. **Verifica in Firestore**:
   - Apri Firebase Console > Firestore > `users/{userId}`
   - Verifica:
     - [ ] `tenantMemberships` contiene entrambi i tenant
     - [ ] Nuovo tenant ha `tenantIdPredefinito: false`
     - [ ] Vecchio tenant ha `tenantIdPredefinito: true`

**Risultato atteso**: ✅ Utente esistente può essere aggiunto a nuovo tenant

---

### Test 4: Switch Tenant dalla Dashboard

**Obiettivo**: Verificare che utente multi-tenant possa cambiare tenant attivo

**Setup**: Utente con 2+ tenant (dopo Test 3)

**Passi**:
1. Fai login con utente multi-tenant
2. Vai a dashboard (`core/dashboard-standalone.html`)
3. Verifica:
   - [ ] Pulsante "Cambia Azienda" visibile nell'header
   - [ ] Pulsante mostra nome tenant corrente
4. Clicca "Cambia Azienda"
5. Verifica:
   - [ ] Selettore tenant viene mostrato
   - [ ] Lista mostra tutti i tenant disponibili
6. Seleziona un tenant diverso
7. Verifica:
   - [ ] Pagina si ricarica
   - [ ] Dashboard mostra dati del nuovo tenant
   - [ ] `getCurrentTenantId()` restituisce nuovo tenant
   - [ ] Dati corretti per nuovo tenant (terreni, lavori, ecc.)

**Risultato atteso**: ✅ Switch tenant funziona correttamente

---

### Test 5: Security Rules - Isolamento Dati

**Obiettivo**: Verificare che utente di Tenant A non possa accedere a dati di Tenant B

**Setup**:
- Utente A: `tenantMemberships: { "Sabbie Gialle": {...} }`
- Utente B: `tenantMemberships: { "rosso": {...} }`

**Passi**:
1. **Login come Utente A** (tenant "Sabbie Gialle")
2. Apri console browser (F12)
3. Prova a leggere dati di "rosso":
   ```javascript
   // In console browser
   import { getFirestore, collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
   const db = getFirestore();
   const q = query(collection(db, 'tenants/rosso/terreni'));
   const snapshot = await getDocs(q);
   console.log('Terreni rosso:', snapshot.size);
   ```
4. Verifica:
   - [ ] Query viene bloccata da security rules
   - [ ] Errore: "Missing or insufficient permissions"
   - [ ] Nessun dato di "rosso" visibile

5. **Verifica accesso ai propri dati**:
   - Prova a leggere dati di "Sabbie Gialle"
   - Verifica:
     - [ ] Query funziona correttamente
     - [ ] Dati visibili

**Risultato atteso**: ✅ Security rules bloccano accesso cross-tenant

---

## 🐛 Problemi Comuni

### Selettore tenant non appare
- **Causa**: Utente ha solo un tenant
- **Soluzione**: Aggiungi un secondo tenant tramite invito (Test 3)

### Errore "Non hai accesso a questo tenant"
- **Causa**: Security rules bloccano accesso
- **Soluzione**: Verifica che `tenantMemberships[tenantId].stato === 'attivo'`

### Dashboard non carica dati
- **Causa**: `getCurrentTenantId()` restituisce null
- **Soluzione**: Verifica che tenant sia impostato in `sessionStorage`

---

## 📊 Checklist Test

- [ ] Test 1: Retrocompatibilità login
- [ ] Test 2: Multi-tenant login
- [ ] Test 3: Invito utente esistente
- [ ] Test 4: Switch tenant
- [ ] Test 5: Security rules isolamento

---

## 📝 Note

- Tutti i test richiedono esecuzione manuale su browser
- Verifica console browser per errori JavaScript
- Verifica Network tab per errori Firestore
- Verifica Firebase Console per errori Security Rules

---

## 🔄 Dopo i Test

1. Documentare eventuali problemi trovati
2. Correggere problemi
3. Ripetere test se necessario
4. Deploy security rules
5. Deploy codice
