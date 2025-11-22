# 🧪 Come Testare il Login

## 📋 Prerequisiti

Prima di testare il login, assicurati di avere:

1. ✅ Progetto Firebase `gfv-platform` creato
2. ✅ Authentication abilitato (Email/Password)
3. ✅ Firestore Database creato
4. ✅ Configurazione Firebase in `core/firebase-config.js`

## 👤 Creare Primo Utente

### Opzione 1: Firebase Console (Consigliato)

1. Vai su [Firebase Console](https://console.firebase.google.com/)
2. Seleziona progetto `gfv-platform`
3. Vai su **Authentication** → **Users**
4. Clicca **"Aggiungi utente"** o **"Add user"**
5. Inserisci:
   - **Email**: `admin@gfv-platform.com` (o quella che preferisci)
   - **Password**: `admin123456` (o quella che preferisci)
6. Clicca **"Aggiungi"**

### Opzione 2: Creare Utente in Firestore

Dopo aver creato l'utente in Authentication, devi creare il documento utente in Firestore:

1. Vai su **Firestore Database**
2. Crea collection `users` (se non esiste)
3. Crea documento con ID = UID utente Firebase (lo trovi in Authentication)
4. Aggiungi questi campi:

```json
{
  "email": "admin@gfv-platform.com",
  "nome": "Admin",
  "cognome": "GFV",
  "ruoli": ["amministratore"],
  "tenantId": null,
  "stato": "attivo",
  "creatoIl": "2025-01-08T10:00:00Z",
  "ultimoAccesso": null
}
```

**Nota**: Per ora `tenantId` può essere `null`. Lo aggiungeremo dopo quando creeremo il tenant.

## 🚀 Testare il Login

### Step 1: Apri la Pagina Login

1. Apri il file `core/auth/login.html` nel browser
   - **Importante**: Usa un server locale (non aprire direttamente il file)
   - Puoi usare: Live Server (VS Code), Python `http.server`, o altro

### Step 2: Prova il Login

1. Inserisci l'email creata (es: `admin@gfv-platform.com`)
2. Inserisci la password
3. Clicca **"Accedi"**

### Step 3: Verifica

Dovresti:
- ✅ Vedere messaggio "Accesso effettuato con successo!"
- ✅ Essere reindirizzato a `core/dashboard.html`
- ✅ Vedere le tue informazioni utente nella dashboard

## ⚠️ Problemi Comuni

### "Errore inizializzazione applicazione"

**Causa**: Firebase non configurato correttamente

**Soluzione**:
- Verifica che `core/firebase-config.js` contenga valori reali (non placeholder)
- Verifica che il progetto Firebase esista
- Controlla la console del browser per errori specifici

### "Utente non trovato"

**Causa**: Utente non esiste in Firestore

**Soluzione**:
- Crea il documento utente in Firestore (vedi Opzione 2 sopra)
- Verifica che l'ID del documento corrisponda all'UID di Firebase Authentication

### "Email o password errati"

**Causa**: Credenziali sbagliate o utente non esiste in Authentication

**Soluzione**:
- Verifica email e password
- Crea utente in Firebase Authentication se non esiste

### "CORS error" o "Module not found"

**Causa**: File aperto direttamente senza server

**Soluzione**:
- Usa un server locale (Live Server, Python http.server, etc.)
- Non aprire il file HTML direttamente dal file system

## 🔧 Setup Server Locale

### Opzione 1: Live Server (VS Code)

1. Installa estensione "Live Server" in VS Code
2. Click destro su `login.html`
3. Seleziona "Open with Live Server"

### Opzione 2: Python

```bash
cd gfv-platform
python -m http.server 8000
```

Poi apri: `http://localhost:8000/core/auth/login.html`

### Opzione 3: Node.js (http-server)

```bash
npm install -g http-server
cd gfv-platform
http-server -p 8000
```

## ✅ Checklist Test

- [ ] Utente creato in Firebase Authentication
- [ ] Documento utente creato in Firestore
- [ ] Server locale avviato
- [ ] Pagina login aperta nel browser
- [ ] Login funziona
- [ ] Redirect a dashboard funziona
- [ ] Info utente visibili in dashboard
- [ ] Logout funziona

## 🎯 Prossimi Passi

Dopo aver testato il login:

1. ✅ Login funzionante
2. ⏭️ Sviluppare dashboard completa con contenuto per ruolo
3. ⏭️ Aggiungere gestione tenant
4. ⏭️ Sviluppare moduli applicativi

---

**Hai problemi?** Controlla la console del browser (F12) per vedere errori specifici.






