# 📱 Guida PWA - App Installabile

## ✅ Cosa è stato implementato

L'app GFV Platform è ora installabile come **Progressive Web App (PWA)** sia su desktop che su mobile, proprio come la vecchia app.

### File creati:
- ✅ `manifest.json` - Manifesto dell'app con metadati e icone
- ✅ `service-worker.js` - Service Worker per cache e funzionamento offline

### Pagine aggiornate:
- ✅ `index.html`
- ✅ `core/auth/login-standalone.html`
- ✅ `core/dashboard-standalone.html`
- ✅ `core/attivita-standalone.html`
- ✅ `core/terreni-standalone.html`
- ✅ `core/statistiche-standalone.html`

---

## 🧪 Come testare l'installabilità

### Desktop (Chrome/Edge)

1. **Apri l'app in HTTPS** (o localhost)
   - Se usi GitHub Pages: già in HTTPS ✅
   - Se testi in locale: usa un server locale (es. `python -m http.server 8000`)

2. **Apri Chrome DevTools** (F12)

3. **Vai alla tab "Application"**
   - Verifica che "Manifest" mostri i dati corretti
   - Verifica che "Service Workers" mostri il service worker registrato

4. **Cerca il pulsante "Install"**
   - Nella barra degli indirizzi (icona +)
   - Oppure nel menu Chrome (tre puntini) → "Installa GFV Platform"

5. **Installa l'app**
   - L'app si aprirà in una finestra standalone (senza barra del browser)
   - Avrà un'icona nel desktop/start menu

### Mobile Android (Chrome)

1. **Apri l'app in Chrome** (deve essere in HTTPS)

2. **Menu Chrome** (tre puntini in alto a destra)

3. **"Aggiungi alla schermata home"** o **"Installa app"**

4. **Conferma installazione**

5. **L'app appare come icona** nella schermata home

### Mobile iOS (Safari)

1. **Apri l'app in Safari** (deve essere in HTTPS)

2. **Pulsante Condividi** (quadrato con freccia)

3. **"Aggiungi alla schermata Home"**

4. **Personalizza nome** (opzionale) e conferma

5. **L'app appare come icona** nella schermata home

---

## 🔄 Aggiornare la cache quando modifichi file

Quando modifichi file importanti (HTML, CSS, JS), devi aggiornare la cache del service worker:

### Passo 1: Modifica `service-worker.js`

Cambia il nome della cache:

```javascript
// Da:
const CACHE_NAME = 'gfv-platform-v1';

// A:
const CACHE_NAME = 'gfv-platform-v2';
```

### Passo 2: Aggiorna l'elenco file da cachare (se necessario)

Se hai aggiunto nuove pagine importanti, aggiungile a `urlsToCache`:

```javascript
const urlsToCache = [
  './',
  './index.html',
  './core/auth/login-standalone.html',
  // ... altre pagine
  './core/nuova-pagina-standalone.html', // ← Aggiungi qui
];
```

### Passo 3: Testa l'aggiornamento

1. **Ricarica la pagina** (Ctrl+F5 o Cmd+Shift+R)
2. **Apri DevTools** → Tab "Application" → "Service Workers"
3. **Clicca "Update"** se disponibile
4. **Verifica** che la nuova cache sia attiva

---

## 📋 Checklist verifica PWA

- [ ] Manifest.json presente e valido
- [ ] Service Worker registrato correttamente
- [ ] Icone presenti (almeno 192x192 e 512x512)
- [ ] App installabile su desktop (Chrome/Edge)
- [ ] App installabile su mobile Android
- [ ] App installabile su mobile iOS
- [ ] Funzionamento offline (disconnetti internet e prova)
- [ ] Cache funziona correttamente

---

## 🐛 Risoluzione problemi

### Service Worker non si registra

**Problema**: Console mostra errore di registrazione

**Soluzioni**:
1. Verifica che l'app sia in **HTTPS** (o localhost)
2. Verifica che il percorso a `service-worker.js` sia corretto
3. Controlla la console per errori specifici

### App non appare installabile

**Problema**: Pulsante "Install" non appare

**Soluzioni**:
1. Verifica che `manifest.json` sia accessibile (apri `https://tuosito.com/manifest.json`)
2. Verifica che le icone siano presenti e accessibili
3. Verifica che `start_url` nel manifest sia corretto
4. L'app deve essere visitata almeno una volta prima di essere installabile

### Cache non si aggiorna

**Problema**: Dopo modifiche, l'app mostra ancora la versione vecchia

**Soluzioni**:
1. Cambia `CACHE_NAME` nel service worker
2. Ricarica forzata (Ctrl+F5)
3. In DevTools → Application → Clear storage → Clear site data
4. Reinstalla l'app

---

## 📝 Note importanti

### HTTPS obbligatorio

Il Service Worker **richiede HTTPS** (o localhost per sviluppo). Su GitHub Pages è già HTTPS ✅

### Strategia cache

Il service worker usa **Network First**:
- Prova prima la rete
- Se fallisce, usa la cache
- Aggiorna la cache automaticamente quando possibile

### File esclusi dalla cache

Il service worker **NON cache**:
- Richieste Firebase (devono sempre andare in rete)
- Richieste Google APIs
- Richieste non-GET

Questo garantisce che i dati dinamici siano sempre aggiornati.

---

## 🚀 Prossimi miglioramenti (opzionali)

- [ ] Aggiungere notifiche push
- [ ] Migliorare strategia cache per file statici
- [ ] Aggiungere pagina offline personalizzata
- [ ] Implementare sincronizzazione in background
- [ ] Aggiungere aggiornamento automatico dell'app

---

**Ultimo aggiornamento**: 2025-01-25  
**Versione PWA**: v1

