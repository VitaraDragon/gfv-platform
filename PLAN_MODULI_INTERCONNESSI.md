# 📋 Piano Sviluppo: Moduli Interconnessi e Assegnazione Diretta Lavori

**Data creazione**: 2025-01-23  
**Data completamento**: 2025-01-23  
**Stato**: ✅ COMPLETATO  
**Priorità**: Media-Alta

---

## 🎯 Obiettivo

Implementare un sistema flessibile che permetta:
1. **Moduli interconnessi** con integrazioni opzionali (es. Parco Macchine + Manodopera)
2. **Assegnazione diretta lavori** agli operai senza passare per caposquadra (per lavori autonomi)
3. **Dashboard adattiva** che si adatta al contesto (trattorista, operaio semplice, multi-ruolo)

---

## 📦 Parte 1: Moduli Interconnessi (Parco Macchine + Manodopera)

### 1.1 Principio Architetturale

**Moduli indipendenti con integrazioni opzionali progressive**

- Ogni modulo deve funzionare **standalone**
- Le integrazioni si attivano **automaticamente** se altri moduli sono presenti
- Nessuna dipendenza obbligatoria tra moduli

### 1.2 Parco Macchine Standalone

**Funzionalità base** (funziona senza Manodopera):
- ✅ Gestione macchine (anagrafica, manutenzioni, scadenze)
- ✅ Assegnazione manuale a utenti generici
- ✅ Tracciamento utilizzi e costi
- ✅ Report manutenzioni

**File da creare**:
- `modules/parco-macchine/models/Macchina.js`
- `modules/parco-macchine/services/macchine-service.js`
- `modules/parco-macchine/views/gestione-macchine-standalone.html`

### 1.3 Parco Macchine con Manodopera Attivo

**Funzionalità avanzate** (si attivano se Manodopera è attivo):
- ✅ Assegnazione automatica a trattoristi (filtro per `tipoOperaio = "trattorista"`)
- ✅ Integrazione con lavori (assegnazione macchina al lavoro)
- ✅ Calcolo costi macchina nei compensi operai
- ✅ Report utilizzo macchine per operaio

**Pattern di implementazione**:
```javascript
// Esempio: Dropdown assegnazione macchina
async function getOperaiDisponibili() {
  if (await hasModuleAccess('manodopera')) {
    // Se Manodopera attivo: filtra per tipoOperaio = 'trattorista'
    return await getOperaiByTipo('trattorista');
  } else {
    // Se Manodopera non attivo: mostra tutti gli utenti
    return await getAllUsers();
  }
}
```

### 1.4 Estensione Modello Lavoro per Macchine

**Campi da aggiungere** (opzionali, solo se Parco Macchine attivo):
```javascript
// Nel modello Lavoro (core/models/Lavoro.js)
{
  macchinaId: null,           // ID macchina assegnata (opzionale)
  attrezzoId: null,           // ID attrezzo assegnato (opzionale)
  operatoreMacchinaId: null   // ID operaio che usa la macchina (opzionale)
}
```

**Validazione**:
- Campi opzionali (non obbligatori)
- Se presenti, verificare che macchina/attrezzo esistano
- Se `operatoreMacchinaId` presente, verificare che utente esista

**File da modificare**:
- `core/models/Lavoro.js` - Aggiungere campi opzionali
- `core/services/lavori-service.js` - Validazione campi macchina

### 1.5 Form Creazione Lavoro con Macchine

**Modifiche al form** (`core/admin/gestione-lavori-standalone.html`):

1. **Verificare se Parco Macchine è attivo**:
   ```javascript
   const parcoMacchineAttivo = await hasModuleAccess('parcoMacchine');
   ```

2. **Se attivo, mostrare sezione macchine**:
   - Dropdown "Macchina assegnata" (solo macchine disponibili)
   - Dropdown "Attrezzo assegnato" (solo attrezzi disponibili)
   - Dropdown "Operatore macchina" (se Manodopera attivo: filtra per trattoristi)

3. **Salvataggio**:
   - Salvare `macchinaId`, `attrezzoId`, `operatoreMacchinaId` nel documento lavoro
   - Campi opzionali: possono essere null

### 1.6 Dashboard Operaio Adattiva con Macchine

**Modifiche** (`core/dashboard-standalone.html` e `core/js/dashboard-sections.js`):

1. **Rilevare se Parco Macchine è attivo**
2. **Rilevare se lavoro ha macchina assegnata**
3. **Mostrare sezione "Dettagli Macchina" quando rilevante**:
   ```javascript
   function renderOperaioDashboard(operaiData, lavori) {
     // Base: sempre mostra lavori e segnatura ore
     renderLavoriOggi(lavori);
     renderSegnaturaOre();
     
     // Enhancement: se Parco Macchine attivo E lavoro ha macchina
     if (hasModuleAccess('parcoMacchine')) {
       const lavoriConMacchina = lavori.filter(l => l.macchinaId);
       
       if (lavoriConMacchina.length > 0) {
         // Mostra sezione "Dettagli Macchina"
         renderDettagliMacchina(lavoriConMacchina);
       }
     }
   }
   ```

**Sezione da aggiungere**:
- Card "Macchina Assegnata" con dettagli macchina
- Card "Attrezzo Assegnato" con dettagli attrezzo
- Link a dettagli macchina (se Parco Macchine attivo)
- Stato macchina (disponibile/in uso/in manutenzione)

### 1.7 Integrazione Segnatura Ore con Macchine

**Modifiche** (`core/segnatura-ore-standalone.html`):

1. **Verificare se lavoro ha macchina assegnata**
2. **Se sì, mostrare campi aggiuntivi**:
   - Campo "Macchina utilizzata" (pre-compilato con macchina del lavoro)
   - Campo "Attrezzo utilizzato" (pre-compilato con attrezzo del lavoro)
   - Campo "Ore macchina" (opzionale, per calcolo costi)

3. **Salvataggio**:
   - Salvare `macchinaUtilizzata`, `attrezzoUtilizzato` nelle ore segnate
   - Usare per calcolo costi macchina nei compensi

---

## 🔧 Parte 2: Assegnazione Diretta Lavori agli Operai

### 2.1 Modifiche Architetturali al Modello Lavoro

**Problema attuale**: `caposquadraId` è obbligatorio, non permette lavori autonomi.

**Soluzione**: Sistema ibrido - O caposquadra O operaio diretto

**Modifiche al modello** (`core/models/Lavoro.js`):

```javascript
export class Lavoro extends Base {
  constructor(data = {}) {
    super(data);
    
    // Campi esistenti
    this.nome = data.nome || '';
    this.terrenoId = data.terrenoId || null;
    this.tipoLavoro = data.tipoLavoro || '';
    
    // ASSEGNAZIONE FLESSIBILE (uno dei due, non entrambi)
    this.caposquadraId = data.caposquadraId || null;    // Per lavori di squadra
    this.operaioId = data.operaioId || null;            // Per lavori autonomi (NUOVO)
    
    // ... resto del costruttore
  }
  
  validate() {
    const errors = [];
    
    // Validazioni esistenti...
    
    // NUOVA VALIDAZIONE: almeno uno dei due deve essere presente
    if (!this.caposquadraId && !this.operaioId) {
      errors.push('Deve essere assegnato almeno un caposquadra o un operaio');
    }
    
    // Non possono essere entrambi presenti (mutualmente esclusivi)
    if (this.caposquadraId && this.operaioId) {
      errors.push('Un lavoro non può essere assegnato sia a un caposquadra che a un operaio diretto');
    }
    
    // Se caposquadraId presente, verificare che sia caposquadra
    if (this.caposquadraId) {
      // Verifica esistenza e ruolo (già presente nel codice esistente)
    }
    
    // Se operaioId presente, verificare che esista
    if (this.operaioId) {
      // Verifica esistenza utente
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}
```

### 2.2 Tipi di Lavoro

**Tipo A: Lavoro di Squadra** (esistente):
- `caposquadraId` presente
- `operaioId` null
- Caposquadra gestisce squadra
- Caposquadra valida ore
- Caposquadra traccia zone

**Tipo B: Lavoro Autonomo** (nuovo):
- `operaioId` presente
- `caposquadraId` null
- Operaio lavora autonomamente
- Manager valida ore direttamente
- Operaio può tracciare zone (opzionale)

### 2.3 Form Creazione Lavoro con Assegnazione Flessibile

**Modifiche** (`core/admin/gestione-lavori-standalone.html`):

1. **Aggiungere radio button "Tipo Assegnazione"**:
   ```html
   <div class="form-group">
     <label>Tipo Assegnazione:</label>
     <div>
       <input type="radio" id="tipo-squadra" name="tipoAssegnazione" value="squadra" checked>
       <label for="tipo-squadra">Lavoro di Squadra</label>
     </div>
     <div>
       <input type="radio" id="tipo-autonomo" name="tipoAssegnazione" value="autonomo">
       <label for="tipo-autonomo">Lavoro Autonomo</label>
     </div>
   </div>
   ```

2. **Mostrare dropdown appropriato in base alla selezione**:
   ```javascript
   document.getElementById('tipo-squadra').addEventListener('change', function() {
     if (this.checked) {
       document.getElementById('caposquadra-group').style.display = 'block';
       document.getElementById('operaio-group').style.display = 'none';
       document.getElementById('lavoro-operaio').value = '';
     }
   });
   
   document.getElementById('tipo-autonomo').addEventListener('change', function() {
     if (this.checked) {
       document.getElementById('caposquadra-group').style.display = 'none';
       document.getElementById('operaio-group').style.display = 'block';
       document.getElementById('lavoro-caposquadra').value = '';
     }
   });
   ```

3. **Validazione al salvataggio**:
   ```javascript
   function validateLavoroForm() {
     const tipoAssegnazione = document.querySelector('input[name="tipoAssegnazione"]:checked').value;
     
     if (tipoAssegnazione === 'squadra') {
       const caposquadraId = document.getElementById('lavoro-caposquadra').value;
       if (!caposquadraId) {
         throw new Error('Seleziona un caposquadra per lavori di squadra');
       }
     } else {
       const operaioId = document.getElementById('lavoro-operaio').value;
       if (!operaioId) {
         throw new Error('Seleziona un operaio per lavori autonomi');
       }
     }
   }
   ```

4. **Salvataggio**:
   ```javascript
   const tipoAssegnazione = document.querySelector('input[name="tipoAssegnazione"]:checked').value;
   
   const lavoroData = {
     nome: document.getElementById('lavoro-nome').value,
     terrenoId: document.getElementById('lavoro-terreno').value,
     tipoLavoro: document.getElementById('lavoro-tipo').value,
     // ...
   };
   
   if (tipoAssegnazione === 'squadra') {
     lavoroData.caposquadraId = document.getElementById('lavoro-caposquadra').value;
     lavoroData.operaioId = null;
   } else {
     lavoroData.operaioId = document.getElementById('lavoro-operaio').value;
     lavoroData.caposquadraId = null;
   }
   ```

### 2.4 Dashboard Operaio: Lavori Diretti + Squadra

**Modifiche** (`core/dashboard-standalone.html` - funzione `loadLavoriOggiOperaio`):

```javascript
async function loadLavoriOggiOperaio(userData) {
  try {
    const user = auth.currentUser;
    if (!user || !userData || !userData.tenantId) return;
    
    const operaioId = userData.id || user.uid;
    const tenantId = userData.tenantId;
    
    const lavoriRef = collection(db, `tenants/${tenantId}/lavori`);
    const lavoriSnapshot = await getDocs(lavoriRef);
    
    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);
    
    const lavoriOggi = [];
    
    // 1. LAVORI DIRETTI (assegnati direttamente all'operaio)
    lavoriSnapshot.forEach(doc => {
      const lavoro = doc.data();
      
      if (lavoro.operaioId === operaioId) {
        const stato = lavoro.stato || 'assegnato';
        if (stato !== 'completato' && stato !== 'annullato' && stato !== 'completato_da_approvare') {
          const dataInizio = lavoro.dataInizio?.toDate ? lavoro.dataInizio.toDate() : new Date(lavoro.dataInizio);
          const dataInizioSenzaOra = new Date(dataInizio);
          dataInizioSenzaOra.setHours(0, 0, 0, 0);
          
          if (dataInizioSenzaOra <= oggi) {
            lavoriOggi.push({
              id: doc.id,
              ...lavoro,
              dataInizio: dataInizio,
              tipoAssegnazione: 'autonomo' // Flag per distinguere
            });
          }
        }
      }
    });
    
    // 2. LAVORI DI SQUADRA (tramite caposquadra)
    let caposquadraId = null;
    const squadreRef = collection(db, `tenants/${tenantId}/squadre`);
    const squadreSnapshot = await getDocs(squadreRef);
    
    squadreSnapshot.forEach(doc => {
      const squadra = doc.data();
      if (squadra.operai && squadra.operai.includes(operaioId)) {
        caposquadraId = squadra.caposquadraId;
      }
    });
    
    if (caposquadraId) {
      lavoriSnapshot.forEach(doc => {
        const lavoro = doc.data();
        
        // Verifica che sia lavoro di squadra (caposquadraId presente, operaioId null)
        if (lavoro.caposquadraId === caposquadraId && !lavoro.operaioId) {
          const stato = lavoro.stato || 'assegnato';
          if (stato !== 'completato' && stato !== 'annullato' && stato !== 'completato_da_approvare') {
            const dataInizio = lavoro.dataInizio?.toDate ? lavoro.dataInizio.toDate() : new Date(lavoro.dataInizio);
            const dataInizioSenzaOra = new Date(dataInizio);
            dataInizioSenzaOra.setHours(0, 0, 0, 0);
            
            if (dataInizioSenzaOra <= oggi) {
              // Evita duplicati (se già presente come lavoro diretto)
              const giaPresente = lavoriOggi.some(l => l.id === doc.id);
              if (!giaPresente) {
                lavoriOggi.push({
                  id: doc.id,
                  ...lavoro,
                  dataInizio: dataInizio,
                  tipoAssegnazione: 'squadra' // Flag per distinguere
                });
              }
            }
          }
        }
      });
    }
    
    // Ordina per data (più recenti prima)
    lavoriOggi.sort((a, b) => {
      const dateA = a.dataInizio instanceof Date ? a.dataInizio : new Date(a.dataInizio);
      const dateB = b.dataInizio instanceof Date ? b.dataInizio : new Date(b.dataInizio);
      return dateB - dateA;
    });
    
    // Aggiorna statistiche e renderizza
    document.getElementById('stat-lavori-oggi-operaio').textContent = lavoriOggi.length;
    renderLavoriOggi(lavoriOggi);
    
  } catch (error) {
    console.error('Errore caricamento lavori oggi operaio:', error);
  }
}
```

### 2.5 Validazione Ore: Lavori Autonomi

**Modifiche** (`core/admin/validazione-ore-standalone.html`):

1. **Verificare tipo di lavoro**:
   ```javascript
   async function loadOreDaValidare() {
     const lavoriRef = collection(db, `tenants/${tenantId}/lavori`);
     const lavoriSnapshot = await getDocs(lavoriRef);
     
     const oreDaValidare = [];
     
     lavoriSnapshot.forEach(doc => {
       const lavoro = doc.data();
       
       // Carica ore per questo lavoro
       const oreRef = collection(db, `tenants/${tenantId}/lavori/${doc.id}/oreOperai`);
       // ... carica ore ...
       
       ore.forEach(ora => {
         if (ora.stato === 'da_validare') {
           // Verifica tipo lavoro
           if (lavoro.operaioId) {
             // Lavoro autonomo: solo Manager può validare
             if (user.ruoli.includes('manager') || user.ruoli.includes('amministratore')) {
               oreDaValidare.push({
                 ...ora,
                 lavoro: lavoro,
                 tipoLavoro: 'autonomo'
               });
             }
           } else if (lavoro.caposquadraId === currentUserId) {
             // Lavoro di squadra: caposquadra può validare
             oreDaValidare.push({
               ...ora,
               lavoro: lavoro,
               tipoLavoro: 'squadra'
             });
           }
         }
       });
     });
     
     return oreDaValidare;
   }
   ```

2. **UI differenziata**:
   - Mostrare badge "Lavoro Autonomo" vs "Lavoro di Squadra"
   - Per lavori autonomi: mostrare "Solo Manager può validare"

### 2.6 Tracciamento Zone: Lavori Autonomi

**Modifiche** (`core/admin/lavori-caposquadra-standalone.html` o nuova pagina):

1. **Verifica permessi tracciamento**:
   ```javascript
   function canTrackZone(lavoro, userId, userRoles) {
     // Manager sempre può tracciare
     if (userRoles.includes('manager') || userRoles.includes('amministratore')) {
       return true;
     }
     
     // Lavoro di squadra: solo caposquadra
     if (lavoro.caposquadraId === userId) {
       return true;
     }
     
     // Lavoro autonomo: solo operaio assegnato
     if (lavoro.operaioId === userId) {
       return true;
     }
     
     return false;
   }
   ```

2. **Permettere tracciamento zone agli operai per lavori autonomi**:
   - Creare pagina `core/admin/traccia-zone-operaio-standalone.html`
   - Mostrare solo lavori autonomi assegnati all'operaio corrente
   - Stessa logica tracciamento del caposquadra

### 2.7 Compatibilità con Sistema Esistente

**Lavori esistenti**:
- Hanno `caposquadraId` presente
- `operaioId` sarà null (default)
- Continuano a funzionare come prima
- Nessuna migrazione necessaria

**Query esistenti**:
- Filtri per `caposquadraId` continuano a funzionare
- Aggiungere filtri per `operaioId` dove necessario
- Query combinate per vedere entrambi i tipi

**Modifiche ai servizi** (`core/services/lavori-service.js`):

```javascript
// Aggiungere funzione per lavori assegnati direttamente a operaio
export async function getLavoriByOperaio(operaioId, options = {}) {
  try {
    if (!operaioId) {
      throw new Error('ID operaio obbligatorio');
    }
    
    return getAllLavori({
      ...options,
      operaioId
    });
  } catch (error) {
    console.error('Errore recupero lavori per operaio:', error);
    throw new Error(`Errore recupero lavori: ${error.message}`);
  }
}

// Modificare getAllLavori per supportare filtro operaioId
export async function getAllLavori(options = {}) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    let queryRef = collection(db, `tenants/${tenantId}/${COLLECTION_NAME}`);
    
    // Applica filtri
    if (options.caposquadraId) {
      queryRef = query(queryRef, where('caposquadraId', '==', options.caposquadraId));
    }
    
    // NUOVO: Filtro per operaioId
    if (options.operaioId) {
      queryRef = query(queryRef, where('operaioId', '==', options.operaioId));
    }
    
    // ... resto della funzione
  } catch (error) {
    // ...
  }
}
```

---

## 📝 Checklist Implementazione

### Fase 1: Modifiche Modello Lavoro ✅ COMPLETATO
- [x] Rendere `caposquadraId` opzionale nel modello Lavoro
- [x] Aggiungere campo `operaioId` opzionale
- [x] Modificare validazione: almeno uno dei due deve essere presente
- [x] Verificare che non possano essere entrambi presenti
- [x] Aggiungere campi `macchinaId`, `attrezzoId`, `operatoreMacchinaId` (opzionali)

### Fase 2: Form Creazione Lavoro ✅ COMPLETATO
- [x] Aggiungere radio button "Tipo Assegnazione"
- [x] Mostrare/nascondere dropdown appropriato
- [x] Aggiungere dropdown operai (se tipo autonomo)
- [ ] Aggiungere sezione macchine (se Parco Macchine attivo) - DA FARE quando modulo Parco Macchine sarà implementato
- [x] Validazione form: almeno uno dei due campi compilato
- [x] Salvataggio: salvare campi appropriati in base al tipo

### Fase 3: Dashboard Operaio ✅ COMPLETATO
- [x] Modificare query per includere lavori diretti (`operaioId == currentUserId`)
- [x] Mantenere query per lavori squadra (tramite caposquadra)
- [x] Combinare risultati senza duplicati
- [x] Aggiungere flag `tipoAssegnazione` per distinguere tipi
- [x] Mostrare badge visivo per tipo lavoro (autonomo/squadra)
- [x] Aggiungere checkbox per segnare lavori autonomi come completati

### Fase 4: Validazione Ore ✅ COMPLETATO
- [x] Verificare tipo lavoro nella validazione ore
- [x] Lavori autonomi: solo Manager può validare
- [x] Lavori squadra: caposquadra valida (come ora)
- [x] UI: mostrare badge tipo lavoro nella lista ore da validare
- [x] Aggiungere link "Validazione Ore" nella dashboard Manager

### Fase 5: Tracciamento Zone ✅ COMPLETATO
- [x] Modificare pagina lavori-caposquadra per permettere accesso anche agli operai
- [x] Permettere tracciamento zone agli operai per lavori autonomi
- [x] Salvataggio zone con `operaioId` invece di `caposquadraId` per operai
- [x] Mantenere logica esistente per caposquadra
- [x] Aggiungere link "Traccia Zone" nella dashboard operaio

### Fase 6: Parco Macchine (se implementato)
- [ ] Creare modello Macchina
- [ ] Creare servizio macchine
- [ ] Creare pagina gestione macchine
- [ ] Integrare con form creazione lavoro
- [ ] Aggiungere sezione macchine nella dashboard operaio
- [ ] Integrare con segnatura ore

### Fase 7: Testing ✅ COMPLETATO (Testato manualmente)
- [x] Test creazione lavoro di squadra (esistente) - ✅ Funziona
- [x] Test creazione lavoro autonomo (nuovo) - ✅ Funziona
- [x] Test dashboard operaio con lavori diretti - ✅ Funziona
- [x] Test dashboard operaio con lavori squadra - ✅ Funziona
- [x] Test validazione ore lavori autonomi - ✅ Funziona
- [x] Test validazione ore lavori squadra - ✅ Funziona
- [x] Test tracciamento zone lavori autonomi - ✅ Funziona
- [x] Test compatibilità lavori esistenti - ✅ Funziona (lavori esistenti continuano a funzionare)

---

## 🔄 Ordine di Implementazione Consigliato

1. **Prima**: Modifiche modello Lavoro (Fase 1)
2. **Seconda**: Form creazione lavoro (Fase 2)
3. **Terza**: Dashboard operaio (Fase 3)
4. **Quarta**: Validazione ore (Fase 4)
5. **Quinta**: Tracciamento zone (Fase 5)
6. **Sesta**: Parco Macchine (Fase 6) - se implementato
7. **Ultima**: Testing completo (Fase 7)

---

## 📚 File da Modificare/Creare

### File da Modificare:
- `core/models/Lavoro.js` - Aggiungere campi opzionali
- `core/services/lavori-service.js` - Supportare filtro operaioId
- `core/admin/gestione-lavori-standalone.html` - Form assegnazione flessibile
- `core/dashboard-standalone.html` - Query lavori diretti
- `core/admin/validazione-ore-standalone.html` - Validazione lavori autonomi
- `core/segnatura-ore-standalone.html` - Integrazione macchine (se Parco Macchine)

### File da Creare (se necessario):
- `core/admin/traccia-zone-operaio-standalone.html` - Tracciamento zone operai
- `modules/parco-macchine/models/Macchina.js` - Modello macchina
- `modules/parco-macchine/services/macchine-service.js` - Servizio macchine
- `modules/parco-macchine/views/gestione-macchine-standalone.html` - Gestione macchine

---

## ⚠️ Note Importanti

1. **Compatibilità**: I lavori esistenti continuano a funzionare (hanno `caposquadraId`, `operaioId` sarà null)

2. **Validazione**: Assicurarsi che almeno uno tra `caposquadraId` e `operaioId` sia presente

3. **Query**: Aggiungere indici Firestore se necessario per query su `operaioId`

4. **UI**: Rendere chiaro all'utente quale tipo di assegnazione sta usando

5. **Permessi**: Verificare permessi per ogni operazione (validazione, tracciamento, ecc.)

---

**Ultimo aggiornamento**: 2025-01-23

