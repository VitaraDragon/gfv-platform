# 📋 Istruzioni Migrazione Dati Multi-Tenant

**Data**: 2026-01-04  
**Stato**: Pronto per esecuzione

---

## ✅ Prerequisiti Completati

- [x] Firebase Admin SDK installato (`npm install firebase-admin`)

---

## ⚠️ Prerequisiti Necessari

### 1. Service Account Credentials

**IMPORTANTE**: Prima di eseguire la migrazione, devi creare le credenziali del service account:

1. Vai su [Firebase Console](https://console.firebase.google.com/)
2. Seleziona il tuo progetto
3. Vai su **Project Settings** (icona ingranaggio) > **Service Accounts**
4. Clicca su **"Generate new private key"**
5. Salva il file JSON come `firebase-service-account.json` nella **root del progetto** (`c:\Users\Pier\Desktop\GFV\gfv-platform\`)

**Oppure** imposta la variabile d'ambiente:
```bash
set FIREBASE_SERVICE_ACCOUNT=C:\path\to\service-account.json
```

---

## 🚀 Esecuzione Migrazione

### Step 1: Dry-Run (Consigliato)

Esegui prima un dry-run per vedere cosa verrà modificato **senza applicare modifiche**:

```bash
cd c:\Users\Pier\Desktop\GFV\gfv-platform
node scripts/migrate-user-tenant-memberships.js --dry-run
```

**Cosa fa il dry-run**:
- Legge tutti gli utenti da Firestore
- Identifica utenti con `tenantId` ma senza `tenantMemberships`
- Mostra cosa verrebbe modificato
- **NON applica modifiche**

---

### Step 2: Backup Firestore

⚠️ **IMPORTANTE**: Prima della migrazione reale, fai un backup completo di Firestore:

1. Vai su Firebase Console > Firestore Database
2. Clicca su **"..."** (menu) > **Export**
3. Segui le istruzioni per esportare tutti i dati

**Oppure** usa Firebase CLI:
```bash
firebase firestore:export backup-2026-01-04
```

---

### Step 3: Migrazione Reale

Dopo aver verificato il dry-run e fatto il backup:

```bash
cd c:\Users\Pier\Desktop\GFV\gfv-platform
node scripts/migrate-user-tenant-memberships.js
```

**Cosa fa la migrazione**:
1. Trova tutti gli utenti con `tenantId` ma senza `tenantMemberships`
2. Crea `tenantMemberships[tenantId]` con:
   - `ruoli`: dai dati esistenti
   - `stato`: dai dati esistenti
   - `dataInizio`: da `creatoIl` o data corrente
   - `creatoDa`: da `creatoDa` o userId
   - `tenantIdPredefinito`: `true`
3. **Mantiene** `tenantId` e `ruoli` per retrocompatibilità

---

## 📊 Cosa Aspettarsi

### Output Dry-Run
```
🚀 Script Migrazione Multi-Tenant Membership
==========================================
Modalità: DRY-RUN (nessuna modifica)

✅ Firebase Admin inizializzato con service account
📊 Inizio migrazione...

📋 Trovati X utenti totali

  ✅ Utente user123:
     - Tenant: tenant-a
     - Ruoli: amministratore
     - Stato: attivo
  [DRY-RUN] Verrebbe aggiornato con: {...}

==========================================
📊 Riepilogo Migrazione
==========================================
✅ Migrati: X
⏭️  Saltati: Y
❌ Errori: 0

⚠️  DRY-RUN: Nessuna modifica effettuata
```

### Output Migrazione Reale
```
🚀 Script Migrazione Multi-Tenant Membership
==========================================
Modalità: ESECUZIONE REALE

✅ Firebase Admin inizializzato con service account
📊 Inizio migrazione...

📋 Trovati X utenti totali

  ✅ Utente user123:
     - Tenant: tenant-a
     - Ruoli: amministratore
     - Stato: attivo
  ✅ Migrato con successo

==========================================
📊 Riepilogo Migrazione
==========================================
✅ Migrati: X
⏭️  Saltati: Y
❌ Errori: 0

✅ Migrazione completata!
```

---

## 🔍 Verifica Post-Migrazione

Dopo la migrazione, verifica manualmente alcuni utenti:

1. Vai su Firebase Console > Firestore Database > `users`
2. Apri un documento utente migrato
3. Verifica che abbia:
   - ✅ Campo `tenantMemberships` con struttura corretta
   - ✅ Campo `tenantId` ancora presente (retrocompatibilità)
   - ✅ Campo `ruoli` ancora presente (retrocompatibilità)

**Esempio struttura corretta**:
```json
{
  "email": "user@example.com",
  "tenantId": "tenant-a",  // Mantenuto per retrocompatibilità
  "ruoli": ["amministratore"],  // Mantenuto per retrocompatibilità
  "tenantMemberships": {
    "tenant-a": {
      "ruoli": ["amministratore"],
      "stato": "attivo",
      "dataInizio": "2026-01-04T...",
      "creatoDa": "user123",
      "tenantIdPredefinito": true
    }
  }
}
```

---

## 🐛 Troubleshooting

### Errore: "Firebase Admin SDK richiede credenziali service account"

**Soluzione**:
1. Verifica che il file `firebase-service-account.json` esista nella root del progetto
2. Oppure imposta `FIREBASE_SERVICE_ACCOUNT` con il path corretto

### Errore: "Permission denied"

**Soluzione**:
1. Verifica che il service account abbia permessi di scrittura su Firestore
2. Vai su Firebase Console > IAM & Admin e verifica i permessi
3. Il service account deve avere ruolo "Firebase Admin SDK Administrator Service Agent"

### Errore: "Configurazione non trovata nel formato atteso"

**Soluzione**:
- Lo script cerca `core/config/firebase-config.js`
- Verifica che il file esista e abbia il formato corretto

---

## ✅ Checklist Pre-Migrazione

- [ ] Firebase Admin SDK installato
- [ ] Service account credentials create e salvate
- [ ] Backup Firestore completato
- [ ] Dry-run eseguito e verificato
- [ ] Nessun errore nel dry-run
- [ ] Pronto per migrazione reale

---

## 📝 Note

- La migrazione è **idempotente**: può essere eseguita più volte senza problemi
- Gli utenti già migrati (con `tenantMemberships`) vengono saltati
- Gli utenti senza `tenantId` vengono saltati
- La migrazione **non elimina** `tenantId` e `ruoli` per mantenere retrocompatibilità

---

## 🔄 Prossimi Passi Dopo Migrazione

1. ✅ Verificare alcuni utenti manualmente
2. ✅ Testare login con utente migrato
3. ✅ Verificare che `getUserTenants()` funzioni correttamente
4. ✅ Testare invito cross-tenant
5. ✅ Deploy security rules
6. ✅ Deploy codice
