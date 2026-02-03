# 🎯 Strategia Gestione Dashboard per Ruoli

**Data creazione**: 2025-01-13  
**Versione**: 1.0  
**Stato**: Documento strategico

---

## 📋 Panoramica

Questo documento descrive la strategia per gestire dashboard diverse per i vari ruoli utente nella GFV Platform.

### Approccio Attuale

**Dashboard Unica con Sezioni Dinamiche** ✅

- Una sola pagina dashboard (`dashboard-standalone.html`)
- Contenuto dinamico in base ai ruoli dell'utente
- Sezioni multiple se l'utente ha più ruoli
- Adattamento automatico in base ai moduli attivi

**Vantaggi**:
- ✅ Codice più semplice da mantenere
- ✅ Un solo punto di ingresso
- ✅ Facile da estendere con nuovi ruoli
- ✅ Gestione automatica ruoli multipli

---

## 👥 Ruoli Attuali

### 1. **Amministratore** 👑
**Permessi**:
- Gestire abbonamento (piano, moduli, pagamenti)
- Invitare/rimuovere utenti
- Assegnare/rimuovere ruoli
- Configurare azienda (nome, dati fiscali)
- Vedere tutto (report, statistiche, storico)

**Dashboard mostra**:
- Sezione Core Base (sempre visibile)
- Sezione Amministrazione (sempre visibile)
  - Statistiche: Utenti totali, Moduli attivi, Piano
  - Azioni: Gestisci Utenti, Abbonamento, Impostazioni, Report

### 2. **Manager** 📊
**Permessi**:
- Creare/modificare/eliminare clienti
- Creare/modificare/eliminare terreni
- Assegnare lavori a caposquadra
- Vedere tutti i lavori
- Vedere tutte le ore validate
- Generare report completi
- Vedere statistiche aziendali

**Dashboard mostra**:
- Sezione Core Base (sempre visibile)
- Sezione Gestione Operativa (solo con moduli avanzati)
  - Statistiche: Terreni, Attività, Ore questo mese (core) o Clienti, Terreni, Lavori attivi, Ore (avanzati)
  - Azioni: Terreni, Diario Attività, Statistiche, Clienti, Vendemmia, Lavori, Bilancio (se moduli avanzati)

### 3. **Caposquadra** 👷
**Permessi**:
- Vedere solo lavori assegnati a lui
- Vedere solo la sua squadra
- Vedere vigneti dei suoi lavori (sulla mappa)
- Validare/rifiutare ore degli operai
- Aggiornare avanzamento lavori
- Vedere ore già validate (solo per riferimento)

**Dashboard mostra**:
- Sezione Core Base (sempre visibile)
- Sezione Gestione Squadra (solo con moduli avanzati)
  - Statistiche: Lavori assegnati, Ore da validare, Squadra
  - Azioni: I Miei Lavori, Valida Ore, La Mia Squadra
  - Lavori Recenti

### 4. **Operaio** 🔧
**Permessi**:
- Vedere solo lavori assegnati a lui (oggi)
- Vedere solo vigneto del lavoro di oggi
- Segnare le proprie ore (inizio/fine, pause)
- Vedere stato validazione delle sue ore
- NON può vedere ore di altri operai
- NON può vedere lavori futuri/passati (solo oggi)

**Dashboard mostra**:
- Sezione Core Base (sempre visibile)
- Sezione I Miei Lavori (solo con moduli avanzati)
  - Statistiche: Lavori oggi, Ore segnate, Stato
  - Azioni: Lavori di Oggi, Segna Ore, Le Mie Ore
  - Lavori di Oggi

### 5. **Trattorista** 🚜 (NUOVO - Da implementare)
**Modulo**: `modules/personale/` (modulo avanzato)  
**Dashboard**: Sezione nella dashboard principale (come Manager, Caposquadra, Operaio)

**Permessi** (da definire):
- Vedere lavori assegnati a lui (oggi/futuri)
- Segnare ore di lavoro con trattore
- Registrare consumo carburante
- Registrare manutenzioni trattore
- Vedere storico lavori con trattore
- Vedere stato validazione delle sue ore
- NON può vedere lavori di altri trattoristi
- NON può vedere lavori passati (solo oggi/futuri)

**Dashboard mostra** (da implementare):
- Sezione Core Base (sempre visibile)
- Sezione I Miei Lavori Trattore (solo con modulo "personale" attivo)
  - Statistiche: Lavori oggi, Ore segnate, Carburante consumato, Stato trattore
  - Azioni: Lavori di Oggi, Segna Ore Trattore, Registra Carburante, Manutenzioni, Le Mie Ore
  - Lavori di Oggi (lista completa)

**Nota**: Come Manager, Caposquadra e Operaio, il trattorista vede la dashboard principale con la sua sezione dedicata.

---

## 🏗️ Architettura Dashboard

### Dashboard Unica con Sezioni Dinamiche

**Dashboard Principale** (`core/dashboard-standalone.html`)
- Per tutti i ruoli: Amministratore, Manager, Caposquadra, Operaio, Trattorista
- Approccio: Sezioni dinamiche nella stessa pagina
- Accesso: Tutti gli utenti (con contenuto filtrato per ruolo)
- Ogni ruolo vede: Core Base + la sua sezione specifica (se modulo avanzato attivo)

### Struttura Codice Attuale

```javascript
// core/dashboard-standalone.html

// Funzione principale che renderizza la dashboard
function renderDashboard(userData, availableModules) {
    // Mostra sempre Core Base
    container.appendChild(createCoreBaseSection(userData, isCoreOnly));
    
    // Mostra sezioni per ruolo (solo con moduli avanzati)
    if (hasRole(userData, 'manager')) {
        container.appendChild(createManagerSection(...));
    }
    if (hasRole(userData, 'caposquadra')) {
        container.appendChild(createCaposquadraSection(...));
    }
    if (hasRole(userData, 'operaio')) {
        container.appendChild(createOperaioSection(...));
    }
    // ← NUOVO: Aggiungere qui per trattorista
    if (hasRole(userData, 'trattorista')) {
        container.appendChild(createTrattoristaSection(...));
    }
}

// 2. Funzioni per creare sezioni per ruolo
function createManagerSection(userData, isCoreOnly, availableModules) {
    // Crea HTML per sezione Manager
}

function createCaposquadraSection(userData, isCoreOnly, availableModules) {
    // Crea HTML per sezione Caposquadra
}

function createOperaioSection(userData, isCoreOnly, availableModules) {
    // Crea HTML per sezione Operaio
}
```

### Pattern per Aggiungere Nuovo Ruolo

**Approccio Unico: Sezione nella Dashboard Principale**
- Esempio: Manager, Caposquadra, Operaio, Trattorista
- Aggiunge sezione nella dashboard principale
- Vede sempre Core Base + la sua sezione specifica (se modulo avanzato attivo)

---

### Pattern: Aggiungere Nuovo Ruolo

**Esempio: Aggiungere ruolo "Trattorista"**

#### 1. Aggiornare Validazione Ruoli

```javascript
// core/services/role-service.js
const validRoles = [
    'amministratore', 
    'manager', 
    'caposquadra', 
    'operaio',
    'trattorista'  // ← NUOVO
];
```

#### 2. Aggiornare Nomi Display

```javascript
// core/dashboard-standalone.html
const roleNames = {
    'amministratore': '👑 Amministratore',
    'manager': '📊 Manager',
    'caposquadra': '👷 Caposquadra',
    'operaio': '🔧 Operaio',
    'trattorista': '🚜 Trattorista'  // ← NUOVO
};
```

#### 3. Creare Funzione Sezione Dashboard

```javascript
// core/dashboard-standalone.html

// Sezione Trattorista
function createTrattoristaSection(userData, isCoreOnly, availableModules) {
    const section = document.createElement('div');
    section.className = 'dashboard-section';
    
    // Statistiche
    let statsHTML = `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value" id="stat-lavori-oggi-trattorista">-</div>
                <div class="stat-label">Lavori Oggi</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="stat-ore-trattorista">-</div>
                <div class="stat-label">Ore Segnate</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="stat-carburante-trattorista">-</div>
                <div class="stat-label">Carburante (L)</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="stat-stato-trattore">-</div>
                <div class="stat-label">Stato Trattore</div>
            </div>
        </div>
    `;
    
    // Azioni rapide
    let actionsHTML = '';
    if (isCoreOnly) {
        // Solo funzionalità core
        actionsHTML = `
            <a href="terreni-standalone.html" class="action-card">
                <span class="action-icon">🗺️</span>
                <span class="action-title">Terreni</span>
                <span class="action-description">Visualizza terreni</span>
            </a>
        `;
    } else {
        // Funzionalità avanzate
        actionsHTML = `
            <a href="modules/trattori/lavori-oggi.html" class="action-card">
                <span class="action-icon">🚜</span>
                <span class="action-title">Lavori di Oggi</span>
                <span class="action-description">Visualizza lavori assegnati oggi</span>
            </a>
            <a href="modules/trattori/segna-ore.html" class="action-card">
                <span class="action-icon">⏱️</span>
                <span class="action-title">Segna Ore Trattore</span>
                <span class="action-description">Registra inizio/fine lavoro</span>
            </a>
            <a href="modules/trattori/carburante.html" class="action-card">
                <span class="action-icon">⛽</span>
                <span class="action-title">Registra Carburante</span>
                <span class="action-description">Registra consumo carburante</span>
            </a>
            <a href="modules/trattori/manutenzioni.html" class="action-card">
                <span class="action-icon">🔧</span>
                <span class="action-title">Manutenzioni</span>
                <span class="action-description">Registra manutenzioni trattore</span>
            </a>
            <a href="modules/trattori/storico.html" class="action-card">
                <span class="action-icon">📊</span>
                <span class="action-title">Le Mie Ore</span>
                <span class="action-description">Visualizza storico ore</span>
            </a>
        `;
    }
    
    section.innerHTML = `
        <h2><span class="section-icon">🚜</span> I Miei Lavori Trattore</h2>
        ${statsHTML}
        <h3 style="margin: 20px 0 15px 0; font-size: 16px; color: #666;">Azioni Rapide</h3>
        <div class="quick-actions">
            ${actionsHTML}
        </div>
        <h3 style="margin: 20px 0 15px 0; font-size: 16px; color: #666;">Lavori di Oggi</h3>
        <ul class="recent-items" id="lavori-oggi-trattorista">
            <li class="recent-item">
                <div>
                    <div class="recent-item-title">Nessun lavoro assegnato per oggi</div>
                </div>
            </li>
        </ul>
    `;
    
    // Carica statistiche se moduli avanzati
    if (!isCoreOnly) {
        loadTrattoristaStats();
    }
    
    return section;
}

// Funzione per caricare statistiche trattorista
async function loadTrattoristaStats() {
    try {
        const user = auth.currentUser;
        if (!user) return;
        
        // Carica lavori di oggi per questo trattorista
        // ... implementazione ...
        
        // Aggiorna statistiche
        document.getElementById('stat-lavori-oggi-trattorista').textContent = lavoriOggi;
        document.getElementById('stat-ore-trattorista').textContent = oreFormatted;
        // ... altre statistiche ...
    } catch (error) {
        console.error('Errore caricamento statistiche trattorista:', error);
    }
}
```

#### 4. Aggiungere al Render Dashboard

```javascript
// core/dashboard-standalone.html

function renderDashboard(userData, availableModules = []) {
    const container = document.getElementById('dashboard-content');
    container.innerHTML = '';

    const ruoli = userData.ruoli || [];
    const isCoreOnly = hasOnlyCoreModules(availableModules);
    const hasAdvancedModules = !isCoreOnly;

    // CORE BASE: Sempre mostra funzionalità core essenziali
    container.appendChild(createCoreBaseSection(userData, isCoreOnly));

    // Ruoli avanzati: solo se ci sono moduli avanzati attivi
    if (hasAdvancedModules) {
        if (hasRole(userData, 'manager')) {
            container.appendChild(createManagerSection(userData, isCoreOnly, availableModules));
        }
        if (hasRole(userData, 'caposquadra')) {
            container.appendChild(createCaposquadraSection(userData, isCoreOnly, availableModules));
        }
        if (hasRole(userData, 'operaio')) {
            container.appendChild(createOperaioSection(userData, isCoreOnly, availableModules));
        }
        // ← NUOVO: Aggiungi qui per trattorista
        if (hasRole(userData, 'trattorista') && availableModules.includes('personale')) {
            container.appendChild(createTrattoristaSection(userData, isCoreOnly, availableModules));
        }
    }
}
```

#### 3. Creare Funzione Sezione Dashboard (come Manager/Operaio)

```javascript
// core/dashboard-standalone.html

// Sezione Trattorista
function createTrattoristaSection(userData, isCoreOnly, availableModules) {
    const section = document.createElement('div');
    section.className = 'dashboard-section';
    
    // Statistiche
    let statsHTML = `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value" id="stat-lavori-oggi-trattorista">-</div>
                <div class="stat-label">Lavori Oggi</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="stat-ore-trattorista">-</div>
                <div class="stat-label">Ore Segnate</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="stat-carburante-trattorista">-</div>
                <div class="stat-label">Carburante (L)</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="stat-stato-trattore">-</div>
                <div class="stat-label">Stato Trattore</div>
            </div>
        </div>
    `;
    
    // Azioni rapide
    let actionsHTML = `
        <a href="modules/personale/lavori-trattore.html" class="action-card">
            <span class="action-icon">🚜</span>
            <span class="action-title">Lavori di Oggi</span>
            <span class="action-description">Visualizza lavori assegnati oggi</span>
        </a>
        <a href="modules/personale/segna-ore-trattore.html" class="action-card">
            <span class="action-icon">⏱️</span>
            <span class="action-title">Segna Ore Trattore</span>
            <span class="action-description">Registra inizio/fine lavoro</span>
        </a>
        <a href="modules/personale/carburante.html" class="action-card">
            <span class="action-icon">⛽</span>
            <span class="action-title">Registra Carburante</span>
            <span class="action-description">Registra consumo carburante</span>
        </a>
        <a href="modules/personale/manutenzioni.html" class="action-card">
            <span class="action-icon">🔧</span>
            <span class="action-title">Manutenzioni</span>
            <span class="action-description">Registra manutenzioni trattore</span>
        </a>
        <a href="modules/personale/storico.html" class="action-card">
            <span class="action-icon">📊</span>
            <span class="action-title">Le Mie Ore</span>
            <span class="action-description">Visualizza storico ore</span>
        </a>
    `;
    
    section.innerHTML = `
        <h2><span class="section-icon">🚜</span> I Miei Lavori Trattore</h2>
        ${statsHTML}
        <h3 style="margin: 20px 0 15px 0; font-size: 16px; color: #666;">Azioni Rapide</h3>
        <div class="quick-actions">
            ${actionsHTML}
        </div>
        <h3 style="margin: 20px 0 15px 0; font-size: 16px; color: #666;">Lavori di Oggi</h3>
        <ul class="recent-items" id="lavori-oggi-trattorista">
            <li class="recent-item">
                <div>
                    <div class="recent-item-title">Nessun lavoro assegnato per oggi</div>
                </div>
            </li>
        </ul>
    `;
    
    // Carica statistiche se modulo personale attivo
    if (availableModules.includes('personale')) {
        loadTrattoristaStats();
    }
    
    return section;
}

// Funzione per caricare statistiche trattorista
async function loadTrattoristaStats() {
    try {
        const user = auth.currentUser;
        if (!user) return;
        
        // Carica lavori di oggi per questo trattorista
        // ... implementazione ...
        
        // Aggiorna statistiche
        document.getElementById('stat-lavori-oggi-trattorista').textContent = lavoriOggi;
        document.getElementById('stat-ore-trattorista').textContent = oreFormatted;
        // ... altre statistiche ...
    } catch (error) {
        console.error('Errore caricamento statistiche trattorista:', error);
    }
}
```

#### 4. Aggiornare Permission Service

```javascript
// core/services/permission-service.js

// Aggiungere funzioni per controllare permessi trattorista
export function canViewTrattoreLavori(user) {
    return hasAnyRole(user, ['amministratore', 'manager', 'trattorista']);
}

export function canEditTrattoreLavori(user) {
    return hasAnyRole(user, ['amministratore', 'manager', 'trattorista']);
}
```

---

## 📐 Regole di Design Dashboard

### 1. **Core Base Sempre Visibile**
- Tutti i ruoli vedono sempre la sezione Core Base
- Include: Terreni, Diario Attività, Statistiche, Abbonamento

### 2. **Sezioni Ruolo Solo con Moduli Avanzati**
- Le sezioni specifiche per ruolo (Manager, Caposquadra, Operaio, Trattorista) sono visibili solo se:
  - L'utente ha il ruolo corrispondente
  - Ci sono moduli avanzati attivi (non solo core)

### 3. **Ruoli Multipli**
- Se un utente ha più ruoli, vede tutte le sezioni corrispondenti
- Esempio: `["manager", "trattorista"]` → vede sezione Manager + sezione Trattorista

### 4. **Statistiche Dinamiche**
- Le statistiche si caricano solo se i moduli avanzati sono attivi
- In modalità core-only, mostra solo statistiche core

### 5. **Azioni Rapide**
- Core-only: solo link a funzionalità core
- Con moduli avanzati: link a funzionalità avanzate + core

---

## 🔄 Flusso Rendering Dashboard

```
1. Utente accede a dashboard-standalone.html
   ↓
2. Verifica autenticazione
   ↓
3. Carica dati utente (ruoli, tenant, moduli)
   ↓
4. Normalizza ruoli (gestisce varianti)
   ↓
5. Carica moduli disponibili dal tenant
   ↓
6. Chiama renderDashboard(userData, availableModules)
   ↓
7. Renderizza Core Base (sempre)
   ↓
8. Per ogni ruolo dell'utente:
   - Se ha moduli avanzati → renderizza sezione ruolo
   - Se solo core → non renderizza sezione ruolo avanzata
   ↓
9. Carica statistiche dinamiche (se necessario)
   ↓
10. Dashboard completa
```

---

## 📝 Checklist per Aggiungere Nuovo Ruolo

**Pattern Unico: Sezione nella Dashboard Principale**

- [ ] **1. Aggiornare validazione ruoli** (`role-service.js`)
  - Aggiungere ruolo a `validRoles` array (riga 29 e 148)

- [ ] **2. Aggiornare nomi display** (`dashboard-standalone.html`)
  - Aggiungere entry in `roleNames` object (riga ~432)

- [ ] **3. Creare funzione sezione dashboard** (`dashboard-standalone.html`)
  - Funzione `create{NomeRuolo}Section(userData, isCoreOnly, availableModules)`
  - Include statistiche, azioni rapide, contenuto specifico
  - Seguire pattern di `createManagerSection` o `createOperaioSection`

- [ ] **4. Aggiungere al render dashboard** (`dashboard-standalone.html`)
  - Aggiungere `if (hasRole(userData, 'nuovo-ruolo'))` nel render
  - Verificare anche modulo attivo se necessario (es. `availableModules.includes('personale')`)

- [ ] **5. Creare funzione caricamento statistiche** (se necessario)
  - Funzione `load{NomeRuolo}Stats()` per caricare dati dinamici

- [ ] **6. Aggiornare permission service** (`permission-service.js`)
  - Aggiungere funzioni per controllare permessi del nuovo ruolo

- [ ] **7. Creare pagine specifiche** (se necessario)
  - Creare pagine HTML per funzionalità specifiche del ruolo
  - Esempio: `modules/personale/lavori-trattore.html`

- [ ] **8. Aggiornare documentazione**
  - Aggiornare questo documento
  - Aggiornare `STATO_PROGETTO_COMPLETO.md`

- [ ] **9. Test**
  - Testare dashboard con nuovo ruolo
  - Testare ruoli multipli (es. manager + trattorista)
  - Testare con/senza moduli avanzati

---

## 🎨 Esempi Dashboard per Ruolo

### Dashboard Operaio (Core Only)
```
┌─────────────────────────────────────┐
│ 🌾 Core Base                        │
│ ┌─────┐ ┌─────┐ ┌─────┐            │
│ │ 🗺️  │ │ 📝  │ │ 📊  │            │
│ │Terreni│ │Diario│ │Stat.│            │
│ └─────┘ └─────┘ └─────┘            │
└─────────────────────────────────────┘
```

### Dashboard Manager (Con Moduli Avanzati)
```
┌─────────────────────────────────────┐
│ 🌾 Core Base                        │
│ [Terreni] [Diario] [Statistiche]   │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│ 📊 Gestione Operativa              │
│ Statistiche: [Clienti] [Terreni]   │
│ Azioni: [Clienti] [Vendemmia] ...  │
└─────────────────────────────────────┘
```

### Dashboard Trattorista (Con Modulo Personale)
```
┌─────────────────────────────────────┐
│ 🌾 Core Base                        │
│ [Terreni] [Diario] [Statistiche]   │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│ 🚜 I Miei Lavori Trattore          │
│ Statistiche: [Lavori] [Ore] [Carb.]│
│ Azioni: [Lavori Oggi] [Segna Ore]  │
│        [Carburante] [Manutenzioni]  │
│ Lavori di Oggi: [Lista]             │
└─────────────────────────────────────┘
```

### Dashboard Multi-Ruolo (Manager + Trattorista)
```
┌─────────────────────────────────────┐
│ 🌾 Core Base                        │
│ [Terreni] [Diario] [Statistiche]   │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│ 📊 Gestione Operativa              │
│ [Sezione Manager]                  │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│ 🚜 I Miei Lavori Trattore          │
│ [Sezione Trattorista]              │
└─────────────────────────────────────┘
```

---

## 🚀 Prossimi Passi

### Implementazione Trattorista (Modulo Personale)

1. **Definire permessi trattorista** ✅ (questa sessione)
   - Cosa può vedere/fare un trattorista
   - Differenze con operaio
   - Funzionalità specifiche (carburante, manutenzioni, etc.)

2. **Implementare sezione trattorista nella dashboard principale**
   - Seguire pattern di Manager/Operaio
   - Creare funzione `createTrattoristaSection()` in `dashboard-standalone.html`
   - Aggiungere al render dashboard (con controllo modulo "personale")

3. **Aggiornare validazione ruoli**
   - Aggiungere "trattorista" a `validRoles` in `role-service.js`
   - Aggiungere nome display in `roleNames` in `dashboard-standalone.html`

4. **Creare servizi e pagine funzionalità** (se necessario)
   - Servizio trattorista (`modules/personale/services/trattorista-service.js`)
   - Pagine: lavori, segna ore, carburante, manutenzioni

5. **Test e validazione**
   - Test dashboard con ruolo trattorista
   - Test con/senza modulo personale attivo
   - Test con ruoli multipli (es. manager + trattorista)

---

## 📚 Riferimenti

- **Dashboard attuale**: `core/dashboard-standalone.html`
- **Ruoli definiti**: `core/services/role-service.js`
- **Permessi**: `core/services/permission-service.js`
- **Modello User**: `core/models/User.js`
- **Stato progetto**: `STATO_PROGETTO_COMPLETO.md`

---

**Ultimo aggiornamento**: 2025-01-13  
**Prossimo aggiornamento**: Dopo implementazione ruolo Trattorista

