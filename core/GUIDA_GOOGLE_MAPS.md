# 🗺️ Guida Configurazione Google Maps - GFV Platform

**IMPORTANTE**: Google Maps è un servizio separato da Firebase. Si configura dalla **Google Cloud Console**, non dalla Firebase Console.

---

## 📋 Checklist Rapida

1. ✅ Vai su Google Cloud Console (NON Firebase Console)
2. ✅ Seleziona o crea un progetto
3. ✅ Abilita Maps JavaScript API
4. ✅ Abilita Geometry Library (per calcolo aree)
5. ✅ Crea una chiave API
6. ✅ Configura limitazioni (opzionale ma consigliato)
7. ✅ Aggiungi la chiave al file `google-maps-config.js`

**⏱️ Tempo stimato**: 10-15 minuti

---

## 🚀 STEP 1: Accedi a Google Cloud Console

1. Vai su: **https://console.cloud.google.com/**
2. Accedi con il tuo account Google (stesso account usato per Firebase)

---

## 📦 STEP 2: Seleziona o Crea Progetto

### Opzione A: Usa lo stesso progetto Firebase (CONSIGLIATO)

Se hai già un progetto Firebase (`gfv-platform`), puoi usare quello stesso:

1. In alto a sinistra, clicca sul selettore progetti
2. Seleziona il progetto **`gfv-platform`** (o il nome del tuo progetto Firebase)

### Opzione B: Crea un nuovo progetto

1. Clicca sul selettore progetti in alto a sinistra
2. Clicca **"Nuovo progetto"** o **"New Project"**
3. Nome: `GFV Platform Maps` (o un nome a tua scelta)
4. Clicca **"Crea"** o **"Create"**
5. Attendi la creazione (10-20 secondi)

---

## 🔌 STEP 3: Abilita Maps JavaScript API

1. Nel menu laterale sinistro, vai su **"API e servizi"** → **"Libreria"** (o **"APIs & Services"** → **"Library"**)
2. Nella barra di ricerca, cerca: **"Maps JavaScript API"**
3. Clicca sul risultato **"Maps JavaScript API"**
4. Clicca **"ABILITA"** o **"ENABLE"**
5. Attendi l'abilitazione (5-10 secondi)

---

## 📐 STEP 4: Abilita Geometry Library

La Geometry Library è necessaria per calcolare le aree dei poligoni tracciati.

1. Sempre in **"API e servizi"** → **"Libreria"**
2. Cerca: **"Maps JavaScript API"** (dovrebbe essere già abilitata)
3. Clicca su **"Maps JavaScript API"**
4. Verifica che sia **"ABILITATA"** (dovrebbe esserlo già)
5. La Geometry Library è inclusa automaticamente quando carichi Maps JavaScript API con `&libraries=geometry`

**Nota**: Non c'è bisogno di abilitare una API separata per Geometry Library. È inclusa quando usi `libraries=geometry` nel caricamento dell'API.

---

## 🔑 STEP 5: Crea Chiave API

1. Nel menu laterale, vai su **"API e servizi"** → **"Credenziali"** (o **"APIs & Services"** → **"Credentials"**)
2. In alto, clicca **"+ CREA CREDENZIALI"** o **"+ CREATE CREDENTIALS"**
3. Seleziona **"Chiave API"** o **"API key"**
4. **COPIA SUBITO** la chiave API generata (es: `AIzaSyBmjpHJg5LtQj_4RtDmRuQQJmyH1bCRWU8`)
   - ⚠️ **IMPORTANTE**: La chiave viene mostrata solo una volta!
   - Se la perdi, devi rigenerarla

---

## 🔒 STEP 6: Configura Limitazioni (OPZIONALE ma CONSIGLIATO)

Per sicurezza, limita l'uso della chiave API:

1. Nella pagina **"Credenziali"**, clicca sulla chiave API appena creata
2. In **"Restrizioni applicazioni"**:
   - Seleziona **"Riferimenti HTTP (siti web)"** o **"HTTP referrers (web sites)"**
   - Aggiungi i domini dove userai la mappa:
     - `http://localhost:*` (per sviluppo locale)
     - `https://tuodominio.com/*` (per produzione)
     - `https://*.github.io/*` (se usi GitHub Pages)
3. In **"Restrizioni API"**:
   - Seleziona **"Limita chiave"** o **"Restrict key"**
   - Seleziona solo **"Maps JavaScript API"**
4. Clicca **"SALVA"** o **"SAVE"**

---

## 📝 STEP 7: Aggiungi Chiave al Progetto

1. Vai nella cartella `gfv-platform/core/`
2. **Copia** il file `google-maps-config.example.js` e rinominalo in `google-maps-config.js`
3. Apri `google-maps-config.js` con un editor di testo
4. Sostituisci `YOUR_GOOGLE_MAPS_API_KEY_HERE` con la tua chiave API:

```javascript
export const GOOGLE_MAPS_API_KEY = "AIzaSyBmjpHJg5LtQj_4RtDmRuQQJmyH1bCRWU8"; // La tua chiave qui
```

5. Salva il file

---

## ✅ STEP 8: Verifica

1. Apri `terreni-standalone.html` nel browser
2. Clicca su **"+ Aggiungi Terreno"**
3. Dovresti vedere la mappa caricarsi correttamente
4. Controlla la console del browser (F12):
   - ✅ Se vedi "Google Maps initialized" → Funziona!
   - ❌ Se vedi errori sulla chiave API → Controlla il file `google-maps-config.js`

---

## 🆘 Problemi Comuni

### "Google Maps non disponibile"
- ✅ Verifica che il file `google-maps-config.js` esista
- ✅ Verifica che la chiave API sia corretta (senza spazi)
- ✅ Verifica che Maps JavaScript API sia abilitata

### "This API key is not authorized"
- ✅ Verifica che Maps JavaScript API sia abilitata nel progetto
- ✅ Controlla le restrizioni API (dovrebbe permettere Maps JavaScript API)

### "RefererNotAllowedMapError"
- ✅ Aggiungi il tuo dominio alle restrizioni HTTP referrer
- ✅ Per sviluppo locale, aggiungi `http://localhost:*`

### "Billing not enabled"
- ✅ Google Maps richiede un account di fatturazione (anche se hai crediti gratuiti)
- ✅ Vai su **"Fatturazione"** → **"Collega account di fatturazione"**
- ✅ Google offre $200 di crediti gratuiti al mese (sufficienti per la maggior parte degli usi)

---

## 💰 Costi

Google Maps offre:
- **$200 di crediti gratuiti al mese**
- Dopo i crediti gratuiti: ~$7 per 1000 caricamenti mappa
- Per uso normale (poche centinaia di utenti): **GRATIS**

---

## 🔐 Sicurezza

**IMPORTANTE**: 
- ✅ Il file `google-maps-config.js` è già nel `.gitignore`
- ✅ **NON** committare mai `google-maps-config.js` su GitHub
- ✅ Usa sempre limitazioni API e HTTP referrer
- ✅ Se la chiave viene compromessa, rigenerala immediatamente

---

## 📚 File di Riferimento

- `google-maps-config.example.js` - Template (può essere committato)
- `google-maps-config.js` - File reale con chiave (NON committare!)
- `.gitignore` - Contiene `google-maps-config.js`

---

## ✅ Checklist Finale

- [ ] Maps JavaScript API abilitata
- [ ] Chiave API creata
- [ ] Limitazioni configurate (opzionale)
- [ ] File `google-maps-config.js` creato con chiave
- [ ] Mappa funziona in `terreni-standalone.html`

---

**Quando hai completato tutti gli step, Google Maps è configurato e pronto all'uso!** ✅

