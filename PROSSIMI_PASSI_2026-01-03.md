# 🎯 Prossimi Passi - GFV Platform

**Data Creazione**: 2026-01-03  
**Stato Attuale**: Standardizzazione Servizi Completata ✅

---

## ✅ Completato Oggi (2026-01-03)

- ✅ **Standardizzazione Servizi**: Completata migrazione di tutti i file a `service-helper.js`
  - FASE 2 Macchine: `segnatura-ore-standalone.html` migrato
  - FASE 3 Terreni: `attivita-controller.js`, `dashboard-maps.js`, `terreni-clienti-standalone.html` migrati
- ✅ **Fix Indice Composito Firestore**: Gestione automatica con filtro lato client
- ✅ **Fix Campo Coltura**: Precompilazione automatica nel diario attività
- ✅ **Fix Dashboard Maps**: Dependencies corrette

---

## 🔴 PRIORITÀ ALTA (Da Fare Subito)

### 1. Test Completamento Standardizzazione ⏳

**Obiettivo**: Verificare che tutte le migrazioni funzionino correttamente.

**Test da Eseguire**:
- [x] **Test Segnatura Ore** (`core/segnatura-ore-standalone.html`) ✅ **COMPLETATO**
  - Login come `operaio` o `caposquadra` ✅
  - Verificare che dropdown "Macchina" si popoli ✅
  - Verificare che dropdown "Attrezzo" si popoli dopo selezione trattore ✅
  - Controllare console per errori ✅
  - **Flusso completo testato**: Lavoro → Segnatura → Validazione → Alert manutenzione ✅

- [x] **Test Attività** (`core/attivita-standalone.html`) ✅ **COMPLETATO**
  - Verificare che dropdown terreni si popoli ✅
  - Selezionare un terreno e verificare che `coltura` si precompili automaticamente ✅
  - Verificare che categoria coltura si precompili ✅

- [x] **Test Dashboard Maps** (`core/dashboard-standalone.html`) ✅ **COMPLETATO**
  - Verificare che mappa aziendale carichi i terreni ✅
  - Verificare che zone lavorate si visualizzino ✅
  - Controllare console per errori ✅

- [x] **Test Terreni Clienti** (`modules/conto-terzi/views/terreni-clienti-standalone.html`) ✅ **COMPLETATO**
  - Selezionare un cliente ✅
  - Verificare che lista terreni del cliente si carichi ✅
  - Verificare ordinamento per nome ✅
  - Filtro clienti funziona correttamente ✅

**Documento Riferimento**: `TEST_STANDARDIZZAZIONE_SERVIZI.md`

---

### 2. Fix Verifica Uso Terreno Prima di Eliminare 🔴

**File**: `core/services/terreni-service.js:169`  
**Priorità**: Alta  
**Problema**: Eliminando un terreno usato in attività, si creano riferimenti orfani.

**Cosa Fare**:
- [ ] Verificare se esistono attività collegate al terreno prima di eliminare
- [ ] Mostrare avviso se ci sono attività collegate
- [ ] Opzione: eliminare anche le attività collegate (con conferma esplicita)

**Documento Riferimento**: `AUDIT_REPORT.md` (TODO #2)

---

## 🟡 PRIORITÀ MEDIA (1-2 Settimane)

### 3. Refactoring Moduli Rimanenti ⏳

**Obiettivo**: Estrarre logica JavaScript inline dai file HTML in moduli separati.

**File da Refactorizzare** (in ordine di priorità):

#### 3.1. Core Base
- [x] `core/attivita-standalone.html` ✅ **GIÀ REFACTORIZZATO**
  - Ha 4 moduli estratti (`attivita-controller.js`, `attivita-events.js`, `attivita-utils.js`, `attivita-maps.js`)
  - Riduzione: 5649 → 2936 righe (-48%)
  - Ha ancora ~48 funzioni inline (wrapper e inizializzazione) - **Accettabile**

- [x] `core/statistiche-standalone.html` ✅ **GIÀ REFACTORIZZATO**
  - Ha 4 moduli estratti (`statistiche-controller.js`, `statistiche-utils.js`, `statistiche-charts.js`, `statistiche-events.js`)
  - Riduzione: 2380 → ~1100 righe (-54%)
  - Ha ancora ~58 funzioni inline (wrapper e inizializzazione) - **Accettabile**

- [ ] `core/segnatura-ore-standalone.html` - **MEDIA PRIORITÀ**
  - Ha ancora ~11 funzioni inline
  - File relativamente semplice, potrebbe non essere prioritario

- [ ] `core/admin/impostazioni-standalone.html` - **BASSA PRIORITÀ**
  - Ha ancora ~55 funzioni inline
  - File complesso ma funziona
  - File di configurazione, potrebbe essere lasciato così

#### 3.2. Modulo Manodopera (7 file)
- [ ] `core/admin/gestione-operai-standalone.html` (~13 funzioni inline)
- [ ] `core/admin/gestione-squadre-standalone.html` (~13 funzioni inline)
- [ ] `core/admin/compensi-operai-standalone.html` (~11 funzioni inline)
- [ ] `core/admin/validazione-ore-standalone.html` (~10 funzioni inline) - già verificato, non necessita migrazione terreni/macchine
- [ ] `core/admin/lavori-caposquadra-standalone.html` (~11 funzioni inline stimato)
- [ ] `core/admin/statistiche-manodopera-standalone.html` (~15 funzioni inline stimato)
- [ ] `core/admin/segnalazione-guasti-standalone.html` / `gestione-guasti-standalone.html` (~15-20 funzioni inline stimato)

#### 3.3. Modulo Conto Terzi (8 file)
- [ ] `modules/conto-terzi/views/preventivi-standalone.html` (~20 funzioni inline stimato)
- [ ] `modules/conto-terzi/views/nuovo-preventivo-standalone.html` (~25 funzioni inline stimato)
- [ ] `modules/conto-terzi/views/tariffe-standalone.html` (~15 funzioni inline stimato)
- [ ] `modules/conto-terzi/views/terreni-clienti-standalone.html` (~20 funzioni inline stimato)
- [ ] `modules/conto-terzi/views/clienti-standalone.html` (~15 funzioni inline stimato)
- [ ] `modules/conto-terzi/views/mappa-clienti-standalone.html` (~15 funzioni inline stimato)
- [ ] `modules/conto-terzi/views/conto-terzi-home-standalone.html` (~10 funzioni inline stimato)
- [ ] `modules/conto-terzi/views/accetta-preventivo-standalone.html` (~10 funzioni inline stimato)

**Pattern da Seguire**: `GUIDA_REFACTORING_MODULI_RIMANENTI.md`

**Vantaggi**:
- Codice più organizzato e manutenibile
- File HTML più leggibili
- Funzioni riutilizzabili
- Testabilità migliorata

---

### 4. Standardizzare Altri Servizi ⏳

**Obiettivo**: Estendere `service-helper.js` per altri servizi oltre a macchine e terreni.

**Servizi da Standardizzare**:
- [ ] **Operai** (`operai-service.js`)
  - Creare `loadOperaiViaService` in `service-helper.js`
  - Migrare file che caricano operai direttamente

- [ ] **Squadre** (`squadre-service.js`)
  - Creare `loadSquadreViaService` in `service-helper.js`
  - Migrare file che caricano squadre direttamente

- [ ] **Clienti** (se esiste servizio)
  - Verificare se esiste `clienti-service.js`
  - Se sì, standardizzare

**Pattern da Seguire**: Stesso pattern usato per `loadMacchineViaService` e `loadTerreniViaService`

---

### 5. Fix Reset Password 🔴

**File**: `core/auth/login.html`, `core/auth/login-standalone.html`  
**Priorità**: Media  
**Stato**: Funzionalità mancante (mostra solo messaggio "in arrivo")

**Cosa Fare**:
- [ ] Implementare reset password usando `sendPasswordResetEmail` di Firebase Auth
- [ ] Aggiungere form per inserire email
- [ ] Mostrare messaggio di conferma dopo invio
- [ ] Gestire errori (email non trovata, etc.)

**Documento Riferimento**: `AUDIT_REPORT.md` (TODO #1)

---

### 6. Standardizzare Error Handling 🟡

**Problema**: Comportamento inconsistente tra servizi (alcuni ritornano `[]`, altri `0` in caso di errore).

**Cosa Fare**:
- [ ] Standardizzare comportamento errori in tutti i servizi
- [ ] Documentare comportamento errori
- [ ] Implementare logging strutturato
- [ ] Considerare di lanciare errori invece di nasconderli

**File da Modificare**:
- `core/services/statistiche-service.js` (priorità alta - già identificato)
- Altri servizi (verificare)

**Documento Riferimento**: `AUDIT_REPORT.md` (Bug #1)

---

## 🟢 PRIORITÀ BASSA (1 Mese)

### 7. Ottimizzazioni Performance 🟢

**Obiettivo**: Migliorare performance dell'applicazione.

**Task**:
- [ ] Implementare cache nei servizi
- [ ] Implementare real-time updates (se necessario)
- [ ] Ottimizzare query Firestore
- [ ] Code splitting per moduli
- [ ] Lazy loading moduli opzionali
- [ ] Tree shaking

**Documento Riferimento**: `PIANO_STANDARDIZZAZIONE_SERVIZI.md` (Prossimi Passi)

---

### 8. Completare Funzionalità Abbonamento 🟢

**File**: `core/admin/abbonamento-standalone.html`  
**Priorità**: Bassa  
**Stato**: Funzionalità parzialmente implementata

**Cosa Fare**:
- [ ] Implementare cambio piano
- [ ] Implementare attivazione/disattivazione moduli
- [ ] Caricare dati reali da Firestore

**Documento Riferimento**: `AUDIT_REPORT.md` (TODO #3)

---

### 9. Testing e Documentazione 🟢

**Task**:
- [ ] Aggiungere test unitari per helper
- [ ] Aggiungere test integrazione per servizi
- [ ] Aggiungere test E2E per flussi critici
- [ ] JSDoc per tutte le funzioni principali
- [ ] README per ogni modulo
- [ ] Guide per sviluppatori
- [ ] Documentazione API centralizzata

---

### 10. Security Rules Deployment 🔴

**Priorità**: Critica (prima della produzione)

**Task**:
- [ ] Testare isolamento multi-tenant
- [ ] Verificare permessi ruoli
- [ ] Deploy rules se necessario
- [ ] Validazione input lato server
- [ ] Sanitizzare input per XSS

**Documento Riferimento**: `ANALISI_COMPLETA_APP.md` (Raccomandazioni Prioritarie)

---

## 📊 Riepilogo Priorità

### 🔴 Da Fare Subito
1. **Test Completamento Standardizzazione** - Verificare che tutto funzioni
2. **Fix Verifica Uso Terreno** - Protezione dati

### 🟡 1-2 Settimane
3. **Refactoring Moduli Rimanenti** - Organizzazione codice
4. **Standardizzare Altri Servizi** - Estendere pattern
5. **Fix Reset Password** - Funzionalità mancante
6. **Standardizzare Error Handling** - Coerenza

### 🟢 1 Mese
7. **Ottimizzazioni Performance** - Miglioramenti
8. **Completare Abbonamento** - Feature futura
9. **Testing e Documentazione** - Qualità
10. **Security Rules Deployment** - Sicurezza produzione

---

## 📝 Note

- **Standardizzazione Servizi**: ✅ Completata per macchine e terreni
- **Pattern Stabilito**: `service-helper.js` è il pattern da seguire per tutti i servizi
- **Refactoring**: Pattern già stabilito in `GUIDA_REFACTORING_MODULI_RIMANENTI.md`
- **Documentazione**: Tutti i documenti aggiornati con data 2026-01-03

---

**Prossimo Step Consigliato**: Eseguire i test di completamento standardizzazione per verificare che tutto funzioni correttamente.
