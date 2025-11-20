# ✅ Checklist Configurazione Firebase - GFV Platform

## 📋 Checklist Rapida

Segui questa checklist passo-passo. Ogni step richiede 2-5 minuti.

---

## 🔥 STEP 1: Crea Progetto Firebase

- [ ] Vai su https://console.firebase.google.com/
- [ ] Clicca "Aggiungi progetto" o "Add project"
- [ ] Nome: `gfv-platform`
- [ ] Project ID: `gfv-platform` (o variante se non disponibile)
- [ ] **DISABILITA** Google Analytics (per ora)
- [ ] Clicca "Crea progetto"
- [ ] Attendi creazione (30-60 secondi)
- [ ] Clicca "Continua"

**⏱️ Tempo**: 3-5 minuti

---

## 🔐 STEP 2: Abilita Authentication

- [ ] Menu laterale → "Authentication"
- [ ] Clicca "Get started" (se presente)
- [ ] Tab "Sign-in method"
- [ ] Clicca su "Email/Password"
- [ ] **Abilita** il primo toggle (Email/Password)
- [ ] Clicca "Salva"

**⏱️ Tempo**: 2 minuti

---

## 🗄️ STEP 3: Crea Firestore Database

- [ ] Menu laterale → "Firestore Database"
- [ ] Clicca "Crea database"
- [ ] Scegli **"Test"** mode (per sviluppo)
- [ ] Clicca "Avanti"
- [ ] Scegli location: **"europe-west"** o **"europe-west1"**
- [ ] Clicca "Abilita"
- [ ] Attendi creazione (1-2 minuti)

**⏱️ Tempo**: 3-5 minuti

---

## 📱 STEP 4: Registra Web App

- [ ] Menu laterale → "Impostazioni progetto" (⚙️) o nome progetto
- [ ] Scorri fino a "Le tue app"
- [ ] Clicca icona **Web** (`</>`) o "Aggiungi app" → "Web"
- [ ] App nickname: `GFV Platform Web`
- [ ] **NON** selezionare Firebase Hosting
- [ ] Clicca "Registra app"
- [ ] **COPIA** l'oggetto `firebaseConfig` (solo i valori, non tutto il codice)
- [ ] Clicca "Continua alla console"

**⏱️ Tempo**: 3-5 minuti

---

## 📝 STEP 5: Inserisci Configurazione

- [ ] Apri file: `C:\Users\Pier\Desktop\GFV\gfv-platform\core\firebase-config.js`
- [ ] Sostituisci `YOUR_API_KEY_HERE` con il valore copiato
- [ ] Sostituisci `YOUR_MESSAGING_SENDER_ID` con il valore copiato
- [ ] Sostituisci `YOUR_APP_ID` con il valore copiato
- [ ] Verifica che `authDomain`, `projectId`, `storageBucket` corrispondano
- [ ] Salva il file

**⏱️ Tempo**: 2-3 minuti

---

## ✅ STEP 6: Verifica

- [ ] Firebase Console: Authentication abilitato? ✅
- [ ] Firebase Console: Firestore creato? ✅
- [ ] Firebase Console: Web App registrata? ✅
- [ ] File locale: Tutti i valori placeholder sostituiti? ✅
- [ ] File locale: Valori corrispondono a Firebase Console? ✅
- [ ] `.gitignore`: Contiene `core/firebase-config.js`? ✅

**⏱️ Tempo**: 2 minuti

---

## 🎯 Totale Tempo Stimato

**15-20 minuti** per completare tutta la configurazione.

---

## ⚠️ IMPORTANTE - Cosa NON Toccare

Durante questa configurazione:

- ❌ **NON** aprire il progetto `vendemmia-meccanizzata` in Firebase Console
- ❌ **NON** modificare file in `vecchia app/`
- ❌ **NON** toccare configurazione vecchia app
- ❌ **NON** committare `firebase-config.js` su Git (se contiene chiavi reali)

---

## 📚 Documentazione Dettagliata

Per istruzioni dettagliate con screenshot e spiegazioni complete, vedi:
- `GUIDA_CONFIGURAZIONE_FIREBASE.md` - Guida completa passo-passo

---

## 🆘 Hai Problemi?

### "Non trovo dove creare il progetto"
→ Vai su https://console.firebase.google.com/ e clicca "Aggiungi progetto" in alto

### "Project ID non disponibile"
→ Usa: `gfv-platform-prod` o `gfv-platform-app`

### "Non vedo l'icona Web"
→ Vai su "Impostazioni progetto" (⚙️) → "Le tue app" → "Aggiungi app"

### "Dove trovo la configurazione dopo?"
→ "Impostazioni progetto" (⚙️) → "Le tue app" → Clicca ⚙️ accanto alla Web App → "Configurazione SDK"

---

**Quando hai completato tutti gli step, la configurazione Firebase è pronta!** ✅





