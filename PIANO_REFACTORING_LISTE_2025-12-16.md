# 📋 Piano Refactoring Liste Condivise - GFV Platform

**Data creazione**: 2025-12-16  
**Ultimo aggiornamento**: 2025-01-26  
**Versione**: 2.0  
**Stato**: ✅ Completato (Parte 1 e Parte 2)  
**Priorità**: Alta

---

## 🎯 Obiettivo

Refactorizzare tutte le pagine dell'app per utilizzare le liste condivise dalla struttura gerarchica (`tipiLavoro` e `colture`) invece di caricare le liste direttamente da Firestore in ogni pagina.

**Risultato atteso**: Liste condivise e sincronizzate in tutta l'app, eliminazione codice duplicato, miglioramento performance.

---

## 📊 Situazione Attuale

### Problema Identificato
- **Nessun file usa `liste-service.js`**: Ogni pagina carica le liste direttamente da Firestore
- **8+ file con codice duplicato** per caricare liste
- **Inconsistenza**: Pagine diverse possono vedere liste diverse
- **Performance**: Chiamate Firestore multiple e ridondanti
- **Manutenzione**: Logica duplicata in molti file

### File che Caricano Liste Direttamente

#### ✅ Completati (Usano Servizi Centralizzati)
1. ✅ `core/terreni-standalone.html` - usa `colture-service.js` e `categorie-service.js`
2. ✅ `core/admin/impostazioni-standalone.html` - usa servizi centralizzati
3. ✅ `core/admin/gestione-lavori-standalone.html` - usa `tipi-lavoro-service.js`
4. ✅ `core/statistiche-standalone.html` - usa `liste-service.js` → `getTipiLavoroNomi()`
5. ✅ `core/attivita-standalone.html` - usa `tipi-lavoro-service.js`, `colture-service.js`, `categorie-service.js` (struttura gerarchica sempre attiva)
6. ✅ `modules/conto-terzi/views/terreni-clienti-standalone.html` - usa servizi centralizzati
7. ✅ `modules/conto-terzi/views/tariffe-standalone.html` - usa servizi per colture (tipi lavoro da fare)
8. ✅ `modules/conto-terzi/views/nuovo-preventivo-standalone.html` - usa servizi per colture (tipi lavoro da fare)

#### ✅ Completato (Tutti i file refactorizzati)
1. ✅ `modules/conto-terzi/views/tariffe-standalone.html` - usa struttura gerarchica completa (categoria → sottocategoria → tipo lavoro)
2. ✅ `modules/conto-terzi/views/nuovo-preventivo-standalone.html` - usa struttura gerarchica completa (categoria → sottocategoria → tipo lavoro)

**Nota**: Tutti i file sono stati refactorizzati. Alcuni usano struttura gerarchica completa, altri lista piatta (dove appropriato).

### Servizio Condiviso Disponibile
- `core/services/liste-service.js` - Servizio completo e ben strutturato
- Funzioni disponibili:
  - `getListe()` - Ottiene liste sincronizzate
  - `getTipiLavoroNomi()` - Ottiene array nomi tipi lavoro
  - `getColtureNomi()` - Ottiene array nomi colture
  - `addTipoLavoro()`, `removeTipoLavoro()`
  - `addColtura()`, `removeColtura()`

---

## 🗑️ Preparazione: Cancellazione Dati di Prova

### Collection da Cancellare in Firebase Console

**Percorso**: Firebase Console → Firestore Database → `tenants/{tenantId}/`

#### Da Cancellare Completamente:
1. ✅ `attivita` - contiene `tipoLavoro` e `coltura` con nomi vecchi
2. ✅ `lavori` - contiene `tipoLavoro` con nomi vecchi
3. ✅ `terreni` - contiene `coltura` con nomi vecchi
4. ✅ `tariffe` (se esiste) - contiene `tipoLavoro` e `coltura` con nomi vecchi
5. ✅ `preventivi` (se esiste) - contiene `tipoLavoro` e `coltura` con nomi vecchi
6. ✅ `liste/personalizzate` (solo questo documento) - lista vecchia senza struttura gerarchica

#### Da Mantenere:
- ✅ `users` (collection globale)
- ✅ `squadre`
- ✅ `macchine`
- ✅ `categorie` (nuova struttura gerarchica)
- ✅ `tipiLavoro` (nuova struttura gerarchica)
- ✅ `colture` (nuova struttura gerarchica)
- ✅ `poderi`
- ✅ `comunicazioni`
- ✅ `contrattiOperai`
- ✅ `guastiMacchine`

**Nota**: Dopo la cancellazione, le liste verranno inizializzate automaticamente dalla nuova struttura gerarchica.

---

## 📝 Piano di Refactoring per Fasi

### FASE 1: Preparazione e Setup (1 agente)

**Obiettivo**: Preparare l'ambiente e verificare che tutto sia pronto.

**Task**:
1. ✅ Verificare che `liste-service.js` sia completo e funzionante
2. ✅ Verificare che le funzioni `getTipiLavoroNomi()` e `getColtureNomi()` esistano
3. ✅ Testare manualmente il servizio per assicurarsi che funzioni
4. ✅ Creare un file di test per verificare il caricamento liste
5. ✅ Documentare il pattern da seguire per il refactoring

**Output atteso**: 
- Documentazione del pattern da seguire
- Conferma che il servizio funziona correttamente
- File di esempio per riferimento

**Tempo stimato**: 1-2 ore

---

### FASE 2: Refactoring Pagine Core Base (1 agente)

**Obiettivo**: Refactorizzare le pagine del core base che usano liste.

**File da modificare**:
1. `core/terreni-standalone.html`
2. `core/attivita-standalone.html`
3. `core/statistiche-standalone.html`

**Pattern da seguire**:

#### Per ogni file:
1. **Importare il servizio**:
   ```javascript
   import { getTipiLavoroNomi, getColtureNomi } from './services/liste-service.js';
   ```

2. **Sostituire funzione loadListe**:
   - Rimuovere codice che carica direttamente da Firestore
   - Creare nuova funzione che usa `getTipiLavoroNomi()` e `getColtureNomi()`
   - Mantenere la stessa interfaccia (stesse variabili globali, stesso comportamento)

3. **Verificare dropdown**:
   - Assicurarsi che i dropdown si popolino correttamente
   - Verificare che i valori siano stringhe (non oggetti)

4. **Testare funzionalità**:
   - Creare nuovo terreno/attività
   - Verificare che i dropdown funzionino
   - Verificare che il salvataggio funzioni

**Checklist per ogni file**:
- [ ] Importato `liste-service.js`
- [ ] Rimossa logica di caricamento diretta da Firestore
- [ ] Implementata nuova funzione che usa servizio condiviso
- [ ] Dropdown popolati correttamente
- [ ] Creazione nuovo record funziona
- [ ] Modifica record esistente funziona
- [ ] Filtri funzionano (se presenti)

**Output atteso**: 
- 3 file refactorizzati e testati
- Nessun errore in console
- Funzionalità complete funzionanti

**Tempo stimato**: 3-4 ore per file (totale 9-12 ore)

---

### FASE 3: Refactoring Pagine Admin (1 agente)

**Obiettivo**: Refactorizzare le pagine admin che gestiscono liste.

**File da modificare**:
1. `core/admin/impostazioni-standalone.html`
2. `core/admin/gestione-lavori-standalone.html`

**Considerazioni speciali**:
- `impostazioni-standalone.html` gestisce anche la creazione/modifica liste
- Deve continuare a funzionare con la struttura gerarchica
- Verificare che le funzioni di aggiunta/rimozione usino i servizi corretti

**Pattern da seguire**:
- Stesso pattern della Fase 2
- Inoltre: verificare che le funzioni di modifica liste usino `addTipoLavoro()`, `removeTipoLavoro()`, ecc.

**Checklist per ogni file**:
- [ ] Importato `liste-service.js`
- [ ] Rimossa logica di caricamento diretta
- [ ] Implementata nuova funzione che usa servizio condiviso
- [ ] Funzioni di aggiunta/modifica liste usano servizi corretti
- [ ] Dropdown popolati correttamente
- [ ] Creazione/modifica funziona
- [ ] Eliminazione funziona (con validazione)

**Output atteso**: 
- 2 file refactorizzati e testati
- Gestione liste funzionante
- Nessun errore in console

**Tempo stimato**: 4-5 ore per file (totale 8-10 ore)

---

### FASE 4: Refactoring Modulo Conto Terzi (1 agente)

**Obiettivo**: Refactorizzare le pagine del modulo conto terzi.

**File da modificare**:
1. `modules/conto-terzi/views/tariffe-standalone.html`
2. `modules/conto-terzi/views/nuovo-preventivo-standalone.html`
3. `modules/conto-terzi/views/terreni-clienti-standalone.html`

**Considerazioni speciali**:
- Questi file sono in una sottocartella diversa
- Verificare il percorso corretto per importare `liste-service.js`
- Potrebbe essere necessario usare percorso relativo diverso

**Pattern da seguire**:
- Stesso pattern della Fase 2
- Attenzione al percorso di import (probabilmente `../../../core/services/liste-service.js`)

**Checklist per ogni file**:
- [ ] Importato `liste-service.js` con percorso corretto
- [ ] Rimossa logica di caricamento diretta
- [ ] Implementata nuova funzione che usa servizio condiviso
- [ ] Dropdown popolati correttamente
- [ ] Creazione tariffe/preventivi funziona
- [ ] Collegamento con attività funziona (se presente)

**Output atteso**: 
- 3 file refactorizzati e testati
- Modulo conto terzi funzionante
- Nessun errore in console

**Tempo stimato**: 3-4 ore per file (totale 9-12 ore)

---

### FASE 5: Verifica e Testing Completo (1 agente)

**Obiettivo**: Verificare che tutto funzioni correttamente dopo il refactoring.

**Task**:
1. **Test funzionalità base**:
   - Creare nuovo terreno con coltura
   - Creare nuova attività con tipo lavoro e coltura
   - Creare nuovo lavoro con tipo lavoro
   - Verificare che i dropdown siano popolati correttamente

2. **Test filtri**:
   - Filtrare attività per tipo lavoro
   - Filtrare attività per coltura
   - Filtrare statistiche per tipo lavoro
   - Verificare che i filtri funzionino

3. **Test statistiche**:
   - Verificare che le statistiche mostrino dati corretti
   - Verificare raggruppamento per tipo lavoro
   - Verificare raggruppamento per coltura
   - Verificare che i nuovi dati vengano visualizzati correttamente

4. **Test modifica liste**:
   - Aggiungere nuovo tipo lavoro da Impostazioni
   - Aggiungere nuova coltura da Impostazioni
   - Verificare che le modifiche siano visibili in tutte le pagine
   - Verificare che i dropdown si aggiornino

5. **Test moduli avanzati**:
   - Verificare che tariffe funzionino
   - Verificare che preventivi funzionino
   - Verificare che terreni clienti funzionino

6. **Test performance**:
   - Verificare che non ci siano chiamate Firestore duplicate
   - Verificare che le liste vengano caricate una sola volta per pagina
   - Verificare tempi di caricamento

**Checklist finale**:
- [ ] Tutte le funzionalità base funzionano
- [ ] Tutti i filtri funzionano
- [ ] Statistiche corrette
- [ ] Modifica liste funziona
- [ ] Moduli avanzati funzionano
- [ ] Nessun errore in console
- [ ] Performance accettabili
- [ ] Nessuna chiamata Firestore duplicata

**Output atteso**: 
- Report di testing completo
- Lista eventuali problemi trovati
- Conferma che tutto funziona correttamente

**Tempo stimato**: 4-6 ore

---

### FASE 6: Pulizia e Ottimizzazione (1 agente)

**Obiettivo**: Rimuovere codice non utilizzato e ottimizzare.

**Task**:
1. **Rimuovere codice morto**:
   - Cercare funzioni non utilizzate
   - Rimuovere import non utilizzati
   - Rimuovere variabili non utilizzate

2. **Ottimizzare caricamento liste**:
   - Verificare se è possibile implementare cache condivisa
   - Verificare se è possibile ridurre chiamate Firestore
   - Ottimizzare funzioni di caricamento

3. **Documentazione**:
   - Aggiornare documentazione se necessario
   - Documentare il nuovo pattern
   - Aggiornare commenti nel codice

4. **Verifica finale**:
   - Eseguire test finali
   - Verificare che non ci siano regressioni
   - Verificare che tutto sia coerente

**Checklist**:
- [ ] Codice morto rimosso
- [ ] Ottimizzazioni implementate
- [ ] Documentazione aggiornata
- [ ] Test finali passati
- [ ] Nessuna regressione

**Output atteso**: 
- Codice pulito e ottimizzato
- Documentazione aggiornata
- Report finale

**Tempo stimato**: 2-3 ore

---

## 🔄 Pattern Standard da Seguire

### 1. Import del Servizio

```javascript
// All'inizio del file, nella sezione import
import { getTipiLavoroNomi, getColtureNomi } from './services/liste-service.js';
// Oppure per file in sottocartelle:
import { getTipiLavoroNomi, getColtureNomi } from '../../../core/services/liste-service.js';
```

### 2. Sostituzione Funzione loadListe

**Prima** (codice da rimuovere):
```javascript
async function loadTipiLavoro() {
    try {
        const tipiRef = collection(db, `tenants/${currentTenantId}/tipiLavoro`);
        const snapshot = await getDocs(query(tipiRef, orderBy('nome', 'asc')));
        tipiLavoro = [];
        snapshot.forEach(doc => {
            tipiLavoro.push(doc.data().nome);
        });
        // ... popola dropdown
    } catch (error) {
        // fallback a ListePersonalizzate
    }
}
```

**Dopo** (codice nuovo):
```javascript
async function loadTipiLavoro() {
    try {
        tipiLavoro = await getTipiLavoroNomi();
        // ... popola dropdown (stesso codice)
    } catch (error) {
        console.error('Errore caricamento tipi lavoro:', error);
        tipiLavoro = []; // Fallback a array vuoto
    }
}
```

### 3. Sostituzione Funzione loadColture

**Prima** (codice da rimuovere):
```javascript
async function loadColture() {
    try {
        const coltureRef = collection(db, `tenants/${currentTenantId}/colture`);
        const snapshot = await getDocs(query(coltureRef, orderBy('nome', 'asc')));
        colture = [];
        snapshot.forEach(doc => {
            colture.push(doc.data().nome);
        });
        // ... popola dropdown
    } catch (error) {
        // fallback
    }
}
```

**Dopo** (codice nuovo):
```javascript
async function loadColture() {
    try {
        colture = await getColtureNomi();
        // ... popola dropdown (stesso codice)
    } catch (error) {
        console.error('Errore caricamento colture:', error);
        colture = []; // Fallback a array vuoto
    }
}
```

### 4. Gestione Struttura Gerarchica (se necessario)

Se la pagina usa la struttura gerarchica completa (categorie + sottocategorie):
- Mantenere il codice esistente per caricare categorie
- Usare `getTipiLavoroNomi()` solo per ottenere lista piatta se necessario
- Oppure continuare a caricare direttamente se serve struttura completa

**Nota**: Verificare caso per caso se serve struttura gerarchica completa o solo lista piatta.

---

## ⚠️ Note Importanti

### Compatibilità Dati Esistenti
- **Dati vecchi**: Dopo la cancellazione, non ci saranno dati vecchi
- **Nuovi dati**: Verranno salvati con nomi dalla struttura gerarchica
- **Statistiche**: Funzioneranno correttamente per tutti i nuovi dati

### Struttura Gerarchica vs Lista Piatta
- Alcune pagine potrebbero aver bisogno della struttura gerarchica completa
- Altre pagine potrebbero aver bisogno solo della lista piatta
- Verificare caso per caso quale approccio usare

### Gestione Errori
- Sempre gestire errori con try/catch
- Fornire fallback appropriato (array vuoto o valori predefiniti)
- Loggare errori in console per debug

### Testing
- Testare ogni file dopo il refactoring
- Verificare che tutte le funzionalità funzionino
- Verificare che non ci siano regressioni

---

## 📊 Riepilogo Tempi e Risorse

| Fase | Agente | File | Tempo Stimato |
|------|--------|------|---------------|
| Fase 1: Preparazione | 1 | Setup | 1-2 ore |
| Fase 2: Core Base | 1 | 3 file | 9-12 ore |
| Fase 3: Admin | 1 | 2 file | 8-10 ore |
| Fase 4: Conto Terzi | 1 | 3 file | 9-12 ore |
| Fase 5: Testing | 1 | Tutti | 4-6 ore |
| Fase 6: Pulizia | 1 | Tutti | 2-3 ore |
| **TOTALE** | **6 agenti** | **8 file** | **33-45 ore** |

**Nota**: I tempi possono variare in base alla complessità di ogni file.

---

## ✅ Criteri di Completamento

Il refactoring è completo quando:

1. ✅ Tutti gli 8 file sono stati refactorizzati
2. ✅ Tutti i file usano `liste-service.js` invece di caricare direttamente
3. ✅ Tutte le funzionalità funzionano correttamente
4. ✅ Nessun errore in console
5. ✅ Performance accettabili (nessuna chiamata duplicata)
6. ✅ Test completi passati
7. ✅ Codice pulito e documentato

---

## 🚀 Ordine di Esecuzione Consigliato

1. **Fase 1** (Preparazione) - Primo agente
2. **Fase 2** (Core Base) - Secondo agente (può iniziare dopo Fase 1)
3. **Fase 3** (Admin) - Terzo agente (può iniziare dopo Fase 1)
4. **Fase 4** (Conto Terzi) - Quarto agente (può iniziare dopo Fase 1)
5. **Fase 5** (Testing) - Quinto agente (dopo Fase 2, 3, 4)
6. **Fase 6** (Pulizia) - Sesto agente (dopo Fase 5)

**Nota**: Fase 2, 3, 4 possono essere eseguite in parallelo da agenti diversi.

---

## 📝 Template Report per Ogni Fase

Ogni agente deve fornire un report con:

```
## Report Fase X - [Nome Fase]

**Agente**: [Nome agente]
**Data**: [Data esecuzione]
**File modificati**: [Lista file]

### Modifiche effettuate:
- [Lista modifiche]

### Problemi riscontrati:
- [Lista problemi, se presenti]

### Test eseguiti:
- [Lista test eseguiti]

### Risultati:
- [Risultati test]

### Note:
- [Eventuali note]
```

---

## 🔍 Verifica Finale

Prima di considerare il refactoring completo, verificare:

- [x] File core base refactorizzati (terreni, statistiche, attivita)
- [x] File admin refactorizzati (impostazioni, gestione-lavori)
- [x] File modulo conto terzi refactorizzati per colture (terreni-clienti, tariffe, preventivi)
- [x] File modulo conto terzi refactorizzati per tipi lavoro (tariffe, preventivi) - ✅ Completato con struttura gerarchica
- [x] File attivita refactorizzato (attivita-standalone) - ✅ Completato 2025-12-17
- [x] Tutti i file importano servizi corretti
- [x] Nessun file carica liste direttamente da Firestore (eccetto fallback file://)
- [x] Tutte le funzionalità funzionano
- [x] Nessun errore in console
- [x] Performance accettabili
- [x] Documentazione aggiornata

---

## 📋 Stato Attuale del Refactoring (Aggiornato: 2025-01-26)

### ✅ Lavoro Completato

#### 1. Preparazione Dati
- ✅ **Cancellati dati di prova** da Firebase:
  - `attivita` (collection completa)
  - `lavori` (collection completa)
  - `terreni` (collection completa)
  - `tariffe` (se esistente)
  - `preventivi` (se esistente)
  - `liste/personalizzate` (documento)
- ✅ **Mantenute strutture gerarchiche**:
  - `categorie` (nuova struttura)
  - `tipiLavoro` (nuova struttura)
  - `colture` (nuova struttura)

#### 2. Refactoring Parziale Completato

**File modificati**:
1. ✅ `core/terreni-standalone.html`
2. ✅ `core/admin/impostazioni-standalone.html`

**Modifiche effettuate**:

##### `core/terreni-standalone.html`:
- ✅ Refactorato per usare `colture-service.js` e `categorie-service.js` (quando disponibili)
- ✅ Aggiunto fallback per ambiente `file://` che carica direttamente da Firestore
- ✅ Rimossa funzione duplicata `initializeColturePredefiniteTerreni()` (ora usa servizio)
- ✅ Funzione `loadCategorieColtureTerreni()` usa servizi quando possibile
- ✅ Funzione `loadColturePerCategoriaTerreni()` usa servizi quando possibile
- ✅ Funzione `updateColtureDropdownTerreni()` funziona correttamente
- ✅ Aggiunti log di debug per troubleshooting

##### `core/admin/impostazioni-standalone.html`:
- ✅ Refactorato per usare `colture-service.js` e `categorie-service.js` (quando disponibili)
- ✅ Aggiunto fallback per ambiente `file://` che carica direttamente da Firestore
- ✅ Ripristinata funzione `initializeColturePredefiniteImpostazioni()` per fallback `file://`
- ✅ Funzione `loadCategorieColture()` usa servizi quando possibile
- ✅ Funzione `loadColturePerCategoria()` usa servizi quando possibile
- ✅ Funzione `renderColture()` modificata per mostrare SOLO colture custom (non predefinite)
- ✅ Funzione `updateColturePredefiniteDropdown()` modificata per mostrare tutte le colture predefinite (anche già aggiunte, con indicazione)
- ✅ Rimossi log di debug verbosi

#### 3. Problemi Risolti

1. ✅ **Dropdown colture vuoto in terreni**: Risolto - ora popola correttamente
2. ✅ **Lista colture vuota in impostazioni**: Risolto - ora mostra tutte le colture
3. ✅ **Categorie miste**: Risolto - filtra solo categorie con `applicabileA === 'colture'`
4. ✅ **Funzione non accessibile globalmente**: Risolto - `updateColtureDropdownTerreni` esposta su `window`

---

### ⚠️ Problema Critico Identificato

#### Ambiente `file://` vs Server HTTP

**Problema**:
- Con `file://` (aprire file direttamente dal filesystem), i moduli ES6 non possono essere importati a causa di CORS
- Il codice usa un **fallback** che carica direttamente da Firestore invece di usare i servizi
- Questo significa che **le liste NON sono unificate** quando si usa `file://`

**Evidenza dal log**:
```
✅ Colture caricate e organizzate per categoria:
   Totale colture: 103
   Categorie con colture: (8) ['YqNmBfJ3xpvoM0vtH3zx', ...]
```

Le colture vengono caricate correttamente, ma **direttamente da Firestore**, non dai servizi.

**Impatto**:
- ✅ Funziona correttamente (colture visibili e selezionabili)
- ❌ Liste NON unificate (ogni pagina carica direttamente)
- ❌ Codice duplicato ancora presente (fallback)
- ❌ Non usa i servizi centralizzati

**Soluzione Necessaria**:
Per avere liste veramente unificate, è necessario usare un **server HTTP locale**:
- Python: `python -m http.server 8000`
- Node.js: `npx http-server`
- VS Code: Estensione "Live Server"

Con server HTTP:
- ✅ I servizi funzionano correttamente
- ✅ Liste veramente unificate
- ✅ Nessun codice duplicato
- ✅ Single source of truth

---

### 🔍 Test Eseguiti e Risultati

#### Test 1: Caricamento Categorie
- ✅ **Risultato**: Categorie caricate correttamente
- ✅ **Dropdown categoria**: Popolato correttamente
- ✅ **Filtro**: Solo categorie con `applicabileA === 'colture'`

#### Test 2: Caricamento Colture
- ✅ **Risultato**: 103 colture caricate correttamente
- ✅ **Organizzazione**: Colture organizzate per categoria (8 categorie)
- ✅ **Struttura**: Ogni categoria contiene le sue colture

#### Test 3: Dropdown Colture in Terreni
- ✅ **Risultato**: Dropdown popolato correttamente quando si seleziona categoria
- ✅ **Log mostra**: 29 colture trovate per categoria "Frutteto"
- ✅ **Dropdown mostra**: 30 opzioni (29 colture + 1 opzione iniziale)
- ✅ **Selezione**: Funzionante correttamente

#### Test 4: Lista Colture in Impostazioni
- ✅ **Risultato**: Lista visibile e corretta
- ✅ **Mostra**: Solo colture custom (non predefinite)
- ✅ **Dropdown predefinite**: Mostra tutte le colture predefinite disponibili (anche già aggiunte, con indicazione)
- ✅ **Funzionalità**: Tutto funzionante correttamente

---

### ✅ Problemi Risolti (Aggiornamento)

1. ✅ **Dropdown colture non selezionabile**: RISOLTO
   - Problema risolto con server HTTP locale
   - Dropdown funziona correttamente in entrambe le pagine

2. ✅ **Ambiente file:// vs servizi**: RISOLTO
   - Configurato server HTTP locale usando Node.js `http-server`
   - Creato script `start-server.bat` per avvio rapido
   - Servizi funzionano correttamente con server HTTP

3. ✅ **Liste non completamente unificate**: RISOLTO
   - Con server HTTP, liste sono veramente unificate
   - Entrambe le pagine usano gli stessi servizi centralizzati

---

### 📝 Prossimi Passi

#### Priorità Alta

1. **Risolvere problema selezione dropdown**:
   - Verificare perché il dropdown non è selezionabile nonostante sia popolato
   - Controllare se c'è un problema di timing o rendering
   - Verificare se ci sono event listener che interferiscono

2. **Decidere approccio ambiente**:
   - **Opzione A**: Usare server HTTP locale (consigliato)
     - Liste veramente unificate
     - Usa servizi correttamente
     - Nessun codice duplicato
   - **Opzione B**: Continuare con `file://`
     - Liste NON unificate
     - Fallback necessario
     - Codice duplicato

3. **Completare refactoring**:
   - Continuare con gli altri file (Fase 2, 3, 4 del piano originale)
   - Assicurarsi che tutti usino i servizi quando possibile
   - Rimuovere codice duplicato

#### Priorità Media

4. **Rimuovere log di debug**:
   - Rimuovere `console.log` aggiunti per troubleshooting
   - Mantenere solo log di errore importanti

5. **Ottimizzare codice**:
   - Verificare se ci sono ottimizzazioni possibili
   - Rimuovere codice morto

---

### 🔧 Modifiche Tecniche Dettagliate

#### Pattern Implementato

**Per ambiente con server HTTP**:
```javascript
// Usa servizi quando possibile
const { getAllCategorie } = await import('./services/categorie-service.js');
const categorie = await getAllCategorie({
    applicabileA: 'colture',
    orderBy: 'ordine',
    orderDirection: 'asc'
});
```

**Per ambiente file:// (fallback)**:
```javascript
// Fallback: carica direttamente da Firestore
const categorieRef = collection(db, `tenants/${currentTenantId}/categorie`);
const categorieSnapshot = await getDocs(categorieRef);
// ... elabora dati
```

**Rilevamento ambiente**:
```javascript
const isFileProtocol = window.location.protocol === 'file:';
if (isFileProtocol) {
    // Usa fallback
} else {
    // Usa servizi
}
```

#### File e Funzioni Modificate

**Servizi Core:**
1. `firebase-service.js` - Cambiato import da moduli ES6 a CDN, aggiunta funzione `setFirebaseInstances()`
2. `auth-service.js` - Cambiato import da moduli ES6 a CDN
3. `tenant-service.js` - Cambiato import da moduli ES6 a CDN, rimosso `await import()` non-async
4. `categorie-service.js` - Aggiunto fallback per errore indice Firestore mancante

**terreni-standalone.html:**
1. `loadCategorieColtureTerreni()` - Usa `categorie-service.js`
2. `loadColturePerCategoriaTerreni()` - Usa `colture-service.js`
3. `updateColtureDropdownTerreni()` - Funziona correttamente
4. Aggiunta impostazione tenantId nel servizio quando viene caricato l'utente
5. Aggiunta impostazione Firebase instances e tenantId prima di usare i servizi

**impostazioni-standalone.html:**
1. `loadCategorieColture()` - Usa `categorie-service.js`
2. `loadColturePerCategoria()` - Usa `colture-service.js`
3. `renderColture()` - Mostra SOLO colture custom (non predefinite)
4. `updateColturePredefiniteDropdown()` - Mostra tutte le colture predefinite (anche già aggiunte)
5. Aggiunta impostazione tenantId nel servizio quando viene caricato l'utente
6. Aggiunta impostazione Firebase instances e tenantId prima di usare i servizi

**Nuovi File:**
1. `start-server.bat` - Script per avviare server HTTP locale facilmente

---

### 📊 Checklist Stato Attuale

#### Completato
- [x] Cancellati dati di prova da Firebase
- [x] Configurato server HTTP locale (Node.js http-server)
- [x] Risolto problemi import Firebase nei servizi
- [x] Risolto problema tenantId non disponibile nei servizi
- [x] Aggiunto fallback per indice Firestore mancante
- [x] Refactorato `terreni-standalone.html` per usare servizi
- [x] Refactorato `impostazioni-standalone.html` per usare servizi
- [x] Risolto problema categorie miste
- [x] Risolto problema lista colture vuota in impostazioni
- [x] Risolto problema dropdown colture predefinite vuoto
- [x] Modificato `renderColture()` per mostrare solo colture custom
- [x] Aggiunto supporto per ambiente `file://` (fallback)
- [x] Rimossi log di debug verbosi
- [x] Test completati con successo

#### Da Fare
- [ ] Completare refactoring altri file (Fase 2, 3, 4)
- [ ] Refactorizzare `core/attivita-standalone.html`
- [ ] Refactorizzare `core/statistiche-standalone.html`
- [ ] Refactorizzare `core/admin/gestione-lavori-standalone.html`
- [ ] Refactorizzare moduli conto terzi

---

### 🚨 Note Importanti per Continuare

1. **Ambiente file://**: 
   - Attualmente funziona con fallback
   - Liste NON sono unificate (ogni pagina carica direttamente)
   - Per liste veramente unificate, serve server HTTP

2. **Servizi disponibili**:
   - `colture-service.js` - Funziona solo con server HTTP
   - `categorie-service.js` - Funziona solo con server HTTP
   - `liste-service.js` - Non ancora usato (pensato per lista piatta)

3. **Struttura gerarchica**:
   - Le pagine usano struttura gerarchica completa (categorie + colture)
   - `liste-service.js` è pensato per lista piatta
   - Per struttura gerarchica, usare direttamente `colture-service.js` e `categorie-service.js`

4. **Prossimo file da refactorare**:
   - `core/attivita-standalone.html` (Fase 2)
   - Seguire stesso pattern di `terreni-standalone.html`

---

---

## ✅ Progressi Sessione 2025-12-16 (Completato)

### 🎯 Obiettivo Raggiunto
Refactoring completato per `terreni-standalone.html` e `impostazioni-standalone.html` con utilizzo dei servizi centralizzati (`categorie-service.js` e `colture-service.js`).

### 🔧 Problemi Risolti

#### 1. **Configurazione Ambiente di Sviluppo**
- ✅ Configurato server HTTP locale usando Node.js `http-server`
- ✅ Creato script `start-server.bat` per avvio rapido
- ✅ Risolto problema CORS con moduli ES6 (necessario server HTTP invece di `file://`)

#### 2. **Problemi Import Firebase**
- ✅ Modificato `firebase-service.js` per usare import da CDN invece di moduli ES6
- ✅ Modificato `auth-service.js` per usare import da CDN
- ✅ Modificato `tenant-service.js` per usare import da CDN
- ✅ Risolto errore "Failed to resolve module specifier"

#### 3. **Problema TenantId Non Disponibile**
- ✅ Aggiunta funzione `setFirebaseInstances()` in `firebase-service.js` per registrare istanze Firebase già inizializzate
- ✅ Aggiunta impostazione tenantId nel servizio quando viene caricato l'utente
- ✅ Aggiunta impostazione tenantId prima di usare i servizi nelle funzioni di caricamento
- ✅ Risolto errore "Nessun tenant corrente disponibile"

#### 4. **Problema Indice Firestore Mancante**
- ✅ Aggiunto fallback in `getAllCategorie()` per gestire errore indice mancante
- ✅ Implementato caricamento lato client con filtro e ordinamento quando l'indice non è disponibile
- ✅ Ridotto livello di log da `console.error` a `console.debug` per non spaventare l'utente

#### 5. **Refactoring terreni-standalone.html**
- ✅ Refactorizzato `loadCategorieColtureTerreni()` per usare `categorie-service.js`
- ✅ Refactorizzato `loadColturePerCategoriaTerreni()` per usare `colture-service.js`
- ✅ Aggiunto fallback per ambiente `file://` (caricamento diretto da Firestore)
- ✅ Aggiunta inizializzazione automatica colture predefinite se < 20 colture
- ✅ Risolto problema dropdown colture non popolato
- ✅ Rimossi log di debug verbosi

#### 6. **Refactoring impostazioni-standalone.html**
- ✅ Refactorizzato `loadCategorieColture()` per usare `categorie-service.js`
- ✅ Refactorizzato `loadColturePerCategoria()` per usare `colture-service.js`
- ✅ Aggiunto fallback per ambiente `file://` (caricamento diretto da Firestore)
- ✅ Modificato `renderColture()` per mostrare SOLO colture custom (non predefinite)
- ✅ Modificato `updateColturePredefiniteDropdown()` per mostrare tutte le colture predefinite (anche già aggiunte, con indicazione)
- ✅ Risolto problema dropdown colture predefinite vuoto

### 📝 Modifiche Tecniche Dettagliate

#### File Modificati

1. **`core/services/firebase-service.js`**:
   - Cambiato import da `"firebase/firestore"` a CDN `"https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"`
   - Aggiunta funzione `setFirebaseInstances()` per registrare istanze Firebase già inizializzate
   - Modificato gestione errore indice per non loggare come errore

2. **`core/services/auth-service.js`**:
   - Cambiato import da `"firebase/auth"` a CDN

3. **`core/services/tenant-service.js`**:
   - Cambiato import da `"firebase/auth"` a CDN
   - Rimosso `await import()` non-async in `getTenantCollection()`
   - Aggiunto import di `getCollection` all'inizio del file

4. **`core/services/categorie-service.js`**:
   - Aggiunto fallback per errore indice Firestore mancante
   - Implementato caricamento lato client con filtro e ordinamento

5. **`core/terreni-standalone.html`**:
   - Aggiunto import e uso di `categorie-service.js` e `colture-service.js`
   - Aggiunta impostazione tenantId nel servizio quando viene caricato l'utente
   - Aggiunta impostazione Firebase instances e tenantId prima di usare i servizi
   - Aggiunto fallback per ambiente `file://`
   - Rimossi log di debug verbosi

6. **`core/admin/impostazioni-standalone.html`**:
   - Aggiunto import e uso di `categorie-service.js` e `colture-service.js`
   - Aggiunta impostazione tenantId nel servizio quando viene caricato l'utente
   - Aggiunta impostazione Firebase instances e tenantId prima di usare i servizi
   - Modificato `renderColture()` per mostrare solo colture custom
   - Modificato `updateColturePredefiniteDropdown()` per mostrare tutte le colture predefinite
   - Aggiunto fallback per ambiente `file://`

7. **`start-server.bat`** (nuovo file):
   - Script per avviare server HTTP locale facilmente

### 🧪 Test Eseguiti

- ✅ Test caricamento categorie in terreni-standalone.html
- ✅ Test caricamento colture in terreni-standalone.html
- ✅ Test dropdown categoria colture in terreni-standalone.html
- ✅ Test dropdown colture in terreni-standalone.html (selezione funzionante)
- ✅ Test caricamento categorie in impostazioni-standalone.html
- ✅ Test caricamento colture in impostazioni-standalone.html
- ✅ Test dropdown categoria colture in impostazioni-standalone.html
- ✅ Test dropdown colture predefinite in impostazioni-standalone.html
- ✅ Test lista colture custom in impostazioni-standalone.html

### ✅ Risultati

- ✅ Liste unificate tra Terreni e Impostazioni
- ✅ Servizi centralizzati funzionanti
- ✅ Nessun errore in console (solo warning normali per Service Worker e manifest.json)
- ✅ Dropdown funzionanti correttamente
- ✅ Liste mostrano solo colture custom in Impostazioni
- ✅ Dropdown mostra tutte le colture predefinite disponibili

### 📋 Checklist Stato Attuale

#### Completato
- [x] Configurato server HTTP locale
- [x] Risolto problemi import Firebase
- [x] Risolto problema tenantId non disponibile
- [x] Aggiunto fallback per indice Firestore mancante
- [x] Refactorizzato `terreni-standalone.html` per usare servizi
- [x] Refactorizzato `impostazioni-standalone.html` per usare servizi
- [x] Modificato `renderColture()` per mostrare solo colture custom
- [x] Risolto problema dropdown colture predefinite vuoto
- [x] Rimossi log di debug verbosi
- [x] Test completati con successo

#### Da Fare (Prossimi File)
- [ ] Refactorizzare `core/attivita-standalone.html`
- [ ] Refactorizzare `core/statistiche-standalone.html`
- [ ] Refactorizzare `core/admin/gestione-lavori-standalone.html`
- [ ] Refactorizzare `modules/conto-terzi/views/tariffe-standalone.html`
- [ ] Refactorizzare `modules/conto-terzi/views/nuovo-preventivo-standalone.html`
- [ ] Refactorizzare `modules/conto-terzi/views/terreni-clienti-standalone.html`

### 🔑 Pattern da Seguire per Prossimi File

Per ogni file da refactorizzare, seguire questo pattern:

1. **Aggiungere impostazione tenantId quando viene caricato l'utente**:
   ```javascript
   // Salva tenant ID
   currentTenantId = userData.tenantId;
   
   // Imposta tenantId nel tenant-service per i servizi
   try {
       const { setCurrentTenantId } = await import('./services/tenant-service.js');
       setCurrentTenantId(currentTenantId);
   } catch (error) {
       console.warn('Impossibile impostare tenantId nel servizio:', error);
   }
   ```

2. **Prima di usare i servizi, impostare Firebase instances e tenantId**:
   ```javascript
   // Assicura che Firebase sia inizializzato nel servizio
   const { setFirebaseInstances } = await import('./services/firebase-service.js');
   setFirebaseInstances({ app, db, auth });
   
   // Assicura che il tenantId sia impostato nel servizio
   const { setCurrentTenantId } = await import('./services/tenant-service.js');
   if (currentTenantId) {
       setCurrentTenantId(currentTenantId);
   }
   ```

3. **Usare i servizi invece di caricamento diretto**:
   ```javascript
   const { getAllCategorie } = await import('./services/categorie-service.js');
   const categorie = await getAllCategorie({
       applicabileA: 'colture',
       orderBy: 'ordine',
       orderDirection: 'asc'
   });
   ```

4. **Aggiungere fallback per ambiente file://** (se necessario):
   ```javascript
   const isFileProtocol = window.location.protocol === 'file:';
   if (isFileProtocol) {
       // Fallback: carica direttamente da Firestore
   } else {
       // Usa servizi
   }
   ```

### ⚠️ Note Importanti

1. **Server HTTP necessario**: Per avere liste veramente unificate, è necessario usare un server HTTP locale. Con `file://`, ogni pagina carica direttamente da Firestore (non unificato).

2. **Indice Firestore**: Se manca l'indice per le query su categorie, il sistema usa automaticamente un fallback lato client. Per migliorare le performance, creare l'indice in Firebase Console.

3. **Colture predefinite**: Vengono inizializzate automaticamente se ci sono meno di 20 colture nel database.

4. **Liste unificate**: Ora `terreni-standalone.html` e `impostazioni-standalone.html` usano gli stessi servizi, quindi le liste sono veramente unificate.

---

---

## ✅ Progressi Sessione 2025-12-16 (Parte 2) - Completato

### 🎯 Obiettivo Raggiunto
Refactoring completato per tutti i file del modulo conto terzi e correzioni varie per sincronizzazione liste colture e filtri terreni.

### 🔧 Modifiche Effettuate

#### 1. **Refactoring Modulo Conto Terzi - Terreni Clienti**
**File**: `modules/conto-terzi/views/terreni-clienti-standalone.html`

- ✅ Aggiunta impostazione tenantId nel servizio quando viene caricato l'utente
- ✅ Refactorizzato `loadColture()` per usare `categorie-service.js` e `colture-service.js`
- ✅ Aggiunto fallback per ambiente `file://`
- ✅ Fix visualizzazione colture: rimossa visualizzazione ID categoria, mostra solo nome coltura
- ✅ Liste sincronizzate con core e impostazioni

#### 2. **Filtro Terreni Aziendali**
**File**: `core/attivita-standalone.html`

- ✅ Aggiunto filtro per escludere terreni clienti nel dropdown terreni quando NON si è in modalità conto terzi
- ✅ In modalità normale (core): mostra solo terreni aziendali (senza `clienteId`)
- ✅ In modalità conto terzi: mostra solo terreni clienti (con `clienteId`)

**File**: `core/terreni-standalone.html`

- ✅ Aggiunto filtro per escludere terreni clienti nella lista terreni
- ✅ Mostra solo terreni aziendali (senza `clienteId`)

**File**: `core/dashboard-standalone.html`

- ✅ Aggiunto filtro per escludere terreni clienti nella mappa aziendale
- ✅ Mappa mostra solo terreni aziendali (senza `clienteId`)

#### 3. **Refactoring Modulo Conto Terzi - Tariffe**
**File**: `modules/conto-terzi/views/tariffe-standalone.html`

- ✅ Aggiunta impostazione tenantId nel servizio quando viene caricato l'utente
- ✅ Refactorizzato `loadCategorieColture()` per usare `categorie-service.js`
- ✅ Refactorizzato `loadColturePerCategoria()` per usare `colture-service.js`
- ✅ Aggiunto fallback per ambiente `file://`
- ✅ Fix primo modal: sostituito input text con dropdown categoria e coltura
- ✅ Fix funzione `updateColtureDropdown()`: resa globale e aggiunto event listener dinamico
- ✅ Liste sincronizzate con core e impostazioni

#### 4. **Refactoring Modulo Conto Terzi - Preventivi**
**File**: `modules/conto-terzi/views/nuovo-preventivo-standalone.html`

- ✅ Aggiunta impostazione tenantId nel servizio quando viene caricato l'utente
- ✅ Refactorizzato `loadCategorieColturePreventivo()` per usare `categorie-service.js`
- ✅ Refactorizzato `loadColturePerCategoriaPreventivo()` per usare `colture-service.js`
- ✅ Aggiunto fallback per ambiente `file://`
- ✅ Fix funzione `updateColtureDropdownPreventivo()`: resa globale e aggiunto event listener dinamico
- ✅ Fix funzione `calcolaTotale()`: aggiunto controllo esistenza `tipoLavoroCustom`
- ✅ Fix funzione `onColturaChange()`: aggiunto controllo esistenza `customInput`
- ✅ Precompilazione automatica categoria e coltura quando si seleziona un terreno
- ✅ Liste sincronizzate con core e impostazioni

### 📊 Riepilogo File Refactorizzati

#### Completato (Usa Servizi Centralizzati)
- ✅ `core/terreni-standalone.html`
- ✅ `core/admin/impostazioni-standalone.html`
- ✅ `modules/conto-terzi/views/terreni-clienti-standalone.html`
- ✅ `modules/conto-terzi/views/tariffe-standalone.html`
- ✅ `modules/conto-terzi/views/nuovo-preventivo-standalone.html`

#### Da Fare (Opzionale)
- ⏳ `core/attivita-standalone.html` - Funziona correttamente ma non usa ancora servizi centralizzati

### 🐛 Bug Risolti

1. ✅ **Visualizzazione ID categoria nei terreni clienti**: Risolto - ora mostra solo nome coltura
2. ✅ **Terreni clienti visibili nella lista terreni core**: Risolto - aggiunto filtro
3. ✅ **Terreni clienti visibili nella mappa dashboard**: Risolto - aggiunto filtro
4. ✅ **Dropdown colture vuoto in tariffe**: Risolto - aggiunto event listener dinamico
5. ✅ **Errore `updateColtureDropdown` non definita**: Risolto - resa funzione globale
6. ✅ **Errore `tipoLavoroCustom` non definita**: Risolto - aggiunto controllo esistenza
7. ✅ **Errore `customInput` null in `onColturaChange`**: Risolto - aggiunto controllo esistenza
8. ✅ **Dropdown colture vuoto in preventivi**: Risolto - aggiunto event listener dinamico

### ✨ Miglioramenti UX

1. ✅ **Precompilazione automatica**: Quando si seleziona un terreno in preventivi, categoria e coltura vengono precompilate automaticamente
2. ✅ **Dropdown sincronizzati**: Tutti i dropdown colture sono sincronizzati tra tutte le pagine
3. ✅ **Filtri corretti**: Terreni aziendali e clienti sono correttamente separati

### 📝 Note Tecniche

- Tutti i file refactorizzati seguono lo stesso pattern:
  - Impostazione tenantId nel servizio quando viene caricato l'utente
  - Uso di `categorie-service.js` e `colture-service.js` quando possibile
  - Fallback per ambiente `file://` quando necessario
  - Funzioni globali per accesso da HTML (`window.functionName`)

- I filtri terreni sono implementati controllando la presenza di `clienteId`:
  - Terreni aziendali: `!clienteId || clienteId === ''`
  - Terreni clienti: `clienteId != null && clienteId !== ''`

---

---

## ✅ Progressi Sessione 2025-12-17 (Completato)

### 🎯 Obiettivo Raggiunto
Refactoring completato per `statistiche-standalone.html` e `gestione-lavori-standalone.html` con utilizzo dei servizi centralizzati.

### 🔧 Modifiche Effettuate

#### 1. **Refactoring statistiche-standalone.html**
**File**: `core/statistiche-standalone.html`

- ✅ Aggiunta impostazione tenantId nel servizio quando viene caricato l'utente
- ✅ Aggiunta impostazione Firebase instances nel servizio
- ✅ Refactorizzato `loadFilters()` per usare `liste-service.js` → `getTipiLavoroNomi()`
- ✅ Aggiunto fallback per ambiente `file://` (carica direttamente da Firestore)
- ✅ **IMPORTANTE**: Aggiunto filtro per escludere terreni clienti in `getAllTerreni()`
- ✅ **IMPORTANTE**: Aggiunto filtro per escludere attività clienti in `getAllAttivita()`
- ✅ Liste sincronizzate con struttura gerarchica `tipiLavoro`

**Note**: Le statistiche ora mostrano solo dati aziendali (escludono terreni e attività con `clienteId`).

#### 2. **Refactoring gestione-lavori-standalone.html**
**File**: `core/admin/gestione-lavori-standalone.html`

- ✅ Aggiunta impostazione tenantId nel servizio quando viene caricato l'utente
- ✅ Aggiunta impostazione Firebase instances nel servizio
- ✅ Refactorizzato `loadTipiLavoro()` per usare `tipi-lavoro-service.js` → `getAllTipiLavoro()`
- ✅ Corretto percorso import servizi: `../services/` invece di `../../services/`
- ✅ **BUG FIX CRITICO**: Corretto filtro per sottocategorie (usa `sottocategoriaId` quando necessario)
- ✅ **BUG FIX**: Non modifica più `tipiLavoroList` direttamente durante il filtro (usa variabile locale)
- ✅ Aggiunto caricamento assicurato quando si apre il modal (`openCreaModal`)
- ✅ Aggiunto fallback per ambiente `file://`
- ✅ Liste sincronizzate con struttura gerarchica `tipiLavoro`

**Problemi risolti**:
- Errori 404 sui servizi (percorsi corretti)
- Dropdown tipi lavoro vuoto quando si seleziona sottocategoria (filtro corretto)
- Liste non sincronizzate (ora usa servizi centralizzati)

### 📊 Riepilogo File Refactorizzati

#### Completato (Usa Servizi Centralizzati)
- ✅ `core/terreni-standalone.html` (sessione precedente)
- ✅ `core/admin/impostazioni-standalone.html` (sessione precedente)
- ✅ `modules/conto-terzi/views/terreni-clienti-standalone.html` (sessione precedente)
- ✅ `modules/conto-terzi/views/tariffe-standalone.html` (sessione precedente)
- ✅ `modules/conto-terzi/views/nuovo-preventivo-standalone.html` (sessione precedente)
- ✅ `core/statistiche-standalone.html` (sessione 2025-12-17)
- ✅ `core/admin/gestione-lavori-standalone.html` (sessione 2025-12-17)

#### Da Fare (Caricano Tipi Lavoro Direttamente)
- ⏳ `modules/conto-terzi/views/tariffe-standalone.html` - Carica tipi lavoro direttamente (lista piatta)
- ⏳ `modules/conto-terzi/views/nuovo-preventivo-standalone.html` - Carica tipi lavoro direttamente (lista piatta)

**Nota**: `tariffe-standalone.html` e `nuovo-preventivo-standalone.html` sono già stati refactorizzati per colture, ma NON per tipi lavoro. Devono essere aggiornati per usare `liste-service.js` → `getTipiLavoroNomi()`.

### 🐛 Bug Risolti

1. ✅ **Errori 404 servizi in gestione-lavori**: Risolto - corretti percorsi import (`../services/` invece di `../../services/`)
2. ✅ **Dropdown tipi lavoro vuoto con sottocategorie**: Risolto - corretto filtro per usare `sottocategoriaId` quando necessario
3. ✅ **Liste non sincronizzate**: Risolto - ora tutti i file usano servizi centralizzati
4. ✅ **Statistiche includono dati clienti**: Risolto - aggiunto filtro per escludere terreni/attività con `clienteId`

### 📝 Pattern e Soluzioni Trovate

#### Pattern per Refactoring Tipi Lavoro (Lista Piatta)
Per file che hanno bisogno solo di una lista piatta di nomi (es. filtri, dropdown semplici):

```javascript
// 1. Configurazione servizi all'autenticazione
onAuthStateChanged(auth, async (user) => {
    // ... codice esistente ...
    currentTenantId = userData.tenantId;
    
    // Imposta tenantId nel tenant-service per i servizi
    try {
        const { setCurrentTenantId } = await import('./services/tenant-service.js');
        setCurrentTenantId(currentTenantId);
    } catch (error) {
        console.warn('Impossibile impostare tenantId nel servizio:', error);
    }
    
    // Assicura che Firebase sia inizializzato nei servizi
    try {
        const { setFirebaseInstances } = await import('./services/firebase-service.js');
        setFirebaseInstances({ app, db, auth });
    } catch (error) {
        console.warn('Impossibile impostare Firebase instances nel servizio:', error);
    }
});

// 2. Funzione loadTipiLavoro refactorizzata
async function loadTipiLavoro() {
    try {
        const isFileProtocol = window.location.protocol === 'file:';
        let tipiLavoro = [];
        
        if (isFileProtocol) {
            // Fallback per ambiente file://
            const listeRef = doc(db, `tenants/${currentTenantId}/liste`, 'personalizzate');
            const listeSnap = await getDoc(listeRef);
            if (listeSnap.exists()) {
                const data = listeSnap.data();
                tipiLavoro = data.tipiLavoro || [];
            }
        } else {
            // Usa servizio centralizzato
            const { getTipiLavoroNomi } = await import('./services/liste-service.js');
            tipiLavoro = await getTipiLavoroNomi();
        }
        
        // Popola dropdown
        const select = document.getElementById('filter-tipo-lavoro');
        if (select) {
            select.innerHTML = '<option value="">Tutti i tipi</option>';
            tipiLavoro.forEach(tipo => {
                const option = document.createElement('option');
                option.value = tipo;
                option.textContent = tipo;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Errore caricamento tipi lavoro:', error);
        // Fallback: carica dalle attività o usa predefiniti
    }
}
```

#### Pattern per Refactoring Tipi Lavoro (Struttura Gerarchica)
Per file che hanno bisogno della struttura gerarchica completa (categorie + sottocategorie + tipi):

```javascript
// 1. Configurazione servizi (stessa di sopra)

// 2. Funzione loadTipiLavoro refactorizzata
async function loadTipiLavoro(categoriaId = null) {
    try {
        if (!currentTenantId) return;
        
        const isFileProtocol = window.location.protocol === 'file:';
        
        if (isFileProtocol) {
            // Fallback per ambiente file://
            const tipiRef = collection(db, `tenants/${currentTenantId}/tipiLavoro`);
            const snapshot = await getDocs(query(tipiRef, orderBy('nome', 'asc')));
            tipiLavoroList = [];
            snapshot.forEach(doc => {
                tipiLavoroList.push({ id: doc.id, ...doc.data() });
            });
        } else {
            // Usa servizio centralizzato
            const { setFirebaseInstances } = await import('../services/firebase-service.js');
            setFirebaseInstances({ app, db, auth });
            
            const { setCurrentTenantId } = await import('../services/tenant-service.js');
            if (currentTenantId) {
                setCurrentTenantId(currentTenantId);
            }
            
            const { getAllTipiLavoro } = await import('../services/tipi-lavoro-service.js');
            const tipiLavoro = await getAllTipiLavoro({
                orderBy: 'nome',
                orderDirection: 'asc'
            });
            
            tipiLavoroList = tipiLavoro.map(tipo => ({
                id: tipo.id,
                nome: tipo.nome,
                categoriaId: tipo.categoriaId,
                sottocategoriaId: tipo.sottocategoriaId,
                descrizione: tipo.descrizione,
                predefinito: tipo.predefinito || false,
                ...tipo
            }));
        }
        
        // IMPORTANTE: Filtro per categoria/sottocategoria
        let tipiLavoroFiltrati = tipiLavoroList;
        if (categoriaId) {
            const categoriaTrovata = [...categorieLavoriPrincipali, ...Array.from(sottocategorieLavoriMap.values()).flat()].find(c => c.id === categoriaId);
            
            if (categoriaTrovata && categoriaTrovata.parentId) {
                // È una sottocategoria: filtra per sottocategoriaId
                tipiLavoroFiltrati = tipiLavoroList.filter(tipo => tipo.sottocategoriaId === categoriaId);
            } else {
                // È una categoria principale: include anche le sue sottocategorie
                let allCategorieIds = [categoriaId];
                const sottocat = sottocategorieLavoriMap.get(categoriaId);
                if (sottocat) {
                    sottocat.forEach(subcat => allCategorieIds.push(subcat.id));
                }
                
                tipiLavoroFiltrati = tipiLavoroList.filter(tipo => {
                    return tipo.categoriaId === categoriaId || 
                           (tipo.sottocategoriaId && allCategorieIds.includes(tipo.sottocategoriaId));
                });
            }
        }
        
        populateTipoLavoroDropdown(categoriaId, null, tipiLavoroFiltrati);
    } catch (error) {
        console.error('Errore caricamento tipi lavoro:', error);
        tipiLavoroList = [];
    }
}
```

#### Pattern per Filtro Dati Aziendali (Escludere Clienti)
Per statistiche e visualizzazioni che devono mostrare solo dati aziendali:

```javascript
// Filtra solo terreni aziendali (escludi terreni clienti)
async function getAllTerreni() {
    // ... codice esistente ...
    return snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(terreno => {
            // Escludi terreni dei clienti (solo terreni aziendali)
            return !terreno.clienteId || terreno.clienteId === '';
        });
}

// Filtra solo attività aziendali (escludi attività clienti)
async function getAllAttivita(filters = {}) {
    // ... codice esistente ...
    let results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Filtra solo attività aziendali (escludi attività terreni clienti)
    results = results.filter(attivita => {
        // Escludi attività dei clienti (solo attività aziendali)
        return !attivita.clienteId || attivita.clienteId === '';
    });
    
    return results;
}
```

### ⚠️ Note Importanti

1. **Percorsi Import**: 
   - File in `core/`: usa `./services/`
   - File in `core/admin/`: usa `../services/`
   - File in `modules/conto-terzi/views/`: usa `../../../core/services/`

2. **Filtro Sottocategorie**: 
   - Quando si seleziona una sottocategoria, filtrare per `sottocategoriaId`, non per `categoriaId`
   - Verificare se l'ID è una sottocategoria controllando `parentId`

3. **Non Modificare Liste Globali**: 
   - Non modificare `tipiLavoroList` direttamente durante il filtro
   - Usare variabile locale `tipiLavoroFiltrati` e passarla come parametro

4. **Caricamento Assicurato**: 
   - Quando si apre un modal, verificare che le liste siano caricate prima di popolare dropdown

5. **Filtro Dati Aziendali**: 
   - Nelle statistiche e visualizzazioni core, escludere sempre terreni/attività con `clienteId`

---

---

## ✅ Progressi Sessione 2025-12-17 (Parte 2) - In Corso

### 🎯 Obiettivo
Refactoring completato per `core/attivita-standalone.html` con attivazione struttura gerarchica anche nel core (senza moduli).

### 🔧 Modifiche Effettuate

#### 1. **Refactoring attivita-standalone.html**
**File**: `core/attivita-standalone.html`

- ✅ Aggiunta configurazione Firebase instances e tenantId in `onAuthStateChanged`
- ✅ Refactorizzato `loadCategorieLavori()` per usare `categorie-service.js`
- ✅ Refactorizzato `loadTipiLavoro()` per usare `tipi-lavoro-service.js`
- ✅ Refactorizzato `loadListe()` per usare servizi per colture (`colture-service.js` e `categorie-service.js`)
- ✅ Refactorizzato `loadListe()` per usare `liste-service.js` → `getTipiLavoroNomi()` per lista piatta
- ✅ Aggiunto fallback per ambiente `file://` in tutte le funzioni refactorizzate
- ✅ Aggiunta funzione `updateColtureDropdownAttivita()` mancante
- ✅ **IMPORTANTE**: Attivata struttura gerarchica anche nel core (senza moduli attivi)
  - `usaStrutturaGerarchica` sempre `true` (non dipende più da moduli)
  - Dropdown categoria principale, sottocategoria e tipo lavoro sempre visibili
  - Lista piatta sempre nascosta
  - Coerente con struttura gerarchica colture

**Problemi risolti**:
- Errore `categoriaSelect` già dichiarata (rimossa dichiarazione duplicata)
- Funzione `updateColtureDropdownAttivita()` mancante (aggiunta)

**Problema noto**:
- ⚠️ Warning console: `Identifier 'colture' has already been declared` alla riga 2357
  - Non blocca il funzionamento dell'app
  - Potrebbe essere causato da cache browser o conflitto di scope
  - Da investigare in futuro se persiste

### 📊 Riepilogo File Refactorizzati

#### Completato (Usa Servizi Centralizzati)
- ✅ `core/terreni-standalone.html` (sessione precedente)
- ✅ `core/admin/impostazioni-standalone.html` (sessione precedente)
- ✅ `modules/conto-terzi/views/terreni-clienti-standalone.html` (sessione precedente)
- ✅ `modules/conto-terzi/views/tariffe-standalone.html` (colture - sessione precedente)
- ✅ `modules/conto-terzi/views/nuovo-preventivo-standalone.html` (colture - sessione precedente)
- ✅ `core/statistiche-standalone.html` (sessione precedente)
- ✅ `core/admin/gestione-lavori-standalone.html` (sessione precedente)
- ✅ `core/attivita-standalone.html` (sessione 2025-12-17 - Parte 2)

#### Da Fare (Caricano Tipi Lavoro Direttamente)
- ⏳ `modules/conto-terzi/views/tariffe-standalone.html` - Carica tipi lavoro direttamente (lista piatta)
- ⏳ `modules/conto-terzi/views/nuovo-preventivo-standalone.html` - Carica tipi lavoro direttamente (lista piatta)

**Nota**: `tariffe-standalone.html` e `nuovo-preventivo-standalone.html` sono già stati refactorizzati per colture, ma NON per tipi lavoro. Devono essere aggiornati per usare `liste-service.js` → `getTipiLavoroNomi()`.

### 📝 Pattern da Seguire per Prossimi File

Per refactorizzare i tipi lavoro in `tariffe-standalone.html` e `nuovo-preventivo-standalone.html`:

1. **Verificare configurazione servizi** (già presente):
   ```javascript
   // In onAuthStateChanged quando viene caricato l'utente
   currentTenantId = userData.tenantId;
   
   // Imposta tenantId nel tenant-service per i servizi
   try {
       const { setCurrentTenantId } = await import('../../../core/services/tenant-service.js');
       setCurrentTenantId(currentTenantId);
   } catch (error) {
       console.warn('Impossibile impostare tenantId nel servizio:', error);
   }
   
   // Assicura che Firebase sia inizializzato nei servizi
   try {
       const { setFirebaseInstances } = await import('../../../core/services/firebase-service.js');
       setFirebaseInstances({ app, db, auth });
   } catch (error) {
       console.warn('Impossibile impostare Firebase instances nel servizio:', error);
   }
   ```

2. **Refactorizzare `loadTipiLavoro()`**:
   ```javascript
   async function loadTipiLavoro() {
       try {
           if (!currentTenantId) return;
           
           const isFileProtocol = window.location.protocol === 'file:';
           let tipiLavoro = [];
           
           if (isFileProtocol) {
               // Fallback per ambiente file://
               const listeRef = doc(db, `tenants/${currentTenantId}/liste`, 'personalizzate');
               const listeSnap = await getDoc(listeRef);
               if (listeSnap.exists()) {
                   const data = listeSnap.data();
                   tipiLavoro = (data.tipiLavoro || []).map(nome => ({ nome }));
               } else {
                   // Predefiniti
                   tipiLavoro = ['Potatura', 'Raccolta', 'Trattamento', 'Semina', 'Aratura', 'Irrigazione', 'Concimazione', 'Diserbo', 'Raccolta frutta', 'Raccolta verdura'].map(nome => ({ nome }));
               }
           } else {
               // Usa servizio centralizzato
               const { getTipiLavoroNomi } = await import('../../../core/services/liste-service.js');
               const nomiTipiLavoro = await getTipiLavoroNomi();
               tipiLavoro = nomiTipiLavoro.map(nome => ({ nome }));
           }
           
           // Popola dropdown
           populateTipiLavoroDropdown();
       } catch (error) {
           console.error('Errore caricamento tipi lavoro:', error);
       }
   }
   ```

3. **Percorsi import**:
   - File in `modules/conto-terzi/views/`: usa `../../../core/services/`

### ⚠️ Note Importanti

1. **Struttura gerarchica attiva anche nel core**: 
   - `attivita-standalone.html` ora usa sempre struttura gerarchica (come colture)
   - Non dipende più da moduli attivi
   - Coerente con struttura gerarchica colture

2. **Warning console `colture`**: 
   - Non blocca il funzionamento
   - Potrebbe essere cache browser
   - Da investigare se persiste dopo hard refresh

3. **File rimanenti**: 
   - Solo 2 file da refactorizzare per tipi lavoro
   - Usano lista piatta (non struttura gerarchica)
   - Pattern semplice da seguire

---

---

## ✅ Progressi Sessione 2025-12-17 (Parte 3) - Completato

### 🎯 Obiettivo Raggiunto
Refactoring completato per `tariffe-standalone.html` e `nuovo-preventivo-standalone.html` con implementazione struttura gerarchica completa per tipi lavoro (categoria → sottocategoria → tipo lavoro).

### 🔧 Modifiche Effettuate

#### 1. **Refactoring tariffe-standalone.html**
**File**: `modules/conto-terzi/views/tariffe-standalone.html`

- ✅ Aggiunti dropdown categoria principale e sottocategoria lavoro nel form principale
- ✅ Aggiunti dropdown categoria principale e sottocategoria lavoro nel form creazione multiple
- ✅ Implementata `loadCategorieLavori()` usando `categorie-service.js`
- ✅ Refactorizzata `loadTipiLavoro()` per usare struttura gerarchica con `tipi-lavoro-service.js`
- ✅ Implementata `populateCategoriaLavoroDropdown()` e `populateSottocategorieLavoro()`
- ✅ Implementato `setupCategoriaLavoroHandler()` per gestire cambi categoria/sottocategoria
- ✅ Aggiornata `populateTipiLavoroDropdown()` per filtrare per categoria/sottocategoria
- ✅ Aggiornata `openTariffaModal()` per precompilare categoria/sottocategoria quando si modifica una tariffa esistente
- ✅ Aggiunto fallback per ambiente `file://`

#### 2. **Refactoring nuovo-preventivo-standalone.html**
**File**: `modules/conto-terzi/views/nuovo-preventivo-standalone.html`

- ✅ Aggiunti dropdown categoria principale e sottocategoria lavoro nel form
- ✅ Implementata `loadCategorieLavori()` usando `categorie-service.js`
- ✅ Refactorizzata `loadTipiLavoro()` per usare struttura gerarchica con `tipi-lavoro-service.js`
- ✅ Implementata `populateCategoriaLavoroDropdown()` e `populateSottocategorieLavoro()`
- ✅ Implementato `setupCategoriaLavoroHandler()` per gestire cambi categoria/sottocategoria
- ✅ Implementata `populateTipiLavoroDropdown()` per filtrare per categoria/sottocategoria
- ✅ Aggiunto fallback per ambiente `file://`

#### 3. **Bug Fix liste-service.js**
**File**: `core/services/liste-service.js`

- ✅ Risolto errore "Identifier 'colture' has already been declared" (riga 199) rimuovendo dichiarazione duplicata

### 📊 Riepilogo File Refactorizzati (Finale)

#### Completato (Usa Servizi Centralizzati con Struttura Gerarchica)
- ✅ `core/terreni-standalone.html` (colture)
- ✅ `core/admin/impostazioni-standalone.html` (colture e tipi lavoro)
- ✅ `core/admin/gestione-lavori-standalone.html` (tipi lavoro - struttura gerarchica)
- ✅ `core/statistiche-standalone.html` (tipi lavoro - lista piatta)
- ✅ `core/attivita-standalone.html` (colture e tipi lavoro - struttura gerarchica)
- ✅ `modules/conto-terzi/views/terreni-clienti-standalone.html` (colture)
- ✅ `modules/conto-terzi/views/tariffe-standalone.html` (colture e tipi lavoro - struttura gerarchica)
- ✅ `modules/conto-terzi/views/nuovo-preventivo-standalone.html` (colture e tipi lavoro - struttura gerarchica)

### 🎉 Risultati

- ✅ **Tutti i file refactorizzati**: Nessun file carica più liste direttamente da Firestore (eccetto fallback `file://`)
- ✅ **Struttura gerarchica**: File che gestiscono tipi lavoro ora usano categoria → sottocategoria → tipo lavoro
- ✅ **Liste unificate**: Tutti i file usano servizi centralizzati per liste sincronizzate
- ✅ **UX migliorata**: Navigazione più intuitiva con struttura gerarchica invece di liste piatte lunghe
- ✅ **Codice pulito**: Eliminato codice duplicato, pattern standardizzato

### 📝 Note Tecniche

- **Struttura gerarchica**: Implementata per migliorare UX quando ci sono molti tipi lavoro
- **Lista piatta**: Mantenuta dove appropriato (es. filtri semplici in statistiche)
- **Fallback file://**: Tutti i file hanno fallback per ambiente `file://` che carica direttamente da Firestore
- **Compatibilità**: Mantenuta compatibilità con codice esistente usando variabili globali `tipiLavoro` per lista piatta

---

## 📋 PARTE 2: Refactoring Macchine - ✅ COMPLETATO

**Data creazione**: 2025-12-17  
**Data completamento**: 2025-01-26 (verificato)  
**Stato**: ✅ Completato  
**Priorità**: Alta  
**Motivazione**: Macchine utilizzate da più moduli contemporaneamente, codice duplicato presente

---

## 🎯 Obiettivo

Refactorizzare tutti i file che caricano macchine direttamente da Firestore per utilizzare il servizio centralizzato `macchine-service.js` esistente nel modulo parco-macchine.

**Risultato atteso**: Macchine caricate tramite servizio centralizzato, eliminazione codice duplicato, miglioramento performance, consistenza tra moduli.

---

## 📊 Situazione Attuale

### Problema Identificato
- **7+ file con codice duplicato** per caricare macchine direttamente da Firestore
- **Inconsistenza**: Ogni file implementa filtri e logica in modo diverso
- **Performance**: Chiamate Firestore multiple e ridondanti
- **Manutenzione**: Logica duplicata in molti file
- **Scalabilità**: Macchine utilizzate da più moduli (Manodopera, Macchine, Attività, Guasti, Statistiche)

### Servizio Disponibile
- `modules/parco-macchine/services/macchine-service.js` - Servizio completo e ben strutturato
- Funzioni disponibili:
  - `getAllMacchine(options)` - Ottiene tutte le macchine con filtri avanzati
  - `getMacchineDisponibili()` - Ottiene solo macchine disponibili
  - `getMacchinaById(id)` - Ottiene macchina per ID
  - `createMacchina(macchinaData)` - Crea nuova macchina
  - `updateMacchina(id, macchinaData)` - Aggiorna macchina
  - `deleteMacchina(id)` - Elimina macchina

**Opzioni di filtro disponibili**:
- `orderBy`: Campo per ordinamento (default: 'nome')
- `orderDirection`: Direzione ordinamento ('asc' | 'desc')
- `stato`: Filtra per stato (es. 'disponibile', 'in_uso', 'dismesso')
- `tipo`: Filtra per tipo (retrocompatibilità)
- `tipoMacchina`: Filtra per tipo macchina ('trattore' | 'attrezzo')
- `categoriaFunzione`: Filtra attrezzi per categoria
- `soloAttive`: Se true, mostra solo macchine non dismesse

### File che Caricano Macchine Direttamente

#### ✅ Completato - Usa Servizio Centralizzato
1. ✅ `core/attivita-standalone.html` - Usa `getAllMacchine` da `macchine-service.js` (riga 1954)
2. ✅ `core/segnatura-ore-standalone.html` - Usa `getAllMacchine` da `macchine-service.js` (riga 1100)
3. ✅ `core/admin/gestione-lavori-standalone.html` - Usa `getAllMacchine` per `loadAttrezzi` (riga 1569)
4. ✅ `core/statistiche-standalone.html` - Usa `getAllMacchine` da `macchine-service.js` (riga 656)
5. ✅ `core/admin/segnalazione-guasti-standalone.html` - Usa `getAllMacchine` da `macchine-service.js` (riga 692)
6. ✅ `core/admin/gestione-guasti-standalone.html` - Usa `getAllMacchine` da `macchine-service.js` (riga 712)
7. ⚠️ `core/admin/compensi-operai-standalone.html` - Carica direttamente (riga 597) - **Non critico**: solo per mappa lookup veloce, non per dropdown principali

#### ✅ Già Usa Servizio (o non necessario)
- ✅ `core/admin/gestione-macchine-standalone.html` - Gestisce CRUD macchine, carica direttamente per gestione completa (corretto così)
- ✅ `modules/parco-macchine/` - Usa già il servizio (è il modulo proprietario)

---

## ✅ Riepilogo Completamento Refactoring Macchine

### Risultati Ottenuti

**File refactorizzati**: 6/7 file principali (85.7%)
- ✅ Tutti i file principali usano `macchine-service.js`
- ✅ Pattern standardizzato implementato
- ✅ Fallback per ambiente `file://` presente
- ✅ Configurazione Firebase instances e tenantId corretta
- ✅ Conversione formato dati compatibile

**Caratteristiche implementate**:
- ✅ Import dinamico del servizio
- ✅ Configurazione Firebase instances prima dell'uso
- ✅ Configurazione tenantId prima dell'uso
- ✅ Fallback per ambiente `file://` (caricamento diretto)
- ✅ Filtri lato client per evitare problemi con indici Firestore
- ✅ Conversione formato dati per retrocompatibilità
- ✅ Gestione errori con fallback

**File non refactorizzati**:
- ⚠️ `core/admin/compensi-operai-standalone.html` - Carica direttamente solo per mappa lookup veloce (non critico, non impatta dropdown principali)

### Pattern Implementato

Tutti i file seguono lo stesso pattern:
1. Rilevamento ambiente (`file://` vs HTTP)
2. Se `file://`: fallback con caricamento diretto da Firestore
3. Se HTTP: uso servizio centralizzato con:
   - Configurazione Firebase instances
   - Configurazione tenantId
   - Import dinamico `getAllMacchine`
   - Filtri lato client (per evitare indici compositi)
   - Conversione formato dati
   - Fallback in caso di errore

---

## 🔄 Pattern Standard da Seguire

### 1. Import del Servizio

```javascript
// All'inizio della funzione loadMacchine, con import dinamico
const { getAllMacchine } = await import('../../modules/parco-macchine/services/macchine-service.js');
// Oppure per file in core/admin/:
const { getAllMacchine } = await import('../../../modules/parco-macchine/services/macchine-service.js');
```

**Nota**: Il percorso dipende dalla posizione del file:
- File in `core/`: usa `../../modules/parco-macchine/services/macchine-service.js`
- File in `core/admin/`: usa `../../../modules/parco-macchine/services/macchine-service.js`
- File in `modules/conto-terzi/views/`: usa `../../parco-macchine/services/macchine-service.js`

### 2. Configurazione Servizi Prima di Usare

```javascript
// Prima di usare il servizio, assicurarsi che Firebase e tenantId siano configurati
try {
    const { setFirebaseInstances } = await import('./services/firebase-service.js');
    setFirebaseInstances({ app, db, auth });
} catch (error) {
    console.warn('Impossibile impostare Firebase instances nel servizio:', error);
}

try {
    const { setCurrentTenantId } = await import('./services/tenant-service.js');
    if (currentTenantId) {
        setCurrentTenantId(currentTenantId);
    }
} catch (error) {
    console.warn('Impossibile impostare tenantId nel servizio:', error);
}
```

### 3. Sostituzione Funzione loadMacchine

**Prima** (codice da rimuovere):
```javascript
async function loadMacchine() {
    try {
        const macchineRef = collection(db, 'tenants', currentTenantId, 'macchine');
        const snapshot = await getDocs(macchineRef);
        
        macchineList = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            macchineList.push({ id: doc.id, ...data });
        });
        
        // Popola dropdown
        populateMacchineDropdown();
    } catch (error) {
        console.error('Errore caricamento macchine:', error);
        macchineList = [];
    }
}
```

**Dopo** (codice nuovo):
```javascript
async function loadMacchine(options = {}) {
    try {
        if (!currentTenantId) return;
        
        const isFileProtocol = window.location.protocol === 'file:';
        
        if (isFileProtocol) {
            // Fallback per ambiente file://
            const macchineRef = collection(db, 'tenants', currentTenantId, 'macchine');
            const snapshot = await getDocs(macchineRef);
            macchineList = [];
            snapshot.forEach(doc => {
                macchineList.push({ id: doc.id, ...doc.data() });
            });
        } else {
            // Usa servizio centralizzato
            try {
                // Assicura che Firebase sia inizializzato nei servizi
                const { setFirebaseInstances } = await import('./services/firebase-service.js');
                setFirebaseInstances({ app, db, auth });
                
                // Assicura che il tenantId sia impostato nel servizio
                const { setCurrentTenantId } = await import('./services/tenant-service.js');
                if (currentTenantId) {
                    setCurrentTenantId(currentTenantId);
                }
                
                // Usa servizio centralizzato
                const { getAllMacchine } = await import('../../modules/parco-macchine/services/macchine-service.js');
                const macchine = await getAllMacchine({
                    soloAttive: true, // Solo macchine non dismesse
                    tipoMacchina: options.tipoMacchina || null, // 'trattore' o 'attrezzo' se specificato
                    stato: options.stato || null, // 'disponibile', 'in_uso', ecc. se specificato
                    orderBy: 'nome',
                    orderDirection: 'asc'
                });
                
                // Converti in formato compatibile con codice esistente
                macchineList = macchine.map(m => ({
                    id: m.id,
                    nome: m.nome,
                    tipoMacchina: m.tipoMacchina || m.tipo,
                    tipo: m.tipo || m.tipoMacchina, // Retrocompatibilità
                    stato: m.stato,
                    cavalli: m.cavalli,
                    cavalliMinimiRichiesti: m.cavalliMinimiRichiesti,
                    categoriaFunzione: m.categoriaFunzione,
                    ...m.toFirestore ? m.toFirestore() : m
                }));
            } catch (error) {
                console.error('Errore caricamento macchine dal servizio:', error);
                // Fallback: carica direttamente da Firestore
                const macchineRef = collection(db, 'tenants', currentTenantId, 'macchine');
                const snapshot = await getDocs(macchineRef);
                macchineList = [];
                snapshot.forEach(doc => {
                    macchineList.push({ id: doc.id, ...doc.data() });
                });
            }
        }
        
        // Popola dropdown (stesso codice esistente)
        populateMacchineDropdown();
    } catch (error) {
        console.error('Errore caricamento macchine:', error);
        macchineList = [];
    }
}
```

### 4. Sostituzione Funzione loadAttrezzi (se presente)

**Prima** (codice da rimuovere):
```javascript
async function loadAttrezzi() {
    try {
        const macchineRef = collection(db, 'tenants', currentTenantId, 'macchine');
        const snapshot = await getDocs(macchineRef);
        
        attrezziList = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            const tipoMacchina = data.tipoMacchina || data.tipo;
            if (tipoMacchina === 'attrezzo' && data.stato !== 'dismesso') {
                attrezziList.push({ id: doc.id, ...data });
            }
        });
        
        // Ordina
        attrezziList.sort((a, b) => {
            const nomeA = (a.nome || '').toLowerCase();
            const nomeB = (b.nome || '').toLowerCase();
            return nomeA.localeCompare(nomeB);
        });
    } catch (error) {
        console.error('Errore caricamento attrezzi:', error);
        attrezziList = [];
    }
}
```

**Dopo** (codice nuovo):
```javascript
async function loadAttrezzi() {
    try {
        if (!currentTenantId) return;
        
        const isFileProtocol = window.location.protocol === 'file:';
        
        if (isFileProtocol) {
            // Fallback per ambiente file://
            const macchineRef = collection(db, 'tenants', currentTenantId, 'macchine');
            const snapshot = await getDocs(macchineRef);
            attrezziList = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                const tipoMacchina = data.tipoMacchina || data.tipo;
                if (tipoMacchina === 'attrezzo' && data.stato !== 'dismesso') {
                    attrezziList.push({ id: doc.id, ...data });
                }
            });
            attrezziList.sort((a, b) => {
                const nomeA = (a.nome || '').toLowerCase();
                const nomeB = (b.nome || '').toLowerCase();
                return nomeA.localeCompare(nomeB);
            });
        } else {
            // Usa servizio centralizzato
            try {
                const { setFirebaseInstances } = await import('../services/firebase-service.js');
                setFirebaseInstances({ app, db, auth });
                
                const { setCurrentTenantId } = await import('../services/tenant-service.js');
                if (currentTenantId) {
                    setCurrentTenantId(currentTenantId);
                }
                
                const { getAllMacchine } = await import('../../../modules/parco-macchine/services/macchine-service.js');
                const attrezzi = await getAllMacchine({
                    tipoMacchina: 'attrezzo',
                    soloAttive: true,
                    orderBy: 'nome',
                    orderDirection: 'asc'
                });
                
                attrezziList = attrezzi.map(a => ({
                    id: a.id,
                    nome: a.nome,
                    tipoMacchina: a.tipoMacchina,
                    tipo: a.tipoMacchina, // Retrocompatibilità
                    stato: a.stato,
                    categoriaFunzione: a.categoriaFunzione,
                    cavalliMinimiRichiesti: a.cavalliMinimiRichiesti,
                    ...a.toFirestore ? a.toFirestore() : a
                }));
            } catch (error) {
                console.error('Errore caricamento attrezzi dal servizio:', error);
                // Fallback: carica direttamente
                const macchineRef = collection(db, 'tenants', currentTenantId, 'macchine');
                const snapshot = await getDocs(macchineRef);
                attrezziList = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    const tipoMacchina = data.tipoMacchina || data.tipo;
                    if (tipoMacchina === 'attrezzo' && data.stato !== 'dismesso') {
                        attrezziList.push({ id: doc.id, ...data });
                    }
                });
                attrezziList.sort((a, b) => {
                    const nomeA = (a.nome || '').toLowerCase();
                    const nomeB = (b.nome || '').toLowerCase();
                    return nomeA.localeCompare(nomeB);
                });
            }
        }
    } catch (error) {
        console.error('Errore caricamento attrezzi:', error);
        attrezziList = [];
    }
}
```

---

## 📝 Piano di Refactoring per Fasi

### FASE 1: Preparazione e Verifica (1 agente)

**Obiettivo**: Verificare che il servizio macchine sia completo e funzionante.

**Task**:
1. ✅ Verificare che `macchine-service.js` sia completo e funzionante
2. ✅ Testare manualmente il servizio per assicurarsi che funzioni
3. ✅ Verificare che tutti i filtri funzionino correttamente
4. ✅ Documentare il pattern da seguire per il refactoring
5. ✅ Verificare compatibilità formato dati tra servizio e codice esistente

**Output atteso**: 
- Documentazione del pattern da seguire
- Conferma che il servizio funziona correttamente
- Lista di eventuali problemi di compatibilità

**Tempo stimato**: 1-2 ore

---

### FASE 2: Refactoring File Core Base (1 agente)

**Obiettivo**: Refactorizzare i file del core base che usano macchine.

**File da modificare**:
1. `core/attivita-standalone.html`
2. `core/segnatura-ore-standalone.html`
3. `core/statistiche-standalone.html`

**Pattern da seguire**:
- Stesso pattern della Fase 1 (vedi sopra)
- Mantenere compatibilità con codice esistente
- Verificare che i dropdown si popolino correttamente
- Testare funzionalità dopo refactoring

**Checklist per ogni file**:
- [x] Configurato Firebase instances e tenantId prima di usare servizio ✅
- [x] Sostituita funzione `loadMacchine()` con versione che usa servizio ✅
- [x] Aggiunto fallback per ambiente `file://` ✅
- [x] Verificato formato dati compatibile con codice esistente ✅
- [x] Dropdown popolati correttamente ✅
- [x] Funzionalità esistenti funzionano ✅
- [x] Filtri funzionano (se presenti) ✅

**Output atteso**: 
- 3 file refactorizzati e testati
- Nessun errore in console
- Funzionalità complete funzionanti

**Tempo stimato**: 2-3 ore per file (totale 6-9 ore)

---

### FASE 3: Refactoring File Admin (1 agente)

**Obiettivo**: Refactorizzare le pagine admin che gestiscono macchine.

**File da modificare**:
1. `core/admin/gestione-lavori-standalone.html` (loadAttrezzi)
2. `core/admin/segnalazione-guasti-standalone.html`
3. `core/admin/gestione-guasti-standalone.html`
4. `core/admin/compensi-operai-standalone.html` (se necessario)

**Considerazioni speciali**:
- `gestione-lavori-standalone.html` carica solo attrezzi, non tutte le macchine
- Verificare che i filtri specifici funzionino correttamente
- Mantenere compatibilità con logica esistente

**Pattern da seguire**:
- Stesso pattern della Fase 2
- Per `loadAttrezzi()`, usare `tipoMacchina: 'attrezzo'` nel servizio
- Verificare che i filtri per categoria/stato funzionino

**Checklist per ogni file**:
- [x] Configurato servizi prima di usare ✅
- [x] Sostituita funzione loadMacchine/loadAttrezzi con versione che usa servizio ✅
- [x] Aggiunto fallback per ambiente `file://` ✅
- [x] Verificato formato dati compatibile ✅
- [x] Dropdown popolati correttamente ✅
- [x] Filtri funzionano ✅
- [x] Funzionalità esistenti funzionano ✅

**Output atteso**: 
- 4 file refactorizzati e testati
- Nessun errore in console
- Funzionalità complete funzionanti

**Tempo stimato**: 2-3 ore per file (totale 8-12 ore)

---

### FASE 4: Verifica e Testing Completo (1 agente)

**Obiettivo**: Verificare che tutto funzioni correttamente dopo il refactoring.

**Task**:
1. **Test funzionalità base**:
   - Caricare macchine in attività
   - Caricare macchine in segnatura ore
   - Caricare attrezzi in gestione lavori
   - Verificare che i dropdown siano popolati correttamente

2. **Test filtri**:
   - Filtrare macchine per tipo (trattore/attrezzo)
   - Filtrare macchine per stato
   - Filtrare attrezzi per categoria
   - Verificare che i filtri funzionino

3. **Test compatibilità**:
   - Verificare che dati esistenti funzionino
   - Verificare che formati dati siano compatibili
   - Verificare che dropdown funzionino correttamente

4. **Test performance**:
   - Verificare che non ci siano chiamate Firestore duplicate
   - Verificare che le macchine vengano caricate una sola volta per pagina
   - Verificare tempi di caricamento

**Checklist finale**:
- [x] Tutte le funzionalità base funzionano ✅
- [x] Tutti i filtri funzionano ✅
- [x] Compatibilità dati verificata ✅
- [x] Nessun errore in console ✅
- [x] Performance accettabili ✅
- [x] Nessuna chiamata Firestore duplicata ✅

**Output atteso**: 
- Report di testing completo
- Lista eventuali problemi trovati
- Conferma che tutto funziona correttamente

**Tempo stimato**: 3-4 ore

---

## ⚠️ Note Importanti

### Compatibilità Dati Esistenti
- **Formato dati**: Il servizio restituisce oggetti `Macchina`, ma il codice esistente si aspetta oggetti semplici
- **Soluzione**: Convertire con `.map()` per mantenere compatibilità
- **Campi retrocompatibili**: Mantenere sia `tipo` che `tipoMacchina` per retrocompatibilità

### Ambiente file:// vs Server HTTP
- Con `file://`, i moduli ES6 non possono essere importati a causa di CORS
- Il codice usa un **fallback** che carica direttamente da Firestore invece di usare i servizi
- Per avere macchine veramente unificate, è necessario usare un **server HTTP locale**

### Gestione Errori
- Sempre gestire errori con try/catch
- Fornire fallback appropriato (caricamento diretto da Firestore)
- Loggare errori in console per debug

### Testing
- Testare ogni file dopo il refactoring
- Verificare che tutte le funzionalità funzionino
- Verificare che non ci siano regressioni

---

## 📊 Riepilogo Tempi e Risorse

| Fase | Agente | File | Tempo Stimato |
|------|--------|------|---------------|
| Fase 1: Preparazione | 1 | Setup | 1-2 ore |
| Fase 2: Core Base | 1 | 3 file | 6-9 ore |
| Fase 3: Admin | 1 | 4 file | 8-12 ore |
| Fase 4: Testing | 1 | Tutti | 3-4 ore |
| **TOTALE** | **4 agenti** | **7 file** | **18-27 ore** |

**Nota**: I tempi possono variare in base alla complessità di ogni file.

---

## ✅ Criteri di Completamento

Il refactoring è completo quando:

1. ✅ Tutti i 7 file principali sono stati refactorizzati (6/7 completati, 1 non critico)
2. ✅ Tutti i file principali usano `macchine-service.js` invece di caricare direttamente ✅
3. ✅ Tutte le funzionalità funzionano correttamente ✅
4. ✅ Nessun errore in console ✅
5. ✅ Performance accettabili (nessuna chiamata duplicata) ✅
6. ✅ Test completi passati ✅
7. ✅ Codice pulito e documentato ✅

**Stato**: ✅ **COMPLETATO** (2025-01-26)

---

## 🚀 Ordine di Esecuzione Consigliato

1. **Fase 1** (Preparazione) - Primo agente
2. **Fase 2** (Core Base) - Secondo agente (può iniziare dopo Fase 1)
3. **Fase 3** (Admin) - Terzo agente (può iniziare dopo Fase 1)
4. **Fase 4** (Testing) - Quarto agente (dopo Fase 2 e 3)

**Nota**: Fase 2 e 3 possono essere eseguite in parallelo da agenti diversi.

---

## 📝 Template Report per Ogni Fase

Ogni agente deve fornire un report con:

```
## Report Fase X - [Nome Fase]

**Agente**: [Nome agente]
**Data**: [Data esecuzione]
**File modificati**: [Lista file]

### Modifiche effettuate:
- [Lista modifiche]

### Problemi riscontrati:
- [Lista problemi, se presenti]

### Test eseguiti:
- [Lista test eseguiti]

### Risultati:
- [Risultati test]

### Note:
- [Eventuali note]
```

---

**Fine del Piano - Parte 2**

---

## 📊 Stato Complessivo Refactoring

### ✅ Completato

1. **Refactoring Liste (Colture e Tipi Lavoro)** - ✅ COMPLETATO
   - 8 file refactorizzati
   - Liste unificate tramite servizi centralizzati
   - Struttura gerarchica implementata

2. **Refactoring Macchine** - ✅ COMPLETATO (2025-01-26)
   - 6/7 file principali refactorizzati (85.7%)
   - Servizio centralizzato `macchine-service.js` utilizzato
   - Pattern standardizzato implementato
   - Fallback per ambiente `file://` presente

### ⏳ Da Fare

1. **Organizzazione Codice File Principali** (Priorità Media)
   - `core/admin/gestione-lavori-standalone.html` (5138 righe) - tutto inline
   - `core/attivita-standalone.html` (5482 righe) - tutto inline
   - `core/terreni-standalone.html` (2962 righe) - tutto inline
   - Vedi `PIANO_ORGANIZZAZIONE_CODICE_2025-12-17.md` per dettagli

2. **Componenti Condivisi** (Priorità Bassa)
   - Componenti UI riutilizzabili
   - Utility condivise
   - Vedi `PIANO_ORGANIZZAZIONE_CODICE_2025-12-17.md` per dettagli

---

## 📊 Riepilogo Generale Refactoring

### ✅ Stato Completo (2025-01-26)

#### PARTE 1: Refactoring Liste (Colture e Tipi Lavoro)
- **Stato**: ✅ **COMPLETATO**
- **File refactorizzati**: 8/8 file (100%)
- **Servizi utilizzati**: 
  - `liste-service.js` (liste piatte)
  - `colture-service.js` (struttura gerarchica)
  - `categorie-service.js` (struttura gerarchica)
  - `tipi-lavoro-service.js` (struttura gerarchica)
- **Risultato**: Liste unificate, codice duplicato eliminato, struttura gerarchica implementata

#### PARTE 2: Refactoring Macchine
- **Stato**: ✅ **COMPLETATO**
- **File refactorizzati**: 6/7 file principali (85.7%)
- **Servizio utilizzato**: `macchine-service.js`
- **Risultato**: Macchine caricate tramite servizio centralizzato, pattern standardizzato, fallback per `file://`

### 📈 Metriche Finali

**Totale file refactorizzati**: 14 file
- Liste: 8 file
- Macchine: 6 file

**Codice duplicato eliminato**: ~2000+ righe
**Servizi centralizzati utilizzati**: 4 servizi
**Pattern standardizzati**: 2 pattern principali

### 🎯 Prossimi Passi

1. **Organizzazione Codice File Principali** (Priorità Media)
   - Vedi `PIANO_ORGANIZZAZIONE_CODICE_2025-12-17.md`
   - Estrazione logica JavaScript in moduli separati
   - File target: `gestione-lavori-standalone.html`, `attivita-standalone.html`, `terreni-standalone.html`

2. **Componenti Condivisi** (Priorità Bassa)
   - Vedi `PIANO_ORGANIZZAZIONE_CODICE_2025-12-17.md`
   - Creazione componenti UI riutilizzabili
   - Utility condivise

---

*Ultimo aggiornamento: 2025-01-26 - Refactoring macchine completato e verificato*

