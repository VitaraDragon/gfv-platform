# 📋 Piano Sviluppo Pagina Abbonamento - GFV Platform

**Data**: 2026-01-24  
**Obiettivo**: Definire piano completo sviluppo pagina abbonamento con strategia freemium modulare  
**Stato Attuale**: Pagina parzialmente implementata con problemi critici  
**Strategia**: Freemium (30 attività, 5 terreni) + Moduli pay-per-use (€5-10/mese)

---

## 🎯 Obiettivi Finali

### **Cosa Vogliamo Ottenere**
1. ✅ Pagina funzionante con dati reali da Firestore
2. ✅ Supporto multi-tenant membership corretto
3. ✅ Cambio piano implementato e funzionante
4. ✅ Sistema moduli pay-per-use (€5-10/mese)
5. ✅ Validazione limiti piano (moduli, utenti)
6. ✅ Gestione scadenza abbonamento
7. ✅ Bundle interconnessioni (opzionale, fase successiva)
8. ✅ Preparazione moduli futuri (Frutteto, Oliveto)

---

## 📊 Situazione Attuale

### **Cosa Funziona** ✅
- UI moderna e responsive
- Gestione moduli base (attivazione/disattivazione)
- Feedback utente con alert
- Controllo permessi (solo amministratore)

### **Cosa NON Funziona** ❌
- Dati hardcoded (prezzo, scadenza, stato)
- Non supporta multi-tenant membership
- Cambio piano non implementato (solo placeholder)
- Inconsistenza campo `piano` vs `plan`
- Manca validazione limiti piano
- Manca gestione scadenza

---

## 🗺️ Architettura Proposta

### **File da Creare/Modificare**

#### **Nuovi File**
1. `core/config/subscription-plans.js` - Configurazione centralizzata piani
2. `core/services/subscription-service.js` - Logica business abbonamenti (opzionale)

#### **File da Modificare**
1. `core/admin/abbonamento-standalone.html` - Pagina principale
2. `core/services/tenant-service.js` - Aggiungere funzioni helper se necessario

---

## 📐 Struttura Dati Firestore

### **Struttura Attuale (Da Verificare)**
```javascript
tenants/{tenantId} {
  name: string,
  plan: string,           // 'free' | 'starter' | 'professional' | 'enterprise'
  modules: string[],      // ['manodopera', 'parcoMacchine', ...]
  status: string,         // 'active' | 'suspended' | 'expired'
  // ... altri campi
}
```

### **Struttura Proposta (Da Aggiungere)**
```javascript
tenants/{tenantId} {
  // Esistenti
  name: string,
  plan: string,           // 'free' | 'starter' | 'professional' | 'enterprise'
  modules: string[],
  status: string,
  
  // Da aggiungere
  price: number,          // Prezzo mensile totale (piano + moduli)
  expiryDate: Timestamp,  // Data scadenza abbonamento
  startDate: Timestamp,   // Data inizio abbonamento
  lastPaymentDate: Timestamp, // Ultimo pagamento
  
  // Limiti (calcolati o salvati)
  maxModules: number,     // Limite moduli per piano
  maxUsers: number,       // Limite utenti per piano
  
  // Metadata
  createdBy: string,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

**Domanda**: Aggiungiamo questi campi subito o li calcoliamo dinamicamente?

---

## 🎨 Configurazione Piani (Da Definire)

### **Piano Free** 🆓
```javascript
{
  id: 'free',
  name: 'Free',
  price: 0,
  maxTerreni: 5,
  maxAttivitaMese: 30,
  maxUsers: 1,
  maxModules: 0,  // Solo core base
  includedModules: [],  // Nessun modulo incluso
  features: [
    'Terreni (max 5)',
    'Attività (max 30/mese)',
    'Statistiche base',
    '1 utente'
  ]
}
```

### **Piano Starter** 💚
```javascript
{
  id: 'starter',
  name: 'Starter',
  price: 9,
  maxTerreni: null,  // Illimitati
  maxAttivitaMese: null,  // Illimitate
  maxUsers: 5,
  maxModules: 1,  // 1 modulo incluso
  includedModules: [],  // Utente sceglie quale
  features: [
    'Terreni illimitati',
    'Attività illimitate',
    'Fino a 5 utenti',
    '1 modulo incluso',
    'Supporto email (48h)',
    'Storage base (500MB)',
    'Export Excel'
  ]
}
```

### **Piano Professional** 💼
```javascript
{
  id: 'professional',
  name: 'Professional',
  price: 29,
  maxTerreni: null,
  maxAttivitaMese: null,
  maxUsers: 20,
  maxModules: 3,  // 3 moduli inclusi
  includedModules: [],  // Utente sceglie quali
  features: [
    'Terreni illimitati',
    'Attività illimitate',
    'Fino a 20 utenti',
    '3 moduli inclusi',
    'Supporto prioritario (24h)',
    'Storage esteso (5GB)',
    'Report avanzati'
  ]
}
```

### **Piano Enterprise** 🏢
```javascript
{
  id: 'enterprise',
  name: 'Enterprise',
  price: 49,
  maxTerreni: null,
  maxAttivitaMese: null,
  maxUsers: null,  // Illimitati
  maxModules: null,  // Tutti i moduli
  includedModules: ['all'],  // Tutti i moduli
  features: [
    'Terreni illimitati',
    'Attività illimitate',
    'Utenti illimitati',
    'Tutti i moduli inclusi',
    'Supporto dedicato',
    'Storage illimitato',
    'API personalizzate',
    'Onboarding assistito'
  ]
}
```

**Domanda**: I moduli inclusi sono a scelta dell'utente o predefiniti?

---

## 🧩 Configurazione Moduli (Da Definire)

### **Moduli Disponibili**
```javascript
const modules = [
  {
    id: 'manodopera',
    name: 'Manodopera',
    icon: '👷',
    description: 'Gestione squadre, operai e lavori',
    price: 7,  // Media tra €6-8
    available: true,  // Già implementato
    category: 'operativo'
  },
  {
    id: 'parcoMacchine',
    name: 'Parco Macchine',
    icon: '🚜',
    description: 'Gestione macchine, manutenzioni e scadenze',
    price: 6,  // Media tra €5-7
    available: true,
    category: 'operativo'
  },
  {
    id: 'contoTerzi',
    name: 'Conto Terzi',
    icon: '🤝',
    description: 'Gestione clienti e lavori esterni',
    price: 9,  // Media tra €8-10
    available: true,
    category: 'business'
  },
  {
    id: 'vigneto',
    name: 'Vigneto',
    icon: '🍇',
    description: 'Gestione vigneti e vendemmia',
    price: 7,  // Media tra €6-8
    available: true,
    category: 'colture'
  },
  {
    id: 'frutteto',
    name: 'Frutteto',
    icon: '🍎',
    description: 'Gestione frutteti e raccolta',
    price: 7,
    available: false,  // Da sviluppare
    category: 'colture',
    badge: 'Prossimamente'
  },
  {
    id: 'oliveto',
    name: 'Oliveto',
    icon: '🫒',
    description: 'Gestione oliveti e raccolta',
    price: 7,
    available: false,  // Da sviluppare
    category: 'colture',
    badge: 'Prossimamente'
  },
  {
    id: 'report',
    name: 'Report/Bilancio',
    icon: '📑',
    description: 'Report unificati e export avanzato',
    price: 5,
    available: false,  // Da sviluppare
    category: 'utility',
    badge: 'Prossimamente'
  }
];
```

**Domande**:
1. Prezzi moduli: usiamo range (€6-8) o prezzo fisso (€7)?
2. Moduli futuri: mostriamo con badge "Prossimamente" o li nascondiamo?
3. Categorie: le usiamo per raggruppare nella UI?

---

## 🎁 Bundle Interconnessioni (Opzionale - Fase Successiva)

### **Bundle Proposti**
```javascript
const bundles = [
  {
    id: 'gestione-completa',
    name: 'Gestione Completa',
    modules: ['manodopera', 'parcoMacchine', 'report'],
    price: 15,  // Sconto 17% (€18 → €15)
    discount: 17
  },
  {
    id: 'colture-specializzate',
    name: 'Colture Specializzate',
    modules: ['vigneto', 'frutteto', 'oliveto'],
    price: 18,  // Sconto 14% (€21 → €18)
    discount: 14
  },
  {
    id: 'business-esterno',
    name: 'Business Esterno',
    modules: ['contoTerzi', 'report'],
    price: 12,  // Sconto 14% (€14 → €12)
    discount: 14
  }
];
```

**Domanda**: Implementiamo bundle subito o in fase successiva?

---

## 📋 Fasi di Sviluppo Proposte

### **FASE 1: Fix Critici e Base** 🔴 (Priorità Alta)

#### **1.1 Configurazione Centralizzata** (1-2 ore)
- **Cosa**: Creare `core/config/subscription-plans.js`
- **Contenuto**: Piani, moduli, prezzi, limiti
- **Perché**: Facilita manutenzione, evita hardcoding
- **Output**: File config esportabile

**Decisioni da prendere**:
- ✅ Prezzi moduli: range o fisso?
- ✅ Moduli futuri: mostrare o nascondere?
- ✅ Struttura config: oggetto semplice o classe?

---

#### **1.2 Fix Multi-Tenant Membership** (1-2 ore)
- **Cosa**: Usare `tenant-service.js` invece di `tenantId` deprecato
- **File**: `core/admin/abbonamento-standalone.html`
- **Modifiche**:
  - Import `getCurrentTenantId()`, `getCurrentTenant()`, `getUserRolesForTenant()`
  - Sostituire `currentUserData.tenantId` con `getCurrentTenantId()`
  - Sostituire controllo ruoli con `getUserRolesForTenant()`

**Decisioni da prendere**:
- ✅ Gestire utenti senza `tenantMemberships` (retrocompatibilità)?
- ✅ Cosa fare se utente ha più tenant (selezione tenant)?

---

#### **1.3 Caricare Dati Reali da Firestore** (2-3 ore)
- **Cosa**: Sostituire dati hardcoded con dati reali
- **File**: `core/admin/abbonamento-standalone.html`
- **Modifiche**:
  - Caricare `plan`, `price`, `expiryDate`, `status` da Firestore
  - Aggiornare UI con dati reali
  - Gestire casi: dati mancanti, valori default

**Decisioni da prendere**:
- ✅ Cosa fare se `plan` non esiste (default: 'free')?
- ✅ Come calcolare `price` totale (piano + moduli)?
- ✅ Formato `expiryDate`: Timestamp o stringa?

---

#### **1.4 Fix Inconsistenza Campo `piano` vs `plan`** (30 min)
- **Cosa**: Standardizzare su `plan` (inglese)
- **File**: `core/admin/abbonamento-standalone.html`
- **Modifiche**:
  - Sostituire `tenantData.piano` con `tenantData.plan`
  - Supportare retrocompatibilità (controllare entrambi)

**Decisioni da prendere**:
- ✅ Supportare retrocompatibilità o migrare tutti i dati?

---

#### **1.5 Evidenziare Dinamicamente Piano Corrente** (1 ora)
- **Cosa**: Evidenziare piano corrente in base a dati reali
- **File**: `core/admin/abbonamento-standalone.html`
- **Modifiche**:
  - Rimuovere classe `active` hardcoded
  - Aggiungere classe `active` dinamicamente
  - Mostrare "Piano Attuale" solo sul piano corrente
  - Disabilitare click sul piano corrente

**Decisioni da prendere**:
- ✅ Stile piano corrente: mantenere gradient verde o altro?

---

### **FASE 2: Cambio Piano e Validazioni** 🟡 (Priorità Media)

#### **2.1 Implementare Cambio Piano** (4-6 ore)
- **Cosa**: Logica completa cambio piano
- **File**: `core/admin/abbonamento-standalone.html` + eventuale servizio
- **Funzionalità**:
  - Validazione permessi
  - Verifica limiti nuovo piano
  - Gestione downgrade/upgrade
  - Calcolo differenza prezzo
  - Conferma utente
  - Aggiornamento Firestore

**Decisioni da prendere**:
- ✅ Cosa fare se downgrade e moduli/utenti superano limite?
  - Opzione A: Bloccare cambio piano
  - Opzione B: Disattivare moduli/utenti automaticamente
  - Opzione C: Avvisare e chiedere conferma
- ✅ Aggiornare `expiryDate` quando si cambia piano?
- ✅ Gestire rimborsi/crediti per cambio piano a metà mese?
- ✅ Mostrare differenza prezzo prima di confermare?

---

#### **2.2 Validazione Limiti Piano** (3-4 ore)
- **Cosa**: Verificare numero moduli/utenti vs limite piano
- **File**: `core/admin/abbonamento-standalone.html` + servizio
- **Funzionalità**:
  - Contare moduli attivi
  - Contare utenti attivi
  - Verificare vs limite piano
  - Bloccare attivazione se supera limite
  - Mostrare messaggio chiaro
  - Suggerire upgrade piano

**Decisioni da prendere**:
- ✅ Cosa fare se utente ha già superato limite (retroattivo)?
  - Opzione A: Bloccare funzionalità
  - Opzione B: Avvisare ma permettere uso
  - Opzione C: Disattivare automaticamente
- ✅ Validare anche numero terreni/attività per piano Free?

---

#### **2.3 Gestione Scadenza Abbonamento** (2-3 ore)
- **Cosa**: Aggiungere campo `expiryDate` e controlli
- **File**: `core/admin/abbonamento-standalone.html` + migrazione dati
- **Funzionalità**:
  - Aggiungere campo `expiryDate` in Firestore
  - Calcolare scadenza (es. +1 mese da attivazione)
  - Mostrare alert se scaduto o in scadenza
  - Bloccare funzionalità se scaduto (opzionale)

**Decisioni da prendere**:
- ✅ Periodo di grazia dopo scadenza (es. 7 giorni)?
- ✅ Bloccare funzionalità se scaduto o solo avvisare?
- ✅ Come gestire rinnovo automatico (se implementato)?
- ✅ Migrare dati esistenti: come calcolare `expiryDate`?

---

### **FASE 3: Sistema Moduli Pay-Per-Use** 🟡 (Priorità Media)

#### **3.1 Ristrutturare UI Moduli** (2-3 ore)
- **Cosa**: Mostrare moduli con prezzi, disponibilità, badge
- **File**: `core/admin/abbonamento-standalone.html`
- **Modifiche**:
  - Mostrare prezzo per modulo
  - Badge "Prossimamente" per moduli futuri
  - Disabilitare toggle per moduli non disponibili
  - Mostrare totale mensile (piano + moduli)

**Decisioni da prendere**:
- ✅ Layout moduli: grid o lista?
- ✅ Mostrare prezzo totale mensile in evidenza?
- ✅ Raggruppare moduli per categoria?

---

#### **3.2 Validazione Attivazione Moduli** (2-3 ore)
- **Cosa**: Verificare limiti moduli per piano
- **File**: `core/admin/abbonamento-standalone.html`
- **Funzionalità**:
  - Contare moduli attivi
  - Verificare vs `maxModules` piano
  - Bloccare attivazione se supera limite
  - Mostrare messaggio con suggerimento upgrade

**Decisioni da prendere**:
- ✅ Moduli inclusi nel piano contano nel limite?
  - Esempio: Professional ha 3 moduli inclusi, può aggiungerne altri?
- ✅ Come gestire moduli già attivi quando si downgrade piano?

---

#### **3.3 Calcolo Prezzo Totale** (1-2 ore)
- **Cosa**: Calcolare prezzo totale (piano + moduli)
- **File**: `core/admin/abbonamento-standalone.html`
- **Funzionalità**:
  - Prezzo piano base
  - + Prezzo moduli aggiuntivi (oltre inclusi)
  - = Prezzo totale mensile
  - Mostrare breakdown prezzo

**Decisioni da prendere**:
- ✅ Mostrare breakdown prezzo (piano + moduli) o solo totale?
- ✅ Come gestire moduli inclusi nel piano (non contano nel prezzo)?

---

### **FASE 4: Bundle e Moduli Futuri** 🟢 (Priorità Bassa - Opzionale)

#### **4.1 Sistema Bundle** (3-4 ore)
- **Cosa**: Implementare bundle interconnessioni
- **File**: `core/admin/abbonamento-standalone.html`
- **Funzionalità**:
  - Mostrare bundle disponibili
  - Calcolo prezzo bundle vs singoli
  - Attivazione bundle (attiva tutti i moduli)
  - Validazione bundle (tutti moduli attivi)

**Decisioni da prendere**:
- ✅ Implementare subito o in fase successiva?
- ✅ Bundle sostituiscono moduli singoli o si aggiungono?

---

#### **4.2 Preparazione Moduli Futuri** (2-3 ore)
- **Cosa**: Struttura per Frutteto, Oliveto, Report
- **File**: `core/admin/abbonamento-standalone.html`
- **Modifiche**:
  - Aggiungere moduli futuri in config
  - Badge "Prossimamente"
  - Disabilitare toggle
  - Mostrare preview/descrizione

**Decisioni da prendere**:
- ✅ Mostrare moduli futuri o nasconderli?
- ✅ Mostrare roadmap pubblica?

---

### **FASE 5: Miglioramenti UX** 🟢 (Priorità Bassa)

#### **5.1 Feedback Loading Stati** (1-2 ore)
- **Cosa**: Spinner e stati loading
- **File**: `core/admin/abbonamento-standalone.html`
- **Modifiche**:
  - Spinner durante caricamento
  - Stati: loading, success, error
  - Feedback visivo chiaro

**Decisioni da prendere**:
- ✅ Stile spinner: semplice o animato?

---

#### **5.2 Disabilitare Moduli Oltre Limite** (1 ora)
- **Cosa**: Disabilitare toggle se supera limite
- **File**: `core/admin/abbonamento-standalone.html`
- **Modifiche**:
  - Calcolare moduli disponibili
  - Disabilitare toggle moduli oltre limite
  - Mostrare tooltip con motivo

**Decisioni da prendere**:
- ✅ Mostrare tooltip o messaggio inline?

---

## 🎯 Priorità e Sequenza

### **Sequenza Consigliata**

#### **Sprint 1: Base Funzionante** (1 settimana)
1. ✅ Configurazione centralizzata (1.1)
2. ✅ Fix multi-tenant (1.2)
3. ✅ Caricare dati reali (1.3)
4. ✅ Fix inconsistenza campo (1.4)
5. ✅ Evidenziare piano corrente (1.5)

**Risultato**: Pagina funzionante con dati reali

---

#### **Sprint 2: Cambio Piano** (1 settimana)
1. ✅ Implementare cambio piano (2.1)
2. ✅ Validazione limiti (2.2)
3. ✅ Gestione scadenza (2.3)

**Risultato**: Cambio piano funzionante

---

#### **Sprint 3: Moduli Pay-Per-Use** (1 settimana)
1. ✅ Ristrutturare UI moduli (3.1)
2. ✅ Validazione attivazione (3.2)
3. ✅ Calcolo prezzo totale (3.3)

**Risultato**: Sistema moduli completo

---

#### **Sprint 4: Bundle e Futuro** (Opzionale)
1. ⚠️ Sistema bundle (4.1) - Se implementiamo
2. ✅ Preparazione moduli futuri (4.2)
3. ✅ Miglioramenti UX (5.1, 5.2)

**Risultato**: Funzionalità avanzate

---

## ❓ Decisioni da Prendere Insieme

### **1. Configurazione e Prezzi**
- [ ] Prezzi moduli: range (€6-8) o fisso (€7)?
- [ ] Moduli futuri: mostrare con badge o nascondere?
- [ ] Categorie moduli: usare per raggruppare UI?

### **2. Multi-Tenant**
- [ ] Gestire retrocompatibilità utenti senza `tenantMemberships`?
- [ ] Cosa fare se utente ha più tenant (selezione)?

### **3. Cambio Piano**
- [ ] Cosa fare se downgrade e moduli/utenti superano limite?
- [ ] Aggiornare `expiryDate` quando si cambia piano?
- [ ] Gestire rimborsi/crediti per cambio a metà mese?

### **4. Validazioni**
- [ ] Cosa fare se utente ha già superato limite (retroattivo)?
- [ ] Moduli inclusi nel piano contano nel limite?
- [ ] Validare anche terreni/attività per piano Free?

### **5. Scadenza**
- [ ] Periodo di grazia dopo scadenza (es. 7 giorni)?
- [ ] Bloccare funzionalità se scaduto o solo avvisare?
- [ ] Come calcolare `expiryDate` per dati esistenti?

### **6. UI Moduli**
- [ ] Layout moduli: grid o lista?
- [ ] Mostrare prezzo totale mensile in evidenza?
- [ ] Mostrare breakdown prezzo o solo totale?

### **7. Bundle**
- [ ] Implementare bundle subito o in fase successiva?
- [ ] Bundle sostituiscono moduli singoli o si aggiungono?

### **8. Moduli Futuri**
- [ ] Mostrare moduli futuri o nasconderli?
- [ ] Mostrare roadmap pubblica?

---

## 📊 Stima Tempi Totali

### **Fase 1: Fix Critici** (6-9 ore)
- Configurazione: 1-2h
- Multi-tenant: 1-2h
- Dati reali: 2-3h
- Fix campo: 30min
- UI piano: 1h

### **Fase 2: Cambio Piano** (9-13 ore)
- Cambio piano: 4-6h
- Validazioni: 3-4h
- Scadenza: 2-3h

### **Fase 3: Moduli** (5-8 ore)
- UI moduli: 2-3h
- Validazioni: 2-3h
- Prezzo: 1-2h

### **Fase 4: Bundle** (5-7 ore) - Opzionale
- Bundle: 3-4h
- Moduli futuri: 2-3h

### **Fase 5: UX** (2-3 ore) - Opzionale
- Loading: 1-2h
- Disabilitare: 1h

**Totale**: 20-30 ore (senza bundle/UX) | 27-40 ore (completo)

---

## 🎯 Prossimi Passi

1. **Discutere decisioni** insieme (questo documento)
2. **Definire priorità** e sequenza
3. **Iniziare Sprint 1** (Fix critici)
4. **Testare** dopo ogni fase
5. **Iterare** in base a feedback

---

**Pronto per discutere!** Quali decisioni vuoi prendere per prime?
