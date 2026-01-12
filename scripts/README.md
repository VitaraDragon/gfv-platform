# Scripts di Migrazione

## migrate-user-tenant-memberships.js

Script per migrare utenti esistenti da `tenantId` a `tenantMemberships`.

### Prerequisiti

1. **Firebase Admin SDK**: Installa con `npm install firebase-admin`
2. **Service Account**: Crea credenziali service account da Firebase Console:
   - Vai su Firebase Console > Project Settings > Service Accounts
   - Clicca "Generate new private key"
   - Salva il file JSON come `firebase-service-account.json` nella root del progetto
   - Oppure imposta variabile d'ambiente `FIREBASE_SERVICE_ACCOUNT` con il path al file

### Uso

#### Dry-run (consigliato prima della migrazione reale)
```bash
node scripts/migrate-user-tenant-memberships.js --dry-run
```

#### Esecuzione reale
```bash
node scripts/migrate-user-tenant-memberships.js
```

### Cosa fa lo script

1. Trova tutti gli utenti con `tenantId` ma senza `tenantMemberships`
2. Crea `tenantMemberships[tenantId]` con:
   - `ruoli`: dai dati esistenti
   - `stato`: dai dati esistenti
   - `dataInizio`: da `creatoIl` o data corrente
   - `creatoDa`: da `creatoDa` o userId
   - `tenantIdPredefinito`: `true`
3. **Mantiene** `tenantId` e `ruoli` per retrocompatibilità

### Sicurezza

⚠️ **IMPORTANTE**: Prima di eseguire la migrazione reale:
1. ✅ Fai backup completo di Firestore
2. ✅ Testa su database di sviluppo
3. ✅ Esegui prima con `--dry-run` per vedere cosa verrà modificato
4. ✅ Verifica manualmente alcuni utenti dopo la migrazione

### Troubleshooting

**Errore: "Firebase Admin SDK richiede credenziali service account"**
- Verifica che il file `firebase-service-account.json` esista nella root
- Oppure imposta `FIREBASE_SERVICE_ACCOUNT` con il path corretto

**Errore: "Permission denied"**
- Verifica che il service account abbia permessi di scrittura su Firestore
- Vai su Firebase Console > IAM & Admin e verifica i permessi
