# 🔒 Configurazione Restrizioni Chiave API Google Maps

## Passo 1: Seleziona "Siti web"

Nel menu a discesa **"Select restriction type"**, seleziona:
- ✅ **"Siti web"** (Websites)

Questo è corretto perché la GFV Platform è un'applicazione web.

---

## Passo 2: Aggiungi URL Consentiti

Dopo aver selezionato "Siti web", ti apparirà un campo per inserire gli URL.

**Aggiungi questi URL (uno per riga):**

### Per Sviluppo Locale:
```
*://localhost/*
*://127.0.0.1/*
```

**⚠️ IMPORTANTE**: Usa `*://` (non `http://`) e `/*` alla fine (non `:*`)

### Per Produzione (se hai già un dominio):
```
https://tuodominio.com/*
https://www.tuodominio.com/*
```

### Se usi GitHub Pages:
```
https://*.github.io/*
```

### Se usi un altro hosting:
```
https://tuosito.com/*
https://www.tuosito.com/*
```

---

## Esempio Completo

Se stai sviluppando in locale e non hai ancora un dominio di produzione, aggiungi solo:

```
http://localhost:*
http://127.0.0.1:*
```

**Nota**: Il `*` alla fine permette qualsiasi porta (es: `localhost:8000`, `localhost:3000`, ecc.)

---

## Passo 3: Aggiungi Restrizione API (OPZIONALE ma CONSIGLIATO)

Dopo aver salvato le restrizioni "Siti web", puoi aggiungere anche una restrizione API:

1. Clicca sulla chiave API per modificarla
2. Scorri fino a **"Restrizioni API"** (API restrictions)
3. Seleziona **"Limita chiave"** (Restrict key)
4. Seleziona solo:
   - ✅ **"Maps JavaScript API"**
5. Salva

Questo limita la chiave a usare solo Maps JavaScript API, aumentando la sicurezza.

---

## ✅ Configurazione Completa

**Restrizioni Applicazioni:**
- ✅ Tipo: Siti web
- ✅ URL: `http://localhost:*` (e altri se necessario)

**Restrizioni API:**
- ✅ Limita chiave: Sì
- ✅ API consentite: Maps JavaScript API

---

## 🎯 Per Iniziare Subito

**Configurazione minima per sviluppo:**

1. Seleziona **"Siti web"**
2. Aggiungi: `*://localhost/*` (formato corretto!)
3. Clicca **"Salva"** (Save)
4. (Opzionale) Aggiungi restrizione API solo a Maps JavaScript API

Con questa configurazione puoi già testare le mappe in locale!

**⚠️ Formato corretto:**
- ✅ `*://localhost/*` (corretto)
- ❌ `http://localhost:*` (sbagliato - non funziona)

---

## ⚠️ Note Importanti

- **Non usare `*` da solo** come URL (troppo permissivo)
- **Aggiungi sempre `http://localhost:*`** per sviluppo locale
- **Aggiungi il dominio di produzione** quando lo hai
- **Le restrizioni API sono opzionali** ma aumentano la sicurezza

---

**Dopo aver salvato, la chiave API è pronta per l'uso!** ✅

