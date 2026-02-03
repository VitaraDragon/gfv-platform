# 🧪 Istruzioni Semplici: Come Testare il Login

## 📋 Cosa Ti Serve

- Un browser (Chrome, Firefox, Edge)
- Connessione internet
- 10-15 minuti di tempo

---

## 🚀 STEP 1: Crea un Utente in Firebase

### 1.1 Apri Firebase Console

1. Apri il browser
2. Vai su: **https://console.firebase.google.com/**
3. Accedi con il tuo account Google (se non sei già loggato)

### 1.2 Seleziona il Progetto

1. Dovresti vedere una lista di progetti
2. Clicca sul progetto **"gfv-platform"** (quello che abbiamo creato prima)

### 1.3 Crea Utente in Authentication

1. Nel menu laterale sinistro, clicca su **"Authentication"** (o "Autenticazione")
2. Clicca sulla tab **"Users"** (o "Utenti") in alto
3. Clicca sul pulsante **"Add user"** (o "Aggiungi utente") - di solito è un pulsante blu in alto
4. Si apre una finestra:
   - **Email**: Scrivi `test@gfv-platform.com` (o un'email che preferisci)
   - **Password**: Scrivi `test123456` (o una password che preferisci, almeno 6 caratteri)
   - **Password (conferma)**: Scrivi di nuovo la stessa password
5. Clicca **"Add user"** (o "Aggiungi")
6. ✅ Utente creato! Vedi l'utente nella lista

### 1.4 Copia l'UID (ID Utente)

1. Nella lista utenti, vedi l'utente appena creato
2. Clicca sull'utente (sulla riga)
3. Vedi una schermata con i dettagli
4. **COPIA** il valore di **"User UID"** (è una stringa lunga tipo: `abc123xyz456...`)
5. **SALVA** questo UID da qualche parte (lo userai dopo)

---

## 🗄️ STEP 2: Crea Documento Utente in Firestore

### 2.1 Vai a Firestore

1. Nel menu laterale sinistro, clicca su **"Firestore Database"** (o "Firestore")
2. Dovresti vedere la schermata del database

### 2.2 Crea Collection "users"

1. Se non vedi una collection chiamata **"users"**, creala:
   - Clicca **"Start collection"** (o "Inizia raccolta")
   - **Collection ID**: Scrivi `users` (esattamente così, minuscolo)
   - Clicca **"Next"** (o "Avanti")

### 2.3 Crea Documento Utente

1. **Document ID**: **INCOLLA** l'UID che hai copiato prima (quello dell'utente)
   - **IMPORTANTE**: L'ID del documento DEVE essere esattamente l'UID dell'utente
2. Clicca **"Next"** (o "Avanti")

### 2.4 Aggiungi Campi

Ora aggiungi questi campi uno per uno (clicca "Add field" per ogni campo):

**Campo 1:**
- **Field**: `email`
- **Type**: `string`
- **Value**: `test@gfv-platform.com` (o l'email che hai usato)

**Campo 2:**
- **Field**: `nome`
- **Type**: `string`
- **Value**: `Test`

**Campo 3:**
- **Field**: `cognome`
- **Type**: `string`
- **Value**: `Utente`

**Campo 4:**
- **Field**: `ruoli`
- **Type**: `array`
- **Value**: Clicca "Add item" e scrivi `amministratore` (senza virgolette)

**Campo 5:**
- **Field**: `stato`
- **Type**: `string`
- **Value**: `attivo`

**Campo 6:**
- **Field**: `tenantId`
- **Type**: `string`
- **Value**: Lascia vuoto o scrivi `null`

3. Clicca **"Save"** (o "Salva")
4. ✅ Documento creato!

---

## 💻 STEP 3: Avvia Server Locale

### Opzione A: Usa Python (Se Installato)

1. Apri il **Prompt dei Comandi** (Windows):
   - Premi `Windows + R`
   - Scrivi `cmd` e premi Invio
   
2. Vai nella cartella del progetto:
   ```
   cd C:\Users\Pier\Desktop\GFV\gfv-platform
   ```

3. Avvia il server:
   ```
   python -m http.server 8000
   ```

4. Dovresti vedere: `Serving HTTP on 0.0.0.0 port 8000...`
5. **NON chiudere** questa finestra! Lasciala aperta.

### Opzione B: Usa VS Code Live Server (Se Installato)

1. Apri VS Code
2. Apri la cartella `gfv-platform`
3. Click destro sul file `core/auth/login.html`
4. Seleziona **"Open with Live Server"**
5. Si apre automaticamente nel browser

### Opzione C: Usa Node.js (Se Installato)

1. Apri il **Prompt dei Comandi**
2. Vai nella cartella:
   ```
   cd C:\Users\Pier\Desktop\GFV\gfv-platform
   ```
3. Avvia server:
   ```
   npx http-server -p 8000
   ```
4. **NON chiudere** questa finestra!

---

## 🌐 STEP 4: Apri la Pagina Login

### Se Hai Usato Python o Node.js:

1. Apri il browser (Chrome, Firefox, Edge)
2. Nella barra degli indirizzi, scrivi:
   ```
   http://localhost:8000/core/auth/login.html
   ```
3. Premi Invio

### Se Hai Usato Live Server:

1. Si apre automaticamente nel browser
2. Se non si apre, vai su: `http://localhost:5500/core/auth/login.html` (o il numero che vedi)

---

## 🔐 STEP 5: Testa il Login

1. Dovresti vedere una pagina con:
   - Titolo "🌾 GFV Platform"
   - Form con due campi: Email e Password
   - Pulsante "Accedi"

2. **Inserisci**:
   - **Email**: `test@gfv-platform.com` (o l'email che hai creato)
   - **Password**: `test123456` (o la password che hai creato)

3. **Clicca** sul pulsante **"Accedi"**

4. **Cosa Dovrebbe Succedere**:
   - Vedi un messaggio "Accesso in corso..."
   - Poi vedi "✅ Accesso effettuato con successo!"
   - Vieni reindirizzato a una pagina "Dashboard"
   - Vedi le tue informazioni utente

---

## ✅ Se Funziona

Se vedi la dashboard con le tue informazioni, **FUNZIONA TUTTO!** 🎉

Puoi:
- Vedere le tue info utente
- Cliccare "Logout" per uscire
- Rifare login quando vuoi

---

## ❌ Se NON Funziona

### Problema: "Errore inizializzazione applicazione"

**Cosa fare**:
1. Apri la console del browser:
   - Premi `F12` (o click destro → "Ispeziona" → tab "Console")
2. Vedi errori in rosso
3. Controlla che `core/firebase-config.js` abbia valori reali (non `YOUR_API_KEY_HERE`)

### Problema: "Email o password errati"

**Cosa fare**:
1. Verifica che l'utente esista in Firebase Authentication
2. Verifica email e password sono corrette
3. Prova a creare un nuovo utente

### Problema: "Utente non trovato"

**Cosa fare**:
1. Verifica che il documento esista in Firestore
2. Verifica che l'ID del documento sia esattamente l'UID dell'utente
3. Verifica che il documento abbia tutti i campi necessari

### Problema: Pagina bianca o errori

**Cosa fare**:
1. Apri console browser (`F12`)
2. Vedi errori in rosso
3. Verifica che stai usando un server locale (non aprire il file direttamente)
4. Verifica che tutti i file esistano nelle cartelle corrette

---

## 🆘 Serve Aiuto?

Se hai problemi:
1. Apri console browser (`F12`)
2. Fai screenshot degli errori
3. Dimmi a che step ti sei fermato
4. Ti aiuto a risolvere!

---

## 📝 Checklist Completa

Prima di testare, verifica:

- [ ] Utente creato in Firebase Authentication
- [ ] UID utente copiato
- [ ] Documento creato in Firestore con ID = UID
- [ ] Documento ha tutti i campi (email, nome, cognome, ruoli, stato)
- [ ] Server locale avviato
- [ ] Pagina login aperta nel browser
- [ ] Email e password inserite correttamente

---

**Tempo stimato**: 10-15 minuti  
**Difficoltà**: Facile (solo click e copia/incolla)  
**Risultato**: Login funzionante! 🚀






