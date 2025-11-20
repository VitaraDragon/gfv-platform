# 🔥 Setup Nuovo Progetto Firebase - GFV Platform

## 📋 Perché un Nuovo Progetto?

Il progetto Firebase esistente (`vendemmia-meccanizzata`) è per l'applicazione singola esistente. 
GFV Platform è una **piattaforma SaaS multi-tenant** completamente nuova, quindi serve un progetto Firebase dedicato.

## 🚀 Step 1: Crea Nuovo Progetto Firebase

1. **Vai su [Firebase Console](https://console.firebase.google.com/)**
2. **Clicca "Aggiungi progetto"** o "Add project"
3. **Inserisci nome progetto:**
   - Nome: `gfv-platform`
   - Project ID: `gfv-platform` (o simile, se non disponibile)
4. **Disabilita Google Analytics** (opzionale, puoi abilitarlo dopo)
5. **Clicca "Crea progetto"**

## 🔧 Step 2: Configura Firebase Services

### 2.1 Authentication

1. Nel menu laterale, vai su **"Authentication"**
2. Clicca **"Get started"**
3. Abilita **"Email/Password"** provider
4. Salva

### 2.2 Firestore Database

1. Nel menu laterale, vai su **"Firestore Database"**
2. Clicca **"Crea database"**
3. Scegli modalità:
   - **Produzione** (per produzione)
   - **Test** (per sviluppo, con regole più permissive)
4. Scegli location (es: `europe-west` per Italia)
5. Clicca **"Abilita"**

### 2.3 Storage (Opzionale, per file)

1. Nel menu laterale, vai su **"Storage"**
2. Clicca **"Get started"**
3. Usa regole di sicurezza predefinite
4. Scegli location (stessa di Firestore)
5. Clicca **"Fine"**

## 📱 Step 3: Aggiungi Web App

1. Nella pagina principale del progetto, clicca sull'icona **Web** (`</>`)
2. Inserisci:
   - **App nickname:** `GFV Platform Web`
   - **Firebase Hosting:** (opzionale, puoi abilitare dopo)
3. Clicca **"Registra app"**
4. **Copia la configurazione** che appare (è quella che useremo)

## 📝 Step 4: Configura File Locale

1. Apri `core/firebase-config.js`
2. Sostituisci i valori placeholder con quelli del tuo progetto:

```javascript
export const firebaseConfig = {
  apiKey: "AIzaSy...", // Copia dal Firebase Console
  authDomain: "gfv-platform.firebaseapp.com",
  projectId: "gfv-platform",
  storageBucket: "gfv-platform.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123def456"
};
```

## 🔒 Step 5: Configura Firestore Security Rules

1. Vai su **Firestore Database** → **Regole**
2. Copia le regole da `firestore.rules` (da creare) o usa queste base:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper: verifica autenticazione
    function isAuthenticated() {
      return request.auth != null;
    }
    
    // Helper: verifica che l'utente appartenga al tenant
    function belongsToTenant(tenantId) {
      return isAuthenticated() && 
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.tenantId == tenantId;
    }
    
    // Collection: users (globale)
    match /users/{userId} {
      allow read: if isAuthenticated() && request.auth.uid == userId;
      allow write: if isAuthenticated() && request.auth.uid == userId;
    }
    
    // Collection: tenants (globale)
    match /tenants/{tenantId} {
      allow read: if isAuthenticated() && belongsToTenant(tenantId);
      allow write: if isAuthenticated() && 
                      get(/databases/$(database)/documents/users/$(request.auth.uid)).data.ruoli.hasAny(['amministratore']);
    }
    
    // Collection: inviti (globale)
    match /inviti/{invitoId} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated() && 
                      get(/databases/$(database)/documents/users/$(request.auth.uid)).data.ruoli.hasAny(['amministratore']);
    }
    
    // Dati tenant (multi-tenant)
    match /tenants/{tenantId}/{document=**} {
      allow read: if isAuthenticated() && belongsToTenant(tenantId);
      allow write: if isAuthenticated() && belongsToTenant(tenantId);
    }
  }
}
```

3. Clicca **"Pubblica"**

## 🧪 Step 6: Test Configurazione

Crea un file di test per verificare che tutto funzioni:

```javascript
// test-firebase-config.html
import { initializeCore } from './core/init.js';
import { firebaseConfig } from './core/firebase-config.js';

async function test() {
  try {
    await initializeCore(firebaseConfig);
    console.log('✅ Firebase inizializzato correttamente!');
  } catch (error) {
    console.error('❌ Errore:', error);
  }
}

test();
```

## 📊 Step 7: Struttura Database Target

Il database avrà questa struttura:

```
Firestore/
├── users/                    # Utenti globali
│   └── {userId}/
│       ├── email
│       ├── nome
│       ├── cognome
│       ├── ruoli: []
│       ├── tenantId
│       └── stato
│
├── tenants/                  # Tenant/Aziende
│   └── {tenantId}/
│       ├── name
│       ├── plan
│       ├── modules: []
│       └── status
│
├── inviti/                   # Inviti utenti
│   └── {invitoId}/
│       ├── email
│       ├── tenantId
│       ├── token
│       └── stato
│
└── tenants/{tenantId}/        # Dati isolati per tenant
    ├── clients/
    ├── terreni/
    ├── lavori/
    ├── calcoli/
    └── ...
```

## ⚠️ Note Importanti

1. **Non condividere mai** il file `firebase-config.js` con valori reali su repository pubblici
2. **Aggiungi** `firebase-config.js` al `.gitignore` se contiene chiavi reali
3. **Usa** `firebase-config.example.js` per il repository pubblico
4. **Crea progetti separati** per sviluppo e produzione se necessario

## 🔄 Migrazione Dati (Opzionale)

Se vuoi migrare dati dal vecchio progetto:
1. Esporta dati da `vendemmia-meccanizzata`
2. Trasforma struttura per multi-tenant
3. Importa nel nuovo progetto

**Nota:** Per ora, mantieni i due progetti separati. La migrazione può essere fatta in seguito.

## ✅ Checklist

- [ ] Progetto Firebase creato
- [ ] Authentication abilitato (Email/Password)
- [ ] Firestore Database creato
- [ ] Storage abilitato (opzionale)
- [ ] Web App registrata
- [ ] Configurazione copiata in `firebase-config.js`
- [ ] Security Rules configurate
- [ ] Test inizializzazione riuscito

## 🆘 Problemi Comuni

**Errore: "Firebase non inizializzato"**
→ Verifica di aver chiamato `initializeCore()` prima di usare i servizi

**Errore: "Permission denied"**
→ Verifica Security Rules e che l'utente sia autenticato

**Errore: "Tenant non trovato"**
→ Verifica che l'utente abbia un `tenantId` valido nel documento `users`





