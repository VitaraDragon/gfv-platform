# 🔧 Configurazione CORS per Firebase Storage

## ⚠️ Problema

L'errore CORS quando si carica il logo indica che il bucket Firebase Storage non ha la configurazione CORS per permettere richieste da GitHub Pages.

## ✅ Soluzione: Configura CORS sul Bucket Storage

### Opzione 1: Usando gsutil (Raccomandato)

1. **Installa Google Cloud SDK** (se non già installato):
   ```bash
   # Windows (con Chocolatey)
   choco install gcloudsdk
   
   # Oppure scarica da: https://cloud.google.com/sdk/docs/install
   ```

2. **Autenticati con Google Cloud**:
   ```bash
   gcloud auth login
   ```

3. **Imposta il progetto**:
   ```bash
   gcloud config set project gfv-platform
   ```

4. **Applica configurazione CORS**:
   ```bash
   gsutil cors set cors.json gs://gfv-platform.firebasestorage.app
   ```
   
   **Nota**: Sostituisci `gfv-platform.firebasestorage.app` con il tuo bucket Storage se diverso.
   Per trovare il nome del bucket: Firebase Console → Storage → Settings → Bucket name

5. **Verifica configurazione**:
   ```bash
   gsutil cors get gs://gfv-platform.firebasestorage.app
   ```

### Opzione 2: Usando Google Cloud Console (Alternativa)

1. Vai su [Google Cloud Console](https://console.cloud.google.com/)
2. Seleziona il progetto `gfv-platform`
3. Vai su **Cloud Storage** → **Browser**
4. Clicca sul bucket `gfv-platform.firebasestorage.app`
5. Vai su **Permissions** → **CORS**
6. Clicca **Edit CORS configuration**
7. Incolla questa configurazione:
   ```json
   [
     {
       "origin": [
         "https://vitaradragon.github.io",
         "http://localhost:*",
         "http://127.0.0.1:*"
       ],
       "method": ["GET", "POST", "PUT", "DELETE", "HEAD", "OPTIONS"],
       "responseHeader": [
         "Content-Type",
         "Authorization",
         "Content-Length",
         "x-goog-resumable"
       ],
       "maxAgeSeconds": 3600
     }
   ]
   ```
8. Clicca **Save**

### Opzione 3: Usando Firebase CLI (Se supportato)

```bash
firebase storage:rules:deploy
```

Poi configura CORS manualmente via Google Cloud Console.

## 🔍 Verifica Bucket Name

Per trovare il nome esatto del tuo bucket Storage:

1. Vai su Firebase Console → **Storage**
2. Clicca su **Settings** (⚙️)
3. Copia il **Bucket name** (es: `gfv-platform.firebasestorage.app`)

## ✅ Dopo la Configurazione

1. Attendi 1-2 minuti per la propagazione
2. Ricarica l'app da GitHub Pages
3. Prova a caricare il logo di nuovo

## 🆘 Se Non Funziona

1. Verifica che Storage sia abilitato in Firebase Console
2. Verifica che le regole Storage siano deployate: `firebase deploy --only storage`
3. Controlla che il bucket name sia corretto
4. Verifica che l'origine GitHub Pages sia nella lista CORS

---

**Nota**: La configurazione CORS è separata dalle regole Storage. Entrambe devono essere configurate correttamente.







