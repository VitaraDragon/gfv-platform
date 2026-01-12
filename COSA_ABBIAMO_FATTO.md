# 📋 Cosa Abbiamo Fatto - Riepilogo Core

## ✅ Fix Precompilazione Coltura nei Preventivi (2026-01-05) - COMPLETATO

### Obiettivo
Risolvere il problema del dropdown coltura che rimaneva vuoto quando si selezionava un terreno nel form di creazione preventivo, nonostante dovesse essere precompilato automaticamente con i dati del terreno.

### Implementazione

#### 1. Rendere Variabile Colture Globale ✅
- **Problema**: `colturePerCategoriaPreventivo` era una variabile locale non sempre accessibile quando necessario
- **Causa**: La variabile era dichiarata con `let` nello scope locale, causando problemi di accesso tra funzioni
- **Soluzione**: 
  - Resa la variabile globale come `window.colturePerCategoriaPreventivo` (allineata con `attivita-standalone.html`)
  - Aggiornate tutte le funzioni per usare la variabile globale
  - Mantenuta anche la variabile locale per retrocompatibilità
- **File Modificati**:
  - ✅ `modules/conto-terzi/views/nuovo-preventivo-standalone.html` - Resa variabile globale e aggiornate tutte le referenze

#### 2. Migliorata Logica di Precompilazione Coltura ✅
- **Problema**: La coltura del terreno non veniva trovata o precompilata correttamente
- **Causa**: 
  - Le colture potevano non essere ancora caricate quando si selezionava il terreno
  - La ricerca della categoria non usava il servizio centralizzato
  - Mismatch tra ID categoria del terreno e chiavi disponibili
- **Soluzione**: 
  - Aggiunto controllo per verificare che le colture siano caricate prima di procedere
  - Implementato uso del servizio `getColturaByNome` per trovare la categoria (come in `attivita-standalone.html`)
  - Aggiunto fallback per cercare la coltura in tutte le categorie disponibili
  - Verifica che la categoria esista nel dropdown prima di usarla
  - Meccanismo di polling per attendere che il dropdown sia popolato prima di selezionare la coltura
- **File Modificati**:
  - ✅ `modules/conto-terzi/views/nuovo-preventivo-standalone.html` - Migliorata funzione `onTerrenoChange()` con logica robusta

#### 3. Migliorata Funzione updateColtureDropdownPreventivo ✅
- **Problema**: Il dropdown colture non veniva popolato correttamente quando cambiava la categoria
- **Causa**: 
  - Mancava verifica che le colture fossero caricate
  - Non gestiva correttamente il caso di categorie senza colture
  - Non ordinava le colture per nome
- **Soluzione**: 
  - Aggiunta verifica che `colturePerCategoriaPreventivo` sia popolato
  - Gestione caso categorie senza colture
  - Ordinamento colture per nome
  - Uso della variabile globale per accesso sicuro
- **File Modificati**:
  - ✅ `modules/conto-terzi/views/nuovo-preventivo-standalone.html` - Migliorata funzione `updateColtureDropdownPreventivo()`

#### 4. Aggiunti Log Dettagliati per Debug ✅
- **Obiettivo**: Facilitare il debug di problemi futuri
- **Implementazione**: 
  - Aggiunti log dettagliati in tutte le funzioni chiave:
    - `onTerrenoChange()` - Log per tracciare selezione terreno e precompilazione
    - `updateColtureDropdownPreventivo()` - Log per tracciare popolamento dropdown
    - `loadColturePerCategoriaPreventivo()` - Log per tracciare caricamento colture
    - `loadColture()` - Log per tracciare completamento caricamento
  - Log con emoji per identificazione rapida (🔵, 🟢, 🟡, ✅, ⚠️, ❌)
- **File Modificati**:
  - ✅ `modules/conto-terzi/views/nuovo-preventivo-standalone.html` - Aggiunti log in tutte le funzioni chiave

### Test Completati
- ✅ **Precompilazione Superficie**: Funziona correttamente quando si seleziona un terreno
- ✅ **Precompilazione Tipo Campo**: Funziona correttamente quando si seleziona un terreno
- ✅ **Precompilazione Categoria Coltura**: La categoria viene selezionata automaticamente
- ✅ **Precompilazione Coltura**: Il dropdown viene popolato e la coltura viene selezionata automaticamente
- ✅ **Gestione Colture Non Caricate**: Se le colture non sono caricate, vengono caricate automaticamente
- ✅ **Gestione Categoria Non Trovata**: Se la categoria non è trovata, viene cercata in tutte le categorie disponibili

### File Modificati
- ✅ `modules/conto-terzi/views/nuovo-preventivo-standalone.html`
  - Resa variabile `colturePerCategoriaPreventivo` globale
  - Migliorata funzione `onTerrenoChange()` con logica robusta
  - Migliorata funzione `updateColtureDropdownPreventivo()`
  - Aggiunti log dettagliati per debug
  - Aggiunto uso servizio `getColturaByNome` per trovare categoria
  - Aggiunto meccanismo di polling per attendere popolamento dropdown

### Note Tecniche
- La soluzione è allineata con l'implementazione in `attivita-standalone.html` per coerenza
- I log di debug sono stati mantenuti per facilitare troubleshooting futuro
- La variabile globale garantisce accesso sicuro da tutte le funzioni

---

## ✅ Fix Caricamento Ore per Operaio e Duplicazioni in Dettaglio Lavori (2026-01-05) - COMPLETATO

### Obiettivo
Risolvere il problema della sezione "Ore per Operaio" che rimaneva in caricamento nella tab Panoramica dei dettagli lavoro, e correggere le duplicazioni delle statistiche quando si cambiava tab.

### Implementazione

#### 1. Aggiunta Sezione "Ore per Operaio" nella Panoramica ✅
- **Problema**: La sezione "Ore per Operaio" nella tab Panoramica rimaneva in caricamento e non mostrava i dati
- **Causa**: La funzione `loadDettaglioOverview` caricava solo i totali delle ore ma non raggruppava per operaio né caricava i nomi degli operai
- **Soluzione**: 
  - Aggiunta logica per raggruppare le ore per operaio (validate, da validare, rifiutate)
  - Aggiunto caricamento dei nomi degli operai dal database
  - Aggiunta sezione "Ore per Operaio" nell'HTML della Panoramica con lo stesso formato della tab "Ore"
- **File Modificati**:
  - ✅ `core/admin/js/gestione-lavori-controller.js` - Modificata `loadDettaglioOverview` per includere raggruppamento ore per operaio e caricamento nomi

#### 2. Risolto Problema Duplicazione Statistiche ✅
- **Problema**: Quando si apriva la tab "Ore" e poi si tornava alla "Panoramica", le statistiche venivano duplicate
- **Causa**: `loadDettaglioOverview` veniva chiamata due volte: una da `switchTab` e una direttamente da `openDettaglioModal`
- **Soluzione**: 
  - Rimossa la chiamata ridondante in `openDettaglioModal` (switchTab già chiama loadDettaglioOverview)
  - Aggiunto flag `isLoadingOverview` per evitare chiamate multiple simultanee
  - Migliorata pulizia del container prima di ogni caricamento
- **File Modificati**:
  - ✅ `core/admin/js/gestione-lavori-events.js` - Rimossa chiamata ridondante in `openDettaglioModal`
  - ✅ `core/admin/js/gestione-lavori-controller.js` - Aggiunto flag per evitare chiamate multiple

#### 3. Risolto Problema Scritta "Caricamento statistiche ore..." ✅
- **Problema**: La scritta "Caricamento statistiche ore..." rimaneva visibile anche dopo il caricamento
- **Causa**: Problema con la visibilità dei tab e gestione del container
- **Soluzione**: 
  - Migliorata gestione della visibilità dei tab (display: none/block)
  - Aggiunta pulizia completa del container prima di ogni caricamento
  - Rimossa doppia chiamata che causava problemi di timing
- **File Modificati**:
  - ✅ `core/admin/js/gestione-lavori-events.js` - Migliorata gestione visibilità tab in `switchTab`
  - ✅ `core/admin/js/gestione-lavori-controller.js` - Migliorata pulizia container

#### 4. Rimozione Simbolo "Poligono" dalla Lista Zone ✅
- **Problema**: Il simbolo "Poligono" nella lista delle zone lavorate era ridondante e confuso
- **Soluzione**: Rimosso l'indicatore del tipo di zona (poligono/segmento) dalla lista
- **File Modificati**:
  - ✅ `core/admin/js/gestione-lavori-maps.js` - Rimossa riga che mostrava "🔷 Poligono" o "📏 Segmento"

### Test Completati
- ✅ **Sezione Ore per Operaio**: Si carica correttamente nella tab Panoramica
- ✅ **Nessuna duplicazione**: Le statistiche non si duplicano più quando si cambia tab
- ✅ **Scritta caricamento**: Non rimane più visibile dopo il caricamento
- ✅ **Lista zone**: Più pulita senza simbolo "Poligono"

### Risultato
- ✅ **Problema caricamento risolto**: La sezione "Ore per Operaio" si carica correttamente nella Panoramica
- ✅ **Problema duplicazione risolto**: Le statistiche non si duplicano più
- ✅ **Problema scritta risolto**: La scritta di caricamento non rimane più visibile
- ✅ **UI migliorata**: Lista zone più pulita senza simboli ridondanti
- ✅ **Codice pulito**: Tutti i log di debug rimossi

---

## ✅ Fix Dropdown Attrezzi e Tipo Assegnazione in Gestione Lavori (2026-01-03) - COMPLETATO

### Obiettivo
Risolvere il problema del dropdown attrezzi che non compariva quando si selezionava un trattore nel modulo conto terzi, e correggere il problema del tipo di assegnazione dove il caposquadra rimaneva obbligatorio anche per lavori autonomi.

### Implementazione

#### 1. Fix Dropdown Attrezzi Non Visibile ✅
- **Problema**: Quando si creava un lavoro nel modulo conto terzi e si selezionava un trattore, il dropdown degli attrezzi non compariva
- **Causa**: `setupMacchineHandlers` non veniva chiamato quando il modal veniva aperto, quindi il listener sul cambio del trattore non era configurato
- **Soluzione**: 
  - Aggiunto `MutationObserver` che monitora quando il modal lavoro diventa attivo
  - Quando il modal diventa attivo, vengono configurati automaticamente sia `setupTipoAssegnazioneHandlers` che `setupMacchineHandlers`
  - Questo garantisce che gli handler siano sempre configurati, indipendentemente da come viene aperto il modal
- **File Modificati**:
  - ✅ `core/admin/gestione-lavori-standalone.html` - Aggiunto MutationObserver per configurare handler quando modal diventa attivo
  - ✅ `core/admin/js/gestione-lavori-events.js` - Migliorato `setupMacchineHandlers` per gestire correttamente il cambio trattore

#### 2. Fix Tipo Assegnazione (Caposquadra Obbligatorio) ✅
- **Problema**: Quando si selezionava "Lavoro Autonomo", il caposquadra rimaneva obbligatorio invece di diventare opzionale
- **Causa**: I listener sui radio button venivano persi quando gli elementi venivano clonati o ricreati
- **Soluzione**: 
  - Cambiato approccio da listener diretti sui radio button a event delegation sul form
  - Event delegation funziona anche quando gli elementi vengono clonati o ricreati
  - La funzione `updateVisibility()` riacquista i riferimenti ai radio button ogni volta per essere sicuri
- **File Modificati**:
  - ✅ `core/admin/js/gestione-lavori-events.js` - Modificato `setupTipoAssegnazioneHandlers` per usare event delegation sul form

#### 3. Pulizia Log di Debug ✅
- **Obiettivo**: Rimuovere tutti i log di debug aggiunti durante il troubleshooting
- **File Modificati**:
  - ✅ `core/admin/gestione-lavori-standalone.html` - Rimossi log da `loadAttrezziWrapper`, `populateTrattoriDropdownWrapper`, `populateAttrezziDropdownWrapper`, `setupMacchineHandlersWrapper`, `openCreaModalWrapper`, e MutationObserver
  - ✅ `core/admin/js/gestione-lavori-events.js` - Rimossi log da `setupTipoAssegnazioneHandlers`, `setupMacchineHandlers`, e `openCreaModal`
  - ✅ `core/admin/js/gestione-lavori-controller.js` - Rimossi log da `populateAttrezziDropdown` e `populateTrattoriDropdown`

### Test Completati
- ✅ **Dropdown attrezzi**: Compare correttamente quando si seleziona un trattore
- ✅ **Tipo assegnazione squadra**: Caposquadra obbligatorio, operaio nascosto
- ✅ **Tipo assegnazione autonomo**: Operaio obbligatorio, caposquadra non obbligatorio e nascosto
- ✅ **Modal observer**: Handler configurati correttamente quando il modal diventa attivo
- ✅ **Event delegation**: Funziona correttamente anche quando gli elementi vengono ricreati

### Risultato
- ✅ **Problema dropdown attrezzi risolto**: Il dropdown ora compare correttamente quando si seleziona un trattore
- ✅ **Problema tipo assegnazione risolto**: Il caposquadra non è più obbligatorio per lavori autonomi
- ✅ **Codice pulito**: Tutti i log di debug rimossi
- ✅ **Robustezza migliorata**: Event delegation garantisce che gli handler funzionino anche quando gli elementi vengono ricreati

---

## ✅ Fix Dropdown Tipi Lavoro Multitenant e Pulizia Log (2026-01-03) - COMPLETATO

### Obiettivo
Risolvere il problema del dropdown tipi di lavoro vuoto durante il test multitenant e pulire i log di debug non necessari.

### Implementazione

#### 1. Fix Dropdown Tipi Lavoro Vuoto ✅
- **Problema**: Il dropdown dei tipi di lavoro specifico rimaneva vuoto dopo aver selezionato categoria principale e sottocategoria
- **Causa**: Il tenant "rosso" non aveva tipi di lavoro inizializzati nella collection `tenants/{tenantId}/tipiLavoro`
- **Soluzione**: 
  - Aggiunto controllo automatico in `loadTipiLavoro()`: se la collection è vuota, inizializza automaticamente i tipi predefiniti
  - La funzione `initializeTipiLavoroPredefiniti()` viene chiamata automaticamente quando necessario
  - Aggiunti log dettagliati per tracciare il flusso (poi rimossi dopo il fix)
- **File Modificati**:
  - ✅ `core/js/attivita-controller.js` - Aggiunto controllo e inizializzazione automatica in `loadTipiLavoro()`
  - ✅ `core/services/tipi-lavoro-service.js` - Migliorati log in `initializeTipiLavoroPredefiniti()` e `getAllTipiLavoro()`
  - ✅ `core/services/firebase-service.js` - Aggiunti log in `getCollectionData()` e `getCollection()` (poi rimossi)

#### 2. Pulizia Log di Debug ✅
- **Obiettivo**: Rimuovere tutti i log di debug non necessari per produzione
- **File Modificati**:
  - ✅ `core/js/attivita-controller.js` - Rimossi log da `loadTipiLavoro()` e `populateTipoLavoroDropdown()`
  - ✅ `core/services/tipi-lavoro-service.js` - Rimossi log da `getAllTipiLavoro()` e `initializeTipiLavoroPredefiniti()`
  - ✅ `core/services/firebase-service.js` - Rimossi log da `getCollectionData()` e `getCollection()`
  - ✅ `core/js/terreni-events.js` - Rimossi log da `handleSaveTerreno()`
  - ✅ `core/js/terreni-maps.js` - Rimossi log da `initMap()`, `toggleDrawing()`, click listener
  - ✅ `core/js/terreni-tour.js` - Rimosso log da tooltip
  - ✅ `core/terreni-standalone.html` - Rimossi log da `updateState()`, `initMapWrapper()`, `toggleDrawingWrapper()`
  - ✅ `core/attivita-standalone.html` - Rimossi log da callback `populateTipoLavoroDropdownCallback`

### Test Completati
- ✅ **Inizializzazione automatica**: 66 tipi di lavoro creati automaticamente per il tenant "rosso"
- ✅ **Dropdown popolato**: Dropdown funziona correttamente per tutte le categorie e sottocategorie
- ✅ **Filtri categoria**: Filtro per categoria principale e sottocategoria funzionante
- ✅ **Salvataggio attività**: Attività salvata con successo con tipo di lavoro selezionato

### Risultato
- ✅ **Problema risolto**: Il dropdown ora si popola correttamente dopo la selezione di categoria/sottocategoria
- ✅ **Codice pulito**: Tutti i log di debug rimossi, mantenuti solo `console.error` per errori critici
- ✅ **Inizializzazione automatica**: I tipi di lavoro vengono inizializzati automaticamente per nuovi tenant

---

## ✅ Test Multitenant e Fix Tracciamento Terreni (2026-01-03) - COMPLETATO

### Obiettivo
Testare il sistema multitenant con nuovo utente e risolvere problemi nel tracciamento e salvataggio dei confini dei terreni.

### Implementazione

#### 1. Fix Tracciamento Confini Terreno ✅
- **Problema**: Click listener sulla mappa non rilevava correttamente lo stato `isDrawing`
- **Causa**: Il listener usava `state.isDrawing` dalla closure invece dello state corrente
- **Soluzione**: 
  - Modificato `initMap()` per accettare parametro `getState` che legge sempre lo state corrente
  - Click listener ora usa `getState()` invece di `state` dalla closure
- **File Modificati**:
  - ✅ `core/js/terreni-maps.js` - Aggiunto parametro `getState`, modificato click listener
  - ✅ `core/terreni-standalone.html` - Modificato `initMapWrapper()` per passare `getState`, rimosso `window.toggleDrawing` duplicato

#### 2. Fix Salvataggio Terreno - Async/Await ✅
- **Problema**: Errore `Cannot use 'in' operator to search for '_delegate' in undefined` durante salvataggio
- **Causa**: `getTerreniCollection()` è async ma veniva chiamata senza `await`, restituendo Promise invece di collection reference
- **Soluzione**: 
  - Aggiunto `await` a tutte le chiamate di `getTerreniCollectionCallback()`
  - Aggiunto controllo per verificare che la collection non sia `null` o `undefined`
- **File Modificati**:
  - ✅ `core/js/terreni-events.js` - Aggiunto `await` in `handleSaveTerreno()` e `handleDeleteTerreno()`

#### 3. Fix Conversione Coordinate Poligono ✅
- **Problema**: Coordinate poligono non venivano salvate correttamente in Firestore
- **Causa**: Oggetti `LatLng` di Google Maps non sono serializzabili direttamente
- **Soluzione**: 
  - Creata funzione helper `getLatLng()` che gestisce sia oggetti `LatLng` (con metodi) che oggetti semplici (con proprietà)
  - Migliorata conversione coordinate per Firestore
  - Aggiunta pulizia dati (rimozione `undefined` e `null`)
- **File Modificati**:
  - ✅ `core/js/terreni-events.js` - Aggiunta funzione `getLatLng()`, migliorata conversione coordinate

#### 4. Aggiunta Log per Debugging ✅
- **File Modificati**:
  - ✅ `core/js/terreni-maps.js` - Log per inizializzazione mappa, click, toggle drawing
  - ✅ `core/js/terreni-events.js` - Log per salvataggio, collection reference, dati
  - ✅ `core/terreni-standalone.html` - Log per updateState, wrapper functions

### Test Completati
- ✅ **Registrazione nuovo utente**: Crea correttamente nuovo tenant con ruolo `amministratore`
- ✅ **Tracciamento confini**: Funziona correttamente, poligono visualizzato sulla mappa
- ✅ **Creazione terreno con poligono**: Terreno salvato correttamente in Firestore con coordinate
- ✅ **Calcolo superficie**: Superficie calcolata automaticamente dal poligono
- ✅ **Permessi Firestore**: Solo manager/admin possono creare terreni (verificato)

### Risultati
- ✅ **3 problemi critici risolti** (tracciamento, salvataggio, conversione coordinate)
- ✅ **Sistema multitenant testato e funzionante**
- ✅ **Log completi** per facilitare debugging futuro
- ✅ **Codice più robusto** con gestione errori migliorata

### Documentazione
- ✅ Creato documento dedicato: `TEST_MULTITENANT_2026-01-03.md` con dettagli completi

---

## ✅ Completamento Standardizzazione Servizi (2026-01-03) - COMPLETATO

### Obiettivo
Completare la standardizzazione dei servizi centralizzati migrando tutti i file rimanenti a usare `service-helper.js` per macchine e terreni, risolvendo problemi di indici Firestore e garantendo che tutti i campi necessari siano disponibili.

### Implementazione

#### 1. Migrazione Segnatura Ore - Macchine ✅
- **File**: `core/segnatura-ore-standalone.html`
- **Modifica**: Sostituita funzione `loadMacchine()` (~70 righe) con versione che usa `loadMacchineViaService` (~15 righe)
- **Risultato**: Codice semplificato, pattern standardizzato, fallback automatico per ambiente `file://`

#### 2. Migrazione Attività - Terreni ✅
- **File**: `core/js/attivita-controller.js`
- **Modifica**: Migrato `loadTerreni()` a usare `loadTerreniViaService`
- **Caratteristiche**:
  - Supporto modalità Conto Terzi (carica terreni aziendali + clienti se necessario)
  - Mantenuta logica di filtraggio lato client per compatibilità
  - Aggiunti parametri `app` e `auth` alla funzione
- **File Modificati**:
  - ✅ `core/js/attivita-controller.js` - Funzione `loadTerreni()` migrata
  - ✅ `core/attivita-standalone.html` - Wrapper aggiornato per passare `app` e `auth`

#### 3. Migrazione Dashboard Maps - Terreni ✅
- **File**: `core/js/dashboard-maps.js`
- **Modifica**: Migrato caricamento terreni a usare `loadTerreniViaService`
- **Fix**: Ripristinati `collection` e `getDocs` nelle dependencies (necessari per funzioni interne)
- **File Modificati**:
  - ✅ `core/js/dashboard-maps.js` - Caricamento terreni migrato, dependencies corrette
  - ✅ `core/dashboard-standalone.html` - Aggiunto `app` alle dependencies

#### 4. Migrazione Terreni Clienti - Terreni ✅
- **File**: `modules/conto-terzi/views/terreni-clienti-standalone.html`
- **Modifica**: Migrato `loadTerreni()` a usare `loadTerreniViaService` con filtro `clienteId`
- **Fix**: Corretto percorso import da `../../../../` a `../../../`
- **Risultato**: Codice semplificato (~30 righe → ~15 righe)

#### 5. Fix Indice Composito Firestore ✅
- **Problema**: Query con filtro `clienteId` + `orderBy` richiedono indice composito Firestore
- **Soluzione**: 
  - Modificato `terreni-service.js` per filtrare/ordinare lato client quando c'è `clienteId`
  - Modificato `fallbackDirectFirestore` in `service-helper.js` per gestire stesso caso
  - Evita necessità di creare indici compositi
- **File Modificati**:
  - ✅ `core/services/terreni-service.js` - Gestione filtro lato client per `clienteId`
  - ✅ `core/services/service-helper.js` - Fallback intelligente per indice composito

#### 6. Fix Campo Coltura - Precompilazione Diario Attività ✅
- **Problema**: Campo `coltura` non disponibile nei terreni caricati, precompilazione non funzionava
- **Causa**: Modello `Terreno` non includeva `coltura` nel costruttore
- **Soluzione**:
  - Aggiunto `coltura` al modello `Terreno` (costruttore e documentazione)
  - Modificato `terreni-service.js` per salvare dati originali come `_originalData`
  - Migliorato converter in `service-helper.js` per preferire dati originali
- **File Modificati**:
  - ✅ `core/models/Terreno.js` - Aggiunto campo `coltura`
  - ✅ `core/services/terreni-service.js` - Salvataggio dati originali
  - ✅ `core/services/service-helper.js` - Converter migliorato per preservare `coltura`

### Risultati
- ✅ **4 file migrati** a usare servizi centralizzati
- ✅ **~150+ righe di codice** rimosse (duplicazione eliminata)
- ✅ **Pattern standardizzato** in tutta l'applicazione
- ✅ **Precompilazione coltura** funzionante nel diario attività
- ✅ **Gestione indici** automatica (evita errori Firestore)
- ✅ **Nessun errore linting**

### Test Completati
- ✅ `core/attivita-standalone.html` - Dropdown terreni e precompilazione coltura funzionanti
- ✅ `core/dashboard-standalone.html` - Mappa aziendale con terreni funzionante
- ✅ `modules/conto-terzi/views/terreni-clienti-standalone.html` - Caricamento terreni cliente funzionante
- ✅ `core/segnatura-ore-standalone.html` - **Flusso completo testato e funzionante**:
  - Creazione lavoro e assegnazione all'operaio ✅
  - Segnatura ore da parte dell'operaio (trattorista) ✅
  - Comunicazione ore al manager ✅
  - Validazione ore da parte del manager ✅
  - Tracciamento zona lavorata (visibile in dashboard) ✅
  - Ore validate visibili dall'operaio dopo validazione ✅
  - Alert superamento soglia ore manutenzione trattore/attrezzo ✅

---

## ✅ Fix Service Worker e Correzioni Moduli Attività (2026-01-03) - COMPLETATO

### Obiettivo
Risolvere errori nel service worker e correggere problemi nei moduli attività relativi a wrapper mancanti e filtri categorie.

### Implementazione

#### 1. Fix Service Worker - Errore "Failed to convert value to 'Response'" ✅
- **Problema**: Service worker restituiva errori "Failed to convert value to 'Response'" per alcune richieste
- **Causa**: Promise che poteva risolvere con `undefined` o errori non gestiti correttamente
- **Soluzione**: 
  - Riscritto handler fetch per garantire sempre una `Response` valida
  - Aggiunto catch finale per gestire tutti i casi edge
  - Verifiche esplicite che ogni risposta sia un'istanza valida di `Response`
  - Gestione corretta fallback cache con risposte di errore valide
- **File Modificati**:
  - ✅ `service-worker.js` - Riscritto handler fetch con gestione errori robusta

#### 2. Fix populateSottocategorieLavoro - Wrapper Mancante ✅
- **Problema**: Errore `Cannot read properties of undefined (reading 'get')` quando si modifica un'attività
- **Causa**: Alla riga 2538 veniva passato `populateSottocategorieLavoroModule` invece del wrapper `populateSottocategorieLavoro`
- **Soluzione**: 
  - Corretto passaggio del wrapper invece del modulo direttamente
  - Il wrapper gestisce correttamente il passaggio di `sottocategorieLavoriMap` al modulo
- **File Modificati**:
  - ✅ `core/attivita-standalone.html` - Corretto passaggio wrapper alla riga 2538

#### 3. Fix populateTrattoriDropdown - Wrapper Mancante ✅
- **Problema**: Errore `macchineList.filter is not a function` quando si modifica un'attività
- **Causa**: Alla riga 2542 veniva passato `populateTrattoriDropdownModule` invece del wrapper `populateTrattoriDropdown`
- **Soluzione**: 
  - Corretto passaggio del wrapper invece del modulo direttamente
  - Il wrapper gestisce correttamente il caso in cui viene chiamato con solo l'ID trattore
  - Corretto anche `populateAttrezziDropdown` per coerenza
- **File Modificati**:
  - ✅ `core/attivita-standalone.html` - Corretto passaggio wrapper alle righe 2542-2543

#### 4. Filtro Categorie di Test - Esclusione "test categoria refactoring" ✅
- **Problema**: Categoria di test "test categoria refactoring" appariva nei dropdown categorie lavori
- **Causa**: Categoria presente nei dati Firestore e caricata senza filtri
- **Soluzione**: 
  - Aggiunto filtro per escludere categorie il cui nome contiene "test" (case-insensitive)
  - Applicato in tutti i punti dove vengono caricate categorie lavori:
    - Core: `attivita-controller.js` (2 posti: file:// e servizio)
    - Admin: `gestione-lavori-controller.js`
    - Conto Terzi: `nuovo-preventivo-standalone.html` (2 posti)
    - Conto Terzi: `tariffe-standalone.html` (2 posti)
- **File Modificati**:
  - ✅ `core/js/attivita-controller.js` - Aggiunto filtro esclusione categorie test
  - ✅ `core/admin/js/gestione-lavori-controller.js` - Aggiunto filtro esclusione categorie test
  - ✅ `modules/conto-terzi/views/nuovo-preventivo-standalone.html` - Aggiunto filtro esclusione categorie test
  - ✅ `modules/conto-terzi/views/tariffe-standalone.html` - Aggiunto filtro esclusione categorie test

### Vantaggi
- ✅ **Service Worker Stabile**: Nessun errore "Failed to convert value to 'Response'"
- ✅ **Modifica Attività Funzionante**: Nessun errore quando si modifica un'attività
- ✅ **Dropdown Puliti**: Categorie di test non appaiono più nei dropdown
- ✅ **Coerenza**: Stesso comportamento in tutti i moduli (core, admin, conto terzi)

### Stato
✅ **COMPLETATO** (2026-01-03)

Il service worker funziona correttamente senza errori, la modifica delle attività funziona senza problemi e le categorie di test sono filtrate in tutti i moduli.

---

## ✅ Fix Logout e Miglioramenti Comunicazione Rapida (2025-12-28) - COMPLETATO

### Obiettivo
Risolvere problemi di logout per account caposquadra e migliorare la funzionalità di comunicazione rapida con feedback all'utente e riepilogo nella dashboard.

### Implementazione

#### 1. Fix Logout Caposquadra ✅
- **Problema**: Errore `ReferenceError: manutenzioniUnsubscribe is not defined` durante il logout
- **Causa**: Variabili `manutenzioniUnsubscribe` e `guastiUnsubscribe` usate ma non dichiarate
- **Soluzione**: 
  - Dichiarate variabili all'inizio dello script module in `dashboard-standalone.html`
  - Inizializzate a `null` per gestire correttamente la pulizia dei listener real-time
- **File Modificati**:
  - ✅ `core/dashboard-standalone.html` - Aggiunte dichiarazioni variabili

#### 2. Miglioramento Comunicazione Rapida ✅
- **Problema**: Comunicazione rapida non mostrava messaggi di errore o successo
- **Soluzione**:
  - Migliorato wrapper `handleSendComunicazioneRapida` con controlli completi
  - Aggiunti messaggi di errore chiari per ogni caso:
    - Utente non autenticato
    - Dati utente non trovati
    - Tenant non trovato
    - Nessun lavoro attivo disponibile
  - Aggiunto logging per debug
  - Migliorata gestione errori nella funzione del modulo
  - Aggiunto logging quando comunicazione viene inviata con successo
- **File Modificati**:
  - ✅ `core/dashboard-standalone.html` - Wrapper migliorato con controlli
  - ✅ `core/js/dashboard-events.js` - Gestione errori migliorata, logging aggiunto

#### 3. Riepilogo Comunicazioni Inviate nella Dashboard Caposquadra ✅
- **Obiettivo**: Mostrare riepilogo comunicazioni inviate con statistiche conferme direttamente nella dashboard
- **Implementazione**:
  - Creata funzione `loadComunicazioniInviateCaposquadra` in `dashboard-data.js`
  - Aggiunta sezione "Comunicazioni Inviate" nella dashboard caposquadra
  - Mostra solo l'ultima comunicazione inviata con:
    - Podere e terreno
    - Data e orario formattati
    - Statistiche conferme colorate (rosso <50%, giallo ≥50%, verde 100%)
    - Badge stato (Attiva/Completata)
    - Link Google Maps se coordinate disponibili
  - Link "Vedi tutte →" per andare alle Impostazioni se ci sono più comunicazioni
- **File Modificati**:
  - ✅ `core/js/dashboard-data.js` - Funzione `loadComunicazioniInviateCaposquadra`
  - ✅ `core/js/dashboard-sections.js` - Sezione HTML comunicazioni inviate
  - ✅ `core/js/dashboard-controller.js` - Integrazione chiamata funzione
  - ✅ `core/dashboard-standalone.html` - Import e callback aggiunti

### Vantaggi
- ✅ **Logout Funzionante**: Nessun errore durante logout per tutti i ruoli
- ✅ **Feedback Utente**: Messaggi chiari durante invio comunicazione rapida
- ✅ **Visibilità Conferme**: Caposquadra vede subito statistiche conferme nella dashboard
- ✅ **UX Migliorata**: Informazioni importanti sempre visibili senza navigare

### Stato
✅ **COMPLETATO** (2025-12-28)

Il logout funziona correttamente per tutti i ruoli e la comunicazione rapida fornisce feedback chiaro all'utente. Il caposquadra può vedere immediatamente le statistiche delle conferme nella dashboard.

---

## ✅ Link Impostazioni nell'Header (2025-12-24) - COMPLETATO

### Obiettivo
Aggiungere il link alle impostazioni nell'header delle pagine chiave per permettere accesso rapido senza dover tornare alla dashboard, migliorando la navigazione e l'usabilità.

### Implementazione

#### 1. Link Impostazioni nell'Header ✅
- **Pagine Modificate**: 9 pagine selezionate dove è necessario configurare elementi (tipi lavoro, colture, poderi, categorie, ecc.)
- **Stile**: Coerente con dashboard (icona ⚙️ + testo "Impostazioni")
- **Posizionamento**: Nell'header-actions, prima del link Dashboard
- **Visibilità**: Link nascosto di default, mostrato solo a Manager/Amministratore

#### 2. Pagine Core Base ✅
- **File**: `core/terreni-standalone.html`
  - Link per aggiungere rapidamente poderi, colture
- **File**: `core/attivita-standalone.html`
  - Link per aggiungere rapidamente tipi lavoro, colture

#### 3. Pagine Admin/Manodopera ✅
- **File**: `core/admin/gestione-lavori-standalone.html`
  - Link per aggiungere rapidamente tipi lavoro
- **File**: `core/admin/gestione-macchine-standalone.html`
  - Link per aggiungere rapidamente categorie attrezzi
- **File**: `core/admin/gestisci-utenti-standalone.html`
  - Link per configurare ruoli/permessi
- **File**: `core/segnatura-ore-standalone.html`
  - Link per aggiungere rapidamente tipi lavoro

#### 4. Pagine Modulo Conto Terzi ✅
- **File**: `modules/conto-terzi/views/preventivi-standalone.html`
  - Link per aggiungere rapidamente tipi lavoro, colture
- **File**: `modules/conto-terzi/views/nuovo-preventivo-standalone.html`
  - Link per aggiungere rapidamente tipi lavoro, colture
- **File**: `modules/conto-terzi/views/tariffe-standalone.html`
  - Link per aggiungere rapidamente colture, tipi lavoro

#### 5. Logica Permessi ✅
- **Controllo Ruoli**: Verifica ruoli utente dopo caricamento dati
- **Visibilità Condizionale**: Link mostrato solo se utente ha ruolo Manager o Amministratore
- **Percorsi Relativi**: Percorsi corretti per ogni pagina (core, admin, moduli)

### File Modificati
- ✅ `core/terreni-standalone.html` - Aggiunto link + logica permessi
- ✅ `core/attivita-standalone.html` - Aggiunto link + logica permessi
- ✅ `core/admin/gestione-lavori-standalone.html` - Aggiunto link + logica permessi
- ✅ `core/admin/gestione-macchine-standalone.html` - Aggiunto link + logica permessi
- ✅ `core/admin/gestisci-utenti-standalone.html` - Aggiunto link + logica permessi
- ✅ `core/segnatura-ore-standalone.html` - Aggiunto link + logica permessi
- ✅ `modules/conto-terzi/views/preventivi-standalone.html` - Aggiunto link + logica permessi
- ✅ `modules/conto-terzi/views/nuovo-preventivo-standalone.html` - Aggiunto link + logica permessi
- ✅ `modules/conto-terzi/views/tariffe-standalone.html` - Aggiunto link + logica permessi

### Vantaggi
- ✅ **Navigazione Migliorata**: Accesso rapido alle impostazioni senza tornare alla dashboard
- ✅ **UX Coerente**: Stesso stile e comportamento della dashboard in tutte le pagine
- ✅ **Sicurezza**: Link visibile solo agli utenti autorizzati
- ✅ **Produttività**: Risparmio di tempo quando serve configurare elementi mancanti

### Stato
✅ **COMPLETATO** (2025-12-24)

Il link alle impostazioni è ora disponibile nelle pagine chiave dove è necessario configurare elementi, migliorando significativamente la navigazione e l'usabilità dell'applicazione.

---

## ✅ Segnalazione Guasti Generici e Mappa Interattiva (2025-12-24) - COMPLETATO

### Obiettivo
Aggiungere la possibilità di segnalare guasti "generici" non legati a macchine/attrezzature (frane, voragini, problemi infrastrutturali, ecc.) e implementare una mappa interattiva per la localizzazione precisa del problema.

### Implementazione

#### 1. Sistema Segnalazione Guasti Generici ✅
- **File**: `core/admin/segnalazione-guasti-standalone.html`
- **Modifiche**:
  - Aggiunto radio button per scegliere tra "Guasto Macchina/Attrezzo" e "Segnalazione Generica"
  - Sezione form dinamica che mostra campi diversi in base al tipo selezionato
  - Campi specifici per guasti generici:
    - `ubicazione`: Campo testo per indicare dove si trova il problema
    - `tipoProblema`: Dropdown con opzioni (Frana, Voragine, Danno infrastruttura, ecc.)
    - Pre-compilazione automatica ubicazione dal lavoro corrente (podere + terreno)
  - Salvataggio dati: `tipoGuasto: 'generico'`, `ubicazione`, `tipoProblema`, `coordinateProblema` (se marker posizionato)

#### 2. Mappa Interattiva con Marker ✅
- **File**: `core/admin/segnalazione-guasti-standalone.html`
- **Funzionalità**:
  - Container mappa Google Maps (400px altezza) nella sezione generico
  - Visualizzazione confini terreno (poligono rosso) se disponibili
  - Click sulla mappa per posizionare marker rosso draggable
  - Salvataggio coordinate precise del marker (`coordinateProblema: {lat, lng}`)
  - Feedback visivo: status text che mostra coordinate in tempo reale
  - Info window sul marker con coordinate precise
  - Cursore crosshair sulla mappa per indicare interattività
- **Caricamento API**:
  - Caricamento diretto `google-maps-config.js` (come altri file)
  - Gestione asincrona con callback per inizializzazione corretta
  - Verifica completa che Google Maps sia caricato prima di usare API

#### 3. Visualizzazione Guasti Generici ✅
- **File**: `core/admin/gestione-guasti-standalone.html`
- **Modifiche**:
  - Filtro per tipo guasto (Macchina/Generico)
  - Badge distintivo "🌍 Generico" per guasti generici
  - Visualizzazione `ubicazione` e `tipoProblema` nei dettagli
  - Link "Visualizza sulla mappa" per guasti con coordinate (apre Google Maps con marker)
  - Gestione coordinate in diversi formati (oggetto, GeoPoint Firestore)
- **File**: `core/dashboard-standalone.html`
- **Modifiche**:
  - Visualizzazione guasti generici nella dashboard manager
  - Icona 🌍 per guasti generici
  - Titolo formato: "Tipo Problema - Ubicazione"
  - Sezione "Ultimi Risolti" aggiornata per gestire guasti generici

#### 4. Fix Permessi Firestore Utenti ✅
- **File**: `core/admin/gestione-guasti-standalone.html`
- **Problema**: `loadUsers()` cercava di leggere tutti gli utenti senza filtri, violando regole Firestore
- **Soluzione**: Aggiunto filtro per `tenantId` usando query:
  ```javascript
  const q = query(usersRef, where('tenantId', '==', currentTenantId));
  ```
- **Risultato**: Nomi operai ora visualizzati correttamente (non più "Operaio sconosciuto")

#### 5. Link Visualizzazione Mappa Guasti ✅
- **File**: `core/admin/gestione-guasti-standalone.html`
- **Funzionalità**:
  - Pulsante "🗺️ Visualizza sulla mappa" per guasti generici con coordinate
  - Link diretto a Google Maps con zoom 18 sul punto esatto
  - Visualizzazione coordinate testuali sotto il pulsante
  - Gestione diversi formati coordinate (retrocompatibilità)

#### 6. Filtri e Query Aggiornati ✅
- **File**: `core/admin/gestione-macchine-standalone.html`
- **Modifiche**:
  - Query storico guasti filtra solo `tipoGuasto === 'macchina'`
  - Guasti generici non appaiono nello storico macchine
- **File**: `core/admin/gestione-guasti-standalone.html`
- **Modifiche**:
  - Filtro dropdown per tipo guasto
  - Logica filtri aggiornata per includere tipo guasto

### File Modificati
- ✅ `core/admin/segnalazione-guasti-standalone.html` - Form con tipo guasto, mappa interattiva, pre-compilazione ubicazione
- ✅ `core/admin/gestione-guasti-standalone.html` - Visualizzazione guasti generici, link mappa, fix permessi utenti
- ✅ `core/dashboard-standalone.html` - Visualizzazione guasti generici in dashboard
- ✅ `core/admin/gestione-macchine-standalone.html` - Filtro tipo guasto nello storico

### Vantaggi
- ✅ **Segnalazioni complete**: Possibilità di segnalare qualsiasi problema, non solo guasti macchine
- ✅ **Localizzazione precisa**: Marker sulla mappa per indicare punto esatto del problema
- ✅ **Visualizzazione confini**: Confini terreno visibili per contesto geografico
- ✅ **Link diretto mappa**: Manager può aprire Google Maps con un click per vedere posizione precisa
- ✅ **Dati operai corretti**: Nomi operai visualizzati correttamente grazie a fix permessi
- ✅ **Retrocompatibilità**: Guasti esistenti senza `tipoGuasto` default a 'macchina'

### Stato
✅ **COMPLETATO** (2025-12-24)

Il sistema ora supporta segnalazioni generiche con localizzazione precisa tramite mappa interattiva, migliorando significativamente la capacità di tracciare e gestire problemi sul campo.

---

## 🎯 Distinzione Importante

### "Core" = Fondamenta Tecniche (Quello che abbiamo fatto)

Il **core** che abbiamo sviluppato finora è la **base tecnica** dell'applicazione:

```
core/
├── services/          ✅ Servizi base (backend/logica)
│   ├── firebase-service.js      # Operazioni database
│   ├── auth-service.js          # Autenticazione
│   ├── tenant-service.js        # Multi-tenant
│   ├── permission-service.js    # Controllo permessi
│   └── role-service.js            # Gestione ruoli
│
└── models/            ✅ Modelli dati base
    ├── Base.js        # Classe base per modelli
    └── User.js         # Modello utente
```

**Cosa fa**: Fornisce le funzionalità base che TUTTE le parti dell'app useranno.

---

### "Applicazione" = Core + Moduli + UI (Da sviluppare)

L'applicazione completa includerà:

```
gfv-platform/
├── core/              ✅ FATTO - Servizi base
│   ├── services/      ✅ FATTO
│   ├── models/        ✅ FATTO
│   ├── auth/          ❌ DA FARE - UI autenticazione
│   ├── tenant/        ❌ DA FARE - UI gestione tenant
│   └── subscription/  ❌ DA FARE - UI abbonamenti
│
├── modules/           ✅ IN SVILUPPO - Moduli applicativi
│   ├── conto-terzi/   ✅ Fase 1 MVP completata (2025-12-07)
│   │   ├── models/Cliente.js
│   │   ├── services/clienti-service.js
│   │   └── views/ (3 pagine)
│   ├── parco-macchine/ ✅ Completato
│   ├── vendemmia/     ❌ Da refactorizzare da vecchia app
│   ├── clienti/       ❌ Da refactorizzare da vecchia app
│   ├── bilancio/      ❌ Da refactorizzare da vecchia app
│   └── ...
│
└── shared/            ❌ DA SVILUPPARE - Componenti condivisi
    ├── components/    ❌ Widget riutilizzabili
    ├── utils/         ❌ Utility functions
    └── styles/        ❌ Stili globali
```

---

## ✅ Cosa Abbiamo Fatto (Core Base)

### 1. Servizi Core ✅
- **Firebase Service**: Operazioni database con multi-tenant
- **Auth Service**: Login, registrazione, gestione sessione
- **Tenant Service**: Isolamento dati per tenant
- **Permission Service**: Controllo permessi basato su ruoli
- **Role Service**: Assegnazione/rimozione ruoli

### 2. Modelli Base ✅
- **Base Model**: Classe base per tutti i modelli
- **User Model**: Modello utente con ruoli e tenant

### 3. Configurazione ✅
- **Firebase**: Progetto configurato (Web, Android, iOS)
- **Git**: Repository separato creato

---

## ❌ Cosa Manca (Applicazione Completa)

### 1. UI Core (Da sviluppare)
- **auth/**: Pagine login, registrazione, reset password
- **tenant/**: Gestione tenant, configurazione azienda
- **subscription/**: Gestione abbonamenti, moduli attivi

### 2. Moduli Applicativi (Da sviluppare/refactorizzare)
- **vendemmia/**: Calcolatore vendemmia (da vecchia app)
- **clienti/**: Anagrafica clienti (da vecchia app)
- **bilancio/**: Report e statistiche (da vecchia app)

### 3. Componenti Condivisi (Da sviluppare)
- **components/**: Widget riutilizzabili (bottoni, form, tabelle)
- **utils/**: Funzioni utility (date, formattazione, validazione)
- **styles/**: Stili globali, tema, design system

---

## ✅ Validazione Obbligatoria Dati Lavori e Finestra Recupero (2025-12-20) - COMPLETATO

### Obiettivo
Risolvere il problema per cui trattoristi e caposquadra potevano completare un lavoro prima di segnare le ore, perdendo la possibilità di inserirle. Implementare validazione obbligatoria e finestra temporale per recupero.

### Problema Identificato
- Trattoristi potevano tracciare zone lavorate e segnare come completato il lavoro come prima cosa
- A quel punto non potevano più segnare le ore perché il lavoro non compariva più nella lista
- Mancava un ordine temporale obbligatorio per garantire che tutti i dati fossero compilati

### Implementazione

#### Validazione Obbligatoria Dati
- ✅ **Funzioni helper**: Aggiunte funzioni `verificaOreSegnate()` e `verificaZoneLavorate()` in dashboard-standalone.html
- ✅ **Funzioni helper**: Aggiunte funzioni `verificaOreSegnateLavoro()` e `verificaZoneLavorateLavoro()` in lavori-caposquadra-standalone.html
- ✅ **Blocco completamento**: Modificata `segnaLavoroCompletato()` in dashboard per validare ore e zone prima di completare
- ✅ **Blocco completamento**: Modificata `segnaCompletato()` in lavori-caposquadra per validare ore e zone prima di completare
- ✅ **Messaggi chiari**: Messaggi di errore specifici che indicano esattamente quali dati mancano
- ✅ **Zone obbligatorie per trattoristi**: Zone lavorate ora obbligatorie anche per trattoristi (non più opzionali)

#### Finestra Temporale Recupero
- ✅ **Lavori completati recenti**: Modificata `loadLavori()` in segnatura-ore-standalone.html per includere lavori completati negli ultimi 7 giorni
- ✅ **Sezione dedicata**: Lavori completati mostrati in sezione separata "Lavori Completati Recenti (ultimi 7 giorni)"
- ✅ **Badge distintivo**: Badge giallo distintivo per lavori completati recenti
- ✅ **Messaggio informativo**: Spiegazione che si possono ancora segnare ore per questi lavori
- ✅ **Calcolo data limite**: Data limite calcolata come 7 giorni fa dalla data corrente

### File Modificati
- `core/dashboard-standalone.html` - Funzioni helper e validazione in `segnaLavoroCompletato()`
- `core/admin/lavori-caposquadra-standalone.html` - Funzioni helper e validazione in `segnaCompletato()`
- `core/segnatura-ore-standalone.html` - Modificata `loadLavori()` e `renderLavori()` per includere lavori completati recenti

### Risultato
- ✅ Nessun lavoro può essere completato senza dati obbligatori (ore e zone)
- ✅ Ordine temporale garantito: zone → ore → completamento
- ✅ Possibilità di recuperare ore anche dopo completamento (finestra 7 giorni)
- ✅ Esperienza utente migliorata con validazioni chiare e messaggi informativi
- ✅ Prevenzione errori dell'utente con blocchi mirati

---

## ✅ Badge Conto Terzi e Filtri per Categoria nel Diario Attività (2025-12-18) - COMPLETATO

### Obiettivo
Migliorare l'identificazione delle attività conto terzi nel diario attività e implementare filtri per categoria per Tipo Lavoro e Colture, raggruppando automaticamente tutte le varianti.

### Implementazione

#### Badge Conto Terzi
- ✅ **Badge nella colonna Tipo Lavoro**: Aggiunto badge "💼 Conto Terzi" nella colonna "Tipo Lavoro" per tutte le attività conto terzi
- ✅ **Visibilità sempre garantita**: Il badge è visibile anche quando la colonna "Cliente" non è presente (modalità core senza modulo conto terzi attivo)
- ✅ **Coerenza con dashboard**: Stesso stile e comportamento del badge presente nella dashboard manager

#### Filtri per Categoria

##### Filtro Tipo Lavoro
- ✅ **Dropdown con categorie**: Il filtro mostra le categorie principali (es. "Lavorazione del Terreno", "Potatura", "Trattamenti") invece dei tipi specifici
- ✅ **Raggruppamento automatico**: Selezionando una categoria, vengono mostrate tutte le attività con tipi lavoro appartenenti a quella categoria
- ✅ **Mapping intelligente**: Usa `categoriaId` dalla struttura gerarchica per mappare tipo lavoro → categoria
- ✅ **Fallback**: Se le categorie non sono ancora caricate, usa categorie predefinite

##### Filtro Colture
- ✅ **Dropdown con categorie**: Il filtro mostra le categorie principali (Vite, Frutteto, Seminativo, Orto, Prato, Olivo, Agrumeto, Bosco) invece delle colture specifiche
- ✅ **Raggruppamento automatico**: Selezionando una categoria (es. "Frutteto"), vengono mostrate tutte le attività con colture appartenenti a quella categoria (Albicocche, Pesche, Mele, Pere, ecc.)
- ✅ **Mapping intelligente**: Usa funzione `mapColturaToCategoria()` per mappare coltura specifica → categoria generica
- ✅ **Sempre disponibile**: Categorie hardcoded, sempre disponibili anche se le colture non sono ancora caricate

#### Funzioni di Mapping
- ✅ **`mapColturaToColorCategory()`**: Spostata in `shared/utils/map-colors.js` per riutilizzo in tutta l'applicazione
- ✅ **`mapColturaToCategoria()`**: Funzione helper locale sincrona per uso nei filtri
- ✅ **Mapping tipo lavoro**: Logica per trovare categoria tramite `categoriaId` in `tipiLavoroList`

#### Popolamento Dropdown
- ✅ **Funzioni dedicate**: Create `populateFiltroTipoLavoro()` e `populateFiltroColture()` per gestire il popolamento
- ✅ **Chiamate multiple**: I filtri vengono popolati sia in `loadListePersonalizzate()` che dopo il caricamento completo dei dati
- ✅ **Inizializzazione garantita**: `loadCategorieLavori()` viene sempre chiamata all'inizializzazione per assicurare che le categorie siano disponibili

### File Modificati
- `core/attivita-standalone.html` - Aggiunto badge conto terzi, implementati filtri per categoria, funzioni di mapping
- `shared/utils/map-colors.js` - Aggiunta funzione `mapColturaToColorCategory()` e `getColturaCategories()`

### Risultato
- ✅ Attività conto terzi facilmente identificabili con badge visibile
- ✅ Filtri più intuitivi e organizzati per categoria
- ✅ Raggruppamento automatico di tutte le varianti (es. tutte le varietà di vite, tutti i frutti, ecc.)
- ✅ Esperienza utente migliorata con filtri più semplici e logici

---

## ✅ Ottimizzazione Colori e Visibilità Mappe (2025-12-18) - COMPLETATO

### Obiettivo
Migliorare la visibilità dei perimetri delle mappe e implementare una palette colori più distinta e visibile per le diverse colture su tutte le mappe dell'applicazione.

### Implementazione

#### Palette Colori Ottimizzata
- ✅ **Nuova palette colori visibile**: Implementata palette con colori fill e stroke distinti per ogni categoria coltura
  - Vite: Rosso scuro brillante (#DC143C) / Rosso scuro perimetro (#8B0000)
  - Frutteto: Arancione brillante (#FF6600) / Arancione scuro perimetro (#CC5500)
  - Seminativo: Giallo oro (#FFD700) / Giallo scuro perimetro (#B8860B)
  - Orto: Verde lime brillante (#00FF00) / Verde scuro perimetro (#00AA00)
  - Prato: Verde chiaro (#90EE90) / Verde scuro perimetro (#228B22)
  - Olivo: Viola medio (#9370DB) / Viola scuro perimetro (#6A5ACD)
  - Agrumeto: Arancione (#FFA500) / Arancione scuro perimetro (#FF8C00)
  - Bosco: Marrone sella (#8B4513) / Marrone scuro perimetro (#654321)
  - Default: Blu dodger (#1E90FF) / Blu scuro perimetro (#0066CC) - invece di verde

#### Miglioramento Visibilità Perimetri
- ✅ **Stroke più spesso**: Aumentato `strokeWeight` da 2px a 3px
- ✅ **Opacità massima**: Aumentato `strokeOpacity` da 0.8 a 1.0
- ✅ **Colori stroke scuri**: Ogni categoria ha una versione scura del colore per il perimetro per massima visibilità

#### Mapping Intelligente Colture
- ✅ **Funzione `mapColturaToColorCategory()`**: Implementata funzione che mappa automaticamente colture specifiche a categorie generiche
  - Esempi: "Vite da Vino" → "Vite", "Albicocche" → "Frutteto", "Pomodoro" → "Orto"
  - Supporta mapping per tutte le varianti di colture (Vite da Tavola, Vite da Vino, tutte le varietà di frutti, ecc.)
  - Usa anche la categoria se disponibile nel terreno per mapping più accurato

#### Fix Bug Mappa Clienti
- ✅ **Eliminato bagliore bianco**: Risolto problema del flash bianco durante il cambio cliente nella mappa clienti
  - Implementata creazione anticipata dei nuovi poligoni prima della rimozione dei vecchi
  - Eliminato gap temporale tra rimozione vecchi elementi e aggiunta nuovi
  - Cambiato background container da grigio chiaro (#f0f0f0) a nero scuro (#1a1a1a)

#### Coerenza tra Mappe
- ✅ **Stessa palette su tutte le mappe**: Applicata la stessa palette colori e parametri a:
  - Dashboard (`core/dashboard-standalone.html`)
  - Gestione Terreni (`core/terreni-standalone.html`)
  - Mappa Clienti (`modules/conto-terzi/views/mappa-clienti-standalone.html`)

#### Tracciamento Confini Terreni
- ✅ **Colore dinamico in base a coltura**: Il tracciamento confini in "Gestione Terreni" ora usa il colore della coltura selezionata invece di sempre verde
- ✅ **Listener per cambio coltura**: Implementato listener che aggiorna il colore del poligono quando si cambia la coltura selezionata

### File Modificati
- `core/dashboard-standalone.html` - Aggiornata palette colori e parametri perimetri
- `core/terreni-standalone.html` - Aggiunta palette colori, mapping colture, colore dinamico tracciamento
- `modules/conto-terzi/views/mappa-clienti-standalone.html` - Aggiornata palette colori, fix bug cambio cliente
- `shared/utils/map-colors.js` - Creato file centralizzato per palette colori (per uso futuro)

### Risultato
- ✅ Perimetri terreni molto più visibili su mappa satellitare
- ✅ Colori distinti e riconoscibili per ogni categoria coltura
- ✅ Nessun bagliore bianco durante cambio cliente nella mappa clienti
- ✅ Coerenza visiva tra tutte le mappe dell'applicazione
- ✅ Leggende aggiornate con i nuovi colori

---

## ✅ Miglioramenti Modulo Conto Terzi - Registrazione Ore e UI (2025-12-13)

### Modifiche Form Rapido Conto Terzi
- ✅ **Sostituito campo singolo "Ore Lavorate"** con sistema completo ora inizio/fine/pause
- ✅ **Aggiunto calcolo automatico ore nette** nel form rapido attività conto terzi
- ✅ **Modificato `salvaAttivitaRapida`** per leggere orari invece di ore singole
- ✅ **Validazione completa orari** (ora fine > ora inizio, ore nette > 0)
- ✅ **Event listeners** per calcolo automatico in tempo reale

### Modifiche Modal Principale Attività Conto Terzi
- ✅ **Sostituito campo "Ore Lavorate"** con sistema ora inizio/fine/pause
- ✅ **Aggiunto calcolo automatico ore nette** anche nel modal principale
- ✅ **Funzione `updateOreNetteContoTerzi`** per aggiornamento automatico
- ✅ **Modificato `handleSaveAttivita`** per calcolare ore nette da orari

### Miglioramenti Funzione `generaVoceDiarioContoTerzi`
- ✅ **Aggiunto parametro opzionale `orariOpzionali`** per passare orari dalla attività salvata
- ✅ **Riutilizzo orari** invece di default quando disponibili
- ✅ **Implementato in entrambi i file**: `attivita-standalone.html` e `gestione-lavori-standalone.html`

### Correzione Visualizzazione Lavori Completati Conto Terzi
- ✅ **Ore visualizzate correttamente**: usa `totaleOreAttivita` quando Manodopera non attivo
- ✅ **Percentuale completamento**: 100% quando lavoro completato senza zone tracciate
- ✅ **Raggruppamento ore per data**: unisce ore attività con ore validate per dettagli giornalieri
- ✅ **Visualizzazione superficie**: mostra solo superficie totale quando non ci sono zone tracciate

### Correzione UI Pagina "Lavori da Pianificare"
- ✅ **Gradiente blu invece di verde** quando aperta da dashboard conto terzi
- ✅ **Rilevamento automatico modalità conto terzi** da parametri URL
- ✅ **Script nell'head** per applicare stili immediatamente (evita flash verde)
- ✅ **Link dashboard corretto**: torna alla dashboard conto terzi invece che principale
- ✅ **Titolo aggiornato**: "Lavori da Pianificare - Conto Terzi"

### Miglioramenti Card Statistiche
- ✅ **Colori distintivi per card progresso**:
  - In Ritardo: gradiente rosso (`#dc3545` → `#c82333`)
  - In Tempo: gradiente verde (`#28a745` → `#218838`)
  - In Anticipo: gradiente blu chiaro (`#17a2b8` → `#138496`)
- ✅ **Esclusione dalla regola generale** che applica blu a tutte le card
- ✅ **Testo bianco** per buon contrasto su sfondi colorati

### Correzioni Tecniche
- ✅ **Rimosso script inline** dal template literal per evitare errori di sintassi
- ✅ **Funzione `initCalcoloOreNetteRapido`** separata per inizializzazione form rapidi
- ✅ **Rimozione attributo `required`** dai campi Conto Terzi quando sezione nascosta
- ✅ **Rilevamento modalità conto terzi** migliorato con controllo parametri URL

### File Modificati
- `core/attivita-standalone.html` - Form rapido, modal principale, visualizzazione lavori completati
- `core/admin/gestione-lavori-standalone.html` - Stili UI, link dashboard, card statistiche
- `core/models/Attivita.js` - Già aggiornato in precedenza con `clienteId` e `lavoroId`

### Risultato
- ✅ Nessuna duplicazione inserimento ore: sistema unificato ora inizio/fine/pause
- ✅ Calcolo automatico ore nette in tutti i form
- ✅ UI coerente con tema Conto Terzi (blu) invece di verde
- ✅ Statistiche ben visibili con colori distintivi
- ✅ Navigazione corretta tra dashboard e pagine

---

## ✅ Uniformazione Stile Statistiche Colorato (2025-01-26)

### Obiettivo
Uniformare lo stile di tutte le statistiche applicando gradienti colorati per creare coerenza visiva in tutta l'applicazione.

### Implementazione

#### Statistiche Manodopera
- **File modificato**: `core/admin/statistiche-manodopera-standalone.html`
- Statistiche Lavori: 4 card colorate (Blu, Arancione, Verde, Viola)
- Statistiche Ore: 4 card colorate (Verde, Arancione, Viola)
- Statistiche Squadre: 4 card colorate (Blu, Verde)
- Statistiche Superficie: 3 card colorate (Verde, Blu, Viola)
- Report Ore Operai: 4 card aggregate colorate

#### Statistiche Core Base
- **File modificato**: `core/statistiche-standalone.html`
- Card "Terreni Totali" colorata (Blu) per coerenza
- Statistiche Terreni e Macchine già colorate, verificate

#### Palette Colori
- Blu: metriche neutre/informative
- Verde: metriche positive
- Arancione: metriche intermedie
- Viola: metriche speciali
- Rosso: metriche critiche
- Turchese: metriche informative alternative

---

## ✅ Gestione Affitti Terreni e Statistiche (2025-01-26)

### Obiettivo
Aggiungere la possibilità di specificare se un terreno è di proprietà o in affitto, con monitoraggio scadenze e statistiche complete.

### Implementazione

#### Modello Terreno Esteso
- **File modificato**: `core/models/Terreno.js`
- Campo `tipoPossesso`: "proprieta" | "affitto" (default: "proprieta")
- Campo `dataScadenzaAffitto`: Data scadenza contratto (obbligatorio se affitto)
- Campo `canoneAffitto`: Canone mensile in euro (opzionale)
- Validazione: Data scadenza obbligatoria per terreni in affitto
- Retrocompatibilità: Terreni esistenti senza campo considerati "proprietà"

#### Sistema Alert Scadenza
- **File modificato**: `core/terreni-standalone.html`
- Traffic light system: Verde (>6 mesi), Giallo (1-6 mesi), Rosso (≤1 mese), Grigio (scaduto)
- Visualizzazione: Pallini colorati nella lista terreni con tooltip
- Filtri: Per tipo possesso e alert scadenza

#### Card Dashboard Affitti
- **File modificato**: `core/dashboard-standalone.html`, `core/js/dashboard-sections.js`
- Card "Affitti in Scadenza" per Core Base e Manager
- Mostra solo affitti urgenti (rosso/giallo), massimo 5
- Link diretto a gestione terreni

#### Statistiche Terreni
- **File modificato**: `core/statistiche-standalone.html`, `core/admin/statistiche-manodopera-standalone.html`
- 8 metriche: Totali, Proprietà, Affitto, Superficie, Canoni
- Grafici Chart.js: Distribuzione terreni e superficie
- Lista affitti in scadenza completa

#### Layout Core Base Ottimizzato
- **File modificato**: `core/dashboard-standalone.html`, `core/styles/dashboard.css`
- Layout con 5 card sopra mappa (Terreni, Diario, Affitti, Statistiche, Abbonamento)
- Larghezza ottimizzata: 240px (desktop), 220px (tablet)
- Padding ridotto per card più compatte

---

## ✅ Sistema Categorie Gerarchico Unificato (2025-01-23)

### Obiettivo
Unificare le categorie di attrezzi e lavori in un unico sistema gerarchico per evitare duplicazioni e migliorare l'organizzazione.

### Modello Unificato
- **File creato**: `core/models/Categoria.js`
- Struttura gerarchica con `parentId` per sottocategorie
- Campo `applicabileA` per specificare se categoria si applica ad attrezzi/lavori/entrambi
- 10 categorie principali predefinite + sottocategorie

### Servizio Unificato
- **File creato**: `core/services/categorie-service.js`
- CRUD completo categorie
- Supporto gerarchico completo
- Funzioni per ottenere struttura gerarchica

### Migrazione Automatica
- Migrazione automatica da `categorieAttrezzi` → `categorie`
- Migrazione automatica da `categorieLavori` → `categorie`
- Creazione automatica categorie predefinite mancanti
- Idempotente e sicura

### UI Gerarchica
- Dropdown categoria principale + sottocategoria dinamica
- Event listener automatici per mostrare sottocategorie
- Filtri migliorati per includere sottocategorie
- Supporto completo per creazione tipi lavoro specifici

### File Modificati
- `core/admin/gestione-macchine-standalone.html` - UI gerarchica attrezzi
- `core/admin/gestione-lavori-standalone.html` - UI gerarchica lavori
- `modules/parco-macchine/models/Macchina.js` - Usa categoriaId unificato
- `core/models/TipoLavoro.js` - Usa categoriaId unificato

---

## 🎯 Risposta alla Tua Domanda

### "Il core è solo quello che abbiamo fatto?"

**SÌ e NO**:

- **SÌ**: Abbiamo fatto il **core tecnico** (servizi e modelli base)
- **NO**: Manca ancora il **core UI** (pagine auth, tenant, subscription)
- **NO**: Manca l'**applicazione** (moduli vendemmia, clienti, bilancio)

### "Il core è la parte che sviluppiamo adesso?"

**SÌ**: Il core tecnico è fatto. Ora possiamo:
1. Sviluppare i moduli applicativi (vendemmia, clienti, bilancio)
2. Creare le UI core (auth, tenant, subscription)
3. Creare componenti condivisi

---

## 📊 Confronto: Vecchia App vs Nuova App

### Vecchia App (Monolitica)
```
vecchia app/
├── index.html          # Tutto insieme
├── anagrafica_clienti.html
├── bilancio.html
└── [tutto in file HTML grandi]
```

### Nuova App (Modulare) - Target
```
gfv-platform/
├── core/               ✅ Base tecnica (FATTO)
│   └── services/      ✅ FATTO
│
├── modules/            ❌ Moduli (DA FARE)
│   ├── vendemmia/     ❌ Da refactorizzare
│   ├── clienti/        ❌ Da refactorizzare
│   └── bilancio/      ❌ Da refactorizzare
│
└── shared/             ❌ Condivisi (DA FARE)
```

---

## 🚀 Prossimi Passi di Sviluppo

### Fase 1: Core UI (Prossimo)
- [ ] Pagine autenticazione (login, registrazione)
- [ ] Dashboard base
- [ ] Gestione tenant/azienda

### Fase 2: Moduli (Dopo)
- [ ] Refactorizzare modulo vendemmia da vecchia app
- [ ] Refactorizzare modulo clienti da vecchia app
- [ ] Refactorizzare modulo bilancio da vecchia app

### Fase 3: Componenti (In parallelo)
- [ ] Componenti UI riutilizzabili
- [ ] Design system
- [ ] Utility functions

---

## 💡 In Sintesi

**Core tecnico** = ✅ FATTO (servizi, modelli, configurazione)  
**Core UI** = ❌ DA FARE (pagine auth, tenant, subscription)  
**Moduli** = ❌ DA FARE (vendemmia, clienti, bilancio)  
**Componenti** = ❌ DA FARE (widget, utils, styles)

**Il core che abbiamo fatto è la FONDAMENTA. Ora possiamo costruire l'applicazione sopra!** 🏗️

---

## 📝 Aggiornamenti Recenti (2025-01-20)

### Dashboard Ruoli Ottimizzate ✅
- **Dashboard Operaio**: Rimossa visualizzazione Core Base (terreni, diario attività, statistiche, abbonamento)
  - Visualizza solo: Comunicazioni dal Caposquadra, Lavori di Oggi, Segna Ore, Le Mie Ore
  - Statistiche personali: Lavori Oggi, Ore Segnate, Stato
  - Sezione "Le Mie Ore" con riepilogo (Validate/Da validare/Rifiutate) e ultime 5 ore segnate
- **Dashboard Caposquadra**: Rimossa visualizzazione Core Base
  - Visualizza solo: Statistiche squadra, Comunicazione Rapida, Azioni Rapide, Lavori Recenti
- **Logica**: Core Base nascosto solo se utente è SOLO Operaio o SOLO Caposquadra
- **File modificati**: `core/dashboard-standalone.html`

### Diario da Lavori Automatico ✅
- **Campo Tipo Lavoro**: Aggiunto campo obbligatorio `tipoLavoro` al modello Lavoro
  - Validazione: campo obbligatorio
  - Dropdown popolato dalle liste personalizzate (predefiniti + custom)
- **Form Lavori**: Aggiunto dropdown Tipo Lavoro nel form creazione/modifica lavoro
  - Caricamento automatico tipi lavoro dalle liste personalizzate
  - Salvataggio tipo lavoro nel documento lavoro
- **Generazione Automatica Attività**: Funzione per generare attività dalle ore validate
  - Raggruppa ore validate per data e lavoro
  - Calcola orario inizio (prima ora) e fine (ultima ora) del giorno
  - Somma pause e ore nette totali
  - Conta numero operai che hanno lavorato
  - Recupera dati terreno (nome, coltura) e lavoro (tipo lavoro)
- **Vista Dashboard Manager**: Nuova sezione "Diario da Lavori"
  - Tabella con colonne: Data, Terreno, Tipo Lavoro, Coltura, Orario, Ore, Operai, Lavoro
  - Mostra ultime 20 attività generate
  - Ordinamento per data (più recenti prima)
  - Messaggio quando non ci sono attività
- **File modificati**: 
  - `core/models/Lavoro.js`
  - `core/admin/gestione-lavori-standalone.html`
  - `core/dashboard-standalone.html`

### Sistema Comunicazioni Squadra e Separazione Impostazioni ✅
- Separazione impostazioni per ruolo:
  - Manager/Amministratore: tutte le sezioni (Azienda, Poderi, Liste, Account, Password)
  - Caposquadra: solo Comunicazioni Squadra + Account + Password
  - Operaio: solo Account + Password
- Scheda veloce comunicazioni nella dashboard caposquadra:
  - Card "Invia Comunicazione Rapida" direttamente nella dashboard
  - Pre-compilazione automatica podere, campo e lavoro dal primo lavoro attivo
  - Dropdown per selezionare lavoro se ce ne sono più di uno
  - Solo orario (default 7:00) e note da compilare
  - Invio rapido in un click
- Sistema comunicazioni di ritrovo per caposquadra:
  - Pre-compilazione automatica podere/terreno dal lavoro assegnato
  - Dropdown selezione lavoro per pre-compilare automaticamente
  - Invio comunicazione alla squadra con notifica nella dashboard operai
  - Lista comunicazioni inviate con statistiche conferme
  - Versione completa nelle Impostazioni per casi particolari
- Visualizzazione comunicazioni nella dashboard operaio:
  - Card comunicazioni attive con dettagli (podere, campo, data, orario)
  - Conferma ricezione obbligatoria
  - Link Google Maps per indicazioni al podere geolocalizzato
  - Stato visivo (giallo se non confermata, verde se confermata)

### Campo Cellulare per Utenti ✅
- Aggiunto campo cellulare opzionale nel form invito utente (Manager)
- Campo cellulare obbligatorio nella registrazione via invito
- Visualizzazione contatti squadra per caposquadra con link cliccabili (`mailto:` e `tel:`)
- Validazione formato cellulare

### Gestione Poderi ✅
- Aggiunta sezione "Gestione Poderi" in Impostazioni
- Integrazione Google Maps con visualizzazione satellitare
- Marker draggable per posizionamento preciso poderi
- Ricerca indirizzo con geocoding e reverse geocoding
- Campo podere nei terreni con dropdown
- Salvataggio coordinate poderi per indicazioni stradali

**File modificati**:
- `core/admin/gestisci-utenti-standalone.html`
- `core/auth/registrazione-invito-standalone.html`
- `core/admin/gestione-squadre-standalone.html`
- `core/admin/impostazioni-standalone.html`
- `core/terreni-standalone.html`
- `core/models/Terreno.js`
- `core/dashboard-standalone.html`

## 📝 Aggiornamenti Recenti (2025-01-20)

### Riorganizzazione Dashboard Manager con Manodopera Attivo ✅
- **Problema**: Dashboard confusa con duplicazione tra diario manuale Core Base e diario automatico
- **Soluzione**: 
  - Core Base nascosto quando Manodopera è attivo (Manager e Amministratore)
  - Card Amministrazione che porta a pagina dedicata
  - Card Statistiche che porta a pagina dedicata
  - Sezione Gestione Manodopera completa mantenuta
  - Diario da Lavori come sezione principale
- **Risultato**: Dashboard più pulita, organizzata e intuitiva
- **File modificati**: `core/dashboard-standalone.html`

### Pagina Amministrazione Dedicata ✅
- **File creato**: `core/admin/amministrazione-standalone.html`
- **Funzionalità**:
  - Statistiche: Piano Attuale, Moduli Attivi, Utenti Totali
  - Card cliccabili: Gestisci Utenti, Gestione Squadre, Abbonamento
  - Design coerente con altre pagine admin
  - Verifica permessi automatica

### Pagina Statistiche Manodopera Dedicata ✅
- **File creato**: `core/admin/statistiche-manodopera-standalone.html`

### Calcolo Compensi Operai ✅
- **File creato**: `core/admin/compensi-operai-standalone.html`
- **Funzionalità**: Pagina dedicata per calcolo compensi operai
- **Sistema tariffe**: Tariffe default configurabili per tipo operaio + tariffe personalizzate per singolo operaio
- **Calcolo automatico**: Basato su ore validate nel periodo selezionato
- **Esportazione Excel**: Formato professionale con logo aziendale, colori, formattazione completa
- **Formato ore**: Leggibile (es. "64h 10min" invece di "64.17")
- **Accesso**: Solo Manager/Amministratore, richiede modulo Manodopera attivo
- **Statistiche implementate**:
  - Lavori: Totali, Attivi, Completati, Pianificati
  - Ore: Validate (Mese/Totale), Da Validare, Media Ore/Giorno
  - Squadre: Totali, Attive, Operai Totali, Operai Online
  - Superficie: Lavorata, Totale Terreni, % Lavorata
- **Struttura modulare**: Facile aggiungere nuove statistiche in futuro
- **File modificati**: `core/dashboard-standalone.html` (aggiunta card Statistiche)

### Mappa Aziendale Dashboard Manager ✅
- **Layout superiore dashboard Manager**:
  - Riga superiore con layout a 2 colonne:
    - Sinistra: 3 card verticali (Amministrazione, Statistiche, Terreni)
    - Destra: Mappa Aziendale grande che occupa tutto lo spazio disponibile
  - Layout responsive: su schermi <1024px le card si impilano sopra la mappa
- **Mappa satellitare completa**:
  - Visualizzazione tutti i terreni con confini geolocalizzati (poligoni)
  - Mappa satellitare Google Maps con zoom automatico su tutti i terreni
  - Colori distinti per coltura (palette predefinita: Vite, Frutteto, Seminativo, ecc.)
  - Legenda colture dinamica (si aggiorna in base ai terreni presenti)
  - Click su terreno per vedere info dettagliate (nome, podere, coltura, superficie, note)
  - Info window con link diretto a dettagli terreno
  - Visualizzazione solo terreni con mappa tracciata
- **Responsive design**:
  - Desktop (>1200px): colonna sinistra 280px, mappa occupa il resto
  - Tablet (1024-1200px): colonna sinistra 260px, mappa più larga
  - Tablet piccolo (<1024px): layout verticale (card sopra, mappa sotto)
  - Mobile (<768px): mappa compatta con altezza ridotta
  - Ridimensionamento automatico mappa al cambio dimensione finestra
- **Integrazione dashboard**:
  - Mappa visibile per Manager e Amministratore
  - Posizionata in alto dopo le card Amministrazione/Statistiche
  - Sotto la mappa: Gestione Manodopera e Diario da Lavori
  - Allineamento perfetto con margine destro sezione "Gestione Manodopera"
- **File modificati**: `core/dashboard-standalone.html`

### Miglioramenti Mappa Aziendale Fase 2 ✅ COMPLETATI (2025-01-20)

**1. Overlay Lavori Attivi** ✅
- Visualizzazione zone lavorate come poligoni verdi semi-trasparenti sulla mappa
- Toggle nell'header per mostrare/nascondere overlay
- Info window con dettagli lavoro quando si clicca su zona lavorata
- Caricamento automatico lavori attivi e zone lavorate dal modulo Manodopera
- Legenda aggiornata con sezione "Zone Lavorate"

**2. Filtri Podere e Coltura** ✅
- Dropdown filtri nell'header mappa (Podere e Coltura)
- Filtraggio dinamico terreni visualizzati sulla mappa
- Filtri combinabili (podere E coltura)
- Legenda aggiornata automaticamente in base ai filtri attivi
- Zoom automatico sui terreni filtrati

**3. Indicatori Stato Lavori** ✅
- Marker colorati per ogni lavoro attivo sulla mappa
- Colori: rosso (in ritardo), giallo (in tempo), verde (in anticipo), blu (in corso)
- Marker posizionati al centro del terreno associato
- Info window completa con dettagli lavoro (nome, terreno, tipo, stato, progresso, superficie, date)
- Toggle nell'header per mostrare/nascondere indicatori
- Legenda aggiornata con spiegazione colori indicatori

**4. Zoom Automatico Migliorato** ✅
- Padding personalizzato (50px standard, 100px per aree grandi) per evitare taglio bordi
- Zoom intelligente basato su dimensione area:
  - Terreni molto piccoli: zoom ravvicinato (livello 18)
  - Terreni normali: zoom automatico con padding standard
  - Aree molto grandi: zoom più lontano con padding maggiore
- Zoom automatico quando si applicano filtri
- Gestione responsive al ridimensionamento finestra

**File modificati**: `core/dashboard-standalone.html`

## 📝 Aggiornamenti Recenti (2025-01-20) - Mappa Aziendale

### Mappa Aziendale Dashboard Manager ✅
- **Layout superiore dashboard Manager**:
  - Riga superiore con layout a 2 colonne:
    - Sinistra: 3 card verticali (Amministrazione, Statistiche, Terreni)
    - Destra: Mappa Aziendale grande che occupa tutto lo spazio disponibile
  - Layout responsive: su schermi <1024px le card si impilano sopra la mappa
- **Mappa satellitare completa**:
  - Visualizzazione tutti i terreni con confini geolocalizzati (poligoni)
  - Mappa satellitare Google Maps con zoom automatico su tutti i terreni
  - Colori distinti per coltura (palette predefinita)
  - Legenda colture dinamica
  - Click su terreno per vedere info dettagliate
  - Responsive design per tutti i dispositivi
- **Integrazione dashboard**:
  - Mappa visibile per Manager e Amministratore
  - Posizionata in alto dopo le card Amministrazione/Statistiche
  - Sotto la mappa: Gestione Manodopera e Diario da Lavori
  - Allineamento perfetto con margine destro sezione "Gestione Manodopera"

**File modificati**: `core/dashboard-standalone.html`

### Miglioramenti Pianificati Mappa Aziendale (Fase 2)
**Priorità implementazione**:
1. **Overlay Lavori Attivi** (Alta priorità) - Visualizzazione zone lavorate sulla mappa
2. **Filtri (Podere, Coltura)** (Media priorità) - Filtrare terreni per podere/coltura
3. **Indicatori Stato Lavori** (Media priorità) - Marker colorati per lavori attivi
4. **Zoom Automatico Migliorato** (Bassa priorità) - Miglioramenti zoom esistente

## 📝 Aggiornamenti Recenti (2025-01-21)

### Gestione Contratti Operai ✅
**Data completamento**: 2025-01-21

**File creati**:
- `core/admin/gestione-operai-standalone.html` - Pagina dedicata gestione contratti operai

**File modificati**:
- `core/models/User.js` - Aggiunti campi contratto (tipoOperaio, tipoContratto, dataInizioContratto, dataScadenzaContratto, noteContratto)
- `core/dashboard-standalone.html` - Aggiunto link Gestione Operai nella sezione Amministrazione
- `core/admin/amministrazione-standalone.html` - Aggiunta card Gestione Operai

**Funzionalità implementate**:
- ✅ Pagina Gestione Operai con filtro automatico per ruolo "operaio"
- ✅ Tabella completa con colonne: Nome, Email, Tipo Operaio, Tipo Contratto, Data Inizio, Data Scadenza, Alert, Azioni
- ✅ Tipi Operai: 6 tipi predefiniti (Semplice, Specializzato, Trattorista, Meccanico, Elettricista, Altro)
- ✅ Gestione Contratti: Tipo Contratto (Stagionale/Determinato/Indeterminato), Date Inizio/Scadenza, Note
- ✅ Sistema Semaforo Alert: Verde (>30 giorni), Giallo (8-30 giorni), Rosso (0-7 giorni), Grigio (scaduto)
- ✅ Filtri Avanzati: Per Stato, Tipo Contratto, Tipo Operaio, Alert
- ✅ Storico Contratti: Contratti scaduti rimangono visibili per storico
- ✅ Validazione: Data scadenza >= data inizio, campi obbligatori verificati
- ✅ Permessi: Solo Manager/Amministratore può vedere/modificare contratti

**Vantaggi**:
- ✅ Scadenziario completo per monitorare rinnovi contratti
- ✅ Sistema alert automatico per non perdere scadenze
- ✅ Tipi operai pronti per calcolo compensi futuri
- ✅ Storico completo contratti per tracciabilità
- ✅ Semplice e funzionale, senza complessità normative

**File modificati**:
- `core/models/User.js`
- `core/admin/gestione-operai-standalone.html`
- `core/dashboard-standalone.html`
- `core/admin/amministrazione-standalone.html`

### Report Ore Operai con Filtri Avanzati ✅
**Data completamento**: 2025-01-21

**File modificati**:
- `core/admin/statistiche-manodopera-standalone.html` - Aggiunta sezione Report Ore Operai completa

**Funzionalità implementate**:
- ✅ Sezione Report Ore Operai nella pagina Statistiche Manodopera
- ✅ Filtri periodo: Oggi / Questa Settimana / Questo Mese / Personalizzato
- ✅ Filtro per Tipo Operaio: Tutti i 6 tipi disponibili
- ✅ Filtro per Singolo Operaio: Dropdown con lista operai completa
- ✅ Aggiornamento automatico con debounce (700ms) quando si cambiano i filtri
- ✅ Statistiche aggregate: Ore Totali, Media Ore/Giorno, Giorni Lavorati, Operai Attivi
- ✅ Statistiche per tipo operaio: Card con ore aggregate per categoria
- ✅ Tabella report operai: Colonne complete con ordinamento automatico
- ✅ Formattazione ore leggibile (es. "8h 30min")
- ✅ Colori distinti per ore validate (verde) e da validare (giallo)
- ✅ Pulsante "Pulisci Filtri" per reset rapido

**Vantaggi**:
- ✅ Analisi rapida ore lavorate per periodo/tipo/singolo operaio
- ✅ Aggiornamento automatico senza click ripetuti (miglior UX)
- ✅ Statistiche aggregate sempre aggiornate in base ai filtri
- ✅ Flessibilità filtri combinati per analisi approfondite
- ✅ Performance ottimizzata con debounce per evitare query multiple

**File modificati**:
- `core/admin/statistiche-manodopera-standalone.html`

### Calcolo Compensi Operai ✅
**Data completamento**: 2025-01-23

**File creati**:
- `core/admin/compensi-operai-standalone.html` - Pagina dedicata calcolo compensi operai

**File modificati**:
- `core/models/User.js` - Aggiunto campo `tariffaPersonalizzata`
- `core/admin/impostazioni-standalone.html` - Aggiunta sezione "Tariffe Operai"
- `core/admin/gestione-operai-standalone.html` - Aggiunto campo tariffa personalizzata
- `core/admin/statistiche-manodopera-standalone.html` - Rimossa sezione compensi, aggiunto link
- `core/dashboard-standalone.html` - Aggiunto link Compensi Operai
- `core/admin/amministrazione-standalone.html` - Aggiunta card Compensi Operai

**Funzionalità implementate**:
- ✅ Pagina dedicata per calcolo compensi (separata da Statistiche)
- ✅ Sistema tariffe: default per tipo operaio + personalizzate per singolo operaio
- ✅ Calcolo automatico basato su ore validate nel periodo selezionato
- ✅ Filtri: periodo (oggi/settimana/mese/personalizzato), tipo operaio, singolo operaio
- ✅ Statistiche aggregate: compenso totale, operai compensati, ore compensate, media
- ✅ Formato ore leggibile: "64h 10min" invece di "64.17"
- ✅ Esportazione Excel professionale:
  - Formato .xlsx nativo (nessun alert Excel)
  - Logo aziendale grande e leggibile (righe 1-7)
  - Formattazione completa con colori (intestazioni verdi, righe alternate, colonna compensi evidenziata)
  - Formato numeri: ore leggibili, tariffe e compensi in euro italiano
  - Tabella inizia dalla riga 8 con margine superiore corretto

**Vantaggi**:
- ✅ Gestione finanziaria dedicata (non più in Statistiche)
- ✅ Sistema tariffe flessibile e scalabile
- ✅ Esportazione professionale pronta per condivisione/documentazione
- ✅ Pronto per integrazione futura con modulo Bilancio

**File modificati**:
- `core/admin/compensi-operai-standalone.html`
- `core/admin/statistiche-manodopera-standalone.html`
- `core/admin/impostazioni-standalone.html`
- `core/admin/gestione-operai-standalone.html`
- `core/models/User.js`
- `core/dashboard-standalone.html`
- `core/admin/amministrazione-standalone.html`

### Fix Superficie Lavorata Dashboard Manager ✅
**Data completamento**: 2025-01-21

**Problema risolto**:
- La card "Superficie Lavorata" nella dashboard Manager mostrava sempre 0.00 HA
- Causa: campo cercato era `superficieLavorata` invece di `superficieTotaleLavorata`

**Correzioni applicate**:
- ✅ Corretto campo nella dashboard Manager (`loadManagerManodoperaStats()`)
- ✅ Corretto campo nella pagina Statistiche (`loadSuperficieStats()`)
- ✅ Corretti riferimenti in Gestione Lavori con fallback per compatibilità
- ✅ Migliorata funzione `loadProgressiLavoro()` per usare prima campo documento

**Risultato**:
- ✅ La superficie lavorata ora mostra correttamente gli ettari lavorati
- ✅ Dati calcolati dalle zone tracciate dai caposquadra
- ✅ Compatibilità con lavori vecchi senza campo aggiornato

**File modificati**:
- `core/dashboard-standalone.html`
- `core/admin/statistiche-manodopera-standalone.html`
- `core/admin/gestione-lavori-standalone.html`

## 📝 Aggiornamenti Recenti (2025-01-23)

### Separazione Dashboard Core Base/Modulo Manodopera ✅
**Data completamento**: 2025-01-23

**Problema risolto**: Dashboard mostrava sezioni Amministrazione e mappa avanzata anche quando il modulo Manodopera era disattivato, creando confusione.

**Soluzione implementata**:
- ✅ **Dashboard pulita senza Manodopera**:
  - Rimossa completamente sezione Amministrazione quando Manodopera è disattivato
  - Link "Invita Collaboratore" nell'header nascosto quando Manodopera è disattivato
  - Solo funzionalità Core Base visibili (Terreni, Diario Attività, Statistiche, Abbonamento)
- ✅ **Mappa semplificata Core Base**:
  - Versione base quando Manodopera è disattivato: solo visualizzazione terreni
  - Nessun filtro avanzato, overlay lavori, indicatori lavori
  - Legenda base solo con colture
- ✅ **Mappa completa con Manodopera**:
  - Mantiene tutte le funzionalità avanzate quando Manodopera è attivo
  - Filtri, overlay, indicatori disponibili

**Vantaggi**:
- ✅ Dashboard pulita e focalizzata quando Manodopera è disattivato
- ✅ Separazione logica chiara tra Core Base e moduli avanzati
- ✅ Mappa semplificata funziona correttamente senza dipendenze dal modulo

**File modificati**: `core/dashboard-standalone.html`

### Fix Configurazione Google Maps ✅
**Data completamento**: 2025-01-23

**Problema risolto**: Google Maps API key non veniva caricata correttamente, mappa non visualizzata.

**Soluzione implementata**:
- ✅ Corretto percorso file config Google Maps
- ✅ Caricamento config prima di inizializzare API
- ✅ Gestione corretta timing: config → Firebase → Google Maps API
- ✅ Controlli dimensioni container
- ✅ Resize trigger per forzare rendering
- ✅ Logging dettagliato per debugging

**Risultato**:
- ✅ Mappa visualizzata correttamente sia con che senza Manodopera
- ✅ Config caricato correttamente da file locale o fallback GitHub
- ✅ Funziona sia in locale che online

**File modificati**: `core/dashboard-standalone.html`

### Refactoring Dashboard Standalone ✅
**Data completamento**: 2025-01-23

**Problema identificato**:
- File `dashboard-standalone.html` troppo grande (4864 righe)
- Mix di HTML, CSS e JavaScript nello stesso file
- Difficile manutenzione e debugging

**Soluzione implementata**:
- ✅ **CSS estratto**: ~515 righe → `styles/dashboard.css`
- ✅ **Config Loader estratto**: ~240 righe → `js/config-loader.js`
- ✅ **Utility Functions estratte**: ~110 righe → `js/dashboard-utils.js`
- ✅ **Sezioni Dashboard estratte**: ~600+ righe → `js/dashboard-sections.js`

**Risultati**:
- ✅ Riduzione file HTML: **4864 → 3374 righe (-30.6%)**
- ✅ Codice più modulare e organizzato
- ✅ Funzionalità mantenute al 100%
- ✅ Compatibile con `file://` e server HTTP

**File creati**:
- `core/styles/dashboard.css`
- `core/js/config-loader.js`
- `core/js/dashboard-utils.js`
- `core/js/dashboard-sections.js`

**File modificati**:
- `core/dashboard-standalone.html`

---

## 🔧 Sistema Segnalazione e Gestione Guasti Macchine (2025-01-24)

### Funzionalità Implementate

#### 1. Segnalazione Guasti Operai
- ✅ Pagina dedicata per operai (`core/admin/segnalazione-guasti-standalone.html`)
- ✅ Precompilazione automatica campi:
  - Trattore assegnato al lavoro corrente
  - Attrezzo assegnato al lavoro corrente
  - Lavoro attivo più recente
- ✅ Supporto lavori autonomi e lavori di squadra
- ✅ Selezione gravità guasto (grave/non grave)
- ✅ Campo dettagli guasto
- ✅ Aggiornamento automatico stato macchine
- ✅ Sospensione automatica lavori per guasti gravi
- ✅ Risoluzione guasti con note e costo riparazione

#### 2. Gestione Guasti Manager
- ✅ Pagina dedicata per manager (`core/admin/gestione-guasti-standalone.html`)
- ✅ Visualizzazione tutti i guasti (aperti e risolti)
- ✅ Filtri per stato, gravità, macchina
- ✅ Azioni manager:
  - Approvare continuazione lavoro (guasti non gravi)
  - Sospendere lavoro (qualsiasi guasto)
  - Risolvere guasto
  - Riaprire guasto risolto
- ✅ Storico guasti per macchina
- ✅ Integrazione dashboard manager (card real-time)

#### 3. Correzioni e Miglioramenti
- ✅ Fix errori sintassi ES6 modules (import statements)
- ✅ Fix ricerca lavori attivi (stati multipli)
- ✅ Fix visualizzazione terreno nella dashboard operaio
- ✅ Fix calcolo automatico stato progresso marcatori mappa
- ✅ Fix precompilazione automatica campi
- ✅ Fix gestione lavori assegnati tramite caposquadra

#### 4. Calcolo Stato Progresso Lavori
- ✅ Calcolo automatico `giorniEffettivi` dalla `dataInizio`
- ✅ Calcolo automatico `percentualeCompletamento` da superficie
- ✅ Calcolo automatico `statoProgresso` (in_ritardo/in_tempo/in_anticipo)
- ✅ Marcatori mappa colorati con stato progresso

**File creati**:
- `core/admin/segnalazione-guasti-standalone.html` (NUOVO)
- `core/admin/gestione-guasti-standalone.html` (NUOVO)

**File modificati**:
- `core/dashboard-standalone.html` (card guasti + calcolo progresso)
- `core/js/dashboard-sections.js` (link segnalazione guasti)

---

## 🚜 Integrazione Modulo Macchine nel Core Base ✅ (2025-01-24)

### Obiettivo
Integrare il modulo Parco Macchine nel Core Base per permettere tracciamento macchine anche senza modulo Manodopera, con compatibilità totale quando Manodopera viene aggiunto successivamente.

### Funzionalità Implementate

#### 1. Service Unificato Macchine Utilizzo ✅
- **File creato**: `modules/parco-macchine/services/macchine-utilizzo-service.js`
- Funzione riutilizzabile `aggiornaOreMacchinaDaUtilizzo()` per aggiornare ore macchine
- Verifica automatica manutenzioni e alert quando superate
- Usabile da Core Base (Diario Attività) e modulo Manodopera (Segna Ore/Validazione Ore)
- Calcolo ore macchina default basato su ore lavoratore

#### 2. Diario Attività con Macchine ✅
- **File modificato**: `core/attivita-standalone.html`
- Campo "Ora fine" reso opzionale (non più obbligatorio)
- Dropdown trattori e attrezzi (solo se modulo Parco Macchine attivo)
- Compatibilità attrezzi basata su CV trattore (filtro automatico)
- Campo ore macchina separato da ore lavoratore
- **Liberazione automatica macchine** quando c'è "ora fine" (attività completata)
- **Impostazione "in_uso"** quando non c'è "ora fine" (attività in corso)
- **Controllo conflitti orario**: previene sovrapposizioni stessa macchina/attrezzo stesso orario/data
- **Fallback automatico**: libera macchine di attività del giorno precedente senza "ora fine"
- Visualizzazione macchine nella lista attività
- Gestione modifica attività: libera macchine vecchie se cambiate, gestisce aggiunta/rimozione "ora fine"
- **Struttura gerarchica tipi lavoro** (2025-01-24):
  - Quando Macchine o Manodopera attivo, usa struttura gerarchica (Categoria → Sottocategoria → Tipo Lavoro)
  - Lista piatta rimane disponibile quando nessun modulo attivo
  - Compatibilità completa: stessa logica sia con solo Macchine, sia con Manodopera attivo
  - Campo coltura aggiunto anche nella struttura gerarchica, popolato automaticamente dai terreni
  - Modali per creare categorie e tipi lavoro direttamente dal diario
  - Layout modali corretto con pulsanti sempre visibili (z-index, padding, stili)
  - Gestione errori CORS per ambiente file:// migliorata

#### 3. Gestione Lavori con Macchine ✅
- **File modificato**: `core/admin/gestione-lavori-standalone.html`
- Liberazione automatica macchine quando lavoro completato/approvato
- Correzione automatica macchine di lavori già completati (funzione `correggiMacchineLavoriCompletati()`)
- Popolamento dropdown trattori quando si apre modal creazione/modifica lavoro
- Log dettagliati per debugging gestione macchine

#### 4. Lavori Caposquadra con Macchine ✅
- **File modificato**: `core/admin/lavori-caposquadra-standalone.html`
- Liberazione automatica macchine quando lavoro raggiunge 100% completamento

#### 5. Refactoring Validazione Ore ✅ (2025-01-24)
- **File modificato**: `core/admin/validazione-ore-standalone.html`
- Rimossa funzione duplicata `aggiornaOreMacchina()` (75+ righe di codice duplicato)
- Sostituita con chiamata al service unificato `macchine-utilizzo-service.js`
- Aggiunta funzione `loadMacchineUtilizzoService()` per caricamento dinamico del service
- Gestione ambiente file:// (CORS) migliorata
- Zero duplicazione codice: logica centralizzata nel service unificato
- Compatibilità totale mantenuta: stesse funzionalità, codice più pulito e manutenibile
- Le ore macchina vengono aggiornate solo alla validazione (non alla segnatura)

#### 6. Correzione Barra Progresso Lavori Completati ✅ (2025-01-24)
- **Problema identificato**: Lavori completati (soprattutto conto terzi) mostravano barra progresso a 0% anche se completati
- **File modificato**: `core/dashboard-standalone.html`
  - Funzione `loadRecentLavoriManagerManodopera()`: aggiunta visualizzazione barra progresso
  - Funzione `loadRecentLavori()`: aggiunta visualizzazione barra progresso
  - Lavori completati mostrano automaticamente 100% se `percentualeCompletamento` è 0 o mancante
  - Badge "Conto Terzi" visualizzato correttamente nella lista lavori recenti
  - Caricamento terreni per calcolo percentuale se mancante
- **File modificato**: `core/admin/gestione-lavori-standalone.html`
  - Correzione calcolo percentuale per lavori completati nella tabella
  - Lavori completati mostrano 100% anche se `percentualeCompletamento` è 0 o mancante
  - Calcolo automatico percentuale da superficie lavorata/totale se mancante
  - Logica: se `stato === 'completato'` e `percentuale === 0`, imposta `percentuale = 100`

### Caratteristiche Principali

**Tracciamento Accurato**:
- Ore precise per terreno e macchina
- Possibilità di tracciare utilizzo macchina per ogni campo lavorato
- Statistiche accurate per macchina/attrezzo

**Gestione Automatica Stati**:
- Macchine liberate automaticamente quando attività completata (con "ora fine")
- Macchine impostate come "in_uso" quando attività in corso (senza "ora fine")
- Fallback automatico per attività del giorno precedente

**Controllo Conflitti**:
- Previene sovrapposizioni di orario per stessa macchina/attrezzo
- Permette utilizzo stesso trattore/attrezzo in orari diversi
- Gestisce correttamente attività completate vs attività in corso

**Compatibilità Moduli**:
- Funziona con solo Core Base + modulo Macchine
- Funziona con Core Base + modulo Macchine + modulo Manodopera
- Zero perdita dati quando si aggiungono/rimuovono moduli

### File Creati/Modificati
- ✅ `modules/parco-macchine/services/macchine-utilizzo-service.js` (NUOVO)
- ✅ `core/attivita-standalone.html` (MODIFICATO)
- ✅ `core/admin/gestione-lavori-standalone.html` (MODIFICATO)
- ✅ `core/admin/lavori-caposquadra-standalone.html` (MODIFICATO)
- ✅ `core/statistiche-standalone.html` (MODIFICATO - Sezione Statistiche Macchine aggiunta)
- ✅ `core/admin/validazione-ore-standalone.html` (MODIFICATO - Refactoring service unificato, 2025-01-24)
- ✅ `core/dashboard-standalone.html` (MODIFICATO - Correzione barra progresso lavori completati, 2025-01-24)

#### 5. Statistiche Macchine ✅
- **File modificato**: `core/statistiche-standalone.html`
- **Sezione "Statistiche Macchine"** (visibile solo se modulo Parco Macchine attivo):
  - **Metriche Cards**:
    - Ore Macchine Totali (somma di tutte le ore macchina nel periodo)
    - Macchine Utilizzate (numero di macchine diverse utilizzate)
    - Manutenzioni in Scadenza (conteggio prossimi 30 giorni / 50 ore)
    - Utilizzo Medio Macchina (ore medie per macchina)
  - **Grafici**:
    - Top 5 Macchine Più Utilizzate (bar chart orizzontale)
    - Ore Macchina per Terreno (bar chart verticale)
    - Ore Macchina vs Ore Lavoratore (grafico a ciambella comparativo)
    - Ore Macchine per Mese (line chart temporale)
  - **Dati unificati**: Combina dati da:
    - Attività Core Base (Diario Attività)
    - Ore operai (se modulo Manodopera attivo)
  - **Filtri applicati**: I filtri periodo/terreno/tipo lavoro si applicano anche alle statistiche macchine
  - **Compatibilità**: Funziona con e senza modulo Manodopera

## 📝 Aggiornamenti Recenti (2025-01-24)

### Refactoring Macchine e Correzione Barra Progresso (2025-01-24)

#### Refactoring Validazione Ore ✅
- **File modificato**: `core/admin/validazione-ore-standalone.html`
- Rimossa funzione duplicata `aggiornaOreMacchina()` (75+ righe di codice duplicato)
- Sostituita con chiamata al service unificato `macchine-utilizzo-service.js`
- Aggiunta funzione `loadMacchineUtilizzoService()` per caricamento dinamico del service
- Gestione ambiente file:// (CORS) migliorata
- Zero duplicazione codice: logica centralizzata nel service unificato
- Compatibilità totale mantenuta: stesse funzionalità, codice più pulito e manutenibile
- Le ore macchina vengono aggiornate solo alla validazione (non alla segnatura)

#### Correzione Barra Progresso Lavori Completati ✅
- **Problema identificato**: Lavori completati (soprattutto conto terzi) mostravano barra progresso a 0% anche se completati
- **File modificato**: `core/dashboard-standalone.html`
  - Funzione `loadRecentLavoriManagerManodopera()`: aggiunta visualizzazione barra progresso
  - Funzione `loadRecentLavori()`: aggiunta visualizzazione barra progresso
  - Lavori completati mostrano automaticamente 100% se `percentualeCompletamento` è 0 o mancante
  - Badge "Conto Terzi" visualizzato correttamente nella lista lavori recenti
  - Caricamento terreni per calcolo percentuale se mancante
- **File modificato**: `core/admin/gestione-lavori-standalone.html`
  - Correzione calcolo percentuale per lavori completati nella tabella
  - Lavori completati mostrano 100% anche se `percentualeCompletamento` è 0 o mancante
  - Calcolo automatico percentuale da superficie lavorata/totale se mancante
  - Logica: se `stato === 'completato'` e `percentuale === 0`, imposta `percentuale = 100`

---

### Correzione Tour Terreni (2025-01-24)

### Problema Identificato
Il tour della pagina terreni aveva problemi di posizionamento dei popup:
- Popup che coprivano elementi importanti (barra ricerca)
- Overlay evidenziato non allineato correttamente agli elementi
- Popup non leggibili o tagliati
- Problemi di refresh quando si navigava avanti/indietro nel tour

### Soluzioni Implementate

#### 1. Wrapper Barra Ricerca ✅
- **File modificato**: `core/terreni-standalone.html`
- **Problema**: L'overlay evidenziato non era allineato con la barra di ricerca
- **Soluzione**: Creato wrapper `#map-search-wrapper` che contiene input e pulsante "Cerca"
- **Risultato**: Overlay ora evidenzia correttamente l'area della barra di ricerca

#### 2. Posizionamento Popup Ottimizzato ✅
- **Popup barra ricerca**: Posizionato a sinistra (`position: 'left'`) per non coprire l'input
- **Popup tracciamento confini**: Posizionamento dinamico (~60% viewport) per ottimale leggibilità
- **Funzione `ensureTooltipVisible()`**: Gestisce posizionamento adattivo in base a dimensioni schermo
- **Margini dinamici**: Mobile (30px), Tablet (25px), Desktop (20px)

#### 3. Refresh Overlay Corretto ✅
- **Problema**: Overlay non si aggiornava correttamente quando si navigava avanti
- **Soluzione**: Logica di refresh con tentativi multipli (50ms, 150ms, 300ms, 500ms)
- **Calcolo diretto coordinate**: Overlay posizionato usando `getBoundingClientRect()` dell'elemento target
- **Gestione scroll**: Include `window.scrollY` e `window.scrollX` per coordinate corrette

#### 4. Gestione Modal Migliorata ✅
- **Apertura temporanea**: Modal aperto temporaneamente per costruire step correttamente
- **Chiusura/riapetura**: Modal chiuso prima del tour, riaperto quando necessario
- **Scroll intelligente**: Scroll automatico quando si apre/chiude il modal

#### 5. Ordine Step Ottimizzato ✅
- **Nuovo ordine**: Header → Pulsante aggiungi → Form/Mappa → Lista terreni
- **Lista terreni alla fine**: Spostata dopo tutti gli step del modal per migliore UX
- **Gestione apertura/chiusura**: Modal aperto per step form/mappa, chiuso per lista

### Caratteristiche Finali
- ✅ Popup sempre leggibili e posizionati correttamente
- ✅ Overlay evidenziato allineato perfettamente agli elementi
- ✅ Navigazione fluida avanti/indietro senza problemi di posizionamento
- ✅ Adattivo a diverse dimensioni schermo (mobile, tablet, desktop)
- ✅ Scroll automatico intelligente per mantenere tutto visibile

**File modificati**: `core/terreni-standalone.html`

---

## 📝 Aggiornamenti Recenti (2025-12-09) - Fix Statistiche e Permessi

### 1. Fix Visualizzazione Caposquadra nelle Statistiche Manodopera ✅

**Problema Identificato**:
- I caposquadra non venivano visualizzati correttamente nella tabella statistiche
- Il campo "Tipo Operaio" risultava vuoto per i caposquadra senza `tipoOperaio` impostato
- Il sistema leggeva solo `tipoOperaio`, ignorando il ruolo `caposquadra`

**Soluzione Implementata**:
- **Funzione `getTipoOperaioDisplay()`**: Combina ruolo e tipoOperaio per visualizzazione corretta
  - Se è caposquadra senza `tipoOperaio` → mostra "Caposquadra"
  - Se è caposquadra con `tipoOperaio` → mostra "Caposquadra - Trattorista" (esempio)
  - Se è solo operaio → mostra solo il tipoOperaio
- **Salvataggio ruoli**: Ora vengono salvati anche i `ruoli` quando si caricano i dati degli operai
- **Filtro aggiornato**: Aggiunta opzione "Caposquadra" nel dropdown filtro
- **Dropdown operai**: Ora include anche i caposquadra (non solo gli operai)

**Caratteristiche**:
- ✅ I caposquadra compaiono sempre nelle statistiche, anche senza `tipoOperaio` impostato
- ✅ Distinzione mantenuta tra ruolo (permessi) e tipo (classificazione)
- ✅ Possibilità di filtrare per "Caposquadra" nel dropdown
- ✅ Statistiche per tipo ora mostrano anche "Caposquadra" come categoria separata

**File modificati**: `core/admin/statistiche-manodopera-standalone.html`

---

### 2. Fix Permessi Firestore per Categorie Attrezzi ✅

**Problema Identificato**:
- Errore "Missing or insufficient permissions" in `gestione-macchine-standalone.html`
- La collezione `categorieAttrezzi` (vecchia collezione per migrazione) non aveva regole Firestore

**Soluzione Implementata**:
- Aggiunta regola Firestore per `categorieAttrezzi`:
  - **Lettura**: permessa per utenti autenticati del tenant
  - **Scrittura**: permessa solo per Manager/Amministratore del tenant
- Stessa logica della regola per `categorieLavori` (altra collezione vecchia per migrazione)

**File modificati**: `firestore.rules`

---

### 3. Fix Funzione escapeHtml Mancante in Statistiche ✅

**Problema Identificato**:
- Errore `ReferenceError: escapeHtml is not defined` in `statistiche-standalone.html`
- La funzione veniva chiamata ma non era definita nel file

**Soluzione Implementata**:
- Aggiunta funzione `escapeHtml()` per prevenire XSS quando si inserisce testo nell'HTML
- Funzione posizionata prima di `loadStatisticheTerreni()` dove viene utilizzata

**File modificati**: `core/statistiche-standalone.html`

---

## 📝 Aggiornamenti Recenti (2025-12-10) - Supporto Operai Autonomi e Comunicazioni

### 1. Regole Firestore per Comunicazioni ✅

**Problema Identificato**:
- Gli operai non potevano leggere le comunicazioni del tenant
- Gli operai non potevano confermare la ricezione delle comunicazioni (aggiornare campo `conferme`)

**Soluzione Implementata**:
- Aggiunta regola Firestore per `/tenants/{tenantId}/comunicazioni/{comunicazioneId}`:
  - **Lettura**: permessa per utenti autenticati del tenant (`isAuthenticated() && belongsToTenant(tenantId)`)
  - **Creazione**: permessa per caposquadra e manager/admin (`hasRole('caposquadra') || isManagerOrAdmin()`)
  - **Aggiornamento**: permessa per caposquadra/manager/admin O per operai che aggiornano solo il campo `conferme`
  - **Eliminazione**: permessa solo per manager/admin

**Caratteristiche**:
- ✅ Operai possono leggere tutte le comunicazioni del loro tenant
- ✅ Operai possono confermare la ricezione aggiornando il campo `conferme`
- ✅ Caposquadra e manager possono creare e gestire comunicazioni
- ✅ Solo manager/admin possono eliminare comunicazioni

**File modificati**: `firestore.rules`

---

### 2. Supporto Operai Autonomi - Segnatura Lavori Completati ✅

**Problema Identificato**:
- Gli operai autonomi non potevano segnare come completato i lavori autonomi assegnati a loro
- La funzione `segnaCompletato` in `lavori-caposquadra-standalone.html` supportava solo i caposquadra per lavori di squadra
- Le regole Firestore per `lavori` non permettevano agli operai di aggiornare i lavori autonomi

**Soluzione Implementata**:

#### A. Regole Firestore per Lavori - Operai Autonomi
- Aggiunta regola per permettere agli operai di aggiornare lavori autonomi assegnati a loro:
  - **Condizioni**: `hasRole('operaio') && resource.data.operaioId == request.auth.uid && resource.data.caposquadraId == null`
  - **Campi permessi**: `stato`, `percentualeCompletamentoTracciata`, `completatoDa`, `completatoIl`, `aggiornatoIl`
  - **Stati permessi**: `completato_da_approvare`, `in_corso`, o mantenere lo stato corrente
- Aggiunto campo `percentualeCompletamentoTracciata` alla lista dei campi permessi per operai

#### B. Funzione `segnaCompletato` Aggiornata
- **Supporto doppio**: Ora supporta sia caposquadra (lavori di squadra) che operai (lavori autonomi)
- **Verifica permessi**:
  - Per caposquadra: verifica che il lavoro sia di squadra (`caposquadraId == userId && operaioId == null`)
  - Per operai: verifica che il lavoro sia autonomo (`operaioId == userId && caposquadraId == null`)
- **Log di debug**: Aggiunti log dettagliati per tracciare:
  - Dati lavoro (ID, nome, caposquadraId, operaioId, stato)
  - Utente corrente (ID, ruoli)
  - Campi aggiornati
  - Esito operazione

#### C. Logica Visualizzazione Lavori Migliorata
- **Lavori "assegnato"**: Ora vengono mostrati anche se la data inizio è futura
- **Lavori "in_corso"**: Mostrati solo se la data inizio è oggi o passata
- **Log di debug**: Aggiunti log per tracciare totale lavori, lavori diretti, lavori inclusi

**Caratteristiche**:
- ✅ Operai autonomi possono segnare come completato i lavori autonomi assegnati a loro
- ✅ Caposquadra possono segnare come completato i lavori di squadra assegnati a loro
- ✅ Validazione permessi lato client e server (Firestore rules)
- ✅ Log dettagliati per debugging e tracciamento operazioni
- ✅ Messaggi di errore specifici per tipo di lavoro (squadra vs autonomo)

**File modificati**: 
- `firestore.rules`
- `core/admin/lavori-caposquadra-standalone.html`
- `core/dashboard-standalone.html`

---

### 3. Log di Debug Aggiunti ✅

**Miglioramenti Debug**:
- **`loadLavori()` in lavori-caposquadra-standalone.html**: Log per `isCaposquadra`, `isOperaio`, `userId`, `totaleLavori`
- **`segnaCompletato()`**: Log dettagliati per dati lavoro, utente corrente, permessi, campi aggiornati
- **`loadComunicazioniOperaio()` in dashboard-standalone.html**: Log per tracciare caricamento e filtraggio comunicazioni
- **`loadLavoriOggiOperaio()`**: Log per totale lavori, lavori diretti, lavori inclusi

**Caratteristiche**:
- ✅ Debug completo per tracciare flusso dati e permessi
- ✅ Facilita identificazione problemi di permessi o logica
- ✅ Log strutturati con emoji per facile identificazione

**File modificati**: 
- `core/admin/lavori-caposquadra-standalone.html`
- `core/dashboard-standalone.html`

---

## ✅ Evidenziazione Visiva Lavori Conto Terzi (2025-12-10)

### Obiettivo
Rendere immediatamente riconoscibili i lavori conto terzi rispetto ai lavori interni, sia nella gestione lavori che nel diario da lavori della dashboard.

### Implementazione

#### Gestione Lavori
- **File modificato**: `core/admin/gestione-lavori-standalone.html`
- **Filtro "Tipo Lavoro"**: Aggiunto filtro per separare lavori interni da conto terzi
  - Opzioni: Tutti i lavori, Lavori Interni, Conto Terzi
- **Evidenziazione visiva**: Gradiente blu/azzurro (`#E3F2FD` → `#BBDEFB`) per lavori conto terzi
  - Bordo sinistro blu (`#1976D2`)
  - Badge "💼 Conto Terzi" accanto al nome lavoro
  - Hover con gradiente più scuro
- **Logica filtraggio**: Filtra in base al campo `clienteId` (se presente = conto terzi)
- **Applicato a tutte le sezioni**: Tabella lavori normali e sezione lavori in attesa di approvazione

#### Dashboard - Diario da Lavori
- **File modificato**: `core/dashboard-standalone.html`
- **Evidenziazione visiva**: Stesso gradiente blu/azzurro per lavori conto terzi
  - Badge "💼 Conto Terzi" accanto al tipo lavoro
  - Stile CSS inline per evitare conflitti
- **Campo clienteId**: Aggiunto all'oggetto attività quando viene creata dalla funzione `loadDiarioDaLavori()`

### Caratteristiche
- ✅ Stile coerente con sezione Conto Terzi (colori blu distintivi)
- ✅ Riconoscimento immediato a colpo d'occhio
- ✅ Filtro funzionante insieme agli altri filtri esistenti
- ✅ Compatibile con tutti i moduli attivi

**File modificati**:
- `core/admin/gestione-lavori-standalone.html`
- `core/dashboard-standalone.html`

---

## ✅ Pianificazione Lavori Conto Terzi senza Manodopera (2025-12-10) - COMPLETATO

### Problema Risolto
Quando un utente ha solo **Core Base + Conto Terzi** (o **Core Base + Parco Macchine + Conto Terzi**), può creare lavori da preventivi accettati e ora può anche pianificarli perché la pagina "Gestione Lavori" è accessibile anche senza il modulo Manodopera attivo.

### Scenario Realistico
Piccolo proprietario che:
- Fa lavori conto terzi per clienti
- Ha trattori/attrezzi da gestire (Parco Macchine)
- Lavora da solo o con pochi collaboratori
- Non ha bisogno di gestione squadre/operai (Manodopera)

### Soluzione Implementata: Opzione 1 Rivista

**"Gestione Lavori" accessibile anche senza Manodopera**, con modalità semplificata:

#### Quando Manodopera NON è attivo:
- ✅ Mostra solo pianificazione base:
  - Nome lavoro
  - Terreno
  - Tipo lavoro
  - Data inizio
  - Durata prevista
  - Note
  - Stato (da_pianificare → in_corso → completato)
- ✅ Se Parco Macchine attivo: mostra anche assegnazione macchine (trattore/attrezzo)
- ✅ Nascondi completamente:
  - Assegnazione caposquadra/operai
  - Gestione squadre
  - Tracciamento zone lavorate
  - Segnatura/validazione ore
- ✅ Se lavoro ha `clienteId` (conto terzi): mostra anche dati cliente
- ✅ Generazione automatica voce diario quando lavoro completato

#### Quando Manodopera è attivo:
- ✅ Mostra tutte le funzionalità complete (come prima)

### Implementazione Tecnica
- ✅ Funzione `setupManodoperaVisibility()` nasconde/mostra elementi in base al modulo attivo
- ✅ Validazione semplificata: richiede solo terreno quando Manodopera non attivo
- ✅ Stato default `in_corso` quando Manodopera non attivo
- ✅ Funzione `generaVoceDiarioContoTerzi()` crea attività automaticamente
- ✅ Supporto completo Parco Macchine anche senza Manodopera
- ✅ Filtro `da_pianificare` funziona anche senza Manodopera

### Vantaggi
- ✅ Funziona in tutti gli scenari realistici
- ✅ Non duplica codice (una sola pagina che si adatta)
- ✅ Scalabile (se aggiungi Manodopera dopo, tutto funziona già)
- ✅ Non cambia il Core Base (pianificazione rimane opzionale)

### Impatto
- **Core Base**: Rimane "solo diario" per default
- **Pianificazione lavori**: Diventa disponibile solo se crei lavori da preventivi o manualmente
- **Non obbligatoria**: Puoi continuare a usare solo il diario attività

### File Modificati
- ✅ `core/admin/gestione-lavori-standalone.html` - Funzione `setupManodoperaVisibility()`, validazione semplificata, generazione voce diario

### Stato
✅ **Completato** (2025-12-10)

**File da modificare**:
- `core/admin/gestione-lavori-standalone.html` - Rimuovere blocco Manodopera, aggiungere modalità semplificata

---

## 🆕 Modifiche 2025-12-14

### Branding Email Preventivi con Logo Aziendale ✅ COMPLETATO

#### Configurazione Firebase Storage CORS
- ✅ **Installato Google Cloud SDK**: Installato Google Cloud SDK su Windows per accesso a `gsutil`
- ✅ **Configurato CORS Storage**: Configurato CORS sul bucket Firebase Storage (`gfv-platform.firebasestorage.app`) per permettere richieste da:
  - `https://vitaradragon.github.io` (GitHub Pages)
  - `http://localhost:*` (sviluppo locale)
  - `http://127.0.0.1:*` (sviluppo locale)
- ✅ **File creati**:
  - `cors.json`: Configurazione CORS per bucket Storage
  - `CONFIGURA_CORS_STORAGE.md`: Guida dettagliata per configurazione CORS
- ✅ **Comandi eseguiti**:
  ```bash
  gcloud init  # Configurazione progetto gfv-platform
  gsutil cors set cors.json gs://gfv-platform.firebasestorage.app
  gsutil cors get gs://gfv-platform.firebasestorage.app  # Verifica
  ```

#### Caricamento Logo Aziendale
- ✅ **Upload logo**: Implementata funzionalità completa per caricare logo aziendale nelle Impostazioni
  - File: `core/admin/impostazioni-standalone.html`
  - Input file con preview
  - Validazione file (solo immagini, max 2MB)
  - Normalizzazione tenant ID per percorsi Storage
  - Upload su Firebase Storage con metadata
  - Salvataggio `logoUrl` in Firestore tenant document
- ✅ **Eliminazione logo**: Implementata funzionalità per rimuovere logo esistente
  - Eliminazione da Firebase Storage
  - Rimozione `logoUrl` da Firestore
- ✅ **Visualizzazione logo**: Logo mostrato nell'anteprima e nelle email preventivi
- ✅ **Gestione errori**: Messaggi specifici per:
  - CORS errors
  - Permission errors
  - Network errors
  - Bucket not found
  - File protocol (file://) warnings

#### Regole Firebase Storage
- ✅ **File creato**: `storage.rules`
- ✅ **Regole implementate**:
  - Solo utenti autenticati del tenant possono upload/delete loghi
  - Validazione dimensione file (max 2MB)
  - Validazione content type (solo immagini)
  - Percorso: `tenants/{tenantId}/logo_*.{ext}`
- ✅ **Firebase.json aggiornato**: Aggiunta sezione `storage` con riferimento a `storage.rules`

#### Template Email Preventivi
- ✅ **Template EmailJS aggiornato**: Template completo con branding aziendale
  - Header più alto (40px padding, min-height 120px) per spazio logo
  - Logo aziendale nell'header (se presente)
  - Nome azienda ben formattato (bianco, 36px, bold, text-shadow)
  - Footer con dati azienda completi (nome, indirizzo, telefono, email, P.IVA)
- ✅ **Variabili EmailJS**:
  - `logo_url`: URL del logo (solo URL, non HTML)
  - `nome_azienda`: Nome azienda per header
  - `nome_azienda_footer`: Nome azienda per footer
  - `indirizzo_azienda`, `telefono_azienda`, `email_azienda`, `piva_azienda`: Dati azienda
- ✅ **File modificato**: `modules/conto-terzi/views/preventivi-standalone.html`
  - Preparazione variabili azienda per template email
  - Invio `logo_url` invece di HTML per evitare problemi EmailJS
  - Debug logging per verifica dati inviati

#### Risoluzione Problemi EmailJS
- ✅ **Problema "corrupted variables"**: Risolto usando solo URL per logo invece di HTML nelle variabili
- ✅ **Template HTML**: Template configurato correttamente per HTML con variabili semplici
- ✅ **Rendering logo**: Logo renderizzato correttamente usando `{{logo_url}}` direttamente nel tag `<img>`

#### Documentazione
- ✅ **File aggiornati**:
  - `GUIDA_CONFIGURAZIONE_FIREBASE.md`: Aggiunta sezione "STEP 9: Configura Firebase Storage"
  - `CONFIGURA_CORS_STORAGE.md`: Guida completa per configurazione CORS
  - `ISTRUZIONI_TEMPLATE_EMAIL_PREVENTIVO.md`: Aggiornate variabili EmailJS con dati azienda

### Risultato Finale
- ✅ Logo aziendale visibile nelle email preventivi
- ✅ Nome azienda ben formattato e leggibile nell'header email
- ✅ Dati azienda completi nel footer email
- ✅ Email funzionanti senza errori
- ✅ Branding aziendale invece di "GFV Platform" nelle email preventivi

---

## ✅ Rimozione Log Debug Completa (2025-01-26)

### Obiettivo
Rimuovere tutti i log di debug (`console.log`, `console.debug`, `console.info`) dal codice per preparare l'applicazione alla produzione, mantenendo solo i log critici (`console.error`, `console.warn`).

### Implementazione

#### Metodo Utilizzato
- ✅ **Script PowerShell automatico**: Creato script per rimozione batch di tutti i log
- ✅ **Pattern matching intelligente**: Rimuove righe con `console.log/debug/info` mantenendo indentazione corretta
- ✅ **Backup automatici**: Ogni file viene salvato con estensione `.backup` prima della modifica
- ✅ **Gestione multilinea**: Pattern regex gestisce anche log complessi con template literals

#### File Principali Processati
- ✅ **dashboard-standalone.html**: 180 log → 0 log
- ✅ **gestione-lavori-standalone.html**: 68 log → 0 log
- ✅ **attivita-standalone.html**: 36 log → 0 log
- ✅ **terreni-standalone.html**: 27 log → 0 log

#### File Secondari Processati
- ✅ **48 file HTML/JS** nella cartella `core/` processati automaticamente
- ✅ **314 log rimossi** dai file secondari
- ✅ File di autenticazione, admin, servizi, modelli tutti puliti

### Risultati

#### Statistiche Finali
- ✅ **Totale log rimossi**: 625 log
- ✅ **File processati**: 52 file (4 principali + 48 secondari)
- ✅ **Log rimanenti**: Solo 2 log nei file di documentazione (.md) - parte della documentazione, non da rimuovere
- ✅ **Tempo impiegato**: ~2 ore (incluso sviluppo script e verifica)

#### Tipi di Log Rimossi
- ✅ Log tour interattivi (`[TOUR DEBUG]`)
- ✅ Log caricamento dati Firebase
- ✅ Log inizializzazione Google Maps
- ✅ Log autenticazione e gestione ruoli
- ✅ Log tracciamento e validazione
- ✅ Log migrazione dati
- ✅ Log statistiche e calcoli

#### Log Mantenuti
- ✅ `console.error`: Per errori critici
- ✅ `console.warn`: Per warning importanti
- ✅ Log nei file di documentazione (.md): Parte della documentazione

### Vantaggi
- ✅ **Performance**: Nessun overhead da log inutili in produzione
- ✅ **Sicurezza**: Nessun leak di informazioni sensibili nella console
- ✅ **Professionalità**: Console pulita per utenti finali
- ✅ **Manutenibilità**: Codice più pulito e leggibile
- ✅ **Pronto per produzione**: Codice ottimizzato per deployment

### File Modificati
- ✅ Tutti i file HTML/JS nella cartella `core/` (52 file totali)
- ✅ File di backup creati automaticamente (poi rimossi)

### Stato
✅ **COMPLETATO** (2025-01-26)

Il codice è ora completamente pulito da log di debug e pronto per la produzione.

---

## 🔧 Miglioramento Sistema Guasti: Distinzione Trattore/Attrezzo (2025-01-26)

### Problema Identificato
Quando veniva segnalato un guasto per una combinazione "Trattore + Attrezzo", il sistema salvava entrambi gli ID ma non distingueva quale componente aveva effettivamente il guasto. Questo causava:
- **Storico guasti errato**: Lo storico dell'attrezzo non mostrava i guasti perché la query cercava solo per `macchinaId`
- **Tracciabilità imprecisa**: Impossibile sapere se un guasto era del trattore o dell'attrezzo
- **Gestione manutenzione**: Difficile gestire correttamente la manutenzione dei singoli componenti

### Soluzione Implementata

#### 1. Campo `componenteGuasto` nel Form Segnalazione ✅
- **File**: `core/admin/segnalazione-guasti-standalone.html`
- **Modifica**: Aggiunto dropdown obbligatorio "Componente con guasto" sempre visibile
- **Opzioni**: 
  - `trattore` - Guasto del trattore
  - `attrezzo` - Guasto dell'attrezzo
  - `entrambi` - Guasto di entrambi i componenti
- **Pre-selezione automatica**: Il dropdown si aggiorna automaticamente in base ai dropdown trattore/attrezzo selezionati
- **Validazione**: Verifica coerenza tra componente selezionato e trattore/attrezzo scelti

#### 2. Salvataggio e Gestione Stato ✅
- **File**: `core/admin/segnalazione-guasti-standalone.html`
- **Modifiche**:
  - Campo `componenteGuasto` salvato nel documento guasto
  - Aggiornamento stato macchina/attrezzo **solo** se il guasto riguarda quel componente specifico
  - Risoluzione guasto: ripristino stato solo per il componente interessato

#### 3. Query Storico Guasti Migliorata ✅
- **File**: `core/admin/gestione-macchine-standalone.html`
- **Modifiche**:
  - **Per trattori**: Cerca guasti dove `macchinaId` corrisponde E `componenteGuasto` è `'trattore'` o `'entrambi'`
  - **Per attrezzi**: Cerca guasti dove `attrezzoId` corrisponde E `componenteGuasto` è `'attrezzo'` o `'entrambi'`
  - Filtraggio in memoria per maggiore flessibilità (evita problemi con indici Firestore)

#### 4. Visualizzazione Migliorata ✅
- **File**: `core/admin/gestione-macchine-standalone.html`
- **Modifiche**:
  - Badge colorato che indica il componente interessato (Trattore, Attrezzo, Entrambi)
  - Visualizzazione aggiornata nella lista guasti per mostrare correttamente il componente

#### 5. Retrocompatibilità ✅
- Gestione di guasti esistenti senza campo `componenteGuasto` (default: `'trattore'`)
- Nessun breaking change per dati legacy

### Vantaggi
- ✅ **Storico corretto**: Lo storico del trattore mostra solo guasti del trattore, quello dell'attrezzo solo guasti dell'attrezzo
- ✅ **Tracciabilità precisa**: Chiaro quale componente ha avuto il guasto
- ✅ **Gestione manutenzione migliorata**: Possibilità di gestire correttamente la manutenzione dei singoli componenti
- ✅ **UX migliorata**: Pre-selezione automatica del componente riduce errori dell'utente
- ✅ **Retrocompatibilità**: Funziona con dati esistenti

### File Modificati
- ✅ `core/admin/segnalazione-guasti-standalone.html` - Form segnalazione con dropdown componente
- ✅ `core/admin/gestione-macchine-standalone.html` - Query e visualizzazione storico guasti migliorata

### Stato
✅ **COMPLETATO** (2025-01-26)

Il sistema di segnalazione guasti ora distingue correttamente tra trattore e attrezzo, permettendo una gestione più precisa della manutenzione.

## ✅ Ripristino Funzione Comunicazione Rapida Dashboard Caposquadra (2025-12-28) - COMPLETATO

### Obiettivo
Ripristinare la funzionalità di comunicazione rapida nella dashboard del caposquadra che era rimasta bloccata in "Caricamento lavori..." a causa della mancanza della funzione `renderComunicazioneRapidaForm`.

### Problema Identificato
- La sezione "Invia Comunicazione Rapida alla Squadra" nella dashboard del caposquadra rimaneva bloccata in "Caricamento lavori..."
- La funzione `window.renderComunicazioneRapidaForm` non era definita nel codice
- Durante un refactoring precedente, la funzione era stata rimossa dal file HTML ma non era stata ricreata in un modulo JavaScript
- Il codice in `loadComunicazioneRapida` cercava di chiamare la funzione ma non la trovava, quindi il form non veniva mai renderizzato

### Implementazione

#### 1. Creazione Funzione `renderComunicazioneRapidaForm` ✅
- **File**: `core/js/dashboard-data.js`
- Funzione esportata che renderizza il form HTML per la comunicazione rapida
- Legge i lavori attivi da `window.lavoriAttiviCaposquadra`
- Pre-compila automaticamente podere, terreno e lavoro dal primo lavoro attivo
- Mostra dropdown per selezionare lavoro se ce ne sono più di uno
- Include escape HTML per sicurezza dei dati inseriti

#### 2. Form HTML Renderizzato ✅
- **Campi del form**:
  - Dropdown selezione lavoro (se più lavori disponibili) o nome lavoro (se un solo lavoro)
  - Podere (campo di sola lettura, pre-compilato)
  - Campo/Terreno (campo di sola lettura, pre-compilato)
  - Orario di ritrovo (input time, default 07:00, obbligatorio)
  - Note (textarea opzionale)
  - Area messaggi per feedback successo/errore
  - Pulsante "Invia Comunicazione"

#### 3. Integrazione nel File Dashboard ✅
- **File**: `core/dashboard-standalone.html`
- Aggiunto import della funzione `renderComunicazioneRapidaForm` dal modulo `dashboard-data.js`
- Creato wrapper globale `window.renderComunicazioneRapidaForm` per compatibilità con attributi HTML `onchange`/`onsubmit`
- La funzione è ora disponibile globalmente e viene chiamata correttamente da `loadComunicazioneRapida`

#### 4. Event Handler Collegati ✅
- `handleRapidaLavoroChange()` - Aggiorna podere/terreno quando cambia il lavoro selezionato
- `handleSendComunicazioneRapida()` - Gestisce l'invio della comunicazione alla squadra
- `showRapidaMessage()` - Mostra messaggi di successo/errore

### Funzionalità Ripristinata
- ✅ Form di comunicazione rapida si carica correttamente
- ✅ Pre-compilazione automatica podere, terreno e lavoro
- ✅ Dropdown per selezionare lavoro se più lavori attivi
- ✅ Invio comunicazione rapida alla squadra con un click
- ✅ Coordinate podere salvate automaticamente (se disponibili) per Google Maps
- ✅ Link "Indicazioni" nella dashboard operai per raggiungere il punto di ritrovo

### File Modificati
- ✅ `core/js/dashboard-data.js` - Aggiunta funzione `renderComunicazioneRapidaForm` con escape HTML
- ✅ `core/dashboard-standalone.html` - Aggiunto import e wrapper globale per la funzione

### Note Tecniche
- La funzione usa `window.lavoriAttiviCaposquadra` (popolato da `loadComunicazioneRapida`)
- Escape HTML implementato per sicurezza (previene XSS)
- La funzione è modulare e può essere facilmente estesa in futuro
- Compatibilità mantenuta con event handler esistenti tramite wrapper globali

### Stato
✅ **COMPLETATO** (2025-12-28)

La comunicazione rapida nella dashboard del caposquadra è ora completamente funzionante. Il form si carica correttamente e permette di inviare comunicazioni alla squadra con pre-compilazione automatica dei dati dal lavoro selezionato.

---

## ✅ Fix Sistema Multi-Tenant: Switch Tenant e Dashboard (2026-01-12) - COMPLETATO

### Obiettivo
Risolvere i problemi del sistema multi-tenant dopo l'implementazione iniziale:
1. Lo switch tra tenant non funzionava correttamente
2. La dashboard mostrava sempre i dati del tenant precedente invece di quello corrente
3. I ruoli non venivano filtrati per il tenant corrente

### Implementazione

#### 1. Fix Switch Tenant - Problema getUserTenants() ✅
- **Problema**: Quando `switchTenant()` chiamava `getUserTenants()`, la variabile locale `currentUser` era `null`, causando l'errore "Utente non ha accesso a questo tenant"
- **Causa**: `getUserTenants()` dipendeva da `currentUser` locale che non era sempre sincronizzato con Firebase Auth
- **Soluzione**: 
  - Modificato `switchTenant()` per ottenere direttamente l'utente da Firebase Auth usando `getAuthInstance().currentUser`
  - Passato esplicitamente l'`userId` a `getUserTenants(userId)` invece di fare affidamento su `currentUser` locale
  - Aggiunto fallback in `getUserTenants()` per usare Firebase Auth direttamente se `currentUser` è `null`
- **File Modificati**:
  - ✅ `core/services/tenant-service.js` - Modificato `switchTenant()` e `getUserTenants()` per usare Firebase Auth come fonte affidabile

#### 2. Fix Dashboard - Filtro Ruoli per Tenant Corrente ✅
- **Problema**: La dashboard mostrava sempre la vista del tenant precedente perché usava `userData.ruoli` (tutti i ruoli dell'utente) invece dei ruoli filtrati per il tenant corrente
- **Causa**: `renderDashboard()` riceveva `userDataNormalized` con tutti i ruoli dell'utente, non filtrati per il tenant corrente
- **Soluzione**: 
  - Modificato il caricamento dati utente nella dashboard per usare `getUserRolesForTenant(currentTenantId, user.uid)` invece di `userData.ruoli`
  - Aggiunto fallback a `userData.ruoli` deprecato solo se non ci sono ruoli per il tenant corrente (retrocompatibilità)
  - Aggiornato `userDataNormalized` per includere `tenantId: currentTenantId` invece del tenant deprecato
- **File Modificati**:
  - ✅ `core/dashboard-standalone.html` - Modificato caricamento dati utente per filtrare ruoli per tenant corrente

#### 3. Fix Caricamento Dati - Uso getCurrentTenantId() invece di userData.tenantId ✅
- **Problema**: Le funzioni di caricamento dati (mappa, statistiche, lavori) usavano `userData.tenantId` deprecato che conteneva sempre il tenant originale, causando il caricamento dei dati del tenant sbagliato
- **Causa**: Tutte le funzioni `load*` usavano `userData.tenantId` invece di `getCurrentTenantId()` per ottenere il tenant corrente
- **Soluzione**: 
  - Modificato `loadManagerManodoperaStats()` per usare `getCurrentTenantId()` invece di `userData.tenantId`
  - Modificato `loadMappaAziendale()` per usare `getCurrentTenantId()` invece di `userData.tenantId`
  - Modificato `loadAndDrawZoneLavorate()` per usare `getCurrentTenantId()` invece di `userData.tenantId`
  - Modificato `loadAndDrawIndicatoriLavori()` per usare `getCurrentTenantId()` invece di `userData.tenantId`
  - Aggiunto fallback a `userData.tenantId` per retrocompatibilità
- **File Modificati**:
  - ✅ `core/js/dashboard-data.js` - Modificato `loadManagerManodoperaStats()` per usare tenant corrente
  - ✅ `core/js/dashboard-maps.js` - Modificato `loadMappaAziendale()`, `loadAndDrawZoneLavorate()`, `loadAndDrawIndicatoriLavori()` per usare tenant corrente

#### 4. Fix Caricamento Moduli Tenant Corrente ✅
- **Problema**: I moduli disponibili venivano caricati dal tenant deprecato invece che dal tenant corrente
- **Causa**: Il codice usava `userData.tenantId` per caricare i moduli dal documento tenant
- **Soluzione**: 
  - Modificato il caricamento moduli per usare `getCurrentTenantId()` invece di `userData.tenantId`
  - Applicato sia nel flusso principale che nel flusso di creazione documento utente
- **File Modificati**:
  - ✅ `core/dashboard-standalone.html` - Modificato caricamento moduli per usare tenant corrente

#### 5. Pulizia Log Debug ✅
- **Obiettivo**: Rimuovere tutti i log di debug aggiunti durante il troubleshooting, mantenendo solo gli errori critici
- **Implementazione**: 
  - Rimossi tutti i log `console.error` con prefissi `[GET_USER_TENANTS]`, `[SWITCH_TENANT]`, `[DASHBOARD]`, `[LOAD_MAPPA]`, `[ACCEPT_INVITO]`, `[REGISTRAZIONE]`
  - Mantenuti solo i log di errore critici (`console.error` per errori reali, `console.warn` per warning)
  - Rimossi log informativi che non sono necessari in produzione
- **File Modificati**:
  - ✅ `core/services/tenant-service.js` - Rimossi log debug da `getUserTenants()`, `switchTenant()`, `clearUserTenantsCache()`
  - ✅ `core/dashboard-standalone.html` - Rimossi log per tenant corrente, ruoli e moduli
  - ✅ `core/js/dashboard-data.js` - Rimosso log warning in `loadManagerManodoperaStats()`
  - ✅ `core/js/dashboard-maps.js` - Rimosso log warning in `loadAndDrawZoneLavorate()`
  - ✅ `core/services/invito-service-standalone.js` - Rimossi log debug, mantenuti solo errori critici
  - ✅ `core/auth/registrazione-invito-standalone.html` - Rimossi log debug, mantenuti solo errori critici

### Test Completati
- ✅ **Switch Tenant**: Funziona correttamente tra SABBIE GIALLE e ROSSO
- ✅ **Ruoli Filtrati**: La dashboard mostra i ruoli corretti per ogni tenant (manager in SABBIE GIALLE, caposquadra in ROSSO)
- ✅ **Dati Isolati**: I dati caricati (mappa, statistiche, lavori) appartengono al tenant corrente
- ✅ **Moduli Corretti**: I moduli disponibili sono quelli del tenant corrente
- ✅ **Vista Dashboard**: La dashboard mostra la vista corretta in base ai ruoli del tenant corrente

### File Modificati
- ✅ `core/services/tenant-service.js`
  - Modificato `switchTenant()` per usare Firebase Auth direttamente
  - Modificato `getUserTenants()` per aggiungere fallback a Firebase Auth
  - Rimossi log debug
- ✅ `core/dashboard-standalone.html`
  - Modificato caricamento dati utente per filtrare ruoli per tenant corrente
  - Modificato caricamento moduli per usare tenant corrente
  - Rimossi log debug
- ✅ `core/js/dashboard-data.js`
  - Modificato `loadManagerManodoperaStats()` per usare `getCurrentTenantId()`
  - Rimosso log warning
- ✅ `core/js/dashboard-maps.js`
  - Modificato `loadMappaAziendale()` per usare `getCurrentTenantId()`
  - Modificato `loadAndDrawZoneLavorate()` per usare `getCurrentTenantId()`
  - Modificato `loadAndDrawIndicatoriLavori()` per usare `getCurrentTenantId()`
  - Rimosso log warning
- ✅ `core/services/invito-service-standalone.js`
  - Rimossi log debug, mantenuti solo errori critici
- ✅ `core/auth/registrazione-invito-standalone.html`
  - Rimossi log debug, mantenuti solo errori critici

### Note Tecniche
- Il sistema multi-tenant ora funziona correttamente con isolamento completo dei dati per tenant
- I ruoli vengono filtrati correttamente per ogni tenant, permettendo a un utente di avere ruoli diversi in tenant diversi
- La dashboard si aggiorna correttamente quando si cambia tenant, mostrando i dati e la vista corretti
- Tutti i servizi ora usano `getCurrentTenantId()` invece di `userData.tenantId` deprecato per garantire coerenza
- Il codice è pulito e pronto per la produzione senza log di debug

### Stato
✅ **COMPLETATO** (2026-01-12)

Il sistema multi-tenant è ora completamente funzionante. Gli utenti possono appartenere a più tenant con ruoli diversi, e lo switch tra tenant funziona correttamente con isolamento completo dei dati e delle viste dashboard.


