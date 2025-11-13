# 🔌 Come Abilitare Geocoding API

## ⚠️ Problema

Vedi l'errore: **"Geocoding Service: This API project is not authorized to use this API"**

Questo significa che la **Geocoding API** non è abilitata nel tuo progetto Google Cloud.

---

## ✅ Soluzione: Abilita Geocoding API

### STEP 1: Vai alla Libreria API

1. Nella **Google Cloud Console**, nel menu laterale sinistro
2. Clicca su **"API e servizi"** (o **"APIs & Services"**)
3. Clicca su **"Libreria"** (o **"Library"**)

---

### STEP 2: Cerca Geocoding API

1. Nella barra di ricerca in alto, digita: **"Geocoding API"**
2. Clicca sul risultato **"Geocoding API"**

---

### STEP 3: Abilita l'API

1. Nella pagina che si apre, in alto, clicca il pulsante **"ABILITA"** (o **"ENABLE"**)
2. Attendi 5-10 secondi
3. Vedrai un messaggio di conferma

---

## ✅ Verifica

Dopo aver abilitato, dovresti vedere:
- Il pulsante cambia da **"ABILITA"** a **"GESTISCI"** (o **"MANAGE"**)
- L'API appare nella lista delle API abilitate

---

## 📋 API da Abilitare (Riepilogo)

Per far funzionare completamente le mappe, devi avere abilitate:

1. ✅ **Maps JavaScript API** (già abilitata)
2. ✅ **Geocoding API** (da abilitare ora)

**Nota**: La Geometry Library è inclusa automaticamente in Maps JavaScript API, non serve abilitarla separatamente.

---

## 🎯 Dopo Aver Abilitato

1. Ricarica la pagina `terreni-standalone.html`
2. L'errore "Geocoding Service" dovrebbe scomparire
3. La ricerca indirizzo dovrebbe funzionare

---

**Percorso completo:**
```
Google Cloud Console
  → "API e servizi"
    → "Libreria"
      → Cerca "Geocoding API"
        → Clicca "ABILITA"
```

---

**Dopo aver abilitato, ricarica la pagina e prova la ricerca indirizzo!** 🚀


