# 🔑 Come Creare/Trovare la Chiave API

## ⚠️ La Chiave API è in un'altra sezione!

L'API Maps JavaScript è abilitata, ma la **chiave API** si trova nella sezione **"Credenziali"**, non nella pagina dell'API.

---

## 🔑 STEP 1: Vai a Credenziali

1. Nel menu laterale sinistro, clicca su **"API e servizi"** (o **"APIs & Services"**)
2. Clicca su **"Credenziali"** (o **"Credentials"**)

---

## 🔑 STEP 2: Crea Nuova Chiave API

1. In alto, clicca **"+ CREA CREDENZIALI"** (o **"+ CREATE CREDENTIALS"**)
2. Nel menu a discesa, seleziona **"Chiave API"** (o **"API key"**)

---

## 🔑 STEP 3: Copia la Chiave

1. **IMPORTANTE**: La chiave viene mostrata **SOLO UNA VOLTA**!
2. **COPIA SUBITO** la chiave API che appare (es: `AIzaSyBmjpHJg5LtQj_4RtDmRuQQJmyH1bCRWU8`)
3. Salvala in un posto sicuro (blocco note, password manager, ecc.)

---

## 🔑 STEP 4: Configura Restrizioni (Opzionale)

Dopo aver creato la chiave, puoi configurarla:

1. Clicca sulla chiave API appena creata (o clicca "Limita chiave" se appare)
2. Configura le restrizioni come spiegato in `CONFIGURA_RESTRIZIONI_API.md`
3. Salva

---

## 🔍 Se Vedi "Nessuna chiave abilitata"

Questo messaggio appare nella pagina dell'API, non nella sezione Credenziali.

**Soluzione:**
1. Vai a **"API e servizi"** → **"Credenziali"**
2. Lì vedrai tutte le chiavi API create
3. Se non ce ne sono, creane una nuova (vedi STEP 2)

---

## 📝 Dopo Aver Ottenuto la Chiave

1. Apri il file `core/google-maps-config.js` (se non esiste, copia da `google-maps-config.example.js`)
2. Sostituisci `YOUR_GOOGLE_MAPS_API_KEY_HERE` con la tua chiave:

```javascript
export const GOOGLE_MAPS_API_KEY = "LA_TUA_CHIAVE_QUI";
```

3. Salva il file

---

## ✅ Verifica

1. Apri `terreni-standalone.html` nel browser
2. Clicca su "+ Aggiungi Terreno"
3. Dovresti vedere la mappa caricarsi

---

**Percorso completo:**
```
Google Cloud Console
  → "API e servizi"
    → "Credenziali"
      → "+ CREA CREDENZIALI"
        → "Chiave API"
          → COPIA la chiave
```

---

**Se hai ancora problemi, dimmi cosa vedi nella sezione Credenziali!** 🚀

