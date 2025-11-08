# 🏗️ Core - GFV Platform

Il core contiene tutti i servizi e modelli base dell'applicazione, sempre inclusi in ogni piano.

## 📁 Struttura

```
core/
├── auth/              # (Futuro) Componenti autenticazione UI
├── tenant/            # (Futuro) Componenti gestione tenant UI
├── subscription/      # (Futuro) Componenti gestione abbonamenti UI
├── models/            # Modelli dati
│   ├── Base.js        # Classe base per tutti i modelli
│   └── User.js         # Modello utente
├── services/          # Servizi core
│   ├── firebase-service.js    # Servizio base Firebase
│   ├── tenant-service.js      # Gestione multi-tenant
│   ├── auth-service.js        # Autenticazione
│   ├── permission-service.js   # Controllo permessi
│   └── role-service.js        # Gestione ruoli
└── init.js            # Inizializzazione core
```

## 🚀 Inizializzazione

### Setup Base

```javascript
import { initializeCore } from './core/init.js';
import { firebaseConfig } from './core/firebase-config.js';

// Inizializza core all'avvio dell'app
await initializeCore(firebaseConfig);
```

**⚠️ IMPORTANTE:** Prima di usare, configura il nuovo progetto Firebase seguendo le istruzioni in `SETUP_FIREBASE.md`

## 📚 Servizi Disponibili

### Firebase Service

Servizio base per tutte le operazioni Firebase con supporto multi-tenant.

```javascript
import { 
  createDocument, 
  getDocumentData, 
  updateDocument,
  deleteDocument,
  getCollectionData 
} from './core/services/firebase-service.js';

// Crea documento (con tenant automatico se disponibile)
const docId = await createDocument('clients', {
  nome: 'Mario',
  cognome: 'Rossi'
});

// Leggi documento
const client = await getDocumentData('clients', docId);

// Aggiorna documento
await updateDocument('clients', docId, {
  nome: 'Mario Updated'
});
```

### Tenant Service

Gestione multi-tenant e isolamento dati.

```javascript
import { 
  getCurrentTenantId, 
  getCurrentTenant,
  hasModuleAccess 
} from './core/services/tenant-service.js';

// Ottieni tenant corrente
const tenantId = getCurrentTenantId();
const tenant = await getCurrentTenant();

// Verifica accesso modulo
const hasVendemmia = await hasModuleAccess('vendemmia');
```

### Auth Service

Gestione autenticazione e utenti.

```javascript
import { 
  signIn, 
  signUp, 
  signOutUser,
  getCurrentUserData,
  isAuthenticated 
} from './core/services/auth-service.js';

// Login
const user = await signIn('email@example.com', 'password');

// Registrazione
const newUser = await signUp('email@example.com', 'password', {
  nome: 'Mario',
  cognome: 'Rossi',
  tenantId: 'tenant-123'
});

// Verifica autenticazione
if (isAuthenticated()) {
  const userData = getCurrentUserData();
  console.log('Utente:', userData);
}
```

### Permission Service

Controllo permessi basati su ruoli.

```javascript
import { 
  hasRole,
  canManageClients,
  canViewAllLavori,
  canValidateOre 
} from './core/services/permission-service.js';

const user = getCurrentUserData();

// Verifica ruolo
if (hasRole(user, 'manager')) {
  // ...
}

// Verifica permesso
if (canManageClients(user)) {
  // Può gestire clienti
}
```

### Role Service

Gestione assegnazione ruoli (solo amministratore).

```javascript
import { 
  assignRole, 
  removeRole,
  setRoles 
} from './core/services/role-service.js';

// Assegna ruolo
await assignRole('user-id', 'manager');

// Rimuovi ruolo
await removeRole('user-id', 'operaio');

// Imposta ruoli multipli
await setRoles('user-id', ['manager', 'caposquadra']);
```

## 📦 Modelli

### Base Model

Classe base per tutti i modelli con funzionalità comuni.

```javascript
import { Base } from './core/models/Base.js';

class Cliente extends Base {
  constructor(data) {
    super(data);
    this.nome = data.nome || '';
    this.cognome = data.cognome || '';
  }
  
  validate() {
    const errors = [];
    if (!this.nome) errors.push('Nome obbligatorio');
    return { valid: errors.length === 0, errors };
  }
}

// Da Firestore
const cliente = Cliente.fromFirestore(doc);

// A Firestore
const firestoreData = cliente.toFirestore();
```

### User Model

Modello utente con ruoli e tenant.

```javascript
import { User } from './core/models/User.js';

const user = User.fromData({
  id: 'user-123',
  email: 'mario@example.com',
  nome: 'Mario',
  cognome: 'Rossi',
  ruoli: ['manager', 'caposquadra'],
  tenantId: 'tenant-123'
});

// Verifica ruoli
if (user.hasRole('manager')) {
  // ...
}

if (user.hasAnyRole(['manager', 'amministratore'])) {
  // ...
}
```

## 🔐 Multi-Tenant

Tutti i servizi supportano automaticamente il multi-tenant:

- **Firebase Service**: Accetta `tenantId` opzionale in tutte le funzioni
- **Tenant Service**: Gestisce automaticamente il tenant corrente
- **Auth Service**: Collega utente al tenant automaticamente

### Pattern Consigliato

```javascript
// ✅ CORRETTO - Usa TenantService
import { getCurrentTenantId } from './core/services/tenant-service.js';
import { createDocument } from './core/services/firebase-service.js';

const tenantId = getCurrentTenantId();
await createDocument('clients', data, tenantId);

// ❌ SBAGLIATO - Hardcode tenantId
await createDocument('clients', data, 'tenant-123');
```

## 🎯 Best Practices

1. **Sempre usare servizi core** invece di accedere direttamente a Firebase
2. **Verificare permessi** prima di operazioni sensibili
3. **Filtrare per tenant** automaticamente usando TenantService
4. **Usare modelli** per validazione e conversione dati
5. **Gestire errori** con try-catch appropriati

## 📝 Esempio Completo

```javascript
import { initializeCore } from './core/init.js';
import { firebaseConfig } from './core/firebase-config.js';
import { signIn } from './core/services/auth-service.js';
import { getCurrentTenantId } from './core/services/tenant-service.js';
import { createDocument } from './core/services/firebase-service.js';
import { canManageClients } from './core/services/permission-service.js';
import { getCurrentUserData } from './core/services/auth-service.js';

// 1. Inizializza core
await initializeCore(firebaseConfig);

// 2. Login
await signIn('email@example.com', 'password');

// 3. Verifica permessi
const user = getCurrentUserData();
if (canManageClients(user)) {
  // 4. Crea cliente (con tenant automatico)
  const tenantId = getCurrentTenantId();
  const clienteId = await createDocument('clients', {
    nome: 'Mario',
    cognome: 'Rossi'
  }, tenantId);
}
```

## 🔄 Prossimi Sviluppi

- [ ] Subscription Service (gestione abbonamenti)
- [ ] Invito Service (sistema inviti utenti)
- [ ] Storage Service (gestione file)
- [ ] Notification Service (notifiche push)

