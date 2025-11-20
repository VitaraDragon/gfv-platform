# 🚀 Come Aprire terreni-standalone.html

## ⚠️ IMPORTANTE: Non aprire direttamente il file!

Se apri `terreni-standalone.html` direttamente (doppio clic), **NON funzionerà** perché i moduli ES6 richiedono un server HTTP.

---

## ✅ Opzione 1: Server Locale Python (CONSIGLIATO)

### Se hai Python installato:

1. Apri un terminale/PowerShell
2. Vai nella cartella `gfv-platform`:
   ```bash
   cd C:\Users\Pier\Desktop\GFV\gfv-platform
   ```
3. Avvia il server:
   ```bash
   python -m http.server 8000
   ```
   Oppure se hai Python 2:
   ```bash
   python -m SimpleHTTPServer 8000
   ```
4. Apri il browser e vai su:
   ```
   http://localhost:8000/core/terreni-standalone.html
   ```

---

## ✅ Opzione 2: Server Node.js (se hai Node.js)

1. Installa `http-server` globalmente:
   ```bash
   npm install -g http-server
   ```
2. Vai nella cartella `gfv-platform`:
   ```bash
   cd C:\Users\Pier\Desktop\GFV\gfv-platform
   ```
3. Avvia il server:
   ```bash
   http-server -p 8000
   ```
4. Apri il browser e vai su:
   ```
   http://localhost:8000/core/terreni-standalone.html
   ```

---

## ✅ Opzione 3: Estensione Browser (VS Code)

Se usi VS Code:

1. Installa l'estensione **"Live Server"**
2. Clicca destro su `terreni-standalone.html`
3. Seleziona **"Open with Live Server"**

---

## ✅ Opzione 4: Estensione Chrome (solo per test)

1. Installa l'estensione **"Web Server for Chrome"** dal Chrome Web Store
2. Configura la cartella `gfv-platform`
3. Avvia il server
4. Apri l'URL mostrato + `/core/terreni-standalone.html`

---

## 🔍 Verifica Errori

Dopo aver aperto con un server:

1. Apri la **Console del browser** (F12 → Console)
2. Controlla se ci sono errori in rosso
3. Dovresti vedere messaggi come:
   - ✅ "🔧 Inizializzazione Firebase..."
   - ✅ "✅ Core inizializzato"
   - ✅ "Google Maps initialized" (se configurato)

---

## ❌ Se Vedi Errori CORS

Se vedi errori tipo "CORS policy" o "Failed to fetch module":
- ✅ Stai usando un server HTTP? (non file://)
- ✅ Il server è avviato correttamente?
- ✅ Stai aprendo l'URL corretto (http://localhost:8000/...)?

---

## 🎯 Test Rapido

1. Avvia un server (Opzione 1 è la più semplice)
2. Apri `http://localhost:8000/core/terreni-standalone.html`
3. Se non sei autenticato, verrai reindirizzato al login
4. Dopo il login, dovresti vedere la pagina dei terreni

---

**Quale metodo preferisci usare?** 🚀





