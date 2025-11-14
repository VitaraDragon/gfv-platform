# 🧪 Test Login SENZA Server - Istruzioni Semplici

## ✅ Perfetto! Puoi Testare Direttamente dal Browser!

Ho creato versioni speciali che funzionano **aprendo direttamente il file HTML** nel browser, senza bisogno di server!

---

## 🚀 Come Fare (3 Passi Semplici)

### STEP 1: Crea Utente in Firebase

1. Vai su: **https://console.firebase.google.com/**
2. Clicca sul progetto **"gfv-platform"**
3. Menu → **"Authentication"** → tab **"Users"**
4. Clicca **"Add user"**
5. Inserisci:
   - **Email**: `test@gfv-platform.com`
   - **Password**: `test123456`
6. Clicca **"Add user"**
7. **COPIA** l'UID (User UID) che vedi

### STEP 2: Crea Documento in Firestore

1. Menu → **"Firestore Database"**
2. Clicca **"Start collection"**
3. **Collection ID**: `users` → **"Next"**
4. **Document ID**: **INCOLLA** l'UID copiato → **"Next"**
5. Aggiungi questi campi (clicca "Add field" per ognuno):

   - `email` (string) → `test@gfv-platform.com`
   - `nome` (string) → `Test`
   - `cognome` (string) → `Utente`
   - `ruoli` (array) → aggiungi `amministratore`
   - `stato` (string) → `attivo`
   - `tenantId` (string) → lascia vuoto

6. Clicca **"Save"**

### STEP 3: Apri il File nel Browser

1. Vai nella cartella: `C:\Users\Pier\Desktop\GFV\gfv-platform\core\auth\`
2. **Doppio click** sul file **`login-standalone.html`**
3. Si apre nel browser!
4. Inserisci email e password
5. Clicca **"Accedi"**

---

## 📁 File da Usare

**Usa questi file** (non quelli normali):
- ✅ `core/auth/login-standalone.html` - Login (apri questo!)
- ✅ `core/dashboard-standalone.html` - Dashboard (si apre automaticamente dopo login)

**NON usare**:
- ❌ `login.html` (quello normale, serve server)
- ❌ `dashboard.html` (quello normale, serve server)

---

## ✅ Se Funziona

Dovresti vedere:
1. Pagina login con form
2. Dopo login: messaggio "✅ Accesso effettuato con successo!"
3. Redirect automatico a dashboard
4. Le tue informazioni utente nella dashboard

---

## ❌ Se NON Funziona

### Problema: "Errore inizializzazione"

**Cosa fare**:
1. Apri console browser: Premi `F12` → tab "Console"
2. Vedi errori in rosso
3. Verifica che la configurazione Firebase sia corretta nel file

### Problema: "Email o password errati"

**Cosa fare**:
- Verifica che l'utente esista in Firebase Authentication
- Verifica email e password

### Problema: "Utente non trovato"

**Cosa fare**:
- Verifica che il documento esista in Firestore
- Verifica che l'ID del documento sia esattamente l'UID dell'utente

---

## 🎯 Vantaggi di Questa Versione

✅ **Nessun server necessario** - Apri direttamente il file  
✅ **Funziona subito** - Basta doppio click  
✅ **Stesso risultato** - Funziona come la versione normale  

---

## 📝 Nota

Questa versione usa Firebase da CDN (internet) invece di moduli locali.  
Funziona perfettamente per testare, ma per produzione useremo la versione normale con server.

---

**Prova ora!** Doppio click su `login-standalone.html` e testa! 🚀




