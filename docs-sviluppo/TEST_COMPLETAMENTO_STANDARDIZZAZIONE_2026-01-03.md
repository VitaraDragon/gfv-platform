# 🧪 Test Completamento Standardizzazione Servizi - 2026-01-03

**Data Test**: 2026-01-03  
**Obiettivo**: Verificare che tutte le migrazioni a `service-helper.js` funzionino correttamente

---

## 📋 Pre-Test

- [x] Server locale attivo (`http://localhost:8000/`)
- [ ] Browser aperto con console sviluppatore (F12)
- [ ] Utente autenticato nell'applicazione

---

## ✅ Test 1: Segnatura Ore - Macchine

**File**: `core/segnatura-ore-standalone.html`  
**URL**: `http://localhost:8000/core/segnatura-ore-standalone.html`

### Requisiti
- Login come `operaio` o `caposquadra`
- Modulo Parco Macchine attivo

### Procedura

1. **Apri la pagina**
   - Naviga a `http://localhost:8000/core/segnatura-ore-standalone.html`
   - Verifica che la pagina si carichi senza errori

2. **Apri Console (F12)**
   - Controlla che non ci siano errori in rosso
   - Cerca eventuali errori relativi a `service-helper.js` o `loadMacchineViaService`

3. **Test Dropdown Macchina**
   - Clicca su "Segna Nuova Ora" o "Aggiungi Ora"
   - Verifica che il dropdown "Macchina" (o "Trattore") si popoli
   - Verifica che le macchine siano ordinate per nome (A-Z)

4. **Test Dropdown Attrezzo**
   - Seleziona un trattore dal dropdown "Macchina"
   - Verifica che il dropdown "Attrezzo" appaia
   - Verifica che si popoli con attrezzi compatibili con il trattore selezionato
   - Verifica che solo attrezzi compatibili siano mostrati

### Risultato Atteso
- ✅ Pagina si carica senza errori
- ✅ Nessun errore in console
- ✅ Dropdown "Macchina" popolato correttamente
- ✅ Dropdown "Attrezzo" popolato dopo selezione trattore
- ✅ Solo attrezzi compatibili mostrati

### Errori da Cercare
- ❌ `ReferenceError: loadMacchineViaService is not defined`
- ❌ `Failed to load module: service-helper.js`
- ❌ `Errore caricamento macchine: ...`
- ❌ Dropdown vuoto quando dovrebbe essere popolato

---

## ✅ Test 2: Diario Attività - Terreni e Precompilazione Coltura

**File**: `core/attivita-standalone.html`  
**URL**: `http://localhost:8000/core/attivita-standalone.html`

### Requisiti
- Login come qualsiasi ruolo (manager, caposquadra, operaio)
- Almeno un terreno con campo `coltura` popolato

### Procedura

1. **Apri la pagina**
   - Naviga a `http://localhost:8000/core/attivita-standalone.html`
   - Verifica che la pagina si carichi senza errori

2. **Apri Console (F12)**
   - Controlla che non ci siano errori in rosso
   - Cerca eventuali errori relativi a `service-helper.js` o `loadTerreniViaService`

3. **Test Dropdown Terreni**
   - Clicca su "Aggiungi Attività" o "Nuova Attività"
   - Verifica che il dropdown "Terreno" si popoli
   - Verifica che i terreni siano ordinati per nome (A-Z)

4. **Test Precompilazione Coltura** ⭐ **TEST PRINCIPALE**
   - Seleziona un terreno che ha il campo `coltura` popolato
   - **VERIFICA**: Il campo "Coltura" (o dropdown coltura) si precompila automaticamente
   - **VERIFICA**: Il campo "Categoria Coltura" si precompila automaticamente (se applicabile)
   - Verifica che i campi non siano vuoti quando il terreno ha `coltura` definita

5. **Test Modalità Conto Terzi** (se applicabile)
   - Se il modulo Conto Terzi è attivo, verifica che funzioni anche in modalità Conto Terzi
   - Verifica che terreni aziendali e terreni clienti siano caricati correttamente

### Risultato Atteso
- ✅ Pagina si carica senza errori
- ✅ Nessun errore in console
- ✅ Dropdown "Terreno" popolato correttamente
- ✅ **Precompilazione coltura funzionante** ⭐
- ✅ **Precompilazione categoria coltura funzionante** ⭐

### Errori da Cercare
- ❌ `ReferenceError: loadTerreniViaService is not defined`
- ❌ `Failed to load module: service-helper.js`
- ❌ `Errore caricamento terreni: ...`
- ❌ Campo coltura rimane vuoto anche se terreno ha `coltura` popolata
- ❌ `Cannot read property 'coltura' of undefined`

---

## ✅ Test 3: Dashboard - Mappa Aziendale

**File**: `core/dashboard-standalone.html`  
**URL**: `http://localhost:8000/core/dashboard-standalone.html`

### Requisiti
- Login come qualsiasi ruolo
- Almeno un terreno con `polygonCoords` (mappa definita)

### Procedura

1. **Apri la pagina**
   - Naviga a `http://localhost:8000/core/dashboard-standalone.html`
   - Verifica che la dashboard si carichi

2. **Apri Console (F12)**
   - Controlla che non ci siano errori in rosso
   - Cerca eventuali errori relativi a `dashboard-maps.js` o `loadTerreniViaService`

3. **Test Mappa Aziendale**
   - Naviga alla sezione "Mappa Aziendale" (se presente)
   - Verifica che la mappa si carichi
   - Verifica che i terreni con `polygonCoords` siano visualizzati sulla mappa
   - Verifica che i poligoni dei terreni siano disegnati correttamente

4. **Test Zone Lavorate** (se presente)
   - Verifica che le zone lavorate siano visualizzate sulla mappa
   - Verifica che gli indicatori lavori siano visualizzati

### Risultato Atteso
- ✅ Dashboard si carica senza errori
- ✅ Nessun errore in console
- ✅ Mappa aziendale carica i terreni
- ✅ Terreni con mappa visualizzati correttamente
- ✅ Zone lavorate visualizzate (se presenti)

### Errori da Cercare
- ❌ `ReferenceError: collection is not defined` (già fixato, ma verificare)
- ❌ `ReferenceError: getDocs is not defined` (già fixato, ma verificare)
- ❌ `Errore caricamento terreni: ...`
- ❌ Mappa vuota quando dovrebbero esserci terreni
- ❌ `loadMappaAziendale` non funziona

---

## ✅ Test 4: Terreni Clienti - Filtro ClienteId

**File**: `modules/conto-terzi/views/terreni-clienti-standalone.html`  
**URL**: `http://localhost:8000/modules/conto-terzi/views/terreni-clienti-standalone.html`

### Requisiti
- Login come manager o amministratore
- Modulo Conto Terzi attivo
- Almeno un cliente con terreni associati

### Procedura

1. **Apri la pagina**
   - Naviga a `http://localhost:8000/modules/conto-terzi/views/terreni-clienti-standalone.html`
   - Verifica che la pagina si carichi senza errori

2. **Apri Console (F12)**
   - Controlla che non ci siano errori in rosso
   - Cerca eventuali errori relativi a `service-helper.js` o `loadTerreniViaService`
   - **VERIFICA**: Non ci devono essere errori di indice composito Firestore

3. **Test Dropdown Cliente**
   - Verifica che il dropdown "Cliente" si popoli
   - Seleziona un cliente dal dropdown

4. **Test Lista Terreni Cliente**
   - Dopo aver selezionato un cliente, verifica che la lista terreni si carichi
   - **VERIFICA**: Solo i terreni del cliente selezionato sono mostrati
   - **VERIFICA**: I terreni sono ordinati per nome (A-Z)
   - Verifica che non ci siano terreni di altri clienti nella lista

5. **Test Cambio Cliente**
   - Seleziona un altro cliente
   - Verifica che la lista si aggiorni con i terreni del nuovo cliente

### Risultato Atteso
- ✅ Pagina si carica senza errori
- ✅ Nessun errore in console
- ✅ **Nessun errore indice composito Firestore** ⭐
- ✅ Dropdown cliente popolato
- ✅ Lista terreni filtrata per cliente
- ✅ Terreni ordinati per nome
- ✅ Solo terreni del cliente selezionato mostrati

### Errori da Cercare
- ❌ `FirebaseError: The query requires an index` (già fixato, ma verificare)
- ❌ `ReferenceError: loadTerreniViaService is not defined`
- ❌ `Failed to load module: service-helper.js`
- ❌ `Errore caricamento terreni: ...`
- ❌ Terreni di tutti i clienti mostrati invece di solo quelli del cliente selezionato
- ❌ Terreni non ordinati per nome

---

## 📊 Riepilogo Test

### Checklist Completamento

- [x] **Test 1**: Segnatura Ore - Macchine ✅ **COMPLETATO**
- [x] **Test 2**: Diario Attività - Terreni e Precompilazione Coltura ✅
- [x] **Test 3**: Dashboard - Mappa Aziendale ✅
- [x] **Test 4**: Terreni Clienti - Filtro ClienteId ✅

### Risultati

| Test | Stato | Note |
|------|-------|------|
| Test 1: Segnatura Ore | ✅ | **Funziona correttamente** - Flusso completo testato (lavoro → segnatura → validazione → alert manutenzione) |
| Test 2: Diario Attività | ✅ | Funziona correttamente |
| Test 3: Dashboard Maps | ✅ | Corretto |
| Test 4: Terreni Clienti | ✅ | Filtro clienti funziona correttamente |

---

## 🔍 Verifica Codice (Pre-Test)

Prima di eseguire i test, verifica che:

- [x] `core/segnatura-ore-standalone.html` usa `loadMacchineViaService`
- [x] `core/js/attivita-controller.js` usa `loadTerreniViaService`
- [x] `core/js/dashboard-maps.js` usa `loadTerreniViaService`
- [x] `modules/conto-terzi/views/terreni-clienti-standalone.html` usa `loadTerreniViaService`
- [x] `core/models/Terreno.js` ha campo `coltura`
- [x] `core/services/terreni-service.js` gestisce filtro lato client per `clienteId`
- [x] `core/services/service-helper.js` ha converter migliorato per `coltura`

---

## 📝 Note

- **Test Critici**: Test 2 (precompilazione coltura) e Test 4 (filtro clienteId) sono i più importanti
- **Console**: Controlla sempre la console per errori JavaScript
- **Network Tab**: Se ci sono errori 404, controlla il tab Network per vedere quali file non vengono caricati
- **Firestore**: Se ci sono errori Firestore, verifica che le regole di sicurezza permettano le query necessarie

---

## ✅ Se Tutti i Test Passano

Se tutti i test passano, la standardizzazione è **completata con successo**! ✅

Puoi procedere con:
- Fix verifica uso terreno prima di eliminare
- Refactoring moduli rimanenti
- Standardizzazione altri servizi

---

## ❌ Se Alcuni Test Falliscono

Se alcuni test falliscono:
1. Controlla la console per errori specifici
2. Verifica che il codice sia stato migrato correttamente
3. Verifica che i percorsi di import siano corretti
4. Verifica che Firebase sia configurato correttamente
5. Controlla che i dati di test esistano (terreni con coltura, clienti con terreni, etc.)

---

**Data Test**: 2026-01-03  
**Eseguito da**: Pier  
**Risultato**: ✅ **COMPLETATO** - Tutti i test passati con successo!

### Dettagli Test Segnatura Ore
- ✅ Creazione lavoro e assegnazione all'operaio
- ✅ Segnatura ore da parte dell'operaio (trattorista)
- ✅ Comunicazione ore al manager
- ✅ Validazione ore da parte del manager
- ✅ Tracciamento zona lavorata (visibile in dashboard)
- ✅ Ore validate visibili dall'operaio dopo validazione
- ✅ Alert superamento soglia ore manutenzione trattore/attrezzo funzionante
