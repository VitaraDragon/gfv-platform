# 🔥 Guida Configurazione Firebase - GFV Platform

## ⚠️ IMPORTANTE

Questa guida è per configurare il **NUOVO** progetto Firebase `gfv-platform`.
**NON toccare** il progetto Firebase esistente `vendemmia-meccanizzata` che è usato dalla vecchia app.

---

## 📋 Checklist Pre-Configurazione

Prima di iniziare, assicurati di avere:
- [ ] Account Google (per accedere a Firebase Console)
- [ ] Accesso a [Firebase Console](https://console.firebase.google.com/)
- [ ] 15-20 minuti di tempo
- [ ] Browser moderno (Chrome, Firefox, Edge)

---

## 🚀 STEP 1: Crea Nuovo Progetto Firebase

### 1.1 Accedi a Firebase Console

1. Vai su: **https://console.firebase.google.com/**
2. Accedi con il tuo account Google
3. Se vedi progetti esistenti, **NON cliccare** su `vendemmia-meccanizzata`

### 1.2 Crea Nuovo Progetto

1. Clicca sul pulsante **"Aggiungi progetto"** o **"Add project"** (icona +)
2. **Nome progetto**: Inserisci `gfv-platform`
3. **Project ID**: Firebase genererà automaticamente `gfv-platform` (o simile se non disponibile)
   - Se non disponibile, usa: `gfv-platform-prod` o `gfv-platform-app`
4. Clicca **"Continua"** o **"Continue"**

### 1.3 Google Analytics (Opzionale)

1. Firebase chiederà se vuoi abilitare Google Analytics
2. **Raccomandazione**: Per ora **DISABILITA** (puoi abilitarlo dopo)
   - Deseleziona la checkbox
   - Clicca **"Crea progetto"** o **"Create project"**
3. Se hai abilitato Analytics, seleziona un account Analytics (o creane uno nuovo)
4. Attendi che Firebase crei il progetto (30-60 secondi)
5. Clicca **"Continua"** o **"Continue"** quando pronto

---

## 🔧 STEP 2: Configura Authentication

### 2.1 Abilita Authentication

1. Nel menu laterale sinistro, clicca su **"Authentication"** o **"Autenticazione"**
2. Se vedi "Get started", cliccalo
3. Se vedi già una schermata con "Sign-in method", sei già nella pagina giusta

### 2.2 Abilita Email/Password

1. Nella tab **"Sign-in method"** o **"Metodi di accesso"**
2. Clicca su **"Email/Password"**
3. Nella finestra che si apre:
   - **Abilita** il primo toggle (Email/Password)
   - **NON abilitare** "Email link (passwordless sign-in)" per ora
4. Clicca **"Salva"** o **"Save"**

### 2.3 Verifica

Dovresti vedere "Email/Password" con stato **"Abilitato"** o **"Enabled"**

---

## 🗄️ STEP 3: Crea Firestore Database

### 3.1 Crea Database

1. Nel menu laterale, clicca su **"Firestore Database"** o **"Firestore"**
2. Clicca **"Crea database"** o **"Create database"**

### 3.2 Scegli Modalità

1. Ti chiederà di scegliere tra:
   - **"Produzione"** (Production mode) - Regole di sicurezza restrittive
   - **"Test"** (Test mode) - Regole permissive per sviluppo
2. **Raccomandazione per sviluppo**: Scegli **"Test"** per ora
   - Puoi cambiare in "Produzione" dopo aver configurato le regole
3. Clicca **"Avanti"** o **"Next"**

### 3.3 Scegli Location

1. Ti mostrerà una mappa con le location disponibili
2. **Raccomandazione**: Scegli **"europe-west"** (Belgio) o **"europe-west1"** (Belgio)
   - Più vicino all'Italia
   - Migliori performance per utenti italiani
3. Clicca **"Abilita"** o **"Enable"**
4. Attendi che il database venga creato (1-2 minuti)

### 3.4 Verifica

Dovresti vedere la schermata Firestore con:
- Database creato
- Nessuna collection ancora (normale)
- Pulsante "Inizia raccolta" o "Start collection"

---

## 🔒 STEP 4: Configura Firestore Security Rules

### 4.1 Vai alle Regole

1. Nella pagina Firestore, clicca sulla tab **"Regole"** o **"Rules"** (in alto)
2. Vedrai un editor con regole di default

### 4.2 Regole per Test Mode

Se hai scelto "Test mode", vedrai:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.time < timestamp.date(2025, 12, 31);
    }
  }
}
```

**⚠️ ATTENZIONE**: Queste regole permettono accesso a tutti per 30 giorni. 
Per produzione, dovrai sostituirle con regole più sicure (vedi STEP 4.3).

### 4.3 Regole per Produzione (Da fare dopo)

Quando sei pronto per produzione, sostituisci le regole con quelle in `core/SETUP_FIREBASE.md` (sezione Step 5).

**Per ora, lascia le regole di test se hai scelto Test mode.**

### 4.4 Pubblica Regole

1. Se hai modificato le regole, clicca **"Pubblica"** o **"Publish"**
2. Attendi conferma

---

## 📱 STEP 5: Registra Web App

### 5.1 Vai alla Pagina Principale

1. Nel menu laterale, clicca sull'icona **"Impostazioni progetto"** (⚙️) in alto
2. Oppure clicca sul nome del progetto in alto a sinistra
3. Scorri fino a vedere **"Le tue app"** o **"Your apps"**

### 5.2 Aggiungi Web App

1. Clicca sull'icona **Web** (`</>`) o **"Aggiungi app"** → **"Web"**
2. Se non vedi l'icona Web, clicca **"Aggiungi app"** e poi seleziona **"Web"**

### 5.3 Configura App

1. **App nickname**: Inserisci `GFV Platform Web`
2. **Firebase Hosting**: 
   - **NON** selezionare per ora (puoi abilitarlo dopo)
   - Lascia deselezionato
3. Clicca **"Registra app"** o **"Register app"**

### 5.4 Copia Configurazione

1. Ti verrà mostrata una schermata con codice JavaScript
2. **NON copiare tutto il codice**, ma solo l'oggetto `firebaseConfig`
3. Dovresti vedere qualcosa come:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "gfv-platform.firebaseapp.com",
  projectId: "gfv-platform",
  storageBucket: "gfv-platform.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123def456",
  measurementId: "G-XXXXXXXXXX"  // Solo se hai abilitato Analytics
};
```

4. **COPIA** questo oggetto (tutto il contenuto tra le parentesi graffe)
5. Clicca **"Continua alla console"** o **"Continue to console"**

---

## 📝 STEP 6: Inserisci Configurazione nel Progetto

### 6.1 Apri File di Configurazione

1. Vai nella cartella: `C:\Users\Pier\Desktop\GFV\gfv-platform\core\`
2. Apri il file: `firebase-config.js`
3. Se non esiste, crea un nuovo file con quel nome

### 6.2 Sostituisci Valori

1. Nel file `firebase-config.js`, troverai valori placeholder tipo:
   - `YOUR_API_KEY_HERE`
   - `gfv-platform.firebaseapp.com`
   - etc.

2. **Sostituisci** questi valori con quelli copiati da Firebase Console:
   - `apiKey`: Incolla il valore copiato
   - `authDomain`: Incolla il valore copiato
   - `projectId`: Incolla il valore copiato
   - `storageBucket`: Incolla il valore copiato
   - `messagingSenderId`: Incolla il valore copiato
   - `appId`: Incolla il valore copiato
   - `measurementId`: Incolla solo se presente (se hai abilitato Analytics)

### 6.3 Verifica Formato

Il file dovrebbe assomigliare a questo (con i TUOI valori reali):

```javascript
export const firebaseConfig = {
  apiKey: "AIzaSy...",  // TUO valore reale
  authDomain: "gfv-platform.firebaseapp.com",  // TUO valore reale
  projectId: "gfv-platform",  // TUO valore reale
  storageBucket: "gfv-platform.appspot.com",  // TUO valore reale
  messagingSenderId: "123456789",  // TUO valore reale
  appId: "1:123456789:web:abc123def456"  // TUO valore reale
};
```

### 6.4 Salva File

1. Salva il file `firebase-config.js`
2. **IMPORTANTE**: Questo file NON deve essere committato su Git se contiene chiavi reali
3. Verifica che sia nel `.gitignore` (dovrebbe esserci già)

---

## ✅ STEP 7: Verifica Configurazione

### 7.1 Verifica Firebase Console

Torna su Firebase Console e verifica:

- [ ] **Authentication**: Email/Password abilitato
- [ ] **Firestore Database**: Creato e attivo
- [ ] **Web App**: Registrata (dovresti vederla in "Le tue app")

### 7.2 Verifica File Locale

1. Apri `core/firebase-config.js`
2. Verifica che:
   - [ ] Tutti i valori placeholder siano stati sostituiti
   - [ ] Non ci siano più `YOUR_..._HERE`
   - [ ] I valori corrispondano a quelli in Firebase Console

### 7.3 Verifica .gitignore

1. Apri `.gitignore` nella root `gfv-platform/`
2. Verifica che contenga:
   ```
   core/firebase-config.js
   ```
3. Se non c'è, aggiungilo

---

## 🎯 STEP 8: Test (Opzionale - Da fare dopo)

Dopo aver configurato tutto, puoi testare la connessione creando una pagina HTML di test (ma questo è opzionale per ora).

---

## 📊 Riepilogo Cosa Hai Fatto

Dovresti aver completato:

- [x] Creato progetto Firebase `gfv-platform`
- [x] Abilitato Authentication (Email/Password)
- [x] Creato Firestore Database
- [x] Registrato Web App
- [x] Copiato configurazione in `core/firebase-config.js`
- [x] Verificato che file sia nel `.gitignore`

---

## ⚠️ Cosa NON Hai Toccato

- ✅ Progetto Firebase `vendemmia-meccanizzata` (vecchia app) - **NON toccato**
- ✅ File in `vecchia app/` - **NON toccati**
- ✅ Configurazione vecchia app - **NON modificata**

---

## 🆘 Problemi Comuni

### "Project ID non disponibile"
- Usa una variante: `gfv-platform-prod`, `gfv-platform-app`, `gfv-platform-new`

### "Non vedo l'icona Web"
- Vai su "Impostazioni progetto" → "Le tue app" → "Aggiungi app" → "Web"

### "Non trovo il file firebase-config.js"
- Crea il file manualmente in `core/firebase-config.js`
- Copia il contenuto da `firebase-config.example.js` e sostituisci i valori

### "Dove trovo la configurazione dopo aver registrato l'app?"
- Vai su "Impostazioni progetto" (⚙️) → Scorri fino a "Le tue app" → Clicca sull'icona ⚙️ accanto alla Web App → "Configurazione SDK"

---

## 📚 Prossimi Passi (Dopo questa configurazione)

1. **Test connessione**: Crea una pagina HTML di test per verificare che Firebase funzioni
2. **Configura Security Rules**: Sostituisci regole di test con regole di produzione
3. **Abilita Storage**: Se necessario per file upload
4. **Configura Hosting**: Se vuoi deployare l'app su Firebase Hosting

---

**Tempo stimato**: 15-20 minuti  
**Difficoltà**: Facile (solo click e copia/incolla)  
**Rischio**: Nessuno (non tocchi la vecchia app)

---

**Hai completato tutti gli step?** ✅  
**Configurazione pronta per sviluppo!** 🚀






