# 🔒 Istruzioni per Configurare Firestore Rules

## ⚠️ Problema Attuale

Stai ricevendo errori "Missing or insufficient permissions" perché le regole di sicurezza Firestore non sono configurate correttamente per le nuove collection (`tariffe`, `preventivi`, `clienti`).

## ✅ Soluzione

### Step 1: Apri Firebase Console

1. Vai su [Firebase Console](https://console.firebase.google.com/)
2. Seleziona il progetto `gfv-platform` (o il tuo progetto)
3. Nel menu laterale, vai su **Firestore Database**
4. Clicca sulla tab **"Regole"** (Rules)

### Step 2: Copia le Regole

Apri il file `firestore.rules` nella root del progetto e copia tutto il contenuto.

### Step 3: Incolla in Firebase Console

1. Nella pagina Regole di Firebase Console, incolla il contenuto del file `firestore.rules`
2. Clicca su **"Pubblica"** (Publish)

### Step 4: Verifica

Dopo aver pubblicato le regole, ricarica la pagina e prova di nuovo a:
- Creare una tariffa
- Creare un preventivo
- Accedere alla dashboard Conto Terzi

## 📋 Cosa Fanno le Regole

Le regole configurate permettono:

1. **Lettura del proprio documento utente**: Ogni utente può leggere il proprio documento in `users/{userId}` per ottenere `tenantId` e `ruoli`

2. **Accesso ai dati del tenant**: Gli utenti autenticati possono leggere/scrivere nei dati del loro tenant (`tenants/{tenantId}/...`)

3. **Permessi per Manager/Admin**: Solo Manager e Amministratore possono creare/modificare/eliminare:
   - Clienti
   - Tariffe
   - Preventivi
   - Terreni
   - Lavori

4. **Isolamento multi-tenant**: Ogni utente può accedere solo ai dati del proprio tenant

## 🔍 Verifica Regole Attuali

Se vuoi verificare le regole attuali, nella Firebase Console puoi:
1. Andare su Firestore Database → Regole
2. Vedere le regole correnti
3. Se sono diverse da quelle in `firestore.rules`, aggiornarle

## ⚠️ Note Importanti

- Le regole devono essere pubblicate per essere attive
- Dopo la pubblicazione, ci possono volere alcuni secondi per la propagazione
- Se continui ad avere errori, verifica che:
  - L'utente sia autenticato
  - L'utente abbia un `tenantId` nel documento `users/{userId}`
  - L'utente abbia il ruolo `manager` o `amministratore` nel campo `ruoli`

## 🧪 Test Regole

Dopo aver pubblicato le regole, puoi testare usando il simulatore nella Firebase Console:
1. Vai su Firestore Database → Regole
2. Clicca su "Simulator" (Simulatore)
3. Configura un test per verificare che le regole funzionino








